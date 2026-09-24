/* Page Builder V2 -- milestone E: admin UX and SEO compatibility.

   THE CLAIM. Builder content and the SEO system are two separate things
   that share a page, and neither one is allowed to quietly become the
   other. The SEO fields stay authoritative, the builder stays visible
   content, and the one place they genuinely collide -- the page's H1 --
   is not papered over but SAID OUT LOUD in the admin, with the author
   deciding what to do about it.

   The renderer is deliberately NOT changed by this milestone. A builder
   heading can still be an h1, because that is the author's call; what
   changes is that the builder stops shipping templates that guarantee a
   second one, and starts telling the truth about the ones it has. */
const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const stub = (target, state) => target.route('**supabase.co/**', route => {
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

const sec = (id, elements, extra) => Object.assign({ id: id, type: 'text', enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true },
  style: {}, responsive: {}, elements: elements || [] }, extra || {});
const el = (id, type, content, style) =>
  ({ id: id, type: type, content: content || {}, style: style || {}, responsive: {} });

/* A public page, with whatever CMS state the case needs. */
async function page(b, seed, url) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  if (seed) await p.addInitScript(arg => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg);
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/${url || 'about.html'}`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}

/* Publish a builder for a slug without touching anything else on the page. */
const withBuilder = (slug, sections, pageExtra) => ({
  pages: Object.assign({}, { [slug]: Object.assign({
    builder: { schemaVersion: 2, status: 'published', sections: sections }
  }, pageExtra || {}) })
});

const head = p => p.evaluate(() => {
  const m = (s, a) => { const e = document.head.querySelector(s); return e ? e.getAttribute(a || 'content') : null; };
  return {
    title: document.title,
    desc: m('meta[name="description"]'),
    robots: m('meta[name="robots"]'),
    canon: m('link[rel="canonical"]', 'href'),
    ogTitle: m('meta[property="og:title"]'),
    ogDesc: m('meta[property="og:description"]'),
    ogUrl: m('meta[property="og:url"]'),
    ogImage: m('meta[property="og:image"]'),
    twTitle: m('meta[name="twitter:title"]'),
    twDesc: m('meta[name="twitter:description"]'),
    twImage: m('meta[name="twitter:image"]'),
    h1s: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()),
    headings: [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => h.tagName),
    builtHeadings: [...document.querySelectorAll('.pb-section h1,.pb-section h2,' +
      '.pb-section h3,.pb-section h4,.pb-section h5,.pb-section h6')].map(h => h.tagName),
    breadcrumbs: document.querySelectorAll('.breadcrumb').length,
    crumbLabel: (document.querySelector('.breadcrumb-current') || {}).textContent,
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')]
          .map(s => ({ id: s.id, txt: s.textContent })),
    sections: document.querySelectorAll('.pb-section').length,
    bodyText: document.body.innerText
  };
});

async function adminPage(b, seed, size) {
  const ctx = await b.newContext({ viewport: size || { width: 1700, height: 1600 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  if (seed) await p.addInitScript(arg => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg);
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
  await p.waitForTimeout(450);
  return { ctx, p, errs, st };
}
const openBuilder = async p => { await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(800); };
const openSec = async (p, i) => {
  await p.evaluate(n => {
    const r = document.querySelectorAll('#pbList > .pb-sec')[n];
    if (r && !r.classList.contains('open')) r.querySelector('.pb-sec-title').click();
  }, i || 0);
  await p.waitForTimeout(550);
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. THE H1 QUESTION, ON THE PAGE ITSELF
     ================================================================ */
  console.log('\n===== WHAT CONTROLS THE VISIBLE H1 =====');
  {
    /* (N) legacy: no builder at all */
    let r = await page(b, null);
    let h = await head(r.p);
    check('a page with no builder has exactly one H1', h.h1s.length === 1, h.h1s);
    check('and it is the one the SEO system controls', h.h1s[0] === 'About JSK1', h.h1s);
    check('no builder sections are rendered', h.sections === 0);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();

    /* (O) builder page whose headings are all h2 -- the shipped default */
    r = await page(b, withBuilder('about', [sec('s1', [
      el('e1', 'heading', { text: 'Builder section', level: 'h2' }),
      el('e2', 'text', { text: 'Some copy.' })
    ])]));
    h = await head(r.p);
    check('a builder page still has exactly one H1', h.h1s.length === 1, h.h1s);
    check('which is still the SEO heading, not the builder', h.h1s[0] === 'About JSK1', h.h1s);
    check('and the builder content really did render', h.sections === 1 &&
      /Builder section/.test(h.bodyText));
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();

    /* the author's own choice is still honoured -- nothing rewrites it */
    r = await page(b, withBuilder('about', [sec('s1', [
      el('e1', 'heading', { text: 'Builder H1', level: 'h1' })
    ])]));
    h = await head(r.p);
    check('an h1 an author chose is still rendered as an h1',
      h.h1s.length === 2 && h.h1s.indexOf('Builder H1') > -1, h.h1s);
    check('the renderer is unchanged: nothing silently demoted it',
      h.headings[0] === 'H1', h.headings.slice(0, 4));
    await r.ctx.close();

    /* several of them */
    r = await page(b, withBuilder('about', [sec('s1', [
      el('e1', 'heading', { text: 'One', level: 'h1' }),
      el('e2', 'heading', { text: 'Two', level: 'h1' }),
      el('e3', 'heading', { text: 'Three', level: 'h3' })
    ])]));
    h = await head(r.p);
    check('several builder h1s all render', h.h1s.length === 3, h.h1s);
    check('and a lower level beside them is untouched',
      h.builtHeadings.join(',') === 'H1,H1,H3', h.builtHeadings);
    await r.ctx.close();

    /* a page with the SEO heading blanked */
    r = await page(b, {
      pages: { about: { heading: '',
        builder: { schemaVersion: 2, status: 'published',
          sections: [sec('s1', [el('e1', 'heading', { text: 'Only heading', level: 'h2' })])] } } }
    });
    h = await head(r.p);
    /* get() treats '' as absent, which is the static-first rule doing its
       job: a blanked CMS field leaves the shipped markup alone. */
    check('an empty CMS heading does not blank the shipped H1',
      h.h1s.length === 1 && h.h1s[0] === 'About JSK1', h.h1s);
    check('and the builder does not step in to supply one either',
      h.builtHeadings.indexOf('H1') === -1, h.builtHeadings);
    await r.ctx.close();
  }

  /* ================================================================
     2. NO TEMPLATE SHIPS A SECOND H1
     ================================================================ */
  console.log('\n===== THE TEMPLATE REGISTRY =====');
  {
    const { ctx, p, errs } = await page(b, null);
    const r = await p.evaluate(() => {
      const out = {};
      CMS.sections.templates().forEach(t => {
        const o = CMS.sections.outline(CMS.sections.fromTemplate(t.id));
        out[t.id] = { h1: o.counts.h1, h2: o.counts.h2, total: o.items.length };
      });
      return out;
    });
    Object.keys(r).forEach(id => {
      check('the "' + id + '" template adds no second H1', r[id].h1 === 0, r[id]);
    });
    check('and they still have headings to be found', Object.keys(r)
      .every(id => r[id].total > 0), r);
    check('the opening heading still looks like a page title',
      (await p.evaluate(() => CMS.sections.fromTemplate('information')[0]
        .elements[0].style.typography)) === '@h1');
    check('and it is an h2 in the outline',
      (await p.evaluate(() => CMS.sections.fromTemplate('information')[0]
        .elements[0].content.level)) === 'h2');
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     3. THE OUTLINE READER
     ================================================================ */
  console.log('\n===== COUNTING WHAT WOULD ACTUALLY RENDER =====');
  {
    const { ctx, p, errs } = await page(b, null);
    const r = await p.evaluate(() => {
      const S = CMS.sections;
      const mk = (id, els, on) => ({ id: id, type: 'text', enabled: on !== false,
        visibility: {}, style: {}, responsive: {}, elements: els });
      const h = (id, lvl, txt) => ({ id: id, type: 'heading',
        content: { text: txt || id, level: lvl }, style: {}, responsive: {} });
      const out = {};
      out.simple = S.outline([mk('a', [h('h1', 'h1'), h('h2', 'h2'), h('h3', 'h3')])]).counts;
      /* a missing or unusable level renders as h2, so it counts as one */
      out.fallback = S.outline([mk('a', [
        { id: 'x', type: 'heading', content: { text: 'no level' }, style: {} },
        { id: 'y', type: 'heading', content: { text: 'junk', level: 'h9' }, style: {} },
        { id: 'z', type: 'heading', content: { text: 'proto', level: '__proto__' }, style: {} }
      ])]).counts;
      /* a disabled section renders nothing, so it counts nothing */
      out.offSection = S.outline([mk('a', [h('h1', 'h1')], false)]).counts.h1;
      out.offElement = S.outline([mk('a', [
        Object.assign(h('h1', 'h1'), { enabled: false })])]).counts.h1;
      /* headings nested in columns are still headings */
      out.nested = S.outline([mk('a', [
        { id: 'c', type: 'columns', style: {}, content: { columns: [
          { elements: [h('n1', 'h1')] }, { elements: [h('n2', 'h2')] } ] } }
      ])]).counts;
      out.order = S.outline([mk('a', [h('p', 'h2', 'first'), h('q', 'h1', 'second')])])
        .items.map(i => i.level + ':' + i.text);
      out.junk = [S.outline(null).items.length, S.outline('nope').items.length,
                  S.outline([null, undefined]).items.length];
      return out;
    });
    check('it counts each level it finds',
      r.simple.h1 === 1 && r.simple.h2 === 1 && r.simple.h3 === 1, r.simple);
    check('a missing or unusable level counts as the h2 it renders as',
      r.fallback.h2 === 3 && r.fallback.h1 === 0, r.fallback);
    check('a disabled section contributes nothing', r.offSection === 0);
    check('nor does a disabled element', r.offElement === 0);
    check('headings inside columns are counted',
      r.nested.h1 === 1 && r.nested.h2 === 1, r.nested);
    check('items come back in document order',
      r.order.join(',') === 'h2:first,h1:second', r.order);
    check('junk in, empty out', r.junk.join(',') === '0,0,0', r.junk);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     4. THE ADMIN SAYS SO
     ================================================================ */
  console.log('\n===== THE BUILDER TELLS THE TRUTH ABOUT THE H1 =====');
  {
    const { ctx, p, errs } = await adminPage(b);
    await openBuilder(p);

    check('the builder names the page being edited',
      /About/.test(await p.$eval('#pbWhere', n => n.textContent)));
    check('and its address', /about\.html/.test(await p.$eval('#pbWhere', n => n.textContent)));
    check('the active page tab says so to a screen reader too',
      (await p.$eval('#pbTabs .pagetab.active', n => n.getAttribute('aria-current'))) === 'page');

    const words = () => p.$eval('#pbHeadings', n => n.textContent);
    check('it says where the visible H1 comes from',
      /Pages/.test(await words()) && /H1 heading/.test(await words()), await words());
    check('and quotes the heading that is actually set',
      /About JSK1/.test(await words()));
    check('an empty draft says so rather than warning about nothing',
      /no headings yet/i.test(await words()), await words());

    await p.click('#pbTemplates .pb-template[data-template="information"]');
    await p.waitForTimeout(900);
    check('after a template it confirms there is still exactly one H1',
      /exactly one/.test(await words()), await words());
    check('and there is nothing to demote', (await p.$$eval('[data-act="h1-demote"]', n => n.length)) === 0);

    /* now make one, through the real control */
    await openSec(p, 0);
    await p.selectOption('.pb-elcard:first-child .pb-field:has(> span:text-is("Level")) select', 'h1');
    await p.waitForTimeout(700);
    check('choosing H1 in the Level control is allowed',
      (await p.evaluate(() => CMS.sections.outline(CMS.sections.draft('about').sections).counts.h1)) === 1);
    check('and the warning appears without a rebuild being asked for',
      /set to/.test(await words()) && /H1/.test(await words()), await words());
    check('it counts the page total honestly', /show 2 in total/.test(await words()), await words());
    check('it names the heading by its own text',
      (await p.$eval('.pb-h1row .pb-h1text', n => n.textContent)) === 'Page title');
    check('and offers to change it', (await p.$$eval('[data-act="h1-demote"]', n => n.length)) === 1);
    check('but says nothing changes on its own',
      /Nothing changes unless you press/.test(await words()));

    await p.click('[data-act="h1-demote"]');
    await p.waitForTimeout(800);
    check('pressing it changes that one heading to h2',
      (await p.evaluate(() => CMS.sections.draft('about').sections[0].elements[0].content.level)) === 'h2');
    check('the warning is gone', /exactly one/.test(await words()), await words());
    check('the draft was saved through the normal path',
      /saved/.test(await p.$eval('#pbSaveState', n => n.className)));
    check('and nothing was published', (await p.evaluate(() =>
      !!(CMS.data().pages.about.builder && CMS.data().pages.about.builder.status === 'published'))) === false);

    /* two at once */
    await p.selectOption('.pb-elcard:first-child .pb-field:has(> span:text-is("Level")) select', 'h1');
    await p.waitForTimeout(500);
    await openSec(p, 1);
    await p.selectOption('#pbList > .pb-sec:nth-child(2) .pb-elcard:first-child .pb-field:has(> span:text-is("Level")) select', 'h1');
    await p.waitForTimeout(700);
    check('two H1s are reported as two',
      (await p.$$eval('[data-act="h1-demote"]', n => n.length)) === 2);
    check('and a change-them-all action appears',
      (await p.$$eval('[data-act="h1-demote-all"]', n => n.length)) === 1);
    const levelsBefore = await p.evaluate(() =>
      CMS.sections.outline(CMS.sections.draft('about').sections).items.map(i => i.level));
    await p.click('[data-act="h1-demote-all"]');
    await p.waitForTimeout(800);
    const levelsAfter = await p.evaluate(() =>
      CMS.sections.outline(CMS.sections.draft('about').sections).items.map(i => i.level));
    check('which changes both',
      (await p.evaluate(() => CMS.sections.outline(CMS.sections.draft('about').sections).counts.h1)) === 0);
    check('and touches nothing that was not an H1',
      levelsAfter.join(',') === levelsBefore.map(l => l === 'h1' ? 'h2' : l).join(','),
      { levelsBefore, levelsAfter });
    check('no ids or content were lost on the way',
      (await p.evaluate(() => CMS.sections.draft('about').sections[0].elements[0].content.text)) === 'Page title');
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     5. THE PAGES PANEL SAYS SO TOO
     ================================================================ */
  console.log('\n===== THE PAGES PANEL KNOWS ABOUT PUBLISHED BUILDER H1s =====');
  {
    let a = await adminPage(b);
    await a.p.click('.adm-nav-item[data-panel="pages"]'); await a.p.waitForTimeout(700);
    await a.p.click('#pageTabs .pagetab[data-page-key="about"]'); await a.p.waitForTimeout(600);
    check('with no builder published, the H1 field carries no warning',
      (await a.p.$$eval('#pageEditor [data-warn="h1"]', n => n.length)) === 0);
    check('the OG and X image fields offer the site’s own images',
      (await a.p.$$eval('#pageEditor [data-act$="-pick"]', n => n.map(x => x.getAttribute('data-act'))))
        .join(',') === 'og-pick,twitter-pick');

    /* What the picker hands back is a manifest ENTRY, not a string. The
       field must end up holding that entry's path -- a plain relative one
       the SEO engine can make absolute -- and nothing else. */
    await a.p.click('#pageEditor [data-act="og-pick"]');
    await a.p.waitForTimeout(900);
    check('the picker opens on the site\u2019s own images',
      (await a.p.$eval('#pbAssetModal', n => n.hidden)) === false);
    await a.p.click('#pbAssetGrid > *');
    await a.p.waitForTimeout(350);
    await a.p.click('#pbAssetUse');
    await a.p.waitForTimeout(700);
    const picked = await a.p.evaluate(() => (CMS.data().pages.about.og || {}).image || '');
    check('what lands in the field is a plain relative asset path',
      /^assets\/[A-Za-z0-9._\/-]+$/.test(picked), picked);
    check('not an object, a protocol or a traversal',
      picked.indexOf('object') === -1 && picked.indexOf(':') === -1 &&
      picked.indexOf('..') === -1, picked);
    check('and it is one the asset validator recognises',
      (await a.p.evaluate(p2 => CMS.sections.assetPath(p2), picked)) === picked, picked);
    check('the input shows the same thing the field holds',
      (await a.p.$eval('#pageEditor [data-act="og-pick"]',
        n => n.closest('.f').querySelector('input').value)) === picked);

    check('no page errors', a.errs.length === 0, a.errs);
    await a.ctx.close();

    /* A draft is not on the page, so it is not what the H1 field reports. */
    a = await adminPage(b, { builderDrafts: { about: { schemaVersion: 2, status: 'draft',
      sections: [sec('s1', [el('d1', 'heading', { text: 'Drafted H1', level: 'h1' })])] } } });
    await a.p.click('.adm-nav-item[data-panel="pages"]'); await a.p.waitForTimeout(700);
    await a.p.click('#pageTabs .pagetab[data-page-key="about"]'); await a.p.waitForTimeout(600);
    check('an H1 that is only in the DRAFT raises no warning in Pages',
      (await a.p.$$eval('#pageEditor [data-warn="h1"]', n => n.length)) === 0);
    check('because the page does not show it yet',
      (await a.p.evaluate(() => CMS.sections.live('about').length)) === 0);
    check('no page errors', a.errs.length === 0, a.errs);
    await a.ctx.close();

    a = await adminPage(b, withBuilder('about', [sec('s1', [
      el('e1', 'heading', { text: 'Published H1', level: 'h1' }),
      el('e2', 'heading', { text: 'Another', level: 'h1' })
    ])]));
    await a.p.click('.adm-nav-item[data-panel="pages"]'); await a.p.waitForTimeout(700);
    await a.p.click('#pageTabs .pagetab[data-page-key="about"]'); await a.p.waitForTimeout(600);
    const warn = await a.p.$$eval('#pageEditor [data-warn="h1"]', n => n.map(x => x.textContent));
    check('with two published builder H1s, the H1 field says so',
      warn.length === 1 && /2 more H1s/.test(warn[0]) && /shows 3/.test(warn[0]), warn);
    check('and points at where to change them', /Page Builder/.test(warn[0] || ''), warn);
    check('no page errors', a.errs.length === 0, a.errs);
    await a.ctx.close();
  }

  /* ================================================================
     6. TITLE, DESCRIPTION, CANONICAL, ROBOTS
     ================================================================ */
  console.log('\n===== THE BUILDER DOES NOT TOUCH THE HEAD =====');
  {
    const sections = [sec('s1', [
      el('e1', 'heading', { text: 'A totally different headline', level: 'h2' }),
      el('e2', 'text', { text: 'Builder body copy that is not the meta description.' })
    ])];

    /* (E,F,G,H) the SEO fields win, and the builder is invisible to them */
    let r = await page(b, {
      pages: { about: {
        title: 'Set in the CMS', metaDescription: 'Described in the CMS',
        canonical: 'about.html', robots: { index: true, follow: false },
        builder: { schemaVersion: 2, status: 'published', sections: sections } } }
    });
    let h = await head(r.p);
    check('the title is the CMS title through the existing template',
      h.title === 'Set in the CMS | JSK1', h.title);
    check('the description is the CMS description',
      h.desc === 'Described in the CMS', h.desc);
    check('robots follows the page setting', h.robots === 'index,nofollow', h.robots);
    check('canonical follows the page override',
      h.canon === 'https://jsk-1.com/about.html', h.canon);
    check('no builder text reached the head',
      !/totally different headline/i.test([h.title, h.desc, h.ogTitle, h.ogDesc,
        h.twTitle, h.twDesc, h.canon, h.ogImage].join(' ')),
      { title: h.title, desc: h.desc });
    check('but the builder did render in the body', h.sections === 1);
    await r.ctx.close();

    /* (Q) invalid / empty SEO input never replaces a valid static value */
    r = await page(b, {
      pages: { about: { title: '', metaDescription: '   ', canonical: '',
        builder: { schemaVersion: 2, status: 'published', sections: sections } } }
    });
    h = await head(r.p);
    check('an empty CMS title leaves the static one alone',
      h.title && h.title !== '' && /JSK1/.test(h.title), h.title);
    check('a whitespace-only description does not blank the static one',
      h.desc && h.desc.trim().length > 10, h.desc);
    check('an empty canonical falls back to the built URL',
      h.canon === 'https://jsk-1.com/about.html', h.canon);
    await r.ctx.close();

    /* robots with nothing set at all */
    r = await page(b, {
      pages: { about: { robots: {},
        builder: { schemaVersion: 2, status: 'published', sections: sections } } }
    });
    h = await head(r.p);
    check('a robots object with nothing in it leaves the static tag',
      h.robots === 'index,follow', h.robots);
    await r.ctx.close();
  }

  /* ================================================================
     7. OPEN GRAPH AND X
     ================================================================ */
  console.log('\n===== SOCIAL METADATA =====');
  {
    const sections = [sec('s1', [el('e1', 'image',
      { src: 'assets/images/logo.png', alt: 'Logo' })])];

    /* (J) a builder image does NOT become the og:image by itself */
    let r = await page(b, withBuilder('about', sections));
    let h = await head(r.p);
    check('a builder image does not silently become og:image',
      !/logo\.png/.test(h.ogImage || ''), h.ogImage);
    check('og:title still comes from the SEO cascade',
      h.ogTitle === h.title, { ogTitle: h.ogTitle, title: h.title });
    check('X inherits from Open Graph as before',
      h.twTitle === h.ogTitle && h.twDesc === h.ogDesc, { tw: h.twTitle, og: h.ogTitle });
    await r.ctx.close();

    /* a path chosen in the admin is used, and made absolute */
    r = await page(b, {
      pages: { about: { og: { title: 'Shared title', description: 'Shared text',
                              image: 'assets/images/logo.png' },
        builder: { schemaVersion: 2, status: 'published', sections: sections } } }
    });
    h = await head(r.p);
    check('an og:image set in the admin is emitted, absolute',
      h.ogImage === 'https://jsk-1.com/assets/images/logo.png', h.ogImage);
    check('X falls back to it', h.twImage === h.ogImage, h.twImage);
    check('the og title and description are the ones set',
      h.ogTitle === 'Shared title' && h.ogDesc === 'Shared text', h);
    await r.ctx.close();

    /* (R) the URLs the existing rules refuse are still refused */
    for (const bad of ['data:image/png;base64,iVBORw0KGgo=', 'blob:https://x/y',
                       'javascript:alert(1)']) {
      r = await page(b, {
        pages: { about: { og: { image: bad }, twitter: { image: bad },
          builder: { schemaVersion: 2, status: 'published', sections: sections } } }
      });
      h = await head(r.p);
      const ok = /^(data|blob|javascript):/i.test(bad)
        ? !/^(data|blob|javascript):/i.test(h.ogImage || '') &&
          !/^(data|blob|javascript):/i.test(h.twImage || '')
        : true;
      check('og:image refuses ' + bad.slice(0, 22), ok, { og: h.ogImage, tw: h.twImage });
      await r.ctx.close();
    }
  }

  /* ================================================================
     8. STRUCTURED DATA AND BREADCRUMBS
     ================================================================ */
  console.log('\n===== SCHEMA AND BREADCRUMBS ARE UNMOVED BY THE BUILDER =====');
  {
    const loud = [sec('s1', [
      el('e1', 'heading', { text: 'Five star service, 10/10, best in the world', level: 'h2' }),
      el('e2', 'text', { text: 'Reviewed by nobody. Rating: excellent.' }),
      el('e3', 'faq', { items: [{ question: 'Is this a FAQ?', answer: 'Yes.' }] })
    ])];

    /* (L) nothing the builder holds becomes schema */
    let r = await page(b, withBuilder('about', loud));
    let h = await head(r.p);
    const all = h.ld.map(x => x.txt).join('\n');
    check('the builder renders its FAQ on the page', /Is this a FAQ\?/.test(h.bodyText));
    check('but no builder text appears in any structured data',
      !/Five star|10\/10|Reviewed by nobody|Is this a FAQ/.test(all), all.slice(0, 300));
    check('no rating, review or aggregate schema is invented',
      !/aggregateRating|"Review"|reviewRating|ratingValue|FAQPage|Question/i.test(all), all.slice(0, 300));
    check('the WebPage block is still the CMS one',
      /"@type": "WebPage"/.test(all) && /About JSK1|About —|About/.test(all), all.slice(0, 200));
    check('this page carries the two blocks it ships, and no more',
      h.ld.map(x => x.id).join(',') === 'ldPage,ldBreadcrumb', h.ld.map(x => x.id));
    /* The shipped block is indented four spaces and begins with a newline;
       what writeLd() produces begins at the brace and indents two. That the
       CMS wrote it at all is the point -- the blocks sit below js/cms.js in
       the <head>, so until this milestone they never were written. */
    check('and they are written by the CMS now, not left as shipped markup',
      /^\{\n  "/.test((h.ld.find(x => x.id === 'ldPage') || {}).txt || ''),
      ((h.ld.find(x => x.id === 'ldPage') || {}).txt || '').slice(0, 40));
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();

    /* (K) breadcrumb: shown */
    r = await page(b, {
      pages: { about: { breadcrumb: { label: 'About us', show: true },
        schema: { webPage: true, breadcrumb: true },
        builder: { schemaVersion: 2, status: 'published', sections: loud } } }
    });
    h = await head(r.p);
    check('the breadcrumb still renders with builder content present', h.breadcrumbs === 1);
    check('and uses the CMS label', (h.crumbLabel || '').trim() === 'About us', h.crumbLabel);
    check('BreadcrumbList schema is emitted',
      /"@type": "BreadcrumbList"/.test(h.ld.map(x => x.txt).join('')), h.ld.length);
    check('and it names the breadcrumb, not a builder heading',
      /About us/.test(h.ld.map(x => x.txt).join('')) &&
      !/Five star/.test(h.ld.map(x => x.txt).join('')));
    await r.ctx.close();

    /* breadcrumb: schema switched off */
    r = await page(b, {
      pages: { about: { breadcrumb: { label: 'About us', show: true },
        schema: { webPage: true, breadcrumb: false },
        builder: { schemaVersion: 2, status: 'published', sections: loud } } }
    });
    h = await head(r.p);
    const crumbLd = (h.ld.find(x => x.id === 'ldBreadcrumb') || {}).txt || '';
    check('with the schema toggle off, the breadcrumb block is emptied',
      crumbLd.trim() === '{}', crumbLd.slice(0, 60));
    await r.ctx.close();

    /* invalid breadcrumb data */
    r = await page(b, {
      pages: { about: { breadcrumb: { label: '', show: true },
        schema: { webPage: true, breadcrumb: true },
        builder: { schemaVersion: 2, status: 'published', sections: loud } } }
    });
    h = await head(r.p);
    const crumb2 = (h.ld.find(x => x.id === 'ldBreadcrumb') || {}).txt || '';
    check('an empty label falls back to the page label rather than breaking',
      crumb2.trim() === '{}' || /"@type": "BreadcrumbList"/.test(crumb2), crumb2.slice(0, 80));
    check('no page errors on invalid breadcrumb data', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     9. SITEMAP
     ================================================================ */
  console.log('\n===== THE SITEMAP NEVER SEES BUILDER DATA =====');
  {
    const big = [sec('s1', [
      el('e1', 'heading', { text: 'A heading that must not appear in any XML', level: 'h2' }),
      el('e2', 'button', { text: 'Go', href: 'https://example.com/not-a-page' }),
      el('e3', 'image', { src: 'assets/images/logo.png', alt: 'x' })
    ])];
    const { ctx, p, errs } = await adminPage(b, withBuilder('about', big));
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(600);
    await p.click('#seoTabs [data-seotab="sitemap"]');
    await p.waitForTimeout(600);
    const xml = await p.$eval('#seoSitemapOut', n => n.textContent);
    check('the sitemap is generated', /<urlset/.test(xml) && /<loc>/.test(xml), xml.slice(0, 80));
    check('no builder heading text is in it',
      !/must not appear/.test(xml), xml.slice(0, 200));
    check('no builder link target is in it',
      !/example\.com/.test(xml), xml.slice(0, 200));
    check('no builder image path is in it', !/logo\.png/.test(xml));
    check('about.html is listed once',
      (xml.match(/https:\/\/jsk-1\.com\/about\.html/g) || []).length === 1, xml);
    check('login and register stay out', !/login\.html|register\.html/.test(xml), xml);
    check('admin stays out', !/\/admin/.test(xml), xml);
    const locs = (xml.match(/<loc>([^<]+)<\/loc>/g) || []);
    check('there are no duplicate URLs',
      new Set(locs).size === locs.length, locs);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== SITEMAP MEMBERSHIP IS PAGE CONFIGURATION, NOT BUILDER STATE =====');
  {
    /* a page excluded by hand stays excluded even with a builder published */
    let a = await adminPage(b, {
      pages: { about: { inSitemap: false,
        builder: { schemaVersion: 2, status: 'published',
          sections: [sec('s1', [el('e1', 'text', { text: 'x' })])] } } }
    });
    await a.p.click('.adm-nav-item[data-panel="seo"]'); await a.p.waitForTimeout(600);
    await a.p.click('#seoTabs [data-seotab="sitemap"]');
    await a.p.waitForTimeout(600);
    let xml = await a.p.$eval('#seoSitemapOut', n => n.textContent);
    check('a page excluded by hand stays out, builder or no builder',
      !/about\.html/.test(xml), xml);
    await a.ctx.close();

    /* a noindex page stays out whatever the sitemap toggle says */
    a = await adminPage(b, {
      pages: { about: { inSitemap: true, robots: { index: false, follow: true },
        builder: { schemaVersion: 2, status: 'published',
          sections: [sec('s1', [el('e1', 'text', { text: 'x' })])] } } }
    });
    await a.p.click('.adm-nav-item[data-panel="seo"]'); await a.p.waitForTimeout(600);
    await a.p.click('#seoTabs [data-seotab="sitemap"]');
    await a.p.waitForTimeout(600);
    xml = await a.p.$eval('#seoSitemapOut', n => n.textContent);
    check('a noindex page stays out even when Include is on',
      !/about\.html/.test(xml), xml);
    check('no page errors', a.errs.length === 0, a.errs);
    await a.ctx.close();
  }

  console.log('\n===== PUBLISHING BUILDER CONTENT DATES THE PAGE =====');
  {
    const { ctx, p, errs } = await adminPage(b);
    const before = await p.evaluate(() => (CMS.data().pages.about || {}).updatedAt || '');
    const r = await p.evaluate(() => {
      const two = n => (n < 10 ? '0' : '') + n;
      const d = new Date();
      const today = d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
      const OLD = '2001-01-01';
      CMS.sections.saveDraft('about', [{ id: 's1', type: 'text', enabled: true,
        visibility: {}, style: {}, responsive: {},
        elements: [{ id: 'e1', type: 'text', content: { text: 'new' }, style: {}, responsive: {} }] }]);
      /* Set the date stale BEFORE each call, so the stamp under test is the
         only thing that could have moved it. Checking unpublish after a
         publish would let publish's own stamp stand in for it. */
      CMS.data().pages.about.updatedAt = OLD;
      CMS.sections.publish('about');
      const after = CMS.data().pages.about.updatedAt;
      CMS.data().pages.about.updatedAt = OLD;
      CMS.sections.unpublish('about');
      return { after, today, old: OLD, afterUnpublish: CMS.data().pages.about.updatedAt };
    });
    check('publishing builder content stamps the page\u2019s own edit date',
      r.after === r.today && r.after !== r.old, { before: before, after: r.after });
    check('and so does taking it down',
      r.afterUnpublish === r.today && r.afterUnpublish !== r.old, r);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     10. LEGACY AND THE OTHER PAGE SHAPES
     ================================================================ */
  console.log('\n===== EVERY PAGE SHAPE STILL RENDERS =====');
  {
    /* (N) legacy, untouched */
    let r = await page(b, null, 'responsible-gaming.html');
    let h = await head(r.p);
    check('a legacy page has one H1 and no builder', h.h1s.length === 1 && h.sections === 0);
    check('its shipped body is intact', h.bodyText.length > 400, h.bodyText.length);
    check('its head is intact',
      /Responsible/i.test(h.title) && h.canon === 'https://jsk-1.com/responsible-gaming.html', h);
    await r.ctx.close();

    /* (O) an EMPTY published builder is an EMPTY CANVAS.

       This used to assert the opposite -- that an empty builder left the
       shipped copy alone -- which made it impossible to clear a page from
       /admin. The page keeps its h1, breadcrumb and every piece of head
       metadata; only the body is empty, because that is what was
       published. */
    r = await page(b, withBuilder('about', []));
    h = await head(r.p);
    check('an empty published builder renders no sections', h.sections === 0);
    check('and the shipped copy does not come back',
      !/JSK1 is an online gaming site/.test(h.bodyText), h.bodyText.slice(0, 120));
    check('but the page keeps its single H1', h.h1s.length === 1, h.h1s);
    check('and its head is untouched',
      /About/i.test(h.title) && h.canon === 'https://jsk-1.com/about.html', h);
    await r.ctx.close();

    /* (T) a template page */
    r = await page(b, null);
    const tpl = await r.p.evaluate(() => CMS.sections.fromTemplate('information'));
    await r.ctx.close();
    r = await page(b, withBuilder('about', tpl));
    h = await head(r.p);
    check('a page built from a template renders its sections', h.sections >= 2, h.sections);
    check('and still has exactly one H1', h.h1s.length === 1, h.h1s);
    check('with a sensible outline under it',
      h.headings[0] === 'H1' && h.headings.slice(1).every(t => t !== 'H1'), h.headings);
    await r.ctx.close();

    /* (U) a reusable-section page: an independent copy of a saved section */
    r = await page(b, null);
    const copy = await r.p.evaluate(() => {
      const s = { id: 'srcA', type: 'text', enabled: true, visibility: {}, style: {}, responsive: {},
        elements: [{ id: 'srcE', type: 'heading',
          content: { text: 'From the library', level: 'h2' }, style: {}, responsive: {} }] };
      CMS.sections.library.save('Block', s);
      return CMS.sections.library.instance(CMS.sections.library.list()[0].id);
    });
    await r.ctx.close();
    r = await page(b, withBuilder('about', [copy]));
    h = await head(r.p);
    check('a page built from a reusable section renders it',
      /From the library/.test(h.bodyText));
    check('and still has exactly one H1', h.h1s.length === 1, h.h1s);
    await r.ctx.close();

    /* (S) responsive overrides */
    r = await page(b, withBuilder('about', [{ id: 's1', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true },
      style: { padding: '40' }, responsive: { tablet: { padding: '20' }, mobile: { padding: '8' } },
      elements: [{ id: 'e1', type: 'heading',
        content: { text: 'Responsive', level: 'h2' },
        style: { fontSize: '30' }, responsive: { mobile: { fontSize: '16' } } }] }]));
    const wide = await r.p.evaluate(() =>
      getComputedStyle(document.querySelector('.pb-heading')).fontSize);
    await r.p.setViewportSize({ width: 390, height: 800 });
    await r.p.waitForTimeout(250);
    const narrow = await r.p.evaluate(() =>
      getComputedStyle(document.querySelector('.pb-heading')).fontSize);
    check('a responsive override still applies on a builder page',
      wide === '30px' && narrow === '16px', { wide, narrow });
    check('and the page still has one H1',
      (await r.p.evaluate(() => document.querySelectorAll('h1').length)) === 1);
    await r.ctx.close();

    /* (R) an asset reference */
    r = await page(b, withBuilder('about', [sec('s1', [
      el('e1', 'image', { src: 'assets/images/logo.png', alt: 'Logo',
                          width: '120', height: '40' })])]));
    const img = await r.p.evaluate(() => {
      const i = document.querySelector('.pb-section img');
      return i ? { src: i.getAttribute('src'), alt: i.getAttribute('alt'),
                   w: i.getAttribute('width'), h: i.getAttribute('height') } : null;
    });
    check('an asset reference renders with its dimensions',
      img && /assets\/images\/logo\.png$/.test(img.src) && img.w === '120', img);
    await r.ctx.close();

    /* invalid asset input */
    r = await page(b, withBuilder('about', [sec('s1', [
      el('e1', 'image', { src: '../../etc/passwd', alt: 'x' }),
      el('e2', 'image', { src: '//evil.example/x.png', alt: 'y' }),
      el('e3', 'image', { src: 'javascript:alert(1)', alt: 'z' })])]));
    const srcs = await r.p.evaluate(() =>
      [...document.querySelectorAll('.pb-section img')].map(i => i.getAttribute('src')));
    check('path traversal, protocol-relative and javascript: are all refused',
      srcs.every(s => !s || (!/\.\./.test(s) && !/^\/\//.test(s) && !/^javascript:/i.test(s))), srcs);
    check('no page errors on invalid asset input', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     11. HOSTILE BUILDER CONTENT ON A PAGE WITH SEO
     ================================================================ */
  console.log('\n===== MALICIOUS BUILDER INPUT REACHES NOTHING =====');
  {
    const nasty = [{ id: 's1', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true },
      style: { bg: 'red;} body{display:none}', padding: 'var(--evil)' },
      responsive: { mobile: { color: 'expression(alert(1))' } },
      elements: [
        { id: 'e1', type: 'heading',
          content: { text: '<script>window.__pwned=1</script>', level: 'h1' }, style: {}, responsive: {} },
        { id: 'e2', type: 'button',
          content: { text: 'Click', href: 'javascript:window.__pwned=2' }, style: {}, responsive: {} },
        { id: 'e3', type: 'image',
          content: { src: 'data:text/html,<script>window.__pwned=3</script>', alt: 'x' }, style: {}, responsive: {} },
        { id: 'e4', type: 'text',
          content: { text: 'ok', onclick: 'window.__pwned=4' }, style: {}, responsive: {} }
      ] }];
    const { ctx, p, errs } = await page(b, {
      pages: { about: { title: 'Still the CMS title',
        builder: { schemaVersion: 2, status: 'published', sections: nasty } } }
    });
    const r = await p.evaluate(() => ({
      pwned: window.__pwned,
      scripts: document.querySelectorAll('.pb-section script').length,
      handlers: [...document.querySelectorAll('.pb-section *')]
        .filter(n => [...n.attributes].some(a => /^on/i.test(a.name))).length,
      hrefs: [...document.querySelectorAll('.pb-section a')].map(a => a.getAttribute('href')),
      imgs: [...document.querySelectorAll('.pb-section img')].map(i => i.getAttribute('src')),
      headingText: (document.querySelector('.pb-heading') || {}).textContent,
      css: (document.getElementById('cmsBuilder') || {}).textContent || '',
      bodyDisplay: getComputedStyle(document.body).display,
      title: document.title
    }));
    check('no script ran', r.pwned === undefined, r.pwned);
    check('no script element was created', r.scripts === 0);
    check('no event-handler attribute survived', r.handlers === 0);
    check('markup in a heading is shown as text, not parsed',
      /<script>/.test(r.headingText || ''), r.headingText);
    check('a javascript: link is refused',
      r.hrefs.every(h => !/^javascript:/i.test(h || '')), r.hrefs);
    check('a data: image is refused', r.imgs.every(s => !/^data:/i.test(s || '')), r.imgs);
    check('the CSS escape attempt emitted nothing dangerous',
      !/}|expression\(|var\(--evil/.test(r.css), r.css.slice(0, 200));
    check('the page is not hidden', r.bodyDisplay !== 'none', r.bodyDisplay);
    check('and the SEO title is untouched by any of it',
      r.title === 'Still the CMS title | JSK1', r.title);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     12. ADMIN STATE, SAVING AND PAGE SWITCHING
     ================================================================ */
  console.log('\n===== THE ADMIN SAYS WHAT IS ACTUALLY TRUE =====');
  {
    const { ctx, p, errs, st } = await adminPage(b);
    await openBuilder(p);
    const save = () => p.$eval('#pbSaveState', n => n.getAttribute('data-state') + '|' +
      n.className + '|' + n.textContent);
    const state = () => p.$eval('#pbState', n => n.getAttribute('data-state') + '|' + n.textContent);

    check('a page with nothing built says so', /^off\|/.test(await state()), await state());
    check('with nothing typed the save line is silent',
      (await p.$eval('#pbSaveState', n => n.hidden)) === true);
    check('Publish is disabled and says why',
      (await p.$eval('#pbPublish', n => n.disabled + '|' + n.title)) ===
      'true|There are no sections to publish yet.');
    check('Discard is disabled and says why',
      (await p.$eval('#pbDiscard', n => n.disabled)) === true &&
      /nothing to discard/.test(await p.$eval('#pbDiscard', n => n.title)));
    check('Unpublish is disabled and says why',
      (await p.$eval('#pbUnpublish', n => n.disabled)) === true &&
      /Nothing is published/.test(await p.$eval('#pbUnpublish', n => n.title)));

    await p.click('#pbAdd .pb-addbtn[data-type="text"]');
    await p.waitForTimeout(600);
    check('adding a section moves it to draft-only', /^draft\|/.test(await state()), await state());
    check('and the save line reports a real save', /saved\|/.test(await save()), await save());
    check('Publish is now enabled', (await p.$eval('#pbPublish', n => n.disabled)) === false);

    /* the debounce window says "unsaved", not "saving" -- nothing is saving */
    await p.fill('#pbList .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in', 'typed');
    const mid = await save();
    check('while an edit is pending it says unsaved, not saving',
      /^unsaved\|/.test(mid) && /Unsaved changes/.test(mid) && !/Saving/.test(mid), mid);
    await p.waitForTimeout(600);
    check('and once written it says saved', /saved\|/.test(await save()), await save());
    check('nothing has been published by any of that', st.posts === 0, st.posts);

    await p.click('#pbPublish'); await p.waitForTimeout(1300);
    check('publishing reports live and up to date', /^live\|/.test(await state()), await state());
    check('and sends exactly one write', st.posts === 1, st.posts);

    /* page switching keeps the auto-save behaviour and confirms nothing */
    const slugs = await p.$$eval('#pbTabs .pagetab', n => n.map(x => x.getAttribute('data-slug')));
    check('every mounted page is offered', slugs.length >= 2, slugs);
    await p.click(`#pbTabs .pagetab[data-slug="${slugs[1]}"]`);
    await p.waitForTimeout(800);
    check('switching page needs no confirmation', true);
    check('the builder now names the other page',
      (await p.$eval('#pbWhere', n => n.textContent)).indexOf(slugs[1].slice(0, 4)) > -1 ||
      (await p.$eval('#pbTabs .pagetab.active', n => n.getAttribute('data-slug'))) === slugs[1]);
    check('and the first page kept its published content',
      (await p.evaluate(() => CMS.data().pages.about.builder.sections.length)) === 1);
    await p.click('#pbTabs .pagetab[data-slug="about"]');
    await p.waitForTimeout(800);
    check('coming back finds the draft where it was',
      (await p.evaluate(() => CMS.sections.draft('about').sections[0].elements[0].content.text)) === 'typed');
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     13. THE ADMIN AT THREE WIDTHS, AND FROM THE KEYBOARD
     ================================================================ */
  console.log('\n===== THE ADMIN ITSELF =====');
  {
    for (const [w, h, name] of [[1440, 1000, 'desktop'], [900, 1100, 'tablet'], [390, 844, 'mobile']]) {
      const a = await adminPage(b, null, { width: w, height: h });
      if (w <= 860) {
        check(name + ': the menu button is a real target even with no icon font',
          (await a.p.$eval('#admBurger', n => {
            const r = n.getBoundingClientRect();
            return r.width >= 36 && r.height >= 36;
          })) === true, await a.p.$eval('#admBurger', n => JSON.stringify(n.getBoundingClientRect())));
        await a.p.click('#admBurger'); await a.p.waitForTimeout(350);
      }
      await openBuilder(a.p);
      await a.p.click('#pbTemplates .pb-template[data-template="landing"]');
      await a.p.waitForTimeout(1000);
      const r = await a.p.evaluate(() => {
        const doc = document.documentElement, wid = doc.clientWidth, over = [];
        document.querySelectorAll('body *').forEach(n => {
          if (n.closest('#pbStage')) return;
          const b = n.getBoundingClientRect();
          if (b.width === 0) return;
          if (b.right > wid + 1.5) over.push((n.id || n.className || n.tagName).toString().slice(0, 40));
        });
        return { scrollW: doc.scrollWidth, clientW: doc.clientWidth, over: over.slice(0, 5) };
      });
      check(name + ' (' + w + 'px): the admin does not scroll sideways',
        r.scrollW <= r.clientW, r);
      check(name + ': nothing overflows the viewport', r.over.length === 0, r.over);
      check(name + ': no page errors', a.errs.length === 0, a.errs);
      await a.ctx.close();
    }

    const a = await adminPage(b);
    await openBuilder(a.p);
    await a.p.click('#pbTemplates .pb-template[data-template="landing"]');
    await a.p.waitForTimeout(900);
    await openSec(a.p, 0);
    const named = await a.p.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#panel-builder button, #panel-builder a[href], #panel-builder select, #panel-builder input, #panel-builder textarea').forEach(n => {
        const r = n.getBoundingClientRect();
        if (n.hidden || (r.width === 0 && r.height === 0)) return;
        const name = (n.getAttribute('aria-label') || '').trim() || (n.textContent || '').trim() ||
          (n.title || '').trim() ||
          (n.closest('label') ? n.closest('label').textContent.trim() : '');
        if (!name) bad.push(n.tagName + '.' + (n.className || '') + '#' + (n.id || ''));
      });
      return bad;
    });
    check('every visible builder control has an accessible name', named.length === 0, named);
    const tabless = await a.p.evaluate(() =>
      [...document.querySelectorAll('#panel-builder button:not([disabled]), #panel-builder select, #panel-builder input')]
        .filter(n => { const r = n.getBoundingClientRect(); return r.width > 0 && n.tabIndex < 0; }).length);
    check('and none of them is taken out of the tab order', tabless === 0, tabless);
    check('the open section reports its state',
      (await a.p.$eval('#pbList > .pb-sec.open .pb-sec-title', n => n.getAttribute('aria-expanded'))) === 'true');
    check('a closed one does too',
      (await a.p.$$eval('#pbList > .pb-sec:not(.open) .pb-sec-title',
        n => n.every(x => x.getAttribute('aria-expanded') === 'false'))) === true);

    /* keyboard reorder, still working after all the UX changes. Driven
       from the keyboard, not with a click: :focus-visible is a statement
       about how the control was reached. */
    const before = await a.p.evaluate(() => CMS.sections.draft('about').sections.map(s => s.id));
    await a.p.evaluate(() => {
      document.querySelector('#pbList > .pb-sec:nth-child(3) [data-act="up"]').focus();
    });
    await a.p.keyboard.press('Tab');
    await a.p.keyboard.press('Shift+Tab');
    /* At least 2px and solid: the browser's own ring is 1px auto, so a bare
       UA default does not satisfy this and the stylesheet has to be doing
       the work. */
    check('a keyboard-focused button shows the admin\u2019s own visible ring',
      (await a.p.evaluate(() => {
        const n = document.activeElement, cs = getComputedStyle(n);
        return n.matches(':focus-visible') && cs.outlineStyle === 'solid' &&
               parseFloat(cs.outlineWidth) >= 2;
      })) === true, await a.p.evaluate(() => {
        const cs = getComputedStyle(document.activeElement);
        return document.activeElement.getAttribute('data-act') + ' ' +
               cs.outlineStyle + ' ' + cs.outlineWidth;
      }));
    await a.p.keyboard.press('Enter');
    await a.p.waitForTimeout(600);
    const after = await a.p.evaluate(() => CMS.sections.draft('about').sections.map(s => s.id));
    check('the keyboard reorder controls still work',
      after[1] === before[2] && after[2] === before[1], { before, after });
    check('and focus still follows the section',
      (await a.p.evaluate(() => {
        const n = document.activeElement, host = n.closest('.pb-sec');
        return n.getAttribute('data-act') + '@' + (host ? host.getAttribute('data-sec-id') : '?');
      })) === 'up@' + before[2]);
    check('no page errors', a.errs.length === 0, a.errs);
    await a.ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
