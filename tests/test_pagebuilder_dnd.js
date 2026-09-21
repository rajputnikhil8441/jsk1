/* Page Builder V2 -- milestone D: safe drag and drop.

   THE CLAIM. Sections, columns and eligible elements can be dragged into
   a new order, and everything a drag could plausibly break does not
   break: the schema is not widened, a cancelled drag is indistinguishable
   from no drag at all, a move preserves the node it moved rather than
   rebuilding one that looks like it, and nothing about dragging reaches
   the live site.

   HOW IT IS TESTED. Two ways, on purpose.

   Through the mouse, because that is what an author uses, and because the
   drop position comes from real rectangles -- a test that computed the
   position itself would be testing its own arithmetic.

   Through ADMIN_BUILDER.drag, which is the same pair of functions the
   pointer handlers call, because most of the refusals cannot be produced
   with a mouse. There is no address you can drag to that says
   sec: '__proto__', and a stale id needs the tree to change between
   pointerdown and pointerup. Those are driven directly. It is the real
   entry point, not a copy of it. */
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

/* ---- the seeded draft ------------------------------------------------
   Deliberately carries one of everything a move must not damage: a
   semantic colour reference, a responsive override at two breakpoints, an
   asset path with its real dimensions, a column layout preset with a
   tablet override, and nested elements. */
const SEED = () => ({
  builderDrafts: {
    about: {
      schemaVersion: 2, status: 'draft',
      sections: [
        { id: 'secA', type: 'text', enabled: true,
          visibility: { desktop: true, tablet: true, mobile: true },
          style: { bg: '@surface' }, responsive: { tablet: { padding: '18' }, mobile: {} },
          elements: [
            { id: 'elHead', type: 'heading', content: { text: 'Alpha', level: 'h2' },
              style: { typography: 'h2', color: '@primary' },
              responsive: { tablet: { fontSize: '22' }, mobile: { fontSize: '18' } } },
            { id: 'elText', type: 'text', content: { text: 'Body copy.' },
              style: { color: '@muted' }, responsive: {} },
            { id: 'elCols', type: 'columns',
              style: { columns: '2', 'columns-t': '1' },
              responsive: { tablet: { columns: '1' }, mobile: {} },
              content: { columns: [
                { elements: [
                  { id: 'elImg', type: 'image',
                    content: { src: 'assets/images/logo.png', alt: 'Logo', width: '120', height: '40',
                               loading: 'lazy', decoding: 'async' },
                    style: {}, responsive: {} }
                ] },
                { elements: [
                  { id: 'elDeep', type: 'text', content: { text: 'In the second column.' },
                    style: { color: '@danger' }, responsive: { mobile: { fontSize: '13' } } }
                ] }
              ] } },
            { id: 'elCols2', type: 'columns', style: { columns: '2' }, responsive: {},
              content: { columns: [
                { elements: [ { id: 'elTwoA', type: 'text', content: { text: 'Second block, left.' },
                  style: {}, responsive: {} } ] },
                { elements: [ { id: 'elTwoB', type: 'text', content: { text: 'Second block, right.' },
                  style: {}, responsive: {} } ] }
              ] } },
            /* A plain text element carrying a columns array it has no
               business having -- the shape a hand-edited or imported draft
               can arrive in. It must never be usable as a container. */
            { id: 'elFake', type: 'text',
              content: { text: 'Not a container.', columns: [ { elements: [] } ] },
              style: {}, responsive: {} }
          ] },
        { id: 'secB', type: 'cards', enabled: true,
          visibility: { desktop: true, tablet: true, mobile: true },
          style: {}, responsive: {},
          elements: [ { id: 'elCard', type: 'card',
            content: { title: 'Card', text: 'Text' }, style: {}, responsive: {} } ] },
        { id: 'secC', type: 'banner', enabled: true,
          visibility: { desktop: true, tablet: true, mobile: true },
          style: {}, responsive: {},
          elements: [ { id: 'elFeat', type: 'text', content: { text: 'Third.' },
            style: {}, responsive: {} } ] }
      ]
    }
  }
});

async function adminPage(b, seed, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: opts.width || 1700, height: opts.height || 1900 },
                                   hasTouch: !!opts.touch, isMobile: false });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  p.on('dialog', d => d.accept());
  if (seed) await p.addInitScript(arg => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg);
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
  await p.waitForTimeout(400);
  await p.click('.adm-nav-item[data-panel="builder"]');
  await p.waitForTimeout(700);
  return { ctx, p, errs, st };
}

/* Expand a section so its element list exists in the DOM. */
const openSec = async (p, id) => {
  await p.evaluate(secId => {
    const rows = document.querySelectorAll('#pbList > .pb-sec');
    for (const r of rows) if (r.getAttribute('data-sec-id') === secId) {
      if (!r.classList.contains('open')) r.querySelector('.pb-sec-title').click();
      return;
    }
  }, id);
  await p.waitForTimeout(500);
};

const draft = p => p.evaluate(() => CMS.sections.draft('about').sections);
const lineState = p => p.evaluate(() => {
  const n = document.getElementById('pbDropLine');
  return n ? { shown: n.style.display, ok: n.getAttribute('data-ok'), cls: n.className }
           : { shown: 'none', ok: null, cls: '' };
});
const draftJSON = p => p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections));
const order = p => p.evaluate(() => CMS.sections.draft('about').sections.map(s => s.id));

/* Every id in the tree, in tree order -- the thing a move must permute
   and never lengthen, shorten or repeat. */
const allIds = p => p.evaluate(() => {
  const out = [];
  (CMS.sections.draft('about').sections || []).forEach(function walkSec(s) {
    out.push(s.id);
    (function walk(els) {
      (els || []).forEach(e => {
        out.push(e.id);
        const cols = (e.content || {}).columns;
        if (Array.isArray(cols)) cols.forEach(c => walk(c && c.elements));
      });
    })(s.elements);
  });
  return out;
});

/* Drag a handle onto a target node, releasing at `where` inside it.
   Returns what the drop indicator said just before the release. */
/* Put both ends of the drag on screen: the pointer works in viewport
   coordinates, and document.elementFromPoint() outside the viewport is
   null, which would look like "no valid target" for the wrong reason. */
async function centre(p, aSel, bSel) {
  await p.evaluate(([a, b]) => {
    const x = document.querySelector(a), y = document.querySelector(b);
    if (!x || !y) return;
    const r = x.getBoundingClientRect(), s = y.getBoundingClientRect();
    const mid = (Math.min(r.top, s.top) + Math.max(r.bottom, s.bottom)) / 2;
    window.scrollBy(0, mid - window.innerHeight / 2);
    /* The admin has a sticky header. A handle tucked under it would take
       the pointerdown on the header instead. */
    const top = x.getBoundingClientRect().top;
    if (top < 100) window.scrollBy(0, top - 100);
  }, [aSel, bSel]);
  await p.waitForTimeout(120);
}

async function dragTo(p, handleSel, targetSel, where) {
  const h = await p.$(handleSel);
  const t = await p.$(targetSel);
  if (!h || !t) return { missing: !h ? handleSel : targetSel };
  /* The pointer works in viewport coordinates, so both ends of the drag
     have to be on screen before it starts. */
  await centre(p, handleSel, targetSel);
  const hb = await h.boundingBox(), tb = await t.boundingBox();
  const y = where === 'top' ? tb.y + 3 : where === 'bottom' ? tb.y + tb.height - 3 : tb.y + tb.height / 2;
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await p.mouse.down();
  await p.mouse.move(hb.x + hb.width / 2, hb.y - 14, { steps: 3 });
  await p.mouse.move(tb.x + 60, y, { steps: 8 });
  const line = await lineState(p);
  await p.mouse.up();
  await p.waitForTimeout(450);
  return { line };
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. WHAT THE DRAG LAYER REFUSES
     ================================================================ */
  console.log('\n===== REFUSALS: THE ADDRESS IS NEVER TRUSTED =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    await openSec(p, 'secA');
    const before = await draftJSON(p);

    const tryMove = (drag, target) => p.evaluate(([d, t]) => {
      const D = window.ADMIN_BUILDER.drag;
      const checked = D.check(d, t);
      const moved = D.move(d, t);
      return { checked, moved, draft: JSON.stringify(CMS.sections.draft('about').sections) };
    }, [drag, target]);

    const SEC = k => ({ kind: 'section' });
    const ROOT = { kind: 'element', sec: 'secA', el: '', col: -1 };
    const COL0 = { kind: 'element', sec: 'secA', el: 'elCols', col: 0 };
    const COL1 = { kind: 'element', sec: 'secA', el: 'elCols', col: 1 };
    const COLS = { kind: 'column', sec: 'secA', el: 'elCols' };

    const cases = [
      ['a section cannot be dropped into an element list',
        { kind: 'section', addr: { kind: 'section' }, id: 'secB' },
        { kind: 'element', addr: COL0, index: 0 }],
      ['an element cannot be dropped into the section list',
        { kind: 'element', addr: ROOT, id: 'elText' }, { kind: 'section', addr: { kind: 'section' }, index: 0 }],
      ['a column cannot be dropped into an element list',
        { kind: 'column', addr: COLS, index: 0 }, { kind: 'element', addr: ROOT, index: 0 }],
      ['a columns element cannot be dropped into a column (the renderer refuses that nesting)',
        { kind: 'element', addr: ROOT, id: 'elCols' }, { kind: 'element', addr: COL0, index: 0 }],
      ['a columns element cannot be dropped into its OWN column',
        { kind: 'element', addr: ROOT, id: 'elCols' }, { kind: 'element', addr: COL1, index: 0 }],
      ['a columns element cannot be dropped into a DIFFERENT columns element',
        { kind: 'element', addr: ROOT, id: 'elCols' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols2', col: 0 }, index: 0 }],
      ['a column cannot be moved to a different columns element that really exists',
        { kind: 'column', addr: COLS, index: 0 },
        { kind: 'column', addr: { kind: 'column', sec: 'secA', el: 'elCols2' }, index: 0 }],
      ['a column cannot be moved to a columns element in another section',
        { kind: 'column', addr: COLS, index: 0 },
        { kind: 'column', addr: { kind: 'column', sec: 'secB', el: 'elCols' }, index: 0 }],
      ['an element that merely CARRIES a columns array is not a container',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elFake', col: 0 }, index: 0 }],
      ['nor can its columns be reordered',
        { kind: 'column', addr: { kind: 'column', sec: 'secA', el: 'elFake' }, index: 0 },
        { kind: 'column', addr: { kind: 'column', sec: 'secA', el: 'elFake' }, index: 0 }],
      ['an unknown section id resolves to nothing',
        { kind: 'element', addr: { kind: 'element', sec: 'nope', el: '', col: -1 }, id: 'elText' },
        { kind: 'element', addr: ROOT, index: 0 }],
      ['an unknown element id resolves to nothing',
        { kind: 'element', addr: ROOT, id: 'elGhost' }, { kind: 'element', addr: COL0, index: 0 }],
      ['an unknown columns-element id makes the target unresolvable',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elGhost', col: 0 }, index: 0 }],
      ['an element id that names a NON-columns element is not a container',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elHead', col: 0 }, index: 0 }],
      ['__proto__ as a section id',
        { kind: 'element', addr: { kind: 'element', sec: '__proto__', el: '', col: -1 }, id: 'elText' },
        { kind: 'element', addr: ROOT, index: 0 }],
      ['constructor as a section id',
        { kind: 'element', addr: { kind: 'element', sec: 'constructor', el: '', col: -1 }, id: 'elText' },
        { kind: 'element', addr: ROOT, index: 0 }],
      ['prototype as a section id',
        { kind: 'element', addr: { kind: 'element', sec: 'prototype', el: '', col: -1 }, id: 'elText' },
        { kind: 'element', addr: ROOT, index: 0 }],
      ['__proto__ as a columns-element id',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: '__proto__', col: 0 }, index: 0 }],
      ['constructor as the dragged element id',
        { kind: 'element', addr: ROOT, id: 'constructor' }, { kind: 'element', addr: COL0, index: 0 }],
      ['a section id with a quote in it',
        { kind: 'element', addr: { kind: 'element', sec: 'sec"A', el: '', col: -1 }, id: 'elText' },
        { kind: 'element', addr: ROOT, index: 0 }],
      ['a column index that is a string',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols', col: '0' }, index: 0 }],
      ['a negative column index',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols', col: -1 }, index: 0 }],
      ['a column index past the end',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols', col: 9 }, index: 0 }],
      ['a fractional column index',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols', col: 1.5 }, index: 0 }],
      ['a NaN column index',
        { kind: 'element', addr: ROOT, id: 'elText' },
        { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols', col: Number.NaN }, index: 0 }],
      ['a drop index that is not a number',
        { kind: 'element', addr: ROOT, id: 'elText' }, { kind: 'element', addr: COL0, index: 'x' }],
      ['a null drag',  null, { kind: 'element', addr: COL0, index: 0 }],
      ['a null target', { kind: 'element', addr: ROOT, id: 'elText' }, null],
      ['an address with no kind at all',
        { addr: ROOT, id: 'elText' }, { kind: 'element', addr: COL0, index: 0 }],
      ['a column drag with an out-of-range source index',
        { kind: 'column', addr: COLS, index: 7 }, { kind: 'column', addr: COLS, index: 0 }],
      ['a stale node: the id is right but the object at that place is not the one picked up',
        { kind: 'element', addr: ROOT, id: 'elText', ref: { id: 'elText' } },
        { kind: 'element', addr: COL0, index: 0 }]
    ];

    for (const [name, d, t] of cases) {
      const r = await tryMove(d, t);
      check(name + ' -- refused', r.checked === false && r.moved === false, r.checked + '/' + r.moved);
      check(name + ' -- the draft is untouched', r.draft === before);
    }

    check('no page errors while every refusal was driven', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     1b. IDS THAT ARE ALREADY IN THE DRAFT, AND SHOULD NOT BE
     ----------------------------------------------------------------
     The refusals above feed bad ids in from outside. This feeds them in
     from INSIDE: a draft that arrived by hand or by a hostile import and
     already carries them. Two things have to hold at once -- the bad
     nodes cannot be addressed, and their presence does not stop anything
     else working.
     ================================================================ */
  console.log('\n===== A DRAFT THAT ALREADY CARRIES A BAD ID =====');
  {
    const planted = { builderDrafts: { about: { schemaVersion: 2, status: 'draft', sections: [
      { id: '__proto__', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'pOne', type: 'text', content: { text: 'one' }, style: {}, responsive: {} }] },
      { id: 'constructor', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'pTwo', type: 'text', content: { text: 'two' }, style: {}, responsive: {} }] },
      { id: 'sec"X', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'pThree', type: 'text', content: { text: 'three' }, style: {}, responsive: {} }] },
      { id: 'good1', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'pFour', type: 'text', content: { text: 'four' }, style: {}, responsive: {} }] },
      { id: 'good2', type: 'banner', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'pFive', type: 'text', content: { text: 'five' }, style: {}, responsive: {} }] }
    ] } } };
    const { ctx, p, errs } = await adminPage(b, planted);
    const before = await draftJSON(p);
    const SECLIST = { kind: 'section' };
    for (const bad of ['__proto__', 'constructor', 'sec"X']) {
      const r = await p.evaluate(id => {
        const D = window.ADMIN_BUILDER.drag;
        return { checked: D.check({ kind: 'section', addr: { kind: 'section' }, id: id },
                                  { kind: 'section', addr: { kind: 'section' }, index: 0 }),
                 moved: D.move({ kind: 'section', addr: { kind: 'section' }, id: id },
                               { kind: 'section', addr: { kind: 'section' }, index: 0 }) };
      }, bad);
      check('a section whose own id is ' + bad + ' cannot be addressed',
        r.checked === false && r.moved === false, r);
    }
    check('and none of them moved', (await draftJSON(p)) === before);

    /* The other half of the claim: a draft carrying an id the sanitiser
       would have to replace must not freeze every other drag. */
    const ok = await p.evaluate(() => window.ADMIN_BUILDER.drag.move(
      { kind: 'section', addr: { kind: 'section' }, id: 'good2' },
      { kind: 'section', addr: { kind: 'section' }, index: 0 }));
    await p.waitForTimeout(400);
    check('a well-formed section in the same draft still moves normally', ok === true);
    check('it went where it was told',
      (await order(p)).join(',') === 'good2,__proto__,constructor,sec"X,good1', await order(p));
    check('and the badly named sections are still there, untouched',
      (await p.evaluate(() => CMS.sections.draft('about').sections
        .filter(s => s.id === '__proto__' || s.id === 'constructor' || s.id === 'sec"X').length)) === 3);
    check('nothing became a prototype property of anything',
      (await p.evaluate(() => {
        const o = {};
        return o.type === undefined && Object.prototype.type === undefined &&
               ({}).elements === undefined;
      })) === true);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     2. A DROP ONTO ITS OWN PLACE IS NOT A CHANGE
     ================================================================ */
  console.log('\n===== A NO-OP DROP IS A NO-OP =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    const before = await draftJSON(p);
    const r = await p.evaluate(() => {
      const D = window.ADMIN_BUILDER.drag, out = {};
      const SRC = { kind: 'section', addr: { kind: 'section' }, id: 'secB' };
      /* The address resolves and the node is found -- these refusals are
         about the POSITION, not about a descriptor that went nowhere. */
      out.resolves = D.check(SRC, { kind: 'section', addr: { kind: 'section' }, index: 0 });
      out.onSelf  = D.move(SRC, { kind: 'section', addr: { kind: 'section' }, index: 1 });
      out.justAfter = D.move(SRC, { kind: 'section', addr: { kind: 'section' }, index: 2 });
      out.draft = JSON.stringify(CMS.sections.draft('about').sections);
      return out;
    });
    check('the same descriptor moved somewhere else WOULD be accepted', r.resolves === true);
    check('dropping a section on its own position does nothing', r.onSelf === false);
    check('dropping it immediately after itself does nothing either', r.justAfter === false);
    check('and the draft is byte-identical', r.draft === before);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     2b. THE DROP IS CHECKED AGAINST THE SANITISER
     ----------------------------------------------------------------
     Everything the address rules can refuse, they refuse before the
     splice. This is the case they cannot see: pbCleanElements() keeps at
     most 200 elements in one list, so moving a 201st element into a full
     list would produce a page whose last element the renderer silently
     drops. The move is applied, the sanitiser is asked whether it now
     discards something it was keeping, and the answer puts it back.
     ================================================================ */
  console.log('\n===== A MOVE THAT WOULD COST A NODE IS PUT BACK =====');
  {
    const full = { builderDrafts: { about: { schemaVersion: 2, status: 'draft', sections: [] } } };
    const many = [];
    for (let i = 0; i < 199; i++) many.push({ id: 'f' + i, type: 'text',
      content: { text: 'row ' + i }, style: {}, responsive: {} });
    many.push({ id: 'holder', type: 'columns', style: { columns: '2' }, responsive: {},
      content: { columns: [
        { elements: [{ id: 'spare', type: 'text', content: { text: 'the 201st' }, style: {}, responsive: {} }] },
        { elements: [] } ] } });
    full.builderDrafts.about.sections.push({ id: 'big', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
      elements: many });
    const { ctx, p, errs } = await adminPage(b, full);

    check('the section holds exactly the sanitiser\u2019s limit, and loses nothing',
      (await p.evaluate(() => CMS.sections.draft('about').sections[0].elements.length)) === 200 &&
      (await p.evaluate(() => CMS.sections.sanitize(CMS.sections.draft('about').sections)[0]
        .elements.length)) === 200);
    check('one more would be dropped, and it would be the columns element',
      (await p.evaluate(() => {
        const d = JSON.parse(JSON.stringify(CMS.sections.draft('about').sections));
        d[0].elements.unshift({ id: 'extra', type: 'text', content: { text: 'x' }, style: {}, responsive: {} });
        const c = CMS.sections.sanitize(d)[0].elements;
        return c.length === 200 && !c.some(e => e.type === 'columns');
      })) === true);

    const before = await draftJSON(p);
    const r = await p.evaluate(() => window.ADMIN_BUILDER.drag.move(
      { kind: 'element', addr: { kind: 'element', sec: 'big', el: 'holder', col: 0 }, id: 'spare' },
      { kind: 'element', addr: { kind: 'element', sec: 'big', el: '', col: -1 }, index: 0 }));
    await p.waitForTimeout(350);
    check('a move that would push a node past the limit is refused', r === false);
    check('and the draft is byte-identical', (await draftJSON(p)) === before);
    check('the element is still where it was',
      (await p.evaluate(() => (CMS.sections.draft('about').sections[0].elements
        .find(e => e.id === 'holder').content.columns[0].elements[0] || {}).id)) === 'spare');

    /* The same move the other way round costs nothing, so it is allowed --
       the guard refuses a LOSS, not a move. */
    const ok = await p.evaluate(() => window.ADMIN_BUILDER.drag.move(
      { kind: 'element', addr: { kind: 'element', sec: 'big', el: 'holder', col: 0 }, id: 'spare' },
      { kind: 'element', addr: { kind: 'element', sec: 'big', el: 'holder', col: 1 }, index: 0 }));
    await p.waitForTimeout(350);
    check('but moving it between columns, which costs nothing, is allowed', ok === true);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     3. WHAT A VALID MOVE PRESERVES
     ================================================================ */
  console.log('\n===== A MOVE CARRIES THE NODE, NOT A COPY OF IT =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    await openSec(p, 'secA');

    const beforeIds = await allIds(p);
    const beforeDeep = await p.evaluate(() => {
      const s = CMS.sections.draft('about').sections[0];
      const find = id => { let hit = null;
        (function walk(els) { (els || []).forEach(e => { if (e.id === id) hit = e;
          const c = (e.content || {}).columns; if (Array.isArray(c)) c.forEach(x => walk(x.elements)); }); })(s.elements);
        return hit; };
      return { head: JSON.stringify(find('elHead')), img: JSON.stringify(find('elImg')),
               deep: JSON.stringify(find('elDeep')), cols: JSON.stringify(find('elCols').style) };
    });

    /* heading (section root) -> into the FIRST column, above the image */
    const moved = await p.evaluate(() => window.ADMIN_BUILDER.drag.move(
      { kind: 'element', addr: { kind: 'element', sec: 'secA', el: '', col: -1 }, id: 'elHead' },
      { kind: 'element', addr: { kind: 'element', sec: 'secA', el: 'elCols', col: 0 }, index: 0 }));
    await p.waitForTimeout(400);
    check('the move is applied', moved === true);

    const after = await p.evaluate(() => {
      const s = CMS.sections.draft('about').sections[0];
      const cols = s.elements.find(e => e.id === 'elCols');
      const find = id => { let hit = null;
        (function walk(els) { (els || []).forEach(e => { if (e.id === id) hit = e;
          const c = (e.content || {}).columns; if (Array.isArray(c)) c.forEach(x => walk(x.elements)); }); })(s.elements);
        return hit; };
      return {
        rootIds: s.elements.map(e => e.id),
        col0: cols.content.columns[0].elements.map(e => e.id),
        col1: cols.content.columns[1].elements.map(e => e.id),
        head: JSON.stringify(find('elHead')),
        img:  JSON.stringify(find('elImg')),
        deep: JSON.stringify(find('elDeep')),
        colsStyle: JSON.stringify(cols.style),
        colsResp:  JSON.stringify(cols.responsive)
      };
    });

    check('it left the list it came from',
      after.rootIds.join(',') === 'elText,elCols,elCols2,elFake', after.rootIds);
    check('it landed where it was dropped', after.col0.join(',') === 'elHead,elImg', after.col0);
    check('the other column is untouched', after.col1.join(',') === 'elDeep', after.col1);
    check('the moved node is deep-identical -- id, content, style, responsive',
      after.head === beforeDeep.head, { before: beforeDeep.head, after: after.head });
    check('its semantic colour reference is still a reference, not a resolved hex',
      /"color":"@primary"/.test(after.head) && !/0088cc/.test(after.head), after.head);
    check('its desktop, tablet and mobile overrides all survived',
      /"tablet":\{"fontSize":"22"\}/.test(after.head) && /"mobile":\{"fontSize":"18"\}/.test(after.head), after.head);
    check('the image beside it kept its asset path and dimensions',
      after.img === beforeDeep.img, after.img);
    check('the element nested in the other column is untouched', after.deep === beforeDeep.deep);
    check('the column layout preset and its tablet override are unchanged',
      after.colsStyle === beforeDeep.cols && /"columns":"1"/.test(after.colsResp),
      { style: after.colsStyle, resp: after.colsResp });

    const afterIds = await allIds(p);
    check('every id that existed still exists, exactly once',
      afterIds.slice().sort().join(',') === beforeIds.slice().sort().join(','),
      { before: beforeIds, after: afterIds });
    check('and the order actually changed', afterIds.join(',') !== beforeIds.join(','));

    /* The sanitiser decides what the renderer accepts, so the last
       question about a move is whether the moved node is still there,
       still in its new place, after the tree has been through it. */
    const clean = await p.evaluate(() => {
      const d = CMS.sections.sanitize(CMS.sections.draft('about').sections);
      const sec = d.find(s => s.id === 'secA');
      const cols = sec.elements.find(e => e.id === 'elCols');
      return { root: sec.elements.map(e => e.id),
               col0: cols.content.columns[0].elements.map(e => e.id),
               col1: cols.content.columns[1].elements.map(e => e.id) };
    });
    check('the sanitiser keeps the moved element where the move put it',
      clean.col0.join(',') === 'elHead,elImg', clean);
    check('and the list it left is the one the move left behind',
      clean.root.join(',') === 'elText,elCols,elCols2,elFake', clean.root);
    check('the untouched column comes through unchanged too',
      clean.col1.join(',') === 'elDeep', clean.col1);

    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     4. THROUGH THE MOUSE
     ================================================================ */
  console.log('\n===== DRAGGING WITH A POINTER =====');
  {
    const { ctx, p, errs, st } = await adminPage(b, SEED());
    check('every row offers a drag handle',
      (await p.$$eval('#pbList > .pb-sec > .pb-sec-head > .pb-handle', n => n.length)) === 3);
    check('the handles say what they are',
      (await p.$eval('#pbList .pb-handle', n => n.getAttribute('aria-label'))) === 'Drag section');
    check('the handle is a real button, not a div pretending to be one',
      (await p.$eval('#pbList .pb-handle', n => n.tagName + '/' + n.type)) === 'BUTTON/button');
    check('there is a live region for anyone not watching the indicator',
      (await p.$eval('#pbDragStatus', n => n.getAttribute('aria-live') + '/' + n.getAttribute('role'))) === 'polite/status');
    const r = await dragTo(p, '#pbList > .pb-sec:nth-child(3) .pb-handle',
                              '#pbList > .pb-sec:nth-child(1)', 'top');
    check('the drop indicator is shown, and shown as valid',
      r.line && r.line.shown === 'block' && r.line.ok === '1' && !/bad/.test(r.line.cls), r.line);
    check('the third section is now the first',
      (await order(p)).join(',') === 'secC,secA,secB', await order(p));
    check('the status line says what happened',
      /Moved the section/.test(await p.$eval('#pbDragStatus', n => n.textContent)));
    check('dragging published nothing', st.posts === 0, st.posts);

    /* an invalid target, live */
    await openSec(p, 'secA');
    check('elements get their own handle, labelled as such',
      (await p.$eval('.pb-elcard[data-el-id="elText"] > .pb-elcard-head > .pb-handle',
        n => n.getAttribute('aria-label'))) === 'Drag element');
    check('so do columns',
      (await p.$eval('.pb-cols[data-cols-el="elCols"] > .pb-col[data-col="0"] > .pb-col-head > .pb-handle',
        n => n.getAttribute('aria-label'))) === 'Drag column');
    check('and every handle names the keyboard alternative',
      (await p.$$eval('.pb-handle', ns => ns.every(n => /move buttons/i.test(n.title)))) === true);

    const before = await draftJSON(p);
    const bad = await dragTo(p, '.pb-elcard[data-el-id="elCols"] > .pb-elcard-head > .pb-handle',
                                '.pb-cols[data-cols-el="elCols"] > .pb-col[data-col="0"] .pb-els', 'middle');
    check('a columns element dragged into a column is shown as an invalid target',
      bad.line && bad.line.shown === 'block' && bad.line.ok === '0' && /bad/.test(bad.line.cls), bad.line);
    check('and releasing there changes nothing', (await draftJSON(p)) === before);
    check('the status line says so',
      /Not a place this can go/.test(await p.$eval('#pbDragStatus', n => n.textContent)));

    /* a legal element drag: the text element into the second column */
    const r2 = await dragTo(p, '.pb-els[data-list-el=""] > .pb-elcard[data-el-id="elText"] > .pb-elcard-head > .pb-handle',
                               '.pb-cols[data-cols-el="elCols"] > .pb-col[data-col="1"] .pb-elcard[data-el-id="elDeep"]', 'top');
    check('an element dragged into a column is a valid target', r2.line && r2.line.ok === '1', r2.line);
    check('and it lands there',
      (await p.evaluate(() => CMS.sections.draft('about').sections
        .find(s => s.id === 'secA').elements.find(e => e.id === 'elCols')
        .content.columns[1].elements.map(e => e.id).join(','))) === 'elText,elDeep');

    /* columns reorder by drag */
    const cols = () => p.evaluate(() => CMS.sections.draft('about').sections
      .find(s => s.id === 'secA').elements.find(e => e.id === 'elCols')
      .content.columns.map(c => c.elements.map(e => e.id).join('+')));
    const colsBefore = await cols();
    const r3 = await dragTo(p, '.pb-cols[data-cols-el="elCols"] > .pb-col[data-col="1"] > .pb-col-head > .pb-handle',
                               '.pb-cols[data-cols-el="elCols"] > .pb-col[data-col="0"]', 'top');
    check('a column dragged above its sibling is a valid target', r3.line && r3.line.ok === '1', r3.line);
    const colsAfter = await cols();
    check('the columns swapped, carrying their contents',
      colsAfter.join('|') === colsBefore.slice().reverse().join('|'),
      { before: colsBefore, after: colsAfter });
    check('and both columns still hold everything they held',
      colsAfter.slice().sort().join('|') === colsBefore.slice().sort().join('|'));

    check('no page errors through all of it', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     5. CANCELLATION IS INDISTINGUISHABLE FROM NOT DRAGGING
     ================================================================ */
  console.log('\n===== EVERY WAY OUT OF A DRAG LEAVES THE DRAFT ALONE =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    const before = await draftJSON(p);

    const begin = async () => {
      const h = await p.$('#pbList > .pb-sec:nth-child(3) .pb-handle');
      const t = await p.$('#pbList > .pb-sec:nth-child(1)');
      await centre(p, '#pbList > .pb-sec:nth-child(3) .pb-handle', '#pbList > .pb-sec:nth-child(1)');
      const hb = await h.boundingBox(), tb = await t.boundingBox();
      await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
      await p.mouse.down();
      await p.mouse.move(hb.x, hb.y - 20, { steps: 3 });
      await p.mouse.move(tb.x + 60, tb.y + 3, { steps: 6 });
      return p.evaluate(() => window.ADMIN_BUILDER.drag.active());
    };

    /* A press with a wobble in it is a press, not a drag. */
    const wobble = await p.evaluate(() => {
      const h = document.querySelector('#pbList > .pb-sec:nth-child(3) .pb-handle');
      const r = h.getBoundingClientRect();
      const x = r.left + 5, y = r.top + 5;
      h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
        pointerId: 9, pointerType: 'mouse', isPrimary: true, button: 0, clientX: x, clientY: y }));
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true,
        pointerId: 9, pointerType: 'mouse', isPrimary: true, clientX: x + 1, clientY: y + 1 }));
      const live = window.ADMIN_BUILDER.drag.active();
      const said = document.getElementById('pbDragStatus').textContent;
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 9, pointerType: 'mouse' }));
      return { live, said };
    });
    await p.waitForTimeout(200);
    check('a two-pixel wobble on the handle is not a drag', wobble.live === false, wobble);
    check('and nothing is announced for it', wobble.said === '', wobble);
    check('nor does the draft change', (await draftJSON(p)) === before);

    check('a drag is running', (await begin()) === true);
    await p.keyboard.press('Escape');
    await p.waitForTimeout(200);
    check('Escape ends it', (await p.evaluate(() => window.ADMIN_BUILDER.drag.active())) === false);
    check('Escape says nothing changed',
      /cancelled/i.test(await p.$eval('#pbDragStatus', n => n.textContent)));
    await p.mouse.up(); await p.waitForTimeout(300);
    check('and releasing afterwards still changes nothing', (await draftJSON(p)) === before);
    check('the indicator is gone', (await lineState(p)).shown === 'none');

    await begin();
    await p.evaluate(() => window.dispatchEvent(new Event('blur')));
    await p.waitForTimeout(150);
    check('losing the window ends it', (await p.evaluate(() => window.ADMIN_BUILDER.drag.active())) === false);
    await p.mouse.up(); await p.waitForTimeout(300);
    check('with the draft unchanged', (await draftJSON(p)) === before);

    await begin();
    await p.evaluate(() => {
      const h = document.querySelector('#pbList > .pb-sec:nth-child(3) .pb-handle');
      h.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }));
    });
    await p.waitForTimeout(150);
    check('a cancelled pointer ends it', (await p.evaluate(() => window.ADMIN_BUILDER.drag.active())) === false);
    await p.mouse.up(); await p.waitForTimeout(300);
    check('with the draft unchanged', (await draftJSON(p)) === before);

    /* switching panels underneath a drag */
    await begin();
    await p.click('.adm-nav-item[data-panel="colors"]');
    await p.waitForTimeout(250);
    check('switching panels ends it', (await p.evaluate(() => window.ADMIN_BUILDER.drag.active())) === false);
    await p.mouse.up(); await p.waitForTimeout(300);
    check('with the draft unchanged', (await draftJSON(p)) === before);
    await p.click('.adm-nav-item[data-panel="builder"]');
    await p.waitForTimeout(600);

    /* switching the preview viewport underneath a drag */
    await begin();
    await p.click('#pbDevices .pb-devtab[data-viewport="mobile"]');
    await p.waitForTimeout(250);
    check('switching the preview viewport ends it',
      (await p.evaluate(() => window.ADMIN_BUILDER.drag.active())) === false);
    await p.mouse.up(); await p.waitForTimeout(300);
    check('with the draft unchanged', (await draftJSON(p)) === before);

    /* released over nothing at all */
    const h = await p.$('#pbList > .pb-sec:nth-child(2) .pb-handle');
    await h.scrollIntoViewIfNeeded();
    await p.waitForTimeout(80);
    const hb = await h.boundingBox();
    await p.mouse.move(hb.x + 5, hb.y + 5);
    await p.mouse.down();
    await p.mouse.move(hb.x + 5, hb.y - 20, { steps: 3 });
    await p.mouse.move(12, 8, { steps: 6 });
    check('dropping outside any list shows no indicator', (await lineState(p)).shown === 'none');
    await p.mouse.up(); await p.waitForTimeout(300);
    check('and changes nothing', (await draftJSON(p)) === before);

    /* the tree changing under a live drag */
    await begin();
    await p.evaluate(() => window.ADMIN_BUILDER.drag.move(
      { kind: 'section', addr: { kind: 'section' }, id: 'secC' },
      { kind: 'section', addr: { kind: 'section' }, index: 0 }));
    await p.waitForTimeout(250);
    const mid = await draftJSON(p);
    await p.mouse.up(); await p.waitForTimeout(350);
    check('a drag whose node was rebuilt under it does not move anything else',
      (await draftJSON(p)) === mid);

    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     5b. AND NOT IN MEMORY EITHER
     ----------------------------------------------------------------
     The checks above read the SAVED draft. A cancel that quietly moved
     something in memory without saving would be invisible to them and
     would surface later, on the next unrelated edit. So: cancel every
     way, then force a save and look again.
     ================================================================ */
  console.log('\n===== A CANCELLED DRAG LEAVES NOTHING BEHIND IN MEMORY =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    const before = await draftJSON(p);
    const begin = async () => {
      await centre(p, '#pbList > .pb-sec:nth-child(3) .pb-handle', '#pbList > .pb-sec:nth-child(1)');
      const h = await p.$('#pbList > .pb-sec:nth-child(3) .pb-handle');
      const t = await p.$('#pbList > .pb-sec:nth-child(1)');
      const hb = await h.boundingBox(), tb = await t.boundingBox();
      await p.mouse.move(hb.x + 8, hb.y + 12);
      await p.mouse.down();
      await p.mouse.move(hb.x + 8, hb.y - 20, { steps: 3 });
      await p.mouse.move(tb.x + 60, tb.y + 3, { steps: 6 });
      return lineState(p);
    };

    const line = await begin();
    check('the drag was aimed at a valid target -- there was something to commit',
      line.shown === 'block' && line.ok === '1', line);
    await p.keyboard.press('Escape');
    await p.mouse.up();
    await p.waitForTimeout(250);
    await p.click('#pbSaveDraft');
    await p.waitForTimeout(500);
    check('saving after an Escape writes the draft unchanged', (await draftJSON(p)) === before);

    await begin();
    await p.evaluate(() => window.ADMIN_BUILDER.drag.cancel());
    await p.mouse.up();
    await p.waitForTimeout(250);
    await p.click('#pbSaveDraft');
    await p.waitForTimeout(500);
    check('and so does saving after a cancelled drag', (await draftJSON(p)) === before);
    check('the builder still knows the same order it started with',
      (await order(p)).join(',') === 'secA,secB,secC', await order(p));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     6. SAVING, DIRTY STATE AND PUBLISH ISOLATION
     ================================================================ */
  console.log('\n===== A MOVE SAVES LIKE EVERY OTHER EDIT, AND PUBLISHES NOTHING =====');
  {
    const seed = SEED();
    seed.pages = { about: { builder: { schemaVersion: 2, status: 'published',
      sections: JSON.parse(JSON.stringify(seed.builderDrafts.about.sections)) } } };
    const { ctx, p, errs, st } = await adminPage(b, seed);
    check('the page starts live and clean', (await p.evaluate(() => CMS.sections.dirty('about'))) === false);
    const posts0 = st.posts;

    await dragTo(p, '#pbList > .pb-sec:nth-child(3) .pb-handle', '#pbList > .pb-sec:nth-child(1)', 'top');
    check('the move reordered the draft', (await order(p)).join(',') === 'secC,secA,secB', await order(p));
    check('the draft on disk has the new order',
      (await p.evaluate(() => JSON.parse(localStorage.getItem('whiteLabelCMS'))
        .builderDrafts.about.sections.map(s => s.id).join(','))) === 'secC,secA,secB');
    check('the page is now dirty against what is published',
      (await p.evaluate(() => CMS.sections.dirty('about'))) === true);
    check('what is PUBLISHED did not move',
      (await p.evaluate(() => CMS.data().pages.about.builder.sections.map(s => s.id).join(','))) === 'secA,secB,secC');
    check('the save state says the draft was saved',
      /saved/.test(await p.$eval('#pbSaveState', n => n.className)),
      await p.$eval('#pbSaveState', n => n.className));
    check('dragging sent nothing to the network', st.posts === posts0, st.posts);

    /* a refused write is still a refused write */
    await p.evaluate(() => {
      window.__realSet = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (k) {
        if (k === 'whiteLabelCMS') throw new Error('QuotaExceededError');
        return window.__realSet.apply(null, arguments);
      };
    });
    await dragTo(p, '#pbList > .pb-sec:nth-child(3) .pb-handle', '#pbList > .pb-sec:nth-child(1)', 'top');
    check('a move that could not be written is reported as a failure, not a success',
      /failed/.test(await p.$eval('#pbSaveState', n => n.className)) &&
      /Not saved/.test(await p.$eval('#pbSaveState', n => n.textContent)),
      await p.$eval('#pbSaveState', n => n.className + '|' + n.textContent));
    check('and the move is still there in memory, not rolled back',
      (await order(p)).join(',') === 'secB,secC,secA', await order(p));
    await p.evaluate(() => { localStorage.setItem = window.__realSet; });
    await p.click('#pbSaveDraft'); await p.waitForTimeout(500);
    check('saving again recovers', /saved/.test(await p.$eval('#pbSaveState', n => n.className)));
    check('still nothing published', st.posts === posts0, st.posts);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     7. THE KEYBOARD PATH
     ================================================================ */
  console.log('\n===== REORDERING WITHOUT A POINTER =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    const ids0 = await allIds(p);

    /* sections */
    await p.click('#pbList > .pb-sec:nth-child(3) [data-act="up"]');
    await p.waitForTimeout(400);
    check('a section moves up from the keyboard path',
      (await order(p)).join(',') === 'secA,secC,secB', await order(p));
    const where = sel => p.evaluate(s2 => {
      const a = document.activeElement;
      const host = a && a.closest ? a.closest(s2) : null;
      if (!host) return 'nowhere';
      return a.getAttribute('data-act') + '@' +
             (host.getAttribute('data-sec-id') || host.getAttribute('data-el-id') ||
              host.getAttribute('data-col'));
    }, sel);
    check('focus followed the section that moved',
      (await where('.pb-sec')) === 'up@secC', await where('.pb-sec'));
    await p.keyboard.press('Enter');
    await p.waitForTimeout(400);
    check('pressing it again moves it again',
      (await order(p)).join(',') === 'secC,secA,secB', await order(p));
    check('and when Move up becomes impossible, focus lands on Move down',
      (await where('.pb-sec')) === 'down@secC', await where('.pb-sec'));
    check('no ids were gained, lost or repeated',
      (await allIds(p)).slice().sort().join(',') === ids0.slice().sort().join(','));

    /* elements */
    await openSec(p, 'secA');
    await p.click('.pb-els[data-list-el=""] > .pb-elcard[data-el-id="elText"] [data-act="el-up"]');
    await p.waitForTimeout(400);
    check('an element moves up',
      (await p.evaluate(() => CMS.sections.draft('about').sections
        .find(s => s.id === 'secA').elements.map(e => e.id).join(','))) ===
      'elText,elHead,elCols,elCols2,elFake');
    const focusAt = where;
    /* It moved to the top, so Move up is now disabled and focus lands on
       Move down -- on the element that moved, not on whatever took its
       old row. */
    check('focus followed the element to its new row',
      (await focusAt('.pb-elcard')) === 'el-down@elText', await focusAt('.pb-elcard'));

    /* columns */
    check('columns offer move buttons too',
      (await p.$$eval('.pb-cols[data-cols-el="elCols"] > .pb-col [data-act="col-up"]', n => n.length)) === 2);
    await p.click('.pb-cols[data-cols-el="elCols"] > .pb-col[data-col="1"] [data-act="col-up"]');
    await p.waitForTimeout(400);
    check('a column moves, carrying its contents',
      (await p.evaluate(() => CMS.sections.draft('about').sections
        .find(s => s.id === 'secA').elements.find(e => e.id === 'elCols')
        .content.columns.map(c => c.elements.map(e => e.id).join('+')).join('|'))) === 'elDeep|elImg');
    check('focus followed the column to its new position',
      (await focusAt('.pb-col')) === 'col-down@0', await focusAt('.pb-col'));
    check('and no ids were gained, lost or repeated',
      (await allIds(p)).slice().sort().join(',') === ids0.slice().sort().join(','));
    check('the column layout preset is untouched by a column move',
      (await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections
        .find(s => s.id === 'secA').elements.find(e => e.id === 'elCols').style))) ===
      JSON.stringify({ columns: '2', 'columns-t': '1' }));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     8. TOUCH
     ================================================================ */
  console.log('\n===== ON A TOUCHSCREEN =====');
  {
    const ctx = await b.newContext({ viewport: { width: 900, height: 1200 }, hasTouch: true });
    const stt = { posts: 0, row: null }; await stub(ctx, stt);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e));
    p.on('dialog', d => d.accept());
    await p.addInitScript(arg => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      Object.assign(raw, arg);
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, SEED());
    await p.emulateMedia({ media: 'screen' });
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(700);

    check('the move buttons are there and usable',
      (await p.$$eval('#pbList > .pb-sec [data-act="up"]', n => n.length)) === 3);
    await p.click('#pbList > .pb-sec:nth-child(3) [data-act="up"]');
    await p.waitForTimeout(400);
    check('and they reorder the draft on a touch device',
      (await order(p)).join(',') === 'secA,secC,secB', await order(p));

    /* The stylesheet hides the handle on a coarse pointer; the JS refuses
       a touch pointer as well, so neither one alone is load-bearing. */
    const rule = await p.evaluate(() => {
      for (const sheet of document.styleSheets) {
        let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
        for (const r of rules || []) {
          if (r.media && /pointer:\s*coarse/.test(r.conditionText || r.media.mediaText))
            return Array.from(r.cssRules).map(x => x.cssText).join(' ');
        }
      }
      return '';
    });
    check('a coarse pointer is not offered a drag handle at all',
      /\.pb-handle/.test(rule) && /display:\s*none/.test(rule), rule);

    const touched = await p.evaluate(() => {
      const before = JSON.stringify(CMS.sections.draft('about').sections);
      const h = document.querySelector('#pbList .pb-handle');
      h.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true,
        pointerId: 3, pointerType: 'touch', isPrimary: true, button: 0,
        clientX: 20, clientY: 100 }));
      /* A drag only goes live once the pointer has MOVED, so asking
         before the move would read false whether the guard is there or
         not. The question is asked after it. */
      document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true,
        pointerId: 3, pointerType: 'touch', clientX: 20, clientY: 400 }));
      const active = window.ADMIN_BUILDER.drag.active();
      document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 3, pointerType: 'touch' }));
      return { active, same: before === JSON.stringify(CMS.sections.draft('about').sections) };
    });
    check('a touch pointer on the handle never starts a drag', touched.active === false);
    check('and nothing moved', touched.same === true);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     9. REUSABLE SECTIONS AND TEMPLATES STAY INDEPENDENT
     ================================================================ */
  console.log('\n===== DRAGGING A COPY DOES NOT REACH WHAT IT WAS COPIED FROM =====');
  {
    const { ctx, p, errs } = await adminPage(b, SEED());
    /* Save section A to the library, insert it back, then reorder inside
       the inserted copy. */
    await p.evaluate(() => {
      const s = CMS.sections.draft('about').sections[0];
      CMS.sections.library.save('Alpha block', s);
    });
    const libBefore = await p.evaluate(() => JSON.stringify(CMS.sections.library.list()));
    const tplBefore = await p.evaluate(() => JSON.stringify(CMS.sections.templates()));

    await p.evaluate(() => window.ADMIN_BUILDER.build());
    await p.waitForTimeout(300);
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-insert"]');
    await p.waitForTimeout(600);
    const newId = (await order(p))[3];
    check('the inserted copy has its own section id', newId !== 'secA', newId);

    const movedInCopy = await p.evaluate(id => window.ADMIN_BUILDER.drag.move(
      { kind: 'element', addr: { kind: 'element', sec: id, el: '', col: -1 },
        id: CMS.sections.draft('about').sections.find(s => s.id === id).elements[1].id },
      { kind: 'element', addr: { kind: 'element', sec: id, el: '', col: -1 }, index: 0 }), newId);
    await p.waitForTimeout(400);
    check('an element inside the inserted copy can be reordered', movedInCopy === true);
    check('the library entry is byte-identical afterwards',
      (await p.evaluate(() => JSON.stringify(CMS.sections.library.list()))) === libBefore);
    check('the original section on the page did not move either',
      (await p.evaluate(() => CMS.sections.draft('about').sections
        .find(s => s.id === 'secA').elements.map(e => e.id).join(','))) ===
      'elHead,elText,elCols,elCols2,elFake');
    check('the page is a plain array of sections, with no link back to the library',
      (await p.evaluate(() => CMS.sections.draft('about').sections
        .every(s => !('libraryId' in s) && !('source' in s) && !('linked' in s)))) === true);

    /* a template, then a drag */
    await p.click('#pbTemplates .pb-template[data-template="landing"]');
    await p.waitForTimeout(700);
    const tplIds = await order(p);
    check('the template produced sections', tplIds.length >= 2, tplIds);
    await p.evaluate(() => {
      const d = CMS.sections.draft('about').sections;
      window.ADMIN_BUILDER.drag.move(
        { kind: 'section', addr: { kind: 'section' }, id: d[d.length - 1].id },
        { kind: 'section', addr: { kind: 'section' }, index: 0 });
    });
    await p.waitForTimeout(400);
    check('a section from a template can be dragged',
      (await order(p)).join(',') !== tplIds.join(','));
    check('the template registry is byte-identical afterwards',
      (await p.evaluate(() => JSON.stringify(CMS.sections.templates()))) === tplBefore);
    check('and running the template again still produces the shipped order',
      (await p.evaluate(() => CMS.sections.fromTemplate('landing').map(s => s.type).join(','))) ===
      (await p.evaluate(() => CMS.sections.fromTemplate('landing').map(s => s.type).join(','))));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     10. AT SIZE
     ================================================================ */
  console.log('\n===== 30 SECTIONS, 90 COLUMNS, 240 ELEMENTS =====');
  {
    const big = { builderDrafts: { about: { schemaVersion: 2, status: 'draft', sections: [] } } };
    const secs = big.builderDrafts.about.sections;
    for (let i = 0; i < 30; i++) {
      const cols = [];
      for (let c = 0; c < 3; c++) cols.push({ elements: [
        { id: `e${i}c${c}a`, type: 'text', content: { text: `s${i} c${c} a` }, style: {}, responsive: {} },
        { id: `e${i}c${c}b`, type: 'text', content: { text: `s${i} c${c} b` }, style: {}, responsive: {} }
      ] });
      secs.push({ id: `s${i}`, type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [
          { id: `e${i}h`, type: 'heading', content: { text: 'H' + i, level: 'h2' }, style: {}, responsive: {} },
          { id: `e${i}k`, type: 'columns', style: { columns: '3' }, responsive: {},
            content: { columns: cols } }
        ] });
    }
    const { ctx, p, errs } = await adminPage(b, big);
    const counts = await p.evaluate(() => {
      const d = CMS.sections.draft('about').sections;
      let els = 0, cols = 0;
      d.forEach(s => (function walk(list) { (list || []).forEach(e => { els++;
        const c = (e.content || {}).columns;
        if (Array.isArray(c)) { cols += c.length; c.forEach(x => walk(x.elements)); } }); })(s.elements));
      return { secs: d.length, els, cols };
    });
    check('the draft really is that big',
      counts.secs === 30 && counts.cols === 90 && counts.els >= 240, counts);
    check('all 30 rows are painted',
      (await p.$$eval('#pbList > .pb-sec', n => n.length)) === 30);

    /* Watch #pbList while the pointer moves. A drag that rebuilt the list
       would show up here as childList mutations. */
    const h = await p.$('#pbList > .pb-sec:nth-child(6) .pb-handle');
    const first = await p.$('#pbList > .pb-sec:nth-child(1)');
    await first.scrollIntoViewIfNeeded();
    await h.scrollIntoViewIfNeeded();
    await p.waitForTimeout(100);
    const hb = await h.boundingBox();
    await p.evaluate(() => {
      window.__mut = { child: 0, other: 0 };
      window.__obs = new MutationObserver(recs => recs.forEach(r => {
        if (r.type === 'childList') window.__mut.child += r.addedNodes.length + r.removedNodes.length;
        else window.__mut.other++;
      }));
      window.__obs.observe(document.getElementById('pbList'),
        { childList: true, subtree: true, attributes: true, characterData: true });
    });
    await p.mouse.move(hb.x + 5, hb.y + 5);
    await p.mouse.down();
    await p.mouse.move(hb.x + 5, hb.y - 20, { steps: 3 });
    const t0 = Date.now();
    const target = await (await p.$('#pbList > .pb-sec:nth-child(1)')).boundingBox();
    for (let i = 0; i < 40; i++) {
      await p.mouse.move(target.x + 60, hb.y - 20 - (hb.y - 20 - (target.y + 3)) * (i / 39));
    }
    const ms = Date.now() - t0;
    /* The loop above measures Playwright as much as the page. This
       measures only the handler: 300 pointer moves dispatched in one
       turn, with the drag live. */
    const inPage = await p.evaluate(() => {
      const box = document.getElementById('pbList').getBoundingClientRect();
      const x = box.left + box.width / 2;
      const lo = Math.max(60, box.top + 10);
      const hi = Math.min(window.innerHeight - 60, box.bottom - 10);
      const t = performance.now();
      for (let i = 0; i < 300; i++) {
        document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true,
          pointerId: 1, pointerType: 'mouse', isPrimary: true,
          clientX: x, clientY: lo + ((hi - lo) * (i % 50)) / 49 }));
      }
      return performance.now() - t;
    });
    const mut = await p.evaluate(() => { window.__obs.disconnect(); return window.__mut; });
    check('40 pointer moves over a 30-section list took a sensible time (' + ms + 'ms for 40)',
      ms < 4000, ms);
    check('300 pointer moves handled in ' + inPage.toFixed(0) + 'ms (' +
          (inPage / 300).toFixed(2) + 'ms each)', inPage < 1500, inPage);
    check('not one node was added to or removed from the list during the drag',
      mut.child === 0, mut);
    check('the only DOM change was the dragged row marking itself',
      mut.other <= 2, mut);
    /* Back onto the row it was aimed at, with a real pointer, before the
       release -- the synthetic sweep above left the aim somewhere else. */
    await p.mouse.move(target.x + 60, target.y + 3, { steps: 4 });
    await p.mouse.up();
    await p.waitForTimeout(700);
    check('and the drop did reorder the draft',
      (await order(p))[0] === 's5', (await order(p)).slice(0, 3));
    check('with every id still present exactly once',
      (await allIds(p)).length === counts.secs + counts.els, (await allIds(p)).length);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
