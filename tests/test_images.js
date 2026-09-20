const { chromium } = require('playwright');
const BASE='http://localhost:8777';
let pass=0,fail=0;const fails=[];
const check=(n,c,e)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,fails.push(n),console.log('  FAIL  '+n+(e!==undefined?' -> '+JSON.stringify(e):'')))};

// A 2x2 PNG and a 1x1 ICO as data URLs — stand-ins for what the CMS actually holds.
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mNkYPjPwMDAwMTAwMAAAA4hAcYAAAAASUVORK5CYII=';
const ICO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';

// The live CMS state the user described: logo, mobile logo, favicon, login/register logos and whatsapp icon uploaded.
const ROW = { data: { images: { logo: PNG, logoMobile: PNG, favicon: ICO, loginLogo: PNG, registerLogo: PNG, whatsappIcon: PNG } } };

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});

  // ---------- 1. CMS images populated (the real live case) ----------
  console.log('\n===== 1. CMS logo + favicon uploaded (as on the live site) =====');
  {
    const c=await b.newContext({viewport:{width:1280,height:900}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([ROW])}));
    for (const f of ['index.html','about.html','login.html','register.html']) {
      const p=await c.newPage();
      const bad=[];
      p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname)});
      await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
      const r=await p.evaluate(()=>{
        const logo=document.querySelector('[data-cms-img="logo"],[data-cms-img="loginLogo"],[data-cms-img="registerLogo"]');
        const fav=document.getElementById('cmsFavicon');
        const fb=document.querySelector('.logo-text-fallback');
        return {
          logoSrc:(logo&&logo.getAttribute('src')||'').slice(0,22),
          logoVisible: !!logo && !logo.hidden && logo.getBoundingClientRect().width>0,
          favHref:(fav&&fav.getAttribute('href')||'').slice(0,22),
          fallbackShown: !!fb && getComputedStyle(fb).display!=='none',
          ogImage:(document.head.querySelector('meta[property="og:image"]')||{getAttribute:()=>null}).getAttribute('content'),
        };
      });
      check(`${f}: header logo painted from the CMS data URL`, r.logoSrc.startsWith('data:image/png'), r.logoSrc);
      check(`${f}: logo image is visible (unhidden by the CMS)`, r.logoVisible, r);
      check(`${f}: favicon painted from the CMS data URL`, r.favHref.startsWith('data:image/png'), r.favHref);
      check(`${f}: text fallback correctly hidden once the logo loads`, !r.fallbackShown);
      check(`${f}: NO 404s for logo/favicon any more`, !bad.some(x=>/logo\.png|favicon\.png/.test(x)), bad);
      check(`${f}: zero 4xx responses of any kind`, bad.length===0, bad);
      await p.close();
    }
    await c.close();
  }

  // ---------- 2. no CMS images (fresh install / CMS down) ----------
  console.log('\n===== 2. No CMS images at all — pre-JS and fallback state =====');
  {
    const c=await b.newContext({viewport:{width:1280,height:900}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p=await c.newPage();
    const bad=[];
    p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname)});
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
    const r=await p.evaluate(()=>{
      const fb=document.querySelector('.logo-text-fallback');
      const logo=document.querySelector('[data-cms-img="logo"]');
      return {
        fallbackText: fb?fb.textContent.trim():null,
        fallbackShown: !!fb && getComputedStyle(fb).display!=='none',
        fallbackBox: fb?fb.getBoundingClientRect().width:0,
        logoHidden: !!logo && logo.hidden,
        logoHasSrc: !!(logo&&logo.getAttribute('src')),
      };
    });
    check('with no CMS logo, a visible JSK1 text logo appears instead of a broken image',
          r.fallbackShown && r.fallbackText==='JSK1' && r.fallbackBox>10, r);
    check('the empty <img> stays hidden so there is no double logo', r.logoHidden && !r.logoHasSrc, r);
    check('still no 404 for logo/favicon', !bad.some(x=>/logo\.png|favicon\.png/.test(x)), bad);
    await c.close();
  }

  // ---------- 3. JS disabled: static HTML only ----------
  console.log('\n===== 3. JavaScript disabled =====');
  {
    const c=await b.newContext({javaScriptEnabled:false,viewport:{width:1280,height:900}});
    const p=await c.newPage();
    const bad=[];
    p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname)});
    await p.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(300);
    const r=await p.evaluate(()=>({
      fallbackShown: getComputedStyle(document.querySelector('.logo-text-fallback')).display!=='none',
      title: document.title,
      canon: document.head.querySelector('link[rel=canonical]').getAttribute('href'),
      robots: document.head.querySelector('meta[name=robots]').getAttribute('content'),
      h1: document.querySelectorAll('h1').length,
      ogTitle: document.head.querySelector('meta[property="og:title"]').getAttribute('content'),
    }));
    check('text logo visible with JS off', r.fallbackShown, r);
    check('static SEO head still correct with JS off',
          r.title.includes('JSK1') && r.canon==='https://jsk-1.com/' && r.robots==='index,follow' && r.h1===1 && !!r.ogTitle, r);
    check('no logo/favicon 404 with JS off', !bad.some(x=>/logo\.png|favicon\.png/.test(x)), bad);
    await c.close();
  }

  // ---------- 4. THE INTEGRATION BUG: data URL must never reach a crawler tag ----------
  console.log('\n===== 4. A data URL must never be emitted into og:image / twitter:image / schema logo =====');
  {
    const HOSTILE = { data: {
      images: { logo: PNG, favicon: ICO },
      seo: { baseUrl:'https://jsk-1.com', siteName:'JSK1',
             defaultOgImage: PNG,                 // someone pasted an uploaded image
             defaultTwitterImage: PNG,
             organization: { name:'JSK1', logo: PNG, sameAs: [] },
             schema: { organization:true, website:true } },
      pages: { home: { label:'Home', url:'', title:'JSK1 test', metaDescription:'d'.repeat(80),
                       robots:{index:true,follow:true}, og:{title:'',description:'',image:PNG},
                       twitter:{title:'',description:'',image:PNG}, schema:{webPage:false} } }
    }};
    const c=await b.newContext();
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([HOSTILE])}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
    const r=await p.evaluate(()=>{
      const m=s=>{const e=document.head.querySelector(s);return e?e.getAttribute('content'):null};
      const org=JSON.parse(document.getElementById('ldOrganization').textContent);
      return { og:m('meta[property="og:image"]'), tw:m('meta[name="twitter:image"]'),
               orgLogo:org.logo||null, orgName:org.name,
               logoOnPage:(document.querySelector('[data-cms-img="logo"]').getAttribute('src')||'').slice(0,15),
               favOnPage:(document.getElementById('cmsFavicon').getAttribute('href')||'').slice(0,15),
               headSize:document.head.innerHTML.length };
    });
    check('og:image is NOT a data URL', !r.og || !r.og.startsWith('data:'), r.og&&r.og.slice(0,30));
    check('twitter:image is NOT a data URL', !r.tw || !r.tw.startsWith('data:'), r.tw&&r.tw.slice(0,30));
    check('Organization.logo is omitted rather than set to a data URL', r.orgLogo===null, r.orgLogo);
    check('Organization schema is otherwise intact', r.orgName==='JSK1');
    check('the head is not bloated with base64', r.headSize<9000, r.headSize);
    check('but the page logo STILL uses the CMS data URL', r.logoOnPage.startsWith('data:image'), r.logoOnPage);
    check('and the favicon STILL uses the CMS data URL', r.favOnPage.startsWith('data:image'), r.favOnPage);
    await c.close();
  }

  // ---------- 5. a real file path still works end to end ----------
  console.log('\n===== 5. A real file path is accepted and made absolute =====');
  {
    const GOOD = { data: { seo: { baseUrl:'https://jsk-1.com', siteName:'JSK1',
      defaultOgImage:'assets/images/share.png',
      organization:{ name:'JSK1', logo:'assets/images/logo.png', sameAs:[] },
      schema:{organization:true,website:true} },
      pages:{ home:{ label:'Home', url:'', title:'JSK1 test', metaDescription:'d'.repeat(80), robots:{index:true,follow:true} } } }};
    const c=await b.newContext();
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([GOOD])}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
    const r=await p.evaluate(()=>{
      const m=s=>{const e=document.head.querySelector(s);return e?e.getAttribute('content'):null};
      return { og:m('meta[property="og:image"]'), tw:m('meta[name="twitter:image"]'),
               orgLogo:JSON.parse(document.getElementById('ldOrganization').textContent).logo };
    });
    check('relative path becomes an absolute jsk-1.com URL for og:image', r.og==='https://jsk-1.com/assets/images/share.png', r.og);
    check('twitter:image inherits it', r.tw==='https://jsk-1.com/assets/images/share.png', r.tw);
    check('Organization.logo becomes absolute', r.orgLogo==='https://jsk-1.com/assets/images/logo.png', r.orgLogo);
    await c.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if(fails.length)console.log('FAILED:',fails.join(' | '));
  await b.close(); process.exit(fail?1:0);
})();
