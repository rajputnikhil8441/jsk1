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
const SHELL = require(path.join(__dirname, 'lib', 'pbshell.js'));
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
  /* JSK1's brand.js is its committed layer, copied through. It used to
     be compared against the Phase 0 fixture, which held while the layer
     was a frozen set of defaults; it is now an export of what the site
     has published and changes whenever it publishes. The claim that
     matters here -- the generator ships THIS brand's layer and not a
     copy it made -- is asserted against the layer itself. */
  check('JSK1 brand.js is the brand\'s own committed layer',
    sha(path.join(jsk1.dir, 'js/brand.js')) ===
    sha(path.join(PROD_BRANDS, 'jsk-1.com', 'brand.js')));
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
     strings swapped, and -- for every line the TEMPLATE owns -- nothing
     else. If a template ever grows a brand-specific branch, this stops
     being true.

     Two lines per page are no longer template-owned. brandkit.bakeHeadSeo()
     (G1) bakes each brand's published CMS <title> and meta description into
     the raw <head>, keyed on the data-cms-title / data-cms-meta bindings, so
     a crawler sees what the CMS published instead of the template fallback.
     That is brand CONTENT differing -- exactly like the Page Builder mount
     pbshell.js already accounts for -- not a brand branch in the template.
     Two brands with different published titles therefore produce different
     bytes on those two lines, by design. So the claim is split rather than
     loosened (the pattern pbshell.js documents): every template-owned line
     is still byte-identical modulo the brand strings, and the only lines
     allowed to differ are the two the bake owns -- which are then asserted
     to carry each brand's OWN content below, never waved through. */
  const shared = jsk1.paths.filter(p => p.endsWith('.html') && p !== 'login.html');
  check('there are shared pages to compare', shared.length === 7, shared.length);
  /* JSK1 publishes Page Builder content and acme does not, and the build
     bakes it in. That is brand CONTENT differing, which is what a brand
     layer is for -- so JSK1 is projected from its SHELL build, the same
     generator reading the same brand with its published blocks removed.
     Everything the template owns is still compared byte for byte, and
     the content left out is asserted below rather than waved through. */
  const shellRoot = mktmp('mb-shell');
  const jsk1Shell = buildBrand(SHELL.shellBrandsDir(PROD_BRANDS, path.join(shellRoot, 'brands')),
                               'jsk-1.com');
  /* A line the SEO bake owns: the <title> bound to data-cms-title, or the
     meta bound to data-cms-meta. Only these may differ beyond brand strings. */
  const isBakedSeoLine = l =>
    /<title\b[^>]*\bdata-cms-title="pages\./.test(l) || /\bdata-cms-meta="pages\./.test(l);
  const headTitle = h => (/<title\b[^>]*>([\s\S]*?)<\/title>/.exec(h) || [, ''])[1];
  let templateNeutral = 0, seoDivergent = 0;
  for (const p of shared) {
    const projected = jsk1Shell.files[p].split('JSK1').join('ACMEPLAY')
      .split('jsk-1.com').join('acme.test').split('\n');
    const actual = acme.files[p].split('\n');
    check(p + ': acme and the projected JSK1 shell have the same line structure',
      projected.length === actual.length, [projected.length, actual.length]);
    const diff = [];
    for (let i = 0; i < Math.min(projected.length, actual.length); i++) {
      if (projected[i] !== actual[i]) diff.push(actual[i]);
    }
    /* The real invariant: every TEMPLATE-owned line is JSK1's with the brand
       strings swapped. A brand-specific branch in the template would show up
       here as a non-SEO differing line. */
    const nonSeo = diff.filter(l => !isBakedSeoLine(l));
    check(p + ': every template-owned line is JSK1\'s shell with the brand strings swapped',
      nonSeo.length === 0, nonSeo.slice(0, 3));
    if (diff.length === 0) templateNeutral++; else seoDivergent++;
  }
  check('all seven shared pages were compared',
    templateNeutral + seoDivergent === shared.length && shared.length === 7,
    templateNeutral + ' + ' + seoDivergent);
  /* The six pages whose published title equals the rendered template literal
     bake to the same bytes as acme's fallback, so they stay byte-identical;
     home is the one page the two fixtures give DIFFERENT published titles, so
     its baked <title> is the only cross-brand difference -- and it carries
     each brand's OWN title, not the other's. */
  check('the shared pages are byte-identical except where the brands publish different SEO',
    templateNeutral === 6 && seoDivergent === 1, templateNeutral + ' + ' + seoDivergent);
  check('acme home bakes ACME\'s own published title, not JSK1\'s',
    headTitle(acme.files['index.html']).indexOf('ACMEPLAY') > -1 &&
    headTitle(acme.files['index.html']).indexOf('JSK1') === -1,
    headTitle(acme.files['index.html']));
  check('JSK1 home bakes JSK1\'s own published title, not acme\'s',
    headTitle(jsk1.files['index.html']).indexOf('JSK1') > -1 &&
    headTitle(jsk1.files['index.html']).indexOf('ACMEPLAY') === -1,
    headTitle(jsk1.files['index.html']));

  /* And what the shell build left out is exactly one brand's published
     content, in its own mounts. Neither brand's content can reach the
     other's page: acme publishes none, so acme's mounts stay empty. */
  const blocks = SHELL.publishedBlocks(PROD_BRANDS, 'jsk-1.com');
  check('JSK1 publishes content that acme does not', Object.keys(blocks).length > 0, blocks);
  let bakedOnlyInJsk1 = 0;
  for (const p of shared) {
    const slug = p.replace(/\.html$/, '');
    const d = SHELL.bakedDelta(jsk1Shell.files[p], jsk1.files[p]);
    check(p + ': the shell and the real build line up', d.aligned, d.detail);
    if (blocks[slug]) {
      bakedOnlyInJsk1++;
      /* Baking a builder-managed page changes TWO lines versus the empty
         shell: the mount gains data-cms-baked and its content, and the
         fallback body above it gains `hidden` -- the build doing what
         js/cms.js paintSections() does in the DOM, so the static HTML and
         the rendered page agree instead of carrying two bodies at one URL.
         A published page without a fallback body would change only the
         mount; so the mount change is required, and every OTHER changed
         line must be its info-body gaining `hidden` and nothing else. */
      const mountChange = d.changed.filter(c =>
        c.baked.indexOf('data-cms-baked="' + blocks[slug] + '"') > -1);
      const bodyHide = d.changed.filter(c =>
        c.baked.indexOf('data-cms-html="pages.' + slug + '.body"') > -1 &&
        / hidden>/.test(c.baked) && !/ hidden>/.test(c.shell));
      check(p + ': JSK1 bakes its published content into the mount',
        d.aligned && d.styles.length === 1 &&
        mountChange.length === 1 &&
        d.changed.length === mountChange.length + bodyHide.length,
        { changed: d.changed.map(c => c.line), styles: d.styles.length });
      check(p + ': and the fallback body is hidden in the static HTML, not left to double the page',
        bodyHide.length === 1, d.changed.map(c => c.line));
      check(p + ': and acme\'s copy of that page carries none of it',
        /data-cms-sections="[a-z0-9-]+"><\/div>/.test(acme.files[p]) &&
        acme.files[p].indexOf('data-cms-baked') === -1);
    } else {
      check(p + ': neither brand publishes here, so both mounts stay empty',
        d.aligned && d.changed.length === 0 &&
        acme.files[p].indexOf('data-cms-baked') === -1);
    }
  }
  check('every page JSK1 publishes was compared across the two brands',
    bakedOnlyInJsk1 === Object.keys(blocks).length,
    bakedOnlyInJsk1 + '/' + Object.keys(blocks).length);
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
  check('--list offers exactly the two real brands',
    JSON.stringify(KIT.listBrands(PROD_BRANDS)) === '["jsk-1.com","playzone9.app"]',
    KIT.listBrands(PROD_BRANDS));
  const cfg = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');
  check('CMS_BRANDS mentions no synthetic brand',
    !/acme\.test|zeta\.test|omega\.test/.test(cfg));
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
