/* BeyForge Studio — demo mode (studio/?demo): an in-memory fake Firebase with sample data, for trying Studio safely */
(function(){
'use strict';
const store=new Map(); let seq=0; const listeners=new Set();
const TS=ms=>({_ms:ms,toMillis(){ return this._ms; },toDate(){ return new Date(this._ms); }});
const isTS=v=>v&&typeof v==='object'&&'_ms' in v;
const clone=v=>v==null||typeof v!=='object'?v:isTS(v)?v:Array.isArray(v)?v.map(clone):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)]));
const FV={increment:n=>({__inc:n}),arrayUnion:(...a)=>({__au:a}),arrayRemove:(...a)=>({__ar:a}),serverTimestamp:()=>({__ts:1}),delete:()=>({__del:1})};
function applyVal(cur,v){ if(v&&typeof v==='object'&&!isTS(v)&&!Array.isArray(v)){
    if('__inc' in v) return (+cur||0)+v.__inc; if('__au' in v) return [...(cur||[])].concat(v.__au.filter(x=>!(cur||[]).some(y=>JSON.stringify(y)===JSON.stringify(x))));
    if('__ar' in v) return (cur||[]).filter(y=>!v.__ar.some(x=>JSON.stringify(x)===JSON.stringify(y))); if('__ts' in v) return TS(Date.now()); if('__del' in v) return undefined;
    const o=Object.assign({},cur&&typeof cur==='object'&&!isTS(cur)?cur:{}); Object.entries(v).forEach(([k,x])=>{ const r=applyVal(o[k],x); if(r===undefined) delete o[k]; else o[k]=r; }); return o; }
  return clone(v); }
const fire=()=>listeners.forEach(f=>{ try{ f(); }catch(e){ console.warn(e); } });
const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const cmp=(a,b)=>{ const x=isTS(a)?a._ms:a instanceof Date?a.getTime():a, y=isTS(b)?b._ms:b instanceof Date?b.getTime():b; return x>y?1:x<y?-1:0; };
const ID='__id';
function Snap(path,data){ const id=path.split('/').pop(); return {id,exists:data!==undefined,ref:Doc(path),data:()=>data===undefined?undefined:clone(data)}; }
function Doc(path){ return {id:path.split('/').pop(),path,
  collection:n=>Q(path+'/'+n),
  async get(){ return Snap(path,store.get(path)); },
  async set(d,o){ store.set(path,o&&o.merge?applyVal(store.get(path),d):applyVal(undefined,d)); fire(); },
  async update(d){ if(!store.has(path)) throw new Error('No document to update'); let cur=clone(store.get(path)); Object.entries(d).forEach(([k,v])=>{ const ks=k.split('.'); const nest={}; let t=nest; ks.slice(0,-1).forEach(x=>t=t[x]={}); t[ks[ks.length-1]]=v; cur=applyVal(cur,nest); }); store.set(path,cur); fire(); },
  async delete(){ store.delete(path); fire(); },
  onSnapshot(cb){ const f=()=>cb(Snap(path,store.get(path))); listeners.add(f); f(); return ()=>listeners.delete(f); } }; }
function Q(path,st){ st=st||{w:[],o:[],l:0};
  const run=()=>{ const depth=path.split('/').length+1; let rows=[...store.entries()].filter(([p])=>p.startsWith(path+'/')&&p.split('/').length===depth).map(([p,d])=>({p,d}));
    st.w.forEach(([f,op,v])=>{ rows=rows.filter(r=>{ const x=f===ID?r.p.split('/').pop():get(r.d,f); if(op==='==') return cmp(x,v)===0; if(op==='>=') return x!=null&&cmp(x,v)>=0; if(op==='>') return x!=null&&cmp(x,v)>0; if(op==='<') return x!=null&&cmp(x,v)<0; if(op==='<=') return x!=null&&cmp(x,v)<=0; if(op==='in') return v.includes(x); return true; }); });
    st.o.forEach(([f,dir])=>rows=rows.filter(r=>get(r.d,f)!=null)); if(st.o.length){ const [f,dir]=st.o[0]; rows.sort((a,b)=>cmp(get(a.d,f),get(b.d,f))*(dir==='desc'?-1:1)); }
    if(st.l) rows=rows.slice(0,st.l); const docs=rows.map(r=>Snap(r.p,r.d)); return {size:docs.length,empty:!docs.length,docs,forEach:fn=>docs.forEach(fn)}; };
  return { doc:id=>Doc(path+'/'+(id||('d'+(++seq)+Math.random().toString(36).slice(2,7)))),
    async add(d){ const r=this.doc(); await r.set(d); return r; },
    where:(f,op,v)=>Q(path,{w:st.w.concat([[f&&f.__id?ID:f,op,v]]),o:st.o,l:st.l}), orderBy:(f,dir)=>Q(path,{w:st.w,o:st.o.concat([[f,dir||'asc']]),l:st.l}), limit:n=>Q(path,{w:st.w,o:st.o,l:n}),
    async get(){ return run(); }, onSnapshot(cb){ const f=()=>cb(run()); listeners.add(f); f(); return ()=>listeners.delete(f); } }; }
const db={collection:Q,batch(){ const ops=[]; return {set:(r,d,o)=>ops.push(()=>r.set(d,o)),update:(r,d)=>ops.push(()=>r.update(d)),delete:r=>ops.push(()=>r.delete()),async commit(){ for(const f of ops) await f(); }}; }};
const me={uid:'owner1',email:window.BF_OWNER_EMAIL,emailVerified:true};
const auth={onAuthStateChanged(cb){ setTimeout(()=>cb(me),50); },signOut(){ alert('Demo mode — sign out is disabled'); },signInWithPopup(){},signInWithEmailAndPassword(){}};
firebase.initializeApp=()=>{}; const fs=()=>db; Object.assign(fs,{FieldValue:FV,FieldPath:{documentId:()=>({__id:1})}}); firebase.firestore=fs;
const au=()=>auth; au.GoogleAuthProvider=function(){ this.setCustomParameters=()=>{}; }; au.GoogleAuthProvider.credential=()=>({}); firebase.auth=au;

// ---------- sample data ----------
const R=(a,b)=>a+Math.floor(Math.random()*(b-a+1)), now=Date.now(), day=86400000, put=(p,d)=>store.set(p,d);
put('users/owner1',{name:'Battlebornplayz',nameLower:'battlebornplayz',level:24,xp:52900,coins:18450,gems:340,rating:1420,isOwnerFlag:true,created:TS(now-60*day),lastSeen:TS(now),stats:{matches:310,wins:201,losses:109,finishes:{spin:60,over:52,burst:61,xtreme:28}}});
put('roles/admin',{name:'Admin',color:'#f87171',badge:'ADMIN',showBadge:true,order:1,studio:{overview:'edit',analytics:'edit',players:'edit',give:'edit',moderation:'edit',content:'edit',publish:'edit',switches:'edit',staff:'view',audit:'view'}});
put('roles/mod',{name:'Moderator',color:'#60a5fa',badge:'MOD',showBadge:true,order:2,studio:{overview:'view',players:'view',moderation:'edit',audit:'view'}});
put('roles/creator',{name:'Content Creator',color:'#a78bfa',badge:'CREATOR',showBadge:true,order:3,studio:{overview:'view',content:'edit',analytics:'view'}});
const names=['KaiStorm','ValtWolf','ShuSpriggan','FreeDranzer','AigaZ','LuiShirasagi','HyugaHyuga','RantaroK','BelDaikokuten','PhiDynamite','XanderShakad','DanteKoryu','HikaruAsahi','JoshuaBeyX','MiraSaber','NovaBurst','DrakeRush','ZekeVoid','LunaPegasus','RexStrike','TitanTomo','EmberFang','CobaltDrake','StormSurge'];
names.forEach((n,i)=>{ const w=R(3,180), l=R(2,120), role=i===2?'admin':i===5?'mod':i===9?'creator':null;
  put('users/u'+i,{name:n,nameLower:n.toLowerCase(),level:R(1,30),xp:R(100,60000),coins:R(50,24000),gems:R(0,400),rating:R(880,1460),role,created:TS(now-R(0,50)*day),lastSeen:TS(now-(i<5?R(0,100)*1000:R(10,6000)*60000)),
    banned:i===14,banReason:i===14?'Cheating (impossible IVs)':null,muted:i===17,mutedUntil:i===17?now+5*3600000:null,stats:{matches:w+l,wins:w,losses:l,finishes:{spin:R(0,w),over:R(0,w),burst:R(0,w),xtreme:R(0,w/3|0)}},unlocks:['trail:sparks','card:neon']}); });
const PN=['Arrowhead Blade','Wave Blade','Twin peaks Blade','Fang Layer','9-60 Ratchet','4-80 Ratchet','Star Disc','Rush Bit','Needle Bit','Level Rubber Gear Bit','Ball Driver','Flat Bit'];
for(let d=0;d<30;d++){ const ds=new Date(now-d*day).toISOString().slice(0,10), g=1+(29-d)*0.035, dau=Math.round(R(38,52)*g*(d%7<2?1.25:1)), bt=Math.round(dau*R(5,8)), pk=Math.round(dau*R(1,2));
  const parts={}; PN.forEach((p,i)=>{ const u=R(8,60), wr=i===3?0.68:i===8?0.34:0.45+Math.random()*0.12; parts[p]={u,w:Math.round(u*wr)}; });
  const el={}; ['fire','water','storm','earth','ice','void','light','wind'].forEach((e,i)=>{ const u=R(20,80); el[e]={u,w:Math.round(u*(e==='void'?0.62:0.44+Math.random()*0.1))}; });
  put('stats/'+ds,{dau,signups:Math.round(dau*R(10,22)/100),ret:{d1:R(3,9),d3:R(2,6),d7:R(1,4),d14:R(0,3),d30:R(0,2)},time:{sec:dau*R(900,1600)},platform:{web:Math.round(dau*.45),desktop:Math.round(dau*.2),android:Math.round(dau*.35)},
    battles:{total:bt,cpu:Math.round(bt*.55),online:Math.round(bt*.3),ranked:Math.round(bt*.15),wins:Math.round(bt*.52)},finish:{spin:R(40,90),over:R(30,70),burst:R(40,90),xtreme:R(10,30)},
    packs:{pack:Math.round(pk*.55),elite:Math.round(pk*.2),element:Math.round(pk*.15),mystery:Math.round(pk*.07),crate:Math.round(pk*.03)},rarity:{common:Math.round(pk*1.6),rare:Math.round(pk*0.95),epic:Math.round(pk*0.33),legendary:Math.round(pk*0.07)},shiny:R(0,3),
    eco:{coins:{in:dau*R(160,240),out:dau*R(130,230)},gems:{in:dau*R(2,6),out:dau*R(1,5)}},shop:{c:R(5,20),p:R(10,40),o:R(2,9),b:R(0,4),cur:{coins:R(20,60),gems:R(2,12)}},
    tabs:{home:dau*3,battle:dau*4,forge:dau*2,parts:dau*2,shop:dau,profile:dau},levels:{1:R(5,15),6:R(8,14),11:R(4,10),16:R(2,7),21:R(1,4),26:R(0,2)},cpu:{easy:{w:R(30,40),l:R(3,8)},normal:{w:R(40,60),l:R(20,30)},hard:{w:R(15,25),l:R(20,30)},expert:{w:R(3,8),l:R(20,30)}},
    parts,el,moves:{'Flame Rush':R(30,60),'Tidal Guard':R(20,50),'Thunder Dash':R(25,55),'Stone Wall':R(15,40),'Void Pulse':R(30,70),'Gale Spin':R(10,30)},errors:d===0?3:R(0,2)}); }
put('content/c1',{kind:'pack',key:'inferno_x1',name:'Inferno Pack',status:'live',start:now-3*day,end:now+4*day,rollout:100,version:3,byName:'Battlebornplayz',updated:TS(now-3*day),
  data:{name:'Inferno Pack',desc:'3 fire parts with boosted Epic odds.',model:'pack',colors:['#ff6a1a','#ffd21f'],count:3,slots:'each',odds:{common:45,rare:35,epic:16,legendary:4},shiny:48,pity:25,price:700,gems:0,element:'fire',enabled:true}});
put('content/c2',{kind:'cosmetic',key:'aurora_b2',name:'Aurora Banner',status:'scheduled',start:now+2*day,end:null,rollout:100,version:1,byName:'NovaBurst',updated:TS(now-5*3600000),data:{cat:'banner',name:'Aurora Banner',price:350,c1:'#34d399',c2:'#a78bfa'}});
put('content/c3',{kind:'cosmetic',key:'neon_frame',name:'Plasma Frame',status:'review',rollout:100,version:2,byName:'RantaroK',updated:TS(now-40*60000),req:{mode:'live',rollout:100,note:'Ready for the weekend event',by:'RantaroK'},data:{cat:'frame',name:'Plasma Frame',price:250,c1:'#22d3ee',c2:'#f472b6',glow:16}});
put('content/c4',{kind:'cosmetic',key:'ember_trail',name:'Ember Trail',status:'draft',rollout:100,version:1,byName:'Battlebornplayz',updated:TS(now-2*day),data:{cat:'trail',name:'Ember Trail',price:400,c1:'#ff6a1a',base:'fire'}});
const roll=()=>({atk:R(5,31),def:R(5,31),sta:R(5,31),brs:R(5,31),stb:R(5,31)});
['epic','legendary','rare','common','rare'].forEach((r,i)=>put(`users/u0/parts/p${i}`,{name:PN[i*2],slot:['blade','core','driver'][i%3],rarity:r,shiny:i===1,iv:roll(),xp:R(0,3000),source:['pack','elite','drop','starter','shop'][i],ts:now-R(1,40)*day}));
[['pack',{pack:'elite',parts:[{n:'Wave Blade',r:'epic'},{n:'4-80 Ratchet',r:'rare'},{n:'Rush Bit',r:'legendary',s:true}]}],['buy',{item:'p:elite',cur:'coins'}],['staff',{by:'Battlebornplayz',action:'currency',change:'+500 coins',reason:'Tournament prize'}],['gift',{item:'c:trail:fire'}],['trade',{kind:'offerPart'}]]
  .forEach(([t,d],i)=>put('users/u0/log/l'+i,{type:t,data:d,staff:t==='staff',ts:TS(now-i*3*3600000)}));
[['published','Pack / crate · Inferno Pack',null,{status:'live'},{type:'content',id:'c1'}],['set reward multipliers','game switches',{mult:null},{mult:{coins:2}},{type:'config',doc:'game',merge:true}],['banned','ZekeVoid · Cheating (impossible IVs)',{banned:false},{banned:true},null],['gave','KaiStorm · +500 coins',null,null,null],['scheduled','Cosmetic · Aurora Banner',null,{status:'scheduled'},{type:'content',id:'c2'}]]
  .forEach(([a,t,b,af,u],i)=>put('audit/a'+i,{action:a,target:t,before:b,after:af,undo:u,by:'owner1',byName:i===4?'NovaBurst':'Battlebornplayz',ts:TS(now-i*5*3600000)}));
[['Cannot read properties of undefined (reading \'rarity\')','android'],['WebGL context lost','desktop'],['Cannot read properties of undefined (reading \'rarity\')','web']].forEach(([m,s],i)=>put('errors/e'+i,{msg:m,stack:'at Packs.open (packs.js:52)\nat Store6.buy (store.js:84)',ver:'6.5',shell:s,ua:'Mozilla/5.0',ts:TS(now-i*3600000)}));
put('config/game',{features:{trading:true},mult:{coins:1,xp:1,drops:1}});
put('config/packs',{packs:{}});
window.STUDIO_DEMO=true;
})();
