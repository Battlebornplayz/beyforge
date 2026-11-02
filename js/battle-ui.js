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
  },
  show(){ this.arena.resize(); if(this.st==='setup') this.renderSetup(); },
  // ---------- picking fighters ----------
  async options(){
    this.lib=await BF.Store.loadLibrary().catch(()=>[]);
    const o=[['forge','Your Forge Bey — '+BF.naming(BF.App.d,BF.App.an&&BF.App.an.type).full]];
    this.lib.forEach(r=>o.push(['lib:'+r.id,'Library — '+r.meta.full]));
    BF.PRESETS.forEach(p=>o.push(['preset:'+p.id,'Preset — '+p.name+' ('+(p.sys==='X'?'X':'Burst')+')']));
    o.push(['random','Random Bey']);
    return o;
  },
  designFor(key){
    if(key==='forge') return BF.clone(BF.App.d);
    if(key.startsWith('lib:')){ const r=this.lib.find(x=>'lib:'+x.id===key); if(r) return BF.normalize(BF.clone(r.design)); }
    if(key.startsWith('preset:')) return BF.fromPreset(BF.PRESETS.find(p=>'preset:'+p.id===key));
    return BF.randomDesign();
  },
  myDesign(){ return this.designFor(this.picks.p1); },
  myName(){ const d=this.myDesign(); return BF.naming(d).full; },
  // ---------- setup screen ----------
  async renderSetup(){
    this.st='setup'; this.hud(false); $('#banner').hidden=true;
    const opts=await this.options(); const sel=(id,v)=>`<select id="${id}">${opts.map(([k,l])=>`<option value="${k}"${k===v?' selected':''}>${esc(l)}</option>`).join('')}</select>`;
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
          <div class="vs-line"><b class="c1">${esc(this.myName())}</b><span>vs</span><b class="c2">${esc(this.remote?this.remote.name:'waiting for their Bey…')}</b></div>
          ${net.role==='host'?`<button class="btn primary wide" id="startBtn"${this.remote?'':' disabled'}>Start match</button>`:`<div class="netwait">Waiting for the host to start…</div>`}
          <button class="btn ghost" id="netCancel">Leave</button></div>`;
    }
    const hostCtl=!online||net.role==='host'||net.status!=='connected';
    this.panel.className='bpanel setup';
    this.panel.innerHTML=`
      <h2>Battle</h2>
      <div class="seg" id="modeSeg">${[['cpu','vs CPU'],['local','2 players'],['online','Online']].map(([k,l])=>`<button type="button" class="${this.mode===k?'on':''}" data-mode="${k}">${l}</button>`).join('')}</div>
      <label class="fl">${online?'Your Bey':'Player 1'}${sel('pick1',this.picks.p1)}</label>
      ${online?'':`<label class="fl">${this.mode==='cpu'?'CPU opponent':'Player 2'}${sel('pick2',this.picks.p2)}</label>`}
      ${hostCtl?`<div class="fl">Stadium<div class="seg" id="stSeg">${[['X','Xtreme'],['Burst','Burst']].map(([k,l])=>`<button type="button" class="${this.stadiumKind===k?'on':''}" data-st="${k}">${l}</button>`).join('')}</div></div>
      <label class="fl">Stadium size <output id="sizeOut" class="val">${this.size} mm</output><input type="range" id="sizeIn" min="280" max="480" step="10" value="${this.size}"></label>
      <div class="fine">${this.rulesLine()} · ${BF.ROUND_LENGTH[BF.Settings.get('roundLength')].label.toLowerCase()} rounds — change in Settings</div>`:''}
      ${onlineHtml}
      ${online?'':`<button class="btn primary wide big" id="fightBtn">Let it rip</button>`}
      ${this.recordLine()}`;
    this.panel.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{ this.mode=b.dataset.mode; if(this.mode!=='online') BF.Net.close(); this.renderSetup(); });
    this.panel.querySelectorAll('[data-st]').forEach(b=>b.onclick=()=>{ this.stadiumKind=b.dataset.st; this.size=b.dataset.st==='X'?380:360; this.renderSetup(); });
    const si=$('#sizeIn'); if(si) si.oninput=()=>{ this.size=+si.value; $('#sizeOut').textContent=this.size+' mm'; };
    const p1=$('#pick1'); if(p1) p1.onchange=()=>{ this.picks.p1=p1.value; if(online && net.status==='connected') BF.Net.send({t:'hello',design:this.myDesign(),name:this.myName()}); this.renderSetup(); };
    const p2=$('#pick2'); if(p2) p2.onchange=()=>{ this.picks.p2=p2.value; };
    const fb=$('#fightBtn'); if(fb) fb.onclick=()=>this.localStart();
    const hb=$('#hostBtn'); if(hb) hb.onclick=()=>{ if(!BF.Net.available()) return BF.App.toast('Online play needs an internet connection','bad'); BF.Net.host(); };
    const jb=$('#joinBtn'); if(jb) jb.onclick=()=>{ const c=$('#joinCode').value; if(c.length!==4) return BF.App.toast('Codes are 4 letters','bad'); BF.Net.join(c); };
    const jc=$('#joinCode'); if(jc) jc.oninput=()=>{ jc.value=jc.value.toUpperCase().replace(/[^A-Z]/g,''); };
    const nc=$('#netCancel'); if(nc) nc.onclick=()=>{ BF.Net.close(); this.remote=null; this.renderSetup(); };
    const sb=$('#startBtn'); if(sb) sb.onclick=()=>this.hostStart();
    this.previewArena();
  },
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
    if(s==='error'){ this.netErr=info; }
    if(s==='connected'){ BF.Net.send({t:'hello',design:this.myDesign(),name:this.myName()}); }
    if(s==='closed' && this.st!=='setup'){ BF.App.toast('Your opponent disconnected','bad'); this.st='setup'; }
    if(this.mode==='online' && (this.st==='setup')) this.renderSetup();
  },
  // ---------- match flow ----------
  localStart(){
    const d1=this.designFor(this.picks.p1), d2=this.designFor(this.picks.p2);
    const st=this.stadium(); this.startMatch({stadium:st, rules:BF.Settings.rulesFor(st.kind), d1, d2, n1:null, n2:null, seed:(Math.random()*1e9)|0});
  },
  hostStart(){
    const st=this.stadium(); const m={t:'start', stadium:st, rules:BF.Settings.rulesFor(st.kind), decayK:BF.Settings.decayK(), d1:this.myDesign(), d2:this.remote.design, n1:this.myName(), n2:this.remote.name, seed:(Math.random()*1e9)|0};
    BF.Net.send(m); this.startMatch(m);
  },
  startMatch(m){
    this.match=m; this.st='launch'; this.score=[0,0]; this.round=1; this.seed=m.seed;
    this.F=[BF.fighter(m.d1,m.n1), BF.fighter(m.d2,m.n2)];
    this.me = this.mode==='online' && BF.Net.role==='guest' ? 1 : 0;
    this.arena.setup(m.stadium,this.F[0],this.F[1]);
    this.rules=m.rules||BF.Settings.rulesFor(m.stadium.kind);
    this.hud(true); this.nextRound();
  },
  nextRound(){
    this.st='launch'; this.launches=[null,null]; this.sim=null; this.netSnap=null; this.arena.clearDebris();
    $('#banner').hidden=true; this.updateHud(null);
    this.idlePose();
    if(this.mode==='online') this.launchPanel(this.me);
    else this.launchPanel(0);
  },
  idlePose(){ const R=this.match.stadium.diameter/2; this.netSnap={b:[[0,-R*0.55,0,0,0,1,0,1,0,0],[0,R*0.55,0,0,0,1,0,1,0,0]].map((s,i)=>{ s[2]=this.match.stadium.depth*(R*0.55)**2/R; return s; })}; },
  launchPanel(who){
    const f=this.F[who], col=who===0?'c1':'c2', dual=f.d.spin==='dual';
    const label=this.mode==='local'?`Player ${who+1}`:this.mode==='cpu'?'Your launch':'Your launch';
    this.panel.className='bpanel launch';
    this.panel.innerHTML=`
      <div class="lp-head"><span class="${col}">${esc(label)}</span><b>${esc(f.name)}</b><span class="dim">Round ${this.round}</span></div>
      ${dual?`<div class="fl">Spin<div class="seg" id="spinSeg"><button type="button" class="on" data-sp="right">Right</button><button type="button" data-sp="left">Left</button></div></div>`:''}
      ${f.d.bit.tip==='mode'?`<div class="fl">Tip mode<div class="seg" id="modeSegL"><button type="button" class="${f.d.bit.mode!=='stamina'?'on':''}" data-md="attack">Attack</button><button type="button" class="${f.d.bit.mode==='stamina'?'on':''}" data-md="stamina">Stamina</button></div></div>`:''}
      <label class="fl">Launch angle <output class="val" id="angOut">0°</output><input type="range" id="angIn" min="-30" max="30" step="1" value="0"></label>
      <div class="meter"><i id="meterFill"></i><span class="sweet"></span></div>
      <button class="btn primary wide big rev" id="revBtn">Hold to rev — release to launch</button>
      <div class="fine">Release in the bright zone for a full-power launch.</div>`;
    let mode=f.d.bit.mode||'attack'; this.panel.querySelectorAll('[data-md]').forEach(b=>b.onclick=()=>{ mode=b.dataset.md; this.panel.querySelectorAll('[data-md]').forEach(x=>x.classList.toggle('on',x===b)); });
    let spin='right'; this.panel.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{ spin=b.dataset.sp; this.panel.querySelectorAll('[data-sp]').forEach(x=>x.classList.toggle('on',x===b)); });
    const ai=$('#angIn'); ai.oninput=()=>$('#angOut').textContent=(ai.value>0?'+':'')+ai.value+'°';
    const btn=$('#revBtn'), fill=$('#meterFill'); let t0=0, raf=0, power=0;
    const tick=()=>{ const t=(performance.now()-t0)/1000; const ph=(t/1.3)%2; power=ph<1?ph:2-ph; fill.style.width=(power*100)+'%'; fill.classList.toggle('hot',power>0.9); raf=requestAnimationFrame(tick); };
    const start=e=>{ e.preventDefault(); if(t0) return; t0=performance.now(); btn.classList.add('revving'); tick(); BF.Sfx && BF.Sfx.rev(true); };
    const end=e=>{ if(!t0) return; e&&e.preventDefault(); cancelAnimationFrame(raf); BF.Sfx && BF.Sfx.rev(false);
      const p=Math.max(0.35,power); btn.disabled=true; btn.textContent=p>0.9?'PERFECT LAUNCH!':`Launch power ${Math.round(p*100)}%`;
      this.lockLaunch(who,{power:p,angle:+ai.value,spin,mode}); };
    btn.addEventListener('pointerdown',start); btn.addEventListener('pointerup',end); btn.addEventListener('pointerleave',end);
    btn.addEventListener('keydown',e=>{ if(e.key===' '||e.key==='Enter') start(e); }); btn.addEventListener('keyup',e=>{ if(e.key===' '||e.key==='Enter') end(e); });
  },
  lockLaunch(who,l){
    if(this.mode==='online'){
      if(BF.Net.role==='host'){ this.launches[0]=l; this.tryGo(); }
      else BF.Net.send({t:'launch',l});
      setTimeout(()=>{ if(this.st==='launch') this.panel.innerHTML=`<div class="netwait">Waiting for ${esc(this.F[1-this.me].name)} to launch…</div>`; },600);
      return;
    }
    this.launches[who]=l;
    if(this.mode==='local' && who===0){ setTimeout(()=>this.launchPanel(1),650); return; }
    if(this.mode==='cpu') this.launches[1]={power:0.7+Math.random()*0.3, angle:Math.round((Math.random()-0.5)*40), spin:Math.random()<0.5?'right':'left', mode:Math.random()<0.5?'attack':'stamina'};
    setTimeout(()=>this.countdown(this.launches,(Math.random()*1e9)|0),500);
  },
  tryGo(){ if(BF.Net.role!=='host'||!this.launches[0]||!this.launches[1]) return; const seed=(Math.random()*1e9)|0; BF.Net.send({t:'go',launches:this.launches,seed}); this.countdown(this.launches,seed); },
  countdown(launches,seed){
    this.st='countdown'; this.launches=launches; this.panel.className='bpanel hidden'; this.panel.innerHTML='';
    const ban=$('#banner'); ban.hidden=false; const seq=['3','2','1','GO SHOOT!']; let i=0;
    const step=()=>{ ban.className='banner count'+(i===3?' go':''); ban.textContent=seq[i]; BF.Sfx && BF.Sfx.beep(i===3); i++;
      if(i<4) setTimeout(step,560); else setTimeout(()=>{ ban.hidden=true; this.fight(seed); },520); };
    step();
  },
  fight(seed){
    this.st='fight';
    const isGuest=this.mode==='online'&&BF.Net.role==='guest';
    this.arena.live=true; [0,1].forEach(i=>this.arena.launchFx(i));
    if(isGuest){ this.sim=null; return; }
    this.sim=new BF.Sim(this.F[0],this.F[1],this.match.stadium,seed);
    if(this.match.decayK) this.sim.decayK=this.match.decayK;
    this.sim.launch(this.launches[0],this.launches[1]); this.acc=0; this.sendT=0; this.evQ=[];
    BF.Sfx && BF.Sfx.rip();
  },
  fx(e){
    const ar=this.arena;
    if(e.k==='hit'){ ar.spark(e.x,e.y,this.match.stadium.depth*Math.min(Math.hypot(e.x,e.y),ar.R)**2/ar.R,e.s); BF.Sfx && BF.Sfx.clash(e.s); }
    if(e.k==='wall' && e.s>400){ ar.spark(e.x,e.y,20,e.s*0.5,0x9fb4ff); BF.Sfx && BF.Sfx.clash(e.s*0.5); }
    if(e.k==='burst'){ ar.burstFx(e.i); BF.Sfx && BF.Sfx.burst(); }
    if(e.k==='dash'){ BF.Sfx && BF.Sfx.dash(); }
  },
  roundEnd(res,score,fromNet){
    this.st='roundEnd'; if(score) this.score=score;
    const pts=this.rules.pts[res.how]||1;
    if(!fromNet){ this.score[res.winner]+=pts; if(this.mode==='online') BF.Net.send({t:'round',res,score:this.score}); }
    this.arena.live=false; this.arena.winFx(res.winner);
    const w=this.F[res.winner]; const ban=$('#banner');
    ban.hidden=false; ban.className='banner finish '+res.how+(res.winner===0?' c1':' c2');
    ban.innerHTML=`<small>${FINISH[res.how]}</small><b>${esc(w.name)}</b><span>+${pts} ${pts>1?'points':'point'}</span>`;
    BF.Sfx && BF.Sfx.finish(res.how);
    this.updateHud(null);
    const over=this.score[0]>=this.rules.target||this.score[1]>=this.rules.target;
    setTimeout(()=>{ if(over) this.matchEnd(); else { this.round++; this.nextRound(); } },2600);
  },
  matchEnd(){
    this.st='matchEnd'; const win=this.score[0]>this.score[1]?0:1; const ban=$('#banner'); ban.hidden=true;
    let line='';
    if(this.mode!=='local'){ const won=win===this.me; const rec=BF.Records.add(won,this.lastHow||'spin',this.F[this.me].name,this.mode==='online'); line=`<div class="record">${won?'Victory':'Defeat'} · record ${rec.wins}–${rec.losses}</div>`; BF.Ach && BF.Ach.check({won,how:this.lastHow,score:this.score,me:this.me,mode:this.mode,f:this.F[this.me]}); }
    this.panel.className='bpanel result';
    this.panel.innerHTML=`<div class="res-title ${win===0?'c1':'c2'}">${esc(this.F[win].name)} wins</div>
      <div class="res-score"><b class="c1">${this.score[0]}</b><span>–</span><b class="c2">${this.score[1]}</b></div>${line}
      <div class="res-acts">${this.mode==='online'&&BF.Net.role==='guest'?'<button class="btn primary" id="rematch">Ask for rematch</button>':'<button class="btn primary" id="rematch">Rematch</button>'}<button class="btn" id="backSetup">Change Beys</button></div>`;
    $('#rematch').onclick=()=>{ if(this.mode==='online'){ if(BF.Net.role==='host') this.hostStart(); else { BF.Net.send({t:'rematch'}); $('#rematch').textContent='Asked…'; } } else this.startMatch(this.match); };
    $('#backSetup').onclick=()=>this.renderSetup();
  },
  // ---------- HUD ----------
  hud(on){ $('#bhud').hidden=!on; if(on){ $('#n1').textContent=this.F[0].name; $('#n2').textContent=this.F[1].name; } },
  updateHud(snap){
    if(!this.F) return;
    [0,1].forEach(i=>{
      const pips=$('#pips'+(i+1)); const t=this.rules.target;
      pips.innerHTML=Array.from({length:t},(_,k)=>`<i class="${k<this.score[i]?'on':''}"></i>`).join('');
      if(snap){ const s=snap.b[i]; $('#s'+(i+1)).style.width=Math.max(0,Math.min(100,s[4]/s[5]*100))+'%'; }
      else $('#s'+(i+1)).style.width='100%';
    });
    $('#roundLbl').textContent='Round '+this.round;
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
        this.acc+=dt; const h=1/120;
        while(this.acc>=h && !this.sim.done){ this.sim.step(h); this.acc-=h; }
        const ev=this.sim.events.splice(0); ev.forEach(e=>this.fx(e)); if(this.mode==='online') this.evQ.push(...ev);
        snap=this.sim.snapshot();
        if(this.mode==='online'){ this.sendT-=dt; if(this.sendT<=0){ BF.Net.send({t:'s',s:snap,ev:this.evQ.splice(0)}); this.sendT=1/30; } }
        this.updateHud(snap);
        if(this.sim.done){ this.lastHow=this.sim.done.how; const res=this.sim.done; this.sim=null; if(this.mode==='online') BF.Net.send({t:'s',s:snap,ev:this.evQ.splice(0)}); setTimeout(()=>this.roundEnd(res),700); }
      } else if(this.netSnap){
        snap=this.netSnap;
        if(this.st==='fight'){ snap.b.forEach(s=>{ s[3]+= (s[4]||0)*dt*(s[3]>=0?1:-1)*0; }); this.updateHud(snap); if(snap.done) this.lastHow=snap.done.how; }
      }
      if(this.st==='fight' && this.mode==='online' && BF.Net.role==='guest' && snap){ this.guestAng=this.guestAng||[0,0]; snap.b.forEach((s,i)=>{ this.guestAng[i]+= (this.F[i].d.spin==='left'?1:-1)*s[4]*dt; s[3]=this.guestAng[i]; }); }
      this.arena.tickDebris(dt);
      this.arena.render(snap,dt);
    };
    requestAnimationFrame(frame);
  }
};
})();
