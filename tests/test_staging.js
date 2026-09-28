#!/usr/bin/env node
/* =====================================================================
   THE PLAYZONE9 STAGING HOST  (Phase 6)
   ---------------------------------------------------------------------
   playzones9.com is a review copy of Playzone9. Two things have to be
   true of it and neither is obvious from reading the files:

   1. IT MUST NOT BE INDEXABLE. Not "we set a meta tag" -- every page,
      plus a robots.txt that blocks everything, plus no sitemap to
      invite a crawl.

   2. IT MUST NOT CLAIM TO BE PRODUCTION. playzone9.app is reserved and
      connected to nothing. A canonical, og:url or JSON-LD url pointing
      at it would hand a review copy's signals to a domain that does
      not exist yet.

   The second one cannot be proved by reading the built files, and that
   is why this suite runs a browser. js/cms.js repaints the canonical
   link, og:url and the JSON-LD urls from seo.baseUrl AFTER the page
   loads. The static HTML being right is only half the answer: without
   the environment override appended to the generated brand.js, these
   pages load correct and then rewrite themselves to point at
   production. So the staging site is served on its own port and the
   painted DOM is read back.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const KIT = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));
const SITE = require(path.join(ROOT, 'tools', 'lib', 'sitekit.js'));
const PROD_BRANDS = path.join(ROOT, 'brands');
const TEMPLATES = path.join(ROOT, 'templates');

const BRAND = 'playzone9.app';          /* the identity */
const STAGING_HOST = 'playzones9.com';  /* where it is reviewed */
const PROD_HOST = 'playzone9.app';      /* reserved, connected to nothing */
const PORT = Number(process.env.STAGING_PORT || 8791);

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'staging-' + tag + '-'));
  tmpRoots.push(d); return d;
}
function build(env) {
  const out = mktmp(env || 'prod');
  const s = SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT,
                            id: BRAND, env: env || '' });
  const r = SITE.assemble(s, out);
  return { s, dir: r.dir, v: SITE.verify(s, r.dir), files: SITE.verify(s, r.dir).files };
}

const LIVE = ['index.html', 'login.html', 'register.html', 'js/brand.js', 'js/cms.js',
  'js/cms-config.js', 'sitemap.xml', 'robots.txt', 'css/style.css', 'assets/images/favicon.png'];
const liveBefore = {};
LIVE.forEach(f => { liveBefore[f] = sha(path.join(ROOT, f)); });

const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ttf': 'font/ttf', '.xml': 'application/xml',
  '.txt': 'text/plain' };

(async () => {
  const staging = build('staging');
  const prod = build('');

  /* ==================================================================
     1. THE STATIC FILES
     ================================================================== */
  console.log('\n===== THE STAGING BUILD =====');
  check('it assembled files', staging.files.length > 0, staging.files.length);
  check('it passed its own verification', staging.v.problems.length === 0, staging.v.problems);
  check('the brand identity did NOT move to the staging host',
    staging.s.plan.brand.id === BRAND, staging.s.plan.brand.id);
  check('it is served on the staging host', staging.s.plan.brand.domain === STAGING_HOST,
    staging.s.plan.brand.domain);
  check('and it still knows its canonical domain',
    staging.s.plan.brand.canonicalDomain === PROD_HOST, staging.s.plan.brand.canonicalDomain);
  check('its output directory is keyed by the staging host',
    path.basename(staging.dir) === STAGING_HOST, path.basename(staging.dir));
  check('it has its own Supabase row, not the production one',
    staging.s.plan.brand.siteId === 'playzone9staging' &&
    staging.s.plan.brand.siteId !== prod.s.plan.brand.siteId,
    [staging.s.plan.brand.siteId, prod.s.plan.brand.siteId]);
  check('and its own media bucket',
    staging.s.plan.brand.bucket !== prod.s.plan.brand.bucket,
    [staging.s.plan.brand.bucket, prod.s.plan.brand.bucket]);
  check('it is flagged noindex', staging.s.plan.brand.noindex === true);
  check('the production build is NOT flagged noindex', prod.s.plan.brand.noindex === false);

  const pages = staging.files.filter(f => /^[a-z0-9-]+\.html$/.test(f)).sort();
  check('all eight pages were built', pages.length === 8, pages);

  /* The brand's own stylesheet has to reach EVERY page, login and register
     included -- a slot point missing from one template would leave that one
     page rendering in the shared palette, which is the kind of thing nobody
     notices until a screenshot. */
  console.log('\n===== THE BRAND LAYER REACHES EVERY PAGE =====');
  {
    const slot = fs.readFileSync(path.join(PROD_BRANDS, BRAND, 'slots', 'head-extra.html'), 'utf8');
    check('the head-extra slot file is non-empty', slot.trim().length > 0);
    check('it is declared by the shared templates',
      staging.s.plan.slotsDeclared.includes('head-extra'), staging.s.plan.slotsDeclared);
    check('and this brand fills it', Object.keys(staging.s.plan.brand.slots).includes('head-extra'));
    let linked = 0;
    for (const p of pages) {
      const html = fs.readFileSync(path.join(staging.dir, p), 'utf8');
      if (html.indexOf('css/brand.css') > -1) linked++;
      else check(p + ' does not load the brand stylesheet', false);
    }
    check('all eight pages were checked for the brand stylesheet', linked === 8, linked);
    check('every page loads css/brand.css, login and register included', linked === pages.length);
    check('the stylesheet itself was published', staging.files.includes('css/brand.css'));
    const css = fs.readFileSync(path.join(staging.dir, 'css', 'brand.css'), 'utf8');
    check('it states the brand\'s own palette', /--pz9-primary/.test(css));
    check('and it is loaded after the shared stylesheets', (() => {
      const h = fs.readFileSync(path.join(staging.dir, 'index.html'), 'utf8');
      return h.indexOf('css/brand.css') > h.indexOf('css/style.css');
    })());
    check('the favicon is this brand\'s, not the shared one',
      sha(path.join(staging.dir, 'assets', 'images', 'favicon.png')) ===
      sha(path.join(PROD_BRANDS, BRAND, 'static', 'assets', 'images', 'favicon.png')));
    check('and differs from the one JSK1 ships',
      sha(path.join(staging.dir, 'assets', 'images', 'favicon.png')) !==
      sha(path.join(ROOT, 'assets', 'images', 'favicon.png')));
    check('JSK1\'s own favicon is untouched on disk',
      sha(path.join(ROOT, 'assets', 'images', 'favicon.png')) === liveBefore['assets/images/favicon.png']);
  }

  console.log('\n===== NOTHING HERE CAN BE INDEXED =====');
  let noidx = 0;
  for (const p of pages) {
    const html = fs.readFileSync(path.join(staging.dir, p), 'utf8');
    const tags = html.match(/<meta name="robots" content="[^"]*"/g) || [];
    if (tags.length !== 1) { check(p + ' has exactly one robots meta', false, tags); continue; }
    if (/content="noindex,nofollow"/.test(tags[0])) noidx++;
    else check(p + ' is ' + tags[0], false);
  }
  check('every one of the eight pages was checked', noidx === 8, noidx);
  check('every page is noindex,nofollow -- including the five production indexes',
    noidx === pages.length && pages.length === 8, noidx);
  check('no sitemap.xml is published at all', !staging.files.includes('sitemap.xml'));
  check('and none was planned either', !staging.s.seo.includes('sitemap.xml'), staging.s.seo);
  const rob = fs.readFileSync(path.join(staging.dir, 'robots.txt'), 'utf8');
  check('robots.txt blocks everything', /^Disallow: \/$/m.test(rob), rob.split('\n').slice(-4));
  check('robots.txt declares no sitemap', !/^Sitemap:/m.test(rob));
  check('robots.txt says why, for whoever finds it', /STAGING|REVIEW/.test(rob));
  check('robots.txt does not advertise the reserved production domain', rob.indexOf(PROD_HOST) === -1);

  console.log('\n===== IT DOES NOT CLAIM TO BE PRODUCTION =====');
  let selfCanon = 0; const leaks = [];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(staging.dir, p), 'utf8');
    if (html.indexOf(PROD_HOST) > -1) leaks.push(p);
    const c = (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
    if (p === '404.html') { if (c === undefined) selfCanon++; continue; }
    if (c && c.startsWith('https://' + STAGING_HOST + '/')) selfCanon++;
    else check(p + ' canonical is ' + c, false);
  }
  check('all eight canonicals were checked', selfCanon === 8, selfCanon);
  check('every canonical is on the staging host, none on production', selfCanon === 8);
  check('NO page mentions the reserved production domain', leaks.length === 0, leaks);
  const idx = fs.readFileSync(path.join(staging.dir, 'index.html'), 'utf8');
  check('og:url is the staging host',
    /property="og:url" content="https:\/\/playzones9\.com\/"/.test(idx));
  const ld = [...idx.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => JSON.parse(m[1]));
  check('both JSON-LD blocks parse', ld.length === 2, ld.length);
  check('and every JSON-LD url is the staging host',
    ld.length === 2 && ld.every(j => j.url === 'https://' + STAGING_HOST + '/'), ld.map(j => j.url));
  let rel = 0; const abs = [];
  for (const p of pages) {
    for (const m of fs.readFileSync(path.join(staging.dir, p), 'utf8')
      .matchAll(/(?:href|src)="((?!https?:|\/\/|#|mailto:|tel:|javascript:)[^"]+)"/g)) {
      rel++; if (m[1].charAt(0) === '/') abs.push(p + ' -> ' + m[1]);
    }
  }
  check('internal links were found', rel > 40, rel);
  check('none is root-absolute, so the site works on either host', abs.length === 0, abs);

  /* ==================================================================
     2. THE RUNTIME. This is the half the files cannot prove.
     ================================================================== */
  console.log('\n===== AND IT STILL DOES NOT AFTER JAVASCRIPT RUNS =====');
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const full = path.join(staging.dir, rel);
    if (!full.startsWith(staging.dir + path.sep) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); return res.end('no');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'application/octet-stream' });
    res.end(fs.readFileSync(full));
  });
  await new Promise(r => srv.listen(PORT, r));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await browser.newContext();
  /* No database in this environment, which is also the state the staging
     row is in: it does not exist. So this is the real fallback path. */
  await ctx.route('**supabase.co/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const page = await ctx.newPage();

  const seen = [];
  for (const p of ['index.html', 'login.html', 'register.html', 'about.html']) {
    await page.goto('http://localhost:' + PORT + '/' + p, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    seen.push(await page.evaluate(() => ({
      file: location.pathname.replace(/^\//, ''),
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
      robots: (document.querySelector('meta[name="robots"]') || {}).content || null,
      ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content || null,
      title: document.title,
      brandName: (window.CMS && window.CMS.get('branding.siteName', '')) || '',
      baseUrl: (window.CMS && window.CMS.get('seo.baseUrl', '')) || '',
      siteId: (window.CMS_REMOTE || {}).siteId || '',
      storage: JSON.stringify(window.CMS_STORAGE || {}),
      ld: [...document.querySelectorAll('script[type="application/ld+json"]')]
        .map(s => { try { return JSON.parse(s.textContent).url; } catch (e) { return 'unparsed'; } }),
      html: document.documentElement.outerHTML
    })));
  }
  check('four pages were loaded in a browser', seen.length === 4, seen.length);

  let runtimeOk = 0;
  for (const v of seen) {
    const tag = v.file;
    if (/noindex/.test(v.robots || '')) runtimeOk++;
    else check(tag + ': robots after JS is "' + v.robots + '"', false);
    if (v.canonical && v.canonical.indexOf(STAGING_HOST) > -1) runtimeOk++;
    else check(tag + ': canonical after JS is "' + v.canonical + '"', false);
    if (!v.canonical || v.canonical.indexOf(PROD_HOST) === -1) runtimeOk++;
    else check(tag + ': canonical was REPAINTED to production', false);
  }
  check('every runtime check ran on all four pages', runtimeOk === 12, runtimeOk);
  check('the canonical is still the staging host after js/cms.js has run', runtimeOk === 12);
  check('og:url after JS is the staging host',
    seen.every(v => !v.ogUrl || v.ogUrl.indexOf(STAGING_HOST) > -1), seen.map(v => v.ogUrl));
  check('JSON-LD urls after JS are the staging host',
    seen.every(v => v.ld.every(u => !u || u.indexOf(PROD_HOST) === -1)), seen.map(v => v.ld));
  check('the CMS resolved seo.baseUrl to the staging host',
    seen.every(v => v.baseUrl === 'https://' + STAGING_HOST), seen.map(v => v.baseUrl));
  check('the CMS resolved the brand to Playzone9',
    seen.every(v => v.brandName === 'Playzone9'), seen.map(v => v.brandName));
  check('no rendered page says JSK1',
    seen.every(v => !/JSK1/.test(v.html)), seen.filter(v => /JSK1/.test(v.html)).map(v => v.file));
  check('every page title names Playzone9',
    seen.every(v => /Playzone9/.test(v.title)), seen.map(v => v.title));

  /* The browser reports localhost, so the registry falls to the default
     brand -- which is the documented behaviour and is why the data layer,
     not the hostname, is what carries the staging identity here. The
     hostname mapping itself is asserted below without a browser. */
  console.log('\n===== THE HOSTNAME MAPPING =====');
  {
    const vm = require('vm');
    const rows = {};
    for (const h of [STAGING_HOST, PROD_HOST, 'jsk-1.com', 'playzone9.com', 'playzones9.app',
                     'www.playzones9.com', 'playzones9.com.evil.example']) {
      const sb = { window: { location: { hostname: h } } };
      vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8'), sb,
                         { timeout: 2000 });
      rows[h] = { matched: sb.window.CMS_BRAND_RESOLVED.matched,
                  siteId: sb.window.CMS_REMOTE.siteId,
                  bucket: sb.window.CMS_MEDIA.bucket,
                  suffix: sb.window.CMS_STORAGE.suffix };
    }
    check('the staging host is registered and matches exactly',
      rows[STAGING_HOST].matched === true, rows[STAGING_HOST]);
    check('it resolves to its own row', rows[STAGING_HOST].siteId === 'playzone9staging',
      rows[STAGING_HOST].siteId);
    check('it resolves to its own bucket',
      rows[STAGING_HOST].bucket === 'cms-media-pz9-staging', rows[STAGING_HOST].bucket);
    check('its browser storage is namespaced to its own row',
      rows[STAGING_HOST].suffix === ':playzone9staging', rows[STAGING_HOST].suffix);
    check('so staging cannot read or write JSK1\'s storage',
      rows[STAGING_HOST].suffix !== rows['jsk-1.com'].suffix);
    check('or the production Playzone9 row',
      rows[STAGING_HOST].siteId !== rows[PROD_HOST].siteId);
    check('JSK1 is completely unaffected',
      rows['jsk-1.com'].matched === true && rows['jsk-1.com'].siteId === 'playzone9' &&
      rows['jsk-1.com'].suffix === '', rows['jsk-1.com']);
    for (const look of ['playzone9.com', 'playzones9.app', 'www.playzones9.com',
                        'playzones9.com.evil.example']) {
      check('lookalike "' + look + '" does NOT match a brand', rows[look].matched === false);
      check('and does not get the staging row', rows[look].siteId !== 'playzone9staging');
    }
  }

  /* ==================================================================
     3. playzone9.app IS STILL RESERVED
     ================================================================== */
  console.log('\n===== THE PRODUCTION DOMAIN IS UNTOUCHED =====');
  {
    const wf = path.join(ROOT, '.github', 'workflows');
    const files = fs.readdirSync(wf).sort();
    check('the workflow directory was read', files.length >= 2, files);
    let names = 0;
    for (const f of files) {
      const body = fs.readFileSync(path.join(wf, f), 'utf8');
      /* Naming it in a comment is fine; deploying it is not. What must not
         exist anywhere is a step that serves that hostname. */
      const d = body.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
      if (/cname|CNAME/i.test(d) && /playzone9\.app/.test(d)) {
        check(f + ' must not configure the production domain', false);
      }
      names++;
    }
    check('every workflow was inspected', names === files.length && names > 0, names);
    check('no repository CNAME file exists', !fs.existsSync(path.join(ROOT, 'CNAME')));
    check('no workflow both deploys to Pages and mentions Playzone9',
      !fs.readdirSync(wf).some(f => {
        const b = fs.readFileSync(path.join(wf, f), 'utf8')
          .split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
        return /deploy-pages/.test(b) && /playzone9/.test(b);
      }));

    /* Comments stripped first. The workflow explains at length which Pages
       actions it does NOT use, and a naive search finds those words in the
       prose. What matters is the directives. */
    const decomment = y => y.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
    const staged = decomment(fs.readFileSync(path.join(wf, 'staging-playzone9.yml'), 'utf8'));
    check('the staging workflow exists', staged.length > 0);
    check('and stripping its comments left the directives', /runs-on:/.test(staged));
    check('it runs only on workflow_dispatch, never on push',
      /on:\s*\n\s*workflow_dispatch:/.test(staged) && !/\bpush:/.test(staged));
    check('it holds contents: read and nothing more',
      /permissions:\s*\n\s*contents: read\s*\n/.test(staged) &&
      !/pages:\s*write/.test(staged) && !/id-token:\s*write/.test(staged));
    check('it never calls deploy-pages or upload-pages-artifact',
      !/deploy-pages|upload-pages-artifact|configure-pages/.test(staged));
    check('it builds the staging environment, not the canonical domain',
      /--env staging/.test(staged) && !/build-site\.js playzone9\.app(?!\s+--env)/.test(staged));
    check('it uses its own concurrency group, not the production "pages" one',
      /group: "staging-playzone9"/.test(staged) && !/group: "pages"/.test(staged));
    check('it refuses to publish anything indexable',
      /must not ship a sitemap/.test(staged) && /not noindex,nofollow/.test(staged));

    const prodWf = fs.readFileSync(path.join(wf, 'static.yml'), 'utf8');
    check('the production deploy still serves the repository root',
      /path: '\.'/.test(prodWf));
    check('and still knows nothing about Playzone9', !/playzone9/i.test(decomment(prodWf)));
  }

  /* ==================================================================
     4. JSK1 IS UNTOUCHED
     ================================================================== */
  console.log('\n===== JSK1 =====');
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
    let held = 0;
    for (const f of LIVE) {
      if (sha(path.join(ROOT, f)) === liveBefore[f]) held++;
      else check(f + ' is unchanged by this test run', false);
    }
    check('all ten live files were re-hashed', held === LIVE.length && held === 10, held);
    check('every assembly went outside the repository',
      tmpRoots.every(d => !path.resolve(d).startsWith(ROOT + path.sep)));
  }

  await browser.close();
  await new Promise(r => srv.close(r));
  tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
