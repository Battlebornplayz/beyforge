/* BeyForge — data: materials, parts catalog, presets, naming */
(function(){
'use strict';
const BF = window.BF = window.BF || {};
BF.VERSION = 'v1';

// density in g/cm3. rough/metal drive the preview look.
BF.MATERIALS = {
  PLA:   {label:'PLA',            density:1.24, rough:0.42, metal:0.00},
  PETG:  {label:'PETG',           density:1.27, rough:0.20, metal:0.00},
  ABS:   {label:'ABS',            density:1.04, rough:0.50, metal:0.00},
  ASA:   {label:'ASA',            density:1.07, rough:0.55, metal:0.00},
  SILK:  {label:'Silk PLA',       density:1.24, rough:0.16, metal:0.55},
  CF:    {label:'PLA-CF',         density:1.29, rough:0.88, metal:0.05},
  PC:    {label:'Polycarbonate',  density:1.20, rough:0.28, metal:0.00},
  NYLON: {label:'Nylon',          density:1.14, rough:0.60, metal:0.00},
  TPU:   {label:'TPU 95A (rubber)',density:1.21, rough:0.95, metal:0.00, rubber:true},
  METAL: {label:'Metal-fill PLA (~3 g/cm³)', density:3.0, rough:0.32, metal:0.80}
};

// Off-the-shelf weight inserts. mass in g, dia = pocket diameter (mm), depth = pocket depth (mm)
BF.INSERTS = {
  none:  {label:'None', mass:0},
  bb6:   {label:'6 mm steel BB',    mass:0.88, dia:6.0,  depth:6.3, shape:'sphere'},
  ball8: {label:'8 mm steel ball',  mass:2.09, dia:8.0,  depth:8.3, shape:'sphere'},
  m3:    {label:'M3 hex nut',       mass:0.45, dia:6.35, depth:2.6, shape:'hex'},
  m4:    {label:'M4 hex nut',       mass:0.85, dia:8.08, depth:3.4, shape:'hex'},
  m5:    {label:'M5 hex nut',       mass:1.20, dia:9.24, depth:4.2, shape:'hex'}
};

// mu = friction coefficient, rc = effective contact radius (mm), mob = mobility, grip = stability
BF.TIPS = {
  flat:     {label:'Flat',        x:'F',  burst:'Flash',        mu:0.55, rc:3.2,  mob:0.85, grip:0.55, prof:'flat'},
  lowflat:  {label:'Low Flat',    x:'LF', burst:'Low Flash',    mu:0.55, rc:3.6,  mob:0.90, grip:0.50, prof:'flat', low:true},
  rubber:   {label:'Rubber Flat', x:'RA', burst:'Rubber Accel', mu:0.95, rc:3.4,  mob:1.00, grip:0.90, prof:'flat', rubber:true},
  gearflat: {label:'Gear Flat',   x:'GF', burst:'Gear Flash',   mu:0.60, rc:3.0,  mob:0.92, grip:0.60, prof:'flat'},
  rush:     {label:'Rush',        x:'R',  burst:'Rush',         mu:0.45, rc:2.4,  mob:0.70, grip:0.55, prof:'rush'},
  hexa:     {label:'Hexa',        x:'H',  burst:'Hexa',         mu:0.42, rc:2.0,  mob:0.60, grip:0.60, prof:'flat'},
  taper:    {label:'Taper',       x:'T',  burst:'Taper',        mu:0.35, rc:1.6,  mob:0.50, grip:0.50, prof:'taper'},
  point:    {label:'Point',       x:'P',  burst:'Point',        mu:0.30, rc:0.9,  mob:0.42, grip:0.55, prof:'point'},
  ball:     {label:'Ball',        x:'B',  burst:'Orbit',        mu:0.22, rc:0.6,  mob:0.30, grip:0.40, prof:'ball'},
  orb:      {label:'Orb',         x:'O',  burst:'Atomic',       mu:0.20, rc:0.8,  mob:0.35, grip:0.35, prof:'orb'},
  needle:   {label:'Needle',      x:'N',  burst:'Needle',       mu:0.25, rc:0.35, mob:0.15, grip:0.75, prof:'needle'}
};

BF.WING_SHAPES = {blade:'Blade (attack)', claw:'Claw / hook', fin:'Fin', saw:'Saw teeth', spike:'Spike', hammer:'Hammer (defense)', round:'Round (stamina)', ring:'Full ring', custom:'Custom — draw it'};
BF.DISC_SHAPES = {round:'Round', octa:'Octagon', star:'Star', wing:'Lobed', gear:'Gear'};
BF.EMBLEMS = {none:'None', bolt:'Lightning', star:'Star', flame:'Flame', fang:'Fang', eye:'Eye', crown:'Crown', chevron:'Chevron', diamond:'Diamond', ring:'Ring'};
BF.TEXTURES = {none:'None', ridges:'Ridges', studs:'Studs', chevrons:'Chevrons'};
BF.SWATCHES = ['#f2f4f8','#16171f','#9aa3b5','#e8262f','#ff7a1a','#ffd21f','#3fe06b','#2ef2ff','#1f8bff','#2b3cff','#8a3dff','#ff2e88','#c7a052'];

BF.NAME_PREFIX = ['Drake','Viper','Kraken','Raijin','Talon','Wyvern','Golem','Phantom','Cobra','Titan','Basilisk','Gryphon','Hydra','Specter','Onyx','Rook','Valkyr','Fenrir','Mantis','Oni','Ronin','Orca','Lynx','Kitsune','Garuda','Behemoth','Saber','Reaper','Tempest','Chimera','Nemesis','Manticore'];
BF.NAME_SUFFIX = {
  attack:  ['Sword','Fang','Saber','Lance','Rush','Edge','Strike','Blitz','Scythe','Talon'],
  defense: ['Shield','Bastion','Wall','Aegis','Fortress','Guard','Bulwark','Keep'],
  stamina: ['Halo','Orbit','Wing','Drift','Eclipse','Comet','Zephyr','Lotus'],
  balance: ['Arc','Cross','Pulse','Chaos','Rift','Nova','Vortex','Prism']
};

const custom24 = Array.from({length:24},(_,i)=>{const u=i/23; return u<0.15? u/0.15 : Math.max(0,1-(u-0.15)/0.85*1.05);});

BF.defaultDesign = function(){
  return {
    v:1, system:'X', nameMode:'auto', name:'', nameSeed:5, spin:'right', symmetry:true,
    blade:{ diameter:46, wings:3, shape:'blade', wingWidth:0.72, depth:0.38, sweep:12, soft:2,
            height:10, tipHeight:5, slope:10, custom:custom24.slice(),
            wingScale:[1,1,1,1,1,1,1,1], wingShift:[0,0,0,0,0,0,0,0],
            material:'PLA', color:'#e9edf5' },
    ratchet:{ points:3, height:60, material:'PETG', color:'#1b1d27' },
    lock:{ teeth:3, strength:3 },
    disc:{ shape:'round', diameter:36, thickness:4, lobes:4, rim:0.3, material:'METAL', color:'#9aa3b5' },
    bit:{ tip:'flat', width:7, tipLen:4, gear:true, gearTeeth:16, material:'PLA', color:'#ff2e88', tipMaterial:'PLA', tipColor:'#16171f' },
    deco:{ emblem:'bolt', emblemSize:0.8, text:'BEYFORGE', texture:'ridges', textureCount:2, accent:'#2ef2ff' },
    weights:{ insert:'bb6', count:3, radius:16, part:'layer' },
    print:{ infill:0.4, tolerance:0.2 },
    fit:{ xPlugD:18, xPlugH:3, xSocketD:8, bShaftD:9 }
  };
};

// Archetype presets — original designs tuned to each battle style (not copies of official Beys)
BF.PRESETS = [
  {id:'saber', name:'Saber Drake', sys:'X', blurb:'3-wing upper-attack slasher', patch:{
    system:'X', blade:{shape:'blade',wings:3,wingWidth:0.7,depth:0.42,sweep:16,slope:14,height:10,tipHeight:4.4,color:'#f2f4f8'},
    ratchet:{points:3,height:60}, bit:{tip:'flat',gear:true,width:7.5,color:'#e8262f'}, deco:{emblem:'bolt',accent:'#1f8bff',texture:'ridges'}, weights:{insert:'bb6',count:3,radius:18}}},
  {id:'reaper', name:'Reaper Mantis', sys:'X', blurb:'4 hooked claws, lower attack', patch:{
    system:'X', blade:{shape:'claw',wings:4,wingWidth:0.62,depth:0.4,sweep:-10,slope:-8,height:9.5,tipHeight:5,color:'#16171f'},
    ratchet:{points:4,height:60}, bit:{tip:'taper',gear:true,color:'#8a3dff'}, deco:{emblem:'fang',accent:'#3fe06b',texture:'chevrons'}, weights:{insert:'m3',count:4,radius:17}}},
  {id:'arcane', name:'Arcane Wyvern', sys:'X', blurb:'smooth stamina disc on a ball tip', patch:{
    system:'X', blade:{shape:'round',wings:4,wingWidth:1,depth:0.22,sweep:0,slope:4,height:9,tipHeight:6,soft:6,color:'#8a3dff'},
    ratchet:{points:4,height:80}, bit:{tip:'ball',gear:false,width:6,color:'#ffd21f'}, deco:{emblem:'star',accent:'#ffd21f',texture:'none'}, weights:{insert:'ball8',count:4,radius:19}}},
  {id:'golem', name:'Bastion Golem', sys:'X', blurb:'wide hammer defense, needle tip', patch:{
    system:'X', blade:{shape:'hammer',wings:3,wingWidth:0.88,depth:0.26,sweep:0,slope:0,height:11,tipHeight:8,soft:3,color:'#9aa3b5'},
    ratchet:{points:3,height:80}, bit:{tip:'needle',gear:false,color:'#16171f'}, deco:{emblem:'diamond',accent:'#ff7a1a',texture:'studs'}, weights:{insert:'ball8',count:3,radius:18}}},
  {id:'garuda', name:'Gale Garuda', sys:'X', blurb:'6 spikes, 9-point ratchet, gear rush', patch:{
    system:'X', blade:{shape:'spike',wings:6,wingWidth:0.8,depth:0.34,sweep:22,slope:8,height:9,tipHeight:3.6,color:'#ff7a1a'},
    ratchet:{points:9,height:60}, bit:{tip:'gearflat',gear:true,gearTeeth:20,color:'#16171f'}, deco:{emblem:'flame',accent:'#ffd21f',texture:'ridges',textureCount:1}, weights:{insert:'m3',count:6,radius:17}}},
  {id:'onyx', name:'Onyx Lynx', sys:'X', blurb:'5-wing saw balance type', patch:{
    system:'X', blade:{shape:'saw',wings:5,wingWidth:0.85,depth:0.3,sweep:6,slope:6,height:10,tipHeight:5,color:'#16171f'},
    ratchet:{points:5,height:60}, bit:{tip:'point',gear:true,color:'#2ef2ff'}, deco:{emblem:'eye',accent:'#ff2e88',texture:'none'}, weights:{insert:'m3',count:5,radius:16}}},
  {id:'valkyr', name:'Valkyr Strike', sys:'Burst', blurb:'3-blade rubber rush attacker', patch:{
    system:'Burst', blade:{diameter:48,shape:'blade',wings:3,wingWidth:0.68,depth:0.4,sweep:18,slope:10,height:12,tipHeight:5,color:'#1f8bff'},
    lock:{teeth:3,strength:2}, disc:{shape:'wing',lobes:3,diameter:34,thickness:4,rim:0.2}, bit:{tip:'rubber',tipMaterial:'TPU',tipColor:'#16171f',color:'#ffd21f'}, deco:{emblem:'bolt',accent:'#ffd21f'}, weights:{insert:'bb6',count:3,radius:18,part:'layer'}}},
  {id:'eclipse', name:'Lotus Eclipse', sys:'Burst', blurb:'full-ring stamina, orb tip', patch:{
    system:'Burst', blade:{diameter:50,shape:'ring',wings:6,depth:0.18,sweep:0,slope:4,height:11,tipHeight:7,soft:4,color:'#f2f4f8'},
    lock:{teeth:4,strength:4}, disc:{shape:'round',diameter:38,thickness:6.5,rim:0.9}, bit:{tip:'orb',color:'#8a3dff'}, deco:{emblem:'ring',accent:'#8a3dff',texture:'none'}, weights:{insert:'bb6',count:4,radius:13,part:'disc'}}},
  {id:'oni', name:'Oni Fortress', sys:'Burst', blurb:'heavy octagon defense, needle', patch:{
    system:'Burst', blade:{diameter:48,shape:'hammer',wings:4,wingWidth:0.85,depth:0.25,sweep:0,slope:0,height:12,tipHeight:9,color:'#e8262f'},
    lock:{teeth:4,strength:5}, disc:{shape:'octa',diameter:38,thickness:6,rim:0.6}, bit:{tip:'needle',color:'#16171f'}, deco:{emblem:'crown',accent:'#ffd21f',texture:'studs'}, weights:{insert:'m5',count:4,radius:15,part:'disc'}}},
  {id:'hydra', name:'Hydra Chaos', sys:'Burst', blurb:'dual-spin balance, star disc', patch:{
    system:'Burst', spin:'dual', blade:{diameter:47,shape:'spike',wings:4,wingWidth:0.75,depth:0.32,sweep:0,slope:6,height:11,tipHeight:5,color:'#3fe06b'},
    lock:{teeth:3,strength:3}, disc:{shape:'star',lobes:5,diameter:36,thickness:5,rim:0.4}, bit:{tip:'taper',color:'#16171f'}, deco:{emblem:'eye',accent:'#ff2e88'}, weights:{insert:'m4',count:4,radius:17,part:'layer'}}}
];

// ---------- helpers ----------
BF.clone = o => JSON.parse(JSON.stringify(o));
BF.merge = function merge(base, patch){
  for(const k in patch){
    const v = patch[k];
    if(v && typeof v === 'object' && !Array.isArray(v)){ if(!base[k] || typeof base[k] !== 'object') base[k] = {}; merge(base[k], v); }
    else base[k] = Array.isArray(v) ? v.slice() : v;
  }
  return base;
};
BF.get = (o,p) => p.split('.').reduce((a,k)=>a==null?a:a[k], o);
BF.set = (o,p,v) => { const ks=p.split('.'); let a=o; for(let i=0;i<ks.length-1;i++) a=a[ks[i]]; a[ks[ks.length-1]]=v; };
BF.normalize = function(d){ // fill any fields missing from older saves
  return BF.merge(BF.defaultDesign(), d || {});
};
BF.fromPreset = function(p){
  const d = BF.merge(BF.defaultDesign(), BF.clone(p.patch));
  if(p.sys==='Burst' && !(p.patch.blade && p.patch.blade.diameter)) d.blade.diameter = 48;
  d.nameMode = 'manual'; d.name = p.name; d.preset = p.id;
  return d;
};
BF.rng = function(seed){ let s = seed>>>0 || 1; return ()=>{ s|=0; s=s+0x6D2B79F5|0; let t=Math.imul(s^s>>>15,1|s); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };

BF.randomDesign = function(seed){
  const r = BF.rng(seed || (Date.now() & 0xffffff));
  const pick = a => a[Math.floor(r()*a.length)];
  const range = (a,b,step) => { const v=a+r()*(b-a); return step? Math.round(v/step)*step : v; };
  const d = BF.defaultDesign();
  d.system = r()<0.6 ? 'X' : 'Burst';
  d.spin = pick(['right','right','right','left','dual']);
  const shapes = Object.keys(BF.WING_SHAPES).filter(s=>s!=='custom');
  Object.assign(d.blade, {
    diameter: d.system==='X' ? range(42,50,0.5) : range(44,52,0.5),
    wings: Math.round(range(2,7)), shape: pick(shapes), wingWidth: range(0.45,0.95,0.01),
    depth: range(0.18,0.45,0.01), sweep: Math.round(range(-25,25)), soft: range(0,6,0.5),
    height: range(8.5,12,0.5), tipHeight: range(3.5,8,0.2), slope: Math.round(range(-12,22)),
    color: pick(BF.SWATCHES), material: pick(['PLA','PETG','SILK','CF','PLA'])
  });
  d.ratchet.points = pick([3,4,5,6,7,9]); d.ratchet.height = pick([50,55,60,60,70,80]); d.ratchet.color = pick(BF.SWATCHES);
  d.lock.teeth = Math.round(range(2,6)); d.lock.strength = Math.round(range(1,5));
  Object.assign(d.disc, {shape:pick(Object.keys(BF.DISC_SHAPES)), diameter:range(30,40,0.5), thickness:range(3,6,0.5), lobes:Math.round(range(3,7)), rim:range(0,1,0.05)});
  const tips = Object.keys(BF.TIPS);
  Object.assign(d.bit, {tip:pick(tips), width:range(4,9,0.5), tipLen:range(3,6,0.5), gear:r()<0.6, gearTeeth:Math.round(range(12,22)), color:pick(BF.SWATCHES), tipColor:pick(BF.SWATCHES)});
  if(BF.TIPS[d.bit.tip].rubber) d.bit.tipMaterial = 'TPU';
  Object.assign(d.deco, {emblem:pick(Object.keys(BF.EMBLEMS)), emblemSize:range(0.5,1.1,0.05), texture:pick(Object.keys(BF.TEXTURES)), textureCount:Math.round(range(1,3)), accent:pick(BF.SWATCHES), text:''});
  Object.assign(d.weights, {insert:pick(Object.keys(BF.INSERTS)), count:Math.round(range(2,6)), radius:range(15,19,0.5), part:pick(['layer','disc'])});
  d.nameSeed = Math.floor(r()*9999);
  return d;
};

// quick style read used for naming before full physics is in
BF.typeGuess = function(d){
  const tip = BF.TIPS[d.bit.tip];
  const sh = {blade:.9,claw:1,saw:.85,fin:.7,spike:.75,hammer:.35,round:.15,ring:0,custom:.6}[d.blade.shape] ?? .5;
  const atk = sh*(d.blade.depth/0.42) + tip.mob*0.9;
  const sta = (1-sh)*0.9 + (1-tip.mu)*1.1 + (d.blade.shape==='ring'?0.3:0);
  const def = (d.blade.shape==='hammer'?0.8:0.2) + tip.grip*0.9 + (d.weights.insert!=='none'?0.25:0);
  const arr = [['attack',atk],['stamina',sta],['defense',def]].sort((a,b)=>b[1]-a[1]);
  if(d.spin==='dual' || arr[0][1]-arr[1][1] < 0.12) return 'balance';
  return arr[0][0];
};

BF.discCode = function(d){
  const num = Math.max(0, Math.min(9, Math.round((d.disc.diameter-26)/1.6)));
  const nm = {round:'Round',octa:'Octa',star:'Star',wing:'Wing',gear:'Gear'}[d.disc.shape] || 'Round';
  return num + '.' + nm;
};

BF.naming = function(d, type){
  type = type || BF.typeGuess(d);
  const s = Math.abs(d.nameSeed|0);
  const pre = BF.NAME_PREFIX[s % BF.NAME_PREFIX.length];
  const sl = BF.NAME_SUFFIX[type];
  const suf = sl[(s*7+3) % sl.length];
  const tip = BF.TIPS[d.bit.tip];
  const auto = pre + ' ' + suf;
  const name = d.nameMode==='manual' && d.name ? d.name : auto;
  const code = d.system==='X' ? `${d.ratchet.points}-${d.ratchet.height}${tip.x}` : `${BF.discCode(d)}.${tip.burst}`;
  return {name, code, auto, type, full: d.system==='X' ? `${name} ${code}` : `${name} ${code}`};
};
})();
