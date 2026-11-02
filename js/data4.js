/* BeyForge v4 — catalog expansion: wing shapes, tips, paint model, themes, parts shop, cosmetics */
(function(){
'use strict';
const BF=window.BF;
BF.VERSION='v4.1';

// ---------- more wing silhouettes ----------
Object.assign(BF.WING_SHAPES, {
  scythe:'Scythe', crescent:'Crescent', wave:'Wave', shield:'Shield', arrow:'Arrowhead',
  twin:'Twin peaks', horn:'Horn', feather:'Feather', fang:'Fang', star:'Star point'
});
// keep "custom" last in menus
{ const c=BF.WING_SHAPES.custom; delete BF.WING_SHAPES.custom; BF.WING_SHAPES.custom=c; }

// ---------- more tips ----------
Object.assign(BF.TIPS, {
  spike:   {label:'Spike',          x:'S',  burst:'Spike',        mu:0.26, rc:0.25, mob:0.12, grip:0.8,  prof:'spike'},
  xtreme:  {label:'Xtreme Flat',    x:'X',  burst:'Xtreme',       mu:0.62, rc:4.0,  mob:1.0,  grip:0.55, prof:'xtreme'},
  dish:    {label:'Dish',           x:'D',  burst:'Dish',         mu:0.4,  rc:2.6,  mob:0.55, grip:0.7,  prof:'dish'},
  unite:   {label:'Unite',          x:'U',  burst:'Unite',        mu:0.32, rc:1.4,  mob:0.5,  grip:0.6,  prof:'unite'},
  level:   {label:'Level Rubber',   x:'LR', burst:'Level',        mu:0.85, rc:4.2,  mob:0.95, grip:0.85, prof:'xtreme', rubber:true},
  bearing: {label:'Bearing Ball',   x:'BB', burst:'Bearing',      mu:0.09, rc:0.5,  mob:0.22, grip:0.4,  prof:'bearing', hardware:'623 ball bearing (3×10×4 mm)'},
  mode:    {label:'Mode Change',    x:'M',  burst:'Mode',         mu:0.3,  rc:0.9,  mob:0.5,  grip:0.6,  prof:'mode',
            modes:{attack:{mu:0.6,rc:3.2,mob:0.9,grip:0.55}, stamina:{mu:0.22,rc:0.5,mob:0.25,grip:0.5}}},
  custom:  {label:'Custom (draw it)',x:'C', burst:'Custom',       mu:0.35, rc:1.5,  mob:0.5,  grip:0.55, prof:'custom'}
});

BF.effTip = d => { const t=BF.TIPS[d.bit.tip]||BF.TIPS.flat; return t.modes ? Object.assign({},t,t.modes[d.bit.mode]||t.modes.attack) : t; };
BF.FINISHES = {matte:'Matte', gloss:'Gloss', satin:'Satin', metallic:'Metallic', chrome:'Chrome', pearl:'Pearl', glow:'Glow'};
BF.PAINT_STYLES = {solid:'Solid', gradient:'Gradient', twotone:'Two-tone', perwing:'Per wing'};
BF.PATTERNS = {none:'None', flames:'Flames', stripes:'Stripes', tiger:'Tiger', camo:'Camo', carbon:'Carbon fiber', lightning:'Lightning', scales:'Scales', hex:'Hex grid', dots:'Dots', waves:'Waves', galaxy:'Galaxy', splatter:'Splatter'};
BF.STICKERS = {star:'Star', bolt:'Bolt', flame:'Flame', crown:'Crown', heart:'Heart', skull:'Skull', eye:'Eye', claw:'Claw marks', target:'Target', wing:'Wing', diamond:'Diamond', number:'Number', text:'Text'};
BF.PAINT_PARTS = {blade:'Blade / Layer', accent:'Accents', ratchet:'Ratchet', disc:'Disc', bit:'Bit / Driver', tip:'Tip', chip:'Chip / Cap', horn:'Horns & spikes'};

BF.defaultPaint = (color, finish) => ({ color, finish:finish||'gloss', style:'solid', color2:'#1b1d27', wingColors:[], pattern:'none', patternColor:'#ffffff', patternScale:1, patternAlpha:0.7, decals:[], stickers:[], drawing:null });

BF.COSMETICS = {
  trail:   {none:'None', ribbon:'Ribbon', sparks:'Sparks', fire:'Fire', lightning:'Lightning', rainbow:'Rainbow'},
  launch:  {none:'None', ring:'Shockwave ring', spiral:'Spiral', lightning:'Lightning strike', petals:'Petal burst'},
  aura:    {none:'None', glow:'Glow', pulse:'Pulse', flame:'Flame aura'},
  win:     {confetti:'Confetti', fireworks:'Fireworks', spotlight:'Spotlight', shockwave:'Shockwave'}
};

// ---------- design upgrade: v3 saves keep working ----------
const base = BF.defaultDesign;
BF.defaultDesign = function(){
  const d=base();
  d.v=4;
  Object.assign(d.blade, { wingShapes:[], mixShapes:false, profile:[1,0.92,0.8,0.65,0.5], lift:0, cutouts:{count:0,size:0.45,pos:0.6,shape:'round'},
    tier:{on:false, diameter:0.62, wings:4, shape:'spike', height:2.5, depth:0.35} });
  d.bit.customTip=[0.2,0.45,0.7,0.85,0.95,1,1,1]; d.bit.mode='attack';
  d.deco.horns={count:0, height:5, lean:20, style:'cone'};
  d.chip={on:false, height:3, emblem:'star', dome:0.6};
  d.element={p:null, s:null};   // v5: chosen primary/secondary element (from what the parts allow)
  d.paint={
    blade: BF.defaultPaint(d.blade.color,'gloss'),
    accent:BF.defaultPaint(d.deco.accent,'glow'),
    ratchet:BF.defaultPaint(d.ratchet.color,'satin'),
    disc:  BF.defaultPaint(d.disc.color,'metallic'),
    bit:   BF.defaultPaint(d.bit.color,'gloss'),
    tip:   BF.defaultPaint(d.bit.tipColor,'matte'),
    chip:  BF.defaultPaint('#ffd21f','chrome'),
    horn:  BF.defaultPaint(d.deco.accent,'metallic')
  };
  d.cos={trail:'ribbon', trailColor:'', launch:'ring', aura:'glow', win:'confetti'};
  return d;
};
const norm=BF.normalize;
BF.normalize=function(d){
  const old=d&&!d.paint;
  const out=norm(d);
  out.layer=Object.assign({style:'single'},out.layer||{}); if(!BF.LAYER_STYLES||!BF.LAYER_STYLES[out.layer.style]) out.layer.style='single';
  out.disc.frame=Object.assign({on:false,shape:'comet',size:3},out.disc.frame||{});
  if(old){ // carry v3 colors into the new paint system
    out.paint.blade.color=out.blade.color; out.paint.accent.color=out.deco.accent; out.paint.ratchet.color=out.ratchet.color;
    out.paint.disc.color=out.disc.color; out.paint.bit.color=out.bit.color; out.paint.tip.color=out.bit.tipColor; out.paint.horn.color=out.deco.accent;
  }
  return out;
};
BF.paintFromLegacy=function(d){ const p=d.paint; p.blade.color=d.blade.color; p.accent.color=d.deco.accent; p.ratchet.color=d.ratchet.color; p.disc.color=d.disc.color; p.bit.color=d.bit.color; p.tip.color=d.bit.tipColor; p.horn.color=d.deco.accent; return d; };
{ const fp=BF.fromPreset, rd=BF.randomDesign;
  BF.fromPreset=p=>BF.paintFromLegacy(fp(p));
  BF.randomDesign=seed=>{ const d=BF.paintFromLegacy(rd(seed)); const r=BF.rng((seed||Date.now())+7), pick=a=>a[Math.floor(r()*a.length)];
    d.paint.blade.finish=pick(Object.keys(BF.FINISHES)); d.paint.blade.style=pick(['solid','gradient','twotone','solid']); d.paint.blade.color2=pick(BF.SWATCHES);
    d.paint.blade.pattern=pick(Object.keys(BF.PATTERNS)); d.paint.blade.patternColor=pick(BF.SWATCHES);
    d.cos={trail:pick(Object.keys(BF.COSMETICS.trail)),trailColor:'',launch:pick(Object.keys(BF.COSMETICS.launch)),aura:pick(Object.keys(BF.COSMETICS.aura)),win:pick(Object.keys(BF.COSMETICS.win))};
    if(r()<0.3) d.deco.horns.count=1+Math.floor(r()*2); if(r()<0.25) d.blade.cutouts.count=1; return d; };
}
// keep the legacy color fields in sync for exports and older code
BF.syncColors=function(d){ const p=d.paint; d.blade.color=p.blade.color; d.deco.accent=p.accent.color; d.ratchet.color=p.ratchet.color; d.disc.color=p.disc.color; d.bit.color=p.bit.color; d.bit.tipColor=p.tip.color; };

// ---------- themes: one tap = shape + paint + emblem + effects ----------
const P=(color,finish,extra)=>Object.assign(BF.defaultPaint(color,finish),extra||{});
BF.THEMES = [
  {id:'dragon', name:'Dragon', blurb:'Scaled claws, fire trail', patch:{blade:{shape:'claw',wings:3,depth:0.42,sweep:-14,slope:12,wingWidth:0.68,profile:[1,0.95,0.85,0.75,0.7]}, deco:{emblem:'fang',texture:'ridges',horns:{count:1,height:5,lean:28,style:'cone'}},
    paint:{blade:P('#b3121f','metallic',{style:'gradient',color2:'#ff7a1a',pattern:'scales',patternColor:'#2a0508',patternAlpha:0.55}), accent:P('#ffd21f','glow'), horn:P('#ffd21f','chrome'), ratchet:P('#1b1d27','satin'), bit:P('#ff7a1a','gloss')}, cos:{trail:'fire',launch:'spiral',aura:'flame',win:'fireworks'}}},
  {id:'wolf', name:'Wolf', blurb:'Fangs and moonlight steel', patch:{blade:{shape:'fang',wings:4,depth:0.38,sweep:10,slope:8,wingWidth:0.6}, deco:{emblem:'eye',texture:'chevrons'},
    paint:{blade:P('#9aa3b5','metallic',{style:'twotone',color2:'#3a4152'}), accent:P('#2ef2ff','glow'), ratchet:P('#16171f','matte'), bit:P('#2b3cff','gloss')}, cos:{trail:'ribbon',launch:'ring',aura:'pulse',win:'shockwave'}}},
  {id:'phoenix', name:'Phoenix', blurb:'Feathered stamina wings', patch:{blade:{shape:'feather',wings:5,depth:0.36,sweep:24,slope:6,wingWidth:0.9,profile:[1,1,1.05,1.1,1.15]}, bit:{tip:'orb'}, deco:{emblem:'flame'},
    paint:{blade:P('#ff7a1a','pearl',{style:'gradient',color2:'#ffd21f',pattern:'flames',patternColor:'#e8262f',patternAlpha:0.6}), accent:P('#fff4c2','glow'), bit:P('#e8262f','gloss')}, cos:{trail:'fire',launch:'petals',aura:'flame',win:'fireworks'}}},
  {id:'shark', name:'Shark', blurb:'Fin blades, ocean blue', patch:{blade:{shape:'fin',wings:3,depth:0.4,sweep:-20,slope:14,wingWidth:0.7}, bit:{tip:'rush'}, deco:{emblem:'fang',texture:'ridges'},
    paint:{blade:P('#1f8bff','gloss',{style:'gradient',color2:'#0b2d5c',pattern:'waves',patternColor:'#9fe6ff',patternAlpha:0.4}), accent:P('#f2f4f8','gloss'), bit:P('#0b2d5c','satin')}, cos:{trail:'ribbon',trailColor:'#9fe6ff',launch:'ring',aura:'glow',win:'shockwave'}}},
  {id:'kraken', name:'Kraken', blurb:'Eight tentacle saw', patch:{blade:{shape:'wave',wings:8,depth:0.3,sweep:30,slope:4,wingWidth:0.95}, bit:{tip:'taper'}, deco:{emblem:'eye'},
    paint:{blade:P('#8a3dff','pearl',{style:'gradient',color2:'#1b0b3a',pattern:'dots',patternColor:'#ff2e88',patternAlpha:0.5}), accent:P('#ff2e88','glow')}, cos:{trail:'ribbon',trailColor:'#8a3dff',launch:'spiral',aura:'pulse',win:'confetti'}}},
  {id:'tiger', name:'Tiger', blurb:'Striped balance brawler', patch:{blade:{shape:'twin',wings:3,depth:0.36,sweep:8,slope:8,wingWidth:0.8}, deco:{emblem:'crown'},
    paint:{blade:P('#ff7a1a','satin',{pattern:'tiger',patternColor:'#16171f',patternAlpha:0.85}), accent:P('#f2f4f8','gloss')}, cos:{trail:'sparks',launch:'ring',aura:'glow',win:'spotlight'}}},
  {id:'viper', name:'Viper', blurb:'Venom-green scythes', patch:{blade:{shape:'scythe',wings:2,depth:0.44,sweep:-25,slope:16,wingWidth:0.75}, deco:{emblem:'fang'},
    paint:{blade:P('#3fe06b','metallic',{style:'gradient',color2:'#0b3a17',pattern:'scales',patternColor:'#0b3a17',patternAlpha:0.5}), accent:P('#ffd21f','glow')}, cos:{trail:'lightning',trailColor:'#3fe06b',launch:'lightning',aura:'pulse',win:'shockwave'}}},
  {id:'golem', name:'Golem', blurb:'Stone shield fortress', patch:{blade:{shape:'shield',wings:4,depth:0.26,sweep:0,slope:0,wingWidth:0.9,profile:[1,1,0.95,0.9,0.85]}, bit:{tip:'needle'}, deco:{emblem:'diamond',texture:'studs'}, weights:{insert:'ball8',count:4,radius:18},
    paint:{blade:P('#7a6f62','matte',{pattern:'camo',patternColor:'#4a4238',patternAlpha:0.6}), accent:P('#ff7a1a','glow')}, cos:{trail:'sparks',launch:'ring',aura:'none',win:'shockwave'}}},
  {id:'raijin', name:'Raijin', blurb:'Storm god, lightning arrows', patch:{blade:{shape:'arrow',wings:3,depth:0.4,sweep:18,slope:10,wingWidth:0.66}, bit:{tip:'xtreme',gear:true}, deco:{emblem:'bolt'},
    paint:{blade:P('#ffd21f','chrome',{pattern:'lightning',patternColor:'#2b3cff',patternAlpha:0.8}), accent:P('#2ef2ff','glow')}, cos:{trail:'lightning',trailColor:'#ffd21f',launch:'lightning',aura:'pulse',win:'fireworks'}}},
  {id:'frost', name:'Frost', blurb:'Crystal star stamina', patch:{blade:{shape:'star',wings:6,depth:0.3,sweep:0,slope:6,wingWidth:0.85}, bit:{tip:'bearing'}, deco:{emblem:'diamond'},
    paint:{blade:P('#bfefff','pearl',{style:'gradient',color2:'#1f8bff',pattern:'hex',patternColor:'#ffffff',patternAlpha:0.35}), accent:P('#ffffff','glow')}, cos:{trail:'ribbon',trailColor:'#bfefff',launch:'petals',aura:'glow',win:'confetti'}}},
  {id:'void', name:'Void', blurb:'Galaxy crescent', patch:{blade:{shape:'crescent',wings:3,depth:0.4,sweep:20,slope:10,wingWidth:0.8}, deco:{emblem:'eye'},
    paint:{blade:P('#16171f','gloss',{pattern:'galaxy',patternColor:'#a07bff',patternAlpha:0.9}), accent:P('#a07bff','glow')}, cos:{trail:'rainbow',launch:'spiral',aura:'pulse',win:'fireworks'}}},
  {id:'horned', name:'Minotaur', blurb:'Horned smash attacker', patch:{blade:{shape:'horn',wings:2,depth:0.42,sweep:10,slope:18,wingWidth:0.55}, deco:{emblem:'crown',horns:{count:2,height:7,lean:15,style:'horn'}},
    paint:{blade:P('#5a2a12','satin',{style:'gradient',color2:'#c7a052'}), horn:P('#f2f4f8','pearl'), accent:P('#ff2e88','glow')}, cos:{trail:'sparks',launch:'ring',aura:'flame',win:'shockwave'}}}
];
BF.applyTheme=function(d,id){
  const t=BF.THEMES.find(x=>x.id===id); if(!t) return d;
  const keep={system:d.system, spin:d.spin, fit:d.fit, print:d.print};
  const nd=BF.merge(BF.defaultDesign(), BF.clone(t.patch));
  Object.assign(nd,keep); if(d.system==='Burst'){ nd.blade.diameter=48; nd.blade.height=12; }
  nd.nameMode='auto'; nd.nameSeed=Math.floor(Math.random()*9999); nd.theme=id;
  BF.syncColors(nd); return nd;
};

// ---------- parts shop: premade parts pulled from presets + themes ----------
BF.partsCatalog=function(){
  const out={blade:[],ratchet:[],bit:[],disc:[]};
  const add=(cat,name,data,src)=>out[cat].push({name,data:BF.clone(data),src});
  BF.PRESETS.forEach(p=>{ const d=BF.fromPreset(p);
    add('blade',p.name.split(' ')[0]+' blade',{blade:d.blade},p.name);
    if(p.sys==='X') add('ratchet',`${d.ratchet.points}-${d.ratchet.height}`,{ratchet:d.ratchet},p.name);
    else add('disc',BF.discCode(d),{disc:d.disc},p.name);
  });
  BF.THEMES.forEach(t=>{ const d=BF.applyTheme(BF.defaultDesign(),t.id); add('blade',t.name+' blade',{blade:d.blade,paint:{blade:d.paint.blade}},'Theme'); });
  Object.entries(BF.TIPS).forEach(([k,t])=>add('bit',t.label+' · '+t.x,{bit:{tip:k}},'Tip'));
  [3,4,5,6,7,9].forEach(n=>[50,60,70,80].forEach(h=>add('ratchet',`${n}-${h}`,{ratchet:{points:n,height:h}},'Stock')));
  return out;
};
})();
