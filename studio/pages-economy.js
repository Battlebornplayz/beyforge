/* BeyForge Studio — Rewards & economy: onboarding, free pack timer, 30-day streak, first win, Spin Drops, missions */
(function(){
'use strict';
const S=window.Studio, BF=window.BF, {$,$$,esc}=S;
const RAR=['common','rare','epic','legendary'];
const merge=(a,b)=>{ if(Array.isArray(b)) return BF.clone(b); if(b&&typeof b==='object'){ const o=Object.assign({},a); Object.entries(b).forEach(([k,v])=>o[k]=merge(a&&a[k],v)); return o; } return b===undefined?BF.clone(a):b; };
const rewardFields=(pre,r,packs)=>`<div class="rw">${S.f.num(pre+'.coins','Coins',r.coins||'',{min:0})}${S.f.num(pre+'.gems','Gems',r.gems||'',{min:0})}${S.f.num(pre+'.hourglass','Hourglasses',r.hourglass||'',{min:0})}
  ${S.f.sel(pre+'.pack','Pack',r.pack||'',Object.assign({'':'—'},packs))}${pre.includes('rewards')?S.f.sel(pre+'.part','Part',r.part||'',{'':'—',common:'Common',rare:'Rare',epic:'Epic',legendary:'Legendary'}):S.f.num(pre+'.freeze','Freezes',r.freeze||'',{min:0,max:3})}</div>`;
const clean=r=>{ const o={}; Object.entries(r||{}).forEach(([k,v])=>{ if(v===''||v==null||v===0||v===false) return; o[k]=v; }); return o; };

S.register('economy',{title:'Rewards & economy',icon:'🎁',group:'Live ops',sec:'switches',async render(v){
  const ref=S.db.collection('config').doc('economy'), saved=(await ref.get()).data()||{}, D=BF.ECON_DEFAULTS;
  let c=merge(D,saved); const canEdit=S.can('switches','edit'), F=S.f;
  const packs=Object.fromEntries((BF.Packs?BF.Packs.list():[]).map(p=>[p.id,p.name]));
  const draw=()=>{
    const sd=c.spinDrop, sum=RAR.reduce((a,r)=>a+(+sd.odds[r]||0),0);
    // value of the streak days, so jackpots can be checked against "worth more than the days before"
    const val=r=>(r.coins||0)+(r.gems||0)*25+(r.hourglass||0)*40+(r.pack?(BF.Packs&&BF.Packs.get(r.pack)?BF.Packs.get(r.pack).price:300):0)+(r.freeze||0)*100;
    v.innerHTML=S.head('Rewards & economy','The daily hooks that bring players back. Every number here is live the moment you save.',canEdit?'<button class="btn" id="ecReset">Reset to defaults</button><button class="btn primary" id="ecSave">Save & publish</button>':'')+
    `<div class="grid2"><section class="card"><h3>🎬 First-time players</h3><p class="muted">New players fight an instant battle, then open a free pack before being asked to sign up.</p>
        ${F.tog('onboarding.on','Instant first battle',c.onboarding.on)}<div class="grid2">${F.sel('onboarding.pack','Starter pack',c.onboarding.pack,packs)}${F.range('onboarding.starterBoost','Starter Bey boost',c.onboarding.starterBoost,{min:1,max:1.5,step:0.05,unit:'×'})}</div></section>
      <section class="card"><h3>🎁 Free pack timer</h3><p class="muted">Players get a free pack on a timer and can save some up. Phones get a “pack ready” notification.</p>
        ${F.tog('freePack.on','Free packs on',c.freePack.on)}<div class="grid2">${F.num('freePack.hours','Hours per pack',c.freePack.hours,{min:0.25,max:72,step:0.25})}${F.num('freePack.bank','Max saved up',c.freePack.bank,{min:1,max:5})}
        ${F.sel('freePack.pack','Which pack',c.freePack.pack,packs)}${F.num('freePack.hourglassMin','Each hourglass skips (min)',c.freePack.hourglassMin,{min:5,max:720})}</div></section></div>
    <section class="card"><div class="swh"><div><h3>📅 Daily streak calendar</h3><p class="muted">One reward per day in a row. Mark jackpots (they glow gold). Freezes protect a missed day.</p></div><div class="row">${F.tog('streak.on','Streak on',c.streak.on)}</div></div>
      <div class="grid3">${F.num('streak.freezeMax','Max freezes a player can hold',c.streak.freezeMax,{min:0,max:5})}</div>
      <div class="tbl-wrap"><table class="tbl stk"><thead><tr><th>Day</th><th>Coins</th><th>Gems</th><th>⏳</th><th>Pack</th><th>🧊</th><th>Jackpot</th><th>Value</th><th></th></tr></thead><tbody>
      ${c.streak.days.map((r,i)=>{ const prev=c.streak.days.slice(Math.max(0,i-6),i).reduce((a,x)=>a+val(x),0); return `<tr class="${r.jackpot?'jack':''}"><td><b>${i+1}</b></td>
        <td><input class="inp xs" type="number" min="0" data-d="${i}.coins" value="${r.coins||''}"></td><td><input class="inp xs" type="number" min="0" data-d="${i}.gems" value="${r.gems||''}"></td><td><input class="inp xs" type="number" min="0" data-d="${i}.hourglass" value="${r.hourglass||''}"></td>
        <td><select class="inp xs" data-d="${i}.pack"><option value="">—</option>${Object.entries(packs).map(([k,n])=>`<option value="${k}"${r.pack===k?' selected':''}>${esc(n)}</option>`).join('')}</select></td>
        <td><input class="inp xs" type="number" min="0" max="3" data-d="${i}.freeze" value="${r.freeze||''}"></td><td class="c"><input type="checkbox" data-d="${i}.jackpot"${r.jackpot?' checked':''}></td>
        <td class="r muted">${val(r)}${r.jackpot&&i>0?` <span class="${val(r)>prev?'up':'down'}" title="vs the previous ${Math.min(6,i)} days (${prev})">${val(r)>prev?'✓':'⚠'}</span>`:''}</td><td><button class="btn xs" data-rm="${i}">✕</button></td></tr>`; }).join('')}</tbody></table></div>
      <div class="row"><button class="btn sm" id="addDay">＋ Add day</button><span class="muted small">Value is a rough coin estimate (gem 25, hourglass 40, pack = its price). A ✓ jackpot is worth more than the 6 days before it.</span></div></section>
    <div class="grid2"><section class="card"><h3>☀ First win of the day</h3>${F.tog('firstWin.on','On',c.firstWin.on)}<div class="grid2">${F.num('firstWin.xp','XP',c.firstWin.xp,{min:0})}${F.num('firstWin.coins','Coins',c.firstWin.coins,{min:0})}</div>${F.tog('firstWin.spinDrop','Also give a free Spin Drop',c.firstWin.spinDrop)}</section>
      <section class="card"><h3>🎯 Missions</h3>${F.num('missions.hourglassOnAll','Hourglasses for finishing all 3 daily missions',c.missions.hourglassOnAll,{min:0,max:5})}</section></div>
    <section class="card"><h3>💫 Spin Drops <span class="sum ${Math.round(sum)===100?'ok':'bad'}">${sum}%</span></h3><p class="muted">After a win, players open a capsule. Each step it can upgrade to the next rarity.</p>
      ${F.tog('spinDrop.on','On',sd.on)}<div class="grid3">${F.num('spinDrop.perDay','Drops per day',sd.perDay,{min:0,max:50})}${F.range('spinDrop.upgrade','Upgrade chance per step',sd.upgrade,{min:0,max:60,unit:'%'})}</div>
      <div class="grid4">${RAR.map(r=>F.num('spinDrop.odds.'+r,(BF.RARITY[r]||{label:r}).label+' %',sd.odds[r],{min:0,max:100,step:0.5})).join('')}</div>
      <h4>Rewards by rarity</h4>${RAR.map(r=>`<div class="rwrow"><span class="pill" style="--pc:${(BF.RARITY[r]||{}).color}">${(BF.RARITY[r]||{label:r}).label}</span>${rewardFields('spinDrop.rewards.'+r,sd.rewards[r]||{},packs)}</div>`).join('')}</section>`;
    if(!canEdit) $$('input,select',v).forEach(i=>i.disabled=true);
    const sync=()=>{ const o=S.read(v); ['onboarding','freePack','firstWin','missions'].forEach(k=>c[k]=Object.assign({},c[k],o[k]||{})); c.streak=Object.assign({},c.streak,{on:o.streak.on,freezeMax:o.streak.freezeMax});
      c.spinDrop=Object.assign({},c.spinDrop,{on:o.spinDrop.on,perDay:o.spinDrop.perDay,upgrade:o.spinDrop.upgrade,odds:o.spinDrop.odds,rewards:Object.fromEntries(RAR.map(r=>[r,clean(o.spinDrop.rewards[r])]))});
      $$('[data-d]',v).forEach(i=>{ const [d,k]=i.dataset.d.split('.'); const day=c.streak.days[+d]=c.streak.days[+d]||{}; let x=i.type==='checkbox'?i.checked:i.value; if(i.type==='number') x=i.value===''?0:+i.value; day[k]=x; c.streak.days[+d]=clean(day); }); };
    S.bindLive(v,e=>{ if(e.type==='change'&&(e.target.dataset.d||/odds/.test(e.target.dataset.f||''))){ sync(); draw(); } });
    $$('[data-rm]',v).forEach(b=>b.onclick=()=>{ sync(); c.streak.days.splice(+b.dataset.rm,1); draw(); });
    const ad=$('#addDay',v); if(ad) ad.onclick=()=>{ sync(); c.streak.days.push({coins:100}); draw(); };
    const sv=$('#ecSave',v); if(sv) sv.onclick=async()=>{ sync(); const s2=RAR.reduce((a,r)=>a+(+c.spinDrop.odds[r]||0),0); if(Math.round(s2)!==100) return S.toast('Spin Drop odds must add up to 100%','bad');
      if(!await S.confirm({title:'Publish economy changes?',body:'Every player gets the new timers and rewards right away.',ok:'Publish'})) return;
      await ref.set(JSON.parse(JSON.stringify(c))); S.audit('changed rewards & economy','economy',saved,c,{type:'config',doc:'economy'}); S.toast('Live now','good'); };
    const rs=$('#ecReset',v); if(rs) rs.onclick=async()=>{ if(!await S.confirm({title:'Reset to defaults?',body:'Puts every economy number back to the built-in defaults.',ok:'Reset',danger:true})) return; await ref.set({}); S.audit('reset economy','economy',saved,{}); S.route(); };
  };
  draw();
}});
})();
