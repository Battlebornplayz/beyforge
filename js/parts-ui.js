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
  filter:'all', sort:'rarity', mode:'mine',
  setMode(m){ this.mode=m; this.render(); const v=$('#view-parts'); if(v) v.scrollTop=0; },
  render(){
    const root=$('#partsRoot'); if(!root||$('#view-parts').hidden) return;
    const seg=$('#partsMode'), dexBox=$('#dexRoot'), dexOn=this.mode==='dex'&&BF.Dex;
    if(seg&&!seg._on){ seg._on=true; seg.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>this.setMode(b.dataset.mode)); }
    if(seg) seg.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===this.mode));
    root.hidden=!!dexOn; if(dexBox) dexBox.hidden=!dexOn;
    const Pa=P(), A=BF.Account, coins=A&&A.profile?A.profile.coins||0:null;
    $('#partsCoins').innerHTML=coins==null?'Sign in to earn coins':`<b class="coin">${coins}</b> coins · ${Pa.bladerPoints()} blader pts`; BF.App.countCoins($('#partsCoins'));
    if(dexOn){ BF.Dex.render(dexBox); return; }
    if(BF.Dex) BF.Dex.killLive();
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
    try{ const made=await P().buyPack(kind); BF.PackOpen.show(made,BF.Packs.get(kind)); }catch(e){ BF.App.toast(e.message,'bad'); }
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
  // ---------- Battle Bey builder: live 3D, stats, and parts ranked for the goal you pick ----------
  deckBuilder(){
    const Pa=P(), m=$('#partModal'), box=$('#partBody'), card=m.querySelector('.modal-card'), GOALS={attack:'Attack',stamina:'Stamina',defense:'Defense',balanced:'Balanced'}, ST=[['atk','Attack'],['def','Defense'],['sta','Stamina'],['brs','Burst res.'],['stb','Stability']], SLN=(s,sys)=>sys==='Burst'?{blade:'Layer',core:'Disc',driver:'Driver'}[s]:sys==='X'?{blade:'Blade',core:'Ratchet',driver:'Bit'}[s]:{blade:'Blade / Layer',core:'Ratchet / Disc',driver:'Bit / Driver'}[s];
    m.hidden=false; m.onclick=null; card.classList.add('bb-wide');
    const pick={blade:null,core:null,driver:null}, S={slot:'blade',goal:this._bbGoal||'attack',all:false,tok:0,prev:null,busy:false}, cache=this._bbCache=this._bbCache||{};
    box.innerHTML=`<div class="modal-head"><h3>Build a Battle Bey</h3><button class="icon-x big" data-x aria-label="Close">×</button></div>
      <div class="bb"><section class="bb-l"><label class="fl">Name<input class="txt sm" id="dkName" maxlength="28" value="${esc(this._dkName||'')}" placeholder="Leave blank for an automatic name"></label><div id="bbSlots"></div>
          <button type="button" class="bb-auto" id="bbAuto">Auto-build my best Bey</button><button type="button" class="bb-save" id="dkSave">Save Battle Bey</button></section>
        <section class="bb-m"><div class="bb-stage"><canvas aria-label="Your Bey in 3D"></canvas></div><div id="bbStats"></div></section>
        <section class="bb-r"><div class="bb-goals" role="group" aria-label="What you want this Bey to be good at">${Object.entries(GOALS).map(([k,l])=>`<button type="button" data-g="${k}">${l}</button>`).join('')}</div><div id="bbSug"></div></section></div>`;
    const sysOf=()=>{ const id=pick.blade||pick.core||pick.driver; return id?Pa.get(id).system:null; };
    const shape=p=>p.catId||p.id;
    const copyBonus=p=>{ const out={atk:0,def:0,sta:0,brs:0,stb:0}; if(p&&p.iv) Object.keys(out).forEach(k=>out[k]=(p.iv[k]||0)/31*0.02+((p.ev&&p.ev[k])||0)/30*0.04); return out; };
    const statsFor=sel=>{ const sys=(sel.blade||sel.core||sel.driver).system, list=['blade','core','driver'].map(k=>sel[k]||this.dummy(k,sys)), key=list.map(p=>p.id?shape(p):'~'+p.slot+p.system).join('|');
      if(!cache[key]){ const f=BF.fighter(Pa.assemble(list)); cache[key]={atk:f.atk,def:f.def,sta:f.sta,brs:f.brs,stb:f.stb,type:(f.an&&f.an.type)||''}; }
      const o=Object.assign({},cache[key]); list.forEach(p=>{ const b=copyBonus(p); Object.keys(b).forEach(k=>o[k]*=1+b[k]); }); return o; };
    const score=(g,s)=>g==='attack'?s.atk+0.15*s.stb+0.15*s.brs+0.05*s.sta:g==='stamina'?s.sta*1.4+0.3*s.stb+0.15*s.def:g==='defense'?s.def*1.4+0.5*s.brs+0.3*s.stb:(s.atk+s.def+s.sta*1.6+s.brs+s.stb)/5+0.5*Math.min(s.atk,s.def,s.sta*1.6,s.brs,s.stb);
    const curSel=()=>({blade:pick.blade&&Pa.get(pick.blade),core:pick.core&&Pa.get(pick.core),driver:pick.driver&&Pa.get(pick.driver)});
    const uniq=(slot,sys)=>{ const best={}; Pa.bySlot(slot).filter(p=>!sys||p.system===sys).forEach(p=>{ const k=shape(p), v=Object.values(p.iv||{}).reduce((a,b)=>a+b,0)+(p.xp||0)*0.002; if(!best[k]||v>best[k].v) best[k]={p,v,n:0}; best[k].n++; }); return Object.values(best); };
    const pause=()=>new Promise(r=>setTimeout(r,0));
    // live 3D
    const T=window.THREE, cv=box.querySelector('canvas'); let live=null;
    try{ const r=new T.WebGLRenderer({canvas:cv,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.toneMapping=T.ACESFilmicToneMapping; r.toneMappingExposure=0.72; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
      const sc=new T.Scene(), pm=new T.PMREMGenerator(r), es=new T.Scene(); es.add(new T.Mesh(new T.BoxGeometry(200,200,200),new T.MeshBasicMaterial({color:0x0a0818,side:T.BackSide}))); [[0,0,90,0xffffff,4],[-90,20,20,0x2ef2ff,3],[90,-20,30,0xff2e88,3]].forEach(([x,y,z,c,k])=>{ const q=new T.Mesh(new T.PlaneGeometry(120,60),new T.MeshBasicMaterial({color:new T.Color(c).multiplyScalar(k),side:T.DoubleSide})); q.position.set(x,y,z); q.lookAt(0,0,0); es.add(q); }); sc.environment=pm.fromScene(es,0.03).texture;
      sc.add(new T.HemisphereLight(0xb8c6ff,0x150a20,0.4)); const k=new T.DirectionalLight(0xffffff,1); k.position.set(60,-80,140); sc.add(k);
      const cam=new T.PerspectiveCamera(30,1,1,3000); cam.up.set(0,0,1); let g=null, rad=30, on=true;
      const loop=()=>{ if(!on) return; requestAnimationFrame(loop); if(!cv.isConnected) return live.kill(); const w=cv.clientWidth||300,h=cv.clientHeight||240, pr=r.getPixelRatio(); if(cv.width!==Math.floor(w*pr)||cv.height!==Math.floor(h*pr)) r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix(); if(g&&!document.documentElement.classList.contains('reduce-motion')) g.rotation.z-=0.018; const d=rad*4.2; cam.position.set(d*0.55,-d*0.7,d*0.55); cam.lookAt(0,0,0); r.render(sc,cam); };
      live={ set(d){ if(g){ sc.remove(g); g.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); g=null; } if(!d) return; const asm=BF.build(d); g=BF.beyGroup(asm); const bx=new T.Box3().setFromObject(g), c=bx.getCenter(new T.Vector3()), z=bx.getSize(new T.Vector3()); g.children.forEach(x=>x.position.sub(c)); rad=Math.max(z.x,z.y,z.z*1.2)/2; sc.add(g); }, kill(){ if(!on) return; on=false; r.dispose(); try{ r.forceContextLoss(); }catch(e){} } }; loop(); }catch(e){ live={set(){},kill(){}}; }
    // panels
    const drawSlots=()=>{ const sys=sysOf(); $('#bbSlots').innerHTML=['blade','core','driver'].map(s=>{ const p=pick[s]&&Pa.get(pick[s]); return `<button type="button" class="bb-slot${S.slot===s?' on':''}" data-s="${s}" style="--rc:${p?R(p.rarity).color:'#3a3366'}">${p?`<img src="${partIcon(p,96)}" alt="">`:'<i>+</i>'}<span><em>${SLN(s,sys)}</em><b>${p?esc(p.name):'Choose a part'}</b>${p?`<small>Lv ${BF.partLevel(p.xp).lv} · IV ${Math.round(Object.values(p.iv).reduce((a,b)=>a+b,0)/155*100)}%</small>`:''}</span></button>`; }).join(''); box.querySelectorAll('.bb-slot').forEach(x=>x.onclick=()=>{ S.slot=x.dataset.s; S.all=false; drawSlots(); drawSug(); }); };
    const drawStats=()=>{ const sel=curSel(), any=sel.blade||sel.core||sel.driver, el=$('#bbStats'); if(!any){ el.innerHTML='<p class="bb-empty">Pick a part, or tap Auto-build.</p>'; live.set(null); return; } const s=statsFor(sel), sys=sysOf(), P0=S.prev;
      el.innerHTML=`<div class="bb-type"><b>${esc(s.type?s.type[0].toUpperCase()+s.type.slice(1)+' type':'Your Bey')}</b>${['blade','core','driver'].every(k=>pick[k])?'':'<span>Missing parts use a plain stand-in</span>'}</div>${ST.map(([k,l])=>{ const v=Math.round(s[k]), d=P0?v-Math.round(P0[k]):0; return `<div class="bb-bar"><span>${l}</span><i><u style="width:${Math.min(100,v)}%"></u></i><b>${v}</b><em class="${d>0?'up':d<0?'down':''}">${d>0?'+'+d:d<0?d:''}</em></div>`; }).join('')}`;
      try{ live.set(Pa.assemble(['blade','core','driver'].map(k=>sel[k]||this.dummy(k,sys)))); }catch(e){ console.warn('bb 3d',e); } };
    const setPick=(slot,id)=>{ const before=(pick.blade||pick.core||pick.driver)?statsFor(curSel()):null; pick[slot]=id; const sy=Pa.get(id).system; ['blade','core','driver'].forEach(k=>{ if(pick[k]&&Pa.get(pick[k]).system!==sy) pick[k]=null; }); S.prev=before; drawSlots(); drawStats(); const nx=['blade','core','driver'].find(k=>!pick[k]); if(nx){ S.slot=nx; drawSlots(); } drawSug(); };
    const drawSug=async()=>{ const tok=++S.tok, el=$('#bbSug'), slot=S.slot, sys=sysOf(), label=SLN(slot,sys), list=uniq(slot,sys); box.querySelectorAll('[data-g]').forEach(b=>b.classList.toggle('on',b.dataset.g===S.goal));
      if(!list.length){ el.innerHTML=`<h4>${label}</h4><p class="bb-empty">You don't own a ${sys?(sys==='X'?'X':'Burst')+' ':''}part for this slot yet. Open a pack or mint one in the Forge.</p>`; return; }
      el.innerHTML=`<h4>Best ${esc(label.toLowerCase())}s for ${GOALS[S.goal].toLowerCase()}</h4><p class="bb-empty">Testing your parts…</p>`;
      const base=curSel(), rows=[]; for(let i=0;i<list.length;i++){ const x=list[i], s=statsFor(Object.assign({},base,{[slot]:x.p})); rows.push(Object.assign({s,sc:score(S.goal,s)},x)); if(i%5===4){ await pause(); if(tok!==S.tok) return; } }
      rows.sort((a,b)=>b.sc-a.sc); const top=rows[0], show=S.all?rows:rows.slice(0,4);
      const why=(r,i)=>{ if(i===0) return `Your best ${GOALS[S.goal].toLowerCase()} pick with this build`; const ds=ST.map(([k,l])=>[Math.round(r.s[k])-Math.round(top.s[k]),l]).filter(d=>d[0]!==0).sort((a,b)=>Math.abs(b[0])-Math.abs(a[0])).slice(0,2); return ds.length?ds.map(d=>`${d[0]>0?'+':''}${d[0]} ${d[1].toLowerCase()}`).join(', ')+' vs best':'Same stats as your best pick'; };
      el.innerHTML=`<h4>Best ${esc(label.toLowerCase())}s for ${GOALS[S.goal].toLowerCase()}</h4>${show.map((r,i)=>{ const on=pick[slot]&&Pa.get(pick[slot])&&shape(Pa.get(pick[slot]))===shape(r.p); return `<button type="button" class="bb-sug${on?' on':''}" data-pick="${r.p.id}" style="--rc:${R(r.p.rarity).color}"><img src="${partIcon(r.p,96)}" alt=""><span><b>${r.p.shiny?'✨ ':''}${esc(r.p.name)}${r.n>1?` <small>x${r.n}</small>`:''}</b><em>${esc(why(r,i))}</em></span><strong class="${i===0?'best':''}">${i===0?'BEST':'#'+(rows.indexOf(r)+1)}</strong></button>`; }).join('')}${rows.length>4?`<button type="button" class="bb-more" id="bbMore">${S.all?'Show fewer':'See all '+rows.length}</button>`:''}`;
      el.querySelectorAll('[data-pick]').forEach(x=>x.onclick=()=>setPick(slot,x.dataset.pick)); const mo=el.querySelector('#bbMore'); if(mo) mo.onclick=()=>{ S.all=!S.all; drawSug(); }; };
    const autoBuild=async()=>{ if(S.busy) return; S.busy=true; const btn=box.querySelector('#bbAuto'); btn.disabled=true; btn.textContent='Testing your parts…'; S.tok++; let bestSet=null, bestScore=-1;
      try{ const systems=sysOf()?[sysOf()]:['X','Burst']; for(const sys of systems){ const opt={blade:uniq('blade',sys),core:uniq('core',sys),driver:uniq('driver',sys)}; if(!opt.blade.length||!opt.core.length||!opt.driver.length) continue; const sel={blade:null,core:null,driver:null};
          for(let pass=0;pass<2;pass++) for(const slot of ['blade','core','driver']){ let top=null, ts=-1, c=0; for(const x of opt[slot]){ const trial=Object.assign({},sel,{[slot]:x.p}), sc=score(S.goal,statsFor(trial)); if(sc>ts){ ts=sc; top=x.p; } if(++c%5===0) await pause(); } sel[slot]=top; }
          const fin=score(S.goal,statsFor(sel)); if(fin>bestScore){ bestScore=fin; bestSet=sel; } }
        if(!bestSet){ BF.App.toast('You need a blade, a core and a driver from the same system first','bad'); }
        else { S.prev=(pick.blade||pick.core||pick.driver)?statsFor(curSel()):null; ['blade','core','driver'].forEach(k=>pick[k]=bestSet[k].id); S.slot='driver'; drawSlots(); drawStats(); }
      }catch(e){ console.error(e); BF.App.toast('Auto-build hit a problem. Try picking parts yourself.','bad'); }
      S.busy=false; if(box.isConnected&&btn.isConnected){ btn.disabled=false; btn.textContent='Auto-build my best Bey'; } drawSug(); };
    const close=()=>{ S.tok++; live.kill(); card.classList.remove('bb-wide'); m.hidden=true; };
    box.querySelector('[data-x]').onclick=close; box.querySelector('#dkName').oninput=e=>this._dkName=e.target.value; box.querySelector('#bbAuto').onclick=autoBuild;
    box.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{ S.goal=this._bbGoal=b.dataset.g; S.all=false; drawSug(); });
    box.querySelector('#dkSave').onclick=async()=>{ try{ const parts=[pick.blade,pick.core,pick.driver]; let name=(this._dkName||'').trim(); if(parts.every(Boolean)&&!name){ name=BF.naming(Pa.assemble(parts.map(id=>Pa.get(id)))).name; } await Pa.addDeck(name,parts); this._dkName=''; close(); BF.App.toast(name+' is ready to battle','good'); this.render(); }catch(e){ BF.App.toast(e.message,'bad'); } };
    drawSlots(); drawStats(); drawSug();
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
