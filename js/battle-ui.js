/* BeyForge — battle mode: setup, launch, rounds, scoring, online sync */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FINISH={spin:'SPIN FINISH',over:'OVER FINISH',burst:'BURST FINISH',xtreme:'XTREME FINISH'};

BF.Records = {
  get(){ return BF.LS.get('bf.records',{wins:0,losses:0,matches:0,finishes:{spin:0,over:0,burst:0,xtreme:0},byBey:{},online:{wins:0,losses:0}}); },
  add(won, how, beyName, online){
    const r=this.get(); r.matches++; won?r.wins++:r.losses++;
    if(won) r.finishes[how]=(r.finishes[how]||0)+1;
    const b=r.byBey[beyName]=r.byBey[beyName]||{w:0,l:0}; won?b.w++:b.l++;
    if(online){ won?r.online.wins++:r.online.losses++; }
    BF.LS.set('bf.records',r);
    if(BF.Store.status==='connected') BF.Store.write('data/records.json',JSON.stringify(r,null,1)).catch(()=>{});
    return r;
  }
};

const B = BF.BattleUI = {
  st:'setup', mode:'cpu', stadiumKind:'X', size:380, picks:{p1:'forge',p2:'preset:reaper'}, lib:[],
  init(){
    this.arena=new BF.Arena($('#arena'));
    this.panel=$('#bpanel'); this.loop();
    BF.Net.on('status',s=>this.onNet(s));
    BF.Net.on('hello',m=>{ this.remote={design:m.design,name:m.name}; this.renderSetup(); if(BF.Net.role==='guest') BF.Net.send({t:'hello',design:this.myDesign(),name:this.myName()}); });
    BF.Net.on('start',m=>this.startMatch(m));
    BF.Net.on('launch',m=>{ this.launches[1]=m.l; this.tryGo(); });
    BF.Net.on('go',m=>this.countdown(m.launches,m.seed));
    BF.Net.on('s',m=>{ this.netSnap=m.s; (m.ev||[]).forEach(e=>this.fx(e)); });
    BF.Net.on('round',m=>this.roundEnd(m.res,m.score,true));
    BF.Net.on('rematch',()=>{ if(BF.Net.role==='host') this.hostStart(); });
    // guest's in-fight inputs: the host's sim applies them to Bey #2
    BF.Net.on('in',m=>{ if(!this.sim||BF.Net.role!=='host') return; if(m.k==='move') this.sim.useMove(1,m.s|0); if(m.k==='lean') this.sim.lean(1,+m.x||0,+m.y||0); });
    this.bindControls();
  },
  show(){ this.arena.resize(); if(this.st==='setup') this.renderSetup(); },
  // ---------- picking fighters ----------
  async options(){
    this.lib=await BF.Store.loadLibrary().catch(()=>[]);
    const o=(BF.Parts?BF.Parts.decks:[]).filter(k=>BF.Parts.deckDesign(k)).map(k=>['deck:'+k.id,'⚔ Battle Bey — '+k.name]);
    if(this.mode==='online') return o;
    o.push(['forge','Practice — your Forge Bey ('+BF.naming(BF.App.d,BF.App.an&&BF.App.an.type).full+')']);
    this.lib.forEach(r=>o.push(['lib:'+r.id,'Library — '+r.meta.full]));
    BF.PRESETS.forEach(p=>o.push(['preset:'+p.id,'Preset — '+p.name+' ('+(p.sys==='X'?'X':'Burst')+')']));
    o.push(['random','Random Bey']);
    return o;
  },
  designFor(key){
    if(key&&key.startsWith('deck:')){ const k=BF.Parts.decks.find(x=>'deck:'+x.id===key); const d=k&&BF.Parts.deckDesign(k); if(d) return d; }
    if(key==='forge') return BF.clone(BF.App.d);
    if(key.startsWith('lib:')){ const r=this.lib.find(x=>'lib:'+x.id===key); if(r) return BF.normalize(BF.clone(r.design)); }
    if(key.startsWith('preset:')) return BF.fromPreset(BF.PRESETS.find(p=>'preset:'+p.id===key));
    return BF.randomDesign();
  },
  myDesign(){ return this.designFor(this.picks.p1); },
  myName(){ const d=this.myDesign(); return BF.naming(d).full; },
  // ---------- setup screen ----------
  async renderSetup(){
    { const ph=$('#pracHud'); if(ph) ph.hidden=true; this._aim=null; if(this.arena) this.arena.liftY=0; }
    this.st='setup'; document.body.classList.remove('infight'); this.hud(false); $('#banner').hidden=true; this.match=null;
    if(this.mode==='adventure'){ this.panel.className='bpanel setup adv'; BF.Adventure.panel(this.panel,this); this.previewArena(); return; }
    const opts=await this.options();
    if(!opts.find(o=>o[0]===this.picks.p1) && opts.length) this.picks.p1=opts[0][0];
    const sel=(id,v)=>`<select id="${id}">${opts.map(([k,l])=>`<option value="${k}"${k===v?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
    const net=BF.Net, online=this.mode==='online';
    let onlineHtml='';
    if(online){
      if(net.status==='off'||net.status==='closed'||net.status==='error') onlineHtml=`
        <div class="netbox">${net.status==='error'?`<div class="neterr">${esc(this.netErr||'')}</div>`:''}
          <button class="btn primary" id="hostBtn">Host a match</button>
          <div class="joinrow"><input id="joinCode" class="txt code" maxlength="4" placeholder="CODE" autocomplete="off"><button class="btn" id="joinBtn">Join</button></div>
          <div class="fine">Host gets a 4-letter code. Your friend types it in on their phone or PC.</div></div>`;
      else if(net.status==='connecting') onlineHtml=`<div class="netbox"><div class="netwait">Connecting…</div><button class="btn ghost" id="netCancel">Cancel</button></div>`;
      else if(net.status==='waiting') onlineHtml=`<div class="netbox"><div class="dim">Tell your friend this code</div><div class="bigcode">${esc(net.code)}</div><div class="netwait">Waiting for them to join…</div><button class="btn ghost" id="netCancel">Cancel</button></div>`;
      else if(net.status==='connected') onlineHtml=`<div class="netbox"><div class="netok">Connected${net.code?' · room '+esc(net.code):''}</div>
          ${net.role==='host'?`<div class="seg sm" id="queueSeg"><button type="button" class="${this.queue!=='ranked'?'on':''}" data-q="casual">Casual</button><button type="button" class="${this.queue==='ranked'?'on':''}" data-q="ranked">Ranked</button><button type="button" class="${this.queue==='raid'?'on':''}" data-q="raid">Co-op raid</button></div>`:''}
          ${this.queue==='raid'&&net.role==='host'?`<div class="rankedbox"><b>CO-OP RAID</b> <span>You two vs ${esc(BF.Adventure.weekly().name)} — a giant boss Bey.</span></div>`:''}
          ${this.queue==='ranked'||net.role!=='host'?this.rankedLine():''}
          <div class="vs-line"><b class="c1">${esc(this.myName())}</b><span>vs</span><b class="c2">${esc(this.remote?this.remote.name:'waiting for their Bey…')}</b></div>
          ${net.role==='host'?`<button class="btn primary wide" id="startBtn"${this.remote?'':' disabled'}>Start match</button>`:`<div class="netwait">Waiting for the host to start…</div>`}
          <button class="btn ghost" id="netCancel">Leave</button></div>`;
    }
    const hostCtl=!online||net.role==='host'||net.status!=='connected';
    this.panel.className='bpanel setup';
    this.panel.innerHTML=`
      <h2>Battle</h2>
      <div class="seg" id="modeSeg">${[['cpu','vs CPU'],['practice','Practice'],['adventure','Adventure'],['local','2 players'],['online','Online']].map(([k,l])=>`<button type="button" class="${this.mode===k?'on':''}" data-mode="${k}">${l}</button>`).join('')}</div>
      ${online&&!opts.length?`<div class="netbox"><b>Online needs a Battle Bey</b><span class="dim">Battle Beys are built from parts you own. Grab your free starter in the Parts tab.</span><button class="btn primary" id="toParts">Open Parts</button></div>`:`<label class="fl">${online?'Your Bey':'Player 1'}${sel('pick1',this.picks.p1)}</label>`}
      ${!online&&!String(this.picks.p1).startsWith('deck:')?'<div class="fine">Practice Beys don’t earn part XP or drops — use a ⚔ Battle Bey for that.</div>':''}
      ${online||this.mode==='practice'?'':`<label class="fl">${this.mode==='cpu'?'CPU opponent':'Player 2'}${sel('pick2',this.picks.p2)}</label>`}
      ${this.mode==='cpu'?`<div class="fl">CPU difficulty<div class="seg" id="cpuSeg">${Object.entries(BF.CPU_LEVELS).map(([k,l])=>`<button type="button" class="${(this.cpuLv())===k?'on':''}" data-cpu="${k}">${l}</button>`).join('')}</div></div>`:''}
      ${hostCtl?`<div class="fl">Stadium<div class="seg" id="stSeg">${[['X','Xtreme'],['Burst','Burst'],['BurstAttack','Burst Attack'],['BurstTornado','Burst Tornado']].map(([k,l])=>`<button type="button" class="${this.stadiumKind===k?'on':''}" data-st="${k}">${l}</button>`).join('')}</div></div>
      <label class="fl">Stadium size <output id="sizeOut" class="val">${this.size} mm</output><input type="range" id="sizeIn" min="280" max="480" step="10" value="${this.size}"></label>
      <div class="fine">${this.rulesLine()} · ${BF.ROUND_LENGTH[BF.Settings.get('roundLength')].label.toLowerCase()} rounds — change in Settings</div>`:''}
      ${onlineHtml}
      ${online?'':`<button class="btn primary wide big" id="fightBtn">Let it rip</button>`}
      ${this.recordLine()}`;
    this.panel.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ this.mode=b.dataset.mode; if(this.mode!=='online') BF.Net.close(); this.renderSetup(); });
    this.panel.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ this.stadiumKind=b.dataset.st; this.size=(BF.STADIUMS[b.dataset.st]||{}).diameter||360; this.renderSetup(); });
    const si=$('#sizeIn'); if(si) si.oninput=()=>{ this.size=+si.value; $('#sizeOut').textContent=this.size+' mm'; };
    const p1=$('#pick1'); if(p1) p1.onchange=()=>{ this.picks.p1=p1.value; if(online && net.status==='connected') BF.Net.send({t:'hello',design:this.myDesign(),name:this.myName()}); this.renderSetup(); };
    this.panel.querySelectorAll('[data-cpu]').forEach(b=>b.onclick=()=>{ BF.Settings.set('cpuLevel',b.dataset.cpu); this.panel.querySelectorAll('[data-cpu]').forEach(x=>x.classList.toggle('on',x===b)); });
    const p2=$('#pick2'); if(p2) p2.onchange=()=>{ this.picks.p2=p2.value; };
    const tp=$('#toParts'); if(tp) tp.onclick=()=>document.querySelector('#tabs [data-tab=parts]').click();
    const fb=$('#fightBtn'); if(fb) fb.onclick=()=>this.localStart();
    const hb=$('#hostBtn'); if(hb) hb.onclick=()=>{ if(!BF.Net.available()) return BF.App.toast('Online play needs an internet connection','bad'); BF.Net.host(); };
    const jb=$('#joinBtn'); if(jb) jb.onclick=()=>{ const c=$('#joinCode').value; if(c.length!==4) return BF.App.toast('Codes are 4 letters','bad'); BF.Net.join(c); };
    const jc=$('#joinCode'); if(jc) jc.oninput=()=>{ jc.value=jc.value.toUpperCase().replace(/[^A-Z]/g,''); };
    const nc=$('#netCancel'); if(nc) nc.onclick=()=>{ BF.Net.close(); this.remote=null; this.renderSetup(); };
    const sb=$('#startBtn'); if(sb) sb.onclick=()=>this.hostStart();
    this.panel.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{ if(b.dataset.q==='ranked'&&!(BF.Account.profile)) return BF.App.toast('Sign in (Blader tab) to play ranked','bad'); this.queue=b.dataset.q; this.renderSetup(); });
    this.previewArena();
  },
  rankedLine(){ if(!BF.Ranked) return ''; const issues=BF.Ranked.check(this.myDesign());
    return `<div class="rankedbox"><b>RANKED</b> <span>${esc(BF.Ranked.summary())}</span>${issues.length?`<ul class="issues">${issues.map(i=>`<li class="iss warn">${esc(i)}</li>`).join('')}</ul>`:'<span class="netok">✓ Your Bey is ranked-legal</span>'}</div>`; },
  rulesLine(){ const r=BF.Settings.rulesFor(this.stadiumKind), p=r.pts; const allOne=Object.values(p).every(v=>v===1);
    return `First to ${r.target} ${allOne?'round wins':'points'}${allOne?'':` · Spin ${p.spin} · Over ${p.over} · Burst ${p.burst}${this.stadiumKind==='X'?` · Xtreme ${p.xtreme}`:''}`}`; },
  recordLine(){ const r=BF.Records.get(); if(!r.matches) return ''; return `<div class="record">Record <b>${r.wins}–${r.losses}</b>${r.online.wins+r.online.losses?` · online ${r.online.wins}–${r.online.losses}`:''}</div>`; },
  previewArena(){
    const st=this.stadium(); const f1=BF.fighter(this.myDesign());
    this.arena.setup(st,f1,f1); this.arena.beys[1].root.visible=false;
    this.preview={x:0,y:0,ang:0}; this.netSnap=null; this.sim=null;
  },
  stadium(){ return Object.assign({},BF.STADIUMS[this.stadiumKind],{diameter:this.size}); },
  onNet({s,info}){
    if(this._inviteHook) this._inviteHook({s,info});
    if(s==='error'){ this.netErr=info; }
    if(s==='connected'){ BF.Net.send({t:'hello',design:this.myDesign(),name:this.myName()}); }
    if(s==='closed' && this.st!=='setup'){ BF.App.toast('Your opponent disconnected','bad'); this.st='setup'; }
    if(this.mode==='online' && (this.st==='setup')) this.renderSetup();
  },
  // ---------- match flow ----------
  cpuLv(){ return (this.match&&this.match.cpuLevel)||BF.Settings.get('cpuLevel')||'normal'; },
  localStart(){
    if(this.mode==='practice'){ const d=this.designFor(this.picks.p1); return this.practiceStart(d,null,Object.assign({},BF.STADIUMS[d.system]||BF.STADIUMS.X,this.stadium())); }
    const d1=this.designFor(this.picks.p1), d2=this.designFor(this.picks.p2);
    const st=this.stadium(); this.startMatch({stadium:st, rules:BF.Settings.rulesFor(st.kind), moves:BF.Settings.get('moves')!==false, prog:true, d1, d2, n1:null, n2:null, seed:(Math.random()*1e9)|0});
  },
  hostStart(){
    if(this.queue==='raid'){ const wb=BF.Adventure.weekly(); const st=Object.assign({},BF.STADIUMS[wb.design.system==='X'?'X':'Burst'],{terrain:wb.terrain});
      const m={t:'start', raid:true, stadium:st, rules:{target:1,pts:{spin:1,over:1,burst:1,xtreme:1}}, moves:true, prog:true, decayK:BF.Settings.decayK(), d1:this.myDesign(), d2:this.remote.design, n1:this.myName(), n2:this.remote.name, d3:wb.design, n3:wb.name, bossScale:1.45, adventure:{kind:'raid',id:wb.week}, seed:(Math.random()*1e9)|0};
      BF.Net.send(m); this.startMatch(m); return; }
    const ranked=this.queue==='ranked';
    if(ranked){ const a=BF.Ranked.check(this.myDesign()), b=BF.Ranked.check(this.remote.design);
      if(a.length||b.length){ BF.App.toast((a.length?'Your Bey: '+a[0]:this.remote.name+': '+b[0])+' — not ranked-legal','bad'); return; } }
    const st=ranked?BF.Ranked.stadium():this.stadium(); const m={t:'start', ranked, stadium:st, rules:ranked?BF.Ranked.matchRules():BF.Settings.rulesFor(st.kind), moves:ranked?BF.Ranked.rules.moves!==false:BF.Settings.get('moves')!==false, prog:ranked?!!BF.Ranked.rules.progression:true, decayK:ranked?BF.Ranked.decayK():BF.Settings.decayK(), d1:this.myDesign(), d2:this.remote.design, n1:this.myName(), n2:this.remote.name, seed:(Math.random()*1e9)|0};
    BF.Net.send(m); this.startMatch(m);
  },
  startMatch(m){
    this.match=m; this.st='launch'; this.score=[0,0]; this.round=1; this.seed=m.seed; this.lastMoves=[[],[],[]]; this.movesOn=m.moves!==false; this.raid=!!m.raid;
    if(m.prog===false){ [m.d1,m.d2,m.d3].forEach(d=>{ if(d&&d.prog) d.prog={copyIds:d.prog.copyIds,tiers:d.prog.tiers,shiny:d.prog.shiny}; }); }
    this.progOn=m.prog!==false;
    this.F=[m.tut?BF.bossFighter(m.d1,m.n1,(BF.Econ&&BF.Econ.get('onboarding').starterBoost)||1.15):BF.fighter(m.d1,m.n1), m.boss2?BF.bossFighter(m.d2,m.n2,m.bossScale||1.2):BF.fighter(m.d2,m.n2)];
    if(this.raid) this.F.push(BF.bossFighter(m.d3,m.n3,m.bossScale||1.45));
    this.me = this.mode==='online' && BF.Net.role==='guest' ? 1 : 0;
    this.arena.meIdx=this.me; this.hitStop=0; this.slowT=0; this.arena.setup(m.stadium,...this.F); this.arena.intro();
    $('#bossHud').hidden=!this.raid; if(this.raid){ $('#bossName').textContent=this.F[2].name; }
    this.rules=m.rules||BF.Settings.rulesFor(m.stadium.kind);
    this.mst=this.F.map(()=>({moves:0,statuses:0,clicks:0,rounds:0,fin:{}})); this.mstAll={hits:0,best:0,longest:0,rounds:0};
    this.hud(true); setTimeout(()=>this.pracHud(),0);
    if(!document.documentElement.classList.contains('reduce-motion')) this.vsSplash(()=>this.nextRound()); else this.nextRound();
  },
  portrait(f){ const key=f.name+(f.d.paint&&f.d.paint.blade.color); this._pc=this._pc||{}; if(this._pc[key]) return this._pc[key];
    const c=document.createElement('canvas'); c.width=c.height=160; const x=c.getContext('2d'), m=BF.mainPart(f.asm).meta, k=66/m.R, P=f.d.paint||{};
    const col=(P.blade&&P.blade.color)||'#e9edf5', acc=(P.accent&&P.accent.color)||'#2ef2ff';
    const g=x.createRadialGradient(80,80,6,80,80,90); g.addColorStop(0,'#2a2460'); g.addColorStop(1,'#07060e'); x.fillStyle=g; x.fillRect(0,0,160,160);
    x.save(); x.translate(80,80); x.rotate(-0.4); x.beginPath(); m.outline.forEach((q,i)=>{ const X=q[0]*k, Y=-q[1]*k; i?x.lineTo(X,Y):x.moveTo(X,Y); }); x.closePath();
    const bg=x.createLinearGradient(-60,-60,60,60); bg.addColorStop(0,'#fff'); bg.addColorStop(0.35,col); bg.addColorStop(1,'#111'); x.fillStyle=bg; x.shadowColor=acc; x.shadowBlur=18; x.fill(); x.shadowBlur=0;
    x.lineWidth=3; x.strokeStyle='#000'; x.stroke(); x.beginPath(); x.arc(0,0,14,0,Math.PI*2); x.fillStyle='#07060e'; x.fill(); x.strokeStyle=acc; x.lineWidth=3; x.stroke(); x.restore();
    return this._pc[key]=c.toDataURL(); },
  vsSplash(done){
    const el=$('#vsSplash'), side=(f,i)=>`<div class="vs-side s${i+1}"><img src="${this.portrait(f)}" alt=""><b>${esc(f.name)}</b><span>${(f.els||[]).map(e=>BF.ELEMENTS[e].icon+' '+BF.ELEMENTS[e].label).join(' / ')} · ${esc(f.an.type)}</span></div>`;
    const left=this.raid?`<div class="vs-team">${side(this.F[0],0)}${side(this.F[1],0)}</div>`:side(this.F[0],0), right=this.raid?side(this.F[2],1):side(this.F[1],1);
    const st=this.match.stadium, ter=st.terrain&&st.terrain!=='none'?BF.TERRAINS[st.terrain].label:(st.kind==='X'?'Xtreme Stadium':'Burst Stadium');
    el.innerHTML=`<div class="vs-bg"></div>${left}<div class="vs-mid"><i>VS</i><small>${esc(ter)}${this.match.ranked?' · RANKED':this.raid?' · RAID':''}</small></div>${right}`;
    el.hidden=false; el.classList.remove('out'); BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui('open'); setTimeout(()=>BF.Sfx&&BF.Sfx.clash&&BF.Sfx.clash(1800),650);
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>{ el.hidden=true; this.arena.intro(); done(); },450); },2200);
  },
  nextRound(){
    this.st='launch'; this.launches=[null,null].concat(this.raid?[null]:[]); this.sim=null; this.netSnap=null; this.arena.clearDebris();
    $('#banner').hidden=true; this.updateHud(null);
    this.idlePose();
    if(this.mode==='online') this.launchPanel(this.me);
    else this.launchPanel(0);
  },
  idlePose(){ const R=this.match.stadium.diameter/2; this.netSnap={b:[[0,-R*0.55,0,0,0,1,0,1,0,0],[0,R*0.55,0,0,0,1,0,1,0,0]].concat(this.raid?[[R*0.3,0,0,0,0,1,0,1,0,0]]:[]).map((s,i)=>{ s[2]=this.match.stadium.depth*(R*0.55)**2/R; return s; })}; },
  // ---------- launch: the stadium stays in view, tap it to aim, shot on the side, ripcord along the bottom ----------
  launchPanel(who){
    const f=this.F[who], col=who===0?'c1':'c2', dual=f.d.spin==='dual', foe=this.F[who===0?1:0]||this.F[0], st=this.match.stadium, R=st.diameter/2, ar=this.arena;
    const label=this.mode==='local'?`Player ${who+1}`:'Your launch';
    const perks=(this.progOn&&(this.mode!=='local'||who===0)&&BF.Parts)?BF.Parts.blader().filter(k=>['steady','grit','quick','focus'].includes(k)):[];
    const perfectAt=perks.includes('steady')?0.84:0.92;
    this.idlePose(); ar.camFx=null; ar.liftY=ar.camera.aspect<1?R*0.62:0;   // on phones, slide the stadium up above the controls. Also hides the other player's aim on shared screens
    if(this.match.practice&&this.practice.kind==='still'&&this.netSnap.b[1]){ const s=this.netSnap.b[1]; s[0]=0; s[1]=0; s[2]=0; }
    this.panel.className='bpanel launch la';
    this.panel.innerHTML=`
      <div class="la-side">
        <div class="lp-head"><span class="${col}">${esc(label)} · Round ${this.round}</span><b>${esc(f.name)}</b></div>
        ${dual?`<div class="fl">Spin<div class="seg" id="spinSeg"><button type="button" class="on" data-sp="right">Right</button><button type="button" data-sp="left">Left</button></div></div>`:''}
        ${(f.g&&f.g.bmode)?`<div class="fl">Blade mode<div class="seg" id="bmodeSeg"><button type="button" class="on" data-bm="attack">Attack</button><button type="button" data-bm="defense">Defense</button></div></div>`:''}
        ${(BF.TIPS[f.d.bit.tip]||{}).modes?`<div class="fl">Tip mode<div class="seg" id="modeSegL"><button type="button" class="${f.d.bit.mode!=='stamina'?'on':''}" data-md="attack">Attack</button><button type="button" class="${f.d.bit.mode==='stamina'?'on':''}" data-md="stamina">Stamina</button></div></div>`:''}
        <div class="fl">Shot<div class="la-shots" id="shotSeg">${Object.entries(BF.SHOTS).map(([k,v],j)=>`<button type="button" class="${j===0?'on':''}" data-shot="${k}" title="${esc(v.desc)}">${esc(v.label.split(' ')[0])}</button>`).join('')}</div></div>
        <div class="la-fx" id="shotFx"></div>
        <label class="fl">Tilt <output class="val" id="angOut">0°</output><input type="range" id="angIn" min="-30" max="30" step="1" value="0"></label>
        ${this.movesOn?`<button type="button" class="la-movesbtn" id="movesBtn" aria-expanded="false"><b>Moves</b><span id="movesSum"></span></button>`:''}
      </div>
      ${this.movesOn?`<div class="la-moves" id="movesBox" hidden>${this.movePicker(who)}<button type="button" class="btn primary wide" id="movesDone">Done</button></div>`:''}
      <div class="la-hint" id="laHint">Tap your half of the stadium to choose where you land</div>
      <div class="la-rip">
        <div class="la-riptxt"><b>Pull the ripcord</b><span>Fast and straight is strongest</span></div>
        <div class="la-track" id="ripTrack"><i id="ripCord"></i><button type="button" class="la-handle" id="ripHandle" aria-label="Pull the ripcord. On a keyboard, hold Space or Enter."></button><span>Drag and yank this way</span><em id="ripMsg"></em></div>
      </div>`;
    let shot='flat', pos={a:0,r:0.55}, mode=f.d.bit.mode||'attack', bmode='attack', spin='right', tmr=0; const picks=this.movesOn?this.defaultPicks(who):[], Q=s=>this.panel.querySelector(s);
    const ai=Q('#angIn'), pathOn=()=>!(this.match.practice&&this._noPath);
    const place=()=>{ const base=who===0?-Math.PI/2:Math.PI/2, a0=base+pos.a*0.9, r=R*pos.r, x=r*Math.cos(a0), y=r*Math.sin(a0), z=st.depth*r*r/R; if(this.netSnap&&this.netSnap.b[who]){ const s=this.netSnap.b[who]; s[0]=x; s[1]=y; s[2]=z; } return {x,y,z}; };
    const preview=()=>{ clearTimeout(tmr); tmr=setTimeout(()=>{ if(this.st!=='launch') return; try{ ar.setPreview(pathOn()?BF.predictLaunch(f,foe,st,{angle:+ai.value,spin,mode,bmode,shot,pos},who):null,who===0?0xffe600:0xff5aa5); }catch(e){ console.warn('preview',e); } },40); };
    const showFx=()=>{ const v=BF.SHOTS[shot]; Q('#shotFx').innerHTML=`<div><span>Speed</span><b>${v.speed}</b></div><div><span>Spin</span><b>${v.spin}</b></div><p>${esc(v.extra)}</p>`; };
    const moveSum=()=>{ const m=Q('#movesSum'); if(m) m.textContent=picks.map(id=>{ const x=BF.moveById(f.d,id); return x?x.name:''; }).filter(Boolean).join(' · '); };
    const at=place(); setTimeout(()=>{ if(this.st==='launch') ar.launchView(who,at); },60); showFx(); moveSum(); preview();
    this.panel.querySelectorAll('[data-shot]').forEach(b=>b.onclick=()=>{ shot=b.dataset.shot; this.panel.querySelectorAll('[data-shot]').forEach(x=>x.classList.toggle('on',x===b)); showFx(); preview(); });
    this.panel.querySelectorAll('[data-mv]').forEach(b=>b.onclick=()=>{ if(b.disabled) return; const part=+b.dataset.part; picks[part]=b.dataset.mv; this.panel.querySelectorAll(`[data-part="${part}"]`).forEach(x=>x.classList.toggle('on',x===b)); moveSum(); });
    this.panel.querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>{ mode=b.dataset.md; this.panel.querySelectorAll('[data-md]').forEach(x=>x.classList.toggle('on',x===b)); preview(); });
    this.panel.querySelectorAll('[data-bm]').forEach(b=>b.onclick=()=>{ bmode=b.dataset.bm; this.panel.querySelectorAll('[data-bm]').forEach(x=>x.classList.toggle('on',x===b)); });
    this.panel.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{ spin=b.dataset.sp; this.panel.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x===b)); preview(); });
    ai.oninput=()=>{ Q('#angOut').textContent=(ai.value>0?'+':'')+ai.value+'°'; preview(); };
    const mb=Q('#movesBtn'), mx=Q('#movesBox'); if(mb){ const tg=on=>{ mx.hidden=!on; mb.setAttribute('aria-expanded',on); }; mb.onclick=()=>tg(mx.hidden); Q('#movesDone').onclick=()=>tg(false); }
    // aim: tap or drag on your half of the stadium
    this._aim=w=>{ const base=who===0?-Math.PI/2:Math.PI/2; let off=Math.atan2(w.y,w.x)-base; off=Math.atan2(Math.sin(off),Math.cos(off)); if(Math.abs(off)>Math.PI/2) off=Math.sign(off)*Math.PI/2; pos={a:Math.max(-1,Math.min(1,off/0.9)),r:Math.max(0.25,Math.min(0.8,Math.hypot(w.x,w.y)/R))}; const p=place(); const v=ar.beys[who]; if(v) v.root.position.set(p.x,p.y,p.z); const h=Q('#laHint'); if(h) h.classList.add('done'); preview(); };
    // ripcord: speed of the pull sets power, staying straight sets accuracy
    const track=Q('#ripTrack'), handle=Q('#ripHandle'), cord=Q('#ripCord'), msg=Q('#ripMsg'), L=()=>ar.beys[who]&&ar.beys[who].launcher; const RK=BF.feel('ripEase'); let t0=0, x0=0, y0=0, len=1, dev=0, n=0, pull=0, fired=false;
    const setPull=p=>{ pull=Math.max(0,Math.min(1,p)); const w=handle.offsetWidth, room=Math.max(1,track.clientWidth-w-8); handle.style.transform=`translateX(${pull*room}px)`; cord.style.width=(pull*room+w/2)+'px'; if(L()) L().userData.pull=pull; };
    const finish=(dur,straight)=>{ if(fired) return; fired=true; this._aim=null; clearTimeout(tmr); BF.Sfx&&BF.Sfx.rev(false);
      const power=Math.max(0.5,Math.min(1,1-(dur-0.38*RK)/(1.1*RK)*0.5)), perfect=power>=perfectAt&&straight>=0.6, misfire=!perfect&&(straight<0.18||dur>1.9*RK), P=perfect?1:power;
      track.classList.add('snap',perfect?'perfect':misfire?'misfire':'ok'); msg.textContent=perfect?'PERFECT LAUNCH!':misfire?'MISFIRE!':`Launch power ${Math.round(P*100)}%`; if(L()) L().userData.pull=1.6; setPull(1);
      BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui(perfect?'epic':'click'); ar.clearPreview();
      setTimeout(()=>this.lockLaunch(who,{power:P,angle:+ai.value,spin,mode,bmode,shot,pos,moves:picks.slice(),perks,misfire:misfire?1:0}),perfect?520:380); };
    const move=e=>{ if(!t0) return; const dx=e.clientX-x0, dy=e.clientY-y0; dev+=dy*dy; n++; setPull(dx/len); if(pull>=0.985) up(e,true); };
    const up=(e,full)=>{ if(!t0) return; window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); window.removeEventListener('pointercancel',up); const dur=(performance.now()-t0)/1000, p=full===true?1:pull; t0=0;
      if(p<0.35){ setPull(0); BF.Sfx&&BF.Sfx.rev(false); return; }   // a short tug doesn't count
      const rms=Math.sqrt(dev/Math.max(1,n)), straight=1-Math.min(1,rms/(Math.max(70,len*0.2)*RK)); finish(dur+(1-p)*0.9,straight); };
    handle.addEventListener('pointerdown',e=>{ if(fired) return; e.preventDefault(); t0=performance.now(); x0=e.clientX; y0=e.clientY; dev=0; n=0; len=Math.max(80,track.clientWidth-handle.offsetWidth-8); BF.Sfx&&BF.Sfx.rev(true); window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); window.addEventListener('pointercancel',up); });
    let kt=0, kr=0; const kstep=()=>{ if(!kt) return; setPull((performance.now()-kt)/500); kr=requestAnimationFrame(kstep); };
    handle.addEventListener('keydown',e=>{ if((e.key===' '||e.key==='Enter')&&!kt&&!fired){ e.preventDefault(); kt=performance.now(); BF.Sfx&&BF.Sfx.rev(true); kstep(); } });
    handle.addEventListener('keyup',e=>{ if((e.key===' '||e.key==='Enter')&&kt){ e.preventDefault(); cancelAnimationFrame(kr); const hold=(performance.now()-kt)/1000; kt=0; if(hold<0.2){ setPull(0); BF.Sfx&&BF.Sfx.rev(false); return; } finish(Math.max(0.38,hold),1); } });
  },
  lockLaunch(who,l){
    if(this.mode==='online'){
      if(BF.Net.role==='host'){ this.launches[0]=l; this.tryGo(); }
      else BF.Net.send({t:'launch',l});
      setTimeout(()=>{ if(this.st==='launch'){ this.panel.className='bpanel'; this.panel.innerHTML=`<div class="netwait">Waiting for ${esc(this.F[1-this.me].name)} to launch…</div>`; } },600);
      return;
    }
    this.launches[who]=l;
    if(this.mode==='local' && who===0){ setTimeout(()=>this.launchPanel(1),650); return; }
    if(this.mode==='cpu'||(this.match&&this.match.practice)){ this.launches[1]=BF.MoveAI.launch(this.F[1],this.F[0],this.cpuLv(),this.lastMoves[1]); if(this.match&&this.match.tut){ this.launches[1].power=Math.min(this.launches[1].power||1,0.55); this.launches[1].moves=[]; } }
    if(this.raid) this.launches[2]=BF.MoveAI.launch(this.F[2],this.F[0],'expert',this.lastMoves[2]);
    setTimeout(()=>this.countdown(this.launches,(Math.random()*1e9)|0),500);
  },
  tryGo(){ if(BF.Net.role!=='host'||!this.launches[0]||!this.launches[1]) return; if(this.raid) this.launches[2]=BF.MoveAI.launch(this.F[2],this.F[0],'expert',this.lastMoves[2]); const seed=(Math.random()*1e9)|0; BF.Net.send({t:'go',launches:this.launches,seed}); this.countdown(this.launches,seed); },
  countdown(launches,seed){
    this.st='countdown'; this.launches=launches; this.panel.className='bpanel hidden'; this.panel.innerHTML='';
    const ban=$('#banner'); ban.hidden=false; const seq=['3','2','1','GO SHOOT!']; let i=0;
    const step=()=>{ ban.className='banner count'+(i===3?' go':''); ban.textContent=seq[i]; ban.style.animation='none'; void ban.offsetWidth; ban.style.animation=''; BF.Sfx && BF.Sfx.beep(i===3); i++;
      if(i<4) setTimeout(step,560); else setTimeout(()=>{ ban.hidden=true; this.fight(seed); },520); };
    step();
  },
  fight(seed){
    this.st='fight'; document.body.classList.add('infight');
    const isGuest=this.mode==='online'&&BF.Net.role==='guest';
    this.arena.live=true; this.F.forEach((_,i)=>this.arena.launchFx(i)); this.arena.releaseLaunchers();
    this.showMoveBar(); this._usedSeen=null;
    if(isGuest){ this.sim=null; return; }
    this.sim=new BF.Sim(this.F[0],this.F[1],this.match.stadium,seed,this.raid?{extra:this.F[2],teams:[0,0,1]}:this.match.practice?{practice:{still:this.practice.kind==='still',infinite:this.practice.infinite}}:undefined);
    this.sim.movesOn=this.sim.elemOn=this.movesOn; this.aiMem=[{},{},{}]; this.aiAcc=0; this.hitStop=0;
    if(this.match.decayK) this.sim.decayK=this.match.decayK;
    this.sim.launch(...this.launches); this.acc=0; this.sendT=0; this.evQ=[];
    BF.Sfx && BF.Sfx.rip();
  },
  fx(e){
    const ar=this.arena;
    if(this.mst){ const M=this.mst, n=this.F.length, foe=i=>this.raid?(i===2?0:2):1-i;
      if(e.k==='hit'){ this.mstAll.hits++; this.mstAll.best=Math.max(this.mstAll.best,e.s); }
      if(e.k==='move'&&M[e.i]){ M[e.i].moves++; if(BF.Stats&&this.mode!=='local'&&!this.match.practice&&e.i===(this.raid?0:this.me)) BF.Stats.add('moves.'+(e.name||e.id).replace(/ (II|III)$/,'')); }
      if(e.k==='click'&&M[foe(e.i)]) M[foe(e.i)].clicks++;
      if(e.k==='status'&&e.s!=='armor'&&M[foe(e.i)]) M[foe(e.i)].statuses++; }
    if(e.k==='hit'){ this.hitFx(e); if(this.match&&this.match.practice) this.practiceHit(e); }
    if(e.k==='dash'&&this.match&&this.match.practice&&e.i===0){ this.practice.rails++; const r=$('#prR'); if(r) r.textContent=this.practice.rails; }
    if(e.k==='over'||e.k==='xtreme'){ const v=ar.beys[e.i], p=v&&v.root.position; if(p){ ar.impact(e.x==null?p.x:e.x,e.y==null?p.y:e.y,p.z,3,e.k==='xtreme'?0xffe600:0xff8a3a); ar.punch(p.x,p.y,p.z,0.34,0.8); } ar.koFx(e.i,e.k,e); this.freeze(0.14,0.75); this.flash('rgba(255,255,255,.4)'); BF.Sfx&&BF.Sfx.impact&&BF.Sfx.impact(3,true); }
    if(e.k==='stop') ar.koFx(e.i,'stop',e);
    if(e.k==='gust'){ this.flash('rgba(255,230,120,.25)'); ar.lightning&&ar.lightning(); BF.Sfx&&BF.Sfx.dash(); this.pop(null,'GUST!','#ffd21f'); }
    if(e.k==='nova'){ ar.moveFx&&ar.moveFx(e.i,0xffffff); this.flash('rgba(255,255,255,.5)'); ar.shake=Math.min(8,(ar.shake||0)+4); }
        if(e.k==='wall' && e.s>400){ ar.spark(e.x,e.y,20,e.s*0.5,0x9fb4ff); BF.Sfx && BF.Sfx.clash(e.s*0.5); }
    if(e.k==='burst'){ ar.burstFx(e.i); BF.Sfx && BF.Sfx.burst(); this.flash('rgba(255,46,136,.5)'); this.freeze(0.17,0.95); }
    if(e.k==='dash'){ BF.Sfx && BF.Sfx.dash(); }
    if(e.k==='move'){ this.moveCall(e); if(BF.Missions&&!this.match.practice&&this.myPlayers().includes(e.i)){ BF.Missions.bump('move'); if(e.sig) BF.Missions.bump('sig'); } }
    if(e.k==='status'){ const S=BF.STATUS[e.s]; if(S) this.pop(e.i,S.label.toUpperCase()+'!',S.color); BF.Sfx && BF.Sfx.status && BF.Sfx.status(); }
    if(e.k==='lean') ar.marker && ar.marker(e.x,e.y,e.i===0?0x2ef2ff:0xff2e88);
    if(e.k==='hit' && e.eff==='super') this.pop(null,'Super effective!','#ffd21f');
    if(e.k==='hit' && e.eff==='weak') this.pop(null,'Not very effective…','#9aa3b5');
    if(e.k==='click'){ ar.spark(e.x,e.y,14,700,0xffd21f); BF.Sfx && BF.Sfx.click&&BF.Sfx.click(e.n); const bar=$('#bm'+(e.i+1)); if(bar){ bar.parentNode.classList.remove('pop'); void bar.offsetWidth; bar.parentNode.classList.add('pop'); } }
  },
  // real hit strengths: about half are under 650, the top 3% over 1000 (a move in play counts extra)
  hitFx(e){ const ar=this.arena, S=e.s*(e.mv?1.25:1), tier=S>=1000?3:S>=800?2:S>=650?1:0, now=performance.now(), z=this.match.stadium.depth*Math.min(Math.hypot(e.x,e.y),ar.R)**2/ar.R, col=e.same?0xffd98a:0x8fdcff;
    const ready=now-(this._bigT||0)>420, t=tier>=2&&!ready?1:tier; if(t>=2) this._bigT=now;
    ar.impact(e.x,e.y,z,t,col); BF.Sfx&&BF.Sfx.impact&&BF.Sfx.impact(t,e.same);
    if(t===1) this.freeze(0.03,0); if(t===2){ this.freeze(0.07,0); ar.punch(e.x,e.y,z,0.1,0.32); this.flash('rgba(255,255,255,.14)'); }
    if(t===3){ this.freeze(0.13,0.3); ar.punch(e.x,e.y,z,0.24,0.55); this.flash('rgba(255,255,255,.34)'); }
    if(e.st){ ar.stealFx(e.st.from,e.st.to); if(e.st.a>4&&now-(this._stealT||0)>2600){ this._stealT=now; this.pop(e.st.to,'SPIN STEAL!','#7fe9ff'); } } },
  freeze(stop,slow){ if(BF.Settings&&BF.Settings.get('impactFx')===false) return; this.hitStop=Math.max(this.hitStop||0,stop*BF.feel('hitstop')); if(slow&&!document.documentElement.classList.contains('reduce-motion')) this.slowT=Math.max(this.slowT||0,slow*BF.feel('slowmo')); },
  // ---------- practice arena: a dummy, floating damage numbers, live stats, no rewards ----------
  PRACTICE_DUMMIES:{still:'Standing still',attack:'Attack type',stamina:'Stamina type',defense:'Defense type'},
  dummyDesign(kind,system){ const list=(BF.PRESETS||[]).filter(p=>(p.patch.system||p.sys)===system), want={attack:/attack|slash|upper/i,stamina:/stamina/i,defense:/defen|wall|tank|heavy/i}[kind]; const p=(want&&list.find(x=>want.test(x.blurb||'')))||list[0]||BF.PRESETS[0]; return BF.normalize(Object.assign(BF.defaultDesign(),BF.clone(p.patch))); },
  practiceReset(){ const P=this.practice; P.hits=0; P.best=0; P.burst=0; P.rails=0; this.pracHud(); },
  practiceStart(d1,n1,stadium){ this.practice=this.practice||{kind:'still',infinite:true,hits:0,best:0,burst:0,rails:0}; this.mode='practice'; const P=this.practice, d2=this.dummyDesign(P.kind==='still'?'attack':P.kind,d1.system);
    this.startMatch({d1,d2,n1,n2:'Practice dummy',stadium,seed:(Math.random()*1e9)|0,moves:true,prog:true,practice:true}); this.practiceReset(); },
  pracHud(){ let el=$('#pracHud'); const on=this.match&&this.match.practice&&this.st!=='setup'; if(!on){ if(el) el.hidden=true; return; } if(!el){ el=document.createElement('aside'); el.id='pracHud'; $('#view-battle').appendChild(el); } el.hidden=false; const P=this.practice, sim=this.sim, b=sim&&sim.b&&sim.b[0];
    const open=this._pracOpen!=null?this._pracOpen:window.innerWidth>1000;
    el.innerHTML=`<details${open?' open':''}><summary>Practice arena</summary><div class="pr-grp">${Object.entries(this.PRACTICE_DUMMIES).map(([k,l])=>`<button type="button" data-pk="${k}" class="${P.kind===k?'on':''}">${l}</button>`).join('')}</div>
      <div class="pr-grp"><button type="button" data-po="inf" class="${P.infinite?'on':''}">Infinite spin: ${P.infinite?'On':'Off'}</button><button type="button" data-po="path" class="${this._noPath?'':'on'}">Launch path: ${this._noPath?'Off':'On'}</button></div>
      <dl><div><dt>Hits</dt><dd id="prH">${P.hits}</dd></div><div><dt>Hardest hit</dt><dd id="prB">${Math.round(P.best)}</dd></div><div><dt>Spin left</dt><dd id="prS">${b?Math.round(b.w/b.w0*100)+'%':'-'}</dd></div><div><dt>Burst damage</dt><dd id="prD">${Math.round(((sim&&sim.practice&&sim.practice.dealt)||0)*100)}%</dd></div><div><dt>Rail rides</dt><dd id="prR">${P.rails}</dd></div></dl></details>
      <div class="pr-act"><button type="button" class="btn primary" data-pa="reset">Re-launch</button><button type="button" class="btn" data-pa="exit">Exit</button></div>`;
    el.querySelector('details').ontoggle=e=>{ this._pracOpen=e.target.open; };
    el.querySelectorAll('[data-pk]').forEach(x=>x.onclick=()=>{ P.kind=x.dataset.pk; this.practiceAgain(); });
    el.querySelectorAll('[data-po]').forEach(x=>x.onclick=()=>{ if(x.dataset.po==='inf'){ P.infinite=!P.infinite; if(this.sim&&this.sim.practice) this.sim.practice.infinite=P.infinite; } else { this._noPath=!this._noPath; if(this.st==='launch') this.practiceAgain(); } this.pracHud(); });
    el.querySelector('[data-pa=reset]').onclick=()=>this.practiceAgain();
    el.querySelector('[data-pa=exit]').onclick=()=>{ this.sim=null; this.match=null; this._aim=null; document.body.classList.remove('infight'); this.hideMoveBar(); $('#banner').hidden=true; this.arena.live=false; this.arena.clearPreview(); this.arena.clearLaunchers(); el.hidden=true; this.mode='practice'; this.renderSetup(); }; },
  practiceAgain(){ const m=this.match; this.sim=null; this.arena.live=false; document.body.classList.remove('infight'); this.hideMoveBar(); $('#banner').hidden=true; this.arena.clearLaunchers(); this.practiceStart(m.d1,m.n1,m.stadium); },
  practiceHit(e){ const P=this.practice; P.hits++; P.best=Math.max(P.best,e.s); const ar=this.arena, z=this.match.stadium.depth*Math.min(Math.hypot(e.x,e.y),ar.R)**2/ar.R, p=ar.project(e.x,e.y,z+14), S=e.s*(e.mv?1.25:1), n=document.createElement('span'); n.className='pr-num t'+(S>=1000?3:S>=800?2:S>=650?1:0); n.textContent=Math.round(e.s); n.style.left=p.x+'px'; n.style.top=p.y+'px'; $('#view-battle').appendChild(n); setTimeout(()=>n.remove(),900);
    const H=$('#prH'), B2=$('#prB'); if(H) H.textContent=P.hits; if(B2) B2.textContent=Math.round(P.best); },
  roundEnd(res,score,fromNet){
    if(this.match&&this.match.practice){ this.st='roundEnd'; this.arena.live=false; document.body.classList.remove('infight'); this.hideMoveBar(); const ban=$('#banner'); ban.hidden=false; ban.className='banner finish '+res.how; ban.innerHTML=`<small>${FINISH[res.how]}</small><b>Practice</b><span>No points or rewards here</span>`; setTimeout(()=>{ if(this.match&&this.match.practice&&this.st==='roundEnd') this.practiceAgain(); },1500); return; }
    this.st='roundEnd'; document.body.classList.remove('infight'); if(score) this.score=score; this.hideMoveBar();
    // moves picked this round go on cooldown for the next one
    if(this.launches) this.lastMoves=[0,1,2].map(i=>(this.launches[i]&&this.launches[i].moves)||[]);
    if(BF.Missions){ BF.Missions.bump('round'); if(res.how==='burst'&&this.mode!=='local'&&res.winner===(this.raid?0:this.me)) BF.Missions.bump('burstwin'); }
    if(this.mst&&!fromNet){ const wi=this.raid?(res.winner===0?0:2):res.winner; if(this.mst[wi]){ this.mst[wi].rounds++; this.mst[wi].fin[res.how]=(this.mst[wi].fin[res.how]||0)+1; } this.mstAll.rounds++; this.mstAll.longest=Math.max(this.mstAll.longest,res.t||0); }
    const pts=this.rules.pts[res.how]||1;
    if(!fromNet){ this.score[res.winner]+=pts; if(this.mode==='online') BF.Net.send({t:'round',res,score:this.score}); }
    this.arena.live=false;
    if(this.raid){ if(res.winner===0){ this.arena.winFx(0); this.arena.winFx(1); } else this.arena.winFx(2); } else this.arena.winFx(res.winner);
    const wName=this.raid?(res.winner===0?'Raid team':this.F[2].name):this.F[res.winner].name; const ban=$('#banner');
    ban.hidden=false; ban.className='banner finish '+res.how+(res.winner===0?' c1':' c2');
    ban.innerHTML=`<small>${FINISH[res.how]}</small><b>${esc(wName)}</b><span>+${pts} ${pts>1?'points':'point'}</span>`;
    BF.Sfx && BF.Sfx.finish(res.how);
    this.updateHud(null);
    const over=this.score[0]>=this.rules.target||this.score[1]>=this.rules.target;
    setTimeout(()=>{ if(over) this.matchEnd(); else { this.round++; this.nextRound(); } },2600);
  },
  matchEnd(){
    this.st='matchEnd'; const win=this.score[0]>this.score[1]?0:1; const ban=$('#banner'); ban.hidden=true;
    const myTeam=this.raid?0:this.me;
    let line='';
    const adv=this.match.adventure; if(adv) setTimeout(()=>BF.Adventure.done(adv,win===myTeam,this).then(lines=>{ const box=document.querySelector('.bpanel.result .advres'); if(box&&lines) box.innerHTML=lines; }).catch(e=>console.warn(e)),200);
    if(this.mode!=='local'&&win===myTeam&&BF.Missions){ BF.Missions.bump('win'); if(this.mode==='online') BF.Missions.bump('onlinewin'); }
    if(this.mode!=='local'){ const won=win===myTeam; const rec=BF.Records.add(won,this.lastHow||'spin',this.F[this.me].name,this.mode==='online',!!(this.match&&this.match.ranked)); line=`<div class="record">${won?'Victory':'Defeat'} · record ${rec.wins}–${rec.losses}</div>`; BF.Ach && BF.Ach.check({won,how:this.lastHow,score:this.score,me:this.me,mode:this.mode,f:this.F[this.me]}); }
    const myD=this.me===1?this.match.d2:this.match.d1;
    if(this.mode!=='local' && BF.Parts && myD && myD.prog && myD.prog.copyIds) setTimeout(()=>BF.Parts.reward(myD,{won:win===myTeam,rounds:this.round,mode:this.mode,cpuLevel:this.cpuLv()}).then(r=>{
      if(!r) return; const box=document.querySelector('.bpanel.result .rewards'); if(!box) return;
      box.innerHTML=`<div>+${r.xpGain} part XP</div>${r.ups.map(u=>`<div class="lvup">⬆ ${esc(u)}</div>`).join('')}${r.drop?`<div class="dropline" style="--c:${BF.RARITY[r.drop.rarity].color}">🎁 Part drop: <b>${r.drop.shiny?'✨ Shiny ':''}${esc(BF.RARITY[r.drop.rarity].label)} ${esc(r.drop.name)}</b></div>`:''}`;
      if(r.drop) BF.Sfx&&BF.Sfx.finish&&BF.Sfx.finish('xtreme'); }).catch(e=>console.warn(e)),300);
    this.panel.className='bpanel result';
    const title=this.raid?(win===0?'Raid cleared!':esc(this.F[2].name)+' wins'):esc(this.F[win].name)+' wins';
    this.panel.innerHTML=`<div class="res-title ${win===0?'c1':'c2'}">${title}</div>
      <div class="res-score"><b class="c1">${this.score[0]}</b><span>–</span><b class="c2">${this.score[1]}</b></div>${line}${this.statsHtml()}<div class="rewards"></div><div class="advres"></div>
      <div class="res-acts">${this.mode==='online'&&BF.Net.role==='guest'?'<button class="btn primary" id="rematch">Ask for rematch</button>':'<button class="btn primary" id="rematch">Rematch</button>'}<button class="btn" id="backSetup">${adv&&!this.raid?'Back to Adventure':'Change Beys'}</button></div>`;
    $('#rematch').onclick=()=>{ if(this.mode==='online'){ if(BF.Net.role==='host') this.hostStart(); else { BF.Net.send({t:'rematch'}); $('#rematch').textContent='Asked…'; } } else this.startMatch(this.match); };
    $('#backSetup').onclick=()=>{ if(adv&&!this.raid) this.mode='adventure'; this.renderSetup(); };
  },
  // ---------- v5: launch formations, move bar, lean ----------
  moveKeys(p){ return this.mode==='local'&&p===1?['8','9','0']:['1','2','3']; },
  moveLocked(who,id){ const pr=this.F[who].d.prog; return !!(pr&&pr.unlocked&&!pr.unlocked.includes(id)); },
  defaultPicks(who){ const pools=BF.movePools(this.F[who].d), last=this.lastMoves[who]||[];
    return ['blade','core','driver'].map(k=>(pools[k].find(m=>!last.includes(m.id)&&!this.moveLocked(who,m.id))||pools[k].find(m=>!this.moveLocked(who,m.id))||pools[k][0]).id); },
  movePicker(who){
    const pools=BF.movePools(this.F[who].d), last=this.lastMoves[who]||[], picks=this.defaultPicks(who);
    return `<div class="fl">Launch formation — pick 1 move per part<div class="mvpick">${['blade','core','driver'].map((part,pi)=>`<div class="mvrow"><span class="mvpart">${BF.PART_LABEL[part]}</span>${pools[part].map(m=>{ const E=BF.ELEMENTS[m.el], cd=last.includes(m.id), lk=this.moveLocked(who,m.id), pr=this.F[who].d.prog, lv=(pr&&pr.moveLv&&pr.moveLv[m.id])||1;
      return `<button type="button" class="mvchip${picks[pi]===m.id?' on':''}" data-part="${pi}" data-mv="${m.id}" style="--c:${E.color}"${cd||lk?' disabled':''} title="${esc(BF.MOVE_KINDS[m.kind].desc)}"><i>${E.icon}</i><b>${esc(m.name)}${lv>1?' '+['','II','III'][Math.min(2,lv-1)]:''}</b>${lk?`<em>part Lv ${m.slot===1?3:8}</em>`:cd?'<em>cooldown</em>':''}</button>`; }).join('')}</div>`).join('')}</div></div>`;
  },
  myPlayers(){ return this.mode==='local'?[0,1]:this.mode==='online'?[this.me]:[0]; },
  showMoveBar(){
    const bar=$('#moveBar'); if(!this.movesOn||!this.launches){ bar.hidden=true; return; }
    bar.innerHTML=this.myPlayers().map(p=>{ const l=this.launches[p]||{}, keys=this.moveKeys(p);
      return `<div class="mbgroup c${p+1}">${(l.moves||[]).map((id,s)=>{ const m=BF.moveById(this.F[p].d,id); if(!m) return ''; const E=BF.ELEMENTS[m.el];
        return `<button type="button" class="mbbtn" data-p="${p}" data-s="${s}" style="--c:${E.color}" title="${esc(BF.MOVE_KINDS[m.kind].desc)}"><i>${E.icon}</i><b>${esc(m.name)}</b><kbd>${keys[s]}</kbd></button>`; }).join('')}</div>`; }).join('')
      +`<div class="mbhint">Tap the stadium to lean${this.mode==='local'?' (your half)':''}</div>`;
    bar.hidden=false;
    bar.querySelectorAll('.mbbtn').forEach(b=>b.onpointerdown=e=>{ e.preventDefault(); e.stopPropagation(); this.fireMove(+b.dataset.p,+b.dataset.s); });
  },
  hideMoveBar(){ const b=$('#moveBar'); if(b) b.hidden=true; },
  fireMove(p,s){
    if(this.st!=='fight') return;
    const btn=document.querySelector(`.mbbtn[data-p="${p}"][data-s="${s}"]`); if(!btn||btn.classList.contains('used')) return;
    if(this.mode==='online'&&BF.Net.role==='guest'){ BF.Net.send({t:'in',k:'move',s}); btn.classList.add('used'); return; }
    if(this.sim) this.sim.useMove(p,s);
  },
  lean(p,x,y){ if(this.st!=='fight') return; if(!(this.match&&this.match.practice)) BF.Missions&&BF.Missions.bump('lean');
    if(this.mode==='online'&&BF.Net.role==='guest'){ BF.Net.send({t:'in',k:'lean',x,y}); this.arena.marker&&this.arena.marker(x,y,0xff2e88); return; }
    if(this.sim) this.sim.lean(p,x,y); },
  bindControls(){
    let aiming=false; const aimAt=e=>{ const w=this._aim&&this.arena.pick(e.clientX,e.clientY); if(w) this._aim(w); };
    $('#arena').addEventListener('pointermove',e=>{ if(aiming&&this.st==='launch') aimAt(e); }); window.addEventListener('pointerup',()=>{ aiming=false; });
    $('#arena').addEventListener('pointerdown',e=>{ if(this.st==='launch'&&this._aim){ aiming=true; aimAt(e); return; } if(this.st!=='fight'||!this.movesOn) return; const w=this.arena.pick(e.clientX,e.clientY); if(!w) return;
      const p=this.mode==='local'?(w.y<0?0:1):this.mode==='online'?this.me:0; this.lean(p,w.x,w.y); });
    window.addEventListener('keydown',e=>{ if(this.st!=='fight'||$('#view-battle').hidden||e.target.matches('input,textarea,select')) return;
      this.myPlayers().forEach(p=>{ const s=this.moveKeys(p).indexOf(e.key); if(s>=0){ e.preventDefault(); this.fireMove(p,s); } }); });
  },
  syncMoveBar(snap){ const key=snap.b.map(b=>b[12]||0).join(','); if(key===this._usedSeen) return; this._usedSeen=key;
    document.querySelectorAll('.mbbtn').forEach(b=>{ const bits=snap.b[+b.dataset.p][12]||0; b.classList.toggle('used',!!(bits&(1<<+b.dataset.s))); }); },
  moveCall(e){
    const E=BF.ELEMENTS[e.el]||{color:'#2ef2ff'}, el=$('#moveCall');
    el.className='movecall '+(e.i===0?'c1':'c2'); el.style.setProperty('--c',E.color);
    el.innerHTML=`<small>${esc(this.F[e.i].name)}</small><b>${esc(e.name)}!</b>`; el.hidden=false;
    el.style.animation='none'; void el.offsetWidth; el.style.animation='';
    clearTimeout(this._mcT); this._mcT=setTimeout(()=>el.hidden=true,1300);
    this.arena.moveFx && this.arena.moveFx(e.i,parseInt(E.color.slice(1),16));
    BF.Sfx && BF.Sfx.move && BF.Sfx.move(e.kind);
  },
  pop(i,text,color){ const now=performance.now(); if(now-(this._popT||0)<700) return; this._popT=now;
    const el=$('#effPop'); el.textContent=text; el.style.setProperty('--c',color); el.className='effpop'+(i==null?'':' p'+(i+1)); el.hidden=false;
    el.style.animation='none'; void el.offsetWidth; el.style.animation=''; clearTimeout(this._popTo); this._popTo=setTimeout(()=>el.hidden=true,1000); },
  statusFx(snap){ const ar=this.arena; if(!ar.partOn||!ar.partOn()) return;
    snap.b.forEach(s=>{ const bits=s[11]||0; if(!bits||!s[7]) return; (BF.STATUS_KEYS||[]).forEach((k,j)=>{ if(!(bits&(1<<j))||Math.random()>0.35) return;
      const c=parseInt(BF.STATUS[k].color.slice(1),16), a=Math.random()*Math.PI*2;
      ar.particle(s[0]+Math.cos(a)*14,s[1]+Math.sin(a)*14,s[2]+8,Math.cos(a)*20,Math.sin(a)*20,k==='burn'?70:k==='freeze'?-10:40,0.5,c,k==='shock'?0.9:1.2,k==='burn'?-60:120); }); }); },
  statsHtml(){ if(!this.mst) return ''; const cols=this.raid?[0,1,2]:[0,1], M=this.mst, A=this.mstAll, f=i=>this.F[i];
    const fin=m=>Object.entries(m.fin).map(([k,v])=>`${v}× ${k}`).join(', ')||'—';
    const row=(label,fn,best)=>{ const vals=cols.map(i=>fn(M[i])); const mx=Math.max(...vals.map(v=>typeof v==='number'?v:-1));
      return `<tr><td>${label}</td>${vals.map(v=>`<td class="${best&&typeof v==='number'&&v===mx&&mx>0?'top':''}">${v}</td>`).join('')}</tr>`; };
    return `<div class="mstats"><table><tr><th></th>${cols.map(i=>`<th class="c${Math.min(i,1)+1}">${esc(f(i).name)}</th>`).join('')}</tr>
      ${row('Rounds won',m=>m.rounds,1)}${row('Finishes',m=>fin(m))}${row('Moves fired',m=>m.moves,1)}${row('Statuses inflicted',m=>m.statuses,1)}${row('Burst clicks dealt',m=>m.clicks,1)}</table>
      <div class="mst-all"><span><b>${A.hits}</b>clashes</span><span><b>${Math.round(A.best)}</b>biggest hit</span><span><b>${A.longest.toFixed(1)}s</b>longest round</span><span><b>${A.rounds}</b>rounds</span></div></div>`; },
  flash(c){ const f=$('#bflash'); if(!f||(BF.Settings&&!BF.Settings.get('shake'))) return; f.style.background=c; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); },
  // ---------- HUD ----------
  hud(on){ $('#bhud').hidden=!on; if(!on) this.hideMoveBar(); if(on){ [0,1].forEach(i=>{ $('#pt'+(i+1)).innerHTML=`<img src="${this.portrait(this.F[i])}" alt="">`; const els=this.movesOn?(this.F[i].els||[]):[]; $('#n'+(i+1)).innerHTML=esc(this.F[i].name)+els.map(e=>`<span class="elb" style="--c:${BF.ELEMENTS[e].color}" title="${BF.ELEMENTS[e].label}">${BF.ELEMENTS[e].icon}</span>`).join(''); }); } },
  updateHud(snap){
    if(!this.F) return;
    [0,1].forEach(i=>{
      const pips=$('#pips'+(i+1)); const t=this.rules.target;
      pips.innerHTML=Array.from({length:t},(_,k)=>`<i class="${k<this.score[i]?'on':''}"></i>`).join('');
      const stEl=$('#st'+(i+1)); if(stEl){ const bits=snap?snap.b[i][11]||0:0; if(stEl._bits!==bits){ stEl._bits=bits; stEl.innerHTML=(BF.STATUS_KEYS||[]).filter((k,j)=>bits&(1<<j)).map(k=>`<i style="--c:${BF.STATUS[k].color}">${BF.STATUS[k].label}</i>`).join(''); } }
      if(snap){ const s=snap.b[i], wv=Math.max(0,Math.min(100,s[4]/s[5]*100))+'%'; $('#s'+(i+1)).style.width=wv; $('#sl'+(i+1)).style.width=wv; const bm=$('#bm'+(i+1)); bm.style.width=Math.min(100,(s[10]||0)*100)+'%'; bm.parentNode.classList.toggle('hot',(s[10]||0)>0.66); }
      else { $('#s'+(i+1)).style.width='100%'; $('#sl'+(i+1)).style.width='100%'; $('#bm'+(i+1)).style.width='0%'; }
    });
    $('#roundLbl').textContent=this.raid?'RAID':'Round '+this.round;
    if(this.raid){ const s=snap&&snap.b[2]; $('#bossSpin').style.width=(s?Math.max(0,Math.min(100,s[4]/s[5]*100)):100)+'%'; $('#bossBurst').style.width=(s?Math.min(100,(s[10]||0)*100):0)+'%'; }
  },
  // ---------- main loop ----------
  loop(){
    let last=performance.now();
    const frame=now=>{
      requestAnimationFrame(frame);
      const dt=Math.min(0.05,(now-last)/1000); last=now;
      if($('#view-battle').hidden) return;
      let snap=null;
      if(this.st==='setup' && this.preview){ this.preview.ang-=dt*30; const R=this.arena.R||190; snap={b:[[0,0,0,this.preview.ang,1,1,0,1,0,0],[0,0,0,0,1,1,0,0,1,0]]}; }
      else if(this.sim && this.st==='fight'){
        if(!(this.hitStop>0)) this.acc+=dt*(this.slowT>0?0.24:1)*BF.feel('speed'); const h=1/120;
        while(this.acc>=h && !this.sim.done){ this.sim.step(h); this.acc-=h; }
        if((this.mode==='cpu'||this.raid) && this.movesOn && !this.match.practice){ this.aiAcc+=dt; if(this.aiAcc>=0.25){ this.aiAcc=0; if(this.raid) BF.MoveAI.tick(this.sim,2,'expert',this.aiMem[2]); else BF.MoveAI.tick(this.sim,1,this.cpuLv(),this.aiMem[1]); } }
        const ev=this.sim.events.splice(0); ev.forEach(e=>this.fx(e)); if(this.mode==='online') this.evQ.push(...ev);
        snap=this.sim.snapshot();
        if(this.mode==='online'){ this.sendT-=dt; if(this.sendT<=0){ BF.Net.send({t:'s',s:snap,ev:this.evQ.splice(0)}); this.sendT=1/30; } }
        this.updateHud(snap); if(this.match.practice&&this.sim.b){ const e2=$('#prS'), d2=$('#prD'), y=this.sim.b[1]; if(e2) e2.textContent=Math.round(this.sim.b[0].w/this.sim.b[0].w0*100)+'%'; if(d2) d2.textContent=Math.round((this.sim.practice.dealt||0)*100)+'%'; }
        if(this.sim.done){ this.lastHow=this.sim.done.how; const res=this.sim.done;
          const lost=this.sim.b.filter(b=>b.team!==res.winner).sort((x,y)=>(y.outT||0)-(x.outT||0))[0]; if(lost){ this.arena.focus(lost.x,lost.y,lost.z,1.7); this.slow=1.1; } this.sim=null; if(this.mode==='online') BF.Net.send({t:'s',s:snap,ev:this.evQ.splice(0)}); setTimeout(()=>this.roundEnd(res),700); }
      } else if(this.netSnap){
        snap=this.netSnap;
        if(this.st==='fight'){ snap.b.forEach(s=>{ s[3]+= (s[4]||0)*dt*(s[3]>=0?1:-1)*0; }); this.updateHud(snap); if(snap.done) this.lastHow=snap.done.how; }
      }
      if(this.st==='fight' && this.mode==='online' && BF.Net.role==='guest' && snap){ this.guestAng=this.guestAng||[0,0]; snap.b.forEach((s,i)=>{ this.guestAng[i]+= (this.F[i].d.spin==='left'?1:-1)*s[4]*dt; s[3]=this.guestAng[i]; }); }
      if(this.st==='fight' && snap){ this.syncMoveBar(snap); this.statusFx(snap); }
      let rdt=dt; if(this.hitStop>0){ this.hitStop-=dt; rdt=dt*0.05; } else if(this.slowT>0){ this.slowT-=dt; rdt=dt*0.3; } else if(this.slow>0){ this.slow-=dt; rdt=dt*0.3; }
      this.arena.tickDebris(rdt);
      this.arena.render(snap,rdt);
    };
    requestAnimationFrame(frame);
  }
};
})();
