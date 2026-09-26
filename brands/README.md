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

## Two brands, three hostnames

| Brand | Environment | Host | siteId | Bucket | Served? |
|---|---|---|---|---|---|
| `jsk-1.com` | production | jsk-1.com | `playzone9` | `cms-media` | **yes — live** |
| `playzone9.app` | production | playzone9.app | `playzone9app` | `cms-media-pz9` | no — reserved |
| `playzone9.app` | `staging` | playzones9.com | `playzone9staging` | `cms-media-pz9-staging` | built for review |

Three hostnames, two brands. A brand's identity and the hostname it is served
on are different things, so the staging host is declared as an **environment**
of the Playzone9 brand rather than as a brand of its own — see "Environments"
below. All three siteIds differ, and no two hosts may share one:
`tests/test_generator.js` asserts it.

The siteIds `playzone9` and `playzone9app` differ by one word and mean
completely different things. See `brands/playzone9.app/README.md`.

## Environments

A brand may be served on more than one hostname. `brand.json` keeps `domain`
as the brand's canonical domain and declares the others separately:

    "domain": "playzone9.app",
    "environments": {
      "staging": { "host": "playzones9.com",
                   "siteId": "playzone9staging",
                   "bucket": "cms-media-pz9-staging",
                   "noindex": true }
    }

    node tools/build-site.js playzone9.app                  # the canonical domain
    node tools/build-site.js playzone9.app --env staging     # playzones9.com

Building with `--env` swaps the host, so every canonical, `og:url`, JSON-LD
url and sitemap entry follows automatically — they all render from
`{{brand.domain}}`. The brand id, its directory and its identity do not move,
which is the point: renaming a brand to its staging host would mean renaming
it back at launch.

`production` is never declared. It is the brand on its own `domain`, so a
brand that has never heard of environments behaves exactly as before.

Three refusals keep a review copy from becoming the thing it reviews: an
environment may not use the brand's canonical domain, may not share the
canonical `siteId`, and must name a `host`.

**`noindex: true`** makes the build a review host: every page's robots meta is
rewritten to `noindex,nofollow` (counted — one tag per page or the build
stops), no `sitemap.xml` is emitted at all, `robots.txt` blocks everything,
and the generated `brand.js` sets `window.CMS_NOINDEX` so the engine cannot
repaint it indexable from any data layer.

## Adding a brand

1. `mkdir brands/<hostname>` and write `brand.json` with the four required fields.
2. Copy an existing `brand.js`, replace its values. This is the brand's content:
   headings, page copy, SEO defaults. Nothing here is shared.
3. Optionally add `seo-config.json`, `slots/`, `pages/` — see `templates/README.md`
   for what a slot and an override are.
4. Add `seo-config.json` — copy `tools/seo-config.json` and set `seo.baseUrl`
   to the brand's own `https://<hostname>`. This one is **required**: a site
   assembled without it would ship a sitemap describing another brand's domain.
5. `node tools/build-site.js <hostname> --check` — plans and prints, writes
   nothing. Every validation runs, so a broken brand fails here.
6. `node tools/build-site.js <hostname>` — assembles `sites/<output>/`: the
   shared engine, the brand's overlay, its generated pages, and its sitemap and
   robots.txt. `tools/build-brand.js` is still there for the brand-owned files
   alone.
7. Register the hostname in `js/cms-config.js` `CMS_BRANDS` so a visitor on that
   domain resolves to the right `siteId` and the right storage namespace. A
   brand can be assembled before this step — that is how a site gets reviewed
   before its domain is wired up — and the assembler says so when it is missing.
8. Give the brand its own Supabase `site_brand` row, keyed by its `siteId`.
   **Never reuse another brand's row.**

Steps 7 and 8 are the only ones outside this directory, and neither is a code
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
