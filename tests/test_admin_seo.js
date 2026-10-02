const { chromium } = require('playwright');
const BASE='http://localhost:8777';
let pass=0,fail=0; const fails=[];
const check=(n,c,e)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,fails.push(n),console.log('  FAIL  '+n+(e!==undefined?' -> '+JSON.stringify(e):'')))};

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:1400,height:1000}});
  let published=null, serverRow=null;
  await ctx.route('**supabase.co/**', route=>{
    const q=route.request(), u=q.url();
    if(u.includes('/auth/v1/token')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'stub'})});
    if(q.method()==='POST'){ published=JSON.parse(q.postData()||'{}'); serverRow=published; return route.fulfill({status:201,body:''}); }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(serverRow?[{data:serverRow.data,updated_at:new Date(serverRow.updated_at).toISOString().replace(/\.000Z$/,'+00:00').replace(/Z$/,'+00:00')}]:[])});
  });
  const errs=[];
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('PAGEERROR '+e));
  p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});

  console.log('\n===== ADMIN: existing functionality intact =====');
  await p.goto(`${BASE}/admin/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
  check('admin is noindex,nofollow', await p.getAttribute('meta[name="robots"]','content')==='noindex,nofollow');
  check('sign-in gate still enforced', await p.isVisible('#authGate'));
  const panels=await p.$$eval('.adm-panel',e=>e.map(x=>x.id));
  check('all original panels still present', ['themes','branding','colors','typography','text','auth','images','home','presets','data','reset','pages'].every(x=>panels.includes('panel-'+x)), panels);
  check('new SEO panel present', panels.includes('panel-seo'));
  await p.fill('#authEmail','a@b.c'); await p.fill('#authPass','x'); await p.click('#authBtn'); await p.waitForTimeout(400);
  check('sign in works', !(await p.isVisible('#authGate')));

  console.log('\n===== SEO PANEL =====');
  await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(300);
  check('SEO panel opens', await p.isVisible('#panel-seo'));
  const tabs=await p.$$eval('#seoTabs .pagetab',e=>e.map(x=>x.textContent));
  check('7 SEO tabs', tabs.length===7 && tabs.includes('Dashboard') && tabs.includes('Global SEO') && tabs.includes('Sitemap') && tabs.includes('Robots.txt'), tabs);

  // dashboard
  const rows=await p.$$('#seoDashboard .seorow');
  const dashLabels=await p.$$eval('#seoDashboard .seorow',e=>e.map(x=>x.textContent.trim().split('\n')[0].trim()));
  check('dashboard lists every CMS page', rows.length===7, rows.length);
  check('and the privacy policy is one of them', dashLabels.some(t=>/Privacy/i.test(t)), dashLabels);
  const checkTxt=await p.$eval('#seoDashboard',e=>e.textContent);
  check('dashboard shows individual checks, not a score', /characters|H1|description/i.test(checkTxt) && !/\d+\s*\/\s*100|score/i.test(checkTxt));

  // global
  await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(250);
  check('Global SEO fields render', (await p.$$('#seoGlobalIdentity .f, #seoGlobalDefaults .f, #seoVerification .f')).length===8);
  const baseInput=await p.$('#seoGlobalIdentity .f:nth-child(2) input');
  check('base URL prefilled to jsk-1.com', (await baseInput.inputValue())==='https://jsk-1.com', await baseInput.inputValue());
  // verification: set one, confirm only that one is emitted
  const vIn=await p.$('#seoVerification .f:nth-child(1) input');
  await vIn.fill('test-google-code'); await p.waitForTimeout(150);
  check('verification value stored', (await p.evaluate(()=>window.CMS.get('seo.verification.google','')))==='test-google-code');

  // social
  await p.click('#seoTabs .pagetab >> nth=2'); await p.waitForTimeout(250);
  check('Social fields render', (await p.$$('#seoSocial .f, #seoSocialImage .f')).length===8);
  await p.fill('#seoSocialImage .f:nth-child(1) input','assets/images/share.png'); await p.waitForTimeout(150);

  // schema
  await p.click('#seoTabs .pagetab >> nth=3'); await p.waitForTimeout(250);
  const schemaPv=await p.$eval('#seoSchemaPreview',e=>e.textContent);
  check('Organization preview builds valid JSON', (()=>{try{JSON.parse(schemaPv);return true}catch(e){return false}})());
  check('Organization preview omits empty fields', !/"legalName"|"logo"|"sameAs"/.test(schemaPv), schemaPv.slice(0,120));

  // sitemap
  await p.click('#seoTabs .pagetab >> nth=4'); await p.waitForTimeout(250);
  const smOut=await p.$eval('#seoSitemapOut',e=>e.textContent);
  const smLocs=(smOut.match(/<loc>([^<]*)<\/loc>/g)||[]).map(x=>x.replace(/<\/?loc>/g,''));
  check('generated sitemap has 5 URLs', (smOut.match(/<url>/g)||[]).length===5, smLocs);
  check('and it includes the privacy policy', smLocs.includes('https://jsk-1.com/privacy-policy.html'), smLocs);
  check('and lists no URL twice', new Set(smLocs).size===smLocs.length, smLocs);
  check('generated sitemap excludes noindex pages', !/login|register/.test(smOut));
  check('sitemap table lists index/noindex state', /noindex/.test(await p.$eval('#seoSitemapTable',e=>e.textContent)));
  check('sitemap card says the file must be replaced manually', /real file in the\s+repository|replace/i.test(await p.$eval('#seotab-sitemap',e=>e.textContent)));

  // robots
  await p.click('#seoTabs .pagetab >> nth=5'); await p.waitForTimeout(250);
  const rbOut=await p.$eval('#seoRobotsOut',e=>e.textContent);
  check('generated robots.txt has Disallow /admin/ + sitemap', rbOut.includes('Disallow: /admin/')&&rbOut.includes('Sitemap: https://jsk-1.com/sitemap.xml'));
  check('robots card is honest about static deployment', /cannot write it for you|replace/i.test(await p.$eval('#seotab-robots',e=>e.textContent)));
  await p.fill('#seoRobotsExtra','Disallow: /tmp/'); await p.waitForTimeout(200);
  check('extra robots rules appear in output', (await p.$eval('#seoRobotsOut',e=>e.textContent)).includes('Disallow: /tmp/'));

  // new page guardrails
  await p.click('#seoTabs .pagetab >> nth=6'); await p.waitForTimeout(250);
  const npInputs=await p.$$('#seoNewPageFields input, #seoNewPageFields textarea');
  await npInputs[0].fill('About Us JSK1'); await p.waitForTimeout(250);
  const warnTxt=await p.$eval('#seoNewPageWarn',e=>e.textContent);
  check('near-duplicate slug is blocked', /similar address already exists/i.test(warnTxt), warnTxt.slice(0,100));
  check('create button disabled on duplicate', await p.getAttribute('#btnCreatePage','disabled')!==null);
  await npInputs[1].fill('deposit-methods'); await p.waitForTimeout(250);
  check('a genuinely new slug is allowed', (await p.$eval('#seoNewPageWarn',e=>e.textContent)).trim()==='');

  console.log('\n===== PAGE SEO EDITOR =====');
  await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(300);
  const ptabs=await p.$$eval('.pagetab',e=>e.map(x=>x.textContent));
  check('all 6 pages editable (incl. Home/Login/Register)', ptabs.length>=6 && ptabs.includes('Home') && ptabs.includes('Login'), ptabs);
  await p.click('#pageTabs .pagetab >> nth=0'); await p.waitForTimeout(300);
  check('Home page editor opens', (await p.$eval('#pageEditor',e=>e.textContent)).includes('Home'));
  check('canonical override field', (await p.$eval('#pageEditor',e=>e.textContent)).includes('Canonical URL override'));
  check('index/follow toggles', (await p.$eval('#pageEditor',e=>e.textContent)).includes('Allow indexing'));
  check('OG + X fields', (await p.$eval('#pageEditor',e=>e.textContent)).includes('OG title') && (await p.$eval('#pageEditor',e=>e.textContent)).includes('X title'));
  check('Google preview rendered', await p.isVisible('#pvGoogle'));
  check('OG preview rendered', await p.isVisible('#pvOg'));
  check('X preview rendered', await p.isVisible('#pvTw'));
  check('per-page checks rendered', (await p.$$('#pageChecks .seochecks li')).length>0);

  // live preview update
  const h1In=await p.$('#pageEditor .f:nth-child(3) input');
  const titleIn=(await p.$$('#pageEditor .f input'))[0];
  await titleIn.fill('JSK1 Live Preview Test'); await p.waitForTimeout(250);
  check('Google preview title updates as you type', (await p.$eval('#pvGoogle .pv-title',e=>e.textContent))==='JSK1 Live Preview Test');
  check('OG preview inherits the title', (await p.$eval('#pvOg .pv-ct',e=>e.textContent))==='JSK1 Live Preview Test');
  check('share image from Global defaults reaches the preview', (await p.$eval('#pvOg .pv-img',e=>e.getAttribute('style')||''))!=='' );

  // noindex banner
  await p.click('#pageTabs .pagetab >> nth=1'); await p.waitForTimeout(300);  // Login
  check('noindex page shows a clear warning in the preview', await p.isVisible('#pvGoogle .pv-noindex'));
  const loginChecks=await p.$eval('#pageChecks',e=>e.textContent);
  check('noindex is surfaced as a check', /noindex/i.test(loginChecks));

  console.log('\n===== SAVE -> PUBLISH -> PUBLIC PAGE =====');
  await p.click('#pageTabs .pagetab >> nth=0'); await p.waitForTimeout(250);
  const ti=(await p.$$('#pageEditor .f input'))[0];
  await ti.fill('JSK1 — Published Title Test'); await p.waitForTimeout(200);
  const di=(await p.$$('#pageEditor .f textarea'))[0];
  await di.fill('A published meta description written from the admin SEO panel for testing.'); await p.waitForTimeout(200);
  await p.click('#btnReview'); await p.waitForTimeout(400);
    await p.click('#pubConfirm'); await p.waitForTimeout(900);
  check('published to Supabase', !!published && published.id==='playzone9');
  check('published payload carries seo{}', !!(published&&published.data.seo&&published.data.seo.baseUrl==='https://jsk-1.com'));
  check('published payload carries pages.home SEO', !!(published&&published.data.pages.home.title.includes('Published Title Test')));
  check('publish preserved branding/colors/themes/home', !!(published&&published.data.branding&&published.data.colors&&published.data.themes&&published.data.home));
  check('updatedAt stamped for the sitemap', /^\d{4}-\d{2}-\d{2}$/.test(published.data.pages.home.updatedAt), published.data.pages.home.updatedAt);

  const pub=await ctx.newPage();
  const pubErr=[]; pub.on('pageerror',e=>pubErr.push(String(e)));
  pub.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))pubErr.push(m.text())});
  await pub.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await pub.waitForTimeout(500);
  const live=await pub.evaluate(()=>({
    title:document.title,
    desc:document.head.querySelector('meta[name=description]').getAttribute('content'),
    ogTitle:document.head.querySelector('meta[property="og:title"]').getAttribute('content'),
    ogImg:(document.head.querySelector('meta[property="og:image"]')||{getAttribute:()=>null}).getAttribute('content'),
    twTitle:document.head.querySelector('meta[name="twitter:title"]').getAttribute('content'),
    gverify:(document.head.querySelector('meta[name="google-site-verification"]')||{getAttribute:()=>null}).getAttribute('content'),
    canon:document.head.querySelector('link[rel=canonical]').getAttribute('href'),
  }));
  check('public title = admin value', live.title==='JSK1 — Published Title Test', live.title);
  check('public description = admin value', live.desc.includes('published meta description'), live.desc);
  check('og:title inherits the page title', live.ogTitle===live.title, live.ogTitle);
  check('og:image = the global default set in admin', live.ogImg==='https://jsk-1.com/assets/images/share.png', live.ogImg);
  check('twitter:title inherits OG', live.twTitle===live.title);
  check('verification tag emitted only because a value was set', live.gverify==='test-google-code', live.gverify);
  check('canonical still jsk-1.com', live.canon==='https://jsk-1.com/');
  check('no console errors on the public page', pubErr.length===0, pubErr);

  console.log('\n===== EMPTY CMS VALUE MUST NOT BLANK A PAGE =====');
  await p.bringToFront();
  await ti.fill(''); await di.fill(''); await p.waitForTimeout(200);
  await p.click('#btnReview'); await p.waitForTimeout(400);
  await p.click('#pubConfirm'); await p.waitForTimeout(800);
  const pub2=await ctx.newPage();
  await pub2.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await pub2.waitForTimeout(500);
  const fb=await pub2.evaluate(()=>({t:document.title,d:document.head.querySelector('meta[name=description]').getAttribute('content')}));
  check('cleared title falls back to the global default, never blank', !!fb.t && fb.t.includes('JSK1'), fb.t);
  check('cleared description falls back, never blank', !!fb.d && fb.d.length>40, fb.d&&fb.d.slice(0,50));
  await pub2.close();

  console.log('\n===== EXISTING FEATURES UNAFFECTED =====');
  for (const [panel,sel,label] of [['text','#textFields .f','Text'],['home','#panel-home .card','Home Content'],['themes','#panel-themes .card','Theme Manager'],['colors','#colorGroups','Colors'],['images','#allImages','Images']]) {
    await p.click(`.adm-nav-item[data-panel="${panel}"]`); await p.waitForTimeout(350);
    check(`${label} panel still builds`, (await p.$$(sel)).length>0);
  }
  const ex=await p.evaluate(()=>JSON.parse(window.CMS.exportJSON()));
  check('export includes seo + pages', !!ex.seo && Object.keys(ex.pages).length>=6);
  check('no admin console errors', errs.length===0, errs);

  /* ==================================================================
     THE CONTENT-TYPE CONTROL IS NOT OFFERED WHERE IT CANNOT BE PUBLISHED
     ------------------------------------------------------------------
     A page that ships with the site is generated from its own committed
     template, and those carry their own static SEO rather than the baked
     kind -- so a content type chosen for one would reach its Article data
     (the mount bakes that) but NOT its og:type, which the template
     hardcodes. The served HTML would call itself an article in one tag and
     a website in another, and the runtime would repaint og:type, so the page
     a crawler reads and the page a visitor gets would disagree.

     Publication has been guarded this way since the page lifecycle existed,
     for the same reason. This holds the content model to it.
     ================================================================== */
  console.log('\n===== CONTENT TYPE: OFFERED ONLY WHERE IT CAN BE PUBLISHED =====');
  await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(300);
  await p.click('#pageSubtabSettings'); await p.waitForTimeout(250);
  await p.click('#pageTabs .pagetab >> nth=0'); await p.waitForTimeout(350);
  {
    const shipped = await p.$eval('#pageEditor', e => e.textContent);
    check('a page that ships with the site is NOT offered a content type',
      shipped.indexOf('Kind of page') === -1);
    check('  nor a first-published date, author or related list',
      shipped.indexOf('First published') === -1 && shipped.indexOf('Related pages') === -1);
    check('  while the rest of its SEO panel is untouched',
      shipped.indexOf('Canonical URL override') > -1 && shipped.indexOf('OG title') > -1);
    check('  and Publication is still withheld from it too (the precedent)',
      shipped.indexOf('A draft page is not') === -1);
  }

  /* An address the build cannot create must not be creatable. */
  console.log('\n===== A SLUG THE BUILD CANNOT BUILD IS REFUSED AT CREATION =====');
  await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(300);
  await p.click('#seoTabs .pagetab >> nth=6'); await p.waitForTimeout(300);
  {
    const ins = await p.$$('#seoNewPageFields input, #seoNewPageFields textarea');
    await ins[0].fill('A Perfectly Reasonable Page Name'); await p.waitForTimeout(150);
    await ins[1].fill('a-very-long-guide-slug-that-an-author-could-easily-type-in-here-ok');
    await p.waitForTimeout(300);
    const warn = await p.$eval('#seoNewPageWarn', e => e.textContent);
    check('a 66-character slug is reported as too long for the build',
      /too long for the build/i.test(warn), warn.slice(0, 200));
    check('  and the create button is disabled',
      (await p.getAttribute('#btnCreatePage', 'disabled')) !== null);

    /* Sixty-one characters is the longest the generator takes. */
    await ins[1].fill('x'.repeat(61)); await p.waitForTimeout(300);
    check('a 61-character slug is allowed',
      (await p.$eval('#seoNewPageWarn', e => e.textContent)).indexOf('too long') === -1 &&
      (await p.getAttribute('#btnCreatePage', 'disabled')) === null);
  }

  /* And a page the CMS creates DOES get the control, so the guard above is
     a guard and not a removal. */
  console.log('\n===== A PAGE THE CMS CREATES DOES GET THE CONTROL =====');
  {
    const ins = await p.$$('#seoNewPageFields input, #seoNewPageFields textarea');
    await ins[0].fill('Content Model Probe'); await p.waitForTimeout(150);
    await ins[1].fill('content-model-probe'); await p.waitForTimeout(300);
    await p.click('#btnCreatePage'); await p.waitForTimeout(500);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(300);
    await p.click('#pageSubtabSettings'); await p.waitForTimeout(250);
    const tabs = await p.$$('#pageTabs .pagetab');
    let opened = false;
    for (const t of tabs) {
      if ((await t.textContent()).trim() === 'Content Model Probe') {
        await t.click(); await p.waitForTimeout(400); opened = true; break;
      }
    }
    check('the created page opens in the editor', opened);
    const made = await p.$eval('#pageEditor', e => e.textContent);
    check('a CMS-created page IS offered a content type', made.indexOf('Kind of page') > -1);
    check('  and a first-published date, an author and related pages',
      made.indexOf('First published') > -1 && made.indexOf('Author') > -1 &&
      made.indexOf('Related pages') > -1);
    check('  and Publication, as before', made.indexOf('A draft page is not') > -1);
    const opts = await p.$$eval('#pageEditor select', els =>
      els.map(e => Array.from(e.options).map(o => o.value)));
    check('  the type options are the engine\'s own allow-list',
      opts.some(o => ['page', 'article', 'guide', 'help', 'hub'].every(v => o.indexOf(v) > -1)),
      opts);
  }
  /* A hand-edited record can still put a type on a page that ships with the
     site, and with no control there nothing else would show it. The checks
     are where an author already looks. */
  console.log('\n===== A HAND-EDITED TYPE ON A SHIPPED PAGE IS REPORTED =====');
  {
    await p.evaluate(() => { window.CMS.data().pages.about.type = 'article'; });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(250);
    await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(400);
    const dash = await p.$eval('#seoDashboard', e => e.textContent);
    check('a resolving type on a shipped page is reported as unpublishable',
      /ships with the site and has its own template/.test(dash), dash.slice(0, 300));
    check('  and names the type that would not be published', /article/.test(dash));

    /* An UNRECOGNISED type resolves to 'page', so nothing half-applies and
       the message above must not claim it would. */
    await p.evaluate(() => { window.CMS.data().pages.about.type = 'nonsense'; });
    await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(200);
    await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(400);
    const dash2 = await p.$eval('#seoDashboard', e => e.textContent);
    check('an unrecognised type is reported as not a type this site knows',
      /not one this site knows/.test(dash2), dash2.slice(0, 300));
    check('  and is NOT also described as unpublishable Article data',
      !/ships with the site and has its own template/.test(dash2));

    await p.evaluate(() => { delete window.CMS.data().pages.about.type; });
    await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(200);
    await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(400);
    const dash3 = await p.$eval('#seoDashboard', e => e.textContent);
    check('with no type set, neither message appears',
      !/ships with the site and has its own template/.test(dash3) &&
      !/not one this site knows/.test(dash3));
  }

  /* ================================================================
     PHASE 2F: CATEGORIES AND TAGS IN THE PANEL
     The engine is tested in tests/test_taxonomy.js. This is the half an
     editor touches: creating one, naming it, assigning it, being told what
     removing it costs, and being told when a reference stopped resolving.
     ================================================================ */
  console.log('\n===== CATEGORIES AND TAGS: THE EDITOR\'S HALF =====');
  {
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(350);
    check('the Categories card is in the Pages panel', await p.isVisible('#categoriesHost'));
    check('the Tags card is too', await p.isVisible('#tagsHost'));
    check('an empty collection says so rather than showing nothing',
      /No categories yet/.test(await p.$eval('#categoriesHost', e => e.textContent)),
      await p.$eval('#categoriesHost', e => e.textContent));
    check('  and says content without one publishes exactly as it does now',
      /publishes exactly as it does now/.test(await p.$eval('#tagsHost', e => e.textContent)));
    check('the card states that NO category page is generated',
      /No category page is generated/i.test(await p.$eval('#panel-pages', e => e.innerHTML)));
    check('  and that nothing is added to the sitemap',
      /added to.*sitemap/is.test(await p.$eval('#panel-pages', e => e.innerHTML)));

    /* Creating one, through the real button and the real prompt. */
    const answer = v => p.once('dialog', d => v === null ? d.dismiss() : d.accept(v));
    answer('Cricket News');
    await p.click('#btnAddCategory'); await p.waitForTimeout(300);
    const made = await p.evaluate(() => JSON.parse(JSON.stringify(window.CMS.data().categories)));
    const catIds = Object.keys(made);
    check('the category was created', catIds.length === 1, made);
    check('  with a slugified id derived from the name',
      catIds[0] === 'cricket-news', catIds[0]);
    check('  the name exactly as typed', made[catIds[0]].name === 'Cricket News');
    check('  and a slug, which is a handle and not a URL',
      made[catIds[0]].slug === 'cricket-news');
    check('the card now shows the id an editor must refer to',
      (await p.$eval('#categoriesHost', e => e.textContent)).indexOf('cricket-news') > -1);
    check('  and that no page uses it yet',
      /no page uses it/.test(await p.$eval('#categoriesHost', e => e.textContent)));

    /* The same name twice is a mistake, not a second topic. */
    answer('cricket news');
    await p.click('#btnAddCategory'); await p.waitForTimeout(300);
    check('a duplicate name is refused, case-insensitively',
      Object.keys(await p.evaluate(() => window.CMS.data().categories)).length === 1);
    /* A different name that slugifies the same way is a different topic and
       gets its own id rather than overwriting one. */
    answer('Cricket  News!');
    await p.click('#btnAddCategory'); await p.waitForTimeout(300);
    const two = await p.evaluate(() => JSON.parse(JSON.stringify(window.CMS.data().categories)));
    check('a different name whose slug collides gets a distinct id',
      Object.keys(two).length === 2 && Object.keys(two).indexOf('cricket-news-2') > -1,
      Object.keys(two));

    /* An empty name, and a cancelled prompt, add nothing. */
    answer('   ');
    await p.click('#btnAddCategory'); await p.waitForTimeout(250);
    answer(null);
    await p.click('#btnAddCategory'); await p.waitForTimeout(250);
    check('neither a blank name nor a cancelled prompt creates anything',
      Object.keys(await p.evaluate(() => window.CMS.data().categories)).length === 2);

    answer('IPL');
    await p.click('#btnAddTag'); await p.waitForTimeout(300);
    answer('2026');
    await p.click('#btnAddTag'); await p.waitForTimeout(300);
    const tags = await p.evaluate(() => JSON.parse(JSON.stringify(window.CMS.data().tags)));
    check('two tags were created with their own ids',
      Object.keys(tags).sort().join() === '2026,ipl', Object.keys(tags));
    check('  and a numeric name still produces a usable slug',
      tags['2026'].slug === '2026', tags['2026']);
  }

  console.log('\n===== A CATEGORY IS OFFERED ONLY WHERE IT IS PUBLISHED =====');
  {
    /* A page the CMS created, which is the only kind that gets a content
       type at all -- so it is the only kind that can carry a topic. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.pages['tax-demo'] = JSON.parse(JSON.stringify(d.pages.about));
      const t = d.pages['tax-demo'];
      t.label = 'Tax demo'; t.url = 'tax-demo.html'; t.slug = 'tax-demo';
      t.title = 'Tax demo'; t.heading = 'Tax demo'; t.type = 'article';
      delete t.category; delete t.tags;
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(450);

    /* The same way the content-model section above opens a page: the
       Settings sub-tab, then the page's own tab by its label. */
    const open = async () => {
      await p.click('#pageSubtabSettings'); await p.waitForTimeout(250);
      for (const t of await p.$$('#pageTabs .pagetab')) {
        if ((await t.textContent()).trim() === 'Tax demo') {
          await t.click(); await p.waitForTimeout(450); return true;
        }
      }
      return false;
    };
    check('the CMS-created page opens in the editor', await open());
    const ed = await p.$eval('#pageEditor', e => e.textContent);
    check('an article IS offered a category', ed.indexOf('Category') > -1);
    check('  and tags', ed.indexOf('Tags') > -1);
    check('  and is told no category page is generated',
      /No category page is generated/i.test(ed));

    /* Assigning: the select carries every category, by name, with the id as
       the value -- so renaming one later changes every page at once. */
    const catSel = await p.$('#pageEditor select:below(:text("Category"))') ||
      (await p.$$('#pageEditor select')).slice(-1)[0];
    const optionSets = await p.$$eval('#pageEditor select', els =>
      els.map(e => Array.from(e.options).map(o => o.value + '|' + o.textContent)));
    const catOpts = optionSets.filter(o => o.some(x => /\|Cricket News$/.test(x)))[0];
    check('the category select offers every category by NAME, valued by id',
      !!catOpts && catOpts.indexOf('cricket-news|Cricket News') > -1, optionSets);
    check('  with a (none) option, because a category is optional',
      !!catOpts && catOpts.some(x => /\|\(none\)$/.test(x)), catOpts);

    await p.evaluate(() => {
      const sels = Array.from(document.querySelectorAll('#pageEditor select'));
      const sel = sels.filter(s => Array.from(s.options)
        .some(o => o.value === 'cricket-news'))[0];
      sel.value = 'cricket-news';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await p.waitForTimeout(250);
    check('choosing a category stores its ID, not its name',
      (await p.evaluate(() => window.CMS.data().pages['tax-demo'].category)) === 'cricket-news');

    /* Tags are checkboxes for the same reason related pages are: a typed id
       that does not resolve publishes nothing and explains nothing. */
    const ticked = await p.evaluate(() => {
      const boxes = Array.from(document.querySelectorAll('#pageEditor .cb'));
      const want = boxes.filter(l => /^(IPL|2026)$/.test(l.textContent.trim()));
      want.forEach(l => {
        const cb = l.querySelector('input[type=checkbox]');
        cb.checked = true;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
      return want.length;
    });
    check('both tags are offered as checkboxes', ticked === 2, ticked);
    const storedTags = await p.evaluate(() => window.CMS.data().pages['tax-demo'].tags);
    check('ticking them stores their ids', (storedTags || []).slice().sort().join() === '2026,ipl',
      storedTags);

    /* Unticking removes the id, and the last one removes the key entirely so
       the record goes back to the shape it shipped with. */
    await p.evaluate(() => {
      Array.from(document.querySelectorAll('#pageEditor .cb'))
        .filter(l => /^2026$/.test(l.textContent.trim()))
        .forEach(l => {
          const cb = l.querySelector('input[type=checkbox]');
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    await p.waitForTimeout(200);
    check('unticking a tag removes just that id',
      JSON.stringify(await p.evaluate(() => window.CMS.data().pages['tax-demo'].tags)) ===
      JSON.stringify(['ipl']));

    /* A page that ships with the site has no content type, so it has no
       topic either -- and the control says why rather than being absent. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.pages['tax-demo'].type = 'page';
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(400);
    check('the plain page reopens', await open());
    const plainEd = await p.$eval('#pageEditor', e => e.textContent);
    check('a plain page is told only an Article, Guide, Help page or Hub carries a category',
      /Only an Article, Guide, Help page or Hub carries a category/.test(plainEd), plainEd.slice(0, 200));
    const disabled = await p.$$eval('#pageEditor select', els =>
      els.filter(e => e.disabled).length);
    check('  and the select is disabled rather than removed', disabled >= 1, disabled);
  }

  console.log('\n===== THE CHECKS SAY WHAT STOPPED RESOLVING =====');
  {
    const dashFor = async mutate => {
      await p.evaluate(mutate);
      await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
      await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(150);
      await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(450);
      return p.$eval('#seoDashboard', e => e.textContent);
    };

    const resolved = await dashFor(() => {
      const t = window.CMS.data().pages['tax-demo'];
      t.type = 'article'; t.category = 'cricket-news'; t.tags = ['ipl', '2026'];
    });
    check('a resolving category is reported by name',
      /Category resolves to Cricket News/.test(resolved), resolved.slice(0, 400));
    check('  and the tags are counted', /2 tag\(s\) published/.test(resolved));

    const dangling = await dashFor(() => {
      const t = window.CMS.data().pages['tax-demo'];
      t.category = 'no-such-thing'; t.tags = ['ipl', 'also-missing'];
    });
    check('a category id that resolves to nothing is reported as publishing nothing',
      /does not resolve to a category with a name/.test(dangling), dangling.slice(0, 500));
    check('  and names the id that failed', /no-such-thing/.test(dangling));
    check('a tag that resolves to nothing is reported too',
      /do not resolve to a tag with a name/.test(dangling) && /also-missing/.test(dangling));
    check('  and the tag that DID resolve is still counted',
      /1 tag\(s\) published/.test(dangling));

    const wrongType = await dashFor(() => {
      const t = window.CMS.data().pages['tax-demo'];
      t.type = 'page'; t.category = 'cricket-news'; t.tags = ['ipl'];
    });
    check('taxonomy on a kind of page that does not publish it is reported as ignored',
      /does not publish them/.test(wrongType), wrongType.slice(0, 500));

    const thin = await dashFor(() => {
      const t = window.CMS.data().pages['tax-demo'];
      t.type = 'article'; delete t.category; t.tags = ['ipl'];
    });
    check('one tag and no category is reported as nothing for automatic matching to use',
      /nothing to match on/.test(thin), thin.slice(0, 500));
    check('  and says what would fix it', /two tags in common/.test(thin));

    /* An article nobody has categorised yet says NOTHING. An absent field
       produces no message anywhere else in this panel, and a warning on
       every newly created article would be noise. */
    const untouched = await dashFor(() => {
      const t = window.CMS.data().pages['tax-demo'];
      t.type = 'article'; delete t.category; delete t.tags;
    });
    check('an article with no taxonomy at all is not nagged about it',
      !/nothing to match on/.test(untouched), untouched.slice(0, 400));

    const clean = await dashFor(() => {
      const t = window.CMS.data().pages['tax-demo'];
      delete t.category; delete t.tags;
    });
    check('with no taxonomy set, none of those messages appears',
      !/does not resolve to a category/.test(clean) &&
      !/do not resolve to a tag/.test(clean) &&
      !/does not publish them/.test(clean) &&
      !/nothing to match on/.test(clean), clean.slice(0, 300));
  }

  console.log('\n===== REMOVING A CATEGORY STATES WHAT IT COSTS =====');
  {
    await p.evaluate(() => { window.CMS.data().pages['tax-demo'].category = 'cricket-news'; });
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(450);
    const used = await p.$eval('#categoriesHost', e => e.textContent);
    check('the card counts the pages that use it', /1 page uses it/.test(used), used.slice(0, 300));

    let asked = '';
    p.once('dialog', d => { asked = d.message(); d.dismiss(); });
    await p.click('#categoriesHost .card[data-taxon="categories:cricket-news"] button');
    await p.waitForTimeout(300);
    check('removing a category in use asks first',
      /1 page\(s\) refer to it/.test(asked), asked);
    check('  and says references stop resolving rather than breaking',
      /stop resolving/.test(asked) && /nothing shown/.test(asked), asked);
    check('  and dismissing it removes nothing',
      !!(await p.evaluate(() => window.CMS.data().categories['cricket-news'])));

    p.once('dialog', d => d.accept());
    await p.click('#categoriesHost .card[data-taxon="categories:cricket-news"] button');
    await p.waitForTimeout(400);
    check('confirming removes it',
      !(await p.evaluate(() => !!window.CMS.data().categories['cricket-news'])));
    check('  and the page keeps its now-dangling id rather than being silently edited',
      (await p.evaluate(() => window.CMS.data().pages['tax-demo'].category)) === 'cricket-news');

    /* A dangling id must still be visible in the editor, not vanish. */
    await p.click('#pageSubtabSettings'); await p.waitForTimeout(250);
    for (const t of await p.$$('#pageTabs .pagetab')) {
      if ((await t.textContent()).trim() === 'Tax demo') {
        await t.click(); await p.waitForTimeout(450); break;
      }
    }
    const ghost = await p.$$eval('#pageEditor select', els =>
      els.map(e => Array.from(e.options).map(o => o.textContent)).flat());
    check('the editor shows the dangling id as "(no such category)" rather than dropping it',
      ghost.some(t => /cricket-news \(no such category\)/.test(t)), ghost);

    /* A dangling TAG needs the same: a reference the panel does not show is
       one an editor cannot clear. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.pages['tax-demo'].tags = ['ipl', 'deleted-tag'];
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(400);
    await p.click('#pageSubtabSettings'); await p.waitForTimeout(250);
    for (const t of await p.$$('#pageTabs .pagetab')) {
      if ((await t.textContent()).trim() === 'Tax demo') {
        await t.click(); await p.waitForTimeout(450); break;
      }
    }
    const cbText = await p.$$eval('#pageEditor .cb', els => els.map(e => e.textContent.trim()));
    check('a dangling tag id is shown as "(no such tag)" and stays ticked',
      cbText.some(t => /^deleted-tag \(no such tag\)$/.test(t)), cbText);
    await p.evaluate(() => {
      Array.from(document.querySelectorAll('#pageEditor .cb'))
        .filter(l => /no such tag/.test(l.textContent))
        .forEach(l => {
          const cb = l.querySelector('input[type=checkbox]');
          cb.checked = false;
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
    });
    await p.waitForTimeout(250);
    check('  and unticking it is how an editor clears it',
      JSON.stringify(await p.evaluate(() => window.CMS.data().pages['tax-demo'].tags)) ===
      JSON.stringify(['ipl']),
      await p.evaluate(() => window.CMS.data().pages['tax-demo'].tags));
  }

  console.log('\n===== TWO CATEGORIES FOR ONE TOPIC IS WORTH SAYING =====');
  {
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.categories = { one: { name: 'One', slug: 'same' }, two: { name: 'Two', slug: 'same' } };
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(450);
    const dup = await p.$eval('#categoriesHost', e => e.textContent);
    check('two categories sharing a slug are flagged', /Shares its slug/.test(dup), dup.slice(0, 400));
    check('  and it is stated as a split topic, not a broken build',
      /Nothing breaks/.test(dup) && /split it/.test(dup));
  }

  console.log('\n===== THE TAG CAP IS DISCLOSED, AND NOT MISREPORTED =====');
  {
    const seed = n => p.evaluate((count) => {
      const d = window.CMS.data();
      d.tags = {};
      for (let i = 1; i <= 20; i++) d.tags['t' + i] = { name: 'Tag ' + i, slug: 't' + i };
      d.categories = {};
      const t = d.pages['tax-demo'];
      t.type = 'article';
      delete t.category;
      t.tags = Array.from({ length: count }, (_, i) => 't' + (i + 1));
    }, n);
    const dash = async n => {
      await seed(n);
      await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
      await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(150);
      await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(450);
      return p.$eval('#seoDashboard', e => e.textContent);
    };

    const d12 = await dash(12);
    check('exactly 12 tags publishes 12 and says nothing about a cap',
      /12 tag\(s\) published/.test(d12) && !/only the first/.test(d12), d12.slice(0, 400));

    const d13 = await dash(13);
    check('13 tags warns that only the first 12 are published',
      /only the first 12 are published/.test(d13), d13.slice(0, 600));
    check('  and says how many resolve', /13 of this page.s tags resolve/.test(d13));
    check('  and names the one that was dropped',
      /One was dropped: ?Tag 13/.test(d13.replace(/\s+/g, ' ')), d13.slice(0, 600));
    check('  and says how to choose which 12', /Untick 1 to choose which 12/.test(d13));
    check('  it still reports 12 published', /12 tag\(s\) published/.test(d13));
    /* The defect this fix exists for: the 13th tag is REAL, and the old
       message called it a tag that does not resolve. */
    check('  and does NOT claim the dropped tag fails to resolve',
      !/do not resolve to a tag with a name/.test(d13), d13.slice(0, 600));

    const d20 = await dash(20);
    check('20 tags names all 8 dropped tags', /8 were dropped/.test(d20), d20.slice(0, 700));
    check('  and lists them by name',
      ['Tag 13', 'Tag 20'].every(n => d20.indexOf(n) > -1), d20.slice(0, 700));
    check('  and still does not call any of them unresolvable',
      !/do not resolve to a tag with a name/.test(d20));

    /* Both causes at once must produce BOTH messages, each about the right
       tags -- the two are no longer one. */
    await p.evaluate(() => {
      const t = window.CMS.data().pages['tax-demo'];
      t.tags = Array.from({ length: 13 }, (_, i) => 't' + (i + 1)).concat(['ghost-tag']);
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(150);
    await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(450);
    const both = await p.$eval('#seoDashboard', e => e.textContent);
    check('a dangling tag AND an over-cap tag produce two different messages',
      /do not resolve to a tag with a name/.test(both) &&
      /only the first 12 are published/.test(both), both.slice(0, 700));
    check('  the dangling one is named as dangling', /ghost-tag/.test(both));
    check('  and the capped count ignores the dangling one',
      /13 of this page.s tags resolve/.test(both), both.slice(0, 700));

    const d1 = await dash(1);
    check('back at one tag, the cap message is gone', !/only the first/.test(d1));
  }

  console.log('\n===== A NAME WHOSE ID COULD NEVER RESOLVE IS STILL USABLE =====');
  {
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.categories = {}; d.tags = {};
      const t = d.pages['tax-demo'];
      t.type = 'article'; delete t.category; delete t.tags;
    });
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(450);

    const answer = v => p.once('dialog', d => v === null ? d.dismiss() : d.accept(v));
    answer('Prototype');
    await p.click('#btnAddCategory'); await p.waitForTimeout(350);
    answer('Constructor');
    await p.click('#btnAddCategory'); await p.waitForTimeout(350);
    answer('Cricket');
    await p.click('#btnAddCategory'); await p.waitForTimeout(350);
    const cats = await p.evaluate(() => JSON.parse(JSON.stringify(window.CMS.data().categories)));
    const catIds = Object.keys(cats).sort();
    check('all three categories were created', catIds.length === 3, cats);
    check('  "Prototype" did NOT take the id `prototype`', catIds.indexOf('prototype') === -1, catIds);
    check('  it took `prototype-2` instead', catIds.indexOf('prototype-2') > -1, catIds);
    check('  "Constructor" took `constructor-2`', catIds.indexOf('constructor-2') > -1, catIds);
    check('  and neither reserved key is an own property of the collection',
      !Object.prototype.hasOwnProperty.call(cats, 'constructor') &&
      !Object.prototype.hasOwnProperty.call(cats, 'prototype'), catIds);
    check('  the NAMES the author typed are kept exactly',
      (cats['prototype-2'] || {}).name === 'Prototype' &&
      (cats['constructor-2'] || {}).name === 'Constructor', cats);
    check('  an ordinary name is unaffected', catIds.indexOf('cricket') > -1, catIds);

    /* The point of the fix: these ids now RESOLVE, so a page can publish them. */
    const resolves = await p.evaluate(() => {
      const d = window.CMS.data();
      return ['prototype-2', 'constructor-2', 'cricket'].map(id => {
        const r = window.CMS.content.taxonFrom(d.categories, id);
        return r ? r.name : null;
      });
    });
    check('every created category id resolves through the engine',
      JSON.stringify(resolves) === JSON.stringify(['Prototype', 'Constructor', 'Cricket']), resolves);

    /* And end to end: assign it to a page and see the checks accept it. */
    await p.evaluate(() => { window.CMS.data().pages['tax-demo'].category = 'prototype-2'; });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(150);
    await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(450);
    const dash = await p.$eval('#seoDashboard', e => e.textContent);
    check('a page using it is reported as resolving, not dangling',
      /Category resolves to Prototype/.test(dash), dash.slice(0, 400));

    /* A tag goes down the same path. */
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(400);
    answer('Prototype');
    await p.click('#btnAddTag'); await p.waitForTimeout(350);
    const tagIds = Object.keys(await p.evaluate(() => window.CMS.data().tags));
    check('a TAG named "Prototype" gets the same treatment',
      tagIds.indexOf('prototype-2') > -1 && tagIds.indexOf('prototype') === -1, tagIds);

    /* A SLUG is still slugify(name), so "Constructor" yields the slug
       `constructor` even though the id is `constructor-2`. The card list
       indexes entries BY SLUG to spot duplicates, and in a plain object that
       key read back as Object.prototype.constructor -- a function -- so
       .push threw and the whole list stopped rendering. */
    const cardIds = await p.$$eval('#categoriesHost .card', els =>
      els.map(e => e.getAttribute('data-taxon')));
    check('a category whose SLUG is a reserved word still renders its card',
      cardIds.length === 3, cardIds);
    check('  including the one slugged "constructor"',
      cardIds.indexOf('categories:constructor-2') > -1, cardIds);
    const counts = await p.$$eval('#categoriesHost .card .hint', els =>
      els.map(e => e.textContent.trim()));
    check('  and its use count is a real count, not a stringified function',
      counts.every(t => /^(no page uses it|\d+ pages? uses? it|\d+ page uses it)$/.test(t)),
      counts);
    check('  the page using prototype-2 is counted as exactly one',
      counts.indexOf('1 page uses it') > -1, counts);

    /* Nothing was polluted by minting any of those ids. */
    const clean = await p.evaluate(() => ({
      protoName: ({}).name === undefined,
      protoHasName: 'name' in Object.prototype,
      objIsClean: JSON.stringify({}) === '{}'
    }));
    check('Object.prototype was not polluted by the probe',
      clean.protoName && !clean.protoHasName && clean.objIsClean, clean);
  }

  console.log('\n===== AUTHORS: A NAME THE ENGINE REFUSES IS STILL USABLE =====');
  {
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.authors = {};
      d.categories = {}; d.tags = {};
      const t = d.pages['tax-demo'];
      t.type = 'article'; delete t.category; delete t.tags; delete t.author;
    });
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(450);
    check('the Authors card is present', await p.isVisible('#authorsHost'));

    const answer = v => p.once('dialog', d => v === null ? d.dismiss() : d.accept(v));
    for (const name of ['Ada Lovelace', 'Constructor', 'Prototype']) {
      answer(name);
      await p.click('#btnAddAuthor'); await p.waitForTimeout(350);
    }
    const authors = await p.evaluate(() => JSON.parse(JSON.stringify(window.CMS.data().authors)));
    const aIds = Object.keys(authors).sort();
    check('all three authors were created', aIds.length === 3, aIds);
    check('  a normal name still gets its plain id', aIds.indexOf('ada-lovelace') > -1, aIds);
    check('  "Constructor" did NOT take the id `constructor`',
      aIds.indexOf('constructor') === -1, aIds);
    check('  it took `constructor-2` instead', aIds.indexOf('constructor-2') > -1, aIds);
    check('  "Prototype" took `prototype-2`', aIds.indexOf('prototype-2') > -1, aIds);
    check('  neither reserved key is an own property of the collection',
      !Object.prototype.hasOwnProperty.call(authors, 'constructor') &&
      !Object.prototype.hasOwnProperty.call(authors, 'prototype'), aIds);
    check('  the NAMES the author typed are kept exactly',
      (authors['constructor-2'] || {}).name === 'Constructor' &&
      (authors['prototype-2'] || {}).name === 'Prototype', authors);

    /* The point of the fix: the engine resolves every id the panel minted. */
    const resolved = await p.evaluate(() => {
      const d = window.CMS.data();
      return ['ada-lovelace', 'constructor-2', 'prototype-2']
        .map(id => { const r = window.CMS.content.authorFrom(d.authors, id); return r ? r.name : null; });
    });
    check('every created author id resolves through the engine',
      JSON.stringify(resolved) === JSON.stringify(['Ada Lovelace', 'Constructor', 'Prototype']),
      resolved);

    /* End to end: name one on a page and see the checks accept the byline. */
    await p.evaluate(() => { window.CMS.data().pages['tax-demo'].author = 'constructor-2'; });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('#seoTabs .pagetab >> nth=1'); await p.waitForTimeout(150);
    await p.click('#seoTabs .pagetab >> nth=0'); await p.waitForTimeout(450);
    const dash = await p.$eval('#seoDashboard', e => e.textContent);
    check('a page naming it is reported as resolving, not dangling',
      /Author resolves to Constructor/.test(dash), dash.slice(0, 400));
  }

  console.log('\n===== AUTHORS: THE USE COUNT IS A NUMBER, AND IT IS RIGHT =====');
  {
    /* Three pages naming `constructor-2`, one naming ada, none naming
       prototype-2 -- so all three card states appear at once. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      ['ref-a', 'ref-b'].forEach(k => {
        d.pages[k] = JSON.parse(JSON.stringify(d.pages['tax-demo']));
        d.pages[k].label = k; d.pages[k].url = k + '.html'; d.pages[k].slug = k;
        d.pages[k].author = 'constructor-2';
      });
      d.pages['tax-demo'].author = 'constructor-2';
      d.pages.about.author = 'ada-lovelace';
    });
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(500);

    const cards = await p.$$eval('#authorsHost .card', els => els.map(e => ({
      id: e.getAttribute('data-author'),
      hint: (e.querySelector('.hint') || {}).textContent || ''
    })));
    check('every author still renders a card', cards.length === 3, cards);
    const byId = {};
    cards.forEach(c => { byId[c.id] = c.hint.trim(); });
    check('three pages naming an author reads "3 pages name them"',
      byId['constructor-2'] === '3 pages name them', byId);
    check('  and it is a count, not a stringified function',
      !/function|native code/.test(byId['constructor-2'] || ''), byId['constructor-2']);
    check('one page reads the SINGULAR "1 page names them"',
      byId['ada-lovelace'] === '1 page names them', byId);
    check('nobody naming an author reads "no page names them"',
      byId['prototype-2'] === 'no page names them', byId);
    check('no card hint contains a concatenated number like "11"',
      cards.every(c => /^(no page names them|\d+ pages? names? them|\d+ page names them)$/
        .test(c.hint.trim())), cards.map(c => c.hint.trim()));

    /* Removing one states the real cost, with the real number. */
    let asked = '';
    p.once('dialog', d => { asked = d.message(); d.dismiss(); });
    const delBtn = await p.$('#authorsHost .card[data-author="constructor-2"] button');
    if (delBtn) { await delBtn.click(); await p.waitForTimeout(300); }
    check('the author card offers a Remove button', !!delBtn);
    check('removing an author in use names the real number of pages',
      /3 page\(s\) refer to them/.test(asked), asked);
    check('  and not a stringified function', !/function|native code/.test(asked), asked);
    check('  dismissing removes nothing',
      !!(await p.evaluate(() => window.CMS.data().authors['constructor-2'])));

    /* Incrementing: add one more reference and the count moves by exactly 1. */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.pages['ref-c'] = JSON.parse(JSON.stringify(d.pages['ref-a']));
      d.pages['ref-c'].label = 'ref-c'; d.pages['ref-c'].url = 'ref-c.html';
      d.pages['ref-c'].slug = 'ref-c';
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(500);
    const after = await p.$eval('#authorsHost .card[data-author="constructor-2"] .hint',
      e => e.textContent.trim());
    check('a fourth reference increments the count to exactly 4',
      after === '4 pages name them', after);

    /* THE ONLY WAY THE COUNT BUG IS STILL REACHABLE. The id fix means the
       panel never mints `constructor` again, so the tally can only meet that
       key in a record written before the fix or edited by hand. That is
       exactly the record this seeds: an OWN `constructor` key in authors,
       named by two pages. Without the prototype-free map the card read
       "function Object() { [native code] }11 pages name them". */
    await p.evaluate(() => {
      const d = window.CMS.data();
      d.authors['constructor'] = { name: 'Legacy Constructor' };
      d.authors['prototype'] = { name: 'Legacy Prototype' };
      ['legacy-a', 'legacy-b'].forEach(k => {
        d.pages[k] = JSON.parse(JSON.stringify(d.pages['ref-a']));
        d.pages[k].label = k; d.pages[k].url = k + '.html'; d.pages[k].slug = k;
        d.pages[k].author = 'constructor';
      });
    });
    await p.click('.adm-nav-item[data-panel="seo"]'); await p.waitForTimeout(200);
    await p.click('.adm-nav-item[data-panel="pages"]'); await p.waitForTimeout(500);
    const legacy = await p.$$eval('#authorsHost .card', els => els.map(e => ({
      id: e.getAttribute('data-author'),
      hint: ((e.querySelector('.hint') || {}).textContent || '').trim()
    })));
    const legacyBy = {};
    legacy.forEach(c => { legacyBy[c.id] = c.hint; });
    check('a legacy `constructor` author id still renders a card',
      legacyBy['constructor'] !== undefined, legacy);
    check('  and its count is the NUMBER 2, not a stringified function',
      legacyBy['constructor'] === '2 pages name them', legacyBy['constructor']);
    check('  with no "native code" anywhere in it',
      !/function|native code/.test(legacyBy['constructor'] || ''), legacyBy['constructor']);
    check('a legacy `prototype` id nobody names reads "no page names them"',
      legacyBy['prototype'] === 'no page names them', legacyBy['prototype']);
    check('  and every hint on the card list is a clean count',
      legacy.every(c => /^(no page names them|\d+ pages name them|\d+ page names them)$/
        .test(c.hint)), legacy.map(c => c.id + ': ' + c.hint));
    /* The engine still refuses to resolve it -- the fix is the COUNT, not a
       change to what authorFrom() accepts. */
    const legacyResolves = await p.evaluate(() =>
      window.CMS.content.authorFrom(window.CMS.data().authors, 'constructor'));
    check('  the engine still refuses that legacy id, as it should',
      legacyResolves === null, legacyResolves);

    /* And the whole time, nothing polluted the prototype. */
    const clean = await p.evaluate(() => ({
      noName: ({}).name === undefined,
      noInherited: !('ada-lovelace' in Object.prototype),
      clean: JSON.stringify({}) === '{}'
    }));
    check('Object.prototype was not polluted', clean.noName && clean.noInherited && clean.clean, clean);
  }

  check('no admin console errors after the content-model checks', errs.length === 0, errs);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if(fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail?1:0);
})();
