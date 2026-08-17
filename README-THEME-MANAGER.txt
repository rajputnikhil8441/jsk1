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


PUBLISHING — TWO WAYS
---------------------
BEST: live publishing. Follow SETUP-SUPABASE.txt once (15 min).
      After that, Save changes in /admin is instantly live on every
      device. No downloads, no redeploys, ever.

FALLBACK: if you skip that setup, settings stay in your own browser.
      To publish you must go to Export / Import -> Download brand.js,
      put it in js/brand.js, and redeploy to Netlify. Repeat for
      every change.

Load order on every page:
      js/cms-config.js  ->  js/brand.js  ->  js/cms.js
Priority: cms.js defaults < brand.js < server row < local edits.
