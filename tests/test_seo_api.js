#!/usr/bin/env node
/* =====================================================================
   CMS.seo — ONE SET OF SEO COMPUTATIONS, TWO CALLERS
   ---------------------------------------------------------------------
   js/cms.js works out a page's title, description, robots, canonical,
   Open Graph, Twitter and JSON-LD and paints them into the document. A
   static build needs the SAME values to write into the HTML it generates,
   and the one thing it must not do is work them out again: two
   implementations of "what is this page's title" is two answers, and the
   one a crawler reads would be the wrong one.

   So the set is now defined once as data (seoTags) and exposed as
   CMS.seo. paintSeo() APPLIES it. This suite is the proof that the two
   cannot drift:

     1. the API is the same function REFERENCES paintSeo uses -- not
        wrappers, not copies;
     2. the cascades behave as documented, driven from a record;
     3. in a real browser, what CMS.seo.tags() says equals what paintSeo()
        actually put in the document -- every meta, the title, the
        canonical and both JSON-LD blocks;
     4. an empty CMS value still leaves the tag the HTML shipped alone;
     5. nothing brand-specific was introduced into shared CMS logic.

   BRAND-NEUTRAL BY CONSTRUCTION. The Node fixture is an invented brand
   ("Example Brand" / example.test) that is not and will never be a real
   one. The browser half asserts EQUALITY BETWEEN TWO COMPUTATIONS over
   whatever the served pages happen to hold, so it names no brand, domain
   or SEO value of its own and keeps passing for any brand.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* An invented brand. Every value here exists to exercise one branch of a
   cascade; none of it belongs to a real deployment. */
const SITE = 'Example Brand';
const BASEURL = 'https://example.test';
const REC = {
  seo: {
    baseUrl: BASEURL,
    siteName: SITE,
    titleTemplate: '%s | ' + SITE,
    defaultTitle: 'Fallback Title',
    defaultDescription: 'Fallback description for the whole site.',
    defaultOgImage: 'img/og-default.png',
    defaultOgTitle: '',
    defaultOgDescription: '',
    twitterCard: 'summary_large_image',
    twitterSite: '@examplebrand',
    defaultTwitterTitle: '',
    defaultTwitterDescription: '',
    defaultTwitterImage: '',
    verification: { google: 'google-code-here', bing: '', yandex: '' },
    organization: { name: SITE + ' Ltd', legalName: '', logo: '', sameAs: [], contactPoint: {} }
  },
  pages: {
    /* page values set; title does NOT contain the site name, so the
       template applies */
    alpha: {
      label: 'Alpha', slug: 'alpha', url: 'alpha.html', canonical: '',
      robots: { index: true, follow: true },
      og: { title: '', description: '', image: '' },
      twitter: { title: '', description: '', image: '' },
      breadcrumb: { label: 'Alpha Section', show: true },
      schema: { webPage: true, breadcrumb: true, contactPage: false },
      inSitemap: true, updatedAt: '2026-01-01',
      title: 'Alpha Guide', metaDescription: 'Everything about alpha.',
      heading: 'Alpha', lead: '', body: ''
    },
    /* title ALREADY carries the site name -> template must not double it;
       own og/twitter values; noindex; a canonical override */
    beta: {
      label: 'Beta', slug: 'beta', url: 'beta.html',
      canonical: 'https://example.test/beta-canonical.html',
      robots: { index: false, follow: false },
      og: { title: 'Beta OG', description: 'Beta OG description', image: 'img/beta-og.png' },
      twitter: { title: 'Beta TW', description: '', image: 'data:image/png;base64,AAAA' },
      breadcrumb: { label: '', show: false },
      schema: { webPage: true, breadcrumb: false, contactPage: false },
      inSitemap: false, updatedAt: '',
      title: 'Beta news from ' + SITE, metaDescription: '',
      heading: 'Beta', lead: '', body: ''
    },
    /* everything blank: the global defaults have to carry it */
    gamma: {
      label: 'Gamma', slug: 'gamma', url: 'gamma.html', canonical: '',
      robots: {},
      og: { title: '', description: '', image: '' },
      twitter: { title: '', description: '', image: '' },
      breadcrumb: { label: 'Gamma', show: true },
      schema: { webPage: true, breadcrumb: true, contactPage: false },
      inSitemap: true, updatedAt: '',
      title: '', metaDescription: '', heading: '', lead: '', body: ''
    }
  }
};

const eng = pbbake.loadEngine(ROOT);
const CMS = eng.CMS;
CMS.replace(JSON.parse(JSON.stringify(REC)));

const metaOf = (tags, name) => (tags.metas.filter(m => m.name === name)[0] || {}).content;

/* ====================================================================
   1. THE API IS THE SAME FUNCTIONS, NOT A SECOND COPY
   ==================================================================== */
console.log('\n===== CMS.seo EXPOSES THE COMPUTATIONS paintSeo USES =====');
check('CMS.seo exists', !!CMS.seo && typeof CMS.seo === 'object');
['title', 'description', 'og', 'twitter', 'robots', 'url', 'jsonLd', 'breadcrumb']
  .forEach(k => check('CMS.seo.' + k + ' is a function', typeof CMS.seo[k] === 'function'));
check('CMS.seo.tags is a function', typeof CMS.seo.tags === 'function');
check('CMS.seo.page is a function', typeof CMS.seo.page === 'function');

/* Identity, not equivalence: a wrapper could drift, a reference cannot. */
check('seo.title IS the function behind seoTitleFor', CMS.seo.title === CMS.seoTitleFor);
check('seo.description IS the function behind seoDescriptionFor', CMS.seo.description === CMS.seoDescriptionFor);
check('seo.og IS the function behind seoOgFor', CMS.seo.og === CMS.seoOgFor);
check('seo.twitter IS the function behind seoTwitterFor', CMS.seo.twitter === CMS.seoTwitterFor);
check('seo.robots IS the function behind seoRobotsFor', CMS.seo.robots === CMS.seoRobotsFor);
check('seo.url IS the function behind seoUrlFor', CMS.seo.url === CMS.seoUrlFor);
check('seo.image IS the function behind seoCrawlableImage', CMS.seo.image === CMS.seoCrawlableImage);
check('seo.absUrl IS the function behind seoAbsUrl', CMS.seo.absUrl === CMS.seoAbsUrl);
/* The earlier spelling still works: js/admin.js reads it. */
check('the flat seo*For aliases are still present',
  ['seoTitleFor', 'seoDescriptionFor', 'seoOgFor', 'seoTwitterFor', 'seoRobotsFor',
   'seoUrlFor', 'seoAbsUrl', 'seoCrawlableImage'].every(k => typeof CMS[k] === 'function'));

/* ====================================================================
   2. THE CASCADES, FROM A RECORD
   ==================================================================== */
console.log('\n===== THE DOCUMENTED CASCADES =====');
const A = CMS.seo.page('alpha'), B = CMS.seo.page('beta'), G = CMS.seo.page('gamma');
check('a slug resolves to its page record', !!A && A.slug === 'alpha');
check('an unknown slug resolves to null', CMS.seo.page('no-such-page') === null);

check('the page title wins, with the template applied',
  CMS.seo.title(A) === 'Alpha Guide | ' + SITE, CMS.seo.title(A));
check('a title already carrying the site name is NOT doubled up',
  CMS.seo.title(B) === 'Beta news from ' + SITE, CMS.seo.title(B));
check('a blank page title falls back to the site default',
  CMS.seo.title(G) === 'Fallback Title | ' + SITE, CMS.seo.title(G));

check('the page description wins', CMS.seo.description(A) === 'Everything about alpha.');
check('a blank description falls back to the site default',
  CMS.seo.description(G) === REC.seo.defaultDescription);

check('og falls through to the plain title when nothing else is set',
  CMS.seo.og(A, 'title') === CMS.seo.title(A), CMS.seo.og(A, 'title'));
check('og uses the page value when there is one', CMS.seo.og(B, 'title') === 'Beta OG');
check('og image falls back to the site default', CMS.seo.og(A, 'image') === 'img/og-default.png');
check('twitter inherits og by default',
  CMS.seo.twitter(A, 'description') === CMS.seo.og(A, 'description'));
check('twitter uses its own value when set', CMS.seo.twitter(B, 'title') === 'Beta TW');

check('robots reads index and follow', CMS.seo.robots(A) === 'index,follow', CMS.seo.robots(A));
check('robots reports noindex,nofollow', CMS.seo.robots(B) === 'noindex,nofollow');
check('a page that says nothing about robots gets no directive',
  CMS.seo.robots(G) === '', CMS.seo.robots(G));

check('url is the base plus the page file', CMS.seo.url(A) === BASEURL + '/alpha.html');
check('a canonical override wins', CMS.seo.url(B) === B.canonical);
check('no page at all is the base itself', CMS.seo.url(null) === BASEURL + '/');

check('a relative image becomes absolute', CMS.seo.image('img/x.png') === BASEURL + '/img/x.png');
check('a data: image is refused, so the tag is simply not written',
  CMS.seo.image('data:image/png;base64,AAAA') === '');

/* ====================================================================
   3. tags() IS THE WHOLE SET, AND AGREES WITH THE PARTS
   ==================================================================== */
console.log('\n===== tags() IS THE SET paintSeo APPLIES =====');
const tA = CMS.seo.tags(A);
check('tags carries the title', tA.title === CMS.seo.title(A));
check('tags carries the canonical as a link',
  tA.links.length === 1 && tA.links[0].rel === 'canonical' && tA.links[0].href === CMS.seo.url(A));
['description', 'robots', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image',
 'twitter:card', 'twitter:site', 'twitter:title', 'twitter:description', 'twitter:image',
 'google-site-verification', 'msvalidate.01', 'yandex-verification']
  .forEach(n => check('tags includes ' + n, tA.metas.some(m => m.name === n)));
check('every meta entry declares its attribute',
  tA.metas.every(m => m.attr === 'name' || m.attr === 'property'));
check('og:* are property attributes, the rest are name',
  tA.metas.filter(m => /^og:/.test(m.name)).every(m => m.attr === 'property') &&
  tA.metas.filter(m => !/^og:/.test(m.name)).every(m => m.attr === 'name'));

check('tags agrees with the individual computations',
  metaOf(tA, 'description') === CMS.seo.description(A) &&
  metaOf(tA, 'robots') === CMS.seo.robots(A) &&
  metaOf(tA, 'og:title') === CMS.seo.og(A, 'title') &&
  metaOf(tA, 'og:url') === CMS.seo.url(A) &&
  metaOf(tA, 'og:image') === CMS.seo.image(CMS.seo.og(A, 'image')) &&
  metaOf(tA, 'twitter:title') === CMS.seo.twitter(A, 'title'));
check('an image the platform cannot fetch comes through as empty, not as a data URL',
  metaOf(CMS.seo.tags(B), 'twitter:image') === '');
check('an unset verification code is empty, so nothing is written for it',
  metaOf(tA, 'msvalidate.01') === '' && metaOf(tA, 'google-site-verification') === 'google-code-here');

/* ====================================================================
   4. JSON-LD AND THE BREADCRUMB'S DOM QUESTION
   ==================================================================== */
console.log('\n===== STRUCTURED DATA, WITHOUT A DOM =====');
const ld = CMS.seo.jsonLd(A);
check('jsonLd returns the four blocks by element id',
  ['ldOrganization', 'ldWebSite', 'ldPage', 'ldBreadcrumb'].every(k => k in ld));
check('the WebPage block carries the page url', ld.ldPage && ld.ldPage.url === CMS.seo.url(A));
/* Deliberately the RAW page title, not the templated one: the <title> tag
   carries the brand for a search result, a WebPage.name should not repeat
   it. Pinned here because it is a difference a build would be tempted to
   "fix" into computeTitle(). */
check('  and its name is the raw page title, not the title-template result',
  ld.ldPage.name === A.title && ld.ldPage.name !== CMS.seo.title(A),
  [ld.ldPage.name, A.title, CMS.seo.title(A)]);
check('  falling back to the heading when the title is blank',
  (CMS.seo.jsonLd(G).ldPage || {}).name === G.heading ||
  (G.heading === '' && CMS.seo.jsonLd(G).ldPage === null));
check('every block that exists carries @context, ready to serialise',
  Object.keys(ld).every(k => !ld[k] || ld[k]['@context'] === 'https://schema.org'));
check('a page with webPage schema off produces no WebPage block',
  CMS.seo.jsonLd({ schema: { webPage: false } }).ldPage === null);

/* The one computation that asked the DOM a question. In Node there is no
   document, so without being told the answer it must come back null --
   and with the answer it must build the trail. */
check('without a breadcrumb nav there is no BreadcrumbList', ld.ldBreadcrumb === null);
const ldNav = CMS.seo.jsonLd(A, { breadcrumbNav: true });
check('told the page shows one, it builds the trail',
  !!ldNav.ldBreadcrumb && ldNav.ldBreadcrumb.itemListElement.length === 2);
check('  and the trail ends on this page, labelled from the record',
  ldNav.ldBreadcrumb.itemListElement[1].name === 'Alpha Section' &&
  ldNav.ldBreadcrumb.itemListElement[1].item === CMS.seo.url(A));
check('a page that hides its breadcrumb gets none even when the nav exists',
  CMS.seo.breadcrumb(B, { breadcrumbNav: true }) === null);

/* ====================================================================
   5. NOTHING BRAND-SPECIFIC ENTERED THE SHARED COMPUTATIONS
   --------------------------------------------------------------------
   Read from the live functions rather than from the file, so this cannot
   be satisfied by a literal that moved somewhere else in js/cms.js.
   ==================================================================== */
console.log('\n===== THE SHARED LOGIC NAMES NO BRAND =====');
{
  const BRANDISH = /jsk-?1|playzone|\bjsk\b|[a-z0-9-]+\.(?:com|app|net|org)\b/i;
  const sources = { 'seo.tags': CMS.seo.tags, 'seo.jsonLd': CMS.seo.jsonLd,
                    'seo.breadcrumb': CMS.seo.breadcrumb, 'seo.title': CMS.seo.title,
                    'seo.description': CMS.seo.description, 'seo.og': CMS.seo.og,
                    'seo.twitter': CMS.seo.twitter, 'seo.robots': CMS.seo.robots,
                    'seo.url': CMS.seo.url, 'seo.image': CMS.seo.image };
  Object.keys(sources).forEach(k => {
    const src = String(sources[k]);
    check(k + ' contains no brand, domain or site id', !BRANDISH.test(src),
      (src.match(BRANDISH) || [])[0]);
  });
  /* And the test's own fixture must not be a real brand either. */
  check('this suite\'s fixture brand is invented', !BRANDISH.test(SITE) && /example\.test$/.test(BASEURL));
}

/* ====================================================================
   6. BROWSER PARITY — WHAT tags() SAYS IS WHAT paintSeo() WROTE
   --------------------------------------------------------------------
   The reason this suite exists. Everything above could be true and the
   build could still ship different HTML than the page a visitor gets, if
   paintSeo applied something other than this table. So: load the real
   pages, and compare the table against the document paintSeo produced.

   No expected VALUES appear here -- only the claim that two computations
   agree -- so this passes unchanged for any brand.
   ==================================================================== */
(async () => {
  console.log('\n===== IN A REAL BROWSER, THE TABLE IS WHAT WAS PAINTED =====');
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext();
  const p = await ctx.newPage();

  const PAGES = ['index.html', 'about.html', 'contact.html',
                 'privacy-policy.html', 'responsible-gaming.html'];

  for (const file of PAGES) {
    await p.goto(BASE + '/' + file, { waitUntil: 'load' });
    /* paintSchemaLate() runs after the document parses, which is when the
       JSON-LD blocks exist to be written at all. */
    await p.waitForFunction(() => window.CMS && typeof CMS.seo === 'object', null, { timeout: 15000 });

    const r = await p.evaluate(() => {
      const key = document.documentElement.getAttribute('data-cms-page') || '';
      const page = key ? CMS.seo.page(key) : null;
      if (!page) return { key: key, page: false };
      const t = CMS.seo.tags(page, { breadcrumbNav: !!document.querySelector('.breadcrumb') });
      const dom = {};
      t.metas.forEach(m => {
        const el = document.head.querySelector('meta[' + m.attr + '="' + m.name + '"]');
        dom[m.name] = el ? el.getAttribute('content') : null;
      });
      const canon = document.head.querySelector('link[rel="canonical"]');
      const ldText = id => { const e = document.getElementById(id); return e ? e.textContent : null; };
      const want = o => (o ? JSON.stringify(o, null, 2) : '{}');
      return {
        key: key, page: true,
        title: t.title, docTitle: document.title,
        metas: t.metas, dom: dom,
        canonWant: t.links[0].href,
        canonGot: canon ? canon.getAttribute('href') : null,
        ldGot: { ldPage: ldText('ldPage'), ldBreadcrumb: ldText('ldBreadcrumb'),
                 ldOrganization: ldText('ldOrganization'), ldWebSite: ldText('ldWebSite') },
        ldWant: { ldPage: want(t.jsonLd.ldPage), ldBreadcrumb: want(t.jsonLd.ldBreadcrumb),
                  ldOrganization: want(t.jsonLd.ldOrganization), ldWebSite: want(t.jsonLd.ldWebSite) }
      };
    });

    check(file + ': the page identifies itself and resolves a record', r.page === true, r.key);
    if (!r.page) continue;

    const written = r.metas.filter(m => m.content !== '');
    const blank = r.metas.filter(m => m.content === '');
    check(file + ': every computed meta value is the one in the document',
      written.every(m => r.dom[m.name] === m.content),
      written.filter(m => r.dom[m.name] !== m.content).map(m => [m.name, m.content, r.dom[m.name]]));
    check(file + ':   and that is not a vacuous claim', written.length > 0, written.length);
    /* The rule the whole static-first design rests on. */
    check(file + ': a blank CMS value left the shipped tag alone, never emptied it',
      blank.every(m => r.dom[m.name] !== ''),
      blank.filter(m => r.dom[m.name] === '').map(m => m.name));
    check(file + ': the computed title is the document title',
      r.title ? r.docTitle === r.title : true, [r.title, r.docTitle]);
    check(file + ': the computed canonical is the document canonical',
      r.canonWant ? r.canonGot === r.canonWant : true, [r.canonWant, r.canonGot]);
    Object.keys(r.ldWant).forEach(id => {
      check(file + ': ' + id + ' holds exactly what jsonLd() computed',
        r.ldGot[id] === null || r.ldGot[id] === r.ldWant[id],
        [r.ldWant[id] && r.ldWant[id].slice(0, 80), r.ldGot[id] && r.ldGot[id].slice(0, 80)]);
    });
  }

  /* ==================================================================
     7. BUILD PARITY — WHAT THE STATIC HTML CARRIES IS WHAT THE BROWSER
        WOULD COMPUTE
     ------------------------------------------------------------------
     Section 6 proved paintSeo() applies the table. This proves the
     STATIC BUILD writes the same table: a generic CMS page is built by
     the real CLI, its head is read back as plain text, and every value
     is compared with what a browser computes from the same record for
     the same slug. Two computations, one answer -- and the HTML side
     never ran a line of JavaScript to get there.
     ================================================================== */
  console.log('\n===== THE STATIC HTML CARRIES WHAT THE BROWSER WOULD COMPUTE =====');
  {
    const { execFileSync } = require('child_process');
    const os2 = require('os');
    const SLUG = 'parity-fixture';
    const BRANDS = path.join(ROOT, 'brands');
    /* The first real brand, whichever it is -- this names none. */
    const brandId = fs.readdirSync(BRANDS, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name).sort()[0];
    const brandJson = JSON.parse(fs.readFileSync(path.join(BRANDS, brandId, 'brand.json'), 'utf8'));
    const brandRecord = pbbake.brandRecord(
      fs.readFileSync(path.join(BRANDS, brandId, 'brand.js'), 'utf8'));
    const seoCfg = JSON.parse(fs.readFileSync(path.join(BRANDS, brandId, 'seo-config.json'), 'utf8'));

    /* Whatever the committed layer publishes has to be in the row too, or
       the build refuses to empty those pages. */
    const pages = {};
    Object.keys(brandRecord.pages || {}).forEach(k => {
      const p = brandRecord.pages[k];
      if (p && p.builder && p.builder.status === 'published') pages[k] = { builder: p.builder };
    });
    pages[SLUG] = {
      label: 'Parity Fixture', slug: SLUG, url: SLUG + '.html', canonical: '',
      robots: { index: true, follow: true }, inSitemap: true,
      og: { title: 'Parity OG', description: '', image: 'assets/images/ssl.png' },
      twitter: { title: '', description: 'Parity TW description', image: '' },
      breadcrumb: { label: 'Parity Fixture', show: true },
      schema: { webPage: true, breadcrumb: true, contactPage: false },
      updatedAt: '2026-10-01', title: 'Parity Fixture Title',
      metaDescription: 'Parity fixture description.', heading: 'Parity Fixture',
      lead: '', body: '', builderMount: true
    };
    const rowData = { seo: seoCfg.seo || {}, pages: pages };

    const work = fs.mkdtempSync(path.join(os2.tmpdir(), 'seoparity-'));
    const rowFile = path.join(work, 'row.json');
    fs.writeFileSync(rowFile, JSON.stringify({ data: rowData, updated_at: '2026-10-01T00:00:00+00:00' }));
    let built = true;
    try {
      execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-site.js'), brandId,
        '--row', rowFile, '--out', path.join(work, 'out')],
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { built = false; console.log(((e.stdout || '') + (e.stderr || '')).slice(-500)); }
    check('the build produced a generic page to compare against', built);

    const file = path.join(work, 'out', brandJson.output || brandId, SLUG + '.html');
    const html = built && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    check('  and it is on disk', !!html, file);

    /* Read back, anchored on the attribute that names each tag. */
    const metaOfHtml = (kind, name) => {
      const m = new RegExp('<meta\\s+' + kind + '="' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
        '"[^>]*content="([^"]*)"', 'i').exec(html);
      return m ? m[1] : null;
    };
    const unesc = v => v == null ? null : v
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    const staticSide = {
      title: unesc((/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [, null])[1]),
      description: unesc(metaOfHtml('name', 'description')),
      robots: unesc(metaOfHtml('name', 'robots')),
      canonical: unesc((/<link\s+rel="canonical"[^>]*href="([^"]*)"/i.exec(html) || [, null])[1]),
      'og:title': unesc(metaOfHtml('property', 'og:title')),
      'og:description': unesc(metaOfHtml('property', 'og:description')),
      'og:url': unesc(metaOfHtml('property', 'og:url')),
      'og:image': unesc(metaOfHtml('property', 'og:image')),
      'twitter:title': unesc(metaOfHtml('name', 'twitter:title')),
      'twitter:description': unesc(metaOfHtml('name', 'twitter:description')),
      'twitter:image': unesc(metaOfHtml('name', 'twitter:image'))
    };
    const ldFromHtml = id => {
      const m = new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</script>', 'i').exec(html);
      if (!m) return null;
      try { return JSON.parse(m[1]); } catch (e) { return 'UNPARSEABLE'; }
    };

    /* The browser side: the same record, installed the way the build
       installs it, and the engine asked the same question. */
    await p.goto(BASE + '/about.html', { waitUntil: 'load' });
    await p.waitForFunction(() => window.CMS && typeof CMS.seo === 'object', null, { timeout: 15000 });
    const browserSide = await p.evaluate(args => {
      const [brand, row, baseUrl, slug] = args;
      const record = CMS.merge(brand, row);
      record.seo = CMS.merge(record.seo || {}, { baseUrl: baseUrl });
      CMS.replace(record);
      const page = CMS.seo.page(slug);
      if (!page) return null;
      const t = CMS.seo.tags(page, { breadcrumbNav: true });
      const out = { title: t.title, canonical: t.links[0].href };
      t.metas.forEach(m => { out[m.name] = m.content; });
      out.__ld = { ldPage: t.jsonLd.ldPage, ldBreadcrumb: t.jsonLd.ldBreadcrumb };
      return out;
    }, [brandRecord, rowData, 'https://' + (brandJson.domain || brandId), SLUG]);

    check('the browser resolves the same page from the same record', !!browserSide);
    if (browserSide) {
      ['title', 'description', 'canonical', 'robots', 'og:title', 'og:description', 'og:url',
       'og:image', 'twitter:title', 'twitter:description'].forEach(k => {
        check('static HTML == browser computation for ' + k,
          staticSide[k] === browserSide[k], [k, staticSide[k], browserSide[k]]);
      });
      /* The one field where "nothing" is the right answer, and both sides
         have to agree on that too. */
      check('static HTML == browser computation for twitter:image',
        (browserSide['twitter:image'] || '') === (staticSide['twitter:image'] || ''),
        [staticSide['twitter:image'], browserSide['twitter:image']]);
      check('  and that is a real value, not two nulls',
        !!browserSide['og:image'] && !!staticSide['og:image'],
        [staticSide['og:image'], browserSide['og:image']]);

      ['ldPage', 'ldBreadcrumb'].forEach(id => {
        check('static HTML == browser computation for ' + id,
          JSON.stringify(ldFromHtml(id)) === JSON.stringify(browserSide.__ld[id]),
          [JSON.stringify(ldFromHtml(id) || null).slice(0, 160),
           JSON.stringify(browserSide.__ld[id] || null).slice(0, 160)]);
      });
      check('  and those blocks are not empty on either side',
        !!browserSide.__ld.ldPage && !!browserSide.__ld.ldBreadcrumb &&
        !!ldFromHtml('ldPage') && !!ldFromHtml('ldBreadcrumb'));

      /* The whole point: no script had to run for the static side. */
      check('the static values were read from text, with no JavaScript executed',
        html.indexOf(staticSide.title) > -1 && html.indexOf('<script') > -1);
      check('  and the runtime hooks are still in the page, so it repaints too',
        html.indexOf('data-cms-title="pages.' + SLUG + '.title"') > -1 &&
        html.indexOf('data-cms-meta="pages.' + SLUG + '.metaDescription"') > -1);
    }
    try { fs.rmSync(work, { recursive: true, force: true }); } catch (e) {}
  }

  /* A page with no data-cms-page must still be left alone -- the legacy
     title hook path, which paintSeo keeps to itself. */
  await p.goto(BASE + '/login.html', { waitUntil: 'load' });
  const loginTitle = await p.title();
  check('a page outside the pages record still has a title', !!loginTitle);

  await browser.close();

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
