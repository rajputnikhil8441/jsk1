/* ============================================================
   THE JSK1 BRAND
   ------------------------------------------------------------
   Load order on every page:
       js/cms-config.js  ->  js/brand.js  ->  js/cms.js
   Priority, lowest first:
       cms.js DEFAULTS  <  THIS FILE  <  Supabase row  <  local edits

   WHAT THIS FILE IS FOR

   js/cms.js ships the SHAPE of a brand -- every key the CMS
   expects to exist -- with no brand in it. Not one JSK1 string,
   domain or page title. That is deliberate: DEFAULTS is shared
   by every brand, so anything left in it is inherited by every
   brand, and a second site would quietly render JSK1's copy
   wherever its own record happened to be missing a key.

   So the brand lives here. This file is JSK1 and nothing else.
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
        siteName: 'JSK1',
        browserTitle: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
        loginTitle: 'Login — JSK1'
    },

    text: {
        'footer.about': 'The official JSK1 website. Create an account, sign in and reach support any time.',
        'footer.copyright': '© Copyright 2026 JSK1. All Rights Reserved.',
        'support.whatsappMessage': 'Hello%2C%20I%20need%20support%20on%20JSK1.'
    },

    seo: {
        baseUrl: 'https://jsk-1.com',
        siteName: 'JSK1',
        titleTemplate: '%s | JSK1',
        defaultTitle: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
        defaultDescription: 'JSK1 is the official JSK1 online gaming site. Access your JSK1 account, log in, and get 24x7 support at jsk-1.com.',
        organization: {
            name: 'JSK1'
        }
    },

    /* Per-page copy. Only the fields that carry brand content are
       here: the structural ones (url, slug, robots, breadcrumb,
       schema, inSitemap) are the same for any brand with this page
       set and stay in cms.js DEFAULTS. */
    pages: {
        home: {
            title: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
            metaDescription: 'JSK1 is the official JSK1 online gaming site. Access your JSK1 account, log in, and get 24x7 support. Visit the official JSK1 website at jsk-1.com.',
            heading: 'JSK1 — Official Online Gaming Site',
            updatedAt: '2026-09-17'
        },
        login: {
            title: 'Login — JSK1',
            metaDescription: 'Sign in to your JSK1 account on the official JSK1 website.',
            updatedAt: '2026-09-17'
        },
        register: {
            title: 'Register — JSK1',
            metaDescription: 'Create a JSK1 account on the official JSK1 website.',
            updatedAt: '2026-09-17'
        },
        about: {
            title: 'About JSK1 — About the Official JSK1 Website',
            metaDescription: 'Learn about JSK1, the official JSK1 online gaming website. Find out what JSK1 offers and how to get started at jsk-1.com.',
            heading: 'About JSK1',
            lead: 'The official JSK1 website — jsk-1.com.',
            body: '<p>JSK1 is an online gaming site. This page is where you tell visitors who you are, what the site offers and how to get started. Edit all of it in /admin &gt; Pages &gt; About.</p>\n<h2>What JSK1 offers</h2>\n<p class="page-note">Editable placeholder — describe the games and features you actually offer, in your own words. Nothing here has been written for you, because only you know what is true of your site.</p>\n<h2>Getting started with JSK1</h2>\n<p>To use JSK1, create an account on the <a href="register.html">Register</a> page, then sign in from the <a href="login.html">Login</a> page. If you need help, the ways to reach us are listed on the <a href="contact.html">Contact</a> page.</p>\n<h2>Play responsibly</h2>\n<p>JSK1 is intended for adults aged 18 and over. Please read our <a href="responsible-gaming.html">Responsible Gaming</a> page before you play.</p>',
            updatedAt: '2026-09-17'
        },
        contact: {
            title: 'Contact JSK1 — JSK1 Support & Help',
            metaDescription: 'Contact JSK1 support. Reach the official JSK1 team for help with your JSK1 account at jsk-1.com.',
            heading: 'Contact JSK1',
            lead: 'Get in touch with the JSK1 support team.',
            body: '<p>Use any of the channels below to reach us about your account, signing in, or a general question.</p>\n<ul class="contact-list">\n  <li><i class="fab fa-whatsapp"></i> <span>WhatsApp: <span class="page-note">add your real WhatsApp number here</span></span></li>\n  <li><i class="fas fa-envelope"></i> <span>Email: <span class="page-note">add your real support email here</span></span></li>\n  <li><i class="fas fa-clock"></i> <span>Support hours: <span class="page-note">add your real support hours here</span></span></li>\n</ul>\n<h2>Before you contact us</h2>\n<p>If you are trying to sign in, go to the <a href="login.html">JSK1 Login</a> page. New here? Create an account on the <a href="register.html">JSK1 Register</a> page. You can read more about the site on the <a href="about.html">About JSK1</a> page.</p>',
            updatedAt: '2026-09-17'
        },
        'responsible-gaming': {
            title: 'Responsible Gaming — JSK1',
            metaDescription: 'JSK1 responsible gaming information: 18+ only, setting limits, spotting warning signs and where to get help. Official JSK1 site, jsk-1.com.',
            heading: 'Responsible Gaming',
            lead: 'Keeping play safe, and knowing where to get help.',
            body: '<p>Gaming should stay fun and under control. This page explains how to keep your play responsible and where to find help if it stops feeling that way.</p>\n<h2>18+ only</h2>\n<p>JSK1 is strictly for adults aged 18 and over. Underage gaming is not permitted. If you are under 18, please do not create an account or play.</p>\n<h2>Play within your limits</h2>\n<p>A few simple habits keep gaming healthy:</p>\n<ul>\n  <li>Set a budget before you play and treat it as entertainment, not a way to make money.</li>\n  <li>Never play with money you cannot afford to lose.</li>\n  <li>Set time limits and take regular breaks.</li>\n  <li>Do not try to win back losses by playing more.</li>\n  <li>Do not play when stressed, upset, or under the influence of alcohol.</li>\n</ul>\n<h2>Warning signs</h2>\n<p>It may be time to step back if you notice yourself:</p>\n<ul>\n  <li>Spending more time or money than you intended.</li>\n  <li>Chasing losses or borrowing money to play.</li>\n  <li>Neglecting work, studies, or relationships because of gaming.</li>\n  <li>Feeling anxious, guilty, or unable to stop.</li>\n</ul>\n<h2>Getting help</h2>\n<p>If gaming is no longer under control, help is available. Support organisations such as <a href="https://www.begambleaware.org/" rel="noopener nofollow" target="_blank">BeGambleAware</a> and <a href="https://www.gamcare.org.uk/" rel="noopener nofollow" target="_blank">GamCare</a> offer free, confidential advice.</p>\n<p class="page-note">Editable placeholder — add a helpline for your own country or region here.</p>\n<h2>Talk to us</h2>\n<p>If you have a question about your account or want to limit your play, reach us through the <a href="contact.html">Contact</a> page.</p>',
            updatedAt: '2026-09-17'
        },
        'privacy-policy': {
            title: 'Privacy Policy | JSK1',
            metaDescription: 'Read the JSK1 Privacy Policy to understand how information is handled when you use the JSK1 website and services.',
            heading: 'Privacy Policy',
            lead: 'This Privacy Policy explains how JSK1 handles information when you use this website and its services.',
            body: '<p class="page-note">Editable placeholder — write your own privacy policy here, in /admin &gt; Pages &gt; Privacy Policy. It should describe what this site actually collects, why, how long it is kept and who to contact about it. Nothing has been written for you, because only you know what is true of your site.</p>',
            updatedAt: '2026-09-21'
        },
    }
};
