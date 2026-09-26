/* ============================================================
   THE PLAYZONE9 BRAND
   ------------------------------------------------------------
   Load order on every page:
       js/cms-config.js  ->  js/brand.js  ->  js/cms.js
   Priority, lowest first:
       cms.js DEFAULTS  <  THIS FILE  <  Supabase row  <  local edits

   WHAT THIS FILE IS FOR

   js/cms.js ships the SHAPE of a brand -- every key the CMS
   expects to exist -- with no brand in it. Not one Playzone9 string,
   domain or page title. That is deliberate: DEFAULTS is shared
   by every brand, so anything left in it is inherited by every
   brand, and a second site would quietly render Playzone9's copy
   wherever its own record happened to be missing a key.

   So the brand lives here. This file is Playzone9 and nothing else.
   A second brand ships its own copy of this file with its own
   values and inherits none of the below.

   WHEN IT IS READ

   It is the fallback a visitor sees when Supabase cannot be
   reached, while the request is still in flight, or when their
   browser has nothing cached. Published content in the Supabase
   row overrides all of it, so on a healthy live site these
   values are rarely what renders -- which is exactly why they
   have to be right: they are what shows when things are not
   healthy.

   Note what is NOT here. Each page's static .html file already
   carries its own title, description and copy baked in, and
   cms.js never overwrites a static tag with an empty value. So a
   brand that omitted a key here would still render its own
   static text rather than another brand's.

   To refresh it: /admin > Export / Import > Download brand.js,
   then replace this file and redeploy. Editing it by hand is
   fine too -- it is plain JSON.
   ============================================================ */
window.CMS_BRAND = {

    branding: {
        siteName: 'Playzone9',
        browserTitle: 'Playzone9 — Official Site | Playzone9 Login & Online Gaming',
        loginTitle: 'Login — Playzone9'
    },

    text: {
        'footer.about': 'The official Playzone9 website. Create an account, sign in and reach support any time.',
        'footer.copyright': '© Copyright 2026 Playzone9. All Rights Reserved.',
        'support.whatsappMessage': 'Hello%2C%20I%20need%20support%20on%20Playzone9.'
    },

    seo: {
        baseUrl: 'https://playzone9.app',
        siteName: 'Playzone9',
        titleTemplate: '%s | Playzone9',
        defaultTitle: 'Playzone9 — Official Site | Playzone9 Login & Online Gaming',
        defaultDescription: 'Playzone9 is the official Playzone9 online gaming site. Access your Playzone9 account, log in, and get 24x7 support at playzone9.app.',
        organization: {
            name: 'Playzone9'
        }
    },

    /* Per-page copy. Only the fields that carry brand content are
       here: the structural ones (url, slug, robots, breadcrumb,
       schema, inSitemap) are the same for any brand with this page
       set and stay in cms.js DEFAULTS. */
    pages: {
        home: {
            title: 'Playzone9 — Official Site | Playzone9 Login & Online Gaming',
            metaDescription: 'Playzone9 is the official Playzone9 online gaming site. Access your Playzone9 account, log in, and get 24x7 support. Visit the official Playzone9 website at playzone9.app.',
            heading: 'Playzone9 — Official Online Gaming Site',
            updatedAt: '2026-09-26'
        },
        login: {
            title: 'Login — Playzone9',
            metaDescription: 'Sign in to your Playzone9 account on the official Playzone9 website.',
            updatedAt: '2026-09-26'
        },
        register: {
            title: 'Register — Playzone9',
            metaDescription: 'Create a Playzone9 account on the official Playzone9 website.',
            updatedAt: '2026-09-26'
        },
        about: {
            title: 'About Playzone9 — About the Official Playzone9 Website',
            metaDescription: 'Learn about Playzone9, the official Playzone9 online gaming website. Find out what Playzone9 offers and how to get started at playzone9.app.',
            heading: 'About Playzone9',
            lead: 'The official Playzone9 website — playzone9.app.',
            body: '<p>Playzone9 is an online gaming site. This page is where you tell visitors who you are, what the site offers and how to get started. Edit all of it in /admin &gt; Pages &gt; About.</p>\n<h2>What Playzone9 offers</h2>\n<p class="page-note">Editable placeholder — describe the games and features you actually offer, in your own words. Nothing here has been written for you, because only you know what is true of your site.</p>\n<h2>Getting started with Playzone9</h2>\n<p>To use Playzone9, create an account on the <a href="register.html">Register</a> page, then sign in from the <a href="login.html">Login</a> page. If you need help, the ways to reach us are listed on the <a href="contact.html">Contact</a> page.</p>\n<h2>Play responsibly</h2>\n<p>Playzone9 is intended for adults aged 18 and over. Please read our <a href="responsible-gaming.html">Responsible Gaming</a> page before you play.</p>',
            updatedAt: '2026-09-26'
        },
        contact: {
            title: 'Contact Playzone9 — Playzone9 Support & Help',
            metaDescription: 'Contact Playzone9 support. Reach the official Playzone9 team for help with your Playzone9 account at playzone9.app.',
            heading: 'Contact Playzone9',
            lead: 'Get in touch with the Playzone9 support team.',
            body: '<p>Use any of the channels below to reach us about your account, signing in, or a general question.</p>\n<ul class="contact-list">\n  <li><i class="fab fa-whatsapp"></i> <span>WhatsApp: <span class="page-note">add your real WhatsApp number here</span></span></li>\n  <li><i class="fas fa-envelope"></i> <span>Email: <span class="page-note">add your real support email here</span></span></li>\n  <li><i class="fas fa-clock"></i> <span>Support hours: <span class="page-note">add your real support hours here</span></span></li>\n</ul>\n<h2>Before you contact us</h2>\n<p>If you are trying to sign in, go to the <a href="login.html">Playzone9 Login</a> page. New here? Create an account on the <a href="register.html">Playzone9 Register</a> page. You can read more about the site on the <a href="about.html">About Playzone9</a> page.</p>',
            updatedAt: '2026-09-26'
        },
        'responsible-gaming': {
            title: 'Responsible Gaming — Playzone9',
            metaDescription: 'Playzone9 responsible gaming information: 18+ only, setting limits, spotting warning signs and where to get help. Official Playzone9 site, playzone9.app.',
            heading: 'Responsible Gaming',
            lead: 'Keeping play safe, and knowing where to get help.',
            body: '<p>Gaming should stay fun and under control. This page explains how to keep your play responsible and where to find help if it stops feeling that way.</p>\n<h2>18+ only</h2>\n<p>Playzone9 is strictly for adults aged 18 and over. Underage gaming is not permitted. If you are under 18, please do not create an account or play.</p>\n<h2>Play within your limits</h2>\n<p>A few simple habits keep gaming healthy:</p>\n<ul>\n  <li>Set a budget before you play and treat it as entertainment, not a way to make money.</li>\n  <li>Never play with money you cannot afford to lose.</li>\n  <li>Set time limits and take regular breaks.</li>\n  <li>Do not try to win back losses by playing more.</li>\n  <li>Do not play when stressed, upset, or under the influence of alcohol.</li>\n</ul>\n<h2>Warning signs</h2>\n<p>It may be time to step back if you notice yourself:</p>\n<ul>\n  <li>Spending more time or money than you intended.</li>\n  <li>Chasing losses or borrowing money to play.</li>\n  <li>Neglecting work, studies, or relationships because of gaming.</li>\n  <li>Feeling anxious, guilty, or unable to stop.</li>\n</ul>\n<h2>Getting help</h2>\n<p>If gaming is no longer under control, help is available. Support organisations such as <a href="https://www.begambleaware.org/" rel="noopener nofollow" target="_blank">BeGambleAware</a> and <a href="https://www.gamcare.org.uk/" rel="noopener nofollow" target="_blank">GamCare</a> offer free, confidential advice.</p>\n<p class="page-note">Editable placeholder — add a helpline for your own country or region here.</p>\n<h2>Talk to us</h2>\n<p>If you have a question about your account or want to limit your play, reach us through the <a href="contact.html">Contact</a> page.</p>',
            updatedAt: '2026-09-26'
        },
        'privacy-policy': {
            title: 'Privacy Policy | Playzone9',
            metaDescription: 'Read the Playzone9 Privacy Policy to understand how information is handled when you use the Playzone9 website and services.',
            heading: 'Privacy Policy',
            lead: 'This Privacy Policy explains how Playzone9 handles information when you use this website and its services.',
            body: '<p class="page-note">Editable placeholder — write your own privacy policy here, in /admin &gt; Pages &gt; Privacy Policy. It should describe what this site actually collects, why, how long it is kept and who to contact about it. Nothing has been written for you, because only you know what is true of your site.</p>',
            updatedAt: '2026-09-26'
        },
    }
};
