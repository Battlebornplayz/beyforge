/* BeyForge — battle engine (physics sim + arena renderer). Units: mm, s. Z-up. */
(function(){
'use strict';
const BF=window.BF, T=THREE, {clamp,lerp}=BF.util;
const G=9810, TAU=Math.PI*2, BURST_K=5200, KICK_MAX=1350;
// live-tunable battle feel (Studio → Rewards & economy → Battle feel). 1 = default.
BF.feel=k=>{ const c=BF.Econ&&BF.Econ.get('feel'), v=c&&c[k]; return v==null?1:+v; };

// ---------- fighter: physical summary of a design ----------
BF.fighter = function(d, name){
  d=BF.normalize(BF.clone(d));
  const asm=BF.build(d), mp=BF.massProps(asm), an=BF.analyze(asm,mp), tip=BF.effTip(d);
  const I=mp.Izz*1e-9, M=mp.mass/1000;
  return { d, asm, mp, an, tip, name:name||BF.naming(d,an.type).full,
    R:BF.mainPart(asm).meta.R, M, I, gear:d.system==='X'&&d.bit.gear,
    fric:M*9.81*BF.tipFriction(tip),
    drag:3e-12*(1+6*an.rough)*Math.pow(BF.mainPart(asm).meta.R/23,5),
    atk:an.stats.attack, def:an.stats.defense, sta:an.stats.stamina, brs:an.stats.burst, stb:an.stats.stability,
    spinSign: d.spin==='left'?1:-1, els: BF.elementsOf?BF.elementsOf(d):[],
    g: BF.gimmicksOf?BF.gimmicksOf(d):{} };
};

// giant raid / tower bosses: bigger, heavier, longer-spinning
BF.bossFighter = function(d,name,scale){ const f=BF.fighter(d,name), s=scale||1.35;
  f.R*=s; f.M*=s*s; f.I*=s*s*s*s; f.fric*=s*s*s*s*1.5; f.boss=true; f.scale=s; f.brs=Math.min(100,f.brs+8); return f; };

// ---------- deterministic-ish RNG so host sims are reproducible ----------
function rng(seed){ let s=seed>>>0||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return (s>>>0)/4294967296; }; }

const gg2=f=>f.g||{};
BF.STADIUMS = {
  X:     {kind:'X', label:'Xtreme Stadium', diameter:380, depth:0.085, rail:0.86,
          zones:[{a:0.25,w:0.5,type:'over'},{a:2.35,w:0.5,type:'over'},{a:4.45,w:0.9,type:'xtreme'}]},
  Burst: {kind:'Burst', label:'Burst Standard', diameter:360, depth:0.11, rail:0,
          zones:[{a:0.3,w:0.55,type:'over'},{a:2.394,w:0.55,type:'over'},{a:4.489,w:0.55,type:'over'}]},
  BurstAttack: {kind:'BurstAttack', label:'Burst Attack Stadium', system:'Burst', diameter:340, depth:0.07, rail:0,
          zones:[{a:0.0,w:0.85,type:'over'},{a:2.094,w:0.85,type:'over'},{a:4.189,w:0.85,type:'over'}]},
  BurstTornado: {kind:'BurstTornado', label:'Burst Tornado Stadium', system:'Burst', diameter:380, depth:0.14, rail:0,
          zones:[{a:1.2,w:0.4,type:'over'},{a:4.34,w:0.4,type:'over'}]}
};
BF.RULES = {
  X:     {target:4, pts:{spin:1, over:2, burst:2, xtreme:3}},
  Burst: {target:3, pts:{spin:1, over:1, burst:2, xtreme:2}}
};
BF.RULES.BurstAttack=BF.RULES.Burst; BF.RULES.BurstTornado=BF.RULES.Burst;

// ---------- simulation ----------
function tipFor(f,l){
  const t=BF.TIPS[f.d.bit.tip];
  if(t&&t.modes&&l.mode){ const tip=Object.assign({},t,t.modes[l.mode]); return {tip, fric:f.M*9.81*BF.tipFriction(tip)}; }
  return {tip:f.tip, fric:f.fric};
}
const STATUS_KEYS=['burn','freeze','shock','stagger','break','daze','armor'];
const STATUS_T={burn:3,freeze:2,shock:1.5,stagger:1.5,break:4,daze:2,armor:2.5};
// named launch shots: how the Bey leaves the launcher
BF.SHOTS = {
  flat:   {label:'Flat Shot',      desc:'Straight, steady launch. No surprises.', speed:'Normal', spin:'Normal', extra:'Steady start'},
  bank:   {label:'Bank Shot',      desc:'Leans in and curves toward the center — hunts early.', speed:'+8%', spin:'Normal', extra:'Hunts sooner'},
  sliding:{label:'Sliding Shoot',  desc:'Rides the rim fast and keeps spin longer at the start.', speed:'+12%', spin:'Normal', extra:'30% less spin loss for 4 s'},
  power:  {label:'Power Shoot',    desc:'Max spin and speed, but starts with a wobble.', speed:'+12%', spin:'+10%', extra:'Starts with a wobble'}
};
BF.Sim = class {
  // fighters: f1, f2 (+ opts.extra for a 3rd Bey, e.g. a raid boss). opts.teams = team index per Bey.
  constructor(f1, f2, stadium, seed, opts){
    opts=opts||{};
    this.f=[f1,f2].concat(opts.extra?[opts.extra]:[]); this.team=opts.teams||this.f.map((_,i)=>i);
    this.st=stadium; this.R=stadium.diameter/2; this.rand=rng(seed||12345);
    this.events=[]; this.t=0; this.done=null;
    this.decayK = BF.Settings ? BF.Settings.decayK() : 0.7;   // round length setting
    this.movesOn=true; this.elemOn=true;
    this.terrain=stadium.terrain&&BF.TERRAINS&&BF.TERRAINS[stadium.terrain]?stadium.terrain:'none';
    this.spots=BF.terrainSpots?BF.terrainSpots(this.terrain,this.R):[]; this.gustT=2.5; this.kb=BF.feel('knockback'); this.practice=opts.practice||null;
  }
  // l = {power 0.35..1, angle -30..30 deg, spin, mode, shot, pos:{a,r}, moves:[ids], perks}
  launch(...ls){
    const R=this.R, n=this.f.length;
    this.b=this.f.map((f,i)=>{
      const l=ls[i]||{power:0.8,angle:0};
      const pos=l.pos||{a:0,r:0.55}, shot=BF.SHOTS[l.shot]?l.shot:'flat';
      const base= n===2 ? (i===0?-Math.PI/2:Math.PI/2) : (-Math.PI/2+i*TAU/n);
      const a0=base+clamp(pos.a||0,-1,1)*(n===2?0.9:0.5);
      const r=R*clamp(pos.r||0.55,0.25,0.8)*(f.boss?0.6:1), x=r*Math.cos(a0), y=r*Math.sin(a0);
      const sign = f.d.spin==='dual' ? (l.spin==='left'?1:-1) : f.spinSign;
      // launched along the rim in the spin direction, angled inward; tilt + shot steer it
      const tang=Math.atan2(y,x)+(sign>0?Math.PI/2:-Math.PI/2);
      const lean={flat:0,bank:14,sliding:-14,power:0}[shot];
      const miss=l.misfire?(this.rand()-0.5)*0.8:0, inward=tang+(sign>0?1:-1)*(28+(l.angle||0)+lean)*Math.PI/180+miss;
      const sp=(260+l.power*620)*({flat:1,bank:1.08,sliding:1.12,power:1.12}[shot])*(l.misfire?0.78:1);
      const perks=l.perks||[];
      const w=600*(0.55+0.45*l.power)*(shot==='power'?1.1:1)*(perks.includes('grit')?1.04:1)*(l.misfire?0.9:1);
      const els=f.els||[], home=this.terrain!=='none'&&els.some(e=>BF.TERRAINS[this.terrain].els.includes(e));
      const b={i,team:this.team[i],x,y,vx:sp*Math.cos(inward),vy:sp*Math.sin(inward), w, w0:w,
        sign, ang:this.rand()*TAU, ph:this.rand()*TAU, phr:0.85+0.3*this.rand(), dmg:0, tilt:shot==='power'?0.3:0, alive:true, out:false, burst:false,
        dash:0, dashCd:0, hitCd:0, z:0, shot, bmode:l.bmode||'attack', fx:{}, st:{}, next:{}, moveT:0, moveEl:null, leanT:0, leanCd:0, zigT:0, home,
        moves:(this.movesOn&&l.moves)?l.moves.slice(0,3):[], used:[false,false,false], perks, ...tipFor(f,l)};
      if(shot==='sliding') b.fx.slide=4; if(l.misfire) b.tilt=Math.max(b.tilt,0.5);
      return b;
    });
    this.t=0; this.done=null; this.events=[]; this.heat=0;
  }
  foes(i){ return this.b.filter(o=>o.alive&&o.team!==this.b[i].team); }
  nearestFoe(i){ const b=this.b[i]; let best=null, bd=1e9; this.b.forEach(o=>{ if(o.team===b.team) return; const d=Math.hypot(o.x-b.x,o.y-b.y)+(o.alive?0:1e6); if(d<bd){ bd=d; best=o; } }); return best; }
  // ---------- player inputs (host applies them; guests send theirs over the network) ----------
  useMove(i,slot){
    const b=this.b&&this.b[i]; if(!b||this.done||!this.movesOn||!b.alive||b.used[slot]||this.t<0.4) return false;
    const d=this.f[i].d, m=BF.moveById(d,b.moves[slot]); if(!m) return false;
    const pr=d.prog; if(pr&&pr.unlocked&&!m.sig&&!pr.unlocked.includes(m.id)) return false;   // part not leveled enough yet
    const lv=Math.min(3,(pr&&pr.moveLv&&pr.moveLv[m.id])||1), mul=(1+0.25*(lv-1))*(b.perks.includes('focus')?1.15:1);
    const before=Object.assign({},b.fx), kick0=b.next.kick||0;
    b.used[slot]=true; b.moveElNext=m.el; BF.MOVE_FX[m.kind](this,b,this.nearestFoe(i),mul);
    for(const k in b.fx) if(b.fx[k]>(before[k]||0)) b.fx[k]=(before[k]||0)+(b.fx[k]-(before[k]||0))*mul;   // upgraded moves last longer
    if(b.next.kick>kick0) b.next.kick=1+(b.next.kick-1)*mul;
    b.moveT=Math.max(b.moveT,3); b.moveEl=m.el;
    this.events.push({k:'move',i,id:m.id,name:m.name+(lv>1?' '+['','II','III'][lv-1]:''),el:m.el,kind:m.kind,sig:!!m.sig}); return true;
  }
  lean(i,x,y){ const b=this.b&&this.b[i]; if(!b||!b.alive||b.leanCd>0) return false; b.lean={x,y}; b.leanT=0.45; b.leanCd=b.perks.includes('quick')?0.68:0.9; this.events.push({k:'lean',i,x,y}); return true; }
  applyStatus(t,s){ if(!s) return; if(s==='knock'){ return; } t.st[s]=STATUS_T[s]||2; this.events.push({k:'status',i:t.i,s}); }
  zoneAt(a){ a=((a%TAU)+TAU)%TAU; for(const z of this.st.zones){ let d=a-z.a; d=((d%TAU)+TAU)%TAU; if(d<z.w) return z.type; } return null; }
  step(dt){
    if(this.done) return;
    const B=this.b, F=this.f, R=this.R, st=this.st, TR=this.terrain;
    this.t+=dt; this.heat+=dt; const maxT=Math.max(90,90/this.decayK*0.8);
    // storm gusts shove everyone the same way
    if(TR==='storm'){ this.gustT-=dt; if(this.gustT<=0){ this.gustT=2+this.rand()*1.8; const ga=this.rand()*TAU;
      B.forEach(b=>{ if(!b.alive) return; const k=b.home?220:520; b.vx+=Math.cos(ga)*k; b.vy+=Math.sin(ga)*k; }); this.events.push({k:'gust',a:ga}); } }
    for(let i=0;i<B.length;i++){
      const b=B[i], f=F[i]; if(!b.alive) continue;
      if(this.practice){ const P=this.practice; if(i===1){ P.dealt=(P.dealt||0)+b.dmg; b.w=b.w0; b.dmg=0; if(P.still){ b.x=0; b.y=0; b.vx=0; b.vy=0; b.z=0; b.ang+=b.sign*b.w*dt; continue; } } else if(P.infinite){ b.w=b.w0; b.dmg=0; } }
      const fx=b.fx, S=b.st, o=this.nearestFoe(i);
      const r=Math.hypot(b.x,b.y)||1e-6, ux=b.x/r, uy=b.y/r;
      // bowl pulls toward center (Void Temple pulls harder)
      const ac=-G*2*st.depth*r/R*(1-0.6*b.tilt)*(fx.center?3:1)*(TR==='void'&&!b.home?1.6:1);
      let ax=ac*ux, ay=ac*uy;
      // tip drive: grippy/flat tips carve around the stadium in their spin direction
      const spinFrac=b.w/b.w0, mob=b.tip.mob;
      // flower pattern: the tip carves along the rim then periodically dives back through the center
      const tx0=uy*b.sign, ty0=-ux*b.sign;
      b.ph+=dt*(1.6+1.6*mob)*b.phr;
      const beta=fx.sweep?0.05:(0.25+0.85*Math.max(0,Math.sin(b.ph)))*Math.min(1,r/(R*0.25));
      const tx=tx0*Math.cos(beta)-ux*Math.sin(beta), ty=ty0*Math.cos(beta)-uy*Math.sin(beta);
      let drive=mob*950*spinFrac*(0.6+0.4*Math.min(1,r/(R*0.4)));
      if(fx.drive) drive*=2.2; if(fx.sweep) drive*=1.8; if(fx.center) drive*=0.2; if(S.freeze) drive*=0.4; if(S.stagger) drive*=0.3;
      if(TR==='ice') drive*=b.home?1.3:0.7; else if(b.home) drive*=1.15;
      ax+=tx*drive; ay+=ty*drive;
      // aggression: Beys hunt each other. Attack types chase hard; the longer nobody touches,
      // the harder they get pulled together (real Beys drift into each other as the bowl funnels them)
      if(o && o.alive && !S.daze){
        const px=o.x+o.vx*0.12-b.x, py=o.y+o.vy*0.12-b.y, pd=Math.hypot(px,py)||1;
        const aggr=(0.2+0.95*f.atk/100)*(0.45+0.55*mob)*(f.boss?1.2:1);
        const ramp=clamp((this.t-(b.shot==='bank'?0.3:1.2))/2.5,0,1);
        let seek=900*aggr*Math.sqrt(spinFrac)*(0.3+Math.min(1.4,this.heat/2.4))*ramp;
        if(fx.rush) seek+=3200; if(fx.barrage) seek+=900;
        ax+=px/pd*seek; ay+=py/pd*seek;
        if(fx.zig){ b.zigT-=dt; if(b.zigT<=0){ b.zigT=0.3; const ang=Math.atan2(py,px)+(this.rand()-0.5)*2.1; b.vx+=Math.cos(ang)*700; b.vy+=Math.sin(ang)*700; } }
      }
      // any foe's Gravity Well / Black Hole drags this Bey toward it
      B.forEach(g=>{ if(g===b||!g.alive||g.team===b.team||!g.fx.gravity) return; const gx=g.x-b.x, gy=g.y-b.y, gd=Math.hypot(gx,gy)||1; const k=g.fx.blackhole?2400:1400; ax+=gx/gd*k; ay+=gy/gd*k;
        if(g.fx.blackhole&&gd<120) b.w=Math.max(0,b.w-b.w0*0.06*dt); });
      // tap-to-lean: a light push toward the spot the player tapped
      if(b.leanT>0){ const lx=b.lean.x-b.x, ly=b.lean.y-b.y, ld=Math.hypot(lx,ly)||1; ax+=lx/ld*1300; ay+=ly/ld*1300; b.leanT-=dt; }
      b.leanCd-=dt;
      ax+=(this.rand()-0.5)*900*mob; ay+=(this.rand()-0.5)*900*mob;
      if(S.shock){ ax+=(this.rand()-0.5)*3000; ay+=(this.rand()-0.5)*3000; }
      // Xtreme Dash: gear bits catch the rail and rocket forward
      if(f.gear && st.rail && b.dashCd<=0 && Math.abs(r-R*st.rail)<9 && spinFrac>0.35){ b.dash=0.32; b.dashCd=1.4; this.events.push({k:'dash',i}); }
      if(b.dash>0){ const want=1500*spinFrac; b.vx+=(tx0*want-b.vx)*Math.min(1,dt*12); b.vy+=(ty0*want-b.vy)*Math.min(1,dt*12); b.dash-=dt; }
      b.dmg=Math.max(0,b.dmg-dt*0.012); b.dashCd-=dt; b.hitCd-=dt; b.wallCd=(b.wallCd||0)-dt;
      // floor friction / damping: stamina tips settle, attack tips keep moving (ice barely slows anything)
      let damp=0.85+1.0*(1-mob)+1.5*b.tilt+(S.freeze?2.2:0)+(fx.center?3:0)+(fx.wall?0.8:0);
      if(TR==='ice') damp*=0.45;
      b.vx+=ax*dt; b.vy+=ay*dt; b.vx*=1-Math.min(0.5,damp*dt); b.vy*=1-Math.min(0.5,damp*dt);
      if(gg2(f).quake&&this.rand()<dt*2.2){ const qa=this.rand()*TAU; b.vx+=Math.cos(qa)*160; b.vy+=Math.sin(qa)*160; }
      b.x+=b.vx*dt; b.y+=b.vy*dt;
      // spin decay from the same physics as the Forge, scaled by the round-length setting
      const gg=f.g||{}; let dk=this.decayK*(gg.freetip?0.78:1)*(gg.outerweight?0.92:1)*(gg.imbalance?1.08:1)*(gg.point&&b.shot==='flat'?0.85:1)*(gg.rubbertip?1.12:1); if(fx.eternal) dk*=0.35; if(fx.center) dk*=0.6; if(fx.slide) dk*=0.7; if(S.burn) dk*=1.5;
      const dw=(b.fric+f.drag*b.w*b.w)/f.I*(1+2*b.tilt)*dk;
      b.w=Math.max(0,b.w-dw*dt); b.ang+=b.sign*b.w*dt;
      // terrain hazards
      if(!b.home){
        if(TR==='lava' && this.spots.some(s=>Math.hypot(b.x-s.x,b.y-s.y)<s.r)){ if(!S.burn) this.applyStatus(b,'burn'); b.w=Math.max(0,b.w-b.w0*0.025*dt); }
        if(TR==='storm' && !S.shock && this.spots.some(s=>Math.hypot(b.x-s.x,b.y-s.y)<s.r)) this.applyStatus(b,'shock');
        b.beamCd=(b.beamCd||0)-dt;
        if(TR==='void' && !S.daze && b.beamCd<=0 && this.t>3 && r>R*0.12){ const ba=this.t*0.6; if(Math.abs(-Math.sin(ba)*b.x+Math.cos(ba)*b.y)<6){ this.applyStatus(b,'daze'); b.st.daze=1.2; b.beamCd=3.5; } }
      }
      // wobble near the end (and from shocks / Power Shoot)
      const wl=Math.max(60,b.w0*0.16);
      b.tilt = b.w<wl*2.2 ? clamp(1-(b.w-wl)/(wl*1.2),0,1)*(1.15-f.stb/200) : Math.max(S.shock?0.35:0,b.tilt-dt);
      if(b.w<wl){ b.alive=false; this.events.push({k:'stop',i}); }
      // timers
      for(const k in fx){ fx[k]-=dt; if(fx[k]<=0) delete fx[k]; }
      for(const k in S){ S[k]-=dt; if(S[k]<=0) delete S[k]; }
      if(!fx.upper) b.next.upper=false; if(!fx.rush) b.next.kick=0;
      b.moveT=Math.max(0,b.moveT-dt);
      // walls, over zones, xtreme pocket
      const r2=Math.hypot(b.x,b.y), lim=R-f.R-4;
      if(r2>lim){
        const nx=b.x/r2, ny=b.y/r2, vr=b.vx*nx+b.vy*ny, zone=this.zoneAt(Math.atan2(b.y,b.x));
        // the opening clash rarely rings anyone out — Beys still have the launch's grip on the floor
        const early=1+0.6*clamp(1-(this.t-1.5)/3,0,1), hold=(fx.anchor?1.35:1)*(fx.wall?1.2:1)*(f.boss?1.3:1);
        if(zone && vr>(zone==='xtreme'?290:340)*early*hold){ b.alive=false; b.out=zone; this.events.push({k:zone,i,x:b.x,y:b.y,vx:b.vx,vy:b.vy}); }
        else { b.x=nx*lim; b.y=ny*lim; if(vr>0){ b.vx-=(1.55)*vr*nx; b.vy-=(1.55)*vr*ny; b.vx*=0.997; b.vy*=0.997; if(vr>60 && b.wallCd<=0){ b.w-=Math.min(b.w*0.04, vr*0.012); b.wallCd=0.25; } if(vr>250) this.events.push({k:'wall',i,x:b.x,y:b.y,s:vr}); } }
      }
      b.z=st.depth*Math.min(r2,R)**2/R;
    }
    // collisions between every pair
    for(let i=0;i<B.length;i++) for(let j=i+1;j<B.length;j++) this.collide(i,j);
    // decide: a team is out when all its Beys are out
    const teams=[...new Set(this.team)], alive=teams.filter(t=>B.some(b=>b.team===t&&b.alive));
    if(this.practice&&B[1]&&!B[1].alive){ B[1].alive=true; B[1].out=false; B[1].burst=false; B[1].x=0; B[1].y=0; B[1].vx=0; B[1].vy=0; }
    if(this.practice&&B[0].alive){ /* practice only ends when you go out */ }
    else if(alive.length<=1){
      let winner, how;
      if(alive.length===1){ winner=alive[0]; const losers=B.filter(b=>b.team!==winner); const last=losers.sort((x,y)=>(y.outT||0)-(x.outT||0))[0]||losers[0]; how=last.burst?'burst':last.out?last.out:'spin'; }
      else { // everyone went down on the same step
        const bt=B.find(b=>b.burst); if(bt){ winner=teams.find(t=>t!==bt.team); how='burst'; }
        else { const best=B.slice().sort((x,y)=>y.w/y.w0-x.w/x.w0)[0]; winner=best.team; how='spin'; } }
      this.done={winner,how,t:this.t};
    } else if(this.t>maxT){
      const score=t=>B.filter(b=>b.team===t&&b.alive).reduce((a,b)=>a+b.w/b.w0,0);
      this.done={winner:teams.slice().sort((x,y)=>score(y)-score(x))[0], how:'spin', t:this.t};
    }
    B.forEach(b=>{ if(!b.alive&&b.outT==null) b.outT=this.t; });
  }
  collide(ia,ib){
    const B=this.b, F=this.f, a=B[ia], b=B[ib]; if(!a.alive||!b.alive) return;
    const dx=b.x-a.x, dy=b.y-a.y, dist=Math.hypot(dx,dy)||1e-6, minD=F[ia].R+F[ib].R; if(dist>=minD) return;
    const nx=dx/dist, ny=dy/dist;
    const mEff=(x,i)=>F[i].M*(x.fx.anchor?1.8:1)*(x.fx.weight?1.4:1);
    const m1=mEff(a,ia), m2=mEff(b,ib);
    const pen=minD-dist; a.x-=nx*pen*m2/(m1+m2); a.y-=ny*pen*m2/(m1+m2); b.x+=nx*pen*m1/(m1+m2); b.y+=ny*pen*m1/(m1+m2);
    if(a.hitCd>0 || b.hitCd>0) return;
    const vn=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
    if(a.team===b.team){ // teammates just bump
      const j=1.3*Math.max(0,-vn)/(1/m1+1/m2); a.vx-=j/m1*nx; a.vy-=j/m1*ny; b.vx+=j/m2*nx; b.vy+=j/m2*ny; a.hitCd=b.hitCd=0.12; return; }
    const same=a.sign===b.sign, rimA=a.w*F[ia].R, rimB=b.w*F[ib].R;
    const clash=Math.max(0,-vn)*0.8+0.03*(same?rimA+rimB:Math.abs(rimA-rimB)*0.6)*(0.6+0.4*this.rand());
    const e=0.35+0.4*(F[ia].atk+F[ib].atk)/200;
    const j=(1+e)*Math.max(0,-vn)/(1/m1+1/m2);
    a.vx-=j/m1*nx; a.vy-=j/m1*ny; b.vx+=j/m2*nx; b.vy+=j/m2*ny;
    // element matchup of each attacker against the defender (a move's element while it's active)
    const elOf=(x,i)=>x.moveT>0&&x.moveEl?[x.moveEl]:F[i].els;
    const em=[this.elemOn?BF.elemMult(elOf(a,ia),F[ib].els):1, this.elemOn?BF.elemMult(elOf(b,ib),F[ia].els):1]; // em[0]: a hitting b
    // contact points throw the other Bey: scaled by attacker's attack vs target's defense and mass
    // soft-capped so one tap doesn't fling a Bey out — big hits still can, chip damage adds up
    const kick=(atk,def,mSelf,mOther)=>{ const raw=clash*0.85*Math.pow(0.1+atk/100,2)*(1.3-def/100)*clamp(Math.sqrt(mOther/mSelf),0.55,1.8); return KICK_MAX*(1-Math.exp(-raw/KICK_MAX)); };
    // part gimmicks (real-life inspired): spring blades, imbalance ratchets, free-spin rings/tips, brakes, barrier blades, modes
    const gA=F[ia].g||{}, gB=F[ib].g||{}, G=x=>x===a?gA:gB;
    const outMul=x=>(x.next.kick||1)*(x.fx.weight?1.25:1)*(x.fx.sweep?1.3:1)*(x.home?1.1:1)*(G(x).spring?1.15:1)*(G(x).imbalance?1.1:1)*(G(x).bmode?(x.bmode==='defense'?0.85:1.12):1);
    const inMul=y=>(y.fx.wall?0.4:1)*(y.fx.anchor?0.55:1)*(y.fx.counter?0.6:1)*(y.st.armor?0.75:1)*(G(y).freering?0.85:1)*(G(y).freetip&&!G(y).brakes?1.12:1)*(G(y).brakes?0.85:1)*(G(y).barrier&&y.w>0.6*y.w0?0.8:1)*(G(y).bmode&&y.bmode==='defense'?0.8:1);
    const kOnB=kick(F[ia].atk,F[ib].def,m2,m1)*em[0]*outMul(a)*inMul(b)*this.kb;
    const kOnA=kick(F[ib].atk,F[ia].def,m1,m2)*em[1]*outMul(b)*inMul(a)*this.kb;
    a.vx-=nx*kOnA; a.vy-=ny*kOnA; b.vx+=nx*kOnB; b.vy+=ny*kOnB;
    // Counter: the attacker eats its own hit
    if(b.fx.counter){ a.vx-=nx*kOnB*0.8; a.vy-=ny*kOnB*0.8; }
    if(a.fx.counter){ b.vx+=nx*kOnA*0.8; b.vy+=ny*kOnA*0.8; }
    // spin loss; opposite spins steal from the weaker one
    const loss=(atk,def)=>clash*0.0016*(0.4+atk/100)*(1.2-def/120);
    let la=loss(F[ib].atk,F[ia].def)*em[1]*(b.fx.barrage?1.5:1)*(a.fx.wall?0.6:1)*(F[ia].boss?0.9:1);
    let lb=loss(F[ia].atk,F[ib].def)*em[0]*(a.fx.barrage?1.5:1)*(b.fx.wall?0.6:1)*(F[ib].boss?0.9:1);
    let stolen=null; if(!same){ const steal=Math.abs(rimA-rimB)*0.0016; if(rimA>rimB){ a.w+=steal*0.5; lb+=steal; stolen={to:ia,from:ib,a:steal}; } else { b.w+=steal*0.5; la+=steal; stolen={to:ib,from:ia,a:steal}; } }
    // spin-steal rubber: meshes with an opposite-spin foe and evens the spin out (like Drain-style layers)
    if(!same){ if(gA.spinsteal&&a.w<b.w){ const s=Math.min((b.w-a.w)*0.12,b.w0*0.035); a.w=Math.min(a.w0*1.05,a.w+s); lb+=s*0.8; } if(gB.spinsteal&&b.w<a.w){ const s=Math.min((a.w-b.w)*0.12,a.w0*0.035); b.w=Math.min(b.w0*1.05,b.w+s); la+=s*0.8; } }
    if(gA.freering) la*=0.65; if(gB.freering) lb*=0.65;
    if(a.fx.steal){ const s=0.04*b.w0; lb+=s; a.w=Math.min(a.w0,a.w+s*0.8); }
    if(b.fx.steal){ const s=0.04*a.w0; la+=s; b.w=Math.min(b.w0,b.w+s*0.8); }
    a.w=Math.max(0,a.w-la); b.w=Math.max(0,b.w-lb);
    a.hitCd=b.hitCd=(a.fx.barrage||b.fx.barrage)?0.05:(gA.barrage||gB.barrage)?0.09:0.12;
    const cx=a.x+nx*F[ia].R, cy=a.y+ny*F[ia].R;
    // "super effective" callouts only for hits made while a move is active
    const mv=[a.moveT>0?em[0]:1, b.moveT>0?em[1]:1];
    this.events.push({k:'hit',x:cx,y:cy,s:clash,same,mv:a.moveT>0||b.moveT>0,st:stolen&&stolen.a>2?stolen:null,eff:Math.max(...mv)>1.05?'super':Math.min(...mv)<0.95?'weak':''});
    // burst meter: every hit knocks the ratchet a few clicks; enough clicks and it bursts
    this.heat=0;
    [[b,ib,a,ia,0],[a,ia,b,ib,1]].forEach(([y,iy,x,ix,k])=>{
      const f=F[iy], weak=1-y.w/y.w0, before=y.dmg;
      const gy=F[iy].g||{}, gx=F[ix].g||{}; const mul=em[k]*(x.next.upper&&!gy.metalball?2.5:1)*(gy.metalball?0.7:1)*(gy.compress?0.8:1)*(gx.rubberblade?1.15:1)*(gy.burstlock?0.75:1)*(y.fx.wall?0.4:1)*(y.fx.lockguard?0.25:1)*(y.st.break?1.6:1)*(y.st.armor?0.75:1)*(f.boss?0.6:1);
      y.dmg+=clash/BURST_K*(0.35+F[ix].atk/100)*Math.max(0.12,1.12-f.brs/100)*(0.55+weak)*(0.7+0.6*this.rand())*mul;
      if(Math.floor(y.dmg*3)>Math.floor(before*3) && y.dmg<1) this.events.push({k:'click',i:iy,x:y.x,y:y.y,n:Math.floor(y.dmg*3)});
      if(y.alive && y.dmg>=1){ y.alive=false; y.burst=true; this.events.push({k:'burst',i:iy}); }
    });
    // move hits: Upper rocks the target; the move's element may inflict a status
    [[a,b],[b,a]].forEach(([x,y])=>{
      if(x.next.upper){ x.next.upper=false; y.st.shock=Math.max(y.st.shock||0,1.2); }
      if(x.next.kick) x.next.kick=0;
      if(x.moveT>0 && x.moveEl && this.elemOn && this.rand()<0.6){
        const s=BF.ELEMENTS[x.moveEl].status;
        if(s==='armor') this.applyStatus(x,'armor');
        else if(s==='knock'){ y.vx+=(y.x-x.x)/dist*350; y.vy+=(y.y-x.y)/dist*350; this.events.push({k:'status',i:y.i,s:'knock'}); }
        else if(!y.st[s]) this.applyStatus(y,s);
      }
    });
  }
  snapshot(){ return {t:this.t, b:this.b.map(b=>[b.x,b.y,b.z,b.ang,b.w,b.w0,b.tilt,b.alive?1:0,b.burst?1:0,b.dash>0?1:0,b.dmg,
    STATUS_KEYS.reduce((m,k,j)=>m|(b.st[k]?1<<j:0),0), b.used.reduce((m,u,j)=>m|(u?1<<j:0),0)]), done:this.done}; }
};
BF.STATUS_KEYS=STATUS_KEYS;
// launch preview: a quiet dry run of the first moments, with no opponent in the way
BF.predictLaunch=function(f,foe,stadium,l,who){ const sim=new BF.Sim(who===0?f:foe,who===0?foe:f,stadium,424242), other=1-who, ls=[{power:0.85,angle:0},{power:0.85,angle:0}]; ls[who]=Object.assign({power:0.9},l,{moves:[],misfire:false});
  sim.movesOn=false; sim.elemOn=false; sim.launch(...ls); sim.b[other].alive=false; const pts=[]; const me=sim.b[who]; pts.push([me.x,me.y,me.z]);
  for(let k=1;k<=190;k++){ sim.step(1/120); sim.done=null; sim.events.length=0; if(!me.alive) break; if(k%5===0) pts.push([me.x,me.y,me.z]); } return pts; };

// ---------- arena renderer ----------
let _glow=null, _soft=null, _streakG=null; const _railC=new T.Color(0xffe600), _tv=new T.Vector3();
function softTex(){ if(_soft) return _soft; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'), g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.18,'rgba(255,255,255,0.8)'); g.addColorStop(0.5,'rgba(255,255,255,0.14)'); g.addColorStop(1,'rgba(255,255,255,0)'); x.fillStyle=g; x.fillRect(0,0,128,128); return _soft=new T.CanvasTexture(c); }
function glowTex(){ if(_glow) return _glow; const c=document.createElement('canvas'); c.width=c.height=128; const x=c.getContext('2d'); const g=x.createRadialGradient(64,64,0,64,64,64);
  g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(0.42,'rgba(255,255,255,0.15)'); g.addColorStop(0.55,'rgba(255,255,255,0.9)'); g.addColorStop(0.7,'rgba(255,255,255,0.25)'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,128,128); return _glow=new T.CanvasTexture(c); }
function beyGroup(asm){
  const g=new T.Group(); const d=asm.d;
  asm.parts.forEach(part=>{
    const pg=new T.Group(); pg.position.z=part.z0; pg.userData.id=part.id;
    part.bodies.forEach(b=>{ const m=new T.Mesh(b.geo,BF.materialFor(d,part,b)); m.castShadow=true; pg.add(m); });
    g.add(pg);
  });
  return g;
}
BF.beyGroup=beyGroup;

BF.Arena = class {
  constructor(el){
    this.el=el;
    const r=this.renderer=new T.WebGLRenderer({antialias:true});
    r.setPixelRatio(Math.min(2,window.devicePixelRatio||1)); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=0.98; r.shadowMap.enabled=true;
    el.appendChild(r.domElement);
    const s=this.scene=new T.Scene(); s.background=new T.Color(0x07060e);
    this.camera=new T.PerspectiveCamera(38,1,5,5000); this.camera.up.set(0,0,1);
    const pm=new T.PMREMGenerator(r), es=new T.Scene();
    es.add(new T.Mesh(new T.BoxGeometry(200,200,200),new T.MeshBasicMaterial({color:0x0a0818,side:T.BackSide})));
    [[0,0,90,0xffffff,4],[-90,20,20,0x2ef2ff,3],[90,-20,30,0xff2e88,3]].forEach(([x,y,z,c,k])=>{ const p=new T.Mesh(new T.PlaneGeometry(120,60),new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(k),side:T.DoubleSide})); p.position.set(x,y,z); p.lookAt(0,0,0); es.add(p); });
    s.environment=pm.fromScene(es,0.03).texture;
    s.add(new T.HemisphereLight(0xb8c6ff,0x150a20,0.4));
    const key=new T.DirectionalLight(0xffffff,1.15); key.position.set(120,-160,420); key.castShadow=true; key.shadow.mapSize.set(4096,4096); key.shadow.radius=3;
    Object.assign(key.shadow.camera,{left:-220,right:220,top:220,bottom:-220,near:50,far:900}); s.add(key);
    const c1=new T.PointLight(0x2ef2ff,1.4,900); c1.position.set(-260,120,120); s.add(c1);
    const c2=new T.PointLight(0xff2e88,1.4,900); c2.position.set(260,-120,120); s.add(c2);
    this.sparks=[]; this.fx=[]; this.beys=[null,null]; this.shake=0; this.hitL=new T.PointLight(0xfff0c0,0,520,1.6); s.add(this.hitL);
    this.applyQuality=()=>{ const q=BF.Settings?BF.Settings.get('quality'):'high'; r.setPixelRatio(Math.min(q==='high'?2:q==='medium'?1.25:0.8,window.devicePixelRatio||1)); r.shadowMap.enabled=!BF.Settings||BF.Settings.get('shadows'); };
    this.applyQuality(); BF.Settings&&BF.Settings.on(k=>{ if(k==='quality'||k==='shadows'||k==='*'){ this.applyQuality(); this.resize(); } });
    new ResizeObserver(()=>this.resize()).observe(el); this.resize();
  }
  resize(){ const w=this.el.clientWidth||1,h=this.el.clientHeight||1; this.renderer.setSize(w,h,false); this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); this.frame(); }
  frame(){ // fit the whole stadium on any screen shape
    const R=(this.R||190)+18, cam=this.camera, v=cam.fov*Math.PI/360, h=Math.atan(Math.tan(v)*cam.aspect);
    const portrait=cam.aspect<1, tilt=portrait?0.32:0.55;   // radians from straight down
    const need=Math.max(R/Math.tan(h), R*Math.cos(tilt)/Math.tan(v))*1.12;
    cam.position.set(0,-need*Math.sin(tilt),need*Math.cos(tilt)); const look=new T.Vector3(0,portrait?-R*0.18:0,0); cam.lookAt(look);
    this.camBase={pos:cam.position.clone(), look}; }
  // ---------- cinematic camera ----------
  // launch close-up: camera eases onto your Bey and a 3D launcher sits on top of it
  launchView(i,at){ const v=this.beys[i]; if(!v) return; this.clearLaunchers();
    const p=at?new T.Vector3(at.x,at.y,at.z):v.root.position.clone(); if(at) v.root.position.copy(p);
    const L=this.launcher(i===0?0x2ef2ff:0xff2e88); L.scale.setScalar(0.8); L.rotation.z=Math.PI; L.position.set(0,0,(v.f.asm?v.f.asm.height:24)+5); v.root.add(L); v.launcher=L; }
  launcher(color){ const g=new T.Group(), dark=new T.MeshStandardMaterial({color:0x15161e,metalness:.2,roughness:.6,envMapIntensity:.2}), acc=new T.MeshStandardMaterial({color,metalness:.6,roughness:.3,emissive:color,emissiveIntensity:.25});
    const body=new T.Mesh(new T.CylinderGeometry(15,17,9,32),dark); body.rotation.x=Math.PI/2; body.position.z=4.5; g.add(body);
    const ring=new T.Mesh(new T.TorusGeometry(16,1.4,10,40),acc); ring.position.z=8.8; g.add(ring);
    const slot=new T.Mesh(new T.BoxGeometry(34,6,5),dark); slot.position.set(17,0,6); g.add(slot);
    const cordEnd=new T.Mesh(new T.BoxGeometry(5,9,6),acc); cordEnd.position.set(36,0,6); g.add(cordEnd);
    const grip=new T.Mesh(new T.BoxGeometry(8,6,24),dark); grip.position.set(0,20,18); grip.rotation.x=0.45; g.add(grip);
    const prongs=new T.Group(); for(let k=0;k<3;k++){ const pr=new T.Mesh(new T.BoxGeometry(3,3,6),acc); const a=k*Math.PI*2/3; pr.position.set(Math.cos(a)*11,Math.sin(a)*11,-1); prongs.add(pr); } g.add(prongs);
    g.userData.cord=cordEnd; return g; }
  releaseLaunchers(){ this.clearPreview(); this.liftY=0; (this.beys||[]).forEach(v=>{ if(v.launcher){ v.launcher.userData.fly=0.01; } }); this.camFx=null; }
  clearLaunchers(){ (this.beys||[]).forEach(v=>{ if(v.launcher){ v.root.remove(v.launcher); v.launcher=null; } }); }
  intro(){ if(!this.camBase||document.documentElement.classList.contains('reduce-motion')) return; const R=this.R||190; this.camFx={kind:'intro',t:0,dur:1.9,from:new T.Vector3(R*1.6,-R*0.9,R*0.55)}; }
  focus(x,y,z,dur){ this.camFx={kind:'focus',t:0,dur:dur||1.6,at:new T.Vector3(x,y,z||0),from:this.cc?this.cc.pos.clone():null,fromLook:this.cc?this.cc.look.clone():null}; }
  camPose(dt){
    const B=this.camBase; if(!B) return null; const f=this.camFx; if(!f) return {pos:B.pos,look:B.look};
    f.t+=dt; const u=Math.min(1,f.t/f.dur), e=u<0.5?2*u*u:1-Math.pow(-2*u+2,2)/2;
    let pos, look;
    if(f.kind==='hold'){ const close=f.at.clone().add(new T.Vector3(0,-1,0.85).normalize().multiplyScalar(f.dist||180));
      const p=B.pos.clone().lerp(close,e), l=B.look.clone().lerp(f.at,e); if(u>=1){ f.t=f.dur; } return {pos:p,look:l}; }
    if(f.kind==='back'){ return {pos:f.fromPos.clone().lerp(B.pos,e),look:f.fromLook.clone().lerp(B.look,e)}; }
    if(f.kind==='intro'){ const a=(1-e)*1.2; const p0=f.from.clone().applyAxisAngle(new T.Vector3(0,0,1),a); pos=p0.lerp(B.pos,e); look=B.look; }
    else { const k=Math.sin(u*Math.PI), p0=f.from||B.pos, l0=f.fromLook||B.look; pos=p0.clone().lerp(f.at.clone().add(new T.Vector3(0,-70,95)),0.62*Math.min(1,k*1.6)); look=l0.clone().lerp(f.at,Math.min(1,k*1.6)); }
    if(u>=1) this.camFx=null;
    return {pos,look};
  }
  // ---------- in-fight cameras (Settings → Camera) ----------
  camMode(){ if(document.documentElement.classList.contains('reduce-motion')) return 'overhead'; return (BF.Settings&&BF.Settings.get('camera'))||'action'; }
  battleCam(snap,dt){
    const B=this.camBase, mode=this.camMode(); if(!B||!snap||mode==='overhead') return B?{pos:B.pos,look:B.look}:null;
    const live=snap.b.filter(s=>s[7]); const list=live.length?live:snap.b; const R=this.R||190, cam=this.camera, portrait=cam.aspect<1;
    const cx=list.reduce((a,s)=>a+s[0],0)/list.length, cy=list.reduce((a,s)=>a+s[1],0)/list.length;
    let sep=0; list.forEach(s=>{ sep=Math.max(sep,Math.hypot(s[0]-cx,s[1]-cy)); });
    const v=cam.fov*Math.PI/360, h=Math.atan(Math.tan(v)*cam.aspect), fit=Math.min(Math.tan(v),Math.tan(h));
    this.camT=(this.camT||0)+dt;
    if(mode==='follow'){ const me=snap.b[this.meIdx||0]||list[0], o=snap.b.find((s,i)=>i!==(this.meIdx||0)&&s[7])||[0,0], dx=me[0]-o[0], dy=me[1]-o[1], d=Math.hypot(dx,dy)||1; const back=R*0.62;
      return {pos:new T.Vector3(me[0]+dx/d*back,me[1]+dy/d*back,R*0.72),look:new T.Vector3(me[0]-dx/d*30,me[1]-dy/d*30,6)}; }
    if(mode==='broadcast'){ this.camCut=(this.camCut||0)-dt; if(this.camCut<=0){ this.camCut=5+Math.random()*3; this.camAng=Math.random()*TAU; this.cc=null; }
      const a=this.camAng+this.camT*0.09, d=R*(1.55+0.25*Math.sin(this.camT*0.4)); return {pos:new T.Vector3(Math.cos(a)*d,Math.sin(a)*d,R*0.78),look:new T.Vector3(cx*0.8,cy*0.8,4)}; }
    // action: keep every Bey framed, push in when they're close
    const tilt=portrait?0.66:1.0, need=(sep+R*0.42)/fit, dist=Math.max(R*(portrait?1.55:1.3),Math.min(need,R/fit*1.05)), side=Math.sin(this.camT*0.17)*0.16;
    const look=new T.Vector3(cx*0.72,cy*0.72,4);
    return {pos:new T.Vector3(look.x+Math.sin(side)*Math.sin(tilt)*dist,look.y-Math.cos(side)*Math.sin(tilt)*dist,look.z+Math.cos(tilt)*dist),look}; }
  // launch preview: glowing path, landing ring and an arrow at the end
  setPreview(pts,color){ this.clearPreview(); if(!pts||pts.length<3) return; const g=new T.Group(), c=color||0xffe600, top=pts.map(p=>new T.Vector3(p[0],p[1],p[2]+5));
    const tube=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(top),Math.min(120,pts.length*3),1.25,6,false),new T.MeshBasicMaterial({color:c,transparent:true,opacity:0.92,depthTest:false,depthWrite:false})); tube.renderOrder=6; g.add(tube);
    const ring=new T.Mesh(new T.RingGeometry(16,20,48),new T.MeshBasicMaterial({color:c,transparent:true,side:T.DoubleSide,depthTest:false,depthWrite:false})); ring.position.copy(top[0]); ring.renderOrder=6; g.add(ring);
    const dot=new T.Mesh(new T.CircleGeometry(5,24),ring.material.clone()); dot.position.copy(top[0]); dot.renderOrder=6; g.add(dot);
    const end=top[top.length-1], pre=top[top.length-2], cone=new T.Mesh(new T.ConeGeometry(6,16,14),new T.MeshBasicMaterial({color:c,depthTest:false,depthWrite:false,transparent:true})); cone.position.copy(end); cone.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(pre).normalize()); cone.renderOrder=6; g.add(cone);
    this.preview=g; this.scene.add(g); }
  clearPreview(){ if(!this.preview) return; this.scene.remove(this.preview); this.preview.traverse(o=>{ if(o.geometry) o.geometry.dispose(); if(o.material) o.material.dispose(); }); this.preview=null; }
  project(x,y,z){ const v=new T.Vector3(x,y,z).project(this.camera), r=this.el.getBoundingClientRect(); return {x:(v.x+1)/2*r.width,y:(1-v.y)/2*r.height}; }
  punch(x,y,z,amt,dur){ if(document.documentElement.classList.contains('reduce-motion')) return; amt*=BF.feel('zoom'); if(amt<=0) return; this.kick={at:new T.Vector3(x,y,z||0),t:0,dur:dur||0.4,amt}; }
  // ---------- impact: sparks, flash, shockwave, light and shake, scaled by tier 0..3 ----------
  impact(x,y,z,tier,color){
    const on=this.partOn(), c=new T.Color(color||0xffe08a), F=BF.feel('sparks');
    const N=Math.round([6,13,26,46][tier]*F), sp=[150,250,380,560][tier];
    if(on){ _streakG=_streakG||new T.BoxGeometry(1,1,1); for(let i=0;i<N&&this.sparks.length<280;i++){ const a=Math.random()*TAU, s=sp*(0.35+Math.random()*0.85), m=new T.Mesh(_streakG,new T.MeshBasicMaterial({color:i%4?c:0xffffff,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));
        m.position.set(x,y,z+7); m.userData={vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:30+Math.random()*sp*0.75,life:0.16+Math.random()*(0.2+tier*0.09),grav:760,streak:1,shared:1,w:0.65+tier*0.16}; m.userData.max=m.userData.life; this.scene.add(m); this.sparks.push(m); } }
    if(tier>=1&&F>0){ const sprite=new T.Sprite(new T.SpriteMaterial({map:softTex(),color:c,transparent:true,blending:T.AdditiveBlending,depthTest:false,depthWrite:false})); sprite.position.set(x,y,z+9); const life=[0,0.1,0.14,0.22][tier];
      sprite.userData={flash:1,sprite:1,life,max:life,size:[0,46,88,170][tier]}; sprite.scale.setScalar(sprite.userData.size*0.6); this.scene.add(sprite); this.fx.push(sprite);
      for(let r=0;r<(tier===3?3:tier===2?2:1);r++){ const ring=new T.Mesh(new T.RingGeometry(0.965,1,96),new T.MeshBasicMaterial({color:c,transparent:true,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false})); ring.position.set(x,y,z+2); const l2=0.28+r*0.1+tier*0.04; ring.userData={ring:1,life:l2,max:l2,grow:[0,44,90,190][tier]*(1+r*0.45)}; ring.scale.setScalar(5); this.scene.add(ring); this.fx.push(ring); } }
    this.hitL.position.set(x,y,z+24); this.hitL.color.copy(c); this.hitL.intensity=Math.max(this.hitL.intensity,[0.6,2,4.5,9][tier]);
    this.shake=Math.min(16,this.shake+[0.15,1.1,3.2,8][tier]*BF.feel('shake'));
    if(tier===3&&this.room&&this.room.userData.pulse) this.room.userData.pulse();
  }
  // knocked out: the Bey flies out of the stadium. Spun out: it topples over.
  koFx(i,kind,e){ const v=this.beys[i]; if(!v) return; if(kind==='stop'){ v.ko={k:'topple',t:0,dir:Math.random()*TAU}; return; }
    const sp=Math.hypot(e.vx||0,e.vy||0)||1, s=Math.max(sp,430), p=v.root.position; v.ko={k:'fly',t:0,x:e.x==null?p.x:e.x,y:e.y==null?p.y:e.y,z:p.z,vx:(e.vx||0)/sp*s*0.95,vy:(e.vy||0)/sp*s*0.95,vz:kind==='xtreme'?360:270}; }
  // spin steal: sparks stream from the loser into the winner
  stealFx(from,to){ const a=this.beys[from], b=this.beys[to]; if(!a||!b||!this.partOn()) return; const pa=a.root.position, pb=b.root.position; for(let q=0;q<10;q++){ const f=0.55+Math.random()*0.5; this.particle(pa.x,pa.y,pa.z+8,(pb.x-pa.x)*2.3*f,(pb.y-pa.y)*2.3*f,50+Math.random()*50,0.42,0x7fe9ff,1.0,160); } }
  setup(stadium, f1, f2, f3){
    this.cc=null; this.kick=null; this.camT=0; this.camCut=0; this.clearPreview();
    if(this.room){ this.scene.remove(this.room); this.room=null; } const roomQ=!BF.Settings||BF.Settings.get('quality'); if(BF.buildRoom&&roomQ!=='low'){ this.room=BF.buildRoom(stadium.diameter/2,roomQ==='high'||roomQ===true); this.scene.add(this.room); }
    if(this.stadiumMesh){ this.scene.remove(this.stadiumMesh); }
    this.beys.forEach(b=>{ if(b){ this.scene.remove(b.root); if(b.trail){ this.scene.remove(b.trail); b.trail.geometry.dispose(); } } }); this.live=false;
    this.R=stadium.diameter/2; this.stadium=stadium;
    this.stadiumMesh=BF.buildStadium(stadium.kind, stadium.diameter, stadium.terrain); this.scene.add(this.stadiumMesh);
    const COLS=[0x2ef2ff,0xff2e88,0xffb020];
    this.beys=[f1,f2,f3].filter(Boolean).map((f,fi)=>{ const root=new T.Group(), tilt=new T.Group(), spin=beyGroup(f.asm); tilt.add(spin); root.add(tilt); this.scene.add(root);
      if(f.scale) spin.scale.setScalar(f.scale);
      const ring=new T.Mesh(new T.RingGeometry(f.R+2,f.R+4.5,48),new T.MeshBasicMaterial({color:COLS[fi],transparent:true,opacity:0.7})); ring.position.z=0.6; root.add(ring);
      const v={root,tilt,spin,ring,f,cos:(c=>BF.Live?BF.Live.resolveCos(c):c)(Object.assign({trail:'none',launch:'none',aura:'none',win:'confetti'},f.d.cos||{})),trailPts:[]};
      v.color=new T.Color((v.cos.trailColor)||(f.d.paint&&f.d.paint.blade.color)||'#2ef2ff');
      // aura: soft glow disc under the Bey
      const aura=new T.Mesh(new T.PlaneGeometry(f.R*4.2,f.R*4.2),new T.MeshBasicMaterial({map:glowTex(),color:v.cos.auraColor?new T.Color(v.cos.auraColor):v.cos.aura==='flame'?0xff6a1a:v.color,transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:T.AdditiveBlending}));
      aura.position.z=1; aura.renderOrder=2; root.add(aura); v.aura=aura;
      // trail: a fading line of recent positions
      const tg=new T.BufferGeometry(); tg.setAttribute('position',new T.BufferAttribute(new Float32Array(60*3),3)); tg.setAttribute('color',new T.BufferAttribute(new Float32Array(60*3),3)); tg.setDrawRange(0,0);
      const trail=new T.Line(tg,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.9,blending:T.AdditiveBlending,depthWrite:false})); this.scene.add(trail); v.trail=trail;
      return v; });
    this.frame();
  }
  spark(x,y,z,power,color){
    const n=this.partOn()?Math.min(26,6+Math.floor(power/350)):0;
    for(let i=0;i<n;i++){ const m=new T.Mesh(new T.SphereGeometry(0.9,6,4),new T.MeshBasicMaterial({color:color||0xffe08a}));
      const a=Math.random()*TAU, s=60+Math.random()*220*Math.min(2,power/2500); m.position.set(x,y,z+8);
      m.userData={vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:40+Math.random()*120,life:0.35+Math.random()*0.35}; this.scene.add(m); this.sparks.push(m); }
    this.shake=Math.min(6,this.shake+power/1800);
  }
  // screen point -> stadium floor point (for tap-to-lean)
  pick(cx,cy){ const r=this.el.getBoundingClientRect(); const v=new T.Vector2(((cx-r.left)/r.width)*2-1, -((cy-r.top)/r.height)*2+1);
    const rc=new T.Raycaster(); rc.setFromCamera(v,this.camera); const out=new T.Vector3();
    if(!rc.ray.intersectPlane(new T.Plane(new T.Vector3(0,0,1),-6),out)) return null; const d=Math.hypot(out.x,out.y), lim=(this.R||190)*0.95;
    if(d>lim){ out.x*=lim/d; out.y*=lim/d; } return {x:out.x,y:out.y}; }
  marker(x,y,c){ const m=new T.Mesh(new T.RingGeometry(0.8,1,48),new T.MeshBasicMaterial({color:c,transparent:true,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}));
    m.position.set(x,y,8); m.userData={ring:true,life:0.5,max:0.5,grow:36}; m.scale.setScalar(4); this.scene.add(m); this.fx.push(m); }
  lightning(){ const R=this.R||190, a=Math.random()*TAU, r=Math.random()*R*0.8, x0=Math.cos(a)*r, y0=Math.sin(a)*r; const pts=[]; let x=x0+(Math.random()-0.5)*60, y=y0+(Math.random()-0.5)*60;
    for(let z=320;z>=0;z-=28){ pts.push(new T.Vector3(x,y,z)); x+=(x0-x)*0.25+(Math.random()-0.5)*30; y+=(y0-y)*0.25+(Math.random()-0.5)*30; } pts.push(new T.Vector3(x0,y0,1));
    const m=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:0xfff6b0,transparent:true,blending:T.AdditiveBlending,depthWrite:false})); m.userData={life:0.35,max:0.35}; this.scene.add(m); this.fx.push(m);
    this.spark(x0,y0,2,2500,0xffd21f); this.shake=Math.min(6,(this.shake||0)+2); }
  moveFx(i,c){ const v=this.beys[i]; if(!v) return; const p=v.root.position;
    [0,0.12].forEach(dl=>setTimeout(()=>{ const m=new T.Mesh(new T.RingGeometry(0.965,1,96),new T.MeshBasicMaterial({color:c,transparent:true,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}));
      m.position.set(p.x,p.y,p.z+2); m.userData={ring:true,life:0.6,max:0.6,grow:140}; this.scene.add(m); this.fx.push(m); },dl*1000));
    if(this.partOn()) for(let q=0;q<28;q++){ const a=q/28*TAU, s=90+Math.random()*90; this.particle(p.x,p.y,p.z+6,Math.cos(a)*s,Math.sin(a)*s,60+Math.random()*80,0.6,c,1.3,200); }
    this.shake=Math.min(5,(this.shake||0)+1.5); }

  cosOn(){ return !BF.Settings||BF.Settings.get('cosmetics'); }
  partOn(){ return !BF.Settings||BF.Settings.get('particles'); }
  particle(x,y,z,vx,vy,vz,life,color,size,grav){
    const m=new T.Mesh(new T.SphereGeometry(size||0.9,6,4),new T.MeshBasicMaterial({color,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));
    m.position.set(x,y,z); m.userData={vx,vy,vz,life,max:life,grav:grav??600}; this.scene.add(m); this.sparks.push(m);
  }
  updateTrail(v,x,y,z,alive,dt,dash){
    const rail=dash&&alive, kind=rail?'ribbon':v.cos.trail, on=rail||(this.cosOn()&&kind!=='none'&&alive);
    if(!alive){ v.trailPts.length=0; } else { v.trailPts.unshift([x,y,z+3]); if(v.trailPts.length>60) v.trailPts.pop(); }
    const pos=v.trail.geometry.attributes.position, col=v.trail.geometry.attributes.color, n=on&&(kind==='ribbon'||kind==='lightning'||kind==='rainbow')?v.trailPts.length:0;
    const t=performance.now()/1000;
    for(let i=0;i<n;i++){ const p=v.trailPts[i]; let jx=0,jy=0; if(kind==='lightning'){ jx=(Math.random()-0.5)*5; jy=(Math.random()-0.5)*5; }
      pos.setXYZ(i,p[0]+jx,p[1]+jy,p[2]); const f=1-i/n; const c=kind==='rainbow'?new T.Color().setHSL((t*0.5+i/40)%1,1,0.55):rail?_railC:v.color; col.setXYZ(i,c.r*f,c.g*f,c.b*f); }
    pos.needsUpdate=true; col.needsUpdate=true; v.trail.geometry.setDrawRange(0,n);
    if(on && this.partOn() && (kind==='sparks'||kind==='fire') && Math.random()<dt*40){
      const fire=kind==='fire'; this.particle(x,y,z+4,(Math.random()-0.5)*40,(Math.random()-0.5)*40,fire?60+Math.random()*60:30,fire?0.45:0.3,fire?(Math.random()<0.5?0xff6a1a:0xffd21f):v.color.getHex(),fire?1.3:0.7,fire?-80:500); }
  }
  launchFx(i){
    const v=this.beys[i]; if(!v||!this.cosOn()) return; const p=v.root.position, c=v.color.getHex(), k=v.cos.launch;
    if(k==='ring'){ const m=new T.Mesh(new T.RingGeometry(0.965,1,96),new T.MeshBasicMaterial({color:c,transparent:true,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false,depthTest:false})); m.position.set(p.x,p.y,p.z+1); m.userData={ring:true,life:0.7,max:0.7,grow:150}; this.scene.add(m); this.fx.push(m); }
    if(k==='spiral'&&this.partOn()) for(let q=0;q<36;q++){ const a=q/36*TAU*2, s=80+q*4; this.particle(p.x,p.y,p.z+2,Math.cos(a)*s,Math.sin(a)*s,40+q*3,0.7,c,1.1,120); }
    if(k==='petals'&&this.partOn()) for(let q=0;q<30;q++){ const a=Math.random()*TAU, s=60+Math.random()*120; this.particle(p.x,p.y,p.z+4,Math.cos(a)*s,Math.sin(a)*s,120+Math.random()*80,1.1,q%2?0xffb7e0:c,1.4,220); }
    if(k==='lightning'){ const pts=[]; let x=p.x,y=p.y; for(let z=260;z>=p.z;z-=26){ pts.push(new T.Vector3(x,y,z)); x+=(Math.random()-0.5)*26; y+=(Math.random()-0.5)*26; } pts.push(new T.Vector3(p.x,p.y,p.z));
      const m=new T.Line(new T.BufferGeometry().setFromPoints(pts),new T.LineBasicMaterial({color:c,transparent:true,blending:T.AdditiveBlending})); m.userData={life:0.35,max:0.35}; this.scene.add(m); this.fx.push(m); this.shake=Math.min(6,this.shake+3); }
  }
  winFx(i){
    const v=this.beys[i]; if(!v||!this.cosOn()) return; const p=v.root.position, c=v.color.getHex(), k=v.cos.win;
    const cols=[0x2ef2ff,0xff2e88,0xffd21f,0x3fe08a,0xa07bff,c];
    if(k==='confetti'&&this.partOn()) for(let q=0;q<80;q++){ const a=Math.random()*TAU, s=40+Math.random()*160; this.particle(p.x,p.y,p.z+10,Math.cos(a)*s,Math.sin(a)*s,200+Math.random()*200,1.6,cols[q%cols.length],1.2,420); }
    if(k==='fireworks'&&this.partOn()) [0,1,2].forEach(b=>setTimeout(()=>{ const ox=p.x+(Math.random()-0.5)*120, oy=p.y+(Math.random()-0.5)*120, oz=120+Math.random()*80, col=cols[(b*2+i)%cols.length];
      for(let q=0;q<40;q++){ const a=Math.random()*TAU, e=Math.random()*Math.PI-Math.PI/2, s=90+Math.random()*60; this.particle(ox,oy,oz,Math.cos(a)*Math.cos(e)*s,Math.sin(a)*Math.cos(e)*s,Math.sin(e)*s,1.2,col,1.3,120); } },b*280));
    if(k==='spotlight'){ const m=new T.Mesh(new T.CylinderGeometry(6,v.f.R*2.2,320,32,1,true),new T.MeshBasicMaterial({color:c,transparent:true,opacity:0.25,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false})); m.rotateX(Math.PI/2); m.position.set(p.x,p.y,p.z+160); m.userData={life:2.2,max:2.2,fade:true}; this.scene.add(m); this.fx.push(m); }
    if(k==='shockwave'){ [0,0.15,0.3].forEach(dl=>setTimeout(()=>{ const m=new T.Mesh(new T.RingGeometry(0.965,1,96),new T.MeshBasicMaterial({color:c,transparent:true,side:T.DoubleSide,blending:T.AdditiveBlending,depthWrite:false,depthTest:false})); m.position.set(p.x,p.y,p.z+1); m.userData={ring:true,life:0.9,max:0.9,grow:260}; this.scene.add(m); this.fx.push(m); },dl*1000)); this.shake=Math.min(6,this.shake+2); }
  }
  render(snap,dt){
    if(snap){ snap.b.forEach((s,i)=>{ const v=this.beys[i]; if(!v) return; const [x,y,z,ang,w,w0,tilt,alive,burst,dash]=s;
      v.root.visible=!burst; v.root.position.set(x,y,z);
      this.updateTrail(v,x,y,z,alive&&!burst&&this.live,dt,dash);
      const ak=v.cos.aura, tt=performance.now()/1000; v.aura.material.opacity = this.cosOn()&&alive&&ak!=='none' ? (ak==='pulse'?0.18+0.14*Math.sin(tt*6+i):ak==='flame'?0.2+Math.random()*0.12:0.22)*(w/(w0||1)) : 0;
      // wobble: precession speeds up as spin dies, then the rim starts to scrape
      v.prec=(v.prec||0)+dt*(2.2+8*Math.min(1,tilt)); const wob=tilt*0.62*(1+0.14*Math.sin(v.prec*3.7)), rr=Math.hypot(x,y)||1, ln=dash?0.26:0;
      let rx=Math.sin(v.prec)*wob+(y/rr)*ln, ry=Math.cos(v.prec)*wob-(x/rr)*ln;
      if(tilt>0.55&&alive&&this.partOn()&&this.live&&Math.random()<dt*22){ const a=-v.prec+Math.PI/2; this.particle(x+Math.cos(a)*v.f.R*0.8,y+Math.sin(a)*v.f.R*0.8,z+3,(Math.random()-0.5)*90,(Math.random()-0.5)*90,50+Math.random()*60,0.3,0xffc36a,0.75,520); }
      if(dash&&alive&&this.live&&this.partOn()){ for(let q=0;q<2;q++) this.particle(x+(Math.random()-0.5)*8,y+(Math.random()-0.5)*8,z+3,(x/rr)*(90+Math.random()*90)+(Math.random()-0.5)*60,(y/rr)*(90+Math.random()*90)+(Math.random()-0.5)*60,50+Math.random()*70,0.32,q?0xffe600:0xffffff,0.95,520); }
      if(v.ko){ const K=v.ko; K.t+=dt; if(K.k==='fly'){ K.vz-=980*dt; K.x+=K.vx*dt; K.y+=K.vy*dt; K.z+=K.vz*dt; if(K.z<-5&&K.vz<0){ K.z=-5; K.vz=-K.vz*0.38; K.vx*=0.72; K.vy*=0.72; } v.root.position.set(K.x,K.y,K.z); rx=K.t*7.3; ry=K.t*4.1; v.ring.visible=false; }
        else { const u=Math.min(1,K.t/0.55), e=u*u*(3-2*u)*1.42; rx=Math.cos(K.dir)*e; ry=Math.sin(K.dir)*e; v.ring.visible=false; } } else v.ring.visible=true;
      v.tilt.rotation.set(rx,ry,0);
      v.spin.rotation.z=ang; v.ring.material.opacity=alive?(dash?1:0.55):0.15; v.ring.scale.setScalar(dash?1.25:1);
    }); }
    (this.beys||[]).forEach(v=>{ const L=v.launcher; if(!L) return; if(L.userData.fly){ L.userData.fly+=dt; L.position.z+=dt*260; L.rotation.z+=dt*4; L.traverse(o=>{ if(o.material){ o.material.transparent=true; o.material.opacity=Math.max(0,1-L.userData.fly*2); } }); if(L.userData.fly>0.6){ v.root.remove(L); v.launcher=null; } }
      else if(L.userData.cord&&L.userData.pull!=null) L.userData.cord.position.x=36+L.userData.pull*40; });
    const anims=this.stadiumMesh&&this.stadiumMesh.userData.anims; if(anims){ const tt=snap&&snap.t!=null&&this.live?snap.t:performance.now()/1000; anims.forEach(f=>f(tt)); }
    for(let i=this.fx.length-1;i>=0;i--){ const m=this.fx[i], u=m.userData; u.life-=dt; const f=Math.max(0,u.life/u.max);
      if(u.ring){ m.scale.setScalar(8+(1-f)*u.grow); } if(u.flash){ m.scale.setScalar(u.size*(0.55+0.65*(1-f))); } m.material.opacity=(u.fade?0.25:1)*f;
      if(u.life<=0){ this.scene.remove(m); if(!u.sprite) m.geometry.dispose(); m.material.dispose(); this.fx.splice(i,1); } }
    for(let i=this.sparks.length-1;i>=0;i--){ const m=this.sparks[i], u=m.userData; u.life-=dt; u.vz-=(u.grav??600)*dt; m.position.x+=u.vx*dt; m.position.y+=u.vy*dt; m.position.z+=u.vz*dt; if(u.streak){ if(m.position.z<1&&u.vz<0){ m.position.z=1; u.vz=-u.vz*0.45; u.vx*=0.7; u.vy*=0.7; } const f=Math.max(0.05,u.life/u.max), sp=Math.hypot(u.vx,u.vy,u.vz); m.scale.set(u.w*f,u.w*f,Math.max(1,sp*0.028)*f+0.6); _tv.set(m.position.x+u.vx,m.position.y+u.vy,m.position.z+u.vz); m.lookAt(_tv); } else m.scale.setScalar(Math.max(0.1,u.max?u.life/u.max*1.5:u.life*2.5)); if(m.material.opacity!==undefined&&u.max) m.material.opacity=Math.min(1,u.life/u.max*1.5);
      if(u.life<=0){ this.scene.remove(m); if(!u.shared) m.geometry.dispose(); m.material.dispose(); this.sparks.splice(i,1); } }
    const cam=this.camera; let pose=this.camFx?this.camPose(dt):(this.live?this.battleCam(snap,dt):this.camPose(dt));
    if(pose&&this.liftY&&!this.live){ pose={pos:pose.pos.clone(),look:pose.look.clone()}; pose.pos.y-=this.liftY; pose.look.y-=this.liftY; }
    if(pose){ if(!this.cc) this.cc={pos:pose.pos.clone(),look:pose.look.clone()}; else { const calm=document.documentElement.classList.contains('reduce-motion'), k=calm?1:1-Math.exp(-dt*(this.camFx?12:this.live?3.6:6)); this.cc.pos.lerp(pose.pos,k); this.cc.look.lerp(pose.look,k); }
      let look=this.cc.look; cam.position.copy(this.cc.pos);
      if(this.kick){ const K=this.kick; K.t+=dt; const u=K.t/K.dur; if(u>=1) this.kick=null; else { const w=Math.sin(Math.min(1,u*2.4)*Math.PI*0.5)*(1-u)*1.4*K.amt; cam.position.lerp(K.at,w); look=look.clone().lerp(K.at,w); } }
      cam.lookAt(look); }
    this.hitL.intensity*=Math.pow(0.0006,dt); if(this.room&&this.room.userData.tick) this.room.userData.tick(performance.now()/1000,dt);
    const base=cam.position.clone();
    if(BF.Settings&&!BF.Settings.get('shake')) this.shake=0;
    if(this.shake>0.05){ cam.position.x+=(Math.random()-0.5)*this.shake; cam.position.y+=(Math.random()-0.5)*this.shake; cam.position.z+=(Math.random()-0.5)*this.shake*0.5; this.shake*=Math.pow(0.012,dt); }
    BF.HD.render(this,this.renderer,this.scene,cam); cam.position.copy(base);
  }
  burstFx(i){ const v=this.beys[i]; if(!v) return; const p=v.root.position;
    v.f.asm.parts.forEach((part,k)=>{ const g=beyGroup({...v.f.asm,parts:[part]}); g.position.copy(p); g.position.z+=part.z0+6; this.scene.add(g);
      const a=Math.random()*TAU, s=170+Math.random()*190; g.userData={vx:Math.cos(a)*s,vy:Math.sin(a)*s,vz:300+k*70+Math.random()*110,spin:(Math.random()<0.5?-1:1)*(16+Math.random()*16)};
      this.debris=(this.debris||[]); this.debris.push(g); });
    this.impact(p.x,p.y,p.z,3,0xff5aa5); this.spark(p.x,p.y,p.z,6000,0xffd21f); this.punch(p.x,p.y,p.z,0.42,0.75);
  }
  tickDebris(dt){ (this.debris||[]).forEach(g=>{ const u=g.userData; u.vz-=700*dt; g.position.x+=u.vx*dt; g.position.y+=u.vy*dt; g.position.z=Math.max(this.stadium.depth*Math.min(Math.hypot(g.position.x,g.position.y),this.R)**2/this.R, g.position.z+u.vz*dt); if(g.position.z<=0.1+this.stadium.depth*Math.hypot(g.position.x,g.position.y)**2/this.R){ u.vx*=0.9; u.vy*=0.9; u.vz=Math.abs(u.vz)*0.3; } g.rotation.z+=u.spin*dt; g.rotation.x+=u.spin*0.3*dt; }); }
  clearDebris(){ (this.debris||[]).forEach(g=>this.scene.remove(g)); this.debris=[]; (this.beys||[]).forEach(v=>{ if(v) v.ko=null; }); }
};
})();
