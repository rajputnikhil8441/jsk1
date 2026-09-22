# The global site shell

Every public page on JSK1 is built as:

```
GLOBAL STICKY HEADER  ->  PAGE-SPECIFIC CONTENT  ->  GLOBAL FOOTER
```

The header, the navigation bars and the footer are the *shell*. They are the
same on every public page, and they are generated from one place so that they
cannot drift apart.

---

## 1. Where the shell lives

`tools/build-shell.js` owns the canonical markup. It is a plain Node script
with no dependencies, in the same style as `tools/build-asset-manifest.js`.

Each page carries three marker pairs:

```html
<!-- SHELL:HEADER -->  ... <!-- /SHELL:HEADER -->
<!-- SHELL:NAV -->     ... <!-- /SHELL:NAV -->
<!-- SHELL:FOOTER -->  ... <!-- /SHELL:FOOTER -->
```

The tool rewrites **only** what is between a pair. Everything outside is the
page's own content and is never touched.

```
node tools/build-shell.js            # rewrite the shell in every page
node tools/build-shell.js --check    # exit 1 if any page is out of date
```

The generated HTML is **committed**. Nothing is built at deploy time, there is
no bundler, no framework and no new dependency. GitHub Pages serves the same
static files it always did.

### Why a generator and not runtime injection

The obvious alternative — `fetch('shell.html')` and inject on load — was
rejected:

* A crawler that does not run JavaScript would see a page with no navigation
  at all. The site's whole SEO architecture depends on crawlable internal links.
* It costs an extra request per page and reconstructs the same DOM on every
  navigation.
* It moves navigation into a runtime code path where a script error takes the
  whole site's navigation down.

A committed generator gives one source of truth *and* fully static, crawlable
markup. The `--check` mode is what keeps the two honest.

---

## 2. Which pages get the shell

| Page | Header | Info-page nav | Footer |
|---|---|---|---|
| `index.html` | yes | no — the home page keeps its own category nav | yes |
| `about.html` | yes | yes | yes |
| `contact.html` | yes | yes | yes |
| `responsible-gaming.html` | yes | yes | yes |
| `privacy-policy.html` | yes | yes | yes |
| `404.html` | yes | yes | yes |

`login.html`, `register.html` and `admin/` are deliberately **excluded**.
They are special-purpose pages with their own chrome, and the admin must never
expose its navigation publicly. `tests/test_shell.js` asserts that they stay
outside the shell.

---

## 3. The header scrolls away

The header is in **normal document flow**. It is deliberately neither
`position: sticky` nor `position: fixed`: it sits at the top of the page,
scrolls off with everything else, and is there again when you scroll back.
Nothing is pinned to the top of the viewport.

No JavaScript is involved — no scroll listener, no class toggling on scroll,
no layout thrash and no JS-caused layout shift.

`.site-header` keeps its `z-index: 100` so it paints above the content that
follows it; `z-index` positions nothing.

### The overflow coupling, and why it is left alone

`html, body` carry `overflow-x: hidden`. When one axis of `overflow` is
`hidden`, the other computes to `auto`, which makes the element a scroll
container — and a `position: sticky` descendant then sticks to *that*
container rather than the viewport, which in practice means it does not stick
at all.

`.main-nav` and `.left-sidebar` still carry `position: sticky` declarations
from earlier work. They are **inert** because of that `overflow-x: hidden`,
and that is the behaviour we want: nothing pinned to the viewport. The rules
are left in place rather than deleted, because removing them is a change to
navigation and sidebar CSS that nobody asked for.

The consequence worth knowing: **switching `overflow-x` to `clip` would
silently pin the nav bar to the top of the viewport.** `tests/test_shell.js`
asserts that the nav scrolls away flush beneath the header, so that change
fails the suite rather than shipping.

### Two bugs fixed along the way

* `--ticker-h` claimed 20px (desktop) / 18px (mobile) while `.header-ticker`
  rendered at a hardcoded 23px, so the nav bar overlapped the header by 3–5px.
  The token is now the real 23px and the ticker reads `height: var(--ticker-h)`,
  so the two cannot disagree again.
* `box-shadow: 5 5px 10px ...` — the unitless `5` made the whole declaration
  invalid, so the header shadow had never rendered. It is now `0 2px 8px`.

### How this is kept true

`tests/test_shell.js` guards it three ways, so a regression fails rather than
ships:

1. It reads the `.site-header` rule out of `css/style.css` and fails if
   `position: sticky` or `position: fixed` appears — in the base rule or in
   any media query, in either stylesheet.
2. It checks the computed `position` in a real browser at five widths.
3. It scrolls the page and asserts the header moved up by exactly the scroll
   distance, is off-screen, that nothing is painted at the top of the
   viewport, and that it is back at `top: 0` afterwards.

All three were mutation-tested: restoring `position: sticky` fails 62
assertions, `position: fixed` fails 102, and restoring `overflow-x: clip`
fails 10 (the nav pinning at `top: 75`).

Nothing else is pinned either — the mobile category strip scrolls away with
the rest of the page, and the header's dropdown reaches every page from
wherever you are.

---

## 4. The footer

A normal document footer — `position: static`. It is never `fixed`, so it can
never overlay content. Four columns, collapsing with
`grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`:

| Column | Owned by | Editable where |
|---|---|---|
| **Brand** | `tools/build-shell.js` | its text via `branding.siteName`, `footer.about`, `footerLogo`, social handles |
| **Navigation columns** | **the CMS** (`footer.columns`) | Admin → Footer |
| **Support** | `tools/build-shell.js` | link text via `support.link` |
| Copyright row | `tools/build-shell.js` | `footer.copyright` |

Brand and Support are deliberately **not** CMS-managed. They are not link
lists: Brand carries a logo, a bound site name and the social icons, Support
carries the WhatsApp link that `paintWhatsApp()` rewrites by element id.
Modelling those would mean modelling images, handles and id-bound behaviour in
the same schema, for no gain. They are marked `data-footer-keep="brand"` and
`data-footer-keep="support"` and are moved across untouched on every render.

Every link in the shipped footer points at a page that exists in this
repository. There is deliberately **no "Legal / Terms" column** — Terms &
Conditions and Disclaimer pages do not exist here, and the footer does not
link to pages that are not there.

---

## 4b. The Global Footer Manager

The navigation columns between Brand and Support are CMS data, editable in
Admin → Footer, and the change reaches every public page.

### The data

One new top-level key in the same CMS JSON that already carries everything
else — **no new Supabase table, no schema change, no RLS or auth change.** It
travels in the existing `site_brand` row.

```js
footer: {
    version: 1,
    columns: [
        {
            id: 'important',            // stable identity across reorders
            title: 'Important Links',
            enabled: true,
            links: [
                { id: 'imp-home', label: 'Home', href: './', enabled: true }
            ]
        }
    ]
}
```

Two levels, columns → links. No sub-columns: a footer is navigation, not a
place to grow a keyword farm.

`footer.about` and `footer.copyright` stay where they already were, in `text`.
They were always editable in Admin → Texts; the Footer panel shows the *same*
values rather than a copy, and `footer.about` finally has a friendly label
("Footer description") instead of showing its raw key.

### Static first

This is the whole design, and it is the reason the generator still writes a
complete footer into every page.

1. `tools/build-shell.js` emits the full `FOOTER_GROUPS` markup. That is what
   ships in the HTML and what a crawler reads.
2. The container is marked `<div class="footer-cols" data-cms-footer>`.
3. `renderFooter()` in `js/cms.js` replaces the navigation columns **only** when
   the saved data survives `cleanFooter()`.
4. `cleanFooter()` returns `null` for anything it cannot vouch for, and
   `renderFooter()` returns early on `null`. **The fallback is not a second
   code path — it is what happens when the sanitiser declines to produce one.**

`DEFAULTS.footer` ships the same two columns the generator writes, so an
untouched install and a Supabase row without a `footer` key both render exactly
what the file already shows. Every pre-existing test passed unchanged.

`cleanFooter()` returns `null` for: no data, a non-object, an array, a string,
a number, `columns` missing/null/not-an-array, an empty `columns`, and the case
where every column is dropped. A *partly* bad footer keeps only the good parts:
a column whose links all fail is dropped, and a link with no usable label or
href is dropped, but its siblings survive.

### Sanitisation

Everything reaching `cleanFooter()` is treated as hostile. The Supabase row
needs an authenticated write, but `localStorage` does not, and Admin → Data →
Import `JSON.parse`s an arbitrary file straight into the config. So the
sanitiser hands back only objects it built itself.

| Rule | Value | Enforced in |
|---|---|---|
| Columns | 6 | `cleanFooter()` **and** the admin |
| Links per column | 12 | `cleanFooter()` **and** the admin |
| Column title | 40 chars | `cleanFooter()` **and** `maxlength` |
| Link label | 60 chars | `cleanFooter()` **and** `maxlength` |

The caps that matter are the ones in `cleanFooter()`. The admin's are a
courtesy — an import bypasses the admin entirely, and re-enabling a disabled
Add button is a two-second job in devtools, so both handlers refuse past the
cap as well.

`footerStr()` accepts **only a real string** (or a finite number). That is
stricter than the codebase's `str()` for two reasons, both found by the tests:

* `{"title":{"toString":"x"}}` makes `String(v)` throw *Cannot convert object
  to primitive value* — which killed the whole render on the public page.
* `{"title":{"a":1}}` quietly yields `"[object Object]"`, which then shipped as
  a column heading.

Neither is a label, so neither gets to be one. `footerHref()` guards the same
way before it reaches `str()` or `pbUrl()`.

### URLs

Every href goes through `footerHref()`, which is built on the existing
`pbUrl()` and is **stricter** than it:

* `pbUrl()` rejects control characters, protocol-relative `//host`, and every
  scheme but `http(s):`/`mailto:`/`tel:`, plus plain relative paths and `#`/`/`.
* `footerHref()` additionally rejects a bare `#` (a link to nowhere) and any
  href containing `..` (`pbUrl()` would accept `about/../../etc` because it
  starts with a word character — fine for an author-typed Page Builder link,
  pointless in site navigation).
* `footerHref()` additionally *allows* the exact string `./`, which is what the
  static footer already writes for Home and which `pbUrl()` refuses because its
  relative-path branch needs a leading word character. Exact match only —
  `.//evil` and `./../x` fall through to `pbUrl()`, which refuses them.

External `https:` is allowed on purpose: a licensing authority or a payment
partner is a legitimate footer link. Every external, `mailto:` and `tel:` link
is marked `external` by the sanitiser and rendered with `rel="noopener"`.

### Rendering

Nothing is built with `innerHTML`. Titles and labels go in as `textContent`,
so markup in a CMS value is *shown*, never parsed. Each column's `<nav>` takes
its `aria-label` from the same text its `<h2>` displays, so the landmark is
never nameless. Column titles stay `<h2>`, so the heading outline does not
change and the page still has exactly one `<h1>`.

One DOM write per render: the kept nodes are moved into a fragment first, so
clearing the host cannot destroy them.

### The admin panel

Admin → Footer, built on the same `bindDrag`/enable/delete pattern the Home
lists already use — a column is a card, its links are indented rows.

* add / delete / reorder columns; rename titles; enable/disable
* add / delete / reorder links; edit label and URL; enable/disable
* a page picker built from `CMS.data().pages` (so a new page appears with no
  extra wiring) plus the account pages and a custom-URL option
* live URL validation using `CMS.footer.href` — the panel cannot say yes to
  something the page will then drop — which also tells you when a link will
  carry `rel="noopener"`
* the shared description and copyright fields, writing through to `text`
* a note that states plainly what the public page will do with what is
  currently entered, including *"nothing above is usable, so every page will
  show the footer written into its HTML"*
* `markDirty()`, so the existing unsaved-changes flag and Save/Publish work
  unchanged

### SEO

Footer links stay crawlable in the static fallback — that is the point of the
static-first design. No structured data is generated from footer links. No
footer link is added to the sitemap. Nothing is hidden or keyword-stuffed, and
the 6 × 12 ceiling makes a mass-generated keyword footer structurally
impossible.

---

## 5. Navigation model

`PRIMARY` in the generator is Home / About / Contact / Responsible Gaming.
Privacy Policy is **not** in the primary bar: it is secondary, legal-style
navigation and belongs in the footer. That is a deliberate policy, so that
every future page does not get pushed into a header bar that then overflows.

The active page is marked with `class="active"` and `aria-current="page"`, once
per navigation bar.

### The safety guard

Navigation hrefs are not free text. `localHref()` throws rather than emit a
link it does not recognise:

```js
if (v === './') return v;
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.html$/.test(v)) throw ...
if (!fs.existsSync(path.join(ROOT, v))) throw ...
```

That rejects `javascript:`, `data:`, `blob:`, `vbscript:`, protocol-relative
`//host`, `../` traversal, absolute external URLs and attribute-breakout
attempts, and it also rejects a link to a page that does not exist — so a dead
link cannot be committed. A refusal aborts the whole run; no page is left
half-written. All of this is exercised in `tests/test_shell.js`.

---

## 6. CMS involvement

There is no new Supabase table, no new API, and no RLS or auth change. The
footer's columns travel in the existing `site_brand` row alongside everything
else.

**The header and its navigation are code.** `PRIMARY` and `ACCOUNT` in
`tools/build-shell.js` are the only source for the header dropdown and the
info-page nav bars, and they are not CMS-editable. A header has a fixed number
of slots before it overflows, and the generator's `localHref()` guard means a
nav link to a page that does not exist cannot even be committed.

**The footer's navigation columns are CMS data** — see section 4b. The concern
that a CMS footer would compete with the static markup a crawler reads is
answered by the static-first contract rather than by keeping the footer in
code: the shipped markup remains authoritative and the CMS only replaces it
when its data is valid. The two stay in step because `DEFAULTS.footer` ships
byte-for-byte what the generator writes.

Beyond that, what the CMS supplies inside the shell is text and images it
already supplied before: `branding.siteName`, `footer.about`, `footer.copyright`,
`support.link`, `marquee.text`, the logos and the social links. All of it goes
through the existing sanitisers — text through `textContent`, URLs through the
existing URL rules — and none of it is ever written as raw HTML.
`tests/test_shell.js` feeds hostile values (`<script>`, `<img onerror>`,
`<iframe src=javascript:>`) through every one of those keys and asserts that
nothing executes and no element is created.

---

## 7. Page Builder compatibility

The Page Builder data model is **unchanged**. No shell markup is stored in
`pages.<slug>.builder`, the header and footer are not sections, and they are
not draggable.

Builder sections mount at `<div data-cms-sections="slug">` inside `<main>` —
that is, between the header and the footer, as page content. The shell is
outside the mount and the builder never sees it.

`privacy-policy` is registered with `builderMount: true` like the other info
pages, because the page carries the mount div.

---

## 8. New pages

Admin → SEO → Create Page generates a complete page. `newPageHtml()` in
`js/admin.js` reads `about.html`, cuts the three marked regions out of it and
drops them into the new page, stripping the active state from the nav. That is
the same single source of truth, not a second copy of the markup.

If the fetch fails the download still produces a valid page, with the shell
regions left empty and a comment saying to run `node tools/build-shell.js`, and
the admin shows a warning toast. It degrades honestly rather than emitting a
page with a half-written header.

After adding a generated page to the repository, add it to `PAGES` in the
generator and run the tool.

---

## 9. The login gate

`index.html` loads `js/main.js`, which installs a site-wide click gate: the
first click anywhere raises "Please login to access!", the second sends you to
`login.html`. The information pages have never loaded `main.js`, so this only
applies to the home page.

That gate swallowed the new footer. Measured on the home page before the fix:
clicking **Privacy Policy** raised the toast, and clicking it again landed on
`login.html`. The footer's whole purpose is that the legal and account pages
are reachable from anywhere, so one exception was added beside the ones already
there (`.btn-register`, `.btn-login`, `.header-logo`, `.pagemenu`,
`.whatsapp-float`, `.support-wa-btn`):

```js
if (e.target.closest('footer.site-footer .footer-links a')) return;
```

Nothing else changed. The odds buttons, the casino cards, the tables and the
category navigation are all still gated, and `tests/test_shell.js` asserts both
halves of that — that the footer links navigate from the home page, and that
`.odds-btn` and `.casino-card` still raise the gate.

---

## 10. Accessibility

Verified in a real browser, not asserted from markup:

* `<header>`, `<footer>` and `<nav>` landmarks; every `nav` has an accessible name
* The dropdown control is a real `<button>` with a label, and its
  `aria-expanded` mirrors the open state (it did not before — `js/menu.js` now
  syncs it)
* The dropdown opens from the keyboard and closes on `Escape`
* Focused controls in the header show a visible focus ring
* Every link in the shell has an accessible name, from text, `aria-label`,
  `title` or an image `alt`

This is a list of behaviours that were measured. It is **not** a claim of WCAG
conformance — no conformance audit has been run.

---

## 11. Tests

`tests/test_shell.js` covers the generator (idempotency, `--check`, marker
integrity, refusal of unsafe hrefs), the served markup, scroll behaviour
verified by actually scrolling at 1280 / 900 / 768 / 390 / 375, navigation
destinations and active state, the footer's exact link set, accessibility,
the exclusion of login/register/admin, builder sections sitting between header
and footer, and CMS text safety.

`tests/test_footer.js` covers the Global Footer Manager: the crawlable static
fallback in the files, the shipped default rendering byte-for-byte what the
file shows, a valid CMS footer reaching every page, Brand and Support surviving
every render, 21 missing/empty/malformed payloads each leaving the fallback
untouched, partial validity, accepted and refused URL forms, hostile labels and
titles rendering as text, control-character stripping, seven prototype-pollution
payloads delivered as JSON text, the caps, enable/disable, order, accessibility,
five viewport widths, the generator's idempotence, a generated page, the admin
panel end to end (add/delete/reorder/rename/picker/live validation/caps/dirty
state), save-and-reload reaching a public page, and the SEO invariants.

Run everything with `cd tests && node run-all.js`.
