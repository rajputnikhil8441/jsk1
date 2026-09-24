/* =====================================================================
   SEO DASHBOARD × PAGE BUILDER CONTENT
   ---------------------------------------------------------------------
   The dashboard used to analyse pages.<slug>.body and nothing else, so a
   page whose body the Page Builder owns reported "the page body is empty"
   and zero words while the live page was full of content.

   What is asserted here:
     - a page with no builder block is analysed exactly as it always was;
     - a page with PUBLISHED builder content is analysed from the markup
       the public renderer produces, via CMS.sections.renderInto -- the
       same function the visitor's page calls;
     - a DRAFT is never treated as published;
     - the dashboard says which of the two it is looking at.
   ===================================================================== */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8777';
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const sec = (id, elements) => ({ id, type: 'text', enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true },
  style: {}, responsive: {}, elements });
const el = (id, type, content) => ({ id, type, content, style: {}, responsive: {} });
const block = (status, sections) => ({ schemaVersion: 2, status, sections, updatedAt: '2026-01-01' });
const lorem = n => Array.from({ length: n }, (_, i) => 'word' + i).join(' ');

async function adminWith(b, seed) {
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  let row = null;
  await ctx.route('**supabase.co/**', r => {
    const q = r.request(), u = q.url();
    if (u.includes('/auth/v1/token'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
    if (q.method() === 'POST') { row = JSON.parse(q.postData() || '{}'); return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(row ? [{ data: row.data, updated_at: row.updated_at }] : []) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.addInitScript(s => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    raw.pages = raw.pages || {};
    raw.builderDrafts = raw.builderDrafts || {};
    Object.keys(s.builders || {}).forEach(k => {
      raw.pages[k] = Object.assign({}, raw.pages[k], { builder: s.builders[k] });
    });
    Object.keys(s.drafts || {}).forEach(k => { raw.builderDrafts[k] = s.drafts[k]; });
    Object.keys(s.bodies || {}).forEach(k => {
      raw.pages[k] = Object.assign({}, raw.pages[k], { body: s.bodies[k] });
    });
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
  await p.waitForTimeout(400);
  await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(400);
  return { ctx, p, errs };
}

const rowText = (p, slug) =>
  p.$eval(`#seoDashboard [data-seorow="${slug}"]`, e => e.textContent.replace(/\s+/g, ' '));
const rowSrc = (p, slug) =>
  p.$eval(`#seoDashboard [data-seorow="${slug}"] [data-src]`, e => e.getAttribute('data-src'));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. LOAD A -- the awkward content
     ================================================================== */
  console.log('\n===== BUILDER CONTENT IS READ, NOT THE EMPTY BODY FIELD =====');
  {
    const seed = {
      builders: {
        /* published, long text + one H2: the healthy case */
        about: block('published', [sec('s1', [
          el('e1', 'heading', { text: 'A real subheading', level: 'h2' }),
          el('e2', 'text', { text: lorem(200) })
        ])]),
        /* published, contains two H1s: the page already has one above */
        contact: block('published', [sec('s2', [
          el('e3', 'heading', { text: 'First', level: 'h1' }),
          el('e4', 'heading', { text: 'Second', level: 'h1' }),
          el('e5', 'text', { text: 'Short.' })
        ])]),
        /* published, H2 then H4: a skipped level */
        'responsible-gaming': block('published', [sec('s3', [
          el('e6', 'heading', { text: 'Two', level: 'h2' }),
          el('e7', 'heading', { text: 'Four', level: 'h4' }),
          el('e8', 'text', { text: lorem(30) })
        ])]),
        /* published but holding nothing at all */
        register: block('published', []),
        /* a draft that was never published */
        'privacy-policy': block('draft', [sec('s4', [el('e9', 'text', { text: lorem(400) })])])
      },
      drafts: {
        'privacy-policy': { schemaVersion: 2, status: 'draft', updatedAt: '2026-01-01',
                            sections: [sec('s4', [el('e9', 'text', { text: lorem(400) })])] }
      }
    };
    const { ctx, p, errs } = await adminWith(b, seed);

    const about = await rowText(p, 'about');
    check('a published builder page is NOT reported as an empty body', !/content is empty|body is empty/i.test(about), about.slice(0, 240));
    check('its word count comes from the rendered content', /is about 20[0-9] words|is about 2\d\d words/.test(about), about.match(/about \d+ words/));
    check('and the dashboard says the content is published builder content', await rowSrc(p, 'about') === 'builder');

    const contact = await rowText(p, 'contact');
    check('two H1s inside builder content are reported', /contains 2 <?h1|contains 2 heading/i.test(contact) || /2 <h1>/i.test(contact), contact.slice(0, 300));

    const rg = await rowText(p, 'responsible-gaming');
    check('a skipped heading level is reported for builder content', /heading level is skipped/i.test(rg), rg.slice(0, 300));

    const reg = await rowText(p, 'register');
    check('a published but EMPTY builder page reports empty content', /Page Builder content is empty/i.test(reg), reg.slice(0, 300));
    check('and is still labelled published builder', await rowSrc(p, 'register') === 'builder');

    const pp = await rowText(p, 'privacy-policy');
    check('a DRAFT is never counted as published content', await rowSrc(p, 'privacy-policy') === 'draft-only', await rowSrc(p, 'privacy-policy'));
    check('the draft page is analysed from the body that is still live', /never been published/i.test(pp), pp.slice(0, 300));
    check('and the draft’s 400 words are NOT credited to the page',
      !/is about 4\d\d words/.test(pp), pp.match(/about \d+ words/));

    const login = await rowText(p, 'login');
    check('a page with no builder block is labelled as a page body', await rowSrc(p, 'login') === 'body');
    check('no console errors while analysing builder content', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     2. LOAD B -- images, links, and a pending draft
     ================================================================== */
  console.log('\n===== IMAGES, LINKS AND THE PUBLISHED / PENDING DISTINCTION =====');
  {
    const good = sec('s5', [
      el('e10', 'image', { src: 'assets/images/logo.png', alt: 'A described picture' }),
      el('e11', 'text', { text: lorem(160) })
    ]);
    const seed = {
      builders: {
        about: block('published', [good]),
        /* two images, neither described */
        contact: block('published', [sec('s6', [
          el('e12', 'image', { src: 'assets/images/logo.png', alt: '' }),
          el('e13', 'image', { src: 'assets/images/logo.png', alt: '   ' }),
          el('e14', 'text', { text: lorem(20) })
        ])]),
        /* links: one the CMS knows, one it does not */
        'responsible-gaming': block('published', [sec('s7', [
          el('e15', 'button', { text: 'About us', href: 'about.html' }),
          el('e16', 'button', { text: 'Nowhere', href: 'not-a-page.html' }),
          el('e17', 'text', { text: lorem(20) })
        ])])
      },
      drafts: {
        /* about has a draft that differs from what is published */
        about: { schemaVersion: 2, status: 'draft', updatedAt: '2026-02-02',
                 sections: [sec('s5', [el('e18', 'text', { text: 'Completely different draft copy.' })])] }
      }
    };
    const { ctx, p, errs } = await adminWith(b, seed);

    const about = await rowText(p, 'about');
    check('a described image raises no alt warning', !/no alt text/i.test(about), about.slice(0, 300));
    check('an unpublished draft is flagged as pending, not as the content', /unpublished Page Builder changes/i.test(about), about.slice(0, 300));
    check('and the row is labelled published-with-draft-pending', await rowSrc(p, 'about') === 'builder-dirty');
    check('the PUBLISHED words are counted, not the draft’s five',
      /is about 1[5-7]\d words/.test(about), about.match(/about \d+ words/));

    const contact = await rowText(p, 'contact');
    check('builder images with a blank alt are reported', /2 image\(s\).*no alt text/i.test(contact), contact.slice(0, 300));

    const rg = await rowText(p, 'responsible-gaming');
    check('a builder link to an unknown page is reported', /not-a-page\.html/.test(rg), rg.slice(0, 400));
    check('a builder link to a known page is not', !/about\.html.*not a page the CMS knows/.test(rg), rg.slice(0, 400));
    check('no console errors in the image / link pass', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     3. THE ANALYSER AND THE RENDERER AGREE
     ------------------------------------------------------------------
     The point of reusing CMS.sections.renderInto is that there is only
     ONE interpretation of a section array. This proves it by rendering
     the same sections in the admin and comparing with the public page.
     ================================================================== */
  console.log('\n===== ONE INTERPRETATION, NOT TWO =====');
  {
    const sections = [sec('s8', [
      el('e19', 'heading', { text: 'Shared heading', level: 'h2' }),
      el('e20', 'image', { src: 'assets/images/logo.png', alt: 'shared' }),
      el('e21', 'text', { text: 'Shared body copy.' })
    ])];
    const { ctx, p, errs } = await adminWith(b, { builders: { about: block('published', sections) } });
    const adminHtml = await p.evaluate(s => {
      const d = document.createElement('div');
      window.CMS.sections.renderInto(d, s);
      return d.innerHTML;
    }, sections);

    const pub = await ctx.newPage();
    await pub.addInitScript(bl => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.pages = raw.pages || {};
      raw.pages.about = Object.assign({}, raw.pages.about, { builder: bl });
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    }, block('published', sections));
    await pub.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await pub.waitForTimeout(300);
    const publicHtml = await pub.$eval('[data-cms-sections="about"]', e => e.innerHTML);
    check('the markup the dashboard measures is byte-identical to the public page',
      adminHtml === publicHtml, { admin: adminHtml.slice(0, 160), pub: publicHtml.slice(0, 160) });
    check('no console errors comparing the two', errs.length === 0, errs);
    await pub.close(); await ctx.close();
  }

  /* ==================================================================
     4. NOTHING ABOUT THE OLD BEHAVIOUR CHANGED
     ================================================================== */
  console.log('\n===== EXISTING HTML-BODY PAGES ARE UNTOUCHED =====');
  {
    const { ctx, p, errs } = await adminWith(b, {
      bodies: {
        login: '<h2>Heading</h2><p>' + lorem(20) + '</p>' +
               '<img src="assets/images/logo.png"><img src="assets/images/logo.png" alt="">' +
               '<a href="ghost-page.html">ghost</a>'
      }
    });
    const login = await rowText(p, 'login');
    check('an HTML body still reports its own word count', /is about \d+ words/.test(login), login.match(/about \d+ words/));
    check('an img with NO alt attribute is still reported', /1 image\(s\).*no alt text/i.test(login), login.slice(0, 300));
    check('a decorative alt="" in hand-written HTML is still allowed', !/2 image\(s\)/i.test(login), login.slice(0, 300));
    check('an unknown link in an HTML body is still reported', /ghost-page\.html/.test(login), login.slice(0, 400));
    check('the row count on the dashboard is unchanged', (await p.$$('#seoDashboard .seorow')).length === 7);
    check('no console errors on the regression pass', errs.length === 0, errs);
    await ctx.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
