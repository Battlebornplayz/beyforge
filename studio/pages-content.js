/* BeyForge Studio — Content: create packs, parts and cosmetics with no code.
   Wizards or one-page quick edit · live 3D preview · drafts, review, publish now, schedule, % rollout, test in-game · version history */
(function(){
'use strict';
const S=window.Studio, BF=window.BF, {$,$$,esc,FV}=S;
const KINDS={pack:{icon:'🎁',label:'Pack / crate',desc:'A new pack or crate with your own art colors, odds, price and pity.'},
  part:{icon:'⚙',label:'Part',desc:'A named blade, ratchet/disc or bit that can drop from packs and battles or be sold in the shop.'},
  cosmetic:{icon:'✨',label:'Cosmetic',desc:'Profile banners, avatar frames, UI themes, spin trails and auras for the shop.'}};
const RC={common:'#9aa3b5',rare:'#22d3ee',epic:'#a78bfa',legendary:'#f5c518',limited:'#f472b6'};
const RAR=['common','rare','epic','legendary'];
const slug=s=>String(s||'item').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,24)||'item';
const rnd=()=>Math.random().toString(36).slice(2,6);
const getP=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setP=(o,p,v)=>{ const ks=p.split('.'); let t=o; ks.slice(0,-1).forEach((k,i)=>{ if(t[k]==null) t[k]=/^\d+$/.test(ks[i+1])?[]:{}; t=t[k]; }); t[ks[ks.length-1]]=v; };
const cosCss=(cat,key,d)=>cat==='banner'?`.bn-${key}{background:${d.image?`url(${d.image}) center/cover,`:''}${d.css||`radial-gradient(500px 260px at 75% 0,${d.c2||'#ff2e88'}66,transparent 70%),linear-gradient(135deg,${d.c1||'#2ef2ff'}55,#0b0a16 70%)`}}`
  :cat==='frame'?`.fr-${key}{background:conic-gradient(from 0deg,${d.c1},${d.c2},${d.c1});box-shadow:0 0 ${d.glow||12}px ${d.c1}}`:'';

// status as players see it
function liveState(c){ const now=Date.now();
  if(c.status==='draft') return ['Draft',''];  if(c.status==='review') return ['In review','warn'];
  if(c.end&&now>=c.end) return ['Ended','']; if(c.start&&now<c.start) return ['Scheduled','info'];
  if(c.rollout!=null&&c.rollout<100) return [`Live · ${c.rollout}%`,'good']; return ['Live','good']; }

// ---------- defaults ----------
function fresh(kind){
  if(kind==='pack') return {name:'New Pack',data:{name:'New Pack',desc:'3 parts — one blade, one core, one driver.',model:'pack',colors:['#22d3ee','#f472b6'],count:3,slots:'each',odds:{common:55,rare:30,epic:12,legendary:3},shiny:64,pity:30,price:500,gems:0,element:null,enabled:true}};
  if(kind==='part'){ const d=BF.Parts.randomDesign('X'); return {name:'',data:{slot:'blade',rarity:'epic',design:d,name:'',autoName:true,dropWeight:20,packs:[],shopPrice:0,shopGems:0}}; }
  return {name:'New Banner',data:{cat:'banner',name:'New Banner',price:300,c1:'#22d3ee',c2:'#f472b6',glow:12,base:'fire',image:null}};
}

// ---------- 3D preview (one renderer per editor) ----------
function Viewer(canvas){
  const T=THREE, r=new T.WebGLRenderer({canvas,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=0.95; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
  const s=new T.Scene(); s.add(new T.HemisphereLight(0xcfe0ff,0x1a1030,.55)); const k=new T.DirectionalLight(0xffffff,.9); k.position.set(80,-60,140); s.add(k);
  const c1=new T.PointLight(0x22d3ee,.6,500); c1.position.set(-120,60,60); s.add(c1); const c2=new T.PointLight(0xf472b6,.6,500); c2.position.set(120,80,40); s.add(c2);
  const cam=new T.PerspectiveCamera(30,1,1,3000); cam.up.set(0,0,1); let obj=null, on=true, drag=null, yaw=0, pitch=0.62, dist=150;
  canvas.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY,yaw,pitch}; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove',e=>{ if(!drag) return; yaw=drag.yaw-(e.clientX-drag.x)*0.01; pitch=Math.max(0.05,Math.min(1.45,drag.pitch+(e.clientY-drag.y)*0.01)); });
  canvas.addEventListener('pointerup',()=>drag=null); canvas.addEventListener('wheel',e=>{ e.preventDefault(); dist=Math.max(50,Math.min(400,dist*(1+e.deltaY*0.001))); },{passive:false});
  const loop=t=>{ if(!on) return; requestAnimationFrame(loop); const w=canvas.clientWidth||300,h=canvas.clientHeight||300; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
    if(!drag) yaw+=0.004; cam.position.set(Math.cos(yaw)*Math.cos(pitch)*dist,Math.sin(yaw)*Math.cos(pitch)*dist,Math.sin(pitch)*dist); cam.lookAt(0,0,0); if(obj&&obj.userData.spin) obj.userData.spin.rotation.z-=0.03; r.render(s,cam); };
  requestAnimationFrame(loop);
  return { set(o,fit){ if(obj) s.remove(obj); obj=o; if(o){ s.add(o); dist=(fit||25)*5.2; } }, stop(){ on=false; r.dispose(); r.forceContextLoss(); } };
}
function partMesh(design,slot,whole){
  const T=THREE, d=BF.normalize(BF.clone(design)), asm=BF.build(d), main=asm.parts.filter(x=>x.id!=='chip');
  let pick=whole?asm.parts:[main[{blade:0,core:1,driver:2}[slot]]]; if(!whole&&slot==='blade') pick=pick.concat(asm.parts.filter(x=>x.id==='chip'));
  const inner=new T.Group(); pick.forEach(part=>part.bodies.forEach(b=>{ const m=new T.Mesh(b.geo,BF.materialFor(d,part,b,{})); m.position.z=part.z0; inner.add(m); }));
  const box=new T.Box3().setFromObject(inner), c=box.getCenter(new T.Vector3()), sz=box.getSize(new T.Vector3()); inner.children.forEach(m=>m.position.sub(c));
  const spin=new T.Group(); spin.add(inner); const g=new T.Group(); g.add(spin); g.userData.spin=spin; return {g,r:Math.max(sz.x,sz.y,sz.z)/2}; }

// ---------- step definitions per kind ----------
function steps(kind,st){ const d=st.data, F=S.f;
  if(kind==='pack'){ const sum=RAR.reduce((a,r)=>a+(+d.odds[r]||0),0)+(+d.odds.limited||0);
    return [
    ['Basics',()=>F.text('data.name','Pack name',d.name,{max:28})+F.area('data.desc','Description (shown in the shop)',d.desc,{max:90,rows:2})+
      `<div class="grid2">${F.sel('data.model','Model',d.model,{pack:'Foil pack',crate:'Crate'})}${F.sel('data.element','Element theme',d.element||'',Object.assign({'':'None (any element)',daily:'Today’s element (rotates daily)'},Object.fromEntries(Object.entries(BF.ELEMENTS).map(([k,e])=>[k,e.icon+' '+e.label]))))}</div>
      <div class="grid2">${F.color('data.colors.0','Main color',d.colors[0])}${F.color('data.colors.1','Second color',d.colors[1])}</div>`],
    ['Contents & odds',()=>`<div class="grid2">${F.num('data.count','Parts inside',d.count,{min:1,max:6})}${F.sel('data.slots','Which slots',d.slots,{each:'One of each (blade, core, driver)',random:'Random slots'})}</div>
      <h4>Odds <span class="sum ${Math.round(sum)===100?'ok':'bad'}" id="oddSum">${+sum.toFixed(2)}% ${Math.round(sum)===100?'✓':'— must add up to 100%'}</span></h4>
      ${RAR.concat(['limited']).map(r=>F.range('data.odds.'+r,(BF.RARITY[r]||{label:r}).label,+d.odds[r]||0,{min:0,max:100,step:0.5,unit:'%'})).join('')}
      <div class="grid2">${F.num('data.shiny','Shiny chance: 1 in',d.shiny,{min:2,max:999,hint:'Lower = more shinies'})}${F.num('data.pity','Pity: guaranteed Legendary every',d.pity,{min:0,max:200,hint:'packs (0 = no pity)'})}</div>`],
    ['Price',()=>`<div class="grid2">${F.num('data.price','Price in coins',d.price,{min:0,step:10})}${F.num('data.gems','Price in gems (0 = coins only)',d.gems,{min:0})}</div>${F.tog('data.enabled','Show in the shop',d.enabled!==false,'Turn off to keep it hidden (e.g. gift-only packs)')}`]]; }
  if(kind==='part'){ const g=d.design, X=g.system==='X', sl=d.slot, D=k=>'data.design.'+k;
    const shape=sl==='blade'?[F.sel(D('blade.shape'),'Wing shape',g.blade.shape,Object.fromEntries(Object.entries(BF.WING_SHAPES).filter(([k])=>k!=='custom'))),F.range(D('blade.wings'),'Wings / contact points',g.blade.wings,{min:1,max:8}),
        F.range(D('blade.wingWidth'),'Wing width',g.blade.wingWidth,{min:0.2,max:1,step:0.01}),F.range(D('blade.depth'),'Wing reach',g.blade.depth,{min:0.05,max:0.5,step:0.01}),F.range(D('blade.sweep'),'Wing sweep',g.blade.sweep,{min:-35,max:35,unit:'°'}),
        F.range(D('blade.height'),'Core height',g.blade.height,{min:6,max:16,step:0.5,unit:'mm'}),F.range(D('blade.tipHeight'),'Wing-tip thickness',g.blade.tipHeight,{min:1.2,max:16,step:0.2,unit:'mm'}),F.range(D('blade.slope'),'Contact angle',g.blade.slope,{min:-30,max:35,unit:'°'}),
        F.range(D('deco.horns.count'),'Horns',g.deco.horns.count,{min:0,max:4}),F.range(D('blade.cutouts.count'),'Cutouts',g.blade.cutouts.count,{min:0,max:6}),F.tog(D('chip.on'),'Center chip / cap',!!g.chip.on)]
      :sl==='core'?(X?[F.range(D('ratchet.points'),'Ratchet points',g.ratchet.points,{min:3,max:9}),F.range(D('ratchet.height'),'Ratchet height',g.ratchet.height,{min:50,max:80,step:5})]
        :[F.sel(D('disc.shape'),'Disc shape',g.disc.shape,BF.DISC_SHAPES),F.range(D('disc.lobes'),'Lobes / points',g.disc.lobes,{min:2,max:8}),F.range(D('disc.diameter'),'Diameter',g.disc.diameter,{min:26,max:42,step:0.5,unit:'mm'}),F.range(D('disc.thickness'),'Thickness',g.disc.thickness,{min:2,max:8,step:0.5,unit:'mm'}),F.range(D('disc.rim'),'Rim weight',g.disc.rim,{min:0,max:1,step:0.05})])
      :[F.sel(D('bit.tip'),'Tip',g.bit.tip,Object.fromEntries(Object.entries(BF.TIPS).filter(([k])=>k!=='custom').map(([k,t])=>[k,t.label||k]))),F.range(D('bit.width'),'Tip width',g.bit.width,{min:2,max:12,step:0.5,unit:'mm'}),F.range(D('bit.tipLen'),'Tip height',g.bit.tipLen,{min:2,max:9,step:0.5,unit:'mm'})].concat(X?[F.tog(D('bit.gear'),'Xtreme Dash gear',!!g.bit.gear)]:[]);
    const pk=sl==='blade'?['blade','accent']:sl==='core'?[X?'ratchet':'disc']:['bit','tip'];
    const paint=pk.map(k=>{ const p=g.paint[k]; return `<h4>${{blade:X?'Blade':'Layer',accent:'Accents',ratchet:'Ratchet',disc:'Disc',bit:X?'Bit':'Driver',tip:'Tip'}[k]}</h4><div class="grid2">${F.color(D('paint.'+k+'.color'),'Color',p.color)}${F.sel(D('paint.'+k+'.finish'),'Finish',p.finish,BF.FINISHES)}</div>`+
      (k==='blade'?`<div class="grid2">${F.sel(D('paint.blade.style'),'Style',p.style,{solid:'Solid',gradient:'Gradient',twotone:'Two-tone'})}${F.color(D('paint.blade.color2'),'Second color',p.color2)}</div><div class="grid2">${F.sel(D('paint.blade.pattern'),'Pattern',p.pattern,BF.PATTERNS)}${F.color(D('paint.blade.patternColor'),'Pattern color',p.patternColor)}</div>`:''); }).join('');
    const packs=BF.Packs.list();
    return [
    ['Start',()=>`<p class="muted">Pick what kind of part this is, then start from a famous design or roll a random one. You can also paste a Bey code from the Forge (Share → Copy code).</p>
      ${F.sel('data.slot','Part type',sl,{blade:'Blade / layer',core:'Ratchet / disc',driver:'Bit / driver'})}${F.sel('data.design.system','System',g.system,{X:'Beyblade X style',Burst:'Burst style'})}
      <div class="row wrap"><select class="inp" id="preset"><option value="">Start from a preset…</option>${BF.PRESETS.map(p=>`<option value="${p.id}">${esc(p.name)} — ${esc(p.blurb||'')}</option>`).join('')}</select><button class="btn" id="roll">🎲 Random</button></div>
      <div class="row"><input class="inp grow" id="code" placeholder="Paste a BF1… Bey code"><button class="btn" id="useCode">Use code</button></div>`],
    ['Shape',()=>`<div class="grid2">${shape.join('')}</div>`],
    ['Paint',()=>paint],
    ['Rarity & name',()=>`${F.sel('data.rarity','Rarity',d.rarity,{common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary (gets a signature move)',limited:'Limited'})}
      ${F.tog('data.autoName','Auto-name from its shape',d.autoName!==false)}${F.text('data.name','Name',d.name||BF.Parts.nameOf(sl,BF.Parts.extract(BF.normalize(BF.clone(g)),sl)),{max:30})}
      <p class="muted">Element: <b id="elOut"></b> (comes from the part’s shape)</p>`],
    ['Where it drops',()=>`${F.range('data.dropWeight','Chance to replace a normal pull of the same rarity',d.dropWeight||0,{min:0,max:90,unit:'%'})}
      <p class="hint">Example: Epic + 20% → whenever someone pulls an Epic ${esc(sl)} from an allowed pack, 20% of the time it’s this part instead.</p>
      <h4>Can drop from</h4><div class="chks">${packs.map(p=>`<label class="chk"><input type="checkbox" data-pk="${p.id}"${!d.packs.length||d.packs.includes(p.id)?' checked':''}>${esc(p.name)}</label>`).join('')}<label class="chk"><input type="checkbox" data-pk="drop"${!d.packs.length||d.packs.includes('drop')?' checked':''}>Battle drops</label></div>
      <h4>Sell it in the shop</h4><div class="grid2">${F.num('data.shopPrice','Coins (0 = not sold)',d.shopPrice||0,{min:0,step:50})}${F.num('data.shopGems','Gems',d.shopGems||0,{min:0})}</div>`]]; }
  // cosmetics
  const cat=d.cat, base={trail:BF.COSMETICS.trail,aura:BF.COSMETICS.aura,launch:BF.COSMETICS.launch,win:BF.COSMETICS.win}[cat];
  return [
    ['Type',()=>F.sel('data.cat','What is it?',cat,{banner:'Profile banner',frame:'Avatar frame',theme:'UI theme',trail:'Spin trail',aura:'Aura',launch:'Launch effect',win:'Win animation'})+F.text('data.name','Name',d.name,{max:24})],
    ['Look',()=>`<div class="grid2">${F.color('data.c1',cat==='theme'?'Accent color':'Main color',d.c1)}${['banner','frame','theme'].includes(cat)?F.color('data.c2','Second color',d.c2):''}</div>
      ${base?F.sel('data.base','Effect style',d.base||Object.keys(base)[1],Object.fromEntries(Object.entries(base).filter(([k])=>k!=='none'))):''}
      ${cat==='theme'?F.sel('data.base','Based on theme',d.base||'hybrid',Object.fromEntries(Object.entries(BF.UI_THEMES||{hybrid:{label:'Hybrid'}}).filter(([,t])=>!t.custom).map(([k,t])=>[k,t.label]))):''}
      ${cat==='frame'?F.range('data.glow','Glow',d.glow||12,{min:0,max:40,unit:'px'}):''}
      ${cat==='banner'?`<label class="fld"><span>Image (optional, it’s compressed automatically)</span><input type="file" accept="image/*" id="img"></label>${d.image?'<button class="btn xs" id="noimg">Remove image</button>':''}`:''}`],
    ['Price',()=>F.num('data.price','Price in coins (0 = free for everyone)',d.price,{min:0,step:10})]];
}

// ---------- previews ----------
function preview(kind,st,box,ctx){
  const d=st.data;
  if(kind==='pack'){ if(!box.querySelector('canvas')) box.innerHTML='<canvas class="pv3d"></canvas><div class="pvcap"></div>';
    clearTimeout(ctx.pt); ctx.pt=setTimeout(()=>{ ctx.live&&ctx.live.stop(); try{ ctx.live=BF.PackModel.live(box.querySelector('canvas'),Object.assign({id:'preview'},d)); }catch(e){ console.warn(e); } },250);
    box.querySelector('.pvcap').innerHTML=`<b>${esc(d.name)}</b><span>${esc(BF.Packs.oddsText(d))}</span><span>${d.price} coins${d.gems?` · ${d.gems} gems`:''}</span>`; return; }
  if(kind==='part'){ if(!box.querySelector('canvas')){ box.innerHTML='<canvas class="pv3d"></canvas><div class="pvcap"></div><label class="tog sm"><input type="checkbox" id="whole"><i></i><span>Show on a full Bey</span></label>'; ctx.v=Viewer(box.querySelector('canvas')); box.querySelector('#whole').onchange=()=>preview(kind,st,box,ctx); }
    clearTimeout(ctx.pt); ctx.pt=setTimeout(()=>{ try{ const m=partMesh(d.design,d.slot,box.querySelector('#whole').checked); ctx.v.set(m.g,m.r); }catch(e){ console.warn('part preview',e); } },120);
    const g=BF.normalize(BF.clone(d.design)), el=BF.ELEMENTS[BF.partElements(g)[d.slot]];
    box.querySelector('.pvcap').innerHTML=`<span class="pill" style="--pc:${RC[d.rarity]}">${esc(BF.RARITY[d.rarity].label)}</span><b>${esc(d.name||BF.Parts.nameOf(d.slot,BF.Parts.extract(g,d.slot)))}</b><span>${el?el.icon+' '+el.label:''} · ${esc(BF.PART_LABEL[d.slot])}</span>`;
    const eo=$('#elOut'); if(eo) eo.textContent=el?el.icon+' '+el.label:'—'; return; }
  // cosmetics
  const key='pv'; let st2=document.getElementById('pvCss'); if(!st2){ st2=document.createElement('style'); st2.id='pvCss'; document.head.appendChild(st2); } st2.textContent=cosCss(d.cat,key,d);
  const name=esc(S.profile.name||'Blader');
  if(d.cat==='banner'||d.cat==='frame') box.innerHTML=`<div class="pcard-pv ${d.cat==='banner'?'bn-pv':''}"><span class="fr-ring ${d.cat==='frame'?'fr-pv':''}"><span class="avatar lg">${name[0]}</span></span><div><b>${name}</b><span>Level 12 · Rookie Blader</span></div></div><div class="pvcap"><b>${esc(d.name)}</b><span>${d.price?d.price+' coins':'Free'}</span></div>`;
  else if(d.cat==='theme') box.innerHTML=`<div class="theme-pv" style="--a:${d.c1};--b:${d.c2}"><div class="tp-top"><b>BEY</b><i>FORGE</i></div><div class="tp-body"><span class="tp-btn">Battle</span><span class="tp-btn ghost">Forge</span><div class="tp-card"></div></div><div class="tp-dock"><i></i><i class="on"></i><i></i><i></i></div></div><div class="pvcap"><b>${esc(d.name)}</b><span>${d.price} coins</span></div>`;
  else { box.innerHTML=`<canvas class="fxpv" width="320" height="260"></canvas><div class="pvcap"><b>${esc(d.name)}</b><span>${esc(d.cat)} · based on ${esc(d.base||'')}</span></div>`; fxPreview(box.querySelector('canvas'),d,ctx); }
}
function fxPreview(c,d,ctx){ cancelAnimationFrame(ctx.raf); const x=c.getContext('2d'), pts=[]; let t=0;
  const loop=()=>{ ctx.raf=requestAnimationFrame(loop); if(!c.isConnected) return cancelAnimationFrame(ctx.raf); t+=1/60; x.fillStyle='rgba(8,10,14,.35)'; x.fillRect(0,0,320,260);
    x.strokeStyle='#1f2630'; x.lineWidth=2; x.beginPath(); x.ellipse(160,130,140,110,0,0,7); x.stroke();
    const bx=160+Math.cos(t*1.6)*90, by=130+Math.sin(t*1.6)*62; pts.push([bx,by]); if(pts.length>40) pts.shift();
    if(d.cat==='trail'){ x.globalCompositeOperation='lighter'; pts.forEach((p,i)=>{ x.fillStyle=d.c1; x.globalAlpha=i/pts.length*0.6; x.beginPath(); x.arc(p[0],p[1],3+i/pts.length*10,0,7); x.fill(); }); x.globalAlpha=1; x.globalCompositeOperation='source-over'; }
    if(d.cat==='aura'){ const g=x.createRadialGradient(bx,by,4,bx,by,46+Math.sin(t*6)*6); g.addColorStop(0,d.c1); g.addColorStop(1,'transparent'); x.fillStyle=g; x.globalAlpha=.7; x.beginPath(); x.arc(bx,by,52,0,7); x.fill(); x.globalAlpha=1; }
    if(d.cat==='launch'&&(t%2)<0.8){ const k=(t%2)/0.8; x.strokeStyle=d.c1; x.globalAlpha=1-k; x.lineWidth=4; x.beginPath(); x.arc(160,130,20+k*110,0,7); x.stroke(); x.globalAlpha=1; }
    if(d.cat==='win'&&Math.random()<0.5){ x.fillStyle=Math.random()<0.5?d.c1:'#fff'; x.fillRect(Math.random()*320,Math.random()*260,4,8); }
    x.save(); x.translate(bx,by); x.rotate(t*20); x.fillStyle='#e6e8eb'; x.beginPath(); for(let i=0;i<3;i++){ x.rotate(Math.PI*2/3); x.moveTo(0,0); x.arc(0,0,14,0,1.4); } x.fill(); x.fillStyle='#0b0d10'; x.beginPath(); x.arc(0,0,4,0,7); x.fill(); x.restore(); };
  loop(); }

// image → small webp data URL (free-plan uploads live inside the database)
async function squeeze(file,maxW,maxH,limit){ const img=await createImageBitmap(file); let w=img.width,h=img.height,k=Math.min(1,maxW/w,maxH/h); w=Math.round(w*k); h=Math.round(h*k);
  const c=document.createElement('canvas'); c.width=w; c.height=h; c.getContext('2d').drawImage(img,0,0,w,h); let q=0.85, url=c.toDataURL('image/webp',q); while(url.length>limit&&q>0.3){ q-=0.1; url=c.toDataURL('image/webp',q); }
  if(url.length>limit) throw new Error('Image is too big even after compressing — try a smaller one'); return url; }

// ---------- editor ----------
async function editor(v,kind,id){
  const ref=id?S.db.collection('content').doc(id):S.db.collection('content').doc();
  let doc=null; if(id){ const s=await ref.get(); if(!s.exists){ v.innerHTML=S.empty('?','Not found',''); return; } doc=s.data(); kind=doc.kind; }
  const st=doc?{name:doc.name,key:doc.key,data:BF.clone(doc.data)}:Object.assign({key:null},fresh(kind));
  if(kind==='part') st.data.design=BF.normalize(st.data.design);
  const canPub=S.can('publish','edit'), canEdit=S.can('content','edit');
  let step=0, mode='wizard', dirty=false; const ctx={};
  S.onLeave(()=>{ ctx.live&&ctx.live.stop(); ctx.v&&ctx.v.stop(); cancelAnimationFrame(ctx.raf); });
  const [ls,lt]=doc?liveState(doc):['New',''];
  v.innerHTML=`<div class="ed-head"><a href="#/content" class="back">← Content</a><h1><span class="kic">${KINDS[kind].icon}</span><span id="edName">${esc(st.name||st.data.name||'Untitled')}</span> ${S.pill(ls,lt)}</h1>
      <div class="seg" id="modeSeg"><button data-m="wizard" class="on">Step by step</button><button data-m="all">All fields</button>${id?'<button data-m="history">History</button>':''}</div></div>
    <div class="editor"><div class="ed-main"><div class="steps" id="steps"></div><div class="ed-form card" id="form"></div><div class="ed-nav" id="enav"></div></div>
      <aside class="ed-side"><div class="card pv" id="pv"></div><div class="card" id="pub"></div></aside></div>`;
  const SL=()=>steps(kind,st);
  const draw=()=>{ const list=SL(); step=Math.min(step,list.length-1);
    $('#steps',v).innerHTML=mode==='wizard'?list.map(([t],i)=>`<button class="${i===step?'on':i<step?'done':''}" data-s="${i}"><i>${i<step?'✓':i+1}</i>${esc(t)}</button>`).join(''):'';
    $('#form',v).innerHTML=mode==='wizard'?`<h3>${esc(list[step][0])}</h3>${list[step][1]()}`:list.map(([t,f])=>`<h3>${esc(t)}</h3>${f()}`).join('<hr>');
    $('#enav',v).innerHTML=mode==='wizard'?`<button class="btn" id="prev"${step?'':' disabled'}>← Back</button><span class="muted">Step ${step+1} of ${list.length}</span>${step<list.length-1?'<button class="btn primary" id="next">Next →</button>':'<span></span>'}`:'';
    $$('#steps button',v).forEach(b=>b.onclick=()=>{ step=+b.dataset.s; draw(); });
    const pv=$('#prev',v), nx=$('#next',v); if(pv) pv.onclick=()=>{ step--; draw(); }; if(nx) nx.onclick=()=>{ step++; draw(); };
    if(!canEdit) $$('#form input,#form select,#form textarea',v).forEach(i=>i.disabled=true);
    extras(); preview(kind,st,$('#pv',v),ctx); };
  // special controls inside steps
  const extras=()=>{ const q=s=>$(s,v);
    if(q('#roll')) q('#roll').onclick=()=>{ const sys=st.data.design.system; st.data.design=BF.Parts.randomDesign(sys); dirty=true; draw(); };
    if(q('#preset')) q('#preset').onchange=e=>{ const p=BF.PRESETS.find(x=>x.id===e.target.value); if(p){ st.data.design=BF.normalize(BF.fromPreset(p)); dirty=true; draw(); } };
    if(q('#useCode')) q('#useCode').onclick=async()=>{ try{ const d=await BF.Share.decode(q('#code').value); st.data.design=BF.normalize(d); dirty=true; draw(); S.toast('Design loaded','good'); }catch(e){ S.toast(e.message,'bad'); } };
    $$('[data-pk]',v).forEach(c=>c.onchange=()=>{ const all=$$('[data-pk]',v), on=all.filter(x=>x.checked).map(x=>x.dataset.pk); st.data.packs=on.length===all.length?[]:on; dirty=true; });
    if(q('#img')) q('#img').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; try{ st.data.image=await squeeze(f,1200,400,300000); dirty=true; draw(); S.toast('Image added','good'); }catch(err){ S.toast(err.message,'bad'); } };
    if(q('#noimg')) q('#noimg').onclick=()=>{ st.data.image=null; dirty=true; draw(); };
  };
  // live binding: every field writes straight into the state
  $('#form',v).addEventListener('input',onField); $('#form',v).addEventListener('change',onField);
  function onField(e){ const i=e.target; if(!i.dataset||!i.dataset.f) return; let val=i.type==='checkbox'?i.checked:i.value; if(i.dataset.num!=null) val=i.value===''?0:+i.value; if(i.dataset.f.endsWith('element')&&val==='') val=null;
    setP(st,i.dataset.f,val); dirty=true;
    if(i.type==='range'){ const b=$(`[data-rv="${i.dataset.f}"]`,v); if(b) b.textContent=i.value+(i.dataset.unit||''); } if(i.type==='color'){ const c=i.parentNode.querySelector('code'); if(c) c.textContent=i.value; }
    if(kind==='part'&&st.data.autoName!==false&&i.dataset.f!=='data.name'){ st.data.name=BF.Parts.nameOf(st.data.slot,BF.Parts.extract(BF.normalize(BF.clone(st.data.design)),st.data.slot)); const n=$('[data-f="data.name"]',v); if(n) n.value=st.data.name; }
    if(kind==='part'&&i.dataset.f==='data.design.system'){ st.data.design=BF.normalize(st.data.design); }
    st.name=st.data.name; $('#edName',v).textContent=st.name||'Untitled';
    const structural=['data.slot','data.design.system','data.cat','data.autoName','data.design.blade.shape','data.design.disc.shape'].includes(i.dataset.f)||/^data\.odds/.test(i.dataset.f)&&e.type==='change';
    if(/^data\.odds/.test(i.dataset.f)){ const s=['common','rare','epic','legendary','limited'].reduce((a,r)=>a+(+st.data.odds[r]||0),0), o=$('#oddSum',v); if(o){ o.textContent=+s.toFixed(2)+'% '+(Math.round(s)===100?'✓':'— must add up to 100%'); o.className='sum '+(Math.round(s)===100?'ok':'bad'); } }
    if(structural&&e.type==='change'){ if(i.dataset.f==='data.cat'){ st.data.base=null; } draw(); } else preview(kind,st,$('#pv',v),ctx); pubPanel(); }
  $$('#modeSeg button',v).forEach(b=>b.onclick=()=>{ $$('#modeSeg button',v).forEach(x=>x.classList.toggle('on',x===b)); mode=b.dataset.m; if(mode==='history') history(); else draw(); });
  // ----- publish panel -----
  let pubMode=doc?(doc.status==='draft'?'draft':doc.status==='review'?'review':(doc.start&&doc.start>Date.now()?'schedule':'live')):'draft';
  const pubPanel=()=>{ const P=$('#pub',v), F=S.f, sched=pubMode==='schedule', live=pubMode==='live'||sched;
    const opts=[['draft','Save as draft','Only Studio can see it'],['review','Send for review',canPub?'Someone else checks it first':'An admin approves it before it goes live'],...(canPub?[['live','Publish now','Players get it right away'],['schedule','Schedule','Goes live (and ends) on its own']]:[])];
    const tester=doc&&(doc.testers||[]).includes(S.user.uid);
    P.innerHTML=`<h3>Publish</h3><div class="radios">${opts.map(([k,l,h])=>`<label class="radio${pubMode===k?' on':''}"><input type="radio" name="pm" value="${k}"${pubMode===k?' checked':''}><span><b>${l}</b><em>${h}</em></span></label>`).join('')}</div>
      ${sched?F.dt('start','Goes live',doc&&doc.start||Date.now()+86400000):''}${live||pubMode==='review'?F.dt('end','Ends (optional)',doc&&doc.end):''}
      ${live||pubMode==='review'?F.range('rollout','Who gets it',doc&&doc.rollout!=null?doc.rollout:100,{min:5,max:100,step:5,unit:'%'})+'<p class="hint">Under 100% = slow rollout to a random slice of players first.</p>':''}
      ${F.area('note','Change note (optional)','',{rows:2,max:140})}
      <button class="btn primary wide" id="save"${canEdit?'':' disabled'}>${{draft:'Save draft',review:'Send for review',live:'Publish now',schedule:'Schedule'}[pubMode]}</button>
      <div class="row wrap mt"><button class="btn sm" id="test"${id?'':' disabled'} title="${id?'':'Save first'}">${tester?'✓ Testing in-game':'🧪 Test in-game'}</button>${id?'<button class="btn sm" id="dup">Duplicate</button>':''}${id&&canPub?'<button class="btn sm danger" id="del">Delete</button>':''}</div>
      ${tester?'<p class="hint">Only you see it in the game (open BeyForge with this account). Click again to stop testing.</p>':''}`;
    $$('[name=pm]',P).forEach(r=>r.onchange=()=>{ pubMode=r.value; pubPanel(); });
    S.bindLive(P);
    $('#save',P).onclick=()=>save(S.read(P));
    const tb=$('#test',P); if(tb&&id) tb.onclick=async()=>{ await ref.update({testers:tester?FV().arrayRemove(S.user.uid):FV().arrayUnion(S.user.uid)}); doc.testers=tester?(doc.testers||[]).filter(x=>x!==S.user.uid):(doc.testers||[]).concat(S.user.uid);
      if(!tester){ S.toast('Open BeyForge with your account — it’s there just for you','good'); window.studioNative?window.studioNative.openExternal('https://battlebornplayz.github.io/beyforge/'):window.open('https://battlebornplayz.github.io/beyforge/','_blank'); } pubPanel(); };
    const db2=$('#dup',P); if(db2) db2.onclick=async()=>{ const r2=S.db.collection('content').doc(); await r2.set(Object.assign({},doc,{name:(st.name||'')+' (copy)',key:null,status:'draft',testers:[],version:1,data:Object.assign(BF.clone(st.data),{name:(st.data.name||'')+' (copy)'}),created:FV().serverTimestamp(),updated:FV().serverTimestamp(),by:S.user.uid,byName:S.profile.name})); S.audit('duplicated content',st.name); S.go('content/'+r2.id); };
    const dl=$('#del',P); if(dl) dl.onclick=async()=>{ if(!await S.confirm({title:`Delete “${st.name}”?`,body:'Players lose access to it right away. Copies players already own stay in their inventory.',typed:'DELETE',danger:true,ok:'Delete'})) return;
      await ref.delete(); S.audit('deleted content',st.name,doc,null,{type:'content',id}); S.toast('Deleted'); S.go('content'); };
  };
  async function save(o){
    if(kind==='pack'){ const sum=['common','rare','epic','legendary','limited'].reduce((a,r)=>a+(+st.data.odds[r]||0),0); if(Math.round(sum)!==100&&pubMode!=='draft') return S.toast('Odds must add up to 100% before publishing','bad'); if(!st.data.name.trim()) return S.toast('Give it a name','bad'); }
    if(kind==='part'&&!(st.data.name||'').trim()) return S.toast('Give the part a name','bad');
    if(kind==='cosmetic'&&!(st.data.name||'').trim()) return S.toast('Give it a name','bad');
    if((pubMode==='live'||pubMode==='schedule')&&!await S.confirm({title:pubMode==='live'?'Publish to players now?':'Schedule this?',body:pubMode==='live'?`${o.rollout<100?o.rollout+'% of':'All'} players will get “${esc(st.name)}”${o.end?' until '+S.when(o.end):''}.`:`Goes live ${S.when(o.start)}${o.end?' and ends '+S.when(o.end):''}.`,ok:pubMode==='live'?'Publish':'Schedule'})) return;
    const key=st.key||(kind==='part'?null:slug(st.data.name)+'_'+rnd());
    if(kind==='cosmetic') st.data.key=key;
    const status=pubMode==='draft'?'draft':pubMode==='review'?'review':pubMode==='schedule'?'scheduled':'live';
    const out={kind,key,name:st.data.name,data:BF.clone(st.data),status,start:pubMode==='schedule'?o.start:pubMode==='live'?Date.now():(doc&&doc.start)||null,end:o.end||null,rollout:o.rollout!=null?o.rollout:100,
      testers:(doc&&doc.testers)||[],version:((doc&&doc.version)||0)+1,updated:FV().serverTimestamp(),by:S.user.uid,byName:S.profile.name||S.user.email};
    if(pubMode==='review') out.req={mode:o.start?'schedule':'live',start:o.start||null,end:o.end||null,rollout:out.rollout,note:o.note||'',by:S.profile.name};
    if(!doc) out.created=FV().serverTimestamp();
    try{ await ref.set(out,{merge:false}); await ref.collection('versions').add({data:out.data,status,version:out.version,note:o.note||'',by:out.byName,ts:FV().serverTimestamp()}).catch(()=>{});
      S.audit({draft:'saved draft',review:'sent for review',live:'published',schedule:'scheduled'}[pubMode],`${KINDS[kind].label} · ${st.name}`,doc?{status:doc.status,data:doc.data,start:doc.start||null,end:doc.end||null,rollout:doc.rollout==null?100:doc.rollout}:null,{status},{type:'content',id:ref.id});
      dirty=false; S.toast({draft:'Draft saved',review:'Sent for review',live:'Published! Players have it now 🎉',schedule:'Scheduled'}[pubMode],'good'); if(!id) S.go('content/'+ref.id); else S.route(); }
    catch(e){ S.toast(/permission/i.test(e.message)?'Your rank can’t do that':e.message,'bad'); }
  }
  async function history(){ $('#steps',v).innerHTML=''; $('#enav',v).innerHTML=''; const F=$('#form',v); F.innerHTML='<div class="loading"><i></i></div>';
    const qs=await ref.collection('versions').orderBy('ts','desc').limit(50).get(); const vs=[]; qs.forEach(x=>vs.push(x.data()));
    F.innerHTML=`<h3>Version history</h3><p class="muted">Every save is kept. Restore loads it into the editor, then save or publish it again.</p><ul class="feed">${vs.map((x,i)=>`<li><b>v${x.version}</b> ${S.pill(x.status)} ${esc(x.note||'')}<em>${esc(x.by)} · ${S.when(x.ts)}</em><button class="btn xs" data-r="${i}">Restore</button></li>`).join('')}</ul>`;
    $$('[data-r]',F).forEach(b=>b.onclick=()=>{ st.data=BF.clone(vs[+b.dataset.r].data); if(kind==='part') st.data.design=BF.normalize(st.data.design); st.name=st.data.name; mode='wizard'; $$('#modeSeg button',v).forEach(x=>x.classList.toggle('on',x.dataset.m==='wizard')); dirty=true; draw(); S.toast('Loaded v'+vs[+b.dataset.r].version+' — save to keep it'); }); }
  draw(); pubPanel();
  const warn=e=>{ if(dirty){ e.preventDefault(); e.returnValue=''; } }; addEventListener('beforeunload',warn); S.onLeave(()=>removeEventListener('beforeunload',warn));
}

// ---------- list ----------
S.register('content',{title:'Content',icon:'🧩',group:'Content',sec:'content',async render(v,args){
  if(args[0]==='new'&&args[1]) return editor(v,args[1]);
  if(args[0]==='new') { v.innerHTML=S.head('Create something new','Pick what you want to add to BeyForge.')+`<div class="kinds">${Object.entries(KINDS).map(([k,x])=>`<a class="kind card" href="#/content/new/${k}"><span class="kic big">${x.icon}</span><b>${x.label}</b><p class="muted">${x.desc}</p></a>`).join('')}
      <a class="kind card" href="#/builtin"><span class="kic big">📦</span><b>Built-in packs</b><p class="muted">Change prices, odds and pity of the packs the game ships with.</p></a></div>`; return; }
  if(args[0]) return editor(v,null,args[0]);
  const qs=await S.db.collection('content').orderBy('updated','desc').limit(300).get(); const rows=[]; qs.forEach(d=>rows.push(Object.assign({id:d.id},d.data())));
  let fk='', fs='';
  v.innerHTML=S.head('Content','Everything you’ve made for the game. Players only see items that are live.',S.can('content','edit')?'<a class="btn primary" href="#/content/new">＋ New</a>':'')+
    `<div class="toolbar"><div class="seg" id="fk"><button class="on" data-k="">All</button>${Object.entries(KINDS).map(([k,x])=>`<button data-k="${k}">${x.icon} ${x.label}</button>`).join('')}</div>
     <div class="seg" id="fs"><button class="on" data-s="">Any status</button><button data-s="Live">Live</button><button data-s="Scheduled">Scheduled</button><button data-s="In review">In review</button><button data-s="Draft">Drafts</button><button data-s="Ended">Ended</button></div></div><div id="ct"></div>`;
  const draw=()=>S.table($('#ct',v),[{k:'name',label:'Name',fmt:c=>`<span class="kic">${KINDS[c.kind]?KINDS[c.kind].icon:'?'}</span> <b>${esc(c.name||'Untitled')}</b>${c.kind==='part'?` <span class="pill" style="--pc:${RC[c.data.rarity]}">${esc(c.data.rarity)}</span>`:''}${c.kind==='cosmetic'?` <span class="muted">${esc(c.data.cat)}</span>`:''}`},
      {k:'status',label:'Status',fmt:c=>{ const [l,t]=liveState(c); return S.pill(l,t)+((c.testers||[]).length?' <span class="muted">🧪</span>':''); },sort:c=>liveState(c)[0]},
      {k:'win',label:'When',fmt:c=>c.start||c.end?`${c.start?S.when(c.start):'now'} → ${c.end?S.when(c.end):'forever'}`:'—',sort:c=>c.start||0},
      {k:'updated',label:'Updated',fmt:c=>`${S.ago(c.updated)} <span class="muted">by ${esc(c.byName||'')}</span>`,sort:c=>c.updated&&c.updated.toMillis?c.updated.toMillis():0}],
    rows.filter(c=>(!fk||c.kind===fk)&&(!fs||liveState(c)[0].startsWith(fs))),{onRow:c=>S.go('content/'+c.id),sort:'updated',empty:'Nothing yet — hit “＋ New” to make your first pack, part or cosmetic.'});
  $$('#fk button',v).forEach(b=>b.onclick=()=>{ fk=b.dataset.k; $$('#fk button',v).forEach(x=>x.classList.toggle('on',x===b)); draw(); });
  $$('#fs button',v).forEach(b=>b.onclick=()=>{ fs=b.dataset.s; $$('#fs button',v).forEach(x=>x.classList.toggle('on',x===b)); draw(); });
  draw();
}});

// ---------- review queue ----------
S.register('review',{title:'Review queue',icon:'📝',group:'Content',sec:'publish',
  badge:()=>S.db.collection('content').where('status','==','review').get().then(q=>q.size),
  async render(v){
  const qs=await S.db.collection('content').where('status','==','review').get(); const rows=[]; qs.forEach(d=>rows.push(Object.assign({id:d.id},d.data())));
  v.innerHTML=S.head('Review queue','Content your staff sent for approval. Approving publishes it the way they asked.')+(rows.length?`<div class="rq">${rows.map(c=>`<div class="card rqi"><div><span class="kic">${KINDS[c.kind].icon}</span> <b>${esc(c.name)}</b> <span class="muted">by ${esc(c.byName)} · ${S.ago(c.updated)}</span>
      <p class="muted">${c.req?`Wants: ${c.req.mode==='schedule'?'live '+S.when(c.req.start):'live right away'}${c.req.end?' until '+S.when(c.req.end):''} · ${c.req.rollout||100}% of players${c.req.note?` · “${esc(c.req.note)}”`:''}`:''}</p></div>
      <div class="row"><a class="btn" href="#/content/${c.id}">Open</a>${S.can('publish','edit')?`<button class="btn danger" data-rej="${c.id}">Send back</button><button class="btn primary" data-ok="${c.id}">Approve</button>`:''}</div></div>`).join('')}</div>`:S.empty('✅','Nothing waiting','When a Content Creator sends something for review it shows up here.'));
  $$('[data-ok]',v).forEach(b=>b.onclick=async()=>{ const c=rows.find(x=>x.id===b.dataset.ok), r=c.req||{}; if(!await S.confirm({title:`Approve “${c.name}”?`,body:'It goes live for players as requested.',ok:'Approve & publish'})) return;
    await S.db.collection('content').doc(c.id).update({status:r.mode==='schedule'?'scheduled':'live',start:r.start||Date.now(),end:r.end||null,rollout:r.rollout||100,approvedBy:S.profile.name,updated:FV().serverTimestamp()});
    S.audit('approved',c.name,{status:'review'},{status:'live'},{type:'content',id:c.id}); S.toast('Approved — it’s live','good'); S.route(); S.renderNav(); });
  $$('[data-rej]',v).forEach(b=>b.onclick=async()=>{ const c=rows.find(x=>x.id===b.dataset.rej); const why=await S.prompt({title:`Send “${c.name}” back`,label:'What needs fixing?',ok:'Send back'}); if(why==null) return;
    await S.db.collection('content').doc(c.id).update({status:'draft',reviewNote:why,updated:FV().serverTimestamp()}); S.audit('sent back',c.name+' · '+why); S.toast('Sent back to drafts'); S.route(); S.renderNav(); });
}});

// ---------- built-in packs (config/packs overrides) ----------
S.register('builtin',{title:'Built-in packs',icon:'📦',group:'Content',sec:'publish',async render(v){
  const ref=S.db.collection('config').doc('packs'), snap=await ref.get(), over=(snap.data()&&snap.data().packs)||{};
  const all=Object.keys(BF.PACK_DEFAULTS).map(k=>{ const d=BF.PACK_DEFAULTS[k], o=over[k]||{}; return Object.assign({id:k},d,o,{odds:Object.assign({},d.odds,o.odds||{}),changed:!!over[k]}); });
  v.innerHTML=S.head('Built-in packs','The packs BeyForge ships with. Changes go live instantly.')+'<div id="bt"></div>';
  S.table($('#bt',v),[{k:'name',label:'Pack',fmt:p=>`<b>${esc(p.name)}</b>${p.changed?' '+S.pill('edited','info'):''}${p.enabled===false?' '+S.pill('hidden'):''}`},{k:'price',label:'Price',cls:'r',fmt:p=>`${p.price}${p.gems?` · ${p.gems}💎`:''}`},{k:'odds',label:'Odds',fmt:p=>esc(BF.Packs.oddsText(p))},{k:'pity',label:'Pity',cls:'r'},{k:'shiny',label:'Shiny',cls:'r',fmt:p=>'1/'+p.shiny}],all,{onRow:p=>{
    const F=S.f, c=S.modal(`<h3>Edit ${esc(p.name)}</h3><div class="grid2">${F.text('name','Name',p.name)}${F.num('price','Price (coins)',p.price,{min:0})}${F.num('gems','Gems (0 = coins only)',p.gems||0,{min:0})}${F.num('count','Parts inside',p.count,{min:1,max:6})}${F.num('pity','Pity (0 = off)',p.pity,{min:0})}${F.num('shiny','Shiny 1 in',p.shiny,{min:2})}</div>
      <h4>Odds <span class="sum" id="bs"></span></h4><div class="grid2">${['common','rare','epic','legendary'].map(r=>F.num('odds.'+r,BF.RARITY[r].label+' %',p.odds[r]||0,{min:0,max:100,step:0.5})).join('')}</div>${F.tog('enabled','Show in shop',p.enabled!==false)}
      <div class="macts"><button class="btn" id="rst">Reset to default</button><button class="btn" data-x>Cancel</button><button class="btn primary" id="sv">Save & publish</button></div>`,'wide');
    const sum=()=>{ const o=S.read(c).odds, s=Object.values(o).reduce((a,b)=>a+(+b||0),0); $('#bs',c).textContent=s+'%'+(Math.round(s)===100?' ✓':' — must be 100%'); $('#bs',c).className='sum '+(Math.round(s)===100?'ok':'bad'); return s; }; c.addEventListener('input',sum); sum();
    $('[data-x]',c).onclick=()=>S.closeModal();
    $('#sv',c).onclick=async()=>{ if(Math.round(sum())!==100) return S.toast('Odds must add up to 100%','bad'); const o=S.read(c); await ref.set({packs:{[p.id]:o}},{merge:true}); S.audit('edited built-in pack',p.name,{packs:{[p.id]:over[p.id]||null}},{packs:{[p.id]:o}},{type:'config',doc:'packs',merge:true}); S.closeModal(); S.toast('Saved — live now','good'); S.route(); };
    $('#rst',c).onclick=async()=>{ const nv=Object.assign({},over); delete nv[p.id]; await ref.set({packs:nv}); S.audit('reset built-in pack',p.name,{packs:over},{packs:nv}); S.closeModal(); S.toast('Back to default'); S.route(); };
  }});
}});
S.register('new',{title:'New content',hidden:true,sec:'content',render(v){ S.go('content/new'); }});
})();
