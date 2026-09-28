#!/usr/bin/env node
/* ============================================================
   GENERATE sitemap.xml AND robots.txt AT DEPLOY TIME
   ------------------------------------------------------------
   WHY THIS EXISTS

   This site is static and served by GitHub Pages. Browser
   JavaScript in /admin cannot write a file into it -- not with
   a clever trick, not with a token. Anything that claimed to
   would need repository write credentials in public frontend
   code, and this project will not ship those.

   So the admin publishes SETTINGS to the brand row, and the
   deploy turns those settings into the two files, here, on the
   runner, before the artifact is uploaded. The credential used
   to read the row is the same public anon key that every
   visitor's browser already carries, and it is read-only by row
   level security. Nothing secret is added to the workflow and
   no new permission is requested: the job still only needs
   `contents: read`.

   WHAT REMAINS DEVELOPER-CONTROLLED
   A deploy has to happen. Saving in /admin does not start one.
   Someone with repository access runs the workflow (Actions >
   "Deploy static content to Pages" > Run workflow) or pushes a
   commit. That is the honest limit of this architecture and the
   admin says so on screen rather than implying a publish button
   that does not exist.

   USAGE
     node tools/build-seo-files.js            write the files
     node tools/build-seo-files.js --check    print, write nothing

   THE THREE OPTIONS BELOW EXIST FOR THE ASSEMBLER

   tools/build-site.js assembles a brand's deployable directory
   and needs this same generator pointed somewhere else. Rather
   than reimplement sitemap and robots generation there -- two
   code paths producing two slightly different sitemaps is
   exactly the bug a white-label platform cannot afford -- it
   invokes this script with:

     --brand <hostname>   resolve the siteId for THAT brand
     --config <path>      the committed fallback to read
     --out <dir>          where to write the two files

   With none of them given every default is what it has always
   been, so the deploy step's behaviour is unchanged.
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEOFiles = require(path.join(ROOT, 'js', 'seo-files.js'));

const CHECK = process.argv.indexOf('--check') > -1;

function opt(name, dflt) {
    const i = process.argv.indexOf(name);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

/* A brand id is a hostname and becomes part of a path, so it is checked
   before it is used as either -- the generator's rule, kept the same. */
const BRAND = opt('--brand', '');
const FALLBACK_FILE = path.resolve(ROOT, opt('--config', path.join('tools', 'seo-config.json')));
const OUT_DIR = path.resolve(ROOT, opt('--out', '.'));

function log(msg) { process.stdout.write(msg + '\n'); }
function rel(p) { return path.relative(ROOT, p).split(path.sep).join('/'); }
function warn(msg) { process.stdout.write('::warning::' + msg + '\n'); }

/* ---------- the deployment's own configuration ----------
   js/cms-config.js is plain assignments to `window`, so it is read the
   same way the browser reads it rather than by pattern-matching text. */
/* ---------- the deployment's own configuration, and the row ----------
   Both moved to tools/lib/cmsrow.js unchanged, because
   tools/check-published.js needs the same reader and a second Supabase
   client with its own idea of how the key travels is exactly the kind of
   duplication that drifts. This file's behaviour is identical. */
const cmsrow = require(path.join(__dirname, 'lib', 'cmsrow.js'));
const readConfig = () => cmsrow.readConfig({ root: ROOT, brand: BRAND, warn: warn });
const fetchRow = cfg => cmsrow.fetchRow(cfg);

/* The committed fallback. It exists so a deploy never ships a sitemap that
   is missing or wrong just because the database was briefly unreachable --
   and so a fork with remote storage switched off still gets correct files. */
function readFallback() {
    const p = FALLBACK_FILE;
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { warn(rel(p) + ' could not be read: ' + e.message); return null; }
}

/* Only the parts these two files are built from. Taking a subset rather
   than the whole record keeps a page's body, a draft, or anything else
   that happens to be in the row out of the reasoning entirely. */
function seoSubset(data) {
    if (!data || typeof data !== 'object') return null;
    const out = { seo: {}, pages: {} };
    const seo = data.seo || {};
    out.seo.baseUrl = typeof seo.baseUrl === 'string' ? seo.baseUrl : '';
    out.seo.robotsExtra = typeof seo.robotsExtra === 'string' ? seo.robotsExtra : '';
    const pages = data.pages || {};
    Object.keys(pages).forEach(k => {
        const p = pages[k];
        if (!p || typeof p !== 'object') return;
        out.pages[k] = {
            url: typeof p.url === 'string' ? p.url : '',
            updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
            inSitemap: p.inSitemap !== false,
            robots: { index: !(p.robots && p.robots.index === false) }
        };
    });
    return out;
}

/* No timestamp of its own: the only date here is the one that says
   something -- when the CMS record these files describe was last changed.
   A "generated at" line would make every deploy produce a different file
   and turn a real change into noise nobody reads. */
function provenance(source, when) {
    return '# source: ' + source + (when ? ' (row updated ' + when + ')' : '') + '\n';
}

function withProvenanceXml(xml, source, when) {
    return xml.replace('-->\n', '  source: ' + source + (when ? ' (row updated ' + when + ')' : '') + '\n-->\n');
}

(async function main() {
    if (BRAND && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/.test(BRAND)) {
        log('--brand "' + BRAND + '" is not a valid hostname. Refusing.');
        process.exit(2);
    }
    const cfg = readConfig();
    const row = await fetchRow(cfg);

    let data = seoSubset(row.data);
    let source = 'the live CMS record';
    let when = row.updatedAt ? String(row.updatedAt).slice(0, 10) : '';

    if (!data || !SEOFiles.baseUrl(data)) {
        if (row.why) warn('Could not use the live CMS record (' + row.why + '). Falling back to ' + rel(FALLBACK_FILE) + '.');
        data = seoSubset(readFallback());
        source = rel(FALLBACK_FILE) + ' (committed fallback)';
        when = '';
    }

    if (!data) { log('No usable SEO settings. Nothing written.'); process.exit(1); }

    const base = SEOFiles.baseUrl(data);
    if (!base) {
        log('No valid seo.baseUrl in the settings. Refusing to write a sitemap that points nowhere.');
        process.exit(1);
    }

    const xml = withProvenanceXml(SEOFiles.sitemap(data), source, when);
    const txt = SEOFiles.robots(data).replace('# To change it, edit /admin > SEO > Robots.txt and deploy.\n',
                                              '# To change it, edit /admin > SEO > Robots.txt and deploy.\n' +
                                              provenance(source, when));

    const urls = SEOFiles.sitemapPages(data).map(p => base + '/' + p.file);
    /* Which brand's row was consulted, and under which id. Printed because
       it is the one thing a deploy operator cannot otherwise see and the one
       thing that would be catastrophic to get wrong: two brands sharing a
       siteId means two sites publishing over each other. */
    log('Brand:   ' + (BRAND || '(default, no --brand given)') + '   siteId: ' + (cfg.siteId || '(none)'));
    log('Source:  ' + source);
    log('Base:    ' + base);
    log('Sitemap: ' + urls.length + ' URL(s)');
    urls.forEach(u => log('         ' + u));

    if (CHECK) { log('\n--check: nothing written.'); return; }

    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR, 'sitemap.xml'), xml, 'utf8');
    fs.writeFileSync(path.join(OUT_DIR, 'robots.txt'), txt, 'utf8');
    log('\nWrote sitemap.xml and robots.txt' +
        (OUT_DIR === path.resolve(ROOT) ? '.' : ' to ' + rel(OUT_DIR) + '/.'));
})();
