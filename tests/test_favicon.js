const { chromium } = require('playwright');
const BASE='http://localhost:8777';
let pass=0,fail=0;const fails=[];
const check=(n,c,e)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,fails.push(n),console.log('  FAIL  '+n+(e!==undefined?' -> '+JSON.stringify(e):'')))};
const PAGES=['index.html','about.html','contact.html','responsible-gaming.html','login.html','register.html','404.html'];
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR42mNkYPjPwMDAwMTAwMAAAA4hAcYAAAAASUVORK5CYII=';

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});

  // ---------- the files themselves ----------
  console.log('\n===== committed files ====='); {
    const c=await b.newContext(); const p=await c.newPage();
    for (const f of ['assets/images/favicon.png','assets/images/logo.png']) {
      const r=await p.request.get(`${BASE}/${f}`);
      const buf=await r.body();
      check(`${f} returns 200 as image/png`, r.ok() && /image\/png/.test(r.headers()['content-type']||''), r.status()+' '+(r.headers()['content-type']||''));
      check(`${f} is a real PNG (magic bytes)`, buf.slice(0,8).toString('hex')==='89504e470d0a1a0a', buf.slice(0,8).toString('hex'));
    }
    await c.close();
  }

  // ---------- static reference, JS disabled ----------
  console.log('\n===== static favicon reference (JavaScript disabled) ====='); {
    const c=await b.newContext({javaScriptEnabled:false});
    for (const f of PAGES) {
      const p=await c.newPage(); const bad=[];
      p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname)});
      await p.goto(`${BASE}/${f}`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(150);
      const r=await p.evaluate(()=>{
        const l=document.querySelector('link[rel="icon"]');
        return l?{href:l.getAttribute('href'),type:l.getAttribute('type'),id:l.id,
                  resolved:l.href, count:document.querySelectorAll('link[rel="icon"]').length}:null;
      });
      check(`${f}: has exactly one static rel=icon -> assets/images/favicon.png`,
            !!r && r.href==='assets/images/favicon.png' && r.count===1, r);
      check(`${f}: relative path resolves under the site root, not a filesystem path`,
            !!r && r.resolved===`${BASE}/assets/images/favicon.png`, r&&r.resolved);
      check(`${f}: keeps id="cmsFavicon" so the CMS can still override it`, !!r && r.id==='cmsFavicon', r&&r.id);
      check(`${f}: no 404 of any kind with JS off`, bad.length===0, bad);
      await p.close();
    }
    await c.close();
  }

  // ---------- CMS override still wins when an upload exists ----------
  console.log('\n===== CMS favicon still overrides the static file ====='); {
    const ROW=JSON.stringify([{data:{images:{favicon:PNG,logo:PNG}}}]);
    const c=await b.newContext();
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:ROW}));
    for (const f of ['index.html','login.html','404.html']) {
      const p=await c.newPage();
      await p.goto(`${BASE}/${f}`,{waitUntil:'networkidle'}); await p.waitForTimeout(450);
      const href=await p.getAttribute('link[rel="icon"]','href');
      check(`${f}: uploaded CMS favicon takes precedence`, href.startsWith('data:image/png'), href.slice(0,24));
      await p.close();
    }
    await c.close();
  }

  // ---------- static file survives when the CMS has no favicon ----------
  console.log('\n===== static file survives an empty / unreachable CMS ====='); {
    for (const [label,handler] of [['CMS row empty',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'})],
                                   ['Supabase unreachable',r=>r.abort()]]) {
      const c=await b.newContext();
      await c.route('**supabase.co/**',handler);
      const p=await c.newPage(); const bad=[];
      p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+new URL(r.url()).pathname)});
      await p.goto(`${BASE}/index.html`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(600);
      const href=await p.getAttribute('link[rel="icon"]','href');
      check(`${label}: static favicon.png is kept, not blanked`, href==='assets/images/favicon.png', href);
      check(`${label}: no favicon 404`, !bad.some(x=>/favicon/.test(x)), bad);
      await c.close();
    }
  }

  // ---------- Organization.logo resolves to the committed file ----------
  console.log('\n===== Organization.logo with the committed file ====='); {
    const ROW=JSON.stringify([{data:{
      images:{favicon:PNG,logo:PNG},
      seo:{baseUrl:'https://jsk-1.com',siteName:'JSK1',
           organization:{name:'JSK1',logo:'assets/images/logo.png',sameAs:[]},
           schema:{organization:true,website:true}},
      pages:{home:{label:'Home',url:'',title:'JSK1 test',metaDescription:'d'.repeat(80),robots:{index:true,follow:true}}}}}]);
    const c=await b.newContext();
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:ROW}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(450);
    const org=JSON.parse(await p.$eval('#ldOrganization',e=>e.textContent));
    check('Organization.logo = https://jsk-1.com/assets/images/logo.png',
          org.logo==='https://jsk-1.com/assets/images/logo.png', org.logo);
    const r2=await p.request.get(org.logo.replace('https://jsk-1.com',BASE));
    check('that URL serves the committed logo file', r2.ok(), r2.status());
    await c.close();
  }

  // ---------- the data-URL rejection must still hold ----------
  console.log('\n===== data URLs still rejected for crawler-facing images ====='); {
    const ROW=JSON.stringify([{data:{
      images:{favicon:PNG,logo:PNG},
      seo:{baseUrl:'https://jsk-1.com',siteName:'JSK1',defaultOgImage:PNG,defaultTwitterImage:PNG,
           organization:{name:'JSK1',logo:PNG,sameAs:[]},schema:{organization:true,website:true}},
      pages:{home:{label:'Home',url:'',title:'JSK1 test',metaDescription:'d'.repeat(80),
                   robots:{index:true,follow:true},og:{title:'',description:'',image:PNG},
                   twitter:{title:'',description:'',image:PNG}}}}}]);
    const c=await b.newContext();
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:ROW}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(450);
    const r=await p.evaluate(()=>{
      const m=s=>{const e=document.head.querySelector(s);return e?e.getAttribute('content'):null};
      return {og:m('meta[property="og:image"]'),tw:m('meta[name="twitter:image"]'),
              orgLogo:JSON.parse(document.getElementById('ldOrganization').textContent).logo||null,
              fav:document.querySelector('link[rel="icon"]').getAttribute('href').slice(0,15)};
    });
    check('og:image still rejects a data URL', !r.og || !r.og.startsWith('data:'), r.og&&r.og.slice(0,24));
    check('twitter:image still rejects a data URL', !r.tw || !r.tw.startsWith('data:'), r.tw&&r.tw.slice(0,24));
    check('Organization.logo still omitted for a data URL', r.orgLogo===null, r.orgLogo);
    check('favicon DOES still accept a data URL (correct for rel=icon)', r.fav.startsWith('data:image'), r.fav);
    await c.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if(fails.length)console.log('FAILED:',fails.join(' | '));
  await b.close(); process.exit(fail?1:0);
})();
