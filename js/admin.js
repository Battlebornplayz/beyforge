/* BeyForge — Owner / staff admin panel: ranks & permissions, players (rank, ban, grants), announcements */
(function(){
'use strict';
const BF=window.BF, A=BF.Account;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PERMS={grant:'Give coins, XP, unlocks & ranks',moderate:'Moderate chat & gallery, ban players',manageRoles:'Create & edit ranks',manageGame:'Post announcements'};

BF.Admin = {
  tab:'ranks',
  render(root){
    if(!root) return;
    const tabs=[['ranks','Ranks',A.can('manageRoles')],['players','Players',A.can('grant')||A.can('moderate')],['announce','Announcement',A.can('manageGame')],['ranked','Ranked rules',A.can('manageGame')]].filter(t=>t[2]);
    if(!tabs.find(t=>t[0]===this.tab)) this.tab=tabs[0]&&tabs[0][0];
    root.innerHTML=`<h3>${A.isOwner?'Owner panel':'Staff panel'} <span class="cnt gold">${A.isOwner?'OWNER':'STAFF'}</span></h3>
      <div class="seg sm admtabs">${tabs.map(([k,l])=>`<button type="button" class="${this.tab===k?'on':''}" data-t="${k}">${l}</button>`).join('')}</div><div id="admBody"></div>`;
    root.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{ this.tab=b.dataset.t; this.render(root); });
    const body=root.querySelector('#admBody');
    if(this.tab==='ranks') this.ranks(body); else if(this.tab==='players') this.players(body); else if(this.tab==='announce') this.announce(body); else if(this.tab==='ranked') BF.Ranked.editor(body);
  },
  ranks(el){
    const roles=Object.entries(A.roles).sort((a,b)=>(b[1].order||0)-(a[1].order||0));
    el.innerHTML=`<p class="dim small">Ranks control what people can do. Give a rank to a player in the Players tab. Only you (the Owner) can never be demoted.</p>
      <div class="ranklist">${roles.map(([id,r])=>`<div class="rankrow" data-id="${id}">
        <input type="color" value="${r.color||'#a07bff'}" data-f="color" aria-label="Rank color"><input class="txt sm" value="${esc(r.name)}" data-f="name" maxlength="20" aria-label="Rank name">
        <div class="permchips">${Object.entries(PERMS).map(([k,l])=>`<label class="pchip${r.perms&&r.perms[k]?' on':''}" title="${esc(l)}"><input type="checkbox" data-p="${k}"${r.perms&&r.perms[k]?' checked':''}>${esc(l.split(',')[0].split(' &')[0])}</label>`).join('')}</div>
        <button class="icon-x" data-del title="Delete rank">×</button></div>`).join('')||'<div class="fine">No ranks yet.</div>'}</div>
      <form class="addrow" id="newRank"><input class="txt sm" id="rankName" placeholder="New rank name (e.g. Admin, Mod, VIP)" maxlength="20"><button class="btn primary">Create rank</button></form>
      <div class="fine">Tip: a rank with no boxes ticked is just a cosmetic title (like VIP).</div>`;
    const col=A.db.collection('roles');
    el.querySelectorAll('.rankrow').forEach(row=>{ const id=row.dataset.id;
      row.querySelectorAll('[data-f]').forEach(i=>i.onchange=()=>col.doc(id).update({[i.dataset.f]:i.value}).catch(err));
      row.querySelectorAll('[data-p]').forEach(i=>i.onchange=()=>{ i.parentElement.classList.toggle('on',i.checked); col.doc(id).update({['perms.'+i.dataset.p]:i.checked}).catch(err); });
      const del=row.querySelector('[data-del]'); del.onclick=()=>{ if(!del.classList.contains('confirm')){ del.classList.add('confirm'); del.textContent='?'; setTimeout(()=>{ del.classList.remove('confirm'); del.textContent='×'; },2500); return; } col.doc(id).delete().catch(err); };
    });
    el.querySelector('#newRank').onsubmit=e=>{ e.preventDefault(); const n=el.querySelector('#rankName').value.trim(); if(!n) return;
      const id=n.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24)||('rank'+Date.now());
      col.doc(id).set({name:n,color:'#a07bff',perms:{grant:false,moderate:false,manageRoles:false,manageGame:false},order:Object.keys(A.roles).length+1}).then(()=>BF.App.toast('Rank created','good')).catch(err); };
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
      ${A.can('grant')?`<div class="grant"><input class="num" type="number" value="100" min="-99999" max="99999" data-a="amt" aria-label="Amount"><button class="btn" data-a="coins">+ Coins</button><button class="btn" data-a="xp">+ XP</button><button class="btn" data-a="all" title="Unlock every cosmetic">Unlock all</button></div>`:''}
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
        if(a==='ban') c.onclick=()=>ref.update({banned:!p.banned}).then(()=>{ p.banned=!p.banned; c.textContent=p.banned?'Unban':'Ban'; BF.App.toast(p.banned?`${p.name} banned`:`${p.name} unbanned`); }).catch(err);
      }); });
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
