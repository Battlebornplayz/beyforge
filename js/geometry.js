/* BeyForge — parametric geometry engine. All parts are closed solids in mm, Z-up, part-local (z=0 = bottom). */
(function(){
'use strict';
const BF = window.BF, T = THREE;
const TAU = Math.PI*2, DEG = Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
BF.util = {clamp, lerp, smooth, TAU, DEG};

let FONT=null;
function getFont(){ if(!FONT && window.BF_FONT){ try{ FONT=new T.Font(window.BF_FONT); }catch(e){ console.warn('font',e); } } return FONT; }

// ---------- wing silhouette profiles: u in [0,1], u=0 is the leading (striking) edge for right spin ----------
function wingProfile(shape,u,custom){
  u=clamp(u,0,1);
  switch(shape){
    case 'blade':  return u<0.12 ? smooth(u/0.12) : Math.pow(1-(u-0.12)/0.88,1.25);
    case 'claw':   return u<0.06 ? smooth(u/0.06) : (u<0.4 ? 1 : Math.pow(1-(u-0.4)/0.6,2.2));
    case 'round':  return Math.pow(Math.sin(Math.PI*u),0.7);
    case 'spike':  return Math.pow(Math.max(0,1-Math.abs(u-0.5)*2),1.5);
    case 'hammer': return smooth(u/0.18)*smooth((1-u)/0.18);
    case 'saw': { const v=(u*3)%1; const tooth=v<0.18? v/0.18 : 1-(v-0.18)/0.82; return (0.45+0.55*tooth)*smooth(u/0.05)*smooth((1-u)/0.05); }
    case 'fin':    return u<0.05 ? smooth(u/0.05) : Math.sqrt(Math.max(0,1-(u-0.05)/0.95));
    case 'ring':   return 1;
    case 'scythe': return smooth(u/0.05)*(u<0.5 ? 1-0.18*Math.sin(Math.PI*u*2) : Math.pow((1-u)/0.5,1.8));
    case 'crescent': return Math.pow(Math.sin(Math.PI*u),0.35)*0.85+0.15*u*(1-u)*4;
    case 'wave':   return (0.5-0.5*Math.cos(4*Math.PI*u))*smooth(Math.min(u,1-u)/0.08)*0.85+0.15*Math.sin(Math.PI*u);
    case 'shield': return smooth(u/0.12)*smooth((1-u)/0.12)*(1-0.35*Math.exp(-Math.pow((u-0.5)/0.08,2)));
    case 'arrow':  return Math.max(u<0.35?u/0.35:Math.max(0,1-(u-0.35)/0.25*1.2), (u>0.55&&u<0.85)?0.45*Math.sin(Math.PI*(u-0.55)/0.3):0);
    case 'twin':   return Math.max(Math.pow(Math.max(0,1-Math.abs(u-0.28)*4),1.3), 0.78*Math.pow(Math.max(0,1-Math.abs(u-0.72)*4),1.3));
    case 'horn':   return u<0.1 ? smooth(u/0.1) : Math.pow(1-(u-0.1)/0.9,3);
    case 'feather':{ const v=(u*5)%1, t=v<0.25?v/0.25:1-(v-0.25)/0.75; return (0.55+0.45*t)*(1-0.45*u)*smooth(u/0.04)*smooth((1-u)/0.06); }
    case 'fang':   return u<0.04 ? smooth(u/0.04) : u<0.2 ? 1-(u-0.04)/0.16*0.45 : 0.55*Math.pow(1-(u-0.2)/0.8,1.2);
    case 'star':   return Math.pow(Math.max(0,1-Math.abs(u-0.5)*2),2.4);
    case 'custom': { const c=custom||[]; const n=c.length; if(n<2) return 0; const x=u*(n-1), i=Math.floor(x), f=x-i; return clamp(lerp(c[clamp(i,0,n-1)], c[clamp(i+1,0,n-1)], f),0,1); }
  }
  return 0;
}
BF.wingProfile = wingProfile;

// ---------- interface dimensions (editable under Print & fit) ----------
function dims(d){
  const f=d.fit, tol=d.print.tolerance;
  return { tol,
    plugR:f.xPlugD/2, plugH:f.xPlugH, plugTabs:3, tabDepth:1.3, tabDeg:16,
    shaftR:f.xSocketD/2, keyDeg:26, keyDepth:1.1,
    bShaftR:f.bShaftD/2, prongDepth:1.5, prongDeg:18, prongH:3.2, engage:3.2,
    bitBodyR:6.6, bitBodyH:4.2, drvBodyR:8.6, drvBodyH:5,
    ratchetR:11.6, ratchetTooth:2.0 };
}
BF.dims = dims;

// ---------- low-level mesh helpers ----------
function toNI(g){ return g.index ? g.toNonIndexed() : g; }
function signedVolume(g){
  const p=g.attributes.position.array; let v=0;
  for(let i=0;i<p.length;i+=9){
    const ax=p[i],ay=p[i+1],az=p[i+2],bx=p[i+3],by=p[i+4],bz=p[i+5],cx=p[i+6],cy=p[i+7],cz=p[i+8];
    v += ax*(by*cz-bz*cy) - ay*(bx*cz-bz*cx) + az*(bx*cy-by*cx);
  }
  return v/6;
}
BF.signedVolume = signedVolume;
function fix(g, keepNormals){
  const src=g; g=toNI(g); if(g!==src) src.dispose();
  if(g.attributes.uv) g.deleteAttribute('uv');
  if(g.attributes.uv2) g.deleteAttribute('uv2');
  g.clearGroups();
  if(signedVolume(g)<0){
    const p=g.attributes.position.array, n=g.attributes.normal?g.attributes.normal.array:null;
    for(let i=0;i<p.length;i+=9) for(let k=0;k<3;k++){
      let t=p[i+3+k]; p[i+3+k]=p[i+6+k]; p[i+6+k]=t;
      if(n){ t=n[i+3+k]; n[i+3+k]=n[i+6+k]; n[i+6+k]=t; }
    }
    if(n) for(let i=0;i<n.length;i++) n[i]=-n[i];
    g.attributes.position.needsUpdate=true;
  }
  if(!keepNormals || !g.attributes.normal) g.computeVertexNormals();
  return g;
}
function mergeNI(geos){
  geos=geos.filter(Boolean); if(!geos.length) return null;
  let n=0; geos.forEach(g=>n+=g.attributes.position.count);
  const P=new Float32Array(n*3), Nn=new Float32Array(n*3); let o=0;
  geos.forEach(g=>{ P.set(g.attributes.position.array,o*3); Nn.set(g.attributes.normal.array,o*3); o+=g.attributes.position.count; g.dispose(); });
  const m=new T.BufferGeometry();
  m.setAttribute('position',new T.BufferAttribute(P,3));
  m.setAttribute('normal',new T.BufferAttribute(Nn,3));
  return m;
}
BF.mergeNI = mergeNI;
function polarPts(rf,N){ const pts=[]; for(let j=0;j<N;j++){ const a=j/N*TAU, r=rf(a); pts.push([r*Math.cos(a), r*Math.sin(a)]); } return pts; }
function mirrorPts(pts){ return pts.map(p=>[p[0],-p[1]]).reverse(); }
function shapeFrom(pts){ const s=new T.Shape(); s.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]); s.closePath(); return s; }
function pathFrom(pts){ const s=new T.Path(); s.moveTo(pts[0][0],pts[0][1]); for(let i=1;i<pts.length;i++) s.lineTo(pts[i][0],pts[i][1]); s.closePath(); return s; }
function circlePts(x,y,r,seg){ seg=seg||32; const p=[]; for(let i=0;i<seg;i++){ const a=i/seg*TAU; p.push([x+r*Math.cos(a), y+r*Math.sin(a)]); } return p; }
function hexPts(x,y,rc,rot){ const p=[]; for(let i=0;i<6;i++){ const a=rot+i/6*TAU; p.push([x+rc*Math.cos(a), y+rc*Math.sin(a)]); } return p; }
function extrude(shape,h,z0){ const g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false,curveSegments:16,steps:1}); if(z0) g.translate(0,0,z0); return fix(g); }
function lathe(profile,seg){ const g=new T.LatheGeometry(profile.map(p=>new T.Vector2(Math.max(0,p[0]),p[1])), seg||64); g.rotateX(Math.PI/2); g.computeVertexNormals(); return fix(g,true); }
function windowFn(count,widthDeg,phase){ const w=widthDeg*DEG/2; phase=phase||0;
  return a=>{ for(let k=0;k<count;k++){ const c=phase+k*TAU/count; const dd=Math.atan2(Math.sin(a-c),Math.cos(a-c)); if(Math.abs(dd)<w) return true; } return false; }; }

// Annular loft: rings are arrays of [x,y,z] with equal length, CCW, ordered inner -> outer.
function loft(topRings, botRings){
  const N=topRings[0].length, pos=[];
  const tri=(a,b,c)=>{ pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]); };
  for(let r=0;r<topRings.length-1;r++){ const A=topRings[r],B=topRings[r+1];
    for(let j=0;j<N;j++){ const j1=(j+1)%N; tri(A[j],B[j],B[j1]); tri(A[j],B[j1],A[j1]); } }
  for(let r=0;r<botRings.length-1;r++){ const A=botRings[r],B=botRings[r+1];
    for(let j=0;j<N;j++){ const j1=(j+1)%N; tri(A[j],B[j1],B[j]); tri(A[j],A[j1],B[j1]); } }
  const To=topRings[topRings.length-1], Bo=botRings[botRings.length-1];
  for(let j=0;j<N;j++){ const j1=(j+1)%N; tri(Bo[j],Bo[j1],To[j1]); tri(Bo[j],To[j1],To[j]); }
  const Ti=topRings[0], Bi=botRings[0];
  for(let j=0;j<N;j++){ const j1=(j+1)%N; tri(Bi[j],Ti[j1],Bi[j1]); tri(Bi[j],Ti[j],Ti[j1]); }
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  return fix(g);
}

// Prism with holes: outer contour (bottom & top rings, CCW), inner hole ring, extra hole contours.
// zf(x,y) -> {top,bot} gives heights for vertices that aren't on the outer ring.
function prism(oB,oT,iB,H,zb,holes,zf){
  const V2=pts=>pts.map(p=>new T.Vector2(p[0],p[1]));
  const outer=oB.map(p=>[p[0],p[1]]);
  const hole0=iB.map(p=>[p[0],p[1]]).reverse();
  const hl=[hole0,...holes.map(h=>T.ShapeUtils.isClockWise(V2(h))?h:h.slice().reverse())];
  const faces=T.ShapeUtils.triangulateShape(V2(outer),hl.map(V2));
  const flat=[...outer,...hl.flat()];
  const nO=outer.length, top=[], bot=[];
  flat.forEach((q,ix)=>{
    if(ix<nO){ top.push(oT[ix]); bot.push(oB[ix]); }
    else if(ix<nO+hole0.length){ top.push([q[0],q[1],H]); bot.push([q[0],q[1],zb]); }
    else { const z=zf(q[0],q[1]); top.push([q[0],q[1],z.top]); bot.push([q[0],q[1],z.bot]); }
  });
  const pos=[]; const tri=(a,b,c)=>pos.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2]);
  faces.forEach(f=>{
    const a=top[f[0]],b=top[f[1]],c=top[f[2]];
    const nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    if(nz>=0){ tri(a,b,c); tri(bot[f[0]],bot[f[2]],bot[f[1]]); } else { tri(a,c,b); tri(bot[f[0]],bot[f[1]],bot[f[2]]); }
  });
  // walls: outer CCW and holes CW, same winding rule gives outward-facing walls
  let off=0;
  [outer,...hl].forEach(ct=>{ const n=ct.length;
    for(let j=0;j<n;j++){ const a=off+j, b=off+(j+1)%n; tri(bot[a],bot[b],top[b]); tri(bot[a],top[b],top[a]); }
    off+=n; });
  const g=new T.BufferGeometry(); g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
  return fix(g);
}

// ---------- emblems (unit size, pointing +y = outward) ----------
function poly(pts){ return shapeFrom(pts); }
const EMB = {
  star: ()=>poly(Array.from({length:10},(_,i)=>{ const a=Math.PI/2+i*Math.PI/5, r=i%2?0.2:0.5; return [r*Math.cos(a), r*Math.sin(a)]; })),
  bolt: ()=>poly([[0.12,0.5],[-0.28,-0.02],[-0.02,-0.02],[-0.14,-0.5],[0.3,0.06],[0.04,0.06],[0.2,0.5]]),
  flame:()=>poly([[0,0.5],[0.1,0.2],[0.22,0.32],[0.34,-0.05],[0.25,-0.35],[0,-0.5],[-0.25,-0.35],[-0.34,-0.05],[-0.2,0.15],[-0.1,0.05]]),
  fang: ()=>poly([[-0.3,0.5],[0.3,0.5],[0.14,0.05],[0,-0.5],[-0.1,0.05]]),
  eye:  ()=>{ const p=[]; for(let i=0;i<=16;i++){ const t=i/16; p.push([-0.5+t, 0.28*Math.sin(Math.PI*t)]); } for(let i=15;i>0;i--){ const t=i/16; p.push([-0.5+t, -0.28*Math.sin(Math.PI*t)]); } const s=poly(p); s.holes.push(pathFrom(circlePts(0,0,0.12,16).reverse())); return s; },
  crown:()=>poly([[-0.5,-0.35],[0.5,-0.35],[0.5,0.3],[0.25,0.0],[0,0.45],[-0.25,0.0],[-0.5,0.3]]),
  chevron:()=>poly([[-0.5,-0.1],[0,0.4],[0.5,-0.1],[0.5,-0.4],[0,0.1],[-0.5,-0.4]]),
  diamond:()=>poly([[0,0.5],[0.32,0],[0,-0.5],[-0.32,0]]),
  ring: ()=>{ const s=poly(circlePts(0,0,0.5,32)); s.holes.push(pathFrom(circlePts(0,0,0.3,32).reverse())); return s; }
};
function emblemGeo(kind,size,h){ const f=EMB[kind]; if(!f) return null; const g=new T.ExtrudeGeometry(f(),{depth:h,bevelEnabled:false,curveSegments:8}); g.scale(size,size,1); return fix(g); }
function barGeo(p0,p1,w,h){
  const dx=p1[0]-p0[0], dy=p1[1]-p0[1], dz=p1[2]-p0[2];
  const L=Math.hypot(dx,dy,dz); const g=new T.BoxGeometry(L,w,h);
  g.translate(0,0,h/2-0.3); g.rotateY(-Math.atan2(dz,Math.hypot(dx,dy))); g.rotateZ(Math.atan2(dy,dx));
  g.translate((p0[0]+p1[0])/2,(p0[1]+p1[1])/2,(p0[2]+p1[2])/2); return fix(g);
}
function studGeo(x,y,z){ const g=new T.CylinderGeometry(0.9,1.0,1.0,12); g.rotateX(Math.PI/2); g.translate(x,y,z+0.2); return fix(g); }

// ---------- BLADE (X) / LAYER (Burst) ----------
// Burst layer generations (real-life inspired): extra metal rings on top, or a chassis / armor piece underneath
const LAYER_STYLES={
  single:{label:'Single'},
  dual:{label:'Dual', metal:{r:0.62,h:1.2,teeth:0}},
  god:{label:'God', metal:{r:0.72,h:1.4,teeth:3}},
  choz:{label:'Cho-Z', metal:{r:0.84,h:1.8,teeth:6}},
  gt:{label:'GT', metal:{r:0.56,h:2.2,teeth:0,role:'weight'}, chip:true},
  sparking:{label:'Sparking', low:{role:'chassis',r:0.9,h:3,lobes:true}},
  db:{label:'DB', low:{role:'armor',r:0.94,h:2.4,lobes:6}, metal:{r:0.46,h:1.6,teeth:4}},
  bu:{label:'BU', low:{role:'armor',r:0.96,h:2.6,lobes:4}, metal:{r:0.6,h:1.8,teeth:5}}
};
BF.LAYER_STYLES=LAYER_STYLES;
const FRAMES={
  comet:{label:'Comet', f:(a,R,s)=>R+s*Math.pow(Math.max(0,Math.cos(3*a)),6)},
  helix:{label:'Helix', f:(a,R,s)=>R+s*(0.5+0.5*Math.sin(2*a+Math.sin(a*2)*0.8))},
  wingspan:{label:'Wingspan', f:(a,R,s)=>R+s*Math.pow(Math.abs(Math.cos(a)),3)},
  dirk:{label:'Dirk', f:(a,R,s)=>R+s*Math.pow(Math.max(0,Math.cos(4*a)),10)},
  flash:{label:'Flash', f:(a,R,s)=>R+s*(((a*5/TAU)%1)<0.35?((a*5/TAU)%1)/0.35:0)},
  crater:{label:'Crater', f:(a,R,s)=>R+s*(0.35+0.25*Math.cos(8*a))}
};
BF.DISC_FRAMES=FRAMES;
function buildBlade(d,D,isB,issues){
  const b=d.blade, N=360, left=d.spin==='left';
  const R=b.diameter/2;
  let holeFn, holeMax;
  if(!isB){ const inT=windowFn(D.plugTabs,D.tabDeg+4); const base=D.plugR+D.tol; holeMax=base+D.tabDepth+D.tol; holeFn=a=>inT(a)?holeMax:base; }
  else { const n=d.lock.teeth, w=D.prongDeg+5-d.lock.strength*0.9; const inT=windowFn(n,w); const base=D.bShaftR+D.tol; holeMax=base+D.prongDepth+D.tol; holeFn=a=>inT(a)?holeMax:base; }
  let Rcore=R*(1-b.depth);
  if(Rcore<holeMax+3){ Rcore=holeMax+3; issues.push({lvl:'info',msg:'Wing reach was capped so the core stays thick around the center hole.'}); }
  const W=Math.max(1,Math.round(b.wings)), ring=b.shape==='ring';
  const span=TAU/W*(ring?1:b.wingWidth);
  const scaleOf=i=>d.symmetry?1:(b.wingScale[i]??1), shiftOf=i=>d.symmetry?0:(b.wingShift[i]||0)*DEG;
  const shapeOf=i=>(b.mixShapes && b.wingShapes && b.wingShapes[i]) || b.shape;
  const rs=new Float64Array(N);
  for(let j=0;j<N;j++){
    const a=j/N*TAU; let h=0;
    for(let i=0;i<W;i++){
      let s=a-(i*TAU/W+shiftOf(i)); s=((s%TAU)+TAU)%TAU;
      if(s<=span){ const u=s/span, sh=shapeOf(i); let p=wingProfile(sh,u,b.custom); if(d.spin==='dual') p=Math.max(p,wingProfile(sh,1-u,b.custom)); h=Math.max(h,p*scaleOf(i)); }
    }
    rs[j]=Rcore+(R-Rcore)*h;
  }
  const k=Math.round(b.soft*N/360);
  if(k>0) for(let pass=0;pass<2;pass++){ const src=rs.slice(); for(let j=0;j<N;j++){ let s=0; for(let q=-k;q<=k;q++) s+=src[(j+q+N)%N]; rs[j]=Math.max(Rcore,s/(2*k+1)); } }
  let Rmax=0; for(let j=0;j<N;j++) Rmax=Math.max(Rmax,rs[j]);
  const spanR=Math.max(0.01,Rmax-Rcore);
  const A=new Float64Array(N), Tt=new Float64Array(N); let prev=-1e9;
  for(let j=0;j<N;j++){ const t=clamp((rs[j]-Rcore)/spanR,0,1); Tt[j]=t; let a=j/N*TAU+b.sweep*DEG*Math.pow(t,1.5); if(a<=prev) a=prev+1e-4; prev=a; A[j]=a; }
  const maxA=A[0]+TAU-1e-3;
  for(let j=N-1;j>0;j--){ const lim=maxA-(N-1-j)*1e-4; if(A[j]>lim) A[j]=lim; else break; }
  const outlineAt=pa=>{ let x=pa-A[0]; x=((x%TAU)+TAU)%TAU+A[0]; let lo=0,hi=N-1; if(x>=A[N-1]) return lerp(rs[N-1],rs[0],(x-A[N-1])/Math.max(1e-6,A[0]+TAU-A[N-1])); while(hi-lo>1){ const m=(lo+hi)>>1; if(A[m]<=x) lo=m; else hi=m; } return lerp(rs[lo],rs[hi],(x-A[lo])/Math.max(1e-6,A[hi]-A[lo])); };
  const idxOf=a=>((Math.round(a/TAU*N)%N)+N)%N;
  const twistAt=(a0,t)=>a0+b.sweep*DEG*Math.pow(clamp(t,0,1),1.5);

  // weight pockets (blind from the underside, capped by the top)
  const ins=BF.INSERTS[d.weights.insert]; const pockets=[]; let baseH=0;
  if(ins && ins.mass>0 && d.weights.count>0 && (!isB || d.weights.part==='layer')){
    const n=d.weights.count, want=d.weights.radius, pr=ins.dia/2+D.tol;
    const same=n===W, period=same?span:TAU/n;
    const clearance=(a,rp)=>{ let c=1e9; for(let q=0;q<20;q++){ const qa=q/20*TAU, x=rp*Math.cos(a)+pr*Math.cos(qa), y=rp*Math.sin(a)+pr*Math.sin(qa); const r2=Math.hypot(x,y); c=Math.min(c, outlineAt(Math.atan2(y,x))-0.9-r2, r2-holeMax-0.9); } return c; };
    const angleOf=(i,s,rp)=>twistAt(i*TAU/n+(same?shiftOf(i):0)+s,(rp-Rcore)/spanR);
    // one shared offset for every pocket keeps the Bey balanced; slide inward until they fit
    let use=null;
    for(let rp=want; rp>=holeMax+pr+0.9 && !use; rp-=0.5){
      let bestS=period*0.5, best=-1e9;
      for(let st=0;st<=48;st++){ const s=period*st/48; let m=1e9; for(let i=0;i<n;i++) m=Math.min(m,clearance(angleOf(i,s,rp),rp)); if(m>best){ best=m; bestS=s; } }
      if(best>0) use={rp,s:bestS};
    }
    if(use){
      for(let i=0;i<n;i++){ const a=angleOf(i,use.s,use.rp); pockets.push({x:use.rp*Math.cos(a), y:use.rp*Math.sin(a), r:pr, a}); }
      if(use.rp<want-0.01) issues.push({lvl:'info',msg:`Weight pockets moved in to ${use.rp.toFixed(1)} mm so they fit inside the wings.`});
    } else issues.push({lvl:'warn',msg:`${ins.label}s don't fit in this ${isB?'layer':'blade'} — pick a smaller insert, fewer pockets, or bigger wings.`});
    if(pockets.length) baseH=ins.depth;
  }
  let H=b.height;
  if(baseH>0 && H<baseH+1.2){ H=baseH+1.2; issues.push({lvl:'info',msg:`Core height raised to ${H.toFixed(1)} mm so the top covers the weight pockets.`}); }
  const zb=baseH>0?baseH-0.05:0;
  const tipZ=clamp(b.tipHeight, (baseH>0?baseH:0)+1.0, 22);
  const rm=Rcore-0.8;
  // side profile: straight line core->tip plus 3 bend handles (push/pull sculpt), and optional wing lift
  const bends=(b.profile&&b.profile.length===3)?b.profile:[0,0,0];
  const bendAt=t=>{ const k=[0,bends[0],bends[1],bends[2],0], x=clamp(t,0,1)*4, i=Math.min(3,Math.floor(x)), f=x-i; return lerp(k[i],k[i+1],smooth(f)); };
  const lift=(b.lift||0);
  const liftAt=t=>lift*Math.pow(clamp(t,0,1),2);
  const topZ=t=>Math.max(zbAt(t)+1.0, lerp(H,tipZ,t)+bendAt(t)*H*0.35+liftAt(t));
  function zbAt(t){ return (baseH>0?baseH-0.05:0)+liftAt(t); }

  let P=[]; for(let j=0;j<N;j++) P.push({a:A[j],r:rs[j],t:Tt[j]});
  if(left) P=P.map(p=>({a:-p.a,r:p.r,t:p.t})).reverse();
  const sl=Math.tan(b.slope*DEG);
  // true height of the top surface along the ray of sample j (right-spin frame)
  const surfZ=(j,r)=>{ const zt=topZ(Tt[j]); const rt=Math.max(rm+0.3, rs[j]-sl*(zt-zb)*Tt[j]); return r<=rm?H:topZ(Tt[j]*clamp((r-rm)/Math.max(0.01,rt-rm),0,1)); };
  const FR=[0.25,0.5,0.75];
  const oB=[],oT=[],iB=[],iT=[],mid=[],midB=[], rT=FR.map(()=>[]), rB=FR.map(()=>[]);
  for(const p of P){
    const c=Math.cos(p.a), s=Math.sin(p.a), hr=holeFn(p.a), zt=topZ(p.t);
    const rt=Math.max(rm+0.3, p.r - sl*(zt-zbAt(p.t))*p.t);
    oB.push([p.r*c,p.r*s,zbAt(p.t)]); oT.push([rt*c,rt*s,zt]); iB.push([hr*c,hr*s,zb]); iT.push([hr*c,hr*s,H]); mid.push([rm*c,rm*s,H]); midB.push([rm*c,rm*s,zb]);
    FR.forEach((f,k)=>{ const t=p.t*f, rr=lerp(rm,rt,f), rb=lerp(rm,p.r,f); rT[k].push([rr*c,rr*s,topZ(t)]); rB[k].push([rb*c,rb*s,zbAt(t)]); });
  }
  // cutouts: through-holes in each wing (built as a prism so holes cut cleanly through the sloped top)
  const cut=b.cutouts||{count:0}; const cutPaths=[];
  if(cut.count>0){
    for(let i=0;i<W;i++) for(let m=0;m<cut.count;m++){
      const ac=i*TAU/W+shiftOf(i)+span*(cut.count===1?0.5:(m+1)/(cut.count+1)), j=idxOf(ac), reach=rs[j]-Rcore;
      const f=clamp(cut.pos,0.25,0.85), rr=Rcore+reach*f, a=twistAt(ac,Tt[j]*f);
      const rad=Math.min(reach*cut.size*0.5, rr*span/(cut.count+1)*0.45);
      if(rad<1.2) continue;
      let pts;
      if(cut.shape==='slot'){ pts=[]; for(let q=0;q<24;q++){ const qa=q/24*TAU, ex=Math.cos(qa)*rad*1.7, ey=Math.sin(qa)*rad*0.65; pts.push([rr*Math.cos(a)+ex*Math.cos(a)-ey*Math.sin(a), rr*Math.sin(a)+ex*Math.sin(a)+ey*Math.cos(a)]); } }
      else if(cut.shape==='tri'){ pts=[0,1,2].map(q=>{ const qa=a+q*TAU/3; return [rr*Math.cos(a)+rad*1.2*Math.cos(qa), rr*Math.sin(a)+rad*1.2*Math.sin(qa)]; }); }
      else pts=circlePts(rr*Math.cos(a),rr*Math.sin(a),rad,24);
      let ok=true; for(const q of pts){ const r2=Math.hypot(q[0],q[1]); if(r2>outlineAt(Math.atan2(q[1],q[0]))-1.3 || r2<rm+0.6) ok=false; }
      for(const pk of pockets) for(const q of pts) if(Math.hypot(q[0]-pk.x,q[1]-pk.y)<pk.r+1.0) ok=false;
      if(ok) cutPaths.push(pts);
    }
    if(!cutPaths.length) issues.push({lvl:'info',msg:'Cutouts are too big for these wings — make them smaller or widen the wings.'});
  }
  if(left) cutPaths.forEach((pts,ix)=>{ cutPaths[ix]=pts.map(q=>[q[0],-q[1]]); });
  const geos=[];
  if(!cutPaths.length) geos.push(loft([iT,mid,...rT,oT],[iB,midB,...rB,oB]));
  else geos.push(prism(oB,oT,iB,H,zb,cutPaths,(x,y)=>{ let a=Math.atan2(y,x); if(left) a=-a; const r=Math.hypot(x,y), ro=outlineAt(a), to=clamp((ro-Rcore)/spanR,0,1); const f=clamp((r-rm)/Math.max(0.01,ro-rm),0,1); return {top:r<=rm?H:topZ(to*f), bot:zbAt(to*f)}; }));
  if(baseH>0){
    const sh=shapeFrom(oB.map(p=>[p[0],p[1]]));
    sh.holes.push(pathFrom(iB.map(p=>[p[0],p[1]])));
    pockets.forEach(pk=>{ const y=left?-pk.y:pk.y; sh.holes.push(pathFrom(ins.shape==='hex'?hexPts(pk.x,y,pk.r,pk.a):circlePts(pk.x,y,pk.r,28))); });
    cutPaths.forEach(pts=>sh.holes.push(pathFrom(pts.slice().reverse())));
    geos.push(extrude(sh,baseH,0));
  }
  // upper tier: a second, smaller blade layer stacked on the core
  const tier=b.tier||{}; let tierH=0;
  if(tier.on){
    const R2=Math.max(holeMax+4, R*tier.diameter), R2c=Math.max(holeMax+1.6, R2*(1-tier.depth)), n2=Math.max(1,Math.round(tier.wings)), sp2=TAU/n2*0.8;
    const tf=a=>{ let s2=((a-TAU/n2/2)%(TAU/n2)+TAU/n2)%(TAU/n2); return s2<=sp2 ? R2c+(R2-R2c)*wingProfile(tier.shape,s2/sp2,b.custom) : R2c; };
    let tp=polarPts(tf,240); if(left) tp=mirrorPts(tp);
    const ts=shapeFrom(tp); ts.holes.push(pathFrom(polarPts(holeFn,180)));
    tierH=clamp(tier.height,1,8); geos.push(extrude(ts,tierH+0.05,H-0.05));
  }

  // decorations built in the right-spin frame, mirrored for left
  const acc=[];
  const deco=d.deco;
  for(let i=0;i<W;i++){
    const ac=i*TAU/W+shiftOf(i)+span*0.5;
    const j=idxOf(ac), reach=rs[j]-Rcore, tj=Tt[j];
    if(deco.emblem!=='none'){
      const f=0.5, rr=Rcore+reach*f, tt=tj*f, a=twistAt(ac,tt);
      let s=deco.emblemSize*Math.min(reach*0.8, rr*span*0.5);
      if(ring) s=deco.emblemSize*Math.min((R-rm)*0.6, rr*TAU/W*0.4);
      if(s>=2.4){ const g=emblemGeo(deco.emblem,s,0.8); g.rotateZ(a-Math.PI/2); g.translate(rr*Math.cos(a),rr*Math.sin(a),surfZ(idxOf(a),rr)-0.3); acc.push(g); }
    }
    if(reach<3) continue;
    const kk=deco.textureCount;
    if(deco.texture==='ridges'){
      for(let m=0;m<kk;m++){
        const a0=i*TAU/W+shiftOf(i)+span*((m+1)/(kk+1)); const jj=idxOf(a0); const re=rs[jj]-Rcore; if(re<3) continue;
        const r0=Rcore+0.4, r1=Rcore+re*0.82, t1=Tt[jj]*0.82, a1=twistAt(a0,t1);
        acc.push(barGeo([r0*Math.cos(a0),r0*Math.sin(a0),surfZ(jj,r0)],[r1*Math.cos(a1),r1*Math.sin(a1),surfZ(idxOf(a1),r1)],0.9,0.8));
      }
    } else if(deco.texture==='studs'){
      [0.3,0.55,0.8].slice(0,kk+1).forEach(f=>{ const rr=Rcore+reach*f, tt=tj*f, a=twistAt(ac+span*0.18,tt); acc.push(studGeo(rr*Math.cos(a),rr*Math.sin(a),surfZ(idxOf(a),rr)-0.3)); });
    } else if(deco.texture==='chevrons'){
      for(let m=0;m<kk;m++){ const f=0.35+0.25*m; if(f>0.9) break; const rr=Rcore+reach*f, tt=tj*f, a=twistAt(ac,tt); const s=Math.min(reach*0.3, rr*span*0.35); if(s<2) continue; const g=emblemGeo('chevron',s,0.7); g.rotateZ(a-Math.PI/2); g.translate(rr*Math.cos(a),rr*Math.sin(a),surfZ(idxOf(a),rr)-0.3); acc.push(g); }
    }
  }
  // horns & spikes standing up off the wings
  const horns=[]; const hc=(deco.horns&&deco.horns.count)||0;
  if(hc>0) for(let i=0;i<W;i++){
    const ac=i*TAU/W+shiftOf(i)+span*0.4, j=idxOf(ac), reach=rs[j]-Rcore; if(reach<4) continue;
    for(let m=0;m<hc;m++){
      const f=hc===1?0.55:0.35+0.45*m/(hc-1), rr=Rcore+reach*f, a=twistAt(ac,Tt[j]*f), z=surfZ(idxOf(a),rr)-0.4;
      const hh=deco.horns.height*(hc===1?1:1-0.2*m), rb=Math.min(2.6,reach*0.18+0.8);
      let g;
      if(deco.horns.style==='fin'){ const sh=poly([[-rb*1.6,0],[rb*1.6,0],[rb*0.3,hh],[-rb*0.2,hh*0.9]]); g=new T.ExtrudeGeometry(sh,{depth:1.4,bevelEnabled:false}); g.translate(0,0,-0.7); g.rotateX(Math.PI/2); g.rotateZ(Math.PI/2); }
      else { g=new T.CylinderGeometry(deco.horns.style==='horn'?0.25:0.05, rb, hh, 14); g.translate(0,hh/2,0); g.rotateX(Math.PI/2); }
      g.rotateX(-(deco.horns.lean||0)*DEG); g.rotateZ(a); g.translate(rr*Math.cos(a),rr*Math.sin(a),z);
      horns.push(fix(g));
    }
  }
  if(left) acc.forEach((g,ix)=>{ g.scale(1,-1,1); acc[ix]=fix(g); });
  if(left) horns.forEach((g,ix)=>{ g.scale(1,-1,1); horns[ix]=fix(g); });

  // curved text around the core (always readable, never mirrored)
  const txt=(deco.text||'').toUpperCase().trim().slice(0,16);
  const font=getFont();
  if(txt && font){
    const rt=(holeMax+rm)/2, band=rm-holeMax;
    if(band>=1.95){
      const size=clamp(band*0.6,1.2,3.2), gs=[], ws=[];
      for(const ch of txt){
        if(ch===' '){ gs.push(null); ws.push(size*0.45); continue; }
        const g=new T.TextGeometry(ch,{font,size,height:0.8,curveSegments:2,bevelEnabled:false});
        g.computeBoundingBox(); const bb=g.boundingBox; g.translate(-(bb.min.x+bb.max.x)/2,-size*0.5,0);
        gs.push(g); ws.push(Math.max(0.3,bb.max.x-bb.min.x));
      }
      const gap=size*0.2; let total=ws.reduce((s,w)=>s+w,0)+gap*(ws.length-1);
      const maxArc=TAU*rt*0.9, sc=total>maxArc?maxArc/total:1; total*=sc;
      const start=Math.PI/2+total/(2*rt); let cum=0;
      gs.forEach((g,ix)=>{ const w=ws[ix]*sc; if(g){ if(sc<1) g.scale(sc,sc,1); const phi=start-(cum+w/2)/rt; g.rotateZ(phi-Math.PI/2); g.translate(rt*Math.cos(phi),rt*Math.sin(phi),H+tierH-0.3); acc.push(fix(g)); } cum+=w+gap*sc; });
    } else issues.push({lvl:'info',msg:'Core ring is too thin for text — lower the wing reach to make room.'});
  }

  const bodies=[{role:'main',geo:mergeNI(geos)}];
  // Burst generations: metal ring on top of the core, chassis/armor under the layer
  let lowH=0, topH=0; const LS=isB&&d.layer?LAYER_STYLES[d.layer.style]:null;
  if(LS&&LS.metal){ const M=LS.metal, rin=holeMax+1.2, rout=Math.max(rin+1.6,Rcore*M.r);
    const sh=shapeFrom(polarPts(a=>rout*(1-(M.teeth?0.1*Math.pow(Math.max(0,Math.cos(M.teeth*a)),2):0)),120)); sh.holes.push(pathFrom(circlePts(0,0,rin,48)));
    topH=M.h; bodies.push({role:M.role||'metal',geo:extrude(sh,M.h,H+tierH)}); }
  if(LS&&LS.low){ const L0=LS.low, rout=R*L0.r, n=L0.lobes===true?W:(L0.lobes||0); lowH=L0.h;
    const sh=shapeFrom(polarPts(a=>rout*(n?0.84+0.16*Math.pow(Math.abs(Math.cos(n*a/2)),2):1),180)); sh.holes.push(pathFrom(polarPts(holeFn,180)));
    bodies.push({role:L0.role,geo:extrude(sh,lowH,-lowH)}); }
  const ag=mergeNI(acc); if(ag) bodies.push({role:'accent',geo:ag});
  const hg=mergeNI(horns); if(hg) bodies.push({role:'horn',geo:hg});
  if(lift>0.3) issues.push({lvl:'info',msg:'Lifted wings print with supports underneath.'});
  const insList=pockets.map(pk=>({x:pk.x,y:left?-pk.y:pk.y,z:baseH/2,ins:d.weights.insert,rot:pk.a}));
  return {id:isB?'layer':'blade', label:isB?'Layer':'Blade', height:H+tierH+topH, zMin:lowH?-lowH:0, bodies, inserts:insList, printFlip:false,
    meta:{lowH, style:LS?d.layer.style:null, R:Rmax, Rcore, rm, holeMax, H, tipZ, W, span, rs:Array.from(rs), baseH, slope:b.slope, tierH, outline:oB.filter((_,i)=>i%2===0).map(q=>[q[0],q[1]]), wingAngles:Array.from({length:W},(_,i)=>{ const a=i*TAU/W+shiftOf(i); return left?-(a+span):a; }), span, left}};
}

// ---------- RATCHET (X) ----------
function buildRatchet(d,D){
  const r=d.ratchet, n=Math.round(r.points), H=r.height/10, N=Math.max(180,n*36);
  const span=TAU/n*0.55, prof=d.spin==='dual'?'hammer':'blade';
  const outerF=a=>{ const s=((a%(TAU/n))+TAU/n)%(TAU/n); return D.ratchetR + (s<span? D.ratchetTooth*wingProfile(prof,s/span) : 0); };
  let outer=polarPts(outerF,N); if(d.spin==='left') outer=mirrorPts(outer);
  const keyIn=windowFn(2,D.keyDeg), sock=a=>D.shaftR+D.tol+(keyIn(a)?D.keyDepth+D.tol:0);
  const holePts=polarPts(sock,180);
  const sh=shapeFrom(outer); sh.holes.push(pathFrom(holePts));
  const collar=extrude(sh,H,0);
  const tabIn=windowFn(D.plugTabs,D.tabDeg), plugF=a=>D.plugR+(tabIn(a)?D.tabDepth:0);
  const ps=shapeFrom(polarPts(plugF,180)); ps.holes.push(pathFrom(holePts));
  const plug=extrude(ps,D.plugH,H-0.05);
  return {id:'ratchet', label:'Ratchet', height:H+D.plugH, seatH:H, bodies:[{role:'main',geo:mergeNI([collar,plug])}], inserts:[], printFlip:false, meta:{R:D.ratchetR+D.ratchetTooth, points:n, H}};
}

// ---------- BIT (X) / DRIVER (Burst) ----------
function tipProfile(prof,w,L,custom){
  switch(prof){
    case 'rush':   return [[0,0],[w*0.55,0],[w*0.85,0.35],[w,0.9],[w,L]];
    case 'taper':  return [[0,0],[w*0.45,0],[w,L*0.65],[w,L]];
    case 'point':  return [[0,0],[0.7,0.05],[w,L*0.75],[w,L]];
    case 'needle': return [[0,0],[0.25,0.03],[w*0.6,L*0.7],[w,L]];
    case 'ball': { const rb=Math.min(w,L), p=[[0,0]]; for(let i=1;i<=10;i++){ const al=i/10*Math.PI/2; p.push([rb*Math.sin(al), rb*(1-Math.cos(al))]); } if(L>rb) p.push([rb,L]); return p; }
    case 'orb':  { const bb=Math.min(L,w*0.8), p=[[0,0]]; for(let i=1;i<=10;i++){ const al=i/10*Math.PI/2; p.push([w*Math.sin(al), bb*(1-Math.cos(al))]); } if(L>bb) p.push([w,L]); return p; }
    case 'spike':  return [[0,0],[0.15,0.02],[w*0.5,L*0.8],[w,L]];
    case 'xtreme': return [[0,0],[Math.max(0.3,w-0.3),0],[w,0.3],[w,L]];
    case 'dish':   return [[0,0.6],[w*0.55,0.6],[w*0.62,0],[Math.max(w*0.65,w-0.3),0],[w,0.3],[w,L]];
    case 'unite':  return [[0,0],[w*0.3,0.08],[w*0.42,0.35],[w*0.6,0.35],[w*0.72,0.12],[w*0.86,0.12],[w,0.6],[w,L]];
    case 'bearing':{ const hw=Math.max(w,5.4); return [[0,0],[1.1,0.25],[1.6,1.1],[2.2,1.4],[hw,1.6],[hw,L]]; }
    case 'mode':   return [[0,0],[0.6,0.05],[1.2,0.8],[w*0.72,0.8],[w*0.82,0.45],[w,0.45],[w,L]];
    case 'custom': { const c=custom&&custom.length?custom:[0.2,0.45,0.7,0.85,0.95,1,1,1]; const pts=[[0,0]]; c.forEach((f,i)=>pts.push([Math.max(0.15,f*w), L*i/(c.length-1)])); return pts; }
    default:       return [[0,0],[Math.max(0.3,w-0.5),0],[w,0.5],[w,L]];
  }
}
BF.tipProfileFor=(prof,w,L,c)=>tipProfile(prof,w,L,c);
function buildBit(d,D,isB,seatLen){
  const bt=d.bit, tip=BF.TIPS[bt.tip]||BF.TIPS.flat;
  const L=Math.max(1.5, bt.tipLen*(tip.low?0.6:1));
  const bodyR=isB?D.drvBodyR:D.bitBodyR, bodyH=isB?D.drvBodyH:D.bitBodyH;
  const w=clamp(bt.width/2,0.8,bodyR-0.3);
  const prof=tipProfile(tip.prof,w,L,bt.customTip), rTop=prof[prof.length-1][0];
  const tipGeo=lathe([...prof,[rTop,L+0.4],[0,L+0.4]], bt.tip==='hexa'?6:64);
  const body=lathe([[0,L-0.2],[Math.max(rTop*0.9,2),L-0.2],[bodyR,L+1.4],[bodyR,L+bodyH],[0,L+bodyH]],64);
  const hb=L+bodyH, main=[body];
  const keyIn=windowFn(2,D.keyDeg-6);
  if(!isB){
    const sf=a=>D.shaftR+(keyIn(a)?D.keyDepth:0);
    main.push(extrude(shapeFrom(polarPts(sf,120)), seatLen-0.3, hb-0.05));
    if(bt.gear){
      const n=Math.round(bt.gearTeeth), Rg0=bodyR+0.6;
      const gf=a=>Rg0+1.3*smooth((Math.cos(n*a)+0.6)/1.2);
      const gs=shapeFrom(polarPts(gf,n*12)); gs.holes.push(pathFrom(circlePts(0,0,bodyR-0.8,48)));
      main.push(extrude(gs,2.2,L+1.6));
    }
  } else {
    const sf=a=>D.bShaftR+(keyIn(a)?D.keyDepth:0);
    main.push(extrude(shapeFrom(polarPts(sf,120)), seatLen, hb-0.05));
    const top=hb+seatLen+D.engage;
    main.push(extrude(shapeFrom(circlePts(0,0,D.bShaftR,48)), D.engage+0.05, hb+seatLen-0.05));
    const n=d.lock.teeth, chord=D.bShaftR*(D.prongDeg-3)*DEG;
    for(let k=0;k<n;k++){ const a=k*TAU/n; const g=new T.BoxGeometry(D.prongDepth+0.4,chord,D.prongH); g.translate(D.bShaftR+(D.prongDepth+0.4)/2-0.4,0,top-D.prongH/2); g.rotateZ(a); main.push(fix(g)); }
  }
  const height=hb+(isB?seatLen+D.engage:seatLen-0.3);
  return {id:isB?'driver':'bit', label:isB?'Driver':'Bit', height, seatZ:hb, bodies:[{role:'tip',geo:tipGeo},{role:'main',geo:mergeNI(main)}], inserts:[], printFlip:true, meta:{tip:bt.tip, w, L, bodyR, gear:!isB&&bt.gear}};
}

// ---------- DISC (Burst) ----------
function buildDisc(d,D,issues){
  const c=d.disc, R=c.diameter/2, n=Math.max(2,Math.round(c.lobes)), N=360;
  const F={
    round:a=>R,
    octa:a=>{ const k=Math.PI/8, seg=Math.PI/4; const m=((a%seg)+seg)%seg-k; return R*Math.cos(k)/Math.cos(m); },
    star:a=>R*(0.8+0.2*Math.pow(0.5+0.5*Math.cos(n*a),2)),
    wing:a=>R*(0.74+0.26*Math.pow(Math.abs(Math.cos(n*a/2)),1.5)),
    gear:a=>R-1.1+1.1*smooth((Math.cos(n*3*a)+0.3)/0.6)
  }[c.shape]||(a=>R);
  const outline=polarPts(F,N);
  const keyIn=windowFn(2,D.keyDeg), holeR=a=>D.bShaftR+D.tol+(keyIn(a)?D.keyDepth+D.tol:0);
  const holeMax=D.bShaftR+D.tol+D.keyDepth+D.tol;
  const sh=shapeFrom(outline); sh.holes.push(pathFrom(polarPts(holeR,180)));
  const ins=BF.INSERTS[d.weights.insert], inserts=[];
  if(ins && ins.mass>0 && d.weights.count>0 && d.weights.part==='disc'){
    const cnt=d.weights.count, want=d.weights.radius, pr=ins.dia/2+D.tol;
    const fits=(rp)=>{ for(let i=0;i<cnt;i++){ const a=i*TAU/cnt+Math.PI/cnt, x=rp*Math.cos(a), y=rp*Math.sin(a);
      if(rp-pr<holeMax+1) return false;
      for(let q=0;q<16;q++){ const qa=q/16*TAU, px=x+pr*Math.cos(qa), py=y+pr*Math.sin(qa); if(Math.hypot(px,py)>F(Math.atan2(py,px))-0.9) return false; } }
      if(cnt>1 && 2*rp*Math.sin(Math.PI/cnt)<2*pr+1) return false; return true; };
    let rp=null; for(let r=want; r>=holeMax+pr+1; r-=0.5) if(fits(r)){ rp=r; break; }
    if(ins.depth>c.thickness+0.01) issues.push({lvl:'warn',msg:`Disc is ${c.thickness} mm thick but ${ins.label}s need ${ins.depth} mm — thicken the disc or pick smaller inserts.`});
    else if(rp==null) issues.push({lvl:'warn',msg:`${cnt} × ${ins.label} won't fit in this disc — use fewer or smaller inserts, or a bigger disc.`});
    else {
      if(rp<want-0.01) issues.push({lvl:'info',msg:`Disc pockets moved in to ${rp.toFixed(1)} mm so they fit.`});
      for(let i=0;i<cnt;i++){ const a=i*TAU/cnt+Math.PI/cnt, x=rp*Math.cos(a), y=rp*Math.sin(a); sh.holes.push(pathFrom(ins.shape==='hex'?hexPts(x,y,pr,a):circlePts(x,y,pr,28))); inserts.push({x,y,z:c.thickness/2,ins:d.weights.insert,rot:a}); }
    }
  }
  const geos=[extrude(sh,c.thickness,0)];
  const rimH=c.rim*3;
  if(rimH>0.2){
    const rin=Math.max(R*0.68, D.drvBodyR+1.0);
    if(rin<R-1.2){ const rs=shapeFrom(outline); rs.holes.push(pathFrom(circlePts(0,0,rin,64))); geos.push(extrude(rs,rimH+0.05,-rimH)); }
  }
  const bodies=[{role:'main',geo:mergeNI(geos)}]; let Rf=R;
  const fr=c.frame&&c.frame.on&&FRAMES[c.frame.shape];
  if(fr){ const sz=clamp(+c.frame.size||3,1,8), out=polarPts(a=>fr.f(a,R+0.2,sz),240); Rf=Math.max(...out.map(q=>Math.hypot(q[0],q[1])));
    const fs=shapeFrom(out); fs.holes.push(pathFrom(circlePts(0,0,R+0.15,96))); const fh=Math.max(1.2,c.thickness*0.7); bodies.push({role:'frame',geo:extrude(fs,fh,(c.thickness-fh)/2)}); }
  return {id:'disc', label:'Disc', height:c.thickness, zMin:rimH>0.2?-rimH:0, bodies, inserts, printFlip:rimH>0.2, meta:{R:Rf, rim:rimH, frame:fr?c.frame.shape:null}};
}

// ---------- CHIP / CAP: decorative top piece that pegs into the center hole ----------
function buildChip(d,D,blade,isB,issues){
  const c=d.chip, bm=blade.meta, rc=bm.holeMax+2.4, h=clamp(c.height,1.5,6);
  const holeR=(isB?D.bShaftR:D.plugR)+D.tol;
  const pegLen=Math.min(2.5, bm.H-(isB?D.engage:D.plugH)-0.4);
  const prof=[[0,0],[rc,0],[rc,h*0.35]]; const dome=clamp(c.dome,0,1);
  for(let i=1;i<=8;i++){ const t=i/8; prof.push([rc*Math.cos(t*Math.PI/2*(0.4+0.6*dome)+ (1-dome)*0)*(1-t*0.15)*(1-t*t*(0.2+0.8*dome)), h*0.35+h*0.65*Math.sin(t*Math.PI/2)]); }
  prof.push([0,h]);
  const geos=[lathe(prof,64)];
  if(pegLen>=1){ const peg=new T.CylinderGeometry(holeR-D.tol-0.15,holeR-D.tol-0.15,pegLen+0.05,32); peg.rotateX(Math.PI/2); peg.translate(0,0,-pegLen/2+0.02); geos.push(fix(peg)); }
  else issues.push({lvl:'info',msg:'The center hole is too shallow for a chip peg — glue the chip on.'});
  const acc=[];
  if(c.emblem && c.emblem!=='none'){ const g=emblemGeo(c.emblem,rc*1.1,0.8); g.translate(0,0,h-0.35); acc.push(g); }
  const bodies=[{role:'main',geo:mergeNI(geos)}]; const ag=mergeNI(acc); if(ag) bodies.push({role:'accent',geo:ag});
  return {id:'chip', label:isB?'Chip':'Cap', height:h, zMin:pegLen>=1?-pegLen:0, bodies, inserts:[], printFlip:false, meta:{R:rc}};
}

// ---------- ASSEMBLY ----------
BF.mainPart = asm => asm.parts.find(p=>p.id==='blade'||p.id==='layer');
BF.build = function(d){
  const D=dims(d), isB=d.system==='Burst', issues=[];
  const parts=[];
  if(!isB){
    const rat=buildRatchet(d,D);
    const bit=buildBit(d,D,false,rat.seatH);
    const blade=buildBlade(d,D,false,issues);
    bit.z0=0; rat.z0=bit.seatZ; blade.z0=rat.z0+rat.seatH;
    if(D.plugH>blade.height-0.6) issues.push({lvl:'warn',msg:'Ratchet plug is taller than the blade core — raise core height or lower plug height.'});
    parts.push(blade,rat,bit);
    if(d.chip&&d.chip.on){ const ch=buildChip(d,D,blade,false,issues); ch.z0=blade.z0+blade.height-0.02; parts.unshift(ch); }
  } else {
    const disc=buildDisc(d,D,issues);
    const drv=buildBit(d,D,true,d.disc.thickness);
    const layer=buildBlade(d,D,true,issues);
    drv.z0=0; disc.z0=drv.seatZ; layer.z0=disc.z0+d.disc.thickness+(layer.meta.lowH||0);
    if(D.engage>layer.height-0.6) issues.push({lvl:'warn',msg:'Driver lock prongs are taller than the layer core — raise the core height.'});
    if(disc.meta.rim>drv.seatZ-0.5) issues.push({lvl:'warn',msg:'Disc rim hangs low enough to scrape the stadium — lower rim weight or use a taller tip.'});
    parts.push(layer,disc,drv);
    if(d.chip&&d.chip.on){ const ch=buildChip(d,D,layer,true,issues); ch.z0=layer.z0+layer.height-0.02; parts.unshift(ch); }
  }
  let top=0; parts.forEach(p=>top=Math.max(top,p.z0+p.height));
  return {d, D, isB, parts, issues, height:top};
};

// ---------- mass properties ----------
// returns volume (mm3), first moments, and second moments sum(x^2), sum(y^2) for a closed mesh
function moments(geo){
  const p=geo.attributes.position.array; let V=0,mx=0,my=0,mz=0,ix=0,iy=0;
  for(let i=0;i<p.length;i+=9){
    const ax=p[i],ay=p[i+1],az=p[i+2],bx=p[i+3],by=p[i+4],bz=p[i+5],cx=p[i+6],cy=p[i+7],cz=p[i+8];
    const v=(ax*(by*cz-bz*cy)-ay*(bx*cz-bz*cx)+az*(bx*cy-by*cx))/6;
    V+=v; mx+=v*(ax+bx+cx)/4; my+=v*(ay+by+cy)/4; mz+=v*(az+bz+cz)/4;
    ix+=v/10*(ax*ax+bx*bx+cx*cx+ax*bx+ax*cx+bx*cx);
    iy+=v/10*(ay*ay+by*by+cy*cy+ay*by+ay*cy+by*cy);
  }
  return {V,mx,my,mz,ix,iy};
}
BF.moments = moments;
BF.partMaterial = function(d,part,role){
  const P=d.paint||{}, pc=(k,fb)=>(P[k]&&P[k].color)||fb;
  if(role==='metal'||role==='weight') return {mat:'METAL', color:pc('metal','#c3c9d4')};
  if(role==='chassis'||role==='armor') return {mat:d.blade.material, color:pc('armor',pc('accent',d.deco.accent))};
  if(role==='frame') return {mat:d.disc.material, color:pc('frame',pc('accent',d.deco.accent))};
  if(role==='accent') return {mat:d.blade.material, color:pc('accent',d.deco.accent)};
  if(role==='horn') return {mat:d.blade.material, color:pc('horn',d.deco.accent)};
  if(part.id==='chip') return {mat:d.blade.material, color:pc('chip','#ffd21f')};
  if(part.id==='blade'||part.id==='layer') return {mat:d.blade.material, color:pc('blade',d.blade.color)};
  if(part.id==='ratchet') return {mat:d.ratchet.material, color:pc('ratchet',d.ratchet.color)};
  if(part.id==='disc') return {mat:d.disc.material, color:pc('disc',d.disc.color)};
  if(role==='tip') return {mat:d.bit.tipMaterial, color:pc('tip',d.bit.tipColor)};
  return {mat:d.bit.material, color:pc('bit',d.bit.color)};
};
// printed parts are not solid: walls are solid, the inside is infill
BF.fillFactor = d => 0.55 + 0.45*d.print.infill;
BF.massProps = function(asm){
  const d=asm.d, ff=BF.fillFactor(d);
  let M=0,Mx=0,My=0,Mz=0,Izz=0; const per=[];
  asm.parts.forEach(part=>{
    let pm=0, pv=0;
    part.bodies.forEach(b=>{
      if(!b.mom) b.mom=moments(b.geo);
      const pmInfo=BF.partMaterial(d,part,b.role), mat=BF.MATERIALS[pmInfo.mat]||BF.MATERIALS.PLA;
      const rho=mat.density/1000*ff; const m=b.mom;
      pm+=rho*m.V; pv+=m.V; M+=rho*m.V; Mx+=rho*m.mx; My+=rho*m.my; Mz+=rho*(m.mz+part.z0*m.V); Izz+=rho*(m.ix+m.iy);
    });
    let im=0;
    (part.inserts||[]).forEach(it=>{ const ins=BF.INSERTS[it.ins]; const m=ins.mass; im+=m; M+=m; Mx+=m*it.x; My+=m*it.y; Mz+=m*(it.z+part.z0); Izz+=m*(it.x*it.x+it.y*it.y); });
    per.push({id:part.id,label:part.label,mass:pm+im,printed:pm,inserts:im,volume:pv});
  });
  const cx=Mx/M, cy=My/M, cz=Mz/M;
  return {mass:M, com:[cx,cy,cz], offset:Math.hypot(cx,cy), Izz, per};
};
})();
