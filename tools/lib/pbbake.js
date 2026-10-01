/* ============================================================
   PBBAKE — the published Page Builder content, in the HTML we serve
   ------------------------------------------------------------
   THE PROBLEM. A builder-managed page shipped an empty mount:

       <div data-cms-sections="about"></div>

   so the published headings, paragraphs, links and images existed only
   after JavaScript ran. A crawler that executes JavaScript read the builder
   content; one that does not read the static fallback copy instead, which is
   placeholder prose. Two different documents at one URL.

   WHAT THIS DOES. It fills that div at build time with the same markup the
   browser would produce, by running THE SAME RENDERER. js/cms.js is loaded
   in a vm against tools/lib/minidom.js and its own CMS.sections.renderInto
   is called. There is no second renderer and therefore nothing to drift:
   the only thing written twice is HTML serialisation, and
   tests/test_pb_bake.js asserts ours matches a real browser's innerHTML for
   every element type.

   WHERE THE SECTIONS COME FROM: brands/<id>/brand.js -- the brand's
   committed CMS layer, which every visitor already downloads and which the
   admin can regenerate (Backup & Restore > Download brand defaults). It is
   read, never written.

   NOTHING HERE READS SUPABASE, and that is a division of labour rather than
   a policy: this file renders whatever record it is handed. A local build or
   a test hands it the committed layer, which keeps those builds offline and
   deterministic. A deploy passes --from-cms, and tools/build-site.js fetches
   the brand's published record and hands that in instead -- the same shape,
   through this same renderer, so there is still one bake and one source of
   markup. publishedFromRecord() below is the shape conversion, and it is
   the only thing here that knows a row exists.

   EITHER WAY the baked copy is fixed when the build runs, so publishing has
   to be able to START a build -- see "What starts a deploy" in
   docs/publishing.md. Without that the served HTML freezes at the row as it
   was when the last commit landed while the runtime paints the current row
   over the mount, which looks like a working page with a stale source.

   The build prints what it baked per page, and which source it came from, so
   a drift is visible rather than silent, and it never claims to have baked
   content it did not.

   MULTI-BRAND. Nothing here knows a brand. It is handed a brand directory
   by the generator, which resolved it from the build's --brand argument
   through the existing brand system. Brand A's build reads brand A's
   brand.js; brand B's reads B's. No branching, no special case.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MiniDocument, Element } = require('./minidom.js');

/* The shared engine, loaded once per process. */
let ENGINE = null;

/* js/cms.js is a browser file: it paints on load, listens for events, reads
   localStorage and fetches a row. None of that can happen here, and none of
   it needs to -- the renderer is a pure function of a section array. This is
   the smallest environment in which the file loads and that function works.

   tools/build-seo-files.js already loads js/cms-config.js this way, so
   evaluating a committed browser file in a vm is an established pattern in
   this build, not a new liberty. */
function loadEngine(sharedRoot) {
    if (ENGINE) return ENGINE;

    const file = path.join(sharedRoot, 'js', 'cms.js');
    if (!fs.existsSync(file)) {
        throw new Error('pbbake: cannot find the CMS engine at ' + file);
    }

    const store = new Map();
    const storage = {
        getItem: k => (store.has(String(k)) ? store.get(String(k)) : null),
        setItem: (k, v) => { store.set(String(k), String(v)); },
        removeItem: k => { store.delete(String(k)); },
        clear: () => store.clear()
    };

    const document = new MiniDocument();
    const sandbox = {
        window: null,
        document: document,
        console: { log() {}, warn() {}, error() {}, info() {} },
        setTimeout: () => 0,
        clearTimeout: () => {},
        /* Remote storage is off in here, so nothing calls fetch. It exists so
           a reference to it cannot throw during load. */
        fetch: () => new Promise(() => {}),
        localStorage: storage,
        sessionStorage: storage,
        /* No CMS_REMOTE and no CMS_MEDIA: the engine sees remote storage as
           unconfigured, which is exactly right for a build. */
        location: { hostname: '', href: '', protocol: 'https:' },
        navigator: { userAgent: 'node' },
        CustomEvent: class { constructor(t, o) { this.type = t; this.detail = (o || {}).detail; } },
        addEventListener() {},
        removeEventListener() {},
        dispatchEvent() { return true; },
        matchMedia: () => ({ matches: false, addListener() {}, removeListener() {} }),
        requestAnimationFrame: () => 0,
        getComputedStyle: () => ({ getPropertyValue: () => '' })
    };
    sandbox.window = sandbox;
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;

    vm.createContext(sandbox);
    try {
        vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox,
                        { filename: 'js/cms.js', timeout: 15000 });
    } catch (e) {
        throw new Error('pbbake: the CMS engine did not load in Node: ' + e.message);
    }

    const CMS = sandbox.window.CMS;
    if (!CMS || !CMS.sections || typeof CMS.sections.renderInto !== 'function' ||
        typeof CMS.sections.css !== 'function') {
        throw new Error('pbbake: js/cms.js loaded but CMS.sections.renderInto / .css are missing. ' +
                        'The baker calls the runtime renderer directly; it has no copy of its own.');
    }

    /* The sandbox comes back too: CMS_NOINDEX is read off the global by
       robotsValue(), the way a generated brand.js sets it in a browser. */
    ENGINE = { CMS: CMS, document: document, schema: CMS.sections.schema, sandbox: sandbox };
    return ENGINE;
}

/* The published sections a brand's committed layer holds, per slug.

   Only `status === "published"` counts, which is the same test the renderer
   applies -- a draft that found its way into brand.js is still not live and
   must not be baked. An empty published array IS published (the documented
   empty canvas) and is returned as []. */
function publishedSections(brandJsText) {
    const sandbox = { window: {}, self: null, console: { log() {}, warn() {}, error() {} } };
    sandbox.self = sandbox.window;
    vm.createContext(sandbox);
    try {
        vm.runInContext(String(brandJsText), sandbox,
                        { filename: 'brand.js', timeout: 5000 });
    } catch (e) {
        throw new Error('pbbake: brand.js could not be read: ' + e.message);
    }
    const data = sandbox.window.CMS_BRAND;
    const out = {};
    if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return out;
    Object.keys(data.pages).forEach(slug => {
        const b = (data.pages[slug] || {}).builder;
        if (!b || b.status !== 'published' || !Array.isArray(b.sections)) return;
        out[slug] = { sections: b.sections, schemaVersion: b.schemaVersion };
    });
    return out;
}

/* The published builder blocks in an arbitrary RECORD -- a Supabase row's
   `data`, or any object of the same shape -- by the same test
   publishedSections() applies to a committed layer. A record is a record
   whether it arrived as a file or over the wire, and having one function
   for both is what stops the build and the freshness check from ever
   disagreeing about what "published" means. */
function publishedFromRecord(data) {
    const out = {};
    if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return out;
    Object.keys(data.pages).forEach(slug => {
        const b = (data.pages[slug] || {}).builder;
        if (!b || b.status !== 'published' || !Array.isArray(b.sections)) return;
        out[slug] = { sections: b.sections, schemaVersion: b.schemaVersion };
    });
    return out;
}

/* The PAGE RECORDS in a record, for a build that has to turn them into
   files. A sibling of publishedFromRecord() above and deliberately not the
   same function: that one answers "what sections are published for this
   slug", this one answers "what pages does this brand have at all".

   WHAT COUNTS AS A PAGE. An object under `pages` with a usable identity.
   Nothing is computed and nothing is defaulted: the fields come through as
   the record holds them, so the caller sees the CMS's own values and not
   this file's opinion of them. A page whose `status` says 'draft' is left
   out -- that is the vocabulary the builder blocks above already use, and
   honouring it costs nothing; the full per-page lifecycle is not here.

   WHAT THIS DOES NOT DO. It does not decide which pages become files. A
   record names pages that already have committed templates, and reserved
   and colliding names have to be refused with a message naming the brand.
   All of that is the generator's job, in tools/lib/brandkit.js, where the
   template set is known. This is the reader. */
/* ------------------------------------------------------------
   IS THIS PAGE PUBLISHED?
   ------------------------------------------------------------
   The same word the builder blocks above already use, on the page record
   itself, and three rules rather than two:

     'published'      published.
     absent or empty  published. Every page record written before this
                      lifecycle existed has no status, and they are live
                      pages; reading them as drafts would unpublish a
                      brand's site on the next deploy.
     anything else    NOT published. 'draft' means draft, and so does a
                      typo, a stray value, or a word some later version of
                      the admin writes that this build does not know. The
                      asymmetry is the point: the cost of wrongly hiding a
                      page is a missing page, and the cost of wrongly
                      showing one is publishing something nobody approved.

   Compared case-insensitively and trimmed, because this value is typed by
   a person somewhere upstream.
   ------------------------------------------------------------ */
const PAGE_PUBLISHED = 'published';

function pageStatus(page) {
    const raw = (page && page.status != null) ? String(page.status).trim().toLowerCase() : '';
    if (raw === '' || raw === PAGE_PUBLISHED) return PAGE_PUBLISHED;
    return 'draft';
}

function pagesFromRecord(data) {
    const out = {};
    if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return out;
    Object.keys(data.pages).forEach(slug => {
        const p = data.pages[slug];
        if (!p || typeof p !== 'object') return;
        if (pageStatus(p) !== PAGE_PUBLISHED) return;
        out[slug] = p;
    });
    return out;
}

/* The ones left out, so a build can say so rather than a page quietly not
   being there. Each entry carries the status as written, because "draft"
   and "whatever this is" are different things to whoever has to fix it. */
function draftPagesFromRecord(data) {
    const out = [];
    if (!data || typeof data !== 'object' || !data.pages || typeof data.pages !== 'object') return out;
    Object.keys(data.pages).sort().forEach(slug => {
        const p = data.pages[slug];
        if (!p || typeof p !== 'object') return;
        if (pageStatus(p) === PAGE_PUBLISHED) return;
        out.push({ slug: slug, status: String(p.status == null ? '' : p.status),
                   url: typeof p.url === 'string' ? p.url : '' });
    });
    return out;
}

/* The RECORD a brand's committed layer declares, whole. publishedSections()
   above reads the same file for one part of it; this hands back all of it,
   because the SEO computations need seo.* as well as pages.*. */
function brandRecord(brandJsText) {
    const sandbox = { window: {}, self: null, console: { log() {}, warn() {}, error() {} } };
    sandbox.self = sandbox.window;
    vm.createContext(sandbox);
    try {
        vm.runInContext(String(brandJsText), sandbox, { filename: 'brand.js', timeout: 5000 });
    } catch (e) {
        throw new Error('pbbake: brand.js could not be read: ' + e.message);
    }
    const data = sandbox.window.CMS_BRAND;
    return data && typeof data === 'object' ? data : {};
}

/* ------------------------------------------------------------
   THE SEO VALUES A PAGE SHOULD CARRY, FROM THE ENGINE ITSELF
   ------------------------------------------------------------
   js/cms.js computes a page's title, description, canonical, robots,
   Open Graph, Twitter and JSON-LD and paints them into the document.
   CMS.seo.tags() is that same set as data -- one table, defined once,
   applied by paintSeo() in a browser and read here by a build.

   So there is nothing to compute in this file. It installs the record the
   browser would have and asks the engine. A title template, a description
   cascade, Twitter inheriting Open Graph, an image a crawler cannot fetch:
   every one of those decisions stays in the one place that already makes
   it, and the static HTML cannot therefore disagree with the page a
   visitor is served.

   THE RECORD. Exactly the browser's layering, through the engine's own
   merge: DEFAULTS < brands/<id>/brand.js < the published row. `env`
   carries what an environment build overrides -- the serving host's base
   URL, and whole-deployment noindex -- so a review host computes its own
   canonical rather than production's.
   ------------------------------------------------------------ */
const SEO_ENGINES = new Map();

function seoEngine(sharedRoot, opts) {
    opts = opts || {};
    const key = String(opts.key || '');
    /* A CACHE HIT STILL HAS TO RE-ESTABLISH THE RECORD.

       loadEngine() returns ONE engine per process, so every brand built in
       one process shares a single CMS and a single loaded record. Caching the
       {CMS, record} pair per brand avoided recomputing it, but the CMS it
       handed back carried whichever brand's record was replaced LAST -- so
       asking about brand A, then B, then A again answered with B's canonical,
       B's title and B's pages.

       Production never saw it: tools/build-site.js builds one brand per
       process. It mattered the moment anything asked about two brands in one
       process, which is exactly what a white-label test does. Replacing the
       record on the way out costs one assignment and makes the cached engine
       mean what its key says. */
    if (key && SEO_ENGINES.has(key)) {
        const hit = SEO_ENGINES.get(key);
        hit.CMS.replace(hit.record);
        return hit;
    }

    const eng = loadEngine(sharedRoot);
    const CMS = eng.CMS;
    if (!CMS.seo || typeof CMS.seo.tags !== 'function' || typeof CMS.merge !== 'function') {
        throw new Error('pbbake: js/cms.js loaded but CMS.seo.tags / CMS.merge are missing. ' +
                        'The build reads the engine\'s own SEO computations; it has no copy.');
    }

    const record = CMS.merge(opts.brand || {}, opts.row || {});
    /* An environment build is served from a host that is not the brand's
       canonical domain. js/cms.js is told so at runtime by the generated
       brand.js (envPatched); the same thing has to be true here, or a
       review host would bake production's canonical and og:url. */
    if (opts.baseUrl) {
        record.seo = CMS.merge(record.seo || {}, { baseUrl: opts.baseUrl });
    }
    CMS.replace(record);
    /* Read by robotsValue() and by nothing else. Set per engine, so a
       noindex build computes noindex,nofollow for every page. */
    eng.sandbox.CMS_NOINDEX = opts.noindex === true ? true : undefined;

    const out = { CMS: CMS, record: CMS.data() };
    if (key) SEO_ENGINES.set(key, out);
    return out;
}

/* The tag set for one page: { title, metas, links, jsonLd }, computed by
   CMS.seo.tags(). `breadcrumbNav` answers the one question the engine would
   have asked a document -- does this page show a breadcrumb trail -- which
   the caller knows from the template it is about to write. */
function seoTags(sharedRoot, opts, slug, pageOpts) {
    const eng = seoEngine(sharedRoot, opts);
    const page = eng.CMS.seo.page(slug);
    if (!page) return null;
    return eng.CMS.seo.tags(page, pageOpts || {});
}

/* One section array -> the markup and the scoped CSS the runtime produces.

   Upgraded through the engine's own migration chain first, so a block saved
   under an older schema bakes as the current renderer would draw it -- the
   same call publishedSections() makes at runtime. */
/* `ctx` is the render context the engine's listing element needs: the brand
   record whose pages it may list, and the slug being drawn. It is passed
   rather than discovered because this process shares one engine across every
   brand it builds -- an element that read ambient state would publish one
   brand's pages on another's site. With no ctx a listing renders nothing,
   which is the safe direction. */
function render(sharedRoot, block, ctx) {
    const eng = loadEngine(sharedRoot);
    const from = (block && typeof block.schemaVersion === 'number') ? block.schemaVersion : 1;
    const sections = eng.CMS.sections.upgrade(
        JSON.parse(JSON.stringify(block.sections || [])), from);
    const host = new Element('div');
    eng.CMS.sections.renderInto(host, sections, ctx || null);
    return { html: host.innerHTML, css: String(eng.CMS.sections.css(sections) || '') };
}

/* The record a visitor's browser would merge for this brand: its committed
   layer with the published row over it, on this environment's host. Exposed
   so a build can hand it to render() as the listing element's page source,
   instead of each caller merging its own and the two disagreeing. */
function recordFor(sharedRoot, opts) {
    return seoEngine(sharedRoot, opts).record;
}

/* The provenance declaration a brand's committed layer carries, or null.

   Read from the same evaluation brand.js gets everywhere else, so a file that
   cannot be evaluated fails once, in publishedSections(), rather than twice
   with two different messages. */
function readProvenance(brandJsText) {
    const sandbox = { window: {}, self: null, console: { log() {}, warn() {}, error() {} } };
    sandbox.self = sandbox.window;
    vm.createContext(sandbox);
    try {
        vm.runInContext(String(brandJsText), sandbox, { filename: 'brand.js', timeout: 5000 });
    } catch (e) {
        return null;
    }
    const p = sandbox.window.CMS_BRAND_PROVENANCE;
    if (!p || typeof p !== 'object') return null;
    return p;
}

/* The fingerprint of one published block, from the ENGINE's own function --
   the same one the admin used to record it and the same one
   tools/check-published.js uses against the live row. Deliberately not
   reimplemented here: three callers, one algorithm. */
function fingerprint(sharedRoot, block) {
    const eng = loadEngine(sharedRoot);
    return eng.CMS.sections.fingerprint(block);
}

/* ------------------------------------------------------------
   PART 1 OF THE SYNCHRONIZATION GUARD: OFFLINE INTEGRITY
   ------------------------------------------------------------
   Compares what the committed brand.js holds against what its provenance
   says it should hold. No network: everything needed is in the commit.

   Returns { status, problems, provenance }:
     'ok'           provenance present and every fingerprint matches
     'mismatch'     provenance present and something differs -- problems says
                    what, per page, and the caller fails the build
     'not-recorded' no provenance declaration; the caller WARNS and proceeds,
                    because every brand exported before this existed is in
                    that state and breaking them would be worse than the
                    problem this guard solves

   WHAT A CLEAN RESULT MEANS: the build source is the artifact the admin
   exported, for this brand. It does NOT mean the export is current. Only
   tools/check-published.js can say that, and only by asking Supabase.
   ------------------------------------------------------------ */
function verifyBuildSource(sharedRoot, brandJsText, expect) {
    const prov = readProvenance(brandJsText);
    const published = publishedSections(brandJsText);
    const slugs = Object.keys(published).sort();

    if (!prov) {
        return { status: 'not-recorded', problems: [], provenance: null, slugs: slugs };
    }

    const problems = [];
    const want = (prov.brand && typeof prov.brand === 'object') ? prov.brand : {};

    /* The brand first. A brand.js copied from another brand can hold a
       perfectly self-consistent set of fingerprints, so the only thing that
       catches it is checking WHOSE export this is. */
    if (expect && expect.siteId && String(want.siteId || '') !== String(expect.siteId)) {
        problems.push({
            kind: 'brand',
            page: null,
            detail: 'this brand.js was exported for row "' + String(want.siteId || '(none)') +
                    '", but this build is for row "' + expect.siteId + '"'
        });
    }

    const recorded = (prov.builder && typeof prov.builder === 'object') ? prov.builder : {};
    const recordedSlugs = Object.keys(recorded).sort();

    /* Every page the provenance recorded must still be published here, with
       the same sections. */
    recordedSlugs.forEach(slug => {
        if (!Object.prototype.hasOwnProperty.call(published, slug)) {
            problems.push({
                kind: 'missing',
                page: slug,
                detail: 'the export recorded published Page Builder content for this page, ' +
                        'but brand.js no longer publishes it'
            });
            return;
        }
        const got = fingerprint(sharedRoot, published[slug]);
        if (got !== String(recorded[slug])) {
            problems.push({
                kind: 'changed',
                page: slug,
                detail: 'the sections in brand.js do not match the export',
                recorded: String(recorded[slug]),
                actual: got
            });
        }
    });

    /* And nothing may be published that the export did not record. */
    slugs.forEach(slug => {
        if (!Object.prototype.hasOwnProperty.call(recorded, slug)) {
            problems.push({
                kind: 'extra',
                page: slug,
                detail: 'brand.js publishes Page Builder content for this page that the ' +
                        'export did not record'
            });
        }
    });

    return { status: problems.length ? 'mismatch' : 'ok',
             problems: problems, provenance: prov, slugs: slugs };
}

module.exports = {
    loadEngine: loadEngine,
    publishedSections: publishedSections,
    publishedFromRecord: publishedFromRecord,
    pagesFromRecord: pagesFromRecord,
    draftPagesFromRecord: draftPagesFromRecord,
    pageStatus: pageStatus,
    PAGE_PUBLISHED: PAGE_PUBLISHED,
    brandRecord: brandRecord,
    seoEngine: seoEngine,
    seoTags: seoTags,
    recordFor: recordFor,
    readProvenance: readProvenance,
    fingerprint: fingerprint,
    verifyBuildSource: verifyBuildSource,
    render: render
};
