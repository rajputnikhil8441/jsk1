/* GLOBAL SITE SHELL — shared header, navigation and footer. The header
   scrolls away with the page: it is neither sticky nor fixed.

   THE CLAIM. Every public content page carries the same header, the same
   navigation and the same footer; the header actually stays on screen
   while the page scrolls; the footer is an ordinary document footer and
   not an overlay; and every link in either one goes somewhere that
   exists.

   WHY A GENERATOR RATHER THAN RUNTIME INJECTION. The site is static files
   on GitHub Pages, so its navigation has to be in the HTML a crawler
   reads. tools/build-shell.js writes the shell into the pages between
   marker comments and the result is committed. These tests are therefore
   about the FILES as served, not about what JavaScript does afterwards. */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* The pages that take the shell, and the ones that deliberately do not. */
const SHELL_PAGES = ['index.html', 'about.html', 'contact.html',
                     'responsible-gaming.html', 'privacy-policy.html', '404.html'];
const NAV_PAGES = SHELL_PAGES.filter(f => f !== 'index.html');
const NOT_SHELL = ['login.html', 'register.html'];

const PRIMARY_HREFS = ['./', 'about.html', 'contact.html', 'responsible-gaming.html',
                       'login.html', 'register.html'];
const FOOTER_PAGE_HREFS = ['./', 'about.html', 'contact.html', 'responsible-gaming.html',
                           'privacy-policy.html', 'login.html', 'register.html', 'contact.html'];

async function open(b, file, w, h) {
  const ctx = await b.newContext({ viewport: { width: w || 1280, height: h || 900 } });
  await ctx.route('**supabase.co/**', r => r.fulfill({ status: 200,
    contentType: 'application/json', body: '[]' }));
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + String(e).slice(0, 120)));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text()))
    errs.push(m.text().slice(0, 120)); });
  await p.goto(`${BASE}/${file}`, { waitUntil: 'networkidle' });
  return { ctx, p, errs };
}

const shot = p => p.evaluate(() => {
  const cs = n => n ? getComputedStyle(n) : null;
  const hd = document.querySelector('header.site-header');
  const ft = document.querySelector('footer.site-footer');
  const nav = document.querySelector('nav.main-nav.info-nav-bar');
  const mob = document.querySelector('nav.mob-category-nav');
  return {
    headers: document.querySelectorAll('header.site-header').length,
    footers: document.querySelectorAll('footer.site-footer').length,
    navs: document.querySelectorAll('nav.main-nav.info-nav-bar').length,
    mobNavs: document.querySelectorAll('nav.mob-category-nav.info-cat-nav').length,
    hPos: hd ? cs(hd).position : null,
    hTop: hd ? cs(hd).top : null,
    fPos: ft ? cs(ft).position : null,
    headerIsLandmark: !!(hd && hd.tagName === 'HEADER'),
    footerIsLandmark: !!(ft && ft.tagName === 'FOOTER'),
    navLabels: [...document.querySelectorAll('header.site-header ~ nav, footer.site-footer nav')]
      .map(n => n.getAttribute('aria-label')),
    menuBtn: (() => { const b = document.querySelector('.pagemenu-btn');
      return b ? { label: b.getAttribute('aria-label'), expanded: b.getAttribute('aria-expanded'),
                   pop: b.getAttribute('aria-haspopup'), tag: b.tagName } : null; })(),
    menuLinks: [...document.querySelectorAll('.pagemenu-list a')].map(a => a.getAttribute('href')),
    navHrefs: nav ? [...nav.querySelectorAll('a')].map(a => a.getAttribute('href')) : null,
    mobHrefs: mob ? [...mob.querySelectorAll('a')].map(a => a.getAttribute('href')) : null,
    active: [...document.querySelectorAll('.nav-link.active, .mob-cat-item.active')]
      .map(a => a.getAttribute('href')),
    ariaCurrent: [...document.querySelectorAll(
      '.nav-link[aria-current="page"], .mob-cat-item[aria-current="page"]')]
      .map(a => a.getAttribute('href')),
    footerHrefs: [...document.querySelectorAll('footer.site-footer .footer-links a')]
      .map(a => a.getAttribute('href')),
    footerTitles: [...document.querySelectorAll('.footer-col-title')].map(t => t.textContent.trim()),
    footerLinkText: [...document.querySelectorAll('footer.site-footer a')].map(a => {
      const img = a.querySelector('img[alt]');
      return (a.textContent.trim() || a.getAttribute('aria-label') ||
              a.getAttribute('title') || (img ? img.getAttribute('alt') : '') || '').trim();
    }),
    emptyLinks: [...document.querySelectorAll('header a, footer a, nav a')]
      .filter(a => !a.textContent.trim() && !a.getAttribute('aria-label') &&
                   !a.querySelector('img[alt]:not([alt=""])') && !a.querySelector('svg')).length,
    scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
    docH: document.documentElement.scrollHeight, vh: window.innerHeight,
    h1s: document.querySelectorAll('h1').length
  };
});

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     1. THE GENERATOR IS THE SOURCE OF TRUTH
     ================================================================ */
  console.log('\n===== THE SHELL IN THE FILES MATCHES THE GENERATOR =====');
  {
    let out = '', code = 0;
    try { out = execFileSync('node', [path.join(ROOT, 'tools', 'build-shell.js'), '--check'],
                             { encoding: 'utf8', cwd: ROOT }); }
    catch (e) { code = 1; out = (e.stdout || '') + (e.stderr || ''); }
    check('every page is up to date with tools/build-shell.js', code === 0, out.slice(0, 200));

    /* Running it again must change nothing: a generator whose output
       depends on its own previous output is not a source of truth. */
    const before = SHELL_PAGES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    execFileSync('node', [path.join(ROOT, 'tools', 'build-shell.js')], { cwd: ROOT });
    const after = SHELL_PAGES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'));
    check('and running it is idempotent',
      before.every((t, i) => t === after[i]),
      SHELL_PAGES.filter((f, i) => before[i] !== after[i]));

    /* The markers are a contract; a page that loses one silently stops
       being maintained. */
    SHELL_PAGES.forEach(f => {
      const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const want = f === 'index.html' ? ['HEADER', 'FOOTER'] : ['HEADER', 'NAV', 'FOOTER'];
      const ok = want.every(r =>
        (t.match(new RegExp('<!-- SHELL:' + r + ' -->', 'g')) || []).length === 1 &&
        (t.match(new RegExp('<!-- /SHELL:' + r + ' -->', 'g')) || []).length === 1);
      check(f + ' carries exactly one of each marker it needs', ok, want);
    });
    check('index.html keeps its own navigation rather than the shell one',
      !fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('<!-- SHELL:NAV -->'));
    NOT_SHELL.forEach(f => {
      check(f + ' is deliberately outside the shell',
        !fs.readFileSync(path.join(ROOT, f), 'utf8').includes('<!-- SHELL:'));
    });
  }

  /* ================================================================
     1b. THE STYLESHEET ITSELF DOES NOT PIN THE HEADER
     The computed-style and scroll checks below would both catch a
     sticky header, but only once a browser is running. This reads the
     .site-header rule straight out of the source so that reintroducing
     `position: sticky` or `position: fixed` there fails immediately.
     ================================================================ */
  console.log('\n===== THE HEADER RULE DOES NOT PIN THE HEADER =====');
  {
    const css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
    const blocks = [...css.matchAll(/(^|\n)(\.site-header)\s*\{([^}]*)\}/g)].map(m => m[3]);
    check('the .site-header rule was found in css/style.css', blocks.length >= 1, blocks.length);
    for (const body of blocks) {
      const pos = (body.match(/(^|;|\n)\s*position\s*:\s*([a-z-]+)/) || [])[2] || 'none';
      check('.site-header declares no sticky or fixed position (found: ' + pos + ')',
        pos !== 'sticky' && pos !== 'fixed', body.trim().slice(0, 160));
    }
    /* And no media query quietly pins it at one width. */
    for (const f of ['style.css', 'responsive.css']) {
      const src = fs.readFileSync(path.join(ROOT, 'css', f), 'utf8');
      const pinned = [...src.matchAll(/\.site-header[^{}]*\{([^}]*)\}/g)]
        .map(m => m[1]).filter(bd => /position\s*:\s*(sticky|fixed)/.test(bd));
      check('css/' + f + ' never pins .site-header at any width', pinned.length === 0, pinned);
    }
  }

  /* ================================================================
     2. THE SHELL IS IN THE HTML, NOT ASSEMBLED AFTERWARDS
     ================================================================ */
  console.log('\n===== A CRAWLER THAT RUNS NO JAVASCRIPT STILL SEES THE NAVIGATION =====');
  {
    for (const f of SHELL_PAGES) {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      check(f + ': the header is in the served file',
        /<header class="site-header">/.test(raw));
      check(f + ': the footer is in the served file',
        /<footer class="site-footer">/.test(raw));
      check(f + ': the footer links are real hrefs in the markup',
        FOOTER_PAGE_HREFS.every(h => raw.includes('href="' + h + '"')), f);
    }
    for (const f of NAV_PAGES) {
      const raw = fs.readFileSync(path.join(ROOT, f), 'utf8');
      check(f + ': the primary navigation is in the served file',
        PRIMARY_HREFS.every(h => raw.includes('href="' + h + '"')));
    }
  }

  /* ================================================================
     3. ONE HEADER, ONE FOOTER, AND THE HEADER SCROLLS AWAY
     The header belongs to the document, not to the viewport. These
     assertions fail if it is ever made position: sticky or
     position: fixed again -- by the computed style, and independently
     by where it actually is after the page is scrolled.
     ================================================================ */
  for (const [w, h, label] of [[1280, 900, 'desktop'], [900, 900, 'tablet'],
                               [390, 844, 'mobile 390'], [375, 812, 'mobile 375'],
                               [768, 900, 'tablet 768']]) {
    console.log('\n===== ' + label.toUpperCase() + ' (' + w + 'px) =====');
    for (const f of SHELL_PAGES) {
      const r = await open(b, f, w, h);
      const s = await shot(r.p);
      check(label + ' ' + f + ': exactly one header and one footer',
        s.headers === 1 && s.footers === 1, { h: s.headers, f: s.footers });
      check(label + ' ' + f + ': the header is in normal document flow',
        s.hPos === 'static' || s.hPos === 'relative', s.hPos);
      check(label + ' ' + f + ': the header is neither sticky nor fixed',
        s.hPos !== 'sticky' && s.hPos !== 'fixed', s.hPos);
      check(label + ' ' + f + ': the footer is a normal document footer, not fixed',
        s.fPos === 'static' || s.fPos === 'relative', s.fPos);
      check(label + ' ' + f + ': no horizontal overflow',
        s.scrollX === false, { sw: s.scrollW, cw: s.clientW });
      check(label + ' ' + f + ': still exactly one H1', s.h1s === 1, s.h1s);
      check(label + ' ' + f + ': no page errors', r.errs.length === 0, r.errs);

      /* Where the header ends up is the real claim, so it is tested by
         scrolling. A sticky or fixed header would sit at top 0 here; one
         in normal flow has moved up by exactly the scroll distance. */
      if (s.docH > s.vh + 300) {
        const moved = await r.p.evaluate(async () => {
          const hd = document.querySelector('header.site-header');
          const nav = document.querySelector('nav.main-nav');
          const before = Math.round(hd.getBoundingClientRect().top);
          const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          const want = Math.min(400, max);
          window.scrollTo({ top: want, behavior: 'instant' });
          await new Promise(res => setTimeout(res, 200));
          const hb = hd.getBoundingClientRect();
          const nb = nav ? nav.getBoundingClientRect() : null;
          /* Whatever is painted 5px below the top of the viewport. If the
             header (or the nav) were pinned there, this would find it. */
          const atTop = document.elementFromPoint(Math.round(window.innerWidth / 2), 5);
          window.scrollTo({ top: 0, behavior: 'instant' });
          await new Promise(res => setTimeout(res, 200));
          const back = Math.round(hd.getBoundingClientRect().top);
          return {
            before, back,
            top: Math.round(hb.top), bottom: Math.round(hb.bottom),
            navTop: nb ? Math.round(nb.top) : null,
            navBottom: nb ? Math.round(nb.bottom) : null,
            pinnedHeader: !!(atTop && atTop.closest('header.site-header')),
            pinnedNav: !!(atTop && atTop.closest('nav.main-nav')),
            want: Math.round(want), y: Math.round(want)
          };
        });
        check(label + ' ' + f + ': the header starts at the top of the document',
          moved.before === 0, moved);
        check(label + ' ' + f + ': it scrolls off-screen with the page',
          moved.bottom <= 0, moved);
        check(label + ' ' + f + ': it moves up by exactly the scroll distance',
          moved.top === -moved.want, moved);
        check(label + ' ' + f + ': nothing is pinned to the top of the viewport',
          moved.pinnedHeader === false && moved.pinnedNav === false, moved);
        check(label + ' ' + f + ': and it is visible again back at the top',
          moved.back === 0, moved);
        if (moved.navTop !== null) {
          check(label + ' ' + f + ': the nav scrolls away with it, still flush beneath',
            moved.navTop === moved.bottom && moved.navBottom <= 0, moved);
        }
      }
      await r.ctx.close();
    }
  }

  /* ================================================================
     4. NAVIGATION: REAL DESTINATIONS, CORRECT CURRENT PAGE
     ================================================================ */
  console.log('\n===== WHERE THE LINKS GO =====');
  {
    for (const f of NAV_PAGES) {
      const r = await open(b, f);
      const s = await shot(r.p);
      check(f + ': the primary nav offers exactly the pages that exist',
        s.navHrefs.join(',') === PRIMARY_HREFS.join(','), s.navHrefs);
      check(f + ': the mobile strip offers the same ones',
        s.mobHrefs.join(',') === PRIMARY_HREFS.join(','), s.mobHrefs);
      check(f + ': the header dropdown offers them too',
        s.menuLinks.join(',') === PRIMARY_HREFS.join(','), s.menuLinks);
      check(f + ': no navigation link is a bare hash',
        s.navHrefs.concat(s.mobHrefs, s.menuLinks).every(h => h !== '#'), s.navHrefs);
      await r.ctx.close();
    }

    /* Active state, page by page. Privacy Policy is deliberately not in
       the primary bar, so nothing there is current on that page. */
    for (const [f, want] of [['about.html', 'about.html'],
                             ['contact.html', 'contact.html'],
                             ['responsible-gaming.html', 'responsible-gaming.html']]) {
      const r = await open(b, f);
      const s = await shot(r.p);
      check(f + ': marks itself as the current page, once per bar',
        s.active.length === 2 && s.active.every(h => h === want), s.active);
      check(f + ': and says so to a screen reader',
        s.ariaCurrent.length === 2 && s.ariaCurrent.every(h => h === want), s.ariaCurrent);
      await r.ctx.close();
    }
    const pp = await open(b, 'privacy-policy.html');
    const ps = await shot(pp.p);
    check('privacy-policy: nothing in the primary bar claims to be current',
      ps.active.length === 0, ps.active);
    check('privacy-policy: but the footer links to it',
      ps.footerHrefs.includes('privacy-policy.html'), ps.footerHrefs);
    await pp.ctx.close();
  }

  /* ================================================================
     5. THE FOOTER
     ================================================================ */
  console.log('\n===== THE FOOTER =====');
  {
    for (const f of SHELL_PAGES) {
      const r = await open(b, f);
      const s = await shot(r.p);
      check(f + ': the footer carries the same grouped navigation',
        s.footerHrefs.slice(0, -1).join(',') === FOOTER_PAGE_HREFS.join(','), s.footerHrefs);
      check(f + ': every footer page link is a local page that exists',
        s.footerHrefs.slice(0, -1).every(h =>
          h === './' || fs.existsSync(path.join(ROOT, h))), s.footerHrefs);
      check(f + ': the support link resolves to a real WhatsApp address',
        /^https:\/\/wa\.me\/\d+$/.test(s.footerHrefs[s.footerHrefs.length - 1]),
        s.footerHrefs[s.footerHrefs.length - 1]);
      check(f + ': the columns are titled',
        s.footerTitles.join(',') === 'Important Links,Account,Support', s.footerTitles);
      check(f + ': every footer link has readable text',
        s.footerLinkText.every(t => t.length > 1), s.footerLinkText);
      await r.ctx.close();
    }
    const r = await open(b, 'about.html');
    const covered = await r.p.evaluate(() => {
      /* A footer that overlays content would be on top at the point the
         content occupies. This asks the document, rather than trusting
         the position value alone. */
      const ft = document.querySelector('footer.site-footer');
      const bx = ft.getBoundingClientRect();
      const article = document.querySelector('.info-article').getBoundingClientRect();
      return { footerTop: Math.round(bx.top), articleBottom: Math.round(article.bottom),
               overlaps: bx.top < article.bottom - 1 };
    });
    check('the footer begins below the content, never over it',
      covered.overlaps === false, covered);
    await r.ctx.close();
  }

  /* ================================================================
     6. ACCESSIBILITY OF THE SHELL
     ================================================================ */
  console.log('\n===== LANDMARKS, LABELS AND THE KEYBOARD =====');
  {
    const r = await open(b, 'about.html');
    const s = await shot(r.p);
    check('the header is a <header> landmark', s.headerIsLandmark === true);
    check('the footer is a <footer> landmark', s.footerIsLandmark === true);
    check('both navigation bars are <nav> landmarks',
      s.navs === 1 && s.mobNavs === 1, { nav: s.navs, mob: s.mobNavs });
    check('every nav landmark is labelled',
      s.navLabels.length > 0 && s.navLabels.every(l => l && l.length > 1), s.navLabels);
    check('the menu control is a real button that says what it does',
      s.menuBtn && s.menuBtn.tag === 'BUTTON' && s.menuBtn.label === 'Menu' &&
      s.menuBtn.pop === 'true', s.menuBtn);
    check('and reports that it is closed', s.menuBtn.expanded === 'false', s.menuBtn);
    check('no link in the shell is unreadable to a screen reader',
      s.emptyLinks === 0, s.emptyLinks);

    /* The dropdown, from the keyboard. */
    await r.p.focus('.pagemenu-btn');
    await r.p.keyboard.press('Enter');
    await r.p.waitForTimeout(200);
    const opened = await r.p.evaluate(() => ({
      open: !!document.querySelector('.pagemenu.open'),
      expanded: document.querySelector('.pagemenu-btn').getAttribute('aria-expanded'),
      visible: (() => { const l = document.querySelector('.pagemenu-list');
        return l ? getComputedStyle(l).display !== 'none' : false; })()
    }));
    check('the dropdown opens from the keyboard', opened.open && opened.visible, opened);
    check('and reports that it is open', opened.expanded === 'true', opened);
    await r.p.keyboard.press('Escape');
    await r.p.waitForTimeout(200);
    const closed = await r.p.evaluate(() => ({
      open: !!document.querySelector('.pagemenu.open'),
      expanded: document.querySelector('.pagemenu-btn').getAttribute('aria-expanded')
    }));
    check('Escape closes it again', closed.open === false, closed);
    check('and it says so', closed.expanded === 'false', closed);

    const ring = await r.p.evaluate(async () => {
      document.querySelector('.pagemenu-btn').focus();
      await new Promise(res => setTimeout(res, 50));
      const n = document.activeElement, cs = getComputedStyle(n);
      return { tag: n.tagName, outline: cs.outlineStyle, width: cs.outlineWidth };
    });
    check('a focused control in the header shows a focus ring',
      ring.outline !== 'none' && parseFloat(ring.width) > 0, ring);
    check('no page errors', r.errs.length === 0, r.errs);
    await r.ctx.close();
  }

  /* ================================================================
     7. THE PAGES THAT ARE NOT SHELL PAGES
     ================================================================ */
  console.log('\n===== LOGIN, REGISTER AND THE ADMIN ARE UNTOUCHED =====');
  {
    for (const f of NOT_SHELL) {
      const r = await open(b, f);
      const s = await shot(r.p);
      check(f + ': keeps its own shell, with no site header',
        s.headers === 0 && s.navs === 0, { h: s.headers, n: s.navs });
      check(f + ': and no global footer', s.footers === 0, s.footers);
      check(f + ': is still noindex',
        (await r.p.getAttribute('meta[name="robots"]', 'content')) === 'noindex,follow');
      check(f + ': its own form is intact',
        (await r.p.$$eval('input', n => n.length)) >= 2);
      check(f + ': no page errors', r.errs.length === 0, r.errs);
      await r.ctx.close();
    }
    const a = await open(b, 'admin/index.html');
    const adm = await a.p.evaluate(() => ({
      headers: document.querySelectorAll('header.site-header').length,
      footers: document.querySelectorAll('footer.site-footer').length,
      robots: (document.head.querySelector('meta[name="robots"]') || {}).content,
      gate: !!document.getElementById('authGate')
    }));
    check('the admin has no public shell and no public navigation',
      adm.headers === 0 && adm.footers === 0, adm);
    check('the admin is still noindex,nofollow', adm.robots === 'noindex,nofollow', adm);
    check('and still behind its sign-in gate', adm.gate === true);
    await a.ctx.close();
  }

  /* ================================================================
     8. THE PAGE BUILDER SITS INSIDE THE SHELL
     ================================================================ */
  console.log('\n===== BUILDER CONTENT IS PAGE CONTENT, NOT SHELL =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**supabase.co/**', r => r.fulfill({ status: 200,
      contentType: 'application/json', body: '[]' }));
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await p.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.pages = Object.assign(raw.pages || {}, { 'privacy-policy': {
        builder: { schemaVersion: 2, status: 'published', sections: [{
          id: 's1', type: 'text', enabled: true,
          visibility: { desktop: true, tablet: true, mobile: true },
          style: {}, responsive: {},
          elements: [{ id: 'e1', type: 'text', content: { text: 'BUILT SECTION' },
                       style: {}, responsive: {} }] }] } } });
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    });
    await p.goto(`${BASE}/privacy-policy.html`, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const sec = document.querySelector('.pb-section');
      const hd = document.querySelector('header.site-header');
      const ft = document.querySelector('footer.site-footer');
      const pos = (a, b2) => a.compareDocumentPosition(b2);
      return {
        rendered: !!sec && /BUILT SECTION/.test(document.body.innerText),
        headerBeforeSection: !!(sec && (pos(hd, sec) & Node.DOCUMENT_POSITION_FOLLOWING)),
        sectionBeforeFooter: !!(sec && (pos(sec, ft) & Node.DOCUMENT_POSITION_FOLLOWING)),
        sectionInsideShell: !!(sec && !sec.closest('header, footer')),
        shellInsideSection: document.querySelectorAll('.pb-section header, .pb-section footer').length,
        headers: document.querySelectorAll('header.site-header').length,
        footers: document.querySelectorAll('footer.site-footer').length,
        h1s: document.querySelectorAll('h1').length
      };
    });
    check('a builder page renders its sections', r.rendered === true);
    check('the header comes before them', r.headerBeforeSection === true, r);
    check('and the footer after them', r.sectionBeforeFooter === true, r);
    check('the sections are page content, not inside the shell',
      r.sectionInsideShell === true && r.shellInsideSection === 0, r);
    check('the shell is still there exactly once',
      r.headers === 1 && r.footers === 1, r);
    check('and the page still has one H1', r.h1s === 1, r.h1s);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     9. WHAT THE SHELL GENERATOR REFUSES
     ================================================================ */
  console.log('\n===== AN UNSAFE NAVIGATION HREF STOPS THE BUILD =====');
  {
    const tool = path.join(ROOT, 'tools', 'build-shell.js');
    const src = fs.readFileSync(tool, 'utf8');
    const BAD = ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'blob:http://x/y',
                 'vbscript:msgbox(1)', '//evil.example/x.html', '../../etc/passwd',
                 'https://evil.example/x.html', 'about.html" onmouseover="x'];
    for (const bad of BAD) {
      const patched = src.replace("href: 'about.html',",
        'href: ' + JSON.stringify(bad) + ',');
      check('the ' + bad.slice(0, 20) + ' probe really patched the generator',
        patched !== src && patched.indexOf(JSON.stringify(bad)) > -1);
      const tmp = path.join(ROOT, 'tools', '.shell-probe.js');
      fs.writeFileSync(tmp, patched);
      let threw = false, msg = '';
      try { execFileSync('node', [tmp], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }); }
      catch (e) { threw = true; msg = String(e.stderr || '').slice(0, 120); }
      fs.unlinkSync(tmp);
      check('refuses ' + bad.slice(0, 28), threw && /refusing|does not exist/.test(msg), msg);
    }
    /* And the files were not left half-written by any of that. */
    let code = 0;
    try { execFileSync('node', [path.join(ROOT, 'tools', 'build-shell.js'), '--check'], { cwd: ROOT, stdio: 'pipe' }); }
    catch (e) { code = 1; }
    check('and the pages are still intact afterwards', code === 0);
  }

  /* ================================================================
     10. THE LOGIN GATE AND THE GLOBAL FOOTER
     The home page installs a site-wide click gate (js/main.js). The
     footer exists so that the legal and account pages are reachable from
     anywhere, so those links have to survive it -- and everything the
     gate was actually built for has to keep being gated.
     ================================================================ */
  console.log('\n===== THE FOOTER STILL WORKS ON THE GATED HOME PAGE =====');
  {
    for (const href of ['privacy-policy.html', 'responsible-gaming.html', 'about.html', 'contact.html']) {
      const r = await open(b, 'index.html');
      await r.p.click('footer.site-footer .footer-links a[href="' + href + '"]');
      await r.p.waitForTimeout(600);
      const toast = await r.p.evaluate(() => !!document.getElementById('gateToast'));
      check('the home page footer reaches ' + href,
        r.p.url().endsWith('/' + href) && toast === false, { url: r.p.url(), toast });
      await r.ctx.close();
    }
    /* A second click is the case that used to redirect to login.html. */
    {
      const r = await open(b, 'index.html');
      await r.p.click('footer.site-footer .footer-links a[href="about.html"]');
      await r.p.waitForTimeout(600);
      await r.p.goBack({ waitUntil: 'networkidle' });
      await r.p.click('footer.site-footer .footer-links a[href="privacy-policy.html"]');
      await r.p.waitForTimeout(600);
      check('and a second footer click does not divert to the login page',
        r.p.url().endsWith('/privacy-policy.html'), r.p.url());
      await r.ctx.close();
    }
    /* The gate itself is untouched for the content it guards. */
    for (const sel of ['.odds-btn', '.casino-card']) {
      const r = await open(b, 'index.html');
      const el = await r.p.$(sel);
      check('the gate still guards ' + sel + ' (it is on the page)', !!el);
      if (el) {
        await el.click({ force: true }).catch(() => {});
        await r.p.waitForTimeout(600);
        const st = await r.p.evaluate(() => ({
          toast: !!document.getElementById('gateToast'), path: location.pathname }));
        check('the gate still stops ' + sel,
          st.toast === true && !st.path.endsWith('login.html'), st);
      }
      await r.ctx.close();
    }
  }

  /* ================================================================
     11. CMS TEXT IN THE SHELL IS TEXT
     ================================================================ */
  console.log('\n===== CMS VALUES REACHING THE SHELL ARE RENDERED SAFELY =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route('**supabase.co/**', r => r.fulfill({ status: 200,
      contentType: 'application/json', body: '[]' }));
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(String(e).slice(0, 120)));
    await p.addInitScript(() => {
      const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
      raw.text = Object.assign(raw.text || {}, {
        'footer.about': '<img src=x onerror=window.__pwned=1>',
        'footer.copyright': '<script>window.__pwned=2</script>',
        'marquee.text': '<iframe src=javascript:window.__pwned=3></iframe>',
        'support.link': '<b>not bold</b>'
      });
      raw.branding = Object.assign(raw.branding || {}, {
        siteName: '<script>window.__pwned=4</script>',
        whatsapp: 'javascript:alert(1)'
      });
      localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
    });
    await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => ({
      pwned: window.__pwned,
      scripts: document.querySelectorAll('header script, footer script').length,
      iframes: document.querySelectorAll('header iframe, footer iframe').length,
      handlers: [...document.querySelectorAll('header *, footer *')]
        .filter(n => [...n.attributes].some(a => /^on/i.test(a.name))).length,
      aboutText: (document.querySelector('.footer-brand-text') || {}).textContent,
      copyText: (document.querySelector('.footer-copy') || {}).textContent,
      brandText: (document.querySelector('.footer-brand-name') || {}).textContent,
      waHrefs: [...document.querySelectorAll('#whatsappFloat, #footerWaLink, #whatsappLink')]
        .map(a => a.getAttribute('href'))
    }));
    check('no script ran', r.pwned === undefined, r.pwned);
    check('no script or iframe element was created in the shell',
      r.scripts === 0 && r.iframes === 0, r);
    check('no event-handler attribute appeared', r.handlers === 0);
    check('markup in a CMS value is shown as text, not parsed',
      /<img src=x/.test(r.aboutText || '') && /<script>/.test(r.copyText || ''),
      { about: r.aboutText, copy: r.copyText });
    check('and so is a hostile site name', /<script>/.test(r.brandText || ''), r.brandText);
    check('a WhatsApp number that is not a number produces no link',
      r.waHrefs.every(h => !/^javascript:/i.test(h || '')), r.waHrefs);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
