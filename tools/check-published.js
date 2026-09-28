#!/usr/bin/env node
/* ============================================================
   IS THE COMMITTED BUILD SOURCE STILL CURRENT?
   ------------------------------------------------------------
   PART 2 of the build-source synchronization guard, and the ONLY part that
   talks to Supabase.

   THE TWO QUESTIONS, KEPT APART:

     INTEGRITY  is the committed brand.js the artifact the admin exported?
                Answered offline, during every build, by
                tools/lib/pbbake.js verifyBuildSource().

     FRESHNESS  is that export still what the CMS has published?
                Answered HERE, by asking the row. Nothing offline can
                answer it: a publish that happened after the export leaves
                no trace in the repository.

   This command is NOT part of the build. tools/build-site.js never calls it
   and never touches the network -- a static site is a build artifact of its
   commit, and a build that phoned home would stop being deterministic. Run
   this before a deploy, or as its own CI step, if you want the deploy gated
   on freshness.

   IT READS. It never writes a repository file and never writes to Supabase.

   EXIT CODES
     0  in sync, or nothing published to compare
     1  the committed build source is stale or differs from the row
     2  the check could not be made (no brand, no config, no network)

   USAGE
     node tools/check-published.js <brand-id> [--brands DIR] [--row FILE]

   --row FILE reads a captured row payload ({ data, updated_at }) instead of
   fetching one. It exists so this logic can be tested deterministically and
   so a row you already have on disk can be checked; the default path is the
   real fetch, through the same reader tools/build-seo-files.js uses.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const kit = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));
const cmsrow = require(path.join(ROOT, 'tools', 'lib', 'cmsrow.js'));

const argv = process.argv.slice(2);
const flag = n => argv.indexOf(n) > -1;
function opt(n, dflt) { const i = argv.indexOf(n); return i > -1 && argv[i + 1] ? argv[i + 1] : dflt; }

const BRANDS = path.resolve(ROOT, opt('--brands', 'brands'));
const ROW_FILE = opt('--row', '');

function log(m) { process.stdout.write(m + '\n'); }
function fail(m) { process.stdout.write('::error::' + m + '\n'); }

/* The published builder blocks in an arbitrary record, by the same test the
   bake and the admin apply. A record is a record whether it came from a file
   or from the wire. */
function publishedFrom(data) {
    const out = {};
    if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return out;
    Object.keys(data.pages).forEach(slug => {
        const b = (data.pages[slug] || {}).builder;
        if (!b || b.status !== 'published' || !Array.isArray(b.sections)) return;
        out[slug] = { sections: b.sections, schemaVersion: b.schemaVersion };
    });
    return out;
}

async function main() {
    const taken = new Set();
    ['--brands', '--row'].forEach(f => {
        const i = argv.indexOf(f);
        if (i > -1 && argv[i + 1]) taken.add(argv[i + 1]);
    });
    const id = argv.filter(a => a.charAt(0) !== '-' && !taken.has(a))[0];

    if (!id || flag('--help')) {
        log('Usage: node tools/check-published.js <brand-id> [--brands DIR] [--row FILE]');
        log('');
        log('Asks whether the committed Page Builder build source still matches the');
        log('published CMS row. This is the FRESHNESS check; the build\'s own guard');
        log('checks INTEGRITY and never uses the network.');
        return id ? 0 : 2;
    }

    /* The brand comes from the existing brand system, so this command and the
       build cannot disagree about which brand an id means. */
    let brand;
    try {
        brand = kit.loadBrand(BRANDS, id);
    } catch (e) {
        fail(e.message);
        return 2;
    }

    const brandJsFile = path.join(brand.dir, 'brand.js');
    if (!fs.existsSync(brandJsFile)) {
        fail('Brand "' + id + '" has no brand.js, so there is no build source to check.');
        return 2;
    }
    const brandJs = fs.readFileSync(brandJsFile, 'utf8');
    const committed = pbbake.publishedSections(brandJs);
    const prov = pbbake.readProvenance(brandJs);

    log('Brand    : ' + brand.id + '  (name=' + brand.name + ')');
    log('Row      : ' + brand.siteId);
    log('Source   : brands/' + brand.id + '/brand.js');
    log('Provenance: ' + (prov
        ? 'recorded' +
          (prov.exportedAt ? '   exported ' + prov.exportedAt : '') +
          (prov.publishedRowUpdatedAt ? '   row ' + prov.publishedRowUpdatedAt : '   row (not recorded)')
        : 'NOT RECORDED — this export predates provenance, so only the sections ' +
          'themselves can be compared'));

    /* ---- the authoritative row ---- */
    let row;
    if (ROW_FILE) {
        try {
            row = JSON.parse(fs.readFileSync(path.resolve(ROOT, ROW_FILE), 'utf8'));
        } catch (e) {
            fail('--row ' + ROW_FILE + ' could not be read: ' + e.message);
            return 2;
        }
        /* A captured payload may be the row object or the REST array. */
        if (Array.isArray(row)) row = row[0] || null;
        row = row ? { data: row.data, updatedAt: row.updated_at || row.updatedAt, why: '' }
                  : { data: null, why: 'the captured row is empty' };
        log('Server   : ' + rel(ROW_FILE) + '   (captured row, no network)');
    } else {
        /* The brand's serving HOST is what cms-config.js resolves, exactly as a
           visitor's browser hands it over -- the same call build-seo-files.js
           makes, through the same reader. */
        const cfg = cmsrow.readConfig({ root: ROOT, brand: brand.domain, warn: m => log('::warning::' + m) });
        if (!cfg.enabled || !cfg.siteId) {
            fail('Remote storage is not configured for "' + brand.domain + '" in js/cms-config.js, ' +
                 'so freshness cannot be checked.');
            return 2;
        }
        if (cfg.siteId !== brand.siteId) {
            fail('js/cms-config.js resolves "' + brand.domain + '" to row "' + cfg.siteId +
                 '", but the brand declares row "' + brand.siteId + '". Refusing to compare ' +
                 'against another brand\'s row.');
            return 2;
        }
        log('Server   : ' + cfg.url + '  row ' + cfg.siteId);
        row = await cmsrow.fetchRow(cfg);
    }

    if (!row || !row.data) {
        const why = (row && row.why) || 'no row';
        if (Object.keys(committed).length === 0) {
            log('');
            log('Nothing published on the server (' + why + ') and nothing published in the ' +
                'build source. In sync.');
            return 0;
        }
        fail('Could not read the published row (' + why + '), but the build source publishes ' +
             Object.keys(committed).length + ' page(s) of Page Builder content. Freshness unknown.');
        return 2;
    }

    const server = publishedFrom(row.data);
    const slugs = [...new Set(Object.keys(committed).concat(Object.keys(server)))].sort();

    if (!slugs.length) {
        log('');
        log('Neither the row nor the build source publishes any Page Builder content. In sync.');
        log('Nothing to bake, nothing to go stale.');
        return 0;
    }

    /* ---- compare, page by page ---- */
    const drift = [];
    log('');
    log('Page                 committed            server               ');
    log('-------------------- -------------------- ---------------------');
    slugs.forEach(slug => {
        const c = committed[slug] ? pbbake.fingerprint(ROOT, committed[slug]) : '(not published)';
        const s = server[slug] ? pbbake.fingerprint(ROOT, server[slug]) : '(not published)';
        const same = c === s;
        log(pad(slug, 20) + ' ' + pad(c, 20) + ' ' + pad(s, 20) + ' ' + (same ? 'in sync' : 'DIFFERS'));
        if (!same) drift.push({ slug: slug, committed: c, server: s });
    });

    log('');
    if (prov && prov.publishedRowUpdatedAt && row.updatedAt) {
        const same = Date.parse(prov.publishedRowUpdatedAt) === Date.parse(row.updatedAt);
        log('Row updated_at: recorded ' + prov.publishedRowUpdatedAt + ', server ' + row.updatedAt +
            (same ? '   (same publish)' : '   (the row has been written since this export)'));
    } else if (row.updatedAt) {
        log('Row updated_at: ' + row.updatedAt + '   (the export recorded none to compare)');
    }

    if (!drift.length) {
        log('');
        log('IN SYNC. The committed build source publishes the same Page Builder content the ' +
            'row does, so the next deploy will bake what is live.');
        return 0;
    }

    log('');
    fail('STALE BUILD SOURCE for brand "' + brand.id + '" (row ' + brand.siteId + '): ' +
         drift.length + ' page(s) differ from the published row.');
    drift.forEach(d => {
        fail('  page "' + d.slug + '": committed ' + d.committed + ', server ' + d.server +
             (d.committed === '(not published)'
                ? '  -- published in the CMS but not in the build source'
                : d.server === '(not published)'
                    ? '  -- in the build source but no longer published in the CMS'
                    : '  -- the published sections have changed'));
    });
    fail('A deploy from this commit would serve Page Builder HTML that does not match what is ' +
         'published. Re-export the brand from /admin > Backup & Restore > Download brand ' +
         'defaults, commit brands/' + brand.id + '/brand.js, and deploy again.');
    return 1;
}

function pad(s, n) { s = String(s); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function rel(p) { return path.relative(ROOT, path.resolve(ROOT, p)).split(path.sep).join('/'); }

main().then(code => process.exit(code), e => {
    fail(e && e.message ? e.message : String(e));
    process.exit(2);
});
