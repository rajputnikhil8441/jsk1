/* =====================================================================
   CAPTURE THE SHARED DEFAULTS SURFACE  (support script)
   ---------------------------------------------------------------------
   Writes fixtures/defaults-surface.json: every non-empty leaf in
   js/cms.js DEFAULTS, plus the css/style.css :root palette it
   duplicates. test_defaults_surface.js asserts the live values still
   match, so a value added to DEFAULTS fails the build until someone
   lists it here deliberately.

       node capture-defaults-surface.js
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

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
  await p.goto('http://localhost:8777/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);

  const defaults = JSON.parse(await p.evaluate(() => JSON.stringify(window.CMS.DEFAULTS)));
  const walk = (o, pre, out) => {
    for (const k of Object.keys(o)) {
      const v = o[k], key = pre ? pre + '.' + k : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, key, out);
      else out[key] = Array.isArray(v) ? '[]' : v;
    }
    return out;
  };
  const leaves = walk(defaults, '', {});
  const nonEmpty = {};
  for (const k of Object.keys(leaves).sort())
    if (leaves[k] !== '' && leaves[k] !== '[]' && leaves[k] !== null) nonEmpty[k] = leaves[k];

  const out = {
    _comment: [
      'Every non-empty value in the SHARED js/cms.js DEFAULTS, which every brand inherits.',
      'A new entry appearing here means a value was added to DEFAULTS that all brands now',
      'carry. test_defaults_surface.js fails until this file is updated deliberately, so the',
      'shared surface can only grow on purpose and with a reason in the commit message.',
      'Nothing here may be brand identity or brand content. Phase 3 moved all of that into',
      'js/brand.js. What remains is structure: keys, layout dimensions, generic starter copy,',
      'feature flags, schema.org enums, and a colour palette that duplicates css/style.css.',
      '',
      'cssRoot* pin the stylesheet palettes that DEFAULTS duplicates. The two copies are',
      'byte-identical today and nothing enforced that, so either could drift silently.',
      'Now a change to one fails until the other matches.'
    ],
    emptyByDesign: Object.keys(leaves).filter(k => leaves[k] === '' || leaves[k] === '[]').sort(),
    nonEmpty: nonEmpty,
    cssRootStyle: cssRootVars('css/style.css'),
    cssRootRegister: cssRootVars('css/register.css')
  };
  fs.writeFileSync(path.join(__dirname, 'fixtures', 'defaults-surface.json'),
                   JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log('non-empty DEFAULTS leaves : ' + Object.keys(nonEmpty).length);
  console.log('empty-by-design leaves    : ' + out.emptyByDesign.length);
  console.log('css/style.css :root vars  : ' + Object.keys(out.cssRootStyle).length);
  console.log('css/register.css :root    : ' + Object.keys(out.cssRootRegister).length);
  await b.close();
})();
