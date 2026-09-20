const { chromium } = require('playwright');
const BASE='http://localhost:8777';
let pass=0,fail=0;const fails=[];
const check=(n,c,e)=>{c?(pass++,console.log('  PASS  '+n)):(fail++,fails.push(n),console.log('  FAIL  '+n+(e!==undefined?' -> '+JSON.stringify(e):'')))};

(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});

  // ---------- A. backward compatibility: a record WITHOUT sportsTable ----------
  console.log('\n===== A. Saved record with no sportsTable section =====');
  for (const [label,body] of [['empty row','[]'],
       ['old record (branding only)', JSON.stringify([{data:{branding:{siteName:'JSK1'}}}])]]) {
    const c=await b.newContext({viewport:{width:390,height:844}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body}));
    const p=await c.newPage(); const errs=[];
    p.on('pageerror',e=>errs.push(String(e)));
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
    const m=await p.evaluate(()=>{
      const r=document.querySelector('.match-row'), o=r.querySelector('.odds-btn');
      const g=e=>getComputedStyle(e);
      return {title:g(r.querySelector('.match-title')).fontSize, odds:g(o).height,
              rows:document.querySelectorAll('.match-row').length, err:0};
    });
    check(`${label}: table still renders with sensible values`, m.rows>20 && m.title==='12.5px' && m.odds==='19px', m);
    const pitch=await p.evaluate(()=>{const r=[...document.querySelectorAll('.match-row')];
      return Math.round((r[1].getBoundingClientRect().top-r[0].getBoundingClientRect().top)*10)/10;});
    check(`${label}: compact row pitch (was 83.8, reference ~80.5)`, pitch>70 && pitch<78, pitch);
    check(`${label}: no JS errors`, errs.length===0, errs);
    await c.close();
  }

  // ---------- B. CMS values actually drive the table ----------
  console.log('\n===== B. CMS values drive the rendering =====');
  {
    const ROW=JSON.stringify([{data:{sportsTable:{
      mobTitleSize:'16', mobOddsHeight:'30', mobOddsSize:'15', mobRowGap:'10', mobDateSize:'13'}}}]);
    const c=await b.newContext({viewport:{width:390,height:844}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:ROW}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
    const m=await p.evaluate(()=>{
      const r=document.querySelector('.match-row'); const g=e=>getComputedStyle(e);
      return {title:g(r.querySelector('.match-title')).fontSize,
              date:g(r.querySelector('.match-datetime')).fontSize,
              oddsH:g(r.querySelector('.odds-btn')).height,
              oddsF:g(r.querySelector('.odds-btn')).fontSize,
              sep:g(r).borderBottomWidth};
    });
    check('mobile title size applied', m.title==='16px', m.title);
    check('mobile date size applied', m.date==='13px', m.date);
    check('mobile odds height applied', m.oddsH==='30px', m.oddsH);
    check('mobile odds font applied', m.oddsF==='15px', m.oddsF);
    check('mobile row gap applied', m.sep==='10px', m.sep);
    await c.close();
  }

  // ---------- C. a blank field keeps the stylesheet fallback ----------
  console.log('\n===== C. A blank field falls back to the stylesheet =====');
  {
    const ROW=JSON.stringify([{data:{sportsTable:{mobTitleSize:'', mobOddsHeight:''}}}]);
    const c=await b.newContext({viewport:{width:390,height:844}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:ROW}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
    const m=await p.evaluate(()=>{const r=document.querySelector('.match-row');
      return {t:getComputedStyle(r.querySelector('.match-title')).fontSize,
              o:getComputedStyle(r.querySelector('.odds-btn')).height};});
    check('blank title size -> stylesheet default 12.5px', m.t==='12.5px', m.t);
    check('blank odds height -> stylesheet default 19px', m.o==='19px', m.o);
    await c.close();
  }

  // ---------- D. functionality preserved ----------
  console.log('\n===== D. Event data and behaviour intact =====');
  {
    const c=await b.newContext({viewport:{width:390,height:844}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(500);
    const m=await p.evaluate(()=>({
      rows:document.querySelectorAll('.match-row').length,
      titles:[...document.querySelectorAll('.match-title')].filter(t=>t.textContent.trim()).length,
      dates:[...document.querySelectorAll('.match-datetime')].filter(t=>t.textContent.trim()).length,
      labels:document.querySelectorAll('.mob-odds-labels').length,
      locks:document.querySelectorAll('.odds-btn.lock').length,
      prices:[...document.querySelectorAll('.odds-btn:not(.lock)')].filter(o=>o.textContent.trim()).length,
      dots:document.querySelectorAll('.match-live-dot').length,
      header:!!document.querySelector('.match-group-header'),
      // every odds grid must add up to 6 columns
      badGrids:[...document.querySelectorAll('.match-odds')].filter(o=>{
        let n=0; for (const c of o.children) n += c.classList.contains('lock')?2:1; return n!==6;
      }).length,
    }));
    check('all 25 event rows still present', m.rows===25, m.rows);
    check('names, dates and live dots intact', m.titles===25 && m.dates===25 && m.dots===25, m);
    check('1/X/2 strips present on every row', m.labels===25, m.labels);
    check('locked and priced markets both present', m.locks>0 && m.prices>0, {locks:m.locks,prices:m.prices});
    check('every odds grid adds up to exactly 6 columns', m.badGrids===0, m.badGrids);
    check('group header intact', m.header);
    // login gate still fires from an odds click
    const gate=await p.evaluate(()=>{const u=location.href;
      document.querySelector('.odds-btn:not(.lock)').click();
      return !!document.getElementById('gateToast')||location.href!==u;});
    check('login gate still fires on an odds click', gate);
    check('no horizontal overflow', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
    await c.close();
  }

  // ---------- E. mixed suspended market ----------
  console.log('\n===== E. Partly suspended market (the reference row) =====');
  {
    const c=await b.newContext({viewport:{width:390,height:844}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(400);
    const m=await p.evaluate(()=>{
      const t=document.getElementById('matchesTable');
      const r=document.createElement('div'); r.className='match-row';
      r.innerHTML='<div class="match-info"><span class="match-title">Mixed v Market</span></div>'+
        '<div class="match-odds">'+
        '<button class="odds-btn lock"><i class="fas fa-lock"></i></button>'.repeat(2)+
        '<button class="odds-btn draw">-</button><button class="odds-btn back2">-</button>'+
        '<button class="odds-btn lock"><i class="fas fa-lock"></i></button>'.repeat(2)+'</div>';
      t.appendChild(r);
      return new Promise(res=>setTimeout(()=>{
        const cells=[...r.querySelector('.match-odds').children];
        res({n:cells.length, w:cells.map(c=>Math.round(c.getBoundingClientRect().width)),
             fits:cells.reduce((a,c)=>a+c.getBoundingClientRect().width,0)<=391});
      },250));
    });
    check('suspended pairs collapse to 4 cells', m.n===4, m);
    check('proportions match the reference (wide/narrow/narrow/wide)',
          m.w[0]>110 && m.w[1]<75 && m.w[2]<75 && m.w[3]>110, m.w);
    check('row still fits the viewport', m.fits, m);
    await c.close();
  }

  // ---------- F. desktop unaffected by the mobile work ----------
  console.log('\n===== F. Desktop layout =====');
  for (const w of [768,1024,1280,1440]) {
    const c=await b.newContext({viewport:{width:w,height:900}});
    await c.route('**supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
    const p=await c.newPage();
    await p.goto(`${BASE}/index.html`,{waitUntil:'networkidle'}); await p.waitForTimeout(300);
    const m=await p.evaluate(()=>{const r=document.querySelector('.match-row');const g=e=>getComputedStyle(e);
      return {display:g(r).display, labels:g(r.querySelector('.mob-odds-labels')).display,
              oddsH:g(r.querySelector('.odds-btn')).height, title:g(r.querySelector('.match-title')).fontSize,
              over:document.documentElement.scrollWidth>window.innerWidth+1};});
    const isDesktop = w>768;
    check(`${w}px: layout is ${isDesktop?'single-line (flex)':'stacked (block)'}`,
          m.display===(isDesktop?'flex':'block'), m);
    check(`${w}px: 1/X/2 strip ${isDesktop?'hidden':'shown'}`,
          m.labels===(isDesktop?'none':'grid'), m.labels);
    // 1024px has its own pre-existing media block (20px / 10px) — verified against
    // the pre-change tree, so the baseline differs from the wider breakpoints.
    const wantOdds = w===1024 ? '20px' : '22px';
    const wantTitle = w===1024 ? '10px' : '11px';
    if (isDesktop) check(`${w}px: desktop odds height unchanged at ${wantOdds}`, m.oddsH===wantOdds, m.oddsH);
    if (isDesktop) check(`${w}px: desktop title size unchanged at ${wantTitle}`, m.title===wantTitle, m.title);
    check(`${w}px: no horizontal overflow`, !m.over);
    await c.close();
  }

  // ---------- G. admin panel ----------
  console.log('\n===== G. Admin Sports Table panel =====');
  {
    let published=null, serverRow=null;
    const c=await b.newContext({viewport:{width:1400,height:1000}});
    await c.route('**supabase.co/**',route=>{
      const q=route.request();
      if(q.url().includes('/auth/v1/token')) return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({access_token:'t'})});
      if(q.method()==='POST'){published=JSON.parse(q.postData()||'{}');serverRow=published;return route.fulfill({status:201,body:''});}
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(serverRow?[{data:serverRow.data}]:[])});
    });
    const p=await c.newPage(); const errs=[];
    p.on('pageerror',e=>errs.push(String(e)));
    p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(m.text())});
    await p.goto(`${BASE}/admin/index.html`,{waitUntil:'networkidle'});
    await p.fill('#authEmail','a@b.c'); await p.fill('#authPass','x'); await p.click('#authBtn');
    await p.waitForTimeout(500);
    await p.click('.adm-nav-item[data-panel="sportstable"]'); await p.waitForTimeout(500);
    check('panel opens', await p.isVisible('#panel-sportstable'));
    check('panel title correct', (await p.textContent('#panelTitle')).trim()==='Sports Table');
    check('11 mobile controls', (await p.$$('#stMobile .f')).length===11, (await p.$$('#stMobile .f')).length);
    check('10 desktop controls', (await p.$$('#stDesktop .f')).length===10, (await p.$$('#stDesktop .f')).length);
    check('no colour inputs duplicated here (colours stay in the Colors panel)',
          (await p.$$('#panel-sportstable input[type=color]')).length===0);
    check('preview iframe rendered', await p.isVisible('.stprev-iframe'));
    check('opening the panel does not mark unsaved changes',
          !/Unsaved/.test(await p.textContent('#savedFlag')), await p.textContent('#savedFlag'));

    // preview reacts to an edit
    const frame=p.frameLocator('.stprev-iframe');
    check('preview shows sample event rows', (await frame.locator('.match-row').count())===3);
    check('preview shows a suspended cell', (await frame.locator('.odds-btn.lock').count())>0);
    check('preview shows 1/X/2', (await frame.locator('.mob-odds-labels').first().textContent()).replace(/\s/g,'')==='1X2');
    const before=await frame.locator('.match-title').first().evaluate(e=>getComputedStyle(e).fontSize);
    const inputs=await p.$$('#stMobile .f input');
    await inputs[0].fill('17'); await p.waitForTimeout(700);
    const after=await p.frameLocator('.stprev-iframe').locator('.match-title').first().evaluate(e=>getComputedStyle(e).fontSize);
    check('editing a value updates the preview', before!=='17px' && after==='17px', {before,after});
    check('editing marks unsaved changes', /Unsaved/.test(await p.textContent('#savedFlag')));

    // save -> publish
    await p.click('#btnSave'); await p.waitForTimeout(800);
    check('published to Supabase', !!published);
    check('published payload carries sportsTable', !!(published&&published.data.sportsTable&&published.data.sportsTable.mobTitleSize==='17'),
          published&&published.data.sportsTable&&published.data.sportsTable.mobTitleSize);
    check('publish preserved seo/pages/branding/colors/home',
          !!(published&&published.data.seo&&published.data.pages&&published.data.branding&&published.data.colors&&published.data.home));
    check('other panels still build', (await (async()=>{
      for (const pan of ['seo','pages','text','home','themes','colors','images']) {
        await p.click(`.adm-nav-item[data-panel="${pan}"]`); await p.waitForTimeout(200);
        if (!(await p.isVisible(`#panel-${pan}`))) return false;
      } return true;})()));
    check('no admin JS errors', errs.length===0, errs);
    await c.close();
  }

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if(fails.length)console.log('FAILED:',fails.join(' | '));
  await b.close(); process.exit(fail?1:0);
})();
