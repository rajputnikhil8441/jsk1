/* Page Builder V2.
   Feature tests for everything V2 adds. V1 behaviour is guarded separately by
   test_pagebuilder_compat.js (a frozen payload and the render it produced
   before V2 existed) and by test_pagebuilder.js (the V1 feature suite); both
   must keep passing untouched.

   Style questions are asserted on computed style in a real browser, never on
   the generated CSS text alone: a control that emits a property but loses the
   cascade looks fine in the CSS and does nothing on the page. */
const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);
let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

const stub = (target, state) => target.route('**supabase.co/**', route => {
  const q = route.request();
  if (q.url().includes('/auth/v1/token'))
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"access_token":"stub"}' });
  if (q.method() === 'POST') {
    state.posts++; state.row = JSON.parse(q.postData() || '{}');
    return route.fulfill({ status: 201, body: '' });
  }
  return route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(state.row ? [{ data: state.row.data, updated_at: state.row.updated_at }] : []) });
});

/* Opens about.html with `block` stored verbatim as the published builder
   block, so a test can hand over any schema shape it likes. */
async function pageWith(b, block, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.addInitScript((bl) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    raw.pages = raw.pages || {};
    raw.pages.about = Object.assign({}, raw.pages.about, { builder: bl });
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, block);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true, elements: [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     SCHEMA VERSIONING
     ================================================================ */
  console.log('\n===== SCHEMA VERSION IS A MARKER, NOT A GATE =====');
  {
    const V1BLOCK = { schemaVersion: 1, status: 'published', updatedAt: '2026-09-20',
      sections: [sec('s1', 'text', { elements: [el('e1', 'heading', { text: 'v1 content' }, { color: '#ff0000' })] })] };
    const { ctx, p, errs } = await pageWith(b, V1BLOCK);

    check('CMS reports schema 2', (await p.evaluate(() => CMS.sections.schema)) === 2,
      await p.evaluate(() => CMS.sections.schema));

    const r = await p.evaluate(() => ({
      rendered: document.querySelectorAll('.pb-section').length,
      colour: getComputedStyle(document.querySelector('[data-el="e1"]')).color,
      storedVersion: JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion
    }));
    check('a schemaVersion 1 block still renders', r.rendered === 1, r.rendered);
    check('and its styling still applies', r.colour === 'rgb(255, 0, 0)', r.colour);
    check('reading it does not rewrite the stored version', r.storedVersion === 1, r.storedVersion);

    /* tolerance in both directions */
    const tol = await p.evaluate(() => {
      const put = (blk) => {
        const raw = JSON.parse(localStorage.getItem('whiteLabelCMS'));
        raw.pages.about.builder = blk;
        localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
        CMS.reload();
        return (CMS.sections.published('about') || []).length;
      };
      const base = { status: 'published',
        sections: [{ id: 's1', type: 'text', enabled: true,
          elements: [{ id: 'e1', type: 'heading', content: { text: 'x' } }] }] };
      return {
        noVersion: put(Object.assign({}, base)),
        v1: put(Object.assign({ schemaVersion: 1 }, base)),
        v2: put(Object.assign({ schemaVersion: 2 }, base)),
        future: put(Object.assign({ schemaVersion: 99 }, base)),
        garbage: put(Object.assign({ schemaVersion: 'nonsense' }, base))
      };
    });
    check('a block with no schemaVersion renders', tol.noVersion === 1, tol.noVersion);
    check('a schemaVersion 1 block renders', tol.v1 === 1, tol.v1);
    check('a schemaVersion 2 block renders', tol.v2 === 1, tol.v2);
    check('a block from a FUTURE schema still renders', tol.future === 1, tol.future);
    check('a block with a nonsense version still renders', tol.garbage === 1, tol.garbage);

    const so = await p.evaluate(() => ({
      absent: CMS.sections.schemaOf({}),
      zero: CMS.sections.schemaOf({ schemaVersion: 0 }),
      neg: CMS.sections.schemaOf({ schemaVersion: -3 }),
      str: CMS.sections.schemaOf({ schemaVersion: '2' }),
      three: CMS.sections.schemaOf({ schemaVersion: 3 }),
      nul: CMS.sections.schemaOf(null)
    }));
    check('schemaOf treats a missing version as 1', so.absent === 1, so.absent);
    check('schemaOf treats 0 and negatives as 1', so.zero === 1 && so.neg === 1, so);
    check('schemaOf treats a string version as 1', so.str === 1, so.str);
    check('schemaOf passes a real newer version through', so.three === 3, so.three);
    check('schemaOf survives null', so.nul === 1, so.nul);

    const up = await p.evaluate(() => {
      const input = [{ id: 's1', type: 'text', enabled: true,
        elements: [{ id: 'e1', type: 'heading', content: { text: 'x' }, style: { color: '#123456' } }] }];
      const before = JSON.stringify(input);
      const out1 = CMS.sections.upgrade(input, 1);
      const out2 = CMS.sections.upgrade(input, 2);
      return {
        identical: JSON.stringify(out1) === before,
        notMutated: JSON.stringify(input) === before,
        sameRefFrom1: out1 === input,
        sameRefFrom2: out2 === input,
        badInput: CMS.sections.upgrade(null, 1),
        stringInput: CMS.sections.upgrade('nope', 1)
      };
    });
    check('upgrading V1 sections changes nothing yet', up.identical, up);
    check('upgrading does not mutate its input', up.notMutated, up);
    check('upgrading already-current data costs no copy', up.sameRefFrom2, up);
    check('the 1->2 step is identity, so no copy there either', up.sameRefFrom1, up);
    check('upgrade survives a non-array', up.badInput === null && up.stringInput === 'nope', up);
    check('no page errors across schema handling', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  console.log('\n===== NEW WRITES STAMP THE CURRENT SCHEMA =====');
  {
    const { ctx, p, errs } = await pageWith(b, { schemaVersion: 1, status: 'published',
      sections: [sec('s1', 'text', { elements: [el('e1', 'heading', { text: 'old' })] })] });
    const r = await p.evaluate(() => {
      const out = {};
      CMS.sections.saveDraft('about', [{ id: 'n1', type: 'text', enabled: true, elements: [] }]);
      out.draftStamp = JSON.parse(localStorage.getItem('whiteLabelCMS')).builderDrafts.about.schemaVersion;
      out.publishedStillOld = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion;
      CMS.sections.publish('about');
      out.publishStamp = JSON.parse(localStorage.getItem('whiteLabelCMS')).pages.about.builder.schemaVersion;
      out.draftBlockVersion = CMS.sections.draft('about').schemaVersion;
      return out;
    });
    check('saving a draft stamps schema 2', r.draftStamp === 2, r.draftStamp);
    check('a draft save leaves the published version alone', r.publishedStillOld === 1, r.publishedStillOld);
    check('publishing stamps schema 2', r.publishStamp === 2, r.publishStamp);
    check('the working copy reports the current schema', r.draftBlockVersion === 2, r.draftBlockVersion);
    check('no page errors while stamping', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
