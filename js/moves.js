/* BeyForge v5 — elements (dual typing, matchups, status effects) and part-based moves (launch formations) */
(function(){
'use strict';
const BF=window.BF;

// ---------- elements ----------
BF.ELEMENTS = {
  fire:     {label:'Fire',      color:'#ff6a1a', icon:'🔥', strong:['ice','metal'],      status:'burn'},
  water:    {label:'Water',     color:'#2f8bff', icon:'💧', strong:['fire','earth'],     status:'freeze'},
  earth:    {label:'Earth',     color:'#b07a3a', icon:'⛰', strong:['lightning','fire'], status:'stagger'},
  wind:     {label:'Wind',      color:'#7fe0b4', icon:'🌪', strong:['earth','void'],     status:'knock'},
  lightning:{label:'Lightning', color:'#ffd21f', icon:'⚡', strong:['water','metal'],    status:'shock'},
  ice:      {label:'Ice',       color:'#9fe8ff', icon:'❄', strong:['wind','water'],     status:'freeze'},
  light:    {label:'Light',     color:'#fff4b8', icon:'✦', strong:['dark','void'],      status:'daze'},
  dark:     {label:'Dark',      color:'#8a3dff', icon:'☾', strong:['light','wind'],     status:'break'},
  metal:    {label:'Metal',     color:'#c8ced8', icon:'⚙', strong:['ice','light'],      status:'armor'},
  void:     {label:'Void',      color:'#ff2e88', icon:'◉', strong:['metal','earth'],    status:'break'}
};
BF.STATUS = {
  burn:   {label:'Burn',    color:'#ff6a1a', desc:'Loses spin faster'},
  freeze: {label:'Freeze',  color:'#9fe8ff', desc:'Slowed down'},
  shock:  {label:'Shock',   color:'#ffd21f', desc:'Wobbles and jitters'},
  stagger:{label:'Stagger', color:'#b07a3a', desc:'Tip loses grip'},
  break:  {label:'Break',   color:'#8a3dff', desc:'Burns closer to bursting'},
  daze:   {label:'Daze',    color:'#fff4b8', desc:'Can’t find its target'},
  knock:  {label:'Knock',   color:'#7fe0b4', desc:'Thrown extra far'},
  armor:  {label:'Armor',   color:'#c8ced8', desc:'Takes less damage'}
};
const ADV=1.25, RES=0.8;
// one attacking element vs a (possibly dual) defender
BF.elemVs = (a,defs)=>{ let m=1; (defs||[]).forEach(d=>{ if(BF.ELEMENTS[a].strong.includes(d)) m*=ADV; else if(BF.ELEMENTS[d]&&BF.ELEMENTS[d].strong.includes(a)) m*=RES; }); return m; };
// a dual-type attacker uses whichever of its types hits harder (Pokémon-style)
BF.elemMult = (atks,defs)=>{ if(!atks||!atks.length||!defs||!defs.length) return 1; return Math.max(...atks.map(a=>BF.elemVs(a,defs))); };

// each part leans toward an element
const SHAPE_EL={blade:'wind',claw:'dark',fin:'water',saw:'metal',spike:'lightning',hammer:'earth',round:'light',ring:'void',scythe:'dark',crescent:'ice',wave:'water',shield:'metal',arrow:'wind',twin:'lightning',horn:'earth',feather:'wind',fang:'fire',star:'light',custom:'void'};
const TIP_EL={flat:'fire',lowflat:'fire',rubber:'earth',gearflat:'lightning',rush:'wind',hexa:'earth',taper:'wind',point:'ice',ball:'water',orb:'water',needle:'ice',spike:'lightning',xtreme:'fire',dish:'light',unite:'light',level:'earth',bearing:'void',mode:'dark',custom:'void'};
const RATCHET_EL={3:'fire',4:'earth',5:'wind',6:'water',7:'lightning',8:'ice',9:'void'};
const DISC_EL={round:'metal',wing:'wind',octa:'earth',star:'light'};
BF.partElements = d=>({
  blade: SHAPE_EL[d.blade.shape]||'wind',
  core:  d.system==='X' ? (RATCHET_EL[d.ratchet.points]||'metal') : (DISC_EL[d.disc.shape]||'metal'),
  driver:TIP_EL[d.bit.tip]||'fire'
});
// the elements this Bey may take (from its parts), and the ones it actually has (player's pick, else auto)
BF.allowedElements = d=>[...new Set(Object.values(BF.partElements(d)))];
BF.elementsOf = d=>{
  const allowed=BF.allowedElements(d), pe=BF.partElements(d), pick=d.element||{};
  let p=allowed.includes(pick.p)?pick.p:null;
  if(!p){ const n={}; Object.values(pe).forEach(e=>n[e]=(n[e]||0)+1); p=Object.keys(n).sort((a,b)=>n[b]-n[a]||(a===pe.blade?-1:1))[0]; }
  const s=pick.s&&pick.s!==p&&allowed.includes(pick.s)?pick.s:null;
  return s?[p,s]:[p];
};

// ---------- moves ----------
// kinds: what the move does in the sim (BF.MOVE_FX). Each part gives 3 moves; the move's element is its part's element.
BF.MOVE_KINDS = {
  rush:    {desc:'Charges straight at the opponent — next hit throws them hard.', role:'attack'},
  upper:   {desc:'Next hit slams the ratchet: big burst damage and a wobble.', role:'attack'},
  barrage: {desc:'3 s of rapid hits that each drain extra spin.', role:'attack'},
  wall:    {desc:'3 s: takes far less knockback and burst damage.', role:'defense'},
  counter: {desc:'3 s: hits against you bounce back onto the attacker.', role:'defense'},
  steal:   {desc:'3 s: every hit steals spin from the opponent.', role:'stamina'},
  anchor:  {desc:'4 s: plants down — counts as nearly twice as heavy in clashes.', role:'defense'},
  lockguard:{desc:'Re-seats the ratchet: clears burst damage and blocks most of it for 4 s.', role:'defense'},
  recover: {desc:'Instantly regains some lost spin.', role:'stamina'},
  weight:  {desc:'3 s: shifts weight outward — hits harder.', role:'attack'},
  drive:   {desc:'2.5 s: tip bites in — huge speed around the stadium.', role:'attack'},
  sweep:   {desc:'2.5 s: carves along the rim and smashes anything in its path.', role:'attack'},
  zig:     {desc:'3 s: sharp unpredictable zig-zags toward the opponent.', role:'attack'},
  rocket:  {desc:'Instant rail-dash rocket, even off the rail.', role:'attack'},
  orbit:   {desc:'Quick sideways dash to dodge and reposition.', role:'defense'},
  center:  {desc:'4 s: locks into the center and barely loses spin.', role:'stamina'},
  eternal: {desc:'5 s: spin decay drops to a third.', role:'stamina'},
  gravity: {desc:'3 s: pulls the opponent toward you.', role:'attack'}
};
const BLADE_MOVES={
  blade:[['rush','Blade Rush'],['upper','Rising Edge'],['barrage','Edge Barrage']],
  claw:[['upper','Hook Upper'],['steal','Claw Drain'],['barrage','Rending Claws']],
  fin:[['counter','Fin Deflect'],['steal','Riptide Drain'],['rush','Fin Charge']],
  saw:[['barrage','Buzzsaw'],['rush','Saw Rush'],['upper','Grind Upper']],
  spike:[['rush','Spike Lance'],['upper','Spike Upper'],['barrage','Needle Storm']],
  hammer:[['wall','Iron Wall'],['counter','Hammer Counter'],['rush','Hammer Drop']],
  round:[['wall','Smooth Guard'],['steal','Spin Siphon'],['counter','Roll Away']],
  ring:[['wall','Ring Fortress'],['counter','Halo Counter'],['steal','Ring Drain']],
  scythe:[['upper','Reaper Upper'],['barrage','Harvest'],['steal','Soul Reap']],
  crescent:[['steal','Moon Drain'],['counter','Crescent Parry'],['upper','Lunar Upper']],
  wave:[['counter','Wave Break'],['steal','Undertow'],['wall','Tidal Wall']],
  shield:[['wall','Aegis'],['counter','Shield Bash'],['rush','Shield Charge']],
  arrow:[['rush','Arrow Strike'],['barrage','Volley'],['upper','Piercing Upper']],
  twin:[['barrage','Twin Fang'],['upper','Twin Upper'],['rush','Double Rush']],
  horn:[['rush','Horn Ram'],['upper','Gore'],['wall','Horn Guard']],
  feather:[['steal','Feather Drain'],['counter','Gale Parry'],['barrage','Feather Storm']],
  fang:[['rush','Fang Rush'],['upper','Crimson Bite'],['barrage','Frenzy']],
  star:[['upper','Starfall'],['barrage','Meteor Shower'],['rush','Comet Rush']],
  custom:[['rush','Signature Rush'],['wall','Signature Guard'],['upper','Signature Upper']]
};
const CORE_NAMES={anchor:'Anchor Down',lockguard:'Lock Guard',recover:'Spin Recovery',weight:'Weight Shift'};
const DRIVER_NAMES={drive:'Rush Drive',sweep:'Rim Sweep',zig:'Zig-Zag',rocket:'Rail Rocket',orbit:'Orbit Dash',center:'Center Lock',eternal:'Eternal Spin',gravity:'Gravity Well'};
BF.PART_LABEL={blade:'Blade',core:'Core',driver:'Driver'};

// 3 moves per part, decided by the part's shape/settings
BF.movePools = d=>{
  const pe=BF.partElements(d), mk=(part,kind,name,i)=>({id:`${part}:${kind}`,part,kind,name,el:pe[part],slot:i});
  const blade=(BLADE_MOVES[d.blade.shape]||BLADE_MOVES.blade).map(([k,n],i)=>mk('blade',k,n,i));
  let core;
  if(d.system==='X') core = d.ratchet.height>=70 ? ['anchor','lockguard','weight'] : d.ratchet.points>=6 ? ['lockguard','recover','anchor'] : ['weight','lockguard','recover'];
  else core = ['round','octa'].includes(d.disc.shape)||d.disc.thickness>=5.5 ? ['anchor','weight','lockguard'] : ['recover','lockguard','weight'];
  const tip=BF.effTip(d), mob=tip.mob;
  let drv = mob>=0.8 ? ['drive','sweep', d.system==='X'&&d.bit.gear?'rocket':'zig'] : mob>=0.45 ? ['orbit','sweep','center'] : ['center','eternal','gravity'];
  return { blade, core:core.map((k,i)=>mk('core',k,CORE_NAMES[k],i)), driver:drv.map((k,i)=>mk('driver',k,DRIVER_NAMES[k],i)) };
};
BF.moveById = (d,id)=>{ const p=BF.movePools(d); return [...p.blade,...p.core,...p.driver].find(m=>m.id===id)||null; };
// default loadout: first move of each part
BF.defaultMoves = d=>{ const p=BF.movePools(d); return [p.blade[0].id,p.core[0].id,p.driver[0].id]; };

// ---------- move effects (run inside BF.Sim, host-authoritative) ----------
// b = the Bey's state, o = opponent state, s = sim. Timed effects live in b.fx[name] (seconds left).
BF.MOVE_FX = {
  rush(s,b,o){ b.fx.rush=0.7; b.next.kick=1.8; },
  upper(s,b,o){ b.fx.upper=2.5; b.next.upper=true; },
  barrage(s,b,o){ b.fx.barrage=3; },
  wall(s,b,o){ b.fx.wall=3; },
  counter(s,b,o){ b.fx.counter=3; },
  steal(s,b,o){ b.fx.steal=3; },
  anchor(s,b,o){ b.fx.anchor=4; },
  lockguard(s,b,o,mul){ b.dmg=Math.max(0,b.dmg-0.35*(mul||1)); b.fx.lockguard=4; },
  recover(s,b,o,mul){ b.w=Math.min(b.w0,b.w+b.w0*0.14*(mul||1)); },
  weight(s,b,o){ b.fx.weight=3; },
  drive(s,b,o){ b.fx.drive=2.5; },
  sweep(s,b,o){ b.fx.sweep=2.5; },
  zig(s,b,o){ b.fx.zig=3; },
  rocket(s,b,o){ b.dash=0.5; b.dashCd=1.4; s.events.push({k:'dash',i:b.i}); },
  orbit(s,b,o){ const r=Math.hypot(b.x,b.y)||1, tx=b.y/r*b.sign, ty=-b.x/r*b.sign; b.vx+=tx*650; b.vy+=ty*650; b.fx.orbit=0.6; },
  center(s,b,o){ b.fx.center=4; },
  eternal(s,b,o){ b.fx.eternal=5; },
  gravity(s,b,o){ b.fx.gravity=3; }
};
})();

// ---------- CPU blader: launch choices and in-round move timing by difficulty ----------
(function(){
const BF=window.BF;
BF.CPU_LEVELS={easy:'Easy',normal:'Normal',hard:'Hard',expert:'Expert'};
const LV={easy:0,normal:1,hard:2,expert:3};
const ATTACKY=['rush','upper','barrage','weight','steal'], ROAMY=['drive','sweep','zig','rocket','gravity'];
BF.MoveAI = {
  // pick a launch: power, tilt, shot, position and one move per part (never the same move as last round)
  launch(f, opp, level, last){
    const L=LV[level]??1, r=Math.random, pools=BF.movePools(f.d), lastIds=last||[];
    const pw=[[0.5,0.75],[0.65,0.9],[0.8,0.97],[0.93,1]][L];
    const pick=list=>{ let ok=list.filter(m=>!lastIds.includes(m.id)); if(!ok.length) ok=list;
      if(L>=2 && opp){ const sorted=ok.slice().sort((a,b)=>BF.elemVs(b.el,opp.els)-BF.elemVs(a.el,opp.els)); if(r()<(L===3?0.85:0.55)) return sorted[0].id; }
      return ok[Math.floor(r()*ok.length)].id; };
    const shots=Object.keys(BF.SHOTS);
    const shot = L>=2 ? (f.atk>f.sta ? (r()<0.6?'bank':'power') : (r()<0.6?'sliding':'flat')) : shots[Math.floor(r()*shots.length)];
    return { power:pw[0]+r()*(pw[1]-pw[0]), angle:Math.round((r()-0.5)*(L>=2?20:40)), spin:r()<0.5?'right':'left', mode:f.atk>f.sta?'attack':'stamina',
      shot, pos:{a:(r()-0.5)*1.2, r:0.4+r()*0.3}, moves:[pick(pools.blade),pick(pools.core),pick(pools.driver)] };
  },
  // called ~4×/s by the host for each CPU Bey; fires moves and leans
  tick(sim, i, level, mem){
    const L=LV[level]??1, b=sim.b[i], o=sim.b[1-i], f=sim.f[i]; if(!b||!b.alive||!o) return;
    mem.t=(mem.t||0)+1;
    const d=Math.hypot(o.x-b.x,o.y-b.y)-f.R-sim.f[1-i].R, spin=b.w/b.w0, R=sim.R, r=Math.hypot(b.x,b.y);
    const oppAttacking=['rush','barrage','weight','sweep','upper'].some(k=>o.fx[k]);
    if(Math.random()<[0.1,0.3,0.6,0.9][L]){
      for(let s=0;s<b.moves.length;s++){ if(b.used[s]) continue; const m=BF.moveById(f.d,b.moves[s]); if(!m) continue; const k=m.kind;
        let good=false;
        if(L===0) good=Math.random()<0.25;
        else if(ATTACKY.includes(k)) good=d<(L>=2?40:80);
        else if(ROAMY.includes(k)) good=d<200 || sim.t>6;
        else if(['wall','counter','anchor','orbit'].includes(k)) good=(oppAttacking&&d<120) || (k==='anchor'&&r>R*0.8) || b.dmg>0.6;
        else if(k==='lockguard') good=b.dmg>(L>=2?0.45:0.6);
        else if(['recover','eternal','center'].includes(k)) good=spin<(L>=2?0.5:0.6);
        if(good && sim.useMove(i,s)) break; }
    }
    // lean: hunters lean at the opponent, stamina types lean back to the middle
    if(L>=1 && mem.t%(L>=3?4:7)===0){
      if(f.atk>=f.sta && o.alive) sim.lean(i,o.x,o.y); else if(r>R*0.55) sim.lean(i,0,0);
    }
  }
};
})();
