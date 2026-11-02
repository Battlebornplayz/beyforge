/* BeyForge v6.5 — Live: everything published from BeyForge Studio reaches players here, with no code.
   - config/game: maintenance mode, feature toggles, forced shell updates, reward multipliers
   - content/{id}: custom packs, cosmetics and parts (draft / review / scheduled / live, start+end dates, % rollout, testers)
   - BF.Stats: daily analytics counters (stats/{day}) for the Studio dashboards
   - BF.Log: per-player activity log (users/{uid}/log) for the Studio
   - error reporting (errors/) */
(function(){
'use strict';
const BF=window.BF;
BF.VERSION='6.5';
const A=()=>BF.Account, FV=()=>firebase.firestore.FieldValue;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const day=(t)=>new Date(t||Date.now()).toISOString().slice(0,10);
const hash=s=>{ let h=2166136261; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0)%100; };
const safeKey=s=>String(s).replace(/[.~*/\[\]#$]/g,'_').slice(0,60);
const FEATURES={shop:'Shop',packs:'Packs & crates',ranked:'Ranked',online:'Online battles',trading:'Trading',gifting:'Gifting',chat:'Chat',gallery:'Gallery',adventure:'Adventure',raids:'Raids'};
BF.FEATURES=FEATURES;

const L = BF.Live = {
  cfg:{}, items:{}, drafts:{}, parts:[], customCos:{}, _l:false,
  // ---------- listening ----------
  listen(){
    const a=A(); if(this._l||!a||!a.db) return; this._l=true;
    a.db.collection('config').doc('game').onSnapshot(s=>{ this.cfg=s.data()||{}; this.gate(); this.bodyFlags(); },()=>{});
    a.db.collection('content').where('status','in',['live','scheduled']).onSnapshot(qs=>{ this.items={}; qs.forEach(d=>this.items[d.id]=Object.assign({id:d.id},d.data())); this.apply(); },e=>console.warn('content',e));
    setInterval(()=>this.apply(true),60000);   // schedules start/end on their own
  },
  // staff can preview drafts in the real game ("Test in-game" in Studio)
  previewOn(){ return !!BF.LS.get('bf.previewContent',false); },
  listenDrafts(){ const a=A(); if(this._ld||!a||!a.db||!(a.can('createContent')||a.can('publish'))) return; this._ld=true;
    a.db.collection('content').where('status','in',['draft','review']).onSnapshot(qs=>{ this.drafts={}; qs.forEach(d=>this.drafts[d.id]=Object.assign({id:d.id},d.data())); this.apply(); },()=>{}); },
  visible(it){
    const a=A(), uid=a&&a.user&&a.user.uid, now=Date.now();
    if(it.testers&&uid&&it.testers.includes(uid)) return true;
    if(it.status==='draft'||it.status==='review') return this.previewOn();
    if(it.start&&now<it.start) return false; if(it.end&&now>=it.end) return false;
    const r=it.rollout==null?100:it.rollout; if(r<100&&hash((uid||'guest')+it.id)>=r) return false;
    return true;
  },
  active(){ const all=Object.assign({},this.items,this.previewOn()?this.drafts:{}); return Object.values(all).filter(it=>this.visible(it)); },
  apply(tick){
    hook();
    const sig=this.active().map(i=>i.id+':'+(i.version||0)).sort().join('|'); if(tick&&sig===this._sig) return; this._sig=sig;
    const act=this.active();
    // packs
    if(BF.Packs){ BF.Packs.custom={}; act.filter(i=>i.kind==='pack').forEach(i=>{ BF.Packs.custom[i.key||i.id]=Object.assign({},i.data,{liveId:i.id}); }); BF.Packs.emit&&BF.Packs.emit(); }
    // parts that can drop from packs / battles and be sold in the shop
    this.parts=act.filter(i=>i.kind==='part').map(i=>Object.assign({id:i.id},i.data));
    // cosmetics
    this.applyCos(act.filter(i=>i.kind==='cosmetic'));
    BF.Store6&&BF.Store6.render&&BF.Store6.render();
  },
  // ---------- custom cosmetics ----------
  applyCos(list){
    const S=BF.Shop; if(!S) return;
    Object.values(this.customCos).forEach(c=>{ if(S.P[c.cat]) delete S.P[c.cat][c.key]; });   // un-register old ones
    this.customCos={}; let css='';
    list.forEach(i=>{ const d=i.data||{}, cat=d.cat, key=safeKey(i.key||i.id); if(!cat||!S.P[cat]) return;
      S.P[cat][key]=Math.max(0,+d.price||0); this.customCos[cat+':'+key]={cat,key,d};
      if(cat==='banner'){ BF.BANNERS[key]={label:d.name,price:+d.price||0,custom:true};
        css+=`.bn-${key}{background:${d.image?`url(${d.image}) center/cover,`:''}${d.css||`radial-gradient(500px 260px at 75% 0,${d.c2||'#ff2e88'}66,transparent 70%),linear-gradient(135deg,${d.c1||'#2ef2ff'}55,#0b0a16 70%)`}!important}`; }
      if(cat==='frame'){ BF.FRAMES[key]={label:d.name,price:+d.price||0,custom:true};
        css+=`.fr-${key}{background:conic-gradient(from 0deg,${d.c1||'#2ef2ff'},${d.c2||'#ff2e88'},${d.c1||'#2ef2ff'})!important;box-shadow:0 0 ${d.glow||12}px ${d.c1||'#2ef2ff'}!important}`; }
      if(cat==='theme'&&BF.UI_THEMES) BF.UI_THEMES[key]={label:d.name,shop:true,custom:true,base:d.base||'hybrid',colors:[d.c1||'#ffe600',d.c2||'#2ef2ff']};
      if(['trail','aura','launch','win'].includes(cat)&&BF.COSMETICS&&BF.COSMETICS[cat]) BF.COSMETICS[cat][key]=d.name;
    });
    let st=document.getElementById('liveCosCss'); if(!st){ st=document.createElement('style'); st.id='liveCosCss'; document.head.appendChild(st); } st.textContent=css;
  },
  // custom trail/aura/launch/win → the built-in effect it's based on + its colour
  resolveCos(cos){ const o=Object.assign({},cos); ['trail','aura','launch','win'].forEach(cat=>{ const c=this.customCos[cat+':'+o[cat]]; if(c){ o[cat]=c.d.base||'none'; if(cat==='trail'&&c.d.c1) o.trailColor=c.d.c1; if(cat==='aura'&&c.d.c1) o.auraColor=c.d.c1; } }); return o; },
  // ---------- custom parts in drops ----------
  pickPart(rarity,slot,packId){
    const pool=this.parts.filter(p=>p.rarity===rarity&&(!slot||p.slot===slot)&&(!p.packs||!p.packs.length||p.packs.includes(packId||'drop')));
    const w=pool.reduce((s,p)=>s+(+p.dropWeight||0),0); if(!w||Math.random()*100>=Math.min(90,w)) return null;
    let x=Math.random()*w; for(const p of pool){ x-=(+p.dropWeight||0); if(x<0) return p; } return pool[0]||null;
  },
  // ---------- switches ----------
  feature(k){ const f=this.cfg.features||{}; return f[k]!==false; },
  guard(k){ if(this.feature(k)||(A()&&A().isStaff&&A().isStaff())) return true; BF.App&&BF.App.toast(`${FEATURES[k]||k} is turned off right now`,'bad'); return false; },
  mult(k){ const m=this.cfg.mult||{}; if(m.ends&&m.ends<Date.now()) return 1; if(m.starts&&m.starts>Date.now()) return 1; return Math.max(0,+m[k]||1); },
  bodyFlags(){ const b=document.body; if(!b) return; Object.keys(FEATURES).forEach(k=>b.classList.toggle('off-'+k,!this.feature(k)&&!(A()&&A().isStaff&&A().isStaff())));
    const m=this.cfg.mult||{}, on=['coins','xp','drops'].filter(k=>this.mult(k)>1); let bar=document.getElementById('multBar');
    if(on.length){ if(!bar){ bar=document.createElement('div'); bar.id='multBar'; document.body.appendChild(bar); } bar.textContent=`🔥 ${m.label||'Bonus event'}: ${on.map(k=>`${this.mult(k)}× ${k==='xp'?'XP':k}`).join(' · ')}${m.ends?` · ends ${new Date(m.ends).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'})}`:''}`; }
    else if(bar) bar.remove(); },
  shell(){ const q=new URLSearchParams(location.search); return {kind:q.get('shell')||'web', build:+(q.get('build')||'0').split('.').pop()||0}; },
  gate(){
    const a=A(), staff=a&&a.isStaff&&a.isStaff(), m=this.cfg.maintenance||{}, sh=this.shell(), need=(this.cfg.minBuild||{})[sh.kind];
    let msg=null;
    if(m.on&&!staff) msg={t:'Down for maintenance',b:m.msg||'BeyForge is getting upgraded. Back soon!',until:m.until};
    else if(need&&sh.kind!=='web'&&sh.build&&sh.build<need) msg={t:'Update required',b:'A new version of BeyForge is out. Update to keep playing.',link:'https://github.com/Battlebornplayz/beyforge/releases/latest'};
    let ov=document.getElementById('gateOv');
    if(!msg){ if(ov) ov.remove(); return; }
    if(!ov){ ov=document.createElement('div'); ov.id='gateOv'; document.body.appendChild(ov); }
    ov.innerHTML=`<div class="gate-card"><div class="gate-ico">${msg.link?'⬆':'🛠'}</div><h2>${esc(msg.t)}</h2><p>${esc(msg.b)}</p>${msg.until?`<p class="dim">Expected back ${new Date(msg.until).toLocaleString()}</p>`:''}
      ${msg.link?`<a class="btn primary" href="${msg.link}" target="_blank" rel="noopener">Download update</a>`:'<button class="btn ghost" onclick="location.reload()">Try again</button>'}</div>`;
  }
};
BF.feature=k=>L.feature(k);

// ---------- analytics (daily counters, batched) ----------
const Stats = BF.Stats = {
  buf:{}, t0:Date.now(), errs:0,
  add(path,n){ path=String(path).split('.').map(safeKey).join('.'); this.buf[path]=(this.buf[path]||0)+(n==null?1:n); },
  async flush(){
    const a=A(); if(!a||!a.db||!a.user) return; const keys=Object.keys(this.buf); const sec=Math.round((Date.now()-this.t0)/1000); this.t0=Date.now();
    if(!keys.length&&sec<5) return;
    const obj={}; const put=(path,v)=>{ const ks=path.split('.'); let o=obj; ks.slice(0,-1).forEach(k=>o=o[k]=o[k]||{}); o[ks[ks.length-1]]=FV().increment(v); };
    keys.forEach(k=>put(k,this.buf[k])); if(document.visibilityState!=='hidden'||sec<120) put('time.sec',Math.min(sec,300));
    this.buf={}; await a.db.collection('stats').doc(day()).set(obj,{merge:true}).catch(()=>{});
  },
  session(){
    const a=A(), p=a&&a.profile; if(!p) return; const k='bf.statsDay:'+a.user.uid; if(BF.LS.get(k,'')===day()) return; BF.LS.set(k,day());
    this.add('dau'); this.add('platform.'+L.shell().kind);
    const c=p.created&&p.created.toDate?p.created.toDate():null;
    if(c){ const d=Math.floor((Date.now()-c.getTime())/86400000); if(day(c.getTime())===day()) this.add('signups'); [1,3,7,14,30].forEach(n=>{ if(d===n) this.add('ret.d'+n); }); }
    this.add('levels.'+Math.min(100,Math.floor(((p.level||1)-1)/5)*5+1));
  }
};
setInterval(()=>Stats.flush(),60000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') Stats.flush(); });
addEventListener('pagehide',()=>Stats.flush());

// ---------- activity log ----------
BF.Log={ add(type,data){ const a=A(); if(!a||!a.db||!a.user||!a.profile) return; a.ref().collection('log').add({type,data:data||{},ts:FV().serverTimestamp()}).catch(()=>{}); } };

// ---------- errors ----------
function reportErr(msg,stack){ Stats.add('errors'); if(Stats.errs++>=3) return; const a=A(); if(!a||!a.db) return;
  a.db.collection('errors').add({msg:String(msg).slice(0,300),stack:String(stack||'').slice(0,800),ver:BF.VERSION,shell:L.shell().kind,ua:navigator.userAgent.slice(0,160),uid:(a.user&&a.user.uid)||null,ts:FV().serverTimestamp()}).catch(()=>{}); }
addEventListener('error',e=>{ if(!e.message||/ResizeObserver|Script error/.test(e.message)) return; reportErr(e.message,e.error&&e.error.stack); });
addEventListener('unhandledrejection',e=>{ const r=e.reason; if(!r||/firestore|network|offline|permission/i.test(String(r.message||r))) return; reportErr(r.message||String(r),r.stack); });

// ---------- hooks into the rest of the game (wrapped so other files stay simple) ----------
function wrap(obj,name,fn){ if(!obj||!obj[name]||obj[name]._w) return; const orig=obj[name]; obj[name]=function(...args){ return fn.call(this,orig,args); }; obj[name]._w=true; }
function hook(){
  if(BF.Packs){
    wrap(BF.Packs,'open',async function(orig,args){ const [id]=args; const out=await orig.apply(this,args);
      Stats.add('packs.'+id); out.forEach(p=>{ Stats.add('rarity.'+p.rarity); if(p.shiny) Stats.add('shiny'); }); BF.Log.add('pack',{pack:id,parts:out.map(p=>({n:p.name,r:p.rarity,s:!!p.shiny}))}); return out; });
    wrap(BF.Packs,'buy',function(orig,args){ if(!L.guard('packs')) return Promise.reject(new Error('Packs are turned off right now')); return orig.apply(this,args); });
    const all=BF.Packs.all; if(!all._w){ BF.Packs.custom=BF.Packs.custom||{}; BF.Packs.all=function(){ const base=all.call(this); Object.entries(this.custom||{}).forEach(([k,c])=>{ if(!base[k]||base[k].custom) base[k]=Object.assign({custom:true,odds:{common:60,rare:28,epic:10,legendary:2}},c,{id:k},this.over[k]||{}); }); return base; }; BF.Packs.all._w=true; }
  }
  if(BF.Store6){ wrap(BF.Store6,'buy',function(orig,args){ if(!L.guard('shop')) return; const [id,cur]=args; Stats.add('shop.'+id.split(':')[0]); Stats.add('shop.cur.'+cur); BF.Log.add('buy',{item:id,cur}); return orig.apply(this,args); });
    wrap(BF.Store6,'gift',function(orig,args){ if(!L.guard('gifting')) return; BF.Log.add('gift',{item:args[0]}); return orig.apply(this,args); }); }
  if(BF.Trades){ Object.keys(BF.Trades).filter(k=>/^offer/.test(k)&&typeof BF.Trades[k]==='function').forEach(k=>wrap(BF.Trades,k,function(orig,args){ if(!L.guard('trading')) return; BF.Log.add('trade',{kind:k}); return orig.apply(this,args); })); }
  if(BF.Social) wrap(BF.Social,'sendChat',function(orig,args){ const a=A(); if(a&&a.profile&&a.profile.muted&&(!a.profile.mutedUntil||a.profile.mutedUntil>Date.now())){ BF.App.toast('You are muted'+(a.profile.mutedUntil?` until ${new Date(a.profile.mutedUntil).toLocaleString()}`:''),'bad'); return; } if(!L.guard('chat')) return; return orig.apply(this,args); });
  if(BF.Account) wrap(BF.Account,'addMatch',function(orig,args){ const [won,how,online,ranked]=args; Stats.add('battles.total'); Stats.add('battles.'+(ranked?'ranked':online?'online':'cpu')); if(won) Stats.add('battles.wins'); if(how) Stats.add('finish.'+how); return orig.apply(this,args); });
  if(BF.BattleUI) wrap(BF.BattleUI,'matchEnd',function(orig,args){ const r=orig.apply(this,args);
    try{ if(this.mode!=='local'){ const win=this.score[0]>this.score[1]?0:1, me=this.raid?0:this.me, d=me===1?this.match.d2:this.match.d1, won=win===me;
      Stats.add('mode.'+this.mode); if(this.mode==='cpu'||this.mode==='adventure') Stats.add('cpu.'+(this.cpuLv&&this.cpuLv()||'normal')+'.'+(won?'w':'l'));
      if(d&&d.prog&&d.prog.copyIds&&BF.Parts) d.prog.copyIds.forEach(id=>{ const p=BF.Parts.get(id); if(p){ Stats.add('parts.'+p.name+'.u'); if(won) Stats.add('parts.'+p.name+'.w'); } });
      if(d&&BF.elementsOf){ const el=BF.elementsOf(d); [el.p,el.s].filter(Boolean).forEach(e=>{ Stats.add('el.'+e+'.u'); if(won) Stats.add('el.'+e+'.w'); }); }
    } }catch(e){}
    return r; });
  if(BF.Parts&&BF.Parts.create){   // custom Studio parts replace a random roll sometimes
    wrap(BF.Parts,'create',function(orig,args){ let [slot,d,rar,source,extra]=args; const src=String(source||''); if(!(extra&&extra.name)&&!/achievement|starter|shop|gift|test/.test(src)){
        const lp=L.pickPart(rar,slot,src||'drop'); if(lp){ slot=lp.slot; d=BF.normalize(BF.clone(lp.design)); extra=Object.assign({},extra||{},{name:lp.name,liveId:lp.id}); } }
      return orig.call(this,slot,d,rar,source,extra); });
  }
  const tabs=document.getElementById('tabs'); if(tabs&&!tabs._st){ tabs._st=true; tabs.addEventListener('click',e=>{ const b=e.target.closest('[data-tab]'); if(b) Stats.add('tabs.'+b.dataset.tab); }); }
}
// coins/gems earned & spent, from profile changes
let last=null;
BF.Account&&BF.Account.on(a=>{
  L.listen(); L.listenDrafts(); L.gate(); L.bodyFlags(); hook();
  const p=a.profile; if(!p){ last=null; return; } Stats.session();
  if(last&&last.uid===a.user.uid){ ['coins','gems'].forEach(k=>{ const d=(p[k]||0)-(last[k]||0); if(d>0) Stats.add('eco.'+k+'.in',d); if(d<0) Stats.add('eco.'+k+'.out',-d); }); }
  last={uid:a.user.uid,coins:p.coins||0,gems:p.gems||0};
});
addEventListener('load',()=>setTimeout(hook,500));
})();
