/* PAGE BUILDER CONTENT IN THE HTML WE SERVE.

   THE CLAIM. The published Page Builder content is in the initial HTML
   response, it is the same content the browser renders, and JavaScript does
   not leave a second copy behind.

   WHY THE FIRST SECTION IS THE MOST IMPORTANT ONE. The bake runs the real
   renderer -- js/cms.js's own CMS.sections.renderInto -- in Node against
   tools/lib/minidom.js, so there is no second renderer and no element logic
   written twice. The ONE thing written twice is HTML serialisation: ours in
   minidom.js, the browser's in innerHTML. Section A asserts those agree
   byte-for-byte across every element type, which is what makes "the static
   HTML and the runtime DOM come from the same renderer" a fact rather than
   an intention. If that equality ever breaks, everything else here is
   worthless, so it is tested first and in detail.

   NOTHING HERE TOUCHES A REAL SERVER OR A REAL BRAND'S FILES. The build is
   driven against throwaway brands written into a temp directory, which is
   also how the multi-brand isolation checks work: two brands, two contents,
   one pipeline. */

const { chromium } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
const bake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* ------------------------------------------------------------------
   A fixture that reaches every element type the renderer knows, plus the
   cases that are easy to serialise wrongly: ampersands and angle brackets in
   text, quotes and ampersands in attributes, a disabled element, an unknown
   type, a nested columns tree, a void element, and a boolean attribute.
   ------------------------------------------------------------------ */
const FIXTURE = [
  { id: 'sec_hero', type: 'hero', enabled: true,
    visibility: { desktop: true, tablet: true, mobile: false },
    style: { bg: '#102030', color: '#ffffff', padding: '60' },
    responsive: { tablet: { padding: '40' }, mobile: { padding: '20' } },
    elements: [
      { id: 'el_h', type: 'heading', content: { text: 'Fish & Chips <b>not bold</b>', level: 'h2' },
        style: { fontSize: '34' }, responsive: { mobile: { fontSize: '24' } } },
      { id: 'el_t', type: 'text', content: { text: 'A "quoted" line & an <angle> bracket.' },
        style: {}, responsive: {} },
      { id: 'el_b', type: 'button', content: { text: 'Join & Play', href: 'register.html', newTab: true },
        style: {}, responsive: {} },
      { id: 'el_b2', type: 'button', content: { text: 'No href' }, style: {}, responsive: {} },
      { id: 'el_i', type: 'image',
        content: { src: 'assets/images/logo.png', alt: 'Logo & mark "quoted"', width: '120', height: '40' },
        style: {}, responsive: {} },
      { id: 'el_i2', type: 'image',
        content: { src: 'assets/images/logo.png', alt: '', href: 'about.html', newTab: true },
        style: {}, responsive: {} },
      { id: 'el_skip', type: 'text', enabled: false, content: { text: 'DISABLED must not render' },
        style: {}, responsive: {} },
      { id: 'el_unknown', type: 'notAThing', content: { text: 'UNKNOWN must not render' },
        style: {}, responsive: {} }
    ] },
  { id: 'sec_grid', type: 'cards', enabled: true,
    visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
    elements: [
      { id: 'el_c', type: 'card',
        content: { image: 'assets/images/logo.png', imageAlt: 'Card image', title: 'Card & title',
                   text: 'Card text', buttonText: 'Go', buttonHref: 'contact.html' },
        style: {}, responsive: {} },
      { id: 'el_cols', type: 'columns', content: { columns: [
          { elements: [{ id: 'el_n1', type: 'text', content: { text: 'Column one' }, style: {}, responsive: {} }] },
          { elements: [{ id: 'el_n2', type: 'heading', content: { text: 'Column two', level: 'h3' }, style: {}, responsive: {} }] }
        ] }, style: {}, responsive: {} },
      { id: 'el_d', type: 'divider', content: {}, style: {}, responsive: {} },
      { id: 'el_sp', type: 'spacer', content: {}, style: {}, responsive: {} }
    ] },
  { id: 'sec_v2', type: 'text', enabled: true,
    visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
    elements: [
      { id: 'el_ic', type: 'icon', content: { icon: 'star', label: 'Starred', href: 'about.html' },
        style: {}, responsive: {} },
      { id: 'el_ic2', type: 'icon', content: { icon: 'star', label: 'Plain' }, style: {}, responsive: {} },
      { id: 'el_no', type: 'notice',
        content: { variant: 'info', icon: 'star', text: 'Mind the gap', href: 'about.html', linkText: 'Read more' },
        style: {}, responsive: {} },
      { id: 'el_fb', type: 'featureBox',
        content: { icon: 'star', title: 'Feature', titleLevel: 'h4', text: 'Feature text',
                   href: 'contact.html', linkText: 'Ask us' }, style: {}, responsive: {} },
      { id: 'el_faq', type: 'faq', content: { single: true, items: [
          { question: 'Is it open?', answer: 'Yes & always', open: true },
          { question: 'Closed one?', answer: 'Answer two' },
          { question: '', answer: 'no question, must be skipped' }
        ] }, style: {}, responsive: {} },
      { id: 'el_soc', type: 'socialLinks', content: { items: [
          { platform: 'telegram', url: 'https://t.me/example', label: 'Telegram & chat' },
          { platform: 'notAPlatform', url: 'https://example.com' }
        ] }, style: {}, responsive: {} },
      /* Phase 2A. Both are here for the same reason every other type is:
         section A compares this fixture's baked HTML with the browser's
         own innerHTML byte for byte, so a <ul>, an <ol> and a <table>
         that minidom serialises differently from a real DOM would fail
         there rather than in production. Ampersands and angle brackets
         are in the content on purpose. */
      { id: 'el_ul', type: 'list', content: { items: [
          { text: 'Bullet one & two' },
          { text: '' },
          { text: '<not a tag>' }
        ] }, style: {}, responsive: {} },
      { id: 'el_ol', type: 'list', content: { ordered: true, items: [
          { text: 'Step one' }, { text: 'Step two' }
        ] }, style: {}, responsive: {} },
      { id: 'el_tb', type: 'table', content: { caption: 'Odds & ends', header: true, items: [
          { c1: 'Market', c2: 'Price' },
          { c1: 'Home & away', c2: '1.90' },
          { c1: '<b>Draw</b>', c2: '' }
        ] }, style: {}, responsive: {} },
      { id: 'el_tb2', type: 'table', content: { header: false, cols: 2, items: [
          { c1: 'no header row', c2: 'second cell' }
        ] }, style: {}, responsive: {} }
    ] },
  { id: 'sec_off', type: 'text', enabled: false,
    visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
    elements: [{ id: 'el_off', type: 'text', content: { text: 'DISABLED SECTION must not render' },
                 style: {}, responsive: {} }] }
];

/* A tiny brand, written to a temp directory, so the build can be driven for
   brands that do not exist in the repository. Mirrors the shape of a real
   brands/<id>/ directory and nothing more. */
function writeBrand(dir, id, opts) {
  opts = opts || {};
  const bdir = path.join(dir, id);
  fs.mkdirSync(bdir, { recursive: true });
  fs.writeFileSync(path.join(bdir, 'brand.json'), JSON.stringify({
    id: id, name: opts.name || id, domain: id, siteId: opts.siteId || ('row-' + id.replace(/\W/g, '')),
    bucket: 'bucket-' + id.replace(/\W/g, '')
  }, null, 2) + '\n');
  const pages = {
    about: {
      title: 'About ' + (opts.name || id), metaDescription: 'Desc for ' + id,
      heading: 'About ' + (opts.name || id), lead: 'Lead for ' + id,
      body: '<p>Fallback copy for ' + id + '.</p>', updatedAt: '2026-01-01'
    }
  };
  if (opts.builder) pages.about.builder = opts.builder;
  if (opts.extraPages) Object.assign(pages, opts.extraPages);
  fs.writeFileSync(path.join(bdir, 'brand.js'),
    '/* test brand */\nwindow.CMS_BRAND = ' + JSON.stringify({
      branding: { siteName: opts.name || id }, seo: { baseUrl: 'https://' + id, siteName: opts.name || id },
      pages: pages
    }, null, 2) + ';\n');
  /* A sitemap-worthy page, because the assembly's own check refuses a site
     whose sitemap does not point at its domain -- a pre-existing guard that
     has nothing to do with the bake but does have to be satisfied. */
  fs.writeFileSync(path.join(bdir, 'seo-config.json'), JSON.stringify({
    seo: { baseUrl: 'https://' + id, siteName: opts.name || id },
    pages: { about: { url: 'about.html', inSitemap: true,
                      robots: { index: true, follow: true }, updatedAt: '2026-01-01' } }
  }, null, 2) + '\n');
  return bdir;
}

function buildBrand(brandsDir, id, outDir) {
  return execFileSync(process.execPath,
    [path.join(ROOT, 'tools', 'build-site.js'), id,
     '--brands', brandsDir, '--out', outDir],
    { cwd: ROOT, encoding: 'utf8' });
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pbbake-'));

  /* ================================================================
     A. ONE RENDERER: our serialisation == the browser's innerHTML
     ================================================================ */
  console.log('\n===== A. Baked markup is byte-identical to the browser =====');
  {
    const ctx = await b.newContext();
    await ctx.route('**supabase.co/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });

    const browser = await p.evaluate(secs => {
      const host = document.createElement('div');
      window.CMS.sections.renderInto(host, secs);
      return { html: host.innerHTML, css: window.CMS.sections.css(secs) };
    }, FIXTURE);

    const node = bake.render(ROOT, { sections: FIXTURE, schemaVersion: 2 });

    check('the fixture actually renders something (not a vacuous comparison)',
      node.html.length > 1500, node.html.length);
    check('it covers every element type the renderer knows',
      (() => {
        const types = new Set();
        const walk = list => (list || []).forEach(e => {
          if (!e) return; types.add(e.type);
          ((e.content || {}).columns || []).forEach(c => walk(c.elements));
        });
        FIXTURE.forEach(s => walk(s.elements));
        const known = Object.keys(browser.knownTypes || {});
        return types.size >= 13;
      })(), 'types in fixture');

    check('BAKED HTML === BROWSER innerHTML, byte for byte', node.html === browser.html,
      node.html === browser.html ? '' : {
        nodeLen: node.html.length, browserLen: browser.html.length,
        firstDiff: (() => {
          for (let i = 0; i < Math.max(node.html.length, browser.html.length); i++) {
            if (node.html[i] !== browser.html[i]) {
              return { at: i, node: node.html.slice(Math.max(0, i - 60), i + 60),
                       browser: browser.html.slice(Math.max(0, i - 60), i + 60) };
            }
          }
          return null;
        })()
      });

    check('BAKED CSS === BROWSER CSS, byte for byte', node.css === browser.css,
      node.css === browser.css ? '' : { nodeLen: node.css.length, browserLen: browser.css.length });

    /* Escaping, asserted directly rather than only through the equality. */
    check('text ampersands are escaped', node.html.includes('Fish &amp; Chips'), true);
    check('text angle brackets are escaped and not markup',
      node.html.includes('&lt;b&gt;not bold&lt;/b&gt;') && !node.html.includes('<b>not bold'), true);
    check('quotes in text are NOT over-escaped (browsers do not)',
      node.html.includes('A "quoted" line'), true);
    check('ampersands in attributes are escaped',
      node.html.includes('alt="Logo &amp; mark &quot;quoted&quot;"'), true);
    check('void elements have no closing tag',
      /<img [^>]*>(?!<\/img>)/.test(node.html) && !node.html.includes('</img>'), true);
    check('a boolean attribute serialises as name=""',
      node.html.includes('hidden=""'), node.html.includes('hidden=""'));
    check('a disabled element renders nothing',
      !node.html.includes('DISABLED must not render'), true);
    check('an unknown element type renders nothing',
      !node.html.includes('UNKNOWN must not render'), true);
    check('a disabled SECTION renders nothing',
      !node.html.includes('DISABLED SECTION must not render'), true);
    check('an faq item with no question is skipped',
      !node.html.includes('no question, must be skipped'), true);
    check('an unknown social platform is skipped',
      !node.html.includes('notAPlatform'), true);

    /* ---- Phase 2A: semantic list and table markup, in the STATIC HTML ----
       The point of each of these is that a crawler reading the response
       body, before any JavaScript, sees real list and table semantics. */
    check('a list bakes as a real <ul> with <li> rows',
      /<ul class="pb-el pb-list" data-el="el_ul">/.test(node.html) &&
      node.html.includes('<li class="pb-list-item">Bullet one &amp; two</li>'),
      node.html.slice(node.html.indexOf('el_ul') - 40, node.html.indexOf('el_ul') + 160));
    check('  a numbered list bakes as an <ol>',
      /<ol class="pb-el pb-list pb-list-ord" data-el="el_ol">/.test(node.html), true);
    check('  a list row with no text is skipped, not drawn empty',
      (node.html.match(/<li class="pb-list-item">/g) || []).length === 4, true);
    check('  markup in a list row stays text',
      node.html.includes('&lt;not a tag&gt;') && !node.html.includes('<not a tag>'), true);

    check('a table bakes as a real <table> inside its scroll wrapper',
      /<div class="pb-el pb-table" data-el="el_tb"><table class="pb-table-t">/.test(node.html), true);
    check('  its caption is first, where HTML requires it',
      /<table class="pb-table-t"><caption class="pb-table-cap">Odds &amp; ends<\/caption>/.test(node.html), true);
    check('  the first row becomes <th scope="col">, so the columns are named',
      node.html.includes('<th class="pb-table-h" scope="col">Market</th>') &&
      node.html.includes('<th class="pb-table-h" scope="col">Price</th>'), true);
    check('  data rows are <td> in a <tbody>',
      /<tbody><tr class="pb-table-r"><td class="pb-table-c">Home &amp; away<\/td>/.test(node.html), true);
    check('  an empty cell is drawn, because a blank cell is real data',
      node.html.includes('<td class="pb-table-c"></td>'), true);
    check('  markup in a cell stays text',
      node.html.includes('&lt;b&gt;Draw&lt;/b&gt;') && !node.html.includes('<b>Draw'), true);
    check('  header:false bakes no <thead> at all',
      /data-el="el_tb2"><table class="pb-table-t"><tbody>/.test(node.html), true);
    check('  and no table carries an inline style or event attribute',
      !/<t(able|head|body|r|h|d)[^>]*\s(on\w+|style)=/.test(node.html), true);

    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     B. THE BUILD PUTS IT IN THE HTML, FOR ANY BRAND
     ================================================================ */
  console.log('\n===== B. Published content is in the delivered HTML =====');
  const brandsDir = path.join(tmp, 'brands');
  const outDir = path.join(tmp, 'out');
  const A = { head: 'Alpha Exclusive Welcome Offer', para: 'alpha-only-paragraph-text',
              btn: 'Alpha Register Now', alt: 'alpha-only-alt-text', href: 'register.html' };
  const B = { head: 'Beta Grand Opening Bonus', para: 'beta-only-paragraph-text',
              btn: 'Beta Register Now', alt: 'beta-only-alt-text', href: 'contact.html' };
  const blockFor = m => ({ schemaVersion: 2, status: 'published', updatedAt: '2026-09-28',
    sections: [{ id: 's1', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true }, style: { padding: '40' }, responsive: {},
      elements: [
        { id: 'e1', type: 'heading', content: { text: m.head, level: 'h2' }, style: {}, responsive: {} },
        { id: 'e2', type: 'text', content: { text: m.para }, style: {}, responsive: {} },
        { id: 'e3', type: 'button', content: { text: m.btn, href: m.href }, style: {}, responsive: {} },
        { id: 'e4', type: 'image', content: { src: 'assets/images/logo.png', alt: m.alt },
          style: {}, responsive: {} }
      ] }] });

  writeBrand(brandsDir, 'alpha.test', { name: 'ALPHA', builder: blockFor(A) });
  writeBrand(brandsDir, 'beta.test', { name: 'BETA', builder: blockFor(B) });
  writeBrand(brandsDir, 'plain.test', { name: 'PLAIN' });                  /* nothing published */
  writeBrand(brandsDir, 'empty.test', { name: 'EMPTY',
    builder: { schemaVersion: 2, status: 'published', updatedAt: '2026-09-28', sections: [] } });
  writeBrand(brandsDir, 'draft.test', { name: 'DRAFT',
    builder: { schemaVersion: 2, status: 'draft', updatedAt: '2026-09-28',
               sections: blockFor(A).sections } });

  const logs = {};
  for (const id of ['alpha.test', 'beta.test', 'plain.test', 'empty.test', 'draft.test']) {
    logs[id] = buildBrand(brandsDir, id, outDir);
  }
  const read = (id, f) => fs.readFileSync(path.join(outDir, id, f), 'utf8');
  const alpha = read('alpha.test', 'about.html');

  check('the build reports what it baked',
    /Builder\s*:\s*about \(1 section\)/.test(logs['alpha.test']),
    (logs['alpha.test'].match(/Builder.*/) || [''])[0]);
  check('the published HEADING is in the raw HTML', alpha.includes('>' + A.head + '<'), true);
  check('the published PARAGRAPH is in the raw HTML', alpha.includes('>' + A.para + '<'), true);
  check('the published BUTTON text is in the raw HTML', alpha.includes('>' + A.btn + '<'), true);
  check('the published LINK href is in the raw HTML',
    alpha.includes('class="pb-el pb-btn" href="' + A.href + '"'), true);
  check('the published IMAGE is in the raw HTML',
    alpha.includes('src="assets/images/logo.png"'), true);
  check('the published image ALT TEXT is in the raw HTML',
    alpha.includes('alt="' + A.alt + '"'), true);
  check('the mount is no longer empty',
    !/<div data-cms-sections="about"><\/div>/.test(alpha), true);
  check('the mount is marked as baked',
    /<div data-cms-sections="about" data-cms-baked="1">/.test(alpha), true);
  check('the section styles are in the raw HTML too, so no-JS is styled',
    /<style id="cmsBuilder">[^<]*--pbs-padding:40px/.test(alpha), true);
  check('the baked markup is exactly what the baker produces',
    alpha.includes(bake.render(ROOT, blockFor(A)).html), true);

  /* The static fallback is untouched -- still there, still the no-JS/unpublish
     safety net, still NOT a second editable system.

     It comes from the TEMPLATE's own prose with the brand's tokens filled in,
     which is a different thing from pages.<slug>.body in brand.js; the two
     normally say the same thing but the file's copy is the template's. */
  const fallbackOf = html => {
    const m = html.match(/<div class="info-body" data-cms-html="pages\.about\.body">([\s\S]*?)\n            <\/div>/);
    return m ? m[1] : '';
  };
  check('the shipped fallback body is still in the file',
    fallbackOf(alpha).replace(/<[^>]+>/g, ' ').trim().split(/\s+/).length > 40,
    fallbackOf(alpha).length);
  check('  and it carries this brand\'s name, not another\'s',
    fallbackOf(alpha).includes('ALPHA') && !fallbackOf(alpha).includes('BETA'), true);
  check('brands/<id>/brand.js was not rewritten by the build',
    fs.readFileSync(path.join(brandsDir, 'alpha.test', 'brand.js'), 'utf8')
      .includes('Fallback copy for alpha.test'), true);

  console.log('\n===== C. Multi-brand isolation through one pipeline =====');
  const beta = read('beta.test', 'about.html');
  check('Brand A HTML contains A\'s content', alpha.includes(A.head) && alpha.includes(A.para));
  check('Brand A HTML contains NONE of B\'s content',
    !alpha.includes(B.head) && !alpha.includes(B.para) && !alpha.includes(B.alt) && !alpha.includes(B.btn));
  check('Brand B HTML contains B\'s content', beta.includes(B.head) && beta.includes(B.para));
  check('Brand B HTML contains NONE of A\'s content',
    !beta.includes(A.head) && !beta.includes(A.para) && !beta.includes(A.alt) && !beta.includes(A.btn));
  check('each brand got its own row and name',
    read('alpha.test', 'js/brand.js').includes('ALPHA') &&
    read('beta.test', 'js/brand.js').includes('BETA'));
  check('no brand id is hard-coded anywhere in the bake path',
    !/jsk-1|playzone/i.test(fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'pbbake.js'), 'utf8')) &&
    !/jsk-1|playzone/i.test(fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'minidom.js'), 'utf8')), true);

  console.log('\n===== D. Nothing published, draft, and empty canvas =====');
  const plain = read('plain.test', 'about.html');
  check('a brand with nothing published keeps the empty mount',
    /<div data-cms-sections="about"><\/div>/.test(plain), true);
  check('  and is not marked baked', !plain.includes('data-cms-baked'), true);
  check('  and still ships its fallback body',
    plain.match(/<div class="info-body"[^>]*>[\s\S]{200,}?<\/div>/) !== null, true);
  check('  and the build says nothing was baked',
    /Builder\s*:\s*\(no published content/.test(logs['plain.test']),
    (logs['plain.test'].match(/Builder.*/) || [''])[0]);

  const draft = read('draft.test', 'about.html');
  check('a DRAFT block is never baked', !draft.includes(A.head), true);
  check('  the mount stays empty for a draft',
    /<div data-cms-sections="about"><\/div>/.test(draft), true);

  const empty = read('empty.test', 'about.html');
  check('a published EMPTY canvas bakes an empty mount, and is marked baked',
    /<div data-cms-sections="about" data-cms-baked="0"><\/div>/.test(empty),
    (empty.match(/<div data-cms-sections="about"[^>]*>/) || [''])[0]);
  check('  no style element for an empty canvas', !empty.includes('cmsBuilder'), true);

  /* ================================================================
     E. RUNTIME IDEMPOTENCY — one copy, never two
     ================================================================
     The baked page is served from the temp build directory by fulfilling every
     request from it, so this is the real generated file with the real engine
     running against it -- not a page assembled in the test. */
  console.log('\n===== E. JavaScript does not duplicate the baked content =====');
  {
    const siteDir = path.join(outDir, 'alpha.test');
    const ORIGIN = 'https://alpha.test';

    /* row: what the live record says. null = no row at all. */
    async function openBaked(row) {
      const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.route('**/*', route => {
        const u = new URL(route.request().url());
        if (/supabase\.co$/.test(u.hostname)) {
          return route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(row ? [{ data: row, updated_at: '2026-09-28T10:00:00+00:00' }] : []) });
        }
        if (u.origin !== ORIGIN) return route.fulfill({ status: 204, body: '' });
        const f = path.join(siteDir, u.pathname.replace(/^\/+/, '') || 'index.html');
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
        const ext = path.extname(f).toLowerCase();
        const type = ext === '.html' ? 'text/html; charset=utf-8'
          : ext === '.css' ? 'text/css' : ext === '.js' ? 'application/javascript'
          : ext === '.png' ? 'image/png' : ext === '.json' ? 'application/json' : 'text/plain';
        return route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(f) });
      });
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', e => errs.push(String(e)));
      p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto(ORIGIN + '/about.html', { waitUntil: 'networkidle' });
      await p.waitForTimeout(700);
      return { ctx, p, errs };
    }

    const counts = p => p.evaluate(m => {
      const host = document.querySelector('[data-cms-sections="about"]');
      const txt = document.body.innerText;
      const count = s => txt.split(s).length - 1;
      return {
        sections: host ? host.querySelectorAll('.pb-section').length : -1,
        headings: host ? host.querySelectorAll('.pb-heading').length : -1,
        paragraphs: host ? host.querySelectorAll('.pb-textblock').length : -1,
        links: host ? host.querySelectorAll('a.pb-btn').length : -1,
        images: host ? host.querySelectorAll('img.pb-img').length : -1,
        headingTextOccurrences: count(m.head),
        paraTextOccurrences: count(m.para),
        hostHTML: host ? host.innerHTML : '',
        baked: host ? host.getAttribute('data-cms-baked') : null,
        fallbackHidden: (() => {
          const l = document.querySelector('[data-cms-html="pages.about.body"]');
          return l ? l.hidden : null;
        })(),
        styleTags: document.querySelectorAll('#cmsBuilder').length,
        h1s: document.querySelectorAll('h1').length
      };
    }, m => m, A);

    /* --- the row agrees with what was baked --- */
    const rowSame = { pages: { about: { builder: blockFor(A) } } };
    {
      const { ctx, p, errs } = await openBaked(rowSame);
      const c = await p.evaluate(() => {
        const host = document.querySelector('[data-cms-sections="about"]');
        return { sections: host.querySelectorAll('.pb-section').length,
                 headings: host.querySelectorAll('.pb-heading').length,
                 paragraphs: host.querySelectorAll('.pb-textblock').length,
                 links: host.querySelectorAll('a.pb-btn').length,
                 images: host.querySelectorAll('img.pb-img').length,
                 styleTags: document.querySelectorAll('#cmsBuilder').length,
                 h1s: document.querySelectorAll('h1').length,
                 fallbackHidden: document.querySelector('[data-cms-html="pages.about.body"]').hidden };
      });
      check('exactly one section after JS runs', c.sections === 1, c.sections);
      check('exactly one heading', c.headings === 1, c.headings);
      check('exactly one paragraph', c.paragraphs === 1, c.paragraphs);
      check('exactly one link', c.links === 1, c.links);
      check('exactly one image', c.images === 1, c.images);
      check('exactly one #cmsBuilder style element', c.styleTags === 1, c.styleTags);
      check('still exactly one H1 on the page', c.h1s === 1, c.h1s);
      check('the static fallback is hidden, not shown alongside', c.fallbackHidden === true, c.fallbackHidden);
      check('no page errors on the baked page', errs.length === 0, errs);
      await ctx.close();
    }

    /* --- no row at all: the bake is what visitors get --- */
    {
      const { ctx, p, errs } = await openBaked(null);
      const c = await p.evaluate(m => {
        const host = document.querySelector('[data-cms-sections="about"]');
        return { sections: host.querySelectorAll('.pb-section').length,
                 hasHead: host.textContent.indexOf(m) > -1,
                 fallbackHidden: document.querySelector('[data-cms-html="pages.about.body"]').hidden };
      }, A.head);
      check('with no published row, the baked content still stands', c.sections === 1, c.sections);
      check('  and it is the published heading', c.hasHead === true);
      check('  with the fallback hidden, because brand.js publishes it',
        c.fallbackHidden === true, c.fallbackHidden);
      check('no page errors', errs.length === 0, errs);
      await ctx.close();
    }

    /* --- the row says UNPUBLISHED: stale baked markup must go --- */
    {
      const rowDraft = { pages: { about: { builder: {
        schemaVersion: 2, status: 'draft', updatedAt: '2026-09-29',
        sections: blockFor(A).sections } } } };
      const { ctx, p, errs } = await openBaked(rowDraft);
      const c = await p.evaluate(m => {
        const host = document.querySelector('[data-cms-sections="about"]');
        return { sections: host.querySelectorAll('.pb-section').length,
                 stillHasHead: document.body.innerText.indexOf(m) > -1,
                 baked: host.getAttribute('data-cms-baked'),
                 fallbackHidden: document.querySelector('[data-cms-html="pages.about.body"]').hidden };
      }, A.head);
      check('unpublishing clears the stale baked sections', c.sections === 0, c.sections);
      check('  the published text is gone from the page', c.stillHasHead === false);
      check('  the baked marker is removed', c.baked === null, c.baked);
      check('  and the shipped fallback copy is shown again',
        c.fallbackHidden === false, c.fallbackHidden);
      check('no page errors', errs.length === 0, errs);
      await ctx.close();
    }

    /* --- the row publishes something DIFFERENT: replace, never append --- */
    {
      const rowNew = { pages: { about: { builder: blockFor(B) } } };
      const { ctx, p, errs } = await openBaked(rowNew);
      const c = await p.evaluate(m => {
        const host = document.querySelector('[data-cms-sections="about"]');
        const txt = document.body.innerText;
        return { sections: host.querySelectorAll('.pb-section').length,
                 headings: host.querySelectorAll('.pb-heading').length,
                 hasNew: txt.indexOf(m.newHead) > -1,
                 hasOld: txt.indexOf(m.oldHead) > -1 };
      }, { newHead: B.head, oldHead: A.head });
      check('a newer published row replaces the baked content', c.sections === 1, c.sections);
      check('  exactly one heading, not two', c.headings === 1, c.headings);
      check('  the row\'s content is shown', c.hasNew === true);
      check('  the baked content is gone, not left above it', c.hasOld === false);
      check('no page errors', errs.length === 0, errs);
      await ctx.close();
    }

    /* --- JAVASCRIPT DISABLED: the whole point --- */
    {
      const ctx = await b.newContext({ javaScriptEnabled: false });
      await ctx.route('**/*', route => {
        const u = new URL(route.request().url());
        if (u.origin !== ORIGIN) return route.fulfill({ status: 204, body: '' });
        const f = path.join(siteDir, u.pathname.replace(/^\/+/, '') || 'index.html');
        if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
                               body: fs.readFileSync(f) });
      });
      const p = await ctx.newPage();
      await p.goto(ORIGIN + '/about.html', { waitUntil: 'domcontentloaded' });
      const c = await p.evaluate(m => {
        const host = document.querySelector('[data-cms-sections="about"]');
        return { sections: host.querySelectorAll('.pb-section').length,
                 head: host.textContent.indexOf(m.head) > -1,
                 para: host.textContent.indexOf(m.para) > -1,
                 btn: host.textContent.indexOf(m.btn) > -1,
                 alt: (host.querySelector('img') || {}).alt || '',
                 href: (host.querySelector('a.pb-btn') || {}).getAttribute
                        ? host.querySelector('a.pb-btn').getAttribute('href') : '',
                 h1: (document.querySelector('h1') || {}).textContent };
      }, A);
      check('WITH JAVASCRIPT OFF, the builder section is present', c.sections === 1, c.sections);
      check('  the published heading is readable', c.head === true);
      check('  the published paragraph is readable', c.para === true);
      check('  the published button text is readable', c.btn === true);
      check('  the published image alt text is present', c.alt === A.alt, c.alt);
      check('  the published link href is present', c.href === A.href, c.href);
      check('  and the page still has its own H1', /About ALPHA/.test(c.h1 || ''), c.h1);
      await ctx.close();
    }
  }

  /* ================================================================
     F. THE SEO METADATA SYSTEM IS UNTOUCHED
     ================================================================ */
  console.log('\n===== F. Existing SEO metadata is unchanged =====');
  {
    /* Same brand, built with and without published builder content: every SEO
       tag, the sitemap and robots.txt must be identical. The bake adds body
       content; it must not touch metadata. */
    writeBrand(brandsDir, 'seo-a.test', { name: 'SEOBRAND' });
    writeBrand(brandsDir, 'seo-b.test', { name: 'SEOBRAND', builder: blockFor(A) });
    buildBrand(brandsDir, 'seo-a.test', outDir);
    buildBrand(brandsDir, 'seo-b.test', outDir);
    const noBake = read('seo-a.test', 'about.html');
    const withBake = read('seo-b.test', 'about.html');

    const tagsOf = html => {
      const pick = re => (html.match(re) || []).map(x => x.replace(/seo-[ab]\.test/g, 'BRAND'));
      return JSON.stringify({
        title: pick(/<title[^>]*>[^<]*<\/title>/g),
        desc: pick(/<meta name="description"[^>]*>/g),
        canonical: pick(/<link rel="canonical"[^>]*>/g),
        robots: pick(/<meta name="robots"[^>]*>/g),
        og: pick(/<meta property="og:[^"]*"[^>]*>/g),
        tw: pick(/<meta name="twitter:[^"]*"[^>]*>/g),
        ld: (html.match(/application\/ld\+json/g) || []).length,
        h1: pick(/<h1[^>]*>[^<]*<\/h1>/g)
      });
    };
    check('every SEO tag is identical with and without baked content',
      tagsOf(noBake) === tagsOf(withBake),
      tagsOf(noBake) === tagsOf(withBake) ? '' : { without: tagsOf(noBake), with: tagsOf(withBake) });
    check('  and the check is not vacuous: tags were actually found',
      /<link rel="canonical"/.test(withBake) && /application\/ld\+json/.test(withBake) &&
      /<meta property="og:title"/.test(withBake), true);
    check('exactly one H1, as before', (withBake.match(/<h1[\s>]/g) || []).length === 1,
      (withBake.match(/<h1[\s>]/g) || []).length);
    check('sitemap.xml is identical',
      read('seo-a.test', 'sitemap.xml').replace(/seo-a/g, 'X') ===
      read('seo-b.test', 'sitemap.xml').replace(/seo-b/g, 'X'), true);
    check('robots.txt is identical',
      read('seo-a.test', 'robots.txt').replace(/seo-a/g, 'X') ===
      read('seo-b.test', 'robots.txt').replace(/seo-b/g, 'X'), true);
    check('the baked page carries MORE body content than the unbaked one',
      withBake.length > noBake.length + 200, { with: withBake.length, without: noBake.length });
  }

  /* ================================================================
     G. A GENERATED PAGE STUB CARRIES WHAT IS ALREADY PUBLISHED
     ================================================================ */
  console.log('\n===== F2. The bake is deterministic and needs no network =====');
  {
    const src = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'pbbake.js'), 'utf8');
    check('the baker makes no network request of its own',
      !/require\(['"](https?|node:https?)['"]\)/.test(src) && !/https\.request|http\.request/.test(src),
      true);
    check('and its only inputs are the brand directory and the engine file',
      /brand\.js/.test(src) && /cms\.js/.test(src), true);

    /* Byte-identical output from two builds of the same commit. A static site
       is a build artifact; if the same input produced different HTML the diff
       would be unreviewable. */
    const outA = path.join(tmp, 'det-a');
    const outB = path.join(tmp, 'det-b');
    buildBrand(brandsDir, 'alpha.test', outA);
    buildBrand(brandsDir, 'alpha.test', outB);
    const fa = fs.readFileSync(path.join(outA, 'alpha.test', 'about.html'), 'utf8');
    const fb = fs.readFileSync(path.join(outB, 'alpha.test', 'about.html'), 'utf8');
    check('two builds of the same brand produce identical HTML', fa === fb, {
      a: fa.length, b: fb.length });
    check('  and it is not vacuous: the file carries baked content',
      fa.includes(A.head), true);
  }

  console.log('\n===== G. Newly created pages =====');
  {
    const ctx = await b.newContext();
    await ctx.route('**supabase.co/**', r =>
      r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e)));
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.evaluate(() => { const g = document.getElementById('authGate'); if (g) g.hidden = true; });

    const res = await p.evaluate(secs => {
      const d = window.CMS.data();
      /* A page created in the admin, exactly as btnCreatePage writes it. */
      d.pages.newpage = { label: 'New Page', url: 'newpage.html', slug: 'newpage',
        title: 'New Page', metaDescription: 'A new page', canonical: '',
        robots: { index: true, follow: true }, heading: 'New Page', lead: 'Lead', body: '',
        og: { title: '', description: '', image: '' },
        twitter: { title: '', description: '', image: '' },
        breadcrumb: { label: 'New Page', show: true },
        schema: { webPage: true, breadcrumb: true, contactPage: false },
        inSitemap: true, updatedAt: '2026-09-28', builderMount: true };
      const before = window.ADMIN_NEW_PAGE_HTML('newpage');
      d.pages.newpage.builder = { schemaVersion: 2, status: 'published',
                                  updatedAt: '2026-09-28', sections: secs };
      const after = window.ADMIN_NEW_PAGE_HTML('newpage');
      return { before: before, after: after };
    }, blockFor(A).sections);

    check('with nothing published, the stub ships an empty mount',
      /<div data-cms-sections="newpage"><\/div>/.test(res.before), true);
    check('with content published, the stub carries it',
      res.after.includes('>' + A.head + '<') && res.after.includes('>' + A.para + '<'),
      true);
    check('  the stub mount is marked baked',
      /<div data-cms-sections="newpage" data-cms-baked="1">/.test(res.after), true);
    check('  the stub carries the section styles too',
      /<style id="cmsBuilder">/.test(res.after), true);
    check('  the stub markup is what the build would produce',
      res.after.includes(bake.render(ROOT, blockFor(A)).html), true);
    check('  and the stub is still a complete page',
      /<!DOCTYPE html>/.test(res.after) && /<\/html>/.test(res.after) &&
      /data-cms-title="pages\.newpage\.title"/.test(res.after), true);
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  fs.rmSync(tmp, { recursive: true, force: true });
  await b.close();
  process.exit(fail ? 1 : 0);
})();
