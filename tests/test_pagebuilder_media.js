/* Page Builder V2 -- milestone B: the asset system and the preview.

   The asset system's whole claim is that the picker can only ever produce
   a file that is already in this repository. That rests on two things: a
   manifest generated from what is actually on disk, and pbAsset(), a
   stricter question than pbUrl() -- not "is this safe in a src" but "is
   this one of ours". Both are tested here, and both are mutation-tested.

   The preview's claim is that it is a viewing mode: the frame is laid out
   at a real viewport width so the site's own breakpoints apply, and
   switching between widths writes nothing anywhere. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const stub = (target, state) => target.route('**supabase.co/**', route => {
  const q = route.request();
  if (q.url().includes('/auth/v1/token'))
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"stub"}' });
  if (q.method() === 'POST') {
    state.posts++; state.row = JSON.parse(q.postData() || '{}');
    return route.fulfill({ status: 201, body: '' });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(state.row ? [{ data: state.row.data, updated_at: state.row.updated_at }] : []) });
});

async function page(b, seed, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  if (seed) await p.addInitScript((arg) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg);
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}

/* Publishes `sections` on about.html alongside any other seeded config. */
const published = (b, sections, seed, width) =>
  page(b, Object.assign({
    pages: { about: { builder: { schemaVersion: 2, status: 'published', sections } } }
  }, seed || {}), width);

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });

const ROOT = path.join(__dirname, '..');
const MANIFEST = path.join(ROOT, 'assets', 'asset-manifest.json');

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     THE MANIFEST IS GENERATED FROM WHAT IS ACTUALLY THERE
     ================================================================ */
  console.log('\n===== THE ASSET MANIFEST DESCRIBES REAL FILES =====');
  {
    check('the manifest is committed', fs.existsSync(MANIFEST));
    const raw = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    check('it names itself and carries a version',
      raw.kind === 'jsk1-asset-manifest' && raw.version === 1, raw.kind);
    check('and it lists something', raw.assets.length > 0, raw.assets.length);

    /* Every entry must be a file that exists, at the size recorded. */
    const missing = [], wrongBytes = [];
    raw.assets.forEach(a => {
      const f = path.join(ROOT, a.path);
      if (!fs.existsSync(f)) { missing.push(a.path); return; }
      if (a.bytes && fs.statSync(f).size !== a.bytes) wrongBytes.push(a.path);
    });
    check('every listed asset is a file that exists', missing.length === 0, missing.slice(0, 5));
    check('and its recorded size matches the file', wrongBytes.length === 0, wrongBytes.slice(0, 5));

    /* And every image on disk under the roots must be listed, or the
       picker would silently hide something. */
    const onDisk = [];
    ['assets/images', 'assets/images/games', 'assets/icons'].forEach(d => {
      const abs = path.join(ROOT, d);
      if (!fs.existsSync(abs)) return;
      fs.readdirSync(abs).forEach(n => {
        if (fs.statSync(path.join(abs, n)).isFile() && /\.(png|jpe?g|gif|svg|webp)$/i.test(n)) {
          onDisk.push(d + '/' + n);
        }
      });
    });
    const listed = new Set(raw.assets.map(a => a.path));
    const notListed = onDisk.filter(p => !listed.has(p));
    check('every image under the roots is listed (' + onDisk.length + ' files)',
      notListed.length === 0, notListed.slice(0, 5));

    /* Dimensions are real or absent -- never invented. */
    const bad = raw.assets.filter(a => (a.w && !a.h) || (a.h && !a.w) ||
                                       (a.w !== undefined && !(a.w > 0)));
    check('dimensions are either a real pair or absent', bad.length === 0, bad.slice(0, 3));

    /* Regenerating must produce the same bytes, or the file is not a
       reliable record of the directory. */
    const before = fs.readFileSync(MANIFEST, 'utf8');
    require('child_process').execFileSync('node',
      [path.join(ROOT, 'tools', 'build-asset-manifest.js')], { stdio: 'ignore' });
    const after = fs.readFileSync(MANIFEST, 'utf8');
    check('regenerating it is deterministic, byte for byte', before === after);
  }

  {
    /* Served, and every path reachable over HTTP the way the admin asks
       for it. */
    const ctx = await b.newContext();
    await stub(ctx, { posts: 0, row: null });
    const p = await ctx.newPage();
    /* fetch() needs an origin, so land on the site first. */
    await p.goto(`${BASE}/about.html`, { waitUntil: 'domcontentloaded' });
    const raw = await p.evaluate(async (base) => {
      const r = await fetch(base + '/assets/asset-manifest.json');
      return { ok: r.ok, type: r.headers.get('content-type'), body: await r.json() };
    }, BASE);
    check('the manifest is served as JSON', raw.ok && /json/.test(raw.type), raw.type);
    const sample = raw.body.assets.filter((_, i) => i % 17 === 0).slice(0, 8);
    const codes = [];
    for (const a of sample) {
      const r = await p.evaluate(async (u) => (await fetch(u, { method: 'GET' })).status, BASE + '/' + a.path);
      codes.push(a.path + ':' + r);
    }
    check('a spread of listed assets all resolve over HTTP',
      codes.every(c => c.endsWith(':200')), codes);
    await ctx.close();
  }

  /* ================================================================
     THE ALLOW-LIST
     ================================================================ */
  console.log('\n===== ONLY THIS REPOSITORY’S OWN IMAGE PATHS ARE ASSETS =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const A = CMS.sections.assetPath;
      const good = ['assets/images/logo.png', 'assets/images/games/aaa.jpg',
                    'assets/icons/lock.svg', 'assets/images/favicon.png'];
      const bad = [
        'javascript:alert(1)', 'JavaScript:alert(1)', 'data:image/png;base64,AAAA',
        'blob:http://localhost/abc', 'vbscript:msgbox(1)',
        '//evil.example/x.png', 'https://evil.example/x.png', 'http://evil.example/x.png',
        '../../etc/passwd', 'assets/images/../../secret.png', 'assets/images/../icons/lock.svg',
        '..%2f..%2fx.png', '/assets/images/logo.png', './assets/images/logo.png',
        'assets\\\\images\\\\logo.png', 'assets/images/logo.png?x=1', 'assets/images/logo.png#a',
        'assets/images/', 'assets/images/evil.html', 'assets/images/evil.js',
        'assets/images/evil.svg.js', 'js/cms.js', 'admin/index.html', 'index.html',
        'assets/other/x.png', 'ASSETS/images/logo.png', '', '   ', null, undefined, 5, {}, [],
        'assets/images/lo go.png', 'assets/images/logo.png\u0000', 'assets//images/logo.png'
      ];
      return {
        good: good.map(g => [g, A(g)]),
        bad: bad.map(x => [String(x), A(x)]).filter(pair => pair[1] !== '')
      };
    });
    check('every real asset path is accepted unchanged',
      r.good.every(g => g[1] === g[0]), r.good.filter(g => g[1] !== g[0]));
    check('and every hostile or foreign path is refused', r.bad.length === 0, r.bad);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== THE LIST IS REBUILT FROM THE FILE, NOT TRUSTED =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const L = CMS.sections.assetList, out = {};
      out.fromNull = L(null).length;
      out.fromString = L('nope').length;
      out.fromNumber = L(7).length;
      out.noAssets = L({ kind: 'x' }).length;
      out.junkRows = L({ assets: [null, 5, 'x', [], {}, { path: 1 }] }).length;
      out.hostile = L({ assets: [
        { path: 'javascript:alert(1)', name: 'a' },
        { path: 'https://evil.example/x.png', name: 'b' },
        { path: '../../secret.png', name: 'c' },
        { path: 'js/cms.js', name: 'd' },
        { path: 'assets/images/logo.png', name: 'ok' }
      ] });
      out.dupes = L({ assets: [
        { path: 'assets/images/logo.png', name: 'first' },
        { path: 'assets/images/logo.png', name: 'second' }
      ] });
      /* Looked up by path, because the list is deliberately re-sorted. */
      var dims = L({ assets: [
        { path: 'assets/images/logo.png', w: -1, h: 0 },
        { path: 'assets/images/ssl.png', w: 'x', h: 'y' },
        { path: 'assets/images/favicon.png', w: 1e9, h: 1e9 },
        { path: 'assets/icons/lock.svg', w: 20, h: 30 }
      ] });
      out.badDims = {};
      dims.forEach(function (d) { out.badDims[d.path] = d; });
      out.protoRow = L(JSON.parse('{"assets":[{"path":"assets/images/logo.png",' +
        '"__proto__":{"pwned":1},"constructor":{"x":1}}]}'));
      out.pwned = ({}).pwned;
      /* order does not depend on the order it arrived in */
      const forward = L({ assets: [{ path: 'assets/images/ssl.png' }, { path: 'assets/images/logo.png' }] });
      const backward = L({ assets: [{ path: 'assets/images/logo.png' }, { path: 'assets/images/ssl.png' }] });
      out.deterministic = JSON.stringify(forward) === JSON.stringify(backward);
      return out;
    });

    check('a registry that is null, a string, a number or empty reads as empty',
      r.fromNull === 0 && r.fromString === 0 && r.fromNumber === 0 && r.noAssets === 0, r);
    check('junk rows are skipped', r.junkRows === 0, r.junkRows);
    check('hostile and foreign paths never reach the list',
      r.hostile.length === 1 && r.hostile[0].path === 'assets/images/logo.png', r.hostile);
    check('a duplicate path is listed once', r.dupes.length === 1, r.dupes);
    check('and the first entry wins', r.dupes[0].name === 'first', r.dupes[0]);
    check('nonsense dimensions are dropped rather than stored',
      !('w' in r.badDims['assets/images/logo.png']) &&
      !('w' in r.badDims['assets/images/ssl.png']) &&
      !('w' in r.badDims['assets/images/favicon.png']), r.badDims);
    check('while a sane pair is kept',
      r.badDims['assets/icons/lock.svg'].w === 20 &&
      r.badDims['assets/icons/lock.svg'].h === 30, r.badDims['assets/icons/lock.svg']);
    check('prototype keys on a row are not copied',
      Object.keys(r.protoRow[0]).every(k => ['path', 'name', 'group', 'w', 'h', 'bytes'].indexOf(k) > -1) &&
      r.pwned === undefined, Object.keys(r.protoRow[0]));
    check('the list is ordered by path, whatever order it arrived in', r.deterministic);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     THE IMAGE ELEMENT
     ================================================================ */
  console.log('\n===== IMAGES RENDER, OLD AND NEW =====');
  {
    const S = [sec('s1', 'text', { elements: [
      /* the shape a V1 page already holds */
      el('v1', 'image', { src: 'assets/images/logo.png', alt: 'Old logo', width: 300, height: 100 },
         { maxWidth: 400, radius: 8 }, { mobile: { maxWidth: 200 } }),
      /* an asset chosen through the picker, with its real dimensions */
      /* 400x400 is what the manifest records for this file, read from its
         own JPEG header -- the numbers the picker would fill in. */
      el('picked', 'image', { src: 'assets/images/games/aaa.jpg', alt: 'A game', width: 400, height: 400 }, {}),
      /* a linked image */
      el('linked', 'image', { src: 'assets/icons/lock.svg', alt: 'Lock', href: 'contact.html' }, {}),
      /* a card and a feature box, which also carry images */
      el('card', 'card', { title: 'C', text: 'c', image: 'assets/images/ssl.png', imageAlt: 'SSL' }, {}),
      el('feat', 'featureBox', { title: 'F', text: 'f', image: 'assets/images/favicon.png', imageAlt: 'Fav' }, {}),
      /* refused sources must render nothing at all */
      el('bad1', 'image', { src: 'javascript:alert(1)', alt: 'x' }, {}),
      el('bad2', 'image', { src: 'data:image/png;base64,AAAA', alt: 'x' }, {}),
      el('bad3', 'image', { src: '//evil.example/x.png', alt: 'x' }, {})
    ] })];
    const { ctx, p, errs } = await published(b, S, null, 1280);
    const r = await p.evaluate(() => {
      const g = id => {
        const n = document.querySelector('[data-el="' + id + '"]');
        if (!n) return null;
        const img = n.tagName === 'IMG' ? n : n.querySelector('img');
        const cs = getComputedStyle(n);
        return { tag: n.tagName, src: img && img.getAttribute('src'),
                 alt: img && img.getAttribute('alt'),
                 w: img && img.getAttribute('width'), h: img && img.getAttribute('height'),
                 loading: img && img.getAttribute('loading'),
                 decoding: img && img.getAttribute('decoding'),
                 maxW: cs.maxWidth, radius: cs.borderTopLeftRadius,
                 natural: img ? img.naturalWidth : 0,
                 /* The id is put on the IMG, so a linked image's anchor is
                    its parent -- that is the V1 shape and it has to stay. */
                 parent: n.parentElement ? n.parentElement.tagName : null,
                 parentHref: n.parentElement ? n.parentElement.getAttribute('href') : null };
      };
      return { v1: g('v1'), picked: g('picked'), linked: g('linked'),
               card: g('card'), feat: g('feat'),
               bad1: g('bad1'), bad2: g('bad2'), bad3: g('bad3'),
               cardImg: !!document.querySelector('[data-el="card"] img'),
               featImg: !!document.querySelector('[data-el="feat"] img') };
    });

    check('a V1 image still renders with its alt and dimensions',
      r.v1.src === 'assets/images/logo.png' && r.v1.alt === 'Old logo' &&
      r.v1.w === '300' && r.v1.h === '100', r.v1);
    check('and its styles still apply', r.v1.maxW === '400px' && r.v1.radius === '8px', r.v1);
    check('the browser actually loaded it', r.v1.natural > 0, r.v1.natural);
    check('a picked asset renders at the dimensions the manifest records',
      r.picked.w === '400' && r.picked.h === '400' && r.picked.natural === 400, r.picked);
    check('lazy loading and async decoding are still set',
      r.picked.loading === 'lazy' && r.picked.decoding === 'async', r.picked);
    check('a linked image is still the styled node, wrapped in an anchor',
      r.linked.tag === 'IMG' && r.linked.parent === 'A' &&
      r.linked.parentHref === 'contact.html' && r.linked.natural > 0, r.linked);
    check('a card image renders', r.cardImg && r.card.natural > 0, r.card);
    check('a feature box image renders', r.featImg && r.feat.natural > 0, r.feat);
    check('a javascript:, data: or protocol-relative source renders nothing',
      r.bad1 === null && r.bad2 === null && r.bad3 === null, [r.bad1, r.bad2, r.bad3]);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  {
    /* Responsive and global-design behaviour on an image. */
    for (const [label, w, want] of [['desktop', 1280, '400px'], ['mobile', 700, '200px']]) {
      const S = [sec('s1', 'text', { elements: [
        el('i', 'image', { src: 'assets/images/logo.png', alt: 'L' },
           { maxWidth: 400, border: '3px solid @primary' }, { mobile: { maxWidth: 200 } })
      ] })];
      const { ctx, p, errs } = await published(b, S, { colors: { 'hdr-bg': '#2255aa' } }, w);
      const r = await p.evaluate(() => {
        const c = getComputedStyle(document.querySelector('[data-el="i"]'));
        return { maxW: c.maxWidth, bw: c.borderTopWidth, bc: c.borderTopColor };
      });
      check('an image’s ' + label + ' max width applies', r.maxW === want, r);
      check('and a global colour role on its border resolves at ' + label,
        r.bw === '3px' && r.bc === 'rgb(34, 85, 170)', r);
      check(label + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  /* ================================================================
     THE PICKER AND THE PREVIEW, THROUGH THE ADMIN
     ================================================================ */
  console.log('\n===== THE ASSET PICKER =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1300 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(700);
    await p.click('#pbAdd .pb-addbtn[data-type="image"]'); await p.waitForTimeout(600);

    const CARD = '#pbList .pb-sec:first-child .pb-elcard:first-child';
    const eid = await p.$eval(CARD, n => n.getAttribute('data-el-id'));
    const content = () => p.evaluate(id => {
      const d = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts || {};
      for (const k in d) for (const s of d[k].sections || []) for (const e of s.elements || [])
        if (e.id === id) return e.content;
      return null;
    }, eid);

    check('the image field offers a picker button',
      (await p.$$(CARD + ' [data-act="pick-asset"]')).length === 1);
    check('and says there is no image yet',
      /No image chosen/.test(await p.$eval(CARD + ' .pb-imgpick-path', n => n.textContent)));

    await p.click(CARD + ' [data-act="pick-asset"]'); await p.waitForTimeout(900);
    check('it opens', await p.$eval('#pbAssetModal', n => !n.hidden));
    const tiles = await p.$$eval('#pbAssetGrid .pb-asset', n => n.length);
    const listed = await p.evaluate(async (base) =>
      (await (await fetch(base + '/assets/asset-manifest.json')).json()).assets.length, BASE);
    check('showing every asset in the manifest (' + listed + ')', tiles === listed, { tiles, listed });
    check('each tile shows a thumbnail and its real size',
      await p.$eval('#pbAssetGrid .pb-asset', n =>
        !!n.querySelector('img') && /\d+×\d+/.test(n.querySelector('.pb-asset-meta').textContent)));
    check('and the Use button is disabled until something is chosen',
      await p.$eval('#pbAssetUse', n => n.disabled));

    /* search */
    await p.fill('#pbAssetSearch', 'logo'); await p.waitForTimeout(250);
    check('search narrows to matching assets',
      (await p.$$eval('#pbAssetGrid .pb-asset', n => n.map(x => x.getAttribute('data-asset'))))
        .join() === 'assets/images/logo.png');
    await p.fill('#pbAssetSearch', 'Games'); await p.waitForTimeout(250);
    const byGroup = await p.$$eval('#pbAssetGrid .pb-asset', n => n.length);
    check('and it matches the group as well as the name', byGroup > 10, byGroup);
    await p.fill('#pbAssetSearch', 'zzzznothing'); await p.waitForTimeout(250);
    check('a search with no match says so',
      /No image matches/.test(await p.$eval('#pbAssetGrid', n => n.textContent)));
    await p.fill('#pbAssetSearch', ''); await p.waitForTimeout(250);

    /* cancel leaves everything alone */
    await p.click('#pbAssetGrid .pb-asset[data-asset="assets/images/ssl.png"]'); await p.waitForTimeout(200);
    await p.click('#pbAssetCancel'); await p.waitForTimeout(400);
    check('Cancel closes it', await p.$eval('#pbAssetModal', n => n.hidden));
    check('and nothing was written', !(await content()).src, await content());

    /* choose one */
    await p.click(CARD + ' [data-act="pick-asset"]'); await p.waitForTimeout(600);
    await p.click('#pbAssetGrid .pb-asset[data-asset="assets/images/logo.png"]'); await p.waitForTimeout(200);
    check('the chosen tile is marked selected',
      await p.$eval('#pbAssetGrid .pb-asset[data-asset="assets/images/logo.png"]',
        n => n.classList.contains('selected')));
    check('and the footer names it',
      /assets\/images\/logo\.png/.test(await p.$eval('#pbAssetChosen', n => n.textContent)));
    await p.click('#pbAssetUse'); await p.waitForTimeout(800);
    const c1 = await content();
    check('using it stores the path, not the picture',
      c1.src === 'assets/images/logo.png' && JSON.stringify(c1).length < 200, c1);
    check('and fills in the dimensions the manifest recorded',
      c1.width === 675 && c1.height === 229, c1);
    check('the field now shows a thumbnail of it',
      await p.$eval(CARD + ' .pb-imgpick-thumb', n => !n.hidden && /logo\.png$/.test(n.getAttribute('src'))));

    /* alt text persists alongside it */
    await p.fill(CARD + ' .pb-field:has(> span:text-is("Alt text")) .pb-in', 'The site logo');
    await p.waitForTimeout(600);
    check('alt text is stored beside it', (await content()).alt === 'The site logo');

    /* reopening keeps the current selection */
    await p.click(CARD + ' [data-act="pick-asset"]'); await p.waitForTimeout(600);
    check('reopening the picker has the current image already selected',
      await p.$eval('#pbAssetGrid .pb-asset[data-asset="assets/images/logo.png"]',
        n => n.classList.contains('selected')));

    /* replace it */
    await p.click('#pbAssetGrid .pb-asset[data-asset="assets/images/games/aaa.jpg"]'); await p.waitForTimeout(200);
    await p.click('#pbAssetUse'); await p.waitForTimeout(800);
    const c2 = await content();
    check('replacing swaps the path and the dimensions with it',
      c2.src === 'assets/images/games/aaa.jpg' && c2.width === 400 && c2.height === 400, c2);
    check('and leaves the alt text alone', c2.alt === 'The site logo', c2);

    /* cancel after a replacement leaves the old one */
    await p.click(CARD + ' [data-act="pick-asset"]'); await p.waitForTimeout(600);
    await p.click('#pbAssetGrid .pb-asset[data-asset="assets/images/ssl.png"]'); await p.waitForTimeout(200);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    check('Escape closes it', await p.$eval('#pbAssetModal', n => n.hidden));
    check('and the previous image is still the one in use',
      (await content()).src === 'assets/images/games/aaa.jpg', await content());

    /* a path that is not one of ours */
    await p.fill(CARD + ' .pb-field:has(> span:text-is("Image")) .pb-in', 'https://evil.example/x.png');
    await p.waitForTimeout(600);
    check('typing a foreign URL is flagged as not one of this site’s images',
      /Not one of/.test(await p.$eval(CARD + ' .pb-imgpick-path', n => n.textContent)));
    check('and the picker still opens on nothing selected', await (async () => {
      await p.click(CARD + ' [data-act="pick-asset"]'); await p.waitForTimeout(500);
      const sel = await p.$$eval('#pbAssetGrid .pb-asset.selected', n => n.length);
      const disabled = await p.$eval('#pbAssetUse', n => n.disabled);
      await p.click('#pbAssetCancel'); await p.waitForTimeout(300);
      return sel === 0 && disabled;
    })());
    await p.fill(CARD + ' .pb-field:has(> span:text-is("Image")) .pb-in', 'assets/images/logo.png');
    await p.waitForTimeout(600);

    /* the card element carries an image too */
    await p.click('#pbList .pb-sec:first-child .pb-add-el .pb-addbtn[data-el-type="card"]');
    await p.waitForTimeout(500);
    check('a card also gets the picker',
      (await p.$$('#pbList .pb-sec:first-child .pb-elcard:last-child [data-act="pick-asset"]')).length === 1);

    check('the admin ran without console or page errors', errs.length === 0, errs.slice(0, 3));

    /* ---------------- PREVIEW ---------------- */
    console.log('\n===== THE PREVIEW IS A VIEWING MODE =====');
    await p.click('#pbTemplates .pb-template[data-template="landing"]'); await p.waitForTimeout(900);
    const fr = () => p.frame({ url: u => /about\.html/.test(u) });

    const before = await p.evaluate(() =>
      JSON.stringify(CMS.sections.draft('about').sections));
    const liveBefore = await p.evaluate(() => CMS.sections.live('about').length);

    const seen = {};
    for (const v of ['desktop', 'tablet', 'mobile']) {
      await p.click(`#pbDevices .pb-devtab[data-viewport="${v}"]`); await p.waitForTimeout(500);
      const f = fr();
      seen[v] = {
        active: await p.$eval(`#pbDevices .pb-devtab[data-viewport="${v}"]`,
          n => n.classList.contains('active') && n.getAttribute('aria-pressed') === 'true'),
        inner: await f.evaluate(() => window.innerWidth),
        cols: await f.evaluate(() => {
          const c = document.querySelector('.pb-columns');
          return c ? getComputedStyle(c).gridTemplateColumns.trim().split(/\s+/).length : null;
        }),
        heading: await f.evaluate(() => {
          const h = document.querySelector('.pb-hero .pb-heading');
          return h ? getComputedStyle(h).fontSize : null;
        }),
        sections: await f.evaluate(() => document.querySelectorAll('.pb-section').length),
        tag: await p.$eval('#pbViewportTag', n => n.textContent)
      };
    }
    check('desktop renders at 1280, above the 1024 breakpoint',
      seen.desktop.inner === 1280 && /over 1024px/.test(seen.desktop.tag), seen.desktop);
    check('tablet renders at 900, inside the 769-1024 band',
      seen.tablet.inner === 900 && /769/.test(seen.tablet.tag), seen.tablet);
    check('mobile renders at 390, inside the up-to-768 band',
      seen.mobile.inner === 390 && /768/.test(seen.mobile.tag), seen.mobile);
    check('each button marks itself active and pressed',
      seen.desktop.active && seen.tablet.active && seen.mobile.active, seen);
    check('columns really do stack on the mobile viewport',
      seen.desktop.cols === 3 && seen.tablet.cols === 3 && seen.mobile.cols === 1,
      [seen.desktop.cols, seen.tablet.cols, seen.mobile.cols]);
    check('typography roles resolve at every viewport',
      seen.desktop.heading === '34px' && seen.mobile.heading === '34px', seen);
    check('and every section is rendered at every viewport',
      [seen.desktop, seen.tablet, seen.mobile].every(v => v.sections === 4), seen);

    check('switching viewports changed nothing in the draft',
      (await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))) === before);
    check('and published nothing',
      (await p.evaluate(() => CMS.sections.live('about').length)) === liveBefore);
    check('no responsive override was written by looking at a viewport',
      await p.evaluate(() => CMS.sections.draft('about').sections.every(s =>
        JSON.stringify(s.responsive || {}) === '{}' || !Object.keys(s.responsive).some(k =>
          Object.keys(s.responsive[k] || {}).length))));

    /* the frame is scaled, never stretched */
    const fit = await p.evaluate(() => {
      const f = document.getElementById('pbFrame');
      const m = /scale\(([0-9.]+)\)/.exec(f.style.transform);
      return { k: m ? parseFloat(m[1]) : null, w: f.style.width, ml: f.style.marginLeft };
    });
    check('the mobile frame is never scaled up past its real size', fit.k <= 1, fit);
    check('and it is centred in the stage', parseInt(fit.ml, 10) > 0, fit);

    /* survives a page switch and a reload */
    await p.click('#pbTabs .pagetab[data-slug="contact"]'); await p.waitForTimeout(700);
    await p.click('#pbTabs .pagetab[data-slug="about"]'); await p.waitForTimeout(700);
    check('the viewport choice survives switching pages',
      await p.$eval('#pbDevices .pb-devtab[data-viewport="mobile"]', n => n.classList.contains('active')));
    check('and the draft came back unchanged',
      (await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))) === before);

    await p.reload({ waitUntil: 'networkidle' });
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(900);
    check('the draft survives a reload',
      (await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))) === before);
    const f2 = fr();
    check('and the preview repaints the draft, not what is published',
      (await f2.evaluate(() => document.querySelectorAll('.pb-section').length)) === 4);
    check('while the page itself is still unpublished',
      (await p.evaluate(() => CMS.sections.live('about').length)) === liveBefore);

    /* a reusable section holding an image, previewed */
    await p.click('#pbList .pb-sec:first-child [data-act="save-reusable"]'); await p.waitForTimeout(700);
    await p.click('#pbLibrary .pb-lib-item [data-act="lib-insert"]'); await p.waitForTimeout(800);
    const f3 = fr();
    check('a reusable section renders in the preview',
      (await f3.evaluate(() => document.querySelectorAll('.pb-section').length)) === 5);

    check('the admin still had no console or page errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
