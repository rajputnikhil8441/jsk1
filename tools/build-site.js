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

const fs = require('fs');
const path = require('path');
const kit = require('./lib/brandkit.js');
const site = require('./lib/sitekit.js');
const pbbake = require('./lib/pbbake.js');
const cmsrow = require('./lib/cmsrow.js');

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

/* ============================================================
   THE PUBLISHED CMS RECORD, FOR THE BRAND BEING BUILT
   ------------------------------------------------------------
   --from-cms makes the build read the brand's PUBLISHED row and bake what
   it finds, so a content change reaches the HTML without anyone editing
   brands/<id>/brand.js. --row FILE reads a captured payload instead,
   which is how this path is tested and how a deploy can be replayed from
   a known record.

   WHICH ROW. The brand's own, and only ever its own: the serving hostname
   goes through js/cms-config.js -- the same block that resolves it for a
   visitor -- and the siteId that comes back is checked against the one the
   brand declares. Two answers to "which brand is this?" is how one brand's
   content ends up on another's site, so there is one answer and a refusal
   if it disagrees.

   IT FAILS RATHER THAN EMPTYING PAGES. Every way this can go wrong -- not
   configured, unreachable, no row, a row for the wrong brand, a row that
   publishes nothing where the committed layer publishes something -- stops
   the build and says which brand and why. A deploy that quietly replaced
   live content with empty mounts would be worse than no deploy.
   ============================================================ */
async function publishedForBrand(brand, rowFile, allowUnpublish) {
    const warn = m => console.log('::warning::' + m);
    const committed = brand.builder || {};
    let row;

    if (rowFile) {
        let raw;
        try {
            raw = JSON.parse(fs.readFileSync(path.resolve(ROOT, rowFile), 'utf8'));
        } catch (e) {
            throw new kit.BrandError('Brand "' + brand.id + '": --row ' + rowFile +
                ' could not be read: ' + e.message);
        }
        if (Array.isArray(raw)) raw = raw[0] || null;
        row = raw ? { data: raw.data, updatedAt: raw.updated_at || raw.updatedAt } : { data: null };
    } else {
        const cfg = cmsrow.readConfig({ root: ROOT, brand: brand.domain, warn: warn });
        if (!cfg.enabled || !cfg.siteId) {
            throw new kit.BrandError('Brand "' + brand.id + '": --from-cms was asked for, but ' +
                'js/cms-config.js does not configure remote storage for "' + brand.domain +
                '". Refusing to build: the published content cannot be read, and baking the ' +
                'committed layer instead would silently ship different content than the CMS has.');
        }
        if (cfg.siteId !== brand.siteId) {
            throw new kit.BrandError('Brand "' + brand.id + '": js/cms-config.js resolves "' +
                brand.domain + '" to row "' + cfg.siteId + '", but the brand declares row "' +
                brand.siteId + '". Refusing to bake another brand\'s content into this site.');
        }
        row = await cmsrow.fetchRow(cfg);
    }

    if (!row || !row.data) {
        throw new kit.BrandError('Brand "' + brand.id + '": the published CMS record could not ' +
            'be read (' + ((row && row.why) || 'no row') + '). Refusing to build rather than ' +
            'deploy HTML without the content the CMS has published.');
    }

    const published = pbbake.publishedFromRecord(row.data);

    /* The one case that looks like success and is not: the row publishes
       nothing for a page the committed layer publishes, so this build would
       replace live content with an empty mount. Unpublishing IS legitimate,
       so it is allowed explicitly rather than guessed at. */
    const emptied = Object.keys(committed).filter(slug =>
        !Object.prototype.hasOwnProperty.call(published, slug));
    if (emptied.length && !allowUnpublish) {
        throw new kit.BrandError('Brand "' + brand.id + '": the published CMS record has no Page ' +
            'Builder content for ' + emptied.map(x => '"' + x + '"').join(', ') +
            ', but the committed layer does. This build would replace that content with an empty ' +
            'mount.\n\n  If the page really was unpublished, say so: --allow-unpublish.\n' +
            '  If not, the row being read is not the one you think it is -- check the siteId for ' +
            brand.domain + ' in js/cms-config.js.');
    }

    return { published: published, updatedAt: row.updatedAt || '',
             source: rowFile ? rel(path.resolve(ROOT, rowFile)) : 'the published CMS row',
             emptied: emptied };
}

async function main() {
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
    ['--env', '--out', '--brands', '--row'].forEach(f => {
        const i = argv.indexOf(f);
        if (i > -1 && argv[i + 1]) taken.add(argv[i + 1]);
    });
    const positional = argv.filter(a => a.charAt(0) !== '-' && !taken.has(a));
    const id = positional[0];
    if (!id) { console.error('No brand id given.'); return 2; }

    /* --from-cms / --row: read this brand's published record first, and hand
       the blocks to the plan. Its own row, checked, or the build refuses --
       see publishedForBrand(). Without either flag nothing changes: the
       committed layer is the source, offline and deterministic. */
    const ROW_FILE = opt('--row', '');
    let live = null;
    if (flag('--from-cms') || ROW_FILE) {
        live = await publishedForBrand(kit.loadBrand(BRANDS, id, env), ROW_FILE,
                                      flag('--allow-unpublish'));
    }

    const s = site.planSite({ brandsDir: BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT,
                              id: id, env: env, published: live ? live.published : null });
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
    /* Where the content in this HTML came from. First line anyone should
       read when a page looks wrong. */
    console.log('Content  : ' + (s.plan.brand.contentSource === 'cms'
        ? 'the PUBLISHED CMS record via ' + live.source +
          (live.updatedAt ? '   row updated ' + live.updatedAt : '') +
          (live.emptied.length ? '   unpublished: ' + live.emptied.join(', ') : '')
        : 'brands/' + s.plan.brand.id + '/brand.js   (the committed layer; pass --from-cms to bake ' +
          'what the CMS has published)'));
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
        (s.plan.brand.contentSource === 'cms'
            ? '   [the FALLBACK layer only -- the baked content came from the row]'
            : '   [integrity only -- freshness: node tools/check-published.js ' + s.plan.brand.id + ']'));
    if (bs.warning) console.log('::warning::Brand "' + s.plan.brand.id + '": ' + bs.warning);
    const cmsMode = s.plan.brand.contentSource === 'cms';
    const whence = cmsMode ? 'the published CMS record'
                           : 'brands/' + s.plan.brand.id + '/brand.js';
    console.log('Builder  : ' + (baked.length
        ? baked.map(x => x.slug + ' (' + x.sections +
            (x.sections === 1 ? ' section' : ' sections') + ')').join(', ') +
          '   baked into the HTML from ' + whence
        : '(no published content in ' + whence + ')'));
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

/* main() is async now: --from-cms reads the row before it plans. A
   BrandError is a refusal with a message the operator can act on, so it
   exits 1 quietly; anything else is a bug and keeps its stack. */
main().then(code => process.exit(code), e => {
    if (e instanceof kit.BrandError) { console.error('\n' + e.name + ': ' + e.message + '\n'); process.exit(1); }
    throw e;
});
