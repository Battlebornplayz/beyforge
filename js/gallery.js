/* BeyForge — share codes & links, public gallery, Bey trading */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s), LIVE='https://battlebornplayz.github.io/beyforge/';
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const A=()=>BF.Account;
const FV=()=>firebase.firestore.FieldValue;
// images (drawings, uploaded logos) are too big for codes and gallery docs; everything else travels
function lean(d){ d=BF.clone(d); Object.values(d.paint||{}).forEach(p=>{ p.drawing=null; p.decals=[]; }); delete d.id; return d; }

// ---------- share codes ----------
const b64u={ enc:buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''),
  dec:s=>{ s=s.replace(/-/g,'+').replace(/_/g,'/'); while(s.length%4) s+='='; const b=atob(s); return Uint8Array.from(b,c=>c.charCodeAt(0)); } };
async function pipe(bytes,stream){ return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
BF.Share = {
  async encode(d){ const json=new TextEncoder().encode(JSON.stringify(lean(d))); const z=await pipe(json,new CompressionStream('deflate-raw')); return 'BF1.'+b64u.enc(z); },
  async decode(code){ code=String(code).trim(); const m=code.match(/BF1\.[A-Za-z0-9_-]+/); if(!m) throw new Error('That’s not a BeyForge code'); const raw=await pipe(b64u.dec(m[0].slice(4)),new DecompressionStream('deflate-raw')); return BF.normalize(JSON.parse(new TextDecoder().decode(raw))); },
  async open(d){
    const code=await this.encode(d), link=LIVE+'#bey='+code, nm=BF.naming(d);
    const m=$('#pickModal'), b=$('#pickBody'); m.hidden=false;
    b.innerHTML=`<div class="modal-head"><h3>Share ${esc(nm.full)}</h3><button class="icon-x big" data-x aria-label="Close">×</button></div>
      <label class="fl">Share link — opens this Bey in BeyForge<input class="txt sm" readonly value="${esc(link)}" id="shLink"></label>
      <div class="modal-acts"><button class="btn primary" id="shCopyL">Copy link</button><button class="btn" id="shCopyC">Copy code only</button></div>
      <div class="fine">${code.length.toLocaleString()} characters. Drawings and uploaded images don’t fit in codes — publish to the gallery or send it to a friend to keep those.</div>
      <hr class="hr"><label class="fl">Got a code from someone? Paste it here<textarea class="txt sm area" id="shIn" placeholder="BF1.…"></textarea></label>
      <div class="modal-acts"><button class="btn" id="shLoad">Open in Forge</button></div>`;
    b.querySelector('[data-x]').onclick=()=>m.hidden=true;
    const copy=async t=>{ try{ await navigator.clipboard.writeText(t); BF.App.toast('Copied','good'); }catch(e){ $('#shLink').select(); document.execCommand('copy'); BF.App.toast('Copied','good'); } };
    $('#shCopyL').onclick=()=>copy(link); $('#shCopyC').onclick=()=>copy(code);
    $('#shLoad').onclick=async()=>{ try{ const nd=await this.decode($('#shIn').value); m.hidden=true; this.load(nd); }catch(e){ BF.App.toast(e.message,'bad'); } };
  },
  load(d){ BF.App.push(); BF.App.d=d; BF.syncColors(d); BF.App.viewer.framed=false; BF.App.renderControls(); BF.App.rebuild(); document.querySelector('#tabs [data-tab=forge]').click(); BF.App.toast('Opened '+BF.naming(d).full,'good'); },
  async checkHash(){ const h=location.hash; if(!h.startsWith('#bey=')) return; history.replaceState(null,'',location.pathname+location.search);
    try{ const d=await this.decode(h.slice(5)); const m=$('#pickModal'), b=$('#pickBody'); m.hidden=false;
      b.innerHTML=`<div class="modal-head"><h3>Someone shared a Bey with you</h3><button class="icon-x big" data-x>×</button></div><p><b>${esc(BF.naming(d).full)}</b></p>
        <div class="modal-acts"><button class="btn primary" data-o>Open in Forge</button><button class="btn" data-s>Save to library</button></div>`;
      b.querySelector('[data-x]').onclick=()=>m.hidden=true;
      b.querySelector('[data-o]').onclick=()=>{ m.hidden=true; this.load(d); };
      b.querySelector('[data-s]').onclick=async()=>{ m.hidden=true; const asm=BF.build(d), mp=BF.massProps(asm), an=BF.analyze(asm,mp), nm=BF.naming(d,an.type);
        await BF.Store.saveDesign(d,{name:nm.name,code:nm.code,full:nm.full,type:an.type,system:d.system,mass:+mp.mass.toFixed(1)},null); BF.App.toast(nm.full+' saved to your library','good'); };
    }catch(e){ BF.App.toast('That share link is broken','bad'); } }
};

// ---------- pick one of your saved Beys ----------
BF.pickBey=function(title){
  return new Promise(async res=>{
    const m=$('#pickModal'), b=$('#pickBody'); m.hidden=false; b.innerHTML=`<div class="modal-head"><h3>${esc(title)}</h3><button class="icon-x big" data-x>×</button></div><div class="picklist"><span class="netwait">Loading your library…</span></div>`;
    b.querySelector('[data-x]').onclick=()=>{ m.hidden=true; res(null); };
    const recs=await BF.Store.loadLibrary().catch(()=>[]); const list=b.querySelector('.picklist');
    if(!recs.length){ list.innerHTML='<div class="fine">Your library is empty — save a Bey from the Forge first.</div>'; return; }
    list.innerHTML=recs.map(r=>`<button class="pickrow" data-id="${esc(r.id)}">${r.thumb?`<img src="${r.thumb}" alt="">`:''}<span><b>${esc(r.meta.full)}</b><em>${esc(r.meta.type||'')} · ${r.meta.mass||'?'} g</em></span></button>`).join('');
    list.querySelectorAll('.pickrow').forEach(x=>x.onclick=()=>{ m.hidden=true; res(recs.find(r=>r.id===x.dataset.id)); });
  });
};

// ---------- public gallery ----------
BF.Gallery = {
  sort:'new',
  async publish(rec){
    const a=A(); if(!a||!a.profile) return BF.App.toast('Sign in to publish to the gallery','bad');
    try{ await a.db.collection('gallery').add({author:a.user.uid,authorName:a.profile.name,design:lean(rec.design),meta:rec.meta,thumb:rec.thumb||null,likes:0,downloads:0,ts:FV().serverTimestamp()});
      BF.App.toast(`Published ${rec.meta.full} to the gallery`,'good'); }catch(e){ BF.App.toast(BF.friendly(e),'bad'); }
  },
  async render(root){
    const a=A(); if(!a||!a.profile){ root.innerHTML='<div class="empty"><b>The gallery needs an account</b><span>Sign in on the Blader tab to browse and publish Beys.</span></div>'; return; }
    root.innerHTML='<div class="empty"><span class="netwait">Loading gallery…</span></div>';
    try{
      const qs=await a.db.collection('gallery').orderBy(this.sort==='top'?'likes':'ts','desc').limit(48).get(); const rows=[]; qs.forEach(d=>rows.push(Object.assign({gid:d.id},d.data())));
      const liked=BF.LS.get('bf.liked',[]);
      root.innerHTML=rows.length?'':'<div class="empty"><b>Nothing here yet</b><span>Be the first — hit Publish on any Bey in your library.</span></div>';
      rows.forEach(r=>{ const c=document.createElement('div'); c.className='libcard';
        const mine=r.author===a.user.uid, canDel=mine||a.can('moderate');
        c.innerHTML=`<div class="lib-img">${r.thumb?`<img alt="" src="${r.thumb}">`:''}</div>
          <div class="lib-meta"><span class="lib-type t-${esc(r.meta.type)}">${esc(r.meta.type)}</span><b>${esc(r.meta.name)}</b><span class="mono">${esc(r.meta.code)}</span><span class="dim">by ${esc(r.authorName)} · ♥ ${r.likes||0} · ↓ ${r.downloads||0}</span></div>
          <div class="lib-acts"><button class="btn primary" data-a="get">Get</button><button class="btn${liked.includes(r.gid)?' on':''}" data-a="like">♥ Like</button>${canDel?'<button class="btn ghost" data-a="del">Remove</button>':''}</div>`;
        c.querySelector('[data-a=get]').onclick=async()=>{ try{ await BF.Store.saveDesign(BF.normalize(BF.clone(r.design)),r.meta,r.thumb); a.db.collection('gallery').doc(r.gid).update({downloads:FV().increment(1)}).catch(()=>{}); BF.App.toast(`${r.meta.full} added to your library`,'good'); }catch(e){ BF.App.toast(BF.friendly(e),'bad'); } };
        c.querySelector('[data-a=like]').onclick=e=>{ if(liked.includes(r.gid)) return; liked.push(r.gid); BF.LS.set('bf.liked',liked); e.currentTarget.classList.add('on'); a.db.collection('gallery').doc(r.gid).update({likes:FV().increment(1)}).catch(()=>{}); };
        const del=c.querySelector('[data-a=del]'); if(del) del.onclick=()=>{ if(!del.classList.contains('confirm')){ del.classList.add('confirm'); del.textContent='Tap again'; return; } a.db.collection('gallery').doc(r.gid).delete().then(()=>c.remove()).catch(e=>BF.App.toast(BF.friendly(e),'bad')); };
        root.appendChild(c); });
    }catch(e){ root.innerHTML=`<div class="empty"><b>Gallery unavailable</b><span>${esc(BF.friendly(e))}</span></div>`; }
  }
};

// ---------- trades: swap Beys with a friend (each side gives theirs away) ----------
BF.Trades = {
  async offer(uid,name){
    const a=A(); const rec=await BF.pickBey(`Pick a Bey to offer ${name}`); if(!rec) return;
    try{ const ref=await a.db.collection('trades').add({from:a.user.uid,fromName:a.profile.name,to:uid,toName:name,offer:{id:rec.id,design:lean(rec.design),meta:rec.meta,thumb:rec.thumb||null},status:'open',ts:FV().serverTimestamp()});
      await a.ref(uid).collection('inbox').add({type:'trade',tradeId:ref.id,from:a.user.uid,fromName:a.profile.name,meta:rec.meta,ts:FV().serverTimestamp()});
      BF.App.toast(`Trade offer sent to ${name}`,'good'); }catch(e){ BF.App.toast(BF.friendly(e),'bad'); }
  },
  async respond(inboxItem,accept){
    const a=A(), ref=a.db.collection('trades').doc(inboxItem.tradeId);
    if(!accept){ await ref.update({status:'declined'}).catch(()=>{}); return true; }
    const snap=await ref.get(); const t=snap.data(); if(!t||t.status!=='open') throw new Error('That trade isn’t open anymore');
    const mine=await BF.pickBey(`Pick a Bey to give ${t.fromName} for ${t.offer.meta.full}`); if(!mine) return false;
    await ref.update({status:'accepted',counter:{id:mine.id,design:lean(mine.design),meta:mine.meta,thumb:mine.thumb||null}});
    await BF.Store.saveDesign(BF.normalize(BF.clone(t.offer.design)),t.offer.meta,t.offer.thumb);
    await BF.Store.deleteDesign(mine).catch(()=>{});
    BF.App.toast(`Traded ${mine.meta.full} for ${t.offer.meta.full}`,'good'); return true;
  },
  // the offering side finishes the swap when they come online
  listen(){
    const a=A(); if(!a||!a.profile||this._l===a.user.uid) return; this._l=a.user.uid;
    a.db.collection('trades').where('from','==',a.user.uid).where('status','==','accepted').onSnapshot(async qs=>{
      for(const d of qs.docs){ const t=d.data();
        try{ await BF.Store.saveDesign(BF.normalize(BF.clone(t.counter.design)),t.counter.meta,t.counter.thumb); await BF.Store.deleteDesign({id:t.offer.id}).catch(()=>{});
          await d.ref.update({status:'done'}); BF.App.toast(`${t.toName} took your trade — you got ${t.counter.meta.full}`,'good'); }catch(e){ console.warn(e); } }
    },()=>{});
  }
};
BF.Account&&BF.Account.on(()=>BF.Trades.listen());
})();
