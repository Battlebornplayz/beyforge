/* BeyForge v6.4 — 3D pack opening. One WebGL scene for the whole thing:
   1) the pack flies in, hovers and follows your finger; swipe the tear line (or tap Open)
   2) the foil top / crate lid blasts off, a light beam pours out and the real 3D parts rise out as dark silhouettes
   3) tap: the next part flies to the centre, spins up inside a light pillar (longer for Epic+, shake + slam for Legendary),
      bursts with a shockwave into its real painted model + name plate (NEW badge, shiny rainbow shimmer)
   4) lineup of everything you pulled, pity meter, "Open another" */
(function(){
'use strict';
const BF=window.BF, T=window.THREE;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ORDER=['common','rare','epic','legendary','limited'];
const R=k=>BF.RARITY[k]||BF.RARITY.common, lvOf=k=>Math.max(0,ORDER.indexOf(k));
const calm=()=>document.documentElement.classList.contains('reduce-motion');
const sfx=(k,a)=>{ try{ BF.Sfx&&(k==='ui'?BF.Sfx.ui&&BF.Sfx.ui(a):BF.Sfx[k]&&BF.Sfx[k](a)); }catch(e){} };
const buzz=p=>{ try{ navigator.vibrate&&navigator.vibrate(p); }catch(e){} };
const E={out:k=>1-Math.pow(1-k,3), inOut:k=>k<.5?4*k*k*k:1-Math.pow(-2*k+2,3)/2, back:k=>{ const c=1.9; return 1+(c+1)*Math.pow(k-1,3)+c*Math.pow(k-1,2); }, in:k=>k*k*k};
const lerp=(a,b,k)=>a+(b-a)*k;

// ---------- 2D particle overlay (sparks, stars, god-rays) ----------
function Particles(cv){
  const x=cv.getContext('2d'), P=[]; let on=true;
  const fit=()=>{ cv.width=innerWidth*Math.min(2,devicePixelRatio||1); cv.height=innerHeight*Math.min(2,devicePixelRatio||1); };
  fit(); addEventListener('resize',fit);
  const loop=()=>{ if(!on) return; requestAnimationFrame(loop); const k=cv.width/innerWidth; x.setTransform(k,0,0,k,0,0); x.clearRect(0,0,innerWidth,innerHeight);
    x.globalCompositeOperation='lighter';
    for(let i=P.length-1;i>=0;i--){ const p=P[i]; p.t+=1/60; if(p.t>p.life){ P.splice(i,1); continue; }
      p.vx*=0.985; p.vy=p.vy*0.985+p.g; p.x+=p.vx; p.y+=p.vy; const a=1-p.t/p.life;
      if(p.ray){ x.save(); x.translate(p.x,p.y); x.rotate(p.ang+p.t*0.35); const g=x.createLinearGradient(0,0,p.len,0); g.addColorStop(0,p.c); g.addColorStop(1,'transparent'); x.fillStyle=g; x.globalAlpha=a*0.3; x.beginPath(); x.moveTo(0,-p.w); x.lineTo(p.len,0); x.lineTo(0,p.w); x.fill(); x.restore(); continue; }
      x.globalAlpha=a; x.fillStyle=p.rainbow?`hsl(${(p.h+p.t*400)%360},100%,65%)`:p.c; x.beginPath();
      if(p.star){ x.save(); x.translate(p.x,p.y); x.rotate(p.t*6); for(let j=0;j<4;j++){ x.rotate(Math.PI/2); x.moveTo(0,0); x.lineTo(p.s*0.35,p.s*0.35); x.lineTo(0,p.s*1.6); } x.fill(); x.restore(); }
      else { x.arc(p.x,p.y,p.s*a+0.5,0,7); x.fill(); } }
    x.globalAlpha=1; };
  loop();
  return {
    burst(cx,cy,c,n,o){ o=o||{}; if(calm()) n=Math.ceil(n/3); for(let i=0;i<n;i++){ const a=Math.random()*7, v=(o.v||7)*(0.35+Math.random());
      P.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(o.up||0),g:o.g==null?0.12:o.g,s:(o.s||3)*(0.5+Math.random()),life:(o.life||1)*(0.6+Math.random()*0.6),t:0,c,star:Math.random()<(o.stars||0.25),rainbow:o.rainbow,h:Math.random()*360}); } },
    rays(cx,cy,c,n){ if(calm()) return; for(let i=0;i<n;i++) P.push({ray:true,x:cx,y:cy,vx:0,vy:0,g:0,ang:i/n*Math.PI*2,len:Math.max(innerWidth,innerHeight)*0.8,w:28+Math.random()*30,life:1.8,t:0,c}); },
    stop(){ on=false; removeEventListener('resize',fit); }
  };
}

// ---------- textures ----------
let _glow=null, _beam=null;
function glowTex(){ if(_glow) return _glow; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.25,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); return _glow=new T.CanvasTexture(c); }
function beamTex(){ if(_beam) return _beam; const c=document.createElement('canvas'); c.width=8; c.height=256; const x=c.getContext('2d'), g=x.createLinearGradient(0,256,0,0);
  g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.15,'rgba(255,255,255,.95)'); g.addColorStop(.6,'rgba(255,255,255,.35)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,8,256); return _beam=new T.CanvasTexture(c); }
const addMat=(c,o)=>new T.MeshBasicMaterial(Object.assign({color:new T.Color(c),map:beamTex(),transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide},o||{}));

// ---------- one owned part → 3D object ----------
function partObject(p){
  const PU=BF.PartsUI, Pa=BF.Parts, sys=p.system||(p.data&&p.data.system);
  const d=Pa.assemble(['blade','core','driver'].map(s=>s===p.slot?p:PU.dummy(s,sys))), asm=BF.build(d);
  const main=asm.parts.filter(x=>x.id!=='chip'), pick=[main[{blade:0,core:1,driver:2}[p.slot]||0]];
  if(p.slot==='blade') asm.parts.filter(x=>x.id==='chip').forEach(c=>pick.push(c));
  const inner=new T.Group(), meshes=[];
  pick.forEach(part=>part.bodies.forEach(b=>{ const m=new T.Mesh(b.geo,BF.materialFor(d,part,b,{})); m.position.z=part.z0; inner.add(m); meshes.push(m); }));
  const box=new T.Box3().setFromObject(inner), c=box.getCenter(new T.Vector3()), sz=box.getSize(new T.Vector3());
  inner.children.forEach(m=>m.position.sub(c));
  const rad=Math.max(sz.x,sz.y,sz.z*1.3)/2||10;
  const spin=new T.Group(); spin.add(inner); const tilt=new T.Group(); tilt.add(spin); tilt.rotation.x=-Math.PI/2+0.8;
  const root=new T.Group(); root.add(tilt);
  const real=meshes.map(m=>m.material), rc=R(p.rarity).color;
  const sil=new T.MeshStandardMaterial({color:0x000000,roughness:.3,metalness:1,emissive:new T.Color(lvOf(p.rarity)>=2?rc:'#5a5f8a'),emissiveIntensity:lvOf(p.rarity)>=2?0.05:0.02});
  meshes.forEach(m=>m.material=sil);
  const halo=new T.Sprite(new T.SpriteMaterial({map:glowTex(),color:new T.Color(lvOf(p.rarity)>=2?rc:'#8fa0ff'),transparent:true,opacity:lvOf(p.rarity)>=2?0.35:0.15,blending:T.AdditiveBlending,depthWrite:false}));
  halo.scale.setScalar(rad*3.2); halo.position.z=-rad; root.add(halo);
  root.userData={p,rad,spin,meshes,real,sil,halo,spinV:1.2,revealed:false,hue:Math.random()};
  return root;
}
function fade(obj,a){ obj.traverse(o=>{ const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[]; ms.forEach(m=>{ m.transparent=true; m.opacity=a; }); }); }

// ---------- the overlay ----------
const PO = BF.PackOpen = {
  show(parts,pack,opts){
    if(!parts||!parts.length) return;
    pack=pack||BF.Packs.get('pack'); this.close(true);
    const best=parts.reduce((a,p)=>lvOf(p.rarity)>lvOf(a)?p.rarity:a,'common'), anyShiny=parts.some(p=>p.shiny), crate=pack.model==='crate';
    // NEW = you didn't already own a part with that name before this pack
    const ids=new Set(parts.map(p=>p.id)), owned=new Set(((BF.Parts&&BF.Parts.list)||[]).filter(x=>!ids.has(x.id)).map(x=>x.name)); parts.forEach(p=>p._new=!owned.has(p.name));
    if(BF.Catalog&&BF.CATALOG){ const seen=new Set(((BF.Parts&&BF.Parts.list)||[]).filter(x=>!ids.has(x.id)&&x.catId).map(x=>x.catId)); parts.forEach(p=>{ if(p.catId&&!seen.has(p.catId)){ seen.add(p.catId); p._dexN=`${seen.size}/${BF.CATALOG.length}`; } }); }
    const ov=document.createElement('div'); ov.id='packOpen'; ov.className=`po r-${best}${anyShiny?' shiny':''}`; ov.style.setProperty('--rc',R(best).color);
    ov.style.setProperty('--c1',(pack.colors&&pack.colors[0])||'#2ef2ff'); ov.style.setProperty('--c2',(pack.colors&&pack.colors[1])||'#ff2e88');
    ov.innerHTML=`<div class="po-bg"></div><div class="po-dim"></div><canvas class="po-3d"></canvas><canvas class="po-fx"></canvas>
      <div class="po-top"><b>${esc(pack.name||'Pack')}</b><span>${parts.length} ${parts.length===1?'part':'parts'}</span></div>
      <div class="po-tear" hidden><i></i><span>${crate?'Swipe to break the seal':'Swipe to tear'}</span></div>
      <div class="po-hint" hidden></div><div class="po-plate" hidden></div><div class="po-slam"></div><div class="po-labels"></div><div class="po-sum" hidden></div>
      <div class="po-acts"><button type="button" class="btn primary" data-open>${crate?'Open crate':'Tear open'}</button><button type="button" class="btn ghost" data-skip>Skip</button></div><div class="po-flash"></div>`;
    document.body.appendChild(ov); document.body.classList.add('po-on');
    const C=this.cur={ov,parts,pack,best,crate,anyShiny,onClose:opts&&opts.onClose,phase:'intro',tw:[],objs:[],order:[],ri:-1,fast:false,shake:0,on:true};
    C.fx=Particles(ov.querySelector('.po-fx'));
    this.scene(); sfx('ui','open');
    // tap anywhere to advance the reveal
    ov.addEventListener('click',e=>{ if(e.target.closest('button,.po-tear,.po-sum')) return; this.tap(); });
    // finger/mouse parallax on the pack
    ov.addEventListener('pointermove',e=>{ C.px=(e.clientX/innerWidth-.5)*2; C.py=(e.clientY/innerHeight-.5)*2; });
    // swipe-to-tear
    const tear=ov.querySelector('.po-tear'), bar=tear.querySelector('i'); let sx=null, maxd=0;
    const prog=v=>{ bar.style.width=(v*100)+'%'; C.charge=Math.max(C.charge||0,v); };
    tear.addEventListener('pointerdown',e=>{ sx=e.clientX; maxd=0; tear.setPointerCapture&&tear.setPointerCapture(e.pointerId); });
    tear.addEventListener('pointermove',e=>{ if(sx==null) return; const d=Math.abs(e.clientX-sx)/((tear.clientWidth||300)*0.8); maxd=Math.max(maxd,d); prog(Math.min(1,maxd));
      if(maxd>0.12&&Math.random()<0.4){ const b=tear.getBoundingClientRect(); C.fx.burst(e.clientX,b.top+b.height/2,R(best).color,3,{v:3,life:0.5,s:2}); }
      if(maxd>=1){ sx=null; this.rip(); } });
    const up=()=>{ if(sx!=null&&maxd<1){ bar.style.transition='width .25s'; prog(0); setTimeout(()=>bar.style.transition='',260); } sx=null; };
    tear.addEventListener('pointerup',up); tear.addEventListener('pointercancel',up);
    ov.querySelector('[data-open]').onclick=()=>this.rip();
    ov.querySelector('[data-skip]').onclick=()=>{ if(C.phase==='intro'||C.phase==='idle') this.rip(true); else this.revealAll(); };
  },
  // ---------- scene ----------
  scene(){
    const C=this.cur, cv=C.ov.querySelector('.po-3d');
    const r=C.r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=0.88; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
    const s=C.s=BF.PackModel.scene(C.pack); s.add(new T.HemisphereLight(0xcfe0ff,0x1a1030,.45));
    const key=new T.DirectionalLight(0xffffff,.45); key.position.set(-60,80,140); s.add(key);
    C.spot=new T.PointLight(new T.Color(R(C.best).color),0,320); C.spot.position.set(0,10,80); s.add(C.spot);
    const cam=C.cam=new T.PerspectiveCamera(32,1,1,2000); cam.position.set(0,0,190);
    // the pack
    const m=C.pack3d=BF.PackModel.build(C.pack); s.add(m); m.position.y=-200;
    // ambient dust drifting up
    const N=calm()?40:140, g=new T.BufferGeometry(), pos=new Float32Array(N*3); for(let i=0;i<N;i++){ pos[i*3]=(Math.random()-.5)*260; pos[i*3+1]=(Math.random()-.5)*200; pos[i*3+2]=(Math.random()-.5)*120-30; }
    g.setAttribute('position',new T.BufferAttribute(pos,3));
    C.dust=new T.Points(g,new T.PointsMaterial({map:glowTex(),color:new T.Color(R(C.best).color).lerp(new T.Color('#ffffff'),.5),size:3,transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false})); s.add(C.dust);
    // beam pouring out of the pack, centre pillar, shockwave ring
    C.cone=new T.Mesh(new T.CylinderGeometry(42,14,150,32,1,true),addMat(R(C.best).color)); s.add(C.cone);
    C.pillar=new T.Mesh(new T.CylinderGeometry(22,22,240,32,1,true),addMat('#ffffff')); s.add(C.pillar);
    C.ring=new T.Mesh(new T.RingGeometry(0.8,1,64),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide})); s.add(C.ring);
    C.ring2=C.ring.clone(); C.ring2.material=C.ring.material.clone(); s.add(C.ring2);
    C.born=performance.now(); C.last=C.born; C.t=0; C.charge=0; C.px=0; C.py=0;
    this.tween(0.75,k=>{ m.position.y=lerp(-200,0,E.back(k)); m.rotation.y=(1-E.out(k))*Math.PI*2.2; },()=>{ if(C.phase==='intro'){ C.phase='idle'; C.ov.querySelector('.po-tear').hidden=false; } });
    const loop=now=>{ if(!C.on) return; requestAnimationFrame(loop); const dt=Math.max(0,Math.min(0.05,(now-C.last)/1000)); C.last=Math.max(C.last,now); C.t+=dt; this.frame(dt); };
    requestAnimationFrame(loop);
  },
  tween(d,f,done){ const C=this.cur; if(!C) return; if(calm()) d*=0.5; C.tw.push({t:0,d:Math.max(0.01,d),f,done}); },
  wait(d,fn){ this.tween(d,()=>{},fn); },
  vis(){ const C=this.cur, h=2*Math.tan(16*Math.PI/180)*(C.baseZ||190); return {h,w:h*C.cam.aspect}; },
  screen(v){ const C=this.cur, p=v.clone().project(C.cam); return {x:(p.x+1)/2*innerWidth, y:(1-p.y)/2*innerHeight}; },
  frame(dt){
    const C=this.cur; if(!C) return; const cv=C.r.domElement, w=cv.clientWidth||innerWidth, h=cv.clientHeight||innerHeight;
    C.r.setSize(w,h,false); C.cam.aspect=w/h; C.cam.updateProjectionMatrix(); C.baseZ=Math.max(190,105/(2*Math.tan(16*Math.PI/180)*C.cam.aspect));
    for(let i=C.tw.length-1;i>=0;i--){ const o=C.tw[i]; o.t+=dt; const k=Math.min(1,o.t/o.d); o.f(k); if(k>=1){ C.tw.splice(i,1); o.done&&o.done(); } }
    const m=C.pack3d;
    if(C.phase==='intro'||C.phase==='idle'){ const lv=lvOf(C.best), sh=calm()?0:C.charge*(0.5+lv*0.45);
      m.rotation.x=lerp(m.rotation.x,0.08+C.py*0.25,0.08)+(Math.random()-.5)*sh*0.03; if(C.phase==='idle') m.rotation.y=lerp(m.rotation.y,C.px*0.45+Math.sin(C.t*.8)*0.15,0.08);
      m.position.x=(Math.random()-.5)*sh*2; if(C.phase==='idle') m.position.y=Math.sin(C.t*1.7)*3;
      C.charge=Math.min(1,(C.charge||0)+dt*0.03*(1+lv)); C.spot.intensity=C.charge*(0.8+lv*0.6)+Math.sin(C.t*9)*C.charge*0.3;
      if(m.userData.glow) m.userData.glow.material.emissiveIntensity=1.4+Math.sin(C.t*4)*0.6+C.charge*3;
      // keep the swipe zone glued to the pack's tear line
      const top=this.screen(new T.Vector3(0,C.crate?16:36,0).applyMatrix4(m.matrixWorld)), tz=C.ov.querySelector('.po-tear'); tz.style.top=(top.y-28)+'px'; }
    // parts: spin + shiny shimmer
    C.objs.forEach(o=>{ const u=o.userData; u.spin.rotation.z-=u.spinV*dt; u.halo.material.rotation+=dt*0.5;
      if(u.revealed&&u.p.shiny){ u.hue=(u.hue+dt*0.35)%1; u.real.forEach(mt=>{ if(mt.emissive){ mt.emissive.setHSL(u.hue,1,.5); mt.emissiveIntensity=0.28; } }); u.halo.material.color.setHSL(u.hue,1,.6); }
      if(!u.revealed&&lvOf(u.p.rarity)>=2) u.halo.material.opacity=0.25+Math.sin(C.t*5+u.hue*6)*0.12; });
    // dust
    const a=C.dust.geometry.attributes.position; for(let i=0;i<a.count;i++){ let y=a.getY(i)+dt*(8+(i%7)); if(y>110) y=-110; a.setY(i,y); } a.needsUpdate=true;
    // camera shake
    C.shake=Math.max(0,C.shake-dt*2.2); const sk=calm()?0:C.shake*C.shake*4;
    C.cam.position.set((Math.random()-.5)*sk,(Math.random()-.5)*sk,C.baseZ*(C.zoom||1)); C.cam.lookAt(0,0,0);
    if(C.phase==='summary') this.labels();
    C.r.render(C.s,C.cam);
  },
  // ---------- rip ----------
  rip(skip){
    const C=this.cur; if(!C||(C.phase!=='idle'&&C.phase!=='intro')) return; C.phase='rip';
    const ov=C.ov, m=C.pack3d, lv=lvOf(C.best); ov.querySelector('.po-tear').hidden=true; ov.querySelector('[data-open]').hidden=true; ov.querySelector('[data-skip]').textContent='Reveal all';
    if(skip) C.fast=true;
    C.tw.length=0; m.position.set(0,0,0); m.rotation.set(0.05,0,0);
    const topY=C.crate?18:44, origin=new T.Vector3(0,topY,0);
    const o=this.screen(origin); this.flash(R(C.best).color,lv>=3?0.9:0.55); C.fx.burst(o.x,o.y,R(C.best).color,50+lv*30,{v:10+lv*2,life:1.2,s:3.5,rainbow:C.anyShiny,up:3});
    if(lv>=3) C.fx.rays(o.x,o.y,R(C.best).color,14); C.shake=0.6+lv*0.15; sfx('finish',lv>=3?'xtreme':lv>=2?'burst':'spin'); buzz(lv>=3?[40,30,90]:35);
    // the torn pieces fly off
    const flying=C.crate?[m.userData.glow,m.children[m.children.length-1]].filter(Boolean):[m.children[1],m.children[3]].filter(Boolean);
    flying.forEach((f,i)=>{ const vx=(i?-1:1)*(30+Math.random()*30), y0=f.position.y, z0=f.position.z;
      this.tween(0.9,k=>{ f.position.set(vx*E.out(k),y0+150*E.out(k),z0+40*k); f.rotation.z=(i?-1:1)*k*4; f.rotation.x=k*2; fade(f,1-k); },()=>f.visible=false); });
    // light pours out of the opening
    C.cone.position.set(0,topY+75,0); C.cone.material.opacity=0;
    this.tween(0.35,k=>{ C.cone.material.opacity=0.55*k; C.spot.intensity=2+lv; });
    // build the 3D parts, worst first so the best is last
    C.order=C.parts.map((p,i)=>i).sort((a,b)=>lvOf(C.parts[a].rarity)-lvOf(C.parts[b].rarity)||(C.parts[a].shiny?1:0)-(C.parts[b].shiny?1:0));
    C.objs=C.order.map(ix=>{ let o; try{ o=partObject(C.parts[ix]); }catch(e){ console.warn('part 3d',e); o=new T.Group(); o.userData={p:C.parts[ix],rad:10,spin:new T.Group(),meshes:[],real:[],halo:new T.Sprite(),spinV:0,revealed:false,hue:0}; }
      o.visible=false; C.s.add(o); return o; });
    const slots=this.rowSlots(C.objs.length);
    C.objs.forEach((o,i)=>{ const u=o.userData, sl=slots[i], sc0=4/u.rad;
      this.wait(0.25+i*0.16,()=>{ o.visible=true; o.position.copy(origin); o.scale.setScalar(sc0); u.spinV=10; sfx('ui','click');
        const from=origin.clone(), ctl=new T.Vector3(sl.x*0.4,topY+70+i*6,25);
        this.tween(0.7,k=>{ const e=E.out(k), a=from.clone().lerp(ctl,e), b=ctl.clone().lerp(sl.v,e); o.position.copy(a.lerp(b,e)); o.scale.setScalar(lerp(sc0,sl.s/u.rad,e)); },()=>{ u.spinV=1.5; }); }); });
    // pack drops away
    this.wait(0.45+C.objs.length*0.16,()=>{ const y0=m.position.y; this.tween(0.6,k=>{ m.position.y=y0-160*E.in(k); m.rotation.x=0.05+k*0.6; fade(m,1-k); },()=>{ m.visible=false; }); this.tween(0.8,k=>{ C.cone.material.opacity=0.55*(1-k); C.spot.intensity=lerp(2+lv,0.6,k); }); });
    this.wait(1.25+C.objs.length*0.16,()=>{ C.phase='ready'; if(C.fast) this.revealAll(); else this.hint('Tap to reveal'); });
  },
  rowSlots(n){ const v=this.vis(), cols=Math.max(1,Math.min(n,Math.floor(v.w/26))), rows=Math.ceil(n/cols), cw=v.w/cols, s=Math.min(11,cw*0.34);
    return Array.from({length:n},(_,i)=>{ const r=Math.floor(i/cols), c=i%cols, inRow=Math.min(cols,n-r*cols), x=(c-(inRow-1)/2)*cw, y=-v.h*0.31+(rows-1-r)*(s*2.6);
      return {v:new T.Vector3(x,y,0),x,s}; }); },
  hint(t){ const h=this.cur&&this.cur.ov.querySelector('.po-hint'); if(!h) return; h.hidden=!t; h.textContent=t||''; },
  tap(){ const C=this.cur; if(!C) return;
    if(C.phase==='ready') this.next(); else if(C.phase==='hold') this.park(()=>this.next()); else if(C.phase==='intro'||C.phase==='idle'){ /* tap on pack: nudge */ C.charge=Math.min(1,(C.charge||0)+0.08); C.shake=0.25; } },
  // ---------- reveal one ----------
  next(){
    const C=this.cur; if(!C) return; C.ri++; if(C.ri>=C.objs.length) return this.summary();
    C.phase='reveal'; this.hint(''); const o=C.objs[C.ri], u=o.userData, p=u.p, lv=lvOf(p.rarity), rc=R(p.rarity).color, fast=C.fast;
    const v=this.vis(), center=new T.Vector3(0,v.h*0.07,30), S=Math.min(26,v.w*0.3)/u.rad, from=o.position.clone(), s0=o.scale.x;
    u.home={v:from.clone(),s:s0};
    // fly to centre
    this.tween(fast?0.25:0.5,k=>{ const e=E.out(k); o.position.lerpVectors(from,center,e); o.scale.setScalar(lerp(s0,S,e)); u.spinV=lerp(1.5,16,e); });
    C.pillar.material.color.set(rc); C.ring.material.color.set(rc); C.ring2.material.color.set('#ffffff'); C.spot.color.set(rc);
    const charge=fast?0.18:[0.45,0.6,0.95,1.7,1.7][lv];
    this.wait(fast?0.2:0.4,()=>{ C.pillar.position.set(0,center.y-20,center.z-25); sfx('ui','open');
      if(lv>=3&&!fast){ this.dim(0.6); this.slam(p.rarity==='limited'?'LIMITED':'LEGENDARY',rc,true); }
      this.tween(charge,k=>{ C.pillar.material.opacity=0.7*E.in(k); C.pillar.scale.set(0.3+k*0.7,k,0.3+k*0.7); C.spot.intensity=1+k*(3+lv*2); u.halo.material.opacity=0.2+k*0.8; u.halo.material.color.set(rc);
        if(lv>=2&&!fast) C.shake=Math.max(C.shake,k*(0.3+lv*0.2)); C.zoom=lerp(1,lv>=3?0.84:0.92,E.inOut(k));
        if(!fast&&Math.random()<0.25+lv*0.1){ const sp=this.screen(o.position); C.fx.burst(sp.x+(Math.random()-.5)*160,sp.y+(Math.random()-.5)*160,rc,1,{v:1,g:-0.05,life:0.6,s:2}); } },
        ()=>this.pop(o,center)); });
  },
  pop(o,center){
    const C=this.cur, u=o.userData, p=u.p, lv=lvOf(p.rarity), rc=R(p.rarity).color, fast=C.fast;
    u.meshes.forEach((m,i)=>m.material=u.real[i]); u.revealed=true; u.spinV=fast?2:9;
    const sp=this.screen(o.position); this.flash(p.shiny?'#ffffff':rc,lv>=3?0.85:lv>=2?0.5:0.3);
    C.fx.burst(sp.x,sp.y,rc,fast?10:18+lv*22,{v:5+lv*2.5,life:0.8+lv*0.2,s:2.6,rainbow:p.shiny,stars:0.45});
    if(p.shiny) C.fx.burst(sp.x,sp.y,'#fff',36,{v:8,rainbow:true,stars:0.6});
    if(lv>=3&&!fast){ C.fx.rays(sp.x,sp.y,rc,12); C.shake=1.2; buzz([30,20,80]); } else if(lv>=2) buzz(25);
    sfx('ui',lv>=3?'legend':lv>=2?'epic':'flip');
    // shockwave rings
    [C.ring,C.ring2].forEach((rg,i)=>{ rg.position.copy(center); rg.position.z+=2; this.tween(fast?0.35:0.7+i*0.2,k=>{ rg.scale.setScalar(u.rad*o.scale.x*(1+k*(3+lv)*(1+i*0.4))); rg.material.opacity=(1-k)*(i?0.5:0.9); }); });
    this.tween(fast?0.3:0.9,k=>{ C.pillar.material.opacity=0.7*(1-k); C.spot.intensity=lerp(3+lv*2,0.7,k); C.zoom=lerp(C.zoom||1,1,k); u.spinV=lerp(fast?2:9,1.4,E.out(k)); });
    if(p.shiny&&!fast) this.slam('SHINY',null,false);
    this.dim(0);
    this.plate(p);
    if(fast){ this.wait(0.35,()=>this.park(()=>this.next())); }
    else this.wait(0.5,()=>{ C.phase='hold'; this.hint(C.ri<C.objs.length-1?'Tap for the next part':'Tap to see your haul'); });
  },
  park(done){ const C=this.cur, o=C.objs[C.ri]; if(!o) return done&&done(); C.phase='park'; this.hint(''); this.plate(null);
    const u=o.userData, from=o.position.clone(), s0=o.scale.x;
    this.tween(C.fast?0.18:0.35,k=>{ const e=E.inOut(k); o.position.lerpVectors(from,u.home.v,e); o.scale.setScalar(lerp(s0,u.home.s,e)); },done); },
  revealAll(){ const C=this.cur; if(!C) return; C.fast=true; if(C.phase==='ready') this.next(); else if(C.phase==='hold') this.park(()=>this.next()); },
  plate(p){ const el=this.cur&&this.cur.ov.querySelector('.po-plate'); if(!el) return; if(!p){ el.hidden=true; return; }
    const rr=R(p.rarity), iv=p.iv||{}, tot=Object.values(iv).reduce((a,b)=>a+b,0), el2=(()=>{ try{ const Pa=BF.Parts, PU=BF.PartsUI; const d=Pa.assemble(['blade','core','driver'].map(s=>s===p.slot?p:PU.dummy(s,p.system))); const e=BF.ELEMENTS[BF.partElements(d)[p.slot]]; return e?`${e.icon} ${e.label}`:''; }catch(e){ return ''; } })();
    el.style.setProperty('--rc',rr.color); el.className='po-plate'+(p.shiny?' shiny':'');
    el.innerHTML=`<span class="pp-r">${rr.label}${p.shiny?' · ✨ SHINY':''}${p._new?'<em class="pp-new">NEW!'+(p._dexN?' '+p._dexN:'')+'</em>':''}</span><b>${esc(p.name)}</b>
      <span class="pp-sub">${esc(BF.PART_LABEL[p.slot]||p.slot)}${el2?' · '+el2:''}</span>
      <span class="pp-iv">${Object.entries(iv).map(([k,v])=>`<i class="g-${BF.ivGrade(v)}" title="${k}">${(BF.PSTATS&&BF.PSTATS[k]||k).slice(0,3).toUpperCase()} <b>${v}</b></i>`).join('')}<em>${Math.round(tot/155*100)}%</em></span>`;
    el.hidden=false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); },
  slam(text,c,big){ const el=this.cur&&this.cur.ov.querySelector('.po-slam'); if(!el) return; el.textContent=text+'!'; el.style.setProperty('--sc',c||'#ffd36a'); el.className='po-slam'+(big?' big':'')+(c?'':' rainbow'); void el.offsetWidth; el.classList.add('go'); },
  dim(a){ const d=this.cur&&this.cur.ov.querySelector('.po-dim'); if(d) d.style.opacity=a; },
  flash(c,a){ const f=this.cur&&this.cur.ov.querySelector('.po-flash'); if(!f) return; f.style.background=c; f.style.transition='none'; f.style.opacity=calm()?a*0.4:a; requestAnimationFrame(()=>{ f.style.transition='opacity .7s ease-out'; f.style.opacity=0; }); },
  // ---------- lineup ----------
  summary(){
    const C=this.cur; if(!C||C.phase==='summary') return; C.phase='summary'; this.hint(''); this.plate(null); C.fast=false;
    const ov=C.ov, pk=C.pack, n=C.objs.length, v=this.vis(), cols=Math.max(1,Math.min(n,Math.floor(v.w/30))), rows=Math.ceil(n/cols), cw=v.w/cols, band=v.h*0.42, s=Math.min(17,cw*0.36,band/rows*0.3), top=v.h*0.3;
    C.objs.forEach((o,i)=>{ const r=Math.floor(i/cols), c=i%cols, inRow=Math.min(cols,n-r*cols), to=new T.Vector3((c-(inRow-1)/2)*cw, top-band*(r+0.5)/rows, 10), from=o.position.clone(), s0=o.scale.x, u=o.userData;
      this.wait(i*0.08,()=>this.tween(0.6,k=>{ const e=E.back(k); o.position.lerpVectors(from,to,e); o.scale.setScalar(lerp(s0,s/u.rad,E.out(k))); u.spinV=1.1; })); });
    const counts={}; C.parts.forEach(p=>counts[p.rarity]=(counts[p.rarity]||0)+1);
    const live=pk.id&&BF.Packs.get(pk.id), left=live?BF.Packs.pityLeft(live):null, newN=C.parts.filter(p=>p._new).length;
    const price=live?(BF.Store6?BF.Store6.adjust('p:'+pk.id,BF.Packs.price(live)):BF.Packs.price(live)):0, coins=(BF.Account&&BF.Account.profile&&BF.Account.profile.coins)||0;
    const box=ov.querySelector('.po-sum'); box.hidden=false;
    box.innerHTML=`<div class="po-cnt">${ORDER.filter(k=>counts[k]).map(k=>`<span style="--rc:${R(k).color}">${counts[k]}× ${R(k).label}</span>`).join('')}${C.anyShiny?'<span class="sh">✨ Shiny!</span>':''}${newN?`<span class="nw">${newN} new</span>`:''}</div>
      ${left!=null&&live.pity?`<div class="po-pity"><span>Legendary guaranteed in <b>${left}</b> ${left===1?'pack':'packs'}</span><i style="width:${Math.round((1-left/live.pity)*100)}%"></i></div>`:''}
      <div class="po-acts2">${live?`<button type="button" class="btn primary big" data-again${coins&&coins<price?' disabled':''}><span class="coin">${price}</span> Open another</button>`:''}<button type="button" class="btn${live?' ghost':' primary'}" data-parts>My parts</button><button type="button" class="btn ghost" data-done>Done</button></div>`;
    ov.querySelector('.po-acts').hidden=true;
    box.querySelector('[data-done]').onclick=()=>this.close();
    box.querySelector('[data-parts]').onclick=()=>{ this.close(); const tb=document.querySelector('#tabs [data-tab=parts]'); tb&&tb.click(); };
    const ag=box.querySelector('[data-again]'); if(ag) ag.onclick=()=>{ const id=pk.id; this.close(true); BF.Store6?BF.Store6.buy('p:'+id,'coins'):BF.PartsUI.buyPack(id); };
    sfx('ui','coin');
  },
  labels(){ const C=this.cur, box=C.ov.querySelector('.po-labels');
    if(!C._lab){ C._lab=true; box.innerHTML=C.objs.map(o=>{ const p=o.userData.p; return `<div class="po-lab" style="--rc:${R(p.rarity).color}">${p._new?'<em>NEW'+(p._dexN?' '+p._dexN:'')+'</em>':''}<b>${p.shiny?'✨ ':''}${esc(p.name)}</b><span>${R(p.rarity).label}</span></div>`; }).join(''); }
    [...box.children].forEach((el,i)=>{ const o=C.objs[i], u=o.userData, sp=this.screen(o.position.clone().add(new T.Vector3(0,-u.rad*o.scale.x*1.25,0))); el.style.transform=`translate(${sp.x}px,${sp.y}px) translate(-50%,0)`; }); },
  close(silent){ const C=this.cur; if(!C) return; this.cur=null; C.on=false;
    try{ C.r.dispose(); C.r.forceContextLoss(); }catch(e){}
    C.fx.stop(); C.ov.remove(); document.body.classList.remove('po-on'); if(C.onClose&&!silent) setTimeout(C.onClose,100);
    if(!silent){ const pv=document.getElementById('view-parts'); BF.PartsUI&&pv&&!pv.hidden&&BF.PartsUI.render(); BF.Store6&&BF.Store6.render(); } }
};
addEventListener('keydown',e=>{ const C=PO.cur; if(!C) return; if(e.key==='Escape'&&C.phase==='summary') PO.close(); if(e.key===' '||e.key==='Enter'){ e.preventDefault(); if(C.phase==='idle'||C.phase==='intro') PO.rip(); else PO.tap(); } });
})();
