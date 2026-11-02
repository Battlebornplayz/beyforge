/* BeyForge — Blader tab: sign-in, profile, friends, inbox, chat, invites, gifts, leaderboard, admin */
(function(){
'use strict';
const BF=window.BF, A=BF.Account, $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const FV=()=>firebase.firestore.FieldValue;
const ago=ts=>{ if(!ts) return 'never'; const t=ts.toDate?ts.toDate():new Date(ts); const s=(Date.now()-t)/1000; if(s<120) return 'online'; if(s<3600) return Math.round(s/60)+'m ago'; if(s<86400) return Math.round(s/3600)+'h ago'; return Math.round(s/86400)+'d ago'; };
const online=ts=>ago(ts)==='online';
const avatar0=(p,size)=>p&&p.avatar?`<img class="av" style="--s:${size||40}px" src="${p.avatar}" alt="">`:`<span class="av ph" style="--s:${size||40}px">${esc(((p&&p.name)||'?')[0].toUpperCase())}</span>`;
const avatar=(p,size)=>`<span class="avf fr-${(p&&p.card&&p.card.frame)||'ring'}" style="--s:${size||40}px">${avatar0(p,size)}</span>`;
const PERMS={grant:'Give coins, XP, unlocks & ranks',moderate:'Moderate chat, gallery, bans',manageRoles:'Create & edit ranks',manageGame:'Announcements & game settings'};

const S = BF.Social = {
  inbox:[], friends:{}, friendProfiles:{}, unsub:[], chatUnsub:null, chatWith:null,
  init(){
    A.on(()=>this.onAccount());
    $('#acctBtn').addEventListener('click',()=>document.querySelector('#tabs [data-tab=profile]').click());
    $('#chatClose').addEventListener('click',()=>this.closeChat());
    $('#chatForm').addEventListener('submit',e=>{ e.preventDefault(); this.sendChat(); });
  },
  onAccount(){
    this.paintAcctBtn();
    if(A.user&&A.profile&&!this._live){ this._live=A.user.uid; this.listen(); }
    if(!A.profile&&this._live){ this.unsub.forEach(f=>f()); this.unsub=[]; this._live=null; this.inbox=[]; this.friends={}; }
    if(!$('#view-profile').hidden) this.render();
    const u=JSON.stringify((A.profile&&A.profile.unlocks)||[])+(A.isOwner?'o':''); if(u!==this._unl){ this._unl=u; BF.App.renderControls&&BF.App.asm&&BF.App.renderControls(); }
  },
  paintAcctBtn(){
    const b=$('#acctBtn'), p=A.profile, n=this.inbox.length;
    b.innerHTML = p ? `${avatar(p,28)}<span class="an">${esc(p.name)}</span><b class="lv">${p.level||1}</b>${n?`<i class="dot">${n}</i>`:''}` : `<span class="an">Sign in</span>`;
    b.classList.toggle('signed',!!p);
  },
  listen(){
    const me=A.ref();
    this.unsub.push(me.collection('inbox').orderBy('ts','desc').limit(50).onSnapshot(qs=>{
      const before=new Set(this.inbox.map(x=>x.id)); this.inbox=[]; qs.forEach(d=>this.inbox.push(Object.assign({id:d.id},d.data())));
      this.inbox.filter(x=>!before.has(x.id)&&this._seeded).forEach(x=>this.notify(x)); this._seeded=true; this.paintAcctBtn(); if(!$('#view-profile').hidden) this.render(); },e=>console.warn(e)));
    this.unsub.push(me.collection('friends').onSnapshot(qs=>{
      const ids=new Set(); qs.forEach(d=>{ ids.add(d.id); this.friends[d.id]=d.data(); if(!this.friendProfiles[d.id]||!this.friendProfiles[d.id]._sub){ const u=A.ref(d.id).onSnapshot(s=>{ this.friendProfiles[d.id]=Object.assign(s.data()||{},{_sub:true}); if(!$('#view-profile').hidden) this.renderFriends(); },()=>{}); this.unsub.push(u); this.friendProfiles[d.id]={_sub:true}; } });
      Object.keys(this.friends).forEach(k=>{ if(!ids.has(k)) delete this.friends[k]; }); if(!$('#view-profile').hidden) this.renderFriends(); }));
  },
  notify(x){
    const msg={friend:`${x.fromName} sent you a friend request`,invite:`${x.fromName} invited you to battle!`,gift:`${x.fromName} sent you a Bey: ${x.meta&&x.meta.full||''}`,trade:`${x.fromName} wants to trade: ${x.meta&&x.meta.full||''}`,giftItem:`${x.fromName} gifted you ${x.label||'something'} 🎁`,chat:`${x.fromName}: ${x.text||''}`}[x.type]||'New notification';
    BF.App.toast(msg,'good'); BF.Sfx&&BF.Sfx.beep(true);
  },

  // ---------- views ----------
  render(){
    const root=$('#profileRoot');
    if(!A.available()){ root.innerHTML=`<div class="empty"><b>Accounts are offline</b><span>Couldn’t load the account system — check your internet connection.</span></div>`; return; }
    if(!A.ready){ root.innerHTML=`<div class="empty"><span class="netwait">Loading your account…</span></div>`; return; }
    if(!A.user) return this.renderSignIn(root);
    if(A.needsName) return this.renderClaim(root);
    if(!A.profile){ root.innerHTML=`<div class="empty"><span class="netwait">Loading profile…</span></div>`; return; }
    const p=A.profile, lvl=p.level||1, xp=p.xp||0, x0=BF.xpForLevel(lvl), x1=BF.xpForLevel(lvl+1), st=p.stats||{};
    const rank=this.rankOf(p,A.user.uid);
    root.innerHTML=`
      <div class="pgrid">
        <section class="pcol">
          <div class="profcard ${BF.cardClasses(p)}">
            <div class="pc-top"><label class="avwrap" title="Change picture">${avatar(p,84)}<input type="file" accept="image/*" id="avIn" hidden><span class="avedit">Edit</span></label>
              <div class="pc-id"><div class="pc-name">${esc(p.name)}</div>${rank?`<span class="rankbadge" style="--rc:${rank.color}">${esc(rank.name)}</span>`:''}
                <select id="titleSel" aria-label="Title">${BF.titlesFor(lvl).concat(BF.earnedTitles?BF.earnedTitles():[]).concat(p.unlocks&&p.unlocks.includes('*')?['Champion','Owner of the Stadium']:[]).map(t=>`<option${t===p.title?' selected':''}>${esc(t)}</option>`).join('')}</select></div></div>
            <div class="lvlrow"><b>LV ${lvl}</b><div class="xpbar"><i style="width:${Math.min(100,(xp-x0)/(x1-x0)*100)}%"></i></div><span class="mono">${xp-x0}/${x1-x0} XP</span></div>
            <div class="pstats">
              <div><b>${st.wins||0}</b><span>Wins</span></div><div><b>${st.losses||0}</b><span>Losses</span></div>
              <div><b>${p.rating||1000}</b><span>Ranked SR</span></div><div><b class="coin">${p.coins||0}</b><span>Coins</span></div></div>
            <div class="fins">${['xtreme','over','burst','spin'].map(k=>`<span>${k} <b>${(st.finishes&&st.finishes[k])||0}</b></span>`).join('')}</div>
            <div class="fl">Banner<div class="cpick">${Object.entries(BF.BANNERS).map(([k,b])=>{ const own=BF.cardOwns('banner',k); return `<button type="button" class="bnmini bn-${k}${((p.card||{}).banner||'stadium')===k?' on':''}${own?'':' locked'}" data-bn="${k}" title="${esc(b.label)}${own?'':b.ach?' — earn it from an achievement':' — '+b.price+' coins'}"></button>`; }).join('')}</div></div>
            <div class="fl">Avatar frame<div class="cpick">${Object.entries(BF.FRAMES).map(([k,f])=>{ const own=BF.cardOwns('frame',k); return `<button type="button" class="frmini fr-${k}${((p.card||{}).frame||'ring')===k?' on':''}${own?'':' locked'}" data-fr="${k}" title="${esc(f.label)}${own?'':f.ach?' — earn it from an achievement':' — '+f.price+' coins'}"><i></i></button>`; }).join('')}</div></div>
            <label class="fl">Showcase Bey<select id="showSel"><option value="">None</option></select></label>
            ${p.showcase&&p.showcase.thumb?`<img class="showimg" src="${p.showcase.thumb}" alt="">`:''}
            <div class="pc-acts"><button class="btn ghost" id="signOut">Sign out</button></div>
          </div>
        </section>
        <section class="pcol">
          <div class="box"><h3>Inbox ${this.inbox.length?`<span class="cnt">${this.inbox.length}</span>`:''}</h3><div id="inboxList"></div></div>
          <div class="box"><h3>Friends</h3>
            <form class="addrow" id="addFriend"><input class="txt sm" id="addName" placeholder="Add by blader name" maxlength="16" autocomplete="off"><button class="btn">Add</button></form>
            <div id="friendList" class="flist"></div></div>
        </section>
        <section class="pcol">
          <div class="box"><h3>Leaderboard</h3><div class="seg sm" id="lbSeg"><button type="button" class="${this.lb!=='rating'?'on':''}" data-lb="wins">Most wins</button><button type="button" class="${this.lb==='rating'?'on':''}" data-lb="rating">Ranked rating</button></div><div id="lbList" class="lb"><span class="netwait">Loading…</span></div></div>
        </section>
      </div>
      ${A.isStaff()?`<div class="box admin" id="adminBox"></div>`:''}`;
    $('#avIn').onchange=async e=>{ const f=e.target.files[0]; if(!f) return; try{ await A.setAvatar(f); BF.App.toast('Picture updated','good'); }catch(err){ BF.App.toast('Couldn’t use that image','bad'); } };
    $('#titleSel').onchange=e=>A.update({title:e.target.value});
    const setCard=(k,v)=>A.update({card:Object.assign({},p.card||{},{[k]:v})});
    root.querySelectorAll('[data-bn]').forEach(b=>b.onclick=()=>{ const k=b.dataset.bn, it=BF.BANNERS[k]; if(BF.cardOwns('banner',k)) return setCard('banner',k); if(it.ach) return BF.App.toast('Earn this banner from an achievement','bad'); BF.Shop.require('banner',k,()=>setCard('banner',k)); });
    root.querySelectorAll('[data-fr]').forEach(b=>b.onclick=()=>{ const k=b.dataset.fr, it=BF.FRAMES[k]; if(BF.cardOwns('frame',k)) return setCard('frame',k); if(it.ach) return BF.App.toast('Earn this frame from an achievement','bad'); BF.Shop.require('frame',k,()=>setCard('frame',k)); });
    $('#signOut').onclick=()=>A.signOut();
    $('#addFriend').onsubmit=e=>{ e.preventDefault(); this.addFriend($('#addName').value); };
    BF.Store.loadLibrary().then(recs=>{ const s=$('#showSel'); if(!s) return; recs.forEach(r=>{ const o=document.createElement('option'); o.value=r.id; o.textContent=r.meta.full; if(p.showcase&&p.showcase.id===r.id) o.selected=true; s.appendChild(o); });
      s.onchange=()=>{ const r=recs.find(x=>x.id===s.value); A.update({showcase:r?{id:r.id,name:r.meta.full,thumb:r.thumb||null}:null}); }; }).catch(()=>{});
    document.querySelectorAll('[data-lb]').forEach(b=>b.onclick=()=>{ this.lb=b.dataset.lb; document.querySelectorAll('[data-lb]').forEach(x=>x.classList.toggle('on',x===b)); this.renderLeaderboard(); });
    this.renderInbox(); this.renderFriends(); this.renderLeaderboard();
    if(A.isStaff()) BF.Admin.render($('#adminBox'));
  },
  rankOf(p,uid){ if(uid&&A.user&&uid===A.user.uid&&A.isOwner) return {name:'Owner',color:'#ffd21f'}; if(p&&p.isOwnerFlag) return {name:'Owner',color:'#ffd21f'}; const r=p&&p.role&&A.roles[p.role]; return r?{name:r.name,color:r.color||'#a07bff'}:null; },
  renderSignIn(root){
    const app=A.inApp();
    root.innerHTML=`<div class="authcard">
      <h2>Become a Blader</h2><p class="dim">An account saves your Beys, records and settings to the cloud — same stuff on your PC and phone — and unlocks friends, chat and battle invites.</p>
      <button class="btn google" id="gBtn"${app?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.8-5.4 3.8-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.4l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z"/></svg>Continue with Google</button>
      ${app?`<div class="fine">Google sign-in needs the website or the BeyForge app — this local copy can’t do it. Use a blader name + password here.</div>`:BF.Native&&BF.Native.isApp()?`<div class="fine">Google opens in your browser, then brings you right back.</div>`:''}
      <div class="or"><span>or</span></div>
      <div class="seg" id="authSeg"><button type="button" class="on" data-m="in">Sign in</button><button type="button" data-m="up">Create account</button></div>
      <form id="authForm" class="authform">
        <label class="fl">Blader name<input class="txt sm" id="aName" maxlength="40" autocomplete="username" placeholder="e.g. aiden_x"></label>
        <label class="fl">Password<input class="txt sm" id="aPass" type="password" autocomplete="current-password" minlength="6"></label>
        <div class="neterr" id="aErr"></div>
        <button class="btn primary wide big" id="aGo">Sign in</button>
      </form></div>`;
    let mode='in';
    root.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{ mode=b.dataset.m; root.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x===b)); $('#aGo').textContent=mode==='in'?'Sign in':'Create account'; $('#aPass').autocomplete=mode==='in'?'current-password':'new-password'; });
    $('#gBtn').onclick=async()=>{ try{ await A.google(); }catch(e){ $('#aErr').textContent=friendly(e); } };
    $('#authForm').onsubmit=async e=>{ e.preventDefault(); const n=$('#aName').value, pw=$('#aPass').value; $('#aErr').textContent=''; $('#aGo').disabled=true;
      try{ mode==='in'?await A.signIn(n,pw):await A.signUp(n,pw); }catch(err){ $('#aErr').textContent=friendly(err); } $('#aGo').disabled=false; };
  },
  renderClaim(root){
    root.innerHTML=`<div class="authcard"><h2>Pick your blader name</h2><p class="dim">This is how friends find you. 3–16 letters, numbers or _.</p>
      <form id="claimForm" class="authform"><input class="txt" id="cName" maxlength="16" autocomplete="off"><div class="neterr" id="cErr"></div><button class="btn primary wide big">Let it rip</button></form>
      <button class="btn ghost" id="cOut">Use a different account</button></div>`;
    $('#claimForm').onsubmit=async e=>{ e.preventDefault(); try{ await A.claimName($('#cName').value); }catch(err){ $('#cErr').textContent=friendly(err); } };
    $('#cOut').onclick=()=>A.signOut();
  },
  renderInbox(){
    const el=$('#inboxList'); if(!el) return;
    if(!this.inbox.length){ el.innerHTML='<div class="fine">Nothing new. Friend requests, battle invites and Beys people send you show up here.</div>'; return; }
    el.innerHTML=this.inbox.map(x=>`<div class="ibx" data-id="${x.id}">
      <div class="ib-t"><b>${esc(x.fromName)}</b> ${x.type==='friend'?'wants to be friends':x.type==='invite'?`invited you to battle · room <span class="mono">${esc(x.code)}</span>`:x.type==='gift'?`sent you <b>${esc(x.meta&&x.meta.full)}</b>`:x.type==='trade'?`wants to trade you <b>${esc(x.meta&&x.meta.full)}</b>`:x.type==='pack'?`sent you a <b>${esc((BF.Packs.get(x.kind)||BF.Packs.get('pack')).name)}</b> 🎁`:x.type==='giftItem'?`gifted you <b>${esc(x.label)}</b> 🎁`:esc(x.text||'')}</div>
      <div class="ib-a">${x.type==='friend'?'<button class="btn primary" data-a="accept">Accept</button>':x.type==='invite'?'<button class="btn primary" data-a="join">Join battle</button>':x.type==='gift'?'<button class="btn primary" data-a="keep">Add to library</button>':x.type==='trade'?'<button class="btn primary" data-a="trade">Pick what to swap</button>':x.type==='pack'?'<button class="btn primary" data-a="pack">Open it</button>':x.type==='giftItem'?'<button class="btn primary" data-a="gitem">Claim</button>':''}<button class="btn ghost" data-a="dismiss">${x.type==='friend'||x.type==='trade'?'Decline':'Dismiss'}</button></div></div>`).join('');
    el.querySelectorAll('.ibx').forEach(row=>{ const x=this.inbox.find(i=>i.id===row.dataset.id);
      row.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{ const a=b.dataset.a; b.disabled=true;
        try{
          if(a==='accept'){ const me=A.profile; await A.ref().collection('friends').doc(x.from).set({name:x.fromName,since:FV().serverTimestamp()}); await A.ref(x.from).collection('friends').doc(A.user.uid).set({name:me.name,since:FV().serverTimestamp()}); BF.App.toast(`You and ${x.fromName} are friends`,'good'); }
          if(a==='join'){ this.joinInvite(x.code); }
          if(a==='pack'){ const s=(await A.ref(x.from).get()).data()||{}; const r=s.role&&A.roles[s.role]; if(!(s.isOwnerFlag||(r&&r.perms&&r.perms.grant))) throw new Error('Only staff can send packs'); const made=await BF.Parts.openPack(x.kind||'pack','gift'); BF.PackOpen.show(made,BF.Packs.get(x.kind||'pack')); }
          if(a==='gitem') await BF.Store6.receive(x);
          if(a==='trade'){ const ok=await BF.Trades.respond(x,true); if(!ok){ b.disabled=false; return; } }
          if(a==='dismiss'&&x.type==='trade') await BF.Trades.respond(x,false);
          if(a==='keep'){ await BF.Store.saveDesign(BF.normalize(x.design),x.meta,x.thumb||null); BF.App.toast(`${x.meta.full} added to your library`,'good'); }
          await A.ref().collection('inbox').doc(x.id).delete();
        }catch(e){ BF.App.toast(friendly(e),'bad'); b.disabled=false; } }); });
  },
  renderFriends(){
    const el=$('#friendList'); if(!el) return; const ids=Object.keys(this.friends);
    if(!ids.length){ el.innerHTML='<div class="fine">No friends yet. Add your boy by his blader name.</div>'; return; }
    ids.sort((a,b)=>(online((this.friendProfiles[b]||{}).lastSeen)?1:0)-(online((this.friendProfiles[a]||{}).lastSeen)?1:0));
    el.innerHTML=ids.map(id=>{ const p=Object.assign({name:this.friends[id].name},this.friendProfiles[id]||{}), on=online(p.lastSeen), rk=this.rankOf(p,id);
      return `<div class="fr" data-id="${id}">${avatar(p,38)}<div class="fr-i"><b>${esc(p.name)}${rk?` <span class="rankbadge sm" style="--rc:${rk.color}">${esc(rk.name)}</span>`:''}</b><span class="${on?'on':''}">${on?'● online':ago(p.lastSeen)} · LV ${p.level||1}</span></div>
        <div class="fr-a"><button class="btn" data-a="chat" title="Chat">Chat</button><button class="btn primary" data-a="invite">Battle</button><button class="btn ghost" data-a="gift" title="Send your Forge Bey">Send Bey</button><button class="btn ghost" data-a="trade" title="Swap Beys">Trade</button><button class="icon-x" data-a="remove" title="Remove friend">×</button></div></div>`; }).join('');
    el.querySelectorAll('.fr').forEach(row=>{ const id=row.dataset.id, name=(this.friendProfiles[id]&&this.friendProfiles[id].name)||this.friends[id].name;
      row.querySelectorAll('[data-a]').forEach(b=>b.onclick=async()=>{ const a=b.dataset.a;
        if(a==='chat') this.openChat(id,name);
        if(a==='invite') this.inviteFriend(id,name);
        if(a==='gift') this.giftBey(id,name);
        if(a==='trade') BF.Trades.offer(id,name);
        if(a==='remove'){ if(!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent='?'; setTimeout(()=>{ b.classList.remove('confirm'); b.textContent='×'; },2500); return; }
          await A.ref().collection('friends').doc(id).delete().catch(()=>{}); await A.ref(id).collection('friends').doc(A.user.uid).delete().catch(()=>{}); } }); });
  },
  async renderLeaderboard(){
    const el=$('#lbList'); if(!el) return;
    try{ const qs=await A.db.collection('users').orderBy(this.lb==='rating'?'rating':'stats.wins','desc').limit(25).get(); const rows=[]; qs.forEach(d=>rows.push(Object.assign({uid:d.id},d.data())));
      el.innerHTML=rows.map((p,i)=>{ const rk=this.rankOf(p,p.uid); return `<div class="lbr${A.user&&p.uid===A.user.uid?' me':''}"><span class="lbn">${i+1}</span>${avatar(p,30)}<div class="lbi"><b>${esc(p.name)}${rk?` <span class="rankbadge sm" style="--rc:${rk.color}">${esc(rk.name)}</span>`:''}</b><span>${esc(p.title||'')} · LV ${p.level||1}</span></div><span class="mono lbw">${this.lb==='rating'?`${p.rating||1000} SR`:`${(p.stats&&p.stats.wins)||0}W ${(p.stats&&p.stats.losses)||0}L`}</span></div>`; }).join('')||'<div class="fine">No bladers yet.</div>';
    }catch(e){ el.innerHTML=`<div class="fine">Leaderboard unavailable (${esc(e.code||e.message)})</div>`; }
  },

  // ---------- actions ----------
  async addFriend(name){
    const lower=A.cleanName(name); if(!lower) return;
    try{ const s=await A.db.collection('usernames').doc(lower).get(); if(!s.exists) throw new Error('No blader named '+name);
      const uid=s.data().uid; if(uid===A.user.uid) throw new Error('That’s you 😅'); if(this.friends[uid]) throw new Error('Already friends');
      await A.ref(uid).collection('inbox').add({type:'friend',from:A.user.uid,fromName:A.profile.name,ts:FV().serverTimestamp()});
      BF.App.toast('Friend request sent to '+name,'good'); $('#addName').value='';
    }catch(e){ BF.App.toast(friendly(e),'bad'); }
  },
  inviteFriend(uid,name){
    const tab=document.querySelector('#tabs [data-tab=battle]'); tab.click();
    const B=BF.BattleUI; B.mode='online';
    const send=({s,info})=>{ if(s==='waiting'&&info){ A.ref(uid).collection('inbox').add({type:'invite',from:A.user.uid,fromName:A.profile.name,code:info,ts:FV().serverTimestamp()}).then(()=>BF.App.toast(`Invite sent to ${name} — room ${info}`,'good')); B._inviteHook=null; } };
    B._inviteHook=send; BF.Net.host(); B.renderSetup();
  },
  joinInvite(code){ document.querySelector('#tabs [data-tab=battle]').click(); const B=BF.BattleUI; B.mode='online'; BF.Net.join(code); B.renderSetup(); },
  async giftBey(uid,name){
    const d=BF.clone(BF.App.d), meta=BF.naming(d,BF.App.an&&BF.App.an.type); const thumb=BF.App.viewer.snapshot(200);
    try{ await A.ref(uid).collection('inbox').add({type:'gift',from:A.user.uid,fromName:A.profile.name,design:d,meta:{name:meta.name,code:meta.code,full:meta.full,type:meta.type,system:d.system},thumb,ts:FV().serverTimestamp()});
      BF.App.toast(`Sent ${meta.full} to ${name}`,'good'); }catch(e){ BF.App.toast(friendly(e),'bad'); }
  },
  // ---------- chat ----------
  chatId(a,b){ return [a,b].sort().join('_'); },
  openChat(uid,name){
    this.closeChat(true); this.chatWith={uid,name}; const box=$('#chatDrawer'); box.hidden=false; $('#chatName').textContent=name;
    const list=$('#chatList'); list.innerHTML='<div class="fine">Loading…</div>';
    this.chatUnsub=A.db.collection('chats').doc(this.chatId(A.user.uid,uid)).collection('messages').orderBy('ts','desc').limit(80).onSnapshot(qs=>{
      const msgs=[]; qs.forEach(d=>msgs.unshift(Object.assign({id:d.id},d.data())));
      list.innerHTML=msgs.length?msgs.map(m=>`<div class="msg${m.from===A.user.uid?' mine':''}"><span>${esc(m.text)}</span><em>${m.ts&&m.ts.toDate?m.ts.toDate().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):''}</em></div>`).join(''):'<div class="fine">Say what’s up 👋</div>';
      list.scrollTop=list.scrollHeight; },e=>{ list.innerHTML=`<div class="neterr">${esc(friendly(e))}</div>`; });
    setTimeout(()=>$('#chatIn').focus(),50);
  },
  closeChat(keep){ if(this.chatUnsub){ this.chatUnsub(); this.chatUnsub=null; } if(!keep){ $('#chatDrawer').hidden=true; this.chatWith=null; } },
  async sendChat(){
    const inp=$('#chatIn'), text=inp.value.trim(); if(!text||!this.chatWith) return; inp.value='';
    try{ await A.db.collection('chats').doc(this.chatId(A.user.uid,this.chatWith.uid)).collection('messages').add({from:A.user.uid,text:text.slice(0,500),ts:FV().serverTimestamp()}); }
    catch(e){ BF.App.toast(friendly(e),'bad'); inp.value=text; }
  }
};

function friendly(e){
  const c=e&&e.code||'';
  const map={'auth/invalid-credential':'Wrong blader name or password','auth/wrong-password':'Wrong blader name or password','auth/user-not-found':'No account with that blader name',
    'auth/invalid-email':'Wrong blader name or password','auth/email-already-in-use':'That blader name is taken','auth/weak-password':'Passwords need at least 6 characters',
    'auth/popup-closed-by-user':'Google sign-in was closed before finishing','auth/popup-blocked':'Your browser blocked the Google popup — allow popups for this site',
    'auth/unauthorized-domain':'Google sign-in isn’t allowed on this address — use the website link','auth/operation-not-supported-in-this-environment':'Google sign-in only works on the website version',
    'auth/network-request-failed':'No internet connection','permission-denied':'You don’t have permission to do that','auth/too-many-requests':'Too many tries — wait a minute and try again','unavailable':'Can’t reach the BeyForge servers — check your internet connection'};
  if(/client is offline/i.test(e&&e.message||'')) return 'Can’t reach the BeyForge servers — check your internet connection';
  return map[c]||e.message||String(e);
}
BF.friendly=friendly;
})();
