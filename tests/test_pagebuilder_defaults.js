/* Page Builder -- what a newly added element starts with.

   Several V2 factories refuse to draw anything without content: an icon
   with no icon name, a FAQ with no question and a social row with no
   usable URL all return null by design. That is correct for stored data
   and wrong for a blank element, which used to arrive with {} and render
   nothing at all.

   This suite holds both halves of that: a new element of every type is
   visible immediately, and content that really is empty or malformed
   still fails exactly as safely as it did before. */
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

async function publishedPage(b, sections, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript((secs) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    raw.pages = raw.pages || {};
    raw.pages.about = Object.assign({}, raw.pages.about,
      { builder: { schemaVersion: 2, status: 'published', sections: secs } });
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, sections);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}
const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});

const TYPES = ['heading', 'text', 'image', 'button', 'card', 'columns', 'divider',
               'spacer', 'icon', 'notice', 'featureBox', 'faq', 'socialLinks'];
/* An image with no source is the one type that is meant to start empty:
   there is nothing to show until a file is named. */
const INVISIBLE_BY_DESIGN = ['image'];

/* Icon glyphs come from Font Awesome, which this sandbox's egress proxy
   blocks, so an <i class="fa-solid fa-star"> measures 0x0 here however
   correct it is. These two are therefore judged on the glyph the renderer
   emitted -- its class taken from the allow-list -- rather than on a box
   the missing font cannot draw. Everything else is measured. */
const GLYPH_ONLY = ['icon', 'socialLinks'];

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     A NEW ELEMENT OF EVERY TYPE IS VISIBLE STRAIGHT AWAY
     ================================================================ */
  console.log('\n===== ADDING AN ELEMENT SHOWS SOMETHING, WITHOUT TYPING FIRST =====');
  const ctx = await b.newContext({ viewport: { width: 1500, height: 1200 } });
  const st = { posts: 0, row: null }; await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
  await p.waitForTimeout(400);
  await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(500);
  await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(400);
  const sid = await p.$eval('#pbList .pb-sec', e => e.getAttribute('data-sec-id'));
  const TOP = `#pbList .pb-sec[data-sec-id="${sid}"] > .pb-sec-body > .pb-subbody`;

  const ids = {};
  for (const t of TYPES) {
    await p.click(`${TOP} > .pb-add-el > .pb-addbtn[data-el-type="${t}"]`);
    await p.waitForTimeout(280);
    ids[t] = await p.$$eval(`${TOP} > .pb-els > .pb-elcard`, e => e[e.length - 1].getAttribute('data-el-id'));
  }
  await p.waitForTimeout(700);

  const fr = p.frame({ url: u => /about\.html/.test(u) });
  check('the live preview frame is there', !!fr);

  /* Rendered AND actually occupying space, which is the thing an author
     judges it by -- a node with a zero-sized box is not "visible". */
  const seen = await fr.evaluate(list => {
    const o = {};
    for (const [type, id] of list) {
      const n = document.querySelector('[data-el="' + id + '"]');
      if (!n) { o[type] = { rendered: false }; continue; }
      const r = n.getBoundingClientRect();
      o[type] = { rendered: true, w: Math.round(r.width), h: Math.round(r.height),
                  text: (n.textContent || '').trim().slice(0, 40),
                  glyphs: Array.from(n.querySelectorAll('i')).map(i => i.className),
                  fontSize: getComputedStyle(n).fontSize };
    }
    return o;
  }, TYPES.map(t => [t, ids[t]]));

  for (const t of TYPES) {
    if (INVISIBLE_BY_DESIGN.indexOf(t) > -1) {
      check(t + ' is the one type that correctly starts with nothing to show',
        !seen[t].rendered, seen[t]);
      continue;
    }
    if (GLYPH_ONLY.indexOf(t) > -1) {
      check('a new ' + t + ' renders immediately, with a sized glyph of its own',
        seen[t].rendered && seen[t].glyphs.length > 0 &&
        /fa-/.test(seen[t].glyphs[0]) && parseFloat(seen[t].fontSize) > 0, seen[t]);
      continue;
    }
    check('a new ' + t + ' renders immediately, with a box of its own',
      seen[t].rendered && seen[t].w > 0 && seen[t].h > 0, seen[t]);
  }

  /* The glyph classes must be the ones the renderer's own allow-lists
     name, not something the admin invented. */
  {
    const want = await p.evaluate(() => ({
      star: CMS.sections.icons.star, wa: CMS.sections.social.whatsapp[0] }));
    check('the new icon carries the allow-listed star glyph',
      seen.icon.glyphs.some(c => c.indexOf(want.star) > -1), { got: seen.icon.glyphs, want });
    check('the new social chip carries the allow-listed WhatsApp glyph',
      seen.socialLinks.glyphs.some(c => c.indexOf(want.wa) > -1), { got: seen.socialLinks.glyphs, want });
  }

  /* The five that used to render nothing at all must now say what they are. */
  for (const [t, want] of [['icon', ''], ['notice', 'Notice'], ['featureBox', 'Feature title'],
                           ['faq', 'Frequently asked question'], ['socialLinks', '']]) {
    if (!want) continue;
    check('a new ' + t + ' shows its placeholder wording', (seen[t].text || '').indexOf(want) === 0, seen[t]);
  }

  /* ---- the defaults are values the renderer would accept ---- */
  console.log('\n===== THE DEFAULTS ARE VALID, AND NONE OF THEM IS A LINK ANYWHERE =====');
  const blanks = await p.evaluate(list => {
    const d = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts || {};
    const out = {};
    for (const k in d) for (const s of d[k].sections || []) for (const e of s.elements || []) {
      for (const [type, id] of list) if (e.id === id) out[type] = e;
    }
    return out;
  }, TYPES.map(t => [t, ids[t]]));

  const allow = await p.evaluate(() => ({
    icons: Object.keys(CMS.sections.icons),
    social: Object.keys(CMS.sections.social)
  }));
  check('the default icon name is one the renderer knows',
    allow.icons.indexOf(blanks.icon.content.icon) > -1, blanks.icon.content);
  check('the default notice icon and variant are both known',
    allow.icons.indexOf(blanks.notice.content.icon) > -1 &&
    ['info', 'success', 'warning', 'danger'].indexOf(blanks.notice.content.variant) > -1,
    blanks.notice.content);
  check('the default feature box icon is known',
    allow.icons.indexOf(blanks.featureBox.content.icon) > -1, blanks.featureBox.content);
  check('the default FAQ item has a question, which is what the renderer needs',
    blanks.faq.content.items.length === 1 && !!blanks.faq.content.items[0].question,
    blanks.faq.content);
  check('the default social platform is one the renderer knows',
    allow.social.indexOf(blanks.socialLinks.content.items[0].platform) > -1,
    blanks.socialLinks.content);

  /* Every URL-ish value in every default, checked as one set. */
  const urls = [];
  (function walk(v) {
    if (v == null) return;
    if (typeof v === 'string') { urls.push(v); return; }
    if (typeof v !== 'object') return;
    for (const k in v) walk(v[k]);
  }(blanks));
  check('no default contains a javascript:, data: or protocol-relative URL',
    !urls.some(u => /^\s*(javascript|data|vbscript):/i.test(u) || /^\/\//.test(u)), urls);
  check('no default points at an external host',
    !urls.some(u => /^https?:\/\//i.test(u)), urls.filter(u => /^https?:/i.test(u)));
  check('the default social link is the placeholder "#", not a real profile',
    blanks.socialLinks.content.items[0].url === '#', blanks.socialLinks.content.items[0]);

  const href = await fr.evaluate(id => {
    const a = document.querySelector('[data-el="' + id + '"] a');
    return a ? { href: a.getAttribute('href'), rel: a.getAttribute('rel') } : null;
  }, ids.socialLinks);
  check('and it renders as a "#" anchor that still carries noopener noreferrer',
    href && href.href === '#' && /noopener/.test(href.rel) && /noreferrer/.test(href.rel), href);

  /* ---- adding a repeater row has the same problem, and the same fix ---- */
  {
    const CARD = `${TOP} > .pb-els > .pb-elcard[data-el-id="${ids.socialLinks}"]`;
    await p.click(`${CARD} .pb-items [data-act="add-item"]`).catch(async () => {
      await p.click(`${CARD} button:has-text("Add link")`);
    });
    await p.waitForTimeout(600);
    const n = await fr.evaluate(id =>
      document.querySelectorAll('[data-el="' + id + '"] a').length, ids.socialLinks);
    check('adding a second social row shows a second chip straight away', n === 2, n);
  }

  /* ---- the V1 element defaults are untouched ---- */
  console.log('\n===== THE V1 ELEMENTS START EXACTLY AS THEY ALWAYS DID =====');
  check('heading', JSON.stringify(blanks.heading.content) === JSON.stringify({ text: 'Heading', level: 'h2' }), blanks.heading.content);
  check('text', JSON.stringify(blanks.text.content) === JSON.stringify({ text: 'Write something here.' }), blanks.text.content);
  check('image', JSON.stringify(blanks.image.content) === JSON.stringify({ src: '', alt: '' }), blanks.image.content);
  check('button', JSON.stringify(blanks.button.content) === JSON.stringify({ text: 'Button', href: '#' }), blanks.button.content);
  check('card', JSON.stringify(blanks.card.content) === JSON.stringify({ title: 'Card title', text: 'Card text.' }), blanks.card.content);
  check('columns still starts with two containers holding one text each',
    blanks.columns.content.columns.length === 2 &&
    blanks.columns.content.columns.every(c => c.elements.length === 1 &&
      c.elements[0].type === 'text'), blanks.columns.content);
  check('divider and spacer still carry no content, because they need none',
    JSON.stringify(blanks.divider.content) === '{}' &&
    JSON.stringify(blanks.spacer.content) === '{}', [blanks.divider.content, blanks.spacer.content]);
  check('every new element still starts with empty style and responsive maps',
    TYPES.every(t => JSON.stringify(blanks[t].style) === '{}' &&
                     JSON.stringify(blanks[t].responsive) === '{}'), 'style/responsive');

  check('the admin ran without console or page errors', errs.length === 0, errs.slice(0, 3));
  await ctx.close();

  /* ================================================================
     STORED DATA THAT IS EMPTY OR BROKEN STILL FAILS SAFELY
     ================================================================ */
  console.log('\n===== EMPTY AND MALFORMED STORED CONTENT IS UNCHANGED =====');
  {
    /* Explicitly empty -- the case the defaults do NOT cover, because
       nothing writes it any more but old data may hold it. */
    const empties = TYPES.map(t => ({ id: 'e_' + t, type: t, content: {}, style: {}, responsive: {} }));
    const { ctx, p, errs } = await publishedPage(b, [sec('s1', 'text', { elements: empties })]);
    const r = await p.evaluate(list => {
      const o = {};
      for (const t of list) {
        const n = document.querySelector('[data-el="e_' + t + '"]');
        o[t] = n ? { tag: n.tagName, links: n.querySelectorAll('a').length,
                     text: (n.textContent || '').trim() } : null;
      }
      return o;
    }, TYPES);
    check('an icon with no icon name still renders nothing', r.icon === null, r.icon);
    check('a FAQ with no questions still renders nothing', r.faq === null, r.faq);
    check('social links with no items still render nothing', r.socialLinks === null, r.socialLinks);
    check('columns with no containers still render nothing', r.columns === null, r.columns);
    check('an empty notice still renders its box, with no text and no link',
      r.notice && r.notice.text === '' && r.notice.links === 0, r.notice);
    check('an empty feature box still renders its box, with no text and no link',
      r.featureBox && r.featureBox.text === '' && r.featureBox.links === 0, r.featureBox);
    check('a divider and a spacer still render with no content',
      r.divider && r.divider.tag === 'HR' && r.spacer && r.spacer.tag === 'DIV', [r.divider, r.spacer]);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  {
    /* Hostile values in exactly the fields the defaults now populate. */
    const bad = [
      { id: 'b1', type: 'icon', content: { icon: 'javascript:alert(1)', label: 'x', href: 'javascript:alert(1)' }, style: {}, responsive: {} },
      { id: 'b2', type: 'icon', content: { icon: 'star', href: 'javascript:alert(1)' }, style: {}, responsive: {} },
      { id: 'b3', type: 'notice', content: { text: 'ok', variant: '"><img src=x>', icon: '../../x' }, style: {}, responsive: {} },
      { id: 'b4', type: 'faq', content: { items: [{ question: '', answer: 'orphan' }, { question: 'ok?', answer: 'yes' }] }, style: {}, responsive: {} },
      { id: 'b5', type: 'socialLinks', content: { items: [
        { platform: 'whatsapp', url: 'javascript:alert(1)' },
        { platform: 'constructor', url: '#' },
        { platform: 'telegram', url: '//evil.example.com' },
        { platform: 'facebook', url: '#' }] }, style: {}, responsive: {} },
      { id: 'b6', type: 'featureBox', content: { icon: 'constructor', title: 'T', image: 'javascript:alert(1)' }, style: {}, responsive: {} }
    ];
    const { ctx, p, errs } = await publishedPage(b, [sec('s1', 'text', { elements: bad })]);
    const r = await p.evaluate(() => {
      const g = id => {
        const n = document.querySelector('[data-el="' + id + '"]');
        if (!n) return null;
        return { tag: n.tagName, cls: n.className,
                 hrefs: Array.from(n.querySelectorAll('a')).map(a => a.getAttribute('href')),
                 self: n.getAttribute('href'),
                 icons: Array.from(n.querySelectorAll('i')).map(i => i.className),
                 text: (n.textContent || '').trim() };
      };
      return { b1: g('b1'), b2: g('b2'), b3: g('b3'), b4: g('b4'), b5: g('b5'), b6: g('b6'),
               html: document.querySelector('[data-cms-sections]').innerHTML };
    });
    check('an unknown icon name still renders nothing at all', r.b1 === null, r.b1);
    check('a known icon with a refused link renders as a span, not an anchor',
      r.b2 && r.b2.tag === 'SPAN' && r.b2.self === null, r.b2);
    check('an unknown notice variant falls back to info and is not injected',
      r.b3 && /pb-notice-info/.test(r.b3.cls) && !/img|</.test(r.b3.cls), r.b3 && r.b3.cls);
    check('a notice icon that is not on the list is simply dropped',
      r.b3 && r.b3.icons.every(c => !/\.\./.test(c)), r.b3 && r.b3.icons);
    check('a FAQ item with no question is skipped, the valid one is kept',
      r.b4 && r.b4.text.indexOf('orphan') === -1 && r.b4.text.indexOf('ok?') > -1, r.b4 && r.b4.text);
    check('social rows with a refused URL or an unknown platform are dropped',
      r.b5 && r.b5.hrefs.length === 1 && r.b5.hrefs[0] === '#', r.b5 && r.b5.hrefs);
    check('a feature box keeps an unknown icon out and a refused image out',
      r.b6 && r.b6.icons.length === 0 && r.b6.text === 'T', r.b6);
    check('nothing hostile reached the rendered markup',
      !/javascript:|<img|vbscript:/i.test(r.html), r.html.slice(0, 300));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
