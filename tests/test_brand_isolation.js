/* =====================================================================
   BRAND ISOLATION  (Phase 3)
   ---------------------------------------------------------------------
   js/cms.js used to ship the JSK1 brand inside DEFAULTS: site name,
   domain, every page title and meta description, and the full body copy
   of about, contact, responsible-gaming and privacy-policy. DEFAULTS is
   the lowest layer and is shared by every brand, so all of it was
   inherited by any second site wherever its own record happened to be
   missing a key.

   Phase 3 moved it one layer up, into js/brand.js, which is JSK1's own
   file. DEFAULTS now ships only the SHAPE of a brand.

   Two claims have to hold, and they pull in opposite directions:

   1. JSK1 RENDERS EXACTLY WHAT IT DID. Asserted against
      fixtures/render-baseline-jsk1.json -- 19 observable values per page
      across 8 pages, captured from the code as it stood before the move.

   2. A SECOND BRAND INHERITS NOTHING. The honest way to test this is the
      awkward way. JSK1's own .html files have JSK1 baked into them as the
      static fallback a crawler reads without JavaScript, so scanning a
      rendered JSK1 page for the word "JSK1" proves nothing. A second
      brand ships its OWN static HTML. So these tests serve JSK1's real
      markup with the brand names substituted out -- exactly what a second
      brand's generated page looks like -- and then anything saying "JSK1"
      in the result can only have come from the engine.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const BASELINE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'render-baseline-jsk1.json'), 'utf8'));
const PAGES = Object.keys(BASELINE.pages);
const BRAND_WORDS = /jsk-?1/i;

/* Identical to the capture script's snapshot(), so the comparison is
   against like for like. */
const snapshot = p => p.evaluate(() => {
  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const meta = n => { const e = document.head.querySelector(`meta[name="${n}"]`); return e ? norm(e.content) : null; };
  const prop = n => { const e = document.head.querySelector(`meta[property="${n}"]`); return e ? norm(e.content) : null; };
  const link = r => { const e = document.head.querySelector(`link[rel="${r}"]`); return e ? e.getAttribute('href') : null; };
  return {
    title: norm(document.title), description: meta('description'), robots: meta('robots'),
    canonical: link('canonical'),
    ogTitle: prop('og:title'), ogDescription: prop('og:description'),
    ogImage: prop('og:image'), ogSiteName: prop('og:site_name'), ogUrl: prop('og:url'),
    twTitle: meta('twitter:title'), twDescription: meta('twitter:description'), twImage: meta('twitter:image'),
    h1: Array.from(document.querySelectorAll('h1')).map(h => norm(h.textContent)),
    h2: Array.from(document.querySelectorAll('h2')).map(h => norm(h.textContent)),
    bodyText: norm(document.body.innerText).slice(0, 6000),
    footerText: norm((document.querySelector('footer.site-footer') || {}).innerText || ''),
    jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(s => { try { return JSON.parse(s.textContent); } catch (e) { return { UNPARSEABLE: norm(s.textContent) }; } }),
    logoAlt: (document.querySelector('.logo-img') || {}).alt || null,
    siteNameNodes: Array.from(document.querySelectorAll('[data-cms-text="branding.siteName"]')).map(n => norm(n.textContent))
  };
});

async function emptyRow(ctx) {
  await ctx.route('**supabase.co/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
}

/* Serves JSK1's real markup as a DIFFERENT brand's page would look: same
   structure, same data-cms binding hooks, none of JSK1's baked text. */
async function serveAsOtherBrand(ctx, brandJs) {
  await ctx.route(/\/(index|about|contact|login|register|404|privacy-policy|responsible-gaming)\.html(\?.*)?$/, async route => {
    const res = await ctx.request.get(route.request().url());
    let html = await res.text();
    html = html.replace(/JSK1/g, 'ACMEPLAY').replace(/jsk-1\.com/g, 'acmeplay.test');
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
  });
  await ctx.route('**/js/brand.js', r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: brandJs }));
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. JSK1 RENDERS EXACTLY WHAT IT RENDERED BEFORE THE MOVE
     ================================================================== */
  console.log('\n===== JSK1 IS UNCHANGED, FIELD BY FIELD =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    await emptyRow(ctx);
    let compared = 0, mismatched = [];
    for (const f of PAGES) {
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e)));
      await p.goto(`${BASE}/${f}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);
      const now = await snapshot(p);
      const was = BASELINE.pages[f];
      for (const k of Object.keys(was)) {
        compared++;
        if (JSON.stringify(was[k]) !== JSON.stringify(now[k])) mismatched.push(f + '.' + k);
      }
      check(`${f}: no page errors`, errs.length === 0, errs);
      await p.close();
    }
    check(`all ${PAGES.length} pages compared against the baseline`, compared === PAGES.length * 19, compared);
    check('every observable value is identical to before the move',
      mismatched.length === 0, mismatched);
    check('  and the baseline is not vacuous — it really holds JSK1 content',
      BRAND_WORDS.test(JSON.stringify(BASELINE.pages['index.html'])));
    await ctx.close();
  }

  /* ==================================================================
     1b. JSK1'S BRAND LAYER STILL SUPPLIES ITS VALUES
     ------------------------------------------------------------------
     The rendered baseline above cannot see this. Every page's static
     HTML already carries JSK1's text, and the CMS never overwrites a
     static value with an empty one -- so gutting js/brand.js would leave
     the rendered pages looking identical while the CMS itself knew
     nothing about the brand. The admin panels, the sitemap and any
     generated page would all be wrong. So the data layer is pinned
     directly, not only through what renders.
     ================================================================== */
  console.log('\n===== THE BRAND LAYER SUPPLIES JSK1 =====');
  {
    const ctx = await b.newContext();
    await emptyRow(ctx);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const v = await p.evaluate(() => ({
      siteName: window.CMS.get('branding.siteName', ''),
      browserTitle: window.CMS.get('branding.browserTitle', ''),
      loginTitle: window.CMS.get('branding.loginTitle', ''),
      seoBaseUrl: window.CMS.get('seo.baseUrl', ''),
      seoSiteName: window.CMS.get('seo.siteName', ''),
      seoTemplate: window.CMS.get('seo.titleTemplate', ''),
      seoTitle: window.CMS.get('seo.defaultTitle', ''),
      orgName: window.CMS.data().seo.organization.name,
      footerCopy: window.CMS.data().text['footer.copyright'],
      waMessage: window.CMS.data().text['support.whatsappMessage'],
      aboutTitle: window.CMS.data().pages.about.title,
      aboutBody: window.CMS.data().pages.about.body,
      homeHeading: window.CMS.data().pages.home.heading,
      homeUpdatedAt: window.CMS.data().pages.home.updatedAt
    }));
    check('branding.siteName is JSK1', v.siteName === 'JSK1', v.siteName);
    check('branding.browserTitle is set', /^JSK1 /.test(v.browserTitle), v.browserTitle);
    check('branding.loginTitle is set', v.loginTitle === 'Login — JSK1', v.loginTitle);
    check('seo.baseUrl is jsk-1.com', v.seoBaseUrl === 'https://jsk-1.com', v.seoBaseUrl);
    check('seo.siteName is JSK1', v.seoSiteName === 'JSK1', v.seoSiteName);
    check('seo.titleTemplate is JSK1\u2019s', v.seoTemplate === '%s | JSK1', v.seoTemplate);
    check('seo.defaultTitle is set', /JSK1/.test(v.seoTitle), v.seoTitle);
    check('the Organization schema name is JSK1', v.orgName === 'JSK1', v.orgName);
    check('the footer copyright is JSK1\u2019s', /JSK1/.test(v.footerCopy), v.footerCopy);
    check('the WhatsApp message is JSK1\u2019s', /JSK1/.test(v.waMessage), v.waMessage);
    check('the about page title is JSK1\u2019s', /About JSK1/.test(v.aboutTitle), v.aboutTitle);
    check('the about page body copy survived the move',
      /is an online gaming site/.test(v.aboutBody), v.aboutBody.slice(0, 60));
    check('the home heading survived', /JSK1/.test(v.homeHeading), v.homeHeading);
    check('page updatedAt dates survived (the sitemap reads them)',
      /^\d{4}-\d\d-\d\d$/.test(v.homeUpdatedAt), v.homeUpdatedAt);
    await ctx.close();
  }

  /* ==================================================================
     2. THE HEADLINE TEST
        Empty Supabase row + empty brand.js -> the engine contributes no
        JSK1 anywhere. Run against a second brand's markup, because
        JSK1's own HTML legitimately contains JSK1.
     ================================================================== */
  console.log('\n===== EMPTY ROW + EMPTY brand.js: THE ENGINE ADDS NO JSK1 =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    await emptyRow(ctx);
    await serveAsOtherBrand(ctx, 'window.CMS_BRAND = {};\n');

    for (const f of PAGES) {
      const p = await ctx.newPage();
      await p.goto(`${BASE}/${f}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);
      const whole = await p.evaluate(() => document.documentElement.outerHTML);
      const hits = (whole.match(/jsk-?1/gi) || []);
      check(`${f}: nothing in the rendered page says JSK1 or jsk-1.com`,
        hits.length === 0, hits.slice(0, 6));
      await p.close();
    }
    await ctx.close();
  }

  /* ==================================================================
     3. THE SAME, WITH A SECOND BRAND'S OWN brand.js
     ================================================================== */
  console.log('\n===== A SECOND BRAND WITH ITS OWN brand.js INHERITS NOTHING =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    await emptyRow(ctx);
    await serveAsOtherBrand(ctx, `window.CMS_BRAND = {
      branding: { siteName: 'ACMEPLAY', browserTitle: 'ACMEPLAY — Official Site' },
      seo: { baseUrl: 'https://acmeplay.test', siteName: 'ACMEPLAY',
             titleTemplate: '%s | ACMEPLAY', defaultTitle: 'ACMEPLAY — Official Site',
             defaultDescription: 'ACMEPLAY is the official ACMEPLAY site.' },
      text: { 'footer.copyright': '(c) 2026 ACMEPLAY' },
      pages: { home: { title: 'ACMEPLAY — Official Site', heading: 'ACMEPLAY' },
               about: { title: 'About ACMEPLAY', body: '<p>About ACMEPLAY.</p>' } }
    };\n`);

    for (const f of ['index.html', 'about.html', 'contact.html', 'privacy-policy.html']) {
      const p = await ctx.newPage();
      await p.goto(`${BASE}/${f}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(600);
      const s = await snapshot(p);
      const whole = await p.evaluate(() => document.documentElement.outerHTML);
      check(`${f}: no JSK1 anywhere in the page`, !BRAND_WORDS.test(whole),
        (whole.match(/.{0,40}jsk-?1.{0,40}/i) || [])[0]);
      check(`  ${f}: its own brand shows instead`, /ACMEPLAY/.test(s.title) || /ACMEPLAY/.test(s.bodyText),
        s.title);
      await p.close();
    }
    /* the pages this brand said nothing about keep their OWN static text */
    const p = await ctx.newPage();
    await p.goto(`${BASE}/responsible-gaming.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    const s = await snapshot(p);
    check('a page the brand left unset keeps its own static title, not JSK1’s',
      !BRAND_WORDS.test(s.title) && s.title.length > 0, s.title);
    check('  and its own static body, not JSK1’s copy', !BRAND_WORDS.test(s.bodyText),
      (s.bodyText.match(/.{0,40}jsk-?1.{0,40}/i) || [])[0]);
    await p.close();
    await ctx.close();
  }

  /* ==================================================================
     4. SEO FALLBACKS ARE BRAND-SAFE
     ================================================================== */
  console.log('\n===== SEO FALLBACK VALUES CARRY NO BRAND =====');
  {
    const ctx = await b.newContext();
    await emptyRow(ctx);
    await ctx.route('**/js/brand.js', r =>
      r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.CMS_BRAND = {};\n' }));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const seo = await p.evaluate(() => ({
      baseUrl: window.CMS.get('seo.baseUrl', ''), siteName: window.CMS.get('seo.siteName', ''),
      titleTemplate: window.CMS.get('seo.titleTemplate', ''),
      defaultTitle: window.CMS.get('seo.defaultTitle', ''),
      defaultDescription: window.CMS.get('seo.defaultDescription', ''),
      orgName: window.CMS.data().seo.organization.name,
      brandingSiteName: window.CMS.get('branding.siteName', ''),
      footerCopyright: window.CMS.data().text['footer.copyright'],
      pageTitles: Object.keys(window.CMS.data().pages).map(k => window.CMS.data().pages[k].title),
      pageBodies: Object.keys(window.CMS.data().pages).map(k => window.CMS.data().pages[k].body)
    }));
    for (const [k, v] of Object.entries(seo)) {
      if (Array.isArray(v)) check(`DEFAULTS ${k} are all empty`, v.every(x => x === ''), v.filter(x => x !== ''));
      else check(`DEFAULTS ${k} is empty`, v === '', v);
    }
    check('with no title anywhere, the STATIC title survives rather than being blanked',
      (await p.title()).length > 0, await p.title());
    await ctx.close();
  }

  /* ==================================================================
     5. THE ENGINE SOURCE ITSELF
     ================================================================== */
  console.log('\n===== js/cms.js NO LONGER CARRIES THE BRAND =====');
  {
    const cms = fs.readFileSync(path.join(ROOT, 'js', 'cms.js'), 'utf8');
    const hits = cms.split('\n').map((l, i) => [i + 1, l])
      .filter(([, l]) => BRAND_WORDS.test(l));
    /* One allowed: a format identifier written into exported Page Builder
       library files. It is never rendered and never validated on import,
       so it is metadata rather than brand content -- and changing an
       on-disk format string belongs with a version bump, not here. */
    const ALLOWED = /kind: 'jsk1-page-builder-library'/;
    const unexpected = hits.filter(([, l]) => !ALLOWED.test(l));
    check('no JSK1 brand content remains in the shared engine',
      unexpected.length === 0, unexpected.map(([n, l]) => n + ': ' + l.trim()));
    check('  the one remaining reference is the documented format identifier',
      hits.length === 1 && ALLOWED.test(hits[0][1]), hits.map(([n]) => n));

    /* This suite found these two on its first run: js/main.js hardcoded
       JSK1 into the WhatsApp support message and into a (dead) siteName,
       in code shared by every brand. Both now read through the CMS. */
    const main = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
    check('js/main.js carries no brand name at all', !BRAND_WORDS.test(main),
      (main.match(/.{0,50}jsk-?1.{0,50}/i) || [])[0]);
    check('  the WhatsApp message is read from the CMS',
      /cmsText\('support\.whatsappMessage'/.test(main));
    check('  and its fallback names no brand',
      /'Hello%2C%20I%20need%20support\.'/.test(main));

    const brand = fs.readFileSync(path.join(ROOT, 'js', 'brand.js'), 'utf8');
    check('js/brand.js is where the brand now lives', BRAND_WORDS.test(brand));
    check('  and it carries the page copy that used to be in DEFAULTS',
      /About JSK1/.test(brand) && /is an online gaming site/.test(brand));
    check('  and JSK1\u2019s WhatsApp message',
      /support%20on%20JSK1/.test(brand));

    /* Every OTHER file a brand's pages load must be brand-free too. */
    for (const f of ['js/menu.js', 'js/seo-files.js', 'js/admin-media.js', 'js/admin-builder.js']) {
      check(`${f} carries no brand name`,
        !BRAND_WORDS.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    }
    /* js/admin.js is admin-only, never served to a visitor, but an admin
       for another brand should not read JSK1's domain in a help hint. */
    const adm = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');
    check('js/admin.js no longer uses JSK1\u2019s domain as an example',
      !BRAND_WORDS.test(adm), (adm.match(/.{0,50}jsk-?1.{0,50}/i) || [])[0]);
  }

  /* ==================================================================
     5b. THE WHATSAPP LINK FOLLOWS THE BRAND, NOT JSK1
     ================================================================== */
  console.log('\n===== THE SUPPORT LINK CARRIES THE RIGHT BRAND =====');
  {
    const ctx = await b.newContext();
    await emptyRow(ctx);
    await serveAsOtherBrand(ctx, "window.CMS_BRAND = { branding: { whatsapp: '9999999999' }," +
      " text: { 'support.whatsappMessage': 'Hello%20from%20ACMEPLAY' } };\n");
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const msg = await p.evaluate(() => (typeof CONFIG !== 'undefined' ? CONFIG.whatsappMessage : null));
    check('a second brand\u2019s support message is its own', msg === 'Hello%20from%20ACMEPLAY', msg);
    check('  and CONFIG.siteName is not JSK1', !BRAND_WORDS.test(
      String(await p.evaluate(() => (typeof CONFIG !== 'undefined' ? CONFIG.siteName : '')))));
    await ctx.close();
  }
  {
    /* with nothing set at all, the fallback is brand-free */
    const ctx = await b.newContext();
    await emptyRow(ctx);
    await ctx.route('**/js/brand.js', r =>
      r.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.CMS_BRAND = {};\n' }));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const msg = await p.evaluate(() => (typeof CONFIG !== 'undefined' ? CONFIG.whatsappMessage : null));
    check('with no brand configured the support message names nobody',
      msg === 'Hello%2C%20I%20need%20support.', msg);
    await ctx.close();
  }

  /* ==================================================================
     6. THE CMS AND PAGE BUILDER STILL WORK
     ================================================================== */
  console.log('\n===== PUBLISHED CONTENT STILL OVERRIDES EVERYTHING =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    const row = { data: { branding: { siteName: 'FROM-THE-ROW' },
                          pages: { about: { title: 'Row Title', builder: {
                            schemaVersion: 2, status: 'published', updatedAt: '2026-01-01',
                            sections: [{ id: 's1', type: 'text', enabled: true,
                              visibility: { desktop: true, tablet: true, mobile: true },
                              style: {}, responsive: {},
                              elements: [{ id: 'e1', type: 'heading',
                                content: { text: 'Builder Heading', level: 'h2' }, style: {}, responsive: {} }] }] } } } },
                  updated_at: '2026-01-01T00:00:00Z' };
    await ctx.route('**supabase.co/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([row]) }));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    check('a published row still overrides the brand fallback',
      (await p.evaluate(() => window.CMS.get('branding.siteName', ''))) === 'FROM-THE-ROW');
    /* The row set only the PAGE title. seo.titleTemplate and seo.siteName
       still come from brand.js, so the template is applied exactly as it
       was before Phase 3 -- 'Row Title' becomes 'Row Title | JSK1'. My
       first version of this check asserted a bare 'Row Title' and was
       simply wrong about the existing behaviour. */
    check('the row title is used, with the brand template still applied',
      (await p.title()) === 'Row Title | JSK1', await p.title());
    check('published Page Builder sections still render',
      (await p.$$('[data-cms-sections="about"] .pb-el')).length > 0);
    check('  and their content is on the page',
      /Builder Heading/.test(await p.evaluate(() => document.body.innerText)));
    await ctx.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
