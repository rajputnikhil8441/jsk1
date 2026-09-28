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

   ENVIRONMENTS: ONE BRAND, MORE THAN ONE HOSTNAME

   A brand's IDENTITY and the HOSTNAME it is served on are not the
   same thing, and conflating them is a migration problem waiting
   to happen. Playzone9 is one brand; playzone9.app is the domain
   it will launch on; playzones9.com is where it is reviewed
   first. Renaming the brand to its staging host would mean
   renaming it back later -- its directory, its id, its Supabase
   row and every test that names it -- to change nothing about the
   brand itself.

   So brand.json keeps `domain` as the brand's CANONICAL domain
   and declares environments separately:

       "domain": "playzone9.app",
       "environments": {
         "staging": { "host": "playzones9.com",
                      "siteId": "...", "noindex": true }
       }

   Building with no environment builds the canonical domain.
   Building with one swaps the host -- so every canonical, og:url,
   JSON-LD url and sitemap entry follows automatically, because
   they all render from {{brand.domain}} -- and, when the
   environment says noindex, rewrites every page's robots meta.
   The brand id, the directory and the identity do not move.

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
const pbbake = require('./pbbake.js');

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
const ENV_NAME_RE = /^[a-z][a-z0-9-]{0,20}$/;

/* The environment a build with no --env produces: the brand on its own
   canonical domain, indexable. That is what production means, and it is
   never declared in brand.json -- so a brand that has never heard of
   environments behaves exactly as it did before they existed. */
const CANONICAL_ENV = 'production';

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
function loadBrand(brandsDir, id, envName) {
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

    const env = resolveEnv(cfg, id, envName);

    return {
        id: id,                       /* the brand's identity. Never an environment. */
        dir: dir,
        name: cfg.name,
        /* The host THIS build is for. Equal to canonicalDomain in production. */
        domain: env.host,
        canonicalDomain: cfg.domain,  /* the domain the brand will launch on */
        env: env.name,
        noindex: env.noindex,
        siteId: env.siteId,
        bucket: env.bucket,
        output: env.output,
        environments: Object.keys(cfg.environments || {}).sort(),
        pages: pages,
        allowScripts: allowScripts,
        slots: readSlots(dir, id, allowScripts),
        overrides: readOverrides(dir, id),
        /* The PUBLISHED Page Builder content this brand's committed layer
           holds, per slug, so the generator can put it in the HTML it serves.
           Read from brands/<id>/brand.js -- the same file every visitor
           downloads -- and never written.

           Empty for a brand that has published nothing, which is every brand
           until someone does. So this changes no existing output. */
        builder: readBuilder(dir, id),
        /* Set by planBrand: pbbake needs the repository root to find the
           engine it runs. Left undefined by a bare loadBrand, which is
           correct -- nothing bakes without a plan. */
        sharedRoot: null
    };
}

/* Which host, which Supabase row, and whether indexing is allowed, for the
   environment being built. Every refusal here is a way a review copy could
   turn into production by accident. */
function resolveEnv(cfg, id, envName) {
    const envs = cfg.environments;
    if (envs !== undefined && (!envs || typeof envs !== 'object' || Array.isArray(envs))) {
        throw new BrandError('Brand "' + id + '": "environments" must be a JSON object.');
    }
    const known = Object.keys(envs || {}).sort();
    for (const k of known) {
        if (!ENV_NAME_RE.test(k) || k === CANONICAL_ENV) {
            throw new BrandError('Brand "' + id + '": "' + k + '" is not a valid environment name. ' +
                'Use lowercase letters, digits and hyphens, and not "' + CANONICAL_ENV +
                '" -- that one is the brand\'s own domain and is never declared.');
        }
    }

    const name = envName || CANONICAL_ENV;
    if (name === CANONICAL_ENV) {
        return { name: name, host: cfg.domain, siteId: cfg.siteId,
                 bucket: typeof cfg.mediaBucket === 'string' ? cfg.mediaBucket : '',
                 output: typeof cfg.output === 'string' && cfg.output ? assertId(cfg.output) : id,
                 noindex: false };
    }
    if (!Object.prototype.hasOwnProperty.call(envs || {}, name)) {
        throw new BrandError('Brand "' + id + '" has no environment "' + name + '". Declared: ' +
            (known.length ? known.join(', ') : '(none)') + '. Build with no --env for the ' +
            'canonical domain ' + cfg.domain + '.');
    }
    const e = envs[name];
    if (!e || typeof e !== 'object' || Array.isArray(e)) {
        throw new BrandError('Brand "' + id + '": environment "' + name + '" must be a JSON object.');
    }
    if (typeof e.host !== 'string' || !e.host.trim()) {
        throw new BrandError('Brand "' + id + '": environment "' + name +
            '" is missing required field "host" (the hostname it is served on).');
    }
    assertId(e.host);
    if (e.host === cfg.domain) {
        throw new BrandError('Brand "' + id + '": environment "' + name + '" uses host "' + e.host +
            '", which is the brand\'s canonical domain. An environment exists to be a DIFFERENT ' +
            'host; pointing one at the canonical domain is how a review copy gets served as ' +
            'production.');
    }
    if (e.siteId !== undefined && (typeof e.siteId !== 'string' || !e.siteId.trim())) {
        throw new BrandError('Brand "' + id + '": environment "' + name +
            '": "siteId" must be a non-empty string when present.');
    }
    if (e.siteId !== undefined && e.siteId === cfg.siteId) {
        throw new BrandError('Brand "' + id + '": environment "' + name + '" declares siteId "' +
            e.siteId + '", the same row as the canonical environment. A review copy sharing the ' +
            'production row would publish over production. Give it its own row, or omit the field ' +
            'to inherit deliberately.');
    }
    return {
        name: name,
        host: e.host,
        siteId: typeof e.siteId === 'string' && e.siteId.trim() ? e.siteId : cfg.siteId,
        bucket: typeof e.bucket === 'string' ? e.bucket
            : (typeof cfg.mediaBucket === 'string' ? cfg.mediaBucket : ''),
        output: typeof e.output === 'string' && e.output ? assertId(e.output) : assertId(e.host),
        noindex: e.noindex === true
    };
}

/* The published Page Builder blocks in brands/<id>/brand.js.

   A brand with no brand.js is refused later, by the generator, with a message
   about the CMS fallback layer; this returns {} rather than duplicating that
   error in a worse place. */
function readBuilder(dir, id) {
    const file = path.join(dir, 'brand.js');
    if (!fs.existsSync(file)) return {};
    try {
        return pbbake.publishedSections(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        throw new BrandError('Brand "' + id + '": brand.js could not be read for its published ' +
            'Page Builder content: ' + e.message);
    }
}

/* Runs the offline integrity check for a brand that is about to be built.
   Kept here rather than in loadBrand() because it needs sharedRoot -- the
   engine whose fingerprint function it uses -- and only a plan has that. */
function verifyBuildSource(brand) {
    const file = path.join(brand.dir, 'brand.js');
    if (!fs.existsSync(file)) {
        /* A missing brand.js is refused below with a message about the CMS
           fallback layer. Not this guard's business. */
        return { status: 'not-recorded', problems: [], provenance: null };
    }
    return pbbake.verifyBuildSource(brand.sharedRoot, fs.readFileSync(file, 'utf8'),
                                    { siteId: brand.siteId });
}

/* One message that names the brand, every affected page, and what differs.
   A guard that says only "mismatch" makes someone go looking; this one tells
   them what to do about it. */
function buildSourceError(brand, guard) {
    const lines = ['Brand "' + brand.id + '": the committed Page Builder build source does not ' +
                   'match the provenance recorded when it was exported.'];
    guard.problems.forEach(p => {
        if (p.kind === 'brand') {
            lines.push('  - brand: ' + p.detail);
            return;
        }
        lines.push('  - page "' + p.page + '": ' + p.detail +
            (p.recorded ? '\n      recorded fingerprint ' + p.recorded +
                          '\n      actual fingerprint   ' + p.actual : ''));
    });
    lines.push('');
    lines.push('Refusing to bake Page Builder HTML nobody exported. Either restore ' +
               'brands/' + brand.id + '/brand.js from its export, or re-export it from ' +
               '/admin > Backup & Restore > Download brand defaults and commit both the ' +
               'content and its provenance together.');
    lines.push('');
    lines.push('NOTE: this check proves the build source is the exported artifact. It cannot ' +
               'tell you whether that export is still current -- run ' +
               'node tools/check-published.js ' + brand.id + ' for that.');
    return lines.join('\n');
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

/* The builder mount, exactly as the templates write it. Captured rather than
   assumed: the slug is what pairs a mount with its published sections. */
const MOUNT_RE = /<div data-cms-sections="([a-z0-9-]+)"\s*>([\s\S]*?)<\/div>/g;

/* Rendering the same section array twice per page (markup, then CSS) would run
   the engine twice for no reason, so the result is memoised per brand+slug for
   the life of the build. */
const PB_CACHE = new Map();
function pbrender(brand, slug, block) {
    const key = brand.dir + '\u0000' + slug;
    if (PB_CACHE.has(key)) return PB_CACHE.get(key);
    let r;
    try {
        r = pbbake.render(brand.sharedRoot, block);
    } catch (e) {
        /* Never emit a page that claims to carry builder content it does not.
           A baker that cannot run is a build failure, not a silent empty div. */
        throw new BrandError('Brand "' + brand.id + '": could not render the published Page ' +
            'Builder content for "' + slug + '": ' + e.message);
    }
    PB_CACHE.set(key, r);
    return r;
}

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

    /* A noindex environment rewrites the page's robots directive, and only
       that. It is COUNTED: a page whose robots meta this failed to find
       would otherwise be published indexable from a review host, which is
       the one thing a staging environment must never do. Exactly one tag,
       or the build stops. */
    if (brand.noindex) {
        let hits = 0;
        out = out.replace(/<meta name="robots" content="[^"]*"\s*\/?>/g, function () {
            hits++;
            return '<meta name="robots" content="noindex,nofollow" />';
        });
        if (hits !== 1) {
            throw new BrandError('Brand "' + brand.id + '" environment "' + brand.env + '" is ' +
                'noindex, but ' + where + ' has ' + hits + ' robots meta tag(s) -- expected exactly 1. ' +
                'Refusing to publish a review page whose indexing directive is unknown.');
        }
    }

    /* ------------------------------------------------------------
       THE PUBLISHED PAGE BUILDER CONTENT, INTO THE HTML WE SERVE
       ------------------------------------------------------------
       A builder-managed page shipped an empty mount, so its published
       headings, paragraphs, links and images existed only after JavaScript
       ran -- and a crawler without JavaScript read the static fallback copy
       instead, which is placeholder prose. Two documents at one URL.

       The markup below is produced by js/cms.js's OWN renderer, run in Node
       (tools/lib/pbbake.js). There is no second renderer, so the static HTML
       and the runtime DOM cannot describe the page differently.

       Nothing brand-specific: the sections come from whichever brand the
       build resolved, through the brand system that already exists. */
    const baked = [];
    out = out.replace(MOUNT_RE, function (whole, slug, inner) {
        const block = brand.builder[slug];
        /* No published content for this slug -- including a page nobody has
           built -- leaves the mount exactly as the template wrote it, which
           keeps the documented unpublished behaviour: the shipped fallback
           copy is what renders. */
        if (!block) return whole;
        /* A published EMPTY canvas is published. It bakes an empty mount,
           which is the same thing the renderer does at runtime: an empty
           page, not a quiet restoration of the shipped copy. */
        const r = pbrender(brand, slug, block);
        baked.push({ slug: slug, sections: block.sections.length, bytes: r.html.length });
        /* data-cms-baked lets the runtime tell "content I baked" from
           "content a visitor's browser drew", which is what makes clearing it
           safe when the live record says nothing is published any more. */
        return '<div data-cms-sections="' + slug + '" data-cms-baked="' +
               block.sections.length + '">' + r.html + '</div>';
    });

    /* The scoped custom properties the sections need, so a visitor without
       JavaScript sees the content styled rather than merely present. The
       runtime replaces this element's contents wholesale with the value it
       computes from the same array, so baking it cannot double anything. */
    if (baked.length) {
        const css = baked.map(x => pbrender(brand, x.slug, brand.builder[x.slug]).css).join('');
        if (css) {
            const tag = '<style id="cmsBuilder">' + css + '</style>';
            if (out.indexOf('</head>') === -1) {
                throw new BrandError('Brand "' + brand.id + '": ' + where +
                    ' has published Page Builder content but no </head> to put its styles in.');
            }
            out = out.replace('</head>', tag + '\n</head>');
        }
    }

    return { html: out, slotsDeclared: declared, baked: baked };
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
    const brand = loadBrand(brandsDir, opts.id, opts.env);
    /* Where the shared engine lives. The baker runs js/cms.js's own renderer
       and needs to find it; it is the same root the shared files come from. */
    brand.sharedRoot = opts.sharedRoot || path.resolve(__dirname, '..', '..');

    /* ------------------------------------------------------------
       PART 1 OF THE SYNCHRONIZATION GUARD -- OFFLINE, NO NETWORK
       ------------------------------------------------------------
       Before anything is baked, check the committed build source against the
       provenance its own export recorded. A mismatch stops the build rather
       than quietly baking sections nobody exported.

       This proves INTEGRITY, not freshness. A CMS publish made after the
       export leaves no trace in the repository, so nothing offline can detect
       it; tools/check-published.js asks Supabase and is the only thing that
       can. The warning wording below says so rather than implying more.
       ------------------------------------------------------------ */
    const guard = verifyBuildSource(brand);
    brand.buildSource = { status: guard.status, provenance: guard.provenance };

    /* ------------------------------------------------------------
       WHERE THE PUBLISHED SECTIONS COME FROM
       ------------------------------------------------------------
       By default: brands/<id>/brand.js, the committed layer. Offline,
       deterministic, and what every test and local build uses.

       With opts.published: the caller has already read the brand's
       PUBLISHED CMS record and hands the blocks over. tools/build-site.js
       --from-cms does that, which is how a content change reaches the HTML
       without anyone editing brand.js. The caller owns the fetching and its
       failures; this only decides which set gets baked, so there is one
       bake, not two.

       Nothing here knows a brand. Whoever is being built gets their own
       record, because the caller fetched it for that brand's own row.
       ------------------------------------------------------------ */
    if (opts.published && typeof opts.published === 'object') {
        brand.builder = opts.published;
        brand.contentSource = 'cms';
    } else {
        brand.contentSource = 'committed';
    }

    if (guard.status === 'mismatch') {
        /* In CMS mode the committed layer is no longer what gets baked, so a
           mismatch there is not a reason to refuse the content the row just
           supplied. It still matters -- js/brand.js ships to visitors as the
           pre-row fallback -- so it is reported rather than dropped. */
        if (brand.contentSource === 'cms') {
            brand.buildSource.warning = 'the committed brand layer does not match its recorded ' +
                'export, so the FALLBACK js/brand.js this build ships is not the exported ' +
                'artifact. The content baked into the HTML came from the published CMS record ' +
                'and is unaffected.';
        } else {
            throw new BrandError(buildSourceError(brand, guard));
        }
    }

    const available = fs.existsSync(path.join(templatesDir, 'pages'))
        ? fs.readdirSync(path.join(templatesDir, 'pages')).filter(f => PAGE_NAME_RE.test(f)).sort()
        : [];
    if (!available.length) {
        throw new BrandError('No page templates found in ' + path.join(templatesDir, 'pages') + '.');
    }

    const wanted = brand.pages || available.slice();
    const collector = makeCollector(brand.id);
    /* What the build put into the HTML, per page, so the build can say so and a
       drift between the committed layer and the live row is visible. */
    const bakedPages = [];
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
        (r.baked || []).forEach(x => bakedPages.push(x));
        emit(page, r.html, tplSource);
    }

    /* The brand's own CMS fallback layer, carried through unchanged. */
    const brandJs = path.join(brand.dir, 'brand.js');
    if (!fs.existsSync(brandJs)) {
        throw new BrandError('Brand "' + brand.id + '" has no brand.js at ' + brandJs +
            '. That file is the brand\'s CMS fallback layer and is required.');
    }
    emit('js/brand.js', envPatched(fs.readFileSync(brandJs, 'utf8'), brand),
         'brands/' + brand.id + '/brand.js');

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
    bakedPages.sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
    const warnings = [];
    if (brand.buildSource && brand.buildSource.status === 'not-recorded' && bakedPages.length) {
        /* Only when there is something to bake: a brand that publishes no Page
           Builder content has nothing whose integrity could be in question, and
           warning about it would train people to ignore the warning. */
        warnings.push('Builder provenance not recorded; build integrity cannot be verified. ' +
            'brands/' + brand.id + '/brand.js publishes Page Builder content but carries no ' +
            'window.CMS_BRAND_PROVENANCE, so the build cannot confirm these sections are the ' +
            'ones that were exported. Re-export it from /admin > Backup & Restore > Download ' +
            'brand defaults to record it. Building anyway.');
    }
    return { brand: brand, files: files, slotsDeclared: [...slotsUsed].sort(),
             baked: bakedPages, warnings: warnings };
}

/* An environment build gets its serving host appended to the brand's data
   layer. This is not cosmetic and it is not optional:

   js/cms.js repaints canonical, og:url and the JSON-LD urls from
   seo.baseUrl once it runs (setLink('canonical', pageUrl(page))). A review
   host that kept the brand's production baseUrl would therefore serve
   STATIC html pointing at itself and then, a moment later, a canonical
   pointing at a domain that is not even connected -- handing a review
   copy's signals to production. The static tags are rendered from
   {{brand.domain}} and are already right; this makes the runtime agree
   with them.

   Appended rather than rewritten: the brand's own file is left exactly as
   committed, and the override is a visible block at the end of the
   generated copy. Production appends nothing, so its brand.js is byte
   for byte the committed one. */
function envPatched(source, brand) {
    if (brand.env === CANONICAL_ENV) return source;
    return source +
        '\n\n/* ============================================================\n' +
        '   ENVIRONMENT OVERRIDE -- ' + brand.env + '\n' +
        '   ------------------------------------------------------------\n' +
        '   Generated by tools/build-brand.js for the "' + brand.env + '" environment.\n' +
        '   Not committed: it exists only in this build\'s output.\n' +
        '\n' +
        '   This build is served from ' + brand.domain + '.\n' +
        '   The brand launches on ' + brand.canonicalDomain + ', which is NOT this host.\n' +
        '\n' +
        '   js/cms.js repaints the canonical link, og:url and the JSON-LD\n' +
        '   urls from seo.baseUrl when it runs. Without this block a review\n' +
        '   host would tell crawlers its canonical is the production domain.\n' +
        '   ============================================================ */\n' +
        '(function () {\n' +
        '    var b = window.CMS_BRAND || (window.CMS_BRAND = {});\n' +
        '    b.seo = b.seo || {};\n' +
        '    b.seo.baseUrl = ' + JSON.stringify('https://' + brand.domain) + ';\n' +
        (brand.noindex
            ? '\n' +
              '    /* Whole-deployment noindex. js/cms.js repaints the robots meta\n' +
              '       from the merged CMS data, and that data is layered -- so\n' +
              '       setting noindex as DATA could be overridden by the Supabase\n' +
              '       row above it. This flag is read by the engine directly and\n' +
              '       nothing downstream can undo it. */\n' +
              '    window.CMS_NOINDEX = true;\n'
            : '') +
        '})();\n';
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
    renderPage, safeJoin, assertId, tokenValues, makeCollector, checkSlot,
    resolveEnv, CANONICAL_ENV, envPatched
};
