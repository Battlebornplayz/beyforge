/* BeyForge — settings: every option in one place, saved per device now (synced to accounts in 4.2) */
(function(){
'use strict';
const BF=window.BF, $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const DEFAULTS = {
  mode:'easy', preview:'paint', printChecks:true, autoSpin:true,
  roundLength:'normal', roundCustom:1, format:'official', customTarget:5, customPoints:'official',
  cosmetics:true, trails:true, particles:true, shake:true, quality:'high', shadows:true,
  sound:true, volume:0.6,
  tour:true, filament:[
    {name:'Black PLA', color:'#16171f', material:'PLA'}, {name:'White PLA', color:'#f2f4f8', material:'PLA'},
    {name:'Red PLA', color:'#e8262f', material:'PLA'}, {name:'Blue PETG', color:'#1f8bff', material:'PETG'}],
  recentColors:[]
};
BF.ROUND_LENGTH = {short:{label:'Short (~20 s)',k:1.35}, normal:{label:'Normal (~45 s)',k:0.7}, long:{label:'Long (~90 s)',k:0.4}, real:{label:'Real-life spin times',k:0.25}, custom:{label:'Custom',k:null}};
BF.FORMATS = {
  official:{label:'Official (X: 4 pts · Burst: 3 pts)'}, x4:{label:'X official — first to 4', target:4, pts:'X'}, burst3:{label:'Burst official — first to 3', target:3, pts:'Burst'},
  bo3:{label:'Best of 3 rounds', target:2, pts:'round'}, bo5:{label:'Best of 5 rounds', target:3, pts:'round'}, bo7:{label:'Best of 7 rounds', target:4, pts:'round'}, custom:{label:'Custom'}
};

BF.Settings = {
  v: Object.assign({}, DEFAULTS, BF.LS.get('bf.settings',{})),
  listeners:[],
  get(k){ return this.v[k]; },
  set(k,val){ this.v[k]=val; BF.LS.set('bf.settings',this.v); this.listeners.forEach(f=>f(k,val)); },
  on(f){ this.listeners.push(f); },
  decayK(){ const r=this.v.roundLength; return r==='custom' ? 1.6/Math.max(0.25,this.v.roundCustom) : BF.ROUND_LENGTH[r].k; },
  rulesFor(kind){
    const f=this.v.format;
    if(f==='official') return BF.RULES[kind];
    if(f==='custom'){ const base=this.v.customPoints==='round'?{spin:1,over:1,burst:1,xtreme:1}:BF.RULES[this.v.customPoints==='Burst'?'Burst':kind].pts; return {target:this.v.customTarget, pts:base}; }
    const F=BF.FORMATS[f]; return {target:F.target, pts:F.pts==='round'?{spin:1,over:1,burst:1,xtreme:1}:BF.RULES[F.pts].pts};
  },
  // nearest filament on the shelf, for "print view"
  nearestFilament(hex){
    const shelf=this.v.filament; if(!shelf.length) return hex;
    const c=new THREE.Color(hex); let best=shelf[0].color, bd=1e9;
    shelf.forEach(f=>{ const o=new THREE.Color(f.color); const dd=(c.r-o.r)**2*0.3+(c.g-o.g)**2*0.59+(c.b-o.b)**2*0.11; if(dd<bd){ bd=dd; best=f.color; } });
    return best;
  },
  pushRecent(hex){ const r=this.v.recentColors.filter(c=>c!==hex); r.unshift(hex); this.set('recentColors',r.slice(0,10)); },

  // ---------- settings modal ----------
  open(){
    const m=$('#settingsModal'); m.hidden=false; this.render();
  },
  render(){
    const v=this.v, body=$('#settingsBody');
    const tog=(k,label,hint)=>`<div class="srow"><div><b>${label}</b>${hint?`<span>${hint}</span>`:''}</div><button type="button" class="tog${v[k]?' on':''}" data-tog="${k}" aria-pressed="${!!v[k]}"><i></i></button></div>`;
    const sel=(k,label,opts,hint)=>`<div class="srow"><div><b>${label}</b>${hint?`<span>${hint}</span>`:''}</div><select data-sel="${k}">${Object.entries(opts).map(([a,b])=>`<option value="${a}"${String(v[k])===a?' selected':''}>${esc(typeof b==='object'?b.label:b)}</option>`).join('')}</select></div>`;
    body.innerHTML=`
      <section><h4>Forge</h4>
        ${sel('mode','Editor mode',{easy:'Easy — big simple choices',pro:'Pro — every control'})}
        ${sel('preview','3D preview',{paint:'Full paint & effects',print:'Print view (your filament colors)'},'Print view shows what your printer can actually make.')}
        ${tog('printChecks','Print checks','Thin walls, overhangs, balance and weight warnings.')}
        ${tog('autoSpin','Auto-spin preview')}
      </section>
      <section><h4>Battle</h4>
        ${sel('roundLength','Round length',BF.ROUND_LENGTH)}
        ${v.roundLength==='custom'?`<div class="srow"><div><b>Custom length</b><span>${(v.roundCustom).toFixed(2)}× normal</span></div><input type="range" min="0.5" max="4" step="0.25" value="${v.roundCustom}" data-range="roundCustom"></div>`:''}
        ${sel('format','Match format',BF.FORMATS)}
        ${v.format==='custom'?`<div class="srow"><div><b>Points to win</b></div><input type="number" class="num" min="1" max="20" value="${v.customTarget}" data-num="customTarget"></div>
          ${sel('customPoints','Point values',{official:'Official for the stadium',Burst:'Burst values',round:'1 per round won'})}`:''}
      </section>
      <section><h4>Visuals</h4>
        ${tog('cosmetics','Battle cosmetics','Trails, auras, launch and win effects.')}
        ${tog('particles','Sparks & particles')}
        ${tog('shake','Screen shake on big hits')}
        ${tog('shadows','Shadows')}
        ${sel('quality','Graphics quality',{high:'High',medium:'Medium',low:'Low (older phones)'})}
      </section>
      <section><h4>Sound</h4>
        ${tog('sound','Sound effects')}
        <div class="srow"><div><b>Volume</b></div><input type="range" min="0" max="1" step="0.05" value="${v.volume}" data-range="volume"></div>
      </section>
      <section><h4>My filament shelf</h4>
        <p class="dim small">The spools you own. They show up first when painting, and print view snaps colors to these.</p>
        <div class="shelf">${v.filament.map((f,i)=>`<div class="spool"><input type="color" value="${f.color}" data-fc="${i}"><input class="txt sm" value="${esc(f.name)}" data-fn="${i}" maxlength="24"><select data-fm="${i}">${Object.entries(BF.MATERIALS).map(([k,m])=>`<option value="${k}"${f.material===k?' selected':''}>${esc(m.label.split(' (')[0])}</option>`).join('')}</select><button type="button" class="icon-x" data-fdel="${i}" aria-label="Remove spool">×</button></div>`).join('')}</div>
        <button type="button" class="btn" data-addspool>Add spool</button>
      </section>
      <section><h4>Help & data</h4>
        <div class="srow"><div><b>Guided tour</b><span>Walk through the app again.</span></div><button type="button" class="btn" data-tour>Start tour</button></div>
        <div class="srow"><div><b>Reset settings</b></div><button type="button" class="btn ghost" data-reset>Reset</button></div>
      </section>`;
    body.querySelectorAll('[data-tog]').forEach(b=>b.onclick=()=>{ this.set(b.dataset.tog,!v[b.dataset.tog]); this.render(); });
    body.querySelectorAll('[data-sel]').forEach(s=>s.onchange=()=>{ this.set(s.dataset.sel,s.value); this.render(); });
    body.querySelectorAll('[data-range]').forEach(r=>r.oninput=()=>{ this.set(r.dataset.range,+r.value); if(r.dataset.range==='roundCustom') r.closest('.srow').querySelector('span').textContent=(+r.value).toFixed(2)+'× normal'; });
    body.querySelectorAll('[data-num]').forEach(r=>r.onchange=()=>{ this.set(r.dataset.num,Math.max(1,Math.min(20,+r.value||5))); });
    const shelf=()=>{ this.set('filament',v.filament.slice()); };
    body.querySelectorAll('[data-fc]').forEach(x=>x.onchange=()=>{ v.filament[+x.dataset.fc].color=x.value; shelf(); });
    body.querySelectorAll('[data-fn]').forEach(x=>x.onchange=()=>{ v.filament[+x.dataset.fn].name=x.value; shelf(); });
    body.querySelectorAll('[data-fm]').forEach(x=>x.onchange=()=>{ v.filament[+x.dataset.fm].material=x.value; shelf(); });
    body.querySelectorAll('[data-fdel]').forEach(x=>x.onclick=()=>{ v.filament.splice(+x.dataset.fdel,1); shelf(); this.render(); });
    body.querySelector('[data-addspool]').onclick=()=>{ v.filament.push({name:'New spool',color:'#8a3dff',material:'PLA'}); shelf(); this.render(); };
    body.querySelector('[data-tour]').onclick=()=>{ $('#settingsModal').hidden=true; BF.Tour && BF.Tour.start(); };
    const rb=body.querySelector('[data-reset]'); rb.onclick=()=>{ if(!rb.classList.contains('confirm')){ rb.classList.add('confirm'); rb.textContent='Tap again to reset'; return; } this.v=Object.assign({},DEFAULTS); BF.LS.set('bf.settings',this.v); this.listeners.forEach(f=>f('*')); this.render(); };
  }
};
})();
