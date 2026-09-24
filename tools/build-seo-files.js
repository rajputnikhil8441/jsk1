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
   ============================================================ */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SEOFiles = require(path.join(ROOT, 'js', 'seo-files.js'));

const CHECK = process.argv.indexOf('--check') > -1;

function log(msg) { process.stdout.write(msg + '\n'); }
function warn(msg) { process.stdout.write('::warning::' + msg + '\n'); }

/* ---------- the deployment's own configuration ----------
   js/cms-config.js is plain assignments to `window`, so it is read the
   same way the browser reads it rather than by pattern-matching text. */
function readConfig() {
    const sandbox = { window: {} };
    try {
        vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8'), sandbox,
                           { timeout: 2000 });
    } catch (e) {
        warn('js/cms-config.js could not be read: ' + e.message);
        return {};
    }
    return sandbox.window.CMS_REMOTE || {};
}

function fetchRow(cfg) {
    return new Promise(resolve => {
        if (!cfg.enabled || !cfg.url || !cfg.anonKey || !cfg.table || !cfg.siteId) {
            return resolve({ data: null, why: 'remote storage is not configured' });
        }
        let u;
        try {
            u = new URL(cfg.url.replace(/\/+$/, '') + '/rest/v1/' + cfg.table +
                        '?id=eq.' + encodeURIComponent(cfg.siteId) + '&select=data,updated_at');
        } catch (e) { return resolve({ data: null, why: 'the configured URL is not valid' }); }
        if (u.protocol !== 'https:') return resolve({ data: null, why: 'the configured URL is not https' });

        const req = https.request(u, {
            method: 'GET',
            headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey, Accept: 'application/json' }
        }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', c => { body += c; if (body.length > 8e6) req.destroy(); });
            res.on('end', () => {
                if (res.statusCode !== 200) return resolve({ data: null, why: 'HTTP ' + res.statusCode });
                let rows;
                try { rows = JSON.parse(body); } catch (e) { return resolve({ data: null, why: 'the response was not JSON' }); }
                if (!Array.isArray(rows) || !rows.length || !rows[0] || !rows[0].data) {
                    return resolve({ data: null, why: 'no row for siteId "' + cfg.siteId + '"' });
                }
                resolve({ data: rows[0].data, updatedAt: rows[0].updated_at, why: '' });
            });
        });
        req.setTimeout(15000, () => { req.destroy(); resolve({ data: null, why: 'the request timed out' }); });
        req.on('error', e => resolve({ data: null, why: e.message }));
        req.end();
    });
}

/* The committed fallback. It exists so a deploy never ships a sitemap that
   is missing or wrong just because the database was briefly unreachable --
   and so a fork with remote storage switched off still gets correct files. */
function readFallback() {
    const p = path.join(ROOT, 'tools', 'seo-config.json');
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { warn('tools/seo-config.json could not be read: ' + e.message); return null; }
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
    const cfg = readConfig();
    const row = await fetchRow(cfg);

    let data = seoSubset(row.data);
    let source = 'the live CMS record';
    let when = row.updatedAt ? String(row.updatedAt).slice(0, 10) : '';

    if (!data || !SEOFiles.baseUrl(data)) {
        if (row.why) warn('Could not use the live CMS record (' + row.why + '). Falling back to tools/seo-config.json.');
        data = seoSubset(readFallback());
        source = 'tools/seo-config.json (committed fallback)';
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
    log('Source:  ' + source);
    log('Base:    ' + base);
    log('Sitemap: ' + urls.length + ' URL(s)');
    urls.forEach(u => log('         ' + u));

    if (CHECK) { log('\n--check: nothing written.'); return; }

    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
    fs.writeFileSync(path.join(ROOT, 'robots.txt'), txt, 'utf8');
    log('\nWrote sitemap.xml and robots.txt.');
})();
