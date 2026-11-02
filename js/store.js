/* BeyForge v6.3 — Store: gems, daily + weekly featured rotation, packs, part offers, cosmetics, bundles,
   wishlist, try-on, gifting, owner sales/featured/price overrides (config/shop), ranked season gem rewards */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A=()=>BF.Account, FV=()=>firebase.firestore.FieldValue;
const day=()=>new Date().toISOString().slice(0,10), week=()=>Math.floor((Date.now()/86400000+3)/7);
const rng=seed=>{ let s=seed>>>0||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; return (s>>>0)/4294967296; }; };
const hash=str=>{ let h=2166136261; for(const c of String(str)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; };
const GEM_RATE=25;   // 25 coins ≈ 1 gem when an item can be bought with either

// ---------- gems ----------
BF.Gems={
  get(){ const a=A(); return (a&&a.profile&&a.profile.gems)||0; },
  async add(n,why){ const a=A(); if(!(a&&a.profile)||!n) return; await a.update({gems:FV().increment(n)}).catch(()=>{}); BF.App&&BF.App.toast(`+${n} 💎 ${why||''}`.trim(),'good'); },
  async spend(n){ const a=A(); if(!(a&&a.profile)) throw new Error('Sign in to use gems'); if(this.get()<n) throw new Error('Not enough gems'); await a.update({gems:FV().increment(-n)}); }
};
// monthly ranked seasons: when a new month starts, you get gems for the rating you finished on
BF.Season={
  id(){ return new Date().toISOString().slice(0,7); },
  reward(r){ return r>=1400?80:r>=1300?50:r>=1200?35:r>=1100?20:10; },
  async check(){ const a=A(), p=a&&a.profile; if(!p) return; const cur=this.id();
    if(!p.season){ await a.update({season:cur}).catch(()=>{}); return; }
    if(p.season!==cur){ const played=p.stats&&p.stats.ranked&&((p.stats.ranked.wins||0)+(p.stats.ranked.losses||0))>0;
      await a.update({season:cur}).catch(()=>{}); if(played) await BF.Gems.add(this.reward(p.rating||1000),`Ranked season ${p.season} reward`); } }
};

// ---------- catalog ----------
const BUNDLES={
  inferno:{name:'Inferno Bundle',desc:'Burn the stadium down.',colors:['#ff6a1a','#ffd21f'],items:['c:pattern:flames','c:trail:fire','c:aura:flame','c:frame:flame','c:banner:flames','p:element']},
  storm:  {name:'Storm Bundle',desc:'Ride the lightning.',colors:['#ffd21f','#2ef2ff'],items:['c:pattern:lightning','c:trail:lightning','c:launch:lightning','c:banner:storm','c:frame:crystal','p:pack']},
  royal:  {name:'Royal Bundle',desc:'Chrome, gold and glory.',colors:['#ffd36a','#c8ced8'],items:['c:finish:chrome','c:card:gold','c:frame:gold','c:win:fireworks','p:elite']},
  rookie: {name:'Rookie Bundle',desc:'Everything a new blader needs.',colors:['#2ef2ff','#a07bff'],items:['c:trail:sparks','c:aura:pulse','c:card:neon','c:frame:neon','p:pack','p:pack']},
  cosmos: {name:'Cosmos Bundle',desc:'Out of this world.',colors:['#a07bff','#ff2e88'],items:['c:pattern:galaxy','c:banner:galaxy','c:card:darkmatter','c:trail:rainbow','p:mystery']}
};
BF.BUNDLES=BUNDLES;
const OFFER_PRICE={rare:{c:500,g:20},epic:{c:1200,g:45},legendary:{c:4000,g:140}};

const S = BF.Store6 = {
  cfg:{}, tab:'featured',
  listen(){ const a=A(); if(this._l||!a||!a.db) return; this._l=true; a.db.collection('config').doc('shop').onSnapshot(s=>{ this.cfg=s.data()||{}; if(!$('#view-shop').hidden) this.render(); },()=>{}); },
  sale(){ const s=this.cfg.sale; return s&&s.pct>0&&(!s.ends||s.ends>Date.now())?s:null; },
  // owner price overrides + active sale
  adjust(id,base){ const o=this.cfg.prices&&this.cfg.prices[id]; let p=o&&o.coins!=null?o.coins:base; const sl=this.sale(); if(sl) p=Math.round(p*(1-sl.pct/100)); return p; },
  // ----- item model -----
  item(id){
    const [t,a,b,c]=id.split(':');
    if(t==='c'){ const coins=BF.Shop.price(a,b); return coins||BF.Shop.base(a,b)?{id,type:'cosmetic',cat:a,k:b,name:BF.Shop.label(a,b),sub:BF.Shop.CATS[a],coins,gems:Math.ceil(coins/GEM_RATE),owned:BF.Shop.has(a,b),tryable:true,giftable:true}:null; }
    if(t==='p'){ const p=BF.Packs.get(a); if(!p||p.enabled===false) return null; return {id,type:'pack',pack:p,name:p.name,sub:BF.Packs.oddsText(p),coins:this.adjust(id,BF.Packs.price(p)),gems:p.gems||Math.ceil(p.price/GEM_RATE),giftable:true}; }
    if(t==='o'){ const d=BF.randomDesign(+a), part={slot:b,data:BF.Parts.extract(d,b)}; const pr=OFFER_PRICE[c]||OFFER_PRICE.rare;
      return {id,type:'part',slot:b,rarity:c,design:d,name:BF.Parts.nameOf(b,part.data),sub:`${BF.RARITY[c].label} ${BF.PART_LABEL[b]} · ${BF.ELEMENTS[BF.partElements(d)[b]].icon} ${BF.ELEMENTS[BF.partElements(d)[b]].label}`,coins:this.adjust(id,pr.c),gems:pr.g,part}; }
    if(t==='l'){ const lp=BF.Live&&BF.Live.parts.find(x=>x.id===a); if(!lp||!(lp.shopPrice>0)) return null; const d=BF.normalize(BF.clone(lp.design)), el=BF.ELEMENTS[BF.partElements(d)[lp.slot]];
      return {id,type:'part',slot:lp.slot,rarity:lp.rarity,design:d,live:lp,name:lp.name,sub:`${BF.RARITY[lp.rarity].label} ${BF.PART_LABEL[lp.slot]}${el?` · ${el.icon} ${el.label}`:''}`,coins:this.adjust(id,lp.shopPrice),gems:lp.shopGems||Math.ceil(lp.shopPrice/GEM_RATE),part:{slot:lp.slot,data:BF.Parts.extract(d,lp.slot)}}; }
    if(t==='b'){ const B=BUNDLES[a]; if(!B) return null; const its=B.items.map(x=>this.item(x)).filter(Boolean), full=its.reduce((s,x)=>s+(x.owned?0:x.coins),0);
      const coins=this.adjust(id,Math.round(full*0.7/10)*10); return {id,type:'bundle',name:B.name,sub:B.desc,bundle:B,items:its,full,coins,gems:Math.ceil(coins/GEM_RATE),owned:its.every(x=>x.type!=='cosmetic'||x.owned)&&!its.some(x=>x.type==='pack'),giftable:false}; }
    return null;
  },
  paidCosmetics(){ const out=[]; Object.entries(BF.Shop.P).forEach(([cat,m])=>Object.entries(m).forEach(([k,v])=>{ if(v>0) out.push(`c:${cat}:${k}`); })); return out; },
  // ----- rotations -----
  daily(){ const r=rng(hash('daily'+day())), cos=this.paidCosmetics().filter(id=>!this.item(id).owned), pick=[];
    while(pick.length<4&&cos.length){ pick.push(cos.splice(Math.floor(r()*cos.length),1)[0]); }
    const slots=BF.PART_SLOTS, rr=()=>r()<0.1?'legendary':'epic';
    pick.push(`o:${Math.floor(r()*1e9)}:${slots[Math.floor(r()*3)]}:${rr()}`, `o:${Math.floor(r()*1e9)}:${slots[Math.floor(r()*3)]}:rare`);
    return pick.map(id=>this.item(id)).filter(Boolean); },
  featured(){ if(this.cfg.featured&&this.cfg.featured.length&&(!this.cfg.featuredEnds||this.cfg.featuredEnds>Date.now())) return this.cfg.featured.map(id=>this.item(id)).filter(Boolean);
    const r=rng(hash('wk'+week())), bk=Object.keys(BUNDLES), prem=['c:theme:xtreme','c:theme:neon','c:theme:metal','c:theme:anime','c:theme:burst','c:card:holo','c:card:darkmatter','c:frame:gold'];
    return [this.item('b:'+bk[Math.floor(r()*bk.length)]),this.item(`o:${Math.floor(r()*1e9)}:${BF.PART_SLOTS[Math.floor(r()*3)]}:legendary`),this.item(prem[Math.floor(r()*prem.length)])].filter(Boolean); },
  untilMidnight(){ const n=new Date(), m=new Date(n); m.setHours(24,0,0,0); const s=Math.floor((m-n)/1000); return `${Math.floor(s/3600)}h ${Math.floor(s%3600/60)}m`; },
  // ----- wishlist -----
  wish(){ const a=A(); return (a&&a.profile&&a.profile.wish)||BF.LS.get('bf.wish',[]); },
  async toggleWish(id){ const w=this.wish().slice(), i=w.indexOf(id); i>=0?w.splice(i,1):w.push(id); const a=A(); if(a&&a.profile) await a.update({wish:w}).catch(()=>{}); else BF.LS.set('bf.wish',w); this.render(); },
  // ----- buying -----
  async pay(it,cur){ const a=A(); if(!(a&&a.profile)) throw new Error('Sign in (Blader tab) to shop');
    if(cur==='gems') await BF.Gems.spend(it.gems); else { if((a.profile.coins||0)<it.coins) throw new Error('Not enough coins'); await a.update({coins:FV().increment(-it.coins)}); } },
  async grant(it,src){ const a=A(); const out=[];
    if(it.type==='cosmetic') await a.update({unlocks:FV().arrayUnion(it.cat+':'+it.k)});
    if(it.type==='pack') out.push(...await BF.Packs.open(it.pack.id,src||'shop'));
    if(it.type==='part') out.push(await BF.Parts.create(it.slot,it.design,it.rarity,src||'shop',it.live?{name:it.live.name,liveId:it.live.id}:undefined));
    if(it.type==='bundle'){ const cos=it.items.filter(x=>x.type==='cosmetic'&&!x.owned).map(x=>x.cat+':'+x.k); if(cos.length) await a.update({unlocks:FV().arrayUnion(...cos)});
      for(const x of it.items.filter(x=>x.type==='pack')) out.push(...await BF.Packs.open(x.pack.id,'bundle')); }
    return out; },
  async buy(id,cur){
    const it=this.item(id); if(!it) return;
    try{ await this.pay(it,cur); BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui('coin');
      const made=await this.grant(it);
      if(it.type==='pack') BF.PackOpen.show(made,it.pack);
      else if(it.type==='bundle'&&made.length) BF.PackOpen.show(made,{name:it.name,colors:it.bundle.colors,model:'crate'});
      else if(made.length) BF.PartsUI.reveal(made,'Bought!');
      else BF.App.toast(`Unlocked ${it.name}`,'good');
      this.render(); }catch(e){ BF.App.toast(e.message,'bad'); }
  },
  // ----- gifting -----
  gift(id){ const it=this.item(id); if(!it) return;
    BF.PartsUI.pickFriend(async f=>{ try{ const a=A(); if(!(a&&a.profile)) throw new Error('Sign in to send gifts'); if((a.profile.coins||0)<it.coins) throw new Error('Not enough coins');
      const b=a.db.batch(); b.update(a.ref(),{coins:FV().increment(-it.coins)});
      b.set(a.ref(f.uid).collection('inbox').doc(),{type:'giftItem',item:id,label:it.name,cost:it.coins,from:a.user.uid,fromName:a.profile.name,ts:FV().serverTimestamp()}); await b.commit();
      BF.App.toast(`Sent ${it.name} to ${f.name} 🎁`,'good'); this.render(); }catch(e){ BF.App.toast(e.message,'bad'); } }); },
  async receive(x){ const it=this.item(x.item); if(!it) throw new Error('That item no longer exists'); if(!(x.cost>=Math.floor(it.coins*0.5))) throw new Error('This gift was not paid for'); const made=await this.grant(it,'gift');
    if(it.type==='pack') BF.PackOpen.show(made,it.pack); else BF.App.toast(`${x.fromName} gifted you ${it.name}!`,'good'); },
  // ----- try-on -----
  tryOn(id){ const it=this.item(id); if(!it) return; const m=$('#shopModal'), body=$('#shopBody'); m.hidden=false;
    const d=BF.clone(BF.App.d), P=d.paint.blade;
    if(it.cat==='finish') P.finish=it.k; if(it.cat==='pattern'){ P.pattern=it.k; P.patternColor=({flames:'#ff6a1a',lightning:'#ffd21f',galaxy:'#a07bff'})[it.k]||'#ff2e88'; P.patternAlpha=0.95; }
    if(it.cat==='trail'||it.cat==='aura'||it.cat==='launch'||it.cat==='win'){ d.cos=Object.assign({},d.cos,{[it.cat]:it.k}); }
    const live=['finish','pattern'].includes(it.cat);
    body.innerHTML=`<div class="modal-head"><h3>Try on: ${esc(it.name)}</h3><button class="icon-x big" data-x>×</button></div>
      ${live?'<canvas class="tryon"></canvas>':it.cat==='card'?'<div class="tryon card" id="tryCard"></div>':it.cat==='banner'||it.cat==='frame'?`<div class="tryon pc ${it.cat==='banner'?'bn-'+it.k:'bn-stadium'}"><span class="avf fr-${it.cat==='frame'?it.k:'ring'}" style="--s:84px"><span class="av ph" style="--s:84px">${esc(((A()&&A().profile&&A().profile.name)||'B')[0])}</span></span><b>${esc((A()&&A().profile&&A().profile.name)||'Blader')}</b></div>`
        :it.cat==='theme'?'<p class="dim">The whole app switches to this theme for 8 seconds.</p>':`<div class="tryon fxprev fx-${it.cat}-${it.k}"><i></i></div><p class="dim">${esc(it.sub)} — shows up in every battle.</p>`}
      <div class="modal-acts"><button class="btn primary" data-buy><span class="coin">${it.coins}</span></button><button class="btn ghost" data-x>Close</button></div>`;
    let stop=null; if(live) stop=BF.Preview3D.live(body.querySelector('.tryon'),d);
    if(it.cat==='card'){ const old=BF.Card.style; BF.Card.style=it.k; BF.Card.draw(BF.Card.infoFrom(d,null)).then(c=>{ c.className='cardcanvas'; $('#tryCard').appendChild(c); BF.Card.style=old; }); }
    if(it.cat==='theme'){ const r=document.documentElement, old=r.dataset.theme; r.dataset.theme=it.k; setTimeout(()=>{ BF.UI6.apply(); },8000); }
    const close=()=>{ stop&&stop(); m.hidden=true; };
    body.querySelectorAll('[data-x]').forEach(b=>b.onclick=close); body.querySelector('[data-buy]').onclick=()=>{ close(); this.buy(id,'coins'); };
  },
  // ----- render -----
  card(it,tag){
    const w=this.wish().includes(it.id), sl=this.sale(), rar=it.rarity||(it.type==='bundle'?'epic':it.type==='pack'?'rare':'common');
    const icon=it.type==='cosmetic'?BF.Shop.icon(it.cat,it.k):it.type==='pack'?`<img src="${BF.PackModel.thumb(it.pack)}" alt="">`:it.type==='part'?`<img src="${BF.partIcon(Object.assign({id:'offer'+it.id,shiny:false,system:it.design.system},it.part))}" alt="">`
      :`<div class="bdl" style="--c1:${it.bundle.colors[0]};--c2:${it.bundle.colors[1]}">${it.items.slice(0,4).map(x=>`<span>${x.type==='pack'?`<img src="${BF.PackModel.thumb(x.pack,90)}" alt="">`:BF.Shop.icon(x.cat,x.k)}</span>`).join('')}</div>`;
    return `<div class="sitem t-${it.type} r-${rar}${it.owned?' owned':''}" style="--rc:${BF.RARITY[rar]?BF.RARITY[rar].color:'#9aa3b5'}" data-id="${it.id}">
      ${tag?`<span class="stag">${tag}</span>`:''}<button type="button" class="wishb${w?' on':''}" data-wish title="Wishlist">${w?'★':'☆'}</button>
      <div class="sicon">${icon}</div><b>${esc(it.name)}</b><span class="ssub">${esc(it.sub||'')}</span>
      ${it.type==='bundle'&&it.full?`<span class="sfull">Worth <s>${it.full}</s> · save ${Math.max(0,Math.round((1-it.coins/it.full)*100))}%</span>`:''}
      <div class="sbuy">${it.owned?'<span class="sown">Owned ✓</span>':`<button class="btn primary" data-buy="coins"><span class="coin">${it.coins}</span>${sl?`<s>${Math.round(it.coins/(1-sl.pct/100))}</s>`:''}</button>${it.gems?`<button class="btn gemb" data-buy="gems">💎 ${it.gems}</button>`:''}`}</div>
      <div class="sacts">${it.tryable&&!it.owned?'<button class="btn ghost sm" data-try>Try on</button>':''}${it.giftable&&A()&&A().profile?'<button class="btn ghost sm" data-gift>Gift</button>':''}${it.type==='pack'?'<button class="btn ghost sm" data-odds>Odds</button>':''}</div></div>`;
  },
  render(){
    const root=$('#shopRoot'); if(!root||$('#view-shop').hidden) return; this.listen();
    const a=A(), p=a&&a.profile, sl=this.sale(), daily=this.daily(), feat=this.featured(), wish=this.wish();
    $('#shopCoins').innerHTML=p?`<b class="coin">${p.coins||0}</b> coins · <b class="gem">💎 ${p.gems||0}</b> gems`:'Sign in to earn coins and gems'; if(p) BF.App.countCoins($('#shopCoins'));
    const wishHit=daily.concat(feat).filter(x=>wish.includes(x.id));
    const TABS=[['featured','Featured'],['daily','Daily'],['packs','Packs & crates'],['parts','Parts'],['bundles','Bundles'],['cosmetics','Cosmetics']];
    let grid='';
    if(this.tab==='featured'){ const [hero,...rest]=feat;
      grid=`<div class="featrow">${hero?`<div class="fhero">${this.card(hero,'FEATURED')}</div>`:''}<div class="fside">${rest.map(x=>this.card(x,'FEATURED')).join('')}</div></div>
        <div class="shead"><h3>Today’s deals</h3><span class="dim">new items in ${this.untilMidnight()}</span></div><div class="sgrid">${daily.map(x=>this.card(x,'DAILY')).join('')}</div>`; }
    if(this.tab==='daily') grid=`<div class="shead"><h3>Daily rotation</h3><span class="dim">refreshes in ${this.untilMidnight()}</span></div><div class="sgrid">${daily.map(x=>this.card(x,'DAILY')).join('')}</div>`;
    if(this.tab==='packs') grid=`<div class="sgrid">${BF.Packs.list().map(pk=>this.card(this.item('p:'+pk.id))).join('')}</div>`;
    if(this.tab==='parts') grid=`<div class="shead"><h3>Part offers</h3><span class="dim">specific parts, rolled IVs on purchase · refresh daily</span></div><div class="sgrid">${daily.concat(feat).filter(x=>x.type==='part').concat(((BF.Live&&BF.Live.parts)||[]).filter(p=>p.shopPrice>0).map(p=>this.item('l:'+p.id)).filter(Boolean)).map(x=>this.card(x,x.live?'NEW':'')).join('')}</div>`;
    if(this.tab==='bundles') grid=`<div class="sgrid">${Object.keys(BUNDLES).map(k=>this.card(this.item('b:'+k))).join('')}</div>`;
    if(this.tab==='cosmetics') grid=Object.entries(BF.Shop.CATS).map(([cat,name])=>`<div class="shead"><h3>${esc(name)}</h3></div><div class="sgrid">${Object.keys(BF.Shop.P[cat]).filter(k=>BF.Shop.base(cat,k)>0).map(k=>this.card(this.item(`c:${cat}:${k}`))).join('')}</div>`).join('');
    root.innerHTML=`${sl?`<div class="salebar">🔥 ${esc(sl.label||'Sale')} — ${sl.pct}% off everything${sl.ends?` · ends ${new Date(sl.ends).toLocaleDateString()}`:''}</div>`:''}
      ${wishHit.length?`<div class="wishbar">★ On your wishlist and in the shop now: ${wishHit.map(x=>esc(x.name)).join(', ')}</div>`:''}
      <div class="stabs">${TABS.map(([k,l])=>`<button type="button" class="${this.tab===k?'on':''}" data-tab2="${k}">${l}</button>`).join('')}</div>${grid}`;
    root.querySelectorAll('[data-tab2]').forEach(b=>b.onclick=()=>{ this.tab=b.dataset.tab2; this.render(); });
    root.querySelectorAll('.sitem').forEach(el=>{ const id=el.dataset.id;
      el.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>this.buy(id,b.dataset.buy));
      const q=s=>el.querySelector(s); if(q('[data-wish]')) q('[data-wish]').onclick=()=>this.toggleWish(id);
      if(q('[data-try]')) q('[data-try]').onclick=()=>this.tryOn(id); if(q('[data-gift]')) q('[data-gift]').onclick=()=>this.gift(id);
      if(q('[data-odds]')) q('[data-odds]').onclick=()=>BF.PartsUI.packInfo(id.split(':')[1]); });
  },
  notifyWishlist(){ const w=this.wish(); if(!w.length) return; const hits=this.daily().concat(this.featured()).filter(x=>w.includes(x.id)); if(hits.length) BF.App.toast(`★ Wishlist item in the shop today: ${hits[0].name}`,'good'); }
};
BF.Shop.render=()=>S.render();
BF.Account&&BF.Account.on(a=>{ if(a.profile&&!S._once){ S._once=true; S.listen(); BF.Season.check(); setTimeout(()=>S.notifyWishlist(),4000); } });

// ---------- live 3D preview of a design (try-on) ----------
BF.Preview3D={ live(canvas,d){
  const T=THREE, r=new T.WebGLRenderer({canvas,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=0.9; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
  const s=new T.Scene(); s.add(new T.HemisphereLight(0xbfd8ff,0x201030,.35)); const k=new T.DirectionalLight(0xffffff,.75); k.position.set(80,-60,140); s.add(k); const c1=new T.PointLight(0x2ef2ff,.5,400); c1.position.set(-120,60,40); s.add(c1); const c2=new T.PointLight(0xff2e88,.5,400); c2.position.set(120,80,30); s.add(c2);
  const asm=BF.build(d), g=new T.Group(); asm.parts.forEach(part=>{ const pg=new T.Group(); part.bodies.forEach(b=>pg.add(new T.Mesh(b.geo,BF.materialFor(d,part,b,{})))); pg.position.z=part.z0; g.add(pg); }); s.add(g);
  const cam=new T.PerspectiveCamera(32,1,1,2000); cam.up.set(0,0,1); cam.position.set(95,-120,85); cam.lookAt(0,0,asm.height*0.45);
  let on=true; const loop=t=>{ if(!on) return; requestAnimationFrame(loop); const w=canvas.clientWidth||320,h=canvas.clientHeight||260; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); g.rotation.z=-t/600; r.render(s,cam); };
  requestAnimationFrame(loop); return ()=>{ on=false; r.dispose(); r.forceContextLoss(); }; } };
})();
