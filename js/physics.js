/* BeyForge — physics stats + print checks */
(function(){
'use strict';
const BF=window.BF, {clamp}=BF.util;
const SHAPE_DEF={hammer:.95,ring:.85,round:.65,fin:.4,spike:.3,saw:.3,blade:.3,claw:.25};
const SHAPE_AGG={blade:.9,claw:1,saw:.85,fin:.72,spike:.78,hammer:.4,round:.18,ring:.05};
const G=9.81;

// friction torque model calibrated so a ball tip ~2 min, flat ~20-30 s, rubber ~10-15 s for a typical build
function tipFriction(tip){ return tip.mu*(0.6+0.35*tip.rc)*0.56e-3; } // effective lever (m) times mu

BF.spinTime = function(Izz_gmm2, M_g, tip, R, rough, launch){
  const I=Izz_gmm2*1e-9, M=M_g/1000;
  const a=M*G*tipFriction(tip);                         // N·m, constant friction torque
  const b=3e-12*(1+6*rough)*Math.pow(R/23,5);           // N·m·s², air drag
  const w0=600*(launch||1), wMin=70;                    // rad/s; below wMin it wobbles out
  const k=Math.sqrt(b/a);
  return I/Math.sqrt(a*b)*(Math.atan(w0*k)-Math.atan(wMin*k));
};

// overhang area (mm²) in print orientation. Faces buried inside another body (overlaps) are skipped
// using a downward winding-number ray test against a coarse XY grid.
function overhangArea(part){
  let zmin=Infinity, zmax=-Infinity;
  part.bodies.forEach(b=>{ const p=b.geo.attributes.position.array; for(let i=2;i<p.length;i+=3){ zmin=Math.min(zmin,p[i]); zmax=Math.max(zmax,p[i]); } });
  const flip=part.printFlip, Z=z=>flip?zmax-z:z-zmin;
  const tris=[]; part.bodies.forEach(b=>{ const p=b.geo.attributes.position.array; for(let i=0;i<p.length;i+=9) { const Y=y=>flip?-y:y; tris.push([p[i],Y(p[i+1]),Z(p[i+2]),p[i+3],Y(p[i+4]),Z(p[i+5]),p[i+6],Y(p[i+7]),Z(p[i+8])]); } });
  const C=2, grid=new Map(), key=(x,y)=>x+','+y;
  tris.forEach((t,ix)=>{ const x0=Math.floor(Math.min(t[0],t[3],t[6])/C), x1=Math.floor(Math.max(t[0],t[3],t[6])/C), y0=Math.floor(Math.min(t[1],t[4],t[7])/C), y1=Math.floor(Math.max(t[1],t[4],t[7])/C);
    for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++){ const k=key(x,y); let l=grid.get(k); if(!l) grid.set(k,l=[]); l.push(ix); } });
  const inside=(px,py,pz)=>{ const l=grid.get(key(Math.floor(px/C),Math.floor(py/C))); if(!l) return false; let w=0;
    for(const ix of l){ const t=tris[ix]; const ax=t[0],ay=t[1],bx=t[3],by=t[4],cx=t[6],cy=t[7];
      const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy); if(Math.abs(den)<1e-12) continue;
      const u=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/den, v=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/den, w3=1-u-v;
      if(u<0||v<0||w3<0) continue; const z=u*t[2]+v*t[5]+w3*t[8]; if(z>=pz) continue;
      const nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax); w+= nz<0?1:-1; }
    return w>0; };
  let area=0;
  for(const t of tris){
    const ux=t[3]-t[0],uy=t[4]-t[1],uz=t[5]-t[2], vx=t[6]-t[0],vy=t[7]-t[1],vz=t[8]-t[2];
    const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, len=Math.hypot(nx,ny,nz); if(len<1e-9) continue;
    if(nz/len >= -0.72 || Math.min(t[2],t[5],t[8])<=0.3) continue;
    const cx=(t[0]+t[3]+t[6])/3, cy=(t[1]+t[4]+t[7])/3, cz=(t[2]+t[5]+t[8])/3;
    if(inside(cx+0.013,cy+0.007,cz-0.08)) continue;
    area+=len/2;
  }
  return area;
}

BF.analyze = function(asm, mp){
  const d=asm.d, isB=asm.isB, blade=asm.parts[0], bm=blade.meta;
  const tip=BF.TIPS[d.bit.tip]||BF.TIPS.flat;
  const R=bm.R, rs=bm.rs; let mean=0; rs.forEach(r=>mean+=r); mean/=rs.length;
  let v=0; rs.forEach(r=>v+=(r-mean)*(r-mean)); const rough=Math.sqrt(v/rs.length)/R;
  const protrusion=(R-bm.Rcore)/R;
  const M=mp.mass, Izz=mp.Izz;
  const spin=BF.spinTime(Izz,M,tip,R,rough,1);
  const gear=!isB && d.bit.gear;
  const W=Math.round(d.blade.wings);
  let agg=(SHAPE_AGG[d.blade.shape] ?? (d.blade.shape==='custom'? customAgg(d.blade.custom):.5));
  agg*=clamp(protrusion/0.42,0,1.3)*clamp(1.2-0.05*W,0.75,1.15)*(1+clamp(d.blade.slope,0,30)/120);
  if(d.spin==='dual') agg*=0.9;
  const heavy=clamp(M/35,0,1.2);
  const roundness=clamp(1-rough*7,0,1);
  const comH=mp.com[2];
  const stats={
    attack:  clamp(0.48*agg+0.3*tip.mob+(gear?0.12:0)+0.1*heavy,0,1),
    defense: clamp(0.27*heavy+0.18*roundness+0.22*tip.grip+0.18*(SHAPE_DEF[d.blade.shape]??.45)+0.15*clamp(1-(comH-8)/14,0,1),0,1),
    stamina: clamp(1-Math.exp(-spin/95),0,1),
    burst:   isB ? clamp(0.18+0.13*d.lock.strength+0.03*d.lock.teeth-0.4*d.print.tolerance,0,1)
                 : clamp(0.35+0.05*d.ratchet.points+0.06*d.fit.xPlugH-0.4*d.print.tolerance,0,1),
    stability: clamp((1-mp.offset/0.35)*(0.75+0.25*clamp(1-(comH-8)/16,0,1)),0,1),
    speed:   clamp(0.55*tip.mob+0.2*tip.mu+(gear?0.25:0),0,1)
  };
  Object.keys(stats).forEach(k=>stats[k]=Math.round(stats[k]*100));
  const tri=[['attack',stats.attack],['defense',stats.defense],['stamina',stats.stamina]].sort((a,b)=>b[1]-a[1]);
  const type=(tri[0][1]-tri[1][1]<7 || d.spin==='dual') ? 'balance' : tri[0][0];
  return {stats, spin, type, rough, protrusion, checks:printChecks(asm,mp)};
};
function customAgg(c){ let peak=0,at=0; c.forEach((v,i)=>{ if(v>peak){peak=v;at=i;} }); return clamp(0.4+0.6*(1-at/(c.length-1))*peak,0,1); }

function printChecks(asm,mp){
  const d=asm.d, out=[]; const add=(lvl,cat,msg)=>out.push({lvl,cat,msg});
  const bm=asm.parts[0].meta, label=asm.parts[0].label.toLowerCase();
  // thin walls
  if(bm.tipZ<1.6) add('bad','Thin walls',`Wing tips are only ${bm.tipZ.toFixed(1)} mm thick — they'll snap on the first hit. Go 2 mm or more.`);
  else if(bm.tipZ<2.2) add('warn','Thin walls',`Wing tips are ${bm.tipZ.toFixed(1)} mm thick. Print with 4+ walls or bump them up.`);
  if(asm.isB && d.disc.thickness<2.5) add('warn','Thin walls',`Disc is ${d.disc.thickness} mm thick — use 100% infill so it doesn't flex.`);
  const tipW=d.bit.width/2;
  if(['needle','point'].includes(d.bit.tip) && tipW<1.2) add('info','Thin walls','Very fine tip — expect a slightly rounded point; light sanding cleans it up.');
  if(!asm.isB && d.bit.gear){ const bitR=asm.parts[2].meta.bodyR; const tooth=Math.PI*2*(bitR+1.9)/d.bit.gearTeeth/2; if(tooth<0.9) add('warn','Thin walls',`Gear teeth are ${tooth.toFixed(2)} mm wide — fewer teeth print cleaner.`); }
  add('info','Small features',`Locking tabs and keys are ~1.1–1.5 mm. Print the ${asm.isB?'driver and disc':'ratchet and bit'} at 100% infill with 0.12–0.16 mm layers.`);
  // overhangs
  asm.parts.forEach(p=>{ const a=overhangArea(p); if(a>12) add(a>60?'warn':'info','Overhangs',`${p.label}: ${a.toFixed(0)} mm² of steep overhang${p.printFlip?' (printed upside-down)':''} — turn on tree supports${p.id===asm.parts[0].id&&d.blade.slope<0?' or raise the contact angle':''}.`); });
  // balance
  if(mp.offset>0.15) add('bad','Balance',`Center of mass is ${mp.offset.toFixed(2)} mm off-axis — it'll wobble hard. Re-check per-wing sizes and pocket spacing.`);
  else if(mp.offset>0.05) add('warn','Balance',`Center of mass is ${mp.offset.toFixed(2)} mm off-axis — expect some wobble at low spin.`);
  // weight
  if(mp.mass<28) add('warn','Weight',`${mp.mass.toFixed(1)} g total. Official metal-weighted Beys are much heavier, roughly 30–50 g, so this will get bullied — add inserts or print a part in metal-fill.`);
  return out;
}
BF.printChecks=printChecks;
})();
