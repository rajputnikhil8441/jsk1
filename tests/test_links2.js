const { chromium } = require('playwright');
const BASE='http://localhost:8777';
let pass=0,fail=0;const fails=[];
const check=(n,c,e)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,fails.push(n),console.log('  FAIL  '+n+(e!==undefined?' -> '+JSON.stringify(e):'')))};
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:1280,height:900}});
  await ctx.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const p=await ctx.newPage();

  console.log('\n===== LINK INTEGRITY =====');
  for (const f of ['index.html','about.html','contact.html','responsible-gaming.html','login.html','register.html','404.html']) {
    await p.goto(`${BASE}/${f}`,{waitUntil:'domcontentloaded'});
    const hrefs=await p.$$eval('a[href]',as=>[...new Set(as.map(a=>a.getAttribute('href')))].filter(h=>h&&!/^(#|https?:|mailto:|tel:)/.test(h)));
    const bad=[];
    for (const h of hrefs) { const r=await p.request.get(`${BASE}/${h==='./'?'':h}`); if(!r.ok()) bad.push(h+' -> '+r.status()); }
    check(`${f}: all ${hrefs.length} internal links resolve (incl. "./")`, bad.length===0, bad);
    const assets=await p.$$eval('link[href],script[src],img[src]',es=>es.map(e=>e.getAttribute('href')||e.getAttribute('src')).filter(u=>u&&!/^https?:|^data:/.test(u)));
    const badA=[];
    for (const a of [...new Set(assets)]) { const r=await p.request.get(`${BASE}/${a}`); if(!r.ok()) badA.push(a+' -> '+r.status()); }
    check(`${f}: every local asset resolves, no exceptions`, badA.length===0, badA);
  }

  console.log('\n===== NAVIGATION =====');
  await p.goto(`${BASE}/about.html`,{waitUntil:'networkidle'});
  await p.click('.breadcrumb a'); await p.waitForLoadState('domcontentloaded');
  check('breadcrumb Home goes to the site root', /\/(index\.html)?$/.test(new URL(p.url()).pathname), p.url());
  await p.goto(`${BASE}/about.html`,{waitUntil:'networkidle'});
  await p.click('.footer-nav a:has-text("Contact")'); await p.waitForLoadState('domcontentloaded');
  check('footer nav works', p.url().endsWith('/contact.html'), p.url());
  check('active nav state still correct after the change', (await p.textContent('.nav-link.active')).trim()==='CONTACT');
  await p.click('.info-nav-bar .nav-link:has-text("RESPONSIBLE")'); await p.waitForLoadState('domcontentloaded');
  check('top nav still works', p.url().endsWith('/responsible-gaming.html'));
  await p.click('.pagemenu-btn');
  check('pages dropdown still opens', await p.isVisible('.pagemenu.open .pagemenu-list'));
  await p.goto(`${BASE}/404.html`,{waitUntil:'networkidle'});
  await p.click('.info-body a[href="./"]'); await p.waitForLoadState('domcontentloaded');
  check('404 links back to the homepage', /\/(index\.html)?$/.test(new URL(p.url()).pathname), p.url());

  console.log('\n===== LOGIN / REGISTER STILL WORK =====');
  await p.goto(`${BASE}/login.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(200);
  check('password field is type=password', await p.getAttribute('#surname','type')==='password');
  check('username has autocomplete hint', await p.getAttribute('#firstName','autocomplete')==='username');
  await p.fill('#firstName','tester'); await p.fill('#surname','secret');
  await p.click('.btn-login-submit'); await p.waitForTimeout(250);
  check('login form still submits and clears locally', (await p.inputValue('#firstName'))==='' && (await p.inputValue('#surname'))==='');
  check('login title correct', (await p.title())==='Login — JSK1', await p.title());
  await p.click('#contactLink'); await p.waitForLoadState('domcontentloaded');
  check('"Register here" still navigates', p.url().endsWith('/register.html'));
  check('register title correct (no homepage leak)', (await p.title())==='Register — JSK1', await p.title());
  await p.goto(`${BASE}/register.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(200);
  check('register form fields still present', (await p.$$('#regForm input')).length>=4);
  check('register password fields still type=password', (await p.$$eval('#regForm input[type=password]',e=>e.length))===2);

  console.log('\n===== HOMEPAGE FUNCTIONALITY =====');
  await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
  check('casino grid rendered', (await p.$$('.casino-card')).length>0);
  check('sport tabs clickable', (await p.$$('.sport-tab')).length>0);
  check('login gate still armed', await p.evaluate(()=>{const u=location.href;document.querySelector('.casino-card').click();return !!document.getElementById('gateToast')||location.href!==u}));
  check('marquee ticker present', await p.isVisible('#headerTicker'));
  check('whatsapp float present', await p.isVisible('.whatsapp-float'));
  check('homepage H1 is visible (not hidden)', await p.evaluate(()=>{
    const h=document.querySelector('.page-headline h1'); const s=getComputedStyle(h); const r=h.getBoundingClientRect();
    return s.display!=='none'&&s.visibility!=='hidden'&&parseFloat(s.fontSize)>=12&&parseFloat(s.opacity)===1&&r.width>50&&r.height>10&&r.top>=0;
  }));
  check('homepage H1 colour is not hidden against its background', await p.evaluate(()=>{
    const h=document.querySelector('.page-headline h1');
    return getComputedStyle(h).color!==getComputedStyle(h.parentElement).backgroundColor;
  }));

  console.log('\n===== OVERFLOW SWEEP =====');
  for (const w of [320,360,375,390,414,768,1024,1440]) {
    const c=await b.newContext({viewport:{width:w,height:800}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const v=await c.newPage(); const over=[];
    for (const f of ['index.html','about.html','contact.html','responsible-gaming.html','404.html','login.html','register.html']) {
      await v.goto(`${BASE}/${f}`,{waitUntil:'networkidle'}); await v.waitForTimeout(120);
      if (await v.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1)) over.push(f);
    }
    check(`${w}px: no horizontal overflow on any page`, over.length===0, over);
    await c.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if(fails.length)console.log('FAILED:',fails.join(' | '));
  await b.close(); process.exit(fail?1:0);
})();
