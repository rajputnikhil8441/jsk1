/* =====================================================================
   THE CONTENT ENGINE, IN THE HTML THE SITE SERVES  (Phase 2C)
   ---------------------------------------------------------------------
   test_content_types.js tests the readers. This tests the only thing a
   crawler can see: the bytes a real build writes. Every assertion below
   runs tools/build-site.js and reads the generated files.

   Three things it is here to prove:

   1. The content model reaches static HTML. og:type, the Article block, the
      related list, a hub's CollectionPage and its ItemList are all in the
      file before any JavaScript runs.

   2. It reaches static HTML for ONE BRAND ONLY. Two brands are built with
      different pages and different authors, and neither build may contain a
      trace of the other. The render context exists for this reason: the
      baker shares one engine across brands, so an element that read ambient
      state would have published the wrong brand's pages.

   3. Nothing that should not be published is. A draft article generates no
      file and no sitemap entry; a noindex article generates a file and no
      sitemap entry; neither appears in anybody's listing.
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cstatic-' + tag + '-'));
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
  try { return JSON.parse(m[1]); } catch (e) { return { PARSE_ERROR: m[1].slice(0, 200) }; }
}
function ldById(html, id) {
  const m = new RegExp('<script type="application/ld\\+json" id="' + id + '">([\\s\\S]*?)</script>')
    .exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return { PARSE_ERROR: m[1].slice(0, 200) }; }
}
const metaOf = (html, prop, name) =>
  (new RegExp('<meta ' + prop + '="' + name + '" content="([^"]*)"').exec(html) || [])[1];

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

/* A brand's record: its own committed layer, plus the content this suite
   adds. Built from the brand's own brand.js so the build is not refused for
   unpublishing what the committed layer publishes. */
function rowFor(brandId, file, mutate, brandsDir) {
  const dir = brandsDir || path.join(ROOT, 'brands');
  const base = JSON.parse(JSON.stringify(pbbake.brandRecord(
    fs.readFileSync(path.join(dir, brandId, 'brand.js'), 'utf8'))));
  base.pages = base.pages || {};
  mutate(base);
  const p = path.join(ROWS, file);
  fs.writeFileSync(p, JSON.stringify({ data: base, updated_at: '2026-06-01T12:00:00+00:00' }, null, 1));
  return p;
}

/* ====================================================================
   1. AN ARTICLE, A HUB AND A RELATED LIST, IN THE BYTES
   ==================================================================== */
console.log('\n===== THE CONTENT MODEL IS IN THE STATIC HTML =====');
const A_OUT = mktmp('a');
let aDir = '';
{
  const row = rowFor('jsk-1.com', 'a.json', d => {
    d.authors = { ada: { name: 'Ada Writer', bio: 'Writes the guides.', url: 'about.html' } };
    d.pages['g-one'] = page('g-one', { type: 'guide', publishedAt: '2026-01-15', author: 'ada',
      excerpt: 'How to do the first thing.', builder: pub([
        el('e1', 'heading', { text: 'Step one', level: 'h2' }) ]) });
    d.pages['g-two'] = page('g-two', { type: 'guide', publishedAt: '2026-04-20',
      excerpt: 'How to do the second thing.',
      related: ['g-one', 'g-draft', 'g-hidden', 'ghost', 'g-two'],
      builder: pub([ el('e2', 'pageList', { source: 'related', title: 'Related guides',
        titleLevel: 'h2', excerpt: true, date: true, author: true, limit: 5 }) ]) });
    d.pages['g-draft'] = page('g-draft', { type: 'guide', status: 'draft', publishedAt: '2026-05-05' });
    d.pages['g-hidden'] = page('g-hidden', { type: 'guide', publishedAt: '2026-05-06',
      robots: { index: false, follow: true } });
    d.pages['hub'] = page('hub', { type: 'hub', builder: pub([
      el('e3', 'pageList', { source: 'type', contentType: 'guide', title: 'All guides',
        titleLevel: 'h2', excerpt: true, date: true, schema: true, limit: 10 }) ]) });
  });
  const r = build(['jsk-1.com', '--row', rel(row), '--out', A_OUT]);
  check('a build carrying articles, a hub and a related list succeeds', r.ok, r.out.slice(-600));
  aDir = path.join(A_OUT, fs.readdirSync(A_OUT)[0]);

  const one = read(path.join(aDir, 'g-one.html'));
  check('an article page is generated', one.length > 0);
  check('  og:type is article IN THE SOURCE', metaOf(one, 'property', 'og:type') === 'article',
    metaOf(one, 'property', 'og:type'));
  const art = ldOf(one, 'data-pb-article');
  check('  the Article block is in the source', !!art && art['@type'] === 'Article', art);
  check('  with the resolved author as a Person',
    art && art.author && art.author['@type'] === 'Person' && art.author.name === 'Ada Writer',
    art && art.author);
  check('  with an absolute author url', art && art.author.url === 'https://jsk-1.com/about.html',
    art && art.author.url);
  check('  with datePublished and dateModified',
    art && art.datePublished === '2026-01-15' && art.dateModified === '2026-06-01', art);
  check('  with the excerpt as the description',
    art && art.description === 'How to do the first thing.', art && art.description);
  check('  and valid JSON (it parsed)', art && !art.PARSE_ERROR);
  check('  exactly one Article block on the page',
    (one.match(/data-pb-article="1"/g) || []).length === 1);

  /* An ordinary page in the same build must be untouched by all of this. */
  const about = read(path.join(aDir, 'about.html'));
  check('an ordinary page in the same build has no Article block',
    !/data-pb-article/.test(about));
  check('  and its og:type is still website', metaOf(about, 'property', 'og:type') === 'website');

  const two = read(path.join(aDir, 'g-two.html'));
  check('the related list is in the source', /pb-pagelist/.test(two));
  check('  it links to the page that resolves', /href="g-one\.html"/.test(two));
  check('  the draft is not in it', !/g-draft/.test(two));
  check('  the noindex page is not in it', !/g-hidden/.test(two));
  check('  the missing page is not in it', !/ghost/.test(two));
  check('  the page does not link to itself', !/href="g-two\.html"/.test(two));
  check('  the author name is rendered', /Ada Writer/.test(two));
  check('  the date is rendered as a machine-readable time',
    /<time class="pb-pagelist-date" datetime="2026-01-15">/.test(two));
  check('  the excerpt is rendered', /How to do the first thing\./.test(two));

  const hub = read(path.join(aDir, 'hub.html'));
  check('a hub page declares itself a CollectionPage in the source',
    (ldById(hub, 'ldPage') || {})['@type'] === 'CollectionPage',
    (ldById(hub, 'ldPage') || {})['@type']);
  const list = ldOf(hub, 'data-pb-list');
  check('  with an ItemList in the source', !!list && list['@type'] === 'ItemList', list);
  check('  listing the two published indexable guides, newest first',
    list && list.itemListElement.length === 2 &&
    /g-two\.html$/.test(list.itemListElement[0].url) &&
    /g-one\.html$/.test(list.itemListElement[1].url),
    list && list.itemListElement.map(x => x.url));
  check('  with absolute urls on this brand',
    list && list.itemListElement.every(x => x.url.indexOf('https://jsk-1.com/') === 0));
  check('  positions start at 1 and are sequential',
    list && list.itemListElement.every((x, i) => x.position === i + 1));
  check('  exactly one ItemList block', (hub.match(/data-pb-list="1"/g) || []).length === 1);
  check('  the ItemList matches what the page actually drew',
    list && list.itemListElement.every(x => hub.indexOf('href="' + x.url.split('/').pop() + '"') > -1));
  check('  and the hub gets no Article block', !/data-pb-article/.test(hub));

  /* Drafts and noindex pages: files, and the sitemap. */
  check('a draft article generates no file', !fs.existsSync(path.join(aDir, 'g-draft.html')));
  check('a noindex article DOES generate a file', fs.existsSync(path.join(aDir, 'g-hidden.html')));
  const sm = read(path.join(aDir, 'sitemap.xml'));
  check('the draft is not in the sitemap', sm.indexOf('g-draft') === -1);
  check('the noindex page is not in the sitemap', sm.indexOf('g-hidden') === -1);
  check('the published articles ARE in the sitemap',
    sm.indexOf('/g-one.html') > -1 && sm.indexOf('/g-two.html') > -1);
  check('the hub is in the sitemap', sm.indexOf('/hub.html') > -1);
  check('no sitemap entry names another brand', sm.indexOf('playzone9') === -1);
}

/* ====================================================================
   2. WHITE LABEL: TWO BRANDS, NOTHING CROSSES
   ==================================================================== */
console.log('\n===== ONE BRAND\'S CONTENT NEVER REACHES ANOTHER\'S BUILD =====');
{
  const B_OUT = mktmp('b');
  const row = rowFor('playzone9.app', 'b.json', d => {
    d.authors = { bo: { name: 'Bo Playzone' } };
    d.pages['p-one'] = page('p-one', { type: 'guide', publishedAt: '2026-02-02', author: 'bo',
      excerpt: 'Brand B only.', builder: pub([ el('b1', 'heading', { text: 'B', level: 'h2' }) ]) });
    d.pages['p-hub'] = page('p-hub', { type: 'hub', builder: pub([
      el('b2', 'pageList', { source: 'type', contentType: 'guide', title: 'B guides',
        schema: true, limit: 10 }) ]) });
  });
  const r = build(['playzone9.app', '--row', rel(row), '--out', B_OUT]);
  check('brand B builds its own content', r.ok, r.out.slice(-600));
  const bDir = path.join(B_OUT, fs.readdirSync(B_OUT)[0]);
  const bText = walk(bDir).filter(f => /\.(html|xml|txt)$/.test(f))
    .map(f => read(path.join(bDir, f))).join('\n');

  for (const marker of ['Ada Writer', 'g-one', 'g-two', 'How to do the first thing',
                        'All guides', 'jsk-1.com'])
    check('brand B publishes no trace of brand A\'s "' + marker + '"',
      bText.indexOf(marker) === -1);

  const aText = walk(aDir).filter(f => /\.(html|xml|txt)$/.test(f))
    .map(f => read(path.join(aDir, f))).join('\n');
  for (const marker of ['Bo Playzone', 'p-one', 'Brand B only', 'B guides', 'playzone9.app'])
    check('brand A publishes no trace of brand B\'s "' + marker + '"',
      aText.indexOf(marker) === -1);

  const bHub = read(path.join(bDir, 'p-hub.html'));
  const bList = ldOf(bHub, 'data-pb-list');
  check('brand B\'s hub lists only brand B\'s guide',
    bList && bList.itemListElement.length === 1 &&
    bList.itemListElement[0].url === 'https://playzone9.app/p-one.html',
    bList && bList.itemListElement);
  check('brand B\'s author resolves to brand B\'s author',
    (ldOf(read(path.join(bDir, 'p-one.html')), 'data-pb-article') || {}).author.name === 'Bo Playzone');

  /* A page referring to an author id that exists only on the other brand. */
  const C_OUT = mktmp('c');
  const row2 = rowFor('playzone9.app', 'b2.json', d => {
    d.authors = {};
    d.pages['p-x'] = page('p-x', { type: 'guide', publishedAt: '2026-02-02', author: 'ada',
      builder: pub([ el('b3', 'heading', { text: 'X', level: 'h2' }) ]) });
  });
  const r2 = build(['playzone9.app', '--row', rel(row2), '--out', C_OUT]);
  check('a page naming another brand\'s author id still builds', r2.ok, r2.out.slice(-400));
  const cHtml = read(path.join(C_OUT, fs.readdirSync(C_OUT)[0], 'p-x.html'));
  const cArt = ldOf(cHtml, 'data-pb-article');
  check('  and publishes no author at all, not a borrowed one',
    cArt && !('author' in cArt), cArt && cArt.author);
  check('  and no trace of the other brand\'s author name', cHtml.indexOf('Ada Writer') === -1);

  /* A related list naming a page that exists only on the other brand. */
  const D_OUT = mktmp('d');
  const row3 = rowFor('playzone9.app', 'b3.json', d => {
    d.pages['p-y'] = page('p-y', { type: 'guide', publishedAt: '2026-02-02',
      related: ['g-one', 'g-two'],
      builder: pub([ el('b4', 'pageList', { source: 'related', title: 'Related' }) ]) });
  });
  const r3 = build(['playzone9.app', '--row', rel(row3), '--out', D_OUT]);
  check('a page whose related list names another brand\'s pages still builds', r3.ok, r3.out.slice(-400));
  const dHtml = read(path.join(D_OUT, fs.readdirSync(D_OUT)[0], 'p-y.html'));
  check('  the listing renders nothing rather than a cross-brand link',
    !/pb-pagelist/.test(dHtml) && dHtml.indexOf('g-one') === -1, dHtml.length);
}

/* ====================================================================
   3. TWO BRANDS IN ONE PROCESS
   --------------------------------------------------------------------
   loadEngine() shares one engine, and seoEngine() caches per brand. Asking
   about A, then B, then A again must still describe A -- before this was
   fixed it described B.
   ==================================================================== */
console.log('\n===== THE SHARED ENGINE ANSWERS FOR THE BRAND IT WAS ASKED ABOUT =====');
{
  const src = id => ({ key: id,
    brand: pbbake.brandRecord(fs.readFileSync(path.join(ROOT, 'brands', id, 'brand.js'), 'utf8')),
    row: null, baseUrl: 'https://' + id, noindex: false });
  const A = src('jsk-1.com'), B = src('playzone9.app');
  const can = t => t && t.links && t.links[0] && t.links[0].href;
  const a1 = pbbake.seoTags(ROOT, A, 'about', { breadcrumbNav: true });
  const b1 = pbbake.seoTags(ROOT, B, 'about', { breadcrumbNav: true });
  const a2 = pbbake.seoTags(ROOT, A, 'about', { breadcrumbNav: true });
  check('brand A resolved at all', !!a1 && !!can(a1), can(a1));
  check('brand B resolved at all', !!b1 && !!can(b1), can(b1));
  check('A and B are different brands', can(a1) !== can(b1));
  check('asking A again after B still answers for A', can(a2) === can(a1), can(a2));
  check('  and the whole tag set is identical, not just the canonical',
    JSON.stringify(a1) === JSON.stringify(a2));

  /* The page reader is a pure function of its record, so it cannot be
     affected by whichever brand the engine last loaded. */
  const recA = { pages: { x: { url: 'x.html', title: 'A page', status: 'published',
                              robots: { index: true } } } };
  const recB = { pages: { y: { url: 'y.html', title: 'B page', status: 'published',
                              robots: { index: true } } } };
  const CMS = pbbake.loadEngine(ROOT).CMS;
  const ka = CMS.content.pages({ record: recA }).map(p => p.key);
  const kb = CMS.content.pages({ record: recB }).map(p => p.key);
  const ka2 = CMS.content.pages({ record: recA }).map(p => p.key);
  check('the page reader answers from the record it was handed',
    JSON.stringify(ka) === '["x"]' && JSON.stringify(kb) === '["y"]' &&
    JSON.stringify(ka2) === '["x"]', { ka, kb, ka2 });
}

/* ====================================================================
   4. HOSTILE CONTENT REACHES THE PAGE AS TEXT, NEVER AS MARKUP
   ==================================================================== */
console.log('\n===== HOSTILE STRINGS ARE TEXT =====');
{
  const E_OUT = mktmp('e');
  const XSS = '</script><script>alert(1)</script>';
  const row = rowFor('jsk-1.com', 'e.json', d => {
    d.authors = { bad: { name: 'Eve' + XSS, bio: XSS, url: 'javascript:alert(1)',
                         image: 'data:image/png;base64,AAA' } };
    d.pages['x-one'] = page('x-one', { type: 'article', publishedAt: '2026-01-01', author: 'bad',
      excerpt: 'Excerpt ' + XSS, title: 'Title ' + XSS,
      builder: pub([ el('x1', 'heading', { text: 'H', level: 'h2' }) ]) });
    d.pages['x-two'] = page('x-two', { type: 'hub', builder: pub([
      el('x2', 'pageList', { source: 'type', contentType: 'article', title: 'Articles' + XSS,
                             excerpt: true, author: true, schema: true }) ]) });
  });
  const r = build(['jsk-1.com', '--row', rel(row), '--out', E_OUT]);
  check('a build carrying hostile strings succeeds', r.ok, r.out.slice(-600));
  const dir = path.join(E_OUT, fs.readdirSync(E_OUT)[0]);
  const one = read(path.join(dir, 'x-one.html'));
  const two = read(path.join(dir, 'x-two.html'));

  check('the Article JSON-LD still parses with a </script> in the author name',
    !!ldOf(one, 'data-pb-article') && !ldOf(one, 'data-pb-article').PARSE_ERROR);
  check('  and the payload is escaped, not closing the block early',
    one.indexOf('</script><script>alert(1)</script>') === -1);
  check('  the escaped form is what is stored', /\\u003c\/script/.test(one));
  check('the javascript: author url never reaches the Article',
    (ldOf(one, 'data-pb-article').author || {}).url === undefined);
  check('the data: author image never reaches the Article',
    (ldOf(one, 'data-pb-article').author || {}).image === undefined);
  check('the ItemList still parses with a hostile title in the listing',
    !!ldOf(two, 'data-pb-list') && !ldOf(two, 'data-pb-list').PARSE_ERROR);
  check('no page grew an executable script tag from content',
    !/<script>alert\(1\)<\/script>/.test(one) && !/<script>alert\(1\)<\/script>/.test(two));
  check('the listing heading is escaped in the markup',
    two.indexOf('<h2 class="pb-pagelist-title"') > -1 &&
    !/<h2 class="pb-pagelist-title"[^>]*><\/script>/.test(two));

  /* Every generated page must still be a document whose scripts all close. */
  for (const f of walk(dir).filter(x => /\.html$/.test(x))) {
    const h = read(path.join(dir, f));
    const opens = (h.match(/<script\b/g) || []).length;
    const closes = (h.match(/<\/script>/g) || []).length;
    if (opens !== closes) check('script tags balance in ' + f, false, { opens, closes });
  }
  check('script tags balance in every generated page', true);
}

/* ====================================================================
   5. A THIRD BRAND THAT IS ONLY A DIRECTORY
   ==================================================================== */
console.log('\n===== THE CONTENT MODEL IS A PROPERTY OF THE RECORD, NOT OF THESE BRANDS =====');
{
  const synth = path.join(__dirname, 'fixtures', 'brands');
  if (fs.existsSync(synth)) {
    const root = mktmp('third');
    const brandsDir = path.join(root, 'brands');
    fs.cpSync(synth, brandsDir, { recursive: true });
    const id = fs.readdirSync(brandsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name).sort()[0];
    const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'seo-config.json'), 'utf8'));
    seo.seo = seo.seo || {};
    seo.seo.baseUrl = 'https://' + id;
    fs.writeFileSync(path.join(brandsDir, id, 'seo-config.json'), JSON.stringify(seo, null, 2) + '\n');

    const row = rowFor(id, 'third.json', d => {
      d.authors = { cee: { name: 'Cee Third' } };
      d.pages['t-art'] = page('t-art', { type: 'article', publishedAt: '2026-03-03', author: 'cee',
        excerpt: 'Third brand content.',
        builder: pub([ el('t1', 'heading', { text: 'T', level: 'h2' }) ]) });
      d.pages['t-hub'] = page('t-hub', { type: 'hub', builder: pub([
        el('t2', 'pageList', { source: 'type', contentType: 'article', title: 'Articles',
                               schema: true }) ]) });
    }, brandsDir);
    const out = mktmp('third-out');
    const r = build([id, '--brands', rel(brandsDir), '--row', rel(row), '--out', out]);
    check('a third brand publishes articles and a hub with no shared-code change',
      r.ok, r.out.slice(-600));
    const dir = path.join(out, fs.readdirSync(out)[0]);
    const art = ldOf(read(path.join(dir, 't-art.html')), 'data-pb-article');
    check('  its Article names its own author', art && art.author.name === 'Cee Third', art);
    check('  on its own domain',
      art && art.mainEntityOfPage['@id'] === 'https://' + id + '/t-art.html',
      art && art.mainEntityOfPage);
    const list = ldOf(read(path.join(dir, 't-hub.html')), 'data-pb-list');
    check('  its hub lists its own article',
      list && list.itemListElement.length === 1 &&
      list.itemListElement[0].url === 'https://' + id + '/t-art.html',
      list && list.itemListElement);
    const text = walk(dir).filter(f => /\.(html|xml|txt)$/.test(f))
      .map(f => read(path.join(dir, f))).join('\n');
    for (const m of ['Ada Writer', 'Bo Playzone', 'g-one', 'p-one'])
      check('  and no trace of any other brand\'s "' + m + '"', text.indexOf(m) === -1);
  }
}

/* ====================================================================
   6. STAGING: NOINDEX STILL WINS OVER EVERYTHING
   ==================================================================== */
console.log('\n===== A REVIEW HOST PUBLISHES CONTENT TYPES AND INDEXES NOTHING =====');
{
  const out = mktmp('stg');
  const row = rowFor('playzone9.app', 'stg.json', d => {
    d.seo = d.seo || {};
    d.seo.baseUrl = 'https://playzones9.com';
    d.authors = { s: { name: 'Stag Writer' } };
    d.pages['s-art'] = page('s-art', { type: 'article', publishedAt: '2026-03-03', author: 's',
      builder: pub([ el('s1', 'heading', { text: 'S', level: 'h2' }) ]) });
  });
  const r = build(['playzone9.app', '--env', 'staging', '--row', rel(row), '--out', out]);
  check('a staging build with content types succeeds', r.ok, r.out.slice(-600));
  const dir = path.join(out, fs.readdirSync(out)[0]);
  const html = read(path.join(dir, 's-art.html'));
  check('the article page is noindex on the review host',
    metaOf(html, 'name', 'robots') === 'noindex,nofollow', metaOf(html, 'name', 'robots'));
  check('  og:type is still article -- the type is not what noindex changes',
    metaOf(html, 'property', 'og:type') === 'article');
  check('  the Article block is still there and well formed',
    !!ldOf(html, 'data-pb-article') && !ldOf(html, 'data-pb-article').PARSE_ERROR);
  check('  and there is no sitemap at all', !fs.existsSync(path.join(dir, 'sitemap.xml')));
}

for (const d of tmpRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
