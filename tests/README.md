# Site regression tests

Seven suites covering the SEO foundation, the admin SEO panel, link integrity,
CMS images, the favicon chain, the sports table and the Page Builder.
Baseline: **719 assertions, 0 failures**.

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
| `test_pagebuilder.js` | Page Builder: mounts, draft gate, style isolation against the site's own CSS, multiple-instance bleed, nesting, every section type, responsive overrides, CSS/URL injection, malformed data, draft/publish, remote-pull draft safety, admin panel, editors, preview, SEO and cross-page regression | 329 |

Do not weaken these to make a change pass.
