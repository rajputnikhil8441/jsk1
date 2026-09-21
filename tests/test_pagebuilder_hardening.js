/* Page Builder V2 -- milestone F: final hardening.

   THE CLAIM. Everything the builder can be handed -- by an author, by a
   corrupted localStorage, by the Supabase row, by an imported library
   file -- either renders or is refused, and neither one takes the page
   down with it.

   This suite is deliberately about the PUBLIC render path, because that
   is the one place the whole-tree sanitiser deliberately does not run:
   publishedSections() hands the renderer whatever was published, and the
   renderer's own per-value guards are what stand between stored data and
   a visitor. Milestone F found four places where that was not true --
   an allow-list read with a bare index rather than a membership test --
   and one place where a JSON key called __proto__ was treated as data. */
const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const sec = (id, type, els, extra) => Object.assign({ id: id, type: type || 'text', enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true },
  style: {}, responsive: {}, elements: els || [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id: id, type: type, content: content || {}, style: style || {}, responsive: responsive || {} });

/* A public page carrying whatever the case needs. `raw` bypasses the
   helper entirely and writes the localStorage string verbatim, which is
   how the corrupted-storage cases are driven. */
async function page(b, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: opts.viewport || { width: 1280, height: 900 } });
  const seen = [], sent = [];
  await ctx.route('**', r => {
    const u = r.request().url();
    if (/supabase\.co/.test(u)) { seen.push('supabase:' + r.request().method());
      if (u.includes('/auth/v1/token'))
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"stub"}' });
      if (r.request().method() === 'POST') { sent.push(r.request().postData() || '');
        return r.fulfill({ status: 201, body: '' }); }
      var body = '[]';
      if (opts.rowJson) body = '[{"data":' + opts.rowJson + ',"updated_at":"2026-01-01"}]';
      else if (opts.row) body = JSON.stringify([{ data: opts.row, updated_at: '2026-01-01' }]);
      return r.fulfill({ status: 200, contentType: 'application/json', body: body }); }
    if (!/localhost:/.test(u)) seen.push('external:' + u.replace(/^https?:\/\//, '').split('/')[0]);
    return r.continue();
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    errs.push(m.text().slice(0, 120)); });
  if (opts.raw !== undefined) {
    await p.addInitScript(r => { localStorage.setItem('whiteLabelCMS', r); }, opts.raw);
  } else if (opts.sections || opts.state) {
    await p.addInitScript(a => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      if (a.state) Object.assign(raw, a.state);
      if (a.sections) raw.pages = Object.assign(raw.pages || {}, { about: Object.assign(
        (raw.pages || {}).about || {},
        { builder: { schemaVersion: 2, status: 'published', sections: a.sections } }) });
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, { sections: opts.sections || null, state: opts.state || null });
  }
  await p.goto(`${BASE}/${opts.url || 'about.html'}`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, seen, sent };
}

/* What a visitor actually ends up with. */
const shot = p => p.evaluate(() => {
  const secs = [...document.querySelectorAll('.pb-section')];
  return {
    secs: secs.length,
    secClasses: secs.map(s => s.className).join(' '),
    els: [...document.querySelectorAll('.pb-el')].map(n => n.className.split(' ')[1]),
    css: (document.getElementById('cmsBuilder') || {}).textContent || '',
    scripts: document.querySelectorAll('.pb-section script').length,
    handlers: [...document.querySelectorAll('.pb-section *')]
      .filter(n => [...n.attributes].some(a => /^on/i.test(a.name))).length,
    hrefs: [...document.querySelectorAll('.pb-section a')].map(a => a.getAttribute('href')),
    imgs: [...document.querySelectorAll('.pb-section img')].map(i => i.getAttribute('src')),
    h1: (document.querySelector('.info-article > h1') || {}).textContent,
    bodyLen: document.body.innerText.length,
    bodyDisplay: getComputedStyle(document.body).display,
    title: document.title,
    pwned: window.__pwned,
    globalClean: ({}).pwned === undefined && ({}).sneaky === undefined &&
                 Object.prototype.pwned === undefined,
    html: document.documentElement.outerHTML
  };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. AN ALLOW-LIST READ BY A NAME FROM STORED DATA
     ----------------------------------------------------------------
     map[name] is not a membership test. Every object inherits
     constructor, toString, valueOf and the rest, so a stored type of
     "constructor" hands back a FUNCTION -- which the renderer then
     tried to call, append, or concatenate into a class attribute.
     ================================================================ */
  console.log('\n===== A BAD TYPE IS SKIPPED, NOT THROWN ON =====');
  {
    const CASES = [
      ['element type "constructor"', [sec('s1', 'text', [el('e1', 'constructor', { text: 'a' }),
                                                          el('e2', 'text', { text: 'survivor' })])]],
      ['element type "toString"',    [sec('s1', 'text', [el('e1', 'toString', { text: 'a' }),
                                                          el('e2', 'text', { text: 'survivor' })])]],
      ['element type "valueOf"',     [sec('s1', 'text', [el('e1', 'valueOf', { text: 'a' }, { color: '#fff' }),
                                                          el('e2', 'text', { text: 'survivor' })])]],
      ['element type "__proto__"',   [sec('s1', 'text', [el('e1', '__proto__', { text: 'a' }),
                                                          el('e2', 'text', { text: 'survivor' })])]],
      ['element type "hasOwnProperty"', [sec('s1', 'text', [el('e1', 'hasOwnProperty', { text: 'a' }),
                                                          el('e2', 'text', { text: 'survivor' })])]]
    ];
    for (const [name, sections] of CASES) {
      const r = await page(b, { sections });
      const s = await shot(r.p);
      check(name + ': the page still renders', s.secs === 1, { secs: s.secs, errs: r.errs });
      check(name + ': the bad element is skipped', s.els.indexOf(undefined) === -1 && s.els.length === 1, s.els);
      check(name + ': the good element beside it survives',
        /survivor/.test(s.html), s.els);
      check(name + ': nothing threw', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }

    /* the section-class and alignment lookups, which leaked a stringified
       function into a class attribute and "undefined" into the CSS */
    let r = await page(b, { sections: [sec('s1', 'constructor', [el('e1', 'text', { text: 'a' })])] });
    let s = await shot(r.p);
    check('a bad SECTION type falls back to the generic class',
      /pb-generic/.test(s.secClasses) && !/native code/.test(s.secClasses), s.secClasses);
    check('and no function is stringified into the markup',
      !/native code/.test(s.html), s.secClasses);
    check('nothing threw', r.errs.length === 0, r.errs);
    await r.ctx.close();

    r = await page(b, { sections: [sec('s1', 'text',
      [el('e1', 'text', { text: 'a' }, { align: 'constructor' })])] });
    s = await shot(r.p);
    check('an unknown alignment emits no box-alignment declaration',
      !/--pbe-self/.test(s.css) && !/undefined/.test(s.css), s.css.slice(0, 160));
    check('and the element still renders', s.secs === 1 && s.els.length === 1, s.els);
    await r.ctx.close();
  }

  /* ================================================================
     2. __proto__ IS A KEY, NOT AN INSTRUCTION
     ----------------------------------------------------------------
     JSON.parse makes __proto__ an ordinary own property, so a
     hasOwnProperty guard passes it -- and assigning it is a call to the
     prototype setter. Both the Supabase row and localStorage arrive
     through merge(), so that is where it is refused.
     ================================================================ */
  console.log('\n===== A JSON KEY CANNOT BECOME A PROTOTYPE =====');
  {
    /* Written as TEXT, not built with an object literal. `{'__proto__': x}`
       in JavaScript SETS the prototype rather than creating a key, so
       JSON.stringify() of it produces {} and the payload would carry
       nothing at all -- an assertion that passes whatever the code does. */
    const PROTO_JSON = '{"__proto__":{"pwned":1},' +
      '"pages":{"__proto__":{"sneaky":2},"about":{"title":"Kept"}},' +
      '"text":{"__proto__":{"t":3}}}';
    check('the payload really does carry a __proto__ key',
      Object.prototype.hasOwnProperty.call(JSON.parse(PROTO_JSON), '__proto__') === true);
    const r = await page(b, { raw: PROTO_JSON });
    const inner = await r.p.evaluate(() => {
      const st = CMS.data();
      return {
        stateProto: Object.getPrototypeOf(st) === Object.prototype,
        pagesProto: Object.getPrototypeOf(st.pages) === Object.prototype,
        textProto: Object.getPrototypeOf(st.text) === Object.prototype,
        pwned: st.pwned, sneaky: st.pages.sneaky, t: st.text.t,
        legitKept: st.pages.about.title,
        hasProtoKey: Object.prototype.hasOwnProperty.call(st, '__proto__')
      };
    });
    check('the state object keeps its own prototype', inner.stateProto === true, inner);
    check('and so does every nested object',
      inner.pagesProto === true && inner.textProto === true, inner);
    check('nothing injected is readable from the state',
      inner.pwned === undefined && inner.sneaky === undefined && inner.t === undefined, inner);
    check('no __proto__ key is carried as data either', inner.hasProtoKey === false, inner);
    check('the legitimate value beside it is kept', inner.legitKept === 'Kept', inner);
    const s = await shot(r.p);
    check('Object.prototype itself is untouched', s.globalClean === true);
    check('and the page renders normally', s.h1 === 'About JSK1' && s.bodyLen > 400, s.bodyLen);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();

    /* the same payload arriving from the server rather than from disk */
    const r2 = await page(b, { rowJson: '{"__proto__":{"pwned":9},"branding":{"siteName":"FromRow"}}' });
    await r2.p.waitForTimeout(400);
    const s2 = await r2.p.evaluate(() => ({
      proto: Object.getPrototypeOf(CMS.data()) === Object.prototype,
      pwned: CMS.data().pwned,
      name: CMS.data().branding.siteName,
      globalClean: ({}).pwned === undefined
    }));
    check('a remote row cannot inject a prototype either',
      s2.proto === true && s2.pwned === undefined && s2.globalClean === true, s2);
    check('while its legitimate values still land', s2.name === 'FromRow', s2);
    check('no page errors', r2.errs.length === 0, r2.errs);
    await r2.ctx.close();
  }

  /* ================================================================
     3. STORAGE THAT IS NOT WHAT IT SHOULD BE
     ================================================================ */
  console.log('\n===== CORRUPT OR MALFORMED STORAGE NEVER TAKES THE PAGE DOWN =====');
  {
    const RAWS = [
      ['truncated JSON', '{"branding":{"siteName":'],
      ['a bare string', '"just a string"'],
      ['null', 'null'],
      ['an array at the top', '[1,2,3]'],
      ['a number', '42'],
      ['empty', ''],
      ['pages is a string', '{"pages":"nope"}'],
      ['pages is an array', '{"pages":[1,2]}'],
      ['sections is an object', '{"pages":{"about":{"builder":{"status":"published","sections":{"0":{"type":"text"}}}}}}'],
      ['sections holds nulls', '{"pages":{"about":{"builder":{"status":"published","sections":[null,null,{"id":"s","type":"text","elements":[null,{"id":"e","type":"text","content":{"text":"kept"}}]}]}}}}'],
      ['content is a string', '{"pages":{"about":{"builder":{"status":"published","sections":[{"id":"s","type":"text","elements":[{"id":"e","type":"text","content":"boom"}]}]}}}}'],
      ['columns is a number', '{"pages":{"about":{"builder":{"status":"published","sections":[{"id":"s","type":"columns","elements":[{"id":"e","type":"columns","content":{"columns":7}}]}]}}}}'],
      ['elements is a string', '{"pages":{"about":{"builder":{"status":"published","sections":[{"id":"s","type":"text","elements":"nope"}]}}}}'],
      ['builderLibrary is a string', '{"builderLibrary":"nope"}'],
      ['builderRecovery is an array', '{"builderRecovery":[1,2]}'],
      ['builderDrafts is a number', '{"builderDrafts":5}'],
      ['visibility is a string', '{"pages":{"about":{"builder":{"status":"published","sections":[{"id":"s","type":"text","visibility":"no","elements":[{"id":"e","type":"text","content":{"text":"kept"}}]}]}}}}'],
      ['style is an array', '{"pages":{"about":{"builder":{"status":"published","sections":[{"id":"s","type":"text","style":[1],"elements":[{"id":"e","type":"text","style":[2],"content":{"text":"kept"}}]}]}}}}']
    ];
    for (const [name, raw] of RAWS) {
      const r = await page(b, { raw });
      const s = await shot(r.p);
      check(name + ': the page still shows its own content',
        s.h1 === 'About JSK1' && s.bodyLen > 400, { h1: s.h1, len: s.bodyLen });
      check(name + ': nothing threw', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }

    /* the valid part of a partly broken payload still renders */
    const r = await page(b, { raw: '{"pages":{"about":{"builder":{"status":"published","sections":[null,null,{"id":"s","type":"text","elements":[null,{"id":"e","type":"text","content":{"text":"kept"}}]}]}}}}' });
    const s = await shot(r.p);
    check('a list of nulls around one good section still draws that section',
      s.secs === 1 && /kept/.test(s.html), { secs: s.secs });
    await r.ctx.close();
  }

  /* ================================================================
     4. STRUCTURAL LIMITS
     ================================================================ */
  console.log('\n===== THE LIMITS STILL HOLD =====');
  {
    const { ctx, p, errs } = await page(b, {});
    const r = await p.evaluate(() => {
      const S = CMS.sections, out = {};
      const mk = (id, els) => ({ id: id, type: 'text', enabled: true, visibility: {},
        style: {}, responsive: {}, elements: els || [] });
      const e = (id) => ({ id: id, type: 'text', content: { text: 'x' }, style: {}, responsive: {} });

      const many = []; for (let i = 0; i < 400; i++) many.push(mk('s' + i, [e('e' + i)]));
      out.sections = S.sanitize(many).length;

      const els = []; for (let i = 0; i < 400; i++) els.push(e('x' + i));
      out.elements = S.sanitize([mk('s', els)])[0].elements.length;

      const cols = []; for (let i = 0; i < 40; i++) cols.push({ elements: [e('c' + i)] });
      out.columns = S.sanitize([{ id: 's', type: 'columns', elements: [
        { id: 'k', type: 'columns', content: { columns: cols } }] }])[0].elements[0].content.columns.length;

      let deep = { id: 'd0', type: 'columns', content: { columns: [{ elements: [] }] } }, cur = deep;
      for (let i = 1; i < 8; i++) {
        const n = { id: 'd' + i, type: 'columns', content: { columns: [{ elements: [] }] } };
        cur.content.columns[0].elements.push(n); cur = n;
      }
      let node = S.sanitize([mk('s', [deep])])[0].elements[0], depth = 0;
      while (node && ((node.content || {}).columns || [])[0] &&
             node.content.columns[0].elements[0]) { depth++; node = node.content.columns[0].elements[0]; }
      out.nesting = depth;

      out.badSection = S.sanitize([{ id: 's', type: 'nope', elements: [] }]).length;
      out.badElement = S.sanitize([mk('s', [{ id: 'e', type: 'nope' }])])[0].elements.length;
      out.badColumns = JSON.stringify(S.sanitize([{ id: 's', type: 'columns', elements: [
        { id: 'k', type: 'columns', content: { columns: ['x', null, 7, { elements: 'no' }] } }] }])[0]
        .elements[0].content.columns);
      out.duplicateIds = S.sanitize([mk('same', [e('dup'), e('dup')]), mk('same', [e('dup')])])
        .map(x => x.elements.length).join(',');

      const big = { items: [] };
      for (let i = 0; i < 900; i++) big.items.push({ name: 'n' + i, section: mk('L' + i, [e('le' + i)]) });
      const before = S.library.list().length;
      const res = S.library.importJSON(JSON.stringify(big));
      out.imported = res.added;
      out.libraryGrew = S.library.list().length - before;
      out.badJson = !!S.library.importJSON('{not json').error;
      out.notALibrary = !!S.library.importJSON('{"a":1}').error;
      out.importNull = !!S.library.importJSON('null').error;
      out.importArrayOfJunk = S.library.importJSON('[1,"x",null]').skipped;
      return out;
    });
    check('at most 200 sections survive the sanitiser', r.sections === 200, r.sections);
    check('at most 200 elements in one list', r.elements === 200, r.elements);
    check('at most 12 columns in one element', r.columns === 12, r.columns);
    check('nesting stops at three levels', r.nesting === 3, r.nesting);
    check('an unknown section type is dropped', r.badSection === 0);
    check('an unknown element type is dropped', r.badElement === 0);
    check('malformed column entries become empty columns',
      r.badColumns === '[{"elements":[]},{"elements":[]},{"elements":[]},{"elements":[]}]', r.badColumns);
    check('duplicate ids are kept rather than made into a crash', r.duplicateIds === '2,1', r.duplicateIds);
    check('an import is capped at 500 items', r.imported === 500, r.imported);
    check('and that is what the library grew by', r.libraryGrew === 500, r.libraryGrew);
    check('malformed JSON is refused with a message', r.badJson === true);
    check('so is a file that is not a library', r.notALibrary === true && r.importNull === true);
    check('junk rows inside a valid wrapper are skipped', r.importArrayOfJunk === 3, r.importArrayOfJunk);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A HOSTILE LIBRARY FILE IS REBUILT, NOT TRUSTED =====');
  {
    const { ctx, p, errs } = await page(b, {});
    const r = await p.evaluate(() => {
      const S = CMS.sections;
      S.library.importJSON(JSON.stringify({ items: [{ name: '<script>x</script>', section: {
        id: '__proto__', type: 'text', elements: [
          { id: 'constructor', type: 'constructor' },
          { id: 'prototype', type: 'text', content: { text: 'kept one' } },
          { id: 'ok', type: 'text', content: { text: 'kept two', evil: 'dropped' } }] } }] }));
      const it = S.library.list()[0];
      const inst = S.library.instance(it.id);
      return { name: it.name, secId: inst.id, ids: inst.elements.map(e => e.id),
               types: inst.elements.map(e => e.type),
               keys: Object.keys(inst.elements[1].content),
               globalClean: ({}).pwned === undefined };
    });
    check('a hostile section id is replaced with a minted one',
      r.secId !== '__proto__' && /^sec_/.test(r.secId), r.secId);
    check('so are hostile element ids', r.ids.every(i => /^el_/.test(i)), r.ids);
    check('an element of an unknown type is dropped',
      r.types.join(',') === 'text,text', r.types);
    check('and an unknown content key with it', r.keys.indexOf('evil') === -1, r.keys);
    check('nothing was polluted along the way', r.globalClean === true);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     5. EVERY ELEMENT TYPE, EMPTY AND HOSTILE
     ================================================================ */
  console.log('\n===== ALL THIRTEEN TYPES, WITH NOTHING AND WITH EVERYTHING =====');
  {
    const TYPES = ['heading', 'text', 'image', 'button', 'card', 'columns', 'divider',
                   'spacer', 'icon', 'notice', 'featureBox', 'faq', 'socialLinks'];
    const HOSTILE = {
      text: '<img src=x onerror=window.__pwned=1>', level: 'javascript:',
      src: 'javascript:alert(1)', alt: '"><script>window.__pwned=2</script>',
      href: 'javascript:window.__pwned=3', title: '<b>x</b>',
      image: 'data:text/html,<script>window.__pwned=4</script>', imageAlt: 'x',
      icon: 'constructor', variant: '__proto__', titleLevel: 'toString',
      platform: 'prototype', url: 'vbscript:msgbox(1)', label: 'x', linkText: 'x',
      buttonText: 'x', buttonHref: '//evil.example/x', width: 'expression(1)',
      height: '-99', newTab: 'yes',
      items: [{ question: '<script>q</script>', answer: 'a' },
              { platform: 'constructor', url: 'javascript:x' }]
    };
    const HOSTILE_STYLE = { color: 'red;}body{display:none}', bgImage: 'javascript:x',
      padding: 'var(--evil)', border: '1px solid url(x)', align: '__proto__' };

    for (const mode of ['empty', 'hostile']) {
      const sections = TYPES.map((t, i) => sec('s' + i, 'text', [
        el('e' + i, t, mode === 'empty' ? {} : JSON.parse(JSON.stringify(HOSTILE)),
           mode === 'empty' ? {} : HOSTILE_STYLE,
           mode === 'empty' ? {} : { mobile: { fontSize: 'expression(9)' } })]));
      const r = await page(b, { sections });
      const s = await shot(r.p);
      check(mode + ': every section is drawn', s.secs === 13, s.secs);
      check(mode + ': no script ran', s.pwned === undefined, s.pwned);
      check(mode + ': no script element was created', s.scripts === 0);
      check(mode + ': no event-handler attribute survived', s.handlers === 0);
      check(mode + ': no unsafe link',
        s.hrefs.every(h => !/^(javascript|data|blob|vbscript):/i.test(h || '') && !/^\/\//.test(h || '')), s.hrefs);
      check(mode + ': no unsafe image source',
        s.imgs.every(i => !/^(javascript|data|blob|vbscript):/i.test(i || '') && !/^\/\//.test(i || '')), s.imgs);
      check(mode + ': the CSS escape attempt emitted nothing dangerous',
        !/expression\(|javascript:|var\(--evil|url\(x|\}body/.test(s.css), s.css.slice(0, 200));
      check(mode + ': the page is not hidden', s.bodyDisplay !== 'none', s.bodyDisplay);
      check(mode + ': the shipped content is still there', s.bodyLen > 400, s.bodyLen);
      check(mode + ': the page H1 is untouched', s.h1 === 'About JSK1', s.h1);
      check(mode + ': nothing threw', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
  }

  console.log('\n===== ALL THIRTEEN TYPES, WITH REAL CONTENT =====');
  {
    const S = [
      sec('a1', 'text', [el('i1', 'image', { src: 'assets/images/logo.png', alt: 'Real alt', width: '120', height: '40' })]),
      sec('a2', 'text', [el('i2', 'image', { src: 'assets/images/logo.png', alt: '' })]),
      sec('a3', 'text', [el('ic', 'icon', { icon: 'star', label: 'Starred' })]),
      sec('a4', 'text', [el('ic2', 'icon', { icon: 'star' })]),
      sec('a5', 'text', [el('fq', 'faq', { items: [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }] })]),
      sec('a6', 'text', [el('so', 'socialLinks', { items: [{ platform: 'whatsapp', url: 'https://wa.me/1' }] })]),
      sec('a7', 'cards', [el('cd', 'card', { title: 'T', text: 'B', image: 'assets/images/logo.png',
        imageAlt: 'Card alt', buttonText: 'Go', buttonHref: 'contact.html' })]),
      sec('a8', 'text', [el('fb', 'featureBox', { icon: 'shield', title: 'FT', titleLevel: 'h3', text: 'FD' })]),
      sec('a9', 'text', [el('nt', 'notice', { text: 'Note', variant: 'warning', icon: 'info' })]),
      sec('a10', 'text', [el('dv', 'divider', {}, { lineColor: '@border' }), el('sp', 'spacer', {}, { height: '40' })]),
      sec('a11', 'text', [el('bt', 'button', { text: 'Press', href: 'contact.html' })]),
      sec('a12', 'text', [el('hd', 'heading', { text: 'Head', level: 'h2' })]),
      sec('a13', 'text', [el('tx', 'text', { text: 'Body' })])
    ];
    const r = await page(b, { sections: S });
    const d = await r.p.evaluate(() => {
      const q = s => document.querySelector(s);
      const imgs = [...document.querySelectorAll('.pb-section img')];
      return {
        kinds: [...document.querySelectorAll('.pb-el')].map(n => n.className.split(' ')[1]),
        alts: imgs.map(i => ({ alt: i.getAttribute('alt'), lazy: i.getAttribute('loading'),
                               dec: i.getAttribute('decoding') })),
        iconLabelled: (() => { const n = q('[data-el="ic"]');
          return n.getAttribute('aria-label') + '|' + n.querySelector('i').getAttribute('aria-hidden'); })(),
        iconBare: (() => { const n = q('[data-el="ic2"]');
          return (n.getAttribute('aria-label') || '-') + '|' + n.querySelector('i').getAttribute('aria-hidden'); })(),
        faq: [...q('[data-el="fq"]').querySelectorAll('button')]
          .map(x => x.getAttribute('aria-expanded') + ':' + !!x.getAttribute('aria-controls')).join(','),
        social: [...document.querySelectorAll('[data-el="so"] a')]
          .map(a => a.getAttribute('href') + '|' + (a.getAttribute('aria-label') || a.textContent.trim())),
        fbLevel: q('[data-el="fb"]').querySelector('h3') ? 'h3' : 'other',
        btnHref: q('[data-el="bt"]').getAttribute('href') ||
                 (q('[data-el="bt"] a') || {}).getAttribute && q('[data-el="bt"] a').getAttribute('href')
      };
    });
    check('every element type renders something',
      d.kinds.length >= 14 && d.kinds.indexOf(undefined) === -1, d.kinds);
    check('a real alt is kept, and a decorative one stays an empty alt rather than none',
      d.alts.length === 3 && d.alts[0].alt === 'Real alt' && d.alts[1].alt === '', d.alts);
    check('every builder image is lazy and async-decoded',
      d.alts.every(a => a.lazy === 'lazy' && a.dec === 'async'), d.alts);
    check('a labelled icon names itself and hides its glyph',
      d.iconLabelled === 'Starred|true', d.iconLabelled);
    check('an unlabelled icon is decorative rather than announced as nothing',
      d.iconBare === '-|true', d.iconBare);
    check('the FAQ wires aria-expanded and aria-controls', d.faq === 'false:true,false:true', d.faq);
    check('a social link has a real href and an accessible name',
      d.social.length === 1 && /^https:\/\/wa\.me/.test(d.social[0]) && /WhatsApp/.test(d.social[0]), d.social);
    check('a feature box honours its heading level', d.fbLevel === 'h3', d.fbLevel);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     6. RESPONSIVE, ON THE REAL PAGE
     ================================================================ */
  console.log('\n===== THREE BREAKPOINTS, AND NOTHING LEAKING BETWEEN THEM =====');
  {
    const S = [sec('r1', 'text', [
      el('h', 'heading', { text: 'R', level: 'h2' }, { fontSize: '40', color: '@primary' },
         { tablet: { fontSize: '28' }, mobile: { fontSize: '16' } }),
      el('inh', 'text', { text: 'I' }, { fontSize: '22' }, { mobile: {} }),
      el('k', 'columns', { columns: [
        { elements: [el('c1', 'text', { text: 'A' })] },
        { elements: [el('c2', 'text', { text: 'B' })] },
        { elements: [el('c3', 'text', { text: 'C' })] }] },
        { columns: '3' }, { tablet: { columns: '2' }, mobile: { columns: '1' } })
    ], { style: { padding: '40' }, responsive: { tablet: { padding: '20' }, mobile: {} } })];
    const r = await page(b, { sections: S });
    const read = () => r.p.evaluate(() => ({
      fs: getComputedStyle(document.querySelector('[data-el="h"]')).fontSize,
      inh: getComputedStyle(document.querySelector('[data-el="inh"]')).fontSize,
      tracks: getComputedStyle(document.querySelector('[data-el="k"]')).gridTemplateColumns.split(' ').length,
      pad: getComputedStyle(document.querySelector('[data-sec="r1"]')).paddingTop,
      colour: getComputedStyle(document.querySelector('[data-el="h"]')).color
    }));
    const desk = await read();
    await r.p.setViewportSize({ width: 900, height: 800 }); await r.p.waitForTimeout(260);
    const tab = await read();
    await r.p.setViewportSize({ width: 390, height: 800 }); await r.p.waitForTimeout(260);
    const mob = await read();
    check('an overridden size changes at every band',
      desk.fs === '40px' && tab.fs === '28px' && mob.fs === '16px', { desk, tab, mob });
    check('a value with no override inherits, unchanged, everywhere',
      desk.inh === '22px' && tab.inh === '22px' && mob.inh === '22px',
      [desk.inh, tab.inh, mob.inh]);
    check('responsive column counts follow the band',
      desk.tracks === 3 && tab.tracks === 2 && mob.tracks === 1,
      [desk.tracks, tab.tracks, mob.tracks]);
    check('a section override applies at tablet and inherits at mobile',
      desk.pad === '40px' && tab.pad === '20px' && mob.pad === '20px',
      [desk.pad, tab.pad, mob.pad]);
    check('a semantic colour survives every band',
      desk.colour === tab.colour && tab.colour === mob.colour && desk.colour === 'rgb(0, 136, 204)',
      [desk.colour, mob.colour]);
    const css = await r.p.evaluate(() => (document.getElementById('cmsBuilder') || {}).textContent || '');
    /* The reference carries its shipped constant as the var() FALLBACK,
       which is the whole point -- the role can move without regenerating
       a single element rule. What must never appear is a bare hex where
       the reference should be. */
    check('the colour is emitted as a reference with its constant as a fallback',
      /--pbe-color:var\(--pbg-primary,\s*#0088cc\)/.test(css), css.slice(0, 200));
    check('and never as a resolved hex standing alone',
      !/--pbe-color:\s*#0088cc/.test(css), css.slice(0, 200));
    check('no arbitrary custom property can be declared',
      !/--(?!pbs-|pbe-|pbg-)[a-z]/.test(css), css.slice(0, 200));
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     7. WHAT NEVER LEAVES THE DEVICE, AND WHAT NEVER REACHES A VISITOR
     ================================================================ */
  console.log('\n===== AN UNPUBLISHED BUILDER BLOCK IS NOT A PAGE =====');
  {
    /* publishedSections() gates on pages.<slug>.builder.status, so this is
       the shape that actually exercises it -- a draft parked in
       builderDrafts would render nothing whether the gate were there or
       not. */
    const r = await page(b, { state: { pages: { about: { builder: {
      schemaVersion: 2, status: 'draft',
      sections: [sec('u1', 'text', [el('ue', 'text', { text: 'UNPUBLISHED-SECRET' })])] } } } } });
    const s = await shot(r.p);
    check('a builder block whose status is draft renders nothing', s.secs === 0, s.secs);
    check('and none of it appears in the page', !/UNPUBLISHED-SECRET/.test(s.html));
    check('the page keeps its shipped content', s.h1 === 'About JSK1' && s.bodyLen > 400);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();

    /* and the same block, published, does render -- so the check above is
       about the status and not about the data being unusable */
    const r2 = await page(b, { sections: [sec('u1', 'text', [el('ue', 'text', { text: 'PUBLISHED-NOW' })])] });
    const s2 = await shot(r2.p);
    check('the same sections published do render', s2.secs === 1 && /PUBLISHED-NOW/.test(s2.html), s2.secs);
    await r2.ctx.close();
  }

  console.log('\n===== DRAFTS, LIBRARY AND RECOVERY STAY WHERE THEY ARE =====');
  {
    const r = await page(b, { state: {
      builderDrafts: { about: { schemaVersion: 2, status: 'draft',
        sections: [sec('d1', 'text', [el('de', 'text', { text: 'DRAFT-ONLY-SECRET' })])] } },
      builderLibrary: { version: 1, items: [{ id: 'lib1', name: 'LIBRARY-ONLY-SECRET',
        section: sec('l1', 'text', [el('le', 'text', { text: 'LIBRARY-BODY-SECRET' })]) }] },
      builderRecovery: { about: { reason: 'discard',
        sections: [sec('v1', 'text', [el('ve', 'text', { text: 'RECOVERY-ONLY-SECRET' })])] } }
    } });
    const s = await shot(r.p);
    check('an unpublished draft renders nothing', s.secs === 0, s.secs);
    check('and none of the three local stores appears in the page at all',
      !/DRAFT-ONLY-SECRET|LIBRARY-ONLY-SECRET|LIBRARY-BODY-SECRET|RECOVERY-ONLY-SECRET/.test(s.html));
    check('nor in the generated CSS',
      !/SECRET/.test(s.css) && !/data-sec="d1"|data-sec="l1"|data-sec="v1"/.test(s.css), s.css.slice(0, 120));
    check('the page keeps its shipped content', s.h1 === 'About JSK1' && s.bodyLen > 400);

    /* Driven through the real Remote.publish(), and read off the wire --
       rebuilding the payload in the test would only prove the test agrees
       with itself. */
    const published = await r.p.evaluate(() =>
      CMS.remote.signIn('a@b.c', 'x').then(() => CMS.remote.publish()).then(() => true, e => String(e)));
    check('a publish goes through', published === true, published);
    await r.p.waitForTimeout(300);
    check('exactly one write was sent', r.sent.length === 1, r.sent.length);
    const body = r.sent[0] || '';
    check('none of the three local stores is in what was sent',
      !/builderDrafts|builderLibrary|builderRecovery/.test(body),
      (body.match(/builder[A-Za-z]+/g) || []).slice(0, 4));
    check('and no secret from them rides along in it', !/SECRET/.test(body));
    check('while the payload really is the config', /branding/.test(body) && /"pages"/.test(body));
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  console.log('\n===== A PULL KEEPS WHAT IS LOCAL AND TAKES WHAT IS NOT =====');
  {
    const r = await page(b, {
      state: {
        builderDrafts: { about: { schemaVersion: 2, status: 'draft',
          sections: [sec('keep', 'text', [el('ke', 'text', { text: 'LOCAL-DRAFT' })])] } },
        builderLibrary: { version: 1, items: [{ id: 'l', name: 'LOCAL-LIB', section: sec('ls', 'text', []) }] },
        builderRecovery: { about: { reason: 'discard', sections: [] } }
      },
      row: { branding: { siteName: 'FromServer' },
             pages: { about: { title: 'Server title' } } }
    });
    await r.p.waitForTimeout(500);
    const after = await r.p.evaluate(() => {
      const d = CMS.data();
      return { name: d.branding.siteName,
               draftKept: ((((d.builderDrafts || {}).about || {}).sections || [])[0] || {}).id,
               libKept: (((d.builderLibrary || {}).items || [])[0] || {}).name,
               recKept: !!(d.builderRecovery || {}).about,
               title: (d.pages.about || {}).title };
    });
    check('the server row wins for published content', after.name === 'FromServer', after);
    check('and for page fields', after.title === 'Server title', after);
    check('the local draft survives the pull', after.draftKept === 'keep', after);
    check('so does the local library', after.libKept === 'LOCAL-LIB', after);
    check('and the recovery snapshot', after.recKept === true, after);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     7b. THE ONE VALUE THE ADMIN DRAWS RATHER THAN WRITES
     ----------------------------------------------------------------
     The share-card preview paints the OG image. It used to interpolate
     the URL into a style="" attribute, and escaping for HTML does not
     protect a CSS context: the attribute is parsed as HTML first, so
     &#39; becomes a quote again before the CSS parser sees it.
     ================================================================ */
  console.log('\n===== THE SHARE-CARD PREVIEW CANNOT BE MADE TO FETCH ANYTHING =====');
  {
    const admin = async (b2, ogImage) => {
      const ctx = await b2.newContext({ viewport: { width: 1500, height: 1200 } });
      const asked = [];
      await ctx.route('**', r => {
        const q = r.request(), u = q.url();
        if (/supabase\.co/.test(u)) {
          if (u.includes('/auth/v1/token'))
            return r.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"stub"}' });
          if (q.method() === 'POST') return r.fulfill({ status: 201, body: '' });
          return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (!/localhost:/.test(u)) { asked.push(u.slice(0, 60)); return r.abort(); }
        return r.continue();
      });
      const pg = await ctx.newPage();
      const er = [];
      pg.on('pageerror', e => er.push(String(e).slice(0, 100)));
      pg.on('dialog', d => d.accept());
      await pg.addInitScript(v => {
        const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
        raw.pages = { about: { og: { image: v } } };
        localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
      }, ogImage);
      await pg.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
      await pg.fill('#authEmail', 'a@b.c'); await pg.fill('#authPass', 'x'); await pg.click('#authBtn');
      await pg.waitForTimeout(500);
      await pg.click('.adm-nav-item[data-panel="pages"]'); await pg.waitForTimeout(700);
      await pg.click('#pageTabs .pagetab[data-page-key="about"]'); await pg.waitForTimeout(700);
      const out = await pg.evaluate(() => {
        const n = document.querySelector('#pvOg .pv-img');
        return n ? { attr: n.getAttribute('style'), bg: getComputedStyle(n).backgroundImage,
                     empty: n.classList.contains('pv-img-empty'),
                     /* what the real og:image tag would carry for the same
                        value -- the preview has to agree with it */
                     tag: CMS.seoCrawlableImage((CMS.data().pages.about.og || {}).image) } : null;
      });
      /* hosts, not substrings: https://jsk-1.com/evil.test/x.png names the
         string but is a request to this site. */
      const hosts = asked.map(u => { try { return new URL(u).host; } catch (e) { return u; } });
      return { ctx, out, asked, hosts, er };
    };

    const HOSTILE = [
      ["a quote that closes the declaration", "x'); background-image:url('http://evil.test/a.png"],
      ['a double quote', 'x"); background-image:url("http://evil.test/b.png'],
      ['a semicolon and a new property', 'x.png; background-image:url(http://evil.test/c.png)'],
      ['javascript:', 'javascript:alert(1)'],
      ['a data URL', 'data:image/svg+xml,<svg onload=alert(1)>'],
      ['a blob URL', 'blob:http://x/y'],
      ['a vbscript URL', 'vbscript:msgbox(1)'],
      ['a url() inside a url()', 'url(http://evil.test/e.png)'],
      ['a brace', 'x.png} .pv-body{display:none']
    ];
    for (const [name, value] of HOSTILE) {
      const r = await admin(b, value);
      check('the preview refuses ' + name,
        r.out && r.out.empty === true && r.out.bg === 'none', r.out);
      check('and fetches nothing for it ' + name.slice(0, 18),
        r.hosts.indexOf('evil.test') === -1, r.hosts);
      check('no page errors ' + name.slice(0, 18), r.er.length === 0, r.er);
      await r.ctx.close();
    }

    /* A protocol-relative URL is not refused, it is RESOLVED: absUrl()
       strips the leading slashes and hangs it off the configured base, so
       the preview and the real tag both end up pointing at this site
       rather than at whoever wrote it. Asserted as what it is. */
    {
      const r = await admin(b, '//evil.test/d.png');
      check('a protocol-relative URL is resolved against this site, not followed',
        r.out && /^url\("https:\/\/jsk-1\.com\//.test(r.out.bg), r.out);
      check('so nothing is fetched from the host it names',
        r.hosts.indexOf('evil.test') === -1, r.hosts);
      check('and the preview shows exactly what the tag would carry',
        r.out && r.out.bg === 'url("' + r.out.tag + '")', r.out);
      await r.ctx.close();
    }

    const good = await admin(b, 'assets/images/logo.png');
    check('but a real asset still shows in the preview',
      good.out && good.out.empty === false &&
      /url\("https:\/\/jsk-1\.com\/assets\/images\/logo\.png"\)/.test(good.out.bg), good.out);
    check('and it is the same URL the tag would carry',
      good.out.bg === 'url("' + good.out.tag + '")', good.out);
    check('no page errors on the valid case', good.er.length === 0, good.er);
    await good.ctx.close();
  }

  /* ================================================================
     8. AT SIZE, AND ON THE WIRE
     ================================================================ */
  console.log('\n===== 30 SECTIONS, 90 COLUMNS, 240 ELEMENTS, ON A PUBLIC PAGE =====');
  {
    const secs = [];
    for (let i = 0; i < 30; i++) {
      const cols = [];
      for (let c = 0; c < 3; c++) cols.push({ elements: [
        el(`e${i}c${c}a`, 'text', { text: `s${i} c${c}` }, { fontSize: '16' }, { mobile: { fontSize: '13' } }),
        el(`e${i}c${c}b`, 'heading', { text: `H${i}.${c}`, level: 'h3' }, { color: '@primary' })] });
      secs.push(sec(`s${i}`, 'text', [
        el(`e${i}h`, 'heading', { text: 'Head ' + i, level: 'h2' }, { typography: '@h2' }),
        el(`e${i}k`, 'columns', { columns: cols }, { columns: '3' }, { mobile: { columns: '1' } })
      ], { style: { padding: '20' }, responsive: { tablet: { padding: '12' } } }));
    }
    const t0 = Date.now();
    const r = await page(b, { sections: secs });
    const loadMs = Date.now() - t0;
    const m = await r.p.evaluate(() => {
      const t = performance.now(); CMS.sections.paint(); const repaint = performance.now() - t;
      const t2 = performance.now();
      const n = CMS.sections.sanitize(CMS.data().pages.about.builder.sections);
      const san = performance.now() - t2;
      const before = document.querySelectorAll('style').length;
      for (let i = 0; i < 25; i++) { CMS.sections.paint(); CMS.paintVars(); }
      return { secs: document.querySelectorAll('.pb-section').length,
               els: document.querySelectorAll('.pb-el').length,
               cols: document.querySelectorAll('.pb-columns').length,
               repaint: repaint, sanitize: san, sanitized: n.length,
               stylesBefore: before, stylesAfter: document.querySelectorAll('style').length,
               secsAfter: document.querySelectorAll('.pb-section').length,
               elsAfter: document.querySelectorAll('.pb-el').length };
    });
    check('the payload really is that big',
      m.secs === 30 && m.cols === 30 && m.els === 240, m);
    check('the page loads in a sensible time (' + loadMs + 'ms)', loadMs < 8000, loadMs);
    check('a full repaint takes under 150ms (' + m.repaint.toFixed(1) + 'ms)', m.repaint < 150, m.repaint);
    check('sanitising the whole tree takes under 150ms (' + m.sanitize.toFixed(1) + 'ms)',
      m.sanitize < 150, m.sanitize);
    check('and sanitising keeps every section', m.sanitized === 30, m.sanitized);
    check('25 repaints add no style tags', m.stylesAfter === m.stylesBefore,
      [m.stylesBefore, m.stylesAfter]);
    check('and leave the same nodes behind, not a copy of them',
      m.secsAfter === 30 && m.elsAfter === 240, [m.secsAfter, m.elsAfter]);
    check('the page made exactly one Supabase read and no writes',
      r.seen.filter(x => x === 'supabase:GET').length === 1 &&
      r.seen.filter(x => /supabase:(POST|PUT|PATCH|DELETE)/.test(x)).length === 0, r.seen);
    check('and reached no host beyond the fonts and icons it already ships',
      r.seen.filter(x => x.indexOf('external:') === 0)
        .every(x => /fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com/.test(x)), r.seen);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     9. THE PAGES THAT ARE NOT BUILDER PAGES
     ================================================================ */
  console.log('\n===== LEGACY, LOGIN, REGISTER AND THE HOMEPAGE =====');
  {
    for (const [url, name] of [['index.html', 'the homepage'],
                               ['responsible-gaming.html', 'a legacy page'],
                               ['login.html', 'login'], ['register.html', 'register']]) {
      const r = await page(b, { url, sections: [sec('x', 'text', [el('y', 'text', { text: 'BUILDER' })])] });
      const s = await shot(r.p);
      check(name + ' renders no builder content', s.secs === 0 && !/BUILDER/.test(s.html), s.secs);
      check(name + ' keeps its own content', s.bodyLen > 80, s.bodyLen);
      check(name + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
    const r = await page(b, { url: 'index.html' });
    const home = await r.p.evaluate(() => ({
      mounts: document.querySelectorAll('[data-cms-sections]').length,
      h1: document.querySelectorAll('h1').length
    }));
    check('the homepage still has no builder mount at all', home.mounts === 0, home);
    check('and exactly one H1', home.h1 === 1, home);
    await r.ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
