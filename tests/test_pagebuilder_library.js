/* Page Builder V2 -- milestone A: reusable sections and page templates.

   Both features rest on one primitive, pbCleanSections(): untrusted
   section-shaped data in, a freshly built array out. Nothing is copied
   unless its key is on a list, which is what makes a hostile import and a
   code-defined template safe by the same mechanism rather than two.

   Most of this runs against CMS.sections in a real page, because that is
   where the sanitiser and the registry live; the parts a person actually
   touches are driven through the admin at the end. */
const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const stub = (target, state) => target.route('**supabase.co/**', route => {
  const q = route.request();
  if (q.url().includes('/auth/v1/token'))
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"stub"}' });
  if (q.method() === 'POST') {
    state.posts++; state.row = JSON.parse(q.postData() || '{}');
    return route.fulfill({ status: 201, body: '' });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(state.row ? [{ data: state.row.data, updated_at: state.row.updated_at }] : []) });
});

async function page(b, seed, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  if (seed) await p.addInitScript((arg) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg);
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}

/* A section carrying one of everything worth preserving. */
const RICH = {
  id: 'rich', type: 'hero', enabled: true,
  visibility: { desktop: true, tablet: false, mobile: true },
  style: { bg: '@surface', padding: 42, letterSpacing: 2 },
  responsive: { tablet: { padding: 20 }, mobile: { padding: 10, fontSize: 13 } },
  elements: [
    { id: 'h', type: 'heading', content: { text: 'Title', level: 'h3' },
      style: { color: '@primary', typography: '@h1' }, responsive: { mobile: { fontSize: 18 } } },
    { id: 'c', type: 'columns', style: { columns: '2-30-70' }, responsive: {}, content: { columns: [
      { elements: [{ id: 'n1', type: 'notice', content: { text: 'Inside', variant: 'warning', icon: 'info' }, style: {} }] },
      { elements: [{ id: 'f1', type: 'faq', style: {}, content: { single: true, items: [
        { question: 'Q?', answer: 'A', open: true }] } }] }
    ] } },
    { id: 'b', type: 'button', content: { text: 'Go', href: 'contact.html', newTab: true }, style: { bg: '@primary' } }
  ]
};

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     THE SANITISER
     ================================================================ */
  console.log('\n===== UNTRUSTED SECTION DATA IS REBUILT, NOT CLEANED UP =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate((rich) => {
      const S = CMS.sections;
      const out = {};
      out.rich = S.sanitize([rich]);
      out.unknownSection = S.sanitize([{ type: 'nope', elements: [] }]).length;
      out.unknownElement = S.sanitize([{ type: 'text', elements: [
        { type: 'evil', content: { text: 'x' } }, { type: 'text', content: { text: 'ok' } }] }])[0].elements;
      out.protoSection = S.sanitize([{ type: 'text', __proto__: { polluted: 1 },
        constructor: { x: 1 }, prototype: { y: 1 }, elements: [] }]);
      out.badUrl = S.sanitize([{ type: 'text', elements: [
        { type: 'button', content: { text: 'x', href: 'javascript:alert(1)' } },
        { type: 'image', content: { src: 'data:text/html,<script>' , alt: 'a' } },
        { type: 'button', content: { text: 'y', href: 'contact.html' } }] }])[0].elements;
      out.badStyle = S.sanitize([{ type: 'text', style: { bg: 'red;}body{display:none;}.x{', padding: 9 },
        elements: [{ type: 'heading', content: { text: 'h' },
          style: { color: '@constructor', fontSize: 'url(x)', bg: 'var(--evil)', margin: 4 } }] }]);
      out.nestedPayload = S.sanitize([{ type: 'text', elements: [
        { type: 'heading', content: { text: { toString: 1, nested: true }, level: 'h2' } }] }])[0].elements[0].content;
      /* Own, enumerable keys that are simply not on the list: the question
         is whether anything is copied because it was there, rather than
         because it was asked for. */
      out.strayKeys = Object.keys(S.sanitize([{ type: 'text', stray: 1, onclick: 'alert(1)',
        elements: [{ type: 'heading', stray: 2, content: { text: 'ok', level: 'h2',
          onclick: 'alert(1)', constructor: 'x', innerHTML: '<script>', items: [{ a: 1 }],
          href: 'javascript:alert(1)' } }] }])[0].elements[0].content);
      out.straySectionKeys = Object.keys(S.sanitize([{ type: 'text', stray: 1,
        onclick: 'x', elements: [] }])[0]);
      out.polluted = ({}).polluted;
      return out;
    }, RICH);

    check('a section carrying everything survives intact', r.rich.length === 1, r.rich.length);
    const s0 = r.rich[0];
    check('its style, visibility and responsive data are preserved',
      s0.style.padding === 42 && s0.style.bg === '@surface' &&
      s0.visibility.tablet === false && s0.responsive.mobile.fontSize === 13, s0);
    check('its nested columns, notice and FAQ survive',
      s0.elements[1].content.columns.length === 2 &&
      s0.elements[1].content.columns[0].elements[0].content.variant === 'warning' &&
      s0.elements[1].content.columns[1].elements[0].content.items[0].question === 'Q?', s0.elements[1]);
    check('a relative link survives', s0.elements[2].content.href === 'contact.html');

    check('an unknown section type is refused', r.unknownSection === 0, r.unknownSection);
    check('an unknown element type is dropped, its siblings kept',
      r.unknownElement.length === 1 && r.unknownElement[0].type === 'text', r.unknownElement);
    /* Own keys only: every object inherits "constructor" from
       Object.prototype, so `in` would answer yes whatever the sanitiser
       did. The question is what was COPIED. */
    check('__proto__, constructor and prototype are never copied',
      Object.keys(r.protoSection[0]).join() === 'id,type,enabled,visibility,style,responsive,elements' &&
      !Object.prototype.hasOwnProperty.call(r.protoSection[0], 'polluted'),
      Object.keys(r.protoSection[0]));
    check('and nothing was written onto Object.prototype', r.polluted === undefined, r.polluted);
    check('a javascript: link is dropped, the element kept',
      !('href' in r.badUrl[0].content) && r.badUrl[0].content.text === 'x', r.badUrl[0]);
    check('a data: image source is dropped', !('src' in r.badUrl[1].content), r.badUrl[1]);
    check('a style value that would close a rule is dropped, its neighbours kept',
      !('bg' in r.badStyle[0].style) && r.badStyle[0].style.padding === 9, r.badStyle[0].style);
    check('an unknown design role, url() and var() are all dropped',
      !('color' in r.badStyle[0].elements[0].style) &&
      !('fontSize' in r.badStyle[0].elements[0].style) &&
      !('bg' in r.badStyle[0].elements[0].style) &&
      r.badStyle[0].elements[0].style.margin === 4, r.badStyle[0].elements[0].style);
    check('an object smuggled into a content field is refused',
      !('text' in r.nestedPayload) && r.nestedPayload.level === 'h2', r.nestedPayload);
    check('a content key that is not on this type\u2019s list is not copied at all',
      r.strayKeys.join() === 'text,level', r.strayKeys);
    check('and neither is a stray key on the section itself',
      r.straySectionKeys.join() === 'id,type,enabled,visibility,style,responsive,elements',
      r.straySectionKeys);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     THE LIBRARY
     ================================================================ */
  console.log('\n===== SAVING, LISTING, RENAMING, DUPLICATING, DELETING =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate((rich) => {
      const L = CMS.sections.library, out = {};
      out.emptyAtFirst = L.list();
      const id = L.save('My hero', rich);
      out.saved = !!id;
      out.afterSave = L.list();
      out.rename = L.rename(id, 'Renamed hero') && L.list()[0].name;
      const dupId = L.duplicate(id);
      out.afterDup = L.list().map(x => x.name);
      out.dupIsNewId = dupId !== id;
      out.removed = L.remove(dupId) && L.list().length;
      out.removeMissing = L.remove('lib_nope');
      out.renameMissing = L.rename('lib_nope', 'x');
      out.instanceMissing = L.instance('lib_nope');
      /* names are bounded and stripped of anything markup-ish */
      L.save('<img src=x onerror=1>' + 'y'.repeat(200), rich);
      out.longName = L.list()[1].name;
      L.save('', rich);
      out.blankName = L.list()[2].name;
      out.version = L.version;
      return out;
    }, RICH);

    check('a new library starts empty', r.emptyAtFirst.length === 0, r.emptyAtFirst);
    check('a section can be saved', r.saved);
    /* Five, not three: the count goes through the nesting, because that is
       what an author sees -- the notice and the FAQ inside the columns
       element, not the columns element. */
    check('and appears in the list with its type and element count',
      r.afterSave.length === 1 && r.afterSave[0].type === 'hero' && r.afterSave[0].elements === 5,
      r.afterSave);
    check('it can be renamed', r.rename === 'Renamed hero', r.rename);
    check('duplicating adds a second entry with a new id',
      r.afterDup.length === 2 && r.dupIsNewId && /copy/.test(r.afterDup[1]), r.afterDup);
    check('deleting removes one', r.removed === 1, r.removed);
    check('deleting, renaming or reading something that is not there fails quietly',
      r.removeMissing === false && r.renameMissing === false && r.instanceMissing === null, r);
    check('a name cannot carry markup and is bounded',
      !/[<>]/.test(r.longName) && r.longName.length <= 80, r.longName);
    check('a blank name falls back to a readable one', r.blankName === 'Saved section', r.blankName);
    check('the library records its version', r.version === 1, r.version);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== AN INSERTED COPY AND THE LIBRARY ENTRY ARE INDEPENDENT =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate((rich) => {
      const L = CMS.sections.library, out = {};
      const id = L.save('Hero', rich);
      const a = L.instance(id);
      const c = L.instance(id);
      out.freshIds = a.id !== rich.id && a.id !== c.id &&
                     a.elements[0].id !== c.elements[0].id;
      out.nestedFreshIds =
        a.elements[1].content.columns[0].elements[0].id !==
        c.elements[1].content.columns[0].elements[0].id;
      out.sameShape = JSON.stringify(a.style) === JSON.stringify(c.style);

      /* edit the inserted copy, deeply */
      a.style.padding = 999;
      a.elements[0].content.text = 'CHANGED';
      a.elements[1].content.columns[0].elements[0].content.text = 'ALSO CHANGED';
      const after = L.instance(id);
      out.libraryUntouched = after.style.padding === 42 &&
        after.elements[0].content.text === 'Title' &&
        after.elements[1].content.columns[0].elements[0].content.text === 'Inside';

      /* edit the library entry; the copy taken earlier must not move */
      L.rename(id, 'Renamed');
      out.copyUntouched = a.elements[0].content.text === 'CHANGED';

      /* the source object handed to save() is not held onto */
      rich.style.padding = 1;
      out.notHoldingSource = L.instance(id).style.padding === 42;
      rich.style.padding = 42;
      return out;
    }, RICH);

    check('each instance gets fresh ids, top level and nested',
      r.freshIds && r.nestedFreshIds, r);
    check('while the content is the same', r.sameShape);
    check('editing an inserted copy does not change the library entry', r.libraryUntouched);
    check('editing the library entry does not change a copy already taken', r.copyUntouched);
    check('and the object passed to save() is copied, not held', r.notHoldingSource);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== EXPORT AND IMPORT =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate((rich) => {
      const L = CMS.sections.library, out = {};
      L.save('One', rich);
      L.save('Two', { type: 'text', elements: [{ type: 'text', content: { text: 'hi' } }] });
      const text = L.exportJSON();
      out.parsed = JSON.parse(text);
      out.isFile = out.parsed.kind === 'jsk1-page-builder-library' &&
                   out.parsed.version === 1 && out.parsed.items.length === 2;
      out.noIds = !/"id"\s*:\s*"lib_/.test(text);

      /* wipe and re-import */
      L.remove(L.list()[0].id); L.remove(L.list()[0].id);
      out.empty = L.list().length;
      out.imported = L.importJSON(text);
      out.afterImport = L.list().map(x => x.name + ':' + x.elements);
      /* a re-imported entry still renders the same thing */
      const inst = L.instance(L.list()[0].id);
      out.roundTrip = inst.style.padding === 42 &&
        inst.elements[1].content.columns[1].elements[0].content.items[0].answer === 'A' &&
        inst.responsive.mobile.fontSize === 13 &&
        inst.visibility.tablet === false;
      return out;
    }, RICH);

    check('the export names itself and carries a version', r.isFile, r.parsed && r.parsed.kind);
    check('and does not carry this device\u2019s internal ids', r.noIds);
    check('the library can be emptied', r.empty === 0, r.empty);
    check('importing the file restores both entries',
      r.imported.added === 2 && r.imported.skipped === 0 && r.afterImport.length === 2, r);
    check('style, responsive, visibility and nested content all survive the round trip',
      r.roundTrip, r.roundTrip);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A HOSTILE OR BROKEN FILE IS REFUSED SAFELY =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const L = CMS.sections.library, out = {};
      out.notJson = L.importJSON('{ not json');
      out.empty = L.importJSON('');
      out.nullIn = L.importJSON('null');
      out.number = L.importJSON('42');
      out.noItems = L.importJSON('{"kind":"other"}');
      out.junkItems = L.importJSON(JSON.stringify({ items: [null, 5, 'x', [], {}] }));
      out.bareArray = L.importJSON(JSON.stringify(
        [{ name: 'Bare', section: { type: 'text', elements: [{ type: 'text', content: { text: 'a' } }] } }]));

      /* prototype pollution, three spellings, at both levels */
      const poison = JSON.parse('{"items":[{"name":"p","__proto__":{"pwned":1},' +
        '"section":{"type":"text","__proto__":{"pwned2":1},"constructor":{"x":1},' +
        '"prototype":{"y":1},"elements":[{"type":"heading","__proto__":{"pwned3":1},' +
        '"content":{"text":"t","__proto__":{"pwned4":1}},"style":{"__proto__":{"pwned5":1}}}]}}]}');
      out.poison = L.importJSON(JSON.stringify(poison));
      out.pwned = [({}).pwned, ({}).pwned2, ({}).pwned3, ({}).pwned4, ({}).pwned5];

      /* everything hostile the renderer already knows how to refuse */
      out.hostile = L.importJSON(JSON.stringify({ items: [
        { name: 'x', section: { type: 'evilType', elements: [] } },
        { name: 'y', section: { type: 'text', elements: [{ type: 'evilEl' }] } },
        { name: 'z', section: { type: 'text',
          style: { bg: '</style><script>alert(1)</script>' },
          elements: [
            { type: 'button', content: { text: 'a', href: 'javascript:alert(1)' } },
            { type: 'icon', content: { icon: 'constructor' } },
            { type: 'socialLinks', content: { items: [{ platform: 'toString', url: '#' }] } },
            { type: 'heading', content: { text: 'kept', level: 'h2' },
              style: { color: 'var(--evil)', fontSize: 20 } }
          ] } }
      ] }));
      out.after = L.list().map(x => x.name + ':' + x.elements);
      const zs = L.list().filter(x => x.name === 'z');
      out.z = zs.length ? L.instance(zs[0].id) : null;
      out.css = CMS.sections.css(L.list().map(x => L.instance(x.id)));
      return out;
    });

    check('a file that is not JSON is reported, not thrown',
      /not valid JSON/.test(r.notJson.error) && r.notJson.added === 0, r.notJson);
    check('empty, null and a bare number are all refused',
      r.empty.error && r.nullIn.error && r.number.error, [r.empty, r.nullIn, r.number]);
    check('a JSON file with no items is refused', !!r.noItems.error, r.noItems);
    check('junk entries are skipped, not imported',
      r.junkItems.added === 0 && r.junkItems.skipped === 5, r.junkItems);
    check('a bare array of entries is accepted', r.bareArray.added === 1, r.bareArray);
    check('prototype keys import as ordinary, harmless data', r.poison.added === 1, r.poison);
    check('and nothing reached Object.prototype',
      r.pwned.every(v => v === undefined), r.pwned);
    check('an unknown section type is skipped entirely',
      !r.after.some(x => /^x:/.test(x)), r.after);
    check('a section whose only element is unknown imports empty',
      r.after.indexOf('y:0') > -1, r.after);
    /* The elements themselves survive -- an author can fix an icon -- but
       every hostile VALUE in them is gone, and the injected style with it. */
    const zel = (t) => r.z.elements.filter(e => e.type === t)[0];
    check('the hostile section keeps its elements but none of their hostile values',
      r.z && r.z.elements.length === 4 &&
      !('href' in zel('button').content) && zel('button').content.text === 'a' &&
      !('icon' in zel('icon').content) &&
      zel('socialLinks').content.items.length === 0 &&   /* row lost its platform */
      zel('heading').content.text === 'kept', r.z && r.z.elements.map(e => e.content));
    check('its injected style is gone and the legitimate one kept',
      r.z && !('bg' in r.z.style) && !('color' in zel('heading').style) &&
      zel('heading').style.fontSize === 20, r.z && [r.z.style, zel('heading').style]);
    check('and nothing hostile can reach the generated CSS',
      !/<script|javascript:|var\(--evil\)|<\/style/.test(r.css), r.css.slice(0, 200));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A BROKEN OR MISSING STORE NEVER BREAKS THE LIBRARY =====');
  {
    for (const [label, value] of [['missing', undefined], ['null', null], ['a string', 'nope'],
                                  ['a number', 7], ['an array', [1, 2]],
                                  ['half built', { version: 'x' }],
                                  ['items not an array', { version: 1, items: 'no' }]]) {
      const seed = value === undefined ? {} : { builderLibrary: value };
      const { ctx, p, errs } = await page(b, seed);
      const r = await p.evaluate((rich) => {
        const L = CMS.sections.library;
        const list = L.list();
        const id = L.save('Recovered', rich);
        return { before: list.length, saved: !!id, after: L.list().length,
                 version: JSON.parse(localStorage.getItem('whiteLabelCMS')).builderLibrary.version };
      }, RICH);
      check('builderLibrary ' + label + ': reads as empty and still accepts a save',
        r.before === 0 && r.saved && r.after === 1 && r.version === 1, r);
      check('builderLibrary ' + label + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  console.log('\n===== THE LIBRARY NEVER LEAVES THE DEVICE =====');
  {
    const { ctx, p, errs, st } = await page(b);
    const r = await p.evaluate((rich) => {
      const L = CMS.sections.library;
      L.save('Local only', rich);
      CMS.data().pages.about = CMS.data().pages.about || {};
      return CMS.save();
    }, RICH);
    check('the library saved locally', r);
    await p.evaluate(() => CMS.remote.signIn('a@b.c', 'x'));
    await p.evaluate(() => CMS.remote.publish());
    await p.waitForTimeout(400);
    check('a publish was attempted', st.posts > 0, st.posts);
    const row = st.row && st.row.data;
    check('and the payload carries no library at all',
      row && !('builderLibrary' in row), row && Object.keys(row).filter(k => /builder/i.test(k)));
    check('while drafts are still excluded too',
      row && !('builderDrafts' in row));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  {
    /* A pull that brings a row without a library must not wipe the local one. */
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: { data: { branding: { siteName: 'Remote' } }, updated_at: '2026-01-01' } };
    await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    await p.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.builderLibrary = { version: 1, items: [{ id: 'lib_keep', name: 'Kept',
        createdAt: '2026-01-01', updatedAt: '2026-01-01',
        section: { id: 'k', type: 'text', enabled: true,
                   visibility: { desktop: true, tablet: true, mobile: true },
                   style: {}, responsive: {},
                   elements: [{ id: 'ke', type: 'text', content: { text: 'kept' }, style: {}, responsive: {} }] } }] };
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    });
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await p.evaluate(() => CMS.remote.pull());
    await p.waitForTimeout(500);
    const r = await p.evaluate(() => ({
      names: CMS.sections.library.list().map(x => x.name),
      remoteApplied: CMS.get('branding.siteName', '')
    }));
    check('a remote pull leaves the local library alone', r.names.join() === 'Kept', r);
    check('while still applying the row it fetched', r.remoteApplied === 'Remote', r.remoteApplied);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A LARGE BUT REASONABLE LIBRARY =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate((rich) => {
      const L = CMS.sections.library;
      const t0 = performance.now();
      for (let i = 0; i < 60; i++) L.save('Item ' + i, rich);
      const saveMs = performance.now() - t0;
      const t1 = performance.now(); const list = L.list(); const listMs = performance.now() - t1;
      const t2 = performance.now(); const text = L.exportJSON(); const expMs = performance.now() - t2;
      L.remove(list[0].id);
      const t3 = performance.now(); const res = L.importJSON(text); const impMs = performance.now() - t3;
      return { count: L.list().length, saveMs: +saveMs.toFixed(1), listMs: +listMs.toFixed(2),
               expMs: +expMs.toFixed(1), impMs: +impMs.toFixed(1), bytes: text.length, added: res.added };
    }, RICH);
    check('sixty entries save, list, export and import',
      r.count === 119 && r.added === 60, r);
    console.log('        timings: save ' + r.saveMs + 'ms, list ' + r.listMs + 'ms, export ' +
      r.expMs + 'ms (' + r.bytes + 'B), import ' + r.impMs + 'ms');
    check('and none of it takes a noticeable amount of time',
      r.saveMs < 2000 && r.expMs < 500 && r.impMs < 1000, r);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     TEMPLATES
     ================================================================ */
  console.log('\n===== THE TEMPLATE REGISTRY =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const S = CMS.sections, out = { list: S.templates(), bad: [] };
      const ids = out.list.map(t => t.id);
      out.uniqueIds = new Set(ids).size === ids.length;
      out.allDescribed = out.list.every(t => t.name && t.description && typeof t.version === 'number');
      out.secTypes = Object.keys(S.types);
      out.elTypes = Object.keys(S.elementTypes);

      for (const t of out.list) {
        const a = S.fromTemplate(t.id);
        const c = S.fromTemplate(t.id);
        if (!a || !a.length) { out.bad.push(t.id + ':empty'); continue; }
        if (a.length !== t.sections) out.bad.push(t.id + ':count');
        /* every section and element type is one the renderer knows */
        const walk = (els, depth) => els.forEach(e => {
          if (out.elTypes.indexOf(e.type) === -1) out.bad.push(t.id + ':el:' + e.type);
          ((e.content || {}).columns || []).forEach(col => walk(col.elements || [], depth + 1));
        });
        a.forEach(s => {
          if (out.secTypes.indexOf(s.type) === -1) out.bad.push(t.id + ':sec:' + s.type);
          walk(s.elements || [], 0);
        });
        /* two instantiations share no ids at all */
        const idsA = JSON.stringify(a).match(/"(sec|el)_[a-z0-9]+"/g) || [];
        const idsC = JSON.stringify(c).match(/"(sec|el)_[a-z0-9]+"/g) || [];
        if (idsA.some(x => idsC.indexOf(x) > -1)) out.bad.push(t.id + ':sharedIds');
        /* editing one instance must not reach the registry */
        a[0].elements[0].content.text = 'EDITED';
        const d = S.fromTemplate(t.id);
        if (d[0].elements[0].content.text === 'EDITED') out.bad.push(t.id + ':registryMutated');
      }
      out.unknown = S.fromTemplate('nope');
      out.protoName = S.fromTemplate('constructor');
      return out;
    });

    check('the registry offers six templates', r.list.length === 6, r.list.map(t => t.id));
    check('with unique ids', r.uniqueIds, r.list.map(t => t.id));
    check('each with a name, a description and a version', r.allDescribed, r.list);
    check('every template instantiates cleanly, with valid types throughout',
      r.bad.length === 0, r.bad);
    check('an unknown template id returns nothing', r.unknown === null, r.unknown);
    check('and a prototype-chain name is not a template', r.protoName === null, r.protoName);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== EVERY TEMPLATE ACTUALLY RENDERS =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const S = CMS.sections, out = {};
      for (const t of S.templates()) {
        const secs = S.fromTemplate(t.id);
        S.paint({ slug: 'about', sections: secs });
        const host = document.querySelector('[data-cms-sections]');
        out[t.id] = {
          want: secs.length,
          got: host.querySelectorAll('.pb-section').length,
          els: host.querySelectorAll('.pb-el').length,
          text: (host.textContent || '').trim().length,
          css: S.css(secs).length
        };
      }
      return out;
    });
    let allRendered = true;
    for (const id in r) {
      const v = r[id];
      if (v.got !== v.want || v.els === 0 || v.text === 0) {
        allRendered = false;
        check('template ' + id + ' renders every section with visible content', false, v);
      }
    }
    check('all six templates render every section, with elements and visible text', allRendered, r);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A TEMPLATE IS A COPY, AND DOES NOT TOUCH SEO OR PUBLISHING =====');
  {
    const { ctx, p, errs } = await page(b, {
      seo: { pages: { about: { title: 'My own title', description: 'My own description' } } }
    });
    const r = await p.evaluate(() => {
      const S = CMS.sections, out = {};
      const seoBefore = JSON.stringify(CMS.data().seo);
      const secs = S.fromTemplate('landing');
      S.saveDraft('about', secs);
      out.draftSaved = S.draft('about').sections.length;
      out.liveStillEmpty = S.live('about').length;
      out.statusBefore = S.status('about').live;
      S.publish('about');
      out.liveAfter = S.live('about').length;
      out.seoUntouched = JSON.stringify(CMS.data().seo) === seoBefore;

      /* editing the published page must not reach the registry */
      const d = S.draft('about').sections;
      d[0].elements[0].content.text = 'EDITED ON THE PAGE';
      S.saveDraft('about', d);
      out.registryClean = S.fromTemplate('landing')[0].elements[0].content.text !== 'EDITED ON THE PAGE';
      return out;
    });
    check('a template fills the draft without publishing anything',
      r.draftSaved === 4 && r.liveStillEmpty === 0 && r.statusBefore === false, r);
    check('publishing then makes it live', r.liveAfter === 4, r.liveAfter);
    check('the page\u2019s SEO fields are untouched throughout', r.seoUntouched);
    check('and editing the page never reaches the registry', r.registryClean);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     INTEGRATION
     ================================================================ */
  console.log('\n===== A TEMPLATE AND A REUSABLE SECTION ON ONE PAGE =====');
  {
    const { ctx, p, errs } = await page(b, { colors: { 'hdr-bg': '#3366cc' } });
    const r = await p.evaluate((rich) => {
      const S = CMS.sections, L = S.library;
      const id = L.save('Rich', rich);
      const secs = S.fromTemplate('landing');
      secs.push(L.instance(id));
      S.saveDraft('about', secs);
      S.publish('about');
      S.paint();
      const host = document.querySelector('[data-cms-sections]');
      const ids = secs.map(s => s.id);
      const uniq = new Set(JSON.stringify(secs).match(/"(sec|el)_[a-z0-9]+"/g) || []);
      const all = (JSON.stringify(secs).match(/"(sec|el)_[a-z0-9]+"/g) || []);
      return {
        sections: host.querySelectorAll('.pb-section').length,
        noDuplicateIds: uniq.size === all.length,
        libSection: !!host.querySelector('[data-sec="' + ids[ids.length - 1] + '"]'),
        roleColour: getComputedStyle(host.querySelector('[data-sec="' + ids[ids.length - 1] + '"] .pb-heading')).color,
        roleSize: getComputedStyle(host.querySelector('[data-sec="' + ids[ids.length - 1] + '"] .pb-heading')).fontSize,
        templateRole: getComputedStyle(host.querySelector('.pb-hero .pb-heading')).fontSize,
        nested: host.querySelectorAll('[data-sec="' + ids[ids.length - 1] + '"] .pb-faq').length
      };
    }, RICH);

    check('both render together', r.sections === 5, r.sections);
    check('with no id collisions anywhere', r.noDuplicateIds);
    check('a global colour role inside the reusable section resolves',
      r.roleColour === 'rgb(51, 102, 204)', r.roleColour);
    check('a typography role inside it resolves too', r.roleSize === '34px', r.roleSize);
    check('and a role inside the template resolves', r.templateRole === '34px', r.templateRole);
    check('its nested FAQ survived the whole trip', r.nested === 1, r.nested);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== RESPONSIVE DATA SURVIVES, AND V1 PAGES DO NOT MOVE =====');
  {
    for (const [label, width, want] of [['desktop', 1280, '42px'], ['tablet', 1000, '20px'], ['mobile', 700, '10px']]) {
      const { ctx, p, errs } = await page(b, null, width);
      const r = await p.evaluate((rich) => {
        const S = CMS.sections, L = S.library;
        const id = L.save('Rich', rich);
        S.saveDraft('about', [L.instance(id)]);
        S.publish('about');
        S.paint();
        const n = document.querySelector('[data-cms-sections] .pb-section');
        return { pad: getComputedStyle(n).padding.split(' ')[0],
                 hidden: getComputedStyle(n).display };
      }, RICH);
      check('a reusable section keeps its ' + label + ' padding', r.pad === want, r);
      check(label + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  {
    /* A page that predates all of this must be byte-identical. */
    const V1 = [{ id: 'v1s', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true },
      style: { bg: '#101010', padding: 33 }, responsive: { tablet: {}, mobile: {} },
      elements: [{ id: 'v1h', type: 'heading', content: { text: 'Old', level: 'h2' },
                   style: { color: '#ff0000', fontSize: 21 } }] }];
    const { ctx, p, errs } = await page(b, {
      pages: { about: { builder: { schemaVersion: 1, status: 'published', sections: V1 } } },
      builderLibrary: { version: 1, items: [] }
    });
    const r = await p.evaluate(() => {
      const n = document.querySelector('[data-el="v1h"]');
      const s = document.querySelector('[data-sec="v1s"]');
      return { color: getComputedStyle(n).color, fs: getComputedStyle(n).fontSize,
               bg: getComputedStyle(s).backgroundColor, pad: getComputedStyle(s).padding.split(' ')[0],
               stored: JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion };
    });
    check('a V1 page still renders exactly as it did',
      r.color === 'rgb(255, 0, 0)' && r.fs === '21px' &&
      r.bg === 'rgb(16, 16, 16)' && r.pad === '33px', r);
    check('and nothing rewrote its stored schema version', r.stored === 1, r.stored);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     THE ADMIN
     ================================================================ */
  console.log('\n===== DRIVEN THROUGH THE ADMIN =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1300 }, acceptDownloads: true });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    let answer = 'Saved hero';
    p.on('dialog', d => d.accept(answer));
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(600);

    const tids = await p.$$eval('#pbTemplates .pb-template', n => n.map(x => x.getAttribute('data-template')));
    const want = await p.evaluate(() => CMS.sections.templates().map(t => t.id));
    check('every template in the registry has a button', tids.join() === want.join(), { tids, want });
    check('each button shows a description and a count',
      await p.$eval('#pbTemplates .pb-template', n =>
        !!n.querySelector('em').textContent.trim() && /section/.test(n.querySelector('.pb-template-meta').textContent)));
    check('the library starts with an explanation, not an empty box',
      /Nothing saved yet/.test(await p.$eval('#pbLibrary', n => n.textContent)));

    await p.click('#pbTemplates .pb-template[data-template="landing"]'); await p.waitForTimeout(800);
    check('applying a template fills the draft',
      (await p.$$eval('#pbList .pb-sec', n => n.length)) === 4);
    const fr = p.frame({ url: u => /about\.html/.test(u) });
    check('and the preview shows it',
      (await fr.evaluate(() => document.querySelectorAll('.pb-section').length)) === 4);
    check('the page records which template revision it started from',
      await p.evaluate(() => {
        const t = (CMS.data().pages.about || {}).builderTemplate;
        return !!t && t.id === 'landing' && typeof t.version === 'number';
      }));
    check('but nothing has been published',
      (await p.evaluate(() => CMS.sections.status('about').live)) === false);

    /* save as reusable */
    await p.click('#pbList .pb-sec:first-child [data-act="save-reusable"]'); await p.waitForTimeout(700);
    const rows = await p.$$eval('#pbLibrary .pb-lib-item', n => n.map(x => x.querySelector('strong').textContent));
    check('a section can be saved from its own toolbar', rows.join() === 'Saved hero', rows);

    /* preview renders the real thing */
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-preview"]'); await p.waitForTimeout(400);
    const prev = await p.$eval('#pbLibrary .pb-lib-preview', n => ({
      hidden: n.hidden, secs: n.querySelectorAll('.pb-section').length,
      els: n.querySelectorAll('.pb-el').length, text: n.textContent.trim().slice(0, 20) }));
    check('preview renders the actual section, not a description',
      prev.hidden === false && prev.secs === 1 && prev.els > 0 && prev.text.length > 0, prev);
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-preview"]'); await p.waitForTimeout(250);
    check('and clicking again closes it',
      await p.$eval('#pbLibrary .pb-lib-preview', n => n.hidden));

    /* insert, then edit the copy */
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-insert"]'); await p.waitForTimeout(800);
    check('inserting adds a section to the page',
      (await p.$$eval('#pbList .pb-sec', n => n.length)) === 5);
    check('and leaves the library with one entry',
      (await p.$$eval('#pbLibrary .pb-lib-item', n => n.length)) === 1);

    const lastSec = await p.$$eval('#pbList .pb-sec', n => n[n.length - 1].getAttribute('data-sec-id'));
    /* Inserting already expands the new section, so only open it if it is
       not open -- clicking would otherwise close it. */
    if (!(await p.$(`#pbList .pb-sec[data-sec-id="${lastSec}"].open`))) {
      await p.click(`#pbList .pb-sec[data-sec-id="${lastSec}"] .pb-sec-title`);
      await p.waitForTimeout(400);
    }
    const FLD = `#pbList .pb-sec[data-sec-id="${lastSec}"] .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`;
    await p.fill(FLD, 'EDITED IN THE PAGE'); await p.waitForTimeout(600);
    check('editing the inserted copy does not change the library entry',
      await p.evaluate(() => {
        const L = CMS.sections.library;
        return L.instance(L.list()[0].id).elements[0].content.text !== 'EDITED IN THE PAGE';
      }));

    /* rename, duplicate, delete */
    answer = 'Renamed hero';
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-rename"]'); await p.waitForTimeout(400);
    check('rename works through the UI',
      (await p.$eval('#pbLibrary .pb-lib-item strong', n => n.textContent)) === 'Renamed hero');
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-duplicate"]'); await p.waitForTimeout(400);
    check('duplicate adds a second row',
      (await p.$$eval('#pbLibrary .pb-lib-item', n => n.length)) === 2);
    await p.click('#pbLibrary .pb-lib-item:last-child [data-act="lib-delete"]'); await p.waitForTimeout(400);
    check('delete removes it again',
      (await p.$$eval('#pbLibrary .pb-lib-item', n => n.length)) === 1);
    check('and the page that used it is untouched',
      (await p.$$eval('#pbList .pb-sec', n => n.length)) === 5);

    /* export -> wipe -> import, through the real buttons */
    const dl = p.waitForEvent('download');
    await p.click('#pbLibExport');
    const file = await dl;
    const path = await file.path();
    check('Export produces a file', !!path, file.suggestedFilename());
    const text = require('fs').readFileSync(path, 'utf8');
    check('and it parses as a library file',
      JSON.parse(text).kind === 'jsk1-page-builder-library');

    await p.click('#pbLibrary .pb-lib-item [data-act="lib-delete"]'); await p.waitForTimeout(400);
    check('the library can be emptied',
      /Nothing saved yet/.test(await p.$eval('#pbLibrary', n => n.textContent)));
    await p.setInputFiles('#pbLibFile', { name: 'lib.json', mimeType: 'application/json',
                                          buffer: Buffer.from(text) });
    await p.waitForTimeout(700);
    check('and the exported file imports back through the real input',
      (await p.$$eval('#pbLibrary .pb-lib-item strong', n => n.map(x => x.textContent))).join() === 'Renamed hero');
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-insert"]'); await p.waitForTimeout(700);
    check('the re-imported entry inserts',
      (await p.$$eval('#pbList .pb-sec', n => n.length)) === 6);

    /* a hostile file, through the same input */
    await p.setInputFiles('#pbLibFile', { name: 'bad.json', mimeType: 'application/json',
      buffer: Buffer.from('{ this is not json') });
    await p.waitForTimeout(500);
    check('a broken file is reported and changes nothing',
      (await p.$$eval('#pbLibrary .pb-lib-item', n => n.length)) === 1);

    /* publish, reload, and check the public page */
    await p.click('#pbPublish'); await p.waitForTimeout(900);
    await p.reload({ waitUntil: 'networkidle' });
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(800);
    check('the library survives a reload',
      (await p.$$eval('#pbLibrary .pb-lib-item', n => n.length)) === 1);
    check('and so does the draft',
      (await p.$$eval('#pbList .pb-sec', n => n.length)) === 6);

    for (const [label, w, want] of [['desktop', 1280, 6], ['tablet', 1000, 6], ['mobile', 700, 6]]) {
      const c2 = await b.newContext({ viewport: { width: w, height: 900 }, storageState: await ctx.storageState() });
      await c2.route('**supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      const q = await c2.newPage();
      const qe = []; q.on('pageerror', e => qe.push(String(e)));
      await q.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
      const n = await q.evaluate(() => document.querySelectorAll('[data-cms-sections] .pb-section').length);
      const edited = await q.evaluate(() => /EDITED IN THE PAGE/.test(document.body.textContent));
      check('the public page renders all ' + want + ' sections at ' + label, n === want, n);
      if (label === 'desktop') check('including the edit made to the inserted copy', edited);
      check(label + ': no public page errors', qe.length === 0, qe);
      await c2.close();
    }

    check('the admin ran without console or page errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
