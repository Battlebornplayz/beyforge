/* BeyForge — accounts (Firebase): sign-in, profile, levels, cloud sync, device→account migration */
(function(){
'use strict';
const BF=window.BF;
const USER_DOMAIN='users.beyforge.app';      // username logins map to name@USER_DOMAIN behind the scenes
const TITLES=['Rookie Blader','Spinner','Street Blader','Stadium Regular','Blade Breaker','Xtreme Ace','Burst Hunter','Grand Blader','Legend'];
BF.levelFor=xp=>Math.floor(Math.sqrt((xp||0)/100))+1;
BF.xpForLevel=l=>Math.pow(l-1,2)*100;
BF.titlesFor=lvl=>TITLES.slice(0,Math.min(TITLES.length,1+Math.floor((lvl-1)/2)));

const A = BF.Account = {
  ready:false, user:null, profile:null, isOwner:false, perms:{}, roles:{}, listeners:[], unsub:[],
  on(f){ this.listeners.push(f); }, emit(){ this.listeners.forEach(f=>{ try{ f(this); }catch(e){ console.error(e); } }); },
  available(){ return !!(window.firebase && window.BF_FIREBASE); },
  inApp(){ return location.protocol==='file:' && !(BF.Native&&BF.Native.isApp()); },   // plain local file: no way back from Google
  init(){
    if(!this.available()){ this.ready=true; this.emit(); return; }
    try{ firebase.initializeApp(window.BF_FIREBASE); }catch(e){}
    this.auth=firebase.auth(); this.db=firebase.firestore();
    this.auth.onAuthStateChanged(u=>this.onUser(u));
    BF.Ranked&&BF.Ranked.listen();
    // live announcements for everyone
    this.db.collection('config').doc('announce').onSnapshot(s=>{ const d=s.data(); if(d&&d.text&&d.text!==BF.LS.get('bf.announceSeen','')) BF.App&&BF.App.announce&&BF.App.announce(d.text); },()=>{});
  },
  async onUser(u){
    this.unsub.forEach(f=>f()); this.unsub=[];
    this.user=u; this.profile=null; this.perms={}; this.isOwner=!!(u&&u.email===window.BF_OWNER_EMAIL&&u.emailVerified);
    if(!u){ this.ready=true; this.emit(); return; }
    const ref=this.db.collection('users').doc(u.uid);
    const snap=await ref.get().catch(()=>null);
    if(!snap||!snap.exists){ this.needsName=true; this.ready=true; this.emit(); return; }   // Google user who hasn't picked a blader name yet
    this.needsName=false;
    this.unsub.push(ref.onSnapshot(s=>{ this.profile=s.data(); this.loadPerms(); this.applyCloudSettings(); if(this.isOwner&&this.profile&&!this.profile.isOwnerFlag) ref.update({isOwnerFlag:true}).catch(()=>{}); this.emit(); }));
    this.unsub.push(this.db.collection('roles').onSnapshot(qs=>{ this.roles={}; qs.forEach(d=>this.roles[d.id]=d.data()); this.loadPerms(); this.emit(); },()=>{}));
    this.heartbeat(); this.ready=true;
    await this.migrateDevice();
  },
  loadPerms(){
    const r=this.profile&&this.profile.role, role=r&&this.roles[r];
    this.perms=this.isOwner?{grant:true,moderate:true,manageRoles:true,manageGame:true}:(role&&role.perms)||{};
  },
  can(p){ return this.isOwner||!!this.perms[p]; },
  isStaff(){ return this.isOwner||Object.values(this.perms).some(Boolean); },
  heartbeat(){ const beat=()=>{ if(this.user&&this.profile) this.ref().update({lastSeen:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{}); }; beat(); clearInterval(this._hb); this._hb=setInterval(beat,60000); },
  ref(uid){ return this.db.collection('users').doc(uid||this.user.uid); },

  // ---------- sign in / up ----------
  cleanName(n){ return String(n||'').trim().toLowerCase(); },
  validName(n){ return /^[a-z0-9_]{3,16}$/.test(n); },
  async nameTaken(lower){ const s=await this.db.collection('usernames').doc(lower).get(); return s.exists; },
  async signUp(name,pass){
    const lower=this.cleanName(name);
    if(!this.validName(lower)) throw new Error('Blader names are 3–16 letters, numbers or _');
    if(String(pass).length<6) throw new Error('Passwords need at least 6 characters');
    if(await this.nameTaken(lower)) throw new Error('That blader name is taken');
    const cred=await this.auth.createUserWithEmailAndPassword(`${lower}@${USER_DOMAIN}`,pass);
    await this.createProfile(cred.user,name.trim());
  },
  async signIn(name,pass){
    const v=String(name).trim(); const email=v.includes('@')?v:`${this.cleanName(v)}@${USER_DOMAIN}`;
    await this.auth.signInWithEmailAndPassword(email,pass);
  },
  async google(){
    if(BF.Native&&BF.Native.isApp()) return BF.Native.googleSignIn();   // apps: sign in through the real browser
    const p=new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({prompt:'select_account'});
    await this.auth.signInWithPopup(p);
  },
  withGoogleToken(idToken){ return this.auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(idToken)); },
  async claimName(name){   // Google users pick their blader name once
    const lower=this.cleanName(name);
    if(!this.validName(lower)) throw new Error('Blader names are 3–16 letters, numbers or _');
    if(await this.nameTaken(lower)) throw new Error('That blader name is taken');
    await this.createProfile(this.user,name.trim());
    await this.onUser(this.user);
  },
  async createProfile(u,display){
    const lower=this.cleanName(display);
    await this.db.collection('usernames').doc(lower).set({uid:u.uid});
    const rec=BF.Records.get();
    await this.ref(u.uid).set({ name:display, nameLower:lower, title:'Rookie Blader', avatar:null,
      xp:0, level:1, coins:100, rating:1000, stats:{wins:rec.wins||0,losses:rec.losses||0,matches:rec.matches||0,finishes:rec.finishes||{},online:rec.online||{wins:0,losses:0}},
      badges:[], unlocks:[], showcase:null, settings:BF.Settings.v, myparts:BF.LS.get('bf.myparts',[]).slice(0,40),
      created:firebase.firestore.FieldValue.serverTimestamp(), lastSeen:firebase.firestore.FieldValue.serverTimestamp() });
  },
  signOut(){ clearInterval(this._hb); return this.auth.signOut(); },

  // ---------- profile ----------
  update(data){ if(!this.user) return Promise.resolve(); return this.ref().update(data); },
  async setAvatar(file){ const src=await BF.loadImageFile(file,160); await this.update({avatar:src}); },

  // ---------- progress ----------
  async addMatch(won,how,online,ranked){
    if(!this.profile) return;
    const FV=firebase.firestore.FieldValue, gain=won?(online?80:50):(online?30:20);
    const xp=(this.profile.xp||0)+gain, lvl=BF.levelFor(xp), up={ xp, level:lvl, coins:FV.increment(won?(online?25:15):5),
      'stats.matches':FV.increment(1), ['stats.'+(won?'wins':'losses')]:FV.increment(1) };
    if(won&&how) up['stats.finishes.'+how]=FV.increment(1);
    if(online) up['stats.online.'+(won?'wins':'losses')]=FV.increment(1);
    if(ranked){ const R=BF.Ranked.rules, cur=this.profile.rating||1000; up.rating=Math.max(0,cur+(won?R.winRating:-R.lossRating)); up['stats.ranked.'+(won?'wins':'losses')]=FV.increment(1); }
    await this.update(up).catch(e=>console.warn(e));
    if(lvl>(this.profile.level||1)) BF.App.toast(`Level up! You’re level ${lvl}`,'good');
  },

  // ---------- cloud library ----------
  beys(){ return this.ref().collection('beys'); },
  async saveBey(rec){ const id=rec.id; const doc=Object.assign({},rec,{design:BF.clone(rec.design)}); delete doc._file; await this.beys().doc(id).set(doc); },
  async listBeys(){ const qs=await this.beys().orderBy('saved','desc').limit(200).get(); const out=[]; qs.forEach(d=>out.push(Object.assign({id:d.id},d.data()))); return out; },
  async deleteBey(id){ await this.beys().doc(id).delete(); },

  // ---------- settings follow the account ----------
  applyCloudSettings(){
    const s=this.profile&&this.profile.settings; if(!s||this._settingsApplied===this.user.uid) return;
    this._settingsApplied=this.user.uid; Object.assign(BF.Settings.v,s); BF.LS.set('bf.settings',BF.Settings.v); BF.Settings.listeners.forEach(f=>f('*'));
    if(this.profile.myparts) BF.LS.set('bf.myparts',this.profile.myparts);
  },
  pushSettings(){ clearTimeout(this._st); this._st=setTimeout(()=>{ if(this.profile) this.update({settings:BF.Settings.v}).catch(()=>{}); },1500); },
  pushParts(){ if(this.profile) this.update({myparts:BF.LS.get('bf.myparts',[]).slice(0,40)}).catch(()=>{}); },

  // ---------- move everything from this device onto the account (once per device) ----------
  async migrateDevice(){
    const key='bf.migrated.'+this.user.uid; if(BF.LS.get(key,false)) return;
    try{
      const local=BF.LS.get('bf.library',[]); let folder=[];
      if(BF.Store.status==='connected') folder=await BF.Store.loadFolderLibrary().catch(()=>[]);
      const all=[...local,...folder]; const seen=new Set(); let n=0;
      for(const r of all){ if(!r||!r.id||seen.has(r.id)) continue; seen.add(r.id); await this.saveBey(r).catch(()=>{}); n++; }
      const parts=BF.LS.get('bf.myparts',[]); if(parts.length) await this.update({myparts:parts.slice(0,40)}).catch(()=>{});
      BF.LS.set(key,true);
      if(n) BF.App.toast(`Moved ${n} saved Bey${n>1?'s':''} to your account`,'good');
    }catch(e){ console.warn('migrate',e); }
  }
};

// ---------- route existing features through the account when signed in ----------
const S=BF.Store;
S.loadFolderLibrary=async function(){ const names=(await this.list('designs')).filter(n=>n.endsWith('.bey.json')); const recs=[]; for(const n of names){ try{ const r=JSON.parse(await this.readText('designs/'+n)); r._file=n; recs.push(r); }catch(e){} } return recs; };
const save0=S.saveDesign.bind(S), load0=S.loadLibrary.bind(S), del0=S.deleteDesign.bind(S);
S.saveDesign=async function(d,meta,thumb){
  if(A.profile){ const rec={id:d.id||(Date.now().toString(36)+Math.random().toString(36).slice(2,6)),saved:new Date().toISOString(),meta,thumb,design:d}; d.id=rec.id;
    await A.saveBey(rec); if(this.status==='connected') await save0(d,meta,thumb).catch(()=>{}); return rec; }
  return save0(d,meta,thumb);
};
S.loadLibrary=async function(){ if(A.profile) return A.listBeys(); return load0(); };
S.deleteDesign=async function(rec){ if(A.profile){ await A.deleteBey(rec.id); return; } return del0(rec); };
const add0=BF.Records.add.bind(BF.Records);
BF.Records.add=function(won,how,bey,online,ranked){ const r=add0(won,how,bey,online); A.addMatch(won,how,online,ranked); return r; };
BF.Records.get0=BF.Records.get.bind(BF.Records);
BF.Records.get=function(){ const p=A.profile; if(p&&p.stats) return Object.assign({wins:0,losses:0,matches:0,finishes:{},byBey:{},online:{wins:0,losses:0}},p.stats); return BF.Records.get0(); };
BF.Settings.on(k=>{ if(k!=='*'||!A._settingsApplied) A.pushSettings(); });
})();
