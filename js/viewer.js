/* BeyForge — 3D viewer */
(function(){
'use strict';
const BF=window.BF, T=THREE;

// Stadium builder (shared with Battle later). Units mm, Z-up, floor at z=0 in the center.
BF.buildStadium = function(kind, diameter){
  const g=new T.Group(); const R=diameter/2;
  const depth = kind==='X' ? 0.085 : 0.11;
  const prof=[]; const steps=40;
  for(let i=0;i<=steps;i++){ const r=i/steps*R; prof.push(new T.Vector2(r, depth*r*r/R)); }
  const wallZ=depth*R; prof.push(new T.Vector2(R, wallZ+28)); prof.push(new T.Vector2(R+8, wallZ+28)); prof.push(new T.Vector2(R+8,-6)); prof.push(new T.Vector2(0.01,-6));
  const bowl=new T.LatheGeometry(prof,128); bowl.rotateX(Math.PI/2); bowl.computeVertexNormals();
  const mat=new T.MeshLambertMaterial({color:0x0b0a19, side:T.DoubleSide});
  const m=new T.Mesh(bowl,mat); m.receiveShadow=true; g.add(m);
  const ringM=new T.MeshBasicMaterial({color:kind==='X'?0x2ef2ff:0xff2e88});
  const lip=new T.Mesh(new T.TorusGeometry(R+1,1.2,8,160), ringM); lip.position.z=wallZ+28; g.add(lip);
  const zAt=r=>depth*r*r/R;
  if(kind==='X'){
    // Xtreme rail: toothed ring the gear bits grab
    const rr=R*0.86, n=120, pts=[];
    for(let i=0;i<=n*4;i++){ const a=i/(n*4)*Math.PI*2; const tooth=(i%4<2)?1.6:0; pts.push(new T.Vector3((rr+tooth)*Math.cos(a),(rr+tooth)*Math.sin(a),zAt(rr)+0.6)); }
    const rail=new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({color:0x2ef2ff}));
    g.add(rail);
    const band=new T.Mesh(new T.RingGeometry(rr-3,rr+3,160,1), new T.MeshLambertMaterial({color:0x1d1a3d,side:T.DoubleSide}));
    band.position.z=zAt(rr)+0.3; g.add(band);
    // over zones + xtreme pocket
    [[0.25,0.5,0xff2e88],[2.35,0.5,0xff2e88],[4.45,0.9,0xffb020]].forEach(([a,w,c])=>{
      const z=new T.Mesh(new T.RingGeometry(R*0.9,R-0.5,24,1,a,w), new T.MeshBasicMaterial({color:c,transparent:true,opacity:0.55,side:T.DoubleSide}));
      z.position.z=zAt(R*0.95)+0.8; g.add(z);
    });
  } else {
    [0,2.094,4.189].forEach(a=>{
      const z=new T.Mesh(new T.RingGeometry(R*0.88,R-0.5,24,1,a+0.3,0.55), new T.MeshBasicMaterial({color:0xff2e88,transparent:true,opacity:0.5,side:T.DoubleSide}));
      z.position.z=zAt(R*0.94)+0.8; g.add(z);
    });
    const tor=new T.Mesh(new T.TorusGeometry(R*0.55,0.5,6,160), new T.MeshBasicMaterial({color:0x6a5cff,transparent:true,opacity:0.5}));
    tor.position.z=zAt(R*0.55)+0.3; g.add(tor);
  }
  g.userData={R, depth, zAt};
  return g;
};

BF.makeMaterial = function(matKey, color, opts){
  const M=BF.MATERIALS[matKey]||BF.MATERIALS.PLA; opts=opts||{};
  const mat=new T.MeshStandardMaterial({color:new T.Color(color), roughness:M.rough, metalness:M.metal, envMapIntensity:0.9, side:opts.double?T.DoubleSide:T.FrontSide, clippingPlanes:opts.clip||null});
  return mat;
};

BF.Viewer = class {
  constructor(el){
    this.el=el;
    const r=this.renderer=new T.WebGLRenderer({antialias:true, preserveDrawingBuffer:true});
    r.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
    r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=1.1;
    r.localClippingEnabled=true; r.shadowMap.enabled=true; r.shadowMap.type=T.PCFSoftShadowMap;
    el.appendChild(r.domElement);
    const s=this.scene=new T.Scene(); s.background=new T.Color(0x07060e); s.fog=new T.Fog(0x07060e,500,1600);
    const cam=this.camera=new T.PerspectiveCamera(30,1,1,6000); cam.up.set(0,0,1); cam.position.set(105,-130,95);
    const c=this.controls=new T.OrbitControls(cam,r.domElement); c.enableDamping=true; c.dampingFactor=0.08; c.target.set(0,0,12); c.minDistance=40; c.maxDistance=1600;
    // environment for reflections
    const pm=new T.PMREMGenerator(r); const es=new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(200,200,200), new T.MeshBasicMaterial({color:0x0a0818,side:T.BackSide})));
    [[0,0,90,0xffffff,4,120],[ -90,20,20,0x2ef2ff,3,80],[90,-20,30,0xff2e88,3,80],[0,95,10,0x8a6bff,2,90]].forEach(([x,y,z,col,int,sz])=>{ const p=new T.Mesh(new T.PlaneGeometry(sz,sz*0.5), new T.MeshBasicMaterial({color:new T.Color(col).multiplyScalar(int),side:T.DoubleSide})); p.position.set(x,y,z); p.lookAt(0,0,0); es.add(p); });
    s.environment=pm.fromScene(es,0.03).texture;
    // lights
    s.add(new T.HemisphereLight(0xb8c6ff,0x150a20,0.35));
    const key=this.key=new T.DirectionalLight(0xffffff,1.5); key.position.set(60,-80,160); key.castShadow=true;
    key.shadow.mapSize.set(4096,4096); Object.assign(key.shadow.camera,{left:-60,right:60,top:60,bottom:-60,near:10,far:400}); key.shadow.bias=-0.0004;
    s.add(key);
    const c1=new T.PointLight(0x2ef2ff,1.2,500); c1.position.set(-120,60,40); s.add(c1);
    const c2=new T.PointLight(0xff2e88,1.2,500); c2.position.set(120,80,30); s.add(c2);
    // floor
    const floor=this.floor=new T.Group();
    const disk=new T.Mesh(new T.CircleGeometry(220,128), new T.MeshStandardMaterial({color:0x8a86b0,map:BF.forgeFloorTexture(),roughness:0.6,metalness:0.1,envMapIntensity:0.2}));
    { const p=disk.geometry.attributes.position.array, uv=disk.geometry.attributes.uv.array; for(let i=0,j=0;i<p.length;i+=3,j+=2){ uv[j]=p[i]/(2*120)+0.5; uv[j+1]=p[i+1]/(2*120)+0.5; } }
    disk.material.map.wrapS=disk.material.map.wrapT=T.ClampToEdgeWrapping;
    disk.receiveShadow=true; floor.add(disk);

    const glow=new T.Mesh(new T.RingGeometry(34,35.2,160), new T.MeshStandardMaterial({color:0x000000,emissive:0x2ef2ff,emissiveIntensity:2,transparent:true,opacity:0.6})); glow.position.z=0.1; floor.add(glow);
    this.glow=glow; s.add(floor);
    // rig
    this.rig=new T.Group(); s.add(this.rig);
    this.clip=new T.Plane(new T.Vector3(0,-1,0),0);
    this.state={spin:true, explode:0, explodeT:0, section:false, stadium:false, speed:1};
    this.partGroups=[]; this.stadium=null; this.clock=new T.Clock(); this.spinAngle=0;
    const ro=new ResizeObserver(()=>this.resize()); ro.observe(el); this.resize();
    // tap a part on the model to edit it
    let down=null; const ray=new T.Raycaster();
    r.domElement.addEventListener('pointerdown',e=>{ down=[e.clientX,e.clientY]; });
    r.domElement.addEventListener('pointerup',e=>{ if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>6||!this.onPick) return; const b=r.domElement.getBoundingClientRect();
      ray.setFromCamera(new T.Vector2((e.clientX-b.left)/b.width*2-1,-(e.clientY-b.top)/b.height*2+1),this.camera);
      const hit=ray.intersectObjects(this.rig.children,true)[0]; if(!hit) return; let o=hit.object; const role=o.userData.role; while(o&&!o.userData.id) o=o.parent; if(o) this.onPick(o.userData.id,role); });
    this.applyQuality=()=>{ const q=BF.Settings?BF.Settings.get('quality'):'high'; r.setPixelRatio(Math.min(q==='high'?2:q==='medium'?1.25:0.8,window.devicePixelRatio||1)); r.shadowMap.enabled=!BF.Settings||BF.Settings.get('shadows'); this.resize(); };
    if(BF.Settings){ this.state.spin=BF.Settings.get('autoSpin'); this.applyQuality(); }
    const loop=()=>{ requestAnimationFrame(loop); this.tick(); }; loop();
  }
  resize(){ const w=this.el.clientWidth||1, h=this.el.clientHeight||1; this.renderer.setSize(w,h,false); this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); }
  clear(){
    this.partGroups.forEach(g=>{ g.traverse(o=>{ if(o.isMesh){ if(o.userData.ownGeo) o.geometry.dispose(); o.material.dispose(); } }); this.rig.remove(g); });
    this.partGroups=[];
  }
  setAssembly(asm){
    this.clear(); this.asm=asm; const d=asm.d;
    const key=[d.system,d.blade.shape,d.blade.wings,d.bit.tip,d.ratchet.points,d.disc.shape,(d.blade.wingShapes||[]).join(),d.deco.horns&&d.deco.horns.count,d.chip&&d.chip.on].join('|');
    if(this._shapeKey&&key!==this._shapeKey) this.popT=0; this._shapeKey=key;
    const clip=this.state.section?[this.clip]:null;
    asm.parts.forEach((part,ix)=>{
      const g=new T.Group(); g.userData={z0:part.z0, ix, id:part.id};
      part.bodies.forEach(b=>{
        const mesh=new T.Mesh(b.geo, BF.materialFor(d,part,b,{clip,double:this.state.section}));
        mesh.castShadow=true; mesh.receiveShadow=true; mesh.userData.role=b.role; g.add(mesh);
      });
      (part.inserts||[]).forEach(it=>{
        const ins=BF.INSERTS[it.ins]; let geo;
        if(ins.shape==='hex'){ geo=new T.CylinderGeometry(ins.dia/2,ins.dia/2,ins.depth-0.4,6); geo.rotateX(Math.PI/2); geo.rotateZ(it.rot||0); }
        else geo=new T.SphereGeometry(ins.dia/2,20,14);
        const m=new T.Mesh(geo,new T.MeshStandardMaterial({color:0xc9ced8,metalness:1,roughness:0.25,clippingPlanes:clip}));
        m.position.set(it.x,it.y,it.z); m.userData.ownGeo=true; m.userData.insert=true; m.visible=this.state.section||this.state.explode>0.01; g.add(m);
      });
      g.position.z=part.z0; this.rig.add(g); this.partGroups.push(g);
    });
    if(!this.framed){ this.frame(); this.framed=true; }
  }
  frame(stadium){
    const h=this.asm?this.asm.height:24;
    if(stadium){ const R=this.stadium?this.stadium.userData.R:180; this.controls.target.set(0,0,10); this.camera.position.set(R*0.9,-R*1.25,R*1.05); }
    else { this.controls.target.set(0,0,h*0.45); this.camera.position.set(105,-130,95); }
    this.controls.update();
  }
  topView(){ this.controls.target.set(0,0,0); this.camera.position.set(0,-0.01,this.state.stadium?520:190); this.controls.update(); }
  setSection(on){ this.state.section=on; if(this.asm) this.setAssembly(this.asm); }
  setExplode(on){ this.state.explode=on?1:0; this.partGroups.forEach(g=>g.children.forEach(m=>{ if(m.userData.insert) m.visible=on||this.state.section; })); }
  setSpin(on){ this.state.spin=on; }
  setStadium(on,kind,diam){
    this.state.stadium=on;
    if(this.stadium){ this.scene.remove(this.stadium); this.stadium.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); this.stadium=null; }
    this.floor.visible=!on;
    if(on){ this.stadium=BF.buildStadium(kind, diam||(kind==='X'?380:360)); this.scene.add(this.stadium); }
    this.frame(on);
  }
  snapshot(size){
    this.renderer.render(this.scene,this.camera);
    const src=this.renderer.domElement, c=document.createElement('canvas'); c.width=c.height=size;
    const s=Math.min(src.width,src.height); c.getContext('2d').drawImage(src,(src.width-s)/2,(src.height-s)/2,s,s,0,0,size,size);
    return c.toDataURL('image/jpeg',0.82);
  }
  tick(){
    const dt=Math.min(0.05,this.clock.getDelta()), st=this.state;
    if(!this.el.offsetParent) return;
    st.explodeT+= (st.explode-st.explodeT)*Math.min(1,dt*7);
    const n=this.partGroups.length;
    this.partGroups.forEach(g=>{ const k=n-1-g.userData.ix; g.position.z=g.userData.z0+st.explodeT*k*14; });
    const dir=this.asm && this.asm.d.spin==='left' ? 1 : -1;
    if(st.spin){ this.spinAngle+=dir*dt*st.speed*(st.section?2.2:18); }
    this.rig.rotation.z=this.spinAngle;
    if(this.popT!=null){ this.popT+=dt; const k=1+0.09*Math.exp(-this.popT*5)*Math.sin(this.popT*20); this.rig.scale.setScalar(k); if(this.popT>1.2){ this.popT=null; this.rig.scale.setScalar(1); } }
    const t=performance.now()/1000;
    if(st.spin && !st.section && st.explodeT<0.05){ this.rig.rotation.x=Math.sin(t*1.7)*0.012; this.rig.rotation.y=Math.cos(t*1.7)*0.012; } else { this.rig.rotation.x=0; this.rig.rotation.y=0; }
    if(st.stadium && this.stadium){ this.rig.position.z=0; }
    this.glow.material.opacity=0.45+0.2*Math.sin(t*2);
    this.controls.update();
    BF.HD.render(this,this.renderer,this.scene,this.camera);
  }
};
})();
