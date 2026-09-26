'use strict';
/* ============================================================
   SITEKIT — assembling one brand's deployable site
   ------------------------------------------------------------
   brandkit.js renders the files a brand OWNS. This puts those
   together with the shared engine and produces a directory a
   static host could serve.

   It is a library so that the tests can assemble a synthetic
   brand from a fixture directory instead of only the real ones.
   A tool whose only entry point is "the production brands" can
   be tested for the happy path and nothing else.

   FOUR LAYERS, IN ORDER, LAST ONE WINS

     1. SHARED     js/ css/ admin/ assets/, byte copies. One
                   engine for every brand -- fixing a bug here
                   fixes it everywhere at once.
     2. OVERLAY    brands/<id>/static/**, laid over the shared
                   tree at the same paths. A brand's own logo,
                   stylesheet or icons. Optional.
     3. GENERATED  the brand's pages and js/brand.js.
     4. SEO        sitemap.xml and robots.txt, written by
                   tools/build-seo-files.js -- invoked, not
                   reimplemented. Two code paths producing two
                   slightly different sitemaps is the bug a
                   white-label platform cannot afford.

   Layer 1 copies js/brand.js and layer 3 overwrites it. That
   looks redundant and is not: for as long as JSK1 is served
   from the repository root, the shared copy is one brand's data
   sitting in a shared directory, and a site that kept it would
   serve another company's name. verify() proves it did not.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const kit = require('./brandkit.js');

/* The shared engine, enumerated. A glob would quietly pick up whatever
   lands in the repository next; this cannot. */
const SHARED_DIRS = ['js', 'css', 'admin', 'assets'];

/* Shared paths a brand must never receive from layer 1. */
const BRAND_OWNED = ['js/brand.js'];

/* Build input, not a page: it is what layer 4 reads. Publishing it would
   put a brand's build configuration on its own domain for no reason. */
const NOT_PUBLISHED = ['seo-config.json'];

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

/* Which brands the deployed registry knows. Read by running the real
   config the way a browser does, so this cannot disagree with it. */
function registeredBrands(sharedRoot) {
    const sandbox = { window: {} };
    try {
        vm.runInNewContext(fs.readFileSync(path.join(sharedRoot, 'js', 'cms-config.js'), 'utf8'),
                           sandbox, { timeout: 2000 });
    } catch (e) { return null; }
    return Object.keys(sandbox.window.CMS_BRANDS || {});
}

/* Everything decided before a byte is written, so a refusal leaves no
   half-assembled site behind. */
function planSite(opts) {
    const sharedRoot = opts.sharedRoot;
    const plan = kit.planBrand({ brandsDir: opts.brandsDir, templatesDir: opts.templatesDir, id: opts.id });

    const shared = [];
    for (const d of SHARED_DIRS) {
        const from = path.join(sharedRoot, d);
        if (!fs.existsSync(from)) {
            throw new kit.BrandError('Shared directory "' + d + '" is missing from ' + sharedRoot + '.');
        }
        for (const f of walk(from)) {
            const p = d + '/' + f;
            if (BRAND_OWNED.indexOf(p) > -1) continue;
            if (path.basename(f) === '.gitkeep') continue;
            shared.push(p);
        }
    }
    if (!shared.length) {
        throw new kit.BrandError('The shared engine came back empty. Refusing to assemble a site with no engine.');
    }

    /* Layer 4 needs the brand's OWN seo-config.json. It is optional for the
       generator -- brandkit emits it only if present -- but not for a
       deployable site: without it, build-seo-files.js falls back to
       tools/seo-config.json, which is one specific brand's settings, and
       the assembled site would ship a sitemap and a robots.txt describing
       somebody else's domain. Found by the assembly tests doing exactly
       that, so it refuses rather than guessing a baseUrl. */
    if (!fs.existsSync(path.join(plan.brand.dir, 'seo-config.json'))) {
        throw new kit.BrandError('Brand "' + plan.brand.id + '" has no seo-config.json at ' +
            path.join(plan.brand.dir, 'seo-config.json') +
            '. A site assembled without it would ship a sitemap.xml and robots.txt ' +
            'describing another brand\'s domain. Copy tools/seo-config.json and set seo.baseUrl ' +
            'to https://' + plan.brand.domain + '.');
    }

    const overlayDir = path.join(plan.brand.dir, 'static');
    const overlay = walk(overlayDir);
    for (const p of overlay) kit.safeJoin(overlayDir, p, 'Overlay file');   /* before it is ever joined to a dest */

    const generated = plan.files.map(f => f.path).filter(p => NOT_PUBLISHED.indexOf(p) === -1);

    /* A brand not in CMS_BRANDS still assembles -- that is how a site gets
       built and reviewed before its domain is wired up -- but it is said
       out loud, because an unregistered host falls to the DEFAULT brand and
       would read the default brand's row. */
    const registered = registeredBrands(sharedRoot);
    const warnings = [];
    if (registered && registered.indexOf(plan.brand.id) === -1) {
        warnings.push('"' + plan.brand.id + '" is not in CMS_BRANDS in js/cms-config.js. ' +
            'A visitor on that hostname would resolve to the default brand, not this one. ' +
            'Registered: ' + (registered.length ? registered.join(', ') : '(none)') + '.');
    }

    return { plan, shared, overlay, overlayDir, generated, warnings,
             seo: ['sitemap.xml', 'robots.txt'], sharedRoot };
}

function copyFile(from, to) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
}

function assemble(site, outRoot, opts) {
    opts = opts || {};
    const dest = kit.safeJoin(outRoot, site.plan.brand.output, 'Site directory');
    fs.rmSync(dest, { recursive: true, force: true });   /* a stale file is a 404, or worse */
    fs.mkdirSync(dest, { recursive: true });

    for (const p of site.shared) copyFile(path.join(site.sharedRoot, p), kit.safeJoin(dest, p, 'Shared file'));
    for (const p of site.overlay) copyFile(path.join(site.overlayDir, p), kit.safeJoin(dest, p, 'Overlay file'));
    for (const f of site.plan.files) {
        if (NOT_PUBLISHED.indexOf(f.path) > -1) continue;
        const to = kit.safeJoin(dest, f.path, 'Generated file');
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, f.contents, 'utf8');
    }

    /* Layer 4. The brand's hostname, so the siteId comes from the
       production resolver rather than from a second lookup here. */
    const seoCfg = path.join(site.plan.brand.dir, 'seo-config.json');
    const args = [path.join(site.sharedRoot, 'tools', 'build-seo-files.js'),
        '--brand', site.plan.brand.id, '--out', dest, '--config', seoCfg];
    let seoLog = '';
    try {
        seoLog = execFileSync(process.execPath, args, { cwd: site.sharedRoot, encoding: 'utf8' });
    } catch (e) {
        throw new kit.BrandError('Generating sitemap.xml and robots.txt for "' + site.plan.brand.id +
            '" failed:\n' + ((e.stdout || '') + (e.stderr || '')).trim());
    }
    return { dir: dest, seoLog: seoLog };
}

/* Every failure mode of an assembler is silent: a missed file is a 404
   nobody sees until a visitor does, and a stale shared brand.js is a site
   serving another company's name. So the result is checked before it is
   called done. */
function verify(site, dest) {
    const problems = [];
    const expected = [...new Set([...site.shared, ...site.overlay, ...site.generated, ...site.seo])].sort();
    const actual = walk(dest).sort();

    for (const p of expected) if (actual.indexOf(p) === -1) problems.push('missing: ' + p);
    for (const p of actual) if (expected.indexOf(p) === -1) problems.push('unexpected: ' + p);

    const brandJs = path.join(dest, 'js', 'brand.js');
    const want = site.plan.files.find(f => f.path === 'js/brand.js');
    if (!fs.existsSync(brandJs)) problems.push('missing: js/brand.js');
    else if (!want) problems.push('the plan did not include js/brand.js');
    else if (fs.readFileSync(brandJs, 'utf8') !== want.contents) {
        problems.push('js/brand.js is not this brand\'s copy');
    }

    for (const p of actual.filter(f => /\.(html|js|json|xml|txt|css)$/.test(f))) {
        const body = fs.readFileSync(path.join(dest, p), 'utf8');
        if (/\{\{\s*brand\./.test(body)) problems.push('unresolved token in ' + p);
        if (/<!-- \/?BRAND:/.test(body)) problems.push('leftover slot marker in ' + p);
    }

    const smap = path.join(dest, 'sitemap.xml');
    if (!fs.existsSync(smap)) problems.push('missing: sitemap.xml');
    else if (fs.readFileSync(smap, 'utf8').indexOf('https://' + site.plan.brand.domain) === -1) {
        problems.push('sitemap.xml does not point at ' + site.plan.brand.domain);
    }

    return { problems, files: actual, expected };
}

module.exports = { planSite, assemble, verify, walk, registeredBrands,
                   SHARED_DIRS, BRAND_OWNED, NOT_PUBLISHED };
