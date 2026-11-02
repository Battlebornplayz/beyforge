/* BeyForge — app shells (Windows .exe / Android APK): Google sign-in hand-off, deep links, update prompts */
(function(){
'use strict';
const BF=window.BF, LIVE='https://battlebornplayz.github.io/beyforge/';
const q=new URLSearchParams(location.search);
if(q.get('shell')) BF.LS.set('bf.shell',{type:q.get('shell'),build:q.get('build')||'0'});
const cap=()=>window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform();
const plug=n=>window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins[n];

BF.Native = {
  shell(){ if(window.beyforgeNative) return 'desktop'; if(cap()) return 'android'; return null; },
  isApp(){ return !!this.shell(); },
  build(){ const s=BF.LS.get('bf.shell',null); return s?s.build:'0'; },
  openExternal(url){
    const s=this.shell();
    if(s==='desktop') return window.beyforgeNative.openExternal(url);
    if(s==='android'&&plug('Browser')) return plug('Browser').open({url});
    window.open(url,'_blank','noopener');
  },
  googleSignIn(){ this.openExternal(LIVE+'auth.html'); BF.App&&BF.App.toast('Finish signing in with Google in your browser — it’ll bring you back here'); },
  handleLink(url){
    try{
      const u=new URL(url.replace('beyforge://','https://x/'));
      if(u.pathname.replace(/\//g,'')==='auth'||u.host==='x'&&url.startsWith('beyforge://auth')){
        const tok=u.searchParams.get('id_token'); if(!tok) return;
        if(plug('Browser')) plug('Browser').close().catch(()=>{});
        BF.Account.withGoogleToken(tok).then(()=>{ BF.App.toast('Signed in with Google','good'); document.querySelector('#tabs [data-tab=profile]').click(); })
          .catch(e=>BF.App.toast(BF.friendly?BF.friendly(e):e.message,'bad'));
      }
    }catch(e){ console.warn('deep link',e); }
  },
  init(){
    const s=this.shell(); if(!s) return;
    document.documentElement.classList.add('app-'+s);
    if(s==='desktop'){
      window.beyforgeNative.onDeepLink(u=>this.handleLink(u));
      window.beyforgeNative.onUpdateReady(v=>BF.App.banner(`BeyForge ${v} is ready.`,'Restart to update',()=>window.beyforgeNative.installUpdate()));
    }
    if(s==='android'){
      const App=plug('App'); if(App){ App.addListener('appUrlOpen',e=>this.handleLink(e.url)); App.getLaunchUrl&&App.getLaunchUrl().then(r=>{ if(r&&r.url) this.handleLink(r.url); }).catch(()=>{}); }
      // native updates are rare (the app loads the live site); only nag when the installed shell is too old
      fetch(LIVE+'version.json',{cache:'no-store'}).then(r=>r.json()).then(v=>{ if(+this.build()<(v.minAndroidBuild||0)) BF.App.banner('A new BeyForge app version is out.','Download',()=>this.openExternal('https://github.com/Battlebornplayz/beyforge/releases/latest/download/BeyForge.apk')); }).catch(()=>{});
    }
  }
};
})();
