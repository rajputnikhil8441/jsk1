/* ============================================================
   BRAND REGISTRY + REMOTE STORAGE  —  CONFIGURED AND READY
   ------------------------------------------------------------
   Live publishing is ON. Saving in /admin writes to your
   Supabase project, so every visitor on every device sees the
   change immediately. No downloads, no redeploys.

   Sign in at /admin with the email and password you created
   under Authentication > Users.

   THIS FILE HAS TWO HALVES.

   The top half is DATA and is meant to be edited: the project
   every brand shares, and one entry per brand keyed by the
   domain it is served from.

   The bottom half is RESOLUTION and is not meant to be edited.
   It turns "which domain am I on?" into the window.CMS_REMOTE
   object the rest of the CMS reads. Editing the top half is how
   you add a brand; editing the bottom half is how you break all
   of them at once.
   ============================================================ */


/* ------------------------------------------------------------
   1. THE PROJECT EVERY BRAND SHARES
   ------------------------------------------------------------
   One Supabase project, one table. Brands are separated by the
   ROW they use (see siteId below), not by the project.

   The key below is safe in public code: your row level security
   policies only let it READ the brand. Writing needs a signed in
   admin.

   The field is still called anonKey for compatibility, but it
   now holds one of Supabase's PUBLISHABLE keys
   (sb_publishable_...). Those are not JWTs, so they travel in
   the `apikey` header only -- js/cms.js handles both formats and
   a deployment still using a legacy eyJ... anon key behaves
   exactly as it did.

   NEVER put an sb_secret_... or service_role key here. This file
   ships to every visitor's browser. cms.js refuses to start with
   one rather than leak it.
   ------------------------------------------------------------ */
window.CMS_PROJECT = {

    enabled: true,

    url: 'https://wspanesckdedctpfbqah.supabase.co',

    anonKey: 'sb_publishable_JjCWJkpnwZgg0v3Gw6fcVg_-3Ts-GWV',

    table: 'site_brand'
};


/* ------------------------------------------------------------
   2. THE BRANDS
   ------------------------------------------------------------
   Keyed by the EXACT hostname the brand is served from, lower
   case, no port, no path. Add a `www.` key of its own if that
   host is also in use -- there is deliberately no automatic
   www stripping, because guessing which hosts are equivalent is
   how a lookalike domain ends up resolving to a real brand.

   siteId is the row in `site_brand` that holds this brand's
   content. It is the ONLY thing keeping two brands apart in the
   database, so two brands must never share one.

     jsk-1.com -> playzone9
       The siteId reads oddly and that is deliberate: this row
       predates the JSK1 name and renaming it would mean
       migrating live data for no functional gain. It is left
       exactly as production has always had it.

   bucket is the Supabase Storage bucket holding this brand's
   uploaded media. Separate buckets are what make one brand's
   media URLs invalid for another, so two brands must never
   share one either.
   ------------------------------------------------------------ */
window.CMS_BRANDS = {

    'jsk-1.com': {
        siteId: 'playzone9',
        bucket: 'cms-media'
    }
};


/* ------------------------------------------------------------
   3. WHICH BRAND WHEN THE HOSTNAME IS NOT ONE OF THE ABOVE
   ------------------------------------------------------------
   localhost, a CI run, a deploy preview URL, a file:// open.
   None of those are a brand, and all of them still have to
   render something, so one brand is declared the default.

   This is a DELIBERATE, single-place decision -- not a fuzzy
   match. An unrecognised host does not "look like" this brand;
   it simply gets the brand this line names, and the resolution
   below records that it was not a match so anything that cares
   can tell the difference.
   ------------------------------------------------------------ */
window.CMS_BRAND_DEFAULT = 'jsk-1.com';


/* ------------------------------------------------------------
   4. UPLOADED CMS MEDIA — SUPABASE STORAGE
   ------------------------------------------------------------
   This is what lets an admin add an image from /admin instead of
   committing a file to the repository. It is OFF until the
   bucket exists, because there is nowhere for an upload to go
   and pretending otherwise would fail silently at the worst
   moment.

   To turn it on, once, in the Supabase dashboard:

     1. Storage > New bucket
          Name:   the `bucket` named for this brand above
          Public: YES   (the files are images on a public website)
     2. Storage > Policies > that bucket, add three policies:
          SELECT  to  anon, authenticated      -- visitors read images
          INSERT  to  authenticated            -- only a signed-in admin
          DELETE  to  authenticated            -- only a signed-in admin
        Do NOT grant INSERT or DELETE to anon.
     3. Set enabled: true below and deploy.

   No key changes. Uploads are authorised with the ADMIN's own
   session token, the same one that already writes the brand row.
   There is no service-role key in this codebase and there must
   never be one: everything here ships to the browser.

   maxBytes is enforced in the browser before a byte is sent. Set
   a matching file size limit on the bucket in Supabase so the
   server enforces it too — a browser check is a courtesy, not a
   control.
   ------------------------------------------------------------ */
window.CMS_MEDIA_SETTINGS = {

    /* Flip to true once the bucket and its policies exist. */
    enabled: false,

    /* 5 MB. Images larger than this are refused before upload. */
    maxBytes: 5242880
};


/* ============================================================
   5. RESOLUTION  —  DO NOT EDIT
   ------------------------------------------------------------
   Everything above is data. This turns it into the two objects
   the CMS actually reads, window.CMS_REMOTE and window.CMS_MEDIA,
   in the exact shape they have always had -- so js/cms.js,
   /admin and tools/build-seo-files.js need no knowledge that
   brands exist at all.

   MATCHING IS EXACT. The hostname is lower-cased and one
   trailing dot is removed (http://jsk-1.com./ is the same host
   as http://jsk-1.com/), and then it must EQUAL a key in
   CMS_BRANDS. No substring test, no suffix test, no wildcard.
   That is the whole defence against a lookalike domain: neither
   `jsk-1.com.evil.example` nor `notjsk-1.com` nor
   `evil.example/jsk-1.com` can equal `jsk-1.com`, so none of
   them can present itself as this brand.

   A host that does not match is NOT rejected -- it falls to
   CMS_BRAND_DEFAULT, because localhost and CI and previews must
   keep working exactly as they do today. What it does not get is
   the claim of being that brand: CMS_BRAND_RESOLVED.matched
   stays false, and that is what a brand indicator, a warning or
   a test can key off.
   ============================================================ */
(function () {
    'use strict';

    var brands = window.CMS_BRANDS || {};
    var project = window.CMS_PROJECT || {};
    var settings = window.CMS_MEDIA_SETTINGS || {};

    function own(obj, key) {
        return !!key && Object.prototype.hasOwnProperty.call(obj, key);
    }

    /* hasOwnProperty above, not `brands[host]`, and not for style:
       `toString`, `constructor` and `__proto__` are all truthy on any
       object, so a bare lookup would report a brand for a hostname that
       was never configured. */
    function hostname() {
        try {
            var h = String(window.location.hostname || '').toLowerCase();
            /* A single trailing dot is the same host in DNS terms. Two are
               not a host at all, and are left to fail the match. */
            return h.length > 1 && h.charAt(h.length - 1) === '.' &&
                   h.charAt(h.length - 2) !== '.'
                ? h.slice(0, -1) : h;
        } catch (e) {
            /* No location at all: a Node vm sandbox (tools/build-seo-files.js
               reads this file that way) or a document without one. */
            return '';
        }
    }

    function firstKey(obj) {
        for (var k in obj) { if (own(obj, k)) return k; }
        return '';
    }

    var host = hostname();
    var matched = own(brands, host);
    var id = matched ? host : String(window.CMS_BRAND_DEFAULT || '');

    /* A default that names a brand which does not exist would otherwise
       produce an empty siteId, and an empty siteId queries `id=eq.` and
       silently renders shipped defaults as if they were the site. Falling
       back to a real entry is always better than resolving to nothing. */
    var source = matched ? 'hostname' : 'default';
    if (!own(brands, id)) {
        id = firstKey(brands);
        source = id ? 'fallback' : 'none';
    }

    var brand = own(brands, id) ? brands[id] : {};
    var siteId = typeof brand.siteId === 'string' ? brand.siteId : '';
    var bucket = typeof brand.bucket === 'string' ? brand.bucket : '';

    /* Key order is deliberate: identical to the object this file used to
       declare by hand, so a JSON comparison against the old shape passes
       rather than merely being equivalent. */
    window.CMS_REMOTE = {
        enabled: !!project.enabled && !!siteId,
        url: typeof project.url === 'string' ? project.url : '',
        anonKey: typeof project.anonKey === 'string' ? project.anonKey : '',
        table: typeof project.table === 'string' ? project.table : '',
        siteId: siteId
    };

    window.CMS_MEDIA = {
        enabled: !!settings.enabled && !!bucket,
        bucket: bucket,
        maxBytes: settings.maxBytes
    };

    /* What resolution decided, for a brand indicator in /admin and for
       tests. `matched` is the honest bit: false means this host is not a
       configured brand and is borrowing the default. */
    window.CMS_BRAND_RESOLVED = {
        id: id,
        host: host,
        matched: matched,
        source: source
    };

    /* Said out loud once, because a site serving the wrong brand's content
       is the kind of thing nobody notices until a crawler does. Not an
       error: localhost and CI take this path every single run. */
    if (!matched && host && typeof console !== 'undefined' && console.warn) {
        console.warn('[CMS] "' + host + '" is not a configured brand; using the default (' +
                     id + '). Add it to window.CMS_BRANDS in js/cms-config.js if it should be one.');
    }
})();
