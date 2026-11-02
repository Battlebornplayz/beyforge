/* BeyForge v6.7 — the part catalog: named parts inspired by real Beyblade X and Burst parts (shapes, sizes, weight
   classes and gimmicks), with BeyForge's own names. Numbered parts (ratchets like 3-60, numbered discs) keep numbers. */
(function(){
'use strict';
const BF=window.BF;

// ---------- gimmicks: what each one does in battle ----------
BF.GIMMICKS={
  left:       {label:'Left spin',         icon:'↺', desc:'Spins left. Meshes with right-spinners and fights other left-spinners head on.'},
  dual:       {label:'Dual spin',         icon:'⇄', desc:'Choose left or right spin before every launch.'},
  freering:   {label:'Free-spin ring',    icon:'◎', desc:'An outer ring spins on its own: takes 35% less spin loss and gets knocked around less.'},
  spinsteal:  {label:'Spin-steal rubber', icon:'⟲', desc:'Rubber contact points mesh with opposite-spin foes and pull their spin into yours.'},
  rubberblade:{label:'Rubber blade',      icon:'◈', desc:'Grippy rubber contacts rattle the foe’s lock: more burst damage dealt.'},
  metalball:  {label:'Metal ball core',   icon:'●', desc:'A loose metal ball soaks up upper and lower hits: 30% less burst damage, immune to upper rocks.'},
  spring:     {label:'Spring blades',     icon:'⤧', desc:'Blades snap back after contact: 15% harder knockouts.'},
  bmode:      {label:'Mode change',       icon:'⇅', desc:'Pick Attack or Defense mode at launch: harder hits, or tougher to knock away.'},
  metalheavy: {label:'Metal weight',      icon:'▣', desc:'Metal parts add weight for more inertia and knockout power.'},
  outerweight:{label:'Outer weight',      icon:'◌', desc:'Weight pushed to the rim keeps it spinning longer.'},
  barrier:    {label:'Barrier blades',    icon:'⛨', desc:'Blades fling out at high spin and block hits while spin is above 60%.'},
  burstlock:  {label:'Burst lock',        icon:'🔒', desc:'A lock mechanism holds the layer down: 25% more burst resistance.'},
  imbalance:  {label:'Off-balance',       icon:'⚖', desc:'One heavy side: hits 10% harder but loses spin faster.'},
  barrage:    {label:'Barrage',           icon:'≋', desc:'Lots of small contact points: lands more hits in a row.'},
  freetip:    {label:'Free-spinning tip', icon:'⊙', desc:'The tip turns on its own: huge stamina, but easier to knock away.'},
  brakes:     {label:'Brake tabs',        icon:'⏸', desc:'Tabs catch the floor when hit: much harder to knock out.'},
  rubbertip:  {label:'Rubber tip',        icon:'⬤', desc:'Grippy rubber: fast and aggressive, but burns stamina.'},
  compress:   {label:'Shock spring',      icon:'⇕', desc:'Compresses on impact: 20% less burst damage.'},
  point:      {label:'Angle-reactive',    icon:'∠', desc:'Launched flat it stays centered and saves stamina; launched tilted it attacks.'},
  quake:      {label:'Quake gears',       icon:'⌁', desc:'Wide gear tip that jolts around unpredictably and Xtreme-dashes off hits.'},
  tmode:      {label:'Tip mode',          icon:'⇵', desc:'Switch between an attack tip and a stamina tip at launch.'}
};
BF.gimmicksOf=d=>{
  const g={}, add=k=>{ if(k) g[k]=true; };
  Object.values(d.gim||{}).forEach(a=>(a||[]).forEach(add));
  const t=BF.TIPS[d.bit&&d.bit.tip]||{}; (t.gim||[]).forEach(add); if(d.system==='Burst') (t.gimB||[]).forEach(add); if(t.rubber) add('rubbertip'); if(t.modes) add('tmode');
  if(d.spin==='left') add('left'); if(d.spin==='dual') add('dual');
  if(d.system==='X'&&d.ratchet){ if(d.ratchet.points===1) add('imbalance'); if(d.ratchet.points>=9) add('barrage'); if(d.ratchet.points===5) add('outerweight'); }
  const ls=d.system==='Burst'&&d.layer&&d.layer.style; if(['god','choz','dual'].includes(ls)) add('metalheavy');
  return g;
};
BF.gimmickList=d=>Object.keys(BF.gimmicksOf(d)).filter(k=>BF.GIMMICKS[k]);

// ---------- tips: our own names (no official product names) + new real-inspired bits & drivers ----------
const TP=BF.TIPS;
const rename={flat:['Flat','Plane'],lowflat:['Low Plane','Low Plane'],rubber:['Grip Thrust','Grip Thrust'],gearflat:['Cog Flat','Cog'],rush:['Charge','Charge'],hexa:['Hex Grip','Hex'],
  taper:['Taper','Taper'],point:['Point','Point'],ball:['Ball','Halo'],orb:['Sphere','Sphere'],needle:['Needle','Needle'],spike:['Spike','Spike'],xtreme:['Overdrive Flat','Overdrive'],
  dish:['Dish','Dish'],unite:['Fusion','Fusion'],level:['Tier Grip','Tier'],bearing:['Spindle Ball','Spindle'],mode:['Shift','Shift']};
Object.entries(rename).forEach(([k,[x,b]])=>{ if(TP[k]){ TP[k].label=x; TP[k].burst=b; } });
TP.point.gim=['point']; TP.bearing.gim=['freetip']; TP.xtreme.rubber=true;
Object.assign(TP,{
  cyclone:  {label:'Vortex',      x:'V',  burst:'Vortex',     mu:0.58,rc:3.0, mob:0.95,grip:0.7, prof:'flat'},
  quake:    {label:'Tremor',      x:'TR', burst:'Tremor',     mu:0.42,rc:2.6, mob:0.8, grip:0.6, prof:'ball', gim:['quake']},
  glide:    {label:'Coast',       x:'CO', burst:'Coast',      mu:0.17,rc:0.7, mob:0.3, grip:0.45,prof:'orb'},
  discball: {label:'Saucer',      x:'SA', burst:'Saucer',     mu:0.2, rc:0.8, mob:0.3, grip:0.45,prof:'ball', gim:['outerweight']},
  freeball: {label:'Loose Ball',  x:'LB', burst:'Loose Ball', mu:0.14,rc:0.6, mob:0.28,grip:0.4, prof:'ball', gim:['freetip']},
  lowrush:  {label:'Low Charge',  x:'LC', burst:'Low Charge', mu:0.5, rc:2.6, mob:0.78,grip:0.55,prof:'rush', low:true},
  hightaper:{label:'Tall Taper',  x:'TT', burst:'Tall Taper', mu:0.33,rc:1.5, mob:0.5, grip:0.5, prof:'taper'},
  boundspike:{label:'Spring Spike',x:'SS',burst:'Spring Spike',mu:0.26,rc:0.3,mob:0.14,grip:0.78,prof:'spike', gim:['compress']},
  metalneedle:{label:'Steel Needle',x:'SN',burst:'Steel Needle',mu:0.2,rc:0.3,mob:0.12,grip:0.8,prof:'needle'},
  elevate:  {label:'Riser',       x:'RI', burst:'Riser',      mu:0.8, rc:3.4, mob:0.92,grip:0.85,prof:'rush', rubber:true},
  // Burst-style drivers
  atomic:   {label:'Nucleus',     x:'NU', burst:'Nucleus',    mu:0.13,rc:0.9, mob:0.32,grip:0.5, prof:'orb',   gim:['freetip','brakes']},
  drift:    {label:'Coaster',     x:'CS', burst:'Coaster',    mu:0.12,rc:0.45,mob:0.2, grip:0.6, prof:'needle',gim:['freetip']},
  mobius:   {label:'Loop',        x:'LP', burst:'Loop',       mu:0.12,rc:0.5, mob:0.22,grip:0.55,prof:'taper', gim:['freetip']},
  jaggy:    {label:'Serrate',     x:'SR', burst:'Serrate',    mu:0.6, rc:3.6, mob:0.97,grip:0.65,prof:'flat'},
  variable: {label:'Shed',        x:'SH', burst:'Shed',       mu:0.9, rc:3.8, mob:1.0, grip:0.9, prof:'xtreme',rubber:true},
  zephyr:   {label:'Breeze',      x:'BR', burst:'Breeze',     mu:0.52,rc:3.0, mob:0.9, grip:0.6, prof:'flat'},
  hold:     {label:'Anchor',      x:'AN', burst:'Anchor',     mu:0.42,rc:2.2, mob:0.32,grip:0.6, prof:'dish',  gim:['brakes']},
  destroy:  {label:'Wrecker',     x:'WR', burst:'Wrecker',    mu:0.3, rc:1.3, mob:0.45,grip:0.6, prof:'taper', gim:['compress']},
  eternal:  {label:'Infinity',    x:'IN', burst:'Infinity',   mu:0.11,rc:0.4, mob:0.18,grip:0.6, prof:'needle',gim:['freetip']},
  revolve:  {label:'Swivel',      x:'SW', burst:'Swivel',     mu:0.2, rc:1.6, mob:0.4, grip:0.55,prof:'flat',  gim:['freetip']},
  defense:  {label:'Bulwark',     x:'BW', burst:'Bulwark',    mu:0.4, rc:2.0, mob:0.3, grip:0.65,prof:'dish',  gim:['brakes']},
  massive:  {label:'Heavyweight', x:'HW', burst:'Heavyweight',mu:0.46,rc:2.8, mob:0.6, grip:0.6, prof:'flat'},
  survive:  {label:'Endure',      x:'EN', burst:'Endure',     mu:0.24,rc:0.9, mob:0.3, grip:0.5, prof:'ball'},
  accel:    {label:'Thrust',      x:'TH', burst:'Thrust',     mu:0.5, rc:2.8, mob:0.88,grip:0.6, prof:'flat'}
});

// ---------- the catalog ----------
// blade/layer: [id, name, rarity, type, gimmicks, blade{shape,wings,wingWidth,depth,sweep,slope,height,tipHeight,diameter}, extra]
const X_BLADES=[
  ['wyrmsaber','Wyrm Saber','rare','attack',[],{shape:'blade',wings:3,wingWidth:.7,depth:.44,sweep:18,slope:14,height:10,tipHeight:4.4,diameter:47},{color:'#f2f4f8',acc:'#e8262f'}],
  ['infreaper','Inferno Reaper','rare','balance',[],{shape:'claw',wings:4,wingWidth:.66,depth:.36,sweep:-8,slope:4,height:10,tipHeight:6,diameter:46},{color:'#16171f',acc:'#ff2e88'}],
  ['sorcbolt','Sorcerer Bolt','rare','stamina',['outerweight'],{shape:'round',wings:2,wingWidth:.95,depth:.3,sweep:0,slope:2,height:9,tipHeight:7,diameter:48},{color:'#ff7a1a',acc:'#ffd21f',w:{insert:'ball8',count:2,radius:20}}],
  ['palward','Paladin Ward','common','defense',[],{shape:'hammer',wings:3,wingWidth:.9,depth:.24,sweep:0,slope:0,height:11,tipHeight:8,diameter:45},{color:'#3fe06b',acc:'#f2f4f8'}],
  ['palpike','Paladin Pike','rare','attack',[],{shape:'spike',wings:3,wingWidth:.6,depth:.42,sweep:6,slope:8,height:11,tipHeight:5,diameter:47},{color:'#ffd21f',acc:'#16171f'}],
  ['megafin','Megalodon Fin','epic','attack',['metalheavy'],{shape:'fin',wings:2,wingWidth:.8,depth:.46,sweep:20,slope:22,height:10,tipHeight:4,diameter:48},{color:'#1f8bff',acc:'#f2f4f8',w:{insert:'m4',count:2,radius:19}}],
  ['liontalon','Lion Talon','common','balance',[],{shape:'claw',wings:5,wingWidth:.6,depth:.3,sweep:-4,slope:6,height:10,tipHeight:6,diameter:45},{color:'#ffd21f',acc:'#e8262f'}],
  ['cobralash','Cobra Lash','common','stamina',[],{shape:'fin',wings:3,wingWidth:.8,depth:.26,sweep:24,slope:0,height:9,tipHeight:6,diameter:45},{color:'#3fe06b',acc:'#8a3dff'}],
  ['bullcrush','Bull Crusher','common','defense',[],{shape:'hammer',wings:2,wingWidth:.95,depth:.28,sweep:0,slope:-2,height:11,tipHeight:9,diameter:46},{color:'#9aa3b5',acc:'#ff7a1a'}],
  ['fireplume','Firebird Plume','epic','attack',['metalheavy'],{shape:'blade',wings:3,wingWidth:.75,depth:.42,sweep:14,slope:10,height:11,tipHeight:5,diameter:48},{color:'#e8262f',acc:'#ffd21f',w:{insert:'m4',count:3,radius:19}}],
  ['narwspike','Narwhal Spike','rare','balance',[],{shape:'spike',wings:5,wingWidth:.55,depth:.34,sweep:0,slope:4,height:10,tipHeight:6,diameter:46},{color:'#f2f4f8',acc:'#2ef2ff'}],
  ['wyrmfang','Wyrm Fang','common','attack',[],{shape:'saw',wings:6,wingWidth:.55,depth:.34,sweep:22,slope:6,height:10,tipHeight:4.6,diameter:46},{color:'#1f8bff',acc:'#ffd21f'}],
  ['infshackle','Inferno Shackle','epic','balance',['metalheavy'],{shape:'round',wings:5,wingWidth:.85,depth:.26,sweep:6,slope:4,height:11,tipHeight:7,diameter:47},{color:'#16171f',acc:'#ff7a1a',w:{insert:'m4',count:5,radius:18}}],
  ['onyxcara','Onyx Carapace','rare','defense',[],{shape:'round',wings:6,wingWidth:.95,depth:.2,sweep:0,slope:0,height:12,tipHeight:9,diameter:45},{color:'#16171f',acc:'#9aa3b5'}],
  ['rexdrum','Rex Drum','common','attack',[],{shape:'claw',wings:3,wingWidth:.7,depth:.4,sweep:-12,slope:-6,height:10,tipHeight:5,diameter:46},{color:'#e8262f',acc:'#3fe06b'}],
  ['frosttiger','Frost Tiger','rare','balance',[],{shape:'saw',wings:3,wingWidth:.7,depth:.32,sweep:10,slope:6,height:10,tipHeight:6,diameter:46},{color:'#f2f4f8',acc:'#2ef2ff'}],
  ['azurewyv','Azure Wyvern','legendary','attack',['metalheavy'],{shape:'blade',wings:4,wingWidth:.62,depth:.44,sweep:16,slope:12,height:10,tipHeight:5,diameter:47},{color:'#2b3cff',acc:'#2ef2ff',spin:'left',w:{insert:'m4',count:4,radius:19}}],
  ['firerudder','Firebird Rudder','epic','stamina',[],{shape:'fin',wings:6,wingWidth:.7,depth:.26,sweep:-18,slope:-10,height:10,tipHeight:6,diameter:47},{color:'#ff7a1a',acc:'#e8262f'}],
  ['galewyrm','Gale Wyrm','rare','defense',[],{shape:'round',wings:4,wingWidth:.85,depth:.22,sweep:12,slope:0,height:10,tipHeight:7,diameter:45},{color:'#16171f',acc:'#3fe06b'}],
  ['sphinxhood','Sphinx Hood','epic','attack',['barrage'],{shape:'saw',wings:8,wingWidth:.45,depth:.3,sweep:8,slope:6,height:10,tipHeight:5,diameter:46},{color:'#2b3cff',acc:'#ffd21f'}],
  ['lunarwolf','Lunar Wolf','legendary','stamina',['freering'],{shape:'ring',wings:6,wingWidth:1,depth:.18,sweep:0,slope:2,height:10,tipHeight:7,diameter:47},{color:'#c7c9d4',acc:'#2ef2ff',tier:true}],
  ['sorcstaff','Sorcerer Staff','legendary','stamina',['outerweight','metalheavy'],{shape:'round',wings:5,wingWidth:.9,depth:.24,sweep:0,slope:2,height:9,tipHeight:7,diameter:48},{color:'#8a3dff',acc:'#ffd21f',w:{insert:'ball8',count:5,radius:21}}],
  ['palmail','Paladin Mail','legendary','defense',['metalball'],{shape:'hammer',wings:4,wingWidth:.92,depth:.22,sweep:0,slope:0,height:12,tipHeight:9,diameter:46},{color:'#9aa3b5',acc:'#1f8bff',w:{insert:'ball8',count:1,radius:12}}],
  ['gloryvalor','Glory Valor','legendary','attack',['spring'],{shape:'blade',wings:3,wingWidth:.72,depth:.46,sweep:20,slope:16,height:10,tipHeight:4.5,diameter:48},{color:'#f2f4f8',acc:'#ffd21f'}],
  ['impactwyrm','Impact Wyrm','epic','attack',[],{shape:'claw',wings:4,wingWidth:.66,depth:.42,sweep:14,slope:10,height:10,tipHeight:5,diameter:47},{color:'#e8262f',acc:'#16171f'}],
  ['roninedge','Ronin Edge','rare','attack',[],{shape:'blade',wings:2,wingWidth:.65,depth:.45,sweep:26,slope:12,height:10,tipHeight:4.4,diameter:47},{color:'#ff2e88',acc:'#f2f4f8'}],
  ['raptorsweep','Raptor Sweep','common','balance',[],{shape:'fin',wings:2,wingWidth:.8,depth:.36,sweep:-20,slope:-8,height:10,tipHeight:5,diameter:46},{color:'#ffd21f',acc:'#8a3dff'}],
  ['infmaul','Inferno Maul','rare','defense',[],{shape:'hammer',wings:3,wingWidth:.85,depth:.3,sweep:-6,slope:-4,height:11,tipHeight:8,diameter:46},{color:'#1f8bff',acc:'#16171f'}]
];
// Burst layers: style picks the generation (real extra pieces get built in 3D)
const B_LAYERS=[
  ['valor','Valor','common','attack','single',[],{shape:'blade',wings:3,wingWidth:.72,depth:.42,sweep:16,slope:10,height:12,tipHeight:5,diameter:48},{color:'#1f8bff',acc:'#ffd21f'}],
  ['duospiral','Duo Spiral','common','balance','single',[],{shape:'spike',wings:2,wingWidth:.75,depth:.34,sweep:0,slope:6,height:11,tipHeight:6,diameter:47},{color:'#f2f4f8',acc:'#e8262f'}],
  ['ruin','Ruin','common','stamina','single',[],{shape:'round',wings:3,wingWidth:.9,depth:.22,sweep:0,slope:2,height:11,tipHeight:7,diameter:48},{color:'#e8262f',acc:'#16171f'}],
  ['triguard','Triguard','common','defense','single',[],{shape:'hammer',wings:3,wingWidth:.9,depth:.24,sweep:0,slope:0,height:12,tipHeight:9,diameter:47},{color:'#16171f',acc:'#e8262f'}],
  ['lancer','Lancer','rare','attack','single',[],{shape:'spike',wings:4,wingWidth:.6,depth:.4,sweep:10,slope:8,height:11,tipHeight:5,diameter:48},{color:'#8a3dff',acc:'#f2f4f8'}],
  ['victor','Victor','rare','attack','dual',[],{shape:'blade',wings:3,wingWidth:.74,depth:.44,sweep:18,slope:12,height:12,tipHeight:5,diameter:49},{color:'#1f8bff',acc:'#ffd21f'}],
  ['tempest','Tempest','common','balance','dual',[],{shape:'fin',wings:2,wingWidth:.8,depth:.36,sweep:12,slope:4,height:12,tipHeight:6,diameter:48},{color:'#3fe06b',acc:'#ffd21f'}],
  ['lostlance','Lost Lance','legendary','attack','dual',['metalheavy'],{shape:'claw',wings:2,wingWidth:.7,depth:.46,sweep:18,slope:10,height:12,tipHeight:5,diameter:49},{color:'#e8262f',acc:'#ffd21f',spin:'left'}],
  ['crownguard','Crown Guard','rare','defense','dual',[],{shape:'hammer',wings:3,wingWidth:.9,depth:.24,sweep:0,slope:0,height:12,tipHeight:9,diameter:48},{color:'#ffd21f',acc:'#16171f'}],
  ['originvalor','Origin Valor','epic','attack','god',[],{shape:'blade',wings:3,wingWidth:.75,depth:.44,sweep:20,slope:14,height:12,tipHeight:5,diameter:50},{color:'#2b3cff',acc:'#ffd21f'}],
  ['requiem','Requiem Spiral','legendary','balance','god',['dual'],{shape:'spike',wings:2,wingWidth:.78,depth:.34,sweep:0,slope:6,height:12,tipHeight:6,diameter:49},{color:'#16171f',acc:'#ff2e88',spin:'dual'}],
  ['drainwyrm','Drain Wyrm','legendary','stamina','god',['spinsteal'],{shape:'round',wings:2,wingWidth:.9,depth:.24,sweep:0,slope:0,height:11,tipHeight:7,diameter:49},{color:'#3fe06b',acc:'#16171f',spin:'left'}],
  ['archerhero','Archer Titan','rare','stamina','god',[],{shape:'round',wings:4,wingWidth:.85,depth:.24,sweep:6,slope:2,height:11,tipHeight:7,diameter:49},{color:'#ff7a1a',acc:'#f2f4f8'}],
  ['aegishero','Aegis Champion','legendary','balance','choz',['bmode'],{shape:'blade',wings:2,wingWidth:.75,depth:.4,sweep:12,slope:8,height:12,tipHeight:6,diameter:50},{color:'#ffd21f',acc:'#e8262f'}],
  ['zenithvalor','Zenith Valor','epic','attack','choz',[],{shape:'blade',wings:3,wingWidth:.76,depth:.46,sweep:20,slope:14,height:12,tipHeight:5,diameter:50},{color:'#f2f4f8',acc:'#1f8bff'}],
  ['geistwyrm','Geist Wyrm','epic','stamina','choz',['spinsteal','rubberblade'],{shape:'round',wings:3,wingWidth:.9,depth:.22,sweep:0,slope:0,height:11,tipHeight:7,diameter:50},{color:'#8a3dff',acc:'#3fe06b',spin:'left'}],
  ['acewyrm','Ace Wyrm','rare','attack','gt',[],{shape:'claw',wings:3,wingWidth:.7,depth:.42,sweep:14,slope:10,height:11,tipHeight:5,diameter:49},{color:'#e8262f',acc:'#ffd21f',chip:true}],
  ['warlord','Warlord Fury','epic','attack','gt',['metalheavy'],{shape:'saw',wings:4,wingWidth:.6,depth:.42,sweep:18,slope:8,height:11,tipHeight:5,diameter:49},{color:'#ff2e88',acc:'#16171f',chip:true}],
  ['solarflare','Solar Flare','epic','attack','sparking',[],{shape:'fin',wings:3,wingWidth:.72,depth:.42,sweep:18,slope:10,height:11,tipHeight:5,diameter:50},{color:'#ff7a1a',acc:'#ffd21f'}],
  ['bravevalor','Brave Valor','rare','attack','sparking',[],{shape:'blade',wings:3,wingWidth:.74,depth:.44,sweep:18,slope:12,height:11,tipHeight:5,diameter:50},{color:'#1f8bff',acc:'#e8262f'}],
  ['ragelance','Rage Lance','epic','attack','sparking',[],{shape:'claw',wings:3,wingWidth:.68,depth:.44,sweep:16,slope:10,height:11,tipHeight:5,diameter:50},{color:'#16171f',acc:'#e8262f',spin:'left'}],
  ['cursefiend','Curse Fiend','rare','defense','sparking',[],{shape:'hammer',wings:3,wingWidth:.9,depth:.24,sweep:0,slope:0,height:12,tipHeight:8,diameter:49},{color:'#8a3dff',acc:'#ffd21f'}],
  ['dynamo','Dynamo Demon','legendary','balance','db',['burstlock'],{shape:'spike',wings:3,wingWidth:.7,depth:.38,sweep:8,slope:6,height:11,tipHeight:6,diameter:51},{color:'#e8262f',acc:'#16171f'}],
  ['saviorvalor','Savior Valor','epic','attack','db',[],{shape:'blade',wings:3,wingWidth:.76,depth:.46,sweep:20,slope:14,height:11,tipHeight:5,diameter:51},{color:'#f2f4f8',acc:'#1f8bff'}],
  ['worldspiral','World Spiral','legendary','balance','db',['dual','burstlock'],{shape:'spike',wings:2,wingWidth:.8,depth:.36,sweep:0,slope:6,height:11,tipHeight:6,diameter:51},{color:'#f2f4f8',acc:'#ffd21f',spin:'dual'}],
  ['guiltylance','Guilty Lance','epic','attack','db',[],{shape:'claw',wings:2,wingWidth:.72,depth:.46,sweep:18,slope:12,height:11,tipHeight:5,diameter:51},{color:'#16171f',acc:'#ff2e88',spin:'left'}],
  ['ultvalor','Ultimate Valor','legendary','attack','bu',['spring'],{shape:'blade',wings:3,wingWidth:.78,depth:.46,sweep:22,slope:14,height:11,tipHeight:5,diameter:52},{color:'#1f8bff',acc:'#ffd21f'}],
  ['promfire','Prominence Firebird','epic','balance','bu',['metalheavy'],{shape:'fin',wings:3,wingWidth:.76,depth:.36,sweep:10,slope:6,height:11,tipHeight:6,diameter:52},{color:'#ff7a1a',acc:'#e8262f'}]
];
// ratchets keep their numbers (points-height) — real-life sizes
const RATCHETS=[[1,60,'rare'],[1,80,'rare'],[2,60,'common'],[2,70,'common'],[3,60,'common'],[3,70,'common'],[3,80,'common'],[3,85,'rare'],[4,50,'rare'],[4,55,'rare'],[4,60,'common'],[4,70,'common'],[4,80,'common'],
  [5,60,'common'],[5,70,'rare'],[5,80,'common'],[6,60,'rare'],[6,80,'rare'],[7,60,'common'],[7,70,'rare'],[7,80,'common'],[9,60,'rare'],[9,70,'epic'],[9,80,'rare']];
// Burst discs: numbered ones keep numbers; named ones renamed. [id,name,rarity,shape,lobes,diameter,thickness,rim,gims,frame]
const B_DISCS=[
  ['d0','0 Disc','common','round',4,36,4,.3],['d1','1 Disc','common','octa',4,36,4.5,.35],['d2','2 Disc','common','wing',3,36,4,.3],['d3','3 Disc','common','star',3,35,4.5,.3],
  ['d4','4 Disc','common','wing',4,36,4,.35],['d5','5 Disc','rare','star',5,36,4.5,.4],['d7','7 Disc','rare','gear',6,37,5,.45],['d8','8 Disc','rare','octa',8,37,5,.4],
  ['d10','10 Disc','rare','round',4,38,5,.5],['d11','11 Disc','epic','wing',2,38,5,.55],['d12','12 Disc','rare','star',6,37,5,.45],
  ['nova','Nova','rare','star',5,38,5,.5],['ballast','Ballast','epic','round',4,39,6,.7],['upright','Upright','rare','wing',2,38,5,.45],['fringe','Fringe','rare','gear',8,39,4.5,.65],
  ['junction','Junction','epic','octa',8,39,6,.6],['spoke','Spoke','rare','wing',6,38,5,.5],['crux','Crux','rare','star',4,38,5,.45],['rift','Rift','epic','gear',4,38,6,.5],
  ['enigma','Enigma','legendary','round',3,40,6,.75,['barrier']],['endless','Endless','epic','round',6,40,5,.7,['outerweight']],['barb','Barb','rare','star',3,38,5,.4],['halberd','Halberd','epic','wing',3,39,5.5,.55]
];
const B_FRAMES=[['comet','common'],['helix','common'],['wingspan','rare'],['dirk','rare'],['flash','epic'],['crater','rare']];
// bits/drivers: [tip key, rarity, system or null for both, extra]
const BITS=[['flat','common','X'],['lowflat','common','X'],['gearflat','rare','X',{gear:true}],['rush','common','X'],['lowrush','rare','X'],['hexa','rare','X'],['taper','common','X'],['hightaper','rare','X'],['point','rare','X'],
  ['ball','common','X'],['orb','rare','X'],['freeball','legendary','X'],['glide','epic','X'],['discball','epic','X'],['needle','common','X'],['metalneedle','rare','X'],['boundspike','epic','X'],['spike','common','X'],
  ['quake','epic','X',{gear:true}],['cyclone','rare','X',{gear:true}],['rubber','epic','X'],['elevate','epic','X'],['unite','rare','X'],['xtreme','rare','X'],['level','epic','X'],['mode','epic','X']];
const DRIVERS=[['xtreme','rare'],['atomic','legendary'],['ball','common'],['bearing','legendary'],['drift','epic'],['mobius','epic'],['jaggy','common'],['variable','rare'],['zephyr','rare'],['hold','rare'],['destroy','rare'],
  ['eternal','epic'],['revolve','epic'],['defense','common'],['massive','common'],['survive','common'],['accel','common'],['mode','epic'],['needle','common'],['flat','common'],['taper','common'],['rubber','epic'],['spike','common']];

// ---------- build each entry's design ----------
const deepSet=(o,p)=>{ Object.entries(p).forEach(([k,v])=>{ if(v&&typeof v==='object'&&!Array.isArray(v)&&o[k]&&typeof o[k]==='object') deepSet(o[k],v); else o[k]=v; }); return o; };
const paint=(d,key,color)=>{ d.paint[key]=Object.assign({},d.paint[key]||BF.defaultPaint(color),{color}); };
function base(sys){ const d=BF.normalize(BF.defaultDesign()); d.system=sys; d.weights={insert:'none',count:0,radius:16,part:sys==='X'?'layer':'layer'}; return BF.normalize(d); }
const CAT=[];
X_BLADES.forEach(([id,name,rar,type,gims,blade,ex])=>CAT.push({id:'x-'+id,name:name+' Blade',short:name,sys:'X',slot:'blade',rarity:rar,type,gims,make(){ let d=base('X'); deepSet(d.blade,blade); d.blade.color=ex.color; d.deco.accent=ex.acc; d.spin=ex.spin||'right';
  if(ex.w) d.weights=Object.assign({part:'layer'},ex.w); if(ex.tier) d.blade.tier=Object.assign({},d.blade.tier,{on:true,wings:6,shape:'round',height:2}); d.gim={blade:gims}; d=BF.normalize(d); paint(d,'blade',ex.color); paint(d,'accent',ex.acc); return d; }}));
B_LAYERS.forEach(([id,name,rar,type,style,gims,blade,ex])=>CAT.push({id:'b-'+id,name:name+' Layer',short:name,sys:'Burst',slot:'blade',rarity:rar,type,style,gims,make(){ let d=base('Burst'); deepSet(d.blade,blade); d.blade.color=ex.color; d.deco.accent=ex.acc; d.spin=ex.spin||'right';
  d.layer={style}; if(ex.chip||style==='gt') d.chip=Object.assign({},d.chip,{on:true}); d.gim={blade:gims}; d=BF.normalize(d); paint(d,'blade',ex.color); paint(d,'accent',ex.acc); return d; }}));
RATCHETS.forEach(([pt,h,rar])=>CAT.push({id:`x-r${pt}${h}`,name:`${pt}-${h} Ratchet`,short:`${pt}-${h}`,sys:'X',slot:'core',rarity:rar,type:h>=80?'stamina':pt>=7?'defense':pt<=2?'attack':'balance',gims:[],make(){ let d=base('X'); d.ratchet.points=pt; d.ratchet.height=h; return BF.normalize(d); }}));
B_DISCS.forEach(([id,name,rar,shape,lobes,dia,th,rim,gims])=>CAT.push({id:'b-'+id,name:/Disc$/.test(name)?name:name+' Disc',short:name,sys:'Burst',slot:'core',rarity:rar,type:rim>=.6?'stamina':th>=5.5?'defense':'balance',gims:gims||[],make(){ let d=base('Burst'); Object.assign(d.disc,{shape,lobes,diameter:dia,thickness:th,rim}); d.gim={core:gims||[]}; return BF.normalize(d); }}));
B_FRAMES.forEach(([fr,rar])=>CAT.push({id:'b-f'+fr,name:`${BF.DISC_FRAMES?BF.DISC_FRAMES[fr].label:fr} Frame + 2 Disc`,short:(BF.DISC_FRAMES?BF.DISC_FRAMES[fr].label:fr)+' Frame',sys:'Burst',slot:'core',rarity:rar,type:'attack',gims:[],make(){ let d=base('Burst'); Object.assign(d.disc,{shape:'wing',lobes:3,diameter:36,thickness:4.5,rim:.35,frame:{on:true,shape:fr,size:4}}); return BF.normalize(d); }}));
BITS.forEach(([k,rar,sys,ex])=>{ const t=BF.TIPS[k]; if(!t) return; CAT.push({id:'x-t'+k,name:t.label+' Bit',short:t.label,sys:'X',slot:'driver',rarity:rar,type:t.mob>=0.8?'attack':t.mob<=0.3?'stamina':'balance',gims:[],make(){ let d=base('X'); d.bit.tip=k; d.bit.gear=!!(ex&&ex.gear); return BF.normalize(d); }}); });
DRIVERS.forEach(([k,rar])=>{ const t=BF.TIPS[k]; if(!t) return; CAT.push({id:'b-t'+k,name:t.burst+' Driver',short:t.burst,sys:'Burst',slot:'driver',rarity:rar,type:t.mob>=0.8?'attack':t.mob<=0.3?'stamina':'balance',gims:[],make(){ let d=base('Burst'); d.bit.tip=k; d.bit.gear=false; return BF.normalize(d); }}); });
CAT.forEach(c=>{ const t=c.slot==='driver'&&BF.TIPS[c.id.replace(/^[xb]-t/,'')]; if(t){ c.gims=(t.gim||[]).concat(c.sys==='Burst'?(t.gimB||[]):[]).concat(t.rubber?['rubbertip']:[]).concat(t.modes?['tmode']:[]); }
  if(c.slot==='core'&&c.sys==='X'){ const m=/r(\d)/.exec(c.id); const pt=+m[1]; c.gims=pt===1?['imbalance']:pt>=9?['barrage']:pt===5?['outerweight']:[]; } });
BF.CATALOG=CAT;

// ---------- lookups + drops ----------
const RAR=['common','rare','epic','legendary','limited'];
const Cat=BF.Catalog={
  all(){ return CAT; },
  get(id){ return CAT.find(c=>c.id===id); },
  design(id){ const c=this.get(id); if(!c) return null; c._d=c._d||c.make(); return BF.normalize(BF.clone(c._d)); },
  // pick a catalog part of this rarity/slot/system (closest rarity if that bucket is empty)
  pool(rarity,slot,sys){ let pool=CAT.filter(c=>c.slot===slot&&(!sys||c.sys===sys)&&c.rarity===rarity);
    for(let k=1;!pool.length&&k<4;k++){ const lo=RAR[RAR.indexOf(rarity)-k], hi=RAR[RAR.indexOf(rarity)+k]; pool=CAT.filter(c=>c.slot===slot&&(!sys||c.sys===sys)&&(c.rarity===lo||c.rarity===hi)); }
    if(!pool.length) pool=CAT.filter(c=>c.slot===slot&&(!sys||c.sys===sys)); return pool; },
  pick(rarity,slot,sys){ const pool=this.pool(rarity,slot,sys); return pool[Math.floor(Math.random()*pool.length)]; },
  owned(){ const s=new Map(); ((BF.Parts&&BF.Parts.list)||[]).forEach(p=>{ if(p.catId) s.set(p.catId,(s.get(p.catId)||0)+1); }); return s; },
  progress(sys){ const own=this.owned(), list=CAT.filter(c=>!sys||c.sys===sys); return {have:list.filter(c=>own.has(c.id)).length,total:list.length}; }
};
// packs and battle drops now give named catalog parts (Studio parts still get their chance first)
function hook(){ const P=BF.Parts; if(!P||!P.create||P.create._cat) return; const orig=P.create;
  P.create=function(slot,d,rarity,source,extra){ const src=String(source||'');
    if(!(extra&&(extra.name||extra.catId))&&!/achievement|starter|shop|staff/.test(src)){ const pk=BF.Packs&&BF.Packs.get(src), sys=(pk&&pk.system)||d.system;
      const c=Cat.pick(rarity==='limited'?'legendary':rarity,slot,sys); if(c){ d=Cat.design(c.id); slot=c.slot; extra=Object.assign({},extra||{},{name:c.name,catId:c.id}); } }
    return orig.call(this,slot,d,rarity,source,extra); };
  P.create._cat=true; }
hook(); addEventListener('load',hook);
})();
