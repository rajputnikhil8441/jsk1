/* =====================================================================
   BRAND RESOLUTION  (Phase 1 of the multi-brand work)
   ---------------------------------------------------------------------
   js/cms-config.js stopped declaring window.CMS_REMOTE by hand. It now
   declares a registry of brands keyed by hostname, and RESOLVES one of
   them into the same CMS_REMOTE object the CMS has always read.

   Two things have to be true, and this suite exists to prove both.

   1. JSK1 IS UNCHANGED. Whatever hostname it is served from -- the real
      domain, localhost, CI, a Node vm sandbox -- the resolved config
      must be byte-identical to the object the file used to hardcode.
      While one brand is configured that is true unconditionally, and
      that is the strongest form the claim can take.

   2. A LOOKALIKE HOST CANNOT CLAIM TO BE JSK1. Matching is exact
      equality against a registry key, so `jsk-1.com.evil.example`,
      `notjsk-1.com` and `sub.jsk-1.com` are all simply not matches.
      They still render (they fall to the declared default, because
      localhost has to keep working) but they are never REPORTED as the
      brand, and CMS_BRAND_RESOLVED.matched is what says so.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* The object js/cms-config.js declared by hand before Phase 1, copied here
   verbatim. This is the baseline; resolution must reproduce it exactly,
   key order included. If JSK1's configuration is ever meant to change,
   this constant changes in that same commit and the reason is stated. */
const PRE_PHASE1_REMOTE = {
  enabled: true,
  url: 'https://wspanesckdedctpfbqah.supabase.co',
  anonKey: 'sb_publishable_JjCWJkpnwZgg0v3Gw6fcVg_-3Ts-GWV',
  table: 'site_brand',
  siteId: 'playzone9'
};
const PRE_PHASE1_MEDIA = { enabled: false, bucket: 'cms-media', maxBytes: 5242880 };

const CONFIG_SRC = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');

/* Runs the REAL shipped file against a synthetic window, so every hostname
   below is the actual resolution code and not a re-implementation of it. */
function resolveAs(p, hostname) {
  return p.evaluate(({ src, hostname }) => {
    const win = hostname === null ? {} : { location: { hostname } };
    const warnings = [];
    const fakeConsole = { warn: m => warnings.push(String(m)) };
    new Function('window', 'console', src)(win, fakeConsole);
    return { remote: win.CMS_REMOTE, media: win.CMS_MEDIA,
             resolved: win.CMS_BRAND_RESOLVED, warnings };
  }, { src: CONFIG_SRC, hostname });
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* Serves the real local site under any hostname we like, so the matched
   path can be exercised by a genuine navigation rather than only in a
   synthetic window. */
async function serveUnderHost(ctx) {
  await ctx.route('**', async route => {
    const u = new URL(route.request().url());
    if (u.hostname === 'localhost') return route.continue();
    /* Anything that is not the site itself belongs to another handler --
       the Supabase recorder below, in particular. Without this the
       catch-all would swallow that request and proxy it at the static
       file server, which answers 404 and records nothing. */
    if (/supabase\.co$/i.test(u.hostname)) return route.fallback();
    const res = await ctx.request.get(BASE + u.pathname + u.search);
    return route.fulfill({
      status: res.status(),
      contentType: (res.headers()['content-type'] || 'text/html'),
      body: await res.body()
    });
  });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const probe = await ctx.newPage();
  await probe.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' });

  /* ==================================================================
     1. THE EXACT DOMAIN RESOLVES TO THE EXISTING CONFIGURATION
     ================================================================== */
  console.log('\n===== jsk-1.com RESOLVES TO THE EXISTING playzone9 CONFIG =====');
  {
    const r = await resolveAs(probe, 'jsk-1.com');
    check('the hostname is recognised as a configured brand', r.resolved.matched === true, r.resolved);
    check('  and resolution says it came from the hostname', r.resolved.source === 'hostname', r.resolved.source);
    check('  the brand id is jsk-1.com', r.resolved.id === 'jsk-1.com', r.resolved.id);
    check('the siteId is the existing production row, playzone9',
      r.remote.siteId === 'playzone9', r.remote.siteId);
    check('CMS_REMOTE is byte-identical to the pre-Phase-1 object, key order included',
      same(r.remote, PRE_PHASE1_REMOTE), r.remote);
    check('CMS_MEDIA is byte-identical too', same(r.media, PRE_PHASE1_MEDIA), r.media);
    check('and a recognised host warns about nothing', r.warnings.length === 0, r.warnings);
  }

  /* ==================================================================
     2. HOSTNAME NORMALISATION — SAME HOST, NOT A LOOSER MATCH
     ================================================================== */
  console.log('\n===== CASE AND TRAILING DOT ARE THE SAME HOST =====');
  for (const [host, why] of [
    ['JSK-1.COM',  'hostnames are case-insensitive'],
    ['Jsk-1.Com',  'mixed case too'],
    ['jsk-1.com.', 'a single trailing dot is the same host in DNS']
  ]) {
    const r = await resolveAs(probe, host);
    check(`"${host}" matches — ${why}`, r.resolved.matched === true, r.resolved);
    check(`  and still resolves to playzone9`, r.remote.siteId === 'playzone9', r.remote.siteId);
  }

  /* ==================================================================
     3. LOOKALIKES CANNOT CLAIM TO BE JSK1
     ------------------------------------------------------------------
     Each of these would match under a substring, suffix or wildcard
     test. Exact equality refuses every one.
     ================================================================== */
  console.log('\n===== A LOOKALIKE HOST IS NEVER REPORTED AS THE BRAND =====');
  const LOOKALIKES = [
    'jsk-1.com.evil.example',   // the brand as a prefix of someone else's domain
    'evil.example.jsk-1.com.co',
    'notjsk-1.com',             // brand as a suffix
    'evil-jsk-1.com',
    'jsk-1.comm',               // brand as a prefix
    'jsk-1.co',                 // truncation
    'sub.jsk-1.com',            // subdomain, not configured
    'www.jsk-1.com',            // not configured, so not a match
    'xn--jsk-1.com',            // punycode lookalike
    'jsk-1.com..',              // two trailing dots is not a host
    'jsk1.com',
    'jsk-l.com'                 // letter l for digit 1
  ];
  for (const host of LOOKALIKES) {
    const r = await resolveAs(probe, host);
    check(`"${host}" is NOT reported as the brand`, r.resolved.matched === false, r.resolved);
  }
  {
    /* And the reason is structural: not one lookalike equals a registry key. */
    const keys = await probe.evaluate(({ src }) => {
      const win = {}; new Function('window', 'console', src)(win, { warn() {} });
      return Object.keys(win.CMS_BRANDS);
    }, { src: CONFIG_SRC });
    check('exactly one brand is configured in Phase 1', keys.length === 1 && keys[0] === 'jsk-1.com', keys);
    check('no lookalike equals that key', !LOOKALIKES.some(h => keys.indexOf(h) > -1));
  }

  /* ==================================================================
     4. PROTOTYPE KEYS ARE NOT BRANDS
     ------------------------------------------------------------------
     `brands[host]` would be truthy for these on any object. The lookup
     uses hasOwnProperty precisely so they are not.
     ================================================================== */
  console.log('\n===== INHERITED PROPERTIES ARE NOT CONFIGURED BRANDS =====');
  for (const host of ['__proto__', 'constructor', 'tostring', 'valueof', 'hasownproperty']) {
    const r = await resolveAs(probe, host);
    check(`"${host}" is not treated as a brand`, r.resolved.matched === false, r.resolved);
    check(`  and still yields a usable siteId, never empty`, r.remote.siteId === 'playzone9', r.remote.siteId);
  }

  /* ==================================================================
     5. EVERY UNRECOGNISED HOST STILL RENDERS JSK1, UNCHANGED
     ------------------------------------------------------------------
     This is the compatibility guarantee. localhost, CI, previews and a
     Node vm sandbox all took the hardcoded config before Phase 1 and
     must take an identical one now.
     ================================================================== */
  console.log('\n===== UNRECOGNISED HOSTS FALL TO THE DECLARED DEFAULT =====');
  for (const [host, label] of [
    ['localhost', 'local development'],
    ['127.0.0.1', 'local by IP'],
    ['jsk1.github.io', 'a GitHub Pages preview URL'],
    ['', 'file:// with no hostname'],
    [null, 'a Node vm sandbox with no location at all']
  ]) {
    const r = await resolveAs(probe, host);
    check(`${label}: config is byte-identical to pre-Phase-1`, same(r.remote, PRE_PHASE1_REMOTE), r.remote);
    check(`  and it is honest that this was the default, not a match`,
      r.resolved.matched === false && (r.resolved.source === 'default'), r.resolved);
  }
  {
    const r = await resolveAs(probe, 'some-unknown-host.example');
    check('an unknown host says so once, as a warning not an error', r.warnings.length === 1, r.warnings);
    check('  and the warning names the host and the brand it borrowed',
      /some-unknown-host\.example/.test(r.warnings[0]) && /jsk-1\.com/.test(r.warnings[0]), r.warnings[0]);
    const quiet = await resolveAs(probe, null);
    check('a sandbox with no hostname warns about nothing', quiet.warnings.length === 0, quiet.warnings);
  }

  /* ==================================================================
     5b. A MISCONFIGURED REGISTRY NEVER RESOLVES TO NOTHING
     ------------------------------------------------------------------
     An empty siteId is the dangerous failure: Remote.pull() would query
     `id=eq.` and the page would render shipped defaults as if they were
     the site, with no error anywhere. These two cases are the guards
     against that, exercised by injecting a broken registry into the real
     resolution code.
     ================================================================== */
  console.log('\n===== A BROKEN REGISTRY DEGRADES, IT DOES NOT RESOLVE TO NOTHING =====');
  {
    /* The declared default names a brand that is not in the registry. */
    const brokenDefault = CONFIG_SRC.replace(
      "window.CMS_BRAND_DEFAULT = 'jsk-1.com';",
      "window.CMS_BRAND_DEFAULT = 'does-not-exist.example';");
    check('the injection landed', brokenDefault !== CONFIG_SRC);
    const r = await probe.evaluate(({ src }) => {
      const win = { location: { hostname: 'localhost' } };
      new Function('window', 'console', src)(win, { warn() {} });
      return { remote: win.CMS_REMOTE, resolved: win.CMS_BRAND_RESOLVED };
    }, { src: brokenDefault });
    check('a default naming no real brand still yields a real siteId',
      r.remote.siteId === 'playzone9', r.remote.siteId);
    check('  and says it fell back rather than matched',
      r.resolved.matched === false && r.resolved.source === 'fallback', r.resolved);
    check('  remote storage stays enabled, so the site still loads',
      r.remote.enabled === true, r.remote.enabled);
  }
  {
    /* A brand entry with no siteId at all. */
    const noSiteId = CONFIG_SRC.replace("        siteId: 'playzone9',", "");
    check('the injection landed', noSiteId !== CONFIG_SRC);
    const r = await probe.evaluate(({ src }) => {
      const win = { location: { hostname: 'jsk-1.com' } };
      new Function('window', 'console', src)(win, { warn() {} });
      return { remote: win.CMS_REMOTE };
    }, { src: noSiteId });
    check('a brand with no siteId never produces an empty-row query',
      r.remote.siteId === '', r.remote.siteId);
    check('  and remote storage is switched OFF rather than querying id=eq.',
      r.remote.enabled === false, r.remote.enabled);
  }

  /* ==================================================================
     6. THE NODE PATH tools/build-seo-files.js USES
     ================================================================== */
  console.log('\n===== THE DEPLOY TOOL STILL READS A COMPLETE CONFIG =====');
  {
    const vm = require('vm');
    const sandbox = { window: {} };
    vm.runInNewContext(CONFIG_SRC, sandbox, { timeout: 2000 });
    const cfg = sandbox.window.CMS_REMOTE;
    check('the file runs in a bare vm with no console and no location', !!cfg, cfg);
    check('and yields the pre-Phase-1 config exactly', same(cfg, PRE_PHASE1_REMOTE), cfg);
    check('every field the tool requires is present',
      !!(cfg.enabled && cfg.url && cfg.anonKey && cfg.table && cfg.siteId), cfg);
  }

  /* ==================================================================
     7. A REAL PAGE, SERVED UNDER THE REAL DOMAIN
     ------------------------------------------------------------------
     Sections 1-6 run the file in a synthetic window. This navigates a
     real browser to a real page on jsk-1.com and on a lookalike, and
     watches which database row each one actually asks for.
     ================================================================== */
  console.log('\n===== A REAL NAVIGATION ASKS FOR THE RIGHT ROW =====');
  for (const [host, wantMatched, label] of [
    ['jsk-1.com',              true,  'the real domain'],
    ['jsk-1.com.evil.example', false, 'a lookalike domain']
  ]) {
    const c = await b.newContext({ viewport: { width: 1200, height: 900 } });
    const rows = [];
    /* serveUnderHost first, the recorder second: Playwright checks route
       handlers in reverse registration order, so the recorder has to be
       the later one to see the request at all. */
    await serveUnderHost(c);
    await c.route('**supabase.co/**', route => {
      rows.push(route.request().url());
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    const p = await c.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.goto(`http://${host}/index.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);

    const live = await p.evaluate(() => ({
      remote: window.CMS_REMOTE,
      resolved: window.CMS_BRAND_RESOLVED,
      remoteOn: window.CMS && window.CMS.remote && window.CMS.remote.enabled
    }));
    check(`${label}: the page loaded on ${host}`, live.resolved.host === host, live.resolved);
    check(`  matched === ${wantMatched}`, live.resolved.matched === wantMatched, live.resolved);
    check(`  the live CMS_REMOTE is the pre-Phase-1 config`, same(live.remote, PRE_PHASE1_REMOTE), live.remote);
    check(`  remote storage is enabled`, live.remoteOn === true);
    check(`  it queried the playzone9 row and no other`,
      rows.length > 0 && rows.every(u => /id=eq\.playzone9(&|$)/.test(u)), rows);
    check(`  no console errors`, errs.length === 0, errs);
    await c.close();
  }

  /* ==================================================================
     8. THE SHAPE THE REST OF THE CMS DEPENDS ON
     ================================================================== */
  console.log('\n===== NOTHING DOWNSTREAM HAS TO KNOW BRANDS EXIST =====');
  {
    const r = await resolveAs(probe, 'jsk-1.com');
    check('CMS_REMOTE still has exactly its five fields',
      JSON.stringify(Object.keys(r.remote)) === JSON.stringify(['enabled', 'url', 'anonKey', 'table', 'siteId']),
      Object.keys(r.remote));
    check('CMS_MEDIA still has exactly its three',
      JSON.stringify(Object.keys(r.media)) === JSON.stringify(['enabled', 'bucket', 'maxBytes']),
      Object.keys(r.media));
    check('the resolution record exposes what /admin will need later',
      JSON.stringify(Object.keys(r.resolved)) === JSON.stringify(['id', 'host', 'matched', 'source']),
      Object.keys(r.resolved));
    check('js/cms.js was not changed for Phase 1 — it still reads window.CMS_REMOTE',
      /var RC = window\.CMS_REMOTE \|\| \{\};/.test(fs.readFileSync(path.join(ROOT, 'js', 'cms.js'), 'utf8')));
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
