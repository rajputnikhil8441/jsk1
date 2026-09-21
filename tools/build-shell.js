#!/usr/bin/env node
/* Writes the global site shell — header, navigation and footer — into the
   public pages that use it.

   WHY A GENERATOR. The shell was already identical on every page: the
   <header> block was byte-for-byte the same on index, about, contact,
   responsible-gaming and 404, and so was the footer. It was kept that way
   by copying. That is fine until it isn't: privacy-policy.html arrived
   with a comment where the header should be, saying "copy the header, nav
   and footer blocks from about.html", because the page generator in
   /admin says exactly that instead of emitting them.

   WHY NOT RUNTIME INJECTION. The site is static files on GitHub Pages and
   its navigation has to be in the HTML a crawler reads, not assembled by
   JavaScript afterwards. So the shell is generated into the files and
   committed, the same arrangement tools/build-asset-manifest.js uses.

   HOW IT WORKS. Each page carries marker comments:

       <!-- SHELL:HEADER -->   ...generated...   <!-- /SHELL:HEADER -->

   Everything between a pair is replaced; everything outside is the page's
   own and is never touched. A page opts into a region by carrying its
   markers, which is how index.html keeps its own sports navigation while
   sharing the header and footer.

   Run it after changing the shell, or after creating a page:

       node tools/build-shell.js          # write
       node tools/build-shell.js --check  # verify, exit 1 if stale

   It is deterministic and idempotent: running it twice changes nothing,
   so a stale page shows up as a diff rather than as a surprise. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* ------------------------------------------------------------------
   THE PAGES, and which regions each one takes.

   login and register are deliberately absent: they carry their own
   deliberately different shell (.login-main / .login-footer) and are
   noindex utility pages. /admin is absent for the same reason and
   because its navigation is not public.
------------------------------------------------------------------ */
const PAGES = [
    /* file,                      nav key,              header  nav    footer */
    ['index.html',                'home',               true,   false, true],
    ['about.html',                'about',              true,   true,  true],
    ['contact.html',              'contact',            true,   true,  true],
    ['responsible-gaming.html',   'responsible-gaming', true,   true,  true],
    ['privacy-policy.html',       'privacy-policy',     true,   true,  true],
    ['404.html',                  '',                   true,   true,  true]
];

/* ------------------------------------------------------------------
   PRIMARY NAVIGATION — the header dropdown and the info-page nav bars.

   Only pages that exist. Privacy Policy is deliberately NOT here: it is
   secondary/legal navigation and belongs in the footer, not in a primary
   bar that every new page would otherwise be pushed into.
------------------------------------------------------------------ */
const PRIMARY = [
    { key: 'home',               href: './',                       label: 'HOME',               menu: 'Home' },
    { key: 'about',              href: 'about.html',               label: 'ABOUT',              menu: 'About Us' },
    { key: 'contact',            href: 'contact.html',             label: 'CONTACT',            menu: 'Contact' },
    { key: 'responsible-gaming', href: 'responsible-gaming.html',  label: 'RESPONSIBLE GAMING', menu: 'Responsible Gaming' }
];

const ACCOUNT = [
    { key: 'login',    href: 'login.html',    label: 'LOGIN',    menu: 'Login' },
    { key: 'register', href: 'register.html', label: 'REGISTER', menu: 'Register' }
];

/* ------------------------------------------------------------------
   FOOTER COLUMNS — every href is a file in this repository.

   There is no "Terms & Conditions" or "Disclaimer" column because those
   pages do not exist. A column of links to nothing is worse than a
   column that is not there; add the page, add it here, run the tool.
------------------------------------------------------------------ */
const FOOTER_GROUPS = [
    {
        title: 'Important Links',
        links: [
            { href: './',                      label: 'Home' },
            { href: 'about.html',              label: 'About' },
            { href: 'contact.html',            label: 'Contact' },
            { href: 'responsible-gaming.html', label: 'Responsible Gaming' },
            { href: 'privacy-policy.html',     label: 'Privacy Policy' }
        ]
    },
    {
        title: 'Account',
        links: [
            { href: 'login.html',    label: 'Login' },
            { href: 'register.html', label: 'Register' }
        ]
    }
];

/* ---------------- helpers ---------------- */

function esc(v) {
    return String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Every href this file emits is a literal from the tables above, so this
   is a guard against a future edit rather than against today's data: a
   link that is not a plain relative path to a file in this repository
   stops the build rather than reaching a page. */
function localHref(h) {
    const v = String(h == null ? '' : h).trim();
    if (v === './') return v;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(v)) {
        throw new Error('build-shell: refusing a navigation href that is not a local page: ' + JSON.stringify(h));
    }
    if (!fs.existsSync(path.join(ROOT, v))) {
        throw new Error('build-shell: navigation points at a page that does not exist: ' + v);
    }
    return v;
}

const I = n => ' '.repeat(n);

/* ---------------- the regions ---------------- */

function header() {
    const menu = PRIMARY.map(p =>
        `${I(24)}<li><a href="${esc(localHref(p.href))}">${esc(p.menu)}</a></li>`).join('\n');
    const account = ACCOUNT.map(p =>
        `${I(24)}<li><a href="${esc(localHref(p.href))}">${esc(p.menu)}</a></li>`).join('\n');
    return `${I(4)}<header class="site-header">
${I(8)}<div class="header-inner">

${I(12)}<!-- Mobile Home Icon (mobile-only) -->
${I(12)}<a href="./" class="mob-home-icon" title="Home">
${I(16)}<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
${I(12)}</a>

${I(12)}<!-- Logo -->
${I(12)}<div class="header-logo">
${I(16)}<a href="./">
${I(20)}<img class="logo-img" alt="JSK1" hidden
${I(25)}data-cms-img="logo" data-cms-img-mob="logoMobile" data-cms-alt="siteName">
${I(20)}<span class="logo-text-fallback"><span class="logo-play" data-cms-text="branding.siteName">JSK1</span></span>
${I(16)}</a>
${I(12)}</div>

${I(12)}<!-- Header Right -->
${I(12)}<div class="header-right">
${I(16)}<a href="#" class="btn-apk" id="apkBtn">
${I(20)}<i class="fas fa-download"></i> <span data-cms="btn.apk">Download Apk</span>
${I(20)}<i class="fas fa-diamond apk-diamond"></i>
${I(16)}</a>
${I(16)}<a href="#" class="btn-demo" data-cms="btn.demo">Demo</a>
${I(16)}<a href="login.html" class="btn-login" data-cms="btn.login">Login</a>
${I(16)}<a href="register.html" class="btn-register" data-cms="btn.register">Register</a>

${I(16)}<!-- Pages dropdown -->
${I(16)}<div class="pagemenu">
${I(20)}<button type="button" class="pagemenu-btn" aria-label="Menu" aria-expanded="false" aria-haspopup="true"><span class="caret">&#9662;</span></button>
${I(20)}<ul class="pagemenu-list">
${menu}
${I(24)}<div class="menu-divider"></div>
${account}
${I(20)}</ul>
${I(16)}</div>
${I(12)}</div>

${I(8)}</div>

${I(8)}<!-- Ticker / Marquee -->
${I(8)}<div class="header-ticker" id="headerTicker">
${I(12)}<div class="ticker-icon"><i class="fas fa-bullhorn"></i></div>
${I(12)}<div class="ticker-wrap">
${I(16)}<div class="ticker-text" id="tickerText" data-cms="marquee.text">
${I(20)}🔥🔥 The casino floor is buzzing with excitement! &nbsp;&nbsp;&nbsp;Teenpatti BaccaratPoker Play Live
${I(16)}</div>
${I(12)}</div>
${I(8)}</div>
${I(4)}</header>`;
}

function nav(active) {
    const items = PRIMARY.concat(ACCOUNT);
    const desktop = items.map(p => {
        const cls = 'nav-link' + (p.key === active ? ' active' : '');
        const aria = p.key === active ? ' aria-current="page"' : '';
        const icon = p.key === 'home' ? '<i class="fas fa-home"></i> <span>' + esc(p.label) + '</span>' : esc(p.label);
        return `${I(16)}<li><a href="${esc(localHref(p.href))}" class="${cls}"${aria}>${icon}</a></li>`;
    }).join('\n');
    const mobile = items.map(p => {
        const cls = 'mob-cat-item' + (p.key === active ? ' active' : '');
        const aria = p.key === active ? ' aria-current="page"' : '';
        return `${I(12)}<a href="${esc(localHref(p.href))}" class="${cls}"${aria}>${esc(p.label)}</a>`;
    }).join('\n');
    return `${I(4)}<!-- NAVIGATION — desktop (hidden under 768px, exactly like the homepage) -->
${I(4)}<nav class="main-nav info-nav-bar" aria-label="Main">
${I(8)}<div class="nav-inner">
${I(12)}<ul class="nav-list">
${desktop}
${I(12)}</ul>
${I(8)}</div>
${I(4)}</nav>

${I(4)}<!-- NAVIGATION — mobile strip (the homepage's category bar) -->
${I(4)}<nav class="mob-category-nav info-cat-nav" aria-label="Main (mobile)">
${I(8)}<div class="mob-category-inner">
${mobile}
${I(8)}</div>
${I(4)}</nav>`;
}

function footer() {
    const groups = FOOTER_GROUPS.map(g => {
        const links = g.links.map(l =>
            `${I(20)}<a href="${esc(localHref(l.href))}">${esc(l.label)}</a>`).join('\n');
        return `${I(12)}<div class="footer-col">
${I(16)}<h2 class="footer-col-title">${esc(g.title)}</h2>
${I(16)}<nav class="footer-links" aria-label="${esc(g.title)}">
${links}
${I(16)}</nav>
${I(12)}</div>`;
    }).join('\n');

    return `${I(4)}<!-- SUPPORT -->
${I(4)}<section class="support-section">
${I(8)}<div class="support-text">
${I(12)}<h3><i class="fas fa-headset"></i> <span data-cms="support.title">24X7 Support</span></h3>
${I(12)}<a class="support-link" id="whatsappLink" href="#" data-cms="support.link">WhatsApp Support</a>
${I(8)}</div>
${I(8)}<a href="#" class="support-wa-btn" id="whatsappSupportBtn" title="WhatsApp Support">
${I(12)}<img src="assets/icons/whatsapp.png" data-cms-img="whatsappIcon" alt="WhatsApp">
${I(8)}</a>
${I(4)}</section>

${I(4)}<footer class="site-footer">
${I(8)}<div class="footer-cols">

${I(12)}<div class="footer-col footer-col-brand">
${I(16)}<img class="footer-logo-img" id="footerLogo" data-cms-img="footerLogo" alt="" hidden>
${I(16)}<div class="footer-brand-name" data-cms-text="branding.siteName">JSK1</div>
${I(16)}<p class="footer-brand-text" data-cms="footer.about">The official JSK1 website. Create an account, sign in and reach support any time.</p>
${I(16)}<div class="footer-social" id="footerSocial"></div>
${I(12)}</div>

${groups}

${I(12)}<div class="footer-col">
${I(16)}<h2 class="footer-col-title">Support</h2>
${I(16)}<nav class="footer-links" aria-label="Support">
${I(20)}<a href="contact.html">Contact us</a>
${I(20)}<a href="#" id="footerWaLink" data-cms="support.link">WhatsApp Support</a>
${I(16)}</nav>
${I(16)}<div class="footer-safe">
${I(20)}<img loading="lazy" class="ssl-img" src="assets/images/ssl.png" alt="100% Safe">
${I(16)}</div>
${I(12)}</div>

${I(8)}</div>

${I(8)}<div class="footer-inner">

${I(12)}<div class="footer-copy" data-cms="footer.copyright">
${I(16)}&copy; Copyright 2026 JSK1. All Rights Reserved.
${I(12)}</div>

${I(12)}<div class="footer-badges">
${I(16)}<img loading="lazy" class="footer-icon-img" src="assets/icons/18plus.png" alt="18+">
${I(16)}<img loading="lazy" class="footer-icon-img" src="assets/icons/gamecare.png" alt="GamCare">
${I(16)}<img loading="lazy" class="footer-icon-img" src="assets/icons/gt.png" alt="GT">
${I(12)}</div>

${I(8)}</div>
${I(4)}</footer>

${I(4)}<!-- WHATSAPP FLOATING BUTTON -->
${I(4)}<a href="#" id="whatsappFloat" class="whatsapp-float" title="WhatsApp Support">
${I(8)}<img src="assets/icons/whatsapp.png" data-cms-img="whatsappIcon" alt="WhatsApp">
${I(4)}</a>`;
}

/* ---------------- writing ---------------- */

const REGIONS = { HEADER: header, NAV: nav, FOOTER: footer };

function replaceRegion(src, name, body, file) {
    const open = '<!-- SHELL:' + name + ' -->';
    const close = '<!-- /SHELL:' + name + ' -->';
    const a = src.indexOf(open);
    const b = src.indexOf(close);
    if (a === -1 || b === -1) {
        throw new Error('build-shell: ' + file + ' has no ' + name + ' markers. Add:\n    ' +
                        open + '\n    ' + close);
    }
    if (b < a) throw new Error('build-shell: ' + file + ' has ' + name + ' markers in the wrong order');
    if (src.indexOf(open, a + 1) !== -1) {
        throw new Error('build-shell: ' + file + ' has more than one ' + name + ' region');
    }
    return src.slice(0, a + open.length) + '\n' + body + '\n' + I(4) + src.slice(b);
}

const check = process.argv.indexOf('--check') > -1;
let changed = 0, stale = [];

PAGES.forEach(function (row) {
    const [file, key, wantHeader, wantNav, wantFooter] = row;
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) throw new Error('build-shell: no such page: ' + file);
    const before = fs.readFileSync(full, 'utf8');
    let out = before;
    if (wantHeader) out = replaceRegion(out, 'HEADER', REGIONS.HEADER(), file);
    if (wantNav)    out = replaceRegion(out, 'NAV',    REGIONS.NAV(key), file);
    if (wantFooter) out = replaceRegion(out, 'FOOTER', REGIONS.FOOTER(), file);
    if (out === before) return;
    stale.push(file);
    if (!check) { fs.writeFileSync(full, out); changed += 1; }
});

if (check) {
    if (stale.length) {
        console.error('shell is stale in: ' + stale.join(', ') +
                      '\nrun: node tools/build-shell.js');
        process.exit(1);
    }
    console.log('shell is up to date in all ' + PAGES.length + ' pages');
} else {
    console.log('build-shell: ' + changed + ' of ' + PAGES.length + ' pages rewritten' +
                (changed ? ' (' + stale.join(', ') + ')' : ' — already up to date'));
}
