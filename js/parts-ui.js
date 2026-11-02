/* BeyForge v5.1 — Parts tab: collection box, part details (IV/EV/level/tree/moves/paint), Battle Bey builder,
   packs & crates, starter pick, blader tree, part trading, Forge minting */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s), P=()=>BF.Parts;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SL={blade:'Blade',core:'Core',driver:'Driver'};
const R=r=>BF.RARITY[r]||BF.RARITY.common;

// ---------- part icons (cached per copy) ----------
const iconCache={};
function partIcon(p,size){
  size=size||96; const key=p.id+':'+size+':'+JSON.stringify(p.data.paint||{}).length+(p.data.paint&&Object.values(p.data.paint)[0]&&Object.values(p.data.paint)[0].color);
  if(iconCache[key]) return iconCache[key];
  const c=document.createElement('canvas'); c.width=c.height=size; const x=c.getContext('2d'), cx=size/2, cy=size/2;
  const paint=p.data.paint||{}, col=k=>(paint[k]&&paint[k].color)||'#9aa3b5';
  const g=x.createRadialGradient(cx,cy,2,cx,cy,size*0.6); g.addColorStop(0,'#2a2460'); g.addColorStop(1,'#0b0a16'); x.fillStyle=g; x.fillRect(0,0,size,size);
  try{
    if(p.slot==='blade'){
      const d=P().assemble([p,{data:{ratchet:{points:3,height:60},disc:{shape:'round',diameter:36,thickness:4,lobes:4,rim:0.3},paint:{}}},{data:{bit:{tip:'flat',width:7,tipLen:4,gear:false},paint:{}}}]);
      const asm=BF.build(d), m=BF.mainPart(asm).meta, k=size*0.44/m.R;
      x.beginPath(); m.outline.forEach((q,i)=>{ const X=cx+q[0]*k, Y=cy-q[1]*k; i?x.lineTo(X,Y):x.moveTo(X,Y); }); x.closePath();
      const gg=x.createLinearGradient(0,0,size,size); gg.addColorStop(0,col('blade')); gg.addColorStop(1,shade(col('blade'),-0.35)); x.fillStyle=gg; x.fill();
      x.lineWidth=1.5; x.strokeStyle=col('accent'); x.stroke();
      x.beginPath(); x.arc(cx,cy,size*0.09,0,Math.PI*2); x.fillStyle='#0b0a16'; x.fill(); x.beginPath(); x.arc(cx,cy,size*0.13,0,Math.PI*2); x.strokeStyle='rgba(255,255,255,.25)'; x.stroke();
    } else if(p.slot==='core'){
      if(p.system==='X'){ const n=p.data.ratchet.points, r0=size*0.26, r1=size*0.36;
        x.beginPath(); for(let i=0;i<n*2;i++){ const a=i/(n*2)*Math.PI*2-Math.PI/2, r=i%2?r0:r1; i?x.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):x.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); } x.closePath();
        x.fillStyle=col('ratchet'); x.fill(); x.strokeStyle='rgba(255,255,255,.35)'; x.stroke();
        x.fillStyle='#fff'; x.font=`700 ${size*0.18}px "JetBrains Mono",monospace`; x.textAlign='center'; x.textBaseline='middle'; x.fillText(`${n}-${p.data.ratchet.height}`,cx,cy);
      } else { const sh=p.data.disc.shape, n=sh==='octa'?8:sh==='star'?(p.data.disc.lobes||5)*2:sh==='wing'?(p.data.disc.lobes||3)*2:48;
        x.beginPath(); for(let i=0;i<n;i++){ const a=i/n*Math.PI*2, r=size*(sh==='star'||sh==='wing'?(i%2?0.26:0.4):0.38); i?x.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r):x.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r); } x.closePath();
        const gg=x.createLinearGradient(0,0,size,size); gg.addColorStop(0,'#eef1f6'); gg.addColorStop(1,col('disc')); x.fillStyle=gg; x.fill();
        x.beginPath(); x.arc(cx,cy,size*0.1,0,Math.PI*2); x.fillStyle='#0b0a16'; x.fill(); }
    } else {
      const t=BF.TIPS[p.data.bit.tip]||BF.TIPS.flat, w=p.data.bit.tip==='bearing'?5.4:3.5, L=4;
      const prof=BF.tipProfileFor?BF.tipProfileFor(t.prof,w,L,p.data.bit.customTip):[[0,0],[w,0],[w,L]];
      const k=size/16, by=size*0.8;
      x.beginPath(); prof.forEach((q,i)=>{ const X=cx+q[0]*k, Y=by-q[1]*k; i?x.lineTo(X,Y):x.moveTo(X,Y); });
      for(let i=prof.length-1;i>=0;i--){ const q=prof[i]; x.lineTo(cx-q[0]*k,by-q[1]*k); }
      x.lineTo(cx-6.6*k,by-L*k); x.lineTo(cx-6.6*k,by-(L+5)*k); x.lineTo(cx+6.6*k,by-(L+5)*k); x.lineTo(cx+6.6*k,by-L*k); x.closePath();
      x.fillStyle=col('bit'); x.fill();
      x.fillStyle='#fff'; x.font=`700 ${size*0.15}px "JetBrains Mono",monospace`; x.textAlign='center'; x.fillText(p.system==='X'?t.x:t.burst.slice(0,6),cx,size*0.2);
    }
  }catch(e){ console.warn('icon',e); }
  if(p.shiny){ x.fillStyle='#fff'; for(let i=0;i<7;i++){ const a=Math.random()*Math.PI*2, r=size*(0.2+Math.random()*0.25), s=1+Math.random()*2.2; star(x,cx+Math.cos(a)*r,cy+Math.sin(a)*r,s); } }
  return iconCache[key]=c.toDataURL();
}
function shade(hex,f){ const c=new THREE.Color(hex); if(f<0) c.multiplyScalar(1+f); else c.lerp(new THREE.Color('#fff'),f); return '#'+c.getHexString(); }
function star(x,X,Y,s){ x.beginPath(); for(let i=0;i<8;i++){ const a=i/8*Math.PI*2, r=i%2?s*0.35:s*1.6; x.lineTo(X+Math.cos(a)*r,Y+Math.sin(a)*r); } x.closePath(); x.fill(); }
BF.partIcon=partIcon;

const tierCls=p=>{ const t=P().tier(p); return t?' tier-'+t:''; };
function partCard(p,extra){
  const lv=P().level(p), ivAvg=Math.round(Object.values(p.iv).reduce((a,b)=>a+b,0)/5);
  return `<button type="button" class="pcard2 r-${p.rarity}${p.shiny?' shiny':''}${tierCls(p)}" data-pid="${p.id}" style="--rc:${R(p.rarity).color}">
    <img src="${partIcon(p,96)}" alt=""><span class="pc-sys">${p.system==='X'?'X':'B'}</span>
    <b>${p.shiny?'✨ ':''}${esc(p.name)}</b><span class="pc-meta"><i style="color:${R(p.rarity).color}">${R(p.rarity).label}</i> · Lv ${lv} · IV ${BF.ivGrade(ivAvg)}</span>${extra||''}</button>`;
}

const UI = BF.PartsUI = {
  filter:'all', sort:'rarity',
  render(){
    const root=$('#partsRoot'); if(!root||$('#view-parts').hidden) return;
    const Pa=P(), A=BF.Account, coins=A&&A.profile?A.profile.coins||0:null;
    $('#partsCoins').innerHTML=coins==null?'Sign in to earn coins':`<b class="coin">${coins}</b> coins · ${Pa.bladerPoints()} blader pts`; BF.App.countCoins($('#partsCoins'));
    if(!Pa.starterDone()){ root.innerHTML=`<div class="starterbox"><h3>Pick your starter</h3><p class="dim">Battle Beys are built from parts you own. Choose a starter Bey — you’ll get its 3 parts plus a box of 3 extra commons.</p><div class="startergrid" id="starterGrid"><span class="netwait">Loading starters…</span></div></div>`; this.starters(); return; }
    const rarOrder=['limited','legendary','epic','rare','common'];
    let list=Pa.list.filter(p=>this.filter==='all'||p.slot===this.filter);
    list.sort(this.sort==='level'?(a,b)=>b.xp-a.xp:this.sort==='new'?(a,b)=>b.ts-a.ts:(a,b)=>rarOrder.indexOf(a.rarity)-rarOrder.indexOf(b.rarity)||(b.shiny-a.shiny)||b.xp-a.xp);
    root.innerHTML=`
      <section class="pshop">${BF.Packs.list().map(p=>{ const left=BF.Packs.pityLeft(p), el=BF.Packs.elementOf(p);
          return `<div class="packcard pk-${p.model}" style="--c1:${p.colors[0]};--c2:${p.colors[1]}"><img class="pk3d" src="${BF.PackModel.thumb(p)}" alt="" data-pinfo="${p.id}">
            <b>${esc(p.name)}${el?` <span class="elb" style="--c:${BF.ELEMENTS[el].color}">${BF.ELEMENTS[el].icon}</span>`:''}</b><span>${esc(p.desc)}</span>
            <em class="odds">${esc(BF.Packs.oddsText(p))} · Shiny 1/${p.shiny}</em>${left!=null?`<em class="pity">Legendary guaranteed in ≤ ${left} pack${left===1?'':'s'}</em>`:''}
            <button class="btn primary" data-pack="${p.id}"><span class="coin">${BF.Packs.price(p)}</span></button></div>`; }).join('')}
        <div class="packcard pk-mint"><b>Mint from the Forge</b><span>Turn your Forge design’s blade, core or driver into an owned part. ${BF.MINT_PRICE} coins each.</span><button class="btn" data-goforge>Go to Forge</button></div></section>
      <section><div class="sechead"><h3>Battle Beys</h3><button class="btn primary" id="newDeck">+ Build a Battle Bey</button></div>
        <div class="deckgrid">${Pa.decks.map(k=>{ const c=k.parts.map(id=>Pa.get(id)); const ok=!c.some(x=>!x);
          return `<div class="deck${ok?'':' broken'}" data-deck="${k.id}"><div class="dk-icons">${c.map(x=>x?`<img src="${partIcon(x,64)}" alt="">`:'<span class="dk-miss">?</span>').join('')}</div><b>${esc(k.name)}</b><span class="dim">${ok?c.map(x=>esc(x.name)).join(' · '):'A part is missing — rebuild it'}</span>
            <div class="dk-acts">${ok?'<button class="btn" data-dk="forge">Open in Forge</button>':''}<button class="btn ghost" data-dk="del">Delete</button></div></div>`; }).join('')||'<div class="fine">No Battle Beys yet. Build one from a blade, a core and a driver.</div>'}</div></section>
      <section><div class="sechead"><h3>Blader tree</h3><span class="dim">${Pa.bladerPoints()} points to spend · 1 point per blader level</span></div>
        <div class="btree">${BF.BLADER_TREE.map(n=>{ const have=Pa.blader().includes(n.id), lock=n.req&&!Pa.blader().includes(n.req);
          return `<button type="button" class="bnode${have?' have':''}${lock?' lock':''}" data-learn="${n.id}"><b>${esc(n.label)}</b><span>${esc(n.desc)}</span><em>${have?'Learned':lock?'Needs '+esc(BF.BLADER_TREE.find(x=>x.id===n.req).label):n.cost+' pt'+(n.cost>1?'s':'')}</em></button>`; }).join('')}</div></section>
      <section><div class="sechead"><h3>Collection <span class="dim">${Pa.list.length} parts</span></h3>
        <div class="seg sm" id="pFilter">${['all','blade','core','driver'].map(k=>`<button class="${this.filter===k?'on':''}" data-f="${k}">${k==='all'?'All':SL[k]}</button>`).join('')}</div>
        <div class="seg sm" id="pSort">${[['rarity','Rarity'],['level','Level'],['new','Newest']].map(([k,l])=>`<button class="${this.sort===k?'on':''}" data-s="${k}">${l}</button>`).join('')}</div></div>
        <div class="partgrid">${list.map(p=>partCard(p)).join('')||'<div class="fine">Nothing here.</div>'}</div></section>`;
    root.querySelectorAll('[data-pack]').forEach(b=>b.onclick=()=>this.buyPack(b.dataset.pack));
    root.querySelectorAll('[data-pinfo]').forEach(b=>b.onclick=()=>this.packInfo(b.dataset.pinfo));
    root.querySelector('[data-goforge]').onclick=()=>document.querySelector('#tabs [data-tab=forge]').click();
    root.querySelector('#newDeck').onclick=()=>this.deckBuilder();
    root.querySelectorAll('[data-deck]').forEach(el=>{ const k=Pa.decks.find(x=>x.id===el.dataset.deck);
      el.querySelectorAll('[data-dk]').forEach(b=>b.onclick=async()=>{ if(b.dataset.dk==='del'){ if(!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent='Tap again'; return; } await Pa.removeDeck(k.id); this.render(); }
        if(b.dataset.dk==='forge'){ const d=Pa.deckDesign(k); delete d.prog; BF.Share.load(d); } }); });
    root.querySelectorAll('[data-learn]').forEach(b=>b.onclick=async()=>{ try{ await Pa.learn(b.dataset.learn); BF.App.toast('Learned '+BF.BLADER_TREE.find(n=>n.id===b.dataset.learn).label,'good'); this.render(); }catch(e){ BF.App.toast(e.message,'bad'); } });
    root.querySelectorAll('#pFilter [data-f]').forEach(b=>b.onclick=()=>{ this.filter=b.dataset.f; this.render(); });
    root.querySelectorAll('#pSort [data-s]').forEach(b=>b.onclick=()=>{ this.sort=b.dataset.s; this.render(); });
    root.querySelectorAll('.partgrid [data-pid]').forEach(b=>b.onclick=()=>this.detail(b.dataset.pid));
  },
  // ---------- starter ----------
  starters(){
    const grid=$('#starterGrid'); const want={attack:null,defense:null,stamina:null};
    for(const pr of BF.PRESETS){ const d=BF.fromPreset(pr), asm=BF.build(d), an=BF.analyze(asm,BF.massProps(asm)); if(want[an.type]===null) want[an.type]={pr,d,an}; if(Object.values(want).every(Boolean)) break; }
    const blurb={attack:'Hits hard, chases, goes for KOs and bursts.',defense:'Heavy and steady — shrugs off hits and counters.',stamina:'Outlasts everyone — wins on spin.'};
    grid.innerHTML=Object.entries(want).filter(([,v])=>v).map(([t,v])=>`<button type="button" class="starter t-${t}" data-st="${t}"><img src="${BF.App.viewer.snapshot?'':''}" alt="" hidden><b>${esc(v.pr.name)}</b><span class="lib-type t-${t}">${t}</span><em>${blurb[t]}</em></button>`).join('');
    grid.querySelectorAll('[data-st]').forEach(b=>b.onclick=async()=>{ grid.querySelectorAll('button').forEach(x=>x.disabled=true); b.classList.add('on');
      try{ const v=want[b.dataset.st]; const made=await P().claimStarter(v.d,v.pr.name); this.reveal(made,`Welcome, blader! Your ${v.pr.name} is ready as a ⚔ Battle Bey.`); this.render(); }catch(e){ BF.App.toast(e.message,'bad'); grid.querySelectorAll('button').forEach(x=>x.disabled=false); } });
  },
  // ---------- packs ----------
  async buyPack(kind){
    const price=P().price(kind), A=BF.Account;
    if(!(A&&A.profile)) return BF.App.toast('Sign in (Blader tab) to earn coins and open packs','bad');
    if((A.profile.coins||0)<price) return BF.App.toast(`You need ${price} coins — win battles and grab the daily bonus`,'bad');
    try{ const made=await P().buyPack(kind); this.reveal(made,BF.Packs.get(kind).name); }catch(e){ BF.App.toast(e.message,'bad'); }
  },
  // pack details: live 3D model + full odds table
  packInfo(id){
    const p=BF.Packs.get(id), m=$('#partModal'), b=$('#partBody'), left=BF.Packs.pityLeft(p), t=Object.values(p.odds).reduce((a,x)=>a+(+x||0),0)||1; m.hidden=false;
    b.innerHTML=`<div class="modal-head"><h3>${esc(p.name)}</h3><button class="icon-x big" data-x>×</button></div>
      <div class="pkinfo"><canvas class="pklive"></canvas><div><p>${esc(p.desc)}</p>
        <table class="oddstab">${['common','rare','epic','legendary'].map(r=>`<tr style="--c:${BF.RARITY[r].color}"><td>${BF.RARITY[r].label}</td><td><div class="ob"><i style="width:${(p.odds[r]||0)/t*100}%"></i></div></td><td class="mono">${(+((p.odds[r]||0)/t*100).toFixed(2))}%</td></tr>`).join('')}
          <tr><td>✨ Shiny</td><td></td><td class="mono">1 in ${p.shiny}</td></tr></table>
        <div class="fine">${p.count} part${p.count>1?'s':''}${p.slots==='each'?' — one blade, one core, one driver':' — random slot'}. ${p.pity>0?`Pity: a Legendary is guaranteed within ${p.pity} packs${left!=null?` (${left} to go)`:''}. `:''}Duplicate protection: re-rolls parts you already own at the same rarity.</div>
        <button class="btn primary wide" data-buy><span class="coin">${BF.Packs.price(p)}</span> Open</button></div></div>`;
    const live=BF.PackModel.live(b.querySelector('.pklive'),p);
    const close=()=>{ live.stop(); m.hidden=true; };
    b.querySelector('[data-x]').onclick=close;
    b.querySelector('[data-buy]').onclick=()=>{ live.stop(); m.hidden=true; this.buyPack(id); };
  },
  reveal(parts,title){
    const m=$('#partModal'), b=$('#partBody'); m.hidden=false;
    b.innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-x big" data-x>×</button></div>
      <div class="reveal">${parts.map((p,i)=>`<div class="rv-card" style="--rc:${R(p.rarity).color};--d:${i*0.35}s"><div class="rv-in r-${p.rarity}${p.shiny?' shiny':''}"><div class="rv-back">?</div><div class="rv-front"><img src="${partIcon(p,120)}" alt=""><b>${p.shiny?'✨ ':''}${esc(p.name)}</b><i>${R(p.rarity).label}${p.shiny?' · SHINY':''}</i><span class="mono">IV ${Object.values(p.iv).join('/')}</span></div></div></div>`).join('')}</div>
      <div class="modal-acts"><button class="btn primary" data-x>Nice!</button></div>`;
    b.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>{ m.hidden=true; this.render(); });
    const best=parts.reduce((a,p)=>Math.max(a,['common','rare','epic','legendary','limited'].indexOf(p.rarity)),0);
    setTimeout(()=>BF.Sfx&&BF.Sfx.finish&&BF.Sfx.finish(best>=3?'xtreme':best>=2?'burst':'spin'),400+parts.length*350);
  },
  // ---------- one part ----------
  detail(id){
    const Pa=P(), p=Pa.get(id); if(!p) return; const m=$('#partModal'), b=$('#partBody'); m.hidden=false;
    const L=BF.partLevel(p.xp), evLeft=Pa.evPoints(p)-Pa.evUsed(p), A=BF.Account, ivEdit=A&&A.can&&A.can('editIV');
    const dd=Pa.assemble([p.slot==='blade'?p:this.dummy('blade',p.system),p.slot==='core'?p:this.dummy('core',p.system),p.slot==='driver'?p:this.dummy('driver',p.system)]); const sg=Pa.sigOf(p,dd); if(sg) dd.sigs={[p.slot]:sg};
    const pools=BF.movePools(dd);
    const pool=pools[p.slot], unl=Pa.movesUnlocked(p,pool).concat(sg?[p.slot+':sig']:[]), moveLv={}; Object.values(p.tree||{}); BF.partTree(p.slot).forEach(n=>{ const c=(p.tree||{})[n.id]; if(n.kind==='upgrade'&&c) moveLv[c]=(moveLv[c]||1)+1; });
    const tree=BF.partTree(p.slot).map(n=>{ const got=L.lv>=n.lv, ch=(p.tree||{})[n.id];
      let body='';
      if(n.kind==='perk') body=ch?`<em>${esc(n.choices.find(c=>c.id===ch).label)}</em>`:got?n.choices.map(c=>`<button class="btn sm" data-ch="${n.id}:${c.id}">${esc(c.label)}</button>`).join(''):'';
      else if(n.kind==='upgrade') body=ch?`<em>Upgraded ${esc((pool.find(m=>m.id===ch)||{}).name||'')}</em>`:got?pool.filter(m=>unl.includes(m.id)&&(moveLv[m.id]||1)<3).map(m=>`<button class="btn sm" data-ch="${n.id}:${m.id}">${esc(m.name)} → ${['','II','III'][moveLv[m.id]||1]}</button>`).join(''):'';
      return `<div class="tnode${got?' got':''}${ch||(n.kind!=='perk'&&n.kind!=='upgrade'&&got)?' done':''}"><span class="tn-lv">Lv ${n.lv}</span><div><b>${esc(n.label)}</b>${body?`<div class="tn-ch">${body}</div>`:''}</div></div>`; }).join('');
    b.innerHTML=`<div class="modal-head"><h3>${p.shiny?'✨ ':''}${esc(p.name)}</h3><button class="icon-x big" data-x>×</button></div>
      <div class="pd-top"><img class="pd-img r-${p.rarity}${p.shiny?' shiny':''}${tierCls(p)}" style="--rc:${R(p.rarity).color}" src="${partIcon(p,160)}" alt="">
        <div class="pd-info"><div><i class="rbadge" style="--rc:${R(p.rarity).color}">${R(p.rarity).label}${p.shiny?' · Shiny':''}</i> <span class="dim">${SL[p.slot]} · ${p.system==='X'?'Beyblade X':'Burst'} · from ${esc(p.source)}</span></div>
          <div class="pd-lv"><b>Lv ${L.lv}</b>${L.need?`<div class="xpbar"><i style="width:${L.into/L.need*100}%"></i></div><span class="mono dim">${L.into}/${L.need} XP</span>`:'<span class="dim">Max level</span>'}</div>
          <div class="dim small">Elements: ${(()=>{ const e=BF.partElements(Pa.assemble([p.slot==='blade'?p:this.dummy('blade',p.system),p.slot==='core'?p:this.dummy('core',p.system),p.slot==='driver'?p:this.dummy('driver',p.system)]))[p.slot]; return BF.ELEMENTS[e].icon+' '+BF.ELEMENTS[e].label; })()}</div></div></div>
      <div class="pd-grid">
        <section><h4>IVs <span class="dim small">${ivEdit?'(staff can edit)':'locked forever'}</span></h4>${Object.entries(BF.PSTATS).map(([s,l])=>`<div class="ivrow"><span>${l}</span><div class="ivbar"><i style="width:${p.iv[s]/31*100}%"></i></div>${ivEdit?`<input class="num sm" type="number" min="0" max="31" value="${p.iv[s]}" data-iv="${s}">`:`<b class="mono">${p.iv[s]}</b>`}<em class="grade g-${BF.ivGrade(p.iv[s])}">${BF.ivGrade(p.iv[s])}</em></div>`).join('')}</section>
        <section><h4>EVs <span class="dim small">${evLeft} point${evLeft===1?'':'s'} to spend · +${BF.PART_LIMITS.EV_PER_LV} per level</span></h4>${Object.entries(BF.PSTATS).map(([s,l])=>`<div class="ivrow"><span>${l}</span><div class="ivbar ev"><i style="width:${(p.ev[s]||0)/30*100}%"></i></div><b class="mono">${p.ev[s]||0}</b><span class="evbtn"><button class="btn sm" data-ev="${s}:-1">−</button><button class="btn sm" data-ev="${s}:1"${evLeft<=0?' disabled':''}>+</button></span></div>`).join('')}
          <button class="btn ghost sm" data-evreset>Reset EVs</button></section>
        <section><h4>Moves</h4>${pool.map(mv=>{ const ok=unl.includes(mv.id), E=BF.ELEMENTS[mv.el], lv=moveLv[mv.id]||1; return `<div class="kitmv${ok?'':' lockd'}" style="--c:${E.color}"><i>${E.icon}</i><b>${esc(mv.name)}${lv>1?' '+['','II','III'][lv-1]:''}</b><em>${ok?esc(BF.MOVE_KINDS[mv.kind].desc):'Unlocks at part level '+(mv.slot===1?3:8)}</em>${mv.sig?'<span class="sigtag">SIGNATURE</span>':''}</div>`; }).join('')}</section>
        <section><h4>Skill tree</h4><div class="ptree">${tree}</div></section>
        <section><h4>Paint <span class="dim small">shape is locked on owned parts</span></h4><div class="pd-paint">${Object.entries(p.data.paint||{}).filter(([,v])=>v).map(([k,v])=>`<label class="pswatch"><input type="color" value="${v.color}" data-paint="${k}"><span>${esc(k)}</span></label>`).join('')}</div></section>
      </div>
      <div class="modal-acts"><button class="btn" data-a="forge">Open in Forge</button>${A&&A.profile?'<button class="btn" data-a="trade">Trade to a friend</button>':''}<button class="btn ghost" data-a="release">Release (+${R(p.rarity).release} coins)</button></div>`;
    b.querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>m.hidden=true);
    const again=()=>setTimeout(()=>{ if(!m.hidden) this.detail(id); },250);
    b.querySelectorAll('[data-ev]').forEach(x=>x.onclick=async()=>{ const [s,dv]=x.dataset.ev.split(':'); const ok=await Pa.setEV(p,s,(p.ev[s]||0)+(+dv)); if(!ok) BF.App.toast('No EV points left — level this part up','bad'); again(); });
    b.querySelector('[data-evreset]').onclick=async()=>{ await Pa.resetEV(p); again(); };
    b.querySelectorAll('[data-iv]').forEach(x=>x.onchange=async()=>{ try{ await Pa.setIV(p,x.dataset.iv,+x.value); BF.App.toast('IV updated','good'); again(); }catch(e){ BF.App.toast(BF.friendly?BF.friendly(e):e.message,'bad'); } });
    b.querySelectorAll('[data-ch]').forEach(x=>x.onclick=async()=>{ const [n,c]=x.dataset.ch.split(':'); await Pa.choose(p,n,c); again(); });
    b.querySelectorAll('[data-paint]').forEach(x=>x.onchange=async()=>{ await Pa.repaint(p,x.dataset.paint,x.value); again(); });
    b.querySelector('[data-a=forge]').onclick=()=>{ m.hidden=true; const d=BF.clone(BF.App.d); const sys=p.system;
      const cur=d.system===sys?d:BF.normalize(Object.assign(BF.defaultDesign(),{system:sys}));
      const parts=['blade','core','driver'].map(s=>s===p.slot?p:{data:P().extract(cur,s)}); BF.Share.load(Pa.assemble(parts)); };
    const tr=b.querySelector('[data-a=trade]'); if(tr) tr.onclick=()=>{ m.hidden=true; this.pickFriend(f=>BF.Trades.offerPart(f.uid,f.name,p)); };
    b.querySelector('[data-a=release]').onclick=async e=>{ const x=e.currentTarget; if(!x.classList.contains('confirm')){ x.classList.add('confirm'); x.textContent='Tap again to release'; return; }
      const A=BF.Account, refund=R(p.rarity).release; await Pa.remove(p.id); if(A&&A.profile&&refund) await A.update({coins:firebase.firestore.FieldValue.increment(refund)}).catch(()=>{});
      m.hidden=true; BF.App.toast(`Released ${p.name}${refund&&A&&A.profile?` (+${refund} coins)`:''}`); this.render(); };
  },
  dummy(slot,system){ const d=BF.defaultDesign(); d.system=system; return {slot,system,data:P().extract(BF.normalize(d),slot)}; },
  // ---------- Battle Bey builder ----------
  deckBuilder(){
    const Pa=P(), m=$('#partModal'), b=$('#partBody'); m.hidden=false; const pick={blade:null,core:null,driver:null};
    const draw=()=>{ const sys=pick.blade?Pa.get(pick.blade).system:null;
      b.innerHTML=`<div class="modal-head"><h3>Build a Battle Bey</h3><button class="icon-x big" data-x>×</button></div>
        <label class="fl">Name<input class="txt sm" id="dkName" maxlength="28" value="${esc(this._dkName||'')}" placeholder="e.g. Crimson Fang"></label>
        ${['blade','core','driver'].map(s=>{ const opts=Pa.bySlot(s).filter(p=>!sys||s==='blade'||p.system===sys); return `<h4>${SL[s]}${s!=='blade'&&sys?` <span class="dim small">(${sys==='X'?'X':'Burst'} parts)</span>`:''}</h4><div class="partgrid sm">${opts.map(p=>partCard(p).replace('class="pcard2','class="pcard2'+(pick[s]===p.id?' on':'')).replace('data-pid=',`data-slot="${s}" data-pid=`)).join('')||'<div class="fine">You don’t own one yet — open a pack or mint one from the Forge.</div>'}</div>`; }).join('')}
        <div class="modal-acts"><button class="btn primary" id="dkSave">Save Battle Bey</button></div>`;
      b.querySelector('[data-x]').onclick=()=>m.hidden=true;
      b.querySelector('#dkName').oninput=e=>this._dkName=e.target.value;
      b.querySelectorAll('[data-slot]').forEach(x=>x.onclick=()=>{ const s=x.dataset.slot; pick[s]=x.dataset.pid; if(s==='blade'){ const sy=Pa.get(pick.blade).system; ['core','driver'].forEach(k=>{ if(pick[k]&&Pa.get(pick[k]).system!==sy) pick[k]=null; }); } draw(); });
      b.querySelector('#dkSave').onclick=async()=>{ try{ const parts=[pick.blade,pick.core,pick.driver]; let name=(this._dkName||'').trim();
        if(!name){ const d=Pa.assemble(parts.map(id=>Pa.get(id))); name=BF.naming(d).name; }
        await Pa.addDeck(name,parts); this._dkName=''; m.hidden=true; BF.App.toast(name+' is ready to battle','good'); this.render(); }catch(e){ BF.App.toast(e.message,'bad'); } };
    }; draw();
  },
  pickFriend(cb){
    const S=BF.Social, ids=Object.keys((S&&S.friends)||{}), m=$('#pickModal'), b=$('#pickBody'); m.hidden=false;
    b.innerHTML=`<div class="modal-head"><h3>Trade with…</h3><button class="icon-x big" data-x>×</button></div><div class="picklist">${ids.map(id=>`<button class="pickrow" data-f="${id}"><span><b>${esc((S.friendProfiles[id]&&S.friendProfiles[id].name)||S.friends[id].name)}</b></span></button>`).join('')||'<div class="fine">Add friends on the Blader tab first.</div>'}</div>`;
    b.querySelector('[data-x]').onclick=()=>m.hidden=true;
    b.querySelectorAll('[data-f]').forEach(x=>x.onclick=()=>{ m.hidden=true; const id=x.dataset.f; cb({uid:id,name:(S.friendProfiles[id]&&S.friendProfiles[id].name)||S.friends[id].name}); });
  },
  pickPart(title){
    return new Promise(res=>{ const Pa=P(), m=$('#pickModal'), b=$('#pickBody'); m.hidden=false;
      b.innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-x big" data-x>×</button></div><div class="partgrid sm">${Pa.list.map(p=>partCard(p)).join('')||'<div class="fine">You don’t own any parts yet.</div>'}</div>`;
      b.querySelector('[data-x]').onclick=()=>{ m.hidden=true; res(null); };
      b.querySelectorAll('[data-pid]').forEach(x=>x.onclick=()=>{ m.hidden=true; res(Pa.get(x.dataset.pid)); }); });
  },
  // ---------- Forge: mint buttons in the Battle kit ----------
  async mint(slot){
    const A=BF.Account; if(!(A&&A.profile)) return BF.App.toast('Sign in (Blader tab) to mint parts','bad');
    try{ const p=await P().mint(slot,BF.clone(BF.App.d)); this.reveal([p],'Minted!'); }catch(e){ BF.App.toast(e.message,'bad'); }
  }
};

// ---------- part trades (extends BF.Trades) ----------
const strip=p=>{ const {id,...rest}=p; return rest; };
const T=BF.Trades;
T.offer0=T.offer;
T.offer=function(uid,name){
  const m=$('#pickModal'), b=$('#pickBody'); m.hidden=false;
  b.innerHTML=`<div class="modal-head"><h3>Trade with ${esc(name)}</h3><button class="icon-x big" data-x>×</button></div><div class="modal-acts"><button class="btn primary" data-k="part">Trade a part</button><button class="btn" data-k="bey">Trade a saved Bey design</button></div>`;
  b.querySelector('[data-x]').onclick=()=>m.hidden=true;
  b.querySelector('[data-k=bey]').onclick=()=>{ m.hidden=true; T.offer0(uid,name); };
  b.querySelector('[data-k=part]').onclick=async()=>{ m.hidden=true; const p=await UI.pickPart(`Pick a part to offer ${name}`); if(p) T.offerPart(uid,name,p); };
};
T.offerPart=async function(uid,name,p){
  const A=BF.Account, FV=firebase.firestore.FieldValue, meta={full:`${R(p.rarity).label}${p.shiny?' Shiny':''} ${p.name}`};
  try{ const ref=await A.db.collection('trades').add({from:A.user.uid,fromName:A.profile.name,to:uid,toName:name,offer:{kind:'part',id:p.id,part:strip(p),meta},status:'open',ts:FV.serverTimestamp()});
    await A.ref(uid).collection('inbox').add({type:'trade',tradeId:ref.id,from:A.user.uid,fromName:A.profile.name,meta,ts:FV.serverTimestamp()});
    BF.App.toast(`Trade offer sent to ${name}`,'good'); }catch(e){ BF.App.toast(BF.friendly(e),'bad'); }
};
const respond0=T.respond.bind(T);
T.respond=async function(item,accept){
  const A=BF.Account, ref=A.db.collection('trades').doc(item.tradeId);
  if(!accept) return respond0(item,false);
  const t=(await ref.get()).data(); if(!t||t.status!=='open') throw new Error('That trade isn’t open anymore');
  if(!(t.offer&&t.offer.kind==='part')) return respond0(item,true);
  const mine=await UI.pickPart(`Pick a part to give ${t.fromName} for ${t.offer.meta.full}`); if(!mine) return false;
  await ref.update({status:'accepted',counter:{kind:'part',id:mine.id,part:strip(mine),meta:{full:`${R(mine.rarity).label} ${mine.name}`}}});
  await P().put(Object.assign({},t.offer.part,{id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),source:'trade',xp:t.offer.part.xp||0}));
  await P().remove(mine.id);
  BF.App.toast(`Traded ${mine.name} for ${t.offer.part.name}`,'good'); return true;
};
// sender side: finish part trades when they come online (Bey trades still use the original listener)
BF.Account&&BF.Account.on(a=>{ if(!a.profile||T._lp===a.user.uid) return; T._lp=a.user.uid;
  a.db.collection('trades').where('from','==',a.user.uid).where('status','==','accepted').onSnapshot(async qs=>{
    for(const d of qs.docs){ const t=d.data(); if(!(t.counter&&t.counter.kind==='part')) continue;
      try{ await d.ref.update({status:'done'}); await P().put(Object.assign({},t.counter.part,{id:Date.now().toString(36)+Math.random().toString(36).slice(2,8),source:'trade'})); await P().remove(t.offer.id).catch(()=>{});
        BF.App.toast(`${t.toName} took your trade — you got ${t.counter.part.name}`,'good'); }catch(e){ console.warn(e); } } },()=>{}); });

// ---------- wiring ----------
BF.Parts.on(()=>UI.render());
BF.Account&&BF.Account.on(()=>UI.render());
document.addEventListener('DOMContentLoaded',()=>{});
})();
