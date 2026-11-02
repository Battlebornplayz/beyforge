/* BeyForge — booster packs & crates: catalog with preloaded odds (owner can change them live in Admin → Packs & odds),
   pity counter, duplicate protection, and procedural 3D pack / crate models */
(function(){
'use strict';
const BF=window.BF, T=THREE;
const RAR=['common','rare','epic','legendary'];
// ---------- default catalog (odds in %) ----------
BF.PACK_DEFAULTS = {
  pack:   {name:'Booster Pack',    desc:'3 parts — one blade, one core, one driver.', model:'pack',  colors:['#ffe600','#2ef2ff'], price:300,  gems:0,  count:3, slots:'each',   odds:{common:60,rare:28,epic:10,legendary:2},  shiny:64, pity:40, enabled:true},
  element:{name:'Element Pack',    desc:'3 parts that all share today’s element.',     model:'pack',  colors:['#ff6a1a','#ffd21f'], price:600,  gems:0,  count:3, slots:'each',   odds:{common:40,rare:40,epic:17,legendary:3},  shiny:64, pity:35, enabled:true, element:'daily'},
  elite:  {name:'Elite Pack',      desc:'3 parts, Rare or better guaranteed.',        model:'pack',  colors:['#a07bff','#ff2e88'], price:900,  gems:0,  count:3, slots:'each',   odds:{common:0,rare:55,epic:35,legendary:10},  shiny:40, pity:15, enabled:true},
  mystery:{name:'Mystery Crate',   desc:'1 part — Epic or Legendary.',                model:'crate', colors:['#ff7a1a','#2ef2ff'], price:1500, gems:20, count:1, slots:'random', odds:{common:0,rare:0,epic:60,legendary:40},  shiny:20, pity:4,  enabled:true},
  burst:  {name:'Burst Booster',   desc:'3 Burst parts — a layer, a disc and a driver.', model:'pack', colors:['#1f8bff','#ffd21f'], price:400, gems:0, count:3, slots:'each', odds:{common:55,rare:30,epic:12,legendary:3}, shiny:64, pity:35, enabled:true, system:'Burst'},
  burstcrate:{name:'Burst Legend Crate', desc:'1 guaranteed Legendary Burst part.', model:'crate', colors:['#ff2e88','#ffd21f'], price:3000, gems:40, count:1, slots:'random', odds:{common:0,rare:0,epic:0,legendary:100}, shiny:32, pity:0, enabled:true, system:'Burst'},
  xbooster:{name:'X Booster',      desc:'3 Beyblade X-style parts — a blade, a ratchet and a bit.', model:'pack', colors:['#ffe600','#16171f'], price:400, gems:0, count:3, slots:'each', odds:{common:55,rare:30,epic:12,legendary:3}, shiny:64, pity:35, enabled:true, system:'X'},
  crate:  {name:'Legendary Crate', desc:'1 guaranteed Legendary part (IVs 20+).',     model:'crate', colors:['#ffd36a','#ffb020'], price:3000, gems:40, count:1, slots:'random', odds:{common:0,rare:0,epic:0,legendary:100}, shiny:32, pity:0,  enabled:true}
};
const SLOTS=['blade','core','driver'];
const todayEl=()=>{ const els=Object.keys(BF.ELEMENTS); return els[Math.floor(Date.now()/86400000)%els.length]; };

const K = BF.Packs = {
  over:{}, listeners:[],
  on(f){ this.listeners.push(f); }, emit(){ this.listeners.forEach(f=>{ try{ f(); }catch(e){} }); },
  // owner overrides live in Firestore config/packs
  listen(){ const A=BF.Account; if(this._l||!A||!A.db) return; this._l=true;
    A.db.collection('config').doc('packs').onSnapshot(s=>{ this.over=(s.data()&&s.data().packs)||{}; this.emit(); },()=>{}); },
  all(){ const out={}; Object.keys(BF.PACK_DEFAULTS).concat(Object.keys(this.over).filter(k=>!BF.PACK_DEFAULTS[k])).forEach(k=>{
    const d=BF.PACK_DEFAULTS[k]||{}, o=this.over[k]||{}; out[k]=Object.assign({},d,o,{odds:Object.assign({},d.odds||{},o.odds||{}),id:k}); }); return out; },
  get(id){ return this.all()[id]; },
  list(){ return Object.values(this.all()).filter(p=>p.enabled!==false); },
  elementOf(p){ return p.element==='daily'?todayEl():p.element||null; },
  price(p){ const bl=BF.Parts?BF.Parts.blader():[]; return Math.round(p.price*(bl.includes('merchant')?0.9:1)); },
  oddsText(p){ const o=p.odds, t=Object.values(o).reduce((a,b)=>a+(+b||0),0)||1;
    return RAR.filter(r=>o[r]>0).map(r=>`${BF.RARITY[r].label} ${(+(o[r]/t*100).toFixed(1))}%`).join(' · '); },
  // ---------- pity (per pack type, per player) ----------
  pity(){ const A=BF.Account; return Object.assign({},(A&&A.profile&&A.profile.pity)||BF.LS.get('bf.pity',{})); },
  async setPity(p){ const A=BF.Account; if(A&&A.profile) await A.update({pity:p}).catch(()=>{}); else BF.LS.set('bf.pity',p); },
  pityLeft(p){ return p.pity>0?Math.max(0,p.pity-(this.pity()[p.id]||0)):null; },
  roll(o){ const t=RAR.reduce((a,r)=>a+(+o[r]||0),0)||1; let x=Math.random()*t; for(const r of RAR){ x-=(+o[r]||0); if(x<0) return r; } return 'common'; },
  // ---------- opening ----------
  async open(id,source){
    const p=this.get(id); if(!p) throw new Error('That pack no longer exists');
    const P=BF.Parts, pity=this.pity(), el=this.elementOf(p), out=[];
    let count=(pity[id]||0), gotLeg=false;
    for(let i=0;i<p.count;i++){
      const slot=p.slots==='each'?SLOTS[i%3]:SLOTS[Math.floor(Math.random()*3)];
      let rar=this.roll(p.odds);
      if(p.pity>0 && count+1>=p.pity && !gotLeg && i===p.count-1) rar='legendary';   // pity: guaranteed on the last slot
      // duplicate protection: re-roll the design (up to 4×) if you already own this exact part at this rarity
      let d, tries=0; const sys=p.system||(out[0]?out[0].system:(Math.random()<0.6?'X':'Burst'));
      do{ d=el&&BF.designForElement?BF.designForElement((Math.random()*1e9)|0,el):P.randomDesign(sys); if(p.slots==='each'&&d.system!==sys){ d.system=sys; d=BF.normalize(d); } tries++; }
      while(tries<4 && P.list.some(x=>x.rarity===rar&&x.name===BF.Parts.nameOf(slot,BF.Parts.extract(d,slot))));
      const part=await P.create(slot,d,rar,source||id,{shiny:Math.random()<1/(p.shiny||64)});
      if(rar==='legendary') gotLeg=true; out.push(part);
    }
    pity[id]=gotLeg?0:count+1; await this.setPity(pity); BF.Missions&&BF.Missions.bump('pack');
    return out;
  },
  async buy(id){ const p=this.get(id); await BF.Parts.spend(this.price(p)); return this.open(id); }
};
BF.Account&&BF.Account.on(()=>K.listen());

// ---------- 3D pack & crate models ----------
function packArt(p,w,h){
  const c=document.createElement('canvas'); c.width=w; c.height=h; const x=c.getContext('2d'), [c1,c2]=p.colors;
  const g=x.createLinearGradient(0,0,w,h); g.addColorStop(0,'#0b0a16'); g.addColorStop(0.45,'#1d1840'); g.addColorStop(1,'#05040c'); x.fillStyle=g; x.fillRect(0,0,w,h);
  // rays
  x.save(); x.translate(w/2,h*(p.model==='crate'?0.6:0.42)); for(let i=0;i<24;i++){ x.rotate(Math.PI/12); x.fillStyle=i%2?c1+'22':c2+'18'; x.beginPath(); x.moveTo(0,0); x.lineTo(w,-w*0.08); x.lineTo(w,w*0.08); x.fill(); } x.restore();
  // slanted bands
  x.save(); x.translate(0,h*0.72); x.rotate(-0.25); x.fillStyle=c1; x.fillRect(-w,0,w*3,h*0.07); x.fillStyle=c2; x.fillRect(-w,h*0.085,w*3,h*0.02); x.restore();
  // big Bey
  const cy=p.model==='crate'?0.6:0.42; x.save(); x.translate(w/2,h*cy); x.rotate(-0.3); const R=w*(p.model==='crate'?0.24:0.32); x.beginPath();
  for(let i=0;i<=180;i++){ const t=i/180*Math.PI*2, u=(t%(Math.PI*2/3))/(Math.PI*2/3), pr=u<0.1?u/0.1:Math.pow(1-(u-0.1)/0.9,1.25), r=R*(0.6+0.4*pr); i?x.lineTo(r*Math.cos(t),r*Math.sin(t)):x.moveTo(r*Math.cos(t),r*Math.sin(t)); }
  x.closePath(); const bg=x.createLinearGradient(-R,-R,R,R); bg.addColorStop(0,'#ffffff'); bg.addColorStop(1,c1); x.fillStyle=bg; x.shadowColor=c2; x.shadowBlur=30; x.fill(); x.shadowBlur=0;
  x.lineWidth=w*0.012; x.strokeStyle='#000'; x.stroke(); x.beginPath(); x.arc(0,0,R*0.3,0,Math.PI*2); x.fillStyle='#05040c'; x.fill(); x.strokeStyle=c2; x.lineWidth=w*0.02; x.stroke(); x.restore();
  // logo + name
  x.textAlign='center'; x.font=`700 ${w*0.11}px "Chakra Petch",sans-serif`; x.fillStyle=c1; x.fillText('BEYFORGE',w/2,h*0.12);
  x.font=`700 ${w*0.085}px "Chakra Petch",sans-serif`; x.fillStyle='#fff'; x.fillText(p.name.toUpperCase(),w/2,h*0.9);
  if(p.model==='pack'){ x.font=`600 ${w*0.05}px "JetBrains Mono",monospace`; x.fillStyle=c2; x.fillText(`${p.count} PARTS`,w/2,h*0.96); }
  const t=new T.CanvasTexture(c); t.encoding=T.sRGBEncoding; t.anisotropy=4; return t;
}
function crimpTex(c1){ const c=document.createElement('canvas'); c.width=128; c.height=16; const x=c.getContext('2d'); x.fillStyle='#c8ced8'; x.fillRect(0,0,128,16);
  for(let i=0;i<128;i+=4){ x.fillStyle='rgba(0,0,0,.25)'; x.fillRect(i,0,2,16); } x.fillStyle=c1; x.globalAlpha=.35; x.fillRect(0,0,128,16); const t=new T.CanvasTexture(c); t.encoding=T.sRGBEncoding; return t; }
BF.PackModel = {
  build(p){
    const g=new T.Group(), [c1,c2]=p.colors;
    if(p.model==='crate'){
      const S=60, body=new T.Mesh(new T.BoxGeometry(S*1.15,S*0.85,S*0.85),[
        new T.MeshStandardMaterial({color:0x1d1840,metalness:.5,roughness:.4}),new T.MeshStandardMaterial({color:0x1d1840,metalness:.5,roughness:.4}),
        new T.MeshStandardMaterial({color:0x2a2460,metalness:.5,roughness:.35}),new T.MeshStandardMaterial({color:0x14112a,metalness:.5,roughness:.5}),
        new T.MeshStandardMaterial({map:packArt(p,512,384),metalness:.2,roughness:.35}),new T.MeshStandardMaterial({color:0x1d1840,metalness:.5,roughness:.4})]);
      g.add(body);
      const edge=new T.MeshStandardMaterial({color:new T.Color(c1),metalness:.95,roughness:.22});
      const W=S*1.15/2, H=S*0.85/2, D=S*0.85/2, th=3.2;
      [[W*2+th,th,th,0,H,D],[W*2+th,th,th,0,-H,D],[W*2+th,th,th,0,H,-D],[W*2+th,th,th,0,-H,-D],
       [th,H*2,th,W,0,D],[th,H*2,th,-W,0,D],[th,H*2,th,W,0,-D],[th,H*2,th,-W,0,-D],
       [th,th,D*2,W,H,0],[th,th,D*2,-W,H,0],[th,th,D*2,W,-H,0],[th,th,D*2,-W,-H,0]].forEach(([a,b,c,x,y,z])=>{ const m=new T.Mesh(new T.BoxGeometry(a,b,c),edge); m.position.set(x,y,z); g.add(m); });
      const lid=new T.Mesh(new T.BoxGeometry(W*2+1,1.2,D*2+1),new T.MeshStandardMaterial({color:new T.Color(c2),emissive:new T.Color(c2),emissiveIntensity:1.6})); lid.position.y=H*0.42; g.add(lid);
      const lock=new T.Mesh(new T.CylinderGeometry(7,7,3,32),new T.MeshStandardMaterial({color:new T.Color(c1),metalness:1,roughness:.2,emissive:new T.Color(c1),emissiveIntensity:.3})); lock.rotation.x=Math.PI/2; lock.position.set(0,H*0.42,D+2); g.add(lock);
      g.userData.glow=lid;
    } else {
      const Wd=56, Ht=84, front=packArt(p,512,768);
      const geo=new T.BoxGeometry(Wd,Ht,5,1,1,1);
      const foil=new T.MeshPhysicalMaterial({map:front,metalness:.55,roughness:.22,clearcoat:1,clearcoatRoughness:.15});
      const side=new T.MeshStandardMaterial({color:new T.Color(c1),metalness:.8,roughness:.3});
      const back=new T.MeshPhysicalMaterial({color:0x14112a,metalness:.6,roughness:.3,clearcoat:1});
      g.add(new T.Mesh(geo,[side,side,side,side,foil,back]));
      // crimped foil seals top & bottom
      const ct=crimpTex(c1), cm=new T.MeshStandardMaterial({map:ct,metalness:.9,roughness:.25});
      [Ht/2+3,-Ht/2-3].forEach(y=>{ const m=new T.Mesh(new T.BoxGeometry(Wd,6,3),cm); m.position.y=y; g.add(m); });
      // tear notch line
      const notch=new T.Mesh(new T.PlaneGeometry(Wd*0.9,0.5),new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6})); notch.position.set(0,Ht/2-5,2.6); g.add(notch);
    }
    return g;
  },
  // one shared offscreen renderer → cached PNG thumbnails for every pack
  _r:null, cache:{},
  renderer(){ if(this._r) return this._r; const r=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true}); r.outputEncoding=T.sRGBEncoding; r.setPixelRatio(1); this._r=r; return r; },
  scene(p){ const s=new T.Scene(); s.add(new T.AmbientLight(0xffffff,.55)); const k=new T.DirectionalLight(0xffffff,1.1); k.position.set(60,90,120); s.add(k);
    const rim=new T.PointLight(new T.Color(p.colors[1]),1.6,400); rim.position.set(-80,40,-60); s.add(rim); const rim2=new T.PointLight(new T.Color(p.colors[0]),1.2,400); rim2.position.set(90,-40,40); s.add(rim2); return s; },
  thumb(p,size){
    size=size||220; const key=p.id+JSON.stringify(p.colors)+p.name+p.model+size; if(this.cache[key]) return this.cache[key];
    try{ const r=this.renderer(); r.setSize(size,size,false); const s=this.scene(p), m=this.build(p); m.rotation.set(0.12,-0.45,0.04); s.add(m);
      const cam=new T.PerspectiveCamera(32,1,1,1000); cam.position.set(0,0,p.model==='crate'?210:190); cam.lookAt(0,0,0); r.setClearColor(0x000000,0); r.render(s,cam);
      return this.cache[key]=r.domElement.toDataURL('image/png'); }catch(e){ console.warn('pack thumb',e); return ''; }
  },
  // live turntable in a given canvas (used in pack details / opening)
  live(canvas,p){
    const r=new T.WebGLRenderer({canvas,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
    const s=this.scene(p), m=this.build(p); s.add(m); const cam=new T.PerspectiveCamera(32,1,1,1000); cam.position.set(0,0,p.model==='crate'?210:185);
    let on=true, t0=performance.now();
    const fit=()=>{ const w=canvas.clientWidth||300,h=canvas.clientHeight||300; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); };
    const loop=now=>{ if(!on) return; requestAnimationFrame(loop); fit(); const t=(now-t0)/1000; m.rotation.y=Math.sin(t*0.8)*0.6; m.rotation.x=0.1+Math.sin(t*1.3)*0.06; m.position.y=Math.sin(t*1.7)*3;
      if(m.userData.glow) m.userData.glow.material.emissiveIntensity=1.2+Math.sin(t*4)*0.6; r.render(s,cam); };
    requestAnimationFrame(loop);
    return {model:m,scene:s,camera:cam,renderer:r,stop(){ on=false; r.dispose(); r.forceContextLoss(); }};
  }
};
})();
