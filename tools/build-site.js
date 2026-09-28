#!/usr/bin/env node
'use strict';
/* ============================================================
   ASSEMBLE A BRAND'S DEPLOYABLE SITE
   ------------------------------------------------------------
     node tools/build-site.js --list
     node tools/build-site.js <brand-id> [--env NAME] [--check] [--out DIR]

   --env builds the brand for one of the environments its
   brand.json declares: a different hostname for the same brand,
   optionally noindex. With no --env it builds the brand on its
   own canonical domain, which is what production means.

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
const TEMPLATES = path.join(ROOT, 'templates');

const argv = process.argv.slice(2);
const flag = n => argv.indexOf(n) > -1;
function opt(n, dflt) { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : dflt; }

/* brands/ by default. --brands DIR points the same pipeline at another set of
   brand directories, which is how the build can be exercised for brands that
   do not exist in this repository -- the multi-brand behaviour is a property
   of the pipeline, so it has to be testable without inventing production
   brands to test it with. */
const BRANDS = path.resolve(ROOT, opt('--brands', 'brands'));
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function main() {
    if (flag('--list') || !argv.length) {
        const brands = kit.listBrands(BRANDS);
        const registered = site.registeredBrands(ROOT) || [];
        console.log('Brands in brands/:');
        if (!brands.length) console.log('  (none)');
        brands.forEach(b => {
            try {
                const x = kit.loadBrand(BRANDS, b);
                console.log('  ' + b + '  name=' + x.name + '  domain=' + x.domain +
                    '  siteId=' + x.siteId +
                    (registered.indexOf(x.domain) > -1 ? '' : '   [not in CMS_BRANDS]'));
                for (const e of x.environments) {
                    const y = kit.loadBrand(BRANDS, b, e);
                    console.log('      --env ' + e + '   host=' + y.domain + '  siteId=' + y.siteId +
                        (y.noindex ? '  noindex' : '') +
                        (registered.indexOf(y.domain) > -1 ? '' : '   [not in CMS_BRANDS]'));
                }
            } catch (e) { console.log('  ' + b + '  !! ' + e.message); }
        });
        if (!argv.length) console.log('\nUsage: node tools/build-site.js <brand-id> [--check] [--out DIR] [--brands DIR]');
        return 0;
    }

    const env = opt('--env', '');
    /* A flag's VALUE is positional-looking, so anything consumed by a flag is
       excluded before the brand id is chosen. Without this, --brands DIR made
       DIR the brand id. */
    const taken = new Set();
    ['--env', '--out', '--brands'].forEach(f => {
        const i = argv.indexOf(f);
        if (i > -1 && argv[i + 1]) taken.add(argv[i + 1]);
    });
    const positional = argv.filter(a => a.charAt(0) !== '-' && !taken.has(a));
    const id = positional[0];
    if (!id) { console.error('No brand id given.'); return 2; }

    const s = site.planSite({ brandsDir: BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT,
                              id: id, env: env });
    console.log('Brand    : ' + s.plan.brand.id + '  (name=' + s.plan.brand.name + ')');
    console.log('Env      : ' + s.plan.brand.env +
                (s.plan.brand.noindex ? '   NOINDEX -- review host, never indexed' : ''));
    console.log('Serving  : ' + s.plan.brand.domain +
                (s.plan.brand.domain === s.plan.brand.canonicalDomain
                    ? '   (the brand\'s canonical domain)'
                    : '   (canonical domain ' + s.plan.brand.canonicalDomain + ' is NOT built here)'));
    console.log('Row      : ' + s.plan.brand.siteId + '   bucket: ' + (s.plan.brand.bucket || '(none)'));
    console.log('Shared   : ' + s.shared.length + ' file(s) from ' + site.SHARED_DIRS.join('/, ') + '/');
    console.log('Overlay  : ' + (s.overlay.length
        ? s.overlay.length + ' file(s) from ' + s.overlayDirs.map(rel).join('/, ') + '/'
        : '(none)'));
    console.log('Generated: ' + s.generated.length + ' file(s)');
    console.log('Slots    : ' + (s.plan.slotsDeclared.length ? s.plan.slotsDeclared.join(', ') : '(none)') +
                '   filled: ' + (Object.keys(s.plan.brand.slots).length
                    ? Object.keys(s.plan.brand.slots).sort().join(', ') : '(none)'));
    console.log('Override : ' + (Object.keys(s.plan.brand.overrides).length
        ? Object.keys(s.plan.brand.overrides).sort().join(', ') : '(none)'));
    /* What the published Page Builder content put into the HTML. Printed even
       when it is nothing, because "no builder content was baked" is the fact a
       reader needs when a page looks emptier than expected -- and because a
       drift between the committed brand layer and the live row shows up here
       rather than silently. */
    const baked = s.plan.baked || [];
    /* Whether the committed build source could be verified. Printed next to
       what was baked, because the two answer one question together: what went
       into the HTML, and whether it is the artifact that was exported. */
    const bs = s.plan.brand.buildSource || {};
    const prov = bs.provenance || {};
    console.log('Source   : ' + (bs.status === 'ok'
        ? 'verified against the recorded export' +
          (prov.exportedAt ? '   exported ' + prov.exportedAt : '') +
          (prov.publishedRowUpdatedAt ? '   row ' + prov.publishedRowUpdatedAt : '')
        : bs.status === 'not-recorded'
            /* A brand that publishes no Page Builder content has nothing whose
               integrity could be in question, so saying "not verified" there
               would be noise that trains people to ignore the line. */
            ? (baked.length ? 'provenance not recorded (integrity not verified)'
                            : 'no published builder content to verify')
            : String(bs.status)) +
        '   [integrity only -- freshness: node tools/check-published.js ' + s.plan.brand.id + ']');
    console.log('Builder  : ' + (baked.length
        ? baked.map(x => x.slug + ' (' + x.sections +
            (x.sections === 1 ? ' section' : ' sections') + ')').join(', ') +
          '   baked into the HTML from brands/' + s.plan.brand.id + '/brand.js'
        : '(no published content in brands/' + s.plan.brand.id + '/brand.js)'));
    console.log('SEO      : ' + s.seo.join(', ') +
                (s.plan.brand.noindex
                    ? '   (staging: blocks everything, no sitemap)'
                    : '   (via tools/build-seo-files.js)'));
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
    console.log('Checks   : passed (' + (s.plan.brand.noindex
        ? 'file set, brand-owned files, tokens, markers, noindex on every page, '
          + 'no sitemap, robots blocks all, reserved domain absent'
        : 'file set, brand-owned files, tokens, markers, sitemap domain') + ')');
    return 0;
}

try {
    process.exit(main());
} catch (e) {
    if (e instanceof kit.BrandError) { console.error('\n' + e.name + ': ' + e.message + '\n'); process.exit(1); }
    throw e;
}
