# brands/playzone9.app

The second brand. Everything that makes this site Playzone9 rather than JSK1.

| File | What it is |
|---|---|
| `brand.json` | identity: name, domain, siteId, media bucket, output directory |
| `brand.js` | the CMS fallback layer — `window.CMS_BRAND` |
| `seo-config.json` | what the deploy generates `sitemap.xml` / `robots.txt` from when Supabase is unreachable. **Required** to assemble a site: without it the assembler would fall back to `tools/seo-config.json`, which is JSK1's, and ship a sitemap describing the wrong domain |
| `slots/` | absent. The shared login and register templates each declare a slot this brand could fill |
| `pages/` | absent. No page needs a different arrangement yet |
| `static/` | absent. See "The logo" below |

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
