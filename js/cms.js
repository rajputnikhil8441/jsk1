/* ============================================================
   PLAYZONE9 — WHITE LABEL CMS ENGINE  (js/cms.js)
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
       DEFAULTS — the PLAYZONE9 brand as shipped
    ======================================================== */
    var DEFAULTS = {

        branding: {
            siteName: 'PLAYZONE9',
            browserTitle: 'PLAYZONE9 - Online Sports Betting & Casino',
            loginTitle: 'Login — PLAYZONE9',
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
            'lock-icon': 'rgba(0, 0, 0, 0.85)',
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
            'support.link': 'https://wa.link/playzone9',
            'footer.copyright': '© Copyright 2026. All Rights Reserved. Powered by PLAYZONE9.',
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
            'register.loginLink': 'Login here'
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

        /* Saved white labels. Seeded on first run by the admin panel;
           each entry is { id, name, brand:{}, colors:{}, images:{} }. */
        themes: {},


        /* Per-section typography. Empty string = inherit existing CSS. */
        typography: {},

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
    }

    /* ========================================================
       HEAD — title + favicon
    ======================================================== */
    function paintHead() {
        var isLogin = /login\.html/i.test(location.pathname);
        var t = isLogin ? get('branding.loginTitle') : get('branding.browserTitle');
        if (t) document.title = t;

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
            return '<div class="casino-card" data-game="' + esc(g.id) + '" data-link="' + esc(g.link || 'login.html') + '">' +
                   '<img src="' + esc(g.src) + '" alt="' + esc(g.title) + '" ' +
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
                    /* server wins — localStorage is only a cache here */
                    state = merge(merge(DEFAULTS, window.CMS_BRAND || null), remoteData);
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

            var body = JSON.stringify({
                id: RC.siteId,
                data: load(),
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
        paintTypography: paintTypography,
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
