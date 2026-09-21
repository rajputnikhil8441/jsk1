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

## 3. The sticky header

`position: sticky; top: 0` on `header.site-header`. No JavaScript is involved,
so there is no scroll listener, no class toggling on scroll and no layout
thrash — and therefore no JS-caused layout shift.

**One thing had to change for it to work at all.** `html, body` carried
`overflow-x: hidden`. When one axis of `overflow` is `hidden`, the other
computes to `auto`, which makes the element a scroll container — and a sticky
child sticks to *that* container, not the viewport. The header had never
actually stuck: measured before the fix it sat at `top: -325px` after a 400px
scroll. Both stylesheets now declare

```css
overflow-x: hidden;   /* older browsers */
overflow-x: clip;     /* wins where supported; creates no scroll container */
```

Two adjacent bugs surfaced while verifying this and were fixed with it:

* `--ticker-h` claimed 20px (desktop) / 18px (mobile) while `.header-ticker`
  rendered at a hardcoded 23px, so the nav bar overlapped the header by 3–5px.
  The token is now the real 23px and the ticker reads `height: var(--ticker-h)`,
  so the two cannot disagree again.
* `box-shadow: 5 5px 10px ...` — the unitless `5` made the whole declaration
  invalid, so the header shadow had never rendered. It is now `0 2px 8px`.

The mobile category strip is intentionally **not** sticky: 67px of header plus
33px of strip is too much fixed chrome on a phone, and the header's dropdown
already reaches every page.

---

## 4. The footer

A normal document footer — `position: static`. It is never `fixed`, so it can
never overlay content. Four columns, collapsing with
`grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`:

* **Brand** — logo, site name, a short description (`footer.about`), social links
* **Important Links** — Home, About, Contact, Responsible Gaming, Privacy Policy
* **Account** — Login, Register
* **Support** — Contact us, WhatsApp support

Every link points at a page that exists in this repository. There is no
keyword-link block, no doorway links and no invented pages.

**There is deliberately no "Legal / Terms" column.** Terms & Conditions and
Disclaimer pages do not exist in this repository, and the footer does not link
to pages that are not there. If those pages are ever written, add them to
`FOOTER_GROUPS` in `tools/build-shell.js` and re-run the tool.

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

The shell's **structure and links are code**, not CMS data. There is no new
Supabase table, no new API, no RLS or auth change and no new admin subsystem.

This was a deliberate decision. A CMS-editable footer link model would create a
second navigation system competing with the static markup that crawlers
actually read, and would need its own URL validation, its own ordering UI and
its own failure modes — a lot of surface for a four-column footer that changes
when a page is added.

What the CMS *does* supply inside the shell is text and images it already
supplied before: `branding.siteName`, `footer.about`, `footer.copyright`,
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
integrity, refusal of unsafe hrefs), the served markup, sticky behaviour
verified by actually scrolling at 1280 / 900 / 768 / 390 / 375, navigation
destinations and active state, the footer's exact link set, accessibility,
the exclusion of login/register/admin, builder sections sitting between header
and footer, and CMS text safety.

Run everything with `cd tests && node run-all.js`.
