/* =====================================================================
   SITEMAP + ROBOTS: ONE GENERATOR, HONEST PUBLISHING
   ---------------------------------------------------------------------
   Browser JavaScript cannot write a file into a deployed static site.
   The architecture here accepts that instead of working around it: the
   admin publishes settings, and the GitHub Pages deploy runs
   tools/build-seo-files.js to write the two files into the artifact.

   What is asserted:
     - one generator serves both the deploy and the admin preview;
     - its output is deterministic and excludes what must be excluded;
     - admin-supplied robots rules cannot smuggle a directive in;
     - the deploy job gained no new permission and no new secret;
     - the admin reports what is LIVE honestly, including failure.
   ===================================================================== */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const ROOT = path.resolve(__dirname, '..');
const SITE = require(path.join(ROOT, 'tools', 'lib', 'sitekit.js'));
const SEOFiles = require(path.join(ROOT, 'js', 'seo-files.js'));
const BASE = 'http://localhost:8777';

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const locs = xml => (xml.match(/<loc>([^<]*)<\/loc>/g) || []).map(x => x.replace(/<\/?loc>/g, ''));
const directives = txt => txt.split(/\r?\n/).map(l => l.trim()).filter(l => l && l[0] !== '#');

const RECORD = {
  seo: { baseUrl: 'https://example.test', robotsExtra: '' },
  pages: {
    home:     { url: '',            updatedAt: '2026-01-01' },
    login:    { url: 'login.html',  robots: { index: false } },
    register: { url: 'register.html', robots: { index: false } },
    about:    { url: 'about.html',  updatedAt: '2026-02-02' },
    hidden:   { url: 'hidden.html', updatedAt: '2026-02-02', inSitemap: false },
    zebra:    { url: 'zebra.html',  updatedAt: '2026-03-03' }
  }
};

(async () => {

  /* ==================================================================
     1. THE GENERATOR
     ================================================================== */
  console.log('\n===== ONE GENERATOR, DETERMINISTIC OUTPUT =====');
  {
    const xml = SEOFiles.sitemap(RECORD);
    const got = locs(xml);
    check('the homepage comes first', got[0] === 'https://example.test/', got);
    check('indexable pages are listed', got.includes('https://example.test/about.html') &&
      got.includes('https://example.test/zebra.html'), got);
    check('noindex pages are absent', !got.some(u => /login|register/.test(u)), got);
    check('a page excluded from the sitemap is absent', !got.some(u => /hidden/.test(u)), got);
    /* Asserted against the URLs, not the whole file: the generated comment
       legitimately contains the sentence "/admin/ are absent by
       construction", and a crawler reads <loc>, not the comment. */
    check('no admin URL appears', !got.some(u => /\/admin/.test(u)), got);
    check('no URL appears twice', new Set(got).size === got.length, got);
    check('lastmod is carried through', /<lastmod>2026-02-02<\/lastmod>/.test(xml));

    /* determinism: key order must not change the file */
    const shuffled = { seo: RECORD.seo, pages: {} };
    Object.keys(RECORD.pages).reverse().forEach(k => { shuffled.pages[k] = RECORD.pages[k]; });
    check('a record with the same pages in a different key order gives the same file',
      SEOFiles.sitemap(shuffled) === xml);
    check('running it twice gives the same file', SEOFiles.sitemap(RECORD) === xml);

    check('a page whose url is not a plain .html file is refused',
      !locs(SEOFiles.sitemap({ seo: RECORD.seo, pages: { x: { url: '../../etc/passwd' }, y: { url: 'https://evil.test/x.html' } } }))
        .some(u => /passwd|evil/.test(u)));
    check('a lastmod that is not a date is dropped rather than published',
      !/<lastmod>/.test(SEOFiles.sitemap({ seo: RECORD.seo, pages: { a: { url: 'a.html', updatedAt: 'yesterday' } } })));

    check('no base URL means no sitemap at all, rather than a broken one',
      SEOFiles.sitemap({ seo: { baseUrl: '' }, pages: RECORD.pages }) === null);
    check('a javascript: base URL is refused',
      SEOFiles.sitemap({ seo: { baseUrl: 'javascript:alert(1)' }, pages: RECORD.pages }) === null);
    /* Nothing carrying an XML metacharacter can reach <loc> at all: the
       base URL is refused outright and a page file name is refused unless
       it is [a-z0-9-]+.html. That is the control -- escaping downstream is
       belt and braces, and is documented as unreachable in the source. */
    check('a base URL carrying XML metacharacters is refused outright',
      SEOFiles.sitemap({ seo: { baseUrl: 'https://a.test/"><x' }, pages: { a: { url: 'a.html' } } }) === null);
    check('a page file name carrying XML metacharacters never reaches <loc>',
      locs(SEOFiles.sitemap({ seo: RECORD.seo, pages: { a: { url: 'a"><b.html' }, b: { url: '<x>.html' } } })).length === 0);

    /* Two page keys, one URL: the sitemap must list it once. */
    check('the same URL under two page keys is listed once',
      locs(SEOFiles.sitemap({ seo: RECORD.seo,
        pages: { a: { url: 'about.html', updatedAt: '2026-01-01' },
                 b: { url: 'about.html', updatedAt: '2026-05-05' } } })).length === 1);
  }

  console.log('\n===== ROBOTS RULES ARE FILTERED, NOT PASTED =====');
  {
    const txt = SEOFiles.robots(RECORD);
    check('Disallow: /admin/ is always present', /^Disallow: \/admin\/$/m.test(txt));
    check('the sitemap is declared', txt.includes('Sitemap: https://example.test/sitemap.xml'));

    const hostile = {
      seo: {
        baseUrl: 'https://example.test',
        robotsExtra: [
          'Disallow: /private/',
          'Nonsense: whatever',
          'evil',
          'Allow: /  # and now everything is crawlable again',
          'Disallow: /a\u0000/b',
          '# a real comment',
          'User-agent: *'
        ].join('\n')
      },
      pages: RECORD.pages
    };
    const h = SEOFiles.robots(hostile);
    const d = directives(h);
    check('a valid extra rule is kept', d.includes('Disallow: /private/'), d);
    check('an unknown directive is dropped', !/Nonsense/.test(h), d);
    check('a line that is not a directive at all is dropped', !/^evil$/m.test(h), d);
    check('a trailing comment cannot be smuggled into a value',
      !d.some(l => l.indexOf('#') > -1), d);
    check('control characters are stripped from values',
      !/\u0000/.test(h));
    check('the extra rules cannot exceed a bounded number of lines',
      SEOFiles.robotsExtra({ seo: { robotsExtra: Array.from({ length: 200 }, (_, i) => 'Disallow: /p' + i + '/').join('\n') } }).length <= 40);
    check('no base URL means no robots.txt either',
      SEOFiles.robots({ seo: { baseUrl: '' } }) === null);
  }

  /* ==================================================================
     2. THE DEPLOY-TIME TOOL AND THE WORKFLOW
     ================================================================== */
  console.log('\n===== THE DEPLOY WRITES THE FILES =====');
  {
    const out = execFileSync('node', [path.join(ROOT, 'tools', 'build-seo-files.js'), '--check'],
                             { cwd: ROOT, encoding: 'utf8' });
    check('the generator runs under plain node with no dependencies', /Sitemap: \d+ URL\(s\)/.test(out), out.slice(0, 200));
    check('and reports where its settings came from', /^Source:\s+\S/m.test(out), out.slice(0, 200));
    check('--check writes nothing', /nothing written/i.test(out));

    const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'static.yml'), 'utf8');
    /* The workflow no longer calls this generator directly. It assembles the
       site, and tools/lib/sitekit.js runs the generator as part of that. The
       claim is the same one it always was -- sitemap.xml and robots.txt are
       WRITTEN at deploy time, never hand-edited and never committed stale --
       so it is asserted where the call now lives. The old ordering check
       compared indexOf('build-seo-files.js') against the upload, which would
       now be -1 and pass while proving nothing; it is pinned to a string the
       workflow actually contains. */
    check('the deploy assembles the site', /run: node tools\/build-site\.js/.test(wf), wf.match(/run: [^\n]*/g));
    check('and the assembler runs this generator',
      /build-seo-files\.js/.test(fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'sitekit.js'), 'utf8')));
    check('before the artifact is uploaded',
      wf.indexOf('build-site.js') > -1 &&
      wf.indexOf('build-site.js') < wf.indexOf('upload-pages-artifact'),
      [wf.indexOf('build-site.js'), wf.indexOf('upload-pages-artifact')]);
    check('the job still cannot write to the repository', /contents: read/.test(wf) && !/contents: write/.test(wf));
    check('no secret was added to the workflow', !/\$\{\{\s*secrets\./.test(wf));
    check('no personal access token appears anywhere in the front end',
      !/ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/.test(
        ['js/cms.js', 'js/admin.js', 'js/admin-media.js', 'js/seo-files.js', 'js/cms-config.js']
          .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')));
    /* Looks for a service-role KEY, not for the words "service_role".

       The original substring test was a proxy, and the proxy broke as soon
       as js/cms.js grew a guard that REFUSES a service-role key -- code
       that has to name the thing it is blocking. Same intent, asserted
       against the two shapes such a key can actually take: an sb_secret_
       string, or a JWT literal whose payload decodes to that role. This
       catches a real key however it is spelled, and does not fire on prose
       or on the guard itself. */
    const frontEnd = ['js/cms.js', 'js/cms-config.js', 'js/admin.js', 'js/admin-media.js', 'js/seo-files.js']
      .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

    const jwtLiterals = frontEnd.match(/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]+/g) || [];
    const privileged = jwtLiterals.filter(t => {
      try { return /"role"\s*:\s*"(service_role|supabase_admin)"/.test(
        Buffer.from(t.split('.')[1], 'base64').toString('utf8')); } catch (e) { return false; }
    });
    check('no service-role JWT is hard-coded in front-end code', privileged.length === 0,
      privileged.map(t => t.slice(0, 24) + '…'));
    check('no sb_secret_ key is hard-coded in front-end code',
      !/sb_secret_[A-Za-z0-9_-]{8,}/.test(frontEnd));
    check('and the only key the config ships is a publishable one',
      /anonKey:\s*'sb_publishable_[A-Za-z0-9_-]+'/.test(
        fs.readFileSync(path.join(ROOT, 'js', 'cms-config.js'), 'utf8')));

    /* the committed files are what the generator produces */
    const committed = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    check('the committed sitemap still lists exactly the five public pages',
      locs(committed).length === 5 && locs(committed).includes('https://jsk-1.com/privacy-policy.html'), locs(committed));
    check('the committed robots.txt still disallows /admin/',
      /^Disallow: \/admin\/$/m.test(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8')));
    check('and still declares the sitemap',
      /^Sitemap: https:\/\/jsk-1\.com\/sitemap\.xml$/m.test(fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8')));
  }

  /* ==================================================================
     3. THE ADMIN TELLS THE TRUTH ABOUT WHAT IS LIVE
     ================================================================== */
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  async function admin(liveSitemap, liveRobots) {
    const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
    await ctx.route('**supabase.co/**', r => {
      const q = r.request();
      if (q.url().includes('/auth/v1/token'))
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'stub' }) });
      if (q.method() === 'POST') return r.fulfill({ status: 201, body: '' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    if (liveSitemap !== undefined) {
      await ctx.route('**/sitemap.xml*', r => liveSitemap === null
        ? r.fulfill({ status: 404, body: 'not found' })
        : r.fulfill({ status: 200, contentType: 'application/xml', body: liveSitemap }));
    }
    if (liveRobots !== undefined) {
      await ctx.route('**/robots.txt*', r => r.fulfill({ status: 200, contentType: 'text/plain', body: liveRobots }));
    }
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('PAGEERROR ' + e));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(300);
    return { ctx, p, errs };
  }

  console.log('\n===== THE ADMIN PREVIEW IS THE DEPLOY’S OWN OUTPUT =====');
  {
    const { ctx, p, errs } = await admin();
    await p.click('#seoTabs .pagetab >> nth=4'); await p.waitForTimeout(300);
    const shown = await p.$eval('#seoSitemapOut', e => e.textContent);
    const fromNode = await p.evaluate(() => window.SEOFiles.sitemap(window.CMS.data()));
    check('the admin preview comes from js/seo-files.js, not a copy of it', shown === fromNode);
    check('and it is the same module the deploy tool requires',
      (await p.evaluate(() => window.SEOFiles.version)) === SEOFiles.version);
    check('the sitemap still has 5 URLs', locs(shown).length === 5, locs(shown));
    check('and still excludes the sign-in pages', !/login|register/.test(shown));
    check('the publishing card explains what still needs a developer',
      /Run workflow|deployment/i.test(await p.$eval('#seoPub-sitemap', e => e.textContent)));
    check('and says plainly that the browser cannot start it',
      /cannot start it|repository write token/i.test(await p.$eval('#seoPub-sitemap', e => e.textContent)));
    check('no console errors in the SEO panel', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== LIVE VS PENDING =====');
  {
    /* the live file already matches the settings */
    const current = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
    const { ctx, p, errs } = await admin(current);
    await p.click('#seoTabs .pagetab >> nth=4'); await p.waitForTimeout(250);
    await p.click('[data-seocheck="sitemap"]'); await p.waitForTimeout(700);
    const txt = await p.$eval('#seoPubState-sitemap', e => e.textContent);
    check('a matching live file is reported as up to date', /matches these settings/i.test(txt), txt.slice(0, 260));
    check('and the provenance of the live file is shown', /built from/i.test(txt), txt.slice(0, 260));
    check('no console errors checking the live file', errs.length === 0, errs);
    await ctx.close();
  }
  {
    /* the live file is a deploy behind */
    const stale = '<?xml version="1.0" encoding="UTF-8"?>\n<!-- source: old -->\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>https://jsk-1.com/</loc><lastmod>2020-01-01</lastmod></url>\n' +
      '  <url><loc>https://jsk-1.com/retired.html</loc></url>\n' +
      '</urlset>\n';
    const { ctx, p, errs } = await admin(stale);
    await p.click('#seoTabs .pagetab >> nth=4'); await p.waitForTimeout(250);
    await p.click('[data-seocheck="sitemap"]'); await p.waitForTimeout(700);
    const txt = await p.$eval('#seoPubState-sitemap', e => e.textContent);
    check('pending changes are counted, not hidden', /change\(s\) are waiting/i.test(txt), txt.slice(0, 300));
    check('pages that will be added are named', /about\.html/.test(txt), txt.slice(0, 500));
    check('pages that will be removed are named', /retired\.html/.test(txt), txt.slice(0, 600));
    check('a changed last-modified date is reported', /2020-01-01/.test(txt), txt.slice(0, 600));
    check('no console errors on a stale live file', errs.length === 0, errs);
    await ctx.close();
  }
  {
    /* the live file cannot be read at all */
    const { ctx, p, errs } = await admin(null);
    await p.click('#seoTabs .pagetab >> nth=4'); await p.waitForTimeout(250);
    await p.click('[data-seocheck="sitemap"]'); await p.waitForTimeout(700);
    const txt = await p.$eval('#seoPubState-sitemap', e => e.textContent);
    check('a failure to read the live file is reported as a failure',
      /Could not read/i.test(txt) && /404/.test(txt), txt.slice(0, 260));
    check('and it explicitly refuses to imply the file is fine',
      /do not assume/i.test(txt), txt.slice(0, 300));
    check('no console errors on a failed check', errs.length === 0, errs);
    await ctx.close();
  }
  {
    /* robots: /admin/ missing from the published file is called out */
    const { ctx, p, errs } = await admin(undefined, 'User-agent: *\nAllow: /\n');
    await p.click('#seoTabs .pagetab >> nth=5'); await p.waitForTimeout(250);
    await p.click('[data-seocheck="robots"]'); await p.waitForTimeout(700);
    const txt = await p.$eval('#seoPubState-robots', e => e.textContent);
    check('a published robots.txt missing Disallow: /admin/ is flagged',
      /is NOT in the published file/i.test(txt), txt.slice(0, 300));
    check('and the missing directive is listed as pending', /Disallow: \/admin\//.test(txt), txt.slice(0, 500));
    check('no console errors on the robots check', errs.length === 0, errs);
    await ctx.close();
  }

  /* ==================================================================
     SITEMAP INTEGRITY — ONLY URLS THE BUILD ACTUALLY GENERATED
     ------------------------------------------------------------------
     A sitemap exists to invite a crawl, so every URL in it has to be a
     URL that answers. A CMS page record can say inSitemap: true while no
     static file for it was generated -- the record is data, the file is a
     build artifact, and nothing made them agree. /admin has had a
     "create page" button for a long time that writes exactly such a
     record, so this was reachable in production, not hypothetical.

     Nothing here names a real brand: the library half uses invented
     records, and the build half asserts each brand against ITS OWN
     resolved domain and output, so it holds for any brand.
     ================================================================== */
  console.log('\n===== A SITEMAP NEVER ADVERTISES A PAGE THAT WAS NOT BUILT =====');

  const tmps = [];
  const mktmp = tag => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-' + tag + '-')); tmps.push(d); return d; };
  const files = dir => fs.readdirSync(dir, { withFileTypes: true })
    .filter(e => e.isFile() && /\.html$/i.test(e.name)).map(e => e.name).sort();

  /* ---------- the library ---------- */
  {
    const REC2 = {
      seo: { baseUrl: 'https://example.test' },
      pages: {
        home:   { url: '',          updatedAt: '2026-01-01' },
        real:   { url: 'real.html', updatedAt: '2026-01-02' },
        ghost:  { url: 'ghost.html', updatedAt: '2026-01-03' },      /* published, never generated */
        hidden: { url: 'hidden.html', inSitemap: false },
        noidx:  { url: 'noidx.html', robots: { index: false } }
      }
    };
    const GENERATED = ['index.html', 'real.html', 'hidden.html', 'noidx.html'];
    const a = SEOFiles.sitemapAudit(REC2, { generated: GENERATED });
    const inc = a.included.map(r => r.file);
    const why = k => (a.excluded.filter(x => x.key === k)[0] || {}).why || '';

    check('a generated page asking to be in the sitemap is in it', inc.indexOf('real.html') > -1, inc);
    check('a published page with no generated file is NOT', inc.indexOf('ghost.html') === -1, inc);
    check('  and the exclusion says why, naming the page and the file',
      /generated no static file/.test(why('ghost')) &&
      a.excluded.some(x => x.key === 'ghost' && x.file === 'ghost.html'), a.excluded);
    check('inSitemap: false is still excluded, for its own reason',
      inc.indexOf('hidden.html') === -1 && /inSitemap is false/.test(why('hidden')));
    check('robots.index: false is still excluded, for its own reason',
      inc.indexOf('noidx.html') === -1 && /noindex/.test(why('noidx')));
    check('the homepage matches index.html rather than an empty file name',
      inc.indexOf('') > -1, inc);
    check('  and is excluded when index.html was not generated',
      SEOFiles.sitemapPages(REC2, { generated: ['real.html'] }).every(r => r.file !== ''));

    /* The rule that keeps every existing caller working: the admin preview
       has no build and must not be told pages are missing. */
    const unfiltered = SEOFiles.sitemapAudit(REC2);
    check('with no generated list nothing is filtered at all',
      unfiltered.filtered === false &&
      unfiltered.included.map(r => r.file).join(',') === ['', 'ghost.html', 'real.html'].join(','),
      unfiltered.included.map(r => r.file));
    check('sitemap() without opts is byte-identical to before this change',
      SEOFiles.sitemap(REC2) === SEOFiles.sitemap(REC2, undefined));
    check('sitemap() with opts drops the ghost URL from the XML',
      !/ghost\.html/.test(SEOFiles.sitemap(REC2, { generated: GENERATED })) &&
      /real\.html/.test(SEOFiles.sitemap(REC2, { generated: GENERATED })));
    /* When everything is generated, the filter must change nothing. */
    check('when every page was generated the URL set is unchanged',
      SEOFiles.sitemap(REC2, { generated: GENERATED.concat('ghost.html') }) === SEOFiles.sitemap(REC2));
    check('an object keyed by file name works as well as an array',
      SEOFiles.sitemapPages(REC2, { generated: { 'index.html': 1, 'real.html': 1 } })
        .map(r => r.file).join(',') === ',real.html');
  }

  /* ---------- the tool: one snapshot, and it says what it left out ---------- */
  {
    const dir = mktmp('tool');
    ['index.html', 'about.html'].forEach(f => fs.writeFileSync(path.join(dir, f), '<html></html>'));
    const rowFile = path.join(mktmp('row'), 'row.json');
    const record = {
      seo: { baseUrl: 'https://example.test' },
      pages: { home: { url: '' }, about: { url: 'about.html' },
               ghost: { url: 'ghost.html', inSitemap: true } }
    };
    fs.writeFileSync(rowFile, JSON.stringify({ data: record, updated_at: '2026-10-01T00:00:00+00:00' }));
    const run = extra => {
      const args = [path.join(ROOT, 'tools', 'build-seo-files.js'),
        '--row', rowFile, '--out', dir, '--generated-from', dir].concat(extra || []);
      try { return { code: 0, out: execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }) }; }
      catch (e) { return { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
    };

    const r = run(['--check']);
    check('the tool runs from a handed-down record', r.code === 0, r.out.slice(-300));
    check('  and says the record came from the build, not from a second fetch',
      /Source:\s+the CMS record this build already read/.test(r.out), (r.out.match(/Source:.*/) || [''])[0]);
    check('  and never reached the network for it', !/Could not use the live CMS record/.test(r.out));
    check('  reporting the excluded URL and which page asked for it',
      /Excluded: 1 published URL\(s\)/.test(r.out) &&
      /ghost\.html\s+\(page "ghost"\)/.test(r.out), r.out.slice(-500));
    check('  as a warning the deploy log surfaces',
      /^::warning::.*no static file was generated/m.test(r.out));
    check('  naming both ways to resolve it',
      /needs generating or inSitemap should be false/.test(r.out));
    check('  and counting the pages it checked against',
      /checked against 2 generated page\(s\)/.test(r.out), (r.out.match(/Sitemap:.*/) || [''])[0]);

    /* Written for real, then read back. */
    const w = run();
    check('writing produces a sitemap without the ghost URL',
      w.code === 0 && !/ghost\.html/.test(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8')),
      w.out.slice(-300));
    check('  while keeping the URLs whose files exist',
      locs(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8')).join(',') ===
      ['https://example.test/', 'https://example.test/about.html'].join(','),
      locs(fs.readFileSync(path.join(dir, 'sitemap.xml'), 'utf8')));

    /* A filter that removes EVERYTHING is a broken call, not integrity. */
    const empty = mktmp('empty');
    const args = [path.join(ROOT, 'tools', 'build-seo-files.js'), '--row', rowFile,
                  '--out', empty, '--generated-from', empty];
    let bad;
    try { execFileSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8' }); bad = { code: 0, out: '' }; }
    catch (e) { bad = { code: e.status, out: (e.stdout || '') + (e.stderr || '') }; }
    check('a build where NOTHING matches refuses rather than writing an empty sitemap',
      bad.code === 1 && /Refusing to write an empty sitemap/.test(bad.out), bad.out.slice(-300));
    check('  and does not leave a sitemap behind', !fs.existsSync(path.join(empty, 'sitemap.xml')));
  }

  /* ---------- the assembler wires it up ---------- */
  {
    const src = fs.readFileSync(path.join(ROOT, 'tools', 'lib', 'sitekit.js'), 'utf8');
    check('the assembler tells the generator what it generated',
      /--generated-from/.test(src) && /'--generated-from', dest/.test(src));
    check('and hands down the record it already read instead of a second fetch',
      /'--row', snapshot/.test(src));
    check('writing that snapshot outside the artifact it publishes',
      /mkdtempSync/.test(src) && !/path\.join\(dest, *'row/.test(src));
    const bs = fs.readFileSync(path.join(ROOT, 'tools', 'build-site.js'), 'utf8');
    check('and the build passes the row it fetched into the plan',
      /row: live \? \{ data: live\.data/.test(bs));
  }

  /* ---------- real brands, end to end ---------- */
  {
    const BRANDS = path.join(ROOT, 'brands');
    const TEMPLATES = path.join(ROOT, 'templates');
    const ids = fs.readdirSync(BRANDS, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name).sort();
    check('there are at least two real brands to compare', ids.length >= 2, ids);

    /* Each brand's own record, built from its own committed layer so this
       invents no content and names no brand -- plus one page that asks to
       be in the sitemap and will never have a file. */
    function rowFor(id) {
      const vm = require('vm');
      const sb = { window: {} }; sb.window.window = sb.window;
      vm.runInNewContext(fs.readFileSync(path.join(BRANDS, id, 'brand.js'), 'utf8'), sb);
      const layer = sb.window.CMS_BRAND || {};
      const seoCfg = JSON.parse(fs.readFileSync(path.join(BRANDS, id, 'seo-config.json'), 'utf8'));
      const pages = JSON.parse(JSON.stringify(layer.pages || seoCfg.pages || {}));
      pages['never-generated'] = { label: 'Never Generated', slug: 'never-generated',
        url: 'never-generated.html', robots: { index: true, follow: true },
        inSitemap: true, updatedAt: '2026-10-01', title: 'Never Generated',
        metaDescription: '', heading: '', lead: '', body: '' };
      return { data: { seo: (seoCfg.seo || {}), pages: pages }, updatedAt: '2026-10-01T00:00:00+00:00' };
    }

    for (const id of ids) {
      const cfg = JSON.parse(fs.readFileSync(path.join(BRANDS, id, 'brand.json'), 'utf8'));
      const envs = Object.keys(cfg.environments || {});
      /* Production for every brand; a brand whose production domain is not
         yet served still assembles, which is the point of the env system. */
      const out = mktmp('brand');
      const s = SITE.planSite({ brandsDir: BRANDS, templatesDir: TEMPLATES, sharedRoot: ROOT,
                                id: id, env: '', row: rowFor(id) });
      const res = SITE.assemble(s, out);
      const v = SITE.verify(s, res.dir);
      const domain = s.plan.brand.domain;
      check(id + ': assembles and passes its own checks', v.problems.length === 0, v.problems);

      const smapPath = path.join(res.dir, 'sitemap.xml');
      if (s.plan.brand.noindex) {
        check(id + ': a noindex host still publishes no sitemap at all', !fs.existsSync(smapPath));
        continue;
      }
      const xml = fs.readFileSync(smapPath, 'utf8');
      const urls = locs(xml);
      const present = files(res.dir);
      check(id + ': every advertised URL is a file this site serves',
        urls.every(u => present.indexOf(u.replace('https://' + domain, '').replace(/^\//, '') || 'index.html') > -1),
        urls.filter(u => present.indexOf(u.replace('https://' + domain, '').replace(/^\//, '') || 'index.html') === -1));
      check(id + ':   and that is not a vacuous claim', urls.length > 0, urls.length);
      check(id + ': the page with no file is not advertised',
        !/never-generated/.test(xml));
      /* Everything this brand publishes AND generated is still advertised,
         computed from its own record rather than from a list of page names,
         so no brand's page set is written into this test. */
      {
        const want = SEOFiles.sitemapPages(rowFor(id).data, { generated: present })
          .map(r => 'https://' + domain + '/' + r.file);
        check(id + ': the sitemap is exactly its published, indexable, generated pages',
          urls.join(',') === want.join(','), [urls, want]);
        check(id + ':   including the template-backed pages it had before',
          want.length >= 1 && present.length > want.length, [want.length, present.length]);
      }
      check(id + ': every URL is on its own domain and no other brand\'s',
        urls.every(u => u.indexOf('https://' + domain + '/') === 0) &&
        !ids.filter(o => o !== id).some(o => xml.indexOf(o) > -1), urls);

      /* The independent check on the finished artifact: tamper with the
         published sitemap and verify() must object. */
      fs.writeFileSync(smapPath, xml.replace('</urlset>',
        '  <url>\n    <loc>https://' + domain + '/not-a-page.html</loc>\n  </url>\n</urlset>'));
      const tampered = SITE.verify(s, res.dir);
      check(id + ': verify() objects to a sitemap URL with no file behind it',
        tampered.problems.some(p => /advertises .* but this site has no not-a-page\.html/.test(p)),
        tampered.problems);
      void envs;
    }
  }

  /* ---------- a third brand, with no shared-code change ---------- */
  {
    const SYNTH = path.join(__dirname, 'fixtures', 'brands');
    const root = mktmp('third');
    const brandsDir = path.join(root, 'brands');
    fs.cpSync(SYNTH, brandsDir, { recursive: true });
    const thirdId = fs.readdirSync(brandsDir, { withFileTypes: true })
      .filter(e => e.isDirectory()).map(e => e.name).sort()[0];
    const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'seo-config.json'), 'utf8'));
    seo.seo = seo.seo || {};
    seo.seo.baseUrl = 'https://' + thirdId;
    fs.writeFileSync(path.join(brandsDir, thirdId, 'seo-config.json'), JSON.stringify(seo, null, 2) + '\n');

    const record = { seo: { baseUrl: 'https://' + thirdId },
      pages: { home: { url: '' }, about: { url: 'about.html' },
               ghost: { url: 'third-ghost.html', inSitemap: true } } };
    const out = mktmp('third-out');
    const s = SITE.planSite({ brandsDir: brandsDir, templatesDir: path.join(ROOT, 'templates'),
                              sharedRoot: ROOT, id: thirdId, env: '',
                              row: { data: record, updatedAt: '2026-10-01T00:00:00+00:00' } });
    const res = SITE.assemble(s, out);
    const v = SITE.verify(s, res.dir);
    const xml = fs.readFileSync(path.join(res.dir, 'sitemap.xml'), 'utf8');
    check('a brand that exists only as a directory gets the same integrity rule',
      v.problems.length === 0 && !/third-ghost/.test(xml), v.problems);
    check('  advertising only its own domain', locs(xml).every(u => u.indexOf('https://' + thirdId + '/') === 0),
      locs(xml));
    check('  and none of the real brands\' URLs',
      !fs.readdirSync(path.join(ROOT, 'brands')).some(o => xml.indexOf(o) > -1));
    check('  with no shared CMS or generator file of its own',
      !walkAll(path.join(brandsDir, thirdId)).some(f => /(cms|seo-files|build-seo-files)\.js$/.test(f)));
  }

  /* ---------- the generator names no brand ---------- */
  {
    const BRANDISH = /jsk-?1|playzone|[a-z0-9-]+\.(?:com|app)\b/i;
    /* Comments are prose and may well name a brand to explain a decision;
       what must name none is the code that runs. The repo writes block
       comments as /* ... *​/ with plain indented lines, so they are stripped
       as blocks rather than line by line. */
    const codeOf = f => fs.readFileSync(path.join(ROOT, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
    for (const f of ['js/seo-files.js', 'tools/build-seo-files.js', 'tools/lib/sitekit.js']) {
      const code = codeOf(f);
      check(f + ': no brand, domain or site id in the code that runs', !BRANDISH.test(code),
        (code.match(BRANDISH) || [])[0]);
    }
    check('the sitemap filter itself is one brand-agnostic function',
      /function sitemapAudit\(data, opts\)/.test(fs.readFileSync(path.join(ROOT, 'js', 'seo-files.js'), 'utf8')));
  }

  tmps.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} });

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();

function walkAll(dir, base, out) {
  base = base || dir; out = out || [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkAll(full, base, out);
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out;
}
