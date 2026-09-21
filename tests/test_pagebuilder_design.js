/* Page Builder V2 -- stage 5: grouped design controls.

   The point of this suite is the thing the grouping made easy to get wrong:
   a control that appears in the Admin but changes nothing on the page, or a
   renderer property that no control reaches. Both are checked mechanically,
   for every type and every key, rather than by listing them by hand -- so a
   key added later is covered the day it is added.

   Everything is asserted on computed style in a real browser. */
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

/* Content that makes each type render something measurable. */
const CONTENT = {
  heading:     { text: 'Heading words', level: 'h2' },
  text:        { text: 'Some body copy that is long enough to wrap.' },
  image:       { src: 'assets/images/favicon.png', alt: 'a' },
  button:      { text: 'Press me', url: '#' },
  card:        { title: 'Card title', text: 'Card body copy.', image: 'assets/images/favicon.png', imageAlt: 'a' },
  columns:     { columns: [{ elements: [] }, { elements: [] }] },
  divider:     {},
  spacer:      {},
  icon:        { icon: 'star', label: 'Star' },
  notice:      { text: 'Notice body copy.', variant: 'info', icon: 'info' },
  featureBox:  { title: 'Feature', text: 'Feature copy.', icon: 'star' },
  faq:         { items: [{ question: 'Question one?', answer: 'Answer one.' },
                         { question: 'Two?', answer: 'Answer two.' }] },
  socialLinks: { items: [{ platform: 'facebook', url: 'https://example.com' }] }
};

/* A value for each key that is guaranteed to differ from every default. */
const PROBE = {
  bg: '#ff00ff', color: '#00ff7f', bgImage: 'assets/images/favicon.png',
  fontSize: 41, fontWeight: '800', lineHeight: '2.4', letterSpacing: 4,
  align: 'right', padding: 37, margin: 29, gap: 33, maxWidth: 311, height: 97,
  radius: 13, border: '3px dashed #ff0000', shadow: '0 10px 30px rgba(0, 0, 0, 0.22)',
  lineWidth: 5, lineStyle: 'dotted', lineColor: '#ff0000', columns: '4',
  /* Stage 6: a role has to move the rendering like any other control. */
  typography: '@h1'
};

/* Computed style of a node and everything under it, as one comparable blob.
   Subtree included on purpose: several controls are meant to reach the words
   inside an element rather than its own box. */
const FP_PROPS = ['display', 'color', 'backgroundColor', 'backgroundImage', 'fontSize',
  'fontWeight', 'lineHeight', 'letterSpacing', 'textAlign', 'padding', 'margin',
  'maxWidth', 'minHeight', 'height', 'width', 'borderTopWidth', 'borderTopStyle',
  'borderTopColor', 'borderTopLeftRadius', 'boxShadow', 'gap', 'gridTemplateColumns',
  'alignSelf', 'justifySelf', 'justifyContent'];

const fingerprint = (p, sel) => p.$eval(sel, (root, props) => {
  const out = [];
  const walk = (n) => {
    const cs = getComputedStyle(n);
    out.push(props.map(k => cs[k]).join('|'));
    for (const c of n.children) walk(c);
  };
  walk(root);
  return out.join('\n');
}, FP_PROPS);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     NO FAKE CONTROLS -- every offered key must move the rendering
     ================================================================ */
  console.log('\n===== EVERY ELEMENT CONTROL CHANGES THE RENDERED RESULT =====');
  {
    const probe = await pageWith(b, { schemaVersion: 2, status: 'published', sections: [] });
    const keysByType = await probe.p.evaluate(() => CMS.sections.elementStyleKeys);
    const secKeys = await probe.p.evaluate(() => CMS.sections.sectionStyleKeys);
    await probe.ctx.close();

    check('the renderer publishes a key list for every element type',
      Object.keys(keysByType).length === 13, Object.keys(keysByType).length);
    check('and a key list for sections', secKeys.length > 0, secKeys);

    /* One page per element type: a plain instance and one instance per key,
       so every comparison is against the same type with the same content. */
    for (const type of Object.keys(keysByType)) {
      const keys = keysByType[type];
      const elements = [el('base_' + type, type, CONTENT[type])]
        .concat(keys.map(k => el('k_' + k, type, CONTENT[type], { [k]: PROBE[k] })));
      const S = [sec('s1', 'text', { elements })];
      const { ctx, p, errs } = await publishedPage(b, S, 1280);

      const plain = await fingerprint(p, `[data-el="base_${type}"]`).catch(() => null);
      if (plain === null) { check(type + ' renders at all', false); await ctx.close(); continue; }

      const dead = [];
      for (const k of keys) {
        const got = await fingerprint(p, `[data-el="k_${k}"]`).catch(() => null);
        if (got === null || got === plain) dead.push(k);
      }
      check(type + ': all ' + keys.length + ' offered controls change the rendering',
        dead.length === 0, { dead });
      check(type + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }

    /* The same, for sections. */
    {
      const elements = [el('e1', 'text', CONTENT.text)];
      const sections = [sec('base_sec', 'text', { elements })]
        .concat(secKeys.map(k => sec('sk_' + k, 'text', { elements, style: { [k]: PROBE[k] } })));
      const { ctx, p, errs } = await publishedPage(b, sections, 1280);
      const plain = await fingerprint(p, '[data-sec="base_sec"]');
      const dead = [];
      for (const k of secKeys) {
        const got = await fingerprint(p, `[data-sec="sk_${k}"]`).catch(() => null);
        if (got === null || got === plain) dead.push(k);
      }
      check('section: all ' + secKeys.length + ' offered controls change the rendering',
        dead.length === 0, { dead });
      check('section: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  /* ================================================================
     SECTION / ELEMENT ISOLATION
     ================================================================ */
  console.log('\n===== SECTION AND ELEMENT NAMESPACES STAY SEPARATE =====');
  {
    const S = [
      sec('s1', 'text', {
        style: { padding: 60, letterSpacing: 3, color: '#123456', fontSize: 30 },
        elements: [el('inner', 'heading', CONTENT.heading), el('t', 'text', CONTENT.text)]
      }),
      sec('s2', 'text', {
        elements: [el('outer', 'heading', CONTENT.heading,
          { padding: 44, letterSpacing: 6, color: '#654321', fontSize: 50 })]
      })
    ];
    const { ctx, p, errs } = await publishedPage(b, S, 1280);
    const r = await p.evaluate(() => {
      const g = s => { const c = getComputedStyle(document.querySelector(s));
        return { pad: c.padding, ls: c.letterSpacing, color: c.color, fs: c.fontSize }; };
      return { sec1: g('[data-sec="s1"]'), inner: g('[data-el="inner"]'),
               sec2: g('[data-sec="s2"]'), outer: g('[data-el="outer"]') };
    });

    check('section padding does not leak into an element inside it',
      r.sec1.pad === '60px' && r.inner.pad === '0px', r);
    check('element padding does not leak out to its section',
      r.outer.pad === '44px' && r.sec2.pad === '40px 16px', r);
    check('a section font size does not override the heading default',
      r.sec1.fs === '30px' && r.inner.fs === '28px', r);
    check('an element font size does not reach its section',
      r.outer.fs === '50px' && r.sec2.fs !== '50px', r);
    /* Letter spacing is meant to flow in, which is why the section has it. */
    check('section letter spacing does reach the elements inside it',
      r.sec1.ls === '3px' && r.inner.ls === '3px', r);
    check('an element letter spacing overrides its section',
      r.outer.ls === '6px', r);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     TYPOGRAPHY -- heading levels must keep their own defaults
     ================================================================ */
  console.log('\n===== HEADING LEVELS ARE UNCHANGED BY THE NEW CONTROLS =====');
  {
    const lv = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
    const elements = lv.map(l => el('lv_' + l, 'heading', { text: l.toUpperCase(), level: l }))
      .concat(lv.map(l => el('ov_' + l, 'heading', { text: l, level: l }, { fontSize: 26, lineHeight: '2.4' })));
    const { ctx, p, errs } = await publishedPage(b, [sec('s1', 'text', { elements })], 1280);

    const sizes = await p.evaluate(() => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(l =>
      parseFloat(getComputedStyle(document.querySelector('[data-el="lv_' + l + '"]')).fontSize)));
    check('the six heading levels still have six different default sizes',
      new Set(sizes).size === 6, sizes);
    check('and they still descend h1 > h2 > ... > h6',
      sizes.every((v, i) => i === 0 || v < sizes[i - 1]), sizes);
    check('h1 is still 34px and h6 still 15px',
      sizes[0] === 34 && sizes[5] === 15, sizes);

    const tags = await p.evaluate(() => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(l =>
      document.querySelector('[data-el="lv_' + l + '"]').tagName.toLowerCase()));
    check('each level still renders its own tag', tags.join() === lv.join(), tags);

    const over = await p.evaluate(() => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(l => {
      const c = getComputedStyle(document.querySelector('[data-el="ov_' + l + '"]'));
      return c.fontSize + '/' + c.lineHeight;
    }));
    check('an explicit size overrides the level default on every level',
      over.every(v => v.split('/')[0] === '26px'), over);
    check('and line spacing applies on every level',
      over.every(v => Math.abs(parseFloat(v.split('/')[1]) - 26 * 2.4) < 0.5), over);

    /* Nothing was written back into the stored content. */
    const stored = await p.evaluate(() =>
      JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.sections[0].elements[0]);
    check('reading a heading does not rewrite its stored data',
      stored.content.level === 'h1' && !('fontSize' in stored.style), stored);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     V1 DATA AND MALFORMED DATA
     ================================================================ */
  console.log('\n===== OLD AND BROKEN STYLE DATA STILL BEHAVE =====');
  {
    /* Values written before stage 5 existed, in the shapes V1 wrote them. */
    const S = [sec('s1', 'text', { elements: [
      el('v1', 'heading', CONTENT.heading,
        { color: '#ff0000', fontSize: 22, fontWeight: '700', align: 'center',
          padding: 8, margin: 12, border: '2px solid #0000ff', radius: 5,
          shadow: '0 2px 4px rgba(0,0,0,.3)' }),
      el('plain', 'heading', CONTENT.heading)
    ] })];
    const { ctx, p, errs } = await publishedPage(b, S, 1280);
    const r = await p.evaluate(() => {
      const c = getComputedStyle(document.querySelector('[data-el="v1"]'));
      const d = getComputedStyle(document.querySelector('[data-el="plain"]'));
      return { color: c.color, fs: c.fontSize, ta: c.textAlign, pad: c.padding,
               bw: c.borderTopWidth, bs: c.borderTopStyle, r: c.borderTopLeftRadius,
               sh: c.boxShadow, lh: c.lineHeight, ls: c.letterSpacing,
               plainLh: d.lineHeight, plainLs: d.letterSpacing };
    });
    check('a V1 free-text border still renders', r.bw === '2px' && r.bs === 'solid', r);
    check('V1 colour, size, alignment, padding and radius still render',
      r.color === 'rgb(255, 0, 0)' && r.fs === '22px' && r.ta === 'center' &&
      r.pad === '8px' && r.r === '5px', r);
    check('a V1 shadow still renders', r.sh !== 'none', r.sh);
    check('an untouched heading keeps its 1.25 line height',
      Math.abs(parseFloat(r.plainLh) - 28 * 1.25) < 0.5, r.plainLh);
    check('and its letter spacing is still normal',
      r.plainLs === 'normal', r.plainLs);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  {
    const junk = [
      el('m1', 'heading', CONTENT.heading, { lineHeight: 'red;}body{display:none', letterSpacing: 'url(x)' }),
      el('m2', 'heading', CONTENT.heading, { lineHeight: null, letterSpacing: undefined, border: {} }),
      el('m3', 'heading', CONTENT.heading, { fontSize: 'expression(alert(1))', shadow: '<script>' }),
      el('m4', 'heading', CONTENT.heading, { lineHeight: 2, letterSpacing: -1 })
    ];
    const { ctx, p, errs } = await publishedPage(b, [sec('s1', 'text', { elements: junk })], 1280);
    const css = await p.evaluate(() => CMS.sections.css(CMS.sections.published('about')));
    check('malformed style values never reach the stylesheet',
      !/display:none|url\(|expression\(|<script/.test(css), css.slice(0, 300));
    const r = await p.evaluate(() => ['m1', 'm2', 'm3'].map(id => {
      const c = getComputedStyle(document.querySelector('[data-el="' + id + '"]'));
      return c.lineHeight + '|' + c.letterSpacing + '|' + c.fontSize;
    }));
    check('and the elements fall back to their defaults',
      r.every(v => v === r[0]) && /normal/.test(r[0]), r);
    const ok = await p.evaluate(() => {
      const c = getComputedStyle(document.querySelector('[data-el="m4"]'));
      return c.lineHeight + '|' + c.letterSpacing;
    });
    check('a numeric line height and a negative letter spacing are accepted',
      Math.abs(parseFloat(ok.split('|')[0]) - 56) < 0.5 && ok.split('|')[1] === '-1px', ok);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     THE ADMIN
     ================================================================ */
  console.log('\n===== THE DESIGN PANEL IS GROUPED, AND THE GROUPS ARE COMPLETE =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(400);
    const sid = await p.$eval('#pbList .pb-sec', e => e.getAttribute('data-sec-id'));
    const SEC = `#pbList .pb-sec[data-sec-id="${sid}"]`;
    const TOP = `${SEC} > .pb-sec-body > .pb-subbody`;

    const GROUP_ORDER = ['layout', 'spacing', 'typography', 'colors', 'border', 'shadow', 'background'];

    /* ---- section ---- */
    await p.click(`${SEC} .pb-subtab[data-view="design"]`); await p.waitForTimeout(350);
    const secGroups = await p.$$eval(`${SEC} .pb-subbody > .pb-group`,
      gs => gs.map(g => ({ key: g.getAttribute('data-group'),
        label: g.querySelector('summary').firstChild.textContent.trim(),
        n: g.querySelectorAll('.pb-field').length,
        badge: g.querySelector('.pb-group-count').textContent,
        open: g.open })));
    check('the section design panel is split into groups', secGroups.length >= 5, secGroups);
    check('the groups appear in the declared order',
      secGroups.map(g => g.key).join() ===
        GROUP_ORDER.filter(k => secGroups.some(g => g.key === k)).join(), secGroups.map(g => g.key));
    check('no control fell through into a "More" group',
      !secGroups.some(g => g.key === 'more'), secGroups.map(g => g.key));
    check('every badge matches the number of controls in its group',
      secGroups.every(g => g.badge === String(g.n)), secGroups);
    check('only the first group starts open',
      secGroups.filter(g => g.open).length === 1 && secGroups[0].open, secGroups.map(g => g.open));

    const secTotal = secGroups.reduce((a, g) => a + g.n, 0);
    const secWant = await p.evaluate(() => CMS.sections.sectionStyleKeys.length);
    check('the groups together hold exactly the section keys the renderer honours (' + secWant + ')',
      secTotal === secWant, { secTotal, secWant });

    const secKeysShown = secGroups.map(g => g.key);
    check('a section is offered a Background group for its background image',
      secKeysShown.indexOf('background') > -1, secKeysShown);
    const secLabels = await p.$$eval(`${SEC} .pb-subbody .pb-field > .pb-field-label`, n => n.map(x => x.textContent));
    check('a section is never offered the column layout control',
      !secLabels.some(l => /Column layout/.test(l)), secLabels);
    check('a section is never offered the divider line controls',
      !secLabels.some(l => /^Line /.test(l)), secLabels);
    check('a section is never offered line spacing, which would do nothing on it',
      !secLabels.some(l => /Line spacing/.test(l)), secLabels);
    check('a section IS offered letter spacing, which does reach its elements',
      secLabels.some(l => /Letter spacing/.test(l)), secLabels);

    /* ---- every element type ---- */
    await p.click(`${SEC} .pb-subtab[data-view="content"]`); await p.waitForTimeout(350);
    const TYPES = ['heading', 'text', 'image', 'button', 'card', 'columns', 'divider',
                   'spacer', 'icon', 'notice', 'featureBox', 'faq', 'socialLinks'];
    const ids = {};
    for (const t of TYPES) {
      await p.click(`${TOP} > .pb-add-el > .pb-addbtn[data-el-type="${t}"]`);
      await p.waitForTimeout(250);
      ids[t] = await p.$$eval(`${TOP} > .pb-els > .pb-elcard`, e => e[e.length - 1].getAttribute('data-el-id'));
    }

    let allGrouped = true, allComplete = true, allOrdered = true, bad = [];
    for (const t of TYPES) {
      const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${ids[t]}"]`;
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`);
      await p.waitForTimeout(150);
      const gs = await p.$$eval(`${CARD} > .pb-elcard-body > .pb-details > div > .pb-group`,
        g => g.map(x => ({ key: x.getAttribute('data-group'),
                           n: x.querySelectorAll('.pb-field').length })));
      const want = await p.evaluate(x => CMS.sections.elementStyleKeys[x].length, t);
      const total = gs.reduce((a, g) => a + g.n, 0);
      if (gs.some(g => g.key === 'more')) { allGrouped = false; bad.push(t + ':more'); }
      if (total !== want) { allComplete = false; bad.push(t + ':' + total + '/' + want); }
      const order = gs.map(g => g.key).join();
      if (order !== GROUP_ORDER.filter(k => gs.some(g => g.key === k)).join()) {
        allOrdered = false; bad.push(t + ':order');
      }
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`);
      await p.waitForTimeout(80);
    }
    check('every element type groups all of its controls, none left over', allGrouped, bad);
    check('every element type offers exactly the keys the renderer honours', allComplete, bad);
    check('every element type renders its groups in the declared order', allOrdered, bad);

    /* An element must never be offered the section-only background image. */
    const elLabels = {};
    for (const t of ['heading', 'card', 'notice']) {
      const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${ids[t]}"]`;
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`); await p.waitForTimeout(150);
      elLabels[t] = await p.$$eval(`${CARD} > .pb-elcard-body > .pb-details > div .pb-field > .pb-field-label`,
        n => n.map(x => x.textContent));
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`); await p.waitForTimeout(80);
    }
    check('no element is offered the section-only background image control',
      !Object.keys(elLabels).some(t => elLabels[t].some(l => /Background image/.test(l))), elLabels);
    check('a card is offered letter spacing but not line spacing, which its children reset',
      elLabels.card.some(l => /Letter spacing/.test(l)) &&
      !elLabels.card.some(l => /Line spacing/.test(l)), elLabels.card);

    /* ---- divider: its own three controls, and no generic border ---- */
    {
      const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${ids.divider}"]`;
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`); await p.waitForTimeout(150);
      const g = await p.$$eval(`${CARD} > .pb-elcard-body > .pb-details > div > .pb-group[data-group="border"] .pb-field > .pb-field-label`,
        n => n.map(x => x.textContent));
      check('a divider keeps its three line controls, in the Border group',
        ['Line thickness (px)', 'Line style', 'Line colour'].every(l => g.indexOf(l) > -1), g);
      check('and is not offered the generic border or a corner radius',
        !g.some(l => l === 'Border' || /Corner radius/.test(l)), g);
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`); await p.waitForTimeout(80);
    }

    /* ---- the border control writes the old shorthand ---- */
    console.log('\n===== BORDER AND SHADOW CONTROLS OVER THE EXISTING WIRE FORMAT =====');
    const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${ids.heading}"]`;
    const DES = `${CARD} > .pb-elcard-body > .pb-details`;
    await p.click(`${DES} > summary`); await p.waitForTimeout(200);
    await p.$$eval(`${DES} .pb-group`, gs => gs.forEach(g => { g.open = true; }));
    await p.waitForTimeout(150);

    const draftOf = async (id) => p.evaluate(x => {
      const d = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts || {};
      const find = (list) => {
        for (const e of list || []) {
          if (e.id === x) return e;
          for (const c of (e.content || {}).columns || []) { const r = find(c.elements); if (r) return r; }
        }
        return null;
      };
      for (const k in d) for (const s of d[k].sections || []) { const r = find(s.elements); if (r) return r; }
      return null;
    }, id);

    const BW = `${DES} .pb-parts [data-part="width"]`;
    const BS = `${DES} .pb-parts [data-part="style"]`;
    /* Stage 6 gave the colour half a global-role selector, so reaching the
       custom box means choosing "Custom" first, as a person would. */
    const BCsel = `${DES} .pb-parts [data-part="color"] [data-part="role"]`;
    const BC = `${DES} .pb-parts [data-part="color"] [data-part="value"] input[type="text"]`;
    check('the border control is three inputs, not a CSS box',
      (await p.$$(`${DES} .pb-parts [data-part]`)).length >= 3);
    await p.fill(BW, '3'); await p.waitForTimeout(350);
    check('a width alone composes a complete border',
      (await draftOf(ids.heading)).style.border === '3px solid currentColor',
      (await draftOf(ids.heading)).style);
    await p.selectOption(BS, 'dashed'); await p.waitForTimeout(350);
    await p.selectOption(BCsel, 'custom'); await p.waitForTimeout(250);
    await p.fill(BC, '#ff0000'); await p.waitForTimeout(400);
    check('the three parts write one shorthand into the existing key',
      (await draftOf(ids.heading)).style.border === '3px dashed #ff0000',
      (await draftOf(ids.heading)).style);

    const SH = `${DES} .pb-parts [data-part="preset"]`;
    await p.selectOption(SH, '0 4px 12px rgba(0,0,0,.15)'); await p.waitForTimeout(350);
    check('a shadow preset stores its constant',
      (await draftOf(ids.heading)).style.shadow === '0 4px 12px rgba(0,0,0,.15)',
      (await draftOf(ids.heading)).style);
    await p.selectOption(SH, ''); await p.waitForTimeout(350);
    check('and clearing it removes the key rather than storing an empty string',
      !('shadow' in (await draftOf(ids.heading)).style), (await draftOf(ids.heading)).style);

    /* The preview is what an author judges it by. */
    const fr = p.frame({ url: u => /about\.html/.test(u) });
    check('the preview frame is there', !!fr);
    if (fr) {
      await p.waitForTimeout(400);
      const r = await fr.evaluate(id => {
        const n = document.querySelector('[data-el="' + id + '"]');
        if (!n) return null;
        const c = getComputedStyle(n);
        return { w: c.borderTopWidth, s: c.borderTopStyle, col: c.borderTopColor };
      }, ids.heading);
      check('and the border the three inputs composed is the computed border there',
        r && r.w === '3px' && r.s === 'dashed' && r.col === 'rgb(255, 0, 0)', r);
    }

    /* ---- a legacy value this UI cannot take apart is never lost ---- */
    await p.evaluate(id => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS'));
      const d = raw.builderDrafts;
      for (const k in d) for (const s of d[k].sections || []) for (const e of s.elements || []) {
        if (e.id === id) e.style.border = 'thick groovy rebeccapurple';
      }
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, ids.heading);
    /* Reloaded rather than re-rendered: the admin holds its state in memory,
       so a value poked into storage only counts once it is read back. */
    await p.reload({ waitUntil: 'networkidle' });
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(700);
    /* A reload collapses the section, so open it again the way a person
       would before reaching for anything inside it. */
    if (!(await p.$(`${SEC}.open`))) {
      await p.click(`${SEC} .pb-sec-title`); await p.waitForTimeout(400);
    }
    const openPanel = async () => {
      await p.$eval(`${CARD} > .pb-elcard-body > .pb-details`, d => { d.open = true; });
      await p.$$eval(`${DES} .pb-group`, gs => gs.forEach(g => { g.open = true; }));
      await p.waitForTimeout(150);
    };
    await openPanel();
    const legacy = await p.$eval(`${DES} .pb-group[data-group="border"] .pb-field:has(> span:text-is("Border (custom value)")) .pb-in`,
      n => n.value).catch(() => null);
    check('a border value this UI cannot parse is shown as text rather than dropped',
      legacy === 'thick groovy rebeccapurple', legacy);

    /* ---- responsive isolation, through the grouped UI ---- */
    console.log('\n===== RESPONSIVE OVERRIDES STAY ON THEIR OWN TIER =====');
    const FS = `${DES} .pb-group[data-group="typography"] .pb-field:has(> span:text-is("Text size (px)")) .pb-in`;
    const openAll = openPanel;
    await openAll();
    await p.fill(FS, '40'); await p.waitForTimeout(400);
    await p.click(`${DES} .pb-devtabs > .pb-devtab[data-device="tablet"]`); await p.waitForTimeout(250);
    await openAll();
    check('the tablet box starts empty rather than showing the desktop value',
      (await p.inputValue(FS)) === '');
    await p.fill(FS, '30'); await p.waitForTimeout(400);
    await p.click(`${DES} .pb-devtabs > .pb-devtab[data-device="mobile"]`); await p.waitForTimeout(250);
    await openAll();
    check('the mobile box starts empty rather than showing the tablet value',
      (await p.inputValue(FS)) === '');
    await p.fill(FS, '20'); await p.waitForTimeout(400);

    let st2 = await draftOf(ids.heading);
    check('all three tiers are stored separately',
      st2.style.fontSize === '40' && st2.responsive.tablet.fontSize === '30' &&
      st2.responsive.mobile.fontSize === '20', st2);
    check('and the group open state survived the device switches',
      await p.$eval(`${DES} .pb-group[data-group="typography"]`, g => g.open));

    await p.click(`${DES} .pb-clear`); await p.waitForTimeout(400);
    st2 = await draftOf(ids.heading);
    check('clearing mobile leaves desktop and tablet exactly as they were',
      st2.style.fontSize === '40' && st2.responsive.tablet.fontSize === '30' &&
      JSON.stringify(st2.responsive.mobile) === '{}', st2);

    await p.click(`${DES} .pb-devtabs > .pb-devtab[data-device="tablet"]`); await p.waitForTimeout(250);
    await p.click(`${DES} .pb-clear`); await p.waitForTimeout(400);
    st2 = await draftOf(ids.heading);
    check('clearing tablet leaves desktop alone',
      st2.style.fontSize === '40' && JSON.stringify(st2.responsive.tablet) === '{}', st2);

    /* Typing in one control must not rebuild the panel around it: a rebuild
       would take the focus away mid-edit, and it is the kind of cost that
       only shows up on a long page. The input node itself is the witness. */
    await p.click(`${DES} .pb-devtabs > .pb-devtab[data-device="base"]`); await p.waitForTimeout(250);
    await openAll();
    await p.$eval(FS, n => { n.__stamp = 'before'; });
    await p.fill(FS, '38'); await p.waitForTimeout(400);
    check('changing a control does not rebuild the panel it lives in',
      await p.$eval(FS, n => n.__stamp === 'before'));
    await p.$eval(`${DES} .pb-group[data-group="typography"]`, g => { g.__stamp = 'g'; });
    await p.fill(FS, '39'); await p.waitForTimeout(400);
    check('and does not rebuild its group either',
      await p.$eval(`${DES} .pb-group[data-group="typography"]`, g => g.__stamp === 'g'));

    check('the admin ran without console errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
