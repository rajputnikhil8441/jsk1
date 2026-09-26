#!/usr/bin/env node
/* =====================================================================
   WHAT THE PRODUCTION DOMAIN SERVES  (Phase 4)
   ---------------------------------------------------------------------
   The Pages workflow uploads `path: '.'` -- the whole repository. That was
   harmless while the repository was the site. It stopped being harmless
   when Phase 4 added templates/: eight .html files carrying literal
   {{brand.name}} and a canonical of https://{{brand.domain}}/, which on a
   live domain is a crawlable page claiming to be a page that does not
   exist. tests/fixtures/golden-jsk1/ is the same shape of problem and has
   had it since Phase 0 -- byte copies of the eight real pages.

   The deploy now deletes the four build-only directories from the
   runner's checkout before the artifact is packed. This suite is what
   stops that from rotting, and it is deliberately written to fail on the
   NEXT mistake rather than only on the one that has been fixed:

     - every .html file in the repository is either on an explicit
       production allowlist or inside a pruned directory. A new template,
       fixture or scratch page anywhere else fails here.
     - the prune is checked in both directions, so it cannot quietly
       widen and take a real page with it.
     - no file that survives may contain an unresolved {{ token, and at
       least one pruned file must -- otherwise the scan is proving nothing.

   The file list comes from git, so it is exactly what a fresh checkout
   contains: .gitignore'd paths like sites/ and node_modules are excluded
   the same way the deploy excludes them.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'static.yml');

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* The pages the production domain is SUPPOSED to serve. Written out, so a
   new one has to be added here deliberately -- the same reason the
   DEFAULTS surface is enumerated rather than spot-checked. */
const PRODUCTION_HTML = [
  '404.html', 'about.html', 'admin/index.html', 'contact.html', 'index.html',
  'login.html', 'privacy-policy.html', 'register.html', 'responsible-gaming.html'
].sort();

/* Files the site cannot work without. If a prune ever takes one of these,
   this suite fails before the deploy does. */
const MUST_SURVIVE = [
  'index.html', 'admin/index.html', 'js/cms.js', 'js/cms-config.js', 'js/brand.js',
  'css/style.css', 'assets/asset-manifest.json', 'sitemap.xml', 'robots.txt'
];

/* Exactly the four directories the deploy removes. */
const EXPECTED_PRUNE = ['brands', 'templates', 'tests', 'tools'].sort();

/* Everything a visitor needs must NOT be prunable. */
const NEVER_PRUNE = ['js', 'css', 'assets', 'admin', 'sitemap.xml', 'robots.txt', 'index.html'];

/* ---------- the repository as a fresh checkout sees it ---------- */
const FILES = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'],
  { cwd: ROOT, encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean).sort();

console.log('\n===== THE FILE LIST IS REAL =====');
check('git listed the repository contents', FILES.length > 50, FILES.length);
check('the list excludes generated output (sites/ is gitignored)',
  !FILES.some(f => f.startsWith('sites/')));
check('the list excludes node_modules', !FILES.some(f => f.indexOf('node_modules/') > -1));
const HTML = FILES.filter(f => f.endsWith('.html'));
check('the repository contains .html files to classify', HTML.length > 0, HTML.length);

/* ---------- 1. the workflow says what we think it says ---------- */
console.log('\n===== THE DEPLOY PRUNES BEFORE IT PACKS =====');
const wf = fs.readFileSync(WORKFLOW, 'utf8');
const stepNames = [...wf.matchAll(/^ {6}- name: (.+)$/gm)].map(m => m[1].trim());
check('the workflow declares steps', stepNames.length > 0, stepNames);
check('the whole repository is still the upload path', /^\s*path: '\.'\s*$/m.test(wf));

const iSeo = stepNames.findIndex(n => /sitemap/i.test(n));
const iPrune = stepNames.findIndex(n => /^Remove build-only sources/.test(n));
const iUpload = stepNames.findIndex(n => /^Upload artifact/.test(n));
check('the sitemap/robots step is present', iSeo > -1, stepNames);
check('the prune step is present', iPrune > -1, stepNames);
check('the upload step is present', iUpload > -1, stepNames);
check('the prune runs AFTER the sitemap step, which needs tools/', iPrune > iSeo, [iSeo, iPrune]);
check('the prune runs BEFORE the artifact is packed', iPrune < iUpload, [iPrune, iUpload]);

/* The prune step's own body. */
const pruneBody = (wf.split(/^ {6}- name: /m)[iPrune + 1] || '');
check('the prune step has a body', pruneBody.length > 0, pruneBody.length);
const rm = pruneBody.match(/rm -rf ([^\n]+)/);
check('the prune step removes paths with rm -rf', !!rm, pruneBody.slice(0, 120));
const pruned = rm ? rm[1].trim().split(/\s+/).sort() : [];
check('it removes exactly the four build-only directories',
  JSON.stringify(pruned) === JSON.stringify(EXPECTED_PRUNE), pruned);
for (const keep of NEVER_PRUNE) {
  check('it does not remove "' + keep + '"', pruned.indexOf(keep) === -1);
}

/* The step checks itself, in both directions -- a bare rm -rf succeeds
   silently on a renamed path, which is the failure that would quietly
   republish the sources. */
const guardDirs = pruneBody.match(/for d in ([^\n;]+); do/);
check('the step verifies the directories are actually gone', !!guardDirs, pruneBody.slice(0, 200));
check('and verifies all four of them',
  !!guardDirs && JSON.stringify(guardDirs[1].trim().split(/\s+/).sort()) === JSON.stringify(EXPECTED_PRUNE),
  guardDirs && guardDirs[1]);
check('the step verifies the production files survived', /for f in [\s\S]*?is missing after the prune/.test(pruneBody));
check('a failed verification fails the deploy', (pruneBody.match(/exit 1/g) || []).length >= 2,
  (pruneBody.match(/exit 1/g) || []).length);
let guarded = 0;
for (const f of ['index.html', 'admin/index.html', 'js/cms.js', 'css/style.css', 'sitemap.xml', 'robots.txt']) {
  if (pruneBody.indexOf(f) > -1) guarded++;
  else check('the step\'s survival check names ' + f, false);
}
check('every spot-checked production file is named in the survival check', guarded === 6, guarded);

/* ---------- 2. every .html is classified ---------- */
console.log('\n===== NO .html CAN BECOME AN ACCIDENTAL PAGE =====');
const isPruned = f => pruned.some(d => f === d || f.startsWith(d + '/'));

for (const p of PRODUCTION_HTML) {
  check('production page ' + p + ' exists', fs.existsSync(path.join(ROOT, p)));
  check('production page ' + p + ' is in the checkout', FILES.indexOf(p) > -1);
  check('production page ' + p + ' is NOT pruned', !isPruned(p));
}

const nonProduction = HTML.filter(f => PRODUCTION_HTML.indexOf(f) === -1);
/* If this list were empty the loop below would pass having proved
   nothing, which is precisely the failure mode this suite exists for. */
check('there ARE non-production .html files to account for', nonProduction.length > 0, nonProduction.length);
check('and there are at least the sixteen known ones (templates + golden fixtures)',
  nonProduction.length >= 16, nonProduction.length);
const unaccounted = nonProduction.filter(f => !isPruned(f));
check('every non-production .html file lives inside a pruned directory',
  unaccounted.length === 0, unaccounted);
check('the eight source templates are pruned',
  [...Array(8)].length === 8 &&
  HTML.filter(f => f.startsWith('templates/pages/')).length === 8 &&
  HTML.filter(f => f.startsWith('templates/pages/')).every(isPruned),
  HTML.filter(f => f.startsWith('templates/pages/')).length);
check('the eight Phase 0 golden fixtures are pruned',
  HTML.filter(f => f.startsWith('tests/fixtures/golden-jsk1/')).length === 8 &&
  HTML.filter(f => f.startsWith('tests/fixtures/golden-jsk1/')).every(isPruned));
check('the synthetic brands\' page files are pruned',
  HTML.filter(f => f.startsWith('tests/fixtures/brands/')).length === 2 &&
  HTML.filter(f => f.startsWith('tests/fixtures/brands/')).every(isPruned));

/* ---------- 3. what a deploy would actually publish ---------- */
console.log('\n===== THE PUBLISHED SURFACE =====');
const survives = FILES.filter(f => !isPruned(f));
check('a deploy still publishes files', survives.length > 0, survives.length);
check('the prune actually removes something', survives.length < FILES.length,
  FILES.length + ' -> ' + survives.length);
let kept = 0;
for (const f of MUST_SURVIVE) {
  if (survives.indexOf(f) > -1) kept++;
  else check('the site still publishes ' + f, false);
}
check('all nine essential files survive the prune', kept === MUST_SURVIVE.length && kept === 9, kept);
const survivingHtml = survives.filter(f => f.endsWith('.html')).sort();
check('exactly the nine production pages are published',
  JSON.stringify(survivingHtml) === JSON.stringify(PRODUCTION_HTML), survivingHtml);
for (const gone of ['templates/pages/login.html', 'tests/fixtures/golden-jsk1/index.html',
  'brands/jsk-1.com/brand.js', 'tools/lib/brandkit.js', 'tests/test_generator.js']) {
  check(gone + ' is NOT published', survives.indexOf(gone) === -1);
}

/* ---------- 4. no unresolved token can reach the domain ---------- */
console.log('\n===== NOTHING PUBLISHED CARRIES AN UNRESOLVED TOKEN =====');
function textOf(rel) {
  try { return fs.readFileSync(path.join(ROOT, rel)); } catch (e) { return null; }
}
const TEXTISH = /\.(html|js|css|json|txt|xml|md|yml)$/;
let scanned = 0; const tokenLeaks = [];
for (const f of survives.filter(f => TEXTISH.test(f))) {
  const b = textOf(f);
  if (!b) continue;
  scanned++;
  if (b.includes('{{brand.')) tokenLeaks.push(f);
}
check('surviving text files were scanned', scanned > 20, scanned);
check('no published file contains a {{brand.*}} token', tokenLeaks.length === 0, tokenLeaks);
let survivingHtmlScanned = 0; const braceLeaks = [];
for (const f of survivingHtml) { survivingHtmlScanned++; if (textOf(f).includes('{{')) braceLeaks.push(f); }
check('all nine published pages were scanned for "{{"', survivingHtmlScanned === 9, survivingHtmlScanned);
check('no published page contains "{{" at all', braceLeaks.length === 0, braceLeaks);

/* The other direction: if nothing pruned contained a token, the scan
   above would be measuring an empty problem. */
const prunedWithTokens = FILES.filter(isPruned).filter(f => TEXTISH.test(f))
  .filter(f => { const b = textOf(f); return b && b.includes('{{brand.'); });
check('pruned files DO contain {{brand.*}} tokens, so the scan is meaningful',
  prunedWithTokens.length >= 8, prunedWithTokens.length);
check('and the un-rendered templates are among them',
  prunedWithTokens.filter(f => f.startsWith('templates/pages/')).length === 8,
  prunedWithTokens.filter(f => f.startsWith('templates/pages/')).length);

/* ---------- 5. nothing published links into a pruned path ---------- */
console.log('\n===== NO PUBLISHED PAGE LINKS INTO A PRUNED DIRECTORY =====');
{
  let refs = 0; const broken = [];
  for (const f of survivingHtml) {
    const html = textOf(f).toString('utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#?:]+)"/g)) {
      const target = m[1];
      if (/^(\/\/|#)/.test(target)) continue;
      refs++;
      const norm = target.replace(/^\.\//, '').replace(/^\//, '').replace(/^\.\.\//, '');
      if (isPruned(norm)) broken.push(f + ' -> ' + target);
    }
  }
  check('published pages contain local references to check', refs > 20, refs);
  check('none of them points into a pruned directory', broken.length === 0, broken);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
