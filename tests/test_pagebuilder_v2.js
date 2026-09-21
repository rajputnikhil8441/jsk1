/* Page Builder V2.
   Feature tests for everything V2 adds. V1 behaviour is guarded separately by
   test_pagebuilder_compat.js (a frozen payload and the render it produced
   before V2 existed) and by test_pagebuilder.js (the V1 feature suite); both
   must keep passing untouched.

   Style questions are asserted on computed style in a real browser, never on
   the generated CSS text alone: a control that emits a property but loses the
   cascade looks fine in the CSS and does nothing on the page. */
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

/* Opens about.html with `block` stored verbatim as the published builder
   block, so a test can hand over any schema shape it likes. */
/* Publishes `sections` on about.html and opens it. */
async function publishedPage(b, sections, width) {
  return pageWith(b, { schemaVersion: 2, status: 'published', sections: sections }, width);
}

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

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     SCHEMA VERSIONING
     ================================================================ */
  console.log('\n===== SCHEMA VERSION IS A MARKER, NOT A GATE =====');
  {
    const V1BLOCK = { schemaVersion: 1, status: 'published', updatedAt: '2026-09-20',
      sections: [sec('s1', 'text', { elements: [el('e1', 'heading', { text: 'v1 content' }, { color: '#ff0000' })] })] };
    const { ctx, p, errs } = await pageWith(b, V1BLOCK);

    check('CMS reports schema 2', (await p.evaluate(() => CMS.sections.schema)) === 2,
      await p.evaluate(() => CMS.sections.schema));

    const r = await p.evaluate(() => ({
      rendered: document.querySelectorAll('.pb-section').length,
      colour: getComputedStyle(document.querySelector('[data-el="e1"]')).color,
      storedVersion: JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion
    }));
    check('a schemaVersion 1 block still renders', r.rendered === 1, r.rendered);
    check('and its styling still applies', r.colour === 'rgb(255, 0, 0)', r.colour);
    check('reading it does not rewrite the stored version', r.storedVersion === 1, r.storedVersion);

    /* tolerance in both directions */
    const tol = await p.evaluate(() => {
      const put = (blk) => {
        const raw = JSON.parse(localStorage.getItem('whiteLabelCMS'));
        raw.pages.about.builder = blk;
        localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
        CMS.reload();
        return (CMS.sections.published('about') || []).length;
      };
      const base = { status: 'published',
        sections: [{ id: 's1', type: 'text', enabled: true,
          elements: [{ id: 'e1', type: 'heading', content: { text: 'x' } }] }] };
      return {
        noVersion: put(Object.assign({}, base)),
        v1: put(Object.assign({ schemaVersion: 1 }, base)),
        v2: put(Object.assign({ schemaVersion: 2 }, base)),
        future: put(Object.assign({ schemaVersion: 99 }, base)),
        garbage: put(Object.assign({ schemaVersion: 'nonsense' }, base))
      };
    });
    check('a block with no schemaVersion renders', tol.noVersion === 1, tol.noVersion);
    check('a schemaVersion 1 block renders', tol.v1 === 1, tol.v1);
    check('a schemaVersion 2 block renders', tol.v2 === 1, tol.v2);
    check('a block from a FUTURE schema still renders', tol.future === 1, tol.future);
    check('a block with a nonsense version still renders', tol.garbage === 1, tol.garbage);

    const so = await p.evaluate(() => ({
      absent: CMS.sections.schemaOf({}),
      zero: CMS.sections.schemaOf({ schemaVersion: 0 }),
      neg: CMS.sections.schemaOf({ schemaVersion: -3 }),
      str: CMS.sections.schemaOf({ schemaVersion: '2' }),
      three: CMS.sections.schemaOf({ schemaVersion: 3 }),
      nul: CMS.sections.schemaOf(null)
    }));
    check('schemaOf treats a missing version as 1', so.absent === 1, so.absent);
    check('schemaOf treats 0 and negatives as 1', so.zero === 1 && so.neg === 1, so);
    check('schemaOf treats a string version as 1', so.str === 1, so.str);
    check('schemaOf passes a real newer version through', so.three === 3, so.three);
    check('schemaOf survives null', so.nul === 1, so.nul);

    const up = await p.evaluate(() => {
      const input = [{ id: 's1', type: 'text', enabled: true,
        elements: [{ id: 'e1', type: 'heading', content: { text: 'x' }, style: { color: '#123456' } }] }];
      const before = JSON.stringify(input);
      const out1 = CMS.sections.upgrade(input, 1);
      const out2 = CMS.sections.upgrade(input, 2);
      return {
        identical: JSON.stringify(out1) === before,
        notMutated: JSON.stringify(input) === before,
        sameRefFrom1: out1 === input,
        sameRefFrom2: out2 === input,
        badInput: CMS.sections.upgrade(null, 1),
        stringInput: CMS.sections.upgrade('nope', 1)
      };
    });
    check('upgrading V1 sections changes nothing yet', up.identical, up);
    check('upgrading does not mutate its input', up.notMutated, up);
    check('upgrading already-current data costs no copy', up.sameRefFrom2, up);
    check('the 1->2 step is identity, so no copy there either', up.sameRefFrom1, up);
    check('upgrade survives a non-array', up.badInput === null && up.stringInput === 'nope', up);
    check('no page errors across schema handling', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== NEW WRITES STAMP THE CURRENT SCHEMA =====');
  {
    const { ctx, p, errs } = await pageWith(b, { schemaVersion: 1, status: 'published',
      sections: [sec('s1', 'text', { elements: [el('e1', 'heading', { text: 'old' })] })] });
    const r = await p.evaluate(() => {
      const out = {};
      CMS.sections.saveDraft('about', [{ id: 'n1', type: 'text', enabled: true, elements: [] }]);
      out.draftStamp = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts.about.schemaVersion;
      out.publishedStillOld = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion;
      CMS.sections.publish('about');
      out.publishStamp = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion;
      out.draftBlockVersion = CMS.sections.draft('about').schemaVersion;
      return out;
    });
    check('saving a draft stamps schema 2', r.draftStamp === 2, r.draftStamp);
    check('a draft save leaves the published version alone', r.publishedStillOld === 1, r.publishedStillOld);
    check('publishing stamps schema 2', r.publishStamp === 2, r.publishStamp);
    check('the working copy reports the current schema', r.draftBlockVersion === 2, r.draftBlockVersion);
    check('no page errors while stamping', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }


  /* ================================================================
     V2 ELEMENTS — each control is checked as computed style, because a
     control that emits CSS but loses the cascade looks right in the
     generated text and does nothing on the page.
     ================================================================ */
  /* The bug this catches: a style key can be allow-listed for an element in
     js/cms.js while js/admin-builder.js has no field spec for it, so the
     Design tab silently shows nothing. That happened during V2 with the
     three divider line controls and was invisible until the admin was
     driven by hand. */
  console.log('\n===== EVERY ALLOW-LISTED CONTROL IS ACTUALLY OFFERED =====');
  {
    const { ctx, p } = await publishedPage(b, [sec('x', 'text')]);
    const r = await p.evaluate(() => {
      const keys = CMS.sections.elementStyleKeys || {};
      const all = new Set();
      Object.keys(keys).forEach(t => (keys[t] || []).forEach(k => all.add(k)));
      const tokens = CMS.sections.elementTokens || {};
      return { allowed: [...all].sort(), tokens: Object.keys(tokens).sort(),
               types: Object.keys(keys).sort() };
    });
    check('every element type has an allow-list',
      r.types.length === 13, r.types);
    const noToken = r.allowed.filter(k => r.tokens.indexOf(k) === -1);
    check('every allow-listed key has a style token behind it',
      noToken.length === 0, noToken);
    await ctx.close();
  }

  console.log('\n===== V2 ELEMENTS RENDER =====');
  {
    const SECT = [sec('v2', 'text', { elements: [
      el('e_div', 'divider', {}, { lineWidth: '4', lineStyle: 'dashed', lineColor: '#ff0000', maxWidth: '200' }),
      el('e_sp', 'spacer', {}, { height: '90' }),
      el('e_ic', 'icon', { icon: 'star', label: 'Top rated' }, { color: '#00aa00', fontSize: '48' }),
      el('e_icl', 'icon', { icon: 'phone', href: 'contact.html', label: 'Call us', newTab: true }, { fontSize: '30' }),
      el('e_nt', 'notice', { text: 'Heads up', variant: 'warning', icon: 'warning',
                             linkText: 'Read more', href: 'about.html' }, { radius: '11' }),
      el('e_fb', 'featureBox', { icon: 'bolt', title: 'Fast', titleLevel: 'h4',
                                 text: 'Line one\nLine two', linkText: 'Learn', href: 'about.html' },
         { gap: '18', color: '#123456' }),
      el('e_faq', 'faq', { single: false, items: [
        { question: 'First question', answer: 'First answer', open: true },
        { question: 'Second question', answer: 'Second answer' },
        { question: '', answer: 'no question so dropped' }
      ] }, { fontSize: '17' }),
      el('e_soc', 'socialLinks', { items: [
        { platform: 'whatsapp', url: 'https://wa.me/123' },
        { platform: 'telegram', url: 'https://t.me/x' },
        { platform: 'email', url: 'mailto:a@b.c' }
      ] }, { fontSize: '26', gap: '20', color: '#ff00ff' })
    ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      const q = s => document.querySelector(s);
      const div = g('[data-el="e_div"]'), sp = g('[data-el="e_sp"]'), ic = g('[data-el="e_ic"]'),
            icl = g('[data-el="e_icl"]'), nt = g('[data-el="e_nt"]'), fb = g('[data-el="e_fb"]'),
            faq = g('[data-el="e_faq"]'), soc = g('[data-el="e_soc"]');
      return {
        divider: { tag: q('[data-el="e_div"]').tagName, w: div.borderTopWidth, st: div.borderTopStyle,
                   c: div.borderTopColor, width: div.width },
        spacer: { h: sp.height, tag: q('[data-el="e_sp"]').tagName, hidden: q('[data-el="e_sp"]').getAttribute('aria-hidden') },
        icon: { colour: ic.color, size: ic.fontSize, tag: q('[data-el="e_ic"]').tagName,
                role: q('[data-el="e_ic"]').getAttribute('role'),
                label: q('[data-el="e_ic"]').getAttribute('aria-label'),
                glyph: q('[data-el="e_ic"] .pb-icon-glyph').className,
                glyphHidden: q('[data-el="e_ic"] .pb-icon-glyph').getAttribute('aria-hidden'),
                glyphSize: getComputedStyle(q('[data-el="e_ic"] .pb-icon-glyph')).fontSize },
        iconLink: { tag: q('[data-el="e_icl"]').tagName, href: q('[data-el="e_icl"]').getAttribute('href'),
                    target: q('[data-el="e_icl"]').getAttribute('target'),
                    rel: q('[data-el="e_icl"]').getAttribute('rel'),
                    label: q('[data-el="e_icl"]').getAttribute('aria-label'), size: icl.fontSize },
        notice: { cls: q('[data-el="e_nt"]').className, role: q('[data-el="e_nt"]').getAttribute('role'),
                  bg: nt.backgroundColor, radius: nt.borderTopLeftRadius,
                  text: q('[data-el="e_nt"] .pb-notice-text').textContent,
                  hasIcon: !!q('[data-el="e_nt"] .pb-notice-icon'),
                  link: q('[data-el="e_nt"] .pb-notice-link').getAttribute('href') },
        feature: { gap: fb.gap, colour: fb.color,
                   titleTag: q('[data-el="e_fb"] .pb-feature-title').tagName,
                   titleColour: getComputedStyle(q('[data-el="e_fb"] .pb-feature-title')).color,
                   text: q('[data-el="e_fb"] .pb-feature-text').textContent,
                   textWhite: getComputedStyle(q('[data-el="e_fb"] .pb-feature-text')).whiteSpace,
                   link: q('[data-el="e_fb"] .pb-feature-link').getAttribute('href') },
        faq: { items: document.querySelectorAll('[data-el="e_faq"] .pb-faq-item').length,
               size: faq.fontSize,
               firstQ: q('[data-el="e_faq"] .pb-faq-qt').textContent },
        social: { links: document.querySelectorAll('[data-el="e_soc"] .pb-social-link').length,
                  size: soc.fontSize, gap: soc.gap, colour: soc.color,
                  firstHref: q('[data-el="e_soc"] .pb-social-link').getAttribute('href'),
                  target: q('[data-el="e_soc"] .pb-social-link').getAttribute('target'),
                  rel: q('[data-el="e_soc"] .pb-social-link').getAttribute('rel'),
                  label: q('[data-el="e_soc"] .pb-social-link').getAttribute('aria-label'),
                  iconColour: getComputedStyle(q('[data-el="e_soc"] .pb-social-icon')).color }
      };
    });

    check('divider renders as an hr', r.divider.tag === 'HR', r.divider.tag);
    check('divider thickness applies', r.divider.w === '4px', r.divider.w);
    check('divider style applies', r.divider.st === 'dashed', r.divider.st);
    check('divider colour applies', r.divider.c === 'rgb(255, 0, 0)', r.divider.c);
    check('divider width applies', r.divider.width === '200px', r.divider.width);

    check('spacer takes its height', r.spacer.h === '90px', r.spacer.h);
    check('spacer is hidden from assistive tech', r.spacer.hidden === 'true', r.spacer.hidden);

    check('icon colour applies', r.icon.colour === 'rgb(0, 170, 0)', r.icon.colour);
    check('icon size applies', r.icon.size === '48px', r.icon.size);
    check('the glyph inherits the icon size', r.icon.glyphSize === '48px', r.icon.glyphSize);
    check('icon uses only an allow-listed class',
      r.icon.glyph === 'pb-icon-glyph fa-solid fa-star', r.icon.glyph);
    check('the glyph is hidden from assistive tech', r.icon.glyphHidden === 'true');
    check('a labelled standalone icon is exposed as an image',
      r.icon.role === 'img' && r.icon.label === 'Top rated', r.icon);
    check('a linked icon renders as an anchor', r.iconLink.tag === 'A', r.iconLink.tag);
    check('a linked icon keeps its href', r.iconLink.href === 'contact.html', r.iconLink.href);
    check('a linked icon in a new tab gets rel=noopener',
      r.iconLink.target === '_blank' && r.iconLink.rel === 'noopener', r.iconLink);
    check('an icon-only link carries an accessible name',
      r.iconLink.label === 'Call us', r.iconLink.label);

    check('notice gets its variant class', r.notice.cls.indexOf('pb-notice-warning') > -1, r.notice.cls);
    check('notice variant sets a background', r.notice.bg === 'rgb(253, 246, 227)', r.notice.bg);
    check('notice radius control applies', r.notice.radius === '11px', r.notice.radius);
    check('notice uses the advisory role, not alert', r.notice.role === 'note', r.notice.role);
    check('notice text renders', r.notice.text === 'Heads up', r.notice.text);
    check('notice icon renders', r.notice.hasIcon);
    check('notice link renders', r.notice.link === 'about.html', r.notice.link);

    check('feature box gap applies', r.feature.gap === '18px', r.feature.gap);
    check('feature box colour applies', r.feature.colour === 'rgb(18, 52, 86)', r.feature.colour);
    check('feature heading uses the chosen level', r.feature.titleTag === 'H4', r.feature.titleTag);
    check('feature heading inherits the box colour',
      r.feature.titleColour === 'rgb(18, 52, 86)', r.feature.titleColour);
    check('feature text keeps newlines', r.feature.text === 'Line one\nLine two', r.feature.text);
    check('feature text preserves line breaks in CSS', r.feature.textWhite === 'pre-line', r.feature.textWhite);
    check('feature link renders', r.feature.link === 'about.html', r.feature.link);

    check('FAQ drops an item with no question', r.faq.items === 2, r.faq.items);
    check('FAQ font size applies', r.faq.size === '17px', r.faq.size);
    check('FAQ renders the question text', r.faq.firstQ === 'First question', r.faq.firstQ);

    check('social renders one link per valid item', r.social.links === 3, r.social.links);
    check('social size applies', r.social.size === '26px', r.social.size);
    check('social gap applies', r.social.gap === '20px', r.social.gap);
    check('social colour applies', r.social.colour === 'rgb(255, 0, 255)', r.social.colour);
    check('the social icon inherits that colour', r.social.iconColour === 'rgb(255, 0, 255)', r.social.iconColour);
    check('social link keeps its URL', r.social.firstHref === 'https://wa.me/123', r.social.firstHref);
    check('social links always open in a new tab', r.social.target === '_blank', r.social.target);
    check('social links carry noopener AND noreferrer',
      r.social.rel === 'noopener noreferrer', r.social.rel);
    check('social links carry an accessible name', r.social.label === 'WhatsApp', r.social.label);
    check('no page errors rendering the V2 elements', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== FAQ ACCESSIBILITY AND INTERACTION =====');
  {
    const SECT = [
      sec('f1', 'text', { elements: [el('multi', 'faq', { items: [
        { question: 'Q1', answer: 'A1', open: true },
        { question: 'Q2', answer: 'A2' }
      ] })] }),
      sec('f2', 'text', { elements: [el('single', 'faq', { single: true, items: [
        { question: 'S1', answer: 'SA1', open: true },
        { question: 'S2', answer: 'SA2' }
      ] })] })
    ];
    const { ctx, p, errs } = await publishedPage(b, SECT);

    const wiring = await p.evaluate(() => {
      const btns = [...document.querySelectorAll('[data-el="multi"] .pb-faq-btn')];
      return btns.map(btn => {
        const id = btn.getAttribute('aria-controls');
        const panel = document.getElementById(id);
        return {
          tag: btn.tagName, type: btn.getAttribute('type'),
          expanded: btn.getAttribute('aria-expanded'),
          hasPanel: !!panel,
          panelRole: panel && panel.getAttribute('role'),
          labelledBy: panel && panel.getAttribute('aria-labelledby'),
          pointsBack: panel && panel.getAttribute('aria-labelledby') === btn.id,
          hidden: panel && panel.hidden,
          inHeading: btn.parentElement.tagName
        };
      });
    });
    check('each question is a real button', wiring.every(w => w.tag === 'BUTTON' && w.type === 'button'), wiring);
    check('each button sits inside a heading', wiring.every(w => w.inHeading === 'H3'), wiring.map(w => w.inHeading));
    check('aria-controls points at a real panel', wiring.every(w => w.hasPanel), wiring);
    check('each panel is a labelled region',
      wiring.every(w => w.panelRole === 'region' && w.pointsBack), wiring);
    check('the open item starts expanded and visible',
      wiring[0].expanded === 'true' && wiring[0].hidden === false, wiring[0]);
    check('the closed item starts collapsed and hidden',
      wiring[1].expanded === 'false' && wiring[1].hidden === true, wiring[1]);
    check('panel ids are unique across the page',
      await p.evaluate(() => {
        const ids = [...document.querySelectorAll('.pb-faq-a')].map(e => e.id);
        return ids.length > 0 && new Set(ids).size === ids.length;
      }));

    /* interaction, by clicking and by keyboard */
    const btns = await p.$$('[data-el="multi"] .pb-faq-btn');
    await btns[1].click();
    await p.waitForTimeout(150);
    let st = await p.evaluate(() => [...document.querySelectorAll('[data-el="multi"] .pb-faq-btn')]
      .map(b => [b.getAttribute('aria-expanded'), document.getElementById(b.getAttribute('aria-controls')).hidden]));
    check('clicking a closed question opens it', st[1][0] === 'true' && st[1][1] === false, st);
    check('and leaves the other open one alone (multi mode)', st[0][0] === 'true', st);
    await btns[1].click();
    await p.waitForTimeout(150);
    st = await p.evaluate(() => [...document.querySelectorAll('[data-el="multi"] .pb-faq-btn')]
      .map(b => [b.getAttribute('aria-expanded'), document.getElementById(b.getAttribute('aria-controls')).hidden]));
    check('clicking again closes it', st[1][0] === 'false' && st[1][1] === true, st);

    const state = () => p.evaluate(() =>
      document.querySelector('[data-el="multi"] .pb-faq-btn').getAttribute('aria-expanded'));
    await p.evaluate(() => document.querySelector('[data-el="multi"] .pb-faq-btn').focus());
    check('a question can take keyboard focus',
      await p.evaluate(() => document.activeElement.classList.contains('pb-faq-btn')));
    const k0 = await state();
    await p.keyboard.press('Enter');
    await p.waitForTimeout(150);
    const k1 = await state();
    check('Enter toggles the focused question', k1 !== k0, [k0, k1]);
    await p.keyboard.press('Space');
    await p.waitForTimeout(150);
    const k2 = await state();
    check('Space toggles it back', k2 === k0, [k1, k2]);

    const sb = await p.$$('[data-el="single"] .pb-faq-btn');
    await sb[1].click();
    await p.waitForTimeout(150);
    const sst = await p.evaluate(() => [...document.querySelectorAll('[data-el="single"] .pb-faq-btn')]
      .map(b => b.getAttribute('aria-expanded')));
    check('in single mode opening one closes the other',
      sst[0] === 'false' && sst[1] === 'true', sst);
    check('no page errors during FAQ interaction', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== V2 ELEMENTS: RESPONSIVE =====');
  {
    const SECT = [sec('rv', 'text', { elements: [
      el('r_sp', 'spacer', {}, { height: '100' }, { tablet: { height: '60' }, mobile: { height: '20' } }),
      el('r_ic', 'icon', { icon: 'star' }, { fontSize: '60' }, { mobile: { fontSize: '24' } }),
      el('r_div', 'divider', {}, { lineWidth: '6' }, { tablet: { lineWidth: '3' } }),
      el('r_soc', 'socialLinks', { items: [{ platform: 'whatsapp', url: 'https://wa.me/1' }] },
         { fontSize: '30' }, { mobile: { fontSize: '16' } })
    ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const read = async (w) => {
      await p.setViewportSize({ width: w, height: 900 });
      await p.waitForTimeout(150);
      return p.evaluate(() => {
        const g = s => getComputedStyle(document.querySelector(s));
        return { sp: g('[data-el="r_sp"]').height, ic: g('[data-el="r_ic"]').fontSize,
                 div: g('[data-el="r_div"]').borderTopWidth, soc: g('[data-el="r_soc"]').fontSize };
      });
    };
    const D = await read(1280), T = await read(900), M = await read(390);
    check('spacer height responds at every breakpoint',
      D.sp === '100px' && T.sp === '60px' && M.sp === '20px', [D.sp, T.sp, M.sp]);
    check('icon size falls back on tablet and overrides on mobile',
      D.ic === '60px' && T.ic === '60px' && M.ic === '24px', [D.ic, T.ic, M.ic]);
    check('divider thickness overrides on tablet and inherits to mobile',
      D.div === '6px' && T.div === '3px' && M.div === '3px', [D.div, T.div, M.div]);
    check('social size overrides only on mobile',
      D.soc === '30px' && T.soc === '30px' && M.soc === '16px', [D.soc, T.soc, M.soc]);
    check('no page errors across breakpoints', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== V2 ELEMENTS: SAFETY =====');
  {
    const SECT = [sec('sf', 'text', { elements: [
      el('s_icon_bad', 'icon', { icon: 'fa-solid fa-skull' }),
      el('s_icon_inj', 'icon', { icon: '" onload="alert(1)' }),
      el('s_icon_js', 'icon', { icon: 'star', href: 'javascript:alert(1)', label: 'x' }),
      el('s_soc_bad', 'socialLinks', { items: [
        { platform: 'myspace', url: 'https://x.test' },
        { platform: 'whatsapp', url: 'javascript:alert(1)' },
        { platform: 'whatsapp', url: '//evil.example.com' },
        { platform: 'telegram', url: 'https://t.me/ok' }
      ] }),
      el('s_notice_var', 'notice', { text: 'x', variant: '"><script>alert(1)</script>' }),
      el('s_notice_raw', 'notice', { text: '<img src=x onerror=alert(1)>' }),
      el('s_faq_raw', 'faq', { items: [{ question: '<b>Q</b>', answer: '<i>A</i>' }] }),
      el('s_fb_img', 'featureBox', { image: 'data:text/html,<script>x</script>', title: 'T' })
    ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => ({
      iconBad: !!document.querySelector('[data-el="s_icon_bad"]'),
      iconInj: !!document.querySelector('[data-el="s_icon_inj"]'),
      iconJsTag: document.querySelector('[data-el="s_icon_js"]').tagName,
      iconJsHtml: document.querySelector('[data-el="s_icon_js"]').outerHTML,
      socLinks: [...document.querySelectorAll('[data-el="s_soc_bad"] .pb-social-link')]
        .map(a => a.getAttribute('href')),
      noticeCls: document.querySelector('[data-el="s_notice_var"]').className,
      noticeText: document.querySelector('[data-el="s_notice_raw"] .pb-notice-text').textContent,
      noticeHtml: document.querySelector('[data-el="s_notice_raw"] .pb-notice-text').innerHTML,
      faqQ: document.querySelector('[data-el="s_faq_raw"] .pb-faq-qt').textContent,
      faqHtml: document.querySelector('[data-el="s_faq_raw"] .pb-faq-qt').innerHTML,
      fbImg: !!document.querySelector('[data-el="s_fb_img"] img'),
      injected: document.querySelectorAll('.pb-section img[src="x"], .pb-section script').length,
      scripts: document.querySelectorAll('.pb-section script').length
    }));
    check('an icon name outside the allow-list renders nothing', r.iconBad === false);
    check('an icon name carrying markup renders nothing', r.iconInj === false);
    /* Unlike a button, an icon with a refused URL becomes plain decoration
       rather than a dead anchor — no link at all is better than one that
       goes nowhere. */
    check('an icon with a javascript: URL renders as a span, not a link',
      r.iconJsTag === 'SPAN', r.iconJsTag);
    check('and no javascript: survives anywhere in its markup',
      !/javascript/i.test(r.iconJsHtml), r.iconJsHtml);
    check('an unknown social platform is dropped',
      r.socLinks.indexOf('https://x.test') === -1, r.socLinks);
    check('a javascript: social URL is dropped',
      !r.socLinks.some(h => /javascript/i.test(h)), r.socLinks);
    check('a protocol-relative social URL is dropped',
      !r.socLinks.some(h => h.indexOf('//evil') === 0), r.socLinks);
    check('only the valid social link survives',
      r.socLinks.length === 1 && r.socLinks[0] === 'https://t.me/ok', r.socLinks);
    check('an unknown notice variant falls back to info',
      r.noticeCls.indexOf('pb-notice-info') > -1 && r.noticeCls.indexOf('script') === -1, r.noticeCls);
    check('notice text is shown literally, not parsed',
      r.noticeText === '<img src=x onerror=alert(1)>' && r.noticeHtml.indexOf('<img') === -1, r.noticeHtml);
    check('FAQ text is shown literally, not parsed',
      r.faqQ === '<b>Q</b>' && r.faqHtml.indexOf('<b>') === -1, r.faqHtml);
    check('a data: feature image is dropped', r.fbImg === false);
    check('nothing injected reached the DOM', r.injected === 0 && r.scripts === 0, r.injected);
    check('no page errors on hostile V2 content', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== V2 ELEMENTS: MALFORMED, DISABLED, MULTIPLE =====');
  {
    const SECT = [
      sec('m1', 'text', { elements: [
        { id: 'm_div', type: 'divider' },
        { id: 'm_sp', type: 'spacer', content: null, style: null },
        { id: 'm_ic', type: 'icon', content: {} },
        { id: 'm_nt', type: 'notice', content: {} },
        { id: 'm_fb', type: 'featureBox', content: {} },
        { id: 'm_faq0', type: 'faq', content: {} },
        { id: 'm_faq1', type: 'faq', content: { items: 'not an array' } },
        { id: 'm_faq2', type: 'faq', content: { items: [null, { answer: 'no q' }] } },
        { id: 'm_soc0', type: 'socialLinks', content: {} },
        { id: 'm_soc1', type: 'socialLinks', content: { items: [null, {}] } },
        { id: 'm_off', type: 'notice', content: { text: 'hidden' }, enabled: false },
        { id: 'm_unknown', type: 'nosuchelement', content: { text: 'x' } }
      ] }),
      sec('m2', 'text', { elements: [
        el('mi1', 'icon', { icon: 'star' }, { color: '#ff0000', fontSize: '20' }),
        el('mi2', 'icon', { icon: 'heart' }, { color: '#00ff00', fontSize: '40' }),
        el('mi3', 'icon', { icon: 'bolt' }, { color: '#0000ff', fontSize: '60' }),
        el('mn1', 'notice', { text: 'a', variant: 'info' }, { radius: '0' }),
        el('mn2', 'notice', { text: 'b', variant: 'danger' }, { radius: '20' })
      ] })
    ];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => { const e = document.querySelector(s); return e ? getComputedStyle(e) : null; };
      return {
        sections: document.querySelectorAll('.pb-section').length,
        div: !!document.querySelector('[data-el="m_div"]'),
        sp: !!document.querySelector('[data-el="m_sp"]'),
        icNoName: !!document.querySelector('[data-el="m_ic"]'),
        ntEmpty: !!document.querySelector('[data-el="m_nt"]'),
        fbEmpty: !!document.querySelector('[data-el="m_fb"]'),
        faqNone: !!document.querySelector('[data-el="m_faq0"]'),
        faqBad: !!document.querySelector('[data-el="m_faq1"]'),
        faqNoQ: !!document.querySelector('[data-el="m_faq2"]'),
        socNone: !!document.querySelector('[data-el="m_soc0"]'),
        socBad: !!document.querySelector('[data-el="m_soc1"]'),
        disabled: !!document.querySelector('[data-el="m_off"]'),
        unknown: !!document.querySelector('[data-el="m_unknown"]'),
        icons: [1, 2, 3].map(n => [g('[data-el="mi' + n + '"]').color, g('[data-el="mi' + n + '"]').fontSize]),
        notices: [g('[data-el="mn1"]').backgroundColor, g('[data-el="mn2"]').backgroundColor],
        noticeRadii: [g('[data-el="mn1"]').borderTopLeftRadius, g('[data-el="mn2"]').borderTopLeftRadius]
      };
    });
    check('both sections render despite malformed elements', r.sections === 2, r.sections);
    check('a divider with no content still renders', r.div);
    check('a spacer with null content and style still renders', r.sp);
    check('an icon with no name is skipped', r.icNoName === false);
    check('a notice with no text still renders its box', r.ntEmpty);
    check('an empty feature box still renders', r.fbEmpty);
    check('a FAQ with no items is skipped', r.faqNone === false);
    check('a FAQ whose items are not an array is skipped', r.faqBad === false);
    check('a FAQ whose items have no questions is skipped', r.faqNoQ === false);
    check('social links with no items are skipped', r.socNone === false);
    check('social links with only invalid items are skipped', r.socBad === false);
    check('a disabled V2 element renders nothing', r.disabled === false);
    check('an unknown element type is still ignored safely', r.unknown === false);
    check('three icons keep three colours',
      new Set(r.icons.map(i => i[0])).size === 3, r.icons);
    check('three icons keep three sizes',
      JSON.stringify(r.icons.map(i => i[1])) === JSON.stringify(['20px', '40px', '60px']), r.icons);
    check('two notices keep their own variant backgrounds',
      r.notices[0] !== r.notices[1], r.notices);
    check('two notices keep their own radii',
      r.noticeRadii[0] === '0px' && r.noticeRadii[1] === '20px', r.noticeRadii);
    check('no page errors on malformed V2 data', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== V2 ELEMENTS DO NOT LEAK INTO EACH OTHER OR THE PAGE =====');
  {
    const SECT = [sec('lk', 'cards', {
      style: { padding: '70', bg: '#101010', radius: '30', gap: '9' },
      elements: [
        el('lk_card', 'card', { title: 'C', text: 'body' }, { bg: '#ffffff', padding: '4', radius: '2' }),
        el('lk_div', 'divider', {}, {}),
        el('lk_ic', 'icon', { icon: 'star' }, {}),
        el('lk_nt', 'notice', { text: 'n' }, {}),
        el('lk_soc', 'socialLinks', { items: [{ platform: 'whatsapp', url: 'https://wa.me/1' }] }, {})
      ] })];
    const { ctx, p, errs } = await publishedPage(b, SECT);
    const r = await p.evaluate(() => {
      const g = s => getComputedStyle(document.querySelector(s));
      return {
        divPad: g('[data-el="lk_div"]').borderTopWidth,
        divMargin: g('[data-el="lk_div"]').margin,
        icPad: g('[data-el="lk_ic"]').padding,
        icRadius: g('[data-el="lk_ic"]').borderTopLeftRadius,
        ntPad: g('[data-el="lk_nt"]').padding,
        ntRadius: g('[data-el="lk_nt"]').borderTopLeftRadius,
        socGap: g('[data-el="lk_soc"]').gap,
        siteH2: getComputedStyle(document.querySelector('.info-body h2')).color,
        siteHr: document.querySelectorAll('.info-body hr').length
      };
    });
    check('section padding does not reach the divider thickness', r.divPad === '1px', r.divPad);
    check('the divider keeps its own default margin', r.divMargin === '16px 0px', r.divMargin);
    check('section padding does not reach the icon', r.icPad === '0px', r.icPad);
    check('section radius does not reach the icon', r.icRadius === '0px', r.icRadius);
    check('section padding does not reach the notice', r.ntPad === '14px 16px', r.ntPad);
    check('section radius does not reach the notice', r.ntRadius === '6px', r.ntRadius);
    check('section gap does not reach the social row', r.socGap === '12px', r.socGap);
    check('the page’s own headings are untouched', r.siteH2 === 'rgb(0, 136, 204)', r.siteH2);
    check('no page errors in the leak check', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== ADMIN OFFERS EXACTLY THE CONTROLS THAT WORK =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1500, height: 1100 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(400);
    const sid = await p.$eval('#pbList .pb-sec', e => e.getAttribute('data-sec-id'));
    const SEC = `#pbList .pb-sec[data-sec-id="${sid}"]`;
    const TOP = `${SEC} > .pb-sec-body > .pb-subbody`;

    const offered = await p.$$eval(`${TOP} > .pb-add-el > .pb-addbtn`, e => e.map(x => x.getAttribute('data-el-type')));
    check('the admin offers all thirteen element types', offered.length === 13, offered);
    check('and the seven V2 types are among them',
      ['divider', 'spacer', 'icon', 'notice', 'featureBox', 'faq', 'socialLinks']
        .every(t => offered.indexOf(t) > -1), offered);

    /* For each V2 type: the number of Design fields the admin renders must
       equal the number of keys the renderer honours. */
    for (const type of ['divider', 'spacer', 'icon', 'notice', 'featureBox', 'faq', 'socialLinks']) {
      await p.click(`${TOP} > .pb-add-el > .pb-addbtn[data-el-type="${type}"]`);
      await p.waitForTimeout(400);
      const id = await p.$$eval(`${TOP} > .pb-els > .pb-elcard`, e => e[e.length - 1].getAttribute('data-el-id'));
      const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${id}"]`;
      await p.click(`${CARD} > .pb-elcard-body > .pb-details > summary`);
      await p.waitForTimeout(250);
      const shown = await p.$$eval(`${CARD} > .pb-elcard-body > .pb-details .pb-field`, e => e.length);
      const want = await p.evaluate(t => (CMS.sections.elementStyleKeys[t] || []).length, type);
      check(type + ' offers exactly its ' + want + ' working design controls', shown === want, { shown, want });
    }
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
