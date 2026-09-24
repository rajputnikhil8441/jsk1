/* BUILDER-MANAGED INFORMATIONAL PAGES.

   THE CLAIM. about, contact, responsible-gaming and privacy-policy have
   their body owned by the Page Builder: publishing sections replaces the
   copy that shipped in the HTML, publishing NOTHING leaves an empty
   canvas, and unpublishing brings the shipped copy back.

   WHAT IS DELIBERATELY NOT MIGRATED. index.html is hand-designed and
   carries no mount. login.html and register.html are functional pages.
   404.html has no mount either. Several tests here exist only to fail if
   someone later changes that.

   WHAT STAYS STATIC ON A MIGRATED PAGE. The global header and footer,
   the breadcrumb, the page's single <h1>, the lead, and every piece of
   head metadata. The builder owns the body, not the page. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const MIGRATED = [
  ['about.html', 'about'],
  ['contact.html', 'contact'],
  ['responsible-gaming.html', 'responsible-gaming'],
  ['privacy-policy.html', 'privacy-policy']
];
const NOT_MIGRATED = ['index.html', 'login.html', 'register.html', '404.html'];

/* A section carrying one heading and one paragraph. */
const secOf = (head, body) => ({
  id: 's-' + head.replace(/\W+/g, ''), type: 'text', enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true },
  style: {}, responsive: {},
  elements: [
    { id: 'h-' + head.replace(/\W+/g, ''), type: 'heading',
      content: { text: head, level: 'h2' }, style: {}, responsive: {} },
    { id: 't-' + head.replace(/\W+/g, ''), type: 'text',
      content: { text: body }, style: {}, responsive: {} }
  ]
});

async function open(b, file, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: opts.w || 1280, height: opts.h || 900 } });
  await ctx.route('**supabase.co/**', r => {
    if (r.request().url().includes('/auth/v1/token')) {
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ access_token: 'stub' }) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 180)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    errs.push(m.text().slice(0, 180)); });
  if (opts.builder) {
    await p.addInitScript(json => {
      const spec = JSON.parse(json);
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.pages = raw.pages || {};
      raw.pages[spec.slug] = Object.assign(raw.pages[spec.slug] || {}, {
        builder: { schemaVersion: 2, status: spec.status,
                   sections: spec.sections, updatedAt: '2026-09-24' } });
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, JSON.stringify(opts.builder));
  }
  await p.goto(`${BASE}/${file}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(240);
  return { ctx, p, errs };
}

const look = p => p.evaluate(() => {
  const host = document.querySelector('[data-cms-sections]');
  const slug = host ? host.getAttribute('data-cms-sections') : null;
  const legacy = slug ? document.querySelector('[data-cms-html="pages.' + slug + '.body"]') : null;
  const hd = document.querySelector('header.site-header');
  const ft = document.querySelector('footer.site-footer');
  return {
    slug,
    mounts: document.querySelectorAll('[data-cms-sections]').length,
    sections: document.querySelectorAll('.pb-section').length,
    legacyPresent: !!legacy,
    legacyHidden: legacy ? legacy.hidden === true : null,
    legacyH2s: legacy ? legacy.querySelectorAll('h2').length : 0,
    legacyText: legacy ? legacy.textContent.trim().slice(0, 80) : '',
    bodyText: document.body.innerText,
    h1s: document.querySelectorAll('h1').length,
    h1Text: (document.querySelector('h1') || {}).textContent,
    breadcrumbs: document.querySelectorAll('.breadcrumb').length,
    headers: document.querySelectorAll('header.site-header').length,
    footers: document.querySelectorAll('footer.site-footer').length,
    headerPos: hd ? getComputedStyle(hd).position : null,
    footerPos: ft ? getComputedStyle(ft).position : null,
    title: document.title,
    canon: (document.querySelector('link[rel=canonical]') || {}).href,
    desc: (document.querySelector('meta[name=description]') || {}).content,
    robots: (document.querySelector('meta[name=robots]') || {}).content,
    og: (document.querySelector('meta[property="og:title"]') || {}).content,
    tw: (document.querySelector('meta[name="twitter:card"]') || {}).content,
    jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
    mains: document.querySelectorAll('main').length,
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth
  };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. THE FOUR PAGES ARE BUILDER-MANAGED
     ================================================================ */
  console.log('\n===== THE FOUR INFORMATIONAL PAGES ARE BUILDER-MANAGED =====');
  {
    const r = await open(b, 'about.html');
    const reg = await r.p.evaluate(() => ({
      pages: CMS.sections.pages(),
      mounted: Object.keys(CMS.sections.mounted)
    }));
    check('the builder offers exactly the four informational pages',
      reg.pages.join(',') === 'about,contact,privacy-policy,responsible-gaming', reg.pages);
    check('and all four are registered as mounted',
      ['about', 'contact', 'responsible-gaming', 'privacy-policy']
        .every(k => reg.mounted.indexOf(k) > -1), reg.mounted);
    check('the homepage is NOT offered to the builder',
      reg.pages.indexOf('home') === -1 && reg.pages.indexOf('index') === -1 &&
      reg.mounted.indexOf('home') === -1, reg);
    check('login is NOT offered to the builder', reg.pages.indexOf('login') === -1, reg.pages);
    check('register is NOT offered to the builder', reg.pages.indexOf('register') === -1, reg.pages);
    await r.ctx.close();

    for (const [file, slug] of MIGRATED) {
      const rr = await open(b, file);
      const s = await look(rr.p);
      check(file + ': carries exactly one builder mount', s.mounts === 1, s.mounts);
      check(file + ': the mount is keyed to its CMS page record',
        s.slug === slug, { got: s.slug, want: slug });
      check(file + ': and the CMS knows that page', await rr.p.evaluate(k =>
        !!CMS.data().pages[k], slug) === true);
      check(file + ': no page errors', rr.errs.length === 0, rr.errs);
      await rr.ctx.close();
    }
  }

  /* ================================================================
     2. THE PAGES THAT MUST NOT BE MIGRATED
     These exist to fail if someone converts the homepage later.
     ================================================================ */
  console.log('\n===== THE HOMEPAGE AND THE ACCOUNT PAGES ARE UNTOUCHED =====');
  {
    for (const f of NOT_MIGRATED) {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      check(f + ': ships NO builder mount', raw.indexOf('data-cms-sections') === -1, f);
      check(f + ': ships no builder body binding',
        !/data-cms-html="pages\.[a-z-]+\.body"/.test(raw), f);
    }

    /* The homepage keeps its hand-built design. */
    const r = await open(b, 'index.html');
    const home = await r.p.evaluate(() => ({
      mounts: document.querySelectorAll('[data-cms-sections]').length,
      pbSections: document.querySelectorAll('.pb-section').length,
      h1s: document.querySelectorAll('h1').length,
      sportsTable: document.querySelectorAll('.matches-table, .sport-tab').length,
      casino: document.querySelectorAll('.casino-card').length,
      sidebar: document.querySelectorAll('.left-sidebar').length,
      header: document.querySelectorAll('header.site-header').length,
      footer: document.querySelectorAll('footer.site-footer').length,
      infoMain: document.querySelectorAll('.info-main').length
    }));
    check('the homepage has no builder mount', home.mounts === 0, home);
    check('the homepage renders no builder sections', home.pbSections === 0, home);
    check('the homepage is not an info page', home.infoMain === 0, home);
    check('the homepage still has its sports content', home.sportsTable > 0, home);
    check('the homepage still has its casino cards', home.casino > 0, home);
    check('the homepage still has its sidebar', home.sidebar > 0, home);
    check('the homepage keeps its single h1', home.h1s === 1, home);
    check('the homepage keeps the global shell',
      home.header === 1 && home.footer === 1, home);
    check('no homepage errors', r.errs.length === 0, r.errs);
    await r.ctx.close();

    /* Seeding a builder for a homepage slug must still render nothing:
       there is no mount for it to paint into. */
    for (const slug of ['home', 'index', 'login', 'register']) {
      const rr = await open(b, 'index.html',
        { builder: { slug, status: 'published', sections: [secOf('Injected', 'Should never show')] } });
      const painted = await rr.p.evaluate(() => ({
        pb: document.querySelectorAll('.pb-section').length,
        hasText: /Injected/.test(document.body.innerText)
      }));
      check('a builder published for "' + slug + '" cannot reach the homepage',
        painted.pb === 0 && painted.hasText === false, painted);
      await rr.ctx.close();
    }

    /* login and register keep their forms and their noindex. */
    for (const f of ['login.html', 'register.html']) {
      const rr = await open(b, f);
      const s = await rr.p.evaluate(() => ({
        mounts: document.querySelectorAll('[data-cms-sections]').length,
        pb: document.querySelectorAll('.pb-section').length,
        pass: document.querySelectorAll('input[type=password]').length,
        form: document.querySelectorAll('form, .auth-card, .login-box').length,
        robots: (document.querySelector('meta[name=robots]') || {}).content,
        header: document.querySelectorAll('header.site-header').length,
        footer: document.querySelectorAll('footer.site-footer').length
      }));
      check(f + ': has no builder mount', s.mounts === 0, s);
      check(f + ': renders no builder sections', s.pb === 0, s);
      check(f + ': keeps a password field', s.pass >= 1, s);
      check(f + ': keeps its own form UI', s.form >= 1, s);
      check(f + ': is still noindex', /noindex/.test(s.robots || ''), s.robots);
      check(f + ': still has no public shell',
        s.header === 0 && s.footer === 0, s);
      check(f + ': no page errors', rr.errs.length === 0, rr.errs);
      await rr.ctx.close();
    }
  }

  /* ================================================================
     3. PUBLISHED BUILDER CONTENT REPLACES THE SHIPPED COPY
     ================================================================ */
  console.log('\n===== PUBLISHED CONTENT OWNS THE BODY =====');
  {
    for (const [file, slug] of MIGRATED) {
      const r = await open(b, file, { builder: { slug, status: 'published',
        sections: [secOf('Built heading', 'Built paragraph for ' + slug + '.')] } });
      const s = await look(r.p);
      check(file + ': renders its builder section', s.sections === 1, s.sections);
      check(file + ': the built text is on the page',
        /Built paragraph for/.test(s.bodyText), s.bodyText.slice(0, 100));
      check(file + ': the shipped copy is hidden', s.legacyHidden === true, s);
      check(file + ': the shipped copy is kept in the document, not deleted',
        s.legacyPresent === true, s);
      check(file + ': so there is no duplicate page content',
        s.sections === 1 && s.legacyHidden === true, s);
      check(file + ': the page keeps its single h1', s.h1s === 1, s);
      check(file + ': the h1 is the page title, not a builder heading',
        s.h1Text !== 'Built heading', s.h1Text);
      /* Read from the file rather than assumed: privacy-policy.html ships
         no breadcrumb, the other three do. Whatever a page ships has to
         survive the builder taking over its body. */
      const shipsCrumb = fs.readFileSync(path.join(ROOT, file), 'utf8')
        .indexOf('class="breadcrumb"') > -1;
      check(file + ': its breadcrumb is unchanged by the builder',
        s.breadcrumbs === (shipsCrumb ? 1 : 0), { got: s.breadcrumbs, ships: shipsCrumb });
      check(file + ': one main element', s.mains === 1, s.mains);
      check(file + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  /* ================================================================
     4. THE GLOBAL SHELL IS UNTOUCHED BY BUILDER CONTENT
     ================================================================ */
  console.log('\n===== HEADER AND FOOTER STAY OUTSIDE THE BUILDER =====');
  {
    for (const [file, slug] of MIGRATED) {
      const r = await open(b, file, { builder: { slug, status: 'published',
        sections: [secOf('A', 'a'), secOf('B', 'b'), secOf('C', 'c')] } });
      const s = await look(r.p);
      check(file + ': exactly one header', s.headers === 1, s.headers);
      check(file + ': exactly one footer', s.footers === 1, s.footers);
      check(file + ': the header is NOT sticky', s.headerPos !== 'sticky', s.headerPos);
      check(file + ': the header is NOT fixed', s.headerPos !== 'fixed', s.headerPos);
      check(file + ': the header is in normal document flow',
        s.headerPos === 'static' || s.headerPos === 'relative', s.headerPos);
      check(file + ': the footer is in normal document flow',
        s.footerPos === 'static' || s.footerPos === 'relative', s.footerPos);
      check(file + ': builder sections sit between header and footer',
        await r.p.evaluate(() => {
          const hd = document.querySelector('header.site-header');
          const ft = document.querySelector('footer.site-footer');
          const secs = [...document.querySelectorAll('.pb-section')];
          const after = n => !!(hd.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING);
          const before = n => !!(ft.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_PRECEDING);
          return secs.length === 3 && secs.every(n => after(n) && before(n));
        }));
      check(file + ': no builder section escaped into the shell',
        await r.p.evaluate(() =>
          document.querySelectorAll('header.site-header .pb-section, footer.site-footer .pb-section').length) === 0);
      check(file + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  /* ================================================================
     5. DRAFT / PUBLISH / EMPTY CANVAS / UNPUBLISH
     ================================================================ */
  console.log('\n===== THE DRAFT, PUBLISH AND EMPTY-CANVAS LIFECYCLE =====');
  {
    /* A draft must never reach the public page. */
    for (const [file, slug] of MIGRATED) {
      const r = await open(b, file, { builder: { slug, status: 'draft',
        sections: [secOf('Secret draft', 'This must not be public.')] } });
      const s = await look(r.p);
      check(file + ': a draft renders nothing publicly', s.sections === 0, s.sections);
      check(file + ': and its text is nowhere on the page',
        !/This must not be public/.test(s.bodyText), s.bodyText.slice(0, 80));
      check(file + ': the shipped copy still shows while only a draft exists',
        s.legacyHidden === false, s);
      await r.ctx.close();
    }

    /* The whole lifecycle, driven through the public API. */
    const r = await open(b, 'about.html');
    const life = await r.p.evaluate(async () => {
      const body = () => document.querySelector('[data-cms-html="pages.about.body"]');
      const snap = () => ({ hidden: body().hidden,
                            pb: document.querySelectorAll('.pb-section').length,
                            h1: document.querySelectorAll('h1').length,
                            managed: CMS.sections.bodyManaged('about') });
      const S = [{ id: 's1', type: 'text', enabled: true,
                   visibility: { desktop: true, tablet: true, mobile: true },
                   style: {}, responsive: {},
                   elements: [{ id: 'e1', type: 'text',
                                content: { text: 'Lifecycle copy' }, style: {}, responsive: {} }] }];
      const out = { start: snap() };
      CMS.sections.saveDraft('about', S); CMS.apply();  out.draft = snap();
      CMS.sections.publish('about');      CMS.apply();  out.published = snap();
      CMS.sections.saveDraft('about', []); CMS.sections.publish('about'); CMS.apply();
      out.empty = snap();
      CMS.sections.unpublish('about');    CMS.apply();  out.unpublished = snap();
      out.copyBack = body().querySelectorAll('h2').length;
      return out;
    });
    check('start: the shipped copy shows and the body is not managed',
      life.start.hidden === false && life.start.pb === 0 && life.start.managed === false, life.start);
    check('a saved draft changes nothing on the page',
      life.draft.hidden === false && life.draft.pb === 0 && life.draft.managed === false, life.draft);
    check('publishing renders the sections and hides the shipped copy',
      life.published.hidden === true && life.published.pb === 1 &&
      life.published.managed === true, life.published);
    check('publishing an EMPTY list leaves an empty canvas, not the old copy',
      life.empty.hidden === true && life.empty.pb === 0 &&
      life.empty.managed === true, life.empty);
    check('the h1 survives every step',
      [life.start, life.draft, life.published, life.empty, life.unpublished]
        .every(x => x.h1 === 1), life);
    check('unpublishing gives the shipped copy back',
      life.unpublished.hidden === false && life.unpublished.pb === 0 &&
      life.unpublished.managed === false, life.unpublished);
    check('and that copy is intact, not a stub', life.copyBack >= 3, life.copyBack);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     6. THE ONE-TIME BODY MIGRATION
     ================================================================ */
  console.log('\n===== MOVING THE SHIPPED COPY INTO THE BUILDER =====');
  {
    const r = await open(b, 'about.html');
    const conv = await r.p.evaluate(() => {
      const out = CMS.sections.fromPageBody('about');
      return { n: out.length,
               els: out[0] ? out[0].elements.map(e => e.type) : [],
               levels: out[0] ? out[0].elements.filter(e => e.type === 'heading')
                 .map(e => e.content.level) : [],
               text: out[0] ? out[0].elements.map(e => e.content.text).join(' | ') : '',
               ids: out[0] ? out[0].elements.map(e => e.id) : [] };
    });
    check('the shipped copy converts to one section', conv.n === 1, conv.n);
    check('with the headings and paragraphs it contained',
      conv.els.filter(t => t === 'heading').length === 3 &&
      conv.els.filter(t => t === 'text').length >= 4, conv.els);
    check('no converted heading is an h1',
      conv.levels.every(l => l !== 'h1'), conv.levels);
    check('the copy survives the conversion',
      /JSK1 is an online gaming site/.test(conv.text), conv.text.slice(0, 80));
    check('every element gets its own id',
      conv.ids.length === new Set(conv.ids).size && conv.ids.every(i => !!i), conv.ids);
    check('converting does not write anything',
      await r.p.evaluate(() => !CMS.data().pages.about.builder) === true);
    check('and does not touch the page body value',
      await r.p.evaluate(() => /JSK1 is an online gaming site/.test(CMS.data().pages.about.body)));

    /* An h1 in the copy would be the page's second, so it comes down. */
    const demoted = await r.p.evaluate(() => {
      CMS.data().pages.about.body = '<h1>Top</h1><p>Body</p>';
      const out = CMS.sections.fromPageBody('about');
      return out[0].elements.map(e => e.type + ':' + (e.content.level || ''));
    });
    check('an h1 in the shipped copy converts to an h2',
      demoted[0] === 'heading:h2', demoted);

    const emptyBody = await r.p.evaluate(() => {
      CMS.data().pages.about.body = '   ';
      return CMS.sections.fromPageBody('about').length;
    });
    check('an empty body converts to nothing', emptyBody === 0, emptyBody);

    const noPage = await r.p.evaluate(() => CMS.sections.fromPageBody('nope').length);
    check('an unknown slug converts to nothing', noPage === 0, noPage);
    await r.ctx.close();
  }

  /* ================================================================
     7. THE MIGRATION IS SAFE AGAINST HOSTILE COPY
     ================================================================ */
  console.log('\n===== HOSTILE CONTENT CANNOT EXECUTE =====');
  {
    /* WHAT THIS SECTION IS AND IS NOT ABOUT.

       pages.<slug>.body is written to the page with innerHTML, on
       purpose: it is rich text authored by a signed-in admin, and that
       is documented behaviour this milestone does not change. Hostile
       HTML in that field therefore still runs, exactly as it did before,
       and hiding the node does not stop it -- `hidden` controls display,
       not parsing.

       What IS this milestone's to guarantee is that the MIGRATION never
       turns that HTML into unsafe BUILDER content. The builder's heading
       and text elements are textContent-only, so the conversion has to
       come out inert no matter what went in. */
    const HOSTILE = [
      ['a script tag', '<p>ok</p><script>window.__hb=1</script>'],
      ['an onerror image', '<p><img src=x onerror=window.__hb=1></p>'],
      ['an iframe', '<iframe src="javascript:window.__hb=1"></iframe><p>ok</p>'],
      ['an svg onload', '<svg onload=window.__hb=1></svg><p>ok</p>'],
      ['a javascript link', '<p><a href="javascript:window.__hb=1">x</a></p>'],
      ['a breakout attempt', '<p>a</p>"><script>window.__hb=1</script>'],
      ['nested handlers', '<div onclick=window.__hb=1><p onmouseover=window.__hb=1>t</p></div>']
    ];
    const r = await open(b, 'about.html');
    for (const [name, html] of HOSTILE) {
      const out = await r.p.evaluate((h) => {
        /* The conversion alone, with nothing painted: this is the step
           the migration button performs. */
        CMS.data().pages.about.body = h;
        const secs = CMS.sections.fromPageBody('about');
        const walk = (list, hit) => (list || []).forEach(e => {
          const c = e.content || {};
          if (typeof c.text === 'string' && /<[a-z!\/]/i.test(c.text)) hit.markup.push(c.text.slice(0, 40));
          if (e.type !== 'heading' && e.type !== 'text') hit.otherTypes.push(e.type);
          (c.columns || []).forEach(col => walk(col && col.elements, hit));
        });
        const hit = { markup: [], otherTypes: [] };
        secs.forEach(sec => walk(sec.elements, hit));
        return { types: [...new Set(secs.flatMap(x => x.elements.map(e => e.type)))],
                 otherTypes: hit.otherTypes, nSections: secs.length };
      }, html);
      check('converting ' + name + ' yields only heading and text elements',
        out.otherTypes.length === 0 &&
        out.types.every(t => t === 'heading' || t === 'text'), out);

      /* Now publish that conversion and look at the rendered result. */
      const painted = await r.p.evaluate((h) => {
        delete window.__hb;
        CMS.data().pages.about.body = h;
        CMS.sections.saveDraft('about', CMS.sections.fromPageBody('about'));
        CMS.sections.publish('about');
        /* Render ONLY the builder, so the legacy innerHTML path (which is
           raw markup by design) cannot be mistaken for the builder's. */
        CMS.sections.render ? CMS.sections.render() : CMS.apply();
        const host = document.querySelector('[data-cms-sections="about"]');
        return {
          scripts: host.querySelectorAll('script, iframe, svg, object, embed').length,
          onAttrs: [...host.querySelectorAll('*')]
            .filter(el => [...el.attributes].some(a => /^on/i.test(a.name))).length,
          badHrefs: [...host.querySelectorAll('a, img, source')]
            .filter(n => /^\s*(javascript|data|vbscript|blob):/i
              .test(n.getAttribute('href') || n.getAttribute('src') || '')).length,
          html: host.innerHTML
        };
      }, html);
      check('the builder output for ' + name + ' has no script/iframe/svg',
        painted.scripts === 0, painted.scripts);
      check('the builder output for ' + name + ' has no handler attribute',
        painted.onAttrs === 0, painted.onAttrs);
      check('the builder output for ' + name + ' has no unsafe URL',
        painted.badHrefs === 0, painted.badHrefs);
      check('the builder output for ' + name + ' contains no raw "<script"',
        painted.html.indexOf('<script') === -1, painted.html.slice(0, 60));
    }

    /* Said out loud so nobody reads the hiding as neutralising: the
       shipped-body field is still raw HTML by design, and this milestone
       did not change that. */
    const legacyStillRaw = await r.p.evaluate(() => {
      delete window.__lb;
      CMS.data().pages.about.body = '<p>plain</p>';
      CMS.apply();
      const node = document.querySelector('[data-cms-html="pages.about.body"]');
      return { rendersHtml: node.querySelectorAll('p').length === 1,
               hiddenWhileManaged: node.hidden === true };
    });
    check('the shipped-body field still renders admin HTML, unchanged by this work',
      legacyStillRaw.rendersHtml === true, legacyStillRaw);
    check('and is hidden (not removed) while the builder owns the body',
      legacyStillRaw.hiddenWhileManaged === true, legacyStillRaw);
    await r.ctx.close();

    /* And hostile content published directly as builder elements. */
    const r2 = await open(b, 'about.html', { builder: { slug: 'about', status: 'published',
      sections: [{ id: 'h1', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [
          { id: 'a', type: 'heading',
            content: { text: '<script>window.__p2=1</script>', level: 'h2' }, style: {}, responsive: {} },
          { id: 'b', type: 'text',
            content: { text: '<img src=x onerror=window.__p3=1>' }, style: {}, responsive: {} },
          { id: 'c', type: 'image',
            content: { src: 'javascript:window.__p4=1', alt: 'x' }, style: {}, responsive: {} },
          { id: 'd', type: 'button',
            content: { text: 'go', href: 'javascript:window.__p5=1' }, style: {}, responsive: {} }
        ] }] } });
    const safe = await r2.p.evaluate(() => ({
      pwned: [window.__p2, window.__p3, window.__p4, window.__p5].filter(v => v !== undefined).length,
      scripts: document.querySelectorAll('.pb-section script, .pb-section iframe').length,
      onAttrs: [...document.querySelectorAll('.pb-section *')]
        .filter(el => [...el.attributes].some(a => /^on/i.test(a.name))).length,
      imgs: [...document.querySelectorAll('.pb-section img')]
        .filter(i => /^\s*javascript:/i.test(i.getAttribute('src') || '')).length,
      hrefs: [...document.querySelectorAll('.pb-section a')]
        .filter(a => /^\s*javascript:/i.test(a.getAttribute('href') || '')).length,
      headingText: (document.querySelector('.pb-heading') || {}).textContent
    }));
    check('hostile element content runs nothing', safe.pwned === 0, safe);
    check('hostile element content creates no script or iframe', safe.scripts === 0, safe);
    check('hostile element content creates no handler attribute', safe.onAttrs === 0, safe);
    check('a javascript: image src is refused', safe.imgs === 0, safe);
    check('a javascript: button href is refused', safe.hrefs === 0, safe);
    check('markup in a heading is shown as text',
      safe.headingText === '<script>window.__p2=1</script>', safe.headingText);
    check('no page errors', r2.errs.length === 0, r2.errs);
    await r2.ctx.close();
  }

  /* ================================================================
     8. SEO IS UNCHANGED BY MIGRATION
     ================================================================ */
  console.log('\n===== SEO SURVIVES THE MIGRATION =====');
  {
    const WANT = {
      'about': 'https://jsk-1.com/about.html',
      'contact': 'https://jsk-1.com/contact.html',
      'responsible-gaming': 'https://jsk-1.com/responsible-gaming.html',
      'privacy-policy': 'https://jsk-1.com/privacy-policy.html'
    };
    for (const [file, slug] of MIGRATED) {
      /* Head read with a builder published, an empty canvas, and none. */
      for (const [label, builder] of [
        ['no builder', null],
        ['published', { slug, status: 'published', sections: [secOf('X', 'y')] }],
        ['empty canvas', { slug, status: 'published', sections: [] }]
      ]) {
        const r = await open(b, file, builder ? { builder } : {});
        const s = await look(r.p);
        const tag = file + ' (' + label + ')';
        check(tag + ': the canonical is correct', s.canon === WANT[slug], s.canon);
        check(tag + ': the title is non-empty', (s.title || '').length > 5, s.title);
        check(tag + ': the meta description is non-empty', (s.desc || '').length > 20, s.desc);
        check(tag + ': robots is indexable', /index/.test(s.robots || '') &&
          !/noindex/.test(s.robots || ''), s.robots);
        check(tag + ': Open Graph is present', (s.og || '').length > 0, s.og);
        check(tag + ': Twitter metadata is present', (s.tw || '').length > 0, s.tw);
        /* Same again: three of the four pages ship ld+json blocks. The
           builder must not add or remove any. */
        const wantLd = fs.readFileSync(path.join(ROOT, file), 'utf8')
          .split('application/ld+json').length - 1;
        check(tag + ': its structured data is unchanged by the builder',
          s.jsonLd === wantLd, { got: s.jsonLd, ships: wantLd });
        check(tag + ': exactly one h1', s.h1s === 1, s.h1s);
        check(tag + ': no page errors', r.errs.length === 0, r.errs);
        await r.ctx.close();
      }
    }

    /* The URLs and the sitemap are untouched. */
    for (const [file] of MIGRATED) {
      check(file + ': the file still exists at its URL',
        fs.existsSync(path.join(ROOT, file)), file);
    }
    const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const locs = (sm.match(/<loc>([^<]*)<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
    check('the sitemap still lists five URLs', locs.length === 5, locs);
    check('and still lists all four migrated pages',
      Object.values(WANT).every(u => locs.indexOf(u) > -1), locs);
    check('and still excludes login, register and admin',
      !locs.some(l => /login|register|admin/.test(l)), locs);
  }

  /* ================================================================
     9. RESPONSIVE AND THE EXISTING ELEMENT SET
     ================================================================ */
  console.log('\n===== THE EXISTING BUILDER FEATURES STILL WORK HERE =====');
  {
    /* Every element type the builder offers, on a migrated page. */
    const r0 = await open(b, 'about.html');
    const types = await r0.p.evaluate(() => CMS.sections.fromTemplate('landing').length);
    check('a shipped template still builds sections', types >= 3, types);
    await r0.ctx.close();

    const rich = {
      slug: 'about', status: 'published', sections: [{
        id: 'rs', type: 'hero', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true },
        style: { padding: '40' }, responsive: { mobile: { padding: '8' } },
        elements: [
          { id: 'r1', type: 'heading', content: { text: 'Rich', level: 'h2' },
            style: { fontSize: '30' }, responsive: { mobile: { fontSize: '16' } } },
          { id: 'r2', type: 'text', content: { text: 'Body' }, style: {}, responsive: {} },
          { id: 'r3', type: 'image',
            content: { src: 'assets/images/ssl.png', alt: 'Safe' }, style: {}, responsive: {} },
          { id: 'r4', type: 'button',
            content: { text: 'Go', href: 'contact.html' }, style: {}, responsive: {} }
        ] }] };

    for (const [w, h, label] of [[1280, 900, 'desktop'], [390, 844, 'mobile']]) {
      const r = await open(b, 'about.html', { builder: rich, w, h });
      const s = await look(r.p);
      const el = await r.p.evaluate(() => ({
        heading: !!document.querySelector('.pb-heading'),
        text: !!document.querySelector('.pb-textblock'),
        img: (document.querySelector('.pb-img') || {}).getAttribute
          ? document.querySelector('.pb-img').getAttribute('src') : null,
        btnHref: (document.querySelector('.pb-section a') || {}).getAttribute
          ? document.querySelector('.pb-section a').getAttribute('href') : null,
        fontSize: getComputedStyle(document.querySelector('.pb-heading')).fontSize
      }));
      check(label + ': a heading element renders', el.heading === true, el);
      check(label + ': a text element renders', el.text === true, el);
      check(label + ': an image element renders from the asset path',
        el.img === 'assets/images/ssl.png', el.img);
      check(label + ': a button element keeps its href',
        el.btnHref === 'contact.html', el.btnHref);
      check(label + ': the responsive override applies',
        el.fontSize === (w === 1280 ? '30px' : '16px'), el.fontSize);
      check(label + ': no horizontal overflow', s.scrollW <= s.clientW,
        { sw: s.scrollW, cw: s.clientW });
      check(label + ': the shell is intact',
        s.headers === 1 && s.footers === 1, s);
      check(label + ': the header is still not sticky or fixed',
        s.headerPos !== 'sticky' && s.headerPos !== 'fixed', s.headerPos);
      check(label + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  /* ================================================================
     10. THE GENERATED-PAGE TEMPLATE
     ================================================================ */
  console.log('\n===== A NEW PAGE GETS THE SAME ARCHITECTURE =====');
  {
    const admin = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');
    check('the generated page carries a builder mount',
      /data-cms-sections="' \+ e\(key\)/.test(admin));
    check('the generated page carries its own h1 above the mount',
      /<h1 data-cms-text="pages\.' \+ e\(key\)/.test(admin));
    check('the generated page keeps the body binding for migration',
      /data-cms-html="pages\.' \+ e\(key\) \+ '\.body"/.test(admin));
    check('a created page is registered as builder-mounted',
      /builderMount: true/.test(admin));
  }

  /* ================================================================
     11. THE MIGRATE OFFER IN THE ADMIN
     It is offered exactly when there is copy to move and no builder
     work to lose -- and not otherwise.
     ================================================================ */
  console.log('\n===== THE ADMIN OFFERS THE MIGRATION AT THE RIGHT TIME =====');
  {
    let serverRow = null;
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**supabase.co/**', route => {
      const q = route.request(), u = q.url();
      if (u.includes('/auth/v1/token')) return route.fulfill({ status: 200,
        contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
      if (q.method() === 'POST') { try { serverRow = JSON.parse(q.postData() || '{}'); } catch (e) {}
        return route.fulfill({ status: 201, body: '' }); }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(serverRow ? [{ data: serverRow.data, updated_at: serverRow.updated_at }] : []) });
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 180)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
      errs.push(m.text().slice(0, 180)); });
    await p.goto(`${BASE}/admin/`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x');
    await p.click('#authBtn'); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('.adm-nav-item[data-panel="builder"]').click());
    await p.waitForTimeout(500);

    const openTab = async slug => {
      await p.evaluate(sl => {
        const t = [...document.querySelectorAll('#pbTabs .pagetab')]
          .find(x => x.getAttribute('data-slug') === sl);
        if (t) t.click();
      }, slug);
      await p.waitForTimeout(350);
    };

    await openTab('about');
    check('an untouched page is offered the migration',
      await p.isVisible('#pbMigrateBtn'));
    check('and the offer names what it will move',
      /\d+ element/.test(await p.evaluate(() =>
        (document.querySelector('.pb-migrate-msg') || {}).textContent || '')));
    check('and says what the conversion costs before it runs',
      /[Ll]inks inside a paragraph/.test(await p.evaluate(() =>
        (document.querySelector('.pb-migrate-warn') || {}).textContent || '')));

    /* Running it fills the draft and withdraws the offer. */
    await p.click('#pbMigrateBtn');
    await p.waitForTimeout(450);
    const after = await p.evaluate(() => ({
      draft: CMS.sections.draft('about').sections.length,
      els: CMS.sections.draft('about').sections[0].elements.length,
      live: CMS.sections.live('about').length,
      bodyKept: /JSK1 is an online gaming site/.test(CMS.data().pages.about.body),
      rows: document.querySelectorAll('#pbList .pb-row, #pbList .pb-sec').length
    }));
    check('migrating fills the draft with one section', after.draft === 1, after);
    check('carrying the page copy across', after.els >= 4, after);
    check('it publishes nothing on its own', after.live === 0, after);
    check('and it does not delete the page body', after.bodyKept === true, after);
    check('the canvas now lists the migrated section', after.rows >= 1, after);
    check('the offer is withdrawn once a draft exists',
      (await p.isVisible('#pbMigrateBtn')) === false);

    /* A page with a published builder is never offered it. */
    await p.evaluate(() => { CMS.sections.publish('about'); });
    await openTab('contact'); await openTab('about');
    check('a published page is not offered the migration',
      (await p.isVisible('#pbMigrateBtn')) === false);

    /* Nor is a page deliberately cleared to an empty canvas. */
    await p.evaluate(() => {
      CMS.sections.saveDraft('about', []);
      CMS.sections.publish('about');
    });
    await openTab('contact'); await openTab('about');
    check('an intentionally emptied page is not offered it back',
      (await p.isVisible('#pbMigrateBtn')) === false);

    /* A page whose copy is empty has nothing to offer. */
    await p.evaluate(() => { CMS.data().pages.contact.body = ''; });
    await openTab('about'); await openTab('contact');
    check('a page with no copy is not offered the migration',
      (await p.isVisible('#pbMigrateBtn')) === false);

    check('no admin page errors', errs.length === 0, errs.slice(0, 4));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
