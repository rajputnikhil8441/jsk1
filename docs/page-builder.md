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
