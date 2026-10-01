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

/* ====================================================================
   11. A PAGE THE CMS HAS, THAT NO COMMITTED TEMPLATE COVERS
   --------------------------------------------------------------------
   /admin can create a page: it writes a complete record under
   pages.<slug> and used to ask a human to download an HTML file and
   commit it. The record was real and the page was not.

   The build now has a SECOND SOURCE OF PAGES. Everything below drives
   the real CLI with a captured row, so it exercises the same path a
   deploy does, and every claim is made about whichever brand is being
   built -- no brand's pages, domain or content is written into this
   suite.
   ==================================================================== */
console.log('\n===== A CMS PAGE BECOMES A REAL STATIC FILE =====');

/* One complete page record, the shape /admin's "create page" writes. */
function cmsPage(slug, text, extra) {
  return Object.assign({
    label: text, slug: slug, url: slug + '.html', canonical: '',
    robots: { index: true, follow: true }, inSitemap: true,
    og: { title: '', description: '', image: '' },
    twitter: { title: '', description: '', image: '' },
    breadcrumb: { label: text, show: true },
    schema: { webPage: true, breadcrumb: true, contactPage: false },
    updatedAt: '2026-10-01', title: text, metaDescription: text + ' description',
    heading: text, lead: '', body: '', builderMount: true
  }, extra || {});
}

const GEN = { a: 'alpha-guide', b: 'beta-guide' };
const GTEXT = { a: 'ALPHA GUIDE FOR BRAND A', b: 'BETA GUIDE FOR BRAND B' };

/* A row carrying the brand's OWN seo block as well as its pages. Without a
   seo.baseUrl in the record, tools/build-seo-files.js correctly falls back
   to the committed seo-config.json -- which cannot know about a page the
   CMS added -- so a row that is meant to drive the sitemap has to look like
   a real one. Read from the brand's own file, so no domain is written here. */
function seoOf(brandsDir, id) {
  const f = path.join(brandsDir, id, 'seo-config.json');
  return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')).seo || {}) : {};
}
function writeFullRow(file, brandsDir, id, pages, updatedAt) {
  fs.writeFileSync(file, JSON.stringify({ data: { seo: seoOf(brandsDir, id), pages: pages },
    updated_at: updatedAt || '2026-10-01T00:00:00+00:00' }, null, 2));
  return file;
}
{
  const OUT2 = path.join(WORK, 'gen');
  const rows = {};
  rows.a = writeFullRow(path.join(ROWS, 'gen-a.json'), path.join(ROOT, 'brands'), A.id,
    rowFor(A.id, MARK.a, { [GEN.a]: cmsPage(GEN.a, GTEXT.a,
      { builder: { status: 'published', schemaVersion: 2, updatedAt: '2026-10-01',
                   sections: sections('SECTIONS BAKED INSIDE A GENERATED PAGE') } }) }));
  rows.b = writeFullRow(path.join(ROWS, 'gen-b.json'), path.join(ROOT, 'brands'), B.id,
    rowFor(B.id, MARK.b, { [GEN.b]: cmsPage(GEN.b, GTEXT.b) }));

  const ra = build([A.id].concat(A.env, ['--row', rel(rows.a), '--out', OUT2]));
  const rb = build([B.id].concat(B.env, ['--row', rel(rows.b), '--out', OUT2]));
  check('brand A builds with a CMS page of its own', ra.ok, ra.out.slice(-500));
  check('brand B builds with a CMS page of its own', rb.ok, rb.out.slice(-500));

  const fileA = path.join(OUT2, A.out, GEN.a + '.html');
  const fileB = path.join(OUT2, B.out, GEN.b + '.html');

  /* 2. the flat URL convention, unchanged */
  check('the CMS page became /<slug>.html', fs.existsSync(fileA) && fs.existsSync(fileB),
    [fs.existsSync(fileA), fs.existsSync(fileB)]);
  check('  and no directory URL was invented',
    !fs.existsSync(path.join(OUT2, A.out, GEN.a, 'index.html')));
  check('  the build says which pages it generated and from what',
    /CMS pages:\s*alpha-guide\.html \("alpha-guide"\)\s+from templates\/cms-page\.html/.test(ra.out),
    (ra.out.match(/CMS pages:.*/) || [''])[0]);

  const htmlA = fs.readFileSync(fileA, 'utf8');
  const htmlB = fs.readFileSync(fileB, 'utf8');

  /* 3. the record's content is in the file, before any script runs */
  check('the page identifies itself to the CMS engine',
    new RegExp('<html lang="en" data-cms-page="' + GEN.a + '">').test(htmlA));
  check('its heading, title and description are in the HTML source',
    htmlA.indexOf('>' + GTEXT.a + '</h1>') > -1 &&
    htmlA.indexOf('>' + GTEXT.a + '</title>') > -1 &&
    htmlA.indexOf('content="' + GTEXT.a + ' description"') > -1);
  check('  with the data-cms hooks pointing at its own record',
    htmlA.indexOf('data-cms-title="pages.' + GEN.a + '.title"') > -1 &&
    htmlA.indexOf('data-cms-text="pages.' + GEN.a + '.heading"') > -1 &&
    htmlA.indexOf('data-cms-html="pages.' + GEN.a + '.body"') > -1);
  check('  and a canonical on its own brand\'s domain',
    htmlA.indexOf('<link rel="canonical" href="https://' + A.out + '/' + GEN.a + '.html" />') > -1);

  /* It belongs to the existing design system rather than a new one. */
  check('it carries the shared shell, not a layout of its own',
    ['SHELL:HEADER', 'SHELL:NAV', 'SHELL:FOOTER'].every(m =>
      htmlA.indexOf('<!-- ' + m + ' -->') > -1) &&
    /class="site-header"/.test(htmlA) && /class="site-footer"/.test(htmlA) &&
    /class="info-main"/.test(htmlA) && /class="info-article"/.test(htmlA));
  check('  and the same stylesheets every page loads',
    ['css/style.css', 'css/menu.css', 'css/responsive.css', 'css/content.css', 'css/sections.css']
      .every(c => htmlA.indexOf('href="' + c + '"') > -1));
  check('  with no nav item wrongly marked as the current page',
    !/class="nav-link active"/.test(htmlA) && !/class="mob-cat-item active"/.test(htmlA));

  /* 4. the EXISTING Page Builder bake, inside a generated page */
  check('published sections are baked into the generated page',
    new RegExp('data-cms-sections="' + GEN.a + '" data-cms-baked="1">').test(htmlA) &&
    htmlA.indexOf('SECTIONS BAKED INSIDE A GENERATED PAGE') > -1);
  check('  by the same renderer, with the same markers as any other page',
    /class="pb-section pb-text"/.test(htmlA) && /<style id="cmsBuilder">/.test(htmlA));
  check('  and the build counts it with the rest',
    new RegExp('Builder\\s*:[^\\n]*' + GEN.a + ' \\(1 section\\)').test(ra.out),
    (ra.out.match(/Builder.*/) || [''])[0]);
  check('a generated page with nothing published keeps an inert mount',
    new RegExp('<div data-cms-sections="' + GEN.b + '"></div>').test(htmlB));

  /* 5 + 6. the generated-file set, and Step 2's sitemap integrity */
  const smapA = fs.readFileSync(path.join(OUT2, A.out, 'sitemap.xml'), 'utf8');
  check('the generated page is advertised, because its file exists',
    smapA.indexOf('https://' + A.out + '/' + GEN.a + '.html') > -1,
    (smapA.match(/<loc>[^<]*/g) || []));
  check('  and the build says it checked the sitemap against the generated set',
    /checked against \d+ generated page\(s\)/.test(ra.out));
  check('  with nothing excluded, because nothing is missing',
    !/Excluded:/.test(ra.out), (ra.out.match(/Excluded:.*/) || [''])[0]);

  /* 11. brand isolation, both directions */
  const allA = walk(path.join(OUT2, A.out)), allB = walk(path.join(OUT2, B.out));
  check('brand A has its page and NOT brand B\'s',
    allA.indexOf(GEN.a + '.html') > -1 && allA.indexOf(GEN.b + '.html') === -1, allA);
  check('brand B has its page and NOT brand A\'s',
    allB.indexOf(GEN.b + '.html') > -1 && allB.indexOf(GEN.a + '.html') === -1, allB);
  check('no file in brand A\'s site mentions brand B\'s page content',
    !allA.filter(f => /\.(html|xml|txt)$/.test(f))
      .some(f => fs.readFileSync(path.join(OUT2, A.out, f), 'utf8').indexOf(GTEXT.b) > -1));
  check('no file in brand B\'s site mentions brand A\'s page content',
    !allB.filter(f => /\.(html|xml|txt)$/.test(f))
      .some(f => fs.readFileSync(path.join(OUT2, B.out, f), 'utf8').indexOf(GTEXT.a) > -1));
  check('  and that scan is not vacuous', htmlA.indexOf(GTEXT.a) > -1 && htmlB.indexOf(GTEXT.b) > -1);

  /* 1. EXISTING PAGES ARE UNTOUCHED. The same brand built with and
     without the extra record: every page that existed before must be
     byte-identical, and the only new file is the generated one. */
  const BASE = path.join(WORK, 'gen-base');
  const rowBase = writeFullRow(path.join(ROWS, 'gen-base.json'), path.join(ROOT, 'brands'), A.id,
    rowFor(A.id, MARK.a));
  const rbase = build([A.id].concat(A.env, ['--row', rel(rowBase), '--out', BASE]));
  check('the same brand builds without the extra record', rbase.ok, rbase.out.slice(-400));
  const before = walk(path.join(BASE, A.out)), after = walk(path.join(OUT2, A.out));
  const added = after.filter(f => before.indexOf(f) === -1);
  const removed = before.filter(f => after.indexOf(f) === -1);
  check('adding a CMS page adds exactly one file and removes none',
    added.length === 1 && added[0] === GEN.a + '.html' && removed.length === 0, [added, removed]);
  const differ = before.filter(f => !/^sitemap\.xml$/.test(f) &&
    sha(path.join(BASE, A.out, f)) !== sha(path.join(OUT2, A.out, f)));
  check('every pre-existing file is byte-identical', differ.length === 0, differ);
  check('  and the sitemap changed only by gaining that one URL',
    (fs.readFileSync(path.join(OUT2, A.out, 'sitemap.xml'), 'utf8')
      .match(/<loc>[^<]*/g) || []).length ===
    (fs.readFileSync(path.join(BASE, A.out, 'sitemap.xml'), 'utf8')
      .match(/<loc>[^<]*/g) || []).length + 1);
}

/* ====================================================================
   12. WHAT A GENERIC PAGE IS NOT ALLOWED TO DO
   ==================================================================== */
console.log('\n===== A CMS PAGE CANNOT TAKE A NAME THAT IS NOT ITS OWN =====');
{
  const OUT3 = path.join(WORK, 'refuse');
  const attempt = (tag, page) => {
    const row = writeRow(path.join(ROWS, 'refuse-' + tag + '.json'),
      rowFor(A.id, MARK.a, { 'some-guide': page }));
    return build([A.id].concat(A.env, ['--row', rel(row), '--out', path.join(OUT3, tag)]));
  };

  /* 8. a committed page must never be overwritten by CMS content */
  const committed = fs.readdirSync(path.join(ROOT, 'templates', 'pages'))
    .filter(f => /^[a-z0-9][a-z0-9-]*\.html$/.test(f)).sort();
  check('there is a committed template to collide with', committed.length > 0, committed);
  const clash = attempt('clash', cmsPage('some-guide', 'CLASH', { url: committed[0] }));
  check('a CMS page pointing at a committed page FAILS the build', !clash.ok, clash.out.slice(-200));
  check('  saying which page already publishes that file',
    clash.out.indexOf('already published by templates/pages/' + committed[0]) > -1 &&
    /must not overwrite a committed page/.test(clash.out), clash.out.slice(-400));

  /* 9. reserved names */
  const reserved = ['admin', 'sitemap', 'robots'];
  reserved.forEach(name => {
    const r = attempt('res-' + name, cmsPage('some-guide', 'RES', { url: name + '.html' }));
    check('a CMS page cannot be called ' + name + '.html', !r.ok, r.out.slice(-200));
    check('  and the refusal lists the reserved names',
      /is a reserved name \(/.test(r.out), r.out.slice(-300));
  });

  /* 10. a url this build could never create */
  const bad = attempt('bad', cmsPage('some-guide', 'BAD', { url: '../../etc/passwd' }));
  check('an unusable url does not stop the whole site deploying', bad.ok, bad.out.slice(-300));
  check('  but it is said out loud, naming the page',
    /::warning::CMS page "some-guide" has url "\.\.\/\.\.\/etc\/passwd"/.test(bad.out),
    (bad.out.match(/::warning::CMS page.*/) || [''])[0]);
  check('  no page is generated for it', !fs.existsSync(path.join(OUT3, 'bad', A.out, 'passwd')) &&
    walk(path.join(OUT3, 'bad', A.out)).every(f => !/passwd/.test(f)));
  check('  and nothing advertises it',
    !fs.readFileSync(path.join(OUT3, 'bad', A.out, 'sitemap.xml'), 'utf8').includes('passwd'));

  /* 7. a page the record does not publish is not production output.
     The page-record lifecycle is a later step; what exists today is the
     same 'draft' vocabulary the builder blocks use, and a draft builder
     block whose sections must never ship. */
  const draft = attempt('draft', cmsPage('some-guide', 'DRAFTED', { status: 'draft' }));
  check('a page the record marks draft builds, but is not generated', draft.ok &&
    !fs.existsSync(path.join(OUT3, 'draft', A.out, 'some-guide.html')), draft.out.slice(-300));
  check('  and is not advertised either',
    !fs.readFileSync(path.join(OUT3, 'draft', A.out, 'sitemap.xml'), 'utf8').includes('some-guide'));

  const dsec = attempt('dsec', cmsPage('some-guide', 'PUBLISHED SHELL', {
    builder: { status: 'draft', schemaVersion: 2, updatedAt: '2026-10-01',
               sections: sections(MARK.draft) } }));
  check('a generated page with a DRAFT builder block still generates', dsec.ok &&
    fs.existsSync(path.join(OUT3, 'dsec', A.out, 'some-guide.html')), dsec.out.slice(-300));
  check('  but none of the draft content reaches it',
    !walk(path.join(OUT3, 'dsec', A.out)).filter(f => /\.html$/.test(f))
      .some(f => fs.readFileSync(path.join(OUT3, 'dsec', A.out, f), 'utf8').indexOf(MARK.draft) > -1));
}

/* ====================================================================
   13. A THIRD BRAND, WITH NO SHARED-CODE CHANGE
   ==================================================================== */
console.log('\n===== A BRAND THAT IS ONLY A DIRECTORY GETS THE SAME CAPABILITY =====');
{
  const synth = path.join(__dirname, 'fixtures', 'brands');
  const root = mktmp('third');
  const brandsDir = path.join(root, 'brands');
  fs.cpSync(synth, brandsDir, { recursive: true });
  const id = fs.readdirSync(brandsDir, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort()[0];
  const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'seo-config.json'), 'utf8'));
  seo.seo = seo.seo || {};
  seo.seo.baseUrl = 'https://' + id;
  fs.writeFileSync(path.join(brandsDir, id, 'seo-config.json'), JSON.stringify(seo, null, 2) + '\n');

  const slug = 'third-brand-guide', text = 'CONTENT FOR A THIRD BRAND';
  const row = writeRow(path.join(ROWS, 'third.json'),
    { [slug]: cmsPage(slug, text, { builder: { status: 'published', schemaVersion: 2,
      updatedAt: '2026-10-01', sections: sections(text + ' SECTION') } }) });
  const out = mktmp('third-out');
  const r = build([id, '--brands', rel(brandsDir), '--row', rel(row), '--out', out]);
  check('a third brand builds its own CMS page', r.ok, r.out.slice(-500));
  const dir = fs.readdirSync(out).sort()[0];
  const html = fs.existsSync(path.join(out, dir, slug + '.html'))
    ? fs.readFileSync(path.join(out, dir, slug + '.html'), 'utf8') : '';
  check('  the page exists and carries its content', html.indexOf(text) > -1, html.length);
  check('  with its sections baked by the same renderer',
    html.indexOf(text + ' SECTION') > -1 && /data-cms-baked="1"/.test(html));
  check('  on its own domain and no other brand\'s',
    html.indexOf('https://' + id + '/' + slug + '.html') > -1 &&
    !fs.readdirSync(path.join(ROOT, 'brands')).some(o => html.indexOf(o) > -1));
  check('  owning no CMS, generator or template file of its own',
    !walk(path.join(brandsDir, id)).some(f => /(cms|seo-files|cms-page)\.(js|html)$/.test(f)),
    walk(path.join(brandsDir, id)));
}

/* ====================================================================
   14. THE GENERIC TEMPLATE AND ITS GENERATOR NAME NO BRAND
   ==================================================================== */
console.log('\n===== THE GENERIC PAGE MECHANISM IS BRAND-AGNOSTIC =====');
{
  const BRANDISH = /jsk-?1|playzone|[a-z0-9-]+\.(?:com|app)\b/i;
  const ALLOWED = /^(googleapis|cloudflare|schema|sitemaps|w3)\./;
  const tpl = fs.readFileSync(path.join(ROOT, 'templates', 'cms-page.html'), 'utf8');
  const hits = (tpl.match(new RegExp(BRANDISH.source, 'gi')) || []).filter(h => !ALLOWED.test(h));
  check('templates/cms-page.html names no brand, domain or site id', hits.length === 0, hits);
  check('  and lives outside templates/pages/, so it is never published as a page',
    !fs.existsSync(path.join(ROOT, 'templates', 'pages', 'cms-page.html')) &&
    !walk(path.join(ROOT, 'templates')).includes('pages/cms-page.html'));
  check('  getting every brand-specific value from a token',
    /\{\{brand\.name\}\}/.test(tpl) && /\{\{brand\.domain\}\}/.test(tpl) &&
    /\{\{page\.slug\}\}/.test(tpl));
  check('  and carrying the SEO hooks the static bake will write into',
    ['data-cms-title="pages.{{page.slug}}.title"',
     'data-cms-meta="pages.{{page.slug}}.metaDescription"',
     'rel="canonical"', 'name="robots"', 'property="og:title"', 'name="twitter:title"',
     'id="ldPage"', 'id="ldBreadcrumb"'].every(h => tpl.indexOf(h) > -1));
  check('  with a Page Builder mount using the established convention',
    tpl.indexOf('<div data-cms-sections="{{page.slug}}"></div>') > -1);

  /* The shell must not drift from the page it was taken from. */
  const about = fs.readFileSync(path.join(ROOT, 'templates', 'pages', 'about.html'), 'utf8');
  const region = (src, name) => {
    const o = '<!-- SHELL:' + name + ' -->', c = '<!-- /SHELL:' + name + ' -->';
    const a = src.indexOf(o), b = src.indexOf(c);
    return a === -1 || b === -1 ? null : src.slice(a + o.length, b);
  };
  ['HEADER', 'FOOTER'].forEach(n => {
    check('its ' + n.toLowerCase() + ' is the same shell every page ships',
      region(tpl, n) !== null && region(tpl, n) === region(about, n));
  });
  check('its nav is that shell with no page marked current',
    region(tpl, 'NAV') === region(about, 'NAV')
      .replace(/ class="(nav-link|mob-cat-item) active"/g, ' class="$1"')
      .replace(/ aria-current="page"/g, ''));

  /* The code that runs, in the files that gained the capability. */
  const codeOf = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  ['tools/lib/pbbake.js'].forEach(f => {
    check(f + ': no brand, domain or site id in the code that runs',
      !BRANDISH.test(codeOf(f)), (codeOf(f).match(BRANDISH) || [])[0]);
  });
  check('the reader and the generator are separate, as the rest of the build is',
    /function pagesFromRecord\(data\)/.test(fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'pbbake.js'), 'utf8')) &&
    /opts\.cmsPages/.test(fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'brandkit.js'), 'utf8')));

  /* The admin no longer ends at a manual commit. */
  const admin = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');
  check('the admin no longer tells anyone to add the file to the site by hand',
    !/Download the HTML file and add it to the site/.test(admin) &&
    /the next deploy will generate/.test(admin));
}

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
