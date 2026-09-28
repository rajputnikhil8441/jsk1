#!/usr/bin/env node
/* =====================================================================
   ONE CMS, MANY BRANDS — THE DELIVERY LAYER
   ---------------------------------------------------------------------
   The repository has had one shared engine and per-brand data since
   Phase 5. What it did NOT have was a way for the second brand's SITE to
   be built from that engine: jsk-1.com was deployed by static.yml, and
   playzones9.com was a directory someone copied into another repository
   once. A copy freezes. Every shared CMS fix after that copy reached
   JSK1 and never reached Playzone9 -- not because the code was not
   shared, but because nothing rebuilt the second site.

   .github/workflows/deploy-playzone9.yml closes that, and this suite is
   what stops it from silently coming undone. It asserts the two claims
   that make a white label real, and it asserts them TOGETHER, because
   either one alone is worthless:

     SHARED CODE   the engine bytes in Playzone9's site are the same
                   bytes as in JSK1's site and as in this repository. A
                   fix lands once.
     SEPARATE DATA every brand-identifying value differs: the row, the
                   bucket, the storage namespace, the brand layer, the
                   content, the SEO. A fix reaches both; content never
                   crosses.

   The bake is asserted for BOTH brands from the real brand directories,
   because "the mechanism works" is not the same claim as "it works for
   this brand".

   Nothing is written inside the repository: every build goes to a
   throwaway directory, and the brand directories are copied before a
   fixture touches them.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const KIT = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));
const SITE = require(path.join(ROOT, 'tools', 'lib', 'sitekit.js'));
const SHELL = require(path.join(__dirname, 'lib', 'pbshell.js'));

const PROD_BRANDS = path.join(ROOT, 'brands');
const SYNTH_BRANDS = path.join(__dirname, 'fixtures', 'brands');
const TEMPLATES = path.join(ROOT, 'templates');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'whitelabel-' + tag + '-'));
  tmpRoots.push(d); return d;
}
function walk(dir, base, out) {
  base = base || dir; out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

/* Build a brand exactly as its deploy does. */
function build(brandsDir, id, env, tag) {
  const out = mktmp(tag);
  const s = SITE.planSite({ brandsDir: brandsDir, templatesDir: TEMPLATES,
                            sharedRoot: ROOT, id: id, env: env || '' });
  const res = SITE.assemble(s, out);
  return { s: s, dir: res.dir, files: walk(res.dir), v: SITE.verify(s, res.dir) };
}

/* What js/cms-config.js resolves for a hostname -- the real file, read the
   way a browser reads it. */
function resolve(host) {
  const sandbox = { window: { location: { hostname: host } } };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8'),
                     sandbox, { timeout: 2000 });
  return {
    siteId: (sandbox.window.CMS_REMOTE || {}).siteId,
    bucket: (sandbox.window.CMS_MEDIA || {}).bucket,
    storage: (sandbox.window.CMS_STORAGE || {}).key('whiteLabelCMS'),
    matched: (sandbox.window.CMS_BRAND_RESOLVED || {}).matched
  };
}

/* The two real brands, built from the one shared source. */
const jsk1 = build(PROD_BRANDS, 'jsk-1.com', '', 'jsk1');
const pz9 = build(PROD_BRANDS, 'playzone9.app', 'staging', 'pz9');

/* ====================================================================
   1. BOTH SITES ARE BUILT, AND BOTH PASS THEIR OWN CHECKS
   ==================================================================== */
console.log('\n===== TWO BRANDS, ONE BUILD SYSTEM =====');
check('JSK1 assembles', jsk1.files.length > 0, jsk1.files.length);
check('JSK1 passes its own verification', jsk1.v.problems.length === 0, jsk1.v.problems);
check('Playzone9 assembles', pz9.files.length > 0, pz9.files.length);
check('Playzone9 passes its own verification', pz9.v.problems.length === 0, pz9.v.problems);
check('both were produced by the same assembler', typeof SITE.assemble === 'function');
check('JSK1 is served from its own domain', jsk1.s.plan.brand.domain === 'jsk-1.com',
  jsk1.s.plan.brand.domain);
check('Playzone9 staging is served from playzones9.com', pz9.s.plan.brand.domain === 'playzones9.com',
  pz9.s.plan.brand.domain);
check('and its canonical domain is NOT what was built', pz9.s.plan.brand.canonicalDomain === 'playzone9.app',
  pz9.s.plan.brand.canonicalDomain);

/* ====================================================================
   2. THE SHARED ENGINE IS THE SAME BYTES IN BOTH SITES
   The claim a white label lives or dies on: one fix, every brand.
   ==================================================================== */
console.log('\n===== THE ENGINE IS SHARED, BYTE FOR BYTE =====');
const ENGINE = ['js/cms.js', 'js/admin.js', 'js/admin-builder.js', 'js/admin-media.js',
  'js/seo-files.js', 'js/cms-config.js', 'js/main.js', 'js/menu.js',
  'admin/index.html', 'css/style.css', 'css/admin.css', 'css/sections.css'];
let same = 0, fromRepo = 0;
for (const rel of ENGINE) {
  const a = path.join(jsk1.dir, rel), b = path.join(pz9.dir, rel), r = path.join(ROOT, rel);
  if (!fs.existsSync(a) || !fs.existsSync(b)) { check(rel + ' is in both sites', false); continue; }
  if (sha(a) === sha(b)) same++; else check(rel + ' is identical in both sites', false, rel);
  if (sha(a) === sha(r)) fromRepo++; else check(rel + ' came from the repository unchanged', false, rel);
}
check('every engine file is identical in both sites', same === ENGINE.length,
  same + '/' + ENGINE.length);
check('and every one of them IS the repository copy', fromRepo === ENGINE.length,
  fromRepo + '/' + ENGINE.length);
check('the engine list is not empty', ENGINE.length >= 12, ENGINE.length);

/* One copy in the repository, not one per brand. If a brand directory
   ever grows an engine file, a fix would stop reaching that brand and
   this is where it is caught. */
const brandFiles = fs.readdirSync(PROD_BRANDS)
  .filter(d => fs.statSync(path.join(PROD_BRANDS, d)).isDirectory())
  .flatMap(d => walk(path.join(PROD_BRANDS, d)).map(f => d + '/' + f));
check('there ARE brand directories to check', brandFiles.length > 0, brandFiles.length);
const engineInBrand = brandFiles.filter(f => /(^|\/)(cms|admin|admin-builder|admin-media|seo-files|cms-config)\.js$/.test(f));
check('no brand directory carries a copy of the engine', engineInBrand.length === 0, engineInBrand);
const ALLOWED_BRAND_FILES = /(^|\/)(brand\.json|brand\.js|seo-config\.json|README\.md)$|^[^/]+\/(slots|static|static-[a-z0-9-]+|pages)\//;
const strays = brandFiles.filter(f => !ALLOWED_BRAND_FILES.test(f));
check('a brand owns only its configuration, layer, SEO config and overrides',
  strays.length === 0, strays);

/* ====================================================================
   3. BRAND DATA IS SEPARATE, AT EVERY LAYER
   ==================================================================== */
console.log('\n===== THE DATA IS NOT SHARED =====');
const R = { jsk1: resolve('jsk-1.com'), pz9: resolve('playzones9.com'), app: resolve('playzone9.app') };
check('jsk-1.com is a configured brand', R.jsk1.matched === true, R.jsk1);
check('playzones9.com is a configured brand', R.pz9.matched === true, R.pz9);
check('their Supabase rows differ', R.jsk1.siteId && R.pz9.siteId && R.jsk1.siteId !== R.pz9.siteId,
  [R.jsk1.siteId, R.pz9.siteId]);
check('their media buckets differ', R.jsk1.bucket !== R.pz9.bucket, [R.jsk1.bucket, R.pz9.bucket]);
check('their browser storage namespaces differ', R.jsk1.storage !== R.pz9.storage,
  [R.jsk1.storage, R.pz9.storage]);
check('the staging host does not share the launch host\'s row',
  R.pz9.siteId !== R.app.siteId, [R.pz9.siteId, R.app.siteId]);
check('the row the build reports matches the row the browser resolves',
  jsk1.s.plan.brand.siteId === R.jsk1.siteId && pz9.s.plan.brand.siteId === R.pz9.siteId,
  [jsk1.s.plan.brand.siteId, pz9.s.plan.brand.siteId]);

/* The brand layer: each site ships its OWN, and it is the committed one. */
check('JSK1 ships its own brand layer',
  sha(path.join(jsk1.dir, 'js', 'brand.js')) === sha(path.join(PROD_BRANDS, 'jsk-1.com', 'brand.js')));
check('Playzone9 ships its own brand layer, not JSK1\'s',
  sha(path.join(pz9.dir, 'js', 'brand.js')) !== sha(path.join(jsk1.dir, 'js', 'brand.js')));
const pzBrand = SHELL.readBrand(path.join(pz9.dir, 'js', 'brand.js'));
const jsBrand = SHELL.readBrand(path.join(jsk1.dir, 'js', 'brand.js'));
check('Playzone9\'s layer names Playzone9', /playzone9/i.test(String(pzBrand.branding.siteName)),
  pzBrand.branding.siteName);
check('JSK1\'s layer names JSK1', /jsk\s?1/i.test(String(jsBrand.branding.siteName)),
  jsBrand.branding.siteName);
check('and the two site names are different', pzBrand.branding.siteName !== jsBrand.branding.siteName);

/* ====================================================================
   4. NO CONTENT CROSSES BETWEEN THE TWO SITES
   ==================================================================== */
console.log('\n===== NEITHER BRAND\'S CONTENT REACHES THE OTHER =====');
const pzPages = pz9.files.filter(f => /\.html$/.test(f));
const jsPages = jsk1.files.filter(f => /\.html$/.test(f));
check('both sites have pages to scan', pzPages.length >= 8 && jsPages.length >= 8,
  [jsPages.length, pzPages.length]);
/* admin/index.html is shared engine and carries neither brand's content;
   the brand-owned pages are what must not leak. */
const pzLeaks = pzPages.filter(f => f !== 'admin/index.html')
  .filter(f => /jsk-?1/i.test(fs.readFileSync(path.join(pz9.dir, f), 'utf8')));
check('no Playzone9 page mentions JSK1', pzLeaks.length === 0, pzLeaks);
const jsLeaks = jsPages.filter(f => f !== 'admin/index.html')
  .filter(f => /playzone/i.test(fs.readFileSync(path.join(jsk1.dir, f), 'utf8')));
check('no JSK1 page mentions Playzone9', jsLeaks.length === 0, jsLeaks);
check('  and that scan is not vacuous: each site DOES name itself',
  /playzone9/i.test(fs.readFileSync(path.join(pz9.dir, 'index.html'), 'utf8')) &&
  /jsk-?1/i.test(fs.readFileSync(path.join(jsk1.dir, 'index.html'), 'utf8')));
check('Playzone9\'s reserved launch domain appears nowhere in its staging site',
  !pzPages.some(f => /playzone9\.app/i.test(fs.readFileSync(path.join(pz9.dir, f), 'utf8'))));

/* ====================================================================
   5. THE BAKE WORKS FOR BOTH BRANDS, FROM THEIR OWN LAYERS
   The mechanism is shared; this asserts it for each brand in turn, with
   content published in that brand's layer and nowhere else.
   ==================================================================== */
console.log('\n===== PUBLISHED CONTENT REACHES THE HTML, PER BRAND =====');
const MARK = {
  'jsk-1.com': 'JSK1 BAKE PROBE ' + Date.now(),
  'playzone9.app': 'PLAYZONE9 BAKE PROBE ' + Date.now()
};
function publishInto(brandsDir, id, slug, text) {
  const file = path.join(brandsDir, id, 'brand.js');
  const data = SHELL.readBrand(file);
  data.pages = data.pages || {};
  data.pages[slug] = data.pages[slug] || {};
  data.pages[slug].builder = {
    schemaVersion: 2, status: 'published', updatedAt: '2026-09-28',
    sections: [{ id: 'probe', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true },
      style: { padding: '40' }, responsive: {},
      elements: [{ id: 'probeEl', type: 'heading',
        content: { text: text, level: 'h2' }, style: {}, responsive: {} }] }]
  };
  /* Provenance removed with it: a hand-built layer is not an export, and
     the integrity guard is right to say so. This is the documented
     not-recorded path, which warns and proceeds. */
  fs.writeFileSync(file, 'window.CMS_BRAND = ' + JSON.stringify(data, null, 2) + ';\n');
}
const probeRoot = mktmp('probe');
const probeBrands = path.join(probeRoot, 'brands');
fs.cpSync(PROD_BRANDS, probeBrands, { recursive: true });
publishInto(probeBrands, 'jsk-1.com', 'about', MARK['jsk-1.com']);
publishInto(probeBrands, 'playzone9.app', 'about', MARK['playzone9.app']);

const jsk1Baked = build(probeBrands, 'jsk-1.com', '', 'jsk1-baked');
const pz9Baked = build(probeBrands, 'playzone9.app', 'staging', 'pz9-baked');

for (const [id, site] of [['jsk-1.com', jsk1Baked], ['playzone9.app', pz9Baked]]) {
  const html = fs.readFileSync(path.join(site.dir, 'about.html'), 'utf8');
  check(id + ': its published content is in the HTML the server sends',
    html.indexOf(MARK[id]) > -1, html.slice(html.indexOf('data-cms-sections="about"'), 160));
  check(id + ': the mount is marked as baked',
    /<div data-cms-sections="about" data-cms-baked="1">/.test(html));
  check(id + ': the scoped section styles are baked too',
    /<style id="cmsBuilder">/.test(html));
  check(id + ': the content sits inside the mount, not loose in the page',
    new RegExp('data-cms-baked="1">[\\s\\S]*?' + MARK[id].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .test(html));
  check(id + ': and the OTHER brand\'s content is nowhere in it',
    html.indexOf(MARK[id === 'jsk-1.com' ? 'playzone9.app' : 'jsk-1.com']) === -1);
  check(id + ': its build reports what it baked',
    (site.s.plan.baked || []).some(b => b.slug === 'about'), site.s.plan.baked);
}
/* Publishing in one brand changes nothing in the other's other pages. */
check('a brand that publishes nothing on a page still ships an empty mount',
  /<div data-cms-sections="contact"><\/div>/.test(
    fs.readFileSync(path.join(pz9Baked.dir, 'contact.html'), 'utf8')));

/* ====================================================================
   6. SEO IS THE SAME IMPLEMENTATION, WITH PER-BRAND DATA
   ==================================================================== */
console.log('\n===== ONE SEO IMPLEMENTATION, TWO BRANDS =====');
check('JSK1 publishes a sitemap', jsk1.files.includes('sitemap.xml'));
check('JSK1 publishes robots.txt', jsk1.files.includes('robots.txt'));
check('JSK1\'s sitemap names its own domain',
  /jsk-1\.com/.test(fs.readFileSync(path.join(jsk1.dir, 'sitemap.xml'), 'utf8')) &&
  !/playzone/i.test(fs.readFileSync(path.join(jsk1.dir, 'sitemap.xml'), 'utf8')));
check('JSK1 pages carry a canonical for their own domain',
  /<link rel="canonical" href="https:\/\/jsk-1\.com/.test(
    fs.readFileSync(path.join(jsk1.dir, 'about.html'), 'utf8')));
/* The staging host is a review copy: the same generator, told to block. */
check('Playzone9 staging publishes NO sitemap', !pz9.files.includes('sitemap.xml'));
check('Playzone9 staging publishes robots.txt', pz9.files.includes('robots.txt'));
const pzRobots = fs.readFileSync(path.join(pz9.dir, 'robots.txt'), 'utf8');
check('and it blocks everything', /^Disallow: \/$/m.test(pzRobots), pzRobots.slice(0, 120));
check('and declares no sitemap', !/^Sitemap:/m.test(pzRobots));
const pzNoindex = pzPages.filter(f => /^[a-z0-9-]+\.html$/.test(f))
  .filter(f => !/noindex/.test(fs.readFileSync(path.join(pz9.dir, f), 'utf8')));
check('every Playzone9 staging page is noindex', pzNoindex.length === 0, pzNoindex);
check('both sites were given their robots/sitemap by the same generator',
  /build-seo-files\.js/.test(fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'sitekit.js'), 'utf8')));

/* ====================================================================
   7. THE DELIVERY WORKFLOW — THE PART THAT WAS MISSING
   ==================================================================== */
console.log('\n===== PLAYZONE9 IS DEPLOYED FROM THE SHARED SOURCE =====');
const DEPLOY = path.join(WORKFLOWS, 'deploy-playzone9.yml');
check('a Playzone9 deploy workflow exists', fs.existsSync(DEPLOY));
const dep = fs.existsSync(DEPLOY) ? fs.readFileSync(DEPLOY, 'utf8') : '';
const depCode = dep.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
check('it runs on a push to main, like JSK1\'s', /push:\s*\n\s*branches: \["main"\]/.test(depCode));
check('it can also be run by hand', /workflow_dispatch:/.test(depCode));
check('it builds the brand with the SHARED build system',
  /node tools\/build-site\.js playzone9\.app --env staging --out _site/.test(depCode),
  (depCode.match(/run: node[^\n]*/g) || []));
check('it publishes the assembled staging site', /_site\/playzones9\.com/.test(depCode));
check('it uses a secret for the target repository, never a literal credential',
  /secrets\.PLAYZONE9_DEPLOY_TOKEN/.test(depCode) &&
  !/ghp_[A-Za-z0-9]{10,}|github_pat_[A-Za-z0-9_]{10,}/.test(dep));
check('the token is only ever read from the secret store',
  (depCode.match(/PLAYZONE9_DEPLOY_TOKEN/g) || []).length >= 1 &&
  !/PLAYZONE9_DEPLOY_TOKEN\s*:\s*[A-Za-z0-9]/.test(depCode));
check('it refuses to publish a tree that is not a site',
  /test -f "\$src\/index\.html"/.test(depCode) && /test -f "\$src\/admin\/index\.html"/.test(depCode));
check('it replaces the published tree rather than copying over it',
  /git ls-files -z \| xargs -0 -r rm -f/.test(depCode));

/* It must not be able to touch THIS repository's Pages site, which is
   JSK1's. That is the failure that would take production down. */
check('it holds contents: read and nothing more',
  /permissions:\s*\n\s*contents: read\s*\n/.test(depCode) &&
  !/pages:\s*write/.test(depCode) && !/id-token:\s*write/.test(depCode));
check('it calls no Pages action at all',
  !/deploy-pages|upload-pages-artifact|configure-pages/.test(depCode));
check('it uses its own concurrency group, not the production "pages" one',
  /group: "playzone9-deploy"/.test(depCode) && !/group: "pages"/.test(depCode));

/* And JSK1's own deploy is untouched by any of this. */
const prod = fs.readFileSync(path.join(WORKFLOWS, 'static.yml'), 'utf8');
const prodCode = prod.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
check('JSK1\'s deploy still builds JSK1 and only JSK1',
  /node tools\/build-site\.js jsk-1\.com/.test(prodCode) &&
  /path: '_site\/jsk-1\.com'/.test(prodCode));
check('JSK1\'s deploy still knows nothing about Playzone9', !/playzone9/i.test(prodCode));
check('the two deploys use different concurrency groups',
  /group: "pages"/.test(prodCode) && !/group: "pages"/.test(depCode));

/* ====================================================================
   8. A THIRD BRAND NEEDS NO CMS CODE
   The synthetic brands are four files each and build from the same
   shared source. That is the whole claim about adding a white label.
   ==================================================================== */
console.log('\n===== A NEW BRAND IS DATA, NOT CODE =====');
/* A real new brand carries an seo-config.json; the synthetic fixtures are
   generator-level and ship without one, so the copy used here is given the
   file a new brand would be given -- baseUrl swapped, nothing else. That is
   the whole of what "adding a brand" costs at this layer. */
const acmeRoot = mktmp('acme-brands');
const acmeBrands = path.join(acmeRoot, 'brands');
fs.cpSync(SYNTH_BRANDS, acmeBrands, { recursive: true });
{
  const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'seo-config.json'), 'utf8'));
  seo.seo = seo.seo || {};
  seo.seo.baseUrl = 'https://acme.test';
  fs.writeFileSync(path.join(acmeBrands, 'acme.test', 'seo-config.json'),
                   JSON.stringify(seo, null, 2) + '\n');
}
const acme = build(acmeBrands, 'acme.test', '', 'acme');
check('a brand that exists only as a directory assembles', acme.files.length > 0, acme.files.length);
check('and passes the same verification', acme.v.problems.length === 0, acme.v.problems);
let acmeShared = 0;
for (const rel of ENGINE) {
  if (fs.existsSync(path.join(acme.dir, rel)) && sha(path.join(acme.dir, rel)) === sha(path.join(ROOT, rel))) acmeShared++;
}
check('it receives the same engine, byte for byte', acmeShared === ENGINE.length,
  acmeShared + '/' + ENGINE.length);
const acmeOwn = walk(path.join(acmeBrands, 'acme.test'));
check('while owning only a handful of files of its own', acmeOwn.length <= 8, acmeOwn);
check('none of which is engine code',
  !acmeOwn.some(f => /(cms|admin|admin-builder|seo-files)\.js$/.test(f)), acmeOwn);
check('and its pages are its own, not JSK1\'s',
  !/jsk-?1/i.test(fs.readFileSync(path.join(acme.dir, 'index.html'), 'utf8')));

/* ====================================================================
   9. THE DOCUMENTED PROCESS EXISTS
   ==================================================================== */
console.log('\n===== ADDING A BRAND IS WRITTEN DOWN =====');
const DOC = path.join(ROOT, 'docs', 'multi-brand.md');
check('the multi-brand doc exists', fs.existsSync(DOC));
const doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
for (const step of ['brands/', 'CMS_BRANDS', 'siteId', 'bucket', 'build-site.js', 'deploy']) {
  check('it names "' + step + '" as part of adding a brand', doc.indexOf(step) > -1);
}
/* Prose wraps, so the phrase is matched against whitespace-normalised
   text rather than against the file's line breaks. */
const docFlat = doc.replace(/\s+/g, ' ');
check('and it says the engine is not copied',
  /no CMS code is copied|not copied|never copied|without copying/i.test(docFlat),
  docFlat.length);
check('  and it names the shared engine files it does not copy',
  /js\/cms\.js/.test(docFlat) && /js\/admin-builder\.js/.test(docFlat) &&
  /admin\/index\.html/.test(docFlat));
check('  and it says where the deployment secret goes',
  /PLAYZONE9_DEPLOY_TOKEN/.test(docFlat) && /Contents: read and write/i.test(docFlat));

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
