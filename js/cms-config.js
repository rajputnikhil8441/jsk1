/* ============================================================
   REMOTE BRAND STORAGE — CONFIGURED AND READY
   ------------------------------------------------------------
   Live publishing is ON. Saving in /admin writes to your
   Supabase project, so every visitor on every device sees the
   change immediately. No downloads, no redeploys.

   Sign in at /admin with the email and password you created
   under Authentication > Users.

   The anonKey below is safe in public code: your row level
   security policies only let it READ the brand. Writing needs
   a signed in admin.
   ============================================================ */
window.CMS_REMOTE = {

    enabled: true,

    url: 'https://bgkghmjwaglddmdgslox.supabase.co',

    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJna2dobWp3YWdsZGRtZGdzbG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4Mjk3MDgsImV4cCI6MjEwMjQwNTcwOH0.El2i8CIc0w6AmN1UP_dmEzjD66KfNyQubaAFVpBUkW0',

    table: 'site_brand',

    /* One row per website. To run a second brand from the same
       database, deploy the code again with a different siteId
       and add a matching row in the SQL editor. */
    siteId: 'playzone9'
};

/* ============================================================
   UPLOADED CMS MEDIA — SUPABASE STORAGE
   ------------------------------------------------------------
   This is what lets an admin add an image from /admin instead of
   committing a file to the repository. It is OFF until the bucket
   below exists, because there is nowhere for an upload to go and
   pretending otherwise would fail silently at the worst moment.

   To turn it on, once, in the Supabase dashboard:

     1. Storage > New bucket
          Name:   cms-media
          Public: YES   (the files are images on a public website)
     2. Storage > Policies > cms-media, add two policies:
          SELECT  to  anon, authenticated      -- visitors read images
          INSERT  to  authenticated            -- only a signed-in admin
          DELETE  to  authenticated            -- only a signed-in admin
        Do NOT grant INSERT or DELETE to anon.
     3. Set enabled: true below and deploy.

   No key changes. Uploads are authorised with the ADMIN's own
   session token, the same one that already writes the brand row.
   There is no service-role key in this codebase and there must
   never be one: everything here ships to the browser.

   maxBytes is enforced in the browser before a byte is sent. Set a
   matching file size limit on the bucket in Supabase so the server
   enforces it too — a browser check is a courtesy, not a control.
   ============================================================ */
window.CMS_MEDIA = {

    /* Flip to true once the bucket and its policies exist. */
    enabled: false,

    bucket: 'cms-media',

    /* 5 MB. Images larger than this are refused before upload. */
    maxBytes: 5242880
};
