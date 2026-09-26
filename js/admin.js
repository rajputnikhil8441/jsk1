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
        'support.whatsappMessage': 'WhatsApp message (URL encoded)',
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
        'footer.about': 'Footer description',
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

        /* With remote storage on, saving means publishing to every device.
           The promise is handed back (milestone C) so a caller can hold its
           own button until the round trip finishes -- without it, a second
           click lands while the first is still in flight and publishes
           twice. Callers that only test truthiness are unaffected: a
           promise is truthy, exactly as `true` was. */
        var pending = null;
        if (CMS.remote.enabled && !silent) {
            var btn = $('#btnSave');
            btn.disabled = true;
            var label = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing…';
            pending = CMS.remote.publish().then(function () {
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
        return pending || true;
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
        /* Six of the design roles report what the Colors panel currently
           holds, so the text is stale the moment a colour is edited
           elsewhere. Rebuilt on the way in rather than on every keystroke
           over there. */
        if (name === 'design') buildDesign();
        if (name === 'media') { mediaShown = MEDIA_PAGE; buildMedia(); }
        /* Leaving the builder pulls the list the pointer was aiming at out
           from under a drag in flight. It ends here, and ends the way every
           cancelled drag does: without changing the draft. */
        pbCancelDrag();
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
        /* Inert, but it gives this row a stable handle -- the Page Builder's
           colour roles alias some of these keys, and a test has to be able
           to change the right one. */
        row.setAttribute('data-color-key', key);
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
        /* A Page Builder colour role that follows this colour now resolves
           to something else, so the Global Design panel's "resolves to"
           lines are stale. Rebuilt here only while that panel is the one on
           screen; otherwise showPanel() does it on the way in. */
        var d = $('#panel-design');
        if (d && d.classList.contains('active')) buildDesign();
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

    /* ---------- Global Design (Page Builder) ----------
       Two cards: the ten colour roles and the eight typography roles.

       Six colour roles are aliases of colours that already exist in the
       Colors panel, and that panel stays their source of truth: the row
       says which colour it follows and shows what it currently resolves
       to. Overriding one writes to design.colors, which only the Page
       Builder reads -- so an override here cannot repaint the rest of the
       site, and clearing it hands the role back to Colors. */

    var DESIGN_ROLE_WORDS = {
        primary: 'Primary', secondary: 'Secondary', text: 'Text', muted: 'Muted text',
        border: 'Border', background: 'Page background', surface: 'Surface',
        success: 'Success', warning: 'Warning', danger: 'Danger'
    };
    var DESIGN_SITE_WORDS = {
        'hdr-bg': 'Header background', 'text': 'Body text', 'text-dim': 'Dimmed text',
        'border': 'Border', 'page-bg': 'Page background', 'content-bg': 'Content background'
    };
    var DESIGN_TYPO_WORDS = {
        body: 'Body text', h1: 'Heading 1', h2: 'Heading 2', h3: 'Heading 3',
        h4: 'Heading 4', h5: 'Heading 5', h6: 'Heading 6', button: 'Button'
    };
    var DESIGN_TYPO_FIELDS = [
        ['fontSize', 'Size (px)'], ['fontWeight', 'Weight'],
        ['lineHeight', 'Line spacing'], ['letterSpacing', 'Letter spacing (px)']
    ];

    function designData() {
        var d = CMS.data();
        if (!d.design || typeof d.design !== 'object') d.design = {};
        if (!d.design.colors) d.design.colors = {};
        if (!d.design.typography) d.design.typography = {};
        return d.design;
    }

    /* Every edit repaints the one :root block the references read -- in this
       document, which is what the admin itself shows -- and then saves
       locally, because the Page Builder preview is a separate document that
       repaints off the storage event. Debounced so that typing a colour
       does not write on every keystroke, exactly as the builder's own draft
       autosave does. Publishing to other devices still waits for Save
       changes, as it does for every other panel. */
    var designSaveTimer = null;
    function designTouched() {
        CMS.sections.paintDesign();
        markDirty();
        if (designSaveTimer) clearTimeout(designSaveTimer);
        designSaveTimer = setTimeout(function () {
            designSaveTimer = null;
            commit(true);
        }, 250);
    }

    function buildDesign() {
        var wrap = $('#designRoles');
        if (!wrap) return;
        wrap.innerHTML = '';

        var roles = CMS.sections.colorRoles || {};
        var colorCard = document.createElement('div');
        colorCard.className = 'card';
        colorCard.innerHTML = '<h2>Colors</h2>' +
            '<p class="hint">Point a Page Builder element at one of these and it follows ' +
            'whatever this is set to.</p>';
        var cgrid = document.createElement('div');
        cgrid.className = 'typo-grid design-grid';

        Object.keys(roles).forEach(function (role) {
            var siteKey = roles[role][0];
            var row = document.createElement('div');
            row.className = 'design-role';
            row.setAttribute('data-role', role);

            var head = document.createElement('div');
            head.className = 'design-role-head';
            head.innerHTML = '<strong>' + esc(DESIGN_ROLE_WORDS[role] || role) + '</strong>';
            var src = document.createElement('em');
            src.className = 'design-role-src';
            row.appendChild(head);

            var sw = document.createElement('span');
            sw.className = 'design-swatch';

            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'design-role-in';
            input.setAttribute('data-role-input', role);
            input.placeholder = siteKey ? 'Follows Colors' : 'Leave blank for the default';

            function sync() {
                var stored = designData().colors[role];
                input.value = stored == null ? '' : String(stored);
                var resolved = CMS.sections.roleColor(role);
                sw.style.background = resolved;
                sw.setAttribute('data-resolved', resolved);
                src.textContent = stored
                    ? 'Overridden for the Page Builder \u2014 ' + resolved
                    : (siteKey
                        ? 'Uses the site \u201c' + (DESIGN_SITE_WORDS[siteKey] || siteKey) +
                          '\u201d colour \u2014 ' + resolved
                        : 'Page Builder only \u2014 ' + resolved);
                clear.hidden = !stored;
            }

            input.addEventListener('input', function () {
                var v = input.value.trim();
                if (v) designData().colors[role] = v;
                else delete designData().colors[role];
                designTouched();
                sync();
            });

            var clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'adm-btn ghost design-clear';
            clear.textContent = siteKey ? 'Use the site colour' : 'Use the default';
            clear.addEventListener('click', function () {
                delete designData().colors[role];
                designTouched();
                sync();
            });

            var line = document.createElement('div');
            line.className = 'design-role-line';
            line.appendChild(sw);
            line.appendChild(input);
            row.appendChild(line);
            row.appendChild(src);
            row.appendChild(clear);
            sync();
            cgrid.appendChild(row);
        });
        colorCard.appendChild(cgrid);
        wrap.appendChild(colorCard);

        var typo = CMS.sections.typoRoles || {};
        var typoCard = document.createElement('div');
        typoCard.className = 'card';
        typoCard.innerHTML = '<h2>Typography</h2>' +
            '<p class="hint">Text styles a Page Builder element can point at. These do not ' +
            'change the rest of the site \u2014 the <strong>Typography</strong> panel still ' +
            'owns that. Leave a box blank to keep the shipped value.</p>';

        Object.keys(typo).forEach(function (role) {
            var block = document.createElement('div');
            block.className = 'design-typo';
            block.setAttribute('data-typo-role', role);
            block.innerHTML = '<strong>' + esc(DESIGN_TYPO_WORDS[role] || role) + '</strong>';
            var g = document.createElement('div');
            g.className = 'typo-grid';
            DESIGN_TYPO_FIELDS.forEach(function (f) {
                var lab = document.createElement('label');
                lab.className = 'typo-field';
                lab.innerHTML = '<span>' + esc(f[1]) + '</span>';
                var inp = document.createElement('input');
                inp.type = 'text';
                inp.setAttribute('data-typo-input', role + '.' + f[0]);
                inp.placeholder = String(typo[role][f[0]]);
                var store = designData().typography;
                inp.value = (store[role] && store[role][f[0]] != null) ? String(store[role][f[0]]) : '';
                inp.addEventListener('input', function () {
                    var t = designData().typography;
                    if (!t[role]) t[role] = {};
                    var v = inp.value.trim();
                    if (v) t[role][f[0]] = v; else delete t[role][f[0]];
                    if (!Object.keys(t[role]).length) delete t[role];
                    designTouched();
                });
                lab.appendChild(inp);
                g.appendChild(lab);
            });
            block.appendChild(g);
            typoCard.appendChild(block);
        });
        wrap.appendChild(typoCard);
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


    /* ========================================================
       REGISTRATION PAGE PANEL
    ======================================================== */


    var REG_APPEARANCE = [
        ['primary', 'Primary blue',       'color'],
        ['green',   'Green button',       'color'],
        ['greyBg',  'Grey box background','color'],
        ['bg',      'Page background (CSS value, blank = default)', 'text'],
        ['radius',  'Card border radius (px)', 'text']
    ];

    function regGet(key) {
        var rp = CMS.data().registerPage || {};
        return rp[key] == null ? '' : rp[key];
    }

    function regSet(key, val) {
        var data = CMS.data();
        if (!data.registerPage) data.registerPage = {};
        data.registerPage[key] = val;
        if (CMS.paintRegister) CMS.paintRegister();
        markDirty();
    }

    function buildRegister() {
        var wrap = $('#regGroups');
        if (!wrap) return;
        wrap.innerHTML = '';

        /* ---- General ---- */
        var gen = document.createElement('div');
        gen.className = 'reg-sub';
        gen.innerHTML = '<h3>General</h3>';

        var toggle = document.createElement('label');
        toggle.className = 'reg-toggle';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = regGet('enabled') !== false;
        cb.addEventListener('change', function () { regSet('enabled', cb.checked); });
        toggle.appendChild(cb);
        toggle.appendChild(document.createTextNode(' Registration page enabled'));
        gen.appendChild(toggle);

        var hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = 'When off, visitors see a "registration closed" notice instead of the form. ' +
                           'The logo comes from Images \u2192 Register logo.';
        gen.appendChild(hint);
        wrap.appendChild(gen);

        /* ---- WhatsApp + text ---- */
        var txt = null;   /* text fields now live in the Register page card above */
        /* ---- Appearance ---- */
        var app = document.createElement('div');
        app.className = 'reg-sub';
        app.innerHTML = '<h3>Colours &amp; radius</h3>';
        var agrid = document.createElement('div');
        agrid.className = 'typo-grid';

        REG_APPEARANCE.forEach(function (f) {
            var row = document.createElement('label');
            row.className = 'typo-field';
            row.innerHTML = '<span>' + esc(f[1]) + '</span>';
            var inp = document.createElement('input');
            inp.type = (f[2] === 'color') ? 'color' : 'text';
            var v = regGet(f[0]);
            if (f[2] === 'color' && !/^#[0-9a-f]{6}$/i.test(v)) v = '#3880bd';
            inp.value = v;
            inp.addEventListener('input',  function () { regSet(f[0], inp.value); });
            inp.addEventListener('change', function () { regSet(f[0], inp.value); });
            row.appendChild(inp);
            agrid.appendChild(row);
        });
        app.appendChild(agrid);

        var reset = document.createElement('button');
        reset.className = 'adm-btn';
        reset.type = 'button';
        reset.textContent = 'Reset appearance to defaults';
        reset.addEventListener('click', function () {
            var d = CMS.data();
            d.registerPage = { enabled: regGet('enabled') !== false };
            if (CMS.paintRegister) CMS.paintRegister();
            markDirty();
            buildRegister();
        });
        app.appendChild(reset);
        wrap.appendChild(app);
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
       MEDIA LIBRARY  (uploaded CMS media)
       --------------------------------------------------------
       The Image manager above replaces a FIXED SLOT -- the logo, the
       favicon -- and keeps the picture in the record as a data URL. That
       is right for a handful of brand images and wrong for content: a
       data URL cannot be crawled, cannot be cached, and eats the 5 MB
       the whole brand has to fit in.

       This is the other thing: an open-ended library of pictures that
       live in the site's own storage bucket, addressed by a real URL,
       usable in any Page Builder image field. Everything about what may
       be uploaded is decided in js/admin-media.js; this is only the
       screen.
    ======================================================== */
    var MEDIA_PAGE = 24;
    var mediaShown = MEDIA_PAGE;
    var mediaBusy = false;

    function mediaFmtBytes(n) {
        if (!n) return '';
        return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB'
                           : (Math.round(n / 1048576 * 10) / 10) + ' MB';
    }

    function mediaStatus(msg, kind) {
        var host = $('#mediaStatus');
        if (!host) return;
        if (!msg) { host.innerHTML = ''; return; }
        host.innerHTML = '<span class="chk-' + (kind || 'ok') + '">' + msg + '</span>';
    }

    function buildMedia() {
        var grid = $('#mediaGrid');
        if (!grid || !window.CMSMedia) return;

        var on = window.CMSMedia.enabled();
        var off = $('#mediaOffHint');
        if (off) off.hidden = on;
        var upBtn = $('#mediaUploadBtn');
        if (upBtn) upBtn.disabled = !on || mediaBusy;
        var limits = $('#mediaLimits');
        if (limits) {
            limits.textContent = 'PNG, JPEG, WebP or GIF · up to ' +
                (Math.round(window.CMSMedia.maxBytes() / 1048576 * 10) / 10) + ' MB each';
        }

        var all = window.CMSMedia.list();
        var q = String(($('#mediaSearch') || {}).value || '').trim().toLowerCase();
        var items = q ? all.filter(function (m) {
            return (m.name + ' ' + m.key).toLowerCase().indexOf(q) > -1;
        }) : all;

        $('#mediaCount').textContent = String(all.length);
        grid.innerHTML = '';

        if (!items.length) {
            grid.innerHTML = '<p class="pb-asset-empty">' +
                (all.length ? 'No image matches that search.'
                            : 'Nothing uploaded yet. Press <strong>Upload image</strong> to add one.') +
                '</p>';
            $('#mediaPager').hidden = true;
            return;
        }

        /* Only what is on screen is built, and every thumbnail is lazy and
           carries its real dimensions -- so a library of hundreds does not
           make this panel slow, and nothing reflows as pictures arrive. */
        items.slice(0, mediaShown).forEach(function (m) {
            grid.appendChild(mediaCard(m));
        });
        var pager = $('#mediaPager');
        pager.hidden = items.length <= mediaShown;
        $('#mediaMore').textContent = 'Show more (' + (items.length - mediaShown) + ' left)';
    }

    function mediaCard(m) {
        var card = document.createElement('div');
        card.className = 'mediacard';
        card.setAttribute('data-media', m.url);

        var thumb = document.createElement('div');
        thumb.className = 'mediacard-thumb';
        var img = document.createElement('img');
        img.src = m.url;
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        if (m.w && m.h) { img.width = m.w; img.height = m.h; }
        thumb.appendChild(img);
        card.appendChild(thumb);

        var name = document.createElement('div');
        name.className = 'mediacard-name';
        name.textContent = m.name;
        name.title = m.name;
        card.appendChild(name);

        var meta = document.createElement('div');
        meta.className = 'mediacard-meta';
        meta.textContent = (m.w ? m.w + '×' + m.h : 'size unknown') +
                           (m.bytes ? ' · ' + mediaFmtBytes(m.bytes) : '');
        card.appendChild(meta);

        var altWrap = document.createElement('label');
        altWrap.className = 'mediacard-alt';
        altWrap.innerHTML = '<span>Alt text</span>';
        var alt = document.createElement('input');
        alt.type = 'text';
        alt.value = m.alt || '';
        alt.placeholder = 'What is in this picture?';
        alt.addEventListener('input', function () {
            window.CMSMedia.setAlt(m.url, alt.value);
            markDirty();
        });
        altWrap.appendChild(alt);
        card.appendChild(altWrap);

        var row = document.createElement('div');
        row.className = 'row';
        var del = document.createElement('button');
        del.className = 'adm-btn ghost';
        del.setAttribute('data-act', 'media-delete');
        del.innerHTML = '<i class="fas fa-trash"></i> Delete';
        del.addEventListener('click', function () { mediaDelete(m, del); });
        row.appendChild(del);
        card.appendChild(row);

        return card;
    }

    function mediaDelete(m, btn) {
        if (!confirm('Delete "' + m.name + '"? Any page still using it will show a broken image.')) return;
        btn.disabled = true;
        mediaStatus('Deleting ' + esc(m.name) + '…', 'warn');
        window.CMSMedia.remove(m.url).then(function () {
            mediaStatus('Deleted ' + esc(m.name) + '.', 'ok');
            buildMedia();
            commit();
        }).catch(function (err) {
            btn.disabled = false;
            mediaStatus('Could not delete ' + esc(m.name) + ': ' + esc(err.message), 'bad');
        });
    }

    /* One file at a time on purpose: a browser will happily open six
       sockets, and a half-finished batch with no way to say which file
       failed is not a better experience than a slower honest one. */
    function mediaUpload(files) {
        if (!files || !files.length || mediaBusy) return;
        mediaBusy = true;
        buildMedia();

        var queue = Array.prototype.slice.call(files, 0, 20);
        var okCount = 0, problems = [];

        function next() {
            if (!queue.length) return Promise.resolve();
            var f = queue.shift();
            return window.CMSMedia.upload(f, function (phase, name) {
                mediaStatus(
                    (phase === 'checking' ? 'Checking ' : phase === 'uploading' ? 'Uploading ' : 'Uploaded ') +
                    esc(name || '') + '… (' + (okCount + problems.length + 1) + ' of ' +
                    (okCount + problems.length + 1 + queue.length) + ')',
                    'warn');
            }).then(function () {
                okCount += 1;
                buildMedia();
            }).catch(function (err) {
                problems.push(esc(f.name || 'file') + ' — ' + esc(err.message));
            }).then(next);
        }

        next().then(function () {
            mediaBusy = false;
            buildMedia();
            if (okCount) {
                /* The bytes are already in the bucket; the library row is in
                   the record and has to be published or the next device --
                   and the next reload on a different machine -- will not
                   know the picture exists. */
                commit();
            }
            if (!problems.length) {
                mediaStatus('Uploaded ' + okCount + ' image' + (okCount === 1 ? '' : 's') + '.', 'ok');
            } else {
                mediaStatus((okCount ? 'Uploaded ' + okCount + '. ' : '') +
                    problems.length + ' refused:<ul><li>' + problems.join('</li><li>') + '</li></ul>',
                    okCount ? 'warn' : 'bad');
            }
        });
    }

    (function wireMedia() {
        var file = $('#mediaFile');
        if (!file) return;
        $('#mediaUploadBtn').addEventListener('click', function () { file.click(); });
        file.addEventListener('change', function () {
            mediaUpload(file.files);
            file.value = '';
        });
        $('#mediaSearch').addEventListener('input', function () {
            mediaShown = MEDIA_PAGE;
            buildMedia();
        });
        $('#mediaMore').addEventListener('click', function () {
            mediaShown += MEDIA_PAGE;
            buildMedia();
        });
    })();

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
       GLOBAL FOOTER — navigation columns

       Two levels, columns -> links, built on the same drag/enable/delete
       pattern as the Home lists above. The Brand and Support columns are
       not here on purpose: they are not link lists, they carry the logo,
       social icons and the id-bound WhatsApp link, and they stay put.

       The description and copyright inputs point at text['footer.about']
       and text['footer.copyright'] -- the same values the Texts panel
       edits. Two views of one value, not a copy.
    ======================================================== */

    var FT_LIMITS = (CMS.footer && CMS.footer.limits) ||
                    { columns: 6, links: 12, title: 40, label: 60 };

    function ftId(prefix) {
        return prefix + '-' + Date.now().toString(36) +
               Math.random().toString(36).slice(2, 6);
    }

    /* The live footer object, repaired in place if it is missing or the
       wrong shape. The admin has to have something to edit even when the
       saved config is nonsense; the PUBLIC renderer takes the opposite
       view and shows the static fallback instead. */
    function ftData() {
        var st = CMS.data();
        if (!st.footer || typeof st.footer !== 'object' || Array.isArray(st.footer)) {
            st.footer = { version: 1, columns: [] };
        }
        if (!Array.isArray(st.footer.columns)) st.footer.columns = [];
        return st.footer;
    }

    function ftBlankColumn() {
        return { id: ftId('col'), title: 'New column', enabled: true,
                 links: [ftBlankLink()] };
    }

    function ftBlankLink() {
        return { id: ftId('lnk'), label: 'New link', href: './', enabled: true };
    }

    /* Every page the CMS knows about, for the picker. Reads the same
       pages map the SEO panel uses, so a new page appears here with no
       extra wiring. */
    function ftPageOptions() {
        var pages = CMS.data().pages || {};
        var out = [{ href: './', label: 'Home (site root)' }];
        Object.keys(pages).forEach(function (k) {
            if (k === 'home') return;
            var p = pages[k];
            if (!p || !p.url) return;
            out.push({ href: p.url, label: (p.label || k) + '  (' + p.url + ')' });
        });
        /* The account pages are real files but are not in the pages map,
           because they carry no SEO record. They are still linkable. */
        out.push({ href: 'login.html', label: 'Login  (login.html)' });
        out.push({ href: 'register.html', label: 'Register  (register.html)' });
        return out;
    }

    /* Live validation, using the public renderer's own rule so the panel
       cannot say yes to something the page will then drop. */
    function ftHrefState(v) {
        var raw = String(v == null ? '' : v).trim();
        if (!raw) return { ok: false, msg: 'A link needs a URL.' };
        var safe = CMS.footer && CMS.footer.href ? CMS.footer.href(raw) : raw;
        if (!safe) {
            return { ok: false, msg: 'Not a usable link. Use a page on this site, ' +
                                    'or a full https:// address.' };
        }
        if (/^https?:\/\//i.test(safe)) {
            return { ok: true, external: true, msg: 'External link — opens with rel="noopener".' };
        }
        if (/^(mailto|tel):/i.test(safe)) {
            return { ok: true, external: true, msg: 'Contact link.' };
        }
        return { ok: true, external: false, msg: '' };
    }

    function ftPaintHrefState(row, input) {
        var st = ftHrefState(input.value);
        var note = row.querySelector('.ft-url-note');
        input.classList.toggle('bad', !st.ok);
        if (note) {
            note.textContent = st.ok ? (st.msg || '') : st.msg;
            note.className = 'ft-url-note' + (st.ok ? '' : ' bad');
        }
    }

    var ftDragCol = null, ftDragLink = null;

    function buildFooter() {
        var host = $('#footerCols');
        if (!host) return;
        var data = ftData();
        var cols = data.columns;

        $('#cntFooterCols').textContent = cols.length;
        $('#ftMaxCols').textContent = FT_LIMITS.columns;
        $('#ftMaxLinks').textContent = FT_LIMITS.links;

        host.innerHTML = '';

        cols.forEach(function (col, ci) {
            if (!col || typeof col !== 'object') return;
            if (!Array.isArray(col.links)) col.links = [];

            var box = document.createElement('div');
            box.className = 'ft-col';
            box.setAttribute('data-ci', ci);

            /* ---- column header ---- */
            var head = document.createElement('div');
            head.className = 'ft-col-head item';
            head.draggable = true;
            head.innerHTML =
                '<span class="handle" title="Drag to reorder this column">' +
                '<i class="fas fa-grip-vertical"></i></span>' +
                '<div class="fields">' +
                '<input type="text" class="ft-title" maxlength="' + FT_LIMITS.title + '" ' +
                'value="' + esc(col.title || '') + '" placeholder="Column title">' +
                '</div>' +
                '<div class="tools">' +
                '<input type="checkbox" class="ft-on" title="Show this column"' +
                (col.enabled !== false ? ' checked' : '') + '>' +
                '<button type="button" class="icon-btn del" title="Delete column">' +
                '<i class="fas fa-trash"></i></button>' +
                '</div>';

            head.querySelector('.ft-title').addEventListener('input', function () {
                col.title = this.value.slice(0, FT_LIMITS.title);
                markDirty();
            });
            head.querySelector('.ft-on').addEventListener('change', function () {
                col.enabled = this.checked;
                box.classList.toggle('off', !this.checked);
                markDirty();
            });
            head.querySelector('.del').addEventListener('click', function () {
                if (!confirm('Delete the "' + (col.title || 'untitled') + '" column and its links?')) return;
                cols.splice(ci, 1);
                buildFooter();
                markDirty();
            });

            /* column reorder */
            head.addEventListener('dragstart', function (e) {
                ftDragCol = box;
                box.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', String(ci)); } catch (err) {}
            });
            head.addEventListener('dragend', function () {
                box.classList.remove('dragging');
                $$('.ft-col').forEach(function (n) { n.classList.remove('drag-over'); });
            });
            box.addEventListener('dragover', function (e) {
                if (!ftDragCol || ftDragCol === box) return;
                e.preventDefault();
                box.classList.add('drag-over');
            });
            box.addEventListener('dragleave', function () { box.classList.remove('drag-over'); });
            box.addEventListener('drop', function (e) {
                if (!ftDragCol || ftDragCol === box) return;
                e.preventDefault();
                e.stopPropagation();
                var from = Number(ftDragCol.getAttribute('data-ci'));
                var to = Number(box.getAttribute('data-ci'));
                var moved = cols.splice(from, 1)[0];
                cols.splice(to, 0, moved);
                ftDragCol = null;
                buildFooter();
                markDirty();
            });

            if (col.enabled === false) box.classList.add('off');
            box.appendChild(head);

            /* ---- links ---- */
            var list = document.createElement('div');
            list.className = 'ft-links list';

            col.links.forEach(function (link, li) {
                if (!link || typeof link !== 'object') return;
                var row = document.createElement('div');
                row.className = 'item ft-link';
                row.draggable = true;
                row.setAttribute('data-li', li);

                var opts = ftPageOptions().map(function (o) {
                    return '<option value="' + esc(o.href) + '">' + esc(o.label) + '</option>';
                }).join('');

                row.innerHTML =
                    '<span class="handle" title="Drag to reorder this link">' +
                    '<i class="fas fa-grip-vertical"></i></span>' +
                    '<div class="fields">' +
                    '<input type="text" class="ft-label" maxlength="' + FT_LIMITS.label + '" ' +
                    'value="' + esc(link.label || '') + '" placeholder="Link text">' +
                    '<input type="text" class="ft-url" value="' + esc(link.href || '') + '" ' +
                    'placeholder="Page or https:// address">' +
                    '<select class="ft-pick">' +
                    '<option value="">Pick a page…</option>' + opts +
                    '<option value="__custom">Custom URL…</option>' +
                    '</select>' +
                    '<div class="ft-url-note"></div>' +
                    '</div>' +
                    '<div class="tools">' +
                    '<input type="checkbox" class="ft-on" title="Show this link"' +
                    (link.enabled !== false ? ' checked' : '') + '>' +
                    '<button type="button" class="icon-btn del" title="Delete link">' +
                    '<i class="fas fa-trash"></i></button>' +
                    '</div>';

                var urlIn = row.querySelector('.ft-url');
                var pick = row.querySelector('.ft-pick');

                row.querySelector('.ft-label').addEventListener('input', function () {
                    link.label = this.value.slice(0, FT_LIMITS.label);
                    markDirty();
                });
                urlIn.addEventListener('input', function () {
                    link.href = this.value;
                    ftPaintHrefState(row, urlIn);
                    markDirty();
                });
                pick.addEventListener('change', function () {
                    var v = this.value;
                    this.value = '';
                    if (!v) return;
                    if (v === '__custom') { urlIn.focus(); urlIn.select(); return; }
                    urlIn.value = v;
                    link.href = v;
                    ftPaintHrefState(row, urlIn);
                    markDirty();
                });
                row.querySelector('.ft-on').addEventListener('change', function () {
                    link.enabled = this.checked;
                    row.classList.toggle('off', !this.checked);
                    markDirty();
                });
                row.querySelector('.del').addEventListener('click', function () {
                    col.links.splice(li, 1);
                    buildFooter();
                    markDirty();
                });

                /* link reorder, within this column only */
                row.addEventListener('dragstart', function (e) {
                    ftDragLink = row;
                    row.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'move';
                    e.stopPropagation();
                    try { e.dataTransfer.setData('text/plain', String(li)); } catch (err) {}
                });
                row.addEventListener('dragend', function () {
                    row.classList.remove('dragging');
                    $$('.ft-link').forEach(function (n) { n.classList.remove('drag-over'); });
                });
                row.addEventListener('dragover', function (e) {
                    if (!ftDragLink || ftDragLink === row) return;
                    if (ftDragLink.parentNode !== row.parentNode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    row.classList.add('drag-over');
                });
                row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
                row.addEventListener('drop', function (e) {
                    if (!ftDragLink || ftDragLink === row) return;
                    if (ftDragLink.parentNode !== row.parentNode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    var from = Number(ftDragLink.getAttribute('data-li'));
                    var to = Number(row.getAttribute('data-li'));
                    var moved = col.links.splice(from, 1)[0];
                    col.links.splice(to, 0, moved);
                    ftDragLink = null;
                    buildFooter();
                    markDirty();
                });

                if (link.enabled === false) row.classList.add('off');
                list.appendChild(row);
                ftPaintHrefState(row, urlIn);
            });

            box.appendChild(list);

            var add = document.createElement('button');
            add.type = 'button';
            add.className = 'adm-btn ghost ft-add-link';
            add.innerHTML = '<i class="fas fa-plus"></i> Add link';
            add.disabled = col.links.length >= FT_LIMITS.links;
            if (add.disabled) add.title = 'At most ' + FT_LIMITS.links + ' links in a column.';
            add.addEventListener('click', function () {
                if (col.links.length >= FT_LIMITS.links) {
                    toast('A column holds at most ' + FT_LIMITS.links + ' links.', true);
                    return;
                }
                col.links.push(ftBlankLink());
                buildFooter();
                markDirty();
            });
            box.appendChild(add);

            host.appendChild(box);
        });

        var addCol = $('#btnAddFooterCol');
        if (addCol) {
            addCol.disabled = cols.length >= FT_LIMITS.columns;
            addCol.title = addCol.disabled
                ? 'At most ' + FT_LIMITS.columns + ' navigation columns.' : '';
        }

        /* The two shared text values. */
        var ab = $('#ftAbout'), cp = $('#ftCopyright');
        if (ab) ab.value = CMS.data().text['footer.about'] || '';
        if (cp) cp.value = CMS.data().text['footer.copyright'] || '';

        ftPaintFallbackNote();
    }

    /* Says, in the panel, exactly what the public page will do with what
       is currently entered -- including the case where it will ignore it
       and keep the shipped footer. */
    function ftPaintFallbackNote() {
        var note = $('#footerFallbackNote');
        if (!note) return;
        var clean = CMS.footer && CMS.footer.clean
            ? CMS.footer.clean(CMS.data().footer) : null;
        if (!clean) {
            note.textContent = 'Right now nothing above is usable, so every page ' +
                               'will show the footer written into its HTML.';
            note.className = 'hint warn';
            return;
        }
        var links = clean.reduce(function (n, c) { return n + c.links.length; }, 0);
        note.textContent = 'Right now pages will show ' + clean.length +
                           (clean.length === 1 ? ' column' : ' columns') + ' and ' +
                           links + (links === 1 ? ' link' : ' links') +
                           ' from here, between the Brand and Support columns.';
        note.className = 'hint';
    }

    (function wireFooterPanel() {
        var add = $('#btnAddFooterCol');
        if (add) add.addEventListener('click', function () {
            var cols = ftData().columns;
            if (cols.length >= FT_LIMITS.columns) {
                toast('At most ' + FT_LIMITS.columns + ' navigation columns.', true);
                return;
            }
            cols.push(ftBlankColumn());
            buildFooter();
            markDirty();
        });

        var ab = $('#ftAbout');
        if (ab) ab.addEventListener('input', function () {
            CMS.data().text['footer.about'] = this.value;
            buildText();          /* keep the Texts panel showing the same value */
            markDirty();
        });

        var cp = $('#ftCopyright');
        if (cp) cp.addEventListener('input', function () {
            CMS.data().text['footer.copyright'] = this.value;
            buildText();
            markDirty();
        });
    })();

    /* ========================================================
       INFO PAGES  (About / Contact / Responsible Gaming)
       Reads and writes CMS.data().pages, so Save changes
       publishes them through the same Supabase path as the
       rest of the config. Adding a fourth page means adding
       one entry to DEFAULTS.pages in ../js/cms.js — this
       panel builds itself from whatever is there.
    ======================================================== */

    var PAGE_FIELDS = [
        {
            key: 'title', label: 'Page title (SEO)', kind: 'input',
            hint: 'The browser tab and Google result title. Around 60 characters.',
            counter: 60
        },
        {
            key: 'metaDescription', label: 'Meta description (SEO)', kind: 'area', rows: 3,
            hint: 'The grey summary under the title in search results. Around 155 characters.',
            counter: 155
        },
        {
            key: 'heading', label: 'H1 heading', kind: 'input',
            hint: 'The one main heading of the page.'
        },
        {
            key: 'lead', label: 'Intro / lead text', kind: 'input',
            hint: 'One sentence under the H1.'
        }
    ];

    /* Markup the toolbar drops in at the cursor */
    var PAGE_SNIPPETS = [
        ['H2', '<h2>Section heading</h2>'],
        ['H3', '<h3>Sub heading</h3>'],
        ['Paragraph', '<p>Write your paragraph here.</p>'],
        ['List', '<ul>\n  <li>First point</li>\n  <li>Second point</li>\n</ul>'],
        ['Numbered list', '<ol>\n  <li>First step</li>\n  <li>Second step</li>\n</ol>'],
        ['Link', '<a href="contact.html">link text</a>'],
        ['Table', '<table>\n  <tr><th>Heading</th><th>Heading</th></tr>\n  <tr><td>Cell</td><td>Cell</td></tr>\n</table>'],
        ['Placeholder note', '<p class="page-note">Editable placeholder — replace this with real information.</p>']
    ];

    var activePageKey = null;

    function pageKeys() {
        var pages = CMS.data().pages;
        return pages ? Object.keys(pages) : [];
    }

    function buildPages() {
        var tabs = $('#pageTabs'), host = $('#pageEditor');
        if (!tabs || !host) return;

        var keys = pageKeys();
        if (!keys.length) {
            tabs.innerHTML = '';
            host.innerHTML = '<div class="card"><p class="hint">No pages are defined in the CMS.</p></div>';
            return;
        }
        if (keys.indexOf(activePageKey) === -1) activePageKey = keys[0];

        tabs.innerHTML = '';
        keys.forEach(function (k) {
            var page = CMS.data().pages[k];
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pagetab' + (k === activePageKey ? ' active' : '');
            b.setAttribute('data-page-key', k);
            if (k === activePageKey) b.setAttribute('aria-current', 'page');
            b.textContent = page.label || k;
            b.addEventListener('click', function () {
                activePageKey = k;
                buildPages();
            });
            tabs.appendChild(b);
        });

        renderPageEditor();
    }

    function renderPageEditor() {
        var host = $('#pageEditor');
        var key = activePageKey;
        var page = CMS.data().pages[key];
        host.innerHTML = '';

        /* ---- SEO + headings ---- */
        var head = document.createElement('div');
        head.className = 'card';
        head.innerHTML = '<h2>' + esc(page.label || key) + ' <span class="pill">' +
            esc(page.url || '') + '</span></h2>';

        if (page.url) {
            var open = document.createElement('a');
            open.className = 'adm-btn ghost pageopen';
            open.href = '../' + page.url;
            open.target = '_blank';
            open.rel = 'noopener';
            open.innerHTML = '<i class="fas fa-arrow-up-right-from-square"></i> Open page';
            head.appendChild(open);
        }

        var grid = document.createElement('div');
        grid.className = 'grid2';
        PAGE_FIELDS.forEach(function (f) { grid.appendChild(pageField(page, f)); });
        head.appendChild(grid);
        host.appendChild(head);

        /* ---- body HTML ---- */
        var bodyCard = document.createElement('div');
        bodyCard.className = 'card';
        bodyCard.innerHTML =
            '<h2>Main content</h2>' +
            '<p class="hint">Plain HTML. Use the buttons to drop in a heading, paragraph, ' +
            'list, link or table at the cursor. There is no length limit — this is where the ' +
            'long-form content for this page lives.</p>';

        var bar = document.createElement('div');
        bar.className = 'snipbar';
        bodyCard.appendChild(bar);

        var area = document.createElement('textarea');
        area.className = 'codearea';
        area.rows = 22;
        area.spellcheck = false;
        area.value = page.body || '';
        bodyCard.appendChild(area);

        var previewLabel = document.createElement('p');
        previewLabel.className = 'hint';
        previewLabel.textContent = 'Preview';
        bodyCard.appendChild(previewLabel);

        var preview = document.createElement('div');
        preview.className = 'pagepreview';
        bodyCard.appendChild(preview);
        host.appendChild(bodyCard);

        function paintPreview() {
            preview.innerHTML =
                '<h1>' + esc(page.heading || '') + '</h1>' +
                '<p class="info-lead">' + esc(page.lead || '') + '</p>' +
                (page.body || '');
            /* keep preview links inert */
            $$('a', preview).forEach(function (a) {
                a.addEventListener('click', function (e) { e.preventDefault(); });
            });
        }

        area.addEventListener('input', function () {
            page.body = area.value;
            touchPage(page);
            paintPreview();
        });

        PAGE_SNIPPETS.forEach(function (s) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'adm-btn ghost snip';
            b.textContent = s[0];
            b.addEventListener('click', function () { insertSnippet(area, s[1]); });
            bar.appendChild(b);
        });

        function insertSnippet(el, text) {
            var start = el.selectionStart, end = el.selectionEnd, val = el.value;
            var before = val.slice(0, start);
            var pad = (before && !/\n$/.test(before)) ? '\n' : '';
            var insert = pad + text + '\n';
            el.value = before + insert + val.slice(end);
            var caret = start + insert.length;
            el.focus();
            el.setSelectionRange(caret, caret);
            page.body = el.value;
            touchPage(page);
            paintPreview();
        }

        /* the editor repaints the live preview of the page it describes */
        paintPreview();

        /* ---- search engine settings ---- */
        var seoCard = document.createElement('div');
        seoCard.className = 'card';
        seoCard.innerHTML = '<h2>Search engines</h2>' +
            '<p class="hint">Leave a field blank to keep whatever the page\'s HTML already ' +
            'contains. Nothing here can blank a page out.</p>';
        var seoGrid = document.createElement('div');
        seoGrid.className = 'grid2';

        seoGrid.appendChild(seoField(
            function () { return page.canonical || ''; },
            function (v) { page.canonical = v; touchPage(page); },
            { label: 'Canonical URL override',
              hint: 'Blank = built automatically from the base URL and this page\'s address.',
              onChange: paintSeoPreviews }));

        seoGrid.appendChild(seoToggle(
            function () { return !page.robots || page.robots.index !== false; },
            function (v) { page.robots = page.robots || {}; page.robots.index = v; touchPage(page); renderPageEditor(); },
            'Allow indexing', 'Off = noindex. The page stays reachable but is kept out of search results.'));

        seoGrid.appendChild(seoToggle(
            function () { return !page.robots || page.robots.follow !== false; },
            function (v) { page.robots = page.robots || {}; page.robots.follow = v; touchPage(page); renderPageEditor(); },
            'Follow links', 'Off = nofollow on every link on the page. Rarely wanted.'));

        seoGrid.appendChild(seoToggle(
            function () { return page.inSitemap !== false; },
            function (v) { page.inSitemap = v; touchPage(page); },
            'Include in sitemap', 'A noindex page is excluded automatically whatever this says.'));

        seoCard.appendChild(seoGrid);
        host.appendChild(seoCard);

        /* ---- social ---- */
        var socCard = document.createElement('div');
        socCard.className = 'card';
        socCard.innerHTML = '<h2>Sharing</h2>' +
            '<p class="hint">Blank fields inherit the defaults in <strong>SEO &gt; Social</strong>, ' +
            'and X/Twitter inherits from Open Graph.</p>';
        var socGrid = document.createElement('div');
        socGrid.className = 'grid2';
        page.og = page.og || { title: '', description: '', image: '' };
        page.twitter = page.twitter || { title: '', description: '', image: '' };
        [['og', 'title', 'OG title', 60], ['og', 'description', 'OG description', 155], ['og', 'image', 'OG image URL', 0],
         ['twitter', 'title', 'X title', 60], ['twitter', 'description', 'X description', 155], ['twitter', 'image', 'X image URL', 0]
        ].forEach(function (f) {
            var field = seoField(
                function () { return page[f[0]][f[1]] || ''; },
                function (v) { page[f[0]][f[1]] = v; touchPage(page); },
                { label: f[2], counter: f[3] || 0,
                  kind: f[1] === 'description' ? 'area' : 'input',
                  onChange: paintSeoPreviews });
            if (f[1] === 'image') attachAssetPicker(field, page, f[0]);
            socGrid.appendChild(field);
        });
        socCard.appendChild(socGrid);
        host.appendChild(socCard);

        /* ---- structured data + breadcrumb (not shown for login/register) ---- */
        if (page.url && !/^(login|register)\.html$/.test(page.url)) {
            var scCard = document.createElement('div');
            scCard.className = 'card';
            scCard.innerHTML = '<h2>Structured data &amp; breadcrumb</h2>' +
                '<p class="hint">Breadcrumb markup is only published when the page actually ' +
                'shows a breadcrumb — search engines require the two to match.</p>';
            var scGrid = document.createElement('div');
            scGrid.className = 'grid2';
            page.schema = page.schema || { webPage: true, breadcrumb: false, contactPage: false };
            page.breadcrumb = page.breadcrumb || { label: page.label || '', show: false };

            scGrid.appendChild(seoToggle(
                function () { return page.schema.webPage !== false; },
                function (v) { page.schema.webPage = v; touchPage(page); },
                'WebPage schema', 'Describes this page to search engines.'));
            scGrid.appendChild(seoToggle(
                function () { return !!page.schema.contactPage; },
                function (v) { page.schema.contactPage = v; touchPage(page); },
                'Mark as ContactPage', 'Only for a page that genuinely holds contact details.'));
            scGrid.appendChild(seoToggle(
                function () { return !!page.breadcrumb.show; },
                function (v) { page.breadcrumb.show = v; touchPage(page); },
                'Show breadcrumb', 'Displays "Home › page" above the content.'));
            scGrid.appendChild(seoToggle(
                function () { return !!page.schema.breadcrumb; },
                function (v) { page.schema.breadcrumb = v; touchPage(page); },
                'BreadcrumbList schema', 'Ignored unless the breadcrumb above is shown.'));
            scGrid.appendChild(seoField(
                function () { return page.breadcrumb.label || ''; },
                function (v) { page.breadcrumb.label = v; touchPage(page); },
                { label: 'Breadcrumb label', hint: 'Short — it is the last step of the trail.' }));
            scCard.appendChild(scGrid);
            host.appendChild(scCard);
        }

        /* ---- previews ---- */
        var pvCard = document.createElement('div');
        pvCard.className = 'card';
        pvCard.innerHTML = '<h2>Previews</h2>' +
            '<p class="hint">An impression of how this page may appear. Search engines rewrite ' +
            'titles and snippets whenever they judge something else fits the query better, so ' +
            'treat this as a guide rather than a guarantee.</p>' +
            '<div class="seoprev-wrap">' +
              '<div class="seoprev"><div class="seoprev-label">Google</div><div id="pvGoogle" class="pv-google"></div></div>' +
              '<div class="seoprev"><div class="seoprev-label">Open Graph</div><div id="pvOg" class="pv-card"></div></div>' +
              '<div class="seoprev"><div class="seoprev-label">X / Twitter</div><div id="pvTw" class="pv-card"></div></div>' +
            '</div>';
        host.appendChild(pvCard);

        /* ---- checks ---- */
        var chkCard = document.createElement('div');
        chkCard.className = 'card';
        chkCard.innerHTML = '<h2>Checks</h2>' +
            '<p class="hint">Editorial guidance, not a score — no search engine publishes one.</p>' +
            '<div id="pageChecks"></div>';
        host.appendChild(chkCard);

        paintSeoPreviews();
    }

    /* Stamp the edit date so the sitemap lastmod stays honest. */
    function touchPage(page) {
        page.updatedAt = todayIso();
        markDirty();
        paintSeoPreviews();
    }

    function paintSeoPreviews() {
        var key = activePageKey;
        var page = CMS.data().pages[key];
        if (!page) return;

        var title = CMS.seoTitleFor ? CMS.seoTitleFor(page) : (page.title || '');
        var desc  = CMS.seoDescriptionFor ? CMS.seoDescriptionFor(page) : (page.metaDescription || '');
        var url   = CMS.seoUrlFor ? CMS.seoUrlFor(page) : '';
        var ogT   = CMS.seoOgFor ? CMS.seoOgFor(page, 'title') : title;
        var ogD   = CMS.seoOgFor ? CMS.seoOgFor(page, 'description') : desc;
        /* seoCrawlableImage, not seoAbsUrl: it is the function paintSeo()
           itself uses, so the card shows what the tag will actually carry.
           absUrl() alone would happily show a blob: or data: URL that the
           real og:image refuses to emit. */
        var ogI   = CMS.seoOgFor ? CMS.seoCrawlableImage(CMS.seoOgFor(page, 'image')) : '';
        var twT   = CMS.seoTwitterFor ? CMS.seoTwitterFor(page, 'title') : ogT;
        var twD   = CMS.seoTwitterFor ? CMS.seoTwitterFor(page, 'description') : ogD;
        var twI   = CMS.seoTwitterFor ? CMS.seoCrawlableImage(CMS.seoTwitterFor(page, 'image')) : ogI;
        var crumb = url.replace(/^https?:\/\//, '').replace(/\/$/, '').split('/').join(' › ');

        var g = $('#pvGoogle');
        if (g) {
            g.innerHTML =
                '<div class="pv-url">' + esc(crumb) + '</div>' +
                '<div class="pv-title">' + esc(title || '(no title set)') + '</div>' +
                '<div class="pv-desc">' + esc(desc || '(no description set — Google will pick a snippet from the page)') + '</div>' +
                (page.robots && page.robots.index === false
                    ? '<div class="pv-noindex"><i class="fas fa-eye-slash"></i> This page is set to noindex, so it will not appear at all.</div>' : '');
        }
        /* The share image is the one value here that is not written as text.

           It used to be interpolated into a style="" attribute, and esc()
           does not protect that: the attribute is HTML, so &#39; decodes
           back to a quote BEFORE the CSS parser sees it, and a share image
           of  x'); background-image:url('http://elsewhere/  closed the
           declaration and opened its own. The preview then fetched it.

           Two things stop that now. The URL goes through the renderer's own
           pbCssUrl() -- the same check that guards every url() the builder
           emits, which refuses quotes, parentheses, semicolons and braces
           along with the schemes pbUrl() already refuses. And it is applied
           through the CSSOM rather than as markup, where a value can only
           ever set the one property it is assigned to. */
        function card(host, t, d, img, dom) {
            if (!host) return;
            var safe = (CMS.sections && CMS.sections.safeCssUrl) ? CMS.sections.safeCssUrl(img) : '';
            host.innerHTML =
                '<div class="pv-img' + (safe ? '' : ' pv-img-empty') + '">' +
                    (safe ? '' : 'no share image set') + '</div>' +
                '<div class="pv-body"><div class="pv-dom">' + esc(dom) + '</div>' +
                '<div class="pv-ct">' + esc(t || '(no title)') + '</div>' +
                '<div class="pv-cd">' + esc(d || '') + '</div></div>';
            if (safe) host.querySelector('.pv-img').style.backgroundImage = 'url("' + safe + '")';
        }
        var domain = url.replace(/^https?:\/\//, '').split('/')[0];
        card($('#pvOg'), ogT, ogD, ogI, domain);
        card($('#pvTw'), twT, twD, twI, domain);

        var c = $('#pageChecks');
        if (c) c.innerHTML = checksHtml(validatePage(key));
    }



    /* ----------------------------------------------------------
       CHOOSING AN OG / X IMAGE FROM THE SITE'S OWN FILES
       (milestone E)

       The field is unchanged -- it is still pages.<slug>.og.image, still
       free text, still allowed to hold an absolute URL someone types in.
       All this adds is a way to pick one of the images that is actually
       in the repository, and it does it by opening THE PAGE BUILDER'S
       picker: same manifest, same pbAsset() rules, same modal. A second
       picker here would be a second place to keep honest.

       What lands in the field is a plain relative path. The SEO engine
       already turns that into an absolute URL against seo.baseUrl, and
       already refuses data: and blob: for a crawler. Nothing about that
       changes.
    ---------------------------------------------------------- */
    function attachAssetPicker(field, page, which) {
        if (!Builder || typeof Builder.pickAsset !== 'function') return;
        var input = field.querySelector('input');
        if (!input) return;
        var bar = document.createElement('div');
        bar.className = 'seo-pickbar';
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'adm-btn ghost';
        b.setAttribute('data-act', which + '-pick');
        b.innerHTML = '<i class="fas fa-image"></i> Choose an image';
        b.addEventListener('click', function () {
            /* The picker hands back the manifest entry, not a string -- the
               same shape the builder's own image field receives. Its path
               goes back through CMS.sections.assetPath() before it is
               stored, so what lands in the field is provably one of ours
               rather than whatever the callback happened to carry. */
            Builder.pickAsset(input.value, function (asset) {
                /* Either kind of image is right for a share card, and an
                   uploaded one is the better answer: a share image has to be
                   a URL Facebook and X can fetch, which is exactly what an
                   upload gives you and exactly what the data URLs in the
                   Image manager never could. Still validated, just against
                   both doors rather than one. */
                var path = CMS.sections.imageRef((asset && asset.path) || '');
                if (!path) return;
                input.value = path;
                page[which].image = path;
                touchPage(page);
                paintSeoPreviews();
            });
        });
        bar.appendChild(b);
        var note = document.createElement('small');
        note.className = 'hint';
        note.textContent = 'Or paste any full https:// address. A data: or blob: URL is never written to the tag.';
        bar.appendChild(note);
        field.appendChild(bar);
    }

    function pageField(page, def) {
        var wrap = document.createElement('label');
        wrap.className = 'f';
        var input = document.createElement(def.kind === 'area' ? 'textarea' : 'input');
        if (def.kind === 'area') input.rows = def.rows || 3;
        else input.type = 'text';
        input.value = page[def.key] == null ? '' : page[def.key];

        var span = document.createElement('span');
        span.innerHTML = esc(def.label) +
            (def.hint ? '<br><small style="opacity:.6">' + esc(def.hint) + '</small>' : '');
        wrap.appendChild(span);
        wrap.appendChild(input);

        var count = null;
        if (def.counter) {
            count = document.createElement('small');
            count.className = 'charcount';
            wrap.appendChild(count);
        }

        function paintCount() {
            if (!count) return;
            var n = input.value.length;
            count.textContent = n + ' / ~' + def.counter + ' characters';
            count.classList.toggle('over', n > def.counter);
        }

        /* The builder renders BELOW this heading, so a section heading set
           to h1 puts a second one on the page. The count comes from the
           renderer's own reader, and it describes what is PUBLISHED --
           a draft is not on the page yet, so it is not counted here. */
        if (def.key === 'heading') {
            var live = CMS.sections.live(activePageKey);
            var extra = live ? CMS.sections.outline(live).counts.h1 : 0;
            if (extra) {
                var w = document.createElement('small');
                w.className = 'pagewarn';
                w.setAttribute('data-warn', 'h1');
                w.textContent = extra === 1
                    ? 'The published Page Builder content for this page also has one H1, ' +
                      'so the page shows two. Change it in Page Builder \u203a Headings.'
                    : 'The published Page Builder content for this page has ' + extra +
                      ' more H1s, so the page shows ' + (extra + 1) +
                      '. Change them in Page Builder \u203a Headings.';
                wrap.appendChild(w);
            }
        }

        input.addEventListener('input', function () {
            page[def.key] = input.value;
            touchPage(page);
            paintCount();
            if (def.key === 'heading' || def.key === 'lead') {
                var pv = $('.pagepreview');
                if (pv) {
                    var h1 = pv.querySelector('h1'), lead = pv.querySelector('.info-lead');
                    if (h1 && def.key === 'heading') h1.textContent = input.value;
                    if (lead && def.key === 'lead') lead.textContent = input.value;
                }
            }
        });
        paintCount();
        return wrap;
    }


    /* ========================================================
       SEO CONTROL CENTER
       ------------------------------------------------------
       Reads and writes CMS.data().seo and CMS.data().pages, so
       everything here publishes through the same Save changes ->
       Supabase path as the rest of the admin. Nothing below adds
       storage of its own.
    ======================================================== */

    function sstr(v) { return v == null ? '' : String(v).trim(); }

    /* ---------- generic bound field ---------- */
    function seoField(get, set, def) {
        var wrap = document.createElement('label');
        wrap.className = 'f';
        var el;
        if (def.kind === 'select') {
            el = document.createElement('select');
            def.options.forEach(function (o) {
                var op = document.createElement('option');
                op.value = o[0]; op.textContent = o[1];
                el.appendChild(op);
            });
        } else if (def.kind === 'area') {
            el = document.createElement('textarea');
            el.rows = def.rows || 3;
        } else {
            el = document.createElement('input');
            el.type = 'text';
        }
        el.value = get() == null ? '' : get();

        var span = document.createElement('span');
        span.innerHTML = esc(def.label) +
            (def.hint ? '<br><small style="opacity:.6">' + def.hint + '</small>' : '');
        wrap.appendChild(span);
        wrap.appendChild(el);

        var count = null;
        if (def.counter) { count = document.createElement('small'); count.className = 'charcount'; wrap.appendChild(count); }
        function paintCount() {
            if (!count) return;
            var n = el.value.length;
            count.textContent = n + ' / ~' + def.counter + ' characters';
            count.classList.toggle('over', n > def.counter);
        }
        el.addEventListener('input', function () {
            set(el.value);
            markDirty();
            paintCount();
            if (def.onChange) def.onChange();
        });
        el.addEventListener('change', function () { if (def.onChange) def.onChange(); });
        paintCount();
        return wrap;
    }

    function seoToggle(get, set, label, hint) {
        var wrap = document.createElement('label');
        wrap.className = 'f switch';
        wrap.innerHTML = '<span>' + esc(label) +
            (hint ? '<br><small style="opacity:.6">' + esc(hint) + '</small>' : '') + '</span>';
        var box = document.createElement('input');
        box.type = 'checkbox';
        box.checked = !!get();
        box.addEventListener('change', function () { set(box.checked); markDirty(); buildSeo(); });
        wrap.appendChild(box);
        return wrap;
    }

    function seoGet(path, fallback) {
        var parts = path.split('.'), cur = CMS.data(), i;
        for (i = 0; i < parts.length; i++) { if (cur == null) return fallback; cur = cur[parts[i]]; }
        return cur == null ? fallback : cur;
    }
    function seoSet(path, val) {
        var parts = path.split('.'), cur = CMS.data(), i;
        for (i = 0; i < parts.length - 1; i++) {
            if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = val;
    }
    function bound(path, def) {
        return seoField(function () { return seoGet(path, ''); },
                        function (v) { seoSet(path, v); }, def);
    }

    /* ---------- tabs ---------- */
    var SEO_TABS = [
        ['dashboard', 'Dashboard'],
        ['global',    'Global SEO'],
        ['social',    'Social / Sharing'],
        ['schema',    'Structured Data'],
        ['sitemap',   'Sitemap'],
        ['robots',    'Robots.txt'],
        ['newpage',   'Create Page']
    ];
    var activeSeoTab = 'dashboard';

    function buildSeo() {
        var tabs = $('#seoTabs');
        if (!tabs) return;
        tabs.innerHTML = '';
        SEO_TABS.forEach(function (t) {
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'pagetab' + (t[0] === activeSeoTab ? ' active' : '');
            b.setAttribute('data-seotab', t[0]);
            if (t[0] === activeSeoTab) b.setAttribute('aria-current', 'true');
            b.textContent = t[1];
            b.addEventListener('click', function () { activeSeoTab = t[0]; buildSeo(); });
            tabs.appendChild(b);
            var pane = $('#seotab-' + t[0]);
            if (pane) pane.hidden = (t[0] !== activeSeoTab);
        });

        if (activeSeoTab === 'dashboard') buildSeoDashboard();
        if (activeSeoTab === 'global')    buildSeoGlobal();
        if (activeSeoTab === 'social')    buildSeoSocial();
        if (activeSeoTab === 'schema')    buildSeoSchema();
        if (activeSeoTab === 'sitemap')   buildSeoSitemap();
        if (activeSeoTab === 'robots')    buildSeoRobots();
        if (activeSeoTab === 'newpage')   buildSeoNewPage();
    }

    /* ---------- global ---------- */
    function buildSeoGlobal() {
        var a = $('#seoGlobalIdentity'); a.innerHTML = '';
        a.appendChild(bound('seo.siteName', { label: 'Site name', hint: 'Used in og:site_name, the title template and Organization schema.' }));
        a.appendChild(bound('seo.baseUrl', { label: 'Base URL', hint: 'No trailing slash, e.g. <code>https://example.com</code>. Every canonical is built from this.' }));
        a.appendChild(bound('seo.titleTemplate', { label: 'Title template', hint: '<code>%s</code> is the page title. Only applied when the page title does not already contain the site name.' }));

        var b = $('#seoGlobalDefaults'); b.innerHTML = '';
        b.appendChild(bound('seo.defaultTitle', { label: 'Default page title', counter: 60, hint: 'Fallback for a page with no title of its own.' }));
        b.appendChild(bound('seo.defaultDescription', { label: 'Default meta description', kind: 'area', counter: 155 }));

        var c = $('#seoVerification'); c.innerHTML = '';
        c.appendChild(bound('seo.verification.google', { label: 'Google Search Console', hint: 'The <code>content</code> value only, not the whole tag.' }));
        c.appendChild(bound('seo.verification.bing', { label: 'Bing Webmaster Tools' }));
        c.appendChild(bound('seo.verification.yandex', { label: 'Yandex Webmaster' }));
    }

    /* ---------- social ---------- */
    function buildSeoSocial() {
        var a = $('#seoSocial'); a.innerHTML = '';
        a.appendChild(bound('seo.defaultOgTitle', { label: 'Default OG title', counter: 60, hint: 'Blank = use the page title.' }));
        a.appendChild(bound('seo.defaultOgDescription', { label: 'Default OG description', kind: 'area', counter: 155, hint: 'Blank = use the meta description.' }));
        a.appendChild(seoField(function () { return seoGet('seo.twitterCard', 'summary_large_image'); },
                               function (v) { seoSet('seo.twitterCard', v); },
                               { label: 'X / Twitter card type', kind: 'select',
                                 options: [['summary_large_image', 'summary_large_image'], ['summary', 'summary']] }));
        a.appendChild(bound('seo.twitterSite', { label: 'X / Twitter @handle', hint: 'Optional, including the @. Leave blank if there is no account.' }));
        a.appendChild(bound('seo.defaultTwitterTitle', { label: 'Default X title', counter: 60, hint: 'Blank = inherit the OG title.' }));
        a.appendChild(bound('seo.defaultTwitterDescription', { label: 'Default X description', kind: 'area', counter: 155, hint: 'Blank = inherit the OG description.' }));

        var b = $('#seoSocialImage'); b.innerHTML = '';
        b.appendChild(bound('seo.defaultOgImage', { label: 'Default OG image URL', hint: 'Absolute URL, or a path like <code>assets/images/share.png</code>.' }));
        b.appendChild(bound('seo.defaultTwitterImage', { label: 'Default X image URL', hint: 'Blank = inherit the OG image.' }));
    }

    /* ---------- structured data ---------- */
    function buildSeoSchema() {
        var a = $('#seoOrg'); a.innerHTML = '';
        a.appendChild(bound('seo.organization.name', { label: 'Organization name' }));
        a.appendChild(bound('seo.organization.legalName', { label: 'Legal name', hint: 'Optional. Only if a registered entity name genuinely applies.' }));
        a.appendChild(bound('seo.organization.logo', { label: 'Logo URL',
            hint: 'A path like <code>assets/images/logo.png</code> or a full URL. ' +
                  'It must be a file search engines can fetch — an uploaded CMS image ' +
                  'will not work here, see below. Blank leaves the property out.',
            onChange: buildSeoSchema }));
        a.appendChild(bound('seo.organization.contactPoint.telephone', { label: 'Support phone', hint: 'Optional. Only publish a number that is genuinely answered.' }));
        a.appendChild(bound('seo.organization.contactPoint.email', { label: 'Support email', hint: 'Optional.' }));

        /* Why the uploaded logo cannot simply be reused here, and how to turn
           it into something that can be. */
        var bridge = $('#seoCmsImages');
        if (bridge) {
            var cmsLogo = sstr(CMS.get('images.logo', ''));
            var cmsFav = sstr(CMS.get('images.favicon', ''));
            var seoLogo = sstr(seoGet('seo.organization.logo', ''));
            var rows = [];

            rows.push(cmsLogo
                ? { level: 'ok', msg: 'A header logo is uploaded in <strong>Images</strong>, and the site displays it correctly.' }
                : { level: 'warn', msg: 'No header logo is uploaded in <strong>Images</strong>.' });
            rows.push(cmsFav
                ? { level: 'ok', msg: 'A favicon is uploaded in <strong>Images</strong>, and browsers use it.' }
                : { level: 'warn', msg: 'No favicon is uploaded in <strong>Images</strong>.' });

            if (isInlineImage(seoLogo)) {
                rows.push({ level: 'bad', msg: 'The Logo URL above holds an uploaded image rather than a file path. ' +
                    'Search engines fetch that URL from the web, so an inline image cannot be read and the ' +
                    'property is left out of the markup. Save the file below and use its path instead.' });
            } else if (!seoLogo) {
                rows.push({ level: 'warn', msg: 'No Logo URL set, so <code>Organization.logo</code> is omitted. ' +
                    'That is valid — better than pointing at a file that is not there.' });
            } else {
                rows.push({ level: 'ok', msg: 'Logo URL is a fetchable path: <code>' + esc(crawlableImage(seoLogo)) + '</code>' });
            }

            bridge.innerHTML =
                '<p class="hint">Uploaded images live inside the CMS record as inline data, which is why they ' +
                'appear on the site without any files being added. Structured data and social previews are ' +
                'different: the platform fetches those images from a URL, so they need a real file. Save what ' +
                'you already uploaded, commit it beside the other assets, then point the fields at its path.</p>' +
                checksHtml(rows);

            var bar = document.createElement('div');
            bar.className = 'snipbar';
            [['logo', 'logo', 'Save uploaded logo as a file'],
             ['favicon', 'favicon', 'Save uploaded favicon as a file']].forEach(function (row) {
                var val = sstr(CMS.get('images.' + row[0], ''));
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'adm-btn ghost snip';
                btn.innerHTML = '<i class="fas fa-download"></i> ' + row[2];
                btn.disabled = !val;
                btn.addEventListener('click', function () { downloadDataUrl(val, row[1]); });
                bar.appendChild(btn);
            });
            bridge.appendChild(bar);
        }

        var same = $('#seoSameAs'); same.innerHTML = '';
        var list = seoGet('seo.organization.sameAs', []) || [];
        same.appendChild(seoField(
            function () { return list.join('\n'); },
            function (v) {
                seoSet('seo.organization.sameAs',
                       v.split('\n').map(function (x) { return x.trim(); }).filter(Boolean));
            },
            { label: 'Profile URLs', kind: 'area', rows: 4, hint: 'One per line.' }));

        var t = $('#seoSchemaToggles'); t.innerHTML = '';
        t.appendChild(seoToggle(function () { return seoGet('seo.schema.organization', true) !== false; },
                                function (v) { seoSet('seo.schema.organization', v); },
                                'Organization', 'Published on the homepage.'));
        t.appendChild(seoToggle(function () { return seoGet('seo.schema.website', true) !== false; },
                                function (v) { seoSet('seo.schema.website', v); },
                                'WebSite', 'Published on the homepage.'));

        var pv = $('#seoSchemaPreview');
        if (pv) {
            var org = { '@context': 'https://schema.org', '@type': 'Organization',
                        name: sstr(seoGet('seo.organization.name', '')) || sstr(seoGet('seo.siteName', '')),
                        url: sstr(seoGet('seo.baseUrl', '')) };
            if (sstr(seoGet('seo.organization.legalName', ''))) org.legalName = sstr(seoGet('seo.organization.legalName', ''));
            var pvLogo = crawlableImage(seoGet('seo.organization.logo', ''));
            if (pvLogo) org.logo = pvLogo;
            var sa = (seoGet('seo.organization.sameAs', []) || []).filter(Boolean);
            if (sa.length) org.sameAs = sa;
            var tel = sstr(seoGet('seo.organization.contactPoint.telephone', ''));
            var eml = sstr(seoGet('seo.organization.contactPoint.email', ''));
            if (tel || eml) {
                org.contactPoint = { '@type': 'ContactPoint', contactType: 'customer support' };
                if (tel) org.contactPoint.telephone = tel;
                if (eml) org.contactPoint.email = eml;
            }
            pv.textContent = seoGet('seo.schema.organization', true) === false
                ? 'Organization schema is switched off.'
                : JSON.stringify(org, null, 2);
        }
    }

    /* ---------- sitemap ---------- */
    function indexablePages() {
        var pages = CMS.data().pages || {};
        return Object.keys(pages).map(function (k) {
            var p = pages[k];
            var robots = p.robots || {};
            return {
                key: k, label: p.label || k, url: p.url || '',
                index: robots.index !== false,
                inSitemap: p.inSitemap !== false && robots.index !== false,
                updatedAt: p.updatedAt || ''
            };
        });
    }

    /* ---------- sitemap.xml / robots.txt ----------
       Both files are built by js/seo-files.js, the SAME module
       tools/build-seo-files.js runs during the deploy. The admin is
       therefore not previewing an approximation of what will be published:
       it is running the publisher. If the two ever disagreed, the preview
       would be a lie, and a preview that lies about a crawler-facing file
       is worse than no preview. */
    function buildSitemapXml() {
        return (window.SEOFiles && window.SEOFiles.sitemap(CMS.data())) ||
               '<!-- No valid base URL is set in Global SEO, so no sitemap can be built. -->\n';
    }

    function buildSeoSitemap() {
        var rows = indexablePages();
        var host = $('#seoSitemapTable');
        var html = '<table class="seotable"><thead><tr><th>Page</th><th>URL</th>' +
                   '<th>Indexable</th><th>In sitemap</th><th>Last updated</th></tr></thead><tbody>';
        rows.forEach(function (p) {
            html += '<tr><td>' + esc(p.label) + '</td>' +
                    '<td><code>/' + esc(p.url) + '</code></td>' +
                    '<td>' + (p.index ? '<span class="ok">index</span>' : '<span class="muted">noindex</span>') + '</td>' +
                    '<td>' + (p.inSitemap ? 'yes' : '—') + '</td>' +
                    '<td>' + esc(p.updatedAt || '—') + '</td></tr>';
        });
        host.innerHTML = html + '</tbody></table>';
        $('#seoSitemapNote').innerHTML =
            'Pages set to <strong>noindex</strong> are left out automatically. ' +
            'Change a page\'s index setting in <strong>Pages</strong>.';
        $('#seoSitemapOut').textContent = buildSitemapXml();
    }

    function buildRobotsTxt() {
        return (window.SEOFiles && window.SEOFiles.robots(CMS.data())) ||
               '# No valid base URL is set in Global SEO, so no robots.txt can be built.\n';
    }

    function buildSeoRobots() {
        var ta = $('#seoRobotsExtra');
        ta.value = seoGet('seo.robotsExtra', '');
        ta.oninput = function () { seoSet('seo.robotsExtra', ta.value); markDirty(); $('#seoRobotsOut').textContent = buildRobotsTxt(); };
        $('#seoRobotsOut').textContent = buildRobotsTxt();
    }

    /* ========================================================
       WHAT IS ACTUALLY LIVE
       --------------------------------------------------------
       The admin can tell an author what the next deploy will publish,
       because it runs the generator. What it cannot know is whether that
       deploy has happened. So it asks the website: it fetches the real
       sitemap.xml and robots.txt from this origin and compares them with
       what the settings now say.

       The comparison is on MEANING, not bytes. The generated files carry a
       provenance comment that legitimately differs between a deploy that
       read the database and one that fell back to the committed config,
       and an author being told "3 changes pending" because of a comment
       would learn to ignore the warning entirely.

       Nothing here writes anything. A failure is reported as a failure --
       a fetch that 404s or times out never reads as "up to date".
    ======================================================== */
    var seoLiveBusy = {};

    function seoLocs(xml) {
        var out = [], re = /<loc>([^<]*)<\/loc>/gi, m;
        while ((m = re.exec(xml))) out.push(m[1].trim());
        return out;
    }

    function seoLastmods(xml) {
        var out = {}, re = /<url>([\s\S]*?)<\/url>/gi, m;
        while ((m = re.exec(xml))) {
            var loc = /<loc>([^<]*)<\/loc>/i.exec(m[1]);
            var mod = /<lastmod>([^<]*)<\/lastmod>/i.exec(m[1]);
            if (loc) out[loc[1].trim()] = mod ? mod[1].trim() : '';
        }
        return out;
    }

    /* Directive lines only: comments and blank lines are presentation. */
    function seoDirectives(txt) {
        return String(txt).split(/\r?\n/).map(function (l) { return l.trim(); })
            .filter(function (l) { return l && l.charAt(0) !== '#'; });
    }

    function seoProvenance(txt) {
        var m = /source:\s*([^\n\r]*)/i.exec(String(txt));
        return m ? m[1].trim() : '';
    }

    function seoDiffList(title, items) {
        if (!items.length) return '';
        return '<p class="hint"><strong>' + title + '</strong></p><ul class="seochecks">' +
            items.map(function (i) { return '<li class="chk-warn"><span>' + esc(i) + '</span></li>'; }).join('') +
            '</ul>';
    }

    function seoCheckLive(kind) {
        var host = $('#seoPubState-' + kind);
        if (!host || seoLiveBusy[kind]) return;
        seoLiveBusy[kind] = true;
        host.innerHTML = '<p class="hint">Reading the live file…</p>';

        var file = kind === 'robots' ? 'robots.txt' : 'sitemap.xml';
        /* Same origin, cache defeated: a cached copy would report a deploy
           that has not reached this browser as one that has. */
        fetch('../' + file + '?_=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching /' + file);
                return r.text();
            })
            .then(function (live) {
                seoLiveBusy[kind] = false;
                host.innerHTML = kind === 'robots' ? seoRobotsReport(live) : seoSitemapReport(live);
            })
            .catch(function (err) {
                seoLiveBusy[kind] = false;
                host.innerHTML =
                    '<ul class="seochecks"><li class="chk-bad"><span>' +
                    'Could not read the live <code>' + esc(file) + '</code>: ' + esc(err.message) +
                    '. Until that is fixed there is no way to tell whether the published file is ' +
                    'up to date — do not assume it is.</span></li></ul>';
            });
    }

    function seoStamp(live) {
        var src = seoProvenance(live);
        if (!src) return '<li class="chk-warn"><span>The live file carries no provenance line, so it ' +
                         'predates generated publishing. The next deploy will replace it.</span></li>';
        return '<li class="chk-ok"><span>The live file was built from <code>' + esc(src) + '</code>.</span></li>';
    }

    function seoSitemapReport(live) {
        var want = buildSitemapXml();
        var liveLocs = seoLocs(live), wantLocs = seoLocs(want);
        var liveMods = seoLastmods(live), wantMods = seoLastmods(want);

        var added = wantLocs.filter(function (u) { return liveLocs.indexOf(u) === -1; });
        var gone  = liveLocs.filter(function (u) { return wantLocs.indexOf(u) === -1; });
        var moved = wantLocs.filter(function (u) {
            return liveLocs.indexOf(u) > -1 && liveMods[u] !== wantMods[u];
        }).map(function (u) { return u + '  (' + (liveMods[u] || 'no date') + ' → ' + (wantMods[u] || 'no date') + ')'; });

        var n = added.length + gone.length + moved.length;
        var head = '<ul class="seochecks">' + seoStamp(live) +
            '<li class="chk-ok"><span>The live sitemap lists ' + liveLocs.length + ' URL(s).</span></li>' +
            (n ? '<li class="chk-warn"><span><strong>' + n + ' change(s) are waiting for the next deployment.</strong> ' +
                 'They are saved in the CMS; the published file will not show them until someone runs the deploy.' +
                 '</span></li>'
               : '<li class="chk-ok"><span><strong>The published sitemap matches these settings.</strong> ' +
                 'Nothing is waiting for a deployment.</span></li>') +
            '</ul>';

        return head +
            seoDiffList('Will be added:', added) +
            seoDiffList('Will be removed:', gone) +
            seoDiffList('Last-modified date will change:', moved);
    }

    function seoRobotsReport(live) {
        var want = buildRobotsTxt();
        var liveD = seoDirectives(live), wantD = seoDirectives(want);
        var added = wantD.filter(function (l) { return liveD.indexOf(l) === -1; });
        var gone  = liveD.filter(function (l) { return wantD.indexOf(l) === -1; });
        var n = added.length + gone.length;

        var head = '<ul class="seochecks">' + seoStamp(live) +
            '<li class="chk-ok"><span>The live file has ' + liveD.length + ' directive(s).</span></li>' +
            (/^\s*Disallow:\s*\/admin\/\s*$/mi.test(live)
                ? '<li class="chk-ok"><span><code>Disallow: /admin/</code> is live.</span></li>'
                : '<li class="chk-bad"><span><code>Disallow: /admin/</code> is NOT in the published file.</span></li>') +
            (n ? '<li class="chk-warn"><span><strong>' + n + ' change(s) are waiting for the next deployment.</strong>' +
                 '</span></li>'
               : '<li class="chk-ok"><span><strong>The published robots.txt matches these settings.</strong></span></li>') +
            '</ul>';

        return head +
            seoDiffList('Will be added:', added) +
            seoDiffList('Will be removed:', gone);
    }

    document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('[data-seocheck]');
        if (b) seoCheckLive(b.getAttribute('data-seocheck'));
    });

    /* Same rule the painter uses: an image a crawler must fetch cannot be a
       data URL. Kept in one place so the admin never shows something the page
       would not actually emit. */
    function isInlineImage(u) { return /^(data|blob):/i.test(sstr(u)); }

    function crawlableImage(u) {
        if (!sstr(u) || isInlineImage(u)) return '';
        return CMS.seoCrawlableImage ? CMS.seoCrawlableImage(u) : sstr(u);
    }

    /* Turn an uploaded CMS image (a data URL) into a real downloadable file.
       This is the only way to get a crawlable URL for it on a static site:
       save it, commit it next to the other assets, then point the SEO field
       at that path. */
    function downloadDataUrl(dataUrl, baseName) {
        var m = /^data:([^;,]+)[;,]/.exec(sstr(dataUrl));
        if (!m) { toast('That slot does not hold an uploaded image.', true); return; }
        var ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
                    'image/gif': 'gif', 'image/svg+xml': 'svg',
                    'image/x-icon': 'ico', 'image/vnd.microsoft.icon': 'ico' }[m[1]] || 'png';
        var parts = dataUrl.split(',');
        var bin = /;base64/i.test(parts[0]) ? atob(parts[1]) : decodeURIComponent(parts[1]);
        var buf = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        var a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([buf], { type: m[1] }));
        a.download = baseName + '.' + ext;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('Saved ' + a.download + '. Commit it to the repository, then use its path above.');
    }

    function download(name, text, type) {
        var blob = new Blob([text], { type: type || 'text/plain' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    }

    function copyText(text, what) {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text)
                .then(function () { toast(what + ' copied.'); })
                .catch(function () { toast('Copy failed — use Download instead.', true); });
        } else { toast('Copy is not available here — use Download.', true); }
    }

    /* ========================================================
       VALIDATION
       Individual, explainable checks. Deliberately NOT a score:
       search engines do not publish one, and a number invites
       optimising for the number instead of the reader.
    ======================================================== */
    /* ========================================================
       WHAT A PAGE'S CONTENT ACTUALLY IS
       --------------------------------------------------------
       Two kinds of page body live side by side in this CMS:

         REPOSITORY BODY   pages.<slug>.body -- the HTML that ships in the
                           .html file and is edited as text in Pages.
         BUILDER CONTENT   pages.<slug>.builder -- the sections the Page
                           Builder owns, rendered into the page's mount.

       The dashboard used to read the body field and nothing else, so every
       builder-managed page reported "the page body is empty" and zero words
       while the live page was full of content.

       This asks the RENDERER instead. CMS.sections.renderInto() is the very
       function the public page calls, so what is measured here is the markup
       a visitor is actually served -- not a second interpretation of the
       section data that could drift away from it over time.

       Only PUBLISHED sections count. A draft is not on the web; reporting it
       as content would tell an author their SEO is fixed when nothing has
       shipped. The draft is still WORTH MENTIONING, which is why the state
       is carried out of here rather than thrown away.
    ======================================================== */

    /* Rendering a section array is cheap but not free -- and an <img> the
       renderer creates starts a fetch whether or not it is ever inserted.
       The dashboard rebuilds on every keystroke in a SEO field, so the
       result is memoised against the exact sections it came from: identical
       content renders once, edited content renders again. */
    var contentMemo = {};

    function renderPublishedHtml(key, sections) {
        var sig = JSON.stringify(sections);
        /* One entry PER PAGE, replaced when that page's content changes.
           Keyed by slug rather than by signature so the cache cannot grow
           with every edit -- and so building the dashboard, which renders
           every builder page in turn, does not evict the entry it is about
           to need again on the next keystroke. */
        var hit = contentMemo[key];
        if (hit && hit.sig === sig) return hit.html;
        var host = document.createElement('div');
        try { CMS.sections.renderInto(host, sections); }
        catch (e) { host.textContent = ''; }
        contentMemo[key] = { sig: sig, html: host.innerHTML };
        return contentMemo[key].html;
    }

    /* A live DOM to run the checks against. Built from a string in an inert
       document, so nothing here loads, runs or navigates. */
    function contentDoc(html) {
        try {
            return new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
        } catch (e) { return null; }
    }

    function pageContent(key, p) {
        var out = {
            owns: p.body !== undefined && sstr(p.url) !== '',
            source: 'body',          /* 'body' | 'builder' */
            html: sstr(p.body),
            published: false,        /* is builder content live for this page */
            draftPending: false,     /* a draft says something else */
            draftOnly: false         /* a draft exists but nothing is published */
        };
        if (!CMS.sections || typeof CMS.sections.published !== 'function' ||
            typeof CMS.sections.renderInto !== 'function') return out;

        var pub = null, st = null;
        try { pub = CMS.sections.published(key); } catch (e) { pub = null; }
        try { st = CMS.sections.status ? CMS.sections.status(key) : null; } catch (e) { st = null; }

        if (!pub) {
            /* No published builder block: the shipped body is still exactly
               what a visitor sees, so it is still what gets analysed. */
            if (st && st.dirty && st.sections) out.draftOnly = true;
            return out;
        }

        /* A published builder page owns content even if its CMS entry
           never carried a body field -- but a page with no URL (the
           homepage) is still not one the dashboard analyses. */
        if (sstr(p.url) !== '') out.owns = true;
        out.source = 'builder';
        out.published = true;
        out.draftPending = !!(st && st.dirty);
        out.html = renderPublishedHtml(key, pub);
        return out;
    }

    /* The checks themselves. One implementation for both kinds of content --
       the whole point is that a builder page and a hand-written page are
       held to the same standard and told so in the same words. */
    function contentChecks(content, pages, ok, warn, bad, p) {
        var builder = content.source === 'builder';
        var what = builder ? 'published page content' : 'page body';
        var doc = contentDoc(content.html);
        var body = doc && doc.body;

        if (builder) {
            if (content.draftPending)
                warn('This page has unpublished Page Builder changes. Everything below describes ' +
                     'what is PUBLISHED — press Publish in the Page Builder to make the draft live.');
            else
                ok('Page Builder content is published; this is what search engines see.');
        } else if (content.draftOnly) {
            warn('A Page Builder draft exists for this page but has never been published, so the ' +
                 'checks below describe the page body that is still live.');
        }

        /* ---- H1 ---- */
        var h1s = body ? body.querySelectorAll('h1').length : 0;
        if (h1s > 0)
            bad('The ' + what + ' contains ' + h1s + ' <h1> heading(s). The page already has one H1 ' +
                'above the content — use H2 inside the content.');
        if (!sstr(p.heading)) bad('No H1 set for this page.');
        else ok('One H1 is set.');

        /* ---- is there anything at all ---- */
        var text = body ? String(body.textContent || '').replace(/\s+/g, ' ').trim() : '';
        if (!text && !(body && body.querySelector('img'))) {
            bad(builder ? 'The published Page Builder content is empty.' : 'The page body is empty.');
            return;
        }

        var words = text ? text.split(/\s+/).length : 0;
        if (words < 150) warn(cap(what) + ' is about ' + words + ' words. Short pages rarely satisfy a search visitor.');
        else ok(cap(what) + ' is about ' + words + ' words.');

        /* ---- heading order ---- */
        var heads = body ? body.querySelectorAll('h2,h3,h4,h5,h6') : [];
        var prev = 1, skipped = false, i;
        for (i = 0; i < heads.length; i++) {
            var lvl = parseInt(String(heads[i].tagName).slice(1), 10);
            if (lvl > prev + 1) skipped = true;
            prev = lvl;
        }
        if (skipped) warn('A heading level is skipped (for example an H2 followed by an H4).');

        /* ---- images and alt text ----
           An image with alt="" is a DECORATIVE image when a person wrote the
           markup by hand, and that is a real and correct thing to write. In
           the Page Builder the alt is a form field, so an empty one means
           nobody filled it in. Same check, two honest readings of it. */
        var imgs = body ? body.querySelectorAll('img') : [];
        var noAlt = 0;
        for (i = 0; i < imgs.length; i++) {
            var has = imgs[i].hasAttribute('alt');
            var val = has ? String(imgs[i].getAttribute('alt')).trim() : '';
            if (!has || (builder && !val)) noAlt += 1;
        }
        if (noAlt) warn(noAlt + ' image(s) in the ' + what + ' have no alt text.');

        /* ---- internal links ---- */
        var links = body ? body.querySelectorAll('a[href]') : [];
        var flagged = {};
        for (i = 0; i < links.length; i++) {
            var href = String(links[i].getAttribute('href') || '').trim();
            if (!/^[a-z0-9-]+\.html$/i.test(href)) continue;
            if (flagged[href]) continue;
            var known = Object.keys(pages).some(function (k) { return pages[k].url === href; });
            if (!known) { flagged[href] = 1; warn('Links to <code>' + esc(href) + '</code>, which is not a page the CMS knows about.'); }
        }
    }

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

    function validatePage(key) {
        var pages = CMS.data().pages || {};
        var p = pages[key];
        var out = [];
        if (!p) return out;
        var ok   = function (m) { out.push({ level: 'ok',   msg: m }); };
        var warn = function (m) { out.push({ level: 'warn', msg: m }); };
        var bad  = function (m) { out.push({ level: 'bad',  msg: m }); };

        var title = sstr(p.title);
        if (!title) bad('No SEO title. Search engines will invent one from the page.');
        else if (title.length < 20) warn('SEO title is quite short (' + title.length + ' characters) — there is room to say more.');
        else if (title.length > 60) warn('SEO title is ' + title.length + ' characters; Google usually truncates around 60.');
        else ok('SEO title looks a sensible length.');

        var desc = sstr(p.metaDescription);
        if (!desc) bad('No meta description. Google will pull an arbitrary snippet instead.');
        else if (desc.length < 70) warn('Meta description is short (' + desc.length + ' characters).');
        else if (desc.length > 160) warn('Meta description is ' + desc.length + ' characters; the snippet is usually cut near 160.');
        else ok('Meta description looks a sensible length.');

        /* duplicates across pages */
        Object.keys(pages).forEach(function (k) {
            if (k === key) return;
            if (title && sstr(pages[k].title) === title) bad('Same SEO title as "' + (pages[k].label || k) + '".');
            if (desc && sstr(pages[k].metaDescription) === desc) bad('Same meta description as "' + (pages[k].label || k) + '".');
        });

        var robots = p.robots || {};
        if (robots.index === false) warn('This page is set to noindex — it will not appear in search results.');

        var base = sstr(seoGet('seo.baseUrl', ''));
        if (!/^https?:\/\//i.test(base)) bad('The base URL in Global SEO is not a valid absolute URL.');
        var canon = sstr(p.canonical);
        if (canon && !/^https?:\/\//i.test(canon) && canon.indexOf('/') !== 0 && !/^[\w.-]+\.html$/.test(canon))
            bad('Canonical override does not look like a valid URL or page path.');
        if (canon && /^https?:\/\//i.test(canon) && base && canon.indexOf(base) !== 0)
            warn('Canonical points at a different domain than the base URL.');

        /* ---------- what this page's content ACTUALLY is ---------- */
        var content = pageContent(key, p);
        if (content.owns) {
            contentChecks(content, pages, ok, warn, bad, p);
        }

        var ogImg = (p.og && sstr(p.og.image)) || sstr(seoGet('seo.defaultOgImage', ''));
        var twImg = (p.twitter && sstr(p.twitter.image)) || sstr(seoGet('seo.defaultTwitterImage', ''));
        if (isInlineImage(ogImg) || isInlineImage(twImg)) {
            bad('A share image is set to an uploaded image rather than a file path. Facebook and X fetch ' +
                'that image from the web, so an inline one cannot be used and the tag is left out. Save the ' +
                'file from SEO &gt; Structured Data and use its path.');
        } else if (!ogImg) {
            warn('No share image set, so links to this page share without a picture.');
        } else {
            ok('Share image is configured.');
        }

        return out;
    }

    function checksHtml(list) {
        var icon = { ok: '<i class="fas fa-check"></i>', warn: '<i class="fas fa-triangle-exclamation"></i>', bad: '<i class="fas fa-circle-exclamation"></i>' };
        return '<ul class="seochecks">' + list.map(function (c) {
            return '<li class="chk-' + c.level + '">' + icon[c.level] + ' <span>' + c.msg + '</span></li>';
        }).join('') + '</ul>';
    }

    function buildSeoDashboard() {
        var host = $('#seoDashboard');
        var pages = CMS.data().pages || {};
        var html = '';
        Object.keys(pages).forEach(function (k) {
            var p = pages[k];
            var checks = validatePage(k);
            var bad = checks.filter(function (c) { return c.level === 'bad'; }).length;
            var warn = checks.filter(function (c) { return c.level === 'warn'; }).length;
            var pill = bad ? '<span class="pill warn">' + bad + ' to fix</span>'
                     : warn ? '<span class="pill">' + warn + ' to review</span>'
                            : '<span class="pill ok">clear</span>';
            /* Where the content being judged came from, said out loud: an
               author looking at a builder page needs to know the checks
               describe what is PUBLISHED, not the draft they last saved. */
            var c = pageContent(k, p);
            var src = !c.published
                ? (c.draftOnly
                    ? '<span class="pill warn" data-src="draft-only">Builder draft — not published</span>'
                    : '<span class="pill" data-src="body">Page body</span>')
                : (c.draftPending
                    ? '<span class="pill warn" data-src="builder-dirty">Page Builder — published, draft pending</span>'
                    : '<span class="pill ok" data-src="builder">Page Builder — published</span>');

            html += '<div class="seorow" data-seorow="' + esc(k) + '"><div class="seorow-head">' +
                    '<strong>' + esc(p.label || k) + '</strong> ' +
                    '<code>/' + esc(p.url || '') + '</code> ' + src + ' ' + pill +
                    '<button class="adm-btn ghost snip" data-editpage="' + esc(k) + '">Edit</button></div>' +
                    checksHtml(checks) + '</div>';
        });
        host.innerHTML = html;
        $$('[data-editpage]', host).forEach(function (b) {
            b.addEventListener('click', function () {
                activePageKey = b.getAttribute('data-editpage');
                switchPanel('pages');
                buildPages();
            });
        });
    }

    /* ---------- create page ---------- */
    var newPageDraft = null;

    function slugify(v) {
        return String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }

    /* Two slugs are "too close" when one contains the other or they differ
       by a couple of characters — the shape of a doorway page. */
    function nearDuplicate(slug) {
        var pages = CMS.data().pages || {};
        var hits = [];
        Object.keys(pages).forEach(function (k) {
            var other = pages[k].slug || k;
            if (!other || other === slug) { if (other === slug) hits.push(other); return; }
            if (other.indexOf(slug) > -1 || slug.indexOf(other) > -1) hits.push(other);
        });
        return hits;
    }

    function buildSeoNewPage() {
        if (!newPageDraft) newPageDraft = { label: '', slug: '', title: '', metaDescription: '', heading: '', lead: '' };
        var host = $('#seoNewPageFields'); host.innerHTML = '';
        function f(key, def) {
            return seoField(function () { return newPageDraft[key]; },
                            function (v) {
                                newPageDraft[key] = v;
                                if (key === 'label' && !newPageDraft.slugTouched) newPageDraft.slug = slugify(v);
                                if (key === 'slug') newPageDraft.slugTouched = true;
                                checkNewPage();
                            }, def);
        }
        host.appendChild(f('label', { label: 'Page name', hint: 'How it appears in the admin and in navigation.' }));
        host.appendChild(f('slug', { label: 'Slug / file name', hint: 'Becomes <code>slug.html</code>. Lowercase, hyphens.' }));
        host.appendChild(f('title', { label: 'SEO title', counter: 60 }));
        host.appendChild(f('metaDescription', { label: 'Meta description', kind: 'area', counter: 155 }));
        host.appendChild(f('heading', { label: 'H1 heading' }));
        host.appendChild(f('lead', { label: 'Intro / lead' }));
        checkNewPage();
    }

    function checkNewPage() {
        var warn = $('#seoNewPageWarn');
        if (!warn || !newPageDraft) return;
        var slug = slugify(newPageDraft.slug);
        var msgs = [];
        if (slug) {
            var near = nearDuplicate(slug);
            if (near.length) {
                msgs.push({ level: 'bad', msg: 'A page with a very similar address already exists: <code>' +
                            near.map(esc).join('</code>, <code>') + '</code>. Near-duplicate pages compete with each other and look like keyword doorways. Expand the existing page instead.' });
            }
            if (/(login|register|signup|sign-up)/.test(slug)) {
                msgs.push({ level: 'warn', msg: 'Pages built around sign-in keywords rarely earn rankings and often read as doorway pages.' });
            }
        }
        warn.innerHTML = msgs.length ? checksHtml(msgs) : '';
        var btn = $('#btnCreatePage');
        if (btn) btn.disabled = !slug || !sstr(newPageDraft.label) ||
                                msgs.some(function (m) { return m.level === 'bad'; });
    }

    /* ----------------------------------------------------------
       THE GLOBAL SHELL, FOR A PAGE THIS PANEL GENERATES

       A generated page has to arrive complete: it is downloaded and
       committed, and nothing runs between here and the repository. But
       pasting the header and footer markup into this file would create
       the second copy that tools/build-shell.js exists to remove -- and
       the two would drift, which is exactly how privacy-policy.html came
       to ship with a comment where its header should be.

       So the shell is READ from a page that already has it, using the
       same SHELL: markers the tool writes. One source of truth, and a
       generated page is byte-identical to the pages beside it.

       If the read fails the markers are still emitted, empty, with a note
       saying how to fill them -- a page that is honestly incomplete and
       says so, rather than one that silently omits its navigation.
    ---------------------------------------------------------- */
    var shellCache = null, shellPending = null;

    function loadShell() {
        if (shellCache) return Promise.resolve(shellCache);
        if (shellPending) return shellPending;
        shellPending = fetch('../about.html', { cache: 'no-cache' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.text();
            })
            .then(function (html) {
                shellCache = { header: cutRegion(html, 'HEADER'),
                               nav:    cutRegion(html, 'NAV'),
                               footer: cutRegion(html, 'FOOTER') };
                shellPending = null;
                return shellCache;
            })
            .catch(function () {
                shellPending = null;
                return { header: null, nav: null, footer: null };
            });
        return shellPending;
    }

    /* The text between a marker pair, or null. Nothing here is inserted
       into the live DOM -- it goes straight into a downloaded file. */
    function cutRegion(html, name) {
        var open = '<!-- SHELL:' + name + ' -->';
        var close = '<!-- /SHELL:' + name + ' -->';
        var a = html.indexOf(open), b = html.indexOf(close);
        if (a === -1 || b === -1 || b < a) return null;
        return html.slice(a + open.length, b).replace(/^\n|\s+$/g, '');
    }

    function shellRegion(shell, name, key) {
        var body = shell ? shell[name] : null;
        var open = '    <!-- SHELL:' + name.toUpperCase() + ' -->\n';
        var close = '    <!-- /SHELL:' + name.toUpperCase() + ' -->\n';
        if (!body) {
            return open + '    <!-- Empty: run  node tools/build-shell.js  to fill this in. -->\n' + close;
        }
        /* The nav marks the page it is on. A generated page is new, so no
           item is current until it is added to the tool's own table. */
        if (name === 'nav') {
            body = body.replace(/ class="(nav-link|mob-cat-item) active"/g, ' class="$1"')
                       .replace(/ aria-current="page"/g, '');
        }
        return open + '    ' + body + '\n' + close;
    }

    function newPageHtml(key, shell) {
        var p = CMS.data().pages[key];
        var base = sstr(seoGet('seo.baseUrl', '')).replace(/\/+$/, '');
        var url = base + '/' + p.url;
        function e(v) { return esc(sstr(v)); }
        return '<!DOCTYPE html>\n<html lang="en" data-cms-page="' + e(key) + '">\n\n<head>\n' +
            '    <meta charset="UTF-8" />\n' +
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n\n' +
            '    <title data-cms-title="pages.' + e(key) + '.title">' + e(p.title) + '</title>\n' +
            '    <meta name="description" data-cms-meta="pages.' + e(key) + '.metaDescription" content="' + e(p.metaDescription) + '" />\n' +
            '    <link rel="canonical" href="' + e(url) + '" />\n' +
            '    <meta name="robots" content="index,follow" />\n\n' +
            '    <meta property="og:type" content="website" />\n' +
            '    <meta property="og:site_name" content="' + e(seoGet('seo.siteName', '')) + '" />\n' +
            '    <meta property="og:title" content="' + e(p.title) + '" />\n' +
            '    <meta property="og:description" content="' + e(p.metaDescription) + '" />\n' +
            '    <meta property="og:url" content="' + e(url) + '" />\n' +
            '    <meta name="twitter:card" content="summary_large_image" />\n' +
            '    <meta name="twitter:title" content="' + e(p.title) + '" />\n' +
            '    <meta name="twitter:description" content="' + e(p.metaDescription) + '" />\n\n' +
            '    <link rel="stylesheet" href="css/style.css" />\n' +
            '    <link rel="stylesheet" href="css/menu.css" />\n' +
            '    <link rel="stylesheet" href="css/responsive.css" />\n' +
            '    <link rel="stylesheet" href="css/content.css" />\n' +
            '    <link rel="stylesheet" href="css/sections.css" />\n' +
            '    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous" />\n' +
            '    <link rel="icon" id="cmsFavicon" />\n\n' +
            '    <script src="js/cms-config.js"></scr' + 'ipt>\n' +
            '    <script src="js/brand.js"></scr' + 'ipt>\n' +
            '    <script src="js/cms.js"></scr' + 'ipt>\n' +
            '</head>\n\n<body>\n\n' +
            shellRegion(shell, 'header', key) + '\n' +
            shellRegion(shell, 'nav', key) + '\n' +
            '    <!-- CONTENT -->\n' +
            '    <main class="info-main">\n' +
            '        <article class="info-article">\n' +
            '            <h1 data-cms-text="pages.' + e(key) + '.heading">' + e(p.heading) + '</h1>\n' +
            '            <p class="info-lead" data-cms-text="pages.' + e(key) + '.lead">' + e(p.lead) + '</p>\n' +
            '            <div class="info-body" data-cms-html="pages.' + e(key) + '.body"></div>\n' +
            '            <!-- Page Builder mount. Stays empty until sections are published. -->\n' +
            '            <div data-cms-sections="' + e(key) + '"></div>\n' +
            '        </article>\n' +
            '    </main>\n\n' +
            shellRegion(shell, 'footer', key) + '\n' +
            '    <!-- js/main.js is deliberately NOT loaded here: it installs a\n' +
            '         site-wide login gate that swallows every click, which would\n' +
            '         break the links on an information page. -->\n' +
            '    <script src="js/menu.js"></scr' + 'ipt>\n' +
            '</body>\n\n</html>\n';
    }

    function todayIso() {
        var d = new Date();
        return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }

    /* ---------- wiring ---------- */
    function wireSeoButtons() {
        var b;
        if ((b = $('#btnCopySitemap')))     b.addEventListener('click', function () { copyText(buildSitemapXml(), 'sitemap.xml'); });
        if ((b = $('#btnDownloadSitemap'))) b.addEventListener('click', function () { download('sitemap.xml', buildSitemapXml(), 'application/xml'); });
        if ((b = $('#btnCopyRobots')))      b.addEventListener('click', function () { copyText(buildRobotsTxt(), 'robots.txt'); });
        if ((b = $('#btnDownloadRobots')))  b.addEventListener('click', function () { download('robots.txt', buildRobotsTxt()); });

        if ((b = $('#btnCreatePage'))) b.addEventListener('click', function () {
            var slug = slugify(newPageDraft.slug);
            if (!slug) return;
            CMS.data().pages[slug] = {
                label: sstr(newPageDraft.label) || slug,
                url: slug + '.html',
                slug: slug,
                title: sstr(newPageDraft.title),
                metaDescription: sstr(newPageDraft.metaDescription),
                canonical: '',
                robots: { index: true, follow: true },
                heading: sstr(newPageDraft.heading),
                lead: sstr(newPageDraft.lead),
                body: '',
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: sstr(newPageDraft.label) || slug, show: true },
                schema: { webPage: true, breadcrumb: true, contactPage: false },
                inSitemap: true,
                updatedAt: todayIso(),
                /* the generated stub carries a <div data-cms-sections>, so the
                   Page Builder can offer this page too */
                builderMount: true
            };
            markDirty();
            buildBuilder();
            $('#btnDownloadPage').hidden = false;
            $('#btnDownloadPage').setAttribute('data-key', slug);
            toast('Page created in the CMS. Download the HTML file and add it to the site.');
            newPageDraft = null;
            buildPages();
            buildSeo();
        });

        if ((b = $('#btnDownloadPage'))) b.addEventListener('click', function () {
            var k = b.getAttribute('data-key');
            if (!k || !CMS.data().pages[k]) return;
            loadShell().then(function (shell) {
                download(CMS.data().pages[k].url, newPageHtml(k, shell), 'text/html');
                if (!shell || !shell.header) {
                    toast('Page downloaded, but the shell could not be read from about.html. ' +
                          'Run: node tools/build-shell.js', true);
                }
            });
        });
    }

    /* ========================================================
       SPORTS / EVENT TABLE
       Writes CMS.data().sportsTable, which js/cms.js paints as CSS
       variables. Presentation only — no event data, no markup is
       generated for the live table from here.
    ======================================================== */

    var ST_MOBILE_FIELDS = [
        ['mobTitleSize',  'Event name size',   'Bigger names read better but cost row height.'],
        ['mobDateSize',   'Date / time size',  ''],
        ['mobDateGap',    'Gap between name and date', ''],
        ['mobLabelSize',  '1 / X / 2 size',    ''],
        ['mobLabelGap',   'Gap above 1 / X / 2', ''],
        ['mobLabelPad',   'Space around 1 / X / 2', 'Padding above and below the labels themselves.'],
        ['mobOddsHeight', 'Odds cell height',  'Drives how tall each event row ends up.'],
        ['mobOddsSize',   'Odds text size',    ''],
        ['mobLockSize',   'Lock icon size',    'The padlock in a suspended market.'],
        ['mobRowPad',     'Row padding',       'Space above and below each event.'],
        ['mobRowGap',     'Gap between events','The light band separating one event from the next.']
    ];

    var ST_DESKTOP_FIELDS = [
        ['titleSize',    'Event name size',  ''],
        ['titleWeight',  'Event name weight','400 to 900.'],
        ['dateSize',     'Date / time size', ''],
        ['oddsHeight',   'Odds cell height', ''],
        ['oddsSize',     'Odds text size',   ''],
        ['oddsWeight',   'Odds text weight', '400 to 900.'],
        ['cellGap',      'Gap between odds cells', ''],
        ['dotSize',      'Live indicator size',    'The coloured dot beside each event.'],
        ['lockSize',     'Lock icon size',   ''],
        ['rowSeparator', 'Row separator width', '']
    ];

    function stField(def) {
        var key = def[0];
        return seoField(
            function () { return seoGet('sportsTable.' + key, ''); },
            function (v) { seoSet('sportsTable.' + key, v); },
            { label: def[1], hint: def[2] || '', onChange: paintStPreview });
    }

    function buildSportsTable() {
        var mob = $('#stMobile'), desk = $('#stDesktop');
        if (!mob || !desk) return;
        mob.innerHTML = '';
        desk.innerHTML = '';
        ST_MOBILE_FIELDS.forEach(function (f) { mob.appendChild(stField(f)); });
        ST_DESKTOP_FIELDS.forEach(function (f) { desk.appendChild(stField(f)); });
        paintStPreview();
    }

    /* Sample rows built from the real class names, so the preview is styled
       by the same rules as the site rather than a second stylesheet. */
    function stPreviewMarkup() {
        function row(name, when, dot, odds) {
            return '<div class="match-row">' +
                     '<div class="match-info">' +
                       '<span class="match-title">' + esc(name) + '</span>' +
                       '<span class="match-meta">' +
                         '<span class="match-live-dot ' + dot + '"></span>' +
                         '<span class="match-bm">BM</span>' +
                       '</span>' +
                     '</div>' +
                     '<div class="match-datetime">' + esc(when) + '</div>' +
                     '<div class="mob-odds-labels"><span>1</span><span>X</span><span>2</span></div>' +
                     '<div class="match-odds">' + odds + '</div>' +
                   '</div>';
        }
        var lock = '<button class="odds-btn lock"><span class="lock-dash">-</span>' +
                   '<i class="fas fa-lock"></i><span class="lock-dash">-</span></button>';
        var open = '<button class="odds-btn back">3.1</button><button class="odds-btn lay">3.15</button>' +
                   '<button class="odds-btn draw">2.08</button><button class="odds-btn back2">2.1</button>' +
                   '<button class="odds-btn back3">4.8</button><button class="odds-btn lay2">5.1</button>';
        var part = lock + '<button class="odds-btn draw">-</button>' +
                   '<button class="odds-btn back2">-</button>' + lock;
        return '<div class="matches-table">' +
                 '<div class="match-group-header">' +
                   '<span class="match-group-title">Super Over2</span>' +
                   '<div class="match-group-right"><span class="mgr-dot"></span>' +
                   '<span class="mgr-bm">BM</span></div>' +
                 '</div>' +
                 row('Kolkata Knight Riders (e) - Rajasthan Royals', '18/09/2026 03:06:00', 'green', open) +
                 row('Lucknow Super Giants - Sunrisers Hyderabad', '18/09/2026 03:06:00', 'green', part) +
                 row('Melbourne Stars XI v Sydney Sixers XI', '18/09/2026 03:40:00', 'grey', lock + lock + lock) +
               '</div>';
    }

    /* The preview is an iframe at 390px carrying the site's own stylesheets,
       so it is shown by the same CSS the phone gets, at the same width. */
    function paintStPreview() {
        var host = $('#stPreview');
        if (!host) return;
        var vars = CMS.sportsTableCSS ? CMS.sportsTableCSS(CMS.data().sportsTable) : '';
        var colors = '';
        var c = CMS.data().colors || {};
        for (var k in c) {
            if (Object.prototype.hasOwnProperty.call(c, k) && c[k] &&
                k !== 'login-bg-from' && k !== 'login-bg-to') {
                colors += '--' + k + ':' + c[k] + ';';
            }
        }
        var doc =
            '<!DOCTYPE html><html><head><meta charset="utf-8">' +
            '<link rel="stylesheet" href="../css/style.css">' +
            '<link rel="stylesheet" href="../css/responsive.css">' +
            '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">' +
            '<style>:root{' + colors + vars + '}' +
            'body{margin:0;background:var(--page-bg)}' +
            '.matches-table{max-height:none;overflow:visible}</style>' +
            '</head><body>' + stPreviewMarkup() + '</body></html>';

        var frame = host.querySelector('iframe');
        if (!frame) {
            frame = document.createElement('iframe');
            frame.className = 'stprev-iframe';
            frame.setAttribute('title', 'Sports table preview');
            host.innerHTML = '';
            host.appendChild(frame);
        }
        frame.srcdoc = doc;
        frame.onload = function () {
            try {
                var h = frame.contentDocument.body.scrollHeight;
                if (h) frame.style.height = (h + 4) + 'px';
            } catch (e) { /* height stays at the CSS default */ }
        };
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
       PAGE BUILDER
       The builder UI lives in js/admin-builder.js, which loads before
       this file and defines window.PBAdmin. It is instantiated here,
       where its code used to sit, so initialisation order is unchanged.

       The four shims below keep every existing call site in this file
       reading exactly as it did, and they tolerate the factory being
       absent so a missing script degrades to "no builder panel" rather
       than a broken admin.
    ======================================================== */
    var Builder = (typeof window.PBAdmin === 'function')
        ? window.PBAdmin({ $: $, esc: esc, toast: toast, commit: commit, download: download })
        : null;

    function buildBuilder()  { if (Builder) Builder.build(); }
    function wireBuilder()   { if (Builder) Builder.wire(); }
    function pbFlush()       { if (Builder) Builder.flush(); }
    function pbFitPreview()  { if (Builder) Builder.fit(); }
    function pbCancelDrag()  { if (Builder && Builder.drag) Builder.drag.cancel(); }

    /* Same reason as ADMIN_REFRESH above: the tests drive the builder the
       way the UI does, and the drag layer's refusals have to be reachable
       with addresses no mouse can produce. */
    window.ADMIN_BUILDER = Builder;

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
        buildDesign();
        buildRegister();
        buildText();
        buildImages();
        buildAllLists();
        buildFooter();
        buildPages();
        buildSeo();
        buildSportsTable();
        buildBuilder();
        buildPresets();
        renderPreview();
        $('#brandLabel').textContent = CMS.get('branding.siteName', 'BRAND');
        updateStorageMeter();
        refreshPublishSize();
        paintRemoteStatus();
        dirty = false;
        $('#savedFlag').className = 'adm-saved';
    }

    wireSeoButtons();
    wireBuilder();
    window.addEventListener('beforeunload', pbFlush);
    window.addEventListener('resize', pbFitPreview);
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
            'lock-icon': '#ffffff',
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
