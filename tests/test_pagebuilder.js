/* Page Builder V1.
   Covers the renderer and its guards, style isolation against the site's own
   CSS, the draft/publish separation, the admin panel, the element and design
   editors, and the live preview.

   Assertions are on computed style and real DOM wherever the question is
   "does this actually render", because the bug that prompted this suite —
   a heading colour that the page's own .info-article h2 rule quietly won —
   is invisible to any test that only inspects the generated CSS text.

   Nothing here writes to the repository: state lives in the browser. */
const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const seed = (page, status, sections) => page.addInitScript((s) => {
  const raw = JSON.parse(window.localStorage.getItem('whiteLabelCMS') || '{}');
  raw.pages = raw.pages || {};
  raw.pages.about = Object.assign({}, raw.pages.about,
    { builder: { schemaVersion: 1, status: s.status, sections: s.sections } });
  window.localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
}, { status: status, sections: sections });

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

/* Opens about.html with these sections published and returns the page. */
async function publishedPage(b, sections, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await seed(p, 'published', sections);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});
const el  = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. MOUNTS
     ================================================================ */
  console.log('\n===== MOUNTS =====');
  {
    const { ctx, p } = await publishedPage(b, []);
    for (const f of ['about', 'contact', 'responsible-gaming']) {
      await p.goto(`${BASE}/${f}.html`, { waitUntil: 'domcontentloaded' });
      check(f + '.html has a builder mount',
        await p.$eval('[data-cms-sections]', e => e.getAttribute('data-cms-sections')) === f);
      check(f + '.html links sections.css',
        (await p.$$('link[href$="css/sections.css"]')).length === 1);
    }
    for (const f of ['index', 'login', 'register', '404']) {
      await p.goto(`${BASE}/${f}.html`, { waitUntil: 'domcontentloaded' });
      check(f + '.html deliberately has no mount',
        (await p.$$('[data-cms-sections]')).length === 0);
      check(f + '.html does not load sections.css',
        (await p.$$('link[href$="css/sections.css"]')).length === 0);
    }
    await ctx.close();
  }

  /* ================================================================
     2. NO BUILDER — the shipped page is untouched
     ================================================================ */
  console.log('\n===== NO BUILDER: THE SHIPPED PAGE IS UNTOUCHED =====');
  {
    const { ctx, p } = await publishedPage(b, []);
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    const a = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section').length,
      mount: document.querySelector('[data-cms-sections]').children.length,
      h2: document.querySelectorAll('.info-body h2').length,
      text: document.querySelector('.info-body').textContent.trim().slice(0, 30),
      h2color: getComputedStyle(document.querySelector('.info-body h2')).color,
      css: !!document.getElementById('cmsBuilder') && document.getElementById('cmsBuilder').textContent.length
    }));
    check('no section rendered', a.pb === 0, a.pb);
    check('the mount stays empty', a.mount === 0, a.mount);
    check('the shipped headings are still there', a.h2 >= 3, a.h2);
    check('the shipped copy is still there', a.text.startsWith('JSK1 is an online gaming site'), a.text);
    check('the shipped headings keep the site colour', a.h2color === 'rgb(0, 136, 204)', a.h2color);
    check('no builder CSS emitted', !a.css, a.css);
    await ctx.close();
  }

  /* ================================================================
     3. DRAFT GATE
     ================================================================ */
  console.log('\n===== A DRAFT MUST NOT REACH VISITORS =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const SECT = [sec('d1', 'hero', { elements: [el('dh', 'heading', { text: 'Draft heading' })] })];
    await seed(p, 'draft', SECT);
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    const d = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section').length,
      h2: document.querySelectorAll('.info-body h2').length,
      stored: ((((CMS.data().pages) || {}).about || {}).builder || {}).status || null,
      count: (((((CMS.data().pages) || {}).about || {}).builder || {}).sections || []).length,
      css: (document.getElementById('cmsBuilder') || {}).textContent || ''
    }));
    check('the draft really is in the CMS state', d.stored === 'draft' && d.count === 1, [d.stored, d.count]);
    check('draft sections do NOT render', d.pb === 0, d.pb);
    check('no CSS is emitted for a draft', d.css === '', d.css.slice(0, 40));
    check('the shipped page is intact under a draft', d.h2 >= 3, d.h2);
    await ctx.close();
  }

  /* ================================================================
     4. THE HEADING-COLOUR CLASS OF BUG
     Every control below is checked as computed style inside
     .info-article, whose own rules are what used to win.
     ================================================================ */
  console.log('\n===== ELEMENT STYLE CONTROLS BEAT THE PAGE’S OWN CSS =====');
  {
    const SECT = [
      sec('s1', 'hero', {
        style: { bg: '#102030', color: '#ffff00', padding: '60', radius: '12',
                 border: '2px solid #ff0000', gap: '30' },
        elements: [
          el('e_h', 'heading', { text: 'Heading', level: 'h2' },
             { color: '#ff0000', fontSize: '40', fontWeight: '400', bg: '#00ff00',
               radius: '9', shadow: '0 0 5px #000000', maxWidth: '300', margin: '7' }),
          el('e_h3', 'heading', { text: 'Sub', level: 'h3' }, { color: '#ff00ff' }),
          el('e_t', 'text', { text: 'Body' }, { color: '#0000ff', fontSize: '11', margin: '3' }),
          el('e_b', 'button', { text: 'Go', href: 'contact.html' },
             { bg: '#800080', color: '#ffffff', fontSize: '21', radius: '17' }),
          el('e_c', 'card', { title: 'Card', text: 'Card text', buttonText: 'CardBtn', buttonHref: '#c' },
             { bg: '#ffffff', padding: '5', radius: '3' })
        ]
      })
    ];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const h = g('[data-el="e_h"]'), h3 = g('[data-el="e_h3"]'), t = g('[data-el="e_t"]'),
            btn = g('[data-el="e_b"]'), card = g('[data-el="e_c"]'),
            cardBtn = g('[data-el="e_c"] .pb-btn'), cardTitle = g('[data-el="e_c"] .pb-card-title'),
            cardText = g('[data-el="e_c"] .pb-card-text'), s = g('[data-sec="s1"]');
      return {
        mountInsideArticle: !!document.querySelector('.info-article [data-cms-sections]'),
        siteRuleStillApplies: getComputedStyle(document.querySelector('.info-body h2')).color,
        h: { color: h.color, size: h.fontSize, weight: h.fontWeight, bg: h.backgroundColor,
             radius: h.borderTopLeftRadius, shadow: h.boxShadow, maxWidth: h.maxWidth,
             margin: h.margin, padding: h.padding, tag: document.querySelector('[data-el="e_h"]').tagName },
        h3: { color: h3.color, tag: document.querySelector('[data-el="e_h3"]').tagName, size: h3.fontSize },
        t: { color: t.color, size: t.fontSize, margin: t.margin, padding: t.padding },
        btn: { color: btn.color, bg: btn.backgroundColor, size: btn.fontSize,
               radius: btn.borderTopLeftRadius, padding: btn.padding, border: btn.borderTopWidth,
               decoration: btn.textDecorationLine },
        card: { bg: card.backgroundColor, padding: card.padding, radius: card.borderTopLeftRadius },
        cardBtn: { bg: cardBtn.backgroundColor, color: cardBtn.color, padding: cardBtn.padding,
                   radius: cardBtn.borderTopLeftRadius },
        cardTitle: { color: cardTitle.color, size: cardTitle.fontSize, margin: cardTitle.margin },
        cardText: { color: cardText.color, margin: cardText.margin },
        s: { bg: s.backgroundColor, padding: s.padding, color: s.color, radius: s.borderTopLeftRadius }
      };
    });
    check('the mount really is inside .info-article', r.mountInsideArticle);
    check('the page’s own heading rule is still live on its own content',
      r.siteRuleStillApplies === 'rgb(0, 136, 204)', r.siteRuleStillApplies);

    check('heading colour wins over .info-article h2', r.h.color === 'rgb(255, 0, 0)', r.h.color);
    check('heading font size wins', r.h.size === '40px', r.h.size);
    check('heading font weight wins', r.h.weight === '400', r.h.weight);
    check('heading background applies', r.h.bg === 'rgb(0, 255, 0)', r.h.bg);
    check('heading radius applies', r.h.radius === '9px', r.h.radius);
    check('heading shadow applies', r.h.shadow.indexOf('5px') > -1, r.h.shadow);
    check('heading max width applies', r.h.maxWidth === '300px', r.h.maxWidth);
    check('heading margin wins over the site rule', r.h.margin === '7px', r.h.margin);
    check('heading renders at the chosen level', r.h.tag === 'H2', r.h.tag);
    check('an h3 heading also beats .info-article h3', r.h3.color === 'rgb(255, 0, 255)', r.h3.color);
    check('an h3 heading gets the default size for its level', r.h3.size === '22px', r.h3.size);

    check('text colour applies', r.t.color === 'rgb(0, 0, 255)', r.t.color);
    check('text size applies', r.t.size === '11px', r.t.size);
    check('text margin wins over .info-article p', r.t.margin === '3px', r.t.margin);

    check('button text colour wins over .info-article a', r.btn.color === 'rgb(255, 255, 255)', r.btn.color);
    check('button background applies', r.btn.bg === 'rgb(128, 0, 128)', r.btn.bg);
    check('button font size applies', r.btn.size === '21px', r.btn.size);
    check('button radius applies', r.btn.radius === '17px', r.btn.radius);
    check('button stays undecorated', r.btn.decoration === 'none', r.btn.decoration);

    check('card background applies', r.card.bg === 'rgb(255, 255, 255)', r.card.bg);
    check('card padding applies', r.card.padding === '5px', r.card.padding);
    check('card radius applies', r.card.radius === '3px', r.card.radius);
    check('card title colour follows the card, not .info-article h3',
      r.cardTitle.color === 'rgb(255, 255, 0)', r.cardTitle.color);
    check('card title margin is the builder’s, not the site’s',
      r.cardTitle.margin === '0px', r.cardTitle.margin);
    check('card text margin is the builder’s, not .info-article p',
      r.cardText.margin === '0px', r.cardText.margin);

    console.log('\n===== SECTION STYLE MUST NOT LEAK INTO ELEMENTS =====');
    check('section padding does not reach the heading', r.h.padding === '0px', r.h.padding);
    check('section padding does not reach the text', r.t.padding === '0px', r.t.padding);
    check('section padding does not reach the button', r.btn.padding === '10px 20px', r.btn.padding);
    check('section padding does not reach the card', r.card.padding === '5px', r.card.padding);
    check('section radius does not reach the button', r.btn.radius === '17px', r.btn.radius);
    check('section border does not reach the button', r.btn.border === '0px', r.btn.border);
    check('card background does not reach the button inside it',
      r.cardBtn.bg === 'rgb(26, 115, 232)', r.cardBtn.bg);
    check('card padding does not reach the button inside it',
      r.cardBtn.padding === '10px 20px', r.cardBtn.padding);
    check('card radius does not reach the button inside it',
      r.cardBtn.radius === '4px', r.cardBtn.radius);
    check('the section itself still gets its own values',
      r.s.bg === 'rgb(16, 32, 48)' && r.s.padding === '60px' && r.s.radius === '12px', r.s);
    check('section colour is inherited by an element that sets none',
      r.cardTitle.color === 'rgb(255, 255, 0)', r.cardTitle.color);
    check('no page errors while rendering', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     5. MULTIPLE INSTANCES — no bleed between siblings
     ================================================================ */
  console.log('\n===== MULTIPLE INSTANCES DO NOT BLEED =====');
  {
    const COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffaa00', '#00aaff'];
    const RGB = ['rgb(255, 0, 0)', 'rgb(0, 255, 0)', 'rgb(0, 0, 255)', 'rgb(255, 170, 0)', 'rgb(0, 170, 255)'];
    const SECT = [];
    /* five text sections, each a different background and padding */
    for (let i = 0; i < 5; i++) {
      SECT.push(sec('ms' + i, 'text', {
        style: { bg: COLORS[i], padding: String(10 + i * 10) },
        elements: [
          el('mh' + i, 'heading', { text: 'H' + i }, { color: COLORS[i], fontSize: String(20 + i) }),
          el('mb' + i, 'button', { text: 'B' + i, href: '#' + i }, { bg: COLORS[4 - i] })
        ]
      }));
    }
    /* one section holding three differently styled cards */
    SECT.push(sec('cards3', 'cards', { elements: [
      el('c0', 'card', { title: 'c0' }, { bg: '#111111', radius: '0' }),
      el('c1', 'card', { title: 'c1' }, { bg: '#222222', radius: '10' }),
      el('c2', 'card', { title: 'c2' }, { bg: '#333333', radius: '20' })
    ] }));
    /* a heading with no colour at all, to prove the default is untouched */
    SECT.push(sec('plain', 'text', { elements: [el('plainH', 'heading', { text: 'plain' })] }));

    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const out = { h: [], bg: [], pad: [], btn: [], card: [], radius: [] };
      for (let i = 0; i < 5; i++) {
        out.h.push(g('[data-el="mh' + i + '"]').color);
        out.bg.push(g('[data-sec="ms' + i + '"]').backgroundColor);
        out.pad.push(g('[data-sec="ms' + i + '"]').padding);
        out.btn.push(g('[data-el="mb' + i + '"]').backgroundColor);
      }
      for (let i = 0; i < 3; i++) {
        out.card.push(g('[data-el="c' + i + '"]').backgroundColor);
        out.radius.push(g('[data-el="c' + i + '"]').borderTopLeftRadius);
      }
      out.plain = g('[data-el="plainH"]').color;
      out.plainSize = g('[data-el="plainH"]').fontSize;
      out.sections = document.querySelectorAll('.pb-section').length;
      return out;
    });
    check('seven sections render', r.sections === 7, r.sections);
    for (let i = 0; i < 5; i++) {
      check('heading ' + i + ' keeps its own colour', r.h[i] === RGB[i], [r.h[i], RGB[i]]);
      check('section ' + i + ' keeps its own background', r.bg[i] === RGB[i], r.bg[i]);
      check('section ' + i + ' keeps its own padding', r.pad[i] === (10 + i * 10) + 'px', r.pad[i]);
      check('button ' + i + ' keeps its own background', r.btn[i] === RGB[4 - i], r.btn[i]);
    }
    check('three cards keep three backgrounds',
      new Set(r.card).size === 3, r.card);
    check('three cards keep three radii',
      r.radius[0] === '0px' && r.radius[1] === '10px' && r.radius[2] === '20px', r.radius);
    check('an unstyled heading inherits rather than picking up a sibling’s colour',
      r.plain === 'rgb(34, 34, 34)', r.plain);
    check('an unstyled heading keeps the builder default size', r.plainSize === '28px', r.plainSize);
    check('no page errors with many instances', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     6. NESTING — columns, and the CSS that used to be dropped
     ================================================================ */
  console.log('\n===== NESTED ELEMENTS =====');
  {
    const SECT = [sec('n1', 'text', { elements: [
      el('nCols', 'columns', { columns: [
        { elements: [el('nTxt', 'text', { text: 'left' }, { color: '#ff00ff', fontSize: '22' })] },
        { elements: [el('nBtn', 'button', { text: 'r', href: '#' }, { bg: '#123456' })] }
      ] }, { gap: '40' })
    ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      return {
        cols: document.querySelectorAll('.pb-columns .pb-column').length,
        nested: !!document.querySelector('[data-el="nTxt"]'),
        color: g('[data-el="nTxt"]').color,
        size: g('[data-el="nTxt"]').fontSize,
        btnBg: g('[data-el="nBtn"]').backgroundColor,
        gap: g('[data-el="nCols"]').gap,
        display: g('[data-el="nCols"]').display,
        nestedPadding: g('[data-el="nTxt"]').padding
      };
    });
    check('two columns render', r.cols === 2, r.cols);
    check('an element nested in a column renders', r.nested);
    check('a nested element gets its own colour', r.color === 'rgb(255, 0, 255)', r.color);
    check('a nested element gets its own font size', r.size === '22px', r.size);
    check('a nested button gets its own background', r.btnBg === 'rgb(18, 52, 86)', r.btnBg);
    check('the columns element gap applies', r.gap === '40px', r.gap);
    check('the columns element lays out as a grid', r.display === 'grid', r.display);
    check('the columns gap does not become the nested element’s padding',
      r.nestedPadding === '0px', r.nestedPadding);
    check('no page errors when nesting', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     7. SECTION TYPES
     ================================================================ */
  console.log('\n===== EVERY SECTION TYPE =====');
  {
    const TYPES = [['hero', 'pb-hero'], ['text', 'pb-text'], ['image', 'pb-image'],
                   ['imageText', 'pb-image-text'], ['cards', 'pb-cards'],
                   ['columns', 'pb-cols'], ['banner', 'pb-banner']];
    const SECT = TYPES.map(t => sec('t_' + t[0], t[0], {
      elements: [el('th_' + t[0], 'heading', { text: t[0] })] }));
    SECT.push(sec('t_unknown', 'nosuchtype', { elements: [el('tu', 'heading', { text: 'u' })] }));
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate((types) => {
      const out = {};
      types.forEach(t => {
        const e = document.querySelector('[data-sec="t_' + t[0] + '"]');
        out[t[0]] = e ? { cls: e.className, inner: !!e.querySelector('.pb-inner'),
                          display: getComputedStyle(e.querySelector('.pb-inner')).display,
                          heading: !!e.querySelector('[data-el="th_' + t[0] + '"]') } : null;
      });
      const u = document.querySelector('[data-sec="t_unknown"]');
      out.unknown = u ? { cls: u.className, heading: !!u.querySelector('[data-el="tu"]') } : null;
      return out;
    }, TYPES);
    TYPES.forEach(t => {
      check(t[0] + ' section gets its type class',
        r[t[0]] && r[t[0]].cls.indexOf(t[1]) > -1, r[t[0]] && r[t[0]].cls);
      check(t[0] + ' section renders its element', r[t[0]] && r[t[0]].heading);
    });
    check('cards lay out as a grid', r.cards.display === 'grid', r.cards.display);
    check('columns lay out as a grid', r.columns.display === 'grid', r.columns.display);
    check('image+text lays out as a grid', r.imageText.display === 'grid', r.imageText.display);
    check('hero lays out as a flex column', r.hero.display === 'flex', r.hero.display);
    check('an unknown section type still renders its content',
      r.unknown && r.unknown.heading && r.unknown.cls.indexOf('pb-generic') > -1, r.unknown);
    check('no page errors across every section type', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     8. RESPONSIVE
     ================================================================ */
  console.log('\n===== RESPONSIVE =====');
  {
    const SECT = [
      sec('r1', 'text', {
        style: { padding: '50', bg: '#101010' },
        responsive: { tablet: { padding: '30' }, mobile: { padding: '10' } },
        visibility: { desktop: true, tablet: true, mobile: false },
        elements: [
          el('rBoth', 'heading', { text: 'a' }, { fontSize: '40', color: '#ff0000' },
             { tablet: { fontSize: '30' }, mobile: { fontSize: '20' } }),
          el('rMobOnly', 'text', { text: 'b' }, { fontSize: '18' }, { mobile: { fontSize: '9' } }),
          el('rTabOnly', 'text', { text: 'c' }, { fontSize: '17' }, { tablet: { fontSize: '8' } })
        ]
      }),
      sec('r2', 'text', {
        style: { padding: '5' },
        visibility: { desktop: false, tablet: true, mobile: true },
        elements: [el('r2h', 'heading', { text: 'd' }, { fontSize: '12' })]
      })
    ];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const read = async (w) => {
      await p.setViewportSize({ width: w, height: 900 });
      return p.evaluate(() => {
        const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
        return { pad: g('[data-sec="r1"]').padding, both: g('[data-el="rBoth"]').fontSize,
                 mob: g('[data-el="rMobOnly"]').fontSize, tab: g('[data-el="rTabOnly"]').fontSize,
                 color: g('[data-el="rBoth"]').color,
                 s1vis: g('[data-sec="r1"]').display, s2vis: g('[data-sec="r2"]').display,
                 s2pad: g('[data-sec="r2"]').padding };
      });
    };
    const D = await read(1280), T = await read(900), M = await read(390);

    check('desktop uses the base padding', D.pad === '50px', D.pad);
    check('tablet uses the tablet override', T.pad === '30px', T.pad);
    check('mobile uses the mobile override', M.pad === '10px', M.pad);
    check('desktop element size is the base', D.both === '40px', D.both);
    check('tablet element size is the tablet override', T.both === '30px', T.both);
    check('mobile element size is the mobile override', M.both === '20px', M.both);
    check('a missing tablet override falls back to the base', T.mob === '18px', T.mob);
    check('a mobile-only override does not reach tablet', T.mob === '18px', T.mob);
    check('a mobile-only override does apply on mobile', M.mob === '9px', M.mob);
    check('a tablet-only override applies on tablet', T.tab === '8px', T.tab);
    check('a tablet-only override also applies on mobile (narrower inherits)',
      M.tab === '8px', M.tab);
    check('a property with no override keeps its value at every width',
      D.color === 'rgb(255, 0, 0)' && T.color === 'rgb(255, 0, 0)' && M.color === 'rgb(255, 0, 0)',
      [D.color, T.color, M.color]);
    check('hide-on-mobile hides only at mobile',
      D.s1vis !== 'none' && T.s1vis !== 'none' && M.s1vis === 'none', [D.s1vis, T.s1vis, M.s1vis]);
    check('hide-on-desktop hides only at desktop',
      D.s2vis === 'none' && T.s2vis !== 'none' && M.s2vis !== 'none', [D.s2vis, T.s2vis, M.s2vis]);
    check('a second section keeps its own responsive values',
      D.s2pad === '5px' && M.s2pad === '5px', [D.s2pad, M.s2pad]);
    check('no page errors across breakpoints', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     9. CONTENT AND URL SAFETY
     ================================================================ */
  console.log('\n===== CONTENT AND URL SAFETY =====');
  {
    const SECT = [sec('sf', 'text', { elements: [
      el('sfRaw', 'heading', { text: '<img src=x onerror=alert(1)>' }),
      el('sfNl', 'text', { text: 'one\ntwo' }),
      el('sfJs', 'button', { text: 'js', href: 'javascript:alert(1)' }),
      el('sfProto', 'button', { text: 'proto', href: '//evil.example.com/x' }),
      el('sfRel', 'button', { text: 'rel', href: 'contact.html', newTab: true }),
      el('sfAbs', 'button', { text: 'abs', href: 'https://example.com/a' }),
      el('sfRoot', 'button', { text: 'root', href: '/about.html' }),
      el('sfHash', 'button', { text: 'hash', href: '#top' }),
      el('sfMail', 'button', { text: 'mail', href: 'mailto:a@b.c' }),
      el('sfData', 'image', { src: 'data:text/html,<script>x</script>', alt: 'x' }),
      el('sfImgOk', 'image', { src: 'images/logo.png', alt: 'Logo' }),
      el('sfImgLink', 'image', { src: 'images/logo.png', alt: 'L', href: 'contact.html' }),
      el('sfUnknown', 'nope', { text: 'u' })
    ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const at = (id, a) => { const e = document.querySelector(`[data-el="${id}"]`); return e ? e.getAttribute(a) : null; };
      const raw = document.querySelector('[data-el="sfRaw"]');
      const nl = document.querySelector('[data-el="sfNl"]');
      const link = document.querySelector('[data-el="sfImgLink"]');
      return {
        rawText: raw ? raw.textContent : null,
        rawHtml: raw ? raw.innerHTML : null,
        injected: document.querySelectorAll('.pb-section img[src="x"]').length,
        nlText: nl ? nl.textContent : null,
        nlHtml: nl ? nl.innerHTML : null,
        js: at('sfJs', 'href'), proto: at('sfProto', 'href'),
        rel: at('sfRel', 'href'), relTarget: at('sfRel', 'target'), relRel: at('sfRel', 'rel'),
        abs: at('sfAbs', 'href'), root: at('sfRoot', 'href'),
        hash: at('sfHash', 'href'), mail: at('sfMail', 'href'),
        dataImg: !!document.querySelector('[data-el="sfData"]'),
        imgOk: at('sfImgOk', 'src'), imgAlt: at('sfImgOk', 'alt'),
        imgLoading: at('sfImgOk', 'loading'),
        linkWrapped: link ? link.parentElement.tagName : null,
        linkHref: link ? link.parentElement.getAttribute('href') : null,
        unknown: !!document.querySelector('[data-el="sfUnknown"]')
      };
    });
    check('stored markup is shown literally', r.rawText === '<img src=x onerror=alert(1)>', r.rawText);
    check('stored markup is not parsed as HTML', r.rawHtml.indexOf('<img') === -1, r.rawHtml);
    check('no injected element reached the DOM', r.injected === 0, r.injected);
    check('newlines survive in text', r.nlText === 'one\ntwo', r.nlText);
    check('text is inserted as text, never as HTML', r.nlHtml.indexOf('<') === -1, r.nlHtml);
    check('a javascript: href is refused', r.js === '#', r.js);
    check('a protocol-relative //host href is refused', r.proto === '#', r.proto);
    check('a relative href is kept', r.rel === 'contact.html', r.rel);
    check('newTab adds target and rel=noopener', r.relTarget === '_blank' && r.relRel === 'noopener', [r.relTarget, r.relRel]);
    check('an https href is kept', r.abs === 'https://example.com/a', r.abs);
    check('a root-relative href is kept', r.root === '/about.html', r.root);
    check('a fragment href is kept', r.hash === '#top', r.hash);
    check('a mailto href is kept', r.mail === 'mailto:a@b.c', r.mail);
    check('an image with a data: source is dropped entirely', r.dataImg === false, r.dataImg);
    check('a good image renders with its source', r.imgOk === 'images/logo.png', r.imgOk);
    check('an image keeps its alt text', r.imgAlt === 'Logo', r.imgAlt);
    check('an image is lazy loaded', r.imgLoading === 'lazy', r.imgLoading);
    check('a linked image is wrapped in an anchor', r.linkWrapped === 'A', r.linkWrapped);
    check('the wrapping anchor carries the href', r.linkHref === 'contact.html', r.linkHref);
    check('an unknown element type is skipped without throwing', r.unknown === false);
    check('no page errors on hostile content', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     10. CSS INJECTION THROUGH THE FREE-TEXT STYLE FIELDS
     ================================================================ */
  console.log('\n===== STYLE VALUES CANNOT INJECT CSS =====');
  {
    const SECT = [
      sec('inj', 'text', {
        style: { border: '1px solid red; } body { display:none } .x {',
                 shadow: 'red } html { opacity:0 } .y {',
                 bgImage: 'x") ; } html{opacity:0} a{b:url("y' },
        elements: [el('injH', 'heading', { text: 'i' },
          { color: 'red; } * { color: lime } .z {' })]
      }),
      sec('bad"]sec', 'text', { style: { bg: '#000000' },
        elements: [el('okEl', 'text', { text: 'ok' }, { color: '#abcdef' })] }),
      sec('okSec', 'text', { style: { border: '2px solid #00ff00', shadow: '0 0 4px #000000' },
        elements: [el('okH', 'heading', { text: 'o' }, { color: '#00ff00' })] })
    ];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const css = (document.getElementById('cmsBuilder') || {}).textContent || '';
      return {
        bodyDisplay: getComputedStyle(document.body).display,
        htmlOpacity: getComputedStyle(document.documentElement).opacity,
        siteHeading: getComputedStyle(document.querySelector('.info-body h2')).color,
        injBorder: g('[data-sec="inj"]').borderTopWidth,
        injShadow: g('[data-sec="inj"]').boxShadow,
        injBg: g('[data-sec="inj"]').backgroundImage,
        injColor: g('[data-el="injH"]').color,
        escapes: /\}\s*(body|html|\*|a|\.z)\s*\{/.test(css),
        badIdInCss: css.indexOf('bad"]sec') > -1,
        badIdSectionRendered: !!document.querySelector('.pb-section'),
        badIdChildStyled: g('[data-el="okEl"]').color,
        okBorder: g('[data-sec="okSec"]').borderTopWidth,
        okShadow: g('[data-sec="okSec"]').boxShadow.indexOf('4px') > -1,
        okColor: g('[data-el="okH"]').color
      };
    });
    check('the document is not hidden by an injected rule', r.bodyDisplay === 'block', r.bodyDisplay);
    check('the document is not made transparent by an injected rule', r.htmlOpacity === '1', r.htmlOpacity);
    check('the site’s own headings are unaffected', r.siteHeading === 'rgb(0, 136, 204)', r.siteHeading);
    check('no rule escapes its selector in the generated CSS', r.escapes === false);
    check('a border value carrying a brace is dropped', r.injBorder === '0px', r.injBorder);
    check('a shadow value carrying a brace is dropped', r.injShadow === 'none', r.injShadow);
    check('a background image carrying a quote is dropped', r.injBg === 'none', r.injBg);
    check('a colour value carrying a brace is dropped', r.injColor !== 'rgb(0, 255, 0)', r.injColor);
    check('an id that could break the selector emits no CSS', r.badIdInCss === false);
    check('a section with such an id still renders', r.badIdSectionRendered);
    check('and its elements are still styled', r.badIdChildStyled === 'rgb(171, 205, 239)', r.badIdChildStyled);
    check('a legitimate border value still works', r.okBorder === '2px', r.okBorder);
    check('a legitimate shadow value still works', r.okShadow, r.okShadow);
    check('a legitimate colour still works', r.okColor === 'rgb(0, 255, 0)', r.okColor);
    check('no page errors on hostile style values', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     11. MALFORMED AND MISSING DATA
     ================================================================ */
  console.log('\n===== THE RENDERER DEGRADES SAFELY =====');
  {
    const SECT = [
      { id: 'm1', type: 'hero', enabled: true },                       /* no elements at all */
      { id: 'm2', type: 'text', enabled: true, elements: [] },         /* empty element list */
      { id: 'm3', type: 'text', enabled: true, elements: [
          { id: 'mh', type: 'heading' },                               /* no content */
          { id: 'mt', type: 'text', content: null },                   /* null content */
          { id: 'mi', type: 'image', content: {} },                    /* no src */
          { id: 'mc', type: 'card', content: {} },                     /* empty card */
          { id: 'mx', type: 'columns', content: {} },                  /* no columns */
          { id: 'my', type: 'columns', content: { columns: [] } },     /* empty columns */
          null,                                                        /* a null element */
          { type: 'heading', content: { text: 'no id' } }              /* no id */
      ] },
      { id: 'm4', type: 'text', enabled: false, elements: [
          { id: 'off', type: 'heading', content: { text: 'off' } }] }, /* disabled section */
      { id: 'm5', type: 'text', enabled: true, elements: [
          { id: 'eOff', type: 'heading', content: { text: 'x' }, enabled: false },
          { id: 'eOn', type: 'heading', content: { text: 'y' } }] },
      { id: 'm6', type: 'text', enabled: true, style: null, responsive: null,
        elements: [{ id: 'm6h', type: 'heading', content: { text: 'z' }, style: null }] }
    ];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => ({
      sections: document.querySelectorAll('.pb-section').length,
      m1Inner: document.querySelector('[data-sec="m1"] .pb-inner').children.length,
      m2Inner: document.querySelector('[data-sec="m2"] .pb-inner').children.length,
      heading: !!document.querySelector('[data-el="mh"]'),
      headingText: (document.querySelector('[data-el="mh"]') || {}).textContent,
      text: !!document.querySelector('[data-el="mt"]'),
      image: !!document.querySelector('[data-el="mi"]'),
      card: !!document.querySelector('[data-el="mc"]'),
      cardKids: document.querySelector('[data-el="mc"]') ?
        document.querySelector('[data-el="mc"]').children.length : -1,
      colsNone: !!document.querySelector('[data-el="mx"]'),
      colsEmpty: !!document.querySelector('[data-el="my"]'),
      noIdRendered: document.querySelectorAll('[data-sec="m3"] .pb-heading').length,
      disabledSection: !!document.querySelector('[data-sec="m4"]'),
      disabledElement: !!document.querySelector('[data-el="eOff"]'),
      enabledElement: !!document.querySelector('[data-el="eOn"]'),
      nullStyle: !!document.querySelector('[data-el="m6h"]'),
      nullStyleColor: getComputedStyle(document.querySelector('[data-el="m6h"]')).color
    }));
    check('a section with no elements still renders', r.m1Inner === 0 && r.sections === 5, [r.m1Inner, r.sections]);
    check('an empty element list renders nothing inside', r.m2Inner === 0, r.m2Inner);
    check('a heading with no content renders empty rather than throwing',
      r.heading && r.headingText === '', [r.heading, r.headingText]);
    check('a text element with null content renders', r.text);
    check('an image with no source is skipped', r.image === false);
    check('an empty card renders with nothing inside', r.card && r.cardKids === 0, [r.card, r.cardKids]);
    check('a columns element with no columns is skipped', r.colsNone === false);
    check('a columns element with an empty column list is skipped', r.colsEmpty === false);
    check('an element with no id still renders', r.noIdRendered >= 2, r.noIdRendered);
    check('a null element in the list is skipped without throwing', r.sections === 5);
    check('a disabled section does not render', r.disabledSection === false);
    check('a disabled element does not render', r.disabledElement === false);
    check('its enabled sibling still renders', r.enabledElement);
    check('a null style object is handled', r.nullStyle);
    check('and the element falls back to inheriting', r.nullStyleColor === 'rgb(34, 34, 34)', r.nullStyleColor);
    check('no page errors on malformed data', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     12. DRAFT / PUBLISH API
     ================================================================ */
  console.log('\n===== DRAFT / PUBLISH API =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const go = () => p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await go();
    const SECT = [sec('a1', 'hero', { elements: [el('a1h', 'heading', { text: 'Hero heading' })] }),
                  sec('a2', 'text', { elements: [el('a2h', 'heading', { text: 'Second' })] })];

    check('the builder offers exactly the mounted pages',
      JSON.stringify(await p.evaluate(() => CMS.sections.pages())) ===
      JSON.stringify(['about', 'contact', 'privacy-policy', 'responsible-gaming']),
      await p.evaluate(() => CMS.sections.pages()));

    let r = await p.evaluate((S) => {
      CMS.sections.saveDraft('about', S);
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS'));
      return { drafted: !!(raw.builderDrafts || {}).about,
               liveBlock: !!(raw.pages.about || {}).builder,
               live: CMS.sections.live('about').length,
               published: CMS.sections.published('about'),
               status: CMS.sections.status('about') };
    }, SECT);
    check('a draft is stored under builderDrafts', r.drafted);
    check('saving a draft does not create the live block', r.liveBlock === false);
    check('nothing is live', r.live === 0 && r.published === null, [r.live, r.published]);
    check('status reports not-live and dirty', r.status.live === false && r.status.dirty === true, r.status);

    await go();
    check('after a reload the page still renders nothing',
      (await p.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);
    check('the draft survived the reload',
      (await p.evaluate(() => CMS.sections.draft('about').sections.length)) === 2);

    r = await p.evaluate(() => {
      CMS.sections.publish('about');
      const blk = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder;
      return { status: blk.status, schema: blk.schemaVersion, stamped: blk.updatedAt,
               live: CMS.sections.live('about').length, dirty: CMS.sections.dirty('about') };
    });
    check('publish writes status published', r.status === 'published', r.status);
    /* V2 bumped PB_SCHEMA to 2; new writes stamp it. Blocks already published
       under V1 keep their 1 until someone edits that page — covered by
       test_pagebuilder_v2.js and test_pagebuilder_compat.js. */
    check('publish stamps the current schema version', r.schema === 2, r.schema);
    check('publish stamps a date', /^\d{4}-\d{2}-\d{2}$/.test(r.stamped || ''), r.stamped);
    check('the sections are now live', r.live === 2, r.live);
    check('the draft no longer differs from live', r.dirty === false);
    await go();
    check('a visitor now sees both sections',
      (await p.evaluate(() => document.querySelectorAll('.pb-section').length)) === 2);

    r = await p.evaluate(() => {
      const d = CMS.clone(CMS.sections.draft('about').sections);
      d[0].elements[0].content.text = 'Edited later';
      CMS.sections.saveDraft('about', d);
      return { live: CMS.sections.live('about')[0].elements[0].content.text,
               draft: CMS.sections.draft('about').sections[0].elements[0].content.text,
               dirty: CMS.sections.dirty('about') };
    });
    check('editing after publishing leaves the live copy alone', r.live === 'Hero heading', r.live);
    check('the edit sits in the draft', r.draft === 'Edited later', r.draft);
    check('the dirty flag is raised', r.dirty === true);
    await go();
    check('the visitor still sees the published text',
      (await p.evaluate(() => document.querySelector('[data-el="a1h"]').textContent)) === 'Hero heading');

    r = await p.evaluate(() => {
      CMS.sections.discard('about');
      return { draft: CMS.sections.draft('about').sections[0].elements[0].content.text,
               dirty: CMS.sections.dirty('about'),
               stored: !!(JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts || {}).about };
    });
    check('discard returns the draft to what is live', r.draft === 'Hero heading', r.draft);
    check('discard clears the dirty flag', r.dirty === false);
    check('discard removes the stored draft', r.stored === false);

    r = await p.evaluate(() => {
      CMS.sections.unpublish('about');
      const blk = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder;
      return { status: blk.status, kept: blk.sections.length,
               live: CMS.sections.live('about').length,
               draft: CMS.sections.draft('about').sections.length };
    });
    check('unpublish flips the stored status back to draft', r.status === 'draft', r.status);
    check('unpublish keeps the work rather than deleting it', r.kept === 2, r.kept);
    check('nothing is live after unpublishing', r.live === 0, r.live);
    check('the draft still holds the sections', r.draft === 2, r.draft);
    await go();
    const back = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section').length,
      h2: document.querySelectorAll('.info-body h2').length,
      css: (document.getElementById('cmsBuilder') || {}).textContent || '' }));
    check('the page is back to its shipped content', back.pb === 0 && back.h2 >= 3, back);
    check('the builder CSS is cleared', back.css === '', back.css.slice(0, 40));
    check('and it can be published again',
      (await p.evaluate(() => { CMS.sections.publish('about'); return CMS.sections.live('about').length; })) === 2);

    /* CHANGED BEHAVIOUR, deliberately. Publishing an empty section list
       used to be indistinguishable from having no builder at all, so the
       shipped copy came back. On a builder-managed page that made an
       empty canvas impossible: clearing every section and publishing
       silently restored the old content. A published block now means the
       builder owns the body, empty or not. */
    check('an empty published block is an empty canvas, not an absent builder',
      await p.evaluate(() => {
        CMS.sections.saveDraft('about', []);
        CMS.sections.publish('about');
        const live = CMS.sections.published('about');
        return Array.isArray(live) && live.length === 0 &&
               CMS.sections.bodyManaged('about') === true;
      }));
    await go();
    check('and the shipped copy stays hidden rather than coming back',
      await p.evaluate(() => {
        const body = document.querySelector('[data-cms-html="pages.about.body"]');
        return !!body && body.hidden === true &&
               document.querySelectorAll('.pb-section').length === 0;
      }));
    check('but the copy is still in the document, only hidden',
      await p.evaluate(() => {
        const body = document.querySelector('[data-cms-html="pages.about.body"]');
        return body.querySelectorAll('h2').length >= 3;
      }));
    check('and the page keeps its own h1 above the canvas',
      (await p.evaluate(() => document.querySelectorAll('h1').length)) === 1);
    check('unpublishing brings the shipped copy back',
      await p.evaluate(async () => {
        CMS.sections.unpublish('about');
        CMS.apply();
        const body = document.querySelector('[data-cms-html="pages.about.body"]');
        return body.hidden === false && body.querySelectorAll('h2').length >= 3;
      }));

    /* Still an exact list, not a loosened one: the builder is allowed three
       top-level keys and no more. builderDrafts is this device's working
       copy, builderLibrary its reusable-section library, builderRecovery
       the one snapshot per page taken before a draft is replaced. All three
       are device-local and all three are stripped from the publish
       payload, which is asserted separately in each milestone's suite. */
    check('the builder owns exactly three top-level keys, all device-local',
      JSON.stringify(await p.evaluate(() =>
        Object.keys(CMS.data()).filter(k => /^builder/.test(k)).sort())) ===
      JSON.stringify(['builderDrafts', 'builderLibrary', 'builderRecovery']));
    check('the other panels’ config is untouched',
      await p.evaluate(() => typeof CMS.data().colors === 'object' && typeof CMS.data().sportsTable === 'object'));
    check('each page keeps its own builder data',
      await p.evaluate(() => {
        CMS.sections.saveDraft('contact', [{ id: 'cOnly', type: 'text', enabled: true, elements: [] }]);
        return CMS.sections.draft('contact').sections.length === 1 &&
               CMS.sections.draft('responsible-gaming').sections.length === 0;
      }));
    await ctx.close();
  }

  /* ================================================================
     13. ADMIN PANEL
     ================================================================ */
  console.log('\n===== ADMIN PANEL =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const errs = [];
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);

    const panels = await p.$$eval('.adm-panel', e => e.map(x => x.id));
    check('every pre-existing panel is still there',
      ['themes','branding','colors','typography','text','auth','images','home','seo','pages','sportstable','presets','data','reset']
        .every(x => panels.includes('panel-' + x)), panels);
    check('the Page Builder panel exists', panels.includes('panel-builder'));
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
    check('the panel opens', await p.isVisible('#panel-builder'));
    check('one tab per buildable page',
      JSON.stringify(await p.$$eval('#pbTabs .pagetab', e => e.map(x => x.getAttribute('data-slug')))) ===
      JSON.stringify(['about', 'contact', 'privacy-policy', 'responsible-gaming']),
      await p.$$eval('#pbTabs .pagetab', e => e.map(x => x.getAttribute('data-slug'))));
    check('all seven section types can be added',
      JSON.stringify(await p.$$eval('#pbAdd .pb-addbtn', e => e.map(x => x.getAttribute('data-type')))) ===
      JSON.stringify(['hero','text','image','imageText','cards','columns','banner']));
    check('Publish is disabled with an empty draft', await p.isDisabled('#pbPublish'));
    check('Unpublish is disabled with nothing live', await p.isDisabled('#pbUnpublish'));

    st.posts = 0;
    await p.click('#pbAdd .pb-addbtn[data-type="hero"]'); await p.waitForTimeout(300);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(300);
    check('sections appear in the list', (await p.$$('#pbList .pb-sec')).length === 2);
    check('adding a section publishes nothing', st.posts === 0, st.posts);

    const visitor = await ctx.newPage();
    await visitor.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    check('a visitor sees no sections while the admin drafts',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);

    let ids = await p.$$eval('#pbList .pb-sec', e => e.map(x => x.getAttribute('data-sec-id')));
    await p.click(`#pbList .pb-sec[data-sec-id="${ids[1]}"] [data-act="up"]`); await p.waitForTimeout(300);
    check('a section can be moved up',
      (await p.$$eval('#pbList .pb-sec', e => e.map(x => x.getAttribute('data-sec-id'))))[0] === ids[1]);
    await p.click(`#pbList .pb-sec[data-sec-id="${ids[1]}"] [data-act="dup"]`); await p.waitForTimeout(300);
    const dup = await p.evaluate((id) => {
      const d = CMS.sections.draft('about').sections;
      const i = d.findIndex(s => s.id === id);
      const orig = d[i], copy = d[i + 1];
      const all = d.reduce((a, s) => a.concat(s.elements.map(e => e.id)), []);
      return { n: d.length, uniqSections: new Set(d.map(s => s.id)).size,
               sameContent: JSON.stringify(orig.elements.map(e => e.content)) ===
                            JSON.stringify(copy.elements.map(e => e.content)),
               freshElementIds: orig.elements.every((e, k) => e.id !== copy.elements[k].id),
               allElementIdsUnique: new Set(all).size === all.length };
    }, ids[1]);
    check('duplicate adds a section', dup.n === 3, dup.n);
    check('duplicate keeps the content', dup.sameContent, dup);
    check('duplicate gives the copy a fresh section id', dup.uniqSections === 3, dup);
    check('duplicate re-ids the copied elements too', dup.freshElementIds, dup);
    check('no two elements in the draft share an id', dup.allElementIdsUnique, dup);
    await p.uncheck(`#pbList .pb-sec[data-sec-id="${ids[0]}"] [data-act="enable"]`); await p.waitForTimeout(300);
    check('a section can be switched off',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id).enabled === false, ids[0]));

    st.posts = 0;
    await p.click('#pbSaveDraft'); await p.waitForTimeout(400);
    check('Save draft sends nothing to the server', st.posts === 0, st.posts);
    await visitor.reload({ waitUntil: 'networkidle' });
    check('the live page is still unchanged',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);

    st.posts = 0;
    await p.click('#pbPublish'); await p.waitForTimeout(900);
    check('Publish sends exactly one write', st.posts === 1, st.posts);
    check('the published row carries the sections',
      !!(st.row && st.row.data && st.row.data.pages.about.builder &&
         st.row.data.pages.about.builder.status === 'published'));
    check('the published row carries no admin-only UI state',
      !/__pb|pbView|pbDevice/.test(JSON.stringify(st.row || {})));
    await visitor.reload({ waitUntil: 'networkidle' });
    check('the visitor sees the two enabled sections',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 2);

    st.posts = 0;
    await p.click('#pbUnpublish'); await p.waitForTimeout(900);
    await visitor.reload({ waitUntil: 'networkidle' });
    check('Unpublish returns the page to its shipped content',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);
    check('the draft is kept after unpublishing',
      (await p.evaluate(() => CMS.sections.draft('about').sections.length)) === 3);

    /* ---------------- editors ---------------- */
    console.log('\n===== ELEMENT AND DESIGN EDITORS =====');
    const secId = (await p.$$eval('#pbList .pb-sec', e => e.map(x => x.getAttribute('data-sec-id'))))[0];
    const SEC = `#pbList .pb-sec[data-sec-id="${secId}"]`;
    await p.click(`${SEC} .pb-sec-title`); await p.waitForTimeout(350);
    if (!(await p.isVisible(`${SEC} .pb-sec-body`))) { await p.click(`${SEC} .pb-sec-title`); await p.waitForTimeout(350); }
    check('a section opens on Content / Design / Visibility',
      JSON.stringify(await p.$$eval(`${SEC} .pb-subtab`, e => e.map(x => x.getAttribute('data-view')))) ===
      JSON.stringify(['content', 'design', 'visibility']));
    /* V2 added seven more element types. The V1 six must still be offered,
       still under the same names, and still first, so a page author's muscle
       memory and every test above keep working. */
    const offered = await p.$$eval(`${SEC} > .pb-sec-body > .pb-subbody > .pb-add-el > .pb-addbtn`,
      e => e.map(x => x.getAttribute('data-el-type')));
    check('the six V1 element types are still offered, unchanged and first',
      JSON.stringify(offered.slice(0, 6)) ===
      JSON.stringify(['heading', 'text', 'image', 'button', 'card', 'columns']), offered);

    const TOP = `${SEC} > .pb-sec-body > .pb-subbody`;
    const ADD = `${TOP} > .pb-add-el > .pb-addbtn`;
    await p.fill(`${TOP} > .pb-els > .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`, 'Typed heading');
    await p.waitForTimeout(500);
    check('a content edit lands in the draft',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id)
        .elements[0].content.text === 'Typed heading', secId));
    check('no editor state leaks into the saved draft',
      !/__pb|pbView|pbDevice/.test(await p.evaluate(() => JSON.stringify(CMS.sections.draft('about')))));

    /* the Design tab must offer exactly the controls the renderer honours */
    const lastTop = () => p.$$eval(`${TOP} > .pb-els > .pb-elcard`,
      e => e[e.length - 1].getAttribute('data-el-id'));
    const labelsFor = async (type) => {
      await p.click(`${ADD}[data-el-type="${type}"]`);
      await p.waitForTimeout(400);
      const id = await lastTop();
      const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${id}"]`;
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`);
      await p.waitForTimeout(250);
      const keys = await p.evaluate(t => (CMS.sections.elementStyleKeys || {})[t] || [], type);
      const n = await p.$$eval(`${CARD} > .pb-elcard-body > .pb-details .pb-field`, e => e.length);
      return { id, keys, n };
    };
    for (const t of ['image', 'button', 'card', 'columns']) {
      const info = await labelsFor(t);
      check(t + ' offers exactly the controls the renderer honours (' + info.keys.length + ')',
        info.n === info.keys.length, info);
    }
    check('an image is not offered a font-size control',
      (await p.evaluate(() => (CMS.sections.elementStyleKeys.image || []).indexOf('fontSize'))) === -1);
    check('a columns element is not offered a background control',
      (await p.evaluate(() => (CMS.sections.elementStyleKeys.columns || []).indexOf('bg'))) === -1);
    check('a heading is offered a colour control',
      (await p.evaluate(() => (CMS.sections.elementStyleKeys.heading || []).indexOf('color'))) > -1);

    await p.click(`${ADD}[data-el-type="button"]`); await p.waitForTimeout(400);
    const btnId = await lastTop();
    const BTN = `${TOP} > .pb-els > .pb-elcard[data-el-id="${btnId}"]`;
    await p.fill(`${BTN} .pb-field:has(> span:text-is("Links to")) .pb-in`, 'javascript:alert(1)');
    await p.waitForTimeout(400);
    check('the admin is warned about a refused URL',
      await p.$eval(BTN, e => [...e.querySelectorAll('.pb-warn')].some(x => !x.hidden)));
    await p.fill(`${BTN} .pb-field:has(> span:text-is("Links to")) .pb-in`, 'contact.html');
    await p.waitForTimeout(400);
    check('the warning clears for an allowed URL',
      await p.$eval(BTN, e => [...e.querySelectorAll('.pb-warn')].every(x => x.hidden)));

    await p.click(`${ADD}[data-el-type="image"]`); await p.waitForTimeout(400);
    const img = await lastTop();
    const IMG = `${TOP} > .pb-els > .pb-elcard[data-el-id="${img}"]`;
    /* Milestone B put a picker beside this field, and the label lost the
       "URL" with it: it is now "Image". The field itself is unchanged and
       so is the assertion below. */
    await p.fill(`${IMG} .pb-field:has(> span:text-is("Image")) .pb-in`, 'images/logo.png');
    await p.waitForTimeout(400);
    check('an image without alt text is flagged',
      await p.$eval(IMG, e => { const w = e.querySelector('[data-warn="alt"]'); return !!w && !w.hidden; }));
    await p.fill(`${IMG} .pb-field:has(> span:text-is("Alt text")) .pb-in`, 'Site logo');
    await p.waitForTimeout(400);
    check('the flag clears once alt text is given',
      await p.$eval(IMG, e => { const w = e.querySelector('[data-warn="alt"]'); return !!w && w.hidden; }));

    await p.click(`${SEC} .pb-subtab[data-view="design"]`); await p.waitForTimeout(350);
    check('three breakpoints are offered',
      JSON.stringify(await p.$$eval(`${SEC} .pb-devtab`, e => e.map(x => x.getAttribute('data-device')))) ===
      JSON.stringify(['base', 'tablet', 'mobile']));
    /* Stage 5 puts the controls into collapsible groups, so a test that
       types into one has to open the group first, exactly as a person
       would. The label moved with it: "Padding (px)" is now worded
       "Space inside (px)". */
    const openGroups = async () => {
      await p.$$eval(`${SEC} .pb-group`, gs => gs.forEach(g => { g.open = true; }));
      await p.waitForTimeout(120);
    };
    await openGroups();
    const PAD = `${SEC} .pb-subbody .pb-field:has(> span:text-is("Space inside (px)")) .pb-in`;
    await p.fill(PAD, '64'); await p.waitForTimeout(500);
    check('a desktop value is stored on style',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id).style.padding === '64', secId));
    await p.click(`${SEC} .pb-devtab[data-device="mobile"]`); await p.waitForTimeout(350);
    await openGroups();
    check('the mobile box starts empty rather than inheriting', (await p.inputValue(PAD)) === '');
    await p.fill(PAD, '18'); await p.waitForTimeout(500);
    check('a mobile value is stored as an override, leaving desktop alone',
      await p.evaluate(id => { const s = CMS.sections.draft('about').sections.find(x => x.id === id);
        return s.responsive.mobile.padding === '18' && s.style.padding === '64'; }, secId));
    await p.click(`${SEC} [data-act="clear-device"]`); await p.waitForTimeout(500);
    await openGroups();
    check('clearing a breakpoint touches only that breakpoint',
      await p.evaluate(id => { const s = CMS.sections.draft('about').sections.find(x => x.id === id);
        return JSON.stringify(s.responsive.mobile) === '{}' && s.style.padding === '64'; }, secId));

    await p.click(`${SEC} .pb-subtab[data-view="visibility"]`); await p.waitForTimeout(350);
    await p.uncheck(`${SEC} [data-vis="mobile"]`); await p.waitForTimeout(500);
    check('a visibility choice is stored',
      await p.evaluate(id => CMS.sections.draft('about').sections.find(s => s.id === id).visibility.mobile === false, secId));

    /* ---------------- draft durability ---------------- */
    console.log('\n===== DRAFT DURABILITY =====');
    await p.click(`${SEC} .pb-subtab[data-view="content"]`); await p.waitForTimeout(350);
    await p.fill(`${TOP} > .pb-els > .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`, 'Before switching');
    await p.click('#pbTabs .pagetab[data-slug="contact"]'); await p.waitForTimeout(600);
    const afterSwitch = await p.evaluate(id => {
      const s = CMS.sections.draft('about').sections.find(x => x.id === id);
      return s ? s.elements.map(e => e.type + ':' + JSON.stringify((e.content || {}).text)) : null;
    }, secId);
    check('switching page flushes the pending edit rather than losing it',
      !!afterSwitch && afterSwitch[0] === 'heading:"Before switching"', afterSwitch);
    await p.click('#pbTabs .pagetab[data-slug="about"]'); await p.waitForTimeout(600);
    check('switching back restores the about draft',
      (await p.$$('#pbList .pb-sec')).length === 3);

    const beforeReload = await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections));
    await p.reload({ waitUntil: 'networkidle' });
    /* the token lives in sessionStorage, so a reload usually stays signed in */
    if (await p.isVisible('#authGate')) {
      await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    }
    await p.waitForTimeout(500);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(600);
    check('the draft survives an admin reload',
      (await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))) === beforeReload);
    check('and the section list is rebuilt from it',
      (await p.$$('#pbList .pb-sec')).length === 3);

    /* ---------------- preview ---------------- */
    console.log('\n===== LIVE PREVIEW =====');
    check('the preview loads the real page',
      /about\.html$/.test(await p.getAttribute('#pbFrame', 'data-page') || ''),
      await p.getAttribute('#pbFrame', 'data-page'));
    let fr = p.frame({ url: u => /about\.html/.test(u) });
    check('the preview frame is the site page', !!fr && (await fr.$('.info-body')) !== null);
    check('the preview shows the unpublished draft', (await fr.$$('.pb-section')).length > 0);
    check('a visitor still sees nothing',
      (await visitor.evaluate(() => document.querySelectorAll('.pb-section').length)) === 0);
    check('the preview pill says Draft', (await p.textContent('#pbPrevTag')) === 'Draft');
    check('three device widths are offered',
      JSON.stringify(await p.$$eval('#pbDevices .pb-devtab', e => e.map(x => x.getAttribute('data-viewport')))) ===
      JSON.stringify(['desktop', 'tablet', 'mobile']));
    for (const [dev, w] of [['mobile', 390], ['tablet', 900], ['desktop', 1280]]) {
      await p.click(`#pbDevices .pb-devtab[data-viewport="${dev}"]`); await p.waitForTimeout(400);
      check(dev + ' lays the page out at ' + w + 'px',
        await p.evaluate(() => document.getElementById('pbFrame').contentWindow.innerWidth) === w);
    }
    check('a wide viewport is scaled down to fit the column',
      await p.evaluate(() => Math.round(document.getElementById('pbFrame').getBoundingClientRect().width)) < 1280);

    const SEC2 = `#pbList .pb-sec[data-sec-id="${secId}"]`;
    await p.click(`${SEC2} .pb-sec-title`); await p.waitForTimeout(350);
    if (!(await p.isVisible(`${SEC2} .pb-sec-body`))) { await p.click(`${SEC2} .pb-sec-title`); await p.waitForTimeout(350); }
    const TOP2 = `${SEC2} > .pb-sec-body > .pb-subbody`;
    await p.fill(`${TOP2} > .pb-els > .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`, 'Preview updates live');
    await p.waitForTimeout(700);
    fr = p.frame({ url: u => /about\.html/.test(u) });
    check('typing updates the preview',
      (await fr.textContent('.pb-section')).includes('Preview updates live'));
    check('and the preview survives the draft autosave',
      await fr.evaluate(() => (document.getElementById('cmsBuilder') || {}).textContent !== ''));

    /* a design change must be visible in the preview, as computed style */
    await p.click(`${TOP2} > .pb-els > .pb-elcard > .pb-elcard-body > .pb-details > summary`).catch(() => {});
    await p.waitForTimeout(250);
    await p.$$eval(`${TOP2} > .pb-els > .pb-elcard > .pb-elcard-body > .pb-details .pb-group`,
      gs => gs.forEach(g => { g.open = true; }));
    await p.waitForTimeout(120);
    /* Stage 6 made every colour control "a global role or a custom value",
       so reaching the colour box means choosing Custom first, as a person
       would. The assertion below is unchanged. */
    const colorField = `${TOP2} > .pb-els > .pb-elcard > .pb-elcard-body > .pb-details .pb-field:has(> span:text-is("Text colour"))`;
    const colorIn = `${colorField} [data-part="value"] input[type="text"]`;
    if (await p.$(colorField)) {
      await p.selectOption(`${colorField} [data-part="role"]`, 'custom');
      await p.waitForTimeout(250);
      await p.fill(colorIn, '#ff0055'); await p.waitForTimeout(700);
      fr = p.frame({ url: u => /about\.html/.test(u) });
      check('a colour set in the admin is the computed colour in the preview',
        await fr.evaluate(() => {
          const h = document.querySelector('.pb-section .pb-heading');
          return h ? getComputedStyle(h).color === 'rgb(255, 0, 85)' : false;
        }));
    } else {
      check('a colour set in the admin is the computed colour in the preview', false, 'colour field not found');
    }
    check('the admin ran without console errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     14. A REMOTE PULL MUST NOT ROLL BACK AN UNPUBLISHED DRAFT
     Every page in the browser pulls the published row on load and writes
     it back to localStorage. The row is at best as new as the last
     publish, so without protection, opening the site in a second tab
     threw away whatever the admin had not published yet.
     ================================================================ */
  console.log('\n===== A REMOTE PULL MUST NOT ROLL BACK A DRAFT =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const admin = await ctx.newPage();
    await admin.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await admin.evaluate(() => CMS.remote.signIn('a@b.c', 'x'));

    /* publish one thing, so the server row holds a snapshot */
    await admin.evaluate(() => {
      CMS.sections.saveDraft('about', [{ id: 'p1', type: 'text', enabled: true,
        elements: [{ id: 'p1h', type: 'heading', content: { text: 'published' } }] }]);
      CMS.sections.publish('about');
      return CMS.remote.publish();
    });
    await admin.waitForTimeout(300);
    check('the row was written', st.posts === 1, st.posts);
    check('the published row carries no drafts',
      !!st.row && !!st.row.data && st.row.data.builderDrafts === undefined,
      st.row && st.row.data && Object.keys(st.row.data));

    /* now edit further, without publishing */
    await admin.evaluate(() => {
      const d = CMS.clone(CMS.sections.draft('about').sections);
      d[0].elements[0].content.text = 'unpublished edit';
      d.push({ id: 'p2', type: 'text', enabled: true, elements: [] });
      CMS.sections.saveDraft('about', d);
    });
    check('the draft holds the unpublished edit',
      (await admin.evaluate(() => CMS.sections.draft('about').sections[0].elements[0].content.text))
        === 'unpublished edit');

    /* a second tab loads the public site, pulls the row and writes it back */
    const other = await ctx.newPage();
    await other.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
    await other.waitForTimeout(400);
    check('the second tab pulled the published row',
      (await other.evaluate(() => CMS.sections.live('about').length)) === 1);
    check('the second tab still sees the published text, not the draft',
      (await other.evaluate(() => CMS.sections.live('about')[0].elements[0].content.text)) === 'published');

    const kept = await admin.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS'));
      return { count: ((raw.builderDrafts || {}).about || {}).sections.length,
               text: ((raw.builderDrafts || {}).about || {}).sections[0].elements[0].content.text };
    });
    check('the unpublished draft survived the other tab\u2019s pull', kept.count === 2, kept);
    check('and still holds the edit', kept.text === 'unpublished edit', kept);

    /* the admin page itself reloading must not lose it either */
    await admin.reload({ waitUntil: 'networkidle' });
    await admin.waitForTimeout(400);
    check('and it survives a reload of the page that owns it',
      (await admin.evaluate(() => CMS.sections.draft('about').sections.length)) === 2);
    check('while the live page still shows only what was published',
      (await admin.evaluate(() => document.querySelectorAll('.pb-section').length)) === 1);
    await ctx.close();
  }

  /* ================================================================
     15. THE REST OF THE SITE IS UNAFFECTED BY A PUBLISHED BUILDER
     ================================================================ */
  console.log('\n===== A PUBLISHED BUILDER CHANGES ONLY ITS OWN PAGE =====');
  {
    const SECT = [sec('only', 'hero', {
      style: { bg: '#ff0000', color: '#00ff00', padding: '80' },
      elements: [el('onlyH', 'heading', { text: 'only' }, { color: '#0000ff', fontSize: '55' })] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    check('the page that opted in renders the section',
      (await p.evaluate(() => document.querySelectorAll('.pb-section').length)) === 1);

    for (const f of ['contact', 'responsible-gaming']) {
      await p.goto(`${BASE}/${f}.html`, { waitUntil: 'networkidle' });
      const o = await p.evaluate(() => ({
        pb: document.querySelectorAll('.pb-section').length,
        css: (document.getElementById('cmsBuilder') || {}).textContent || '',
        h2: document.querySelectorAll('.info-body h2').length,
        h2color: getComputedStyle(document.querySelector('.info-body h2')).color,
        articlePad: getComputedStyle(document.querySelector('.info-article')).padding
      }));
      check(f + ' renders no section of another page\u2019s builder', o.pb === 0, o.pb);
      check(f + ' emits no builder CSS', o.css === '', o.css.slice(0, 40));
      check(f + ' keeps its own headings and their colour',
        o.h2 >= 1 && o.h2color === 'rgb(0, 136, 204)', [o.h2, o.h2color]);
    }

    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const home = await p.evaluate(() => ({
      pb: document.querySelectorAll('.pb-section, .pb-el').length,
      css: !!document.getElementById('cmsBuilder'),
      nav: document.querySelectorAll('.nav-link').length,
      table: document.querySelectorAll('.event-row, .sports-row, table').length > 0 ||
             document.querySelectorAll('[class*="event"]').length > 0
    }));
    check('the homepage renders nothing from the builder', home.pb === 0, home.pb);
    check('the homepage emits no builder CSS', home.css === false);
    check('the homepage navigation is intact', home.nav > 0, home.nav);
    check('no page errors on the untouched pages', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     16. SEO IS UNTOUCHED WHILE A BUILDER IS PUBLISHED
     ================================================================ */
  console.log('\n===== SEO SURVIVES A PUBLISHED BUILDER =====');
  {
    const SECT = [sec('seo1', 'hero', { elements: [
      el('seoH1', 'heading', { text: 'Builder H1', level: 'h1' }),
      el('seoH2', 'heading', { text: 'Builder H2', level: 'h2' })] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const m = n => { const e = document.querySelector(`meta[name="${n}"]`); return e ? e.getAttribute('content') : null; };
      const og = n => { const e = document.querySelector(`meta[property="og:${n}"]`); return e ? e.getAttribute('content') : null; };
      const ld = id => { const e = document.getElementById(id); return e ? e.textContent.trim().length : 0; };
      return {
        title: document.title,
        desc: m('description'),
        robots: m('robots'),
        canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
        ogTitle: og('title'), ogUrl: og('url'),
        twitter: m('twitter:card'),
        staticH1: document.querySelector('.info-article > h1') ?
          document.querySelector('.info-article > h1').textContent : null,
        h1count: document.querySelectorAll('h1').length,
        ldPage: ld('ldPage'), ldCrumb: ld('ldBreadcrumb'),
        builderH1: !!document.querySelector('[data-el="seoH1"]'),
        builderH1Tag: (document.querySelector('[data-el="seoH1"]') || {}).tagName
      };
    });
    check('the page title is intact', !!r.title && r.title.length > 5, r.title);
    check('the meta description is intact', !!r.desc && r.desc.length > 20, r.desc);
    check('robots is intact', !!r.robots, r.robots);
    check('the canonical link is intact', !!r.canonical && /about/.test(r.canonical), r.canonical);
    check('og:title is intact', !!r.ogTitle, r.ogTitle);
    check('og:url is intact', !!r.ogUrl, r.ogUrl);
    check('the twitter card is intact', !!r.twitter, r.twitter);
    check('the page\u2019s own H1 is still there', !!r.staticH1, r.staticH1);
    check('WebPage JSON-LD is still written', r.ldPage > 10, r.ldPage);
    check('Breadcrumb JSON-LD is still written', r.ldCrumb > 10, r.ldCrumb);
    check('a builder heading can be an h1 if the author chooses',
      r.builderH1 && r.builderH1Tag === 'H1', [r.builderH1, r.builderH1Tag]);
    check('which the author should weigh against the page H1 (two h1s here)',
      r.h1count === 2, r.h1count);
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const home = await p.evaluate(() => {
      const ld = id => { const e = document.getElementById(id); return e ? e.textContent.trim().length : 0; };
      return { org: ld('ldOrganization'), site: ld('ldWebSite'),
               title: document.title,
               desc: (document.querySelector('meta[name="description"]') || {}).content || null };
    });
    check('the homepage Organization JSON-LD is untouched', home.org > 10, home.org);
    check('the homepage WebSite JSON-LD is untouched', home.site > 10, home.site);
    check('the homepage title is untouched', !!home.title && home.title.length > 5, home.title);
    check('the homepage description is untouched', !!home.desc && home.desc.length > 20, home.desc);
    check('no page errors with SEO plus builder', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  /* ================================================================
     17. ALIGNMENT AND GENERATED-CSS HYGIENE
     ================================================================ */
  console.log('\n===== ALIGNMENT AND GENERATED CSS =====');
  {
    const SECT = [sec('al', 'text', {
      style: { align: 'center' },
      elements: [
        el('alH', 'heading', { text: 'h' }, { align: 'right' }),
        el('alB', 'button', { text: 'b', href: '#' }, { align: 'center' }),
        el('alB2', 'button', { text: 'b2', href: '#' })
      ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const css = (document.getElementById('cmsBuilder') || {}).textContent || '';
      const rules = css.split('}').filter(Boolean).length;
      return {
        secAlign: g('[data-sec="al"]').textAlign,
        hAlign: g('[data-el="alH"]').textAlign,
        bSelf: g('[data-el="alB"]').alignSelf,
        b2Self: g('[data-el="alB2"]').alignSelf,
        bWidth: g('[data-el="alB"]').width,
        cssLen: css.length, rules,
        dupes: (() => { const seen = {}; let d = 0;
          css.replace(/([^{}]+)\{([^}]*)\}/g, (m, sel, body) => {
            const k = sel.trim() + '|' + body.trim();
            if (seen[k]) d++; seen[k] = 1; return m; }); return d; })(),
        usesOldNamespace: /--pb-[a-z]/.test(css),
        styleTags: document.querySelectorAll('style[id="cmsBuilder"]').length
      };
    });
    check('a section alignment applies to the section', r.secAlign === 'center', r.secAlign);
    check('an element alignment overrides the section for that element',
      r.hAlign === 'right', r.hAlign);
    check('a button alignment becomes box alignment', r.bSelf === 'center', r.bSelf);
    check('an unaligned button keeps the default box alignment',
      r.b2Self === 'flex-start', r.b2Self);
    check('a button does not stretch to its container', r.bWidth !== '100%', r.bWidth);
    check('the generated CSS holds no duplicate rules', r.dupes === 0, r.dupes);
    check('the generated CSS stays small for a small page', r.cssLen < 2000, r.cssLen);
    check('only one generated style tag exists', r.styleTags === 1, r.styleTags);
    check('the old shared --pb-* namespace is gone', r.usesOldNamespace === false);
    check('no page errors on alignment', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
