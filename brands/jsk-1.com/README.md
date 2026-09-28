# brands/jsk-1.com

Everything that makes this site JSK1 rather than any other brand.

| File | What it is |
|---|---|
| `brand.json` | identity: name, domain, siteId, media bucket, output directory |
| `brand.js` | the CMS fallback layer — `window.CMS_BRAND`. Branding, SEO defaults and every page's copy |
| `seo-config.json` | what the deploy generates `sitemap.xml` / `robots.txt` from when Supabase is unreachable |
| `slots/` | HTML fragments filling `<!-- BRAND:name -->` regions in the shared templates. **Absent** — JSK1 uses the templates as they stand, which is why its generated pages keep their exact current bytes |
| `pages/` | whole-page overrides replacing a shared template. **Absent** — JSK1 needs none |

## Generating

    node tools/build-brand.js jsk-1.com --check    # plan and print
    node tools/build-brand.js jsk-1.com            # write sites/jsk-1.com/

The output is asserted byte-identical to the live production files by
`tests/test_generator.js`, against the Phase 0 golden fixtures. That
equality is the whole reason the generator can be trusted with a second
brand: it has been shown to reproduce the first one exactly.

## A transitional duplication, on purpose

`brand.js` here is byte-identical to `js/brand.js` at the repository root.
The root copy is what production serves today; this one is the source the
generator reads. A test asserts they match, so they cannot drift. Phase 7
switches the deploy to generated output and the root copy goes away.
