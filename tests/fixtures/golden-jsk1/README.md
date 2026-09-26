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
