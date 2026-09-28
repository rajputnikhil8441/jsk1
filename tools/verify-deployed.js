#!/usr/bin/env node
/* ============================================================
   IS THE BAKED CMS CONTENT ACTUALLY IN THE HTML WE SERVE?
   ------------------------------------------------------------
   THE FAILURE THIS EXISTS TO CATCH. Every layer can report success and the
   acceptance criterion can still be unmet:

     the build says   "Builder : about (1 section) ... baked"
     the deploy says  "Reported success!"
     the browser says the content is there (DevTools > Elements)
     view-source says it is NOT

   because the browser paints the live CMS row over the mount after load,
   and the DOM therefore tells you nothing about the HTML. Only the bytes
   the server returns do. So this asks the deployed site itself, and it asks
   for the one thing that matters: the baked markup the build wrote.

   WHAT IT COMPARES. For every assembled page carrying a
   `data-cms-baked` mount, the mount's ENTIRE markup -- the div and
   everything the renderer put inside it -- must appear verbatim in the
   response body for that page's URL. Not a keyword, not a length: the same
   bytes, so a stale deploy, a half-published artifact, a CDN still serving
   the previous version, or a mount that arrived empty all fail.

   WHAT IT DOES NOT DO. It does not execute JavaScript, and that is the
   point: whatever it finds is in the initial HTML, before any script runs.
   It makes GET requests and nothing else -- no write, anywhere.

   BRAND-AGNOSTIC. It is handed an assembled directory and a base URL. It
   learns the pages and the expected markup from that directory, so it has
   no brand, no domain and no page list of its own, and works unchanged for
   any brand the build can assemble.

   EXIT CODES
     0  every baked mount is present in the served HTML (or none was baked)
     1  a mount is missing or differs -- the deployed HTML is not what was built
     2  the check could not be made (the site could not be fetched)

   USAGE
     node tools/verify-deployed.js --site DIR --url BASE
                                   [--served DIR] [--attempts N] [--wait MS]

   --served DIR reads the "response" from a directory instead of the network,
   which is how tests drive this offline. GitHub Pages can take a few seconds
   to serve a new deployment, so a mismatch is retried before it is believed.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };

const SITE     = opt('--site', '');
const BASE     = opt('--url', '').replace(/\/+$/, '');
const SERVED   = opt('--served', '');
const ATTEMPTS = Math.max(1, parseInt(opt('--attempts', '10'), 10) || 1);
const WAIT     = Math.max(0, parseInt(opt('--wait', '6000'), 10) || 0);

const log  = m => console.log(m);
const fail = m => console.log('::error::' + m);

/* ---------- the assembled pages and what was baked into them ---------- */

function htmlFiles(dir, base, out) {
    base = base || dir; out = out || [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) htmlFiles(full, base, out);
        else if (/\.html$/i.test(e.name)) out.push(path.relative(base, full).split(path.sep).join('/'));
    }
    return out;
}

/* The tag starting at `i`, or null if that is not a tag.
   Quoted attribute values are honoured, and that is the whole reason this is
   not a regular expression: `>` is legal inside a quoted value, so a section
   id of `a>b` renders as data-sec="a>b" and a regex would end the tag early
   and then read the rest of the value as markup. Content is escaped, so it
   cannot inject a tag -- but it can contain these two characters, and a
   perfectly good mount would otherwise be reported as unclosed and fail a
   deploy that was fine. */
function tagAt(html, i) {
    if (html[i] !== '<') return null;
    let j = i + 1, close = false;
    if (html[j] === '/') { close = true; j++; }
    const from = j;
    while (j < html.length && /[A-Za-z0-9:-]/.test(html[j])) j++;
    const name = html.slice(from, j).toLowerCase();
    if (!name) return null;
    let quote = '';
    while (j < html.length) {
        const ch = html[j];
        if (quote) { if (ch === quote) quote = ''; }
        else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '>') return { name: name, close: close, end: j + 1 };
        j++;
    }
    return null;                                   /* unterminated tag */
}

/* The index just past the </div> that closes the tag ending at `from`.
   Counted, because the baked markup contains divs of its own and the first
   </div> is not the right one. */
function closeOfDiv(html, from) {
    let depth = 1;
    for (let i = from; i < html.length; i++) {
        if (html[i] !== '<') continue;
        const t = tagAt(html, i);
        if (!t) continue;
        if (t.name === 'div') {
            depth += t.close ? -1 : 1;
            if (depth === 0) return t.end;
        }
        i = t.end - 1;
    }
    return -1;
}

function bakedMounts(html) {
    const out = [];
    for (let i = 0; i < html.length; i++) {
        if (html[i] !== '<') continue;
        const t = tagAt(html, i);
        if (!t) continue;
        const tag = html.slice(i, t.end);
        if (t.close || t.name !== 'div' || !isMount(tag)) { i = t.end - 1; continue; }
        const end = closeOfDiv(html, t.end);
        if (end < 0) { out.push({ slug: slugOf(tag), markup: null }); break; }
        out.push({ slug: slugOf(tag), markup: html.slice(i, end) });
        i = end - 1;
    }
    return out;
}
const isMount = tag => /\bdata-cms-baked="/.test(tag) && /\bdata-cms-sections="/.test(tag);
const slugOf = tag => (tag.match(/data-cms-sections="([^"]*)"/) || [, '(unknown)'])[1];

/* ---------- what the server returns for that page ---------- */

async function serve(relPath) {
    if (SERVED) {
        const f = path.join(SERVED, relPath.split('/').join(path.sep));
        if (!fs.existsSync(f)) return { ok: false, why: 'not served (404)' };
        return { ok: true, body: fs.readFileSync(f, 'utf8') };
    }
    let res;
    try {
        res = await fetch(BASE + '/' + relPath, { redirect: 'follow' });
    } catch (e) {
        return { ok: false, why: 'request failed: ' + (e && e.message ? e.message : String(e)) };
    }
    if (!res.ok) return { ok: false, why: 'HTTP ' + res.status };
    return { ok: true, body: await res.text() };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
    if (!SITE || (!BASE && !SERVED)) {
        fail('usage: node tools/verify-deployed.js --site DIR --url BASE [--served DIR]');
        return 2;
    }
    if (!fs.existsSync(SITE)) { fail('--site ' + SITE + ' does not exist.'); return 2; }

    /* What to look for, learned from the artifact that was deployed. */
    const want = [];
    for (const rel of htmlFiles(SITE)) {
        for (const mount of bakedMounts(fs.readFileSync(path.join(SITE, rel), 'utf8'))) {
            if (mount.markup === null) {
                fail(rel + ': the baked mount for "' + mount.slug + '" is not closed in the ' +
                     'assembled file. This is a build defect, not a deploy one.');
                return 1;
            }
            want.push({ page: rel, slug: mount.slug, markup: mount.markup });
        }
    }

    log('Verifying : ' + (SERVED || BASE));
    if (!want.length) {
        log('Baked     : nothing -- no page in ' + SITE + ' carries a data-cms-baked mount,');
        log('            so there is no baked content to find in the served HTML.');
        return 0;
    }
    log('Baked     : ' + want.length + ' mount(s) across ' +
        new Set(want.map(w => w.page)).size + ' page(s)');

    /* A just-created deployment can take a moment to be the one served, so a
       miss is retried before it is called a failure. A hit is final. */
    let missing = want.slice();
    for (let attempt = 1; attempt <= ATTEMPTS && missing.length; attempt++) {
        if (attempt > 1) { log('            not there yet -- retrying in ' + (WAIT / 1000) + 's (' +
                               attempt + '/' + ATTEMPTS + ')'); await sleep(WAIT); }
        const bodies = new Map();
        const still = [];
        for (const w of missing) {
            if (!bodies.has(w.page)) bodies.set(w.page, await serve(w.page));
            const got = bodies.get(w.page);
            if (!got.ok) { still.push(Object.assign({ why: got.why }, w)); continue; }
            if (got.body.indexOf(w.markup) >= 0) {
                log('  OK      ' + w.page + '  "' + w.slug + '" is in the HTML source (' +
                    w.markup.length + ' bytes)');
            } else {
                still.push(Object.assign({ why: /data-cms-baked/.test(got.body)
                    ? 'the page carries a baked mount, but not this markup -- the served ' +
                      'version is not the one that was just built'
                    : 'the served page has no baked mount at all' }, w));
            }
        }
        missing = still;
    }

    if (!missing.length) {
        log('');
        log('Verified  : every baked mount is present in the served HTML, before any ' +
            'JavaScript runs.');
        return 0;
    }

    log('');
    const unreachable = missing.every(m => /^(HTTP |request failed|not served)/.test(m.why));
    missing.forEach(m => fail(m.page + ' ("' + m.slug + '"): ' + m.why));
    fail(missing.length + ' baked mount(s) are not in the HTML the site returns. The published ' +
         'CMS content exists only after JavaScript runs, which is exactly what baking is for.');
    return unreachable ? 2 : 1;
}

main().then(code => process.exit(code), e => {
    fail(e && e.message ? e.message : String(e));
    process.exit(2);
});
