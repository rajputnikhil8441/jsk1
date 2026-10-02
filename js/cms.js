/* ============================================================
   WHITE LABEL CMS + SEO ENGINE  (js/cms.js)
   ------------------------------------------------------------
   Loaded by index.html, login.html and /admin/index.html.
   Owns one master object in localStorage under CMS.KEY:

       whiteLabelCMS = { branding, colors, text, images, home, settings }

   The frontend never hardcodes branding again — this file paints
   CSS variables, text, images and repeatable lists onto the page.
   ============================================================ */
(function (window, document) {
    'use strict';

    /* The master record's localStorage name, scoped to this brand.

       js/cms-config.js resolves the suffix: '' for the brand whose data
       already lives under the bare name, ':<siteId>' for every other, so
       two brands sharing an origin cannot read each other's cache. The
       fallback keeps the historical name when CMS_STORAGE is absent --
       a page that loads this file without the config, or a test that
       stubs the config -- which is exactly the behaviour that existed
       before brands did.

       Everything downstream follows automatically: CMS.KEY, the storage
       meter in /admin, and the `storage` event listener at the bottom of
       this file all read this one variable. */
    var KEY = (window.CMS_STORAGE && typeof window.CMS_STORAGE.key === 'function')
        ? window.CMS_STORAGE.key('whiteLabelCMS')
        : 'whiteLabelCMS';

    /* ========================================================
       DEFAULTS — the SHAPE of a brand, with no brand in it
    ======================================================== */
    var DEFAULTS = {

        branding: {
            siteName: '',
            browserTitle: '',
            loginTitle: '',
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
            'footer.about': '',
            'footer.copyright': '',
            /* URL-encoded. Read by js/main.js for the WhatsApp links. */
            'support.whatsappMessage': '',
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

            baseUrl: '',
            siteName: '',

            /* %s is replaced by the page title. It is only applied when
               the page title does not already contain the site name, so
               a title you write in full is never doubled up. */
            titleTemplate: '',

            defaultTitle: '',
            defaultDescription: '',

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
                name: '',
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

        /* The reusable-section library. Device-local, exactly like
           builderDrafts: stripped from the publish payload and preserved
           across a pull. See docs/page-builder.md. */
        builderLibrary: { version: 1, items: [] },

        /* One recovery snapshot per page, taken immediately before the two
           actions that would otherwise throw work away for good. Device-
           local for the same reasons as the two above. */
        builderRecovery: {},

        /* PUBLISHING BOOKKEEPING. Device-local like the three above, and
           stripped from the publish payload AND from an export for the same
           reason: it describes THIS browser's relationship to the published
           row, not the brand's content.

             publishIndex   area -> short hash of what was last confirmed
                            published, so the review sheet can say exactly
                            what differs without keeping a second copy of
                            the whole record. A full snapshot would double a
                            payload that already carries base64 images, and
                            this record is already large enough to hit the
                            localStorage quota.

             lastPublished  { serverUpdatedAt, at } -- the row's own
                            updated_at exactly as the server returned it,
                            and when this browser last CONFIRMED a write.
                            Written only after read-back succeeds, so its
                            presence means the server agreed. */
        publishIndex: {},
        lastPublished: {},

        /* ----------------------------------------------------------
           GLOBAL FOOTER — the navigation/topic columns only.

           The footer's Brand and Support columns stay in
           tools/build-shell.js: they are not link lists. Brand carries a
           logo, a bound site name and the social icons; Support carries
           the WhatsApp link that paintWhatsApp() rewrites by element id.
           Modelling those here would mean modelling images, handles and
           id-bound behaviour, for no gain.

           What IS here is the part an editor actually changes: the
           columns of links between them. The shipped values below are
           byte-for-byte what tools/build-shell.js writes into the static
           HTML, so a browser with no saved footer, and a Supabase row
           without one, both render exactly what the file already shows.

           STATIC FIRST. The static markup is authoritative and is what a
           crawler reads. renderFooter() replaces those columns only when
           this data survives cleanFooter(); anything missing, empty,
           malformed or unsafe leaves the shipped HTML untouched.

           Two levels only: columns -> links. No sub-columns. A footer is
           navigation, not a place to grow a keyword farm.
        ---------------------------------------------------------- */
        footer: {
            version: 1,
            columns: [
                {
                    id: 'important',
                    title: 'Important Links',
                    enabled: true,
                    links: [
                        { id: 'imp-home',    label: 'Home',               href: './',                      enabled: true },
                        { id: 'imp-about',   label: 'About',              href: 'about.html',              enabled: true },
                        { id: 'imp-contact', label: 'Contact',            href: 'contact.html',            enabled: true },
                        { id: 'imp-rg',      label: 'Responsible Gaming', href: 'responsible-gaming.html', enabled: true },
                        { id: 'imp-privacy', label: 'Privacy Policy',     href: 'privacy-policy.html',     enabled: true }
                    ]
                },
                {
                    id: 'account',
                    title: 'Account',
                    enabled: true,
                    links: [
                        { id: 'acc-login',    label: 'Login',    href: 'login.html',    enabled: true },
                        { id: 'acc-register', label: 'Register', href: 'register.html', enabled: true }
                    ]
                }
            ]
        },

        /* ----------------------------------------------------------
           FUTURE CONTENT-MODEL FIELDS (Phase 2C-A)

           Five optional fields every page record carries, declared here so
           the merge chain supplies them to a record written before they
           existed. NOTHING READS THEM YET. They are inert by design: no
           renderer, no SEO computation, no schema block, no admin control
           looks at them, so a page that leaves them empty -- which is every
           page today -- behaves exactly as it did before they were added.

             type         which kind of content this page is. A NAME, to be
                          read through an allow-list when a reader exists;
                          never a value that reaches markup directly.
             publishedAt  when the content was first published, as the same
                          YYYY-MM-DD the sitemap's lastmod already requires.
                          Distinct from updatedAt, which already exists and
                          already moves on every edit.
             excerpt      a short summary written for a listing. Deliberately
                          NOT metaDescription: that is a meta tag, and one
                          field serving both would make a change to a search
                          snippet also change every card that links here.
             author       an id into the `authors` collection below, not a
                          name. A name stored per page would be a second
                          source of truth the moment it is edited.
             related      page keys this one points at, chosen by an author.
                          An array, so the merge replaces it wholesale rather
                          than blending two authors' lists.

           WHY HERE AND NOT IN A MIGRATION. The record is JSONB and the read
           path is merge(merge(DEFAULTS, CMS_BRAND), stored): a key added
           here is present for every brand and every stored record at once,
           with no row rewritten and no schema changed. An absent value and
           an empty value are the same thing to every reader above.
        ---------------------------------------------------------- */
        pages: {

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
                updatedAt: '',
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
                heading: '',
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
                updatedAt: '',
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
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
                updatedAt: '',
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
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
                updatedAt: '',
                url: 'about.html',
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
                heading: '',
                lead: '',
                body: ''
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
                updatedAt: '',
                url: 'contact.html',
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
                heading: '',
                lead: '',
                body: ''
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
                updatedAt: '',
                url: 'responsible-gaming.html',
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
                heading: '',
                lead: '',
                body: ''
            },

            'privacy-policy': {
                label: 'Privacy Policy',
                slug: 'privacy-policy',
                canonical: '',
                robots: { index: true, follow: true },
                og: { title: '', description: '', image: '' },
                twitter: { title: '', description: '', image: '' },
                breadcrumb: { label: 'Privacy Policy', show: true },
                schema: { webPage: true, breadcrumb: true, contactPage: false },
                inSitemap: true,
                updatedAt: '',
                url: 'privacy-policy.html',
                builderMount: true,
                type: '',
                publishedAt: '',
                excerpt: '',
                author: '',
                related: [],
                title: '',
                metaDescription: '',
                heading: '',
                lead: '',
                body: ''
            }
        },

        /* ----------------------------------------------------------
           AUTHORS (Phase 2C-A)

           The collection that `pages.<slug>.author` names an entry in, keyed
           the id it stores. EMPTY AND UNREAD at this stage: no admin panel
           writes it, nothing renders a byline, and no schema block mentions
           a Person. It is declared now so that the id on a page record has
           somewhere to point when a reader exists, and so a brand's authors
           arrive through the same per-brand record every other content key
           uses -- which is what makes them unable to leak between brands.

           A map rather than an array: a page stores an id, and a lookup by
           id should not be a scan. The shape of an entry is deliberately
           not fixed here, because fixing it before anything reads it would
           be guessing.
        ---------------------------------------------------------- */
        authors: {},


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

        /* ---- Page Builder global design (stage 6) ----
           Deliberately empty. Six of the ten colour roles are aliases of
           colours that already exist above, so storing anything here by
           default would duplicate them; a role only appears once someone
           overrides it FOR THE PAGE BUILDER, which is the only thing a
           value here affects. The four roles the site has no equivalent
           for, and every typography role, carry shipped constants in
           PB_COLOR_ROLES / PB_TYPO_ROLES rather than in saved data, so an
           older record that has no `design` key at all resolves exactly
           the same way. See docs/page-builder.md. */
        design: { colors: {}, typography: {} },

        /* Registration page — toggles + appearance (see /admin > Registration) */
        registerPage: {
            enabled: true,
            primary: '#3880bd',
            green: '#5cb85c',
            bg: '',
            radius: '5',
            greyBg: '#d5d5d5'
        },

        /* ---- Uploaded CMS media (milestone: media library) ----
           REPOSITORY ASSETS and UPLOADED CMS MEDIA are deliberately two
           different things in this CMS:

             REPOSITORY ASSETS   files committed under assets/, listed by
                                 assets/asset-manifest.json. A developer
                                 puts them there; they ship with the site
                                 and cannot be changed from the admin.
             UPLOADED CMS MEDIA  files an admin uploads at runtime into the
                                 configured Supabase Storage bucket. They
                                 live outside the repository and are named
                                 by THIS code, never by the uploader.

           Only the metadata lives here -- never the bytes. An entry is a
           pointer plus what the library needs to show a row without
           fetching the file. */
        media: { items: [] },

        settings: {
            preset: 'playzone',
            activeTheme: 'playzone',
            version: 2
        }
    };

    /* ========================================================
       DEVICE-LOCAL KEYS — ONE LIST, TWO CONSUMERS
       ------------------------------------------------------
       These five keys never leave this browser. Remote.publish() deletes
       them from the payload because every visitor downloads the published
       row with the anon key, and an export deletes them because a backup
       is the brand's content, not one machine's working state.

       It is ONE list on purpose. The two consumers used to disagree --
       publish() stripped three keys and exportJSON() stripped none -- so a
       downloaded file carried unpublished drafts and the section library
       that the admin panel promises never leave the device. A single
       constant makes that drift impossible.

       Remote.pull() reads the same list to decide what an incoming row
       must not overwrite.
    ======================================================== */
    var LOCAL_ONLY_KEYS = ['builderDrafts', 'builderLibrary', 'builderRecovery',
                           'publishIndex', 'lastPublished'];

    /* ========================================================
       STORAGE
    ======================================================== */
    function clone(o) { return JSON.parse(JSON.stringify(o)); }

    /* A copy with every device-local key removed. Used for the publish
       payload and for an export, so the two can never diverge. */
    function withoutLocalKeys(obj) {
        var out = clone(obj), i;
        for (i = 0; i < LOCAL_ONLY_KEYS.length; i++) delete out[LOCAL_ONLY_KEYS[i]];
        return out;
    }

    /* ========================================================
       WHAT WOULD THIS PUBLISH CHANGE?
       ------------------------------------------------------
       A map of area -> short hash, taken at the last confirmed publish (and
       seeded from the row on every pull, because the row IS what is
       published). Comparing today's hashes against it says which areas
       differ, without storing a second copy of the record.

       WHY NOT A FULL SNAPSHOT. This record already carries base64 images and
       is already close enough to the localStorage quota that the admin has a
       storage meter and a quota handler. Doubling it to answer "what
       changed?" would break saving to answer a question about saving.

       WHY IT OVER-REPORTS RATHER THAN UNDER-REPORTS. A hash is compared, not
       a value, so reordered keys read as a change. That is the safe
       direction: telling someone a colour will be published when it is
       identical costs them a glance, and the opposite costs them a
       surprise. An area missing from the index is likewise treated as
       changed, which is why the first publish from a browser lists
       everything -- nothing has been confirmed from here.

       updatedAt IS DELIBERATELY NOT HASHED. It moves whenever anything else
       in the page moves, so including it would report every page as changed
       every time and drown the real answer.
    ======================================================== */
    function shortHash(v) {
        var s = JSON.stringify(v === undefined ? null : v), h = 5381, i;
        for (i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        /* Length alongside the hash: two cheap signals beat one. */
        return h.toString(16) + ':' + s.length;
    }

    /* The addressable areas of a record, at the granularity the review sheet
       reads out. Everything above `pages` is one area per top-level key;
       `pages` is split per page and per concern, because "About changed" is
       not a useful thing to tell someone who edited a meta description. */
    function indexAreas(data) {
        var out = {}, k;
        for (k in data) {
            if (!Object.prototype.hasOwnProperty.call(data, k)) continue;
            if (LOCAL_ONLY_KEYS.indexOf(k) > -1) continue;
            if (k === 'pages') continue;
            out[k] = data[k];
        }
        var pages = data.pages || {}, slug;
        for (slug in pages) {
            if (!Object.prototype.hasOwnProperty.call(pages, slug)) continue;
            var p = pages[slug] || {};
            out['pages.' + slug + '.builder'] = p.builder || null;
            ['title', 'metaDescription', 'heading', 'lead', 'body'].forEach(function (f) {
                out['pages.' + slug + '.' + f] = p[f] === undefined ? null : p[f];
            });
            out['pages.' + slug + '.settings'] = {
                canonical: p.canonical, robots: p.robots, og: p.og, twitter: p.twitter,
                breadcrumb: p.breadcrumb, schema: p.schema, inSitemap: p.inSitemap,
                url: p.url, slug: p.slug, label: p.label, builderMount: p.builderMount
            };
        }
        return out;
    }

    function changeIndex(data) {
        var areas = indexAreas(data || load()), out = {}, k;
        for (k in areas) {
            if (Object.prototype.hasOwnProperty.call(areas, k)) out[k] = shortHash(areas[k]);
        }
        return out;
    }

    /* { everPublished, areas: [area, ...] } — derived from the SAME record
       that withoutLocalKeys(load()) would send, so the sheet cannot describe
       one thing while the payload carries another. */
    function changedAreas() {
        var st = load();
        var cur = changeIndex(st);
        var prev = st.publishIndex || {};
        var everPublished = Object.keys(prev).length > 0;
        var list = [], k;
        for (k in cur) {
            if (!Object.prototype.hasOwnProperty.call(cur, k)) continue;
            if (!everPublished || prev[k] !== cur[k]) list.push(k);
        }
        /* An area that existed at the last publish and is gone now is also a
           change -- a deleted page, for instance. */
        for (k in prev) {
            if (!Object.prototype.hasOwnProperty.call(prev, k)) continue;
            if (!Object.prototype.hasOwnProperty.call(cur, k)) list.push(k);
        }
        list.sort();
        return { everPublished: everPublished, areas: list };
    }

    /* ========================================================
       BUILD-SOURCE FINGERPRINT
       ------------------------------------------------------
       One published builder block -> one short string, using the SAME
       shortHash() the publish index uses. There is deliberately no second
       hashing system: the admin records these when it exports a brand's
       committed layer, the build recomputes them before baking, and
       tools/check-published.js recomputes them from the live row. Three
       callers, one algorithm.

       WHAT IS HASHED is exactly what the bake consumes: the schema version
       and the sections. Not `status` (a block only gets a fingerprint when it
       is published) and not `updatedAt` (a client-set date that moves without
       the content changing, which would make every export look different).

       WHAT A MATCH PROVES, and no more: the committed sections are the ones
       the export recorded. INTEGRITY. It says nothing about whether the row
       has been published again since -- that fact lives only in Supabase, and
       tools/check-published.js is the only thing that can ask.
    ======================================================== */
    function builderFingerprint(block) {
        if (!block || !isArr(block.sections)) return '';
        return shortHash({ schemaVersion: pbSchemaOf(block), sections: block.sections });
    }

    /* { slug: fingerprint } for every PUBLISHED block in a record. The same
       test publishedSections() and the baker apply, so the set of slugs here
       is the set the build will bake. */
    function builderFingerprints(data) {
        var st = data || load();
        var pages = (st && st.pages) || {};
        var out = {}, slug;
        for (slug in pages) {
            if (!Object.prototype.hasOwnProperty.call(pages, slug)) continue;
            var b = (pages[slug] || {}).builder;
            if (!b || b.status !== 'published' || !isArr(b.sections)) continue;
            out[slug] = builderFingerprint(b);
        }
        return out;
    }

    function refreshPublishIndex() {
        var st = load();
        st.publishIndex = changeIndex(st);
        return save();
    }

    /* Keys that are not data, whatever a JSON payload calls them.

       JSON.parse('{"__proto__":{...}}') makes __proto__ an ORDINARY OWN
       property, so the hasOwnProperty guard below lets it through -- and
       `out[k] = over[k]` for that key is not an assignment, it is a call
       to the prototype setter. Everything this file reads afterwards,
       get() included, then resolves names that were never in the object:
       a stored page, a stored colour, a stored anything.

       Object.prototype is never reached (the damage is confined to the
       object being built), but "confined" is not "safe" when the object
       being built is the whole CMS state. Both the Supabase row and
       localStorage arrive through here, so this is the one place the
       guard belongs. */
    function unsafeKey(k) {
        return k === '__proto__' || k === 'constructor' || k === 'prototype';
    }

    function merge(base, over) {
        var out = clone(base), k;
        if (!over) return out;
        for (k in over) {
            if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
            if (unsafeKey(k)) continue;
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
        paintDesign();      /* roles that alias a site colour follow it live */
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
        /* A deployment that must never be indexed says so once, here, and
           nothing downstream can undo it.

           This is not the same thing as a PAGE being noindex. It is the
           whole deployment: a staging or review host serving a copy of a
           real brand. Without it, noindex would have to live in the data,
           and the data is layered -- DEFAULTS < brand.js < the Supabase
           row < local edits -- so any layer above the one that set it
           could hand a review host back to the crawlers. A review copy
           being indexed is not a cosmetic bug: it competes with the real
           site for the real site's own terms.

           The flag is set by the generated brand.js of an environment
           build (see envPatched in tools/lib/brandkit.js) and is undefined
           everywhere else, so no existing deployment changes behaviour. */
        if (window.CMS_NOINDEX === true) return 'noindex,nofollow';

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

        /* The values come from seoTags() -- the same structure a build reads
           -- so this function APPLIES the SEO set and no longer also decides
           it. setMeta and setLink keep their own rule that an empty value
           leaves the tag the HTML shipped alone. */
        var tags = seoTags(page);
        tags.metas.forEach(function (m) { setMeta(m.attr, m.name, m.content); });
        tags.links.forEach(function (l) { setLink(l.rel, l.href); });
        writeSchema(tags.jsonLd);
    }

    /* ========================================================
       STRUCTURED DATA
       Written into the <script> tags the HTML already ships, so
       the markup stays valid with JavaScript disabled. A block is
       only replaced when the CMS can build a complete one, and a
       block that is switched off is emptied rather than left stale.
    ======================================================== */

    /* The one place @context is added, so a block read by a build and a block
       written into a page are the same JSON rather than nearly the same. */
    function ldContext(obj) {
        if (!obj) return null;
        obj['@context'] = 'https://schema.org';
        return obj;
    }

    /* One JSON-LD serialiser.

       The < escape is what makes the text safe to write into a <script>
       element in SERIALISED HTML: script contents are raw text, so a value
       holding </script> would otherwise close the block early. At runtime
       textContent never parses, so this costs nothing there -- but the
       section renderer's block is baked into the HTML a crawler reads, and
       one escape in one place is better than a second serialiser that
       remembers to do it. \u003c is the same JSON; a parser sees '<'. */
    function ldText(obj) {
        if (!obj) return '{}';
        return JSON.stringify(ldContext(obj), null, 2).replace(/</g, '\\u003c');
    }

    function writeLd(id, obj) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = ldText(obj);
    }

    /* ========================================================
       CONTENT TYPES (Phase 2C)
       --------------------------------------------------------
       Phase 2C-A put `type` on every page record and nothing read it. This
       is the reader, and it is an ALLOW-LIST for the same reason every other
       stored name in this file is: what reaches og:type and @type is the
       constant stored against the name, never the name itself. A record
       holding "<script>", "faq" or a word some later version writes resolves
       to 'page' and publishes exactly what a page published before types
       existed.

       Case and surrounding space ARE forgiven -- "Article" and " guide " are
       the type they obviously mean, and this value can be hand-edited in a
       row. What is not forgiven is a value that is not a string: an array
       stringifies to its one element, so ['article'] would otherwise have
       been accepted as an article.

       WHY 'page' AND '' ARE THE SAME THING. Every record written before this
       existed has type '', and an empty value must mean "an ordinary page"
       rather than "unknown" -- otherwise activating the field would change
       what every existing page publishes.

       WHY THERE IS NO 'faq' TYPE. The faq ELEMENT already emits FAQPage from
       its own content, validated and tested since Phase 2A. A type that also
       emitted FAQPage would put two of them on one page. A page of questions
       is an ordinary page carrying an faq element, exactly as before.

       `schema` names the block buildContentSchema() builds, '' for the pages
       that keep WebPage and nothing more. `dated` says whether a publication
       date is meaningful for this type at all, which is what stops a date
       typed onto a contact page from reaching anything.
    ======================================================== */
    var PB_CONTENT_TYPES = {
        page:    { label: 'Page',    og: 'website', schema: '',               dated: false },
        article: { label: 'Article', og: 'article', schema: 'Article',        dated: true  },
        guide:   { label: 'Guide',   og: 'article', schema: 'Article',        dated: true  },
        help:    { label: 'Help',    og: 'article', schema: 'Article',        dated: true  },
        hub:     { label: 'Hub',     og: 'website', schema: 'CollectionPage', dated: false }
    };

    /* What a listing element lists. Two sources, because there are two
       questions an author actually asks: "the pages I chose" and "every page
       of this kind". Anything else -- scoring, recency windows, popularity --
       is a ranking algorithm nobody can see into, and is deliberately absent. */
    var PB_LIST_SOURCES = { related: 1, type: 1 };

    function pageType(page) {
        var raw = page && page.type;
        /* A string, or nothing. Without this, String(['article']) is
           'article' and an array would name a content type. */
        if (typeof raw !== 'string') return 'page';
        var want = str(raw).toLowerCase();
        return pbPick(PB_CONTENT_TYPES, want) ? want : 'page';
    }

    function pageTypeDef(page) { return PB_CONTENT_TYPES[pageType(page)]; }

    /* og:type. Only the two values Open Graph actually defines for this
       content: 'article' for something written on a date, 'website' for
       everything else. Never a bare stored string. */
    function pageOgType(page) { return pageTypeDef(page).og; }

    /* ========================================================
       DATES
       --------------------------------------------------------
       The sitemap's lastmod has required YYYY-MM-DD since Phase 1, and this
       is the same shape -- but a regex alone accepts 2026-13-45, and a
       malformed date in JSON-LD is worse than an absent one. So the calendar
       is checked too, and anything that is not a real day resolves to '',
       which every caller below treats as "say nothing".
    ======================================================== */
    var ISO_DATE_RE = /^\d{4}-\d\d-\d\d$/;

    function isoDate(v) {
        var d = str(v);
        if (!ISO_DATE_RE.test(d)) return '';
        var parts = d.split('-'), y = +parts[0], m = +parts[1], day = +parts[2];
        var dt = new Date(Date.UTC(y, m - 1, day));
        if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 ||
            dt.getUTCDate() !== day) return '';
        return d;
    }

    /* A date only where the type says one is meaningful, so a publishedAt
       left on a page whose type changed back to 'page' stops being
       published rather than lingering in the markup. */
    function pagePublished(page) {
        return pageTypeDef(page).dated ? isoDate(page && page.publishedAt) : '';
    }

    function pageModified(page) {
        return pageTypeDef(page).dated ? isoDate(page && page.updatedAt) : '';
    }

    /* ========================================================
       AUTHORS
       --------------------------------------------------------
       `pages.<slug>.author` stores an id; `authors` holds the records. This
       resolves one against the other and returns null for every way that can
       fail: no id, no collection, no such id, not an object, no name. A
       reference that does not resolve publishes NOTHING -- no byline, no
       Person block, no empty markup where a name should be. An author
       nobody can name is not an author.

       Brand isolation is structural rather than checked: `authors` lives in
       the brand's own record, so there is no collection to read but this
       brand's, and a cross-brand id simply does not resolve.
    ======================================================== */
    var AUTHOR_MAX = 400;          /* a bio is a line or two, not an essay */

    function authorFrom(all, id) {
        var key = str(id);
        if (!key || unsafeKey(key)) return null;
        if (!all || typeof all !== 'object') return null;
        if (!Object.prototype.hasOwnProperty.call(all, key)) return null;
        var a = all[key];
        if (!a || typeof a !== 'object') return null;
        var name = str(a.name).slice(0, AUTHOR_MAX);
        if (!name) return null;
        var out = { id: key, name: name };
        var bio = str(a.bio).slice(0, AUTHOR_MAX);
        if (bio) out.bio = bio;
        /* Through the same two filters every other address and image in this
           file goes through: a data: URL is not fetchable by a crawler, and
           javascript: is not a link. */
        var img = crawlableImage(a.image);
        if (img) out.image = img;
        var url = pbUrl(a.url);
        if (url) out.url = url;
        return out;
    }

    function pageAuthor(page, record) {
        if (!page) return null;
        var rec = record || load();
        return authorFrom(rec && rec.authors, page.author);
    }

    /* ========================================================
       ONE PUBLISHED-PAGE READER
       --------------------------------------------------------
       Everything in Phase 2C that needs to know what pages exist -- related
       content, a hub listing, the admin's checks -- asks THIS, and nothing
       else grows a second opinion. There were already four partial answers
       in this codebase (the sitemap's audit, the baker's record reader, the
       admin's link picker, the builder's mount list), each correct for its
       own job and none reusable. This is the reusable one.

       WHAT IT TAKES. A record, explicitly. It does not reach for ambient
       state, because the baker shares ONE engine across every brand it
       builds: a reader that read whatever was last loaded would publish one
       brand's pages on another's site. The caller that knows which brand it
       is passes the record; there is no default that could be wrong.

       WHAT IT APPLIES, and each rule is the one the rest of the build
       already applies:
         - published only, by the same three rules js/seo-files.js and
           tools/lib/pbbake.js use (a test holds all three to one table);
         - a flat .html file name, or '' for the home page, because that is
           the only shape the generator creates and the sitemap advertises;
         - noindex pages dropped when the caller asks for indexable only,
           which is what a listing wants and a link picker does not.

       It is a pure function of its arguments and sorts deterministically,
       so two builds of one record produce the same bytes.
    ======================================================== */
    /* ------------------------------------------------------------
       THE SAME RULE THE GENERATOR APPLIES, AND NEVER A LOOSER ONE.

       tools/lib/brandkit.js PAGE_NAME_RE decides which files a build will
       actually create: /^[a-z0-9][a-z0-9-]{0,60}\.html$/ -- sixty-one
       characters before ".html", and case-SENSITIVE. This is that rule.

       Why it has to be this one and not a kinder one. js/seo-files.js is
       more permissive (eighty, case-insensitive) and gets away with it
       because sitemapAudit() is also handed the list of files the build
       produced, so a url the generator refused is dropped before it reaches
       the sitemap. The reader below has no such second gate: whatever it
       returns gets a link in the page and, for a hub, a url in the ItemList.
       At eighty it published both for a page the build had already refused
       to generate -- an href to a 404, and structured data asserting that
       404 exists, while the build's own warning said nothing was
       advertising it.

       So this is deliberately the STRICTER of the two, and a test pins it
       to the generator's own regex over a table of addresses: this may
       accept nothing the generator would reject.
       ------------------------------------------------------------ */
    var PAGE_FILE_RE = /^[a-z0-9][a-z0-9-]{0,60}\.html$/;

    /* 'published' | absent | '' => published. Anything else, including a
       value this version does not recognise, is not. The asymmetry is the
       point: wrongly hiding a page costs a missing page, wrongly showing one
       publishes something nobody approved. */
    function pageIsPublished(page) {
        var raw = (page && page.status != null) ? str(page.status).toLowerCase() : '';
        return raw === '' || raw === 'published';
    }

    /* The file a page becomes, '' for the home page, or null for a url this
       build would never create. */
    function pageFileName(page) {
        var u = str(page && page.url);
        if (u === '') return '';
        return PAGE_FILE_RE.test(u) ? u : null;
    }

    function pageIsIndexable(page) {
        var r = (page && page.robots) || {};
        return r.index !== false;
    }

    function pageSummary(key, page, record) {
        var file = pageFileName(page);
        var author = pageAuthor(page, record);
        return {
            key: key,
            type: pageType(page),
            url: file,
            /* What an <a href> on a built page says. The home page is './'
               because that is what every template already writes for it. */
            href: file === '' ? './' : file,
            label: str(page.label) || key,
            title: str(page.title),
            heading: str(page.heading),
            excerpt: str(page.excerpt),
            publishedAt: pagePublished(page),
            updatedAt: pageModified(page),
            author: author,
            indexable: pageIsIndexable(page),
            inSitemap: page.inSitemap !== false
        };
    }

    function publishedPages(opts) {
        opts = opts || {};
        var rec = opts.record;
        var pages = (rec && rec.pages) || {};
        var want = str(opts.type).toLowerCase();
        var only = want && pbPick(PB_CONTENT_TYPES, want) ? want : '';
        var out = [], k;
        for (k in pages) {
            if (!Object.prototype.hasOwnProperty.call(pages, k)) continue;
            if (unsafeKey(k)) continue;
            var p = pages[k];
            if (!p || typeof p !== 'object') continue;
            if (!pageIsPublished(p)) continue;
            if (pageFileName(p) === null) continue;
            if (opts.indexableOnly && !pageIsIndexable(p)) continue;
            if (only && pageType(p) !== only) continue;
            if (opts.exclude && k === opts.exclude) continue;
            out.push(pageSummary(k, p, rec));
        }
        /* Newest first, undated last, then by key. Total and deterministic:
           a listing that reordered between two builds of one record would
           change the HTML without the content changing. */
        out.sort(function (a, b) {
            if (a.publishedAt !== b.publishedAt) {
                if (!a.publishedAt) return 1;
                if (!b.publishedAt) return -1;
                return a.publishedAt < b.publishedAt ? 1 : -1;
            }
            return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
        });
        return out;
    }

    /* The pages a page's `related` list names, in the order the author put
       them, through the reader above -- so a draft, a noindex page, a bad
       url, a cross-brand id and a self-link all fall out without this
       needing an opinion of its own. */
    function relatedPages(page, record, selfKey) {
        if (!page || !isArr(page.related)) return [];
        var pool = publishedPages({ record: record, indexableOnly: true }), by = {}, i;
        for (i = 0; i < pool.length; i++) by[pool[i].key] = pool[i];
        var out = [], seen = {};
        for (i = 0; i < page.related.length && out.length < 24; i++) {
            var k = str(page.related[i]);
            if (!k || k === selfKey) continue;
            if (Object.prototype.hasOwnProperty.call(seen, k)) continue;
            if (!Object.prototype.hasOwnProperty.call(by, k)) continue;
            seen[k] = 1;
            out.push(by[k]);
        }
        return out;
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
        /* A hub IS a collection of pages, and CollectionPage is a subtype of
           WebPage -- so the type substitutes into this one block rather than
           adding a second page-level block beside it. Exactly what the
           contactPage flag has always done, for the same reason. */
        var kind = page.schema.contactPage ? 'ContactPage'
                 : pageType(page) === 'hub' ? 'CollectionPage'
                 : 'WebPage';
        var out = {
            '@type': kind,
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

    /* ========================================================
       ARTICLE (Phase 2C)
       --------------------------------------------------------
       For the three types that are a piece of writing: article, guide and
       help. A hub gets CollectionPage above instead, and an ordinary page
       gets nothing new -- which is why activating all of this changes no
       existing page's markup.

       WHAT IT REFUSES TO EMIT, and every one of these is a way a field can
       exist without being usable:
         - a type that is not one of the three;
         - schema.article turned off;
         - no headline, or no resolvable url (the same bar buildWebPage sets);
         - an author reference that does not resolve -- no Person, rather
           than a Person with no name;
         - a date that is not a real calendar day -- absent, rather than
           malformed;
         - an image a crawler cannot fetch.

       A block is built from what resolves and from nothing else. There is no
       placeholder, no invented date and no "unknown author".
    ======================================================== */
    var ARTICLE_TYPES = { article: 1, guide: 1, help: 1 };
    var HEADLINE_MAX = 110;

    function buildArticle(page, record) {
        if (!page || !page.schema) return null;
        if (!pbPick(ARTICLE_TYPES, pageType(page))) return null;
        if (page.schema.article === false) return null;

        var headline = (str(page.title) || str(page.heading)).slice(0, HEADLINE_MAX);
        var url = pageUrl(page);
        if (!headline || !url) return null;

        var out = { '@type': 'Article', headline: headline,
                    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
                    inLanguage: 'en' };

        var desc = str(page.excerpt) || computeDescription(page);
        if (desc) out.description = desc;

        var pub = pagePublished(page);
        var mod = pageModified(page);
        if (pub) out.datePublished = pub;
        if (mod) out.dateModified = mod;

        var a = pageAuthor(page, record);
        if (a) {
            var person = { '@type': 'Person', name: a.name };
            if (a.url) person.url = absUrl(a.url);
            if (a.image) person.image = a.image;
            out.author = person;
        }

        var img = crawlableImage(computeOg(page, 'image'));
        if (img) out.image = img;

        /* The brand's Organization, when the record has one worth stating.
           Reused rather than rebuilt: one definition of who publishes this. */
        var org = buildOrganization();
        if (org) {
            var pubr = { '@type': 'Organization', name: org.name };
            if (org.logo) pubr.logo = org.logo;
            out.publisher = pubr;
        }
        return out;
    }

    /* Breadcrumb schema is only emitted when the page actually shows a
       breadcrumb — Google requires the markup to match what is visible. */
    /* opts.breadcrumbNav answers "does this page show a breadcrumb trail?"
       without a DOM. Left out, the question is answered exactly as it always
       was -- by looking for the element -- so a browser behaves identically.
       It exists because a caller with no document (a build reading this file
       in Node) knows the answer from the HTML it is about to write and cannot
       get it from querySelector. */
    function buildBreadcrumb(page, opts) {
        if (!page || !page.schema || !page.schema.breadcrumb) return null;
        if (!page.breadcrumb || !page.breadcrumb.show) return null;
        var hasNav = (opts && opts.breadcrumbNav !== undefined)
            ? !!opts.breadcrumbNav
            : !!document.querySelector('.breadcrumb');
        if (!hasNav) return null;
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

    /* WHY THIS RUNS TWICE.

       Every page loads js/cms.js from its <head>, and the JSON-LD blocks
       sit a few lines BELOW that script tag. applyHead() therefore runs
       while those <script type="application/ld+json"> elements do not
       exist yet, getElementById() returns null, and writeLd() is a no-op
       -- so the schema toggles in /admin have never actually reached a
       page. The static blocks in the files are correct on their own, which
       is why nothing looked wrong, and they still are: this changes
       nothing for a crawler that runs no JavaScript.

       What it changes is that an admin who turns "BreadcrumbList schema"
       off now gets it turned off, and a page whose title is edited in the
       CMS gets that title in its WebPage block. One more pass, once the
       document has parsed, writing exactly what paintSeo() would have
       written. */
    function paintSchemaLate() {
        var key = pageKey();
        if (!key) return;
        var page = pageData(key);
        if (page) paintSchema(page);
    }

    /* The four blocks, as data, keyed by the element each one belongs in. */
    function schemaBlocks(page, opts) {
        return {
            ldOrganization: ldContext(buildOrganization()),
            ldWebSite:      ldContext(buildWebSite()),
            ldPage:         ldContext(buildWebPage(page)),
            ldBreadcrumb:   ldContext(buildBreadcrumb(page, opts)),
            /* Phase 2C. null for every page that is not one of the three
               writing types, which is why writeLd() leaves the element it
               would occupy carrying {} exactly as the others do when they
               cannot be built. opts.record lets a build hand over the brand
               record the author id resolves against; without it the live
               record is used, which is what a browser wants. */
            ldArticle:      ldContext(buildArticle(page, opts && opts.record))
        };
    }

    function writeSchema(blocks) {
        writeLd('ldOrganization', blocks.ldOrganization);
        writeLd('ldWebSite', blocks.ldWebSite);
        writeLd('ldPage', blocks.ldPage);
        writeLd('ldBreadcrumb', blocks.ldBreadcrumb);
        /* ldArticle is deliberately NOT written here. The section renderer
           emits it in the body, beside FAQPage and ItemList, so there is one
           emitter and no template anchor that could hold a second copy. It
           stays in schemaBlocks() because that is the DATA, which the admin's
           checks and the tests read. */
    }

    function paintSchema(page) {
        writeSchema(schemaBlocks(page));
    }

    /* ========================================================
       EVERY SEO VALUE THIS FILE WOULD PAINT, AS DATA
       --------------------------------------------------------
       WHY. paintSeo() below computes a page's title, description, robots,
       canonical, Open Graph, Twitter and JSON-LD and writes them into the
       document. A static build needs the SAME values to put in the HTML it
       generates, and the one thing it must not do is work them out again:
       two implementations of "what is this page's title" is two answers, and
       the one a crawler reads would be the wrong one.

       So the set is defined once, here, as data. paintSeo() applies it to a
       document; anything else -- a build running this file in Node, the
       admin's preview -- reads the same structure and does what it likes
       with it. There is no second algorithm to keep in step because there is
       no second algorithm.

       It touches no DOM. Hand it a page record (CMS.seo.page(slug) finds
       one) and it returns what that page's tags should say.

       Nothing brand-specific appears here or can: every value comes from the
       merged CMS record of whichever brand resolved, through get() and the
       page record. A brand name, domain or id would be data, and data lives
       in the record, not in this file.
    ======================================================== */
    function seoTags(page, opts) {
        var metas = [];
        function meta(attr, name, content) {
            metas.push({ attr: attr, name: name, content: str(content) });
        }

        meta('name', 'description', computeDescription(page));
        meta('name', 'robots', robotsValue(page));

        meta('property', 'og:site_name', get('seo.siteName', ''));
        /* Phase 2C: from the page's validated content type, never from the
           stored string. An ordinary page -- and every record whose type is
           '' -- still says 'website', which is what the templates hardcoded
           before this existed. */
        meta('property', 'og:type', pageOgType(page));
        meta('property', 'og:title', computeOg(page, 'title'));
        meta('property', 'og:description', computeOg(page, 'description'));
        meta('property', 'og:url', pageUrl(page));
        meta('property', 'og:image', crawlableImage(computeOg(page, 'image')));

        meta('name', 'twitter:card', get('seo.twitterCard', ''));
        meta('name', 'twitter:site', get('seo.twitterSite', ''));
        meta('name', 'twitter:title', computeTwitter(page, 'title'));
        meta('name', 'twitter:description', computeTwitter(page, 'description'));
        meta('name', 'twitter:image', crawlableImage(computeTwitter(page, 'image')));

        /* Verification tags: only ever written when a code is present, which
           the empty-value rule below already guarantees. */
        meta('name', 'google-site-verification', get('seo.verification.google', ''));
        meta('name', 'msvalidate.01', get('seo.verification.bing', ''));
        meta('name', 'yandex-verification', get('seo.verification.yandex', ''));

        return {
            title: computeTitle(page),
            metas: metas,
            links: [{ rel: 'canonical', href: pageUrl(page) }],
            jsonLd: schemaBlocks(page, opts)
        };
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
        /* Stage 6. Expands into the font properties below, so it is listed
           first: a rule emits declarations in this order, and an explicit
           value written later wins over the role's. */
        typography: ['', ''],
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
        gap:        ['--pbs-gap', 'px'],
        /* Stage 5. Line height is deliberately NOT a section token: every
           element sets its own, so a section-level value would never show.
           Letter spacing does reach them, because each element's rule falls
           back to `inherit`. */
        letterSpacing: ['--pbs-letter-spacing', 'px']
    };

    var PB_EL_TOKENS = {
        /* Stage 6 -- see the note on PB_SEC_TOKENS above. */
        typography: ['', ''],
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
        lineColor:  ['--pbe-line-color', ''],
        /* V2: column tracks. The value written is never the author's text;
           it is a constant looked up from PB_COL_LAYOUTS (see pbDecls). */
        columns:    ['--pbe-cols', ''],
        /* Stage 5 typography. Each element rule reads these with its own
           existing value as the fallback, so an element that has never been
           given one renders exactly as before. */
        lineHeight:    ['--pbe-line-height', ''],
        letterSpacing: ['--pbe-letter-spacing', 'px'],
        /* Container layout. `justify` writes --pbe-justify-CONTENT, not
           --pbe-justify: that name is already taken by the justify-self
           half of PB_SELF, and one property name for two meanings is how a
           value ends up read by the wrong rule. */
        direction:  ['--pbe-direction', ''],
        justify:    ['--pbe-justify-content', ''],
        alignItems: ['--pbe-align-items', ''],
        wrap:       ['--pbe-wrap', ''],
        minWidth:   ['--pbe-min-width', 'px']
    };

    /* Which controls actually do something for each element type. The admin
       builds its Design tab from this, so a control is never offered for an
       element whose CSS would ignore it. */
    var PB_EL_STYLE_KEYS = {
        heading: ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                  'align', 'bg', 'padding',
                  'margin', 'maxWidth', 'border', 'radius', 'shadow'],
        text:    ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                  'align', 'bg', 'padding',
                  'margin', 'maxWidth', 'border', 'radius', 'shadow'],
        image:   ['align', 'margin', 'maxWidth', 'height', 'border', 'radius', 'shadow'],
        button:  ['typography', 'bg', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                  'align', 'padding',
                  'margin', 'border', 'radius', 'shadow'],
        /* A card's title and text carry .pb-el of their own, which resets the
           element namespace -- so the card's line height would stop at the
           wrapper and never reach the words, and a typography role, which is
           mostly size and weight, would have nothing left to set. Letter
           spacing still reaches them, because that is an inherited CSS
           property and the children do not declare it. */
        card:    ['bg', 'color', 'letterSpacing', 'align', 'padding', 'margin',
                  'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        columns: ['columns', 'align', 'margin', 'maxWidth', 'gap'],

        /* V2 elements. Same rule as above: a key appears here only if the
           CSS below actually reads it, so the admin can never offer a
           control that does nothing. */
        divider:     ['lineWidth', 'lineStyle', 'lineColor', 'maxWidth', 'align', 'margin'],
        spacer:      ['height', 'maxWidth'],
        icon:        ['color', 'fontSize', 'align', 'bg', 'padding', 'margin', 'radius'],
        notice:      ['typography', 'bg', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                      'align', 'padding', 'margin',
                      'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        featureBox:  ['typography', 'bg', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                      'align', 'padding', 'margin',
                      'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        faq:         ['typography', 'bg', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                      'align', 'padding', 'margin',
                      'maxWidth', 'gap', 'border', 'radius', 'shadow'],
        socialLinks: ['color', 'fontSize', 'align', 'bg', 'padding', 'margin', 'gap', 'radius'],

        /* Phase 2A. Same rule as the V2 entries above: a key is here only
           because the CSS below reads it. A list gets `gap` because the
           rule sets row-gap from it; a table does not, because its spacing
           is cell padding, which is not an element-level control. */
        list:        ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                      'align', 'bg', 'padding', 'margin', 'maxWidth', 'gap',
                      'border', 'radius', 'shadow'],
        table:       ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                      'align', 'bg', 'padding', 'margin', 'maxWidth',
                      'border', 'radius', 'shadow'],
        toc:         ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
                      'align', 'bg', 'padding', 'margin', 'maxWidth', 'gap',
                      'border', 'radius', 'shadow'],

        /* Phase 2B. `columns` appears on the three that lay their items out
           in a grid, so they reuse the existing 13 track presets rather
           than inventing a column control of their own. */
        testimonials: ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'columns', 'border', 'radius', 'shadow'],
        stats:        ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'columns', 'border', 'radius', 'shadow'],
        plans:        ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'columns', 'border', 'radius', 'shadow'],
        gallery:      ['align', 'margin', 'maxWidth', 'gap', 'columns', 'minWidth',
                       'border', 'radius', 'shadow'],
        progress:     ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'border', 'radius', 'shadow'],
        tabs:         ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'border', 'radius', 'shadow'],
        carousel:     ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'minWidth', 'border', 'radius', 'shadow'],
        video:        ['align', 'margin', 'maxWidth', 'gap', 'border', 'radius', 'shadow'],

        /* Phase 2C. A listing is a grid of cards, so it gets the same
           grid controls the gallery has plus the typography roles the card
           types have. Nothing new in the token system. */
        pageList:     ['typography', 'color', 'fontSize', 'fontWeight', 'lineHeight',
                       'letterSpacing', 'align', 'bg', 'padding', 'margin', 'maxWidth',
                       'gap', 'columns', 'minWidth', 'border', 'radius', 'shadow']
    };

    /* The keys a SECTION reacts to. Derived from the section token map, so
       there is exactly one place that decides, and the admin cannot drift
       from it -- the "offer everything" fallback it used to have was how the
       divider and column controls ended up on sections. */
    var PB_SEC_STYLE_KEYS = (function () {
        var out = [], k;
        for (k in PB_SEC_TOKENS) {
            if (Object.prototype.hasOwnProperty.call(PB_SEC_TOKENS, k)) out.push(k);
        }
        return out;
    }());

    /* =====================================================
       UNTRUSTED SECTION DATA (milestone A)
       -----------------------------------------------------
       Reusable sections come back from a JSON file a person chose, and
       templates come from a code registry -- neither is as trustworthy as
       something the admin's own controls produced. Both go through here.

       The method is the same one the rest of this file uses: nothing is
       copied unless its key is on a list. A fresh object is BUILT from the
       input rather than the input being cleaned up in place, so a key that
       is not named below simply never exists in the result. That is what
       makes __proto__, constructor and prototype non-events: they are not
       on any list, so they are not copied, and the object being written
       into is a plain literal whose own keys are assigned directly.

       Values go through the same checks the renderer already applies --
       pbUrl for links, pbCssValue for style values, the icon, social,
       variant and heading-level allow-lists -- rather than a second set. */

    /* Ids address the generated CSS, so two must never collide. The counter
       covers duplicating a section, which mints several ids inside one
       millisecond -- the same reason the admin's own minter has one. */
    var pbIdSeq = 0;
    function pbNewId(prefix) {
        pbIdSeq += 1;
        return prefix + '_' + Date.now().toString(36) + pbIdSeq.toString(36) +
               Math.floor(Math.random() * 1e6).toString(36);
    }

    var PB_CONTENT_KEYS = {
        heading:     ['text', 'level'],
        /* `rich` turns on the inline marks pbInlineInto() reads; `tag`
           chooses the block element. Both are absent from everything
           already published, which is why nothing already published
           changes. */
        text:        ['text', 'rich', 'tag'],
        image:       ['src', 'alt', 'width', 'height', 'href', 'newTab'],
        button:      ['text', 'href', 'newTab'],
        card:        ['title', 'text', 'image', 'imageAlt', 'imageWidth', 'imageHeight',
                      'buttonText', 'buttonHref', 'buttonNewTab'],
        columns:     [],                       /* its containers are handled below */
        divider:     [],
        spacer:      [],
        icon:        ['icon', 'label', 'href', 'newTab'],
        notice:      ['variant', 'icon', 'text', 'linkText', 'href', 'newTab'],
        /* A feature box is this builder's call-to-action: icon or image, a
           heading, body copy and an action. The ONE thing it could not do
           was offer a second, quieter action beside the first -- so that is
           what was added, rather than a CTA element that would have been
           this one with a different name. */
        featureBox:  ['icon', 'image', 'imageAlt', 'title', 'titleLevel', 'text',
                      'linkText', 'href', 'newTab',
                      'linkText2', 'href2', 'newTab2'],
        faq:         ['single'],
        socialLinks: [],

        /* Phase 2A. A list's rows and a table's cells are repeating items,
           so they arrive through the items path below; what sits here is
           only the handful of scalars that describe the whole element.
           `cols` is the table's column count and is deliberately NOT named
           "columns": that key already means a layout on the columns element
           and in PB_EL_TOKENS, and one name for two things is how a value
           ends up read by the wrong reader. */
        list:        ['ordered', 'rich'],
        table:       ['caption', 'cols', 'header'],
        toc:         ['title', 'titleLevel', 'depth', 'ordered'],

        /* ---- Phase 2B ----
           Each of these is a repeating list of items plus a handful of
           scalars about the whole element, which is the shape the sanitiser
           already knows how to clean. None of them needs JavaScript to put
           its content on the page. */
        testimonials: ['headingLevel'],
        stats:        ['headingLevel'],
        plans:        ['headingLevel', 'featureLabel'],
        gallery:      ['captions'],
        progress:     ['label', 'value', 'max', 'showValue'],
        tabs:         ['rich'],
        carousel:     ['autoplay', 'interval', 'captions'],
        video:        ['url', 'title', 'caption', 'poster'],

        /* ---- Phase 2C ----
           The ONE listing element. `source` chooses what it lists -- the
           author's own `related` list, or every published page of one content
           type -- and everything else is presentation. There is deliberately
           no second element for related content, for a hub and for an
           archive: they are this one with a different source.

           `contentType` is NOT called `type`: that key already means the
           element's own kind everywhere else in this file, and one name for
           two things is how a value ends up read by the wrong reader. */
        pageList:     ['source', 'contentType', 'limit', 'title', 'titleLevel',
                       'excerpt', 'date', 'author', 'schema']
    };

    /* Which content keys hold a URL, and which hold a repeating list. */
    var PB_URL_KEYS = { src: 1, href: 1, image: 1, buttonHref: 1, url: 1,
                        /* Phase 2B: the feature box's second action, and a
                           plan card's. Listed here so they go through
                           pbUrl() like every other address. */
                        href2: 1, ctaHref: 1 };

    /* Content keys whose value is a name from a list rather than free text.
       The renderer already refuses an unrecognised one at render time, but
       an import is the moment to drop it: storing "constructor" as an icon
       name is inert and pointless, and validating here means the library
       only ever holds values the builder's own controls could have set.
       Each list is the renderer's own, never a second copy. */
    var PB_ENUM_KEYS = {
        icon:       function () { return PB_ICONS; },
        variant:    function () { return PB_NOTICE_VARIANTS; },
        titleLevel: function () { return PB_HEADING_LEVELS; },
        platform:   function () { return PB_SOCIAL; },
        level:      function () { return PB_ALL_LEVELS; },
        tag:        function () { return PB_TEXT_TAGS; },
        depth:      function () { return PB_TOC_DEPTHS; },
        /* Phase 2B. The heading inside a testimonial, a stat or a plan is a
           real heading, so its level is an author's choice -- validated
           against the same list every other level is. */
        headingLevel: function () { return PB_HEADING_LEVELS; },
        /* Phase 2C. Both are names, so both are membership tests: a stored
           source or content type this version does not know is dropped at
           import and refused at render, never passed through. */
        source:       function () { return PB_LIST_SOURCES; },
        contentType:  function () { return PB_CONTENT_TYPES; }
    };

    var PB_ALL_LEVELS = { h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 };

    function pbEnumOk(key, value) {
        var get = pbPick(PB_ENUM_KEYS, key);
        if (!get) return true;
        return !!pbPick(get(), String(value).toLowerCase());
    }
    /* The named cells one table row can hold. Eight is a cap, not a
       preference: a row is a fixed set of named scalars because pbScalar()
       refuses anything that is not a boolean, a number or a string, and
       that refusal is what stops a nested payload riding in on a content
       key. An array of cells would need a second kind of cleaning. */
    var PB_TABLE_MAX_COLS = 8;
    var PB_TABLE_KEYS = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
    /* How many feature rows a plan card can list, for the same reason a
       table row has named cells: a scalar cannot hold a newline. */
    var PB_PLAN_FEATURES = 6;

    var PB_ITEM_KEYS = {
        faq:         ['question', 'answer', 'open'],
        socialLinks: ['platform', 'url', 'label'],
        list:        ['text'],
        table:       PB_TABLE_KEYS,

        /* Phase 2B. `image`/`src` are already URL keys, so they go through
           pbUrl() with every other address in this file. */
        testimonials: ['quote', 'name', 'role', 'company', 'image'],
        stats:        ['value', 'label', 'prefix', 'suffix'],
        gallery:      ['src', 'alt', 'caption'],
        /* A plan's feature rows are named cells for the same reason a
           table's are: pbScalar() refuses a control character, so a
           newline-delimited list cannot be stored at all, and an array of
           strings would need a second kind of cleaning. Six is a cap on a
           pricing card, not a limit on what can be said. */
        plans:        ['title', 'subtitle', 'price', 'period', 'highlight',
                       'ctaText', 'ctaHref', 'ctaNewTab',
                       'f1', 'f2', 'f3', 'f4', 'f5', 'f6'],
        tabs:         ['label', 'text', 'open'],
        carousel:     ['title', 'text', 'image', 'alt', 'href', 'linkText']
    };

    /* A row that lost one of these is not a row the renderer could draw, so
       it is dropped rather than stored as something an author would have to
       notice is broken. */
    var PB_ITEM_REQUIRED = {
        faq:         ['question'],
        socialLinks: ['platform', 'url'],
        list:        ['text'],
        /* No cell is required: a blank cell in the middle of a table is
           real data, not a broken row. A row with NOTHING in it is still
           dropped, because the loop below keeps only rows that kept a
           value. */
        table:       [],

        /* Phase 2B. Each names the one thing without which the row is not
           the thing it claims to be: a testimonial with no quote, a stat
           with no number, an image with no source. A plan needs a title,
           because that is what a reader chooses between. */
        testimonials: ['quote'],
        stats:        ['value'],
        gallery:      ['src'],
        plans:        ['title'],
        /* A tab with no label is a tab nobody can press. A slide with
           neither words nor a picture is an empty slide. */
        tabs:         ['label'],
        carousel:     []
    };

    /* A single stored value: kept as a boolean, a finite number or a string
       with anything that could terminate an attribute stripped out. Objects
       and arrays are refused, which is what stops a nested payload riding in
       on a content key. */
    function pbScalar(v) {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return isFinite(v) ? v : null;
        if (typeof v !== 'string') return null;
        if (/[\u0000-\u001f\u007f]/.test(v)) return null;
        return v.length > 4000 ? v.slice(0, 4000) : v;
    }

    function pbCleanContent(type, raw) {
        var out = {}, keys = pbPick(PB_CONTENT_KEYS, type) || [], i, k, v;
        if (!raw || typeof raw !== 'object') return out;
        for (i = 0; i < keys.length; i++) {
            k = keys[i];
            if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
            v = pbScalar(raw[k]);
            if (v === null) continue;
            /* A URL that the renderer would refuse is dropped here rather
               than stored, so nothing downstream has to remember to check. */
            if (Object.prototype.hasOwnProperty.call(PB_URL_KEYS, k)) {
                v = pbUrl(v);
                if (!v) continue;
            }
            if (!pbEnumOk(k, v)) continue;
            out[k] = v;
        }
        var items = pbPick(PB_ITEM_KEYS, type);
        if (items && isArr(raw.items)) {
            var list = [];
            for (i = 0; i < raw.items.length && i < 100; i++) {
                var src = raw.items[i];
                if (!src || typeof src !== 'object') continue;
                var row = {}, kept = 0;
                for (var j = 0; j < items.length; j++) {
                    var ik = items[j];
                    if (!Object.prototype.hasOwnProperty.call(src, ik)) continue;
                    var iv = pbScalar(src[ik]);
                    if (iv === null) continue;
                    if (Object.prototype.hasOwnProperty.call(PB_URL_KEYS, ik)) {
                        iv = pbUrl(iv);
                        if (!iv) continue;
                    }
                    if (!pbEnumOk(ik, iv)) continue;
                    row[ik] = iv;
                    kept += 1;
                }
                var need = pbPick(PB_ITEM_REQUIRED, type) || [];
                var whole = true;
                for (var n = 0; n < need.length; n++) {
                    if (!Object.prototype.hasOwnProperty.call(row, need[n])) whole = false;
                }
                if (kept && whole) list.push(row);
            }
            out.items = list;
        }
        return out;
    }

    /* Style and responsive maps, filtered to the keys this node's renderer
       reads and to values that survive the checks it would apply anyway. */
    function pbCleanStyle(raw, allow) {
        var out = {}, i, k, v;
        if (!raw || typeof raw !== 'object') return out;
        for (i = 0; i < allow.length; i++) {
            k = allow[i];
            if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
            v = pbScalar(raw[k]);
            if (v === null) continue;
            v = str(v);
            if (!v) continue;
            /* A key whose value is a NAME from a list is validated against
               that list, for the same reason pbCleanContent() validates an
               icon name: the renderer already refuses an unrecognised one,
               but an import is the moment to drop it, so the stored data
               only ever holds values the builder's own controls could have
               set. "constructor" as a flex direction is inert either way;
               it is also pointless to keep. */
            if (Object.prototype.hasOwnProperty.call(PB_STYLE_ENUMS, k)) {
                if (!pbPick(PB_STYLE_ENUMS[k], v.toLowerCase())) continue;
                out[k] = v.toLowerCase();
                continue;
            }
            /* A global design reference is legal here; anything else has to
               pass the ordinary value check. */
            if (v.charAt(0) === '@') {
                if (k === 'typography') { if (!pbPick(PB_TYPO_ROLES, v.slice(1))) continue; }
                else if (!pbColorRef(v)) continue;
            } else if (!pbCssValue(v)) {
                continue;
            }
            out[k] = typeof raw[k] === 'number' ? raw[k] : v;
        }
        return out;
    }

    /* Does this object hold anything? Used to keep a cleaned container as
       small as it was: an empty style map is not written at all. */
    /* The hide-on-this-size classes for a node, or ''.

       Sections have had this since V2. Elements and containers had not,
       which meant an author could hide a whole band on a phone but not the
       one button inside it that did not fit. Same three booleans, same
       absent-means-shown rule, and the same CSS -- so there is one idea of
       what hidden means rather than three.

       Written only when something is actually hidden, so a node that was
       never given visibility data gets no class and renders as before. */
    /* The three booleans, kept only where one of them is false. Returning
       null for "nothing to say" is what keeps an untouched node's stored
       shape unchanged. */
    function pbCleanVisibility(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var out = {}, any = false, keys = ['desktop', 'tablet', 'mobile'];
        for (var i = 0; i < keys.length; i++) {
            if (raw[keys[i]] === false) { out[keys[i]] = false; any = true; }
        }
        return any ? out : null;
    }

    function pbHideClasses(vis) {
        if (!vis || typeof vis !== 'object') return '';
        var out = '';
        if (vis.desktop === false) out += ' pb-hide-desktop';
        if (vis.tablet  === false) out += ' pb-hide-tablet';
        if (vis.mobile  === false) out += ' pb-hide-mobile';
        return out;
    }

    function pbHasKeys(o) {
        if (!o || typeof o !== 'object') return false;
        for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) return true; }
        return false;
    }

    function pbCleanResponsive(raw, allow) {
        var out = {};
        if (!raw || typeof raw !== 'object') return out;
        if (raw.tablet) out.tablet = pbCleanStyle(raw.tablet, allow);
        if (raw.mobile) out.mobile = pbCleanStyle(raw.mobile, allow);
        return out;
    }

    function pbCleanElement(raw, depth) {
        if (!raw || typeof raw !== 'object' || depth > 3) return null;
        var type = str(raw.type);
        /* Unknown types are refused outright rather than carried along: an
           import is the one place where dropping the unrecognised is safer
           than keeping it for a future version to understand. */
        if (!pbPick(PB_ELEMENTS, type)) return null;
        var allow = pbPick(PB_EL_STYLE_KEYS, type) || [];
        var out = {
            id: pbCssId(raw.id) || pbNewId('el'),
            type: type,
            content: pbCleanContent(type, raw.content),
            style: pbCleanStyle(raw.style, allow),
            responsive: pbCleanResponsive(raw.responsive, allow)
        };
        if (raw.enabled === false) out.enabled = false;
        /* Hidden on a screen size, as a section can be. Written only when
           something is hidden, so an element saved before this existed
           cleans to the bytes it always did. */
        var evis = pbCleanVisibility(raw.visibility);
        if (evis) out.visibility = evis;
        if (type === 'columns') {
            var cols = ((raw.content || {}).columns);
            var kept = [];
            if (isArr(cols)) {
                for (var i = 0; i < cols.length && i < 12; i++) {
                    var src = cols[i] || {};
                    /* A container carries style of its own now. The keys
                       are written only when there is something in them, so
                       a container saved before this existed cleans to the
                       same bytes it always did. */
                    var box = { elements: pbCleanElements(src.elements, depth + 1) };
                    var cvis = pbCleanVisibility(src.visibility);
                    if (cvis) box.visibility = cvis;
                    var cstyle = pbCleanStyle(src.style, PB_CONTAINER_STYLE_KEYS);
                    if (pbHasKeys(cstyle)) box.style = cstyle;
                    var cresp = pbCleanResponsive(src.responsive, PB_CONTAINER_STYLE_KEYS);
                    if (pbHasKeys(cresp.tablet) || pbHasKeys(cresp.mobile)) {
                        box.responsive = {};
                        if (pbHasKeys(cresp.tablet)) box.responsive.tablet = cresp.tablet;
                        if (pbHasKeys(cresp.mobile)) box.responsive.mobile = cresp.mobile;
                    }
                    kept.push(box);
                }
            }
            out.content.columns = kept;
        }
        return out;
    }

    function pbCleanElements(raw, depth) {
        var out = [];
        if (!isArr(raw)) return out;
        for (var i = 0; i < raw.length && i < 200; i++) {
            var el = pbCleanElement(raw[i], depth);
            if (el) out.push(el);
        }
        return out;
    }

    function pbCleanSection(raw) {
        if (!raw || typeof raw !== 'object') return null;
        var type = str(raw.type);
        if (!pbPick(PB_SECTION_CLASS, type)) return null;
        var allow = PB_SEC_STYLE_KEYS;
        var vis = raw.visibility && typeof raw.visibility === 'object' ? raw.visibility : {};
        return {
            id: pbCssId(raw.id) || pbNewId('sec'),
            type: type,
            enabled: raw.enabled !== false,
            visibility: {
                desktop: vis.desktop !== false,
                tablet: vis.tablet !== false,
                mobile: vis.mobile !== false
            },
            style: pbCleanStyle(raw.style, allow),
            responsive: pbCleanResponsive(raw.responsive, allow),
            elements: pbCleanElements(raw.elements, 0)
        };
    }

    /* The public entry point: any array of section-shaped data in, a clean
       array out. Never throws, never returns the input. */
    function pbCleanSections(raw) {
        var out = [];
        if (!isArr(raw)) return out;
        for (var i = 0; i < raw.length && i < 200; i++) {
            var sec = pbCleanSection(raw[i]);
            if (sec) out.push(sec);
        }
        return out;
    }

    /* Fresh ids throughout, so an inserted copy can never address the same
       generated CSS rule as the thing it was copied from. */
    function pbReidSections(sections) {
        function walk(list, depth) {
            if (!isArr(list) || depth > 4) return;
            for (var i = 0; i < list.length; i++) {
                var el = list[i];
                if (!el) continue;
                el.id = pbNewId('el');
                var cols = (el.content || {}).columns;
                if (isArr(cols)) {
                    for (var j = 0; j < cols.length; j++) walk((cols[j] || {}).elements, depth + 1);
                }
            }
        }
        for (var i = 0; i < (sections || []).length; i++) {
            sections[i].id = pbNewId('sec');
            walk(sections[i].elements, 0);
        }
        return sections;
    }

    /* ---- V2: column layout presets ----    /* ---- V2: column layout presets ----
       A layout is chosen by NAME from this map. The value emitted into
       grid-template-columns is always the constant string stored here, so
       no author-entered text can ever reach that property. The second
       entry is how many column containers the preset expects, which the
       admin uses to keep the containers and the tracks in step.

       The key is also the wire format stored in style.columns, so these
       names are part of the saved data: do not rename an existing one. */
    var PB_COL_LAYOUTS = {
        '1':          ['1fr', 1],
        '2':          ['1fr 1fr', 2],
        '2-30-70':    ['30fr 70fr', 2],
        '2-70-30':    ['70fr 30fr', 2],
        '2-40-60':    ['40fr 60fr', 2],
        '2-60-40':    ['60fr 40fr', 2],
        '2-25-75':    ['25fr 75fr', 2],
        '2-75-25':    ['75fr 25fr', 2],
        '3':          ['1fr 1fr 1fr', 3],
        '3-25-50-25': ['25fr 50fr 25fr', 3],
        '3-50-25-25': ['50fr 25fr 25fr', 3],
        '3-25-25-50': ['25fr 25fr 50fr', 3],
        '4':          ['1fr 1fr 1fr 1fr', 4]
    };

    /* =====================================================
       PAGE BUILDER GLOBAL DESIGN (stage 6)
       -----------------------------------------------------
       Ten semantic colour roles and eight typography roles that a
       section or element can reference by name -- "@primary" rather than
       "#0088cc" -- so changing the global value moves everything that
       points at it.

       WHERE THE VALUES COME FROM. Six of the colour roles are aliases of
       colours the site already has; the Colors panel stays their single
       source of truth and this layer never copies them. The other four
       name concepts the site has no colour for, so they carry a shipped
       constant here. Either way a role can be overridden in
       design.colors, and that override reaches the Page Builder ONLY:
       it is written to a --pbg-* property that nothing outside the
       builder reads, so setting the builder's Primary cannot repaint the
       navigation, the odds table or the footer.

       HOW A REFERENCE REACHES THE PAGE. A stored "@primary" is emitted
       as var(--pbg-primary, <shipped constant>), never as the resolved
       colour, so every element that references a role is updated by one
       :root block rather than by regenerating its rule. The fallback in
       that var() is the constant from this map, so a page whose design
       block never loaded still renders a sensible colour instead of
       nothing.

       SECURITY. A name is only ever a key into these maps, read with
       hasOwnProperty, and what gets emitted is built from the map -- the
       stored text itself never reaches the stylesheet. An unrecognised
       name emits no declaration at all, which leaves the element's
       shipped default in charge. */

    /* role -> [existing colors key it aliases (null if none), shipped value] */
    var PB_COLOR_ROLES = {
        primary:    ['hdr-bg',     '#0088cc'],
        secondary:  [null,         '#5a6b7c'],
        text:       ['text',       '#222222'],
        muted:      ['text-dim',   '#777777'],
        border:     ['border',     '#d4d4d4'],
        background: ['page-bg',    '#eef0f3'],
        surface:    ['content-bg', '#ffffff'],
        success:    [null,         '#1e7e34'],
        warning:    [null,         '#b8860b'],
        danger:     [null,         '#c62828']
    };

    /* role -> the shipped typography it stands for. The heading numbers are
       the same ones css/sections.css already falls back to, so pointing a
       heading at its matching role changes nothing until the role is
       edited. */
    var PB_TYPO_ROLES = {
        body:   { fontSize: '16px', fontWeight: '400', lineHeight: '1.6',  letterSpacing: 'inherit' },
        h1:     { fontSize: '34px', fontWeight: '700', lineHeight: '1.25', letterSpacing: 'inherit' },
        h2:     { fontSize: '28px', fontWeight: '700', lineHeight: '1.25', letterSpacing: 'inherit' },
        h3:     { fontSize: '22px', fontWeight: '700', lineHeight: '1.25', letterSpacing: 'inherit' },
        h4:     { fontSize: '19px', fontWeight: '700', lineHeight: '1.25', letterSpacing: 'inherit' },
        h5:     { fontSize: '17px', fontWeight: '700', lineHeight: '1.25', letterSpacing: 'inherit' },
        h6:     { fontSize: '15px', fontWeight: '700', lineHeight: '1.25', letterSpacing: 'inherit' },
        button: { fontSize: '15px', fontWeight: '600', lineHeight: '1.2',  letterSpacing: 'inherit' }
    };

    /* Where a role has an equivalent in the site's own typography system,
       that system stays its source, exactly as the Colors panel does for
       the six mapped colours. Only Body has one: TYPO_TARGETS has no h1-h6,
       and its headerBtns targets the site's own header buttons rather than
       anything the Page Builder draws, so mapping the Button role onto it
       would tie together two things an author thinks of separately. */
    var PB_TYPO_SITE = { body: 'base' };

    /* The four typography properties a role carries, and the --pbg-* suffix
       each one is published under. */
    var PB_TYPO_PROPS = {
        fontSize:      'size',
        fontWeight:    'weight',
        lineHeight:    'line',
        letterSpacing: 'letter'
    };

    function pbDesignBlock() {
        var d = load().design;
        return (d && typeof d === 'object') ? d : {};
    }

    /* What a colour role currently resolves to. Order: an override stored
       for the Page Builder, then the site colour it aliases, then the
       shipped constant. Anything that fails the value check is ignored
       rather than emitted, so a broken saved value cannot break the page. */
    function pbRoleColor(role) {
        var spec = pbPick(PB_COLOR_ROLES, role);
        if (!spec) return '';
        var own = (pbDesignBlock().colors || {})[role];
        var v = pbCssValue(own);
        if (v) return v;
        if (spec[0]) {
            v = pbCssValue((load().colors || {})[spec[0]]);
            if (v) return v;
        }
        return spec[1];
    }

    function pbRoleTypo(role, prop) {
        var spec = pbPick(PB_TYPO_ROLES, role);
        if (!spec) return '';
        function use(raw) {
            var v = pbCssValue(raw);
            if (!v) return '';
            if ((prop === 'fontSize' || prop === 'letterSpacing') && /^-?[0-9.]+$/.test(v)) v += 'px';
            return v;
        }
        var v = use(((pbDesignBlock().typography || {})[role] || {})[prop]);
        if (v) return v;
        var site = pbPick(PB_TYPO_SITE, role);
        if (site) {
            v = use(((load().typography || {})[site] || {})[prop]);
            if (v) return v;
        }
        return spec[prop];
    }

    /* The one :root block every reference points at. Repainted by
       paintVars(), so editing a site colour moves the roles that alias it
       without anything else having to know. */
    function designCSS() {
        var css = ':root{', role, prop;
        for (role in PB_COLOR_ROLES) {
            if (!Object.prototype.hasOwnProperty.call(PB_COLOR_ROLES, role)) continue;
            css += '--pbg-' + role + ':' + pbRoleColor(role) + ';';
        }
        for (role in PB_TYPO_ROLES) {
            if (!Object.prototype.hasOwnProperty.call(PB_TYPO_ROLES, role)) continue;
            for (prop in PB_TYPO_PROPS) {
                if (!Object.prototype.hasOwnProperty.call(PB_TYPO_PROPS, prop)) continue;
                css += '--pbg-' + role + '-' + PB_TYPO_PROPS[prop] + ':' +
                       pbRoleTypo(role, prop) + ';';
            }
        }
        return css + '}';
    }

    function paintDesign() {
        var tag = document.getElementById('cmsDesign');
        if (!tag) {
            tag = document.createElement('style');
            tag.id = 'cmsDesign';
            (document.head || document.documentElement).appendChild(tag);
        }
        tag.textContent = designCSS();
    }

    /* "@primary" -> var(--pbg-primary, #0088cc). Returns '' for anything
       that is not a role on the list, including every name inherited from
       Object.prototype. */
    function pbColorRef(raw) {
        var v = str(raw);
        if (v.charAt(0) !== '@') return '';
        var spec = pbPick(PB_COLOR_ROLES, v.slice(1));
        if (!spec) return '';
        return 'var(--pbg-' + v.slice(1) + ',' + spec[1] + ')';
    }

    /* A colour-valued style value: a role reference, or a literal that has
       to pass the ordinary value check. A reference that names nothing
       yields '' and the caller drops the declaration. */
    function pbColorValue(raw) {
        var v = str(raw);
        if (v.charAt(0) === '@') return pbColorRef(v);
        return pbCssValue(v);
    }

    /* The border shorthand keeps its own wire format, so a role reference
       arrives as the last word of "2px solid @primary". */
    function pbBorderValue(raw) {
        var v = pbCssValue(raw);
        if (!v || v.indexOf('@') === -1) return v;
        var parts = v.split(/\s+/);
        var last = parts[parts.length - 1];
        if (last.charAt(0) !== '@') return '';    /* @ anywhere else: refuse */
        var ref = pbColorRef(last);
        if (!ref) return '';
        parts[parts.length - 1] = ref;
        return parts.join(' ');
    }

    /* Reading an allow-list by a name that came from stored content.

       A bare map[name] is not a membership test: every object inherits
       "constructor", "toString" and the rest from Object.prototype, so
       PB_ICONS['constructor'] hands back a function, which then gets
       stringified into a class attribute. Every lookup keyed by author
       data goes through here. */
    function pbPick(map, name) {
        var k = str(name);
        if (!k || !Object.prototype.hasOwnProperty.call(map, k)) return null;
        return map[k] || null;
    }

    function pbColLayout(name) {
        var k = str(name);
        if (!k || !Object.prototype.hasOwnProperty.call(PB_COL_LAYOUTS, k)) return null;
        return PB_COL_LAYOUTS[k];
    }

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
    /* The block tags a text element may be. Both are ordinary prose
       containers; neither can hold anything the renderer does not build. */
    var PB_TEXT_TAGS = { p: 1, blockquote: 1 };

    /* ---- the only video hosts this builder will embed ----

       An <iframe> runs a third party's code in the page, so the address it
       is given can never be the author's string. Each entry recognises the
       addresses that host uses and returns the ID out of it; the embed URL
       is then BUILT from that id and a constant, so the only part of it
       that came from the record is an id matched by one of these patterns.

       Anything else -- another host, a shortened link, an address with a
       query string that happens to contain one of these -- yields nothing
       and the element falls back to a plain link.

       The nocookie and dnt forms are used where the host offers one: an
       embed should not set a tracking cookie on a visitor who only read a
       page. */
    var PB_VIDEO_HOSTS = [
        { name: 'YouTube',
          re: [/^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/,
               /^https?:\/\/(?:www\.)?youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{6,20})/,
               /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,20})/],
          embed: function (id) { return 'https://www.youtube-nocookie.com/embed/' + id; },
          watch: function (id) { return 'https://www.youtube.com/watch?v=' + id; } },
        { name: 'Vimeo',
          re: [/^https?:\/\/(?:www\.)?vimeo\.com\/(\d{6,12})/,
               /^https?:\/\/player\.vimeo\.com\/video\/(\d{6,12})/],
          embed: function (id) { return 'https://player.vimeo.com/video/' + id + '?dnt=1'; },
          watch: function (id) { return 'https://vimeo.com/' + id; } }
    ];

    /* { host, id, embed, watch } for an address one of them recognises,
       otherwise null. */
    function pbVideoRef(raw) {
        var u = str(raw);
        if (!u) return null;
        for (var i = 0; i < PB_VIDEO_HOSTS.length; i++) {
            var h = PB_VIDEO_HOSTS[i];
            for (var j = 0; j < h.re.length; j++) {
                var m = h.re[j].exec(u);
                if (m && m[1]) {
                    return { host: h.name, id: m[1],
                             embed: h.embed(m[1]), watch: h.watch(m[1]) };
                }
            }
        }
        return null;
    }
    /* How deep a table of contents goes, as the deepest level it lists.
       The value is the number the renderer compares against, so the
       allow-list and the limit are one thing rather than two. */
    var PB_TOC_DEPTHS = { h2: 2, h3: 3, h4: 4 };
    var PB_HEADING_LEVELS = { h2: 1, h3: 1, h4: 1, h5: 1, h6: 1 };

    /* Unique, valid HTML ids for the FAQ's aria wiring, even when an
       element's own id is missing or not selector-safe. */
    var pbAutoId = 0;
    function pbDomId(el, suffix) {
        var base = pbCssId(el && el.id);
        if (!base) { pbAutoId += 1; base = 'a' + pbAutoId; }
        return 'pb-' + base + '-' + suffix;
    }

    /* A heading's anchor id, or '' when its element id is not one an
       attribute selector could hold. Deliberately NOT pbDomId(): that
       invents an id when it has to, and an invented one is no use here --
       the table of contents has to work out the SAME id from the section
       tree, without having rendered anything. One rule, read twice, so a
       link can never point at an id the heading did not get. */
    /* A container's CSS address: its columns element plus its index. '' when
       the element id is not one an attribute selector could hold, which is
       the same condition that leaves an element without generated CSS. */
    function pbContainerRef(el, index) {
        var base = pbCssId(el && el.id);
        return base ? base + '-' + index : '';
    }

    function pbAnchorId(elId) {
        var base = pbCssId(elId);
        return base ? 'pb-' + base + '-h' : '';
    }

    /* An element's own box alignment, for the types that are laid out as a
       flex or grid item rather than as a block of text. */
    var PB_SELF = {
        left:   ['flex-start', 'start'],
        center: ['center', 'center'],
        right:  ['flex-end', 'end']
    };

    /* ---- container layout ----

       Each of these is a NAME, and what reaches the CSS is the constant
       stored against it -- the same rule PB_COL_LAYOUTS follows, for the
       same reason: no author-entered text can ever land in the property.
       An unrecognised name emits nothing, which leaves the shipped default
       in css/sections.css in charge.

       The keys are the wire format stored in a container's style, so they
       are part of the saved data: do not rename one.

       The names are the author's words, not CSS's. "start" and "between"
       are what a person picking an alignment means; flex-start and
       space-between are what the browser needs, and the translation lives
       here rather than in the admin. */
    var PB_DIRECTIONS = { column: 'column', row: 'row',
                          'column-reverse': 'column-reverse', 'row-reverse': 'row-reverse' };
    var PB_JUSTIFY = { start: 'flex-start', center: 'center', end: 'flex-end',
                       between: 'space-between', around: 'space-around',
                       evenly: 'space-evenly' };
    var PB_ALIGN_ITEMS = { stretch: 'stretch', start: 'flex-start', center: 'center',
                           end: 'flex-end', baseline: 'baseline' };
    var PB_WRAP = { nowrap: 'nowrap', wrap: 'wrap' };

    /* Which style keys are a name from a list rather than a measurement.
       pbDecls() reads this, so the guard is on the RENDER path -- the one
       place the whole-tree sanitiser deliberately does not run. */
    var PB_STYLE_ENUMS = { direction: PB_DIRECTIONS, justify: PB_JUSTIFY,
                           alignItems: PB_ALIGN_ITEMS, wrap: PB_WRAP };

    /* What a CONTAINER inside a columns element can be given.

       Same rule as PB_EL_STYLE_KEYS: a key is here only because the
       .pb-column rule in css/sections.css reads it, so the admin cannot
       offer a control that does nothing. `typography` is deliberately
       absent -- a container's children each carry .pb-el, which resets the
       element namespace, so a role set here would reach nothing. */
    var PB_CONTAINER_STYLE_KEYS = ['direction', 'justify', 'alignItems', 'wrap', 'gap',
                                   'bg', 'color', 'padding', 'margin',
                                   'maxWidth', 'minWidth', 'height',
                                   'border', 'radius', 'shadow', 'align'];

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

    /* =====================================================
       ASSET PATHS (milestone B)
       -----------------------------------------------------
       pbUrl() above answers "is this safe to put in an href or a src". It
       says yes to https://anywhere, which is right for a link an author
       typed and wrong for the asset picker, whose whole point is that it
       can only ever produce a file that is already in this repository.

       So this is a second, STRICTER question asked only of asset paths:
       is this one of ours? It is built on pbUrl rather than beside it --
       a path has to pass that first -- and then has to be a plain relative
       path, under a root that is already public, ending in a real image
       extension.

       The Image element itself keeps pbUrl, so a page that already names
       an image some other way goes on rendering. This is what the picker
       and the manifest are held to, not a new rule for old data. */

    var PB_ASSET_ROOTS = ['assets/images/', 'assets/icons/'];
    var PB_ASSET_EXT = /\.(png|jpe?g|gif|svg|webp)$/i;

    function pbAsset(raw) {
        var v = str(raw);
        if (!v) return '';
        /* Defence in depth, and honestly redundant today: the character
           class below already refuses everything pbUrl would (a scheme
           needs a colon, and a colon is not in it). It stays because pbUrl
           is the one place this project decides what a scheme may be, and
           relaxing the class later should not quietly reopen that. No test
           can tell it apart from its absence -- removing it alone breaks
           nothing, which is the point of saying so here. */
        if (pbUrl(v) !== v) return '';
        /* A traversal segment anywhere, however it is spelled. */
        if (v.indexOf('..') > -1) return '';
        /* No query, fragment, backslash or anything else exotic: an asset
           path is a plain file path and nothing else. */
        if (!/^[A-Za-z0-9][A-Za-z0-9._\/-]*$/.test(v)) return '';
        if (v.indexOf('//') > -1) return '';
        if (!PB_ASSET_EXT.test(v)) return '';
        for (var i = 0; i < PB_ASSET_ROOTS.length; i++) {
            if (v.lastIndexOf(PB_ASSET_ROOTS[i], 0) === 0 &&
                v.length > PB_ASSET_ROOTS[i].length) return v;
        }
        return '';
    }

    /* The manifest is a generated file (tools/build-asset-manifest.js), but
       it arrives over the network like anything else, so it is rebuilt here
       rather than trusted: an entry whose path is not one of ours is
       dropped, and every other field is re-derived or bounded. */
    function pbAssetList(raw) {
        var out = [], seen = {}, i;
        var items = (raw && isArr(raw.assets)) ? raw.assets : (isArr(raw) ? raw : []);
        for (i = 0; i < items.length && i < 2000; i++) {
            var it = items[i];
            if (!it || typeof it !== 'object') continue;
            var path = pbAsset(it.path);
            if (!path) continue;
            if (Object.prototype.hasOwnProperty.call(seen, path)) continue;
            seen[path] = 1;
            var entry = { path: path, name: str(it.name).slice(0, 120) || path,
                          group: str(it.group).slice(0, 60) || 'Images' };
            /* Dimensions are optional on purpose: the generator leaves them
               out rather than guessing, and so does this. */
            var w = parseInt(it.w, 10), h = parseInt(it.h, 10);
            if (w > 0 && h > 0 && w < 100000 && h < 100000) { entry.w = w; entry.h = h; }
            var bytes = parseInt(it.bytes, 10);
            if (bytes > 0) entry.bytes = bytes;
            out.push(entry);
        }
        out.sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
        return out;
    }

    /* ==========================================================
       UPLOADED CMS MEDIA
       ----------------------------------------------------------
       pbAsset() above answers "is this one of the files committed in this
       repository?" and is left exactly as it was. Uploaded media is not in
       the repository, so it cannot pass that question and must not be made
       to: relaxing pbAsset would relax it for repository paths too.

       So this is a SECOND, equally narrow question asked only of uploaded
       media: is this a file in THIS site's own storage bucket, named the
       way this code names them?

       It is not "any https URL" and it is not "any Supabase URL". It is an
       exact string prefix built from the configured project plus a path
       shape that only mediaName() below can produce. Anything a person
       could type -- an external host, a query string, a traversal segment,
       an .svg, a double slash -- fails.
       ========================================================== */

    /* Where uploaded media is publicly served from, or '' when uploads are
       not configured for this deployment. Read lazily so a white-label
       build only has to set js/cms-config.js. */
    function mediaBucket() {
        var m = window.CMS_MEDIA || {};
        var r = window.CMS_REMOTE || {};
        if (!m.enabled || !r.enabled || !r.url) return '';
        var b = str(m.bucket);
        if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(b)) return '';
        return b;
    }

    function mediaBase() {
        var b = mediaBucket();
        if (!b) return '';
        var url = str((window.CMS_REMOTE || {}).url).replace(/\/+$/, '');
        if (!/^https:\/\/[A-Za-z0-9.-]+$/.test(url)) return '';
        return url + '/storage/v1/object/public/' + b + '/';
    }

    /* The only object-key shape this CMS ever writes, and therefore the
       only one it will ever read back. */
    var MEDIA_KEY_RE = /^media\/[a-z0-9][a-z0-9-]{0,80}\.(png|jpe?g|webp|gif)$/;
    var MEDIA_MAX_URL = 400;

    function pbMedia(raw) {
        var v = str(raw);
        if (!v || v.length > MEDIA_MAX_URL) return '';
        var base = mediaBase();
        if (!base) return '';
        /* STARTS WITH, not contains: a URL that merely mentions the bucket
           somewhere -- in a query string, behind another host -- is a
           different URL. The key test below independently refuses those
           too, because slicing at the wrong offset cannot produce a valid
           key; the two together are why this is safe, and neither is the
           whole reason on its own. */
        if (v.lastIndexOf(base, 0) !== 0) return '';
        var key = v.slice(base.length);
        if (!MEDIA_KEY_RE.test(key)) return '';
        /* The three lines below are unreachable today: MEDIA_KEY_RE already
           refuses a traversal segment, a double slash and every character
           pbUrl would object to. No test can tell them apart from their
           absence -- deleting them breaks nothing, which is exactly why it
           is written down here rather than discovered later. They stay
           because MEDIA_KEY_RE is one regex, and the day someone loosens it
           to allow a folder or a longer name, these are what still say no.
           pbUrl in particular is the ONE place this project decides what a
           URL may be, and uploaded media must not become the exception. */
        if (key.indexOf('..') > -1 || key.indexOf('//') > -1) return '';
        return pbUrl(v) === v ? v : '';
    }

    /* Every place an image may come from, in one call: a committed
       repository asset OR an uploaded media file, and nothing else. This
       is what the picker and the media fields are held to. */
    function pbImageRef(raw) {
        return pbAsset(raw) || pbMedia(raw);
    }

    /* Metadata rebuilt from whatever the record holds -- same treatment,
       and the same reasoning, as pbAssetList() gives the manifest. The row
       is public, so an entry in it is data from the network. */
    function mediaList(raw) {
        var items = (raw && isArr(raw.items)) ? raw.items : (isArr(raw) ? raw : []);
        var out = [], seen = {}, i;
        for (i = 0; i < items.length && i < 2000; i++) {
            var it = items[i];
            if (!it || typeof it !== 'object') continue;
            var url = pbMedia(it.url);
            if (!url) continue;
            if (Object.prototype.hasOwnProperty.call(seen, url)) continue;
            seen[url] = 1;
            var e = {
                url: url,
                key: url.slice(mediaBase().length),
                name: str(it.name).slice(0, 120) || url,
                alt: str(it.alt).slice(0, 200),
                uploadedAt: /^\d{4}-\d\d-\d\dT[\d:.]+Z?$/.test(str(it.uploadedAt)) ? str(it.uploadedAt) : ''
            };
            var w = parseInt(it.w, 10), h = parseInt(it.h, 10);
            if (w > 0 && h > 0 && w < 100000 && h < 100000) { e.w = w; e.h = h; }
            var bytes = parseInt(it.bytes, 10);
            if (bytes > 0 && bytes < 1e9) e.bytes = bytes;
            out.push(e);
        }
        /* Newest first: a library is browsed from what was just added. */
        out.sort(function (a, b) { return a.uploadedAt < b.uploadedAt ? 1 : a.uploadedAt > b.uploadedAt ? -1 : 0; });
        return out;
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
        /* var() is how the global design tokens reach the page, and those
           are built here from a trusted map -- never from typed text. A
           value that arrives already containing var() would be able to read
           any custom property on the page, so it is refused outright. */
        if (/var\s*\(/i.test(v)) return '';
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

    /* ---- inline formatting, without ever parsing HTML ----

       WHAT IT IS FOR. Body copy needs to be able to say "this phrase
       matters" and "this phrase links there". Without that, a paragraph is
       a wall of words and a page has no internal links for a crawler to
       follow -- and the only way an author had to get either was the
       shipped-body field, which is raw innerHTML.

       WHAT IT IS NOT. It is not HTML. The stored value stays an ordinary
       string: it still goes through pbScalar(), is still capped at 4000
       characters, is still refused outright if it holds a control
       character. The renderer reads a tiny set of marks out of that string
       and builds NODES -- **bold** becomes a <strong> whose textContent is
       the words between the marks, and nothing else can come out. There is
       no path from a stored string to parsed markup, which is the entire
       point of this file rendering with createElement and textContent.

       A link's address goes through pbUrl() exactly like every other href
       here, so [x](javascript:alert(1)) yields no anchor at all -- it
       leaves the words "x" behind rather than a dead or dangerous link.

       IT IS OPT-IN, per element, through content.rich. Left off -- which is
       what every element already published has -- the text renders as one
       textContent assignment exactly as before, so a paragraph that
       happens to contain an asterisk is untouched on every live page.

       Marks, and deliberately only these:
         **strong**            emphasis that matters to meaning
         *em*                  ordinary emphasis
         [label](address)      a link, address through pbUrl()
       Nesting is not supported and is not a gap: one level is what body
       copy needs, and a parser that nests is a parser with corner cases. */
    var PB_INLINE_RE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]\n]+\]\([^()\s]+\))/;

    function pbInlineInto(host, text) {
        var parts = str(text).split(PB_INLINE_RE);
        for (var i = 0; i < parts.length; i++) {
            var s = parts[i];
            if (!s) continue;
            var node = null;
            if (s.length > 4 && s.slice(0, 2) === '**' && s.slice(-2) === '**') {
                node = pbEl('strong', 'pb-strong');
                node.textContent = s.slice(2, -2);
            } else if (s.length > 2 && s.charAt(0) === '*' && s.charAt(s.length - 1) === '*') {
                node = pbEl('em', 'pb-em');
                node.textContent = s.slice(1, -1);
            } else if (s.charAt(0) === '[' && s.indexOf('](') > 0) {
                var cut = s.indexOf('](');
                var label = s.slice(1, cut);
                var href = pbUrl(s.slice(cut + 2, -1));
                if (href) {
                    node = pbEl('a', 'pb-inline-link');
                    node.setAttribute('href', href);
                    node.textContent = label;
                } else {
                    /* A refused address leaves the words, not a dead link
                       and not the raw mark. */
                    s = label;
                }
            }
            host.appendChild(node || document.createTextNode(s));
        }
    }

    /* Write a stored string into a node: as formatted nodes when the
       element asked for it, otherwise as the single textContent assignment
       this file has always used. One helper, so no renderer has to decide
       how to do it twice. */
    function pbTextInto(node, text, content) {
        if (content && content.rich === true) pbInlineInto(node, text);
        else node.textContent = str(text);
        return node;
    }

    var PB_ELEMENTS = {

        heading: function (el) {
            var c = el.content || {};
            var lvl = String(c.level || 'h2').toLowerCase();
            if (['h1','h2','h3','h4','h5','h6'].indexOf(lvl) === -1) lvl = 'h2';
            var n = pbEl(lvl, 'pb-el pb-heading');
            /* Deep-linkable, and what a table of contents points at. An
               element whose id could not be put in a selector gets none,
               which is the same condition pbAnchorId() reports to the
               table of contents, so the two never disagree. */
            var anchor = pbAnchorId(el && el.id);
            if (anchor) n.setAttribute('id', anchor);
            n.textContent = str(c.text);
            return pbId(n, el);
        },

        text: function (el) {
            var c = el.content || {};
            /* A quotation is a <blockquote>, not a paragraph styled to look
               like one: the tag is the thing a crawler and a screen reader
               read. Anything but a known tag falls back to <p>. */
            var tag = pbPick(PB_TEXT_TAGS, str(c.tag).toLowerCase()) ? str(c.tag).toLowerCase() : 'p';
            var n = pbEl(tag, 'pb-el pb-textblock' + (tag === 'blockquote' ? ' pb-quote' : ''));
            pbTextInto(n, c.text, c);
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
            /* A container is addressed by its POSITION, not by an id of its
               own: pbContainerRef() is the one place that decides what that
               address looks like, and pbElementCSS() asks the same question
               to write the rule. Position is also how the admin already
               addresses a container, so moving one moves its style with it
               and a duplicated columns element -- which gets a fresh
               element id -- gets fresh container rules for free. */
            for (var i = 0; i < cols.length; i++) {
                var col = pbEl('div', 'pb-column');
                col.className += pbHideClasses((cols[i] || {}).visibility);
                var ref = pbContainerRef(el, i);
                if (ref) col.setAttribute('data-col', ref);
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
            var cls = pbPick(PB_ICONS, c.icon);
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
            var variant = pbPick(PB_NOTICE_VARIANTS, c.variant) ? str(c.variant) : 'info';
            var box = pbEl('div', 'pb-el pb-notice pb-notice-' + variant);
            /* "note" is the advisory role. Deliberately not "alert": that is
               assertive and interrupts a screen reader, which is wrong for
               text that was on the page before the reader arrived. */
            box.setAttribute('role', 'note');
            var cls = pbPick(PB_ICONS, c.icon);
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
            var cls = pbPick(PB_ICONS, c.icon);
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
                /* The default was tested and then THROWN AWAY: the guard
                   checked `c.titleLevel || 'h3'` and the branch then read
                   c.titleLevel on its own, so a feature box with no level
                   -- which is every one the admin adds, since its blank
                   content sets none -- resolved to the string "undefined"
                   and rendered <undefined>. The title was visible and was
                   not a heading: nothing in the page outline, nothing
                   announced as a heading, nothing for a crawler. One value,
                   worked out once. */
                var want = str(c.titleLevel).toLowerCase() || 'h3';
                var lvl = pbPick(PB_HEADING_LEVELS, want) ? want : 'h3';
                var h = pbEl(lvl, 'pb-feature-title');
                h.textContent = str(c.title);
                box.appendChild(h);
            }
            if (str(c.text)) {
                var t = pbEl('p', 'pb-feature-text');
                t.textContent = str(c.text);
                box.appendChild(t);
            }
            /* One or two actions. The second is drawn only when it has both
               an address pbUrl() allows and words to put on it -- the same
               condition as the first, because a link with no text is not a
               link anyone can use. They sit in a row of their own so two
               actions read as a pair rather than as a sentence. */
            var acts = [[c.href, c.linkText, c.newTab, 'pb-feature-link'],
                        [c.href2, c.linkText2, c.newTab2, 'pb-feature-link pb-feature-link2']];
            var row = null;
            for (var ai = 0; ai < acts.length; ai++) {
                var ahref = pbUrl(acts[ai][0]);
                var atext = str(acts[ai][1]);
                if (!ahref || !atext) continue;
                if (!row) { row = pbEl('div', 'pb-feature-actions'); box.appendChild(row); }
                var a = pbEl('a', acts[ai][3]);
                a.setAttribute('href', ahref);
                if (acts[ai][2]) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
                a.textContent = atext;
                row.appendChild(a);
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
                var plat = pbPick(PB_SOCIAL, it.platform);
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
        },

        /* ---------------- Phase 2A elements ---------------- */

        /* An ordered or unordered list. Real <ul>/<ol>/<li>, so the markup
           a crawler reads says "this is a list" rather than showing one
           drawn with bullet characters in a paragraph. Rows with no text
           are skipped rather than drawn empty, and a list that kept none
           renders nothing at all -- the same contract every other
           repeating element here holds to. */
        list: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var ordered = c.ordered === true;
            var n = pbEl(ordered ? 'ol' : 'ul', 'pb-el pb-list' + (ordered ? ' pb-list-ord' : ''));
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var text = str((items[i] || {}).text);
                if (!text) continue;
                var li = pbEl('li', 'pb-list-item');
                pbTextInto(li, text, c);
                n.appendChild(li);
                made += 1;
            }
            if (!made) return null;
            return pbId(n, el);
        },

        /* A data table. The first row is the header row unless the author
           says otherwise, which is what makes <th scope="col"> correct
           rather than decorative -- a screen reader announces the column
           name with every cell, and a crawler can tell a table of data
           from a grid used for layout.

           The <table> sits inside a wrapper, and the wrapper is what
           carries .pb-el and the generated CSS: a table that is wider
           than a phone has to be able to scroll inside its own box
           instead of widening the page. */
        table: function (el) {
            var c = el.content || {};
            var rows = isArr(c.items) ? c.items : [];
            if (!rows.length) return null;

            /* How many columns to draw: the author's number when they set
               one, otherwise the widest row, so a table pasted in from
               somewhere else is not silently clipped to a narrower shape
               than the data it holds. */
            var cols = parseInt(c.cols, 10);
            if (!(cols >= 1)) {
                cols = 0;
                for (var r = 0; r < rows.length; r++) {
                    for (var k = PB_TABLE_MAX_COLS; k > cols; k--) {
                        if (str((rows[r] || {})[PB_TABLE_KEYS[k - 1]])) { cols = k; break; }
                    }
                }
            }
            if (cols < 1) return null;                 /* every cell was empty */
            if (cols > PB_TABLE_MAX_COLS) cols = PB_TABLE_MAX_COLS;

            var head = c.header !== false;
            var body = head ? rows.slice(1) : rows;
            /* A header row with nothing under it is not a table, it is a
               row of labels. Refusing it here is kinder than drawing a
               table a crawler would read as empty. */
            if (!body.length) return null;

            function cell(tag, value, scope) {
                var n = pbEl(tag, tag === 'th' ? 'pb-table-h' : 'pb-table-c');
                if (scope) n.setAttribute('scope', scope);
                n.textContent = str(value);
                return n;
            }

            var wrap = pbEl('div', 'pb-el pb-table');
            var t = pbEl('table', 'pb-table-t');
            /* A caption is the table's accessible name and is read before
               its contents, so it goes first -- which is also the only
               place HTML allows it. */
            if (str(c.caption)) {
                var cap = pbEl('caption', 'pb-table-cap');
                cap.textContent = str(c.caption);
                t.appendChild(cap);
            }
            var i, j;
            if (head) {
                var thead = pbEl('thead');
                var hr = pbEl('tr', 'pb-table-r');
                for (i = 0; i < cols; i++) {
                    hr.appendChild(cell('th', (rows[0] || {})[PB_TABLE_KEYS[i]], 'col'));
                }
                thead.appendChild(hr);
                t.appendChild(thead);
            }
            var tb = pbEl('tbody');
            for (j = 0; j < body.length; j++) {
                var tr = pbEl('tr', 'pb-table-r');
                for (i = 0; i < cols; i++) {
                    tr.appendChild(cell('td', (body[j] || {})[PB_TABLE_KEYS[i]], ''));
                }
                tb.appendChild(tr);
            }
            t.appendChild(tb);
            wrap.appendChild(t);
            return pbId(wrap, el);
        },

        /* A table of contents: a <nav> of links to the headings this page's
           sections draw.

           It reads pbOutline(), the heading reader the admin already uses
           for its H1 warning, so the list is resolved exactly as the page
           resolves it -- including a heading element with no level falling
           back to h2. There is no second heading reader to drift.

           H1 is never listed. A page's H1 is its title, written above the
           sections from pages.<slug>.heading, so a contents entry for one
           would point at a second H1 that should not be there anyway.

           Nothing is drawn when there is nothing to point at: fewer than
           two entries is a list of one link, which is noise rather than
           navigation. */
        toc: function (el) {
            var c = el.content || {};
            var deepest = pbPick(PB_TOC_DEPTHS, str(c.depth)) ? str(c.depth) : 'h3';
            var limit = PB_TOC_DEPTHS[deepest];
            var items = pbOutline(pbRenderTree || []).items;
            var rows = [];
            for (var i = 0; i < items.length; i++) {
                var lv = parseInt(items[i].level.slice(1), 10);
                if (lv < 2 || lv > limit) continue;       /* never the H1 */
                var text = str(items[i].text);
                var href = pbAnchorId(items[i].id);
                if (!text || !href) continue;
                rows.push({ text: text, href: href, level: lv });
            }
            if (rows.length < 2) return null;

            var nav = pbEl('nav', 'pb-el pb-toc');
            var label = str(c.title);
            nav.setAttribute('aria-label', label || 'On this page');
            if (label) {
                var lvl = pbPick(PB_HEADING_LEVELS, str(c.titleLevel).toLowerCase())
                    ? str(c.titleLevel).toLowerCase() : 'h2';
                var h = pbEl(lvl, 'pb-toc-title');
                h.textContent = label;
                /* The heading names the nav, so the nav does not need a
                   second name of its own. */
                var hid = pbDomId(el, 't');
                h.setAttribute('id', hid);
                nav.setAttribute('aria-labelledby', hid);
                nav.removeAttribute('aria-label');
                nav.appendChild(h);
            }
            var listTag = c.ordered === true ? 'ol' : 'ul';
            var list = pbEl(listTag, 'pb-toc-list');
            for (i = 0; i < rows.length; i++) {
                var li = pbEl('li', 'pb-toc-item pb-toc-l' + rows[i].level);
                var a = pbEl('a', 'pb-toc-link');
                a.setAttribute('href', '#' + rows[i].href);
                a.textContent = rows[i].text;
                li.appendChild(a);
                list.appendChild(li);
            }
            nav.appendChild(list);
            return pbId(nav, el);
        },

        /* ---------------- Phase 2B elements ----------------

           Every one of these puts its content in the HTML with no
           JavaScript at all. That is not a coincidence: a testimonial, a
           number, a price and a caption are the words a page is FOR, and a
           page whose words arrive after a script is a page a crawler reads
           empty. Interaction can be added on top; content cannot be added
           on top. */

        /* Quotes with an attribution. <figure> + <blockquote> + <figcaption>
           is what HTML has for exactly this, and it is what a screen reader
           announces as a quotation rather than as two unrelated paragraphs.

           NO review or rating schema is produced here, and none should be:
           a testimonial an author typed is not a verified review, and
           marking it up as one would be a claim this element has no way to
           stand behind. */
        testimonials: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var wrap = pbEl('div', 'pb-el pb-testimonials');
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var quote = str(it.quote);
                if (!quote) continue;
                var fig = pbEl('figure', 'pb-tm');
                var bq = pbEl('blockquote', 'pb-tm-quote');
                var p = pbEl('p', 'pb-tm-text');
                p.textContent = quote;
                bq.appendChild(p);
                fig.appendChild(bq);

                var cap = pbEl('figcaption', 'pb-tm-by');
                var img = pbUrl(it.image) ? PB_ELEMENTS.image({ content: {
                    src: it.image, alt: str(it.name) } }) : null;
                if (img) { img.className += ' pb-tm-face'; cap.appendChild(img); }
                var who = pbEl('div', 'pb-tm-who');
                if (str(it.name)) {
                    var n = pbEl('span', 'pb-tm-name');
                    n.textContent = str(it.name);
                    who.appendChild(n);
                }
                /* Role and company read as one line when both are set, so
                   the markup joins them rather than leaving the CSS to. */
                var meta = [str(it.role), str(it.company)].filter(Boolean).join(', ');
                if (meta) {
                    var m = pbEl('span', 'pb-tm-role');
                    m.textContent = meta;
                    who.appendChild(m);
                }
                if (who.childNodes.length) cap.appendChild(who);
                if (cap.childNodes.length) fig.appendChild(cap);
                wrap.appendChild(fig);
                made += 1;
            }
            if (!made) return null;
            return pbId(wrap, el);
        },

        /* A row of numbers. The value is TEXT in the HTML -- there is no
           count-up animation, and that is deliberate: the simplest way to
           guarantee the number a crawler reads is the number an author
           typed is for nothing to compute it. */
        stats: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var lvl = pbPick(PB_HEADING_LEVELS, str(c.headingLevel).toLowerCase())
                ? str(c.headingLevel).toLowerCase() : '';
            var wrap = pbEl('div', 'pb-el pb-stats');
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var value = str(it.value);
                if (!value) continue;
                var box = pbEl('div', 'pb-stat');
                var v = pbEl('div', 'pb-stat-value');
                if (str(it.prefix)) {
                    var pre = pbEl('span', 'pb-stat-affix');
                    pre.textContent = str(it.prefix);
                    v.appendChild(pre);
                }
                var num = pbEl('span', 'pb-stat-num');
                num.textContent = value;
                v.appendChild(num);
                if (str(it.suffix)) {
                    var suf = pbEl('span', 'pb-stat-affix');
                    suf.textContent = str(it.suffix);
                    v.appendChild(suf);
                }
                box.appendChild(v);
                if (str(it.label)) {
                    /* A stat's label is a heading only if the author asked
                       for one. Left alone it is a <div>, because twenty
                       numbers in a row are not twenty sections of a page. */
                    var lab = pbEl(lvl || 'div', 'pb-stat-label');
                    lab.textContent = str(it.label);
                    box.appendChild(lab);
                }
                wrap.appendChild(box);
                made += 1;
            }
            if (!made) return null;
            return pbId(wrap, el);
        },

        /* Pricing or comparison cards. Feature rows are a real <ul>, the
           price is text, and the action is an ordinary link through
           pbUrl(). Nothing here invents a currency, a number or a claim:
           every word comes from the record. */
        plans: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var lvl = pbPick(PB_HEADING_LEVELS, str(c.headingLevel).toLowerCase())
                ? str(c.headingLevel).toLowerCase() : 'h3';
            var wrap = pbEl('div', 'pb-el pb-plans');
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var title = str(it.title);
                if (!title) continue;
                /* The highlighted card is marked in the markup as well as
                   in the styling, so what it is does not depend on colour
                   alone. */
                var hi = it.highlight === true;
                var box = pbEl('div', 'pb-plan' + (hi ? ' pb-plan-hi' : ''));
                if (hi) box.setAttribute('data-highlight', 'true');
                var h = pbEl(lvl, 'pb-plan-title');
                h.textContent = title;
                box.appendChild(h);
                if (str(it.subtitle)) {
                    var sub = pbEl('p', 'pb-plan-sub');
                    sub.textContent = str(it.subtitle);
                    box.appendChild(sub);
                }
                if (str(it.price)) {
                    var pr = pbEl('div', 'pb-plan-price');
                    var pn = pbEl('span', 'pb-plan-amount');
                    pn.textContent = str(it.price);
                    pr.appendChild(pn);
                    if (str(it.period)) {
                        var pe = pbEl('span', 'pb-plan-period');
                        pe.textContent = str(it.period);
                        pr.appendChild(pe);
                    }
                    box.appendChild(pr);
                }
                var feats = pbEl('ul', 'pb-plan-features');
                var fmade = 0;
                for (var f = 1; f <= PB_PLAN_FEATURES; f++) {
                    var ft = str(it['f' + f]);
                    if (!ft) continue;
                    var li = pbEl('li', 'pb-plan-feature');
                    li.textContent = ft;
                    feats.appendChild(li);
                    fmade += 1;
                }
                if (fmade) box.appendChild(feats);
                var chref = pbUrl(it.ctaHref);
                var ctext = str(it.ctaText);
                if (chref && ctext) {
                    var a = pbEl('a', 'pb-plan-cta');
                    a.setAttribute('href', chref);
                    if (it.ctaNewTab) {
                        a.setAttribute('target', '_blank');
                        a.setAttribute('rel', 'noopener');
                    }
                    a.textContent = ctext;
                    box.appendChild(a);
                }
                wrap.appendChild(box);
                made += 1;
            }
            if (!made) return null;
            return pbId(wrap, el);
        },

        /* A grid of images. Each one is a <figure>, so a caption is tied to
           its picture rather than floating under it, and every image goes
           through the same image renderer as a standalone one -- so lazy
           loading, decoding and the alt attribute are not written twice.

           There is no lightbox. One would be a click handler, a focus trap
           and an escape key for a feature nobody asked to be modal, and a
           plain image that opens nothing is not broken. */
        gallery: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var showCaps = c.captions !== false;
            var wrap = pbEl('div', 'pb-el pb-gallery');
            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var img = PB_ELEMENTS.image({ content: { src: it.src, alt: it.alt } });
                if (!img) continue;              /* no usable source */
                img.className += ' pb-gal-img';
                var fig = pbEl('figure', 'pb-gal-item');
                fig.appendChild(img);
                var cap = str(it.caption);
                if (cap && showCaps) {
                    var fc = pbEl('figcaption', 'pb-gal-cap');
                    fc.textContent = cap;
                    fig.appendChild(fc);
                }
                wrap.appendChild(fig);
                made += 1;
            }
            if (!made) return null;
            return pbId(wrap, el);
        },

        /* A progress indicator, as the native <progress> element.

           WHY NATIVE. The usual way to draw one is a div whose width is set
           from the value -- which means an inline style built from stored
           content, and this file does not write inline styles. <progress>
           needs none: the browser draws the fill from the attributes, it is
           announced correctly with no ARIA to get wrong, and it degrades to
           its own text content where it is unsupported.

           The value is also printed as WORDS beside the bar, so what it
           says does not depend on seeing a coloured bar at all. */
        progress: function (el) {
            var c = el.content || {};
            var max = parseFloat(c.max);
            if (!(max > 0)) max = 100;
            var value = parseFloat(c.value);
            if (!isFinite(value)) return null;        /* nothing to report */
            if (value < 0) value = 0;
            if (value > max) value = max;
            var pct = Math.round(value / max * 100);

            var wrap = pbEl('div', 'pb-el pb-progress');
            var label = str(c.label);
            var bar = pbEl('progress', 'pb-progress-bar');
            bar.setAttribute('max', String(max));
            bar.setAttribute('value', String(value));
            /* The element's own text is what a browser without <progress>
               shows, and what some readers announce. */
            bar.textContent = pct + '%';

            var head = pbEl('div', 'pb-progress-head');
            if (label) {
                var id = pbDomId(el, 'pl');
                var lab = pbEl('span', 'pb-progress-label');
                lab.setAttribute('id', id);
                lab.textContent = label;
                head.appendChild(lab);
                bar.setAttribute('aria-labelledby', id);
            }
            if (c.showValue !== false) {
                var out = pbEl('span', 'pb-progress-value');
                out.textContent = pct + '%';
                head.appendChild(out);
            }
            if (head.childNodes.length) wrap.appendChild(head);
            wrap.appendChild(bar);
            return pbId(wrap, el);
        },

        /* ---- tabs ----

           EVERY PANEL IS IN THE HTML. The inactive ones carry `hidden`,
           which is display and not absence -- exactly what the FAQ element
           has always done, and what keeps the words readable to a crawler
           while the page does not show four panels stacked on first paint.

           The ARIA is the pattern as specified, not a sprinkling of
           attributes: a tablist of real <button>s, each owning its panel
           through aria-controls, each panel pointing back with
           aria-labelledby, one tab in the tab order at a time (the selected
           one, tabindex 0; the rest -1) and the arrow keys moving between
           them. A <button> is focusable and handles Enter and Space itself,
           so there is no key handling to write for those and none to get
           wrong. */
        tabs: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var rows = [];
            for (var i = 0; i < items.length; i++) {
                if (str((items[i] || {}).label)) rows.push(items[i]);
            }
            if (!rows.length) return null;

            var wrap = pbEl('div', 'pb-el pb-tabs');
            var list = pbEl('div', 'pb-tablist');
            list.setAttribute('role', 'tablist');
            wrap.appendChild(list);
            var panels = pbEl('div', 'pb-tabpanels');
            wrap.appendChild(panels);

            /* The first tab marked open wins; with none marked, the first. */
            var active = 0;
            for (i = 0; i < rows.length; i++) {
                if (rows[i].open === true) { active = i; break; }
            }

            var btns = [], pans = [];
            for (i = 0; i < rows.length; i++) {
                var tabId = pbDomId(el, 't' + i);
                var panId = pbDomId(el, 'tp' + i);
                var on = i === active;

                var btn = pbEl('button', 'pb-tab');
                btn.setAttribute('type', 'button');
                btn.setAttribute('role', 'tab');
                btn.setAttribute('id', tabId);
                btn.setAttribute('aria-controls', panId);
                btn.setAttribute('aria-selected', on ? 'true' : 'false');
                btn.setAttribute('tabindex', on ? '0' : '-1');
                btn.textContent = str(rows[i].label);
                list.appendChild(btn);
                btns.push(btn);

                var pan = pbEl('div', 'pb-tabpanel');
                pan.setAttribute('role', 'tabpanel');
                pan.setAttribute('id', panId);
                pan.setAttribute('aria-labelledby', tabId);
                /* Scrollable panels need to be focusable, or a keyboard
                   user who tabs past the list cannot reach the content. */
                pan.setAttribute('tabindex', '0');
                if (!on) pan.hidden = true;
                var body = pbEl('p', 'pb-tab-text');
                pbTextInto(body, rows[i].text, c);
                pan.appendChild(body);
                panels.appendChild(pan);
                pans.push(pan);
            }

            for (i = 0; i < btns.length; i++) {
                btns[i].addEventListener('click', pbTabPick(btns, pans, i));
                btns[i].addEventListener('keydown', pbTabKeys(btns, pans, i));
            }
            return pbId(wrap, el);
        },

        /* ---- carousel ----

           IT WORKS WITH NO JAVASCRIPT AT ALL. The slides are a row that
           scrolls, with CSS scroll snapping, so a visitor can swipe or
           scroll through them and a keyboard user can scroll the strip,
           before a single line of script has run. The buttons and the
           optional autoplay are enhancements on top of something that
           already works -- which is the opposite of the usual slider, where
           the content does not exist until the library loads.

           Autoplay never starts for a visitor who asked for less motion,
           and when it is on there is a pause control, because motion a
           reader cannot stop is motion that makes a page unusable. */
        carousel: function (el) {
            var c = el.content || {};
            var items = isArr(c.items) ? c.items : [];
            var wrap = pbEl('div', 'pb-el pb-carousel');
            var strip = pbEl('div', 'pb-car-strip');
            /* A scrolling region needs a name and a way in from the
               keyboard, or its content is unreachable without a mouse. */
            strip.setAttribute('tabindex', '0');
            strip.setAttribute('role', 'group');
            strip.setAttribute('aria-roledescription', 'carousel');
            strip.setAttribute('aria-label', 'Slides');

            var made = 0;
            for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var img = pbUrl(it.image)
                    ? PB_ELEMENTS.image({ content: { src: it.image, alt: str(it.alt) } })
                    : null;
                var title = str(it.title), text = str(it.text);
                if (!img && !title && !text) continue;      /* an empty slide */
                var slide = pbEl('div', 'pb-car-slide');
                slide.setAttribute('role', 'group');
                slide.setAttribute('aria-roledescription', 'slide');
                if (img) { img.className += ' pb-car-img'; slide.appendChild(img); }
                if (title) {
                    var h = pbEl('h3', 'pb-car-title');
                    h.textContent = title;
                    slide.appendChild(h);
                }
                if (text) {
                    var p = pbEl('p', 'pb-car-text');
                    p.textContent = text;
                    slide.appendChild(p);
                }
                var href = pbUrl(it.href);
                if (href && str(it.linkText)) {
                    var a = pbEl('a', 'pb-car-link');
                    a.setAttribute('href', href);
                    a.textContent = str(it.linkText);
                    slide.appendChild(a);
                }
                strip.appendChild(slide);
                made += 1;
            }
            if (!made) return null;
            wrap.appendChild(strip);

            /* One slide needs no controls, and a strip that cannot scroll
               should not offer buttons that do nothing. */
            if (made > 1) {
                var bar = pbEl('div', 'pb-car-controls');
                var prev = pbCarBtn('Previous slide', 'pb-car-prev');
                var next = pbCarBtn('Next slide', 'pb-car-next');
                bar.appendChild(prev);
                if (c.autoplay === true) {
                    var play = pbCarBtn('Pause the slideshow', 'pb-car-pause');
                    play.setAttribute('aria-pressed', 'false');
                    bar.appendChild(play);
                    pbCarAuto(strip, play, c.interval);
                }
                bar.appendChild(next);
                wrap.appendChild(bar);
                prev.addEventListener('click', pbCarStep(strip, -1));
                next.addEventListener('click', pbCarStep(strip, 1));
            }
            return pbId(wrap, el);
        },

        /* ---- video ----

           An <iframe> runs a third party's code in the page, so the address
           is never the author's string: pbVideoRef() matches it against the
           hosts this builder embeds and returns an ID, and the src is BUILT
           from that id and a constant.

           An address no host recognises does not become an iframe. It
           becomes a link, if pbUrl() allows it, and nothing otherwise --
           because the one thing worse than not embedding a video is
           embedding whatever was typed.

           The iframe is sandboxed to what a player needs and nothing else,
           referrer policy is tightened, and it loads lazily so a video
           further down a page costs nothing until it is reached. */
        video: function (el) {
            var c = el.content || {};
            var ref = pbVideoRef(c.url);
            var title = str(c.title);
            var caption = str(c.caption);
            var fig = pbEl('figure', 'pb-el pb-video');

            if (ref) {
                var frame = pbEl('div', 'pb-video-frame');
                var f = pbEl('iframe', 'pb-video-embed');
                f.setAttribute('src', ref.embed);
                /* A frame with no name is announced as "frame" and nothing
                   else, so this is not decoration. */
                f.setAttribute('title', title || (ref.host + ' video'));
                f.setAttribute('loading', 'lazy');
                f.setAttribute('allowfullscreen', '');
                f.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                f.setAttribute('allow', 'fullscreen; picture-in-picture; encrypted-media');
                f.setAttribute('sandbox',
                    'allow-scripts allow-same-origin allow-presentation allow-popups');
                frame.appendChild(f);
                fig.appendChild(frame);
            } else {
                /* No recognised host. A link to it is still useful; an
                   iframe pointed at it would not be. */
                var href = pbUrl(c.url);
                if (!href) return null;
                var a = pbEl('a', 'pb-video-link');
                a.setAttribute('href', href);
                a.setAttribute('rel', 'noopener');
                a.textContent = title || 'Watch the video';
                fig.appendChild(a);
            }

            if (caption) {
                var cap = pbEl('figcaption', 'pb-video-cap');
                cap.textContent = caption;
                fig.appendChild(cap);
            }
            return pbId(fig, el);
        },

        /* ========================================================
           A LIST OF OTHER PAGES (Phase 2C)
           --------------------------------------------------------
           The one element that knows about pages other than its own. Every
           row it draws came from publishedPages() through pbListResolve(),
           so a draft, a noindex page, a page whose url this build would not
           create, and anything belonging to another brand are already gone
           before this function sees them.

           It renders nothing -- no heading, no empty box -- when the list
           resolves to nothing. An author who points a listing at a type with
           no published pages gets silence rather than a hollow section, and a
           build with no render context (which is to say: a caller that did
           not say which brand this is) gets the same.
        ======================================================== */
        pageList: function (el) {
            var c = el.content || {};
            var rows = pbListResolve(c);
            if (!rows.length) return null;

            var n = pbEl('section', 'pb-el pb-pagelist');
            var title = str(c.title);
            var head = null;
            if (title) {
                var want = str(c.titleLevel).toLowerCase() || 'h2';
                var lvl = pbPick(PB_HEADING_LEVELS, want) ? want : 'h2';
                head = pbEl(lvl, 'pb-pagelist-title');
                head.textContent = title;
                n.appendChild(head);
            }

            var ul = pbEl('ul', 'pb-pagelist-items');
            for (var i = 0; i < rows.length; i++) {
                var r = rows[i];
                var li = pbEl('li', 'pb-pagelist-item');
                var a = pbEl('a', 'pb-pagelist-link');
                a.setAttribute('href', r.href);
                /* The page's own words, in the order a reader needs them:
                   what it is called, when it was written, who wrote it, what
                   it is about. Each one only when the author asked for it and
                   the page actually has it. */
                var h = pbEl('span', 'pb-pagelist-name');
                h.textContent = r.title || r.heading || r.label;
                a.appendChild(h);
                li.appendChild(a);

                if (c.date === true && r.publishedAt) {
                    var t = pbEl('time', 'pb-pagelist-date');
                    t.setAttribute('datetime', r.publishedAt);
                    t.textContent = r.publishedAt;
                    li.appendChild(t);
                }
                if (c.author === true && r.author) {
                    var by = pbEl('span', 'pb-pagelist-by');
                    by.textContent = r.author.name;
                    li.appendChild(by);
                }
                if (c.excerpt === true && r.excerpt) {
                    var ex = pbEl('p', 'pb-pagelist-excerpt');
                    ex.textContent = r.excerpt;
                    li.appendChild(ex);
                }
                ul.appendChild(li);
            }
            n.appendChild(ul);
            if (head) {
                var hid = pbDomId(el, 'pl');
                head.id = hid;
                n.setAttribute('aria-labelledby', hid);
            }
            return pbId(n, el);
        }

    };

    /* ---- what a listing element lists ----

       ONE resolver, called by the renderer above and by the ItemList block
       below, so the markup a reader sees and the data a crawler reads cannot
       describe different lists. That is the same reason pbFaqEntries() is
       shared between the faq element and its FAQPage block.

       The record and the current slug come from the render context, never
       from ambient state: see renderSectionsInto(). */
    var PB_LIST_MAX = 24;

    function pbListResolve(content) {
        var c = content || {};
        var rec = pbCtxRecord();
        if (!rec) return [];
        var slug = pbCtxSlug();
        var source = pbPick(PB_LIST_SOURCES, str(c.source).toLowerCase()) ? str(c.source).toLowerCase() : '';
        if (!source) return [];

        var rows;
        if (source === 'related') {
            var page = (rec.pages || {})[slug];
            rows = relatedPages(page, rec, slug);
        } else {
            var want = str(c.contentType).toLowerCase();
            if (!pbPick(PB_CONTENT_TYPES, want)) return [];
            rows = publishedPages({ record: rec, type: want, indexableOnly: true,
                                    exclude: slug });
        }
        var lim = c.limit;
        lim = (typeof lim === 'number' && isFinite(lim)) ? Math.floor(lim) : PB_LIST_MAX;
        if (lim < 1) lim = 1;
        if (lim > PB_LIST_MAX) lim = PB_LIST_MAX;
        return rows.slice(0, lim);
    }

    /* The Article block for the page being rendered, or null. The PAGE comes
       out of the render context, so it is this brand's record and this page's
       record rather than ambient state.

       THE INVARIANT buildArticle() RELIES ON. Its description, canonical url
       and publisher come from the loaded record through computeDescription(),
       pageUrl() and buildOrganization() -- Phase 1 readers that take no record
       argument. In a browser the loaded record IS this brand's. In a build,
       tools/lib/brandkit.js calls pbbake.recordFor() for this brand BEFORE any
       page renders, which loads that same record, and passes it here as the
       context; if that call fails it passes no context and this returns null.
       So the two are the same record whenever a block is built at all. A
       future caller that renders without establishing the record gets no
       Article rather than another brand's publisher. */
    function pbArticleSchema() {
        var rec = pbCtxRecord();
        var slug = pbCtxSlug();
        if (!rec || !slug) return null;
        var page = (rec.pages || {})[slug];
        if (!page) return null;
        return buildArticle(page, rec);
    }

    /* ONE ItemList per mount, from the first listing that asked for schema,
       built from the rows that listing actually drew. A second listing adds
       no second block: two ItemLists on one page describe one page twice. */
    function pbListSchema(sections) {
        var found = null;
        (function walk(list, depth) {
            if (found || !isArr(list) || depth > 3) return;
            for (var i = 0; i < list.length && !found; i++) {
                var el = list[i];
                if (!el) continue;
                if (el.type === 'pageList' && (el.content || {}).schema === true) {
                    var rows = pbListResolve(el.content);
                    if (rows.length) { found = rows; return; }
                }
                var cols = (el.content || {}).columns;
                if (isArr(cols)) {
                    for (var j = 0; j < cols.length; j++) walk((cols[j] || {}).elements, depth + 1);
                }
            }
        }(sectionsElements(sections), 0));
        if (!found) return null;
        var items = [];
        for (var i = 0; i < found.length; i++) {
            var u = absUrl(found[i].url);
            if (!u) continue;
            items.push({ '@type': 'ListItem', position: items.length + 1,
                         name: found[i].title || found[i].heading || found[i].label,
                         url: u });
        }
        if (!items.length) return null;
        return { '@type': 'ItemList', itemListElement: items };
    }

    /* Every element in a section array, flattened one level, so the two
       walkers above and below read the tree the same way. */
    function sectionsElements(sections) {
        var out = [];
        if (!isArr(sections)) return out;
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (!sec || sec.enabled === false || !isArr(sec.elements)) continue;
            for (var j = 0; j < sec.elements.length; j++) out.push(sec.elements[j]);
        }
        return out;
    }

    /* ---- the interaction the two interactive elements need ----

       Kept out of the renderers for the same reason pbFaqToggle is: a
       closure that captures exactly what it needs and nothing else. Nodes
       are rebuilt on every repaint, so none of these can accumulate. */

    function pbTabShow(btns, pans, want) {
        for (var i = 0; i < btns.length; i++) {
            var on = i === want;
            btns[i].setAttribute('aria-selected', on ? 'true' : 'false');
            btns[i].setAttribute('tabindex', on ? '0' : '-1');
            pans[i].hidden = !on;
        }
    }

    function pbTabPick(btns, pans, i) {
        return function () { pbTabShow(btns, pans, i); };
    }

    /* Left/Right move, Home/End jump, and focus follows selection -- which
       is the behaviour the pattern specifies for tabs that show their panel
       immediately rather than on Enter. */
    function pbTabKeys(btns, pans, i) {
        return function (e) {
            var key = e && e.key, to = -1;
            if (key === 'ArrowRight') to = (i + 1) % btns.length;
            else if (key === 'ArrowLeft') to = (i - 1 + btns.length) % btns.length;
            else if (key === 'Home') to = 0;
            else if (key === 'End') to = btns.length - 1;
            if (to < 0) return;
            if (e.preventDefault) e.preventDefault();
            pbTabShow(btns, pans, to);
            if (btns[to].focus) btns[to].focus();
        };
    }

    /* One slide's width, so a step lands on a slide rather than a guess. */
    function pbCarBtn(label, cls) {
        var b = pbEl('button', 'pb-car-btn ' + cls);
        b.setAttribute('type', 'button');
        b.setAttribute('aria-label', label);
        return b;
    }

    function pbCarStep(strip, dir) {
        return function () {
            var first = strip.querySelector ? strip.querySelector('.pb-car-slide') : null;
            var by = first ? first.getBoundingClientRect().width : strip.clientWidth;
            if (!by) by = strip.clientWidth;
            strip.scrollBy({ left: dir * by, behavior: 'smooth' });
        };
    }

    function pbCarAuto(strip, button, interval) {
        /* NOTHING TIMED HAPPENS DURING A RENDER.

           The static build runs this very file in Node against
           tools/lib/minidom.js, where there is no event loop and no
           visitor -- and where setInterval does not exist at all, so
           starting the slideshow here threw and took the whole bake down
           with it. A bake produces markup; a slideshow needs a page.

           The listener below is still attached, because minidom accepts and
           discards those, which means the baked markup carries the pause
           button and the real page wires it up on load. */
        if (typeof setInterval !== 'function' || typeof clearInterval !== 'function') return;

        /* Never for a visitor who asked for less motion. */
        var reduce = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        var ms = parseInt(interval, 10);
        if (!(ms >= 2000)) ms = 6000;      /* a floor: a slide nobody can read is not a slide */
        var timer = null;
        function stop() {
            if (timer) { clearInterval(timer); timer = null; }
            button.setAttribute('aria-pressed', 'true');
            button.setAttribute('aria-label', 'Play the slideshow');
        }
        function start() {
            if (timer) return;
            timer = setInterval(function () {
                /* At the end, back to the beginning. */
                var max = strip.scrollWidth - strip.clientWidth - 2;
                if (strip.scrollLeft >= max) strip.scrollTo({ left: 0, behavior: 'smooth' });
                else pbCarStep(strip, 1)();
            }, ms);
            button.setAttribute('aria-pressed', 'false');
            button.setAttribute('aria-label', 'Pause the slideshow');
        }
        button.addEventListener('click', function () { timer ? stop() : start(); });
        /* Moving under a reader's cursor or focus is the other way motion
           becomes a problem, so it stops for both. */
        strip.addEventListener('mouseenter', stop);
        strip.addEventListener('focusin', stop);
        if (!reduce) start(); else stop();
    }

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
            /* pbPick, not a bare index: PB_ELEMENTS['constructor'] hands
               back Object, PB_ELEMENTS['toString'] a function that returns a
               string, and appendChild() then throws on what comes out --
               taking EVERY section on the page down with it, not just this
               element. "Skip, never throw" only holds if the lookup is a
               membership test. */
            var make = pbPick(PB_ELEMENTS, el.type);
            /* The typeof is belt and braces: every own value in the map is
               a function, so with pbPick in front of it no mutation can
               tell it apart from `!make`. It stays because it states what
               a renderer entry has to be. */
            if (typeof make !== 'function') continue;  /* unknown type: skip, never throw */
            var node = make(el, depth);
            if (!node) continue;
            /* After the renderer, because an element that draws nothing
               has nothing to hide -- and because className is what every
               renderer here builds, so this cannot fight one. */
            var hide = pbHideClasses(el.visibility);
            if (hide) node.className += hide;
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

    /* Column tracks are the one token written to a per-breakpoint property
       rather than a single inherited one. css/sections.css chains the
       fallbacks so that tablet falls back to desktop but mobile stacks, and
       that chain can only exist if the three tiers are distinguishable. */
    var PB_COL_PROP = { '': '--pbe-cols', tablet: '--pbe-cols-t', mobile: '--pbe-cols-m' };

    /* One typography role, written out as the properties it stands for.
       Nothing here comes from the stored value except the role name, which
       is only ever a key into PB_TYPO_ROLES. */
    function pbTypoDecls(raw, tokens, allow) {
        var v = str(raw);
        if (v.charAt(0) !== '@') return '';
        var role = v.slice(1);
        if (!pbPick(PB_TYPO_ROLES, role)) return '';
        var out = '', k;
        for (k in PB_TYPO_PROPS) {
            if (!Object.prototype.hasOwnProperty.call(PB_TYPO_PROPS, k)) continue;
            /* Only properties this element type reads, so a role never
               leaves a declaration on a type whose CSS would ignore it. */
            if (!Object.prototype.hasOwnProperty.call(tokens, k)) continue;
            if (allow && allow.indexOf(k) === -1) continue;
            out += tokens[k][0] + ':var(--pbg-' + role + '-' + PB_TYPO_PROPS[k] + ',' +
                   PB_TYPO_ROLES[role][k] + ');';
        }
        return out;
    }

    function pbDecls(style, tokens, allow, tier) {
        var out = '', k;
        if (!style) return out;
        for (k in tokens) {
            if (!Object.prototype.hasOwnProperty.call(tokens, k)) continue;
            if (allow && allow.indexOf(k) === -1) continue;
            if (!Object.prototype.hasOwnProperty.call(style, k)) continue;
            var v, prop = tokens[k][0];
            if (k === 'typography') {
                /* A role is not one declaration but four, written through
                   this same token map so a section gets --pbs-* and an
                   element --pbe-*, and only for the properties this type
                   actually reads. */
                out += pbTypoDecls(style[k], tokens, allow);
                continue;
            }
            if (k === 'color' || k === 'bg' || k === 'lineColor') {
                v = pbColorValue(style[k]);
                if (!v) continue;
            } else if (k === 'border') {
                v = pbBorderValue(style[k]);
                if (!v) continue;
            } else if (k === 'columns') {
                /* Never the author's string: a preset name is looked up and
                   the constant track list stored against it is what gets
                   emitted. An unknown name emits nothing, which leaves the
                   V1 auto-fit fallback in css/sections.css in charge. */
                var lay = pbColLayout(style[k]);
                if (!lay) continue;
                v = lay[0];
                prop = PB_COL_PROP[tier === 'tablet' || tier === 'mobile' ? tier : ''];
            } else if (Object.prototype.hasOwnProperty.call(PB_STYLE_ENUMS, k)) {
                /* A name, not a measurement: the constant in the map is
                   what gets emitted, so an unknown or hostile value emits
                   nothing at all rather than reaching the property. */
                v = pbPick(PB_STYLE_ENUMS[k], str(style[k]).toLowerCase());
                if (!v) continue;
            } else if (k === 'bgImage') {
                var u = pbCssUrl(style[k]);
                if (!u) continue;
                v = 'url("' + u + '")';
            } else {
                v = pbCssValue(style[k]);
                if (!v) continue;
                var unit = tokens[k][1];
                if (unit && /^-?[0-9.]+$/.test(v)) v += unit;
            }
            out += prop + ':' + v + ';';
        }
        /* Types laid out as a flex or grid item align themselves rather than
           their text, so alignment is emitted as box alignment as well. */
        if (out && tokens === PB_EL_TOKENS && (!allow || allow.indexOf('align') > -1)) {
            var self = pbPick(PB_SELF, style.align);
            if (self) out += '--pbe-self:' + self[0] + ';--pbe-justify:' + self[1] + ';';
        }
        return out;
    }

    function pbScopedCSS(sel, node, tokens, allow) {
        var base = pbDecls(node.style, tokens, allow);
        var r = node.responsive || {};
        var tab = pbDecls(r.tablet, tokens, allow, 'tablet');
        var mob = pbDecls(r.mobile, tokens, allow, 'mobile');
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
            /* Same reason: PB_EL_STYLE_KEYS['valueOf'] is a function, and
               allow.indexOf() inside pbDecls() then throws before a single
               section has been drawn. */
            var allow = pbPick(PB_EL_STYLE_KEYS, el.type);
            /* isArr is redundant in the same way and kept for the same
               reason: the value has to be a list for allow.indexOf(). */
            if (id && isArr(allow)) {
                css += pbScopedCSS('.pb-el[data-el="' + id + '"]', el, PB_EL_TOKENS, allow);
            }
            var cols = (el.content || {}).columns;
            if (isArr(cols)) {
                for (j = 0; j < cols.length; j++) {
                    var box = cols[j] || {};
                    /* Three classes' worth of specificity, so a container's
                       own rule beats the shipped .pb-columns .pb-column one
                       whatever order the stylesheets happen to load in. */
                    var ref = pbContainerRef(el, j);
                    if (ref) {
                        css += pbScopedCSS('.pb-columns .pb-column[data-col="' + ref + '"]',
                                           box, PB_EL_TOKENS, PB_CONTAINER_STYLE_KEYS);
                    }
                    css += pbElementCSS(box.elements, depth + 1);
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
    /* ----------------------------------------------------------
       ONE-TIME MIGRATION: the shipped page copy -> builder sections

       An informational page's visible copy lives in pages.<slug>.body as
       a block of HTML. The builder's heading and text elements are
       textContent-only by design -- that is what keeps a published page
       free of injected markup -- so this reads the copy as a DOM and maps
       what the element model can actually represent:

           <h1>..<h6>  ->  heading element at that level
           anything else with text  ->  text element

       INLINE MARKUP DOES NOT SURVIVE. A <a href> inside a paragraph
       becomes its own text, because a text element renders textContent.
       That is a real loss and the admin says so before it runs; it is not
       hidden behind a silent conversion.

       Nothing is written here and nothing is deleted: this returns a
       section array and leaves pages.<slug>.body exactly as it was, so
       unpublishing brings the original copy straight back.
    ---------------------------------------------------------- */
    function pbSectionsFromBody(slug) {
        var page = (load().pages || {})[slug];
        var html = page && typeof page.body === 'string' ? page.body : '';
        if (!html.trim()) return [];

        var doc;
        try {
            doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html');
        } catch (e) { return []; }
        if (!doc || !doc.body) return [];

        var els = [], kids = doc.body.childNodes, i;
        for (i = 0; i < kids.length; i++) {
            var node = kids[i];
            var text = str(node.textContent);
            if (!text) continue;

            var tag = node.nodeType === 1 ? String(node.tagName).toLowerCase() : '';
            if (/^h[1-6]$/.test(tag)) {
                /* An h1 here would be the page's SECOND h1 -- the page
                   already ships one above the mount -- so it comes across
                   as the h2 it should have been. */
                var lvl = tag === 'h1' ? 'h2' : tag;
                els.push({ id: pbNewId('el'), type: 'heading',
                           content: { text: text, level: lvl },
                           style: {}, responsive: {} });
            } else {
                els.push({ id: pbNewId('el'), type: 'text',
                           content: { text: text },
                           style: {}, responsive: {} });
            }
        }
        if (!els.length) return [];

        return [{ id: pbNewId('sec'), type: 'text', enabled: true,
                  visibility: { desktop: true, tablet: true, mobile: true },
                  style: {}, responsive: {}, elements: els }];
    }

    /* Is this page's BODY owned by the builder?

       True as soon as a published builder block exists for the slug --
       including one holding no sections at all. That is the whole point of
       the empty canvas: clearing every section in /admin and publishing has
       to leave an empty page, not quietly restore the copy that shipped in
       the HTML.

       False when there is no builder block, or only a draft. Those pages
       render exactly as they always have, which is why every page that has
       never been opened in the builder is untouched by this. */
    function bodyIsBuilderManaged(slug) {
        var page = (load().pages || {})[slug];
        var b = page && page.builder;
        return !!(b && b.status === 'published' && isArr(b.sections));
    }

    /* The shipped body copy for a slug: the <div data-cms-html="pages.X.body">
       that sits above the mount. Found by its binding rather than by a new
       attribute, so no page had to change for this. */
    function legacyBodyNode(slug) {
        var want = 'pages.' + slug + '.body';
        var nodes = document.querySelectorAll('[data-cms-html]');
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].getAttribute('data-cms-html') === want) return nodes[i];
        }
        return null;
    }

    function publishedSections(slug) {
        var page = (load().pages || {})[slug];
        var b = page && page.builder;
        if (!b || b.status !== 'published') return null;
        if (!isArr(b.sections) || !b.sections.length) return [];
        /* Deliberately NOT gated on schemaVersion: whatever a published page
           was saved with, it still renders. The upgrade only fills in
           defaults, and returns the same array when there is nothing to do. */
        return pbUpgrade(b.sections, pbSchemaOf(b));
    }

    /* The section tree the current render is drawing.

       Every element renderer is handed its own element and nothing else,
       which is right: an element that could read the rest of the page is
       an element that can be surprised by it. The table of contents is the
       one exception -- it exists to describe the headings around it -- so
       instead of widening every renderer's signature, the top-level call
       leaves the tree here for the length of its own synchronous run and
       clears it afterwards. Read through pbOutline(), which is the same
       heading reader the admin uses, so there is no second idea of what a
       heading is. */
    var pbRenderTree = null;

    /* ========================================================
       THE RENDER CONTEXT (Phase 2C)
       --------------------------------------------------------
       An element that lists OTHER pages needs the record those pages live in
       and the slug of the page it is drawing. It must not reach for ambient
       state: tools/lib/pbbake.js shares ONE engine across every brand a
       process builds, so an element that read "whatever is loaded" would
       publish one brand's pages on another's site.

       So the caller that knows which brand and which page this is passes it
       in, exactly as the tree itself is passed for the contents list. With no
       context there are no pages, and a listing renders nothing -- visibly
       empty, never somebody else's content.
    ======================================================== */
    var pbRenderCtx = null;

    function pbCtxRecord() { return (pbRenderCtx && pbRenderCtx.record) || null; }
    function pbCtxSlug() { return str(pbRenderCtx && pbRenderCtx.slug); }

    function renderSectionsInto(host, sections, ctx) {
        pbRenderTree = isArr(sections) ? sections : null;
        pbRenderCtx = (ctx && typeof ctx === 'object') ? ctx : null;
        try {
            renderSectionsBody(host, sections);
        } finally {
            pbRenderTree = null;
            pbRenderCtx = null;
        }
    }

    function renderSectionsBody(host, sections) {
        var frag = document.createDocumentFragment();
        for (var i = 0; i < sections.length; i++) {
            var sec = sections[i];
            if (!sec || sec.enabled === false) continue;
            var cls = pbPick(PB_SECTION_CLASS, sec.type) || 'pb-generic';
            var node = pbEl('section', 'pb-section ' + cls);
            if (sec.id) node.setAttribute('data-sec', String(sec.id));
            node.className += pbHideClasses(sec.visibility);
            var inner = pbEl('div', 'pb-inner');
            pbRenderElements(inner, sec.elements, 0);
            node.appendChild(inner);
            frag.appendChild(node);
        }
        /* One FAQPage block for the whole mount, after the sections it
           describes. A script element's contents are never parsed as
           markup, and ldText() has already put the one character that
           could close it early beyond reach. */
        var faq = pbFaqSchema(sections);
        if (faq) {
            var ld = pbEl('script');
            ld.setAttribute('type', 'application/ld+json');
            ld.setAttribute('data-pb-faq', '1');
            ld.textContent = ldText(faq);
            frag.appendChild(ld);
        }
        /* Phase 2C: the Article for a page that is one, in the body for the
           same reason the FAQPage block is -- it reaches the static HTML of
           every kind of page without a template needing an anchor, and a page
           that is not an article emits NOTHING rather than an empty block
           that would change the markup of pages the content model does not
           touch. One emitter: writeSchema() deliberately does not write it. */
        var art = pbArticleSchema();
        if (art) {
            var ldA = pbEl('script');
            ldA.setAttribute('type', 'application/ld+json');
            ldA.setAttribute('data-pb-article', '1');
            ldA.textContent = ldText(art);
            frag.appendChild(ldA);
        }
        /* The ItemList a listing earned, built from the rows that listing
           actually drew. One per mount, never two. */
        var listLd = pbListSchema(sections);
        if (listLd) {
            var ld2 = pbEl('script');
            ld2.setAttribute('type', 'application/ld+json');
            ld2.setAttribute('data-pb-list', '1');
            ld2.textContent = ldText(listLd);
            frag.appendChild(ld2);
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

            /* The builder owns the body now, so the copy that shipped in the
               HTML must not render underneath it. It stays in the file as the
               fallback a crawler without JavaScript reads, and as what comes
               back the moment this page is unpublished -- it is hidden, never
               removed, and the CMS value behind it is never touched.

               This runs BEFORE the `continue` below on purpose: unpublishing
               makes publishedSections() return null, and that is exactly when
               the copy has to come back. Deciding it after the early exit
               would leave the page permanently blank. */
            var legacy = legacyBodyNode(slug);
            if (legacy) {
                legacy.hidden = (use && use.slug === slug) ? true
                                                           : bodyIsBuilderManaged(slug);
            }

            /* BAKED CONTENT THAT IS NO LONGER PUBLISHED.
               The build writes the published sections into the mount, marked
               with data-cms-baked, so a crawler without JavaScript reads the
               same page a visitor does. If the row has since been unpublished,
               that markup is stale: leaving it would show the sections AND the
               restored fallback copy at once. So it is cleared here -- the one
               case where "no published sections" is not "leave the page alone".

               When sections ARE published, renderSectionsInto() below replaces
               the mount's contents wholesale, which is why baking cannot
               produce a second copy of anything. */
            if (!sections) {
                if (host.hasAttribute('data-cms-baked')) {
                    host.textContent = '';
                    host.removeAttribute('data-cms-baked');
                }
                continue;                             /* leave the static markup alone */
            }
            /* The live record and the slug being painted, so a listing
               element draws THIS brand's pages. In a browser there is one
               record and it is this brand's; the build passes its own. */
            renderSectionsInto(host, sections, { record: load(), slug: slug });
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
    /* The informational pages whose shipped HTML carries a
       <div data-cms-sections="..."> mount. All four are builder-managed:
       the builder owns the body between the page's h1 and the global
       footer. index.html, login.html, register.html and 404.html are NOT
       here and must never be -- the homepage is hand-designed, the two
       account pages are functional, and 404 carries no mount. */
    var PB_MOUNTED = { about: true, contact: true,
                       'responsible-gaming': true, 'privacy-policy': true };

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
        /* What a visitor sees on this page has just changed, so the page's
           own edit date is stale. The sitemap reads it for <lastmod>, and a
           lastmod that predates the content it describes is worse than none.
           This changes no page's sitemap MEMBERSHIP -- only its date. */
        st.pages[slug].updatedAt = pbToday();
        return save();
    }

    /* Take the page back to its shipped HTML. The draft is kept, so the
       work is not lost and can be published again. */
    function unpublishPage(slug) {
        var page = (load().pages || {})[slug];
        if (!page || !page.builder) return true;
        page.builder.status = 'draft';
        page.builder.updatedAt = pbToday();
        page.updatedAt = pbToday();       /* same reason as publishDraft() */
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

    /* ONE definition of "published", shared with the renderer.

       This used to require a NON-EMPTY sections array while
       bodyIsBuilderManaged() did not, and the two disagreeing produced a trap:
       a published EMPTY canvas hid the page's shipped copy (so the body went
       blank, which is the documented intent -- see the comment on
       bodyIsBuilderManaged) while `live` read false, so Unpublish was disabled
       with "Nothing is published for this page" and the state line claimed the
       page was showing its shipped content. It was not, and the control that
       would have brought it back was greyed out.

       The renderer's definition wins, because it is the one the visitor
       experiences. An empty published canvas IS published, and can therefore
       be unpublished. */
    function builderStatus(slug) {
        var pub = builderBlock(slug);
        var isLive = bodyIsBuilderManaged(slug);
        return { live: isLive, dirty: draftDiffers(slug),
                 sections: draftBlock(slug).sections.length,
                 /* How many sections are actually live, which is not the same
                    question as whether anything is -- an empty canvas is live
                    with none. */
                 liveSections: (pub && isArr(pub.sections)) ? pub.sections.length : 0,
                 updatedAt: (pub && str(pub.updatedAt)) || '' };
    }

    /* =====================================================
       RECOVERY SNAPSHOTS (milestone C)
       -----------------------------------------------------
       The builder already writes the draft to localStorage on a short
       debounce, so a reload or a crash loses at most the keystroke in
       flight. What it could not survive was the deliberate replacement of
       a draft -- applying a template over it, or discarding it -- because
       both are one click and neither had a way back.

       So this is not a history: it is ONE snapshot per page, taken
       immediately before those two actions, holding nothing but the
       sections array. Bounded by construction -- a new snapshot replaces
       the old one, and restoring or discarding removes it. Device-local
       like builderDrafts and builderLibrary: stripped from the publish
       payload, preserved across a pull.

       Sections go through pbCleanSections() on the way back out, so a
       snapshot that was tampered with in storage cannot put anything into
       a page that the builder's own controls could not have produced. */

    var PB_RECOVERY_REASONS = { template: 1, discard: 1, replace: 1 };

    function recoveryStore() {
        var st = load();
        if (!st.builderRecovery || typeof st.builderRecovery !== 'object' ||
            isArr(st.builderRecovery)) {
            st.builderRecovery = {};
        }
        return st.builderRecovery;
    }

    function recoverySnapshot(slug, sections, reason) {
        var key = str(slug);
        if (!key || !isArr(sections) || !sections.length) return false;
        var store = recoveryStore();
        store[key] = {
            at: pbToday(),
            reason: pbPick(PB_RECOVERY_REASONS, reason) ? str(reason) : 'replace',
            sections: clone(sections)
        };
        return save();
    }

    /* What is in the snapshot, cleaned. Returns null when there is none or
       when what is stored cannot be read as sections. */
    function recoveryGet(slug) {
        var snap = recoveryStore()[str(slug)];
        if (!snap || typeof snap !== 'object') return null;
        var sections = pbCleanSections(snap.sections);
        if (!sections.length) return null;
        return { at: str(snap.at), reason: str(snap.reason), sections: sections };
    }

    function recoveryClear(slug) {
        var store = recoveryStore();
        var key = str(slug);
        if (!Object.prototype.hasOwnProperty.call(store, key)) return false;
        delete store[key];
        return save();
    }

    /* =====================================================
       REUSABLE SECTION LIBRARY (milestone A, stage 7)
       -----------------------------------------------------
       Local to this browser, like builderDrafts: stripped from the publish
       payload and preserved across a pull, so a saved section is never part
       of what a visitor downloads and never travels between devices except
       through the export file a person chooses to move.

       An item holds a COPY of the section. Inserting one copies it again
       and re-ids it, so the page and the library entry have no link at all:
       editing either leaves the other alone. There are deliberately no
       live-linked instances -- nothing in the current architecture could
       keep them consistent across a publish.

       LIBRARY_VERSION marks the stored shape and the export file. It is a
       marker, not a gate: a file from a future version still imports,
       because every section in it goes through pbCleanSections() anyway. */

    var LIBRARY_VERSION = 1;

    function libraryStore() {
        var st = load();
        var lib = st.builderLibrary;
        if (!lib || typeof lib !== 'object' || !isArr(lib.items)) {
            lib = { version: LIBRARY_VERSION, items: [] };
            st.builderLibrary = lib;
        }
        if (typeof lib.version !== 'number') lib.version = LIBRARY_VERSION;
        return lib;
    }

    function libraryName(raw, fallback) {
        var n = str(raw).replace(/[\u0000-\u001f\u007f<>]/g, '').trim();
        if (n.length > 80) n = n.slice(0, 80);
        return n || fallback || 'Saved section';
    }

    function libraryList() {
        var items = libraryStore().items, out = [], i;
        for (i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || !it.section) continue;
            out.push({ id: it.id, name: it.name, createdAt: it.createdAt,
                       updatedAt: it.updatedAt, type: it.section.type,
                       elements: pbCountElements(it.section.elements, 0) });
        }
        return out;
    }

    /* A copy of the stored section, cleaned and re-ided: what the caller
       gets can be dropped straight into a page. */
    function libraryInstance(id) {
        var items = libraryStore().items, i;
        for (i = 0; i < items.length; i++) {
            if (items[i] && items[i].id === id) {
                var out = pbCleanSections([clone(items[i].section)]);
                return out.length ? pbReidSections(out)[0] : null;
            }
        }
        return null;
    }

    function librarySave(name, section) {
        var clean = pbCleanSections([section]);
        if (!clean.length) return null;
        var lib = libraryStore();
        var item = { id: pbNewId('lib'), name: libraryName(name, 'Saved section'),
                     createdAt: pbToday(), updatedAt: pbToday(), section: clean[0] };
        lib.items.push(item);
        save();
        return item.id;
    }

    function libraryFind(id) {
        var items = libraryStore().items;
        for (var i = 0; i < items.length; i++) {
            if (items[i] && items[i].id === id) return items[i];
        }
        return null;
    }

    function libraryRename(id, name) {
        var it = libraryFind(id);
        if (!it) return false;
        it.name = libraryName(name, it.name);
        it.updatedAt = pbToday();
        return save();
    }

    function libraryDuplicate(id) {
        var it = libraryFind(id);
        if (!it) return null;
        var lib = libraryStore();
        var copy = { id: pbNewId('lib'), name: libraryName(it.name + ' copy'),
                     createdAt: pbToday(), updatedAt: pbToday(),
                     section: clone(it.section) };
        lib.items.splice(lib.items.indexOf(it) + 1, 0, copy);
        save();
        return copy.id;
    }

    function libraryRemove(id) {
        var lib = libraryStore();
        for (var i = 0; i < lib.items.length; i++) {
            if (lib.items[i] && lib.items[i].id === id) {
                lib.items.splice(i, 1);
                return save();
            }
        }
        return false;
    }

    function libraryExport() {
        var lib = libraryStore();
        var out = { kind: 'jsk1-page-builder-library', version: LIBRARY_VERSION,
                    schemaVersion: PB_SCHEMA, exportedAt: pbToday(), items: [] };
        for (var i = 0; i < lib.items.length; i++) {
            var it = lib.items[i];
            if (!it || !it.section) continue;
            out.items.push({ name: it.name, createdAt: it.createdAt, section: clone(it.section) });
        }
        return JSON.stringify(out, null, 2);
    }

    /* Import never trusts the file. Every section is rebuilt by
       pbCleanSections(), so an entry carrying an unknown element type, a
       javascript: link, a style value that would close a CSS rule or a
       __proto__ key arrives as the clean part of itself or not at all. */
    function libraryImport(text) {
        var res = { added: 0, skipped: 0, error: '' };
        var data;
        try { data = JSON.parse(String(text == null ? '' : text)); }
        catch (e) { res.error = 'That file is not valid JSON.'; return res; }
        if (!data || typeof data !== 'object') { res.error = 'That file does not hold a library.'; return res; }
        var items = isArr(data.items) ? data.items : (isArr(data) ? data : null);
        if (!items) { res.error = 'That file does not hold a library.'; return res; }
        var lib = libraryStore();
        for (var i = 0; i < items.length && i < 500; i++) {
            var raw = items[i];
            if (!raw || typeof raw !== 'object') { res.skipped += 1; continue; }
            var section = raw.section || raw;
            var clean = pbCleanSections([section]);
            if (!clean.length) { res.skipped += 1; continue; }
            lib.items.push({ id: pbNewId('lib'),
                             name: libraryName(raw.name, 'Imported section'),
                             createdAt: pbToday(), updatedAt: pbToday(),
                             section: clean[0] });
            res.added += 1;
        }
        if (res.added) save();
        return res;
    }

    /* =====================================================
       PAGE TEMPLATES (milestone A, stage 8)
       -----------------------------------------------------
       A code registry, not a table: deterministic, diffable and testable.
       Every template is plain data in the existing section schema and goes
       through pbCleanSections() like anything else, so a template can never
       reach the page with something the builder's own controls could not
       have produced.

       Instantiating copies and re-ids, so editing a page never touches the
       registry and changing the registry never touches a page that was
       already created. `version` records which revision a page started
       from; it is provenance, not a link.

       The copy is what actually holds pages still. The version exists so a
       later change to a template is visibly a different revision rather
       than something that might have altered an existing page. */

    var PB_TEMPLATE_VERSION = 1;

    function tSec(type, elements, style) {
        return { type: type, enabled: true,
                 visibility: { desktop: true, tablet: true, mobile: true },
                 style: style || {}, responsive: {}, elements: elements || [] };
    }
    function tEl(type, content, style) {
        return { type: type, content: content || {}, style: style || {}, responsive: {} };
    }
    /* A columns element with its containers filled in. A layout preset alone
       is not enough: the containers are content, and an element with none
       renders nothing at all. */
    function tCols(preset, groups) {
        return tEl('columns', { columns: groups.map(function (g) { return { elements: g }; }) },
                   { columns: preset });
    }

    /* Placeholder copy only. Nothing here states a fact about the site --
       it is all visibly text waiting to be replaced.

       NO TEMPLATE OPENS WITH AN H1, and that is deliberate. Every page the
       builder can mount ships its own <h1 data-cms-text="pages.<slug>.heading">
       ABOVE the mount, so a template heading at h1 would guarantee a second
       one on a live page. The opening headings carry the @h1 TYPOGRAPHY role
       instead: they look like a page title and read as an h2 in the outline,
       which is what the document actually needs. An author who wants an h1
       in a section can still choose one -- the control offers it and the
       renderer honours it -- and the builder says plainly what that costs.
       See docs/page-builder.md, "Headings and the page H1". */
    var PB_TEMPLATES = [
        { id: 'blank', name: 'Blank page', version: PB_TEMPLATE_VERSION,
          description: 'One empty text section. Start from nothing.',
          sections: function () { return [tSec('text', [
              tEl('heading', { text: 'Page heading', level: 'h2' }, { typography: '@h1' }),
              tEl('text', { text: 'Write the first paragraph here.' })
          ])]; } },

        { id: 'landing', name: 'Landing page', version: PB_TEMPLATE_VERSION,
          description: 'A hero, three feature boxes, a short block of copy and a closing banner.',
          sections: function () { return [
              tSec('hero', [
                  tEl('heading', { text: 'Headline goes here', level: 'h2' }, { typography: '@h1' }),
                  tEl('text', { text: 'One or two sentences saying what this page is for.' }),
                  tEl('button', { text: 'Primary action', href: '#' }, { bg: '@primary' })
              ]),
              tSec('columns', [
                  tCols('3', [
                      [tEl('featureBox', { icon: 'star', title: 'First point',
                                           text: 'A sentence describing it.' })],
                      [tEl('featureBox', { icon: 'shield', title: 'Second point',
                                           text: 'A sentence describing it.' })],
                      [tEl('featureBox', { icon: 'bolt', title: 'Third point',
                                           text: 'A sentence describing it.' })]
                  ])
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Section heading', level: 'h2' }),
                  tEl('text', { text: 'Replace this paragraph with your own copy.' })
              ]),
              tSec('banner', [
                  tEl('heading', { text: 'Closing heading', level: 'h2' }),
                  tEl('button', { text: 'Secondary action', href: '#' }, { bg: '@primary' })
              ])
          ]; } },

        { id: 'information', name: 'Information page', version: PB_TEMPLATE_VERSION,
          description: 'A title, an introduction, three headed sections and a note.',
          sections: function () { return [
              tSec('text', [
                  tEl('heading', { text: 'Page title', level: 'h2' }, { typography: '@h1' }),
                  tEl('text', { text: 'A short introduction to what this page covers.' })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'First topic', level: 'h2' }),
                  tEl('text', { text: 'Replace with your own copy.' }),
                  tEl('divider', {}, { lineColor: '@border' }),
                  tEl('heading', { text: 'Second topic', level: 'h2' }),
                  tEl('text', { text: 'Replace with your own copy.' }),
                  tEl('divider', {}, { lineColor: '@border' }),
                  tEl('heading', { text: 'Third topic', level: 'h2' }),
                  tEl('text', { text: 'Replace with your own copy.' })
              ]),
              tSec('text', [
                  tEl('notice', { text: 'Use this box for anything a reader should not miss.',
                                  variant: 'info', icon: 'info' })
              ])
          ]; } },

        { id: 'contact', name: 'Contact page', version: PB_TEMPLATE_VERSION,
          description: 'A title, two columns for the ways to reach you, and social links.',
          sections: function () { return [
              tSec('text', [
                  tEl('heading', { text: 'Contact', level: 'h2' }, { typography: '@h1' }),
                  tEl('text', { text: 'Say when you reply and how long it usually takes.' })
              ]),
              tSec('columns', [
                  tCols('2', [
                      [tEl('heading', { text: 'Message us', level: 'h3' }),
                       tEl('text', { text: 'Put the best way to reach you here.' })],
                      [tEl('heading', { text: 'Support hours', level: 'h3' }),
                       tEl('text', { text: 'Put your hours here.' })]
                  ])
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Find us elsewhere', level: 'h2' }),
                  tEl('socialLinks', { items: [{ platform: 'whatsapp', url: '#' },
                                               { platform: 'telegram', url: '#' }] })
              ])
          ]; } },

        { id: 'feature', name: 'Feature page', version: PB_TEMPLATE_VERSION,
          description: 'A hero, three feature boxes, a card row and a closing action.',
          sections: function () { return [
              tSec('hero', [
                  tEl('heading', { text: 'What this offers', level: 'h2' }, { typography: '@h1' }),
                  tEl('text', { text: 'One sentence on who it is for.' })
              ]),
              tSec('columns', [
                  tCols('3', [
                      [tEl('featureBox', { icon: 'star', title: 'First feature',
                                           text: 'A sentence describing it.' })],
                      [tEl('featureBox', { icon: 'shield', title: 'Second feature',
                                           text: 'A sentence describing it.' })],
                      [tEl('featureBox', { icon: 'bolt', title: 'Third feature',
                                           text: 'A sentence describing it.' })]
                  ])
              ]),
              tSec('cards', [
                  tEl('card', { title: 'Card one', text: 'Replace this text.' }),
                  tEl('card', { title: 'Card two', text: 'Replace this text.' })
              ]),
              tSec('banner', [
                  tEl('heading', { text: 'Ready when you are', level: 'h2' }),
                  tEl('button', { text: 'Get started', href: '#' }, { bg: '@primary' })
              ])
          ]; } },

        { id: 'faq', name: 'FAQ page', version: PB_TEMPLATE_VERSION,
          description: 'A title, an accordion of three questions and a closing note.',
          sections: function () { return [
              tSec('text', [
                  tEl('heading', { text: 'Frequently asked questions', level: 'h2' },
                      { typography: '@h1' }),
                  tEl('text', { text: 'A line saying what these questions cover.' })
              ]),
              tSec('text', [
                  tEl('faq', { single: false, items: [
                      { question: 'First question?', answer: 'Answer.' },
                      { question: 'Second question?', answer: 'Answer.' },
                      { question: 'Third question?', answer: 'Answer.' }
                  ] })
              ]),
              tSec('text', [
                  tEl('notice', { text: 'Tell readers where to go if their question is not here.',
                                  variant: 'info', icon: 'question' })
              ])
          ]; } },

        /* ---- Phase 2B ----

           Two more starters, added to this registry rather than beside it.
           They exist for a reason beyond saving an author some clicks: a
           template is the only place in this file that shows how the
           elements are meant to go TOGETHER, and the elements added in this
           phase had nowhere demonstrating that.

           Same rules as every template above. Placeholder copy only --
           nothing here states a fact, quotes a real person, names a price
           or claims a number, because a template that ships an invented
           statistic is a template that publishes one. No h1, for the reason
           given above the registry. Every link is '#'. */

        { id: 'pricing', name: 'Pricing page', version: PB_TEMPLATE_VERSION,
          description: 'A heading, three plans to compare, a FAQ and a closing banner.',
          sections: function () { return [
              tSec('text', [
                  tEl('heading', { text: 'Choose a plan', level: 'h2' }, { typography: '@h1' }),
                  tEl('text', { text: 'A sentence saying what the plans have in common.' })
              ]),
              tSec('text', [
                  tEl('plans', { items: [
                      { title: 'First plan', subtitle: 'Who it suits', price: '0', period: '/mo',
                        f1: 'What is included', f2: 'And this', f3: 'And this',
                        ctaText: 'Choose', ctaHref: '#' },
                      { title: 'Second plan', subtitle: 'Who it suits', price: '00', period: '/mo',
                        highlight: true,
                        f1: 'Everything above', f2: 'Plus this', f3: 'And this',
                        ctaText: 'Choose', ctaHref: '#' },
                      { title: 'Third plan', subtitle: 'Who it suits', price: '000', period: '/mo',
                        f1: 'Everything above', f2: 'Plus this', f3: 'And this',
                        ctaText: 'Choose', ctaHref: '#' }
                  ] })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Questions about the plans', level: 'h2' }),
                  tEl('faq', { single: false, items: [
                      { question: 'First question?', answer: 'Answer.' },
                      { question: 'Second question?', answer: 'Answer.' }
                  ] })
              ]),
              tSec('banner', [
                  tEl('featureBox', { title: 'Still deciding?',
                                      text: 'Say what to do next.',
                                      linkText: 'Primary action', href: '#',
                                      linkText2: 'Or ask a question', href2: '#' })
              ])
          ]; } },

        { id: 'showcase', name: 'Showcase page', version: PB_TEMPLATE_VERSION,
          description: 'A contents list, numbers, a gallery, quotes and a closing call to action.',
          sections: function () { return [
              tSec('text', [
                  tEl('heading', { text: 'What this page shows', level: 'h2' },
                      { typography: '@h1' }),
                  tEl('text', { text: 'One or two sentences introducing it.' }),
                  tEl('toc', { title: 'On this page', depth: 'h3' })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'By the numbers', level: 'h2' }),
                  /* Zeroes, not plausible-looking figures: a placeholder a
                     reader could mistake for a real statistic is worse than
                     an obvious blank. */
                  tEl('stats', { items: [
                      { value: '0', label: 'What this counts' },
                      { value: '0', label: 'And this' },
                      { value: '0', label: 'And this' }
                  ] })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Pictures', level: 'h2' }),
                  /* Deliberately empty: the gallery says what to add rather
                     than shipping somebody else's photographs. */
                  tEl('text', { text: 'Add images to the gallery below in Page Builder.' }),
                  tEl('gallery', { items: [] })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'What people say', level: 'h2' }),
                  tEl('testimonials', { items: [
                      { quote: 'Replace this with something somebody actually said.',
                        name: 'Their name', role: 'Their role' },
                      { quote: 'And this with another.',
                        name: 'Their name', role: 'Their role' }
                  ] })
              ]),
              tSec('banner', [
                  tEl('featureBox', { title: 'Next step',
                                      text: 'Say what you want a reader to do.',
                                      linkText: 'Primary action', href: '#',
                                      linkText2: 'Secondary action', href2: '#' })
              ])
          ]; } }
,

        /* ---- Phase 2C content types ----
           Four starting points for the four kinds of page the content model
           knows. They are DATA, like every template above: no new element, no
           new CSS and no new renderer -- an article template is the elements
           that already existed, arranged the way an article usually goes.

           None of them states a fact about the site, invents a date or names a
           person. The content type, the publication date and the author are
           page SETTINGS, not content, so a template cannot and does not fill
           them in: that happens in Pages > Settings & SEO. */
        { id: 'article', name: 'Article', version: PB_TEMPLATE_VERSION,
          description: 'An introduction, a contents list, two sections and a related list.',
          sections: function () { return [
              tSec('text', [
                  tEl('text', { text: 'One paragraph saying what this article is about and who ' +
                                      'it is for.' }),
                  tEl('toc', { title: 'On this page', depth: 'h3' })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'The first thing to say', level: 'h2' }),
                  tEl('text', { text: 'Replace this with the first part of the article.',
                                rich: true })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'The second thing to say', level: 'h2' }),
                  tEl('text', { text: 'And this with the second.', rich: true })
              ]),
              tSec('text', [
                  tEl('pageList', { source: 'related', title: 'Related reading', titleLevel: 'h2',
                                    limit: 4, excerpt: true })
              ])
          ]; } },

        { id: 'guide', name: 'Guide', version: PB_TEMPLATE_VERSION,
          description: 'An introduction, a contents list, numbered steps, questions and a related list.',
          sections: function () { return [
              tSec('text', [
                  tEl('text', { text: 'What this guide covers, and what a reader will be able to ' +
                                      'do by the end of it.' }),
                  tEl('toc', { title: 'On this page', depth: 'h3' })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Before you start', level: 'h2' }),
                  tEl('list', { ordered: false, items: [
                      { text: 'The first thing a reader needs.' },
                      { text: 'And the second.' }
                  ] })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Step by step', level: 'h2' }),
                  tEl('list', { ordered: true, items: [
                      { text: 'The first step.' },
                      { text: 'The second step.' },
                      { text: 'The third step.' }
                  ] })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Questions', level: 'h2' }),
                  /* The faq element, which already publishes FAQPage data from
                     its own content. There is no 'faq' content type for the
                     same reason: one FAQPage per page, from one place. */
                  tEl('faq', { single: false, items: [
                      { question: 'A question a reader of this guide would ask?',
                        answer: 'The answer.' }
                  ] })
              ]),
              tSec('text', [
                  tEl('pageList', { source: 'related', title: 'Related guides', titleLevel: 'h2',
                                    limit: 4, excerpt: true })
              ])
          ]; } },

        { id: 'hub', name: 'Hub', version: PB_TEMPLATE_VERSION,
          description: 'An introduction and a list of every published page of one kind.',
          sections: function () { return [
              tSec('text', [
                  tEl('text', { text: 'One paragraph saying what this hub collects and why ' +
                                      'somebody would start here.' })
              ]),
              tSec('text', [
                  /* A heading of its OWN, not the listing's. A page list draws
                     nothing until the pages it lists exist, and a hub whose
                     only heading lived inside the listing would have no
                     heading at all on the day it was created. */
                  tEl('heading', { text: 'Guides', level: 'h2' }),
                  /* schema: true, so this one page publishes the ItemList that
                     describes what it collects. The renderer emits exactly the
                     rows it drew, so the two cannot disagree. */
                  tEl('pageList', { source: 'type', contentType: 'guide',
                                    limit: 12, excerpt: true, date: true,
                                    schema: true })
              ])
          ]; } },

        { id: 'help', name: 'Help article', version: PB_TEMPLATE_VERSION,
          description: 'A short answer, the detail behind it, questions and a related list.',
          sections: function () { return [
              tSec('text', [
                  tEl('notice', { variant: 'info', icon: 'question',
                                  text: 'The short answer, for a reader who only needs that.' })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'In more detail', level: 'h2' }),
                  tEl('text', { text: 'The longer explanation.', rich: true })
              ]),
              tSec('text', [
                  tEl('heading', { text: 'Related questions', level: 'h2' }),
                  tEl('faq', { single: true, items: [
                      { question: 'A related question?', answer: 'The answer.' }
                  ] })
              ]),
              tSec('text', [
                  tEl('pageList', { source: 'related', title: 'Related help', titleLevel: 'h2',
                                    limit: 4 })
              ])
          ]; } }
    ];

    /* ----------------------------------------------------------
       THE HEADINGS A SECTION TREE WOULD RENDER  (milestone E)

       Read-only, and the only thing in this file that knows why the
       admin cares: a builder-mounted page already has an h1 of its own,
       written into its HTML from pages.<slug>.heading, so the admin has
       to be able to say how many MORE the sections would add and which
       ones they are. Nothing here changes any content -- it answers a
       question, in the renderer's own terms, so the admin never has to
       keep a second idea of what a heading is.

       Returns { counts: { h1: n, ... }, items: [{ id, level, text }] }
       in document order. The level is resolved exactly as PB_ELEMENTS
       .heading resolves it, including its fallback to h2, so the answer
       is what the page would really show.
    ---------------------------------------------------------- */
    function pbHeadingLevel(el) {
        var lvl = String(((el || {}).content || {}).level || 'h2').toLowerCase();
        return pbPick(PB_ALL_LEVELS, lvl) ? lvl : 'h2';
    }

    /* ----------------------------------------------------------
       FAQPage, FROM THE FAQ ELEMENTS A PAGE ACTUALLY DRAWS

       WHY HERE AND NOT IN schemaBlocks(). The head's four blocks are
       computed from a PAGE RECORD -- its title, description, breadcrumb --
       and written into script elements the template already ships. An FAQ
       is not in the record; it is in the section tree, and the section tree
       is the thing that gets baked into the HTML. Emitting this block
       alongside the sections it describes means it is in the STATIC
       response for every page carrying an FAQ, committed template or
       CMS-generated alike, with no template to change and no head slot to
       add. It also cannot duplicate: the mount is rewritten whole on every
       render, so there is exactly one block per page, never two.

       It uses ldContext() and ldText(), which are what the head blocks use.
       There is no second JSON-LD framework here.

       WHAT IS LEFT OUT, AND WHY. Google's requirement is that the question
       and the answer are on the page. They are -- the FAQ element renders
       its answers into the HTML and hides the closed ones with `hidden`,
       which is display, not absence. But a question with no answer is
       dropped: a Question whose acceptedAnswer is empty is invalid
       structured data, and inventing text to fill it would be worse than
       saying nothing. A page whose FAQs yield no complete pair gets no
       block at all rather than an empty FAQPage.
    ---------------------------------------------------------- */
    function pbFaqEntries(sections) {
        var out = [];
        (function walkSecs(list) {
            if (!isArr(list)) return;
            for (var i = 0; i < list.length; i++) {
                var sec = list[i];
                if (!sec || sec.enabled === false) continue;
                walkEls(sec.elements, 0);
            }
        })(sections);
        function walkEls(list, depth) {
            if (!isArr(list) || depth > 4) return;
            for (var i = 0; i < list.length; i++) {
                var el = list[i];
                if (!el || el.enabled === false) continue;
                if (el.type === 'faq') {
                    var items = isArr((el.content || {}).items) ? el.content.items : [];
                    for (var j = 0; j < items.length; j++) {
                        var q = str((items[j] || {}).question);
                        var a = str((items[j] || {}).answer);
                        /* Both halves, or neither. */
                        if (q && a) out.push({ q: q, a: a });
                    }
                }
                var cols = (el.content || {}).columns;
                if (isArr(cols)) {
                    for (var c = 0; c < cols.length; c++) {
                        walkEls((cols[c] || {}).elements, depth + 1);
                    }
                }
            }
        }
        return out;
    }

    function pbFaqSchema(sections) {
        var rows = pbFaqEntries(sections);
        if (!rows.length) return null;
        var main = [];
        for (var i = 0; i < rows.length; i++) {
            main.push({ '@type': 'Question', name: rows[i].q,
                        acceptedAnswer: { '@type': 'Answer', text: rows[i].a } });
        }
        return { '@type': 'FAQPage', mainEntity: main };
    }

    function pbOutline(sections) {
        var out = { counts: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }, items: [] };
        (function walkSecs(list) {
            if (!isArr(list)) return;
            for (var i = 0; i < list.length; i++) {
                var sec = list[i];
                if (!sec || sec.enabled === false) continue;   /* a hidden section renders nothing */
                walkEls(sec.elements, 0);
            }
        })(sections);
        function walkEls(list, depth) {
            if (!isArr(list) || depth > 4) return;
            for (var i = 0; i < list.length; i++) {
                var el = list[i];
                if (!el || el.enabled === false) continue;
                if (el.type === 'heading') {
                    var lvl = pbHeadingLevel(el);
                    out.counts[lvl] += 1;
                    out.items.push({ id: str(el.id), level: lvl,
                                     text: str((el.content || {}).text) });
                }
                var cols = (el.content || {}).columns;
                if (isArr(cols)) {
                    for (var c = 0; c < cols.length; c++) {
                        walkEls((cols[c] || {}).elements, depth + 1);
                    }
                }
            }
        }
        return out;
    }

    function pbCountElements(list, depth) {
        var n = 0;
        if (!isArr(list) || depth > 4) return n;
        for (var i = 0; i < list.length; i++) {
            if (!list[i]) continue;
            n += 1;
            var cols = (list[i].content || {}).columns;
            if (isArr(cols)) {
                for (var c = 0; c < cols.length; c++) {
                    n += pbCountElements((cols[c] || {}).elements, depth + 1);
                }
            }
        }
        return n;
    }

    function templateList() {
        var out = [];
        for (var i = 0; i < PB_TEMPLATES.length; i++) {
            var t = PB_TEMPLATES[i];
            var secs = pbCleanSections(t.sections());
            /* Counted through the nesting: an author sees the feature boxes
               inside a columns element, not the columns element. */
            var els = 0;
            for (var j = 0; j < secs.length; j++) els += pbCountElements(secs[j].elements, 0);
            out.push({ id: t.id, name: t.name, version: t.version,
                       description: t.description, sections: secs.length, elements: els });
        }
        return out;
    }

    function templateFind(id) {
        var k = str(id);
        for (var i = 0; i < PB_TEMPLATES.length; i++) {
            if (PB_TEMPLATES[i].id === k) return PB_TEMPLATES[i];
        }
        return null;
    }

    /* A clean, freshly-ided copy. The registry entry is never handed out. */
    function templateSections(id) {
        var t = templateFind(id);
        if (!t) return null;
        return pbReidSections(pbCleanSections(t.sections()));
    }

    /* Slugs the builder can edit: the shipped mounts plus admin-created pages. */
    function builderPages() {
        var pages = load().pages || {}, out = [], k;
        for (k in pages) {
            if (!Object.prototype.hasOwnProperty.call(pages, k)) continue;
            /* pbPick for consistency with every other allow-list read by a
               stored name. Unreachable today -- these keys come from the
               admin's own pages object -- and said so rather than counted. */
            if (pbPick(PB_MOUNTED, k) || (pages[k] && pages[k].builderMount)) out.push(k);
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
            /* str() trims. Without it a description of three spaces is
               "truthy" and replaces a perfectly good static one with
               nothing -- the exact case the static-first rule exists to
               prevent. paintSeo() has always trimmed; this did not. */
            var v = str(get(el.getAttribute('data-cms-meta'), ''));
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

    /* ========================================================
       GLOBAL FOOTER — sanitise, then render over the static markup

       Everything reaching here is untrusted. The Supabase row needs an
       authenticated write, but localStorage does not, and Admin > Data >
       Import JSON.parses an arbitrary file straight into the config. So
       this treats its input as hostile and hands back only data it built
       itself: new objects, strings it has capped, hrefs pbUrl approved.
    ======================================================== */

    var FOOTER_MAX_COLS = 6;      /* the grid is repeat(auto-fit, minmax(150px,1fr)) */
    var FOOTER_MAX_LINKS = 12;    /* navigation, not a keyword farm */
    var FOOTER_MAX_TITLE = 40;
    var FOOTER_MAX_LABEL = 60;

    /* A capped single-line string. Newlines and control characters go:
       a column title is a label, and a label with a newline in it is
       either an accident or someone probing. */
    function footerStr(v, max) {
        /* Only a real string is text, and this is deliberately stricter
           than str(). Two things go wrong otherwise, both reachable from
           an imported JSON file:

             {"title":{"toString":"x"}}  -- String(v) looks up toString,
             finds a string where a function belongs, and THROWS
             "Cannot convert object to primitive value". On the public
             page that killed the render.

             {"title":{"a":1}}           -- String(v) quietly yields
             "[object Object]", which then shipped as a column heading.

           Neither is a label, so neither gets to be one. A number is
           accepted because a title of "2026" is a reasonable thing to
           type and arrives from JSON as a number. */
        if (typeof v === 'number' && isFinite(v)) v = String(v);
        if (typeof v !== 'string') return '';
        return v.replace(/[\u0000-\u001f\u007f]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, max);
    }

    /* An href for a footer link. pbUrl is the site's existing answer to
       "is this safe in an href": it rejects control characters,
       protocol-relative //host, and every scheme but http(s)/mailto/tel,
       plus plain relative paths and #/ fragments. External https is
       allowed on purpose -- a licensing authority or payment partner is a
       legitimate footer link -- and isFooterExternal() below decides the
       rel, so an external link never ships without noopener. */
    function footerHref(v) {
        /* Same reasoning as footerStr: an href of {"toString":"x"} makes
           String() throw, and str() -- and pbUrl() through it -- would
           carry that straight onto the public page. A URL is a string. */
        if (typeof v !== 'string') return '';
        var raw = v.trim();

        /* './' is the site root and is what the static footer already
           writes for Home. pbUrl says no to it -- its relative-path branch
           requires a leading word character -- so it is allowed here, as
           an exact match only. './/evil' and './../x' are not this string
           and fall through to pbUrl, which refuses them. */
        if (raw === './') return raw;

        var u = pbUrl(raw);
        if (!u) return '';

        /* pbUrl lets '#' through; a footer link to nowhere is not a link. */
        if (u === '#') return '';

        /* No traversal. pbUrl's relative branch would accept
           'about/../../etc' because it starts with a word character. That
           is fine for an author-typed Page Builder link and pointless in
           site navigation, so the footer is stricter than its floor. */
        if (u.indexOf('..') > -1) return '';

        return u;
    }

    function isFooterExternal(u) {
        return /^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u);
    }

    /* The whole footer, rebuilt from scratch, or null.

       null means "leave the static HTML alone", and it is returned for
       anything this cannot vouch for: no data, not an array, an empty
       array, or every column dropped. That is the static-first contract
       -- the fallback is not a second code path, it is what happens when
       this declines to produce one. */
    function cleanFooter(raw) {
        if (!raw || typeof raw !== 'object' || isArr(raw)) return null;
        if (!isArr(raw.columns)) return null;

        var cols = [], i, j;
        for (i = 0; i < raw.columns.length && cols.length < FOOTER_MAX_COLS; i++) {
            var c = raw.columns[i];
            /* An array is an object to typeof, and a string has .length.
               Neither is a column. */
            if (!c || typeof c !== 'object' || isArr(c)) continue;
            if (c.enabled === false) continue;

            var title = footerStr(c.title, FOOTER_MAX_TITLE);
            if (!title) continue;           /* a nameless column labels no nav */
            if (!isArr(c.links)) continue;

            var links = [];
            for (j = 0; j < c.links.length && links.length < FOOTER_MAX_LINKS; j++) {
                var l = c.links[j];
                if (!l || typeof l !== 'object' || isArr(l)) continue;
                if (l.enabled === false) continue;
                var label = footerStr(l.label, FOOTER_MAX_LABEL);
                var href = footerHref(l.href);
                /* Both or neither. A link with no text is unreachable to a
                   screen reader; one with no safe href is not a link. */
                if (!label || !href) continue;
                links.push({ label: label, href: href, external: isFooterExternal(href) });
            }

            if (!links.length) continue;    /* an empty column is not a column */
            cols.push({ title: title, links: links });
        }

        return cols.length ? cols : null;
    }

    /* Read the saved footer, sanitised. Exposed for the admin and tests. */
    function footerColumns() {
        var raw = load().footer;
        return cleanFooter(raw);
    }

    /* Render the navigation columns over the static ones.

       The host is <div class="footer-cols" data-cms-footer> and it also
       holds the Brand and Support columns, which are NOT ours: they are
       marked data-footer-keep in the generated markup and are moved
       across untouched, in their original order relative to the block of
       navigation columns. Nothing here is built with innerHTML -- every
       title and label goes in as textContent, so markup in a CMS value is
       shown, never parsed. */
    function renderFooter() {
        var host = document.querySelector('[data-cms-footer]');
        if (!host) return;

        var cols = footerColumns();
        if (!cols) return;              /* static markup stands. */

        var keep = [], k;
        var kids = host.children;
        for (k = 0; k < kids.length; k++) {
            if (kids[k].hasAttribute && kids[k].hasAttribute('data-footer-keep')) {
                keep.push(kids[k]);
            }
        }

        var frag = document.createDocumentFragment();
        /* Brand first, then ours, then Support -- the shipped order. The
           kept nodes carry data-footer-keep="brand" / "support"; anything
           else marked keep is emitted after the columns rather than
           dropped, so a future kept block cannot vanish silently. */
        var brand = [], tail = [];
        for (k = 0; k < keep.length; k++) {
            if (keep[k].getAttribute('data-footer-keep') === 'brand') brand.push(keep[k]);
            else tail.push(keep[k]);
        }
        for (k = 0; k < brand.length; k++) frag.appendChild(brand[k]);

        for (k = 0; k < cols.length; k++) {
            var col = cols[k];

            var box = document.createElement('div');
            box.className = 'footer-col';

            var h = document.createElement('h2');
            h.className = 'footer-col-title';
            h.textContent = col.title;
            box.appendChild(h);

            var nav = document.createElement('nav');
            nav.className = 'footer-links';
            /* The accessible name comes from the same text the heading
               shows, so the landmark is never nameless. */
            nav.setAttribute('aria-label', col.title);

            for (var m = 0; m < col.links.length; m++) {
                var a = document.createElement('a');
                a.setAttribute('href', col.links[m].href);
                if (col.links[m].external) {
                    a.setAttribute('rel', 'noopener');
                }
                a.textContent = col.links[m].label;
                nav.appendChild(a);
            }

            box.appendChild(nav);
            frag.appendChild(box);
        }

        for (k = 0; k < tail.length; k++) frag.appendChild(tail[k]);

        /* One write. The kept nodes are already in the fragment, so
           clearing the host does not destroy them. */
        host.textContent = '';
        host.appendChild(frag);
    }


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
        paintSchemaLate();
        harvest();
        renderFeatured();
        renderCategories();
        renderSports();
        renderCasino();
        renderFooter();
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

    /* ----- which KIND of key is configured -----
       Supabase issues two formats now:

         eyJ...                 the legacy anon key. A JWT. The gateway
                                accepts it in `apikey` and in
                                `Authorization: Bearer`, and every
                                deployment of this CMS so far sends both.
         sb_publishable_...     the current publishable key. NOT a JWT.
                                The gateway reads it from `apikey` and
                                mints the anon token itself.

       Supabase's migration notes are explicit that a publishable key does
       not belong in `Authorization: Bearer` -- anything that tries to
       parse it as a JWT rejects the request. So the header is sent only
       for a key that really is one. A legacy key takes exactly the path it
       always did, byte for byte, which is what keeps an older white-label
       deployment working without touching its config. */
    function opaqueKey(k) { return /^sb_/.test(String(k || '')); }

    /* An sb_secret_... or service_role key here would hand every visitor
       full database access, because this file is downloaded by every
       visitor. There is no safe way to continue, so this does not
       continue: remote storage stays off and the page falls back to the
       cached brand, which is a bad afternoon rather than a breach. */
    var SECRET_KEY_CONFIGURED = /^sb_secret_/.test(String(RC.anonKey || '')) ||
                                /"role"\s*:\s*"service_role"/.test(
                                    (function (k) {
                                        try { return atob(String(k).split('.')[1] || ''); }
                                        catch (e) { return ''; }
                                    })(RC.anonKey));

    if (SECRET_KEY_CONFIGURED) {
        console.error('[CMS] js/cms-config.js holds a SECRET key. That file is public. ' +
                      'Remote storage is disabled. Replace it with the publishable key ' +
                      '(sb_publishable_...) and rotate the secret immediately.');
    }

    var REMOTE_ON = !!(RC.enabled && RC.url && RC.anonKey) && !SECRET_KEY_CONFIGURED;
    /* Scoped for the same reason, and more sharply: an admin signed in to
       one brand must not appear signed in to another served from the same
       origin. The token is only ever accepted by the project it came
       from, so this is about not presenting a stale session as a live
       one rather than about privilege -- but a sign-in box that lies is
       its own kind of bug. */
    var TOKEN_KEY = (window.CMS_STORAGE && typeof window.CMS_STORAGE.key === 'function')
        ? window.CMS_STORAGE.key('cmsAdminToken')
        : 'cmsAdminToken';

    function rurl(path) {
        return String(RC.url).replace(/\/+$/, '') + path;
    }

    function baseHeaders() {
        var h = {
            'apikey': RC.anonKey,
            'Content-Type': 'application/json'
        };
        if (!opaqueKey(RC.anonKey)) h['Authorization'] = 'Bearer ' + RC.anonKey;
        return h;
    }

    function token() {
        try { return window.sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
    }

    /* ============================================================
       WHICH BRAND IS THIS?
       ------------------------------------------------------------
       js/cms-config.js already answers that on every page load: it
       turns the hostname into a siteId, a media bucket and a
       storage suffix. Nothing here re-derives any of it -- a second
       answer to "which brand is this?" is a second thing to keep in
       step, and the two would eventually disagree.

       This exposes the answer so the admin can SAY which brand it
       is editing instead of leaving it to be inferred from the URL,
       and so a test can assert it. It adds no data and no defaults;
       every field is something the resolution block already
       published on `window`.

       There are no brand names anywhere in here on purpose. A
       fourth brand is a registry entry, not an edit to this file.
       ============================================================ */

    /* The row the REGISTRY says this hostname should write. Empty when
       a deployment declares no registry at all -- an older or minimal
       js/cms-config.js that sets CMS_REMOTE and nothing else. That is
       not a gap: with no registry there is exactly one brand, so there
       is nothing a write could cross. */
    function registrySiteId() {
        var brands = window.CMS_BRANDS;
        if (!brands || typeof brands !== 'object') return '';
        var resolved = window.CMS_BRAND_RESOLVED || {};
        var host = String(resolved.host || '');
        if (Object.prototype.hasOwnProperty.call(brands, host) && brands[host]) {
            return String(brands[host].siteId || '');
        }
        var dflt = String(window.CMS_BRAND_DEFAULT || '');
        if (Object.prototype.hasOwnProperty.call(brands, dflt) && brands[dflt]) {
            return String(brands[dflt].siteId || '');
        }
        return '';
    }

    var Brand = {

        /* The hostname this page was served from, normalised by
           cms-config.js (lower-cased, one trailing dot removed). */
        host: function () { return String((window.CMS_BRAND_RESOLVED || {}).host || ''); },

        /* True when that hostname is a registered brand. False on
           localhost, a CI run, a preview URL or a file:// open, which all
           fall back to CMS_BRAND_DEFAULT and are NOT that brand -- they
           merely render it. The admin says so rather than letting someone
           believe they are editing the live site. */
        matched: function () { return (window.CMS_BRAND_RESOLVED || {}).matched === true; },

        /* The Supabase row this brand's content lives in. The single thing
           that keeps two brands apart. */
        siteId: function () { return String((window.CMS_REMOTE || {}).siteId || ''); },

        bucket: function () { return String((window.CMS_MEDIA || {}).bucket || ''); },

        /* The browser-storage namespace. '' for the one brand whose keys
           predate brand scoping. */
        storageSuffix: function () { return String((window.CMS_STORAGE || {}).suffix || ''); },

        /* A deployment that must never be indexed -- a staging or review
           host. Set by an environment build, undefined otherwise. */
        noindex: function () { return window.CMS_NOINDEX === true; },

        /* Every brand this deployment knows, from the registry. Read-only,
           and deliberately not editable from the CMS: the registry is
           committed code reviewed in a diff, not content. */
        all: function () {
            var brands = window.CMS_BRANDS || {}, out = [], k;
            for (k in brands) {
                if (!Object.prototype.hasOwnProperty.call(brands, k) || !brands[k]) continue;
                out.push({
                    host: k,
                    siteId: String(brands[k].siteId || ''),
                    bucket: String(brands[k].bucket || ''),
                    current: k === Brand.host()
                });
            }
            out.sort(function (a, b) { return a.host < b.host ? -1 : a.host > b.host ? 1 : 0; });
            return out;
        },

        /* What the registry expects this host to write, for the guard in
           publish() and for anything that wants to check agreement. */
        expectedSiteId: registrySiteId,

        /* Does the row we are about to write belong to this hostname? */
        agrees: function () {
            var want = registrySiteId();
            return !want || want === Brand.siteId();
        }
    };

    /* ========================================================
       PUBLISH READ-BACK
       ------------------------------------------------------
       Reads the row straight back and checks that its updated_at is the
       one we just sent. Only then has a publish happened.

       WHY NOT COMPARE THE STRINGS. We send an ISO string from JavaScript:

           2026-09-27T12:00:00.000Z

       updated_at is a timestamptz, and Postgres renders it its own way:

           2026-09-27T12:00:00+00:00

       Those are the same instant and different strings, so a string
       comparison would fail EVERY time and report every successful publish
       as a failure. Compare the instants.

       A value that parses but differs means the row moved under us -- some
       other browser published after our POST -- so this is not "published",
       and saying so is the point.
    ======================================================== */
    function sameInstant(a, b) {
        var x = Date.parse(a), y = Date.parse(b);
        return !isNaN(x) && !isNaN(y) && x === y;
    }

    function confirmWrite(sentStamp) {
        var url = rurl('/rest/v1/' + RC.table + '?id=eq.' +
                       encodeURIComponent(RC.siteId) + '&select=updated_at');
        return fetch(url, { headers: baseHeaders(), cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('Written, but the check failed: HTTP ' + r.status);
                return r.json();
            })
            .then(function (rows) {
                var got = rows && rows.length ? rows[0].updated_at : null;
                if (!got) {
                    throw new Error('The server accepted the write but the row ' +
                                    'could not be read back, so it is not confirmed.');
                }
                if (!sameInstant(got, sentStamp)) {
                    throw new Error('The server did not confirm this write: the row ' +
                                    'now reads ' + String(got) + ', not what was just sent. ' +
                                    'Nothing is confirmed published.');
                }
                /* Confirmed. Record it -- device-local, so it is stripped from
                   the next payload and from an export. The index moves with
                   it: from here on, "changed" means changed since THIS. */
                var st = load();
                st.lastPublished = { serverUpdatedAt: str(got), at: new Date().toISOString() };
                st.publishIndex = changeIndex(st);
                save();
                return true;
            });
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
                    var local = load() || {};
                    var localDrafts = local.builderDrafts;
                    var localLibrary = local.builderLibrary;
                    var localRecovery = local.builderRecovery;
                    /* server wins — localStorage is only a cache here */
                    state = merge(merge(DEFAULTS, window.CMS_BRAND || null), remoteData);
                    if (localDrafts && Object.keys(localDrafts).length) {
                        state.builderDrafts = localDrafts;
                    }
                    /* Same reasoning: the library lives on this device, so a
                       row that does not carry it must not wipe it. */
                    if (localLibrary && isArr(localLibrary.items) && localLibrary.items.length) {
                        state.builderLibrary = localLibrary;
                    }
                    if (localRecovery && Object.keys(localRecovery).length) {
                        state.builderRecovery = localRecovery;
                    }
                    /* The publish bookkeeping is this browser's own and the
                       row never carries it, so it survives a pull for exactly
                       the same reason the three above do. */
                    if (local.publishIndex && Object.keys(local.publishIndex).length) {
                        state.publishIndex = local.publishIndex;
                    }
                    /* The row's own updated_at, kept as the server spelled
                       it. Discarded until now -- publish() needs it to say
                       when this brand was last published, and a read-back
                       has nothing to compare against without it. */
                    state.lastPublished = merge(local.lastPublished || {}, {
                        serverUpdatedAt: str(rows[0].updated_at)
                    });
                    /* And the index is re-seeded from what just arrived,
                       because the row IS the published state. Without this the
                       review sheet would report every area as changed on a
                       browser that had merely loaded the admin. Note this runs
                       AFTER the local drafts are restored above, and the index
                       never covers them. */
                    state.publishIndex = changeIndex(state);
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

        /* ------------------------------------------------------
           RELOAD vs DISCARD — two different questions
           ------------------------------------------------------
           baseline()     What is published right now? Updates only this
                          browser's idea of the published state -- the change
                          index and the row's timestamp -- and leaves local
                          edits alone. Safe to press with unsaved work.

           discardLocal() Throw this browser's unpublished work away and go
                          back to what is published. Destructive, and the
                          caller confirms first.

           They used to be one button called Revert, which did neither: it
           re-read localStorage, so it reverted to the last LOCAL save rather
           than to anything the server had.
           ------------------------------------------------------ */

        /* Non-destructive. Answers "what is published?" without touching what
           is being edited, so pressing it can never lose work. */
        baseline: function () {
            if (!REMOTE_ON) return Promise.resolve({ found: false, remote: false });
            var url = rurl('/rest/v1/' + RC.table + '?id=eq.' +
                           encodeURIComponent(RC.siteId) + '&select=data,updated_at');
            return fetch(url, { headers: baseHeaders(), cache: 'no-store' })
                .then(function (r) {
                    if (!r.ok) throw new Error('HTTP ' + r.status);
                    return r.json();
                })
                .then(function (rows) {
                    var st = load();
                    if (!rows || !rows.length || !rows[0].data) {
                        /* No row yet: nothing is published, so nothing is a
                           baseline. Saying so is the point -- an empty index
                           means the review sheet lists everything, which is
                           true. */
                        st.publishIndex = {};
                        st.lastPublished = { serverUpdatedAt: '' };
                        save();
                        return { found: false, remote: true };
                    }
                    /* The published state is DEFAULTS + brand.js + the row,
                       which is what a visitor assembles and what a publish
                       would send. Hashed without disturbing `state`. */
                    var published = merge(merge(DEFAULTS, window.CMS_BRAND || null), rows[0].data);
                    st.publishIndex = changeIndex(published);
                    st.lastPublished = merge(st.lastPublished || {},
                                             { serverUpdatedAt: str(rows[0].updated_at) });
                    save();
                    return { found: true, remote: true, updatedAt: str(rows[0].updated_at) };
                });
        },

        /* Destructive, by request. Goes back to what is published -- or, when
           nothing has ever been published for this brand, to the defaults the
           repository ships.

           Page Builder drafts, the section library and the recovery snapshots
           are KEPT: they are page-level work, not brand-level settings, and
           each page can already discard its own draft. */
        discardLocal: function () {
            var keep = {}, i;
            var before = load();
            for (i = 0; i < LOCAL_ONLY_KEYS.length; i++) {
                keep[LOCAL_ONLY_KEYS[i]] = before[LOCAL_ONLY_KEYS[i]];
            }
            function finish(source, index) {
                for (i = 0; i < LOCAL_ONLY_KEYS.length; i++) {
                    if (keep[LOCAL_ONLY_KEYS[i]] !== undefined) {
                        state[LOCAL_ONLY_KEYS[i]] = keep[LOCAL_ONLY_KEYS[i]];
                    }
                }
                state.publishIndex = index;
                save();
                apply();
                return { source: source };
            }
            if (!REMOTE_ON) {
                state = merge(DEFAULTS, window.CMS_BRAND || null);
                return Promise.resolve(finish('defaults', {}));
            }
            return Remote.pull().then(function (remoteData) {
                if (remoteData) {
                    /* pull() already replaced state with the server's version
                       and preserved the device-local keys; the index it seeded
                       is the published one. */
                    return { source: 'server' };
                }
                /* Nothing published for this brand. Falling back to the shipped
                   defaults, and the caller says so in those words rather than
                   claiming a server restore that did not happen. */
                state = merge(DEFAULTS, window.CMS_BRAND || null);
                return finish('defaults', {});
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

            /* The row being written must be the row this hostname resolves
               to. Today that is structurally true -- RC.siteId comes from
               the same resolution block -- and this makes it an asserted
               invariant rather than a property of the current shape, so a
               later refactor cannot quietly make one brand's admin write
               another brand's content. That mistake is unrecoverable
               without a backup: the row is overwritten wholesale.

               Generic on purpose. It names no brand; it compares what the
               registry says to what is configured. */
            if (!Brand.agrees()) {
                return Promise.reject(new Error(
                    'Refusing to publish: this page is served from "' + Brand.host() +
                    '", which the brand registry maps to row "' + Brand.expectedSiteId() +
                    '", but the CMS is configured to write row "' + Brand.siteId() +
                    '". One brand must never overwrite another\'s content.'));
            }

            /* Drafts are working state, not published content. Sending them
               would put unpublished copy in the public row, which every
               visitor downloads with the anon key. The library and the
               recovery snapshots are local by the same decision, and the
               publish bookkeeping describes this browser rather than the
               brand. One list, shared with exportJSON(). */
            var payload = withoutLocalKeys(load());

            /* Held in a variable because the read-back below compares
               against it. Inlining it, as this did, left nothing to check
               the server's answer against. */
            var sentStamp = new Date().toISOString();

            var body = JSON.stringify({
                id: RC.siteId,
                data: payload,
                updated_at: sentStamp
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
                /* A 2xx says the request was accepted. It does NOT say the
                   row now holds what we sent, and this used to be the whole
                   proof -- so the admin reported "Published" on the strength
                   of a status code. Read the row back instead. */
                return confirmWrite(sentStamp);
            });
        },

        /* ------------------------------------------------------
           UPLOADED CMS MEDIA
           Storage writes are authenticated with the ADMIN's own
           session token, exactly as publish() is. The anon key
           never carries write rights, here or anywhere else, and
           no other credential exists in this codebase to leak.
           ------------------------------------------------------ */
        mediaEnabled: function () { return REMOTE_ON && !!mediaBucket(); },

        /* `key` is generated by the caller and re-validated here against
           the one shape this CMS writes, so a bug upstream still cannot
           put an object anywhere else in the bucket. */
        uploadMedia: function (key, blob, mime) {
            if (!Remote.mediaEnabled()) return Promise.reject(new Error('Media uploads are not configured'));
            var t = token();
            if (!t) return Promise.reject(new Error('Not signed in'));
            if (!MEDIA_KEY_RE.test(String(key))) return Promise.reject(new Error('Refusing to write that object name'));
            return fetch(rurl('/storage/v1/object/' + mediaBucket() + '/' + key), {
                method: 'POST',
                headers: {
                    'apikey': RC.anonKey,
                    'Authorization': 'Bearer ' + t,
                    'Content-Type': String(mime),
                    'x-upsert': 'false',
                    'Cache-Control': '31536000'
                },
                body: blob
            }).then(function (r) {
                if (r.status === 401 || r.status === 403) {
                    throw new Error('Not allowed to upload — check the bucket policy, then sign in again');
                }
                if (!r.ok) {
                    return r.text().then(function (txt) {
                        throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 200));
                    });
                }
                return mediaBase() + key;
            });
        },

        removeMedia: function (key) {
            if (!Remote.mediaEnabled()) return Promise.reject(new Error('Media uploads are not configured'));
            var t = token();
            if (!t) return Promise.reject(new Error('Not signed in'));
            if (!MEDIA_KEY_RE.test(String(key))) return Promise.reject(new Error('Refusing to delete that object name'));
            return fetch(rurl('/storage/v1/object/' + mediaBucket() + '/' + key), {
                method: 'DELETE',
                headers: { 'apikey': RC.anonKey, 'Authorization': 'Bearer ' + t }
            }).then(function (r) {
                if (!r.ok && r.status !== 404) {
                    return r.text().then(function (txt) {
                        throw new Error('HTTP ' + r.status + ' ' + txt.slice(0, 200));
                    });
                }
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

        /* ----------------------------------------------------------------
           THE SEO COMPUTATIONS, NAMED.

           Every entry is a REFERENCE to the function paintSeo() itself uses
           -- not a wrapper, not a reimplementation -- so a second caller
           cannot compute a page's title, description, canonical, social tags
           or structured data differently from the page a visitor is served.
           `tags` is the whole set as data and is what paintSeo() applies.

           The flat seo*For aliases below are the earlier spelling of the
           same references. js/admin.js reads them, so they stay.
           ---------------------------------------------------------------- */
        seo: {
            title: computeTitle,
            description: computeDescription,
            og: computeOg,
            twitter: computeTwitter,
            robots: robotsValue,
            url: pageUrl,
            jsonLd: schemaBlocks,
            breadcrumb: buildBreadcrumb,

            /* Everything paintSeo() would write, as data:
               { title, metas:[{attr,name,content}], links:[{rel,href}],
                 jsonLd:{ldOrganization,ldWebSite,ldPage,ldBreadcrumb} } */
            tags: seoTags,

            /* The page record a slug resolves to. Takes the slug explicitly,
               so a caller without a document can ask. */
            page: pageData,

            /* The two URL filters the tags above apply, exposed so a caller
               treats an image or a relative URL exactly as the tags do. */
            image: crawlableImage,
            absUrl: absUrl
        },

        /* ========================================================
           THE CONTENT MODEL (Phase 2C)
           --------------------------------------------------------
           One place every caller asks about content types, dates, authors
           and which pages exist. The admin's checks, the build's SEO and the
           listing element all read these, and nothing grows a second answer.

           `pages` takes the record explicitly: see publishedPages().
        ======================================================== */
        content: {
            types: PB_CONTENT_TYPES,
            listSources: PB_LIST_SOURCES,
            type: pageType,
            ogType: pageOgType,
            isoDate: isoDate,
            publishedAt: pagePublished,
            modifiedAt: pageModified,
            author: pageAuthor,
            authorFrom: authorFrom,
            isPublished: pageIsPublished,
            isIndexable: pageIsIndexable,
            fileName: pageFileName,
            summary: pageSummary,
            pages: publishedPages,
            related: relatedPages,
            article: buildArticle,
            itemList: pbListSchema
        },

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
        /* A backup of the brand's content. The device-local keys are removed
           for the same reason Remote.publish() removes them: a backup is the
           brand, not one machine's working state. This used to strip
           nothing, so a downloaded file carried unpublished Page Builder
           drafts and the reusable-section library that /admin promises never
           leaves the device.

           Published content is untouched -- pages.<slug>.builder is content
           and stays in. */
        exportJSON: function () { return JSON.stringify(withoutLocalKeys(load()), null, 2); },

        /* The one list, readable so a test can assert the two consumers
           agree rather than restating the names and drifting from them. */
        localOnlyKeys: function () { return LOCAL_ONLY_KEYS.slice(); },

        /* What a publish would change, for the review sheet. */
        changeIndex: changeIndex,
        changedAreas: changedAreas,
        refreshPublishIndex: refreshPublishIndex,
        themes: Themes,
        brand: Brand,
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
            /* A URL that is safe INSIDE url(...): pbUrl's scheme rules plus a
               refusal of every character that could close the function or the
               declaration around it. Exported so the admin's share-card
               preview uses this rather than a second copy of the rules. */
            safeCssUrl: pbCssUrl,
            elementStyleKeys: PB_EL_STYLE_KEYS,
            sectionStyleKeys: PB_SEC_STYLE_KEYS,
            /* What a container inside a columns element can be given, and
               the name lists its layout controls choose from. Exported for
               the same reason icons and column presets are: the admin
               builds its controls from the renderer's own lists. */
            containerStyleKeys: PB_CONTAINER_STYLE_KEYS,
            layoutNames: { direction: PB_DIRECTIONS, justify: PB_JUSTIFY,
                           alignItems: PB_ALIGN_ITEMS, wrap: PB_WRAP },
            icons: PB_ICONS,
            social: PB_SOCIAL,
            /* Phase 2A allow-lists, exported for the same reason icons and
               social are: the admin builds its controls from the
               renderer's own lists, so it can never offer a value the
               renderer would refuse, and there is no second copy to drift. */
            textTags: PB_TEXT_TAGS,
            tocDepths: PB_TOC_DEPTHS,
            tableMaxCols: PB_TABLE_MAX_COLS,
            /* Which video addresses become an embed, answered by the one
               function that decides it -- so the admin can tell an author
               what will happen to the address they pasted without holding a
               second copy of the patterns. */
            videoRef: pbVideoRef,
            videoHosts: PB_VIDEO_HOSTS.map(function (h) { return h.name; }),
            colLayouts: PB_COL_LAYOUTS,
            /* Global design (stage 6). `roleColor`/`roleTypo` resolve a role
               the way the stylesheet does, which is what lets the admin show
               an author the colour a role is currently worth. */
            colorRoles: PB_COLOR_ROLES,
            typoRoles: PB_TYPO_ROLES,
            typoProps: PB_TYPO_PROPS,
            typoSite: PB_TYPO_SITE,
            roleColor: pbRoleColor,
            roleTypo: pbRoleTypo,
            designCSS: designCSS,
            paintDesign: paintDesign,
            sectionTokens: PB_SEC_TOKENS,
            elementTokens: PB_EL_TOKENS,

            /* Renders sections into any host node, for the admin's library
               preview. Same factories as the public page, so what is shown
               is what would be published. */
            renderInto: renderSectionsInto,

            /* untrusted data in, clean sections out */
            /* asset paths (milestone B) */
            assetPath: pbAsset,
            assetList: pbAssetList,
            assetRoots: PB_ASSET_ROOTS,
            mediaPath: pbMedia,
            mediaList: mediaList,
            mediaBase: mediaBase,
            imageRef: pbImageRef,

            sanitize: pbCleanSections,
            reid: pbReidSections,
            contentKeys: PB_CONTENT_KEYS,

            /* reusable section library (device-local) */
            library: {
                version: LIBRARY_VERSION,
                list: libraryList,
                save: librarySave,
                rename: libraryRename,
                duplicate: libraryDuplicate,
                remove: libraryRemove,
                instance: libraryInstance,
                exportJSON: libraryExport,
                importJSON: libraryImport
            },

            /* recovery snapshots (milestone C, device-local) */
            recovery: {
                snapshot: recoverySnapshot,
                get: recoveryGet,
                clear: recoveryClear
            },

            /* what a tree would render, read-only (milestone E) */
            outline: pbOutline,
            /* The FAQ pairs a section tree would publish, and the FAQPage
               block built from them -- the same ones the renderer bakes, so
               the admin's checks judge what the page will really say. */
            faqPairs: pbFaqEntries,
            faqSchema: pbFaqSchema,

            /* page templates (code registry) */
            templates: templateList,
            templateVersion: PB_TEMPLATE_VERSION,
            fromTemplate: templateSections,

            /* Build-source fingerprints. One algorithm, three callers: the
               admin's export, the build's integrity guard, and the networked
               freshness check. */
            fingerprint: builderFingerprint,
            fingerprints: builderFingerprints,

            /* the body-migration path (milestone: builder-managed pages) */
            fromPageBody: pbSectionsFromBody,
            bodyManaged: bodyIsBuilderManaged,

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
        footer: {
            columns: footerColumns,     /* saved footer, sanitised, or null */
            clean: cleanFooter,         /* sanitise an arbitrary payload */
            limits: {
                columns: FOOTER_MAX_COLS,
                links: FOOTER_MAX_LINKS,
                title: FOOTER_MAX_TITLE,
                label: FOOTER_MAX_LABEL
            },
            href: footerHref,           /* validate one href the footer's way */
            render: renderFooter
        },
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
