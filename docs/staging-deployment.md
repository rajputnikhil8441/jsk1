# Putting the Playzone9 staging site on playzones9.com

The build is finished and verified. What remains cannot be done from inside
this repository, and this is exactly what to do.

## Why it cannot be automated from here

**One GitHub Pages site per repository, one custom domain.** This repository's
Pages site *is* `jsk-1.com`. Serving a second hostname from it would mean
changing that domain, which is JSK1 production. So the staging site needs a
target of its own, and giving it one means a DNS change — which is yours to
make.

## Build the site

    node tools/build-site.js playzone9.app --env staging

Writes `sites/playzones9.com/` — 118 files, ~7.5 MB, including a `CNAME` that
contains `playzones9.com` and nothing else. The directory is self-contained and
uses only relative links, so it works at a domain root or under a sub-path.

Or run the **Build Playzone9 staging site** workflow (Actions → Run workflow)
and download the `playzone9-staging-site` artifact. That workflow holds
`contents: read` only, so it cannot deploy anything.

## Option A — a second GitHub repository (closest to what JSK1 does)

1. Create a repository, e.g. `playzone9-staging`. Public, or private with Pages
   enabled on a paid plan.
2. Put the contents of `sites/playzones9.com/` at its root (the `CNAME` is
   already in there) and push to `main`.
3. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder
   `/`. The `CNAME` file sets the custom domain automatically.
4. DNS for `playzones9.com` at your registrar:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<your-github-username>.github.io` |

   Confirm those four addresses against GitHub's current documentation before
   entering them — GitHub has changed them before.
5. Settings → Pages → tick **Enforce HTTPS** once the certificate is issued
   (minutes to an hour).

Automating step 2 later needs a token with write access to that repository,
stored as a secret in this one. I have not added a workflow that does this —
say the word once the repository exists and I will.

## Option B — Netlify or Cloudflare Pages (fastest to a working URL)

1. Drag `sites/playzones9.com/` onto Netlify Drop, or `wrangler pages deploy`.
2. Add `playzones9.com` as a custom domain in that dashboard.
3. Point DNS as that host instructs — usually one `CNAME` for the apex via
   their proxy, or their nameservers.

`CNAME` is ignored by both; the dashboard sets the domain. Nothing else changes.

## Option C — look at it before any DNS at all

    npx serve sites/playzones9.com
    # then open http://localhost:3000

**Caveat, and it matters:** on `localhost` the hostname is not a registered
brand, so the CMS falls back to the **default** brand and the admin will say
so — it edits JSK1's row, not the staging one. Fine for looking at layout,
wrong for testing the CMS. The admin warns about this on its Brands panel.

To exercise the CMS properly you need the real hostname, which is what
`tests/test_staging_cms.js` already does: it serves the built directory at
`https://playzones9.com` inside a browser and drives the admin there.

## After DNS resolves, check these five things

1. `https://playzones9.com/` renders and the sidebar of
   `https://playzones9.com/admin/` shows host `playzones9.com` and row
   `playzone9staging`.
2. `https://playzones9.com/robots.txt` contains `Disallow: /`.
3. `https://playzones9.com/sitemap.xml` returns **404**.
4. View source on any page: `noindex,nofollow`, and the canonical points at
   `playzones9.com`.
5. `https://jsk-1.com/` is unchanged.

## What is still missing for the CMS to be fully live

The `site_brand` row `playzone9staging` does not exist, so the staging site
renders the committed fallback in `brands/playzone9.app/brand.js`. That is
correct for reviewing the shipped fallback and it means **saving in the
staging admin has nothing to write to yet**. Creating that row is a database
change and is deliberately not done here. Media uploads are off for the same
reason: the `cms-media-pz9-staging` bucket does not exist.

## What must not happen yet

No `CNAME`, DNS record, Pages site or Supabase row for **`playzone9.app`**. It
stays reserved until the staging site is approved. The build enforces its half:
the canonical-domain build of this brand contains no `CNAME` at all, and
`tests/test_staging_cms.js` asserts it.
