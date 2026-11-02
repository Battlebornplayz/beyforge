/* BeyForge Studio — core: auth, permissions, layout, router, UI kit, charts, audit */
(function(){
'use strict';
const BF=window.BF;
const $=(s,r)=>(r||document).querySelector(s), $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const USER_DOMAIN='users.beyforge.app';
const FV=()=>firebase.firestore.FieldValue;

// sections of the Studio → what a rank can be given (none / view / edit)
const SECTIONS=[
  ['overview','Overview','Home dashboard'],
  ['analytics','Analytics','Players, battles, packs, economy, errors'],
  ['players','Players','Look up players, inventories, activity logs'],
  ['give','Give & take','Coins, gems, XP, parts, packs, cosmetics'],
  ['moderation','Moderation','Ban, mute, warn, shadow ban'],
  ['content','Content','Create and edit packs, parts, cosmetics'],
  ['publish','Publishing','Publish live, approve reviews, built-in pack odds'],
  ['switches','Game switches','Maintenance, feature toggles, updates, multipliers'],
  ['staff','Staff & roles','Create ranks and assign staff'],
  ['audit','Audit log','See and undo every change']
];
const PRESETS={
  Admin:{overview:'edit',analytics:'edit',players:'edit',give:'edit',moderation:'edit',content:'edit',publish:'edit',switches:'edit',staff:'view',audit:'view'},
  Moderator:{overview:'view',players:'view',moderation:'edit',audit:'view'},
  'Content Creator':{overview:'view',content:'edit',analytics:'view'},
  Analyst:{overview:'view',analytics:'view',players:'view'},
  Helper:{overview:'view',players:'view'}
};
// a role's Studio sections → the permission flags the game + database rules check
function derivePerms(st,special){ const lv=k=>st[k]||null, v=k=>!!lv(k), e=k=>lv(k)==='edit';
  return {studio:Object.values(st).some(Boolean), grant:e('give'), moderate:e('moderation'), manageRoles:e('staff'), manageGame:e('switches')||e('publish'),
    createContent:e('content'), publish:e('publish'), viewPlayers:v('players')||v('give')||v('moderation'), viewAnalytics:v('analytics')||v('overview'),
    viewAudit:v('audit'), editIV:!!(special&&special.editIV)}; }

const S = window.Studio = {
  SECTIONS, PRESETS, derivePerms, $, $$, esc, FV,
  user:null, profile:null, roles:{}, role:null, isOwner:false, pages:{}, nav:[],
  // ---------- boot ----------
  init(){
    firebase.initializeApp(window.BF_FIREBASE); this.auth=firebase.auth(); this.db=firebase.firestore();
    BF.Account={ db:this.db, user:null, profile:null, can:p=>this.canPerm(p), isStaff:()=>true, on(){}, ref:uid=>this.db.collection('users').doc(uid||this.user.uid), update:o=>this.db.collection('users').doc(this.user.uid).update(o) };
    this.auth.onAuthStateChanged(u=>this.onUser(u));
    window.studioNative&&window.studioNative.onDeepLink(url=>this.deepLink(url));
    addEventListener('hashchange',()=>this.route());
    addEventListener('keydown',e=>{ if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){ e.preventDefault(); this.palette(); } if(e.key==='Escape') this.closeModal(); });
  },
  async onUser(u){
    this.user=u; BF.Account.user=u; (this._un||[]).forEach(f=>f()); this._un=[];
    if(!u) return this.signInScreen();
    this.isOwner=u.email===window.BF_OWNER_EMAIL&&u.emailVerified;
    const ref=this.db.collection('users').doc(u.uid);
    this._un.push(ref.onSnapshot(s=>{ this.profile=s.data()||{}; BF.Account.profile=this.profile; this.loadRole(); },()=>{}));
    this._un.push(this.db.collection('roles').onSnapshot(qs=>{ this.roles={}; qs.forEach(d=>this.roles[d.id]=Object.assign({id:d.id},d.data())); this.loadRole(); },()=>{}));
  },
  loadRole(){ const r=this.profile&&this.profile.role; this.role=(r&&this.roles[r])||null;
    if(!this.profile) return;
    if(!this.isOwner&&!this.canAny()) return this.noAccess();
    if(!this._shell){ this._shell=true; this.shell(); this.route(); } else this.renderNav(); },
  // ---------- permissions ----------
  level(sec){ if(this.isOwner) return 'edit'; const st=this.role&&this.role.studio||{}; return st[sec]||null; },
  can(sec,lv){ const l=this.level(sec); return lv==='edit'?l==='edit':!!l; },
  canAny(){ return this.isOwner||SECTIONS.some(([k])=>this.level(k)); },
  canPerm(p){ if(this.isOwner) return true; const pm=this.role&&this.role.perms||{}; return !!pm[p]; },
  // ---------- sign in ----------
  signInScreen(){ this._shell=false;
    document.body.innerHTML=`<div class="auth"><div class="auth-card"><div class="brand big"><span class="logo">◆</span><b>BeyForge</b> Studio</div>
      <p class="muted">Sign in with your BeyForge account. Only staff can open Studio.</p>
      <button class="btn primary wide" id="gIn"><svg viewBox="0 0 24 24" width="16"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="currentColor" opacity=".7" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/></svg> Continue with Google</button>
      <div class="or"><span>or</span></div>
      <form id="pwIn"><label>Blader name or email<input id="un" autocomplete="username" required></label><label>Password<input id="pw" type="password" autocomplete="current-password" required></label>
      <button class="btn wide">Sign in</button></form><p class="err" id="aerr"></p></div></div>`;
    $('#gIn').onclick=async()=>{ $('#aerr').textContent='';
      if(window.studioNative){ window.studioNative.openExternal('https://battlebornplayz.github.io/beyforge/auth.html?app=studio'); $('#aerr').textContent='Finish signing in with Google in your browser — it will bring you back here.'; return; }
      try{ const p=new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({prompt:'select_account'}); await this.auth.signInWithPopup(p); }catch(e){ $('#aerr').textContent=e.message; } };
    $('#pwIn').onsubmit=async e=>{ e.preventDefault(); $('#aerr').textContent=''; const v=$('#un').value.trim(), email=v.includes('@')?v:`${v.toLowerCase()}@${USER_DOMAIN}`;
      try{ await this.auth.signInWithEmailAndPassword(email,$('#pw').value); }catch(err){ $('#aerr').textContent=/password|credential|user-not-found/.test(err.code||'')?'Wrong name or password':err.message; } };
  },
  deepLink(url){ try{ const u=new URL(url.replace('beyforgestudio://','https://x/')); const t=u.searchParams.get('id_token'); if(t) this.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(t)).catch(e=>this.toast(e.message,'bad')); }catch(e){} },
  noAccess(){ this._shell=false; document.body.innerHTML=`<div class="auth"><div class="auth-card"><div class="brand big"><span class="logo">◆</span><b>BeyForge</b> Studio</div><h3>No Studio access</h3><p class="muted">Signed in as <b>${esc(this.profile.name||this.user.email)}</b>. Ask the owner to give your rank Studio access.</p><button class="btn wide" id="so">Sign out</button></div></div>`; $('#so').onclick=()=>this.auth.signOut(); },
  // ---------- layout ----------
  register(id,o){ this.pages[id]=Object.assign({id},o); },
  shell(){
    document.body.innerHTML=`<div class="app"><aside class="side"><div class="brand"><span class="logo">◆</span><b>BeyForge</b><em>Studio</em></div>
      <div class="proj"><span class="dot live"></span>beyforge · production</div><nav id="nav"></nav>
      <div class="side-foot"><a href="https://battlebornplayz.github.io/beyforge/" target="_blank" rel="noopener" class="navlink ext">↗ Open the game</a></div></aside>
      <div class="main"><header class="top"><button class="iconbtn" id="menuBtn" aria-label="Menu">☰</button><div class="crumbs" id="crumbs"></div>
        <button class="search" id="searchBtn"><span>Search players, content, pages…</span><kbd>Ctrl K</kbd></button>
        <div class="me" id="me"></div></header><main id="view" class="view"></main></div></div>
      <div id="modal" class="modal" hidden></div><div id="toasts"></div>`;
    $('#searchBtn').onclick=()=>this.palette(); $('#menuBtn').onclick=()=>document.body.classList.toggle('nav-open');
    this.renderNav();
  },
  renderNav(){
    const groups={}; Object.values(this.pages).filter(p=>!p.hidden&&(!p.sec||this.can(p.sec))).forEach(p=>(groups[p.group]=groups[p.group]||[]).push(p));
    const order=['','Analytics','Players','Content','Live ops','Team'];
    $('#nav').innerHTML=order.filter(g=>groups[g]).map(g=>`${g?`<div class="navg">${g}</div>`:''}${groups[g].map(p=>`<a class="navlink" href="#/${p.id}" data-p="${p.id}"><span class="ni">${p.icon||'·'}</span>${esc(p.title)}${p.badge?`<i class="nbadge" data-badge="${p.id}"></i>`:''}</a>`).join('')}`).join('');
    const rl=this.role; $('#me').innerHTML=`<div class="avatar">${esc((this.profile.name||'?')[0].toUpperCase())}</div><div><b>${esc(this.profile.name||this.user.email)}</b><span>${this.isOwner?'Owner':esc(rl?rl.name:'')}</span></div><button class="iconbtn" id="soBtn" title="Sign out">⏻</button>`;
    $('#soBtn').onclick=()=>this.confirm({title:'Sign out of Studio?',ok:'Sign out'}).then(ok=>ok&&this.auth.signOut());
    this.markNav(); Object.values(this.pages).forEach(p=>p.badge&&p.badge().then(n=>{ const b=$(`[data-badge="${p.id}"]`); if(b){ b.textContent=n||''; b.hidden=!n; } }).catch(()=>{}));
  },
  markNav(){ const id=(location.hash.slice(2).split('/')[0])||'overview'; $$('.navlink').forEach(a=>a.classList.toggle('on',a.dataset.p===id)); },
  route(){
    if(!this._shell) return; const [id,...args]=(location.hash.slice(2)||'overview').split('/').map(decodeURIComponent);
    const p=this.pages[id]||this.pages.overview; document.body.classList.remove('nav-open');
    if(p.sec&&!this.can(p.sec)){ $('#view').innerHTML=this.empty('🔒','No access','Your rank can’t open this section.'); return; }
    (this._cleanup||[]).forEach(f=>{ try{ f(); }catch(e){} }); this._cleanup=[];
    this.markNav(); $('#crumbs').innerHTML=`${p.group?`<span>${esc(p.group)}</span><i>/</i>`:''}<b>${esc(p.title)}</b>`;
    const v=$('#view'); v.innerHTML='<div class="loading"><i></i>Loading…</div>'; v.scrollTop=0;
    Promise.resolve(p.render(v,args)).catch(e=>{ console.error(e); v.innerHTML=this.empty('⚠','Something went wrong',esc(e.message)); });
  },
  onLeave(f){ this._cleanup.push(f); },
  go(h){ location.hash='#/'+h; },
  // ---------- UI kit ----------
  head(title,sub,actions){ return `<div class="phead"><div><h1>${esc(title)}</h1>${sub?`<p class="muted">${sub}</p>`:''}</div><div class="pacts">${actions||''}</div></div>`; },
  empty(ic,t,b){ return `<div class="empty"><div class="eic">${ic}</div><h3>${esc(t)}</h3><p class="muted">${b||''}</p></div>`; },
  kpi(label,val,sub,tone){ return `<div class="kpi${tone?' '+tone:''}"><span>${esc(label)}</span><b>${val}</b>${sub?`<em>${sub}</em>`:''}</div>`; },
  pill(t,tone){ return `<span class="pill ${tone||''}">${esc(t)}</span>`; },
  ago(ts){ if(!ts) return '—'; const t=ts.toDate?ts.toDate().getTime():+ts, s=(Date.now()-t)/1000; if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago'; if(s<86400) return Math.floor(s/3600)+'h ago'; if(s<86400*30) return Math.floor(s/86400)+'d ago'; return new Date(t).toLocaleDateString(); },
  when(ts){ if(!ts) return '—'; const t=ts.toDate?ts.toDate():new Date(ts); return t.toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}); },
  num(n){ n=+n||0; return Math.abs(n)>=1e6?(n/1e6).toFixed(1)+'M':Math.abs(n)>=1e4?(n/1e3).toFixed(1)+'k':n.toLocaleString(); },
  toast(msg,tone){ const t=document.createElement('div'); t.className='toast '+(tone||''); t.textContent=msg; $('#toasts').appendChild(t); setTimeout(()=>t.classList.add('out'),3200); setTimeout(()=>t.remove(),3700); },
  modal(html,cls){ const m=$('#modal'); m.hidden=false; m.innerHTML=`<div class="mcard ${cls||''}">${html}</div>`; m.onclick=e=>{ if(e.target===m) this.closeModal(); }; return m.firstChild; },
  closeModal(){ const m=$('#modal'); if(m&&!m.hidden){ m.hidden=true; m.innerHTML=''; this._mres&&this._mres(false); this._mres=null; } },
  // type-to-confirm for big actions
  confirm({title,body,ok,danger,typed}){ return new Promise(res=>{ this._mres=res;
    const c=this.modal(`<h3>${esc(title)}</h3>${body?`<p class="muted">${body}</p>`:''}${typed?`<label class="fld"><span>Type <b>${esc(typed)}</b> to confirm</span><input id="cfT" autocomplete="off"></label>`:''}
      <div class="macts"><button class="btn" data-x>Cancel</button><button class="btn ${danger?'danger':'primary'}" id="cfOk"${typed?' disabled':''}>${esc(ok||'Confirm')}</button></div>`);
    if(typed){ const i=$('#cfT',c); i.focus(); i.oninput=()=>$('#cfOk',c).disabled=i.value.trim()!==typed; }
    $('[data-x]',c).onclick=()=>this.closeModal(); $('#cfOk',c).onclick=()=>{ this._mres=null; this.closeModal(); res(true); }; }); },
  prompt({title,label,value,type,ok}){ return new Promise(res=>{ this._mres=()=>res(null);
    const c=this.modal(`<h3>${esc(title)}</h3><label class="fld"><span>${esc(label||'')}</span><input id="prV" type="${type||'text'}" value="${esc(value==null?'':value)}"></label><div class="macts"><button class="btn" data-x>Cancel</button><button class="btn primary" id="prOk">${esc(ok||'OK')}</button></div>`);
    const i=$('#prV',c); i.focus(); i.select(); const done=()=>{ const v=i.value; this._mres=null; this.closeModal(); res(v); };
    i.onkeydown=e=>{ if(e.key==='Enter') done(); }; $('[data-x]',c).onclick=()=>this.closeModal(); $('#prOk',c).onclick=done; }); },
  // sortable table: cols [{k,label,fmt,sort,cls}], rows, onRow
  table(el,cols,rows,o){ o=o||{}; let sk=o.sort||null, sd=-1;
    const draw=()=>{ const rs=rows.slice(); if(sk){ const c=cols.find(c=>c.k===sk), g=c&&c.sort||(r=>r[sk]); rs.sort((a,b)=>{ const x=g(a),y=g(b); return (x>y?1:x<y?-1:0)*sd; }); }
      el.innerHTML=`<div class="tbl-wrap"><table class="tbl"><thead><tr>${cols.map(c=>`<th data-k="${c.k}" class="${c.cls||''}${sk===c.k?' s'+(sd>0?'a':'d'):''}">${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${rs.map((r,i)=>`<tr data-i="${rows.indexOf(r)}"${o.onRow?' class="click"':''}>${cols.map(c=>`<td class="${c.cls||''}">${c.fmt?c.fmt(r):esc(r[c.k])}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${cols.length}" class="muted center">${o.empty||'Nothing here yet'}</td></tr>`}</tbody></table></div>`;
      $$('th',el).forEach(th=>th.onclick=()=>{ const k=th.dataset.k; if(sk===k) sd=-sd; else { sk=k; sd=-1; } draw(); });
      if(o.onRow) $$('tbody tr[data-i]',el).forEach(tr=>tr.onclick=e=>{ if(e.target.closest('button,a,input,select')) return; o.onRow(rows[+tr.dataset.i]); }); };
    draw(); return {redraw:(r)=>{ if(r) rows=r; draw(); }}; },
  // form fields
  f:{
    text:(k,l,v,o)=>`<label class="fld"><span>${esc(l)}</span><input data-f="${k}" value="${esc(v==null?'':v)}"${o&&o.ph?` placeholder="${esc(o.ph)}"`:''}${o&&o.max?` maxlength="${o.max}"`:''}></label>`,
    area:(k,l,v,o)=>`<label class="fld"><span>${esc(l)}</span><textarea data-f="${k}" rows="${(o&&o.rows)||3}"${o&&o.max?` maxlength="${o.max}"`:''}>${esc(v==null?'':v)}</textarea></label>`,
    num:(k,l,v,o)=>`<label class="fld"><span>${esc(l)}</span><input type="number" data-f="${k}" data-num value="${v==null?'':v}"${o&&o.min!=null?` min="${o.min}"`:''}${o&&o.max!=null?` max="${o.max}"`:''}${o&&o.step?` step="${o.step}"`:''}>${o&&o.hint?`<em>${o.hint}</em>`:''}</label>`,
    range:(k,l,v,o)=>`<label class="fld rng"><span>${esc(l)} <b data-rv="${k}">${v}${(o&&o.unit)||''}</b></span><input type="range" data-f="${k}" data-num value="${v}" min="${o.min}" max="${o.max}" step="${o.step||1}" data-unit="${(o&&o.unit)||''}"></label>`,
    color:(k,l,v)=>`<label class="fld clr"><span>${esc(l)}</span><span class="cwrap"><input type="color" data-f="${k}" value="${esc(v||'#2ef2ff')}"><code>${esc(v||'#2ef2ff')}</code></span></label>`,
    sel:(k,l,v,opts)=>`<label class="fld"><span>${esc(l)}</span><select data-f="${k}">${Object.entries(opts).map(([a,b])=>`<option value="${esc(a)}"${String(a)===String(v)?' selected':''}>${esc(b)}</option>`).join('')}</select></label>`,
    tog:(k,l,v,hint)=>`<label class="tog"><input type="checkbox" data-f="${k}" data-bool${v?' checked':''}><i></i><span><b>${esc(l)}</b>${hint?`<em>${hint}</em>`:''}</span></label>`,
    dt:(k,l,v)=>`<label class="fld"><span>${esc(l)}</span><input type="datetime-local" data-f="${k}" data-dt value="${v?new Date(v-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16):''}"></label>`
  },
  // read every [data-f] in el into a (nested by dots) object
  read(el){ const o={}; $$('[data-f]',el).forEach(i=>{ let v=i.type==='checkbox'?i.checked:i.value; if(i.dataset.num!=null) v=i.value===''?null:+i.value; if(i.dataset.dt!=null) v=i.value?new Date(i.value).getTime():null;
      const ks=i.dataset.f.split('.'); let t=o; ks.slice(0,-1).forEach(k=>t=t[k]=t[k]||{}); t[ks[ks.length-1]]=v; }); return o; },
  bindLive(el,cb){ el.addEventListener('input',e=>{ const i=e.target; if(i.type==='range'){ const b=$(`[data-rv="${i.dataset.f}"]`,el); if(b) b.textContent=i.value+(i.dataset.unit||''); } if(i.type==='color'){ const c=i.parentNode.querySelector('code'); if(c) c.textContent=i.value; } cb&&cb(e); }); el.addEventListener('change',e=>cb&&cb(e)); },
  // ---------- charts (SVG, no libraries) ----------
  chart(el,{labels,series,type,h,stack,fmt}){
    h=h||220; const W=Math.max(320,el.clientWidth||640), P={l:44,r:12,t:12,b:26}, iw=W-P.l-P.r, ih=h-P.t-P.b; fmt=fmt||(v=>this.num(v));
    const n=labels.length; let max=0; if(type==='bar'&&stack) labels.forEach((_,i)=>max=Math.max(max,series.reduce((s,se)=>s+(+se.data[i]||0),0))); else series.forEach(s=>s.data.forEach(v=>max=Math.max(max,+v||0)));
    max=max||1; const mag=Math.pow(10,Math.floor(Math.log10(max))), nice=[1,2,2.5,5,10].map(m=>m*mag).find(m=>m*4>=max)||max; max=nice*4;
    const X=i=>P.l+(n<=1?iw/2:i*(iw/(n-1))), Y=v=>P.t+ih-(v/max)*ih;
    let g=''; for(let k=0;k<=4;k++){ const y=P.t+ih-ih*k/4; g+=`<line x1="${P.l}" x2="${W-P.r}" y1="${y}" y2="${y}" class="grid"/><text x="${P.l-8}" y="${y+4}" class="ax" text-anchor="end">${fmt(max*k/4)}</text>`; }
    const step=Math.max(1,Math.ceil(n/8)); labels.forEach((l,i)=>{ if(i%step===0||i===n-1) g+=`<text x="${type==='bar'?P.l+(i+0.5)*(iw/n):X(i)}" y="${h-6}" class="ax" text-anchor="middle">${esc(l)}</text>`; });
    let body='';
    if(type==='bar'){ const bw=iw/n, gw=bw*0.7, sw=stack?gw:gw/series.length;
      labels.forEach((_,i)=>{ let acc=0; series.forEach((s,si)=>{ const v=+s.data[i]||0, x=P.l+i*bw+(bw-gw)/2+(stack?0:si*sw), y=stack?Y(acc+v):Y(v), hh=stack?Y(acc)-Y(acc+v):P.t+ih-Y(v); acc+=v;
        body+=`<rect x="${x}" y="${y}" width="${Math.max(1,sw-1)}" height="${Math.max(0,hh)}" rx="2" fill="${s.color}"><title>${esc(labels[i])} · ${esc(s.name)}: ${fmt(v)}</title></rect>`; }); }); }
    else series.forEach(s=>{ const pts=s.data.map((v,i)=>`${X(i)},${Y(+v||0)}`).join(' ');
      body+=`<polyline points="${P.l},${P.t+ih} ${pts} ${X(n-1)},${P.t+ih}" fill="${s.color}" opacity=".08" stroke="none"/><polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round"/>`;
      s.data.forEach((v,i)=>body+=`<circle cx="${X(i)}" cy="${Y(+v||0)}" r="${n>40?0:2.5}" fill="${s.color}"><title>${esc(labels[i])} · ${esc(s.name)}: ${fmt(v)}</title></circle>`); });
    el.innerHTML=`<svg viewBox="0 0 ${W} ${h}" width="100%" height="${h}" class="chart">${g}${body}</svg>${series.length>1?`<div class="legend">${series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`:''}`;
  },
  // horizontal bar list
  bars(el,rows,o){ o=o||{}; const max=Math.max(1,...rows.map(r=>r.v)); el.innerHTML=rows.length?`<div class="hbars">${rows.map(r=>`<div class="hb"><span class="hbl" title="${esc(r.l)}">${esc(r.l)}</span><span class="hbt"><i style="width:${r.v/max*100}%;${r.c?`background:${r.c}`:''}"></i></span><b>${o.fmt?o.fmt(r.v,r):this.num(r.v)}</b></div>`).join('')}</div>`:`<p class="muted">No data yet.</p>`; },
  // ---------- data helpers ----------
  days(n){ const out=[]; for(let i=n-1;i>=0;i--) out.push(new Date(Date.now()-i*86400000).toISOString().slice(0,10)); return out; },
  async stats(n){ const ds=this.days(n), qs=await this.db.collection('stats').where(firebase.firestore.FieldPath.documentId(),'>=',ds[0]).get(); const m={}; qs.forEach(d=>m[d.id]=d.data()); return ds.map(d=>({day:d,s:m[d]||{}})); },
  get(o,path){ return path.split('.').reduce((a,k)=>a&&a[k],o); },
  sumMaps(list,key){ const out={}; const walk=(o,pre)=>Object.entries(o||{}).forEach(([k,v])=>{ const p=pre?pre+'.'+k:k; if(v&&typeof v==='object') walk(v,p); else out[p]=(out[p]||0)+(+v||0); }); list.forEach(x=>walk(this.get(x.s,key),'')); return out; },
  // ---------- audit ----------
  async audit(action,target,before,after,undo){
    try{ await this.db.collection('audit').add({action,target:target||'',before:before===undefined?null:JSON.parse(JSON.stringify(before||null)),after:after===undefined?null:JSON.parse(JSON.stringify(after||null)),undo:undo||null,by:this.user.uid,byName:this.profile.name||this.user.email,ts:FV().serverTimestamp()}); }catch(e){ console.warn('audit',e); } },
  // ---------- command palette ----------
  palette(){
    const pages=Object.values(this.pages).filter(p=>!p.hidden&&(!p.sec||this.can(p.sec)));
    const c=this.modal(`<input class="pal-in" id="palIn" placeholder="Jump to a page or search a player…" autocomplete="off"><div class="pal-list" id="palList"></div>`,'pal');
    const inp=$('#palIn',c), list=$('#palList',c); let items=[], sel=0;
    const draw=()=>{ list.innerHTML=items.map((it,i)=>`<div class="pal-it${i===sel?' on':''}" data-i="${i}"><span>${it.icon||'·'}</span><b>${esc(it.t)}</b><em>${esc(it.s||'')}</em></div>`).join('')||'<p class="muted pad">No matches</p>';
      $$('.pal-it',list).forEach(x=>x.onclick=()=>pick(items[+x.dataset.i])); };
    const pick=it=>{ if(!it) return; this.closeModal(); it.go(); };
    let tm=null; const search=()=>{ const q=inp.value.trim().toLowerCase(); sel=0;
      items=pages.filter(p=>!q||p.title.toLowerCase().includes(q)||(p.group||'').toLowerCase().includes(q)).map(p=>({t:p.title,s:p.group||'',icon:p.icon,go:()=>this.go(p.id)})); draw();
      clearTimeout(tm); if(q.length>=2&&this.can('players')) tm=setTimeout(async()=>{ const qs=await this.db.collection('users').where('nameLower','>=',q).where('nameLower','<',q+'').limit(6).get().catch(()=>null);
        if(qs&&inp.value.trim().toLowerCase()===q){ qs.forEach(d=>items.push({t:d.data().name,s:'Player · LV '+(d.data().level||1),icon:'👤',go:()=>this.go('player/'+d.id)})); draw(); } },250); };
    inp.oninput=search; inp.onkeydown=e=>{ if(e.key==='ArrowDown'){ sel=Math.min(items.length-1,sel+1); draw(); e.preventDefault(); } if(e.key==='ArrowUp'){ sel=Math.max(0,sel-1); draw(); e.preventDefault(); } if(e.key==='Enter') pick(items[sel]); };
    search(); inp.focus();
  }
};
})();
