# Synthetic brands — tests only

Three fabricated brands used to prove the generator and the assembler
support genuine divergence between sites. They live here, **not** in
`brands/`, so that `node tools/build-site.js --list` can never show them and
nobody can mistake one for a real site. They are also not in `CMS_BRANDS`,
so the production registry holds only the two real brands.

| Brand | Proves |
|---|---|
| `acme.test` | a brand fills a **slot** — its own login-page notice, without touching any shared file |
| `zeta.test` | a brand **overrides a whole page** — a different login form arrangement entirely |
| `omega.test` | a brand ships a **`static/` overlay** — its own stylesheet and its own logo — and fills a slot on **both** the login and the register page. It is also deliberately absent from `CMS_BRANDS`, so the assembler's unregistered-brand warning has something real to fire on, and it ships no `pages/` override so the two mechanisms are tested apart |

Between them they cover every escalation level above plain token
substitution — slot, whole-page override, and static overlay — which is what
a future brand needs in order to differ from the others without an edit to
`js/cms.js` or to any shared template.

They are also the only brands the tests are free to break. Mutating a real
brand to see whether a test notices would mean editing a production site's
configuration; mutating these costs nothing.
