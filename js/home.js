/* BeyForge v6.1 — Home hub, daily login streak, daily missions, rip-animation splash, player-card banners/frames/titles */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A=()=>BF.Account, today=()=>new Date().toISOString().slice(0,10);
const yesterday=()=>new Date(Date.now()-86400000).toISOString().slice(0,10);
const FV=()=>window.firebase&&firebase.firestore&&firebase.firestore.FieldValue;
async function coins(n){ n=Math.round(n*(BF.Live?BF.Live.mult('coins'):1)); const a=A(); if(a&&a.profile&&FV()) await a.update({coins:FV().increment(n)}); }

// ---------- player card cosmetics ----------
BF.BANNERS={stadium:{label:'Stadium',price:0},neon:{label:'Neon Grid',price:0},xrail:{label:'X-Rail',price:200},flames:{label:'Inferno',price:300},storm:{label:'Storm',price:300},
  galaxy:{label:'Galaxy',price:400},void:{label:'Void Temple',price:400},gold:{label:'Champion Gold',price:0,ach:'badge10'}};
BF.FRAMES={none:{label:'None',price:0},ring:{label:'Ring',price:0},neon:{label:'Neon',price:200},flame:{label:'Flame',price:300},crystal:{label:'Crystal',price:400},gold:{label:'Gold',price:600},legend:{label:'Legend',price:0,ach:'tower30'}};
BF.cardOwns=(cat,k)=>{ const it=(cat==='banner'?BF.BANNERS:BF.FRAMES)[k]; if(!it) return false; if(it.ach) return !!(BF.Ach&&BF.Ach.got()[it.ach])||(A()&&A().isOwner); return BF.Shop?BF.Shop.has(cat,k):!it.price; };
// titles earned from achievements, badges and the tower
BF.earnedTitles=()=>{ const t=[], g=BF.Ach?BF.Ach.got():{}, d=BF.Adventure?BF.Adventure.data():{badges:[],tower:0};
  (BF.Ach?BF.Ach.list:[]).forEach(x=>{ if(g[x.id]) t.push(x.label); });
  d.badges.forEach(e=>t.push(BF.ELEMENTS[e].label+' Badge Holder'));
  if(d.tower>=10) t.push('Tower Climber'); if(d.tower>=30) t.push('Sky Tower Master');
  return t; };
BF.cardClasses=p=>`bn-${(p&&p.card&&p.card.banner)||'stadium'} fr-${(p&&p.card&&p.card.frame)||'ring'}`;

// ---------- daily streak (7-day cycle) ----------
const STREAK=[{c:50},{c:75,g:2},{c:100},{pack:'pack',g:3},{c:150},{c:200,g:5},{pack:'elite',g:10}];
const Streak={
  state(){ const a=A(); return Object.assign({n:0,last:''},(a&&a.profile&&a.profile.streak)||BF.LS.get('bf.streak',{})); },
  canClaim(){ return this.state().last!==today(); },
  nextDay(){ const s=this.state(); if(s.last===today()) return s.n; return s.last===yesterday()?(s.n%7)+1:1; },
  async claim(){
    const a=A(); if(!(a&&a.profile)) throw new Error('Sign in (Blader tab) to collect daily rewards');
    if(!this.canClaim()) throw new Error('Already collected today — come back tomorrow');
    const day=this.nextDay(), r=STREAK[day-1]; await a.update({streak:{n:day,last:today()}});
    let made=null; if(r.c) await coins(r.c); if(r.g&&BF.Gems) await BF.Gems.add(r.g,'streak'); if(r.pack) made=await BF.Packs.open(r.pack,'streak');
    return {day,r,made};
  }
};
BF.Streak=Streak;

// ---------- daily missions (3 per day) ----------
const MISSIONS={
  win2:{label:'Win 2 battles',goal:2,reward:100,ev:'win'}, burst:{label:'Win by Burst Finish',goal:1,reward:80,ev:'burstwin'}, moves5:{label:'Fire 5 moves in battle',goal:5,reward:60,ev:'move'},
  sig:{label:'Fire a signature move',goal:1,reward:100,ev:'sig'}, tower:{label:'Clear a Tower floor',goal:1,reward:120,ev:'tower'}, pack:{label:'Open a pack or crate',goal:1,reward:50,ev:'pack'},
  save:{label:'Save a Bey in the Forge',goal:1,reward:40,ev:'save'}, online:{label:'Win an online battle',goal:1,reward:150,ev:'onlinewin'}, rounds6:{label:'Play 6 rounds',goal:6,reward:70,ev:'round'},
  lean:{label:'Lean 10 times mid-fight',goal:10,reward:50,ev:'lean'}
};
BF.MISSIONS=MISSIONS;
const Missions=BF.Missions={
  state(){ let s=BF.LS.get('bf.missions',null); if(!s||s.date!==today()){ const keys=Object.keys(MISSIONS), pick=[]; let seed=parseInt(today().replace(/-/g,''),10);
      while(pick.length<3){ seed=(seed*9301+49297)%233280; const k=keys[Math.floor(seed/233280*keys.length)]; if(!pick.includes(k)) pick.push(k); }
      s={date:today(),list:pick.map(id=>({id,prog:0,claimed:false}))}; BF.LS.set('bf.missions',s); } return s; },
  bump(ev,n){ const s=this.state(); let ch=false; s.list.forEach(m=>{ const M=MISSIONS[m.id]; if(M.ev===ev&&m.prog<M.goal){ m.prog=Math.min(M.goal,m.prog+(n||1)); ch=true; if(m.prog>=M.goal) BF.App&&BF.App.toast(`Mission complete: ${M.label} — claim it on Home`,'good'); } });
    if(ch){ BF.LS.set('bf.missions',s); if(!$('#view-home').hidden) Home.render(); } },
  async claim(id){ const s=this.state(), m=s.list.find(x=>x.id===id), M=MISSIONS[id]; if(!m||m.claimed||m.prog<M.goal) return;
    const a=A(); if(!(a&&a.profile)) throw new Error('Sign in to claim coins'); await coins(M.reward); m.claimed=true; BF.LS.set('bf.missions',s); return M.reward; }
};

// ---------- Home hub ----------
const NEWS=[
  ['v6.0','New look: hybrid theme, bottom dock, 3D packs & crates with odds, accessibility options and unlockable UI themes.'],
  ['v5.2','Adventure: 30-floor Tower, 10 element gyms, weekly boss, co-op raids, terrain stadiums and signature moves.'],
  ['v5.1','Own your parts: IVs, EVs, levels, skill trees, packs, shinies and Battle Beys.']];
const Home=BF.Home={
  hero:null,
  heroImg(){ const a=A(); const p=a&&a.profile; if(p&&p.showcase&&p.showcase.thumb) return p.showcase.thumb; return this.hero; },
  render(){
    const root=$('#homeRoot'); if(!root) return;
    const a=A(), p=a&&a.profile, lvl=(p&&p.level)||1, xp=(p&&p.xp)||0, x0=BF.xpForLevel?BF.xpForLevel(lvl):0, x1=BF.xpForLevel?BF.xpForLevel(lvl+1):100;
    const ms=Missions.state(), adv=BF.Adventure?BF.Adventure.data():{tower:0,badges:[]}, wb=BF.Adventure?BF.Adventure.weekly():null;
    const name=(p&&p.showcase&&p.showcase.name)||(BF.App&&BF.naming(BF.App.d).full)||'Your Bey';
    const tile=(go,icon,label,sub,cls)=>`<button type="button" class="qtile ${cls||''}" data-go="${go}"><i>${BF.icon(icon,30)}</i><b>${label}</b><span>${sub}</span></button>`;
    root.innerHTML=`
      <section class="hhero ${BF.cardClasses(p)}">
        <div class="hh-ped"><div class="hh-glow"></div>${this.heroImg()?`<img src="${this.heroImg()}" alt="">`:''}</div>
        <div class="hh-info"><small>${p?'WELCOME BACK':'WELCOME TO BEYFORGE'}</small><h1>${esc(p?p.name:'Blader')}</h1>${p&&p.title?`<em>${esc(p.title)}</em>`:''}
          <div class="hh-lv"><b>LV ${lvl}</b><div class="xpbar"><i style="width:${Math.min(100,(xp-x0)/Math.max(1,x1-x0)*100)}%"></i></div></div>
          <div class="hh-bey">Showcase: <b>${esc(name)}</b></div>
          <div class="hh-stats"><span><b class="coin">${p?p.coins||0:'—'}</b>coins</span><span><b>${adv.tower}/30</b>tower</span><span><b>${adv.badges.length}/10</b>badges</span><span><b>${BF.Ach?BF.Ach.doneCount():0}</b>trophies</span></div></div>
      </section>
      <section class="hq">
        ${tile('battle','battle','Quick Battle','vs CPU','big')}${tile('adventure','home','Adventure','Tower · Gyms · Boss')}${tile('online','profile','Play a Friend','Online · Raids')}
        ${tile('forge','forge','Forge','Design & print')}${tile('parts','parts','Open Packs','Parts & crates','packs')}
      </section>
      <section class="hcol">
        ${BF.Daily?BF.Daily.freeHtml()+BF.Daily.streakHtml():''}
        <div class="hbox"><div class="hb-h"><b>Daily missions</b><span class="dim">reset at midnight</span></div>
          ${ms.list.map(m=>{ const M=MISSIONS[m.id], done=m.prog>=M.goal; return `<div class="mission${m.claimed?' claimed':''}"><div><b>${esc(M.label)}</b><div class="mbar"><i style="width:${m.prog/M.goal*100}%"></i></div><span class="mono dim">${m.prog}/${M.goal}</span></div>
            <button class="btn${done&&!m.claimed?' primary':''}" data-mclaim="${m.id}"${done&&!m.claimed?'':' disabled'}>${m.claimed?'✓':`<span class="coin">+${M.reward}</span>`}</button></div>`; }).join('')}</div>
      </section>
      <section class="hcol">
        ${wb?`<div class="hbox boss"><div class="hb-h"><b>👹 Weekly boss</b><span class="dim">${BF.TERRAINS[wb.terrain].label}</span></div><div class="hb-boss"><span class="elb" style="--c:${BF.ELEMENTS[wb.el].color}">${BF.ELEMENTS[wb.el].icon}</span><b>${esc(wb.name)}</b></div><button class="btn wide" data-go="adventure">Take it on</button></div>`:''}
        <div class="hbox"><div class="hb-h"><b>News</b></div><div id="hNews">${NEWS.map(([v,t])=>`<div class="news"><b>${v}</b><span>${esc(t)}</span></div>`).join('')}</div></div>
      </section>`;
    root.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>this.go(b.dataset.go));
    BF.Daily&&BF.Daily.bind(root);
    root.querySelectorAll('[data-mclaim]').forEach(b=>b.onclick=async()=>{ try{ const n=await Missions.claim(b.dataset.mclaim); if(n){ this.burst(b,'🪙'); BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui('coin'); BF.App.toast(`+${n} coins`,'good'); setTimeout(()=>this.render(),700); } }catch(err){ BF.App.toast(err.message,'bad'); } });
    const ann=BF.App&&BF.App._ann; if(ann){ const n=$('#hNews'); n.insertAdjacentHTML('afterbegin',`<div class="news hot"><b>📣</b><span>${esc(ann)}</span></div>`); }
  },
  go(k){ const tab=t=>document.querySelector(`#tabs [data-tab=${t}]`).click(), B=BF.BattleUI;
    if(k==='battle'){ B.mode='cpu'; tab('battle'); B.renderSetup(); }
    else if(k==='adventure'){ B.mode='adventure'; tab('battle'); B.renderSetup(); }
    else if(k==='online'){ B.mode='online'; tab('battle'); B.renderSetup(); }
    else tab(k); },
  // coin burst: little icons fly up from a button
  burst(el,ch){ if(document.documentElement.classList.contains('reduce-motion')) return; const r=el.getBoundingClientRect();
    for(let i=0;i<14;i++){ const s=document.createElement('i'); s.className='cburst'; s.textContent=ch; s.style.left=(r.left+r.width/2)+'px'; s.style.top=(r.top+r.height/2)+'px';
      s.style.setProperty('--dx',((Math.random()-0.5)*260)+'px'); s.style.setProperty('--dy',(-80-Math.random()*200)+'px'); s.style.animationDelay=(i*0.025)+'s'; document.body.appendChild(s); setTimeout(()=>s.remove(),1400); } },
  init(){
    // grab a picture of the current Bey for the hero before leaving the Forge
    try{ this.hero=BF.App.viewer.snapshot(420); }catch(e){}
    BF.Account&&BF.Account.on(()=>{ if(!$('#view-home').hidden) this.render(); });
    document.querySelector('#tabs [data-tab=home]').click();
  }
};

// ---------- splash ----------
BF.Splash={ done(){ const s=$('#splash'); if(!s) return; const min=1700-(performance.now()-(window.__splashT||0)); setTimeout(()=>{ s.classList.add('out'); setTimeout(()=>s.remove(),600); },Math.max(0,min)); } };
})();
