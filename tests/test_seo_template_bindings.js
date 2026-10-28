#!/usr/bin/env node
/* =====================================================================
   EVERY COMMITTED TEMPLATE CARRIES ITS SEO BINDINGS, AND THEY BAKE
   ---------------------------------------------------------------------
   brandkit.bakeHeadSeo() (G1) bakes a committed page's CMS <title> and
   meta description into the raw <head>, but it is keyed on the page's own
   data-cms-title / data-cms-meta bindings: the loop in planBrand() reads
   the slug out of data-cms-title and, finding none, bakes nothing
   (tools/lib/brandkit.js, `if (slug)` around the seoTags() call). The
   runtime repaint in js/cms.js (paintSeo / paintPageMeta) keys on the SAME
   bindings. So a committed template that forgets them gets no baked SEO AND
   no runtime repaint -- silently, with the literal fallback masking it.

   test_seo_head_bake.js proves the seven pages that exist today bake
   correctly, but it names them explicitly, so it cannot see a NEW template
   added without the bindings. This suite closes that: it enumerates every
   file under templates/pages/ (so a future template is covered the moment
   it is committed) and asserts, for each:

     1. it carries both data-cms-title and data-cms-meta bindings, naming
        the same slug -- UNLESS it is an explicitly justified exemption;
     2. an exemption is genuinely an error/utility page (noindex) and really
        does lack the bindings, so the list cannot quietly hide a real
        content page that is missing its SEO;
     3. with the CMS record carrying a per-page sentinel title/description,
        the built page's raw <title> and description meta actually contain
        that sentinel -- i.e. the binding results in a real bake into the
        initial HTML, end to end, for every template and across brands,
        with no brand's sentinel leaking into another's output.

   It drives the real tools/build-site.js with --row, the way a deploy runs
   it. It changes no production file; a failure here means a template is
   missing its SEO wiring, which is the defect to catch.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const tmpRoots = [];
function mktmp(tag) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tplbind-' + tag + '-')); tmpRoots.push(d); return d; }
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
function build(args) {
  try { return { ok: true, out: execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js')].concat(args),
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}
const titleOf = html => { const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html); return m ? m[1] : null; };
const descOf = (html, slug) => {
  const m = new RegExp('data-cms-meta="pages\\.' + slug + '\\.metaDescription"[^>]*?\\scontent="([^"]*)"').exec(html);
  return m ? m[1] : null;
};
/* The robots directive declared in a template's own source. */
const robotsOf = html => (/<meta name="robots" content="([^"]*)"/.exec(html) || [])[1];

/* The one rule the build itself uses to decide a file under templates/pages/
   is a committed page (tools/lib/brandkit.js PAGE_NAME_RE). */
const PAGE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,60}\.html$/;
const TEMPLATES_DIR = path.join(ROOT, 'templates', 'pages');

/* Templates that are deliberately NOT CMS-SEO-managed. Each entry states
   why. A template is required to carry the bindings unless it is listed
   here, so a FUTURE template is required by default and an exemption is a
   conscious, documented decision -- never the silent absence the bake would
   otherwise hide. The assertions below also confirm each exemption is really
   an error/utility page (noindex) that really lacks the bindings, so this
   list cannot be abused to wave through a genuine content page. */
const EXEMPT = {
  '404.html': 'error page: a static noindex,follow fallback served for unknown ' +
    'URLs (its own head comment says so). There is no single CMS page record it ' +
    'maps to, so it carries literal fallback SEO and no data-cms-* bindings.'
};

const titleBindSlug = html => (/<title\b[^>]*\bdata-cms-title="pages\.([a-z0-9-]+)\.title"/.exec(html) || [])[1] || null;
const metaBindSlug = html => (/\bdata-cms-meta="pages\.([a-z0-9-]+)\.metaDescription"/.exec(html) || [])[1] || null;

/* ====================================================================
   1. EVERY COMMITTED TEMPLATE DECLARES ITS SEO BINDINGS
   ==================================================================== */
console.log('\n===== EVERY TEMPLATE UNDER templates/pages/ CARRIES ITS data-cms-* BINDINGS =====');
const templateFiles = fs.readdirSync(TEMPLATES_DIR).filter(f => PAGE_NAME_RE.test(f)).sort();
check('there are committed templates to check', templateFiles.length > 0, templateFiles);

const bound = [];   /* { file, slug } for every non-exempt template */
for (const f of templateFiles) {
  const src = read(path.join(TEMPLATES_DIR, f));
  const tSlug = titleBindSlug(src);
  const mSlug = metaBindSlug(src);
  if (Object.prototype.hasOwnProperty.call(EXEMPT, f)) {
    /* An exemption must be honest: an error/utility page that is noindex and
       really does omit the bindings. If someone adds bindings to it later,
       or makes it indexable, the exemption should be revisited -- so assert,
       don't assume. */
    check(f + ': EXEMPT and really lacks the CMS bindings (' + EXEMPT[f].split(':')[0] + ')',
      !tSlug && !mSlug, { tSlug: tSlug, mSlug: mSlug });
    check(f + ': EXEMPT template is noindex, so dropping the bindings cannot cost indexable SEO',
      /noindex/.test(robotsOf(src) || ''), robotsOf(src));
    continue;
  }
  check(f + ': carries a data-cms-title="pages.<slug>.title" binding', !!tSlug, tSlug);
  check(f + ': carries a data-cms-meta="pages.<slug>.metaDescription" binding', !!mSlug, mSlug);
  check(f + ': the title and description bindings name the SAME slug', tSlug && tSlug === mSlug, [tSlug, mSlug]);
  if (tSlug && tSlug === mSlug) bound.push({ file: f, slug: tSlug });
}
check('at least the known content pages are bound', bound.length >= 7, bound.map(b => b.slug));

/* ====================================================================
   2. THE BINDINGS ACTUALLY BAKE -- PER-PAGE SENTINELS, TWO BRANDS
   ====================================================================
   Give every bound page a unique title/description in the CMS record and
   confirm the built page's raw <head> carries it. A template missing its
   bindings would ship the literal fallback instead and the sentinel would be
   absent -- which is exactly the regression this proves is impossible. */
console.log('\n===== THE BINDINGS BAKE THE CMS TITLE/DESCRIPTION INTO THE INITIAL HTML =====');
const ROWS = mktmp('rows');

/* A brand's committed record with a sentinel title/description written onto
   every bound page that the record actually has. Builder blocks are left
   untouched so the build does not refuse "emptied" content. */
function sentinelRow(brandId, mark) {
  const rec = JSON.parse(JSON.stringify(pbbake.brandRecord(
    fs.readFileSync(path.join(ROOT, 'brands', brandId, 'brand.js'), 'utf8'))));
  const covered = [];
  for (const b of bound) {
    if (rec.pages && rec.pages[b.slug]) {
      rec.pages[b.slug].title = 'TTL' + mark + b.slug.replace(/-/g, '') + 'ZQ';
      rec.pages[b.slug].metaDescription = 'DSC' + mark + b.slug.replace(/-/g, '') + 'ZQ';
      covered.push(b);
    }
  }
  const p = path.join(ROWS, brandId.replace(/\W/g, '_') + '.json');
  fs.writeFileSync(p, JSON.stringify({ data: rec, updated_at: '2026-10-28T12:00:00+00:00' }, null, 1));
  return { row: p, covered: covered };
}

function sentinel(kind, mark, slug) { return kind + mark + slug.replace(/-/g, '') + 'ZQ'; }

const BRANDS = [
  { id: 'jsk-1.com', mark: 'JSKZ', host: 'jsk-1.com' },
  { id: 'playzone9.app', mark: 'PZNZ', host: 'playzone9.app' }
];
const outputs = {};
for (const brand of BRANDS) {
  const { row, covered } = sentinelRow(brand.id, brand.mark);
  const out = mktmp(brand.id.replace(/\W/g, '-'));
  const r = build([brand.id, '--row', rel(row), '--out', out]);
  check(brand.id + ': build with sentinel SEO succeeds', r.ok, r.out.slice(-300));
  const siteDir = path.join(out, brand.host);
  outputs[brand.id] = { siteDir: siteDir, covered: covered, mark: brand.mark };
  check(brand.id + ': every bound page that the record carries was given a sentinel', covered.length >= 7, covered.length);
  for (const b of covered) {
    const html = read(path.join(siteDir, b.file));
    const t = titleOf(html);
    const d = descOf(html, b.slug);
    check(brand.id + ' / ' + b.file + ': the CMS title is baked into the raw <title>',
      t != null && t.indexOf(sentinel('TTL', brand.mark, b.slug)) > -1, t);
    check(brand.id + ' / ' + b.file + ': the CMS description is baked into the raw meta',
      d != null && d.indexOf(sentinel('DSC', brand.mark, b.slug)) > -1, d);
  }
}

/* ====================================================================
   3. NO BRAND'S SENTINEL LEAKS INTO ANOTHER BRAND'S OUTPUT
   ==================================================================== */
console.log('\n===== PER-BRAND SEO STAYS INSIDE ITS OWN BRAND =====');
function allHtml(siteDir) {
  return fs.readdirSync(siteDir).filter(f => /\.html$/.test(f))
    .map(f => read(path.join(siteDir, f))).join('\n');
}
{
  const jsk = allHtml(outputs['jsk-1.com'].siteDir);
  const pzn = allHtml(outputs['playzone9.app'].siteDir);
  check('playzone9 sentinels never appear in jsk-1.com output', jsk.indexOf('PZNZ') === -1);
  check('jsk-1.com sentinels never appear in playzone9 output', pzn.indexOf('JSKZ') === -1);
}

/* ====================================================================
   4. THE EXEMPT TEMPLATE STILL BUILDS AS A PLAIN NOINDEX FALLBACK
   ==================================================================== */
console.log('\n===== AN EXEMPT TEMPLATE SHIPS ITS LITERAL FALLBACK, UNTOUCHED =====');
for (const f of Object.keys(EXEMPT)) {
  const built = read(path.join(outputs['jsk-1.com'].siteDir, f));
  check(f + ': the exempt template is still generated', built.length > 0);
  check(f + ': it is noindex in the built HTML', /noindex/.test(robotsOf(built) || ''), robotsOf(built));
  check(f + ': it carries no sentinel (nothing was baked onto it)', built.indexOf('JSKZ') === -1);
}

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
