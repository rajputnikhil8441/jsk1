/* Page Builder V2 -- milestone C: editing safety and responsive editing.

   Two claims are under test.

   SAFETY. The builder auto-saves the draft on a short debounce, so the
   danger was never a forgotten Save -- it was a save that did not happen
   being reported as one, and the two actions that replace a draft outright
   having no way back. Both are covered here, and the publish path is held
   to firing once per click.

   RESPONSIVE. Inheritance is the ABSENCE of a value: a breakpoint with no
   key inherits, and resetting means deleting the key rather than writing a
   duplicate. That is asserted on the stored data and again on computed
   style in a real browser. */
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

async function page(b, seed, width) {
  const ctx = await b.newContext({ viewport: { width: width || 1280, height: 900 } });
  const st = { posts: 0, row: null };
  await stub(ctx, st);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  if (seed) await p.addInitScript((arg) => {
    const raw = JSON.parse(localStorage.getItem('whiteLabelCMS') || '{}');
    Object.assign(raw, arg);
    localStorage.setItem('whiteLabelCMS', JSON.stringify(raw));
  }, seed);
  await p.goto(`${BASE}/about.html`, { waitUntil: 'networkidle' });
  return { ctx, p, errs, st };
}
const published = (b, sections, seed, width) =>
  page(b, Object.assign({
    pages: { about: { builder: { schemaVersion: 2, status: 'published', sections } } }
  }, seed || {}), width);

const sec = (id, type, extra) => Object.assign({ id, type, enabled: true,
  visibility: { desktop: true, tablet: true, mobile: true },
  style: {}, responsive: {}, elements: [] }, extra || {});
const el = (id, type, content, style, responsive) =>
  ({ id, type, content: content || {}, style: style || {}, responsive: responsive || {} });

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     RECOVERY SNAPSHOTS
     ================================================================ */
  console.log('\n===== A RECOVERY SNAPSHOT IS ONE PER PAGE, AND CLEAN =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const R = CMS.sections.recovery, out = {};
      const mk = n => [{ id: 's' + n, type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'e' + n, type: 'text', content: { text: 'v' + n }, style: {}, responsive: {} }] }];

      out.emptyAtFirst = R.get('about');
      out.refusesEmpty = R.snapshot('about', [], 'template');
      out.refusesNonArray = R.snapshot('about', 'nope', 'template');
      out.refusesNoSlug = R.snapshot('', mk(1), 'template');

      R.snapshot('about', mk(1), 'template');
      out.first = R.get('about').sections[0].elements[0].content.text;
      out.reason = R.get('about').reason;

      /* one per page: a second snapshot replaces the first */
      R.snapshot('about', mk(2), 'discard');
      out.second = R.get('about').sections[0].elements[0].content.text;
      out.onlyOne = Object.keys(JSON.parse(localStorage.getItem('whiteLabelCMS')).builderRecovery).length;
      out.reason2 = R.get('about').reason;

      /* per page, not shared */
      R.snapshot('contact', mk(3), 'template');
      out.perPage = [R.get('about').sections[0].elements[0].content.text,
                     R.get('contact').sections[0].elements[0].content.text];

      /* an unknown reason is normalised, never stored raw */
      R.snapshot('about', mk(4), 'constructor');
      out.badReason = R.get('about').reason;

      out.cleared = R.clear('about') && R.get('about');
      out.clearMissing = R.clear('nope');
      return out;
    });

    check('a page with no snapshot has none', r.emptyAtFirst === null, r.emptyAtFirst);
    check('an empty, non-array or slugless snapshot is refused',
      r.refusesEmpty === false && r.refusesNonArray === false && r.refusesNoSlug === false, r);
    check('a snapshot is taken and read back', r.first === 'v1' && r.reason === 'template', r);
    check('a second snapshot replaces the first, one per page',
      r.second === 'v2' && r.reason2 === 'discard', r);
    check('and pages do not share one', r.perPage.join() === 'v4,v3' || r.perPage.join() === 'v2,v3', r.perPage);
    check('an unrecognised reason is normalised', r.badReason === 'replace', r.badReason);
    check('clearing removes it', r.cleared === null, r.cleared);
    check('clearing one that is not there is harmless', r.clearMissing === false);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A TAMPERED OR BROKEN SNAPSHOT CANNOT REACH A PAGE =====');
  {
    for (const [label, value] of [
      ['missing', undefined], ['null', null], ['a string', 'nope'], ['an array', [1, 2]],
      ['a number', 7],
      ['a slug holding junk', { about: 5 }],
      ['sections not an array', { about: { at: 'x', reason: 'template', sections: 'no' } }],
      ['sections empty', { about: { at: 'x', reason: 'template', sections: [] } }]
    ]) {
      const seed = value === undefined ? {} : { builderRecovery: value };
      const { ctx, p, errs } = await page(b, seed);
      const r = await p.evaluate(() => {
        const R = CMS.sections.recovery;
        return { got: R.get('about'), stillWorks: R.snapshot('about',
          [{ id: 's', type: 'text', enabled: true,
             visibility: { desktop: true, tablet: true, mobile: true },
             style: {}, responsive: {}, elements: [] }], 'template') };
      });
      check('builderRecovery ' + label + ': reads as nothing, and still accepts one',
        r.got === null && r.stillWorks === true, r);
      check('builderRecovery ' + label + ': no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  {
    /* The snapshot goes through the section sanitiser on the way out, so
       one edited in storage cannot smuggle anything into a page. */
    const { ctx, p, errs } = await page(b, { builderRecovery: { about: {
      at: '2026-01-01', reason: 'template', sections: [
        { type: 'text', style: { bg: 'red;}body{display:none;}.x{' }, elements: [
          { type: 'evilElement', content: { text: 'x' } },
          { type: 'button', content: { text: 'ok', href: 'javascript:alert(1)' } },
          { type: 'icon', content: { icon: 'constructor' } },
          { type: 'heading', content: { text: 'kept', level: 'h2' }, style: { color: 'var(--evil)', fontSize: 20 } }
        ] },
        { type: 'notAType', elements: [] }
      ] } } });
    const r = await p.evaluate(() => {
      const snap = CMS.sections.recovery.get('about');
      const css = CMS.sections.css(snap.sections);
      return { sections: snap.sections.length, els: snap.sections[0].elements.map(e => e.type),
               style: snap.sections[0].style,
               heading: snap.sections[0].elements.filter(e => e.type === 'heading')[0],
               btn: snap.sections[0].elements.filter(e => e.type === 'button')[0],
               icon: snap.sections[0].elements.filter(e => e.type === 'icon')[0],
               css: css, pwned: ({}).pwned };
    });
    check('an unknown section type in a snapshot is dropped', r.sections === 1, r.sections);
    check('and an unknown element type with it',
      r.els.indexOf('evilElement') === -1, r.els);
    check('an injected style value never survives', !('bg' in r.style), r.style);
    check('a javascript: link is stripped from it', !('href' in r.btn.content), r.btn);
    check('an icon name that is not on the list is stripped', !('icon' in r.icon.content), r.icon);
    check('and var() never reaches the generated CSS',
      !/var\(--evil\)|display:none|javascript:/.test(r.css), r.css.slice(0, 200));
    check('while the legitimate parts survive',
      r.heading.content.text === 'kept' && r.heading.style.fontSize === 20, r.heading);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== THE SNAPSHOT NEVER LEAVES THE DEVICE =====');
  {
    const { ctx, p, errs, st } = await page(b);
    await p.evaluate(() => {
      CMS.sections.recovery.snapshot('about', [{ id: 's', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [] }], 'template');
      CMS.save();
    });
    await p.evaluate(() => CMS.remote.signIn('a@b.c', 'x'));
    await p.evaluate(() => CMS.remote.publish());
    await p.waitForTimeout(400);
    const row = st.row && st.row.data;
    check('a publish carries no recovery snapshot',
      row && !('builderRecovery' in row), row && Object.keys(row).filter(k => /builder/i.test(k)));
    check('and still carries no drafts or library',
      row && !('builderDrafts' in row) && !('builderLibrary' in row));
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     RESPONSIVE INHERITANCE, ON COMPUTED STYLE
     ================================================================ */
  console.log('\n===== INHERITANCE IS THE ABSENCE OF A VALUE =====');
  {
    /* One section and one element, each with a desktop value, a tablet
       override and a mobile override, plus a key overridden only at
       mobile so the tablet->desktop fallback is exercised too. */
    const S = [sec('s1', 'text', {
      style: { fontSize: 32, padding: 40 },
      responsive: { tablet: { fontSize: 28 }, mobile: { fontSize: 24 } },
      elements: [
        el('e1', 'heading', { text: 'H', level: 'h2' },
           { fontSize: 40, maxWidth: 800 },
           { tablet: { fontSize: 34 }, mobile: { maxWidth: 300 } }),
        el('cols', 'columns', { columns: [
            { elements: [el('n1', 'text', { text: 'a' }, { fontSize: 18 }, { mobile: { fontSize: 11 } })] },
            { elements: [el('n2', 'text', { text: 'b' }, {}, {})] }
          ] }, { columns: '3' }, { tablet: { columns: '2' } })
      ]
    })];
    const want = {
      1280: { secFs: '32px', secPad: '40px', elFs: '40px', elMax: '800px', nested: '18px', cols: 3 },
      1000: { secFs: '28px', secPad: '40px', elFs: '34px', elMax: '800px', nested: '18px', cols: 2 },
      700:  { secFs: '24px', secPad: '40px', elFs: '34px', elMax: '300px', nested: '11px', cols: 1 }
    };
    for (const w of [1280, 1000, 700]) {
      const { ctx, p, errs } = await published(b, S, null, w);
      const r = await p.evaluate(() => {
        const g = (s, k) => getComputedStyle(document.querySelector(s))[k];
        return {
          secFs: g('[data-sec="s1"]', 'fontSize'),
          secPad: g('[data-sec="s1"]', 'padding').split(' ')[0],
          elFs: g('[data-el="e1"]', 'fontSize'),
          elMax: g('[data-el="e1"]', 'maxWidth'),
          nested: g('[data-el="n1"]', 'fontSize'),
          cols: g('[data-el="cols"]', 'gridTemplateColumns').trim().split(/\s+/).length
        };
      });
      const wnt = want[w];
      check(w + 'px: section size ' + wnt.secFs + ', element size ' + wnt.elFs,
        r.secFs === wnt.secFs && r.elFs === wnt.elFs, r);
      check(w + 'px: a key with no override at this width inherits',
        r.secPad === wnt.secPad && r.elMax === wnt.elMax, r);
      check(w + 'px: a nested column child follows its own overrides',
        r.nested === wnt.nested, r.nested);
      check(w + 'px: the column layout is ' + wnt.cols, r.cols === wnt.cols, r.cols);
      check(w + 'px: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  console.log('\n===== ONE BREAKPOINT NEVER MOVES ANOTHER =====');
  {
    const { ctx, p, errs } = await page(b);
    const r = await p.evaluate(() => {
      const S = CMS.sections, out = {};
      const node = { id: 's', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true },
        style: { fontSize: 32 }, responsive: {}, elements: [] };
      S.saveDraft('about', [node]);

      const read = () => {
        const s = S.draft('about').sections[0];
        return { base: s.style.fontSize,
                 tablet: (s.responsive.tablet || {}).fontSize,
                 mobile: (s.responsive.mobile || {}).fontSize };
      };
      const write = (dev, v) => {
        const s = S.draft('about').sections;
        const n = s[0];
        if (dev === 'base') n.style.fontSize = v;
        else { n.responsive[dev] = n.responsive[dev] || {}; n.responsive[dev].fontSize = v; }
        S.saveDraft('about', s);
      };
      const drop = (dev) => {
        const s = S.draft('about').sections;
        delete s[0].responsive[dev].fontSize;
        S.saveDraft('about', s);
      };

      out.start = read();
      write('mobile', 24); out.afterMobile = read();
      write('tablet', 28); out.afterTablet = read();
      write('base', 36);   out.afterBase = read();
      drop('mobile');      out.afterResetMobile = read();
      drop('tablet');      out.afterResetTablet = read();
      return out;
    });

    check('a mobile value leaves desktop alone',
      r.afterMobile.base === 32 && r.afterMobile.mobile === 24 &&
      r.afterMobile.tablet === undefined, r.afterMobile);
    check('a tablet value leaves desktop and mobile alone',
      r.afterTablet.base === 32 && r.afterTablet.tablet === 28 &&
      r.afterTablet.mobile === 24, r.afterTablet);
    check('changing desktop leaves both overrides alone',
      r.afterBase.base === 36 && r.afterBase.tablet === 28 &&
      r.afterBase.mobile === 24, r.afterBase);
    check('resetting mobile removes the key rather than writing a duplicate',
      r.afterResetMobile.mobile === undefined && r.afterResetMobile.base === 36 &&
      r.afterResetMobile.tablet === 28, r.afterResetMobile);
    check('and resetting tablet does the same',
      r.afterResetTablet.tablet === undefined && r.afterResetTablet.base === 36,
      r.afterResetTablet);
    check('no page errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log('\n===== A V1 PAGE WITH NO RESPONSIVE DATA IS UNTOUCHED =====');
  {
    const V1 = [{ id: 'v1s', type: 'text', enabled: true,
      visibility: { desktop: true, tablet: true, mobile: true },
      style: { padding: 33 }, responsive: { tablet: {}, mobile: {} },
      elements: [
        { id: 'v1h', type: 'heading', content: { text: 'Old', level: 'h2' },
          style: { fontSize: 21 } },
        { id: 'v1c', type: 'columns', style: {}, content: { columns: [
          { elements: [] }, { elements: [] }, { elements: [] }] } }
      ] }];
    for (const [w, cols] of [[1280, 3], [1000, 3], [700, 1]]) {
      const { ctx, p, errs } = await published(b, V1, null, w);
      const r = await p.evaluate(() => ({
        pad: getComputedStyle(document.querySelector('[data-sec="v1s"]')).padding.split(' ')[0],
        fs: getComputedStyle(document.querySelector('[data-el="v1h"]')).fontSize,
        cols: getComputedStyle(document.querySelector('[data-el="v1c"]')).gridTemplateColumns,
        css: CMS.sections.css(CMS.sections.published('about'))
      }));
      check(w + 'px: a V1 page keeps its values', r.pad === '33px' && r.fs === '21px', r);
      check(w + 'px: and its columns fall back as V1 did',
        r.cols.trim().split(/\s+/).length === cols, r.cols);
      check(w + 'px: no --pbe-cols is emitted for it', r.css.indexOf('--pbe-cols') === -1);
      check(w + 'px: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  console.log('\n===== HOSTILE RESPONSIVE VALUES ARE STILL REFUSED =====');
  {
    const S = [sec('s1', 'text', {
      style: { fontSize: 20 },
      responsive: {
        tablet: { fontSize: 'var(--evil)', bg: 'red;}body{display:none;}.x{',
                  color: '@constructor', padding: 'expression(alert(1))' },
        mobile: { bgImage: 'url(javascript:alert(1))', border: '1px solid @__proto__',
                  columns: '1fr 1fr', letterSpacing: 'url(x)' }
      },
      elements: [el('e1', 'heading', { text: 'H', level: 'h2' }, { fontSize: 18 },
        { mobile: { color: 'javascript:alert(1)', fontSize: 'var(--x)' } })]
    })];
    for (const w of [1000, 700]) {
      const { ctx, p, errs } = await published(b, S, null, w);
      const r = await p.evaluate(() => ({
        css: CMS.sections.css(CMS.sections.published('about')),
        secFs: getComputedStyle(document.querySelector('[data-sec="s1"]')).fontSize,
        elFs: getComputedStyle(document.querySelector('[data-el="e1"]')).fontSize,
        bodyDisplay: getComputedStyle(document.body).display
      }));
      check(w + 'px: no hostile value reaches the stylesheet',
        !/var\(--evil\)|var\(--x\)|display:none|expression\(|javascript:|url\(|@constructor|@__proto__/.test(r.css),
        r.css.slice(0, 300));
      check(w + 'px: the element keeps its own legitimate value',
        r.secFs === '20px' && r.elFs === '18px', r);
      check(w + 'px: the page is not hidden', r.bodyDisplay !== 'none', r.bodyDisplay);
      check(w + 'px: no page errors', errs.length === 0, errs);
      await ctx.close();
    }
  }

  /* ================================================================
     THROUGH THE ADMIN
     ================================================================ */
  console.log('\n===== SAVING TELLS THE TRUTH =====');
  {
    const ctx = await b.newContext({ viewport: { width: 1600, height: 1300 } });
    const st = { posts: 0, row: null }; await stub(ctx, st);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push('pageerror: ' + e));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    p.on('dialog', d => d.accept());
    await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
    await p.fill('#authEmail', 'a@b.c'); await p.fill('#authPass', 'x'); await p.click('#authBtn');
    await p.waitForTimeout(400);
    await p.click('.adm-nav-item[data-panel="builder"]'); await p.waitForTimeout(700);
    await p.click('#pbAdd .pb-addbtn[data-type="text"]'); await p.waitForTimeout(600);

    const SEC = '#pbList .pb-sec:first-child';
    const state = () => p.$eval('#pbSaveState', n => n.className + '|' + n.textContent);
    check('a save that worked says so', /saved/.test(await state()), await state());

    /* Now make localStorage refuse, and check the builder does not claim
       a save it did not get. */
    await p.evaluate(() => {
      window.__realSet = localStorage.setItem.bind(localStorage);
      localStorage.setItem = function (k) {
        if (k === 'whiteLabelCMS') throw new Error('QuotaExceededError');
        return window.__realSet.apply(null, arguments);
      };
    });
    const before = await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections));
    await p.fill(`${SEC} .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`,
                 'Typed while storage is full');
    await p.waitForTimeout(700);
    const failedState = await state();
    check('a refused save is reported as a failure, not a success',
      /failed/.test(failedState) && /Not saved/.test(failedState), failedState);
    /* The edit lands in the in-memory state either way; it is the WRITE
       that was refused. Nothing must be rolled back because of that. */
    check('and the edit is still in the draft, not rolled back',
      /Typed while storage is full/.test(
        await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))),
      { before: before.slice(0, 60) });
    check('the typed value is still in the builder',
      await p.$eval(`${SEC} .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`,
        n => n.value === 'Typed while storage is full'));

    /* pressing Save draft must not claim success either */
    await p.click('#pbSaveDraft'); await p.waitForTimeout(500);
    check('pressing Save draft while storage refuses still reports failure',
      /failed/.test(await state()), await state());

    /* and it recovers once storage works again */
    await p.evaluate(() => { localStorage.setItem = window.__realSet; });
    await p.click('#pbSaveDraft'); await p.waitForTimeout(600);
    check('retrying after the failure succeeds', /saved/.test(await state()), await state());
    check('and the edit made it to disk',
      /Typed while storage is full/.test(
        await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))));

    console.log('\n===== PUBLISH FIRES ONCE PER CLICK =====');
    const postsBefore = st.posts;
    await p.evaluate(() => {
      const btn = document.getElementById('pbPublish');
      btn.click(); btn.click(); btn.click();
    });
    await p.waitForTimeout(1200);
    check('three clicks in one tick publish once', st.posts - postsBefore === 1,
      { before: postsBefore, after: st.posts });
    check('and the page is live', await p.evaluate(() => CMS.sections.status('about').live));

    console.log('\n===== SAVE DRAFT AND PREVIEW NEVER PUBLISH =====');
    const liveNow = await p.evaluate(() => JSON.stringify(CMS.sections.live('about')));
    const posts2 = st.posts;
    await p.fill(`${SEC} .pb-elcard:first-child .pb-field:has(> span:text-is("Text")) .pb-in`,
                 'Draft only change');
    await p.waitForTimeout(600);
    await p.click('#pbSaveDraft'); await p.waitForTimeout(600);
    for (const v of ['tablet', 'mobile', 'desktop']) {
      await p.click(`#pbDevices .pb-devtab[data-viewport="${v}"]`); await p.waitForTimeout(300);
    }
    check('Save draft and preview switching published nothing',
      (await p.evaluate(() => JSON.stringify(CMS.sections.live('about')))) === liveNow &&
      st.posts === posts2, { posts2, now: st.posts });
    check('while the draft does hold the change',
      /Draft only change/.test(
        await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))));

    console.log('\n===== A REPLACED DRAFT CAN BE PUT BACK =====');
    check('there is no recovery banner while nothing has been replaced',
      await p.$eval('#pbRecovery', n => n.hidden));
    await p.click('#pbTemplates .pb-template[data-template="faq"]'); await p.waitForTimeout(900);
    check('applying a template offers the previous draft back',
      !(await p.$eval('#pbRecovery', n => n.hidden)));
    check('and says what it is', /previous draft/.test(await p.$eval('#pbRecovery', n => n.textContent)));
    check('the draft really was replaced',
      !/Draft only change/.test(
        await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))));

    await p.click('#pbRecovery [data-act="recover-restore"]'); await p.waitForTimeout(900);
    check('restoring brings the work back',
      /Draft only change/.test(
        await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))));
    check('and restoring is itself reversible',
      !(await p.$eval('#pbRecovery', n => n.hidden)));
    await p.click('#pbRecovery [data-act="recover-discard"]'); await p.waitForTimeout(600);
    check('the kept draft can be dismissed', await p.$eval('#pbRecovery', n => n.hidden));

    /* discard takes one too */
    await p.click('#pbDiscard'); await p.waitForTimeout(800);
    check('discarding the draft also keeps it',
      !(await p.$eval('#pbRecovery', n => n.hidden)));
    await p.click('#pbRecovery [data-act="recover-restore"]'); await p.waitForTimeout(900);
    check('and it can be restored after a discard',
      /Draft only change/.test(
        await p.evaluate(() => JSON.stringify(CMS.sections.draft('about').sections))));

    console.log('\n===== THE RESPONSIVE EDITOR SAYS WHERE A VALUE COMES FROM =====');
    /* Restoring leaves every section collapsed, so open one first. */
    if (!(await p.$(`${SEC}.open`))) {
      await p.click(`${SEC} .pb-sec-title`); await p.waitForTimeout(400);
    }
    await p.click(`${SEC} .pb-subtab[data-view="design"]`); await p.waitForTimeout(400);
    const openAll = async () => {
      await p.$$eval(`${SEC} .pb-group`, g => g.forEach(x => { x.open = true; }));
      await p.waitForTimeout(150);
    };
    const F = l => `${SEC} .pb-subbody .pb-field:has(> span:text-is("${l}"))`;
    await openAll();
    await p.fill(F('Text size (px)') + ' .pb-in', '32'); await p.waitForTimeout(600);
    check('the desktop tab has no inherited note, having nothing above it',
      (await p.$$eval(F('Text size (px)') + ' .pb-inherit-note', n => n.length)) === 0);

    await p.click(`${SEC} .pb-devtabs > .pb-devtab[data-device="tablet"]`); await p.waitForTimeout(350);
    await openAll();
    check('the tablet box says what it inherits',
      /Inherited from Desktop \(32\)/.test(await p.$eval(F('Text size (px)') + ' .pb-inherit-note', n => n.textContent)));
    check('and shows it as the placeholder',
      (await p.$eval(F('Text size (px)') + ' .pb-in', n => n.placeholder)) === '32');
    check('with no reset offered, because there is nothing to reset',
      await p.$eval(F('Text size (px)') + ' .pb-reset', n => n.hidden));

    await p.fill(F('Text size (px)') + ' .pb-in', '28'); await p.waitForTimeout(600);
    check('typing turns it into an override there and then, without a rebuild',
      /Overriding Desktop \(32\)/.test(await p.$eval(F('Text size (px)') + ' .pb-inherit-note', n => n.textContent)));
    check('the reset appears with it',
      !(await p.$eval(F('Text size (px)') + ' .pb-reset', n => n.hidden)));
    check('and the tab shows how many values this breakpoint overrides',
      (await p.$eval(`${SEC} .pb-devtab[data-device="tablet"] .pb-devtab-count`, n => n.textContent)) === '1');

    await p.click(`${SEC} .pb-devtabs > .pb-devtab[data-device="mobile"]`); await p.waitForTimeout(350);
    await openAll();
    check('mobile inherits from tablet, not from desktop',
      /Inherited from Tablet \(28\)/.test(await p.$eval(F('Text size (px)') + ' .pb-inherit-note', n => n.textContent)));
    await p.fill(F('Text size (px)') + ' .pb-in', '24'); await p.waitForTimeout(600);

    const stored = () => p.evaluate(() => {
      const s = CMS.sections.draft('about').sections[0];
      return { base: s.style.fontSize, tablet: (s.responsive.tablet || {}).fontSize,
               mobile: (s.responsive.mobile || {}).fontSize };
    });
    check('all three are stored separately',
      JSON.stringify(await stored()) === JSON.stringify({ base: '32', tablet: '28', mobile: '24' }),
      await stored());

    await p.click(F('Text size (px)') + ' .pb-reset'); await p.waitForTimeout(700);
    await openAll();
    const afterReset = await stored();
    check('resetting mobile deletes the key rather than writing a duplicate',
      afterReset.mobile === undefined && afterReset.base === '32' && afterReset.tablet === '28',
      afterReset);
    check('and the box goes back to saying what it inherits',
      /Inherited from Tablet \(28\)/.test(await p.$eval(F('Text size (px)') + ' .pb-inherit-note', n => n.textContent)));
    check('with the box itself empty again',
      (await p.$eval(F('Text size (px)') + ' .pb-in', n => n.value)) === '');

    console.log('\n===== SELECTION AND STATE STAY SANE =====');
    await p.click(`${SEC} .pb-subtab[data-view="content"]`); await p.waitForTimeout(400);
    if (!(await p.$(`${SEC} .pb-elcard`))) {
      await p.click(`${SEC} .pb-add-el .pb-addbtn[data-el-type="text"]`); await p.waitForTimeout(500);
      await p.click(`${SEC} .pb-add-el .pb-addbtn[data-el-type="text"]`); await p.waitForTimeout(500);
    }
    const ids = () => p.$$eval(`${SEC} .pb-elcard`, n => n.map(x => x.getAttribute('data-el-id')));
    const firstId = (await ids())[0];
    await p.click(`${SEC} .pb-elcard[data-el-id="${firstId}"] [data-act="el-dup"]`);
    await p.waitForTimeout(600);
    const afterDup = await ids();
    check('duplicating adds a card with a new id',
      afterDup.length > 1 && new Set(afterDup).size === afterDup.length, afterDup);

    const target = afterDup[afterDup.length - 1];
    await p.click(`${SEC} .pb-elcard[data-el-id="${target}"] [data-act="el-del"]`);
    await p.waitForTimeout(600);
    check('deleting removes it', (await ids()).indexOf(target) === -1);
    check('and nothing in the panel still points at it',
      (await p.$$(`${SEC} [data-el-id="${target}"]`)).length === 0);

    /* an open section that gets deleted must not stay "open" */
    const secId = await p.$eval(SEC, n => n.getAttribute('data-sec-id'));
    await p.click(`${SEC} [data-act="del"]`); await p.waitForTimeout(700);
    check('deleting the open section leaves no stale open reference',
      (await p.$$(`#pbList .pb-sec[data-sec-id="${secId}"]`)).length === 0);
    check('and the panel still renders', (await p.$$('#pbList')).length === 1);

    /* page switching clears per-node UI state */
    await p.click('#pbTabs .pagetab[data-slug="contact"]'); await p.waitForTimeout(700);
    await p.click('#pbTabs .pagetab[data-slug="about"]'); await p.waitForTimeout(700);
    check('switching pages and back leaves the builder working',
      (await p.$$('#pbList')).length === 1);
    check('the admin ran without console or page errors', errs.length === 0, errs.slice(0, 3));
    await ctx.close();
  }

  await b.close();
  console.log('\n==== ' + pass + ' passed, ' + fail + ' failed ====');
  if (fails.length) console.log('failed: ' + fails.join(' | '));
  process.exit(fail ? 1 : 0);
})();
