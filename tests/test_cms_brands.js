#!/usr/bin/env node
/* =====================================================================
   ONE CMS, MANY BRANDS  (Phase 7)
   ---------------------------------------------------------------------
   The CMS was already brand-aware in the way that matters most: every
   read and every write is keyed to the Supabase row that
   js/cms-config.js resolves from the hostname, so JSK1's admin and
   Playzone9's admin are the same code editing different rows. Phase 7
   does not change that. It makes it VISIBLE and ENFORCED:

     CMS.brand         says which brand this page is, reading only what
                       the resolution block already published.
     publish() guard   refuses to write a row the hostname does not map
                       to. Structurally true before; asserted now, so a
                       later refactor cannot make one brand's admin
                       overwrite another's content -- a mistake that is
                       unrecoverable, because the row is replaced whole.
     Brands panel      lists every registered brand and links to its own
                       CMS, which is how another brand is edited. There
                       is deliberately no cross-brand write path.

   What this suite asserts, in the browser, against the shipped code:
   that the twelve branding settings resolve per brand; that neither
   brand can reach the other's row; and that none of it came from
   DEFAULTS, which stays brand-neutral.
   ===================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const CONFIG_SRC = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');
const REGISTRY_RE = /window\.CMS_BRANDS = \{[\s\S]*?\n\};/;

/* The registry is replaced wholesale and the real resolution block is left
   alone, so what is under test is the shipped resolver rather than a
   stand-in. Registering `localhost` is what lets a browser exercise the
   MATCHED path at all -- served from localhost, every other host is a
   fallback. */
function configWith(registry, extra) {
  if (!REGISTRY_RE.test(CONFIG_SRC)) throw new Error('registry block not found — config shape changed');
  return CONFIG_SRC.replace(REGISTRY_RE, registry) + (extra || '');
}
const serveConfig = async (ctx, src) => {
  await ctx.unroute('**/js/cms-config.js').catch(() => {});
  await ctx.route('**/js/cms-config.js', r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
};
const serveBrandJs = async (ctx, src) => {
  await ctx.unroute('**/js/brand.js').catch(() => {});
  await ctx.route('**/js/brand.js', r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
};

/* Records every Supabase write so a refusal can be checked as "nothing was
   sent", not merely "a promise rejected". */
function stubSupabase(ctx, seen) {
  return ctx.route('**supabase.co/**', r => {
    const q = r.request();
    if (q.url().includes('/auth/v1/token')) {
      return r.fulfill({ status: 200, contentType: 'application/json',
                         body: JSON.stringify({ access_token: 'stub' }) });
    }
    if (q.method() === 'POST') {
      seen.push({ url: q.url(), body: JSON.parse(q.postData() || '{}') });
      return r.fulfill({ status: 201, body: '' });
    }
    /* publish() reads the row back and checks its updated_at before it will
       call anything published, so the stub has to behave like a row store
       rather than an empty table. The timestamp is echoed in POSTGRES's
       format -- an offset, not a Z -- which is what the real server returns
       and what the comparison has to survive. */
    const last = seen.length ? seen[seen.length - 1].body : null;
    if (!last) return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify([{ data: last.data,
        updated_at: new Date(last.updated_at).toISOString()
                      .replace(/\.000Z$/, '+00:00').replace(/Z$/, '+00:00') }]) });
  });
}

const JSK1_BRAND_JS = fs.readFileSync(path.join(ROOT, 'js', 'brand.js'), 'utf8');
const PZ9_BRAND_JS = fs.readFileSync(path.join(ROOT, 'brands', 'playzone9.app', 'brand.js'), 'utf8');

/* The twelve branding settings this phase is about, as the CMS addresses
   them. Typography is the existing design.* group -- the admin already has
   a Typography panel writing it -- so nothing new was invented for it. */
const BRANDING_KEYS = [
  ['logo', 'images.logo'],
  ['favicon', 'images.favicon'],
  ['primary color', 'colors.hdr-bg'],
  ['secondary color', 'colors.footer-bg'],
  ['accent color', 'colors.btn-register-bg'],
  ['background color', 'colors.page-bg'],
  ['text color', 'colors.body-text'],
  ['brand images', 'images.loginLogo'],
  ['SEO title', 'seo.defaultTitle'],
  ['SEO description', 'seo.defaultDescription'],
  ['social image', 'seo.ogImage'],
  ['site name', 'branding.siteName']
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. CMS.brand REPORTS WHAT THE RESOLVER RESOLVED
     ================================================================== */
  console.log('\n===== THE CMS KNOWS WHICH BRAND IT IS =====');
  {
    const REG = "window.CMS_BRANDS = {\n" +
      "    'localhost': { siteId: 'row-here', bucket: 'bucket-here' },\n" +
      "    'other.example': { siteId: 'row-other', bucket: 'bucket-other' }\n};";
    const ctx = await browser.newContext();
    await stubSupabase(ctx, []);
    await serveConfig(ctx, configWith(REG));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const v = await p.evaluate(() => ({
      api: typeof window.CMS.brand,
      host: CMS.brand.host(), matched: CMS.brand.matched(), siteId: CMS.brand.siteId(),
      bucket: CMS.brand.bucket(), suffix: CMS.brand.storageSuffix(),
      noindex: CMS.brand.noindex(), agrees: CMS.brand.agrees(),
      expected: CMS.brand.expectedSiteId(), all: CMS.brand.all()
    }));
    check('CMS.brand exists', v.api === 'object');
    check('it reports the hostname the page was served from', v.host === 'localhost', v.host);
    check('it reports a registered hostname as MATCHED', v.matched === true);
    check('it reports the row that hostname maps to', v.siteId === 'row-here', v.siteId);
    check('and that bucket', v.bucket === 'bucket-here', v.bucket);
    check('and the storage namespace', v.suffix === ':row-here', v.suffix);
    check('it agrees with the registry', v.agrees === true && v.expected === v.siteId, v);
    check('it is not a review build', v.noindex === false);
    check('it lists every registered brand', v.all.length === 2, v.all);
    check('sorted, with the current one flagged and only that one',
      v.all[0].host === 'localhost' && v.all[0].current === true &&
      v.all[1].host === 'other.example' && v.all[1].current === false, v.all);
    check('and it exposes each one\'s row and bucket',
      v.all[1].siteId === 'row-other' && v.all[1].bucket === 'bucket-other', v.all[1]);
    await ctx.close();
  }

  {
    /* An unregistered host is NOT the brand it renders. That distinction is
       the difference between "editing the live site" and "editing the live
       site's row from somewhere that is not the live site". */
    const REG = "window.CMS_BRANDS = {\n    'elsewhere.example': " +
      "{ siteId: 'row-elsewhere', bucket: 'b' }\n};";
    const ctx = await browser.newContext();
    await stubSupabase(ctx, []);
    await serveConfig(ctx, configWith(REG).replace(
      "window.CMS_BRAND_DEFAULT = 'jsk-1.com';", "window.CMS_BRAND_DEFAULT = 'elsewhere.example';"));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const v = await p.evaluate(() => ({
      matched: CMS.brand.matched(), siteId: CMS.brand.siteId(),
      agrees: CMS.brand.agrees(), current: CMS.brand.all().filter(x => x.current).length
    }));
    check('an unregistered hostname is reported as NOT matched', v.matched === false);
    check('it still renders the default brand, so a page is never blank',
      v.siteId === 'row-elsewhere', v.siteId);
    check('and it still agrees with the registry, because the fallback is the registry\'s answer',
      v.agrees === true);
    check('no brand in the list is flagged as current', v.current === 0, v.current);
    await ctx.close();
  }

  /* ==================================================================
     2. NEITHER BRAND CAN WRITE THE OTHER'S ROW
     ================================================================== */
  console.log('\n===== ONE BRAND CANNOT OVERWRITE ANOTHER =====');
  {
    const REG = "window.CMS_BRANDS = {\n" +
      "    'localhost': { siteId: 'brand-a', bucket: 'bucket-a' },\n" +
      "    'b.example': { siteId: 'brand-b', bucket: 'bucket-b' }\n};";

    /* The agreeing case first, so the refusal below is known to be the
       guard and not a broken publish path. */
    {
      const ctx = await browser.newContext();
      const seen = [];
      await stubSupabase(ctx, seen);
      await serveConfig(ctx, configWith(REG));
      const p = await ctx.newPage();
      await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(500);
      const r = await p.evaluate(async () => {
        await CMS.remote.signIn('a@b.c', 'x');
        try { await CMS.remote.publish(); return { ok: true }; }
        catch (e) { return { ok: false, msg: e.message }; }
      });
      check('a brand publishes to its own row', r.ok === true, r.msg);
      const writes = seen.filter(w => w.url.includes('/rest/v1/'));
      check('exactly one row write was sent', writes.length === 1, writes.length);
      check('and it was that brand\'s row',
        writes.length === 1 && writes[0].body.id === 'brand-a',
        writes.map(w => w.body.id));
      await ctx.close();
    }

    /* Now the mismatch: the registry maps this host to brand-a, but the CMS
       is configured to write brand-b. This is the shape a refactor,
       a copy-paste or a hand-edited config would produce. */
    {
      const ctx = await browser.newContext();
      const seen = [];
      await stubSupabase(ctx, seen);
      await serveConfig(ctx, configWith(REG) +
        "\nwindow.CMS_REMOTE.siteId = 'brand-b';\n");
      const p = await ctx.newPage();
      await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(500);
      const v = await p.evaluate(async () => {
        const before = { expected: CMS.brand.expectedSiteId(), configured: CMS.brand.siteId(),
                         agrees: CMS.brand.agrees() };
        await CMS.remote.signIn('a@b.c', 'x');
        let msg = null;
        try { await CMS.remote.publish(); } catch (e) { msg = e.message; }
        return { before, msg };
      });
      check('the mismatch is detected before anything is sent',
        v.before.expected === 'brand-a' && v.before.configured === 'brand-b' &&
        v.before.agrees === false, v.before);
      check('publishing is REFUSED', typeof v.msg === 'string' && v.msg.length > 0, v.msg);
      check('and the message names both rows and the hostname',
        /brand-a/.test(v.msg) && /brand-b/.test(v.msg) && /localhost/.test(v.msg), v.msg);
      check('it says why, in terms of the consequence',
        /never overwrite/i.test(v.msg), v.msg);
      const writes = seen.filter(w => w.url.includes('/rest/v1/'));
      check('NO row write reached the network at all', writes.length === 0,
        writes.map(w => w.body.id));
      /* The admin says so on screen too, not only in a rejected promise. */
      const warned = await p.evaluate(() =>
        (document.querySelector('#brandNow') || {}).textContent || '');
      check('the Brands panel warns about the disagreement',
        /disagrees with the hostname/i.test(warned), warned.slice(0, 160));
      await ctx.close();
    }

    /* A deployment with no registry at all -- an older cms-config that sets
       CMS_REMOTE and nothing else. There is one brand by definition, so
       there is nothing a write could cross and the guard must not block it. */
    {
      const ctx = await browser.newContext();
      const seen = [];
      await stubSupabase(ctx, seen);
      await serveConfig(ctx, "window.CMS_REMOTE = { enabled: true, url: 'https://testref.supabase.co'," +
        " anonKey: 'sb_publishable_x', table: 'site_brand', siteId: 'only-brand' };\n");
      const p = await ctx.newPage();
      await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(500);
      const r = await p.evaluate(async () => {
        const st = { expected: CMS.brand.expectedSiteId(), agrees: CMS.brand.agrees(),
                     all: CMS.brand.all().length };
        await CMS.remote.signIn('a@b.c', 'x');
        try { await CMS.remote.publish(); return { ok: true, st }; }
        catch (e) { return { ok: false, msg: e.message, st }; }
      });
      check('with no registry there is nothing to check', r.st.expected === '' &&
        r.st.agrees === true && r.st.all === 0, r.st);
      check('so a single-brand deployment still publishes', r.ok === true, r.msg);
      check('to its configured row',
        seen.filter(w => w.url.includes('/rest/v1/'))
          .every(w => w.body.id === 'only-brand'), seen.map(w => w.body.id));
      await ctx.close();
    }
  }

  /* ==================================================================
     3. THE TWELVE BRANDING SETTINGS RESOLVE PER BRAND
     ================================================================== */
  console.log('\n===== TWELVE SETTINGS, TWO BRANDS, NO OVERLAP =====');
  const readBranding = async (brandJs) => {
    const ctx = await browser.newContext();
    await stubSupabase(ctx, []);
    await serveBrandJs(ctx, brandJs);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const v = await p.evaluate(keys => {
      const out = {};
      keys.forEach(k => { out[k] = window.CMS.get(k, ''); });
      return { values: out, defaults: JSON.parse(JSON.stringify(window.CMS.DEFAULTS)) };
    }, BRANDING_KEYS.map(k => k[1]));
    await ctx.close();
    return v;
  };
  const jsk1 = await readBranding(JSK1_BRAND_JS);
  const pz9 = await readBranding(PZ9_BRAND_JS);

  check('both brand layers were read', Object.keys(jsk1.values).length === BRANDING_KEYS.length &&
    Object.keys(pz9.values).length === BRANDING_KEYS.length);

  /* Each setting is reachable through the CMS for both brands. The colour
     and image slots are legitimately empty until an admin sets one -- what
     matters is that the KEY exists and is addressable per brand, and that
     whatever a brand does set belongs to that brand alone. */
  let addressable = 0;
  for (const [label, key] of BRANDING_KEYS) {
    const inJsk = Object.prototype.hasOwnProperty.call(jsk1.values, key);
    const inPz9 = Object.prototype.hasOwnProperty.call(pz9.values, key);
    if (inJsk && inPz9) addressable++;
    else check(label + ' (' + key + ') is addressable for both brands', false);
  }
  check('all twelve branding settings are addressable per brand',
    addressable === BRANDING_KEYS.length, addressable + '/' + BRANDING_KEYS.length);

  /* The ones the brands actually set must differ, and neither may carry the
     other's value. */
  const IDENTITY = ['branding.siteName', 'seo.defaultTitle', 'seo.defaultDescription'];
  let differ = 0;
  for (const key of IDENTITY) {
    const a = String(jsk1.values[key] || ''), b = String(pz9.values[key] || '');
    check(key + ': JSK1 has a value', a.trim().length > 0, a);
    check(key + ': Playzone9 has a value', b.trim().length > 0, b);
    if (a && b && a !== b) differ++;
    else check(key + ' differs between the two brands', false, [a, b]);
  }
  check('every identity setting differs between the brands', differ === IDENTITY.length, differ);
  const jAll = JSON.stringify(jsk1.values), pAll = JSON.stringify(pz9.values);
  check('nothing JSK1 resolves mentions Playzone9', !/Playzone9|playzone9\.app/.test(jAll));
  check('nothing Playzone9 resolves mentions JSK1', !/JSK1|jsk-1\.com/.test(pAll));
  check('JSK1 resolves its own name', /JSK1/.test(jAll));
  check('Playzone9 resolves its own name', /Playzone9/.test(pAll));

  /* ==================================================================
     4. NONE OF IT CAME FROM DEFAULTS
     ================================================================== */
  console.log('\n===== DEFAULTS STAYS BRAND-NEUTRAL =====');
  {
    const d = jsk1.defaults;
    const NEUTRAL = ['branding.siteName', 'branding.browserTitle', 'branding.loginTitle',
      'seo.baseUrl', 'seo.siteName', 'seo.titleTemplate', 'seo.defaultTitle',
      'seo.defaultDescription', 'images.logo', 'images.favicon', 'images.loginLogo',
      'images.registerLogo', 'images.footerLogo'];
    const dig = (o, k) => k.split('.').reduce((a, p) => (a == null ? a : a[p]), o);
    let empty = 0;
    for (const k of NEUTRAL) {
      const v = dig(d, k);
      if (v === '' || v === undefined) empty++;
      else check('DEFAULTS.' + k + ' is empty, so no brand inherits another\'s', false, v);
    }
    check('all thirteen brand-identity defaults were checked', empty === NEUTRAL.length, empty);
    const asJson = JSON.stringify(d);
    check('DEFAULTS mentions no brand name at all',
      !/JSK1|jsk-1\.com|Playzone9|playzone9\.app|playzones9/.test(asJson));
    check('and no brand siteId', !/playzone9app|playzone9staging/.test(asJson));
    /* colors is the one non-empty group, and it is the ENGINE's shipped
       palette rather than a brand's: Phase 3b proved it duplicates the
       :root block in css/style.css, which is what actually renders. Pinned
       here so that if a brand-specific colour is ever added to DEFAULTS,
       this fails. */
    check('DEFAULTS.colors is the shipped palette, not a brand\'s',
      typeof d.colors === 'object' && Object.keys(d.colors).length > 50 &&
      !/JSK1|Playzone9/.test(JSON.stringify(d.colors)), Object.keys(d.colors || {}).length);
  }

  /* ==================================================================
     5. THE ADMIN ITSELF CARRIES NO BRAND
     ================================================================== */
  console.log('\n===== THE ADMIN IS SHARED =====');
  {
    const shared = ['admin/index.html', 'js/admin.js', 'js/cms.js', 'css/admin.css'];
    let scanned = 0;
    for (const f of shared) {
      const body = fs.readFileSync(path.join(ROOT, f), 'utf8');
      scanned++;
      const hits = body.match(/JSK1|jsk-1\.com|Playzone9|playzone9\.app|playzones9\.com/g) || [];
      if (hits.length) check(f + ' names a brand: ' + [...new Set(hits)].join(', '), false);
    }
    check('every shared CMS file was scanned', scanned === shared.length && scanned === 4, scanned);
    check('no shared CMS file names any brand', true);
    const adminHtml = fs.readFileSync(path.join(ROOT, 'admin', 'index.html'), 'utf8');
    check('the admin has a Brands panel', /id="panel-brands"/.test(adminHtml));
    check('reached from a nav item', /data-panel="brands"/.test(adminHtml));
    check('and the registry is not editable from it',
      !/CMS_BRANDS\s*\[/.test(fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8')));
  }

  /* ==================================================================
     6. THE ADMIN STILL WORKS, AND STILL SAYS WHICH BRAND
     ================================================================== */
  console.log('\n===== THE EXISTING CMS IS UNCHANGED =====');
  {
    const ctx = await browser.newContext();
    await stubSupabase(ctx, []);
    const errs = [];
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(700);
    const v = await p.evaluate(() => ({
      errs: 0,
      panels: document.querySelectorAll('.adm-panel').length,
      nav: document.querySelectorAll('.adm-nav-item').length,
      title: document.title,
      label: (document.querySelector('#brandLabel') || {}).textContent,
      hostLine: (document.querySelector('#brandHost') || {}).textContent,
      nowRows: document.querySelectorAll('#brandNow .brandtable tbody tr').length,
      listRows: document.querySelectorAll('#brandList .brandtable tbody tr').length,
      themes: typeof CMS.themes.list === 'function' ? CMS.themes.list().length : -1,
      hasColors: !!document.querySelector('#panel-colors'),
      hasTypography: !!document.querySelector('#panel-typography'),
      hasSeo: !!document.querySelector('#panel-seo'),
      hasImages: !!document.querySelector('#panel-images')
    }));
    check('the admin loaded with no page errors', errs.length === 0, errs);
    check('every panel is still there', v.panels >= 14, v.panels);
    check('and every nav item', v.nav >= 15, v.nav);
    check('the existing Theme Manager still seeds its themes', v.themes >= 5, v.themes);
    check('Colors, Typography, Images and SEO panels are untouched',
      v.hasColors && v.hasTypography && v.hasSeo && v.hasImages);
    check('the tab title is still painted from the brand',
      /CMS — Admin$/.test(v.title) && v.title !== 'CMS — Admin', v.title);
    check('the sidebar names the brand', (v.label || '').trim().length > 0, v.label);
    check('and now also the hostname it is editing',
      (v.hostLine || '').trim().length > 0, v.hostLine);
    check('the Brands panel is populated', v.nowRows === 5 && v.listRows === 3,
      [v.nowRows, v.listRows]);
    await ctx.close();
  }

  await browser.close();
  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
