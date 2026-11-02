/* BeyForge — Ranked: owner-controlled competitive ruleset (Firestore config/ranked), build checks, rating */
(function(){
'use strict';
const BF=window.BF;
BF.RANKED_DEFAULT = {
  stadium:'X', size:380, roundLength:'normal', roundCustom:1,
  target:4, pts:{spin:1, over:2, burst:2, xtreme:3},
  minWeight:0, maxWeight:60, maxDiameter:52,
  bannedTips:[], bannedInserts:[], allowMetalFill:true, allowLift:true, allowHorns:true,
  winRating:25, lossRating:20
};
BF.Ranked = {
  rules: BF.clone(BF.RANKED_DEFAULT), live:false,
  listen(){ // everyone follows the owner's ruleset live
    if(!BF.Account.available()||!BF.Account.db) return;
    BF.Account.db.collection('config').doc('ranked').onSnapshot(s=>{ const d=s.data(); this.rules=Object.assign(BF.clone(BF.RANKED_DEFAULT),d||{}); this.live=!!d; },()=>{});
  },
  decayK(){ const r=this.rules; return r.roundLength==='custom' ? 1.6/Math.max(0.25,r.roundCustom||1) : (BF.ROUND_LENGTH[r.roundLength]||BF.ROUND_LENGTH.normal).k; },
  stadium(){ const r=this.rules, kind=r.stadium==='Burst'?'Burst':'X'; return Object.assign({},BF.STADIUMS[kind],{diameter:r.size||BF.STADIUMS[kind].diameter}); },
  matchRules(){ return {target:this.rules.target, pts:Object.assign({spin:1,over:1,burst:1,xtreme:1},this.rules.pts)}; },
  // returns a list of reasons a design isn't ranked-legal (empty = legal)
  check(d){
    const r=this.rules, out=[]; const f=BF.fighter(d), g=f.mp.mass, D=f.R*2;
    if(r.minWeight && g<r.minWeight) out.push(`Too light: ${g.toFixed(1)} g (min ${r.minWeight} g)`);
    if(r.maxWeight && g>r.maxWeight) out.push(`Too heavy: ${g.toFixed(1)} g (max ${r.maxWeight} g)`);
    if(r.maxDiameter && D>r.maxDiameter+0.01) out.push(`Too wide: ${D.toFixed(1)} mm (max ${r.maxDiameter} mm)`);
    if((r.bannedTips||[]).includes(d.bit.tip)) out.push(`${BF.TIPS[d.bit.tip].label} tip is banned in ranked`);
    if(d.weights.insert!=='none' && (r.bannedInserts||[]).includes(d.weights.insert)) out.push(`${BF.INSERTS[d.weights.insert].label} inserts are banned in ranked`);
    if(!r.allowMetalFill && [d.blade.material,d.ratchet.material,d.disc.material,d.bit.material].includes('METAL')) out.push('Metal-fill parts are banned in ranked');
    if(!r.allowLift && (d.blade.lift||0)>0.2) out.push('Lifted wings are banned in ranked');
    if(!r.allowHorns && d.deco.horns && d.deco.horns.count>0) out.push('Horns/spikes are banned in ranked');
    return out;
  },
  summary(){ const r=this.rules; return `${r.stadium==='Burst'?'Burst':'Xtreme'} ${r.size} mm · first to ${r.target} · ${(BF.ROUND_LENGTH[r.roundLength]||{label:'custom'}).label.split(' (')[0].toLowerCase()} rounds · ${r.minWeight?r.minWeight+'–':'≤'}${r.maxWeight} g`; },

  // ---------- owner editor (Admin → Ranked rules) ----------
  editor(el){
    const r=BF.clone(this.rules), esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    const num=(k,label,min,max,step,unit,val)=>`<label class="rk-f"><span>${label}</span><span class="num-wrap"><input class="num" type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}"><span class="unit">${unit||''}</span></span></label>`;
    const chk=(k,label)=>`<label class="pchip${r[k]?' on':''}"><input type="checkbox" data-c="${k}"${r[k]?' checked':''}>${label}</label>`;
    el.innerHTML=`<p class="dim small">This is the official competitive ruleset. Every <b>Ranked</b> online match uses it — players can’t change it. Casual matches still use each player’s own settings. ${this.live?'':'<b>Not published yet</b> — ranked is using the defaults until you save.'}</p>
      <div class="rk-grid">
        <section><h4>Stadium & rounds</h4>
          <label class="rk-f"><span>Stadium</span><select data-s="stadium"><option value="X"${r.stadium==='X'?' selected':''}>Xtreme</option><option value="Burst"${r.stadium==='Burst'?' selected':''}>Burst</option></select></label>
          ${num('size','Stadium size',280,480,10,'mm',r.size)}
          <label class="rk-f"><span>Round length</span><select data-s="roundLength">${Object.entries(BF.ROUND_LENGTH).map(([k,v])=>`<option value="${k}"${r.roundLength===k?' selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
          ${num('roundCustom','Custom length',0.5,4,0.25,'× normal',r.roundCustom)}
        </section>
        <section><h4>Scoring</h4>
          ${num('target','Points to win',1,20,1,'',r.target)}
          ${num('pts.spin','Spin finish',0,10,1,'pts',r.pts.spin)}${num('pts.over','Over finish',0,10,1,'pts',r.pts.over)}
          ${num('pts.burst','Burst finish',0,10,1,'pts',r.pts.burst)}${num('pts.xtreme','Xtreme finish',0,10,1,'pts',r.pts.xtreme)}
        </section>
        <section><h4>Build limits</h4>
          ${num('minWeight','Min weight',0,200,0.5,'g',r.minWeight)}${num('maxWeight','Max weight',1,200,0.5,'g',r.maxWeight)}
          ${num('maxDiameter','Max diameter',30,60,0.5,'mm',r.maxDiameter)}
          <div class="chips">${chk('allowMetalFill','Metal-fill allowed')}${chk('allowLift','Lifted wings allowed')}${chk('allowHorns','Horns allowed')}</div>
        </section>
        <section><h4>Banned tips</h4><div class="chips">${Object.entries(BF.TIPS).map(([k,t])=>`<label class="pchip ban${r.bannedTips.includes(k)?' on':''}"><input type="checkbox" data-bt="${k}"${r.bannedTips.includes(k)?' checked':''}>${esc(t.label)}</label>`).join('')}</div>
          <h4>Banned inserts</h4><div class="chips">${Object.entries(BF.INSERTS).filter(([k])=>k!=='none').map(([k,t])=>`<label class="pchip ban${r.bannedInserts.includes(k)?' on':''}"><input type="checkbox" data-bi="${k}"${r.bannedInserts.includes(k)?' checked':''}>${esc(t.label)}</label>`).join('')}</div></section>
        <section><h4>Rating</h4>${num('winRating','Rating per win',0,100,1,'',r.winRating)}${num('lossRating','Rating lost per loss',0,100,1,'',r.lossRating)}</section>
      </div>
      <div class="addrow"><button class="btn primary" id="rkSave">Publish ranked rules</button><button class="btn ghost" id="rkReset">Reset to defaults</button></div>`;
    const setPath=(o,p,v)=>{ const k=p.split('.'); if(k.length>1){ o[k[0]][k[1]]=v; } else o[p]=v; };
    el.querySelectorAll('[data-k]').forEach(i=>i.onchange=()=>setPath(r,i.dataset.k,parseFloat(i.value)||0));
    el.querySelectorAll('[data-s]').forEach(i=>i.onchange=()=>{ r[i.dataset.s]=i.value; if(i.dataset.s==='stadium'){ const sz=el.querySelector('[data-k=size]'); sz.value=r.size=i.value==='X'?380:360; } });
    el.querySelectorAll('[data-c]').forEach(i=>i.onchange=()=>{ r[i.dataset.c]=i.checked; i.parentElement.classList.toggle('on',i.checked); });
    el.querySelectorAll('[data-bt]').forEach(i=>i.onchange=()=>{ const k=i.dataset.bt; r.bannedTips=r.bannedTips.filter(x=>x!==k); if(i.checked) r.bannedTips.push(k); i.parentElement.classList.toggle('on',i.checked); });
    el.querySelectorAll('[data-bi]').forEach(i=>i.onchange=()=>{ const k=i.dataset.bi; r.bannedInserts=r.bannedInserts.filter(x=>x!==k); if(i.checked) r.bannedInserts.push(k); i.parentElement.classList.toggle('on',i.checked); });
    el.querySelector('#rkSave').onclick=()=>{ if(r.minWeight>r.maxWeight) return BF.App.toast('Min weight is above max weight','bad');
      BF.Account.db.collection('config').doc('ranked').set(Object.assign(r,{by:BF.Account.profile.name,ts:firebase.firestore.FieldValue.serverTimestamp()})).then(()=>BF.App.toast('Ranked rules published — live for everyone','good')).catch(e=>BF.App.toast(BF.friendly(e),'bad')); };
    el.querySelector('#rkReset').onclick=()=>{ Object.assign(r,BF.clone(BF.RANKED_DEFAULT)); this.rules=BF.clone(BF.RANKED_DEFAULT); this.editor(el); BF.App.toast('Defaults loaded — hit Publish to apply'); };
  }
};
})();
