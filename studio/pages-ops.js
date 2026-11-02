/* BeyForge Studio — Live ops (game switches) + Team (staff & roles, audit log with undo) */
(function(){
'use strict';
const S=window.Studio, BF=window.BF, {$,$$,esc,FV}=S;

// ---------- Game switches ----------
S.register('switches',{title:'Game switches',icon:'🎛',group:'Live ops',sec:'switches',async render(v){
  const ref=S.db.collection('config').doc('game'); let cfg=(await ref.get()).data()||{};
  const canEdit=S.can('switches','edit'), F=S.f, m=cfg.maintenance||{}, mu=cfg.mult||{}, fe=cfg.features||{}, mb=cfg.minBuild||{};
  const multOn=['coins','xp','drops'].some(k=>(mu[k]||1)>1)&&(!mu.ends||mu.ends>Date.now());
  v.innerHTML=S.head('Game switches','Big levers for the whole game. Every change is live instantly and saved in the audit log.')+
   `<section class="card sw ${m.on?'alert':''}"><div class="swh"><div><h3>🛠 Maintenance mode</h3><p class="muted">Closes the game for everyone except staff and shows your message.</p></div>
      <label class="tog big"><input type="checkbox" id="mOn"${m.on?' checked':''}${canEdit?'':' disabled'}><i></i></label></div>
      <div class="grid2">${F.text('msg','Message players see',m.msg||'',{ph:'BeyForge is getting upgraded. Back soon!',max:160})}${F.dt('until','Expected back (optional)',m.until)}</div><button class="btn" id="mSave"${canEdit?'':' disabled'}>Save message</button></section>
   <section class="card"><h3>⏯ Feature toggles</h3><p class="muted">Turn whole parts of the game off (e.g. while fixing a bug). Staff can still use them to test.</p>
      <div class="togs">${Object.entries(BF.FEATURES||{}).map(([k,l])=>F.tog('f.'+k,l,fe[k]!==false)).join('')}</div><button class="btn primary" id="fSave"${canEdit?'':' disabled'}>Save toggles</button></section>
   <section class="card ${multOn?'glow':''}"><h3>🔥 Reward multipliers ${multOn?S.pill('ACTIVE','good'):''}</h3><p class="muted">Double-coin weekends, XP events and more. Players see a banner while it’s on.</p>
      <div class="grid3">${F.range('coins','Coins',mu.coins||1,{min:1,max:5,step:0.5,unit:'×'})}${F.range('xp','XP',mu.xp||1,{min:1,max:5,step:0.5,unit:'×'})}${F.range('drops','Part drop chance',mu.drops||1,{min:1,max:5,step:0.5,unit:'×'})}</div>
      <div class="grid3">${F.text('label','Event name',mu.label||'',{ph:'Double Coin Weekend',max:40})}${F.dt('starts','Starts (optional)',mu.starts)}${F.dt('ends','Ends',mu.ends)}</div>
      <div class="row"><button class="btn primary" id="xSave"${canEdit?'':' disabled'}>Save event</button><button class="btn" id="xOff"${canEdit?'':' disabled'}>End now</button></div></section>
   <section class="card"><h3>⬆ Force update</h3><p class="muted">Apps older than this build get an “Update required” screen. The build number is the last part of the app version (e.g. 4.3.<b>57</b>). 0 = off.</p>
      <div class="grid2">${F.num('desktop','PC app minimum build',mb.desktop||0,{min:0})}${F.num('android','Android app minimum build',mb.android||0,{min:0})}</div><button class="btn" id="uSave"${canEdit?'':' disabled'}>Save</button></section>`;
  const save=async(patch,label,confirmOpts)=>{ if(confirmOpts&&!await S.confirm(confirmOpts)) return false; const before={}; Object.keys(patch).forEach(k=>before[k]=cfg[k]===undefined?null:cfg[k]);
    await ref.set(patch,{merge:true}); S.audit(label,'game switches',before,patch,{type:'config',doc:'game',merge:true}); cfg=Object.assign(cfg,patch); S.toast('Saved — live now','good'); return true; };
  $('#mOn',v).onchange=async e=>{ const on=e.target.checked, o=S.read(v);
    const ok=await save({maintenance:{on,msg:o.msg||'',until:o.until||null}},on?'turned ON maintenance':'turned off maintenance',on?{title:'Turn on maintenance mode?',body:'Every player (except staff) gets kicked to the maintenance screen right now.',typed:'MAINTENANCE',danger:true,ok:'Close the game'}:null);
    if(!ok) e.target.checked=!on; else S.route(); };
  $('#mSave',v).onclick=()=>{ const o=S.read(v); save({maintenance:{on:!!(cfg.maintenance&&cfg.maintenance.on),msg:o.msg||'',until:o.until||null}},'edited maintenance message'); };
  $('#fSave',v).onclick=()=>{ const o=S.read(v).f, off=Object.entries(o).filter(([,x])=>!x).map(([k])=>BF.FEATURES[k]);
    save({features:o},'changed feature toggles',off.length?{title:'Turn these off?',body:esc(off.join(', ')),ok:'Turn off',danger:true}:null); };
  $('#xSave',v).onclick=()=>{ const o=S.read(v); save({mult:{coins:o.coins,xp:o.xp,drops:o.drops,label:o.label||'',starts:o.starts||null,ends:o.ends||null}},'set reward multipliers',
    (o.coins>2||o.xp>2||o.drops>2)?{title:'Big multiplier!',body:`Coins ${o.coins}× · XP ${o.xp}× · Drops ${o.drops}×${o.ends?'':' with no end date'}. Sure?`,ok:'Start event'}:null).then(ok=>ok&&S.route()); };
  $('#xOff',v).onclick=()=>save({mult:{coins:1,xp:1,drops:1,label:'',ends:null,starts:null}},'ended reward event').then(()=>S.route());
  $('#uSave',v).onclick=()=>{ const o=S.read(v); save({minBuild:{desktop:o.desktop||0,android:o.android||0}},'set minimum app build',(o.desktop||o.android)?{title:'Force players to update?',body:'Older apps will be blocked until they update.',ok:'Save'}:null); };
}});

// ---------- Staff & roles ----------
S.register('staff',{title:'Staff & roles',icon:'🛡',group:'Team',sec:'staff',async render(v,[sel]){
  const roles=Object.values(S.roles).sort((a,b)=>(a.order||0)-(b.order||0)), canEdit=S.can('staff','edit');
  const cur=sel&&S.roles[sel]?S.roles[sel]:roles[0];
  v.innerHTML=S.head('Staff & roles','Create your own ranks. Start from a preset, then tick exactly which Studio sections each rank can see or edit.',canEdit?'<button class="btn primary" id="newR">＋ New rank</button>':'')+
    `<div class="split"><div class="card rlist">${roles.map(r=>`<a href="#/staff/${r.id}" class="rl${cur&&cur.id===r.id?' on':''}"><i style="background:${esc(r.color||'#a78bfa')}"></i><b>${esc(r.name)}</b><span class="muted">${Object.values(r.studio||{}).filter(Boolean).length} sections</span></a>`).join('')||'<p class="muted pad">No ranks yet.</p>'}</div><div id="red"></div></div>`;
  const nb=$('#newR',v); if(nb) nb.onclick=async()=>{ const n=await S.prompt({title:'New rank',label:'Rank name',value:'Moderator',ok:'Create'}); if(!n) return; const id=n.toLowerCase().replace(/[^a-z0-9]+/g,'-').slice(0,24)+'-'+Math.random().toString(36).slice(2,5);
    const st=S.PRESETS[n]||{overview:'view'}; await S.db.collection('roles').doc(id).set({name:n,color:'#a78bfa',badge:n.toUpperCase().slice(0,10),showBadge:true,studio:st,perms:S.derivePerms(st,{}),order:roles.length+1}); S.audit('created rank',n); S.go('staff/'+id); };
  if(!cur){ $('#red',v).innerHTML=S.empty('🛡','Make your first rank','Ranks control what staff can do in Studio and show as a badge in the game.'); return; }
  const st=Object.assign({},cur.studio||{}), sp={editIV:!!(cur.perms&&cur.perms.editIV)};
  const draw=()=>{ const F=S.f;
    $('#red',v).innerHTML=`<div class="card"><div class="grid3">${F.text('name','Rank name',cur.name,{max:24})}${F.text('badge','In-game badge text',cur.badge||cur.name.toUpperCase(),{max:12})}${F.color('color','Badge color',cur.color||'#a78bfa')}</div>
      ${F.tog('showBadge','Show badge + colored name in game',cur.showBadge!==false)}
      <h3 class="mt">Start from a preset</h3><div class="row wrap">${Object.keys(S.PRESETS).map(p=>`<button class="btn sm" data-pre="${esc(p)}">${esc(p)}</button>`).join('')}<button class="btn sm" data-pre="">Clear all</button></div>
      <h3 class="mt">Studio access</h3><table class="tbl perm"><thead><tr><th>Section</th><th>None</th><th>View</th><th>Edit</th></tr></thead><tbody>${S.SECTIONS.map(([k,l,h])=>`<tr><td><b>${esc(l)}</b><div class="muted small">${esc(h)}</div></td>${[null,'view','edit'].map(x=>`<td class="c"><input type="radio" name="s-${k}" value="${x||''}"${(st[k]||null)===x?' checked':''}${canEdit?'':' disabled'}></td>`).join('')}</tr>`).join('')}</tbody></table>
      <h3 class="mt">Special powers</h3>${F.tog('editIV','Edit part IVs',sp.editIV,'Normally owner-only. Players can never edit IVs.')}
      <h3 class="mt">Members</h3><div id="mem"></div>
      <div class="row mt">${canEdit?'<button class="btn primary" id="rSave">Save rank</button><button class="btn danger" id="rDel">Delete rank</button>':''}</div></div>`;
    $$('[data-pre]',v).forEach(b=>b.onclick=()=>{ const p=S.PRESETS[b.dataset.pre]||{}; S.SECTIONS.forEach(([k])=>st[k]=p[k]||null); draw(); });
    $$('.perm input[type=radio]',v).forEach(r=>r.onchange=()=>{ st[r.name.slice(2)]=r.value||null; });
    S.bindLive($('#red',v));
    S.db.collection('users').where('role','==',cur.id).limit(100).get().then(qs=>{ const ms=[]; qs.forEach(d=>ms.push(Object.assign({uid:d.id},d.data())));
      $('#mem',v).innerHTML=`<div class="chips">${ms.map(m=>`<a class="chip" href="#/player/${m.uid}">${esc(m.name)}</a>`).join('')||'<span class="muted">Nobody yet.</span>'}</div>${canEdit?'<div class="row mt"><input class="inp" id="addM" placeholder="Add a player by blader name"><button class="btn" id="addMB">Add</button></div>':''}`;
      const ab=$('#addMB',v); if(ab) ab.onclick=async()=>{ const n=$('#addM',v).value.trim().toLowerCase(); const q=await S.db.collection('users').where('nameLower','==',n).limit(1).get(); if(q.empty) return S.toast('No blader with that name','bad');
        const d=q.docs[0]; if(!await S.confirm({title:`Make ${d.data().name} ${cur.name}?`,body:'They get this rank’s Studio access and badge.',ok:'Add to rank'})) return; await d.ref.update({role:cur.id}); S.audit('set rank',`${d.data().name} → ${cur.name}`,{role:d.data().role||null},{role:cur.id}); S.toast('Added','good'); draw(); }; }).catch(()=>{});
    const sv=$('#rSave',v); if(sv) sv.onclick=async()=>{ const o=S.read($('#red',v)); sp.editIV=!!o.editIV; const nr={name:o.name||cur.name,badge:o.badge||'',color:o.color,showBadge:!!o.showBadge,studio:st,perms:S.derivePerms(st,sp)};
      await S.db.collection('roles').doc(cur.id).update(nr); S.audit('edited rank',nr.name,{name:cur.name,badge:cur.badge||'',color:cur.color||'',showBadge:cur.showBadge!==false,studio:cur.studio||{},perms:cur.perms||{}},nr,{type:'role',id:cur.id}); S.toast('Rank saved','good'); };
    const dl=$('#rDel',v); if(dl) dl.onclick=async()=>{ if(!await S.confirm({title:`Delete ${cur.name}?`,body:'Members keep the rank id but lose all access.',typed:cur.name,danger:true,ok:'Delete rank'})) return; await S.db.collection('roles').doc(cur.id).delete(); S.audit('deleted rank',cur.name,cur,null,{type:'role',id:cur.id}); S.go('staff'); };
  };
  draw();
}});

// ---------- Audit log ----------
async function undo(a){
  const u=a.undo; if(!u) return;
  if(u.type==='config'){ const ref=S.db.collection('config').doc(u.doc); const b=a.before||{}; await ref.set(Object.fromEntries(Object.entries(b).map(([k,x])=>[k,x==null?FV().delete():x])),{merge:true}); }
  else if(u.type==='content'){ const ref=S.db.collection('content').doc(u.id); if(!a.before) await ref.update({status:'draft'}); else if(a.action==='deleted content') await ref.set(a.before); else await ref.update(a.before); }
  else if(u.type==='role'){ const ref=S.db.collection('roles').doc(u.id); if(a.before) await ref.set(a.before,{merge:true}); }
  else if(u.type==='deletePart'){ await S.db.collection('users').doc(u.uid).collection('parts').doc(u.id).delete(); }
  else if(u.type==='restorePart'){ const p=Object.assign({},a.before); delete p.id; await S.db.collection('users').doc(u.uid).collection('parts').doc(u.id).set(p); }
  S.audit('undid: '+a.action,a.target,a.after,a.before);
}
S.register('audit',{title:'Audit log',icon:'📜',group:'Team',sec:'audit',async render(v){
  const qs=await S.db.collection('audit').orderBy('ts','desc').limit(300).get(); const rows=[]; qs.forEach(d=>rows.push(Object.assign({id:d.id},d.data())));
  const who=[...new Set(rows.map(r=>r.byName))]; let fw='';
  v.innerHTML=S.head('Audit log','Every change made in Studio: who, what and when. Many changes can be undone with one click.')+
    `<div class="toolbar"><div class="seg" id="fw"><button class="on" data-w="">Everyone</button>${who.map(w=>`<button data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div></div><div id="at"></div>`;
  const draw=()=>S.table($('#at',v),[{k:'ts',label:'When',fmt:a=>S.when(a.ts),sort:a=>a.ts&&a.ts.toMillis?a.ts.toMillis():0},{k:'byName',label:'Who',fmt:a=>`<b>${esc(a.byName)}</b>`},{k:'action',label:'Action'},{k:'target',label:'Target',fmt:a=>`<span class="ell">${esc(a.target)}</span>`},
      {k:'u',label:'',fmt:a=>a.undo&&S.can('audit','edit')?`<button class="btn xs" data-u="${a.id}">Undo</button>`:''}],rows.filter(a=>!fw||a.byName===fw),{sort:'ts',empty:'No changes yet',
      onRow:a=>{ const c=S.modal(`<h3>${esc(a.byName)} ${esc(a.action)}</h3><p class="muted">${esc(a.target)} · ${S.when(a.ts)}</p><div class="grid2"><div><h4>Before</h4><pre class="code">${esc(JSON.stringify(a.before,null,2)||'—')}</pre></div><div><h4>After</h4><pre class="code">${esc(JSON.stringify(a.after,null,2)||'—')}</pre></div></div><div class="macts"><button class="btn primary" data-x>Close</button></div>`,'wide'); $('[data-x]',c).onclick=()=>S.closeModal(); }});
  draw();
  $$('#fw button',v).forEach(b=>b.onclick=()=>{ fw=b.dataset.w; $$('#fw button',v).forEach(x=>x.classList.toggle('on',x===b)); draw(); });
  v.addEventListener('click',async e=>{ const b=e.target.closest('[data-u]'); if(!b) return; const a=rows.find(x=>x.id===b.dataset.u);
    if(!await S.confirm({title:'Undo this change?',body:`${esc(a.byName)} ${esc(a.action)} — ${esc(a.target)}. This puts things back the way they were before.`,ok:'Undo'})) return;
    try{ await undo(a); S.toast('Undone','good'); S.route(); }catch(err){ S.toast(err.message,'bad'); } });
}});
})();
