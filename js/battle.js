/* BeyForge — battle engine (physics sim + arena renderer). Units: mm, s. Z-up. */
(function(){
'use strict';
const BF=window.BF, T=THREE, {clamp,lerp}=BF.util;
const G=9810, TAU=Math.PI*2;

// ---------- fighter: physical summary of a design ----------
BF.fighter = function(d, name){
  d=BF.normalize(BF.clone(d));
  const asm=BF.build(d), mp=BF.massProps(asm), an=BF.analyze(asm,mp), tip=BF.TIPS[d.bit.tip]||BF.TIPS.flat;
  const I=mp.Izz*1e-9, M=mp.mass/1000;
  return { d, asm, mp, an, tip, name:name||BF.naming(d,an.type).full,
    R:asm.parts[0].meta.R, M, I, gear:d.system==='X'&&d.bit.gear,
    fric:M*9.81*BF.tipFriction(tip),
    drag:3e-12*(1+6*an.rough)*Math.pow(asm.parts[0].meta.R/23,5),
    atk:an.stats.attack, def:an.stats.defense, sta:an.stats.stamina, brs:an.stats.burst, stb:an.stats.stability,
    spinSign: d.spin==='left'?1:-1 };
};

// ---------- deterministic-ish RNG so host sims are reproducible ----------
function rng(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return (s>>>0)/4294967296; }; }

BF.STADIUMS = {
  X:     {kind:'X', label:'Xtreme Stadium', diameter:380, depth:0.085, rail:0.86,
          zones:[{a:0.25,w:0.5,type:'over'},{a:2.35,w:0.5,type:'over'},{a:4.45,w:0.9,type:'xtreme'}]},
  Burst: {kind:'Burst', label:'Burst Standard', diameter:360, depth:0.11, rail:0,
          zones:[{a:0.3,w:0.55,type:'over'},{a:2.394,w:0.55,type:'over'},{a:4.489,w:0.55,type:'over'}]}
};
BF.RULES = {
  X:     {target:4, pts:{spin:1, over:2, burst:2, xtreme:3}},
  Burst: {target:3, pts:{spin:1, over:1, burst:2, xtreme:2}}
};

// ---------- simulation ----------
BF.Sim = class {
  constructor(f1, f2, stadium, seed){
    this.f=[f1,f2]; this.st=stadium; this.R=stadium.diameter/2; this.rand=rng(seed||12345);
    this.events=[]; this.t=0; this.done=null;
  }
  launch(l1, l2){ // l = {power 0.4..1, angle -35..35 deg, spin 'right'|'left'}
    const R=this.R;
    this.b=[l1,l2].map((l,i)=>{
      const f=this.f[i], a0=i===0?-Math.PI/2:Math.PI/2;
      const r=R*0.55, x=r*Math.cos(a0), y=r*Math.sin(a0);
      const sign = f.d.spin==='dual' ? (l.spin==='left'?1:-1) : f.spinSign;
      // launched along the rim in the spin direction, angled inward; the angle slider steers it
      const tang=Math.atan2(y,x)+(sign>0?Math.PI/2:-Math.PI/2);
      const inward=tang+(sign>0?1:-1)*(28+(l.angle||0))*Math.PI/180;
      const sp=260+l.power*620;
      return {x,y,vx:sp*Math.cos(inward),vy:sp*Math.sin(inward), w:600*(0.55+0.45*l.power), w0:600*(0.55+0.45*l.power),
        sign, ang:this.rand()*TAU, tilt:0, alive:true, out:false, burst:false, dash:0, dashCd:0, hitCd:0, z:0};
    });
    this.t=0; this.done=null; this.events=[];
  }
  zoneAt(a){ a=((a%TAU)+TAU)%TAU; for(const z of this.st.zones){ let d=a-z.a; d=((d%TAU)+TAU)%TAU; if(d<z.w) return z.type; } return null; }
  step(dt){
    if(this.done) return;
    const B=this.b, F=this.f, R=this.R, st=this.st;
    this.t+=dt;
    for(let i=0;i<2;i++){
      const b=B[i], f=F[i]; if(!b.alive) continue;
      const r=Math.hypot(b.x,b.y)||1e-6, ux=b.x/r, uy=b.y/r;
      // bowl pulls toward center
      const ac=-G*2*st.depth*r/R*(1-0.6*b.tilt);
      let ax=ac*ux, ay=ac*uy;
      // tip drive: grippy/flat tips carve around the stadium in their spin direction
      const spinFrac=b.w/b.w0, mob=f.tip.mob;
      // flower pattern: the tip carves along the rim then periodically dives back through the center
      const tx0=uy*b.sign, ty0=-ux*b.sign;
      b.ph=(b.ph||this.rand()*TAU)+dt*(1.6+1.6*mob);
      const beta=(0.25+0.85*Math.max(0,Math.sin(b.ph)))*Math.min(1,r/(R*0.25));
      const tx=tx0*Math.cos(beta)-ux*Math.sin(beta), ty=ty0*Math.cos(beta)-uy*Math.sin(beta);
      const drive=mob*950*spinFrac*(0.6+0.4*Math.min(1,r/(R*0.4)));
      ax+=tx*drive; ay+=ty*drive;
      ax+=(this.rand()-0.5)*900*mob; ay+=(this.rand()-0.5)*900*mob;
      // Xtreme Dash: gear bits catch the rail and rocket forward
      if(f.gear && st.rail && b.dashCd<=0 && Math.abs(r-R*st.rail)<9 && spinFrac>0.35){ b.dash=0.32; b.dashCd=1.4; this.events.push({k:'dash',i}); }
      if(b.dash>0){ const v=Math.hypot(b.vx,b.vy)||1; const want=1500*spinFrac; b.vx+=(tx0*want-b.vx)*Math.min(1,dt*12); b.vy+=(ty0*want-b.vy)*Math.min(1,dt*12); b.dash-=dt; }
      b.dashCd-=dt; b.hitCd-=dt; b.wallCd=(b.wallCd||0)-dt;
      // floor friction / damping: stamina tips settle, attack tips keep moving
      const damp=0.85+1.0*(1-mob)+1.5*b.tilt;
      b.vx+=ax*dt; b.vy+=ay*dt; b.vx*=1-damp*dt; b.vy*=1-damp*dt;
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      // spin decay from the same physics as the Forge (sped up 1.35x for match pacing)
      const dw=(f.fric+f.drag*b.w*b.w)/f.I*(1+2*b.tilt)*1.35;
      b.w=Math.max(0,b.w-dw*dt); b.ang+=b.sign*b.w*dt;
      // wobble near the end
      const wl=Math.max(60,b.w0*0.16);
      b.tilt = b.w<wl*2.2 ? clamp(1-(b.w-wl)/(wl*1.2),0,1)*(1.15-f.stb/200) : Math.max(0,b.tilt-dt);
      if(b.w<wl){ b.alive=false; this.events.push({k:'stop',i}); }
      // walls, over zones, xtreme pocket
      const r2=Math.hypot(b.x,b.y), lim=R-f.R-4;
      if(r2>lim){
        const nx=b.x/r2, ny=b.y/r2, vr=b.vx*nx+b.vy*ny, zone=this.zoneAt(Math.atan2(b.y,b.x));
        if(zone && vr>(zone==='xtreme'?340:390)){ b.alive=false; b.out=zone; this.events.push({k:zone,i}); }
        else { b.x=nx*lim; b.y=ny*lim; if(vr>0){ b.vx-=(1.55)*vr*nx; b.vy-=(1.55)*vr*ny; b.vx*=0.997; b.vy*=0.997; if(vr>60 && b.wallCd<=0){ b.w-=Math.min(b.w*0.04, vr*0.012); b.wallCd=0.25; } if(vr>250) this.events.push({k:'wall',i,x:b.x,y:b.y,s:vr}); } }
      }
      b.z=st.depth*Math.min(r2,R)**2/R;
    }
    // collision
    const a=B[0], b=B[1];
    if(a.alive && b.alive){
      const dx=b.x-a.x, dy=b.y-a.y, dist=Math.hypot(dx,dy)||1e-6, minD=F[0].R+F[1].R;
      if(dist<minD){
        const nx=dx/dist, ny=dy/dist, m1=F[0].M, m2=F[1].M;
        const pen=minD-dist; a.x-=nx*pen*m2/(m1+m2); a.y-=ny*pen*m2/(m1+m2); b.x+=nx*pen*m1/(m1+m2); b.y+=ny*pen*m1/(m1+m2);
        if(a.hitCd<=0 && b.hitCd<=0){
          const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          const same=a.sign===b.sign, rimA=a.w*F[0].R, rimB=b.w*F[1].R;
          const clash=Math.max(0,-vn)*0.8+0.03*(same?rimA+rimB:Math.abs(rimA-rimB)*0.6)*(0.6+0.4*this.rand());
          const e=0.35+0.4*(F[0].atk+F[1].atk)/200;
          const j=(1+e)*Math.max(0,-vn)/(1/m1+1/m2);
          a.vx-=j/m1*nx; a.vy-=j/m1*ny; b.vx+=j/m2*nx; b.vy+=j/m2*ny;
          // contact points throw the other Bey: scaled by attacker's attack vs target's defense and mass
          const kick=(atk,def,mSelf,mOther)=>clash*1.9*Math.pow(0.1+atk/100,2)*(1.3-def/100)*clamp(Math.sqrt(mOther/mSelf),0.55,1.8);
          const ka=kick(F[1].atk,F[0].def,m1,m2), kb=kick(F[0].atk,F[1].def,m2,m1);
          a.vx-=nx*ka; a.vy-=ny*ka; b.vx+=nx*kb; b.vy+=ny*kb;
          // spin loss; opposite spins steal from the weaker one
          const loss=(atk,def)=>clash*0.0016*(0.4+atk/100)*(1.2-def/120);
          let la=loss(F[1].atk,F[0].def), lb=loss(F[0].atk,F[1].def);
          if(!same){ const steal=Math.abs(rimA-rimB)*0.0016; if(rimA>rimB){ a.w+=steal*0.5; lb+=steal; } else { b.w+=steal*0.5; la+=steal; } }
          a.w=Math.max(0,a.w-la); b.w=Math.max(0,b.w-lb);
          a.hitCd=b.hitCd=0.12;
          const cx=a.x+nx*F[0].R, cy=a.y+ny*F[0].R;
          this.events.push({k:'hit',x:cx,y:cy,s:clash});
          // burst check: big hits on a Bey that's lost some spin can blow it apart
          [[a,0,F[1].atk],[b,1,F[0].atk]].forEach(([bb,ix,atk])=>{
            const f=F[ix], weak=1-bb.w/bb.w0;
            const p=clamp(Math.pow(clash/1300,2)*(1-f.brs/105)*(0.2+weak)*(0.4+atk/100)*0.25,0,0.4);
            if(bb.alive && weak>0.12 && this.rand()<p){ bb.alive=false; bb.burst=true; this.events.push({k:'burst',i:ix}); }
          });
        }
      }
    }
    // decide
    const outA=!a.alive, outB=!b.alive;
    if(outA||outB){
      let winner, how;
      if(outA&&outB){ winner=a.w>=b.w?0:1; how='spin'; if(a.burst||b.burst){ winner=a.burst?1:0; how='burst'; } }
      else { const loser=outA?a:b; winner=outA?1:0; how=loser.burst?'burst':loser.out?loser.out:'spin'; }
      this.done={winner,how,t:this.t};
    } else if(this.t>90){ this.done={winner:a.w>=b.w?0:1, how:'spin', t:this.t}; }
  }
  snapshot(){ return {t:this.t, b:this.b.map(b=>[b.x,b.y,b.z,b.ang,b.w,b.w0,b.tilt,b.alive?1:0,b.burst?1:0,b.dash>0?1:0]), done:this.done}; }
};

// ---------- arena renderer ----------
function beyGroup(asm){
  const g=new T.Group(); const d=asm.d;
  asm.parts.forEach(part=>{
    const pg=new T.Group(); pg.position.z=part.z0; pg.userData.id=part.id;
    part.bodies.forEach(b=>{ const pm=BF.partMaterial(d,part,b.role); const m=new T.Mesh(b.geo,BF.makeMaterial(pm.mat,pm.color));
      if(b.role==='accent'){ m.material.emissive=new T.Color(pm.color); m.material.emissiveIntensity=0.35; } m.castShadow=true; pg.add(m); });
    g.add(pg);
  });
  return g;
}
BF.beyGroup=beyGroup;

BF.Arena = class {
  constructor(el){
    this.el=el;
    const r=this.renderer=new T.WebGLRenderer({antialias:true});
    r.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=1.1; r.shadowMap.enabled=true;
    el.appendChild(r.domElement);
    const s=this.scene=new T.Scene(); s.background=new T.Color(0x07060e);
    this.camera=new T.PerspectiveCamera(38,1,5,5000); this.camera.up.set(0,0,1);
    const pm=new T.PMREMGenerator(r), es=new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(200,200,200),new T.MeshBasicMaterial({color:0x0a0818,side:T.BackSide})));
    [[0,0,90,0xffffff,4],[-90,20,20,0x2ef2ff,3],[90,-20,30,0xff2e88,3]].forEach(([x,y,z,c,k])=>{ const p=new T.Mesh(new T.PlaneGeometry(120,60),new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(k),side:T.DoubleSide})); p.position.set(x,y,z); p.lookAt(0,0,0); es.add(p); });
    s.environment=pm.fromScene(es,0.03).texture;
    s.add(new T.HemisphereLight(0xb8c6ff,0x150a20,0.4));
    const key=new T.DirectionalLight(0xffffff,1.4); key.position.set(120,-160,420); key.castShadow=true; key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera,{left:-220,right:220,top:220,bottom:-220,near:50,far:900}); s.add(key);
    const c1=new T.PointLight(0x2ef2ff,1.4,900); c1.position.set(-260,120,120); s.add(c1);
    const c2=new T.PointLight(0xff2e88,1.4,900); c2.position.set(260,-120,120); s.add(c2);
    this.sparks=[]; this.beys=[null,null]; this.shake=0;
    new ResizeObserver(()=>this.resize()).observe(el); this.resize();
  }
  resize(){ const w=this.el.clientWidth||1,h=this.el.clientHeight||1; this.renderer.setSize(w,h,false); this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); this.frame(); }
  frame(){ // fit the whole stadium on any screen shape
    const R=(this.R||190)+18, cam=this.camera, v=cam.fov*Math.PI/360, h=Math.atan(Math.tan(v)*cam.aspect);
    const portrait=cam.aspect<1, tilt=portrait?0.32:0.55;   // radians from straight down
    const need=Math.max(R/Math.tan(h), R*Math.cos(tilt)/Math.tan(v))*1.12;
    cam.position.set(0,-need*Math.sin(tilt),need*Math.cos(tilt)); cam.lookAt(0,portrait?-R*0.18:0,0); }
  setup(stadium, f1, f2){
    if(this.stadiumMesh){ this.scene.remove(this.stadiumMesh); }
    this.beys.forEach(b=>{ if(b) this.scene.remove(b.root); });
    this.R=stadium.diameter/2; this.stadium=stadium;
    this.stadiumMesh=BF.buildStadium(stadium.kind, stadium.diameter); this.scene.add(this.stadiumMesh);
    this.beys=[f1,f2].map(f=>{ const root=new T.Group(), tilt=new T.Group(), spin=beyGroup(f.asm); tilt.add(spin); root.add(tilt); this.scene.add(root);
      const ring=new T.Mesh(new T.RingGeometry(f.R+2,f.R+4.5,48),new T.MeshBasicMaterial({color:f===f1?0x2ef2ff:0xff2e88,transparent:true,opacity:0.7})); ring.position.z=0.6; root.add(ring);
      return {root,tilt,spin,ring,f}; });
    this.frame();
  }
  spark(x,y,z,power,color){
    const n=Math.min(26,6+Math.floor(power/350));
    for(let i=0;i<n;i++){ const m=new T.Mesh(new T.SphereGeometry(0.9,6,4),new T.MeshBasicMaterial({color:color||0xffe08a}));
      const a=Math.random()*TAU, s=60+Math.random()*220*Math.min(2,power/2500); m.position.set(x,y,z+8);
      m.userData={vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:40+Math.random()*120,life:0.35+Math.random()*0.35}; this.scene.add(m); this.sparks.push(m); }
    this.shake=Math.min(6,this.shake+power/1800);
  }
  render(snap,dt){
    if(snap){ snap.b.forEach((s,i)=>{ const v=this.beys[i]; if(!v) return; const [x,y,z,ang,w,w0,tilt,alive,burst,dash]=s;
      v.root.visible=!burst; v.root.position.set(x,y,z);
      const wob=tilt*0.5, ph=ang*0.18; v.tilt.rotation.set(Math.sin(ph)*wob,Math.cos(ph)*wob,0);
      v.spin.rotation.z=ang; v.ring.material.opacity=alive?(dash?1:0.55):0.15; v.ring.scale.setScalar(dash?1.25:1);
    }); }
    for(let i=this.sparks.length-1;i>=0;i--){ const m=this.sparks[i], u=m.userData; u.life-=dt; u.vz-=600*dt; m.position.x+=u.vx*dt; m.position.y+=u.vy*dt; m.position.z+=u.vz*dt; m.scale.setScalar(Math.max(0.1,u.life*2.5));
      if(u.life<=0){ this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); this.sparks.splice(i,1); } }
    const cam=this.camera, base=cam.position.clone();
    if(this.shake>0.05){ cam.position.x+=(Math.random()-0.5)*this.shake; cam.position.y+=(Math.random()-0.5)*this.shake; this.shake*=Math.pow(0.02,dt); }
    this.renderer.render(this.scene,cam); cam.position.copy(base);
  }
  burstFx(i){ const v=this.beys[i]; if(!v) return; const p=v.root.position;
    v.f.asm.parts.forEach((part,k)=>{ const g=beyGroup({...v.f.asm,parts:[part]}); g.position.copy(p); g.position.z+=part.z0+6; this.scene.add(g);
      const a=Math.random()*TAU, s=90+Math.random()*120; g.userData={vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:160+k*40,spin:(Math.random()-0.5)*20};
      this.debris=(this.debris||[]); this.debris.push(g); });
    this.spark(p.x,p.y,p.z,6000,0xff2e88);
  }
  tickDebris(dt){ (this.debris||[]).forEach(g=>{ const u=g.userData; u.vz-=700*dt; g.position.x+=u.vx*dt; g.position.y+=u.vy*dt; g.position.z=Math.max(this.stadium.depth*Math.min(Math.hypot(g.position.x,g.position.y),this.R)**2/this.R, g.position.z+u.vz*dt); if(g.position.z<=0.1+this.stadium.depth*Math.hypot(g.position.x,g.position.y)**2/this.R){ u.vx*=0.9; u.vy*=0.9; u.vz=Math.abs(u.vz)*0.3; } g.rotation.z+=u.spin*dt; g.rotation.x+=u.spin*0.3*dt; }); }
  clearDebris(){ (this.debris||[]).forEach(g=>this.scene.remove(g)); this.debris=[]; }
};
})();
