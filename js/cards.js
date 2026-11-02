/* BeyForge — Bey cards (trading-card PNGs with styles, rarity, record, holo) + 3D showcase mode */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s), TAU=Math.PI*2;
const RARITY=[[50,'MYTHIC','#ff2e88'],[25,'LEGENDARY','#ffb020'],[10,'EPIC','#a07bff'],[3,'RARE','#2ef2ff'],[0,'COMMON','#9aa3b5']];
const rarityOf=w=>RARITY.find(r=>w>=r[0]);
const TYPECOL={attack:'#ff2e88',defense:'#ffb020',stamina:'#2ef2ff',balance:'#a07bff'};
function loadImg(src){ return new Promise(r=>{ if(!src) return r(null); const i=new Image(); i.onload=()=>r(i); i.onerror=()=>r(null); i.src=src; }); }
function rr(x,X,Y,W,H,R){ x.beginPath(); x.moveTo(X+R,Y); x.arcTo(X+W,Y,X+W,Y+H,R); x.arcTo(X+W,Y+H,X,Y+H,R); x.arcTo(X,Y+H,X,Y,R); x.arcTo(X,Y,X+W,Y,R); x.closePath(); }

BF.Card = {
  style: BF.LS.get('bf.cardStyle','standard'),
  async draw(info){ // info: {d, name, code, type, system, stats, mass, diam, wins, losses, owner, img}
    const W=750, H=1050, c=document.createElement('canvas'); c.width=W; c.height=H; const x=c.getContext('2d'); const st=this.style;
    const tc=TYPECOL[info.type]||'#2ef2ff', rar=rarityOf(info.wins||0);
    // frame
    const frame={standard:['#1c1836','#0d0b1a',tc],neon:['#120a24','#05040c','#2ef2ff'],gold:['#3b2a0c','#120c04','#ffd36a'],holo:['#1d1846','#0d0b1a','#ffffff'],darkmatter:['#0a0614','#000000','#a07bff']}[st]||['#1c1836','#0d0b1a',tc];
    const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,frame[0]); g.addColorStop(1,frame[1]); rr(x,0,0,W,H,36); x.fillStyle=g; x.fill();
    if(st==='gold'){ const gg=x.createLinearGradient(0,0,W,H); ['#8a6a1f','#ffe9a8','#b8892b','#fff3c8','#8a6a1f'].forEach((cc,i)=>gg.addColorStop(i/4,cc)); x.lineWidth=18; x.strokeStyle=gg; rr(x,9,9,W-18,H-18,30); x.stroke(); }
    else { x.lineWidth=6; x.strokeStyle=frame[2]; x.shadowColor=frame[2]; x.shadowBlur=st==='neon'?28:10; rr(x,12,12,W-24,H-24,30); x.stroke(); x.shadowBlur=0; }
    if(st==='darkmatter'){ const r=BF.rng(9); for(let i=0;i<220;i++){ x.fillStyle=`rgba(255,255,255,${0.2+r()*0.6})`; x.fillRect(r()*W,r()*H,r()*2+0.5,r()*2+0.5); } }
    // header
    x.fillStyle=tc; x.font='700 26px "JetBrains Mono", Consolas, monospace'; x.textBaseline='top'; x.fillText(`${(info.type||'').toUpperCase()} TYPE`,48,44);
    x.textAlign='right'; x.fillStyle=rar[2]; x.fillText(rar[1],W-48,44); x.textAlign='left';
    // art window
    const ax=40, ay=92, aw=W-80, ah=560;
    rr(x,ax,ay,aw,ah,22); x.save(); x.clip();
    const bg=x.createRadialGradient(W/2,ay+ah/2,20,W/2,ay+ah/2,ah*0.7); bg.addColorStop(0,'#2a2460'); bg.addColorStop(1,'#07060e'); x.fillStyle=bg; x.fillRect(ax,ay,aw,ah);
    // radial speed lines
    x.strokeStyle='rgba(255,255,255,0.06)'; x.lineWidth=3; for(let i=0;i<48;i++){ const a=i/48*TAU; x.beginPath(); x.moveTo(W/2+Math.cos(a)*120,ay+ah/2+Math.sin(a)*120); x.lineTo(W/2+Math.cos(a)*600,ay+ah/2+Math.sin(a)*600); x.stroke(); }
    if(info.img){ const s=Math.min(aw,ah)*1.02; x.drawImage(info.img,W/2-s/2,ay+ah/2-s/2,s,s); }
    x.restore(); x.lineWidth=2; x.strokeStyle='rgba(255,255,255,0.15)'; rr(x,ax,ay,aw,ah,22); x.stroke();
    // name plate
    x.fillStyle='#ffffff'; x.font='700 54px "Chakra Petch", Bahnschrift, sans-serif'; x.fillText(fit(x,info.name,W-96),48,676);
    x.fillStyle=frame[2]==='#ffffff'?'#2ef2ff':frame[2]; x.font='700 34px "JetBrains Mono", Consolas, monospace'; x.fillText(info.code,48,742);
    x.fillStyle='rgba(236,233,250,0.6)'; x.font='500 22px "JetBrains Mono", Consolas, monospace'; x.textAlign='right'; x.fillText(`${info.system==='X'?'BEYBLADE X':'BURST'} · ${info.mass.toFixed(1)} g · ${info.diam.toFixed(0)} mm`,W-48,750); x.textAlign='left';
    // stats bars
    const S=[['ATK','attack'],['DEF','defense'],['STA','stamina'],['BRS','burst'],['STB','stability'],['SPD','speed']];
    S.forEach(([l,k],i)=>{ const col=i%2, row=Math.floor(i/2), bx=48+col*335, by=800+row*52, v=info.stats[k]||0;
      x.fillStyle='rgba(236,233,250,0.7)'; x.font='700 22px "JetBrains Mono", Consolas, monospace'; x.fillText(l,bx,by);
      rr(x,bx+70,by+4,220,16,8); x.fillStyle='rgba(255,255,255,0.08)'; x.fill();
      rr(x,bx+70,by+4,Math.max(16,220*v/100),16,8); const bg2=x.createLinearGradient(bx+70,0,bx+290,0); bg2.addColorStop(0,tc); bg2.addColorStop(1,'#ffffff'); x.fillStyle=bg2; x.fill();
      x.fillStyle='#ffffff'; x.textAlign='right'; x.fillText(String(v),bx+330,by); x.textAlign='left'; });
    // footer
    x.fillStyle='rgba(236,233,250,0.75)'; x.font='600 24px "JetBrains Mono", Consolas, monospace';
    x.fillText(`RECORD ${info.wins||0}W–${info.losses||0}L`,48,966);
    x.textAlign='right'; x.fillText(info.owner?`BLADER ${info.owner.toUpperCase()}`:'BEYFORGE',W-48,966); x.textAlign='left';
    x.fillStyle='rgba(236,233,250,0.25)'; x.font='600 16px "JetBrains Mono", Consolas, monospace'; x.fillText('BEYFORGE · '+new Date().getFullYear(),48,1004);
    return c;
  },
  infoFrom(d,img){
    const asm=BF.build(d), mp=BF.massProps(asm), an=BF.analyze(asm,mp), nm=BF.naming(d,an.type), rec=BF.Records.get(), bb=(rec.byBey&&rec.byBey[nm.full])||{w:0,l:0};
    return {d,name:nm.name,code:nm.code,type:an.type,system:d.system,stats:an.stats,mass:mp.mass,diam:BF.mainPart(asm).meta.R*2,wins:bb.w,losses:bb.l,owner:BF.Account&&BF.Account.profile&&BF.Account.profile.name,img};
  },
  async open(d,thumb){
    this.d=d; this.thumb=thumb; const m=$('#cardModal'); m.hidden=false; await this.refresh();
  },
  async refresh(){
    const img=await loadImg(this.thumb||BF.App.viewer.snapshot(720));
    const info=this.infoFrom(this.d,img); const c=await this.draw(info); this.canvas=c;
    const holder=$('#cardView'); holder.innerHTML=''; holder.appendChild(c); c.className='cardcanvas';
    holder.className='cardview cs-'+this.style+' r-'+rarityOf(info.wins||0)[1].toLowerCase();
    const sp=$('#cardStyles'); sp.innerHTML=Object.entries(BF.CARD_STYLES).map(([k,l])=>{ const own=BF.Shop.has('card',k); return `<button type="button" class="chip${this.style===k?' on':''}${own?'':' locked'}" data-cs="${k}">${l}${own?'':`<i class="lk">${BF.Shop.price('card',k)}</i>`}</button>`; }).join('');
    sp.querySelectorAll('[data-cs]').forEach(b=>b.onclick=()=>BF.Shop.require('card',b.dataset.cs,()=>{ this.style=b.dataset.cs; BF.LS.set('bf.cardStyle',this.style); this.refresh(); }));
  },
  async download(){
    const name=BF.Store.slug(BF.naming(this.d).full)+'_card.png';
    const blob=await new Promise(r=>this.canvas.toBlob(r,'image/png'));
    if(BF.Store.status==='connected'){ await BF.Store.write('cards/'+name,blob); BF.App.toast('Saved to '+BF.Store.dir.name+'\\cards','good'); return; }
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  },
  bind(){
    $('#cardClose').onclick=()=>$('#cardModal').hidden=true;
    $('#cardSave').onclick=()=>this.download();
    // holo tilt: card follows the pointer, foil shimmer moves across it
    const v=$('#cardView');
    const move=(cx,cy)=>{ const r=v.getBoundingClientRect(); const px=(cx-r.left)/r.width, py=(cy-r.top)/r.height; v.style.setProperty('--rx',((py-0.5)*-14)+'deg'); v.style.setProperty('--ry',((px-0.5)*18)+'deg'); v.style.setProperty('--mx',(px*100)+'%'); v.style.setProperty('--my',(py*100)+'%'); };
    v.addEventListener('pointermove',e=>move(e.clientX,e.clientY));
    v.addEventListener('pointerleave',()=>{ v.style.setProperty('--rx','0deg'); v.style.setProperty('--ry','0deg'); });
    window.addEventListener('deviceorientation',e=>{ if($('#cardModal').hidden||e.gamma==null) return; const r=v.getBoundingClientRect(); move(r.left+r.width*(0.5+e.gamma/60),r.top+r.height*(0.5+(e.beta-45)/60)); });
  }
};

// ---------- 3D showcase: full-screen spinning display on a glowing pedestal ----------
BF.Showcase = {
  on:false,
  toggle(){
    this.on=!this.on; const v=BF.App.viewer; document.body.classList.toggle('showcase',this.on);
    v.setSpin(true); v.state.speed=this.on?0.35:1; v.resize();
    if(this.on){ v.setExplode(false); this.t0=performance.now(); this.orbit(); $('#showcaseBar').hidden=false; $('#scName').textContent=BF.naming(BF.App.d,BF.App.an&&BF.App.an.type).full; }
    else { $('#showcaseBar').hidden=true; v.frame(); }
  },
  orbit(){ if(!this.on) return; const v=BF.App.viewer, t=(performance.now()-this.t0)/1000, h=BF.App.asm?BF.App.asm.height:24;
    v.controls.target.set(0,0,h*0.45); v.camera.position.set(Math.cos(t*0.25)*130,Math.sin(t*0.25)*130,70+Math.sin(t*0.4)*15); requestAnimationFrame(()=>this.orbit()); }
};
})();
function fit(x,t,max){ let s=String(t); while(x.measureText(s).width>max&&s.length>3) s=s.slice(0,-2)+'…'; return s; }
