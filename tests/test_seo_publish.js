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
const ROOT = path.resolve(__dirname, '..');
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
    check('the deploy runs the generator', /node tools\/build-seo-files\.js/.test(wf));
    check('before the artifact is uploaded',
      wf.indexOf('build-seo-files.js') < wf.indexOf('upload-pages-artifact'));
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

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
