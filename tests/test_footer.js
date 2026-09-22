/* GLOBAL FOOTER MANAGER — CMS-managed navigation columns.

   THE CLAIM. The footer's navigation columns can be edited in the admin
   and the change reaches every public page, WITHOUT the page ever losing
   the crawlable footer written into its HTML.

   STATIC FIRST is the whole design, so it is what most of this file
   tests. tools/build-shell.js writes a complete footer into every page;
   renderFooter() in js/cms.js replaces the navigation columns over it
   only when the saved data survives cleanFooter(). Missing, empty,
   malformed or unsafe data must leave the shipped markup exactly as it
   is -- a crawler that runs no JavaScript still has to see real internal
   links.

   The Brand and Support columns are NOT CMS-managed and must survive
   every render: they carry the logo, the site name, the social icons and
   the WhatsApp link that paintWhatsApp() binds by element id. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const SHELL_PAGES = ['index.html', 'about.html', 'contact.html',
                     'responsible-gaming.html', 'privacy-policy.html', '404.html'];

/* What the generator writes into every page, in order. The last is the
   WhatsApp link, which paintWhatsApp() rewrites at runtime. */
const STATIC_HREFS = ['./', 'about.html', 'contact.html', 'responsible-gaming.html',
                      'privacy-policy.html', 'login.html', 'register.html', 'contact.html'];
const STATIC_TITLES = ['Important Links', 'Account', 'Support'];

/* Open a page, optionally with a footer seeded into localStorage before
   any script runs. `raw` is injected as JSON text so that a payload with
   a __proto__ key stays an ordinary own property, the way JSON.parse
   delivers it -- writing it as an object literal would set the prototype
   instead and quietly test nothing. */
async function open(b, file, opts) {
  opts = opts || {};
  const ctx = await b.newContext({
    viewport: { width: opts.w || 1280, height: opts.h || 900 } });
  await ctx.route('**supabase.co/**', r => r.fulfill({ status: 200,
    contentType: 'application/json', body: '[]' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    errs.push(m.text().slice(0, 160)); });
  if (opts.footerJson !== undefined) {
    await p.addInitScript(json => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.footer = JSON.parse(json);
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, opts.footerJson);
  }
  if (opts.textJson !== undefined) {
    await p.addInitScript(json => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.text = Object.assign(raw.text || {}, JSON.parse(json));
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, opts.textJson);
  }
  await p.goto(`${BASE}/${file}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(220);
  return { ctx, p, errs };
}

const look = p => p.evaluate(() => ({
  /* The CMS-managed columns only: everything that is not marked kept. */
  cmsHrefs: [...document.querySelectorAll(
    '[data-cms-footer] > .footer-col:not([data-footer-keep]) .footer-links a')]
    .map(a => a.getAttribute('href')),
  cmsLabels: [...document.querySelectorAll(
    '[data-cms-footer] > .footer-col:not([data-footer-keep]) .footer-links a')]
    .map(a => a.textContent.trim()),
  cmsRels: [...document.querySelectorAll(
    '[data-cms-footer] > .footer-col:not([data-footer-keep]) .footer-links a')]
    .map(a => a.getAttribute('rel')),
  titles: [...document.querySelectorAll('footer.site-footer .footer-col-title')]
    .map(t => t.textContent.trim()),
  hrefs: [...document.querySelectorAll('footer.site-footer .footer-links a')]
    .map(a => a.getAttribute('href')),
  labels: [...document.querySelectorAll('footer.site-footer .footer-links a')]
    .map(a => a.textContent.trim()),
  rels: [...document.querySelectorAll('footer.site-footer .footer-links a')]
    .map(a => a.getAttribute('rel')),
  navLabels: [...document.querySelectorAll('footer.site-footer nav.footer-links')]
    .map(n => n.getAttribute('aria-label')),
  cols: document.querySelectorAll('footer.site-footer .footer-col').length,
  brand: document.querySelectorAll('[data-footer-keep="brand"]').length,
  support: document.querySelectorAll('[data-footer-keep="support"]').length,
  brandName: (document.querySelector('.footer-brand-name') || {}).textContent,
  brandText: (document.querySelector('.footer-brand-text') || {}).textContent,
  logo: !!document.getElementById('footerLogo'),
  social: !!document.getElementById('footerSocial'),
  waLink: (document.getElementById('footerWaLink') || {}).getAttribute
    ? document.getElementById('footerWaLink').getAttribute('href') : null,
  ssl: !!document.querySelector('footer.site-footer .ssl-img'),
  copy: (document.querySelector('.footer-copy') || {}).textContent,
  h1s: document.querySelectorAll('h1').length,
  footers: document.querySelectorAll('footer.site-footer').length,
  scriptsInFooter: document.querySelectorAll('footer.site-footer script, footer.site-footer iframe').length,
  onAttrs: [...document.querySelectorAll('footer.site-footer *')]
    .filter(el => [...el.attributes].some(a => /^on/i.test(a.name))).length,
  jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length
}));

/* The admin needs a real-looking token from the auth endpoint, and a
   publish has to be accepted. A bare '[]' stub signs nobody in. */
async function adminCtx(b) {
  let serverRow = null;
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**supabase.co/**', route => {
    const q = route.request(), u = q.url();
    if (u.includes('/auth/v1/token')) {
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ access_token: 'stub' }) });
    }
    if (q.method() === 'POST') {
      try { serverRow = JSON.parse(q.postData() || '{}'); } catch (e) { serverRow = null; }
      return route.fulfill({ status: 201, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(serverRow ? [{ data: serverRow.data, updated_at: serverRow.updated_at }] : []) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 160)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    errs.push(m.text().slice(0, 160)); });
  await p.goto(`${BASE}/admin/`, { waitUntil: 'networkidle' });
  await p.fill('#authEmail', 'a@b.c');
  await p.fill('#authPass', 'x');
  await p.click('#authBtn');
  await p.waitForTimeout(500);
  return { ctx, p, errs, row: () => serverRow };
}

/* One valid two-column footer, used by several sections below. */
const GOOD = JSON.stringify({
  version: 1,
  columns: [
    { id: 'c1', title: 'Sports', enabled: true, links: [
      { id: 'l1', label: 'Cricket', href: 'about.html', enabled: true },
      { id: 'l2', label: 'Football', href: 'contact.html', enabled: true }
    ] },
    { id: 'c2', title: 'Help', enabled: true, links: [
      { id: 'l3', label: 'Contact', href: 'contact.html', enabled: true },
      { id: 'l4', label: 'Regulator', href: 'https://www.gamblingcommission.gov.uk/', enabled: true }
    ] }
  ]
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. THE STATIC FALLBACK IS IN THE FILES
     This is the SEO floor and the reason the generator still exists.
     ================================================================ */
  console.log('\n===== THE CRAWLABLE FOOTER IS IN THE SERVED FILES =====');
  {
    for (const f of SHELL_PAGES) {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      check(f + ': ships a real <footer>', /<footer class="site-footer">/.test(raw));
      check(f + ': ships the CMS mount',
        raw.includes('<div class="footer-cols" data-cms-footer>'));
      check(f + ': every fallback footer href is in the markup',
        STATIC_HREFS.every(h => raw.includes('href="' + h + '"')), f);
      check(f + ': ships the fallback column titles',
        STATIC_TITLES.every(t => raw.includes('>' + t + '</h2>')), f);
      check(f + ': marks the brand column to be kept',
        raw.includes('data-footer-keep="brand"'));
      check(f + ': marks the support column to be kept',
        raw.includes('data-footer-keep="support"'));
      /* The fallback must not depend on the CMS to exist. */
      check(f + ': the fallback links are plain hrefs, not data attributes',
        !/class="footer-links"[^>]*data-cms-links/.test(raw));
    }
    /* Every fallback href is a page that exists (or the root). */
    check('every fallback footer href resolves to a real file',
      STATIC_HREFS.every(h => h === './' || fs.existsSync(path.join(ROOT, h))), STATIC_HREFS);
  }

  /* ================================================================
     2. THE SHIPPED DEFAULT CHANGES NOTHING
     DEFAULTS.footer must render byte-for-byte what the file shows, so
     an untouched install sees no difference at all.
     ================================================================ */
  console.log('\n===== AN UNTOUCHED INSTALL LOOKS EXACTLY AS BEFORE =====');
  {
    for (const f of SHELL_PAGES) {
      const r = await open(b, f);
      const s = await look(r.p);
      check(f + ': the same three column titles', s.titles.join(',') === STATIC_TITLES.join(','), s.titles);
      check(f + ': the same link hrefs',
        s.hrefs.slice(0, -1).join(',') === STATIC_HREFS.join(','), s.hrefs);
      check(f + ': the WhatsApp link still resolves',
        /^https:\/\/wa\.me\/\d+$/.test(s.hrefs[s.hrefs.length - 1]), s.hrefs);
      check(f + ': four columns, exactly as shipped', s.cols === 4, s.cols);
      check(f + ': one footer', s.footers === 1, s.footers);
      check(f + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
    /* And the sanitised default is the default, not something else. */
    const r = await open(b, 'about.html');
    const clean = await r.p.evaluate(() => CMS.footer.columns());
    check('the sanitised default is the two shipped columns',
      clean.length === 2 && clean[0].title === 'Important Links' &&
      clean[1].title === 'Account', clean && clean.map(c => c.title));
    check('and carries the five and two links',
      clean[0].links.length === 5 && clean[1].links.length === 2,
      clean && clean.map(c => c.links.length));
    check('the default links are all internal, so none gets a rel',
      clean.every(c => c.links.every(l => l.external === false)), clean);
    await r.ctx.close();
  }

  /* ================================================================
     3. A VALID CMS FOOTER REPLACES THE NAVIGATION COLUMNS
     ================================================================ */
  console.log('\n===== A VALID CMS FOOTER REACHES EVERY PAGE =====');
  {
    for (const f of SHELL_PAGES) {
      const r = await open(b, f, { footerJson: GOOD });
      const s = await look(r.p);
      check(f + ': the CMS titles are shown, Support still last',
        s.titles.join(',') === 'Sports,Help,Support', s.titles);
      check(f + ': the CMS links are shown',
        s.cmsHrefs.join(',') ===
        'about.html,contact.html,contact.html,https://www.gamblingcommission.gov.uk/', s.cmsHrefs);
      check(f + ': the labels are the CMS labels',
        s.cmsLabels.join(',') === 'Cricket,Football,Contact,Regulator', s.cmsLabels);
      check(f + ': an external link carries rel="noopener"',
        s.cmsRels[3] === 'noopener', s.cmsRels);
      check(f + ': an internal link carries no rel', s.cmsRels[0] === null, s.cmsRels);
      check(f + ': still four columns', s.cols === 4, s.cols);
      check(f + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  /* ================================================================
     4. BRAND AND SUPPORT SURVIVE EVERY RENDER
     They are not link lists and they carry the ids the painters bind.
     ================================================================ */
  console.log('\n===== THE BRAND AND SUPPORT COLUMNS ARE NEVER TOUCHED =====');
  {
    for (const seed of [undefined, GOOD, JSON.stringify({ version: 1, columns: [] })]) {
      const tag = seed === undefined ? 'default' : (seed === GOOD ? 'CMS columns' : 'empty CMS');
      const r = await open(b, 'about.html', { footerJson: seed });
      const s = await look(r.p);
      check(tag + ': the brand column is still there', s.brand === 1, s.brand);
      check(tag + ': the support column is still there', s.support === 1, s.support);
      check(tag + ': the site name still renders', (s.brandName || '').trim().length > 0, s.brandName);
      check(tag + ': the footer description still renders',
        (s.brandText || '').trim().length > 10, s.brandText);
      check(tag + ': the logo element survives', s.logo === true);
      check(tag + ': the social container survives', s.social === true);
      check(tag + ': the WhatsApp link is still painted',
        /^https:\/\/wa\.me\/\d+$/.test(s.waLink || ''), s.waLink);
      check(tag + ': the SSL badge survives', s.ssl === true);
      check(tag + ': the copyright line survives',
        (s.copy || '').indexOf('Copyright') > -1, s.copy);
      check(tag + ': brand comes first and support last',
        await r.p.evaluate(() => {
          const kids = [...document.querySelectorAll('[data-cms-footer] > .footer-col')];
          return kids.length > 2 &&
                 kids[0].getAttribute('data-footer-keep') === 'brand' &&
                 kids[kids.length - 1].getAttribute('data-footer-keep') === 'support';
        }));
      check(tag + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
    /* The social links are still built, and still labelled. */
    const r = await open(b, 'about.html', {
      footerJson: GOOD,
      textJson: JSON.stringify({}) });
    const soc = await r.p.evaluate(() => {
      const box = document.getElementById('footerSocial');
      return { inBrand: !!(box && box.closest('[data-footer-keep="brand"]')),
               links: [...box.querySelectorAll('a')].map(a => a.getAttribute('aria-label')) };
    });
    check('the social box stays inside the brand column', soc.inBrand === true, soc);
    check('and every social link it builds is labelled',
      soc.links.every(l => l && l.length > 0), soc.links);
    await r.ctx.close();
  }

  /* ================================================================
     5. MISSING, EMPTY AND MALFORMED DATA KEEPS THE FALLBACK
     Each of these must leave the shipped markup alone. This is the
     single most important guarantee in the feature.
     ================================================================ */
  console.log('\n===== BAD OR ABSENT DATA LEAVES THE SHIPPED FOOTER ALONE =====');
  {
    const CASES = [
      ['null',                        'null'],
      ['a string',                    '"nope"'],
      ['a number',                    '42'],
      ['an array',                    '[1,2,3]'],
      ['an empty object',             '{}'],
      ['columns missing',             '{"version":1}'],
      ['columns null',                '{"version":1,"columns":null}'],
      ['columns empty',               '{"version":1,"columns":[]}'],
      ['columns a string',            '{"version":1,"columns":"a,b"}'],
      ['columns an object',           '{"version":1,"columns":{"a":1}}'],
      ['a null column',               '{"version":1,"columns":[null]}'],
      ['a column that is a string',   '{"version":1,"columns":["x"]}'],
      ['a column that is an array',   '{"version":1,"columns":[[]]}'],
      ['a column with no title',      '{"version":1,"columns":[{"links":[{"label":"a","href":"about.html"}]}]}'],
      ['a blank title',               '{"version":1,"columns":[{"title":"   ","links":[{"label":"a","href":"about.html"}]}]}'],
      ['a column with no links',      '{"version":1,"columns":[{"title":"T"}]}'],
      ['links not an array',          '{"version":1,"columns":[{"title":"T","links":"a"}]}'],
      ['links empty',                 '{"version":1,"columns":[{"title":"T","links":[]}]}'],
      ['every link unusable',         '{"version":1,"columns":[{"title":"T","links":[{"label":"","href":""},{"label":"x"},{"href":"about.html"}]}]}'],
      ['every column disabled',       '{"version":1,"columns":[{"title":"T","enabled":false,"links":[{"label":"a","href":"about.html"}]}]}'],
      ['every link disabled',         '{"version":1,"columns":[{"title":"T","links":[{"label":"a","href":"about.html","enabled":false}]}]}'],
      /* Array-LIKE, not an array. This is the case the isArr() guards are
         actually for: a plain object with numeric keys and a length walks
         a for-loop perfectly well, so without them a column would be
         built from something that is not a list. Every other malformed
         payload above happens to fall out of the loop on its own, so
         nothing else in this file pins those two lines down. */
      ['columns array-like',          '{"version":1,"columns":{"0":{"title":"Sneaky","links":[{"label":"x","href":"about.html"}]},"length":1}}'],
      ['links array-like',            '{"version":1,"columns":[{"title":"T","links":{"0":{"label":"x","href":"about.html"},"length":1}}]}'],
      /* An href that is not a string. {"toString":"evil"} is the nasty one:
         String() looks up toString, finds a string where a function
         belongs, and THROWS -- which would take the whole render down. */
      ['href is a hostile object',     '{"version":1,"columns":[{"title":"T","links":[{"label":"x","href":{"toString":"evil"}}]}]}'],
      ['href is a plain object',       '{"version":1,"columns":[{"title":"T","links":[{"label":"x","href":{"a":1}}]}]}'],
      ['href is an array',             '{"version":1,"columns":[{"title":"T","links":[{"label":"x","href":["about.html"]}]}]}'],
      ['href is a number',            '{"version":1,"columns":[{"title":"T","links":[{"label":"x","href":42}]}]}'],
      ['href is true',                '{"version":1,"columns":[{"title":"T","links":[{"label":"x","href":true}]}]}'],
      ['label is a hostile object',    '{"version":1,"columns":[{"title":"T","links":[{"label":{"toString":"evil"},"href":"about.html"}]}]}'],
      ['title is a hostile object',    '{"version":1,"columns":[{"title":{"toString":"evil"},"links":[{"label":"x","href":"about.html"}]}]}']
    ];
    for (const [name, json] of CASES) {
      const r = await open(b, 'about.html', { footerJson: json });
      const s = await look(r.p);
      check('fallback survives: ' + name,
        s.titles.join(',') === STATIC_TITLES.join(',') &&
        s.hrefs.slice(0, -1).join(',') === STATIC_HREFS.join(',') &&
        s.cols === 4,
        { titles: s.titles, hrefs: s.hrefs, cols: s.cols });
      check('fallback survives: ' + name + ' — without an error',
        r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
    /* And the sanitiser says so directly, without a browser repaint in
       the way: every one of those payloads must clean to null. */
    const r = await open(b, 'about.html');
    const nulls = await r.p.evaluate(list => list.map(([name, json]) =>
      [name, CMS.footer.clean(JSON.parse(json))]), CASES);
    for (const [name, out] of nulls) {
      check('cleanFooter returns null for ' + name, out === null, out);
    }
    await r.ctx.close();
  }

  /* ================================================================
     6. A PARTIALLY BAD FOOTER KEEPS ONLY WHAT IS GOOD
     ================================================================ */
  console.log('\n===== A PART-BAD FOOTER DROPS ONLY THE BAD PARTS =====');
  {
    const MIXED = JSON.stringify({ version: 1, columns: [
      { title: 'Good', links: [
        { label: 'Fine', href: 'about.html' },
        { label: 'No href' },
        { label: 'Unsafe', href: 'javascript:alert(1)' },
        { href: 'contact.html' },
        null,
        'string',
        { label: 'Also fine', href: 'contact.html' }
      ] },
      { title: 'Empty after cleaning', links: [{ label: 'x', href: 'data:text/html,x' }] },
      null,
      { title: 'Second good', links: [{ label: 'Yes', href: 'privacy-policy.html' }] }
    ] });
    const r = await open(b, 'about.html', { footerJson: MIXED });
    const s = await look(r.p);
    check('only the columns with usable links survive',
      s.titles.join(',') === 'Good,Second good,Support', s.titles);
    check('only the usable links survive',
      s.cmsHrefs.join(',') === 'about.html,contact.html,privacy-policy.html', s.cmsHrefs);
    check('and their labels are intact',
      s.cmsLabels.join(',') === 'Fine,Also fine,Yes', s.cmsLabels);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     7. URL VALIDATION — WHAT IS ACCEPTED
     ================================================================ */
  console.log('\n===== SAFE LINK FORMS ARE ACCEPTED =====');
  {
    const r = await open(b, 'about.html');
    const OK = [
      ['./',                                       './'],
      ['about.html',                               'about.html'],
      ['privacy-policy.html',                      'privacy-policy.html'],
      ['assets/images/ssl.png',                    'assets/images/ssl.png'],
      ['/about.html',                              '/about.html'],
      ['https://example.com/x',                    'https://example.com/x'],
      ['http://example.com/x',                     'http://example.com/x'],
      ['mailto:a@b.com',                           'mailto:a@b.com'],
      ['tel:+911234567890',                        'tel:+911234567890'],
      ['  about.html  ',                           'about.html']
    ];
    for (const [input, want] of OK) {
      const got = await r.p.evaluate(v => CMS.footer.href(v), input);
      check('accepts ' + JSON.stringify(input), got === want, { got, want });
    }
    const ext = await r.p.evaluate(() => CMS.footer.clean({ version: 1, columns: [
      { title: 'T', links: [
        { label: 'ext', href: 'https://example.com' },
        { label: 'mail', href: 'mailto:a@b.com' },
        { label: 'tel', href: 'tel:+91123' },
        { label: 'int', href: 'about.html' },
        { label: 'root', href: './' }
      ] }] }));
    check('external, mailto and tel are marked external',
      ext[0].links.slice(0, 3).every(l => l.external === true), ext[0].links);
    check('internal and root are not',
      ext[0].links.slice(3).every(l => l.external === false), ext[0].links);
    await r.ctx.close();
  }

  /* ================================================================
     8. HOSTILE URLS ARE REFUSED
     ================================================================ */
  console.log('\n===== HOSTILE LINK FORMS ARE REFUSED =====');
  {
    const r = await open(b, 'about.html');
    const BAD = [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'data:text/html,<script>x</script>',
      'data:text/html;base64,PHNjcmlwdD54PC9zY3JpcHQ+',
      'blob:http://x/y',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'about:blank',
      '//evil.example/x.html',
      '\\\\evil.example\\x',
      '../../etc/passwd',
      'about/../../etc/passwd',
      './../secret.html',
      './/evil',
      '#',
      '',
      '   ',
      'javascript\u0000:alert(1)',
      'jav\u0009ascript:alert(1)',
      'java\u000ascript:alert(1)'
    ];
    for (const u of BAD) {
      const got = await r.p.evaluate(v => CMS.footer.href(v), u);
      check('refuses ' + JSON.stringify(u.slice(0, 30)), got === '', got);
    }
    /* A URL is a string. Anything else is refused without throwing --
       String({toString:'x'}) throws "Cannot convert object to primitive
       value", and on the public page that killed the whole render. */
    const NOT_STRINGS = [
      ['a hostile object', '{"toString":"evil"}'],
      ['a plain object',   '{"a":1}'],
      ['an array',         '["about.html"]'],
      ['a number',         '42'],
      ['true',             'true'],
      ['null',             'null']
    ];
    for (const [name, json] of NOT_STRINGS) {
      const got = await r.p.evaluate(j => {
        try { return { out: CMS.footer.href(JSON.parse(j)) }; }
        catch (e) { return { threw: String(e).slice(0, 80) }; }
      }, json);
      check('an href that is ' + name + ' is refused, without throwing',
        got.threw === undefined && got.out === '', got);
    }
    /* And a hostile href never reaches the DOM. */
    const hostile = JSON.stringify({ version: 1, columns: [
      { title: 'Bad', links: BAD.map((u, i) => ({ label: 'L' + i, href: u })) },
      { title: 'Good', links: [{ label: 'ok', href: 'about.html' }] }
    ] });
    await r.ctx.close();

    const r2 = await open(b, 'about.html', { footerJson: hostile });
    const s = await look(r2.p);
    check('a column of nothing but hostile links is dropped entirely',
      s.titles.join(',') === 'Good,Support', s.titles);
    check('no javascript: href is in the document',
      await r2.p.evaluate(() =>
        [...document.querySelectorAll('footer.site-footer a')]
          .every(a => !/^\s*(javascript|data|blob|vbscript|file|about):/i.test(a.getAttribute('href') || ''))),
      s.hrefs);
    check('no protocol-relative href is in the document',
      s.hrefs.every(h => !/^\/\//.test(h || '')), s.hrefs);
    check('nothing traversed out of the site',
      s.hrefs.every(h => (h || '').indexOf('..') === -1), s.hrefs);
    check('no page errors', r2.errs.length === 0, r2.errs);
    await r2.ctx.close();
  }

  /* ================================================================
     9. HOSTILE LABELS AND TITLES ARE TEXT, NOT MARKUP
     ================================================================ */
  console.log('\n===== HOSTILE TEXT IS SHOWN, NEVER PARSED =====');
  {
    const HOSTILE = JSON.stringify({ version: 1, columns: [
      { title: '<script>window.__pwned=1</script>', links: [
        { label: '<img src=x onerror=window.__pwned2=1>', href: 'about.html' },
        { label: '<iframe src="javascript:window.__pwned3=1"></iframe>', href: 'contact.html' },
        { label: '"><script>window.__pwned4=1</script>', href: 'privacy-policy.html' },
        { label: "</a><a href=javascript:alert(1)>x", href: 'login.html' }
      ] },
      { title: '</h2><script>window.__pwned5=1</script>', links: [
        { label: 'ok', href: 'register.html' }
      ] }
    ] });
    const r = await open(b, 'about.html', { footerJson: HOSTILE });
    const s = await look(r.p);
    const pwned = await r.p.evaluate(() => [1, 2, 3, 4, 5]
      .map(n => window['__pwned' + (n === 1 ? '' : n)]).filter(v => v !== undefined));
    check('no injected script ran', pwned.length === 0, pwned);
    check('no script or iframe was created in the footer',
      s.scriptsInFooter === 0, s.scriptsInFooter);
    check('no event-handler attribute appeared', s.onAttrs === 0, s.onAttrs);
    check('the markup in a title is shown as text',
      s.titles[0] === '<script>window.__pwned=1</script>', s.titles);
    check('and the markup in a label is shown as text',
      s.labels[0] === '<img src=x onerror=window.__pwned2=1>', s.labels);
    check('the breakout attempt produced no extra anchor',
      s.cmsHrefs.length === 5, s.cmsHrefs);
    check('every href is still one of ours',
      s.cmsHrefs.join(',') ===
      'about.html,contact.html,privacy-policy.html,login.html,register.html', s.cmsHrefs);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     10. CONTROL CHARACTERS AND WHITESPACE IN TEXT
     ================================================================ */
  console.log('\n===== CONTROL CHARACTERS ARE STRIPPED FROM TEXT =====');
  {
    const r = await open(b, 'about.html');
    const out = await r.p.evaluate(() => CMS.footer.clean({ version: 1, columns: [
      { title: 'A\u0000B\u001fC', links: [
        { label: 'x\ny\tz', href: 'about.html' },
        { label: '   spaced   out   ', href: 'contact.html' }
      ] }] }));
    check('control characters in a title become a space',
      out[0].title === 'A B C', out[0].title);
    check('newlines and tabs in a label collapse',
      out[0].links[0].label === 'x y z', out[0].links[0].label);
    check('runs of whitespace collapse and the ends are trimmed',
      out[0].links[1].label === 'spaced out', out[0].links[1].label);
    await r.ctx.close();
  }

  /* ================================================================
     11. PROTOTYPE POLLUTION
     Delivered as JSON text so __proto__ is an own property, which is
     the only way this is actually a test.
     ================================================================ */
  console.log('\n===== HOSTILE JSON CANNOT REACH A PROTOTYPE =====');
  {
    const POISON = [
      ['footer.__proto__',            '{"version":1,"__proto__":{"polluted":"yes"},"columns":[{"title":"T","links":[{"label":"a","href":"about.html"}]}]}'],
      ['a column __proto__',          '{"version":1,"columns":[{"__proto__":{"polluted":"yes"},"title":"T","links":[{"label":"a","href":"about.html"}]}]}'],
      ['a link __proto__',            '{"version":1,"columns":[{"title":"T","links":[{"__proto__":{"polluted":"yes"},"label":"a","href":"about.html"}]}]}'],
      ['a column constructor',        '{"version":1,"columns":[{"constructor":{"polluted":"yes"},"title":"T","links":[{"label":"a","href":"about.html"}]}]}'],
      ['a column prototype',          '{"version":1,"columns":[{"prototype":{"polluted":"yes"},"title":"T","links":[{"label":"a","href":"about.html"}]}]}'],
      ['title is an object',          '{"version":1,"columns":[{"title":{"toString":"x"},"links":[{"label":"a","href":"about.html"}]}]}'],
      ['columns keyed constructor',   '{"version":1,"columns":{"constructor":1,"length":2}}']
    ];
    for (const [name, json] of POISON) {
      const r = await open(b, 'about.html', { footerJson: json });
      const clean = await r.p.evaluate(() => ({
        polluted: ({}).polluted,
        objPolluted: Object.prototype.polluted,
        arrPolluted: [].polluted,
        footers: document.querySelectorAll('footer.site-footer').length,
        cols: document.querySelectorAll('footer.site-footer .footer-col').length,
        titles: [...document.querySelectorAll('.footer-col-title')].map(t => t.textContent.trim())
      }));
      check(name + ': no prototype was polluted',
        clean.polluted === undefined && clean.objPolluted === undefined &&
        clean.arrPolluted === undefined, clean);
      check(name + ': the footer still rendered', clean.footers === 1 && clean.cols >= 3, clean);
      check(name + ': the page raised no error', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
    /* A title that is an object must not become "[object Object]" on the page. */
    const r = await open(b, 'about.html');
    const objTitle = await r.p.evaluate(() => CMS.footer.clean({ version: 1, columns: [
      { title: { a: 1 }, links: [{ label: 'x', href: 'about.html' }] },
      { title: 'Real', links: [{ label: { b: 2 }, href: 'about.html' }] }
    ] }));
    check('an object title does not become a usable title',
      objTitle === null || objTitle.every(c => c.title !== '[object Object]'), objTitle);
    await r.ctx.close();
  }

  /* ================================================================
     12. THE CAPS ARE ENFORCED IN THE SANITISER
     The admin also enforces them, but the admin is bypassable by an
     import, so the cap that matters is this one.
     ================================================================ */
  console.log('\n===== THE LIMITS HOLD EVEN WHEN THE UI IS BYPASSED =====');
  {
    const many = { version: 1, columns: [] };
    for (let i = 0; i < 50; i++) {
      const col = { id: 'c' + i, title: 'Col ' + i, enabled: true, links: [] };
      for (let j = 0; j < 100; j++) {
        col.links.push({ id: 'l' + i + '-' + j, label: 'Link ' + j, href: 'about.html', enabled: true });
      }
      many.columns.push(col);
    }
    const r = await open(b, 'about.html', { footerJson: JSON.stringify(many) });
    const s = await look(r.p);
    const lim = await r.p.evaluate(() => CMS.footer.limits);
    check('at most 6 navigation columns survive', lim.columns === 6, lim);
    check('and the page shows 6 plus brand and support', s.cols === 8, s.cols);
    check('at most 12 links per column survive',
      await r.p.evaluate(() =>
        [...document.querySelectorAll('[data-cms-footer] > .footer-col:not([data-footer-keep]) nav.footer-links')]
          .every(n => n.querySelectorAll('a').length === 12)), s.hrefs.length);
    check('so the whole footer is 6 x 12 links, plus support',
      s.hrefs.length === 6 * 12 + 2, s.hrefs.length);

    const long = await r.p.evaluate(() => CMS.footer.clean({ version: 1, columns: [{
      title: 'T'.repeat(200),
      links: [{ label: 'L'.repeat(200), href: 'about.html' }]
    }] }));
    check('a title is capped at 40 characters', long[0].title.length === 40, long[0].title.length);
    check('a label is capped at 60 characters',
      long[0].links[0].label.length === 60, long[0].links[0].label.length);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     13. ENABLE / DISABLE
     ================================================================ */
  console.log('\n===== HIDING A COLUMN OR A LINK =====');
  {
    const seed = JSON.stringify({ version: 1, columns: [
      { title: 'Shown', links: [
        { label: 'A', href: 'about.html' },
        { label: 'B', href: 'contact.html', enabled: false },
        { label: 'C', href: 'privacy-policy.html', enabled: true }
      ] },
      { title: 'Hidden', enabled: false, links: [{ label: 'D', href: 'login.html' }] },
      { title: 'Also shown', links: [{ label: 'E', href: 'register.html' }] }
    ] });
    const r = await open(b, 'about.html', { footerJson: seed });
    const s = await look(r.p);
    check('a disabled column contributes nothing',
      s.titles.join(',') === 'Shown,Also shown,Support', s.titles);
    check('a disabled link contributes nothing',
      s.cmsLabels.join(',') === 'A,C,E', s.cmsLabels);
    check('the disabled link href is not among the CMS links',
      s.cmsHrefs.indexOf('contact.html') === -1, s.cmsHrefs);
    check('enabled:true behaves like the default',
      s.cmsLabels.indexOf('C') > -1, s.cmsLabels);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     14. ORDER IS THE ARRAY ORDER
     Reordering in the admin is an array splice, so this is what
     reordering has to mean on the page.
     ================================================================ */
  console.log('\n===== ORDER FOLLOWS THE DATA =====');
  {
    const mk = order => JSON.stringify({ version: 1, columns: order.map(n => ({
      title: 'Col' + n, links: [{ label: 'L' + n, href: 'about.html' }] })) });
    for (const order of [[1, 2, 3], [3, 1, 2], [2, 3, 1]]) {
      const r = await open(b, 'about.html', { footerJson: mk(order) });
      const s = await look(r.p);
      check('columns render in data order ' + order.join(''),
        s.titles.join(',') === order.map(n => 'Col' + n).join(',') + ',Support', s.titles);
      await r.ctx.close();
    }
    const links = JSON.stringify({ version: 1, columns: [{ title: 'T', links: [
      { label: 'third', href: 'privacy-policy.html' },
      { label: 'first', href: 'about.html' },
      { label: 'second', href: 'contact.html' }
    ] }] });
    const r = await open(b, 'about.html', { footerJson: links });
    const s = await look(r.p);
    check('links render in data order',
      s.cmsLabels.join(',') === 'third,first,second', s.cmsLabels);
    await r.ctx.close();
  }

  /* ================================================================
     15. ACCESSIBILITY
     ================================================================ */
  console.log('\n===== THE RENDERED FOOTER IS NAVIGABLE =====');
  {
    for (const seed of [undefined, GOOD]) {
      const tag = seed === undefined ? 'fallback' : 'CMS';
      const r = await open(b, 'about.html', { footerJson: seed });
      const s = await look(r.p);
      check(tag + ': every footer nav has an accessible name',
        s.navLabels.length > 0 && s.navLabels.every(l => l && l.trim().length > 0), s.navLabels);
      check(tag + ': the nav name matches the heading above it',
        await r.p.evaluate(() =>
          [...document.querySelectorAll('[data-cms-footer] .footer-col')]
            .filter(c => c.querySelector('nav.footer-links'))
            .every(c => {
              const h = c.querySelector('.footer-col-title');
              const n = c.querySelector('nav.footer-links');
              return h && n && h.textContent.trim() === n.getAttribute('aria-label');
            })));
      check(tag + ': column titles are h2, so the outline is unchanged',
        await r.p.evaluate(() =>
          [...document.querySelectorAll('.footer-col-title')].every(t => t.tagName === 'H2')));
      check(tag + ': the page still has exactly one h1', s.h1s === 1, s.h1s);
      check(tag + ': every footer link has an accessible name',
        await r.p.evaluate(() =>
          [...document.querySelectorAll('footer.site-footer a')].every(a =>
            (a.textContent.trim() || a.getAttribute('aria-label') ||
             a.getAttribute('title') ||
             (a.querySelector('img[alt]') ? a.querySelector('img[alt]').getAttribute('alt') : '')
            ).trim().length > 0)));
      check(tag + ': a footer link can be focused and shows a ring',
        await r.p.evaluate(() => {
          const a = document.querySelector('footer.site-footer .footer-links a');
          a.focus();
          const cs = getComputedStyle(a);
          return document.activeElement === a &&
                 (cs.outlineStyle !== 'none' || cs.outlineWidth !== '0px' ||
                  cs.boxShadow !== 'none' || cs.textDecorationLine !== 'none');
        }));
      check(tag + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  /* ================================================================
     16. RESPONSIVE
     ================================================================ */
  console.log('\n===== THE CMS FOOTER AT EVERY WIDTH =====');
  {
    for (const [w, h, label] of [[1280, 900, 'desktop 1280'], [900, 900, 'tablet 900'],
                                 [768, 900, 'tablet 768'], [390, 844, 'mobile 390'],
                                 [375, 812, 'mobile 375']]) {
      /* A six-column footer is the worst case the caps allow. */
      const six = JSON.stringify({ version: 1, columns:
        [1, 2, 3, 4, 5, 6].map(n => ({ title: 'Column ' + n, links:
          [1, 2, 3].map(m => ({ label: 'A fairly long link label ' + m, href: 'about.html' })) })) });
      const r = await open(b, 'about.html', { footerJson: six, w, h });
      const m = await r.p.evaluate(() => {
        const ft = document.querySelector('footer.site-footer');
        const host = document.querySelector('[data-cms-footer]');
        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          footPos: getComputedStyle(ft).position,
          cols: host.querySelectorAll('.footer-col').length,
          overflowing: [...host.querySelectorAll('.footer-col')]
            .filter(c => c.getBoundingClientRect().right > window.innerWidth + 1).length,
          widest: Math.max(...[...host.querySelectorAll('.footer-col')]
            .map(c => Math.round(c.getBoundingClientRect().width)))
        };
      });
      check(label + ': no horizontal overflow', m.scrollW <= m.clientW, m);
      check(label + ': the footer is not fixed',
        m.footPos === 'static' || m.footPos === 'relative', m.footPos);
      check(label + ': all eight columns are present', m.cols === 8, m.cols);
      check(label + ': no column runs off the right edge', m.overflowing === 0, m);
      check(label + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  /* ================================================================
     17. THE GENERATOR
     ================================================================ */
  console.log('\n===== THE GENERATOR STILL OWNS THE SHIPPED FOOTER =====');
  {
    let code = 0;
    try { execFileSync('node', [path.join(ROOT, 'tools', 'build-shell.js'), '--check'],
      { cwd: ROOT, stdio: 'pipe' }); } catch (e) { code = 1; }
    check('the shell in the files is up to date', code === 0);

    const before = SHELL_PAGES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    execFileSync('node', [path.join(ROOT, 'tools', 'build-shell.js')], { cwd: ROOT, stdio: 'pipe' });
    const after = SHELL_PAGES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    check('running it again changes nothing',
      before.every((s, i) => s === after[i]));

    /* One footer region, and it is the same in every page. */
    const regions = SHELL_PAGES.map(f => {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const a = raw.indexOf('<!-- SHELL:FOOTER -->');
      const z = raw.indexOf('<!-- /SHELL:FOOTER -->');
      return raw.slice(a, z);
    });
    check('the footer region is identical in all six pages',
      regions.every(r => r === regions[0]));
    check('and it contains exactly one mount element',
      regions[0].split('<div class="footer-cols" data-cms-footer>').length - 1 === 1);
    check('and exactly one brand and one support marker',
      regions[0].split('data-footer-keep="brand"').length - 1 === 1 &&
      regions[0].split('data-footer-keep="support"').length - 1 === 1);
  }

  /* ================================================================
     18. A GENERATED PAGE CARRIES THE SAME FALLBACK
     ================================================================ */
  console.log('\n===== A PAGE MADE IN THE ADMIN GETS THE SAME FOOTER =====');
  {
    const { ctx, p, errs } = await adminCtx(b);

    const html = await p.evaluate(async () => {
      const r = await fetch('../about.html', { cache: 'no-cache' });
      const src = await r.text();
      const cut = name => {
        const o = '<!-- SHELL:' + name + ' -->', c = '<!-- /SHELL:' + name + ' -->';
        const a = src.indexOf(o), b = src.indexOf(c);
        return a === -1 || b === -1 ? null : src.slice(a + o.length, b);
      };
      return cut('FOOTER');
    });
    check('the admin can read the footer region out of a live page',
      typeof html === 'string' && html.length > 200);
    check('and that region carries the crawlable fallback links',
      html && STATIC_HREFS.every(h => html.includes('href="' + h + '"')));
    check('and the mount, so the CMS can take over on the new page',
      html && html.indexOf('data-cms-footer') > -1);
    check('and the brand and support markers',
      html && html.indexOf('data-footer-keep="brand"') > -1 &&
      html.indexOf('data-footer-keep="support"') > -1);
    check('no admin page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     19. THE ADMIN PANEL
     ================================================================ */
  console.log('\n===== THE ADMIN FOOTER PANEL =====');
  {
    const { ctx, p, errs } = await adminCtx(b);

    check('the Footer nav item exists',
      await p.isVisible('.adm-nav-item[data-panel="footer"]'));
    await p.click('.adm-nav-item[data-panel="footer"]');
    await p.waitForTimeout(350);
    check('the Footer panel opens', await p.isVisible('#panel-footer'));

    /* Every other panel is still there. */
    const panels = await p.$$eval('.adm-panel', e => e.map(x => x.id));
    check('every pre-existing panel is still present',
      ['themes', 'branding', 'colors', 'typography', 'text', 'auth', 'images', 'home',
       'seo', 'pages', 'sportstable', 'presets', 'data', 'reset', 'builder', 'design']
        .every(x => panels.includes('panel-' + x)), panels);

    const shape = await p.evaluate(() => ({
      cols: document.querySelectorAll('#footerCols .ft-col').length,
      titles: [...document.querySelectorAll('#footerCols .ft-title')].map(i => i.value),
      links: [...document.querySelectorAll('#footerCols .ft-col')]
        .map(c => c.querySelectorAll('.ft-link').length),
      count: document.getElementById('cntFooterCols').textContent,
      about: document.getElementById('ftAbout').value,
      copy: document.getElementById('ftCopyright').value,
      maxCols: document.getElementById('ftMaxCols').textContent,
      maxLinks: document.getElementById('ftMaxLinks').textContent
    }));
    check('it lists the two shipped columns', shape.cols === 2, shape);
    check('with their titles', shape.titles.join(',') === 'Important Links,Account', shape.titles);
    check('and their links', shape.links.join(',') === '5,2', shape.links);
    check('the count pill agrees', shape.count === '2', shape.count);
    check('the description box is pre-filled from text[footer.about]',
      shape.about.length > 10, shape.about);
    check('the copyright box is pre-filled', shape.copy.indexOf('Copyright') > -1, shape.copy);
    check('the limits are shown to the editor',
      shape.maxCols === '6' && shape.maxLinks === '12', shape);

    /* ---- the page picker ---- */
    const pick = await p.$$eval('#footerCols .ft-pick:first-of-type option',
      o => o.map(x => x.value));
    check('the picker offers the site root', pick.includes('./'), pick);
    check('the picker offers the real pages',
      ['about.html', 'contact.html', 'responsible-gaming.html', 'privacy-policy.html']
        .every(h => pick.includes(h)), pick);
    check('the picker offers the account pages',
      pick.includes('login.html') && pick.includes('register.html'), pick);
    check('the picker offers a custom URL', pick.includes('__custom'), pick);

    /* ---- live URL validation ---- */
    const firstUrl = '#footerCols .ft-col:nth-child(1) .ft-link:nth-child(1) .ft-url';
    await p.fill(firstUrl, 'javascript:alert(1)');
    await p.waitForTimeout(150);
    const badState = await p.evaluate(sel => {
      const i = document.querySelector(sel);
      const note = i.closest('.ft-link').querySelector('.ft-url-note');
      return { bad: i.classList.contains('bad'), note: note.textContent,
               noteBad: note.className.indexOf('bad') > -1 };
    }, firstUrl);
    check('a hostile URL is flagged in the panel', badState.bad === true, badState);
    check('and says why', badState.note.length > 10 && badState.noteBad === true, badState);

    await p.fill(firstUrl, 'https://example.com/x');
    await p.waitForTimeout(150);
    const extState = await p.evaluate(sel => {
      const i = document.querySelector(sel);
      const note = i.closest('.ft-link').querySelector('.ft-url-note');
      return { bad: i.classList.contains('bad'), note: note.textContent };
    }, firstUrl);
    check('an external https URL is accepted', extState.bad === false, extState);
    check('and the panel says it will carry noopener',
      /noopener/.test(extState.note), extState);

    await p.fill(firstUrl, './');
    await p.waitForTimeout(150);
    check('the site root is accepted',
      await p.evaluate(sel => !document.querySelector(sel).classList.contains('bad'), firstUrl));

    /* ---- add / delete / reorder, all through the UI ---- */
    await p.click('#btnAddFooterCol'); await p.waitForTimeout(250);
    check('adding a column adds it',
      await p.$$eval('#footerCols .ft-col', e => e.length) === 3);
    check('the new column has a title and one link',
      await p.evaluate(() => {
        const c = document.querySelectorAll('#footerCols .ft-col')[2];
        return c.querySelector('.ft-title').value.length > 0 &&
               c.querySelectorAll('.ft-link').length === 1;
      }));
    check('and the count pill follows',
      await p.evaluate(() => document.getElementById('cntFooterCols').textContent) === '3');
    check('the dirty flag is set', await p.evaluate(() =>
      document.getElementById('savedFlag').className.indexOf('dirty') > -1));

    await p.click('#footerCols .ft-col:nth-child(3) .ft-add-link');
    await p.waitForTimeout(250);
    check('adding a link adds it',
      await p.evaluate(() => document.querySelectorAll(
        '#footerCols .ft-col:nth-child(3) .ft-link').length) === 2);

    /* Renaming a column writes through to the data. */
    await p.fill('#footerCols .ft-col:nth-child(3) .ft-title', 'Renamed Column');
    await p.waitForTimeout(150);
    check('renaming a column title writes through',
      await p.evaluate(() => CMS.data().footer.columns[2].title) === 'Renamed Column');
    check('and a title cannot exceed the cap through the input',
      await p.evaluate(() => document.querySelector(
        '#footerCols .ft-col:nth-child(3) .ft-title').getAttribute('maxlength')) === '40');
    check('nor a label',
      await p.evaluate(() => document.querySelector(
        '#footerCols .ft-col:nth-child(3) .ft-label').getAttribute('maxlength')) === '60');

    /* Hiding a column through its checkbox. */
    await p.uncheck('#footerCols .ft-col:nth-child(3) .ft-col-head .ft-on');
    await p.waitForTimeout(150);
    check('unticking a column disables it in the data',
      await p.evaluate(() => CMS.data().footer.columns[2].enabled) === false);
    check('and the row is dimmed rather than removed',
      await p.evaluate(() => {
        const c = document.querySelectorAll('#footerCols .ft-col')[2];
        return c.classList.contains('off') && c.querySelectorAll('.ft-link').length === 2;
      }));
    await p.check('#footerCols .ft-col:nth-child(3) .ft-col-head .ft-on');
    await p.waitForTimeout(150);
    check('and re-ticking it enables it again',
      await p.evaluate(() => CMS.data().footer.columns[2].enabled) === true);

    /* Hiding a single link. */
    await p.uncheck('#footerCols .ft-col:nth-child(3) .ft-link:nth-child(1) .ft-on');
    await p.waitForTimeout(150);
    check('unticking a link disables it in the data',
      await p.evaluate(() => CMS.data().footer.columns[2].links[0].enabled) === false);
    await p.check('#footerCols .ft-col:nth-child(3) .ft-link:nth-child(1) .ft-on');
    await p.waitForTimeout(150);

    /* Reorder, by driving the drag handlers the way a real drag does.
       These are the listeners the panel installs, so this exercises the
       reorder code rather than standing in for it. */
    const beforeOrder = await p.$$eval('#footerCols .ft-title', e => e.map(i => i.value));
    await p.evaluate(() => {
      const cols = [...document.querySelectorAll('#footerCols .ft-col')];
      const dt = new DataTransfer();
      const fire = (node, type) => node.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(cols[0].querySelector('.ft-col-head'), 'dragstart');
      fire(cols[2], 'dragover');
      fire(cols[2], 'drop');
    });
    await p.waitForTimeout(250);
    const afterOrder = await p.$$eval('#footerCols .ft-title', e => e.map(i => i.value));
    check('dragging a column onto a later one reorders it',
      afterOrder.join(',') === [beforeOrder[1], beforeOrder[2], beforeOrder[0]].join(','),
      { beforeOrder, afterOrder });
    check('and the data is in that order too',
      await p.evaluate(() => CMS.data().footer.columns.map(c => c.title)).then(
        t => t.join(',')) === afterOrder.join(','));

    const linksBefore = await p.$$eval(
      '#footerCols .ft-col:nth-child(3) .ft-label', e => e.map(i => i.value));
    await p.evaluate(() => {
      const rows = [...document.querySelectorAll('#footerCols .ft-col:nth-child(3) .ft-link')];
      const dt = new DataTransfer();
      const fire = (node, type) => node.dispatchEvent(
        new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      fire(rows[0], 'dragstart');
      fire(rows[1], 'dragover');
      fire(rows[1], 'drop');
    });
    await p.waitForTimeout(250);
    const linksAfter = await p.$$eval(
      '#footerCols .ft-col:nth-child(3) .ft-label', e => e.map(i => i.value));
    check('dragging a link reorders within its column',
      linksBefore.length >= 2 &&
      linksAfter.join(',') ===
        [linksBefore[1], linksBefore[0]].concat(linksBefore.slice(2)).join(','),
      { linksBefore, linksAfter });

    /* ---- the cap, reached through the UI ---- */
    for (let i = 0; i < 8; i++) {
      const off = await p.evaluate(() => document.getElementById('btnAddFooterCol').disabled);
      if (off) break;
      await p.click('#btnAddFooterCol');
      await p.waitForTimeout(160);
    }
    const atCap = await p.evaluate(() => ({
      cols: document.querySelectorAll('#footerCols .ft-col').length,
      disabled: document.getElementById('btnAddFooterCol').disabled,
      title: document.getElementById('btnAddFooterCol').title
    }));
    check('the UI stops at six columns', atCap.cols === 6, atCap);
    check('and the add button is disabled and says why',
      atCap.disabled === true && atCap.title.length > 5, atCap);
    /* Re-enable it and click it anyway: the handler, not the attribute,
       has to be what holds the cap. p.click() would wait for the button
       to become enabled, so the event is dispatched directly. */
    await p.evaluate(() => {
      const btn = document.getElementById('btnAddFooterCol');
      btn.disabled = false;
      btn.click();
    });
    await p.waitForTimeout(250);
    check('and forcing the disabled button is refused by the handler',
      await p.evaluate(() => CMS.data().footer.columns.length) === 6,
      await p.evaluate(() => CMS.data().footer.columns.length));

    /* ---- the link cap, reached through the UI ---- */
    const linkAdd = '#footerCols .ft-col:nth-child(6) .ft-add-link';
    for (let i = 0; i < 12; i++) {
      const done = await p.evaluate(sel => document.querySelector(sel).disabled, linkAdd);
      if (done) break;
      await p.click(linkAdd);
      await p.waitForTimeout(120);
    }
    const linkCap = await p.evaluate(() => ({
      n: CMS.data().footer.columns[5].links.length,
      disabled: document.querySelector('#footerCols .ft-col:nth-child(6) .ft-add-link').disabled
    }));
    check('a column stops at twelve links', linkCap.n === 12, linkCap);
    check('and its add button is disabled there', linkCap.disabled === true, linkCap);
    await p.evaluate(() => {
      const btn = document.querySelector('#footerCols .ft-col:nth-child(6) .ft-add-link');
      btn.disabled = false;
      btn.click();
    });
    await p.waitForTimeout(250);
    check('and forcing that one past twelve is refused too',
      await p.evaluate(() => CMS.data().footer.columns[5].links.length) === 12,
      await p.evaluate(() => CMS.data().footer.columns[5].links.length));

    /* ---- delete ---- */
    p.once('dialog', d => d.accept());
    await p.click('#footerCols .ft-col:nth-child(1) .del');
    await p.waitForTimeout(300);
    check('deleting a column removes it',
      await p.$$eval('#footerCols .ft-col', e => e.length) === 5);
    check('and the add button is live again',
      await p.evaluate(() => document.getElementById('btnAddFooterCol').disabled) === false);

    const nLinks = await p.$$eval('#footerCols .ft-col:nth-child(1) .ft-link', e => e.length);
    await p.click('#footerCols .ft-col:nth-child(1) .ft-link:nth-child(1) .del');
    await p.waitForTimeout(250);
    check('deleting a link removes it',
      await p.$$eval('#footerCols .ft-col:nth-child(1) .ft-link', e => e.length) === nLinks - 1);

    /* ---- the description and copyright write through to text ---- */
    await p.fill('#ftAbout', 'A new footer description for the audit.');
    await p.waitForTimeout(150);
    check('the description writes into text[footer.about]',
      await p.evaluate(() => CMS.data().text['footer.about']) ===
      'A new footer description for the audit.');
    await p.fill('#ftCopyright', '© 2026 Someone.');
    await p.waitForTimeout(150);
    check('the copyright writes into text[footer.copyright]',
      await p.evaluate(() => CMS.data().text['footer.copyright']) === '© 2026 Someone.');
    check('and the Texts panel shows the same value, not a copy',
      await p.evaluate(() => {
        const f = [...document.querySelectorAll('#textFields .f')]
          .find(x => x.getAttribute('data-key') === 'footer.about');
        return f ? f.querySelector('textarea, input').value : null;
      }) === 'A new footer description for the audit.');
    check('the Texts panel labels the description properly',
      await p.evaluate(() => {
        const f = [...document.querySelectorAll('#textFields .f')]
          .find(x => x.getAttribute('data-key') === 'footer.about');
        return f ? f.textContent.indexOf('Footer description') > -1 : false;
      }));

    /* ---- the honest note about the fallback ---- */
    const note = await p.evaluate(() =>
      document.getElementById('footerFallbackNote').textContent);
    check('the panel explains what the page will actually show',
      note.length > 20, note);

    check('no admin page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     20. SAVE AND RELOAD
     ================================================================ */
  console.log('\n===== AN EDIT SURVIVES A RELOAD AND REACHES A PAGE =====');
  {
    const { ctx, p, errs } = await adminCtx(b);
    await p.click('.adm-nav-item[data-panel="footer"]');
    await p.waitForTimeout(300);

    await p.evaluate(() => {
      CMS.data().footer = { version: 1, columns: [
        { id: 'k1', title: 'Saved Column', enabled: true, links: [
          { id: 'k1a', label: 'Saved Link', href: 'privacy-policy.html', enabled: true }] }
      ] };
      CMS.save();
    });
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem('whiteLabelCMS')).footer.columns[0].title);
    check('the edit is written to storage', stored === 'Saved Column', stored);

    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    if (await p.isVisible('#authGate')) {
      await p.fill('#authEmail', 'a@b.c');
      await p.fill('#authPass', 'x');
      await p.click('#authBtn');
      await p.waitForTimeout(500);
    }
    await p.click('.adm-nav-item[data-panel="footer"]');
    await p.waitForTimeout(300);
    const reloaded = await p.$$eval('#footerCols .ft-title', e => e.map(i => i.value));
    check('and the panel shows it again after a reload',
      reloaded.join(',') === 'Saved Column', reloaded);

    /* The same browser profile now opens a public page. */
    const pub = await ctx.newPage();
    await pub.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await pub.waitForTimeout(300);
    const s = await look(pub);
    check('the public page shows the saved column',
      s.titles.join(',') === 'Saved Column,Support', s.titles);
    check('and the saved link',
      s.cmsHrefs.join(',') === 'privacy-policy.html', s.cmsHrefs);
    check('no errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     21. SEO
     ================================================================ */
  console.log('\n===== SEO IS UNCHANGED =====');
  {
    const r = await open(b, 'about.html', { footerJson: GOOD });
    const s = await look(r.p);
    const seo = await r.p.evaluate(() => ({
      jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(n => n.textContent),
      canon: (document.querySelector('link[rel=canonical]') || {}).href,
      robots: (document.querySelector('meta[name=robots]') || {}).content,
      hiddenFooterText: [...document.querySelectorAll('footer.site-footer .footer-links a')]
        .filter(a => {
          const cs = getComputedStyle(a);
          return cs.display === 'none' || cs.visibility === 'hidden' ||
                 Number(cs.opacity) === 0 || cs.fontSize === '0px';
        }).length
    }));
    check('no footer link is hidden text', seo.hiddenFooterText === 0, seo.hiddenFooterText);
    check('no structured data mentions a footer link',
      seo.jsonLd.every(t => t.indexOf('gamblingcommission') === -1 &&
                            t.indexOf('Cricket') === -1), seo.jsonLd.length);
    check('the canonical is untouched', /about\.html$/.test(seo.canon || ''), seo.canon);
    check('robots is untouched', /index/.test(seo.robots || ''), seo.robots);
    check('the heading outline is unchanged: titles are h2', s.titles.length === 3, s.titles);
    check('one h1', s.h1s === 1, s.h1s);
    await r.ctx.close();

    /* The sitemap must not learn about footer links. */
    const sm = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const locs = (sm.match(/<loc>([^<]*)<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
    check('the sitemap still has exactly five URLs', locs.length === 5, locs);
    check('and no external footer link crept in',
      locs.every(l => l.indexOf('jsk-1.com') > -1), locs);
    check('and login/register/admin are still out',
      !locs.some(l => /login|register|admin/.test(l)), locs);
    const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
    check('robots.txt still disallows /admin/', robots.indexOf('Disallow: /admin/') > -1);
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
