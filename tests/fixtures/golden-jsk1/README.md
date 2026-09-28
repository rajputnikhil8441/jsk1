# Golden fixtures — JSK1 as production serves it today

These are byte-for-byte copies of the eleven files that define what a
visitor and a crawler receive from **jsk-1.com** right now. They were
extracted from the production commit, not from a working tree:

    source commit: 615432cb45a04bf4288259271649064e6ef2bb4a
    extracted with: git cat-file blob <commit>:<path>
    captured: 2026-09-26 (UTC)

## Why they exist

The multi-brand work replaces these eleven hand-maintained files with
generated output (`tools/build-brand.js` → `sites/jsk1/`). That is only
safe if the generator can be *proved* to reproduce them exactly. These
fixtures are that proof, and they are captured **before** any generator
exists so they cannot be quietly shaped to match one.

The rule they enforce: **JSK1's bytes do not change.** A generator that
produces a "better" page still fails. Any intentional change to JSK1 must
be a separate, reviewed commit that updates a fixture on purpose and says
why in its message — never a side effect of the multi-brand refactor.

## What is covered, and what is not

Covered: the eight static pages, the published brand fallback
(`js/brand.js`), and the two crawler files (`sitemap.xml`, `robots.txt`).

Not covered, deliberately: `js/cms.js`, `js/admin*.js`, `css/` and
`assets/` are shared engine and are expected to change — they are guarded
by the existing 3,707-assertion suite instead. `js/cms-config.js` is not
here either: it is per-brand configuration and is expected to change shape.

## Verifying

    cd tests/fixtures/golden-jsk1 && sha256sum -c SHA256SUMS

Comparing a candidate generator's output against production:

    for f in $(cut -c67- SHA256SUMS); do cmp "$f" "../../../sites/jsk1/$f"; done

## Updating

Only when JSK1 is intentionally changed, in its own commit, with the
reason stated. Never as part of making a refactor pass.

### Change log

**Phase 3 — `js/brand.js` re-captured.** Phase 3 moved JSK1's content out
of `js/cms.js` DEFAULTS, where every brand inherited it, and into
`js/brand.js`, which is JSK1's own file. So this one fixture grew from
1,415 to 9,121 bytes on purpose, and Phase 4's generator must reproduce
the NEW file rather than the old one. The other ten are untouched and
still byte-identical to the live files.

Because the bytes of `js/brand.js` legitimately moved, its checksum could
not be the baseline for that step. The stronger guarantee was used
instead and is kept alongside these fixtures:
`../render-baseline-jsk1.json` records every observable value on every
page -- title, description, canonical, og, twitter, headings, body text,
footer, JSON-LD -- rendered with an EMPTY Supabase row, which is exactly
the case where DEFAULTS and `brand.js` decide what a visitor sees. All
152 of those values were unchanged by Phase 3, and `test_brand_isolation.js`
asserts it on every run. That is the check that actually protects JSK1;
a file hash only protects the file.
