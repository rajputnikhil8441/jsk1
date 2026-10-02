/* =====================================================================
   CATEGORIES, TAGS AND RELATED CONTENT, IN THE HTML THE SITE SERVES
   (Phase 2F)
   ---------------------------------------------------------------------
   test_taxonomy.js tests the readers. This tests the only thing a crawler
   can see: the bytes tools/build-site.js writes. Every assertion below
   runs a real build and reads the generated files.

   Four things it exists to prove.

   1. IT IS STATIC. The category, the tags and the automatic related links
      are in the file before any JavaScript runs. Nothing here is a runtime
      DOM mutation, so there is nothing for Google to miss.

   2. NO URL EXPLOSION. A site with categories and tags generates exactly
      the same files as the same site without them. There is no category
      page, no tag page, nothing new in the sitemap and nothing in
      robots.txt. Tags are TEXT, not links, because there is nothing to
      link to and nothing pretends otherwise.

   3. ONE BRAND ONLY. Two brands are built with the same category and tag
      IDS and different names, and neither build contains a trace of the
      other's names or pages.

   4. NOTHING UNPUBLISHED IS EVER ADVERTISED. A draft, a noindex page and
      an address the build will not create are absent from every related
      list and from the ItemList that describes one.
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
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'taxstat-' + tag + '-'));
  tmpRoots.push(d); return d;
}
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
function build(args) {
  try {
    return { ok: true, out: execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js')].concat(args),
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}
function walk(dir, base, out) {
  base = base || dir; out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}
const read = f => fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
function ldOf(html, attr) {
  const m = new RegExp('<script type="application/ld\\+json" ' + attr + '="1">([\\s\\S]*?)</script>')
    .exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return { PARSE_ERROR: m[1].slice(0, 300) }; }
}
const metaOf = (html, prop, name) =>
  (new RegExp('<meta ' + prop + '="' + name + '" content="([^"]*)"').exec(html) || [])[1];

/* The one taxonomy block a page may carry, as text. */
function taxBlock(html) {
  const m = /<aside class="pb-el pb-taxonomy"[\s\S]*?<\/aside>/.exec(html);
  return m ? m[0] : '';
}
const taxCat = html =>
  (/<span class="pb-taxonomy-value">([\s\S]*?)<\/span>/.exec(taxBlock(html)) || [])[1];
function taxTags(html) {
  const b = taxBlock(html), out = [];
  const re = /<span class="pb-taxonomy-tag">([\s\S]*?)<\/span>/g;
  let m; while ((m = re.exec(b))) out.push(m[1]);
  return out;
}
/* Every href the page-list elements on a page advertise, in document order. */
function listHrefs(html) {
  const out = [];
  const re = /<a class="pb-pagelist-link" href="([^"]*)"/g;
  let m; while ((m = re.exec(html))) out.push(m[1]);
  return out;
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
const TAX_EL = id => el(id, 'taxonomy', { categoryLabel: 'Category', tagsLabel: 'Tags',
                                          showCategory: true, showTags: true });
const LIST_EL = (id, extra) => el(id, 'pageList', Object.assign({
  source: 'related', title: 'Related', titleLevel: 'h2', limit: 4, autoFill: true }, extra || {}));

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

/* ====================================================================
   1. THE CATEGORY AND THE TAGS ARE IN THE FILE
   ==================================================================== */
console.log('\n===== A CRAWLER READS THE CATEGORY WITHOUT RUNNING ANYTHING =====');
let MAIN = null;
{
  const out = mktmp('main');
  const row = rowFor('jsk-1.com', 'main.json', d => {
    d.categories = { cricket: { name: 'Cricket', slug: 'cricket', description: 'Bat and ball.' },
                     football: { name: 'Football', slug: 'football' } };
    d.tags = { ipl: { name: 'IPL', slug: 'ipl' }, y26: { name: '2026', slug: '2026' },
               fifa: { name: 'FIFA', slug: 'fifa' } };
    /* The page under test: taxonomy shown, related list filling automatically. */
    d.pages['t-a'] = page('t-a', { type: 'article', category: 'cricket', tags: ['ipl', 'y26'],
      publishedAt: '2026-01-01',
      builder: pub([TAX_EL('e1'), LIST_EL('e2', { schema: true, excerpt: true })]) });
    /* Same category + a shared tag: the strongest candidate. */
    d.pages['t-b'] = page('t-b', { type: 'article', category: 'cricket', tags: ['ipl'],
      publishedAt: '2026-02-01', excerpt: 'B excerpt.',
      builder: pub([el('e3', 'heading', { text: 'B', level: 'h2' })]) });
    /* No category, two shared tags: qualifies on tags alone. */
    d.pages['t-c'] = page('t-c', { type: 'guide', tags: ['ipl', 'y26'], publishedAt: '2026-03-01',
      builder: pub([el('e4', 'heading', { text: 'C', level: 'h2' })]) });
    /* One shared tag only -- the year. Must NOT be related. */
    d.pages['t-d'] = page('t-d', { type: 'article', category: 'football', tags: ['fifa', 'y26'],
      publishedAt: '2026-04-01',
      builder: pub([el('e5', 'heading', { text: 'D', level: 'h2' })]) });
    /* A draft, a noindex page and a plain page: never candidates. */
    d.pages['t-draft'] = page('t-draft', { type: 'article', category: 'cricket', tags: ['ipl'],
      status: 'draft', builder: pub([el('e6', 'heading', { text: 'X', level: 'h2' })]) });
    d.pages['t-hidden'] = page('t-hidden', { type: 'article', category: 'cricket', tags: ['ipl'],
      robots: { index: false, follow: true },
      builder: pub([el('e7', 'heading', { text: 'H', level: 'h2' })]) });
    d.pages['t-plain'] = page('t-plain', { type: 'page', category: 'cricket', tags: ['ipl'],
      builder: pub([TAX_EL('e8')]) });
  });
  const r = build(['jsk-1.com', '--row', rel(row), '--out', out]);
  check('a build with categories and tags succeeds', r.ok, r.out.slice(-800));
  const dir = outDirOf(out);
  MAIN = { dir: dir, files: walk(dir) };
  const html = read(path.join(dir, 't-a.html'));

  check('the article page was generated', !!html);
  check('the taxonomy block is in the static HTML', taxBlock(html).length > 0);
  check('  with the category NAME, not its id', taxCat(html) === 'Cricket', taxCat(html));
  check('  and the tag names, in the author\'s order',
    taxTags(html).join() === 'IPL,2026', taxTags(html));
  check('  labelled, so the value is never bare text', /pb-taxonomy-label">Category</.test(html));

  /* The whole reason there is no archive: there is nothing to link to. */
  check('NO tag is a link -- there is no tag page to link to',
    taxBlock(html).indexOf('<a ') === -1, taxBlock(html).slice(0, 200));
  check('  and the category is not a link either',
    !/<a[^>]*>(\s*)Cricket/.test(taxBlock(html)));

  check('the automatic related list is in the static HTML too',
    listHrefs(html).length > 0, listHrefs(html));
  check('  and it found the two pages that qualify, best first',
    listHrefs(html).join() === 't-b.html,t-c.html', listHrefs(html));
  check('  a page sharing ONLY the year 2026 is not related',
    listHrefs(html).indexOf('t-d.html') === -1, listHrefs(html));
  check('  the draft is not related, and no file was generated for it',
    listHrefs(html).indexOf('t-draft.html') === -1 &&
    MAIN.files.indexOf('t-draft.html') === -1);
  check('  the noindex page is not related, though its file exists',
    listHrefs(html).indexOf('t-hidden.html') === -1 &&
    MAIN.files.indexOf('t-hidden.html') !== -1);
  check('  the page never relates to itself', listHrefs(html).indexOf('t-a.html') === -1);

  /* Every href must be a file this build actually wrote. */
  for (const h of listHrefs(html))
    check('  the related href ' + h + ' is a file this build created',
      MAIN.files.indexOf(h) !== -1, MAIN.files.filter(f => /\.html$/.test(f)));

  /* A plain page carries the element and draws nothing, because a plain page
     has no topic. The element in a template therefore costs an empty page
     nothing. */
  const plain = read(path.join(dir, 't-plain.html'));
  check('a plain page with a stored category draws NO taxonomy block at all',
    taxBlock(plain) === '', taxBlock(plain).slice(0, 200));
  check('  and no label leaks out either', plain.indexOf('pb-taxonomy') === -1);
}

/* ====================================================================
   2. STRUCTURED DATA
   ==================================================================== */
console.log('\n===== THE ARTICLE BLOCK SAYS THE CATEGORY AND THE KEYWORDS =====');
{
  const html = read(path.join(MAIN.dir, 't-a.html'));
  const art = ldOf(html, 'data-pb-article');
  check('the Article block is present and parses', !!art && !art.PARSE_ERROR, art);
  check('  articleSection is the category name', art.articleSection === 'Cricket');
  check('  keywords is the tag names, comma separated', art.keywords === 'IPL, 2026', art.keywords);
  check('  and there is still exactly ONE Article block on the page',
    (html.match(/data-pb-article="1"/g) || []).length === 1);

  const list = ldOf(html, 'data-pb-list');
  check('the ItemList describing the related list is present', !!list && !list.PARSE_ERROR, list);
  check('  and it lists exactly the rows the HTML drew',
    list.itemListElement.length === listHrefs(html).length);
  check('  with absolute urls for files that exist',
    list.itemListElement.every((it, i) =>
      it.url === 'https://jsk-1.com/' + listHrefs(html)[i]), list.itemListElement);
  check('  and asserts nothing about the draft or the noindex page',
    JSON.stringify(list).indexOf('t-draft') === -1 &&
    JSON.stringify(list).indexOf('t-hidden') === -1);

  const plainArt = ldOf(read(path.join(MAIN.dir, 't-plain.html')), 'data-pb-article');
  check('a plain page publishes no Article block, so no articleSection', plainArt === null);
}

/* ====================================================================
   3. NO URL EXPLOSION
   ==================================================================== */
console.log('\n===== A TAXONOMY ADDS TOPICS, NOT URLS =====');
{
  /* The same site, built twice: once with categories and tags on every
     content page, once with the collections empty and the fields cleared.
     The FILE SET must be identical. */
  const mk = (file, out, withTax) => {
    const row = rowFor('jsk-1.com', file, d => {
      if (withTax) {
        d.categories = { c: { name: 'Cricket', slug: 'cricket' } };
        d.tags = { t: { name: 'IPL', slug: 'ipl' } };
      }
      d.pages['u-a'] = page('u-a', Object.assign({ type: 'article' },
        withTax ? { category: 'c', tags: ['t'] } : {},
        { builder: pub([TAX_EL('f1'), LIST_EL('f2', { schema: true })]) }));
      d.pages['u-b'] = page('u-b', Object.assign({ type: 'article' },
        withTax ? { category: 'c', tags: ['t'] } : {},
        { builder: pub([el('f3', 'heading', { text: 'B', level: 'h2' })]) }));
    });
    const r = build(['jsk-1.com', '--row', rel(row), '--out', out]);
    check('the ' + (withTax ? 'taxonomy' : 'bare') + ' build succeeds', r.ok, r.out.slice(-600));
    return outDirOf(out);
  };
  const withDir = mk('tax-on.json', mktmp('taxon'), true);
  const noDir = mk('tax-off.json', mktmp('taxoff'), false);
  const a = walk(withDir), b = walk(noDir);
  check('categories and tags generate not one extra file',
    JSON.stringify(a) === JSON.stringify(b),
    a.filter(f => b.indexOf(f) === -1).concat(b.filter(f => a.indexOf(f) === -1)));

  const sm = read(path.join(withDir, 'sitemap.xml'));
  const smNo = read(path.join(noDir, 'sitemap.xml'));
  check('the sitemap is byte-identical with and without taxonomy', sm === smNo);
  check('  and contains no category url', sm.indexOf('/category') === -1);
  check('  and no tag url', sm.indexOf('/tag') === -1 && sm.indexOf('cricket') === -1);
  check('robots.txt is byte-identical too',
    read(path.join(withDir, 'robots.txt')) === read(path.join(noDir, 'robots.txt')));

  /* The element is in the four content templates. On a page with no
     category and no tags it must draw NOTHING, so adding it to a template
     cannot change a page that never gets a topic. */
  const bare = read(path.join(noDir, 'u-a.html'));
  check('the taxonomy element on an untagged page draws nothing',
    bare.indexOf('pb-taxonomy') === -1);
  check('  and its related list draws nothing either, so the page is unchanged',
    listHrefs(bare).length === 0, listHrefs(bare));
}

/* ====================================================================
   4. MANUAL FIRST, IN THE HTML
   ==================================================================== */
console.log('\n===== THE EDITOR\'S ORDER IS THE ORDER IN THE FILE =====');
{
  const out = mktmp('man');
  const row = rowFor('jsk-1.com', 'man.json', d => {
    d.categories = { c: { name: 'Cricket', slug: 'cricket' } };
    d.tags = { t: { name: 'IPL', slug: 'ipl' } };
    /* m-pick is unrelated by topic and chosen by hand; m-auto1 and m-auto2
       are found automatically. m-auto2 is ALSO chosen by hand. */
    d.pages['m-self'] = page('m-self', { type: 'article', category: 'c', tags: ['t'],
      related: ['m-pick', 'm-auto2'],
      builder: pub([LIST_EL('g1', { limit: 4, schema: true })]) });
    d.pages['m-pick'] = page('m-pick', { type: 'page',
      builder: pub([el('g2', 'heading', { text: 'P', level: 'h2' })]) });
    d.pages['m-auto1'] = page('m-auto1', { type: 'article', category: 'c', tags: ['t'],
      publishedAt: '2026-05-01',
      builder: pub([el('g3', 'heading', { text: 'A1', level: 'h2' })]) });
    d.pages['m-auto2'] = page('m-auto2', { type: 'article', category: 'c', tags: ['t'],
      publishedAt: '2026-06-01',
      builder: pub([el('g4', 'heading', { text: 'A2', level: 'h2' })]) });
  });
  const r = build(['jsk-1.com', '--row', rel(row), '--out', out]);
  check('a build mixing manual and automatic related content succeeds', r.ok, r.out.slice(-600));
  const dir = outDirOf(out);
  const hrefs = listHrefs(read(path.join(dir, 'm-self.html')));
  check('the hand-picked pages come first, in the author\'s order',
    hrefs[0] === 'm-pick.html' && hrefs[1] === 'm-auto2.html', hrefs);
  check('  then automatic fills the rest',
    hrefs.join() === 'm-pick.html,m-auto2.html,m-auto1.html', hrefs);
  check('  and a page that is BOTH appears exactly once',
    hrefs.filter(h => h === 'm-auto2.html').length === 1, hrefs);
  check('  even though automatic would have ranked it first',
    hrefs.indexOf('m-auto2.html') === 1);

  /* A list without autoFill is still exactly the manual selection: the
     existing behaviour is not replaced. */
  const row2 = rowFor('jsk-1.com', 'man2.json', d => {
    d.categories = { c: { name: 'Cricket', slug: 'cricket' } };
    d.tags = { t: { name: 'IPL', slug: 'ipl' } };
    d.pages['m-self'] = page('m-self', { type: 'article', category: 'c', tags: ['t'],
      related: ['m-pick'],
      builder: pub([LIST_EL('h1', { autoFill: false, limit: 4 })]) });
    d.pages['m-pick'] = page('m-pick', { type: 'page',
      builder: pub([el('h2e', 'heading', { text: 'P', level: 'h2' })]) });
    d.pages['m-auto1'] = page('m-auto1', { type: 'article', category: 'c', tags: ['t'],
      builder: pub([el('h3', 'heading', { text: 'A1', level: 'h2' })]) });
  });
  const out2 = mktmp('man2');
  const r2 = build(['jsk-1.com', '--row', rel(row2), '--out', out2]);
  check('a build with autoFill off succeeds', r2.ok, r2.out.slice(-600));
  const off = listHrefs(read(path.join(outDirOf(out2), 'm-self.html')));
  check('autoFill off means EXACTLY the manual selection, as before Phase 2F',
    off.join() === 'm-pick.html', off);
}

/* ====================================================================
   5. WHITE LABEL
   ==================================================================== */
console.log('\n===== THE SAME IDS, AND NEITHER BRAND CAN SEE THE OTHER =====');
{
  const specs = [
    { id: 'jsk-1.com', base: 'https://jsk-1.com', catName: 'Alpha Cricket',
      tagName: 'Alpha IPL', slug: 'a-one', other: ['Beta Cricket', 'Beta IPL', 'b-one'] },
    { id: 'playzone9.app', base: 'https://playzone9.app', catName: 'Beta Cricket',
      tagName: 'Beta IPL', slug: 'b-one', other: ['Alpha Cricket', 'Alpha IPL', 'a-one'] }
  ];
  for (const s of specs) {
    const out = mktmp('wl-' + s.id.replace(/\W/g, ''));
    const row = rowFor(s.id, 'wl-' + s.id.replace(/\W/g, '') + '.json', d => {
      d.seo = d.seo || {}; d.seo.baseUrl = s.base;
      /* The SAME ids on both brands, with different names. */
      d.categories = { shared: { name: s.catName, slug: 'shared' } };
      d.tags = { shared: { name: s.tagName, slug: 'shared' } };
      d.pages[s.slug] = page(s.slug, { type: 'article', category: 'shared', tags: ['shared'],
        publishedAt: '2026-01-01',
        /* It also names the OTHER brand's page by hand. */
        related: [s.other[2]],
        builder: pub([TAX_EL('w1'), LIST_EL('w2', { schema: true })]) });
      d.pages[s.slug + '-2'] = page(s.slug + '-2', { type: 'article', category: 'shared',
        tags: ['shared'], publishedAt: '2026-02-01',
        builder: pub([el('w3', 'heading', { text: 'Two', level: 'h2' })]) });
    });
    const r = build([s.id, '--row', rel(row), '--out', out]);
    check(s.id + ' builds', r.ok, r.out.slice(-600));
    const dir = outDirOf(out);
    const html = read(path.join(dir, s.slug + '.html'));
    check(s.id + ' shows its OWN category name for the shared id',
      taxCat(html) === s.catName, taxCat(html));
    check('  and its own tag name', taxTags(html).join() === s.tagName, taxTags(html));
    check('  and relates only to its own page',
      listHrefs(html).join() === s.slug + '-2.html', listHrefs(html));
    check('  the manual reference to the other brand\'s page resolved to nothing',
      listHrefs(html).indexOf(s.other[2] + '.html') === -1);

    const text = walk(dir).filter(f => /\.(html|xml|txt)$/.test(f))
      .map(f => read(path.join(dir, f))).join('\n');
    for (const m of s.other)
      check('  and no file in the build mentions "' + m + '"', text.indexOf(m) === -1);
  }
}

/* ====================================================================
   6. HOSTILE VALUES REACH HTML AS TEXT
   ==================================================================== */
console.log('\n===== A CATEGORY NAME CANNOT BECOME MARKUP =====');
{
  const out = mktmp('evil');
  const EVIL_CAT = '</script><script>alert(1)</script>';
  const EVIL_TAG = '<img src=x onerror="alert(2)">';
  const row = rowFor('jsk-1.com', 'evil.json', d => {
    d.categories = { c: { name: EVIL_CAT, slug: 'javascript:alert(1)' },
                     gone: { slug: 'nameless' } };
    d.tags = { t: { name: EVIL_TAG, slug: '../../etc/passwd' },
               nameless: { slug: 'x' } };
    d.pages['v-a'] = page('v-a', { type: 'article', category: 'c', tags: ['t', 'nameless'],
      publishedAt: '2026-01-01',
      builder: pub([TAX_EL('v1'), LIST_EL('v2', { schema: true })]) });
    /* Every reference here resolves to nothing. Nothing may be drawn. */
    d.pages['v-b'] = page('v-b', { type: 'article', category: 'gone', tags: ['absent', 'nameless'],
      builder: pub([TAX_EL('v3')]) });
  });
  const r = build(['jsk-1.com', '--row', rel(row), '--out', out]);
  check('a build with hostile taxonomy names succeeds', r.ok, r.out.slice(-800));
  const dir = outDirOf(out);
  const html = read(path.join(dir, 'v-a.html'));

  check('the hostile category name is escaped in the HTML',
    html.indexOf(EVIL_CAT) === -1 && html.indexOf('&lt;/script&gt;') !== -1);
  check('  so no extra script tag was created',
    (html.match(/<script(?![^>]*type="application\/ld)/g) || []).length ===
    (read(path.join(MAIN.dir, 't-a.html')).match(/<script(?![^>]*type="application\/ld)/g) || []).length);
  check('the hostile tag name is escaped too',
    html.indexOf(EVIL_TAG) === -1 && html.indexOf('&lt;img src=x') !== -1);
  check('  and no img element was created from it', !/<img src=x/.test(html));
  check('the invalid slug never reaches an href -- there is no href for it',
    html.indexOf('javascript:') === -1);
  check('  and the traversal slug reaches nothing either',
    html.indexOf('../../etc/passwd') === -1);

  const art = ldOf(html, 'data-pb-article');
  check('the Article block still parses with a hostile articleSection',
    !!art && !art.PARSE_ERROR, art && art.PARSE_ERROR);
  check('  and carries the name as DATA, with < escaped out of the script',
    art.articleSection === EVIL_CAT, art && art.articleSection);
  check('  keywords carries only the tag that resolved',
    art.keywords === EVIL_TAG, art && art.keywords);

  const b = read(path.join(dir, 'v-b.html'));
  check('a page whose every taxonomy reference is dangling draws NOTHING',
    b.indexOf('pb-taxonomy') === -1);
  check('  not even an empty label', b.indexOf('Category</span>') === -1);
}

/* ====================================================================
   7. A REVIEW HOST STILL INDEXES NOTHING
   ==================================================================== */
console.log('\n===== STAGING PUBLISHES TOPICS AND INDEXES NOTHING =====');
{
  const out = mktmp('stg');
  const row = rowFor('playzone9.app', 'stg.json', d => {
    d.seo = d.seo || {}; d.seo.baseUrl = 'https://playzones9.com';
    d.categories = { c: { name: 'Stage Cricket', slug: 'cricket' } };
    d.tags = { t: { name: 'Stage IPL', slug: 'ipl' } };
    d.pages['s-a'] = page('s-a', { type: 'article', category: 'c', tags: ['t'],
      publishedAt: '2026-01-01',
      builder: pub([TAX_EL('s1'), LIST_EL('s2', { schema: true })]) });
    d.pages['s-b'] = page('s-b', { type: 'article', category: 'c', tags: ['t'],
      builder: pub([el('s3', 'heading', { text: 'B', level: 'h2' })]) });
  });
  const r = build(['playzone9.app', '--env', 'staging', '--row', rel(row), '--out', out]);
  check('a staging build with taxonomy succeeds', r.ok, r.out.slice(-600));
  const dir = outDirOf(out);
  const html = read(path.join(dir, 's-a.html'));
  check('the page is noindex on the review host',
    metaOf(html, 'name', 'robots') === 'noindex,nofollow', metaOf(html, 'name', 'robots'));
  check('  the category is still shown -- noindex is not what hides a topic',
    taxCat(html) === 'Stage Cricket', taxCat(html));
  check('  the related list still renders', listHrefs(html).join() === 's-b.html', listHrefs(html));
  check('  and there is no sitemap at all', !fs.existsSync(path.join(dir, 'sitemap.xml')));
}

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
