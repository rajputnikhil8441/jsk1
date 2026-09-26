# templates/ — the shared pages

`templates/pages/*.html` are the eight pages every brand gets unless it says
otherwise. They are the JSK1 pages with the brand strings replaced by tokens,
which is why generating JSK1 reproduces the deployed files byte for byte.

## Three levels of brand control

Reach for the first. The later ones exist because "every brand has identical
markup" is an assumption that breaks the first time someone wants a different
login page, and discovering that after the architecture is fixed is expensive.

### 1. Tokens — the words differ

    <title>Login — {{brand.name}}</title>
    <link rel="canonical" href="https://{{brand.domain}}/login.html" />

Available: `{{brand.name}}`, `{{brand.domain}}`, `{{brand.siteId}}`,
`{{brand.id}}`. A mistyped token is a build failure, not a literal
`{{brand.nmae}}` in a page a crawler reads.

### 2. Slots — a brand adds its own markup

A template declares a named, empty region:

    </form><!-- BRAND:login-notice --><!-- /BRAND:login-notice -->

A brand fills it with `brands/<id>/slots/login-notice.html`. A brand that says
nothing gets nothing: the markers and everything between them are removed, so a
page with no slots filled is byte-identical to one that never had markers. That
property is what let slots be added to the live pages at all.

Slot content is committed HTML, reviewed in a diff, inserted at build time. It
never comes from a database or a request. It is still gated: over 64 KB,
`<script>`, `<iframe>`, `<object>`, an inline `on*` handler, a `javascript:`
URL or a `{{` all fail the build. The gate refuses rather than rewrites, so the
author learns what was wrong. `allowScriptsInSlots` in `brand.json` opts a
single named slot out for `<script>`/`<iframe>` — a third-party embed, named
per slot, in a reviewed commit.

A slot file matching no marker in the pages being built is an error, not a
no-op: silently ignoring it means the brand wonders why its content never
appeared.

### 3. Page overrides — the arrangement itself differs

`brands/<id>/pages/login.html` replaces the shared template for that one page.
Tokens and slots still apply to it, so an override is a starting point rather
than an exit from the system, and the other pages still come from the shared
templates. `tests/fixtures/brands/zeta.test` is a worked example: a completely
different login form, with no edit to `js/cms.js`.

## Editing a template

Every change here lands on every brand. Run the tests: `test_generator.js`
asserts JSK1's generated pages are still byte-identical to the Phase 0 golden
fixtures, so an accidental change to production output fails immediately.
