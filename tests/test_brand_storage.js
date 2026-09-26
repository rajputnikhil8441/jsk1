/* =====================================================================
   BRAND-SCOPED BROWSER STORAGE  (Phase 2)
   ---------------------------------------------------------------------
   localStorage and sessionStorage are per ORIGIN, so two brands on two
   domains were never at risk of colliding. The case that matters is two
   brands sharing an origin -- which the generated per-brand config makes
   entirely possible: example.com/jsk1/ and example.com/pz9/ are one
   origin, and each folder ships its own cms-config.js naming its own
   default brand. Without scoping, the second would read the first's
   cached record and inherit its admin session token.

   Three keys exist and all three are scoped:
       whiteLabelCMS   localStorage   the master brand record
       cmsAdminToken   sessionStorage the admin session
       gateSeen        sessionStorage login-gate presentation state

   The exemption: the brand named by CMS_LEGACY_STORAGE_SITE_ID keeps the
   bare names, because its data is already in real browsers under them.
   Renaming those would orphan every cached brand and sign out every open
   admin session on the live site. JSK1 is that brand, and the first half
   of this suite exists to prove it stayed that way.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const CONFIG_SRC = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');

/* A two-brand registry, and a switch for which one is the default. Injected
   into the real config source so the resolution under test is the shipped
   code, not a stand-in. Phase 2 ships ONE brand; this is how the suffixed
   path gets exercised without shipping a second. */
const ONE_BRAND_BLOCK =
  "    'jsk-1.com': {\n        siteId: 'playzone9',\n        bucket: 'cms-media'\n    }";
const TWO_BRAND_BLOCK =
  "    'jsk-1.com': {\n        siteId: 'playzone9',\n        bucket: 'cms-media'\n    },\n" +
  "    'playzone9.app': { siteId: 'playzone9app', bucket: 'cms-media-pz9' }";

function configFor(defaultBrand) {
  let src = CONFIG_SRC.replace(ONE_BRAND_BLOCK, TWO_BRAND_BLOCK);
  if (src === CONFIG_SRC) throw new Error('two-brand injection failed — config shape changed');
  src = src.replace("window.CMS_BRAND_DEFAULT = 'jsk-1.com';",
                    "window.CMS_BRAND_DEFAULT = '" + defaultBrand + "';");
  return src;
}

/* Serves a chosen cms-config.js while leaving every other file real. */
async function serveConfig(ctx, src) {
  await ctx.unroute('**/js/cms-config.js').catch(() => {});
  await ctx.route('**/js/cms-config.js', r =>
    r.fulfill({ status: 200, contentType: 'application/javascript', body: src }));
}

async function stubSupabase(ctx, rowHolder) {
  await ctx.route('**supabase.co/**', r => {
    const q = r.request();
    if (q.url().includes('/auth/v1/token'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
    if (q.method() === 'POST') { rowHolder.row = JSON.parse(q.postData() || '{}'); return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify(rowHolder.row ? [{ data: rowHolder.row.data, updated_at: rowHolder.row.updated_at }] : []) });
  });
}

const storageDump = p => p.evaluate(() => {
  const ls = {}, ss = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = (localStorage.getItem(k) || '').length; }
  for (let i = 0; i < sessionStorage.length; i++) { const k = sessionStorage.key(i); ss[k] = sessionStorage.getItem(k); }
  return { ls, ss, cmsKey: window.CMS && window.CMS.KEY, suffix: window.CMS_STORAGE && window.CMS_STORAGE.suffix,
           siteId: window.CMS_REMOTE && window.CMS_REMOTE.siteId };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. JSK1 STILL USES THE BARE, UNSUFFIXED KEYS
     ================================================================== */
  console.log('\n===== JSK1 KEEPS THE KEYS ITS DATA IS ALREADY UNDER =====');
  {
    const ctx = await b.newContext();
    const holder = {};
    await stubSupabase(ctx, holder);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });

    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    let d = await storageDump(p);
    check('the suffix is empty for JSK1', d.suffix === '', d.suffix);
    check('the cache lives under the bare name', d.cmsKey === 'whiteLabelCMS', d.cmsKey);
    check('  and that is the key actually written to localStorage',
      Object.prototype.hasOwnProperty.call(d.ls, 'whiteLabelCMS'), Object.keys(d.ls));
    check('  with no suffixed key anywhere', !Object.keys(d.ls).some(k => /:/.test(k)), Object.keys(d.ls));

    /* the admin token, under its bare name */
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(500);
    d = await storageDump(p);
    check('sign in succeeds', !(await p.isVisible('#authGate')));
    check('the admin token is stored under the bare name',
      d.ss['cmsAdminToken'] === 'stub', d.ss);
    check('  and not under a suffixed one', !Object.keys(d.ss).some(k => /^cmsAdminToken:/.test(k)), Object.keys(d.ss));
    check('no console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     2. TWO BRANDS, ONE ORIGIN — THE CASE SCOPING EXISTS FOR
     ================================================================== */
  console.log('\n===== TWO BRANDS ON ONE ORIGIN DO NOT SEE EACH OTHER =====');
  {
    const ctx = await b.newContext();
    const holder = {};
    await stubSupabase(ctx, holder);
    const p = await ctx.newPage();

    /* --- brand A (JSK1, legacy, bare keys): sign in and cache --- */
    await serveConfig(ctx, configFor('jsk-1.com'));
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(500);
    await p.evaluate(() => { window.CMS.data().branding.siteName = 'BRAND-A-ONLY'; window.CMS.save(); });
    const a = await storageDump(p);
    check('brand A resolves to playzone9 with bare keys',
      a.siteId === 'playzone9' && a.suffix === '', a);
    check('brand A is signed in', a.ss['cmsAdminToken'] === 'stub', a.ss);

    /* --- brand B (playzone9app, suffixed): same origin, same tab --- */
    await serveConfig(ctx, configFor('playzone9.app'));
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const bDump = await storageDump(p);
    check('brand B resolves to playzone9app with a suffixed key',
      bDump.siteId === 'playzone9app' && bDump.suffix === ':playzone9app', bDump);
    check('  and its cache key is whiteLabelCMS:playzone9app',
      bDump.cmsKey === 'whiteLabelCMS:playzone9app', bDump.cmsKey);

    const leaked = await p.evaluate(() => window.CMS.get('branding.siteName', ''));
    check('brand B does NOT see brand A’s cached content',
      leaked !== 'BRAND-A-ONLY', leaked);
    check('brand B is NOT signed in by brand A’s token',
      await p.isVisible('#authGate'), bDump.ss);
    check('  because the token it looks for is suffixed and absent',
      bDump.ss['cmsAdminToken:playzone9app'] === undefined, bDump.ss);

    /* --- brand A's data survived untouched --- */
    const aStill = await p.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('whiteLabelCMS')).branding.siteName; }
      catch (e) { return null; }
    });
    check('brand A’s record is still intact under its own key',
      aStill === 'BRAND-A-ONLY', aStill);
    check('brand A’s token is still present', (await storageDump(p)).ss['cmsAdminToken'] === 'stub');

    /* --- switching back restores brand A completely --- */
    await serveConfig(ctx, configFor('jsk-1.com'));
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    check('switching back, brand A is still signed in', !(await p.isVisible('#authGate')));
    check('  and still has its own content',
      (await p.evaluate(() => window.CMS.get('branding.siteName', ''))) === 'BRAND-A-ONLY');
    await ctx.close();
  }

  /* ==================================================================
     3. THE storage EVENT ONLY FIRES FOR THIS BRAND'S KEY
     ------------------------------------------------------------------
     "Admin saves in one tab, site repaints in the other" must not mean
     "another brand saves and this site repaints from its record".
     ================================================================== */
  console.log('\n===== A CROSS-BRAND WRITE DOES NOT REPAINT THIS SITE =====');
  {
    const ctx = await b.newContext();
    const holder = {};
    await stubSupabase(ctx, holder);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);

    const before = await p.evaluate(() => window.CMS.get('branding.siteName', ''));

    /* another brand's key changing must be ignored */
    const afterForeign = await p.evaluate(() => {
      const rec = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      rec.branding = rec.branding || {}; rec.branding.siteName = 'FOREIGN-BRAND';
      localStorage.setItem('whiteLabelCMS:someotherbrand', JSON.stringify(rec));
      window.dispatchEvent(new StorageEvent('storage', { key: 'whiteLabelCMS:someotherbrand' }));
      return window.CMS.get('branding.siteName', '');
    });
    check('a write under another brand’s key is ignored', afterForeign === before, { before, afterForeign });

    /* this brand's own key changing must be honoured */
    const afterOwn = await p.evaluate(() => {
      const rec = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      rec.branding = rec.branding || {}; rec.branding.siteName = 'OWN-BRAND-UPDATE';
      localStorage.setItem('whiteLabelCMS', JSON.stringify(rec));
      window.dispatchEvent(new StorageEvent('storage', { key: 'whiteLabelCMS' }));
      return window.CMS.get('branding.siteName', '');
    });
    check('a write under this brand’s own key is honoured', afterOwn === 'OWN-BRAND-UPDATE', afterOwn);

    /* The sharper consequence of the key check. The listener does
       `state = null; apply()`, which re-reads from storage and so DISCARDS
       anything edited in memory but not yet saved. Firing that because
       some other brand wrote its own record would throw away an admin's
       unsaved work for no reason at all. */
    const unsaved = await p.evaluate(() => {
      window.CMS.data().branding.siteName = 'UNSAVED-IN-MEMORY';   /* deliberately no save() */
      window.dispatchEvent(new StorageEvent('storage', { key: 'whiteLabelCMS:someotherbrand' }));
      return window.CMS.get('branding.siteName', '');
    });
    check('another brand write does not discard unsaved in-memory edits',
      unsaved === 'UNSAVED-IN-MEMORY', unsaved);

    /* ...whereas this brand's own write legitimately does reload. */
    const ownWins = await p.evaluate(() => {
      window.CMS.data().branding.siteName = 'ALSO-UNSAVED';
      window.dispatchEvent(new StorageEvent('storage', { key: 'whiteLabelCMS' }));
      return window.CMS.get('branding.siteName', '');
    });
    check('this brand own write does reload from storage, as designed',
      ownWins === 'OWN-BRAND-UPDATE', ownWins);
    await ctx.close();
  }

  /* ==================================================================
     4. THE LOGIN GATE STILL WORKS, AND ITS FLAG IS SCOPED TOO
     ================================================================== */
  console.log('\n===== THE LOGIN GATE IS UNCHANGED =====');
  {
    const ctx = await b.newContext();
    const holder = {};
    await stubSupabase(ctx, holder);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);

    check('no gateSeen flag before the first click',
      (await p.evaluate(() => sessionStorage.getItem('gateSeen'))) === null);
    await p.evaluate(() => {
      const el = document.querySelector('.odds-btn, .casino-card a, .casino-card');
      if (el) el.click();
    });
    await p.waitForTimeout(400);
    check('the first click shows the toast rather than navigating',
      await p.isVisible('#gateToast'), await p.url());
    check('and it records the flag under the BARE name for JSK1',
      (await p.evaluate(() => sessionStorage.getItem('gateSeen'))) === '1');
    check('  with no suffixed gate flag',
      !(await p.evaluate(() => Object.keys(sessionStorage).some(k => /^gateSeen:/.test(k)))));
    check('no page errors from the gate', errs.length === 0, errs);
    await ctx.close();
  }
  {
    /* under a second brand the flag is suffixed, and the gate still works */
    const ctx = await b.newContext();
    const holder = {};
    await stubSupabase(ctx, holder);
    await serveConfig(ctx, configFor('playzone9.app'));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    await p.evaluate(() => {
      const el = document.querySelector('.odds-btn, .casino-card a, .casino-card');
      if (el) el.click();
    });
    await p.waitForTimeout(400);
    check('under a second brand the gate still shows its toast', await p.isVisible('#gateToast'));
    check('  and its flag is suffixed',
      (await p.evaluate(() => sessionStorage.getItem('gateSeen:playzone9app'))) === '1',
      await p.evaluate(() => Object.keys(sessionStorage)));
    check('  leaving the bare flag untouched',
      (await p.evaluate(() => sessionStorage.getItem('gateSeen'))) === null);
    await ctx.close();
  }

  /* ==================================================================
     5. THE FALLBACK: NO CMS_STORAGE AT ALL
     ------------------------------------------------------------------
     A page that loads cms.js without the config, or a test that stubs
     the config, must behave exactly as it did before brands existed.
     ================================================================== */
  console.log('\n===== WITHOUT THE CONFIG, THE HISTORICAL NAMES ARE USED =====');
  {
    const ctx = await b.newContext();
    const holder = {};
    await stubSupabase(ctx, holder);
    /* a config that declares CMS_REMOTE only -- exactly what
       test_supabase_keys.js does -- so CMS_STORAGE is undefined */
    await ctx.route('**/js/cms-config.js', r => r.fulfill({
      status: 200, contentType: 'application/javascript',
      body: "window.CMS_REMOTE = { enabled: true, url: 'https://testref.supabase.co'," +
            " anonKey: 'sb_publishable_x', table: 'site_brand', siteId: 'playzone9' };\n"
    }));
    const p = await ctx.newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    const d = await storageDump(p);
    check('CMS_STORAGE is genuinely absent',
      (await p.evaluate(() => typeof window.CMS_STORAGE)) === 'undefined');
    check('the cache key falls back to the historical bare name',
      d.cmsKey === 'whiteLabelCMS', d.cmsKey);
    check('  and that is what localStorage holds',
      Object.prototype.hasOwnProperty.call(d.ls, 'whiteLabelCMS'), Object.keys(d.ls));
    await ctx.close();
  }

  /* ==================================================================
     6. SOURCE-LEVEL: NO UNSCOPED STORAGE KEY REMAINS
     ================================================================== */
  console.log('\n===== EVERY STORAGE KEY IN SHIPPED JS GOES THROUGH THE HELPER =====');
  {
    const files = ['js/cms.js', 'js/main.js', 'js/admin.js', 'js/admin-builder.js', 'js/admin-media.js'];
    const literals = [];
    for (const f of files) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      /* a quoted literal handed straight to a storage call */
      const re = /(?:local|session)Storage\.(?:get|set|remove)Item\(\s*'([^']+)'/g;
      let m; while ((m = re.exec(src))) literals.push(f + ' -> ' + m[1]);
    }
    check('no storage call passes a hardcoded key string', literals.length === 0, literals);

    const cms = fs.readFileSync(path.join(ROOT, 'js', 'cms.js'), 'utf8');
    check('cms.js derives its cache key from CMS_STORAGE',
      /var KEY = \(window\.CMS_STORAGE[\s\S]{0,200}key\('whiteLabelCMS'\)/.test(cms));
    check('cms.js derives its token key from CMS_STORAGE',
      /var TOKEN_KEY = \(window\.CMS_STORAGE[\s\S]{0,200}key\('cmsAdminToken'\)/.test(cms));
    const main = fs.readFileSync(path.join(ROOT, 'js', 'main.js'), 'utf8');
    check('main.js derives its gate key from CMS_STORAGE',
      /var KEY = \(window\.CMS_STORAGE[\s\S]{0,200}key\('gateSeen'\)/.test(main));
    check('the legacy exemption is tied to a siteId, not to the default brand',
      /window\.CMS_LEGACY_STORAGE_SITE_ID = 'playzone9';/.test(CONFIG_SRC));
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
