/* PUBLISHING — ONE DOOR TO THE SERVER, AND IT TELLS THE TRUTH.

   THE CLAIM. Exactly one action in /admin writes to Supabase, and it says
   "Published" only when the row has been written AND read back. Everything
   else -- typing, autosave, a Page Builder draft, an import, a media upload,
   switching panels -- stays on this device.

   WHY EACH TEST HERE EXISTS. Every one of them corresponds to a way the old
   admin lied:

     - commit(true) vs commit() was one boolean at twenty call sites, so a
       draft save and a publish were the same function.
     - markSaved() ran BEFORE the network call, so the flag read "Saved"
       whether or not the publish landed.
     - a 2xx status was the whole proof of publication.
     - a failed publish reported itself in a toast that vanished after 2.6
       seconds, leaving the admin claiming to be saved.

   THE TIMESTAMP TEST IS NOT DECORATION. We send an ISO string with
   milliseconds and a Z; Postgres returns a timestamptz its own way, with an
   offset. Those are the same instant and different strings, so comparing the
   strings would report every successful publish as a failure. There is a
   test for the exact format Postgres uses.

   NOTHING HERE TOUCHES A REAL SERVER. Every Supabase call is stubbed, and the
   stub is the thing under test as much as the CMS is: it echoes back the
   timestamp it was sent, in Postgres's format, because that is what the real
   server does. */

const { chromium } = require('playwright');
const BASE = process.env.TEST_BASE || 'http://localhost:' + (process.env.TEST_PORT || 8777);

let pass = 0, fail = 0; const fails = [];
const check = (n, c, e) => { c ? (pass++, console.log('  PASS  ' + n))
  : (fail++, fails.push(n), console.log('  FAIL  ' + n + (e !== undefined ? ' -> ' + JSON.stringify(e) : ''))); };

/* Postgres renders a timestamptz with an offset and without trailing zero
   milliseconds. This is deliberately NOT the string we send. */
function asPostgres(iso) {
  return new Date(iso).toISOString().replace(/\.000Z$/, '+00:00').replace(/Z$/, '+00:00');
}

/* One session, with the server behaving the way a test asks it to.

   mode:
     'ok'         accepted, and the row reads back as what we sent
     'noconfirm'  accepted, but the row cannot be read back
     'mismatch'   accepted, but the row holds a different timestamp
     'httpfail'   refused outright
   signIn: whether to sign in (false exercises the not-signed-in refusal) */
async function session(b, mode, opts) {
  opts = opts || {};
  const stats = { posts: [], getsAfterPost: 0, authCalls: 0 };
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  let stored = null;

  await ctx.route('**supabase.co/**', route => {
    const q = route.request();
    if (q.url().includes('/auth/v1/token')) {
      stats.authCalls++;
      return route.fulfill({ status: 200, contentType: 'application/json',
                             body: JSON.stringify({ access_token: 'test-token' }) });
    }
    if (q.method() === 'POST') {
      const body = JSON.parse(q.postData() || '{}');
      stats.posts.push(body);
      if (mode === 'httpfail') {
        return route.fulfill({ status: 500, contentType: 'text/plain',
                               body: 'internal error from the stub' });
      }
      stored = body;
      return route.fulfill({ status: 201, body: '' });
    }
    /* A GET. Before any POST this is the page-load pull; after one it is the
       read-back, which is what most of this file is about. */
    if (stats.posts.length) stats.getsAfterPost++;
    if (!stored || mode === 'noconfirm') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    const stamp = mode === 'mismatch'
      ? asPostgres(new Date(Date.parse(stored.updated_at) + 60000).toISOString())
      : asPostgres(stored.updated_at);
    return route.fulfill({ status: 200, contentType: 'application/json',
                           body: JSON.stringify([{ data: stored.data, updated_at: stamp }]) });
  });

  const p = await ctx.newPage();
  const errs = [];
  /* Several of these actions confirm first -- applying a palette, discarding a
     draft, unpublishing. Playwright DISMISSES dialogs unless told otherwise,
     which silently turns those clicks into no-ops and would make any check
     after them vacuous. Accept, as the other suites here do. */
  p.on('dialog', d => d.accept());
  p.on('pageerror', e => errs.push('pageerror: ' + e));
  p.on('console', m => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text());
  });
  await p.goto(`${BASE}/admin/index.html`, { waitUntil: 'networkidle' });
  if (opts.signIn !== false) {
    await p.fill('#authEmail', 'a@b.c');
    await p.fill('#authPass', 'x');
    await p.click('#authBtn');
    await p.waitForTimeout(500);
  }
  return { ctx, p, stats, errs };
}

const pubState = p => p.getAttribute('#pubState', 'data-pubstate');

/* Review & Publish is two steps by design: open the sheet, then confirm. This
   is the whole journey, for the tests that are about what happens after. */
async function publishNow(p) {
  await p.click('#btnReview');
  await p.waitForTimeout(500);
  if (!(await p.$eval('#pubModal', m => m.hidden))) {
    await p.click('#pubConfirm');
  }
  await p.waitForTimeout(1500);
}

/* Make one brand-level change that is unambiguous and cheap to assert. */
async function editFooterCopyright(p) {
  await p.click('.adm-nav-item[data-panel="footer"]');
  await p.waitForTimeout(400);
  await p.evaluate(() => {
    window.CMS.data().footer.copyright = 'EDITED BY THE PUBLISHING TEST';
    /* Through the admin's own dirty path, not a direct paint, so the state
       machine is what is being exercised. */
    window.ADMIN_REFRESH && window.ADMIN_REFRESH();
  });
  /* And a real keystroke, so the test does not depend on the shortcut above. */
  const ta = await p.$('#panel-footer textarea, #panel-footer input[type=text]');
  if (ta) { await ta.click(); await ta.type(' x'); }
  await p.waitForTimeout(500);
}

/* A page's Content area: Pages, the page, then Content. The page has to be
   selected FIRST -- the Content tab is disabled for a page with no content
   mount, and the panel opens on the first page in the list. */
async function openPageContent(p, slug) {
  await p.click('.adm-nav-item[data-panel="pages"]');
  await p.waitForTimeout(500);
  await p.click(`#pageTabs .pagetab[data-page-key="${slug}"]`);
  await p.waitForTimeout(350);
  await p.click('#pageSubtabContent');
  await p.waitForTimeout(600);
}

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  /* ================================================================
     A. A LOCAL EDIT REACHES NO SERVER
     ================================================================ */
  console.log('\n===== A. Local edits stay local =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');
    check('signed in through the stub', stats.authCalls === 1, stats.authCalls);
    check('a fresh session reports nothing to publish',
          (await pubState(p)) === 'clean', await p.textContent('#pubState'));

    await editFooterCopyright(p);
    check('editing marks unpublished changes', (await pubState(p)) === 'local',
          await p.textContent('#pubState'));
    check('editing wrote NOTHING to the server', stats.posts.length === 0, stats.posts.length);
    check('an unsaved edit says so', /unsaved/i.test(await p.textContent('#savedFlag')),
          await p.textContent('#savedFlag'));

    /* Applying a colour preset USED TO PUBLISH THE WHOLE RECORD the moment it
       was clicked -- one of the hidden publishing paths this work closes. It
       must now be a local change like any other. */
    await p.click('.adm-nav-item[data-panel="presets"]');
    await p.waitForTimeout(400);
    /* Locators, not element handles: the panel is rebuilt by refreshAll(), so
       a handle captured earlier can be detached by the time it is clicked --
       which clicks nothing and would make this check vacuous. */
    const presetBtns = p.locator('#presetGrid button');
    const nPresets = await presetBtns.count();
    check('the theme-preset panel offers presets', nPresets > 0, nPresets);
    const presetBefore = await p.evaluate(() => window.CMS.get('settings.preset', ''));
    for (let i = 0; i < nPresets; i++) {
      await presetBtns.nth(i).click();
      await p.waitForTimeout(400);
      if ((await p.evaluate(() => window.CMS.get('settings.preset', ''))) !== presetBefore) break;
    }
    check('applying a preset actually changed the palette (the check is not vacuous)',
          (await p.evaluate(() => window.CMS.get('settings.preset', ''))) !== presetBefore,
          { before: presetBefore, after: await p.evaluate(() => window.CMS.get('settings.preset', '')) });
    check('applying a preset wrote NOTHING to the server (it used to publish)',
          stats.posts.length === 0, stats.posts.length);
    check('applying a preset never says Published',
          !/publish/i.test(await p.textContent('#savedFlag')) &&
          (await pubState(p)) !== 'published',
          { flag: await p.textContent('#savedFlag'), state: await pubState(p) });

    /* Panel switching runs commitLocal() in several places. */
    for (const panel of ['colors', 'text', 'seo', 'home']) {
      await p.click(`.adm-nav-item[data-panel="${panel}"]`);
      await p.waitForTimeout(250);
    }
    check('switching panels wrote nothing to the server', stats.posts.length === 0, stats.posts.length);
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     B. BUILDER AUTOSAVE REACHES NO SERVER
     ================================================================ */
  console.log('\n===== B. Page Builder drafts stay local =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');
    await openPageContent(p, 'about');

    const added = await p.evaluate(() => {
      /* The builder's own local path: exactly what autosave calls. */
      const before = JSON.stringify(window.CMS.sections.live('about'));
      window.CMS.sections.saveDraft('about', [{
        id: 'sec_test1', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true },
        style: {}, responsive: {},
        elements: [{ id: 'el_test1', type: 'text', content: { text: 'draft only' },
                     style: {}, responsive: {} }]
      }]);
      return { before, after: JSON.stringify(window.CMS.sections.live('about')) };
    });
    await p.waitForTimeout(400);

    check('saving a draft wrote NOTHING to the server', stats.posts.length === 0, stats.posts.length);
    check('saving a draft did not change what is live', added.before === added.after,
          { before: added.before.slice(0, 60), after: added.after.slice(0, 60) });
    check('the draft is on this device', await p.evaluate(
      () => window.CMS.sections.draft('about').sections.length === 1));
    check('window.ADMIN_BUILDER.flush() is still available',
          await p.evaluate(() => typeof window.ADMIN_BUILDER.flush === 'function'));
    check('flushing wrote nothing to the server',
          (await p.evaluate(() => { window.ADMIN_BUILDER.flush(); return true; })) &&
          stats.posts.length === 0, stats.posts.length);

    /* A REAL builder edit, through the UI, which is what actually runs the
       builder's local-save path. Adding a section calls it synchronously. */
    await openPageContent(p, 'about');
    const addBtns = await p.$$('#pbAdd button');
    check('the builder offers section types', addBtns.length > 0, addBtns.length);
    const secsBefore = await p.evaluate(() => window.CMS.sections.draft('about').sections.length);
    await addBtns[0].click();
    await p.waitForTimeout(500);
    check('adding a section changed the draft (the check is not vacuous)',
          (await p.evaluate(() => window.CMS.sections.draft('about').sections.length)) > secsBefore,
          { before: secsBefore,
            after: await p.evaluate(() => window.CMS.sections.draft('about').sections.length) });
    check('the builder local save names THIS DEVICE and nothing more',
          /this device/i.test(await p.textContent('#savedFlag')),
          await p.textContent('#savedFlag'));
    check('the builder local save never says Published',
          (await pubState(p)) !== 'published', await pubState(p));
    check('and a real builder edit still wrote nothing to the server',
          stats.posts.length === 0, stats.posts.length);
    check('what is live is still untouched',
          (await p.evaluate(() => window.CMS.sections.live('about').length)) === 0,
          await p.evaluate(() => window.CMS.sections.live('about').length));
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     C. A CONFIRMED PUBLISH, AND THE READ-BACK THAT CONFIRMS IT
     ================================================================ */
  console.log('\n===== C. Publish writes once and is confirmed =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');
    await editFooterCopyright(p);
    await publishNow(p);

    check('exactly one write reached the server', stats.posts.length === 1, stats.posts.length);
    check('the row it wrote is this brand\'s',
          stats.posts[0] && stats.posts[0].id === 'playzone9', stats.posts[0] && stats.posts[0].id);
    check('the payload carries the edit',
          !!(stats.posts[0] && stats.posts[0].data.footer), true);
    check('the write was read back', stats.getsAfterPost >= 1, stats.getsAfterPost);
    check('state is published', (await pubState(p)) === 'published', await p.textContent('#pubState'));
    check('the indicator says Published with a time',
          /Published/.test(await p.textContent('#pubState')), await p.textContent('#pubState'));

    check('a Postgres-formatted timestamp was accepted (not compared as a string)',
          (await pubState(p)) === 'published');

    const stamps = await p.evaluate(() => window.CMS.data().lastPublished || {});
    check('the confirmed server timestamp was recorded',
          typeof stamps.serverUpdatedAt === 'string' && stamps.serverUpdatedAt.length > 0, stamps);
    check('and it is the offset form Postgres returns, not the Z form we sent',
          /\+00:00$/.test(stamps.serverUpdatedAt || ''), stamps.serverUpdatedAt);
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     D. ACCEPTED BUT NOT CONFIRMED IS NOT PUBLISHED
     ================================================================ */
  console.log('\n===== D. A 2xx alone is not publication =====');
  {
    const { ctx, p, stats } = await session(b, 'noconfirm');
    await editFooterCopyright(p);
    await publishNow(p);

    check('the server accepted the write', stats.posts.length === 1, stats.posts.length);
    check('but the state is NOT published', (await pubState(p)) !== 'published', await pubState(p));
    check('the state is failed', (await pubState(p)) === 'failed', await pubState(p));
    check('the indicator never says Published',
          !/Published/.test(await p.textContent('#pubState')), await p.textContent('#pubState'));
    check('the reason is on screen, not in a toast that vanished',
          /not confirmed|could not be read back/i.test(await p.textContent('#pubState')),
          await p.textContent('#pubState'));
    check('nothing was recorded as confirmed',
          await p.evaluate(() => !(window.CMS.data().lastPublished || {}).at));
    await ctx.close();
  }

  /* ================================================================
     E. A ROW THAT HOLDS SOMETHING ELSE IS NOT CONFIRMATION
     ================================================================ */
  console.log('\n===== E. A different timestamp is a failure =====');
  {
    const { ctx, p, stats } = await session(b, 'mismatch');
    await editFooterCopyright(p);
    await publishNow(p);

    check('the write was sent', stats.posts.length === 1, stats.posts.length);
    check('state is failed, not published', (await pubState(p)) === 'failed', await pubState(p));
    check('the message says the server did not confirm',
          /did not confirm/i.test(await p.textContent('#pubState')),
          await p.textContent('#pubState'));
    await ctx.close();
  }

  /* ================================================================
     F. A FAILURE STAYS A FAILURE, AND STAYS DIRTY
     ================================================================ */
  console.log('\n===== F. Failure is persistent and keeps changes dirty =====');
  {
    const { ctx, p, stats } = await session(b, 'httpfail');
    await editFooterCopyright(p);
    await publishNow(p);

    check('the server refused', stats.posts.length === 1, stats.posts.length);
    check('state is failed', (await pubState(p)) === 'failed', await pubState(p));
    check('the HTTP reason is shown', /HTTP 500/.test(await p.textContent('#pubState')),
          await p.textContent('#pubState'));

    /* The whole point: time passes, panels change, and it is still failed. */
    await p.click('.adm-nav-item[data-panel="colors"]');
    await p.waitForTimeout(1200);
    check('still failed after switching panels', (await pubState(p)) === 'failed', await pubState(p));
    check('still failed after 1.2s (it is not a toast)',
          /Not published/.test(await p.textContent('#pubState')), await p.textContent('#pubState'));

    /* And editing more does not launder it into "saved". */
    await editFooterCopyright(p);
    check('editing again does not clear the failure', (await pubState(p)) === 'failed', await pubState(p));
    check('unpublished changes are still dirty',
          await p.evaluate(() => !!window.ADMIN_DIRTY && window.ADMIN_DIRTY()), true);
    await ctx.close();
  }

  /* ================================================================
     G. NOT SIGNED IN IS A FAILURE, NOT A SILENT NO-OP
     ================================================================ */
  console.log('\n===== G. No session means no publish =====');
  {
    const { ctx, p, stats } = await session(b, 'ok', { signIn: false });
    await p.evaluate(() => { const g = document.getElementById('authGate'); if (g) g.hidden = true; });
    await editFooterCopyright(p);
    await publishNow(p);
    check('nothing was written', stats.posts.length === 0, stats.posts.length);
    check('state is failed', (await pubState(p)) === 'failed', await pubState(p));
    check('the reason names the session',
          /sign(ed)? in/i.test(await p.textContent('#pubState')), await p.textContent('#pubState'));
    await ctx.close();
  }

  /* ================================================================
     H. THE PUBLISH TARGET IS WRITTEN OUT
     ================================================================ */
  console.log('\n===== H. Which site am I publishing to =====');
  {
    const { ctx, p } = await session(b, 'ok');
    check('the brand name is shown',
          (await p.textContent('#pubTargetName')).trim().length > 0,
          await p.textContent('#pubTargetName'));
    check('the hostname is shown',
          (await p.textContent('#pubTargetHost')).trim().length > 0,
          await p.textContent('#pubTargetHost'));
    check('the target row is shown',
          /playzone9/.test(await p.textContent('#pubTargetRow')),
          await p.textContent('#pubTargetRow'));
    check('the name falls back to the hostname when branding.siteName is blank',
          await p.evaluate(() => {
            window.CMS.data().branding.siteName = '';
            window.ADMIN_REFRESH && window.ADMIN_REFRESH();
            const n = document.getElementById('pubTargetName').textContent.trim();
            return n.length > 0 && n !== 'BRAND';
          }));
    await ctx.close();
  }

  /* ================================================================
     I. ONE LIST OF DEVICE-LOCAL KEYS, TWO CONSUMERS
     ================================================================ */
  console.log('\n===== I. Exports and payloads strip the same keys =====');
  {
    const { ctx, p, stats } = await session(b, 'ok');
    const KEYS = await p.evaluate(() => window.CMS.localOnlyKeys());
    check('the five device-local keys are declared in one place',
          KEYS.length === 5 &&
          ['builderDrafts', 'builderLibrary', 'builderRecovery',
           'publishIndex', 'lastPublished'].every(k => KEYS.indexOf(k) > -1), KEYS);

    /* Put something in every one of them, so a missing strip is visible. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.builderDrafts = { about: { schemaVersion: 2, status: 'draft', sections: [], updatedAt: 'x' } };
      d.builderLibrary = { version: 1, items: [{ id: 'lib_x', name: 'X', section: { type: 'text' } }] };
      d.builderRecovery = { about: { kind: 'discard' } };
      d.publishIndex = { colors: 'deadbeef' };
      d.lastPublished = { serverUpdatedAt: 'x', at: 'y' };
    });

    const ex = await p.evaluate(() => JSON.parse(window.CMS.exportJSON()));
    check('an export strips every device-local key',
          KEYS.every(k => ex[k] === undefined), KEYS.filter(k => ex[k] !== undefined));
    check('an export still carries the brand\'s content',
          !!ex.seo && !!ex.pages && !!ex.colors && !!ex.branding && !!ex.footer);
    check('an export still carries PUBLISHED builder content (it is content)',
          await p.evaluate(() => {
            const d = window.CMS.data();
            d.pages.about.builder = { schemaVersion: 2, status: 'published',
                                      sections: [{ id: 's1', type: 'text', elements: [] }],
                                      updatedAt: '2026-01-01' };
            const e = JSON.parse(window.CMS.exportJSON());
            return !!(e.pages.about.builder && e.pages.about.builder.sections.length === 1);
          }));

    await publishNow(p);
    const sent = stats.posts[0];
    check('the publish payload strips exactly the same keys',
          !!sent && KEYS.every(k => sent.data[k] === undefined),
          sent ? KEYS.filter(k => sent.data[k] !== undefined) : 'no post');
    check('and still carries published builder content',
          !!(sent && sent.data.pages.about.builder &&
             sent.data.pages.about.builder.status === 'published'));
    await ctx.close();
  }

  /* ================================================================
     J. ONE BRAND NEVER WRITES ANOTHER'S ROW
     ================================================================ */
  console.log('\n===== J. Cross-brand publish is refused =====');
  {
    const { ctx, p, stats } = await session(b, 'ok');
    const msg = await p.evaluate(async () => {
      /* Make the registry and the configured row disagree, exactly as a
         misconfiguration would, and ask to publish. */
      window.CMS_BRANDS = { 'localhost': { siteId: 'someone-else', bucket: 'x' } };
      try { await window.CMS.remote.publish(); return ''; }
      catch (e) { return e.message; }
    });
    check('the publish was refused', msg.length > 0, msg);
    check('the refusal names both rows',
          /someone-else/.test(msg) && /playzone9/.test(msg), msg);
    check('and nothing was written', stats.posts.length === 0, stats.posts.length);
    await ctx.close();
  }

  /* ================================================================
     K. BACKUP IS NOT PUBLISHING
     ================================================================ */
  console.log('\n===== K. Backup & Restore reaches no server =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');
    await p.click('.adm-nav-item[data-panel="data"]');
    await p.waitForTimeout(400);

    check('the panel is called Backup & Restore',
          /backup/i.test(await p.textContent('#panelTitle')), await p.textContent('#panelTitle'));
    check('the old "Publish to every device" card is gone',
          !/publish to every device/i.test(await p.textContent('#panel-data')));
    check('and #btnPublish no longer exists', (await p.$('#btnPublish')) === null);
    check('the developer download is clearly labelled as defaults',
          !!(await p.$('#btnBrandDefaults')) &&
          /brand defaults/i.test(await p.textContent('#btnBrandDefaults')),
          await p.$('#btnBrandDefaults') ? await p.textContent('#btnBrandDefaults') : 'missing');
    check('and it says in words that it does not publish',
          /does not publish/i.test(await p.textContent('#panel-data')));

    /* Downloading must reach no server. */
    const dl = p.waitForEvent('download').catch(() => null);
    await p.click('#btnBrandDefaults');
    await dl;
    await p.waitForTimeout(500);
    check('downloading brand defaults wrote NOTHING to the server',
          stats.posts.length === 0, stats.posts.length);
    check('and it did not report Published', (await pubState(p)) !== 'published', await pubState(p));

    const dl2 = p.waitForEvent('download').catch(() => null);
    await p.click('#btnExport');
    await dl2;
    await p.waitForTimeout(400);
    check('downloading a backup wrote NOTHING to the server',
          stats.posts.length === 0, stats.posts.length);
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     L. A RESTORE IS A LOCAL CHANGE, NOT A PUBLISH
     ================================================================ */
  console.log('\n===== L. Restoring a backup does not publish =====');
  {
    const { ctx, p, stats } = await session(b, 'ok');
    await p.click('.adm-nav-item[data-panel="data"]');
    await p.waitForTimeout(400);
    await p.fill('#importText', JSON.stringify({ branding: { siteName: 'RESTORED BRAND' } }));
    await p.click('#btnImportText');
    await p.waitForTimeout(800);

    check('the restore landed', (await p.evaluate(
      () => window.CMS.get('branding.siteName', ''))) === 'RESTORED BRAND',
      await p.evaluate(() => window.CMS.get('branding.siteName', '')));
    check('restoring wrote NOTHING to the server', stats.posts.length === 0, stats.posts.length);
    check('restoring never reports Published', (await pubState(p)) !== 'published', await pubState(p));
    check('restored content is left as unpublished changes',
          (await pubState(p)) === 'local' && (await p.evaluate(() => window.ADMIN_DIRTY())),
          { state: await pubState(p), dirty: await p.evaluate(() => window.ADMIN_DIRTY()) });
    await ctx.close();
  }

  /* ================================================================
     M. THE REVIEW SHEET SAYS WHAT WILL BE PUBLISHED
     ================================================================ */
  console.log('\n===== M. Review & Publish lists the real changes =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');

    /* Publish once so the index is seeded and "changed" means something. */
    await p.click('#btnReview'); await p.waitForTimeout(400);
    await p.click('#pubConfirm'); await p.waitForTimeout(1500);
    check('the first publish is confirmed', (await pubState(p)) === 'published', await pubState(p));

    await p.click('#btnReview'); await p.waitForTimeout(500);
    check('with nothing changed, the sheet says so',
          /Nothing differs/i.test(await p.textContent('#pubModalNote')),
          await p.textContent('#pubModalNote'));
    check('and the button offers to publish nothing',
          /publish nothing/i.test(await p.textContent('#pubConfirm')),
          await p.textContent('#pubConfirm'));
    await p.click('#pubCancel'); await p.waitForTimeout(300);

    /* Now change four different areas and check every one is listed. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.colors['hdr-bg'] = '#123456';
      d.footer.copyright = 'CHANGED FOOTER';
      d.pages.about.metaDescription = 'A changed meta description for About.';
      d.pages.contact.heading = 'A changed H1 for Contact';
      d.seo.defaultTitle = 'A changed default title';
    });
    await p.evaluate(() => window.ADMIN_REFRESH());
    await p.waitForTimeout(300);

    const areas = await p.evaluate(() => window.CMS.changedAreas().areas);
    for (const want of ['colors', 'footer', 'seo',
                        'pages.about.metaDescription', 'pages.contact.heading']) {
      check(`changedAreas() reports ${want}`, areas.indexOf(want) > -1, areas);
    }
    check('and does NOT report an area nobody touched',
          areas.indexOf('typography') === -1 && areas.indexOf('sportsTable') === -1, areas);
    check('nor any device-local key',
          !areas.some(a => /builderDrafts|builderLibrary|builderRecovery|publishIndex|lastPublished/.test(a)),
          areas);

    await p.click('#btnReview'); await p.waitForTimeout(500);
    const sheet = await p.textContent('#pubModalList');
    check('the sheet names the changed colours', /Colours/i.test(sheet), sheet.slice(0, 200));
    check('the sheet names the changed footer', /Footer/i.test(sheet), sheet.slice(0, 200));
    check('the sheet names the About page by label', /About/i.test(sheet), sheet.slice(0, 300));
    check('and names the field, not just the page', /Meta description/i.test(sheet), sheet.slice(0, 300));
    check('the sheet names the Contact H1', /H1 heading/i.test(sheet), sheet.slice(0, 400));
    check('the button counts the changes',
          /Publish \d+ changes?/.test(await p.textContent('#pubConfirm')),
          await p.textContent('#pubConfirm'));

    check('the sheet names the brand', (await p.textContent('#pubModalTarget')).length > 0);
    check('the sheet names the hostname',
          /localhost/.test(await p.textContent('#pubModalTarget')),
          await p.textContent('#pubModalTarget'));
    check('the sheet names the target row',
          /playzone9/.test(await p.textContent('#pubModalTarget')),
          await p.textContent('#pubModalTarget'));
    check('the sheet says what is NOT published',
          /drafts/i.test(await p.textContent('.publist-not')) &&
          /library/i.test(await p.textContent('.publist-not')));

    const postsBefore = stats.posts.length;
    await p.click('#pubConfirm'); await p.waitForTimeout(1500);
    check('confirming published exactly once more', stats.posts.length === postsBefore + 1,
          stats.posts.length - postsBefore);
    check('the payload carries every change',
          (() => { const d = stats.posts[stats.posts.length - 1].data;
                   return d.colors['hdr-bg'] === '#123456' &&
                          d.footer.copyright === 'CHANGED FOOTER' &&
                          d.pages.about.metaDescription === 'A changed meta description for About.' &&
                          d.pages.contact.heading === 'A changed H1 for Contact'; })());
    check('and afterwards nothing is outstanding',
          (await p.evaluate(() => window.CMS.changedAreas().areas.length)) === 0,
          await p.evaluate(() => window.CMS.changedAreas().areas));
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     N. CANCEL IS INERT
     ================================================================ */
  console.log('\n===== N. Cancelling changes nothing =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');
    await openPageContent(p, 'about');

    /* A draft worth publishing, so the staged intent is real. Built through
       the UI: seeding it with saveDraft() alone leaves the builder's own
       in-memory copy empty, which disables Publish and would make this test
       about the wrong thing. */
    const addN = p.locator('#pbAdd button');
    check('the builder offers section types', (await addN.count()) > 0, await addN.count());
    await addN.nth(0).click();
    await p.waitForTimeout(500);
    check('a draft section exists to publish',
          (await p.evaluate(() => window.CMS.sections.draft('about').sections.length)) === 1,
          await p.evaluate(() => window.CMS.sections.draft('about').sections.length));

    const before = await p.evaluate(() => ({
      live: JSON.stringify(window.CMS.sections.live('about')),
      builder: JSON.stringify((window.CMS.data().pages.about || {}).builder || null),
      draft: JSON.stringify(window.CMS.sections.draft('about').sections)
    }));
    check('nothing is live for About yet', before.live === '[]', before.live);

    await p.click('#pbPublish');
    await p.waitForTimeout(600);
    check('pressing Publish opened the review sheet', !(await p.$eval('#pubModal', m => m.hidden)));
    check('and it says how many sections would go live',
          /\d+ sections?/.test(await p.textContent('#pubModalList')),
          await p.textContent('#pubModalList'));
    check('BUT nothing has been applied yet',
          (await p.evaluate(() => JSON.stringify((window.CMS.data().pages.about || {}).builder || null)))
            === before.builder,
          { before: before.builder });

    await p.click('#pubCancel');
    await p.waitForTimeout(600);
    const after = await p.evaluate(() => ({
      live: JSON.stringify(window.CMS.sections.live('about')),
      builder: JSON.stringify((window.CMS.data().pages.about || {}).builder || null),
      draft: JSON.stringify(window.CMS.sections.draft('about').sections)
    }));
    check('cancelling wrote nothing to the server', stats.posts.length === 0, stats.posts.length);
    check('cancelling left the live page untouched', after.live === before.live,
          { before: before.live, after: after.live });
    check('cancelling left the builder block untouched', after.builder === before.builder,
          { before: before.builder, after: after.builder });
    check('cancelling KEPT the draft', after.draft === before.draft,
          { before: before.draft.slice(0, 60), after: after.draft.slice(0, 60) });
    check('cancelling never reports Published', (await pubState(p)) !== 'published', await pubState(p));
    check('the sheet is closed', await p.$eval('#pubModal', m => m.hidden));

    /* And confirming the same intent DOES apply it. */
    await p.click('#pbPublish');
    await p.waitForTimeout(600);
    await p.click('#pubConfirm');
    await p.waitForTimeout(1600);
    check('confirming applied the staged publish',
          (await p.evaluate(() => window.CMS.sections.live('about').length)) === 1,
          await p.evaluate(() => window.CMS.sections.live('about').length));
    check('and it reached the server once', stats.posts.length === 1, stats.posts.length);
    check('and it is confirmed published', (await pubState(p)) === 'published', await pubState(p));
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     O. ONE PAGE, ONE CONTENT EDITOR
     ================================================================ */
  console.log('\n===== O. Pages holds content and settings, separately =====');
  {
    const { ctx, p, errs } = await session(b, 'ok');

    check('Page Builder has no navigation item of its own',
          (await p.$('.adm-nav-item[data-panel="builder"]')) === null);
    check('and no panel of its own', (await p.$('#panel-builder')) === null);
    check('Save draft is gone as a user-facing action', (await p.$('#pbSaveDraft')) === null);
    check('and the builder has no second page selector', (await p.$('#pbTabs')) === null);

    await p.click('.adm-nav-item[data-panel="pages"]');
    await p.waitForTimeout(600);
    check('Pages offers exactly two areas',
          (await p.$$('#pageSubtabs .subtab')).length === 2);
    check('named Content and Settings & SEO',
          /Content/.test(await p.textContent('#pageSubtabContent')) &&
          /Settings/.test(await p.textContent('#pageSubtabSettings')));

    /* A mounted page: content is built in Content, and Settings has no body. */
    await p.click('#pageTabs .pagetab[data-page-key="about"]');
    await p.waitForTimeout(400);
    await p.click('#pageSubtabSettings');
    await p.waitForTimeout(400);
    const settings = await p.textContent('#pageEditor');
    check('Settings & SEO has NO editable Main content field',
          !/Main content/i.test(settings), settings.slice(0, 160));
    check('and no body textarea at all',
          (await p.$$('#pageEditor textarea.codearea')).length === 0,
          (await p.$$('#pageEditor textarea.codearea')).length);
    check('Settings & SEO still has the page title field', /Page title/i.test(settings));
    check('  the meta description', /Meta description/i.test(settings));
    check('  the H1 and intro', /H1 heading/i.test(settings) && /Intro/i.test(settings));
    check('  the search-engine settings', /Search engines/i.test(settings));
    check('  and the sharing settings', /Sharing/i.test(settings));

    check('the shipped fallback copy is shown', /Fallback copy/i.test(settings));
    check('  described as the no-JavaScript copy',
          /JavaScript is disabled/i.test(settings), settings.slice(0, 400));
    check('  and as restorable by unpublishing', /unpublish/i.test(settings));
    check('the fallback is marked read-only',
          (await p.$('.pagefallback[data-readonly="true"]')) !== null);
    check('and it renders the real shipped copy',
          /online gaming site/i.test(await p.textContent('.pagefallback')),
          (await p.textContent('.pagefallback')).slice(0, 80));

    /* The data behind it is untouched. */
    const bodyLen = await p.evaluate(() => (window.CMS.data().pages.about.body || '').length);
    check('pages.about.body is still in the record, unchanged', bodyLen > 500, bodyLen);
    for (const slug of ['home', 'login', 'register']) {
      check(`pages.${slug}.body still exists in the record`,
            await p.evaluate(s => typeof window.CMS.data().pages[s].body === 'string', slug));
    }

    /* Content is the one place the body is authored. */
    await p.click('#pageSubtabContent');
    await p.waitForTimeout(600);
    check('Content is the Page Builder', (await p.$('#pbList')) !== null &&
          (await p.$('#pbAdd')) !== null);
    check('with its templates, sections and preview',
          (await p.$('#pbTemplates')) !== null && (await p.$('#pbFrame')) !== null);
    check('its reusable-section library', (await p.$('#pbLibrary')) !== null);
    check('and its recovery area', (await p.$('#pbRecovery')) !== null);
    check('exactly ONE body-content editing surface in the whole panel',
          (await p.$$('#panel-pages textarea.codearea')).length === 0 &&
          (await p.$$('#panel-pages #pbList')).length === 1);
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     P. AN EMPTY PUBLISHED CANVAS MEANS ONE THING
     ================================================================ */
  console.log('\n===== P. Empty published canvas is consistent =====');
  {
    const { ctx, p, errs } = await session(b, 'ok');

    /* Reachable by restoring a backup that holds one -- which is how it can
       arrive in the wild. The renderer has always treated it as published
       (deliberately: clearing every section and publishing leaves an empty
       page, it does not restore the shipped copy). The admin used to
       disagree, and disabled the one control that could undo it. */
    await p.evaluate(() => {
      window.CMS.data().pages.about.builder =
        { schemaVersion: 2, status: 'published', sections: [], updatedAt: '2026-01-01' };
    });
    const agree = await p.evaluate(() => ({
      renderer: window.CMS.sections.bodyManaged('about'),
      status: window.CMS.sections.status('about').live,
      published: window.CMS.sections.published('about'),
      liveSections: window.CMS.sections.status('about').liveSections
    }));
    check('the renderer treats it as builder-managed', agree.renderer === true, agree);
    check('and the admin now agrees', agree.status === true, agree);
    check('the two definitions match', agree.renderer === agree.status, agree);
    check('published() returns an empty list, not null',
          Array.isArray(agree.published) && agree.published.length === 0, agree.published);
    check('and the live section count is zero', agree.liveSections === 0, agree.liveSections);

    await p.click('.adm-nav-item[data-panel="pages"]');
    await p.waitForTimeout(400);
    await p.click('#pageTabs .pagetab[data-page-key="about"]');
    await p.waitForTimeout(400);
    await p.click('#pageSubtabContent');
    await p.waitForTimeout(600);
    check('Unpublish is OFFERED, so the page can be brought back',
          !(await p.$eval('#pbUnpublish', n => n.disabled)),
          await p.$eval('#pbUnpublish', n => n.title));
    check('and the state line does not claim the shipped content is showing',
          !/shows its shipped content/i.test(await p.textContent('#pbState')),
          await p.textContent('#pbState'));

    /* And unpublishing really does bring it back. */
    await p.click('#pbUnpublish');
    await p.waitForTimeout(400);
    await p.click('#pubConfirm');
    await p.waitForTimeout(1400);
    check('unpublishing restores the shipped copy',
          (await p.evaluate(() => window.CMS.sections.bodyManaged('about'))) === false);
    check('and the sections block was kept, not deleted',
          await p.evaluate(() => !!window.CMS.data().pages.about.builder));
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     Q. RELOAD IS NOT DISCARD
     ================================================================ */
  console.log('\n===== Q. Reload and Discard are different actions =====');
  {
    const { ctx, p, stats, errs } = await session(b, 'ok');
    check('both controls exist, separately',
          (await p.$('#btnReload')) !== null && (await p.$('#btnDiscardLocal')) !== null);
    check('and the single ambiguous Revert is gone', (await p.$('#btnRevert')) === null);

    /* Publish once so there IS a published state to reload. */
    await publishNow(p);
    check('published once', (await pubState(p)) === 'published', await pubState(p));

    /* Local change + a page draft, then Reload. */
    await p.evaluate(() => {
      window.CMS.data().footer.copyright = 'UNPUBLISHED LOCAL EDIT';
      window.CMS.sections.saveDraft('about', [{
        id: 'sec_keep', type: 'text', enabled: true,
        visibility: { desktop: true, tablet: true, mobile: true }, style: {}, responsive: {},
        elements: [{ id: 'el_keep', type: 'text', content: { text: 'draft to keep' },
                     style: {}, responsive: {} }]
      }]);
      window.ADMIN_REFRESH();
    });
    await p.waitForTimeout(400);
    const postsAfterPublish = stats.posts.length;

    await p.click('#btnReload');
    await p.waitForTimeout(1200);
    check('Reload does NOT destroy unpublished local changes',
          await p.evaluate(() => /UNPUBLISHED LOCAL EDIT/.test(window.CMS.data().footer.copyright)),
          await p.evaluate(() => window.CMS.data().footer.copyright));
    check('Reload keeps Page Builder drafts too',
          (await p.evaluate(() => window.CMS.sections.draft('about').sections.length)) === 1);
    check('Reload leaves the state as unpublished, not clean',
          (await pubState(p)) === 'local', await pubState(p));
    check('Reload writes nothing to the server',
          stats.posts.length === postsAfterPublish, stats.posts.length - postsAfterPublish);
    check('and the change list still names the local edit',
          (await p.evaluate(() => window.CMS.changedAreas().areas)).indexOf('footer') > -1,
          await p.evaluate(() => window.CMS.changedAreas().areas));

    /* Now Discard, which IS destructive -- of brand changes only. */
    await p.click('#btnDiscardLocal');
    await p.waitForTimeout(1500);
    check('Discard drops the unpublished brand change',
          await p.evaluate(() => !/UNPUBLISHED LOCAL EDIT/.test(window.CMS.data().footer.copyright)),
          await p.evaluate(() => window.CMS.data().footer.copyright));
    check('Discard KEEPS the Page Builder draft',
          (await p.evaluate(() => window.CMS.sections.draft('about').sections.length)) === 1,
          await p.evaluate(() => window.CMS.sections.draft('about').sections.length));
    check('  and its content, not just its shape',
          await p.evaluate(() =>
            window.CMS.sections.draft('about').sections[0].elements[0].content.text === 'draft to keep'));
    check('Discard leaves nothing outstanding',
          (await p.evaluate(() => window.CMS.changedAreas().areas.length)) === 0,
          await p.evaluate(() => window.CMS.changedAreas().areas));
    check('Discard writes nothing to the server',
          stats.posts.length === postsAfterPublish, stats.posts.length - postsAfterPublish);
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  /* ================================================================
     R. A BRAND WITH NO ROW YET
     ================================================================ */
  console.log('\n===== R. Nothing published yet =====');
  {
    /* 'noconfirm' never stores, so every GET returns an empty table -- exactly
       a brand whose row does not exist. That is Playzone9 staging today. */
    const { ctx, p, errs } = await session(b, 'noconfirm');

    await p.evaluate(() => {
      window.CMS.data().footer.copyright = 'EDIT WITH NO ROW';
      window.ADMIN_REFRESH();
    });
    await p.waitForTimeout(300);

    const res = await p.evaluate(() => window.CMS.changedAreas());
    check('the change index knows nothing has been published',
          res.everPublished === false, res.everPublished);
    check('so everything is listed rather than under-reported',
          res.areas.length > 10, res.areas.length);

    await p.click('#btnReview');
    await p.waitForTimeout(600);
    check('the review sheet says this browser has not published here',
          /not confirmed a publish/i.test(await p.textContent('#pubModalNote')),
          await p.textContent('#pubModalNote'));
    check('and says so about the last publish too',
          /has not confirmed a publish/i.test(await p.textContent('#pubModalLast')),
          await p.textContent('#pubModalLast'));
    await p.click('#pubCancel');
    await p.waitForTimeout(300);

    /* Discard must not pretend there is a published state to go back to. */
    await p.click('#btnDiscardLocal');
    await p.waitForTimeout(1500);
    check('Discard falls back to the shipped defaults',
          await p.evaluate(() => !/EDIT WITH NO ROW/.test(window.CMS.data().footer.copyright)),
          await p.evaluate(() => window.CMS.data().footer.copyright));
    check('and the shipped brand content is what is showing',
          (await p.evaluate(() => window.CMS.get('branding.siteName', ''))).length > 0,
          await p.evaluate(() => window.CMS.get('branding.siteName', '')));
    check('no admin console errors', errs.length === 0, errs);
    await ctx.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail ? 1 : 0);
})();
