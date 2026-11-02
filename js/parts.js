/* BeyForge v5.1 — owned part copies: rarity, shiny, IVs (fixed), EVs (player-assigned), levels, skill trees,
   blader tree, packs, drops, minting, starters. Stored per account (Firestore users/{uid}/parts) or on this device. */
(function(){
'use strict';
const BF=window.BF;
const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

BF.RARITY = {
  common:   {label:'Common',    color:'#9aa3b5', ivFloor:0,  release:20},
  rare:     {label:'Rare',      color:'#2ef2ff', ivFloor:6,  release:60},
  epic:     {label:'Epic',      color:'#a07bff', ivFloor:12, release:180},
  legendary:{label:'Legendary', color:'#ffb020', ivFloor:20, release:600},
  limited:  {label:'Limited',   color:'#ff2e88', ivFloor:16, release:0}
};
BF.PSTATS = {atk:'Attack', def:'Defense', sta:'Stamina', brs:'Burst res.', stb:'Stability'};
const SK=Object.keys(BF.PSTATS);
const IV_MAX=31, EV_STAT_MAX=30, EV_PER_LV=3, LV_MAX=30, SHINY_RATE=1/64;
BF.PART_LIMITS={IV_MAX,EV_STAT_MAX,EV_PER_LV,LV_MAX};
const ODDS = {
  pack:     {common:0.6, rare:0.28, epic:0.1, legendary:0.02},
  crate:    {epic:0.0, legendary:1},
  mint:     {common:0.75, rare:0.2, epic:0.05},
  drop:     {common:0.55, rare:0.3, epic:0.12, legendary:0.03},
  starter:  {common:1}
};
BF.PACKS = {
  pack:  {label:'Booster pack', desc:'3 parts — one blade, one core, one driver. 2% legendary chance each.', price:300},
  crate: {label:'Legendary crate', desc:'1 guaranteed Legendary part (IVs 20+).', price:3000}
};
BF.MINT_PRICE=150;
const roll=odds=>{ let r=Math.random(), last='common'; for(const [k,p] of Object.entries(odds)){ last=k; if((r-=p)<0) return k; } return last; };

// ---------- part <-> design ----------
const SLOTS=['blade','core','driver'];
BF.PART_SLOTS=SLOTS;
function extract(d,slot){
  d=BF.clone(d); const P=d.paint||{};
  if(slot==='blade') return {system:d.system, spin:d.spin, blade:d.blade, deco:d.deco, chip:d.chip, lock:d.lock, element:null,
    weights:d.weights.part==='layer'||d.system==='X'?d.weights:null, paint:{blade:P.blade,accent:P.accent,chip:P.chip,horn:P.horn}};
  if(slot==='core') return d.system==='X' ? {system:'X', ratchet:d.ratchet, paint:{ratchet:P.ratchet}}
    : {system:'Burst', disc:d.disc, weights:d.weights.part==='disc'?d.weights:null, paint:{disc:P.disc}};
  return {system:d.system, bit:d.bit, paint:{bit:P.bit,tip:P.tip}};
}
function nameOf(slot,data){
  if(slot==='blade'){ let sh=(BF.WING_SHAPES[data.blade.shape]||'Edge').split(' (')[0].split(' /')[0].split(' —')[0]; if(sh==='Blade') sh='Edge'; return `${sh} ${data.system==='X'?'Blade':'Layer'}`; }
  if(slot==='core') return data.system==='X' ? `${data.ratchet.points}-${data.ratchet.height} Ratchet` : `${(data.disc.shape[0].toUpperCase()+data.disc.shape.slice(1))} Disc`;
  const t=BF.TIPS[data.bit.tip]||{label:'Custom'}; return `${t.label} ${data.system==='X'?(data.bit.gear?'Gear Bit':'Bit'):'Driver'}`;
}
// build a battle design out of 3 owned copies
function assemble(copies,name){
  const [B,C,D]=copies; let d=BF.defaultDesign(); d.system=B.data.system; d.spin=B.data.spin||'right';
  Object.assign(d,{blade:B.data.blade, deco:B.data.deco, chip:B.data.chip||d.chip, lock:B.data.lock||d.lock});
  if(B.data.weights) d.weights=B.data.weights;
  if(d.system==='X') d.ratchet=C.data.ratchet; else { d.disc=C.data.disc; if(C.data.weights) d.weights=C.data.weights; }
  d.bit=D.data.bit;
  d.paint=Object.assign(d.paint,B.data.paint,C.data.paint,D.data.paint);
  d=BF.normalize(d); BF.syncColors(d);
  if(name){ d.nameMode='manual'; d.name=name; }
  return d;
}

// ---------- skill trees ----------
const PERKS={ blade:[['atk','Sharp Edges'],['def','Reinforced Rim']], core:[['brs','Tight Lock'],['stb','Low Center']], driver:[['sta','Smooth Tip'],['stb','Grip Control']] };
BF.partTree = slot=>[
  {id:'m2',  lv:3,  kind:'move', label:'Learn move 2'},
  {id:'t1',  lv:5,  kind:'tier', label:'Bronze glow', tier:'bronze'},
  {id:'m3',  lv:8,  kind:'move', label:'Learn move 3'},
  {id:'p10', lv:10, kind:'perk', label:'Perk', choices:PERKS[slot].map(([s,l])=>({id:s,label:`${l} (+4% ${BF.PSTATS[s]})`,stat:s,v:0.04}))},
  {id:'u12', lv:12, kind:'upgrade', label:'Upgrade a move'},
  {id:'t2',  lv:15, kind:'tier', label:'Silver glow', tier:'silver'},
  {id:'p20', lv:20, kind:'perk', label:'Perk', choices:PERKS[slot].map(([s,l])=>({id:s,label:`${l} II (+6% ${BF.PSTATS[s]})`,stat:s,v:0.06}))},
  {id:'u25', lv:25, kind:'upgrade', label:'Upgrade a move'},
  {id:'t3',  lv:30, kind:'tier', label:'Gold glow', tier:'gold'}
];
BF.BLADER_TREE = [
  {id:'steady', cost:1, label:'Steady Hands', desc:'Perfect-launch zone is wider.'},
  {id:'scout',  cost:1, label:'Scout', desc:'+10% chance of a part drop after wins.'},
  {id:'merchant',cost:2, req:'scout', label:'Merchant', desc:'Packs and crates cost 10% less.'},
  {id:'quick',  cost:2, req:'steady', label:'Quick Lean', desc:'Lean recharges 25% faster.'},
  {id:'grit',   cost:2, req:'steady', label:'Grit', desc:'+4% launch spin.'},
  {id:'trainer',cost:2, req:'scout', label:'Trainer', desc:'Parts earn 25% more XP.'},
  {id:'focus',  cost:3, req:'grit', label:'Focus', desc:'Moves last 15% longer.'},
  {id:'collector',cost:3, req:'merchant', label:'Collector', desc:'Shiny chance doubled.'}
];

// ---------- level math ----------
BF.partLevel = xp=>{ let L=1, need=40; xp=xp||0; while(L<LV_MAX && xp>=need){ xp-=need; L++; need=40+L*20; } return {lv:L, into:xp, need:L>=LV_MAX?0:need}; };
BF.ivGrade = v=>v>=30?'S':v>=24?'A':v>=16?'B':v>=8?'C':'D';

const P = BF.Parts = {
  list:[], decks:[], listeners:[], ready:false,
  on(f){ this.listeners.push(f); }, emit(){ this.listeners.forEach(f=>{ try{ f(this); }catch(e){ console.error(e); } }); },
  A(){ return BF.Account; },
  cloud(){ const A=this.A(); return !!(A&&A.profile&&A.db); },
  col(uid){ return this.A().ref(uid).collection('parts'); },
  // ----- storage -----
  init(){
    const load=()=>{
      if(this._unsub){ this._unsub(); this._unsub=null; }
      if(this.cloud()){
        this._unsub=this.col().onSnapshot(qs=>{ const l=[]; qs.forEach(d=>l.push(Object.assign({id:d.id},d.data()))); this.list=l; this.ready=true; this.emit(); },e=>console.warn('parts',e));
        this.decks=(this.A().profile.decks)||[]; this.migrate();
      } else { this.list=BF.LS.get('bf.parts',[]); this.decks=BF.LS.get('bf.decks',[]); this.ready=true; this.emit(); }
    };
    load(); let last=null;
    BF.Account&&BF.Account.on(a=>{ const uid=a.profile&&a.user?a.user.uid:null; if(uid!==last){ last=uid; load(); } else if(a.profile){ this.decks=a.profile.decks||[]; this.emit(); } });
  },
  async migrate(){ // device parts move into the account once
    const A=this.A(), key='bf.partsMigrated.'+A.user.uid, local=BF.LS.get('bf.parts',[]); if(BF.LS.get(key,false)||!local.length) return;
    for(const p of local){ const {id,...rest}=p; await this.col().doc(id).set(rest).catch(()=>{}); }
    const ld=BF.LS.get('bf.decks',[]); if(ld.length) await A.update({decks:[...(A.profile.decks||[]),...ld].slice(0,24)}).catch(()=>{});
    BF.LS.set(key,true); BF.LS.set('bf.parts',[]); BF.LS.set('bf.decks',[]);
  },
  async put(p){ if(this.cloud()){ const {id,...rest}=p; await this.col().doc(id).set(rest); return; } const i=this.list.findIndex(x=>x.id===p.id); if(i>=0) this.list[i]=p; else this.list.push(p); BF.LS.set('bf.parts',this.list); this.emit(); },
  async patch(id,data){ if(this.cloud()) return this.col().doc(id).update(data); const p=this.get(id); if(!p) return; Object.assign(p,data); BF.LS.set('bf.parts',this.list); this.emit(); },
  async remove(id){ if(this.cloud()) return this.col().doc(id).delete(); this.list=this.list.filter(p=>p.id!==id); BF.LS.set('bf.parts',this.list); this.decks=this.decks.filter(k=>!k.parts.includes(id)); BF.LS.set('bf.decks',this.decks); this.emit(); },
  async saveDecks(){ if(this.cloud()) return this.A().update({decks:this.decks}); BF.LS.set('bf.decks',this.decks); this.emit(); },
  get(id){ return this.list.find(p=>p.id===id); },
  bySlot(slot){ return this.list.filter(p=>p.slot===slot); },

  // ----- creating copies (IVs roll here and never change) -----
  make(slot,d,rarity,source){
    const R=BF.RARITY[rarity]||BF.RARITY.common, data=extract(d,slot), iv={};
    SK.forEach(s=>iv[s]=R.ivFloor+Math.floor(Math.random()*(IV_MAX-R.ivFloor+1)));
    const shinyRate=SHINY_RATE*(this.blader().includes('collector')?2:1);
    return {id:rid(), slot, system:data.system, name:nameOf(slot,data), rarity, shiny:Math.random()<shinyRate, iv,
      ev:{atk:0,def:0,sta:0,brs:0,stb:0}, xp:0, tree:{}, data, source:source||'mint', ts:Date.now()};
  },
  shinyPaint(p){ // shiny copies get an alternate chrome/pearl finish with a hue-shifted color
    Object.values(p.data.paint||{}).forEach(pt=>{ if(!pt) return; const c=new THREE.Color(pt.color); const hsl={}; c.getHSL(hsl); c.setHSL((hsl.h+0.5)%1,Math.max(0.6,hsl.s),Math.min(0.62,Math.max(0.42,hsl.l))); pt.color='#'+c.getHexString(); pt.finish=Math.random()<0.5?'chrome':'pearl'; });
    return p;
  },
  async create(slot,d,rarity,source,extra){ const p=this.make(slot,d,rarity,source); if(extra) Object.assign(p,extra); if(p.shiny) this.shinyPaint(p);
    if(['legendary','limited'].includes(rarity)&&!p.sig) p.sig=BF.sigFor(BF.partElements(d)[slot]);
    await this.put(p); return p; },
  // legendary & limited parts carry a signature move (older copies get one derived from their element)
  sigOf(p,d){ if(!['legendary','limited'].includes(p.rarity)) return null; return p.sig||BF.sigFor(BF.partElements(d)[p.slot]); },
  randomDesign(system){ let d; for(let k=0;k<6;k++){ d=BF.randomDesign((Math.random()*1e9)|0); if(!system||d.system===system) break; } if(system&&d.system!==system){ d.system=system; d=BF.normalize(d); } return d; },
  async openPack(kind,source){ return BF.Packs.open(BF.Packs.get(kind)?kind:'pack',source); },
  price(kind){ if(kind==='mint') return BF.MINT_PRICE; return BF.Packs.price(BF.Packs.get(kind)); },
  async spend(n){ const A=this.A(); if(A&&A.profile){ if((A.profile.coins||0)<n) throw new Error('Not enough coins'); await A.update({coins:firebase.firestore.FieldValue.increment(-n)}); return; }
    throw new Error('Sign in (Blader tab) to earn and spend coins'); },
  async buyPack(kind){ return BF.Packs.buy(kind); },
  async mint(slot,d){ await this.spend(this.price('mint')); return this.create(slot,d,roll(ODDS.mint),'mint'); },
  // starter: pick a type, get that Bey's 3 parts + a box of 3 commons
  starterDone(){ return this.list.length>0 || BF.LS.get('bf.starter',false); },
  async claimStarter(d,name){
    const made=[]; for(const slot of SLOTS) made.push(await this.create(slot,d,'common','starter'));
    const sys=d.system; for(const slot of SLOTS) made.push(await this.create(slot,this.randomDesign(sys),'common','starter'));
    this.decks.push({id:rid(),name,parts:made.slice(0,3).map(p=>p.id)}); await this.saveDecks(); BF.LS.set('bf.starter',true);
    return made;
  },

  // ----- progression -----
  level(p){ return BF.partLevel(p.xp).lv; },
  evPoints(p){ return (this.level(p)-1)*EV_PER_LV; },
  evUsed(p){ return SK.reduce((a,s)=>a+(p.ev[s]||0),0); },
  async setEV(p,stat,v){ v=clamp(Math.round(v),0,EV_STAT_MAX); const ev=Object.assign({},p.ev,{[stat]:v}); if(SK.reduce((a,s)=>a+ev[s],0)>this.evPoints(p)) return false; await this.patch(p.id,{ev}); return true; },
  async resetEV(p){ await this.patch(p.id,{ev:{atk:0,def:0,sta:0,brs:0,stb:0}}); },
  async setIV(p,stat,v){ const A=this.A(); if(!(A&&A.can&&A.can('editIV'))) throw new Error('Only the owner or staff with IV access can change IVs'); const iv=Object.assign({},p.iv,{[stat]:clamp(Math.round(v),0,IV_MAX)}); await this.patch(p.id,{iv}); },
  async choose(p,nodeId,choice){ const n=BF.partTree(p.slot).find(x=>x.id===nodeId); if(!n||this.level(p)<n.lv||(p.tree||{})[nodeId]) return; await this.patch(p.id,{tree:Object.assign({},p.tree,{[nodeId]:choice})}); },
  async repaint(p,key,color){ const data=BF.clone(p.data); if(!data.paint[key]) return; data.paint[key].color=color; await this.patch(p.id,{data}); },
  tier(p){ const L=this.level(p); return L>=30?'gold':L>=15?'silver':L>=5?'bronze':null; },
  movesUnlocked(p,pool){ const L=this.level(p); return pool.filter((m,i)=>i===0||(i===1&&L>=3)||(i===2&&L>=8)).map(m=>m.id); },
  // stat multipliers + move levels for a Battle Bey (applied in BF.fighter when the match allows progression)
  progOf(copies,d){
    const mul={atk:1,def:1,sta:1,brs:1,stb:1}, moveLv={}, unlocked=[], pools=BF.movePools(d);
    copies.forEach((p,k)=>{ const slot=SLOTS[k];
      SK.forEach(s=>mul[s]+=(p.iv[s]||0)/IV_MAX*0.02+(p.ev[s]||0)/EV_STAT_MAX*0.04);
      BF.partTree(slot).forEach(n=>{ const c=(p.tree||{})[n.id]; if(!c) return;
        if(n.kind==='perk'){ const ch=n.choices.find(x=>x.id===c); if(ch) mul[ch.stat]+=ch.v; }
        if(n.kind==='upgrade') moveLv[c]=(moveLv[c]||1)+1; });
      unlocked.push(...this.movesUnlocked(p,pools[slot])); if(d.sigs&&d.sigs[slot]) unlocked.push(slot+':sig'); });
    return {mul, moveLv, unlocked, copyIds:copies.map(p=>p.id), tiers:copies.map(p=>this.tier(p)), shiny:copies.map(p=>!!p.shiny)};
  },
  deckDesign(deck){
    const copies=deck.parts.map(id=>this.get(id)); if(copies.some(c=>!c)) return null;
    const d=assemble(copies,deck.name); d.sigs={}; copies.forEach((p,k)=>{ const sg=this.sigOf(p,d); if(sg) d.sigs[SLOTS[k]]=sg; });
    d.prog=this.progOf(copies,d); d.deckId=deck.id; return d;
  },
  validDeck(parts){ const c=parts.map(id=>this.get(id)); if(c.some(x=>!x)) return 'Pick a blade, a core and a driver';
    if(c.map(x=>x.slot).join()!==SLOTS.join()) return 'Pick one of each part'; if(new Set(c.map(x=>x.system)).size>1) return 'All 3 parts must be the same system (X or Burst)'; return null; },
  async addDeck(name,parts){ const err=this.validDeck(parts); if(err) throw new Error(err); const k={id:rid(),name:String(name||'My Bey').slice(0,28),parts}; this.decks.push(k); await this.saveDecks(); return k; },
  async removeDeck(id){ this.decks=this.decks.filter(k=>k.id!==id); await this.saveDecks(); },

  // ----- blader tree (account-wide) -----
  blader(){ const A=this.A(); return (A&&A.profile&&A.profile.blader)||BF.LS.get('bf.blader',[]); },
  bladerPoints(){ const A=this.A(), lv=(A&&A.profile&&A.profile.level)||1; return Math.max(0,lv-1)-this.blader().reduce((a,id)=>a+((BF.BLADER_TREE.find(n=>n.id===id)||{}).cost||0),0); },
  async learn(id){ const n=BF.BLADER_TREE.find(x=>x.id===id), have=this.blader(); if(!n||have.includes(id)) return;
    if(n.req&&!have.includes(n.req)) throw new Error('Learn '+BF.BLADER_TREE.find(x=>x.id===n.req).label+' first');
    if(this.bladerPoints()<n.cost) throw new Error('Not enough blader points — level up by battling');
    const next=[...have,id]; const A=this.A(); if(A&&A.profile) await A.update({blader:next}); else BF.LS.set('bf.blader',next); this.emit(); },

  // ----- rewards after a match with a Battle Bey -----
  async reward(d,{won,rounds,mode,cpuLevel}){
    if(!d||!d.prog||!d.prog.copyIds) return null;
    const bl=this.blader(), xpGain=Math.round((rounds*15+(won?40:10))*(mode==='online'?1.5:1)*(bl.includes('trainer')?1.25:1)*(BF.Live?BF.Live.mult('xp'):1));
    const ups=[];
    for(const id of d.prog.copyIds){ const p=this.get(id); if(!p) continue; const before=this.level(p), xp=(p.xp||0)+xpGain; await this.patch(id,{xp}).catch(()=>{}); const after=BF.partLevel(xp).lv; if(after>before) ups.push(`${p.name} → Lv ${after}`); }
    let drop=null;
    if(won){ const chance=0.22+({hard:0.08,expert:0.15}[cpuLevel]||0)+(mode==='online'?0.12:0)+(bl.includes('scout')?0.1:0);
      if(Math.random()<chance*(BF.Live?BF.Live.mult('drops'):1)){ const slot=SLOTS[Math.floor(Math.random()*3)]; drop=await this.create(slot,this.randomDesign(),roll(ODDS.drop),'drop'); } }
    return {xpGain,ups,drop};
  }
};
BF.Parts.extract=extract; BF.Parts.assemble=assemble; BF.Parts.nameOf=nameOf;

// ---------- apply progression to fighters ----------
const fighter0=BF.fighter;
BF.fighter=function(d,name){
  const f=fighter0(d,name), pr=d&&d.prog;
  if(pr&&pr.mul&&!d.noProg){ const m=pr.mul;
    f.atk*=m.atk; f.def*=m.def; f.brs=Math.min(100,f.brs*m.brs); f.stb=Math.min(100,f.stb*m.stb);
    f.fric/=m.sta; f.drag/=m.sta; }
  return f;
};
})();
