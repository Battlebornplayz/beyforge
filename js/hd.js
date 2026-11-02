/* BeyForge — HD rendering: bloom glow, MSAA, detailed stadiums, arena surroundings */
(function(){
'use strict';
const BF=window.BF, T=THREE, TAU=Math.PI*2;
const S=()=>BF.Settings;
const hdOn=()=>!S()||(S().get('quality')!=='low' && S().get('bloom')!==false);

// ---------- post-processing: bloom on the neon, MSAA edges, correct color ----------
BF.HD = {
  composer(renderer,scene,camera){
    if(!T.EffectComposer||!T.UnrealBloomPass) return null;
    const gl2=renderer.capabilities.isWebGL2, size=renderer.getDrawingBufferSize(new T.Vector2());
    const rt = gl2 && T.WebGLMultisampleRenderTarget ? new T.WebGLMultisampleRenderTarget(size.x,size.y,{format:T.RGBAFormat,encoding:T.LinearEncoding}) : undefined;
    if(rt) rt.samples=4;
    const c=new T.EffectComposer(renderer,rt);
    c.addPass(new T.RenderPass(scene,camera));
    const bloom=new T.UnrealBloomPass(new T.Vector2(size.x,size.y),0.55,0.5,0.82); c.addPass(bloom);
    c.addPass(new T.ShaderPass(T.GammaCorrectionShader));
    c.bloom=bloom;
    return c;
  },
  // renders with bloom when enabled, plain otherwise; keeps the composer sized to the canvas
  render(owner,renderer,scene,camera){
    // the bloom path renders in linear light, so background/fog colors need converting to match
    const ud=scene.userData; if(!ud.bgS && scene.background&&scene.background.isColor){ ud.bgS=scene.background.clone(); ud.bgL=scene.background.clone().convertSRGBToLinear(); if(scene.fog){ ud.fogS=scene.fog.color.clone(); ud.fogL=scene.fog.color.clone().convertSRGBToLinear(); } }
    // auto-quality: if frames get slow, drop the glow and resolution so phones stay smooth
    const now=performance.now(); if(owner._lastT){ const ft=now-owner._lastT; owner._ft=(owner._ft||16)*0.95+ft*0.05; owner._n=(owner._n||0)+1;
      if(owner._n>90 && owner._ft>48 && !owner._lowPerf && !(S()&&S().get('quality')==='high'&&S().get('lockQuality'))){ owner._lowPerf=true; renderer.setPixelRatio(1); BF.App&&BF.App.toast&&BF.App.toast('Lowered graphics for smoother play — change it in Settings'); } }
    owner._lastT=now;
    const hd=hdOn()&&!owner._lowPerf; if(ud.bgS){ scene.background.copy(hd?ud.bgL:ud.bgS); if(scene.fog) scene.fog.color.copy(hd?ud.fogL:ud.fogS); }
    if(!hd){ renderer.render(scene,camera); return; }
    if(!owner._comp){ owner._comp=this.composer(renderer,scene,camera); if(!owner._comp){ renderer.render(scene,camera); return; } }
    const size=renderer.getSize(new T.Vector2()), pr=renderer.getPixelRatio();
    if(owner._compW!==size.x*pr||owner._compH!==size.y*pr){ owner._comp.setPixelRatio(pr); owner._comp.setSize(size.x,size.y); owner._compW=size.x*pr; owner._compH=size.y*pr; }
    owner._comp.render();
  }
};

// ---------- canvas textures ----------
function floorTexture(kind,size){
  const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'), h=size/2;
  const g=x.createRadialGradient(h,h,0,h,h,h); g.addColorStop(0,kind==='X'?'#1d1846':'#24153d'); g.addColorStop(0.6,kind==='X'?'#120f2c':'#170e29'); g.addColorStop(1,'#0a0818');
  x.fillStyle=g; x.fillRect(0,0,size,size);
  // fine hex texture like molded plastic
  x.strokeStyle='rgba(160,140,255,0.06)'; x.lineWidth=1; const s=size/90, hh=s*Math.sqrt(3);
  for(let yy=0;yy<size+hh;yy+=hh/2) for(let xx=((Math.round(yy/(hh/2)))%2)*s*1.5;xx<size+s*3;xx+=s*3){ x.beginPath(); for(let q=0;q<6;q++){ const a=q/6*TAU; q?x.lineTo(xx+s*Math.cos(a),yy+s*Math.sin(a)):x.moveTo(xx+s*Math.cos(a),yy+s*Math.sin(a)); } x.closePath(); x.stroke(); }
  // rings
  [0.12,0.3,0.55,0.8].forEach((r,i)=>{ x.beginPath(); x.arc(h,h,r*h,0,TAU); x.strokeStyle=i===0?'rgba(46,242,255,0.55)':'rgba(140,120,255,0.16)'; x.lineWidth=i===0?size/300:size/700; x.stroke(); });
  // radial ticks
  for(let i=0;i<72;i++){ const a=i/72*TAU, r0=h*0.82, r1=h*(i%6===0?0.9:0.86); x.beginPath(); x.moveTo(h+r0*Math.cos(a),h+r0*Math.sin(a)); x.lineTo(h+r1*Math.cos(a),h+r1*Math.sin(a)); x.strokeStyle='rgba(160,140,255,0.22)'; x.lineWidth=size/900; x.stroke(); }
  // center logo
  x.save(); x.translate(h,h); x.font=`700 ${size*0.045}px "Chakra Petch", Bahnschrift, sans-serif`; x.textAlign='center'; x.textBaseline='middle';
  x.fillStyle='rgba(236,233,250,0.16)'; x.fillText('BEYFORGE',0,-size*0.17); x.font=`600 ${size*0.022}px "JetBrains Mono", monospace`; x.fillStyle='rgba(46,242,255,0.28)';
  x.fillText(kind==='X'?'XTREME STADIUM':'BURST STADIUM',0,size*0.17); x.restore();
  const t=new T.CanvasTexture(c); t.encoding=T.sRGBEncoding; t.anisotropy=8; return t;
}
function planarUV(geo,R){ const p=geo.attributes.position.array, uv=new Float32Array(p.length/3*2); for(let i=0,j=0;i<p.length;i+=3,j+=2){ uv[j]=p[i]/(2*R)+0.5; uv[j+1]=p[i+1]/(2*R)+0.5; } geo.setAttribute('uv',new T.BufferAttribute(uv,2)); }
function neon(color,intensity){ const m=new T.MeshStandardMaterial({color:0x000000,emissive:new T.Color(color),emissiveIntensity:intensity||2.2,roughness:0.4}); m.userData.neon=true; return m; }

// ---------- HD stadium (replaces the v3 builder; same interface) ----------
BF.buildStadium = function(kind, diameter){
  const g=new T.Group(); const R=diameter/2, depth=kind==='X'?0.085:0.11, zAt=r=>depth*r*r/R, wallZ=zAt(R), hi=hdOn();
  const steps=hi?90:40, seg=hi?256:128;
  // bowl
  const prof=[]; for(let i=0;i<=steps;i++){ const r=i/steps*R; prof.push(new T.Vector2(r,zAt(r))); }
  const bowlG=new T.LatheGeometry(prof,seg); bowlG.rotateX(Math.PI/2); bowlG.computeVertexNormals(); planarUV(bowlG,R);
  const bowlM=new T.MeshPhysicalMaterial({map:floorTexture(kind,hi?2048:1024),roughness:0.32,metalness:0.05,clearcoat:hi?0.8:0,clearcoatRoughness:0.2,envMapIntensity:0.35,side:T.DoubleSide});
  const bowl=new T.Mesh(bowlG,bowlM); bowl.receiveShadow=true; g.add(bowl);
  // wall: smoky translucent outer ring
  const wallG=new T.CylinderGeometry(R+1,R+1,30,seg,1,true); wallG.rotateX(Math.PI/2); wallG.translate(0,0,wallZ+14);
  const wall=new T.Mesh(wallG,new T.MeshPhysicalMaterial({color:0x2a2460,roughness:0.15,metalness:0,transparent:true,opacity:0.35,clearcoat:1,side:T.DoubleSide,depthWrite:false})); g.add(wall);
  const shellG=new T.CylinderGeometry(R+9,R+12,wallZ+36,seg,1,true); shellG.rotateX(Math.PI/2); shellG.translate(0,0,(wallZ+36)/2-6);
  g.add(new T.Mesh(shellG,new T.MeshStandardMaterial({color:0x0f0c22,roughness:0.55,metalness:0.3,side:T.DoubleSide})));
  // top lip with neon strip
  const lip=new T.Mesh(new T.TorusGeometry(R+5,4,16,seg),new T.MeshStandardMaterial({color:0x1a1638,roughness:0.35,metalness:0.6})); lip.position.z=wallZ+30; g.add(lip);
  const strip=new T.Mesh(new T.TorusGeometry(R+5,1.1,8,seg),neon(kind==='X'?0x2ef2ff:0xff2e88,2.4)); strip.position.z=wallZ+33; g.add(strip);
  const strip2=new T.Mesh(new T.TorusGeometry(R+1.5,0.5,6,seg),neon(kind==='X'?0x2ef2ff:0xff2e88,1.2)); strip2.position.z=wallZ+1; g.add(strip2);
  // center target ring
  const cr=new T.Mesh(new T.RingGeometry(R*0.115,R*0.125,96),neon(0x2ef2ff,1.6)); cr.position.z=0.3; g.add(cr);
  if(kind==='X'){
    // Xtreme rail: real 3D teeth the gear bits catch
    const rr=R*0.86, n=hi?220:120, z0=zAt(rr);
    const base=new T.Mesh(new T.TorusGeometry(rr,2.2,8,seg),new T.MeshStandardMaterial({color:0x3a3470,roughness:0.3,metalness:0.8})); base.scale.z=0.45; base.position.z=z0+0.6; g.add(base);
    const tooth=new T.BoxGeometry(1.6,2.6,2.2); const tm=new T.MeshStandardMaterial({color:0xb9c3e0,roughness:0.25,metalness:0.95});
    const inst=new T.InstancedMesh(tooth,tm,n); const m=new T.Matrix4(), q=new T.Quaternion(), sc=new T.Vector3(1,1,1);
    for(let i=0;i<n;i++){ const a=i/n*TAU; q.setFromAxisAngle(new T.Vector3(0,0,1),a); m.compose(new T.Vector3((rr+1.6)*Math.cos(a),(rr+1.6)*Math.sin(a),z0+1.6),q,sc); inst.setMatrixAt(i,m); }
    inst.castShadow=true; g.add(inst);
    const railGlow=new T.Mesh(new T.RingGeometry(rr-3.2,rr-2.6,seg),neon(0x2ef2ff,1.4)); railGlow.position.z=z0+0.35; g.add(railGlow);
  } else {
    const tor=new T.Mesh(new T.TorusGeometry(R*0.55,0.8,8,seg),neon(0x6a5cff,1.2)); tor.position.z=zAt(R*0.55)+0.3; g.add(tor);
  }
  // over zones / pockets: dark recesses with glowing edges and labels
  const zones=(BF.STADIUMS&&BF.STADIUMS[kind]?BF.STADIUMS[kind].zones:[]);
  zones.forEach(zn=>{
    const col=zn.type==='xtreme'?0xffb020:0xff2e88, z=zAt(R*0.95)+0.4;
    const pit=new T.Mesh(new T.RingGeometry(R*0.9,R-0.6,32,1,zn.a,zn.w),new T.MeshBasicMaterial({color:0x020104,side:T.DoubleSide})); pit.position.z=z; g.add(pit);
    const edge=new T.Mesh(new T.RingGeometry(R*0.895,R*0.905,48,1,zn.a,zn.w),neon(col,2.4)); edge.position.z=z+0.05; g.add(edge);
    [zn.a,zn.a+zn.w].forEach(a=>{ const bar=new T.Mesh(new T.PlaneGeometry(R*0.1,0.9),neon(col,2.4)); bar.position.set(R*0.95*Math.cos(a),R*0.95*Math.sin(a),z+0.06); bar.rotation.z=a; g.add(bar); });
    // label
    const c=document.createElement('canvas'); c.width=256; c.height=64; const x=c.getContext('2d'); x.font='700 40px "Chakra Petch", Bahnschrift, sans-serif'; x.textAlign='center'; x.textBaseline='middle';
    x.fillStyle=zn.type==='xtreme'?'#ffb020':'#ff2e88'; x.fillText(zn.type==='xtreme'?'XTREME':'OVER',128,34);
    const lt=new T.CanvasTexture(c); lt.encoding=T.sRGBEncoding;
    const lbl=new T.Mesh(new T.PlaneGeometry(R*0.16,R*0.04),new T.MeshBasicMaterial({map:lt,transparent:true,depthWrite:false}));
    const am=zn.a+zn.w/2; lbl.position.set(R*0.82*Math.cos(am),R*0.82*Math.sin(am),zAt(R*0.82)+0.5); lbl.rotation.z=am-Math.PI/2; g.add(lbl);
  });
  // arena surroundings: table, glow underlay, overhead spots
  const table=new T.Mesh(new T.CircleGeometry(R*4,96),new T.MeshStandardMaterial({color:0x07060e,roughness:0.85,metalness:0.1})); table.position.z=-6.1; table.receiveShadow=true; g.add(table);
  const under=new T.Mesh(new T.PlaneGeometry((R+70)*2,(R+70)*2),new T.MeshBasicMaterial({map:glowRing(R/(R+70)),color:kind==='X'?0x2ef2ff:0xff2e88,transparent:true,opacity:0.14,depthWrite:false,blending:T.AdditiveBlending})); under.position.z=-6; g.add(under);
  if(hi){ const sp=new T.SpotLight(0xffffff,0.5,R*6,0.42,0.7,1); sp.position.set(0,-R*0.4,R*3.2); sp.target.position.set(0,0,0); g.add(sp); g.add(sp.target); }
  g.userData={R, depth, zAt};
  return g;
};
function glowRing(inner){ const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d'); const gr=x.createRadialGradient(128,128,0,128,128,128);
  gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(Math.max(0,inner-0.02),'rgba(255,255,255,0)'); gr.addColorStop(inner+0.03,'rgba(255,255,255,0.8)'); gr.addColorStop(Math.min(1,inner+0.25),'rgba(255,255,255,0)');
  x.fillStyle=gr; x.fillRect(0,0,256,256); return new T.CanvasTexture(c); }

// ---------- HD Forge floor ----------
BF.forgeFloorTexture=function(){ const t=floorTexture('X',2048); return t; };
})();
