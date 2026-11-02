/* BeyForge Studio — Players: search, profile, inventory, give & take, moderation, activity */
(function(){
'use strict';
const S=window.Studio, BF=window.BF, {$,$$,esc,FV}=S;
const RC={common:'#9aa3b5',rare:'#22d3ee',epic:'#a78bfa',legendary:'#f5c518',limited:'#f472b6'};
const rpill=r=>`<span class="pill" style="--pc:${RC[r]||'#9aa3b5'}">${esc((BF.RARITY&&BF.RARITY[r]||{label:r}).label)}</span>`;
const online=p=>p.lastSeen&&p.lastSeen.toMillis&&Date.now()-p.lastSeen.toMillis()<3*60000;
const flags=p=>[p.banned&&S.pill('Banned','bad'),p.muted&&(!p.mutedUntil||p.mutedUntil>Date.now())&&S.pill('Muted','warn'),p.shadowBanned&&S.pill('Shadow','warn')].filter(Boolean).join(' ');
const roleTag=p=>{ const r=p.role&&S.roles[p.role]; return p.isOwnerFlag?S.pill('Owner','own'):r?`<span class="pill" style="--pc:${esc(r.color||'#a78bfa')}">${esc(r.badge||r.name)}</span>`:''; };
// tell the player in-game + record it on their activity log
const notify=(uid,text)=>S.db.collection('users').doc(uid).collection('inbox').add({type:'chat',from:S.user.uid,fromName:(S.profile.name||'Staff')+' (staff)',text,ts:FV().serverTimestamp()}).catch(()=>{});
const plog=(uid,type,data)=>S.db.collection('users').doc(uid).collection('log').add({type,data:Object.assign({by:S.profile.name||'staff'},data),staff:true,ts:FV().serverTimestamp()}).catch(()=>{});

S.register('players',{title:'Players',icon:'👤',group:'Players',sec:'players',async render(v,[q0]){
  let sort='lastSeen';
  v.innerHTML=S.head('Players','Search any blader by name. Click a row to open their profile.')+
    `<div class="toolbar"><input class="inp grow" id="pq" placeholder="Search by blader name…" value="${esc(q0||'')}"><div class="seg" id="ps">${[['lastSeen','Recently active'],['created','Newest'],['level','Top level'],['coins','Most coins'],['rating','Top ranked']].map(([k,l])=>`<button data-s="${k}" class="${k===sort?'on':''}">${l}</button>`).join('')}</div></div><div id="pt"></div>`;
  const load=async()=>{ const q=$('#pq',v).value.trim().toLowerCase(); $('#pt',v).innerHTML='<div class="loading"><i></i></div>';
    let ref=S.db.collection('users'); ref=q?ref.where('nameLower','>=',q).where('nameLower','<',q+'').limit(50):ref.orderBy(sort,'desc').limit(50);
    const qs=await ref.get(); const rows=[]; qs.forEach(d=>rows.push(Object.assign({uid:d.id},d.data())));
    S.table($('#pt',v),[{k:'name',label:'Blader',fmt:p=>`<span class="pname"><span class="avatar sm">${esc((p.name||'?')[0].toUpperCase())}</span>${online(p)?'<i class="dot live"></i>':''}<b>${esc(p.name)}</b> ${roleTag(p)} ${flags(p)}</span>`},
      {k:'level',label:'Level',cls:'r'},{k:'coins',label:'Coins',cls:'r',fmt:p=>S.num(p.coins||0)},{k:'gems',label:'Gems',cls:'r',fmt:p=>S.num(p.gems||0)},{k:'rating',label:'Rating',cls:'r',fmt:p=>p.rating||1000},
      {k:'w',label:'W–L',cls:'r',fmt:p=>`${(p.stats&&p.stats.wins)||0}–${(p.stats&&p.stats.losses)||0}`,sort:p=>(p.stats&&p.stats.wins)||0},{k:'lastSeen',label:'Last seen',fmt:p=>S.ago(p.lastSeen),sort:p=>p.lastSeen&&p.lastSeen.toMillis?p.lastSeen.toMillis():0}],rows,{onRow:p=>S.go('player/'+p.uid),empty:q?'No bladers match that name':'No players yet'}); };
  let tm; $('#pq',v).oninput=()=>{ clearTimeout(tm); tm=setTimeout(load,250); };
  $$('#ps button',v).forEach(b=>b.onclick=()=>{ sort=b.dataset.s; $$('#ps button',v).forEach(x=>x.classList.toggle('on',x===b)); $('#pq',v).value=''; load(); });
  load();
}});

S.register('player',{title:'Player',icon:'👤',group:'Players',sec:'players',hidden:true,async render(v,[uid,tab]){
  const ref=S.db.collection('users').doc(uid); tab=tab||'overview';
  const TABS=[['overview','Overview','players'],['inventory','Inventory','players'],['give','Give & take','give'],['moderation','Moderation','moderation'],['activity','Activity log','players']].filter(t=>S.can(t[2]));
  const draw=p=>{ if(v._tab===tab&&v._uid===uid&&v.querySelector('.ptabs')){ v.querySelector('.phero').outerHTML=hero(p); bindHero(p); return; } v._tab=tab; v._uid=uid;
    v.innerHTML=hero(p)+`<div class="ptabs">${TABS.map(([k,l])=>`<a href="#/player/${uid}/${k}" class="${k===tab?'on':''}">${l}</a>`).join('')}</div><div id="ptab"></div>`; bindHero(p);
    ({overview,inventory,give,moderation,activity}[tab]||overview)($('#ptab',v),p); };
  const hero=p=>`<div class="phero"><span class="avatar lg">${esc((p.name||'?')[0].toUpperCase())}</span><div><h1>${esc(p.name)} ${roleTag(p)} ${flags(p)}</h1>
    <p class="muted">${online(p)?'<i class="dot live"></i> Online now':'Last seen '+S.ago(p.lastSeen)} · joined ${p.created?S.when(p.created):'—'} · <code>${esc(uid)}</code></p></div>
    <div class="hstats"><span><b>${p.level||1}</b>Level</span><span><b>${S.num(p.coins||0)}</b>Coins</span><span><b>${S.num(p.gems||0)}</b>Gems</span><span><b>${p.rating||1000}</b>Rating</span></div></div>`;
  const bindHero=()=>{};
  const un=ref.onSnapshot(snap=>{ if(!snap.exists){ v.innerHTML=S.empty('?','Player not found',''); return; } const p=Object.assign({uid},snap.data()); draw(p); },e=>v.innerHTML=S.empty('⚠','Can’t load player',esc(e.message)));
  S.onLeave(un);

  function overview(el,p){ const st=p.stats||{}, f=st.finishes||{};
    el.innerHTML=`<div class="grid2"><section class="card"><h3>Profile</h3><dl class="kv"><dt>Title</dt><dd>${esc(p.title||'—')}</dd><dt>XP</dt><dd>${S.num(p.xp||0)}</dd><dt>Rank</dt><dd>${p.role&&S.roles[p.role]?esc(S.roles[p.role].name):'Player'}</dd>
      <dt>Streak</dt><dd>${p.streak?`day ${p.streak.n} (last ${esc(p.streak.last)})`:'—'}</dd><dt>Unlocks</dt><dd>${(p.unlocks||[]).length} cosmetics</dd><dt>Friends</dt><dd id="fc">…</dd><dt>Warnings</dt><dd>${(p.warnings||[]).length}</dd></dl></section>
      <section class="card"><h3>Battle record</h3><div class="kpis sm">${S.kpi('Matches',S.num(st.matches||0))}${S.kpi('Wins',S.num(st.wins||0))}${S.kpi('Losses',S.num(st.losses||0))}${S.kpi('Win rate',st.matches?Math.round((st.wins||0)/st.matches*100)+'%':'—')}</div>
      <div id="fin"></div><dl class="kv"><dt>Online</dt><dd>${(st.online&&st.online.wins)||0}W ${(st.online&&st.online.losses)||0}L</dd><dt>Ranked</dt><dd>${(st.ranked&&st.ranked.wins)||0}W ${(st.ranked&&st.ranked.losses)||0}L</dd></dl></section></div>`;
    S.bars($('#fin',el),Object.entries(f).map(([k,n])=>({l:k+' finish',v:n})));
    ref.collection('friends').get().then(q=>$('#fc',el).textContent=q.size).catch(()=>$('#fc',el).textContent='—'); }

  async function inventory(el,p){ el.innerHTML='<div class="loading"><i></i></div>';
    const [ps,bs]=await Promise.all([ref.collection('parts').get().catch(()=>null),ref.collection('beys').limit(50).get().catch(()=>null)]);
    const parts=[]; ps&&ps.forEach(d=>parts.push(Object.assign({id:d.id},d.data()))); const beys=[]; bs&&bs.forEach(d=>beys.push(Object.assign({id:d.id},d.data())));
    const ivEdit=S.canPerm('editIV'), canGive=S.can('give','edit'); const ivTot=x=>Object.values(x.iv||{}).reduce((a,b)=>a+b,0);
    el.innerHTML=`<section class="card"><h3>Parts <span class="muted">(${parts.length})</span></h3><div id="it"></div></section><section class="card"><h3>Saved Beys <span class="muted">(${beys.length})</span></h3><div id="bt"></div></section>
      <section class="card"><h3>Cosmetics</h3><div class="chips">${(p.unlocks||[]).map(u=>`<span class="chip">${esc(u)}</span>`).join('')||'<span class="muted">None unlocked</span>'}</div></section>`;
    S.table($('#it',el),[{k:'name',label:'Part',fmt:x=>`${x.shiny?'✨ ':''}<b>${esc(x.name)}</b>${x.liveId?' '+S.pill('Studio','own'):''}`},{k:'slot',label:'Slot'},{k:'rarity',label:'Rarity',fmt:x=>rpill(x.rarity),sort:x=>['common','rare','epic','legendary','limited'].indexOf(x.rarity)},
      {k:'lv',label:'Lv',cls:'r',fmt:x=>BF.partLevel?BF.partLevel(x.xp).lv:'—',sort:x=>x.xp||0},{k:'iv',label:'IVs',fmt:x=>`<code>${Object.values(x.iv||{}).join('/')}</code> <span class="muted">${Math.round(ivTot(x)/155*100)}%</span>`,sort:ivTot},
      {k:'source',label:'From'},{k:'ts',label:'Got',fmt:x=>S.ago(x.ts),sort:x=>x.ts||0},
      {k:'a',label:'',fmt:x=>`${ivEdit?`<button class="btn xs" data-iv="${x.id}">Edit IVs</button>`:''}${canGive?`<button class="btn xs danger" data-rm="${x.id}">Remove</button>`:''}`}],parts,{sort:'ts',empty:'No parts yet'});
    $$('[data-rm]',el).forEach(b=>b.onclick=async()=>{ const x=parts.find(q=>q.id===b.dataset.rm); if(!await S.confirm({title:`Remove ${x.name}?`,body:`Deletes this ${x.rarity} part from ${esc(p.name)}’s inventory.`,ok:'Remove part',danger:true})) return;
      await ref.collection('parts').doc(x.id).delete(); S.audit('removed part',p.name+' · '+x.name,x,null,{type:'restorePart',uid,id:x.id}); plog(uid,'staff',{action:'removed part',part:x.name}); S.toast('Part removed'); inventory(el,p); });
    $$('[data-iv]',el).forEach(b=>b.onclick=()=>{ const x=parts.find(q=>q.id===b.dataset.iv); const K=['atk','def','sta','brs','stb'];
      const c=S.modal(`<h3>Edit IVs — ${esc(x.name)}</h3><p class="muted">0–31 each. Only the owner and ranks with “Edit IVs” can do this; it’s logged.</p><div class="grid5">${K.map(k=>S.f.num('iv.'+k,(BF.PSTATS&&BF.PSTATS[k])||k,x.iv[k],{min:0,max:31})).join('')}</div><div class="macts"><button class="btn" data-x>Cancel</button><button class="btn primary" id="ivS">Save IVs</button></div>`);
      $('[data-x]',c).onclick=()=>S.closeModal(); $('#ivS',c).onclick=async()=>{ const iv=S.read(c).iv; K.forEach(k=>iv[k]=Math.max(0,Math.min(31,Math.round(+iv[k]||0)))); await ref.collection('parts').doc(x.id).update({iv});
        S.audit('edited IVs',p.name+' · '+x.name,{iv:x.iv},{iv}); plog(uid,'staff',{action:'edited IVs',part:x.name}); S.closeModal(); S.toast('IVs saved','good'); inventory(el,p); }; });
    S.table($('#bt',el),[{k:'name',label:'Bey',fmt:b=>`<b>${esc((b.meta&&b.meta.full)||b.name||'Bey')}</b>`},{k:'public',label:'Public',fmt:b=>b.public?'Yes':'—'},{k:'ts',label:'Saved',fmt:b=>S.ago(b.ts||b.updated)}],beys,{empty:'No saved Beys'});
  }

  function give(el,p){
    const packs=BF.Packs?BF.Packs.list():[], cats=BF.Shop?BF.Shop.CATS:{};
    el.innerHTML=`<div class="grid2"><section class="card"><h3>Currency & XP</h3><p class="muted">Use a negative number to take away.</p>
        <div class="grid3">${S.f.num('coins','Coins',0)}${S.f.num('gems','Gems',0)}${S.f.num('xp','XP',0)}</div>${S.f.text('reason','Reason (shown to the player)','',{ph:'e.g. Tournament prize'})}
        <button class="btn primary" id="gc">Apply</button></section>
      <section class="card"><h3>Send a pack</h3><p class="muted">Arrives in their inbox, they open it with the full pack animation.</p>${S.f.sel('pack','Pack',packs[0]&&packs[0].id,Object.fromEntries(packs.map(x=>[x.id,x.name])))}${S.f.num('n','How many',1,{min:1,max:10})}<button class="btn primary" id="gp">Send pack</button></section></div>
      <div class="grid2"><section class="card"><h3>Give a part</h3>${S.f.sel('slot','Slot','blade',{blade:'Blade',core:'Core (ratchet/disc)',driver:'Driver (bit)'})}${S.f.sel('rar','Rarity','epic',{common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary',limited:'Limited'})}
        ${S.f.sel('src','Design','random',Object.assign({random:'Random design'},Object.fromEntries((S.liveParts||[]).map(x=>['live:'+x.id,'Studio part: '+x.data.name]))))}${S.f.tog('shiny','Shiny',false)}<button class="btn primary" id="gpt">Give part</button></section>
      <section class="card"><h3>Cosmetics</h3>${S.f.sel('ccat','Category','trail',cats)}<div id="ckeys"></div><div class="row"><button class="btn primary" id="gcu">Unlock</button><button class="btn" id="gcr">Remove</button></div></section></div>`;
    const ckeys=()=>{ const cat=$('[data-f=ccat]',el).value; $('#ckeys',el).innerHTML=S.f.sel('ckey','Item',null,Object.fromEntries(Object.keys(BF.Shop.P[cat]||{}).map(k=>[k,BF.Shop.label(cat,k)+((p.unlocks||[]).includes(cat+':'+k)?' ✓ owned':'')]))); };
    $('[data-f=ccat]',el).onchange=ckeys; ckeys();
    if(!S.liveParts) S.db.collection('content').where('kind','==','part').get().then(qs=>{ S.liveParts=[]; qs.forEach(d=>S.liveParts.push(Object.assign({id:d.id},d.data()))); if(S.liveParts.length) give(el,p); }).catch(()=>{});
    $('#gc',el).onclick=async()=>{ const o=S.read(el), up={}, parts=[]; ['coins','gems','xp'].forEach(k=>{ const n=Math.round(+o[k]||0); if(n){ up[k]=FV().increment(n); parts.push(`${n>0?'+':''}${n} ${k}`); } }); if(!parts.length) return S.toast('Enter an amount','bad');
      const big=Math.abs(+o.coins||0)>=10000||Math.abs(+o.gems||0)>=500; if(big&&!await S.confirm({title:'That’s a lot',body:`Give ${esc(p.name)} ${esc(parts.join(', '))}?`,typed:'GIVE',ok:'Give it'})) return;
      if(up.xp){ const xp=Math.max(0,(p.xp||0)+(+o.xp)); up.xp=xp; up.level=BF.levelFor?BF.levelFor(xp):p.level; }
      await ref.update(up); S.audit('gave',p.name+' · '+parts.join(', '),{coins:p.coins,gems:p.gems,xp:p.xp},null); plog(uid,'staff',{action:'currency',change:parts.join(', '),reason:o.reason||''});
      if(o.reason) notify(uid,`🎁 ${parts.join(', ')} — ${o.reason}`); S.toast(`Done: ${parts.join(', ')}`,'good'); };
    $('#gp',el).onclick=async()=>{ const o=S.read(el), n=Math.max(1,Math.min(10,o.n||1)); const b=S.db.batch(); for(let i=0;i<n;i++) b.set(ref.collection('inbox').doc(),{type:'pack',kind:o.pack,from:S.user.uid,fromName:S.profile.name||'Staff',ts:FV().serverTimestamp()});
      await b.commit(); S.audit('sent pack',`${p.name} · ${n}× ${o.pack}`); plog(uid,'staff',{action:'sent pack',pack:o.pack,n}); S.toast(`Sent ${n} pack${n>1?'s':''}`,'good'); };
    $('#gpt',el).onclick=async()=>{ const o=S.read(el); let slot=o.slot, d, extra={};
      if(o.src.startsWith('live:')){ const lp=S.liveParts.find(x=>x.id===o.src.slice(5)); d=BF.normalize(BF.clone(lp.data.design)); slot=lp.data.slot; extra={name:lp.data.name,liveId:lp.id}; } else d=BF.Parts.randomDesign();
      const part=BF.Parts.make(slot,d,o.rar,'staff'); Object.assign(part,extra); part.shiny=!!o.shiny; if(part.shiny) BF.Parts.shinyPaint(part); if(['legendary','limited'].includes(o.rar)) part.sig=BF.sigFor(BF.partElements(d)[slot]);
      const id=part.id; delete part.id; await ref.collection('parts').doc(id).set(part); S.audit('gave part',`${p.name} · ${part.name} (${o.rar})`,null,{id},{type:'deletePart',uid,id}); plog(uid,'staff',{action:'gave part',part:part.name,rarity:o.rar});
      notify(uid,`🎁 You got a ${o.rar} ${part.name}! Check your Parts tab.`); S.toast(`Gave ${part.name}`,'good'); };
    const cos=async add=>{ const cat=$('[data-f=ccat]',el).value, key=$('[data-f=ckey]',el).value, id=cat+':'+key; await ref.update({unlocks:add?FV().arrayUnion(id):FV().arrayRemove(id)}); S.audit(add?'unlocked cosmetic':'removed cosmetic',p.name+' · '+id); plog(uid,'staff',{action:add?'unlocked':'removed',item:id}); S.toast(add?'Unlocked':'Removed','good'); };
    $('#gcu',el).onclick=()=>cos(true); $('#gcr',el).onclick=()=>cos(false);
  }

  function moderation(el,p){ const muted=p.muted&&(!p.mutedUntil||p.mutedUntil>Date.now());
    el.innerHTML=`<div class="grid2"><section class="card"><h3>Status</h3><dl class="kv"><dt>Banned</dt><dd>${p.banned?`<b class="down">Yes</b> — ${esc(p.banReason||'')}`:'No'}</dd><dt>Muted</dt><dd>${muted?`Yes${p.mutedUntil?' until '+S.when(p.mutedUntil):' (permanent)'}`:'No'}</dd><dt>Shadow banned</dt><dd>${p.shadowBanned?'Yes — only matched with other shadow-banned players':'No'}</dd></dl>
      <div class="row wrap">${p.banned?'<button class="btn" id="unban">Unban</button>':'<button class="btn danger" id="ban">Ban…</button>'}${muted?'<button class="btn" id="unmute">Unmute</button>':'<button class="btn" id="mute">Mute chat…</button>'}<button class="btn" id="shadow">${p.shadowBanned?'Remove shadow ban':'Shadow ban'}</button><button class="btn" id="warn">Send warning…</button></div></section>
      <section class="card"><h3>Rank</h3>${S.can('staff','edit')?S.f.sel('role','Staff rank',p.role||'',Object.assign({'':'Player (no rank)'},Object.fromEntries(Object.values(S.roles).map(r=>[r.id,r.name]))))+'<button class="btn primary" id="setRole">Save rank</button>':`<p>${p.role&&S.roles[p.role]?esc(S.roles[p.role].name):'Player'}</p><p class="muted">Only ranks with Staff & roles edit can change this.</p>`}
      <h3 class="mt">Warnings</h3><ul class="feed">${(p.warnings||[]).map(w=>`<li>${esc(w.text)}<em>${esc(w.by)} · ${S.when(w.ts)}</em></li>`).join('')||'<li class="muted">None</li>'}</ul></section></div>`;
    const act=async(label,up,before,note)=>{ await ref.update(up); S.audit(label,p.name+(note?' · '+note:''),before,up); plog(uid,'staff',{action:label,note:note||''}); S.toast(label,'good'); };
    const q=s=>$(s,el);
    if(q('#ban')) q('#ban').onclick=async()=>{ const r=await S.prompt({title:`Ban ${p.name}?`,label:'Reason (they’ll see this)',ok:'Next'}); if(r==null) return; if(!await S.confirm({title:`Ban ${p.name}`,body:'They won’t be able to post, trade or play online.',typed:p.name,danger:true,ok:'Ban'})) return; act('banned',{banned:true,banReason:r},{banned:false},r); };
    if(q('#unban')) q('#unban').onclick=()=>act('unbanned',{banned:false,banReason:null},{banned:true,banReason:p.banReason||null});
    if(q('#mute')) q('#mute').onclick=async()=>{ const h=await S.prompt({title:`Mute ${p.name}`,label:'Hours (0 = permanent)',type:'number',value:24,ok:'Mute'}); if(h==null) return; const until=+h>0?Date.now()+(+h)*3600000:null; act('muted',{muted:true,mutedUntil:until},{muted:false},+h>0?h+'h':'permanent'); if(+h>0) notify(uid,`🔇 You’ve been muted for ${h} hours.`); };
    if(q('#unmute')) q('#unmute').onclick=()=>act('unmuted',{muted:false,mutedUntil:null},{muted:true,mutedUntil:p.mutedUntil||null});
    q('#shadow').onclick=async()=>{ if(!p.shadowBanned&&!await S.confirm({title:`Shadow ban ${p.name}?`,body:'They can still play, but ranked/online matchmaking only pairs them with other shadow-banned players. They are not told.',ok:'Shadow ban',danger:true})) return; act(p.shadowBanned?'removed shadow ban':'shadow banned',{shadowBanned:!p.shadowBanned},{shadowBanned:!!p.shadowBanned}); };
    q('#warn').onclick=async()=>{ const t=await S.prompt({title:`Warn ${p.name}`,label:'Message (sent to their inbox)',ok:'Send warning'}); if(!t) return; await act('warned',{warnings:FV().arrayUnion({text:t,by:S.profile.name||'staff',ts:Date.now()})},null,t); notify(uid,'⚠ Warning from staff: '+t); };
    if(q('#setRole')) q('#setRole').onclick=async()=>{ const r=$('[data-f=role]',el).value||null; if(r&&!await S.confirm({title:`Make ${p.name} ${S.roles[r].name}?`,body:'They get every Studio permission that rank has.',ok:'Give rank'})) return; act('set rank',{role:r},{role:p.role||null},r?S.roles[r].name:'Player'); };
  }

  async function activity(el){ el.innerHTML='<div class="loading"><i></i></div>';
    const qs=await ref.collection('log').orderBy('ts','desc').limit(150).get().catch(e=>{ el.innerHTML=S.empty('⚠','Can’t read the log',esc(e.message)); return null; }); if(!qs) return;
    const rows=[]; qs.forEach(d=>rows.push(d.data())); const types=[...new Set(rows.map(r=>r.type))];
    const desc=r=>{ const d=r.data||{}; if(r.type==='pack') return `Opened <b>${esc((BF.Packs&&BF.Packs.get(d.pack)||{name:d.pack}).name)}</b>: ${(d.parts||[]).map(x=>`<span style="color:${RC[x.r]}">${x.s?'✨':''}${esc(x.n)}</span>`).join(', ')}`;
      if(r.type==='buy') return `Bought <code>${esc(d.item)}</code> with ${esc(d.cur)}`; if(r.type==='gift') return `Gifted <code>${esc(d.item)}</code>`; if(r.type==='trade') return `Trade (${esc(d.kind)})`;
      if(r.type==='staff') return `<b>${esc(d.by)}</b> (staff): ${esc(d.action)} ${esc(d.change||d.part||d.pack||d.item||d.note||'')}${d.reason?` — “${esc(d.reason)}”`:''}`; return esc(JSON.stringify(d)); };
    el.innerHTML=`<div class="toolbar"><div class="seg" id="lf"><button class="on" data-t="">All</button>${types.map(t=>`<button data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div><div id="lt"></div>`;
    const draw=t=>{ const rs=rows.filter(r=>!t||r.type===t); $('#lt',el).innerHTML=rs.length?`<ul class="feed log">${rs.map(r=>`<li class="${r.staff?'staff':''}"><span class="lt">${esc(r.type)}</span><span>${desc(r)}</span><em>${S.when(r.ts)}</em></li>`).join('')}</ul>`:S.empty('📜','No activity yet','Pack openings, purchases, gifts, trades and staff actions show up here.'); };
    $$('#lf button',el).forEach(b=>b.onclick=()=>{ $$('#lf button',el).forEach(x=>x.classList.toggle('on',x===b)); draw(b.dataset.t); }); draw('');
  }
}});
})();
