/* BeyForge — coin shop & unlocks */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// price 0 = free for everyone
const P={
  finish:{matte:0,gloss:0,satin:0,metallic:0,chrome:300,pearl:250,glow:200},
  pattern:{none:0,stripes:0,dots:0,camo:0,flames:150,tiger:150,hex:150,waves:150,splatter:150,carbon:200,lightning:200,scales:200,galaxy:400},
  sticker:{star:0,bolt:0,number:0,text:0,target:0,diamond:0,heart:50,skull:100,crown:100,flame:100,eye:100,claw:150,wing:150},
  trail:{none:0,ribbon:0,sparks:200,fire:350,lightning:350,rainbow:500},
  launch:{none:0,ring:0,spiral:200,petals:250,lightning:300},
  aura:{none:0,glow:0,pulse:200,flame:350},
  win:{confetti:0,spotlight:250,shockwave:250,fireworks:300},
  card:{standard:0,neon:200,gold:400,holo:600,darkmatter:800}
};
const LEVEL={ 'card:darkmatter':5, 'trail:rainbow':4, 'pattern:galaxy':3 };
const CATS={finish:'Paint finishes',pattern:'Patterns',sticker:'Stickers',trail:'Spin trails',launch:'Launch effects',aura:'Auras',win:'Win animations',card:'Card styles'};
BF.CARD_STYLES={standard:'Standard',neon:'Neon',gold:'Gold',holo:'Holo foil',darkmatter:'Dark Matter'};
const label=(cat,k)=>({finish:BF.FINISHES,pattern:BF.PATTERNS,sticker:BF.STICKERS,trail:BF.COSMETICS.trail,launch:BF.COSMETICS.launch,aura:BF.COSMETICS.aura,win:BF.COSMETICS.win,card:BF.CARD_STYLES}[cat]||{})[k]||k;

BF.Shop = {
  price(cat,k){ return (P[cat]&&P[cat][k])||0; },
  level(cat,k){ return LEVEL[cat+':'+k]||1; },
  has(cat,k){
    if(!this.price(cat,k)) return true;
    const A=BF.Account; if(!A||!A.profile) return false; if(A.isOwner) return true;
    const u=A.profile.unlocks||[]; return u.includes('*')||u.includes(cat+':'+k);
  },
  // run fn if unlocked; otherwise offer to buy it
  require(cat,k,fn){ if(this.has(cat,k)) return fn(); this.offer(cat,k,fn); },
  offer(cat,k,after){
    const A=BF.Account, price=this.price(cat,k), lvl=this.level(cat,k), m=$('#shopModal'), body=$('#shopBody');
    const coins=(A.profile&&A.profile.coins)||0, myLvl=(A.profile&&A.profile.level)||1;
    body.innerHTML=`<div class="offer"><div class="offer-ico">${this.icon(cat,k)}</div><h3>${esc(label(cat,k))}</h3><div class="dim">${esc(CATS[cat])}</div>
      ${!A.profile?`<p>Sign in (Blader tab) to earn coins and unlock this.</p><div class="modal-acts"><button class="btn primary" id="ofSign">Sign in</button><button class="btn ghost" data-close="shopModal">Not now</button></div>`
      : myLvl<lvl?`<p>Reach <b>level ${lvl}</b> to unlock this one. You’re level ${myLvl}.</p><div class="modal-acts"><button class="btn ghost" data-close="shopModal">OK</button></div>`
      : `<p class="price"><b class="coin">${price}</b> coins · you have <b class="coin">${coins}</b></p>
         <div class="modal-acts"><button class="btn primary" id="ofBuy"${coins<price?' disabled':''}>${coins<price?'Not enough coins':'Unlock'}</button><button class="btn ghost" data-close="shopModal">Cancel</button></div>
         ${coins<price?'<p class="fine">Win battles to earn coins (+15 a win, +25 online) and grab the daily bonus.</p>':''}`}</div>`;
    m.hidden=false;
    body.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>m.hidden=true);
    const sb=$('#ofSign'); if(sb) sb.onclick=()=>{ m.hidden=true; document.querySelector('#tabs [data-tab=profile]').click(); };
    const bb=$('#ofBuy'); if(bb) bb.onclick=async()=>{ bb.disabled=true; try{ await this.buy(cat,k); m.hidden=true; BF.App.toast(`Unlocked ${label(cat,k)}`,'good'); BF.Sfx&&BF.Sfx.finish('xtreme'); after&&after(); }catch(e){ BF.App.toast(e.message,'bad'); bb.disabled=false; } };
  },
  async buy(cat,k){
    const A=BF.Account, price=this.price(cat,k); if(!A.profile) throw new Error('Sign in first');
    if((A.profile.coins||0)<price) throw new Error('Not enough coins');
    const FV=firebase.firestore.FieldValue;
    await A.update({coins:FV.increment(-price), unlocks:FV.arrayUnion(cat+':'+k)});
  },
  icon(cat,k){
    const col={finish:'#c8ced8',pattern:'#ff2e88',sticker:'#ffd21f',trail:'#2ef2ff',launch:'#a07bff',aura:'#3fe08a',win:'#ffb020',card:'#ff7a1a'}[cat];
    if(cat==='finish') return `<span class="sw-big fin-${k}"></span>`;
    if(cat==='sticker'){ const c=document.createElement('canvas'); c.width=c.height=64; const x=c.getContext('2d'); x.translate(32,32); BF.drawSticker(x,{k,color:'#ffd21f',text:k==='number'?'7':'BEY'},52); return `<img src="${c.toDataURL()}" alt="">`; }
    if(cat==='pattern'&&k!=='none'){ const c=BF.paintCanvas(Object.assign(BF.defaultPaint('#1d1846','gloss'),{pattern:k,patternColor:'#ff2e88',patternAlpha:0.9}),18,null); const s=document.createElement('canvas'); s.width=s.height=64; s.getContext('2d').drawImage(c,0,0,64,64); return `<img src="${s.toDataURL()}" alt="">`; }
    if(cat==='card') return `<span class="cardmini cs-${k}"></span>`;
    return `<span class="glyph" style="--c:${col}">${esc(label(cat,k)[0])}</span>`;
  },
  // daily login bonus
  async daily(){
    const A=BF.Account; if(!A.profile) return; const today=new Date().toISOString().slice(0,10);
    if(A.profile.lastDaily===today) return;
    await A.update({lastDaily:today, coins:firebase.firestore.FieldValue.increment(50)}).catch(()=>{});
    BF.App.toast('Daily bonus: +50 coins','good');
  },
  // ---------- Shop tab ----------
  render(){
    const root=$('#shopRoot'), A=BF.Account, p=A.profile;
    $('#shopCoins').innerHTML=p?`<b class="coin">${p.coins||0}</b> coins · LV ${p.level||1}`:'Sign in to earn coins';
    root.innerHTML=Object.entries(CATS).map(([cat,name])=>`<section class="shopcat"><h3>${esc(name)}</h3><div class="shopgrid">${Object.keys(P[cat]).filter(k=>P[cat][k]>0).map(k=>{
      const own=this.has(cat,k), lvl=this.level(cat,k), locked=p&&(p.level||1)<lvl;
      return `<div class="shopcard${own?' owned':''}"><div class="sc-ico">${this.icon(cat,k)}</div><b>${esc(label(cat,k))}</b>
        ${own?'<span class="sc-own">Owned</span>':locked?`<span class="sc-lvl">LV ${lvl}</span>`:`<button class="btn" data-buy="${cat}:${k}"><span class="coin">${P[cat][k]}</span></button>`}</div>`; }).join('')}</div>
      <div class="fine">Free: ${Object.keys(P[cat]).filter(k=>!P[cat][k]).map(k=>esc(label(cat,k))).join(', ')}</div></section>`).join('');
    root.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{ const [c,k]=b.dataset.buy.split(':'); this.offer(c,k,()=>this.render()); });
  }
};
BF.Account&&BF.Account.on(a=>{ if(a.profile&&!BF.Shop._dailyChecked){ BF.Shop._dailyChecked=true; BF.Shop.daily(); } if(!$('#view-shop').hidden) BF.Shop.render(); });
})();
