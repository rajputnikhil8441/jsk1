# brands/ — one directory per site

Everything that differs between two white-label sites lives here. Everything
they share lives outside here: `js/`, `css/`, `admin/`, `templates/`.

Adding a brand is meant to be **configuration, not engineering**. The test
for whether that is true is mechanical: building a new brand must not modify
a single shared file. `tests/test_multibrand.js` asserts exactly that by
hashing twelve shared files before and after building three brands.

## What a brand directory holds

    brands/<hostname>/
      brand.json          identity — required
      brand.js            the CMS fallback layer (window.CMS_BRAND) — required
      seo-config.json     sitemap/robots source for the deploy — optional
      slots/*.html        fill a named region in a shared template — optional
      pages/*.html        replace a shared template outright — optional

The directory name is the **production hostname**, because that is what
`js/cms-config.js` resolves a visitor's `location.hostname` against. One name
for one thing: no separate slug to keep in step with the domain.

### brand.json

| Field | Required | What it is |
|---|---|---|
| `id` | yes | must equal the directory name |
| `name` | yes | the brand's display name — the value of `{{brand.name}}` |
| `domain` | yes | the production hostname — the value of `{{brand.domain}}` |
| `siteId` | yes | the Supabase `site_brand.id` row this brand's CMS data lives in |
| `output` | no | output directory name; defaults to `id` |
| `pages` | no | which templates to publish; absent means all of them |
| `allowScriptsInSlots` | no | slot names permitted to contain `<script>` / `<iframe>` |
| `mediaBucket` | no | documentation for now; the live value is in `js/cms-config.js` |

`siteId` is separate from `id` on purpose. JSK1's row is literally called
`playzone9` — a name from before the rename — and renaming a Supabase row is a
data migration, not a refactor. Keeping the two fields apart is what lets the
hostname be correct while the row keeps its historical name.

## Adding a brand

1. `mkdir brands/<hostname>` and write `brand.json` with the four required fields.
2. Copy an existing `brand.js`, replace its values. This is the brand's content:
   headings, page copy, SEO defaults. Nothing here is shared.
3. Optionally add `seo-config.json`, `slots/`, `pages/` — see `templates/README.md`
   for what a slot and an override are.
4. `node tools/build-brand.js <hostname> --check` — plans and prints, writes
   nothing. Every validation runs, so a broken brand fails here.
5. `node tools/build-brand.js <hostname>` — writes `sites/<output>/`.
6. Register the hostname in `js/cms-config.js` `CMS_BRANDS` so a visitor on that
   domain resolves to the right `siteId` and the right storage namespace.
7. Give the brand its own Supabase `site_brand` row, keyed by its `siteId`.

Steps 6 and 7 are the only ones outside this directory, and neither is a code
change to shared behaviour: one is a registry entry, the other is a database row.

A brand that is **not** registered in `CMS_BRANDS` can still be generated. That
is deliberate — it lets a site be built and reviewed before it is wired to a
domain — and it is why the synthetic brands in `tests/fixtures/brands/` can
exist without appearing in production.

## What is NOT here

- **The engine.** `js/cms.js` is identical for every brand; that is the point.
- **The colour system.** `css/style.css :root` is still shared and still carries
  JSK1's palette. Per-brand CSS is a later phase; the generator is built to
  carry brand assets when it arrives, but does not invent them now.
- **A second brand.** `brands/` has exactly one entry, and
  `tests/test_generator.js` asserts it.

## This directory is not part of the published site

`brands/` is build input. The Pages deploy removes it — along with `templates/`,
`tools/` and `tests/` — from the runner's checkout before the artifact is
packed, so a brand's configuration and fallback content are never served from
the production domain. See `templates/README.md` and
`tests/test_deploy_surface.js`.
