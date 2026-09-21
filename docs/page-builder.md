# Page Builder — Version 1

A section-based page builder inside the existing white-label CMS. The admin
composes a page out of sections, previews it at three widths, and publishes it
when it is ready. Until then visitors keep seeing exactly what they see today.

- Public renderer: `js/cms.js` (`CMS.sections`)
- Public styles: `css/sections.css`
- Admin UI: `admin/index.html` (`#panel-builder`), `js/admin.js`, `css/admin.css`
- Tests: `tests/test_pagebuilder.js`

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

**Nothing is uploaded and nothing is encoded.** No Supabase Storage, no
base64, no external fetching. The CMS JSON grows by one path per image.

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

## Safety

- **No arbitrary HTML.** Every element is built with `document.createElement`
  and `textContent`. `innerHTML` is never used for stored content, so markup in
  a text field is shown literally rather than executed.
- **URL allow-list.** `pbUrl()` accepts `http:`, `https:`, `mailto:`, `tel:`,
  anything starting `#` or `/`, and plain relative file names. Everything else —
  `javascript:`, `data:` — becomes empty: a link falls back to `href="#"` and an
  image is dropped. The admin is warned at the field while typing.
- **Depth guard.** Nested rendering stops after three levels.
- **Unknown types are skipped**, never thrown on, so an older site can render a
  newer draft without breaking.
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
- **Drafts stay on the device.** `Remote.publish()` strips `builderDrafts`
  from the payload, so unpublished copy is never uploaded to the public row
  that every visitor downloads with the anon key.
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

- Sections are painted into the DOM by JavaScript. With JavaScript disabled the
  page still shows the content in its HTML file, which is why unpublishing is
  non-destructive rather than a delete.
- The static-first rule is untouched: an empty CMS value never blanks a static
  meta tag.
- Headings keep their level, so a section can carry a real `h2`/`h3` outline.
- An image with a source but no alt text is flagged in the editor.

---

## Tests

`tests/test_pagebuilder.js` — 329 assertions. Style questions are asserted on
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
