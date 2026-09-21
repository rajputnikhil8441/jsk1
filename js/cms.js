/* ============================================================
   JSK1 — WHITE LABEL CMS + SEO ENGINE  (js/cms.js)
   ------------------------------------------------------------
   Loaded by index.html, login.html and /admin/index.html.
   Owns one master object in localStorage under CMS.KEY:

       whiteLabelCMS = { branding, colors, text, images, home, settings }

   The frontend never hardcodes branding again — this file paints
   CSS variables, text, images and repeatable lists onto the page.
   ============================================================ */
(function (window, document) {
    'use strict';

    var KEY = 'whiteLabelCMS';

    /* ========================================================
       DEFAULTS — the JSK1 brand as shipped
    ======================================================== */
    var DEFAULTS = {

        branding: {
            siteName: 'JSK1',
            browserTitle: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
            loginTitle: 'Login — JSK1',
            whatsapp: '91xxxxxx',
            telegram: '',
            email: '',
            facebook: '',
            instagram: '',
            marqueeSpeed: 18,
            marqueeEnabled: true
        },

        colors: {
            /* header */
            'hdr-bg': '#0088cc',
            'hdr-text': '#ffffff',
            'ticker-bg': '#6ca9d3',
            'ticker-text': '#ffffff',
            'ticker-icon-bg': '#cc0000',
            /* header buttons */
            'btn-apk-bg': '#006699',
            'btn-apk-text': '#ffffff',
            'btn-demo-bg': '#ffffff',
            'btn-demo-text': '#0b89cf',
            'btn-login-bg': '#24354a',
            'btn-login-text': '#ffffff',
            'btn-register-bg': '#ffffff',
            'btn-register-text': '#1d4fb5',
            /* navigation */
            'nav-bg': '#2c3e50',
            'nav-text': '#cccccc',
            'nav-active': '#ffffff',
            'nav-accent': '#ff8800',
            /* sports tabs */
            'tab-bg': '#e4e6ea',
            'tab-text': '#222222',
            'tab-active-bg': '#ffffff',
            'tab-active-text': '#1d4fb5',
            'tab-active-line': '#1d4fb5',
            'tabm-bg': '#24364a',
            'tabm-text': '#ffffff',
            'tabm-active-line': '#ffffff',
            /* match table */
            'table-bg': '#ffffff',
            'table-row-bg': '#ffffff',
            'table-head-bg': '#e9edf1',
            'table-head-text': '#000000',
            'table-text': '#000000',
            'table-dim': '#777777',
            'table-border': '#ececec',
            'labels-bg': '#e8ecf0',
            'labels-text': '#111111',
            /* odds */
            'back': '#72bbef',
            'lay': '#f98bae',
            'odds-text': '#000000',
            'lock-bg': 'rgba(11, 20, 30, 0.68)',
            'lock-icon': '#ffffff',
            'lock-dash': 'rgba(255, 255, 255, 0.55)',
            /* BM + live dots */
            'bm-text': '#000000',
            'live-green': '#00b81c',
            'live-red': '#cc0000',
            'live-blue': '#0066cc',
            'live-grey': '#c9c9c9',
            /* casino */
            'casino-bg': '#eeeeee',
            'casino-card-bg': '#cccccc',
            'casino-label-bg': '#b8bec8',
            'casino-label-text': '#444444',
            'casino-hover': '#0088cc',
            /* sidebar */
            'sidebar-bg': '#f0f0f0',
            'sidebar-head': '#0088cc',
            'sidebar-head-text': '#ffffff',
            'sidebar-active': '#1d4fb5',
            'sidebar-active-bg': '#e6edf8',
            /* live strip */
            'live-strip-bg': '#dce0e5',
            'live-item-bg': '#ffffff',
            /* support + footer */
            'support-bg': '#0088cc',
            'support-text': '#ffffff',
            'wa-green': '#25d366',
            'footer-bg': '#f2f4f7',
            'footer-text': '#777777',
            /* mobile strips */
            'mob-feat-bg': '#0088cc',
            'mob-feat-card-bg': '#1c2d3e',
            'mob-feat-text': '#c0d2e4',
            'mob-cat-bg': '#0088cc',
            'mob-cat-text': '#ffffff',
            /* page + generic */
            'page-bg': '#eef0f3',
            'content-bg': '#ffffff',
            'border': '#d4d4d4',
            'border-light': '#ebebeb',
            'text': '#222222',
            'text-dim': '#777777',
            /* login page */
            'login-bg-from': '#00b8ec',
            'login-bg-to': '#002244',
            'login-card-bg': '#ffffff',
            'login-title': '#0088cc',
            'login-btn-bg': '#0088cc',
            'login-btn-text': '#ffffff',
            'login-footer-bg': '#0088cc'
        },

        text: {
            'btn.apk': 'Download Apk',
            'btn.demo': 'Demo',
            'btn.login': 'Login',
            'btn.register': 'Register',
            'marquee.text': '🔥🔥 The casino floor is buzzing with excitement!    Teenpatti BaccaratPoker Play Live',
            'nav.home': 'HOME',
            'nav.cricket': 'CRICKET',
            'nav.tennis': 'TENNIS',
            'nav.football': 'FOOTBALL',
            'nav.tabletennis': 'TABLE TENNIS',
            'nav.baccarat': 'BACCARAT',
            'nav.cards32': '32 CARDS',
            'nav.teenpatti': 'TEENPATTI',
            'nav.poker': 'POKER',
            'nav.lucky7': 'LUCKY 7',
            'nav.crash': 'CRASH',
            'support.title': '24X7 Support',
            'support.link': 'WhatsApp Support',
            'footer.copyright': '© Copyright 2026 JSK1. All Rights Reserved.',
            /* login page */
            'login.heading': 'LOGIN',
            'login.userPh': 'name',
            'login.passPh': 'surname',
            'login.submit': 'submit',
            'login.forgot': 'Forgot',
            'login.regLabel': "Don't have ?",
            'login.regLink': 'Register here',
            'login.apk': 'Download APK',
            'login.footerLabel': '24X7 Support',
            'login.footerLink': 'WhatsApp Support',
            'login.footerBtn': 'WhatsApp',
            /* register page (consumed by any page carrying these hooks) */
            'register.heading': 'REGISTER',
            'register.namePh': 'Full name',
            'register.phonePh': 'Mobile number',
            'register.userPh': 'Username',
            'register.passPh': 'Password',
            'register.submit': 'Create Account',
            'register.terms': 'By registering you confirm you are 18+ and accept the Terms & Conditions.',
            'register.loginLabel': 'Already have an account?',
            'register.loginLink': 'Login here',
            'register.boxHeading': 'Register as New User',
            'register.boxDesc': 'Get your instant ID from whatsapp',
            'register.waBtn': 'CLICK HERE',
            'register.or': 'OR',
            'register.confirmPh': 'Confirm Password',
            'register.notice': 'Please get your ID from WhatsApp.'
        },

        /* base64 data URLs written by the admin Image Manager.
           Empty string = keep whatever the HTML ships with. */
        images: {
            logo: '',
            logoMobile: '',
            favicon: '',
            footerLogo: '',
            loginLogo: '',
            loginBg: '',
            registerLogo: '',
            registerBg: '',
            banner: '',
            whatsappIcon: '',
            crashIcon: ''
        },

        /* Repeatable home content. Empty arrays are auto-filled from the
           existing markup the first time the site loads (see harvest). */
        home: {
            featured: [],
            categories: [],
            sports: [],
            casino: []
        },

        /* ----------------------------------------------------------
           SEO — site wide defaults.
           Everything here is edited in /admin > SEO. Values are only
           ever applied when they are non-empty: an empty field means
           "use whatever the static HTML already says", which is what
           keeps the site correct when Supabase or JavaScript fails.
           Blank fields stay blank until real information is entered —
           nothing here is invented.
        ---------------------------------------------------------- */
        seo: {

            baseUrl: 'https://jsk-1.com',
            siteName: 'JSK1',

            /* %s is replaced by the page title. It is only applied when
               the page title does not already contain the site name, so
               a title you write in full is never doubled up. */
            titleTemplate: '%s | JSK1',

            defaultTitle: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
            defaultDescription: 'JSK1 is the official JSK1 online gaming site. Access your JSK1 account, log in, and get 24x7 support at jsk-1.com.',

            /* Social defaults. Leave the image blank until a real
               1200x630 share image exists — an empty tag is better
               than one pointing at a file that is not there. */
            defaultOgImage: '',
            defaultOgTitle: '',
            defaultOgDescription: '',

            twitterCard: 'summary_large_image',
            twitterSite: '',
            defaultTwitterImage: '',
            defaultTwitterTitle: '',
            defaultTwitterDescription: '',

            /* Only emitted into Organization schema when filled in. */
            organization: {
                name: 'JSK1',
                legalName: '',
                logo: '',
                sameAs: [],
                contactPoint: {
                    telephone: '',
                    email: '',
                    contactType: 'customer support'
                }
            },

            /* A verification tag is written only when its field has a
               value — empty fields emit nothing at all. */
            verification: {
                google: '',
                bing: '',
                yandex: ''
            },

            schema: {
                organization: true,
                website: true
            }
        },

        /* ----------------------------------------------------------
           INFO PAGES — About, Contact, Responsible Gaming.
           Each page owns its own SEO head (title + metaDescription),
           its H1, a lead paragraph and a body of free HTML. Everything
           is edited in /admin > Pages and rides the same save/publish
           path as every other section of this object.
           An empty value means "keep whatever the HTML file ships
           with", so a page is never blank if the CMS cannot be read.
        ---------------------------------------------------------- */
        /* Page Builder drafts. Never rendered on the public site — the
           renderer only ever reads pages.<slug>.builder with a published
           status. Editing here cannot change what visitors see. */
        builderDrafts: {},

        pages: {

            /* The homepage is part of the SEO system too — its title is
               no longer taken from branding.browserTitle, which is what
               used to overwrite it with the shipped white label name. */
            home: {
                label: 'Home',
                url: '',
                slug: '',
                canonical: '',
                robots: { index: true, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: 'Home', show: false },
                schema: { webPage: true, breadcrumb: false, contactPage: false },
                inSitemap: true,
                updatedAt: '2026-09-17',
                title: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
                metaDescription: 'JSK1 is the official JSK1 online gaming site. Access your JSK1 account, log in, and get 24x7 support. Visit the official JSK1 website at jsk-1.com.',
                heading: 'JSK1 — Official Online Gaming Site',
                lead: '',
                body: ''
            },

            login: {
                label: 'Login',
                url: 'login.html',
                slug: 'login',
                canonical: '',
                robots: { index: false, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: '', show: false },
                schema: { webPage: false, breadcrumb: false, contactPage: false },
                inSitemap: false,
                updatedAt: '2026-09-17',
                title: 'Login — JSK1',
                metaDescription: 'Sign in to your JSK1 account on the official JSK1 website.',
                heading: '',
                lead: '',
                body: ''
            },

            register: {
                label: 'Register',
                url: 'register.html',
                slug: 'register',
                canonical: '',
                robots: { index: false, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: '', show: false },
                schema: { webPage: false, breadcrumb: false, contactPage: false },
                inSitemap: false,
                updatedAt: '2026-09-17',
                title: 'Register — JSK1',
                metaDescription: 'Create a JSK1 account on the official JSK1 website.',
                heading: '',
                lead: '',
                body: ''
            },

            about: {
                label: 'About',
                slug: 'about',
                canonical: '',
                robots: { index: true, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: 'About', show: true },
                schema: { webPage: true, breadcrumb: true, contactPage: false },
                inSitemap: true,
                updatedAt: '2026-09-17',
                url: 'about.html',
                title: 'About JSK1 — About the Official JSK1 Website',
                metaDescription: 'Learn about JSK1, the official JSK1 online gaming website. Find out what JSK1 offers and how to get started at jsk-1.com.',
                heading: 'About JSK1',
                lead: 'The official JSK1 website — jsk-1.com.',
                body:
                    '<p>JSK1 is an online gaming site. This page is where you tell visitors who you are, ' +
                    'what the site offers and how to get started. Edit all of it in /admin &gt; Pages &gt; About.</p>\n' +
                    '<h2>What JSK1 offers</h2>\n' +
                    '<p class="page-note">Editable placeholder — describe the games and features you actually offer, ' +
                    'in your own words. Nothing here has been written for you, because only you know what is true of your site.</p>\n' +
                    '<h2>Getting started with JSK1</h2>\n' +
                    '<p>To use JSK1, create an account on the <a href="register.html">Register</a> page, then sign in ' +
                    'from the <a href="login.html">Login</a> page. If you need help, the ways to reach us are listed on ' +
                    'the <a href="contact.html">Contact</a> page.</p>\n' +
                    '<h2>Play responsibly</h2>\n' +
                    '<p>JSK1 is intended for adults aged 18 and over. Please read our ' +
                    '<a href="responsible-gaming.html">Responsible Gaming</a> page before you play.</p>'
            },

            contact: {
                label: 'Contact',
                slug: 'contact',
                canonical: '',
                robots: { index: true, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: 'Contact', show: true },
                schema: { webPage: true, breadcrumb: true, contactPage: true },
                inSitemap: true,
                updatedAt: '2026-09-17',
                url: 'contact.html',
                title: 'Contact JSK1 — JSK1 Support & Help',
                metaDescription: 'Contact JSK1 support. Reach the official JSK1 team for help with your JSK1 account at jsk-1.com.',
                heading: 'Contact JSK1',
                lead: 'Get in touch with the JSK1 support team.',
                body:
                    '<p>Use any of the channels below to reach us about your account, signing in, or a general question.</p>\n' +
                    '<ul class="contact-list">\n' +
                    '  <li><i class="fab fa-whatsapp"></i> <span>WhatsApp: ' +
                    '<span class="page-note">add your real WhatsApp number here</span></span></li>\n' +
                    '  <li><i class="fas fa-envelope"></i> <span>Email: ' +
                    '<span class="page-note">add your real support email here</span></span></li>\n' +
                    '  <li><i class="fas fa-clock"></i> <span>Support hours: ' +
                    '<span class="page-note">add your real support hours here</span></span></li>\n' +
                    '</ul>\n' +
                    '<h2>Before you contact us</h2>\n' +
                    '<p>If you are trying to sign in, go to the <a href="login.html">JSK1 Login</a> page. ' +
                    'New here? Create an account on the <a href="register.html">JSK1 Register</a> page. ' +
                    'You can read more about the site on the <a href="about.html">About JSK1</a> page.</p>'
            },

            'responsible-gaming': {
                label: 'Responsible Gaming',
                slug: 'responsible-gaming',
                canonical: '',
                robots: { index: true, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: 'Responsible Gaming', show: true },
                schema: { webPage: true, breadcrumb: true, contactPage: false },
                inSitemap: true,
                updatedAt: '2026-09-17',
                url: 'responsible-gaming.html',
                title: 'Responsible Gaming — JSK1',
                metaDescription: 'JSK1 responsible gaming information: 18+ only, setting limits, spotting warning signs and where to get help. Official JSK1 site, jsk-1.com.',
                heading: 'Responsible Gaming',
                lead: 'Keeping play safe, and knowing where to get help.',
                body:
                    '<p>Gaming should stay fun and under control. This page explains how to keep your play responsible ' +
                    'and where to find help if it stops feeling that way.</p>\n' +
                    '<h2>18+ only</h2>\n' +
                    '<p>JSK1 is strictly for adults aged 18 and over. Underage gaming is not permitted. ' +
                    'If you are under 18, please do not create an account or play.</p>\n' +
                    '<h2>Play within your limits</h2>\n' +
                    '<p>A few simple habits keep gaming healthy:</p>\n' +
                    '<ul>\n' +
                    '  <li>Set a budget before you play and treat it as entertainment, not a way to make money.</li>\n' +
                    '  <li>Never play with money you cannot afford to lose.</li>\n' +
                    '  <li>Set time limits and take regular breaks.</li>\n' +
                    '  <li>Do not try to win back losses by playing more.</li>\n' +
                    '  <li>Do not play when stressed, upset, or under the influence of alcohol.</li>\n' +
                    '</ul>\n' +
                    '<h2>Warning signs</h2>\n' +
                    '<p>It may be time to step back if you notice yourself:</p>\n' +
                    '<ul>\n' +
                    '  <li>Spending more time or money than you intended.</li>\n' +
                    '  <li>Chasing losses or borrowing money to play.</li>\n' +
                    '  <li>Neglecting work, studies, or relationships because of gaming.</li>\n' +
                    '  <li>Feeling anxious, guilty, or unable to stop.</li>\n' +
                    '</ul>\n' +
                    '<h2>Getting help</h2>\n' +
                    '<p>If gaming is no longer under control, help is available. Support organisations such as ' +
                    '<a href="https://www.begambleaware.org/" rel="noopener nofollow" target="_blank">BeGambleAware</a> and ' +
                    '<a href="https://www.gamcare.org.uk/" rel="noopener nofollow" target="_blank">GamCare</a> ' +
                    'offer free, confidential advice.</p>\n' +
                    '<p class="page-note">Editable placeholder — add a helpline for your own country or region here.</p>\n' +
                    '<h2>Talk to us</h2>\n' +
                    '<p>If you have a question about your account or want to limit your play, reach us through the ' +
                    '<a href="contact.html">Contact</a> page.</p>'
            }
        },

        /* Saved white labels. Seeded on first run by the admin panel;
           each entry is { id, name, brand:{}, colors:{}, images:{} }. */
        themes: {},


        /* ----------------------------------------------------------
           SPORTS / EVENT TABLE — presentation only.
           Edited in /admin > Sports Table. Each value is painted as a
           CSS variable that css/style.css and css/responsive.css read
           with a matching fallback, so a saved record without this
           section renders exactly as the stylesheets ship.
           Colours are deliberately absent: the table already draws from
           the global palette in /admin > Colors (--back, --lay,
           --lock-bg, --labels-bg, --table-*), and duplicating them here
           would give two places to change the same thing.
        ---------------------------------------------------------- */
        sportsTable: {

            /* desktop — one line per event */
            titleSize: '11',
            titleWeight: '700',
            dateSize: '9',
            oddsHeight: '22',
            oddsSize: '11',
            oddsWeight: '700',
            cellGap: '1',
            dotSize: '7',
            lockSize: '12',
            rowSeparator: '1',

            /* mobile — four stacked lines per event */
            mobTitleSize: '12.5',
            mobDateSize: '10.5',
            mobDateGap: '0',
            mobLabelSize: '12',
            mobLabelGap: '3',
            mobLabelPad: '0',
            mobOddsHeight: '19',
            mobOddsSize: '11.5',
            mobLockSize: '13',
            mobRowPad: '3',
            mobRowGap: '3'
        },

        /* Per-section typography. Empty string = inherit existing CSS. */
        typography: {},

        /* Registration page — toggles + appearance (see /admin > Registration) */
        registerPage: {
            enabled: true,
            primary: '#3880bd',
            green: '#5cb85c',
            bg: '',
            radius: '5',
            greyBg: '#d5d5d5'
        },

        settings: {
            preset: 'playzone',
            activeTheme: 'playzone',
            version: 2
        }
    };

    /* ========================================================
       STORAGE
    ======================================================== */
    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    function merge(base, over) {
        var out = clone(base), k;
        if (!over) return out;
        for (k in over) {
            if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
            if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) &&
                out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) {
                out[k] = merge(out[k], over[k]);
            } else if (over[k] !== undefined) {
                out[k] = over[k];
            }
        }
        return out;
    }

    var state = null;

    function load() {
        if (state) return state;
        var raw = null;
        try { raw = window.localStorage.getItem(KEY); } catch (e) { raw = null; }
        var parsed = null;
        if (raw) {
            try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        }
        /* Layering, lowest priority first:
             DEFAULTS          shipped in this file
             window.CMS_BRAND  js/brand.js — published fallback
             parsed            localStorage. With remote storage on this is just
                               a cache of the server row, so every device agrees.
                               With remote off it is this browser's own edits.   */
        state = merge(merge(DEFAULTS, window.CMS_BRAND || null), parsed);
        return state;
    }

    function save(next) {
        if (next) state = next;
        try {
            window.localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {
            /* Quota is the usual culprit — images stored as data URLs. */
            console.warn('[CMS] Could not save. Storage is probably full ' +
                         '(large images). Try smaller uploads.', e);
            if (window.CMS_ON_QUOTA) window.CMS_ON_QUOTA(e);
            return false;
        }
        return true;
    }

    function get(path, fallback) {
        var parts = String(path).split('.'), cur = load(), i;
        for (i = 0; i < parts.length; i++) {
            if (cur == null) return fallback;
            cur = cur[parts[i]];
        }
        return cur === undefined || cur === '' ? fallback : cur;
    }

    function set(path, value) {
        var parts = String(path).split('.'), cur = load(), i;
        for (i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
        return state;
    }

    /* ========================================================
       CSS VARIABLES
    ======================================================== */
    var previewColors = null;   /* set by CMS.preview(), never saved */


    /* ========================================================
       TYPOGRAPHY  — per-section font controls
       Each section maps to real selectors on the site. Only
       properties with a value are emitted, so anything left
       blank keeps whatever the stylesheet already does.
    ======================================================== */

    var TYPO_TARGETS = {
        base:         'body',
        headerBtns:   '.btn-demo, .btn-login, .btn-register, .btn-apk',
        marquee:      '.header-ticker, .header-ticker *',
        nav:          '.nav-link, .nav-link span',
        mobileNav:    '.mob-cat-item',
        liveStrip:    '.live-strip-inner, .live-match-item, .match-name',
        sportTabs:    '.sport-tab-label',
        groupHeader:  '.match-group-header',
        matchTitle:   '.match-title',
        matchMeta:    '.match-meta, .match-datetime',
        odds:         '.odds-btn',
        casinoLabels: '.casino-ph-label',
        sidebar:      '.sidebar-heading, .sidebar-list a',
        support:      '.support-section, .support-link',
        footer:       '.site-footer, .footer-copy, .footer-safe'
    };

    var TYPO_PROPS = {
        fontFamily:    'font-family',
        fontSize:      'font-size',
        fontWeight:    'font-weight',
        fontStyle:     'font-style',
        letterSpacing: 'letter-spacing',
        lineHeight:    'line-height',
        textTransform: 'text-transform'
    };

    /* px suffix only where a bare number was typed */
    function typoValue(prop, raw) {
        var v = String(raw == null ? '' : raw).trim();
        if (!v) return '';
        if ((prop === 'fontSize' || prop === 'letterSpacing') && /^-?[0-9.]+$/.test(v)) v += 'px';
        return v;
    }

    function buildTypographyCSS() {
        var typo = (load().typography) || {};
        var css = '';
        for (var section in TYPO_TARGETS) {
            if (!TYPO_TARGETS.hasOwnProperty(section)) continue;
            var conf = typo[section];
            if (!conf) continue;
            var decls = '';
            for (var key in TYPO_PROPS) {
                if (!TYPO_PROPS.hasOwnProperty(key)) continue;
                var val = typoValue(key, conf[key]);
                if (val) decls += TYPO_PROPS[key] + ':' + val + ' !important;';
            }
            if (decls) css += TYPO_TARGETS[section] + '{' + decls + '}\n';
        }
        return css;
    }


    /* ========================================================
       SPORTS / EVENT TABLE -> CSS variables
       One variable per configured value. A blank or missing value is
       skipped entirely, which leaves the stylesheet's own fallback in
       place — that is what keeps older saved records working.
    ======================================================== */

    var ST_VARS = {
        titleSize:     ['--st-title-size',   'px'],
        titleWeight:   ['--st-title-weight', ''],
        dateSize:      ['--st-date-size',    'px'],
        oddsHeight:    ['--st-odds-h',       'px'],
        oddsSize:      ['--st-odds-size',    'px'],
        oddsWeight:    ['--st-odds-weight',  ''],
        cellGap:       ['--st-cell-gap',     'px'],
        dotSize:       ['--st-dot-size',     'px'],
        lockSize:      ['--st-lock-size',    'px'],
        rowSeparator:  ['--st-row-sep',      'px'],
        mobTitleSize:  ['--stm-title-size',  'px'],
        mobDateSize:   ['--stm-date-size',   'px'],
        mobDateGap:    ['--stm-date-gap',    'px'],
        mobLabelSize:  ['--stm-label-size',  'px'],
        mobLabelGap:   ['--stm-label-gap',   'px'],
        mobLabelPad:   ['--stm-label-pad',   'px'],
        mobOddsHeight: ['--stm-odds-h',      'px'],
        mobOddsSize:   ['--stm-odds-size',   'px'],
        mobLockSize:   ['--stm-lock-size',   'px'],
        mobRowPad:     ['--stm-row-pad',     'px'],
        mobRowGap:     ['--stm-row-gap',     'px']
    };

    function sportsTableCSS(conf) {
        conf = conf || (load().sportsTable) || {};
        var out = '', k;
        for (k in ST_VARS) {
            if (!Object.prototype.hasOwnProperty.call(ST_VARS, k)) continue;
            var v = String(conf[k] == null ? '' : conf[k]).trim();
            if (!v) continue;                       /* keep the CSS fallback */
            var unit = ST_VARS[k][1];
            if (unit && /^-?[0-9.]+$/.test(v)) v += unit;
            out += ST_VARS[k][0] + ':' + v + ';';
        }
        return out;
    }

    function paintSportsTable() {
        var css = sportsTableCSS();
        var tag = document.getElementById('cmsSportsTable');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cmsSportsTable';
            (document.head || document.documentElement).appendChild(tag);
        }
        tag.textContent = css ? ':root{' + css + '}' : '';
    }

    /* Registration page appearance -> CSS variables */
    function paintRegister() {
        var rp = (load().registerPage) || {};
        var root = document.documentElement;
        if (rp.primary) root.style.setProperty('--reg-primary', rp.primary);
        if (rp.green)   root.style.setProperty('--reg-green', rp.green);
        if (rp.greyBg)  root.style.setProperty('--reg-grey', rp.greyBg);
        if (rp.bg)      root.style.setProperty('--reg-bg', rp.bg);
        if (rp.radius !== '' && rp.radius != null) {
            root.style.setProperty('--reg-radius', String(rp.radius).replace(/px$/, '') + 'px');
        }
    }

    function paintTypography() {
        var tag = document.getElementById('cmsTypography');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cmsTypography';
            (document.head || document.documentElement).appendChild(tag);
        }
        tag.textContent = buildTypographyCSS();
    }

    function paintVars() {
        var c = load().colors, css = ':root{', k;
        if (previewColors) {
            c = merge(c, previewColors);
        }
        for (k in c) {
            if (Object.prototype.hasOwnProperty.call(c, k) && c[k]) {
                if (k === 'login-bg-from' || k === 'login-bg-to') continue;
                css += '--' + k + ':' + c[k] + ';';
            }
        }
        /* login page gradient is composed from two stops */
        if (c['login-bg-from'] && c['login-bg-to']) {
            css += '--login-bg:linear-gradient(168deg,' + c['login-bg-from'] +
                   ' 0%,' + c['login-bg-to'] + ' 100%);';
            css += '--brand:' + (c['login-btn-bg'] || c['hdr-bg']) + ';';
        }
        css += '}';

        var tag = document.getElementById('cmsVars');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cmsVars';
            (document.head || document.documentElement).appendChild(tag);
        }
        tag.textContent = css;

        paintTypography();
        paintRegister();
        paintSportsTable();
    }

    /* ========================================================
       SEO ENGINE
       ------------------------------------------------------
       THE RULE THIS FILE LIVES BY: the static HTML is correct on
       its own. The CMS only ever OVERWRITES a tag when it holds a
       real, non-empty value for it. An empty or missing CMS value
       leaves the markup exactly as the file shipped it.

       That is what makes a Supabase outage, a failed fetch, an
       empty localStorage or a JavaScript error harmless: the page
       keeps the correct title, description, canonical and social
       tags that are written into the file itself.

       A page identifies itself with  <html data-cms-page="about">.
       Pages without that attribute (the admin panel) are left
       completely alone — nothing here touches their title.
    ======================================================== */

    function str(v) { return v == null ? '' : String(v).trim(); }

    function pageKey() {
        var el = document.documentElement;
        return el ? str(el.getAttribute('data-cms-page')) : '';
    }

    function pageData(key) {
        var pages = load().pages || {};
        return pages[key || pageKey()] || null;
    }

    /* Absolute URL against the configured base. Values that are
       already absolute are returned untouched. */
    function absUrl(u) {
        u = str(u);
        if (!u) return '';
        if (/^https?:\/\//i.test(u) || /^data:/i.test(u)) return u;
        var base = str(get('seo.baseUrl', '')).replace(/\/+$/, '');
        if (!base) return u;
        return base + '/' + u.replace(/^\/+/, '');
    }

    /* An image URL a crawler can actually fetch. A data: or blob: URL is
       rejected outright: og:image, twitter:image and Organization.logo are
       retrieved server-side by the platform, so an inline image is not just
       oversized in the tag, it is unusable. Returning '' means the tag is
       simply not written, which is the honest outcome. */
    function crawlableImage(u) {
        u = str(u);
        if (!u) return '';
        if (/^(data|blob):/i.test(u)) return '';
        return absUrl(u);
    }

    /* The page's own address, used for canonical and og:url. */
    function pageUrl(page) {
        if (page && str(page.canonical)) return absUrl(page.canonical);
        var base = str(get('seo.baseUrl', '')).replace(/\/+$/, '');
        if (!base) return '';
        var u = page ? str(page.url) : '';
        return u ? base + '/' + u.replace(/^\/+/, '') : base + '/';
    }

    function computeTitle(page) {
        var t = page ? str(page.title) : '';
        if (!t) t = str(get('seo.defaultTitle', ''));
        if (!t) return '';                     /* leave the static title */
        var tpl  = str(get('seo.titleTemplate', ''));
        var site = str(get('seo.siteName', ''));
        /* Only apply the template when the title does not already
           carry the brand, so a full title is never doubled up. */
        if (tpl && tpl.indexOf('%s') > -1 && site &&
            t.toLowerCase().indexOf(site.toLowerCase()) === -1) {
            t = tpl.replace('%s', t);
        }
        return t;
    }

    function computeDescription(page) {
        return (page ? str(page.metaDescription) : '') ||
               str(get('seo.defaultDescription', ''));
    }

    /* Social values cascade: page -> global default -> the plain
       title/description -> nothing. */
    function computeOg(page, what) {
        var v = page && page.og ? str(page.og[what]) : '';
        if (v) return v;
        v = str(get('seo.defaultOg' + what.charAt(0).toUpperCase() + what.slice(1), ''));
        if (v) return v;
        if (what === 'title') return computeTitle(page);
        if (what === 'description') return computeDescription(page);
        return '';
    }

    function computeTwitter(page, what) {
        var v = page && page.twitter ? str(page.twitter[what]) : '';
        if (v) return v;
        v = str(get('seo.defaultTwitter' + what.charAt(0).toUpperCase() + what.slice(1), ''));
        return v || computeOg(page, what);      /* inherit OG by default */
    }

    function robotsValue(page) {
        if (!page || !page.robots) return '';
        var r = page.robots;
        if (r.index === undefined && r.follow === undefined) return '';
        return (r.index === false ? 'noindex' : 'index') + ',' +
               (r.follow === false ? 'nofollow' : 'follow');
    }

    /* --- tag writers. Each one is a no-op on an empty value. --- */

    function setMeta(attr, name, value) {
        value = str(value);
        if (!value) return;                     /* keep the static tag */
        var sel = 'meta[' + attr + '="' + name + '"]';
        var el = document.head ? document.head.querySelector(sel) : null;
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute(attr, name);
            (document.head || document.documentElement).appendChild(el);
        }
        el.setAttribute('content', value);
    }

    function setLink(rel, href) {
        href = str(href);
        if (!href) return;
        var el = document.head ? document.head.querySelector('link[rel="' + rel + '"]') : null;
        if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            (document.head || document.documentElement).appendChild(el);
        }
        el.setAttribute('href', href);
    }

    function paintSeo() {
        var key = pageKey();
        var legacy = document.querySelector('title[data-cms-title]');

        /* No page identity and no legacy hook -> do not touch a thing. */
        if (!key && !legacy) return;

        var page = key ? pageData(key) : null;

        var title = page ? computeTitle(page)
                         : get(legacy.getAttribute('data-cms-title'), '');
        if (title) document.title = title;
        if (!page) return;

        setMeta('name', 'description', computeDescription(page));
        setMeta('name', 'robots', robotsValue(page));
        setLink('canonical', pageUrl(page));

        setMeta('property', 'og:site_name', get('seo.siteName', ''));
        setMeta('property', 'og:title', computeOg(page, 'title'));
        setMeta('property', 'og:description', computeOg(page, 'description'));
        setMeta('property', 'og:url', pageUrl(page));
        setMeta('property', 'og:image', crawlableImage(computeOg(page, 'image')));

        setMeta('name', 'twitter:card', get('seo.twitterCard', ''));
        setMeta('name', 'twitter:site', get('seo.twitterSite', ''));
        setMeta('name', 'twitter:title', computeTwitter(page, 'title'));
        setMeta('name', 'twitter:description', computeTwitter(page, 'description'));
        setMeta('name', 'twitter:image', crawlableImage(computeTwitter(page, 'image')));

        /* Verification tags are created only when a code is present. */
        setMeta('name', 'google-site-verification', get('seo.verification.google', ''));
        setMeta('name', 'msvalidate.01', get('seo.verification.bing', ''));
        setMeta('name', 'yandex-verification', get('seo.verification.yandex', ''));

        paintSchema(page);
    }

    /* ========================================================
       STRUCTURED DATA
       Written into the <script> tags the HTML already ships, so
       the markup stays valid with JavaScript disabled. A block is
       only replaced when the CMS can build a complete one, and a
       block that is switched off is emptied rather than left stale.
    ======================================================== */

    function writeLd(id, obj) {
        var el = document.getElementById(id);
        if (!el) return;
        if (!obj) { el.textContent = '{}'; return; }
        obj['@context'] = 'https://schema.org';
        el.textContent = JSON.stringify(obj, null, 2);
    }

    function buildOrganization() {
        if (get('seo.schema.organization', true) === false) return null;
        var org = (load().seo && load().seo.organization) || {};
        var name = str(org.name) || str(get('seo.siteName', ''));
        if (!name) return null;
        var out = { '@type': 'Organization', name: name, url: absUrl('') || str(get('seo.baseUrl', '')) };
        if (str(org.legalName)) out.legalName = str(org.legalName);
        /* The uploaded CMS logo is a data URL and cannot be used here — see
           crawlableImage(). The property stays absent until a real file URL
           is set in /admin > SEO > Structured Data. */
        var logo = crawlableImage(org.logo);
        if (logo) out.logo = logo;
        var same = (org.sameAs || []).map(str).filter(Boolean);
        if (same.length) out.sameAs = same;
        var cp = org.contactPoint || {};
        if (str(cp.telephone) || str(cp.email)) {
            out.contactPoint = { '@type': 'ContactPoint',
                                 contactType: str(cp.contactType) || 'customer support' };
            if (str(cp.telephone)) out.contactPoint.telephone = str(cp.telephone);
            if (str(cp.email)) out.contactPoint.email = str(cp.email);
        }
        return out;
    }

    function buildWebSite() {
        if (get('seo.schema.website', true) === false) return null;
        var name = str(get('seo.siteName', ''));
        var url = str(get('seo.baseUrl', ''));
        if (!name || !url) return null;
        /* No SearchAction: this site has no search, and declaring one
           it does not have would misrepresent it. */
        return { '@type': 'WebSite', name: name, url: url.replace(/\/+$/, '') + '/' };
    }

    function buildWebPage(page) {
        if (!page || !page.schema || page.schema.webPage === false) return null;
        var name = str(page.title) || str(page.heading);
        var url = pageUrl(page);
        if (!name || !url) return null;
        var out = {
            '@type': page.schema.contactPage ? 'ContactPage' : 'WebPage',
            name: name,
            url: url,
            inLanguage: 'en'
        };
        var d = computeDescription(page);
        if (d) out.description = d;
        var site = str(get('seo.baseUrl', ''));
        if (site) out.isPartOf = { '@type': 'WebSite', url: site.replace(/\/+$/, '') + '/' };
        return out;
    }

    /* Breadcrumb schema is only emitted when the page actually shows a
       breadcrumb — Google requires the markup to match what is visible. */
    function buildBreadcrumb(page) {
        if (!page || !page.schema || !page.schema.breadcrumb) return null;
        if (!page.breadcrumb || !page.breadcrumb.show) return null;
        if (!document.querySelector('.breadcrumb')) return null;
        var base = str(get('seo.baseUrl', '')).replace(/\/+$/, '');
        var label = str(page.breadcrumb.label) || str(page.label);
        if (!base || !label) return null;
        return {
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: base + '/' },
                { '@type': 'ListItem', position: 2, name: label, item: pageUrl(page) }
            ]
        };
    }

    function paintSchema(page) {
        writeLd('ldOrganization', buildOrganization());
        writeLd('ldWebSite', buildWebSite());
        writeLd('ldPage', buildWebPage(page));
        writeLd('ldBreadcrumb', buildBreadcrumb(page));
    }

    /* ========================================================
       HEAD — SEO + favicon
    ======================================================== */
    function paintHead() {
        paintSeo();
        paintPageMeta();

        var fav = get('images.favicon');
        if (fav) {
            var link = document.getElementById('cmsFavicon');
            if (!link) {
                link = document.createElement('link');
                link.id = 'cmsFavicon';
                link.rel = 'icon';
                (document.head || document.documentElement).appendChild(link);
            }
            link.href = fav;
        }
    }

    /* ========================================================
       PAGE BUILDER (v1)
       ------------------------------------------------------
       Renders pages.<slug>.builder.sections into a mount point
       <div data-cms-sections="slug">. Three guards keep existing
       pages safe: no mount point means no builder; a builder whose
       status is not "published" is ignored; an empty sections list
       is ignored. In every one of those cases the markup already in
       the page is left exactly as the browser parsed it.

       Content is written with textContent and controlled attributes.
       No element type in v1 injects markup.
    ======================================================== */

    /* Page Builder schema version.

       This is a MARKER, never a gate. The renderer must go on drawing
       schemaVersion 1 blocks — and blocks with no version at all — for as
       long as this code lives, because published pages out there carry them
       and nothing rewrites those pages until someone edits them.

       New writes stamp PB_SCHEMA. Old blocks keep whatever they were saved
       with until the admin edits and saves that page, so an upgrade is never
       forced on content nobody touched. Reading is tolerant in both
       directions: an older block gets V2 defaults through pbUpgrade(), and a
       NEWER block than this code understands still renders, because every
       V2 field is optional and unknown element types are skipped rather than
       thrown on. (A visitor on a cached V1 cms.js reading a V2 row therefore
       loses the new elements but keeps the page.)

       tests/test_pagebuilder_compat.js holds a frozen V1 payload and the
       render it produced at 1ce70b5. If a change here alters that render,
       that suite fails, and it is meant to. */
    var PB_SCHEMA = 2;

    /* Migration steps, oldest first. A step takes the sections array as the
       previous version wrote it and returns the array this version wants.

       A step that changes nothing returns the SAME array reference, so the
       common path — already-current data on every repaint — costs nothing.
       A step that does transform must not mutate its input; build a new
       array instead, because the caller may be holding published state.

       1 -> 2 is deliberately identity. Everything V2 adds is an optional
       field with a safe default, so V1 data needs no rewriting to render
       correctly under V2; the step exists so the chain is real and tested
       from the start, and so later versions have one obvious place to go. */
    var PB_MIGRATIONS = [
        { to: 2, fn: function (sections) { return sections; } }
    ];

    /* The version a stored block claims. Absent means V1: the first release
       stamped every block it wrote, so a block with no version predates
       nothing and can only be V1-shaped. */
    function pbSchemaOf(block) {
        var v = block && block.schemaVersion;
        return (typeof v === 'number' && v > 0) ? v : 1;
    }

    function pbUpgrade(sections, from) {
        if (!isArr(sections)) return sections;
        var v = (typeof from === 'number' && from > 0) ? from : 1;
        for (var i = 0; i < PB_MIGRATIONS.length; i++) {
            if (PB_MIGRATIONS[i].to > v) {
                sections = PB_MIGRATIONS[i].fn(sections) || sections;
                v = PB_MIGRATIONS[i].to;
            }
        }
        return sections;
    }

    /* style key -> [custom property, unit appended to bare numbers] */
    /* Custom properties live in two separate namespaces on purpose.

       Custom properties inherit. With one shared namespace a section's
       --pb-padding reached every heading, button and card inside it, and a
       card's --pb-bg reached the button in that card. Sections now write
       --pbs-*, elements write --pbe-*, and each element node resets every
       --pbe-* it might have inherited (see .pb-el in css/sections.css), so a
       value can only ever style the node it was set on. */
    var PB_SEC_TOKENS = {
        bg:         ['--pbs-bg', ''],
        bgImage:    ['--pbs-bg-image', ''],
        color:      ['--pbs-color', ''],
        fontSize:   ['--pbs-font-size', 'px'],
        fontWeight: ['--pbs-font-weight', ''],
        align:      ['--pbs-align', ''],
        padding:    ['--pbs-padding', 'px'],
        margin:     ['--pbs-margin', 'px'],
        maxWidth:   ['--pbs-max-width', 'px'],
        height:     ['--pbs-height', 'px'],
        border:     ['--pbs-border', ''],
        radius:     ['--pbs-radius', 'px'],
        shadow:     ['--pbs-shadow', ''],
        gap:        ['--pbs-gap', 'px']
    };

    var PB_EL_TOKENS = {
        bg:         ['--pbe-bg', ''],
        color:      ['--pbe-color', ''],
        fontSize:   ['--pbe-font-size', 'px'],
        fontWeight: ['--pbe-font-weight', ''],
        align:      ['--pbe-align', ''],
        padding:    ['--pbe-padding', 'px'],
        margin:     ['--pbe-margin', 'px'],
        maxWidth:   ['--pbe-max-width', 'px'],
        height:     ['--pbe-height', 'px'],
        border:     ['--pbe-border', ''],
        radius:     ['--pbe-radius', 'px'],
        shadow:     ['--pbe-shadow', ''],
        gap:        ['--pbe-gap', 'px'],
        /* V2: a divider's rule is its own thing, not the element's border */
        lineWidth:  ['--pbe-line-width', 'px'],
        lineStyle:  ['--pbe-line-style', ''],
        lineColor:  ['--pbe-line-color', '']
    };

    /* Which controls actually do something for each element type. The admin
       builds its Design tab from this, so a control is never offered for an
       element whose CSS would ignore it. */
    var PB_EL_STYLE_KEYS = {
        heading: ['color', 'fontSize', 'fontWeight', 'align', 'bg', 'padding',
                  'margin', 'maxWidth', 'border', 'radius', 'shadow'],
        text:    ['color', 'fontSize', 'fontWeight', 'align', 'bg', 'padding',
                  'margin', 'maxWidth', 'border', 'radius', 'shadow'],
        image:   ['align', 'margin', 'maxWidth', 'height', 'border', 'radius', 'shadow'],
        button:  ['bg', 'color', 'fontSize', 'fontWeight', 'align', 'padding',
                  'margin', 'border', 'radius', 'shadow'],
        card:    ['bg', 'color', 'align', 'padding', 'margin', 'maxWidth', 'gap',
                  'border', 'radius', 'shadow'],
        columns: ['align', 'margin', 'maxWidth', 'gap'],

        /* V2 elements. Same rule as above: a key appears here only if the
           CSS below actually reads it, so the admin can never offer a
           control that does nothing. */
        divider:     ['lineWidth', 'lineStyle', 'lineColor', 'maxWidth', 'align', 'margin'],
        spacer:      ['height', 'maxWidth'],
        icon:        ['color', 'fontSize', 'align', 'bg', 'padding', 'margin', 'radius'],
        notice:      ['bg', 'color', 'fontSize', 'fontWeight', 'align', 'padding', 'margin',
                      'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        featureBox:  ['bg', 'color', 'fontSize', 'fontWeight', 'align', 'padding', 'margin',
                      'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        faq:         ['bg', 'color', 'fontSize', 'fontWeight', 'align', 'padding', 'margin',
                      'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        socialLinks: ['color', 'fontSize', 'align', 'bg', 'padding', 'margin', 'gap', 'radius']
    };

    /* ---- V2 allow-lists ----
       An icon is chosen by NAME from this map, never by class string, so
       nothing a page author types can become a class on the page. The
       values are Font Awesome 6 classes, which the site already loads. */
    var PB_ICONS = {
        star:      'fa-solid fa-star',
        check:     'fa-solid fa-circle-check',
        info:      'fa-solid fa-circle-info',
        warning:   'fa-solid fa-triangle-exclamation',
        danger:    'fa-solid fa-circle-exclamation',
        question:  'fa-solid fa-circle-question',
        shield:    'fa-solid fa-shield-halved',
        lock:      'fa-solid fa-lock',
        bolt:      'fa-solid fa-bolt',
        clock:     'fa-solid fa-clock',
        gift:      'fa-solid fa-gift',
        trophy:    'fa-solid fa-trophy',
        wallet:    'fa-solid fa-wallet',
        phone:     'fa-solid fa-phone',
        envelope:  'fa-solid fa-envelope',
        headset:   'fa-solid fa-headset',
        user:      'fa-solid fa-user',
        users:     'fa-solid fa-users',
        heart:     'fa-solid fa-heart',
        thumbsUp:  'fa-solid fa-thumbs-up',
        rocket:    'fa-solid fa-rocket',
        chart:     'fa-solid fa-chart-line',
        mobile:    'fa-solid fa-mobile-screen',
        creditCard:'fa-solid fa-credit-card'
    };

    /* Platform -> [icon class, accessible name]. A link whose platform is
       not in here is dropped, so no arbitrary icon markup is reachable. */
    var PB_SOCIAL = {
        whatsapp:  ['fa-brands fa-whatsapp',  'WhatsApp'],
        telegram:  ['fa-brands fa-telegram',  'Telegram'],
        facebook:  ['fa-brands fa-facebook',  'Facebook'],
        instagram: ['fa-brands fa-instagram', 'Instagram'],
        x:         ['fa-brands fa-x-twitter', 'X'],
        youtube:   ['fa-brands fa-youtube',   'YouTube'],
        linkedin:  ['fa-brands fa-linkedin',  'LinkedIn'],
        email:     ['fa-solid fa-envelope',   'Email']
    };

    var PB_NOTICE_VARIANTS = { info: 1, success: 1, warning: 1, danger: 1 };
    var PB_HEADING_LEVELS = { h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 };

    /* Unique, valid HTML ids for the FAQ's aria wiring, even when an
       element's own id is missing or not selector-safe. */
    var pbAutoId = 0;
    function pbDomId(el, suffix) {
        var base = pbCssId(el && el.id);
        if (!base) { pbAutoId += 1; base = 'a' + pbAutoId; }
        return 'pb-' + base + '-' + suffix;
    }

    /* An element's own box alignment, for the types that are laid out as a
       flex or grid item rather than as a block of text. */
    var PB_SELF = {
        left:   ['flex-start', 'start'],
        center: ['center', 'center'],
        right:  ['flex-end', 'end']
    };

    var PB_SECTION_CLASS = {
        hero:      'pb-hero',
        text:      'pb-text',
        image:     'pb-image',
        imageText: 'pb-image-text',
        cards:     'pb-cards',
        columns:   'pb-cols',
        banner:    'pb-banner'
    };

    /* Only these schemes may reach an href or src. Anything else —
       javascript:, data:, vbscript: — is dropped. A protocol-relative
       "//host" is dropped too: it reads like a site-relative path but leaves
       the site, and https:// is available for that. */
    function pbUrl(u) {
        u = str(u).trim();
        if (!u) return '';
        if (/[\u0000-\u001f\u007f]/.test(u)) return '';
        if (/^\/\//.test(u)) return '';
        if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
        if (/^[#/]/.test(u)) return u;
        if (/^[\w][\w./?=&%+-]*$/.test(u)) return u;
        return '';
    }

    /* A URL that is about to be interpolated into a CSS url("...") rather
       than handed to setAttribute. Quotes, parentheses and whitespace could
       close the function and the rule, so they are refused outright. */
    function pbCssUrl(u) {
        u = pbUrl(u);
        if (!u || /^(mailto:|tel:)/i.test(u)) return '';
        return /["'()\\\s;{}]/.test(u) ? '' : u;
    }

    /* Style values are free text in the admin (Border, Shadow, ...) and end up
       inside a generated <style> block. Without this a value such as
       "1px solid red; } body { display:none } .x {" would close the rule and
       inject CSS into every page the section is published on. */
    function pbCssValue(v) {
        v = str(v);
        if (!v) return '';
        if (/[;{}<>\\"']/.test(v)) return '';
        if (/[\u0000-\u001f\u007f]/.test(v)) return '';
        if (/url\s*\(|expression\s*\(|@import|javascript:/i.test(v)) return '';
        return v;
    }

    /* Ids are interpolated into an attribute selector, so they are limited to
       characters that cannot terminate it. Generated ids always pass; a
       hand-edited or imported config that does not simply gets no CSS. */
    function pbCssId(id) {
        id = str(id);
        return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : '';
    }

    function pbEl(tag, cls) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        return e;
    }

    /* ---- element renderers ----
       Each returns a node or null. Every node that reads a --pbe-* property
       carries the pb-el class, which resets that whole namespace, so nothing
       inherits styling from the section or from an enclosing element.
       pbId() marks the one node the element's generated CSS binds to, which
       for a linked image is the <img> rather than the wrapping <a>. */

    function pbId(node, el) {
        if (node && el && el.id) node.setAttribute('data-el', String(el.id));
        return node;
    }

    var PB_ELEMENTS = {

        heading: function (el) {
            var c = el.content || {};
            var lvl = String(c.level || 'h2').toLowerCase();
            if (['h1','h2','h3','h4','h5','h6'].indexOf(lvl) === -1) lvl = 'h2';
            var n = pbEl(lvl, 'pb-el pb-heading');
            n.textContent = str(c.text);
            return pbId(n, el);
        },

        text: function (el) {
            var n = pbEl('p', 'pb-el pb-textblock');
            n.textContent = str((el.content || {}).text);
            return pbId(n, el);
        },

        image: function (el) {
            var c = el.content || {};
            var src = pbUrl(c.src);
            if (!src) return null;
            var img = pbEl('img', 'pb-el pb-img');
            img.setAttribute('src', src);
            img.setAttribute('alt', str(c.alt));
            img.setAttribute('loading', 'lazy');
            img.setAttribute('decoding', 'async');
            if (c.width)  img.setAttribute('width', String(parseInt(c.width, 10) || ''));
            if (c.height) img.setAttribute('height', String(parseInt(c.height, 10) || ''));
            pbId(img, el);                    /* the image is what gets styled */
            var href = pbUrl(c.href);
            if (!href) return img;
            var a = pbEl('a', 'pb-el pb-img-link');
            a.setAttribute('href', href);
            if (c.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
            a.appendChild(img);
            return a;
        },

        button: function (el) {
            var c = el.content || {};
            var a = pbEl('a', 'pb-el pb-btn');
            a.textContent = str(c.text);
            var href = pbUrl(c.href);
            a.setAttribute('href', href || '#');
            if (c.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
            return pbId(a, el);
        },

        card: function (el) {
            var c = el.content || {};
            var box = pbEl('div', 'pb-el pb-card');
            if (pbUrl(c.image)) {
                box.appendChild(PB_ELEMENTS.image({ content: { src: c.image, alt: c.imageAlt,
                    width: c.imageWidth, height: c.imageHeight } }));
            }
            if (str(c.title)) {
                var h = pbEl('h3', 'pb-el pb-card-title');
                h.textContent = str(c.title);
                box.appendChild(h);
            }
            if (str(c.text)) {
                var p = pbEl('p', 'pb-el pb-card-text');
                p.textContent = str(c.text);
                box.appendChild(p);
            }
            if (str(c.buttonText)) {
                box.appendChild(PB_ELEMENTS.button({ content: {
                    text: c.buttonText, href: c.buttonHref, newTab: c.buttonNewTab } }));
            }
            return pbId(box, el);
        },

        columns: function (el, depth) {
            var cols = (el.content || {}).columns;
            if (!isArr(cols) || !cols.length) return null;
            var wrap = pbEl('div', 'pb-el pb-columns');
            for (var i = 0; i < cols.length; i++) {
                var col = pbEl('div', 'pb-column');
                pbRenderElements(col, (cols[i] || {}).elements, depth + 1);
                wrap.appendChild(col);
            }
            return pbId(wrap, el);
        },

        /* ---------------- V2 elements ---------------- */

        divider: function (el) {
            return pbId(pbEl('hr', 'pb-el pb-divider'), el);
        },

        spacer: function (el) {
            var n = pbEl('div', 'pb-el pb-spacer');
            n.setAttribute('aria-hidden', 'true');
            return pbId(n, el);
        },

        icon: function (el) {
            var c = el.content || {};
            var cls = PB_ICONS[str(c.icon)];
            if (!cls) return null;            /* unknown name renders nothing */
            var glyph = pbEl('i', 'pb-icon-glyph ' + cls);
            glyph.setAttribute('aria-hidden', 'true');
            var label = str(c.label);
            var href = pbUrl(c.href);
            /* One outer node either way, so size, colour and alignment land
               in the same place whether or not the icon links somewhere.

               A refused URL yields the plain span, NOT an anchor with
               href="#". That differs from the button element on purpose: a
               button with nowhere to go still has to look like a button,
               whereas an icon simply becomes decoration, which is better
               than a clickable link that goes nowhere. */
            if (href) {
                var a = pbEl('a', 'pb-el pb-icon');
                a.setAttribute('href', href);
                if (c.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
                /* An icon-only link has no text, so it needs a name. */
                a.setAttribute('aria-label', label || 'Link');
                a.appendChild(glyph);
                return pbId(a, el);
            }
            var span = pbEl('span', 'pb-el pb-icon');
            if (label) { span.setAttribute('role', 'img'); span.setAttribute('aria-label', label); }
            span.appendChild(glyph);
            return pbId(span, el);
        },

        notice: function (el) {
            var c = el.content || {};
            var variant = PB_NOTICE_VARIANTS[str(c.variant)] ? str(c.variant) : 'info';
            var box = pbEl('div', 'pb-el pb-notice pb-notice-' + variant);
            /* "note" is the advisory role. Deliberately not "alert": that is
               assertive and interrupts a screen reader, which is wrong for
               text that was on the page before the reader arrived. */
            box.setAttribute('role', 'note');
            var cls = PB_ICONS[str(c.icon)];
            if (cls) {
                var i = pbEl('i', 'pb-notice-icon ' + cls);
                i.setAttribute('aria-hidden', 'true');
                box.appendChild(i);
            }
            var body = pbEl('div', 'pb-notice-body');
            if (str(c.text)) {
                var t = pbEl('p', 'pb-notice-text');
                t.textContent = str(c.text);
                body.appendChild(t);
            }
            var href = pbUrl(c.href);
            if (href && str(c.linkText)) {
                var a = pbEl('a', 'pb-notice-link');
                a.setAttribute('href', href);
                if (c.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
                a.textContent = str(c.linkText);
                body.appendChild(a);
            }
            box.appendChild(body);
            return pbId(box, el);
        },

        featureBox: function (el) {
            var c = el.content || {};
            var box = pbEl('div', 'pb-el pb-feature');
            var cls = PB_ICONS[str(c.icon)];
            if (cls) {
                var i = pbEl('i', 'pb-feature-icon ' + cls);
                i.setAttribute('aria-hidden', 'true');
                box.appendChild(i);
            } else if (pbUrl(c.image)) {
                /* Reused so one image implementation covers every element:
                   no id, so it resets and takes the shipped defaults. */
                var img = PB_ELEMENTS.image({ content: { src: c.image, alt: c.imageAlt } });
                if (img) { img.className += ' pb-feature-img'; box.appendChild(img); }
            }
            if (str(c.title)) {
                var lvl = PB_HEADING_LEVELS[String(c.titleLevel || 'h3').toLowerCase()]
                    ? String(c.titleLevel).toLowerCase() : 'h3';
                var h = pbEl(lvl, 'pb-feature-title');
                h.textContent = str(c.title);
                box.appendChild(h);
            }
            if (str(c.text)) {
                var t = pbEl('p', 'pb-feature-text');
                t.textContent = str(c.text);
                box.appendChild(t);
            }
            var href = pbUrl(c.href);
            if (href && str(c.linkText)) {
                var a = pbEl('a', 'pb-feature-link');
                a.setAttribute('href', href);
                if (c.newTab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
                a.textContent = str(c.linkText);
                box.appendChild(a);
            }
            return pbId(box, el);
        },

        faq: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var wrap = pbEl('div', 'pb-el pb-faq');
            var single = c.single === true;    /* accordion: one open at a time */
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var q = str(it.question);
                if (!q) continue;              /* a question is the minimum */
                var panelId = pbDomId(el, 'p' + i);
                var btnId = pbDomId(el, 'b' + i);
                var open = it.open === true;

                var item = pbEl('div', 'pb-faq-item');
                /* A heading wrapping the button keeps the page outline
                   navigable; the button is what carries the state. */
                var h = pbEl('h3', 'pb-faq-q');
                var btn = pbEl('button', 'pb-faq-btn');
                btn.setAttribute('type', 'button');
                btn.setAttribute('id', btnId);
                btn.setAttribute('aria-controls', panelId);
                btn.setAttribute('aria-expanded', open ? 'true' : 'false');
                var qt = pbEl('span', 'pb-faq-qt');
                qt.textContent = q;
                btn.appendChild(qt);
                var mark = pbEl('span', 'pb-faq-mark');
                mark.setAttribute('aria-hidden', 'true');
                btn.appendChild(mark);
                h.appendChild(btn);
                item.appendChild(h);

                var panel = pbEl('div', 'pb-faq-a');
                panel.setAttribute('id', panelId);
                panel.setAttribute('role', 'region');
                panel.setAttribute('aria-labelledby', btnId);
                if (!open) panel.hidden = true;
                var at = pbEl('p', 'pb-faq-text');
                at.textContent = str(it.answer);
                panel.appendChild(at);
                item.appendChild(panel);

                /* Listener on the button itself. A <button> already handles
                   Enter and Space and is in the tab order, so there is no
                   key handling to write and none to get wrong. Nodes are
                   rebuilt on every repaint, so these cannot accumulate. */
                btn.addEventListener('click', pbFaqToggle(wrap, btn, panel, single));
                wrap.appendChild(item);
                made += 1;
            }
            if (!made) return null;
            return pbId(wrap, el);
        },

        socialLinks: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var wrap = pbEl('div', 'pb-el pb-social');
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var plat = PB_SOCIAL[str(it.platform)];
                if (!plat) continue;           /* platform not on the list */
                var href = pbUrl(it.url);
                if (!href) continue;           /* and the URL must pass too */
                var a = pbEl('a', 'pb-social-link');
                a.setAttribute('href', href);
                /* Social profiles live elsewhere, so always a new tab, and
                   never without both noopener and noreferrer. */
                a.setAttribute('target', '_blank');
                a.setAttribute('rel', 'noopener noreferrer');
                a.setAttribute('aria-label', str(it.label) || plat[1]);
                var g = pbEl('i', 'pb-social-icon ' + plat[0]);
                g.setAttribute('aria-hidden', 'true');
                a.appendChild(g);
                wrap.appendChild(a);
                made += 1;
            }
            if (!made) return null;
            return pbId(wrap, el);
        }

    };

    /* The FAQ's one piece of interaction. Kept out of the factory so the
       closure captures exactly what it needs and nothing else. */
    function pbFaqToggle(wrap, btn, panel, single) {
        return function () {
            var open = btn.getAttribute('aria-expanded') === 'true';
            if (!open && single) {
                var others = wrap.querySelectorAll('.pb-faq-btn[aria-expanded="true"]');
                for (var i = 0; i < others.length; i++) {
                    others[i].setAttribute('aria-expanded', 'false');
                    var p = document.getElementById(others[i].getAttribute('aria-controls'));
                    if (p) p.hidden = true;
                }
            }
            btn.setAttribute('aria-expanded', open ? 'false' : 'true');
            panel.hidden = open;
        };
    }

    function isArr(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

    function pbRenderElements(host, list, depth) {
        if (!isArr(list) || depth > 3) return;        /* depth guard */
        for (var i = 0; i < list.length; i++) {
            var el = list[i];
            if (!el || el.enabled === false) continue;
            var make = PB_ELEMENTS[el.type];
            if (!make) continue;                      /* unknown type: skip, never throw */
            var node = make(el, depth);
            if (!node) continue;
            host.appendChild(node);
        }
    }

    /* ---- CSS: one scoped block per section/element, three breakpoints ----

       Generated selectors are .pb-section[data-sec=".."] and
       .pb-el[data-el=".."] rather than the bare attribute selector. That
       gives them specificity (0,2,0):
         - above the .pb-el reset at (0,1,0), whatever the source order, and
         - above the page's own descendant rules such as .info-article h2 at
           (0,1,1), which is what used to win over a heading's colour. */

    function pbDecls(style, tokens, allow) {
        var out = '', k;
        if (!style) return out;
        for (k in tokens) {
            if (!Object.prototype.hasOwnProperty.call(tokens, k)) continue;
            if (allow && allow.indexOf(k) === -1) continue;
            if (!Object.prototype.hasOwnProperty.call(style, k)) continue;
            var v;
            if (k === 'bgImage') {
                var u = pbCssUrl(style[k]);
                if (!u) continue;
                v = 'url("' + u + '")';
            } else {
                v = pbCssValue(style[k]);
                if (!v) continue;
                var unit = tokens[k][1];
                if (unit && /^-?[0-9.]+$/.test(v)) v += unit;
            }
            out += tokens[k][0] + ':' + v + ';';
        }
        /* Types laid out as a flex or grid item align themselves rather than
           their text, so alignment is emitted as box alignment as well. */
        if (out && tokens === PB_EL_TOKENS && (!allow || allow.indexOf('align') > -1)) {
            var self = PB_SELF[str(style.align)];
            if (self) out += '--pbe-self:' + self[0] + ';--pbe-justify:' + self[1] + ';';
        }
        return out;
    }

    function pbScopedCSS(sel, node, tokens, allow) {
        var base = pbDecls(node.style, tokens, allow);
        var r = node.responsive || {};
        var tab = pbDecls(r.tablet, tokens, allow);
        var mob = pbDecls(r.mobile, tokens, allow);
        var css = '';
        if (base) css += sel + '{' + base + '}';
        if (tab)  css += '@media (max-width:1024px){' + sel + '{' + tab + '}}';
        if (mob)  css += '@media (max-width:768px){'  + sel + '{' + mob + '}}';
        return css;
    }

    /* Elements nest (a columns element holds elements of its own), so this
       walks the tree rather than only the top level. */
    function pbElementCSS(list, depth) {
        var css = '', i, j;
        if (!isArr(list) || depth > 3) return css;
        for (i = 0; i < list.length; i++) {
            var el = list[i];
            if (!el) continue;
            var id = pbCssId(el.id);
            var allow = PB_EL_STYLE_KEYS[el.type];
            if (id && allow) {
                css += pbScopedCSS('.pb-el[data-el="' + id + '"]', el, PB_EL_TOKENS, allow);
            }
            var cols = (el.content || {}).columns;
            if (isArr(cols)) {
                for (j = 0; j < cols.length; j++) {
                    css += pbElementCSS((cols[j] || {}).elements, depth + 1);
                }
            }
        }
        return css;
    }

    function builderCSS(sections) {
        var css = '', i;
        if (!isArr(sections)) return css;
        for (i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (!sec) continue;
            var id = pbCssId(sec.id);
            if (id) {
                css += pbScopedCSS('.pb-section[data-sec="' + id + '"]', sec, PB_SEC_TOKENS, null);
            }
            css += pbElementCSS(sec.elements, 0);
        }
        return css;
    }

    /* ---- the public entry point ---- */
    function publishedSections(slug) {
        var page = (load().pages || {})[slug];
        var b = page && page.builder;
        if (!b || b.status !== 'published') return null;
        if (!isArr(b.sections) || !b.sections.length) return null;
        /* Deliberately NOT gated on schemaVersion: whatever a published page
           was saved with, it still renders. The upgrade only fills in
           defaults, and returns the same array when there is nothing to do. */
        return pbUpgrade(b.sections, pbSchemaOf(b));
    }

    function renderSectionsInto(host, sections) {
        var frag = document.createDocumentFragment();
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (!sec || sec.enabled === false) continue;
            var cls = PB_SECTION_CLASS[sec.type] || 'pb-generic';
            var node = pbEl('section', 'pb-section ' + cls);
            if (sec.id) node.setAttribute('data-sec', String(sec.id));
            var vis = sec.visibility || {};
            if (vis.desktop === false) node.className += ' pb-hide-desktop';
            if (vis.tablet  === false) node.className += ' pb-hide-tablet';
            if (vis.mobile  === false) node.className += ' pb-hide-mobile';
            var inner = pbEl('div', 'pb-inner');
            pbRenderElements(inner, sec.elements, 0);
            node.appendChild(inner);
            frag.appendChild(node);
        }
        host.textContent = '';
        host.appendChild(frag);
    }

    /* The admin preview's draft, for this window only. Set by passing an
       override to paintSections() and remembered afterwards, so a later
       repaint -- apply(), a remote refresh, or the storage event the admin
       fires when it saves -- does not drop the preview back to what is
       published. A public page never sets it. Pass null to clear. */
    var previewOverride = null;

    /* Renders every mount point on the page. Returns the number rendered.
       `override` lets the admin preview draft sections without touching
       what is published. */
    function paintSections(override) {
        if (override !== undefined) previewOverride = override;
        var use = previewOverride;
        var hosts = document.querySelectorAll('[data-cms-sections]');
        var css = '', painted = 0, i;
        for (i = 0; i < hosts.length; i++) {
            var host = hosts[i];
            var slug = host.getAttribute('data-cms-sections');
            var sections = (use && use.slug === slug) ? use.sections
                                                      : publishedSections(slug);
            if (!sections) continue;                  /* leave the static markup alone */
            renderSectionsInto(host, sections);
            css += builderCSS(sections);
            painted++;
        }
        var tag = document.getElementById('cmsBuilder');
        if (!css) { if (tag) tag.textContent = ''; return painted; }
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cmsBuilder';
            (document.head || document.documentElement).appendChild(tag);
        }
        tag.textContent = css;
        return painted;
    }

    /* ========================================================
       PAGE BUILDER -- DRAFT / PUBLISH
         builderDrafts[slug]   the admin's working copy. Never read by the
                               public renderer, so saving one cannot change
                               the live site.
         pages[slug].builder   what is live. Only written when the admin
                               explicitly presses Publish.
       Nothing here touches the save/publish behaviour of the other admin
       panels: draft writes go through save() only, and the caller decides
       whether to push anything to remote storage.
    ======================================================== */

    /* Slugs whose shipped HTML carries a <div data-cms-sections="..."> mount.
       A page the admin creates sets builderMount on its own pages entry,
       because the generated stub includes the mount. */
    var PB_MOUNTED = { about: true, contact: true, 'responsible-gaming': true };

    function pbToday() {
        var d = new Date();
        function two(n) { return (n < 10 ? '0' : '') + n; }
        return d.getFullYear() + '-' + two(d.getMonth() + 1) + '-' + two(d.getDate());
    }

    function pbBlank() {
        return { schemaVersion: PB_SCHEMA, status: 'draft', sections: [], updatedAt: '' };
    }

    /* The live block for a slug, whatever its status (null when there is none). */
    function builderBlock(slug) {
        var page = (load().pages || {})[slug];
        return (page && page.builder) || null;
    }

    /* The admin's working copy. Falls back to a copy of what is live, so
       opening a published page in the builder starts from what visitors see. */
    /* The admin's working copy is always upgraded to the current schema: the
       moment someone edits a page they are authoring V2, and saving stamps
       PB_SCHEMA. Published content is left at the version it was saved with
       until that save happens. */
    function draftBlock(slug) {
        var d = (load().builderDrafts || {})[slug];
        if (d && isArr(d.sections)) {
            return { schemaVersion: PB_SCHEMA, status: 'draft',
                     sections: pbUpgrade(clone(d.sections), pbSchemaOf(d)),
                     updatedAt: str(d.updatedAt) };
        }
        var pub = builderBlock(slug);
        if (pub && isArr(pub.sections) && pub.sections.length) {
            return { schemaVersion: PB_SCHEMA, status: 'draft',
                     sections: pbUpgrade(clone(pub.sections), pbSchemaOf(pub)),
                     updatedAt: str(pub.updatedAt) };
        }
        return pbBlank();
    }

    /* Save the working copy. The live page is deliberately left alone. */
    function saveDraft(slug, sections) {
        var st = load();
        if (!st.builderDrafts) st.builderDrafts = {};
        st.builderDrafts[slug] = { schemaVersion: PB_SCHEMA, status: 'draft',
                                   sections: isArr(sections) ? clone(sections) : [],
                                   updatedAt: pbToday() };
        return save();
    }

    /* Copy the working copy onto the live page. This is the only call that
       changes what a visitor can see. */
    function publishDraft(slug) {
        var st = load();
        var sections = draftBlock(slug).sections;
        if (!st.pages) st.pages = {};
        if (!st.pages[slug]) st.pages[slug] = {};
        st.pages[slug].builder = { schemaVersion: PB_SCHEMA, status: 'published',
                                   sections: clone(sections), updatedAt: pbToday() };
        if (!st.builderDrafts) st.builderDrafts = {};
        st.builderDrafts[slug] = { schemaVersion: PB_SCHEMA, status: 'draft',
                                   sections: clone(sections), updatedAt: pbToday() };
        return save();
    }

    /* Take the page back to its shipped HTML. The draft is kept, so the
       work is not lost and can be published again. */
    function unpublishPage(slug) {
        var page = (load().pages || {})[slug];
        if (!page || !page.builder) return true;
        page.builder.status = 'draft';
        page.builder.updatedAt = pbToday();
        return save();
    }

    /* Throw the working copy away and start again from what is live. */
    function discardDraft(slug) {
        var st = load();
        if (st.builderDrafts) delete st.builderDrafts[slug];
        return save();
    }

    function liveSections(slug) {
        var pub = builderBlock(slug);
        return (pub && pub.status === 'published' && isArr(pub.sections)) ? pub.sections : [];
    }

    /* True when the draft says something different from what is live. */
    function draftDiffers(slug) {
        return JSON.stringify(draftBlock(slug).sections) !== JSON.stringify(liveSections(slug));
    }

    function builderStatus(slug) {
        var pub = builderBlock(slug);
        var isLive = !!(pub && pub.status === 'published' &&
                        isArr(pub.sections) && pub.sections.length);
        return { live: isLive, dirty: draftDiffers(slug),
                 sections: draftBlock(slug).sections.length,
                 updatedAt: (pub && str(pub.updatedAt)) || '' };
    }

    /* Slugs the builder can edit: the shipped mounts plus admin-created pages. */
    function builderPages() {
        var pages = load().pages || {}, out = [], k;
        for (k in pages) {
            if (!Object.prototype.hasOwnProperty.call(pages, k)) continue;
            if (PB_MOUNTED[k] || (pages[k] && pages[k].builderMount)) out.push(k);
        }
        out.sort();
        return out;
    }

    /* ========================================================
       INFO PAGES — path addressed content
         data-cms-meta="pages.about.metaDescription"  -> <meta content>
         data-cms-text="pages.about.heading"          -> textContent
         data-cms-html="pages.about.body"             -> innerHTML
       Unlike data-cms (flat text keys) these take a full dotted path,
       so any section of the config can feed a page. An empty stored
       value leaves the markup alone, which keeps the HTML fallback.
    ======================================================== */
    function paintPageMeta() {
        each(document.querySelectorAll('meta[data-cms-meta]'), function (el) {
            var v = get(el.getAttribute('data-cms-meta'), '');
            if (v) el.setAttribute('content', v);
        });
    }

    function paintPageContent() {
        each(document.querySelectorAll('[data-cms-text]'), function (el) {
            var v = get(el.getAttribute('data-cms-text'), null);
            if (v != null) el.textContent = v;
        });
        /* Body HTML is authored by the signed in admin, so it is written
           as markup on purpose — that is the point of the field. */
        each(document.querySelectorAll('[data-cms-html]'), function (el) {
            var v = get(el.getAttribute('data-cms-html'), null);
            if (v != null) el.innerHTML = v;
        });
    }


    /* ========================================================
       TEXT + IMAGES + PLACEHOLDERS
    ======================================================== */
    function paintText() {
        var txt = load().text;

        each(document.querySelectorAll('[data-cms]'), function (el) {
            var k = el.getAttribute('data-cms');
            if (txt[k] !== undefined && txt[k] !== null) el.textContent = txt[k];
        });

        each(document.querySelectorAll('[data-cms-ph]'), function (el) {
            var k = el.getAttribute('data-cms-ph');
            if (txt[k] !== undefined) el.setAttribute('placeholder', txt[k]);
        });
    }

    function paintImages() {
        var imgs = load().images;
        var mobile = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;

        each(document.querySelectorAll('[data-cms-img]'), function (el) {
            var key = el.getAttribute('data-cms-img');
            var mobKey = el.getAttribute('data-cms-img-mob');
            var src = (mobile && mobKey && imgs[mobKey]) ? imgs[mobKey] : imgs[key];
            if (src) {
                el.src = src;
                el.style.display = '';
                el.hidden = false;
            }
            var altKey = el.getAttribute('data-cms-alt');
            if (altKey) el.alt = get('branding.' + altKey, el.alt);
        });
    }

    /* ========================================================
       MARQUEE
    ======================================================== */
    function paintMarquee() {
        var ticker = document.getElementById('headerTicker');
        var textEl = document.getElementById('tickerText');
        if (!ticker) return;
        ticker.style.display = get('branding.marqueeEnabled', true) ? '' : 'none';
        var speed = parseFloat(get('branding.marqueeSpeed', 18));
        if (textEl && speed > 0) textEl.style.animationDuration = speed + 's';
    }

    /* ========================================================
       FOOTER SOCIAL LINKS
    ======================================================== */
    var SOCIAL = [
        ['whatsapp', 'fab fa-whatsapp', function (v) { return 'https://wa.me/' + v.replace(/[^0-9]/g, ''); }],
        ['telegram', 'fab fa-telegram', function (v) { return /^https?:/.test(v) ? v : 'https://t.me/' + v.replace(/^@/, ''); }],
        ['email', 'fas fa-envelope', function (v) { return 'mailto:' + v; }],
        ['facebook', 'fab fa-facebook-f', function (v) { return /^https?:/.test(v) ? v : 'https://facebook.com/' + v; }],
        ['instagram', 'fab fa-instagram', function (v) { return /^https?:/.test(v) ? v : 'https://instagram.com/' + v; }]
    ];

    function paintFooterSocial() {
        var box = document.getElementById('footerSocial');
        if (!box) return;
        var html = '';
        SOCIAL.forEach(function (row) {
            var v = get('branding.' + row[0], '');
            if (!v) return;
            html += '<a class="footer-social-link" href="' + row[2](v) +
                    '" target="_blank" rel="noopener" aria-label="' + row[0] +
                    '"><i class="' + row[1] + '"></i></a>';
        });
        box.innerHTML = html;
    }

    function paintWhatsApp() {
        var num = String(get('branding.whatsapp', '')).replace(/[^0-9]/g, '');
        if (!num) return;
        var url = 'https://wa.me/' + num;
        ['whatsappFloat', 'whatsappLink', 'whatsappSupportBtn', 'footerWaLink', 'footerWaBtn']
            .forEach(function (id) {
                var el = document.getElementById(id);
                if (el && el.tagName === 'A') el.href = url;
            });
    }

    /* ========================================================
       HOME CONTENT — harvest then render
       On a virgin install the arrays are empty, so we read the
       existing markup once and store it. Nothing is lost, and
       the admin gets real data to edit from day one.
    ======================================================== */
    function harvest() {
        var st = load(), dirty = false;

        if (!st.home.featured.length) {
            each(document.querySelectorAll('#mobFeaturedStrip .mob-feat-card'), function (el) {
                var icon = el.querySelector('.mob-feat-icon i');
                st.home.featured.push({
                    name: text(el.querySelector('.mob-feat-name')),
                    icon: icon ? icon.className : 'fas fa-cricket-bat-ball',
                    link: el.getAttribute('href') || '#',
                    enabled: true
                });
                dirty = true;
            });
        }

        if (!st.home.categories.length) {
            each(document.querySelectorAll('#mobCategoryInner .mob-cat-item'), function (el) {
                st.home.categories.push({
                    name: text(el),
                    link: el.getAttribute('href') || '#',
                    active: el.classList.contains('active'),
                    enabled: true
                });
                dirty = true;
            });
        }

        if (!st.home.sports.length) {
            each(document.querySelectorAll('#sportsTabsInner .sport-tab'), function (el) {
                var icon = el.querySelector('.sport-tab-icon i');
                st.home.sports.push({
                    name: text(el.querySelector('.sport-tab-label')),
                    slug: el.getAttribute('data-sport') || '',
                    icon: icon ? icon.className : 'fas fa-circle-dot',
                    active: el.classList.contains('active'),
                    enabled: true
                });
                dirty = true;
            });
        }

        if (!st.home.casino.length) {
            each(document.querySelectorAll('#casinoGrid .casino-card'), function (el) {
                var img = el.querySelector('img');
                st.home.casino.push({
                    id: el.getAttribute('data-game') || '',
                    title: text(el.querySelector('.casino-ph-label')),
                    src: img ? img.getAttribute('src') : '',
                    link: 'login.html',
                    enabled: true
                });
                dirty = true;
            });
        }

        if (dirty) save();
    }

    function renderFeatured() {
        var box = document.getElementById('mobFeaturedStrip');
        if (!box) return;
        var list = get('home.featured', []);
        if (!list.length) return;
        box.innerHTML = list.filter(on).map(function (m) {
            return '<a href="' + esc(m.link || '#') + '" class="mob-feat-card">' +
                   '<span class="mob-feat-icon"><i class="' + esc(m.icon) + '"></i></span>' +
                   '<span class="mob-feat-name">' + esc(m.name) + '</span></a>';
        }).join('');
    }

    function renderCategories() {
        var box = document.getElementById('mobCategoryInner');
        if (!box) return;
        var list = get('home.categories', []);
        if (!list.length) return;
        box.innerHTML = list.filter(on).map(function (c) {
            return '<a href="' + esc(c.link || '#') + '" class="mob-cat-item' +
                   (c.active ? ' active' : '') + '">' + esc(c.name) + '</a>';
        }).join('');
    }

    function renderSports() {
        var box = document.getElementById('sportsTabsInner');
        if (!box) return;
        var list = get('home.sports', []);
        if (!list.length) return;
        box.innerHTML = list.filter(on).map(function (s) {
            return '<button class="sport-tab' + (s.active ? ' active' : '') +
                   '" data-sport="' + esc(s.slug) + '">' +
                   '<span class="sport-tab-icon"><i class="' + esc(s.icon) + '"></i></span>' +
                   '<span class="sport-tab-label">' + esc(s.name) + '</span></button>';
        }).join('');
    }

    function renderCasino() {
        var box = document.getElementById('casinoGrid');
        if (!box) return;
        var list = get('home.casino', []);
        if (!list.length) return;
        box.innerHTML = list.filter(on).map(function (g) {
            /* width/height and lazy loading are repeated here so a
               CMS rendered grid keeps the same no-layout-shift
               behaviour as the markup in index.html. */
            return '<div class="casino-card" data-game="' + esc(g.id) + '" data-link="' + esc(g.link || 'login.html') + '">' +
                   '<img src="' + esc(g.src) + '" alt="' + esc(g.title) + '" ' +
                   'width="400" height="400" loading="lazy" decoding="async" ' +
                   'onerror="this.parentElement.classList.add(\'no-img\')">' +
                   '<div class="casino-ph-label">' + esc(g.title) + '</div></div>';
        }).join('');
    }

    /* ========================================================
       HELPERS
    ======================================================== */
    function each(nodeList, fn) { Array.prototype.forEach.call(nodeList, fn); }
    function on(item) { return item && item.enabled !== false; }
    function text(el) { return el ? String(el.textContent).trim() : ''; }
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ========================================================
       APPLY
    ======================================================== */
    function applyHead() {
        paintVars();
        paintHead();
    }

    function applyBody() {
        harvest();
        renderFeatured();
        renderCategories();
        renderSports();
        renderCasino();
        paintText();
        paintPageContent();
        paintSections();
        paintImages();
        paintMarquee();
        paintFooterSocial();
        paintWhatsApp();
        document.dispatchEvent(new CustomEvent('cms:applied'));
    }

    function apply() {
        applyHead();
        if (document.body) applyBody();
    }

    /* ========================================================
       PUBLIC API
    ======================================================== */
    /* ========================================================
       REMOTE BRAND STORAGE
       When js/cms-config.js is filled in, the server row is the
       single source of truth. Visitors read it; the admin writes
       it. localStorage becomes a cache so the page still paints
       instantly and still works offline.
    ======================================================== */
    var RC = window.CMS_REMOTE || {};
    var REMOTE_ON = !!(RC.enabled && RC.url && RC.anonKey);
    var TOKEN_KEY = 'cmsAdminToken';

    function rurl(path) {
        return String(RC.url).replace(/\/+$/, '') + path;
    }

    function baseHeaders() {
        return {
            'apikey': RC.anonKey,
            'Authorization': 'Bearer ' + RC.anonKey,
            'Content-Type': 'application/json'
        };
    }

    function token() {
        try { return window.sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
    }

    var Remote = {

        enabled: REMOTE_ON,
        lastError: null,

        /* Read the published brand. Runs on every page load. */
        pull: function () {
            if (!REMOTE_ON) return Promise.resolve(null);
            var url = rurl('/rest/v1/' + RC.table + '?id=eq.' +
                           encodeURIComponent(RC.siteId) + '&select=data,updated_at');
            return fetch(url, { headers: baseHeaders(), cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (rows) {
                    if (!rows || !rows.length || !rows[0].data) return null;
                    var remoteData = rows[0].data;
                    /* builderDrafts is this device's unpublished working copy.
                       It must survive the pull: the row carries at best the
                       drafts as they were when it was last written, and every
                       page in this browser pulls — so without this, opening
                       the site in another tab rolled the admin's unsaved
                       Page Builder work back to the last published state. */
                    var localDrafts = (load() || {}).builderDrafts;
                    /* server wins — localStorage is only a cache here */
                    state = merge(merge(DEFAULTS, window.CMS_BRAND || null), remoteData);
                    if (localDrafts && Object.keys(localDrafts).length) {
                        state.builderDrafts = localDrafts;
                    }
                    try {
                        window.localStorage.setItem(KEY, JSON.stringify(state));
                    } catch (e) { /* cache is optional */ }
                    Remote.lastError = null;
                    apply();
                    document.dispatchEvent(new CustomEvent('cms:remote-loaded'));
                    return remoteData;
                })
                .catch(function (err) {
                    Remote.lastError = err;
                    console.warn('[CMS] Remote unavailable, using cached brand.', err);
                    return null;
                });
        },

        /* Sign the admin in. Returns a promise for the access token. */
        signIn: function (email, password) {
            if (!REMOTE_ON) return Promise.reject(new Error('Remote storage is off'));
            return fetch(rurl('/auth/v1/token?grant_type=password'), {
                method: 'POST',
                headers: baseHeaders(),
                body: JSON.stringify({ email: email, password: password })
            }).then(function (r) {
                return r.json().then(function (j) {
                    if (!r.ok || !j.access_token) {
                        throw new Error(j.error_description || j.msg || j.error || 'Sign in failed');
                    }
                    try { window.sessionStorage.setItem(TOKEN_KEY, j.access_token); } catch (e) {}
                    return j.access_token;
                });
            });
        },

        signOut: function () {
            try { window.sessionStorage.removeItem(TOKEN_KEY); } catch (e) {}
        },

        signedIn: function () { return !!token(); },

        /* Write the current config to the server — this is what makes
           a change visible to every client. */
        publish: function () {
            if (!REMOTE_ON) return Promise.reject(new Error('Remote storage is off'));
            var t = token();
            if (!t) return Promise.reject(new Error('Not signed in'));

            /* Drafts are working state, not published content. Sending them
               would put unpublished copy in the public row, which every
               visitor downloads with the anon key. */
            var payload = clone(load());
            delete payload.builderDrafts;

            var body = JSON.stringify({
                id: RC.siteId,
                data: payload,
                updated_at: new Date().toISOString()
            });

            var headers = {
                'apikey': RC.anonKey,
                'Authorization': 'Bearer ' + t,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates,return=minimal'
            };

            /* upsert: one call handles both first save and updates */
            return fetch(rurl('/rest/v1/' + RC.table), {
                method: 'POST',
                headers: headers,
                body: body
            }).then(function (r) {
                if (r.status === 401 || r.status === 403) {
                    Remote.signOut();
                    throw new Error('Session expired — sign in again');
                }
                if (!r.ok) {
                    return r.text().then(function (txt) {
                        throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 160));
                    });
                }
                save();   /* refresh the local cache too */
                return true;
            });
        }
    };

    /* ========================================================
       THEME ENGINE
       A theme is a named snapshot of brand + colours + logos.
       Applying one writes it into the live config, so every page
       picks it up on next paint with no code changes anywhere.
    ======================================================== */
    var THEME_BRAND_KEYS = ['siteName', 'browserTitle', 'loginTitle'];

    var Themes = {

        all: function () { return load().themes; },

        list: function () {
            var t = load().themes, out = [], k;
            for (k in t) if (Object.prototype.hasOwnProperty.call(t, k)) out.push(t[k]);
            out.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
            return out;
        },

        get: function (id) { return load().themes[id] || null; },

        activeId: function () { return get('settings.activeTheme', ''); },

        /* Build a theme object out of whatever is currently live */
        fromCurrent: function (id, name) {
            var st = load(), brand = {}, images = {};
            THEME_BRAND_KEYS.forEach(function (k) { brand[k] = st.branding[k]; });
            ['logo', 'logoMobile', 'favicon', 'footerLogo', 'loginLogo'].forEach(function (k) {
                images[k] = st.images[k];
            });
            return {
                id: id,
                name: name,
                order: Themes.list().length,
                brand: brand,
                colors: clone(st.colors),
                images: images
            };
        },

        save: function (theme) {
            if (!theme || !theme.id) return false;
            load().themes[theme.id] = theme;
            return save();
        },

        remove: function (id) {
            var st = load();
            if (!st.themes[id]) return false;
            delete st.themes[id];
            if (st.settings.activeTheme === id) st.settings.activeTheme = '';
            return save();
        },

        duplicate: function (id, newName) {
            var src = Themes.get(id);
            if (!src) return null;
            var copy = clone(src);
            copy.id = Themes.uid(newName || (src.name + ' copy'));
            copy.name = newName || (src.name + ' copy');
            copy.order = Themes.list().length;
            Themes.save(copy);
            return copy;
        },

        uid: function (name) {
            var base = String(name || 'theme').toLowerCase()
                .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'theme';
            var t = load().themes, id = base, n = 2;
            while (t[id]) { id = base + '-' + n; n++; }
            return id;
        },

        /* One click = the whole site rebrands */
        apply: function (id) {
            var th = Themes.get(id);
            if (!th) return false;
            var st = load(), k;

            for (k in th.brand) {
                if (th.brand[k] !== undefined && th.brand[k] !== '') st.branding[k] = th.brand[k];
            }
            st.colors = merge(st.colors, th.colors);
            for (k in th.images) {
                if (th.images[k]) st.images[k] = th.images[k];
            }
            st.settings.activeTheme = id;

            if (!save()) return false;
            previewColors = null;
            apply();
            return true;
        },

        exportOne: function (id) {
            var th = Themes.get(id);
            return th ? JSON.stringify(th, null, 2) : '';
        },

        importOne: function (json) {
            var obj = typeof json === 'string' ? JSON.parse(json) : json;
            if (!obj || !obj.colors) throw new Error('Not a theme file');
            obj.id = Themes.uid(obj.name || obj.id || 'imported');
            obj.name = obj.name || obj.id;
            obj.order = Themes.list().length;
            Themes.save(obj);
            return obj;
        }
    };

    /* Transient preview — paint without touching storage */
    function preview(colors) {
        previewColors = colors || null;
        paintVars();
    }

    /* Preview channel for the admin's 390px iframe */
    window.addEventListener('message', function (e) {
        var d = e.data;
        if (!d || d.channel !== 'cms-preview') return;
        if (d.colors) previewColors = d.colors;
        if (d.reset) previewColors = null;
        paintVars();
        if (d.branding || d.images || d.text) {
            var st = load();
            if (d.branding) st.branding = merge(st.branding, d.branding);
            if (d.images) st.images = merge(st.images, d.images);
            if (d.text) st.text = merge(st.text, d.text);
            paintHead();
            paintText();
            paintImages();
        }
    });

    var CMS = {
        KEY: KEY,
        DEFAULTS: DEFAULTS,
        data: load,
        get: get,
        set: set,
        save: save,
        apply: apply,
        applyHead: applyHead,
        applyBody: applyBody,
        paintVars: paintVars,
        paintSeo: paintSeo,
        seoUrlFor: pageUrl,
        seoTitleFor: computeTitle,
        seoDescriptionFor: computeDescription,
        seoOgFor: computeOg,
        seoTwitterFor: computeTwitter,
        seoRobotsFor: robotsValue,
        seoAbsUrl: absUrl,
        seoCrawlableImage: crawlableImage,
        paintPageContent: paintPageContent,
        paintPageMeta: paintPageMeta,
        paintTypography: paintTypography,
        paintRegister: paintRegister,
        paintSportsTable: paintSportsTable,
        sportsTableCSS: sportsTableCSS,
        ST_VARS: ST_VARS,
        TYPO_TARGETS: TYPO_TARGETS,
        TYPO_PROPS: TYPO_PROPS,
        reload: function () { state = null; return load(); },
        replace: function (obj) { state = merge(DEFAULTS, obj); return save(); },
        reset: function (section) {
            var st = load();
            if (!section) { state = clone(DEFAULTS); }
            else { st[section] = clone(DEFAULTS[section]); }
            return save();
        },
        exportJSON: function () { return JSON.stringify(load(), null, 2); },
        themes: Themes,
        /* Page Builder surface for the admin. `paint` with an override
           renders draft sections for preview without publishing them. */
        sections: {
            schema: PB_SCHEMA,
            types: PB_SECTION_CLASS,
            elementTypes: PB_ELEMENTS,
            paint: paintSections,
            css: builderCSS,
            published: publishedSections,
            upgrade: pbUpgrade,
            schemaOf: pbSchemaOf,
            safeUrl: pbUrl,
            safeCssValue: pbCssValue,
            elementStyleKeys: PB_EL_STYLE_KEYS,
            icons: PB_ICONS,
            social: PB_SOCIAL,
            sectionTokens: PB_SEC_TOKENS,
            elementTokens: PB_EL_TOKENS,

            /* draft / publish */
            mounted: PB_MOUNTED,
            pages: builderPages,
            draft: draftBlock,
            live: liveSections,
            saveDraft: saveDraft,
            publish: publishDraft,
            unpublish: unpublishPage,
            discard: discardDraft,
            dirty: draftDiffers,
            status: builderStatus,
            blank: pbBlank
        },
        preview: preview,
        remote: Remote,
        clone: clone,
        merge: merge
    };

    window.CMS = CMS;

    /* Paint variables + title as early as possible (no flash of default brand) */
    applyHead();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyBody);
    } else {
        applyBody();
    }

    /* Pull the published brand. The page has already painted from cache,
       so this is a silent refresh rather than a blocking load. */
    if (REMOTE_ON) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () { Remote.pull(); });
        } else {
            Remote.pull();
        }
    }

    /* Live update: admin saves in one tab, site repaints in the other */
    window.addEventListener('storage', function (e) {
        if (e.key !== KEY) return;
        state = null;
        apply();
    });

})(window, document);
