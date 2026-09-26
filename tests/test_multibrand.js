#!/usr/bin/env node
/* =====================================================================
   TWO BRANDS THAT ARE NOT THE SAME SITE  (Phase 4)
   ---------------------------------------------------------------------
   The generator exists so a second brand can be added as configuration.
   The risk it introduces is the opposite of the one it solves: a shared
   template system makes it easy for one brand's content to end up in
   another brand's pages, and that failure is invisible until a visitor
   sees the wrong company's name.

   So this suite builds three brands side by side -- JSK1 from brands/,
   and two synthetic ones from tests/fixtures/brands/ -- and then looks
   for leakage in every direction. The synthetic brands deliberately sit
   outside brands/ so they can never be built by --list or registered in
   CMS_BRANDS; see tests/fixtures/brands/README.md.

   The two of them cover the two ways a brand can diverge beyond its
   name:

     acme.test  fills the login-notice SLOT  -- its own copy inside the
                shared login page, with no shared file edited.
     zeta.test  OVERRIDES login.html entirely -- a different form
                arrangement, which is the case that would otherwise
                have meant editing js/cms.js.

   Requirement 12 of this phase is exactly that second one: a future
   brand must be able to ship a different login page without touching
   the engine. The test for it is that zeta's login page is genuinely
   different AND that js/cms.js is byte-identical afterwards.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const KIT = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));
const PROD_BRANDS = path.join(ROOT, 'brands');
const SYNTH_BRANDS = path.join(__dirname, 'fixtures', 'brands');
const TEMPLATES = path.join(ROOT, 'templates');
const GOLDEN = path.join(__dirname, 'fixtures', 'golden-jsk1');

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'multibrand-' + tag + '-'));
  tmpRoots.push(d); return d;
}

/* Files that must be identical before and after: adding a brand is
   configuration, and this is what "configuration" means concretely. */
const SHARED = ['js/cms.js', 'js/cms-config.js', 'js/brand.js', 'js/seo-files.js',
  'css/style.css', 'index.html', 'login.html',
  'templates/pages/login.html', 'templates/pages/index.html',
  'brands/jsk-1.com/brand.json', 'brands/jsk-1.com/brand.js',
  'tools/lib/brandkit.js'];
const sharedBefore = {};
SHARED.forEach(f => { sharedBefore[f] = sha(path.join(ROOT, f)); });

/* ---------- build all three ---------- */
function buildBrand(brandsDir, id) {
  const outRoot = mktmp(id.replace(/\./g, '-'));
  const plan = KIT.planBrand({ brandsDir, templatesDir: TEMPLATES, id });
  KIT.writePlan(plan, outRoot);
  const dir = path.join(outRoot, plan.brand.output);
  const files = {};
  plan.files.forEach(f => { files[f.path] = fs.readFileSync(path.join(dir, f.path), 'utf8'); });
  return { plan, dir, files, paths: Object.keys(files).sort() };
}

const jsk1 = buildBrand(PROD_BRANDS, 'jsk-1.com');
const acme = buildBrand(SYNTH_BRANDS, 'acme.test');
const zeta = buildBrand(SYNTH_BRANDS, 'zeta.test');
const SITES = { 'jsk-1.com': jsk1, 'acme.test': acme, 'zeta.test': zeta };

/* Nothing below is meaningful if a build came back empty, so the
   collections are asserted non-empty before they are searched. */
console.log('\n===== THREE BRANDS WERE ACTUALLY BUILT =====');
for (const [id, site] of Object.entries(SITES)) {
  check(id + ' produced files', site.paths.length > 0, site.paths.length);
  let onDisk = 0;
  for (const rel of site.paths) {
    const full = path.join(site.dir, rel);
    if (fs.existsSync(full) && fs.statSync(full).size > 0) onDisk++;
  }
  check(id + ': every planned file exists on disk and is non-empty',
    onDisk === site.paths.length && onDisk > 0, onDisk + '/' + site.paths.length);
}
check('JSK1 built ten files', jsk1.paths.length === 10, jsk1.paths);
check('acme.test built nine (eight pages + brand.js, it ships no seo-config.json)',
  acme.paths.length === 9, acme.paths);
check('zeta.test built four -- it publishes only the three pages it lists',
  zeta.paths.length === 4, zeta.paths);
check('zeta.test publishes exactly the pages its brand.json names',
  JSON.stringify(zeta.paths) === JSON.stringify(['404.html', 'index.html', 'js/brand.js', 'login.html']),
  zeta.paths);
check('and zeta.test therefore does NOT get about/contact/register',
  !zeta.paths.includes('about.html') && !zeta.paths.includes('register.html'));

/* ====================================================================
   1. EACH BRAND GETS ITS OWN CONTENT AND NOBODY ELSE'S
   ==================================================================== */
console.log('\n===== NO BRAND LEAKS INTO ANOTHER =====');
{
  /* Every brand's identifying strings, so each site can be checked for
     its own AND against all the others'. */
  const MARKS = {
    'jsk-1.com': [/JSK1/, /jsk-1\.com/],
    'acme.test': [/ACMEPLAY/, /acme\.test/],
    'zeta.test': [/ZETAWIN/, /zeta\.test/]
  };

  let contaminationChecks = 0;
  for (const [id, site] of Object.entries(SITES)) {
    const all = site.paths.map(p => site.files[p]).join('\n');
    check(id + ' has its own name in its own pages', MARKS[id][0].test(all));
    check(id + ' has its own domain in its own pages', MARKS[id][1].test(all));

    for (const [other, res] of Object.entries(MARKS)) {
      if (other === id) continue;
      for (const re of res) {
        contaminationChecks++;
        const hits = site.paths.filter(p => re.test(site.files[p]));
        if (hits.length) check(id + ' must not contain ' + other + ' marker ' + re + ' (' + hits.join(', ') + ')', false);
      }
    }
  }
  check('every brand pair was checked in both directions', contaminationChecks === 12, contaminationChecks);
  check('no brand marker appears in another brand\'s output', true);

  /* Stated separately because it is the specific requirement: the
     second brand must not inherit the first brand's identity through
     the shared DEFAULTS, the shared templates, or a stale fallback. */
  for (const id of ['acme.test', 'zeta.test']) {
    const all = SITES[id].paths.map(p => SITES[id].files[p]).join('\n');
    check(id + ' inherits no JSK1 name', !/JSK1/.test(all));
    check(id + ' inherits no jsk-1.com URL', !/jsk-1\.com/.test(all));
    check(id + ' inherits no "playzone9" site id', !/playzone9/i.test(all));
  }
  check('JSK1 is unaffected by the existence of the other two',
    !/ACMEPLAY|ZETAWIN|acme\.test|zeta\.test/.test(jsk1.paths.map(p => jsk1.files[p]).join('\n')));
}

/* ====================================================================
   2. THE DATA LAYER IS PER-BRAND TOO
   The pages could be clean while brand.js still carried the wrong
   fallbacks, which is the layer the CMS actually reads.
   ==================================================================== */
console.log('\n===== EACH BRAND SHIPS ITS OWN js/brand.js =====');
{
  check('all three brand.js files were generated',
    !!jsk1.files['js/brand.js'] && !!acme.files['js/brand.js'] && !!zeta.files['js/brand.js']);
  check('JSK1 brand.js is the deployed one',
    sha(path.join(jsk1.dir, 'js/brand.js')) === sha(path.join(GOLDEN, 'js/brand.js')));
  check('acme brand.js is acme\'s, not JSK1\'s',
    /ACMEPLAY/.test(acme.files['js/brand.js']) && !/JSK1/.test(acme.files['js/brand.js']));
  check('zeta brand.js is zeta\'s, not JSK1\'s',
    /ZETAWIN/.test(zeta.files['js/brand.js']) && !/JSK1/.test(zeta.files['js/brand.js']));
  check('the three brand.js files are three different files',
    new Set([jsk1.files['js/brand.js'], acme.files['js/brand.js'], zeta.files['js/brand.js']]).size === 3);
  check('each brand.js sets its own baseUrl',
    /acme\.test/.test(acme.files['js/brand.js']) && /zeta\.test/.test(zeta.files['js/brand.js'])
    && /jsk-1\.com/.test(jsk1.files['js/brand.js']));
}

/* ====================================================================
   3. A LOGIN CUSTOMISATION STAYS IN ITS OWN BRAND
   ==================================================================== */
console.log('\n===== THE LOGIN PAGE: SLOT, OVERRIDE, AND NEITHER =====');
{
  const slotFile = fs.readFileSync(path.join(SYNTH_BRANDS, 'acme.test', 'slots', 'login-notice.html'), 'utf8');
  check('the acme slot fixture is non-empty', slotFile.trim().length > 0);
  const slotMark = 'acme-login-notice';
  check('the slot fixture carries a searchable marker', slotFile.indexOf(slotMark) > -1);

  check('acme login.html contains the slot content', acme.files['login.html'].indexOf(slotMark) > -1);
  check('acme login.html contains the slot content EXACTLY as written',
    acme.files['login.html'].indexOf(slotFile) > -1);

  /* The point of the whole mechanism: one brand's customisation is
     invisible everywhere else. Checked across every file, not just the
     login page. */
  let scanned = 0, leaked = [];
  for (const [id, site] of Object.entries(SITES)) {
    if (id === 'acme.test') continue;
    for (const p of site.paths) { scanned++; if (site.files[p].indexOf(slotMark) > -1) leaked.push(id + '/' + p); }
  }
  check('the other two brands\' files were all scanned for the acme slot', scanned === 14, scanned);
  check('the acme login customisation appears in no other brand', leaked.length === 0, leaked);

  /* JSK1 declares the slot and fills nothing, so its login page must
     still be byte-for-byte what is deployed today. This is the
     property that let the mechanism be added at all. */
  check('JSK1 login.html is byte-identical to the deployed page',
    sha(path.join(jsk1.dir, 'login.html')) === sha(path.join(GOLDEN, 'login.html')));
  check('JSK1 login.html carries no slot marker and no empty residue',
    !/<!-- \/?BRAND:/.test(jsk1.files['login.html']));

  /* zeta replaced the page outright. */
  check('zeta login.html is its own arrangement', /zeta-signin/.test(zeta.files['login.html']));
  check('zeta login.html does NOT contain the shared form markup',
    !/forgot-row/.test(zeta.files['login.html']));
  check('acme login.html DOES contain the shared form markup',
    /forgot-row/.test(acme.files['login.html']));
  check('JSK1 login.html contains the shared form markup',
    /forgot-row/.test(jsk1.files['login.html']));
  check('zeta login.html resolved its tokens', /ZETAWIN/.test(zeta.files['login.html'])
    && !/\{\{/.test(zeta.files['login.html']));
  check('zeta login.html declared a slot of its own and left it empty',
    zeta.plan.slotsDeclared.includes('login-notice')
    && !/<!-- \/?BRAND:/.test(zeta.files['login.html']));
  check('the three login pages are three different pages',
    new Set([jsk1.files['login.html'], acme.files['login.html'], zeta.files['login.html']]).size === 3);

  /* And zeta's other two pages still come from the shared templates --
     an override is one page, not an exit from the system. */
  check('zeta index.html still came from the shared template',
    /data-cms-text|cms-config\.js/.test(zeta.files['index.html']));
  check('zeta 404.html still came from the shared template',
    zeta.files['404.html'].length > 1000 && /ZETAWIN/.test(zeta.files['404.html']));
}

/* ====================================================================
   4. SHARED BEHAVIOUR IS STILL SHARED
   Isolation is only half of it. If each brand ended up with its own
   copy of the engine, every future fix would have to be applied N
   times -- the exact problem the generator is meant to avoid.
   ==================================================================== */
console.log('\n===== THE ENGINE IS SHARED, NOT COPIED =====');
{
  let wired = 0;
  for (const [id, site] of Object.entries(SITES)) {
    for (const p of site.paths.filter(x => x.endsWith('.html'))) {
      const html = site.files[p];
      const ok = /src="js\/cms-config\.js"/.test(html) && /src="js\/brand\.js"/.test(html)
        && /src="js\/cms\.js"/.test(html);
      if (!ok) check(id + '/' + p + ' loads the shared engine in the shared order', false);
      else wired++;
    }
  }
  check('every generated page was checked for the engine wiring', wired === 8 + 8 + 3, wired);
  check('every generated page loads the same three shared scripts', true);

  /* No brand ships its own engine: js/cms.js is never a brand output. */
  for (const [id, site] of Object.entries(SITES)) {
    check(id + ' does not ship its own copy of js/cms.js', !site.paths.includes('js/cms.js'));
    check(id + ' does not ship its own copy of js/cms-config.js', !site.paths.includes('js/cms-config.js'));
    check(id + ' ships only pages, brand.js and seo-config.json',
      site.paths.every(p => /\.html$/.test(p) || p === 'js/brand.js' || p === 'seo-config.json'), site.paths);
  }

  /* The strongest available statement of "same markup, different
     brand": acme's shared pages are JSK1's pages with the two brand
     strings swapped, and nothing else. If a template ever grows a
     brand-specific branch, this stops being true. */
  const shared = jsk1.paths.filter(p => p.endsWith('.html') && p !== 'login.html');
  check('there are shared pages to compare', shared.length === 7, shared.length);
  let equivalent = 0;
  for (const p of shared) {
    const projected = jsk1.files[p].split('JSK1').join('ACMEPLAY').split('jsk-1.com').join('acme.test');
    if (projected === acme.files[p]) equivalent++;
    else check(p + ': acme output is not JSK1 output with the brand strings swapped', false);
  }
  check('all seven shared pages were compared', equivalent === shared.length && shared.length > 0, equivalent);
  check('acme\'s shared pages differ from JSK1\'s ONLY in the brand strings', equivalent === 7, equivalent);
}

/* ====================================================================
   5. ADDING A BRAND EDITED NOTHING SHARED
   ==================================================================== */
console.log('\n===== ADDING A BRAND IS CONFIGURATION =====');
{
  let rehashed = 0;
  for (const f of SHARED) {
    if (sha(path.join(ROOT, f)) !== sharedBefore[f]) check(f + ' was modified by building other brands', false);
    rehashed++;
  }
  check('every shared file was re-hashed', rehashed === SHARED.length && rehashed === 12, rehashed);
  check('js/cms.js is byte-identical after building three brands', true);

  /* The synthetic brands are a fixture, not a site. */
  check('the synthetic brands are not in brands/',
    !fs.existsSync(path.join(PROD_BRANDS, 'acme.test')) && !fs.existsSync(path.join(PROD_BRANDS, 'zeta.test')));
  check('--list still offers exactly one brand',
    JSON.stringify(KIT.listBrands(PROD_BRANDS)) === '["jsk-1.com"]', KIT.listBrands(PROD_BRANDS));
  const cfg = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');
  check('CMS_BRANDS mentions neither synthetic brand', !/acme\.test|zeta\.test/.test(cfg));
  check('and still does not mention Playzone9', !/playzone9\.app/.test(cfg));
}

/* ====================================================================
   6. THE SYNTHETIC BRANDS BUILD DETERMINISTICALLY TOO
   ==================================================================== */
console.log('\n===== DETERMINISM ACROSS BRANDS =====');
{
  for (const [id, first] of [['acme.test', acme], ['zeta.test', zeta]]) {
    const again = buildBrand(SYNTH_BRANDS, id);
    check(id + ' rebuilt the same file list',
      JSON.stringify(again.paths) === JSON.stringify(first.paths), again.paths);
    let same = 0;
    for (const p of first.paths) if (again.files[p] === first.files[p]) same++;
    check(id + ' every file was compared across two builds', same === first.paths.length && same > 0, same);
    check(id + ' is byte-identical across two builds', same === first.paths.length, same);
  }
}

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
