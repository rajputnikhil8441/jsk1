# Publishing

One action sends changes to the server. Everything else stays on this device.

```
EDIT
  ↓  saved on this device
N UNPUBLISHED CHANGES
  ↓  Review & Publish
SEE EXACTLY WHAT WILL BE PUBLISHED
  ↓  Confirm
Publishing…
  ↓  write to the brand's row
  ↓  read the row back
Published ✓
```

- Admin UI: `admin/index.html` (top bar, `#pubModal`), `js/admin.js`
- Engine: `js/cms.js` (`Remote.publish`, `confirmWrite`, `changeIndex`)
- Tests: `tests/test_publishing.js`

---

## The one rule

There are two functions, named for what they reach:

| | Reaches | Can say "Published" |
| --- | --- | --- |
| `commitLocal()` | localStorage | no |
| `publishToRemote()` | the brand's Supabase row | only after read-back |

There used to be a single `commit(silent)`, and the difference between "this
browser" and "every visitor" was one boolean argument at twenty call sites.
That is what made **Save**, **Save draft** and **Publish** indistinguishable.

The Page Builder is handed `commitLocal` and `stagePublish`, never a generic
commit (`js/admin.js`, the `PBAdmin({...})` call). It therefore has no binding
that can reach Supabase: no edit made there — autosave, drag, template,
recovery, migration — can publish, by construction rather than by remembering
to pass a flag.

### What used to publish and no longer does

| Action | Then | Now |
| --- | --- | --- |
| Applying a colour palette | published the whole record | local |
| Uploading an image | published the whole record | local (the bytes still go to the bucket) |
| Deleting an uploaded image | published the whole record | local |
| Restoring a backup | left the record dirty | local, and says so |
| Page Builder Publish | published immediately | stages an intent, then one review |

---

## Two states, never one

| Indicator | Answers | Element |
| --- | --- | --- |
| Local save | is this edit on this disk? | `#savedFlag` |
| Publish | does the server have it? | `#pubState` |

`#pubState` is one of `clean`, `local`, `publishing`, `published`, `failed`,
readable from `data-pubstate`.

These were one flag. A Page Builder keystroke — which saves locally and
deliberately does not publish — flipped the top bar to "Saved" and disarmed the
unload guard while the brand was still unpublished.

`dirty` now means **not published**, which is what the unload guard and the
change count are actually about.

### A failure stays a failure

`failed` keeps the reason on screen, keeps the change count, and keeps the
unload guard armed. Editing more does not launder it into "saved"; only a
confirmed publish clears it. It used to be a toast that vanished after 2.6
seconds, leaving the admin claiming to be saved.

---

## Read-back: a 2xx is not publication

```
POST /rest/v1/site_brand        upsert, whole record
GET  ?id=eq.<siteId>&select=updated_at
Date.parse(returned) === Date.parse(sent)   →  Published
```

Anything else is `failed`: the row could not be read back, or it holds a
different timestamp because something else wrote after us. Publishing used to
end at the status code.

**The timestamps are compared as instants, not strings.** We send an ISO string
from JavaScript and Postgres returns a `timestamptz` its own way:

```
sent      2026-09-27T12:00:00.000Z
returned  2026-09-27T12:00:00+00:00
```

Same instant, different strings. A string comparison would report **every**
successful publish as a failure. `tests/test_publishing.js` stubs the offset
form specifically.

---

## Review & Publish

The sheet names the brand, the hostname and the target row, lists what will be
published, and lists what will not.

The list comes from `CMS.changedAreas()`, which hashes the **same record**
`withoutLocalKeys(load())` sends — so the sheet cannot describe one thing while
the payload carries another.

### Why a hash index and not a snapshot

`publishIndex` is a map of `area → short hash`, written after a confirmed
publish and re-seeded from the row on every pull, because the row *is* what is
published.

A full "last published" snapshot would double a record that already carries
base64 images and is already close enough to the localStorage quota that the
admin has a storage meter and a quota handler. It would break saving in order
to answer a question about saving.

The index **over-reports rather than under-reports**: an area missing from it
counts as changed, so the first publish from a browser lists everything. That is
true — nothing has been confirmed from there. Telling someone a colour will be
published when it is identical costs a glance; the opposite costs a surprise.

`updatedAt` is deliberately not hashed: it moves whenever anything else on a
page moves, and including it would report every page as changed every time.

### Staged intent

Page Builder **Publish** and **Unpublish** do not mutate anything when pressed.
They describe what they want — `{slug: 'publish'|'unpublish'}` — and that is
applied only when a publish is confirmed.

So **Cancel is free**: there is nothing to undo, because nothing was done. No
rollback logic, which is the thing that gets a half-applied state wrong.

---

## Reload vs Discard

Two different questions, two separate controls. They were one button called
Revert, which did neither honestly: it re-read localStorage, so it reverted to
the last *local* save rather than to anything the server had.

| | What it does | Destructive |
| --- | --- | --- |
| **Reload from server** | answers "what is published now?" | no |
| **Discard local changes** | goes back to the published state | yes, brand-level only |

**Reload** with nothing unpublished takes the server's version wholesale. With
unpublished changes it refreshes only the published *baseline* — the change
index and the row's timestamp — so the review sheet is accurate against what is
on the server now, including anything another editor published, and says plainly
that the local changes are still there. Reload is never a discard in disguise.

**Discard** confirms first, names how many changes it will drop, and **keeps
Page Builder drafts**, the section library and the recovery snapshots. Drafts are
page-level work, and each page can already discard its own draft.

### When nothing has been published yet

`Remote.pull()` returns `null` for a brand with no row, and Discard says so:
it restores the **shipped defaults** rather than claiming a server restore that
did not happen. This is the normal state of a brand that has not gone live —
Playzone9 staging, for instance, whose row does not exist until its first
publish creates it.

---

## What never leaves this device

One list, `LOCAL_ONLY_KEYS` in `js/cms.js`, with three consumers: the publish
payload, an export, and the pull (which must not let an incoming row wipe them).

| Key | What |
| --- | --- |
| `builderDrafts` | each page's working copy |
| `builderLibrary` | the reusable-section library |
| `builderRecovery` | one recovery snapshot per page |
| `publishIndex` | area → hash at the last confirmed publish |
| `lastPublished` | the row's `updated_at`, and when this browser confirmed it |

It is one list on purpose. The two consumers used to disagree — publish stripped
three keys and `exportJSON()` stripped none — so a downloaded file carried
unpublished drafts and the section library that the admin promises never leaves
the device.

Published page content (`pages.<slug>.builder`) is **content**, and is in both
the payload and a backup.

---

## Backup is not publishing

**Backup & Restore** (was Export / Import) downloads and restores a copy of the
brand's content. Neither reaches the server; a restore becomes unpublished
changes like any other edit.

It used to carry a card headed **"Publish to every device"** whose button
downloaded a file. It published nothing, and its text said admin changes live in
this browser only — which stopped being true the day remote storage arrived.

**Download brand defaults (`brand.js`)** replaces it, under *For developers*. It
generates the committed defaults for a brand: the values a visitor sees before
the published row loads, and the starting point for a new brand. It writes a
file and publishes nothing.

---

## Which brand am I publishing to

Shown in the top bar and again in the review sheet and on the confirm button:

```
Playzone9
playzones9.com
Target row: playzone9staging
```

The **hostname** and the **row id** are always shown. The display name comes
from `branding.siteName`, which is editable content and can be blank mid-edit,
so it falls back to the hostname; the row is the thing that actually keeps two
brands apart.

`Brand.agrees()` still refuses a publish when the registry and the configured
row disagree, and is unchanged. The difference is that the UI now says which row
*before* the click rather than only refusing after it.

Hostname → brand resolution stays in `js/cms-config.js`, which is committed code
reviewed in a diff. There is no brand switcher: to edit another brand, open its
own address.

---

## Whole-record publish

A publish sends the **entire record** for the brand, as it always has. This is
unchanged deliberately — a diff-based publish is a separate piece of work.

Two consequences worth knowing, neither introduced here:

- Once a brand has been published, the row is what visitors get and `js/brand.js`
  is the fallback beneath it. Editing `brand.js` does not change a brand that has
  already published.
- Two admin tabs editing one brand will overwrite each other; nothing detects it.
  An optimistic-concurrency check on `updated_at` is the fix, and is deferred.

---

## Page Builder content in the HTML we serve

A builder-managed page used to ship an empty mount:

```html
<div data-cms-sections="about"></div>
```

so the published headings, paragraphs, links and images existed only after
JavaScript ran. A crawler that executes JavaScript read the builder content; one
that does not read the static fallback copy instead, which is placeholder prose.
Two different documents at one URL.

The build now fills that div:

```html
<div data-cms-sections="about" data-cms-baked="1">
  <section class="pb-section pb-text" data-sec="s1">…the published content…</section>
</div>
```

- Baker: `tools/lib/pbbake.js`, `tools/lib/minidom.js`
- Generator: `tools/lib/brandkit.js` (`renderPage`)
- Tests: `tests/test_pb_bake.js`

### One renderer, not two

The markup is produced by **`js/cms.js`'s own renderer**. `pbbake.js` loads that
file in a `vm` against a small DOM (`minidom.js`) and calls
`CMS.sections.renderInto` — the same function the browser calls. There is no
second renderer, so the static HTML and the runtime DOM cannot describe the page
differently, and the thirteen element types are not implemented twice.

The only thing written twice is HTML serialisation: ours in `minidom.js`, the
browser's in `innerHTML`. `tests/test_pb_bake.js` asserts they are
**byte-identical** for a fixture covering every element type, including
ampersands and angle brackets in text, quotes in attributes, void elements,
boolean attributes, disabled elements, unknown types and nested columns.

Evaluating a committed browser file in a `vm` is already how
`tools/build-seo-files.js` reads `js/cms-config.js`; this is that pattern, not a
new liberty.

### Where the build gets the sections

`brands/<id>/brand.js` — the brand's committed CMS layer, which every visitor
already downloads and which the admin can regenerate from *Backup & Restore →
Download brand defaults*. It is read, never written.

#### It is not the same file as the repository root's `js/brand.js`

They used to be byte-identical, and a test pinned them that way, because
production served the repository root: the root copy *was* the deployed brand
layer. That ended when the deploy started assembling the site.

| File | What it is | Who reads it |
| --- | --- | --- |
| `brands/jsk-1.com/brand.js` | the **build source** — an export of what the CMS has published, regenerated whenever you export | `tools/build-site.js`, and through it every deployed page |
| `js/brand.js` (repository root) | the **shipped fallback** — the frozen pre-CMS layer | the local static server, `tests/serve.js`, and anyone opening the repository root in a browser |

The deployed site's `js/brand.js` is generated *from* the brand directory
(`tools/lib/brandkit.js`), so a visitor never loads the root copy. Keeping the
root copy frozen is deliberate on two counts: it is the fallback a local
developer sees before the Supabase row loads — the row still supplies live
content at runtime, exactly as in production — and it is the fixture the browser
suites are written against. Pointing those suites at a file that changes every
time someone publishes would mean a footer edit could fail a test about the
Page Builder.

`tests/test_generator.js` asserts what must still hold across the two: the build
ships the brand layer unchanged, the root copy still matches its Phase 0
fixture, and every key the shipped layer provides is still present in the brand
layer the build ships.

That is the DEFAULT source, and the only one a local build or a test uses: no
network, and two builds of one commit produce byte-identical HTML.

#### `--from-cms`: baking what the CMS has published

The deploy passes `--from-cms`, which reads the brand's **published record**
and bakes that instead. It is the same record in the same shape, through the
same renderer — a second SOURCE, not a second bake — and it is what removes the
export-and-commit step from an ordinary content change:

```
CMS publish  ->  a build runs  ->  build-site.js --from-cms  ->  HTML contains the content
```

The middle box is not free, and leaving it out is how this broke in production
once. `--from-cms` reads the row **when the build runs**, so publishing reaches
the HTML only if publishing can *start a build*. Publishing writes the Supabase
row and touches nothing in this repository; with `push` as the deploy's only
trigger, nothing rebuilt, the served HTML stayed at the row as it was when the
last commit landed, and the runtime painted the current row over the mount after
load. The page looked correct and its source was a week old — the same content
visible in DevTools and absent from View Source. See **What starts a deploy**
below.

The trade is deliberate. A build that reads the row is no longer a pure function
of the commit; it is a function of the commit *and* what is published when it
runs. That is the point — the content is supposed to be live — but it means the
failure modes are new, and all of them are quiet ones that would replace a live
page with an empty mount. Every one of them **stops the build**:

| What | What happens |
| --- | --- |
| remote storage not configured for the brand's host | refuses; will not fall back to the committed layer, which would ship different content than the CMS has |
| `js/cms-config.js` resolves the host to a different row than the brand declares | refuses — *"Refusing to bake another brand's content into this site"* |
| the row cannot be read, or has no data | refuses rather than deploying HTML without the published content |
| the row publishes nothing for a page the committed layer publishes | refuses, names the pages, and says how to proceed |

That last one is the important one: unpublishing a page is legitimate, so it is
allowed **explicitly** with `--allow-unpublish` rather than guessed at. Neither
deploy workflow passes it, so an unexpectedly empty row stops the deploy instead
of blanking production.

`--row FILE` reads a captured payload instead of fetching, which is how
`tests/test_cms_bake.js` drives this path with no network and how a deploy can be
replayed from a known record.

**The committed layer still ships**, as `js/brand.js`, and is still what a
visitor's browser falls back to before the row loads. In `--from-cms` mode the
integrity guard therefore reports on it rather than failing the build: the
content that was baked came from the row and is unaffected by it. The build says
which source it used on its own `Content :` line, first thing.

### The rule when the row and the commit disagree

> The published row is authoritative **at runtime**.
> The committed brand layer is authoritative **for the build**.

Publishing in `/admin` is live immediately for anyone running JavaScript. The
baked copy — what a crawler without JavaScript reads — updates on the next
build, which a publish can now start (see **What starts a deploy**). The build
prints what it baked per page:

```
Builder  : about (1 section)   baked into the HTML from brands/<id>/brand.js
Builder  : (no published content in brands/<id>/brand.js)
```

so a drift is visible rather than silent, and the build never claims to have
baked content it did not. A baker that cannot run is a build failure, not an
empty div.

### What starts a deploy

Both site deploys (`static.yml`, `deploy-playzone9.yml`) carry four triggers,
and two of them exist because **content changes without a commit**:

| Trigger | When | Why |
| --- | --- | --- |
| `push` to `main` | a code or brand-layer change | as before |
| `repository_dispatch` `cms-published` | something server-side says a publish happened | the immediate path: a rebuild within the minute |
| `schedule` `*/30 * * * *` | every 30 minutes | the safety net — publishing reaches the HTML with nothing configured |
| `workflow_dispatch` | someone clicks Run workflow | publish now, deploy now |

The timer alone is enough: a published change is in the HTML source within half
an hour, unattended. The build is deterministic for a given row, so a run with
nothing new republishes the same bytes, and a run that cannot read the row fails
without deploying.

#### Making a publish deploy immediately (optional, needs configuration)

`repository_dispatch` is inert until something fires it. The intended firer is a
**Supabase Database Webhook** on the brand table — server-side, so no credential
reaches a browser and none is committed here:

1. Create a fine-grained GitHub personal access token scoped to **this
   repository only**, with **Contents: read and write** (the permission
   `POST /repos/{owner}/{repo}/dispatches` requires). Nothing else.
2. In the Supabase dashboard, add a **Database Webhook** on the brand table for
   `UPDATE`, pointing at
   `https://api.github.com/repos/<owner>/<repo>/dispatches`, with headers
   `Authorization: Bearer <token>`, `Accept: application/vnd.github+json`, and
   body `{"event_type":"cms-published"}`.

That is a dashboard change, not a repository one: the token lives in Supabase,
the workflow already accepts the event, and nothing in this repo needs editing.
Skipping it costs only latency — the timer still gets the content out.

### The deploy checks the HTML it published

A green deploy is not evidence that the content is in the served HTML. The build
can bake, the upload can succeed, `deploy-pages` can report success, and the
site can still return the previous version — and a browser will hide that,
because the runtime paints the live row over the mount. So the last step asks
the site:

```yaml
- name: Verify the baked CMS content is in the deployed HTML
  run: |
    node tools/verify-deployed.js \
      --site _site/jsk-1.com \
      --url "${{ steps.deployment.outputs.page_url }}"
```

`tools/verify-deployed.js` compares the ARTIFACT THAT WAS DEPLOYED with the
RESPONSE THE SITE GIVES, which is what keeps it white-label: the artifact is the
expectation, so it names no brand, domain, page or SEO value, and it has no
production URL of its own. `--served DIR` reads the response from a directory
instead of the network, which is how `tests/test_cms_bake.js` covers it offline.

It checks, for every generated page and without executing any JavaScript:

- the page answers, and is the one that was built;
- every `data-cms-baked` mount's **entire markup** appears verbatim;
- `<title>`, description, canonical, robots, `og:*`, `twitter:*` and both
  JSON-LD blocks match the artifact — only tags the artifact actually has, so a
  page with no `og:image` is not failed for one;
- canonical and `og:url` are on the host being verified;
- `sitemap.xml` is served, byte-identical, and every `<loc>` is a built page
  that answers;
- a site whose artifact publishes no sitemap serves none;
- `robots.txt` is served and byte-identical;
- a page the artifact marks `noindex` is served `noindex`.

Each finding is tagged, so a red step says which problem this is:

| Kind | Meaning |
|---|---|
| `unreachable` / `missing-html` | the site did not answer, or a generated page is not served |
| `stale` | served, but not this build's version |
| `missing-seo` | a tag the artifact carries is absent from the response |
| `cross-host` | a URL in the served page points at another host |
| `sitemap-mismatch` | the sitemap is missing, differs, or names a page that is not served |
| `noindex-leak` | a review host is not protected as its artifact says |

`static.yml` passes the URL Pages just deployed to. The other site publishes to
a repository something else serves, so its address is not the workflow's to
know: it verifies only when `vars.PLAYZONE9_VERIFY_URL` is set, and the step
does not run otherwise.

| Exit | Meaning |
| --- | --- |
| 0 | every baked mount is in the served HTML (or nothing was baked, and it says so) |
| 1 | a mount is missing or differs — the deployed HTML is not what was built |
| 2 | the check could not be made (the site could not be fetched) |

### What the deploy actually does

`.github/workflows/static.yml` assembles the site and uploads that:

```yaml
- name: Assemble the site
  run: node tools/build-site.js jsk-1.com --from-cms --out _site
- name: Upload artifact
  uses: actions/upload-pages-artifact@v3
  with:
    path: '_site/jsk-1.com'
```

It used to upload `path: '.'` — the repository — with four build-only
directories deleted from the runner's checkout first. That is why a
builder-managed page shipped an empty mount however correct the baker was: the
baker was never part of the deploy. Nothing is deleted now; `templates/`,
`brands/`, `tools/` and `tests/` are simply never copied, because the assembler
emits only what the brand system names.

**No `.html` file in the repository is edited to publish content.** The pages
are rendered from `templates/pages/` on every deploy, and the mount is filled
from the brand layer. The chain is:

> publish in `/admin` → *Download brand defaults* → commit
> `brands/<id>/brand.js` → push → the workflow assembles → the content is in the
> HTTP response

The repository-root `*.html` files are not part of that chain and are not
deployed. They remain the shell the local server and the browser suites use, and
`tests/fixtures/golden-jsk1/` still pins them.

### Runtime: exactly one copy

`renderSectionsInto()` **replaces** the mount's contents, so a runtime render
over baked markup leaves one copy, not two. One case needed adding: when the row
says nothing is published any more, stale baked markup is cleared and the
fallback copy comes back — otherwise a page would show the baked sections *and*
the restored fallback at once. That is what `data-cms-baked` is for.

Asserted in `tests/test_pb_bake.js`: one section, one heading, one paragraph, one
link, one image, one `#cmsBuilder` element and one `<h1>` after JavaScript runs —
with the row agreeing with the bake, with no row at all, with the row
unpublished, and with the row publishing something different.

### What each state does

| State | Baked HTML | After JavaScript |
| --- | --- | --- |
| Published sections | the sections | same sections, redrawn once |
| Nothing published | empty mount, no marker | untouched; fallback copy renders |
| Draft only | empty mount | untouched; fallback copy renders |
| Published empty canvas | empty mount, `data-cms-baked="0"` | stays empty — the documented empty canvas |
| Row unpublished after the deploy | the sections | cleared, fallback restored |
| Row publishes something newer | the older sections | replaced by the row's |

### Multi-brand

Nothing in the bake knows a brand. The generator hands it whichever brand
directory the build resolved from its brand argument, through the brand system
that already existed. Brand A's build reads A's `brand.js`; brand B's reads B's.
`tests/test_pb_bake.js` builds two brands with different published content
through the one pipeline and asserts each page contains its own content and
**none** of the other's.

### Baking sections changes no page's SEO

On a page that ships its own template, title, meta description, canonical,
robots, Open Graph, Twitter/X, the four head JSON-LD blocks, `sitemap.xml`,
`robots.txt`, the H1 and the URL structure are exactly as they were. A test
builds the same brand with and without published builder content and asserts
every one of those is identical; the only difference is body content.

**One exception, and it is content rather than metadata.** A page whose
sections carry an FAQ with at least one complete question-and-answer pair
bakes a single `FAQPage` JSON-LD block alongside those sections, inside the
mount — not in the `<head>`, and not in any template. It describes content
that is on the page, it appears only when that content is, and it cannot
duplicate because the mount is rewritten whole on every render. Nothing in
the `<head>` moves. See *Content authoring* in `docs/page-builder.md` for
what it refuses and why.

A page the CMS creates is a different matter: it has no committed template, so
its SEO is baked from the record. See **A page the CMS creates** below.

This puts the published content in the initial HTML response. It does not
guarantee anything about ranking.

---

## Is the build source the artifact, and is it current?

The bake reads `brands/<id>/brand.js`. That file is committed, so two questions
follow, and **they are different questions**. Conflating them is how a guard
ends up claiming something it cannot prove.

| | Question | Where it is answered | Network |
| --- | --- | --- | --- |
| **Part 1 — integrity** | Is the committed `brand.js` the artifact the admin exported? | every build, `tools/lib/pbbake.js` → `verifyBuildSource()` | none |
| **Part 2 — freshness** | Is that export still what the CMS has published? | `node tools/check-published.js <brand-id>`, run on demand | Supabase |

**Part 1 cannot detect a publish that happened after the export.** Nothing
offline can: a publish writes a Supabase row and leaves no trace in the
repository, so the commit contains no evidence that it happened. Part 1 proves
the build source has not been edited, truncated, half-merged or swapped between
brands since it was exported. Part 2 is the only thing that proves the export is
current, and it can only do it by asking the row.

### Part 1: the provenance declaration

*Backup & Restore → Download brand defaults* appends a second declaration to
`brand.js`, after `window.CMS_BRAND`:

```js
window.CMS_BRAND_PROVENANCE = {
  "version": 1,
  "brand": { "siteId": "playzone9", "host": "jsk-1.com" },
  "publishedRowUpdatedAt": "2026-09-27T12:00:00.000Z",
  "exportedAt": "2026-09-27T12:04:11.902Z",
  "builder": { "about": "874910bb:136" }
};
```

It is **not content**. Nothing renders it, the CMS never merges it, and removing
it changes no page. `builder` maps a slug to the fingerprint of that page's
published sections; `CMS.sections.fingerprint()` computes it, and the same
function is used by the build and by `check-published.js`, so there is one
algorithm and not three. The fingerprint covers `schemaVersion` and `sections`
and deliberately ignores `updatedAt`, so re-saving without changing anything does
not read as a change.

Every build then compares the declaration with the file it sits in:

```
Source   : verified against the recorded export   exported 2026-09-27T12:04:11.902Z   row 2026-09-27T12:00:00.000Z   [integrity only -- freshness: node tools/check-published.js jsk-1.com]
```

Four outcomes:

| In `brands/<id>/brand.js` | Build |
| --- | --- |
| Provenance present, every fingerprint matches | passes, prints `verified against the recorded export` |
| Provenance records a page `brand.js` no longer publishes | **fails** (`missing`) |
| A page's sections differ from the recorded fingerprint | **fails** (`changed`, printing both fingerprints) |
| `brand.js` publishes a page the export did not record | **fails** (`extra`) |
| Provenance recorded for another brand's row | **fails** (`brand`) — a `brand.js` copied between brands is internally consistent, so whose export it is has to be checked separately |
| No provenance at all | **warns and proceeds** |

Missing provenance warns rather than failing, because every brand exported before
this existed is in that state and breaking those builds would be worse than the
problem the guard solves. The warning is only emitted when something was actually
baked — a brand that publishes no builder content has no integrity to be in
question, and a line that always fires is a line people learn to ignore:

```
::warning::brands/<id>/brand.js carries no CMS_BRAND_PROVENANCE …
Source   : no published builder content to verify
```

The brand check is why a swap is caught. A `brand.js` lifted from brand B into
brand A's directory carries B's fingerprints *and* B's `siteId`, so it verifies
against itself and fails against the build.

### Part 2: `tools/check-published.js`

```bash
node tools/check-published.js jsk-1.com          # ask the row
node tools/check-published.js jsk-1.com --row captured.json   # a payload on disk
```

It resolves the brand through the same brand system the build uses, refuses to
compare if `js/cms-config.js` maps that host to a different row than the brand
declares, fingerprints both sides with the same function, and prints a page by
page table:

```
Page                 committed            server
-------------------- -------------------- ---------------------
about                874910bb:136         3c2f1aa0:141          DIFFERS

Row updated_at: recorded 2026-09-27T12:00:00.000Z, server 2026-09-28T09:41:02+00:00   (the row has been written since this export)

::error::STALE BUILD SOURCE for brand "jsk-1.com" (row playzone9): 1 page(s) differ …
```

Exit `0` in sync (or nothing published on either side), `1` stale, `2` the check
could not be made — no such brand, remote storage not configured, no network. It
reads only: it never writes a repository file and never writes to Supabase.

**It is not part of the build.** `tools/build-site.js` never calls it. Run it
before a deploy, or as its own CI step, if you want the deploy gated on
freshness. The `updated_at` comparison is by `Date.parse()`, never by string:
JavaScript sends `…T12:00:00.000Z` and Postgres returns `…T12:00:00+00:00`, which
are the same instant and different strings.

### Normal builds stay offline

The bake and the guard make **zero network calls**. `tools/lib/cmsrow.js` — the
only Supabase reader in `tools/` — is required by `tools/check-published.js` and
by `tools/build-seo-files.js`, and by nothing in the bake path. A test builds a
brand with published builder content while the reader is stubbed to fail and
asserts the baked HTML is byte-identical to the normal build's.

One honest caveat, pre-existing and unchanged by this work: the **SEO step**
(`tools/build-seo-files.js`) has always *attempted* a row read, and falls back to
the committed layer with a warning when it cannot — which in this repository's CI
is always, because Supabase is unreachable from it. So "the build makes no
network call" is true of the bake and the guard, and not of the SEO step, which
is out of scope here.

### What this means day to day

Publishing in `/admin` is live immediately for anyone running JavaScript. For the
static HTML — what a crawler without JavaScript reads — a publish is not finished
until the build source is updated:

> publish → deploy

That is the whole loop now. The deploy reads the published record itself
(`--from-cms`), so an ordinary content change needs **no export, no commit and
no `brand.js` edit** — and no `.html` file is touched at any point, because the
pages are rendered from `templates/pages/` on every build.

Exporting and committing `brands/<id>/brand.js` is still worth doing, but for a
different reason: it is the fallback a visitor's browser uses before the row
loads, and the source a build uses without `--from-cms`. It is no longer on the
critical path for publishing.

Part 1 guarantees that whatever you committed is what was exported. Part 2, when
you run it, tells you whether that export is still what is published. Neither
closes the gap automatically, and the build says so on its own `Source :` line.

---

## A page the CMS creates

`/admin > SEO > Create a page` writes a page record and nothing else used to
happen: it handed you an HTML file to commit. It no longer does. The chain is:

```
a page record in the CMS
   ↓  status: published
the build generates <slug>.html from templates/cms-page.html
   ↓  CMS.seo.tags() for that page
its SEO is baked into the HTML
   ↓  the file now exists
sitemap.xml lists it
   ↓
deploy
   ↓
the deployed HTTP response is verified
```

### The template

`templates/cms-page.html`, deliberately NOT in `templates/pages/` — that
directory *is* the committed page list, so a generic template inside it would be
published as a page called `cms-page.html` on every brand.

It is the same page as every other: the shared header, nav and footer, the same
stylesheets, the same `info-article` structure, the same `data-cms-*` hooks, and
the same Page Builder mount convention, so `tools/lib/pbbake.js` bakes the
page's published sections into it with the renderer `js/cms.js` itself runs.
Nothing about it is brand-specific: `{{brand.*}}` and `{{page.*}}` tokens carry
every value in, and `{{page.*}}` values are HTML-escaped because an admin types
them while a developer commits `brand.json`.

The URL convention is unchanged: `/<slug>.html` at the site root. No directory
URLs, and no existing URL moves.

### Draft or published

A page record says whether it is live, in the word the builder blocks already
use:

| `status` | Meaning |
|---|---|
| `published` | published |
| absent or empty | published — every record written before the lifecycle existed is a live page |
| anything else | **not** published: `draft`, a typo, or a word a later admin writes that this build has never heard of |

The asymmetry is deliberate. Wrongly hiding a page costs a missing page; wrongly
showing one publishes something nobody approved. A draft page is generated
nowhere, listed nowhere, and its content appears in no file. A draft *builder
block* inside a published page is excluded by the same rule the renderer
applies.

Marking a **committed** page draft cannot take it off the site — its own
template still generates it — and the build says so, naming the template.

`/admin` shows one Publication select, and only for pages the CMS created:
the pages that ship with the site have no lifecycle to switch.

### What gets baked

Computed by `CMS.seo.tags()` — the engine's own function, the same table
`paintSeo()` applies in a browser, so the static document and the painted one
cannot describe a page differently:

`<title>` · meta description · canonical · robots · `og:site_name` ·
`og:title` · `og:description` · `og:url` · `og:image` · `twitter:card` ·
`twitter:title` · `twitter:description` · `twitter:image` · WebPage JSON-LD ·
BreadcrumbList JSON-LD

A blank CMS value never empties a tag: it falls back to what the template
shipped, which is the promise `setMeta()` keeps at runtime. A social image the
platform cannot fetch — a `data:` or `blob:` URL — writes no tag at all rather
than an unusable one, because that is what `crawlableImage()` returning `''`
means.

An environment build bakes the host it is **served** from, so a review copy
canonicalises to itself and never to the production domain.

### Refusals

| What | What happens |
|---|---|
| a record whose url is a committed page's file | the build fails, naming both: a CMS page must not overwrite a committed page |
| a reserved name (`index`, `admin`, `404`, `sitemap`, `robots`, `login`, `register`) | the build fails, listing them |
| a url this build could not create | warns, generates nothing, advertises nothing — one bad record must not stop a site deploying |

---

## The content model in the HTML we serve

`docs/page-builder.md` has the architecture. What matters here is the one rule
this document exists for: **everything the content model publishes is in the
static HTML, before any JavaScript runs.**

```
pages.<slug> { type, publishedAt, excerpt, author, related }
   ↓  CMS.seo.tags()        og:type, from the validated content type
   ↓  seoTokenValues()      baked into templates/cms-page.html
   ↓  the mount bake        Article, the page list, ItemList -- in the body
sitemap.xml                 published + indexable, exactly as before
```

What is baked, and where:

| Output | Where it lands | Emitted by |
|---|---|---|
| `og:type` | `<head>`, `{{seo.ogType}}` | `seoTokenValues()` |
| `Article` JSON-LD | in the body, `data-pb-article` | the section renderer |
| `CollectionPage` | `<head>`, inside `#ldPage` | `buildWebPage()`, as a subtype |
| `ItemList` | in the body, `data-pb-list` | the page list element |
| A related or hub listing | in the body, as `<ul>` of links | the page list element |

The two JSON-LD blocks in the body are there for the same reason `FAQPage` has
been since Phase 2A: a body block reaches every page type without a template
needing an anchor, and a page that does not qualify emits **nothing** rather
than an empty `{}` — which is what keeps the HTML of pages the content model
does not touch byte-identical.

`og:type` is a token rather than a hardcoded value now, and for every page whose
type is empty it bakes the same `website` the template used to carry. No existing
page changed.

### Which pages the build will list

A listing element may only draw from the brand being built. The build computes
that brand's merged record once, in `tools/lib/brandkit.js`, and passes it into
every `renderPage()`; the renderer takes it as an argument rather than reading
ambient state. This matters because `tools/lib/pbbake.js` loads **one engine per
process** and shares it across brands — an element that read whatever was last
loaded would have published the wrong brand's pages.

The same sharing had a defect Phase 2C fixed: `seoEngine()` cached its
`{CMS, record}` pair per brand, but the CMS it handed back carried whichever
brand's record was replaced last. Asking about brand A, then B, then A again
answered with B's canonical and B's title. Production never saw it — this tool
builds one brand per process — but it would have made every in-process
white-label test lie. A cache hit now re-establishes the record.

### What a draft and a noindex page do

Unchanged, and now asserted from three directions:

- a **draft** page generates no file and has no sitemap entry, and no listing
  anywhere draws it;
- a **noindex** page generates a file, has no sitemap entry, and no listing draws
  it either;
- a **review host** (`--env staging`) publishes content types normally and
  indexes nothing: every page carries `noindex,nofollow`, and there is no
  sitemap at all.

## Topics in the HTML we serve (Phase 2F)

Categories and tags add **topics, not URLs**. The claim is measured, not
asserted: `tests/test_taxonomy_static.js` builds the same site twice — once with
a category and tags on every content page, once with the collections empty — and
asserts the two builds produce the identical file set, a byte-identical
`sitemap.xml` and a byte-identical `robots.txt`.

What reaches a generated page, before any JavaScript runs:

- the **Category and tags** element's `<aside class="pb-el pb-taxonomy">`, with
  the category's and tags' **names** — never their ids, and never as links,
  because there is no taxonomy page to link to;
- the **related list**, whose hand-picked entries come first and whose remaining
  room is filled by pages sharing the category or two or more tags;
- the `ItemList` describing that list, when the element asks for schema — the
  renderer emits exactly the rows it drew, so the two cannot disagree;
- `articleSection` and `keywords` inside the page's `Article` block.

Three properties of that output are asserted from the generated bytes:

- **every `href` the related list advertises is a file the build actually
  wrote** — the same guarantee the Phase 2C URL-rule fix established, now
  exercised through this path too;
- **nothing unpublished is ever advertised**: a draft, a `noindex` page and an
  address the generator refuses are absent from every related list and from the
  `ItemList`;
- **one brand only**: two brands are built using the *same* category and tag
  ids with different names, and neither build contains a trace of the other's
  names or pages.

A hostile category or tag name is escaped where it becomes output, like every
other string the renderer writes: `</script><script>alert(1)</script>` as a
category name produces no new script element, and the `Article` block still
parses. An invalid slug never reaches an `href`, because no `href` is generated
from a slug at all.

A review host is unchanged by any of this: `--env staging` publishes the topics
normally and indexes nothing — every page carries `noindex,nofollow` and there
is no sitemap.

Adding Phase 2F changed **no served page**. Building `jsk-1.com` (117 files),
`playzone9.app` (118) and the staging host (118) against the pre-2F baseline
produced identical output in every file except the five assets whose source
changed: `js/cms.js`, `js/admin.js`, `js/admin-builder.js`, `css/sections.css`
and `admin/index.html`.

## Deleting a page

A page the CMS created can be deleted: **Pages → Settings & SEO → Delete this
page**, at the bottom of the panel. A page that ships with the site (`home`,
`login`, `register`, `about`, `contact`, `responsible-gaming`,
`privacy-policy`) is not offered it, because it is generated from its own
committed template — deleting its record would not take it off the site, so the
control would be a lie. The gate is the same `CMS.DEFAULTS.pages[key]` test
**Publication** and the content-model fields already use.

The whole of deletion is `delete pages[slug]` and a publish. Everything that
makes the page actually disappear was already in place:

| Step | What makes it happen |
|---|---|
| Not enumerated | the build reads pages from the published row (`pbbake.pagesFromRecord`) |
| No `.html` generated | there is no record to generate one from |
| **Old `.html` removed** | `tools/lib/sitekit.js` `assemble()` wipes its output directory before writing — *"a stale file is a 404, or worse"* |
| Not served | both deploys replace the published tree wholesale rather than copying over it |
| Gone from `sitemap.xml` | the sitemap is audited from the same record |
| Not linked | every reader of a page reference already drops one that does not resolve |

**There is no redirect and no replacement page.** The address stops existing,
which is what a 404 is for. There is no trash and no restore: to take a page
off the site reversibly, set **Publication** to Draft instead — the confirmation
says so.

**Other pages are not edited.** A stored `related` reference to the deleted slug
stays where it is and stops resolving, exactly as a dangling category, tag or
author id does, and the referring page's own checks report it. The confirmation
counts those pages before you commit to it. Rewriting records nobody asked to
change would be a worse cure than the disease.

### What the tests prove, and what they cannot

`tests/test_page_delete.js` builds a site **twice into one directory** — the
shape a redeploy has — and asserts the file from the first build is gone after
the second, that the sitemap no longer lists it, that no generated page links to
it, that no `ItemList` asserts it, that nothing was generated in its place, that
no `http-equiv="refresh"` redirect to it exists, and that the build neither fails
nor needs `--allow-unpublish`. It also asserts that rebuilding over the old
output is byte-identical to a fresh build, and that deleting a page leaves the
same site as never having created it.

**It cannot prove the deployed URL returns 404.** `tools/verify-deployed.js`
derives its URL list from the build artifact, so a page that is no longer in the
artifact is not something it can look for — absence is not checkable from the
artifact alone, and inventing a local fake of it would prove nothing. The
build-level guarantee is asserted instead. To confirm the live behaviour:

1. In `/admin`, create a page with a throwaway slug and set it Published.
2. Publish, then let the deploy run (push to `main`, or Actions → the deploy
   workflow).
3. `curl -sSI https://jsk-1.com/<test-slug>.html` → expect `HTTP/2 200`.
4. In `/admin`, open that page and use **Delete this page**, then Publish.
5. Let the deploy run again.
6. `curl -sSI https://jsk-1.com/<test-slug>.html` → expect `HTTP/2 404`, and
   **no** `location:` header. A `301`/`302` would mean something is redirecting
   the address, which this feature deliberately does not do.

## Not solved here

- Multi-editor concurrency (above).
- Media architecture: `CMS_MEDIA_SETTINGS.enabled` is global, so it cannot be
  turned on for one brand alone.
- `brands/<id>/brand.js` is now the FALLBACK layer only: `--from-cms` reads the
  published row at build time, so an ordinary content change needs no export and
  no commit. Re-exporting it still matters for one case — the row being
  unreachable — and the provenance guard still measures how stale it is. What is
  not solved is keeping that fallback fresh automatically.
- Committed page templates carry their own static SEO and rely on the runtime for
  CMS overrides. Only pages the CMS creates have their SEO baked. Baking the
  committed ones would change existing published HTML and is deliberately a
  separate decision.
- The publish review sheet (`indexAreas()`) reads an explicit list of page
  fields and does not include the five content-model fields, so a change to only
  a page's type, date, author or related list is not itemised on the sheet. The
  values publish; the summary is silent about them.
- An `Article` block is emitted inside a page's Page Builder mount, so a page
  whose type says article but which has no published builder content publishes
  no `Article`.
- A hub's `lastmod` describes the hub, not the pages it lists.
- Page deletion has no live-deployment test. `verify-deployed.js` learns its URL
  list from the build artifact, so it cannot be asked whether a URL that is no
  longer in the artifact has stopped being served. The build-level guarantee is
  tested; the live 404 is a documented manual check above.
- Categories and tags have no public URL space at all: no archive page, no
  pagination, no "everything in Cricket" listing. That is a decision, not an
  omission — a few hundred thin archives would cost this site more than they
  could return — but it does mean a reader cannot browse by topic.
- A category's `description` is stored and published nowhere, and a taxonomy
  `slug` is validated and used by nothing that generates output. Both exist so a
  later phase could use them without re-slugging every name.
- The publish review sheet does not itemise `category` or `tags` either, for the
  same reason it omits the Phase 2C fields.
- Missing provenance warns rather than failing. Once every brand in the
  repository carries a `CMS_BRAND_PROVENANCE` declaration, that can become an
  error; until then it cannot.
