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

  check('no admin console errors after the content-model checks', errs.length === 0, errs);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if(fails.length) console.log('FAILED:', fails.join(' | '));
  await b.close();
  process.exit(fail?1:0);
})();
