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
