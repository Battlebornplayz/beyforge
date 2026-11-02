/* BeyForge — storage. Everything lives in a folder you pick once (O:\BeyForge). Falls back to browser storage. */
(function(){
'use strict';
const BF=window.BF;
const IDB='beyforge', STORE='handles';
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open(IDB,1); r.onupgradeneeded=()=>r.result.createObjectStore(STORE); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function idbGet(k){ try{ const db=await idb(); return await new Promise(res=>{ const t=db.transaction(STORE).objectStore(STORE).get(k); t.onsuccess=()=>res(t.result); t.onerror=()=>res(null); }); }catch(e){ return null; } }
async function idbSet(k,v){ try{ const db=await idb(); await new Promise(res=>{ const t=db.transaction(STORE,'readwrite').objectStore(STORE).put(v,k); t.onsuccess=res; t.onerror=res; }); }catch(e){} }
const LS={ get(k,f){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):f; }catch(e){ return f; } }, set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} } };
BF.LS=LS;

BF.Store = {
  handle:null, dir:null, status:'none', // none | needs-permission | connected | unsupported
  listeners:[],
  on(f){ this.listeners.push(f); }, emit(){ this.listeners.forEach(f=>f(this.status)); },
  supported(){ return 'showDirectoryPicker' in window; },
  async init(){
    if(!this.supported()){ this.status='unsupported'; this.emit(); return; }
    const h=await idbGet('root');
    if(h){ this.handle=h; const p=await h.queryPermission({mode:'readwrite'}).catch(()=>'denied'); if(p==='granted'){ this.dir=h; this.status='connected'; } else this.status='needs-permission'; }
    this.emit();
  },
  async connect(){
    if(this.status==='needs-permission' && this.handle){
      const p=await this.handle.requestPermission({mode:'readwrite'}).catch(()=>'denied');
      if(p==='granted'){ this.dir=this.handle; this.status='connected'; this.emit(); await this.ensure(); return true; }
    }
    try{
      const h=await window.showDirectoryPicker({id:'beyforge',mode:'readwrite'});
      this.handle=h; this.dir=h; await idbSet('root',h); this.status='connected'; await this.ensure(); this.emit(); return true;
    }catch(e){ return false; }
  },
  async ensure(){ for(const n of ['designs','exports','cards','data']) await this.dir.getDirectoryHandle(n,{create:true}); },
  async sub(path,create){ const parts=path.split('/'); let h=this.dir; for(let i=0;i<parts.length-1;i++) h=await h.getDirectoryHandle(parts[i],{create:!!create}); return {h, name:parts[parts.length-1]}; },
  async write(path,data){
    if(!this.dir) throw new Error('No folder connected');
    const {h,name}=await this.sub(path,true); const fh=await h.getFileHandle(name,{create:true});
    const w=await fh.createWritable(); await w.write(data); await w.close(); return path;
  },
  async readText(path){ const {h,name}=await this.sub(path,false); const fh=await h.getFileHandle(name); return await (await fh.getFile()).text(); },
  async list(dirName){ const out=[]; try{ const h=await this.dir.getDirectoryHandle(dirName,{create:true}); for await (const [name,e] of h.entries()) if(e.kind==='file') out.push(name); }catch(e){} return out; },
  async remove(path){ const {h,name}=await this.sub(path,false); await h.removeEntry(name); },

  // ---- designs library ----
  slug(s){ return (s||'bey').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'bey'; },
  async saveDesign(d, meta, thumb){
    const rec={ id:d.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6)), saved:new Date().toISOString(), meta, thumb, design:d };
    d.id=rec.id;
    if(this.status==='connected'){ await this.write(`designs/${this.slug(meta.full)}-${rec.id}.bey.json`, JSON.stringify(rec,null,1)); }
    else { const all=LS.get('bf.library',[]); const i=all.findIndex(r=>r.id===rec.id); if(i>=0) all[i]=rec; else all.unshift(rec); LS.set('bf.library',all.slice(0,60)); }
    return rec;
  },
  async loadLibrary(){
    if(this.status==='connected'){
      const names=(await this.list('designs')).filter(n=>n.endsWith('.bey.json')); const recs=[];
      for(const n of names){ try{ const r=JSON.parse(await this.readText('designs/'+n)); r._file=n; recs.push(r); }catch(e){} }
      return recs.sort((a,b)=>(b.saved||'').localeCompare(a.saved||''));
    }
    return LS.get('bf.library',[]);
  },
  async deleteDesign(rec){
    if(this.status==='connected' && rec._file) await this.remove('designs/'+rec._file);
    else LS.set('bf.library',LS.get('bf.library',[]).filter(r=>r.id!==rec.id));
  }
};
})();
