# playzones9.com — go-live runbook

Everything here is yours to run. Nothing in it has been done for you, and
nothing in it touches `jsk-1.com` or `playzone9.app`.

## 1. Hosting — recommendation

**Netlify Drop.** Drag the folder, set two DNS records at GoDaddy, done.

It is the right choice here for a reason specific to this project: **CMS changes
do not require a redeploy.** Content lives in the Supabase row, so the files you
upload once stay correct while you edit branding, colours and SEO in the admin.
A one-time upload is genuinely sufficient for staging.

    node tools/build-site.js playzone9.app --env staging
    # then drag  sites/playzones9.com/  onto  https://app.netlify.com/drop

118 files, 7.5 MB, self-contained, relative links only. `CNAME` is in there and
Netlify ignores it — you set the domain in their UI, which is fine.

Then: **Site configuration → Domain management → Add a domain →**
`playzones9.com`. Netlify will show you the exact DNS records. Use what it
shows; the table below is a cross-check, not a substitute.

Alternatives, if you prefer: **Cloudflare Pages** (needs GoDaddy's nameservers
changed to Cloudflare's — the domain stays registered at GoDaddy, but DNS
management moves, which is more than this needs) or a **second GitHub
repository** with Pages (matches how JSK1 works; four A records, and automating
uploads later needs a token).

## 2. GoDaddy DNS — exact records

GoDaddy: **My Products → Domains → `playzones9.com` → DNS → Manage Zones**.

### Remove or replace first

A new GoDaddy domain ships with parking records that will fight you:

| Type | Name | Current value | Do this |
|---|---|---|---|
| A | `@` | a GoDaddy parking IP (`Parked`) | **edit it** to the value below, or delete and re-add |
| CNAME | `www` | `@` | **edit it** to the host's target below |

Leave every `MX`, `TXT` and `NS` record alone — those are email and delegation.

### For Netlify

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `75.2.60.5` | 600 seconds (or 1 Hour) |
| CNAME | `www` | `<your-site-name>.netlify.app` | 600 seconds (or 1 Hour) |

### For a second GitHub Pages repository

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `185.199.108.153` | 600 seconds |
| A | `@` | `185.199.109.153` | 600 seconds |
| A | `@` | `185.199.110.153` | 600 seconds |
| A | `@` | `185.199.111.153` | 600 seconds |
| CNAME | `www` | `<your-username>.github.io` | 600 seconds |

**Confirm these IPs in your host's own dashboard before entering them.** This
container has no outbound network access, so I could not verify them today, and
both providers have changed them in the past. Netlify and GitHub both display
the records to use once you add the domain — those are authoritative.

GoDaddy does not support ALIAS/ANAME at the apex, which is why the apex is an
`A` record rather than a `CNAME`. Do not use GoDaddy's "Forwarding" feature —
it serves a redirect, not the site, and would break `/admin/`.

### HTTPS

Automatic on Netlify, Cloudflare and GitHub Pages — all three issue a Let's
Encrypt certificate once DNS resolves (minutes, occasionally up to an hour). On
GitHub Pages you must then tick **Enforce HTTPS**. Nothing to buy.

TTL only affects how quickly later changes propagate. 600 seconds keeps
iteration fast; raise it once you are settled.

## 3. Supabase — the `playzone9staging` row

**You may not need any SQL at all.**

`Remote.publish()` sends `POST /rest/v1/site_brand` with
`Prefer: resolution=merge-duplicates` — an upsert — and the existing policy
`"brand admin insert" ... to authenticated with check (true)` permits it. So
**signing in to `https://playzones9.com/admin/` and pressing Save creates the
row.** That is the smallest possible action: none.

If you would rather it exist first, so you can confirm reads before testing
writes, this is the whole change — **one statement**, in the SQL Editor of
project `wspanesckdedctpfbqah`:

```sql
insert into public.site_brand (id, data)
values ('playzone9staging', '{}'::jsonb)
on conflict (id) do nothing;
```

| | |
|---|---|
| **Table** | `public.site_brand` — already exists (`SQL-RUN-THIS-ONCE.txt`) |
| **Columns** | `id text primary key`, `data jsonb not null default '{}'`, `updated_at timestamptz not null default now()` |
| **Values** | `id` = `playzone9staging`, the siteId `js/cms-config.js` maps `playzones9.com` to. `data` = `'{}'` — **empty on purpose**: an empty row means "nothing published yet", so the site renders the committed fallback in `brands/playzone9.app/brand.js`, which is what you want to review first. `updated_at` takes its default. |
| **Schema changes** | **None.** No new table, column, index or type. |
| **RLS changes** | **None.** The three existing policies are not row-scoped (`using (true)`), so they already cover any `id`. |
| **What is NOT changed** | The `playzone9` row (JSK1's live content) is untouched — `on conflict do nothing` cannot modify an existing row, and a different `id` is a different row. No policy, no schema, no other table, no storage. |
| **Reversible** | Yes: `delete from public.site_brand where id = 'playzone9staging';` |

**I have not run this and cannot.** The MCP connection available here sees only
project `cmwljblucdifomwsfexb` ("jyotsana1110's Project"), which is **not** the
project this site uses, and outbound access to `wspanesckdedctpfbqah` is
blocked. I did not touch either project.

### One thing to know about the policies

`"brand admin insert"` and `"brand admin update"` are `using (true)` for
`authenticated`. So **any** signed-in Supabase user can write **any** brand's
row at the database level. The CMS refuses to (Phase 7's guard), but the
database does not. With one operator that is fine. The day someone administers
only one brand, those policies need narrowing to the rows they own.

## 4. Media — `cms-media-pz9-staging`

Currently **off**, and there is a catch.

In the Supabase dashboard of `wspanesckdedctpfbqah`:

1. **Storage → New bucket**
   - Name: `cms-media-pz9-staging`
   - **Public: yes** (these are images on a public website)
   - Optionally set a 5 MB file-size limit to match the browser's check
2. **Storage → Policies →** that bucket, three policies:

   | Operation | Roles |
   |---|---|
   | `SELECT` | `anon`, `authenticated` |
   | `INSERT` | `authenticated` **only** |
   | `DELETE` | `authenticated` **only** |

   **Never grant `INSERT` or `DELETE` to `anon`** — that is an open upload
   endpoint. Uploads are authorised with the admin's own session token; there
   is no service-role key in this codebase and there must never be one.

### The catch — tell me how you want this handled

`CMS_MEDIA_SETTINGS.enabled` in `js/cms-config.js` is **global**, not
per-brand:

```js
enabled: !!settings.enabled && !!bucket
```

All three brands have a bucket configured, so flipping that flag to `true`
turns uploads on for **JSK1 and for `playzone9.app` as well**. JSK1's
`cms-media` bucket and `cms-media-pz9`, as far as I know, do not exist — so
JSK1's admin would start offering an upload button that fails.

Two ways out, your call:

- **Create the buckets for every configured brand** before flipping the flag.
  No code change.
- **Make the flag per-brand** — add `media: true` to the `playzones9.com` entry
  in `CMS_BRANDS` and have the resolution block prefer it. About three lines. I
  have not done this: it is a config change with a blast radius, and you said
  not to add anything unnecessary.

Until one of those happens, leave media off. Everything else in the CMS works
without it; only logo and favicon *upload* is affected, and both can be set by
pointing at a committed file path instead.

## 5. After DNS resolves — what to check first

1. `https://playzones9.com/` renders.
2. `https://playzones9.com/admin/` → sidebar shows `playzones9.com`, and the
   **Brands** panel shows row `playzone9staging`, bucket
   `cms-media-pz9-staging`, and a "this is a review build" warning.
3. `https://playzones9.com/robots.txt` → contains `Disallow: /`.
4. `https://playzones9.com/sitemap.xml` → **404**.
5. View source → `noindex,nofollow`, canonical `https://playzones9.com/`.
6. `https://jsk-1.com/` → unchanged.

If step 2 shows a different row, or warns "this hostname is not a registered
brand", stop and tell me — do not publish.
