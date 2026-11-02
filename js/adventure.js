/* BeyForge v5.2 — Adventure: Tower (30 floors), 10 element gyms + badges, weekly boss, co-op raids, achievements → Limited parts */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A=()=>BF.Account;
const ELS=()=>Object.keys(BF.ELEMENTS);
const GYM_LEADERS={fire:'Blaze',water:'Marina',earth:'Bedrock',wind:'Gale',lightning:'Volt',ice:'Frost',light:'Lumen',dark:'Umbra',metal:'Forge',void:'Nyx'};
const BOSS_TITLES=['Tyrant','Colossus','Warlord','Overlord','Titan','Behemoth','Juggernaut','Sovereign'];
const BOSS_NAMES=['Inferno Drake','Abyss Leviathan','Storm Garuda','Iron Golem','Eclipse Wyrm','Frost Kraken','Solar Phoenix','Void Hydra'];

// ---------- opponents ----------
function seeded(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return (s>>>0)/4294967296; }; }
// a design whose parts allow element `el` (tries seeds until one fits)
function designFor(seed,el){
  for(let k=0;k<400;k++){ const d=BF.randomDesign((seed*131+k*7919)>>>0); if(!el||BF.allowedElements(d).includes(el)){ d.element={p:el||null,s:null}; return d; } }
  const d=BF.randomDesign(seed); d.element={p:null,s:null}; return d;
}
BF.designForElement=designFor;
function boost(d,mul,sigs){ d.prog={mul:{atk:mul,def:mul,sta:mul,brs:mul,stb:mul},moveLv:{},unlocked:null};
  if(sigs){ d.sigs={}; const pe=BF.partElements(d); sigs.forEach(sl=>d.sigs[sl]=BF.sigFor(pe[sl])); } return d; }
const stadiumFor=(d,terrain)=>Object.assign({},BF.STADIUMS[d.system==='X'?'X':'Burst'],{terrain:terrain||'none'});
const ROUNDS=t=>({target:t,pts:{spin:1,over:1,burst:1,xtreme:1}});

const Adv = BF.Adventure = {
  // ----- progress (account or this device) -----
  data(){ const a=A(); const d=(a&&a.profile&&a.profile.adv)||BF.LS.get('bf.adv',{}); return Object.assign({tower:0,badges:[],weekly:null,raid:null},d); },
  async save(d){ const a=A(); if(a&&a.profile) await a.update({adv:d}).catch(()=>{}); else BF.LS.set('bf.adv',d); },
  week(){ return Math.floor((Date.now()/86400000+3)/7); },
  // ----- tower -----
  floor(n){
    const r=seeded(n*977), boss=n%5===0, el=ELS()[Math.floor(r()*10)], d=designFor(n*31+7,el);
    const lvl=n<=4?'easy':n<=11?'normal':n<=19?'hard':'expert';
    boost(d,1+Math.min(0.25,n*0.008)+(boss?0.06:0),boss?['blade']:null);
    const name=boss?`${BOSS_TITLES[n/5%BOSS_TITLES.length|0]} ${BF.naming(d).name}`:`Floor ${n} · ${BF.naming(d).name}`;
    return {d,name,lvl,boss,el,terrain:boss||n>12?BF.terrainFor(el):'none',rules:ROUNDS(boss?3:2)};
  },
  // ----- gyms -----
  gym(el){ const d=designFor(ELS().indexOf(el)*1013+55,el); d.element={p:el,s:null}; boost(d,1.12,['blade']);
    return {d,name:`Gym Leader ${GYM_LEADERS[el]}`,lvl:'hard',el,terrain:BF.terrainFor(el)==='none'?'none':BF.terrainFor(el),rules:ROUNDS(3)}; },
  // ----- weekly boss (owner can override in Admin → Events) -----
  weekly(){
    const w=this.week(), o=this._override&&this._override.week===w?this._override:null;
    const el=(o&&o.element)||ELS()[w%10], seed=(o&&o.seed)||w*4211;
    const d=designFor(seed,el); boost(d,1+((o&&o.power)||20)/100,['blade','core','driver']);
    return {d,design:d,el,week:w,name:(o&&o.name)||BOSS_NAMES[w%BOSS_NAMES.length],terrain:(o&&o.terrain)||BF.terrainFor(el)};
  },
  listen(){ const a=A(); if(!a||!a.db||this._l) return; this._l=true;
    a.db.collection('config').doc('weekly').onSnapshot(s=>{ this._override=s.data()||null; },()=>{}); },

  // ----- hub panel (inside the Battle tab) -----
  panel(el,UI){
    this.listen();
    const P=BF.Parts, decks=(P?P.decks:[]).filter(k=>P.deckDesign(k)), data=this.data(), wb=this.weekly(), w=this.week();
    if(!UI.advDeck||!decks.find(k=>k.id===UI.advDeck)) UI.advDeck=decks[0]&&decks[0].id;
    const tf=Math.min(30,data.tower+1), fl=this.floor(tf);
    const elChip=e=>`<span class="elb" style="--c:${BF.ELEMENTS[e].color}">${BF.ELEMENTS[e].icon}</span>`;
    el.innerHTML=`<h2>Adventure</h2>
      <div class="seg" id="modeSeg">${[['cpu','vs CPU'],['adventure','Adventure'],['local','2 players'],['online','Online']].map(([k,l])=>`<button type="button" class="${UI.mode===k?'on':''}" data-mode="${k}">${l}</button>`).join('')}</div>
      ${decks.length?`<label class="fl">Your Battle Bey<select id="advDeck">${decks.map(k=>`<option value="${k.id}"${k.id===UI.advDeck?' selected':''}>${esc(k.name)}</option>`).join('')}</select></label>`
        :`<div class="netbox"><b>Adventure needs a Battle Bey</b><span class="dim">Grab your free starter in the Parts tab.</span><button class="btn primary" id="toParts">Open Parts</button></div>`}
      <div class="advcard tower"><div class="ac-h"><b>🗼 Tower</b><span class="dim">Floor ${data.tower}/30 cleared</span></div>
        <div class="towerbar"><i style="width:${data.tower/30*100}%"></i>${[5,10,15,20,25,30].map(n=>`<em style="left:${n/30*100}%" class="${data.tower>=n?'done':''}">${n}</em>`).join('')}</div>
        ${data.tower>=30?'<div class="netok">Tower conquered! 👑</div>':`<div class="ac-next">${fl.boss?'<span class="bossTag">BOSS</span>':''}${elChip(fl.el)} <b>${esc(fl.name)}</b> <span class="dim">${BF.CPU_LEVELS[fl.lvl]}${fl.terrain!=='none'?' · '+BF.TERRAINS[fl.terrain].label:''}</span></div>
        <button class="btn primary wide" data-go="tower"${decks.length?'':' disabled'}>Climb floor ${tf}</button>`}</div>
      <div class="advcard"><div class="ac-h"><b>🏅 Element gyms</b><span class="dim">${data.badges.length}/10 badges</span></div>
        <div class="gymgrid">${ELS().map(e=>`<button type="button" class="gym${data.badges.includes(e)?' won':''}" data-gym="${e}" style="--c:${BF.ELEMENTS[e].color}" title="Gym Leader ${GYM_LEADERS[e]} — ${BF.ELEMENTS[e].label}"${decks.length?'':' disabled'}><i>${BF.ELEMENTS[e].icon}</i><span>${BF.ELEMENTS[e].label}</span></button>`).join('')}</div></div>
      <div class="advcard boss"><div class="ac-h"><b>👹 Weekly boss</b><span class="dim">resets every week</span></div>
        <div class="ac-next">${wb.d.element&&elChip(wb.el)} <b>${esc(wb.name)}</b> <span class="dim">${BF.TERRAINS[wb.terrain].label}</span></div>
        <div class="fine">${data.weekly===w?'✓ Beaten this week — fight again for fun.':'First win this week: 500 coins + a 30% shot at a Legendary crate.'}</div>
        <button class="btn primary wide" data-go="weekly"${decks.length?'':' disabled'}>Fight the boss</button></div>
      <div class="advcard raid"><div class="ac-h"><b>🤝 Co-op raid</b><span class="dim">2 Beys vs a giant boss</span></div>
        <div class="fine">Team up against ${esc(wb.name)} — a giant boss that only goes down to teamwork. ${data.raid===w?'✓ Raid cleared this week.':'First clear this week: a Legendary crate.'}</div>
        <div class="res-acts"><button class="btn" data-go="raidlocal"${decks.length?'':' disabled'}>Raid on this screen</button><button class="btn" data-go="raidonline">Raid online</button></div></div>
      <div class="advcard"><div class="ac-h"><b>🏆 Achievements</b><span class="dim">${BF.Ach.doneCount()}/${BF.Ach.list.length}</span></div>${BF.Ach.html()}</div>`;
    el.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ UI.mode=b.dataset.mode; if(UI.mode!=='online') BF.Net.close(); UI.renderSetup(); });
    const dk=$('#advDeck'); if(dk) dk.onchange=()=>UI.advDeck=dk.value;
    const tp=$('#toParts'); if(tp) tp.onclick=()=>document.querySelector('#tabs [data-tab=parts]').click();
    el.querySelectorAll('[data-gym]').forEach(b=>b.onclick=()=>this.start('gym',b.dataset.gym,UI));
    el.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>this.start(b.dataset.go,null,UI));
  },
  start(kind,id,UI){
    const P=BF.Parts, deck=P.decks.find(k=>k.id===UI.advDeck), me=deck&&P.deckDesign(deck);
    if(kind==='raidonline'){ UI.mode='online'; UI.queue='raid'; UI.renderSetup(); BF.App.toast('Host a match, have your friend join, then start the raid','good'); return; }
    if(!me) return BF.App.toast('Pick a Battle Bey first','bad');
    let o, m;
    if(kind==='tower'){ const n=Math.min(30,this.data().tower+1); o=this.floor(n); m={adventure:{kind,id:n}}; }
    if(kind==='gym'){ o=this.gym(id); m={adventure:{kind,id}}; }
    if(kind==='weekly'){ o=this.weekly(); o.lvl='expert'; o.rules=ROUNDS(3); m={adventure:{kind,id:o.week},boss2:true,bossScale:1.25}; }
    if(kind==='raidlocal'){ const wb=this.weekly(); const p2=UI.designFor(UI.picks.p2&&UI.picks.p2!=='preset:reaper'?UI.picks.p2:'forge');
      UI.mode='local';
      UI.startMatch({raid:true, stadium:stadiumFor(wb.d,wb.terrain), rules:ROUNDS(1), moves:true, prog:true, d1:me, d2:p2, n1:null, n2:null, d3:wb.d, n3:wb.name, bossScale:1.45, adventure:{kind:'raid',id:wb.week}, seed:(Math.random()*1e9)|0});
      return; }
    UI.mode='cpu';
    UI.startMatch(Object.assign({stadium:stadiumFor(me,o.terrain), rules:o.rules, moves:true, prog:true, d1:me, d2:o.d, n1:null, n2:o.name, cpuLevel:o.lvl, seed:(Math.random()*1e9)|0},m));
  },
  // ----- results & rewards -----
  async done(adv,won,UI){
    const d=this.data(), a=A(), signed=a&&a.profile, FV=window.firebase&&firebase.firestore&&firebase.firestore.FieldValue, lines=[];
    const coins=async n=>{ if(signed&&FV){ await a.update({coins:FV.increment(n)}).catch(()=>{}); lines.push(`<div>+${n} coins</div>`); } };
    const partLine=p=>`<div class="dropline" style="--c:${BF.RARITY[p.rarity].color}">🎁 ${p.shiny?'✨ Shiny ':''}${esc(BF.RARITY[p.rarity].label)} ${esc(p.name)}</div>`;
    if(!won){ return adv.kind==='tower'?'<div class="dim">The tower waits. Train up and try again.</div>':''; }
    if(adv.kind==='tower'){ const n=adv.id; if(n>d.tower){ d.tower=n; await this.save(d); lines.push(`<div class="lvup">🗼 Floor ${n} cleared!</div>`); await coins(30+10*n);
        if(n%5===0){ const made=await BF.Parts.openPack(n===30?'crate':'pack','tower'); made.forEach(p=>lines.push(partLine(p))); }
        BF.Ach.event('tower',n); } else lines.push('<div class="dim">Already cleared — climb higher for rewards.</div>'); }
    if(adv.kind==='gym'){ if(!d.badges.includes(adv.id)){ d.badges.push(adv.id); await this.save(d); lines.push(`<div class="lvup">🏅 ${BF.ELEMENTS[adv.id].label} Badge earned!</div>`); await coins(250);
        const slot=BF.PART_SLOTS[Math.floor(Math.random()*3)]; const p=await BF.Parts.create(slot,designFor((Math.random()*1e9)|0,adv.id),'epic','gym'); lines.push(partLine(p)); BF.Ach.event('badges',d.badges.length); }
      else lines.push('<div class="dim">You already have this badge.</div>'); }
    if(adv.kind==='weekly'){ if(d.weekly!==adv.id){ d.weekly=adv.id; await this.save(d); await coins(500);
        if(Math.random()<0.3){ const made=await BF.Parts.openPack('crate','weekly'); made.forEach(p=>lines.push(partLine(p))); }
        else { const p=await BF.Parts.create(BF.PART_SLOTS[Math.floor(Math.random()*3)],BF.Parts.randomDesign(),'epic','weekly'); lines.push(partLine(p)); }
        BF.Ach.event('weekly',1); } else lines.push('<div class="dim">Weekly reward already claimed.</div>'); }
    if(adv.kind==='raid'){ if(d.raid!==adv.id){ d.raid=adv.id; await this.save(d); const made=await BF.Parts.openPack('crate','raid'); made.forEach(p=>lines.push(partLine(p))); await coins(300); BF.Ach.event('raid',1); }
      else lines.push('<div class="dim">Raid reward already claimed this week.</div>'); }
    return lines.join('');
  }
};

// ---------- achievements → coins, packs and Limited parts ----------
function limitedDesign(base,tweak){ const d=BF.fromPreset(BF.PRESETS.find(p=>p.id===base)||BF.PRESETS[0]); tweak(d); return BF.normalize(d); }
const LIMITED = {
  shatter:{slot:'blade', name:'Shatter Fang Blade', make:()=>limitedDesign('saber',d=>{ d.blade.shape='fang'; d.blade.wings=4; d.paint.blade=Object.assign(d.paint.blade,{color:'#ff2e88',finish:'chrome'}); })},
  comet:  {slot:'driver',name:'Xtreme Comet Bit',  make:()=>limitedDesign('saber',d=>{ d.bit.tip='xtreme'; d.bit.gear=true; d.paint.bit.color='#ffb020'; d.paint.tip.color='#ff6a1a'; })},
  expert: {slot:'core',  name:'Expert 9-60 Ratchet',make:()=>limitedDesign('saber',d=>{ d.ratchet.points=9; d.ratchet.height=60; d.paint.ratchet.color='#a07bff'; d.paint.ratchet.finish='pearl'; })},
  tower:  {slot:'blade', name:'Sky Tower Blade',   make:()=>limitedDesign('saber',d=>{ d.blade.shape='star'; d.blade.wings=5; d.paint.blade=Object.assign(d.paint.blade,{color:'#2ef2ff',finish:'chrome'}); })},
  champ:  {slot:'blade', name:'Champion Crown Blade',make:()=>limitedDesign('saber',d=>{ d.blade.shape='crescent'; d.blade.wings=3; d.paint.blade=Object.assign(d.paint.blade,{color:'#ffd36a',finish:'chrome'}); })},
  raider: {slot:'driver',name:'Raid Breaker Bit',  make:()=>limitedDesign('saber',d=>{ d.bit.tip='rubber'; d.paint.bit.color='#3fe08a'; d.paint.tip.color='#16171f'; })},
  online: {slot:'core',  name:'Netrunner 5-70 Ratchet',make:()=>limitedDesign('saber',d=>{ d.ratchet.points=5; d.ratchet.height=70; d.paint.ratchet.color='#2ef2ff'; d.paint.ratchet.finish='glow'; })}
};
const ACH = [
  {id:'first',  label:'First Blood',      desc:'Win a battle.',                 test:s=>s.wins>=1,            reward:{coins:100}},
  {id:'wins25', label:'Veteran Blader',   desc:'Win 25 battles.',               test:s=>s.wins>=25,           reward:{pack:1}},
  {id:'burst10',label:'Shatterer',        desc:'Win 10 times by Burst Finish.', test:s=>(s.finishes.burst||0)>=10, reward:{limited:'shatter'}},
  {id:'xt5',    label:'Xtreme Rider',     desc:'Win 5 times by Xtreme Finish.', test:s=>(s.finishes.xtreme||0)>=5, reward:{limited:'comet'}},
  {id:'expert', label:'Expert Slayer',    desc:'Beat an Expert CPU.',           test:s=>s.expert>=1,          reward:{limited:'expert'}},
  {id:'online5',label:'Netrunner',        desc:'Win 5 online battles.',         test:s=>(s.online&&s.online.wins||0)>=5, reward:{limited:'online'}},
  {id:'tower10',label:'Climber',          desc:'Clear Tower floor 10.',         test:s=>s.tower>=10,          reward:{pack:1}},
  {id:'tower30',label:'Sky Tower',        desc:'Conquer all 30 Tower floors.',  test:s=>s.tower>=30,          reward:{limited:'tower'}},
  {id:'badge3', label:'Gym Challenger',   desc:'Earn 3 gym badges.',            test:s=>s.badges>=3,          reward:{coins:500}},
  {id:'badge10',label:'Element Champion', desc:'Earn all 10 gym badges.',       test:s=>s.badges>=10,         reward:{limited:'champ'}},
  {id:'weekly', label:'Boss Hunter',      desc:'Beat a weekly boss.',           test:s=>s.weekly>=1,          reward:{coins:300}},
  {id:'raid',   label:'Raid Breaker',     desc:'Clear a co-op raid.',           test:s=>s.raid>=1,            reward:{limited:'raider'}},
  {id:'shiny',  label:'Shiny Hunter',     desc:'Own a shiny part.',             test:s=>s.shiny>=1,           reward:{coins:300}},
  {id:'collect',label:'Collector',        desc:'Own 30 parts.',                 test:s=>s.parts>=30,          reward:{pack:1}}
];
BF.LIMITED=LIMITED;
BF.Ach = {
  list:ACH,
  got(){ if(this._mem) return this._mem; const a=A(); return (a&&a.profile&&a.profile.ach)||BF.LS.get('bf.ach',{}); },
  async setGot(g){ this._mem=g; const a=A(); if(a&&a.profile) await a.update({ach:g}).catch(()=>{}); else BF.LS.set('bf.ach',g); },
  doneCount(){ const g=this.got(); return ACH.filter(x=>g[x.id]).length; },
  stats(){ const r=BF.Records.get(), d=Adv.data(), g=this.got(), P=BF.Parts;
    return {wins:r.wins||0, finishes:r.finishes||{}, online:r.online||{}, expert:g._expert||0, tower:d.tower, badges:d.badges.length, weekly:g._weekly||(d.weekly?1:0), raid:g._raid||(d.raid?1:0),
      shiny:P?P.list.filter(p=>p.shiny).length:0, parts:P?P.list.length:0}; },
  html(){ const g=this.got(); return `<div class="achgrid">${ACH.map(x=>{ const rw=x.reward.limited?`Limited: ${LIMITED[x.reward.limited].name}`:x.reward.pack?'Booster pack':`${x.reward.coins} coins`;
    return `<div class="ach${g[x.id]?' got':''}"><b>${g[x.id]?'✓ ':''}${esc(x.label)}</b><span>${esc(x.desc)}</span><em>${esc(rw)}</em></div>`; }).join('')}</div>`; },
  event(k,v){ const g=this.got(); if(k==='weekly') g._weekly=1; if(k==='raid') g._raid=1; this._pending=g; this.check({}); },
  async check(ctx){
    const g=Object.assign({},this._pending||this.got()); this._pending=null;
    if(ctx&&ctx.won&&ctx.mode==='cpu'&&BF.BattleUI.cpuLv&&BF.BattleUI.cpuLv()==='expert') g._expert=(g._expert||0)+1;
    const st=this.stats(); st.expert=g._expert||0; st.weekly=Math.max(st.weekly,g._weekly||0); st.raid=Math.max(st.raid,g._raid||0);
    const fresh=ACH.filter(x=>!g[x.id]&&x.test(st)); if(!fresh.length){ await this.setGot(g); return; }
    fresh.forEach(x=>g[x.id]=Date.now()); await this.setGot(g);   // mark first so rewards can never double up
    for(const x of fresh) await this.grant(x);
  },
  async grant(x){
    const a=A(), FV=window.firebase&&firebase.firestore&&firebase.firestore.FieldValue; let made=[];
    if(x.reward.coins&&a&&a.profile&&FV) await a.update({coins:FV.increment(x.reward.coins)}).catch(()=>{});
    if(x.reward.pack) made=await BF.Parts.openPack('pack','achievement');
    if(x.reward.limited){ const L=LIMITED[x.reward.limited]; made=[await BF.Parts.create(L.slot,L.make(),'limited','achievement',{name:L.name})]; }
    this.toast(x,made);
  },
  toast(x,made){ const el=document.createElement('div'); el.className='achpop'; el.innerHTML=`<i>🏆</i><div><small>Achievement unlocked</small><b>${esc(x.label)}</b>${made&&made.length?`<span>${made.map(p=>esc(p.name)).join(', ')}</span>`:''}</div>`;
    document.body.appendChild(el); BF.Sfx&&BF.Sfx.finish&&BF.Sfx.finish('xtreme'); setTimeout(()=>el.classList.add('out'),3800); setTimeout(()=>el.remove(),4400); }
};
BF.Parts&&BF.Parts.on(()=>{ clearTimeout(BF.Ach._t); BF.Ach._t=setTimeout(()=>BF.Ach.check({}),1500); });
})();
