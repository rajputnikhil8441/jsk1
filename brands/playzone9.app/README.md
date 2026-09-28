# brands/playzone9.app

The second brand. Everything that makes this site Playzone9 rather than JSK1.

| File | What it is |
|---|---|
| `brand.json` | identity: name, domain, siteId, media bucket, output directory |
| `brand.js` | the CMS fallback layer — `window.CMS_BRAND` |
| `seo-config.json` | what the deploy generates `sitemap.xml` / `robots.txt` from when Supabase is unreachable. **Required** to assemble a site: without it the assembler would fall back to `tools/seo-config.json`, which is JSK1's, and ship a sitemap describing the wrong domain |
| `slots/` | absent. The shared login and register templates each declare a slot this brand could fill |
| `pages/` | absent. No page needs a different arrangement yet |
| `static/` | its stylesheet and favicon — see "The visual layer" below |
| `static-staging/` | files that belong to the staging **host** rather than to the brand. Only `CNAME`, containing `playzones9.com`. It is here and not in `static/` because a brand-level CNAME would appear in **every** environment's output, including `playzone9.app`'s — and a CNAME claiming the production domain is the one file that must not exist until that domain is meant to be served |

## siteId is `playzone9app`, not `playzone9`

The difference is one word and it is the most dangerous value in this
repository. `playzone9` is **JSK1's** row — the name predates the JSK1 rename
and renaming it would mean migrating live data. Giving this brand that row
would point it at JSK1's live content, in both directions.

`tests/test_generator.js` asserts the two brands have different `siteId`s and
that this one is not `playzone9`. `tests/test_assembly.js` asserts the SEO step
resolves `playzone9app` when it builds this site.

## Where the copy came from, and what to do about it

`brand.js` was derived mechanically from JSK1's: the brand name and domain
substituted, nothing written. So the wording is the white-label default, and
the placeholder paragraphs JSK1 ships — the ones that say *"Editable
placeholder — nothing here has been written for you, because only you know
what is true of your site"* — are still placeholders here.

Three keys matter more than the rest. `footer.about`, `footer.copyright` and
`support.whatsappMessage` are present in `js/cms.js` DEFAULTS with **empty**
values, and `paintText` writes an empty string rather than skipping it. So
leaving one blank does not fall back to the static HTML — it **wipes** it. They
are filled here, and `tests/test_assembly.js` asserts each one is non-empty.

Real copy belongs in the Supabase row, published from `/admin`, which overrides
all of this. These values are what a visitor sees when the database cannot be
reached, so they have to be reasonable rather than perfect.

## The logo

This brand ships no `static/` overlay, so it currently receives the **shared**
`assets/`, which includes JSK1's logo and images. That is fine for assembling
and reviewing a site and is not fine for launching one.

To give it its own, create `brands/playzone9.app/static/` and put files at the
paths they replace:

    brands/playzone9.app/static/assets/images/logo.png
    brands/playzone9.app/static/css/style.css      (if the palette differs)

The overlay is applied after the shared engine and before the generated pages,
so anything here wins over the shared copy. `tests/fixtures/brands/omega.test`
is a worked example.

## Building

    node tools/build-brand.js playzone9.app --check   # brand-owned files only
    node tools/build-site.js  playzone9.app --check    # the whole site, nothing written
    node tools/build-site.js  playzone9.app            # writes sites/playzone9.app/

Nothing about this brand is deployed. Which directory a host serves, and for
which domain, is not decided in this repository yet.

---

## Staging: playzones9.com

This brand is reviewed on **playzones9.com** before **playzone9.app** is ever
connected. The staging host is declared as an `environment` in `brand.json`,
not as a brand of its own, because the brand and the hostname are different
things — renaming this brand to its staging host would mean renaming it back
at launch, and with it the directory, the id, the Supabase row and every test.

    node tools/build-site.js playzone9.app --env staging

| | production | staging |
|---|---|---|
| host | playzone9.app *(reserved, not served)* | playzones9.com |
| siteId | `playzone9app` | `playzone9staging` |
| bucket | `cms-media-pz9` | `cms-media-pz9-staging` |
| indexable | yes | **no** |
| output | `sites/playzone9.app/` | `sites/playzones9.com/` |

Separate rows on purpose: reviewing a site must not be able to write to the
content the real site will serve. **Neither row exists yet**, so both render
from `brand.js`.

### Why staging cannot be indexed

Four independent mechanisms, because being indexed would put a review copy in
competition with the real site for the real site's own terms:

1. every page's robots meta is rewritten to `noindex,nofollow` at build time,
   counted — one tag per page or the build fails;
2. `robots.txt` is `Disallow: /` with no `Sitemap:` line;
3. no `sitemap.xml` is published at all, so nothing invites a crawl;
4. the generated `brand.js` sets `window.CMS_NOINDEX`, which `js/cms.js`
   honours directly — without it the engine repaints the robots meta from the
   merged CMS data, and any layer above the brand could hand the host back to
   the crawlers.

The fourth is the one that is easy to miss and `tests/test_staging.js` proves
it in a real browser: without it the pages load `noindex` and then rewrite
themselves to `index,follow`.

### Why staging does not claim to be production

The staging build's `brand.js` gets an appended override setting
`seo.baseUrl` to `https://playzones9.com`. `js/cms.js` repaints the canonical
link, `og:url` and the JSON-LD urls from that value, so without it the pages
would serve correct static tags and then point their canonical at a domain
nobody has connected. The production build appends nothing, so its `brand.js`
is byte for byte the committed file.

`playzone9.app` appears in no staging page. It appears in the shared brand
registry — by design, every brand ships the same registry — and in this
brand's own copy, where the descriptions mention it as text. Neither is a URL
signal, and the pages are noindex regardless.

### The visual layer

| File | What it does |
|---|---|
| `slots/head-extra.html` | loads `css/brand.css` after the shared stylesheets, on every page |
| `static/css/brand.css` | the brand's palette as custom properties on `:root` |
| `static/assets/images/favicon.png` | replaces the shared favicon at the same path |

The colours are **not invented**. This project already ships a Playzone9 theme
preset — "Playzone Blue", in the `SEEDS` table in `js/admin.js`, whose brand
label is literally `PLAYZONE9`. Its palette is `CMS.DEFAULTS.colors`, which
Phase 3b proved is an exact duplicate of the `:root` block in
`css/style.css`. So Playzone Blue is what the shared stylesheet already
renders, and `brand.css` restates the five seed values without changing
anything visually today.

That is deliberate. The values now live in the **brand** instead of being
inherited by accident from a stylesheet shared with every other site, so
changing them changes this brand and nothing else. A real redesign belongs in
a later phase with visual review; this is the seam it will happen at.

**Still to supply:** a real logo and a real favicon. The header renders the
brand name as a text wordmark when `images.logo` is unset, which is already
correct for Playzone9. The favicon here is a flat placeholder in the brand's
own primary colour — better than serving JSK1's mark on a Playzone9 host, and
not a substitute for the real one. Typography has a documented, deliberately
empty seam in `brand.css`.

### Login and register

Both pages support all three levels, and nothing about them is special-cased:

1. **shared page** — what Playzone9 uses today;
2. **brand slot** — `slots/login-notice.html`, `slots/register-notice.html`,
   both declared by the shared templates and both empty for this brand;
3. **whole-page override** — `pages/login.html` or `pages/register.html`
   replaces the shared template outright.

`tests/fixtures/brands/omega.test` exercises the slots on both pages and
`zeta.test` exercises a whole-page login override, so none of it depends on
this brand choosing to use it.
