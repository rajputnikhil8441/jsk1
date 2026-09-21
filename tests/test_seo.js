const { chromium } = require('playwright');
const BASE = 'http://localhost:8777';
let pass=0, fail=0; const fails=[];
const check=(n,c,e)=>{ c?(pass++,console.log('  PASS  '+n)):(fail++,fails.push(n),console.log('  FAIL  '+n+(e!==undefined?' -> '+JSON.stringify(e):''))); };

const EXPECT = {
  'index.html':              { key:'home',    robots:'index,follow',   canon:'https://jsk-1.com/',                          h1:1, sitemap:true  },
  'about.html':              { key:'about',   robots:'index,follow',   canon:'https://jsk-1.com/about.html',                h1:1, sitemap:true  },
  'contact.html':            { key:'contact', robots:'index,follow',   canon:'https://jsk-1.com/contact.html',              h1:1, sitemap:true  },
  'responsible-gaming.html': { key:'responsible-gaming', robots:'index,follow', canon:'https://jsk-1.com/responsible-gaming.html', h1:1, sitemap:true },
  'login.html':              { key:'login',    robots:'noindex,follow', canon:'https://jsk-1.com/login.html',               h1:1, sitemap:false },
  'register.html':           { key:'register', robots:'noindex,follow', canon:'https://jsk-1.com/register.html',            h1:1, sitemap:false },
};

async function head(page){ return page.evaluate(()=>{
  const m=(s,a='content')=>{const e=document.head.querySelector(s);return e?e.getAttribute(a):null};
  return {
    title: document.title,
    desc: m('meta[name="description"]'),
    canon: m('link[rel="canonical"]','href'),
    robots: m('meta[name="robots"]'),
    ogType: m('meta[property="og:type"]'), ogSite: m('meta[property="og:site_name"]'),
    ogTitle: m('meta[property="og:title"]'), ogDesc: m('meta[property="og:description"]'),
    ogUrl: m('meta[property="og:url"]'), ogImage: m('meta[property="og:image"]'),
    twCard: m('meta[name="twitter:card"]'), twTitle: m('meta[name="twitter:title"]'),
    twDesc: m('meta[name="twitter:description"]'), twImage: m('meta[name="twitter:image"]'),
    gverify: m('meta[name="google-site-verification"]'),
    h1s: [...document.querySelectorAll('h1')].map(h=>h.textContent.trim()),
    ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>({id:s.id,txt:s.textContent})),
    html: document.body.innerHTML.length,
    bodyText: document.body.innerText,
    breadcrumbs: document.querySelectorAll('.breadcrumb').length,
    footerNav: document.querySelectorAll('.footer-nav a').length,
    indexHtmlLinks: document.querySelectorAll('a[href="index.html"]').length,
    lazyImgs: document.querySelectorAll('img[loading="lazy"]').length,
    imgsNoDim: [...document.querySelectorAll('img')].filter(i=>i.src.includes('/games/') && !i.getAttribute('width')).length,
  };
});}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // ---------- A. SUPABASE EMPTY (worst realistic case: defaults only) ----------
  console.log('\n===== A. Supabase returns nothing (defaults + static only) =====');
  for (const [f, exp] of Object.entries(EXPECT)) {
    const c = await browser.newContext({viewport:{width:1280,height:900}});
    await c.route('**supabase.co/**', r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p = await c.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
    p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
    await p.addInitScript(()=>{try{localStorage.clear()}catch(e){}});
    await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle'}); await p.waitForTimeout(250);
    const h = await head(p);
    console.log(`\n--- ${f} ---`);
    check(`${f}: no PLAYZONE9 anywhere in the rendered page`,
          !/PLAYZONE9/i.test(h.title+h.desc+h.bodyText+JSON.stringify(h.ld)),
          {title:h.title});
    check(`${f}: title correct`, h.title && h.title.includes('JSK1') && !/PLAYZONE9/i.test(h.title), h.title);
    check(`${f}: description present`, !!h.desc && h.desc.length>40);
    check(`${f}: canonical = ${exp.canon}`, h.canon===exp.canon, h.canon);
    check(`${f}: robots = ${exp.robots}`, h.robots===exp.robots, h.robots);
    check(`${f}: exactly one H1`, h.h1s.length===exp.h1, h.h1s);
    check(`${f}: og:type/site_name/title/description/url present`,
          !!(h.ogType&&h.ogSite&&h.ogTitle&&h.ogDesc&&h.ogUrl), {t:h.ogType,s:h.ogSite,u:h.ogUrl});
    check(`${f}: og:url = canonical`, h.ogUrl===exp.canon, h.ogUrl);
    check(`${f}: no og:image pointing at the missing logo`, !h.ogImage || !h.ogImage.includes('logo.png'), h.ogImage);
    check(`${f}: twitter card + title + description`, !!(h.twCard&&h.twTitle&&h.twDesc), {c:h.twCard});
    check(`${f}: no empty verification tag emitted`, h.gverify===null, h.gverify);
    check(`${f}: no links to index.html remain`, h.indexHtmlLinks===0, h.indexHtmlLinks);
    check(`${f}: no console/JS errors`, errs.length===0, errs);
    await c.close();
  }

  // ---------- B. JS-DISABLED / static only ----------
  console.log('\n===== B. JavaScript disabled (pure static HTML) =====');
  const cNo = await browser.newContext({javaScriptEnabled:false});
  for (const [f, exp] of Object.entries(EXPECT)) {
    const p = await cNo.newPage();
    await p.goto(`${BASE}/${f}`,{waitUntil:'domcontentloaded'});
    const h = await p.evaluate(()=>({
      title:document.title,
      canon:(document.head.querySelector('link[rel=canonical]')||{}).getAttribute?document.head.querySelector('link[rel=canonical]').getAttribute('href'):null,
      robots:(document.head.querySelector('meta[name=robots]')||{getAttribute:()=>null}).getAttribute('content'),
      desc:(document.head.querySelector('meta[name=description]')||{getAttribute:()=>null}).getAttribute('content'),
      h1:document.querySelectorAll('h1').length,
      words:document.body.innerText.trim().split(/\s+/).length,
    })).catch(()=>null);
    check(`${f}: static title correct without JS`, h && h.title.includes('JSK1') && !/PLAYZONE9/i.test(h.title), h&&h.title);
    check(`${f}: static canonical + robots + description without JS`,
          h && h.canon===exp.canon && h.robots===exp.robots && !!h.desc, h);
    check(`${f}: static H1 + real content without JS`, h && h.h1===exp.h1 && h.words>15, h&&{h1:h.h1,words:h.words});
    await p.close();
  }
  await cNo.close();

  // ---------- C. SUPABASE DOWN (network abort) ----------
  console.log('\n===== C. Supabase unreachable (request aborted) =====');
  const cDown = await browser.newContext();
  await cDown.route('**supabase.co/**', r=>r.abort());
  for (const f of ['index.html','about.html']) {
    const p = await cDown.newPage();
    await p.goto(`${BASE}/${f}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(600);
    const h = await head(p);
    check(`${f}: title survives a Supabase outage`, h.title.includes('JSK1')&&!/PLAYZONE9/i.test(h.title), h.title);
    check(`${f}: canonical survives a Supabase outage`, h.canon===EXPECT[f].canon, h.canon);
    check(`${f}: one H1 survives a Supabase outage`, h.h1s.length===1, h.h1s);
    await p.close();
  }
  await cDown.close();

  // ---------- D. JSON-LD ----------
  console.log('\n===== D. Structured data =====');
  for (const f of ['index.html','about.html','contact.html','responsible-gaming.html']) {
    const c = await browser.newContext();
    await c.route('**supabase.co/**', r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p = await c.newPage();
    await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle'}); await p.waitForTimeout(300);
    const h = await head(p);
    let parsed=[], bad=null;
    for (const s of h.ld) { try{ parsed.push({id:s.id, obj:JSON.parse(s.txt)}); }catch(e){ bad=s.id+': '+e.message; } }
    check(`${f}: all JSON-LD blocks parse`, !bad, bad);
    const types = parsed.map(x=>x.obj['@type']).filter(Boolean);
    if (f==='index.html') {
      check('index: Organization + WebSite present', types.includes('Organization')&&types.includes('WebSite'), types);
      const org = parsed.find(x=>x.obj['@type']==='Organization');
      check('index: Organization has no broken logo URL', !org.obj.logo || !org.obj.logo.includes('logo.png'), org.obj.logo);
      check('index: Organization name is JSK1', org.obj.name==='JSK1', org.obj.name);
      check('index: WebSite declares no fake SearchAction', !parsed.some(x=>JSON.stringify(x.obj).includes('SearchAction')));
    } else {
      const want = f==='contact.html' ? 'ContactPage' : 'WebPage';
      check(`${f}: ${want} + BreadcrumbList present`, types.includes(want)&&types.includes('BreadcrumbList'), types);
      check(`${f}: breadcrumb schema matches a VISIBLE breadcrumb`, h.breadcrumbs===1, h.breadcrumbs);
      const bc = parsed.find(x=>x.obj['@type']==='BreadcrumbList');
      check(`${f}: breadcrumb items use https://jsk-1.com`,
            bc.obj.itemListElement.every(i=>i.item.startsWith('https://jsk-1.com')), bc.obj.itemListElement.map(i=>i.item));
    }
    check(`${f}: no fake review/rating/price/FAQ schema`,
          !/AggregateRating|"Review"|"Offer"|FAQPage/.test(JSON.stringify(parsed)));
    await c.close();
  }

  // ---------- E. footer nav / breadcrumbs / images ----------
  console.log('\n===== E. Internal linking + images =====');
  for (const f of ['index.html','about.html','contact.html','responsible-gaming.html']) {
    const c = await browser.newContext();
    await c.route('**supabase.co/**', r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p = await c.newPage();
    await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle'}); await p.waitForTimeout(200);
    const h = await head(p);
    check(`${f}: footer navigation has 4 links`, h.footerNav===4, h.footerNav);
    if (f==='index.html') {
      check('index: casino tiles lazy loaded', h.lazyImgs>=79, h.lazyImgs);
      check('index: every game tile has width/height', h.imgsNoDim===0, h.imgsNoDim);
    } else {
      check(`${f}: visible breadcrumb present`, h.breadcrumbs===1, h.breadcrumbs);
    }
    await c.close();
  }

  // ---------- F. 404 + robots + sitemap ----------
  console.log('\n===== F. 404 / robots.txt / sitemap.xml =====');
  const c404 = await browser.newContext();
  await c404.route('**supabase.co/**', r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const p404 = await c404.newPage();
  await p404.goto(`${BASE}/404.html`,{waitUntil:'networkidle'}); await p404.waitForTimeout(250);
  const h404 = await head(p404);
  check('404: noindex,follow', h404.robots==='noindex,follow', h404.robots);
  check('404: has one H1 and no canonical', h404.h1s.length===1 && !h404.canon, {h1:h404.h1s,canon:h404.canon});
  check('404: title is not a landing page title', /not found/i.test(h404.title), h404.title);
  check('404: offers navigation back into the site', h404.footerNav===4);
  const robots = await (await p404.request.get(`${BASE}/robots.txt`)).text();
  check('robots.txt: Disallow /admin/', robots.includes('Disallow: /admin/'));
  check('robots.txt: sitemap on jsk-1.com', robots.includes('Sitemap: https://jsk-1.com/sitemap.xml'));
  check('robots.txt: does not block css/js/assets',
        !/Disallow:\s*\/(css|js|assets)/.test(robots));
  const sm = await (await p404.request.get(`${BASE}/sitemap.xml`)).text();
  check('sitemap: 4 URLs', (sm.match(/<url>/g)||[]).length===4, (sm.match(/<loc>[^<]*/g)||[]));
  const locs = (sm.match(/<loc>([^<]*)<\/loc>/g)||[]).map(l=>l.replace(/<\/?loc>/g,''));
  check('sitemap: excludes login/register/admin', !locs.some(l=>/login|register|admin/.test(l)), locs);
  check('sitemap: all URLs on https://jsk-1.com', (sm.match(/<loc>([^<]*)/g)||[]).every(l=>l.includes('https://jsk-1.com')));
  await c404.close();

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fails.length) console.log('FAILED:', fails.join(' | '));
  await browser.close();
  process.exit(fail?1:0);
})();
