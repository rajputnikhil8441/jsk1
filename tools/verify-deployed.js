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

/* ============================================================
   WHAT ELSE THE DEPLOYED HTML HAS TO CARRY
   ------------------------------------------------------------
   The mount check above answers one question: is the published Page
   Builder content in the bytes the site returns? These answer the rest of
   it, and all of them the same way -- by comparing the ARTIFACT THAT WAS
   DEPLOYED with the RESPONSE THE SITE GIVES. The artifact is the
   expectation, so nothing here knows a brand, a domain, a page or an SEO
   value, and a new brand needs no change.

   Only tags the artifact actually has are compared. A page with no
   og:image is not failed for a missing og:image; a site with no sitemap is
   required NOT to serve one.
   ============================================================ */

/* One attribute of the tag identified by `sel`, read with the quote-aware
   scanner above so a value containing ">" cannot end the tag early. */
function tagWith(html, name, sel) {
    for (let i = 0; i < html.length; i++) {
        if (html[i] !== '<') continue;
        const t = tagAt(html, i);
        if (!t) continue;
        if (!t.close && t.name === name) {
            const tag = html.slice(i, t.end);
            if (sel.test(tag)) return tag;
        }
        i = t.end - 1;
    }
    return null;
}
function attrOf(tag, attr) {
    if (!tag) return null;
    const m = new RegExp('\\b' + attr + '="([^"]*)"').exec(tag);
    return m ? m[1] : null;
}
const metaContent = (html, attr, name) =>
    attrOf(tagWith(html, 'meta', new RegExp('\\b' + attr + '="' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"')), 'content');
const linkHref = (html, rel) =>
    attrOf(tagWith(html, 'link', new RegExp('\\brel="' + rel + '"')), 'href');
function titleText(html) {
    const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return m ? m[1].trim() : null;
}
function ldBlocks(html) {
    const out = {};
    const re = /<script[^>]*\bid="(ld[A-Za-z]+)"[^>]*>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html))) out[m[1]] = m[2].trim();
    return out;
}

/* The SEO a page carries, as data. Keys absent from the artifact are
   absent here too, so they are never compared. */
function seoOf(html) {
    const out = {};
    const t = titleText(html);
    if (t !== null) out['<title>'] = t;
    [['name', 'description'], ['name', 'robots'],
     ['property', 'og:title'], ['property', 'og:description'],
     ['property', 'og:url'], ['property', 'og:image'], ['property', 'og:site_name'],
     ['name', 'twitter:card'], ['name', 'twitter:title'],
     ['name', 'twitter:description'], ['name', 'twitter:image']].forEach(([a, n]) => {
        const v = metaContent(html, a, n);
        if (v !== null) out[a === 'property' ? n : n] = v;
    });
    const canon = linkHref(html, 'canonical');
    if (canon !== null) out['canonical'] = canon;
    const ld = ldBlocks(html);
    Object.keys(ld).forEach(id => { out['ld:' + id] = ld[id]; });
    return out;
}

/* The host a URL names, or '' if it names none. */
function hostOf(u) {
    try { return new URL(String(u)).host; } catch (e) { return ''; }
}

function locsOf(xml) {
    return (xml.match(/<loc>([^<]*)<\/loc>/g) || []).map(m => m.replace(/<\/?loc>/g, ''));
}


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
        return await verifyRest(0);
    }
    const mountedPages = new Set(want.map(w => w.page)).size;
    log('Baked     : ' + want.length + ' mount(s) across ' + mountedPages + ' page(s)');

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

    if (missing.length) {
        log('');
        const unreachable = missing.every(m => /^(HTTP |request failed|not served)/.test(m.why));
        missing.forEach(m => fail(m.page + ' ("' + m.slug + '"): ' + m.why));
        fail(missing.length + ' baked mount(s) are not in the HTML the site returns. The published ' +
             'CMS content exists only after JavaScript runs, which is exactly what baking is for.');
        return unreachable ? 2 : 1;
    }
    log('');
    log('Verified  : every baked mount is present in the served HTML, before any ' +
        'JavaScript runs.');
    return await verifyRest(mountedPages);
}

/* ------------------------------------------------------------
   THE REST OF THE DEPLOYMENT, PAST THE MOUNTS

   Every finding carries a KIND, so a red step says WHICH failure this is
   rather than only that something is wrong:

     unreachable        the site did not answer
     missing-html       a page the build generated is not served
     stale              the page is served, but it is not this build's
     missing-seo        a tag the artifact carries is absent from the response
     cross-host         a URL in the served page points at another host
     sitemap-mismatch   the sitemap is missing, differs, or names a page
                        that is not served
     noindex-leak       a review host is not protected as its artifact says
   ------------------------------------------------------------ */
async function verifyRest(mountedPages) {
    const findings = [];
    const add = (kind, where, detail) => findings.push({ kind, where, detail });

    const pages = htmlFiles(SITE).filter(f => f.indexOf('/') === -1);
    /* The host this deployment answers on. From --url when there is one, and
       otherwise from the artifact's own canonical -- so an offline check can
       still tell a cross-host URL from a local one. */
    let baseHost = BASE ? hostOf(BASE) : '';
    if (!baseHost) {
        for (const f of pages) {
            const h = hostOf(linkHref(fs.readFileSync(path.join(SITE, f), 'utf8'), 'canonical'));
            if (h) { baseHost = h; break; }
        }
    }

    let seoChecked = 0, pagesChecked = 0;
    for (const rel of pages) {
        const built = fs.readFileSync(path.join(SITE, rel), 'utf8');
        const got = await serve(rel);
        if (!got.ok) { add('missing-html', rel, got.why); continue; }
        pagesChecked++;

        const wantSeo = seoOf(built), gotSeo = seoOf(got.body);
        const keys = Object.keys(wantSeo);
        let bad = 0;
        keys.forEach(k => {
            if (!(k in gotSeo)) { add('missing-seo', rel, k + ' is not in the served page'); bad++; return; }
            if (gotSeo[k] !== wantSeo[k]) {
                add('stale', rel, k + ': built ' + JSON.stringify(wantSeo[k].slice(0, 90)) +
                    ', served ' + JSON.stringify(String(gotSeo[k]).slice(0, 90)));
                bad++;
            }
        });
        seoChecked += keys.length;

        /* A URL in the served page that names another host is either a stale
           deploy or one brand's page carrying another's address. */
        if (baseHost) {
            [['canonical', gotSeo['canonical']], ['og:url', gotSeo['og:url']]].forEach(([k, v]) => {
                const h = hostOf(v);
                if (h && h !== baseHost) {
                    add('cross-host', rel, k + ' points at ' + h + ', not ' + baseHost);
                    bad++;
                }
            });
        }

        /* A review host says noindex in its artifact; the served page must
           agree, or the review copy is indexable. */
        if (wantSeo['robots'] === 'noindex,nofollow' && gotSeo['robots'] !== 'noindex,nofollow') {
            add('noindex-leak', rel, 'the artifact is noindex,nofollow but the served page says ' +
                JSON.stringify(String(gotSeo['robots'])));
            bad++;
        }
        if (!bad) log('  OK      ' + rel + '  ' + keys.length + ' SEO value(s) match the artifact');
    }

    /* ---------- the sitemap, and the absence of one ---------- */
    const smapBuilt = path.join(SITE, 'sitemap.xml');
    if (fs.existsSync(smapBuilt)) {
        const built = fs.readFileSync(smapBuilt, 'utf8');
        const got = await serve('sitemap.xml');
        if (!got.ok) add('sitemap-mismatch', 'sitemap.xml', 'not served: ' + got.why);
        else if (got.body.trim() !== built.trim()) {
            add('sitemap-mismatch', 'sitemap.xml', 'the served sitemap is not the one that was built');
        } else {
            const locs = locsOf(built);
            for (const loc of locs) {
                const h = hostOf(loc);
                if (baseHost && h && h !== baseHost) {
                    add('cross-host', 'sitemap.xml', loc + ' is not on ' + baseHost); continue;
                }
                const rest = h ? loc.slice(loc.indexOf(h) + h.length).replace(/^\//, '') : loc.replace(/^\//, '');
                const file = rest === '' ? 'index.html' : rest;
                if (pages.indexOf(file) === -1) {
                    add('sitemap-mismatch', 'sitemap.xml', loc + ' has no generated page behind it');
                    continue;
                }
                const r = await serve(file);
                if (!r.ok) add('sitemap-mismatch', 'sitemap.xml', loc + ' is advertised but ' + r.why);
            }
            log('  OK      sitemap.xml  ' + locs.length + ' URL(s), each served and each a built page');
        }
    } else {
        /* No sitemap in the artifact is a decision, not an omission: a review
           host must not invite a crawl. The deployment has to agree. */
        const got = await serve('sitemap.xml');
        if (got.ok) add('noindex-leak', 'sitemap.xml',
            'the artifact publishes no sitemap, but the site serves one');
        else log('  OK      sitemap.xml  absent from the artifact and not served');
    }

    /* ---------- robots.txt ---------- */
    const robBuilt = path.join(SITE, 'robots.txt');
    if (fs.existsSync(robBuilt)) {
        const built = fs.readFileSync(robBuilt, 'utf8');
        const got = await serve('robots.txt');
        if (!got.ok) add('missing-html', 'robots.txt', got.why);
        else if (got.body.trim() !== built.trim()) {
            add('stale', 'robots.txt', 'the served robots.txt is not the one that was built');
        } else {
            log('  OK      robots.txt   matches the artifact' +
                (/^Disallow: \/$/m.test(built) ? '   (blocks everything -- a review host)' : ''));
        }
    }

    log('');
    log('Checked   : ' + pagesChecked + '/' + pages.length + ' page(s), ' + seoChecked +
        ' SEO value(s), ' + mountedPages + ' page(s) with baked content');
    if (!findings.length) {
        log('Verified  : the deployed HTML, its SEO and its sitemap are the ones that were ' +
            'built. No JavaScript was executed.');
        return 0;
    }

    const kinds = {};
    findings.forEach(f => { kinds[f.kind] = (kinds[f.kind] || 0) + 1; });
    findings.forEach(f => fail('[' + f.kind + '] ' + f.where + ': ' + f.detail));
    fail(findings.length + ' problem(s) with the deployed site: ' +
         Object.keys(kinds).sort().map(k => k + ' x' + kinds[k]).join(', ') + '.');
    /* Nothing answered at all is "could not check"; anything else is a real
       difference between what was built and what is served. */
    return findings.every(f => f.kind === 'missing-html' || f.kind === 'unreachable') ? 2 : 1;
}

main().then(code => process.exit(code), e => {
    fail(e && e.message ? e.message : String(e));
    process.exit(2);
});
