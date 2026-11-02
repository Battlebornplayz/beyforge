/* BeyForge — paint engine. Paint is drawn top-down onto a canvas and projected onto each part. */
(function(){
'use strict';
const BF=window.BF, T=THREE, TAU=Math.PI*2;
const S=1024;                       // texture resolution
const texCache=new Map(), imgCache=new Map();

// images (decals, drawings) load async; when one finishes we ask the app to repaint
BF.img=function(src){
  if(!src) return null; let im=imgCache.get(src);
  if(!im){ im=new Image(); im.onload=()=>{ im.ready=true; clearTimeout(BF._repaintT); BF._repaintT=setTimeout(()=>{ texCache.clear(); BF.App&&BF.App.refreshPaint&&BF.App.refreshPaint(); },30); }; im.src=src; imgCache.set(src,im); }
  return im.ready?im:null;
};

// ---------- procedural patterns, drawn in world mm around the center ----------
function pattern(ctx,kind,R,col,scale,seed){
  const r=BF.rng(seed||7), k=Math.max(0.3,scale||1);
  ctx.fillStyle=col; ctx.strokeStyle=col;
  switch(kind){
    case 'stripes': { const w=2.4*k; ctx.save(); ctx.rotate(0.6); for(let x=-R*1.5;x<R*1.5;x+=w*2) ctx.fillRect(x,-R*1.5,w,R*3); ctx.restore(); break; }
    case 'tiger': { for(let i=0;i<22;i++){ const a=r()*TAU, r0=R*(0.25+r()*0.4), len=R*(0.3+r()*0.5)*k, wd=(1.2+r()*2.2)*k;
        ctx.beginPath(); const steps=8; for(let s=0;s<=steps;s++){ const t=s/steps, rr=r0+len*t, aa=a+Math.sin(t*3+i)*0.15; const ww=wd*(1-t);
          const x=rr*Math.cos(aa), y=rr*Math.sin(aa), nx=-Math.sin(aa)*ww, ny=Math.cos(aa)*ww; s?ctx.lineTo(x+nx,y+ny):ctx.moveTo(x+nx,y+ny); }
        for(let s=steps;s>=0;s--){ const t=s/steps, rr=r0+len*t, aa=a+Math.sin(t*3+i)*0.15; const ww=wd*(1-t); ctx.lineTo(rr*Math.cos(aa)+Math.sin(aa)*ww, rr*Math.sin(aa)-Math.cos(aa)*ww); }
        ctx.fill(); } break; }
    case 'camo': { for(let i=0;i<60;i++){ const x=(r()*2-1)*R, y=(r()*2-1)*R; ctx.beginPath(); for(let q=0;q<7;q++){ const a=q/7*TAU, rr=(2+r()*4)*k; q?ctx.lineTo(x+rr*Math.cos(a),y+rr*Math.sin(a)):ctx.moveTo(x+rr*Math.cos(a),y+rr*Math.sin(a)); } ctx.fill(); } break; }
    case 'carbon': { const c=1.4*k; for(let x=-R;x<R;x+=c) for(let y=-R;y<R;y+=c){ const on=(Math.floor(x/c)+Math.floor(y/c))%2===0; ctx.globalAlpha*= on?1:0.35; ctx.fillRect(x,y,c*0.95,c*(on?0.45:0.95)); ctx.globalAlpha/= on?1:0.35; } break; }
    case 'lightning': { ctx.lineWidth=0.9*k; ctx.lineJoin='miter'; for(let i=0;i<9;i++){ let a=i/9*TAU+r()*0.3, rr=R*0.3; ctx.beginPath(); ctx.moveTo(rr*Math.cos(a),rr*Math.sin(a)); while(rr<R){ rr+=2.5*k+r()*2; a+=(r()-0.5)*0.35; ctx.lineTo(rr*Math.cos(a),rr*Math.sin(a)); } ctx.stroke(); } break; }
    case 'scales': { const s=3*k; ctx.lineWidth=0.5; for(let y=-R,row=0;y<R;y+=s*0.6,row++) for(let x=-R+(row%2)*s/2;x<R;x+=s){ ctx.beginPath(); ctx.arc(x,y,s/2,Math.PI,0); ctx.stroke(); } break; }
    case 'hex': { const s=2.6*k, h=s*Math.sqrt(3); ctx.lineWidth=0.35; for(let y=-R;y<R;y+=h/2) for(let x=-R+((Math.round((y+R)/(h/2)))%2)*s*1.5;x<R;x+=s*3){ ctx.beginPath(); for(let q=0;q<6;q++){ const a=q/6*TAU; q?ctx.lineTo(x+s*Math.cos(a),y+s*Math.sin(a)):ctx.moveTo(x+s*Math.cos(a),y+s*Math.sin(a)); } ctx.closePath(); ctx.stroke(); } break; }
    case 'dots': { const s=3*k; for(let x=-R;x<R;x+=s) for(let y=-R;y<R;y+=s){ ctx.beginPath(); ctx.arc(x+((Math.round(y/s))%2)*s/2,y,s*0.22,0,TAU); ctx.fill(); } break; }
    case 'waves': { ctx.lineWidth=0.7*k; for(let rr=R*0.25;rr<R;rr+=2.4*k){ ctx.beginPath(); for(let q=0;q<=180;q++){ const a=q/180*TAU, w=rr+Math.sin(a*8)*0.8*k; q?ctx.lineTo(w*Math.cos(a),w*Math.sin(a)):ctx.moveTo(w*Math.cos(a),w*Math.sin(a)); } ctx.stroke(); } break; }
    case 'galaxy': { for(let i=0;i<6;i++){ const x=(r()*2-1)*R*0.7, y=(r()*2-1)*R*0.7, g=ctx.createRadialGradient(x,y,0,x,y,R*0.5*k); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); ctx.save(); ctx.globalAlpha*=0.35; ctx.fillStyle=g; ctx.fillRect(-R,-R,2*R,2*R); ctx.restore(); }
        ctx.fillStyle='#ffffff'; for(let i=0;i<260;i++){ const x=(r()*2-1)*R, y=(r()*2-1)*R; ctx.globalAlpha=0.4+r()*0.6; ctx.fillRect(x,y,0.25+r()*0.35,0.25+r()*0.35); } ctx.globalAlpha=1; break; }
    case 'splatter': { for(let i=0;i<70;i++){ const x=(r()*2-1)*R, y=(r()*2-1)*R, s=(0.3+Math.pow(r(),3)*3)*k; ctx.beginPath(); ctx.arc(x,y,s,0,TAU); ctx.fill(); } break; }
    case 'flames': { for(let i=0;i<14;i++){ const a=i/14*TAU+r()*0.1, len=R*(0.45+r()*0.35)*k, w=R*0.12; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(R*0.95,-w);
        ctx.bezierCurveTo(R*0.8,-w*0.4,R*0.95-len*0.6,-w*1.1,R*0.95-len,0); ctx.bezierCurveTo(R*0.95-len*0.6,w*0.9,R*0.82,w*0.2,R*0.95,w); ctx.closePath(); ctx.fill(); ctx.restore(); } break; }
  }
}

// ---------- stickers ----------
function sticker(ctx,st,size){
  const s=size/2; ctx.fillStyle=st.color||'#ffffff'; ctx.strokeStyle=st.color||'#ffffff';
  const path=pts=>{ ctx.beginPath(); pts.forEach((p,i)=>i?ctx.lineTo(p[0]*s,p[1]*s):ctx.moveTo(p[0]*s,p[1]*s)); ctx.closePath(); ctx.fill(); };
  switch(st.k){
    case 'star': path(Array.from({length:10},(_,i)=>{ const a=-Math.PI/2+i*Math.PI/5, r=i%2?0.42:1; return [r*Math.cos(a),r*Math.sin(a)]; })); break;
    case 'bolt': path([[0.25,-1],[-0.55,0.05],[-0.05,0.05],[-0.3,1],[0.6,-0.12],[0.1,-0.12],[0.4,-1]]); break;
    case 'flame': path([[0,-1],[0.2,-0.4],[0.45,-0.65],[0.7,0.1],[0.5,0.7],[0,1],[-0.5,0.7],[-0.7,0.1],[-0.4,-0.3],[-0.2,-0.1]]); break;
    case 'crown': path([[-1,0.7],[1,0.7],[1,-0.6],[0.5,0],[0,-0.9],[-0.5,0],[-1,-0.6]]); break;
    case 'heart': ctx.beginPath(); ctx.moveTo(0,0.9*s); ctx.bezierCurveTo(-1.2*s,0,-0.6*s,-1*s,0,-0.35*s); ctx.bezierCurveTo(0.6*s,-1*s,1.2*s,0,0,0.9*s); ctx.fill(); break;
    case 'skull': ctx.beginPath(); ctx.arc(0,-0.15*s,0.8*s,0,TAU); ctx.fill(); ctx.fillRect(-0.45*s,0.4*s,0.9*s,0.5*s); ctx.globalCompositeOperation='destination-out'; ctx.beginPath(); ctx.arc(-0.32*s,-0.15*s,0.22*s,0,TAU); ctx.arc(0.32*s,-0.15*s,0.22*s,0,TAU); ctx.fill(); ctx.fillRect(-0.06*s,0.25*s,0.12*s,0.2*s); ctx.globalCompositeOperation='source-over'; break;
    case 'eye': ctx.beginPath(); ctx.ellipse(0,0,s,0.55*s,0,0,TAU); ctx.fill(); ctx.globalCompositeOperation='destination-out'; ctx.beginPath(); ctx.arc(0,0,0.3*s,0,TAU); ctx.fill(); ctx.globalCompositeOperation='source-over'; ctx.beginPath(); ctx.arc(0,0,0.14*s,0,TAU); ctx.fill(); break;
    case 'claw': ctx.lineWidth=0.18*s; ctx.lineCap='round'; [-0.5,0,0.5].forEach(o=>{ ctx.beginPath(); ctx.moveTo((o-0.25)*s,-0.9*s); ctx.quadraticCurveTo((o+0.15)*s,0,(o-0.1)*s,0.9*s); ctx.stroke(); }); break;
    case 'target': ctx.lineWidth=0.14*s; [1,0.62,0.25].forEach(r=>{ ctx.beginPath(); ctx.arc(0,0,r*s*0.9,0,TAU); r<0.3?ctx.fill():ctx.stroke(); }); break;
    case 'wing': path([[-1,0.5],[-0.2,-0.2],[0.2,-0.9],[1,-1],[0.6,-0.5],[0.9,-0.4],[0.4,-0.05],[0.6,0.1],[0,0.35],[0.15,0.5]]); break;
    case 'diamond': path([[0,-1],[0.65,0],[0,1],[-0.65,0]]); break;
    case 'number': case 'text': ctx.font=`700 ${s*(st.k==='number'?1.6:0.9)}px "Chakra Petch", Bahnschrift, sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(String(st.text||(st.k==='number'?'1':'BEY')).slice(0,10),0,0); break;
  }
}
BF.drawSticker=sticker;

// place helper: run fn at each spot (center, or every wing at a radius fraction)
function placeEach(ctx,item,R,wingInfo,fn){
  const spots=[];
  if(item.place==='wings' && wingInfo && wingInfo.angles.length){
    wingInfo.angles.forEach(a0=>{ const a=a0+wingInfo.span*0.5; const rr=R*(item.r??0.72); spots.push([rr*Math.cos(a),rr*Math.sin(a),a-Math.PI/2]); });
  } else if(item.place==='free'){ spots.push([(item.x||0)*R,(item.y||0)*R,0]); }
  else spots.push([0,0,0]);
  spots.forEach(([x,y,rot])=>{ ctx.save(); ctx.translate(x,y); ctx.rotate(rot+(item.rot||0)*Math.PI/180); ctx.scale(1,-1); ctx.globalAlpha=item.alpha??1; fn(); ctx.restore(); });
}

// ---------- texture ----------
BF.paintCanvas=function(paint,R,wingInfo){
  const c=document.createElement('canvas'); c.width=c.height=S; const ctx=c.getContext('2d');
  ctx.setTransform(S/(2*R),0,0,-S/(2*R),S/2,S/2);
  // base
  if(paint.style==='gradient'){ const g=ctx.createRadialGradient(0,0,R*0.15,0,0,R); g.addColorStop(0,paint.color); g.addColorStop(1,paint.color2); ctx.fillStyle=g; }
  else ctx.fillStyle=paint.color;
  ctx.fillRect(-R,-R,2*R,2*R);
  if(paint.style==='twotone'){ ctx.fillStyle=paint.color2; ctx.beginPath(); ctx.arc(0,0,R*1.5,0,TAU); ctx.arc(0,0,R*0.62,0,TAU,true); ctx.fill('evenodd'); }
  if(paint.style==='perwing' && wingInfo){
    wingInfo.angles.forEach((a,i)=>{ const col=paint.wingColors[i]||paint.color; ctx.fillStyle=col; ctx.beginPath(); ctx.moveTo(0,0); ctx.arc(0,0,R*1.5,a-0.02,a+Math.max(wingInfo.span,TAU/wingInfo.angles.length)+0.02); ctx.closePath(); ctx.fill(); });
  }
  // pattern
  if(paint.pattern && paint.pattern!=='none'){ ctx.save(); ctx.globalAlpha=paint.patternAlpha??0.7; pattern(ctx,paint.pattern,R,paint.patternColor,paint.patternScale,13); ctx.restore(); }
  // freehand drawing layer (stored in the same top-down space)
  if(paint.drawing){ const im=BF.img(paint.drawing); if(im){ ctx.save(); ctx.setTransform(1,0,0,1,0,0); ctx.drawImage(im,0,0,S,S); ctx.restore(); } }
  // decals
  (paint.decals||[]).forEach(dc=>{ const im=BF.img(dc.src); if(!im) return; const sz=R*(dc.size||0.5); const ar=im.width/im.height||1;
    placeEach(ctx,dc,R,wingInfo,()=>ctx.drawImage(im,-sz*Math.min(1,ar)/2,-sz/Math.max(1,ar)/2,sz*Math.min(1,ar),sz/Math.max(1,ar))); });
  // stickers
  (paint.stickers||[]).forEach(st=>placeEach(ctx,st,R,wingInfo,()=>sticker(ctx,st,R*(st.size||0.3))));
  return c;
};
const needsTexture=p=>p.style!=='solid'||(p.pattern&&p.pattern!=='none')||p.drawing||(p.decals&&p.decals.length)||(p.stickers&&p.stickers.length);

// planar top-down UVs so the painted canvas lands on the part
function ensureUV(geo,R){
  if(geo.attributes.uv && geo.userData.uvR===R) return;
  const p=geo.attributes.position.array, uv=new Float32Array(p.length/3*2);
  for(let i=0,j=0;i<p.length;i+=3,j+=2){ uv[j]=p[i]/(2*R)+0.5; uv[j+1]=p[i+1]/(2*R)+0.5; }
  geo.setAttribute('uv',new T.BufferAttribute(uv,2)); geo.userData.uvR=R;
}

const FINISH={
  matte:{roughness:0.85,metalness:0}, gloss:{roughness:0.16,metalness:0}, satin:{roughness:0.45,metalness:0.05},
  metallic:{roughness:0.3,metalness:0.85}, chrome:{roughness:0.05,metalness:1}, pearl:{roughness:0.32,metalness:0.15,physical:true}, glow:{roughness:0.3,metalness:0,glow:true}
};
BF.paintKey=(d,part,role)=>{
  if(role==='accent') return 'accent'; if(role==='horn') return 'horn'; if(role==='tip') return 'tip';
  if(role==='metal'||role==='weight') return 'metal'; if(role==='chassis'||role==='armor') return 'armor'; if(role==='frame') return 'frame';
  return {blade:'blade',layer:'blade',ratchet:'ratchet',disc:'disc',bit:'bit',driver:'bit',chip:'chip'}[part.id]||'blade';
};
// main entry: material for one body of one part
BF.materialFor=function(d,part,body,opts){
  opts=opts||{}; const key=BF.paintKey(d,part,body.role); const paint=(d.paint&&d.paint[key])||BF.defaultPaint(BF.partMaterial(d,part,body.role).color,key==='metal'?'metallic':key==='frame'||key==='armor'?'satin':undefined);
  const print=BF.Settings && BF.Settings.get('preview')==='print';
  const matKey=BF.partMaterial(d,part,body.role).mat, M=BF.MATERIALS[matKey]||BF.MATERIALS.PLA;
  if(print){ const col=BF.Settings.nearestFilament(paint.color); return new T.MeshStandardMaterial({color:col,roughness:Math.max(0.35,M.rough),metalness:M.metal*0.5,clippingPlanes:opts.clip||null,side:opts.double?T.DoubleSide:T.FrontSide}); }
  const f=FINISH[paint.finish]||FINISH.gloss;
  const prm={color:new T.Color('#ffffff'),roughness:f.roughness,metalness:f.metalness,envMapIntensity:f.metalness>0.5?1.25:0.9,clippingPlanes:opts.clip||null,side:opts.double?T.DoubleSide:T.FrontSide};
  if(f.physical){ Object.assign(prm,{clearcoat:1,clearcoatRoughness:0.08,sheen:new T.Color(paint.color2||'#ffffff')}); }
  const mat=f.physical?new T.MeshPhysicalMaterial(prm):new T.MeshStandardMaterial(prm);
  const R=(part.meta&&part.meta.R)||20;
  if(needsTexture(paint) && (key==='blade'||key==='disc'||key==='ratchet'||key==='chip'||key==='bit')){
    const wi=(key==='blade'&&part.meta.wingAngles)?{angles:part.meta.wingAngles,span:part.meta.span}:null;
    const ck=JSON.stringify(paint)+'|'+R.toFixed(2)+'|'+(wi?wi.angles.map(a=>a.toFixed(3)).join(','):'');
    let tex=texCache.get(ck);
    if(!tex){ tex=new T.CanvasTexture(BF.paintCanvas(paint,R,wi)); tex.encoding=T.sRGBEncoding; tex.anisotropy=4; texCache.set(ck,tex); if(texCache.size>40){ const first=texCache.keys().next().value; texCache.get(first).dispose(); texCache.delete(first); } }
    ensureUV(body.geo,R); mat.map=tex;
    if(f.glow){ mat.emissive=new T.Color('#ffffff'); mat.emissiveMap=tex; mat.emissiveIntensity=0.55; }
  } else {
    mat.color.set(paint.color);
    if(f.glow){ mat.emissive=new T.Color(paint.color); mat.emissiveIntensity=0.6; }
  }
  return mat;
};
BF.clearPaintCache=()=>{ texCache.forEach(t=>t.dispose()); texCache.clear(); };

// ---------- freehand drawing modal ----------
BF.DrawPad={
  open(d,part,onSave){
    const m=document.getElementById('drawModal'); m.hidden=false;
    const cv=document.getElementById('drawCanvas'), ctx=cv.getContext('2d'); const R=part.meta.R;
    const paint=d.paint.blade, wi={angles:part.meta.wingAngles,span:part.meta.span};
    // backdrop: current paint (without the old drawing) + blade silhouette
    const bg=document.getElementById('drawBg'), bctx=bg.getContext('2d');
    const base=BF.paintCanvas(Object.assign({},paint,{drawing:null}),R,wi);
    bctx.clearRect(0,0,bg.width,bg.height); bctx.drawImage(base,0,0,bg.width,bg.height);
    // mask to the blade outline so you see the real shape
    const ol=part.meta.outline; bctx.globalCompositeOperation='destination-in'; bctx.beginPath();
    const k=bg.width/(2*R);
    ol.forEach((q,j)=>{ const x=bg.width/2+q[0]*k, y=bg.height/2-q[1]*k; j?bctx.lineTo(x,y):bctx.moveTo(x,y); });
    bctx.closePath(); bctx.fill(); bctx.globalCompositeOperation='source-over';
    ctx.clearRect(0,0,cv.width,cv.height);
    if(paint.drawing){ const im=BF.img(paint.drawing); if(im) ctx.drawImage(im,0,0,cv.width,cv.height); }
    let col=document.getElementById('drawColor').value, size=+document.getElementById('drawSize').value, erase=false, down=false, last=null;
    const pos=e=>{ const r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width*cv.width,(e.clientY-r.top)/r.height*cv.height]; };
    const stroke=(a,b)=>{ ctx.globalCompositeOperation=erase?'destination-out':'source-over'; ctx.strokeStyle=col; ctx.lineWidth=size; ctx.lineCap='round'; ctx.beginPath(); ctx.moveTo(a[0],a[1]); ctx.lineTo(b[0],b[1]); ctx.stroke(); };
    cv.onpointerdown=e=>{ down=true; cv.setPointerCapture(e.pointerId); last=pos(e); stroke(last,last); };
    cv.onpointermove=e=>{ if(!down) return; const p=pos(e); stroke(last,p); last=p; };
    cv.onpointerup=()=>{ down=false; };
    document.getElementById('drawColor').oninput=e=>{ col=e.target.value; erase=false; document.getElementById('drawErase').classList.remove('on'); };
    document.getElementById('drawSize').oninput=e=>{ size=+e.target.value; };
    document.getElementById('drawErase').onclick=e=>{ erase=!erase; e.currentTarget.classList.toggle('on',erase); };
    document.getElementById('drawClear').onclick=()=>ctx.clearRect(0,0,cv.width,cv.height);
    document.getElementById('drawCancel').onclick=()=>{ m.hidden=true; };
    document.getElementById('drawDone').onclick=()=>{ m.hidden=true; const blank=!ctx.getImageData(0,0,cv.width,cv.height).data.some((v,i)=>i%4===3&&v>0); onSave(blank?null:cv.toDataURL('image/png')); };
  }
};

// shrink uploaded images so saves stay small
BF.loadImageFile=function(file,max){
  return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onerror=rej; fr.onload=()=>{ const im=new Image(); im.onerror=rej; im.onload=()=>{ const k=Math.min(1,(max||512)/Math.max(im.width,im.height)); const c=document.createElement('canvas'); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); c.getContext('2d').drawImage(im,0,0,c.width,c.height); res(c.toDataURL('image/png')); }; im.src=fr.result; }; fr.readAsDataURL(file); });
};
})();
