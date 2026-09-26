# Synthetic brands — tests only

Two fabricated brands used to prove the generator supports genuine
divergence between sites. They live here, **not** in `brands/`, so that
`node tools/build-brand.js --list` can never show them and nobody can
mistake one for a real site. They are also not in `CMS_BRANDS`, so the
production registry still has exactly one entry.

| Brand | Proves |
|---|---|
| `acme.test` | a brand fills a **slot** — its own login-page notice, without touching any shared file |
| `zeta.test` | a brand **overrides a whole page** — a different login form arrangement entirely |

Between them they cover the two escalation levels above plain token
substitution, which is what requirement 3 of Phase 4 is about: a future
brand needing a different login page must not require an edit to
`js/cms.js`.
