# One CMS, many brands

JSK1 and Playzone9 are managed by the **same** CMS. There is no second admin,
no per-brand fork of `js/cms.js`, and no brand name anywhere in the shared
engine. This is how that works, and what stops one brand from overwriting
another.

## The mechanism, in one line

**The hostname decides the brand, and the brand is a Supabase row.**

```
visitor / admin on        js/cms-config.js resolves        reads and writes
------------------------  -------------------------------  ------------------
jsk-1.com                 siteId playzone9                 site_brand/playzone9
playzone9.app  (reserved) siteId playzone9app               site_brand/playzone9app
playzones9.com (staging)  siteId playzone9staging           site_brand/playzone9staging
```

Every read (`Remote.pull`) and every write (`Remote.publish`) is keyed to
`CMS_REMOTE.siteId`, which comes from that resolution and nowhere else. So two
brands are isolated by construction: there is no code path that writes a row
other than the one the hostname resolved to.

Matching is exact — lower-cased, one trailing dot removed, then an equality
test against a key in `CMS_BRANDS`. No substring, no suffix, no wildcard.
`playzone9.com`, `playzones9.app` and `playzones9.com.evil.example` all fail to
match.

## The four layers a value passes through

Lowest first; the last one that sets a key wins:

```
js/cms.js DEFAULTS   the SHAPE of a brand, and the engine's shipped palette.
                     Brand-neutral: not one brand's name, domain or page title.
brands/<host>/brand.js   THIS brand's identity and fallback content.
the Supabase row     what an admin published. The live site.
localStorage         this browser's unsaved edits.
```

`DEFAULTS` is what makes a fourth brand cheap: it provides every key the CMS
expects to exist, with nothing in it. A brand that omits a key renders its own
static HTML rather than another brand's content, because `setMeta` and
`computeTitle` skip empty values. (`paintText` does not — it writes an empty
string — which is why the three keys `DEFAULTS` deliberately leaves blank
must be set by every brand. See `brands/playzone9.app/README.md`.)

The row wins at runtime; for the **static build** the brand layer wins, because a
build that read the row would stop being a deterministic artifact of its commit.
Every brand's `brand.js` therefore carries a `CMS_BRAND_PROVENANCE` declaration
recording which row it was exported from and a fingerprint of each page of
published Page Builder content, and each brand's build verifies that file against
its own declaration only — a `brand.js` copied from another brand fails on the
recorded `siteId`. Freshness against the live row is a separate, networked,
opt-in command. See `docs/publishing.md`.

## What Phase 7 added

The isolation above already existed. What was missing was that nothing *said*
which brand you were editing, and nothing *checked* it.

### `CMS.brand`

A read-only accessor over what the resolver already published. It derives
nothing and stores nothing:

| | |
|---|---|
| `host()` | the hostname this page was served from |
| `matched()` | whether that hostname is a registered brand |
| `siteId()` | the row this CMS reads and writes |
| `bucket()` | this brand's media bucket |
| `storageSuffix()` | its browser-storage namespace |
| `noindex()` | true on a review build |
| `all()` | every registered brand, with the current one flagged |
| `expectedSiteId()` | the row the registry says this host should write |
| `agrees()` | whether those two match |

`matched()` is worth dwelling on. `localhost`, a CI run, a preview URL and a
`file://` open are **not** the brand they render — they fall back to
`CMS_BRAND_DEFAULT` so that something appears. The admin says so, because
"editing the live site" and "editing the live site's row from somewhere that
is not the live site" look identical otherwise.

### A write guard

`Remote.publish()` refuses when `agrees()` is false, before anything reaches
the network, and the message names the hostname and both rows. This was
already structurally true; asserting it means a later refactor cannot quietly
make one brand's admin write another brand's row — a mistake with no undo,
because the row is replaced whole rather than merged.

A deployment with **no** registry at all (an older `cms-config.js` that sets
only `CMS_REMOTE`) has one brand by definition, so there is nothing to cross
and the guard stands aside.

### A Brands panel

Read-only, driven entirely by `CMS_BRANDS`. It shows which brand this CMS is
editing, warns when the hostname is unregistered or the configuration
disagrees or the build is a review build, and lists every registered brand
with a link to **its own** `/admin/`.

That link is the answer to "how do I edit the other brand": you open that
brand's CMS, which is this same CMS served for that brand. There is
deliberately **no** brand switcher. A dropdown that changed which row is
written would undo the guard above and put the one unrecoverable mistake back
on the screen as a menu item. Editing several brands from one place safely
needs per-brand authorization in Supabase row-level security, which is a
different piece of work.

## Adding a brand to the CMS

No CMS change at all:

1. `brands/<host>/` with `brand.json`, `brand.js`, `seo-config.json` — see
   `brands/README.md`.
2. An entry in `CMS_BRANDS` in `js/cms-config.js`, with **its own** `siteId`
   and **its own** `bucket`. Never reuse another brand's.
3. A `site_brand` row keyed by that `siteId`.

The new brand then appears in the Brands panel, resolves on its hostname, gets
its own storage namespace, and publishes to its own row. Nothing in
`js/cms.js`, `js/admin.js`, `admin/index.html` or `css/admin.css` mentions a
brand, and `tests/test_cms_brands.js` asserts that.

## The branding settings, and where each one lives

All of them are per brand, in that brand's row, edited in the existing panels:

| Setting | CMS key | Panel |
|---|---|---|
| Logo, mobile logo, footer/login logos | `images.*` | Images, Branding |
| Favicon | `images.favicon`, or a `static/` overlay of `assets/images/favicon.png` | Images |
| Primary / secondary / accent / background / text | `colors.*` (~80 variables, generated from five) | Colors, Theme Manager |
| Typography | `design.*` | Typography |
| Brand images | `images.*`, plus the Media library | Images, Media |
| SEO title / description | `seo.defaultTitle`, `seo.defaultDescription`, `pages.*.title` | SEO |
| Social image | `seo.ogImage` | SEO |

Nothing here was invented for Phase 7. The Theme Manager already bundles brand
text, the full palette and the image slots into a named theme, with
export/import per theme — see `README-THEME-MANAGER.txt`.

## SEO isolation

Brand-specific SEO is isolated exactly as branding is, because it is the same
row. Beyond that, the build enforces it: canonical, `og:url`, the JSON-LD urls
and the sitemap all render from the brand-domain placeholder in the shared
templates, so they follow the brand being built and cannot be set to another
brand's domain by accident. (Spelled out rather than quoted, because
`tests/test_deploy_surface.js` asserts that no *published* file contains a
placeholder — and `docs/` is published. That test caught this very sentence.)
`tests/test_assembly.js` asserts every one of those per brand, and that the
two sitemaps share zero URLs.
