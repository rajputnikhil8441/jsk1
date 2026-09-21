/* Page Builder — V1 GOLDEN COMPATIBILITY.
   ---------------------------------------------------------------------------
   This suite exists for one reason: a page built with V1 must keep rendering
   exactly as V1 rendered it, for as long as V2 and anything after it lives.

   fixtures/v1-golden-payload.json is a frozen V1 payload — schemaVersion 1,
   no V2 fields anywhere. fixtures/v1-golden-expected.json is what the code
   ACTUALLY produced for it at 1ce70b5, captured rather than guessed, across
   three viewports.

   A failure here is not a test to fix. It means V2 changed how existing
   published pages look. Re-mint the golden file (tests/capture-golden.js)
   only when such a change is deliberate, reviewed, and explained.            */
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const FIX = path.join(__dirname, 'fixtures');
const payload = JSON.parse(fs.readFileSync(path.join(FIX, 'v1-golden-payload.json'), 'utf8'));
const golden = JSON.parse(fs.readFileSync(path.join(FIX, 'v1-golden-expected.json'), 'utf8'));
const PROPS = golden.props;

/* Grid tracks resolve to sub-pixel widths that depend on the container, so a
   cosmetically irrelevant 0.016px difference would fail the run. What matters
   for compatibility is the track COUNT and whether the tracks stay equal, so
   that is what is compared. Everything else is compared exactly. */
function normalise(prop, v) {
  if (prop !== 'gridTemplateColumns' || !v || v === 'none') return v;
  const parts = String(v).trim().split(/\s+/);
  const nums = parts.map(parseFloat);
  if (nums.some(isNaN)) return v;
  const equal = Math.max(...nums) - Math.min(...nums) < 1;
  return parts.length + (equal ? ' equal tracks' : ' tracks ' + nums.map(n => Math.round(n)).join('/'));
}

function diff(actual, expected) {
  const out = [];
  for (const p of ['tag', 'cls'].concat(PROPS)) {
    const a = normalise(p, actual[p]), e = normalise(p, expected[p]);
    if (a !== e) out.push(p + ': got ' + JSON.stringify(a) + ', golden ' + JSON.stringify(e));
  }
  return out;
}

const capture = (page, props) => page.evaluate((props) => {
  const out = { nodes: {}, structure: [], css: '' };
  out.css = (document.getElementById('cmsBuilder') || {}).textContent || '';
  const pick = (el) => {
    const cs = getComputedStyle(el), o = { tag: el.tagName, cls: el.className };
    props.forEach(p => { o[p] = cs[p]; });
    return o;
  };
  document.querySelectorAll('[data-sec]').forEach(el => { out.nodes['sec:' + el.getAttribute('data-sec')] = pick(el); });
  document.querySelectorAll('[data-el]').forEach(el => { out.nodes['el:' + el.getAttribute('data-el')] = pick(el); });
  document.querySelectorAll('.pb-section').forEach((s, i) => {
    const inner = s.querySelector('.pb-inner');
    if (inner) out.nodes['inner:' + (s.getAttribute('data-sec') || i)] = pick(inner);
  });
  document.querySelectorAll('.pb-card').forEach((c, i) => {
    const t = c.querySelector('.pb-card-title'), x = c.querySelector('.pb-card-text'), b = c.querySelector('.pb-btn');
    const id = c.getAttribute('data-el') || i;
    if (t) out.nodes['cardTitle:' + id] = pick(t);
    if (x) out.nodes['cardText:' + id] = pick(x);
    if (b) out.nodes['cardBtn:' + id] = pick(b);
  });
  document.querySelectorAll('.pb-column').forEach((c, i) => { out.nodes['column:' + i] = pick(c); });
  out.structure = [...document.querySelectorAll('.pb-section')].map(s => ({
    sec: s.getAttribute('data-sec'), cls: s.className,
    els: [...s.querySelectorAll('[data-el]')].map(e => e.getAttribute('data-el') + ':' + e.tagName)
  }));
  out.siteIntact = {
    h2: document.querySelectorAll('.info-body h2').length,
    h2color: getComputedStyle(document.querySelector('.info-body h2')).color,
    h1: !!document.querySelector('.info-article > h1'),
    title: document.title
  };
  out.attrs = {
    btnHref: document.querySelector('[data-el="g_b1"]').getAttribute('href'),
    btnTarget: document.querySelector('[data-el="g_b1"]').getAttribute('target'),
    btnRel: document.querySelector('[data-el="g_b1"]').getAttribute('rel'),
    imgSrc: document.querySelector('[data-el="g_i1"]').getAttribute('src'),
    imgAlt: document.querySelector('[data-el="g_i1"]').getAttribute('alt'),
    imgW: document.querySelector('[data-el="g_i1"]').getAttribute('width'),
    linkedImgParent: document.querySelector('[data-el="g_i2"]').parentElement.tagName,
    linkedImgHref: document.querySelector('[data-el="g_i2"]').parentElement.getAttribute('href'),
    textContent: document.querySelector('[data-el="g_t1"]').textContent,
    disabledSection: !!document.querySelector('[data-sec="g_disabled"]'),
    disabledElement: !!document.querySelector('[data-el="g_off"]'),
    emptySectionKids: document.querySelector('[data-sec="g_image"] .pb-inner').children.length
  };
  return out;
}, props);

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route('**supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript((pl) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    raw.pages = raw.pages || {};
    raw.pages.about = Object.assign({}, raw.pages.about, { builder: pl });
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, payload);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });

  console.log('\n===== THE FROZEN PAYLOAD IS STILL V1 =====');
  check('the fixture declares schemaVersion 1', payload.schemaVersion === 1, payload.schemaVersion);
  check('the fixture carries no V2 section fields',
    payload.sections.every(s => s.layout === undefined && s.responsiveColumns === undefined),
    payload.sections.filter(s => s.layout !== undefined).map(s => s.id));
  check('the golden file was captured against V1',
    /^1ce70b5/.test(golden.capturedAgainst), golden.capturedAgainst);
  check('the golden file captured a real render',
    Object.keys(golden.widths.desktop.nodes).length >= 30,
    Object.keys(golden.widths.desktop.nodes).length);

  for (const [name, w] of [['desktop', 1280], ['tablet', 900], ['mobile', 390]]) {
    console.log(`\n===== V1 DATA AT ${name.toUpperCase()} (${w}px) =====`);
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(150);
    const got = await capture(p, PROPS);
    const exp = golden.widths[name];

    check(name + ': the same nodes are rendered',
      JSON.stringify(Object.keys(got.nodes).sort()) === JSON.stringify(Object.keys(exp.nodes).sort()),
      { missing: Object.keys(exp.nodes).filter(k => !got.nodes[k]),
        extra: Object.keys(got.nodes).filter(k => !exp.nodes[k]) });

    for (const key of Object.keys(exp.nodes)) {
      if (!got.nodes[key]) continue;   /* already reported above */
      const d = diff(got.nodes[key], exp.nodes[key]);
      check(name + ': ' + key + ' renders as V1 did', d.length === 0, d);
    }

    check(name + ': the section/element tree is unchanged',
      JSON.stringify(got.structure) === JSON.stringify(exp.structure),
      { got: got.structure, golden: exp.structure });
    check(name + ': the generated CSS is unchanged',
      got.css === exp.css,
      got.css === exp.css ? '' : { gotBytes: got.css.length, goldenBytes: exp.css.length });
    check(name + ': attributes are unchanged',
      JSON.stringify(got.attrs) === JSON.stringify(exp.attrs),
      { got: got.attrs, golden: exp.attrs });
    check(name + ': the page’s own content is unaffected',
      JSON.stringify(got.siteIntact) === JSON.stringify(exp.siteIntact),
      { got: got.siteIntact, golden: exp.siteIntact });
  }

  console.log('\n===== NO ERRORS =====');
  check('V1 data renders without page errors', errs.length === 0, errs.slice(0, 3));

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.slice(0, 12).join(' | '));
  process.exit(fail ? 1 : 0);
})();
