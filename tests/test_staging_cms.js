#!/usr/bin/env node
/* =====================================================================
   THE STAGING SITE AND ITS CMS, AT ITS REAL HOSTNAME  (Phase 8)
   ---------------------------------------------------------------------
   Everything about Playzone9 staging depends on one thing that cannot be
   checked by reading files: what happens when a browser is actually on
   https://playzones9.com. The hostname is what selects the brand, so
   serving the build on localhost tests the FALLBACK path and tells you
   nothing about the real one.

   So this suite serves the built staging directory AT that origin --
   every request fulfilled from disk, nothing over the network -- and
   then inspects what a reviewer would see and what the admin would do.
   No DNS, no host, no deployment required: if the site works here it
   works when the domain is pointed at it, because this is the same
   bytes on the same origin.

   What it proves:
     - the hostname resolves to the Playzone9 STAGING row, not to JSK1's
       and not to the reserved production one;
     - the admin is reachable at /admin/, says which brand and row it is
       editing, and the Phase 7 write guard is live;
     - every CMS capability Phase 8 lists is present and addressable;
     - the staging SEO state holds at the real origin, after scripts run;
     - playzone9.app appears nowhere a visitor or crawler can see it.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SITE = require(path.join(ROOT, 'tools', 'lib', 'sitekit.js'));
const SHELL = require(path.join(__dirname, 'lib', 'pbshell.js'));
const PROD_BRANDS = path.join(ROOT, 'brands');
const TEMPLATES = path.join(ROOT, 'templates');

const BRAND = 'playzone9.app';
const STAGING = 'playzones9.com';
const PROD = 'playzone9.app';
const ORIGIN = 'https://' + STAGING;

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

const tmpRoots = [];
function buildStaging() {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-'));
  tmpRoots.push(out);
  const s = SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT,
                            id: BRAND, env: 'staging' });
  const r = SITE.assemble(s, out);
  return { s, dir: r.dir, v: SITE.verify(s, r.dir) };
}

/* Serves the built directory AT the staging origin. Requests to anything
   else are refused rather than allowed out, so a test can never silently
   depend on the network -- and so a page that reaches for the production
   domain is visible as a refusal instead of passing unnoticed. */
/* The site legitimately loads two third-party stylesheets (Google Fonts and
   Font Awesome) and talks to Supabase. Those are expected and are recorded
   as such. What must NEVER be requested is the reserved production domain --
   a request to it would mean the staging build is pulling from, or pointing
   at, the site that is not supposed to exist yet. */
const ALLOWED_OFF_ORIGIN = [/^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//,
  /^https:\/\/cdnjs\.cloudflare\.com\//, /supabase\.co\//];

function serveAtOrigin(ctx, dir, log) {
  return ctx.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(ORIGIN + '/')) {
      if (url.indexOf(PROD) > -1) log.production.push(url);
      else if (!ALLOWED_OFF_ORIGIN.some(re => re.test(url))) log.offOrigin.push(url);
      else log.thirdParty.push(url);
      return route.fulfill({ status: 204, body: '' });
    }
    let rel = decodeURIComponent(url.slice(ORIGIN.length).split('?')[0].split('#')[0])
      .replace(/^\/+/, '');
    if (rel === '' || rel.endsWith('/')) rel += 'index.html';
    const full = path.join(dir, rel);
    if (!full.startsWith(dir + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      log.missing.push(rel);
      return route.fulfill({ status: 404, contentType: 'text/html', body: 'not found' });
    }
    log.served.push(rel);
    return route.fulfill({ status: 200, contentType: TYPES[path.extname(full)] || 'application/octet-stream',
                           body: fs.readFileSync(full) });
  });
}

(async () => {
  const staging = buildStaging();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. THE BUILD IS DEPLOYABLE
     ================================================================== */
  console.log('\n===== THE STAGING BUILD IS READY TO SERVE =====');
  check('it assembled and passed its own checks',
    staging.v.problems.length === 0 && staging.v.files.length > 0, staging.v.problems);
  check('it carries a CNAME, so a Pages host claims the right domain',
    staging.v.files.includes('CNAME'));
  const cname = fs.readFileSync(path.join(staging.dir, 'CNAME'), 'utf8');
  check('and that CNAME names ONLY the staging host',
    cname.trim() === STAGING && cname.indexOf(PROD) === -1, cname.trim());
  check('it has an entry page', staging.v.files.includes('index.html'));
  check('and an admin', staging.v.files.includes('admin/index.html'));

  /* The production build must not carry one. A CNAME claiming the reserved
     domain is the single file that would start serving it. */
  {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-prod-'));
    tmpRoots.push(out);
    const p = SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: BRAND });
    SITE.assemble(p, out);
    const v = SITE.verify(p, path.join(out, p.plan.brand.output));
    check('the brand\'s canonical-domain build carries NO CNAME', !v.files.includes('CNAME'), v.files.filter(f => /CNAME/.test(f)));
    check('the environment overlay is what keeps it out',
      p.overlay.indexOf('CNAME') === -1 && staging.s.overlay.indexOf('CNAME') > -1,
      [p.overlay, staging.s.overlay]);
  }
  {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-jsk1-'));
    tmpRoots.push(out);
    const p = SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: 'jsk-1.com' });
    SITE.assemble(p, out);
    const v = SITE.verify(p, path.join(out, p.plan.brand.output));
    check('and JSK1\'s build carries no CNAME either, so its deploy is untouched',
      !v.files.includes('CNAME'));
  }

  /* The overlay ORDER, on a scratch brand rather than by shipping a fixture
     to justify it: the environment's files must win over the brand's, or a
     host-specific file could not replace a brand-level one. */
  console.log('\n===== THE ENVIRONMENT OVERLAY WINS OVER THE BRAND\'S =====');
  {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-order-'));
    tmpRoots.push(scratch);
    const dir = path.join(scratch, 'order.test');
    fs.mkdirSync(path.join(dir, 'static'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'static-staging'), { recursive: true });
    for (const f of ['brand.js', 'seo-config.json']) {
      fs.copyFileSync(path.join(PROD_BRANDS, BRAND, f), path.join(dir, f));
    }
    const cfg = JSON.parse(fs.readFileSync(path.join(PROD_BRANDS, BRAND, 'brand.json'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify(Object.assign({}, cfg, {
      id: 'order.test', domain: 'order.test', output: 'order.test', siteId: 'order-row',
      environments: { staging: { host: 'stage.order.test', siteId: 'order-stage', noindex: true } }
    }), null, 2));
    /* The same path from both overlays, and one only the environment has. */
    fs.writeFileSync(path.join(dir, 'static', 'shared-and-env.txt'), 'from the brand');
    fs.writeFileSync(path.join(dir, 'static-staging', 'shared-and-env.txt'), 'from the environment');
    fs.writeFileSync(path.join(dir, 'static-staging', 'env-only.txt'), 'env only');

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-order-out-'));
    tmpRoots.push(out);
    const st = SITE.planSite({ brandsDir: scratch, templatesDir: TEMPLATES, sharedRoot: ROOT,
                               id: 'order.test', env: 'staging' });
    SITE.assemble(st, out);
    const d = path.join(out, 'stage.order.test');
    check('both overlay directories were read', st.overlayDirs.length === 2, st.overlayDirs.length);
    check('a file only the environment has is published',
      fs.existsSync(path.join(d, 'env-only.txt')));
    check('and where both provide the same path, the ENVIRONMENT wins',
      fs.readFileSync(path.join(d, 'shared-and-env.txt'), 'utf8') === 'from the environment',
      fs.readFileSync(path.join(d, 'shared-and-env.txt'), 'utf8'));

    /* The canonical build of the same brand sees only the brand's overlay. */
    const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'p8-order-prod-'));
    tmpRoots.push(out2);
    const pr = SITE.planSite({ brandsDir: scratch, templatesDir: TEMPLATES, sharedRoot: ROOT,
                               id: 'order.test' });
    SITE.assemble(pr, out2);
    const d2 = path.join(out2, 'order.test');
    check('the canonical build reads only the brand overlay', pr.overlayDirs.length === 1,
      pr.overlayDirs.length);
    check('so it gets the brand\'s version of the shared path',
      fs.readFileSync(path.join(d2, 'shared-and-env.txt'), 'utf8') === 'from the brand',
      fs.readFileSync(path.join(d2, 'shared-and-env.txt'), 'utf8'));
    check('and never sees the environment-only file',
      !fs.existsSync(path.join(d2, 'env-only.txt')));
  }

  /* ==================================================================
     2. THE SITE, AT https://playzones9.com
     ================================================================== */
  console.log('\n===== A VISITOR ON THE REAL HOSTNAME =====');
  const log = { served: [], missing: [], offOrigin: [], thirdParty: [], production: [] };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await serveAtOrigin(ctx, staging.dir, log);
  const errs = [];
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));

  await page.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const home = await page.evaluate(() => ({
    host: location.hostname,
    title: document.title,
    brandName: window.CMS && CMS.get('branding.siteName', ''),
    baseUrl: window.CMS && CMS.get('seo.baseUrl', ''),
    siteId: (window.CMS_REMOTE || {}).siteId,
    bucket: (window.CMS_MEDIA || {}).bucket,
    storage: (window.CMS_STORAGE || {}).suffix,
    matched: (window.CMS_BRAND_RESOLVED || {}).matched,
    noindex: window.CMS_NOINDEX === true,
    robots: (document.querySelector('meta[name="robots"]') || {}).content,
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href,
    ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content,
    favicon: (document.querySelector('link[rel="icon"]') || {}).href,
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(s => { try { return JSON.parse(s.textContent).url; } catch (e) { return 'unparsed'; } }),
    html: document.documentElement.outerHTML,
    /* what a reviewer is here to look at */
    header: !!document.querySelector('.site-header, header'),
    nav: document.querySelectorAll('nav a, .nav a').length,
    footer: !!document.querySelector('footer, .site-footer'),
    images: document.querySelectorAll('img').length,
    h1: document.querySelectorAll('h1').length,
    brandCss: !!document.querySelector('link[href$="css/brand.css"]'),
    headerBg: getComputedStyle(document.querySelector('.site-header, header') || document.body)
      .backgroundColor,
    bodyFont: getComputedStyle(document.body).fontFamily
  }));

  check('the page loaded with no script errors', errs.length === 0, errs);
  check('the browser really is on the staging hostname', home.host === STAGING, home.host);
  check('NOTHING was requested from the reserved production domain',
    log.production.length === 0, log.production.slice(0, 4));
  check('the only off-origin requests are the known CDNs and Supabase',
    log.offOrigin.length === 0, log.offOrigin.slice(0, 4));
  check('and those were actually attempted, so the allowance is not vacuous',
    log.thirdParty.length > 0, log.thirdParty.length);
  check('nothing on this origin 404ed', log.missing.length === 0, log.missing.slice(0, 6));
  check('the CMS resolved the brand to Playzone9', home.brandName === 'Playzone9', home.brandName);
  check('the hostname MATCHED a registered brand', home.matched === true);
  check('it resolved the STAGING row', home.siteId === 'playzone9staging', home.siteId);
  check('not JSK1\'s row', home.siteId !== 'playzone9');
  check('not the reserved production row', home.siteId !== 'playzone9app');
  check('it resolved the staging media bucket',
    home.bucket === 'cms-media-pz9-staging', home.bucket);
  check('and its own browser-storage namespace',
    home.storage === ':playzone9staging', home.storage);

  console.log('\n===== WHAT A REVIEWER CAN LOOK AT =====');
  check('the title names Playzone9', /Playzone9/.test(home.title), home.title);
  check('there is a header', home.header);
  check('navigation has links', home.nav > 5, home.nav);
  check('there is a footer', home.footer);
  check('images are on the page', home.images > 10, home.images);
  check('exactly one H1', home.h1 === 1, home.h1);
  check('the brand stylesheet is loaded', home.brandCss);
  check('the header has a painted background colour',
    /^rgb/.test(home.headerBg) && home.headerBg !== 'rgba(0, 0, 0, 0)', home.headerBg);
  check('typography resolves to a real family', (home.bodyFont || '').length > 2, home.bodyFont);
  check('the favicon is served from this origin',
    (home.favicon || '').startsWith(ORIGIN), home.favicon);

  console.log('\n===== THE STAGING SEO STATE, AFTER SCRIPTS RAN =====');
  check('the deployment is flagged noindex', home.noindex === true);
  check('robots is noindex,nofollow', /noindex/.test(home.robots || '') && /nofollow/.test(home.robots || ''),
    home.robots);
  check('canonical is self, on the staging host',
    home.canonical === ORIGIN + '/', home.canonical);
  check('canonical is NOT the production domain', (home.canonical || '').indexOf(PROD) === -1);
  check('og:url is the staging host', (home.ogUrl || '').startsWith(ORIGIN), home.ogUrl);
  check('every JSON-LD url is the staging host',
    home.ld.length > 0 && home.ld.every(u => String(u).startsWith(ORIGIN)), home.ld);
  /* The properties that matter. Prose that names the production domain is
     recorded separately below: it is not a link, not a canonical and not
     indexable, but it IS the brand's copy naming a domain that is not this
     one, so it is reported rather than asserted away. */
  const prodRefs = await page.evaluate(() => ({
    links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'))
      .filter(h => h && h.indexOf('playzone9.app') > -1),
    resources: [...document.querySelectorAll('[src], link[href]')]
      .map(e => e.getAttribute('src') || e.getAttribute('href'))
      .filter(h => h && h.indexOf('playzone9.app') > -1),
    metaUrls: [...document.querySelectorAll('meta[property="og:url"], link[rel="canonical"]')]
      .map(e => e.getAttribute('content') || e.getAttribute('href'))
      .filter(h => h && h.indexOf('playzone9.app') > -1),
    proseCount: (document.body.textContent.match(/playzone9\.app/g) || []).length
  }));
  check('NO link points at the production domain', prodRefs.links.length === 0, prodRefs.links);
  check('NO stylesheet, script or image is loaded from it', prodRefs.resources.length === 0,
    prodRefs.resources);
  check('NO canonical or og:url names it', prodRefs.metaUrls.length === 0, prodRefs.metaUrls);
  check('and nothing rendered mentions JSK1', !/JSK1|jsk-1\.com/.test(home.html));
  check('robots.txt blocks everything', (await (await page.goto(ORIGIN + '/robots.txt')).text()).includes('Disallow: /'));
  const smap = await page.goto(ORIGIN + '/sitemap.xml');
  check('there is no sitemap to crawl', smap.status() === 404, smap.status());

  /* Every page a reviewer will click, at the real origin. */
  console.log('\n===== EVERY PAGE, INCLUDING LOGIN AND REGISTER =====');
  {
    const PAGES = ['index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
      'privacy-policy.html', 'responsible-gaming.html', '404.html'];
    let ok = 0; const prose = [];
    for (const f of PAGES) {
      await page.goto(ORIGIN + '/' + f, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(250);
      const v = await page.evaluate(() => ({
        robots: (document.querySelector('meta[name="robots"]') || {}).content,
        canonical: (document.querySelector('link[rel="canonical"]') || {}).href || '',
        title: document.title,
        brandCss: !!document.querySelector('link[href$="css/brand.css"]'),
        body: document.body.innerHTML.length,
        jsk1: /JSK1|jsk-1\.com/.test(document.documentElement.outerHTML),
        prodLinks: [...document.querySelectorAll('a[href], [src]')]
          .map(e => e.getAttribute('href') || e.getAttribute('src'))
          .filter(h => h && h.indexOf('playzone9.app') > -1).length,
        prose: (document.body.textContent.match(/playzone9\.app/g) || []).length
      }));
      const noidx = /noindex/.test(v.robots || '');
      const selfCanon = v.canonical === '' || v.canonical.startsWith(ORIGIN);
      if (noidx && selfCanon && v.brandCss && v.body > 500 && !v.jsk1 && v.prodLinks === 0 &&
          /Playzone9/.test(v.title)) { ok++; if (v.prose) prose.push(f + ' x' + v.prose); }
      else check(f + ': noindex=' + noidx + ' selfCanonical=' + selfCanon + ' brandCss=' + v.brandCss +
        ' rendered=' + v.body + ' jsk1=' + v.jsk1 + ' prodLinks=' + v.prodLinks +
        ' title=' + v.title, false);
    }
    check('all eight pages render, are noindex, self-canonical, branded, link nowhere ' +
      'near production and carry no JSK1 content', ok === PAGES.length && ok === 8, ok);
    /* Reported, deliberately, not asserted to zero. Six strings in this
       brand's committed copy name its future domain as PROSE -- a meta
       description and the About lead. Not a link, not a canonical, and the
       pages are noindex, so no crawler acts on it. It is still the brand's
       copy naming a domain that is not the one serving it, and the fix is to
       write the real copy rather than to have staging rewrite content: a
       review host that edited the words would be reviewing something other
       than what ships. */
    console.log('  NOTE  pages whose COPY names the future production domain: ' +
      (prose.length ? prose.join(', ') : 'none'));
    check('that prose appears only in copy, never in a link or an SEO signal', true);
  }

  /* Mobile. A reviewer will check this on a phone. */
  console.log('\n===== MOBILE =====');
  {
    const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true,
      hasTouch: true, deviceScaleFactor: 2 });
    const mlog = { served: [], missing: [], offOrigin: [], thirdParty: [], production: [] };
    await serveAtOrigin(m, staging.dir, mlog);
    const mp = await m.newPage();
    await mp.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
    await mp.waitForTimeout(600);
    const v = await mp.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      width: document.documentElement.clientWidth,
      visibleImgs: [...document.querySelectorAll('img')].filter(i => i.offsetParent !== null).length,
      brand: window.CMS && CMS.get('branding.siteName', '')
    }));
    check('the mobile viewport is 390px wide', v.width === 390, v.width);
    check('there is no horizontal overflow', v.overflow <= 1, v.overflow);
    check('images render on mobile', v.visibleImgs > 0, v.visibleImgs);
    check('and it is still Playzone9', v.brand === 'Playzone9', v.brand);
    check('mobile requested nothing from the production domain, and nothing 404ed',
      mlog.production.length === 0 && mlog.offOrigin.length === 0 && mlog.missing.length === 0,
      [mlog.production.slice(0, 3), mlog.offOrigin.slice(0, 3), mlog.missing.slice(0, 3)]);
    await m.close();
  }

  /* ==================================================================
     3. THE ADMIN, AT https://playzones9.com/admin/
     ================================================================== */
  console.log('\n===== THE CMS AT /admin/ =====');
  const alog = { served: [], missing: [], offOrigin: [], thirdParty: [], production: [] };
  const actx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await serveAtOrigin(actx, staging.dir, alog);
  /* Supabase is unreachable and the staging row does not exist. That IS the
     state under review, so it is not stubbed away: the admin has to work
     against the shipped fallback. Auth is stubbed only so the write guard
     can be exercised without a real session. */
  await actx.route('**supabase.co/**', r => {
    const q = r.request();
    if (q.url().includes('/auth/v1/token')) {
      return r.fulfill({ status: 200, contentType: 'application/json',
                         body: JSON.stringify({ access_token: 'stub' }) });
    }
    if (q.method() === 'POST') {
      alog.served.push('WRITE ' + q.url());
      /* Kept so the read-back can confirm it: publish() no longer treats a
         201 as proof, it reads the row and compares updated_at. */
      alog.lastWrite = JSON.parse(q.postData() || '{}');
      return r.fulfill({ status: 201, body: '' });
    }
    if (alog.lastWrite) {
      /* Echoed in Postgres's format -- an offset, not the Z we sent -- which
         is exactly what the comparison has to survive. */
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([{ data: alog.lastWrite.data,
          updated_at: new Date(alog.lastWrite.updated_at).toISOString()
                        .replace(/\.000Z$/, '+00:00').replace(/Z$/, '+00:00') }]) });
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const admin = await actx.newPage();
  const aerrs = [];
  admin.on('pageerror', e => aerrs.push(e.message));
  const resp = await admin.goto(ORIGIN + '/admin/', { waitUntil: 'domcontentloaded' });
  /* The admin boots asynchronously: it pulls the row, seeds the Theme
     Manager and paints fourteen panels. This was a fixed 1200ms sleep,
     which made the snapshot below a race -- on a loaded machine the seed
     had not run yet and `themes` read 0, failing an assertion about the
     CMS because of a stopwatch. Waiting for the condition instead, with a
     ceiling so a genuine failure still surfaces as one. */
  await admin.waitForFunction(() =>
    !!(window.CMS && CMS.themes && typeof CMS.themes.list === 'function' &&
       CMS.themes.list().length > 0 &&
       document.querySelectorAll('.adm-panel').length > 0),
    null, { timeout: 20000 }).catch(() => {});
  await admin.waitForTimeout(200);

  check('/admin/ is reachable at the staging hostname', resp.status() === 200, resp.status());
  check('the admin loaded with no script errors', aerrs.length === 0, aerrs);

  const a = await admin.evaluate(() => ({
    host: CMS.brand.host(), siteId: CMS.brand.siteId(), matched: CMS.brand.matched(),
    agrees: CMS.brand.agrees(), expected: CMS.brand.expectedSiteId(), noindex: CMS.brand.noindex(),
    bucket: CMS.brand.bucket(), suffix: CMS.brand.storageSuffix(),
    brands: CMS.brand.all().map(x => x.host + '=' + x.siteId + (x.current ? '*' : '')),
    label: (document.querySelector('#brandLabel') || {}).textContent,
    hostLine: (document.querySelector('#brandHost') || {}).textContent,
    nowText: (document.querySelector('#brandNow') || {}).textContent || '',
    listRows: document.querySelectorAll('#brandList .brandtable tbody tr').length,
    title: document.title,
    panels: [...document.querySelectorAll('.adm-panel')].map(p => p.id),
    themes: CMS.themes.list().length
  }));

  console.log('\n===== THE ADMIN SAYS WHICH BRAND IT IS EDITING =====');
  check('it reports the staging hostname', a.host === STAGING, a.host);
  check('and the staging row', a.siteId === 'playzone9staging', a.siteId);
  check('the hostname is a registered brand', a.matched === true);
  check('configuration and hostname agree, so publishing is allowed',
    a.agrees === true && a.expected === a.siteId, a);
  check('it knows this is a review build', a.noindex === true);
  check('the sidebar names the brand', /Playzone9/.test(a.label || ''), a.label);
  check('and shows the hostname', (a.hostLine || '').trim() === STAGING, a.hostLine);
  check('the tab title is the brand\'s', /^Playzone9 CMS/.test(a.title), a.title);
  check('the Brands panel names the staging row', a.nowText.includes('playzone9staging'));
  check('and the staging bucket', a.nowText.includes('cms-media-pz9-staging'));
  check('it warns that this is a review build', /review build/i.test(a.nowText), a.nowText.slice(0, 200));
  check('it does NOT warn about an unregistered hostname', !/not a registered brand/i.test(a.nowText));
  check('it lists all three registered hosts', a.listRows === 3, a.listRows);
  check('with the staging one flagged as current',
    a.brands.includes(STAGING + '=playzone9staging*'), a.brands);
  check('and the other two not flagged',
    a.brands.includes('jsk-1.com=playzone9') && a.brands.includes(PROD + '=playzone9app'), a.brands);
  check('there is no brand switcher', await admin.evaluate(() =>
    !document.querySelector('select[id*="brand" i], select[name*="brand" i]')));

  console.log('\n===== EVERY CMS CAPABILITY PHASE 8 LISTS =====');
  {
    const want = ['panel-brands', 'panel-themes', 'panel-branding', 'panel-colors',
      'panel-typography', 'panel-design', 'panel-text', 'panel-auth', 'panel-images',
      'panel-media', 'panel-home', 'panel-footer', 'panel-seo'];
    let found = 0;
    for (const id of want) {
      if (a.panels.includes(id)) found++;
      else check('the ' + id.replace('panel-', '') + ' panel is available', false);
    }
    check('all thirteen panels are available in the staging admin', found === want.length, found);
    check('the Theme Manager seeded its themes', a.themes >= 5, a.themes);

    /* The settings, read through the CMS at the staging hostname. Keys, not
       screenshots: what matters is that each is addressable for THIS brand. */
    const KEYS = ['branding.siteName', 'branding.browserTitle', 'branding.loginTitle',
      'images.logo', 'images.logoMobile', 'images.favicon', 'images.footerLogo',
      'images.loginLogo', 'images.registerLogo', 'images.banner',
      'colors.hdr-bg', 'colors.footer-bg', 'colors.btn-register-bg', 'colors.nav-active',
      'seo.defaultTitle', 'seo.defaultDescription', 'seo.baseUrl',
      'seo.defaultOgImage', 'seo.defaultTwitterImage', 'seo.twitterCard',
      'seo.defaultOgTitle', 'seo.defaultOgDescription',
      'pages.home.title', 'pages.home.metaDescription', 'pages.login.title',
      'settings.activeTheme'];
    /* The merged data is walked rather than read through CMS.get, because
       get() returns the caller's default for an empty value -- and an image
       slot an admin has not filled yet is legitimately empty. What is being
       asserted is that the KEY exists for this brand and is therefore
       editable, not that someone has already filled it. */
    const got = await admin.evaluate(keys => {
      const data = CMS.data(), out = {};
      keys.forEach(k => {
        let node = data, present = true;
        for (const part of k.split('.')) {
          if (node && typeof node === 'object' && Object.prototype.hasOwnProperty.call(node, part)) {
            node = node[part];
          } else { present = false; break; }
        }
        out[k] = present ? { present: true, value: node } : { present: false };
      });
      return out;
    }, KEYS);
    let addressable = 0;
    for (const k of KEYS) {
      if (got[k] && got[k].present) addressable++;
      else check('CMS key ' + k + ' exists for this brand', false);
    }
    check('all ' + KEYS.length + ' branding, image, colour and SEO keys exist for this brand',
      addressable === KEYS.length && KEYS.length >= 26, addressable + '/' + KEYS.length);
    check('and they resolve to Playzone9, not JSK1',
      /Playzone9/.test(JSON.stringify(got)) && !/JSK1/.test(JSON.stringify(got)));
    const effectiveBase = await admin.evaluate(() => CMS.get('seo.baseUrl', ''));
    check('the EFFECTIVE seo.baseUrl is the staging host, so nothing the CMS ' +
      'generates points at production', effectiveBase === ORIGIN, effectiveBase);

    /* The Page Builder and media paths exist for this brand too. */
    const caps = await admin.evaluate(() => ({
      builder: typeof CMS.sections === 'object' && typeof CMS.sections.renderInto === 'function',
      drafts: typeof CMS.data().builderDrafts === 'object',
      mediaEnabled: CMS.remote.mediaEnabled(),
      mediaBucket: CMS.brand.bucket(),
      themesApi: ['list', 'get', 'save', 'activeId'].every(m => typeof CMS.themes[m] === 'function')
    }));
    check('the Page Builder API is available', caps.builder && caps.drafts, caps);
    check('the Theme Manager API is available', caps.themesApi);
    check('media uploads are OFF until the bucket exists, and say so rather than failing later',
      caps.mediaEnabled === false, caps.mediaEnabled);
    check('but the bucket they WOULD use is the staging one',
      caps.mediaBucket === 'cms-media-pz9-staging', caps.mediaBucket);
  }

  console.log('\n===== THE WRITE GUARD IS LIVE AT THE REAL HOSTNAME =====');
  {
    const before = alog.served.filter(x => x.startsWith('WRITE ')).length;
    const r = await admin.evaluate(async () => {
      await CMS.remote.signIn('a@b.c', 'x');
      try { await CMS.remote.publish(); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    });
    check('publishing from the staging admin succeeds', r.ok === true, r.msg);
    const writes = alog.served.filter(x => x.startsWith('WRITE ')).slice(before);
    check('exactly one write was sent', writes.length === 1, writes.length);
    const body = await admin.evaluate(() => null);   /* body checked below via the log URL */
    check('and it went to the site_brand table', writes[0] && /rest\/v1\/site_brand/.test(writes[0]),
      writes[0]);

    /* Now the dangerous case, at the real hostname: a config that points this
       host at another brand's row. The guard must refuse. */
    const bad = await admin.evaluate(async () => {
      window.CMS_REMOTE.siteId = 'playzone9';          /* JSK1's row */
      const st = { expected: CMS.brand.expectedSiteId(), configured: CMS.brand.siteId(),
                   agrees: CMS.brand.agrees() };
      let msg = null;
      try { await CMS.remote.publish(); } catch (e) { msg = e.message; }
      return { st, msg };
    });
    const after = alog.served.filter(x => x.startsWith('WRITE ')).length;
    check('pointing the staging host at JSK1\'s row is detected',
      bad.st.expected === 'playzone9staging' && bad.st.configured === 'playzone9' &&
      bad.st.agrees === false, bad.st);
    check('publishing is REFUSED', typeof bad.msg === 'string' && bad.msg.length > 0, bad.msg);
    check('the message names the staging host and both rows',
      /playzones9\.com/.test(bad.msg) && /playzone9staging/.test(bad.msg) &&
      /"playzone9"/.test(bad.msg), bad.msg);
    check('and NOTHING further reached the network',
      after === before + 1, after - before);
  }

  check('the admin requested nothing from the production domain',
    alog.production.length === 0, alog.production.slice(0, 4));
  check('and nothing off-origin beyond the known CDNs and Supabase',
    alog.offOrigin.length === 0, alog.offOrigin.slice(0, 4));
  check('nothing in the admin 404ed', alog.missing.length === 0, alog.missing.slice(0, 6));
  /* The admin's Brands panel LISTS playzone9.app -- it is a registered brand
     and the panel's job is to show the registry. What it must not do is
     present it as this site or link to it as somewhere to publish. */
  const adminProd = await admin.evaluate(() => ({
    mentions: (document.documentElement.outerHTML.match(/playzone9\.app/g) || []).length,
    links: [...document.querySelectorAll('a[href]')].map(a => a.href)
      .filter(h => h.indexOf('playzone9.app') > -1),
    inRegistryRow: !!document.querySelector('#brandList')
      && /playzone9\.app/.test(document.querySelector('#brandList').textContent),
    presentedAsCurrent: /playzone9\.app/.test(
      (document.querySelector('#brandHost') || {}).textContent || '')
  }));
  check('the admin names the production domain only in the registry listing',
    adminProd.inRegistryRow === true && adminProd.presentedAsCurrent === false, adminProd);
  check('the one link to it is the "open its CMS" link, which is the registry\'s purpose',
    adminProd.links.length <= 1 &&
    adminProd.links.every(h => /\/admin\/?$/.test(h)), adminProd.links);

  await actx.close();
  await ctx.close();

  /* ==================================================================
     3b. THE SAVE ROUND TRIP
     A successful publish response proves nothing about persistence. What
     matters is that the value comes BACK -- into a browser with no cache
     of its own, which is what "close it and open it again" means. So the
     Supabase stub here is STATEFUL: it stores what was posted and serves
     it on later reads, exactly as the real row would.

     This is the one part of Phase 9's manual test that can be run before
     the row exists, and it is the part most likely to fail quietly.
     ================================================================== */
  console.log('\n===== A CHANGE SAVED IN THE CMS COMES BACK =====');
  {
    const NEW_NAME = 'PZ9 Staging Round Trip';
    const NEW_HDR = 'rgb(18, 52, 86)';          /* #123456 */
    const NEW_TITLE = 'Round trip title for staging';
    const NEW_DESC = 'Round trip description for staging.';
    const row = {};                              /* the stubbed site_brand row */
    const posts = [];

    function statefulSupabase(c) {
      return c.route('**supabase.co/**', r => {
        const q = r.request();
        if (q.url().includes('/auth/v1/token')) {
          return r.fulfill({ status: 200, contentType: 'application/json',
                             body: JSON.stringify({ access_token: 'stub' }) });
        }
        if (q.method() === 'POST' && q.url().includes('/rest/v1/')) {
          const body = JSON.parse(q.postData() || '{}');
          posts.push(body);
          row.id = body.id; row.data = body.data; row.updated_at = body.updated_at;
          return r.fulfill({ status: 201, body: '' });
        }
        /* The read the CMS does on every page load. Serves the stored row
           only for the id being asked for, so a wrong-row read shows up. */
        const want = decodeURIComponent((q.url().match(/id=eq\.([^&]+)/) || [])[1] || '');
        const hit = row.id && row.id === want;
        return r.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify(hit ? [{ data: row.data, updated_at: row.updated_at }] : []) });
      });
    }

    /* --- edit and publish, at the staging hostname --- */
    const c1 = await browser.newContext();
    const l1 = { served: [], missing: [], offOrigin: [], thirdParty: [], production: [] };
    await serveAtOrigin(c1, staging.dir, l1);
    await statefulSupabase(c1);
    const p1 = await c1.newPage();
    await p1.goto(ORIGIN + '/admin/', { waitUntil: 'domcontentloaded' });
    await p1.waitForTimeout(900);
    const saved = await p1.evaluate(async v => {
      CMS.set('branding.siteName', v.name);
      CMS.set('colors.hdr-bg', '#123456');
      CMS.set('seo.defaultTitle', v.title);
      CMS.set('pages.home.metaDescription', v.desc);
      CMS.save();
      await CMS.remote.signIn('a@b.c', 'x');
      try { await CMS.remote.publish(); return { ok: true }; }
      catch (e) { return { ok: false, msg: e.message }; }
    }, { name: NEW_NAME, title: NEW_TITLE, desc: NEW_DESC });
    check('the CMS published the edits', saved.ok === true, saved.msg);
    check('exactly one row write was sent', posts.length === 1, posts.length);
    check('it wrote the STAGING row', posts[0] && posts[0].id === 'playzone9staging',
      posts[0] && posts[0].id);
    check('the payload carries the new brand name',
      posts[0] && posts[0].data.branding.siteName === NEW_NAME);
    check('and the new colour, title and description',
      posts[0] && posts[0].data.colors['hdr-bg'] === '#123456' &&
      posts[0].data.seo.defaultTitle === NEW_TITLE &&
      posts[0].data.pages.home.metaDescription === NEW_DESC);
    check('unpublished working state was NOT sent',
      posts[0] && !('builderDrafts' in posts[0].data) && !('builderLibrary' in posts[0].data),
      posts[0] && Object.keys(posts[0].data).filter(k => /^builder/.test(k)));
    await c1.close();

    /* --- a FRESH browser context: no localStorage, no sessionStorage. The
           only way the new values can appear is from the row. --- */
    const c2 = await browser.newContext();
    const l2 = { served: [], missing: [], offOrigin: [], thirdParty: [], production: [] };
    await serveAtOrigin(c2, staging.dir, l2);
    await statefulSupabase(c2);
    const p2 = await c2.newPage();
    await p2.goto(ORIGIN + '/', { waitUntil: 'domcontentloaded' });
    await p2.waitForTimeout(900);
    const back = await p2.evaluate(() => ({
      storageWasEmpty: true,
      name: CMS.get('branding.siteName', ''),
      hdr: getComputedStyle(document.querySelector('.site-header, header') || document.body)
        .backgroundColor,
      title: CMS.get('seo.defaultTitle', ''),
      desc: (document.querySelector('meta[name="description"]') || {}).content,
      painted: (document.querySelector('[data-cms-text="branding.siteName"]') || {}).textContent,
      robots: (document.querySelector('meta[name="robots"]') || {}).content,
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href
    }));
    check('a fresh browser reads the saved brand name back from the row',
      back.name === NEW_NAME, back.name);
    check('and paints it into the page', (back.painted || '').trim() === NEW_NAME, back.painted);
    check('the saved primary colour is applied', back.hdr === NEW_HDR, back.hdr);
    /* The regression guard for the bug this test found: the brand stylesheet
       must be parsed BEFORE js/cms.js injects its variables, or every colour
       changed in the admin saves, reports success and never renders. */
    const cascade = await p2.evaluate(() => [...document.querySelectorAll('style[id], link[rel=stylesheet]')]
      .map(e => e.id || e.getAttribute('href')));
    const iBrand = cascade.indexOf('css/brand.css');
    const iVars = cascade.indexOf('cmsVars');
    check('the brand stylesheet and the CMS variables are both present',
      iBrand > -1 && iVars > -1, cascade);
    check('and the CMS variables come AFTER the brand stylesheet, so the CMS wins',
      iBrand < iVars, cascade);
    check('which is also after the shared stylesheet, so the brand wins over that',
      cascade.indexOf('css/style.css') < iBrand, cascade);
    check('the saved SEO title came back', back.title === NEW_TITLE, back.title);
    check('and the saved meta description is on the page', back.desc === NEW_DESC, back.desc);
    check('the staging protections SURVIVE a published row',
      /noindex/.test(back.robots || '') && back.canonical === ORIGIN + '/',
      [back.robots, back.canonical]);
    check('and the published row did not introduce the production domain',
      !(await p2.evaluate(() => /playzone9\.app/.test(document.documentElement.outerHTML))));
    await c2.close();

    /* --- and a reader on a DIFFERENT brand must not see any of it --- */
    const c3 = await browser.newContext();
    const jsk1Dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p9-jsk1-'));
    tmpRoots.push(jsk1Dir);
    const jp = SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT,
                               id: 'jsk-1.com' });
    SITE.assemble(jp, jsk1Dir);
    const JORIGIN = 'https://jsk-1.com';
    await c3.route('**/*', route => {
      const url = route.request().url();
      if (!url.startsWith(JORIGIN + '/')) return route.fulfill({ status: 204, body: '' });
      let rel = decodeURIComponent(url.slice(JORIGIN.length).split('?')[0]).replace(/^\/+/, '');
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const full = path.join(jsk1Dir, 'jsk-1.com', rel);
      if (!fs.existsSync(full) || fs.statSync(full).isDirectory()) {
        return route.fulfill({ status: 404, body: 'no' });
      }
      return route.fulfill({ status: 200,
        contentType: TYPES[path.extname(full)] || 'application/octet-stream',
        body: fs.readFileSync(full) });
    });
    await statefulSupabase(c3);   /* after the origin route, so it wins for supabase.co */
    const p3 = await c3.newPage();
    await p3.goto(JORIGIN + '/', { waitUntil: 'domcontentloaded' });
    await p3.waitForTimeout(900);
    const j = await p3.evaluate(() => ({
      siteId: (window.CMS_REMOTE || {}).siteId,
      name: CMS.get('branding.siteName', ''),
      hdr: getComputedStyle(document.querySelector('.site-header, header') || document.body)
        .backgroundColor,
      title: document.title,
      leak: /PZ9 Staging Round Trip|Playzone9/.test(document.documentElement.outerHTML)
    }));
    check('JSK1 reads its OWN row, not the staging one', j.siteId === 'playzone9', j.siteId);
    /* Its OWN name, whatever the brand layer says that is. The site can
       rename itself in the CMS -- this assertion is about isolation, not
       about a spelling -- so the expected value comes from the brand
       layer being served, and what it must never be is the other
       brand's. */
    const jsk1Name = SHELL.readBrand(path.join(PROD_BRANDS, 'jsk-1.com', 'brand.js')).branding.siteName;
    check('JSK1 still resolves its own brand name',
      j.name === jsk1Name && !/playzone9|pz9/i.test(j.name), { got: j.name, expected: jsk1Name });
    check('  and the name it resolved is a real one, not an empty fallback',
      typeof jsk1Name === 'string' && jsk1Name.length > 1, jsk1Name);
    check('JSK1\'s header colour is untouched by the staging edit',
      j.hdr !== NEW_HDR, j.hdr);
    check('JSK1\'s title is its own', /JSK1/.test(j.title), j.title);
    check('and nothing the staging CMS saved appears on JSK1 at all', j.leak === false);
    await c3.close();
  }

  /* ==================================================================
     4. JSK1 AND THE RESERVED DOMAIN
     ================================================================== */
  console.log('\n===== JSK1 AND playzone9.app =====');
  {
    const GOLDEN = path.join(__dirname, 'fixtures', 'golden-jsk1');
    let same = 0;
    for (const f of ['index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
      'privacy-policy.html', 'responsible-gaming.html', '404.html', 'js/brand.js',
      'sitemap.xml', 'robots.txt']) {
      if (sha(path.join(ROOT, f)) === sha(path.join(GOLDEN, f))) same++;
      else check('deployed ' + f + ' still matches its Phase 0 fixture', false);
    }
    check('all eleven Phase 0 fixtures still describe production', same === 11, same);
    check('no CNAME exists in the repository', !fs.existsSync(path.join(ROOT, 'CNAME')));

    const wf = path.join(ROOT, '.github', 'workflows');
    const decomment = y => y.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
    const files = fs.readdirSync(wf).sort();
    check('the workflow directory was read', files.length >= 2, files);
    for (const f of files) {
      const d = decomment(fs.readFileSync(path.join(wf, f), 'utf8'));
      if (/deploy-pages/.test(d) && /playzone9/.test(d)) {
        check(f + ' must not both deploy to Pages and mention Playzone9', false);
      }
      if (/CNAME/i.test(d)) check(f + ' must not write a CNAME', false);
    }
    check('no workflow deploys Playzone9 or writes a CNAME', true);
    const prod = decomment(fs.readFileSync(path.join(wf, 'static.yml'), 'utf8'));
    /* It assembles JSK1's site and uploads that, rather than the repository
       root. The claim this suite makes is the one below it: production is
       JSK1's deploy and knows nothing about Playzone9. */
    check('the JSK1 deploy still publishes JSK1 and only JSK1',
      /run: node tools\/build-site\.js jsk-1\.com/.test(prod) &&
      /path: '_site\/jsk-1\.com'/.test(prod), prod.match(/(run:|path:)[^\n]*/g));
    check('and still knows nothing about Playzone9', !/playzone9/i.test(prod));
  }

  await browser.close();
  tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
