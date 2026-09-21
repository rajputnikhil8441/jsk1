/* Page Builder V2 -- stage 4: the column / container system.

   Two things are being proved here, and they pull in opposite directions:

     1. A columns element that carries no V2 layout data must render exactly
        as it did in V1. That is asserted twice over: no --pbe-cols is
        emitted for it at all, and the track list the browser computes is
        the auto-fit one (which, unlike an explicit grid, reflows when the
        container is narrow).

     2. When layout data IS present, the grid must be the one the preset
        names, at the breakpoint it was set on.

   Track widths are read from computed style, never from the generated CSS
   text: a custom property that never reaches grid-template-columns looks
   perfectly correct in the stylesheet and does nothing on the page. */
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

async function pageWith(b, block, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript((bl) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    raw.pages = raw.pages || {};
    raw.pages.about = Object.assign({}, raw.pages.about, { builder: bl });
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, block);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}
const publishedPage = (b, sections, width) =>
  pageWith(b, { schemaVersion: 2, status: 'published', sections }, width);

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });

/* A columns element with `n` empty-ish containers. */
const colsEl = (id, n, style, responsive) => el(id, 'columns', {
  columns: Array.from({ length: n }, (_, i) =>
    ({ elements: [el(id + '_t' + i, 'text', { text: 'col ' + (i + 1) })] }))
}, style, responsive);

/* The used track widths, in px, as the browser resolved them. */
const tracks = (p, id) => p.$eval(`[data-el="${id}"]`, n =>
  getComputedStyle(n).gridTemplateColumns.trim().split(/\s+/).map(parseFloat));

/* Proportions rounded to whole percent, for comparing a preset to its name. */
const shares = (t) => { const s = t.reduce((a, b) => a + b, 0); return t.map(v => Math.round(v / s * 100)); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     V1 DATA MUST NOT MOVE
     ================================================================ */
  console.log('\n===== A COLUMNS ELEMENT WITH NO LAYOUT DATA IS UNTOUCHED =====');
  {
    /* 520px of room and three columns: auto-fit with minmax(220px, 1fr)
       can only fit two tracks, while any explicit three-track grid would
       fit three. That is what tells the two apart. */
    const S = [sec('s1', 'text', { elements: [colsEl('v1cols', 3, { maxWidth: 520 })] })];
    const { ctx, p, errs } = await publishedPage(b, S, 1280);

    const t = await tracks(p, 'v1cols');
    check('V1 columns still reflow rather than forcing a track per column',
      t.length === 2, t);
    check('and the tracks are still equal', Math.abs(t[0] - t[1]) < 1, t);

    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('no --pbe-cols is emitted for V1 data at all',
      css.indexOf('--pbe-cols') === -1, css.slice(0, 300));
    check('and the renderer never writes grid-template-columns itself',
      css.indexOf('grid-template-columns') === -1);

    /* The stored block is not rewritten by being read. */
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.sections[0].elements[0].style);
    check('reading a V1 columns element does not add layout data to it',
      !Object.prototype.hasOwnProperty.call(stored, 'columns'), stored);

    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  {
    const S = [sec('s1', 'text', { elements: [colsEl('v1m', 3)] })];
    const { ctx, p } = await publishedPage(b, S, 700);
    const t = await tracks(p, 'v1m');
    check('V1 columns still stack to one track on a phone', t.length === 1, t);
    await ctx.close();
  }

  {
    /* The new tablet rule must resolve to the V1 value when nothing is set. */
    const S = [sec('s1', 'text', { elements: [colsEl('v1t', 3, { maxWidth: 520 })] })];
    const { ctx, p } = await publishedPage(b, S, 1000);
    const t = await tracks(p, 'v1t');
    check('the new tablet rule leaves V1 columns auto-fitting', t.length === 2, t);
    await ctx.close();
  }

  /* ================================================================
     PRESETS
     ================================================================ */
  console.log('\n===== EVERY PRESET DRAWS THE GRID ITS NAME PROMISES =====');
  {
    /* One page carrying one columns element per preset, so every entry in
       the registry is exercised and none can be added without a result. */
    const { ctx, p } = await pageWith(b, { schemaVersion: 2, status: 'published', sections: [] }, 1280);
    const names = await p.evaluate(() => Object.keys(CMS.sections.colLayouts));
    check('the preset registry is not empty', names.length > 0, names);
    await ctx.close();

    const elements = names.map((n, i) => colsEl('p' + i, 4, { columns: n, maxWidth: 800 }));
    const S = [sec('s1', 'text', { elements })];
    const { ctx: c2, p: p2, errs } = await publishedPage(b, S, 1280);

    /* The proportions each preset name claims, read off the name itself. */
    for (let i = 0; i < names.length; i++) {
      const n = names[i];
      const t = await tracks(p2, 'p' + i);
      const want = n.indexOf('-') === -1
        ? Array.from({ length: Number(n) }, () => Math.round(100 / Number(n)))
        : n.split('-').slice(1).map(Number);
      const got = shares(t);
      const ok = got.length === want.length &&
        got.every((v, j) => Math.abs(v - want[j]) <= 1);
      check(`preset ${n} draws ${want.join('/')}`, ok, { got, want });
    }
    check('no page errors across every preset', errs.length === 0, errs);
    await c2.close();
  }

  console.log('\n===== A LAYOUT NAME THAT IS NOT A PRESET CHANGES NOTHING =====');
  {
    const bad = ['1fr 1fr', 'repeat(9,1fr)', 'constructor', 'toString', '__proto__',
                 'hasOwnProperty', 'EQUAL-2', '1fr 1fr;background:red',
                 'red;}body{display:none', 5, true, null, {}, []];
    const elements = bad.map((v, i) => colsEl('b' + i, 3, { columns: v, maxWidth: 520 }));
    const S = [sec('s1', 'text', { elements })];
    const { ctx, p, errs } = await publishedPage(b, S, 1280);

    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('none of the rejected values emits a --pbe-cols',
      css.indexOf('--pbe-cols') === -1, css.slice(0, 400));
    check('and none of them reaches the stylesheet as text',
      css.indexOf('background') === -1 && css.indexOf('repeat(9') === -1 &&
      css.indexOf('display:none') === -1, css.slice(0, 400));

    let allFellBack = true;
    for (let i = 0; i < bad.length; i++) {
      const t = await tracks(p, 'b' + i);
      if (t.length !== 2) { allFellBack = false; check('value ' + JSON.stringify(bad[i]) + ' falls back to auto-fit', false, t); }
    }
    check('every rejected value falls back to the V1 auto-fit grid', allFellBack);
    check('and nothing threw', errs.length === 0, errs);
    await ctx.close();
  }

  {
    /* Surrounding whitespace is trimmed, as it is everywhere else the CMS
       reads a stored string. The value emitted is still the constant the
       preset stands for, never the author's text. */
    const S = [sec('s1', 'text', { elements: [colsEl('w1', 2, { columns: '  2-30-70 ', maxWidth: 800 })] })];
    const { ctx, p } = await publishedPage(b, S, 1280);
    const t = await tracks(p, 'w1');
    check('a padded preset name is trimmed rather than rejected',
      t.length === 2 && Math.abs(shares(t)[0] - 30) <= 1, shares(t));
    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('and what reaches the stylesheet is the constant, not the padded text',
      css.indexOf('--pbe-cols:30fr 70fr;') > -1 && css.indexOf('  2-30-70 ') === -1);
    await ctx.close();
  }

  /* ================================================================
     RESPONSIVE
     ================================================================ */
  console.log('\n===== RESPONSIVE COLUMN COUNTS =====');
  {
    /* Desktop only. Tablet should inherit it; mobile should stack, because
       three tracks on a phone is never what "3 columns" meant. */
    const S = () => [sec('s1', 'text', { elements: [colsEl('r1', 3, { columns: '3', maxWidth: 800 })] })];

    let r = await publishedPage(b, S(), 1280);
    check('desktop uses the chosen layout', (await tracks(r.p, 'r1')).length === 3);
    await r.ctx.close();

    r = await publishedPage(b, S(), 1000);
    check('tablet inherits the desktop layout when it sets none',
      (await tracks(r.p, 'r1')).length === 3);
    await r.ctx.close();

    r = await publishedPage(b, S(), 700);
    check('mobile stacks when it sets none, even though desktop set one',
      (await tracks(r.p, 'r1')).length === 1);
    await r.ctx.close();
  }

  {
    /* Desktop 4, tablet 2, mobile 2: each tier honoured on its own. */
    const S = () => [sec('s1', 'text', { elements: [
      colsEl('r2', 4, { columns: '4', maxWidth: 800 },
        { tablet: { columns: '2' }, mobile: { columns: '2-30-70' } })
    ] })];

    let r = await publishedPage(b, S(), 1280);
    check('desktop keeps its own four tracks', (await tracks(r.p, 'r2')).length === 4);
    await r.ctx.close();

    r = await publishedPage(b, S(), 1000);
    const tt = await tracks(r.p, 'r2');
    check('tablet uses the tablet layout, not the desktop one', tt.length === 2, tt);
    check('and the tablet tracks are equal', Math.abs(tt[0] - tt[1]) < 1, tt);
    await r.ctx.close();

    r = await publishedPage(b, S(), 700);
    const tm = await tracks(r.p, 'r2');
    check('mobile uses its own layout instead of stacking', tm.length === 2, tm);
    check('and honours the ratio it was given',
      Math.abs(shares(tm)[0] - 30) <= 1, shares(tm));
    await r.ctx.close();
  }

  {
    /* Tablet-only override: desktop must stay auto-fit, mobile must stack.
       Tablet must not leak either way. */
    const S = () => [sec('s1', 'text', { elements: [
      colsEl('r3', 3, { maxWidth: 520 }, { tablet: { columns: '3' } })
    ] })];

    let r = await publishedPage(b, S(), 1280);
    check('a tablet-only layout leaves desktop on auto-fit',
      (await tracks(r.p, 'r3')).length === 2);
    await r.ctx.close();

    r = await publishedPage(b, S(), 1000);
    check('the tablet-only layout applies at tablet',
      (await tracks(r.p, 'r3')).length === 3);
    await r.ctx.close();

    r = await publishedPage(b, S(), 700);
    check('and mobile still stacks rather than inheriting tablet',
      (await tracks(r.p, 'r3')).length === 1);
    await r.ctx.close();
  }

  {
    /* Mobile-only override, with nothing above it. */
    const S = () => [sec('s1', 'text', { elements: [
      colsEl('r4', 2, { maxWidth: 520 }, { mobile: { columns: '2-25-75' } })
    ] })];

    let r = await publishedPage(b, S(), 1280);
    check('a mobile-only layout leaves desktop on auto-fit',
      (await tracks(r.p, 'r4')).length === 2);
    await r.ctx.close();

    r = await publishedPage(b, S(), 700);
    const t = await tracks(r.p, 'r4');
    check('the mobile-only layout applies on a phone', t.length === 2, t);
    check('with the ratio it names', Math.abs(shares(t)[0] - 25) <= 1, shares(t));
    await r.ctx.close();
  }

  /* ================================================================
     ISOLATION
     ================================================================ */
  console.log('\n===== A LAYOUT DOES NOT LEAK INTO NESTED CONTENT =====');
  {
    const inner = colsEl('inner', 3, { maxWidth: 520 });
    const outer = el('outer', 'columns', {
      columns: [{ elements: [inner] }, { elements: [el('x', 'text', { text: 'b' })] }]
    }, { columns: '2', maxWidth: 1000 });
    const S = [sec('s1', 'text', { elements: [outer] })];
    const { ctx, p, errs } = await publishedPage(b, S, 1280);

    check('the outer element uses its layout', (await tracks(p, 'outer')).length === 2);
    const ti = await tracks(p, 'inner');
    check('a nested columns element does not inherit the outer layout',
      ti.length === 2 && Math.abs(ti[0] - ti[1]) < 1, ti);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     ADMIN
     ================================================================ */
  console.log('\n===== THE ADMIN CONTROL ACTUALLY CHANGES THE PAGE =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(400);
    const sid = await p.$eval('#pbList .pb-sec', e => e.getAttribute('data-sec-id'));
    const TOP = `#pbList .pb-sec[data-sec-id="${sid}"] > .pb-sec-body > .pb-subbody`;

    await p.click(`${TOP} > .pb-add-el > .pb-addbtn[data-el-type="columns"]`);
    await p.waitForTimeout(400);
    const eid = await p.$$eval(`${TOP} > .pb-els > .pb-elcard`, e => e[e.length - 1].getAttribute('data-el-id'));
    const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${eid}"]`;

    await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`);
    await p.waitForTimeout(250);

    const shown = await p.$$eval(`${CARD} > .pb-elcard-body > .pb-details .pb-field`, e => e.length);
    const want = await p.evaluate(() => CMS.sections.elementStyleKeys.columns.length);
    check('columns offers exactly its ' + want + ' working design controls', shown === want, { shown, want });

    const SEL = `${CARD} > .pb-elcard-body > .pb-details select.pb-in-select`;
    const values = await p.$$eval(SEL, s => Array.from(s[0].options).map(o => o.value));
    const keys = await p.evaluate(() => Object.keys(CMS.sections.colLayouts));
    check('the layout select offers every preset and nothing else',
      values.length === keys.length + 1 && values[0] === '' &&
      keys.every(k => values.indexOf(k) > -1), { values, keys });
    check('and the default option is worded for desktop',
      /Automatic/.test(await p.$eval(SEL, s => s.options[0].textContent)));

    const before = await p.$$eval(`${CARD} .pb-col`, n => n.length);
    await p.selectOption(SEL, '3');
    await p.waitForTimeout(500);
    const after = await p.$$eval(`#pbList .pb-elcard[data-el-id="${eid}"] .pb-col`, n => n.length);
    check('choosing a three-column layout creates the missing containers',
      before === 2 && after === 3, { before, after });

    const saved = await p.evaluate(id => {
      const d = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts;
      const find = (list) => {
        for (const e of list || []) {
          if (e.id === id) return e;
          for (const c of (e.content || {}).columns || []) { const r = find(c.elements); if (r) return r; }
        }
        return null;
      };
      for (const k in d) { for (const s of d[k].sections || []) { const r = find(s.elements); if (r) return r; } }
      return null;
    }, eid);
    check('the choice is stored as a preset name, not as CSS',
      saved && saved.style.columns === '3', saved && saved.style);

    /* The preview iframe is what an author actually judges the result by. */
    const fr = p.frames().find(f => f.url().includes('about.html') || f.name() === 'pbPreview');
    if (fr) {
      await p.waitForTimeout(400);
      const t = await fr.$eval(`[data-el="${eid}"]`, n =>
        getComputedStyle(n).gridTemplateColumns.trim().split(/\s+/).length).catch(() => -1);
      check('the live preview shows three tracks', t === 3, t);
    } else {
      check('the live preview frame was found', false, p.frames().map(f => f.url()));
    }

    /* Picking a layout with fewer tracks than there are columns adds no
       container and so rebuilds nothing -- the case the warning exists for,
       and the one it is easiest to get wrong. */
    const WARN = `${CARD} > .pb-elcard-body > .pb-details [data-warn="cols"]`;
    check('no mismatch warning while the layout and the columns agree',
      await p.$eval(WARN, n => n.hidden));
    await p.selectOption(SEL, '2');
    await p.waitForTimeout(400);
    const warnText = await p.$eval(WARN, n => n.hidden ? null : n.textContent);
    check('choosing fewer tracks than there are columns says so',
      warnText !== null && /draws 2 columns and the element has 3/.test(warnText), warnText);
    check('and no column was silently deleted',
      (await p.$$eval(`${CARD} .pb-col`, n => n.length)) === 3);

    await p.selectOption(SEL, '4');
    await p.waitForTimeout(500);
    check('choosing more tracks adds the containers and clears the warning',
      (await p.$$eval(`#pbList .pb-elcard[data-el-id="${eid}"] .pb-col`, n => n.length)) === 4 &&
      (await p.$eval(WARN, n => n.hidden)));

    /* Scoped through the element's own Design panel: a columns card also
       contains the cards of everything inside it, each with device tabs and
       selects of its own. */
    const DES = `${CARD} > .pb-elcard-body > .pb-details`;
    await p.click(`${DES} .pb-devtabs > .pb-devtab[data-device="mobile"]`);
    await p.waitForTimeout(300);
    const mobFirst = await p.$eval(`${DES} select.pb-in-select`, s => s.options[0].textContent);
    check('the mobile default option says it stacks', /Stacked/.test(mobFirst), mobFirst);

    check('no admin page errors', errs.length === 0, errs);
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
