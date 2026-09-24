# Publishing `sitemap.xml` and `robots.txt`

## The problem, stated honestly

This site is static and served by GitHub Pages. **Browser JavaScript in
`/admin` cannot write a file into it.** Not with a clever trick, not with a
token. Anything that claimed to would need repository write credentials in
public frontend code, where every visitor could read them.

So the admin does not write these files, and does not pretend to. It writes
**settings**, and the deploy writes the files.

---

## How it works

```
/admin > SEO            you edit pages, robots rules, the base URL
      |
      |  Save  →  the CMS record in Supabase  (authenticated admin only)
      |
GitHub Actions          "Deploy static content to Pages"
      |
      |  node tools/build-seo-files.js
      |     reads the CMS record with the PUBLIC, read-only anon key
      |     (falls back to tools/seo-config.json if it cannot)
      |     writes sitemap.xml and robots.txt into the artifact
      |
      ↓
   the live site
```

One module, `js/seo-files.js`, turns a CMS record into the two files. It is
loaded **by the browser** in `/admin`, so the preview you see is not an
approximation of what will be deployed — it is the deploy's own output,
computed early. It is `require`d **by the deploy tool**, so there is exactly
one interpretation of your settings and no way for the two to drift.

### What this adds to the workflow

One step, before the artifact is uploaded:

```yaml
- name: Generate sitemap.xml and robots.txt
  run: node tools/build-seo-files.js
```

- **No new secret.** The anon key it uses is already in `js/cms-config.js`
  and already in every visitor's browser. Row-level security makes it
  read-only.
- **No new permission.** The job still has `contents: read`. It cannot write
  to the repository.
- **No new dependency.** Plain Node, no `npm install`.

---

## What still needs a developer

**A deploy has to happen.** Saving in `/admin` does not start one.

Someone with repository access either pushes a commit, or opens
**Actions → Deploy static content to Pages → Run workflow**. That is one
click and needs no code change — `workflow_dispatch` is already enabled.

This is the honest limit of the architecture, and the admin says so on screen
rather than implying a publish button that does not exist.

### Why not go further?

The options for true one-click publishing, and why each was rejected:

| Option | Why not |
|---|---|
| A GitHub personal access token in the admin's JavaScript | It would be public. Anyone could push to the repository. Not negotiable. |
| A Supabase Edge Function holding a token | Safer, but it means a new deployment target, a new secret to rotate, and a new thing that can be misconfigured — to save one click on a file that changes a few times a year. |
| A separate backend | The whole point of this project is that it has no server. |

If one-click publishing ever becomes worth it, the Edge Function is the
route: the generator is already a dependency-free module that takes a record
and returns two strings.

---

## What the admin shows you

`/admin > SEO > Sitemap` and `> Robots.txt` each have a **Publishing** card
with a **Check what is live now** button. It fetches the real
`/sitemap.xml` or `/robots.txt` from this origin and compares it with what
your current settings produce:

- **"The published sitemap matches these settings"** — nothing is waiting.
- **"N change(s) are waiting for the next deployment"** — with each URL that
  will be added, removed, or whose `lastmod` will change.
- **"Could not read the live sitemap.xml: HTTP 404"** — a failure is reported
  as a failure. It never reads as "up to date". The card says explicitly not
  to assume the file is fine.

It also shows the live file's **provenance line**, which says whether the
deploy that produced it read the live CMS record or fell back to the
committed config.

The comparison is on meaning, not bytes: the generated files carry a comment
block that legitimately differs between those two cases, and being told
"3 changes pending" because of a comment would teach you to ignore the
warning.

---

## What goes into the sitemap

Included: every CMS page whose `url` is a plain `name.html` (or the empty
string, for the homepage).

Excluded, always:

- any page marked **noindex** (`robots.index === false`) — which is how
  `login.html` and `register.html` stay out. They are excluded *by that rule*,
  not by name, so a site that legitimately wants its sign-in page indexed only
  has to say so.
- any page with **"in sitemap" turned off**
- any page whose `url` is not a plain `.html` file name
- `/admin/`, which is not a CMS page and has no entry

`<lastmod>` is published only when the page's `updatedAt` is a real
`YYYY-MM-DD` date. A `lastmod` a crawler cannot parse is worse than none.

The file is **deterministic**: the homepage first, then alphabetical by file
name. Two records holding identical information produce byte-identical files,
so a diff only ever shows a real change.

If there is no valid absolute `seo.baseUrl`, **no sitemap is written at all**
and the deploy step fails loudly, rather than publishing a sitemap that points
nowhere.

---

## What goes into robots.txt

Always:

```
User-agent: *
Allow: /
Disallow: /admin/
Sitemap: <baseUrl>/sitemap.xml
```

Plus whatever you type into **Extra rules** — filtered, not pasted. Each line
must be a comment, or a known directive (`User-agent`, `Allow`, `Disallow`,
`Crawl-delay`, `Sitemap`, `Clean-param`, `Host`) with a value that carries no
newline, no control character and no `#`. At most 40 lines.

That filter exists because this file is read by every crawler on the
internet, and a trailing `# comment` or a stray second `Allow: /` pasted into
the box would silently undo a `Disallow` above it.

---

## `tools/seo-config.json` — the committed fallback

Used only when the deploy cannot reach the CMS record: a database outage, or
a fork with remote storage switched off. Keep it in step with the shipped
defaults in `js/cms.js`.

When it is used, the deploy log carries a `::warning::` saying so, and the
generated files carry `source: tools/seo-config.json (committed fallback)` —
which the admin then shows you when you press **Check what is live now**. A
stale fallback is visible, not silent.

---

## Running it yourself

```
node tools/build-seo-files.js --check    # print what it would write
node tools/build-seo-files.js            # write the files
```

---

## For a new white-label site

- `seo.baseUrl` in `/admin > SEO > Global SEO` — the domain
- `tools/seo-config.json` — the same, plus the page list, for the fallback
- nothing else

The generator names no site, no domain and no page. Everything comes from the
record.
