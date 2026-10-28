#!/usr/bin/env node
/* =====================================================================
   BAKING THE CMS TITLE + META DESCRIPTION INTO THE SEVEN SHIPPED PAGES
   (G1)
   ---------------------------------------------------------------------
   The seven pages that ship with the site -- home, login, register,
   about, contact, responsible-gaming, privacy-policy -- carried their
   <title> and meta description as LITERAL template text, repainted only
   at runtime by js/cms.js. A crawler running no JavaScript read the
   fallback, not what the CMS published. Generic CMS-created pages did not
   have this gap, because they bake {{seo.title}} / {{seo.description}}
   from pbbake.seoTags().

   tools/lib/brandkit.js bakeHeadSeo() now closes it, as a post-render
   overlay keyed on the data-cms-title / data-cms-meta bindings -- the same
   identity js/cms.js uses -- reusing seoTags() and the seoTokenValues()
   precedence so the baked bytes equal what the generic path bakes and what
   the runtime recomputes.

   WHAT THIS SUITE PROVES, across jsk-1.com and playzone9.app:
     - a published CMS title/description is in the raw HTML <head>;
     - each brand gets its OWN title-template ("| JSK1" vs "| Playzone9");
     - an empty CMS field with a brand default bakes the default (which is
       exactly what the runtime shows), and an empty field with NO default
       leaves the template literal untouched -- never emptied;
     - the overlay changes ONLY <title> and the description meta: canonical,
       robots, Open Graph, Twitter and JSON-LD are byte-identical to a build
       without the feature;
     - login/register stay noindex; staging stays noindex and emits no
       sitemap; the generic-page path is unchanged;
     - no brand's title leaks into another's output;
     - the baked value equals what the page shows after JavaScript runs.

   The static assertions drive the REAL tools/build-site.js with --row, the
   way a deploy runs it; the runtime-agreement check drives a real browser.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));
const brandkit = require(path.join(ROOT, 'tools', 'lib', 'brandkit.js'));

/* The two tokens the committed templates carry in their <title> and
   description, resolved the way renderPage() resolves them. A page whose CMS
   field is empty and has no engine default keeps that token-substituted
   literal, so this is the reference the "literal preserved" assertions use --
   not the raw template text, which still holds the {{...}} tokens. */
const JSK_BRAND = brandkit.loadBrand(path.join(ROOT, 'brands'), 'jsk-1.com');
const subTokens = s => String(s == null ? '' : s)
  .replace(/\{\{brand\.name\}\}/g, JSK_BRAND.name)
  .replace(/\{\{brand\.domain\}\}/g, JSK_BRAND.domain);

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const tmpRoots = [];
function mktmp(tag) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'headbake-' + tag + '-')); tmpRoots.push(d); return d; }
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
function build(args) {
  try { return { ok: true, out: execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js')].concat(args),
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; }
  catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}
function walk(dir, base, out) {
  base = base || dir; out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) walk(f, base, out); else out.push(path.relative(base, f).split(path.sep).join('/'));
  }
  return out;
}
const titleOf = html => { const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html); return m ? m[1] : null; };
const descOf = (html, slug) => {
  const m = new RegExp('data-cms-meta="pages\\.' + slug + '\\.metaDescription"[^>]*?\\scontent="([^"]*)"').exec(html);
  return m ? m[1] : null;
};
const metaProp = (html, prop) => (new RegExp('<meta property="' + prop + '" content="([^"]*)"').exec(html) || [])[1];
const canonOf = html => (/<link rel="canonical" href="([^"]*)"/.exec(html) || [])[1];
const robotsOf = html => (/<meta name="robots" content="([^"]*)"/.exec(html) || [])[1];

const SEVEN = { index: 'home', login: 'login', register: 'register', about: 'about',
                contact: 'contact', 'responsible-gaming': 'responsible-gaming',
                'privacy-policy': 'privacy-policy' };

const ROWS = path.join(mktmp('rows'), 'r'); fs.mkdirSync(ROWS, { recursive: true });
function writeRow(brandId, mutate, file) {
  const base = JSON.parse(JSON.stringify(pbbake.brandRecord(
    fs.readFileSync(path.join(ROOT, 'brands', brandId, 'brand.js'), 'utf8'))));
  mutate(base);
  const p = path.join(ROWS, file);
  fs.writeFileSync(p, JSON.stringify({ data: base, updated_at: '2026-10-27T12:00:00+00:00' }, null, 1));
  return p;
}

/* Distinctive markers so a cross-brand leak cannot hide behind coincidental
   placeholder text. */
const MARK = { jsk: 'ZJSKMARK', pz: 'ZPZNMARK' };
function customize(tag) {
  return d => {
    d.pages.about.title = tag + ' About Headline';
    d.pages.about.metaDescription = tag + ' about description text.';
    d.pages['responsible-gaming'].title = tag + ' RG Headline';
    d.pages['responsible-gaming'].metaDescription = tag + ' rg description.';
    d.pages.home.title = tag + ' Home Headline';
    /* contact left empty on purpose: brand default path. */
    d.pages.contact.title = '';
    d.pages.contact.metaDescription = '';
  };
}

/* ====================================================================
   1. A PUBLISHED CMS TITLE/DESCRIPTION IS IN THE RAW HTML, PER BRAND
   ==================================================================== */
console.log('\n===== THE CMS VALUE IS BAKED INTO THE RAW HEAD, WITH EACH BRAND\'S TEMPLATE =====');
const jskRow = writeRow('jsk-1.com', customize(MARK.jsk), 'jsk.json');
const pzRow = writeRow('playzone9.app', customize(MARK.pz), 'pz.json');
const jskOut = mktmp('jsk'); const pzOut = mktmp('pz');
{
  const rj = build(['jsk-1.com', '--row', rel(jskRow), '--out', jskOut]);
  const rp = build(['playzone9.app', '--row', rel(pzRow), '--out', pzOut]);
  check('jsk-1.com build succeeds', rj.ok, rj.out.slice(-400));
  check('playzone9.app build succeeds', rp.ok, rp.out.slice(-400));

  const jAbout = read(path.join(jskOut, 'jsk-1.com', 'about.html'));
  const pAbout = read(path.join(pzOut, 'playzone9.app', 'about.html'));
  check('jsk-1.com about <title> carries the CMS title + its own template',
    titleOf(jAbout) === MARK.jsk + ' About Headline | JSK1', titleOf(jAbout));
  check('  and the CMS description',
    descOf(jAbout, 'about') === MARK.jsk + ' about description text.', descOf(jAbout, 'about'));
  check('playzone9.app about <title> carries the CMS title + ITS OWN template',
    titleOf(pAbout) === MARK.pz + ' About Headline | Playzone9', titleOf(pAbout));
  check('  so the per-brand title template is applied, not a shared one',
    titleOf(jAbout).endsWith('| JSK1') && titleOf(pAbout).endsWith('| Playzone9'));

  const jHome = read(path.join(jskOut, 'jsk-1.com', 'index.html'));
  check('home bakes the CMS title too', titleOf(jHome) === MARK.jsk + ' Home Headline | JSK1', titleOf(jHome));
  const jRg = read(path.join(jskOut, 'jsk-1.com', 'responsible-gaming.html'));
  check('responsible-gaming bakes title + description',
    titleOf(jRg) === MARK.jsk + ' RG Headline | JSK1' &&
    descOf(jRg, 'responsible-gaming') === MARK.jsk + ' rg description.',
    [titleOf(jRg), descOf(jRg, 'responsible-gaming')]);

  check('every one of the seven pages exists in the build',
    Object.keys(SEVEN).every(f => fs.existsSync(path.join(jskOut, 'jsk-1.com', f + '.html'))));
}

/* ====================================================================
   2. EMPTY CMS FIELD -> BRAND DEFAULT (AND IT MATCHES THE RUNTIME)
   ==================================================================== */
console.log('\n===== AN EMPTY FIELD WITH A BRAND DEFAULT BAKES THE DEFAULT =====');
{
  const jContact = read(path.join(jskOut, 'jsk-1.com', 'contact.html'));
  /* jsk-1.com sets seo.defaultTitle, so computeTitle() returns it for an
     empty page title -- which is exactly what paintSeo() sets at runtime.
     The bake records the same value, so static and DOM agree rather than
     diverging. */
  const engineTitle = (() => {
    const CMS = pbbake.loadEngine(ROOT).CMS;
    const rec = JSON.parse(fs.readFileSync(jskRow, 'utf8')).data;
    CMS.replace(rec);
    return CMS.seo.title(rec.pages.contact);
  })();
  check('contact (empty CMS title) baked the engine/default title, not blank',
    titleOf(jContact) && titleOf(jContact).length > 0, titleOf(jContact));
  check('  the baked contact title equals CMS.seo.title() (baked == runtime)',
    titleOf(jContact) === htmlEsc(engineTitle), [titleOf(jContact), htmlEsc(engineTitle)]);
}
function htmlEsc(v) { return String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ====================================================================
   3. EMPTY CMS FIELD + NO DEFAULT -> TEMPLATE LITERAL PRESERVED
   ==================================================================== */
console.log('\n===== WITH NO ENGINE FALLBACK, THE TEMPLATE LITERAL IS LEFT ALONE =====');
{
  const ndRow = writeRow('jsk-1.com', d => {
    d.seo = d.seo || {}; d.seo.defaultTitle = ''; d.seo.defaultDescription = '';
    d.pages.about.title = ''; d.pages.about.metaDescription = '';
  }, 'nd.json');
  const ndOut = mktmp('nd');
  const r = build(['jsk-1.com', '--row', rel(ndRow), '--out', ndOut]);
  check('the no-default build succeeds', r.ok, r.out.slice(-400));
  /* The committed template's own literal, read from the template so the test
     is not pinned to a hand-copied string. */
  const tpl = read(path.join(ROOT, 'templates', 'pages', 'about.html'));
  /* The expected literal is the template's own text with {{brand.*}} resolved
     the way renderPage() resolves it -- i.e. exactly what ships when the bake
     makes no change. */
  const litTitle = subTokens(titleOf(tpl));
  const litDesc = subTokens(descOf(tpl, 'about'));
  const got = read(path.join(ndOut, 'jsk-1.com', 'about.html'));
  check('an empty field with no default leaves the <title> literal untouched',
    titleOf(got) === litTitle, [titleOf(got), litTitle]);
  check('  and the description literal untouched (never emptied)',
    descOf(got, 'about') === litDesc && (litDesc || '').length > 0, [descOf(got, 'about'), litDesc]);
}

/* ====================================================================
   4. ONLY <title> AND DESCRIPTION CHANGE — EVERYTHING ELSE BYTE-IDENTICAL
   ==================================================================== */
console.log('\n===== CANONICAL, ROBOTS, OG, TWITTER, JSON-LD, BODY ARE UNCHANGED =====');
{
  /* A build of the SAME row with the feature neutralised is not available
     from here, so instead: for each page, assert the head's non-title/non-desc
     SEO tags still carry the correct per-brand values, and that the file
     differs from a no-row (defaults) build ONLY on title/description lines. */
  const defOut = mktmp('def');
  build(['jsk-1.com', '--out', defOut]);   /* committed-defaults build (no --row) */
  for (const f of Object.keys(SEVEN)) {
    const slug = SEVEN[f];
    const withRow = read(path.join(jskOut, 'jsk-1.com', f + '.html'));
    const defaults = read(path.join(defOut, 'jsk-1.com', f + '.html'));
    /* canonical/robots/og:url identical between the two builds (title/desc
       are the only things the row changed for these pages). */
    check(f + ': canonical unchanged by baking', canonOf(withRow) === canonOf(defaults), [canonOf(withRow), canonOf(defaults)]);
    check(f + ': robots unchanged by baking', robotsOf(withRow) === robotsOf(defaults), [robotsOf(withRow), robotsOf(defaults)]);
    check(f + ': og:url unchanged by baking', metaProp(withRow, 'og:url') === metaProp(defaults, 'og:url'));
    /* the diff between the two builds touches ONLY <title> and the
       description meta lines. */
    const a = defaults.split('\n'), b = withRow.split('\n');
    const changed = [];
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) changed.push((b[i] || a[i]));
    const onlyHead = changed.every(l => /<title\b/.test(l) || /data-cms-meta="pages\./.test(l));
    check(f + ': the ONLY lines the bake changed are <title> and the description meta',
      onlyHead, changed.slice(0, 4));
  }
  /* canonical/robots stay correct and absolute on the baked file. */
  check('canonical is the absolute production URL on a baked page',
    canonOf(read(path.join(jskOut, 'jsk-1.com', 'about.html'))) === 'https://jsk-1.com/about.html');
}

/* ====================================================================
   5. LOGIN/REGISTER NOINDEX INTACT; STAGING NOINDEX + NO SITEMAP
   ==================================================================== */
console.log('\n===== NOINDEX AND STAGING BEHAVIOUR UNCHANGED =====');
{
  for (const f of ['login', 'register']) {
    check(f + ' stays noindex,follow after baking',
      robotsOf(read(path.join(jskOut, 'jsk-1.com', f + '.html'))) === 'noindex,follow',
      robotsOf(read(path.join(jskOut, 'jsk-1.com', f + '.html'))));
  }
  /* Staging / review hosts are noindex and ship no sitemap, so the bake has
     no SEO value there; and CMS-authored copy can embed the brand's own
     PRODUCTION domain as literal text, which the assembled-site check forbids
     anywhere on a review host. So the bake is skipped on a noindex host: the
     template literal ships (its {{brand.domain}} resolves to the review
     host), the reserved-domain invariant holds, and the build still passes.
     A staging build whose row DOES carry CMS titles is the sharp test -- it
     would have failed before the skip. */
  const stgOut = mktmp('stg');
  const rs = build(['playzone9.app', '--env', 'staging', '--row', rel(pzRow), '--out', stgOut]);
  check('staging build succeeds even with CMS titles in the row (bake skipped on noindex host)',
    rs.ok, rs.out.slice(-400));
  const stgDir = path.join(stgOut, 'playzones9.com');
  check('staging about is noindex,nofollow (baking did not touch robots)',
    robotsOf(read(path.join(stgDir, 'about.html'))) === 'noindex,nofollow',
    robotsOf(read(path.join(stgDir, 'about.html'))));
  check('staging does NOT bake the CMS title; it keeps the template literal',
    titleOf(read(path.join(stgDir, 'about.html'))) !== MARK.pz + ' About Headline | Playzone9' &&
    (titleOf(read(path.join(stgDir, 'about.html'))) || '').length > 0,
    titleOf(read(path.join(stgDir, 'about.html'))));
  check('staging output never mentions the reserved production domain',
    walk(stgDir).filter(f => /\.html$/.test(f))
      .every(f => read(path.join(stgDir, f)).indexOf('playzone9.app') === -1));
  check('staging emits NO sitemap.xml', !fs.existsSync(path.join(stgDir, 'sitemap.xml')));
  check('staging canonical is the staging host', canonOf(read(path.join(stgDir, 'about.html'))) === 'https://playzones9.com/about.html');
}

/* ====================================================================
   6. SITEMAP + GENERIC PAGE PATH UNCHANGED; NO CROSS-BRAND LEAK
   ==================================================================== */
console.log('\n===== SITEMAP, GENERIC PAGES, AND BRAND ISOLATION =====');
{
  const sm = read(path.join(jskOut, 'jsk-1.com', 'sitemap.xml'));
  check('sitemap still lists the indexable pages and excludes noindex',
    sm.indexOf('/about.html') > -1 && sm.indexOf('/login.html') === -1 && sm.indexOf('/register.html') === -1, sm.slice(0, 80));

  /* Generic CMS page still bakes as before. */
  const genRow = writeRow('jsk-1.com', d => {
    d.pages['promo-x'] = { label: 'Promo', url: 'promo-x.html', slug: 'promo-x',
      title: 'Promo X Title', metaDescription: 'Promo X description.', canonical: '',
      robots: { index: true, follow: true }, heading: 'Promo', lead: '', body: '',
      og: { title: '', description: '', image: '' }, twitter: {}, breadcrumb: { label: 'Promo', show: true },
      schema: { webPage: true, breadcrumb: true }, inSitemap: true, status: 'published',
      updatedAt: '2026-10-27', builderMount: true, type: 'article',
      builder: { status: 'published', schemaVersion: 2, updatedAt: '2026-10-27',
        sections: [{ id: 's1', type: 'text', enabled: true, visibility: { desktop: true, tablet: true, mobile: true },
          style: {}, responsive: {}, elements: [{ id: 'e1', type: 'heading', content: { text: 'P', level: 'h2' }, style: {}, responsive: {} }] }] } };
  }, 'gen.json');
  const genOut = mktmp('gen');
  const rg = build(['jsk-1.com', '--row', rel(genRow), '--out', genOut]);
  check('generic CMS page build succeeds', rg.ok, rg.out.slice(-400));
  const gen = read(path.join(genOut, 'jsk-1.com', 'promo-x.html'));
  check('generic CMS page still bakes its title from the record',
    titleOf(gen) === 'Promo X Title | JSK1', titleOf(gen));
  check('  its description', descOf(gen, 'promo-x') === 'Promo X description.');
  check('  its og:type=article', metaProp(gen, 'og:type') === 'article');

  /* Brand isolation: neither brand's distinctive marker appears in the other. */
  const jskAll = walk(path.join(jskOut, 'jsk-1.com')).filter(f => /\.html$/.test(f))
    .map(f => read(path.join(jskOut, 'jsk-1.com', f))).join('\n');
  const pzAll = walk(path.join(pzOut, 'playzone9.app')).filter(f => /\.html$/.test(f))
    .map(f => read(path.join(pzOut, 'playzone9.app', f))).join('\n');
  check('playzone9 marker never appears in jsk-1.com output', jskAll.indexOf(MARK.pz) === -1);
  check('jsk-1.com marker never appears in playzone9 output', pzAll.indexOf(MARK.jsk) === -1);
}

/* ====================================================================
   7. BAKED == RUNTIME (a real browser)
   ==================================================================== */
(async () => {
  console.log('\n===== THE BAKED TITLE/DESCRIPTION IS WHAT THE PAGE SHOWS AFTER JS =====');
  const siteDir = path.join(jskOut, 'jsk-1.com');
  const ORIGIN = 'https://jsk-1.com';
  const row = JSON.parse(fs.readFileSync(jskRow, 'utf8')).data;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (/supabase\.co$/.test(u.hostname))
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([{ data: row, updated_at: '2026-10-27T12:00:00+00:00' }]) });
    if (u.origin !== ORIGIN) return route.fulfill({ status: 204, body: '' });
    const f = path.join(siteDir, u.pathname.replace(/^\/+/, '') || 'index.html');
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
    const ext = path.extname(f).toLowerCase();
    const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.css' ? 'text/css'
      : ext === '.js' ? 'application/javascript' : ext === '.png' ? 'image/png'
      : ext === '.json' ? 'application/json' : 'text/plain';
    return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  for (const f of ['about.html', 'responsible-gaming.html', 'index.html']) {
    const bakedTitle = titleOf(read(path.join(siteDir, f)));
    await p.goto(ORIGIN + '/' + f, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const domTitle = await p.evaluate(() => document.title);
    const bakedUnesc = bakedTitle.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    check(f + ': runtime document.title equals the baked <title>',
      domTitle === bakedUnesc, [domTitle, bakedUnesc]);
    const slug = f === 'index.html' ? 'home' : f.replace(/\.html$/, '');
    const bakedDesc = descOf(read(path.join(siteDir, f)), slug);
    if (bakedDesc) {
      const domDesc = await p.evaluate(() => {
        const m = document.querySelector('meta[name="description"]'); return m ? m.getAttribute('content') : null; });
      const bakedDescUnesc = bakedDesc.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
      check('  and the runtime meta description equals the baked one', domDesc === bakedDescUnesc, [domDesc, bakedDescUnesc]);
    }
  }
  check('no browser/page errors during runtime-agreement check', errs.length === 0, errs.slice(0, 3));
  await b.close();

  for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
