#!/usr/bin/env node
/* =====================================================================
   WHAT THE PRODUCTION DOMAIN SERVES
   ---------------------------------------------------------------------
   The question this suite answers has not changed since Phase 4: can a
   file that is not part of the site reach the live domain, and can a
   page reach it carrying an unresolved {{brand.*}} token or a link into
   something that was never published?

   The ANSWER changed. The deploy used to upload `path: '.'` -- the whole
   repository -- and delete four build-only directories from the runner's
   checkout first. It now ASSEMBLES the site:

       node tools/build-site.js jsk-1.com --out _site
       upload-pages-artifact  path: '_site/jsk-1.com'

   so the published surface is a built artifact rather than a pruned
   checkout. templates/, brands/, tools/ and tests/ are not deleted; they
   are simply never copied, and neither is anything else that the brand
   system does not name. That is a stronger guarantee than a prune, and
   it is why the old assertions about `rm -rf` are gone rather than
   preserved: they described a mechanism that no longer exists, and
   keeping them would have meant keeping the mechanism.

   The assertions themselves are the same claims, made against the real
   artifact instead of a simulated prune:

     - exactly the nine production pages are published, and every other
       .html in the repository is absent from the artifact. A new
       template, fixture or scratch page anywhere fails here.
     - every file the site cannot work without is present.
     - nothing published carries an unresolved token, and the repository
       DOES contain files that do -- otherwise the scan proves nothing.
     - no published page links to anything the artifact does not contain.
       This is new, and stricter than "does not point into a pruned
       directory": it catches a broken internal link of any kind.

   The artifact is built into a throwaway directory. Nothing is written
   inside the repository.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOW = path.join(ROOT, '.github', 'workflows', 'static.yml');
const SITE = require(path.join(ROOT, 'tools', 'lib', 'sitekit.js'));

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

/* Files the site cannot work without. If the assembly ever stops emitting
   one of these, this suite fails before the deploy does. */
const MUST_PUBLISH = [
  'index.html', 'admin/index.html', 'js/cms.js', 'js/cms-config.js', 'js/brand.js',
  'css/style.css', 'assets/asset-manifest.json', 'sitemap.xml', 'robots.txt'
];

/* Directories that exist only to BUILD the site. None of them may appear
   in the artifact, by any path. */
const BUILD_ONLY = ['brands', 'templates', 'tests', 'tools'].sort();

/* ---------- the repository as a fresh checkout sees it ---------- */
const FILES = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'],
  { cwd: ROOT, encoding: 'utf8' }).split('\n').map(s => s.trim()).filter(Boolean).sort();

console.log('\n===== THE FILE LIST IS REAL =====');
check('git listed the repository contents', FILES.length > 50, FILES.length);
check('the list excludes generated output (sites/ is gitignored)',
  !FILES.some(f => f.startsWith('sites/')));
check('the list excludes the assembled artifact (_site/ is gitignored)',
  !FILES.some(f => f.startsWith('_site/')));
check('the list excludes node_modules', !FILES.some(f => f.indexOf('node_modules/') > -1));
const HTML = FILES.filter(f => f.endsWith('.html'));
check('the repository contains .html files to classify', HTML.length > 0, HTML.length);

/* ---------- 1. the workflow says what we think it says ---------- */
console.log('\n===== THE DEPLOY ASSEMBLES BEFORE IT PACKS =====');
const wf = fs.readFileSync(WORKFLOW, 'utf8');
const stepNames = [...wf.matchAll(/^ {6}- name: (.+)$/gm)].map(m => m[1].trim());
check('the workflow declares steps', stepNames.length > 0, stepNames);

/* The repository root must NOT be what is uploaded. This is the assertion
   the old architecture had inverted, and it is the whole point of the
   change: uploading '.' is what published templates/ and fixtures. */
check('the repository root is NOT the upload path', !/^\s*path: '\.'\s*$/m.test(wf));

const buildRun = wf.match(/run: node tools\/build-site\.js ([^\s]+)[^\n]*--out ([^\s\n]+)/);
check('the deploy assembles the site with tools/build-site.js', !!buildRun,
  wf.match(/run: [^\n]*/g));
const builtBrand = buildRun ? buildRun[1] : '';
const builtOut = buildRun ? buildRun[2] : '';
check('it names a brand to build', /^[a-z0-9.-]+$/.test(builtBrand), builtBrand);
check('it writes to an output directory rather than over the checkout',
  builtOut.length > 0 && builtOut !== '.' && !builtOut.startsWith('/'), builtOut);

const uploadPath = (wf.match(/^\s*path: '([^']+)'\s*$/m) || [])[1] || '';
check('the artifact is the assembled site for that brand',
  uploadPath === builtOut + '/' + builtBrand, { uploadPath, expected: builtOut + '/' + builtBrand });

const iAssemble = stepNames.findIndex(n => /^Assemble/.test(n));
const iUpload = stepNames.findIndex(n => /^Upload artifact/.test(n));
const iDeploy = stepNames.findIndex(n => /^Deploy to GitHub Pages/.test(n));
check('the assemble step is present', iAssemble > -1, stepNames);
check('the upload step is present', iUpload > -1, stepNames);
check('the deploy step is present', iDeploy > -1, stepNames);
check('the site is assembled BEFORE the artifact is packed', iAssemble < iUpload, [iAssemble, iUpload]);
check('the artifact is packed BEFORE it is deployed', iUpload < iDeploy, [iUpload, iDeploy]);

/* Nothing is deleted from the checkout any more. A deploy that both built
   an artifact and pruned the repository would be two mechanisms doing one
   job, and the prune is the one that fails silently on a renamed path. */
check('the deploy deletes nothing from the checkout', !/rm -rf/.test(wf), (wf.match(/rm -rf[^\n]*/g) || []));

/* The build is what fails the deploy now: build-site.js verifies its own
   output and exits non-zero, so a broken assembly never reaches upload. */
check('the assembly step is a plain run step, so a non-zero exit fails the deploy',
  /- name: Assemble[^\n]*\n\s*run: node tools\/build-site\.js/.test(wf));

/* The permissions, trigger and concurrency are not this change's business
   and are asserted so that they cannot drift with it. */
check('the deploy still runs on a push to main', /push:\s*\n\s*branches: \["main"\]/.test(wf));
check('the job still holds only the three Pages permissions',
  /permissions:\s*\n\s*contents: read\s*\n\s*pages: write\s*\n\s*id-token: write/.test(wf));
check('deployments are still serialised on the "pages" group',
  /concurrency:\s*\n\s*group: "pages"/.test(wf));

/* ---------- the artifact itself ---------- */
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-surface-'));
let published = [];
try {
  const plan = SITE.planSite({
    brandsDir: path.join(ROOT, 'brands'), templatesDir: path.join(ROOT, 'templates'),
    sharedRoot: ROOT, id: builtBrand || 'jsk-1.com', env: ''
  });
  const res = SITE.assemble(plan, OUT);
  const walk = d => fs.readdirSync(path.join(res.dir, d), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  published = walk('').map(f => f.split(path.sep).join('/').replace(/^\.\//, '')).sort();
  var DIR = res.dir;
} catch (e) {
  check('the site assembles', false, e.message);
}
const isPublished = f => published.indexOf(f) > -1;

/* ---------- 2. every .html is classified ---------- */
console.log('\n===== NO .html CAN BECOME AN ACCIDENTAL PAGE =====');
for (const p of PRODUCTION_HTML) {
  check('production page ' + p + ' exists in the repository', fs.existsSync(path.join(ROOT, p)));
  check('production page ' + p + ' is in the checkout', FILES.indexOf(p) > -1);
  check('production page ' + p + ' is published', isPublished(p));
}

const nonProduction = HTML.filter(f => PRODUCTION_HTML.indexOf(f) === -1);
/* If this list were empty the loop below would pass having proved
   nothing, which is precisely the failure mode this suite exists for. */
check('there ARE non-production .html files to account for', nonProduction.length > 0, nonProduction.length);
check('and there are at least the sixteen known ones (templates + golden fixtures)',
  nonProduction.length >= 16, nonProduction.length);
const leaked = nonProduction.filter(isPublished);
check('no non-production .html file is published', leaked.length === 0, leaked);
check('the eight source templates are not published',
  HTML.filter(f => f.startsWith('templates/pages/')).length === 8 &&
  !HTML.filter(f => f.startsWith('templates/pages/')).some(isPublished),
  HTML.filter(f => f.startsWith('templates/pages/')).length);
check('the eight Phase 0 golden fixtures are not published',
  HTML.filter(f => f.startsWith('tests/fixtures/golden-jsk1/')).length === 8 &&
  !HTML.filter(f => f.startsWith('tests/fixtures/golden-jsk1/')).some(isPublished));
/* acme's login slot, zeta's login override, omega's login and register
   slots. Counted so that a new fixture page has to be accounted for here
   rather than quietly appearing on a live domain. */
check('the synthetic brands\' page and slot files are not published',
  HTML.filter(f => f.startsWith('tests/fixtures/brands/')).length === 4 &&
  !HTML.filter(f => f.startsWith('tests/fixtures/brands/')).some(isPublished),
  HTML.filter(f => f.startsWith('tests/fixtures/brands/')));

/* ---------- 3. what a deploy would actually publish ---------- */
console.log('\n===== THE PUBLISHED SURFACE =====');
check('a deploy publishes files', published.length > 0, published.length);
check('the artifact is smaller than the repository', published.length < FILES.length,
  FILES.length + ' -> ' + published.length);
let kept = 0;
for (const f of MUST_PUBLISH) {
  if (isPublished(f)) kept++;
  else check('the site still publishes ' + f, false);
}
check('all nine essential files are published', kept === MUST_PUBLISH.length && kept === 9, kept);
const publishedHtml = published.filter(f => f.endsWith('.html')).sort();
check('exactly the nine production pages are published',
  JSON.stringify(publishedHtml) === JSON.stringify(PRODUCTION_HTML), publishedHtml);

/* No build-only directory may appear in the artifact under any path. The
   old suite could only assert this about the four it deleted; the
   assembler copies by name, so it can be asserted absolutely. */
for (const d of BUILD_ONLY) {
  check('nothing under ' + d + '/ is published',
    !published.some(f => f === d || f.startsWith(d + '/')),
    published.filter(f => f.startsWith(d + '/')).slice(0, 5));
}
for (const gone of ['templates/pages/login.html', 'tests/fixtures/golden-jsk1/index.html',
  'brands/jsk-1.com/brand.js', 'tools/lib/brandkit.js', 'tests/test_generator.js']) {
  check(gone + ' is NOT published', !isPublished(gone));
}
/* Documentation and repository housekeeping are not the site either. They
   were published by `path: '.'` and are not any more. */
for (const gone of ['README.md', '.gitignore', 'docs/publishing.md',
  '.github/workflows/static.yml', 'SETUP-SUPABASE.txt']) {
  check(gone + ' is NOT published', !isPublished(gone));
}

/* ---------- 4. no unresolved token can reach the domain ---------- */
console.log('\n===== NOTHING PUBLISHED CARRIES AN UNRESOLVED TOKEN =====');
const TEXTISH = /\.(html|js|css|json|txt|xml|md|yml)$/;
let scanned = 0; const tokenLeaks = [];
for (const f of published.filter(f => TEXTISH.test(f))) {
  const b = fs.readFileSync(path.join(DIR, f));
  scanned++;
  if (b.includes('{{brand.')) tokenLeaks.push(f);
}
check('published text files were scanned', scanned > 20, scanned);
check('no published file contains a {{brand.*}} token', tokenLeaks.length === 0, tokenLeaks);
let publishedHtmlScanned = 0; const braceLeaks = [];
for (const f of publishedHtml) {
  publishedHtmlScanned++;
  if (fs.readFileSync(path.join(DIR, f)).includes('{{')) braceLeaks.push(f);
}
check('all nine published pages were scanned for "{{"', publishedHtmlScanned === 9, publishedHtmlScanned);
check('no published page contains "{{" at all', braceLeaks.length === 0, braceLeaks);
/* And no leftover slot marker, which the assembler also checks -- asserted
   here too because this suite is the one that describes the surface. */
const markerLeaks = publishedHtml.filter(f => /<!-- \/?BRAND:/.test(fs.readFileSync(path.join(DIR, f), 'utf8')));
check('no published page contains a leftover BRAND: slot marker', markerLeaks.length === 0, markerLeaks);

/* The other direction: if nothing in the repository contained a token, the
   scan above would be measuring an empty problem. */
const repoWithTokens = FILES.filter(f => TEXTISH.test(f)).filter(f => {
  try { return fs.readFileSync(path.join(ROOT, f)).includes('{{brand.'); } catch (e) { return false; }
});
check('the repository DOES contain {{brand.*}} tokens, so the scan is meaningful',
  repoWithTokens.length >= 8, repoWithTokens.length);
check('and the un-rendered templates are among them',
  repoWithTokens.filter(f => f.startsWith('templates/pages/')).length === 8,
  repoWithTokens.filter(f => f.startsWith('templates/pages/')).length);
check('none of those token-carrying files is published',
  !repoWithTokens.some(isPublished), repoWithTokens.filter(isPublished));

/* ---------- 5. nothing published links to something that is not ---------- */
console.log('\n===== NO PUBLISHED PAGE LINKS OUTSIDE THE ARTIFACT =====');
{
  let refs = 0; const broken = [];
  for (const f of publishedHtml) {
    const html = fs.readFileSync(path.join(DIR, f), 'utf8');
    for (const m of html.matchAll(/(?:href|src)="([^"#?:]+)"/g)) {
      const target = m[1];
      if (/^(\/\/|#)/.test(target)) continue;
      refs++;
      let n = target.replace(/^\.\//, '').replace(/^\//, '');
      if (n === '' || n.endsWith('/')) n += 'index.html';
      n = path.posix.normalize(path.posix.join(path.posix.dirname(f), n)).replace(/^\.\//, '');
      if (!isPublished(n)) broken.push(f + ' -> ' + target);
    }
  }
  check('published pages contain local references to check', refs > 20, refs);
  check('every local reference resolves to a published file', broken.length === 0, broken);
}

fs.rmSync(OUT, { recursive: true, force: true });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
