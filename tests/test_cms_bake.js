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

/* The same, for any brands directory -- the synthetic third brand lives in
   a temp one. Whatever that brand's committed layer publishes has to be in
   its row too, or the build rightly refuses to empty those pages. */
function rowFor2(brandsDir, brandId) {
  const layer = SHELL.publishedBlocks(brandsDir, brandId);
  const pages = {};
  Object.keys(layer).forEach(slug => { pages[slug] = published('kept: ' + slug); });
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
    /<title\b[^>]*>[^<]*ALPHA GUIDE FOR BRAND A[^<]*<\/title>/.test(htmlA) &&
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
  check('  getting every brand-specific value from a token, never a literal',
    /\{\{brand\.name\}\}/.test(tpl) && /\{\{page\.slug\}\}/.test(tpl) &&
    /\{\{seo\.canonical\}\}/.test(tpl) && /\{\{seo\.ogUrl\}\}/.test(tpl));
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

/* ====================================================================
   15. THE PAGE'S SEO IS IN THE HTML, NOT ONLY IN THE DOM
   --------------------------------------------------------------------
   Everything below reads the generated file AS PLAIN TEXT. No browser,
   no JavaScript: if a value is here, a crawler that executes nothing
   reads it. The values themselves are computed by js/cms.js's own
   CMS.seo.tags(), so this asserts they ARRIVED, not how they were
   worked out -- tests/test_seo_api.js is where the two computations are
   compared.
   ==================================================================== */
console.log('\n===== THE CMS PAGE\'S SEO IS BAKED INTO THE HTML SOURCE =====');

/* Read one tag out of static text, anchored on the attribute that names
   it rather than on where it sits. */
const attrOf = (html, sel, attr) => {
  const m = new RegExp('<[a-z]+[^>]*\\b' + sel + '[^>]*\\b' + attr + '="([^"]*)"', 'i').exec(html) ||
            new RegExp('<[a-z]+[^>]*\\b' + attr + '="([^"]*)"[^>]*\\b' + sel, 'i').exec(html);
  return m ? m[1] : null;
};
const metaTag = (html, kind, name) => attrOf(html, kind + '="' + name + '"', 'content');
const titleOf = html => {
  const m = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? m[1] : null;
};
const ldOf = (html, id) => {
  const m = new RegExp('<script[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</script>', 'i').exec(html);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return 'UNPARSEABLE: ' + m[1].slice(0, 120); }
};

const SEOSLUG = 'seo-fixture-page';
/* One fixture, run through every brand. Nothing in it names a brand, so
   each brand's own record is what differentiates the result. */
function seoFixture(extra) {
  return cmsPage(SEOSLUG, 'Fixture Page', Object.assign({
    metaDescription: 'Fixture page description.',
    og: { title: 'Fixture OG title', description: 'Fixture OG description', image: 'assets/images/ssl.png' },
    twitter: { title: '', description: '', image: '' }
  }, extra || {}));
}

{
  const OUT4 = path.join(WORK, 'seo');
  const brandsDir = path.join(ROOT, 'brands');
  const row = writeFullRow(path.join(ROWS, 'seo-a.json'), brandsDir, A.id,
    rowFor(A.id, MARK.a, { [SEOSLUG]: seoFixture() }));
  const r = build([A.id].concat(A.env, ['--row', rel(row), '--out', OUT4]));
  check('a brand builds a CMS page with SEO to bake', r.ok, r.out.slice(-500));
  const html = fs.readFileSync(path.join(OUT4, A.out, SEOSLUG + '.html'), 'utf8');

  /* 1-6. the tags, in the file */
  check('the title is in the HTML source', !!titleOf(html) && titleOf(html).indexOf('Fixture Page') > -1,
    titleOf(html));
  check('  and carries the brand\'s own title template, not the raw field',
    titleOf(html) !== 'Fixture Page' && titleOf(html).length > 'Fixture Page'.length, titleOf(html));
  check('the meta description is in the HTML source',
    metaTag(html, 'name', 'description') === 'Fixture page description.',
    metaTag(html, 'name', 'description'));
  check('the canonical is in the HTML source, on this brand\'s domain',
    attrOf(html, 'rel="canonical"', 'href') === 'https://' + A.out + '/' + SEOSLUG + '.html',
    attrOf(html, 'rel="canonical"', 'href'));
  check('  keeping the flat /<slug>.html convention',
    !/rel="canonical" href="[^"]*\/[^".]*\/"/.test(html));
  check('the robots directive is in the HTML source',
    metaTag(html, 'name', 'robots') === 'index,follow', metaTag(html, 'name', 'robots'));
  check('the Open Graph title and description are in the HTML source',
    metaTag(html, 'property', 'og:title') === 'Fixture OG title' &&
    metaTag(html, 'property', 'og:description') === 'Fixture OG description',
    [metaTag(html, 'property', 'og:title'), metaTag(html, 'property', 'og:description')]);
  check('  with og:url matching the canonical',
    metaTag(html, 'property', 'og:url') === attrOf(html, 'rel="canonical"', 'href'));
  check('the Open Graph image is absolute, from the brand\'s own base',
    metaTag(html, 'property', 'og:image') === 'https://' + A.out + '/assets/images/ssl.png',
    metaTag(html, 'property', 'og:image'));
  check('Twitter inherits Open Graph, by the engine\'s own rule',
    metaTag(html, 'name', 'twitter:title') === 'Fixture OG title' &&
    metaTag(html, 'name', 'twitter:description') === 'Fixture OG description' &&
    metaTag(html, 'name', 'twitter:image') === metaTag(html, 'property', 'og:image'),
    [metaTag(html, 'name', 'twitter:title'), metaTag(html, 'name', 'twitter:image')]);

  /* 7-8. JSON-LD, parsed back from the script element */
  const ldPage = ldOf(html, 'ldPage'), ldBc = ldOf(html, 'ldBreadcrumb');
  check('the WebPage JSON-LD is valid JSON in the HTML source',
    ldPage && ldPage['@type'] === 'WebPage' && ldPage['@context'] === 'https://schema.org', ldPage);
  check('  describing this page, at the same URL as the canonical',
    ldPage.url === attrOf(html, 'rel="canonical"', 'href') &&
    ldPage.description === metaTag(html, 'name', 'description'), ldPage);
  check('the Breadcrumb JSON-LD is valid JSON in the HTML source',
    ldBc && ldBc['@type'] === 'BreadcrumbList' && ldBc.itemListElement.length === 2, ldBc);
  check('  ending on this page, at the same URL again',
    ldBc.itemListElement[1].item === ldPage.url, ldBc.itemListElement);
  check('no block is written twice',
    (html.match(/id="ldPage"/g) || []).length === 1 &&
    (html.match(/id="ldBreadcrumb"/g) || []).length === 1);

  /* 12-13. exactly one of each single-valued tag */
  [['rel="canonical"', 1], ['name="robots"', 1], ['property="og:title"', 1],
   ['property="og:url"', 1], ['name="twitter:title"', 1], ['property="og:image"', 1],
   ['name="twitter:image"', 1]].forEach(([needle, n]) =>
    check('exactly ' + n + ' ' + needle + ' in the page',
      (html.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length === n,
      (html.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length));
  check('and one <title>', (html.match(/<title\b/g) || []).length === 1);

  /* 14-15. escaping */
  const hostile = 'A "quoted" <tag> & an \u0027apostrophe\u0027';
  const hrow = writeFullRow(path.join(ROWS, 'seo-esc.json'), brandsDir, A.id,
    rowFor(A.id, MARK.a, { [SEOSLUG]: seoFixture({ title: hostile, metaDescription: hostile,
      og: { title: hostile, description: hostile, image: 'assets/x.png?a=1&b=2' },
      breadcrumb: { label: hostile, show: true } }) }));
  const he = build([A.id].concat(A.env, ['--row', rel(hrow), '--out', path.join(WORK, 'seo-esc')]));
  check('a hostile CMS value still builds', he.ok, he.out.slice(-400));
  const hh = fs.readFileSync(path.join(WORK, 'seo-esc', A.out, SEOSLUG + '.html'), 'utf8');
  check('it is escaped in attributes, so no tag is broken out of',
    metaTag(hh, 'property', 'og:title') !== null &&
    metaTag(hh, 'property', 'og:title').indexOf('&quot;') > -1 &&
    metaTag(hh, 'property', 'og:title').indexOf('&lt;tag&gt;') > -1,
    metaTag(hh, 'property', 'og:title'));
  check('  and in text, so the title element still closes where it should',
    titleOf(hh).indexOf('&lt;tag&gt;') > -1 && (hh.match(/<title\b/g) || []).length === 1);
  check('  with no raw angle bracket from CMS content anywhere in the head',
    !/content="[^"]*<[^"]*"/.test(hh.slice(0, hh.indexOf('</head>'))));
  check('an & in an image URL is escaped in the attribute',
    (metaTag(hh, 'property', 'og:image') || '').indexOf('&amp;b=2') > -1,
    metaTag(hh, 'property', 'og:image'));
  check('the JSON-LD stays parseable with hostile content in it',
    ldOf(hh, 'ldPage') && ldOf(hh, 'ldPage')['@type'] === 'WebPage', ldOf(hh, 'ldPage'));
  check('  and cannot end its own script element',
    !/<\/script/i.test(/id="ldPage"[^>]*>([\s\S]*?)<\/script>/i.exec(hh)[1]));

  /* 9-11. blank CMS values keep a valid fallback -- never an empty tag */
  const brow = writeFullRow(path.join(ROWS, 'seo-blank.json'), brandsDir, A.id,
    rowFor(A.id, MARK.a, { [SEOSLUG]: cmsPage(SEOSLUG, 'Blank Fixture', {
      title: '', metaDescription: '', heading: '',
      og: { title: '', description: '', image: '' },
      twitter: { title: '', description: '', image: '' } }) }));
  const bb = build([A.id].concat(A.env, ['--row', rel(brow), '--out', path.join(WORK, 'seo-blank')]));
  check('a page with every SEO field blank still builds', bb.ok, bb.out.slice(-400));
  const bh = fs.readFileSync(path.join(WORK, 'seo-blank', A.out, SEOSLUG + '.html'), 'utf8');
  check('a blank title does not produce an empty <title>', !!titleOf(bh).trim(), titleOf(bh));
  check('a blank description does not produce an empty description tag',
    !!(metaTag(bh, 'name', 'description') || '').trim(), metaTag(bh, 'name', 'description'));
  check('blank og/twitter titles fall back rather than emptying',
    !!(metaTag(bh, 'property', 'og:title') || '').trim() &&
    !!(metaTag(bh, 'name', 'twitter:title') || '').trim(),
    [metaTag(bh, 'property', 'og:title'), metaTag(bh, 'name', 'twitter:title')]);
  check('the canonical and robots are still there and still valid',
    attrOf(bh, 'rel="canonical"', 'href') === 'https://' + A.out + '/' + SEOSLUG + '.html' &&
    metaTag(bh, 'name', 'robots') === 'index,follow');
  check('and no tag in the head was written with an empty value',
    !/\scontent=""/.test(bh.slice(0, bh.indexOf('</head>'))),
    (bh.slice(0, bh.indexOf('</head>')).match(/<meta[^>]*content=""[^>]*>/g) || []));

  /* 20. an image a crawler cannot fetch is not advertised as one */
  const drow = writeFullRow(path.join(ROWS, 'seo-data.json'), brandsDir, A.id,
    rowFor(A.id, MARK.a, { [SEOSLUG]: seoFixture({
      og: { title: 'T', description: 'D', image: 'data:image/png;base64,AAAA' },
      twitter: { title: '', description: '', image: 'blob:https://x/y' } }) }));
  const dd = build([A.id].concat(A.env, ['--row', rel(drow), '--out', path.join(WORK, 'seo-data')]));
  const dh = fs.readFileSync(path.join(WORK, 'seo-data', A.out, SEOSLUG + '.html'), 'utf8');
  check('a data: image builds without a tag rather than an unusable one',
    dd.ok && metaTag(dh, 'property', 'og:image') === null, metaTag(dh, 'property', 'og:image'));
  check('  and a blob: image likewise', metaTag(dh, 'name', 'twitter:image') === null);
  check('  with no data: or blob: URL in any tag the page emits',
    !/(?:content|href|src)="(?:data:|blob:)/.test(dh),
    (dh.match(/(?:content|href|src)="(?:data:|blob:)[^"]*/g) || []));
}

/* ====================================================================
   16. THE SAME FIXTURE, EVERY BRAND, ITS OWN SEO
   ==================================================================== */
console.log('\n===== ONE FIXTURE, THREE BRANDS, THREE SETS OF SEO =====');
{
  const brandsDir = path.join(ROOT, 'brands');
  /* A third brand that exists only as a directory. */
  const troot = mktmp('seo-third');
  const tbrands = path.join(troot, 'brands');
  fs.cpSync(path.join(__dirname, 'fixtures', 'brands'), tbrands, { recursive: true });
  const tid = fs.readdirSync(tbrands, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort()[0];
  {
    const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'seo-config.json'), 'utf8'));
    seo.seo = seo.seo || {};
    seo.seo.baseUrl = 'https://' + tid;
    seo.seo.siteName = 'Third';
    fs.writeFileSync(path.join(tbrands, tid, 'seo-config.json'), JSON.stringify(seo, null, 2) + '\n');
  }

  const targets = [
    { id: A.id, env: A.env, brands: brandsDir, out: A.out },
    { id: B.id, env: B.env, brands: brandsDir, out: B.out },
    { id: tid, env: [], brands: tbrands, out: tid }
  ];
  const seen = [];
  for (const t of targets) {
    const dir = mktmp('seo-brand');
    const row = writeFullRow(path.join(ROWS, 'seo-wl-' + t.out + '.json'), t.brands, t.id,
      Object.assign(rowFor2(t.brands, t.id), { [SEOSLUG]: seoFixture() }));
    const r = build([t.id, '--brands', rel(t.brands)].concat(t.env, ['--row', rel(row), '--out', dir]));
    check(t.id + ': builds the shared fixture page', r.ok, r.out.slice(-500));
    const f = path.join(dir, t.out, SEOSLUG + '.html');
    const h = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
    check(t.id + ':   its canonical is its OWN domain',
      attrOf(h, 'rel="canonical"', 'href') === 'https://' + t.out + '/' + SEOSLUG + '.html',
      attrOf(h, 'rel="canonical"', 'href'));
    check(t.id + ':   its title came from its own record',
      !!(titleOf(h) || '').trim(), titleOf(h));
    seen.push({ id: t.id, out: t.out, html: h, title: titleOf(h),
                canon: attrOf(h, 'rel="canonical"', 'href') });
  }
  check('no brand\'s page mentions another brand\'s domain',
    seen.every(s => seen.filter(o => o.out !== s.out).every(o => s.html.indexOf(o.out) === -1)),
    seen.map(s => s.out));
  check('every canonical is distinct', new Set(seen.map(s => s.canon)).size === seen.length,
    seen.map(s => s.canon));
  check('and no brand-specific code was needed for the third one',
    !walk(path.join(tbrands, tid)).some(f => /(cms|seo-files|cms-page|brandkit)\.(js|html)$/.test(f)),
    walk(path.join(tbrands, tid)));
}

/* ====================================================================
   17. DRAFT AND PUBLISHED
   --------------------------------------------------------------------
   A page record now says whether it is live. Three rules, and the
   asymmetry between them is the whole design: 'published' publishes,
   an ABSENT status publishes (every record written before this existed
   is a live page, and reading those as drafts would unpublish a brand's
   site), and ANYTHING ELSE does not -- 'draft', a typo, or a word a
   later admin writes that this build has never heard of. Wrongly hiding
   a page costs a missing page; wrongly showing one publishes something
   nobody approved.
   ==================================================================== */
console.log('\n===== A PAGE SAYS WHETHER IT IS PUBLISHED =====');
{
  const PB = require(path.join(ROOT, 'tools', 'lib', 'pbbake.js'));
  const SEOF = require(path.join(ROOT, 'js', 'seo-files.js'));

  /* The rule table, stated once and asserted directly. */
  [['published', 'published'], ['PUBLISHED', 'published'], ['  published  ', 'published'],
   ['', 'published'], [null, 'published'],
   ['draft', 'draft'], ['Draft', 'draft'], ['scheduled', 'draft'], ['archived', 'draft'],
   ['pending-review', 'draft'], [0, 'draft'], [true, 'draft']]
    .forEach(([given, want]) => check('status ' + JSON.stringify(given) + ' reads as ' + want,
      PB.pageStatus({ status: given }) === want, PB.pageStatus({ status: given })));
  check('a record with no status key at all reads as published',
    PB.pageStatus({}) === 'published');
  check('and "published" is the word the build compares against',
    PB.PAGE_PUBLISHED === 'published');

  const rec = { pages: {
    live: { url: 'live.html' },
    saysSo: { url: 'says-so.html', status: 'published' },
    drafted: { url: 'drafted.html', status: 'draft' },
    odd: { url: 'odd.html', status: 'in-review' }
  } };
  check('only the published pages come back for generating',
    Object.keys(PB.pagesFromRecord(rec)).sort().join(',') === 'live,saysSo');
  check('and the rest come back as drafts, with the status as written',
    PB.draftPagesFromRecord(rec).map(d => d.slug + ':' + d.status).join(',') ===
    'drafted:draft,odd:in-review',
    PB.draftPagesFromRecord(rec));

  /* The sitemap reaches the same answer on its own, which is what makes
     the admin's preview -- which has no build to ask -- truthful. */
  const audit = SEOF.sitemapAudit({ seo: { baseUrl: 'https://example.test' }, pages: rec.pages });
  check('the sitemap leaves a draft page out with no build involved',
    audit.included.map(r => r.file).sort().join(',') === 'live.html,says-so.html',
    audit.included.map(r => r.file));
  check('  saying which status kept it out',
    audit.excluded.some(x => x.key === 'drafted' && /status is "draft", not published/.test(x.why)) &&
    audit.excluded.some(x => x.key === 'odd' && /status is "in-review", not published/.test(x.why)),
    audit.excluded);
  check('  and a record with no status is untouched by any of it',
    SEOF.sitemapAudit({ seo: { baseUrl: 'https://example.test' },
      pages: { a: { url: 'a.html' } } }).included.length === 1);

  /* End to end, through the real CLI, for every brand. */
  const brandsDir = path.join(ROOT, 'brands');
  const troot = mktmp('life-third');
  const tbrands = path.join(troot, 'brands');
  fs.cpSync(path.join(__dirname, 'fixtures', 'brands'), tbrands, { recursive: true });
  const tid = fs.readdirSync(tbrands, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => e.name).sort()[0];
  {
    const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'seo-config.json'), 'utf8'));
    seo.seo = seo.seo || {};
    seo.seo.baseUrl = 'https://' + tid;
    fs.writeFileSync(path.join(tbrands, tid, 'seo-config.json'), JSON.stringify(seo, null, 2) + '\n');
  }

  const LIVE = 'lifecycle-live', DRAFT = 'lifecycle-draft', ODD = 'lifecycle-odd';
  const DTEXT = 'DRAFT CONTENT THAT MUST NEVER SHIP';
  for (const t of [{ id: A.id, env: A.env, brands: brandsDir, out: A.out },
                   { id: B.id, env: B.env, brands: brandsDir, out: B.out },
                   { id: tid, env: [], brands: tbrands, out: tid }]) {
    const dir = mktmp('life');
    const pages = Object.assign(rowFor2(t.brands, t.id), {
      [LIVE]: cmsPage(LIVE, 'LIVE PAGE CONTENT', { status: 'published',
        builder: { status: 'published', schemaVersion: 2, updatedAt: '2026-10-01',
                   sections: sections('PUBLISHED SECTION IN A LIVE PAGE') } }),
      [DRAFT]: cmsPage(DRAFT, DTEXT, { status: 'draft',
        builder: { status: 'published', schemaVersion: 2, updatedAt: '2026-10-01',
                   sections: sections(DTEXT + ' SECTION') } }),
      [ODD]: cmsPage(ODD, DTEXT + ' ODD', { status: 'awaiting-legal' })
    });
    const row = writeFullRow(path.join(ROWS, 'life-' + t.out + '.json'), t.brands, t.id, pages);
    const r = build([t.id, '--brands', rel(t.brands)].concat(t.env, ['--row', rel(row), '--out', dir]));
    check(t.id + ': builds with a published, a draft and an unknown-status page', r.ok,
      r.out.slice(-600));
    const site = path.join(dir, t.out);
    const files = walk(site);

    check(t.id + ':   the published page is generated', files.indexOf(LIVE + '.html') > -1, files);
    check(t.id + ':   the draft page is NOT', files.indexOf(DRAFT + '.html') === -1, files);
    check(t.id + ':   nor is the unknown-status page', files.indexOf(ODD + '.html') === -1, files);
    check(t.id + ':   no draft content reaches any generated file',
      !files.filter(f => /\.(html|xml|txt)$/.test(f))
        .some(f => fs.readFileSync(path.join(site, f), 'utf8').indexOf(DTEXT) > -1));
    check(t.id + ':   while the published page does carry its own',
      fs.readFileSync(path.join(site, LIVE + '.html'), 'utf8')
        .indexOf('PUBLISHED SECTION IN A LIVE PAGE') > -1);
    check(t.id + ':   and the build names what it did not publish',
      new RegExp('Drafts\\s*:[^\\n]*"' + DRAFT + '"').test(r.out) &&
      new RegExp('Drafts\\s*:[^\\n]*awaiting-legal').test(r.out),
      (r.out.match(/Drafts.*/) || [''])[0]);

    const smap = path.join(site, 'sitemap.xml');
    if (fs.existsSync(smap)) {
      const xml = fs.readFileSync(smap, 'utf8');
      check(t.id + ':   the published page is in the sitemap', xml.indexOf(LIVE + '.html') > -1);
      check(t.id + ':   the draft and unknown pages are not',
        xml.indexOf(DRAFT) === -1 && xml.indexOf(ODD) === -1);
    } else {
      check(t.id + ':   a noindex host still publishes no sitemap at all', true);
    }
    /* The baked SEO a published generic page gets, on its own domain. */
    const lh = fs.readFileSync(path.join(site, LIVE + '.html'), 'utf8');
    check(t.id + ':   the published page has its SEO baked, on its own domain',
      lh.indexOf('rel="canonical" href="https://' + t.out + '/' + LIVE + '.html"') > -1, t.out);
  }

  /* A draft record for a page a committed template publishes changes
     nothing -- and is said out loud, because believing otherwise means
     believing a public page is hidden. */
  const committed = fs.readdirSync(path.join(ROOT, 'templates', 'pages'))
    .filter(f => /^[a-z0-9][a-z0-9-]*\.html$/.test(f)).sort()[0];
  const ckey = committed.replace(/\.html$/, '');
  const cpages = rowFor2(brandsDir, A.id);
  cpages[ckey] = Object.assign({}, cpages[ckey] || {},
    { url: committed, status: 'draft', title: 'SHOULD STILL SHIP' });
  const crow = writeFullRow(path.join(ROWS, 'life-committed.json'), brandsDir, A.id, cpages);
  const cdir = mktmp('life-committed');
  const cr = build([A.id].concat(A.env, ['--row', rel(crow), '--out', cdir]));
  check('marking a committed page draft does not remove it', cr.ok &&
    fs.existsSync(path.join(cdir, A.out, committed)), cr.out.slice(-400));
  check('  and the build warns that the status does not hide it',
    new RegExp('::warning::CMS page "' + ckey + '" has status "draft"').test(cr.out) &&
    /is a committed page and still publishes/.test(cr.out),
    (cr.out.match(/::warning::CMS page.*/) || [''])[0]);

  /* No brand, domain or slug in the lifecycle itself. */
  const codeOf = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  ['tools/lib/pbbake.js', 'js/seo-files.js'].forEach(f =>
    check(f + ': the lifecycle names no brand, domain or slug',
      !/jsk-?1|playzone|[a-z0-9-]+\.(?:com|app)\b/i.test(codeOf(f)),
      (codeOf(f).match(/jsk-?1|playzone|[a-z0-9-]+\.(?:com|app)\b/i) || [])[0]));
  check('the admin writes an explicit status when it creates a page',
    /status: 'published'/.test(fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8')));
  check('  and offers the switch only for pages the CMS created',
    /if \(!\(CMS\.DEFAULTS\.pages \|\| \{\}\)\[key\]\) head\.appendChild\(pageStatusField\(page\)\)/
      .test(fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8')));
}

/* ====================================================================
   18. THE DEPLOYED SITE IS CHECKED, NOT ASSUMED
   --------------------------------------------------------------------
   One verifier, extended rather than duplicated: it already compared the
   baked mounts in the served HTML with the artifact, and now compares the
   SEO, the sitemap and robots.txt the same way. The ARTIFACT is the
   expectation, so nothing in it knows a brand, a domain, a page or an SEO
   value -- which is also why every assertion below is made about whichever
   brand is being built.

   --served reads the "response" from a directory, so these run offline and
   execute no JavaScript, which is the property being asserted.
   ==================================================================== */
console.log('\n===== THE DEPLOYED HTML, SEO AND SITEMAP ARE VERIFIED =====');
{
  const verify = args => {
    try {
      return { code: 0, out: execFileSync(process.execPath,
        [path.join(ROOT, 'tools', 'verify-deployed.js')].concat(args),
        { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
  };
  const kinds = out => [...new Set((out.match(/\[[a-z-]+\]/g) || []))].sort().join(',');

  /* A real site for each brand: one production host and one review host. */
  const brandsDir = path.join(ROOT, 'brands');
  const VSLUG = 'verify-fixture';
  function siteFor(t) {
    const dir = mktmp('verify');
    const pages = Object.assign(rowFor2(t.brands, t.id), {
      [VSLUG]: cmsPage(VSLUG, 'VERIFY FIXTURE', { status: 'published',
        og: { title: '', description: '', image: 'assets/images/ssl.png' },
        twitter: { title: '', description: '', image: '' },
        builder: { status: 'published', schemaVersion: 2, updatedAt: '2026-10-01',
                   sections: sections('VERIFY FIXTURE SECTION') } }) });
    const row = writeFullRow(path.join(ROWS, 'verify-' + t.out + '.json'), t.brands, t.id, pages);
    const r = build([t.id, '--brands', rel(t.brands)].concat(t.env, ['--row', rel(row), '--out', dir]));
    return { r: r, dir: path.join(dir, t.out), out: t.out };
  }

  const prod = siteFor({ id: A.id, env: A.env, brands: brandsDir, out: A.out });
  const review = siteFor({ id: B.id, env: B.env, brands: brandsDir, out: B.out });
  check('a production site and a review site both build', prod.r.ok && review.r.ok,
    [prod.r.out.slice(-200), review.r.out.slice(-200)]);

  /* ---- the deployment that is correct ---- */
  const okP = verify(['--site', prod.dir, '--served', prod.dir]);
  check('a site serving what was built passes', okP.code === 0, okP.out.slice(-400));
  check('  having checked every page, not only the ones with baked content',
    /Checked\s*:\s*(\d+)\/\1 page\(s\)/.test(okP.out), (okP.out.match(/Checked.*/) || [''])[0]);
  check('  and a real number of SEO values, not zero',
    parseInt((okP.out.match(/Checked\s*:[^\n]*?(\d+) SEO value\(s\)/) || [, '0'])[1], 10) > 20,
    (okP.out.match(/Checked.*/) || [''])[0]);
  check('  the sitemap: every URL served and every URL a built page',
    /sitemap\.xml\s+\d+ URL\(s\), each served and each a built page/.test(okP.out));
  check('  robots.txt compared too', /robots\.txt\s+matches the artifact/.test(okP.out));
  check('  and it says no JavaScript was executed',
    /No JavaScript was executed/.test(okP.out));

  const okR = verify(['--site', review.dir, '--served', review.dir]);
  check('a review host serving what was built passes', okR.code === 0, okR.out.slice(-400));
  check('  recognising that it blocks everything', /blocks everything -- a review host/.test(okR.out));
  check('  and that publishing no sitemap is the point',
    /absent from the artifact and not served/.test(okR.out));

  /* ---- each failure state, told apart ---- */
  const tamper = (from, fn) => {
    const d = path.join(mktmp('served'), 'srv');
    fs.cpSync(from, d, { recursive: true });
    fn(d);
    return d;
  };
  const rw = (f, a, b) => fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(a, b));

  const stale = verify(['--site', prod.dir, '--attempts', '1', '--served',
    tamper(prod.dir, d => rw(path.join(d, VSLUG + '.html'),
      /<title([^>]*)>[^<]*/, '<title$1>A TITLE FROM AN EARLIER BUILD'))]);
  check('a served page whose SEO is from an earlier build is STALE',
    stale.code === 1 && kinds(stale.out) === '[stale]', [stale.code, kinds(stale.out)]);
  check('  naming the field, with both values', /\[stale\].*<title>: built .*, served /.test(stale.out),
    (stale.out.match(/\[stale\].*/) || [''])[0]);

  const gone = verify(['--site', prod.dir, '--attempts', '1', '--served',
    tamper(prod.dir, d => fs.rmSync(path.join(d, 'login.html')))]);
  check('a generated page that is not served is MISSING-HTML',
    gone.code === 2 && kinds(gone.out) === '[missing-html]', [gone.code, kinds(gone.out)]);
  check('  and that is "could not check", not "wrong"', gone.code === 2);

  const noSeo = verify(['--site', prod.dir, '--attempts', '1', '--served',
    tamper(prod.dir, d => rw(path.join(d, VSLUG + '.html'), /<link rel="canonical"[^>]*>/, ''))]);
  check('a served page missing a tag the artifact has is MISSING-SEO',
    noSeo.code === 1 && /\[missing-seo\]/.test(noSeo.out), [noSeo.code, kinds(noSeo.out)]);
  check('  naming which tag', /\[missing-seo\].*canonical is not in the served page/.test(noSeo.out));

  const other = verify(['--site', prod.dir, '--attempts', '1', '--served',
    tamper(prod.dir, d => rw(path.join(d, VSLUG + '.html'),
      /rel="canonical" href="https:\/\/[^/]+\//, 'rel="canonical" href="https://not-this-brand.test/'))]);
  check('a URL pointing at another host is CROSS-HOST',
    other.code === 1 && /\[cross-host\]/.test(other.out), [other.code, kinds(other.out)]);
  check('  naming the host it found and the one it expected',
    /\[cross-host\].*points at not-this-brand\.test, not /.test(other.out),
    (other.out.match(/\[cross-host\].*/) || [''])[0]);

  const smap = verify(['--site', prod.dir, '--attempts', '1', '--served',
    tamper(prod.dir, d => rw(path.join(d, 'sitemap.xml'), '</urlset>',
      '  <url><loc>https://' + A.out + '/not-generated.html</loc></url>\n</urlset>'))]);
  check('a sitemap that differs from the built one is a SITEMAP-MISMATCH',
    smap.code === 1 && /\[sitemap-mismatch\]/.test(smap.out), [smap.code, kinds(smap.out)]);

  const leak = verify(['--site', review.dir, '--attempts', '1', '--served',
    tamper(review.dir, d => fs.writeFileSync(path.join(d, 'sitemap.xml'),
      '<?xml version="1.0"?><urlset></urlset>'))]);
  check('a review host serving a sitemap it should not is a NOINDEX-LEAK',
    leak.code === 1 && /\[noindex-leak\]/.test(leak.out), [leak.code, kinds(leak.out)]);

  const indexable = verify(['--site', review.dir, '--attempts', '1', '--served',
    tamper(review.dir, d => rw(path.join(d, VSLUG + '.html'),
      /content="noindex,nofollow"/, 'content="index,follow"'))]);
  check('a review page served as indexable is a NOINDEX-LEAK too',
    indexable.code === 1 && /\[noindex-leak\]/.test(indexable.out),
    [indexable.code, kinds(indexable.out)]);

  check('the summary counts the kinds it found',
    /problem\(s\) with the deployed site: [a-z-]+ x\d+/.test(stale.out),
    (stale.out.match(/problem\(s\) with.*/) || [''])[0]);

  /* ---- brand-agnostic, and wired into the deploys ---- */
  const tool = fs.readFileSync(path.join(ROOT, 'tools', 'verify-deployed.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  check('the verifier hard-codes no brand, domain, page or SEO value',
    !/jsk-?1|playzone|[a-z0-9-]+\.(?:com|app)\b/i.test(tool),
    (tool.match(/jsk-?1|playzone|[a-z0-9-]+\.(?:com|app)\b/i) || [])[0]);
  check('  and no production URL of its own: the caller supplies it',
    /opt\('--url'/.test(tool) && !/https?:\/\/[a-z0-9-]+\./i.test(tool));
  {
    const wf = d => fs.readFileSync(path.join(ROOT, '.github', 'workflows', d), 'utf8')
      .split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
    const prodWf = wf('static.yml'), pzWf = wf('deploy-playzone9.yml');
    check('the production deploy verifies the URL it deployed to',
      /verify-deployed\.js/.test(prodWf) &&
      /--url "\$\{\{ steps\.deployment\.outputs\.page_url \}\}"/.test(prodWf));
    check('the other deploy verifies too, when an address is configured',
      /verify-deployed\.js/.test(pzWf) && /vars\.PLAYZONE9_VERIFY_URL != ''/.test(pzWf));
    check('  through a variable, not a secret, and never printed',
      !/secrets\.PLAYZONE9_VERIFY/.test(pzWf) && !/echo[^\n]*VERIFY_URL/.test(pzWf));
    check('there is exactly one verifier, not two',
      (prodWf.match(/verify-deployed\.js/g) || []).length === 1 &&
      (pzWf.match(/verify-deployed\.js/g) || []).length === 1 &&
      !fs.readdirSync(path.join(ROOT, 'tools')).some(f => /verify.*deploy/.test(f) && f !== 'verify-deployed.js'));
    /* Every trigger Step 2 added, and the deploys' separation, still there. */
    ['push:', 'repository_dispatch:', 'schedule:', 'workflow_dispatch:'].forEach(t => {
      check('static.yml still has ' + t, prodWf.indexOf(t) > -1);
      check('deploy-playzone9.yml still has ' + t, pzWf.indexOf(t) > -1);
    });
    check('and neither deploy gained a permission',
      /permissions:\s*\n\s*contents: read\s*\n\s*pages: write\s*\n\s*id-token: write/.test(prodWf) &&
      /permissions:\s*\n\s*contents: read\s*\n/.test(pzWf));
  }
}

/* ====================================================================
   19. THE DOCUMENTATION AND THE ADMIN SAY WHAT IS TRUE
   --------------------------------------------------------------------
   Every statement asserted here was true once and is not any more. A
   doc that describes a workflow nobody follows is worse than no doc:
   somebody will follow it.
   ==================================================================== */
console.log('\n===== NOTHING STILL DESCRIBES THE OLD WORKFLOW =====');
{
  const readIf = f => fs.existsSync(path.join(ROOT, f))
    ? fs.readFileSync(path.join(ROOT, f), 'utf8') : '';
  const prose = ['docs/publishing.md', 'docs/seo-publishing.md', 'docs/page-builder.md',
                 'docs/multi-brand.md', 'admin/index.html'];

  /* The sentence the whole of Step 3 removed. */
  const deadEnds = [
    /Download the HTML file and add it to the site/i,
    /hands you the finished file to add/i,
    /Saving in \/admin does not start one/i,
    /A deploy has to happen\./
  ];
  prose.concat(['js/admin.js', 'tools/build-seo-files.js']).forEach(f => {
    const t = readIf(f);
    deadEnds.forEach((re, i) => check(f + ': no longer says #' + (i + 1) + ' ' + re.source.slice(0, 40),
      !re.test(t.replace(/No longer "download this and add it to the site"[\s\S]{0,400}?\*\//, ''))));
  });

  const pub = readIf('docs/publishing.md');
  check('publishing.md documents the page a CMS creates', /## A page the CMS creates/.test(pub));
  check('  the chain it goes through, end to end',
    /templates\/cms-page\.html/.test(pub) && /sitemap\.xml lists it/.test(pub) &&
    /the deployed HTTP response is verified/.test(pub), 'chain');
  check('  the draft/published rules, all three of them',
    /\| `published` \|/.test(pub) && /absent or empty/.test(pub) &&
    /anything else/.test(pub), 'lifecycle table');
  check('  which SEO fields are baked',
    ['<title>', 'canonical', 'og:image', 'twitter:image', 'WebPage JSON-LD',
     'BreadcrumbList JSON-LD'].every(k => pub.indexOf(k) > -1), 'fields');
  check('  that a blank value never empties a tag', /never empties a tag/.test(pub));
  check('  that a review copy canonicalises to itself',
    /canonicalises to itself/.test(pub));
  check('  the refusals, by name',
    /must not overwrite a committed page/.test(pub) && /reserved name/.test(pub), 'refusals');
  check('  and every failure kind the verifier reports',
    ['unreachable', 'missing-html', 'stale', 'missing-seo', 'cross-host',
     'sitemap-mismatch', 'noindex-leak'].every(k => pub.indexOf('`' + k + '`') > -1 ||
       pub.indexOf(k + '`') > -1), 'kinds');
  check('  and no longer claims the fallback layer must be exported by hand',
    !/publish → \*Download brand defaults\* → commit → deploy/.test(pub));
  check('  while still naming the one gap that is real',
    /Committed page templates carry their own static SEO/.test(pub));

  const seo = readIf('docs/seo-publishing.md');
  check('seo-publishing.md documents what starts a deploy',
    /## What starts a deploy/.test(seo) &&
    /repository_dispatch/.test(seo) && /schedule/.test(seo), 'triggers');

  const adm = readIf('admin/index.html');
  check('the admin tells an author what creating a page now does',
    /the next deploy generates/.test(adm) && /sitemap\.xml/.test(adm) &&
    /published or still a draft/.test(adm), 'card copy');

  /* And the docs name no brand, because the platform is not one brand's. */
  check('publishing.md explains the mechanism without naming a brand as the rule',
    !/only works for JSK1|specific to JSK1|only for Playzone9/i.test(pub));
}

tmpRoots.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

console.log(`\n==== ${pass} passed, ${fail} failed ====`);
if (fails.length) console.log('FAILED:', fails.join(' | '));
process.exit(fail ? 1 : 0);
