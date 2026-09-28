#!/usr/bin/env node
/* =====================================================================
   BAKING WHAT THE CMS HAS PUBLISHED
   ---------------------------------------------------------------------
   The bake already put published Page Builder content into the static
   HTML. What it read was brands/<id>/brand.js -- the committed layer --
   so every content change needed an export and a commit before a crawler
   could see it.

   tools/build-site.js --from-cms reads the brand's PUBLISHED record
   instead, and bakes that. The record is the same shape either way and
   goes through the same renderer, so this adds a SOURCE, not a second
   bake. --row FILE supplies a captured payload, which is how this suite
   drives the path deterministically and with no network.

   WHAT THIS SUITE IS REALLY FOR. A build that reaches out for its content
   can fail in ways an offline build cannot, and the dangerous failures are
   the quiet ones: a row that cannot be read, a row belonging to another
   brand, a row that publishes nothing where the site currently publishes
   something. Each of those would replace a live page with an empty mount.
   Every one of them is asserted to STOP the build, name the brand, and say
   what to do -- because a deploy that silently empties production is worse
   than a deploy that does not happen.

   Nothing here is brand-specific: the two real brands are used because
   they exist, and the claims are made about both in the same words.
   ===================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SHELL = require(path.join(__dirname, 'lib', 'pbshell.js'));

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const tmpRoots = [];
function mktmp(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'cmsbake-' + tag + '-'));
  tmpRoots.push(d); return d;
}
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

/* One section carrying one line of text -- enough to find in the HTML and
   to tell two brands' content apart. */
function sections(text) {
  return [{ id: 's1', type: 'text', enabled: true,
    visibility: { desktop: true, tablet: true, mobile: true },
    style: { padding: '40' }, responsive: {},
    elements: [{ id: 'e1', type: 'heading', content: { text: text, level: 'h2' },
                 style: {}, responsive: {} }] }];
}
const published = t => ({ builder: { status: 'published', schemaVersion: 2, updatedAt: '2026-09-28', sections: sections(t) } });
const draft = t => ({ builder: { status: 'draft', schemaVersion: 2, updatedAt: '2026-09-28', sections: sections(t) } });

function writeRow(file, pages, updatedAt) {
  fs.writeFileSync(file, JSON.stringify({ data: { pages: pages },
    updated_at: updatedAt || '2026-09-28T21:00:00+00:00' }, null, 2));
  return file;
}

/* Run the real CLI, the way a deploy runs it. Returns the exit status and
   everything it said, because the MESSAGE is half of what is asserted. */
function build(args) {
  try {
    const out = execFileSync(process.execPath,
      [path.join(ROOT, 'tools', 'build-site.js')].concat(args),
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out: out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}
function walk(dir, base, out) {
  base = base || dir; out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}

const WORK = mktmp('work');
const ROWS = path.join(WORK, 'rows'); fs.mkdirSync(ROWS);
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

/* The brands are read from the repository, so this suite never invents a
   brand and never asserts about one by name beyond identifying it. */
const A = { id: 'jsk-1.com', env: [], out: 'jsk-1.com' };
const B = { id: 'playzone9.app', env: ['--env', 'staging'], out: 'playzones9.com' };
const MARK = { a: 'CONTENT FOR BRAND A FROM THE CMS ROW',
               b: 'CONTENT FOR BRAND B FROM THE CMS ROW',
               draft: 'DRAFT THAT MUST NEVER BE BAKED' };

/* Whatever each brand's committed layer already publishes has to be in its
   row too, or the build rightly refuses to empty those pages. Built from
   the layer itself, so this suite does not hard-code either brand's pages. */
function rowFor(brandId, aboutText, extra) {
  const layer = SHELL.publishedBlocks(path.join(ROOT, 'brands'), brandId);
  const pages = {};
  Object.keys(layer).forEach(slug => { pages[slug] = published('kept: ' + slug); });
  pages.about = published(aboutText);
  Object.assign(pages, extra || {});
  return pages;
}

/* ====================================================================
   1. THE PUBLISHED RECORD REACHES THE HTML, PER BRAND
   ==================================================================== */
console.log('\n===== PUBLISHED CMS CONTENT IS IN THE HTML SOURCE =====');
const rowA = writeRow(path.join(ROWS, 'a.json'), rowFor(A.id, MARK.a, { login: draft(MARK.draft) }));
const rowB = writeRow(path.join(ROWS, 'b.json'), rowFor(B.id, MARK.b, { contact: draft(MARK.draft) }));
const OUT = path.join(WORK, 'out');

const ra = build([A.id].concat(A.env, ['--row', rel(rowA), '--out', OUT]));
const rb = build([B.id].concat(B.env, ['--row', rel(rowB), '--out', OUT]));
check('brand A builds from its published record', ra.ok, ra.out.slice(-400));
check('brand B builds from its published record', rb.ok, rb.out.slice(-400));
check('brand A says where the content came from',
  /Content\s*:\s*the PUBLISHED CMS record/.test(ra.out), (ra.out.match(/Content.*/) || [''])[0]);
check('brand B says where the content came from',
  /Content\s*:\s*the PUBLISHED CMS record/.test(rb.out), (rb.out.match(/Content.*/) || [''])[0]);
check('and neither claims it baked from the committed layer',
  !/baked into the HTML from brands\//.test(ra.out + rb.out));

const htmlA = fs.readFileSync(path.join(OUT, A.out, 'about.html'), 'utf8');
const htmlB = fs.readFileSync(path.join(OUT, B.out, 'about.html'), 'utf8');
check('brand A: its content is in the HTML the server sends', htmlA.indexOf(MARK.a) > -1);
check('brand B: its content is in the HTML the server sends', htmlB.indexOf(MARK.b) > -1);
check('brand A: the mount is marked baked',
  /<div data-cms-sections="about" data-cms-baked="1">/.test(htmlA));
check('brand B: the mount is marked baked',
  /<div data-cms-sections="about" data-cms-baked="1">/.test(htmlB));
check('brand A: the content is INSIDE the mount, not loose on the page',
  new RegExp('data-cms-baked="1">[\\s\\S]*?' + MARK.a).test(htmlA));
check('brand B: the content is INSIDE the mount, not loose on the page',
  new RegExp('data-cms-baked="1">[\\s\\S]*?' + MARK.b).test(htmlB));
/* The point of the whole exercise: no JavaScript ran to put it there. */
check('it is in the FILE, with no script having executed',
  fs.readFileSync(path.join(OUT, A.out, 'about.html'), 'utf8').indexOf(MARK.a) > -1);

/* ====================================================================
   2. NEITHER BRAND'S CONTENT REACHES THE OTHER
   ==================================================================== */
console.log('\n===== ONE BRAND\'S RECORD CANNOT REACH ANOTHER\'S SITE =====');
check('brand A\'s pages carry none of brand B\'s content',
  !walk(path.join(OUT, A.out)).filter(f => /\.html$/.test(f))
    .some(f => fs.readFileSync(path.join(OUT, A.out, f), 'utf8').indexOf(MARK.b) > -1));
check('brand B\'s pages carry none of brand A\'s content',
  !walk(path.join(OUT, B.out)).filter(f => /\.html$/.test(f))
    .some(f => fs.readFileSync(path.join(OUT, B.out, f), 'utf8').indexOf(MARK.a) > -1));
check('  and that scan is not vacuous: each site does carry its own',
  htmlA.indexOf(MARK.a) > -1 && htmlB.indexOf(MARK.b) > -1);
check('the two builds wrote to different directories', A.out !== B.out &&
  fs.existsSync(path.join(OUT, A.out)) && fs.existsSync(path.join(OUT, B.out)));

/* ====================================================================
   3. DRAFTS ARE NOT BAKED
   ==================================================================== */
console.log('\n===== ONLY PUBLISHED CONTENT IS BAKED =====');
for (const [name, dir] of [['brand A', A.out], ['brand B', B.out]]) {
  const leaked = walk(path.join(OUT, dir))
    .filter(f => /\.(html|xml|txt)$/.test(f))
    .filter(f => fs.readFileSync(path.join(OUT, dir, f), 'utf8').indexOf(MARK.draft) > -1);
  check(name + ': no draft text appears anywhere in the built site', leaked.length === 0, leaked);
}
check('brand B\'s draft-only page keeps an empty mount',
  /<div data-cms-sections="contact"><\/div>/.test(
    fs.readFileSync(path.join(OUT, B.out, 'contact.html'), 'utf8')));
check('  so a draft cannot be read without JavaScript either -- it is not there at all',
  fs.readFileSync(path.join(OUT, B.out, 'contact.html'), 'utf8').indexOf(MARK.draft) === -1);

/* ====================================================================
   4. THE BUILD IS IDEMPOTENT
   ==================================================================== */
console.log('\n===== RUNNING IT TWICE CHANGES NOTHING =====');
{
  const one = path.join(WORK, 'once'), two = path.join(WORK, 'twice');
  build([A.id].concat(A.env, ['--row', rel(rowA), '--out', one]));
  build([A.id].concat(A.env, ['--row', rel(rowA), '--out', two]));
  const fa = walk(path.join(one, A.out)), fb = walk(path.join(two, A.out));
  check('two builds write the same file list', JSON.stringify(fa) === JSON.stringify(fb));
  check('and every file is byte-identical',
    fa.every(f => sha(path.join(one, A.out, f)) === sha(path.join(two, A.out, f))));

  /* Into the SAME directory, which is what a re-run of a deploy does. */
  const same = path.join(WORK, 'same');
  build([A.id].concat(A.env, ['--row', rel(rowA), '--out', same]));
  const before = fs.readFileSync(path.join(same, A.out, 'about.html'), 'utf8');
  build([A.id].concat(A.env, ['--row', rel(rowA), '--out', same]));
  const after = fs.readFileSync(path.join(same, A.out, 'about.html'), 'utf8');
  check('rebuilding over the same directory is byte-identical', before === after);
  check('and the content appears exactly once, not twice',
    (after.match(new RegExp(MARK.a, 'g')) || []).length === 1,
    (after.match(new RegExp(MARK.a, 'g')) || []).length);
  check('  with one section in the mount, not two',
    (after.match(/class="pb-section/g) || []).length === 1);
}

/* ====================================================================
   5. IT FAILS RATHER THAN EMPTYING PAGES
   Each of these would otherwise deploy a live page as an empty mount.
   ==================================================================== */
console.log('\n===== A RECORD IT CANNOT TRUST STOPS THE BUILD =====');
{
  const dead = path.join(WORK, 'dead');
  const r = build([A.id, '--row', 'does/not/exist.json', '--out', dead]);
  check('an unreadable record fails the build', !r.ok, r.out.slice(-200));
  check('  and the message names the brand', /Brand "jsk-1\.com"/.test(r.out));
  check('  and nothing was written', !fs.existsSync(path.join(dead, A.out, 'about.html')));
}
{
  const empty = writeRow(path.join(ROWS, 'empty.json'), {});
  const r = build([A.id, '--row', rel(empty), '--out', path.join(WORK, 'emptied')]);
  check('a record that publishes nothing where the site does fails the build', !r.ok);
  check('  and it names the pages that would have been emptied',
    /"about"/.test(r.out), r.out.slice(-300));
  check('  and it offers the explicit way to say the page really was unpublished',
    /--allow-unpublish/.test(r.out));
  const ok = build([A.id, '--row', rel(empty), '--allow-unpublish',
                    '--out', path.join(WORK, 'unpub')]);
  check('and with --allow-unpublish it builds', ok.ok, ok.out.slice(-300));
  check('  leaving the mount empty, as an unpublished page should',
    /<div data-cms-sections="about"><\/div>/.test(
      fs.readFileSync(path.join(WORK, 'unpub', A.out, 'about.html'), 'utf8')));
  check('  and saying so on the content line', /unpublished: /.test(ok.out),
    (ok.out.match(/Content.*/) || [''])[0]);
}
{
  const norow = path.join(ROWS, 'norow.json');
  fs.writeFileSync(norow, JSON.stringify({ data: null }));
  const r = build([A.id, '--row', rel(norow), '--out', path.join(WORK, 'norow')]);
  check('a record with no data fails the build', !r.ok);
  check('  rather than deploying HTML without the published content',
    /Refusing to build/.test(r.out), r.out.slice(-300));
}

/* ====================================================================
   6. THE LIVE FETCH PATH, WITHOUT A NETWORK
   --row proves the baking. This proves the part --row skips: that
   --from-cms reads THIS brand's row and refuses another's. The reader is
   replaced for the duration, which is how the offline suites already
   exercise it.
   ==================================================================== */
console.log('\n===== --from-cms READS THIS BRAND\'S ROW, AND ONLY ITS OWN =====');
{
  const readerFile = path.join(ROOT, 'tools', 'lib', 'cmsrow.js');
  const real = fs.readFileSync(readerFile, 'utf8');
  const stub = (cfgJson, rowJson) =>
    "'use strict';\nmodule.exports = {\n" +
    "  readConfig: function () { return " + cfgJson + "; },\n" +
    "  fetchRow: function () { return Promise.resolve(" + rowJson + "); }\n};\n";
  const rowData = JSON.stringify({ data: { pages: rowFor(A.id, MARK.a) },
                                   updatedAt: '2026-09-28T22:00:00+00:00' });
  try {
    /* The brand's own row: it builds, and the content is baked. */
    fs.writeFileSync(readerFile, stub(
      JSON.stringify({ enabled: true, siteId: 'playzone9', url: 'https://x', anonKey: 'k', table: 't' }),
      rowData));
    const good = build([A.id, '--from-cms', '--out', path.join(WORK, 'live')]);
    check('it builds from the row the brand declares', good.ok, good.out.slice(-400));
    check('  and bakes what that row publishes',
      fs.readFileSync(path.join(WORK, 'live', A.out, 'about.html'), 'utf8').indexOf(MARK.a) > -1);
    check('  and no network call was needed for the bake itself', /Content\s*:\s*the PUBLISHED/.test(good.out));

    /* A row belonging to someone else: refused before anything is read. */
    fs.writeFileSync(readerFile, stub(
      JSON.stringify({ enabled: true, siteId: 'someone-elses-row', url: 'https://x', anonKey: 'k', table: 't' }),
      rowData));
    const wrong = build([A.id, '--from-cms', '--out', path.join(WORK, 'wrong')]);
    check('it REFUSES a row that belongs to another brand', !wrong.ok, wrong.out.slice(-300));
    check('  and says so in those terms',
      /Refusing to bake another brand/.test(wrong.out), wrong.out.slice(-300));

    /* Remote storage not configured for this host. */
    fs.writeFileSync(readerFile, stub('{}', rowData));
    const unconf = build([A.id, '--from-cms', '--out', path.join(WORK, 'unconf')]);
    check('it fails when remote storage is not configured for the brand', !unconf.ok);
    check('  rather than quietly baking the committed layer instead',
      /does not configure remote storage/.test(unconf.out), unconf.out.slice(-300));
  } finally {
    fs.writeFileSync(readerFile, real);
  }
  check('the reader was restored', fs.readFileSync(readerFile, 'utf8') === real);
}

/* ====================================================================
   7. EVERYTHING ELSE ABOUT THE PAGE IS UNCHANGED
   ==================================================================== */
console.log('\n===== ONLY THE MOUNT CHANGED =====');
{
  /* The same brand, same build, content from the committed layer instead of
     the row. Everything outside the mount must be identical -- head, SEO,
     canonical, favicon, navigation, footer, scripts. */
  const committed = path.join(WORK, 'committed');
  const r = build([A.id, '--out', committed]);
  check('the committed-layer build still works untouched', r.ok, r.out.slice(-300));
  check('  and says the content came from the committed layer',
    /Content\s*:\s*brands\//.test(r.out), (r.out.match(/Content.*/) || [''])[0]);

  const cHtml = fs.readFileSync(path.join(committed, A.out, 'about.html'), 'utf8');
  const strip = h => h.replace(/<div data-cms-sections="[a-z0-9-]+"[^>]*>[\s\S]*?<\/section><\/div>/g, 'MOUNT')
                      .replace(/<div data-cms-sections="[a-z0-9-]+"><\/div>/g, 'MOUNT')
                      .replace(/<style id="cmsBuilder">[\s\S]*?<\/style>\n?/g, '');
  check('outside the mount the two builds are byte-identical', strip(cHtml) === strip(htmlA));
  for (const tag of ['<link rel="canonical"', 'name="description"', 'id="cmsFavicon"',
                     '<h1', 'class="footer-links"', 'js/cms.js']) {
    check('  "' + tag + '" survives the CMS bake',
      htmlA.indexOf(tag) > -1 && cHtml.indexOf(tag) > -1);
  }
  const files = f => walk(path.join(f, A.out)).join(',');
  check('the two builds publish the same file set', files(committed) === files(OUT));
}

/* ====================================================================
   8. SEO GENERATION STILL RUNS, PER BRAND
   ==================================================================== */
console.log('\n===== SEO IS UNAFFECTED, AND STILL PER BRAND =====');
check('brand A publishes a sitemap', fs.existsSync(path.join(OUT, A.out, 'sitemap.xml')));
check('brand A publishes robots.txt', fs.existsSync(path.join(OUT, A.out, 'robots.txt')));
check('brand A\'s sitemap names its own domain and no other brand\'s',
  /jsk-1\.com/.test(fs.readFileSync(path.join(OUT, A.out, 'sitemap.xml'), 'utf8')) &&
  !/playzone/i.test(fs.readFileSync(path.join(OUT, A.out, 'sitemap.xml'), 'utf8')));
check('brand B (a noindex review host) still publishes no sitemap',
  !fs.existsSync(path.join(OUT, B.out, 'sitemap.xml')));
check('and its robots.txt still blocks everything',
  /^Disallow: \/$/m.test(fs.readFileSync(path.join(OUT, B.out, 'robots.txt'), 'utf8')));
check('no CMS content leaked into either sitemap or robots',
  !fs.readFileSync(path.join(OUT, A.out, 'sitemap.xml'), 'utf8').includes(MARK.a) &&
  !fs.readFileSync(path.join(OUT, B.out, 'robots.txt'), 'utf8').includes(MARK.b));

/* ====================================================================
   9. THE DEPLOYS USE IT
   ==================================================================== */
console.log('\n===== BOTH DEPLOYS BAKE FROM THE CMS =====');
{
  const wf = d => fs.readFileSync(path.join(ROOT, '.github', 'workflows', d), 'utf8')
    .split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  const prod = wf('static.yml'), pz = wf('deploy-playzone9.yml');
  check('the JSK1 deploy passes --from-cms',
    /node tools\/build-site\.js jsk-1\.com --from-cms/.test(prod), (prod.match(/run: node[^\n]*/g) || []));
  check('the Playzone9 deploy passes --from-cms',
    /node tools\/build-site\.js playzone9\.app --env staging --from-cms/.test(pz),
    (pz.match(/run: node[^\n]*/g) || []));
  check('neither deploy passes --allow-unpublish, so an emptied page stops it',
    !/--allow-unpublish/.test(prod) && !/--allow-unpublish/.test(pz));
  check('each deploy still names its own brand and no other',
    !/playzone9/i.test(prod) && !/jsk-1\.com/.test(pz));

  /* THE GAP THAT MADE A GREEN DEPLOY LOOK LIKE A BROKEN BAKE.
     --from-cms reads the row when the build runs, so a publish only reaches
     the HTML if a publish can START a build. With `push` as the only trigger
     it never can: the row changes, nothing rebuilds, the served HTML stays
     at the last commit's snapshot, and the runtime paints over it -- so the
     page looks right and its source is stale. These assert that both deploys
     can be started by something other than a code change. */
  const onBlock = y => y.split(/\npermissions:/)[0];
  for (const [name, y] of [['the JSK1 deploy', prod], ['the Playzone9 deploy', pz]]) {
    check(name + ' can be started by a publish hook (repository_dispatch)',
      /repository_dispatch:/.test(onBlock(y)) && /cms-published/.test(onBlock(y)));
    check(name + ' also rebuilds on a timer, so a publish reaches the HTML with ' +
      'nothing configured', /schedule:\s*\n\s*- cron:/.test(onBlock(y)));
    check(name + ' still rebuilds on a push and can still be run by hand',
      /push:/.test(onBlock(y)) && /workflow_dispatch:/.test(onBlock(y)));
  }

  /* And the deploy does not merely assume the bytes arrived. */
  check('the JSK1 deploy verifies the DEPLOYED HTML after deploying',
    /verify-deployed\.js/.test(prod) && prod.indexOf('deploy-pages') < prod.indexOf('verify-deployed.js'));
  check('  and it checks the URL it just deployed to, not a hard-coded one',
    /--url "\$\{\{ steps\.deployment\.outputs\.page_url \}\}"/.test(prod));
  check('  against the artifact it just built',
    /--site _site\/jsk-1\.com/.test(prod));
}

/* ====================================================================
   10. THE DEPLOYED HTML IS CHECKED, NOT ASSUMED
   --------------------------------------------------------------------
   tools/verify-deployed.js is the step that would have caught this in
   production: it compares the baked markup the build wrote with the bytes
   the site actually returns. --served reads the "response" from a directory,
   so these run with no network.
   ==================================================================== */
console.log('\n===== THE SERVED HTML IS COMPARED WITH WHAT WAS BUILT =====');
{
  const built = path.join(OUT, A.out);
  const verify = args => {
    try {
      return { code: 0, out: execFileSync(process.execPath,
        [path.join(ROOT, 'tools', 'verify-deployed.js')].concat(args),
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
  };
  const copy = tag => {
    const d = path.join(mktmp('served'), tag);
    fs.cpSync(built, d, { recursive: true });
    return d;
  };

  const good = verify(['--site', built, '--served', built]);
  check('a site serving what was built passes', good.code === 0, good.out.slice(-300));
  check('  and says so in terms of the HTML source, not the DOM',
    /present in the served HTML, before any JavaScript runs/.test(good.out));
  check('  having actually found this brand\'s content, not just a mount',
    good.out.indexOf('about.html') > -1 && /Baked\s*:\s*[1-9]/.test(good.out));

  /* The production symptom, exactly: the deploy served the PREVIOUS build,
     so the mount is there and its content is last week's. */
  const stale = copy('stale');
  const sp = path.join(stale, 'about.html');
  fs.writeFileSync(sp, fs.readFileSync(sp, 'utf8').replace(MARK.a, 'CONTENT FROM AN EARLIER BUILD'));
  const st = verify(['--site', built, '--served', stale, '--attempts', '1']);
  check('a stale served page FAILS, even though it has a baked mount', st.code === 1, st.out.slice(-300));
  check('  and the failure names the page', /about\.html/.test(st.out));
  check('  and says the served version is not the one built',
    /not the one that was just built/.test(st.out));

  /* The original bug: the mount is empty and only JavaScript fills it. */
  const empty = copy('empty');
  const ep = path.join(empty, 'about.html');
  fs.writeFileSync(ep, fs.readFileSync(ep, 'utf8')
    .replace(/<div data-cms-sections="about" data-cms-baked="1">[\s\S]*?<\/section><\/div>/,
             '<div data-cms-sections="about"></div>'));
  const em = verify(['--site', built, '--served', empty, '--attempts', '1']);
  check('a page whose content exists only after JavaScript FAILS', em.code === 1, em.out.slice(-300));
  check('  and says the served page has no baked mount at all',
    /no baked mount at all/.test(em.out));

  /* A page that cannot be fetched is "could not check" (2), not "missing"
     (1): the two need different responses and must not be confused. */
  const gone = copy('gone');
  fs.rmSync(path.join(gone, 'about.html'));
  const g = verify(['--site', built, '--served', gone, '--attempts', '1']);
  check('a page that cannot be fetched at all exits 2, not 1', g.code === 2, g.out.slice(-300));

  /* Nothing baked is not a failure -- an unpublished brand legitimately has
     no mounts -- but it must be stated rather than passing silently. */
  const bare = path.join(mktmp('bare'), 'site');
  fs.mkdirSync(bare, { recursive: true });
  fs.writeFileSync(path.join(bare, 'about.html'), '<html><body><div data-cms-sections="about"></div></body></html>');
  const b = verify(['--site', bare, '--served', bare]);
  check('a site with nothing baked passes and says nothing was baked',
    b.code === 0 && /no page in/.test(b.out), b.out.slice(-300));

  /* A SECTION ID CARRYING `>` OR `"`.
     Both render into a quoted attribute value, which is legal HTML and which
     a browser reads as one tag -- tests/test_pb_bake.js asserts our
     serialisation matches a browser's. A regex tag scan does not: it ends the
     tag at the `>` inside the value and reads the rest of the value as
     markup, so the mount looks unclosed and a sound deploy fails. Content
     cannot inject a tag (it is escaped) but it can contain these characters,
     so the scan has to honour quoting. */
  const hostilePages = rowFor(A.id, MARK.a);
  hostilePages.about.builder.sections[0].id = 'sec_x" ><div class="y"><div>';
  const hostileRow = writeRow(path.join(ROWS, 'hostile.json'), hostilePages);
  const hDir = path.join(mktmp('hostile'), 'out');
  const hb = build([A.id, '--row', rel(hostileRow), '--out', hDir]);
  check('a section id containing > and " still builds', hb.ok, hb.out.slice(-300));
  const hSite = path.join(hDir, A.out);
  check('  and the id reaches the HTML escaped, not raw',
    fs.readFileSync(path.join(hSite, 'about.html'), 'utf8').indexOf('data-sec="sec_x&quot; >') > -1);
  const hv = verify(['--site', hSite, '--served', hSite]);
  check('  and the verifier still passes on a page serving what was built',
    hv.code === 0, hv.out.slice(-300));
  check('  having parsed the mount rather than calling it unclosed',
    /Baked\s*:\s*[1-9]/.test(hv.out) && !/not closed/.test(hv.out));
  const hStale = path.join(mktmp('hstale'), 'served');
  fs.cpSync(hSite, hStale, { recursive: true });
  const hp = path.join(hStale, 'about.html');
  fs.writeFileSync(hp, fs.readFileSync(hp, 'utf8').replace(MARK.a, 'OLD TEXT'));
  const hs = verify(['--site', hSite, '--served', hStale, '--attempts', '1']);
  check('  and a stale serve of that same page still FAILS', hs.code === 1, hs.out.slice(-300));

  /* It must not need a brand, a domain or a page list of its own. */
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'verify-deployed.js'), 'utf8');
  check('the verifier hard-codes no brand, domain or page',
    !/jsk-1|playzone|about\.html|\.com\b/.test(tool.split('\n')
      .filter(l => !/^\s*(\*|\/\*|#)/.test(l)).join('\n')));
}

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
