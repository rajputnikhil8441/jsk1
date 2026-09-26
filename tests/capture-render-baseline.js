/* =====================================================================
   CAPTURE THE RENDERED BASELINE  (support script, not a test suite)
   ---------------------------------------------------------------------
   Phase 3 moves JSK1's content out of js/cms.js DEFAULTS and into the
   brand fallback layer. The bytes of js/brand.js therefore change, which
   means its Phase 0 fixture cannot be the baseline for this step.

   What must NOT change is what a visitor and a crawler actually receive.
   So this captures that instead: every page rendered with an EMPTY
   Supabase row, which is precisely the case where DEFAULTS and brand.js
   show through rather than being overridden by published content.

       node capture-render-baseline.js          write the fixture
       node capture-render-baseline.js --check  print, write nothing

   Run before the refactor, then assert against it after. Re-capture only
   when JSK1's rendered output is meant to change, in its own commit.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://localhost:8777';
const OUT = path.join(__dirname, 'fixtures', 'render-baseline-jsk1.json');
const CHECK = process.argv.indexOf('--check') > -1;

const PAGES = ['index.html', 'about.html', 'contact.html', 'login.html',
               'register.html', '404.html', 'privacy-policy.html', 'responsible-gaming.html'];

/* Everything a visitor or a crawler can observe, normalised so that
   whitespace differences alone cannot fail a comparison. */
async function snapshot(p) {
  return p.evaluate(() => {
    const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    const meta = n => { const e = document.head.querySelector(`meta[name="${n}"]`); return e ? norm(e.content) : null; };
    const prop = n => { const e = document.head.querySelector(`meta[property="${n}"]`); return e ? norm(e.content) : null; };
    const link = r => { const e = document.head.querySelector(`link[rel="${r}"]`); return e ? e.getAttribute('href') : null; };
    return {
      title: norm(document.title),
      description: meta('description'),
      robots: meta('robots'),
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
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  /* EMPTY row: no published content, so DEFAULTS + brand.js decide everything. */
  await ctx.route('**supabase.co/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  const out = {
    _comment: 'Rendered output of every JSK1 page with an EMPTY Supabase row — the case where ' +
              'js/cms.js DEFAULTS and js/brand.js are what a visitor sees. Phase 3 moves content ' +
              'between those two layers and must not change a single value here.',
    pages: {}
  };
  for (const f of PAGES) {
    const p = await ctx.newPage();
    await p.goto(`${BASE}/${f}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(600);
    out.pages[f] = await snapshot(p);
    await p.close();
  }
  await b.close();

  const json = JSON.stringify(out, null, 1) + '\n';
  if (CHECK) { console.log(json.slice(0, 1500) + '\n...'); console.log('--check: nothing written.'); return; }
  fs.writeFileSync(OUT, json, 'utf8');
  console.log('wrote ' + path.relative(path.join(__dirname, '..'), OUT) +
              ' (' + json.length + ' bytes, ' + PAGES.length + ' pages)');
})();
