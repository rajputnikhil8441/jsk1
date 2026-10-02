/* =====================================================================
   CATEGORIES, TAGS AND AUTOMATIC RELATED CONTENT  (Phase 2F)
   ---------------------------------------------------------------------
   Two collections, two page fields, one scorer. Small enough to describe
   in a sentence, which is exactly why it needs this suite: a taxonomy
   that silently resolves the wrong thing is worse than no taxonomy, and
   a "related" list that quietly relates two unrelated pages damages
   every page it appears on.

   So the assertions below are mostly about REFUSAL:

     - an id that names nothing resolves to nothing, and nothing is
       published from it -- no stray label, no empty chip;
     - a prototype key is not an entry;
     - a category or a tag on a kind of page that does not carry one is
       ignored, not honoured;
     - a shared YEAR does not make two pages related (the case that
       earned the two-tag rule);
     - same content type alone never relates anything;
     - a draft, a noindex page, an un-generatable address and the page
       itself are not candidates, because the pool is publishedPages()
       and nothing here re-implements it.

   And about ORDER: the result is a total order over a pure function of
   the record, so two builds of one record produce the same bytes.

   tests/test_taxonomy_static.js proves the same things about the HTML a
   real build writes. This suite tests the readers.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const CMS = pbbake.loadEngine(ROOT).CMS;
const C = CMS.content;

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
    inSitemap: true, status: 'published', updatedAt: '2026-06-01'
  }, extra || {});
}
const keys = rows => rows.map(r => r.key);
const ids  = rows => rows.map(r => r.id);
const summary = (rec, k) => C.pages({ record: rec }).filter(r => r.key === k)[0];

/* ====================================================================
   1. THE DATA MODEL IS OPTIONAL AND EMPTY
   ==================================================================== */
console.log('\n===== NOTHING IS ADDED TO A SITE THAT DOES NOT ASK FOR IT =====');
{
  const D = CMS.DEFAULTS;
  check('DEFAULTS has a categories collection', !!D.categories && typeof D.categories === 'object');
  check('DEFAULTS has a tags collection', !!D.tags && typeof D.tags === 'object');
  check('  categories ships empty', Object.keys(D.categories).length === 0, D.categories);
  check('  tags ships empty', Object.keys(D.tags).length === 0, D.tags);

  const slugs = Object.keys(D.pages);
  check('every shipped page has a category key', slugs.every(s => 'category' in D.pages[s]), slugs);
  check('every shipped page has a tags key', slugs.every(s => 'tags' in D.pages[s]));
  check('  every category ships empty', slugs.every(s => D.pages[s].category === ''));
  check('  every tags array ships empty',
    slugs.every(s => Array.isArray(D.pages[s].tags) && D.pages[s].tags.length === 0));

  /* The whole point of 2F being safe to merge: a record written before it
     existed still resolves, and resolves to nothing. */
  const old = { pages: { p: { label: 'p', url: 'p.html', title: 'T', status: 'published',
                              type: 'article' } } };
  check('a record from before Phase 2F resolves with no category',
    C.category(old.pages.p, old) === null);
  check('  and no tags', JSON.stringify(C.tags(old.pages.p, old)) === '[]');
  check('  and automatic related content finds nothing to match on',
    JSON.stringify(C.autoRelated(old.pages.p, old, 'p', 6)) === '[]');
}

/* ====================================================================
   2. WHICH CONTENT TYPES CARRY TAXONOMY
   ==================================================================== */
console.log('\n===== A PLAIN PAGE IS SITE FURNITURE, NOT CONTENT =====');
{
  check('taxonomy is carried by exactly article, guide, help, hub',
    JSON.stringify(Object.keys(C.taxonTypes).sort()) ===
    JSON.stringify(['article', 'guide', 'help', 'hub']), Object.keys(C.taxonTypes));
  check('  and NOT by page -- an about page has no topic',
    !Object.prototype.hasOwnProperty.call(C.taxonTypes, 'page'));

  const rec = { categories: { c: { name: 'Cricket', slug: 'cricket' } },
                tags: { t: { name: 'IPL', slug: 'ipl' } }, pages: {} };
  for (const t of ['article', 'guide', 'help', 'hub']) {
    const p = page('p', { type: t, category: 'c', tags: ['t'] });
    check('a ' + t + ' resolves its category', (C.category(p, rec) || {}).id === 'c');
    check('  and its tags', ids(C.tags(p, rec)).join() === 't');
  }
  /* Set by a type change or a hand-edited row. Ignored, never honoured,
     and never silently deleted from the record either. */
  for (const t of ['', 'page', 'Page', 'nonsense']) {
    const p = page('p', { type: t, category: 'c', tags: ['t'] });
    check('a page of type ' + JSON.stringify(t) + ' publishes no category',
      C.category(p, rec) === null, C.category(p, rec));
    check('  and no tags', C.tags(p, rec).length === 0);
  }
}

/* ====================================================================
   3. ONE RESOLVER, AND EVERY WAY AN ID CAN BE WRONG
   ==================================================================== */
console.log('\n===== AN ID THAT NAMES NOTHING PUBLISHES NOTHING =====');
{
  const all = {
    ok: { name: 'Cricket', slug: 'cricket', description: 'Bat and ball.' },
    noname: { slug: 'x' },
    blankname: { name: '   ', slug: 'x' },
    badslug: { name: 'Bad Slug', slug: 'Not A Slug!' },
    noslug: { name: 'No Slug' },
    notobj: 'a string',
    nulled: null,
    arr: ['Cricket'],
    long: { name: 'x'.repeat(400), slug: 'long' },
    longdesc: { name: 'D', slug: 'd', description: 'y'.repeat(900) }
  };
  const got = C.taxonFrom(all, 'ok');
  check('a complete entry resolves', !!got && got.id === 'ok' && got.name === 'Cricket');
  check('  with its slug', got.slug === 'cricket');
  check('  and its description', got.description === 'Bat and ball.');

  for (const bad of ['noname', 'blankname', 'notobj', 'nulled', 'arr'])
    check('"' + bad + '" resolves to null, so nothing is drawn for it',
      C.taxonFrom(all, bad) === null, C.taxonFrom(all, bad));

  /* A bad slug is DROPPED, not corrected: the admin derives a good one, and
     a hand-edited bad value should read as missing rather than be silently
     rewritten into something the editor never typed. */
  const bs = C.taxonFrom(all, 'badslug');
  check('an entry with an invalid slug still resolves by name', !!bs && bs.name === 'Bad Slug');
  check('  but its slug is empty, not corrected', bs.slug === '', bs.slug);
  check('an entry with no slug resolves with an empty one',
    (C.taxonFrom(all, 'noslug') || {}).slug === '');

  check('a name is capped at 120 characters', C.taxonFrom(all, 'long').name.length === 120);
  check('a description is capped at 400', C.taxonFrom(all, 'longdesc').description.length === 400);

  check('an id that is not in the collection resolves to null',
    C.taxonFrom(all, 'absent') === null);
  check('an empty id resolves to null', C.taxonFrom(all, '') === null);
  check('a null id resolves to null', C.taxonFrom(all, null) === null);
  check('no collection at all resolves to null', C.taxonFrom(null, 'ok') === null);
  check('a collection that is a string resolves to null', C.taxonFrom('ok', 'ok') === null);

  /* An inherited property is not an entry. */
  for (const hostile of ['__proto__', 'constructor', 'prototype', 'toString', 'valueOf',
                         'hasOwnProperty', 'isPrototypeOf'])
    check('the prototype key ' + hostile + ' is not a category',
      C.taxonFrom(all, hostile) === null, C.taxonFrom(all, hostile));
  check('  and resolving one did not pollute the collection',
    !Object.prototype.hasOwnProperty.call(all, 'polluted') && all.ok.name === 'Cricket');
}

/* ====================================================================
   4. TAGS: ORDER, DEDUPLICATION, CAP
   ==================================================================== */
console.log('\n===== TAGS ARE THE AUTHOR\'S LIST, CLEANED =====');
{
  const tags = {}; for (let i = 1; i <= 20; i++) tags['t' + i] = { name: 'Tag ' + i, slug: 't' + i };
  tags.nameless = { slug: 'n' };
  const rec = { tags: tags, categories: {}, pages: {} };

  check('tags come back in the author\'s order, not sorted',
    ids(C.tags(page('p', { type: 'article', tags: ['t3', 't1', 't2'] }), rec)).join() === 't3,t1,t2');
  check('a repeated tag appears once',
    ids(C.tags(page('p', { type: 'article', tags: ['t1', 't1', 't2', 't1'] }), rec)).join() === 't1,t2');
  check('a tag that resolves to nothing is dropped, and the rest survive',
    ids(C.tags(page('p', { type: 'article', tags: ['t1', 'absent', 'nameless', 't2'] }), rec))
      .join() === 't1,t2');
  check('the list is capped at 12',
    C.tags(page('p', { type: 'article',
      tags: Object.keys(tags).filter(k => k !== 'nameless') }), rec).length === 12);
  check('tags that is not an array yields nothing',
    C.tags(page('p', { type: 'article', tags: 't1' }), rec).length === 0);
  /* An id is a string. String(['t2']) is 't2', so without a type guard an
     array would resolve to a real tag -- it does not. */
  check('tags containing objects or arrays yield nothing resolvable',
    C.tags(page('p', { type: 'article', tags: [{ id: 't1' }, ['t2'], 1, null, true] }), rec)
      .length === 0);
  check('a page with no tags key yields an empty array',
    JSON.stringify(C.tags(page('p', { type: 'article' }), rec)) === '[]');
  check('one category is one category -- an array is not an id',
    C.category(page('p', { type: 'article', category: ['c'] }),
              { categories: { c: { name: 'C' } } }) === null);
  for (const notId of [1, 0, true, {}, [], ['c']])
    check('a category id of ' + JSON.stringify(notId) + ' resolves to nothing',
      C.taxonFrom({ c: { name: 'C' } }, notId) === null,
      C.taxonFrom({ c: { name: 'C' } }, notId));
}

/* ====================================================================
   5. TAXONOMY REACHES THE ONE PAGE READER
   ==================================================================== */
console.log('\n===== THE SUMMARY EVERY LISTING USES CARRIES RESOLVED TAXONOMY =====');
{
  const rec = { categories: { c: { name: 'Cricket', slug: 'cricket' } },
                tags: { t1: { name: 'IPL', slug: 'ipl' }, t2: { name: '2026', slug: '2026' } },
                pages: { p: page('p', { type: 'article', category: 'c', tags: ['t1', 't2'] }),
                         q: page('q', { type: 'page', category: 'c', tags: ['t1'] }) } };
  const rows = C.pages({ record: rec });
  const p = rows.filter(r => r.key === 'p')[0];
  const q = rows.filter(r => r.key === 'q')[0];
  check('publishedPages() is still the one reader and still returns both pages',
    keys(rows).join() === 'p,q', keys(rows));
  check('a summary carries the RESOLVED category object, not the stored id',
    !!p.category && p.category.name === 'Cricket' && p.category.id === 'c', p.category);
  check('  and the resolved tags', ids(p.tags).join() === 't1,t2');
  check('a plain page\'s summary carries no category', q.category === null);
  check('  and no tags', q.tags.length === 0);
}

/* ====================================================================
   6. THE SCORER
   ==================================================================== */
console.log('\n===== THREE VISIBLE SIGNALS, ADDED UP, AND NOTHING ELSE =====');
{
  const rec = {
    categories: { cricket: { name: 'Cricket', slug: 'cricket' },
                  football: { name: 'Football', slug: 'football' } },
    tags: { ipl: { name: 'IPL', slug: 'ipl' }, y26: { name: '2026', slug: '2026' },
            fin: { name: 'Final', slug: 'final' }, fifa: { name: 'FIFA', slug: 'fifa' } },
    pages: {
      /* The case that earned the two-tag rule. */
      a: page('a', { type: 'article', category: 'cricket', tags: ['ipl', 'y26', 'fin'],
                     publishedAt: '2026-01-01' }),
      b: page('b', { type: 'article', category: 'cricket', tags: ['ipl'],
                     publishedAt: '2026-02-01' }),
      c: page('c', { type: 'article', category: 'football', tags: ['fifa', 'y26'],
                     publishedAt: '2026-03-01' }),
      d: page('d', { type: 'guide', tags: ['ipl', 'y26'], publishedAt: '2026-04-01' }),
      e: page('e', { type: 'article', tags: ['y26'], publishedAt: '2026-05-01' })
    }
  };
  const S = k => summary(rec, k);

  check('same category + 1 shared tag + same type scores 3+1+1 = 5',
    C.score(S('a'), S('b')) === 5, C.score(S('a'), S('b')));
  check('a shared YEAR and nothing else scores 0 -- 2026 is not a topic',
    C.score(S('a'), S('c')) === 0, C.score(S('a'), S('c')));
  check('two shared tags with no shared category qualify, and score 2',
    C.score(S('a'), S('d')) === 2, C.score(S('a'), S('d')));
  check('one shared tag with no shared category scores 0',
    C.score(S('a'), S('e')) === 0, C.score(S('a'), S('e')));
  check('same content type ALONE relates nothing',
    C.score(S('c'), S('e')) === 0, C.score(S('c'), S('e')));
  check('the score is symmetric', C.score(S('a'), S('b')) === C.score(S('b'), S('a')));
  check('a missing side scores 0', C.score(null, S('a')) === 0 && C.score(S('a'), null) === 0);

  /* A category is matched by ID, not by name: two brands may both have a
     "News", and a renamed category must not silently unrelate everything. */
  const byName = { category: { id: 'x', name: 'Cricket' }, tags: [], type: 'article' };
  check('a category with the same NAME but a different id does not match',
    C.score(S('a'), byName) === 0, C.score(S('a'), byName));
}

/* ====================================================================
   7. THE CANDIDATE POOL IS publishedPages(), NOT A SECOND OPINION
   ==================================================================== */
console.log('\n===== DRAFTS, NOINDEX, DEAD ADDRESSES AND THE PAGE ITSELF ARE NOT CANDIDATES =====');
{
  const rec = {
    categories: { c: { name: 'Cricket', slug: 'cricket' } },
    tags: { t: { name: 'IPL', slug: 'ipl' } },
    pages: {
      self: page('self', { type: 'article', category: 'c', tags: ['t'], publishedAt: '2026-01-01' }),
      live: page('live', { type: 'article', category: 'c', tags: ['t'], publishedAt: '2026-02-01' }),
      draft: page('draft', { type: 'article', category: 'c', tags: ['t'], status: 'draft' }),
      hidden: page('hidden', { type: 'article', category: 'c', tags: ['t'],
                               robots: { index: false, follow: true } }),
      /* 62 characters before .html: one past what the generator will create,
         so no file exists and nothing may link to it. */
      toolong: page('toolong', { type: 'article', category: 'c', tags: ['t'],
                                 url: 'x'.repeat(62) + '.html' }),
      upper: page('upper', { type: 'article', category: 'c', tags: ['t'], url: 'Upper.html' }),
      nourl: page('nourl', { type: 'article', category: 'c', tags: ['t'], url: 'no slashes/ok.html' })
    }
  };
  const got = keys(C.autoRelated(rec.pages.self, rec, 'self', 6));
  check('only the one genuinely published, indexable, addressable page is a candidate',
    got.join() === 'live', got);
  check('  the page itself is never related to itself', got.indexOf('self') === -1);
  for (const bad of ['draft', 'hidden', 'toolong', 'upper', 'nourl'])
    check('  "' + bad + '" is not a candidate', got.indexOf(bad) === -1);

  /* The same rule the generator applies, proved through this path too. */
  check('a 61-character slug IS a candidate -- the cap is 61, not 60',
    keys(C.autoRelated(rec.pages.self, {
      categories: rec.categories, tags: rec.tags,
      pages: { self: rec.pages.self,
               ok: page('ok', { type: 'article', category: 'c', tags: ['t'],
                                url: 'y'.repeat(61) + '.html' }) }
    }, 'self', 6)).join() === 'ok');

  /* A plain page is not a candidate for anybody, because it has no
     resolvable taxonomy to score against. */
  check('a plain page with a stored category is not a candidate',
    keys(C.autoRelated(rec.pages.self, {
      categories: rec.categories, tags: rec.tags,
      pages: { self: rec.pages.self,
               plain: page('plain', { type: 'page', category: 'c', tags: ['t'] }) }
    }, 'self', 6)).length === 0);

  check('a page with nothing to match on gets nothing back',
    C.autoRelated(page('x', { type: 'article' }), rec, 'x', 6).length === 0);
  check('a plain page asks for nothing at all',
    C.autoRelated(page('x', { type: 'page', category: 'c' }), rec, 'x', 6).length === 0);
  check('no page at all returns an empty list', C.autoRelated(null, rec, 'x', 6).length === 0);
}

/* ====================================================================
   8. ORDER IS TOTAL AND DETERMINISTIC
   ==================================================================== */
console.log('\n===== SCORE, THEN NEWEST, THEN KEY -- NO TIE LEFT TO CHANCE =====');
{
  const rec = {
    categories: { c: { name: 'C', slug: 'c' } },
    tags: { t1: { name: 'T1', slug: 't1' }, t2: { name: 'T2', slug: 't2' } },
    pages: {
      self: page('self', { type: 'article', category: 'c', tags: ['t1', 't2'] }),
      /* score 5: same cat, 2 tags... minus one tag, see below */
      hi: page('hi', { type: 'article', category: 'c', tags: ['t1', 't2'] }),
      mid: page('mid', { type: 'article', category: 'c', tags: ['t1'] }),
      lo: page('lo', { type: 'guide', category: 'c', tags: [] })
    }
  };
  check('a higher score comes first regardless of date or key',
    keys(C.autoRelated(rec.pages.self, rec, 'self', 6)).join() === 'hi,mid,lo',
    keys(C.autoRelated(rec.pages.self, rec, 'self', 6)));

  /* Equal scores: newest publishedAt wins, then the key alphabetically. */
  const tie = {
    categories: rec.categories, tags: rec.tags,
    pages: {
      self: page('self', { type: 'article', category: 'c', tags: ['t1'] }),
      zebra: page('zebra', { type: 'article', category: 'c', tags: ['t1'], publishedAt: '2026-01-01' }),
      alpha: page('alpha', { type: 'article', category: 'c', tags: ['t1'], publishedAt: '2026-05-01' }),
      undated: page('undated', { type: 'article', category: 'c', tags: ['t1'] }),
      bravo: page('bravo', { type: 'article', category: 'c', tags: ['t1'], publishedAt: '2026-05-01' })
    }
  };
  const ord = keys(C.autoRelated(tie.pages.self, tie, 'self', 6));
  check('equal scores order newest first, then by key, with undated last',
    ord.join() === 'alpha,bravo,zebra,undated', ord);

  /* Determinism, stated as the property that matters: the same record in a
     different key order produces the same list. */
  const shuffled = { categories: tie.categories, tags: tie.tags, pages: {} };
  for (const k of ['bravo', 'undated', 'self', 'alpha', 'zebra']) shuffled.pages[k] = tie.pages[k];
  check('  and the insertion order of the record cannot change it',
    keys(C.autoRelated(shuffled.pages.self, shuffled, 'self', 6)).join() === ord.join());
  check('  two calls on one record agree',
    keys(C.autoRelated(tie.pages.self, tie, 'self', 6)).join() === ord.join());

  check('the limit is honoured', keys(C.autoRelated(tie.pages.self, tie, 'self', 2)).join() ===
    'alpha,bravo');
  check('a limit of 0 still yields at least one rather than an empty list',
    C.autoRelated(tie.pages.self, tie, 'self', 0).length === 1);
  check('a limit above the ceiling is clamped to 6',
    C.autoRelated(tie.pages.self, tie, 'self', 999).length <= 6);
  check('a nonsense limit falls back to the default',
    C.autoRelated(tie.pages.self, tie, 'self', 'lots').length === 4);
}

/* ====================================================================
   9. MANUAL FIRST, ALWAYS
   ==================================================================== */
console.log('\n===== AN EDITOR\'S CHOICE IS NEVER DEMOTED BY THE MACHINE AGREEING =====');
{
  const rec = {
    categories: { c: { name: 'C', slug: 'c' }, o: { name: 'O', slug: 'o' } },
    tags: { t: { name: 'T', slug: 't' } },
    pages: {
      self: page('self', { type: 'article', category: 'c', tags: ['t'] }),
      auto1: page('auto1', { type: 'article', category: 'c', tags: ['t'], publishedAt: '2026-05-01' }),
      auto2: page('auto2', { type: 'article', category: 'c', tags: ['t'], publishedAt: '2026-04-01' }),
      unrelated: page('unrelated', { type: 'article', category: 'o' }),
      plain: page('plain', { type: 'page' })
    }
  };
  const withManual = extra => Object.assign({}, rec.pages.self, extra);

  check('with no manual choices, the list is purely automatic',
    keys(C.relatedCombined(rec.pages.self, rec, 'self', 4)).join() === 'auto1,auto2');

  const m = withManual({ related: ['unrelated', 'plain'] });
  const got = keys(C.relatedCombined(m, rec, 'self', 4));
  check('manual choices come first, in the author\'s order',
    got[0] === 'unrelated' && got[1] === 'plain', got);
  check('  including a page automatic would never pick',
    got.indexOf('unrelated') === 0);
  check('  then automatic fills the rest', got.join() === 'unrelated,plain,auto1,auto2', got);

  const both = withManual({ related: ['auto2'] });
  const bothGot = keys(C.relatedCombined(both, rec, 'self', 4));
  check('a page chosen by hand AND found automatically appears once',
    bothGot.filter(k => k === 'auto2').length === 1, bothGot);
  check('  in its MANUAL position, ahead of a higher-scoring automatic one',
    bothGot.join() === 'auto2,auto1', bothGot);

  const full = withManual({ related: ['unrelated', 'plain', 'auto1', 'auto2'] });
  check('when manual choices fill the limit, nothing automatic is added',
    keys(C.relatedCombined(full, rec, 'self', 2)).join() === 'unrelated,plain');

  check('relatedPages() still means EXACTLY what was chosen, and nothing more',
    keys(C.related(m, rec, 'self')).join() === 'unrelated,plain');
  check('  and is unchanged for a page with no choices',
    C.related(rec.pages.self, rec, 'self').length === 0);

  /* A plain page: manual related content still works, automatic adds nothing. */
  const plainManual = page('p', { type: 'page', related: ['auto1'] });
  check('a plain page keeps its manual related content',
    keys(C.relatedCombined(plainManual, rec, 'p', 4)).join() === 'auto1');
  check('  and gets no automatic fill', C.autoRelated(plainManual, rec, 'p', 4).length === 0);
}

/* ====================================================================
   10. WHITE LABEL: AN ID IS ONLY AN ID INSIDE ITS OWN BRAND
   ==================================================================== */
console.log('\n===== ONE BRAND\'S CATEGORY IS NOT ANOTHER\'S =====');
{
  const brandA = {
    categories: { news: { name: 'A News', slug: 'a-news' } },
    tags: { hot: { name: 'A Hot', slug: 'a-hot' } },
    pages: { a1: page('a1', { type: 'article', category: 'news', tags: ['hot'] }),
             a2: page('a2', { type: 'article', category: 'news', tags: ['hot'] }) }
  };
  const brandB = {
    categories: { news: { name: 'B News', slug: 'b-news' } },
    tags: {},
    pages: { b1: page('b1', { type: 'article', category: 'news' }) }
  };
  check('the same id resolves to each brand\'s own name',
    C.category(brandA.pages.a1, brandA).name === 'A News' &&
    C.category(brandB.pages.b1, brandB).name === 'B News');
  check('brand A\'s related content contains only brand A\'s pages',
    keys(C.autoRelated(brandA.pages.a1, brandA, 'a1', 6)).join() === 'a2');
  check('brand B\'s page is not reachable from brand A\'s record',
    keys(C.autoRelated(brandA.pages.a1, brandA, 'a1', 6)).indexOf('b1') === -1);
  /* A page naming another brand's page explicitly: the pool is the record
     it was handed, so there is nothing to find. */
  const cross = Object.assign({}, brandA.pages.a1, { related: ['b1'] });
  check('a manual reference to another brand\'s page resolves to nothing',
    keys(C.related(cross, brandA, 'a1')).indexOf('b1') === -1);
  check('a tag id belonging to brand A does not resolve on brand B',
    C.tags(page('p', { type: 'article', tags: ['hot'] }), brandB).length === 0);
}

/* ====================================================================
   11. WHAT REACHES Article: articleSection AND keywords
   ==================================================================== */
console.log('\n===== STRUCTURED DATA SAYS THE CATEGORY, OR SAYS NOTHING =====');
/* buildArticle() reads the base URL and the publisher from the loaded
   record, as it always has, so these two sections load the record they are
   about. Everything above passes its record explicitly and is unaffected. */
function articleFor(extra) {
  const p = page('p', Object.assign({ type: 'article' }, extra));
  const rec = {
    seo: { baseUrl: 'https://example.test', siteName: 'Example' },
    categories: { c: { name: 'Cricket', slug: 'cricket' },
                  hostile: { name: '</script><script>alert(1)</script>',
                             slug: 'javascript:alert(1)' } },
    tags: { t1: { name: 'IPL', slug: 'ipl' }, t2: { name: 'T20', slug: 't20' },
            hostile: { name: '<img src=x onerror=alert(1)>', slug: '../../etc/passwd' } },
    pages: { p: p }
  };
  CMS.replace(rec);
  return { art: C.article(p, rec), rec: rec, p: p };
}
{
  const plain = articleFor({}).art;
  check('an article resolves to an Article block at all', !!plain, plain);
  check('an article with no taxonomy has no articleSection',
    plain && !('articleSection' in plain), plain);
  check('  and no keywords', plain && !('keywords' in plain));

  const withCat = articleFor({ category: 'c' }).art;
  check('a category becomes articleSection, by NAME',
    withCat.articleSection === 'Cricket', withCat.articleSection);
  const withTags = articleFor({ tags: ['t1', 't2'] }).art;
  check('tags become a comma-separated keywords string, in order',
    withTags.keywords === 'IPL, T20', withTags.keywords);
  const one = articleFor({ tags: ['t2', 't1'] }).art;
  check('  in the author\'s order, not sorted', one.keywords === 'T20, IPL', one.keywords);

  const bad = articleFor({ category: 'absent', tags: ['absent'] }).art;
  check('an unresolved category adds no articleSection', !('articleSection' in bad), bad);
  check('  and unresolved tags add no keywords', !('keywords' in bad));

  /* A hub is a CollectionPage and publishes no Article at all. */
  const hub = articleFor({ type: 'hub', category: 'c' }).art;
  check('a hub publishes no Article block, so no articleSection either', hub === null, hub);
  /* A plain page likewise: no Article, and no taxonomy anywhere. */
  const ordinary = articleFor({ type: 'page', category: 'c' }).art;
  check('a plain page publishes no Article block', ordinary === null, ordinary);
}

/* ====================================================================
   12. HOSTILE STRINGS GO THROUGH THE SAME SANITISERS AS EVERYTHING ELSE
   ==================================================================== */
console.log('\n===== A CATEGORY NAME IS TEXT, AND ONLY EVER TEXT =====');
{
  const hostile = '</script><script>alert(1)</script>';
  const cats = { c: { name: hostile, slug: 'javascript:alert(1)' } };
  const tgs = { t: { name: '<img src=x onerror=alert(1)>', slug: '../../etc/passwd' } };

  const got = C.taxonFrom(cats, 'c');
  check('a hostile name survives as a STRING -- escaping belongs where it becomes output',
    got.name === hostile, got.name);
  check('  and a slug that is not a slug is dropped', got.slug === '');
  check('a path-traversal slug is dropped',
    C.taxonFrom(tgs, 't').slug === '', C.taxonFrom(tgs, 't').slug);
  check('a control character makes a slug invalid',
    C.taxonFrom({ x: { name: 'X', slug: 'a\u0000b' } }, 'x').slug === '');
  check('a slug with a slash is not a slug -- there are no nested URLs',
    C.taxonFrom({ x: { name: 'X', slug: 'news/cricket' } }, 'x').slug === '');
  check('an uppercase slug is lowercased rather than rejected',
    C.taxonFrom({ x: { name: 'X', slug: 'Cricket' } }, 'x').slug === 'cricket');
  /* 81 characters, because nothing is built from a slug: it is an editor's
     handle, not an address. The cap exists so a pasted paragraph cannot
     become one. */
  check('an 81-character slug is the longest one kept',
    C.taxonFrom({ x: { name: 'X', slug: 'a'.repeat(81) } }, 'x').slug.length === 81);
  check('  and an 82-character one is dropped',
    C.taxonFrom({ x: { name: 'X', slug: 'a'.repeat(82) } }, 'x').slug === '');
  check('a slug starting with a hyphen is not a slug',
    C.taxonFrom({ x: { name: 'X', slug: '-lead' } }, 'x').slug === '');

  /* It reaches structured data as the text it is. test_taxonomy_static.js
     reads the real HTML and proves nothing closes a script tag there. */
  const art = articleFor({ category: 'hostile', tags: ['hostile'] }).art;
  check('the Article articleSection carries the hostile name as text',
    art.articleSection === hostile, art.articleSection);
  check('  and keywords carries the hostile tag name',
    art.keywords === '<img src=x onerror=alert(1)>', art.keywords);
}

/* ====================================================================
   13. THE ADMIN AND THE BUILDER AGREE WITH THE ENGINE
   ==================================================================== */
console.log('\n===== ONE LIST OF TAXONOMY TYPES, NOT THREE =====');
{
  const cmsSrc = fs.readFileSync(path.join(ROOT, 'js', 'cms.js'), 'utf8');
  const adminSrc = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');
  const bSrc = fs.readFileSync(path.join(ROOT, 'js', 'admin-builder.js'), 'utf8');
  const adminHtml = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');

  check('the admin asks CMS.content.taxonTypes rather than keeping its own list',
    adminSrc.indexOf('CMS.content.taxonTypes') !== -1);
  check('  and the checks do too', /C\.taxonTypes/.test(adminSrc));
  check('neither the admin nor the builder hardcodes a type list of its own',
    adminSrc.indexOf("{ article: 1, guide: 1") === -1 &&
    bSrc.indexOf("{ article: 1, guide: 1") === -1);

  check('the taxonomy element is registered in the builder\'s palette',
    /\['taxonomy',\s*'Category and tags'\]/.test(bSrc));
  check('the builder declares the taxonomy element\'s content fields',
    /taxonomy:\s*\[\['categoryLabel'/.test(bSrc));
  check('the engine declares the same four content keys for it',
    /taxonomy:\s*\['categoryLabel', 'tagsLabel', 'showCategory', 'showTags'\]/.test(cmsSrc));
  check('the pageList element gained an autoFill key',
    /'autoFill'/.test(cmsSrc) && /autoFill/.test(bSrc));

  check('the admin has a Categories card', adminHtml.indexOf('categoriesHost') !== -1);
  check('  and a Tags card', adminHtml.indexOf('tagsHost') !== -1);
  check('  and says plainly that no taxonomy page is generated',
    /no (category|page)/i.test(adminHtml) && adminHtml.indexOf('sitemap') !== -1);
}

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
