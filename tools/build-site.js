#!/usr/bin/env node
'use strict';
/* ============================================================
   ASSEMBLE A BRAND'S DEPLOYABLE SITE
   ------------------------------------------------------------
     node tools/build-site.js --list
     node tools/build-site.js <brand-id> [--check] [--out DIR]

   tools/build-brand.js emits only the files a brand OWNS. This
   assembles those together with the shared engine into a
   directory a static host could serve. The four layers and why
   they are ordered as they are: tools/lib/sitekit.js.

   --check plans and prints, writing nothing.

   IT DOES NOT DEPLOY. It writes a directory. Which directory a
   host serves, and for which domain, is not decided here.
   ============================================================ */

const path = require('path');
const kit = require('./lib/brandkit.js');
const site = require('./lib/sitekit.js');

const ROOT = path.resolve(__dirname, '..');
const BRANDS = path.join(ROOT, 'brands');
const TEMPLATES = path.join(ROOT, 'templates');

const argv = process.argv.slice(2);
const flag = n => argv.indexOf(n) > -1;
function opt(n, dflt) { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : dflt; }
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function main() {
    if (flag('--list') || !argv.length) {
        const brands = kit.listBrands(BRANDS);
        const registered = site.registeredBrands(ROOT) || [];
        console.log('Brands in brands/:');
        if (!brands.length) console.log('  (none)');
        brands.forEach(b => {
            let d;
            try {
                const x = kit.loadBrand(BRANDS, b);
                d = '  name=' + x.name + '  domain=' + x.domain + '  siteId=' + x.siteId +
                    (registered.indexOf(b) > -1 ? '' : '   [not in CMS_BRANDS]');
            } catch (e) { d = '  !! ' + e.message; }
            console.log('  ' + b + d);
        });
        if (!argv.length) console.log('\nUsage: node tools/build-site.js <brand-id> [--check] [--out DIR]');
        return 0;
    }

    const id = argv.find(a => a.charAt(0) !== '-');
    if (!id) { console.error('No brand id given.'); return 2; }

    const s = site.planSite({ brandsDir: BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT, id: id });
    console.log('Brand    : ' + s.plan.brand.id + '  (name=' + s.plan.brand.name +
                ', domain=' + s.plan.brand.domain + ', siteId=' + s.plan.brand.siteId + ')');
    console.log('Shared   : ' + s.shared.length + ' file(s) from ' + site.SHARED_DIRS.join('/, ') + '/');
    console.log('Overlay  : ' + (s.overlay.length
        ? s.overlay.length + ' file(s) from ' + rel(s.overlayDir) + '/' : '(none)'));
    console.log('Generated: ' + s.generated.length + ' file(s)');
    console.log('Slots    : ' + (s.plan.slotsDeclared.length ? s.plan.slotsDeclared.join(', ') : '(none)') +
                '   filled: ' + (Object.keys(s.plan.brand.slots).length
                    ? Object.keys(s.plan.brand.slots).sort().join(', ') : '(none)'));
    console.log('Override : ' + (Object.keys(s.plan.brand.overrides).length
        ? Object.keys(s.plan.brand.overrides).sort().join(', ') : '(none)'));
    console.log('SEO      : ' + s.seo.join(', ') + '  (via tools/build-seo-files.js)');
    s.warnings.forEach(w => console.log('::warning::' + w));

    if (flag('--check')) {
        console.log('\nTotal would be ' + (s.shared.length + s.overlay.length +
            s.generated.length + s.seo.length) + ' file(s).');
        console.log('--check: nothing written.');
        return 0;
    }

    const res = site.assemble(s, path.resolve(ROOT, opt('--out', 'sites')));
    res.seoLog.split('\n').filter(l => /^(Source|Base|Sitemap|::warning)/.test(l))
        .forEach(l => console.log('           ' + l));

    const v = site.verify(s, res.dir);
    console.log('\nAssembled ' + v.files.length + ' file(s) in ' + rel(res.dir) + '/');
    if (v.problems.length) {
        console.error('\nThe assembled site did not pass its own checks:');
        v.problems.forEach(p => console.error('  ' + p));
        return 1;
    }
    console.log('Checks   : passed (file set, brand-owned files, tokens, markers, sitemap domain)');
    return 0;
}

try {
    process.exit(main());
} catch (e) {
    if (e instanceof kit.BrandError) { console.error('\n' + e.name + ': ' + e.message + '\n'); process.exit(1); }
    throw e;
}
