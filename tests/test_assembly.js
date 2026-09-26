#!/usr/bin/env node
/* =====================================================================
   ASSEMBLING TWO REAL SITES  (Phase 5)
   ---------------------------------------------------------------------
   tools/lib/sitekit.js puts a brand's generated files together with the
   shared engine and produces a directory a host could serve. Phase 4
   proved the generator reproduces JSK1 exactly; this proves the
   ASSEMBLY does too, and that the second real brand gets its own site
   rather than a copy of the first one's.

   Two failure modes drive the whole suite, because both are silent:

     a missed file    a 404 nobody sees until a visitor does.
     a stale shared   js/brand.js lives in the shared js/ directory
     brand.js         because JSK1 is still served from the repository
                      root. Layer 1 copies it and layer 3 overwrites
                      it. If layer 3 ever stops, the second brand
                      serves the first brand's name, which is the one
                      thing this architecture exists to prevent.

   Nothing is written inside the repository: every assembly goes to a
   throwaway directory, and the live files are hashed before and after.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const KIT = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));
const SITE = require(path.join(ROOT, 'tools', 'lib', 'sitekit.js'));

const PROD_BRANDS = path.join(ROOT, 'brands');
const SYNTH_BRANDS = path.join(__dirname, 'fixtures', 'brands');
const TEMPLATES = path.join(ROOT, 'templates');
const GOLDEN = path.join(__dirname, 'fixtures', 'golden-jsk1');

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };
function refuses(name, fn, re) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  if (!err) return check(name, false, 'did not throw');
  if (!(err instanceof KIT.BrandError)) return check(name, false, err.name + ': ' + err.message);
  if (re && !re.test(err.message)) return check(name, false, 'message did not match ' + re + ': ' + err.message);
  check(name, true);
}

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'assembly-' + tag + '-'));
  tmpRoots.push(d); return d;
}

/* Live files hashed before anything runs, compared again at the end. */
const LIVE = ['index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
  'privacy-policy.html', 'responsible-gaming.html', '404.html', 'js/brand.js',
  'sitemap.xml', 'robots.txt', 'js/cms.js', 'js/cms-config.js', 'css/style.css', 'admin/index.html'];
const liveBefore = {};
LIVE.forEach(f => { liveBefore[f] = sha(path.join(ROOT, f)); });

function build(brandsDir, id) {
  const outRoot = mktmp(id.replace(/\./g, '-'));
  const s = SITE.planSite({ brandsDir, templatesDir: TEMPLATES, sharedRoot: ROOT, id });
  const res = SITE.assemble(s, outRoot);
  const v = SITE.verify(s, res.dir);
  return { s, dir: res.dir, v, files: v.files, seoLog: res.seoLog };
}

/* ====================================================================
   1. BOTH REAL SITES ASSEMBLE, AND CHECK OUT
   ==================================================================== */
console.log('\n===== TWO REAL BRANDS, TWO SITES =====');
const jsk1 = build(PROD_BRANDS, 'jsk-1.com');
const pz9 = build(PROD_BRANDS, 'playzone9.app');
const SITES = { 'jsk-1.com': jsk1, 'playzone9.app': pz9 };

for (const [id, b] of Object.entries(SITES)) {
  check(id + ': assembled files', b.files.length > 0, b.files.length);
  check(id + ': passed its own verification', b.v.problems.length === 0, b.v.problems);
  check(id + ': is registered in CMS_BRANDS, so no warning', b.s.warnings.length === 0, b.s.warnings);
  let onDisk = 0;
  for (const rel of b.files) {
    const full = path.join(b.dir, rel);
    if (fs.existsSync(full) && fs.statSync(full).size > 0) onDisk++;
  }
  check(id + ': every file exists on disk and is non-empty',
    onDisk === b.files.length && onDisk > 0, onDisk + '/' + b.files.length);
}
check('both sites have the same file count -- one engine, two brands',
  jsk1.files.length === pz9.files.length, [jsk1.files.length, pz9.files.length]);
check('and exactly the same file LIST',
  JSON.stringify(jsk1.files) === JSON.stringify(pz9.files));
check('a site is more than its pages', jsk1.files.length > 100, jsk1.files.length);

/* The four layers are all actually present. */
check('layer 1: the shared engine was copied',
  jsk1.files.includes('js/cms.js') && jsk1.files.includes('css/style.css') &&
  jsk1.files.includes('admin/index.html') && jsk1.files.some(f => f.startsWith('assets/')));
check('layer 3: the brand\'s generated pages are there',
  jsk1.files.includes('index.html') && jsk1.files.includes('js/brand.js'));
check('layer 4: the SEO files are there',
  jsk1.files.includes('sitemap.xml') && jsk1.files.includes('robots.txt'));
check('build input is NOT published', !jsk1.files.includes('seo-config.json'));
check('the shared brand.js is not published as-is either -- layer 3 owns it',
  SITE.BRAND_OWNED.includes('js/brand.js'));

/* ====================================================================
   2. JSK1 IS STILL EXACTLY WHAT IS DEPLOYED
   ==================================================================== */
console.log('\n===== JSK1: ASSEMBLED == DEPLOYED =====');
{
  const PAGES = ['404.html', 'about.html', 'contact.html', 'index.html', 'login.html',
    'privacy-policy.html', 'register.html', 'responsible-gaming.html', 'js/brand.js'];
  let compared = 0, identical = 0;
  for (const rel of PAGES) {
    const a = path.join(jsk1.dir, rel), b = path.join(GOLDEN, rel);
    check('assembled ' + rel + ' exists', fs.existsSync(a));
    if (!fs.existsSync(a) || !fs.existsSync(b)) continue;
    compared++;
    if (sha(a) === sha(b)) identical++;
    else check(rel + ' is byte-identical to its Phase 0 fixture', false);
  }
  check('all nine were compared', compared === 9, compared);
  check('all nine are byte-identical to the Phase 0 fixtures', identical === 9, identical);

  /* Shared files are byte copies, so they must be exactly the live ones. */
  let sharedSame = 0, sharedChecked = 0;
  for (const rel of jsk1.s.shared) {
    sharedChecked++;
    if (sha(path.join(jsk1.dir, rel)) === sha(path.join(ROOT, rel))) sharedSame++;
    else check('shared ' + rel + ' is a byte copy of the live file', false);
  }
  check('the shared engine was compared file by file', sharedChecked > 100, sharedChecked);
  check('every shared file is a byte copy of the live one', sharedSame === sharedChecked, sharedSame);

  /* sitemap.xml and robots.txt differ from the deployed pair by ONE line:
     the provenance comment naming which committed fallback was read. The
     assembler reads the brand's own copy; the root deploy reads
     tools/seo-config.json. Those two files are byte-identical (Phase 4
     asserts it), so the SETTINGS are the same and only the path differs.
     Asserted precisely rather than waved at, and flagged for a decision. */
  for (const rel of ['sitemap.xml', 'robots.txt']) {
    const a = fs.readFileSync(path.join(jsk1.dir, rel), 'utf8').split('\n');
    const b = fs.readFileSync(path.join(GOLDEN, rel), 'utf8').split('\n');
    check(rel + ': same number of lines as deployed', a.length === b.length, [a.length, b.length]);
    const diff = a.map((l, i) => l === b[i] ? null : i).filter(i => i !== null);
    check(rel + ': exactly one line differs from deployed', diff.length === 1, diff);
    if (diff.length === 1) {
      check(rel + ': and that line is the provenance comment',
        /source:/.test(a[diff[0]]) && /source:/.test(b[diff[0]]), [a[diff[0]], b[diff[0]]]);
      check(rel + ': both name a committed fallback, not the live record',
        /committed fallback/.test(a[diff[0]]) && /committed fallback/.test(b[diff[0]]));
    }
    const strip = x => x.filter(l => !/source:/.test(l)).join('\n');
    check(rel + ': identical once the provenance line is removed', strip(a) === strip(b));
  }
  check('the two seo-config.json files really are the same settings',
    sha(path.join(PROD_BRANDS, 'jsk-1.com', 'seo-config.json')) === sha(path.join(ROOT, 'tools', 'seo-config.json')));
  check('JSK1\'s sitemap points at jsk-1.com',
    fs.readFileSync(path.join(jsk1.dir, 'sitemap.xml'), 'utf8').includes('https://jsk-1.com/'));
}

/* ====================================================================
   3. PLAYZONE9 IS PLAYZONE9
   ==================================================================== */
console.log('\n===== PLAYZONE9 GETS ITS OWN SITE =====');
{
  const brandJs = fs.readFileSync(path.join(pz9.dir, 'js/brand.js'), 'utf8');
  check('its brand.js is its own', /Playzone9/.test(brandJs) && !/JSK1/.test(brandJs));
  check('its brand.js is NOT the shared copy',
    brandJs !== fs.readFileSync(path.join(ROOT, 'js', 'brand.js'), 'utf8'));
  check('its brand.js is byte-identical to what it ships in brands/',
    sha(path.join(pz9.dir, 'js/brand.js')) === sha(path.join(PROD_BRANDS, 'playzone9.app', 'brand.js')));
  check('it sets its own baseUrl', /https:\/\/playzone9\.app/.test(brandJs));
  /* Parsed, not pattern-matched. The three keys below are present in
     DEFAULTS with EMPTY values, and paintText writes an empty string
     rather than skipping it -- so a brand that supplies the key but
     leaves it blank WIPES its own static copy. Only reading the values
     catches that. */
  const sb = { window: {} };
  vm.runInNewContext(brandJs, sb, { timeout: 2000 });
  const B = sb.window.CMS_BRAND;
  check('its brand.js parses and sets window.CMS_BRAND', !!B && typeof B === 'object');
  const EMPTY_IN_DEFAULTS = ['footer.about', 'footer.copyright', 'support.whatsappMessage'];
  check('it supplies all three keys DEFAULTS deliberately leaves empty',
    !!B.text && EMPTY_IN_DEFAULTS.every(k => typeof B.text[k] === 'string'), B.text);
  check('and every one of them is NON-empty, or paintText would blank the static copy',
    EMPTY_IN_DEFAULTS.every(k => B.text[k] && B.text[k].trim().length > 0), B.text);
  check('nothing anywhere in its data layer mentions JSK1',
    !/JSK1|jsk-1/.test(JSON.stringify(B)));
  check('its page titles are its own',
    /Playzone9/.test(B.pages.home.title) && !/JSK1/.test(B.pages.home.title), B.pages.home.title);
  check('its seo baseUrl is its own domain', B.seo.baseUrl === 'https://playzone9.app', B.seo.baseUrl);
  check('its branding.siteName is its own', B.branding.siteName === 'Playzone9', B.branding.siteName);

  const pages = pz9.files.filter(f => /^[a-z0-9-]+\.html$/.test(f));
  check('it has the eight pages', pages.length === 8, pages);
  let named = 0;
  for (const p of pages) {
    const html = fs.readFileSync(path.join(pz9.dir, p), 'utf8');
    if (/Playzone9/.test(html)) named++; else check(p + ' carries the Playzone9 name', false);
    if (/JSK1|jsk-1\.com/.test(html)) check(p + ' must not carry JSK1', false);
  }
  check('all eight pages were checked', named === 8, named);
  check('all eight name Playzone9 and none names JSK1', named === 8);

  /* The siteId the SEO step actually resolved. This is the ONLY place the
     row a brand reads becomes observable without a live database, and it
     is the most dangerous value in the system: two brands sharing a siteId
     means two sites publishing over each other. Egress is blocked here, so
     the sitemap alone cannot prove it -- the brand's own committed
     fallback would produce the right domain even if the wrong row had been
     asked for. */
  check('the SEO step reported which brand it resolved',
    /^Brand:\s+\S/m.test(pz9.seoLog), pz9.seoLog.split('\n')[0]);
  check('and it resolved playzone9.app, not the default brand',
    /^Brand:\s+playzone9\.app\b/m.test(pz9.seoLog),
    (pz9.seoLog.match(/^Brand:.*$/m) || [''])[0]);
  check('to Playzone9\'s OWN row, not JSK1\'s',
    /^Brand:.*siteId:\s+playzone9app\s*$/m.test(pz9.seoLog),
    (pz9.seoLog.match(/^Brand:.*$/m) || [''])[0]);
  check('JSK1\'s assembly resolved JSK1\'s row',
    /^Brand:\s+jsk-1\.com\s+siteId:\s+playzone9\s*$/m.test(jsk1.seoLog),
    (jsk1.seoLog.match(/^Brand:.*$/m) || [''])[0]);
  check('the two assemblies resolved different rows',
    (pz9.seoLog.match(/siteId:\s+(\S+)/) || [])[1] !== (jsk1.seoLog.match(/siteId:\s+(\S+)/) || [])[1]);

  const smap = fs.readFileSync(path.join(pz9.dir, 'sitemap.xml'), 'utf8');
  check('its sitemap points at playzone9.app', smap.includes('https://playzone9.app/'));
  check('its sitemap does NOT point at jsk-1.com', !smap.includes('jsk-1.com'));
  const rob = fs.readFileSync(path.join(pz9.dir, 'robots.txt'), 'utf8');
  check('its robots.txt names its own sitemap', rob.includes('https://playzone9.app/sitemap.xml'));
  check('its robots.txt still disallows /admin/', rob.includes('Disallow: /admin/'));

  /* The one shared file that legitimately names both brands. */
  const cfg = fs.readFileSync(path.join(pz9.dir, 'js/cms-config.js'), 'utf8');
  check('it ships the shared registry, which names both brands by design',
    /jsk-1\.com/.test(cfg) && /playzone9\.app/.test(cfg));
  check('the registry it ships is the live one byte-for-byte',
    sha(path.join(pz9.dir, 'js/cms-config.js')) === sha(path.join(ROOT, 'js', 'cms-config.js')));

  /* Contamination sweep over everything else. */
  const leaks = [];
  let scanned = 0;
  for (const rel of pz9.files.filter(f => /\.(html|js|json|xml|txt|css|svg)$/.test(f))) {
    if (rel === 'js/cms-config.js') continue;
    scanned++;
    if (/JSK1|jsk-1\.com/.test(fs.readFileSync(path.join(pz9.dir, rel), 'utf8'))) leaks.push(rel);
  }
  check('Playzone9\'s servable files were scanned', scanned > 20, scanned);
  check('no file but the shared registry mentions JSK1', leaks.length === 0, leaks);

  /* And the reverse. */
  const back = [];
  for (const rel of jsk1.files.filter(f => /\.(html|js|json|xml|txt|css|svg)$/.test(f))) {
    if (rel === 'js/cms-config.js') continue;
    if (/Playzone9|playzone9\.app/.test(fs.readFileSync(path.join(jsk1.dir, rel), 'utf8'))) back.push(rel);
  }
  check('nothing in JSK1\'s site mentions Playzone9', back.length === 0, back);

  /* The dangerous collision, asserted on the built artefact. */
  check('the two brands resolve to different Supabase rows',
    jsk1.s.plan.brand.siteId !== pz9.s.plan.brand.siteId,
    [jsk1.s.plan.brand.siteId, pz9.s.plan.brand.siteId]);
  check('and Playzone9 is NOT pointed at JSK1\'s row',
    pz9.s.plan.brand.siteId !== 'playzone9', pz9.s.plan.brand.siteId);
}

/* ====================================================================
   3b. SEO, PER BRAND, WITH NOTHING CROSSING OVER
   Every page carries its SEO baked in as the static fallback a crawler
   reads before any JavaScript runs. That makes SEO a property of the
   ASSEMBLED FILES, not of the runtime -- so it is asserted on them, for
   both brands, property by property. A canonical or a sitemap URL
   pointing at the other brand's domain is the most expensive mistake
   this architecture can make: it hands one brand's ranking to the other
   and looks like duplicate content to a crawler.
   ==================================================================== */
console.log('\n===== SEO IS PER-BRAND AND DOES NOT CROSS OVER =====');
{
  const DOMAIN = { 'jsk-1.com': 'jsk-1.com', 'playzone9.app': 'playzone9.app' };
  const OTHER = { 'jsk-1.com': 'playzone9.app', 'playzone9.app': 'jsk-1.com' };
  const PAGES = ['index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
    'privacy-policy.html', 'responsible-gaming.html', '404.html'];
  /* Which pages a crawler is invited to index, from tools/seo-config.json.
     Enumerated so a change to it has to be deliberate. */
  const INDEXABLE = ['index.html', 'about.html', 'contact.html',
    'privacy-policy.html', 'responsible-gaming.html'];
  const NOINDEX = ['login.html', 'register.html', '404.html'];
  const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };

  for (const [id, b] of Object.entries(SITES)) {
    const own = DOMAIN[id], other = OTHER[id];
    const heads = {};
    let read = 0;
    for (const p of PAGES) {
      const f = path.join(b.dir, p);
      if (!fs.existsSync(f)) { check(id + ': ' + p + ' exists to check SEO on', false); continue; }
      heads[p] = fs.readFileSync(f, 'utf8').split('</head>')[0];
      read++;
    }
    check(id + ': all eight pages were read for SEO', read === 8, read);
    if (read !== 8) continue;

    /* --- canonical: present, absolute, own domain, right path --- */
    let canon = 0;
    for (const p of PAGES) {
      const c = attr(heads[p], /<link rel="canonical" href="([^"]+)"/);
      if (p === '404.html') { if (c === null) canon++; else check(id + '/404.html should not claim a canonical', false); continue; }
      const want = 'https://' + own + (p === 'index.html' ? '/' : '/' + p);
      if (c === want) canon++;
      else check(id + '/' + p + ': canonical is ' + c + ', expected ' + want, false);
    }
    check(id + ': every canonical points at its own domain and own path', canon === 8, canon);

    /* --- index / noindex --- */
    let robotsOk = 0;
    for (const p of INDEXABLE) {
      const r = attr(heads[p], /<meta name="robots" content="([^"]+)"/);
      if (r === 'index,follow') robotsOk++;
      else check(id + '/' + p + ': robots is "' + r + '", expected index,follow', false);
    }
    for (const p of NOINDEX) {
      const r = attr(heads[p], /<meta name="robots" content="([^"]+)"/);
      if (r && /noindex/.test(r)) robotsOk++;
      else check(id + '/' + p + ': robots is "' + r + '", expected noindex', false);
    }
    check(id + ': all eight robots directives are as configured', robotsOk === 8, robotsOk);

    /* --- unique titles and descriptions within the brand --- */
    const titles = PAGES.map(p => attr(heads[p], /<title[^>]*>([^<]+)<\/title>/));
    const descs = PAGES.map(p => attr(heads[p], /<meta name="description"[^>]*content="([^"]+)"/));
    check(id + ': every page has a title', titles.every(t => t && t.trim()), titles);
    check(id + ': every page has a meta description', descs.every(d => d && d.trim()), descs);
    check(id + ': all eight titles are unique', new Set(titles).size === 8, titles.length + ' -> ' + new Set(titles).size);
    check(id + ': all eight descriptions are unique',
      new Set(descs).size === 8, descs.length + ' -> ' + new Set(descs).size);
    check(id + ': every title names the brand',
      titles.every(t => t.includes(id === 'jsk-1.com' ? 'JSK1' : 'Playzone9')), titles);

    /* --- Open Graph and Twitter --- */
    const og = heads['index.html'];
    check(id + ': og:type is set', /property="og:type" content="website"/.test(og));
    check(id + ': og:site_name is the brand',
      attr(og, /property="og:site_name" content="([^"]+)"/) === (id === 'jsk-1.com' ? 'JSK1' : 'Playzone9'));
    check(id + ': og:url is its own domain',
      attr(og, /property="og:url" content="([^"]+)"/) === 'https://' + own + '/');
    check(id + ': og:title and og:description are set',
      /property="og:title" content="[^"]+"/.test(og) && /property="og:description" content="[^"]+"/.test(og));
    check(id + ': twitter:card, title and description are set',
      /name="twitter:card" content="[^"]+"/.test(og) &&
      /name="twitter:title" content="[^"]+"/.test(og) &&
      /name="twitter:description" content="[^"]+"/.test(og));

    /* --- structured data --- */
    const ld = [...og.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    check(id + ': the home page ships JSON-LD', ld.length === 2, ld.length);
    let parsed = 0;
    for (const raw of ld) {
      let j = null;
      try { j = JSON.parse(raw); } catch (e) { check(id + ': JSON-LD does not parse: ' + e.message, false); continue; }
      parsed++;
      check(id + ': ' + j['@type'] + ' schema names the brand',
        j.name === (id === 'jsk-1.com' ? 'JSK1' : 'Playzone9'), j.name);
      check(id + ': ' + j['@type'] + ' schema url is its own domain',
        j.url === 'https://' + own + '/', j.url);
    }
    check(id + ': both JSON-LD blocks parsed', parsed === 2, parsed);
    const types = ld.map(r => { try { return JSON.parse(r)['@type']; } catch (e) { return null; } });
    check(id + ': Organization and WebSite are both declared',
      types.includes('Organization') && types.includes('WebSite'), types);

    /* --- internal links stay relative, so they work on any domain --- */
    let linked = 0; const absolute = [];
    for (const p of PAGES) {
      for (const m of fs.readFileSync(path.join(b.dir, p), 'utf8')
        .matchAll(/(?:href|src)="((?!https?:|\/\/|#|mailto:|tel:|javascript:)[^"]+)"/g)) {
        linked++;
        if (m[1].charAt(0) === '/') absolute.push(p + ' -> ' + m[1]);
      }
    }
    check(id + ': internal links were found to check', linked > 40, linked);
    check(id + ': no internal link is root-absolute', absolute.length === 0, absolute);

    /* --- sitemap: only its own URLs --- */
    const xml = fs.readFileSync(path.join(b.dir, 'sitemap.xml'), 'utf8');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    check(id + ': the sitemap lists URLs', locs.length === 5, locs.length);
    check(id + ': every sitemap URL is on its own domain',
      locs.every(u => u.startsWith('https://' + own + '/')), locs);
    check(id + ': NO sitemap URL is on the other brand\'s domain',
      !locs.some(u => u.includes(other)), locs);
    check(id + ': the sitemap lists exactly the indexable pages',
      JSON.stringify(locs.map(u => u.replace('https://' + own + '/', '') || 'index.html').sort()) ===
      JSON.stringify(INDEXABLE.slice().sort()), locs);
    for (const p of NOINDEX) {
      check(id + ': ' + p + ' is noindex AND absent from the sitemap',
        !locs.some(u => u.endsWith('/' + p)));
    }

    /* --- robots.txt --- */
    const rob = fs.readFileSync(path.join(b.dir, 'robots.txt'), 'utf8');
    check(id + ': robots.txt names its own sitemap',
      rob.includes('Sitemap: https://' + own + '/sitemap.xml'), rob.match(/Sitemap:.*/));
    check(id + ': robots.txt does NOT name the other brand',
      !rob.includes(other), rob.match(new RegExp('.*' + other.replace('.', '\\.') + '.*')));
    check(id + ': robots.txt still keeps the admin panel out', rob.includes('Disallow: /admin/'));
    check(id + ': robots.txt still allows the site', /^Allow: \/$/m.test(rob));

    /* --- the other brand's domain appears nowhere in its SEO surface --- */
    let sweep = 0; const bleed = [];
    for (const p of [...PAGES, 'sitemap.xml', 'robots.txt']) {
      sweep++;
      if (fs.readFileSync(path.join(b.dir, p), 'utf8').includes(other)) bleed.push(p);
    }
    check(id + ': its whole SEO surface was swept', sweep === 10, sweep);
    check(id + ': the other brand\'s domain appears in none of it', bleed.length === 0, bleed);
  }

  /* --- and the two brands do not share a single URL or title --- */
  const jLocs = [...fs.readFileSync(path.join(jsk1.dir, 'sitemap.xml'), 'utf8')
    .matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const pLocs = [...fs.readFileSync(path.join(pz9.dir, 'sitemap.xml'), 'utf8')
    .matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  check('both sitemaps were parsed', jLocs.length === 5 && pLocs.length === 5, [jLocs.length, pLocs.length]);
  check('the two sitemaps share no URL at all',
    jLocs.filter(u => pLocs.includes(u)).length === 0, jLocs.filter(u => pLocs.includes(u)));
  check('and they cover the same page set on different domains',
    JSON.stringify(jLocs.map(u => u.replace('https://jsk-1.com', ''))) ===
    JSON.stringify(pLocs.map(u => u.replace('https://playzone9.app', ''))));
  const jTitle = fs.readFileSync(path.join(jsk1.dir, 'index.html'), 'utf8').match(/<title[^>]*>([^<]+)</)[1];
  const pTitle = fs.readFileSync(path.join(pz9.dir, 'index.html'), 'utf8').match(/<title[^>]*>([^<]+)</)[1];
  check('the two home pages have different titles', jTitle !== pTitle, [jTitle, pTitle]);

  /* SEO configuration is per brand, not a shared hardcoded value. */
  check('each brand ships its own seo-config.json',
    fs.existsSync(path.join(PROD_BRANDS, 'jsk-1.com', 'seo-config.json')) &&
    fs.existsSync(path.join(PROD_BRANDS, 'playzone9.app', 'seo-config.json')));
  const jc = JSON.parse(fs.readFileSync(path.join(PROD_BRANDS, 'jsk-1.com', 'seo-config.json'), 'utf8'));
  const pc = JSON.parse(fs.readFileSync(path.join(PROD_BRANDS, 'playzone9.app', 'seo-config.json'), 'utf8'));
  check('their baseUrls differ and each is its own domain',
    jc.seo.baseUrl === 'https://jsk-1.com' && pc.seo.baseUrl === 'https://playzone9.app',
    [jc.seo.baseUrl, pc.seo.baseUrl]);
  check('neither config mentions the other brand',
    !JSON.stringify(jc).includes('playzone9.app') && !JSON.stringify(pc).includes('jsk-1.com'));
  check('and neither is published onto its own domain',
    !jsk1.files.includes('seo-config.json') && !pz9.files.includes('seo-config.json'));
}

/* ====================================================================
   4. THE SHARED ENGINE CARRIES NO BRAND
   ==================================================================== */
console.log('\n===== ONE ENGINE, NO BRAND IN IT =====');
{
  const shared = jsk1.s.shared.filter(f => /\.(js|css|html|json)$/.test(f) && f !== 'js/cms-config.js');
  check('there are shared text files to scan', shared.length > 5, shared.length);
  const branded = shared.filter(f =>
    /JSK1|jsk-1\.com|Playzone9|playzone9\.app/.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
  check('no shared engine file names any brand', branded.length === 0, branded);
  check('the admin panel\'s static brand label is neutral',
    /<small id="brandLabel">BRAND<\/small>/.test(fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8')));
  check('and its tab title is painted from the brand at runtime',
    /document\.title = brandName/.test(fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8')));
}

/* ====================================================================
   5. THE OVERLAY AND BOTH SLOT POINTS
   omega.test is synthetic and lives in tests/fixtures/brands/, so it can
   never be built by --list and is not in CMS_BRANDS.
   ==================================================================== */
console.log('\n===== A BRAND\'S OWN ASSETS, LOGIN AND REGISTER =====');
{
  const om = build(SYNTH_BRANDS, 'omega.test');
  check('omega.test assembled', om.files.length > 0, om.files.length);
  check('and passed verification', om.v.problems.length === 0, om.v.problems);
  check('its overlay was found', om.s.overlay.length === 2, om.s.overlay);
  check('the overlay lists both a replacement and an addition',
    om.s.overlay.includes('css/style.css') && om.s.overlay.includes('assets/images/omega-logo.svg'),
    om.s.overlay);

  const css = fs.readFileSync(path.join(om.dir, 'css/style.css'), 'utf8');
  check('css/style.css is the BRAND\'s stylesheet, not the shared one',
    /omega-brand-overlay/.test(css));
  check('and it really differs from the shared one',
    css !== fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8'));
  check('an overlay-only asset is published', om.files.includes('assets/images/omega-logo.svg'));
  check('and the shared assets are still there too',
    om.files.filter(f => f.startsWith('assets/')).length > 50,
    om.files.filter(f => f.startsWith('assets/')).length);

  /* Requirement: brand-specific login AND register HTML, through the
     existing slot/override architecture, with no edit to js/cms.js. */
  check('both slot points are declared by the shared templates',
    om.s.plan.slotsDeclared.includes('login-notice') &&
    om.s.plan.slotsDeclared.includes('register-notice'), om.s.plan.slotsDeclared);
  const login = fs.readFileSync(path.join(om.dir, 'login.html'), 'utf8');
  const reg = fs.readFileSync(path.join(om.dir, 'register.html'), 'utf8');
  check('its login page carries its own notice', /omega-login-note/.test(login));
  check('its register page carries its own notice', /omega-register-note/.test(reg));
  check('the login notice is the slot file, exactly as written',
    login.includes(fs.readFileSync(path.join(SYNTH_BRANDS, 'omega.test', 'slots', 'login-notice.html'), 'utf8')));
  check('the register notice is the slot file, exactly as written',
    reg.includes(fs.readFileSync(path.join(SYNTH_BRANDS, 'omega.test', 'slots', 'register-notice.html'), 'utf8')));
  check('and both still load the shared engine, unmodified',
    /src="js\/cms\.js"/.test(login) && /src="js\/cms\.js"/.test(reg));
  check('js/cms.js is byte-identical after all of it',
    sha(path.join(ROOT, 'js', 'cms.js')) === liveBefore['js/cms.js']);

  /* zeta.test ships no seo-config.json. It GENERATES fine -- Phase 4
     treats that file as optional -- but it must not ASSEMBLE, because
     without it the sitemap would describe whichever brand
     tools/seo-config.json happens to name. This suite found exactly that
     happening and the assembler now refuses it. */
  refuses('a brand with no seo-config.json is refused, not given another brand\'s sitemap',
    () => SITE.planSite({ brandsDir: SYNTH_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: 'zeta.test' }),
    /has no seo-config\.json[\s\S]*another brand's domain[\s\S]*https:\/\/zeta\.test/);
  check('but it still GENERATES, so Phase 4 behaviour is unchanged', (() => {
    const p = KIT.planBrand({ brandsDir: SYNTH_BRANDS, templatesDir: TEMPLATES, id: 'zeta.test' });
    return p.files.length === 4 && /zeta-signin/.test(p.files.find(f => f.path === 'login.html').contents);
  })());
  check('and its whole-page override did not leak into omega\'s login page',
    !/zeta-signin/.test(login));

  /* One brand's customisation reaches no other site. */
  const marks = ['omega-login-note', 'omega-register-note', 'omega-brand-overlay'];
  let swept = 0; const crossed = [];
  for (const [id, b] of Object.entries(SITES)) {
    for (const rel of b.files.filter(f => /\.(html|css|js)$/.test(f))) {
      swept++;
      const body = fs.readFileSync(path.join(b.dir, rel), 'utf8');
      for (const m of marks) if (body.includes(m)) crossed.push(id + '/' + rel + ' has ' + m);
    }
  }
  check('both real sites were swept for the synthetic brand\'s content', swept > 40, swept);
  check('no synthetic customisation reached a real site', crossed.length === 0, crossed);

  /* An unregistered brand assembles, and is told so. */
  check('omega.test is not in CMS_BRANDS, and the assembler says so',
    om.s.warnings.length === 1 && /not in CMS_BRANDS/.test(om.s.warnings[0]), om.s.warnings);
  check('the warning names the brands that ARE registered',
    /jsk-1\.com/.test(om.s.warnings[0]) && /playzone9\.app/.test(om.s.warnings[0]), om.s.warnings);
}

/* ====================================================================
   6. THE ASSEMBLER REFUSES CLEARLY
   ==================================================================== */
console.log('\n===== CLEAR REFUSALS =====');
{
  refuses('an unknown brand is refused',
    () => SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: 'nope.example' }),
    /Unknown brand/);
  refuses('a traversal brand id is refused',
    () => SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: '../tools' }),
    /\.\.|not a valid identifier/);
  refuses('a missing shared engine is refused rather than assembling a shell',
    () => SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: mktmp('bare'), id: 'jsk-1.com' }),
    /Shared directory "js" is missing/);

  /* The output directory cannot be escaped, and the sentinel proves it. */
  const box = mktmp('box');
  const outRoot = path.join(box, 'sites');
  fs.mkdirSync(outRoot);
  const sentinel = path.join(box, 'DO-NOT-TOUCH.txt');
  fs.writeFileSync(sentinel, 'original');
  const s = SITE.planSite({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: 'jsk-1.com' });
  const escaped = JSON.parse(JSON.stringify({ o: s.plan.brand.output })).o;
  check('the real output name is not an escape', escaped === 'jsk-1.com');
  refuses('an output name that escapes is refused', () => {
    const bad = Object.assign({}, s, { plan: Object.assign({}, s.plan,
      { brand: Object.assign({}, s.plan.brand, { output: '../escaped' }) }) });
    SITE.assemble(bad, outRoot);
  }, /resolves outside/);
  check('the sentinel beside the output root is untouched',
    fs.readFileSync(sentinel, 'utf8') === 'original');
  check('no escaped directory was created', !fs.existsSync(path.join(box, 'escaped')));
}

/* ====================================================================
   7. DETERMINISM, AND THE REPOSITORY IS UNTOUCHED
   ==================================================================== */
console.log('\n===== SAME INPUT, SAME SITE =====');
{
  const again = build(PROD_BRANDS, 'playzone9.app');
  check('a second assembly produced the same file list',
    JSON.stringify(again.files) === JSON.stringify(pz9.files));
  let same = 0;
  for (const rel of pz9.files) {
    if (sha(path.join(again.dir, rel)) === sha(path.join(pz9.dir, rel))) same++;
    else check(rel + ' differs between two identical assemblies', false);
  }
  check('every file was hash-compared across the two assemblies',
    same === pz9.files.length && same > 100, same);
  check('two assemblies are byte-identical', same === pz9.files.length);
}

console.log('\n===== THE ASSEMBLER DID NOT WRITE INTO THE REPO =====');
{
  let rehashed = 0;
  for (const f of LIVE) {
    if (sha(path.join(ROOT, f)) !== liveBefore[f]) check(f + ' is unchanged by the test run', false);
    rehashed++;
  }
  check('all fifteen live files were re-hashed', rehashed === 15, rehashed);
  check('every live production file is unchanged', true);
  check('every assembly went outside the repository',
    tmpRoots.length > 0 && tmpRoots.every(d => !path.resolve(d).startsWith(ROOT + path.sep)), tmpRoots.length);
}

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
