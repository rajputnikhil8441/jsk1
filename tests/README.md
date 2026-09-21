# Site regression tests

Nine suites covering the SEO foundation, the admin SEO panel, link integrity,
CMS images, the favicon chain, the sports table and the Page Builder (V1, V2
and V1-compatibility). Baseline: **875 assertions, 0 failures**.

## Run

```bash
cd tests
npm install                      # playwright
npx playwright install chromium  # only if you have no Chromium for Playwright
npm test                         # boots a static server on :8777, runs everything
```

Run one suite: `npm test -- test_seo.js`
Different port: `TEST_PORT=9000 npm test`

`run-all.js` serves the repository root itself, so no external web server is
needed and the suites always test the working tree.

## Suites

| File | Covers | Assertions |
| --- | --- | --- |
| `test_seo.js` | titles, descriptions, canonicals, robots, schema, sitemap, JS-disabled rendering | 142 |
| `test_admin_seo.js` | admin panels build, SEO editor, save → publish → public page | 61 |
| `test_links2.js` | link integrity, navigation, overflow sweep at four widths | 43 |
| `test_images.js` | CMS logo/favicon, data-URL rejection for og:image and schema | 40 |
| `test_favicon.js` | committed favicon file, CMS override, JS-disabled fallback | 45 |
| `test_sportstable.js` | sports-table CMS values, fallbacks, suspended markets | 59 |
| `test_pagebuilder.js` | Page Builder V1: mounts, draft gate, style isolation against the site's own CSS, multiple-instance bleed, nesting, every section type, responsive overrides, CSS/URL injection, malformed data, draft/publish, remote-pull draft safety, admin panel, editors, preview, SEO and cross-page regression | 329 |
| `test_pagebuilder_compat.js` | A frozen V1 payload and the render it produced at 1ce70b5, compared as computed style across three viewports. A failure means V2 changed how existing published pages look | 131 |
| `test_pagebuilder_v2.js` | Page Builder V2 features | 25 |

Do not weaken these to make a change pass.

## The golden compatibility file

`fixtures/v1-golden-expected.json` was captured from the running code, not
written by hand. Regenerate it with `node capture-golden.js` **only** when a
change to how V1 data renders is deliberate and reviewed — re-minting it to
silence a failure throws away the one thing that protects published pages.
