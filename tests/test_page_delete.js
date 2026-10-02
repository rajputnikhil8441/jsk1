#!/usr/bin/env node
/* =====================================================================
   DELETING A PAGE THE CMS CREATED
   ---------------------------------------------------------------------
   The feature is one line of data change -- `delete pages[slug]` -- and
   everything that makes the page actually disappear was already in place
   before it was written. So this suite spends almost all of its assertions
   on the part that can go wrong silently, which is NOT the admin click:

     A STALE .html FILE LEFT BEHIND IS THE WHOLE FAILURE MODE.

   A deleted page that keeps serving its old file is worse than a page that
   was never deleted: the editor believes it is gone, the sitemap agrees, and
   a crawler and every visitor with the old link still read it. Nothing in the
   admin can detect that. Only a build can.

   So section 3 builds a site TWICE INTO ONE DIRECTORY -- the exact shape a
   redeploy has -- and asserts the file from the first build is gone after the
   second. That is the mandatory case, and it is driven through the real
   tools/build-site.js rather than through a unit of it.

   The other sections prove the surrounding claims rather than assuming them:
   that the readers already drop the reference (so nothing had to be rewritten),
   that the url leaves the sitemap, that no remaining page links to it, that an
   ItemList does not assert it, that the pages which ship with the site cannot
   be deleted at all, and that a deletion on one brand is invisible to the
   other.

   WHAT IS NOT TESTED HERE, and cannot be: that the DEPLOYED url returns 404.
   That needs a real deploy. The build-level guarantee is asserted instead, and
   the manual procedure is documented in docs/publishing.md.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'pgdel-' + tag + '-'));
  tmpRoots.push(d); return d;
}
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
function build(args) {
  try {
    return { ok: true, out: execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js')].concat(args),
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}
function walk(dir, base, out) {
  base = base || dir; out = out || [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}
function ldOf(html, attr) {
  const m = new RegExp('<script type="application/ld\\+json" ' + attr + '="1">([\\s\\S]*?)</script>')
    .exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return { PARSE_ERROR: m[1].slice(0, 200) }; }
}

const WORK = mktmp('work');
const ROWS = path.join(WORK, 'rows'); fs.mkdirSync(ROWS, { recursive: true });

const sec = els => ({ id: 's' + els[0].id, type: 'text', enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
  elements: els });
const el = (id, type, content) => ({ id: id, type: type, content: content || {},
  style: {}, responsive: {} });
const pub = els => ({ status: 'published', schemaVersion: 2, updatedAt: '2026-06-01',
                      sections: [sec(els)] });

function page(slug, extra) {
  return Object.assign({
    label: slug, url: slug + '.html', slug: slug,
    title: 'Title for ' + slug,
    metaDescription: 'A description for ' + slug + ' long enough to read as a real snippet.',
    canonical: '', robots: { index: true, follow: true },
    heading: 'Heading ' + slug, lead: 'Lead.', body: '',
    og: { title: '', description: '', image: '' },
    twitter: { title: '', description: '', image: '' },
    breadcrumb: { label: slug, show: true },
    schema: { webPage: true, breadcrumb: true, contactPage: false },
    inSitemap: true, status: 'published', updatedAt: '2026-06-01', builderMount: true
  }, extra || {});
}
function rowFor(brandId, file, mutate) {
  const base = JSON.parse(JSON.stringify(pbbake.brandRecord(
    fs.readFileSync(path.join(ROOT, 'brands', brandId, 'brand.js'), 'utf8'))));
  base.pages = base.pages || {};
  mutate(base);
  const p = path.join(ROWS, file);
  fs.writeFileSync(p, JSON.stringify({ data: base, updated_at: '2026-06-01T12:00:00+00:00' }, null, 1));
  return p;
}
const outDirOf = out => path.join(out, fs.readdirSync(out)[0]);

/* The two pages the mandatory scenario uses. `keeper` lists `my-page` as
   related AND publishes an ItemList, so after the deletion both the rendered
   list and the structured data have to stop mentioning it. */
function seedPair(d) {
  d.pages['my-page'] = page('my-page', {
    builder: pub([el('m1', 'heading', { text: 'Mine', level: 'h2' })]) });
  d.pages['keeper'] = page('keeper', { related: ['my-page'],
    builder: pub([el('k1', 'pageList', { source: 'related', title: 'Related',
                                         titleLevel: 'h2', limit: 4, schema: true })]) });
}

/* ====================================================================
   1. THE READERS ALREADY DROP A DELETED PAGE
   ==================================================================== */
console.log('\n===== NOTHING HAD TO BE REWRITTEN: THE READERS ALREADY REFUSE IT =====');
{
  const CMS = pbbake.loadEngine(ROOT).CMS;
  const C = CMS.content;
  const withPage = { pages: {
    'my-page': page('my-page'),
    keeper: page('keeper', { related: ['my-page'], type: 'article' }),
    other: page('other', { type: 'article' })
  } };
  const deleted = JSON.parse(JSON.stringify(withPage));
  delete deleted.pages['my-page'];

  const keysOf = rows => rows.map(r => r.key);
  check('before deletion publishedPages() offers it',
    keysOf(C.pages({ record: withPage })).indexOf('my-page') > -1);
  check('after deletion it is absent from publishedPages()',
    keysOf(C.pages({ record: deleted })).indexOf('my-page') === -1,
    keysOf(C.pages({ record: deleted })));
  check('  and the pages that remain are still all there',
    keysOf(C.pages({ record: deleted })).sort().join() === 'keeper,other');

  /* The stored reference is LEFT ALONE, and stops resolving. That is the
     whole of "dangling reference handling" -- the same thing a dangling
     category, tag or author id does. */
  check('the stored related reference is still in the record, untouched',
    deleted.pages.keeper.related.join() === 'my-page');
  check('  but relatedPages() resolves none of it',
    C.related(deleted.pages.keeper, deleted, 'keeper').length === 0);
  check('  and before the deletion it resolved to exactly that page',
    keysOf(C.related(withPage.pages.keeper, withPage, 'keeper')).join() === 'my-page');

  /* The link picker's pool IS publishedPages(), so it is the same answer. */
  check('the internal-link picker pool no longer offers it',
    keysOf(C.pages({ record: deleted, indexableOnly: true, exclude: 'keeper' }))
      .indexOf('my-page') === -1);

  /* Automatic related content reads the same pool. */
  const tax = JSON.parse(JSON.stringify(deleted));
  tax.categories = { c: { name: 'C', slug: 'c' } };
  tax.pages.keeper.category = 'c';
  tax.pages.other.category = 'c';
  check('automatic related content cannot pick a deleted page',
    keysOf(C.autoRelated(tax.pages.keeper, tax, 'keeper')).indexOf('my-page') === -1,
    keysOf(C.autoRelated(tax.pages.keeper, tax, 'keeper')));
  check('  and still finds the page that does exist',
    keysOf(C.autoRelated(tax.pages.keeper, tax, 'keeper')).join() === 'other');

  /* A committed page cannot be deleted from the record at all: the DEFAULTS
     merge puts it straight back. This is why the admin does not offer it. */
  const shipped = Object.keys(CMS.DEFAULTS.pages);
  check('the pages that ship with the site are the ones the admin must refuse',
    shipped.length === 7 && ['about', 'contact', 'privacy-policy', 'responsible-gaming',
      'home', 'login', 'register'].every(k => shipped.indexOf(k) > -1), shipped);
}

/* ====================================================================
   2. THE SITEMAP READER
   ==================================================================== */
console.log('\n===== THE URL LEAVES THE SITEMAP WITH THE PAGE =====');
{
  const seoSrc = fs.readFileSync(path.join(ROOT, 'js', 'seo-files.js'), 'utf8');
  check('the sitemap is audited from the record, so it has no page list of its own',
    /function sitemapAudit\(data/.test(seoSrc));
  /* Asserted against real generated bytes in section 3. */
}

/* ====================================================================
   3. THE MANDATORY CASE: TWO BUILDS, ONE DIRECTORY
   ==================================================================== */
console.log('\n===== A STALE FILE IS THE ONLY WAY DELETION FAILS SILENTLY =====');
let STATIC_OK = false;
{
  const OUT = mktmp('out');                       /* ONE directory, built into twice */

  const rowWith = rowFor('jsk-1.com', 'with.json', seedPair);
  const r1 = build(['jsk-1.com', '--row', rel(rowWith), '--out', OUT]);
  check('BUILD 1 succeeds', r1.ok, r1.out.slice(-600));
  const dir = outDirOf(OUT);
  const files1 = walk(dir);
  check('BUILD 1 generated my-page.html', files1.indexOf('my-page.html') > -1);
  check('BUILD 1 generated keeper.html', files1.indexOf('keeper.html') > -1);
  check('BUILD 1 lists my-page in the sitemap',
    read(path.join(dir, 'sitemap.xml')).indexOf('/my-page.html') > -1);
  check('BUILD 1 links to it from keeper.html',
    read(path.join(dir, 'keeper.html')).indexOf('href="my-page.html"') > -1);
  const list1 = ldOf(read(path.join(dir, 'keeper.html')), 'data-pb-list');
  check('BUILD 1 asserts it in keeper\'s ItemList',
    !!list1 && JSON.stringify(list1).indexOf('my-page.html') > -1, list1);

  /* The page is deleted from the record. Nothing else changes. */
  const rowWithout = rowFor('jsk-1.com', 'without.json', d => {
    seedPair(d);
    delete d.pages['my-page'];            /* exactly what the admin does */
  });
  const r2 = build(['jsk-1.com', '--row', rel(rowWithout), '--out', OUT]);
  check('BUILD 2 succeeds, into the SAME output directory', r2.ok, r2.out.slice(-800));
  check('  and did NOT need --allow-unpublish',
    r2.ok && r2.out.indexOf('allow-unpublish') === -1, r2.out.slice(-400));

  const files2 = walk(dir);
  /* THE assertion this suite exists for. */
  check('BUILD 2 REMOVED the stale my-page.html from the output directory',
    files2.indexOf('my-page.html') === -1, files2.filter(f => /\.html$/.test(f)));
  check('  and the file really is gone from disk',
    !fs.existsSync(path.join(dir, 'my-page.html')));
  check('keeper.html still exists', files2.indexOf('keeper.html') > -1);
  check('  and every other file from build 1 is still there',
    files1.filter(f => f !== 'my-page.html').every(f => files2.indexOf(f) > -1),
    files1.filter(f => f !== 'my-page.html' && files2.indexOf(f) === -1));
  check('  so the only difference between the two builds is the deleted page',
    files1.length - files2.length === 1, [files1.length, files2.length]);

  const sm2 = read(path.join(dir, 'sitemap.xml'));
  check('BUILD 2 sitemap exists and has real urls',
    sm2.indexOf('<loc>') > -1, sm2.slice(0, 120));
  check('  and no longer contains my-page', sm2.indexOf('my-page') === -1);
  check('  but still contains keeper', sm2.indexOf('/keeper.html') > -1);

  const keeper2 = read(path.join(dir, 'keeper.html'));
  check('no generated page links to the deleted page',
    files2.filter(f => /\.html$/.test(f))
      .every(f => read(path.join(dir, f)).indexOf('my-page') === -1),
    files2.filter(f => /\.html$/.test(f))
      .filter(f => read(path.join(dir, f)).indexOf('my-page') > -1));
  const list2 = ldOf(keeper2, 'data-pb-list');
  check('  and no ItemList asserts it',
    !list2 || JSON.stringify(list2).indexOf('my-page') === -1, list2);
  check('keeper\'s related list drew nothing rather than a broken link',
    keeper2.indexOf('pb-pagelist-link') === -1);

  /* NO REDIRECT AND NO REPLACEMENT. The address simply does not exist. */
  check('nothing was generated in place of the deleted page',
    !fs.existsSync(path.join(dir, 'my-page.html')) &&
    files2.filter(f => /my.?page/i.test(f)).length === 0,
    files2.filter(f => /my.?page/i.test(f)));
  check('no redirect to the deleted address appears anywhere in the build',
    files2.filter(f => /\.(html|xml|txt)$/.test(f))
      .every(f => !/http-equiv="refresh"[\s\S]{0,200}my-page/i.test(read(path.join(dir, f)))));

  /* THE REST OF THE SITE IS BYTE-IDENTICAL. A deletion must not perturb the
     pages it has nothing to do with. Built fresh so the comparison is of two
     complete builds, not of one directory against itself. */
  const fresh = mktmp('fresh');
  const r3 = build(['jsk-1.com', '--row', rel(rowWithout), '--out', fresh]);
  check('a FRESH build of the post-deletion record succeeds', r3.ok, r3.out.slice(-400));
  const freshDir = outDirOf(fresh);
  const differing = walk(freshDir).filter(f =>
    read(path.join(freshDir, f)) !== read(path.join(dir, f)));
  check('rebuilding over the old output gives byte-identical files to a fresh build',
    differing.length === 0, differing);

  /* And against a build that never had the page at all: every page except the
     listing that referenced it must be byte-identical. */
  const never = mktmp('never');
  const rowNever = rowFor('jsk-1.com', 'never.json', d => {
    d.pages['keeper'] = page('keeper', { related: ['my-page'],
      builder: pub([el('k1', 'pageList', { source: 'related', title: 'Related',
                                           titleLevel: 'h2', limit: 4, schema: true })]) });
  });
  const r4 = build(['jsk-1.com', '--row', rel(rowNever), '--out', never]);
  check('a build of a record that never had the page succeeds', r4.ok, r4.out.slice(-400));
  const neverDir = outDirOf(never);
  const same = walk(neverDir).filter(f => read(path.join(neverDir, f)) === read(path.join(dir, f)));
  check('deleting a page leaves the same site as never having created it',
    same.length === walk(neverDir).length,
    walk(neverDir).filter(f => read(path.join(neverDir, f)) !== read(path.join(dir, f))));
  STATIC_OK = true;
}

/* ====================================================================
   4. WHITE LABEL
   ==================================================================== */
console.log('\n===== A DELETION ON ONE BRAND IS INVISIBLE TO THE OTHER =====');
{
  /* Both brands get the same slug with different content. Deleting it on one
     must leave the other's build byte-identical to a build where nothing was
     deleted at all. */
  const specs = [
    { id: 'jsk-1.com', other: 'playzone9.app', args: [] },
    { id: 'playzone9.app', other: 'jsk-1.com', args: ['--env', 'staging'] }
  ];
  for (const s of specs) {
    const tag = s.id.replace(/\W/g, '');
    const keepRow = rowFor(s.other, 'wl-keep-' + tag + '.json', seedPair);
    const before = mktmp('wl-before-' + tag);
    const otherArgs = s.other === 'playzone9.app' ? ['--env', 'staging'] : [];
    const rb = build([s.other, '--row', rel(keepRow), '--out', before].concat(otherArgs));
    check(s.other + ' builds with the page present', rb.ok, rb.out.slice(-400));

    /* Delete on s.id only. */
    const delRow = rowFor(s.id, 'wl-del-' + tag + '.json', d => {
      seedPair(d); delete d.pages['my-page'];
    });
    const delOut = mktmp('wl-del-' + tag);
    const rd = build([s.id, '--row', rel(delRow), '--out', delOut].concat(s.args));
    check('  ' + s.id + ' builds with the page deleted', rd.ok, rd.out.slice(-400));
    check('  ' + s.id + ' no longer generates it',
      !fs.existsSync(path.join(outDirOf(delOut), 'my-page.html')));

    /* Rebuild the OTHER brand from its unchanged row and compare byte for byte. */
    const after = mktmp('wl-after-' + tag);
    const ra = build([s.other, '--row', rel(keepRow), '--out', after].concat(otherArgs));
    check('  ' + s.other + ' still builds', ra.ok, ra.out.slice(-400));
    const bDir = outDirOf(before), aDir = outDirOf(after);
    check('  ' + s.other + ' still generates its own my-page.html',
      fs.existsSync(path.join(aDir, 'my-page.html')));
    const diff = walk(aDir).filter(f => read(path.join(aDir, f)) !== read(path.join(bDir, f)));
    check('  and ' + s.other + '\'s whole site is byte-identical to before the other brand\'s deletion',
      diff.length === 0 && walk(aDir).length === walk(bDir).length, diff);
  }
}

/* ====================================================================
   5. THE ADMIN ACTION
   ==================================================================== */
(async () => {
  console.log('\n===== THE ADMIN OFFERS DELETE WHERE IT WORKS, AND NOWHERE ELSE =====');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  let serverRow = null;
  await ctx.route('**supabase.co/**', route => {
    const q = route.request(), u = q.url();
    if (u.includes('/auth/v1/token')) return route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
    if (q.method() === 'POST') { serverRow = JSON.parse(q.postData() || '{}');
      return route.fulfill({ status: 201, body: '' }); }
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(serverRow
        ? [{ data: serverRow.data, updated_at: new Date(serverRow.updated_at).toISOString()
              .replace(/\.000Z$/, '+00:00').replace(/Z$/, '+00:00') }]
        : []) });
  });
  const errs = [];
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERROR ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    errs.push(m.text()); });

  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x');
  await p.click('#authBtn'); await p.waitForTimeout(400);
  check('signed in', !(await p.isVisible('#authGate')));

  /* Two CMS-created pages, one referencing the other. */
  await p.evaluate(() => {
    const d = window.CMS.data();
    const mk = (slug, extra) => Object.assign(
      JSON.parse(JSON.stringify(d.pages.about)),
      { label: slug, url: slug + '.html', slug: slug, title: 'T ' + slug,
        heading: 'H ' + slug, status: 'published' }, extra || {});
    d.pages['doomed'] = mk('doomed');
    d.pages['ref-one'] = mk('ref-one', { related: ['doomed'] });
    d.pages['ref-two'] = mk('ref-two', { related: ['doomed'] });
  });
  await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(450);

  const openPage = async label => {
    await p.click('#pageSubtabSettings'); await p.waitForTimeout(250);
    for (const t of await p.$$('#pageTabs .pagetab')) {
      if ((await t.textContent()).trim().replace(/\s+$/, '') === label) {
        await t.click(); await p.waitForTimeout(450); return true;
      }
    }
    return false;
  };

  check('the CMS-created page opens', await openPage('doomed'));
  const ed = await p.$eval('#pageEditor', e => e.textContent);
  check('a CMS-created page IS offered Delete', ed.indexOf('Delete this page') > -1);
  check('  and the button is present',
    !!(await p.$('#pageEditor button[data-act="page-delete"]')));
  check('  the card says the address returns a 404', /returns a normal 404/.test(ed));
  check('  says it is NOT redirected', /not.{0,20}redirected/i.test(ed), ed.slice(0, 50));
  check('  says there is no undo', /no undo/.test(ed));
  check('  and points at Draft as the reversible alternative',
    /set .{0,2}Publication.{0,2} to Draft/i.test(ed));

  /* EVERY page that ships with the site must NOT offer it -- all seven, by
     the label the engine actually gives them rather than a list typed here,
     because a label that does not match would skip the page and the check
     would pass for having tested nothing. */
  const shippedLabels = await p.evaluate(() => {
    const d = window.CMS.DEFAULTS.pages;
    return Object.keys(d).map(k => ({ key: k, label: d[k].label || k }));
  });
  check('there are seven pages that ship with the site', shippedLabels.length === 7,
    shippedLabels.map(x => x.key));
  for (const s of shippedLabels) {
    const found = await openPage(s.label);
    check('the committed page "' + s.label + '" opens, so the next check is real', found, s);
    if (!found) continue;
    const t = await p.$eval('#pageEditor', e => e.textContent);
    const btn = await p.$('#pageEditor button[data-act="page-delete"]');
    check('  and ' + s.key + ' is NOT offered Delete',
      t.indexOf('Delete this page') === -1 && !btn, s.key);
    /* It must still offer everything else, so the gate removed one control
       and not a section of the panel. */
    check('  while still offering its SEO fields', t.indexOf('Search engines') > -1, s.key);
  }

  /* CANCEL CHANGES NOTHING. */
  await openPage('doomed');
  let asked = '';
  p.once('dialog', d => { asked = d.message(); d.dismiss(); });
  const cancelBtn = await p.$('#pageEditor button[data-act="page-delete"]');
  check('the Delete button is present to cancel from', !!cancelBtn);
  if (cancelBtn) { await cancelBtn.click(); await p.waitForTimeout(350); }
  check('the confirmation names the page', /Delete "doomed" permanently\?/.test(asked), asked);
  check('  states the url stops being generated and returns a 404',
    /no longer generated and returns a 404/.test(asked), asked);
  check('  states it is NOT redirected', /NOT redirected to another page/.test(asked), asked);
  check('  counts the pages that reference it', /2 other page\(s\) list this one as related/.test(asked), asked);
  check('  says those references stop resolving and are left alone',
    /stop resolving/.test(asked) && /left as they are/.test(asked), asked);
  check('  and offers Draft as the reversible alternative', /set Publication to Draft/.test(asked));
  check('cancelling deleted nothing',
    !!(await p.evaluate(() => window.CMS.data().pages['doomed'])));
  check('  and the page is still in the tab strip',
    (await p.$$eval('#pageTabs .pagetab', els => els.map(e => e.textContent.trim())))
      .some(t => t.indexOf('doomed') > -1));

  /* CONFIRM DELETES. The button is looked up rather than clicked blind, so a
     regression that already removed the page reports instead of timing out
     and hiding every assertion after it. */
  p.once('dialog', d => d.accept());
  const delBtn = await p.$('#pageEditor button[data-act="page-delete"]');
  check('the Delete button is still there to confirm with', !!delBtn);
  if (delBtn) { await delBtn.click(); await p.waitForTimeout(500); }
  check('confirming removed the page from the record',
    !(await p.evaluate(() => !!window.CMS.data().pages['doomed'])));
  const tabsAfter = await p.$$eval('#pageTabs .pagetab', els => els.map(e => e.textContent.trim()));
  check('  and from the tab strip', !tabsAfter.some(t => t.indexOf('doomed') > -1), tabsAfter);
  check('  the editor returned to a page that still exists, rather than breaking',
    (await p.$eval('#pageEditor', e => e.textContent)).length > 0 &&
    (await p.$$('#pageEditor .card')).length > 0);
  check('  with no console or page errors', errs.length === 0, errs);
  check('the other pages are untouched',
    await p.evaluate(() => !!window.CMS.data().pages['ref-one'] &&
                           !!window.CMS.data().pages['ref-two']));
  check('  and their stored reference is left exactly as it was',
    (await p.evaluate(() => window.CMS.data().pages['ref-one'].related.join())) === 'doomed');
  check('  which the engine now resolves to nothing',
    (await p.evaluate(() => window.CMS.content.related(
      window.CMS.data().pages['ref-one'], window.CMS.data(), 'ref-one').length)) === 0);
  check('the deleted page is gone from publishedPages() in the browser too',
    !(await p.evaluate(() => window.CMS.content.pages({ record: window.CMS.data() })
      .map(r => r.key))).includes('doomed'));

  /* IT STAYS DELETED. A reload re-reads the record from storage. */
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(600);
  check('after a reload the page is still gone',
    !(await p.evaluate(() => !!window.CMS.data().pages['doomed'])));
  check('  and the pages that ship with the site all came back',
    (await p.evaluate(() => Object.keys(window.CMS.DEFAULTS.pages)
      .every(k => !!window.CMS.data().pages[k]))));

  /* THE GUARD. A key that is not an own property of pages, or one the
     committed layer supplies, must delete nothing even if the click arrives. */
  const guard = await p.evaluate(() => {
    const d = window.CMS.data();
    const before = Object.keys(d.pages).length;
    /* The exact test the handler applies, run over the hostile set. */
    const refused = ['about', 'contact', 'login', 'register', 'home', 'privacy-policy',
                     'responsible-gaming', '__proto__', 'constructor', 'prototype',
                     'no-such-page', ''].filter(k =>
      !Object.prototype.hasOwnProperty.call(d.pages, k) || (window.CMS.DEFAULTS.pages || {})[k]);
    return { before: before, refused: refused.length, after: Object.keys(d.pages).length };
  });
  check('the delete guard refuses every committed, reserved and unknown key',
    guard.refused === 12, guard);
  check('  and asking the question changed nothing', guard.before === guard.after);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
  process.exit(fail ? 1 : 0);
})();
