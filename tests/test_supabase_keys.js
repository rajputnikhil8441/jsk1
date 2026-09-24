/* =====================================================================
   SUPABASE API KEY FORMATS
   ---------------------------------------------------------------------
   Supabase issues two kinds of public key and they are NOT
   interchangeable in the headers:

     eyJ...              legacy anon key. A JWT. Accepted in `apikey` and
                         in `Authorization: Bearer`.
     sb_publishable_...  the current publishable key. Not a JWT. Supabase's
                         migration notes say it must travel in `apikey`
                         alone; anything that tries to parse it as a JWT
                         rejects the request.

   This suite pins the rule in both callers of the API -- the browser
   (js/cms.js) and the deploy step (tools/build-seo-files.js) -- and pins
   the refusal to ever start with a SECRET key, which would hand every
   visitor full database access.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const PUBLISHABLE = 'sb_publishable_TESTKEY0000000000000_ab12cd34';
const SECRET      = 'sb_secret_TESTKEY0000000000000_ab12cd34';
/* A syntactically real JWT whose payload says role: anon. */
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '');
const LEGACY  = 'eyJhbGciOiJIUzI1NiJ9.' + b64({ iss: 'supabase', ref: 'testref', role: 'anon' }) + '.sig';
const SERVICE = 'eyJhbGciOiJIUzI1NiJ9.' + b64({ iss: 'supabase', ref: 'testref', role: 'service_role' }) + '.sig';

/* Loads the admin with js/cms-config.js swapped for one we control, and
   records the headers of every Supabase request the page makes. */
async function withKey(b, key, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: 1200, height: 900 } });
  const seen = [];
  await ctx.route('**/js/cms-config.js', r => r.fulfill({
    status: 200, contentType: 'application/javascript',
    body: 'window.CMS_REMOTE = ' + JSON.stringify({
      enabled: true, url: 'https://testref.supabase.co',
      anonKey: key, table: 'site_brand', siteId: 'playzone9'
    }) + ';\nwindow.CMS_MEDIA = { enabled: ' + (opts.media ? 'true' : 'false') +
      ", bucket: 'cms-media', maxBytes: 5242880 };\n"
  }));
  await ctx.route('**supabase.co/**', r => {
    const q = r.request();
    seen.push({ url: q.url(), method: q.method(), headers: q.headers() });
    if (q.url().includes('/auth/v1/token'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
    if (q.url().includes('/storage/v1/object/'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' });
    if (q.method() === 'POST') return r.fulfill({ status: 201, body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const p = await ctx.newPage();
  const errs = [], consoleErrs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') consoleErrs.push(m.text()); });
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  return { ctx, p, seen, errs, consoleErrs };
}

const reads = seen => seen.filter(r => r.url.includes('/rest/v1/') && r.method === 'GET');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. A PUBLISHABLE KEY TRAVELS IN apikey ALONE
     ================================================================== */
  console.log('\n===== PUBLISHABLE KEY (sb_publishable_...) =====');
  {
    const { ctx, p, seen, errs } = await withKey(b, PUBLISHABLE);
    const r = reads(seen)[0];
    check('the page reads the brand row', !!r, seen.map(x => x.method + ' ' + x.url));
    if (r) {
      check('  the key is sent in the apikey header', r.headers['apikey'] === PUBLISHABLE, r.headers['apikey']);
      check('  and NOT copied into Authorization, where it is not a valid JWT',
        r.headers['authorization'] === undefined, r.headers['authorization']);
    }
    check('remote storage is enabled', await p.evaluate(() => window.CMS.remote.enabled) === true);
    check('the sign-in gate is shown', await p.isVisible('#authGate'));

    /* signing in must carry the key the same way */
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(500);
    const auth = seen.filter(x => x.url.includes('/auth/v1/token'))[0];
    check('sign-in sends the key in apikey', auth && auth.headers['apikey'] === PUBLISHABLE, auth && auth.headers['apikey']);
    check('sign-in does not send it as a bearer token either',
      auth && auth.headers['authorization'] === undefined, auth && auth.headers['authorization']);
    check('sign in succeeds', !(await p.isVisible('#authGate')));

    /* an authenticated write uses the SESSION token, not the key */
    seen.length = 0;
    await p.evaluate(() => window.CMS.remote.publish());
    await p.waitForTimeout(500);
    const w = seen.filter(x => x.method === 'POST' && x.url.includes('/rest/v1/'))[0];
    check('a write still sends the publishable key in apikey', w && w.headers['apikey'] === PUBLISHABLE, w && w.headers['apikey']);
    check('and the admin session JWT as the bearer token',
      w && w.headers['authorization'] === 'Bearer stub', w && w.headers['authorization']);
    check('no page errors with a publishable key', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     2. A LEGACY KEY BEHAVES EXACTLY AS IT ALWAYS DID
     ================================================================== */
  console.log('\n===== LEGACY ANON KEY (eyJ...) =====');
  {
    const { ctx, p, seen, errs } = await withKey(b, LEGACY);
    const r = reads(seen)[0];
    check('the page reads the brand row', !!r);
    if (r) {
      check('  the key is sent in the apikey header', r.headers['apikey'] === LEGACY);
      check('  AND duplicated into Authorization, as before',
        r.headers['authorization'] === 'Bearer ' + LEGACY, r.headers['authorization']);
    }
    check('remote storage is enabled', await p.evaluate(() => window.CMS.remote.enabled) === true);
    check('no page errors with a legacy key', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     3. A SECRET KEY IS REFUSED, NOT SENT
     ------------------------------------------------------------------
     js/cms-config.js is downloaded by every visitor. A secret key there
     is full database access for anyone who views source. The only safe
     behaviour is to not start.
     ================================================================== */
  console.log('\n===== SECRET KEYS ARE REFUSED =====');
  for (const [label, key] of [['sb_secret_...', SECRET], ['a legacy service_role JWT', SERVICE]]) {
    const { ctx, p, seen, consoleErrs } = await withKey(b, key);
    check(`${label}: remote storage refuses to start`,
      await p.evaluate(() => window.CMS.remote.enabled) === false);
    check(`${label}: not one request carries it`,
      seen.length === 0, seen.map(x => x.url));
    check(`${label}: the console says why`,
      consoleErrs.some(t => /SECRET key/i.test(t) && /rotate/i.test(t)), consoleErrs);
    check(`${label}: the page still renders from the cached brand`,
      await p.evaluate(() => !!document.querySelector('.adm-nav-item')));
    await ctx.close();
  }

  /* ==================================================================
     4. THE DEPLOY STEP FOLLOWS THE SAME RULE
     ================================================================== */
  console.log('\n===== THE DEPLOY STEP AGREES WITH THE BROWSER =====');
  {
    const tool = fs.readFileSync(path.join(ROOT, 'tools', 'build-seo-files.js'), 'utf8');
    check('the generator only adds Authorization for a non-sb_ key',
      /if \(!\/\^sb_\/\.test\(String\(cfg\.anonKey\)\)\) headers\.Authorization/.test(tool), null);
    check('and always sends apikey', /apikey: cfg\.anonKey/.test(tool));
    const cms = fs.readFileSync(path.join(ROOT, 'js', 'cms.js'), 'utf8');
    check('js/cms.js uses the same sb_ test', /function opaqueKey\(k\) \{ return \/\^sb_\/\.test/.test(cms));
  }

  /* ==================================================================
     5. THE COMMITTED CONFIG POINTS AT THE CURRENT PROJECT
     ================================================================== */
  console.log('\n===== THE COMMITTED CONFIG =====');
  {
    const cfgSrc = fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8');
    const sandbox = { window: {} };
    require('vm').runInNewContext(cfgSrc, sandbox, { timeout: 2000 });
    const cfg = sandbox.window.CMS_REMOTE;
    check('the project URL is the current one',
      cfg.url === 'https://wspanesckdedctpfbqah.supabase.co', cfg.url);
    check('the key is a publishable key, not a secret one',
      /^sb_publishable_/.test(cfg.anonKey), cfg.anonKey.slice(0, 16));
    check('the table name is unchanged', cfg.table === 'site_brand', cfg.table);
    check('the siteId is unchanged', cfg.siteId === 'playzone9', cfg.siteId);
    check('remote storage is on', cfg.enabled === true);

    /* No file anywhere may still name the retired project.

       The needle is assembled from two halves on purpose: written out
       whole, this file would contain the very string it is scanning for
       and would report itself. A guard that trips on its own source gets
       deleted rather than fixed. */
    const RETIRED = 'bgkghmjw' + 'aglddmdgslox';
    const stale = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === '.git' || e.name === 'node_modules') continue;
        const f = path.join(dir, e.name);
        if (e.isDirectory()) { walk(f); continue; }
        let txt; try { txt = fs.readFileSync(f, 'utf8'); } catch (err) { continue; }
        if (txt.indexOf(RETIRED) > -1) stale.push(path.relative(ROOT, f));
      }
    })(ROOT);
    check('no file in the repository still names the retired project', stale.length === 0, stale);
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
