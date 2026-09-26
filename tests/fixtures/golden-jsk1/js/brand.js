/* ============================================================
   PUBLISHED BRAND — the JSK1 fallback layer
   ------------------------------------------------------------
   Load order on every page:
       js/cms-config.js  ->  js/brand.js  ->  js/cms.js
   Priority:
       cms.js defaults  <  THIS FILE  <  Supabase row  <  local edits

   This file is what a visitor sees when Supabase cannot be
   reached, when the request is still in flight, or when their
   browser has nothing cached. It exists so the site is never
   served with placeholder values.

   To refresh it: /admin > Export / Import > Download brand.js,
   then replace this file and redeploy. Editing it by hand is
   fine too — it is plain JSON.
   ============================================================ */
window.CMS_BRAND = {

    branding: {
        siteName: 'JSK1',
        browserTitle: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
        loginTitle: 'Login — JSK1'
    },

    seo: {
        baseUrl: 'https://jsk-1.com',
        siteName: 'JSK1',
        titleTemplate: '%s | JSK1',
        defaultTitle: 'JSK1 — Official Site | JSK1 Login & Online Gaming',
        defaultDescription: 'JSK1 is the official JSK1 online gaming site. Access your JSK1 account, log in, and get 24x7 support at jsk-1.com.'
    },

    text: {
        'footer.copyright': '© Copyright 2026 JSK1. All Rights Reserved.'
    }
};
