/* BeyForge v6 — look & feel engine: themes, accent colors, accessibility, bottom dock, slide transitions,
   per-tab backgrounds, idle particles, punchy UI sounds */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s), root=document.documentElement;

const ICONS={
  home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  forge:'<path d="M14.5 5.5a4 4 0 0 0-5 5L3 17l4 4 6.5-6.5a4 4 0 0 0 5-5l-2.5 2.5-3-1-1-3z"/>',
  battle:'<path d="M4 4l9 9M20 4l-9 9"/><path d="M6 15l3 3M18 15l-3 3M4 20l3-3M20 20l-3-3"/><circle cx="12" cy="13" r="2"/>',
  parts:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  library:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  shop:'<path d="M4 8h16l-1.5 12h-13z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'
};
BF.icon=(k,size)=>`<svg viewBox="0 0 24 24" width="${size||22}" height="${size||22}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]||''}</svg>`;

// accent palettes: [primary, secondary]
const ACCENTS={hybrid:['#ffe600','#2ef2ff','Hybrid'],cyan:['#2ef2ff','#a07bff','Cyan'],yellow:['#ffe600','#ff9500','Volt'],pink:['#ff2e88','#a07bff','Pink'],green:['#3fe08a','#2ef2ff','Toxic'],
  violet:['#a07bff','#ff2e88','Violet'],orange:['#ff7a1a','#ffd21f','Blaze'],red:['#ff3b4f','#ffb020','Crimson'],white:['#f2f4f8','#2ef2ff','Chrome'],bey:[null,null,'My Bey']};
// themes: hybrid is free; others unlock in the Shop (card style unlocks reuse BF.Shop)
const THEMES={hybrid:{label:'Hybrid (X × Neon)'},xtreme:{label:'X-treme',shop:true},neon:{label:'Neon Arena',shop:true},metal:{label:'Metal Saga',shop:true},anime:{label:'Anime Showdown',shop:true},burst:{label:'Burst Sky',shop:true}};
BF.UI_THEMES=THEMES;

const U = BF.UI6 = {
  order:['home','forge','battle','parts','library','shop','profile'],
  themeOpts(){ const o={}; Object.entries(THEMES).forEach(([k,t])=>{ const own=!t.shop||(BF.Shop&&BF.Shop.has('theme',k)); o[k]=t.label+(own?'':' 🔒'); }); return o; },
  accentChips(cur){ return Object.entries(ACCENTS).map(([k,[a,b,l]])=>`<button type="button" class="acc${cur===k?' on':''}" data-accent="${k}" title="${l}" style="--a:${a||'conic-gradient(#ff2e88,#ffe600,#2ef2ff,#a07bff,#ff2e88)'};--b:${b||'#fff'}"><i></i></button>`).join(''); },
  apply(){
    const S=BF.Settings, v=S.v;
    let theme=v.theme; if(THEMES[theme]&&THEMES[theme].shop&&BF.Shop&&!BF.Shop.has('theme',theme)) theme='hybrid';
    root.dataset.theme=theme;
    const TP={hybrid:['#ffe600','#2ef2ff'],xtreme:['#ffe600','#ffffff'],neon:['#2ef2ff','#ff2e88'],metal:['#ff3b4f','#c8ced8'],anime:['#ff3b30','#ffe14d'],burst:['#ff9500','#7fd3ff']};
    let [a,b]=v.accent==='hybrid'?(TP[theme]||TP.hybrid):(ACCENTS[v.accent]||ACCENTS.hybrid);
    if(v.accent==='bey'&&BF.App&&BF.App.d){ const p=BF.App.d.paint||{}; a=(p.blade&&p.blade.color)||'#ffe600'; b=(p.accent&&p.accent.color)||'#2ef2ff'; }
    root.style.setProperty('--accent',a); root.style.setProperty('--accent2',b);
    root.dataset.text=v.textSize||'m'; root.dataset.density=v.density||'balanced';
    root.classList.toggle('reduce-motion',!!v.reduceMotion||matchMedia('(prefers-reduced-motion: reduce)').matches);
    root.classList.toggle('cb',!!v.colorblind); root.classList.toggle('hc',!!v.highContrast); root.classList.toggle('no-idle',v.idleFx===false||!!v.reduceMotion);
  },
  // ---------- dock ----------
  buildDock(){
    const nav=$('#tabs'); nav.classList.add('dock'); document.body.appendChild(nav);   // out of the blurred header so it can sit at the bottom
    nav.querySelectorAll('button').forEach(b=>{ if(b.querySelector('svg')) return; const k=b.dataset.tab, label=b.textContent.trim();
      b.innerHTML=`${BF.icon(k)}<span>${label}</span>`; b.setAttribute('aria-label',label); });
  },
  // ---------- slide transitions + per-tab backgrounds ----------
  onTab(tab){
    const prev=this.cur||'forge'; this.cur=tab; document.body.dataset.tab=tab;
    const v=$('#view-'+tab); if(!v||prev===tab) return;
    const dir=this.order.indexOf(tab)>this.order.indexOf(prev)?'r':'l';
    v.classList.remove('slide-l','slide-r'); void v.offsetWidth; v.classList.add('slide-'+dir);
    BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui('tab');
  },
  // ---------- idle particles behind everything ----------
  particles(){
    const c=document.createElement('canvas'); c.id='fxbg'; c.setAttribute('aria-hidden','true'); document.body.prepend(c);
    const x=c.getContext('2d'); let W=0,H=0, P=[];
    const size=()=>{ W=c.width=innerWidth; H=c.height=innerHeight; P=Array.from({length:Math.round(W*H/26000)},()=>spawn(true)); };
    const spawn=any=>({x:Math.random()*W,y:any?Math.random()*H:H+10,r:0.6+Math.random()*1.8,vy:-(8+Math.random()*22),vx:(Math.random()-0.5)*8,a:0.15+Math.random()*0.45,ph:Math.random()*6.28,c:Math.random()<0.5?1:2});
    size(); addEventListener('resize',size);
    let last=performance.now();
    const tick=now=>{ requestAnimationFrame(tick); const dt=Math.min(0.05,(now-last)/1000); last=now;
      if(root.classList.contains('no-idle')||document.hidden||document.body.classList.contains('po-on')){ if(c._clear!==1){ x.clearRect(0,0,W,H); c._clear=1; } return; } c._clear=0;
      const cs=getComputedStyle(root), c1=cs.getPropertyValue('--accent').trim()||'#ffe600', c2=cs.getPropertyValue('--accent2').trim()||'#2ef2ff';
      x.clearRect(0,0,W,H);
      P.forEach((p,i)=>{ p.x+=p.vx*dt+Math.sin(now/1000+p.ph)*0.15; p.y+=p.vy*dt; if(p.y<-10) P[i]=spawn(false);
        x.globalAlpha=p.a*(0.6+0.4*Math.sin(now/600+p.ph)); x.fillStyle=p.c===1?c1:c2; x.beginPath(); x.arc(p.x,p.y,p.r,0,6.283); x.fill(); });
      x.globalAlpha=1; };
    requestAnimationFrame(tick);
  },
  // ---------- punchy UI sounds + press feedback ----------
  sounds(){
    document.addEventListener('pointerdown',e=>{ const t=e.target.closest('.btn,.chip,.seg button,.mvchip,.shotgrid button,.pcard2,.gym,.bnode,.acc,.tog,.starter,.pickrow,.elchip'); if(t&&!t.disabled) BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui('click'); },true);
    const mo=new MutationObserver(ms=>ms.forEach(m=>{ if(m.attributeName==='hidden'&&m.target.classList.contains('modal')) BF.Sfx&&BF.Sfx.ui&&BF.Sfx.ui(m.target.hidden?'close':'open'); }));
    document.querySelectorAll('.modal').forEach(el=>mo.observe(el,{attributes:true,attributeFilter:['hidden']}));
  },
  init(){
    this.apply(); this.buildDock(); this.particles(); this.sounds();
    document.body.dataset.tab='forge'; this.cur='forge';
    BF.Settings.on(k=>{ if(['theme','accent','textSize','density','reduceMotion','colorblind','highContrast','idleFx','*'].includes(k)) this.apply(); });
    document.querySelectorAll('#tabs button').forEach(b=>b.addEventListener('click',()=>this.onTab(b.dataset.tab)));
  }
};
})();
