/* BeyForge — Owner / staff admin panel: ranks & permissions, players (rank, ban, grants), announcements */
(function(){
'use strict';
const BF=window.BF, A=BF.Account;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PERMS={grant:'Give coins, XP, unlocks & ranks',moderate:'Moderate chat & gallery, ban players',manageRoles:'Create & edit ranks',manageGame:'Post announcements',editIV:'Edit part IVs'};

BF.Admin = {
  tab:'ranks',
  render(root){
    if(!root) return;
    const tabs=[['ranks','Ranks',A.can('manageRoles')],['players','Players',A.can('grant')||A.can('moderate')],['announce','Announcement',A.can('manageGame')],['ranked','Ranked rules',A.can('manageGame')],['events','Weekly boss',A.can('manageGame')],['packs','Packs & odds',A.can('manageGame')],['shop','Shop',A.can('manageGame')]].filter(t=>t[2]);
    if(!tabs.find(t=>t[0]===this.tab)) this.tab=tabs[0]&&tabs[0][0];
    root.innerHTML=`<h3>${A.isOwner?'Owner panel':'Staff panel'} <span class="cnt gold">${A.isOwner?'OWNER':'STAFF'}</span></h3>
      <div class="seg sm admtabs">${tabs.map(([k,l])=>`<button type="button" class="${this.tab===k?'on':''}" data-t="${k}">${l}</button>`).join('')}</div><div id="admBody"></div>`;
    root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ this.tab=b.dataset.t; this.render(root); });
    const body=root.querySelector('#admBody');
    if(this.tab==='ranks') this.ranks(body); else if(this.tab==='players') this.players(body); else if(this.tab==='announce') this.announce(body); else if(this.tab==='ranked') BF.Ranked.editor(body); else if(this.tab==='events') this.events(body); else if(this.tab==='packs') this.packs(body); else if(this.tab==='shop') this.shop(body);
  },
  ranks(el){
    // ranks are edited in BeyForge Studio now (presets + per-section access); this is a read-only view so nothing gets out of sync
    const roles=Object.entries(A.roles).sort((a,b)=>(a[1].order||0)-(b[1].order||0)), studio='https://battlebornplayz.github.io/beyforge/studio/';
    el.innerHTML=`<p class="dim small">Ranks are created and edited in <b>BeyForge Studio</b>: pick a preset, tick which sections each rank can see or edit, set the badge players see.</p>
      <div class="ranklist">${roles.map(([id,r])=>`<div class="rankrow ro"><span class="rankbadge" style="--rc:${esc(r.color||'#a07bff')}">${esc(r.badge||r.name)}</span><b>${esc(r.name)}</b>
        <span class="dim small">${Object.values(r.studio||{}).filter(Boolean).length} Studio sections${r.perms&&r.perms.editIV?' · edits IVs':''}${r.showBadge===false?' · badge hidden':''}</span></div>`).join('')||'<div class="fine">No ranks yet.</div>'}</div>
      <div class="addrow"><a class="btn primary" href="${studio}#/staff" target="_blank" rel="noopener">Edit ranks in BeyForge Studio ↗</a></div>`;
  },
  players(el){
    el.innerHTML=`<form class="addrow" id="pSearch"><input class="txt sm" id="pQ" placeholder="Search blader name" maxlength="16" autocomplete="off"><button class="btn">Search</button></form><div id="pRes" class="plist"></div>`;
    const run=async q=>{ const res=el.querySelector('#pRes'); q=A.cleanName(q); res.innerHTML='<span class="netwait">Searching…</span>';
      try{ let qs=A.db.collection('users').orderBy('nameLower').limit(20); if(q) qs=qs.startAt(q).endAt(q+''); const snap=await qs.get(); const rows=[]; snap.forEach(d=>rows.push(Object.assign({uid:d.id},d.data())));
        res.innerHTML=rows.map(p=>this.playerRow(p)).join('')||'<div class="fine">Nobody found.</div>'; this.bindPlayers(res,rows);
      }catch(e){ res.innerHTML=`<div class="neterr">${esc(BF.friendly(e))}</div>`; } };
    el.querySelector('#pSearch').onsubmit=e=>{ e.preventDefault(); run(el.querySelector('#pQ').value); };
    run('');
  },
  playerRow(p){
    const me=A.user&&p.uid===A.user.uid, opts=['<option value="">Player</option>'].concat(Object.entries(A.roles).map(([id,r])=>`<option value="${id}"${p.role===id?' selected':''}>${esc(r.name)}</option>`)).join('');
    return `<div class="prow" data-uid="${p.uid}">
      <div class="pr-id">${p.avatar?`<img class="av" style="--s:34px" src="${p.avatar}" alt="">`:`<span class="av ph" style="--s:34px">${esc((p.name||'?')[0].toUpperCase())}</span>`}<div><b>${esc(p.name)}</b><span>LV ${p.level||1} · ${p.coins||0} coins · ${(p.stats&&p.stats.wins)||0}W${p.banned?' · <em class="bad">BANNED</em>':''}</span></div></div>
      ${A.can('grant')&&!me?`<select data-a="role" aria-label="Rank">${opts}</select>`:'<span class="dim small">'+(me?'You':'')+'</span>'}
      ${A.can('grant')?`<div class="grant"><input class="num" type="number" value="100" min="-99999" max="99999" data-a="amt" aria-label="Amount"><button class="btn" data-a="coins">+ Coins</button><button class="btn" data-a="xp">+ XP</button><button class="btn" data-a="all" title="Unlock every cosmetic">Unlock all</button><button class="btn" data-a="pack">Send pack</button><button class="btn" data-a="crate">Send crate</button></div>`:''}
      ${(A.can('moderate')||A.can('grant'))&&!me?`<button class="btn ${p.banned?'':'ghost'}" data-a="ban">${p.banned?'Unban':'Ban'}</button>`:''}
    </div>`;
  },
  bindPlayers(res,rows){
    res.querySelectorAll('.prow').forEach(row=>{ const uid=row.dataset.uid, p=rows.find(r=>r.uid===uid), ref=A.ref(uid), FV=firebase.firestore.FieldValue;
      const amt=()=>parseInt((row.querySelector('[data-a=amt]')||{}).value||'0',10)||0;
      row.querySelectorAll('[data-a]').forEach(c=>{ const a=c.dataset.a;
        if(a==='role') c.onchange=()=>ref.update({role:c.value||null}).then(()=>BF.App.toast(`${p.name} is now ${c.value?A.roles[c.value].name:'a Player'}`,'good')).catch(err);
        if(a==='coins') c.onclick=()=>ref.update({coins:FV.increment(amt())}).then(()=>BF.App.toast(`Gave ${p.name} ${amt()} coins`,'good')).catch(err);
        if(a==='xp') c.onclick=()=>{ const xp=Math.max(0,(p.xp||0)+amt()); ref.update({xp,level:BF.levelFor(xp)}).then(()=>{ p.xp=xp; BF.App.toast(`Gave ${p.name} ${amt()} XP`,'good'); }).catch(err); };
        if(a==='all') c.onclick=()=>ref.update({unlocks:FV.arrayUnion('*')}).then(()=>BF.App.toast(`Unlocked everything for ${p.name}`,'good')).catch(err);
        if(a==='pack'||a==='crate') c.onclick=()=>ref.collection('inbox').add({type:'pack',kind:a,from:A.user.uid,fromName:A.profile.name,ts:FV.serverTimestamp()}).then(()=>BF.App.toast(`Sent ${p.name} a ${a==='crate'?'legendary crate':'booster pack'}`,'good')).catch(err);
        if(a==='ban') c.onclick=()=>ref.update({banned:!p.banned}).then(()=>{ p.banned=!p.banned; c.textContent=p.banned?'Unban':'Ban'; BF.App.toast(p.banned?`${p.name} banned`:`${p.name} unbanned`); }).catch(err);
      }); });
  },
  // ---------- Packs & odds: every pack's price, odds, shiny rate, pity and colors (live for all players) ----------
  packs(el){
    const K=BF.Packs, all=BF.clone(K.all()), R=['common','rare','epic','legendary'];
    const row=p=>{ const t=R.reduce((a,r)=>a+(+p.odds[r]||0),0);
      return `<section class="pkadm" data-id="${p.id}"><div class="pkadm-h"><img src="${BF.PackModel.thumb(p,120)}" alt=""><div><input class="txt sm" data-f="name" value="${esc(p.name)}" maxlength="28"><input class="txt sm" data-f="desc" value="${esc(p.desc)}" maxlength="80"></div>
        <label class="pchip${p.enabled!==false?' on':''}"><input type="checkbox" data-f="enabled"${p.enabled!==false?' checked':''}>In shop</label></div>
        <div class="pkadm-g">
          <label class="rk-f"><span>Price</span><span class="num-wrap"><input class="num" type="number" min="0" data-f="price" value="${p.price}"><span class="unit">coins</span></span></label>
          <label class="rk-f"><span>Gem price</span><span class="num-wrap"><input class="num" type="number" min="0" data-f="gems" value="${p.gems||0}"><span class="unit">gems</span></span></label>
          <label class="rk-f"><span>Parts</span><span class="num-wrap"><input class="num" type="number" min="1" max="10" data-f="count" value="${p.count}"></span></label>
          <label class="rk-f"><span>Shiny</span><span class="num-wrap"><span class="unit">1 in</span><input class="num" type="number" min="1" data-f="shiny" value="${p.shiny}"></span></label>
          <label class="rk-f"><span>Pity</span><span class="num-wrap"><input class="num" type="number" min="0" data-f="pity" value="${p.pity}"><span class="unit">packs (0 = off)</span></span></label>
          <label class="rk-f"><span>Colors</span><span class="num-wrap"><input type="color" data-f="c0" value="${p.colors[0]}"><input type="color" data-f="c1" value="${p.colors[1]}"></span></label>
        </div>
        <div class="pkadm-odds">${R.map(r=>`<label style="--c:${BF.RARITY[r].color}"><span>${BF.RARITY[r].label}</span><span class="num-wrap"><input class="num" type="number" min="0" max="100" step="0.1" data-odd="${r}" value="${p.odds[r]||0}"><span class="unit">%</span></span></label>`).join('')}<em class="${Math.abs(t-100)<0.01?'ok':'bad'}" data-sum>Total ${+t.toFixed(2)}%</em></div></section>`; };
    el.innerHTML=`<p class="dim small">Every player sees these prices and odds live, and the odds are shown on each pack. Odds must add up to 100%.</p>
      <div class="pkadm-list">${Object.values(all).map(row).join('')}</div>
      <div class="addrow"><button class="btn primary" id="pkSave">Publish packs & odds</button><button class="btn ghost" id="pkReset">Reset all to defaults</button></div>`;
    el.querySelectorAll('.pkadm').forEach(sec=>{ const p=all[sec.dataset.id];
      sec.querySelectorAll('[data-f]').forEach(i=>i.oninput=i.onchange=()=>{ const f=i.dataset.f;
        if(f==='enabled'){ p.enabled=i.checked; i.parentElement.classList.toggle('on',i.checked); }
        else if(f==='c0'||f==='c1') p.colors[f==='c0'?0:1]=i.value;
        else if(['price','gems','count','shiny','pity'].includes(f)) p[f]=Math.max(f==='count'||f==='shiny'?1:0,+i.value||0);
        else p[f]=i.value; });
      sec.querySelectorAll('[data-odd]').forEach(i=>i.oninput=()=>{ p.odds[i.dataset.odd]=Math.max(0,+i.value||0); const t=R.reduce((a,r)=>a+(+p.odds[r]||0),0); const s=sec.querySelector('[data-sum]'); s.textContent=`Total ${+t.toFixed(2)}%`; s.className=Math.abs(t-100)<0.01?'ok':'bad'; });
    });
    const doc=A.db.collection('config').doc('packs');
    el.querySelector('#pkSave').onclick=()=>{ const bad=Object.values(all).find(p=>Math.abs(R.reduce((a,r)=>a+(+p.odds[r]||0),0)-100)>0.01);
      if(bad) return BF.App.toast(`${bad.name}: odds must add up to 100%`,'bad');
      const packs={}; Object.values(all).forEach(p=>{ const {id,...rest}=p; packs[id]=rest; });
      doc.set({packs,by:A.profile.name,ts:firebase.firestore.FieldValue.serverTimestamp()}).then(()=>BF.App.toast('Packs & odds published','good')).catch(err); };
    el.querySelector('#pkReset').onclick=e=>{ const b=e.currentTarget; if(!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent='Tap again to reset'; return; }
      doc.set({packs:{}}).then(()=>{ BF.App.toast('Packs reset to defaults'); this.packs(el); }).catch(err); };
  },
  shop(el){
    const S=BF.Store6, c=S.cfg||{}, sale=c.sale||{}, feat=(c.featured||[]).slice(), prices=Object.assign({},c.prices||{});
    const pool=[...Object.keys(BF.BUNDLES).map(k=>'b:'+k),...BF.Packs.list().map(p=>'p:'+p.id),...S.paidCosmetics()].map(id=>S.item(id)).filter(Boolean);
    const ends=sale.ends?new Date(sale.ends).toISOString().slice(0,10):'';
    el.innerHTML=`<p class="dim small">Run sales, pick the featured banner and override prices. Featured left empty = auto-rotates weekly. Changes go live for everyone instantly.</p>
      <div class="rk-grid"><section><h4>Sale</h4>
        <label class="rk-f"><span>Name</span><input class="txt sm" id="shSaleL" maxlength="30" value="${esc(sale.label||'')}" placeholder="Weekend Sale"></label>
        <label class="rk-f"><span>Discount</span><span class="num-wrap"><input class="num" type="number" id="shSaleP" min="0" max="90" value="${sale.pct||0}"><span class="unit">% off everything (0 = no sale)</span></span></label>
        <label class="rk-f"><span>Ends</span><input class="txt sm" type="date" id="shSaleE" value="${ends}"></label></section>
      <section><h4>Featured (limited-time)</h4><div class="chips" id="shFeat">${pool.map(it=>`<button type="button" class="chip${feat.includes(it.id)?' on':''}" data-f="${it.id}">${esc(it.name)}</button>`).join('')}</div>
        <label class="rk-f"><span>Featured ends</span><input class="txt sm" type="date" id="shFeatE" value="${c.featuredEnds?new Date(c.featuredEnds).toISOString().slice(0,10):''}"></label></section></div>
      <h4>Price overrides <span class="dim small">(coins, blank = default)</span></h4>
      <div class="shprices">${pool.map(it=>`<label><span>${esc(it.name)}</span><input class="num" type="number" min="0" data-p="${it.id}" value="${prices[it.id]&&prices[it.id].coins!=null?prices[it.id].coins:''}" placeholder="${it.type==='cosmetic'?BF.Shop.base(it.cat,it.k):it.type==='pack'?BF.Packs.price(it.pack):it.full?Math.round(it.full*0.7/10)*10:''}"></label>`).join('')}</div>
      <div class="addrow"><button class="btn primary" id="shSave">Publish shop</button><button class="btn ghost" id="shReset">Reset shop to auto</button></div>`;
    el.querySelectorAll('[data-f]').forEach(b=>b.onclick=()=>{ const i=feat.indexOf(b.dataset.f); i>=0?feat.splice(i,1):feat.length<6&&feat.push(b.dataset.f); b.classList.toggle('on',feat.includes(b.dataset.f)); });
    const doc=A.db.collection('config').doc('shop');
    el.querySelector('#shSave').onclick=()=>{ const pr={}; el.querySelectorAll('[data-p]').forEach(i=>{ if(i.value!=='') pr[i.dataset.p]={coins:Math.max(0,Math.round(+i.value))}; });
      const se=el.querySelector('#shSaleE').value, fe=el.querySelector('#shFeatE').value;
      doc.set({sale:{label:el.querySelector('#shSaleL').value.trim(),pct:Math.max(0,Math.min(90,+el.querySelector('#shSaleP').value||0)),ends:se?new Date(se+'T23:59:59').getTime():null},
        featured:feat,featuredEnds:fe?new Date(fe+'T23:59:59').getTime():null,prices:pr,by:A.profile.name}).then(()=>BF.App.toast('Shop published','good')).catch(err); };
    el.querySelector('#shReset').onclick=e=>{ const b=e.currentTarget; if(!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent='Tap again to reset'; return; }
      doc.set({}).then(()=>{ BF.App.toast('Shop back to auto'); S.cfg={}; this.shop(el); }).catch(err); };
  },
  events(el){
    const Adv=BF.Adventure, cur=Adv._override&&Adv._override.week===Adv.week()?Adv._override:{}, wb=Adv.weekly();
    el.innerHTML=`<p class="dim small">Set this week’s boss for everyone (Adventure weekly boss + co-op raids). Leave it alone and a new boss rotates in every week automatically.</p>
      <div class="rk-grid"><section>
        <label class="rk-f"><span>Boss name</span><input class="txt sm" id="wbName" maxlength="28" value="${esc(cur.name||wb.name)}"></label>
        <label class="rk-f"><span>Element</span><select id="wbEl">${Object.entries(BF.ELEMENTS).map(([k,e])=>`<option value="${k}"${(cur.element||wb.el)===k?' selected':''}>${e.icon} ${e.label}</option>`).join('')}</select></label>
        <label class="rk-f"><span>Stadium</span><select id="wbTer">${Object.entries(BF.TERRAINS).map(([k,t])=>`<option value="${k}"${(cur.terrain||wb.terrain)===k?' selected':''}>${t.label}</option>`).join('')}</select></label>
        <label class="rk-f"><span>Power</span><span class="num-wrap"><input class="num" type="number" id="wbPow" min="0" max="100" value="${cur.power!=null?cur.power:20}"><span class="unit">% stronger</span></span></label>
        <label class="rk-f"><span>Design seed</span><span class="num-wrap"><input class="num" type="number" id="wbSeed" value="${cur.seed||''}" placeholder="random"><span class="unit">change for a new look</span></span></label>
      </section></div>
      <div class="addrow"><button class="btn primary" id="wbSave">Publish weekly boss</button><button class="btn ghost" id="wbAuto">Back to auto-rotate</button></div>`;
    const doc=A.db.collection('config').doc('weekly');
    el.querySelector('#wbSave').onclick=()=>doc.set({week:Adv.week(),name:el.querySelector('#wbName').value.trim()||wb.name,element:el.querySelector('#wbEl').value,terrain:el.querySelector('#wbTer').value,
      power:Math.max(0,Math.min(100,+el.querySelector('#wbPow').value||0)),seed:+el.querySelector('#wbSeed').value||Math.floor(Math.random()*1e9)}).then(()=>BF.App.toast('Weekly boss published','good')).catch(err);
    el.querySelector('#wbAuto').onclick=()=>doc.set({week:-1}).then(()=>BF.App.toast('Weekly boss back on auto-rotate')).catch(err);
  },
  announce(el){
    el.innerHTML=`<p class="dim small">Shows a banner to every player the next time they open BeyForge.</p>
      <textarea class="txt sm area" id="annText" maxlength="240" placeholder="e.g. Tournament Saturday 7pm — bring your best Bey 🔥"></textarea>
      <div class="addrow"><button class="btn primary" id="annGo">Post announcement</button><button class="btn ghost" id="annClear">Clear</button></div>`;
    A.db.collection('config').doc('announce').get().then(s=>{ const d=s.data(); if(d&&d.text) el.querySelector('#annText').value=d.text; }).catch(()=>{});
    el.querySelector('#annGo').onclick=()=>A.db.collection('config').doc('announce').set({text:el.querySelector('#annText').value.trim(),by:A.profile.name,ts:firebase.firestore.FieldValue.serverTimestamp()}).then(()=>BF.App.toast('Announcement posted','good')).catch(err);
    el.querySelector('#annClear').onclick=()=>A.db.collection('config').doc('announce').set({text:''}).then(()=>{ el.querySelector('#annText').value=''; BF.App.toast('Announcement cleared'); }).catch(err);
  }
};
function err(e){ BF.App.toast(BF.friendly(e),'bad'); }
})();
