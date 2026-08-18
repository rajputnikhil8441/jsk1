/* ============================================================
   WHITE LABEL CMS — admin.js
   Talks to the shared engine in ../js/cms.js. Nothing here is
   site-specific beyond the field maps below, so adding a new
   editable value means adding one line to a map.
   ============================================================ */
(function () {
    'use strict';

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    /* ========================================================
       FIELD MAPS
    ======================================================== */

    var COLOR_GROUPS = [
        ['Header', [
            ['hdr-bg', 'Header background'],
            ['hdr-text', 'Header text'],
            ['ticker-bg', 'Marquee strip'],
            ['ticker-text', 'Marquee text'],
            ['ticker-icon-bg', 'Marquee icon badge']
        ]],
        ['Header buttons', [
            ['btn-apk-bg', 'APK background'],
            ['btn-apk-text', 'APK text'],
            ['btn-demo-bg', 'Demo background'],
            ['btn-demo-text', 'Demo text'],
            ['btn-login-bg', 'Login background'],
            ['btn-login-text', 'Login text'],
            ['btn-register-bg', 'Register background'],
            ['btn-register-text', 'Register text']
        ]],
        ['Navigation', [
            ['nav-bg', 'Nav background'],
            ['nav-text', 'Nav link'],
            ['nav-active', 'Nav active link'],
            ['nav-accent', 'Nav accent (CRASH)'],
            ['mob-cat-bg', 'Mobile category bar'],
            ['mob-cat-text', 'Mobile category text'],
            ['mob-feat-bg', 'Featured strip background'],
            ['mob-feat-card-bg', 'Featured card'],
            ['mob-feat-text', 'Featured card text']
        ]],
        ['Sports tabs', [
            ['tabm-bg', 'Mobile tab bar'],
            ['tabm-text', 'Mobile tab text'],
            ['tabm-active-line', 'Mobile active underline'],
            ['tab-bg', 'Desktop tab bar'],
            ['tab-text', 'Desktop tab text'],
            ['tab-active-bg', 'Desktop active tab'],
            ['tab-active-text', 'Desktop active text'],
            ['tab-active-line', 'Desktop active underline']
        ]],
        ['Match table', [
            ['table-bg', 'Table background'],
            ['table-row-bg', 'Row background'],
            ['table-head-bg', 'Tournament header'],
            ['table-head-text', 'Tournament text'],
            ['table-text', 'Team names'],
            ['table-dim', 'Date / time'],
            ['table-border', 'Row separator'],
            ['labels-bg', '1 / X / 2 strip'],
            ['labels-text', '1 / X / 2 text']
        ]],
        ['Odds boxes', [
            ['back', 'Back (blue)'],
            ['lay', 'Lay (pink)'],
            ['odds-text', 'Odds text'],
            ['lock-bg', 'Suspended box'],
            ['lock-icon', 'Lock icon'],
            ['lock-dash', 'Suspended dashes']
        ]],
        ['BM badge & live dots', [
            ['bm-text', 'BM text'],
            ['live-green', 'Live dot — green'],
            ['live-red', 'Live dot — red'],
            ['live-blue', 'Live dot — blue'],
            ['live-grey', 'Live dot — inactive'],
            ['live-strip-bg', 'Live strip background'],
            ['live-item-bg', 'Live strip item']
        ]],
        ['Casino section', [
            ['casino-bg', 'Casino background'],
            ['casino-card-bg', 'Card placeholder'],
            ['casino-label-bg', 'Card label background'],
            ['casino-label-text', 'Card label text'],
            ['casino-hover', 'Card hover outline']
        ]],
        ['Sidebar', [
            ['sidebar-bg', 'Sidebar background'],
            ['sidebar-head', 'Section heading'],
            ['sidebar-head-text', 'Heading text'],
            ['sidebar-active', 'Active link'],
            ['sidebar-active-bg', 'Active link background']
        ]],
        ['Support & footer', [
            ['support-bg', 'Support strip'],
            ['support-text', 'Support text'],
            ['wa-green', 'WhatsApp green'],
            ['footer-bg', 'Footer background'],
            ['footer-text', 'Footer text']
        ]],
        ['Page & borders', [
            ['page-bg', 'Page background'],
            ['content-bg', 'Content background'],
            ['text', 'Body text'],
            ['text-dim', 'Muted text'],
            ['border', 'Border'],
            ['border-light', 'Light border']
        ]]
    ];

    var LOGIN_COLORS = [
        ['login-bg-from', 'Background gradient — top'],
        ['login-bg-to', 'Background gradient — bottom'],
        ['login-card-bg', 'Card background'],
        ['login-title', 'Heading colour'],
        ['login-btn-bg', 'Button background'],
        ['login-btn-text', 'Button text'],
        ['login-footer-bg', 'Footer bar']
    ];

    var TEXT_LABELS = {
        'btn.apk': 'APK button', 'btn.demo': 'Demo button',
        'btn.login': 'Login button', 'btn.register': 'Register button',
        'marquee.text': 'Marquee message',
        'nav.home': 'Nav — Home', 'nav.cricket': 'Nav — Cricket',
        'nav.tennis': 'Nav — Tennis', 'nav.football': 'Nav — Football',
        'nav.tabletennis': 'Nav — Table Tennis', 'nav.baccarat': 'Nav — Baccarat',
        'nav.cards32': 'Nav — 32 Cards', 'nav.teenpatti': 'Nav — Teenpatti',
        'nav.poker': 'Nav — Poker', 'nav.lucky7': 'Nav — Lucky 7',
        'nav.crash': 'Nav — Crash',
        'support.title': 'Support heading', 'support.link': 'Support link text',
        'footer.copyright': 'Footer copyright',
        'login.heading': 'Login heading', 'login.userPh': 'Field 1 placeholder',
        'login.passPh': 'Field 2 placeholder', 'login.submit': 'Submit button',
        'login.forgot': 'Forgot link', 'login.regLabel': 'Register prompt',
        'login.regLink': 'Register link', 'login.apk': 'APK link',
        'login.footerLabel': 'Footer heading', 'login.footerLink': 'Footer link',
        'login.footerBtn': 'Footer button',
        'register.heading': 'Register heading', 'register.namePh': 'Name placeholder',
        'register.phonePh': 'Phone placeholder', 'register.userPh': 'Username placeholder',
        'register.passPh': 'Password placeholder', 'register.submit': 'Submit button',
        'register.terms': 'Terms text', 'register.loginLabel': 'Login prompt',
        'register.loginLink': 'Login link'
    };

    var IMAGE_SLOTS = [
        ['logo', 'Header logo'],
        ['logoMobile', 'Mobile logo'],
        ['favicon', 'Favicon'],
        ['footerLogo', 'Footer logo'],
        ['loginLogo', 'Login logo'],
        ['loginBg', 'Login background image'],
        ['registerLogo', 'Register logo'],
        ['registerBg', 'Register background image'],
        ['banner', 'Banner image'],
        ['whatsappIcon', 'WhatsApp button icon'],
        ['crashIcon', 'Crash / Aviator icon']
    ];

    var PRESETS = {
        playzone: {
            label: 'PLAYZONE', note: 'Blue — the shipped brand',
            colors: {}
        },
        gin247: {
            label: 'GIN247', note: 'Yellow on black',
            colors: {
                'hdr-bg': '#111111', 'hdr-text': '#ffd400', 'ticker-bg': '#2a2a2a',
                'ticker-text': '#ffd400', 'ticker-icon-bg': '#ffd400',
                'btn-apk-bg': '#ffd400', 'btn-apk-text': '#111111',
                'btn-demo-bg': '#ffd400', 'btn-demo-text': '#111111',
                'btn-login-bg': '#1f1f1f', 'btn-login-text': '#ffd400',
                'btn-register-bg': '#ffd400', 'btn-register-text': '#111111',
                'nav-bg': '#1c1c1c', 'nav-text': '#bdbdbd', 'nav-active': '#ffd400',
                'nav-accent': '#ffd400',
                'tabm-bg': '#1c1c1c', 'tabm-text': '#ffd400', 'tabm-active-line': '#ffd400',
                'tab-bg': '#2a2a2a', 'tab-text': '#e0e0e0', 'tab-active-bg': '#111111',
                'tab-active-text': '#ffd400', 'tab-active-line': '#ffd400',
                'table-head-bg': '#f2e9c4', 'labels-bg': '#efe6bf',
                'back': '#8fd0f5', 'lay': '#f6a8c0',
                'casino-bg': '#1c1c1c', 'casino-label-bg': '#2f2f2f', 'casino-label-text': '#ffd400',
                'casino-hover': '#ffd400',
                'sidebar-head': '#111111', 'sidebar-head-text': '#ffd400',
                'sidebar-active': '#a37f00', 'sidebar-active-bg': '#fff6cc',
                'support-bg': '#111111', 'support-text': '#ffd400',
                'footer-bg': '#1c1c1c', 'footer-text': '#bdbdbd',
                'mob-feat-bg': '#111111', 'mob-feat-card-bg': '#2a2a2a', 'mob-feat-text': '#ffd400',
                'mob-cat-bg': '#111111', 'mob-cat-text': '#ffd400',
                'login-bg-from': '#3a3a3a', 'login-bg-to': '#000000',
                'login-title': '#111111', 'login-btn-bg': '#ffd400', 'login-btn-text': '#111111',
                'login-footer-bg': '#111111'
            }
        },
        diamond: {
            label: 'DIAMOND', note: 'Red and gold',
            colors: {
                'hdr-bg': '#9b0f1e', 'hdr-text': '#ffd77a', 'ticker-bg': '#c0392b',
                'ticker-text': '#ffffff', 'ticker-icon-bg': '#d4af37',
                'btn-apk-bg': '#7a0b17', 'btn-apk-text': '#ffd77a',
                'btn-demo-bg': '#ffd77a', 'btn-demo-text': '#7a0b17',
                'btn-login-bg': '#5e0810', 'btn-login-text': '#ffd77a',
                'btn-register-bg': '#d4af37', 'btn-register-text': '#3d0509',
                'nav-bg': '#3d0509', 'nav-text': '#e8c9a0', 'nav-active': '#ffd77a',
                'nav-accent': '#d4af37',
                'tabm-bg': '#5e0810', 'tabm-text': '#ffd77a', 'tabm-active-line': '#d4af37',
                'tab-bg': '#f3e2c7', 'tab-text': '#5e0810', 'tab-active-bg': '#ffffff',
                'tab-active-text': '#9b0f1e', 'tab-active-line': '#9b0f1e',
                'table-head-bg': '#f6e7cf', 'labels-bg': '#f1ddc0',
                'back': '#7fc2ef', 'lay': '#f39bb5',
                'casino-bg': '#2b0407', 'casino-label-bg': '#5e0810', 'casino-label-text': '#ffd77a',
                'casino-hover': '#d4af37',
                'sidebar-head': '#9b0f1e', 'sidebar-head-text': '#ffd77a',
                'sidebar-active': '#9b0f1e', 'sidebar-active-bg': '#fbeaea',
                'support-bg': '#9b0f1e', 'support-text': '#ffd77a',
                'footer-bg': '#2b0407', 'footer-text': '#e8c9a0',
                'mob-feat-bg': '#9b0f1e', 'mob-feat-card-bg': '#5e0810', 'mob-feat-text': '#ffd77a',
                'mob-cat-bg': '#9b0f1e', 'mob-cat-text': '#ffd77a',
                'login-bg-from': '#c0392b', 'login-bg-to': '#2b0407',
                'login-title': '#9b0f1e', 'login-btn-bg': '#9b0f1e', 'login-btn-text': '#ffd77a',
                'login-footer-bg': '#9b0f1e'
            }
        },
        dark: {
            label: 'DARK', note: 'Navy night mode',
            colors: {
                'hdr-bg': '#16202c', 'hdr-text': '#e8f1fb', 'ticker-bg': '#1e2b3a',
                'ticker-text': '#cfe0f2', 'ticker-icon-bg': '#2f6fd0',
                'btn-apk-bg': '#22344a', 'btn-apk-text': '#e8f1fb',
                'btn-demo-bg': '#e8f1fb', 'btn-demo-text': '#16202c',
                'btn-login-bg': '#22344a', 'btn-login-text': '#e8f1fb',
                'btn-register-bg': '#2f6fd0', 'btn-register-text': '#ffffff',
                'nav-bg': '#101823', 'nav-text': '#9fb3c8', 'nav-active': '#ffffff',
                'nav-accent': '#4da3ff',
                'tabm-bg': '#101823', 'tabm-text': '#e8f1fb', 'tabm-active-line': '#4da3ff',
                'tab-bg': '#1e2b3a', 'tab-text': '#cfe0f2', 'tab-active-bg': '#16202c',
                'tab-active-text': '#4da3ff', 'tab-active-line': '#4da3ff',
                'table-bg': '#16202c', 'table-row-bg': '#16202c', 'table-head-bg': '#1e2b3a',
                'table-head-text': '#e8f1fb', 'table-text': '#e8f1fb', 'table-dim': '#8ea0b5',
                'table-border': '#243244', 'labels-bg': '#1e2b3a', 'labels-text': '#cfe0f2',
                'back': '#4a90c2', 'lay': '#c2708b', 'odds-text': '#ffffff',
                'bm-text': '#e8f1fb',
                'casino-bg': '#101823', 'casino-card-bg': '#22344a',
                'casino-label-bg': '#1e2b3a', 'casino-label-text': '#cfe0f2',
                'casino-hover': '#4da3ff',
                'sidebar-bg': '#16202c', 'sidebar-head': '#101823', 'sidebar-head-text': '#e8f1fb',
                'sidebar-active': '#4da3ff', 'sidebar-active-bg': '#1e2b3a',
                'live-strip-bg': '#101823', 'live-item-bg': '#16202c',
                'support-bg': '#101823', 'support-text': '#e8f1fb',
                'footer-bg': '#101823', 'footer-text': '#8ea0b5',
                'mob-feat-bg': '#101823', 'mob-feat-card-bg': '#1e2b3a', 'mob-feat-text': '#cfe0f2',
                'mob-cat-bg': '#101823', 'mob-cat-text': '#e8f1fb',
                'page-bg': '#0c141d', 'content-bg': '#16202c',
                'text': '#e8f1fb', 'text-dim': '#8ea0b5',
                'border': '#243244', 'border-light': '#1e2b3a',
                'login-bg-from': '#22344a', 'login-bg-to': '#0c141d',
                'login-card-bg': '#16202c', 'login-title': '#4da3ff',
                'login-btn-bg': '#2f6fd0', 'login-btn-text': '#ffffff',
                'login-footer-bg': '#101823'
            }
        }
    };

    /* ========================================================
       SHELL
    ======================================================== */
    var dirty = false;

    function toast(msg, isErr) {
        var t = $('#toast');
        t.textContent = msg;
        t.className = 'toast show' + (isErr ? ' err' : '');
        clearTimeout(t._t);
        t._t = setTimeout(function () { t.className = 'toast'; }, 2600);
    }

    function markDirty() {
        dirty = true;
        var f = $('#savedFlag');
        f.textContent = 'Unsaved changes';
        f.className = 'adm-saved dirty';
    }

    function markSaved() {
        dirty = false;
        var f = $('#savedFlag');
        f.textContent = 'Saved';
        f.className = 'adm-saved show';
        setTimeout(function () { f.className = 'adm-saved'; }, 1800);
    }

    /* Persist + repaint the admin's own preview */
    function commit(silent) {
        if (!CMS.save()) {
            toast('Storage full — remove or shrink some images.', true);
            return false;
        }
        markSaved();

        /* With remote storage on, saving means publishing to every device. */
        if (CMS.remote.enabled && !silent) {
            var btn = $('#btnSave');
            btn.disabled = true;
            var label = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing…';
            CMS.remote.publish().then(function () {
                btn.disabled = false;
                btn.innerHTML = label;
                toast('Published. Every device sees this now.');
            }).catch(function (err) {
                btn.disabled = false;
                btn.innerHTML = label;
                toast('Saved locally but NOT published: ' + err.message, true);
                if (/sign in/i.test(err.message)) showGate();
            });
        }
        renderPreview();
        $('#brandLabel').textContent = CMS.get('branding.siteName', 'BRAND');
        updateStorageMeter();
        return true;
    }

    function switchPanel(name) {
        $$('.adm-nav-item').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-panel') === name);
        });
        $$('.adm-panel').forEach(function (p) {
            p.classList.toggle('active', p.id === 'panel-' + name);
        });
        var btn = $('.adm-nav-item[data-panel="' + name + '"]');
        if (btn) $('#panelTitle').textContent = btn.textContent.trim();
        $('#admSide').classList.remove('open');
        window.scrollTo(0, 0);
    }

    /* ========================================================
       GENERIC BINDINGS  (data-bind="branding.siteName")
       Escaped dots in keys: text.btn\.apk -> ['text','btn.apk']
    ======================================================== */
    function bindPath(el) {
        return el.getAttribute('data-bind').replace(/\\\./g, '\u0000');
    }

    function readPath(path) {
        var parts = path.split('.').map(function (p) { return p.replace(/\u0000/g, '.'); });
        var cur = CMS.data(), i;
        for (i = 0; i < parts.length; i++) {
            if (cur == null) return '';
            cur = cur[parts[i]];
        }
        return cur == null ? '' : cur;
    }

    function writePath(path, val) {
        var parts = path.split('.').map(function (p) { return p.replace(/\u0000/g, '.'); });
        var cur = CMS.data(), i;
        for (i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = val;
    }

    function hydrateBindings() {
        $$('[data-bind]').forEach(function (el) {
            var p = bindPath(el);
            var v = readPath(p);
            if (el.type === 'checkbox') el.checked = !!v;
            else el.value = v;
        });
    }

    document.addEventListener('input', function (e) {
        var el = e.target;
        if (!el.hasAttribute || !el.hasAttribute('data-bind')) return;
        var v = el.type === 'checkbox' ? el.checked :
                (el.type === 'number' ? Number(el.value) : el.value);
        writePath(bindPath(el), v);
        markDirty();
    });

    /* ========================================================
       COLORS
    ======================================================== */
    function isHex(v) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v).trim()); }

    function colorRow(key, label) {
        var val = CMS.get('colors.' + key, '#000000');
        var row = document.createElement('div');
        row.className = 'crow';
        row.innerHTML =
            '<input type="color" ' + (isHex(val) ? 'value="' + val + '"' : '') + '>' +
            '<label>' + label + '</label>' +
            '<input type="text" value="' + val + '" spellcheck="false">';

        var picker = row.children[0], textIn = row.children[2];

        picker.addEventListener('input', function () {
            textIn.value = picker.value;
            applyColor(key, picker.value);
        });
        textIn.addEventListener('input', function () {
            if (isHex(textIn.value)) picker.value = textIn.value.trim();
            applyColor(key, textIn.value.trim());
        });
        return row;
    }

    function applyColor(key, value) {
        CMS.data().colors[key] = value;
        CMS.paintVars();      /* repaints the admin preview instantly */
        renderPreview();
        markDirty();
    }


    /* ========================================================
       TYPOGRAPHY PANEL
    ======================================================== */

    var TYPO_SECTIONS = [
        ['base',         'Base / body text'],
        ['headerBtns',   'Header buttons'],
        ['marquee',      'Marquee ticker'],
        ['nav',          'Main navigation'],
        ['mobileNav',    'Mobile category strip'],
        ['liveStrip',    'Live events strip'],
        ['sportTabs',    'Sport tabs'],
        ['groupHeader',  'Match group headers'],
        ['matchTitle',   'Match titles'],
        ['matchMeta',    'Match date / meta'],
        ['odds',         'Odds buttons'],
        ['casinoLabels', 'Casino card labels'],
        ['sidebar',      'Left sidebar'],
        ['support',      'Support section'],
        ['footer',       'Footer']
    ];

    var FONT_STACKS = [
        ['', 'Inherit (no change)'],
        ["'Roboto', Arial, sans-serif", 'Roboto'],
        ["'Poppins', Arial, sans-serif", 'Poppins'],
        ["'Montserrat', Arial, sans-serif", 'Montserrat'],
        ["'Open Sans', Arial, sans-serif", 'Open Sans'],
        ["'Lato', Arial, sans-serif", 'Lato'],
        ["'Oswald', Arial, sans-serif", 'Oswald'],
        ["Arial, Helvetica, sans-serif", 'Arial'],
        ["'Times New Roman', serif", 'Times New Roman'],
        ["Georgia, serif", 'Georgia'],
        ["'Courier New', monospace", 'Courier New']
    ];

    var TYPO_FIELDS = [
        { key: 'fontFamily',    label: 'Font family',    type: 'select', opts: FONT_STACKS },
        { key: 'fontSize',      label: 'Font size (px)', type: 'text',   ph: 'e.g. 14' },
        { key: 'fontWeight',    label: 'Font weight',    type: 'select',
          opts: [['', 'Inherit'], ['300', 'Light 300'], ['400', 'Normal 400'], ['500', 'Medium 500'],
                 ['600', 'Semibold 600'], ['700', 'Bold 700'], ['800', 'Extra bold 800'], ['900', 'Black 900']] },
        { key: 'fontStyle',     label: 'Font style',     type: 'select',
          opts: [['', 'Inherit'], ['normal', 'Normal'], ['italic', 'Italic']] },
        { key: 'letterSpacing', label: 'Letter spacing (px)', type: 'text', ph: 'e.g. 0.5' },
        { key: 'lineHeight',    label: 'Line height',    type: 'text',   ph: 'e.g. 1.4' },
        { key: 'textTransform', label: 'Text transform', type: 'select',
          opts: [['', 'Inherit'], ['none', 'None'], ['uppercase', 'UPPERCASE'],
                 ['lowercase', 'lowercase'], ['capitalize', 'Capitalize']] }
    ];

    function typoGet(section, key) {
        var t = CMS.data().typography || {};
        return (t[section] && t[section][key]) || '';
    }

    function typoSet(section, key, val) {
        var data = CMS.data();
        if (!data.typography) data.typography = {};
        if (!data.typography[section]) data.typography[section] = {};
        data.typography[section][key] = val;
        CMS.paintTypography();
        markDirty();
    }

    function buildTypography() {
        var wrap = $('#typoGroups');
        if (!wrap) return;
        wrap.innerHTML = '';

        TYPO_SECTIONS.forEach(function (sec) {
            var card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = '<h2>' + esc(sec[1]) + '</h2>' +
                '<p class="hint">Leave a field blank to keep the current design.</p>';

            var grid = document.createElement('div');
            grid.className = 'typo-grid';

            TYPO_FIELDS.forEach(function (f) {
                var row = document.createElement('label');
                row.className = 'typo-field';
                row.innerHTML = '<span>' + esc(f.label) + '</span>';

                var input;
                if (f.type === 'select') {
                    input = document.createElement('select');
                    f.opts.forEach(function (o) {
                        var op = document.createElement('option');
                        op.value = o[0];
                        op.textContent = o[1];
                        input.appendChild(op);
                    });
                } else {
                    input = document.createElement('input');
                    input.type = 'text';
                    if (f.ph) input.placeholder = f.ph;
                }
                input.value = typoGet(sec[0], f.key);
                input.addEventListener('input', function () {
                    typoSet(sec[0], f.key, input.value);
                });
                input.addEventListener('change', function () {
                    typoSet(sec[0], f.key, input.value);
                });
                row.appendChild(input);
                grid.appendChild(row);
            });

            var clear = document.createElement('button');
            clear.className = 'adm-btn';
            clear.type = 'button';
            clear.textContent = 'Clear this section';
            clear.addEventListener('click', function () {
                var data = CMS.data();
                if (data.typography) delete data.typography[sec[0]];
                CMS.paintTypography();
                markDirty();
                buildTypography();
            });

            card.appendChild(grid);
            card.appendChild(clear);
            wrap.appendChild(card);
        });
    }

    function buildColors() {
        var wrap = $('#colorGroups');
        wrap.innerHTML = '';
        COLOR_GROUPS.forEach(function (g) {
            var card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = '<h2>' + g[0] + '</h2>';
            g[1].forEach(function (c) { card.appendChild(colorRow(c[0], c[1])); });
            wrap.appendChild(card);
        });

        var lc = $('#loginColors');
        lc.innerHTML = '';
        LOGIN_COLORS.forEach(function (c) { lc.appendChild(colorRow(c[0], c[1])); });
    }

    /* Miniature of the real site, painted with the live variables */
    function renderPreview() {
        var c = CMS.data().colors, t = CMS.data().text;
        var box = $('#colorPreview');
        if (!box) return;
        box.innerHTML =
            '<div class="pv-hdr" style="background:' + c['hdr-bg'] + ';color:' + c['hdr-text'] + '">' +
                '<span>' + esc(CMS.get('branding.siteName', 'BRAND')) + '</span>' +
                '<span class="pv-btns">' +
                    '<span style="background:' + c['btn-demo-bg'] + ';color:' + c['btn-demo-text'] + '">' + esc(t['btn.demo']) + '</span>' +
                    '<span style="background:' + c['btn-login-bg'] + ';color:' + c['btn-login-text'] + '">' + esc(t['btn.login']) + '</span>' +
                    '<span style="background:' + c['btn-register-bg'] + ';color:' + c['btn-register-text'] + '">' + esc(t['btn.register']) + '</span>' +
                '</span></div>' +
            '<div class="pv-nav" style="background:' + c['ticker-bg'] + ';color:' + c['ticker-text'] + '">' + esc(t['marquee.text']).slice(0, 54) + '…</div>' +
            '<div class="pv-nav" style="background:' + c['mob-cat-bg'] + ';color:' + c['mob-cat-text'] + '">CRASH · SPORTS · OUR CASINO · SLOTS</div>' +
            '<div class="pv-tabs" style="background:' + c['tabm-bg'] + ';color:' + c['tabm-text'] + '">' +
                '<span style="border-bottom:2px solid ' + c['tabm-active-line'] + '">CRICKET</span><span>FOOTBALL</span><span>TENNIS</span></div>' +
            '<div class="pv-head" style="background:' + c['table-head-bg'] + ';color:' + c['table-head-text'] + '">Super Over2</div>' +
            '<div class="pv-row" style="background:' + c['table-row-bg'] + ';border-bottom:1px solid ' + c['table-border'] + '">' +
                '<div class="pv-team" style="color:' + c['table-text'] + '">Kashi Rudras v Meerut Mavericks</div>' +
                '<div class="pv-date" style="color:' + c['table-dim'] + '">14/08/2026 20:30:00</div>' +
                '<div class="pv-odds" style="margin-top:3px">' +
                    '<i style="background:' + c['labels-bg'] + ';color:' + c['labels-text'] + ';grid-column:span 2">1</i>' +
                    '<i style="background:' + c['labels-bg'] + ';color:' + c['labels-text'] + ';grid-column:span 2">X</i>' +
                    '<i style="background:' + c['labels-bg'] + ';color:' + c['labels-text'] + ';grid-column:span 2">2</i>' +
                '</div>' +
                '<div class="pv-odds">' +
                    '<i style="background:' + c['back'] + ';color:' + c['odds-text'] + '">1.18</i>' +
                    '<i style="background:' + c['lay'] + ';color:' + c['odds-text'] + '">1.19</i>' +
                    '<i style="background:' + c['lock-bg'] + ';color:' + c['lock-dash'] + ';grid-column:span 2">– 🔒 –</i>' +
                    '<i style="background:' + c['back'] + ';color:' + c['odds-text'] + '">6.4</i>' +
                    '<i style="background:' + c['lay'] + ';color:' + c['odds-text'] + '">6.6</i>' +
                '</div></div>' +
            '<div class="pv-row" style="background:' + c['casino-bg'] + '">' +
                '<div class="pv-odds" style="grid-template-columns:repeat(4,1fr);gap:2px">' +
                    '<i style="background:' + c['casino-label-bg'] + ';color:' + c['casino-label-text'] + '">GOAL 2</i>' +
                    '<i style="background:' + c['casino-label-bg'] + ';color:' + c['casino-label-text'] + '">LUCKY 6</i>' +
                    '<i style="background:' + c['casino-label-bg'] + ';color:' + c['casino-label-text'] + '">TEEN 20</i>' +
                    '<i style="background:' + c['casino-label-bg'] + ';color:' + c['casino-label-text'] + '">POKER</i>' +
                '</div></div>' +
            '<div class="pv-foot" style="background:' + c['footer-bg'] + ';color:' + c['footer-text'] + '">' + esc(t['footer.copyright']).slice(0, 60) + '</div>';
    }

    /* ========================================================
       TEXT PANEL
    ======================================================== */
    function buildText() {
        var wrap = $('#textFields');
        wrap.innerHTML = '';
        var grid = document.createElement('div');
        grid.className = 'grid2';
        Object.keys(CMS.data().text).forEach(function (k) {
            if (/^login\.|^register\./.test(k)) return;   /* those live in their own panel */
            grid.appendChild(textField(k));
        });
        wrap.appendChild(grid);

        fill($('#loginText'), /^login\./);
        fill($('#registerText'), /^register\./);

        function fill(host, re) {
            host.innerHTML = '';
            Object.keys(CMS.data().text).forEach(function (k) {
                if (re.test(k)) host.appendChild(textField(k));
            });
        }
    }

    function textField(key) {
        var label = TEXT_LABELS[key] || key;
        var val = CMS.data().text[key] || '';
        var wrap = document.createElement('label');
        wrap.className = 'f';
        wrap.setAttribute('data-key', key);
        var long = val.length > 60;
        wrap.innerHTML = '<span>' + esc(label) + '<br><code style="opacity:.55">' + esc(key) + '</code></span>' +
            (long ? '<textarea rows="2"></textarea>' : '<input type="text">');
        var input = wrap.querySelector('input,textarea');
        input.value = val;
        input.addEventListener('input', function () {
            CMS.data().text[key] = input.value;
            markDirty();
            renderPreview();
        });
        return wrap;
    }

    $('#textFilter').addEventListener('input', function () {
        var q = this.value.toLowerCase();
        $$('#textFields .f').forEach(function (f) {
            f.style.display = f.getAttribute('data-key').toLowerCase().indexOf(q) > -1 ||
                              f.textContent.toLowerCase().indexOf(q) > -1 ? '' : 'none';
        });
    });

    /* ========================================================
       IMAGE MANAGER
    ======================================================== */
    var MAX_EDGE = 800;

    function readImage(file, cb) {
        if (!file) return;
        if (!/^image\//.test(file.type)) { toast('That is not an image file.', true); return; }
        var fr = new FileReader();
        fr.onload = function () {
            /* SVG and tiny files pass through untouched */
            if (/svg|icon/.test(file.type) || file.size < 40000) return cb(fr.result);
            var img = new Image();
            img.onload = function () {
                var w = img.width, h = img.height, scale = Math.min(1, MAX_EDGE / Math.max(w, h));
                var cv = document.createElement('canvas');
                cv.width = Math.round(w * scale);
                cv.height = Math.round(h * scale);
                cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
                var type = /png/.test(file.type) ? 'image/png' : 'image/jpeg';
                cb(cv.toDataURL(type, 0.85));
            };
            img.onerror = function () { cb(fr.result); };
            img.src = fr.result;
        };
        fr.readAsDataURL(file);
    }

    function imageSlot(key, label) {
        var el = document.createElement('div');
        el.className = 'imgslot';
        el.innerHTML =
            '<h4>' + label + '</h4>' +
            '<div class="thumb"></div>' +
            '<div class="row">' +
                '<button class="adm-btn ghost up"><i class="fas fa-upload"></i> Upload</button>' +
                '<button class="adm-btn ghost clr"><i class="fas fa-xmark"></i></button>' +
            '</div>' +
            '<input type="file" accept="image/*">';

        var thumb = el.querySelector('.thumb');
        var file = el.querySelector('input[type=file]');

        function paint() {
            var v = CMS.data().images[key];
            thumb.innerHTML = v ? '<img src="' + v + '" alt="">' : '<span>Using file from /assets</span>';
        }
        paint();

        el.querySelector('.up').addEventListener('click', function () { file.click(); });
        file.addEventListener('change', function () {
            readImage(file.files[0], function (dataUrl) {
                CMS.data().images[key] = dataUrl;
                paint();
                markDirty();
                syncAllSlots(key);
            });
            file.value = '';
        });
        el.querySelector('.clr').addEventListener('click', function () {
            CMS.data().images[key] = '';
            paint();
            markDirty();
            syncAllSlots(key);
        });

        el._key = key;
        el._paint = paint;
        return el;
    }

    var slotRegistry = [];

    function syncAllSlots(key) {
        slotRegistry.forEach(function (s) { if (s._key === key) s._paint(); });
    }

    function buildImages() {
        slotRegistry = [];
        fill($('#brandImages'), ['logo', 'logoMobile', 'favicon', 'footerLogo']);
        fill($('#loginImages'), ['loginLogo', 'loginBg']);
        fill($('#registerImages'), ['registerLogo', 'registerBg']);
        fill($('#allImages'), IMAGE_SLOTS.map(function (s) { return s[0]; }));

        function fill(host, keys) {
            if (!host) return;
            host.innerHTML = '';
            keys.forEach(function (k) {
                var label = (IMAGE_SLOTS.filter(function (s) { return s[0] === k; })[0] || [k, k])[1];
                var slot = imageSlot(k, label);
                slotRegistry.push(slot);
                host.appendChild(slot);
            });
        }
        updateStorageMeter();
    }

    function updateStorageMeter() {
        var bar = $('#storageBar'), txt = $('#storageText');
        if (!bar) return;
        var bytes = 0;
        try { bytes = (localStorage.getItem(CMS.KEY) || '').length * 2; } catch (e) {}
        var mb = bytes / 1048576, pct = Math.min(100, (mb / 5) * 100);
        bar.style.width = pct.toFixed(1) + '%';
        bar.style.background = pct > 85 ? '#ff5a5a' : (pct > 60 ? '#ffb020' : '#2f9bff');
        txt.textContent = mb.toFixed(2) + ' MB of roughly 5 MB used by this brand.';
    }

    /* ========================================================
       HOME CONTENT LISTS
    ======================================================== */
    var LIST_DEFS = {
        featured: {
            host: '#listFeatured', count: '#cntFeatured',
            fields: [['name', 'Match name'], ['icon', 'Icon class'], ['link', 'Link']],
            blank: function () { return { name: 'New match', icon: 'fas fa-cricket-bat-ball', link: '#', enabled: true }; }
        },
        categories: {
            host: '#listCategories', count: '#cntCategories',
            fields: [['name', 'Label'], ['link', 'Link']],
            blank: function () { return { name: 'NEW', link: '#', active: false, enabled: true }; }
        },
        sports: {
            host: '#listSports', count: '#cntSports',
            fields: [['name', 'Label'], ['slug', 'Slug'], ['icon', 'Icon class']],
            blank: function () { return { name: 'NEW SPORT', slug: 'new', icon: 'fas fa-circle-dot', active: false, enabled: true }; }
        },
        casino: {
            host: '#listCasino', count: '#cntCasino',
            fields: [['title', 'Title'], ['link', 'Link']],
            image: 'src',
            blank: function () { return { id: 'game' + Date.now(), title: 'NEW GAME', src: '', link: 'login.html', enabled: true }; }
        }
    };

    function buildList(name) {
        var def = LIST_DEFS[name];
        var host = $(def.host);
        var arr = CMS.data().home[name];
        host.innerHTML = '';
        $(def.count).textContent = arr.length;

        arr.forEach(function (item, idx) {
            var row = document.createElement('div');
            row.className = 'item';
            row.draggable = true;
            row.setAttribute('data-idx', idx);

            var html = '<span class="handle"><i class="fas fa-grip-vertical"></i></span>';
            if (def.image) {
                html += '<img class="mini" src="' + esc(item[def.image] || '') + '" alt="" ' +
                        'onerror="this.style.visibility=\'hidden\'">';
            }
            html += '<div class="fields">';
            def.fields.forEach(function (f) {
                html += '<input type="text" data-k="' + f[0] + '" value="' + esc(item[f[0]] || '') +
                        '" placeholder="' + f[1] + '">';
            });
            html += '</div><div class="tools">';
            if (def.image) html += '<button class="icon-btn img" title="Replace image"><i class="fas fa-image"></i></button>';
            html += '<input type="checkbox" title="Enabled" ' + (item.enabled !== false ? 'checked' : '') + '>' +
                    '<button class="icon-btn del" title="Delete"><i class="fas fa-trash"></i></button>' +
                    '</div><input type="file" accept="image/*" hidden>';
            row.innerHTML = html;

            row.querySelectorAll('input[data-k]').forEach(function (inp) {
                inp.addEventListener('input', function () {
                    item[inp.getAttribute('data-k')] = inp.value;
                    markDirty();
                });
            });

            row.querySelector('input[type=checkbox]').addEventListener('change', function () {
                item.enabled = this.checked;
                markDirty();
            });

            row.querySelector('.del').addEventListener('click', function () {
                if (!confirm('Delete "' + (item.name || item.title) + '"?')) return;
                arr.splice(idx, 1);
                buildList(name);
                markDirty();
            });

            var fileIn = row.querySelector('input[type=file]');
            var imgBtn = row.querySelector('.img');
            if (imgBtn) {
                imgBtn.addEventListener('click', function () { fileIn.click(); });
                fileIn.addEventListener('change', function () {
                    readImage(fileIn.files[0], function (dataUrl) {
                        item[def.image] = dataUrl;
                        buildList(name);
                        markDirty();
                    });
                });
            }

            bindDrag(row, arr, name);
            host.appendChild(row);
        });
    }

    var dragSrc = null;

    function bindDrag(row, arr, name) {
        row.addEventListener('dragstart', function (e) {
            dragSrc = row;
            row.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', row.getAttribute('data-idx')); } catch (err) {}
        });
        row.addEventListener('dragend', function () {
            row.classList.remove('dragging');
            $$('.item').forEach(function (r) { r.classList.remove('drag-over'); });
        });
        row.addEventListener('dragover', function (e) {
            e.preventDefault();
            if (dragSrc && dragSrc !== row) row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
        row.addEventListener('drop', function (e) {
            e.preventDefault();
            if (!dragSrc || dragSrc === row) return;
            var from = Number(dragSrc.getAttribute('data-idx'));
            var to = Number(row.getAttribute('data-idx'));
            var moved = arr.splice(from, 1)[0];
            arr.splice(to, 0, moved);
            dragSrc = null;
            buildList(name);
            markDirty();
        });
    }

    $$('[data-add]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var name = btn.getAttribute('data-add');
            CMS.data().home[name].push(LIST_DEFS[name].blank());
            buildList(name);
            markDirty();
        });
    });

    function buildAllLists() {
        Object.keys(LIST_DEFS).forEach(buildList);
    }

    /* ========================================================
       PRESETS
    ======================================================== */
    function buildPresets() {
        var host = $('#presetGrid');
        host.innerHTML = '';
        Object.keys(PRESETS).forEach(function (key) {
            var p = PRESETS[key];
            var merged = Object.assign({}, CMS.DEFAULTS.colors, p.colors);
            var b = document.createElement('button');
            b.className = 'preset';
            b.innerHTML = '<strong>' + p.label + '</strong><small>' + p.note + '</small>' +
                '<span class="swatches">' +
                    '<i style="background:' + merged['hdr-bg'] + '"></i>' +
                    '<i style="background:' + merged['nav-bg'] + '"></i>' +
                    '<i style="background:' + merged['tabm-bg'] + '"></i>' +
                    '<i style="background:' + merged['back'] + '"></i>' +
                    '<i style="background:' + merged['lay'] + '"></i>' +
                '</span>';
            b.addEventListener('click', function () {
                if (!confirm('Apply the ' + p.label + ' palette? This overwrites all current colours.')) return;
                CMS.data().colors = merged;
                CMS.data().settings.preset = key;
                CMS.paintVars();
                buildColors();
                renderPreview();
                commit();
                toast(p.label + ' palette applied.');
            });
            host.appendChild(b);
        });
    }

    /* ========================================================
       EXPORT / IMPORT
    ======================================================== */
    $('#btnExport').addEventListener('click', function () {
        var name = String(CMS.get('branding.siteName', 'brand')).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        var blob = new Blob([CMS.exportJSON()], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name + '-whitelabel.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('Brand exported.');
    });

    /* Publish file: the whole config wrapped as a loadable script */
    function brandFileText() {
        return '/* ============================================================\n' +
               '   PUBLISHED BRAND — ' + CMS.get('branding.siteName', 'brand') + '\n' +
               '   Generated ' + new Date().toLocaleString() + ' by /admin\n' +
               '   Regenerate: /admin > Export / Import > Download brand.js\n' +
               '   ============================================================ */\n' +
               'window.CMS_BRAND = ' + CMS.exportJSON() + ';\n';
    }

    function refreshPublishSize() {
        var el = $('#publishSize');
        if (!el) return;
        var kb = brandFileText().length / 1024;
        el.textContent = 'Current file size: ' + (kb > 1024
            ? (kb / 1024).toFixed(2) + ' MB — large, because uploaded images are embedded.'
            : kb.toFixed(0) + ' KB.');
    }

    $('#btnPublish').addEventListener('click', function () {
        var blob = new Blob([brandFileText()], { type: 'application/javascript' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'brand.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('brand.js downloaded — put it in js/ and redeploy.');
    });

    $('#btnCopy').addEventListener('click', function () {
        var json = CMS.exportJSON();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(json).then(function () { toast('Copied to clipboard.'); },
                function () { toast('Copy failed — use Download instead.', true); });
        } else {
            $('#importText').value = json;
            toast('Clipboard unavailable — JSON placed in the import box.');
        }
    });

    function doImport(json) {
        var obj;
        try { obj = JSON.parse(json); } catch (e) {
            toast('That is not valid JSON.', true);
            return;
        }
        if (!obj || typeof obj !== 'object') { toast('Unexpected file contents.', true); return; }
        if (!confirm('Import will replace everything currently saved. Continue?')) return;
        if (!CMS.replace(obj)) { toast('Import too large for storage.', true); return; }
        refreshAll();
        toast('White label imported.');
    }

    $('#importFile').addEventListener('change', function () {
        var f = this.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () { doImport(fr.result); };
        fr.readAsText(f);
        this.value = '';
    });

    $('#btnImportText').addEventListener('click', function () {
        var v = $('#importText').value.trim();
        if (!v) { toast('Paste some JSON first.', true); return; }
        doImport(v);
    });

    /* ========================================================
       RESET
    ======================================================== */
    $$('[data-reset]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var what = btn.getAttribute('data-reset');
            var msg = what === 'all'
                ? 'FACTORY RESET — every branding, colour, text, image and layout change will be lost. Continue?'
                : 'Reset ' + what + ' to the shipped defaults?';
            if (!confirm(msg)) return;
            if (what === 'all') {
                if (!confirm('Last chance. This cannot be undone. Really factory reset?')) return;
                CMS.reset();
            } else {
                CMS.reset(what);
            }
            refreshAll();
            toast(what === 'all' ? 'Factory reset complete.' : what + ' reset.');
        });
    });

    /* ========================================================
       TOP BAR
    ======================================================== */
    $('#btnSave').addEventListener('click', function () {
        var ok = commit();
        if (ok && !CMS.remote.enabled) {
            toast('Saved to this browser. Turn on remote storage to publish everywhere.');
        }
    });

    $('#btnRevert').addEventListener('click', function () {
        if (dirty && !confirm('Discard unsaved changes?')) return;
        CMS.reload();
        refreshAll();
        toast('Reverted to last save.');
    });

    $('#admBurger').addEventListener('click', function () {
        $('#admSide').classList.toggle('open');
    });

    $$('.adm-nav-item').forEach(function (b) {
        b.addEventListener('click', function () { switchPanel(b.getAttribute('data-panel')); });
    });

    window.addEventListener('beforeunload', function (e) {
        if (!dirty) return;
        e.preventDefault();
        e.returnValue = '';
    });

    /* ========================================================
       SIGN IN GATE  (only when remote storage is configured)
    ======================================================== */
    function showGate() {
        $('#authGate').hidden = false;
        setTimeout(function () { $('#authEmail').focus(); }, 60);
    }

    function hideGate() { $('#authGate').hidden = true; }

    function paintRemoteStatus() {
        var pill = $('#remoteState'), hint = $('#remoteHint'), badge = $('#liveBadge');
        if (!pill) return;

        if (!CMS.remote.enabled) {
            pill.textContent = 'off';
            pill.className = 'pill warn';
            hint.innerHTML = 'Settings stay in this browser only. Fill in ' +
                '<code>js/cms-config.js</code> to publish to every device automatically. ' +
                'See SETUP-SUPABASE.txt.';
            badge.hidden = true;
            $('#btnSignOut').hidden = true;
            return;
        }

        badge.hidden = false;
        $('#btnSignOut').hidden = !CMS.remote.signedIn();

        if (CMS.remote.lastError) {
            pill.textContent = 'error';
            pill.className = 'pill warn';
            hint.textContent = 'Could not reach the server: ' + CMS.remote.lastError.message +
                '. Showing the cached brand. Check the url and anonKey in js/cms-config.js.';
        } else {
            pill.textContent = 'on';
            pill.className = 'pill ok';
            hint.textContent = 'Save changes publishes straight to every visitor, on every device. ' +
                'No downloading, no redeploying.';
        }
    }

    if (CMS.remote.enabled) {
        if (!CMS.remote.signedIn()) showGate();

        $('#authForm').addEventListener('submit', function (e) {
            e.preventDefault();
            var btn = $('#authBtn'), err = $('#authErr');
            err.hidden = true;
            btn.disabled = true;
            btn.textContent = 'Signing in…';
            CMS.remote.signIn($('#authEmail').value.trim(), $('#authPass').value)
                .then(function () {
                    btn.disabled = false;
                    btn.textContent = 'Sign in';
                    hideGate();
                    return CMS.remote.pull();
                })
                .then(function () {
                    refreshAll();
                    paintRemoteStatus();
                    toast('Signed in. Save changes now publishes live.');
                })
                .catch(function (e2) {
                    btn.disabled = false;
                    btn.textContent = 'Sign in';
                    err.textContent = e2.message;
                    err.hidden = false;
                });
        });

        $('#btnSignOut').addEventListener('click', function () {
            CMS.remote.signOut();
            paintRemoteStatus();
            showGate();
        });

        /* Server row arrived after boot — refresh every field */
        document.addEventListener('cms:remote-loaded', function () {
            refreshAll();
            paintRemoteStatus();
        });
    }

    /* Exposed for the Theme Manager module below */
    window.ADMIN_REFRESH = function () { refreshAll(); };
    window.ADMIN_READ_IMAGE = readImage;

    window.CMS_ON_QUOTA = function () {
        toast('Storage limit reached — remove some uploaded images.', true);
    };

    /* ========================================================
       BOOT
    ======================================================== */
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function refreshAll() {
        CMS.paintVars();
        hydrateBindings();
        buildColors();
        buildTypography();
        buildText();
        buildImages();
        buildAllLists();
        buildPresets();
        renderPreview();
        $('#brandLabel').textContent = CMS.get('branding.siteName', 'BRAND');
        updateStorageMeter();
        refreshPublishSize();
        paintRemoteStatus();
        dirty = false;
        $('#savedFlag').className = 'adm-saved';
    }

    refreshAll();

    /* First run with no harvested content? Tell the admin how to fill it. */
    if (!CMS.data().home.sports.length) {
        toast('Open the site once (View site) so the CMS can read your existing content.');
    }

})();


/* ============================================================
   THEME MANAGER — appended to admin.js
   A theme is a named snapshot of brand + colours + logos.
   Everything here sits on top of the CMS engine in ../js/cms.js
   ============================================================ */
(function () {
    'use strict';

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function toast(msg, isErr) {
        var t = $('#toast');
        t.textContent = msg;
        t.className = 'toast show' + (isErr ? ' err' : '');
        clearTimeout(t._t);
        t._t = setTimeout(function () { t.className = 'toast'; }, 2600);
    }

    /* ========================================================
       COLOUR MATHS
    ======================================================== */
    function hex2rgb(h) {
        h = String(h || '').trim().replace('#', '');
        if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
        if (!/^[0-9a-f]{6}$/i.test(h)) return { r: 0, g: 0, b: 0 };
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16)
        };
    }

    function rgb2hex(r, g, b) {
        function p(n) { return ('0' + Math.max(0, Math.min(255, Math.round(n))).toString(16)).slice(-2); }
        return '#' + p(r) + p(g) + p(b);
    }

    function mix(a, b, amount) {
        var x = hex2rgb(a), y = hex2rgb(b), t = amount;
        return rgb2hex(x.r + (y.r - x.r) * t, x.g + (y.g - x.g) * t, x.b + (y.b - x.b) * t);
    }

    var lighten = function (c, t) { return mix(c, '#ffffff', t); };
    var darken = function (c, t) { return mix(c, '#000000', t); };

    function luminance(c) {
        var x = hex2rgb(c);
        return (0.299 * x.r + 0.587 * x.g + 0.114 * x.b) / 255;
    }

    /* Pick black or white text for a background */
    function readable(bg) { return luminance(bg) > 0.6 ? '#111111' : '#ffffff'; }

    /* ========================================================
       PALETTE DERIVATION
       Five core colours -> the full ~80 variable map. Any value
       can still be overridden individually in the Colors panel.
    ======================================================== */
    function derive(core) {
        var primary = core.primary,
            secondary = core.secondary,
            accent = core.accent,
            bg = core.bg,
            text = core.text;

        var onPrimary = readable(primary),
            onSecondary = readable(secondary),
            onAccent = readable(accent),
            darkBg = luminance(bg) < 0.5;

        var surface = darkBg ? lighten(bg, 0.06) : '#ffffff';
        var dim = darkBg ? lighten(text, 0.35) : lighten(text, 0.45);
        var line = darkBg ? lighten(bg, 0.12) : darken(bg, 0.1);

        return {
            /* header */
            'hdr-bg': primary,
            'hdr-text': onPrimary,
            'ticker-bg': lighten(primary, 0.34),
            'ticker-text': onPrimary,
            'ticker-icon-bg': accent,
            /* header buttons */
            'btn-apk-bg': darken(primary, 0.22),
            'btn-apk-text': onPrimary,
            'btn-demo-bg': '#ffffff',
            'btn-demo-text': primary,
            'btn-login-bg': secondary,
            'btn-login-text': onSecondary,
            'btn-register-bg': accent,
            'btn-register-text': onAccent,
            /* navigation */
            'nav-bg': secondary,
            'nav-text': mix(onSecondary, secondary, 0.35),
            'nav-active': onSecondary,
            'nav-accent': accent,
            /* sports tabs */
            'tab-bg': darkBg ? lighten(bg, 0.1) : darken(bg, 0.05),
            'tab-text': text,
            'tab-active-bg': surface,
            'tab-active-text': primary,
            'tab-active-line': primary,
            'tabm-bg': secondary,
            'tabm-text': onSecondary,
            'tabm-active-line': accent,
            /* match table */
            'table-bg': surface,
            'table-row-bg': surface,
            'table-head-bg': darkBg ? lighten(bg, 0.1) : mix(bg, primary, 0.06),
            'table-head-text': text,
            'table-text': text,
            'table-dim': dim,
            'table-border': line,
            'labels-bg': darkBg ? lighten(bg, 0.1) : mix(bg, primary, 0.05),
            'labels-text': text,
            /* odds — kept close to industry standard blue/pink */
            'back': '#72bbef',
            'lay': '#f98bae',
            'odds-text': '#000000',
            'lock-bg': 'rgba(11, 20, 30, 0.68)',
            'lock-icon': 'rgba(0, 0, 0, 0.85)',
            'lock-dash': 'rgba(255, 255, 255, 0.55)',
            /* BM + live dots */
            'bm-text': text,
            'live-green': '#00b81c',
            'live-red': '#cc0000',
            'live-blue': '#0066cc',
            'live-grey': '#c9c9c9',
            /* casino */
            'casino-bg': darkBg ? darken(bg, 0.2) : darken(bg, 0.06),
            'casino-card-bg': darkBg ? lighten(bg, 0.12) : darken(bg, 0.16),
            'casino-label-bg': darkBg ? lighten(bg, 0.16) : darken(bg, 0.24),
            'casino-label-text': darkBg ? text : darken(text, 0.1),
            'casino-hover': accent,
            /* sidebar */
            'sidebar-bg': darkBg ? lighten(bg, 0.05) : darken(bg, 0.03),
            'sidebar-head': primary,
            'sidebar-head-text': onPrimary,
            'sidebar-active': primary,
            'sidebar-active-bg': mix(surface, primary, 0.12),
            /* live strip */
            'live-strip-bg': darkBg ? darken(bg, 0.12) : darken(bg, 0.1),
            'live-item-bg': surface,
            /* support + footer */
            'support-bg': primary,
            'support-text': onPrimary,
            'wa-green': '#25d366',
            'footer-bg': darkBg ? darken(bg, 0.2) : lighten(bg, 0.4),
            'footer-text': dim,
            /* mobile strips */
            'mob-feat-bg': primary,
            'mob-feat-card-bg': secondary,
            'mob-feat-text': mix(onSecondary, secondary, 0.2),
            'mob-cat-bg': primary,
            'mob-cat-text': onPrimary,
            /* page + generic */
            'page-bg': bg,
            'content-bg': surface,
            'text': text,
            'text-dim': dim,
            'border': line,
            'border-light': darkBg ? lighten(bg, 0.08) : darken(bg, 0.05),
            /* login page */
            'login-bg-from': lighten(primary, 0.15),
            'login-bg-to': darken(secondary, 0.4),
            'login-card-bg': surface,
            'login-title': primary,
            'login-btn-bg': primary,
            'login-btn-text': onPrimary,
            'login-footer-bg': primary
        };
    }

    /* Read the five core colours back out of a full palette */
    function coreOf(colors) {
        return {
            primary: colors['hdr-bg'] || '#0088cc',
            secondary: colors['nav-bg'] || '#24364a',
            accent: colors['nav-accent'] || '#ff8800',
            bg: colors['page-bg'] || '#eef0f3',
            text: colors['text'] || '#222222'
        };
    }

    /* ========================================================
       SEED THEMES on first run
    ======================================================== */
    var SEEDS = [
        ['playzone', 'Playzone Blue', 'PLAYZONE9',
            { primary: '#0088cc', secondary: '#2c3e50', accent: '#ff8800', bg: '#eef0f3', text: '#222222' }],
        ['gin247', 'Gin247 Yellow', 'GIN247',
            { primary: '#111111', secondary: '#1c1c1c', accent: '#ffd400', bg: '#f2f2f2', text: '#1a1a1a' }],
        ['diamond', 'Diamond Red', 'DIAMOND',
            { primary: '#9b0f1e', secondary: '#3d0509', accent: '#d4af37', bg: '#f6efe6', text: '#2b0407' }],
        ['lotus', 'Lotus Green', 'LOTUS',
            { primary: '#0e7a55', secondary: '#123a2c', accent: '#f5b301', bg: '#eef4f0', text: '#173026' }],
        ['sky', 'Sky Purple', 'SKY',
            { primary: '#6c3fd1', secondary: '#241a45', accent: '#00d0c0', bg: '#f1eefb', text: '#241a45' }]
    ];

    function seedThemes() {
        if (CMS.themes.list().length) return;
        SEEDS.forEach(function (s, i) {
            CMS.themes.save({
                id: s[0],
                name: s[1],
                order: i,
                brand: {
                    siteName: s[2],
                    browserTitle: s[2] + ' — Online Sports Betting & Casino',
                    loginTitle: 'Login — ' + s[2]
                },
                colors: s[0] === 'playzone' ? CMS.clone(CMS.DEFAULTS.colors) : derive(s[3]),
                images: { logo: '', logoMobile: '', favicon: '', footerLogo: '', loginLogo: '' }
            });
        });
        if (!CMS.get('settings.activeTheme')) CMS.set('settings.activeTheme', 'playzone');
        CMS.save();
    }

    /* ========================================================
       THEME CARDS
    ======================================================== */
    function miniPreview(colors, images, brandName) {
        var c = colors;
        var logo = images && images.logo
            ? '<img src="' + esc(images.logo) + '" alt="">'
            : '<span>' + esc(brandName || '') + '</span>';
        return '<div class="tc-mini" style="background:' + c['content-bg'] + '">' +
            '<div class="m-hdr" style="background:' + c['hdr-bg'] + ';color:' + c['hdr-text'] + '">' +
                logo +
                '<span style="display:flex;gap:3px">' +
                    '<span class="m-btn" style="background:' + c['btn-demo-bg'] + ';color:' + c['btn-demo-text'] + '">Demo</span>' +
                    '<span class="m-btn" style="background:' + c['btn-login-bg'] + ';color:' + c['btn-login-text'] + '">Login</span>' +
                '</span></div>' +
            '<div class="m-tabs" style="background:' + c['tabm-bg'] + ';color:' + c['tabm-text'] + '">' +
                '<span style="border-bottom:1px solid ' + c['tabm-active-line'] + '">CRICKET</span>' +
                '<span>FOOTBALL</span><span>TENNIS</span></div>' +
            '<div class="m-row" style="background:' + c['table-head-bg'] + ';color:' + c['table-head-text'] + '">Super Over2</div>' +
            '<div class="m-odds">' +
                '<span style="background:' + c['back'] + '"></span><span style="background:' + c['lay'] + '"></span>' +
                '<span style="background:' + c['lock-bg'] + ';grid-column:span 2"></span>' +
                '<span style="background:' + c['back'] + '"></span><span style="background:' + c['lay'] + '"></span>' +
            '</div></div>';
    }

    function renderThemes() {
        var grid = $('#themeGrid');
        if (!grid) return;
        var list = CMS.themes.list();
        var activeId = CMS.themes.activeId();
        $('#cntThemes').textContent = list.length;
        grid.innerHTML = '';

        if (!list.length) {
            grid.innerHTML = '<p class="hint">No themes yet — create one to get started.</p>';
            return;
        }

        list.forEach(function (th) {
            var isActive = th.id === activeId;
            var core = coreOf(th.colors);
            var card = document.createElement('div');
            card.className = 'themecard' + (isActive ? ' active' : '');
            card.innerHTML =
                miniPreview(th.colors, th.images, th.brand && th.brand.siteName) +
                '<div class="tc-body">' +
                    '<div class="tc-name">' + esc(th.name) +
                        (isActive ? '<span class="tc-live">Live</span>' : '') + '</div>' +
                    '<div class="tc-brand">' + esc((th.brand && th.brand.siteName) || '—') + '</div>' +
                    '<div class="tc-chips">' +
                        '<i style="background:' + core.primary + '" title="Primary"></i>' +
                        '<i style="background:' + core.secondary + '" title="Secondary"></i>' +
                        '<i style="background:' + core.accent + '" title="Accent"></i>' +
                        '<i style="background:' + core.bg + '" title="Background"></i>' +
                    '</div>' +
                    '<div class="tc-acts">' +
                        '<button class="apply"' + (isActive ? ' disabled' : '') + '>' +
                            (isActive ? 'Applied' : 'Apply theme') + '</button>' +
                        '<button class="edit">Edit</button>' +
                        '<button class="dup">Duplicate</button>' +
                        '<button class="exp">Export</button>' +
                        '<button class="del">Delete</button>' +
                    '</div></div>';

            card.querySelector('.apply').addEventListener('click', function () {
                if (isActive) return;
                if (!CMS.themes.apply(th.id)) { toast('Could not apply theme.', true); return; }
                window.ADMIN_REFRESH();
                renderThemes();
                reloadPreview();
                if (CMS.remote.enabled) {
                    CMS.remote.publish()
                        .then(function () { toast(th.name + ' is live on every device.'); })
                        .catch(function (err) { toast('Applied locally but not published: ' + err.message, true); });
                } else {
                    toast(th.name + ' applied. Every page now uses it.');
                }
            });

            card.querySelector('.edit').addEventListener('click', function () { startEditing(th.id); });

            card.querySelector('.dup').addEventListener('click', function () {
                var name = prompt('Name for the duplicate:', th.name.replace(/\s*copy.*$/i, '') + ' copy');
                if (!name) return;
                var copy = CMS.themes.duplicate(th.id, name);
                renderThemes();
                toast('Duplicated. Edit "' + copy.name + '" to change its logo and colours.');
            });

            card.querySelector('.exp').addEventListener('click', function () {
                var blob = new Blob([CMS.themes.exportOne(th.id)], { type: 'application/json' });
                var a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = th.id + '.json';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
                toast('Exported ' + th.id + '.json');
            });

            card.querySelector('.del').addEventListener('click', function () {
                if (CMS.themes.list().length < 2) { toast('Keep at least one theme.', true); return; }
                if (!confirm('Delete "' + th.name + '"? This cannot be undone.')) return;
                CMS.themes.remove(th.id);
                if (editingId === th.id) stopEditing(true);
                renderThemes();
                toast('Theme deleted.');
            });

            grid.appendChild(card);
        });
    }

    /* ========================================================
       EDIT MODE
       The theme is loaded into the live config so the existing
       Branding / Colors / Images panels edit it directly.
    ======================================================== */
    var editingId = null;

    function startEditing(id) {
        var th = CMS.themes.get(id);
        if (!th) return;
        editingId = id;

        var st = CMS.data(), k;
        for (k in th.brand) if (th.brand[k]) st.branding[k] = th.brand[k];
        st.colors = CMS.merge(st.colors, th.colors);
        for (k in th.images) if (th.images[k]) st.images[k] = th.images[k];

        CMS.paintVars();
        window.ADMIN_REFRESH();
        $('#editBar').hidden = false;
        $('#editBarName').textContent = th.name;
        renderThemes();
        pushPreview();
        toast('Editing "' + th.name + '". Use Branding, Colors and Images, then Save to theme.');
    }

    function stopEditing(silent) {
        editingId = null;
        $('#editBar').hidden = true;
        renderThemes();
        if (!silent) toast('Stopped editing. The live site is unchanged unless you saved.');
    }

    function saveToTheme() {
        if (!editingId) return;
        var th = CMS.themes.get(editingId);
        var snap = CMS.themes.fromCurrent(editingId, th.name);
        snap.order = th.order;
        CMS.themes.save(snap);
        if (CMS.themes.activeId() === editingId) CMS.themes.apply(editingId);
        renderThemes();
        reloadPreview();
        toast('Saved into "' + th.name + '".');
    }

    /* ========================================================
       CREATE / EDIT MODAL
    ======================================================== */
    var CORE_FIELDS = [
        ['primary', 'Primary — header, support bar, links'],
        ['secondary', 'Secondary — nav bar, sports tabs, login button'],
        ['accent', 'Accent — highlights, active underline, register button'],
        ['bg', 'Background — page behind the content'],
        ['text', 'Text — body copy']
    ];

    var draft = null;

    function openModal() {
        draft = {
            name: '', brandName: '', title: '',
            images: { logo: '', favicon: '' },
            core: { primary: '#0088cc', secondary: '#2c3e50', accent: '#ff8800', bg: '#eef0f3', text: '#222222' }
        };
        $('#modalTitle').textContent = 'Create Theme';
        $('#thName').value = '';
        $('#thBrand').value = '';
        $('#thTitle').value = '';
        buildModalColors();
        buildModalImages();
        drawModalPreview();
        $('#themeModal').hidden = false;
    }

    function closeModal() { $('#themeModal').hidden = true; }

    function buildModalColors() {
        var host = $('#thColors');
        host.innerHTML = '';
        CORE_FIELDS.forEach(function (f) {
            var row = document.createElement('div');
            row.className = 'crow';
            row.innerHTML =
                '<input type="color" value="' + draft.core[f[0]] + '">' +
                '<label>' + f[1] + '</label>' +
                '<input type="text" value="' + draft.core[f[0]] + '" spellcheck="false">';
            var pick = row.children[0], txt = row.children[2];
            pick.addEventListener('input', function () {
                txt.value = pick.value;
                draft.core[f[0]] = pick.value;
                drawModalPreview();
            });
            txt.addEventListener('input', function () {
                if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(txt.value)) {
                    pick.value = txt.value;
                    draft.core[f[0]] = txt.value;
                    drawModalPreview();
                }
            });
            host.appendChild(row);
        });
    }

    function buildModalImages() {
        var host = $('#thImages');
        host.innerHTML = '';
        [['logo', 'Logo'], ['favicon', 'Favicon']].forEach(function (pair) {
            var slot = document.createElement('div');
            slot.className = 'imgslot';
            slot.innerHTML =
                '<h4>' + pair[1] + '</h4>' +
                '<div class="thumb"></div>' +
                '<div class="row"><button class="adm-btn ghost up"><i class="fas fa-upload"></i> Upload</button>' +
                '<button class="adm-btn ghost clr"><i class="fas fa-xmark"></i></button></div>' +
                '<input type="file" accept="image/*">';
            var thumb = slot.querySelector('.thumb'), file = slot.querySelector('input');

            function paint() {
                thumb.innerHTML = draft.images[pair[0]]
                    ? '<img src="' + draft.images[pair[0]] + '" alt="">'
                    : '<span>None</span>';
            }
            paint();
            slot.querySelector('.up').addEventListener('click', function () { file.click(); });
            file.addEventListener('change', function () {
                window.ADMIN_READ_IMAGE(file.files[0], function (url) {
                    draft.images[pair[0]] = url;
                    paint();
                    drawModalPreview();
                });
                file.value = '';
            });
            slot.querySelector('.clr').addEventListener('click', function () {
                draft.images[pair[0]] = '';
                paint();
                drawModalPreview();
            });
            host.appendChild(slot);
        });
    }

    function drawModalPreview() {
        $('#thPreview').innerHTML =
            miniPreview(derive(draft.core), draft.images, $('#thBrand').value || 'BRAND');
    }

    ['#thName', '#thBrand', '#thTitle'].forEach(function (sel) {
        var el = $(sel);
        if (el) el.addEventListener('input', drawModalPreview);
    });

    function saveModal() {
        var name = $('#thName').value.trim();
        var brand = $('#thBrand').value.trim();
        if (!name) { toast('Give the theme a name.', true); return; }
        if (!brand) { toast('Give the brand a name.', true); return; }

        var id = CMS.themes.uid(name);
        CMS.themes.save({
            id: id,
            name: name,
            order: CMS.themes.list().length,
            brand: {
                siteName: brand,
                browserTitle: $('#thTitle').value.trim() || (brand + ' — Online Sports Betting & Casino'),
                loginTitle: 'Login — ' + brand
            },
            colors: derive(draft.core),
            images: {
                logo: draft.images.logo,
                logoMobile: draft.images.logo,
                favicon: draft.images.favicon,
                footerLogo: '',
                loginLogo: draft.images.logo
            }
        });
        closeModal();
        renderThemes();
        toast('"' + name + '" created. Hit Apply theme to go live with it.');
    }

    /* ========================================================
       LIVE 390px PREVIEW
    ======================================================== */
    function frameWin() {
        var f = $('#previewFrame');
        return f && f.contentWindow ? f.contentWindow : null;
    }

    function pushPreview() {
        var w = frameWin();
        if (!w) return;
        try {
            w.postMessage({
                channel: 'cms-preview',
                colors: CMS.data().colors,
                branding: CMS.data().branding,
                images: CMS.data().images,
                text: CMS.data().text
            }, '*');
        } catch (e) { /* frame not ready yet */ }
    }

    function reloadPreview() {
        var f = $('#previewFrame');
        if (f) f.contentWindow.location.reload();
    }

    /* Any colour edit anywhere in the admin repaints the phone */
    document.addEventListener('input', function (e) {
        if (e.target && (e.target.type === 'color' || e.target.hasAttribute('data-bind'))) {
            clearTimeout(pushPreview._t);
            pushPreview._t = setTimeout(pushPreview, 120);
        }
    });

    /* ========================================================
       WIRING
    ======================================================== */
    $('#btnCreateTheme').addEventListener('click', openModal);
    $('#modalClose').addEventListener('click', closeModal);
    $('#modalCancel').addEventListener('click', closeModal);
    $('#modalSave').addEventListener('click', saveModal);
    $('#themeModal').addEventListener('click', function (e) {
        if (e.target === this) closeModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !$('#themeModal').hidden) closeModal();
    });

    $('#btnSaveTheme').addEventListener('click', saveToTheme);
    $('#btnStopEdit').addEventListener('click', function () { stopEditing(); });
    $('#btnReloadPreview').addEventListener('click', reloadPreview);

    $('#themeImportFile').addEventListener('change', function () {
        var f = this.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
            try {
                var th = CMS.themes.importOne(fr.result);
                renderThemes();
                toast('Imported "' + th.name + '".');
            } catch (err) {
                toast('That file is not a theme export.', true);
            }
        };
        fr.readAsText(f);
        this.value = '';
    });

    $('#previewFrame').addEventListener('load', function () { setTimeout(pushPreview, 120); });

    /* ========================================================
       BOOT
    ======================================================== */
    seedThemes();
    renderThemes();

})();
