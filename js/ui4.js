/* BeyForge v4 — Forge panel: Easy/Pro modes, tabs, themes, parts shop, sculpt editors, paint studio, extras */
(function(){
'use strict';
const BF=window.BF, TAU=Math.PI*2;
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const el=(tag,cls,html)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };
const X=d=>d.system==='X', B=d=>d.system==='Burst';
const pct=v=>Math.round(v*100)+'%';
const sec=id=>BF.SCHEMA.find(s=>s.id===id);
const items=(id,filter)=>sec(id).items.filter(it=>!filter||filter(it));

// ---------- tab layouts ----------
const PRO=[
  {id:'build', label:'Start', sections:[
    {sec:'Themes', id:'themes', items:[{t:'themes'}]},
    {sec:'System', id:'sys', items:items('sys')},
    {sec:'Parts shop', id:'shop', items:[{t:'catalog'}]}]},
  {id:'blade', label:d=>X(d)?'Blade':'Layer', sections:[
    {sec:d=>X(d)?'Blade shape':'Layer shape', id:'blade', items:[
      ...items('blade',it=>it.t!=='draw'&&it.t!=='perwing'&&it.k!=='blade.tipHeight'&&it.k!=='blade.height'),
      {k:'blade.mixShapes',t:'toggle',l:'Different shape per wing',re:1},
      {t:'perwingshape',when:d=>d.blade.mixShapes}]},
    {sec:'Sculpt outline', id:'sculptTop', items:[{t:'sculptTop'},{t:'note',text:'Drag the dots to reshape every wing. Switches the shape to Custom.'}]},
    {sec:'Sculpt side profile', id:'sculptSide', items:[{t:'sculptSide'},{k:'blade.lift',t:'range',l:'Wing lift',min:0,max:6,step:0.2,u:'mm',h:'Raises the wing tips off the floor. Needs supports to print.'}]},
    {sec:'Per-wing tuning', id:'perwing', when:d=>!d.symmetry, items:[{t:'perwing'}]}]},
  {id:'core', label:d=>X(d)?'Ratchet':'Disc', sections:[sec('ratchet'),sec('lock'),sec('disc')]},
  {id:'bit', label:d=>X(d)?'Bit':'Driver', sections:[
    {sec:d=>X(d)?'Bit':'Driver', id:'bit', items:[{t:'tipgrid'},
      ...items('bit',it=>it.k!=='bit.tip'),
      {k:'bit.mode',t:'seg',l:'Mode',o:{attack:'Attack',stamina:'Stamina'},when:d=>d.bit.tip==='mode',h:'Pick the mode here; you can also switch it before each launch.'},
      {t:'tipdraw',when:d=>d.bit.tip==='custom'},
      {t:'note',when:d=>d.bit.tip==='bearing',text:'Bearing tips need a 623 ball bearing (3×10×4 mm). The housing is sized for it.'}]}]},
  {id:'paint', label:'Paint', sections:[{sec:'Paint studio', id:'paint', items:[{t:'paint'}]}]},
  {id:'extras', label:'Extras', sections:[
    sec('deco'),
    {sec:'Horns & spikes', id:'horns', items:[
      {k:'deco.horns.count',t:'range',l:'Per wing',min:0,max:3,step:1,re:1},
      {k:'deco.horns.style',t:'seg',l:'Style',o:{cone:'Spike',horn:'Horn',fin:'Fin'},when:d=>d.deco.horns.count>0},
      {k:'deco.horns.height',t:'range',l:'Height',min:2,max:12,step:0.5,u:'mm',when:d=>d.deco.horns.count>0},
      {k:'deco.horns.lean',t:'range',l:'Lean back',min:-10,max:50,step:1,u:'°',when:d=>d.deco.horns.count>0}]},
    {sec:'Cutouts', id:'cutouts', items:[
      {k:'blade.cutouts.count',t:'range',l:'Holes per wing',min:0,max:3,step:1,re:1},
      {k:'blade.cutouts.shape',t:'seg',l:'Shape',o:{round:'Round',slot:'Slot',tri:'Triangle'},when:d=>d.blade.cutouts.count>0},
      {k:'blade.cutouts.size',t:'range',l:'Size',min:0.2,max:1,step:0.05,fmt:pct,when:d=>d.blade.cutouts.count>0},
      {k:'blade.cutouts.pos',t:'range',l:'Position',min:0.3,max:0.85,step:0.01,fmt:pct,when:d=>d.blade.cutouts.count>0}]},
    {sec:'Upper tier', id:'tier', items:[
      {k:'blade.tier.on',t:'toggle',l:'Add a second layer on top',re:1},
      {k:'blade.tier.shape',t:'sel',l:'Shape',o:BF.WING_SHAPES,when:d=>d.blade.tier.on},
      {k:'blade.tier.wings',t:'range',l:'Points',min:1,max:8,step:1,when:d=>d.blade.tier.on},
      {k:'blade.tier.diameter',t:'range',l:'Size',min:0.4,max:0.9,step:0.01,fmt:pct,when:d=>d.blade.tier.on},
      {k:'blade.tier.depth',t:'range',l:'Reach',min:0.1,max:0.6,step:0.01,fmt:pct,when:d=>d.blade.tier.on},
      {k:'blade.tier.height',t:'range',l:'Height',min:1,max:6,step:0.25,u:'mm',when:d=>d.blade.tier.on}]},
    {sec:d=>X(d)?'Cap':'Chip', id:'chip', items:[
      {k:'chip.on',t:'toggle',l:d=>X(d)?'Add a cap':'Add a chip',re:1},
      {k:'chip.emblem',t:'sel',l:'Emblem',o:BF.EMBLEMS,when:d=>d.chip.on},
      {k:'chip.height',t:'range',l:'Height',min:1.5,max:6,step:0.25,u:'mm',when:d=>d.chip.on},
      {k:'chip.dome',t:'range',l:'Dome',min:0,max:1,step:0.05,fmt:pct,when:d=>d.chip.on}]},
    sec('weights'),
    {sec:'Battle cosmetics', id:'cos', items:[{t:'cosmetics'}]}]},
  {id:'print', label:'Print', sections:[
    {sec:'Materials', id:'mats', items:items('mats',it=>it.t==='sel')},
    sec('print')]}
];
const EASY=[
  {id:'build', label:'Start', sections:[{sec:'Pick a theme', id:'themes', items:[{t:'themes'}]}, {sec:'System', id:'sys', items:items('sys',it=>it.k!=='symmetry')}]},
  {id:'blade', label:'Shape', sections:[{sec:'Wing shape', id:'eshape', items:[{t:'shapegrid'},
    {k:'blade.wings',t:'range',l:'Contact points',min:1,max:8,step:1},
    {k:'blade.diameter',t:'range',l:'Size',min:34,max:56,step:0.5,u:'mm'},
    {k:'blade.depth',t:'range',l:'Wing reach',min:0.05,max:0.5,step:0.01,fmt:pct},
    {k:'blade.sweep',t:'range',l:'Wing sweep',min:-35,max:35,step:1,u:'°'}]}]},
  {id:'bit', label:'Tip', sections:[{sec:'Tip', id:'etip', items:[{t:'tipgrid'}]}]},
  {id:'paint', label:'Paint', sections:[{sec:'Paint', id:'paint', items:[{t:'paint',easy:true}]}]},
  {id:'extras', label:'Effects', sections:[{sec:'Battle cosmetics', id:'cos', items:[{t:'cosmetics'}]}, {sec:'Emblem', id:'edeco', items:items('deco',it=>['deco.emblem','deco.text'].includes(it.k))}]}
];

// ---------- mini previews (cached) ----------
const thumbCache={};
function shapeThumb(shape,size,color){
  const key=shape+size+color; if(thumbCache[key]) return thumbCache[key];
  const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'); const R=size*0.46, Rc=R*0.6;
  x.translate(size/2,size/2); x.beginPath();
  for(let i=0;i<=240;i++){ const a=i/240*TAU, s=(a%(TAU/3))/(TAU/3*0.8); const p=s<=1?BF.wingProfile(shape,s,BF.App&&BF.App.d.blade.custom):0; const r=Rc+(R-Rc)*p; i?x.lineTo(r*Math.cos(-a),r*Math.sin(-a)):x.moveTo(r*Math.cos(-a),r*Math.sin(-a)); }
  x.closePath(); x.fillStyle=color; x.shadowColor=color; x.shadowBlur=6; x.fill(); x.shadowBlur=0;
  x.beginPath(); x.arc(0,0,Rc*0.45,0,TAU); x.fillStyle='#07060e'; x.fill();
  return thumbCache[key]=c.toDataURL();
}
function tipThumb(key,size){
  const ck='tip'+key+size; if(thumbCache[ck]) return thumbCache[ck];
  const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d');
  const t=BF.TIPS[key]; const w=key==='bearing'?5.4:3.5, L=4;
  const prof=BF.tipProfileFor?BF.tipProfileFor(t.prof,w,L,BF.App&&BF.App.d.bit.customTip):[[0,0],[w,0],[w,L]];
  const k=size/14, cx=size/2, by=size*0.82;
  x.beginPath(); prof.forEach((p,i)=>{ const X0=cx+p[0]*k, Y=by-p[1]*k; i?x.lineTo(X0,Y):x.moveTo(X0,Y); });
  for(let i=prof.length-1;i>=0;i--){ const p=prof[i]; x.lineTo(cx-p[0]*k,by-p[1]*k); }
  x.lineTo(cx-6.6*k,by-L*k); x.lineTo(cx-6.6*k,by-(L+4)*k); x.lineTo(cx+6.6*k,by-(L+4)*k); x.lineTo(cx+6.6*k,by-L*k); x.closePath();
  x.fillStyle=t.rubber?'#ff2e88':'#2ef2ff'; x.fill();
  return thumbCache[ck]=c.toDataURL();
}

// ---------- color picker row: filament shelf + recent + swatches + wheel + hex ----------
function colorRow(value,onPick){
  const wrap=el('div','colorrow');
  const shelf=(BF.Settings.get('filament')||[]); const recent=BF.Settings.get('recentColors')||[];
  const mk=(c,title,cls)=>{ const b=el('button','sw'+(c.toLowerCase()===String(value).toLowerCase()?' on':'')+(cls?' '+cls:'')); b.type='button'; b.style.setProperty('--c',c); b.title=title||c; b.onclick=()=>{ onPick(c,true); }; return b; };
  if(shelf.length){ const g=el('div','swgroup'); g.appendChild(el('span','swlbl','My spools')); shelf.forEach(f=>g.appendChild(mk(f.color,f.name,'spool'))); wrap.appendChild(g); }
  if(recent.length){ const g=el('div','swgroup'); g.appendChild(el('span','swlbl','Recent')); recent.slice(0,8).forEach(c=>g.appendChild(mk(c))); wrap.appendChild(g); }
  const g=el('div','swgroup'); BF.SWATCHES.forEach(c=>g.appendChild(mk(c))); wrap.appendChild(g);
  const pick=el('div','pickrow'); const inp=el('input','wheel'); inp.type='color'; inp.value=value; inp.title='Color wheel';
  const hex=el('input','txt hex'); hex.value=value; hex.maxLength=7; hex.spellcheck=false; hex.setAttribute('aria-label','Hex color');
  inp.oninput=()=>{ hex.value=inp.value; onPick(inp.value,false); }; inp.onchange=()=>onPick(inp.value,true);
  hex.onchange=()=>{ let v=hex.value.trim(); if(!v.startsWith('#')) v='#'+v; if(/^#[0-9a-f]{6}$/i.test(v)){ inp.value=v; onPick(v.toLowerCase(),true); } else hex.value=inp.value; };
  pick.appendChild(inp); pick.appendChild(hex); wrap.appendChild(pick);
  return wrap;
}

// ---------- the panel ----------
const U=BF.UI;
U.tab=BF.LS.get('bf.tab','build'); U.paintPart='blade';
const baseControl=U.control.bind(U);
U.render=function(root,d,onChange){
  const scroll=root.scrollTop, mode=BF.Settings.get('mode'), tabs=mode==='pro'?PRO:EASY;
  if(!tabs.find(t=>t.id===this.tab)) this.tab='build';
  root.innerHTML='';
  const head=el('div','phead');
  const modeSeg=el('div','seg sm modeseg'); [['easy','Easy'],['pro','Pro']].forEach(([k,l])=>{ const b=el('button',mode===k?'on':'',l); b.type='button'; b.onclick=()=>{ BF.Settings.set('mode',k); this.render(root,d,onChange); }; modeSeg.appendChild(b); });
  head.appendChild(modeSeg);
  const tb=el('div','ptabs'); tabs.forEach(t=>{ const b=el('button',this.tab===t.id?'on':'',esc(typeof t.label==='function'?t.label(d):t.label)); b.type='button'; b.dataset.ptab=t.id; b.onclick=()=>{ this.tab=t.id; BF.LS.set('bf.tab',t.id); this.render(root,d,onChange); root.scrollTop=0; }; tb.appendChild(b); });
  head.appendChild(tb); root.appendChild(head);
  const tab=tabs.find(t=>t.id===this.tab);
  tab.sections.forEach(s=>{
    if(!s || (s.when && !s.when(d))) return;
    const det=el('details','sec'); det.open=this.open[s.id]!==false;
    det.addEventListener('toggle',()=>{ this.open[s.id]=det.open; BF.LS.set('bf.open',this.open); });
    det.appendChild(el('summary','',`<span>${esc(typeof s.sec==='function'?s.sec(d):s.sec)}</span>`));
    const body=el('div','sec-body');
    s.items.forEach(it=>{ if(it.when && !it.when(d)) return; const c=this.control(it,d,onChange); if(c) body.appendChild(c); });
    det.appendChild(body); root.appendChild(det);
  });
  root.scrollTop=scroll;
};
U.focusTab=function(id){ this.tab=id; BF.LS.set('bf.tab',id); BF.App.renderControls(); const b=document.querySelector(`[data-ptab="${id}"]`); if(b){ b.classList.add('flash'); setTimeout(()=>b.classList.remove('flash'),900); } };

U.control=function(it,d,onChange){
  const t=it.t;
  if(t==='themes'){
    const g=el('div','themegrid');
    BF.THEMES.forEach(th=>{ const col=(th.patch.paint&&th.patch.paint.blade&&th.patch.paint.blade.color)||'#2ef2ff';
      const b=el('button','theme'+(d.theme===th.id?' on':''),`<img alt="" src="${shapeThumb(th.patch.blade.shape,72,col)}"><b>${esc(th.name)}</b><span>${esc(th.blurb)}</span>`);
      b.type='button'; b.onclick=()=>BF.App.applyTheme(th.id); g.appendChild(b); });
    return g;
  }
  if(t==='shapegrid'){
    const g=el('div','shapegrid');
    Object.entries(BF.WING_SHAPES).forEach(([k,l])=>{ const b=el('button','shapebtn'+(d.blade.shape===k?' on':''),`<img alt="" src="${shapeThumb(k,64,d.paint.blade.color)}"><span>${esc(l.split(' (')[0].replace(' — draw it',''))}</span>`); b.type='button'; b.onclick=()=>onChange('blade.shape',k,{commit:true,re:true}); g.appendChild(b); });
    return g;
  }
  if(t==='tipgrid'){
    const g=el('div','shapegrid tips');
    Object.entries(BF.TIPS).forEach(([k,tp])=>{ const b=el('button','shapebtn'+(d.bit.tip===k?' on':''),`<img alt="" src="${tipThumb(k,64)}"><span>${esc(tp.label)}</span><em>${esc(X(d)?tp.x:tp.burst)}</em>`); b.type='button'; b.onclick=()=>onChange('bit.tip',k,{commit:true,re:true}); g.appendChild(b); });
    return g;
  }
  if(t==='perwingshape'){
    const w=el('div','perwing'); w.appendChild(el('div','pw-title','Shape for each wing'));
    for(let i=0;i<Math.round(d.blade.wings);i++){ const r=el('div','pw-row2'); r.appendChild(el('span','pw-n',`W${i+1}`)); const s=el('select');
      Object.entries(BF.WING_SHAPES).forEach(([k,l])=>{ const o=el('option','',esc(l)); o.value=k; if((d.blade.wingShapes[i]||d.blade.shape)===k) o.selected=true; s.appendChild(o); });
      s.onchange=()=>{ const a=d.blade.wingShapes.slice(); for(let q=0;q<8;q++) a[q]=a[q]||d.blade.shape; a[i]=s.value; onChange('blade.wingShapes',a,{commit:true}); }; r.appendChild(s); w.appendChild(r); }
    return w;
  }
  if(t==='catalog') return catalog(d,onChange);
  if(t==='sculptTop') return sculptTop(d,onChange);
  if(t==='sculptSide') return sculptSide(d,onChange);
  if(t==='tipdraw') return tipDraw(d,onChange);
  if(t==='paint') return paintStudio(d,onChange,it.easy);
  if(t==='cosmetics') return cosmetics(d,onChange);
  return baseControl(it,d,onChange);
};

// ---------- parts shop ----------
function catalog(d,onChange){
  const w=el('div','catalog'); const cat=BF.partsCatalog(); const mine=BF.LS.get('bf.myparts',[]);
  const tabs={blade:X(d)?'Blades':'Layers', core:X(d)?'Ratchets':'Discs', bit:X(d)?'Bits':'Drivers', mine:'My parts'};
  let cur=U.shopTab||'blade';
  const seg=el('div','seg sm'); Object.entries(tabs).forEach(([k,l])=>{ const b=el('button',cur===k?'on':'',l); b.type='button'; b.onclick=()=>{ U.shopTab=k; BF.App.renderControls(); }; seg.appendChild(b); });
  w.appendChild(seg);
  const list=el('div','shoplist');
  const apply=(patch,name)=>{ BF.App.push(); BF.merge(BF.App.d,BF.clone(patch)); BF.syncColors(BF.App.d); BF.App.renderControls(); BF.App.rebuild(); BF.App.toast('Equipped '+name); };
  let src=cur==='mine'?mine:cur==='blade'?cat.blade:cur==='bit'?cat.bit:(X(d)?cat.ratchet:cat.disc);
  if(cur==='mine' && !src.length) list.appendChild(el('div','fine','Nothing saved yet. Save the parts you make and reuse them on any Bey.'));
  src.forEach((p,ix)=>{ const r=el('div','shopitem'); const b=el('button','shopbtn',`<b>${esc(p.name)}</b><span>${esc(p.src||p.kind||'')}</span>`); b.type='button'; b.onclick=()=>apply(p.data,p.name); r.appendChild(b);
    if(cur==='mine'){ const x=el('button','icon-x','×'); x.type='button'; x.title='Delete part'; x.onclick=()=>{ mine.splice(ix,1); BF.LS.set('bf.myparts',mine); BF.Account&&BF.Account.pushParts(); BF.App.renderControls(); }; r.appendChild(x); }
    list.appendChild(r); });
  w.appendChild(list);
  // save current parts
  const save=el('div','saverow'); const nm=el('input','txt sm'); nm.placeholder='Name this part'; nm.maxLength=24;
  const kinds={blade:'blade',core:X(d)?'ratchet':'disc',bit:'bit'}; const which=el('select'); Object.entries({blade:X(d)?'Blade':'Layer',core:X(d)?'Ratchet':'Disc',bit:X(d)?'Bit':'Driver'}).forEach(([k,l])=>{ const o=el('option','','Save my '+l.toLowerCase()); o.value=k; which.appendChild(o); });
  const btn=el('button','btn','Save'); btn.type='button';
  btn.onclick=()=>{ const k=kinds[which.value]; const data={}; data[k]=BF.clone(d[k]); if(k==='blade') data.paint={blade:BF.clone(d.paint.blade)}; if(k==='bit') data.paint={bit:BF.clone(d.paint.bit),tip:BF.clone(d.paint.tip)};
    mine.unshift({name:nm.value.trim()||('My '+k), kind:k, data, src:'My '+k}); BF.LS.set('bf.myparts',mine.slice(0,80)); BF.Account&&BF.Account.pushParts(); U.shopTab='mine'; BF.App.renderControls(); BF.App.toast('Part saved'); };
  save.appendChild(which); save.appendChild(nm); save.appendChild(btn); w.appendChild(save);
  return w;
}

// ---------- sculpt: drag the outline from the top ----------
function sculptTop(d,onChange){
  const w=el('div','sculpt'); const cv=el('canvas'); cv.width=520; cv.height=520; w.appendChild(cv);
  const ctx=cv.getContext('2d'); const S=cv.width, C=S/2; const n=24;
  let arr=d.blade.shape==='custom'?d.blade.custom.slice():Array.from({length:n},(_,i)=>+BF.wingProfile(d.blade.shape,i/(n-1)).toFixed(3));
  const W=Math.max(1,Math.round(d.blade.wings)), span=TAU/W*(d.blade.shape==='ring'?1:d.blade.wingWidth);
  const R=S*0.44, Rc=R*(1-Math.min(0.5,d.blade.depth));
  const pt=(i)=>{ const a=span*i/(n-1), r=Rc+(R-Rc)*arr[i]; return [C+r*Math.cos(a),C-r*Math.sin(a)]; };
  const draw=()=>{ ctx.clearRect(0,0,S,S);
    ctx.strokeStyle='rgba(140,130,200,.18)'; [Rc,R].forEach(r=>{ ctx.beginPath(); ctx.arc(C,C,r,0,TAU); ctx.stroke(); });
    ctx.beginPath();
    for(let q=0;q<=360;q++){ const a=q/360*TAU; let h=0; for(let k=0;k<W;k++){ let s=((a-k*TAU/W)%TAU+TAU)%TAU; if(s<=span){ const u=s/span*(n-1), i=Math.floor(u), f=u-i; h=Math.max(h,arr[Math.min(i,n-1)]*(1-f)+arr[Math.min(i+1,n-1)]*f); } }
      const r=Rc+(R-Rc)*h; q?ctx.lineTo(C+r*Math.cos(a),C-r*Math.sin(a)):ctx.moveTo(C+r*Math.cos(a),C-r*Math.sin(a)); }
    ctx.closePath(); ctx.fillStyle='rgba(46,242,255,.16)'; ctx.fill(); ctx.strokeStyle='#2ef2ff'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(C,C,Rc*0.55,0,TAU); ctx.fillStyle='#07060e'; ctx.fill();
    for(let i=0;i<n;i++){ const [x,y]=pt(i); ctx.beginPath(); ctx.arc(x,y,i===drag?9:7,0,TAU); ctx.fillStyle=i===drag?'#ff2e88':'#ffffff'; ctx.fill(); }
  };
  let drag=-1;
  const local=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*S,(e.clientY-r.top)/r.height*S]; };
  cv.onpointerdown=e=>{ const [x,y]=local(e); let best=-1,bd=30; for(let i=0;i<n;i++){ const [px,py]=pt(i); const dd=Math.hypot(px-x,py-y); if(dd<bd){ bd=dd; best=i; } } if(best<0) return; drag=best; cv.setPointerCapture(e.pointerId); draw(); };
  cv.onpointermove=e=>{ if(drag<0) return; const [x,y]=local(e); const r=Math.hypot(x-C,y-C); arr[drag]=+Math.max(0,Math.min(1,(r-Rc)/(R-Rc))).toFixed(3); draw(); if(d.blade.shape!=='custom') onChange('blade.shape','custom',{commit:false}); onChange('blade.custom',arr.slice(),{commit:false}); };
  cv.onpointerup=()=>{ if(drag<0) return; drag=-1; draw(); onChange('blade.custom',arr.slice(),{commit:true,re:true}); };
  draw(); return w;
}

// ---------- sculpt: push/pull the side profile ----------
function sculptSide(d,onChange){
  const w=el('div','sculpt side'); const cv=el('canvas'); cv.width=560; cv.height=260; w.appendChild(cv); const ctx=cv.getContext('2d');
  const b=d.blade, W0=cv.width, H0=cv.height, padL=40, padR=24, base=H0-30, k=(H0-50)/22;
  let H=b.height, tip=b.tipHeight, bends=(b.profile&&b.profile.length===3?b.profile:[0,0,0]).slice();
  const xAt=t=>padL+t*(W0-padL-padR);
  const handles=()=>[[0,H],[0.25,null],[0.5,null],[0.75,null],[1,tip]].map(([t,z],i)=>{ const zz= z!=null?z: H+(tip-H)*t+bends[i-1]*H*0.35; return [xAt(t), base-zz*k, t]; });
  const draw=()=>{ ctx.clearRect(0,0,W0,H0);
    ctx.fillStyle='rgba(140,130,200,.5)'; ctx.font='12px JetBrains Mono, monospace';
    for(let z=0;z<=20;z+=5){ const y=base-z*k; ctx.fillText(z+'',6,y+4); ctx.strokeStyle='rgba(140,130,200,.14)'; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W0-padR,y); ctx.stroke(); }
    ctx.fillText('core',padL-6,H0-8); ctx.fillText('wing tip',W0-padR-56,H0-8);
    const lift=b.lift||0;
    ctx.beginPath(); ctx.moveTo(xAt(0),base);
    for(let q=0;q<=60;q++){ const t=q/60; const kk=[0,bends[0],bends[1],bends[2],0], x=t*4, i=Math.min(3,Math.floor(x)), f=x-i, s=f*f*(3-2*f); const bend=kk[i]+(kk[i+1]-kk[i])*s;
      ctx.lineTo(xAt(t), base-(H+(tip-H)*t+bend*H*0.35+lift*t*t)*k); }
    for(let q=60;q>=0;q--){ const t=q/60; ctx.lineTo(xAt(t), base-(lift*t*t)*k); }
    ctx.closePath(); ctx.fillStyle='rgba(46,242,255,.18)'; ctx.fill(); ctx.strokeStyle='#2ef2ff'; ctx.lineWidth=2.5; ctx.stroke();
    handles().forEach(([x,y],i)=>{ ctx.beginPath(); ctx.arc(x,y,i===drag?9:7,0,TAU); ctx.fillStyle=i===drag?'#ff2e88':(i===0||i===4?'#ffd21f':'#ffffff'); ctx.fill(); });
  };
  let drag=-1; const local=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*W0,(e.clientY-r.top)/r.height*H0]; };
  cv.onpointerdown=e=>{ const [x,y]=local(e); let best=-1,bd=28; handles().forEach(([hx,hy],i)=>{ const dd=Math.hypot(hx-x,hy-y); if(dd<bd){ bd=dd; best=i; } }); if(best<0) return; drag=best; cv.setPointerCapture(e.pointerId); draw(); };
  const send=c=>{ onChange('blade.height',+H.toFixed(2),{commit:c}); onChange('blade.tipHeight',+tip.toFixed(2),{commit:c}); onChange('blade.profile',bends.map(v=>+v.toFixed(3)),{commit:c}); };
  cv.onpointermove=e=>{ if(drag<0) return; const z=Math.max(0,(base-local(e)[1])/k);
    if(drag===0) H=Math.max(6,Math.min(16,z)); else if(drag===4) tip=Math.max(1.2,Math.min(20,z));
    else { const t=[0.25,0.5,0.75][drag-1]; bends[drag-1]=Math.max(-1,Math.min(1,(z-(H+(tip-H)*t))/(H*0.35))); }
    draw(); send(false); };
  cv.onpointerup=()=>{ if(drag<0) return; drag=-1; draw(); send(true); };
  draw(); return w;
}

// ---------- draw your own tip ----------
function tipDraw(d,onChange){
  const w=el('div','sculpt tipdraw'); const cv=el('canvas'); cv.width=360; cv.height=280; w.appendChild(cv); const ctx=cv.getContext('2d');
  let arr=d.bit.customTip.slice(); const n=arr.length, C=cv.width/2, top=30, bot=cv.height-24, Rw=cv.width*0.36;
  const pt=i=>[C+arr[i]*Rw, bot-(bot-top)*i/(n-1)];
  const draw=()=>{ ctx.clearRect(0,0,cv.width,cv.height); ctx.beginPath(); ctx.moveTo(C,bot);
    for(let i=0;i<n;i++){ const [x,y]=pt(i); ctx.lineTo(x,y); } for(let i=n-1;i>=0;i--){ const [x,y]=pt(i); ctx.lineTo(2*C-x,y); } ctx.closePath();
    ctx.fillStyle='rgba(255,46,136,.2)'; ctx.fill(); ctx.strokeStyle='#ff2e88'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.strokeStyle='rgba(140,130,200,.4)'; ctx.beginPath(); ctx.moveTo(0,bot+0.5); ctx.lineTo(cv.width,bot+0.5); ctx.stroke(); ctx.fillStyle='rgba(140,130,200,.7)'; ctx.font='12px JetBrains Mono, monospace'; ctx.fillText('stadium floor',8,bot+16);
    for(let i=0;i<n;i++){ const [x,y]=pt(i); ctx.beginPath(); ctx.arc(x,y,i===drag?9:7,0,TAU); ctx.fillStyle=i===drag?'#2ef2ff':'#ffffff'; ctx.fill(); } };
  let drag=-1; const local=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*cv.width,(e.clientY-r.top)/r.height*cv.height]; };
  cv.onpointerdown=e=>{ const [x,y]=local(e); let best=-1,bd=28; for(let i=0;i<n;i++){ const [px,py]=pt(i); const dd=Math.hypot(px-x,py-y); if(dd<bd){ bd=dd; best=i; } } if(best<0) return; drag=best; cv.setPointerCapture(e.pointerId); draw(); };
  cv.onpointermove=e=>{ if(drag<0) return; arr[drag]=+Math.max(0.05,Math.min(1,Math.abs(local(e)[0]-C)/Rw)).toFixed(3); draw(); onChange('bit.customTip',arr.slice(),{commit:false}); };
  cv.onpointerup=()=>{ if(drag<0) return; drag=-1; draw(); onChange('bit.customTip',arr.slice(),{commit:true}); };
  draw(); w.appendChild(el('div','hint','Drag the dots: bottom = the point touching the stadium. Wider = grippier & faster, narrower = longer spin.')); return w;
}

// ---------- battle cosmetics ----------
function cosmetics(d,onChange){
  const w=el('div','cosgrid');
  [['trail','Spin trail'],['launch','Launch effect'],['aura','Aura'],['win','Win animation']].forEach(([k,l])=>{
    const row=el('div','ctl'); row.appendChild(el('div','ctl-head',`<label>${l}</label>`)); const g=el('div','chips');
    Object.entries(BF.COSMETICS[k]).forEach(([v,n])=>{ const own=BF.Shop.has(k,v); const b=el('button','chip'+(d.cos[k]===v?' on':'')+(own?'':' locked'),esc(n)+(own?'':`<i class="lk">${BF.Shop.price(k,v)}</i>`)); b.type='button'; b.onclick=()=>BF.Shop.require(k,v,()=>onChange('cos.'+k,v,{commit:true,re:true})); g.appendChild(b); });
    row.appendChild(g); w.appendChild(row); });
  const tc=el('div','ctl'); tc.appendChild(el('div','ctl-head','<label>Trail color</label>'));
  tc.appendChild(colorRow(d.cos.trailColor||d.paint.blade.color,(c,commit)=>onChange('cos.trailColor',c,{commit}))); w.appendChild(tc);
  if(!BF.Settings.get('cosmetics')) w.appendChild(el('div','ctl-note','Battle cosmetics are turned off in Settings — your friend will still see them if they have them on.'));
  return w;
}

// ---------- paint studio ----------
function paintStudio(d,onChange,easy){
  const w=el('div','studio');
  const parts=Object.entries(BF.PAINT_PARTS).filter(([k])=>{
    if(k==='ratchet') return X(d); if(k==='disc') return B(d); if(k==='chip') return d.chip.on; if(k==='horn') return d.deco.horns.count>0; return true; });
  if(!parts.find(([k])=>k===U.paintPart)) U.paintPart='blade';
  const pk=U.paintPart, P=d.paint[pk], base='paint.'+pk+'.';
  const chips=el('div','chips partchips'); parts.forEach(([k,l])=>{ const b=el('button','chip'+(k===pk?' on':''),`<i style="--c:${d.paint[k].color}"></i>${esc(k==='blade'&&B(d)?'Layer':l.split(' / ')[0])}`); b.type='button'; b.onclick=()=>{ U.paintPart=k; BF.App.renderControls(); }; chips.appendChild(b); });
  w.appendChild(chips);
  const set=(k,v,commit,re)=>onChange(base+k,v,{commit,re});
  const section=(label,node)=>{ const s=el('div','ctl'); s.appendChild(el('div','ctl-head',`<label>${label}</label>`)); s.appendChild(node); w.appendChild(s); };
  section('Color',colorRow(P.color,(c,commit)=>{ set('color',c,commit); if(commit) BF.Settings.pushRecent(c); }));
  const fin=el('div','chips'); Object.entries(BF.FINISHES).forEach(([k,l])=>{ const own=BF.Shop.has('finish',k); const b=el('button','chip fin-'+k+(P.finish===k?' on':'')+(own?'':' locked'),esc(l)+(own?'':`<i class="lk">${BF.Shop.price('finish',k)}</i>`)); b.type='button'; b.onclick=()=>BF.Shop.require('finish',k,()=>set('finish',k,true,true)); fin.appendChild(b); }); section('Finish',fin);
  if(!easy){
    const st=el('div','seg sm'); Object.entries(BF.PAINT_STYLES).forEach(([k,l])=>{ if(k==='perwing'&&pk!=='blade') return; const b=el('button',P.style===k?'on':'',l); b.type='button'; b.onclick=()=>set('style',k,true,true); st.appendChild(b); }); section('Style',st);
    if(P.style==='gradient'||P.style==='twotone') section(P.style==='gradient'?'Edge color':'Outer color',colorRow(P.color2,(c,commit)=>set('color2',c,commit)));
    if(P.style==='perwing'){ const g=el('div','wingcols'); for(let i=0;i<Math.round(d.blade.wings);i++){ const inp=el('input'); inp.type='color'; inp.value=P.wingColors[i]||P.color; inp.title='Wing '+(i+1);
        inp.onchange=()=>{ const a=P.wingColors.slice(); for(let q=0;q<Math.round(d.blade.wings);q++) a[q]=a[q]||P.color; a[i]=inp.value; set('wingColors',a,true); }; const lab=el('label','wc',`<span>W${i+1}</span>`); lab.prepend(inp); g.appendChild(lab); } section('Wing colors',g); }
  }
  const pg=el('div','chips'); Object.entries(BF.PATTERNS).forEach(([k,l])=>{ const own=BF.Shop.has('pattern',k); const b=el('button','chip'+(P.pattern===k?' on':'')+(own?'':' locked'),esc(l)+(own?'':`<i class="lk">${BF.Shop.price('pattern',k)}</i>`)); b.type='button'; b.onclick=()=>BF.Shop.require('pattern',k,()=>set('pattern',k,true,true)); pg.appendChild(b); }); section('Pattern',pg);
  if(P.pattern!=='none'){
    section('Pattern color',colorRow(P.patternColor,(c,commit)=>set('patternColor',c,commit)));
    if(!easy){ w.appendChild(baseControl({k:base+'patternScale',t:'range',l:'Pattern size',min:0.4,max:3,step:0.05,fmt:v=>v.toFixed(2)+'×'},d,onChange));
      w.appendChild(baseControl({k:base+'patternAlpha',t:'range',l:'Pattern strength',min:0.1,max:1,step:0.05,fmt:pct},d,onChange)); }
  }
  if(pk==='blade' && !easy){
    // decals
    const dw=el('div','decals'); const up=el('label','btn upl','Upload image / logo'); const fi=el('input'); fi.type='file'; fi.accept='image/*'; fi.hidden=true; up.appendChild(fi);
    fi.onchange=async()=>{ const f=fi.files[0]; if(!f) return; try{ const src=await BF.loadImageFile(f,512); const a=P.decals.slice(); a.push({src,place:'center',size:0.45,rot:0,alpha:1,r:0.7}); set('decals',a,true,true); }catch(e){ BF.App.toast('Couldn’t read that image','bad'); } };
    dw.appendChild(up);
    P.decals.forEach((dc,i)=>dw.appendChild(itemEditor('Image '+(i+1),dc,v=>{ const a=P.decals.slice(); if(v) a[i]=v; else a.splice(i,1); set('decals',a,true,true); },false)));
    section('Images & logos',dw);
    // stickers
    const sw=el('div','decals'); const sg=el('div','chips'); Object.entries(BF.STICKERS).forEach(([k,l])=>{ const own=BF.Shop.has('sticker',k); const b=el('button','chip'+(own?'':' locked'),`+ ${l}`+(own?'':`<i class="lk">${BF.Shop.price('sticker',k)}</i>`)); b.type='button'; b.onclick=()=>BF.Shop.require('sticker',k,()=>{ const a=P.stickers.slice(); a.push({k,place:a.length%2?'wings':'center',size:0.28,rot:0,alpha:1,r:0.72,color:'#ffffff',text:k==='number'?'7':k==='text'?'BEY':''}); set('stickers',a,true,true); }); sg.appendChild(b); });
    sw.appendChild(sg);
    P.stickers.forEach((st,i)=>sw.appendChild(itemEditor(BF.STICKERS[st.k],st,v=>{ const a=P.stickers.slice(); if(v) a[i]=v; else a.splice(i,1); set('stickers',a,true,true); },true)));
    section('Stickers',sw);
    const dr=el('div','drawrow'); const db=el('button','btn primary','Draw on it'); db.type='button'; db.onclick=()=>BF.DrawPad.open(d,BF.mainPart(BF.App.asm),src=>set('drawing',src,true,true)); dr.appendChild(db);
    if(P.drawing){ const cl=el('button','btn ghost','Erase drawing'); cl.type='button'; cl.onclick=()=>set('drawing',null,true,true); dr.appendChild(cl); }
    section('Freehand',dr);
  }
  const all=el('button','btn ghost wide','Use this paint on every part'); all.type='button';
  all.onclick=()=>{ BF.App.push(); Object.keys(d.paint).forEach(k=>{ if(k!==pk && k!=='accent') d.paint[k]=Object.assign(BF.clone(P),{decals:[],stickers:[],drawing:null,style:P.style==='perwing'?'solid':P.style}); }); BF.App.refreshPaint(); BF.App.renderControls(); BF.App.toast('Matched every part'); };
  w.appendChild(all);
  if(BF.Settings.get('preview')==='print') w.appendChild(el('div','ctl-note','Print view is on — the 3D preview shows your nearest filament colors. Switch it in Settings to see full paint.'));
  return w;
}
// small editor for one decal/sticker
function itemEditor(title,obj,save,isSticker){
  const box=el('div','itemed'); const h=el('div','ie-head',`<b>${esc(title)}</b>`); const x=el('button','icon-x','×'); x.type='button'; x.title='Remove'; x.onclick=()=>save(null); h.appendChild(x); box.appendChild(h);
  const row=(label,node)=>{ const r=el('div','ie-row'); r.appendChild(el('span','',label)); r.appendChild(node); box.appendChild(r); };
  const seg=el('div','seg sm'); [['center','Center'],['wings','Every wing']].forEach(([k,l])=>{ const b=el('button',obj.place===k?'on':'',l); b.type='button'; b.onclick=()=>save(Object.assign({},obj,{place:k})); seg.appendChild(b); }); row('Place',seg);
  const rng=(k,min,max,step)=>{ const i=el('input'); i.type='range'; i.min=min; i.max=max; i.step=step; i.value=obj[k]; i.onchange=()=>save(Object.assign({},obj,{[k]:+i.value})); return i; };
  row('Size',rng('size',0.08,isSticker?0.8:1.2,0.01)); row('Rotate',rng('rot',-180,180,1));
  if(obj.place==='wings') row('Distance',rng('r',0.3,0.95,0.01));
  row('Opacity',rng('alpha',0.1,1,0.05));
  if(isSticker){ const c=el('input'); c.type='color'; c.value=obj.color; c.onchange=()=>save(Object.assign({},obj,{color:c.value})); row('Color',c);
    if(obj.k==='text'||obj.k==='number'){ const t=el('input','txt sm'); t.value=obj.text||''; t.maxLength=10; t.onchange=()=>save(Object.assign({},obj,{text:t.value})); row('Text',t); } }
  return box;
}
})();
