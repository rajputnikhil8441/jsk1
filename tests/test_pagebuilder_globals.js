/* Page Builder V2 -- stage 6: the global design system.

   A section or element stores a role name -- "@primary", "@h2" -- and the
   stylesheet emits var(--pbg-primary, ...) rather than a resolved colour,
   so one :root block moves everything that points at it. This suite holds
   that the reference resolves, that the global value reaches every
   element sharing it, that a local value beats it, that nothing outside
   the Page Builder moves, and that a name which is not on the list never
   becomes CSS. */
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

/* `extra` is merged over the stored CMS object, so a test can set colors,
   typography or design alongside the page. */
async function page(b, sections, extra, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript((arg) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg.extra || {});
    raw.pages = raw.pages || {};
    raw.pages.about = Object.assign({}, raw.pages.about,
      { builder: { schemaVersion: 2, status: 'published', sections: arg.sections } });
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, { sections, extra: extra || {} });
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });
const H = (id, style) => el(id, 'heading', { text: 'Words', level: 'h2' }, style);
const cs = (p, sel, prop) => p.$eval(sel, (n, k) => getComputedStyle(n)[k], prop);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     COLOUR ROLES
     ================================================================ */
  console.log('\n===== A COLOUR ROLE RESOLVES, AND FOLLOWS THE SITE COLOUR IT ALIASES =====');
  {
    const S = [sec('s1', 'text', { elements: [
      H('primary', { color: '@primary' }), H('text', { color: '@text' }),
      H('muted', { color: '@muted' }), H('danger', { color: '@danger' }),
      H('surfacebg', { bg: '@surface' }), H('plain', {})
    ] })];
    const { ctx, p, errs } = await page(b, S);

    const r = await p.evaluate(() => {
      const g = id => getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
      return { primary: g('primary').color, text: g('text').color, muted: g('muted').color,
               danger: g('danger').color, surface: g('surfacebg').backgroundColor,
               plain: g('plain').color,
               hdr: getComputedStyle(document.documentElement).getPropertyValue('--hdr-bg').trim() };
    });
    check('@primary resolves to the site header colour (#0088cc)',
      r.primary === 'rgb(0, 136, 204)' && r.hdr === '#0088cc', r);
    check('@text resolves to the site body text colour', r.text === 'rgb(34, 34, 34)', r.text);
    check('@muted resolves to the site dimmed text colour', r.muted === 'rgb(119, 119, 119)', r.muted);
    check('@danger resolves to its shipped value, having no site equivalent',
      r.danger === 'rgb(198, 40, 40)', r.danger);
    check('@surface resolves as a background', r.surface === 'rgb(255, 255, 255)', r.surface);
    check('an element with no reference is untouched', r.plain !== r.primary, r.plain);

    /* The reference, not the resolved colour, is what reaches the CSS. */
    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('the element rule holds var(--pbg-primary), not a copied hex',
      /--pbe-color:var\(--pbg-primary,/.test(css) && css.indexOf('--pbe-color:#0088cc') === -1,
      css.slice(0, 260));
    check('and the fallback inside it is the shipped constant',
      /var\(--pbg-primary,#0088cc\)/.test(css));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== CHANGING THE SITE COLOUR MOVES EVERY ELEMENT SHARING THE ROLE =====');
  {
    const S = [sec('s1', 'text', { elements: [
      H('a', { color: '@primary' }), H('b', { color: '@primary' }),
      el('c', 'button', { text: 'Go', href: '#' }, { bg: '@primary' }),
      H('custom', { color: '#ff00ff' })
    ] })];
    const { ctx, p, errs } = await page(b, S, { colors: { 'hdr-bg': '#123456' } });
    const r = await p.evaluate(() => {
      const g = id => getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
      return { a: g('a').color, b: g('b').color, c: g('c').backgroundColor, custom: g('custom').color };
    });
    check('every element pointing at the role follows the new colour',
      r.a === 'rgb(18, 52, 86)' && r.b === r.a && r.c === r.a, r);
    check('an element with a custom colour is untouched by it',
      r.custom === 'rgb(255, 0, 255)', r.custom);

    /* One :root block does the work; the per-element CSS is not duplicated. */
    const n = await p.evaluate(() =>
      (CMS.sections.css(CMS.sections.published('about')).match(/#123456/g) || []).length);
    check('the new colour is written once globally, not copied into each rule',
      n === 0, n);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== AN OVERRIDE IS SCOPED TO THE PAGE BUILDER =====');
  {
    const S = [sec('s1', 'text', { elements: [H('a', { color: '@primary' })] })];
    const { ctx, p, errs } = await page(b, S, { design: { colors: { primary: '#00aa00' }, typography: {} } });
    const r = await p.evaluate(() => ({
      el: getComputedStyle(document.querySelector('[data-el="a"]')).color,
      hdrVar: getComputedStyle(document.documentElement).getPropertyValue('--hdr-bg').trim(),
      header: getComputedStyle(document.querySelector('.site-header, header')).backgroundColor
    }));
    check('the Page Builder override wins for the element', r.el === 'rgb(0, 170, 0)', r.el);
    check('and the site header colour variable is untouched', r.hdrVar === '#0088cc', r.hdrVar);
    check('so the header itself does not change', r.header !== 'rgb(0, 170, 0)', r.header);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     TYPOGRAPHY ROLES
     ================================================================ */
  console.log('\n===== A TYPOGRAPHY ROLE SETS SIZE, WEIGHT AND SPACING AT ONCE =====');
  {
    const S = [sec('s1', 'text', { elements: [
      el('h1role', 'heading', { text: 'A', level: 'h3' }, { typography: '@h1' }),
      el('bodyrole', 'text', { text: 'B' }, { typography: '@body' }),
      el('over', 'heading', { text: 'C', level: 'h3' }, { typography: '@h1', fontSize: 12, fontWeight: '300' }),
      el('plain', 'heading', { text: 'D', level: 'h3' }, {})
    ] })];
    const { ctx, p, errs } = await page(b, S);
    const r = await p.evaluate(() => {
      const g = id => { const c = getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
        return { fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, tag: document.querySelector('[data-el="' + id + '"]').tagName }; };
      return { h1: g('h1role'), body: g('bodyrole'), over: g('over'), plain: g('plain') };
    });
    check('@h1 gives an h3 element the h1 role size and weight',
      r.h1.fs === '34px' && r.h1.fw === '700', r.h1);
    check('and it is still an <h3>: the role is visual, the level is semantic',
      r.h1.tag === 'H3' && r.plain.tag === 'H3', [r.h1.tag, r.plain.tag]);
    check('the untouched h3 keeps its own default size', r.plain.fs === '22px', r.plain);
    check('@body gives the body role size and weight',
      r.body.fs === '16px' && r.body.fw === '400', r.body);
    check('an explicit size and weight beat the role',
      r.over.fs === '12px' && r.over.fw === '300', r.over);
    check('while the role still supplies what was not overridden',
      Math.abs(parseFloat(r.over.lh) - 12 * 1.25) < 0.5, r.over.lh);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== THE BODY ROLE FOLLOWS THE SITE TYPOGRAPHY, THE HEADINGS DO NOT =====');
  {
    const S = [sec('s1', 'text', { elements: [
      el('body', 'text', { text: 'B' }, { typography: '@body' }),
      el('h2', 'heading', { text: 'H', level: 'h4' }, { typography: '@h2' })
    ] })];
    const { ctx, p, errs } = await page(b, S,
      { typography: { base: { fontSize: '19', fontWeight: '500' } } });
    const r = await p.evaluate(() => {
      const g = id => { const c = getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
        return c.fontSize + '/' + c.fontWeight; };
      return { body: g('body'), h2: g('h2') };
    });
    check('@body picks up the site base typography', r.body === '19px/500', r.body);
    check('@h2 does not, having no equivalent in that system', r.h2 === '28px/700', r.h2);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A GLOBAL TYPOGRAPHY OVERRIDE REACHES EVERY ELEMENT USING IT =====');
  {
    const S = [sec('s1', 'text', { elements: [
      el('a', 'heading', { text: 'A', level: 'h2' }, { typography: '@h2' }),
      el('b', 'notice', { text: 'B', variant: 'info' }, { typography: '@h2' })
    ] })];
    const { ctx, p, errs } = await page(b, S,
      { design: { colors: {}, typography: { h2: { fontSize: '44', lineHeight: '1.1' } } } });
    const r = await p.evaluate(() => {
      const g = id => { const c = getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
        return c.fontSize + '/' + c.lineHeight; };
      return { a: g('a'), b: g('b') };
    });
    check('both elements take the overridden role size',
      r.a.split('/')[0] === '44px' && r.b.split('/')[0] === '44px', r);
    check('and its line spacing', Math.abs(parseFloat(r.a.split('/')[1]) - 44 * 1.1) < 0.5, r.a);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     SECURITY
     ================================================================ */
  console.log('\n===== ONLY NAMES ON THE LIST BECOME CSS =====');
  {
    const hostile = ['@constructor', '@toString', '@hasOwnProperty', '@__proto__',
      '@valueOf', '@anything', '@', '@@primary', '@primary;color:red', '@PRIMARY',
      'var(--evil)', 'var(--hdr-bg)', 'url(javascript:alert(1))', '@primary)',
      '@{primary}', 'red;}body{display:none;}.x{'];
    const elements = hostile.map((v, i) => H('x' + i, { color: v }))
      .concat(hostile.map((v, i) => el('t' + i, 'heading', { text: 'y', level: 'h2' }, { typography: v })))
      .concat([H('good', { color: '@primary' })]);
    const { ctx, p, errs } = await page(b, [sec('s1', 'text', { elements })]);

    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('no hostile value appears anywhere in the generated CSS',
      !/constructor|toString|hasOwnProperty|__proto__|valueOf|anything|evil|javascript:|display:none|@PRIMARY|@\{/.test(css),
      css.slice(0, 400));
    check('the only var() emitted are the design tokens',
      (css.match(/var\(/g) || []).length === (css.match(/var\(--pbg-/g) || []).length,
      css.match(/var\([^)]*/g));
    check('a legitimate reference alongside them still works',
      /--pbe-color:var\(--pbg-primary,/.test(css));

    const plain = await cs(p, '[data-el="x0"]', 'color');
    const ref = await cs(p, '[data-el="good"]', 'color');
    let allSafe = true;
    for (let i = 0; i < hostile.length; i++) {
      const c = await cs(p, `[data-el="x${i}"]`, 'color');
      const f = await cs(p, `[data-el="t${i}"]`, 'fontSize');
      if (c !== plain || f !== '28px') { allSafe = false; check('hostile ' + JSON.stringify(hostile[i]) + ' is inert', false, { c, f }); }
    }
    check('every hostile value leaves the element at its shipped default', allSafe);
    check('while the valid reference is visibly different', ref !== plain, { ref, plain });
    check('the page stylesheet has no injected rule',
      await p.evaluate(() => !/display:\s*none/i.test(document.getElementById('cmsBuilder').textContent)));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== HOSTILE VALUES IN A BORDER SHORTHAND AND A GLOBAL OVERRIDE =====');
  {
    const S = [sec('s1', 'text', { elements: [
      H('b1', { border: '2px solid @primary' }),
      H('b2', { border: '2px solid @constructor' }),
      H('b3', { border: '2px @primary solid' }),
      H('b4', { border: '2px solid var(--evil)' })
    ] })];
    const { ctx, p, errs } = await page(b, S,
      { design: { colors: { primary: 'red;}body{display:none;}.x{', danger: 'var(--evil)' }, typography: {} } });
    const r = await p.evaluate(() => {
      const g = id => { const c = getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
        return c.borderTopWidth + '/' + c.borderTopColor; };
      return { b1: g('b1'), b2: g('b2'), b3: g('b3'), b4: g('b4'),
               design: document.getElementById('cmsDesign').textContent,
               bodyDisplay: getComputedStyle(document.body).display };
    });
    check('a role inside a border shorthand resolves', /^2px\//.test(r.b1), r.b1);
    check('an unknown role in a shorthand drops the whole border', r.b2 === '0px/rgb(34, 34, 34)', r.b2);
    check('a role anywhere but the colour slot is refused', r.b3 === '0px/rgb(34, 34, 34)', r.b3);
    check('var() typed into a border is refused', r.b4 === '0px/rgb(34, 34, 34)', r.b4);
    check('a hostile global override never reaches the :root block',
      !/display:none|var\(--evil\)/.test(r.design), r.design.slice(0, 200));
    check('and the role falls back to its shipped value',
      /--pbg-primary:#0088cc/.test(r.design), r.design.slice(0, 120));
    check('the page is not hidden', r.bodyDisplay !== 'none', r.bodyDisplay);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     FALLBACK AND COMPATIBILITY
     ================================================================ */
  console.log('\n===== MISSING OR BROKEN GLOBAL DATA NEVER BREAKS A PAGE =====');
  {
    for (const [label, design] of [['absent', undefined], ['null', null],
                                   ['a string', 'nope'], ['empty', {}],
                                   ['half built', { colors: null, typography: 7 }]]) {
      const S = [sec('s1', 'text', { elements: [H('a', { color: '@primary' }),
        el('t', 'heading', { text: 'x', level: 'h2' }, { typography: '@h2' })] })];
      const extra = design === undefined ? {} : { design: design };
      const { ctx, p, errs } = await page(b, S, extra);
      const r = await p.evaluate(() => ({
        color: getComputedStyle(document.querySelector('[data-el="a"]')).color,
        fs: getComputedStyle(document.querySelector('[data-el="t"]')).fontSize,
        hasRoot: /--pbg-primary/.test(document.getElementById('cmsDesign').textContent)
      }));
      check('design ' + label + ': references still resolve to the shipped values',
        r.color === 'rgb(0, 136, 204)' && r.fs === '28px' && r.hasRoot, r);
      check('design ' + label + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  {
    /* The var() fallback is what covers a page whose :root block never
       arrived -- the case a cached or half-loaded page produces. */
    const S = [sec('s1', 'text', { elements: [H('a', { color: '@danger' })] })];
    const { ctx, p, errs } = await page(b, S);
    await p.evaluate(() => { document.getElementById('cmsDesign').remove(); });
    const c = await cs(p, '[data-el="a"]', 'color');
    check('with the design block removed entirely, the fallback still paints',
      c === 'rgb(198, 40, 40)', c);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== PAGES THAT DO NOT USE THE SYSTEM ARE UNCHANGED =====');
  {
    const S = [sec('s1', 'text', {
      style: { bg: '#101010', color: '#f0f0f0', padding: 30 },
      elements: [
        H('h', { color: '#ff0000', fontSize: 22, border: '2px solid #0000ff' }),
        el('t', 'text', { text: 'x' }, {}),
        el('btn', 'button', { text: 'B', href: '#' }, { bg: '#00ff00' })
      ] })];
    const { ctx, p, errs } = await page(b, S, { design: { colors: { primary: '#ff00ff' }, typography: { h2: { fontSize: '80' } } } });
    const r = await p.evaluate(() => {
      const g = (s, k) => getComputedStyle(document.querySelector(s))[k];
      return { h: g('[data-el="h"]', 'color'), hs: g('[data-el="h"]', 'fontSize'),
               bw: g('[data-el="h"]', 'borderTopWidth'), btn: g('[data-el="btn"]', 'backgroundColor'),
               sec: g('[data-sec="s1"]', 'backgroundColor'), t: g('[data-el="t"]', 'fontSize') };
    });
    check('a literal colour is unaffected by the global palette', r.h === 'rgb(255, 0, 0)', r.h);
    check('a literal size is unaffected by the global typography', r.hs === '22px', r.hs);
    check('an element with no typography role keeps its own default', r.t === '16px', r.t);
    check('a literal border and background are unaffected',
      r.bw === '2px' && r.btn === 'rgb(0, 255, 0)' && r.sec === 'rgb(16, 16, 16)', r);
    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('and no var() is emitted for a page that uses no references',
      css.indexOf('var(') === -1, css.slice(0, 200));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A ROLE WORKS ON EVERY TYPE THAT OFFERS IT =====');
  {
    const keys = await (async () => {
      const t = await page(b, []);
      const k = await t.p.evaluate(() => CMS.sections.elementStyleKeys);
      await t.ctx.close();
      return k;
    })();
    const CONTENT = {
      heading: { text: 'H', level: 'h2' }, text: { text: 'T' },
      button: { text: 'B', href: '#' }, card: { title: 'C', text: 'c' },
      notice: { text: 'N', variant: 'info' }, featureBox: { title: 'F', text: 'f' },
      faq: { items: [{ question: 'Q', answer: 'A' }] },
      socialLinks: { items: [{ platform: 'whatsapp', url: '#' }] },
      icon: { icon: 'star', label: 'i' }, divider: {}, spacer: {},
      columns: { columns: [{ elements: [] }, { elements: [] }] }, image: { src: 'assets/images/favicon.png', alt: 'a' }
    };
    const colorTypes = Object.keys(keys).filter(t => keys[t].indexOf('color') > -1);
    const typoTypes = Object.keys(keys).filter(t => keys[t].indexOf('typography') > -1);
    const elements = colorTypes.map(t => el('c_' + t, t, CONTENT[t], { color: '@danger' }))
      .concat(typoTypes.map(t => el('y_' + t, t, CONTENT[t], { typography: '@h1' })));
    const { ctx, p, errs } = await page(b, [sec('s1', 'text', { elements })]);

    const bad = [];
    for (const t of colorTypes) {
      const c = await cs(p, `[data-el="c_${t}"]`, 'color').catch(() => null);
      if (c !== 'rgb(198, 40, 40)') bad.push(t + ':' + c);
    }
    check('@danger paints every type that offers a text colour (' + colorTypes.length + ')',
      bad.length === 0, bad);

    const bad2 = [];
    for (const t of typoTypes) {
      const f = await cs(p, `[data-el="y_${t}"]`, 'fontSize').catch(() => null);
      if (f !== '34px') bad2.push(t + ':' + f);
    }
    check('@h1 sizes every type that offers a typography role (' + typoTypes.length + ')',
      bad2.length === 0, bad2);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     THE ADMIN
     ================================================================ */
  console.log('\n===== THE GLOBAL DESIGN PANEL =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1250 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="design"]'); await p.waitForTimeout(500);

    const roles = await p.$$eval('#designRoles .design-role', n => n.map(x => x.getAttribute('data-role')));
    const want = await p.evaluate(() => Object.keys(CMS.sections.colorRoles));
    check('every colour role the renderer knows has a row', roles.join() === want.join(), { roles, want });
    const typo = await p.$$eval('#designRoles .design-typo', n => n.map(x => x.getAttribute('data-typo-role')));
    const wantT = await p.evaluate(() => Object.keys(CMS.sections.typoRoles));
    check('every typography role has a block', typo.join() === wantT.join(), { typo, wantT });

    const src = r => p.$eval(`.design-role[data-role="${r}"] .design-role-src`, n => n.textContent);
    check('a mapped role says which site colour it follows',
      /Uses the site .*colour/.test(await src('primary')), await src('primary'));
    check('and names it in words, not as a CSS variable',
      !/--|hdr-bg/.test(await src('primary')), await src('primary'));
    check('an unmapped role says it is Page Builder only',
      /Page Builder only/.test(await src('danger')), await src('danger'));

    /* Editing a site colour moves the role that follows it. */
    await p.click('.adm-nav-item[data-panel="colors"]'); await p.waitForTimeout(400);
    await p.fill('[data-color-key="hdr-bg"] input[type="text"]', '#aa1166');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="design"]'); await p.waitForTimeout(400);
    check('the Primary row follows the site colour it aliases',
      /#aa1166/i.test(await src('primary')), await src('primary'));
    check('and the resolved value the renderer reports agrees',
      (await p.evaluate(() => CMS.sections.roleColor('primary'))) === '#aa1166');

    /* Overriding, then handing it back. */
    await p.fill('[data-role-input="primary"]', '#00ee11'); await p.waitForTimeout(400);
    check('an override is stored under design.colors, not in colors',
      await p.evaluate(() => CMS.data().design.colors.primary === '#00ee11' &&
                             CMS.data().colors['hdr-bg'] === '#aa1166'));
    check('the row says it is overridden for the Page Builder',
      /Overridden for the Page Builder/.test(await src('primary')), await src('primary'));
    await p.click('.design-role[data-role="primary"] .design-clear'); await p.waitForTimeout(400);
    check('clearing it hands the role back to the site colour',
      await p.evaluate(() => !('primary' in CMS.data().design.colors) &&
                             CMS.sections.roleColor('primary') === '#aa1166'));

    /* A typography role edit is stored and only where it belongs. */
    await p.fill('[data-typo-input="h2.fontSize"]', '41'); await p.waitForTimeout(400);
    check('a typography edit is stored under design.typography',
      await p.evaluate(() => CMS.data().design.typography.h2.fontSize === '41'));
    check('and it does not touch the site typography panel data',
      await p.evaluate(() => !(CMS.data().typography || {}).h2));
    check('the resolved role reports the new size',
      (await p.evaluate(() => CMS.sections.roleTypo('h2', 'fontSize'))) === '41px');
    await p.fill('[data-typo-input="h2.fontSize"]', ''); await p.waitForTimeout(400);
    check('clearing it drops the key rather than storing an empty string',
      await p.evaluate(() => !CMS.data().design.typography.h2));

    /* ---- the element control ---- */
    console.log('\n===== THE ELEMENT CONTROL OFFERS A ROLE OR A CUSTOM VALUE =====');
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(400);
    const sid = await p.$eval('#pbList .pb-sec', e => e.getAttribute('data-sec-id'));
    const TOP = `#pbList .pb-sec[data-sec-id="${sid}"] > .pb-sec-body > .pb-subbody`;
    const eid = await p.$$eval(`${TOP} > .pb-els > .pb-elcard`, e => e[0].getAttribute('data-el-id'));
    const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${eid}"]`;
    const DES = `${CARD} > .pb-elcard-body > .pb-details`;
    await p.$eval(DES, d => { d.open = true; });
    await p.$$eval(`${DES} .pb-group`, g => g.forEach(x => { x.open = true; }));
    await p.waitForTimeout(250);

    const CSEL = `${DES} .pb-group[data-group="colors"] .pb-field:has(> span:text-is("Text colour")) [data-part="role"]`;
    const CVAL = `${DES} .pb-group[data-group="colors"] .pb-field:has(> span:text-is("Text colour")) [data-part="value"] input[type="text"]`;
    const opts = await p.$$eval(CSEL, s => Array.from(s[0].options).map(o => o.value));
    check('the colour control offers every role, plus blank and Custom',
      opts.length === want.length + 2 && opts[0] === '' &&
      opts[opts.length - 1] === 'custom' &&
      want.every(r => opts.indexOf('@' + r) > -1), opts);
    check('and it never shows a CSS variable name',
      !(await p.$$eval(CSEL, s => Array.from(s[0].options).map(o => o.textContent))).some(t => /--/.test(t)));

    const draftOf = async () => p.evaluate(x => {
      const d = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts || {};
      for (const k in d) for (const s of d[k].sections || []) for (const e of s.elements || [])
        if (e.id === x) return e;
      return null;
    }, eid);

    await p.selectOption(CSEL, '@primary'); await p.waitForTimeout(400);
    check('choosing a role stores the reference, not a resolved colour',
      (await draftOf()).style.color === '@primary', (await draftOf()).style);

    /* Switching to Custom must not throw the reference away before there is
       anything to replace it with. */
    await p.selectOption(CSEL, 'custom'); await p.waitForTimeout(300);
    check('switching to Custom leaves the reference in place until a colour is typed',
      (await draftOf()).style.color === '@primary', (await draftOf()).style);
    await p.fill(CVAL, '#123abc'); await p.waitForTimeout(400);
    check('typing a colour replaces it', (await draftOf()).style.color === '#123abc');
    await p.selectOption(CSEL, '@muted'); await p.waitForTimeout(400);
    check('choosing a role again replaces the custom value',
      (await draftOf()).style.color === '@muted');
    await p.selectOption(CSEL, 'custom'); await p.waitForTimeout(400);
    check('and the colour typed earlier is offered back rather than lost',
      (await draftOf()).style.color === '#123abc', (await draftOf()).style);
    await p.selectOption(CSEL, ''); await p.waitForTimeout(400);
    check('the blank option removes the key entirely',
      !('color' in (await draftOf()).style), (await draftOf()).style);

    const TSEL = `${DES} .pb-group[data-group="typography"] [data-part="typo"]`;
    const topts = await p.$$eval(TSEL, s => Array.from(s[0].options).map(o => o.value));
    check('the typography control offers every role and a blank',
      topts.length === wantT.length + 1 && topts[0] === '' &&
      wantT.every(r => topts.indexOf('@' + r) > -1), topts);
    await p.selectOption(TSEL, '@h1'); await p.waitForTimeout(400);
    check('choosing one stores the reference', (await draftOf()).style.typography === '@h1');
    check('and it does not touch the heading level',
      (await draftOf()).content.level === 'h2', (await draftOf()).content);

    /* The role must reach the preview, which is a separate document. */
    const fr = p.frame({ url: u => /about\.html/.test(u) });
    check('the preview frame is there', !!fr);
    if (fr) {
      await p.waitForTimeout(500);
      const r = await fr.evaluate(id => {
        const n = document.querySelector('[data-el="' + id + '"]');
        return n ? getComputedStyle(n).fontSize + ' ' + n.tagName : null;
      }, eid);
      check('the preview shows the role size, on the unchanged tag', r === '34px H2', r);
    }

    /* Changing the global value must reach it too, without a reload. */
    await p.click('.adm-nav-item[data-panel="design"]'); await p.waitForTimeout(400);
    await p.fill('[data-typo-input="h1.fontSize"]', '57'); await p.waitForTimeout(700);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(700);
    if (fr) {
      const r = await fr.evaluate(id => {
        const n = document.querySelector('[data-el="' + id + '"]');
        return n ? getComputedStyle(n).fontSize : null;
      }, eid);
      check('changing the global role updates the preview without a reload', r === '57px', r);
    }

    check('the admin ran without console or page errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
