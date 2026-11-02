/* BeyForge — guided tour: spotlight + tooltip walk-through, auto on first launch */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const tab=t=>{ const b=document.querySelector(`#tabs [data-tab=${t}]`); if(b&&!b.classList.contains('on')) b.click(); };
const STEPS=[
  {title:'Welcome to BeyForge',text:'Design your own Beys and battle your friends online. This takes about a minute — hit Next.'},
  {tab:'forge',sel:'#viewport',title:'Your Bey, live in 3D',text:'Drag to spin the camera, scroll or pinch to zoom. Tap a part to jump straight to its settings. The toolbar shows exploded view, a cut-in-half section and a stadium preview.'},
  {tab:'forge',sel:'#controls',title:'Build it your way',text:'Easy mode gives you picture grids and themes. Switch to Pro for every slider, sculpting, per-wing shapes, cutouts and the full paint studio.'},
  {tab:'forge',sel:'#sheet',title:'Stats and sharing',text:'Here are the weight, type and stats. Save it to your library, make a trading card or share a code.'},
  {tab:'battle',sel:'#tabs [data-tab=battle]',title:'Battle',text:'Aim your launch, pick a shot and a move from each part (your launch formation), then tap moves and tap the stadium to lean mid-fight. Fight the CPU (Easy to Expert), a friend on one screen, or online with a 4-letter code.'},
  {tab:'library',sel:'#libSeg',title:'Library and Gallery',text:'Your saved Beys live here. Flip to Gallery to grab Beys other players published, or paste a share code someone sent you.'},
  {tab:'parts',sel:'#tabs [data-tab=parts]',title:'Parts',text:'Own parts to battle online: grab your free starter, open packs, mint parts from the Forge, level them up, spend EVs and build ⚔ Battle Beys. Every copy has its own locked IVs — hunt for shinies and legendaries.'},
  {tab:'battle',sel:'#tabs [data-tab=battle]',title:'Adventure',text:'In Battle → Adventure: climb the 30-floor Tower, beat the 10 element gyms for badges, take on the weekly boss, and team up with a friend in co-op raids. Achievements unlock Limited parts.'},
  {tab:'shop',sel:'#tabs [data-tab=shop]',title:'Shop',text:'Win battles to earn coins (plus a daily bonus), then unlock finishes, patterns, stickers, spin trails, auras, win animations and card styles.'},
  {tab:'profile',sel:'#tabs [data-tab=profile]',title:'Your Blader profile',text:'Sign in with Google or a username to save everything to your account. Add friends, chat, send invites, gift Beys and trade.'},
  {sel:'#settingsBtn',title:'Settings',text:'Every option lives here: round length, battle format, graphics quality, effects and sound. You can restart this tour from here too.'},
  {tab:'forge',title:'Let it rip!',text:'That’s the tour. Hit Random in the Forge if you want a quick place to start.'}
];
BF.Tour = {
  i:0,
  auto(){ if(BF.Settings&&BF.Settings.get&&BF.Settings.get('tour')===false) return; if(BF.LS.get('bf.toured',false)) return; const go=()=>{ if(document.querySelector('.modal:not([hidden])')) return setTimeout(go,1500); this.start(); }; setTimeout(go,900); },
  start(){ this.i=0; this.build(); this.show(); },
  build(){
    if(this.el) return;
    const el=document.createElement('div'); el.className='tour'; el.innerHTML=`<div class="tour-hole"></div><div class="tour-tip" role="dialog" aria-live="polite"><div class="tour-n mono"></div><h3></h3><p></p>
      <div class="tour-acts"><button class="btn ghost" data-t="skip">Skip</button><span></span><button class="btn" data-t="back">Back</button><button class="btn primary" data-t="next">Next</button></div></div>`;
    document.body.appendChild(el); this.el=el;
    el.querySelector('[data-t=skip]').onclick=()=>this.end();
    el.querySelector('[data-t=back]').onclick=()=>{ if(this.i>0){ this.i--; this.show(); } };
    el.querySelector('[data-t=next]').onclick=()=>{ if(this.i<STEPS.length-1){ this.i++; this.show(); } else this.end(); };
    document.addEventListener('keydown',e=>{ if(!this.el||this.el.hidden) return; if(e.key==='Escape') this.end(); if(e.key==='ArrowRight'||e.key==='Enter'){ e.preventDefault(); el.querySelector('[data-t=next]').click(); } if(e.key==='ArrowLeft') el.querySelector('[data-t=back]').click(); });
    window.addEventListener('resize',()=>{ if(!this.el.hidden) this.place(); });
  },
  show(){
    const s=STEPS[this.i]; this.el.hidden=false; if(s.tab) tab(s.tab);
    this.el.querySelector('.tour-n').textContent=`${this.i+1} / ${STEPS.length}`;
    this.el.querySelector('h3').textContent=s.title; this.el.querySelector('p').textContent=s.text;
    this.el.querySelector('[data-t=back]').disabled=this.i===0;
    this.el.querySelector('[data-t=next]').textContent=this.i===STEPS.length-1?'Done':'Next';
    requestAnimationFrame(()=>this.place());
  },
  place(){
    const s=STEPS[this.i], hole=this.el.querySelector('.tour-hole'), tip=this.el.querySelector('.tour-tip');
    const t=s.sel&&$(s.sel), r=t&&t.offsetParent!==null?t.getBoundingClientRect():null;
    const vw=innerWidth, vh=innerHeight;
    if(!r){ hole.style.cssText=`left:${vw/2}px;top:${vh/2}px;width:0;height:0`; tip.style.left=Math.max(12,(vw-tip.offsetWidth)/2)+'px'; tip.style.top=Math.max(12,(vh-tip.offsetHeight)/2)+'px'; return; }
    const p=8; hole.style.cssText=`left:${r.left-p}px;top:${r.top-p}px;width:${r.width+p*2}px;height:${r.height+p*2}px`;
    const tw=tip.offsetWidth, th=tip.offsetHeight; let x, y;
    if(r.bottom+th+20<vh){ y=r.bottom+16; x=r.left+r.width/2-tw/2; }       // below
    else if(r.top-th-20>0){ y=r.top-th-16; x=r.left+r.width/2-tw/2; }       // above
    else if(r.right+tw+20<vw){ x=r.right+16; y=r.top+r.height/2-th/2; }     // right
    else if(r.left-tw-20>0){ x=r.left-tw-16; y=r.top+r.height/2-th/2; }     // left
    else { x=(vw-tw)/2; y=vh-th-16; }                                        // big target: dock at bottom
    tip.style.left=Math.min(vw-tw-12,Math.max(12,x))+'px'; tip.style.top=Math.min(vh-th-12,Math.max(12,y))+'px';
  },
  end(){ if(this.el) this.el.hidden=true; BF.LS.set('bf.toured',true); tab('forge'); }
};
})();
