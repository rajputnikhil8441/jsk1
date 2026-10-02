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

    /* ========================================================
       TWO STATES, NEVER ONE
       ------------------------------------------------------
       LOCAL SAVE STATE  is this edit on this disk?      #savedFlag
       PUBLISH STATE     does the server have it?        #pubState

       They used to be one flag, so a Page Builder keystroke -- which saves
       locally and deliberately does not publish -- flipped the top bar to
       "Saved" and disarmed the unload guard while the brand was still
       unpublished. Splitting them is the fix.

       `dirty` now means "not published", not "not saved". That is what the
       unload guard and the change count are actually about: a local save is
       cheap and automatic, a publish is not.
    ======================================================== */
    var pubState = 'clean';      /* clean | local | publishing | published | failed */
    var pubError = '';

    function markDirty() {
        dirty = true;
        var f = $('#savedFlag');
        if (f) {
            f.textContent = 'Unsaved changes';
            f.className = 'adm-saved dirty';
        }
        /* A failure stays a failure until a publish confirms: editing more
           does not make the last failed publish any less true. */
        if (pubState !== 'failed' && pubState !== 'publishing') setPubState('local');
        else paintPubState();
    }

    /* Written to this device. Says nothing about the server, deliberately. */
    function markLocalSaved() {
        var f = $('#savedFlag');
        if (f) {
            f.textContent = 'Saved on this device';
            f.className = 'adm-saved show';
            setTimeout(function () { f.className = 'adm-saved'; }, 1800);
        }
        /* dirty is NOT cleared here. A local save has not published
           anything, and the unload guard and the change count both mean
           "unpublished". */
        if (pubState === 'clean') setPubState('local');
        else paintPubState();
    }

    function setPubState(next, reason) {
        pubState = next;
        pubError = (next === 'failed') ? (reason || 'Unknown error') : '';
        if (next === 'published' || next === 'clean') dirty = false;
        paintPubState();
    }

    /* The brand this admin publishes to, in words, for a button or a toast.
       The display name is editable content and can be blank mid-edit, so the
       hostname is the fallback -- and the row id is always shown, because it
       is the thing that actually keeps two brands apart. */
    function publishBrandName() {
        return sstr(CMS.get('branding.siteName', '')) || CMS.brand.host() || 'this site';
    }

    function publishTargetLabel() {
        return publishBrandName() + ' (' + (CMS.brand.host() || 'no hostname') +
               ' → row ' + (CMS.brand.siteId() || 'none') + ')';
    }

    /* The publish target, written out rather than implied. Repainted with the
       state because the display name comes from editable content. */
    function paintPubTarget() {
        var n = $('#pubTargetName'), h = $('#pubTargetHost'), r = $('#pubTargetRow');
        if (n) n.textContent = publishBrandName();
        if (h) h.textContent = CMS.brand.host() || 'no hostname';
        if (r) {
            r.textContent = CMS.remote.enabled
                ? 'Target: ' + (CMS.brand.siteId() || 'none')
                : 'Not publishing — remote storage is off';
            r.className = CMS.brand.agrees() ? '' : 'chk-warn';
        }
    }

    function paintPubState() {
        paintPubTarget();
        var el = $('#pubState');
        if (!el) return;
        var text = '', cls = '';
        if (pubState === 'publishing') {
            text = 'Publishing…'; cls = 'publishing';
        } else if (pubState === 'published') {
            var d = new Date();
            text = 'Published ✓ ' + ('0' + d.getHours()).slice(-2) + ':' +
                   ('0' + d.getMinutes()).slice(-2);
            cls = 'published';
        } else if (pubState === 'failed') {
            text = 'Not published — ' + pubError; cls = 'failed';
        } else if (pubState === 'local') {
            text = 'Unpublished changes'; cls = 'local';
        } else {
            text = CMS.remote.enabled ? 'Everything published' : 'Local only';
            cls = 'clean';
        }
        el.textContent = text;
        el.className = 'pubstate ' + cls;
        el.setAttribute('data-pubstate', pubState);
        var btn = $('#btnReview');
        if (btn) btn.disabled = (pubState === 'publishing');
    }

    /* ========================================================
       LOCAL SAVE vs PUBLISH — the one rule this admin runs on
       ------------------------------------------------------
       There used to be a single commit(silent) that did both jobs, and the
       difference between "this browser" and "every visitor" was one boolean
       argument at 20 call sites. That is what made Save, Save draft and
       Publish indistinguishable.

       They are two functions now, named for what they reach:

         commitLocal()      localStorage. Never the network. Never says
                            "Published". Never clears the unpublished-change
                            state.
         publishToRemote()  the ONLY path to Supabase. Goes through the
                            review flow, the brand guard, and a read-back.

       The Page Builder is handed commitLocal and a staging call, never a
       generic commit, so it cannot reach the network even by mistake.
    ======================================================== */

    /* Persist to this device + repaint the admin's own preview.
       Returns whether the write reached storage. */
    function commitLocal() {
        if (!CMS.save()) {
            toast('Storage full — remove or shrink some images.', true);
            return false;
        }
        markLocalSaved();
        renderPreview();
        var brandName = CMS.get('branding.siteName', 'BRAND');
        $('#brandLabel').textContent = brandName;
        /* The tab title is shared markup, so it cannot carry a brand
           name of its own -- it is painted from the brand like the
           label beside it. */
        document.title = brandName + ' CMS — Admin';
        /* And WHICH brand that is, in the sidebar, on every screen -- not
           only on the Brands panel. */
        var hostLine = $('#brandHost');
        if (hostLine) {
            hostLine.textContent = CMS.brand.host() || 'no hostname';
            hostLine.title = 'Publishing to row "' + CMS.brand.siteId() + '"' +
                (CMS.brand.matched() ? '' : ' (this hostname is not a registered brand)');
            hostLine.className = 'adm-brand-host' +
                (CMS.brand.matched() && CMS.brand.agrees() ? '' : ' chk-warn');
        }
        buildBrands();
        updateStorageMeter();
        return true;
    }

    /* The ONLY function in this file that reaches Supabase.

       Returns a promise that settles either way, so the caller can hold its
       button for the whole round trip -- without that, a second click lands
       while the first is in flight and publishes twice.

       "Published" is set by CMS.remote.publish() succeeding, and that now
       means the row was written AND read back. A 2xx alone no longer
       qualifies. A failure leaves the state `failed`, keeps the change count,
       and keeps the reason on screen: it is not a toast that vanishes while
       the brand is still unpublished. */
    function publishToRemote() {
        if (!CMS.remote.enabled) {
            toast('Remote publishing is off — changes stay in this browser.', true);
            return Promise.resolve(false);
        }
        setPubState('publishing');
        return CMS.remote.publish().then(function () {
            setPubState('published');
            toast('Published to ' + publishTargetLabel() + '.');
            return true;
        }).catch(function (err) {
            setPubState('failed', err && err.message ? err.message : String(err));
            if (/sign in/i.test(err && err.message || '')) showGate();
            return false;
        });
    }

    /* ========================================================
       STAGED PUBLISH INTENT
       ------------------------------------------------------
       Page Builder Publish and Unpublish do not mutate anything when
       pressed. They describe what they want -- {slug: 'publish'|'unpublish'}
       -- and that description is applied only when a publish is actually
       confirmed.

       Staging rather than mutate-then-rollback is what makes Cancel free:
       there is nothing to undo, because nothing was done. Rollback logic is
       the thing that gets a half-applied state wrong.
    ======================================================== */
    var pendingIntent = null;

    /* Returns the publish promise. It MUST: the builder holds its button
       until this settles, and a version that returned undefined released the
       guard synchronously -- so three clicks in one tick published three
       times. tests/test_pagebuilder_safety.js asserts one. */
    function stagePublish(intent) {
        pendingIntent = intent || null;
        return openPublishReview();
    }

    /* Turn the staged description into real local state. Called from inside
       the publish flow, after confirmation, never before. */
    function applyPendingIntent() {
        if (!pendingIntent) return;
        var slugs = Object.keys(pendingIntent), i;
        for (i = 0; i < slugs.length; i++) {
            if (pendingIntent[slugs[i]] === 'publish')        CMS.sections.publish(slugs[i]);
            else if (pendingIntent[slugs[i]] === 'unpublish') CMS.sections.unpublish(slugs[i]);
        }
        pendingIntent = null;
    }

    function clearPendingIntent() { pendingIntent = null; }

    /* The single door to the network. Phase 3 puts the review sheet in front
       of the confirm step; the sequence below is what runs once confirmed. */
    function confirmPublish() {
        applyPendingIntent();
        if (!commitLocal()) return Promise.resolve(false);
        buildBuilder();
        return publishToRemote();
    }

    /* ========================================================
       REVIEW & PUBLISH
       ------------------------------------------------------
       The list is built from CMS.changedAreas(), which hashes the SAME record
       withoutLocalKeys(load()) sends. It cannot describe one thing while the
       payload carries another.

       Labels live here, not in js/cms.js: the area keys are data, their
       wording is presentation.
    ======================================================== */
    var AREA_LABELS = {
        branding:     'Branding',
        colors:       'Colours',
        typography:   'Typography',
        design:       'Global design',
        text:         'Site text',
        images:       'Images',
        home:         'Home content',
        footer:       'Footer',
        seo:          'SEO defaults',
        themes:       'Themes',
        sportsTable:  'Sports table',
        registerPage: 'Register page',
        media:        'Media library',
        settings:     'Settings'
    };

    var PAGE_PART_LABELS = {
        builder:         'Page content',
        title:           'Page title',
        metaDescription: 'Meta description',
        heading:         'H1 heading',
        lead:            'Intro text',
        body:            'Fallback copy',
        settings:        'Search &amp; sharing settings'
    };

    /* area key -> { group, item }. An unknown key still gets a row: a change
       nobody labelled is still a change, and hiding it would under-report. */
    function describeArea(area) {
        if (area.indexOf('pages.') !== 0) {
            return { group: AREA_LABELS[area] || area, item: '' };
        }
        var rest = area.slice(6);
        var cut = rest.lastIndexOf('.');
        var slug = cut > -1 ? rest.slice(0, cut) : rest;
        var part = cut > -1 ? rest.slice(cut + 1) : '';
        var page = (CMS.data().pages || {})[slug] || {};
        return {
            group: (page.label ? esc(page.label) : esc(slug)) + ' <span class="publist-url">' +
                   esc(page.url || '') + '</span>',
            item: PAGE_PART_LABELS[part] || esc(part)
        };
    }

    /* How many sections a staged page publish would put live, so the sheet can
       say "12 sections" rather than "page content". */
    function stagedDetail(area) {
        if (!pendingIntent) return '';
        var m = /^pages\.(.+)\.builder$/.exec(area);
        if (!m) return '';
        var want = pendingIntent[m[1]];
        if (want === 'unpublish') return ' — take these sections OFF the live page';
        if (want !== 'publish') return '';
        var n = 0;
        try { n = CMS.sections.draft(m[1]).sections.length; } catch (e) { n = 0; }
        return ' — publish ' + n + (n === 1 ? ' section' : ' sections');
    }

    function buildPublishReview() {
        var t = $('#pubModalTarget');
        if (t) {
            t.innerHTML =
                '<strong>' + esc(publishBrandName()) + '</strong>' +
                '<span>' + esc(CMS.brand.host() || 'no hostname') + '</span>' +
                '<span>Target row: <code>' + esc(CMS.brand.siteId() || 'none') + '</code></span>' +
                (CMS.brand.matched() ? '' :
                    '<span class="chk-warn">This hostname is not a registered brand, so it is ' +
                    'borrowing the default one. Check before publishing.</span>');
        }

        var res = CMS.changedAreas();
        var list = $('#pubModalList');
        var note = $('#pubModalNote');
        var groups = {}, order = [];
        res.areas.forEach(function (area) {
            var d = describeArea(area);
            if (!groups[d.group]) { groups[d.group] = []; order.push(d.group); }
            groups[d.group].push((d.item || 'Everything in this area') + stagedDetail(area));
        });

        if (note) {
            note.innerHTML = !res.everPublished
                ? 'This browser has not confirmed a publish for this brand yet, so everything ' +
                  'it holds is listed. After the first publish only real differences appear here.'
                : (res.areas.length
                    ? 'Everything below replaces what is on the server now.'
                    : 'Nothing differs from what is already published.');
        }

        if (list) {
            list.innerHTML = order.length
                ? order.map(function (g) {
                    return '<div class="publist-group"><h5>' + g + '</h5><ul>' +
                        groups[g].map(function (i) { return '<li>' + i + '</li>'; }).join('') +
                        '</ul></div>';
                  }).join('')
                : '<p class="hint">No changes.</p>';
        }

        var last = $('#pubModalLast');
        if (last) {
            var lp = CMS.data().lastPublished || {};
            last.textContent = lp.at
                ? 'Last confirmed publish from this browser: ' + new Date(lp.at).toLocaleString() + '.'
                : 'This browser has not confirmed a publish for this brand.';
        }

        var btn = $('#pubConfirm');
        if (btn) {
            var n = res.areas.length;
            btn.innerHTML = '<i class="fas fa-cloud-arrow-up"></i> Publish ' +
                (n ? n + (n === 1 ? ' change' : ' changes') : 'nothing') +
                ' to ' + esc(publishBrandName());
            btn.disabled = false;
            btn.title = (CMS.brand.host() || 'no hostname') +
                        ' → row ' + (CMS.brand.siteId() || 'none');
        }
    }

    function closePublishReview() {
        var m = $('#pubModal');
        if (m) m.hidden = true;
    }

    /* Opens the sheet and resolves when the publish settles -- or immediately,
       with false, if it is cancelled. The builder holds its button on this
       promise, so it must settle in BOTH cases. */
    var reviewResolve = null;

    function openPublishReview() {
        var m = $('#pubModal');
        if (!m) return confirmPublish();          /* no sheet in the DOM: fail safe, still one door */
        buildPublishReview();
        m.hidden = false;
        var btn = $('#pubConfirm');
        if (btn) setTimeout(function () { btn.focus(); }, 60);
        return new Promise(function (resolve) { reviewResolve = resolve; });
    }

    function settleReview(v) {
        var r = reviewResolve;
        reviewResolve = null;
        if (r) r(v);
    }

    function wirePublishReview() {
        var cancel = function () {
            /* Cancel throws away the staged intent and touches nothing else.
               Nothing was applied, so there is nothing to undo. */
            clearPendingIntent();
            closePublishReview();
            paintPubState();
            settleReview(false);
        };
        var x = $('#pubCancelX'), c = $('#pubCancel'), ok = $('#pubConfirm'), m = $('#pubModal');
        if (x) x.addEventListener('click', cancel);
        if (c) c.addEventListener('click', cancel);
        if (m) m.addEventListener('click', function (e) { if (e.target === m) cancel(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && m && !m.hidden) cancel();
        });
        if (ok) ok.addEventListener('click', function () {
            ok.disabled = true;
            closePublishReview();
            confirmPublish().then(function (v) { settleReview(v); },
                                  function () { settleReview(false); });
        });
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
        /* Pages now hosts the builder and its preview iframe, which cannot be
           sized while the panel is hidden. Rebuilt on the way in, for the same
           reason design and media are. */
        if (name === 'pages') buildPages();
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
            commitLocal();
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
            /* Local only. The bytes are already gone from the bucket, but the
               library row is CMS content and goes live through Review &
               Publish like every other change -- an upload must not be a
               second, silent publishing path. */
            commitLocal();
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
                /* The bytes are already in the bucket. The library row that
                   remembers them is CMS content, so it reaches other devices
                   through Review & Publish -- not from here. This used to
                   publish the whole record on an upload, which is a second
                   publishing path nobody asked for. */
                commitLocal();
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
        },
        /* Phase 2C. Deliberately NOT the meta description: that is a search
           snippet, and one field serving both would make a change to how this
           page looks in Google also change every card that links to it. */
        {
            key: 'excerpt', label: 'Summary for listings', kind: 'area', rows: 2,
            hint: 'Shown by a Page list that links here, and used as the Article description. ' +
                  'Optional.',
            counter: 200
        }
    ];

    var activePageKey = null;

    function pageKeys() {
        var pages = CMS.data().pages;
        return pages ? Object.keys(pages) : [];
    }

    /* Which of the two areas of the Pages panel is showing. */
    var activePageTab = 'content';

    /* Can this page's body be built at all? A page with no
       <div data-cms-sections> in its HTML has nowhere for sections to render,
       so offering a content editor for it would be a control that does
       nothing -- which is exactly what the old Main content field was for
       home, login and register. */
    function pageHasMount(key) {
        var mounted = (CMS.sections && CMS.sections.mounted) || {};
        var page = (CMS.data().pages || {})[key] || {};
        return Object.prototype.hasOwnProperty.call(mounted, key) ? !!mounted[key]
                                                                 : !!page.builderMount;
    }

    function showPageTab(which) {
        /* A page with no mount has no Content area, so asking for one lands on
           Settings & SEO rather than on an empty panel. */
        if (which === 'content' && !pageHasMount(activePageKey)) which = 'settings';
        activePageTab = which;

        var content = $('#pageArea-content'), settings = $('#pageArea-settings');
        if (content) content.hidden = (which !== 'content');
        if (settings) settings.hidden = (which !== 'settings');

        $$('#pageSubtabs .subtab').forEach(function (b) {
            var on = b.getAttribute('data-pagetab') === which;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        var cb = $('#pageSubtabContent');
        if (cb) {
            var has = pageHasMount(activePageKey);
            cb.disabled = !has;
            cb.title = has ? 'Build this page\u2019s body from sections.'
                           : 'This page has no content mount, so its body is hand-built in its HTML file.';
        }

        var note = $('#pageNoMount');
        if (note) {
            if (pageHasMount(activePageKey)) { note.hidden = true; note.textContent = ''; }
            else {
                note.hidden = false;
                note.innerHTML = 'This page\u2019s layout and body are hand-built in <code>' +
                    esc((CMS.data().pages[activePageKey] || {}).url || activePageKey + '.html') +
                    '</code> and are not editable from the CMS. Its title, description, ' +
                    'headings and search settings are, in <strong>Settings &amp; SEO</strong>.';
            }
        }

        /* The builder only repaints when it is on screen. */
        if (which === 'content' && Builder) {
            Builder.select(activePageKey);
            Builder.build();
            pbFitPreview();
        }
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
            /* A dot for a page whose content is published, moved here from the
               builder's own tab strip along with the selector itself. */
            if (pageHasMount(k)) {
                var st = null;
                try { st = CMS.sections.status(k); } catch (e) { st = null; }
                if (st && st.live) {
                    var dot = document.createElement('span');
                    dot.className = 'pb-dot' + (st.dirty ? ' dirty' : '');
                    dot.title = st.dirty ? 'Published, with unpublished changes' : 'Published';
                    b.appendChild(dot);
                }
            }
            b.addEventListener('click', function () {
                activePageKey = k;
                buildPages();
            });
            tabs.appendChild(b);
        });

        renderPageEditor();
        showPageTab(activePageTab);
        /* The authors editor lives in this panel's Settings & SEO area, and
           what it shows (which pages name whom) is derived from the pages, so
           it is rebuilt with them rather than once at startup. The category and
           tag editors live beside it and show the same derived counts. */
        buildAuthors();
        refreshTaxonomy();
    }

    function wirePageSubtabs() {
        $$('#pageSubtabs .subtab').forEach(function (b) {
            b.addEventListener('click', function () {
                showPageTab(b.getAttribute('data-pagetab'));
            });
        });
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

        /* ---- PUBLICATION, for a page the CMS created ----
           Only these pages have a lifecycle to switch. The pages that ship
           with the site are generated from their own committed templates, so
           marking one draft would not take it off the site -- the build says
           so out loud if anyone tries, and offering the control here would
           imply otherwise. CMS.DEFAULTS is shared engine data, not a brand's,
           so this distinction is the same for every brand. */
        if (!(CMS.DEFAULTS.pages || {})[key]) head.appendChild(pageStatusField(page));

        var grid = document.createElement('div');
        grid.className = 'grid2';
        PAGE_FIELDS.forEach(function (f) { grid.appendChild(pageField(page, f)); });
        head.appendChild(grid);

        /* ---- THE CONTENT MODEL (Phase 2C) ----
           What kind of page this is, when it was published, who wrote it and
           which pages it points at. Every one of these is optional and every
           one is empty on a page nobody has set them on, which is why adding
           them changed nothing about what the site publishes.

           GUARDED LIKE PUBLICATION ABOVE, AND FOR THE SAME REASON. A page
           that ships with the site is generated from its own committed
           template, and those templates carry their own static SEO rather
           than the baked kind -- so a content type chosen here would reach
           the page's Article data (which the mount bakes) but NOT its
           og:type, which the template hardcodes. The served HTML would then
           call itself an article in one tag and a website in another, and the
           runtime would repaint og:type so the page a crawler reads and the
           page a visitor gets would disagree.

           A control that half-works is worse than no control, so the pages
           with committed templates do not get one. Everything else on this
           panel is unchanged for them. */
        if (!(CMS.DEFAULTS.pages || {})[key]) head.appendChild(pageContentModel(key, page));
        host.appendChild(head);

        /* ---- the body, READ ONLY ----
           There used to be an editable "Main content" HTML field here. It has
           gone, for two reasons.

           On a page the builder can mount, a published builder block HIDES this
           copy: the field saved, reported success, published, and the visitor
           saw none of it, with nothing on screen saying so. On a page with no
           mount -- home, login, register -- nothing has ever rendered the value
           at all, because those files carry no data-cms-html binding. Either
           way it was a control that did not do what it looked like it did.

           The VALUE is untouched. It still ships in the page HTML as the copy a
           visitor without JavaScript reads, it still comes back if the builder
           content is unpublished, and it is still what "Move page copy into the
           builder" imports from. So it is shown, as what it is. */
        var bodyCard = document.createElement('div');
        bodyCard.className = 'card';
        var mounted = pageHasMount(key);
        bodyCard.innerHTML =
            '<h2>Fallback copy</h2>' +
            '<p class="hint">This is the static fallback copy shipped in the page HTML. ' +
            'It is shown when JavaScript is disabled' +
            (mounted ? ' and can be restored if the Page Builder content is unpublished.'
                     : '.') + '</p>' +
            (mounted
                ? '<p class="hint">Edit this page\u2019s body in <strong>Content</strong>. ' +
                  'To start from the copy below, use <em>Move page copy into the builder</em> ' +
                  'there.</p>'
                : '<p class="hint">Nothing in the CMS renders this value for this page: ' +
                  '<code>' + esc(page.url || key + '.html') + '</code> carries no content ' +
                  'mount, so its body is whatever is written in the file.</p>');

        if (sstr(page.body)) {
            var ro = document.createElement('div');
            /* Reuses .pagepreview's page-body typography rather than a second
               copy of it; .pagefallback only adds the read-only framing. */
            ro.className = 'pagefallback pagepreview';
            ro.setAttribute('data-readonly', 'true');
            /* Rendered as the markup it is, so it reads like the page. Authored
               by a signed-in admin and already in the record; this only
               displays what is there. */
            ro.innerHTML = page.body;
            $$('a', ro).forEach(function (a) {
                a.addEventListener('click', function (e) { e.preventDefault(); });
            });
            bodyCard.appendChild(ro);
        } else {
            var none = document.createElement('p');
            none.className = 'hint';
            none.textContent = 'This page ships no fallback copy.';
            bodyCard.appendChild(none);
        }
        host.appendChild(bodyCard);

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

        /* ---- DELETE, for a page the CMS created ----
           Last on the panel, because it is the one control here that cannot
           be undone from this screen. Gated by exactly the test Publication
           and the content model above use: a page that ships with the site is
           generated from its own committed template, so deleting its record
           would not take it off the site and the control would be a lie. */
        if (!(CMS.DEFAULTS.pages || {})[key]) host.appendChild(pageDeleteCard(key, page));

        paintSeoPreviews();
    }

    /* ========================================================
       DELETING A PAGE THE CMS CREATED
       --------------------------------------------------------
       The whole of deletion is `delete CMS.data().pages[slug]` and a publish.
       Everything that makes a page disappear from the site is already in
       place and was proved before this was written:

         - the build enumerates pages from the published ROW
           (pbbake.pagesFromRecord), so a page that is not in the record is
           not generated;
         - tools/lib/sitekit.js assemble() wipes its output directory before
           writing, so rebuilding over a previous build removes the old file
           rather than leaving it to be served ("a stale file is a 404, or
           worse");
         - both deploys replace the published tree wholesale rather than
           copying over it;
         - the sitemap is built from the same record, so the url goes with it;
         - every reader of a page reference -- relatedPages(),
           publishedPages(), the Page list element, automatic related content,
           the link picker and the ItemList -- already drops one that does not
           resolve.

       So this adds the ACTION and nothing else. There is no trash, no
       deleted-pages collection, no redirect and no replacement page: the url
       simply stops existing, which is what a 404 is for.

       WHAT IT DOES NOT DO. It does not edit any other page. A stored
       reference to the deleted slug stays where it is and stops resolving,
       exactly as a dangling category, tag or author id does, and the page's
       own checks already report it. Rewriting other people's records to tidy
       up after a deletion would change content nobody asked to change.
    ======================================================== */

    /* How many OTHER pages name this one in their related list, so the
       confirmation can say what deleting it costs. Counted from the stored
       records rather than from resolved output, because a reference that has
       already stopped resolving is still a reference an author chose. */
    function pageRefCount(slug) {
        var pages = CMS.data().pages || {};
        var n = 0;
        Object.keys(pages).forEach(function (k) {
            if (k === slug) return;
            var rel = (pages[k] || {}).related;
            if (!isArray(rel)) return;
            for (var i = 0; i < rel.length; i++) {
                if (sstr(rel[i]) === slug) { n += 1; return; }
            }
        });
        return n;
    }

    function pageDeleteCard(key, page) {
        var card = document.createElement('div');
        card.className = 'card';
        var h = document.createElement('h2');
        h.textContent = 'Delete this page';
        card.appendChild(h);

        var hint = document.createElement('p');
        hint.className = 'hint';
        hint.innerHTML = 'Removes <code>' + esc(key) + '</code> from the CMS permanently. On the ' +
            'next deploy the build stops generating <code>' + esc(page.url || '') + '</code> and ' +
            'the file stops being served, so the address returns a normal <strong>404</strong>. ' +
            'It is <strong>not</strong> redirected anywhere, and there is no undo — to take a ' +
            'page off the site temporarily, set <strong>Publication</strong> to Draft instead.';
        card.appendChild(hint);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'adm-btn ghost danger';
        btn.setAttribute('data-act', 'page-delete');
        btn.innerHTML = '<i class="fas fa-trash"></i> Delete page';
        btn.addEventListener('click', function () {
            /* Re-read rather than trusting the closure: the panel may have
               been open while something else changed the record. Deleting a
               key that is no longer an own property of pages, or one the
               committed layer supplies, must do nothing at all. */
            var pages = CMS.data().pages || {};
            if (!Object.prototype.hasOwnProperty.call(pages, key) ||
                (CMS.DEFAULTS.pages || {})[key]) {
                toast('That page cannot be deleted.', true);
                buildPages();
                return;
            }
            var refs = pageRefCount(key);
            var msg = 'Delete "' + (page.label || key) + '" permanently?\n\n' +
                'It is removed from the CMS. After the next deploy ' +
                (page.url ? '/' + page.url : 'its address') + ' is no longer generated and ' +
                'returns a 404 — it is NOT redirected to another page.\n\n' +
                (refs
                    ? refs + ' other page(s) list this one as related. Those references will ' +
                      'stop resolving: nothing is shown for them, rather than a broken link. ' +
                      'They are left as they are.\n\n'
                    : '') +
                'There is no undo. To hide it instead, cancel and set Publication to Draft.';
            if (!confirm(msg)) return;

            delete CMS.data().pages[key];
            /* Let buildPages() choose the next tab: it already falls back to
               the first key when the active one is gone. */
            activePageKey = null;
            markDirty();
            buildPages();
            buildSeo();
            toast('Page deleted. Publish to remove it from the live site.');
        });
        card.appendChild(btn);
        return card;
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

    /* Draft or published, for a page the CMS created.

       Published is what an absent status already means to the build, so an
       older record opens as published and saving does not change what it is.
       Anything the build does not recognise is treated as a draft rather than
       published by accident, which is why this writes one of two exact
       words. */
    /* ========================================================
       THE CONTENT MODEL PANEL (Phase 2C)
       --------------------------------------------------------
       Four controls, and each one writes a value the engine already knows how
       to read. They are deliberately CHOICES rather than free text wherever a
       free-text box would let an author write something the renderer would
       then silently drop: the type comes from the engine's own allow-list, the
       author from the brand's own authors, and the related pages from the
       brand's own published pages.

       The date is the one text box, because a date picker that writes
       anything other than YYYY-MM-DD would be worse than typing it; what
       stops a bad one reaching the page is the engine refusing it, and the
       checks on Settings & SEO saying so.
    ======================================================== */
    /* ========================================================
       AUTHORS (Phase 2C)
       --------------------------------------------------------
       A small editor over `authors` in this brand's own record. It is not a
       profile system and deliberately holds four fields: a name, which is the
       only one an author cannot do without, a line of bio, a picture and one
       address. Anything more would be a social presence nobody asked for.

       The id is the stable handle a page stores, so it is set once when the
       author is created and never edited afterwards -- renaming is what the
       name field is for, and it updates every page at once because no page
       stores a name.
    ======================================================== */
    var AUTHOR_FIELDS = [
        ['name',  'Name', 'The byline, and the Person name in structured data. Required: an ' +
                          'author with no name does not resolve and publishes nothing.'],
        ['bio',   'One line about them', 'Optional. Shown only where a design asks for it.'],
        ['image', 'Picture', 'Optional. A path or https:// address — an uploaded inline ' +
                             'image cannot be used, because a crawler fetches this.'],
        ['url',   'Link', 'Optional. A page on this site, or a full https:// address.']
    ];

    /* CAN THE ENGINE EVER RESOLVE THIS ID? Asked by handing the engine's own
       resolver a one-entry collection, rather than by restating its rules
       here -- a second copy of "which keys are unsafe" is a second copy that
       can drift, and this one cannot: whatever the resolver refuses now or
       later, this refuses too.

       It matters because slugify() keeps letters, so a name like "Prototype"
       becomes the id `prototype` and "Constructor" becomes `constructor`,
       both of which unsafeKey() makes the engine refuse. Without this, the
       panel created the entry, listed it on a card and offered it in a
       select, and no page could ever publish it. (`__proto__` slugifies to
       the harmless `proto` and was always fine.)

       The probe is a fresh object literal and the assignment makes an OWN
       property, so nothing is polluted by asking. Used by the authors editor
       and by the categories/tags editor below, because the question is the
       same one and the answer must not be two different answers. */
    function idUsable(resolve, id) {
        if (typeof resolve !== 'function') return true;
        var probe = {};
        probe[id] = { name: 'probe' };
        return !!resolve(probe, id);
    }

    /* A usable id, treating one the engine would refuse exactly like one
       already taken: the NAME the author typed is kept, and the id gets a
       suffix. "Constructor" stays "Constructor" and becomes `constructor-2`. */
    function authorSlugId(name, taken) {
        var base = slugify(name) || 'author';
        var id = base, n = 2;
        while (Object.prototype.hasOwnProperty.call(taken, id) ||
               !idUsable(CMS.content && CMS.content.authorFrom, id)) {
            id = base + '-' + n; n += 1;
        }
        return id;
    }

    function buildAuthors() {
        var host = $('#authorsHost');
        if (!host) return;
        host.innerHTML = '';
        var all = CMS.data().authors;
        if (!all || typeof all !== 'object') { all = CMS.data().authors = {}; }
        var ids = Object.keys(all).sort();
        if (!ids.length) {
            var p = document.createElement('p');
            p.className = 'hint';
            p.textContent = 'No authors yet. A page without one publishes no byline, which is ' +
                            'correct for an ordinary page.';
            host.appendChild(p);
            return;
        }
        /* How many pages name each author, so removing one says what it costs.
           COUNTED IN A PROTOTYPE-FREE MAP. A stored author id is arbitrary
           text, and in a plain object `uses['constructor']` reads back
           Object.prototype.constructor -- a function -- so `(fn || 0) + 1`
           was string concatenation and the card read
           "function Object() { [native code] }11 pages name them".
           Object.create(null) inherits nothing, so a key is a key and a
           count is a number. */
        var pages = CMS.data().pages || {};
        var uses = Object.create(null);
        Object.keys(pages).forEach(function (k) {
            var a = sstr((pages[k] || {}).author);
            if (a) uses[a] = (uses[a] || 0) + 1;
        });

        ids.forEach(function (id) {
            var a = all[id];
            if (!a || typeof a !== 'object') return;
            var card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-author', id);

            var head = document.createElement('div');
            head.className = 'pb-bar';
            var code = document.createElement('code');
            code.textContent = id;
            head.appendChild(code);
            var used = document.createElement('small');
            used.className = 'hint';
            used.textContent = uses[id]
                ? uses[id] + (uses[id] === 1 ? ' page names them' : ' pages name them')
                : 'no page names them';
            head.appendChild(used);
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'adm-btn ghost snip';
            del.innerHTML = '<i class="fas fa-trash"></i> Remove';
            del.addEventListener('click', function () {
                if (!confirm(uses[id]
                    ? 'Remove this author? ' + uses[id] + ' page(s) refer to them, and those ' +
                      'references will stop resolving — no byline, rather than a broken one.'
                    : 'Remove this author?')) return;
                delete CMS.data().authors[id];
                markDirty();
                buildAuthors();
                buildPages();
                buildSeo();
            });
            head.appendChild(del);
            card.appendChild(head);

            var grid = document.createElement('div');
            grid.className = 'grid2';
            AUTHOR_FIELDS.forEach(function (f) {
                var wrap = document.createElement('label');
                wrap.className = 'f';
                var span = document.createElement('span');
                span.innerHTML = esc(f[1]) + '<br><small style="opacity:.6">' + esc(f[2]) + '</small>';
                var input = document.createElement('input');
                input.type = 'text';
                input.value = a[f[0]] == null ? '' : a[f[0]];
                input.addEventListener('input', function () {
                    var v = sstr(input.value);
                    if (v === '') delete a[f[0]]; else a[f[0]] = v;
                    markDirty();
                    paintSeoPreviews();
                });
                /* A name change renames the byline everywhere, so the lists
                   that show it are rebuilt when the field is left. */
                if (f[0] === 'name') {
                    input.addEventListener('change', function () { buildAuthors(); buildPages(); buildSeo(); });
                }
                wrap.appendChild(span);
                wrap.appendChild(input);
                grid.appendChild(wrap);
            });
            card.appendChild(grid);
            host.appendChild(card);
        });
    }

    /* ========================================================
       CATEGORIES AND TAGS (Phase 2F)
       --------------------------------------------------------
       One editor, driven twice: the two collections differ only in their
       label and in whether a description is worth offering, so there is one
       function rather than two that drift apart.

       The id is the stable handle a page stores, so it is set once when the
       entry is created and never edited afterwards -- renaming is what the
       name field is for, and it updates every page at once because no page
       stores a name. The slug is derived from the name and editable, and it
       is NOT a URL: nothing generates a page for it.
    ======================================================== */
    var TAXON_KINDS = {
        categories: { one: 'category', many: 'categories', host: '#categoriesHost',
                      describable: true },
        tags:       { one: 'tag', many: 'tags', host: '#tagsHost',
                      describable: false }
    };

    function taxonStore(kind) {
        var d = CMS.data();
        if (!d[kind] || typeof d[kind] !== 'object') d[kind] = {};
        return d[kind];
    }

    /* How many pages name each entry, so removing one says what it costs. */
    /* COUNTED IN A PROTOTYPE-FREE MAP, and the slug index below is built in
       one too. A stored id or slug is arbitrary text, and in a plain object
       `uses['constructor']` reads back Object.prototype.constructor -- a
       function. `(fn || 0) + 1` is then string concatenation, so a hand-edited
       record produced a nonsense use count, and `(bySlug[sl] || []).push(...)`
       threw outright and stopped the card list rendering. Object.create(null)
       inherits nothing, so a key is a key. */
    function taxonUses(kind) {
        var pages = CMS.data().pages || {};
        var uses = Object.create(null);
        Object.keys(pages).forEach(function (k) {
            var p = pages[k] || {};
            if (kind === 'categories') {
                var c = sstr(p.category);
                if (c) uses[c] = (uses[c] || 0) + 1;
            } else if (isArray(p.tags)) {
                var seen = Object.create(null);
                p.tags.forEach(function (raw) {
                    var t = sstr(raw);
                    if (!t || seen[t]) return;
                    seen[t] = 1;
                    uses[t] = (uses[t] || 0) + 1;
                });
            }
        });
        return uses;
    }

    /* The same question idUsable() answers for an author, asked of the
       taxonomy resolver. See idUsable() above for why it is asked this way. */
    function taxonIdResolvable(id) {
        return idUsable(CMS.content && CMS.content.taxonFrom, id);
    }

    function taxonNewId(name, taken) {
        var base = slugify(name) || 'item';
        var id = base, n = 2;
        /* An id the engine would refuse is treated exactly like one already
           taken: the NAME the author typed is kept, and the id gets a
           suffix. "Prototype" stays "Prototype" and becomes `prototype-2`. */
        while (Object.prototype.hasOwnProperty.call(taken, id) || !taxonIdResolvable(id)) {
            id = base + '-' + n; n += 1;
        }
        return id;
    }

    function buildTaxonomy(kind) {
        var def = TAXON_KINDS[kind];
        var host = $(def.host);
        if (!host) return;
        host.innerHTML = '';
        var all = taxonStore(kind);
        var ids = Object.keys(all).sort();
        if (!ids.length) {
            var p = document.createElement('p');
            p.className = 'hint';
            p.textContent = 'No ' + def.many + ' yet. Content without ' + def.many +
                            ' publishes exactly as it does now.';
            host.appendChild(p);
            return;
        }
        var uses = taxonUses(kind);
        /* Two entries with the same slug are not an error the build cares
           about -- nothing is addressed by slug -- but they are a sign an
           editor duplicated a topic, which IS worth saying. */
        var bySlug = Object.create(null);
        ids.forEach(function (id) {
            var sl = sstr((all[id] || {}).slug).toLowerCase();
            if (sl) (bySlug[sl] = bySlug[sl] || []).push(id);
        });

        ids.forEach(function (id) {
            var t = all[id];
            if (!t || typeof t !== 'object') return;
            var card = document.createElement('div');
            card.className = 'card';
            card.setAttribute('data-taxon', kind + ':' + id);

            var head = document.createElement('div');
            head.className = 'pb-bar';
            var code = document.createElement('code');
            code.textContent = id;
            head.appendChild(code);
            var used = document.createElement('small');
            used.className = 'hint';
            used.textContent = uses[id]
                ? uses[id] + (uses[id] === 1 ? ' page uses it' : ' pages use it')
                : 'no page uses it';
            head.appendChild(used);
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'adm-btn ghost snip';
            del.innerHTML = '<i class="fas fa-trash"></i> Remove';
            del.addEventListener('click', function () {
                if (!confirm(uses[id]
                    ? 'Remove this ' + def.one + '? ' + uses[id] + ' page(s) refer to it, and ' +
                      'those references will stop resolving — nothing shown, rather than ' +
                      'a broken label.'
                    : 'Remove this ' + def.one + '?')) return;
                delete taxonStore(kind)[id];
                markDirty();
                refreshTaxonomy();
                buildPages();
                buildSeo();
            });
            head.appendChild(del);
            card.appendChild(head);

            var dupes = bySlug[sstr(t.slug).toLowerCase()] || [];
            if (dupes.length > 1) {
                var warn = document.createElement('p');
                warn.className = 'hint';
                warn.innerHTML = '<i class="fas fa-triangle-exclamation"></i> Shares its slug ' +
                    'with <code>' + dupes.filter(function (x) { return x !== id; })
                        .map(esc).join('</code>, <code>') + '</code>. Nothing breaks — no page ' +
                    'is addressed by slug — but two ' + def.many + ' for one topic split it.';
                card.appendChild(warn);
            }

            var grid = document.createElement('div');
            grid.className = 'grid2';
            var fields = [['name', 'Name', 'What an editor and a reader see.'],
                          ['slug', 'Slug', 'Lowercase, hyphens. A stable handle, NOT a URL: ' +
                                           'no page is generated for it.']];
            if (def.describable) {
                fields.push(['description', 'Description',
                             'Optional, for editors. Not published anywhere today.']);
            }
            fields.forEach(function (f) {
                var wrap = document.createElement('label');
                wrap.className = 'f';
                var span = document.createElement('span');
                span.innerHTML = esc(f[1]) + '<br><small style="opacity:.6">' + esc(f[2]) + '</small>';
                var input = document.createElement('input');
                input.type = 'text';
                input.value = t[f[0]] == null ? '' : t[f[0]];
                input.addEventListener('input', function () {
                    var v = sstr(input.value);
                    if (f[0] === 'slug') v = slugify(v);
                    if (v === '') delete t[f[0]]; else t[f[0]] = v;
                    markDirty();
                });
                /* A name or slug change is visible in every list that shows
                   it, so those are rebuilt when the field is left. */
                if (f[0] !== 'description') {
                    input.addEventListener('change', function () {
                        refreshTaxonomy(); buildPages(); buildSeo();
                    });
                }
                wrap.appendChild(span);
                wrap.appendChild(input);
                grid.appendChild(wrap);
            });
            card.appendChild(grid);
            host.appendChild(card);
        });
    }

    function refreshTaxonomy() {
        buildTaxonomy('categories');
        buildTaxonomy('tags');
    }

    function pageContentModel(key, page) {
        var card = document.createElement('div');
        card.className = 'card';
        var h = document.createElement('h3');
        h.textContent = 'Content type';
        card.appendChild(h);

        var note = document.createElement('p');
        note.className = 'hint';
        note.textContent = 'Optional. An ordinary page needs none of this: leave it as Page and ' +
            'nothing below changes what this page publishes.';
        card.appendChild(note);

        var grid = document.createElement('div');
        grid.className = 'grid2';

        /* ---- type ---- */
        var types = (CMS.content && CMS.content.types) || {};
        var tWrap = document.createElement('label');
        tWrap.className = 'f';
        var tSpan = document.createElement('span');
        tSpan.innerHTML = 'Kind of page<br><small style="opacity:.6">An Article, Guide or Help ' +
            'page publishes Article data and an <code>og:type</code> of article. A Hub describes ' +
            'itself as a collection. A Page is what every page was before this existed.</small>';
        var tSel = document.createElement('select');
        Object.keys(types).forEach(function (t) {
            var o = document.createElement('option');
            o.value = t;
            o.textContent = types[t].label || t;
            tSel.appendChild(o);
        });
        tSel.value = CMS.content ? CMS.content.type(page) : 'page';
        tSel.addEventListener('change', function () {
            /* 'page' is what an empty value already means, so choosing it
               stores '' rather than a word that means the same thing. */
            page.type = tSel.value === 'page' ? '' : tSel.value;
            touchPage(page);
            buildPages();
            buildSeo();
        });
        tWrap.appendChild(tSpan);
        tWrap.appendChild(tSel);
        grid.appendChild(tWrap);

        /* ---- publishedAt ---- */
        var dWrap = document.createElement('label');
        dWrap.className = 'f';
        var dSpan = document.createElement('span');
        dSpan.innerHTML = 'First published<br><small style="opacity:.6">YYYY-MM-DD. Used only by ' +
            'the page kinds that are a piece of writing, and left out of the page entirely when ' +
            'it is empty or not a real date. Nothing fills this in for you.</small>';
        var dIn = document.createElement('input');
        dIn.type = 'text';
        dIn.placeholder = '2026-03-04';
        dIn.value = page.publishedAt == null ? '' : page.publishedAt;
        dIn.addEventListener('input', function () {
            var v = sstr(dIn.value);
            if (v === '') delete page.publishedAt; else page.publishedAt = v;
            touchPage(page);
        });
        dWrap.appendChild(dSpan);
        dWrap.appendChild(dIn);
        grid.appendChild(dWrap);

        /* ---- author ---- */
        var authors = (CMS.data().authors) || {};
        var ids = Object.keys(authors).sort();
        var aWrap = document.createElement('label');
        aWrap.className = 'f';
        var aSpan = document.createElement('span');
        aSpan.innerHTML = 'Author<br><small style="opacity:.6">From the authors on this brand. ' +
            'A reference to an author that no longer exists publishes no byline at all, rather ' +
            'than an empty one.</small>';
        var aSel = document.createElement('select');
        var none = document.createElement('option');
        none.value = '';
        none.textContent = ids.length ? '(nobody)' : '(no authors yet — add one under Authors)';
        aSel.appendChild(none);
        ids.forEach(function (id) {
            var o = document.createElement('option');
            o.value = id;
            o.textContent = sstr((authors[id] || {}).name) || id;
            aSel.appendChild(o);
        });
        /* A stored id that is not in the list any more is kept and shown, so
           saving this panel cannot quietly discard it. */
        var cur = sstr(page.author);
        if (cur && ids.indexOf(cur) === -1) {
            var o2 = document.createElement('option');
            o2.value = cur;
            o2.textContent = cur + ' (no such author)';
            aSel.appendChild(o2);
        }
        aSel.value = cur;
        aSel.addEventListener('change', function () {
            if (aSel.value === '') delete page.author; else page.author = aSel.value;
            touchPage(page);
            buildSeo();
        });
        aWrap.appendChild(aSpan);
        aWrap.appendChild(aSel);
        grid.appendChild(aWrap);

        /* ---- category (Phase 2F) ----
           One select, like the author. Only the content types that carry
           taxonomy offer it: a plain page is site furniture, and classifying
           it would add nothing while inviting thin topics. */
        var taxonOk = !!(CMS.content && CMS.content.taxonTypes &&
                         Object.prototype.hasOwnProperty.call(
                             CMS.content.taxonTypes, CMS.content.type(page)));
        var cats = taxonStore('categories');
        var catIds = Object.keys(cats).sort();
        var cWrap = document.createElement('label');
        cWrap.className = 'f';
        var cSpan = document.createElement('span');
        cSpan.innerHTML = 'Category<br><small style="opacity:.6">' + (taxonOk
            ? 'The one main topic. No category page is generated and nothing is added to the ' +
              'sitemap — it organises content and is the strongest signal for related content.'
            : 'Only an Article, Guide, Help page or Hub carries a category. Change the kind of ' +
              'page above to set one.') + '</small>';
        var cSel = document.createElement('select');
        cSel.disabled = !taxonOk;
        var cNone = document.createElement('option');
        cNone.value = '';
        cNone.textContent = catIds.length ? '(none)' : '(no categories yet — add one below)';
        cSel.appendChild(cNone);
        catIds.forEach(function (id) {
            var o = document.createElement('option');
            o.value = id;
            o.textContent = sstr((cats[id] || {}).name) || id;
            cSel.appendChild(o);
        });
        var curCat = sstr(page.category);
        /* A stored id that is no longer in the collection is kept and shown,
           so opening this panel cannot quietly discard it. */
        if (curCat && catIds.indexOf(curCat) === -1) {
            var cGhost = document.createElement('option');
            cGhost.value = curCat;
            cGhost.textContent = curCat + ' (no such category)';
            cSel.appendChild(cGhost);
        }
        cSel.value = curCat;
        cSel.addEventListener('change', function () {
            if (cSel.value === '') delete page.category; else page.category = cSel.value;
            touchPage(page);
            buildSeo();
        });
        cWrap.appendChild(cSpan);
        cWrap.appendChild(cSel);
        grid.appendChild(cWrap);
        card.appendChild(grid);

        /* ---- tags (Phase 2F) ----
           Checkboxes rather than a text box, for the same reason the related
           list uses them: a typed id that does not resolve publishes nothing
           and says nothing about why. */
        var tagAll = taxonStore('tags');
        var tagIds = Object.keys(tagAll).sort(function (a, b) {
            var an = sstr((tagAll[a] || {}).name).toLowerCase();
            var bn = sstr((tagAll[b] || {}).name).toLowerCase();
            return an < bn ? -1 : an > bn ? 1 : 0;
        });
        var tWrap2 = document.createElement('div');
        tWrap2.className = 'f';
        var tSpan2 = document.createElement('span');
        tSpan2.innerHTML = 'Tags<br><small style="opacity:.6">' + (taxonOk
            ? 'Reusable keywords. Two pages sharing two or more count as related; one shared ' +
              'tag deliberately does not. No tag page is generated.'
            : 'Only an Article, Guide, Help page or Hub carries tags.') + '</small>';
        tWrap2.appendChild(tSpan2);
        if (!taxonOk) {
            /* Nothing to offer, and saying why beats an empty box. */
        } else if (!tagIds.length) {
            var tNone = document.createElement('p');
            tNone.className = 'hint';
            tNone.textContent = 'No tags yet. Add some below.';
            tWrap2.appendChild(tNone);
        } else {
            var tBox = document.createElement('div');
            tBox.className = 'pb-parts pb-parts-col';
            var chosenTags = isArray(page.tags) ? page.tags.map(sstr) : [];
            tagIds.forEach(function (id) {
                var lab = document.createElement('label');
                lab.className = 'cb';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = chosenTags.indexOf(id) > -1;
                cb.addEventListener('change', function () {
                    var list = isArray(page.tags) ? page.tags.map(sstr) : [];
                    var at = list.indexOf(id);
                    if (cb.checked && at === -1) list.push(id);
                    if (!cb.checked && at > -1) list.splice(at, 1);
                    if (list.length) page.tags = list; else delete page.tags;
                    touchPage(page);
                    buildSeo();
                });
                lab.appendChild(cb);
                var tx = document.createElement('span');
                tx.textContent = sstr((tagAll[id] || {}).name) || id;
                lab.appendChild(tx);
                tBox.appendChild(lab);
            });
            tWrap2.appendChild(tBox);
        }
        /* A stored id no longer in the collection gets a ticked box of its
           own, for the same reason the category keeps its ghost option: a
           reference the panel does not show is a reference an editor cannot
           clear. Shown whether or not the collection has any live tags. */
        if (taxonOk) {
            var ghostIds = (isArray(page.tags) ? page.tags.map(sstr) : [])
                .filter(function (id, i, arr) {
                    return !!id && arr.indexOf(id) === i && tagIds.indexOf(id) === -1;
                });
            if (ghostIds.length) {
                var gBox = document.createElement('div');
                gBox.className = 'pb-parts pb-parts-col';
                ghostIds.forEach(function (id) {
                    var lab = document.createElement('label');
                    lab.className = 'cb';
                    var cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.checked = true;
                    cb.addEventListener('change', function () {
                        var list = isArray(page.tags) ? page.tags.map(sstr) : [];
                        var at = list.indexOf(id);
                        if (at > -1) list.splice(at, 1);
                        if (list.length) page.tags = list; else delete page.tags;
                        touchPage(page);
                        buildPages();
                        buildSeo();
                    });
                    lab.appendChild(cb);
                    var tx = document.createElement('span');
                    tx.textContent = id + ' (no such tag)';
                    lab.appendChild(tx);
                    gBox.appendChild(lab);
                });
                tWrap2.appendChild(gBox);
            }
        }
        card.appendChild(tWrap2);

        /* ---- related ---- */
        var rWrap = document.createElement('div');
        rWrap.className = 'f';
        var rSpan = document.createElement('span');
        rSpan.innerHTML = 'Related pages<br><small style="opacity:.6">Chosen, never guessed. ' +
            'Only this brand’s published, indexable pages are offered; a Page list element ' +
            'set to “the pages chosen for this page” renders them.</small>';
        rWrap.appendChild(rSpan);
        var pool = (CMS.content ? CMS.content.pages({ record: CMS.data(), indexableOnly: true,
                                                      exclude: key }) : []);
        if (!pool.length) {
            var em = document.createElement('p');
            em.className = 'hint';
            em.textContent = 'No other published page to link to yet.';
            rWrap.appendChild(em);
        } else {
            var box = document.createElement('div');
            box.className = 'pb-parts pb-parts-col';
            var chosen = isArray(page.related) ? page.related.map(sstr) : [];
            pool.forEach(function (r) {
                var lab = document.createElement('label');
                lab.className = 'cb';
                var cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = chosen.indexOf(r.key) > -1;
                cb.addEventListener('change', function () {
                    var list = isArray(page.related) ? page.related.map(sstr) : [];
                    var at = list.indexOf(r.key);
                    if (cb.checked && at === -1) list.push(r.key);
                    if (!cb.checked && at > -1) list.splice(at, 1);
                    if (list.length) page.related = list; else delete page.related;
                    touchPage(page);
                    buildSeo();
                });
                lab.appendChild(cb);
                var t = document.createElement('span');
                t.textContent = (r.title || r.label) + '  —  ' + (r.url || './');
                lab.appendChild(t);
                box.appendChild(lab);
            });
            rWrap.appendChild(box);
        }
        card.appendChild(rWrap);
        return card;
    }

    function isArray(v) { return Object.prototype.toString.call(v) === '[object Array]'; }

    function pageStatusField(page) {
        var wrap = document.createElement('label');
        wrap.className = 'f';
        var span = document.createElement('span');
        span.innerHTML = 'Publication<br><small style="opacity:.6">A draft page is not ' +
            'generated and is not listed in sitemap.xml. Published pages become ' +
            '<code>&lt;slug&gt;.html</code> on the next deploy.</small>';
        var sel = document.createElement('select');
        [['published', 'Published'], ['draft', 'Draft']].forEach(function (o) {
            var opt = document.createElement('option');
            opt.value = o[0];
            opt.textContent = o[1];
            sel.appendChild(opt);
        });
        var current = String(page.status == null ? '' : page.status).trim().toLowerCase();
        sel.value = (current === '' || current === 'published') ? 'published' : 'draft';
        sel.addEventListener('change', function () {
            page.status = sel.value;
            markDirty();
            buildPages();
            buildSeo();
        });
        wrap.appendChild(span);
        wrap.appendChild(sel);
        return wrap;
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
                /* The editable body preview this used to keep in step is
                   gone; heading and lead are their own fields and the page
                   itself is previewed in Content. */
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
            draftOnly: false,        /* a draft exists but nothing is published */
            sections: null           /* the published tree, for checks the markup cannot answer */
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
        /* Kept alongside the markup for the one question the markup cannot
           answer: an FAQ question with no answer renders (the panel is
           simply empty) but is deliberately left out of the FAQPage
           schema, so the only way to tell an author why is to compare the
           tree with what the schema reader accepted. */
        out.sections = pub;
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

        /* The renderer emits a JSON-LD block inside the mount for an FAQ,
           and textContent concatenates EVERY descendant text node -- script
           contents included. Left in, the schema's own JSON would be counted
           as page words, and on an otherwise empty page it would answer "is
           there anything at all" with yes. It is removed from this inert
           copy before anything is measured: these checks are about what a
           reader sees, and nobody reads a script. The schema is judged
           separately, from the section tree, further down. */
        if (body) {
            var scripts = body.querySelectorAll('script');
            for (var s = scripts.length - 1; s >= 0; s--) {
                if (scripts[s].parentNode) scripts[s].parentNode.removeChild(scripts[s]);
            }
        }

        if (builder) {
            if (content.draftPending)
                warn('This page has unpublished Page Builder changes. Everything below describes ' +
                     'what is PUBLISHED — press Publish in the Page Builder to make the draft live.');
            else
                /* It used to say "this is what search engines see", which was
                   only true of a crawler that ran JavaScript: the content was
                   not in the HTML the server sent. The build now bakes the
                   published sections into the page (docs/publishing.md), so
                   this is accurate -- and it names the deploy, because that is
                   when the static copy catches up. */
                ok('Page Builder content is published. It is in the HTML the site serves ' +
                   'from the next deploy, so a crawler reads it with or without JavaScript.');
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
            /* A link to a page that exists but is a DRAFT is a link to a
               404 until it is published, which is worse than a typo
               because nothing about the page looks wrong. */
            else {
                var target = null;
                Object.keys(pages).forEach(function (k) { if (pages[k].url === href) target = pages[k]; });
                if (target && window.SEOFiles && !SEOFiles.isPublished(target)) {
                    bad('Links to <code>' + esc(href) + '</code>, which is a DRAFT page. ' +
                        'The build generates no file for it, so the link is a 404 until it is published.');
                }
            }
        }

        /* ---- the Phase 2A elements, judged on what they rendered ----

           Read from the rendered HTML rather than from the section data,
           like every check above it: what reaches a reader is the markup,
           and a section tree that renders nothing is not a problem worth
           reporting twice. Each of these is a WARNING, not a blocker --
           an author decides what their page says. */

        /* A table with no header row gives a screen reader nothing to
           announce per cell, and a crawler no column names. */
        var tables = body ? body.querySelectorAll('.pb-table-t') : [];
        var noHead = 0, noCap = 0;
        for (i = 0; i < tables.length; i++) {
            if (!tables[i].querySelector('th')) noHead += 1;
            if (!tables[i].querySelector('caption')) noCap += 1;
        }
        if (tables.length) {
            if (noHead) warn(noHead + ' of ' + tables.length + ' table(s) have no header row. ' +
                             'Turn on “First row is a header row” so the columns have names.');
            else ok('Every table has a header row.');
            if (noCap) warn(noCap + ' of ' + tables.length + ' table(s) have no caption. ' +
                            'A caption is what a screen reader reads before the contents.');
        }

        /* A one-item list is a paragraph with a bullet in front of it. */
        var lists = body ? body.querySelectorAll('.pb-list') : [];
        var thin = 0;
        for (i = 0; i < lists.length; i++) {
            if (lists[i].querySelectorAll('.pb-list-item').length < 2) thin += 1;
        }
        if (thin) warn(thin + ' list(s) have only one item. A list of one reads as a ' +
                       'paragraph with a bullet in front of it.');

        /* A contents list whose links point at nothing is the one case here
           that is a fault rather than a judgement. */
        var tocs = body ? body.querySelectorAll('.pb-toc') : [];
        var deadLinks = 0;
        for (i = 0; i < tocs.length; i++) {
            var tl = tocs[i].querySelectorAll('.pb-toc-link');
            for (var t = 0; t < tl.length; t++) {
                var id = String(tl[t].getAttribute('href') || '').replace(/^#/, '');
                if (!id || !body.querySelector('[id="' + id.replace(/"/g, '') + '"]')) deadLinks += 1;
            }
        }
        if (tocs.length) {
            if (deadLinks) bad(deadLinks + ' contents link(s) point at a heading that is not on this page.');
            else ok('Every contents link points at a heading on this page.');
        }

        /* ---- the FAQ, and the schema it does or does not earn ----
           Counted through the renderer's own readers so this says what the
           page will really publish: pb-faq-item is what rendered, faqPairs
           is what the FAQPage block accepted. A question with no answer is
           the difference, and it is the one thing an author cannot see. */
        var faqItems = body ? body.querySelectorAll('.pb-faq-item').length : 0;
        if (faqItems && content.sections && CMS.sections.faqPairs) {
            var pairs = 0;
            try { pairs = CMS.sections.faqPairs(content.sections).length; } catch (e) { pairs = 0; }
            var short = faqItems - pairs;
            if (short > 0)
                warn(short + ' of ' + faqItems + ' FAQ question(s) have no answer, so they are left ' +
                     'out of this page’s FAQPage data for search engines. An answer is what ' +
                     'makes a question worth marking up.');
            if (pairs > 0)
                ok(pairs + ' FAQ question(s) are published as FAQPage data, in the HTML the site ' +
                   'serves — so a search engine can show them without running JavaScript.');
            else
                warn('This page has an FAQ but no complete question-and-answer pair, so it ' +
                     'publishes no FAQPage data.');
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

        /* ---------- the Phase 2C content model ----------
           Only the fields this phase activated, and only when they are set:
           a page that uses none of this must not collect a single new remark,
           which is what keeps the existing legacy pages clear. */
        contentChecksFor(key, p, ok, warn, bad);

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

    /* ========================================================
       CHECKS FOR THE CONTENT MODEL (Phase 2C)
       --------------------------------------------------------
       Each of these answers a question an author cannot answer by looking at
       the page, because the failure is silent: a type nobody recognises, a
       date the engine refuses, an author id that resolves to nothing, a
       related page that is a draft. The engine's own readers are asked -- not
       a second copy of their rules -- so a check can never disagree with what
       gets published.

       A page with none of these fields set produces NO output here at all.
    ======================================================== */
    function contentChecksFor(key, p, ok, warn, bad) {
        if (!CMS.content) return;
        var C = CMS.content;
        var rawType = sstr(p.type);
        var type = C.type(p);

        /* A CONTENT TYPE ON A PAGE THAT SHIPS WITH THE SITE.
           The panel no longer offers one there, so this can only arrive in a
           hand-edited record -- and it half-applies: the mount bakes the
           Article data, the committed template keeps its hardcoded og:type.
           Reported rather than silently honoured, because with no control on
           the page there is nothing else that would show it. */
        /* Only for a type that RESOLVES. An unrecognised one became 'page',
           so nothing half-applies and the check below is the one that
           describes it; saying "its Article data would say nonsense" there
           would describe something that does not happen. */
        if (rawType && type !== 'page' && (CMS.DEFAULTS.pages || {})[key]) {
            bad('This page ships with the site and has its own template, so a content type ' +
                'cannot be fully published for it: its Article data would say ' +
                '<code>' + esc(rawType) + '</code> while its <code>og:type</code> stays ' +
                '<code>website</code>. Clear the type on this page.');
        }

        /* A stored type the allow-list does not know silently became 'page',
           which means no Article data and no article og:type. */
        if (rawType && rawType.toLowerCase() !== type) {
            bad('Content type <code>' + esc(rawType) + '</code> is not one this site knows, so ' +
                'this page is published as an ordinary page. Pick one from the list.');
        } else if (rawType) {
            ok('Published as a ' + ((C.types[type] || {}).label || type) + '.');
        }

        var dated = !!(C.types[type] || {}).dated;

        /* publishedAt: wrong shape, impossible day, or set on a kind of page
           that never publishes one. */
        var rawDate = sstr(p.publishedAt);
        if (rawDate) {
            if (!C.isoDate(rawDate)) {
                bad('First published date <code>' + esc(rawDate) + '</code> is not a real ' +
                    'date in YYYY-MM-DD form, so it is left out of this page entirely.');
            } else if (!dated) {
                warn('This page has a first-published date, but a ' +
                     ((C.types[type] || {}).label || type) + ' does not publish one. Change the ' +
                     'kind of page, or the date will keep being ignored.');
            } else {
                ok('First published ' + esc(rawDate) + ', in the page’s Article data.');
            }
        }

        /* author: a reference that resolves to nothing publishes no byline. */
        var rawAuthor = sstr(p.author);
        if (rawAuthor) {
            var a = C.author(p, CMS.data());
            if (!a) {
                bad('This page names the author <code>' + esc(rawAuthor) + '</code>, which does ' +
                    'not resolve to an author with a name. No byline and no author data are ' +
                    'published — add the author, or clear the field.');
            } else if (!dated) {
                warn('This page names an author, but a ' +
                     ((C.types[type] || {}).label || type) + ' publishes no author data.');
            } else {
                ok('Author resolves to ' + esc(a.name) + '.');
            }
        }

        /* related: every reference the renderer would drop, and why. */
        if (isArray(p.related) && p.related.length) {
            var pages = CMS.data().pages || {};
            var kept = C.related(p, CMS.data(), key);
            var keptKeys = {};
            kept.forEach(function (r) { keptKeys[r.key] = 1; });
            var seen = {}, dropped = [];
            p.related.forEach(function (raw) {
                var k = sstr(raw);
                if (!k || keptKeys[k]) return;
                if (seen[k]) return;
                seen[k] = 1;
                var t = pages[k];
                var why = !t ? 'is not a page on this brand'
                        : k === key ? 'is this page itself'
                        : !C.isPublished(t) ? 'is a draft, so the build generates no file for it'
                        : !C.isIndexable(t) ? 'is set to noindex'
                        : C.fileName(t) === null ? 'has no address this build can create'
                        : 'cannot be linked to';
                dropped.push('<code>' + esc(k) + '</code> ' + why);
            });
            if (dropped.length) {
                warn('Related pages left out: ' + dropped.join('; ') + '.');
            }
            if (kept.length) {
                ok(kept.length + ' related page(s) resolve and are published with this page.');
            } else {
                warn('None of this page’s related pages resolve, so a Page list set to ' +
                     '“the pages chosen for this page” renders nothing here.');
            }
        }

        /* ---- CATEGORY AND TAGS (Phase 2F) ----
           Same principle as the author field above: a reference that does not
           resolve publishes nothing at all, so the only place an author can
           find out is here. */
        var taxonCarries = !!(C.taxonTypes &&
            Object.prototype.hasOwnProperty.call(C.taxonTypes, type));
        var rec2 = CMS.data();
        var rawCat = sstr(p.category);
        var rawTags = isArray(p.tags) ? p.tags.map(sstr).filter(function (t) { return !!t; }) : [];

        if (!taxonCarries && (rawCat || rawTags.length)) {
            /* The panel hides both controls for this kind of page, so this is
               a leftover from a type change or a hand-edited record. Nothing
               is published from it, and nothing is corrected either. */
            warn('This page has a category or tags stored, but a ' +
                 ((C.types[type] || {}).label || type) + ' does not publish them. They are ' +
                 'ignored until the kind of page changes.');
        } else if (taxonCarries) {
            if (rawCat) {
                var cat = C.category(p, rec2);
                if (!cat) {
                    bad('This page names the category <code>' + esc(rawCat) + '</code>, which ' +
                        'does not resolve to a category with a name. No category is published — ' +
                        'add it under Categories, or clear the field.');
                } else {
                    ok('Category resolves to ' + esc(cat.name) + '.');
                }
            }
            if (rawTags.length) {
                var keptTags = C.tags(p, rec2);
                /* Prototype-free, for the reason taxonUses() gives: a stored
                   tag id of "constructor" read back as truthy from a plain
                   object and the tag was silently left unreported. */
                var tagOk = Object.create(null);
                keptTags.forEach(function (t) { tagOk[t.id] = 1; });

                /* TWO DIFFERENT REASONS A TICKED TAG IS NOT PUBLISHED, and
                   they need different messages. Before this they shared one:
                   everything pageTags() did not return was reported as "does
                   not resolve", so with thirteen tags ticked the thirteenth
                   was reported as a tag that does not exist. It exists; the
                   CAP dropped it. That message sent an author looking for a
                   problem that was not there.

                     - unresolved: no such tag, or a tag with no name. Nothing
                       will ever publish it, so this is the author's to fix.
                     - over the cap: a real tag, in order, past the limit
                       pageTags() enforces. Publishing is working as designed;
                       the author simply chose more than it will take. */
                var tagSeen = Object.create(null), tagBad = [], tagOver = [];
                rawTags.forEach(function (id) {
                    if (tagOk[id] || tagSeen[id]) return;
                    tagSeen[id] = 1;
                    /* Resolvable but absent from the published set == the cap
                       took it. Asked of the engine's own resolver, so the two
                       cannot disagree about which tags are real. */
                    var t = C.taxonFrom(rec2.tags, id);
                    if (t) tagOver.push({ id: id, name: t.name });
                    else tagBad.push('<code>' + esc(id) + '</code>');
                });
                if (tagBad.length) {
                    warn('Tags left out because they do not resolve to a tag with a name: ' +
                         tagBad.join(', ') + '.');
                }
                if (tagOver.length) {
                    var capN = C.tagsMax;
                    warn((keptTags.length + tagOver.length) + ' of this page\u2019s tags resolve, ' +
                         'and only the first ' + capN + ' are published. ' +
                         (tagOver.length === 1 ? 'One was dropped: ' : tagOver.length +
                          ' were dropped: ') + tagOver.map(function (t) {
                             return '<code>' + esc(t.name) + '</code>';
                         }).join(', ') + '. Untick ' + tagOver.length +
                         ' to choose which ' + capN + ' are published.');
                }
                if (keptTags.length) {
                    ok(keptTags.length + ' tag(s) published with this page.');
                }
            }
            /* ONE tag and no category is the confusing case: the author has
               started, and automatic related content still finds nothing,
               because a single shared tag deliberately does not relate two
               pages. An article with NO taxonomy at all says nothing here --
               an absent field never produces a message anywhere else in this
               panel, and every new article would otherwise carry a warning
               before anybody had a chance to set anything. */
            if (!rawCat && rawTags.length === 1) {
                warn('With one tag and no category, automatic related content has nothing to ' +
                     'match on: two pages need the same category, or two tags in common. A ' +
                     'Page list set to fill automatically shows only the pages chosen by hand.');
            }
        }

        /* A hub that lists nothing is a hub with no reason to exist, and an
           author cannot see it from the page record. */
        if (type === 'hub') {
            var hubRows = 0;
            try {
                hubRows = C.pages({ record: CMS.data(), indexableOnly: true, exclude: key }).length;
            } catch (e) { hubRows = 0; }
            if (!hubRows) {
                warn('This is a Hub, but there is no other published page for a Page list on ' +
                     'it to show yet.');
            }
        }
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
                /* This row is about SEO, so it lands on Settings & SEO rather
                   than on whichever tab was last open. */
                activePageTab = 'settings';
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
            /* AN ADDRESS THE BUILD WILL NOT CREATE.

               slugify() above puts no limit on length, and the build refuses
               a file name longer than sixty-one characters before ".html" --
               so a long page name produced a record the deploy warned about
               and generated nothing for. Asked of the engine's own reader, so
               this cannot drift from what the build will do.

               A `bad` message rather than a silent trim: the slug is the
               author's, and quietly cutting it in half is worse than saying
               it is too long. The button below disables on `bad`. */
            if (CMS.content && CMS.content.fileName({ url: slug + '.html' }) === null) {
                msgs.push({ level: 'bad', msg: 'The address <code>' + esc(slug) + '.html</code> is too long for ' +
                            'the build to create: the slug is ' + slug.length + ' characters and 61 is the ' +
                            'most it can be. Shorten it; the page name above can stay as it is.' });
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

    /* The mount for a generated page stub.

       If this page already has published Page Builder content, the stub is
       written WITH it, rather than with an empty div that would need a deploy
       before a crawler could read anything. The markup comes from the renderer
       itself -- the same CMS.sections.renderInto the page and the build both
       use -- so the file a developer commits matches what the build would
       produce for it. */
    function mountHtml(key) {
        var indent = '            ';
        var sections = null;
        try { sections = CMS.sections.published(key); } catch (e) { sections = null; }
        if (!sections || !sections.length) {
            return indent + '<!-- Page Builder mount. Stays empty until sections are published. -->\n' +
                   indent + '<div data-cms-sections="' + esc(key) + '"></div>\n';
        }
        var host = document.createElement('div');
        CMS.sections.renderInto(host, sections);
        return indent + '<!-- Page Builder mount, carrying this page\u2019s published content. -->\n' +
               indent + '<div data-cms-sections="' + esc(key) + '" data-cms-baked="' +
               sections.length + '">' + host.innerHTML + '</div>\n';
    }

    function mountStyle(key) {
        var sections = null;
        try { sections = CMS.sections.published(key); } catch (e) { sections = null; }
        if (!sections || !sections.length) return '';
        var css = String(CMS.sections.css(sections) || '');
        return css ? '    <style id="cmsBuilder">' + css + '</style>\n' : '';
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
            /* The scoped styles for whatever this page already publishes, so a
               visitor without JavaScript sees it styled rather than only
               present. The engine replaces this element's contents wholesale
               from the same section array, so it cannot double anything. */
            mountStyle(key) +
            '</head>\n\n<body>\n\n' +
            shellRegion(shell, 'header', key) + '\n' +
            shellRegion(shell, 'nav', key) + '\n' +
            '    <!-- CONTENT -->\n' +
            '    <main class="info-main">\n' +
            '        <article class="info-article">\n' +
            '            <h1 data-cms-text="pages.' + e(key) + '.heading">' + e(p.heading) + '</h1>\n' +
            '            <p class="info-lead" data-cms-text="pages.' + e(key) + '.lead">' + e(p.lead) + '</p>\n' +
            '            <div class="info-body" data-cms-html="pages.' + e(key) + '.body"></div>\n' +
            mountHtml(key) +
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

        Object.keys(TAXON_KINDS).forEach(function (kind) {
            var def = TAXON_KINDS[kind];
            var btn = $(kind === 'categories' ? '#btnAddCategory' : '#btnAddTag');
            if (!btn) return;
            btn.addEventListener('click', function () {
                var name = prompt('The ' + def.one + '\u2019s name');
                if (name === null) return;
                name = sstr(name);
                if (!name) { toast('A ' + def.one + ' needs a name.', true); return; }
                var all = taxonStore(kind);
                /* The same name twice is almost always a mistake rather than
                   two topics, so it is refused with the existing one named. */
                var clash = Object.keys(all).filter(function (id) {
                    return sstr((all[id] || {}).name).toLowerCase() === name.toLowerCase();
                });
                if (clash.length) {
                    toast('A ' + def.one + ' called \u201c' + name + '\u201d already exists as "' +
                          clash[0] + '". Use that one.', true);
                    return;
                }
                var id = taxonNewId(name, all);
                all[id] = { name: name, slug: slugify(name) || id };
                markDirty();
                refreshTaxonomy();
                buildPages();
                buildSeo();
                toast(def.one.charAt(0).toUpperCase() + def.one.slice(1) +
                      ' added as "' + id + '". Pages refer to it by that id.');
            });
        });

        if ((b = $('#btnAddAuthor'))) b.addEventListener('click', function () {
            var name = prompt('The author\u2019s name');
            if (name === null) return;
            name = sstr(name);
            if (!name) { toast('An author needs a name.', true); return; }
            var all = CMS.data().authors;
            if (!all || typeof all !== 'object') all = CMS.data().authors = {};
            var id = authorSlugId(name, all);
            all[id] = { name: name };
            markDirty();
            buildAuthors();
            buildPages();
            buildSeo();
            toast('Author added as "' + id + '". Pages refer to them by that id.');
        });

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
                /* Said explicitly rather than left to the build's default for
                   a record that has none. A page is created to be published;
                   the switch below is how it stops being. */
                status: 'published',
                updatedAt: todayIso(),
                /* the generated stub carries a <div data-cms-sections>, so the
                   Page Builder can offer this page too */
                builderMount: true,
                /* The Phase 2C-A content-model fields, written empty for the
                   same reason `status` is written explicitly above: a record
                   this panel creates carries its whole shape rather than
                   relying on a default somewhere else to fill it in. Nothing
                   reads them yet and no control below edits them, so a page
                   created now behaves exactly as one created before they
                   existed. js/cms.js DEFAULTS explains what each one is for. */
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: []
            };
            markDirty();
            buildBuilder();
            $('#btnDownloadPage').hidden = false;
            $('#btnDownloadPage').setAttribute('data-key', slug);
            /* No longer "download this and add it to the site": the build
               generates <slug>.html from templates/cms-page.html for any
               published page with no committed template of its own. The
               download button stays as the escape hatch for turning a page
               into a committed template, which is a developer's choice and
               no longer a requirement. */
            toast('Page created. Publish, and the next deploy will generate ' +
                  CMS.data().pages[slug].url + ' and add it to the sitemap.');
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
                commitLocal();
                toast(p.label + ' palette applied. Review & Publish to make it live.');
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
               '   BRAND DEFAULTS — ' + CMS.get('branding.siteName', 'brand') + '\n' +
               '   Generated ' + new Date().toLocaleString() + ' by /admin\n' +
               '   Regenerate: /admin > Backup & Restore > Download brand defaults\n' +
               '\n' +
               '   These are the values a visitor sees BEFORE the published row\n' +
               '   loads, and the starting point for a new brand. Once this brand\n' +
               '   has been published, the published row is what visitors get and\n' +
               '   this file is the fallback beneath it.\n' +
               '   ============================================================ */\n' +
               'window.CMS_BRAND = ' + CMS.exportJSON() + ';\n' +
               brandProvenanceText();
    }

    /* ========================================================
       BUILD-SOURCE PROVENANCE
       ------------------------------------------------------
       A SEPARATE declaration, deliberately not part of CMS_BRAND:

         - CMS_BRAND is content, and the four-layer merge owns it.
         - This is a record of where that content came from. It is never
           merged, never edited in the CMS, and never published.

       publishedRowUpdatedAt comes from lastPublished.serverUpdatedAt -- the
       row's own timestamp as the server returned it on a CONFIRMED publish or
       a pull. That key is device-local and is stripped from the export, which
       is correct and unchanged; it is read here and written into this object
       instead, so the fact travels with the build source without becoming
       content.

       WHAT THE BUILD CAN PROVE WITH THIS: that the committed brand.js holds
       the sections this export recorded, for this brand. INTEGRITY -- a
       hand-edit, a bad merge, a half-applied export or another brand's file
       dropped in all fail. It CANNOT prove the export is still current; a
       publish that happened after it leaves no trace in the repository.
       tools/check-published.js is the only thing that can answer that, and it
       needs the network.
    ======================================================== */
    function brandProvenanceText() {
        var fp = CMS.sections.fingerprints();
        var last = CMS.data().lastPublished || {};
        var prov = {
            version: 1,
            brand: {
                siteId: CMS.brand.siteId(),
                host: CMS.brand.host()
            },
            /* '' when this browser has never confirmed a publish or a pull for
               this brand. Recorded as empty rather than guessed. */
            publishedRowUpdatedAt: sstr(last.serverUpdatedAt),
            exportedAt: new Date().toISOString(),
            builder: fp
        };
        return '\n/* Build-source provenance. NOT content: the build reads this to check\n' +
               '   that the sections above are the ones this export recorded, for this\n' +
               '   brand. It proves INTEGRITY, not freshness -- a CMS publish made after\n' +
               '   this export leaves no trace here. See docs/publishing.md and\n' +
               '   tools/check-published.js. */\n' +
               'window.CMS_BRAND_PROVENANCE = ' + JSON.stringify(prov, null, 2) + ';\n';
    }

    function refreshPublishSize() {
        var el = $('#publishSize');
        if (!el) return;
        var kb = brandFileText().length / 1024;
        el.textContent = 'Current file size: ' + (kb > 1024
            ? (kb / 1024).toFixed(2) + ' MB — large, because uploaded images are embedded.'
            : kb.toFixed(0) + ' KB.');
    }

    /* NOT a publish. This writes a file for a developer to commit; it reaches
       no server and changes no live site. It was called "Publish to every
       device" and was the most misleading control in this admin. */
    $('#btnBrandDefaults').addEventListener('click', function () {
        var blob = new Blob([brandFileText()], { type: 'application/javascript' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'brand.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('brand.js downloaded. This published nothing — commit it and deploy to change the defaults.');
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
        if (!confirm('Restore will replace everything currently saved in this browser. ' +
                     'It does not publish — you review and publish afterwards. Continue?')) return;
        if (!CMS.replace(obj)) { toast('Restore too large for storage.', true); return; }
        refreshAll();
        /* A restore is a local change like any other: it does not publish, and
           it leaves everything it restored as unpublished changes. */
        markDirty();
        toast('Backup restored to this browser. Review & Publish to make it live.');
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
    /* The one control that can reach Supabase. In phase 3 it opens the
       review sheet first; the network call stays exactly here either way, so
       there is one door and it is this one. */
    $('#btnReview').addEventListener('click', function () {
        if (!commitLocal()) return;
        if (!CMS.remote.enabled) {
            toast('Saved to this browser. Remote publishing is off in js/cms-config.js.');
            return;
        }
        openPublishReview();
    });

    /* RELOAD: answers "what is published?" and never destroys work.

       With nothing unpublished there is nothing to lose, so it takes the
       server's version wholesale. With unpublished changes it refreshes the
       published BASELINE only -- so the review sheet is accurate against what
       is on the server now, including anything another editor published -- and
       says plainly that the local changes are still here. Reload must not be a
       discard in disguise. */
    $('#btnReload').addEventListener('click', function () {
        var btn = $('#btnReload');
        if (!CMS.remote.enabled) {
            toast('Remote publishing is off, so there is no server to reload from.', true);
            return;
        }
        btn.disabled = true;
        /* Derived from the RECORD, not from the dirty flag. A change can exist
           without the flag having been set -- an import, a restore, any code
           path that wrote to the record without going through markDirty -- and
           trusting the flag would then let Reload quietly overwrite it. The
           change index is computed from what a publish would actually send, so
           it cannot miss one. */
        var hadLocal = dirty || CMS.changedAreas().areas.length > 0;
        var done = function () { btn.disabled = false; };
        if (!hadLocal) {
            CMS.remote.pull().then(function (data) {
                done();
                refreshAll();
                setPubState(data ? 'clean' : 'local');
                toast(data ? 'Reloaded the published content from the server.'
                           : 'Nothing is published for this brand yet.');
            }).catch(function (err) { done(); toast('Could not reach the server: ' + err.message, true); });
            return;
        }
        CMS.remote.baseline().then(function (res) {
            done();
            refreshAll();
            var n = CMS.changedAreas().areas.length;
            /* The state follows the RECORD after a reload, not whatever it said
               before. The published baseline has just moved, so what counts as
               outstanding may have changed -- including down to nothing, if
               someone else published the same edit. */
            setPubState(n ? 'local' : 'clean');
            toast(res.found
                ? 'Published state refreshed. Your ' + n + ' unpublished change' +
                  (n === 1 ? '' : 's') + ' are still here — use Discard local changes to drop them.'
                : 'Nothing is published for this brand yet. Your local changes are still here.');
        }).catch(function (err) { done(); toast('Could not reach the server: ' + err.message, true); });
    });

    /* DISCARD: destructive, named as such, and explicit about what survives. */
    $('#btnDiscardLocal').addEventListener('click', function () {
        var n = CMS.changedAreas().areas.length;
        var published = !!(CMS.data().lastPublished || {}).serverUpdatedAt;
        var msg = published
            ? 'Discard unpublished changes?\n\n' +
              'This discards ' + n + ' unpublished brand-level change' + (n === 1 ? '' : 's') +
              ' and restores the currently published server state.\n\n' +
              'Page Builder drafts will be kept.'
            : 'Nothing has been published for this brand yet, so there is no server ' +
              'state to go back to.\n\n' +
              'Restore the shipped defaults instead? This discards ' + n +
              ' unpublished change' + (n === 1 ? '' : 's') + ' in this browser.\n\n' +
              'Page Builder drafts will be kept.';
        if (!confirm(msg)) return;
        var btn = $('#btnDiscardLocal');
        btn.disabled = true;
        CMS.remote.discardLocal().then(function (res) {
            btn.disabled = false;
            refreshAll();
            setPubState('clean');
            toast(res && res.source === 'server'
                ? 'Local changes discarded. Showing the published content.'
                : 'Local changes discarded. Showing the shipped defaults — nothing is published yet.');
        }).catch(function (err) {
            btn.disabled = false;
            toast('Could not discard: ' + err.message, true);
        });
    });

    $('#admBurger').addEventListener('click', function () {
        $('#admSide').classList.toggle('open');
    });

    $$('.adm-nav-item').forEach(function (b) {
        b.addEventListener('click', function () { switchPanel(b.getAttribute('data-panel')); });
    });

    /* Guard while anything is unpublished OR a publish failed. `dirty` means
       "not published" now, so this is the same question asked two ways. */
    window.addEventListener('beforeunload', function (e) {
        if (!dirty && pubState !== 'failed') return;
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
            hint.textContent = 'Review & Publish writes to this brand\'s row and confirms it by ' +
                'reading the row back. Nothing else in this admin reaches the server.';
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
                    /* Freshly pulled: this browser matches the server. */
                    setPubState('clean');
                    toast('Signed in. Review & Publish now goes live.');
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

    /* Read-only, for the same reason ADMIN_REFRESH exists: the publishing
       invariants are about state that has no single element to read. `dirty`
       means "not published", which is the question the unload guard asks. */
    window.ADMIN_DIRTY = function () { return !!dirty; };
    /* Read-only: the generated page stub, so a test can assert it carries the
       page's published content rather than an empty mount. */
    window.ADMIN_NEW_PAGE_HTML = function (key) { return newPageHtml(key, null); };
    window.ADMIN_PUBSTATE = function () { return { state: pubState, error: pubError }; };

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
    /* The builder is handed commitLocal and stagePublish, never a generic
       commit. That is the enforcement, not the convention: there is no
       binding inside js/admin-builder.js that can reach Supabase, so no edit
       made there -- autosave, drag, template, recovery -- can publish. */
    var Builder = (typeof window.PBAdmin === 'function')
        ? window.PBAdmin({ $: $, esc: esc, toast: toast, commitLocal: commitLocal,
                           stagePublish: stagePublish, download: download })
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
        var brandName = CMS.get('branding.siteName', 'BRAND');
        $('#brandLabel').textContent = brandName;
        /* The tab title is shared markup, so it cannot carry a brand
           name of its own -- it is painted from the brand like the
           label beside it. */
        document.title = brandName + ' CMS — Admin';
        /* And WHICH brand that is, in the sidebar, on every screen -- not
           only on the Brands panel. */
        var hostLine = $('#brandHost');
        if (hostLine) {
            hostLine.textContent = CMS.brand.host() || 'no hostname';
            hostLine.title = 'Publishing to row "' + CMS.brand.siteId() + '"' +
                (CMS.brand.matched() ? '' : ' (this hostname is not a registered brand)');
            hostLine.className = 'adm-brand-host' +
                (CMS.brand.matched() && CMS.brand.agrees() ? '' : ' chk-warn');
        }
        buildBrands();
        updateStorageMeter();
        refreshPublishSize();
        paintRemoteStatus();
        dirty = false;
        $('#savedFlag').className = 'adm-saved';
    }

    /* ========================================================
       BRANDS PANEL
       --------------------------------------------------------
       Read-only, and driven entirely by CMS.brand, which in turn
       reads what js/cms-config.js resolved. Nothing here knows a
       brand name: a fourth brand appears in this list because it
       is in the registry, not because this function was edited.

       It exists because "which brand am I editing?" was previously
       answerable only by reading the URL, and the consequence of
       getting that wrong is overwriting another site's content.
    ======================================================== */
    function buildBrands() {
        var now = $('#brandNow');
        var list = $('#brandList');
        if (!now || !list) return;

        var b = CMS.brand;
        var host = b.host();
        var rows = [
            ['Brand name', esc(CMS.get('branding.siteName', '') || '(not set)')],
            ['Served from', host ? esc(host) : '(no hostname — opened as a file?)'],
            ['Content row', esc(b.siteId() || '(none)')],
            ['Media bucket', esc(b.bucket() || '(none)')],
            ['Browser storage', esc(b.storageSuffix() || '(unsuffixed — the original brand)')]
        ];
        var html = '<table class="brandtable"><tbody>' + rows.map(function (r) {
            return '<tr><th>' + r[0] + '</th><td><code>' + r[1] + '</code></td></tr>';
        }).join('') + '</tbody></table>';

        /* The states worth warning about, all of which mean "what you see is
           not the live site you may think it is". */
        if (!b.matched()) {
            html += '<p class="hint chk-warn"><strong>This hostname is not a registered brand.</strong> ' +
                'It is showing the default brand\'s content because something has to render — ' +
                'localhost, a preview URL or a file:// open all land here. Anything you publish ' +
                'goes to the row named above, so check it is the one you mean.</p>';
        }
        if (b.noindex()) {
            html += '<p class="hint chk-warn"><strong>This is a review build.</strong> ' +
                'Every page is <code>noindex,nofollow</code> and no sitemap is published. ' +
                'It is not, and must not become, a production site.</p>';
        }
        if (!b.agrees()) {
            html += '<p class="hint chk-warn"><strong>Configuration disagrees with the hostname.</strong> ' +
                'The registry maps <code>' + esc(host) + '</code> to row <code>' +
                esc(b.expectedSiteId()) + '</code> but the CMS is set to write <code>' +
                esc(b.siteId()) + '</code>. Publishing is refused until that is fixed.</p>';
        }
        now.innerHTML = html;

        var all = b.all();
        var cnt = $('#cntBrands');
        if (cnt) cnt.textContent = all.length;
        if (!all.length) {
            list.innerHTML = '<p class="hint">No brand registry is configured, so this deployment ' +
                'serves a single brand.</p>';
            return;
        }
        list.innerHTML = '<table class="brandtable"><thead><tr><th>Hostname</th>' +
            '<th>Content row</th><th>Media bucket</th><th></th></tr></thead><tbody>' +
            all.map(function (x) {
                return '<tr' + (x.current ? ' class="is-current"' : '') + '>' +
                    '<td><code>' + esc(x.host) + '</code></td>' +
                    '<td><code>' + esc(x.siteId) + '</code></td>' +
                    '<td><code>' + esc(x.bucket || '—') + '</code></td>' +
                    '<td>' + (x.current
                        ? '<strong>editing this one</strong>'
                        : '<a href="https://' + esc(x.host) + '/admin/" rel="noopener">open its CMS</a>') +
                    '</td></tr>';
            }).join('') + '</tbody></table>';
    }

    wireSeoButtons();
    wireBuilder();
    wirePublishReview();
    wirePageSubtabs();
    window.addEventListener('beforeunload', pbFlush);
    window.addEventListener('resize', pbFitPreview);
    refreshAll();
    /* Which site, and its publish state, before anything is touched. */
    paintPubState();

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
