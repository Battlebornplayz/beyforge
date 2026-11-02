/* BeyForge Studio — Overview + Analytics */
(function(){
'use strict';
const S=window.Studio, BF=window.BF, {$,$$,esc}=S;
const C={a:'#22d3ee',b:'#a78bfa',c:'#f5c518',d:'#f472b6',e:'#34d399',f:'#fb923c',g:'#94a3b8'};
const RC={common:'#9aa3b5',rare:'#22d3ee',epic:'#a78bfa',legendary:'#f5c518',limited:'#f472b6'};
const short=d=>d.slice(5).replace('-','/');
let RANGE=30;
const rangeSel=()=>`<div class="seg" id="rng">${[7,30,90].map(n=>`<button class="${RANGE===n?'on':''}" data-n="${n}">${n} days</button>`).join('')}</div>`;
const bindRange=(v,re)=>$$('#rng button',v).forEach(b=>b.onclick=()=>{ RANGE=+b.dataset.n; re(); });
const ser=(rows,path)=>rows.map(r=>+S.get(r.s,path)||0);
const pct=(a,b)=>b?Math.round(a/b*1000)/10+'%':'—';

// ---------- Overview ----------
S.register('overview',{title:'Overview',icon:'◧',group:'',sec:'overview',async render(v){
  const now=Date.now(), [rows,online]=await Promise.all([S.can('analytics')||S.canPerm('viewAnalytics')?S.stats(14).catch(()=>[]):[],
    S.db.collection('users').where('lastSeen','>',new Date(now-3*60000)).limit(500).get().then(q=>q.size).catch(()=>null)]);
  const t=(rows[rows.length-1]||{s:{}}).s, y=(rows[rows.length-2]||{s:{}}).s, g=S.get;
  const delta=(a,b)=>{ if(!b) return ''; const d=Math.round((a-b)/b*100); return `<span class="${d>=0?'up':'down'}">${d>=0?'▲':'▼'} ${Math.abs(d)}% vs yesterday</span>`; };
  const coinsIn=g(t,'eco.coins.in')||0, coinsOut=g(t,'eco.coins.out')||0;
  v.innerHTML=S.head(`Welcome back, ${S.profile.name||'boss'}`,'Live snapshot of BeyForge today.',
      `${S.can('content','edit')?'<a class="btn primary" href="#/content/new">＋ New content</a>':''}${S.can('switches','edit')?'<a class="btn" href="#/switches">Game switches</a>':''}`)+
    `<div class="kpis">${S.kpi('Online now',online==null?'—':S.num(online),'active in the last 3 min','live')}${S.kpi('Players today',S.num(t.dau||0),delta(t.dau||0,y.dau||0))}
      ${S.kpi('New players',S.num(t.signups||0),'signed up today')}${S.kpi('Battles',S.num(g(t,'battles.total')||0),delta(g(t,'battles.total')||0,g(y,'battles.total')||0))}
      ${S.kpi('Packs opened',S.num(Object.values(t.packs||{}).reduce((a,b)=>a+b,0)),`${S.num(g(t,'rarity.legendary')||0)} legendaries · ${S.num(t.shiny||0)} shiny`)}
      ${S.kpi('Coins in / out',`${S.num(coinsIn)} <small>/</small> ${S.num(coinsOut)}`,`net ${coinsIn-coinsOut>=0?'+':''}${S.num(coinsIn-coinsOut)}`)}
      ${S.kpi('Errors',S.num(t.errors||0),t.errors?'<a href="#/errors">see errors →</a>':'all clear',t.errors?'warn':'')}</div>
    <div class="grid2"><section class="card"><h3>Daily players</h3><div id="c1"></div></section><section class="card"><h3>Battles & packs</h3><div id="c2"></div></section></div>
    <div class="grid2"><section class="card"><h3>Recent changes</h3><div id="aud"></div></section><section class="card"><h3>Needs attention</h3><div id="attn"></div></section></div>`;
  if(rows.length){ const L=rows.map(r=>short(r.day));
    S.chart($('#c1',v),{labels:L,series:[{name:'Players',color:C.a,data:ser(rows,'dau')},{name:'New',color:C.b,data:ser(rows,'signups')}]});
    S.chart($('#c2',v),{labels:L,type:'bar',series:[{name:'Battles',color:C.c,data:ser(rows,'battles.total')},{name:'Packs',color:C.d,data:rows.map(r=>Object.values(r.s.packs||{}).reduce((a,b)=>a+b,0))}]}); }
  else { $('#c1',v).innerHTML=$('#c2',v).innerHTML='<p class="muted">Stats start showing once players play this version.</p>'; }
  if(S.can('audit')) S.db.collection('audit').orderBy('ts','desc').limit(6).get().then(qs=>{ const r=[]; qs.forEach(d=>r.push(d.data())); $('#aud',v).innerHTML=r.length?`<ul class="feed">${r.map(a=>`<li><b>${esc(a.byName)}</b> ${esc(a.action)} <span class="muted">${esc(a.target||'')}</span><em>${S.ago(a.ts)}</em></li>`).join('')}</ul><a href="#/audit" class="more">Full audit log →</a>`:'<p class="muted">No changes yet.</p>'; }).catch(()=>$('#aud',v).innerHTML='<p class="muted">—</p>');
  else $('#aud',v).innerHTML='<p class="muted">Your rank can’t see the audit log.</p>';
  const att=[]; const rv=await S.db.collection('content').where('status','==','review').get().then(q=>q.size).catch(()=>0); if(rv) att.push(`<li>📝 <a href="#/review">${rv} content item${rv>1?'s':''} waiting for review</a></li>`);
  const cfg=(await S.db.collection('config').doc('game').get().catch(()=>null)); const gc=cfg&&cfg.data()||{}; if(gc.maintenance&&gc.maintenance.on) att.push('<li>🛠 <a href="#/switches">Maintenance mode is ON</a> — players can’t play</li>');
  const off=Object.entries(gc.features||{}).filter(([,x])=>x===false).map(([k])=>BF.FEATURES&&BF.FEATURES[k]||k); if(off.length) att.push(`<li>⏸ Turned off: ${esc(off.join(', '))}</li>`);
  if(t.errors) att.push(`<li>⚠ <a href="#/errors">${t.errors} player error${t.errors>1?'s':''} today</a></li>`);
  $('#attn',v).innerHTML=att.length?`<ul class="feed">${att.join('')}</ul>`:'<p class="muted">All good. Nothing needs you right now. ✅</p>';
}});

// ---------- Players & retention ----------
S.register('a-players',{title:'Players & retention',icon:'👥',group:'Analytics',sec:'analytics',async render(v){
  const re=()=>this.render(v), rows=await S.stats(RANGE), L=rows.map(r=>short(r.day)), byDay={}; rows.forEach(r=>byDay[r.day]=r.s);
  const dau=ser(rows,'dau'), avgDau=Math.round(dau.reduce((a,b)=>a+b,0)/(dau.length||1)), sec=ser(rows,'time.sec').reduce((a,b)=>a+b,0), sess=dau.reduce((a,b)=>a+b,0);
  // retention: players who came back N days after signing up / players who signed up that day
  const ret=[1,3,7,14,30].map(n=>{ let back=0, base=0; rows.forEach(r=>{ const d0=new Date(new Date(r.day).getTime()-n*86400000).toISOString().slice(0,10); if(byDay[d0]&&byDay[d0].signups){ base+=byDay[d0].signups; back+=S.get(r.s,'ret.d'+n)||0; } }); return {n,back,base}; });
  v.innerHTML=S.head('Players & retention','Who plays, who comes back and how long they stay.',rangeSel())+
    `<div class="kpis">${S.kpi('Avg daily players',S.num(avgDau))}${S.kpi('New players',S.num(ser(rows,'signups').reduce((a,b)=>a+b,0)),`last ${RANGE} days`)}
     ${S.kpi('Avg play time / day',sess?Math.round(sec/sess/60)+' min':'—','per player')}${ret.slice(0,3).map(r=>S.kpi(`Day-${r.n} retention`,pct(r.back,r.base),r.base?`${r.back} of ${r.base} came back`:'not enough data yet')).join('')}</div>
    <div class="grid2"><section class="card"><h3>Daily players</h3><div id="p1"></div></section><section class="card"><h3>New players</h3><div id="p2"></div></section></div>
    <div class="grid3"><section class="card"><h3>Retention</h3><div id="p3"></div><p class="hint">% of new players still playing after N days. Day-1 above 40% and Day-7 above 15% is healthy for a mobile game.</p></section>
      <section class="card"><h3>Platforms</h3><div id="p4"></div></section><section class="card"><h3>Most used tabs</h3><div id="p5"></div></section></div>
    <section class="card"><h3>Player levels (active players)</h3><div id="p6"></div></section>`;
  bindRange(v,re);
  S.chart($('#p1',v),{labels:L,series:[{name:'Players',color:C.a,data:dau}]});
  S.chart($('#p2',v),{labels:L,type:'bar',series:[{name:'New',color:C.b,data:ser(rows,'signups')}]});
  S.bars($('#p3',v),ret.map(r=>({l:'Day '+r.n,v:r.base?r.back/r.base*100:0,c:C.e})),{fmt:x=>x.toFixed(1)+'%'});
  const pl=S.sumMaps(rows,'platform'); S.bars($('#p4',v),Object.entries(pl).map(([k,n])=>({l:{web:'Web',desktop:'PC app',android:'Android'}[k]||k,v:n})).sort((a,b)=>b.v-a.v));
  const tb=S.sumMaps(rows,'tabs'); S.bars($('#p5',v),Object.entries(tb).map(([k,n])=>({l:k,v:n})).sort((a,b)=>b.v-a.v).slice(0,8),{});
  const lv=S.sumMaps(rows,'levels'); S.bars($('#p6',v),Object.entries(lv).map(([k,n])=>({l:`Lv ${k}–${+k+4}`,v:n,k:+k})).sort((a,b)=>a.k-b.k));
}});

// ---------- Battles & balance ----------
S.register('a-battles',{title:'Battles & balance',icon:'⚔',group:'Analytics',sec:'analytics',async render(v){
  const re=()=>this.render(v), rows=await S.stats(RANGE), L=rows.map(r=>short(r.day));
  const parts=S.sumMaps(rows,'parts'), pm={}; Object.entries(parts).forEach(([k,n])=>{ const i=k.lastIndexOf('.'), name=k.slice(0,i), f=k.slice(i+1); (pm[name]=pm[name]||{name,u:0,w:0})[f]=n; });
  const plist=Object.values(pm).filter(p=>p.u>0).map(p=>Object.assign(p,{wr:p.w/p.u}));
  const el=S.sumMaps(rows,'el'), em={}; Object.entries(el).forEach(([k,n])=>{ const [e,f]=k.split('.'); (em[e]=em[e]||{u:0,w:0})[f]=n; });
  const fin=S.sumMaps(rows,'finish'), cpu=S.sumMaps(rows,'cpu'), mv=S.sumMaps(rows,'moves');
  const tot=ser(rows,'battles.total').reduce((a,b)=>a+b,0);
  v.innerHTML=S.head('Battles & balance','Spot overpowered parts and elements. A win rate far above 55% with lots of games usually means it needs a nerf.',rangeSel())+
    `<div class="kpis">${S.kpi('Battles',S.num(tot),`last ${RANGE} days`)}${S.kpi('Ranked',S.num(ser(rows,'battles.ranked').reduce((a,b)=>a+b,0)))}${S.kpi('Online',S.num(ser(rows,'battles.online').reduce((a,b)=>a+b,0)))}${S.kpi('vs CPU',S.num(ser(rows,'battles.cpu').reduce((a,b)=>a+b,0)))}</div>
    <section class="card"><h3>Battles per day</h3><div id="b1"></div></section>
    <div class="grid2"><section class="card"><h3>Part win rates <span class="muted small">(min 5 games)</span></h3><div id="b2"></div></section>
      <section class="card"><h3>Element win rates</h3><div id="b3"></div><h3 class="mt">How battles end</h3><div id="b4"></div></section></div>
    <div class="grid2"><section class="card"><h3>CPU difficulty (player win %)</h3><div id="b5"></div></section><section class="card"><h3>Most used moves</h3><div id="b6"></div></section></div>`;
  bindRange(v,re);
  S.chart($('#b1',v),{labels:L,type:'bar',stack:true,series:[{name:'vs CPU',color:C.a,data:ser(rows,'battles.cpu')},{name:'Online',color:C.b,data:ser(rows,'battles.online')},{name:'Ranked',color:C.c,data:ser(rows,'battles.ranked')}]});
  const wrCell=p=>{ const w=Math.round(p.wr*100), tone=p.u<5?'':w>=60?'bad':w<=40?'warn':'good'; return `<span class="wr ${tone}"><i style="width:${w}%"></i><b>${w}%</b></span>`; };
  S.table($('#b2',v),[{k:'name',label:'Part'},{k:'u',label:'Games',cls:'r'},{k:'w',label:'Wins',cls:'r'},{k:'wr',label:'Win rate',fmt:wrCell}],plist.filter(p=>p.u>=5).length?plist.filter(p=>p.u>=5):plist,{sort:'u',empty:'No battles with progression parts yet'});
  S.bars($('#b3',v),Object.entries(em).filter(([,x])=>x.u).map(([k,x])=>{ const E=BF.ELEMENTS&&BF.ELEMENTS[k]; return {l:(E?E.icon+' '+E.label:k)+` (${x.u})`,v:x.w/x.u*100,c:E&&E.color}; }).sort((a,b)=>b.v-a.v),{fmt:x=>x.toFixed(0)+'%'});
  S.bars($('#b4',v),Object.entries(fin).map(([k,n])=>({l:{spin:'Spin finish',over:'Over finish',burst:'Burst finish',xtreme:'Xtreme finish'}[k]||k,v:n})).sort((a,b)=>b.v-a.v));
  const cl={}; Object.entries(cpu).forEach(([k,n])=>{ const [lv,r]=k.split('.'); (cl[lv]=cl[lv]||{w:0,l:0})[r]=n; });
  S.bars($('#b5',v),Object.entries(cl).map(([k,x])=>({l:`${k} (${x.w+x.l})`,v:(x.w+x.l)?x.w/(x.w+x.l)*100:0,c:C.e})),{fmt:x=>x.toFixed(0)+'%'});
  S.bars($('#b6',v),Object.entries(mv).map(([k,n])=>({l:k,v:n})).sort((a,b)=>b.v-a.v).slice(0,10));
}});

// ---------- Packs & drops ----------
S.register('a-packs',{title:'Packs & drops',icon:'🎁',group:'Analytics',sec:'analytics',async render(v){
  const re=()=>this.render(v), rows=await S.stats(RANGE), L=rows.map(r=>short(r.day)), pk=S.sumMaps(rows,'packs'), rar=S.sumMaps(rows,'rarity');
  // expected rarity mix from each pack's posted odds × how many were opened
  const exp={}; let expTot=0; Object.entries(pk).forEach(([id,n])=>{ const p=BF.Packs&&BF.Packs.get(id); if(!p) return; const t=Object.values(p.odds).reduce((a,b)=>a+(+b||0),0)||1; Object.entries(p.odds).forEach(([r,o])=>{ const x=n*p.count*(+o||0)/t; exp[r]=(exp[r]||0)+x; expTot+=x; }); });
  const realTot=Object.values(rar).reduce((a,b)=>a+b,0);
  v.innerHTML=S.head('Packs & drops','Check real pull rates against the odds you post. Drops from battles and achievements are counted too.',rangeSel())+
    `<div class="kpis">${S.kpi('Packs opened',S.num(Object.values(pk).reduce((a,b)=>a+b,0)))}${S.kpi('Parts pulled',S.num(realTot))}${S.kpi('Legendaries',S.num(rar.legendary||0),pct(rar.legendary||0,realTot))}${S.kpi('Shinies',S.num(ser(rows,'shiny').reduce((a,b)=>a+b,0)))}</div>
    <div class="grid2"><section class="card"><h3>Packs opened per day</h3><div id="k1"></div></section><section class="card"><h3>By pack</h3><div id="k2"></div></section></div>
    <section class="card"><h3>Real vs posted rarity rates</h3><div id="k3"></div><p class="hint">Small differences are normal luck. A big gap with lots of pulls means something’s off.</p></section>`;
  bindRange(v,re);
  const ids=Object.keys(pk), cols=[C.a,C.b,C.c,C.d,C.e,C.f,C.g];
  S.chart($('#k1',v),{labels:L,type:'bar',stack:true,series:ids.map((id,i)=>({name:(BF.Packs&&BF.Packs.get(id)||{name:id}).name,color:cols[i%cols.length],data:rows.map(r=>S.get(r.s,'packs.'+id)||0)}))});
  S.bars($('#k2',v),ids.map(id=>({l:(BF.Packs&&BF.Packs.get(id)||{name:id}).name,v:pk[id]})).sort((a,b)=>b.v-a.v));
  S.table($('#k3',v),[{k:'r',label:'Rarity',fmt:x=>`<span class="pill" style="--pc:${RC[x.r]}">${esc(x.r)}</span>`},{k:'n',label:'Pulled',cls:'r'},{k:'real',label:'Real %',cls:'r',fmt:x=>x.real.toFixed(2)+'%'},{k:'exp',label:'Posted %',cls:'r',fmt:x=>expTot?x.exp.toFixed(2)+'%':'—'},
    {k:'d',label:'Difference',cls:'r',fmt:x=>expTot&&x.n?`<span class="${Math.abs(x.real-x.exp)>Math.max(2,x.exp*0.25)?'down':'muted'}">${x.real-x.exp>=0?'+':''}${(x.real-x.exp).toFixed(2)}</span>`:'—'}],
    ['common','rare','epic','legendary','limited'].map(r=>({r,n:rar[r]||0,real:realTot?(rar[r]||0)/realTot*100:0,exp:expTot?(exp[r]||0)/expTot*100:0})));
}});

// ---------- Economy ----------
S.register('a-economy',{title:'Economy',icon:'🪙',group:'Analytics',sec:'analytics',async render(v){
  const re=()=>this.render(v), rows=await S.stats(RANGE), L=rows.map(r=>short(r.day));
  const ci=ser(rows,'eco.coins.in'), co=ser(rows,'eco.coins.out'), gi=ser(rows,'eco.gems.in'), go=ser(rows,'eco.gems.out'), sum=a=>a.reduce((x,y)=>x+y,0);
  const shop=S.sumMaps(rows,'shop'), rich=await S.db.collection('users').orderBy('coins','desc').limit(10).get().then(q=>{ const r=[]; q.forEach(d=>r.push(Object.assign({uid:d.id},d.data()))); return r; }).catch(()=>[]);
  v.innerHTML=S.head('Economy','Coins and gems flowing in (earned) and out (spent). If “in” keeps beating “out” by a lot, prices will start to feel cheap.',rangeSel())+
    `<div class="kpis">${S.kpi('Coins earned',S.num(sum(ci)))}${S.kpi('Coins spent',S.num(sum(co)))}${S.kpi('Coin balance change',(sum(ci)-sum(co)>=0?'+':'')+S.num(sum(ci)-sum(co)))}${S.kpi('Gems earned',S.num(sum(gi)))}${S.kpi('Gems spent',S.num(sum(go)))}</div>
    <div class="grid2"><section class="card"><h3>Coins per day</h3><div id="e1"></div></section><section class="card"><h3>Gems per day</h3><div id="e2"></div></section></div>
    <div class="grid2"><section class="card"><h3>Shop purchases</h3><div id="e3"></div></section><section class="card"><h3>Richest players</h3><div id="e4"></div></section></div>`;
  bindRange(v,re);
  S.chart($('#e1',v),{labels:L,series:[{name:'Earned',color:C.e,data:ci},{name:'Spent',color:C.d,data:co}]});
  S.chart($('#e2',v),{labels:L,series:[{name:'Earned',color:C.b,data:gi},{name:'Spent',color:C.f,data:go}]});
  S.bars($('#e3',v),Object.entries(shop).filter(([k])=>!k.startsWith('cur.')).map(([k,n])=>({l:{c:'Cosmetics',p:'Packs',o:'Part offers',b:'Bundles',l:'Studio parts'}[k]||k,v:n})).sort((a,b)=>b.v-a.v));
  S.table($('#e4',v),[{k:'name',label:'Player'},{k:'coins',label:'Coins',cls:'r',fmt:r=>S.num(r.coins||0)},{k:'gems',label:'Gems',cls:'r',fmt:r=>S.num(r.gems||0)},{k:'level',label:'Lv',cls:'r'}],rich,{onRow:r=>S.go('player/'+r.uid),sort:'coins'});
}});

// ---------- Errors ----------
S.register('errors',{title:'Errors',icon:'⚠',group:'Analytics',sec:'analytics',async render(v){
  const qs=await S.db.collection('errors').orderBy('ts','desc').limit(200).get(); const list=[]; qs.forEach(d=>list.push(Object.assign({id:d.id},d.data())));
  const g={}; list.forEach(e=>{ const k=e.msg; (g[k]=g[k]||{msg:k,n:0,last:null,shells:{},vers:{},ids:[],sample:e}).n++; const x=g[k]; x.ids.push(e.id); if(!x.last) x.last=e.ts; x.shells[e.shell]=1; x.vers[e.ver]=1; });
  v.innerHTML=S.head('Errors','Crashes and script errors players hit, grouped by message. Newest first.',S.can('analytics','edit')&&list.length?'<button class="btn" id="clr">Clear all</button>':'')+'<div id="et"></div>';
  S.table($('#et',v),[{k:'msg',label:'Error',fmt:r=>`<code class="ell">${esc(r.msg)}</code>`},{k:'n',label:'Count',cls:'r'},{k:'where',label:'Where',fmt:r=>Object.keys(r.shells).join(', ')},{k:'ver',label:'Version',fmt:r=>Object.keys(r.vers).join(', ')},{k:'last',label:'Last seen',fmt:r=>S.ago(r.last),sort:r=>r.last&&r.last.toMillis?r.last.toMillis():0}],Object.values(g),{sort:'n',empty:'No errors — nice.',
    onRow:r=>{ const c=S.modal(`<h3>Error details</h3><pre class="code">${esc(r.msg)}\n\n${esc(r.sample.stack||'(no stack)')}\n\n${esc(r.sample.ua||'')}</pre><div class="macts">${S.can('analytics','edit')?'<button class="btn" id="res">Mark resolved</button>':''}<button class="btn primary" data-x>Close</button></div>`,'wide');
      $('[data-x]',c).onclick=()=>S.closeModal(); const rb=$('#res',c); if(rb) rb.onclick=async()=>{ const b=S.db.batch(); r.ids.forEach(id=>b.delete(S.db.collection('errors').doc(id))); await b.commit(); S.audit('resolved error',r.msg.slice(0,80)); S.closeModal(); S.route(); }; }});
  const cb=$('#clr',v); if(cb) cb.onclick=async()=>{ if(!await S.confirm({title:'Clear all errors?',body:'This deletes the error list (stats counts stay).',ok:'Clear',danger:true})) return; const b=S.db.batch(); list.slice(0,450).forEach(e=>b.delete(S.db.collection('errors').doc(e.id))); await b.commit(); S.audit('cleared errors',list.length+' errors'); S.route(); };
}});
})();
