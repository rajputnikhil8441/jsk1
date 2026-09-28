'use strict';
/* =====================================================================
   THE PAGE SHELL, WITHOUT THE PUBLISHED PAGE BUILDER CONTENT
   ---------------------------------------------------------------------
   Three suites -- test_generator, test_assembly, test_multibrand -- make
   byte-for-byte claims about what the generator produces. They were
   written when brands/jsk-1.com/brand.js carried no published Page
   Builder content, so "the generated page" and "the page shell" were the
   same bytes and the distinction never had to exist.

   They are not the same bytes any more. The build bakes a brand's
   published sections into the mount, which is the entire point of it:

       <div data-cms-sections="about"></div>
       <div data-cms-sections="about" data-cms-baked="1">…the content…</div>

   plus a scoped <style id="cmsBuilder"> for the elements it drew. Those
   two places are brand CONTENT. Everything else on the page -- the head,
   the SEO tags, the shell, the footer, every byte the template controls
   -- must still be identical to what Phase 0 froze, and to what another
   brand's build produces with its own strings swapped in.

   So the claims are split rather than loosened. This builds the brand a
   second time from a copy of its layer with the published blocks
   removed, and that build is what the fixtures and the cross-brand
   projection are compared against. The content those builds leave out is
   then asserted directly, so nothing is quietly excused: what is baked
   is checked, and what is not baked is checked byte for byte.

   Removing the blocks is done by evaluating the brand layer and
   re-serialising it, which changes js/brand.js's bytes -- the shell
   build's js/brand.js is therefore not comparable and its callers do not
   compare it. The real invariant for that file, that the build emits the
   brand's committed layer unchanged, is asserted against the REAL build.
   ===================================================================== */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* Evaluate a committed brand layer the way every other reader does. */
function readBrand(file) {
    const sandbox = { window: {}, self: null, console: { log() {}, warn() {}, error() {} } };
    sandbox.self = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: path.basename(file) });
    return sandbox.window.CMS_BRAND || {};
}

/* A copy of `brandsDir` in which every brand publishes no Page Builder
   content. Returns the new directory. */
function shellBrandsDir(brandsDir, into) {
    fs.cpSync(brandsDir, into, { recursive: true });
    for (const id of fs.readdirSync(into)) {
        const file = path.join(into, id, 'brand.js');
        if (!fs.existsSync(file)) continue;
        const data = readBrand(file);
        Object.keys(data.pages || {}).forEach(slug => { delete data.pages[slug].builder; });
        fs.writeFileSync(file, 'window.CMS_BRAND = ' + JSON.stringify(data, null, 2) + ';\n');
    }
    return into;
}

/* { slug: sectionCount } for the pages a brand publishes. */
function publishedBlocks(brandsDir, id) {
    const file = path.join(brandsDir, id, 'brand.js');
    if (!fs.existsSync(file)) return {};
    const data = readBrand(file);
    const out = {};
    Object.keys(data.pages || {}).forEach(slug => {
        const b = (data.pages[slug] || {}).builder;
        if (b && b.status === 'published' && Array.isArray(b.sections)) out[slug] = b.sections.length;
    });
    return out;
}

/* What the bake did to one page, as a structural delta rather than a
   line diff: the scoped style tag is an INSERTED line, so a plain
   line-by-line comparison would report every line after it as changed
   and prove nothing.

   Returns { styles, changed, aligned }:
     styles   the <style id="cmsBuilder"> lines the bake inserted
     changed  [{ line, shell, baked }] for every other difference, which
              on a correct bake is exactly the mount line
     aligned  false when the two builds do not line up even after the
              inserted styles are accounted for, which is itself a
              failure the caller must report rather than ignore */
function bakedDelta(shellHtml, bakedHtml) {
    const shell = shellHtml.split('\n');
    const baked = bakedHtml.split('\n');
    const styles = [];
    const rest = [];
    baked.forEach(l => { (/<style id="cmsBuilder">/.test(l) ? styles : rest).push(l); });
    if (rest.length !== shell.length) {
        return { styles: styles, changed: [], aligned: false,
                 detail: shell.length + ' shell lines vs ' + rest.length + ' baked lines' };
    }
    const changed = [];
    for (let i = 0; i < shell.length; i++) {
        if (shell[i] !== rest[i]) changed.push({ line: i + 1, shell: shell[i], baked: rest[i] });
    }
    return { styles: styles, changed: changed, aligned: true };
}

module.exports = {
    readBrand: readBrand,
    shellBrandsDir: shellBrandsDir,
    publishedBlocks: publishedBlocks,
    bakedDelta: bakedDelta
};
