'use strict';
/* ============================================================
   BRANDKIT — the multi-brand generator's library
   ------------------------------------------------------------
   One codebase, many brands. This turns a brand's own
   configuration and content into that brand's site files, and
   it is the ONLY place that knows how.

   WHY A GENERATOR AT ALL

   Every page in this project carries its brand baked in as the
   static fallback a crawler reads before any JavaScript runs.
   That is deliberate and it is not going away -- but it means a
   second brand cannot simply reuse the first brand's .html
   files. Something has to produce each brand's pages. This does.

   THREE LEVELS OF BRAND CONTROL, DELIBERATELY ESCALATING

   Most brands should only need the first. The later ones exist
   because "every brand has identical markup" is an assumption
   that fails the first time someone wants a different login
   page, and discovering that after the architecture is set is
   expensive.

     1. TOKENS   templates/pages/*.html carry {{brand.name}} and
                 {{brand.domain}}. A brand supplies the values.
                 This covers the overwhelming majority: 188 of
                 the brand references across the eight JSK1
                 pages are one of those two strings.

     2. SLOTS    a template may declare a named, empty region:
                     <!-- BRAND:login-notice --><!-- /BRAND:login-notice -->
                 A brand fills it by committing
                 brands/<id>/slots/login-notice.html. A brand
                 that says nothing gets nothing: the markers and
                 everything between them are removed, so a page
                 with no slots filled is byte-identical to one
                 that never had markers. That property is what
                 lets JSK1 keep its exact current bytes while
                 the mechanism exists for everyone else.

     3. OVERRIDE a brand may commit brands/<id>/pages/login.html
                 and replace the shared template outright, for
                 the case where the arrangement itself differs
                 rather than the words. Tokens and slots still
                 apply to an override, so it is a starting point
                 rather than an exit from the system.

   WHAT THIS IS NOT

   This is a BUILD-TIME tool reading files committed to this
   repository. It never sees a database, a request, or anything
   a visitor typed. Slot content is therefore the same trust
   level as the .html files themselves -- a developer wrote it
   and a reviewer read it. It is still checked (see checkSlot),
   because the point of an explicit mechanism is that mistakes
   are caught rather than deployed, and because "a developer
   wrote it" stops being reassuring the day someone pastes in a
   third-party embed.
   ============================================================ */

const fs = require('fs');
const path = require('path');

/* Thrown for every refusal, so a caller can tell a brand problem
   from a genuine crash. Every message names what to fix. */
class BrandError extends Error {
    constructor(msg) { super(msg); this.name = 'BrandError'; }
}

/* ---------- identifiers ----------
   A brand id becomes a directory name and an output directory
   name, so it is checked before it is ever joined to a path.
   Hostname-shaped: lowercase letters, digits, dots and hyphens,
   no leading dot, no '..' anywhere. */
const ID_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/;
const SLOT_NAME_RE = /^[a-z0-9][a-z0-9-]{0,48}$/;
const PAGE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,60}\.html$/;

function assertId(id) {
    if (typeof id !== 'string' || !id) throw new BrandError('A brand id is required.');
    if (id.indexOf('..') > -1) throw new BrandError('Brand id "' + id + '" contains "..".');
    if (!ID_RE.test(id)) {
        throw new BrandError('Brand id "' + id + '" is not a valid identifier. ' +
            'Use lowercase letters, digits, dots and hyphens, e.g. "example.com".');
    }
    return id;
}

/* Every path this tool produces goes through here. Resolving and
   then checking the prefix catches traversal however it is
   spelled -- '..', an absolute path, a symlink-shaped name -- and
   catches it AFTER normalisation, which string inspection alone
   does not. */
function safeJoin(rootDir, relative, what) {
    const root = path.resolve(rootDir);
    const full = path.resolve(root, relative);
    if (full !== root && !full.startsWith(root + path.sep)) {
        throw new BrandError(
            (what || 'Path') + ' "' + relative + '" resolves outside "' + root + '". Refusing.');
    }
    return full;
}

/* ---------- reading a brand ---------- */

function readJson(file, what) {
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); }
    catch (e) { throw new BrandError('Cannot read ' + what + ' at ' + file + ': ' + e.message); }
    try { return JSON.parse(raw); }
    catch (e) { throw new BrandError(what + ' at ' + file + ' is not valid JSON: ' + e.message); }
}

const REQUIRED = ['id', 'name', 'domain', 'siteId'];

/* Loads brands/<id>/brand.json and everything it points at.
   Fails on the FIRST problem with a message that says which
   brand, which field, and what was expected -- a generator that
   half-runs on a broken config is worse than one that stops. */
function loadBrand(brandsDir, id) {
    assertId(id);
    const dir = safeJoin(brandsDir, id, 'Brand directory');
    if (!fs.existsSync(dir)) {
        const known = listBrands(brandsDir);
        throw new BrandError('Unknown brand "' + id + '". No directory at ' + dir +
            '. Known brands: ' + (known.length ? known.join(', ') : '(none)') + '.');
    }
    const cfgFile = path.join(dir, 'brand.json');
    if (!fs.existsSync(cfgFile)) {
        throw new BrandError('Brand "' + id + '" has no brand.json at ' + cfgFile + '.');
    }
    const cfg = readJson(cfgFile, 'brand.json for "' + id + '"');
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
        throw new BrandError('brand.json for "' + id + '" must be a JSON object.');
    }

    for (const key of REQUIRED) {
        if (typeof cfg[key] !== 'string' || !cfg[key].trim()) {
            throw new BrandError('Brand "' + id + '" is missing required field "' + key +
                '" (a non-empty string) in brand.json.');
        }
    }
    if (cfg.id !== id) {
        throw new BrandError('Brand "' + id + '" declares id "' + cfg.id +
            '" in brand.json. The directory name and the id must match.');
    }
    assertId(cfg.domain);

    /* pages: which templates this brand publishes. Absent means all
       of them, which is what a brand that has not thought about it
       should get. */
    let pages = cfg.pages;
    if (pages === undefined) pages = null;
    else if (!Array.isArray(pages)) {
        throw new BrandError('Brand "' + id + '": "pages" must be an array of file names.');
    } else {
        for (const p of pages) {
            if (typeof p !== 'string' || !PAGE_NAME_RE.test(p)) {
                throw new BrandError('Brand "' + id + '": "' + p +
                    '" is not a valid page name. Expected something like "login.html".');
            }
        }
        if (new Set(pages).size !== pages.length) {
            throw new BrandError('Brand "' + id + '": "pages" lists the same page twice.');
        }
    }

    const allowScripts = Array.isArray(cfg.allowScriptsInSlots) ? cfg.allowScriptsInSlots : [];
    for (const s of allowScripts) {
        if (typeof s !== 'string' || !SLOT_NAME_RE.test(s)) {
            throw new BrandError('Brand "' + id + '": "allowScriptsInSlots" entry "' + s +
                '" is not a valid slot name.');
        }
    }

    return {
        id: id,
        dir: dir,
        name: cfg.name,
        domain: cfg.domain,
        siteId: cfg.siteId,
        output: typeof cfg.output === 'string' && cfg.output ? assertId(cfg.output) : id,
        pages: pages,
        allowScripts: allowScripts,
        slots: readSlots(dir, id, allowScripts),
        overrides: readOverrides(dir, id)
    };
}

function listBrands(brandsDir) {
    if (!fs.existsSync(brandsDir)) return [];
    return fs.readdirSync(brandsDir, { withFileTypes: true })
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name).sort();
}

/* ---------- slots ----------
   Content comes from FILES, never from strings inside brand.json.
   A file is reviewable in a diff and cannot be assembled at
   runtime, which is the whole point of calling this mechanism
   explicit. */
function readSlots(dir, id, allowScripts) {
    const slotDir = path.join(dir, 'slots');
    const out = {};
    if (!fs.existsSync(slotDir)) return out;
    for (const f of fs.readdirSync(slotDir).sort()) {
        if (f.startsWith('.')) continue;
        if (!f.endsWith('.html')) {
            throw new BrandError('Brand "' + id + '": slot file "' + f +
                '" must end in .html. Slots are HTML fragments.');
        }
        const name = f.slice(0, -5);
        if (!SLOT_NAME_RE.test(name)) {
            throw new BrandError('Brand "' + id + '": slot name "' + name +
                '" is invalid. Use lowercase letters, digits and hyphens.');
        }
        const full = safeJoin(slotDir, f, 'Slot file');
        const html = fs.readFileSync(full, 'utf8');
        checkSlot(id, name, html, allowScripts.indexOf(name) > -1);
        out[name] = html;
    }
    return out;
}

/* What a slot may contain. Not a sanitiser -- it does not rewrite
   anything -- a GATE: a slot either passes review or the build
   stops. Rewriting developer-authored markup silently would be
   worse, because the author would never learn what was wrong. */
const SCRIPTISH = [
    [/<script[\s>]/i, '<script> (set allowScriptsInSlots in brand.json to permit it for this slot)'],
    [/\son[a-z]+\s*=/i, 'an inline on* event handler'],
    [/javascript:/i, 'a javascript: URL'],
    [/<iframe[\s>]/i, '<iframe> (set allowScriptsInSlots to permit it for this slot)'],
    [/<object[\s>]|<embed[\s>]/i, '<object>/<embed>']
];

function checkSlot(id, name, html, scriptsAllowed) {
    if (html.length > 64 * 1024) {
        throw new BrandError('Brand "' + id + '": slot "' + name + '" is over 64 KB. ' +
            'A page that needs that much markup wants a page override, not a slot.');
    }
    if (html.indexOf('<!-- BRAND:') > -1 || html.indexOf('<!-- /BRAND:') > -1) {
        throw new BrandError('Brand "' + id + '": slot "' + name +
            '" contains a BRAND slot marker. Slots do not nest.');
    }
    if (/\{\{/.test(html)) {
        throw new BrandError('Brand "' + id + '": slot "' + name + '" contains "{{". ' +
            'Slot content is inserted after token substitution, so a token there would ship literally.');
    }
    for (const [re, what] of SCRIPTISH) {
        if (re.test(html)) {
            if (scriptsAllowed && (/<script[\s>]/i.test(html) || /<iframe[\s>]/i.test(html))) continue;
            throw new BrandError('Brand "' + id + '": slot "' + name + '" contains ' + what + '.');
        }
    }
}

/* ---------- whole-page overrides ---------- */
function readOverrides(dir, id) {
    const pagesDir = path.join(dir, 'pages');
    const out = {};
    if (!fs.existsSync(pagesDir)) return out;
    for (const f of fs.readdirSync(pagesDir).sort()) {
        if (f.startsWith('.')) continue;
        if (!PAGE_NAME_RE.test(f)) {
            throw new BrandError('Brand "' + id + '": page override "' + f +
                '" is not a valid page name. Expected something like "login.html".');
        }
        out[f] = fs.readFileSync(safeJoin(pagesDir, f, 'Page override'), 'utf8');
    }
    return out;
}

/* ---------- rendering ---------- */

const TOKEN_RE = /\{\{\s*([a-z][a-z0-9.]*)\s*\}\}/gi;

function tokenValues(brand) {
    return {
        'brand.name': brand.name,
        'brand.domain': brand.domain,
        'brand.siteId': brand.siteId,
        'brand.id': brand.id
    };
}

/* Substitution, then slots, then a check that nothing is left
   unresolved. That last step matters more than it looks: a
   mistyped token would otherwise ship as literal "{{brand.nmae}}"
   into a page a crawler reads. */
function renderPage(templateHtml, brand, where) {
    const values = tokenValues(brand);
    /* Matching is case-insensitive, so the lookup table has to be
       folded too -- otherwise {{brand.siteId}} misses the entry that
       is literally called 'brand.siteId' and the error message ends up
       listing the very token it just rejected. */
    const folded = {};
    Object.keys(values).forEach(k => { folded[k.toLowerCase()] = values[k]; });
    const unknown = [];
    let out = String(templateHtml).replace(TOKEN_RE, (m, key) => {
        const k = key.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(folded, k)) return folded[k];
        unknown.push(key);
        return m;
    });
    if (unknown.length) {
        throw new BrandError('Brand "' + brand.id + '": ' + where + ' uses unknown token(s) ' +
            [...new Set(unknown)].map(t => '{{' + t + '}}').join(', ') +
            '. Known tokens: ' + Object.keys(values).map(t => '{{' + t + '}}').join(', ') + '.');
    }

    /* A declared slot is replaced by its content, or removed
       entirely when the brand said nothing. Removing the markers
       as well is what keeps an unfilled page byte-identical to
       one that never had them. */
    const declared = [];
    out = out.replace(/<!-- BRAND:([a-z0-9-]+) -->[\s\S]*?<!-- \/BRAND:\1 -->/g, (m, name) => {
        declared.push(name);
        return Object.prototype.hasOwnProperty.call(brand.slots, name) ? brand.slots[name] : '';
    });

    const stray = out.match(/<!-- \/?BRAND:[a-z0-9-]+ -->/g);
    if (stray) {
        throw new BrandError('Brand "' + brand.id + '": ' + where +
            ' has an unmatched slot marker: ' + stray[0] + '. Markers must be a matched pair.');
    }
    if (/\{\{/.test(out)) {
        throw new BrandError('Brand "' + brand.id + '": ' + where +
            ' still contains "{{" after rendering. A slot must not introduce tokens.');
    }
    return { html: out, slotsDeclared: declared };
}

/* ---------- planning ----------
   Builds the complete list of files and their contents WITHOUT
   touching the disk, so every check runs before anything is
   written and a refusal leaves no half-generated site behind. */
/* Collects the files a build will write, refusing the moment two
   sources claim the same output path. Today the page list is
   already checked for duplicates upstream, so this is a backstop
   -- and it is exported and tested as one, because the phase that
   adds brand CSS and assets will add emitters that have no such
   upstream check, and a build that silently writes one file twice
   is the kind of bug that only shows up in production. */
function makeCollector(brandId) {
    const files = [];
    const seen = new Map();
    return {
        files: files,
        emit: function (rel, contents, source) {
            if (seen.has(rel)) {
                throw new BrandError('Brand "' + brandId + '": two sources both want to write "' + rel +
                    '" (' + seen.get(rel) + ' and ' + source + '). Refusing an ambiguous build.');
            }
            seen.set(rel, source);
            files.push({ path: rel, contents: contents });
        }
    };
}

function planBrand(opts) {
    const brandsDir = opts.brandsDir;
    const templatesDir = opts.templatesDir;
    const brand = loadBrand(brandsDir, opts.id);

    const available = fs.existsSync(path.join(templatesDir, 'pages'))
        ? fs.readdirSync(path.join(templatesDir, 'pages')).filter(f => PAGE_NAME_RE.test(f)).sort()
        : [];
    if (!available.length) {
        throw new BrandError('No page templates found in ' + path.join(templatesDir, 'pages') + '.');
    }

    const wanted = brand.pages || available.slice();
    const collector = makeCollector(brand.id);
    const files = collector.files;
    const emit = collector.emit;
    const slotsUsed = new Set();

    for (const page of wanted) {
        let tplSource, tpl;
        if (Object.prototype.hasOwnProperty.call(brand.overrides, page)) {
            tpl = brand.overrides[page];
            tplSource = 'brands/' + brand.id + '/pages/' + page;
        } else {
            if (available.indexOf(page) === -1) {
                throw new BrandError('Brand "' + brand.id + '" lists page "' + page +
                    '" but there is no template at templates/pages/' + page +
                    ' and no override at brands/' + brand.id + '/pages/' + page +
                    '. Available templates: ' + available.join(', ') + '.');
            }
            tpl = fs.readFileSync(safeJoin(path.join(templatesDir, 'pages'), page, 'Template'), 'utf8');
            tplSource = 'templates/pages/' + page;
        }
        const r = renderPage(tpl, brand, tplSource);
        r.slotsDeclared.forEach(s => slotsUsed.add(s));
        emit(page, r.html, tplSource);
    }

    /* The brand's own CMS fallback layer, carried through unchanged. */
    const brandJs = path.join(brand.dir, 'brand.js');
    if (!fs.existsSync(brandJs)) {
        throw new BrandError('Brand "' + brand.id + '" has no brand.js at ' + brandJs +
            '. That file is the brand\'s CMS fallback layer and is required.');
    }
    emit('js/brand.js', fs.readFileSync(brandJs, 'utf8'), 'brands/' + brand.id + '/brand.js');

    /* The deploy-time SEO fallback, if the brand ships one. */
    const seo = path.join(brand.dir, 'seo-config.json');
    if (fs.existsSync(seo)) {
        readJson(seo, 'seo-config.json for "' + brand.id + '"');   /* validate before emitting */
        emit('seo-config.json', fs.readFileSync(seo, 'utf8'), 'brands/' + brand.id + '/seo-config.json');
    }

    /* A slot the brand filled that no template declares is almost
       always a typo, and silently ignoring it means the brand
       wonders why its content never appears. */
    const orphans = Object.keys(brand.slots).filter(s => !slotsUsed.has(s));
    if (orphans.length) {
        throw new BrandError('Brand "' + brand.id + '": slot file(s) ' +
            orphans.map(s => s + '.html').join(', ') +
            ' do not match any <!-- BRAND:... --> marker in the pages being generated. ' +
            'Declared slots: ' + (slotsUsed.size ? [...slotsUsed].sort().join(', ') : '(none)') + '.');
    }

    /* Sorted so the plan -- and therefore the output -- does not
       depend on directory read order. */
    files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    return { brand: brand, files: files, slotsDeclared: [...slotsUsed].sort() };
}

/* ---------- writing ---------- */
function writePlan(plan, outRoot) {
    const dest = safeJoin(outRoot, plan.brand.output, 'Output directory');
    for (const f of plan.files) {
        const full = safeJoin(dest, f.path, 'Output file');
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, f.contents, 'utf8');
    }
    return { dir: dest, written: plan.files.map(f => f.path) };
}

module.exports = {
    BrandError, loadBrand, listBrands, planBrand, writePlan,
    renderPage, safeJoin, assertId, tokenValues, makeCollector, checkSlot
};
