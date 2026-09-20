/* Page Builder V1.
   Covers the renderer and its guards, the draft/publish separation, the
   admin panel, the element and design editors, and the live preview.
   Nothing here writes to the repository: state lives in the browser. */
const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* A draft that exercises every guard the renderer has to hold. */
const SECTIONS = [
  { id: 's_hero', type: 'hero', enabled: true,
    visibility: { desktop: true, tablet: true, mobile: false },
    style: { bg: '#102030', color: '#ffffff', padding: '60', maxWidth: '900' },
    responsive: { tablet: { padding: '40' }, mobile: { padding: '20' } },
    elements: [
      { id: 'e_h', type: 'heading', content: { text: 'Hero heading', level: 'h2' }, style: { fontSize: '34' } },
      { id: 'e_p', type: 'text',    content: { text: 'Line one\nLine two' } },
      { id: 'e_b', type: 'button',  content: { text: 'Go', href: 'contact.html', newTab: true } }
    ] },
  { id: 's_bad', type: 'banner', enabled: true, elements: [
      { id: 'e_evil', type: 'button', content: { text: 'Evil', href: 'javascript:alert(1)' } },
      { id: 'e_data', type: 'image',  content: { src: 'data:text/html,<script>x</script>', alt: 'x' } },
      { id: 'e_unk',  type: 'nope',   content: { text: 'unknown type' } },
      { id: 'e_html', type: 'heading', content: { text: '<img src=x onerror=alert(1)>' } }
    ] },
  { id: 's_off', type: 'text', enabled: false,
    elements: [{ id: 'e_x', type: 'heading', content: { text: 'Should not render' } }] }
];

/* Seeds localStorage before any page script runs. The payload must travel as
   addInitScript's second argument: a closure variable does not exist in the
   browser, the init script would throw, and nothing would be seeded. */
const seed = (page, status, sections) => page.addInitScript((s) => {
  const raw = JSON.parse(window.localStorage.getItem('whiteLabelCMS') || '{}');
  raw.pages = raw.pages || {};
  raw.pages.about = Object.assign({}, raw.pages.about,
    { builder: { schemaVersion: 1, status: s.status, sections: s.sections } });
  window.localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
}, { status: status, sections: sections });

const stubSupabase = (target, state) => target.route('**supabase.co/**', route => {
  const q = route.request();
  if (q.url().includes('/auth/v1/token'))
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"stub"}' });
  if (q.method() === 'POST') {
    state.posts++; state.row = JSON.parse(q.postData() || '{}');
    return route.fulfill({ status: 201, body: '' });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(state.row ? [{ data: state.row.data, updated_at: state.row.updated_at }] : []) });
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ---------------------------------------------------------- */
  console.log('\n===== MOUNTS =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null };
    await stubSupabase(ctx, st);
    const p = await ctx.newPage();
    for (const f of ['about', 'contact', 'responsible-gaming']) {
      await p.goto(`${BASE}/${f}.html`, { waitUntil: 'domcontentloaded' });
      check(f + '.html has a builder mount',
        await p.$eval('[data-cms-sections]', e => e.getAttribute('data-cms-sections')) === f);
      check(f + '.html links sections.css',
        (await p.$$('link[href$="css/sections.css"]')).length === 1);
    }
    for (const f of ['index', 'login', 'register', '404']) {
      await p.goto(`${BASE}/${f}.html`, { waitUntil: 'domcontentloaded' });
      check(f + '.html deliberately has no mount',
        (await p.$$('[data-cms-sections]')).length === 0);
    }
    await ctx.close();
  }

  /* ---------------------------------------------------------- */
  console.log('\n===== NO BUILDER: THE SHIPPED PAGE IS UNTOUCHED =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null };
    await stubSupabase(ctx, st);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    const a = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section').length,
      mount: document.querySelector('[data-cms-sections]').children.length,
      h2: document.querySelectorAll('.info-body h2').length,
      text: document.querySelector('.info-body').textContent.trim().slice(0, 30),
      css: !!document.getElementById('cmsBuilder') && document.getElementById('cmsBuilder').textContent.length
    }));
    check('no section rendered', a.pb === 0, a.pb);
    check('the mount stays empty', a.mount === 0, a.mount);
    check('the shipped headings are still there', a.h2 >= 3, a.h2);
    check('the shipped copy is still there', a.text.startsWith('JSK1 is an online gaming site'), a.text);
    check('no builder CSS emitted', !a.css, a.css);
    await ctx.close();
  }

  /* ---------------------------------------------------------- */
  console.log('\n===== A DRAFT MUST NOT REACH VISITORS =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null };
    await stubSupabase(ctx, st);
    const p = await ctx.newPage();
    await seed(p, 'draft', SECTIONS);
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    const d = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section').length,
      h2: document.querySelectorAll('.info-body h2').length,
      stored: ((((CMS.data().pages) || {}).about || {}).builder || {}).status || null,
      count: (((((CMS.data().pages) || {}).about || {}).builder || {}).sections || []).length
    }));
    check('the draft really is in the CMS state', d.stored === 'draft' && d.count === 3, [d.stored, d.count]);
    check('draft sections do NOT render', d.pb === 0, d.pb);
    check('the shipped page is intact under a draft', d.h2 >= 3, d.h2);
    await ctx.close();
  }

  /* ---------------------------------------------------------- */
  console.log('\n===== PUBLISHED SECTIONS RENDER, WITH THEIR GUARDS =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null };
    await stubSupabase(ctx, st);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await seed(p, 'published', SECTIONS);
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const secs = [...document.querySelectorAll('.pb-section')];
      const css = (document.getElementById('cmsBuilder') || {}).textContent || '';
      const at = (id, a) => { const e = document.querySelector(`[data-el="${id}"]`); return e ? e.getAttribute(a) : null; };
      const hero = document.querySelector('[data-sec="s_hero"]');
      const head = document.querySelector('[data-el="e_h"]');
      const para = document.querySelector('[data-el="e_p"]');
      return {
        count: secs.length,
        heroClass: hero ? hero.className : '',
        headingTag: head ? head.tagName : null,
        headingText: head ? head.textContent : null,
        rawHeading: document.querySelector('[data-el="e_html"]'),
        rawHeadingText: (document.querySelector('[data-el="e_html"]') || {}).textContent || '',
        rawHeadingHtml: ((document.querySelector('[data-el="e_html"]') || {}).innerHTML || ''),
        injectedImg: document.querySelectorAll('.pb-section img[src="x"]').length,
        paraText: para ? para.textContent : null,
        paraHtml: para ? para.innerHTML : '',
        btnHref: at('e_b', 'href'), btnTarget: at('e_b', 'target'), btnRel: at('e_b', 'rel'),
        evilHref: at('e_evil', 'href'),
        dataImg: !!document.querySelector('[data-el="e_data"]'),
        unknown: !!document.querySelector('[data-el="e_unk"]'),
        disabled: !!document.querySelector('[data-sec="s_off"]'),
        cssBase: /\[data-sec="s_hero"\]\{[^}]*--pb-padding:60px/.test(css),
        cssTablet: /max-width:1024px\)\{\[data-sec="s_hero"\]\{[^}]*--pb-padding:40px/.test(css),
        cssMobile: /max-width:768px\)\{\[data-sec="s_hero"\]\{[^}]*--pb-padding:20px/.test(css),
        cssElement: /\[data-el="e_h"\]\{[^}]*--pb-font-size:34px/.test(css),
        heroBg: getComputedStyle(hero).backgroundColor,
        h2: document.querySelectorAll('.info-body h2').length
      };
    });
    check('only the enabled sections render', r.count === 2, r.count);
    check('the disabled section is skipped', r.disabled === false);
    check('the section gets its type class', r.heroClass.includes('pb-hero'), r.heroClass);
    check('the heading uses the level that was chosen', r.headingTag === 'H2', r.headingTag);
    check('the heading text is the text that was entered', r.headingText === 'Hero heading', r.headingText);
    check('newlines survive without markup', r.paraText === 'Line one\nLine two', r.paraText);
    check('text is inserted as text, never as HTML', !r.paraHtml.includes('<'), r.paraHtml);
    check('stored markup is shown literally, not executed',
      r.rawHeadingText === '<img src=x onerror=alert(1)>' && !r.rawHeadingHtml.includes('<img'), r.rawHeadingHtml);
    check('no injected element reached the DOM', r.injectedImg === 0, r.injectedImg);
    check('a plain link href is kept', r.btnHref === 'contact.html', r.btnHref);
    check('new tab adds target and rel=noopener', r.btnTarget === '_blank' && r.btnRel === 'noopener', [r.btnTarget, r.btnRel]);
    check('a javascript: URL is refused', r.evilHref === '#', r.evilHref);
    check('an image with a data: source is dropped entirely', r.dataImg === false, r.dataImg);
    check('an unknown element type is skipped without throwing', r.unknown === false);
    check('base CSS is emitted for the section', r.cssBase);
    check('the tablet breakpoint is emitted', r.cssTablet);
    check('the mobile breakpoint is emitted', r.cssMobile);
    check('an element gets its own scoped CSS', r.cssElement);
    check('the generated CSS actually paints', r.heroBg === 'rgb(16, 32, 48)', r.heroBg);
    check('the shipped copy survives alongside the sections', r.h2 >= 3, r.h2);
    check('no page errors while rendering', errs.length === 0, errs.slice(0, 3));

    /* visibility at real widths */
    await p.setViewportSize({ width: 390, height: 780 });
    check('a section hidden on mobile is hidden at 390px',
      await p.evaluate(() => getComputedStyle(document.querySelector('[data-sec="s_hero"]')).display === 'none'));
    await p.setViewportSize({ width: 1280, height: 900 });
    check('and visible again on desktop',
      await p.evaluate(() => getComputedStyle(document.querySelector('[data-sec="s_hero"]')).display !== 'none'));
    await ctx.close();
  }

  /* ---------------------------------------------------------- */
  console.log('\n===== DRAFT / PUBLISH API =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null };
    await stubSupabase(ctx, st);
    const p = await ctx.newPage();
    const go = () => p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await go();
    check('the builder offers exactly the mounted pages',
      JSON.stringify(await p.evaluate(() => CMS.sections.pages())) ===
      JSON.stringify(['about', 'contact', 'responsible-gaming']),
      await p.evaluate(() => CMS.sections.pages()));

    let r = await p.evaluate((S) => {
      CMS.sections.saveDraft('about', S);
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS'));
      return { drafted: !!(raw.builderDrafts || {}).about,
               liveBlock: !!(raw.pages.about || {}).builder,
               live: CMS.sections.live('about').length,
               published: CMS.sections.published('about'),
               status: CMS.sections.status('about') };
    }, SECTIONS);
    check('a draft is stored under builderDrafts', r.drafted);
    check('saving a draft does not create the live block', r.liveBlock === false);
    check('nothing is live', r.live === 0 && r.published === null, [r.live, r.published]);
    check('status reports not-live and dirty', r.status.live === false && r.status.dirty === true, r.status);

    await go();
    check('after a reload the page still renders nothing',
      (await p.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);
    check('the draft survived the reload',
      (await p.evaluate(() => CMS.sections.draft('about').sections.length)) === 3);

    r = await p.evaluate(() => {
      CMS.sections.publish('about');
      const blk = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder;
      return { status: blk.status, schema: blk.schemaVersion, stamped: blk.updatedAt,
               live: CMS.sections.live('about').length, dirty: CMS.sections.dirty('about') };
    });
    check('publish writes status published', r.status === 'published', r.status);
    check('publish stamps the schema version', r.schema === 1, r.schema);
    check('publish stamps a date', /^\d{4}-\d{2}-\d{2}$/.test(r.stamped || ''), r.stamped);
    check('the sections are now live', r.live === 3, r.live);
    check('the draft no longer differs from live', r.dirty === false);
    await go();
    check('a visitor now sees the enabled sections',
      (await p.evaluate(() => document.querySelectorAll('.pb-section').length)) === 2);

    r = await p.evaluate(() => {
      const d = CMS.clone(CMS.sections.draft('about').sections);
      d[0].elements[0].content.text = 'Edited later';
      CMS.sections.saveDraft('about', d);
      return { live: CMS.sections.live('about')[0].elements[0].content.text,
               draft: CMS.sections.draft('about').sections[0].elements[0].content.text,
               dirty: CMS.sections.dirty('about') };
    });
    check('editing after publishing leaves the live copy alone', r.live === 'Hero heading', r.live);
    check('the edit sits in the draft', r.draft === 'Edited later', r.draft);
    check('the dirty flag is raised', r.dirty === true);
    await go();
    check('the visitor still sees the published text',
      (await p.evaluate(() => document.querySelector('[data-el="e_h"]').textContent)) === 'Hero heading');

    r = await p.evaluate(() => {
      CMS.sections.discard('about');
      return { draft: CMS.sections.draft('about').sections[0].elements[0].content.text,
               dirty: CMS.sections.dirty('about'),
               stored: !!(JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts || {}).about };
    });
    check('discard returns the draft to what is live', r.draft === 'Hero heading', r.draft);
    check('discard clears the dirty flag', r.dirty === false);
    check('discard removes the stored draft', r.stored === false);

    r = await p.evaluate(() => {
      CMS.sections.unpublish('about');
      const blk = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder;
      return { status: blk.status, kept: blk.sections.length,
               live: CMS.sections.live('about').length,
               draft: CMS.sections.draft('about').sections.length };
    });
    check('unpublish flips the stored status back to draft', r.status === 'draft', r.status);
    check('unpublish keeps the work rather than deleting it', r.kept === 3, r.kept);
    check('nothing is live after unpublishing', r.live === 0, r.live);
    check('the draft still holds the sections', r.draft === 3, r.draft);
    await go();
    const back = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section').length,
      h2: document.querySelectorAll('.info-body h2').length,
      css: (document.getElementById('cmsBuilder') || {}).textContent || '' }));
    check('the page is back to its shipped content', back.pb === 0 && back.h2 >= 3, back);
    check('the builder CSS is cleared', back.css === '', back.css.slice(0, 40));
    check('and it can be published again',
      (await p.evaluate(() => { CMS.sections.publish('about'); return CMS.sections.live('about').length; })) === 3);

    check('only builderDrafts was added at the top level',
      JSON.stringify(await p.evaluate(() =>
        Object.keys(CMS.data()).filter(k => /^builder/.test(k)).sort())) === JSON.stringify(['builderDrafts']));
    check('the other panels’ config is untouched',
      await p.evaluate(() => typeof CMS.data().colors === 'object' && typeof CMS.data().sportsTable === 'object'));
    await ctx.close();
  }

  /* ---------------------------------------------------------- */
  console.log('\n===== ADMIN PANEL =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
    const st = { posts: 0, row: null };
    await stubSupabase(ctx, st);
    const errs = [];
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);

    const panels = await p.$$eval('.adm-panel', e => e.map(x => x.id));
    check('every pre-existing panel is still there',
      ['themes','branding','colors','typography','text','auth','images','home','seo','pages','sportstable','presets','data','reset']
        .every(x => panels.includes('panel-' + x)), panels);
    check('the Page Builder panel exists', panels.includes('panel-builder'));
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
    check('the panel opens', await p.isVisible('#panel-builder'));
    check('one tab per buildable page',
      JSON.stringify(await p.$$eval('#pbTabs .pagetab', e => e.map(x => x.getAttribute('data-slug')))) ===
      JSON.stringify(['about', 'contact', 'responsible-gaming']));
    check('all seven section types can be added',
      JSON.stringify(await p.$$eval('#pbAdd .pb-addbtn', e => e.map(x => x.getAttribute('data-type')))) ===
      JSON.stringify(['hero','text','image','imageText','cards','columns','banner']));
    check('Publish is disabled with an empty draft', await p.isDisabled('#pbPublish'));
    check('Unpublish is disabled with nothing live', await p.isDisabled('#pbUnpublish'));

    st.posts = 0;
    await p.click('#pbAdd .pb-addbtn[data-type="hero"]'); await p.waitForTimeout(250);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(250);
    check('sections appear in the list', (await p.$$('#pbList .pb-sec')).length === 2);
    check('adding a section publishes nothing', st.posts === 0, st.posts);

    const visitor = await ctx.newPage();
    await visitor.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    check('a visitor sees no sections while the admin drafts',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);

    let ids = await p.$$eval('#pbList .pb-sec', e => e.map(x => x.getAttribute('data-sec-id')));
    await p.click(`#pbList .pb-sec[data-sec-id="${ids[1]}"] [data-act="up"]`); await p.waitForTimeout(250);
    check('a section can be moved up',
      (await p.$$eval('#pbList .pb-sec', e => e.map(x => x.getAttribute('data-sec-id'))))[0] === ids[1]);
    await p.click(`#pbList .pb-sec[data-sec-id="${ids[1]}"] [data-act="dup"]`); await p.waitForTimeout(250);
    const dup = await p.evaluate((id) => {
      const d = CMS.sections.draft('about').sections;
      const i = d.findIndex(s => s.id === id);
      const orig = d[i], copy = d[i + 1];
      return { n: d.length, uniqSections: new Set(d.map(s => s.id)).size,
               sameContent: JSON.stringify(orig.elements.map(e => e.content)) ===
                            JSON.stringify(copy.elements.map(e => e.content)),
               freshElementIds: orig.elements.every((e, k) => e.id !== copy.elements[k].id),
               allElementIdsUnique: new Set(
                 d.reduce((a, s) => a.concat(s.elements.map(e => e.id)), [])).size ===
                 d.reduce((a, s) => a + s.elements.length, 0) };
    }, ids[1]);
    check('duplicate adds a section', dup.n === 3, dup.n);
    check('duplicate keeps the content', dup.sameContent, dup);
    check('duplicate gives the copy a fresh section id', dup.uniqSections === 3, dup);
    check('duplicate re-ids the copied elements too', dup.freshElementIds, dup);
    check('no two elements in the draft share an id', dup.allElementIdsUnique, dup);
    await p.uncheck(`#pbList .pb-sec[data-sec-id="${ids[0]}"] [data-act="enable"]`); await p.waitForTimeout(250);
    check('a section can be switched off',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id).enabled === false, ids[0]));

    st.posts = 0;
    await p.click('#pbSaveDraft'); await p.waitForTimeout(400);
    check('Save draft sends nothing to the server', st.posts === 0, st.posts);
    await visitor.reload({ waitUntil: 'networkidle' });
    check('the live page is still unchanged',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);

    st.posts = 0;
    await p.click('#pbPublish'); await p.waitForTimeout(800);
    check('Publish sends exactly one write', st.posts === 1, st.posts);
    check('the published row carries the sections',
      !!(st.row && st.row.data && st.row.data.pages.about.builder &&
         st.row.data.pages.about.builder.status === 'published'));
    await visitor.reload({ waitUntil: 'networkidle' });
    check('the visitor sees the two enabled sections',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 2);

    st.posts = 0;
    await p.click('#pbUnpublish'); await p.waitForTimeout(800);
    await visitor.reload({ waitUntil: 'networkidle' });
    check('Unpublish returns the page to its shipped content',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);
    check('the draft is kept after unpublishing',
      (await p.evaluate(() => CMS.sections.draft('about').sections.length)) === 3);

    console.log('\n===== ELEMENT AND DESIGN EDITORS =====');
    const sec = (await p.$$eval('#pbList .pb-sec', e => e.map(x => x.getAttribute('data-sec-id'))))[0];
    const SEC = `#pbList .pb-sec[data-sec-id="${sec}"]`;
    await p.click(`${SEC} .pb-sec-title`); await p.waitForTimeout(300);
    if (!(await p.isVisible(`${SEC} .pb-sec-body`))) { await p.click(`${SEC} .pb-sec-title`); await p.waitForTimeout(300); }
    check('a section opens on Content / Design / Visibility',
      JSON.stringify(await p.$$eval(`${SEC} .pb-subtab`, e => e.map(x => x.getAttribute('data-view')))) ===
      JSON.stringify(['content', 'design', 'visibility']));
    check('all six element types can be added',
      JSON.stringify(await p.$$eval(`${SEC} .pb-add-el > .pb-addbtn`, e => e.map(x => x.getAttribute('data-el-type')))) ===
      JSON.stringify(['heading', 'text', 'image', 'button', 'card', 'columns']));

    await p.fill(`${SEC} .pb-el .pb-field:has(> span:text-is("Text")) .pb-in`, 'Typed heading');
    await p.waitForTimeout(500);
    check('a content edit lands in the draft',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id)
        .elements[0].content.text === 'Typed heading', sec));
    check('no editor state leaks into the saved draft',
      !/__pb|pbView|pbDevice/.test(await p.evaluate(() => JSON.stringify(CMS.sections.draft('about')))));

    await p.click(`${SEC} .pb-add-el > .pb-addbtn[data-el-type="button"]`); await p.waitForTimeout(400);
    const btn = await p.$$eval(`${SEC} .pb-el`, e => e[e.length - 1].getAttribute('data-el-id'));
    const BTN = `${SEC} .pb-el[data-el-id="${btn}"]`;
    await p.fill(`${BTN} .pb-field:has(> span:text-is("Links to")) .pb-in`, 'javascript:alert(1)');
    await p.waitForTimeout(400);
    check('the admin is warned about a refused URL',
      await p.$eval(BTN, e => [...e.querySelectorAll('.pb-warn')].some(x => !x.hidden)));
    await p.fill(`${BTN} .pb-field:has(> span:text-is("Links to")) .pb-in`, 'contact.html');
    await p.waitForTimeout(400);
    check('the warning clears for an allowed URL',
      await p.$eval(BTN, e => [...e.querySelectorAll('.pb-warn')].every(x => x.hidden)));

    await p.click(`${SEC} .pb-add-el > .pb-addbtn[data-el-type="image"]`); await p.waitForTimeout(400);
    const img = await p.$$eval(`${SEC} .pb-el`, e => e[e.length - 1].getAttribute('data-el-id'));
    const IMG = `${SEC} .pb-el[data-el-id="${img}"]`;
    await p.fill(`${IMG} .pb-field:has(> span:text-is("Image URL")) .pb-in`, 'images/logo.png');
    await p.waitForTimeout(400);
    check('an image without alt text is flagged',
      await p.$eval(IMG, e => { const w = e.querySelector('[data-warn="alt"]'); return !!w && !w.hidden; }));
    await p.fill(`${IMG} .pb-field:has(> span:text-is("Alt text")) .pb-in`, 'Site logo');
    await p.waitForTimeout(400);
    check('the flag clears once alt text is given',
      await p.$eval(IMG, e => { const w = e.querySelector('[data-warn="alt"]'); return !!w && w.hidden; }));

    await p.click(`${SEC} .pb-subtab[data-view="design"]`); await p.waitForTimeout(300);
    check('three breakpoints are offered',
      JSON.stringify(await p.$$eval(`${SEC} .pb-devtab`, e => e.map(x => x.getAttribute('data-device')))) ===
      JSON.stringify(['base', 'tablet', 'mobile']));
    const PAD = `${SEC} .pb-subbody .pb-field:has(> span:text-is("Padding (px)")) .pb-in`;
    await p.fill(PAD, '64'); await p.waitForTimeout(500);
    check('a desktop value is stored on style',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id).style.padding === '64', sec));
    await p.click(`${SEC} .pb-devtab[data-device="mobile"]`); await p.waitForTimeout(300);
    check('the mobile box starts empty rather than inheriting', (await p.inputValue(PAD)) === '');
    await p.fill(PAD, '18'); await p.waitForTimeout(500);
    check('a mobile value is stored as an override, leaving desktop alone',
      await p.evaluate(id => { const s = CMS.sections.draft('about').sections.find(x => x.id === id);
        return s.responsive.mobile.padding === '18' && s.style.padding === '64'; }, sec));
    await p.click(`${SEC} [data-act="clear-device"]`); await p.waitForTimeout(500);
    check('clearing a breakpoint touches only that breakpoint',
      await p.evaluate(id => { const s = CMS.sections.draft('about').sections.find(x => x.id === id);
        return JSON.stringify(s.responsive.mobile) === '{}' && s.style.padding === '64'; }, sec));

    await p.click(`${SEC} .pb-subtab[data-view="visibility"]`); await p.waitForTimeout(300);
    await p.uncheck(`${SEC} [data-vis="mobile"]`); await p.waitForTimeout(500);
    check('a visibility choice is stored',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id).visibility.mobile === false, sec));

    console.log('\n===== LIVE PREVIEW =====');
    check('the preview loads the real page',
      /about\.html$/.test(await p.getAttribute('#pbFrame', 'data-page') || ''),
      await p.getAttribute('#pbFrame', 'data-page'));
    let fr = p.frame({ url: u => /about\.html/.test(u) });
    check('the preview frame is the site page', !!fr && (await fr.$('.info-body')) !== null);
    check('the preview shows the unpublished draft', (await fr.$$('.pb-section')).length > 0);
    check('a visitor still sees nothing',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);
    check('the preview pill says Draft', (await p.textContent('#pbPrevTag')) === 'Draft');
    check('three device widths are offered',
      JSON.stringify(await p.$$eval('#pbDevices .pb-devtab', e => e.map(x => x.getAttribute('data-viewport')))) ===
      JSON.stringify(['desktop', 'tablet', 'mobile']));
    for (const [dev, w] of [['mobile', 390], ['tablet', 900], ['desktop', 1280]]) {
      await p.click(`#pbDevices .pb-devtab[data-viewport="${dev}"]`); await p.waitForTimeout(350);
      check(dev + ' lays the page out at ' + w + 'px',
        await p.evaluate(() => document.getElementById('pbFrame').contentWindow.innerWidth) === w);
    }
    check('a wide viewport is scaled down to fit the column',
      await p.evaluate(() => Math.round(document.getElementById('pbFrame').getBoundingClientRect().width)) < 1280);

    await p.click(`${SEC} .pb-subtab[data-view="content"]`); await p.waitForTimeout(300);
    await p.fill(`${SEC} .pb-el .pb-field:has(> span:text-is("Text")) .pb-in`, 'Preview updates live');
    await p.waitForTimeout(600);
    fr = p.frame({ url: u => /about\.html/.test(u) });
    check('typing updates the preview',
      (await fr.textContent('.pb-section')).includes('Preview updates live'));
    check('and the preview survives the draft autosave',
      await fr.evaluate(() => (document.getElementById('cmsBuilder') || {}).textContent !== ''));
    check('the admin ran without console errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
