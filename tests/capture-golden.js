#!/usr/bin/env node
/* Records what the CURRENT code renders for the frozen V1 payload and writes
   fixtures/v1-golden-expected.json.

   Run this ONCE, against V1, to mint the golden file. After that it must not
   be re-run to "fix" a failing compat test: a difference means V2 changed how
   V1 data renders, which is the thing the test exists to catch. Re-mint only
   when a change to V1 rendering is deliberate, reviewed, and explained in the
   commit message. */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
const FIX = path.join(__dirname, 'fixtures');
const payload = JSON.parse(fs.readFileSync(path.join(FIX, 'v1-golden-payload.json'), 'utf8'));

/* Properties worth pinning: the ones a style control is supposed to move. */
const PROPS = ['display', 'color', 'backgroundColor', 'backgroundImage', 'fontSize', 'fontWeight',
  'textAlign', 'padding', 'margin', 'maxWidth', 'minHeight', 'height', 'width',
  'borderTopWidth', 'borderTopStyle', 'borderTopColor', 'borderTopLeftRadius', 'boxShadow',
  'gap', 'gridTemplateColumns', 'alignSelf', 'justifySelf', 'lineHeight', 'whiteSpace', 'objectFit'];

const WIDTHS = [['desktop', 1280], ['tablet', 900], ['mobile', 390]];

async function capture(page) {
  return page.evaluate((props) => {
    const out = { nodes: {}, structure: [], css: '' };
    out.css = (document.getElementById('cmsBuilder') || {}).textContent || '';
    const pick = (el) => {
      const cs = getComputedStyle(el), o = { tag: el.tagName, cls: el.className };
      props.forEach(p => { o[p] = cs[p]; });
      return o;
    };
    document.querySelectorAll('[data-sec]').forEach(el => {
      out.nodes['sec:' + el.getAttribute('data-sec')] = pick(el);
    });
    document.querySelectorAll('[data-el]').forEach(el => {
      out.nodes['el:' + el.getAttribute('data-el')] = pick(el);
    });
    /* internals that carry no id but must not drift */
    document.querySelectorAll('.pb-section').forEach((s, i) => {
      const inner = s.querySelector('.pb-inner');
      if (inner) out.nodes['inner:' + (s.getAttribute('data-sec') || i)] = pick(inner);
    });
    document.querySelectorAll('.pb-card').forEach((c, i) => {
      const t = c.querySelector('.pb-card-title'), x = c.querySelector('.pb-card-text'),
            b = c.querySelector('.pb-btn');
      const id = c.getAttribute('data-el') || i;
      if (t) out.nodes['cardTitle:' + id] = pick(t);
      if (x) out.nodes['cardText:' + id] = pick(x);
      if (b) out.nodes['cardBtn:' + id] = pick(b);
    });
    document.querySelectorAll('.pb-column').forEach((c, i) => { out.nodes['column:' + i] = pick(c); });
    /* shape of the rendered tree, and the site's own content beside it */
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
      btnHref: (document.querySelector('[data-el="g_b1"]') || {}).getAttribute
        ? document.querySelector('[data-el="g_b1"]').getAttribute('href') : null,
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
  }, PROPS);
}

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

  const golden = { capturedAgainst: process.env.GOLDEN_REF || 'unknown', props: PROPS, widths: {} };
  for (const [name, w] of WIDTHS) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.waitForTimeout(120);
    golden.widths[name] = await capture(p);
  }
  golden.pageErrors = errs;
  fs.writeFileSync(path.join(FIX, 'v1-golden-expected.json'), JSON.stringify(golden, null, 1));
  const n = Object.keys(golden.widths.desktop.nodes).length;
  console.log('captured', n, 'nodes x', WIDTHS.length, 'widths; page errors:', errs.length);
  await b.close();
})();
