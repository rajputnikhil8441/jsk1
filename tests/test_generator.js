#!/usr/bin/env node
/* =====================================================================
   THE BRAND GENERATOR  (Phase 4)
   ---------------------------------------------------------------------
   tools/lib/brandkit.js turns brands/<id>/ + templates/pages/ into a
   brand's site files. Two things have to be true for that to be worth
   having, and this suite pins both.

   1. IT REPRODUCES JSK1 EXACTLY. Not "equivalently" -- byte-identical
      to the files currently deployed, checked against the Phase 0
      golden fixtures. The moment generated output differs from what
      production serves, the generator has stopped being a refactor and
      started being a redesign, and that has to fail loudly.

   2. IT REFUSES CLEARLY. A build tool that writes files from committed
      configuration is a file-writing primitive, so every way of asking
      it to write somewhere it should not -- '..', an absolute path, an
      id that is really a path -- is tested here, including the check
      that the file genuinely was NOT created.

   No browser: this is a build tool, so the tests run it the way the
   deploy will. Nothing is written inside the repository; every build
   goes to a throwaway directory under the system temp dir, and the
   live files are hashed before and after to prove it.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const KIT = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));
const { BrandError } = KIT;

const PROD_BRANDS = path.join(ROOT, 'brands');
const TEMPLATES = path.join(ROOT, 'templates');
const GOLDEN = path.join(__dirname, 'fixtures', 'golden-jsk1');

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* Every refusal test goes through here so that "it threw" is never
   enough on its own: the error has to be a BrandError (not a TypeError
   from a typo in the test) and its message has to name the problem,
   because an unhelpful refusal is barely better than none. */
function refuses(name, fn, re) {
  let err = null;
  try { fn(); } catch (e) { err = e; }
  if (!err) return check(name, false, 'did not throw');
  if (!(err instanceof BrandError)) return check(name, false, err.name + ': ' + err.message);
  if (re && !re.test(err.message)) return check(name, false, 'message did not match ' + re + ': ' + err.message);
  check(name, true);
}

const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'brandgen-' + tag + '-'));
  tmpRoots.push(d);
  return d;
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

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

/* A writable copy of a real brand, so a test can break one field and
   see what the generator says, without a fixture per failure mode. */
function scratchBrand(id, mutate) {
  const brandsDir = mktmp('cfg');
  const dir = path.join(brandsDir, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['brand.json', 'brand.js', 'seo-config.json']) {
    const src = path.join(PROD_BRANDS, 'jsk-1.com', f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(dir, f));
  }
  const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'brand.json'), 'utf8'));
  cfg.id = id; cfg.output = id;
  const raw = mutate ? mutate(cfg, dir) : undefined;
  fs.writeFileSync(path.join(dir, 'brand.json'),
    typeof raw === 'string' ? raw : JSON.stringify(cfg, null, 2));
  return { brandsDir, dir };
}
const build = (brandsDir, id, outRoot, templatesDir) =>
  KIT.writePlan(KIT.planBrand({ brandsDir, templatesDir: templatesDir || TEMPLATES, id }), outRoot);

/* The exact file set a full brand build produces. Written out rather
   than derived, so adding a file to the generator has to be a
   deliberate edit here too. */
const EXPECTED_JSK1 = [
  '404.html', 'about.html', 'contact.html', 'index.html', 'js/brand.js',
  'login.html', 'privacy-policy.html', 'register.html', 'responsible-gaming.html',
  'seo-config.json'
].sort();

/* Hashed before anything runs; compared again at the end. */
const LIVE = ['index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
  'privacy-policy.html', 'responsible-gaming.html', '404.html', 'js/brand.js',
  'sitemap.xml', 'robots.txt'];
const liveBefore = {};
LIVE.forEach(f => { liveBefore[f] = sha(path.join(ROOT, f)); });

/* ====================================================================
   1. THE PRODUCTION REGISTRY HAS EXACTLY ONE BRAND
   ==================================================================== */
console.log('\n===== ONE REGISTERED BRAND =====');
{
  const brands = KIT.listBrands(PROD_BRANDS);
  check('brands/ is non-empty', brands.length > 0, brands);
  check('brands/ contains exactly ["jsk-1.com"]',
    brands.length === 1 && brands[0] === 'jsk-1.com', brands);

  const cfg = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');
  const block = (cfg.match(/window\.CMS_BRANDS\s*=\s*\{[\s\S]*?\n\};/) || [''])[0];
  check('CMS_BRANDS block was found in js/cms-config.js', block.length > 0);
  const hosts = [...block.matchAll(/'([a-z0-9.-]+)'\s*:\s*\{/g)].map(m => m[1]);
  check('CMS_BRANDS registers exactly one hostname',
    hosts.length === 1 && hosts[0] === 'jsk-1.com', hosts);
  check('no synthetic test brand reached the production registry',
    !/acme\.test|zeta\.test/.test(cfg));
  check('Playzone9 is still not registered', !/playzone9\.app/.test(cfg));

  /* The synthetic brands must be unreachable from the production dir,
     or --list would offer a fake site as a build target. */
  for (const s of ['acme.test', 'zeta.test']) {
    check('synthetic brand "' + s + '" is not a directory in brands/',
      !fs.existsSync(path.join(PROD_BRANDS, s)));
  }
}

/* ====================================================================
   2. JSK1 IS REPRODUCED BYTE-FOR-BYTE
   ==================================================================== */
console.log('\n===== JSK1: GENERATED == DEPLOYED =====');
{
  const out = mktmp('jsk1');
  const plan = KIT.planBrand({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, id: 'jsk-1.com' });
  check('the plan lists files', plan.files.length > 0, plan.files.length);
  check('the plan lists exactly the expected paths',
    JSON.stringify(plan.files.map(f => f.path).sort()) === JSON.stringify(EXPECTED_JSK1),
    plan.files.map(f => f.path).sort());
  check('the login-notice slot is declared by the templates',
    plan.slotsDeclared.includes('login-notice'), plan.slotsDeclared);
  check('JSK1 fills no slots, so its pages keep their exact current bytes',
    Object.keys(plan.brand.slots).length === 0, Object.keys(plan.brand.slots));
  check('JSK1 overrides no pages', Object.keys(plan.brand.overrides).length === 0,
    Object.keys(plan.brand.overrides));

  const res = KIT.writePlan(plan, out);
  const dir = path.join(out, 'jsk-1.com');
  const found = walk(dir);
  check('the build wrote files', found.length > 0, found.length);
  check('the files on disk are EXACTLY the expected files -- no more, no fewer',
    JSON.stringify(found.slice().sort()) === JSON.stringify(EXPECTED_JSK1), found);

  /* Counted, because a loop over an empty list passes vacuously. */
  let compared = 0, identical = 0;
  for (const rel of EXPECTED_JSK1) {
    const gen = path.join(dir, rel);
    check('generated ' + rel + ' exists and is non-empty',
      fs.existsSync(gen) && fs.statSync(gen).size > 0);
    const target = rel === 'seo-config.json'
      ? path.join(ROOT, 'tools', 'seo-config.json')
      : path.join(GOLDEN, rel);
    if (!fs.existsSync(target)) { check('comparison target exists for ' + rel, false, target); continue; }
    compared++;
    if (sha(gen) === sha(target)) identical++;
    else check(rel + ' is byte-identical to its Phase 0 / production target', false, rel);
  }
  check('all ten outputs were actually compared', compared === 10, compared);
  check('all ten outputs are byte-identical to the deployed files', identical === compared && compared > 0,
    identical + '/' + compared);

  /* Nothing half-rendered got through. */
  let scanned = 0;
  for (const rel of found) {
    const body = fs.readFileSync(path.join(dir, rel), 'utf8');
    scanned++;
    if (/\{\{/.test(body)) check('no unresolved token left in ' + rel, false);
    if (/<!-- \/?BRAND:/.test(body)) check('no slot marker left in ' + rel, false);
  }
  check('every generated file was scanned for leftovers', scanned === EXPECTED_JSK1.length, scanned);
  check('no unresolved tokens or slot markers survive anywhere', true);
  check('writePlan reported the same file list it wrote',
    JSON.stringify(res.written.slice().sort()) === JSON.stringify(EXPECTED_JSK1), res.written);
}

/* ====================================================================
   2b. THE CHAIN BACK TO PRODUCTION IS CLOSED
   "Generated == golden fixture" only means "generated == deployed" while
   the fixtures still describe what is deployed. That link was checked by
   hand in Phase 0 and is asserted here, so the three copies of JSK1's
   brand data -- the generator's source, the deployed file, and the
   fixture -- cannot drift apart silently.
   ==================================================================== */
console.log('\n===== GENERATED == FIXTURE == DEPLOYED =====');
{
  const sums = fs.readFileSync(path.join(GOLDEN, 'SHA256SUMS'), 'utf8')
    .split('\n').map(l => l.trim()).filter(Boolean)
    .map(l => { const m = l.match(/^([0-9a-f]{64})\s+\*?(.+)$/); return m ? { hash: m[1], file: m[2] } : null; })
    .filter(Boolean);
  check('SHA256SUMS lists eleven fixtures', sums.length === 11, sums.length);
  let intact = 0;
  for (const row of sums) {
    const f = path.join(GOLDEN, row.file);
    if (fs.existsSync(f) && sha(f) === row.hash) intact++;
    else check('fixture ' + row.file + ' matches its recorded hash', false);
  }
  check('every fixture was hash-checked', intact === sums.length && intact === 11, intact);

  /* And the fixtures still are the deployed files. */
  let live = 0;
  for (const rel of LIVE) {
    if (sha(path.join(ROOT, rel)) === sha(path.join(GOLDEN, rel))) live++;
    else check('deployed ' + rel + ' still matches its Phase 0 fixture', false);
  }
  check('all eleven deployed files were compared to their fixtures', live === LIVE.length && live === 11, live);
  check('the Phase 0 fixtures still describe what production serves', live === 11, live);

  /* The transitional duplication of brand.js, pinned in both
     directions: the generator's source and the file production serves
     today are the same bytes, until Phase 7 removes one of them. */
  check('brands/jsk-1.com/brand.js is byte-identical to the deployed js/brand.js',
    sha(path.join(PROD_BRANDS, 'jsk-1.com', 'brand.js')) === sha(path.join(ROOT, 'js', 'brand.js')));
  check('and to the Phase 0 fixture',
    sha(path.join(PROD_BRANDS, 'jsk-1.com', 'brand.js')) === sha(path.join(GOLDEN, 'js', 'brand.js')));
  check('brands/jsk-1.com/seo-config.json is byte-identical to tools/seo-config.json',
    sha(path.join(PROD_BRANDS, 'jsk-1.com', 'seo-config.json')) === sha(path.join(ROOT, 'tools', 'seo-config.json')));
}

/* ====================================================================
   3. DETERMINISM
   Two builds from the same input, into different directories, must be
   byte-identical. Anything that leaks in -- a timestamp, a directory
   read order, a Set iteration -- makes the deploy diff meaningless.
   ==================================================================== */
console.log('\n===== THE SAME INPUT PRODUCES THE SAME BYTES =====');
{
  const a = path.join(mktmp('detA'), 'out');
  const b = path.join(mktmp('detB'), 'out');
  build(PROD_BRANDS, 'jsk-1.com', a);
  build(PROD_BRANDS, 'jsk-1.com', b);
  const fa = walk(path.join(a, 'jsk-1.com')), fb = walk(path.join(b, 'jsk-1.com'));
  check('run 1 produced files', fa.length > 0, fa.length);
  check('run 2 produced files', fb.length > 0, fb.length);
  check('both runs produced the same file list', JSON.stringify(fa) === JSON.stringify(fb), [fa, fb]);
  let same = 0;
  for (const rel of fa) {
    if (sha(path.join(a, 'jsk-1.com', rel)) === sha(path.join(b, 'jsk-1.com', rel))) same++;
    else check(rel + ' differs between two identical runs', false);
  }
  check('every file was hash-compared across the two runs', same === fa.length && fa.length === 10, same);
  check('two runs are byte-identical', same === fa.length && same > 0, same);

  /* Determinism of the plan ITSELF, not just of what landed on disk:
     order is part of the output when a later phase concatenates. */
  const p1 = KIT.planBrand({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, id: 'jsk-1.com' });
  const p2 = KIT.planBrand({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, id: 'jsk-1.com' });
  check('the plan is emitted in a stable order',
    JSON.stringify(p1.files.map(f => f.path)) === JSON.stringify(p2.files.map(f => f.path)));
  check('the plan is in sorted order (not directory order)',
    JSON.stringify(p1.files.map(f => f.path)) === JSON.stringify(p1.files.map(f => f.path).sort()));
}

/* ====================================================================
   4. IT REFUSES A BROKEN CONFIGURATION, AND SAYS WHY
   ==================================================================== */
console.log('\n===== CLEAR REFUSALS =====');
{
  refuses('an unknown brand is refused, and the known brands are listed',
    () => KIT.planBrand({ brandsDir: PROD_BRANDS, templatesDir: TEMPLATES, id: 'nope.example' }),
    /Unknown brand "nope\.example"[\s\S]*Known brands: jsk-1\.com/);

  refuses('an empty brand id is refused', () => KIT.loadBrand(PROD_BRANDS, ''), /brand id is required/);

  /* Each required field, one at a time: a single "config is invalid"
     for all four would not tell a brand author which one to fix. */
  for (const field of ['id', 'name', 'domain', 'siteId']) {
    const { brandsDir } = scratchBrand('broke.test', cfg => { delete cfg[field]; });
    refuses('a missing "' + field + '" is refused by name',
      () => KIT.loadBrand(brandsDir, 'broke.test'),
      new RegExp('missing required field "' + field + '"'));
    const blank = scratchBrand('blank.test', cfg => { cfg[field] = '   '; });
    refuses('a blank "' + field + '" is refused by name',
      () => KIT.loadBrand(blank.brandsDir, 'blank.test'),
      new RegExp('missing required field "' + field + '"'));
  }

  const bad = scratchBrand('malformed.test', () => '{ "id": "malformed.test", ');
  refuses('malformed JSON is refused as malformed JSON, not as a crash',
    () => KIT.loadBrand(bad.brandsDir, 'malformed.test'), /is not valid JSON/);

  const arr = scratchBrand('arr.test', () => '["not", "an", "object"]');
  refuses('a brand.json that is not an object is refused',
    () => KIT.loadBrand(arr.brandsDir, 'arr.test'), /must be a JSON object/);

  const mism = scratchBrand('mismatch.test', cfg => { cfg.id = 'somethingelse'; });
  refuses('a brand.json id that disagrees with its directory is refused',
    () => KIT.loadBrand(mism.brandsDir, 'mismatch.test'), /directory name and the id must match/);

  const nojs = scratchBrand('nojs.test');
  fs.unlinkSync(path.join(nojs.dir, 'brand.js'));
  refuses('a brand with no brand.js is refused, and told what brand.js is for',
    () => KIT.planBrand({ brandsDir: nojs.brandsDir, templatesDir: TEMPLATES, id: 'nojs.test' }),
    /has no brand\.js[\s\S]*CMS fallback layer/);

  const badseo = scratchBrand('badseo.test');
  fs.writeFileSync(path.join(badseo.dir, 'seo-config.json'), '{ oops');
  refuses('an invalid seo-config.json is refused before anything is written',
    () => KIT.planBrand({ brandsDir: badseo.brandsDir, templatesDir: TEMPLATES, id: 'badseo.test' }),
    /seo-config\.json[\s\S]*not valid JSON/);

  const dup = scratchBrand('dup.test', cfg => { cfg.pages = ['index.html', 'index.html']; });
  refuses('a page listed twice is refused', () => KIT.loadBrand(dup.brandsDir, 'dup.test'),
    /lists the same page twice/);

  const badpage = scratchBrand('badpage.test', cfg => { cfg.pages = ['index.php']; });
  refuses('a page name that is not an .html file is refused',
    () => KIT.loadBrand(badpage.brandsDir, 'badpage.test'), /not a valid page name/);

  const nopages = scratchBrand('nopages.test', cfg => { cfg.pages = 'index.html'; });
  refuses('"pages" that is not an array is refused',
    () => KIT.loadBrand(nopages.brandsDir, 'nopages.test'), /"pages" must be an array/);

  const missingTpl = scratchBrand('missingtpl.test', cfg => { cfg.pages = ['nosuchpage.html']; });
  refuses('a listed page with neither a template nor an override is refused',
    () => KIT.planBrand({ brandsDir: missingTpl.brandsDir, templatesDir: TEMPLATES, id: 'missingtpl.test' }),
    /no template at templates\/pages\/nosuchpage\.html[\s\S]*Available templates/);

  const emptyTpl = scratchBrand('notpl.test');
  refuses('a missing templates directory is refused',
    () => KIT.planBrand({ brandsDir: emptyTpl.brandsDir, templatesDir: mktmp('empty'), id: 'notpl.test' }),
    /No page templates found/);

  const orphan = scratchBrand('orphan.test');
  fs.mkdirSync(path.join(orphan.dir, 'slots'));
  fs.writeFileSync(path.join(orphan.dir, 'slots', 'no-such-slot.html'), '<p>hi</p>');
  refuses('a slot file matching no marker is refused instead of silently ignored',
    () => KIT.planBrand({ brandsDir: orphan.brandsDir, templatesDir: TEMPLATES, id: 'orphan.test' }),
    /no-such-slot\.html[\s\S]*do not match any <!-- BRAND/);

  const badslotname = scratchBrand('badslot.test');
  fs.mkdirSync(path.join(badslotname.dir, 'slots'));
  fs.writeFileSync(path.join(badslotname.dir, 'slots', 'Login_Notice.html'), '<p>hi</p>');
  refuses('an invalid slot file name is refused',
    () => KIT.loadBrand(badslotname.brandsDir, 'badslot.test'), /slot name "Login_Notice" is invalid/);

  const notHtml = scratchBrand('slotext.test');
  fs.mkdirSync(path.join(notHtml.dir, 'slots'));
  fs.writeFileSync(path.join(notHtml.dir, 'slots', 'login-notice.txt'), 'hi');
  refuses('a slot file that is not .html is refused',
    () => KIT.loadBrand(notHtml.brandsDir, 'slotext.test'), /must end in \.html/);

  const badOverride = scratchBrand('badov.test');
  fs.mkdirSync(path.join(badOverride.dir, 'pages'));
  fs.writeFileSync(path.join(badOverride.dir, 'pages', 'Login.html'), '<p>x</p>');
  refuses('a page override whose name is not a valid page name is refused',
    () => KIT.loadBrand(badOverride.brandsDir, 'badov.test'), /not a valid page name/);

  /* Editor leftovers are skipped rather than refused -- a stray
     .login.html.swp should not break a build. The point of asserting
     it is that the file must not reach the output either. */
  const swap = scratchBrand('swap.test', cfg => { cfg.pages = ['login.html']; });
  fs.mkdirSync(path.join(swap.dir, 'pages'));
  fs.writeFileSync(path.join(swap.dir, 'pages', '.login.html.swp'), 'junk');
  const swapPlan = KIT.planBrand({ brandsDir: swap.brandsDir, templatesDir: TEMPLATES, id: 'swap.test' });
  const swapPaths = swapPlan.files.map(f => f.path).sort();
  check('a dotfile in pages/ is ignored, not published',
    swapPaths.length === 3 && !swapPaths.some(p => p.startsWith('.')), swapPaths);
  check('and login.html still came from the shared template',
    /Login|login/.test(swapPlan.files.find(f => f.path === 'login.html').contents)
    && swapPlan.files.find(f => f.path === 'login.html').contents !== 'junk');
}

/* ====================================================================
   5. DUPLICATE OUTPUT PATHS
   The page list is already checked for duplicates upstream, so this
   tests the backstop directly rather than pretending a config can
   reach it today -- the phase that adds CSS and asset emitters will.
   ==================================================================== */
console.log('\n===== TWO SOURCES, ONE PATH =====');
{
  const c = KIT.makeCollector('demo.test');
  c.emit('index.html', 'first', 'templates/pages/index.html');
  check('the first emit is collected', c.files.length === 1, c.files.length);
  refuses('a second source claiming the same path is refused, naming both sources',
    () => c.emit('index.html', 'second', 'brands/demo.test/pages/index.html'),
    /two sources both want to write "index\.html"[\s\S]*templates\/pages\/index\.html[\s\S]*brands\/demo\.test\/pages\/index\.html/);
  check('the refused emit did not land in the file list', c.files.length === 1, c.files.length);
  c.emit('login.html', 'ok', 'templates/pages/login.html');
  check('a different path still collects normally', c.files.length === 2, c.files.length);
}

/* ====================================================================
   6. PATH TRAVERSAL AND ESCAPING THE OUTPUT DIRECTORY
   Each of these asserts the refusal AND that the file does not exist,
   because "it threw" and "it threw after writing" look the same from
   the outside.
   ==================================================================== */
console.log('\n===== IT CANNOT WRITE OUTSIDE THE OUTPUT DIRECTORY =====');
{
  for (const bad of ['../evil', '..', '../../etc', '/etc', './x', 'UPPER', 'has space', 'a..b']) {
    refuses('assertId refuses "' + bad + '"', () => KIT.assertId(bad));
  }
  check('assertId accepts a plain hostname', KIT.assertId('jsk-1.com') === 'jsk-1.com');
  check('assertId accepts a hyphenated label', KIT.assertId('acme-two.test') === 'acme-two.test');

  const root = mktmp('safe');
  check('safeJoin keeps a normal relative path inside the root',
    KIT.safeJoin(root, 'js/brand.js') === path.join(root, 'js', 'brand.js'));
  refuses('safeJoin refuses a parent-directory escape',
    () => KIT.safeJoin(root, '../escaped.html'), /resolves outside/);
  refuses('safeJoin refuses a deep escape',
    () => KIT.safeJoin(root, 'a/b/../../../escaped.html'), /resolves outside/);
  refuses('safeJoin refuses an absolute path',
    () => KIT.safeJoin(root, '/etc/passwd'), /resolves outside/);
  refuses('safeJoin refuses a sibling-prefix path',
    () => KIT.safeJoin(root, '../' + path.basename(root) + '-evil/x.html'), /resolves outside/);

  refuses('loadBrand refuses a traversal brand id',
    () => KIT.loadBrand(PROD_BRANDS, '../tests'), /\.\.|not a valid identifier/);
  refuses('a brand.json "output" that escapes is refused',
    () => KIT.loadBrand(scratchBrand('outesc.test', cfg => { cfg.output = '../escape'; }).brandsDir, 'outesc.test'),
    /\.\.|not a valid identifier/);
  refuses('a brand.json "domain" that is really a path is refused',
    () => KIT.loadBrand(scratchBrand('domesc.test', cfg => { cfg.domain = '../../etc'; }).brandsDir, 'domesc.test'),
    /\.\.|not a valid identifier/);

  /* A sentinel beside the output root: if a traversal ever succeeded,
     this is the file it would have clobbered. */
  const box = mktmp('box');
  const outRoot = path.join(box, 'sites');
  fs.mkdirSync(outRoot);
  const sentinel = path.join(box, 'DO-NOT-TOUCH.txt');
  fs.writeFileSync(sentinel, 'original');
  const sentinelHash = sha(sentinel);

  const fakePlan = rel => ({ brand: { id: 'x.test', output: 'x.test' }, files: [{ path: rel, contents: 'PWNED' }] });
  for (const rel of ['../DO-NOT-TOUCH.txt', '../../DO-NOT-TOUCH.txt', 'a/../../DO-NOT-TOUCH.txt']) {
    refuses('writePlan refuses to write "' + rel + '"', () => KIT.writePlan(fakePlan(rel), outRoot),
      /resolves outside/);
  }
  refuses('writePlan refuses an absolute output path',
    () => KIT.writePlan(fakePlan(path.join(box, 'absolute.html')), outRoot), /resolves outside/);
  check('the sentinel beside the output root is untouched', sha(sentinel) === sentinelHash);
  check('the sentinel still reads "original"', fs.readFileSync(sentinel, 'utf8') === 'original');
  check('no absolute-path file was created', !fs.existsSync(path.join(box, 'absolute.html')));

  refuses('writePlan refuses a brand whose output directory escapes',
    () => KIT.writePlan({ brand: { id: 'x.test', output: '../escaped' }, files: [{ path: 'i.html', contents: 'x' }] }, outRoot),
    /Output directory[\s\S]*resolves outside/);
  check('no escaped output directory was created', !fs.existsSync(path.join(box, 'escaped')));
}

/* ====================================================================
   7. TOKENS AND SLOTS FAIL LOUDLY
   ==================================================================== */
console.log('\n===== RENDERING REFUSES WHAT IT CANNOT RESOLVE =====');
{
  const brand = { id: 'demo.test', name: 'DEMO', domain: 'demo.test', siteId: 'demo', slots: {} };
  check('a known token is substituted',
    KIT.renderPage('<h1>{{brand.name}}</h1>', brand, 't').html === '<h1>DEMO</h1>');
  check('whitespace inside a token is tolerated',
    KIT.renderPage('{{ brand.domain }}', brand, 't').html === 'demo.test');
  check('all four tokens resolve',
    KIT.renderPage('{{brand.id}}|{{brand.name}}|{{brand.domain}}|{{brand.siteId}}', brand, 't').html
      === 'demo.test|DEMO|demo.test|demo');
  refuses('a mistyped token is refused, and the known tokens are listed',
    () => KIT.renderPage('<h1>{{brand.nmae}}</h1>', brand, 'tpl'),
    /unknown token\(s\) \{\{brand\.nmae\}\}[\s\S]*Known tokens[\s\S]*brand\.name/);
  refuses('an unmatched opening slot marker is refused',
    () => KIT.renderPage('<!-- BRAND:notice -->', brand, 'tpl'), /unmatched slot marker/);
  refuses('an unmatched closing slot marker is refused',
    () => KIT.renderPage('<!-- /BRAND:notice -->', brand, 'tpl'), /unmatched slot marker/);

  const r = KIT.renderPage('a<!-- BRAND:notice -->keep me<!-- /BRAND:notice -->b', brand, 'tpl');
  check('an unfilled slot region vanishes entirely, markers and all', r.html === 'ab', r.html);
  check('the slot is still reported as declared',
    r.slotsDeclared.length === 1 && r.slotsDeclared[0] === 'notice', r.slotsDeclared);
  const filled = KIT.renderPage('a<!-- BRAND:notice --><!-- /BRAND:notice -->b',
    Object.assign({}, brand, { slots: { notice: '<p>MINE</p>' } }), 'tpl');
  check('a filled slot is substituted', filled.html === 'a<p>MINE</p>b', filled.html);

  /* checkSlot is a gate, not a sanitiser: it must refuse, never rewrite. */
  const cases = [
    ['a <script> tag', '<script>alert(1)</script>', /<script>/],
    ['an inline onclick handler', '<div onclick="steal()">x</div>', /on\* event handler/],
    ['a javascript: URL', '<a href="javascript:alert(1)">x</a>', /javascript: URL/],
    ['an <iframe>', '<iframe src="x"></iframe>', /<iframe>/],
    ['an <object>', '<object data="x"></object>', /<object>/],
    ['an <embed>', '<embed src="x">', /<object>/],
    ['a nested slot marker', '<!-- BRAND:inner --><!-- /BRAND:inner -->', /do not nest/],
    ['a token inside slot content', '<p>{{brand.name}}</p>', /contains "\{\{"/]
  ];
  for (const [what, html, re] of cases) {
    refuses('a slot containing ' + what + ' is refused', () => KIT.checkSlot('demo.test', 'notice', html, false), re);
  }
  refuses('a slot over 64 KB is refused, and pointed at a page override',
    () => KIT.checkSlot('demo.test', 'notice', 'x'.repeat(64 * 1024 + 1), false), /over 64 KB[\s\S]*page override/);
  check('a plain markup slot passes', (() => {
    try { KIT.checkSlot('demo.test', 'notice', '<div class="n"><p>Hello</p></div>', false); return true; }
    catch (e) { return false; }
  })());
  check('allowScriptsInSlots permits a script in that one slot', (() => {
    try { KIT.checkSlot('demo.test', 'notice', '<script src="x.js"></script>', true); return true; }
    catch (e) { return false; }
  })());
  refuses('allowScriptsInSlots still does not permit an inline handler',
    () => KIT.checkSlot('demo.test', 'notice', '<div onclick="x()">y</div>', true), /on\* event handler/);
  refuses('an invalid allowScriptsInSlots entry is refused',
    () => KIT.loadBrand(scratchBrand('allow.test', cfg => { cfg.allowScriptsInSlots = ['Bad Name']; }).brandsDir, 'allow.test'),
    /allowScriptsInSlots[\s\S]*not a valid slot name/);
}

/* ====================================================================
   8. THE REPOSITORY WAS NOT TOUCHED
   ==================================================================== */
console.log('\n===== THE GENERATOR DID NOT WRITE INTO THE REPO =====');
{
  let checked = 0;
  for (const f of LIVE) {
    if (sha(path.join(ROOT, f)) !== liveBefore[f]) check(f + ' is unchanged by the test run', false);
    checked++;
  }
  check('all eleven live files were re-hashed', checked === 11, checked);
  check('every live production file is unchanged by the test run', true);
  check('every temp build went outside the repository',
    tmpRoots.length > 0 && tmpRoots.every(d => !path.resolve(d).startsWith(ROOT + path.sep)), tmpRoots.length);
}

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
