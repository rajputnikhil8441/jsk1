PLAYZONE9 — WHITE LABEL THEME MANAGER
=====================================

WHAT'S IN THIS ZIP
------------------
index.html          modified   theme hooks (unchanged from last delivery)
login.html          modified   theme hooks (unchanged from last delivery)
css/style.css       modified   unchanged from last delivery
css/responsive.css  modified   unchanged from last delivery
css/login.css       modified   unchanged from last delivery
js/main.js          modified   unchanged from last delivery
js/cms.js           UPDATED    + theme store, apply/duplicate/export, preview channel
admin/index.html    UPDATED    + Theme Manager panel, create/edit modal
admin/admin.css     UPDATED    + theme cards, 390px preview, modal
admin/admin.js      UPDATED    + theme engine, palette derivation, live preview

Your assets/ folder is NOT in this zip — keep your existing one.


HOW TO INSTALL
--------------
1. Back up:  cd .. && cp -r playzone9-final playzone9-backup
2. Unzip and copy all folders over your project, replacing when asked.
3. Your tree should stay exactly as it is now, same folders, same names.
4. Live Server on index.html, let it load once.
5. Go to /admin/  ->  Theme Manager is the first panel.


THE FIVE SEEDED THEMES
----------------------
Playzone Blue, Gin247 Yellow, Diamond Red, Lotus Green, Sky Purple.
They appear automatically the first time you open the panel.


THE WORKFLOW YOU ASKED FOR
--------------------------
Duplicate  ->  Edit  ->  change logo / name / colours  ->  Save to theme  ->  Apply

  Apply       one click, every page rebrands, no refresh needed
  Edit        loads the theme into Branding / Colors / Images panels,
              a blue bar at the top shows which theme you are editing
  Duplicate   exact copy, everything identical except what you change
  Export      one JSON per theme (playzone.json, gin247.json...)
  Import      drop a JSON back in to recreate the theme completely


CREATE THEME
------------
Five core colours (primary, secondary, accent, background, text) generate
the whole ~80 variable palette automatically. Every individual value is
still editable afterwards in the Colors panel.


PUBLISHING — ONE ACTION
-----------------------
Review & Publish, in the /admin top bar, is the ONLY thing that sends
changes to the server. It names the brand, the hostname and the row it
is about to write, shows what will be published, and reports
"Published" only after the write has been read back and confirmed.

Everything else stays on this device: typing, Page Builder drafts
("Draft saved on this device"), applying a palette, a media upload, and
restoring a backup. None of them publish.

Setup: follow SETUP-SUPABASE.txt once. Without it, remote publishing is
off and /admin says so -- edits stay in your own browser.

BACKUP IS NOT PUBLISHING. Backup & Restore downloads and restores a copy
of this brand's content. "Download brand defaults (brand.js)" there is
for developers seeding a brand's committed defaults in the repository; it
writes a file and publishes nothing.

PAGE CONTENT AND SEO
--------------------
Published Page Builder content is baked into the HTML at build time from
brands/<id>/brand.js, so it is in View Source and a crawler reads it
without running JavaScript. Publishing is live immediately for visitors;
the static copy updates on the next deploy. See docs/publishing.md.

Load order on every page:
      js/cms-config.js  ->  js/brand.js  ->  js/cms.js
Priority: cms.js defaults < brand.js < server row < local edits.
          Once a brand has been published, the server row is what
          visitors get; brand.js is the fallback beneath it.
