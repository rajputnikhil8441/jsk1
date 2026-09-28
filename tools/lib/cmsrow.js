/* ============================================================
   THE PUBLISHED CMS ROW — ONE READER
   ------------------------------------------------------------
   Two commands need to read a brand's published row from Supabase:

     tools/build-seo-files.js   the deploy-time sitemap/robots source
     tools/check-published.js   the freshness check (Part 2 of the
                                build-source synchronization guard)

   They used to be one file, so this was one function. Rather than let a
   second command grow a second Supabase client with its own idea of how
   the key travels and how the brand is resolved, the functions moved here
   unchanged and both commands call them. Two callers of the same API must
   not disagree about how it is authenticated.

   MOVED, NOT REWRITTEN. The bodies below are what build-seo-files.js ran;
   the only change is that ROOT, the brand and the warning sink are now
   arguments instead of module globals.

   NOTHING IN THE NORMAL BUILD CALLS THIS. tools/build-site.js and the Page
   Builder bake are entirely offline: the static site is a build artifact of
   the commit, and a build that phoned home would stop being deterministic.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const vm = require('vm');

function readConfig(opts) {
    const o = opts || {};
    const ROOT = o.root;
    const BRAND = o.brand || '';
    const warn = o.warn || function () {};
    /* With --brand the hostname is handed to cms-config.js exactly as a
       browser hands it over, so the brand is resolved by the SAME block
       that resolves it for a visitor. Duplicating that lookup here would
       be a second answer to "which brand is this?", and the two would
       eventually disagree. Without --brand there is no location at all,
       which is what this has always done: cms-config.js then falls to
       CMS_BRAND_DEFAULT. */
    const sandbox = BRAND ? { window: { location: { hostname: BRAND } } } : { window: {} };
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

        /* Same rule as js/cms.js: a legacy anon key is a JWT and goes in
           both headers, a publishable key (sb_publishable_...) is not a JWT
           and goes in `apikey` alone. Kept in step with baseHeaders() there
           -- two callers of the same API must not disagree about how it is
           authenticated. */
        const headers = { apikey: cfg.anonKey, Accept: 'application/json' };
        if (!/^sb_/.test(String(cfg.anonKey))) headers.Authorization = 'Bearer ' + cfg.anonKey;

        const req = https.request(u, { method: 'GET', headers: headers }, res => {
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

module.exports = { readConfig: readConfig, fetchRow: fetchRow };
