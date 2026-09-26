#!/usr/bin/env node
'use strict';
/* ============================================================
   GENERATE A BRAND'S SITE FILES
   ------------------------------------------------------------
     node tools/build-brand.js --list
     node tools/build-brand.js <brand-id> [--check] [--out DIR]

   --check plans and prints, writing nothing. Use it in review:
   every validation runs, so a broken brand fails here rather
   than after it has half-written a site.

   WHAT IT EMITS

   Only the files a brand OWNS: its pages, its js/brand.js, and
   its seo-config.json. The shared engine (js/, css/, assets/,
   admin/) is identical for every brand by design -- that is the
   entire point of the preceding phases -- so copying it per
   brand would be duplication for its own sake. Assembling a
   deployable directory from brand output plus shared files is
   the deploy step's job, not this tool's.
   ============================================================ */

const path = require('path');
const kit = require('./lib/brandkit.js');

const ROOT = path.resolve(__dirname, '..');
const BRANDS = path.join(ROOT, 'brands');
const TEMPLATES = path.join(ROOT, 'templates');

const argv = process.argv.slice(2);
const flag = n => argv.indexOf(n) > -1;
function opt(n, dflt) { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : dflt; }

function main() {
    if (flag('--list') || !argv.length) {
        const brands = kit.listBrands(BRANDS);
        console.log('Brands in brands/:');
        if (!brands.length) console.log('  (none)');
        brands.forEach(b => {
            let d = '';
            try { const x = kit.loadBrand(BRANDS, b); d = '  name=' + x.name + '  domain=' + x.domain + '  siteId=' + x.siteId; }
            catch (e) { d = '  !! ' + e.message; }
            console.log('  ' + b + d);
        });
        if (!argv.length) console.log('\nUsage: node tools/build-brand.js <brand-id> [--check] [--out DIR]');
        return 0;
    }

    const id = argv.find(a => a.charAt(0) !== '-');
    if (!id) { console.error('No brand id given.'); return 2; }

    const plan = kit.planBrand({ brandsDir: BRANDS, templatesDir: TEMPLATES, id: id });
    console.log('Brand   : ' + plan.brand.id + '  (name=' + plan.brand.name +
                ', domain=' + plan.brand.domain + ', siteId=' + plan.brand.siteId + ')');
    console.log('Slots   : ' + (plan.slotsDeclared.length ? plan.slotsDeclared.join(', ') : '(none declared by these pages)'));
    console.log('Filled  : ' + (Object.keys(plan.brand.slots).length ? Object.keys(plan.brand.slots).sort().join(', ') : '(none)'));
    console.log('Override: ' + (Object.keys(plan.brand.overrides).length ? Object.keys(plan.brand.overrides).sort().join(', ') : '(none)'));
    console.log('Files   : ' + plan.files.length);
    plan.files.forEach(f => console.log('          ' + f.path + '  (' + f.contents.length + ' bytes)'));

    if (flag('--check')) { console.log('\n--check: nothing written.'); return 0; }

    const outRoot = path.resolve(ROOT, opt('--out', 'sites'));
    const res = kit.writePlan(plan, outRoot);
    console.log('\nWrote ' + res.written.length + ' file(s) to ' + path.relative(ROOT, res.dir) + '/');
    return 0;
}

try {
    process.exit(main());
} catch (e) {
    if (e instanceof kit.BrandError) { console.error('\n' + e.name + ': ' + e.message + '\n'); process.exit(1); }
    throw e;
}
