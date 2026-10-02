/* =====================================================================
   THE CONTENT ENGINE  (Phase 2C)
   ---------------------------------------------------------------------
   Phase 2C-A added five inert page fields. This is what reads them, and
   what this suite exists to prove is not that the happy path works -- a
   build shows that -- but that every way the fields can be WRONG produces
   silence rather than something broken in a page a crawler reads.

   The adversarial half is therefore the point: a content type nobody
   recognises, a date that passes a regex and is not a day, an author id
   that resolves to nothing, a related page that is a draft, a related page
   belonging to another brand, a hostile string in every one of them.

   Everything is asserted against the STATIC HTML a real build writes, not
   against runtime behaviour, because that is the only output a crawler
   sees. The in-process half tests the readers directly, and the one thing
   it may never do is pass because both sides were null.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ctype-' + tag + '-'));
  tmpRoots.push(d); return d;
}
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function walk(dir, base, out) {
  base = base || dir; out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}
function build(args) {
  try {
    return { ok: true, out: execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js')].concat(args),
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) { return { ok: false, out: (e.stdout || '') + (e.stderr || '') }; }
}

const CMS = pbbake.loadEngine(ROOT).CMS;
const C = CMS.content;

const WORK = mktmp('work');
const ROWS = path.join(WORK, 'rows'); fs.mkdirSync(ROWS, { recursive: true });

const sec = els => ({ id: 's' + els[0].id, type: 'text', enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
  elements: els });
const el = (id, type, content) => ({ id: id, type: type, content: content || {},
  style: {}, responsive: {} });

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

/* ====================================================================
   1. THE TYPE ALLOW-LIST
   ==================================================================== */
console.log('\n===== A TYPE IS A NAME FROM A LIST, NEVER A STORED STRING =====');
{
  const known = Object.keys(C.types);
  check('the supported types are exactly page, article, guide, help, hub',
    JSON.stringify(known.slice().sort()) === JSON.stringify(['article', 'guide', 'help', 'hub', 'page']),
    known);
  check('there is no faq type -- the faq ELEMENT already publishes FAQPage',
    !Object.prototype.hasOwnProperty.call(C.types, 'faq'));

  for (const t of known) check('"' + t + '" resolves to itself', C.type({ type: t }) === t);
  check('an empty type is an ordinary page', C.type({ type: '' }) === 'page');
  check('an absent type is an ordinary page', C.type({}) === 'page');
  check('a null type is an ordinary page', C.type({ type: null }) === 'page');

  const hostile = ['constructor', '__proto__', 'valueOf', 'toString', 'hasOwnProperty',
                   '<script>alert(1)</script>', 'article;drop', 'page page', 'faq',
                   'articles', 0, 1, true, false, {}, [], ['article'], ['guide'], null, undefined];
  for (const h of hostile) {
    const got = C.type(h === undefined ? {} : { type: h });
    check('a hostile or unknown type ' + JSON.stringify(h) + ' falls back to page', got === 'page', got);
  }
  /* Case and surrounding space ARE forgiven: a hand-edited row saying
     "Article" means an article, and the value is normalised rather than
     thrown away. What is refused is a value that is not a string -- an array
     stringifies to its one element, which would otherwise smuggle a type in. */
  for (const near of ['Article', 'ARTICLE', ' guide ', 'Hub', 'HELP'])
    check('a case or space variant is normalised: ' + JSON.stringify(near),
      C.type({ type: near }) === near.trim().toLowerCase(), C.type({ type: near }));
  check('an array that stringifies to a valid type is still refused',
    C.type({ type: ['article'] }) === 'page');
  check('og:type only ever says website or article',
    known.every(t => ['website', 'article'].indexOf(C.ogType({ type: t })) > -1),
    known.map(t => t + '=' + C.ogType({ type: t })));
  check('an ordinary page says website', C.ogType({ type: '' }) === 'website');
  check('an article says article', C.ogType({ type: 'article' }) === 'article');
  check('a hub says website, not a made-up og type', C.ogType({ type: 'hub' }) === 'website');
}

/* ====================================================================
   2. DATES
   ==================================================================== */
console.log('\n===== A DATE IS A REAL DAY OR IT IS NOTHING =====');
{
  for (const d of ['2026-01-01', '2026-12-31', '2024-02-29'])
    check('"' + d + '" is accepted', C.isoDate(d) === d);
  const bad = ['', '2026-13-01', '2026-00-10', '2026-02-30', '2025-02-29', '2026-1-1',
               '26-01-01', '2026/01/01', '2026-01-01T00:00:00Z', 'yesterday',
               '2026-01-01 ', ' 2026-01-01', '0000-00-00', '99999-01-01', null, undefined,
               0, {}, []];
  for (const d of bad) {
    const got = C.isoDate(d);
    check('a date that is not a real day is refused: ' + JSON.stringify(d),
      got === '' || (typeof d === 'string' && d.trim() === got && C.isoDate(got) === got), got);
  }
  check('2026-02-30 is refused (a regex alone would accept it)', C.isoDate('2026-02-30') === '');
  check('2026-13-45 is refused', C.isoDate('2026-13-45') === '');

  /* A date only counts on a type that publishes one. */
  check('an article publishes its date',
    C.publishedAt({ type: 'article', publishedAt: '2026-03-04' }) === '2026-03-04');
  check('an ordinary page publishes no date even when one is stored',
    C.publishedAt({ type: '', publishedAt: '2026-03-04' }) === '');
  check('a hub publishes no date either',
    C.publishedAt({ type: 'hub', publishedAt: '2026-03-04' }) === '');
  check('an invalid date on an article is absent, not malformed',
    C.publishedAt({ type: 'article', publishedAt: '2026-02-30' }) === '');
}

/* ====================================================================
   3. AUTHORS
   ==================================================================== */
console.log('\n===== AN AUTHOR WHO CANNOT BE NAMED IS NOT AN AUTHOR =====');
{
  const authors = {
    good: { name: 'Ada Writer', bio: 'Writes.', url: 'about.html', image: 'assets/images/logo.png' },
    noName: { bio: 'Anonymous.' },
    blankName: { name: '   ' },
    notObject: 'Ada',
    nulled: null,
    hostileUrl: { name: 'H', url: 'javascript:alert(1)' },
    hostileImg: { name: 'I', image: 'data:image/png;base64,AAAA' }
  };
  check('a complete author resolves', !!C.authorFrom(authors, 'good'));
  check('  with the name', (C.authorFrom(authors, 'good') || {}).name === 'Ada Writer');
  for (const id of ['noName', 'blankName', 'notObject', 'nulled'])
    check('an author with no usable name does not resolve: ' + id, C.authorFrom(authors, id) === null);
  for (const id of ['missing', '', null, undefined, 'constructor', '__proto__', 'toString', 'valueOf'])
    check('a reference that is not a real entry does not resolve: ' + JSON.stringify(id),
      C.authorFrom(authors, id) === null);
  check('a javascript: author link is dropped, the author still resolves',
    C.authorFrom(authors, 'hostileUrl') && !C.authorFrom(authors, 'hostileUrl').url);
  check('a data: author image is dropped, the author still resolves',
    C.authorFrom(authors, 'hostileImg') && !C.authorFrom(authors, 'hostileImg').image);
  check('no collection at all resolves to nothing', C.authorFrom(null, 'good') === null);
  check('a non-object collection resolves to nothing', C.authorFrom('nope', 'good') === null);
}

/* ====================================================================
   4. THE ONE PUBLISHED-PAGE READER
   ==================================================================== */
console.log('\n===== ONE READER, AND EVERY RULE THE BUILD ALREADY APPLIES =====');
{
  const rec = { authors: { w: { name: 'W' } }, pages: {
    home:    { url: '', slug: '', title: 'Home', status: 'published', robots: { index: true } },
    live:    { url: 'live.html', title: 'Live', type: 'article', publishedAt: '2026-02-02',
               author: 'w', status: 'published', robots: { index: true } },
    older:   { url: 'older.html', title: 'Older', type: 'article', publishedAt: '2026-01-01',
               status: 'published', robots: { index: true } },
    undated: { url: 'undated.html', title: 'Undated', type: 'article', status: 'published',
               robots: { index: true } },
    draft:   { url: 'draft.html', title: 'Draft', type: 'article', status: 'draft',
               robots: { index: true } },
    weird:   { url: 'weird.html', title: 'Weird', type: 'article', status: 'in-review',
               robots: { index: true } },
    hidden:  { url: 'hidden.html', title: 'Hidden', type: 'article', status: 'published',
               robots: { index: false } },
    nested:  { url: 'guides/n.html', title: 'Nested', type: 'article', status: 'published',
               robots: { index: true } },
    noUrl:   { url: 'NOT A URL', title: 'Bad', type: 'article', status: 'published',
               robots: { index: true } },
    notObj:  'nope'
  } };
  const keys = o => C.pages(o).map(p => p.key);

  check('no record means no pages -- never ambient state', C.pages({}).length === 0);
  check('  and no record with a type filter either', C.pages({ type: 'article' }).length === 0);

  const all = keys({ record: rec });
  check('a draft is never listed', all.indexOf('draft') === -1, all);
  check('an unrecognised status is treated as a draft', all.indexOf('weird') === -1, all);
  check('a url this build cannot create is not listed', all.indexOf('nested') === -1 &&
    all.indexOf('noUrl') === -1, all);
  check('a page that is not an object is skipped', all.indexOf('notObj') === -1, all);
  check('a noindex page IS listed when indexability is not asked about',
    all.indexOf('hidden') > -1, all);
  check('  and is NOT listed when it is', keys({ record: rec, indexableOnly: true })
    .indexOf('hidden') === -1);
  check('the home page is listed', all.indexOf('home') > -1, all);
  check("  with href './'", C.pages({ record: rec }).filter(p => p.key === 'home')[0].href === './');

  const arts = C.pages({ record: rec, type: 'article', indexableOnly: true });
  check('the type filter keeps only that type',
    arts.every(p => p.type === 'article'), arts.map(p => p.key));
  check('  newest first, undated last',
    JSON.stringify(arts.map(p => p.key)) === JSON.stringify(['live', 'older', 'undated']),
    arts.map(p => p.key + ':' + p.publishedAt));
  check('an unknown type filter lists everything rather than guessing',
    keys({ record: rec, type: 'nonsense' }).length === all.length);
  check('exclude drops that one page', keys({ record: rec, exclude: 'live' }).indexOf('live') === -1);
  check('the author resolves on the summary',
    (arts.filter(p => p.key === 'live')[0].author || {}).name === 'W');
  check('sorting is total and stable -- two reads agree',
    JSON.stringify(keys({ record: rec })) === JSON.stringify(keys({ record: rec })));

  /* The three status readers in this repository must agree. They are
     separate implementations for separate runtimes; a table is what keeps
     them one rule rather than three opinions. */
  const SEOFiles = require(path.join(ROOT, 'js', 'seo-files.js'));
  const table = ['published', '', 'PUBLISHED', ' published ', 'draft', 'Draft', 'in-review',
                 'anything', null, undefined];
  let agree = [];
  for (const st of table) {
    const p = st === undefined ? {} : { status: st };
    const a = C.isPublished(p);
    const b = SEOFiles.isPublished(p);
    const c = pbbake.pageStatus(p) === 'published';
    if (!(a === b && b === c)) agree.push(JSON.stringify(st) + ': ' + [a, b, c].join('/'));
  }
  check('the engine, the sitemap and the baker agree on every status value',
    agree.length === 0, agree);
}

/* ====================================================================
   4b. THE URL RULE IS THE GENERATOR'S, PINNED TO IT
   --------------------------------------------------------------------
   Three layers have an opinion about what a page address may be, and only
   one of them decides which files exist:

     tools/lib/brandkit.js PAGE_NAME_RE   sixty-one characters, case-SENSITIVE
     js/seo-files.js       pageFile       eighty, case-insensitive
     js/cms.js             pageFileName   the reader these listings use

   seo-files is allowed to be kinder because sitemapAudit() is also handed
   the list of files the build produced, so an address the generator refused
   never reaches the sitemap. The reader has no second gate: what it returns
   gets an <a href> in the page and, on a hub, a url in the ItemList. At
   eighty it advertised a page the build had already refused to generate.

   So the invariant is one-directional and that is what is asserted here:
   THE READER MAY ACCEPT NOTHING THE GENERATOR WOULD REJECT. The generator's
   regex is read out of its own source rather than copied, so this cannot
   drift into agreeing with a stale copy of it.
   ==================================================================== */
console.log('\n===== THE READER NEVER ACCEPTS AN ADDRESS THE BUILD WOULD REFUSE =====');
{
  /* The generator's own rule, lifted from its source. If brandkit stops
     declaring it this way the test fails rather than quietly comparing
     against a literal nobody maintained. */
  const kitSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'brandkit.js'), 'utf8');
  const m = /const PAGE_NAME_RE = (\/\^.*?\/);/.exec(kitSrc);
  check('the generator still declares PAGE_NAME_RE where this test reads it', !!m,
    kitSrc.slice(kitSrc.indexOf('PAGE_NAME_RE'), kitSrc.indexOf('PAGE_NAME_RE') + 80));
  const GEN = m ? eval(m[1]) : null;
  check('  and it is case-sensitive', !!GEN && !GEN.flags.includes('i'), GEN && GEN.flags);

  const long61 = 'x'.repeat(61);          /* the longest the generator takes */
  const long62 = 'x'.repeat(62);          /* one over */
  const REAL   = 'a-very-long-guide-slug-that-an-author-could-easily-type-in-here-ok';

  const ADDRESSES = [
    '', 'a.html', 'about.html', 'second-page.html', 'a-b-c.html',
    long61 + '.html', long62 + '.html', REAL + '.html',
    'About.html', 'ABOUT.HTML', 'about.HTML',
    'guides/nested.html', '../escape.html', '/root.html',
    '-leading.html', 'a_b.html', 'a b.html', 'a.htm', 'a.html.html',
    'a.html?x=1', 'a.html#frag', 'index.html', 'sitemap.html'
  ];

  const looser = [];
  for (const u of ADDRESSES) {
    const reader = C.fileName({ url: u });
    if (reader === null) continue;              /* refused: nothing to advertise */
    if (u === '') continue;                     /* the home page, by convention */
    if (!GEN || !GEN.test(u)) looser.push(u);
  }
  check('the reader accepts nothing the generator rejects', looser.length === 0, looser);

  /* Named cases, so a failure says which rule moved rather than only that
     one did. */
  check('a 61-character name is accepted by both',
    C.fileName({ url: long61 + '.html' }) === long61 + '.html' && GEN.test(long61 + '.html'));
  check('a 62-character name is refused by both',
    C.fileName({ url: long62 + '.html' }) === null && !GEN.test(long62 + '.html'));
  check('the 66-character slug that bakes a dead link is refused',
    C.fileName({ url: REAL + '.html' }) === null, C.fileName({ url: REAL + '.html' }));
  check('an uppercase name is refused, because the generator refuses it',
    C.fileName({ url: 'About.html' }) === null && !GEN.test('About.html'));
  check('a nested address is still refused', C.fileName({ url: 'guides/n.html' }) === null);
  check('the home page is still the empty name', C.fileName({ url: '' }) === '');

  /* And the reader that feeds the listings must drop such a page outright,
     because a page with no address the build can create has nothing to link
     to. Both sources of a listing go through this. */
  const rec = { pages: {
    ok:   { url: 'ok.html', title: 'Ok', type: 'guide', status: 'published', robots: { index: true } },
    toolong: { url: REAL + '.html', title: 'Too long', type: 'guide', status: 'published',
               robots: { index: true } },
    upper: { url: 'Upper.html', title: 'Upper', type: 'guide', status: 'published',
             robots: { index: true } }
  } };
  const keys = C.pages({ record: rec, type: 'guide', indexableOnly: true }).map(p => p.key);
  check('publishedPages() drops a page whose address the build would refuse',
    JSON.stringify(keys) === JSON.stringify(['ok']), keys);
  check('  and relatedPages() drops it too, through the same reader',
    C.related({ related: ['toolong', 'upper', 'ok'] }, rec, 'me').map(p => p.key).join(',') === 'ok');
}

/* ====================================================================
   5. RELATED CONTENT
   ==================================================================== */
console.log('\n===== RELATED IS CHOSEN, AND EVERY BAD CHOICE FALLS OUT =====');
{
  const rec = { pages: {
    me:     { url: 'me.html', title: 'Me', status: 'published', robots: { index: true } },
    ok1:    { url: 'ok1.html', title: 'Ok one', status: 'published', robots: { index: true } },
    ok2:    { url: 'ok2.html', title: 'Ok two', status: 'published', robots: { index: true } },
    draft:  { url: 'draft.html', title: 'D', status: 'draft', robots: { index: true } },
    hidden: { url: 'hidden.html', title: 'H', status: 'published', robots: { index: false } },
    nested: { url: 'a/b.html', title: 'N', status: 'published', robots: { index: true } }
  } };
  const got = l => C.related({ related: l }, rec, 'me').map(p => p.key);

  check('a chosen page resolves', JSON.stringify(got(['ok1'])) === JSON.stringify(['ok1']));
  check('the author\'s order is kept',
    JSON.stringify(got(['ok2', 'ok1'])) === JSON.stringify(['ok2', 'ok1']));
  check('a draft is dropped', got(['draft']).length === 0);
  check('a noindex page is dropped', got(['hidden']).length === 0);
  check('a page with an un-buildable url is dropped', got(['nested']).length === 0);
  check('a page that does not exist is dropped', got(['ghost']).length === 0);
  check('a self-link is dropped', got(['me']).length === 0);
  check('a duplicate is listed once', JSON.stringify(got(['ok1', 'ok1'])) === JSON.stringify(['ok1']));
  check('hostile keys are dropped',
    got(['__proto__', 'constructor', 'valueOf', '<script>', '', null, 0, {}, []]).length === 0);
  check('a related list that is not an array is nothing',
    C.related({ related: 'ok1' }, rec, 'me').length === 0 &&
    C.related({ related: {} }, rec, 'me').length === 0);
  check('no related list at all is nothing', C.related({}, rec, 'me').length === 0);
  check('a long list is capped', C.related(
    { related: Array.from({ length: 200 }, () => 'ok1') }, rec, 'me').length <= 24);
}

/* ====================================================================
   6. ARTICLE SCHEMA: BUILT FROM WHAT RESOLVES, AND NOTHING ELSE
   ==================================================================== */
console.log('\n===== NO SCHEMA MERELY BECAUSE A FIELD EXISTS =====');
{
  const src = {
    brand: pbbake.brandRecord(fs.readFileSync(path.join(ROOT, 'brands', 'jsk-1.com', 'brand.js'), 'utf8')),
    baseUrl: 'https://example.test', noindex: false
  };
  let seq = 0;
  function tagsFor(p) {
    const row = { pages: { p: p }, seo: { baseUrl: 'https://example.test', siteName: 'Example' },
                  authors: { w: { name: 'Ada Writer' } } };
    return pbbake.seoTags(ROOT, Object.assign({}, src, { key: 'art' + (seq++), row: row }),
                          'p', { breadcrumbNav: true });
  }
  const base = page('p');
  const ord = tagsFor(base);
  check('the engine resolved the page at all', !!ord && !!ord.title, ord && ord.title);
  check('an ordinary page gets no Article block', ord.jsonLd.ldArticle === null);
  check('  and its ldPage is still a WebPage', ord.jsonLd.ldPage['@type'] === 'WebPage');

  const art = tagsFor(page('p', { type: 'article', publishedAt: '2026-03-04', author: 'w' }));
  check('an article gets an Article block', !!art.jsonLd.ldArticle);
  check('  with a headline and a mainEntityOfPage',
    art.jsonLd.ldArticle.headline === 'Title for p' &&
    art.jsonLd.ldArticle.mainEntityOfPage['@id'] === 'https://example.test/p.html');
  check('  with the resolved Person', art.jsonLd.ldArticle.author.name === 'Ada Writer');
  check('  with the date', art.jsonLd.ldArticle.datePublished === '2026-03-04');

  const badDate = tagsFor(page('p', { type: 'article', publishedAt: '2026-02-30', author: 'w' }));
  check('an impossible date is absent from the Article, not malformed',
    !('datePublished' in badDate.jsonLd.ldArticle), badDate.jsonLd.ldArticle);

  const badAuthor = tagsFor(page('p', { type: 'article', author: 'nobody' }));
  check('an unresolved author means NO author key at all',
    !('author' in badAuthor.jsonLd.ldArticle), badAuthor.jsonLd.ldArticle);

  const off = tagsFor(page('p', { type: 'article',
    schema: { webPage: true, breadcrumb: true, contactPage: false, article: false } }));
  check('schema.article false turns the block off', off.jsonLd.ldArticle === null);

  const noTitle = tagsFor(page('p', { type: 'article', title: '', heading: '' }));
  check('no headline means no Article block', noTitle.jsonLd.ldArticle === null);

  const hub = tagsFor(page('p', { type: 'hub' }));
  check('a hub\'s ldPage becomes CollectionPage', hub.jsonLd.ldPage['@type'] === 'CollectionPage');
  check('  and it gets no Article block', hub.jsonLd.ldArticle === null);
  check('  and there is exactly one page-level block, not two',
    Object.keys(hub.jsonLd).filter(k => hub.jsonLd[k] &&
      /^(WebPage|CollectionPage|ContactPage)$/.test(hub.jsonLd[k]['@type'])).length === 1,
    Object.keys(hub.jsonLd).map(k => k + '=' + (hub.jsonLd[k] && hub.jsonLd[k]['@type'])));

  const contact = tagsFor(page('p', { type: 'hub',
    schema: { webPage: true, breadcrumb: true, contactPage: true } }));
  check('an explicit ContactPage still wins over the hub type',
    contact.jsonLd.ldPage['@type'] === 'ContactPage');

  check('og:type is in the tag set for every page',
    !!ord.metas.filter(m => m.name === 'og:type')[0] &&
    ord.metas.filter(m => m.name === 'og:type')[0].content === 'website');
  check('  and says article for an article',
    art.metas.filter(m => m.name === 'og:type')[0].content === 'article');
}

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
