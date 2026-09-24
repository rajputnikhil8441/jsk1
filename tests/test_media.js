/* =====================================================================
   UPLOADED CMS MEDIA
   ---------------------------------------------------------------------
   Everything an admin can upload passes through CMSMedia.validate() and
   CMS.sections.mediaPath(). This suite attacks both.

   The rule being defended: a file served from this site's own origin is
   a picture, it is named by this code, and it is what it says it is.
   Nothing the uploader supplies -- name, extension, MIME type -- is
   trusted on its own.
   ===================================================================== */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8777';
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* Real, minimal, valid files of each accepted type. */
const B64 = {
  png:  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  gif:  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  jpeg: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwg' +
        'JC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAA' +
        'AAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  webp: 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA='
};

const STORAGE = 'https://wspanesckdedctpfbqah.supabase.co/storage/v1/object/public/cms-media/';

async function admin(b, opts) {
  opts = opts || {};
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  const uploaded = [];
  let row = null;
  await ctx.route('**supabase.co/**', r => {
    const q = r.request(), u = q.url();
    if (u.includes('/auth/v1/token'))
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
    if (u.includes('/storage/v1/object/')) {
      if (q.method() === 'POST') {
        if (opts.storageFails) return r.fulfill({ status: 403, body: 'new row violates row-level security policy' });
        uploaded.push({ url: u, auth: q.headers()['authorization'] || '', type: q.headers()['content-type'] || '',
                        upsert: q.headers()['x-upsert'] || '' });
        return r.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"ok"}' });
      }
      if (q.method() === 'DELETE') return r.fulfill({ status: 200, body: '{}' });
      return r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(B64.png, 'base64') });
    }
    if (q.method() === 'POST') { row = JSON.parse(q.postData() || '{}'); return r.fulfill({ status: 201, body: '' }); }
    return r.fulfill({ status: 200, contentType: 'application/json',
                       body: JSON.stringify(row ? [{ data: row.data, updated_at: row.updated_at }] : []) });
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
  await p.waitForTimeout(400);
  if (opts.mediaOn !== false) {
    await p.evaluate(m => { window.CMS_MEDIA.enabled = true; if (m) window.CMS_MEDIA.maxBytes = m; },
                     opts.maxBytes || 0);
  }
  return { ctx, p, errs, uploaded, rowOf: () => row };
}

/* Runs the real gate in the page, on bytes we control completely. */
function gate(p, { bytes, b64, name, type }) {
  return p.evaluate(async a => {
    let buf;
    if (a.b64) {
      const bin = atob(a.b64);
      buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    } else {
      buf = new Uint8Array(a.bytes);
    }
    const f = new File([buf], a.name, { type: a.type });
    return await window.CMSMedia.validate(f);
  }, { bytes, b64, name, type });
}

const ascii = s => Array.from(s).map(c => c.charCodeAt(0));

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ==================================================================
     1. WHAT IS ACCEPTED
     ================================================================== */
  console.log('\n===== REAL IMAGES ARE ACCEPTED =====');
  {
    const { ctx, p, errs } = await admin(b);
    for (const [ext, type, key] of [['png', 'image/png', 'png'], ['jpg', 'image/jpeg', 'jpeg'],
                                    ['jpeg', 'image/jpeg', 'jpeg'], ['webp', 'image/webp', 'webp'],
                                    ['gif', 'image/gif', 'gif']]) {
      const v = await gate(p, { b64: B64[key], name: 'holiday.' + ext, type });
      check(`a real ${ext.toUpperCase()} is accepted`, v.ok === true, v.reason);
      if (v.ok) check(`  and its real dimensions are read from the file`, v.w === 1 && v.h === 1, { w: v.w, h: v.h });
    }
    check('no console errors validating good files', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     2. WHAT IS REFUSED
     ================================================================== */
  console.log('\n===== HOSTILE AND WRONG FILES ARE REFUSED =====');
  {
    const { ctx, p, errs } = await admin(b, { maxBytes: 1024 });

    const cases = [
      ['an .exe',                        { b64: B64.png, name: 'setup.exe', type: 'application/octet-stream' }, /not an image format/i],
      ['an .svg (a script host)',        { b64: B64.png, name: 'logo.svg', type: 'image/svg+xml' },            /not an image format/i],
      ['a .php',                         { b64: B64.png, name: 'shell.php', type: 'image/png' },               /not an image format/i],
      ['a file with no extension',       { b64: B64.png, name: 'picture', type: 'image/png' },                 /no extension/i],
      ['a PNG claiming to be a GIF',     { b64: B64.png, name: 'a.png', type: 'image/gif' },                   /has to be what it claims/i],
      ['a file with no MIME type',       { b64: B64.png, name: 'a.png', type: '' },                            /could not say what kind/i],
      ['an empty file',                  { bytes: [], name: 'a.png', type: 'image/png' },                      /empty/i]
    ];
    for (const [label, file, re] of cases) {
      const v = await gate(p, file);
      check(`${label} is refused`, v.ok === false && re.test(v.reason || ''), v.reason);
    }

    /* the interesting ones: the bytes lie about themselves */
    const elf = await gate(p, { bytes: [0x7F, 0x45, 0x4C, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                                name: 'holiday.png', type: 'image/png' });
    check('a renamed Linux executable is refused', elf.ok === false && /not a real PNG/i.test(elf.reason), elf.reason);

    const sh = await gate(p, { bytes: ascii('#!/bin/sh\nrm -rf /\n' + 'x'.repeat(40)), name: 'holiday.png', type: 'image/png' });
    check('a renamed shell script is refused', sh.ok === false && /not a real PNG/i.test(sh.reason), sh.reason);

    const html = await gate(p, { bytes: ascii('<!DOCTYPE html><html><script>alert(1)</script></html>' + ' '.repeat(40)),
                                 name: 'holiday.png', type: 'image/png' });
    check('HTML disguised as a PNG is refused', html.ok === false && /document or a script/i.test(html.reason), html.reason);

    const svg = await gate(p, { bytes: ascii('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><script>x()</script></svg>'),
                                name: 'holiday.png', type: 'image/png' });
    check('an SVG payload behind a .png name is refused', svg.ok === false && /document or a script/i.test(svg.reason), svg.reason);

    const xml = await gate(p, { bytes: ascii('<?xml version="1.0"?><svg/>' + ' '.repeat(40)), name: 'a.gif', type: 'image/gif' });
    check('an XML document named .gif is refused', xml.ok === false, xml.reason);

    /* a real PNG header with a body that will not decode */
    const trunc = await gate(p, { bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0],
                                  name: 'a.png', type: 'image/png' });
    check('a file with the right header that will not decode is refused', trunc.ok === false && /could not be opened/i.test(trunc.reason), trunc.reason);

    /* size */
    const big = await gate(p, { bytes: Array.from({ length: 4096 }, (_, i) => i % 256), name: 'a.png', type: 'image/png' });
    check('a file over the size limit is refused before anything is sent',
      big.ok === false && /limit is/i.test(big.reason), big.reason);

    check('no console errors refusing hostile files', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     3. THE NAME THE UPLOADER CHOSE IS NEVER THE NAME ON DISK
     ================================================================== */
  console.log('\n===== GENERATED OBJECT NAMES =====');
  {
    const { ctx, p, errs } = await admin(b);
    const KEY_RE = /^media\/[a-z0-9][a-z0-9-]{0,80}\.(png|jpe?g|webp|gif)$/;
    const names = await p.evaluate(() => [
      '../../../etc/passwd.png',
      '..%2f..%2fsecret.png',
      '<script>alert(1)</script>.png',
      'a'.repeat(150) + '.png',
      '....//....//x.png',
      'Holiday Photo (2).PNG',
      '.png',
      'my photo; rm -rf /.jpg',
      'C:\\Windows\\System32\\evil.gif'
    ].map(n => {
      const m = /\.([A-Za-z0-9]+)$/.exec(n);
      const ext = m ? m[1].toLowerCase() : 'png';
      return { n, key: window.CMSMedia.objectKey(n, ext) };
    }));

    for (const { n, key } of names) {
      const ext = key.split('.').pop();
      check(`"${n.slice(0, 32)}" becomes a safe object name`,
        KEY_RE.test(key) && key.indexOf('..') === -1 && key.indexOf('//') === -1 &&
        key.indexOf('\\') === -1 && key.indexOf('<') === -1 && !!ext, key);
    }

    const uniq = await p.evaluate(() => {
      const s = new Set();
      for (let i = 0; i < 400; i++) s.add(window.CMSMedia.objectKey('same-name.png', 'png'));
      return s.size;
    });
    check('two uploads of the same file name never collide', uniq === 400, uniq);
    check('no console errors generating names', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     4. WHAT COUNTS AS AN UPLOADED IMAGE REFERENCE
     ------------------------------------------------------------------
     CMS.sections.mediaPath is the only door. pbAsset (repository assets)
     is a separate door and must not have been widened.
     ================================================================== */
  console.log('\n===== mediaPath() AND assetPath() STAY SEPARATE =====');
  {
    const { ctx, p, errs } = await admin(b);
    const r = await p.evaluate(base => {
      const m = window.CMS.sections.mediaPath, a = window.CMS.sections.assetPath;
      return {
        good:        m(base + 'media/holiday-ab12cd.png'),
        jpeg:        m(base + 'media/x-ab12cd.jpeg'),
        externalHost: m('https://evil.example.com/storage/v1/object/public/cms-media/media/x-ab12cd.png'),
        otherBucket: m(base.replace('/cms-media/', '/other/') + 'media/x-ab12cd.png'),
        outsidePrefix: m(base + 'other/x-ab12cd.png'),
        traversal:   m(base + 'media/../../x-ab12cd.png'),
        doubleSlash: m(base + 'media//x-ab12cd.png'),
        query:       m(base + 'media/x-ab12cd.png?v=1'),
        hash:        m(base + 'media/x-ab12cd.png#a'),
        svg:         m(base + 'media/x-ab12cd.svg'),
        upper:       m(base + 'media/X-AB12CD.png'),
        js:          m('javascript:alert(1)'),
        data:        m('data:image/png;base64,iVBOR'),
        proto:       m('//evil.example.com/media/x-ab12cd.png'),
        /* The bucket URL appearing SOMEWHERE in the string is not the same
           as the string starting with it. */
        prefixLater: m('https://evil.example.com/?u=' + base + 'media/x-ab12cd.png'),
        prefixAfterPath: m('https://evil.example.com/a/' + base + 'media/x-ab12cd.png'),
        /* assetPath must be exactly as strict as it always was */
        assetOk:     a('assets/images/logo.png'),
        assetRejectsMedia: a(base + 'media/holiday-ab12cd.png'),
        assetRejectsAbs:   a('https://evil.example.com/x.png'),
        assetRejectsTrav:  a('assets/images/../../x.png'),
        /* imageRef is the union and nothing more */
        refAsset:    window.CMS.sections.imageRef('assets/images/logo.png'),
        refMedia:    window.CMS.sections.imageRef(base + 'media/holiday-ab12cd.png'),
        refEvil:     window.CMS.sections.imageRef('https://evil.example.com/x.png')
      };
    }, STORAGE);

    check('a real uploaded URL is accepted', r.good === STORAGE + 'media/holiday-ab12cd.png', r.good);
    check('.jpeg is accepted', !!r.jpeg, r.jpeg);
    check('another host is refused', r.externalHost === '', r.externalHost);
    check('another bucket is refused', r.otherBucket === '', r.otherBucket);
    check('a key outside media/ is refused', r.outsidePrefix === '', r.outsidePrefix);
    check('a traversal segment is refused', r.traversal === '', r.traversal);
    check('a double slash is refused', r.doubleSlash === '', r.doubleSlash);
    check('a query string is refused', r.query === '', r.query);
    check('a fragment is refused', r.hash === '', r.hash);
    check('.svg is refused even from our own bucket', r.svg === '', r.svg);
    check('an upper-case key is refused (this code never writes one)', r.upper === '', r.upper);
    check('javascript: is refused', r.js === '', r.js);
    check('a data: URL is refused', r.data === '', r.data);
    check('a protocol-relative host is refused', r.proto === '', r.proto);
    check('our bucket URL buried in someone else\u2019s query string is refused', r.prefixLater === '', r.prefixLater);
    check('our bucket URL buried in someone else\u2019s path is refused', r.prefixAfterPath === '', r.prefixAfterPath);

    check('assetPath still accepts a repository asset', r.assetOk === 'assets/images/logo.png', r.assetOk);
    check('assetPath refuses an uploaded URL', r.assetRejectsMedia === '', r.assetRejectsMedia);
    check('assetPath refuses an absolute URL', r.assetRejectsAbs === '', r.assetRejectsAbs);
    check('assetPath refuses traversal', r.assetRejectsTrav === '', r.assetRejectsTrav);
    check('assetPath refuses a doubled slash in a repository path',
      (await p.evaluate(() => window.CMS.sections.assetPath('assets/images//logo.png'))) === '');

    check('imageRef accepts a repository asset', !!r.refAsset);
    check('imageRef accepts an uploaded image', !!r.refMedia);
    check('imageRef accepts nothing else', r.refEvil === '', r.refEvil);

    /* the library rebuilds every entry rather than trusting the record */
    const listed = await p.evaluate(base => window.CMS.sections.mediaList({ items: [
      { url: base + 'media/ok-aaaaaa.png', name: 'Fine', w: 10, h: 20, bytes: 100, uploadedAt: '2026-01-01T00:00:00Z' },
      { url: 'https://evil.example.com/x.png', name: 'Evil' },
      { url: base + 'media/ok-aaaaaa.png', name: 'Duplicate' },
      { url: base + 'media/bad-aaaaaa.svg', name: 'Svg' },
      null, 'string', { url: base + 'media/huge-aaaaaa.png', w: -5, h: 1e9, bytes: -1 }
    ] }), STORAGE);
    check('a tampered media record is rebuilt, not trusted',
      listed.length === 2 && listed.every(x => x.url.indexOf(STORAGE) === 0), listed);
    check('impossible dimensions are dropped rather than shown',
      listed.filter(x => x.name === 'huge-aaaaaa.png' || /huge/.test(x.url)).every(x => x.w === undefined), listed);
    /* The UI generates the object name, but the transport re-checks it, so
       a bug up there still cannot put an object anywhere else in the
       bucket. Called directly, below the UI, for exactly that reason. */
    const direct = await p.evaluate(async () => {
      const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4E, 0x47])], { type: 'image/png' });
      const out = {};
      for (const key of ['media/../../evil.png', '../evil.png', 'evil.png',
                         'media/evil.php', 'media/sub/evil.png', 'media/EVIL.png']) {
        try { await window.CMS.remote.uploadMedia(key, blob, 'image/png'); out[key] = 'ALLOWED'; }
        catch (e) { out[key] = e.message; }
      }
      return out;
    });
    check('uploadMedia refuses every object name this CMS would never write',
      Object.keys(direct).every(k => /Refusing to write/.test(direct[k])), direct);
    const directDel = await p.evaluate(async () => {
      try { await window.CMS.remote.removeMedia('media/../../../important.png'); return 'ALLOWED'; }
      catch (e) { return e.message; }
    });
    check('removeMedia refuses the same', /Refusing to delete/.test(directDel), directDel);

    check('no console errors in the validator pass', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     5. THE WHOLE JOURNEY
     ================================================================== */
  console.log('\n===== UPLOAD, RELOAD, USE, PUBLISH, RENDER =====');
  {
    const { ctx, p, errs, uploaded, rowOf } = await admin(b);
    await p.click('.adm-nav-item[data-panel="media"]'); await p.waitForTimeout(300);
    check('the Media Library panel opens', await p.isVisible('#panel-media'));
    check('it starts empty and says so', /Nothing uploaded yet/i.test(await p.$eval('#mediaGrid', e => e.textContent)));

    const tmp = require('path').join(require('os').tmpdir(), 'holiday photo (2).PNG');
    require('fs').writeFileSync(tmp, Buffer.from(B64.png, 'base64'));
    await p.setInputFiles('#mediaFile', tmp);
    await p.waitForTimeout(1200);

    check('one object was written to the bucket', uploaded.length === 1, uploaded.length);
    if (uploaded.length) {
      check('  with the admin session token, never the anon key',
        uploaded[0].auth === 'Bearer stub', uploaded[0].auth);
      check('  with our validated content type', uploaded[0].type === 'image/png', uploaded[0].type);
      check('  and without permission to overwrite anything', uploaded[0].upsert === 'false', uploaded[0].upsert);
      check('  under a generated name, not the one on the user\u2019s disk',
        /\/cms-media\/media\/holiday-photo-2-[a-z0-9]+\.png$/.test(uploaded[0].url), uploaded[0].url);
    }
    check('the library now shows one image', (await p.$$('#mediaGrid .mediacard')).length === 1);
    check('with its real dimensions and file size',
      /1×1|1\u00d71/.test(await p.$eval('#mediaGrid .mediacard-meta', e => e.textContent)),
      await p.$eval('#mediaGrid .mediacard-meta', e => e.textContent));
    check('and its original file name, for the person who uploaded it',
      /holiday photo \(2\)\.PNG/i.test(await p.$eval('#mediaGrid .mediacard-name', e => e.textContent)));
    check('the status line reports success', /Uploaded 1 image/i.test(await p.$eval('#mediaStatus', e => e.textContent)));

    const row = rowOf();
    check('the library was published, so other devices will see it',
      !!row && !!row.data.media && row.data.media.items.length === 1, row && row.data.media);

    /* alt text */
    await p.fill('#mediaGrid .mediacard-alt input', 'A beach at sunset');
    await p.waitForTimeout(200);
    check('alt text is stored against the image',
      (await p.evaluate(() => window.CMS.data().media.items[0].alt)) === 'A beach at sunset');

    /* reload */
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    /* The admin session lives in sessionStorage, so a reload in the same tab
       is still signed in -- which is itself worth knowing. */
    if (await p.isVisible('#authGate')) {
      await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
      await p.waitForTimeout(500);
    }
    await p.evaluate(() => { window.CMS_MEDIA.enabled = true; });
    await p.click('.adm-nav-item[data-panel="media"]'); await p.waitForTimeout(300);
    check('the image is still there after a reload', (await p.$$('#mediaGrid .mediacard')).length === 1);

    /* use it on a page and publish */
    const url = await p.evaluate(() => window.CMS.data().media.items[0].url);
    await p.evaluate(u => {
      window.CMS.sections.saveDraft('about', [{
        id: 'sX', type: 'image', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'eX', type: 'image', content: { src: u, alt: 'A beach at sunset' }, style: {}, responsive: {} }]
      }]);
      window.CMS.sections.publish('about');
      return window.CMS.remote.publish();
    }, url);
    await p.waitForTimeout(600);

    const pub = await ctx.newPage();
    await pub.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    await pub.waitForTimeout(400);
    const rendered = await pub.$eval('[data-cms-sections="about"] img', e => ({ src: e.getAttribute('src'), alt: e.getAttribute('alt') })).catch(() => null);
    check('the uploaded image renders on the public page', !!rendered && rendered.src === url, rendered);
    check('  with the alt text the author gave it', rendered && rendered.alt === 'A beach at sunset', rendered);
    await pub.close();

    check('no console errors across the whole journey', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     5b. THE PAGE BUILDER'S IMAGE PICKER
     ================================================================== */
  console.log('\n===== THE PICKER KEEPS THE TWO KINDS APART =====');
  {
    const { ctx, p, errs, uploaded } = await admin(b);
    await p.click('.adm-nav-item[data-panel="media"]'); await p.waitForTimeout(300);
    const tmp = require('path').join(require('os').tmpdir(), 'picker-test.png');
    require('fs').writeFileSync(tmp, Buffer.from(B64.png, 'base64'));
    await p.setInputFiles('#mediaFile', tmp);
    await p.waitForTimeout(1200);
    check('an image is in the library to pick', uploaded.length === 1, uploaded.length);

    /* Open the picker through the UI, from the SEO share-image field --
       the one place outside the builder that uses it. */
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelectorAll('#seoTabs .pagetab')[3].click());
    await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('[data-act="og-pick"]').click());
    await p.waitForTimeout(600);
    check('the picker opens', await p.isVisible('#pbAssetModal'));
    const tabs = await p.$$eval('#pbAssetTabs .pagetab', e => e.map(x => x.textContent.trim()));
    check('it has both kinds as separate tabs', tabs.length === 2 &&
      /Site images/i.test(tabs[0]) && /Uploaded/i.test(tabs[1]), tabs);
    check('it opens on the repository images', await p.$eval('#pbAssetTabs .pagetab.active', e => e.textContent.trim()) === 'Site images');
    check('and the upload button is hidden on that tab', await p.isHidden('#pbAssetUpload'));

    await p.click('#pbAssetTabs [data-assettab="media"]'); await p.waitForTimeout(400);
    check('the uploaded tab lists the uploaded image', (await p.$$('#pbAssetGrid .pb-asset')).length === 1);
    check('and offers an upload button there', await p.isVisible('#pbAssetUpload'));

    await p.click('#pbAssetGrid .pb-asset'); await p.waitForTimeout(200);
    await p.click('#pbAssetUse'); await p.waitForTimeout(300);
    const field = await p.evaluate(() =>
      document.querySelector('[data-act="og-pick"]').closest('.f').querySelector('input').value);
    check('choosing one stores the uploaded URL, not a repository path',
      /\/storage\/v1\/object\/public\/cms-media\/media\/.+\.png$/.test(field), field);
    check('and a share image can now be a real crawlable URL rather than a data URL',
      field.indexOf('data:') !== 0 && /^https:\/\//.test(field), field);
    check('no console errors using the picker', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     6. FAILURE IS NEVER SILENT
     ================================================================== */
  console.log('\n===== A FAILED UPLOAD SAYS SO =====');
  {
    const { ctx, p, errs } = await admin(b, { storageFails: true });
    await p.click('.adm-nav-item[data-panel="media"]'); await p.waitForTimeout(300);
    const tmp = require('path').join(require('os').tmpdir(), 'rejected.png');
    require('fs').writeFileSync(tmp, Buffer.from(B64.png, 'base64'));
    await p.setInputFiles('#mediaFile', tmp);
    await p.waitForTimeout(1200);
    const status = await p.$eval('#mediaStatus', e => e.textContent);
    check('a rejected upload is reported, not swallowed', /refused|not allowed/i.test(status), status);
    check('and nothing was added to the library', (await p.$$('#mediaGrid .mediacard')).length === 0);
    check('the record holds no row for a file that was never stored',
      (await p.evaluate(() => (window.CMS.data().media.items || []).length)) === 0);
    check('no console errors on a failed upload', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     7. WHEN UPLOADS ARE NOT CONFIGURED
     ================================================================== */
  console.log('\n===== HONEST DEGRADATION =====');
  {
    const { ctx, p, errs } = await admin(b, { mediaOn: false });
    await p.click('.adm-nav-item[data-panel="media"]'); await p.waitForTimeout(300);
    check('the panel says uploads are not switched on', await p.isVisible('#mediaOffHint'));
    check('and the Upload button is disabled rather than failing later',
      await p.getAttribute('#mediaUploadBtn', 'disabled') !== null);
    check('mediaPath refuses everything while uploads are off',
      (await p.evaluate(u => window.CMS.sections.mediaPath(u), STORAGE + 'media/x-aaaaaa.png')) === '');
    check('repository assets are completely unaffected',
      (await p.evaluate(() => window.CMS.sections.assetPath('assets/images/logo.png'))) === 'assets/images/logo.png');
    check('no console errors with uploads off', errs.length === 0, errs);
    await ctx.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
