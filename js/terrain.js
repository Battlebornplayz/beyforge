/* BeyForge v5.2 — terrain stadiums: Lava, Ice rink, Storm, Void Temple (physics hooks live in BF.Sim) */
(function(){
'use strict';
const BF=window.BF, T=THREE, TAU=Math.PI*2;
BF.TERRAINS = {
  none: {label:'Classic',      els:[],                         desc:'No terrain — pure Beyblade.'},
  lava: {label:'Lava Pit',     els:['fire'],                    desc:'Lava pools burn anything that isn’t Fire. Fire types hit harder.', color:0xff5a14, floor:'#3a0e06', neon:0xff6a1a},
  ice:  {label:'Ice Rink',     els:['ice','water'],             desc:'Slippery floor — Beys slide and keep their speed. Ice & Water types skate faster.', color:0x9fe8ff, floor:'#0e2a3a', neon:0x9fe8ff},
  storm:{label:'Storm Dome',   els:['lightning','wind'],        desc:'Random gusts shove Beys around, shock pads jolt them. Lightning & Wind types ride it.', color:0xffd21f, floor:'#151a2e', neon:0xffd21f},
  void: {label:'Void Temple',  els:['dark','light','void'],     desc:'A gravity well pulls to the center and a light beam dazes. Dark, Light & Void types thrive.', color:0xa07bff, floor:'#120726', neon:0xa07bff}
};
// fixed hazard spots shared by the physics and the visuals
BF.terrainSpots = (terrain,R)=>{
  if(terrain==='lava') return [0.6,2.7,4.8].map(a=>({x:Math.cos(a)*R*0.52,y:Math.sin(a)*R*0.52,r:R*0.13}));
  if(terrain==='storm') return [1.2,4.3].map(a=>({x:Math.cos(a)*R*0.45,y:Math.sin(a)*R*0.45,r:R*0.09}));
  return [];
};
BF.terrainFor = el=>Object.keys(BF.TERRAINS).find(k=>BF.TERRAINS[k].els.includes(el))||'none';

let _ember=null;
function emberTex(){ if(_ember) return _ember; const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); const g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.35,'rgba(255,255,255,0.6)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,64,64); return _ember=new T.CanvasTexture(c); }
function lavaTex(){ const c=document.createElement('canvas'); c.width=c.height=256; const x=c.getContext('2d');
  const g=x.createRadialGradient(128,128,10,128,128,128); g.addColorStop(0,'#ffe08a'); g.addColorStop(0.35,'#ff7a1a'); g.addColorStop(0.75,'#c2280a'); g.addColorStop(1,'rgba(60,8,2,0)');
  x.fillStyle=g; x.fillRect(0,0,256,256);
  for(let i=0;i<40;i++){ x.fillStyle=`rgba(255,${180+Math.random()*60|0},80,${0.15+Math.random()*0.3})`; x.beginPath(); x.arc(40+Math.random()*176,40+Math.random()*176,4+Math.random()*16,0,TAU); x.fill(); }
  const t=new T.CanvasTexture(c); t.encoding=T.sRGBEncoding; return t; }
function beamTex(){ const c=document.createElement('canvas'); c.width=16; c.height=256; const x=c.getContext('2d'); const g=x.createLinearGradient(0,0,16,0);
  g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.5,'rgba(255,255,255,1)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,16,256); return new T.CanvasTexture(c); }
const add=mat=>{ mat.blending=T.AdditiveBlending; mat.depthWrite=false; mat.transparent=true; return mat; };

const build0=BF.buildStadium;
BF.buildStadium=function(kind,diameter,terrain){
  const g=build0(kind,diameter); const Tr=BF.TERRAINS[terrain]; if(!Tr||terrain==='none') return g;
  const R=diameter/2, zAt=g.userData.zAt, anims=[];
  // tint the whole floor
  const tint=new T.Mesh(new T.CircleGeometry(R*0.995,128),new T.MeshBasicMaterial({color:new T.Color(Tr.floor),transparent:true,opacity:terrain==='ice'?0.35:0.5,depthWrite:false}));
  tint.position.z=0.15; g.add(tint);
  const glow=new T.Mesh(new T.RingGeometry(R*0.98,R*1.02,128),add(new T.MeshBasicMaterial({color:Tr.neon,opacity:0.6}))); glow.position.z=zAt(R)+0.5; g.add(glow);
  anims.push(t=>{ glow.material.opacity=0.45+0.2*Math.sin(t*2); });
  const spots=BF.terrainSpots(terrain,R);
  if(terrain==='lava'){
    const tex=lavaTex();
    spots.forEach((s,i)=>{ const pool=new T.Mesh(new T.CircleGeometry(s.r,48),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false}));
      pool.position.set(s.x,s.y,zAt(Math.hypot(s.x,s.y))+0.35); g.add(pool);
      const halo=new T.Mesh(new T.CircleGeometry(s.r*1.5,48),add(new T.MeshBasicMaterial({map:emberTex(),color:0xff5a14,opacity:0.5}))); halo.position.copy(pool.position); halo.position.z+=0.05; g.add(halo);
      anims.push(t=>{ pool.rotation.z=t*0.15*(i%2?1:-1); halo.material.opacity=0.35+0.2*Math.sin(t*3+i); }); });
  }
  if(terrain==='ice'){
    const frost=new T.Mesh(new T.RingGeometry(R*0.15,R*0.9,96),add(new T.MeshBasicMaterial({color:0xdff8ff,opacity:0.12}))); frost.position.z=0.3; g.add(frost);
    for(let i=0;i<14;i++){ const a=Math.random()*TAU, r=R*(0.2+Math.random()*0.65), L=R*(0.05+Math.random()*0.12);
      const crack=new T.Mesh(new T.PlaneGeometry(L,0.6),add(new T.MeshBasicMaterial({color:0xffffff,opacity:0.35}))); crack.position.set(Math.cos(a)*r,Math.sin(a)*r,zAt(r)+0.4); crack.rotation.z=Math.random()*TAU; g.add(crack); }
    anims.push(t=>{ frost.material.opacity=0.1+0.05*Math.sin(t*1.3); });
  }
  if(terrain==='storm'){
    spots.forEach((s,i)=>{ const pad=new T.Mesh(new T.CircleGeometry(s.r,6),add(new T.MeshBasicMaterial({color:0xffd21f,opacity:0.5}))); pad.position.set(s.x,s.y,zAt(Math.hypot(s.x,s.y))+0.4); g.add(pad);
      const ring=new T.Mesh(new T.RingGeometry(s.r*0.9,s.r,6),add(new T.MeshBasicMaterial({color:0xffffff,opacity:0.8}))); ring.position.copy(pad.position); ring.position.z+=0.05; g.add(ring);
      anims.push(t=>{ pad.material.opacity=0.3+0.3*Math.abs(Math.sin(t*5+i*2)); ring.rotation.z=t*1.5; }); });
  }
  if(terrain==='void'){
    const sw=new T.Mesh(new T.CircleGeometry(R*0.3,64),add(new T.MeshBasicMaterial({map:emberTex(),color:0x8a3dff,opacity:0.7}))); sw.position.z=0.5; g.add(sw);
    const spiral=new T.Group(); for(let k=0;k<3;k++){ const arm=new T.Mesh(new T.RingGeometry(R*0.08,R*0.28,48,1,k*TAU/3,1.2),add(new T.MeshBasicMaterial({color:0xff2e88,opacity:0.35}))); spiral.add(arm); } spiral.position.z=0.6; g.add(spiral);
    const beam=new T.Mesh(new T.PlaneGeometry(14,R*2),add(new T.MeshBasicMaterial({map:beamTex(),color:0xfff4b8,opacity:0.55,side:T.DoubleSide}))); beam.position.z=1.2; g.add(beam);
    anims.push(t=>{ spiral.rotation.z=-t*1.4; sw.material.opacity=0.5+0.2*Math.sin(t*2.4); beam.rotation.z=t*0.6+Math.PI/2; });   // beam angle matches BF.Sim (t*0.6)
  }
  g.userData.anims=anims; g.userData.terrain=terrain;
  return g;
};
})();
