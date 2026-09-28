/* BUILD-SOURCE SYNCHRONIZATION GUARD.

   TWO QUESTIONS, DELIBERATELY NOT CONFLATED, and this file tests both
   separately because conflating them is the mistake the guard exists to avoid:

     INTEGRITY  is the committed brands/<id>/brand.js the artifact the admin
                exported, for THIS brand?
                Checked offline, in every build. Sections A-F.

     FRESHNESS  is that export still what the CMS has published?
                Checked only by tools/check-published.js, which asks Supabase.
                Sections G-H.

   A clean integrity check does NOT mean the build source is current. A CMS
   publish made after the export leaves no trace in the repository, so nothing
   offline can detect it. Section H asserts that distinction rather than
   assuming it: the same brand.js passes the build's guard and FAILS the
   freshness check when the row has moved on.

   NO NETWORK IN THE BUILD. Section I proves it, by running a build with the
   Supabase reader replaced by a function that throws. A build that needed the
   network would stop being deterministic, which is the whole reason the
   freshness check is a separate command.

   NOTHING HERE REACHES A REAL SERVER. The freshness check is driven with
   captured row payloads through its --row flag. */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execFileSync: run } = require('child_process');

const ROOT = path.join(__dirname, '..');
const pbbake = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* ---------------- fixtures ---------------- */

const A = { head: 'Alpha Sync Heading', para: 'alpha-sync-paragraph' };
const B = { head: 'Beta Sync Heading', para: 'beta-sync-paragraph' };

function block(m) {
  return { schemaVersion: 2, status: 'published', updatedAt: '2026-09-28',
    sections: [{ id: 's1', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true },
      /* A real style, so the generated <style id="cmsBuilder"> is something this
         file can assert the presence of rather than assuming. */
      style: { padding: '40' }, responsive: {},
      elements: [
        { id: 'e1', type: 'heading', content: { text: m.head, level: 'h2' }, style: {}, responsive: {} },
        { id: 'e2', type: 'text', content: { text: m.para }, style: {}, responsive: {} }
      ] }] };
}

/* A brand directory, written to a temp tree.

   provenance:
     undefined  omit the declaration entirely (the pre-guard state)
     'correct'  record the fingerprint of what brand.js actually publishes
     'stale'    record a fingerprint for DIFFERENT sections, which is what a
                hand-edit or a half-applied export looks like
     {siteId}   record a different brand's row id */
function writeBrand(dir, id, opts) {
  opts = opts || {};
  const bdir = path.join(dir, id);
  fs.mkdirSync(bdir, { recursive: true });
  const siteId = opts.siteId || ('row-' + id.replace(/\W/g, ''));

  fs.writeFileSync(path.join(bdir, 'brand.json'), JSON.stringify({
    id: id, name: opts.name || id, domain: id, siteId: siteId, bucket: 'b-' + id.replace(/\W/g, '')
  }, null, 2) + '\n');

  const pages = { about: {
    title: 'About ' + (opts.name || id), metaDescription: 'Desc ' + id,
    heading: 'About ' + (opts.name || id), lead: 'Lead ' + id,
    body: '<p>Fallback for ' + id + '.</p>', updatedAt: '2026-01-01'
  } };
  if (opts.builder) pages.about.builder = opts.builder;

  let out = 'window.CMS_BRAND = ' + JSON.stringify({
    branding: { siteName: opts.name || id },
    seo: { baseUrl: 'https://' + id, siteName: opts.name || id },
    pages: pages
  }, null, 2) + ';\n';

  if (opts.provenance) {
    const builder = {};
    if (opts.builder) {
      /* The fingerprint comes from the engine's own function -- the same one the
         admin records with and the build verifies with. A test that computed its
         own would be testing its own arithmetic. */
      const recordFor = opts.provenance === 'stale' ? block({ head: 'SOMETHING ELSE', para: 'other' })
                                                    : opts.builder;
      builder.about = pbbake.fingerprint(ROOT, recordFor);
    }
    out += '\nwindow.CMS_BRAND_PROVENANCE = ' + JSON.stringify({
      version: 1,
      brand: { siteId: opts.provenanceSiteId || siteId, host: id },
      publishedRowUpdatedAt: opts.rowUpdatedAt || '2026-09-28T10:00:00+00:00',
      exportedAt: '2026-09-28T11:00:00.000Z',
      builder: builder
    }, null, 2) + ';\n';
  }
  fs.writeFileSync(path.join(bdir, 'brand.js'), out);

  fs.writeFileSync(path.join(bdir, 'seo-config.json'), JSON.stringify({
    seo: { baseUrl: 'https://' + id, siteName: opts.name || id },
    pages: { about: { url: 'about.html', inSitemap: true,
                      robots: { index: true, follow: true }, updatedAt: '2026-01-01' } }
  }, null, 2) + '\n');
  return bdir;
}

/* Build, returning { ok, out } rather than throwing, because a refused build is
   the expected outcome of half these cases. */
function build(brandsDir, id, outDir, extra) {
  const args = [path.join(ROOT, 'tools', 'build-site.js'), id,
                '--brands', brandsDir, '--out', outDir].concat(extra || []);
  try {
    return { ok: true, out: run(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

function checkPublished(brandsDir, id, rowFile) {
  const args = [path.join(ROOT, 'tools', 'check-published.js'), id, '--brands', brandsDir];
  if (rowFile) args.push('--row', rowFile);
  try {
    return { code: 0, out: run(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

(function () {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pbsync-'));
  const brands = path.join(tmp, 'brands');
  const out = path.join(tmp, 'out');

  /* ================================================================
     A. SYNCHRONIZED — provenance present, fingerprints match
     ================================================================ */
  console.log('\n===== A. Synchronized build source =====');
  {
    writeBrand(brands, 'sync-ok.test', { name: 'SYNCOK', builder: block(A), provenance: 'correct' });
    const r = build(brands, 'sync-ok.test', out);
    check('the build succeeds', r.ok === true, r.out.slice(-400));
    check('and says the source was verified',
      /Source\s*:\s*verified against the recorded export/.test(r.out),
      (r.out.match(/Source.*/) || [''])[0]);
    check('  reporting when it was exported',
      /exported 2026-09-28T11:00:00\.000Z/.test(r.out), (r.out.match(/Source.*/) || [''])[0]);
    check('  and which row it claimed',
      /row 2026-09-28T10:00:00\+00:00/.test(r.out), (r.out.match(/Source.*/) || [''])[0]);
    check('  and says plainly that this is integrity, not freshness',
      /integrity only/.test(r.out) && /check-published/.test(r.out),
      (r.out.match(/Source.*/) || [''])[0]);
    check('no provenance warning is emitted',
      !/::warning::[^\n]*provenance not recorded/i.test(r.out),
      (r.out.match(/::warning::.*/) || [''])[0]);
    const html = fs.readFileSync(path.join(out, 'sync-ok.test', 'about.html'), 'utf8');
    check('the builder content is baked normally', html.includes('>' + A.head + '<'), true);
    check('  and the paragraph too', html.includes('>' + A.para + '<'), true);
  }

  /* ================================================================
     B. STALE / MISMATCHED — the build must refuse
     ================================================================ */
  console.log('\n===== B. Mismatched build source is refused =====');
  {
    writeBrand(brands, 'sync-stale.test', { name: 'STALE', builder: block(A), provenance: 'stale' });
    const r = build(brands, 'sync-stale.test', out);
    check('the build FAILS', r.ok === false, r.out.slice(-300));
    check('the error names the brand', /sync-stale\.test/.test(r.out));
    check('the error names the page', /page "about"/.test(r.out), (r.out.match(/page ".*/) || [''])[0]);
    check('the error says what differs',
      /do not match the export/.test(r.out), (r.out.match(/page "about".*/) || [''])[0]);
    check('the error shows both fingerprints',
      /recorded fingerprint [0-9a-f]+:\d+/.test(r.out) && /actual fingerprint\s+[0-9a-f]+:\d+/.test(r.out),
      (r.out.match(/recorded fingerprint.*/) || [''])[0]);
    check('the error says what to do about it',
      /re-export it from \/admin/i.test(r.out));
    check('the error does NOT claim to detect a later publish',
      /cannot tell you whether that export is still current/.test(r.out));
    check('and it points at the freshness check',
      /node tools\/check-published\.js sync-stale\.test/.test(r.out));
    check('NO stale HTML was written',
      !fs.existsSync(path.join(out, 'sync-stale.test', 'about.html')) ||
      !fs.readFileSync(path.join(out, 'sync-stale.test', 'about.html'), 'utf8').includes(A.head),
      'about.html exists with baked content');
  }

  /* ================================================================
     C. WRONG BRAND — a foreign brand.js is refused
     ================================================================ */
  console.log('\n===== C. Another brand\'s export is refused =====');
  {
    writeBrand(brands, 'sync-foreign.test', { name: 'FOREIGN', builder: block(A),
      provenance: 'correct', provenanceSiteId: 'row-someone-else' });
    const r = build(brands, 'sync-foreign.test', out);
    check('the build FAILS', r.ok === false, r.out.slice(-300));
    check('the error names both rows',
      /row "row-someone-else"/.test(r.out) && /row "row-syncforeigntest"/.test(r.out),
      (r.out.match(/brand: .*/) || [''])[0]);
    check('and identifies it as a brand mismatch', /- brand:/.test(r.out));
  }

  /* ================================================================
     D. NO BUILDER CONTENT — nothing to verify, nothing to warn about
     ================================================================ */
  console.log('\n===== D. A brand that publishes no builder content =====');
  {
    writeBrand(brands, 'sync-plain.test', { name: 'PLAIN' });
    const r = build(brands, 'sync-plain.test', out);
    check('the build succeeds', r.ok === true, r.out.slice(-300));
    check('no provenance WARNING: there is nothing whose integrity is in question',
      !/::warning::[^\n]*provenance not recorded/i.test(r.out),
      (r.out.match(/::warning::.*/) || [''])[0]);
    check('  and the status line says so plainly rather than "not verified"',
      /Source\s*:\s*no published builder content to verify/.test(r.out),
      (r.out.match(/Source.*/) || [''])[0]);
    check('the build says nothing was baked',
      /Builder\s*:\s*\(no published content/.test(r.out), (r.out.match(/Builder.*/) || [''])[0]);
    const html = fs.readFileSync(path.join(out, 'sync-plain.test', 'about.html'), 'utf8');
    check('the mount stays empty', /<div data-cms-sections="about"><\/div>/.test(html));
    check('and the page still ships its fallback body',
      /<div class="info-body"[^>]*>[\s\S]{200,}?<\/div>/.test(html));

    /* A brand with published content but no provenance at all -- covered in F --
       is the case that warns. This one must not. */
  }

  /* ================================================================
     E. MULTI-BRAND — each brand against its own provenance only
     ================================================================ */
  console.log('\n===== E. Multi-brand: each verified against itself =====');
  {
    writeBrand(brands, 'sync-a.test', { name: 'SYNCA', builder: block(A), provenance: 'correct' });
    writeBrand(brands, 'sync-b.test', { name: 'SYNCB', builder: block(B), provenance: 'correct' });
    const ra = build(brands, 'sync-a.test', out);
    const rb = build(brands, 'sync-b.test', out);
    check('brand A builds', ra.ok === true, ra.out.slice(-300));
    check('brand B builds', rb.ok === true, rb.out.slice(-300));
    check('A was verified', /Source\s*:\s*verified/.test(ra.out));
    check('B was verified', /Source\s*:\s*verified/.test(rb.out));

    const ha = fs.readFileSync(path.join(out, 'sync-a.test', 'about.html'), 'utf8');
    const hb = fs.readFileSync(path.join(out, 'sync-b.test', 'about.html'), 'utf8');
    check('A\'s HTML has A\'s content and none of B\'s',
      ha.includes(A.head) && ha.includes(A.para) && !ha.includes(B.head) && !ha.includes(B.para));
    check('B\'s HTML has B\'s content and none of A\'s',
      hb.includes(B.head) && hb.includes(B.para) && !hb.includes(A.head) && !hb.includes(A.para));

    /* The fingerprints themselves must differ, or the check above could pass
       for the wrong reason. */
    check('their fingerprints differ',
      pbbake.fingerprint(ROOT, block(A)) !== pbbake.fingerprint(ROOT, block(B)),
      { a: pbbake.fingerprint(ROOT, block(A)), b: pbbake.fingerprint(ROOT, block(B)) });

    /* Now physically swap B's brand.js into A's directory: self-consistent
       fingerprints, wrong brand. Only the siteId check catches this. */
    const aDir = path.join(brands, 'sync-a.test');
    const keep = fs.readFileSync(path.join(aDir, 'brand.js'), 'utf8');
    fs.writeFileSync(path.join(aDir, 'brand.js'),
      fs.readFileSync(path.join(brands, 'sync-b.test', 'brand.js'), 'utf8'));
    const swapped = build(brands, 'sync-a.test', out);
    check('a foreign brand.js is REFUSED even though its own fingerprints match',
      swapped.ok === false, swapped.out.slice(-300));
    check('  and the error names the row it was exported for',
      /row "row-syncbtest"/.test(swapped.out), (swapped.out.match(/brand: .*/) || [''])[0]);
    fs.writeFileSync(path.join(aDir, 'brand.js'), keep);
    check('  restoring it builds again', build(brands, 'sync-a.test', out).ok === true);
  }

  /* ================================================================
     F. MISSING PROVENANCE — warn, never fail
     ================================================================ */
  console.log('\n===== F. Missing provenance warns and proceeds =====');
  {
    writeBrand(brands, 'sync-noprov.test', { name: 'NOPROV', builder: block(A) });
    const r = build(brands, 'sync-noprov.test', out);
    check('the build SUCCEEDS', r.ok === true, r.out.slice(-400));
    check('the exact warning is emitted',
      /Builder provenance not recorded; build integrity cannot be verified\./.test(r.out),
      (r.out.match(/::warning::.*provenance.*/) || [''])[0]);
    check('  and it says the build continued anyway', /Building anyway/.test(r.out));
    check('  and it says how to record it',
      /Download brand defaults/.test(r.out));
    check('the status line reports it too',
      /Source\s*:\s*provenance not recorded \(integrity not verified\)/.test(r.out),
      (r.out.match(/Source.*/) || [''])[0]);
    const html = fs.readFileSync(path.join(out, 'sync-noprov.test', 'about.html'), 'utf8');
    check('the builder content is still baked', html.includes('>' + A.head + '<'), true);

    /* The real brands in this repository are in exactly this state, and must
       keep building. */
    const jsk = build(path.join(ROOT, 'brands'), 'jsk-1.com', path.join(tmp, 'real'));
    check('jsk-1.com still builds', jsk.ok === true, jsk.out.slice(-300));
    check('  with no provenance warning, because it publishes no builder content',
      !/::warning::[^\n]*provenance not recorded/i.test(jsk.out),
      (jsk.out.match(/::warning::.*/) || [''])[0]);
    const pz = build(path.join(ROOT, 'brands'), 'playzone9.app', path.join(tmp, 'real'),
                     ['--env', 'staging']);
    check('playzone9.app staging still builds', pz.ok === true, pz.out.slice(-300));
  }

  /* ================================================================
     G. FRESHNESS CHECK — the only part that asks the server
     ================================================================ */
  console.log('\n===== G. check-published.js =====');
  {
    const rowSame = path.join(tmp, 'row-same.json');
    fs.writeFileSync(rowSame, JSON.stringify({
      data: { pages: { about: { builder: block(A) } } },
      updated_at: '2026-09-28T10:00:00+00:00'
    }));
    const same = checkPublished(brands, 'sync-ok.test', rowSame);
    check('it exits 0 when the server matches the build source', same.code === 0, same.out.slice(-300));
    check('  and says so', /IN SYNC/.test(same.out), (same.out.match(/IN SYNC.*/) || [''])[0]);
    check('  naming the brand and the row',
      /Brand\s*:\s*sync-ok\.test/.test(same.out) && /Row\s*:\s*row-syncoktest/.test(same.out));
    check('  and reporting the provenance it read',
      /Provenance: recorded/.test(same.out));
    check('  and that the row timestamp is the same publish',
      /same publish/.test(same.out), (same.out.match(/Row updated_at.*/) || [''])[0]);

    /* The server has moved on: a publish after the export. */
    const rowNew = path.join(tmp, 'row-new.json');
    fs.writeFileSync(rowNew, JSON.stringify({
      data: { pages: { about: { builder: block(B) } } },
      updated_at: '2026-09-29T12:00:00+00:00'
    }));
    const stale = checkPublished(brands, 'sync-ok.test', rowNew);
    check('it exits NON-ZERO when the server has moved on', stale.code === 1, stale.code);
    check('  saying the build source is stale', /STALE BUILD SOURCE/.test(stale.out));
    check('  naming the brand', /brand "sync-ok\.test"/.test(stale.out));
    check('  naming the row', /row row-syncoktest/.test(stale.out));
    check('  naming the page', /page "about"/.test(stale.out));
    check('  showing both fingerprints',
      new RegExp('committed ' + pbbake.fingerprint(ROOT, block(A)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .test(stale.out) &&
      new RegExp('server ' + pbbake.fingerprint(ROOT, block(B)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .test(stale.out),
      (stale.out.match(/page "about": .*/) || [''])[0]);
    check('  and that the row has been written since the export',
      /the row has been written since this export/.test(stale.out),
      (stale.out.match(/Row updated_at.*/) || [''])[0]);
    check('  and what to do about it', /Re-export the brand/.test(stale.out));

    /* Published in the CMS, absent from the build source -- the case the
       offline guard structurally cannot see. */
    const rowExtra = path.join(tmp, 'row-extra.json');
    fs.writeFileSync(rowExtra, JSON.stringify({
      data: { pages: { about: { builder: block(A) },
                       contact: { builder: block(B) } } },
      updated_at: '2026-09-29T12:00:00+00:00'
    }));
    const extra = checkPublished(brands, 'sync-ok.test', rowExtra);
    check('a page published only on the server is reported', extra.code === 1, extra.code);
    check('  and named as published-but-not-in-the-build-source',
      /published in the CMS but not in the build source/.test(extra.out),
      (extra.out.match(/page "contact".*/) || [''])[0]);

    /* Nothing published either side. */
    const rowEmpty = path.join(tmp, 'row-empty.json');
    fs.writeFileSync(rowEmpty, JSON.stringify({ data: { pages: {} }, updated_at: '2026-09-28T10:00:00+00:00' }));
    const none = checkPublished(brands, 'sync-plain.test', rowEmpty);
    check('with no builder content anywhere it exits 0', none.code === 0, none.out.slice(-300));
    check('  and says there is nothing to go stale',
      /Nothing to bake, nothing to go stale/.test(none.out), none.out.slice(-200));

    /* Missing provenance is reported, not guessed at. */
    const noprov = checkPublished(brands, 'sync-noprov.test', rowSame);
    check('a source with no provenance is still comparable', noprov.code === 0, noprov.out.slice(-300));
    check('  and the missing provenance is stated plainly',
      /Provenance: NOT RECORDED/.test(noprov.out), (noprov.out.match(/Provenance.*/) || [''])[0]);

    /* It must not write anything. */
    const before = fs.readFileSync(path.join(brands, 'sync-ok.test', 'brand.js'), 'utf8');
    checkPublished(brands, 'sync-ok.test', rowNew);
    check('it never modifies the repository',
      fs.readFileSync(path.join(brands, 'sync-ok.test', 'brand.js'), 'utf8') === before);
    check('and it contains no Supabase write path',
      !/method:\s*'POST'|method:\s*"POST"/.test(
        fs.readFileSync(path.join(ROOT, 'tools', 'check-published.js'), 'utf8')));
  }

  /* ================================================================
     H. INTEGRITY IS NOT FRESHNESS
     ================================================================ */
  console.log('\n===== H. The two checks answer different questions =====');
  {
    /* One brand.js, unchanged. The build's guard passes it; the freshness check
       fails it because the row moved. That is the distinction, asserted. */
    const r = build(brands, 'sync-ok.test', out);
    check('the OFFLINE guard passes this build source', r.ok === true, r.out.slice(-200));
    check('  reporting it verified', /Source\s*:\s*verified/.test(r.out));
    const stale = checkPublished(brands, 'sync-ok.test', path.join(tmp, 'row-new.json'));
    check('the NETWORKED check fails the same build source', stale.code === 1, stale.code);
    check('so a clean build never implies freshness',
      r.ok === true && stale.code === 1);
    check('and the build says so in words',
      /integrity only/.test(r.out) && /freshness/.test(r.out),
      (r.out.match(/Source.*/) || [''])[0]);
  }

  /* ================================================================
     I. THE PAGE BUILDER BAKE IS OFFLINE
     ================================================================
     STATED PRECISELY, because the loose version would be false.

     The Page Builder bake -- brand.js -> sections -> static HTML -- makes NO
     network call. That is what this section proves, and it is what keeps the
     build deterministic.

     It is NOT true that the whole build never touches the network: the SEO
     step, tools/build-seo-files.js, has always tried to read the live record
     for sitemap.xml and falls back to the brand's committed seo-config.json
     when it cannot (it warns and does so on every run in CI). That predates
     this work, is outside its scope, and is deliberately unchanged. What the
     guard adds introduces no new request.

     So the reader is replaced with one that FAILS rather than one that throws:
     that is what "no network" looks like to a caller that tolerates it, and it
     lets this section assert the bake is unaffected while leaving the SEO
     step's own behaviour intact.
     ================================================================ */
  console.log('\n===== I. The Page Builder bake is offline =====');
  {
    const readerFile = path.join(ROOT, 'tools', 'lib', 'cmsrow.js');
    const real = fs.readFileSync(readerFile, 'utf8');
    /* Config that reads as "not configured", and a fetch that reports no row --
       exactly what the reader returns with no network. Nothing throws, so the
       SEO step takes its committed fallback as it always does. */
    const noNetwork =
      "'use strict';\n" +
      "let CALLS = 0;\n" +
      "module.exports = {\n" +
      "  readConfig: function () { CALLS++; return {}; },\n" +
      "  fetchRow: function () { CALLS++; return Promise.resolve({ data: null, why: 'no network in this test' }); },\n" +
      "  calls: function () { return CALLS; }\n" +
      "};\n";
    fs.writeFileSync(readerFile, noNetwork);
    let r;
    try {
      r = build(brands, 'sync-ok.test', path.join(tmp, 'nonet'));
    } finally {
      fs.writeFileSync(readerFile, real);
    }
    check('the build succeeds with no network available', r.ok === true, r.out.slice(-600));
    check('the build source was still verified offline',
      /Source\s*:\s*verified against the recorded export/.test(r.out),
      (r.out.match(/Source.*/) || [''])[0]);
    check('and the published content was still baked',
      /Builder\s*:\s*about \(1 section\)/.test(r.out), (r.out.match(/Builder.*/) || [''])[0]);
    const html = fs.readFileSync(path.join(tmp, 'nonet', 'sync-ok.test', 'about.html'), 'utf8');
    check('  the heading is in the HTML', html.includes('>' + A.head + '<'));
    check('  the paragraph is in the HTML', html.includes('>' + A.para + '<'));
    check('the reader was restored', fs.readFileSync(readerFile, 'utf8') === real);

    /* Structural, and the strongest statement available: nothing on the bake
       path can reach the network, because none of it requires anything that
       could. */
    const bakeSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'pbbake.js'), 'utf8');
    const kitSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'brandkit.js'), 'utf8');
    const domSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'minidom.js'), 'utf8');
    const siteSrc = fs.readFileSync(path.join(ROOT, 'tools', 'build-site.js'), 'utf8');
    [['pbbake.js', bakeSrc], ['brandkit.js', kitSrc], ['minidom.js', domSrc],
     ['build-site.js', siteSrc]].forEach(([name, src]) => {
      check('  ' + name + ' requires no http/https module',
        !/require\(['"](https?|node:https?)['"]\)/.test(src));
      check('  ' + name + ' does not use the row reader',
        !/cmsrow/.test(src));
      check('  ' + name + ' contains no fetch call',
        !/\bfetch\s*\(/.test(src) || /fetch: \(\) => new Promise/.test(src));
    });

    /* Deterministic: same commit, same bytes. */
    const d1 = path.join(tmp, 'det1'), d2 = path.join(tmp, 'det2');
    build(brands, 'sync-ok.test', d1);
    build(brands, 'sync-ok.test', d2);
    check('two builds produce identical HTML',
      fs.readFileSync(path.join(d1, 'sync-ok.test', 'about.html'), 'utf8') ===
      fs.readFileSync(path.join(d2, 'sync-ok.test', 'about.html'), 'utf8'));
  }

  /* ================================================================
     J. THE SEO BAKE STILL HOLDS
     ================================================================ */
  console.log('\n===== J. The existing SEO bake is unaffected =====');
  {
    const withProv = fs.readFileSync(path.join(out, 'sync-ok.test', 'about.html'), 'utf8');
    check('published content is in the initial HTML',
      withProv.includes('>' + A.head + '<') && withProv.includes('>' + A.para + '<'));
    check('the mount is marked baked',
      /<div data-cms-sections="about" data-cms-baked="1">/.test(withProv));
    check('the section styles are baked too', /<style id="cmsBuilder">/.test(withProv));

    /* Same brand with and without provenance: the HTML must be identical, so
       the guard demonstrably changes nothing about the output. */
    writeBrand(brands, 'sync-cmp-a.test', { name: 'CMP', builder: block(A), provenance: 'correct' });
    writeBrand(brands, 'sync-cmp-b.test', { name: 'CMP', builder: block(A) });
    build(brands, 'sync-cmp-a.test', out);
    build(brands, 'sync-cmp-b.test', out);
    const ha = fs.readFileSync(path.join(out, 'sync-cmp-a.test', 'about.html'), 'utf8');
    const hb = fs.readFileSync(path.join(out, 'sync-cmp-b.test', 'about.html'), 'utf8');
    check('provenance changes nothing in the generated HTML',
      ha.replace(/sync-cmp-a/g, 'X') === hb.replace(/sync-cmp-b/g, 'X'),
      { a: ha.length, b: hb.length });
    check('  and provenance is NOT shipped to visitors',
      !fs.readFileSync(path.join(out, 'sync-cmp-a.test', 'about.html'), 'utf8')
        .includes('CMS_BRAND_PROVENANCE'));
    check('  though it does travel in the brand layer the build reads',
      fs.readFileSync(path.join(out, 'sync-cmp-a.test', 'js', 'brand.js'), 'utf8')
        .includes('CMS_BRAND_PROVENANCE'));

    /* SEO metadata untouched. */
    const tags = h => JSON.stringify({
      title: (h.match(/<title[^>]*>[^<]*<\/title>/g) || []),
      desc: (h.match(/<meta name="description"[^>]*>/g) || []),
      canonical: (h.match(/<link rel="canonical"[^>]*>/g) || []),
      robots: (h.match(/<meta name="robots"[^>]*>/g) || []),
      ld: (h.match(/application\/ld\+json/g) || []).length,
      h1: (h.match(/<h1[\s>]/g) || []).length
    });
    check('SEO metadata is identical with and without provenance',
      tags(ha.replace(/sync-cmp-a/g, 'X')) === tags(hb.replace(/sync-cmp-b/g, 'X')),
      { a: tags(ha), b: tags(hb) });
    check('  and the check is not vacuous',
      /<link rel="canonical"/.test(ha) && /application\/ld\+json/.test(ha));
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
