# Page Builder — Version 1

A section-based page builder inside the existing white-label CMS. The admin
composes a page out of sections, previews it at three widths, and publishes it
when it is ready. Until then visitors keep seeing exactly what they see today.

- Public renderer: `js/cms.js` (`CMS.sections`)
- Public styles: `css/sections.css`
- Admin UI: `admin/index.html` (`#panel-pages` → `#pageArea-content`),
  `js/admin-builder.js`, `js/admin.js`, `css/admin.css`
- Tests: `tests/test_pagebuilder.js`

**It is not a separate panel.** The builder is the **Content** area of the
**Pages** panel, beside **Settings & SEO**. One page selector (`#pageTabs`), one
body-content editor. It had its own navigation item and its own page tab strip,
which made it look like a second system editing the same pages — see
`docs/publishing.md`.

---

## Where the published content lives on a real page

Published sections are **in the HTML the server sends**. The build fills the
page's mount with markup produced by this file's own renderer, so a crawler
reads the same content with or without JavaScript, and JavaScript redraws it
once rather than adding a second copy. See *Page Builder content in the HTML we
serve* in `docs/publishing.md` for the mechanism, the source the build reads and
the rule for when the published row and the committed brand layer disagree. In
short:

> The published Supabase row is authoritative **at runtime**, for live visitors
> running JavaScript.
> The committed `brands/<id>/brand.js` is authoritative **for the build**, so a
> static site stays a deterministic artifact of its commit.

Which means a publish is live immediately in the browser and reaches the static
HTML on the next deploy — after *Backup & Restore → Download brand defaults* and
a commit of `brands/<id>/brand.js`. Two guards watch that hand-off, and they
answer different questions:

- **Integrity, offline, in every build.** The export writes a
  `window.CMS_BRAND_PROVENANCE` declaration next to `window.CMS_BRAND` holding a
  fingerprint of each published page. The build re-fingerprints the file and
  fails if anything was edited, dropped, added or copied in from another brand.
  A `brand.js` with no provenance — every export made before this existed —
  **warns and proceeds**. This proves the build source is the exported artifact.
  It **cannot** prove the export is current: a publish that happened afterwards
  leaves no trace in the repository.
- **Freshness, networked, on demand.** `node tools/check-published.js <brand-id>`
  fingerprints the committed source against the live row and exits non-zero if
  they differ. It is the **only** part of this that contacts Supabase; normal
  builds never require it and never call it.

---

## What it does not do

The site is static HTML on GitHub Pages: every URL is a file in the repository.
The builder therefore **cannot create a URL**. Creating a page in the admin
stores its settings and generates an HTML stub for you to download and commit —
the same thing the Pages panel already did. The builder fills pages that
already exist and carry a mount point.

Version 1 is also not Elementor: sections stack vertically, and elements stack
inside them. There is no drag-anywhere canvas.

---

## Where content lives

Everything is in the one CMS JSON object, which is layered
`DEFAULTS → window.CMS_BRAND → Supabase row → localStorage`, exactly as before.
Two new places:

| Path | What it is | Who reads it |
| --- | --- | --- |
| `builderDrafts[slug]` | the admin's working copy | the admin panel only |
| `pages[slug].builder` | what is live | the public renderer |

`builderDrafts` is one of five device-local keys stripped from both the publish
payload and an export — `LOCAL_ONLY_KEYS` in `js/cms.js`, listed in
`docs/publishing.md`. `pages[slug].builder` is content and is in both.

The public renderer **never** looks at `builderDrafts`. That one fact is what
makes a draft safe: saving one cannot change the live site, even though both
live in the same saved object.

No new Supabase table. No RLS change. No new credentials.

### The published block

```json
{
  "schemaVersion": 1,
  "status": "published",
  "updatedAt": "2026-09-20",
  "sections": [ ... ]
}
```

`publishedSections(slug)` returns the sections only when `status` is
`"published"` **and** the array is non-empty. Anything else — a draft, an empty
array, a missing block — renders nothing, and the page keeps the content in its
HTML file.

### A section

```json
{
  "id": "sec_abc123",
  "type": "hero",
  "enabled": true,
  "visibility": { "desktop": true, "tablet": true, "mobile": false },
  "style":      { "bg": "#102030", "color": "#ffffff", "padding": "60" },
  "responsive": { "tablet": { "padding": "40" }, "mobile": { "padding": "20" } },
  "elements":   [ ... ]
}
```

Types: `hero`, `text`, `image`, `imageText`, `cards`, `columns`, `banner`.
Each maps to one class (`pb-hero`, `pb-text`, …) in `css/sections.css`.

### An element

```json
{ "id": "el_abc123", "type": "heading",
  "content": { "text": "Hello", "level": "h2" },
  "style": { "fontSize": "34" },
  "responsive": { "mobile": { "fontSize": "24" } } }
```

Types: `heading`, `text`, `image`, `button`, `card`, `columns`. A `columns`
element holds `content.columns[].elements`, each edited the same way; columns
do not nest inside columns.

---

## How styling reaches the page

Style keys are not written as inline CSS. Each one becomes a custom property
in a single generated `<style id="cmsBuilder">`, scoped by attribute selector,
the same approach the sports table already uses.

Two rules make this predictable, and both were learned the hard way.

### 1. Two namespaces, and a reset

Custom properties **inherit**. With one shared `--pb-*` namespace, a section's
`--pb-padding` reached every heading, button and card inside it, and a card's
`--pb-bg` became the background of the button in that card. Setting a section
padding of 60 padded every element in it by 60.

So sections write `--pbs-*`, elements write `--pbe-*`, and every element node
carries the class `pb-el`, which resets the whole element namespace:

```css
.pb-el { --pbe-bg: initial; --pbe-color: initial; /* ... */ }
```

`initial` on a custom property is the guaranteed-invalid value, so each
`var(--pbe-x, default)` falls back to its own default rather than picking up
an ancestor's. A value can only ever style the node it was set on.

### 2. Specificity that survives the host page

A mount sits inside `<article class="info-article">`, and `css/content.css`
styles that article with descendant selectors:

```css
.info-article h2 { color: var(--hdr-bg); font-size: 17px; }   /* (0,1,1) */
.info-article a  { color: var(--link); }                       /* (0,1,1) */
```

A plain `.pb-heading` rule is `(0,1,0)` and loses to those. That is why the
heading colour control appeared to do nothing, and the same applied to heading
size and weight, text margin, button colour and the card title.

Every rule that a page rule could compete with is therefore written at
`(0,2,0)` or higher:

| What | Selector | Specificity |
| --- | --- | --- |
| element base | `.pb-el.pb-heading` | (0,2,0) |
| heading level default | `h2.pb-el.pb-heading` | (0,2,1) |
| generated element values | `.pb-el[data-el="id"]` | (0,2,0) |
| generated section values | `.pb-section[data-sec="id"]` | (0,2,0) |
| the reset | `.pb-el` | (0,1,0) |

The generated rules also sit above the reset whatever the source order, so
nothing depends on which stylesheet loads first. **No `!important` is used
anywhere**, and none is needed.

```css
.pb-section[data-sec="sec_abc"]{--pbs-bg:#102030;--pbs-padding:60px;}
@media (max-width:1024px){.pb-section[data-sec="sec_abc"]{--pbs-padding:40px;}}
@media (max-width:768px){.pb-section[data-sec="sec_abc"]{--pbs-padding:20px;}}
.pb-el[data-el="el_xyz"]{--pbe-color:#ff0000;--pbe-font-size:40px;}
```

### The tokens

| Key | Section property | Element property | Unit |
| --- | --- | --- | --- |
| `bg` | `--pbs-bg` | `--pbe-bg` | |
| `bgImage` | `--pbs-bg-image` | — | wrapped in `url()` |
| `color` | `--pbs-color` | `--pbe-color` | |
| `fontSize` | `--pbs-font-size` | `--pbe-font-size` | px |
| `fontWeight` | `--pbs-font-weight` | `--pbe-font-weight` | |
| `align` | `--pbs-align` | `--pbe-align` (+ `--pbe-self`, `--pbe-justify`) | |
| `padding` | `--pbs-padding` | `--pbe-padding` | px |
| `margin` | `--pbs-margin` | `--pbe-margin` | px |
| `maxWidth` | `--pbs-max-width` | `--pbe-max-width` | px |
| `height` | `--pbs-height` (min-height) | `--pbe-height` | px |
| `border` | `--pbs-border` | `--pbe-border` | |
| `radius` | `--pbs-radius` | `--pbe-radius` | px |
| `shadow` | `--pbs-shadow` | `--pbe-shadow` | |
| `gap` | `--pbs-gap` | `--pbe-gap` | px |

Breakpoints: tablet `max-width: 1024px`, mobile `max-width: 768px`. An empty
value means "inherit the wider breakpoint", never zero. Visibility adds
`pb-hide-desktop`, `pb-hide-tablet` or `pb-hide-mobile`.

### Which control applies to which element

`CMS.sections.elementStyleKeys` is the single source of truth, and the admin
builds its Design tab from it, so a control is never offered for an element
whose CSS would ignore it.

| Element | Controls |
| --- | --- |
| heading, text | color, fontSize, fontWeight, align, bg, padding, margin, maxWidth, border, radius, shadow |
| image | align, margin, maxWidth, height, border, radius, shadow |
| button | bg, color, fontSize, fontWeight, align, padding, margin, border, radius, shadow |
| card | bg, color, align, padding, margin, maxWidth, gap, border, radius, shadow |
| columns | align, margin, maxWidth, gap |
| list, toc | as heading/text, plus gap (space between items) |
| table | as heading/text; `padding` is the space inside each cell |

For image, button, card and columns, `align` is emitted as box alignment
(`align-self`/`justify-self`) as well as `text-align`, because those are laid
out as flex or grid items rather than as blocks of text.

Headings get a default size per level (h1 34px … h6 15px). Any authored
`fontSize` still wins.

## Global design (stage 6)

Ten semantic colour roles and eight typography roles that a section or element
points at by name, so one change moves everything using them.

### Schema

One top-level `design` key, in the same JSON object as everything else — no new
Supabase table, no change to RLS or authentication:

```js
design: {
  colors:     { <role>: "<css colour>" },     // Page-Builder-only overrides
  typography: { <role>: { fontSize, fontWeight, lineHeight, letterSpacing } }
}
```

Both maps ship **empty**, and a record that has no `design` key at all resolves
exactly the same way. A role only appears once someone sets it.

### Colour roles and where they come from

| Role | Resolves from | Shipped value |
| --- | --- | --- |
| `primary` | site colour `hdr-bg` | `#0088cc` |
| `text` | site colour `text` | `#222222` |
| `muted` | site colour `text-dim` | `#777777` |
| `border` | site colour `border` | `#d4d4d4` |
| `background` | site colour `page-bg` | `#eef0f3` |
| `surface` | site colour `content-bg` | `#ffffff` |
| `secondary` | — | `#5a6b7c` |
| `success` | — | `#1e7e34` |
| `warning` | — | `#b8860b` |
| `danger` | — | `#c62828` |

The first six are **aliases**: the Colors panel stays their source of truth and
nothing is copied. The last four name concepts the site has no colour for, so
they carry a constant in `PB_COLOR_ROLES`.

Resolution order for every role: `design.colors[role]` → the site colour it
aliases → the shipped constant. Each candidate goes through `pbCssValue()`, so
a broken saved value is skipped rather than emitted.

### Typography roles

`body`, `h1`–`h6`, `button`, each carrying `fontSize`, `fontWeight`,
`lineHeight` and `letterSpacing`. The `h1`–`h6` defaults are the same numbers
`css/sections.css` already falls back to, so pointing a heading at its matching
role changes nothing until the role is edited.

Only `body` maps into the site's own typography system (`typography.base`);
`TYPO_TARGETS` has no `h1`–`h6`, and its `headerBtns` targets the site's header
buttons rather than anything the Page Builder draws. Resolution order:
`design.typography[role][prop]` → `typography.base[prop]` for `body` only →
the shipped constant.

### Heading level is not a typography role

`content.level` decides the HTML tag (`<h2>`), `style.typography` decides how it
looks (`@h1`). They are independent: choosing a role never rewrites the level,
and changing the level never rewrites a style value.

### How a reference reaches the page

`designCSS()` builds one `:root` block into `<style id="cmsDesign">`:

```
:root{--pbg-primary:#0088cc;…;--pbg-h2-size:28px;--pbg-h2-weight:700;…}
```

An element storing `color: "@primary"` emits
`--pbe-color:var(--pbg-primary,#0088cc)` — **the reference, never the resolved
colour**. Changing a global value therefore repaints ~900 bytes of `:root` and
moves every element at once; no element rule is regenerated. `paintVars()`
calls `paintDesign()`, so a role that aliases a site colour follows it live.

A typography role expands into the four font properties, written through the
same token map (so a section gets `--pbs-*` and an element `--pbe-*`) and only
for the properties that element type actually reads. It is emitted **before**
the individual size/weight/spacing keys, so an explicit value later in the same
rule wins. That is the whole override mechanism: local beats global by source
order, not by specificity.

### Global vs local

| Stored | Result |
| --- | --- |
| `color: "@primary"` | follows the global role |
| `color: "#ff0000"` | custom; unaffected by global changes |
| `typography: "@h2"` | size, weight, line and letter spacing from the role |
| `typography: "@h2", fontSize: 30` | role supplies the rest; `30px` wins |
| nothing | the element's shipped default, exactly as in V1 |

Switching a control from a role to Custom does not clear the stored reference
until a colour is actually typed, and the previous custom colour is offered
back when switching again — so flipping between the two loses neither.

### Scope

A `design.colors` override is written to `--pbg-*`, which only the Page Builder
reads. Overriding the builder's Primary cannot repaint the navigation, the odds
table or the footer. Editing the site colour in the **Colors** panel does move
both, because they are the same value by definition.

### Token security

- A name is only ever a **key** into `PB_COLOR_ROLES` / `PB_TYPO_ROLES`, read
  with `hasOwnProperty`, so `@constructor`, `@toString`, `@__proto__` and
  `@hasOwnProperty` resolve to nothing.
- What is emitted is built from the map. The stored text never reaches the
  stylesheet.
- An unrecognised name emits **no declaration at all**, leaving the element's
  shipped default in charge.
- `pbCssValue()` refuses any value containing `var(`, so author text cannot
  reach a custom property that the design tokens do not own.
- In a border shorthand a role is accepted only as the final colour word;
  `2px @primary solid` is refused outright rather than half-resolved.

### Fallback

Every emitted reference carries the shipped constant as its `var()` fallback,
so a page whose `:root` block never arrived still paints a sensible colour. A
`design` key that is missing, `null`, a string, or half-built resolves to the
shipped values without throwing.

---

## Reusable sections and templates (milestone A)

Both rest on one primitive, `pbCleanSections()`: untrusted section-shaped
data in, a freshly **built** array out.

### The sanitiser

Nothing is copied unless its key is on a list, and a new object is built
rather than the input cleaned in place. That is what makes `__proto__`,
`constructor` and `prototype` non-events — they are not on any list, so they
are never copied, and nothing is ever written onto `Object.prototype`.

| Layer | Rule |
| --- | --- |
| Section | `type` must be in `PB_SECTION_CLASS`, else the section is dropped |
| Element | `type` must be in `PB_ELEMENTS`, else that element is dropped |
| Content | key must be in `PB_CONTENT_KEYS[type]`; values must be a boolean, a finite number or a control-character-free string under 4000 chars |
| URLs | `src`, `href`, `image`, `buttonHref`, `url` go through `pbUrl()` |
| Names | `icon`, `variant`, `level`, `titleLevel`, `platform` must be on the renderer's own allow-list |
| Items | a row missing a required key (`question`; `platform`+`url`) is dropped |
| Style | key must be in that type's `PB_EL_STYLE_KEYS` / `PB_SEC_STYLE_KEYS`; a `@role` must resolve, anything else must pass `pbCssValue()` |
| Depth | elements nest three deep, 200 per list, 12 columns, 100 items |

No second set of checks exists: these are the renderer's own.

### Reusable sections

Stored under a top-level `builderLibrary`:

```js
builderLibrary: {
  version: 1,
  items: [ { id, name, createdAt, updatedAt, section: { …a full section… } } ]
}
```

**Device-local, exactly like `builderDrafts`**: stripped from
`Remote.publish()` and preserved across `Remote.pull()`. A saved section is
never part of what a visitor downloads and never travels between devices
except through an export file someone chooses to move.

An item holds a **copy**. `library.instance(id)` returns another copy with
fresh ids, so a page and a library entry have no link: editing either leaves
the other alone. There are deliberately **no live-linked instances** —
nothing in the current architecture could keep them consistent across a
publish.

`CMS.sections.library`: `list()`, `save(name, section)`, `rename(id, name)`,
`duplicate(id)`, `remove(id)`, `instance(id)`, `exportJSON()`,
`importJSON(text)`.

### Export / import format

```json
{ "kind": "jsk1-page-builder-library", "version": 1,
  "schemaVersion": 2, "exportedAt": "2026-09-21",
  "items": [ { "name": "…", "createdAt": "…", "section": { … } } ] }
```

Device-local ids are not exported. Import accepts that shape or a bare array
of entries, and never trusts either: every section is rebuilt by
`pbCleanSections()`, so an entry carrying an unknown element type, a
`javascript:` link, a style value that would close a CSS rule or a
`__proto__` key arrives as the clean part of itself or not at all.
`importJSON()` returns `{ added, skipped, error }` and never throws.

A `builderLibrary` that is missing, `null`, a string, a number, an array or
half-built reads as an empty library and still accepts a save.

### Templates

A **code registry**, not a table: deterministic, diffable and testable.
Six entries — `blank`, `landing`, `information`, `contact`, `feature`,
`faq` — each plain data in the existing section schema, each passed through
`pbCleanSections()` like anything else. A template therefore cannot reach a
page with something the builder's own controls could not have produced.

`CMS.sections.templates()` lists them with a name, description, version and
section/element counts. `CMS.sections.fromTemplate(id)` returns a clean,
freshly-ided **copy** — the registry entry is never handed out, so editing a
page cannot change the registry and changing the registry cannot change a
page that already exists.

Content is placeholder wording only. Nothing in a template states a fact
about the site.

`version` records which revision a page started from, stored on the page as
`pages[slug].builderTemplate = { id, version }`. It is **provenance, not a
link** — the copy is what holds pages still.

### Draft and publish

**There is no Save draft button.** Every edit persists on its own — 250ms after
a keystroke, immediately for anything else — and the state line says *"Draft
saved on this device"* when it lands, or says plainly that storage refused and
offers **Try again**. A button that repeated an autosave read as a third kind of
saving next to Save and Publish. `window.ADMIN_BUILDER.flush()` forces a pending
write, and retries a refused one.

**Publish and Unpublish stage an intent.** They do not write anything when
pressed: they describe what they want and hand it to the admin's one Review &
Publish flow, which applies it only if the publish is confirmed. Cancelling
leaves the page exactly as it was, because nothing was done. The builder cannot
reach the network at all — it is handed `commitLocal` and `stagePublish`, never a
generic commit.

Applying a template or inserting a reusable section writes to the **draft**
only, through the same `saveDraft()` the rest of the builder uses. Nothing
reaches a visitor until Publish. SEO fields, the page schema and the
static-first SEO behaviour are untouched by both features.

### Known limitations

- The library lives in this browser. Clearing site data loses it; export
  first. It is not synced, by design.
- No live-linked instances: updating a library entry does not update pages
  that already use it.
- Applying a template **replaces** the current draft (after a confirmation)
  rather than merging into it.
- Templates are code, so adding one is a commit, not an admin action.
- Large images are still referenced by path; nothing here stores base64.

---

## Images and the asset picker (milestone B)

### The registry

`assets/asset-manifest.json`, generated by `tools/build-asset-manifest.js`
from what is actually on disk and committed alongside it. This is a static
site — there is no directory to ask at runtime — so the list is a file, and
regenerating it is deterministic, byte for byte, so a stale manifest shows
up as a diff.

```json
{ "kind": "jsk1-asset-manifest", "version": 1,
  "roots": ["assets/images/", "assets/images/games/", "assets/icons/"],
  "assets": [ { "path": "assets/images/logo.png", "name": "logo",
                "group": "Site images", "bytes": 17947, "w": 675, "h": 229 } ] }
```

Run it after adding or removing an image:

```
node tools/build-asset-manifest.js
```

**Dimensions are read from each file's own header** (PNG IHDR, the JPEG SOF
marker chain, GIF, WebP, and an SVG's `width`/`height` or `viewBox`). A file
whose header cannot be read gets **no** dimensions rather than invented
ones, and the picker then leaves the width and height boxes alone.

### Supported paths

Only `assets/images/` and `assets/icons/` (and anything below them), and
only `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`.

`pbAsset()` is a **stricter question than `pbUrl()`**. `pbUrl()` answers "is
this safe in a `src`", and says yes to `https://anywhere` — right for a link
an author typed, wrong for a picker whose whole point is that it can only
produce a file already in this repository. So `pbAsset()` additionally
requires a plain relative path (`^[A-Za-z0-9][A-Za-z0-9._/-]*$`, no `..`, no
`//`), a known root, and a real image extension. Everything else is refused:
`javascript:`, `data:`, `blob:`, `//host`, any external domain, any
traversal, a query or fragment, a leading slash, a backslash, or a
non-image extension.

The manifest is **rebuilt** by `CMS.sections.assetList()` before anything is
shown, so an entry whose path is not one of ours never reaches the grid
whatever the file says. Duplicates collapse to the first, nonsense
dimensions are dropped, and the list is sorted by path.

### The picker

A modal in the Page Builder, reusing the admin's existing modal component.
It shows every listed asset with a thumbnail, its real dimensions and its
size; search matches name, group or path. Choosing one stores **the path**,
and fills in the width and height when the manifest has them. Cancel,
Escape and the backdrop all close it without changing anything, and
reopening it starts on the image the element is already using.

It is offered on every element that genuinely holds an image: **Image**,
**Card** and **Feature box**. The free-text field stays beside it, because
a page may already name an image the picker does not list and that has to
remain editable — it is guarded by `pbUrl()` as it always was, and the
field says when a value is not one of this site's images.

The picker has **two tabs**, because a site has two kinds of image:

| Tab | What it lists | Where the file lives | Who can add one |
|---|---|---|---|
| **Site images** | `assets/asset-manifest.json` | committed in this repository | a developer, by committing a file |
| **Uploaded images** | the CMS media library | the site's Supabase Storage bucket | any signed-in admin, from `/admin` |

They are validated by two separate functions that share no code path —
`CMS.sections.assetPath()` for a repository path and
`CMS.sections.mediaPath()` for an uploaded URL — so neither can ever accept
the other's input, and widening one cannot widen the other. What gets stored
in the element is a path in the first case and an absolute URL in the second;
nothing is base64-encoded and no external host is ever accepted.

See **[docs/media-library.md](media-library.md)** for uploading, and for what
has to be configured once before the Uploaded tab does anything.

### Preview

The preview is the real page in an iframe, painted with the draft through
`CMS.sections.paint({slug, sections})`. It renders at a **real viewport
width** and is then scaled down to fit the column, so the page inside
genuinely is 390px wide on the mobile setting and the site's own media
queries apply to it.

| Mode | Width | Band |
| --- | --- | --- |
| Desktop | 1280px | over 1024px |
| Tablet | 900px | 769–1024px |
| Mobile | 390px | up to 768px |

Those widths sit inside the site's existing breakpoints (1024px and 768px
in `css/sections.css` and `css/responsive.css`); no new breakpoint is
introduced, and the band is shown next to the buttons.

Scaling is only ever **down** — a uniform transform on an already-correct
layout, so it cannot distort. A viewport narrower than the column is shown
at its real size and centred.

Switching viewport is a **viewing mode**: it writes nothing to the draft,
the page, or the responsive overrides, and it never publishes. Tested.

### Known limitations

- Adding an image means committing the file **and** regenerating the
  manifest. There is no upload, by design.
- The picker lists what the manifest holds; an image added without
  regenerating will not appear, though a path typed by hand still works.
- No gallery, video or carousel element — deferred.
- The preview column scales a 1280px page into a side panel, so the desktop
  view is shown at roughly 45–60% depending on window width. The layout is
  accurate; the text is small.
- SVGs without `width`/`height` or a `viewBox` would carry no dimensions.
  Every SVG currently in the repository has one.

---

## The SEO dashboard and builder content

`/admin > SEO > Dashboard` checks every page: title length, meta description,
duplicate titles, canonical, share image — and the page's **content**.

For a page whose body is written as HTML, "content" is the `body` field, as
it always was. For a page the builder owns, reading that field would report
an empty body and zero words while the live page was full of copy. So the
dashboard asks the renderer instead:

```js
var pub  = CMS.sections.published(slug);   // published sections, or null
var host = document.createElement('div');
CMS.sections.renderInto(host, pub);        // the SAME call the page makes
analyse(host.innerHTML);
```

`renderInto` is the function the public page calls. The markup the dashboard
measures is therefore **byte-identical** to the markup a visitor is served —
there is one interpretation of a section array, not two that could drift.
A test asserts exactly that equality.

### Published, not draft

Only **published** sections are analysed. A draft is not on the web, and
reporting it as content would tell an author their SEO is fixed when nothing
has shipped.

Each row on the dashboard says which it is looking at:

| Badge | Meaning |
|---|---|
| **Page body** | no builder block; the shipped HTML is what is live |
| **Builder draft — not published** | a draft exists, but the shipped HTML is still what visitors see, and that is what was analysed |
| **Page Builder — published** | the published sections were analysed |
| **Page Builder — published, draft pending** | the published sections were analysed, and there are unpublished changes |

The last case also adds a check in the list, so it is visible without reading
the badge.

### The checks themselves

One implementation serves both kinds of content, because a builder page and a
hand-written page should be held to the same standard and told so in the same
words: H1 count, word count, skipped heading levels, images without alt text,
and links to pages the CMS does not know about.

One rule differs, deliberately. An `<img alt="">` in hand-written HTML is a
**decorative** image, which is a real and correct thing to write. In the
builder the alt is a form field, so an empty one means nobody filled it in.
Same check, two honest readings of the thing being checked.

### Cost

Rendering a section array creates `<img>` elements, and an `<img>` starts
fetching the moment its `src` is set — inserted or not. The dashboard rebuilds
on every keystroke in an SEO field, so the rendered markup is memoised against
the exact sections it came from: identical content renders once, edited content
renders again.

## Editing safety and responsive editing (milestone C)

### What "unsaved" means here

The builder writes the draft to `localStorage` on a ~250 ms debounce and on
every structural action, so an edit is normally on disk a quarter of a
second after it is typed. `beforeunload` already guards the rest.

What the save state reports is therefore narrow and precise:

| State | Meaning |
| --- | --- |
| *(nothing)* | idle |
| Saving… | typed, debounce not fired yet |
| Draft saved on this device | the draft is on disk |
| **Not saved** | the write was **refused**; the edit is in memory only |

The last one is why this exists. `CMS.save()` returns `false` when
`localStorage` refuses — a full quota is the usual cause — and the builder
used to discard that answer and say "Saved". `pbPersist()` now returns
whether the write happened, keeps the draft in memory either way, and says
plainly when it did not. **A failed save is never reported as a success,
and nothing is rolled back because of one.** Pressing *Save draft* again
after freeing space succeeds.

### Publish fires once per click

`commit()` hands back the publish promise, and the builder holds the button
until that round trip finishes. Without it a second click landed while the
first was in flight and published twice. Tested: three clicks in one tick
produce one POST.

### Recovery

Two actions replace a draft outright — applying a template over it, and
discarding it. Both now take a snapshot first, stored under a top-level
`builderRecovery`:

```js
builderRecovery: { "<slug>": { at, reason, sections } }
```

**One snapshot per page, sections only.** A new snapshot replaces the old
one; restoring or dismissing removes it. Device-local like `builderDrafts`
and `builderLibrary`: stripped from the publish payload, preserved across a
pull. Sections go through `pbCleanSections()` on the way out, so a snapshot
edited in storage cannot put anything into a page the builder's own
controls could not have produced.

Restoring is itself reversible: whatever it replaces becomes the new
snapshot.

### Undo — deliberately not built

There is no undo/redo stack, and this is a decision rather than an
omission. The draft auto-saves, so the window an undo would cover is a
quarter of a second of typing, which the browser's own undo already
handles inside a field. The moments that actually lost work were the two
above, and a single snapshot addresses both at a fraction of the
complexity. A general stack would mean cloning the whole section tree on
every keystroke and deciding what a "step" is across text, style,
responsive and structural edits — real complexity for a case the snapshot
covers. Revisit if the snapshot proves too coarse in practice.

### Responsive editing

The model was already right: **inheritance is the absence of a value.** A
breakpoint with no key for a property inherits, and the renderer's `var()`
chain does the work. Mobile falls back to tablet, tablet to desktop.

What was missing was saying so. Each control on the Tablet or Mobile tab
now shows one of two lines:

- *Inherited from Desktop (32)* — nothing stored here; the inherited value
  is also the box's placeholder.
- *Overriding Desktop (32)* — stored here, with a reset button beside it.

**Reset deletes the key** rather than writing a duplicate, because
inheritance *is* the absence of a value. Each breakpoint tab carries a
count of how many values it overrides, and *Clear all overrides* is
disabled when there are none.

The marking updates live on every edit rather than at build time — typing a
tablet value turns the row from inherited to overriding immediately,
without rebuilding the panel and taking focus out of the box.

Only properties on the existing per-type style-key allow-lists get these
controls, so no fake controls are introduced. The Desktop tab has no
inheritance line, having nothing above it.

Changing the preview viewport, and changing which breakpoint tab is being
edited, both write nothing at all.

### Known limitations

- The save state describes **local** storage. Publishing to other devices
  is still the separate *Publish* action and reports separately.
- One recovery snapshot per page, not a history. Replacing a draft twice
  leaves only the most recent previous version.
- No undo/redo — see above.
- The inheritance line shows the raw stored value (`32`), not the rendered
  unit (`32px`), because that is what the box holds.

---

## Drag and drop (milestone D)

Sections, columns and elements can be dragged into a new order. Nothing
else about them changes, and nothing about dragging reaches the live site.

### One tree, addressed rather than copied

`pbDraft` is the only representation of the page the builder has, and the
drag layer does not get a second one. A drag carries an **address** into
that tree and nothing else:

| Address | Resolves to |
| --- | --- |
| `{kind:'section'}` | `pbDraft` |
| `{kind:'element', sec, el:'', col:-1}` | that section's `elements` |
| `{kind:'element', sec, el:ID, col:N}` | that column's `elements` |
| `{kind:'column', sec, el:ID}` | that element's `content.columns` |

Addresses live in `data-*` attributes, which means they come from the DOM,
which means anyone with the page open can rewrite them. So an address is
never trusted: `pbListAt()` re-resolves it against the live tree when the
drop is validated, and again when it is applied. An id that was never
real, is no longer real, or names the wrong kind of node fails to resolve
and the drop is refused. **The DOM says where the pointer is; it never
says what the page is.**

The move itself is a `splice` of the *same object* out of one array and
into another. Nothing is cloned, re-serialised or rebuilt, which is why
content, styles, responsive overrides, `@role` references, asset paths and
dimensions, column ratios, nesting and element ids all survive: they are
never touched. `@primary` stays `@primary`; it does not become `#0088cc`
on the way.

### What is refused

Every refusal is in `pbDropOk()`, and each one leaves the draft
byte-identical:

- a section dropped into an element list, or an element into the section
  list — kinds never mix;
- a `columns` element dropped into a column, which is the one nesting the
  renderer refuses;
- an element dropped into itself or into its own descendant;
- a column dropped into a different `columns` element (see *Known
  limitations*);
- an unknown, malformed or stale id — including one that resolves to the
  wrong node type, and including a node that was deleted or replaced
  between `pointerdown` and `pointerup`;
- `__proto__`, `constructor` and `prototype` as ids, and anything outside
  `[A-Za-z0-9_-]{1,64}`;
- a column index that is not an in-range integer, or a drop index that is
  not an in-range integer;
- a drop back onto the node's own position, which is not a change and so
  is not a save and not a dirty draft either.

Ids are looked up by scanning arrays and comparing strings, never by
indexing an object with a caller-supplied name, so the prototype keys
could not have poisoned anything even if they were accepted. They are
refused anyway — it costs nothing, and it also means a draft that arrived
carrying such an id cannot be dragged by it.

One of these guards is **redundant as the schema stands**, and it says so
in the source rather than being counted as work it does not do. `columns`
is the only container the schema has, so the only element that can contain
a column is a columns element — and a columns element is already refused
from a column by the type check above. The descendant walk beneath it can
therefore never fire today, and no mutation test reaches it. It is kept
because it states the invariant itself (never into yourself, never into
what you contain) rather than a fact about which types happen to exist, and
a second container type would make it the one that matters.

### The drop is checked against the sanitiser

After the splice, `pbCommitMove()` asks the sanitiser — the thing that
decides what the renderer will accept — whether the move made it discard
anything it was keeping before. If so, the move is put back and nothing is
saved.

The check is deliberately **not** "the tree is clean". A draft that arrived
by hand or by import may already contain something the sanitiser drops,
and freezing every drag because of it would be both useless and confusing,
since the move buttons beside the handle would still work. It is also
counted by node *type*, not by id, because `pbCleanSection()` mints a fresh
id for any node whose own id it cannot use, and a freshly minted id is
different on every call — keying on ids would make two runs over the same
tree disagree. The sanitiser only ever drops nodes, never adds one, so a
falling count is exactly the question being asked.

It runs **once, on drop**. Never while the pointer moves.

### The pointer layer

`pointerdown` on a handle records the address and the object it points at.
Movement under 5px is treated as a click, so the handle can be clicked
without starting anything. Past that, the drag goes live: the source row
dims, and one absolutely positioned line — `.pb-dropline`, created once and
reused — shows where the node would land, in the accent colour when the
target is valid and in the danger colour when it is not.

Everything that happens per `pointermove` is reading rectangles and moving
that one line. Nothing is rebuilt and nothing in the draft is touched until
the pointer comes up. On a draft of 30 sections, 90 columns and 240
elements, 300 pointer moves are handled in about 12ms — 0.04ms each — and a
MutationObserver over `#pbList` records **zero** nodes added or removed for
the whole gesture.

A list taller than the window would otherwise be a trap, so moving the
pointer within 48px of the top or bottom edge scrolls. It is tied to the
pointer *moving* rather than to a timer, so a still hand never drifts.

### Cancelling changes nothing, by construction

`pbDragEnd()` removes listeners, releases the pointer capture, un-dims the
row and hides the line. It touches no data at all, because a cancelled drag
and a drag that never happened have to be indistinguishable in the draft —
to the author they are the same thing.

Cancelled by: **Escape**, `pointercancel`, the window losing focus,
releasing outside any list, releasing on an invalid target, switching admin
panel, and switching the preview viewport.

### Touch: the move buttons, not a drag

**Dragging with a finger is deliberately not implemented.** The section
list is the thing a finger scrolls, and taking that gesture away from
scrolling to give it to reordering trades a control people use constantly
for one they use occasionally. Every long-press-to-drag scheme also has to
guess how long a press is, and guesses wrong for some people.

So on a coarse pointer the handle is not offered at all: the stylesheet
hides it under `@media (pointer: coarse)` and `pbDragDown()` refuses a
`pointerType` of `touch` independently, so neither one alone is
load-bearing. Touch users reorder with the **Move up / Move down** buttons,
which are on every section, element and column row and do exactly what a
drag does. Nobody is trapped without a way to reorder.

Nothing about the public site's touch behaviour changes. This is admin-only.

### The keyboard

Drag is never the only way to move something. The arrow buttons on every
row were already there for sections and elements; columns now have them
too, and all three go through the same reorder and the same save path.

The one thing that needed fixing was focus. A move rebuilds a list, so the
button that was pressed no longer exists. Focus now follows the **node** to
its new row, and falls back to the opposite button when the one that was
used has just become disabled at the end of the list — press *Move up*
repeatedly and focus lands on *Move down* when the node reaches the top,
rather than on the floor.

Restoring focus is deferred by one turn on purpose: lists nest, and
rebuilding a section's elements rebuilds the columns inside them, each of
which finishes before the card that holds it is attached. Anything looking
for the moved node during that would be looking for it while it is still in
pieces.

The handle is a real `<button>`, so it is reachable by Tab and says what it
is (*Drag section* / *Drag column* / *Drag element*), but pressing it does
nothing: reordering from the keyboard is the arrow buttons' job, and two
ways to do it from one control is how people end up with neither working.
A `role="status"` live region beside the list says what happened — *Moving
this section. Escape cancels.* / *Moved the section.* / *Move cancelled.
Nothing changed.*

### Saving and publishing

A move is an edit like any other. It goes through `pbPersist()` — the same
single save path — so it marks the draft, writes it on this device, and
reports a refused write as a failure rather than as a save. There is no
second state or save system.

**Dragging never publishes.** It writes `builderDrafts[slug]` and nothing
else; the publish round trip and the milestone C double-click guard are
untouched, and the tests assert zero network POSTs across a full session of
dragging.

### Copies stay copies

Dragging inside a section inserted from the reusable library edits the
page's own copy. The library entry is byte-identical afterwards, and the
page remains a plain array of sections with no link back — there is no
`libraryId`, no live instance, nothing to re-sync.

The same holds for templates: the registry is code, `CMS.sections.templates()`
is byte-identical after any amount of dragging, and running the template
again still produces the shipped order.

### Known limitations

- **Columns reorder within the element that owns them**, not between two
  different `columns` elements. Moving one across would leave the source
  short of the container count its layout preset asks for, and the layout
  control deliberately never removes a container.
- **Element drags stay within the open section**, because only one section
  is expanded at a time, so a second section's element list is not on
  screen to drop into. Move the section, or cut across with duplicate and
  delete.
- **No touch drag** — see above. This is a decision, not a gap.
- **No undo**, still. A move is as reversible as the drag that made it:
  drag it back, or press the opposite arrow. The milestone C reasoning is
  unchanged.
- The drop indicator marks a position between rows. It does not preview the
  moved node in place.
---

## Headings, SEO and the admin (milestone E)

The builder and the SEO system are two things that share a page. This
milestone made the places they touch honest, and changed no schema to do
it.

### Where the visible H1 comes from

Every page the builder can mount ships this, in its own HTML:

```html
<h1 data-cms-text="pages.about.heading">About JSK1</h1>
<p class="info-lead" data-cms-text="pages.about.lead">…</p>
<div class="info-body" data-cms-html="pages.about.body">…</div>
<div data-cms-sections="about"></div>   <!-- the builder mounts HERE -->
```

The mount is **below** the H1. So builder sections are never the page's
first heading, and a section heading set to `h1` is always a *second* one.
That is a fact about the HTML, and it was the one thing an author could
not see from inside the builder.

Three things follow, and none of them is a schema change:

1. **No template ships an `h1` any more.** The six that did now open with
   an `h2` carrying the `@h1` typography role — it looks like a page title
   and reads as an `h2` in the outline. Templates are a code registry, so
   this affects only the next page built from one; pages already built are
   independent copies and are untouched.

2. **The builder says where the H1 comes from**, quoting the heading that
   is actually set, and says so differently when `Pages › H1 heading` is
   empty.

3. **When a draft adds an `h1`, the builder says what that costs** — how
   many the page would then show, which headings they are, by their own
   text — and offers *Make it H2* per heading and *Make them all H2*.
   Nothing changes unless the author presses one. The renderer still
   honours `h1`; this is the admin telling the truth about the choice, not
   the schema taking it away.

The **Pages** panel carries the other half: when a page's *published*
builder content contains H1s, the H1 field says so and points at where to
change them. A draft is not on the page, so a draft is not counted.

`CMS.sections.outline(sections)` is the reader behind all of it —
read-only, resolving each level exactly as the renderer does (including
its fallback to `h2`), skipping disabled sections and elements because
they render nothing, and walking into columns.

### What the builder does not touch

`pages.<slug>` stays the single SEO record, and nothing was added to it.
Builder content never reaches:

| | Comes from |
| --- | --- |
| `<title>` | `pages.<slug>.title` → `seo.defaultTitle` → the static tag |
| `meta description` | `pages.<slug>.metaDescription` → `seo.defaultDescription` → the static tag |
| `link[rel=canonical]`, `og:url` | `pages.<slug>.canonical` → built from `seo.baseUrl` + `url` |
| `meta robots` | `pages.<slug>.robots` |
| OG / X tags | `pages.<slug>.og` / `.twitter`, with X inheriting OG |
| JSON-LD | `seo.*` and `pages.<slug>.schema` / `.breadcrumb` |
| sitemap | `pages.<slug>.inSitemap`, `.robots.index`, `.url`, `.updatedAt` |

The static-first rule is unchanged: an empty or whitespace-only CMS value
leaves the tag the file shipped.

### Two fixes this turned up

**A blank-but-not-empty value could blank a good tag.** `paintSeo()` has
always trimmed before deciding whether the CMS has something to say.
`paintPageMeta()`, which paints `meta[data-cms-meta]`, did not — so a
description of three spaces was "truthy" and replaced a perfectly good
static one with nothing. It trims now, which is the static-first rule it
was already supposed to be following.

**The structured-data toggles had never reached a page.** Every page loads
`js/cms.js` from its `<head>`, and the `<script type="application/ld+json">`
blocks sit a few lines *below* that tag. `applyHead()` therefore ran while
those elements did not exist yet, `getElementById()` returned `null`, and
`writeLd()` was a no-op — so *WebPage schema*, *Mark as ContactPage* and
*BreadcrumbList schema* in `/admin › Pages` were controls that did nothing.
`paintSchemaLate()` now runs one more pass once the document has parsed,
writing exactly what `paintSeo()` would have written. The static blocks in
the files are still correct and still what a crawler without JavaScript
sees; what changed is that switching a block off now switches it off.

### Publishing builder content dates the page

`publish()` and `unpublish()` now stamp `pages.<slug>.updatedAt` as well as
the builder block's own date. The sitemap reads it for `<lastmod>`, and a
`lastmod` that predates the content it describes is worse than none. This
changes no page's sitemap **membership** — only its date.

### The sitemap never sees builder data

Membership and `lastmod` come from page configuration alone: `inSitemap`,
`robots.index`, `url`, `updatedAt`. No builder heading, link target or
image path can reach the XML, a page excluded by hand stays excluded
whatever is published on it, a `noindex` page stays out whatever the
*Include in sitemap* toggle says, and `login`, `register` and `/admin`
stay out as before.

### Choosing an OG or X image

The OG and X image fields now have *Choose from site images*, which opens
**the Page Builder's own picker** — same manifest, same `pbAsset()` rules,
same modal. A second picker here would be a second thing to keep honest.
What lands in the field is a plain relative path; the SEO engine already
makes it absolute against `seo.baseUrl`, and `crawlableImage()` already
refuses `data:` and `blob:` for a crawler. The field still accepts a full
`https://` address typed by hand, exactly as before.

### Admin UX

- **Which page am I editing** is written out under the page tabs — label,
  address, and how many sections and elements are in the draft — because
  the tab strip scrolls and highlighting alone can scroll away with it.
- **The save line says what is true.** The window between a keystroke and
  the write used to read *Saving…*; the write is synchronous, so nothing
  was saving. It reads **Unsaved changes** now. The other three states
  (silent, *Draft saved on this device*, and the refused-write failure
  from milestone C) are unchanged.
- **Every disabled button says why it is disabled**, in its own tooltip,
  rather than just looking broken.
- **The menu button on a phone is a real target.** It was an icon and
  nothing else, so when the icon font did not arrive — a slow or blocked
  CDN, an offline first paint — it collapsed to 0×0 and the panel list
  became unreachable on a phone. It carries its own 40px size now, and no
  longer shrinks when the header is crowded.
- **The admin no longer scrolls sideways** at 390px: the header title gives
  way instead of pushing *Save* off the edge, and the bar wraps when it
  must.
- **Keyboard focus is visible** on every control in the admin, rather than
  relying on the browser's thin default ring. Reordering from the keyboard
  is a designed path, so where the keyboard is has to be obvious.
- Page, SEO and builder tabs carry `aria-current`, and an open section
  reports `aria-expanded`.

### Known limitations

- The H1 notice describes the **draft** in the builder and the
  **published** content in Pages. Those are different numbers while a
  draft is unpublished, on purpose — each panel reports the thing it is
  about.
- *Make it H2* is the only level the button offers. Any other level is a
  choice, and choices belong in the Level control beside the heading.
- Nothing warns about heading-level *order* (an `h4` directly under an
  `h2`). Counting H1s is a fact; outline quality is a judgement, and the
  builder does not make judgements about content.
- The structured-data blocks a page can publish are still only the ones
  its HTML file ships a `<script id="ld…">` for. Adding a new block type
  means adding the tag to the file.
---

## Final hardening (milestone F)

Milestone F added no features. It audited the whole lifecycle — admin, draft,
save, Supabase, publish, static page, public render, SEO output — and fixed
what that turned up.

### What V2 is, finally

| | |
| --- | --- |
| **Sections** | hero, text, image, image + text, cards, columns, banner |
| **Elements** | heading, text, image, button, card, columns, divider, spacer, icon, notice, feature box, FAQ, social links — from Phase 2A, list, table, table of contents — from Phase 2B, testimonials, stats, pricing, gallery, progress, tabs, carousel, video |
| **Columns** | 13 ratio presets, per-breakpoint column counts, nesting bounded at three levels of recursion; from Phase 2B each container is a styled box with its own flex controls |
| **Responsive** | desktop / tablet / mobile, at the site's own 1024px and 768px breakpoints; inheritance is the absence of a value |
| **Global design** | 10 colour roles, 8 typography roles, referenced as `@role` and emitted as `var(--pbg-role, constant)` |
| **Reusable sections** | device-local library, export / import, inserted as an independent copy |
| **Templates** | 6, a code registry rather than a table |
| **Assets** | a committed manifest of what is really on disk, with real dimensions read from file headers |
| **Preview** | the real page in an iframe at 1280 / 900 / 390 |
| **Reordering** | pointer drag with handles, and arrow buttons that work from the keyboard and on touch |
| **Drafts** | device-local, auto-saved, with one recovery snapshot per page |
| **Publishing** | an explicit action; nothing else writes to the live row |
| **SEO** | unchanged and authoritative; the builder is visible content, not metadata |

### Defects this pass found

**An allow-list read with a bare index is not a membership test.** Four
lookups on the *public render path* were keyed by a stored type and read with
`map[name]`, so a section or element whose type was `constructor`, `toString`
or `valueOf` got back a function:

- `PB_ELEMENTS[el.type]` — the function was then called and its result passed
  to `appendChild()`, which threw. **One bad element removed every section on
  the page**, not just itself.
- `PB_EL_STYLE_KEYS[el.type]` — a function where an array was expected, and
  `allow.indexOf()` threw before a single section had been drawn.
- `PB_SECTION_CLASS[sec.type]` — `function Object() { [native code] }` was
  concatenated into the section's class attribute.
- `PB_SELF[style.align]` — `--pbe-self:undefined` was emitted into the CSS.

All four now go through `pbPick()`, the guarded lookup the rest of the file
already used. The renderer's own promise — *unknown types are skipped, never
thrown on* — is true now.

This matters because `publishedSections()` deliberately does **not** run the
whole-tree sanitiser: what was published is what renders, and the renderer's
per-value guards are the boundary. That design is unchanged; it just has no
holes in it now.

**`__proto__` is a key, not an instruction.** `JSON.parse` makes it an
ordinary own property, so the `hasOwnProperty` guard in `merge()` passed it —
and assigning it is a call to the prototype setter, not a write. A stored
`{"__proto__":{"pwned":1}}` made `CMS.get('pwned')` return 1, and a page key
on an injected prototype would have fed the SEO engine values that were never
in the object. `Object.prototype` was never reached, so the damage was
confined — but the object being built is the whole CMS state. `merge()` now
refuses `__proto__`, `constructor` and `prototype`, which covers both the
localStorage path and the Supabase row, since both arrive through it.

**The share-card preview could be made to fetch anything.** The OG image was
interpolated into a `style=""` attribute, and escaping for HTML does not
protect a CSS context: the attribute is parsed as HTML first, so `&#39;`
becomes a quote again before the CSS parser sees it. An image value of
`x'); background-image:url('http://elsewhere/` closed the declaration, opened
its own, and the admin fetched it. The URL now goes through the renderer's own
`pbCssUrl()` and is applied through the CSSOM, where a value can only ever set
the property it is assigned to.

**The preview disagreed with the tag.** It resolved the share image with
`absUrl()` while `paintSeo()` emits it through `crawlableImage()`, so the card
could show a `data:` or `blob:` image the page would never publish. It uses
the same function as the tag now.

### The limits, confirmed

| | |
| --- | --- |
| Sections per page | 200 |
| Elements per list | 200 |
| Columns per element | 12 |
| Nesting | 3 levels |
| Library items per import | 500 |

Past those, the extra is dropped rather than stored. Malformed JSON, a file
that is not a library, `null`, and junk rows inside a valid wrapper each fail
with a message rather than a stack trace.

### What a corrupted store does

Truncated JSON, a bare string, `null`, an array at the top level, `pages` as a
string, `sections` as an object, `content` as a string, `columns` as a number,
`style` as an array — every one of them leaves the page showing the content
its HTML file ships, with no console error. Where a payload is partly valid,
the valid part still renders.

### Performance, measured

On 30 sections / 90 columns / 240 elements:

- full repaint of the public page: **~2ms**
- sanitising the whole tree: **~2ms**
- generated CSS: ~29KB
- 25 consecutive repaints: **no style tags added**, the same nodes left behind
- one Supabase `GET`, no writes, and no host contacted beyond the fonts and
  icons the site already ships

The admin figures from milestone D are unchanged: 300 pointer moves during a
drag in ~12ms, with zero nodes added to or removed from the list.

### Known limitations

These are deliberate, not gaps:

- **No undo/redo.** The draft auto-saves; the two actions that used to lose
  work take a recovery snapshot instead.
- **No touch drag.** The list is what a finger scrolls. Touch reorders with
  the arrow buttons, which every row has.
- **No uploads.** The asset manifest is generated from what is committed;
  adding an image means committing it and regenerating the manifest.
- **The builder cannot create a URL.** Every page is a file in the repository.
- **Columns reorder within their owner**, and element drags stay inside the
  open section.
- **One recovery snapshot per page**, not a history.
- **Structured data is limited to the blocks a page's HTML ships a tag for.**
- **No WCAG conformance claim is made.** What was verified is specific and
  listed: accessible names on every control, labelled inputs, correct
  `aria-expanded` and `aria-current`, a visible keyboard focus ring, working
  keyboard reordering, disabled controls that say why, decorative icons hidden
  from screen readers, and alt text preserved — including an empty `alt` for a
  decorative image rather than none at all.
- **The public renderer trusts what was published**, by design: the sanitiser
  runs on import, on templates and on recovery, and the renderer defends
  value by value. Writing the published row requires an authenticated admin.
---

## Builder-managed informational pages

`about`, `contact`, `responsible-gaming` and `privacy-policy` have their
**body** owned by the builder. `index.html` does not and must not: the
homepage is hand-designed, carries no `data-cms-sections` mount, and is
not in `PB_MOUNTED`. `login.html`, `register.html` and `404.html` are
likewise outside this.

### What the builder owns, and what it does not

```
<header class="site-header">   generated by tools/build-shell.js
<nav class="main-nav">          generated by tools/build-shell.js
<main class="info-main">
    <nav class="breadcrumb">    static
    <h1 data-cms-text="pages.X.heading">        static, edited in Pages
    <p class="info-lead" data-cms-text="…">     static, edited in Pages
    <div class="info-body" data-cms-html="…">   the SHIPPED COPY
    <div data-cms-sections="X">                 THE BUILDER OWNS THIS
<footer class="site-footer">   generated by tools/build-shell.js
```

The page's single `<h1>` stays **static and above the mount**. That is
what keeps the template contract in this file true — no template opens
with an h1, because every mounted page already has one — and it is why a
page with an empty canvas still has a heading, a title and a canonical.

### Three states, and the rule that separates them

`bodyIsBuilderManaged(slug)` is true as soon as a **published** builder
block exists, *including one holding no sections*.

| State | Shipped copy | Sections |
|---|---|---|
| No builder block, or only a draft | shows | none render |
| Published with sections | **hidden** | render |
| Published with an empty list | **hidden** | none — an empty canvas |

The third row is the point. Publishing an empty list used to be
indistinguishable from having no builder at all, so clearing a page in
/admin silently restored the copy it shipped with and an empty canvas was
impossible. A published block now means the builder owns the body,
whether or not it holds anything.

**Unpublishing brings the shipped copy straight back.** The copy is
`hidden`, never removed, and `pages.<slug>.body` is never written to, so
nothing is destroyed by any of this.

### Moving the shipped copy into the builder

Admin → Page Builder offers **Move page copy into the builder** on a page
that has copy and no builder block at all. It reads
`pages.<slug>.body` as a DOM and maps what the element model can hold:

* `<h1>`…`<h6>` → a heading element at that level (`h1` comes down to
  `h2`, because the page already has its own `h1` above the mount)
* anything else with text → a text element

**Inline markup does not survive.** The migration's output is
`textContent` only — a link inside a paragraph becomes plain words. The
offer says so before it runs. It writes a **draft**; nothing on the live
page changes until Publish.

> Phase 2A added an opt-in inline reader to the text element (**bold**,
> *italic* and `[label](page.html)`, built as nodes, never parsed as HTML —
> see *Content authoring*). The migration does **not** use it: translating
> arbitrary HTML into marks is guesswork, and guessing wrong changes what a
> published page says. An author who wants formatting turns it on and types
> the marks.

The offer withdraws itself once any builder block exists, so it can never
overwrite work, and it never appears on a page deliberately cleared to an
empty canvas.

### The shipped-body field is still raw HTML

`data-cms-html` writes with `innerHTML` by design — it is rich text
authored by a signed-in admin — and this work did not change that.
Hiding the node does **not** neutralise it: `hidden` controls display, not
parsing. What this work does guarantee is that the *migration* can never
turn that HTML into unsafe builder content, because the elements it
produces render through `textContent`. `tests/test_migration.js` asserts
both halves.

---

## Safety

- **No arbitrary HTML.** Every element is built with `document.createElement`
  and `textContent`. `innerHTML` is never used for stored content, so markup in
  a text field is shown literally rather than executed. Phase 2A's inline
  formatting does not change this: it is a *reader*, not a parser. The stored
  value stays a plain string, and the renderer builds `<strong>`, `<em>` and
  `<a>` **nodes** from the marks it recognises — there is still no path from
  stored data to parsed markup. A link address goes through `pbUrl()` like
  every other one, so a refused scheme leaves the words rather than a link.
- **URL allow-list.** `pbUrl()` accepts `http:`, `https:`, `mailto:`, `tel:`,
  anything starting `#` or `/`, and plain relative file names. Everything else —
  `javascript:`, `data:` — becomes empty: a link falls back to `href="#"` and an
  image is dropped. The admin is warned at the field while typing.
- **Depth guard.** Nested rendering stops after three levels.
- **Unknown types are skipped**, never thrown on, so an older site can render a
  newer draft without breaking. Every allow-list keyed by stored data is read
  through `pbPick()`, which is a membership test — `map[name]` is not one, and
  milestone F found four places on the render path where that mattered.
- **A JSON key cannot become a prototype.** `merge()` refuses `__proto__`,
  `constructor` and `prototype`, so neither the Supabase row nor localStorage
  can put names into the state that were never in the object.
- **Style values cannot inject CSS.** Border and Shadow are free text and end
  up inside a generated `<style>` block, so a value such as
  `1px solid red; } body { display:none } .x {` would otherwise close the rule
  and inject CSS into every page the section is published on. Any value
  carrying `; { } < > \\ " '`, a control character, `url(`, `expression(`,
  `@import` or `javascript:` is dropped. A background image URL is checked
  again for quotes, parentheses and whitespace before it is wrapped in
  `url("...")`.
- **Ids are checked before they reach a selector.** A section or element id is
  interpolated into `[data-sec="..."]`, so only `[A-Za-z0-9_-]{1,64}` emits
  CSS. Generated ids always pass; a hand-edited or imported config that does
  not simply gets no CSS, and still renders.
- **Drafts stay on the device.** `Remote.publish()` strips `builderDrafts`,
  `builderLibrary` and `builderRecovery` from the payload, so unpublished copy,
  the reusable-section workbench and recovery snapshots are never uploaded to
  the public row that every visitor downloads with the anon key. A pull keeps
  all three rather than letting the row overwrite them.
- **Anon key only.** Nothing here touches authentication, RLS or service-role
  credentials.

---

## Draft, preview, publish

`CMS.sections`:

| Call | Effect |
| --- | --- |
| `pages()` | slugs the builder can edit |
| `draft(slug)` | the working copy, falling back to a copy of what is live |
| `live(slug)` | the published sections, or `[]` |
| `saveDraft(slug, sections)` | writes `builderDrafts[slug]` **only** |
| `publish(slug)` | copies the draft onto `pages[slug].builder` as published |
| `unpublish(slug)` | flips it back to `draft`; the work is kept |
| `discard(slug)` | drops the working copy, starting again from live |
| `dirty(slug)` / `status(slug)` | what the Draft / Live badges read |
| `paint(override)` | render; `{slug, sections}` previews a draft |
| `published(slug)` | the public gate |
| `safeUrl(u)` | the URL allow-list |

In the admin, every draft write goes through `commit(true)` — the existing
silent save path, which writes locally and skips `CMS.remote.publish()`. Only
**Publish** and **Unpublish** call `commit()` normally and reach the server.

`builderDrafts` is this device's working copy and is deliberately kept out of
the round trip in both directions:

- `Remote.publish()` strips it from the payload.
- `Remote.pull()` keeps the local copy rather than taking the row's.

The second one matters more than it looks. Every page in the browser pulls the
published row on load and writes the result back to `localStorage`. Without
this, opening the site in a second tab — or the preview iframe navigating to
another page — rewound the admin's unpublished work to the last published
snapshot. `tests/test_pagebuilder.js` covers exactly that sequence.

The save/publish behaviour of Colors, Branding, Sports Table, SEO and every
other panel is unchanged.

Typing repaints the preview at once and saves the draft 250 ms later, so a
draft is not lost by leaving the panel without blurring a field. The draft is
also flushed on page switch, on the toolbar buttons and on `beforeunload`.

### The preview

The preview is the real page in an iframe, painted through
`CMS.sections.paint({slug, sections})`. That override renders sections the
public gate would refuse, so the admin sees the draft while visitors do not.
It is remembered for that window, because the admin's own save fires a
`storage` event whose listener repaints from what is published — without this
the preview reverted a moment after every keystroke. A public page never sets
an override.

Device widths are real: the iframe is given 1280 / 900 / 390 px and scaled down
to fit the column, so a section is genuinely laid out at 390px.

---

## Adding a page to the builder

1. A page needs a mount point:
   ```html
   <link rel="stylesheet" href="css/sections.css" />
   ...
   <div data-cms-sections="about"></div>
   ```
   The mount stays empty until something is published for that slug, so adding
   it changes nothing on its own.
2. `about`, `contact` and `responsible-gaming` ship with one. `index`, `login`,
   `register` and `404` deliberately do not.
3. A page created in the admin gets the mount in its generated stub and records
   `builderMount: true`, which is what puts it in the builder's page list. You
   still download that file and commit it yourself.

To add a mount to a hand-written page, add both lines above and, for a page
that is not in `PB_MOUNTED` in `js/cms.js`, set `builderMount: true` on its
`pages` entry.

---

## SEO

- Published sections are **in the HTML the server sends**: the build renders them
  with this file's own renderer and JavaScript redraws them once. With JavaScript
  disabled a visitor reads the published content, not a placeholder. A page with
  nothing published still ships its own copy in its HTML file, which is why
  unpublishing is non-destructive rather than a delete — the build clears the
  baked markup, JavaScript clears it at runtime, and the file's copy comes back.
  The sections the build reads come from the committed `brands/<id>/brand.js`, so
  a publish reaches the static HTML on the next deploy; see *Where the published
  content lives on a real page* above.
- The static-first rule is untouched: an empty CMS value never blanks a static
  meta tag.
- Headings keep their level, so a section can carry a real `h2`/`h3` outline.
  The page's own H1 is `pages.<slug>.heading`, above the mount — see
  *Headings, SEO and the admin* above for what happens when a section adds
  another one.
- An image with a source but no alt text is flagged in the editor.

---

## Content authoring (Phase 2A)

A page that needed a list of eligibility rules, a table of limits, a quoted
sentence or a contents list had one of two options before this: bullet
characters typed into a paragraph, or the shipped-body field, which is raw
`innerHTML` *and* client-side only. The first is not markup a crawler can
read as a list; the second is the one thing this project has spent its whole
life not being, and its content never reaches the HTML the server sends.

Everything below is built the way every other element here is built —
`createElement` and `textContent`, every stored value through the same
`pbScalar`/`pbUrl`/`pbEnumOk` cleaning — and everything below **bakes**, so
it is in the static response before any JavaScript runs.

### What already existed, and was not rebuilt

The audit that opened this phase classified each requested capability before
anything was written, and two of the seven needed no new feature:

| Capability | Found as |
| --- | --- |
| FAQ element | `PB_ELEMENTS.faq` since V2 — accordion, `aria-expanded`/`aria-controls`/`role="region"`, items with no question dropped, its own CSS, covered by three suites. Only its **schema** was missing. |
| SEO / content validation | `validatePage()` + `contentChecks()` + the SEO dashboard. Title and description length and absence, duplicates across pages, base URL and canonical shape, noindex, H1 count, empty body, word count, skipped heading levels, missing image alt, internal links to unknown pages, `data:`/`blob:` share images. Three levels, no numeric score, nothing that blocks a publish. **Extended** for the new elements; nothing replaced. |

`CMS.sections.outline()` also already existed and already read a section
tree's headings the way the renderer resolves them. The contents list calls
it rather than reading headings a second way.

### list

```json
{ "type": "list", "content": { "ordered": true, "rich": false,
                               "items": [{ "text": "First" }, { "text": "Second" }] } }
```

A real `<ul>` or `<ol>` with `<li>` rows. A row with no text is skipped; a
list that kept no row renders nothing.

### table

```json
{ "type": "table", "content": { "caption": "Deposit limits", "cols": "3", "header": true,
                                "items": [{ "c1": "Method", "c2": "Min", "c3": "Max" },
                                          { "c1": "Card",   "c2": "100", "c3": "50000" }] } }
```

A `<table>` with an optional `<caption>`, a `<thead>` of `<th scope="col">`
taken from the first row, and `<td>` rows under it. `scope="col"` is what
makes the header functional rather than decorative: a screen reader
announces the column name with each cell, and a crawler can tell a table of
data from a grid used for layout.

- **A row is `c1`…`c8`, not an array.** `pbScalar()` refuses anything that is
  not a boolean, a number or a string, and that refusal is what stops a
  nested payload riding in on a content key. Eight named cells need no second
  kind of cleaning. Rows are capped at 100 by the existing items loop.
- **`cols`, not `columns`.** That name already means a layout, on the
  `columns` element and in `PB_EL_TOKENS`. One name for two things is how a
  value ends up read by the wrong reader.
- Absent `cols` means *as wide as the widest row*, so a table pasted in from
  elsewhere is not silently clipped. The editor shows exactly as many cell
  boxes as the table draws.
- A header row with nothing under it renders **nothing** rather than an empty
  table.
- The `<table>` sits inside a wrapper that carries `.pb-el` and scrolls. A
  table wider than a phone has to scroll inside its own box; one that widens
  the *page* breaks every other section on it, and on a phone there is no way
  back from that.

### Inline formatting — a reader, not a parser

Opt-in per element, through `content.rich`, on the **text** element and on
**list** rows. Three marks, and only these:

| Typed | Rendered |
| --- | --- |
| `**strong**` | `<strong>` whose `textContent` is the words between the marks |
| `*em*` | `<em>`, likewise |
| `[label](address)` | `<a>` whose `href` went through `pbUrl()` |

The stored value stays an ordinary string: still through `pbScalar()`, still
capped at 4000 characters, still refused outright for a control character.
The renderer reads marks out of that string and builds **nodes**. There is no
path from a stored string to parsed markup, so typed tags stay visible as
text.

A bad link address fails in one of two ways, both safe. An address the mark
pattern accepts goes to `pbUrl()`, which refuses it, and the **label** is
kept — words, never an anchor. An address holding brackets (`javascript:alert(1)`)
never looks like a link mark at all, so the whole thing stays the plain text
it already was.

**Why opt-in.** The test is `=== true`, so a truthy string from an import
cannot switch it on. Left off — which is what every element already published
looks like — a text element renders through the same single `textContent`
assignment as before, so a paragraph that happens to contain an asterisk is
untouched on every live page. Nesting is not supported and is not a gap: one
level is what body copy needs, and a parser that nests is a parser with
corner cases.

The text element also takes `tag`: `blockquote` instead of `p`. A quotation
should *be* a quotation, not a paragraph styled to look like one — the tag is
the part a crawler and a screen reader read. `tag` joins `PB_ENUM_KEYS`, so a
value outside `{ p, blockquote }` is dropped when cleaned and falls back to
`<p>` when rendered.

### toc — a table of contents

```json
{ "type": "toc", "content": { "title": "On this page", "titleLevel": "h2",
                              "depth": "h3", "ordered": false } }
```

A `<nav>` of links to the headings this page's sections draw, read from
`CMS.sections.outline()` — the same heading reader the admin uses for its H1
warning, so the list can never disagree with the page it describes.

- **The H1 is never listed.** A page's H1 is its title, written above the
  sections from `pages.<slug>.heading`, so an entry for one would point at a
  second H1 that should not be there anyway.
- **Below two entries it draws nothing.** A contents list of one link is
  noise rather than navigation. The admin card says how many headings are in
  range, so an element that is drawing nothing does not look broken.
- Heading elements therefore carry an **id**. There is one rule for what that
  id is, `pbAnchorId()`, read twice: by the heading that gets it and by the
  list that points at it. Deliberately *not* `pbDomId()`, which invents an id
  when the element's own is unusable — an invented id is no use to a list
  that has to work out the same id from the section tree without having
  rendered anything. When the element id could not go in a selector the
  heading gets no id and the list skips it, so the two cannot disagree.
- The contents list is the only element that needs to see past itself.
  Rather than widen every renderer's signature, the top-level render call
  leaves the section tree in one place for the length of its own synchronous
  run and clears it in a `finally`.

### FAQPage schema

The FAQ element existed; structured data for it did not. One `FAQPage` block
is emitted **with the sections**, not into the `<head>`:

```html
<script type="application/ld+json" data-pb-faq="1">
{ "@type": "FAQPage", "mainEntity": [ { "@type": "Question", "name": "…",
    "acceptedAnswer": { "@type": "Answer", "text": "…" } } ], "@context": "https://schema.org" }
</script>
```

**Why not the head.** The head's four blocks (`ldOrganization`, `ldWebSite`,
`ldPage`, `ldBreadcrumb`) are computed from a page *record* and written into
script elements the template ships. An FAQ is not in the record — it is in
the section tree, which is the thing that gets baked. Emitting the block
beside the sections it describes means:

- it is in the **static response** for every page with an FAQ, committed
  template or CMS-generated alike, so the schema does not depend on
  JavaScript — which is the rule for anything a crawler reads;
- no template changes and no head slot is added, so no page gains an empty
  `{}` block it did not earn;
- **it cannot duplicate.** The mount is rewritten whole on every render, so
  three FAQ elements on a page produce one `FAQPage`, never three.

It uses `ldContext()` and `ldText()`, which are what the head blocks use.
There is no second JSON-LD framework.

**What it refuses**, each of which would otherwise be invalid or dishonest
structured data: a question with no answer, an answer with no question, a
blank pair, a disabled section or element, and a page with no FAQ. Each
yields **no block**, not an empty `FAQPage`. A `Question` whose
`acceptedAnswer` is empty is invalid, and inventing text to fill it would be
worse than saying nothing.

Google's requirement is that the question and the answer are on the page.
They are: the FAQ element renders its answers into the HTML and hides the
closed ones with `hidden`, which is display, not absence.

`ldText()` escapes `<` as `<`. That is what makes the text safe to write
into a `<script>` in *serialised* HTML — script contents are raw text, so a
value holding `</script>` would otherwise close the block early. At runtime
`textContent` never parses, so it costs nothing there. For the same reason
`tools/lib/minidom.js` now treats `script` and `style` as raw-text elements,
as HTML says: escaping their contents like ordinary text is *wrong* rather
than merely different, because a JSON-LD block whose quotes came out as
`&quot;` is not JSON and no crawler would parse it.

### The internal link picker

Every `href` in the builder was a bare text box, so an internal link was a
file name typed from memory. A typo is a 404 a visitor finds and an internal
link a crawler loses — and the admin's own checks only reported it
afterwards. Image, button, card button, icon, notice and feature-box links
now carry a picker beside the box. `socialLinks` deliberately does not: a
social profile is somewhere else by definition.

**Isolation here is the absence of a feature, not one.** The list is read
from `CMS.data().pages` — the merged record of whichever brand resolved, and
the only pages object `js/admin-builder.js` can see. There is no second page
store, no request of its own, and no brand name, host or reach for the brand
resolver anywhere in the file; `tests/test_brand_isolation.js` asserts all of
that. One site's admin cannot be shown another site's page because the data
is not there to show.

**A draft page is not offered.** The build generates no file for one, so a
link to it is a link to a 404 until it is published. That answer comes from
`SEOFiles.isPublished()`, the same reader the sitemap uses.

The text box stays authoritative: the picker writes into it, announces the
change through the box's own listeners and resets to blank, so there is one
value and it is the typed one. An external address, an anchor or a `mailto:`
is still typed, and still checked by `pbUrl()`.

### What the checks say about all of it

Added to `contentChecks()`, in the same place and the same words as the rest:

| Element | Says |
| --- | --- |
| table | **warns** with no header row, and with no caption |
| list | **warns** at one item — a list of one reads as a paragraph with a bullet in front of it |
| toc | **fails** on a link pointing at a heading that is not on the page. The only one here that is a fault rather than a judgement |
| faq | **warns** per question with no answer, and says what it costs: those are left out of the page's `FAQPage` data. Counted through `CMS.sections.faqPairs()`, the reader the schema itself uses |
| links | a link to a page that **exists but is a draft** now fails. Nothing about the page looks wrong, which makes it worse than a typo |

`pageContent()` carries the published section tree beside the markup for the
one question the markup cannot answer: an unanswered FAQ question renders —
its panel is simply empty — but is absent from the schema, so the only way to
tell an author why is to compare the tree with what the schema reader
accepted.

### Known limitations

- **Inline formatting is three marks, not a toolbar.** There is no WYSIWYG
  surface; an author types the marks and sees the result in the preview. A
  toolbar would be a reasonable next step and would need no change to the
  stored format.
- **`rich` is per element, not per page or per site.** Turning it on for
  twenty paragraphs is twenty checkboxes.
- **Tables cap at eight columns** and have no row-header option
  (`<th scope="row">`), no column spanning and no sorting. Each would be a
  new content key and a new rendering branch.
- **The contents list is rebuilt on every render.** There is no stored
  outline, which is the point — but it also means an author cannot reorder or
  rename entries independently of the headings.
- **Heading ids are derived from element ids** (`pb-<elid>-h`), so they are
  stable but not readable. A slug derived from the heading text would read
  better in a URL and would need a collision rule; it is not built.
- **`FAQPage` is the only schema the builder's content earns.** `HowTo`,
  `Article` and `BreadcrumbList`-from-sections are not generated, and no
  rating, review, offer or product schema is invented from anything —
  asserted in two suites.
- **The shipped-body field is still raw `innerHTML`** and still client-side
  only. Phase 2A did not change it; see *The shipped-body field is still raw
  HTML* above. The new elements are the safe, bakeable way to author the same
  content.

---

## Advanced layout and widgets (Phase 2B)

The builder could put text, images, buttons, cards, a FAQ, a list, a table
and a contents list on a page, in sections and in columns. What it could not
do was make a *box* — somewhere with its own background, padding and
direction that other elements live inside — and it had none of the widgets a
modern page is built from.

### What the audit found already built

Ten of the twenty-five things the phase set out to check needed nothing but
verification, and two more were reuse decisions rather than builds. Recorded
here so a later phase does not go looking to build them again:

| Already there | Where |
| --- | --- |
| Nesting | `columns` elements hold `content.columns[].elements`; the renderer recurses. Four levels deep renders. |
| Column presets | 13 track presets, with per-breakpoint column counts (`--pbe-cols-t`/`-m`). |
| Responsive spacing, typography, width, alignment | Real `@media (max-width:1024px)` and `(max-width:768px)` rules, per element, per section. Not JavaScript. |
| Saved sections | `CMS.sections.library` — save, list, rename, duplicate, remove, insert, export, import. |
| Section and element duplication | `pbDuplicate`, with fresh ids so a copy cannot address the original's CSS. |
| Templates / page starters | A code registry of 6 (now 8), with versions and counts. |
| Drag, reorder, keyboard, touch | `data-pb-drag`, arrow buttons, 195 assertions in `test_pagebuilder_dnd.js`. |
| Responsive preview | The real page in an iframe at three widths. |
| **Accordion** | The **`faq` element is one** — `single` gives one-open-at-a-time, with `aria-expanded`, `aria-controls` and `role="region"`. A second accordion would have been this one renamed, so there is none. |
| **Breadcrumb** | A page-level feature: `pages.<slug>.breadcrumb = {label, show}`, visible markup in the templates, and `buildBreadcrumb()` → `ldBreadcrumb` already matched to it. A builder *element* would put a second breadcrumb and a competing `BreadcrumbList` on the page, so there is none. |

### A container is a box

`content.columns[i]` was `{elements: []}`. It had no style, and the
`<div class="pb-column">` it rendered carried no attribute, so no generated
rule could reach it. It now carries `style` and `responsive` like any other
node and is addressed by its **position**:

```html
<div class="pb-column" data-col="<columns element id>-<index>">
```
```css
.pb-columns .pb-column[data-col="…"] { … }
```

**Position, not an id of its own.** Position is already how the admin
addresses a container (`{sec, el, col}`), so moving one moves its style with
it — both travel in the same object — and a duplicated columns element gets a
fresh element id and therefore fresh container rules for free. `pbReidSections`
needed no change. One function, `pbContainerRef()`, decides what that address
is called, and both the renderer and the CSS writer ask it, so the attribute
and the selector cannot disagree.

A container is cleaned by `pbCleanStyle`/`pbCleanResponsive` and written by
`pbScopedCSS` — the same functions a section and an element use — so
per-breakpoint overrides came for free rather than being built again.

### Layout controls

`.pb-column` was always `display: flex; flex-direction: column`. It had no
controls. Five tokens were added to the existing registry:

| Control | Token | Values |
| --- | --- | --- |
| direction | `--pbe-direction` | `column`, `row`, `column-reverse`, `row-reverse` |
| justify | `--pbe-justify-content` | `start`, `center`, `end`, `between`, `around`, `evenly` |
| alignItems | `--pbe-align-items` | `stretch`, `start`, `center`, `end`, `baseline` |
| wrap | `--pbe-wrap` | `nowrap`, `wrap` |
| minWidth | `--pbe-min-width` | a number |

Each value is a **name**, and what reaches the property is the constant
stored against it — the rule `PB_COL_LAYOUTS` already followed. An
unrecognised name emits nothing. The names are the author's words, translated
to CSS in the renderer rather than in the admin, and the admin builds its
selects from `CMS.sections.layoutNames` so the two cannot drift.
`pbCleanStyle` validates them at import as well: the renderer already refused
an unknown one, but storing `direction: "constructor"` is pointless as well
as inert.

`justify` writes `--pbe-justify-CONTENT`. `--pbe-justify` is already the
`justify-self` half of `PB_SELF`, and one property name for two meanings is
how a value ends up read by the wrong rule.

**Nothing that already exists changes.** Every declaration in the
`.pb-column` rule reads a token whose fallback is the value the rule already
had — listed line by line in the CSS. `min-width` falls back to `auto`, not
`0`: a grid item's default is `auto`, and flipping it would let a wide child
shrink its track on pages nobody has touched. `align-self` and `justify-self`
are deliberately **not** read, because `PB_SELF` writes those whenever
`align` is set — including on the columns element — and a container reading
them would start moving itself inside its track on existing pages.

### Hiding on one screen size

Sections could do this; elements and containers could not, so an author could
hide a whole band on a phone but not the one button inside it that did not
fit. All three now carry the same three booleans, through the same cleaner,
rendered by the same classes, hidden by the same media queries. The selectors
became a plain class each, so there is one idea of what hidden means instead
of three.

`display: none`, not `visibility` or `opacity`: a hidden element must take no
space and must not be reachable by keyboard while invisible. **The content
stays in the HTML at every width** — this hides a thing at one screen size,
it does not remove it from the page a crawler reads.

### The widgets

Five of them need no JavaScript at all, and that is not a coincidence: a
testimonial, a number, a price and a caption are the words a page is *for*.
Interaction can be added on top of content; content cannot be added on top of
interaction.

| Element | Markup | Notes |
| --- | --- | --- |
| `testimonials` | `<figure>` + `<blockquote>` + `<figcaption>` | **No review or rating schema**, and none should be: a testimonial an author typed is not a verified review. |
| `stats` | text | **No count-up animation.** The simplest guarantee that the number a crawler reads is the number an author typed is for nothing to compute it. The label is a heading only if asked for. |
| `plans` | heading + price + `<ul>` + link | The recommended card carries `data-highlight` in the markup as well as a heavier border, so which one it is does not depend on seeing a colour. Features are `f1`…`f6`: `pbScalar()` refuses a control character, so a newline-delimited list cannot be stored at all. |
| `gallery` | `<figure>` + `<figcaption>` per image | Each image goes through the **one** image renderer, so lazy loading, async decoding and alt text are not written twice. No lightbox — one would be a click handler, a focus trap and an escape key for a feature nobody asked to be modal. |
| `progress` | the native `<progress>` | The usual way to draw one is a div whose width comes from the value, which means an inline style built from stored content. The native element needs none, is announced correctly with no ARIA to get wrong, and degrades to its own text. The value is printed as words too, so what it says never depends on a coloured bar. |

Three are interactive, and each is built so the content is in the HTML first:

- **`tabs`** — every panel is in the response body; the inactive ones carry
  `hidden`, which is display and not absence, exactly as the FAQ element has
  always done. A tablist of real `<button>`s, each owning its panel through
  `aria-controls`, each panel pointing back with `aria-labelledby`, **one** tab
  in the tab order at a time, and `Left`/`Right`/`Home`/`End` moving between
  them with focus following selection. Panels are focusable, or a keyboard
  user who tabs past the list cannot reach the content.

- **`carousel`** — **it works with no JavaScript at all.** The slides are a
  row that scrolls with CSS scroll-snapping, so a visitor can swipe or scroll
  and a keyboard user can reach the strip before a line of script runs.
  Prev/next and autoplay are enhancements on top. Autoplay never starts for a
  visitor who asked for less motion, stops on hover and on focus, and always
  has a pause control that reports its own state. The glyphs are drawn in CSS,
  so a control does not wait for an icon font.

- **`video`** — an `<iframe>` runs a third party's code in the page, so the
  address is **never** the author's string. `pbVideoRef()` matches it against
  the hosts this builder embeds (YouTube, Vimeo) and returns an **id**; the
  `src` is *built* from that id and a constant. An address no host recognises
  becomes a **link**; an unsafe one becomes nothing. An address that merely
  *contains* a `youtube.com/watch?v=` is not one. The nocookie and `dnt=1`
  forms are used where the host offers them: an embed should not set a
  tracking cookie on someone who only read a page. The frame is named,
  sandboxed, lazy, and has a tightened referrer policy.

### CTA was already there, and was broken

`featureBox` already did icon or image, a heading, body copy and an action.
The only thing it could not do was offer a second, quieter action — so that
is what it gained, rather than a CTA element that would have been this one
under a new name.

While adding it, a defect present since V2 came out:

```js
var lvl = pbPick(PB_HEADING_LEVELS, String(c.titleLevel || 'h3').toLowerCase())
    ? String(c.titleLevel).toLowerCase() : 'h3';
```

The default was tested and then thrown away — the guard checked
`titleLevel || 'h3'` and the branch read `titleLevel` alone. A feature box
with no explicit level, which is **every one the admin adds** since its blank
content sets none, resolved to the string `"undefined"` and rendered
`<undefined class="pb-feature-title">`. The title was visible and was not a
heading: nothing in the page outline, nothing announced as a heading, nothing
for a crawler. Fixed; one value, worked out once.

### Known limitations

- **A tab panel holds text, not elements.** Rich inline formatting works
  inside it, but a panel cannot contain an image or a nested layout. Doing
  that would mean a second nesting shape to clean, render, re-id and
  drag-address; the columns element is the one that nests.
- **Nesting is bounded at three levels of recursion**, and content past the
  bound is dropped silently by both the sanitiser and the renderer. They agree
  with each other, so nothing renders that was not stored — but an author gets
  no warning. The bound is deliberate; the silence is not ideal.
- **A container is not an element.** It cannot be dragged out of its columns
  element, and the palette offers "Columns", not "Container" — a container is
  one column of one.
- **Global, synchronised reusable sections are deferred by decision.** Saved
  sections remain local reusable copies: the library is in `LOCAL_ONLY_KEYS`,
  device-local and stripped from the published payload. Making a block truly
  shared would put it in the published record, and that was explicitly held
  back from this phase.
- **The carousel has no dots or slide counter**, and does not announce slide
  changes to a screen reader beyond the scroll position.
- **`video` embeds two hosts.** A third needs an entry in `PB_VIDEO_HOSTS`,
  which is one object with a pattern and a builder — not a code change
  anywhere else.
- **No lightbox, no count-up animation, no Theme Builder, no dynamic
  templates.** Each was considered and left out; the first three are in the
  table above with the reasoning.

---

## Content types and the page list (Phase 2C)

Phase 2C-A put five optional fields on every page record and nothing read them.
Phase 2C is what reads them.

### What the audit found already built

| Capability | Found as | What Phase 2C did |
|---|---|---|
| A `type` field on every page | present and inert since 2C-A | gave it an allow-list and readers |
| `publishedAt`, `excerpt`, `author`, `related` | present and inert since 2C-A | same |
| `authors: {}` | present and inert since 2C-A | a resolver and a small editor |
| `FAQPage` from an accordion | the `faq` **element**, since Phase 2A | reused — there is deliberately no `faq` content type |
| `BreadcrumbList` | page-level, since Phase 1 | untouched |
| `WebPage` / `ContactPage` | `buildWebPage()`, since Phase 1 | extended with one subtype, not replaced |
| Internal link picker | `pbPageLinkField`, Phase 2A | reused by the related-page chooser |
| Flat `<slug>.html` URLs | `PAGE_NAME_RE`, Phase 1 | unchanged — no nested URLs |
| The sitemap's published/draft rules | `sitemapAudit`, Phase 1 | unchanged, and now held to a shared table |

### The five types

`PB_CONTENT_TYPES` in `js/cms.js` is the allow-list. A stored value is a NAME;
what reaches `og:type` and `@type` is the constant stored against it.

| Type | `og:type` | Page-level schema | Publishes a date and author |
|---|---|---|---|
| `page` (and `''`) | `website` | `WebPage` | no |
| `article` | `article` | `WebPage` + `Article` | yes |
| `guide` | `article` | `WebPage` + `Article` | yes |
| `help` | `article` | `WebPage` + `Article` | yes |
| `hub` | `website` | `CollectionPage` (+ `ItemList` in the body) | no |

`''` and `page` are the same thing, which is what makes activating the field
change nothing: every record written before types existed is an ordinary page.

Case and surrounding space are forgiven — `Article` and `" guide "` are the type
they obviously mean, and this value can be hand-edited in a row. A value that is
not a **string** is refused outright, because `String(['article'])` is
`'article'` and an array would otherwise have named a type.

**There is no `faq` type.** The `faq` element already publishes `FAQPage` from
its own content. A type that also published one would put two on a page.

### Dates

`publishedAt` is `YYYY-MM-DD`, and the calendar is checked as well as the shape:
a regex alone accepts `2026-13-45` and `2026-02-30`, and a malformed date in
JSON-LD is worse than an absent one. Anything that is not a real day resolves to
`''`, and every reader treats that as "say nothing".

A date is only published by a type whose `dated` flag is set, so a date left on
a page whose type changed back to `page` stops being published rather than
lingering. `updatedAt` already existed and already moves on every edit; it
becomes `dateModified` on the types that publish dates, and it still drives the
sitemap's `lastmod` exactly as before.

Nothing invents a date. No existing page gained one.

### Authors

`pages.<slug>.author` stores an **id**; `authors` holds the records. The
resolver returns null for every way that can fail — no id, no collection, no
such id, not an object, no name — and a reference that does not resolve
publishes **nothing**: no byline, no `Person`, no empty markup where a name
should be. An author nobody can name is not an author.

An author record holds four fields: `name` (the only one it cannot do without),
`bio`, `image` and `url`. The image goes through `crawlableImage()` and the url
through `pbUrl()`, so a `data:` image and a `javascript:` link are dropped while
the author still resolves. It is not a profile system.

Brand isolation is **structural rather than checked**: `authors` lives in the
brand's own record, so there is no collection to read but this brand's, and an
id belonging to another brand simply does not resolve.

### One published-page reader

`CMS.content.pages({ record, type, indexableOnly, exclude })`.

Everything that needs to know what pages exist asks this. There were already
four partial answers in the codebase — the sitemap's audit, the baker's record
reader, the admin's link picker, the builder's mount list — each correct for its
own job and none reusable. This is the reusable one, and the features built on
it (related content, the hub listing, the admin's checks) do not grow a second.

It takes the record **explicitly**. It does not reach for ambient state, because
`tools/lib/pbbake.js` shares one engine across every brand a process builds: a
reader that read whatever was last loaded would publish one brand's pages on
another's site. The caller that knows which brand it is passes the record; there
is no default that could be wrong.

What it applies, and each rule is one the rest of the build already applied:

- **published only**, by the same three rules `js/seo-files.js` and
  `tools/lib/pbbake.js` use. Those are separate implementations for separate
  runtimes, and `test_content_types.js` holds all three to one table of status
  values so they stay one rule rather than three opinions;
- **a flat `.html` file name**, or `''` for the home page — the only shape the
  generator creates and the sitemap advertises;
- **noindex dropped** when the caller asks for indexable only, which a listing
  wants and a link picker does not.

It sorts newest first, undated last, then by key: total and deterministic, so
two builds of one record produce the same bytes.

### Related content, and the one listing element

`page.related` is a list of page keys an author chose. There is no scoring, no
recency window and no recommendation: those are ranking algorithms nobody can
see into.

`relatedPages()` resolves the list through the reader above, so a draft, a
noindex page, a bad url, a self-link, a duplicate and a key belonging to another
brand all fall out without it needing an opinion of its own.

**One element lists other pages**, not three. `pageList` has a `source`:

- `related` — the pages chosen for this page;
- `type` — every published, indexable page of one content type.

A hub, an archive and a related block are this element with a different source.
`contentType` is deliberately not called `type`: that key already means the
element's own kind everywhere else, and one name for two things is how a value
ends up read by the wrong reader.

It renders nothing — no heading, no empty box — when the list resolves to
nothing, including when there is no render context at all.

### The render context

An element that lists other pages needs the record those pages live in and the
slug of the page it is drawing. `renderSectionsInto(host, sections, ctx)` takes
them, exactly as the section tree is already passed for the contents list.

- In a browser, `paintSections()` passes `{ record: load(), slug }`.
- In a build, `tools/lib/brandkit.js` computes the brand's merged record **once**
  and passes it to every `renderPage()`, which threads it into the mount bake.

With no context there are no pages and a listing draws nothing. That is the safe
direction: visibly empty, never somebody else's content.

### Structured data

Extended, never duplicated:

- **`Article`** for `article`, `guide` and `help`. Built from what resolves and
  nothing else: no headline or no url means no block; an unresolved author means
  no `author` key; an impossible date means no `datePublished`; `schema.article:
  false` turns it off. It is emitted **in the body** by the renderer, beside
  `FAQPage`, for two reasons: it reaches the static HTML of every page type
  without a template anchor, and a page that is not an article emits nothing
  rather than an empty `{}` block that would have changed the markup of pages
  the content model does not touch.
- **`CollectionPage`** for a hub, as a **subtype substitution inside the
  existing `ldPage` block** — the same thing the `contactPage` flag has always
  done. Not a second page-level block beside `WebPage`.
- **`ItemList`** for a hub's listing, emitted in the body from the rows the
  listing actually drew, so the markup and the data cannot describe different
  lists. One per mount: a second listing adds no second block.

`Organization` and `WebSite` were **deliberately left where they are** — on the
homepage, with `WebPage.isPartOf` referencing the WebSite inline on every other
page. That is already semantically correct and non-duplicating; adding them to
every page would duplicate a site-level entity, and would have changed the HTML
of pages that are already live.

### What the checks say

`validatePage()` gained one function, and it produces **no output at all** for a
page that uses none of these fields. What it reports is the set of silent
failures an author cannot see from the page:

- a content type the allow-list does not know, so the page is published as an
  ordinary page;
- a `publishedAt` that is not a real date, or one set on a type that publishes
  none;
- an author id that resolves to nothing;
- each related page that was left out, and why — not a page on this brand, a
  draft, noindex, or an address the build cannot create;
- a hub with nothing to list yet.

Every one asks the engine's own readers rather than a second copy of their
rules, so a check cannot disagree with what gets published.

### Deliberately not built

- **No taxonomy.** Categories and tags depend on automatic archives, which the
  Phase 2C audit deferred. No empty `taxonomy` key was added either: structure
  nothing consumes is speculation.
- **No pagination, no nested URLs, no automatic archives.** The flat-URL rule is
  unchanged; a hub is an ordinary page that lists.
- **No `HowTo`.** A guide is prose unless its steps are structured data, and
  inventing that structure from a list would be a claim the content does not
  make.
- **No `NewsArticle`, `Review` or `Rating`.** This is not a news publisher, and
  the other two cannot be honestly populated by the site about itself.
- **No automatic related content.** Manual only.

### Known limitations

- An `Article` block rides in the page's **mount**, so a page with no published
  Page Builder content publishes no `Article` even if its type says article. In
  practice an article's prose *is* its builder content, but a page with only a
  heading and a lead is the exception.
- A hub's `updatedAt` does not move when a page it lists changes, so its
  sitemap `lastmod` describes the hub, not its contents.
- `indexAreas()` — the publish review sheet — still reads an explicit list of
  page fields and does not include the five new ones, so a change to only a
  content type, date, author or related list is not itemised on the sheet. The
  values still publish; it is the summary that is silent.

## Categories, tags and automatic related content (Phase 2F)

Phase 2C gave content a type, a date, an author and a hand-picked related list.
This adds the two things an editor still had no way to say — *what is this
about* — and uses them to finish the related list automatically.

It is deliberately small. There is no archive, no taxonomy page, no nested URL,
no pagination and no recommender. The flat URL architecture is untouched: a
site with a hundred categories generates exactly the same files as the same
site with none, and a test asserts that by building both and comparing the file
sets.

### What a Category is, and what a Tag is

**A category is the one main topic** a piece of content is about — Cricket,
Casino, Payments. A page has at most one. It is the strongest statement in the
record about what a page is, which is why it scores highest below.

**A tag is a reusable keyword** — IPL, 2026, Final. A page can carry up to
twelve.

Both live in the brand's own CMS record, in `categories` and `tags`, exactly as
`authors` does:

```js
categories: {
  cricket: { name: 'Cricket', slug: 'cricket', description: 'Bat and ball.' }
},
tags: {
  ipl:  { name: 'IPL',  slug: 'ipl' },
  y2026: { name: '2026', slug: '2026' }
}
```

A page refers to one **by id**:

```js
pages: {
  'ipl-final-preview': {
    type: 'article',
    category: 'cricket',
    tags: ['ipl', 'y2026'],
    ...
  }
}
```

Referring by id is what makes a rename safe: changing `name` updates every page
at once, and nothing in any generated file depends on the id itself.

`slug` is a stable, readable handle for editors. **It is not a URL.** No page is
generated for it, nothing is addressed by it, and nothing is added to
`sitemap.xml`. It exists so a later phase could use one without re-slugging
every name, and so two editors naming the same topic twice can be told about it.

`description` (categories only) is for editors. It is not published anywhere
today.

### Which content types carry taxonomy

`article`, `guide`, `help` and `hub`. **Not `page`.**

A plain page is site furniture — About, Contact, Privacy. It has no topic, so
offering it one would be offering an editor something that publishes nothing.
The engine exports the list as `CMS.content.taxonTypes`, and the admin and the
checks both read it rather than keeping copies.

A category or tag stored on a plain page is **ignored, not deleted**. It
publishes nothing, the panel says so in the page's checks, and the value stays
in the record so changing the type back restores it.

### How an editor uses them

In **/admin → Pages** there are two cards, below Authors:

- **Categories** — *Add a category*, which asks for a name and derives an id
  and a slug from it. The same name twice is refused and the existing one is
  named, because that is almost always a mistake rather than a second topic. A
  different name that happens to slugify the same way gets its own id.
- **Tags** — the same, for tags.

Each entry's card shows the id a page refers to it by, **how many pages use
it**, and a Remove button that states the cost before doing anything: *"3
page(s) refer to it, and those references will stop resolving — nothing shown,
rather than a broken label."* Removing one does **not** edit any page: the
pages keep their now-dangling ids, the editor shows them as
`cricket-news (no such category)`, and nothing is published for them.

On a content page, **Pages → Settings & SEO → Content type** gains a
**Category** select and **Tags** checkboxes. They are checkboxes for the same
reason the related-page picker is: a typed id that does not resolve publishes
nothing and explains nothing.

The page's SEO checks report every way this can be wrong:

| Situation | What the checks say |
|---|---|
| Category resolves | `Category resolves to Cricket.` |
| Tags resolve | `2 tag(s) published with this page.` |
| Category id resolves to nothing | **bad** — names the id, says no category is published |
| Some tag ids resolve to nothing | **warn** — names them; the rest still publish |
| Taxonomy on a type that does not carry it | **warn** — ignored until the type changes |
| One tag, no category | **warn** — nothing for automatic matching to use, and why |
| No taxonomy at all | *nothing* — an absent field is never nagged about |

Two entries sharing a slug are flagged on the card: nothing breaks, but two
categories for one topic split it.

### Showing them on the page

One new element, **Category and tags** (`taxonomy`). It draws the current
page's own category and tags:

```html
<aside class="pb-el pb-taxonomy">
  <p class="pb-taxonomy-cat"><span class="pb-taxonomy-label">Category</span><span
    class="pb-taxonomy-value">Cricket</span></p>
  <p class="pb-taxonomy-tags"><span class="pb-taxonomy-label">Tags</span><span
    class="pb-taxonomy-values"><span class="pb-taxonomy-tag">IPL</span><span
    class="pb-taxonomy-tag">2026</span></span></p>
</aside>
```

Three things about that markup are deliberate:

1. **It is in the static HTML**, written by the build, not by JavaScript. A
   crawler reads it without executing anything.
2. **Tags are text, not links.** There is no tag page to link to, so there is
   no `<a>` pretending otherwise.
3. **It renders nothing at all** when the page has no resolvable taxonomy, when
   its type does not carry any, or when there is no render context. An empty
   label is worse than silence — which is why the element now sits in the
   `article`, `guide`, `help` and `hub` templates and costs an untagged page
   nothing.

The labels (`Category`, `Tags`) and two visibility switches are the element's
only content fields. It takes the same style controls every other element takes.

### Automatic related content

The `pageList` element gained one boolean, **`autoFill`**. With it on, a list
whose source is *the pages chosen for this page* shows the hand-picked pages
first and then fills the remaining room automatically. With it off — and it is
off unless set — the element behaves exactly as it did in Phase 2C: *exactly*
what was chosen, nothing more. The four content templates ship with it on.

**Manual always wins.** The author's choices come first, in the author's order.
A page that is both hand-picked and found automatically appears **once**, in its
manual position: an editor's choice is not demoted by the machine agreeing with
it.

**The scoring.** Three visible signals, added up:

| Signal | Points | Why |
|---|---|---|
| Same category | **+3** | an editor chose one topic for each; the strongest statement in the record |
| Each shared tag | **+1** | agreement on a keyword |
| Same content type | **+1** | a guide sits better beside a guide |

**What qualifies a page at all** — two rules, both earned by a case that came
out wrong without them:

1. **The same category, or at least two shared tags.** One shared tag is
   deliberately not enough. A Cricket article tagged IPL/2026/Final and a
   Football article tagged FIFA/2026 share `2026` — a year that says nothing
   about what either is about — and a single-tag rule related them. Two tags is
   where agreement starts meaning something; one editor-chosen category means it
   immediately.
2. **Same type is never sufficient.** It only breaks ties. Otherwise every
   article would relate to every other article merely by being one.

**The order** is score descending, then newest `publishedAt` first with undated
pages last, then by page key. That is a *total* order over a pure function of
the record, so two builds of one record produce the same bytes and the
insertion order of the record cannot change the result.

**The candidate pool is `publishedPages()`** — the one authoritative reader
Phase 2C built, called with `indexableOnly: true` and the page itself excluded.
Nothing here re-implements it, so drafts, `noindex` pages, addresses the build
will not create, the page itself and anything belonging to another brand are
gone before the scoring starts. The default and maximum fill is **6**.

**It reaches structured data.** An `Article` gains `articleSection` (the
category name) and `keywords` (the tag names, comma separated) — the two
properties schema.org already has for exactly this, and only when the taxonomy
resolves. A dangling id adds nothing there, as it adds nothing to the page. A
hub is a `CollectionPage` and publishes no `Article`, so neither key can appear
on one.

### White-label isolation

Structural, not checked — exactly as it is for authors. `categories` and `tags`
live in the brand's own record, so there is no collection to read but this
brand's, and an id belonging to another brand simply does not resolve. Two
brands can use the id `news` for different categories; each build shows its own
name, and a test builds both and asserts neither output contains a trace of the
other's names or pages.

The render context exists for this reason: the baker shares **one** engine
across every brand it builds, so an element that read ambient state would have
published the wrong brand's topics.

### What is intentionally not implemented

- **No category or tag pages.** A few hundred thin archives would cost this
  site more than they could return.
- **Nothing in the sitemap, nothing in robots.txt.** Asserted by building the
  same site with and without taxonomy and comparing both files byte for byte.
- **No nested URLs.** The flat `<slug>.html` rule is untouched. A slug with a
  slash is not a valid slug.
- **No pagination, no automatic archives, no "all posts in Cricket" page.**
- **No AI, embeddings, external APIs or machine learning.** The scoring above is
  the whole algorithm, and an editor can predict it from the page.
- **No second content engine and no second published-page reader.** Everything
  reads `publishedPages()`.
- **Manual related content is unchanged.** `CMS.content.related()` still means
  exactly what was chosen; `relatedCombined()` is a second reader over it.

### Tests

`tests/test_taxonomy.js` — 149 assertions, in process against the real engine.
Mostly about **refusal**: an id that names nothing, a prototype key, an array
where a string belongs, a category on a type that does not carry one, a shared
year, same-type-alone, a draft or `noindex` candidate, a slug that is not a slug.
Plus the order being total: the same record in a different key order produces
the same list.

`tests/test_taxonomy_static.js` — 76 assertions, every one read out of files a
real `tools/build-site.js` wrote. The static markup; tags not being links; the
file set, sitemap and robots.txt being identical with and without taxonomy;
manual priority in document order; `autoFill` off behaving exactly as Phase 2C
did; two brands with the same ids seeing only their own; hostile names escaped;
a review host indexing nothing.

`tests/test_admin_seo.js` grew from 82 to 132: creating a category through the
real button and prompt, the duplicate-name refusal, a colliding slug getting its
own id, assignment by id, tag checkboxes, removal stating its cost and leaving
the page's id intact, the dangling id shown as `(no such category)`, the split
slug warning, and each of the six check messages appearing exactly when it
should and not when it should not.

Five mutations were applied to confirm these suites can fail: loosening the
two-tag gate, adding `page` to the taxonomy types, putting automatic before
manual, rendering a tag as a link, and removing the string-type guard on ids.
Each was caught.

### Known limitations

- A category's `description` is stored and never published. It is editor
  context, and inventing a place to show it would have meant inventing a
  taxonomy page.
- `slug` is validated but unused by anything that generates output. A site that
  never looks at it loses nothing.
- Two categories may share a slug. Nothing is addressed by slug so nothing
  breaks; the admin flags it as a split topic.
- The publish review sheet (`indexAreas()`) does not itemise `category` or
  `tags`, for the same reason it does not itemise the Phase 2C fields: it reads
  an explicit list. The values publish; the summary is silent.
- `autoFill` only affects a list whose source is *the pages chosen for this
  page*. A list showing every page of one kind is already complete by
  definition.
- A page with a category but no published Page Builder content publishes no
  taxonomy block, because the element rides in the mount — the same limitation
  the `Article` block has.

## Tests

`tests/test_pagebuilder.js` — 343 assertions. Style questions are asserted on
**computed style in a real browser**, not on the generated CSS text: the bug
that prompted the hardening pass — a heading colour the page's own
`.info-article h2` quietly won — is invisible to any test that only reads the
CSS the builder emits.

Covered: the mounts; the no-builder case; the draft gate; every element
control beating the page's own CSS; section style not leaking into elements;
card style not leaking into card internals; five instances of each type
keeping their own values; nesting inside columns; all seven section types;
base/tablet/mobile overrides and fallback; visibility per breakpoint; URL and
markup safety; CSS injection through the free-text style fields; malformed and
missing data; the draft/publish API; a remote pull not rolling back a draft;
the admin panel, editors and preview; SEO; and the pages that never opted in.

```bash
cd tests && npm test -- test_pagebuilder.js
```

Two assertions are the ones that matter most, and they should never be
weakened: a draft renders nothing for a visitor, and Save draft produces no
write to the server.

`tests/test_pagebuilder_dnd.js` — 195 assertions, milestone D. Every refusal
is driven twice: through a real mouse, because the drop position comes from
real rectangles and a test that computed it would be testing its own
arithmetic; and through `ADMIN_BUILDER.drag`, which is the pair of functions
the pointer handlers themselves call, because most refusals cannot be
produced with a mouse — there is no address you can drag to that reads
`sec: '__proto__'`, and a stale id needs the tree to change mid-gesture.

Covered: 31 refusal cases, each asserted to leave the draft byte-identical;
a draft that already carries `__proto__`, `constructor` and a quoted id, and
the separate claim that its presence does not freeze anything else; what a
move preserves, down to the moved node being deep-identical; the pointer
path for sections, elements and columns including the valid and invalid
states of the indicator; the post-move check against the sanitiser, driven
at the 200-element limit where it actually fires; seven ways of cancelling,
each re-checked after forcing a save so an in-memory change could not hide;
dirty state, a refused write, and zero POSTs; keyboard reordering with focus following the node;
touch; library and template independence; and 30 sections / 90 columns /
240 elements with a MutationObserver proving nothing is rebuilt mid-drag.

`tests/test_pagebuilder_seo.js` — 232 assertions, milestone E onwards. The claim
under test is that builder content and the SEO record share a page without
either becoming the other.

Covered: what controls the visible H1, on the page and in both admin panels;
every template asserted to add no second H1; the outline reader, including
its level fallback, disabled sections and elements, nesting and junk input;
title, description, canonical and robots reading from the SEO record with an
empty or whitespace-only value never replacing a valid static tag; OG and X,
including the URLs `crawlableImage()` refuses; structured data and breadcrumbs
with the builder's loudest possible content present, asserting no invented
rating, review or FAQ schema; the sitemap, asserting no builder text, link or
image can reach it and that membership is page configuration alone; every page
shape from legacy through empty-builder, template, reusable section,
responsive overrides and assets; hostile builder input on a page with SEO set;
the admin's own state, saving, page switching and disabled reasons; and the
admin at 1440, 900 and 390px with accessible names, tab order and a visible
keyboard focus ring.

`tests/test_pb_bake.js` — 119 assertions. The claim under test is that the
published builder content is in the **initial HTML response**, produced by the
runtime renderer and not by a second one.

Covered: our HTML serialisation asserted **byte-identical** to a real browser's
`innerHTML` for a fixture covering every element type, escaping, void and
boolean attributes and nested columns; the content present in the delivered file;
two brands built through one pipeline with neither leaking into the other;
nothing published, draft-only and a published empty canvas; every SEO tag,
sitemap and `robots.txt` identical with and without builder content; two builds
of one commit byte-identical; the generated page stubs; and the runtime drawing
exactly one copy over baked markup — with the row agreeing, absent, unpublished
and publishing something newer — including with JavaScript off.

`tests/test_pb_sync.js` — 98 assertions. The claim under test is that the two
synchronization guards each prove what they claim and **nothing more**.

Covered: a synchronized source building; a `changed`, `missing` or `extra`
fingerprint failing the build; a `brand.js` physically swapped in from another
brand failing on its recorded row; a brand with no builder content neither
failing nor warning; missing provenance emitting `::warning::` and still
building; `tools/check-published.js` in sync, stale, server-only, nothing
published and with no provenance, asserted to write nothing; the explicit
**integrity ≠ freshness** claim, including that Part 1 passes on a source whose
row has moved on; the bake making no network call, asserted by building with the
Supabase reader replaced by one that reports failure, by no file on the bake path
requiring `http`/`https`/the reader or calling `fetch`, and by two builds of one
commit producing identical HTML; and every SEO tag, the baked markup and the
`cmsBuilder` styles identical with and without a provenance declaration, which is
also asserted never to reach a visitor's page.

`tests/test_pagebuilder_hardening.js` — 224 assertions, milestone F. Aimed at
the public render path, because that is the one place the whole-tree sanitiser
deliberately does not run.

Covered: a stored type of `constructor`, `toString`, `valueOf`, `__proto__` or
`hasOwnProperty` in every position that reads an allow-list; `__proto__` as a
key in localStorage and in the Supabase row; eighteen shapes of corrupted or
malformed storage; every structural limit; a hostile library file; all
every element type with nothing and with everything, then again with real
content and their accessibility attributes; three breakpoints with inheritance
and overrides in both directions; the share-card preview against ten CSS
injection attempts; drafts, library and recovery staying off the wire and out
of the page; 30 sections / 90 columns / 240 elements with repaint, sanitise
and style-tag counts; and the pages that are not builder pages.

### Phase 2A

Phase 2A added no suite of its own. Every claim it makes is asserted inside
the suite that already owned the question, which is also what forced the
existing coverage to grow rather than sit beside something new.

| Suite | Was | Now | What it gained |
| --- | --- | --- | --- |
| `test_pb_bake.js` | 91 | 119 | the new elements in the byte-for-byte fixture, including `<ul>`/`<ol>`/`<table>` and `<strong>`/`<em>`/`<a>` as siblings of text nodes; every contents link resolving to an id in the same HTML; one `FAQPage` block, valid JSON once served, with the pair the author wrote |
| `test_pagebuilder_seo.js` | 184 | 232 | `FAQPage` earned and the four ways it is not; one block from three FAQ elements; the link picker's rule, computed from the record; every new content check firing, and staying quiet on sound content |
| `test_pagebuilder_hardening.js` | 212 | 224 | ten payloads through the inline reader — tags, an event handler, a script element, four refused schemes — and a `rich` flag that is not boolean `true` |
| `test_pagebuilder_v2.js` | 141 | 145 | the palette count, and each new type offering exactly its working design controls |
| `test_brand_isolation.js` | 76 | 78 | the link picker's only page source, and the file never reaching for the brand resolver |
| `test_pagebuilder_design.js` | 90 | 97 | probe content for the new types, and the key list asserted against the renderer's own type list |
| `test_pagebuilder_defaults.js` | 55 | 58 | the new types added, rendered and measured like the rest |

Three assertions in those suites were counting to a literal `13`. They now
compare against `CMS.sections.elementTypes`, which is what they were trying
to say and does not go stale the next time a type is added.

### Phase 2B

No suite of its own here either. Every claim is asserted in the suite that
already owned the question.

| Suite | Was | Now | What it gained |
| --- | --- | --- | --- |
| `test_cms_bake.js` | 349 | 372 | one page carrying every new element, built for JSK1, Playzone9 and a synthetic third brand: markup asserted IDENTICAL where it should be, no cross-brand contamination, container CSS and media query baked for each |
| `test_pagebuilder_hardening.js` | 224 | 271 | the tabs driven from the keyboard with focus asserted, the carousel's strip scrolling from CSS alone, and eight video addresses against what each is allowed to become |
| `test_pb_bake.js` | 124 | 156 | all eight new elements plus a styled container in the byte-for-byte fixture |
| `test_pagebuilder_design.js` | 97 | 113 | probe content for every new type, and `minWidth` added to the probe map |
| `test_pagebuilder_v2.js` | 145 | 157 | the palette count taken from the renderer's own type list |
| `test_pagebuilder_columns.js` | 58 | 84 | a container styled every way it can be, read from computed style at three widths, an untouched one asserted value by value to be unchanged, and a hostile one |
| `test_pagebuilder.js` | 343 | 349 | element and container visibility at 1280/900/390, and that hidden content is still in the HTML |
| `test_pagebuilder_defaults.js` | 58 | 66 | the new types added, rendered and measured |
| `test_pagebuilder_library.js` | 140 | 141 | the two new starters |

Four problems in the suites themselves surfaced while adding these, and each
was a bug in the test rather than in the code:

- `test_pagebuilder_hardening.js` and `test_pagebuilder_design.js` seeded
  `localStorage` from `addInitScript`, which runs in **every frame**. In a
  sandboxed cross-origin one — which the video element puts on the page —
  that throws a `SecurityError` which arrives as a page error and reads as a
  failure of whatever put the frame there. Both now guard on being the top
  document, rather than wrapping the call in a `try` that would hide a real
  storage failure too.
- `test_pagebuilder_design.js` had no probe value for `minWidth`, so the probe
  set `undefined`, nothing changed, and three elements were reported as
  offering controls that do nothing.
- and its `columns` probe collides with the gallery's own default: at that
  viewport the box is 826px, where `auto-fill minmax(180px, 1fr)` resolves to
  four 199px tracks — identical to what the `4` preset asks for. A per-type
  override exists now, with the arithmetic written down.

Two genuine omissions those probes caught: `fontWeight` was allow-listed for
`plans` and `carousel` and the CSS did not read it. A control is offered only
if it does something.
