/* BeyForge v6.3 — flashy pack opening (TCG-Pocket style)
   1) the 3D pack floats in and glows/shakes harder the better its best pull is
   2) swipe across the tear line (or tap "Open") — it rips with a flash in the rarity colour
   3) cards come out face-down: tap to flip each one (holo tilt, bursts, legendary rays, shiny rainbow)
   4) summary with "Open another" */
(function(){
'use strict';
const BF=window.BF, T=window.THREE;
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ORDER=['common','rare','epic','legendary','limited'];
const R=k=>BF.RARITY[k]||BF.RARITY.common;
const calm=()=>document.documentElement.classList.contains('reduce-motion');
const sfx=(k,a)=>{ try{ BF.Sfx&&(k==='ui'?BF.Sfx.ui&&BF.Sfx.ui(a):BF.Sfx[k]&&BF.Sfx[k](a)); }catch(e){} };

// ---------- 2D particle layer ----------
function Particles(cv){
  const x=cv.getContext('2d'), P=[]; let on=true;
  const fit=()=>{ cv.width=innerWidth*Math.min(2,devicePixelRatio||1); cv.height=innerHeight*Math.min(2,devicePixelRatio||1); };
  fit(); addEventListener('resize',fit);
  const loop=()=>{ if(!on) return; requestAnimationFrame(loop); const k=cv.width/innerWidth; x.setTransform(k,0,0,k,0,0); x.clearRect(0,0,innerWidth,innerHeight);
    x.globalCompositeOperation='lighter';
    for(let i=P.length-1;i>=0;i--){ const p=P[i]; p.t+=1/60; if(p.t>p.life){ P.splice(i,1); continue; }
      p.vx*=0.985; p.vy=p.vy*0.985+p.g; p.x+=p.vx; p.y+=p.vy; const a=1-p.t/p.life;
      if(p.ray){ x.save(); x.translate(p.x,p.y); x.rotate(p.ang+p.t*0.4); const g=x.createLinearGradient(0,0,p.len,0); g.addColorStop(0,p.c); g.addColorStop(1,'transparent'); x.fillStyle=g; x.globalAlpha=a*0.28; x.beginPath(); x.moveTo(0,-p.w); x.lineTo(p.len,0); x.lineTo(0,p.w); x.fill(); x.restore(); continue; }
      x.globalAlpha=a; x.fillStyle=p.rainbow?`hsl(${(p.h+p.t*400)%360},100%,65%)`:p.c; x.beginPath();
      if(p.star){ x.save(); x.translate(p.x,p.y); x.rotate(p.t*6); for(let j=0;j<4;j++){ x.rotate(Math.PI/2); x.moveTo(0,0); x.lineTo(p.s*0.35,p.s*0.35); x.lineTo(0,p.s*1.6); } x.fill(); x.restore(); }
      else { x.arc(p.x,p.y,p.s*a+0.5,0,7); x.fill(); } }
    x.globalAlpha=1; };
  loop();
  return {
    burst(cx,cy,c,n,o){ o=o||{}; for(let i=0;i<n;i++){ const a=Math.random()*7, v=(o.v||7)*(0.35+Math.random());
      P.push({x:cx,y:cy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-(o.up||0),g:o.g==null?0.12:o.g,s:(o.s||3)*(0.5+Math.random()),life:(o.life||1)*(0.6+Math.random()*0.6),t:0,c,star:Math.random()<(o.stars||0.25),rainbow:o.rainbow,h:Math.random()*360}); } },
    rays(cx,cy,c,n){ for(let i=0;i<n;i++) P.push({ray:true,x:cx,y:cy,vx:0,vy:0,g:0,ang:i/n*Math.PI*2,len:Math.max(innerWidth,innerHeight)*0.8,w:28+Math.random()*30,life:1.8,t:0,c}); },
    stop(){ on=false; removeEventListener('resize',fit); }
  };
}

// ---------- 3D pack stage (own loop so we can drive shake / tear) ----------
function PackStage(canvas,pack,best){
  const r=new T.WebGLRenderer({canvas,antialias:true,alpha:true}); r.outputEncoding=T.sRGBEncoding; r.setPixelRatio(Math.min(2,devicePixelRatio||1));
  const M=BF.PackModel, s=M.scene(pack), m=M.build(pack), crate=pack.model==='crate'; s.add(m);
  const rc=new T.Color(R(best).color), glow=new T.PointLight(rc,0,420); glow.position.set(0,0,70); s.add(glow);
  const cam=new T.PerspectiveCamera(32,1,1,1000); cam.position.set(0,0,crate?215:190);
  const st={t:0,charge:0,tear:0,ripped:false,ript:0,on:true,intro:1};
  const lvl=ORDER.indexOf(best);
  let last=performance.now(); const born=last;
  const loop=now=>{ if(!st.on) return; requestAnimationFrame(loop); const dt=Math.max(0,Math.min(0.05,(now-last)/1000)); last=Math.max(last,now); st.t+=dt;
    const w=canvas.clientWidth||320,h=canvas.clientHeight||420; r.setSize(w,h,false); cam.aspect=w/h; cam.updateProjectionMatrix();
    st.intro=Math.min(1,Math.max(0,1-(now-born)/650)); const e=1-Math.pow(st.intro,3);
    const shake=calm()?0:(st.charge*(0.6+lvl*0.5))*(st.ripped?0:1);
    m.position.set((Math.random()-.5)*shake*2.2, Math.sin(st.t*1.7)*3-(1-e)*160, 0);
    m.rotation.set(0.1+Math.sin(st.t*1.3)*0.05+(Math.random()-.5)*shake*0.02, Math.sin(st.t*0.8)*0.45*(1-st.charge)+(1-e)*2.2, (Math.random()-.5)*shake*0.03);
    glow.intensity=st.charge*(1.2+lvl*0.9)+Math.sin(st.t*9)*st.charge*0.4;
    if(m.userData.glow) m.userData.glow.material.emissiveIntensity=1.2+Math.sin(st.t*4)*0.6+st.charge*3;
    if(st.ripped){ st.ript+=dt; const k=Math.min(1,st.ript/0.55); m.scale.setScalar(1+k*0.6); m.position.y+=k*40; m.traverse(o=>{ if(o.material){ o.material.transparent=true; o.material.opacity=1-k; } }); }
    r.render(s,cam); };
  requestAnimationFrame(loop);
  return { st, stop(){ st.on=false; r.dispose(); r.forceContextLoss(); } };
}

// ---------- the overlay ----------
const PO = BF.PackOpen = {
  show(parts,pack){
    if(!parts||!parts.length) return;
    pack=pack||BF.Packs.get('pack'); this.close(true);
    const best=parts.reduce((a,p)=>ORDER.indexOf(p.rarity)>ORDER.indexOf(a)?p.rarity:a,'common');
    const anyShiny=parts.some(p=>p.shiny), crate=pack.model==='crate';
    const ov=document.createElement('div'); ov.id='packOpen'; ov.className=`po r-${best}${anyShiny?' shiny':''}`; ov.style.setProperty('--rc',R(best).color);
    ov.style.setProperty('--c1',(pack.colors&&pack.colors[0])||'#2ef2ff'); ov.style.setProperty('--c2',(pack.colors&&pack.colors[1])||'#ff2e88');
    ov.innerHTML=`<div class="po-bg"></div><canvas class="po-fx"></canvas>
      <div class="po-stage"><div class="po-title"><b>${esc(pack.name||'Pack')}</b><span>${parts.length} ${parts.length===1?'card':'cards'}</span></div>
        <div class="po-pack"><canvas class="po-3d"></canvas><div class="po-tear"><i></i><span>${crate?'Swipe to break the seal':'Swipe to tear'}</span></div></div>
        <div class="po-acts"><button type="button" class="btn primary" data-open>${crate?'Open crate':'Tear open'}</button><button type="button" class="btn ghost" data-skip>Skip</button></div></div>
      <div class="po-cards" hidden></div><div class="po-sum" hidden></div><div class="po-flash"></div>`;
    document.body.appendChild(ov); document.body.classList.add('po-on');
    const fx=Particles(ov.querySelector('.po-fx')), stage=PackStage(ov.querySelector('.po-3d'),pack,best);
    this.cur={ov,fx,stage,parts,pack,best,shown:0};
    sfx('ui','open');
    // build-up: glow charges toward the pull's rarity
    const charge=setInterval(()=>{ if(stage.st.ripped) return clearInterval(charge); stage.st.charge=Math.min(1,stage.st.charge+0.012+ORDER.indexOf(best)*0.004); },50);
    // swipe-to-tear
    const tear=ov.querySelector('.po-tear'), bar=tear.querySelector('i'); let sx=null, maxd=0;
    const prog=v=>{ bar.style.width=(v*100)+'%'; stage.st.charge=Math.max(stage.st.charge,v); };
    const down=e=>{ sx=e.clientX; maxd=0; tear.setPointerCapture&&tear.setPointerCapture(e.pointerId); };
    const move=e=>{ if(sx==null) return; const w=tear.clientWidth||300, d=Math.abs(e.clientX-sx)/(w*0.8); maxd=Math.max(maxd,d); prog(Math.min(1,maxd));
      if(maxd>0.15&&Math.random()<0.35){ const b=tear.getBoundingClientRect(); fx.burst(e.clientX,b.top+b.height/2,R(best).color,2,{v:3,life:0.5,s:2}); }
      if(maxd>=1) rip(); };
    const up=()=>{ if(sx!=null&&maxd<1){ bar.style.transition='width .25s'; prog(0); setTimeout(()=>bar.style.transition='',260); } sx=null; };
    tear.addEventListener('pointerdown',down); tear.addEventListener('pointermove',move); tear.addEventListener('pointerup',up); tear.addEventListener('pointercancel',up);
    const rip=()=>{ if(stage.st.ripped) return; stage.st.ripped=true; clearInterval(charge); prog(1);
      const b=ov.querySelector('.po-pack').getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height*0.4, lv=ORDER.indexOf(best);
      this.flash(R(best).color, lv>=3?0.95:0.6); fx.burst(cx,cy,R(best).color,40+lv*30,{v:9+lv*2,life:1.2,s:3.5,rainbow:anyShiny,up:2});
      if(lv>=3) fx.rays(cx,cy,R(best).color,14); sfx('finish',lv>=3?'xtreme':lv>=2?'burst':'spin'); navigator.vibrate&&navigator.vibrate(lv>=3?[40,30,90]:30);
      setTimeout(()=>this.cards(),650); };
    ov.querySelector('[data-open]').onclick=rip;
    ov.querySelector('[data-skip]').onclick=()=>{ stage.st.ripped=true; clearInterval(charge); this.cards(true); };
    this.cur.rip=rip;
  },
  flash(c,a){ const f=this.cur&&this.cur.ov.querySelector('.po-flash'); if(!f) return; f.style.background=c; f.style.transition='none'; f.style.opacity=a; requestAnimationFrame(()=>{ f.style.transition='opacity .7s ease-out'; f.style.opacity=0; }); },
  cards(skip){
    const C=this.cur; if(!C||C.cardsOn) return; C.cardsOn=true; C.stage.stop();
    const ov=C.ov; ov.querySelector('.po-stage').hidden=true; const box=ov.querySelector('.po-cards'); box.hidden=false;
    // reveal worst → best so the last flip is the big one
    C.order=C.parts.map((p,i)=>i).sort((a,b)=>ORDER.indexOf(C.parts[a].rarity)-ORDER.indexOf(C.parts[b].rarity)||(C.parts[a].shiny?1:0)-(C.parts[b].shiny?1:0));
    box.innerHTML=`<div class="po-hint">${skip?'':'Tap each card to reveal'}</div><div class="po-row">${C.order.map((ix,n)=>{ const p=C.parts[ix], rr=R(p.rarity);
      return `<div class="pc3 r-${p.rarity}${p.shiny?' shiny':''}" style="--rc:${rr.color};--i:${n}" data-n="${n}" tabindex="0" role="button" aria-label="Reveal card ${n+1}">
        <div class="pc3-in"><div class="pc3-back"><span class="pc3-logo">BF</span><i class="pc3-hint">${ORDER.indexOf(p.rarity)>=2?'✦':''}</i></div>
        <div class="pc3-front"><div class="pc3-holo"></div><span class="pc3-r">${rr.label}${p.shiny?' · ✨ SHINY':''}</span><img src="${BF.partIcon(p,150)}" alt="">
          <b>${esc(p.name)}</b><span class="pc3-slot">${esc(BF.PART_LABEL[p.slot]||p.slot)}</span><span class="pc3-iv mono">IV ${Object.values(p.iv||{}).join(' / ')}</span></div></div></div>`; }).join('')}</div>
      <div class="po-acts"><button type="button" class="btn primary" data-all>Reveal all</button></div>`;
    const flip=el=>{ if(el.classList.contains('flip')) return; el.classList.add('flip'); C.shown++;
      const p=C.parts[C.order[+el.dataset.n]], lv=ORDER.indexOf(p.rarity), b=el.getBoundingClientRect(), cx=b.left+b.width/2, cy=b.top+b.height/2;
      C.fx.burst(cx,cy,R(p.rarity).color,10+lv*18,{v:4+lv*2,life:0.8+lv*0.15,s:2.5,rainbow:p.shiny,stars:0.4});
      if(lv>=3){ this.flash(R(p.rarity).color,0.55); C.fx.rays(cx,cy,R(p.rarity).color,10); el.classList.add('big'); navigator.vibrate&&navigator.vibrate([30,20,60]); }
      if(p.shiny) C.fx.burst(cx,cy,'#fff',30,{v:7,rainbow:true,stars:0.6});
      sfx('ui',lv>=3?'legend':lv>=2?'epic':'flip');
      if(C.shown>=C.parts.length) setTimeout(()=>this.summary(),lv>=3?1500:900); };
    box.querySelectorAll('.pc3').forEach(el=>{
      el.onclick=()=>flip(el); el.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); flip(el); } };
      el.onpointermove=e=>{ const r=el.getBoundingClientRect(), px=(e.clientX-r.left)/r.width, py=(e.clientY-r.top)/r.height;
        el.style.setProperty('--rx',((py-.5)*-16)+'deg'); el.style.setProperty('--ry',((px-.5)*20)+'deg'); el.style.setProperty('--mx',(px*100)+'%'); el.style.setProperty('--my',(py*100)+'%'); };
      el.onpointerleave=()=>{ el.style.setProperty('--rx','0deg'); el.style.setProperty('--ry','0deg'); }; });
    box.querySelector('[data-all]').onclick=()=>{ [...box.querySelectorAll('.pc3:not(.flip)')].forEach((el,i)=>setTimeout(()=>flip(el),i*260)); };
    if(skip) box.querySelector('[data-all]').click();
  },
  summary(){
    const C=this.cur; if(!C||C.sumOn) return; C.sumOn=true; const ov=C.ov, pk=C.pack, canAgain=pk.id&&BF.Packs.get(pk.id);
    const box=ov.querySelector('.po-sum'); ov.querySelector('.po-cards').hidden=true; box.hidden=false;
    const counts={}; C.parts.forEach(p=>counts[p.rarity]=(counts[p.rarity]||0)+1);
    box.innerHTML=`<h3>${esc(pk.name||'Pack')} opened</h3><div class="po-cnt">${ORDER.filter(k=>counts[k]).map(k=>`<span style="--rc:${R(k).color}">${counts[k]}× ${R(k).label}</span>`).join('')}${C.parts.some(p=>p.shiny)?'<span class="sh">✨ Shiny!</span>':''}</div>
      <div class="po-grid">${C.parts.map(p=>`<div class="po-mini r-${p.rarity}${p.shiny?' shiny':''}" style="--rc:${R(p.rarity).color}"><img src="${BF.partIcon(p,90)}" alt=""><b>${esc(p.name)}</b></div>`).join('')}</div>
      <div class="po-acts">${canAgain?`<button type="button" class="btn primary" data-again><span class="coin">${BF.Store6?BF.Store6.adjust('p:'+pk.id,BF.Packs.price(pk)):BF.Packs.price(pk)}</span> Open another</button>`:''}<button type="button" class="btn${canAgain?' ghost':' primary'}" data-parts>See my parts</button><button type="button" class="btn ghost" data-done>Done</button></div>`;
    box.querySelector('[data-done]').onclick=()=>this.close();
    box.querySelector('[data-parts]').onclick=()=>{ this.close(); const tb=document.querySelector('#tabs [data-tab=parts]'); tb&&tb.click(); };
    const ag=box.querySelector('[data-again]'); if(ag) ag.onclick=()=>{ const id=pk.id; this.close(); BF.Store6?BF.Store6.buy('p:'+id,'coins'):BF.PartsUI.buyPack(id); };
  },
  close(silent){ const C=this.cur; if(!C) return; this.cur=null; try{ C.stage.stop(); }catch(e){} C.fx.stop(); C.ov.remove(); document.body.classList.remove('po-on');
    if(!silent){ BF.PartsUI&&!document.getElementById('view-parts').hidden&&BF.PartsUI.render(); BF.Store6&&BF.Store6.render(); } }
};
addEventListener('keydown',e=>{ if(e.key==='Escape'&&PO.cur&&PO.cur.sumOn) PO.close(); });
})();
