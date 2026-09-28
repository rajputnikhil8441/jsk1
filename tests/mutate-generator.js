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
const { execFileSync, spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SUITES = ['test_generator.js', 'test_multibrand.js', 'test_deploy_surface.js',
  'test_assembly.js', 'test_staging.js', 'test_cms_brands.js', 'test_staging_cms.js'];

/* Suites that drive a browser against the site over HTTP, so the sandbox
   needs the static server the real runner would have started. */
const NEED_SERVER = ['test_cms_brands.js'];

/* Only what the two suites read. node_modules and .git are excluded
   deliberately: neither suite needs a browser. */
const COPY = ['js', 'css', 'admin', 'assets', 'tools', 'templates', 'brands', '.github', '.gitignore',
  'index.html', 'about.html', 'contact.html', 'login.html', 'register.html',
  'privacy-policy.html', 'responsible-gaming.html', '404.html',
  'sitemap.xml', 'robots.txt'];

function copyInto(sandbox) {
  fs.mkdirSync(path.join(sandbox, 'tests'), { recursive: true });
  for (const rel of COPY) fs.cpSync(path.join(ROOT, rel), path.join(sandbox, rel), { recursive: true });
  for (const s of SUITES) fs.cpSync(path.join(__dirname, s), path.join(sandbox, 'tests', s));
  fs.cpSync(path.join(__dirname, 'serve.js'), path.join(sandbox, 'tests', 'serve.js'));
  fs.cpSync(path.join(__dirname, 'fixtures'), path.join(sandbox, 'tests', 'fixtures'), { recursive: true });
  /* test_deploy_surface.js asks git what a fresh checkout contains, which is
     the only honest way to ask -- so the sandbox has to be a repository too.
     Indexing it also makes .gitignore apply, exactly as in the real one. */
  gitInit(sandbox);
  /* test_staging.js drives a real browser, because the one thing it has to
     prove -- that js/cms.js does not repaint a review host's canonical and
     robots tags back to production -- only happens once scripts run. The
     sandbox borrows the installed playwright rather than reinstalling it. */
  try {
    fs.symlinkSync(path.join(__dirname, 'node_modules'), path.join(sandbox, 'tests', 'node_modules'));
  } catch (e) { /* already there, or unsupported: the suite will say so */ }
}

function gitInit(sandbox) {
  const env = Object.assign({}, process.env, {
    GIT_AUTHOR_NAME: 'mutation', GIT_AUTHOR_EMAIL: 'mutation@example.invalid',
    GIT_COMMITTER_NAME: 'mutation', GIT_COMMITTER_EMAIL: 'mutation@example.invalid'
  });
  execFileSync('git', ['init', '-q'], { cwd: sandbox, env, stdio: 'ignore' });
  execFileSync('git', ['add', '-A'], { cwd: sandbox, env, stdio: 'ignore' });
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

  /* ---- the deploy surface: the source templates must not become pages ---- */
  { id: 'W1', desc: 'the prune step is renamed, so nothing removes the sources',
    file: '.github/workflows/static.yml', expect: 'test_deploy_surface.js',
    find: '- name: Remove build-only sources from the published site',
    repl: '- name: Tidy up' },

  { id: 'W2', desc: 'templates/ is dropped from the list of removed directories',
    file: '.github/workflows/static.yml', expect: 'test_deploy_surface.js',
    find: '          rm -rf templates brands tools tests',
    repl: '          rm -rf brands tools tests' },

  { id: 'W3', desc: 'the prune no longer verifies that the directories are gone',
    file: '.github/workflows/static.yml', expect: 'test_deploy_surface.js',
    find: '          for d in templates brands tools tests; do',
    repl: '          for d in brands tools; do' },

  { id: 'W4', desc: 'a failed verification no longer fails the deploy',
    file: '.github/workflows/static.yml', expect: 'test_deploy_surface.js',
    find: 'echo "::error::$f is missing after the prune"; exit 1',
    repl: 'echo "::warning::$f is missing after the prune"' },

  { id: 'W5', desc: 'the prune runs after the artifact has already been packed',
    file: '.github/workflows/static.yml', expect: 'test_deploy_surface.js',
    find: '      - name: Upload artifact\n        uses: actions/upload-pages-artifact@v3\n        with:\n          # Upload entire repository\n          path: \'.\'\n',
    repl: '' },

  { id: 'W6', desc: 'the prune takes a real production directory with it',
    file: '.github/workflows/static.yml', expect: 'test_deploy_surface.js',
    find: '          rm -rf templates brands tools tests',
    repl: '          rm -rf templates brands tools tests assets' },

  { id: 'W7', desc: 'a stray un-rendered page appears outside every pruned directory',
    file: 'preview/login.html', expect: 'test_deploy_surface.js',
    add: '<!DOCTYPE html>\n<html><head><title>Login — {{brand.name}}</title>\n' +
         '<link rel="canonical" href="https://{{brand.domain}}/login.html" />\n' +
         '</head><body>stray</body></html>\n' },

  { id: 'W8', desc: 'a copy of a template is dropped at the repository root',
    file: 'login-template.html', expect: 'test_deploy_surface.js',
    add: '<!DOCTYPE html>\n<html><head><title>{{brand.name}}</title></head><body>x</body></html>\n' },

  /* ---- assembly, and the ways one brand becomes another ---- */
  { id: 'P1', desc: 'the shared js/brand.js is published, so a brand serves another brand\'s data',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: "const BRAND_OWNED = ['js/brand.js'];", repl: 'const BRAND_OWNED = [];' },

  { id: 'P2', desc: 'the brand\'s static/ overlay is ignored',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: '    const overlay = [...overlaySource.keys()].sort();', repl: '    const overlay = [];' },

  { id: 'P3', desc: 'the overlay is applied BEFORE the shared engine, so shared files win',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: "    for (const p of site.shared) copyFile(path.join(site.sharedRoot, p), kit.safeJoin(dest, p, 'Shared file'));\n" +
          "    for (const p of site.overlay) copyFile(site.overlaySource.get(p), kit.safeJoin(dest, p, 'Overlay file'));",
    repl: "    for (const p of site.overlay) copyFile(site.overlaySource.get(p), kit.safeJoin(dest, p, 'Overlay file'));\n" +
          "    for (const p of site.shared) copyFile(path.join(site.sharedRoot, p), kit.safeJoin(dest, p, 'Shared file'));" },

  { id: 'P4', desc: 'build configuration is published onto the live domain',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: "const NOT_PUBLISHED = ['seo-config.json'];", repl: 'const NOT_PUBLISHED = [];' },

  { id: 'P5', desc: 'the SEO step is not told which brand it is building',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: "        '--brand', site.plan.brand.domain, '--out', dest, '--config', seoCfg];",
    repl: "        '--out', dest, '--config', seoCfg];" },

  { id: 'P6', desc: 'the SEO step reads the root fallback instead of the brand\'s own',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: "        '--brand', site.plan.brand.domain, '--out', dest, '--config', seoCfg];",
    repl: "        '--brand', site.plan.brand.domain, '--out', dest];" },

  { id: 'P7', desc: 'the shared asset directory is left out of every site',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: "const SHARED_DIRS = ['js', 'css', 'admin', 'assets'];",
    repl: "const SHARED_DIRS = ['js', 'css', 'admin'];" },

  { id: 'P8', desc: 'an unregistered brand assembles with no warning at all',
    file: 'tools/lib/sitekit.js', expect: 'test_assembly.js',
    find: '    return Object.keys(sandbox.window.CMS_BRANDS || {});', repl: '    return null;' },

  { id: 'P9', desc: 'Playzone9 is pointed at JSK1\'s Supabase row',
    file: 'js/cms-config.js', expect: 'test_generator.js',
    find: "    'playzone9.app': {\n        siteId: 'playzone9app',",
    repl: "    'playzone9.app': {\n        siteId: 'playzone9'," },

  { id: 'P10', desc: 'Playzone9 and JSK1 are given the same media bucket',
    file: 'js/cms-config.js', expect: 'test_generator.js',
    find: "        siteId: 'playzone9app',\n        bucket: 'cms-media-pz9'",
    repl: "        siteId: 'playzone9app',\n        bucket: 'cms-media'" },

  { id: 'P11', desc: 'Playzone9\'s brand layer is contaminated with the JSK1 name',
    file: 'brands/playzone9.app/brand.js', expect: 'test_assembly.js',
    find: "    branding: {\n        siteName: 'Playzone9',", repl: "    branding: {\n        siteName: 'JSK1'," },

  { id: 'P12', desc: 'a brand key DEFAULTS leaves empty is blanked, wiping the static copy',
    file: 'brands/playzone9.app/brand.js', expect: 'test_assembly.js',
    find: "'footer.copyright': '© Copyright 2026 Playzone9. All Rights Reserved.',",
    repl: "'footer.copyright': ''," },

  { id: 'P13', desc: 'Playzone9\'s sitemap is pointed at the other brand\'s domain',
    file: 'brands/playzone9.app/seo-config.json', expect: 'test_assembly.js',
    find: '"baseUrl": "https://playzone9.app"', repl: '"baseUrl": "https://jsk-1.com"' },

  { id: 'P14', desc: 'the register slot point is removed from the shared template',
    file: 'templates/pages/register.html', expect: 'test_assembly.js',
    find: '</form><!-- BRAND:register-notice --><!-- /BRAND:register-notice -->', repl: '</form>' },

  { id: 'P15', desc: 'the shared admin panel is re-branded to one brand',
    file: 'admin/index.html', expect: 'test_assembly.js',
    find: '<small id="brandLabel">BRAND</small>', repl: '<small id="brandLabel">JSK1</small>' },

  { id: 'P16', desc: 'the admin tab title stops being painted from the brand (both call sites)',
    file: 'js/admin.js', expect: 'test_assembly.js', all: 2,
    find: "        document.title = brandName + ' CMS — Admin';", repl: '' },

  /* ---- SEO: the most expensive thing to get wrong, so mutated hardest.
     A canonical or a sitemap URL on the other brand's domain hands one
     brand's ranking to the other and reads as duplicate content. ---- */
  { id: 'S1', desc: 'the canonical URL is hardcoded to one brand\'s domain',
    file: 'templates/pages/index.html', expect: 'test_assembly.js',
    find: '<link rel="canonical" href="https://{{brand.domain}}/" />',
    repl: '<link rel="canonical" href="https://jsk-1.com/" />' },

  { id: 'S2', desc: 'og:url is hardcoded to one brand\'s domain',
    file: 'templates/pages/index.html', expect: 'test_assembly.js',
    find: '<meta property="og:url" content="https://{{brand.domain}}/" />',
    repl: '<meta property="og:url" content="https://jsk-1.com/" />' },

  { id: 'S3', desc: 'both JSON-LD schema URLs are hardcoded to one brand',
    file: 'templates/pages/index.html', expect: 'test_assembly.js', all: 2,
    find: '"url": "https://{{brand.domain}}/"', repl: '"url": "https://jsk-1.com/"' },

  { id: 'S4', desc: 'the login page becomes indexable',
    file: 'templates/pages/login.html', expect: 'test_assembly.js',
    find: '<meta name="robots" content="noindex,follow" />',
    repl: '<meta name="robots" content="index,follow" />' },

  /* Flipping ONE of these is inert, and that is worth knowing rather than
     hiding: js/seo-files.js drops a page whose robots.index is false
     BEFORE it looks at inSitemap, so either flag alone keeps a page out of
     the sitemap. Two independent guards. The mutant therefore defeats
     both, which is what it would take in practice. */
  { id: 'S5', desc: 'a login page is made indexable AND put into one brand\'s sitemap',
    file: 'brands/playzone9.app/seo-config.json', expect: 'test_assembly.js',
    find: '"login": { "url": "login.html", "updatedAt": "", "inSitemap": false, "robots": { "index": false } }',
    repl: '"login": { "url": "login.html", "updatedAt": "", "inSitemap": true, "robots": { "index": true } }' },

  { id: 'S6', desc: 'og:site_name is hardcoded, so every brand shares one social identity',
    file: 'templates/pages/index.html', expect: 'test_assembly.js',
    find: '<meta property="og:site_name" content="{{brand.name}}" />',
    repl: '<meta property="og:site_name" content="JSK1" />' },

  { id: 'S7', desc: 'internal links are made root-absolute, breaking on any sub-path host',
    file: 'templates/pages/index.html', expect: 'test_assembly.js', all: 2,
    find: 'href="about.html"', repl: 'href="/about.html"' },

  /* ---- staging: a review host that gets indexed competes with the real
     site for the real site's own terms, and a review host that claims the
     production domain hands its signals to a domain nobody has connected.
     Each of these is one of the ways that happens. ---- */
  { id: 'T1', desc: 'an environment\'s noindex flag is ignored',
    file: 'tools/lib/brandkit.js', expect: 'test_staging.js',
    find: 'noindex: e.noindex === true', repl: 'noindex: false' },

  { id: 'T2', desc: 'the static robots meta is never rewritten for a noindex build',
    file: 'tools/lib/brandkit.js', expect: 'test_staging.js',
    find: '    if (brand.noindex) {\n        let hits = 0;', repl: '    if (false) {\n        let hits = 0;' },

  { id: 'T3', desc: 'the engine stops honouring a whole-deployment noindex, so JS repaints it indexable',
    file: 'js/cms.js', expect: 'test_staging.js',
    find: "        if (window.CMS_NOINDEX === true) return 'noindex,nofollow';", repl: '' },

  { id: 'T4', desc: 'the staging build keeps the brand\'s production baseUrl, so JS repaints the canonical to production',
    file: 'tools/lib/brandkit.js', expect: 'test_staging.js',
    find: "        '    b.seo.baseUrl = ' + JSON.stringify('https://' + brand.domain) + ';\\n' +",
    repl: "        '    b.seo.baseUrl = ' + JSON.stringify('https://' + brand.canonicalDomain) + ';\\n' +" },

  { id: 'T5', desc: 'a review host publishes a sitemap, inviting the crawl it must not get',
    file: 'tools/lib/sitekit.js', expect: 'test_staging.js',
    find: "    const seo = plan.brand.noindex ? ['robots.txt'] : ['sitemap.xml', 'robots.txt'];",
    repl: "    const seo = ['sitemap.xml', 'robots.txt'];" },

  { id: 'T6', desc: 'the staging robots.txt allows everything',
    file: 'tools/lib/sitekit.js', expect: 'test_staging.js',
    find: "        'Disallow: /\\n';", repl: "        'Allow: /\\n';" },

  { id: 'T7', desc: 'an environment may point at the brand\'s canonical domain',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (e.host === cfg.domain) {', repl: '    if (false) {' },

  { id: 'T8', desc: 'an environment may share the canonical environment\'s Supabase row',
    file: 'tools/lib/brandkit.js', expect: 'test_generator.js',
    find: '    if (e.siteId !== undefined && e.siteId === cfg.siteId) {', repl: '    if (false) {' },

  { id: 'T9', desc: 'the environment\'s siteId is ignored, so staging reads the production row',
    file: 'tools/lib/brandkit.js', expect: 'test_staging.js',
    find: "        siteId: typeof e.siteId === 'string' && e.siteId.trim() ? e.siteId : cfg.siteId,",
    repl: '        siteId: cfg.siteId,' },

  { id: 'T10', desc: 'the staging build writes over the production build\'s output directory',
    file: 'tools/lib/brandkit.js', expect: 'test_staging.js',
    find: "        output: typeof e.output === 'string' && e.output ? assertId(e.output) : assertId(e.host),",
    repl: '        output: id,' },

  { id: 'T11', desc: 'the staging host is unregistered, so it resolves to the default brand',
    file: 'js/cms-config.js', expect: 'test_staging.js',
    find: "    'playzones9.com': {\n        siteId: 'playzone9staging',",
    repl: "    'playzones9.com.disabled': {\n        siteId: 'playzone9staging'," },

  { id: 'T12', desc: 'the staging host is pointed at JSK1\'s row',
    file: 'js/cms-config.js', expect: 'test_generator.js',
    find: "    'playzones9.com': {\n        siteId: 'playzone9staging',",
    repl: "    'playzones9.com': {\n        siteId: 'playzone9'," },

  { id: 'T13', desc: 'the staging workflow is given permission to deploy to Pages',
    file: '.github/workflows/staging-playzone9.yml', expect: 'test_staging.js',
    find: 'permissions:\n  contents: read',
    repl: 'permissions:\n  contents: read\n  pages: write\n  id-token: write' },

  { id: 'T14', desc: 'the staging workflow starts running on every push to main',
    file: '.github/workflows/staging-playzone9.yml', expect: 'test_staging.js',
    find: 'on:\n  workflow_dispatch:',
    repl: 'on:\n  workflow_dispatch:\n  push:\n    branches: ["main"]' },

  { id: 'T15', desc: 'the staging workflow takes the production deploy\'s concurrency group',
    file: '.github/workflows/staging-playzone9.yml', expect: 'test_staging.js',
    find: 'group: "staging-playzone9"', repl: 'group: "pages"' },

  { id: 'T16', desc: 'the staging workflow builds the canonical domain instead of staging',
    file: '.github/workflows/staging-playzone9.yml', expect: 'test_staging.js',
    find: 'node tools/build-site.js playzone9.app --env staging --out staging-out',
    repl: 'node tools/build-site.js playzone9.app --out staging-out' },

  { id: 'T17', desc: 'the head-extra slot point is removed, so a brand cannot ship its own stylesheet',
    file: 'templates/pages/login.html', expect: 'test_generator.js',
    find: '<!-- BRAND:head-extra --><!-- /BRAND:head-extra -->', repl: '' },

  { id: 'T18', desc: 'the brand overlay is dropped from the staging build',
    file: 'tools/lib/sitekit.js', expect: 'test_staging.js',
    find: "    for (const p of site.overlay) copyFile(site.overlaySource.get(p), kit.safeJoin(dest, p, 'Overlay file'));",
    repl: '' },

  /* ---- the multi-brand CMS. One admin, one row per hostname. The
     failure these guard against is one brand's admin overwriting
     another brand's content, which is unrecoverable: the row is
     replaced whole. ---- */
  { id: 'C1', desc: 'the publish guard is removed, so a misconfigured admin writes another brand\'s row',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: '            if (!Brand.agrees()) {', repl: '            if (false) {' },

  { id: 'C2', desc: 'CMS.brand.agrees() always says yes',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: '            return !want || want === Brand.siteId();',
    repl: '            return true;' },

  { id: 'C3', desc: 'the registry lookup returns nothing, so the guard never fires',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: "        var brands = window.CMS_BRANDS;\n        if (!brands || typeof brands !== 'object') return '';",
    repl: "        var brands = window.CMS_BRANDS;\n        return '';\n        if (!brands || typeof brands !== 'object') return '';" },

  { id: 'C4', desc: 'every hostname reports itself as a registered brand',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: '        matched: function () { return (window.CMS_BRAND_RESOLVED || {}).matched === true; },',
    repl: '        matched: function () { return true; },' },

  { id: 'C5', desc: 'the brand registry reads as empty, so the CMS shows no other brand',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: '            var brands = window.CMS_BRANDS || {}, out = [], k;',
    repl: '            var brands = {}, out = [], k;' },

  { id: 'C6', desc: 'CMS.brand.siteId() reports the default brand rather than the configured row',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: "        siteId: function () { return String((window.CMS_REMOTE || {}).siteId || ''); },",
    repl: "        siteId: function () { return registrySiteId(); }," },

  { id: 'C7', desc: 'the admin stops rendering the Brands panel',
    file: 'js/admin.js', expect: 'test_cms_brands.js', all: 2,
    find: '        buildBrands();', repl: '' },

  { id: 'C8', desc: 'the sidebar stops saying which hostname is being edited',
    file: 'js/admin.js', expect: 'test_cms_brands.js', all: 2,
    find: "            hostLine.textContent = CMS.brand.host() || 'no hostname';", repl: '' },

  { id: 'C9', desc: 'a brand identity value is added to the shared DEFAULTS',
    file: 'js/cms.js', expect: 'test_cms_brands.js',
    find: "        branding: {\n            siteName: '',",
    repl: "        branding: {\n            siteName: 'Playzone9'," },

  { id: 'C10', desc: 'the shared admin markup is re-branded',
    file: 'admin/index.html', expect: 'test_cms_brands.js',
    find: '<title>CMS — Admin</title>', repl: '<title>JSK1 CMS — Admin</title>' },

  { id: 'C11', desc: 'the Brands panel is removed from the shared admin',
    file: 'admin/index.html', expect: 'test_cms_brands.js',
    find: 'id="panel-brands"', repl: 'id="panel-brands-disabled"' },

  /* ---- the environment overlay. A CNAME is the file that makes a host
     start serving a domain, so which build carries one is the whole
     question. ---- */
  { id: 'E1', desc: 'the environment overlay is never applied, so staging ships no CNAME',
    file: 'tools/lib/sitekit.js', expect: 'test_staging_cms.js',
    find: '    if (plan.brand.env !== kit.CANONICAL_ENV) {', repl: '    if (false) {' },

  { id: 'E2', desc: 'the environment overlay is applied to EVERY build, so the reserved production domain gets a CNAME',
    file: 'tools/lib/sitekit.js', expect: 'test_staging_cms.js',
    find: '    if (plan.brand.env !== kit.CANONICAL_ENV) {', repl: '    if (true) {' },

  { id: 'E3', desc: 'the brand overlay wins over the environment overlay, so a host file cannot override a brand file',
    file: 'tools/lib/sitekit.js', expect: 'test_staging_cms.js',
    find: '            overlaySource.set(rel, path.join(dir, rel));',
    repl: '            if (!overlaySource.has(rel)) overlaySource.set(rel, path.join(dir, rel));' },

  { id: 'E4', desc: 'the staging CNAME names the production domain instead',
    file: 'brands/playzone9.app/static-staging/CNAME', expect: 'test_staging_cms.js',
    find: 'playzones9.com', repl: 'playzone9.app' }
];

function run(sandbox, suite) {
  let out = '', code = 0;
  /* Its own server process, killed afterwards, so a mutant that wedges one
     cannot leak into the next mutant's run. */
  let server = null;
  if (NEED_SERVER.includes(suite)) {
    server = spawn(process.execPath, [path.join(sandbox, 'tests', 'serve.js')],
      { cwd: sandbox, stdio: 'ignore' });
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      try {
        execFileSync(process.execPath, ['-e',
          'require("http").get({host:"localhost",port:8777,path:"/index.html"},r=>process.exit(r.statusCode===200?0:1))' +
          '.on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),800)'], { stdio: 'ignore' });
        break;
      } catch (e) { /* not up yet */ }
    }
  }
  try {
    out = execFileSync(process.execPath, [path.join(sandbox, 'tests', suite)],
      { encoding: 'utf8', cwd: sandbox });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); code = e.status === undefined ? 1 : e.status; }
  finally { if (server) { try { server.kill(); } catch (e) {} } }
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

  /* An "add" mutant creates a file instead of editing one. Some guards --
     "no stray page can appear outside the pruned directories" -- can only
     be broken by adding something, and a harness that cannot add a file
     cannot test them. */
  if (mut.add !== undefined) {
    if (fs.existsSync(target)) {
      console.log('  ANCHOR  ' + mut.id + ': ' + mut.file + ' already exists; an "add" mutant must create a new file.');
      survived.push(mut.id + ' (bad anchor)');
      fs.rmSync(box, { recursive: true, force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, mut.add);
    gitInit(box);                     /* re-index so git sees the new file */
    const results = SUITES.map(s => [s, run(box, s)]);
    const noticed = results.filter(([, r]) => r.crashed || r.failed > 0 || r.code !== 0).map(([s]) => s);
    if (noticed.length) {
      caught++;
      console.log('  caught  ' + mut.id + '  ' + mut.desc);
      console.log('          noticed by: ' + noticed.join(', ') +
        (noticed.includes(mut.expect) ? '' : '   (NOT by ' + mut.expect + ')'));
    } else {
      survived.push(mut.id);
      console.log('  SURVIVED ' + mut.id + '  ' + mut.desc);
      results.forEach(([s, r]) => console.log('          ' + s + ': ' + r.passed + ' passed, ' + r.failed + ' failed'));
    }
    fs.rmSync(box, { recursive: true, force: true });
    continue;
  }

  const src = fs.readFileSync(target, 'utf8');
  const occurrences = src.split(mut.find).length - 1;
  /* `all` is for a guard that legitimately appears at more than one call
     site: removing only one of them leaves the other still working, so the
     mutant would be a no-op dressed up as a test. */
  const wanted = mut.all || 1;
  if (occurrences !== wanted) {
    console.log('  ANCHOR  ' + mut.id + ': found ' + occurrences + ' occurrences of the anchor in ' +
      mut.file + ' -- expected exactly ' + wanted + '. Not a mutant result; fix the harness.');
    survived.push(mut.id + ' (bad anchor)');
    fs.rmSync(box, { recursive: true, force: true });
    continue;
  }
  fs.writeFileSync(target, mut.all ? src.split(mut.find).join(mut.repl) : src.replace(mut.find, mut.repl));

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
