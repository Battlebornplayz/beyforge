/* BeyForge v6.7 — Beydex: browse every catalog part like a store page (card grid, badges, search, filters,
   sort, pagination), see what you own, and inspect any part in 3D with its gimmicks and where it drops. */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s), T=window.THREE;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RAR=['common','rare','epic','legendary','limited'], R=k=>BF.RARITY[k]||BF.RARITY.common;
const SLOT={blade:'Blade / Layer',core:'Ratchet / Disc',driver:'Bit / Driver'};
const SLOTN=(c)=>c.sys==='X'?{blade:'Blade',core:'Ratchet',driver:'Bit'}[c.slot]:{blade:'Layer',core:'Disc',driver:'Driver'}[c.slot];
const TYPE_IC={attack:'⚔',defense:'🛡',stamina:'⏱',balance:'⚖'};
const PER=24;

// ---------- part thumbnails (one shared offscreen renderer, rendered lazily, cached) ----------
const Thumb={ cache:{}, q:[], busy:false,
  get(id){ return this.cache[id]; },
  want(id,cb){ if(this.cache[id]) return cb(this.cache[id]); this.q.push([id,cb]); this.pump(); },
  pump(){ if(this.busy||!this.q.length) return; this.busy=true; const step=()=>{ const job=this.q.shift(); if(!job){ this.busy=false; return; }
      const [id,cb]=job; if(!this.cache[id]) try{ this.cache[id]=this.render(id); }catch(e){ console.warn('thumb',id,e); this.cache[id]=''; } cb(this.cache[id]);
      (window.requestIdleCallback||setTimeout)(step,8); }; step(); },
  r(){ if(this._r) return this._r; const r=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=1; r.setPixelRatio(1); r.setSize(256,192,false);
    const s=new T.Scene(); s.add(new T.HemisphereLight(0xcfe0ff,0x1a1030,.7)); const k=new T.DirectionalLight(0xffffff,1); k.position.set(60,-80,140); s.add(k); const c=new T.PointLight(0x2ef2ff,.6,600); c.position.set(-120,60,60); s.add(c);
    this._s=s; this._cam=new T.PerspectiveCamera(28,256/192,1,3000); this._cam.up.set(0,0,1); return this._r=r; },
  mesh(id,whole){ const c=BF.Catalog.get(id), d=BF.Catalog.design(id), asm=BF.build(d), main=asm.parts.filter(x=>x.id!=='chip');
    let pick=whole?asm.parts:[main[{blade:0,core:1,driver:2}[c.slot]]]; if(!whole&&c.slot==='blade') pick=pick.concat(asm.parts.filter(x=>x.id==='chip'));
    const g=new T.Group(); pick.forEach(part=>part.bodies.forEach(b=>{ const m=new T.Mesh(b.geo,BF.materialFor(d,part,b,{})); m.position.z=part.z0; g.add(m); }));
    const box=new T.Box3().setFromObject(g), ctr=box.getCenter(new T.Vector3()), sz=box.getSize(new T.Vector3()); g.children.forEach(m=>m.position.sub(ctr)); return {g,rad:Math.max(sz.x,sz.y,sz.z*1.2)/2}; },
  render(id){ const r=this.r(), {g,rad}=this.mesh(id); g.rotation.z=-0.5; this._s.add(g); const cam=this._cam, dist=rad*4.6; cam.position.set(dist*0.62,-dist*0.62,dist*0.62); cam.lookAt(0,0,0);
    r.setClearColor(0,0); r.render(this._s,cam); const url=r.domElement.toDataURL('image/png'); this._s.remove(g); return url; }
};
BF.DexThumb=Thumb;

// ---------- where a part can come from ----------
function sources(c){ const out=[]; (BF.Packs?BF.Packs.list():[]).forEach(p=>{ if(p.system&&p.system!==c.sys) return; const r=c.rarity==='limited'?'legendary':c.rarity; if(!(+p.odds[r]>0)) return;
    const same=BF.CATALOG.filter(x=>x.slot===c.slot&&(!p.system||x.sys===p.system)&&x.rarity===c.rarity).length||1, t=Object.values(p.odds).reduce((a,b)=>a+(+b||0),0)||1;
    const per=(+p.odds[r]/t)*(p.slots==='each'?1:1/3)/same*(p.system?1:c.sys==='X'?0.6:0.4), chance=1-Math.pow(1-per,p.slots==='each'?1:p.count);
    out.push({p,chance}); }); return out.sort((a,b)=>b.chance-a.chance); }
const statsOf=c=>{ c._f=c._f||BF.fighter(BF.Catalog.design(c.id)); const f=c._f; return {atk:Math.round(f.atk),def:Math.round(f.def),sta:Math.round(f.sta),brs:Math.round(f.brs),stb:Math.round(f.stb),mass:f.mp.mass}; };

const Dex=BF.Dex={
  q:'', sys:'', slot:'', rar:'', gim:'', own:'', sort:'rarity', page:0,
  list(){ const own=BF.Catalog.owned(), q=this.q.trim().toLowerCase();
    let L=BF.CATALOG.filter(c=>(!this.sys||c.sys===this.sys)&&(!this.slot||c.slot===this.slot)&&(!this.rar||c.rarity===this.rar)&&(!this.gim||(c.gims||[]).includes(this.gim))
      &&(!this.own||(this.own==='have'?own.has(c.id):!own.has(c.id)))&&(!q||(c.name+' '+c.type+' '+c.sys+' '+(c.gims||[]).map(g=>BF.GIMMICKS[g]?BF.GIMMICKS[g].label:g).join(' ')).toLowerCase().includes(q)));
    const st=k=>statsOf(k);
    const S={rarity:(a,b)=>RAR.indexOf(b.rarity)-RAR.indexOf(a.rarity)||a.name.localeCompare(b.name), name:(a,b)=>a.name.localeCompare(b.name),
      attack:(a,b)=>st(b).atk-st(a).atk, defense:(a,b)=>st(b).def-st(a).def, stamina:(a,b)=>st(b).sta-st(a).sta, owned:(a,b)=>(own.get(b.id)||0)-(own.get(a.id)||0)}[this.sort];
    return L.sort(S); },
  render(root){
    root=root||$('#dexRoot'); if(!root) return; const own=BF.Catalog.owned(), all=BF.Catalog.progress(), px=BF.Catalog.progress('X'), pb=BF.Catalog.progress('Burst');
    const L=this.list(), pages=Math.max(1,Math.ceil(L.length/PER)); this.page=Math.min(this.page,pages-1); const vis=L.slice(this.page*PER,this.page*PER+PER);
    const sel=(k,label,opts)=>`<label class="dx-sel"><span>${label}</span><select data-k="${k}">${Object.entries(opts).map(([v,l])=>`<option value="${v}"${String(this[k])===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
    root.innerHTML=`
      <div class="dx-top"><div class="dx-prog"><div><b>Beydex</b><span>${all.have}/${all.total} collected · ${Math.round(all.have/all.total*100)}%</span></div><i><u style="width:${all.have/all.total*100}%"></u></i>
          <div class="dx-sub"><span>X ${px.have}/${px.total}</span><span>Burst ${pb.have}/${pb.total}</span></div></div>
        <div class="dx-search"><svg viewBox="0 0 24 24" width="18"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="dxQ" placeholder="Search ${BF.CATALOG.length} parts — names, gimmicks, types…" value="${esc(this.q)}" autocomplete="off"></div></div>
      <div class="dx-filters">
        <div class="dx-seg">${[['','All'],['X','X'],['Burst','Burst']].map(([v,l])=>`<button type="button" data-sys="${v}" class="${this.sys===v?'on':''}">${l}</button>`).join('')}</div>
        ${sel('slot','Part',{'':'Any part',blade:'Blades / Layers',core:'Ratchets / Discs',driver:'Bits / Drivers'})}
        ${sel('rar','Rarity',{'':'Any rarity',common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary'})}
        ${sel('gim','Gimmick',Object.assign({'':'Any gimmick'},Object.fromEntries(Object.entries(BF.GIMMICKS).map(([k,g])=>[k,g.icon+' '+g.label]))))}
        ${sel('own','Owned',{'':'Owned + missing',have:'Owned',miss:'Missing'})}
        ${sel('sort','Sort',{rarity:'Rarity',name:'Name',attack:'Attack',defense:'Defense',stamina:'Stamina',owned:'Most owned'})}
        <span class="dx-count">${L.length} result${L.length===1?'':'s'}</span></div>
      <div class="dx-grid">${vis.map(c=>{ const n=own.get(c.id)||0, s=statsOf(c), img=Thumb.get(c.id);
        return `<article class="dx-card r-${c.rarity}${n?' own':''}" data-id="${c.id}" tabindex="0" style="--rc:${R(c.rarity).color}">
          <div class="dx-img">${img?`<img src="${img}" alt="">`:'<i class="dx-load"></i>'}
            <div class="dx-tl"><span class="dx-b rar">${R(c.rarity).label}</span><span class="dx-b sys ${c.sys==='X'?'x':'b'}">${c.sys==='X'?'X':'BURST'}</span>${c.style&&c.style!=='single'?`<span class="dx-b gen">${esc(BF.LAYER_STYLES[c.style].label)}</span>`:''}</div>
            <div class="dx-tr">${n?`<span class="dx-b ok">✓ Owned${n>1?' ×'+n:''}</span>`:'<span class="dx-b miss">Not owned</span>'}</div>
            ${(c.gims||[]).length?`<div class="dx-bl">${c.gims.filter(g=>BF.GIMMICKS[g]).map(g=>`<span class="dx-gim" title="${esc(BF.GIMMICKS[g].label)}">${BF.GIMMICKS[g].icon}</span>`).join('')}</div>`:''}</div>
          <div class="dx-body"><b>${esc(c.name)}</b><span class="dx-sub2">${TYPE_IC[c.type]||''} ${esc(c.type[0].toUpperCase()+c.type.slice(1))} · ${esc(SLOTN(c))}</span>
            <div class="dx-stats"><span title="Attack">⚔ ${s.atk}</span><span title="Defense">🛡 ${s.def}</span><span title="Stamina">⏱ ${s.sta}</span><span title="Weight">⚖ ${s.mass.toFixed(1)}g</span></div></div></article>`; }).join('')||'<div class="dx-empty">No parts match those filters.</div>'}</div>
      <div class="dx-pages">${pages>1?`<button type="button" data-pg="${this.page-1}"${this.page?'':' disabled'}>‹</button>${Array.from({length:pages},(_,i)=>i).filter(i=>i===0||i===pages-1||Math.abs(i-this.page)<=2).map((i,k,a)=>`${k&&i-a[k-1]>1?'<em>…</em>':''}<button type="button" data-pg="${i}" class="${i===this.page?'on':''}">${i+1}</button>`).join('')}<button type="button" data-pg="${this.page+1}"${this.page<pages-1?'':' disabled'}>›</button>`:''}</div>`;
    // wiring
    let tm; const qi=root.querySelector('#dxQ'); qi.oninput=()=>{ clearTimeout(tm); tm=setTimeout(()=>{ this.q=qi.value; this.page=0; this.render(root); const n=root.querySelector('#dxQ'); n.focus(); n.setSelectionRange(n.value.length,n.value.length); },220); };
    root.querySelectorAll('[data-sys]').forEach(b=>b.onclick=()=>{ this.sys=b.dataset.sys; this.page=0; this.render(root); });
    root.querySelectorAll('select[data-k]').forEach(s=>s.onchange=()=>{ this[s.dataset.k]=s.value; this.page=0; this.render(root); });
    root.querySelectorAll('[data-pg]').forEach(b=>b.onclick=()=>{ this.page=+b.dataset.pg; this.render(root); root.scrollIntoView({block:'start',behavior:'smooth'}); });
    root.querySelectorAll('.dx-card').forEach(el=>{ el.onclick=()=>this.detail(el.dataset.id); el.onkeydown=e=>{ if(e.key==='Enter') this.detail(el.dataset.id); };
      if(!Thumb.get(el.dataset.id)) Thumb.want(el.dataset.id,url=>{ const box=el.querySelector('.dx-img'); const ld=box&&box.querySelector('.dx-load'); if(ld&&url){ const im=new Image(); im.src=url; im.alt=''; ld.replaceWith(im); } }); });
  },
  // ---------- part page ----------
  detail(id){
    const c=BF.Catalog.get(id); if(!c) return; const m=$('#partModal'), b=$('#partBody'); m.hidden=false; const s=statsOf(c), own=BF.Parts?BF.Parts.list.filter(p=>p.catId===id):[], src=sources(c);
    const d=BF.Catalog.design(id), el=BF.ELEMENTS&&BF.ELEMENTS[BF.partElements(d)[c.slot]];
    const bar=(l,v,ic)=>`<div class="dx-bar"><span>${ic} ${l}</span><i><u style="width:${Math.min(100,v)}%"></u></i><b>${v}</b></div>`;
    b.innerHTML=`<div class="modal-head"><h3>${esc(c.name)}</h3><button class="icon-x big" data-x>×</button></div>
      <div class="dx-detail" style="--rc:${R(c.rarity).color}"><div class="dx-3d"><canvas></canvas><div class="dx-tl"><span class="dx-b rar">${R(c.rarity).label}</span><span class="dx-b sys ${c.sys==='X'?'x':'b'}">${c.sys==='X'?'X':'BURST'}</span>${c.style&&c.style!=='single'?`<span class="dx-b gen">${esc(BF.LAYER_STYLES[c.style].label)} generation</span>`:''}</div>
          <label class="dx-whole"><input type="checkbox" id="dxWhole"> Show on a full Bey</label></div>
        <div class="dx-info"><p class="dim">${TYPE_IC[c.type]||''} ${esc(c.type[0].toUpperCase()+c.type.slice(1))} ${esc(SLOTN(c))}${el?` · ${el.icon} ${el.label}`:''} · ${s.mass.toFixed(1)} g Bey</p>
          ${bar('Attack',s.atk,'⚔')}${bar('Defense',s.def,'🛡')}${bar('Stamina',s.sta,'⏱')}${bar('Burst res.',s.brs,'💥')}${bar('Stability',s.stb,'⚖')}
          ${(c.gims||[]).filter(g=>BF.GIMMICKS[g]).length?`<h4>Gimmicks</h4>${c.gims.filter(g=>BF.GIMMICKS[g]).map(g=>`<div class="dx-gimrow"><i>${BF.GIMMICKS[g].icon}</i><div><b>${esc(BF.GIMMICKS[g].label)}</b><span>${esc(BF.GIMMICKS[g].desc)}</span></div></div>`).join('')}`:''}
          <h4>Where to get it</h4>${src.length?src.slice(0,4).map(x=>`<div class="dx-src"><img src="${BF.PackModel.thumb(x.p,60)}" alt=""><b>${esc(x.p.name)}</b><span>~${x.chance<0.001?'<0.1':(x.chance*100).toFixed(1)}% per pack</span></div>`).join(''):'<p class="dim">Event-only part.</p>'}
          <h4>Your copies</h4>${own.length?own.map(p=>`<button type="button" class="dx-own" data-pid="${p.id}">${p.shiny?'✨ ':''}Lv ${BF.partLevel(p.xp).lv} · IV ${Math.round(Object.values(p.iv).reduce((a,b)=>a+b,0)/155*100)}%</button>`).join(''):'<p class="dim">You don’t own this one yet.</p>'}</div></div>`;
    // live 3D
    const cv=b.querySelector('canvas'), r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
    const sc=new T.Scene(); sc.add(new T.HemisphereLight(0xcfe0ff,0x1a1030,.7)); const k=new T.DirectionalLight(0xffffff,1); k.position.set(60,-80,140); sc.add(k); const pl=new T.PointLight(new T.Color(R(c.rarity).color),1,600); pl.position.set(-100,60,40); sc.add(pl);
    const cam=new T.PerspectiveCamera(30,1,1,3000); cam.up.set(0,0,1); let obj=null, on=true, rad=20, yaw=0;
    const set=whole=>{ if(obj) sc.remove(obj); const o=Thumb.mesh(id,whole); obj=new T.Group(); obj.add(o.g); sc.add(obj); rad=o.rad; };
    set(false); b.querySelector('#dxWhole').onchange=e=>set(e.target.checked);
    const loop=()=>{ if(!on) return; requestAnimationFrame(loop); const w=cv.clientWidth||300,h=cv.clientHeight||260; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); yaw+=0.01; const dd=rad*4.4;
      cam.position.set(Math.cos(yaw)*dd*0.8,Math.sin(yaw)*dd*0.8,dd*0.55); cam.lookAt(0,0,0); if(obj) obj.children[0].rotation.z-=0.05; r.render(sc,cam); }; loop();
    const close=()=>{ on=false; r.dispose(); r.forceContextLoss(); m.hidden=true; };
    b.querySelector('[data-x]').onclick=close; m.onclick=e=>{ if(e.target===m) close(); };
    b.querySelectorAll('[data-pid]').forEach(x=>x.onclick=()=>{ close(); BF.PartsUI&&BF.PartsUI.detail(x.dataset.pid); });
  }
};
})();
