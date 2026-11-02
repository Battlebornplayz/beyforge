/* BeyForge v6.8 — Beydex: every catalog part, in four switchable layouts (Store grid is the default):
     grid    store-style cards with search, filters, sort and pages
     binder  numbered slots grouped into sets, with set and completion rewards
     locker  filter rail + compact grid + always-open inspector with live 3D
     show    one big live 3D part at a time with a rail to flip through
   Parts you don't own show as a black silhouette with their name: stats and gimmicks stay hidden until you pull one.
   Rewards and the default layout are tunable from BeyForge Studio (config/economy → dex). */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s), T=window.THREE;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const RAR=['common','rare','epic','legendary','limited'], R=k=>BF.RARITY[k]||BF.RARITY.common;
const SLOTN=c=>c.sys==='X'?{blade:'Blade',core:'Ratchet',driver:'Bit'}[c.slot]:{blade:'Layer',core:'Disc',driver:'Driver'}[c.slot];
const SETS=[['X','blade','X Blades'],['X','core','X Ratchets'],['X','driver','X Bits'],['Burst','blade','Burst Layers'],['Burst','core','Burst Discs'],['Burst','driver','Burst Drivers']];
const setKey=(sys,slot)=>sys+'_'+slot;
const cap=s=>s[0].toUpperCase()+s.slice(1);
const PER=24, VKEY='bf.dexView';
const ICON={
  grid:'<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
  binder:'<path d="M6 3h13v18H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h7M9 12h7"/>',
  locker:'<path d="M3 4h5v16H3zM10 4h5v7h-5zM10 13h5v7h-5zM17 4h4v16h-4z"/>',
  show:'<ellipse cx="12" cy="17" rx="8" ry="3"/><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>'
};
const VIEWS=[['grid','Store'],['binder','Binder'],['locker','Locker'],['show','Showroom']];
const svg=k=>`<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICON[k]}</svg>`;
const econ=()=>(BF.Econ&&BF.Econ.get('dex'))||{on:false,defaultView:'grid',sets:{},milestones:[]};
const store={ get(){ try{ return localStorage.getItem(VKEY); }catch(e){ return null; } }, set(v){ try{ localStorage.setItem(VKEY,v); }catch(e){} } };
const calm=()=>document.documentElement.classList.contains('reduce-motion');
const phone=()=>window.matchMedia&&matchMedia('(max-width:760px)').matches;

// stable Beydex numbers: set by set, rarest first
let NO=null;
const numberOf=c=>{ if(!NO){ NO={}; let n=0; SETS.forEach(([sys,slot])=>setParts(sys,slot).forEach(x=>{ NO[x.id]=String(++n).padStart(3,'0'); })); } return NO[c.id]; };
function setParts(sys,slot){ return BF.CATALOG.filter(c=>c.sys===sys&&c.slot===slot).sort((a,b)=>RAR.indexOf(b.rarity)-RAR.indexOf(a.rarity)||a.name.localeCompare(b.name)); }

// ---------- 3D helpers ----------
function lights(s,rim,rimI){ s.add(new T.HemisphereLight(0xcfe0ff,0x1a1030,.42)); const k=new T.DirectionalLight(0xffffff,.72); k.position.set(60,-80,140); s.add(k); const c=new T.PointLight(rim,rimI,600); c.position.set(-120,60,60); s.add(c); }
function freeGroup(g){ g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material&&o.material.dispose) o.material.dispose(); }); }
function partMesh(id,whole){ const c=BF.Catalog.get(id), d=BF.Catalog.design(id), asm=BF.build(d), main=asm.parts.filter(x=>x.id!=='chip');
  let pick=whole?asm.parts:[main[{blade:0,core:1,driver:2}[c.slot]]]; if(!whole&&c.slot==='blade') pick=pick.concat(asm.parts.filter(x=>x.id==='chip'));
  const g=new T.Group(); pick.forEach(part=>part.bodies.forEach(b=>{ const m=new T.Mesh(b.geo,BF.materialFor(d,part,b,{})); m.position.z=part.z0; g.add(m); }));
  const box=new T.Box3().setFromObject(g), ctr=box.getCenter(new T.Vector3()), sz=box.getSize(new T.Vector3()); g.children.forEach(m=>m.position.sub(ctr));
  return {g,rad:Math.max(sz.x,sz.y,sz.z*1.2)/2}; }
// bits and drivers are seen side-on from slightly below, because their tip is the part that matters
const camFor=(c,dist,whole)=>(c.slot==='driver'&&!whole)?[dist*.72,-dist*.72,-dist*.22]:[dist*.62,-dist*.62,dist*.62];

// part thumbnails: one shared offscreen renderer, rendered lazily, newest request first, cached for the session
const Thumb={ cache:{}, q:[], busy:false, W:320, H:240,
  get(id){ return this.cache[id]; },
  want(id,cb){ if(this.cache[id]!==undefined) return cb(this.cache[id]); this.q.push([id,cb]); this.pump(); },
  pump(){ if(this.busy||!this.q.length) return; this.busy=true; const step=()=>{ const job=this.q.pop(); if(!job){ this.busy=false; return; }
      const [id,cb]=job; if(this.cache[id]===undefined){ try{ this.cache[id]=this.render(id); }catch(e){ console.warn('thumb',id,e); this.cache[id]=''; } } cb(this.cache[id]);
      (window.requestIdleCallback?requestIdleCallback(step,{timeout:120}):setTimeout(step,8)); }; step(); },
  r(){ if(this._r) return this._r; const r=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=.82; r.setPixelRatio(1); r.setSize(this.W,this.H,false);
    const s=new T.Scene(); lights(s,0x2ef2ff,.35); this._s=s; this._cam=new T.PerspectiveCamera(28,this.W/this.H,1,3000); this._cam.up.set(0,0,1); return this._r=r; },
  render(id){ const r=this.r(), c=BF.Catalog.get(id), {g,rad}=partMesh(id); g.rotation.z=-0.5; this._s.add(g); const cam=this._cam; cam.position.set(...camFor(c,rad*4.6)); cam.lookAt(0,0,0);
    r.setClearColor(0,0); r.render(this._s,cam); const url=r.domElement.toDataURL('image/png'); this._s.remove(g); freeGroup(g); return url; }
};
BF.DexThumb=Thumb;

// a live, spinning part on a canvas. Missing parts render as a pure black shape; CSS adds the outline.
function live(cv,id,opt){ opt=opt||{}; const c=BF.Catalog.get(id); let r;
  try{ r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true}); }catch(e){ return {set(){},kill(){}}; }
  r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=.82; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
  const sc=new T.Scene(); lights(sc,new T.Color(R(c.rarity).color),.8); if(opt.missing) sc.overrideMaterial=new T.MeshBasicMaterial({color:0x000000});
  const cam=new T.PerspectiveCamera(30,1,1,3000); cam.up.set(0,0,1); let obj=null,on=true,rad=20,whole=false,yaw=0,drag=null;
  const set=w=>{ if(obj){ sc.remove(obj); freeGroup(obj); } whole=!!w; const o=partMesh(id,whole); obj=o.g; sc.add(obj); rad=o.rad; }; set(false);
  if(opt.drag!==false){ cv.style.touchAction='none'; cv.onpointerdown=e=>{ drag=e.clientX; try{ cv.setPointerCapture(e.pointerId); }catch(x){} }; cv.onpointermove=e=>{ if(drag==null) return; obj.rotation.z+=(e.clientX-drag)*.012; drag=e.clientX; }; cv.onpointerup=cv.onpointercancel=()=>{ drag=null; }; }
  const kill=()=>{ if(!on) return; on=false; if(obj) freeGroup(obj); r.dispose(); try{ r.forceContextLoss(); }catch(e){} };
  const loop=()=>{ if(!on) return; requestAnimationFrame(loop); if(!cv.isConnected) return kill(); if(!cv.offsetParent) return; const m=$('#partModal'); if(!opt.modal&&m&&!m.hidden) return;
    const w=cv.clientWidth||300,h=cv.clientHeight||260; if(cv.width!==Math.floor(w*r.getPixelRatio())||cv.height!==Math.floor(h*r.getPixelRatio())) r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
    if(drag==null&&!calm()) obj.rotation.z-=.012; const p=camFor(c,rad*(opt.dist||4.4),whole); cam.position.set(p[0]+yaw,p[1],p[2]); cam.lookAt(0,0,0); r.render(sc,cam); };
  loop(); return {set,kill}; }

// ---------- part facts ----------
// measuring a part runs the full physics analysis (slow), so results are saved per device and filled in the background. Bump SKEY when physics or the catalog change.
const SKEY='bf.dexStats.v68';
const Stat={ mem:null, load(){ if(!this.mem){ try{ this.mem=JSON.parse(localStorage.getItem(SKEY))||{}; }catch(e){ this.mem={}; } } return this.mem; },
  has(c){ return !!this.load()[c.id]; },
  get(c){ const m=this.load(); if(!m[c.id]){ const f=BF.fighter(BF.Catalog.design(c.id)); m[c.id]={atk:Math.round(f.atk),def:Math.round(f.def),sta:Math.round(f.sta),brs:Math.round(f.brs),stb:Math.round(f.stb)}; this.save(); } return m[c.id]; },
  save(){ clearTimeout(this._t); this._t=setTimeout(()=>{ try{ localStorage.setItem(SKEY,JSON.stringify(this.mem)); }catch(e){} },800); },
  warm(root){ const seen=new Set(), first=[...root.querySelectorAll('[data-stat]')].map(e=>e.dataset.stat); this.todo=first.concat(BF.CATALOG.map(c=>c.id)).filter(id=>{ if(seen.has(id)||this.load()[id]) return false; seen.add(id); return true; }); if(!this.running&&this.todo.length){ this.running=true; this.step(); } },
  step(){ const id=this.todo.shift(); if(!id){ this.running=false; return; } const c=BF.Catalog.get(id); try{ const s=this.get(c); document.querySelectorAll(`[data-stat="${id}"]`).forEach(e=>{ e.innerHTML=statLine(s); }); }catch(e){ console.warn('stat',id,e); } setTimeout(()=>this.step(),40); } };
const statsOf=c=>Stat.get(c);
const statLine=s=>`<span>ATK ${s?s.atk:'??'}</span><span>DEF ${s?s.def:'??'}</span><span>STA ${s?s.sta:'??'}</span>`;
// real chance to pull this part: same logic as BF.Packs.open + BF.Catalog.pool
function sources(c){ const out=[]; (BF.Packs?BF.Packs.list():[]).forEach(p=>{ if(p.system&&p.system!==c.sys) return;
    const t=Object.values(p.odds).reduce((a,b)=>a+(+b||0),0)||1, sysP=p.system?1:(c.sys==='X'?.6:.4), slotP=p.slots==='each'?1:1/3; let per=0;
    Object.entries(p.odds).forEach(([r,w])=>{ if(!(+w>0)) return; const pool=BF.Catalog.pool(r==='limited'?'legendary':r,c.slot,c.sys); if(pool.includes(c)) per+=(+w/t)/pool.length; });
    per*=sysP*slotP; if(per<=0) return; out.push({p,chance:1-Math.pow(1-per,p.slots==='each'?1:p.count)}); }); return out.sort((a,b)=>b.chance-a.chance); }
const pct=x=>x<0.001?'<0.1%':(x*100).toFixed(1)+'%';
const bars=(c,have)=>{ const s=have?statsOf(c):null, row=(l,v)=>`<div class="dx-bar"><span>${l}</span><i><u style="width:${have?Math.min(100,v):0}%"></u></i><b>${have?v:'??'}</b></div>`;
  return `${row('Attack',s&&s.atk)}${row('Defense',s&&s.def)}${row('Stamina',s&&s.sta)}${row('Burst res.',s&&s.brs)}${row('Stability',s&&s.stb)}<p class="dx-note">${have?'Measured on a standard test Bey':'Pull this part to reveal its stats'}</p>`; };
const gims=(c,have)=>{ const L=(c.gims||[]).filter(g=>BF.GIMMICKS[g]); if(!L.length) return ''; if(!have) return `<h4>Gimmicks</h4><p class="dx-note">${L.length} hidden gimmick${L.length>1?'s':''}</p>`;
  return `<h4>Gimmicks</h4>${L.map(g=>`<div class="dx-gimrow"><i>${BF.GIMMICKS[g].icon}</i><div><b>${esc(BF.GIMMICKS[g].label)}</b><span>${esc(BF.GIMMICKS[g].desc)}</span></div></div>`).join('')}`; };
const srcs=(c,n,img)=>{ const L=sources(c).slice(0,n); return `<h4>Where to get it</h4>${L.length?L.map(x=>`<div class="dx-src">${img?`<img src="${BF.PackModel.thumb(x.p,60)}" alt="">`:''}<b>${esc(x.p.name)}</b><span>~${pct(x.chance)} per pack</span></div>`).join(''):'<p class="dx-note">Event-only part.</p>'}`; };
const copies=c=>{ const L=BF.Parts?BF.Parts.list.filter(p=>p.catId===c.id):[]; return L.length?`<h4>Your copies</h4>${L.map(p=>`<button type="button" class="dx-own" data-copy="${p.id}">${p.shiny?'✨ ':''}Lv ${BF.partLevel(p.xp).lv} · IV ${Math.round(Object.values(p.iv).reduce((a,b)=>a+b,0)/155*100)}%</button>`).join('')}`:''; };
const actions=(c,have)=>have?`<button type="button" class="dx-cta" data-forge="${c.id}">Open in Forge</button>`:`<button type="button" class="dx-cta" data-packs="1">Open packs</button>`;
const tags=c=>`<span class="dx-b rar">${R(c.rarity).label}</span><span class="dx-b sys">${c.sys==='X'?'X':'BURST'}</span>${c.style&&c.style!=='single'&&BF.LAYER_STYLES[c.style]?`<span class="dx-b gen">${esc(BF.LAYER_STYLES[c.style].label)}</span>`:''}`;
const sub=c=>`${esc(cap(c.type))} · ${esc(SLOTN(c))}`;
const thumb=(c,have,cls)=>{ const u=Thumb.get(c.id); return `<img class="dx-th${have?'':' sil'}${cls?' '+cls:''}" data-th="${c.id}" alt=""${u?` src="${u}"`:''}>`; };

const Dex=BF.Dex={
  view:null, q:'', sys:'', slot:'', rar:'', type:'', gim:'', own:'', sort:'rarity', page:0, setI:0, sel:null, _live:null,
  curView(){ if(!this.view){ const v=store.get(), d=econ().defaultView; this.view=VIEWS.some(x=>x[0]===v)?v:(VIEWS.some(x=>x[0]===d)?d:'grid'); } return this.view; },
  list(){ const own=BF.Catalog.owned(), q=this.q.trim().toLowerCase();
    const L=BF.CATALOG.filter(c=>(!this.sys||c.sys===this.sys)&&(!this.slot||c.slot===this.slot)&&(!this.rar||c.rarity===this.rar)&&(!this.type||c.type===this.type)&&(!this.gim||(c.gims||[]).includes(this.gim))
      &&(!this.own||(this.own==='have'?own.has(c.id):!own.has(c.id)))&&(!q||(c.name+' '+c.type+' '+c.sys+' '+(c.gims||[]).map(g=>BF.GIMMICKS[g]?BF.GIMMICKS[g].label:g).join(' ')).toLowerCase().includes(q)));
    const st=statsOf, S={rarity:(a,b)=>RAR.indexOf(b.rarity)-RAR.indexOf(a.rarity)||a.name.localeCompare(b.name), name:(a,b)=>a.name.localeCompare(b.name),
      attack:(a,b)=>st(b).atk-st(a).atk, defense:(a,b)=>st(b).def-st(a).def, stamina:(a,b)=>st(b).sta-st(a).sta, owned:(a,b)=>(own.get(b.id)||0)-(own.get(a.id)||0)}[this.sort]||((a,b)=>0);
    return L.sort(S); },

  // ---------- rewards ----------
  claims(){ const cfg=econ(); if(!cfg.on) return []; const done=(BF.Account&&BF.Account.profile&&BF.Account.profile.dexClaims)||{}, own=BF.Catalog.owned(), out=[], all=BF.Catalog.progress(), at=all.have/all.total*100;
    (cfg.milestones||[]).forEach(m=>{ const r=Object.assign({},m); delete r.pct; if(at>=m.pct&&!done['m'+m.pct]) out.push({key:'m'+m.pct,label:`${m.pct}% of the Beydex`,r}); });
    SETS.forEach(([sys,slot,name])=>{ const k=setKey(sys,slot), r=(cfg.sets||{})[k]; if(r&&Object.keys(r).length&&!done['set_'+k]&&setParts(sys,slot).every(c=>own.has(c.id))) out.push({key:'set_'+k,label:name+' complete',r}); });
    return out; },
  async claim(key,btn){ const it=this.claims().find(x=>x.key===key), A=BF.Account; if(!it) return; if(!(A&&A.profile)) return BF.App.toast('Sign in (Blader tab) to collect rewards','bad');
    if(btn) btn.disabled=true; try{ const made=await BF.Reward.grant(it.r,'dex'); await A.update({['dexClaims.'+key]:Date.now()}); BF.Stats&&BF.Stats.add('dex.'+key);
      if(made&&made.length&&BF.PackOpen) BF.PackOpen.show(made,BF.Packs.get(it.r.pack)||{name:it.label,colors:['#ffd21f','#ff2e88'],model:'crate'}); else BF.App.toast(`${it.label}: ${BF.Reward.text(it.r)}`,'good');
    }catch(e){ if(btn) btn.disabled=false; BF.App.toast(e.message,'bad'); } this.render(); },

  // ---------- shared top bar ----------
  head(){ const all=BF.Catalog.progress(), px=BF.Catalog.progress('X'), pb=BF.Catalog.progress('Burst'), p=all.have/all.total*100, v=this.curView(), cfg=econ(), cl=this.claims();
    return `<div class="dx-head"><div class="dx-prog"><div class="dx-progt"><b>Beydex</b><span>${all.have}/${all.total} · ${Math.round(p)}%</span><em>X ${px.have}/${px.total} · Burst ${pb.have}/${pb.total}</em></div>
        <i class="dx-progb"><u style="width:${p}%"></u>${cfg.on?(cfg.milestones||[]).filter(m=>m.pct<100).map(m=>`<s class="${p>=m.pct?'on':''}" style="left:${m.pct}%"></s>`).join(''):''}</i></div>
      <div class="dx-views" role="group" aria-label="Beydex layout">${VIEWS.map(([k,l])=>`<button type="button" data-view="${k}" class="${v===k?'on':''}" aria-pressed="${v===k}">${svg(k)}<span>${l}</span></button>`).join('')}</div></div>
      ${cl.length?`<div class="dx-claims">${cl.map(x=>`<div class="dx-claim"><div><b>${esc(x.label)}</b><span>${esc(BF.Reward.text(x.r))}</span></div><button type="button" data-claim="${x.key}">Claim</button></div>`).join('')}</div>`:''}`; },
  search(){ return `<label class="dx-search"><svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><input id="dxQ" aria-label="Search parts" placeholder="Search ${BF.CATALOG.length} parts: names, gimmicks, types" value="${esc(this.q)}" autocomplete="off"></label>`; },

  // ---------- 1. Store grid ----------
  vGrid(){ const own=BF.Catalog.owned(), L=this.list(), pages=Math.max(1,Math.ceil(L.length/PER)); this.page=Math.min(this.page,pages-1); const vis=L.slice(this.page*PER,this.page*PER+PER);
    const shiny=new Set(((BF.Parts&&BF.Parts.list)||[]).filter(p=>p.shiny&&p.catId).map(p=>p.catId));
    const sel=(k,label,opts)=>`<label class="dx-sel"><span>${label}</span><select data-k="${k}">${Object.entries(opts).map(([v,l])=>`<option value="${v}"${String(this[k])===v?' selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
    return `<div class="dx-tools">${this.search()}<div class="dx-seg">${[['','All'],['X','X'],['Burst','Burst']].map(([v,l])=>`<button type="button" data-k="sys" data-v="${v}" class="${this.sys===v?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="dx-filters">${sel('slot','Part',{'':'Any part',blade:'Blades / Layers',core:'Ratchets / Discs',driver:'Bits / Drivers'})}
        ${sel('rar','Rarity',{'':'Any rarity',common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary'})}
        ${sel('type','Type',{'':'Any type',attack:'Attack',defense:'Defense',stamina:'Stamina',balance:'Balance'})}
        ${sel('gim','Gimmick',Object.assign({'':'Any gimmick'},Object.fromEntries(Object.entries(BF.GIMMICKS).map(([k,g])=>[k,g.label]))))}
        ${sel('own','Collection',{'':'Owned + missing',have:'Owned',miss:'Missing'})}
        ${sel('sort','Sort',{rarity:'Rarity',name:'Name',attack:'Attack',defense:'Defense',stamina:'Stamina',owned:'Most owned'})}
        <span class="dx-count">${L.length} result${L.length===1?'':'s'}</span></div>
      <div class="dx-grid">${vis.map(c=>{ const n=own.get(c.id)||0, s=n&&Stat.has(c)?statsOf(c):null, gs=n?(c.gims||[]).filter(g=>BF.GIMMICKS[g]):[];
        return `<article class="dx-card${n?' own':''}" data-open="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}" style="--rc:${R(c.rarity).color}">
          <div class="dx-img">${thumb(c,n)}<div class="dx-tl">${tags(c)}</div><div class="dx-tr">${shiny.has(c.id)?'<span class="dx-b shiny">SHINY</span>':''}${n?`<span class="dx-b ok">OWNED${n>1?' x'+n:''}</span>`:'<span class="dx-b miss">MISSING</span>'}</div>
            ${gs.length?`<div class="dx-bl">${gs.map(g=>`<span class="dx-gim" title="${esc(BF.GIMMICKS[g].label)}">${BF.GIMMICKS[g].icon}</span>`).join('')}</div>`:''}</div>
          <div class="dx-body"><b>${esc(c.name)}</b><span class="dx-sub2">${sub(c)}</span><div class="dx-stats"${n?` data-stat="${c.id}"`:''}>${statLine(s)}</div></div></article>`; }).join('')||'<div class="dx-empty">No parts match those filters.</div>'}</div>
      <div class="dx-pages">${pages>1?`<button type="button" data-pg="${this.page-1}"${this.page?'':' disabled'} aria-label="Previous page">‹</button>${Array.from({length:pages},(_,i)=>i).filter(i=>i===0||i===pages-1||Math.abs(i-this.page)<=2).map((i,k,a)=>`${k&&i-a[k-1]>1?'<em>…</em>':''}<button type="button" data-pg="${i}" class="${i===this.page?'on':''}">${i+1}</button>`).join('')}<button type="button" data-pg="${this.page+1}"${this.page<pages-1?'':' disabled'} aria-label="Next page">›</button>`:''}</div>`; },

  // ---------- 2. Collector binder ----------
  vBinder(){ const own=BF.Catalog.owned(), all=BF.Catalog.progress(), p=all.have/all.total, cfg=econ(), done=(BF.Account&&BF.Account.profile&&BF.Account.profile.dexClaims)||{}, circ=2*Math.PI*52;
    const stat=SETS.map(([sys,slot,name],i)=>{ const L=setParts(sys,slot), h=L.filter(c=>own.has(c.id)).length; return {i,sys,slot,name,L,h,t:L.length,key:setKey(sys,slot)}; });
    return `<div class="dx-bind"><aside class="dx-rail"><div class="dx-ring"><svg viewBox="0 0 120 120" role="img" aria-label="${Math.round(p*100)} percent collected"><circle cx="60" cy="60" r="52"/><circle class="v" cx="60" cy="60" r="52" stroke-dasharray="${p*circ} ${circ}" transform="rotate(-90 60 60)"/></svg><div><b>${all.have}</b><span>of ${all.total}</span></div></div>
        <div class="dx-sets">${stat.map(s=>`<button type="button" data-goset="${s.i}"><span><b>${esc(s.name)}</b><em>${s.h}/${s.t}</em></span><i><u style="width:${s.h/s.t*100}%"></u></i></button>`).join('')}</div>
        ${cfg.on&&(cfg.milestones||[]).length?`<div class="dx-miles"><h4>Completion rewards</h4>${cfg.milestones.map(m=>{ const r=Object.assign({},m); delete r.pct; const got=done['m'+m.pct]; return `<div class="${got?'got':p*100>=m.pct?'ready':''}"><b>${m.pct}%</b><span>${got?'Claimed':esc(BF.Reward.text(r))}</span></div>`; }).join('')}</div>`:''}</aside>
      <div class="dx-book">${stat.map(s=>{ const r=(cfg.sets||{})[s.key], has=cfg.on&&r&&Object.keys(r).length, got=done['set_'+s.key];
        return `<section class="dx-set" id="dxSet${s.i}"><div class="dx-seth"><h3>${esc(s.name)}</h3><span>${s.h}/${s.t}</span>${has?`<em class="${got?'got':''}">${got?'Set reward claimed':'Complete the set: '+esc(BF.Reward.text(r))}</em>`:''}</div>
          <div class="dx-slots">${s.L.map(c=>{ const n=own.get(c.id)||0; return `<article class="dx-slot${n?' own':''}" data-open="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}" style="--rc:${R(c.rarity).color}"><span class="no">#${numberOf(c)}</span>${n>1?`<span class="cnt">x${n}</span>`:''}${thumb(c,n)}<b>${esc(c.short||c.name)}</b></article>`; }).join('')}</div></section>`; }).join('')}</div></div>`; },

  // ---------- 3. Locker + inspector ----------
  vLocker(){ const own=BF.Catalog.owned(), L=this.list(); if(!L.some(c=>c.id===this.sel)) this.sel=L.length?L[0].id:null;
    const group=(t,k,opts)=>`<div class="dx-grp"><h4>${t}</h4><div>${opts.map(([v,l])=>`<button type="button" data-k="${k}" data-v="${v}" class="${String(this[k])===v?'on':''}">${l}</button>`).join('')}</div></div>`;
    return `<div class="dx-lock"><aside class="dx-rail">${group('System','sys',[['','All'],['X','X'],['Burst','Burst']])}${group('Part','slot',[['','Any'],['blade','Blades'],['core','Ratchets'],['driver','Bits']])}
        ${group('Rarity','rar',[['','Any'],['common','Common'],['rare','Rare'],['epic','Epic'],['legendary','Legendary']])}${group('Type','type',[['','Any'],['attack','Attack'],['defense','Defense'],['stamina','Stamina'],['balance','Balance']])}
        ${group('Collection','own',[['','All'],['have','Owned'],['miss','Missing']])}
        <div class="dx-grp"><h4>Gimmick</h4><select data-k="gim" aria-label="Gimmick"><option value="">Any gimmick</option>${Object.entries(BF.GIMMICKS).map(([k,g])=>`<option value="${k}"${this.gim===k?' selected':''}>${esc(g.label)}</option>`).join('')}</select></div></aside>
      <div class="dx-lmain">${this.search()}<div class="dx-mini">${L.map(c=>{ const n=own.get(c.id)||0; return `<article class="dx-slot${n?' own':''}${c.id===this.sel?' sel':''}" data-open="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}" style="--rc:${R(c.rarity).color}">${thumb(c,n)}<b>${esc(c.name)}</b></article>`; }).join('')||'<div class="dx-empty">No parts match those filters.</div>'}</div></div>
      <aside class="dx-insp" id="dxInsp"></aside></div>`; },
  fillInspector(){ const box=$('#dxInsp'); if(!box) return; this.killLive(); const c=this.sel&&BF.Catalog.get(this.sel); if(!c){ box.innerHTML=''; return; } const have=BF.Catalog.owned().has(c.id);
    box.style.setProperty('--rc',R(c.rarity).color);
    box.innerHTML=`<div class="dx-3d${have?'':' sil'}"><canvas aria-label="3D view of ${esc(have?c.name:'a missing part')}"></canvas><div class="dx-tl">${tags(c)}</div></div>
      <h3>${esc(c.name)}</h3><p class="dx-sub2">${sub(c)}</p>${bars(c,have)}${gims(c,have)}${srcs(c,3)}${copies(c)}${actions(c,have)}`;
    if(!phone()) this._live=live(box.querySelector('canvas'),c.id,{missing:!have}); },

  // ---------- 4. Showroom ----------
  vShow(){ const own=BF.Catalog.owned(), [sys,slot]=SETS[this.setI], L=setParts(sys,slot); if(!L.some(c=>c.id===this.sel)) this.sel=(L.find(c=>own.has(c.id))||L[0]).id;
    return `<div class="dx-showtabs">${SETS.map(([s2,sl,name],i)=>{ const P=setParts(s2,sl), h=P.filter(c=>own.has(c.id)).length; return `<button type="button" data-setidx="${i}" class="${i===this.setI?'on':''}">${esc(name)} <em>${h}/${P.length}</em></button>`; }).join('')}</div>
      <div class="dx-hero" id="dxHero"></div>
      <div class="dx-strip" id="dxStrip">${L.map(c=>{ const n=own.get(c.id)||0; return `<article class="dx-slot${n?' own':''}${c.id===this.sel?' sel':''}" data-open="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}" style="--rc:${R(c.rarity).color}">${thumb(c,n)}<b>${esc(c.short||c.name)}</b></article>`; }).join('')}</div>`; },
  fillHero(){ const box=$('#dxHero'); if(!box) return; this.killLive(); const c=BF.Catalog.get(this.sel), have=BF.Catalog.owned().has(c.id); box.style.setProperty('--rc',R(c.rarity).color);
    box.innerHTML=`<div class="dx-hl"><div class="dx-tags">${tags(c)}</div><h2>${esc(c.name)}</h2><p class="dx-sub2">${sub(c)} · #${numberOf(c)}</p>${bars(c,have)}</div>
      <div class="dx-stage${have?'':' sil'}"><div class="dx-ped"></div><canvas aria-label="3D view of ${esc(have?c.name:'a missing part')}"></canvas><button type="button" class="dx-arrow l" data-shift="-1" aria-label="Previous part">‹</button><button type="button" class="dx-arrow r" data-shift="1" aria-label="Next part">›</button></div>
      <div class="dx-hr">${gims(c,have)}${srcs(c,3)}${copies(c)}${actions(c,have)}</div>`;
    const cv=box.querySelector('canvas'); this._live=live(cv,c.id,{missing:!have,drag:false,dist:3.9});
    let sx=null; cv.onpointerdown=e=>{ sx=e.clientX; }; cv.onpointerup=e=>{ if(sx==null) return; const dx=e.clientX-sx; sx=null; if(Math.abs(dx)>40) this.shift(dx<0?1:-1); }; },
  shift(n){ const [sys,slot]=SETS[this.setI], L=setParts(sys,slot), i=L.findIndex(c=>c.id===this.sel); this.pick(L[(i+n+L.length)%L.length].id); },
  pick(id){ this.sel=id; const box=$('#dxStrip'); if(box){ box.querySelectorAll('.dx-slot').forEach(s=>{ const on=s.dataset.open===id; s.classList.toggle('sel',on); if(on) box.scrollTo({left:s.offsetLeft-box.clientWidth/2+s.offsetWidth/2,behavior:calm()?'auto':'smooth'}); }); } this.fillHero(); },

  // ---------- render + wiring ----------
  killLive(){ if(this._live){ this._live.kill(); this._live=null; } },
  render(root){ root=root||$('#dexRoot'); if(!root) return; const v=this.curView(), typing=document.activeElement&&document.activeElement.id==='dxQ', cur=typing?document.activeElement.selectionStart:0;
    this.killLive(); root.className='dx v-'+v;
    root.innerHTML=this.head()+(v==='binder'?this.vBinder():v==='locker'?this.vLocker():v==='show'?this.vShow():this.vGrid());
    this.wire(root); if(v==='locker') this.fillInspector(); if(v==='show'){ this.fillHero(); const box=$('#dxStrip'), s=box&&box.querySelector('.sel'); if(s) box.scrollLeft=s.offsetLeft-box.clientWidth/2+s.offsetWidth/2; }
    this.lazy(root); Stat.warm(root); if(typing){ const n=root.querySelector('#dxQ'); if(n){ n.focus(); n.setSelectionRange(cur,cur); } } },
  lazy(root){ if(this._io) this._io.disconnect(); const load=img=>Thumb.want(img.dataset.th,u=>{ if(u&&img.isConnected) img.src=u; });
    const imgs=root.querySelectorAll('img[data-th]:not([src])'); if(!('IntersectionObserver' in window)){ imgs.forEach(load); return; }
    this._io=new IntersectionObserver(es=>es.forEach(e=>{ if(e.isIntersecting){ this._io.unobserve(e.target); load(e.target); } })); imgs.forEach(i=>this._io.observe(i)); },
  wire(root){ if(root._dx) return; root._dx=true;
    let tm; root.addEventListener('input',e=>{ if(e.target.id!=='dxQ') return; clearTimeout(tm); const val=e.target.value; tm=setTimeout(()=>{ this.q=val; this.page=0; this.render(); },220); });
    root.addEventListener('change',e=>{ const s=e.target; if(s.tagName==='SELECT'&&s.dataset.k){ this[s.dataset.k]=s.value; this.page=0; this.render(); } });
    root.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&e.target.dataset&&e.target.dataset.open){ e.preventDefault(); this.open(e.target.dataset.open); } });
    root.addEventListener('click',e=>{ const q=a=>e.target.closest('['+a+']'); let b;
      if(b=q('data-view')){ this.view=b.dataset.view; store.set(this.view); BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui(); return this.render(); }
      if(b=q('data-claim')) return this.claim(b.dataset.claim,b);
      if(b=q('data-goset')){ const s=$('#dxSet'+b.dataset.goset); if(s) s.scrollIntoView({block:'start',behavior:calm()?'auto':'smooth'}); return; }
      if(b=q('data-setidx')){ this.setI=+b.dataset.setidx; this.sel=null; return this.render(); }
      if(b=q('data-shift')) return this.shift(+b.dataset.shift);
      if((b=q('data-v'))&&b.dataset.k){ this[b.dataset.k]=b.dataset.v; this.page=0; return this.render(); }
      if(b=q('data-pg')){ this.page=+b.dataset.pg; this.render(); root.scrollIntoView({block:'start'}); return; }
      if(b=q('data-forge')) return BF.Share.load(BF.Catalog.design(b.dataset.forge));
      if(q('data-packs')) return BF.PartsUI.setMode('mine');
      if(b=q('data-copy')) return BF.PartsUI.detail(b.dataset.copy);
      if(b=q('data-open')) return this.open(b.dataset.open); }); },
  open(id){ const v=this.curView();
    if(v==='show') return this.pick(id);
    if(v==='locker'&&!phone()){ this.sel=id; document.querySelectorAll('#dexRoot .dx-mini .dx-slot').forEach(s=>s.classList.toggle('sel',s.dataset.open===id)); return this.fillInspector(); }
    this.detail(id); },

  // ---------- part page (popup) ----------
  detail(id){ const c=BF.Catalog.get(id); if(!c) return; const m=$('#partModal'), b=$('#partBody'), have=BF.Catalog.owned().has(id); m.hidden=false;
    b.innerHTML=`<div class="modal-head"><h3>${esc(c.name)}</h3><button class="icon-x big" data-x aria-label="Close">×</button></div>
      <div class="dx-detail" style="--rc:${R(c.rarity).color}"><div class="dx-3d${have?'':' sil'}"><canvas aria-label="3D view of ${esc(have?c.name:'a missing part')}"></canvas><div class="dx-tl">${tags(c)}</div>${have?'<label class="dx-whole"><input type="checkbox" id="dxWhole"> Show on a full Bey</label>':''}</div>
        <div class="dx-info"><p class="dx-sub2">${sub(c)} · #${numberOf(c)}</p>${bars(c,have)}${gims(c,have)}${srcs(c,4,true)}${copies(c)}${actions(c,have)}</div></div>`;
    const L=live(b.querySelector('canvas'),id,{missing:!have,modal:true}), w=b.querySelector('#dxWhole'); if(w) w.onchange=e=>L.set(e.target.checked);
    const close=()=>{ L.kill(); m.hidden=true; m.onclick=null; };
    b.querySelector('[data-x]').onclick=close; m.onclick=e=>{ if(e.target===m) close(); };
    const fg=b.querySelector('[data-forge]'); if(fg) fg.onclick=()=>{ close(); BF.Share.load(BF.Catalog.design(id)); };
    const pk=b.querySelector('[data-packs]'); if(pk) pk.onclick=()=>{ close(); BF.PartsUI.setMode('mine'); };
    b.querySelectorAll('[data-copy]').forEach(x=>x.onclick=()=>{ close(); BF.PartsUI.detail(x.dataset.copy); }); }
};
})();
