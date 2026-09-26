#!/usr/bin/env node
/* =====================================================================
   MUTATION HARNESS FOR THE GENERATOR  (Phase 4)
   ---------------------------------------------------------------------
   test_generator.js and test_multibrand.js both pass. That on its own
   says nothing: a suite that asserts the wrong thing, or asserts over an
   empty list, passes just as cheerfully. So each guarantee is checked by
   breaking the code that provides it and requiring the suite to notice.

   Nothing here touches the working tree. Every mutant is applied to a
   throwaway COPY of the repository, so a crash mid-run cannot leave a
   sabotaged brandkit.js behind -- which matters, because one of the
   mutants deliberately disables the path-traversal guard.

   A CONTROL runs first with no mutation at all. Without it, a harness
   that is silently broken -- wrong path, unparsed output -- reports
   every mutant as "caught" and proves nothing.

   Run:  node tests/mutate-generator.js
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SUITES = ['test_generator.js', 'test_multibrand.js'];

/* Only what the two suites read. node_modules and .git are excluded
   deliberately: neither suite needs a browser. */
const COPY = ['js', 'css', 'tools', 'templates', 'brands',
  'index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
  'privacy-policy.html', 'responsible-gaming.html', '404.html',
  'sitemap.xml', 'robots.txt'];

function copyInto(sandbox) {
  fs.mkdirSync(path.join(sandbox, 'tests'), { recursive: true });
  for (const rel of COPY) fs.cpSync(path.join(ROOT, rel), path.join(sandbox, rel), { recursive: true });
  for (const s of SUITES) fs.cpSync(path.join(__dirname, s), path.join(sandbox, 'tests', s));
  fs.cpSync(path.join(__dirname, 'fixtures'), path.join(sandbox, 'tests', 'fixtures'), { recursive: true });
}

/* Each mutant removes or inverts exactly one guard. The "expect" field
   names which suite must notice -- a mutant caught only by the suite it
   was not aimed at usually means the aimed-at assertion is weak. */
const MUTANTS = [
  { id: 'G1', desc: 'an unfilled slot keeps its markers instead of vanishing',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: 'return Object.prototype.hasOwnProperty.call(brand.slots, name) ? brand.slots[name] : \'\';',
    repl: 'return Object.prototype.hasOwnProperty.call(brand.slots, name) ? brand.slots[name] : m;' },

  { id: 'G2', desc: 'a filled slot is dropped, so brand content never appears',
    file: 'tools/lib/brandkit.js', expect: 'test_multibrand.js',
    find: 'return Object.prototype.hasOwnProperty.call(brand.slots, name) ? brand.slots[name] : \'\';',
    repl: 'return \'\';' },

  { id: 'G3', desc: 'output carries a build timestamp, so two builds differ',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '        fs.writeFileSync(full, f.contents, \'utf8\');',
    repl: '        fs.writeFileSync(full, f.contents + \'<!-- \' + Date.now() + \' -->\', \'utf8\');' },

  { id: 'G4', desc: 'safeJoin no longer checks that a path stays inside the root',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (full !== root && !full.startsWith(root + path.sep)) {',
    repl: '    if (false) {' },

  { id: 'G5', desc: 'required brand fields are no longer required',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    for (const key of REQUIRED) {',
    repl: '    for (const key of []) {' },

  { id: 'G6', desc: 'two sources may write the same output path',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '            if (seen.has(rel)) {',
    repl: '            if (false) {' },

  { id: 'G7', desc: 'an unknown token ships through as literal text',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (unknown.length) {',
    repl: '    if (false) {' },

  { id: 'G8', desc: 'the slot content gate is removed',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    for (const [re, what] of SCRIPTISH) {',
    repl: '    for (const [re, what] of []) {' },

  { id: 'G9', desc: 'a slot file matching no marker is silently ignored',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (orphans.length) {',
    repl: '    if (false) {' },

  { id: 'G10', desc: 'an unmatched slot marker ships to production',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (stray) {',
    repl: '    if (false) {' },

  { id: 'G11', desc: 'a brand.json id may disagree with its directory',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (cfg.id !== id) {',
    repl: '    if (false) {' },

  { id: 'G12', desc: 'a page listed twice is accepted',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '        if (new Set(pages).size !== pages.length) {',
    repl: '        if (false) {' },

  { id: 'G13', desc: 'brand.name is hardcoded to JSK1 for every brand',
    file: 'tools/lib/brandkit.js', expect: 'test_multibrand.js',
    find: '        \'brand.name\': brand.name,',
    repl: '        \'brand.name\': \'JSK1\',' },

  { id: 'G14', desc: 'brand.domain is hardcoded to jsk-1.com for every brand',
    file: 'tools/lib/brandkit.js', expect: 'test_multibrand.js',
    find: '        \'brand.domain\': brand.domain,',
    repl: '        \'brand.domain\': \'jsk-1.com\',' },

  { id: 'G15', desc: 'the brand\'s "pages" list is ignored and every page is published',
    file: 'tools/lib/brandkit.js', expect: 'test_multibrand.js',
    find: '    const wanted = brand.pages || available.slice();',
    repl: '    const wanted = available.slice();' },

  { id: 'G16', desc: 'a page override is ignored in favour of the shared template',
    file: 'tools/lib/brandkit.js', expect: 'test_multibrand.js',
    find: '        if (Object.prototype.hasOwnProperty.call(brand.overrides, page)) {',
    repl: '        if (false) {' },

  { id: 'G17', desc: 'every brand is handed JSK1\'s brand.js instead of its own',
    file: 'tools/lib/brandkit.js', expect: 'test_multibrand.js',
    find: '    const brandJs = path.join(brand.dir, \'brand.js\');',
    repl: '    const brandJs = path.join(templatesDir, \'..\', \'js\', \'brand.js\');' },

  /* Fixture-level: these check the ISOLATION assertions rather than the
     generator, by contaminating a synthetic brand on purpose. */
  { id: 'F1', desc: 'acme\'s brand.js is contaminated with the JSK1 name',
    file: 'tests/fixtures/brands/acme.test/brand.js', expect: 'test_multibrand.js',
    find: 'branding: { siteName: \'ACMEPLAY\'', repl: 'branding: { siteName: \'JSK1\'' },

  { id: 'F2', desc: 'zeta\'s login override carries acme\'s notice markup',
    file: 'tests/fixtures/brands/zeta.test/pages/login.html', expect: 'test_multibrand.js',
    find: '<!-- BRAND:login-notice --><!-- /BRAND:login-notice -->',
    repl: '<div class="acme-login-notice">leaked</div><!-- BRAND:login-notice --><!-- /BRAND:login-notice -->' },

  { id: 'F3', desc: 'a shared template gains a brand-specific branch',
    file: 'templates/pages/about.html', expect: 'test_generator.js',
    find: '<body', repl: '<body data-special-case="jsk-1.com"' },

  { id: 'F4', desc: 'the deployed js/brand.js drifts from the generator\'s source',
    file: 'js/brand.js', expect: 'test_generator.js',
    find: '        loginTitle: \'Login — JSK1\'', repl: '        loginTitle: \'Sign in — JSK1\'' },

  { id: 'F5', desc: 'the brand\'s own name is changed without regenerating production',
    file: 'brands/jsk-1.com/brand.json', expect: 'test_generator.js',
    find: '"name": "JSK1"', repl: '"name": "JSK ONE"' },

  { id: 'F6', desc: 'a Phase 0 golden fixture is quietly edited',
    file: 'tests/fixtures/golden-jsk1/about.html', expect: 'test_generator.js',
    find: '<body', repl: '<body data-tampered="1"' },

];

function run(sandbox, suite) {
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(sandbox, 'tests', suite)],
      { encoding: 'utf8', cwd: sandbox });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); code = e.status === undefined ? 1 : e.status; }
  /* Parsed with a regex, not a substring: "0 failed" is a substring of
     "10 failed", and that mistake reports caught mutants as survivors. */
  const m = out.match(/====\s*(\d+)\s+passed,\s*(\d+)\s+failed\s*====/);
  if (!m) return { passed: 0, failed: -1, code, crashed: true, tail: out.split('\n').slice(-6).join('\n') };
  return { passed: +m[1], failed: +m[2], code, crashed: false, tail: '' };
}

/* ---------- control ---------- */
console.log('===== CONTROL: no mutation =====');
const control = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-control-'));
copyInto(control);
const controlRes = {};
let controlOk = true;
for (const s of SUITES) {
  const r = run(control, s);
  controlRes[s] = r;
  const ok = !r.crashed && r.failed === 0 && r.passed > 0 && r.code === 0;
  if (!ok) controlOk = false;
  console.log('  ' + (ok ? 'OK  ' : 'BAD ') + s + ': ' + r.passed + ' passed, ' + r.failed + ' failed'
    + (r.crashed ? '\n' + r.tail : ''));
}
fs.rmSync(control, { recursive: true, force: true });
if (!controlOk) {
  console.log('\nThe control run did not pass cleanly, so no mutant result below would mean anything.');
  process.exit(1);
}
console.log('  control is clean -- a "caught" below is therefore a real detection\n');

/* ---------- mutants ---------- */
let caught = 0; const survived = [];
for (const mut of MUTANTS) {
  const box = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-' + mut.id + '-'));
  copyInto(box);
  const target = path.join(box, mut.file);
  const src = fs.readFileSync(target, 'utf8');
  const occurrences = src.split(mut.find).length - 1;
  if (occurrences !== 1) {
    console.log('  ANCHOR  ' + mut.id + ': found ' + occurrences + ' occurrences of the anchor in ' +
      mut.file + ' -- expected exactly 1. Not a mutant result; fix the harness.');
    survived.push(mut.id + ' (bad anchor)');
    fs.rmSync(box, { recursive: true, force: true });
    continue;
  }
  fs.writeFileSync(target, src.replace(mut.find, mut.repl));

  const results = SUITES.map(s => [s, run(box, s)]);
  const noticed = results.filter(([, r]) => r.crashed || r.failed > 0 || r.code !== 0).map(([s]) => s);
  const byAimed = noticed.includes(mut.expect);
  if (noticed.length) {
    caught++;
    console.log('  caught  ' + mut.id + '  ' + mut.desc);
    console.log('          noticed by: ' + noticed.join(', ') + (byAimed ? '' : '   (NOT by ' + mut.expect + ')'));
  } else {
    survived.push(mut.id);
    console.log('  SURVIVED ' + mut.id + '  ' + mut.desc);
    results.forEach(([s, r]) => console.log('          ' + s + ': ' + r.passed + ' passed, ' + r.failed + ' failed'));
  }
  fs.rmSync(box, { recursive: true, force: true });
}

console.log('\n=================================');
console.log('MUTANTS: ' + caught + ' caught, ' + survived.length + ' survived, of ' + MUTANTS.length);
if (survived.length) console.log('survivors: ' + survived.join(', '));
console.log('=================================');
process.exit(survived.length ? 1 : 0);
