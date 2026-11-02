/* BeyForge — app controller */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const App = BF.App = {
  d: BF.normalize(BF.LS.get('bf.current',null)) ,
  hist:[], fut:[], lastPush:0, asm:null, mp:null, an:null, t:null,
  ex: Object.assign({stl:true,threemf:true,perPart:true,plate:false,split:true}, BF.LS.get('bf.export',{})),
  init(){
    this.d=BF.normalize(this.d); BF.syncColors(this.d);
    this.viewer=new BF.Viewer($('#viewport'));
    // tap a part on the 3D model to jump to its controls
    this.viewer.onPick=(id,role)=>{ const pro=BF.Settings.get('mode')==='pro';
      let tab = (role==='accent'||role==='horn'||id==='chip') ? (pro?'extras':'paint') : (id==='blade'||id==='layer') ? 'blade' : (id==='ratchet'||id==='disc') ? (pro?'core':'paint') : 'bit';
      if(BF.UI.tab==='paint'){ BF.UI.paintPart = role==='accent'?'accent':role==='horn'?'horn':role==='tip'?'tip':{blade:'blade',layer:'blade',ratchet:'ratchet',disc:'disc',bit:'bit',driver:'bit',chip:'chip'}[id]; tab='paint'; }
      BF.UI.focusTab(tab); this.toast('Editing '+(role==='tip'?'tip':role==='accent'?'accents':role==='horn'?'horns':id)); };
    BF.Settings.on(k=>{ if(k==='preview'||k==='*'){ BF.clearPaintCache(); this.refreshPaint(); this.renderControls(); }
      if(k==='quality'||k==='shadows'||k==='*') this.viewer.applyQuality();
      if(k==='autoSpin'){ this.viewer.setSpin(BF.Settings.get('autoSpin')); document.querySelector('[data-tool=spin]').classList.toggle('on',BF.Settings.get('autoSpin')); }
      if(k==='mode'||k==='printChecks'||k==='*'){ this.renderControls(); this.renderSheet&&this.asm&&this.renderSheet(); } });
    $('#settingsBtn').addEventListener('click',()=>BF.Settings.open());
    document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>{ document.getElementById(b.dataset.close).hidden=true; }));
    this.renderControls(); this.rebuild();
    this.bindToolbar(); this.bindTabs(); this.bindKeys(); this.bindFolder(); this.bindModal();
    const mb=$('#muteBtn'); const pm=()=>mb.classList.toggle('muted',BF.Sfx.muted); pm(); mb.addEventListener('click',()=>{ BF.Sfx.toggle(); pm(); });
    BF.Store.init();
    BF.Social.init(); BF.Account.init();
    $('#annX').addEventListener('click',()=>{ $('#announce').hidden=true; BF.LS.set('bf.announceSeen',this._ann||''); });
    this.logo();
  },
  announce(text){ this._ann=text; $('#annMsg').textContent=text; $('#announce').hidden=false; },
  toast(msg,kind){ const t=$('#toast'); t.textContent=msg; t.className='toast show '+(kind||''); clearTimeout(this._tt); this._tt=setTimeout(()=>t.className='toast',2600); },
  snapshot(){ return JSON.stringify(this.d); },
  push(){ const now=performance.now(); if(now-this.lastPush>700){ this.hist.push(this.snapshot()); if(this.hist.length>80) this.hist.shift(); this.fut=[]; } this.lastPush=now; },
  undo(){ if(!this.hist.length) return; this.fut.push(this.snapshot()); this.d=JSON.parse(this.hist.pop()); this.lastPush=0; this.renderControls(); this.rebuild(); this.toast('Undone'); },
  redo(){ if(!this.fut.length) return; this.hist.push(this.snapshot()); this.d=JSON.parse(this.fut.pop()); this.lastPush=0; this.renderControls(); this.rebuild(); this.toast('Redone'); },
  change(path,v,o){
    o=o||{}; this.push();
    const prevSys=this.d.system;
    BF.set(this.d,path,v);
    if(path==='system' && v!==prevSys){ this.d.blade.diameter = v==='X'?46:48; this.d.blade.height = v==='X'?10:12; this.viewer.framed=false; if(this.viewer.state.stadium) this.viewer.setStadium(true,v); }
    if(path==='bit.tip' && BF.TIPS[v].rubber) this.d.bit.tipMaterial='TPU';
    if(path==='weights.insert' && v!=='none' && !this.d.weights.count) this.d.weights.count=3;
    BF.syncColors(this.d);
    if(o.re) this.renderControls();
    // paint and cosmetics don't change the shape: just refresh materials (instant)
    if(path.startsWith('paint.')||path.startsWith('cos.')){ clearTimeout(this.pt); this.pt=setTimeout(()=>this.refreshPaint(),o.commit?0:30); BF.LS.set('bf.current',this.d); return; }
    this.schedule(o.commit?0:40);
  },
  refreshPaint(){ if(!this.asm) return; this.viewer.setAssembly(this.asm); if(BF.BattleUI&&BF.BattleUI.arena&&BF.BattleUI.st==='setup') BF.BattleUI.previewArena(); },
  applyTheme(id){ this.push(); this.d=BF.applyTheme(this.d,id); this.viewer.framed=false; this.renderControls(); this.rebuild(); const t=BF.THEMES.find(x=>x.id===id); this.toast(t.name+' theme applied'); },
  schedule(ms){ clearTimeout(this.t); this.t=setTimeout(()=>this.rebuild(),ms); },
  renderControls(){ BF.UI.render($('#controls'),this.d,(k,v,o)=>this.change(k,v,o)); },
  rebuild(){
    try{
      const t0=performance.now();
      const asm=BF.build(this.d);
      if(this.asm) this.asm.parts.forEach(p=>p.bodies.forEach(b=>{})); // geometries disposed by viewer.clear
      this.viewer.setAssembly(asm);
      this.asm=asm; this.mp=BF.massProps(asm); this.an=BF.analyze(asm,this.mp);
      this.renderSheet();
      $('#hudName').textContent=BF.naming(this.d,this.an.type).full;
      $('#buildTime').textContent=`${(performance.now()-t0).toFixed(0)} ms`;
      BF.LS.set('bf.current',this.d);
    }catch(e){ console.error(e); this.toast('That combo broke the geometry — undo with Ctrl+Z','bad'); }
  },
  renderSheet(){
    BF.UI.sheet($('#sheet'),this.d,this.asm,this.mp,{
      an:this.an, exportOpts:this.ex,
      toggleEx:k=>{ const e=this.ex; e[k]=!e[k]; if(!e.stl&&!e.threemf) e[k==='stl'?'threemf':'stl']=true; if(!e.perPart&&!e.plate) e[k==='perPart'?'plate':'perPart']=true; BF.LS.set('bf.export',e); this.renderSheet(); },
      export:b=>this.exportFiles(b),
      prompt:()=>this.showPrompt(),
      reroll:()=>{ this.push(); this.d.nameSeed=Math.floor(Math.random()*99999); this.rebuild(); },
      rename:()=>{ this.push(); if(this.d.nameMode==='auto'){ this.d.nameMode='manual'; this.d.name=BF.naming(this.d).auto; } else this.d.nameMode='auto'; this.rebuild(); },
      setName:v=>{ this.push(); this.d.name=v.trim().slice(0,28); this.rebuild(); },
      save:()=>this.save(),
      random:()=>{ this.push(); this.d=BF.randomDesign(); this.viewer.framed=false; this.renderControls(); this.rebuild(); this.toast('Rolled a new Bey'); },
      preset:id=>{ const p=BF.PRESETS.find(x=>x.id===id); this.push(); this.d=BF.fromPreset(p); this.viewer.framed=false; if(this.viewer.state.stadium) this.viewer.setStadium(true,this.d.system); this.renderControls(); this.rebuild(); this.toast('Loaded '+p.name); }
    });
  },
  async save(){
    const meta=BF.naming(this.d,this.an&&this.an.type); const thumb=this.viewer.snapshot(256);
    try{ await BF.Store.saveDesign(this.d,{name:meta.name,code:meta.code,full:meta.full,type:meta.type,system:this.d.system,mass:+this.mp.mass.toFixed(1)},thumb);
      BF.LS.set('bf.current',this.d);
      this.toast(BF.Store.status==='connected'?`Saved to ${BF.Store.dir.name}\\designs`:'Saved in this browser — connect your folder to save to O:','good');
    }catch(e){ console.error(e); this.toast('Save failed: '+e.message,'bad'); }
  },
  async exportFiles(btn){
    const label=btn.textContent; btn.disabled=true; btn.textContent='Building files…';
    try{
      await new Promise(r=>setTimeout(r,30));
      const res=await BF.buildExport(this.asm,this.ex);
      const out=await BF.saveExport(res);
      this.toast(`Exported ${out.count} files → ${out.where}`,'good');
    }catch(e){ console.error(e); this.toast('Export failed: '+e.message,'bad'); }
    btn.disabled=false; btn.textContent=label;
  },
  showPrompt(){
    const m=$('#promptModal'), ta=$('#promptText'); ta.value=BF.claudePrompt(this.asm,this.an); m.hidden=false; ta.scrollTop=0;
    $('#promptLen').textContent=`${ta.value.length.toLocaleString()} characters`;
  },
  bindModal(){
    const m=$('#promptModal'), ta=$('#promptText');
    $('#closePrompt').addEventListener('click',()=>m.hidden=true);
    m.addEventListener('click',e=>{ if(e.target===m) m.hidden=true; });
    document.addEventListener('keydown',e=>{ if(e.key==='Escape') m.hidden=true; });
    $('#copyPrompt').addEventListener('click',async()=>{ try{ await navigator.clipboard.writeText(ta.value); this.toast('Prompt copied — paste it into a Claude chat','good'); }catch(e){ ta.select(); document.execCommand('copy'); this.toast('Prompt copied','good'); } });
    $('#savePrompt').addEventListener('click',async()=>{
      const slug=BF.Store.slug(BF.naming(this.d,this.an.type).full);
      if(BF.Store.status==='connected'){ await BF.Store.write(`exports/${slug}/${slug}_claude-prompt.txt`,ta.value); this.toast(`Saved to ${BF.Store.dir.name}\\exports\\${slug}`,'good'); }
      else { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([ta.value],{type:'text/plain'})); a.download=slug+'_claude-prompt.txt'; a.click(); }
    });
  },
  bindToolbar(){
    const v=this.viewer;
    document.querySelectorAll('.toolbar [data-tool]').forEach(b=>b.addEventListener('click',()=>{
      const k=b.dataset.tool;
      if(k==='spin'){ v.setSpin(!v.state.spin); b.classList.toggle('on',v.state.spin); }
      if(k==='explode'){ v.setExplode(v.state.explode<0.5); b.classList.toggle('on',v.state.explode>0.5); }
      if(k==='section'){ v.setSection(!v.state.section); b.classList.toggle('on',v.state.section); }
      if(k==='stadium'){ v.setStadium(!v.state.stadium,this.d.system); b.classList.toggle('on',v.state.stadium); }
      if(k==='top') v.topView();
      if(k==='reset') v.frame(v.state.stadium);
    }));
  },
  bindTabs(){
    document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));
      document.querySelectorAll('.view').forEach(v=>v.hidden=v.id!=='view-'+b.dataset.tab);
      if(b.dataset.tab==='library') this.renderLibrary();
      if(b.dataset.tab==='forge') this.viewer.resize();
      if(b.dataset.tab==='profile') BF.Social.render();
      if(b.dataset.tab==='battle'){ if(!BF.BattleUI.arena) BF.BattleUI.init(); BF.BattleUI.show(); }
    }));
  },
  bindKeys(){
    document.addEventListener('keydown',e=>{
      if(e.target.matches('input[type=text],input[type=number],select')) return;
      if(!$('#view-forge').hidden===false) return;
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); e.shiftKey?this.redo():this.undo(); }
      else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); this.redo(); }
      else if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s'){ e.preventDefault(); this.save(); }
      else if(e.key===' ' && !e.target.matches('button')){ e.preventDefault(); document.querySelector('[data-tool=spin]').click(); }
      else if(e.key.toLowerCase()==='e' && !e.ctrlKey) document.querySelector('[data-tool=explode]').click();
    });
  },
  bindFolder(){
    const btn=$('#folderBtn');
    const paint=st=>{
      btn.className='folder-btn '+st;
      btn.innerHTML = st==='connected' ? `<i></i>${esc(BF.Store.dir.name)}` : st==='needs-permission' ? '<i></i>Reconnect folder' : st==='unsupported' ? '<i></i>Browser storage only' : '<i></i>Connect O:\\BeyForge';
      btn.title = st==='connected' ? 'Designs, exports and cards save here' : st==='unsupported' ? 'This browser can’t write to folders. Use Opera GX, Chrome or Edge.' : 'Pick the O:\\BeyForge folder once — everything saves there';
    };
    BF.Store.on(st=>{ paint(st); if(this.asm) this.renderSheet(); if(!$('#view-library').hidden) this.renderLibrary(); });
    paint('none');
    btn.addEventListener('click',async()=>{ if(BF.Store.status==='unsupported'){ this.toast('This browser can’t write to folders — designs stay in browser storage'); return; } const ok=await BF.Store.connect(); if(ok) this.toast('Connected to '+BF.Store.dir.name,'good'); });
  },
  async renderLibrary(){
    const root=$('#libGrid'); root.innerHTML='<div class="empty">Loading…</div>';
    const recs=await BF.Store.loadLibrary();
    $('#libWhere').textContent = BF.Store.status==='connected' ? `${BF.Store.dir.name}\\designs · ${recs.length} saved` : `Browser storage · ${recs.length} saved — connect your folder to keep them on O:`;
    if(!recs.length){ root.innerHTML='<div class="empty"><b>No saved Beys yet.</b><span>Build one in the Forge and hit “Save to library”, or press Ctrl+S.</span></div>'; return; }
    root.innerHTML='';
    recs.forEach(r=>{
      const c=document.createElement('div'); c.className='libcard';
      c.innerHTML=`<div class="lib-img">${r.thumb?`<img alt="" src="${r.thumb}">`:''}</div>
        <div class="lib-meta"><span class="lib-type t-${esc(r.meta.type)}">${esc(r.meta.type)}</span><b>${esc(r.meta.name)}</b><span class="mono">${esc(r.meta.code)}</span><span class="dim">${esc(r.meta.system==='X'?'Beyblade X':'Burst')} · ${r.meta.mass} g · ${new Date(r.saved).toLocaleDateString()}</span></div>
        <div class="lib-acts"><button class="btn primary" data-a="load">Open in Forge</button><button class="btn ghost" data-a="del">Delete</button></div>`;
      c.querySelector('[data-a=load]').addEventListener('click',()=>{ this.push(); this.d=BF.normalize(BF.clone(r.design)); this.viewer.framed=false; this.renderControls(); this.rebuild(); document.querySelector('#tabs [data-tab=forge]').click(); this.toast('Opened '+r.meta.name); });
      const del=c.querySelector('[data-a=del]');
      del.addEventListener('click',async()=>{ if(!del.classList.contains('confirm')){ del.classList.add('confirm'); del.textContent='Tap again to delete'; setTimeout(()=>{ del.classList.remove('confirm'); del.textContent='Delete'; },3000); return; } await BF.Store.deleteDesign(r); this.renderLibrary(); });
      root.appendChild(c);
    });
  },
  logo(){
    const c=$('#logoSpin'), x=c.getContext('2d'); let a=0;
    const f=()=>{ a-=0.12; x.clearRect(0,0,34,34); x.save(); x.translate(17,17); x.rotate(a);
      x.beginPath(); for(let i=0;i<=90;i++){ const t=i/90*Math.PI*2; const u=((t%(Math.PI*2/3))/(Math.PI*2/3)); const r=8+7*(u<0.12?u/0.12:Math.pow(1-(u-0.12)/0.88,1.3)); i?x.lineTo(r*Math.cos(t),r*Math.sin(t)):x.moveTo(r*Math.cos(t),r*Math.sin(t)); }
      x.closePath(); x.fillStyle='#2ef2ff'; x.shadowColor='#2ef2ff'; x.shadowBlur=8; x.fill(); x.shadowBlur=0;
      x.beginPath(); x.arc(0,0,4,0,Math.PI*2); x.fillStyle='#08070f'; x.fill(); x.restore(); requestAnimationFrame(f); };
    f();
  }
};
window.addEventListener('DOMContentLoaded',()=>App.init());
})();
