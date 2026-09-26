/* =====================================================================
   THE SHARED DEFAULTS SURFACE  (Phase 3b)
   ---------------------------------------------------------------------
   js/cms.js DEFAULTS is inherited by EVERY brand. Phase 3 emptied it of
   JSK1's identity and content. The job of this suite is to keep it that
   way when nobody is watching, because the failure mode is quiet: a
   developer adds a convenient default, and six months later a second
   brand is serving the first brand's copy.

   So the surface is ENUMERATED rather than spot-checked. Every non-empty
   value in DEFAULTS is listed in fixtures/defaults-surface.json. Adding
   one fails this suite until the fixture is updated deliberately, which
   forces the question "should every brand inherit this?" to be answered
   in a commit message rather than assumed.

   It also pins the palette duplication. DEFAULTS.colors and the :root
   block in css/style.css hold the same 73 values, and until now nothing
   enforced that. Either could have drifted silently. Now a change to one
   fails until the other matches.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const SURFACE = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'defaults-surface.json'), 'utf8'));

/* Words that must never appear in a shared default. The second-brand name
   is here too: Phase 3b must not have added it. */
const FORBIDDEN = [
  ['JSK1 / jsk-1.com', /jsk-?1/i],
  ['playzone9app (the second brand)', /playzone9app/i]
];

/* 'playzone' alone is a THEME PRESET id, not the brand. It is stored in
   settings.activeTheme inside live records, so renaming it is a data
   migration rather than a refactor. Allowed, and named here so it reads
   as a decision instead of an oversight. */
const ALLOWED_PLAYZONE_KEYS = ['settings.preset', 'settings.activeTheme'];

function cssRootVars(file) {
  const css = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const block = (css.match(/^:root \{[\s\S]*?^\}/m) || [''])[0];
  const out = {};
  block.replace(/--([a-z0-9-]+):\s*([^;]+);/g, (m, k, v) => { out[k] = v.trim(); return m; });
  return out;
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext();
  await ctx.route('**supabase.co/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const defaults = JSON.parse(await p.evaluate(() => JSON.stringify(window.CMS.DEFAULTS)));
  const leaves = (function walk(o, pre, out) {
    for (const k of Object.keys(o)) {
      const v = o[k], key = pre ? pre + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key, out);
      else out[key] = Array.isArray(v) ? '[]' : v;
    }
    return out;
  })(defaults, '', {});
  const nonEmpty = {};
  for (const k of Object.keys(leaves).sort())
    if (leaves[k] !== '' && leaves[k] !== '[]' && leaves[k] !== null) nonEmpty[k] = leaves[k];

  /* ==================================================================
     1. NOTHING IN THE SHARED DEFAULTS NAMES A BRAND
     ================================================================== */
  console.log('\n===== NO BRAND IDENTITY IN THE SHARED DEFAULTS =====');
  for (const [label, re] of FORBIDDEN) {
    const hits = Object.keys(leaves).filter(k => re.test(String(leaves[k])) || re.test(k));
    check(`no DEFAULTS value or key mentions ${label}`, hits.length === 0,
      hits.map(k => k + ' = ' + JSON.stringify(leaves[k])));
  }
  {
    const pz = Object.keys(leaves).filter(k => /playzone/i.test(String(leaves[k])));
    check('the only "playzone" values are the two theme-preset ids',
      pz.length === ALLOWED_PLAYZONE_KEYS.length && pz.every(k => ALLOWED_PLAYZONE_KEYS.includes(k)), pz);
  }

  /* ==================================================================
     2. THE SURFACE IS EXACTLY WHAT WAS REVIEWED
     ------------------------------------------------------------------
     Three-way: nothing added, nothing removed, nothing changed.
     ================================================================== */
  console.log('\n===== THE SHARED SURFACE HAS NOT GROWN =====');
  {
    const wasKeys = Object.keys(SURFACE.nonEmpty).sort();
    const nowKeys = Object.keys(nonEmpty).sort();
    const added = nowKeys.filter(k => !wasKeys.includes(k));
    const removed = wasKeys.filter(k => !nowKeys.includes(k));
    const changed = nowKeys.filter(k => wasKeys.includes(k) &&
      JSON.stringify(nonEmpty[k]) !== JSON.stringify(SURFACE.nonEmpty[k]));

    check(`the enumerated surface is not empty (${wasKeys.length} values reviewed)`, wasKeys.length > 200, wasKeys.length);
    check('no value was ADDED to the shared defaults without being listed',
      added.length === 0, added.map(k => k + ' = ' + JSON.stringify(nonEmpty[k])));
    check('no reviewed value disappeared',
      removed.length === 0, removed);
    check('no reviewed value changed',
      changed.length === 0, changed.map(k => k + ': ' + JSON.stringify(SURFACE.nonEmpty[k]) + ' -> ' + JSON.stringify(nonEmpty[k])));
    check('the empty-by-design set is unchanged',
      JSON.stringify(Object.keys(leaves).filter(k => leaves[k] === '' || leaves[k] === '[]').sort())
        === JSON.stringify(SURFACE.emptyByDesign));
  }

  /* ==================================================================
     3. THE THINGS THAT MUST STAY EMPTY, STAY EMPTY
     ------------------------------------------------------------------
     These are the areas a reader would most expect to carry brand
     content. They are empty, and each is empty for a reason worth
     stating: the home lists are harvested from each site's own markup
     by harvest(), the image slots point at each site's own /assets, and
     every page's copy moved to the brand layer in Phase 3.
     ================================================================== */
  console.log('\n===== THE BRAND-SHAPED HOLES ARE STILL EMPTY =====');
  {
    for (const k of ['featured', 'categories', 'sports', 'casino'])
      check(`home.${k} is an empty list (harvested per site, never shared)`,
        Array.isArray(defaults.home[k]) && defaults.home[k].length === 0, defaults.home[k]);

    const imgs = Object.keys(defaults.images);
    check(`all ${imgs.length} image slots are empty (each site uses its own /assets)`,
      imgs.every(k => defaults.images[k] === ''), imgs.filter(k => defaults.images[k] !== ''));

    const CONTENT = ['title', 'metaDescription', 'heading', 'lead', 'body', 'updatedAt'];
    const dirty = [];
    for (const slug of Object.keys(defaults.pages))
      for (const f of CONTENT)
        if (defaults.pages[slug][f] !== '') dirty.push(slug + '.' + f);
    check('every page carries no copy and no date in the shared defaults',
      dirty.length === 0, dirty);

    for (const k of ['siteName', 'browserTitle', 'loginTitle'])
      check(`branding.${k} is empty`, defaults.branding[k] === '', defaults.branding[k]);
    for (const k of ['baseUrl', 'siteName', 'titleTemplate', 'defaultTitle', 'defaultDescription'])
      check(`seo.${k} is empty`, defaults.seo[k] === '', defaults.seo[k]);
    check('seo.organization.name is empty', defaults.seo.organization.name === '');
    check('the whatsapp number is a placeholder, not a real one',
      defaults.branding.whatsapp === '91xxxxxx', defaults.branding.whatsapp);
  }

  /* ==================================================================
     4. THE PALETTE DUPLICATION IS PINNED
     ------------------------------------------------------------------
     DEFAULTS.colors is not the palette's real home -- css/style.css
     :root is, and paintVars() skips empty values, so the stylesheet is
     what renders when a colour is unset. The two copies agree today and
     nothing enforced it. Pinning them means neither can drift alone.
     ================================================================== */
  console.log('\n===== DEFAULTS.colors AND THE STYLESHEET STILL AGREE =====');
  {
    const cssStyle = cssRootVars('css/style.css');
    const cssReg = cssRootVars('css/register.css');
    check('css/style.css :root is unchanged since review',
      JSON.stringify(cssStyle) === JSON.stringify(SURFACE.cssRootStyle),
      Object.keys(cssStyle).filter(k => cssStyle[k] !== SURFACE.cssRootStyle[k]));
    check('css/register.css :root is unchanged since review',
      JSON.stringify(cssReg) === JSON.stringify(SURFACE.cssRootRegister),
      Object.keys(cssReg).filter(k => cssReg[k] !== SURFACE.cssRootRegister[k]));

    const shared = Object.keys(defaults.colors).filter(k => k in cssStyle);
    const disagree = shared.filter(k =>
      String(cssStyle[k]).toLowerCase() !== String(defaults.colors[k]).toLowerCase());
    check(`all ${shared.length} shared colour keys agree between DEFAULTS and css/style.css`,
      disagree.length === 0, disagree.map(k => k + ': css=' + cssStyle[k] + ' defaults=' + defaults.colors[k]));
    check('  and the overlap is substantial, so this is not a vacuous check',
      shared.length > 60, shared.length);

    /* registerPage is the one place where DEFAULTS deliberately DIFFERS
       from its stylesheet: #3880bd vs the sheet's #0088cc. Recorded so
       the difference reads as known rather than as a bug, and so
       blanking it is recognised as a rendering change, not a cleanup. */
    check('registerPage.primary overrides the stylesheet on purpose',
      defaults.registerPage.primary === '#3880bd' && cssReg['reg-primary'] === '#0088cc',
      { defaults: defaults.registerPage.primary, css: cssReg['reg-primary'] });
  }

  /* ==================================================================
     5. NEUTRAL DEFAULTS ARE STRUCTURALLY VALID
     ================================================================== */
  console.log('\n===== THE NEUTRAL DEFAULTS STILL INITIALISE A SITE =====');
  {
    check('every colour value is a usable CSS colour',
      Object.keys(defaults.colors).every(k =>
        /^#[0-9a-f]{3,8}$/i.test(String(defaults.colors[k])) ||
        /^rgba?\(/i.test(String(defaults.colors[k])) ||
        String(defaults.colors[k]) === ''),
      Object.keys(defaults.colors).filter(k =>
        !/^#[0-9a-f]{3,8}$/i.test(String(defaults.colors[k])) &&
        !/^rgba?\(/i.test(String(defaults.colors[k])) && defaults.colors[k] !== ''));
    check('every sportsTable dimension is numeric',
      Object.keys(defaults.sportsTable).every(k => /^[0-9.]+$/.test(String(defaults.sportsTable[k]))),
      Object.keys(defaults.sportsTable).filter(k => !/^[0-9.]+$/.test(String(defaults.sportsTable[k]))));
    check('the page set is intact', Object.keys(defaults.pages).length === 7, Object.keys(defaults.pages).length);
    check('every page still has its structural fields',
      Object.keys(defaults.pages).every(s =>
        ['label', 'url', 'slug', 'robots', 'og', 'twitter', 'breadcrumb', 'schema', 'inSitemap']
          .every(f => f in defaults.pages[s])));
    check('the footer still ships its navigation columns',
      defaults.footer.columns.length === 2 &&
      defaults.footer.columns[0].links.length === 5, defaults.footer.columns.length);
    check('schema flags are on so SEO still emits structured data',
      defaults.seo.schema.organization === true && defaults.seo.schema.website === true);
  }

  /* ==================================================================
     6. THE BRAND LAYER IS WHERE THE BRAND IS
     ================================================================== */
  console.log('\n===== JSK1 RESOLVES FROM THE BRAND LAYER, NOT THE DEFAULTS =====');
  {
    const v = await p.evaluate(() => ({
      siteName: window.CMS.get('branding.siteName', ''),
      baseUrl: window.CMS.get('seo.baseUrl', ''),
      aboutTitle: window.CMS.data().pages.about.title,
      brandKeys: Object.keys(window.CMS_BRAND || {}),
      brandCount: Object.keys(window.CMS_BRANDS || {}).length
    }));
    check('branding.siteName resolves to JSK1 even though DEFAULTS is empty', v.siteName === 'JSK1', v.siteName);
    check('seo.baseUrl resolves to jsk-1.com', v.baseUrl === 'https://jsk-1.com', v.baseUrl);
    check('the about title resolves from the brand layer', /About JSK1/.test(v.aboutTitle), v.aboutTitle);
    check('js/brand.js is the source', v.brandKeys.includes('branding') && v.brandKeys.includes('pages'), v.brandKeys);
    check('and still exactly ONE brand is registered', v.brandCount === 1, v.brandCount);
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
