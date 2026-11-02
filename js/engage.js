/* BeyForge v6.6 — E1 "The hook": everything here is tunable from BeyForge Studio (config/economy).
   - Onboarding: instant first battle → free starter pack → "save your progress" sign-up
   - Free pack timer (bank up to N, hourglasses, local phone notifications)
   - 30-day streak calendar with jackpots + streak freezes
   - First win of the day bonus
   - Spin Drops after wins (rarity can upgrade mid-animation)
   - Reward cascade on the results screen */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A=()=>BF.Account, FV=()=>firebase.firestore.FieldValue, prof=()=>{ const a=A(); return a&&a.profile; };
const today=()=>new Date().toLocaleDateString('en-CA'), dayNum=d=>Math.floor(new Date(d+'T00:00:00').getTime()/86400000);
const sfx=(k,a)=>{ try{ BF.Sfx&&(k==='ui'?BF.Sfx.ui&&BF.Sfx.ui(a):BF.Sfx[k]&&BF.Sfx[k](a)); }catch(e){} };
const calm=()=>document.documentElement.classList.contains('reduce-motion');
const ORDER=['common','rare','epic','legendary'], RC=r=>(BF.RARITY[r]||BF.RARITY.common).color;

// ---------- economy config (defaults; Studio overrides live in config/economy) ----------
const STREAK30=[{coins:50},{hourglass:1},{coins:100},{pack:'pack'},{gems:5},{coins:150},{pack:'elite',gems:25,coins:300,jackpot:1},
  {coins:80},{hourglass:2},{coins:150},{pack:'pack'},{gems:10},{coins:200},{pack:'mystery',freeze:1,jackpot:1},
  {coins:100},{hourglass:2},{coins:200},{pack:'pack'},{gems:10},{coins:250},{pack:'elite',gems:40,jackpot:1},
  {coins:120},{hourglass:3},{coins:250},{pack:'pack'},{gems:15},{coins:300},{pack:'crate',gems:50,freeze:1,jackpot:1},{coins:400},{pack:'crate',gems:100,coins:1000,jackpot:1}];
const DEFAULTS={
  onboarding:{on:true,pack:'pack',starterBoost:1.4},
  freePack:{on:true,hours:12,bank:2,pack:'pack',hourglassMin:60},
  streak:{on:true,days:STREAK30,freezeMax:2},
  firstWin:{on:true,xp:150,coins:100,spinDrop:true},
  spinDrop:{on:true,perDay:6,odds:{common:58,rare:30,epic:10,legendary:2},upgrade:25,
    rewards:{common:{coins:40},rare:{coins:120,hourglass:1},epic:{gems:8,pack:'pack'},legendary:{part:'legendary',gems:20}}},
  missions:{hourglassOnAll:1},
  dex:{on:true,defaultView:'grid',
    sets:{X_blade:{pack:'crate'},X_core:{pack:'elite',gems:20},X_driver:{pack:'elite',gems:20},Burst_blade:{pack:'burstcrate'},Burst_core:{pack:'elite',gems:20},Burst_driver:{pack:'elite',gems:20}},
    milestones:[{pct:10,coins:500},{pct:25,gems:15,pack:'pack'},{pct:50,gems:30,pack:'elite'},{pct:75,gems:50,pack:'mystery'},{pct:100,gems:150,coins:5000,pack:'crate'}]}
};
BF.ECON_DEFAULTS=DEFAULTS;
const deep=(a,b)=>{ if(Array.isArray(b)) return b.slice(); if(b&&typeof b==='object'){ const o=Object.assign({},a); Object.entries(b).forEach(([k,v])=>o[k]=deep(a&&a[k],v)); return o; } return b===undefined?a:b; };
const Econ=BF.Econ={ cfg:DEFAULTS,
  listen(){ const a=A(); if(this._l||!a||!a.db) return; this._l=true; a.db.collection('config').doc('economy').onSnapshot(s=>{ this.cfg=deep(DEFAULTS,s.data()||{}); BF.Home&&!$('#view-home').hidden&&BF.Home.render(); },()=>{}); },
  get(k){ return this.cfg[k]; } };

// ---------- rewards (shared by streak, spin drops, first win) ----------
const Reward=BF.Reward={
  icon(r){ return r.part?'⚙':r.pack?'🎁':r.gems?'💎':r.hourglass?'⏳':r.freeze?'🧊':r.xp?'⭐':'🪙'; },
  text(r){ const out=[]; if(r.coins) out.push(`${r.coins} coins`); if(r.gems) out.push(`${r.gems} gems`); if(r.xp) out.push(`${r.xp} XP`); if(r.hourglass) out.push(`${r.hourglass} hourglass${r.hourglass>1?'es':''}`);
    if(r.freeze) out.push(`${r.freeze} streak freeze`); if(r.pack) out.push((BF.Packs.get(r.pack)||{name:'Pack'}).name); if(r.part) out.push(`${(BF.RARITY[r.part]||{label:r.part}).label} part`); return out.join(' + '); },
  short(r){ return r.pack?(BF.Packs.get(r.pack)||{name:'Pack'}).name.split(' ')[0]:r.part?(BF.RARITY[r.part]||{}).label:r.gems&&!r.coins?r.gems+'💎':r.hourglass?r.hourglass+'⏳':r.coins||r.gems||''; },
  async grant(r,src){
    const a=A(), p=prof(); if(!(a&&p)) throw new Error('Sign in (Blader tab) to collect rewards');
    const up={}, mult=k=>BF.Live?BF.Live.mult(k):1;
    if(r.coins) up.coins=FV().increment(Math.round(r.coins*(src==='spin'||src==='firstwin'?mult('coins'):1)));
    if(r.gems) up.gems=FV().increment(r.gems); if(r.hourglass) up.hourglasses=FV().increment(r.hourglass);
    if(r.freeze) up['streak.freezes']=Math.min(Econ.get('streak').freezeMax||2,((p.streak&&p.streak.freezes)||0)+r.freeze);
    if(r.xp){ const xp=(p.xp||0)+Math.round(r.xp*mult('xp')); up.xp=xp; up.level=BF.levelFor(xp); }
    if(Object.keys(up).length) await a.update(up);
    let made=null;
    if(r.pack) made=await BF.Packs.open(BF.Packs.get(r.pack)?r.pack:'pack',src||'reward');
    if(r.part){ const slot=BF.PART_SLOTS[Math.floor(Math.random()*3)]; made=[await BF.Parts.create(slot,BF.Parts.randomDesign(),r.part,src||'reward')]; }
    BF.Log&&BF.Log.add('reward',{src,reward:Reward.text(r)});
    return made;
  }
};

// ---------- free pack timer ----------
const FreePack=BF.FreePack={
  cfg(){ return Econ.get('freePack'); }, period(){ return Math.max(0.25,+this.cfg().hours||12)*3600000; },
  anchor(){ const p=prof(); const t=p?(p.freePack&&p.freePack.t):BF.LS.get('bf.freePackT',null); return t==null?Date.now()-this.period():t; },
  avail(){ const n=Math.floor((Date.now()-this.anchor())/this.period()); return Math.max(0,Math.min(this.cfg().bank||2,n)); },
  nextIn(){ const per=this.period(), el=(Date.now()-this.anchor())%per; return this.avail()>=(this.cfg().bank||2)?0:per-el; },
  hourglasses(){ const p=prof(); return (p&&p.hourglasses)||0; },
  async save(t){ const a=A(); if(a&&a.profile) await a.update({'freePack.t':t}); else BF.LS.set('bf.freePackT',t); },
  async claim(){ if(!this.cfg().on) throw new Error('Free packs are off right now'); if(this.avail()<1) throw new Error('Not ready yet');
    const per=this.period(), bank=this.cfg().bank||2, t0=Math.max(this.anchor(),Date.now()-bank*per);
    const made=await BF.Packs.open(BF.Packs.get(this.cfg().pack)?this.cfg().pack:'pack','free'); await this.save(t0+per); BF.Stats&&BF.Stats.add('freepack');
    Notify.ask(); this.schedule(); return made; },
  async useHourglass(){ const a=A(); if(!(a&&a.profile)) throw new Error('Sign in to use hourglasses'); if(this.hourglasses()<1) throw new Error('No hourglasses — earn them from the streak, missions and Spin Drops');
    await a.update({hourglasses:FV().increment(-1),'freePack.t':this.anchor()-(this.cfg().hourglassMin||60)*60000}); sfx('ui','coin'); setTimeout(()=>this.schedule(),500); },
  schedule(){ const ms=this.avail()>=1?0:this.nextIn(); if(ms>0) Notify.at('freepack',Date.now()+ms,'🎁 Free pack ready!','Your free BeyForge pack is waiting. Tap to rip it open.'); },
  fmt(ms){ const s=Math.ceil(ms/1000), h=Math.floor(s/3600), m=Math.floor(s%3600/60); return h?`${h}h ${m}m`:m?`${m}m ${s%60}s`:`${s}s`; }
};

// ---------- 30-day streak with freezes ----------
const Streak=BF.Streak={
  cfg(){ return Econ.get('streak'); }, days(){ return this.cfg().days||STREAK30; },
  state(){ const p=prof(); return Object.assign({n:0,last:'',freezes:0},(p&&p.streak)||{}); },
  // what happens if you claim today: continue, use freezes, or restart
  plan(){ const s=this.state(), t=dayNum(today()); if(s.last===today()) return {done:true,day:s.n};
    if(!s.last) return {day:1}; const gap=t-dayNum(s.last)-1; const len=this.days().length;
    if(gap<=0) return {day:(s.n%len)+1}; if(gap<=s.freezes) return {day:(s.n%len)+1,usedFreezes:gap}; return {day:1,lost:s.n}; },
  canClaim(){ return !this.plan().done; },
  nextDay(){ return this.plan().day; },
  async claim(){ const a=A(); if(!(a&&a.profile)) throw new Error('Sign in (Blader tab) to collect daily rewards');
    const pl=this.plan(); if(pl.done) throw new Error('Already collected today — come back tomorrow'); const s=this.state(), r=this.days()[pl.day-1]||{coins:50};
    await a.update({streak:{n:pl.day,last:today(),freezes:Math.max(0,s.freezes-(pl.usedFreezes||0))}});
    const made=await Reward.grant(r,'streak'); BF.Stats&&BF.Stats.add('streak.d'+pl.day); return {day:pl.day,r,made,usedFreezes:pl.usedFreezes||0,lost:pl.lost||0}; }
};

// ---------- notifications (local: no server needed) ----------
const Notify=BF.Notify={
  cap(){ const C=window.Capacitor; return C&&C.Plugins&&C.Plugins.LocalNotifications; },
  async ask(){ if(BF.LS.get('bf.notifAsked',false)) return; BF.LS.set('bf.notifAsked',true);
    try{ const L=this.cap(); if(L){ await L.requestPermissions(); return; } if('Notification' in window&&Notification.permission==='default') await Notification.requestPermission(); }catch(e){} },
  async at(key,when,title,body){ const id={freepack:1001,streak:1002}[key]||1999;
    try{ const L=this.cap(); if(L){ await L.cancel({notifications:[{id}]}).catch(()=>{}); await L.schedule({notifications:[{id,title,body,schedule:{at:new Date(when),allowWhileIdle:true}}]}); return; } }catch(e){}
    clearTimeout(this['_'+key]); if('Notification' in window&&Notification.permission==='granted'&&when-Date.now()<864e5) this['_'+key]=setTimeout(()=>{ if(document.hidden) new Notification(title,{body,icon:'icons/icon-192.png'}); },when-Date.now()); }
};

// ---------- spin drops ----------
const Spin=BF.SpinDrop={
  cfg(){ return Econ.get('spinDrop'); },
  left(){ const p=prof(), s=(p&&p.spin)||{}; return s.day===today()?Math.max(0,this.cfg().perDay-(s.n||0)):this.cfg().perDay; },
  roll(min){ const o=this.cfg().odds, t=ORDER.reduce((a,r)=>a+(+o[r]||0),0)||1; let x=Math.random()*t, r='common'; for(const k of ORDER){ x-=(+o[k]||0); if(x<0){ r=k; break; } }
    if(min&&ORDER.indexOf(r)<ORDER.indexOf(min)) r=min; const path=[r]; while(ORDER.indexOf(r)<3&&Math.random()*100<(+this.cfg().upgrade||0)){ r=ORDER[ORDER.indexOf(r)+1]; path.push(r); } return path; },
  async open(free,min){ const a=A(); if(!(a&&a.profile)) throw new Error('Sign in to open Spin Drops'); if(!free&&this.left()<1) throw new Error('No Spin Drops left today');
    const path=this.roll(min), r=path[path.length-1], p=prof(), s=(p.spin&&p.spin.day===today())?p.spin:{day:today(),n:0};
    if(!free) await a.update({spin:{day:today(),n:(s.n||0)+1}}); BF.Stats&&BF.Stats.add('spin.'+r);
    return {path,reward:Object.assign({},this.cfg().rewards[r]||{coins:30})}; },
  // the capsule animation: shake → flash → (upgrade, upgrade…) → reveal
  show(free,min,done){
    const ov=document.createElement('div'); ov.id='spinDrop'; ov.innerHTML=`<div class="sd-bg"></div><div class="sd-cap"><div class="sd-core"></div><i></i><i></i><i></i></div><div class="sd-lab">Tap to open</div><div class="sd-out"></div>`;
    document.body.appendChild(ov); const cap=ov.querySelector('.sd-cap'), lab=ov.querySelector('.sd-lab'); let st=0; sfx('ui','open');
    const setR=r=>{ ov.style.setProperty('--rc',RC(r)); ov.dataset.r=r; };
    setR('common');
    ov.onclick=async()=>{ if(st===1) return; if(st===2){ ov.classList.add('out'); setTimeout(()=>ov.remove(),300); done&&done(); return; } st=1; lab.textContent='';
      let res; try{ res=await this.open(free,min); }catch(e){ BF.App.toast(e.message,'bad'); ov.remove(); return; }
      cap.classList.add('shake'); let i=0;
      const step=()=>{ const r=res.path[i]; setR(r); cap.classList.remove('pop'); void cap.offsetWidth; cap.classList.add('pop'); sfx('ui',i===0?'flip':ORDER.indexOf(r)>=3?'legend':'epic');
        if(i>0){ lab.textContent=`UPGRADE → ${(BF.RARITY[r]||{}).label.toUpperCase()}!`; navigator.vibrate&&navigator.vibrate(40); }
        i++; if(i<res.path.length) setTimeout(step,calm()?350:900); else setTimeout(reveal,calm()?300:800); };
      const reveal=async()=>{ cap.classList.add('burst'); const r=res.path[res.path.length-1]; lab.textContent=(BF.RARITY[r]||{}).label.toUpperCase();
        let made=null; try{ made=await Reward.grant(res.reward,'spin'); }catch(e){ BF.App.toast(e.message,'bad'); }
        ov.querySelector('.sd-out').innerHTML=`<div class="sd-rw"><i>${Reward.icon(res.reward)}</i><b>${esc(Reward.text(res.reward))}</b></div><small>Tap to continue</small>`; st=2;
        if(made&&made.length) setTimeout(()=>{ ov.remove(); BF.PackOpen.show(made,res.reward.pack?BF.Packs.get(res.reward.pack):{name:'Spin Drop',colors:[RC(r),'#ffffff'],model:'crate'},{onClose:done}); },1300); };
      setTimeout(step,calm()?200:700); };
  }
};

// ---------- first win of the day ----------
const FirstWin=BF.FirstWin={
  ready(){ const p=prof(); return !!(p&&Econ.get('firstWin').on&&p.firstWin!==today()); },
  async claim(){ const a=A(); if(!this.ready()) return null; const c=Econ.get('firstWin'); await a.update({firstWin:today()});
    await Reward.grant({xp:c.xp,coins:c.coins},'firstwin'); BF.Stats&&BF.Stats.add('firstwin'); return c; }
};

// ---------- reward cascade on the results screen ----------
const Cascade=BF.Cascade={
  async run(box,ctx){
    const a=A(); if(!box) return;
    if(!(a&&a.profile)){ box.innerHTML=`<div class="cz-guest">💾 <b>Sign in to keep your rewards</b><span>XP, coins, Spin Drops and daily bonuses need an account.</span><button class="btn primary sm" data-go-profile>Sign in</button></div>`;
      box.querySelector('[data-go-profile]').onclick=()=>document.querySelector('#tabs [data-tab=profile]').click(); return; }
    // wait for the server to apply the match XP/coins
    const p0=ctx.before; let p1=prof(); for(let k=0;k<20&&p1&&(p1.xp||0)===(p0.xp||0);k++){ await new Promise(r=>setTimeout(r,150)); p1=prof(); }
    const rows=[]; const add=(html,cls)=>{ const d=document.createElement('div'); d.className='cz-row '+(cls||''); d.innerHTML=html; box.appendChild(d); requestAnimationFrame(()=>d.classList.add('in')); rows.push(d); return d; };
    const wait=ms=>new Promise(r=>setTimeout(r,calm()?ms/3:ms));
    box.innerHTML='';
    // 1) player XP bar
    const l0=p0.level||1, xp0=p0.xp||0, xp1=(p1&&p1.xp)||xp0, l1=BF.levelFor(xp1), gain=xp1-xp0;
    const seg=(xp,l)=>{ const a0=BF.xpForLevel(l), a1=BF.xpForLevel(l+1); return Math.max(0,Math.min(100,(xp-a0)/Math.max(1,a1-a0)*100)); };
    const xr=add(`<span class="cz-ic">⭐</span><div class="cz-mid"><b>Player XP <em>+${gain}</em></b><div class="cz-bar"><i style="width:${seg(xp0,l0)}%"></i></div></div><span class="cz-lv">LV <b>${l0}</b></span>`,'xp');
    await wait(250); const bar=xr.querySelector('.cz-bar i');
    if(l1>l0){ bar.style.width='100%'; await wait(650); xr.querySelector('.cz-lv b').textContent=l1; xr.classList.add('lvup'); sfx('ui','legend'); BF.Home&&BF.Home.burst&&BF.Home.burst(xr,'⭐'); add(`<span class="cz-ic">🎉</span><div class="cz-mid"><b>LEVEL UP! You’re level ${l1}</b></div>`,'big'); bar.style.transition='none'; bar.style.width='0%'; void bar.offsetWidth; bar.style.transition=''; }
    bar.style.width=seg(xp1,l1)+'%'; sfx('ui','flip'); await wait(700);
    // 2) coins
    const dc=((p1&&p1.coins)||0)-(p0.coins||0); if(dc>0){ const r=add(`<span class="cz-ic">🪙</span><div class="cz-mid"><b>Coins <em class="coin">+<span>0</span></em></b></div>`); const s=r.querySelector('em span'); let n=0; const st=Math.max(1,Math.ceil(dc/20)); const t=setInterval(()=>{ n=Math.min(dc,n+st); s.textContent=n; if(n>=dc) clearInterval(t); },30); sfx('ui','coin'); await wait(600); }
    // 3) first win of the day
    if(ctx.won&&FirstWin.ready()){ const c=await FirstWin.claim().catch(()=>null); if(c){ add(`<span class="cz-ic">☀</span><div class="cz-mid"><b>First win of the day!</b><span>+${c.xp} XP · +${c.coins} coins${c.spinDrop?' · free Spin Drop':''}</span></div>`,'gold'); sfx('ui','epic'); await wait(700); ctx.freeSpin=c.spinDrop; } }
    // 4) missions
    const ms=BF.Missions&&BF.Missions.state(); if(ms&&BF.MISSIONS){ add(`<span class="cz-ic">🎯</span><div class="cz-mid"><b>Daily missions</b><div class="cz-ms">${ms.list.map(m=>{ const M=BF.MISSIONS[m.id]; return `<span class="${m.prog>=M.goal?'ok':''}"><i style="width:${m.prog/M.goal*100}%"></i>${esc(M.label)} ${m.prog}/${M.goal}</span>`; }).join('')}</div></div>`); await wait(500); }
    // 5) free pack reminder
    const fa=FreePack.avail(); if(FreePack.cfg().on) add(`<span class="cz-ic">🎁</span><div class="cz-mid"><b>${fa?`${fa} free pack${fa>1?'s':''} ready!`:`Next free pack in ${FreePack.fmt(FreePack.nextIn())}`}</b></div>${fa?'<button class="btn primary sm" data-fp>Open</button>':''}`);
    const fb=box.querySelector('[data-fp]'); if(fb) fb.onclick=async()=>{ fb.disabled=true; try{ const m=await FreePack.claim(); BF.PackOpen.show(m,BF.Packs.get(FreePack.cfg().pack)); }catch(e){ BF.App.toast(e.message,'bad'); } };
    // 6) spin drop
    if(ctx.won&&Spin.cfg().on&&(ctx.freeSpin||Spin.left()>0)){ await wait(300); const r=add(`<span class="cz-ic sd-mini"></span><div class="cz-mid"><b>Spin Drop!</b><span>${ctx.freeSpin?'Free from your first win':`${Spin.left()} left today`}</span></div><button class="btn primary sm" data-sd>Open</button>`,'spin');
      r.querySelector('[data-sd]').onclick=e=>{ e.currentTarget.disabled=true; const free=ctx.freeSpin; ctx.freeSpin=false; Spin.show(free,null,()=>{ r.querySelector('span:nth-child(2)')&&0; }); r.classList.add('used'); }; sfx('ui','open'); }
  }
};

// ---------- onboarding: instant first battle ----------
const STARTERS=['saber','reaper','arcane'];
const Onboard=BF.Onboard={
  need(){ return Econ.get('onboarding').on&&!BF.LS.get('bf.onboarded',false)&&!(A()&&A().user)&&!(BF.Parts&&BF.Parts.list&&BF.Parts.list.length)&&!BF.LS.get('bf.starter',false); },
  start(){
    const pres=STARTERS.map(id=>BF.PRESETS.find(p=>p.id===id)).filter(Boolean);
    const ov=document.createElement('div'); ov.id='onboard'; ov.innerHTML=`<div class="ob-card"><small>WELCOME TO BEYFORGE</small><h1>Pick your first Bey</h1><p>You’re about to battle. Choose your partner:</p>
      <div class="ob-picks">${pres.map((p,i)=>{ const d=BF.fromPreset(p), an=BF.analyze(BF.build(d),BF.massProps(BF.build(d))); return `<button type="button" class="ob-pick" data-i="${i}" style="--c:${d.paint.blade.color}"><span class="ob-ic">${BF.icon?BF.icon('battle',34):'⚔'}</span><b>${esc(p.name)}</b><em>${esc(an.type)}</em><span>${esc(p.blurb||'')}</span></button>`; }).join('')}</div>
      <button class="btn ghost sm" id="obSkip">I’ve played before — skip</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#obSkip').onclick=()=>{ BF.LS.set('bf.onboarded',true); ov.remove(); };
    ov.querySelectorAll('.ob-pick').forEach(b=>b.onclick=()=>{ const pr=pres[+b.dataset.i], d=BF.normalize(BF.fromPreset(pr)); ov.remove(); this.battle(d,pr.name); });
  },
  battle(d,name){
    try{ BF.App.d=BF.clone(d); BF.App.rebuild&&BF.App.rebuild(); }catch(e){}
    const B=BF.BattleUI; document.querySelector('#tabs [data-tab=battle]').click(); B.mode='cpu';
    const foe=BF.Parts.randomDesign(d.system), st=B.stadium();
    this._d=d; this._name=name;
    setTimeout(()=>{ B.startMatch({tut:true,cpuLevel:'easy',stadium:st,rules:{target:1,pts:{spin:1,over:1,burst:1,xtreme:1}},moves:true,prog:false,d1:BF.clone(d),d2:foe,n1:name,n2:'Rookie Rival',seed:(Math.random()*1e9)|0});
      BF.App.toast('Aim, then pull the ripcord hard! 💥','good'); },300);
  },
  async done(won){
    BF.LS.set('bf.onboarded',true); BF.Stats&&BF.Stats.add('onboard.done');
    const ov=document.createElement('div'); ov.id='onboard'; ov.innerHTML=`<div class="ob-card ${won?'win':''}"><small>${won?'FIRST VICTORY':'CLOSE ONE'}</small><h1>${won?'You won!':'Nice try!'}</h1><p>Every blader needs parts. Here’s your free starter pack — rip it open!</p><button class="btn primary big" id="obPack">🎁 Open starter pack</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#obPack').onclick=async()=>{ ov.remove(); let made=[];
      try{ await BF.Parts.claimStarter(this._d,this._name||'Starter'); made=await BF.Packs.open(BF.Packs.get(Econ.get('onboarding').pack)?Econ.get('onboarding').pack:'pack','starter'); }catch(e){ console.warn(e); }
      BF.PackOpen.show(made,BF.Packs.get(Econ.get('onboarding').pack)||BF.Packs.get('pack'),{onClose:()=>this.save()}); };
  },
  save(){ if(A()&&A().user) return;
    const ov=document.createElement('div'); ov.id='onboard'; ov.innerHTML=`<div class="ob-card"><small>DON’T LOSE YOUR STUFF</small><h1>Save your progress</h1>
      <ul class="ob-perks"><li>🎁 Free pack every ${FreePack.cfg().hours} hours</li><li>📅 Daily rewards &amp; 30-day streak</li><li>⚔ Battle friends online &amp; climb ranked</li><li>☁ Your Beys and parts on every device</li></ul>
      <button class="btn primary big" id="obSign">Create account / Sign in</button><button class="btn ghost sm" id="obLater">Later</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#obSign').onclick=()=>{ ov.remove(); document.querySelector('#tabs [data-tab=profile]').click(); };
    ov.querySelector('#obLater').onclick=()=>{ ov.remove(); document.querySelector('#tabs [data-tab=home]').click(); };
  }
};

// ---------- home: free pack card + streak calendar ----------
BF.Daily={
  freeHtml(){ const c=FreePack.cfg(); if(!c.on) return ''; const n=FreePack.avail(), pk=BF.Packs.get(c.pack)||BF.Packs.get('pack');
    return `<div class="hbox fpack${n?' ready':''}"><div class="fp-art"><img src="${BF.PackModel.thumb(pk,160)}" alt="">${n>1?`<i>×${n}</i>`:''}</div><div class="fp-info"><b>Free ${esc(pk.name)}</b>
      <span id="fpTime">${n?`${n} ready to open!`:`Next in ${FreePack.fmt(FreePack.nextIn())}`}</span><div class="fp-bar"><i style="width:${n>=(c.bank||2)?100:Math.round((1-FreePack.nextIn()/FreePack.period())*100)}%"></i></div>
      <div class="row"><button class="btn primary" id="fpOpen"${n?'':' disabled'}>${n?'Open now':'Charging…'}</button><button class="btn ghost sm" id="fpHg" title="Each hourglass skips ${c.hourglassMin} min"${FreePack.hourglasses()&&!n?'':' disabled'}>⏳ ${FreePack.hourglasses()}</button></div></div></div>`; },
  streakHtml(){ const c=Streak.cfg(); if(!c.on) return ''; const s=Streak.state(), pl=Streak.plan(), days=Streak.days(), cur=pl.done?pl.day:pl.day, can=!pl.done;
    const start=Math.max(0,Math.min(days.length-7,cur-4));
    return `<div class="hbox"><div class="hb-h"><b>Daily streak</b><span class="dim">Day ${cur} of ${days.length}${s.freezes?` · 🧊 ${s.freezes}`:''}</span></div>
      ${pl.lost?`<div class="sk-lost">You missed a day — streak restarts. Streak freezes protect you next time.</div>`:pl.usedFreezes?`<div class="sk-frz">🧊 ${pl.usedFreezes} freeze${pl.usedFreezes>1?'s':''} will save your ${s.n}-day streak!</div>`:''}
      <div class="streak">${days.slice(start,start+7).map((r,k)=>{ const d=start+k+1, done=pl.done?d<=cur:d<cur, now=can&&d===cur;
        return `<div class="sday${done?' done':''}${now?' now':''}${r.jackpot?' jack':''}"><small>Day ${d}</small><i>${Reward.icon(r)}</i><b>${esc(Reward.short(r))}</b></div>`; }).join('')}</div>
      <div class="row"><button class="btn primary grow" id="claimStreak"${can?'':' disabled'}>${can?'Collect today’s reward':'Collected — see you tomorrow'}</button><button class="btn ghost sm" id="streakCal">📅 All ${days.length}</button></div></div>`; },
  bind(root){
    const fo=root.querySelector('#fpOpen'); if(fo) fo.onclick=async()=>{ fo.disabled=true; try{ const m=await FreePack.claim(); BF.PackOpen.show(m,BF.Packs.get(FreePack.cfg().pack)||BF.Packs.get('pack'),{onClose:()=>BF.Home.render()}); }catch(e){ BF.App.toast(e.message,'bad'); fo.disabled=false; } };
    const hg=root.querySelector('#fpHg'); if(hg) hg.onclick=async()=>{ try{ await FreePack.useHourglass(); BF.Home.burst(hg,'⏳'); setTimeout(()=>BF.Home.render(),400); }catch(e){ BF.App.toast(e.message,'bad'); } };
    const cs=root.querySelector('#claimStreak'); if(cs) cs.onclick=async()=>{ cs.disabled=true;
      try{ const r=await Streak.claim(); BF.Home.burst(cs,Reward.icon(r.r)); sfx('ui',r.r.jackpot?'legend':'coin'); if(r.usedFreezes) BF.App.toast(`🧊 Streak freeze used — your streak is safe!`,'good');
        if(r.made&&r.made.length) BF.PackOpen.show(r.made,BF.Packs.get(r.r.pack)||{name:'Reward',colors:['#ffd21f','#ff2e88'],model:'crate'},{onClose:()=>BF.Home.render()}); else { BF.App.toast(`Day ${r.day}: ${Reward.text(r.r)}`,'good'); setTimeout(()=>BF.Home.render(),900); } }
      catch(e){ BF.App.toast(e.message,'bad'); cs.disabled=false; } };
    const sc=root.querySelector('#streakCal'); if(sc) sc.onclick=()=>this.calendar();
    clearInterval(this._t); this._t=setInterval(()=>{ const el=document.getElementById('fpTime'); if(!el){ clearInterval(this._t); return; } const n=FreePack.avail(); if(n&&!el.dataset.r){ BF.Home.render(); return; } if(!n) el.textContent=`Next in ${FreePack.fmt(FreePack.nextIn())}`; },1000);
  },
  calendar(){ const days=Streak.days(), pl=Streak.plan(), cur=pl.day, m=$('#partModal'), b=$('#partBody'); m.hidden=false;
    b.innerHTML=`<div class="modal-head"><h3>${days.length}-day streak</h3><button class="icon-x big" data-x>×</button></div><p class="dim">Log in every day. Jackpot days are worth more than the days before them combined. Miss a day and a 🧊 streak freeze saves you (max ${Streak.cfg().freezeMax}).</p>
      <div class="cal30">${days.map((r,i)=>{ const d=i+1, done=pl.done?d<=cur:d<cur; return `<div class="cday${done?' done':''}${d===cur?' now':''}${r.jackpot?' jack':''}"><small>${d}</small><i>${Reward.icon(r)}</i><span>${esc(Reward.text(r))}</span></div>`; }).join('')}</div>`;
    b.querySelector('[data-x]').onclick=()=>m.hidden=true; }
};

// ---------- hooks ----------
function wrap(o,n,f){ if(!o||!o[n]||o[n]._e) return; const g=o[n]; o[n]=function(...a){ return f.call(this,g,a); }; o[n]._e=true; }
function hook(){
  const B=BF.BattleUI; if(!B||B._eng) return; B._eng=true;
  wrap(B,'startMatch',function(g,a){ this._before=Object.assign({},prof()||{}); return g.apply(this,a); });
  wrap(B,'matchEnd',function(g,a){ const win=this.score[0]>this.score[1]?0:1, me=this.raid?0:this.me, won=win===me, m=this.match||{}; const r=g.apply(this,a);
    if(m.tut){ setTimeout(()=>Onboard.done(won),1800); return r; }
    if(this.mode!=='local'){ const panel=document.querySelector('.bpanel.result'); if(panel){ let box=panel.querySelector('.cascade'); if(!box){ box=document.createElement('div'); box.className='cascade'; const rw=panel.querySelector('.rewards'); rw?rw.before(box):panel.appendChild(box); }
      Cascade.run(box,{won,before:this._before||{}}).catch(e=>console.warn('cascade',e)); } }
    return r; });
}
// missions: finishing all 3 gives hourglasses
if(BF.Missions){ const cl=BF.Missions.claim.bind(BF.Missions); BF.Missions.claim=async function(id){ const n=await cl(id); const s=this.state(); if(n&&s.list.every(m=>m.claimed)){ const h=(Econ.get('missions')||{}).hourglassOnAll||0; if(h){ await A().update({hourglasses:FV().increment(h)}).catch(()=>{}); BF.App.toast(`All missions done! +${h} ⏳ hourglass`,'good'); } } return n; }; }
BF.Account&&BF.Account.on(()=>{ Econ.listen(); hook(); if(prof()) FreePack.schedule(); });
addEventListener('load',()=>setTimeout(()=>{ if(!document.getElementById('tabs')) return; hook(); if(Onboard.need()) setTimeout(()=>{ if(Onboard.need()&&!document.getElementById('onboard')) Onboard.start(); },2200); },600));
})();
