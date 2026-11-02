/* BeyForge — controls + spec sheet */
(function(){
'use strict';
const BF=window.BF;
const X=d=>d.system==='X', B=d=>d.system==='Burst';
const pct=v=>Math.round(v*100)+'%';
const matOpts=()=>Object.fromEntries(Object.entries(BF.MATERIALS).map(([k,v])=>[k,v.label]));
const tipOpts=()=>Object.fromEntries(Object.entries(BF.TIPS).map(([k,v])=>[k,v.label+' · '+v.x]));
const insOpts=()=>Object.fromEntries(Object.entries(BF.INSERTS).map(([k,v])=>[k,v.label+(v.mass?` · ${v.mass} g`:'')]));

// k = design path, t = control type, re = re-render panel when it changes
BF.SCHEMA = [
  {sec:'System', id:'sys', items:[
    {k:'system',t:'seg',l:'Generation',o:{X:'Beyblade X',Burst:'Burst'},re:1},
    {k:'spin',t:'seg',l:'Spin direction',o:{right:'Right',left:'Left',dual:'Dual'}},
    {k:'symmetry',t:'toggle',l:'Symmetric wings',h:'Off = tune every wing on its own for lopsided builds.',re:1}
  ]},
  {sec:d=>X(d)?'Blade':'Layer', id:'blade', items:[
    {k:'blade.diameter',t:'range',l:'Diameter',min:34,max:56,step:0.5,u:'mm'},
    {k:'blade.wings',t:'range',l:'Contact points',min:1,max:8,step:1,re:d=>!d.symmetry},
    {k:'blade.shape',t:'sel',l:'Wing shape',o:BF.WING_SHAPES,re:1},
    {t:'draw',when:d=>d.blade.shape==='custom'},
    {k:'blade.wingWidth',t:'range',l:'Wing width',min:0.2,max:1,step:0.01,fmt:pct,when:d=>d.blade.shape!=='ring'},
    {k:'blade.depth',t:'range',l:'Wing reach',min:0.05,max:0.5,step:0.01,fmt:pct,h:'How far the wings stick out past the core.'},
    {k:'blade.sweep',t:'range',l:'Wing sweep',min:-35,max:35,step:1,u:'°'},
    {k:'blade.soft',t:'range',l:'Edge softness',min:0,max:12,step:0.5,u:'°'},
    {k:'blade.height',t:'range',l:'Core height',min:6,max:16,step:0.5,u:'mm'},
    {k:'blade.tipHeight',t:'range',l:'Wing-tip thickness',min:1.2,max:16,step:0.2,u:'mm'},
    {k:'blade.slope',t:'range',l:'Contact angle',min:-30,max:35,step:1,u:'°',h:'+ = upper-attack slope (smash up). − = lower attack, which overhangs when printed.'},
    {t:'perwing',when:d=>!d.symmetry}
  ]},
  {sec:'Ratchet', id:'ratchet', when:X, items:[
    {k:'ratchet.points',t:'range',l:'Ratchet points',min:3,max:9,step:1},
    {k:'ratchet.height',t:'range',l:'Ratchet height',min:50,max:80,step:5,fmt:v=>`${v} · ${(v/10).toFixed(1)} mm`}
  ]},
  {sec:'Burst lock', id:'lock', when:B, items:[
    {k:'lock.teeth',t:'range',l:'Lock prongs',min:2,max:6,step:1},
    {k:'lock.strength',t:'range',l:'Lock tightness',min:1,max:5,step:1,fmt:v=>['','Loose','Light','Medium','Firm','Locked'][v],h:'Tighter = harder to burst, but harder to assemble. Tune with the fit tolerance.'}
  ]},
  {sec:'Disc', id:'disc', when:B, items:[
    {k:'disc.shape',t:'sel',l:'Disc shape',o:BF.DISC_SHAPES,re:1},
    {k:'disc.lobes',t:'range',l:'Lobes / points',min:2,max:8,step:1,when:d=>['star','wing','gear'].includes(d.disc.shape)},
    {k:'disc.diameter',t:'range',l:'Diameter',min:26,max:42,step:0.5,u:'mm'},
    {k:'disc.thickness',t:'range',l:'Thickness',min:2,max:8,step:0.5,u:'mm'},
    {k:'disc.rim',t:'range',l:'Rim weight',min:0,max:1,step:0.05,fmt:pct,h:'Pushes mass to the outer edge for more spin inertia.'}
  ]},
  {sec:d=>X(d)?'Bit':'Driver', id:'bit', items:[
    {k:'bit.tip',t:'sel',l:'Tip',o:tipOpts(),re:1},
    {k:'bit.width',t:'range',l:'Tip width',min:2,max:12,step:0.5,u:'mm'},
    {k:'bit.tipLen',t:'range',l:'Tip height',min:2,max:9,step:0.5,u:'mm'},
    {k:'bit.gear',t:'toggle',l:'Xtreme Dash gear',when:X,re:1,h:'Toothed ring that grabs the stadium rail for a speed boost.'},
    {k:'bit.gearTeeth',t:'range',l:'Gear teeth',min:10,max:24,step:1,when:d=>X(d)&&d.bit.gear}
  ]},
  {sec:'Decoration', id:'deco', items:[
    {k:'deco.emblem',t:'sel',l:'Wing emblem',o:BF.EMBLEMS},
    {k:'deco.emblemSize',t:'range',l:'Emblem size',min:0.3,max:1.2,step:0.05,fmt:pct},
    {k:'deco.text',t:'text',l:'Core lettering',max:16,h:'Raised letters around the center.'},
    {k:'deco.texture',t:'sel',l:'Surface texture',o:BF.TEXTURES},
    {k:'deco.textureCount',t:'range',l:'Texture density',min:1,max:4,step:1}
  ]},
  {sec:'Weights', id:'weights', items:[
    {k:'weights.insert',t:'sel',l:'Insert',o:insOpts(),re:1},
    {k:'weights.part',t:'seg',l:'Put them in',o:{layer:'Layer',disc:'Disc'},when:B},
    {k:'weights.count',t:'range',l:'How many',min:0,max:8,step:1,when:d=>d.weights.insert!=='none'},
    {k:'weights.radius',t:'range',l:'Distance from center',min:8,max:26,step:0.5,u:'mm',when:d=>d.weights.insert!=='none'},
    {t:'note',when:d=>d.weights.insert!=='none',text:'Pockets open on the underside. Press the insert in, add a drop of CA glue.'}
  ]},
  {sec:'Materials & colors', id:'mats', items:[
    {k:'blade.material',t:'sel',l:d=>X(d)?'Blade material':'Layer material',o:matOpts()},
    {k:'blade.color',t:'color',l:d=>X(d)?'Blade color':'Layer color'},
    {k:'deco.accent',t:'color',l:'Accent color (emblems, text, texture)'},
    {k:'ratchet.material',t:'sel',l:'Ratchet material',o:matOpts(),when:X},
    {k:'ratchet.color',t:'color',l:'Ratchet color',when:X},
    {k:'disc.material',t:'sel',l:'Disc material',o:matOpts(),when:B},
    {k:'disc.color',t:'color',l:'Disc color',when:B},
    {k:'bit.material',t:'sel',l:d=>X(d)?'Bit material':'Driver material',o:matOpts()},
    {k:'bit.color',t:'color',l:d=>X(d)?'Bit color':'Driver color'},
    {k:'bit.tipMaterial',t:'sel',l:'Tip material',o:matOpts()},
    {k:'bit.tipColor',t:'color',l:'Tip color'}
  ]},
  {sec:'Print & fit', id:'print', items:[
    {k:'print.infill',t:'range',l:'Infill',min:0.1,max:1,step:0.05,fmt:pct,h:'Used for weight estimates. Use 100% on small parts for strength.'},
    {k:'print.tolerance',t:'range',l:'Fit tolerance',min:0,max:0.6,step:0.05,u:'mm',h:'Gap added to every socket. Raise it if parts are too tight on your printer.'},
    {k:'fit.xPlugD',t:'num',l:'Blade hole Ø',u:'mm',min:12,max:24,step:0.1,when:X},
    {k:'fit.xPlugH',t:'num',l:'Ratchet plug height',u:'mm',min:1.5,max:6,step:0.1,when:X},
    {k:'fit.xSocketD',t:'num',l:'Bit shaft Ø',u:'mm',min:5,max:12,step:0.1,when:X},
    {k:'fit.bShaftD',t:'num',l:'Driver shaft Ø',u:'mm',min:6,max:14,step:0.1,when:B},
    {t:'note',text:'Interface sizes are close starting points, not factory specs. Measure your official parts with calipers and enter the numbers here, then do one test print.'}
  ]}
];

const el=(tag,cls,html)=>{ const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };
const val=(it,d)=>BF.get(d,it.k);
const lbl=(it,d)=>typeof it.l==='function'?it.l(d):it.l;
const fmtVal=(it,v)=>it.fmt?it.fmt(v):(typeof v==='number'?(+v.toFixed(2))+(it.u?' '+it.u:''):v);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

BF.UI = {
  open: BF.LS.get('bf.open',{sys:1,blade:1,ratchet:1,lock:1,disc:1,bit:1}),
  render(root,d,onChange){
    const scroll=root.scrollTop; root.innerHTML='';
    BF.SCHEMA.forEach(sec=>{
      if(sec.when && !sec.when(d)) return;
      const det=el('details','sec'); det.open=!!this.open[sec.id];
      det.addEventListener('toggle',()=>{ this.open[sec.id]=det.open; BF.LS.set('bf.open',this.open); });
      det.appendChild(el('summary','',`<span>${esc(typeof sec.sec==='function'?sec.sec(d):sec.sec)}</span>`));
      const body=el('div','sec-body');
      sec.items.forEach(it=>{ if(it.when && !it.when(d)) return; const c=this.control(it,d,onChange); if(c) body.appendChild(c); });
      det.appendChild(body); root.appendChild(det);
    });
    root.scrollTop=scroll;
  },
  control(it,d,onChange){
    const re=it.re?(typeof it.re==='function'?it.re(d):true):false;
    const send=(v,commit)=>onChange(it.k,v,{re,commit});
    const row=el('div','ctl ctl-'+it.t);
    const head=()=>{ const h=el('div','ctl-head'); h.appendChild(el('label','',esc(lbl(it,d)))); return h; };
    if(it.t==='range'){
      const h=head(); const out=el('output','val',esc(fmtVal(it,val(it,d)))); h.appendChild(out); row.appendChild(h);
      const inp=el('input'); inp.type='range'; inp.min=it.min; inp.max=it.max; inp.step=it.step; inp.value=val(it,d); inp.id='c-'+it.k.replace(/\./g,'-');
      const fill=()=>inp.style.setProperty('--p',((inp.value-it.min)/(it.max-it.min)*100)+'%'); fill();
      inp.addEventListener('input',()=>{ const v=+inp.value; out.textContent=fmtVal(it,v); fill(); send(v,false); });
      inp.addEventListener('change',()=>send(+inp.value,true));
      row.appendChild(inp);
    } else if(it.t==='num'){
      const h=head(); const inp=el('input','num'); inp.type='number'; inp.min=it.min; inp.max=it.max; inp.step=it.step; inp.value=val(it,d); inp.id='c-'+it.k.replace(/\./g,'-');
      inp.addEventListener('change',()=>{ let v=parseFloat(inp.value); if(isNaN(v)) v=val(it,d); v=Math.max(it.min,Math.min(it.max,v)); inp.value=v; send(v,true); });
      const wrap=el('span','num-wrap'); wrap.appendChild(inp); wrap.appendChild(el('span','unit',it.u||'')); h.appendChild(wrap); row.appendChild(h);
    } else if(it.t==='sel'){
      row.appendChild(head()); const s=el('select'); s.id='c-'+it.k.replace(/\./g,'-');
      Object.entries(it.o).forEach(([k,v])=>{ const o=el('option','',esc(v)); o.value=k; if(k===String(val(it,d))) o.selected=true; s.appendChild(o); });
      s.addEventListener('change',()=>send(s.value,true)); row.appendChild(s);
    } else if(it.t==='seg'){
      row.appendChild(head()); const g=el('div','seg');
      Object.entries(it.o).forEach(([k,v])=>{ const b=el('button',String(val(it,d))===k?'on':'',esc(v)); b.type='button'; b.addEventListener('click',()=>send(k,true)); g.appendChild(b); });
      row.appendChild(g);
    } else if(it.t==='toggle'){
      const h=head(); const b=el('button','tog'+(val(it,d)?' on':''),'<i></i>'); b.type='button'; b.setAttribute('aria-pressed',!!val(it,d)); b.addEventListener('click',()=>send(!val(it,d),true)); h.appendChild(b); row.appendChild(h);
    } else if(it.t==='color'){
      row.appendChild(head()); const g=el('div','swatches'); const cur=String(val(it,d)).toLowerCase();
      BF.SWATCHES.forEach(c=>{ const b=el('button','sw'+(c===cur?' on':'')); b.type='button'; b.style.setProperty('--c',c); b.title=c; b.addEventListener('click',()=>send(c,true)); g.appendChild(b); });
      const pick=el('input','pick'); pick.type='color'; pick.value=cur; pick.title='Custom color';
      pick.addEventListener('input',()=>send(pick.value,false)); pick.addEventListener('change',()=>send(pick.value,true)); g.appendChild(pick); row.appendChild(g);
    } else if(it.t==='text'){
      row.appendChild(head()); const inp=el('input','txt'); inp.type='text'; inp.maxLength=it.max; inp.value=val(it,d)||''; inp.id='c-'+it.k.replace(/\./g,'-'); inp.spellcheck=false;
      inp.addEventListener('input',()=>send(inp.value,false)); inp.addEventListener('change',()=>send(inp.value,true)); row.appendChild(inp);
    } else if(it.t==='note'){
      row.className='ctl-note'; row.textContent=it.text; return row;
    } else if(it.t==='draw'){
      return this.drawPad(d,onChange);
    } else if(it.t==='perwing'){
      const wrap=el('div','perwing'); wrap.appendChild(el('div','pw-title','Per-wing tuning'));
      for(let i=0;i<Math.round(d.blade.wings);i++){
        const r=el('div','pw-row'); r.appendChild(el('span','pw-n',`W${i+1}`));
        const mk=(key,min,max,step,fmt)=>{ const inp=el('input'); inp.type='range'; inp.min=min; inp.max=max; inp.step=step; inp.value=d.blade[key][i]; inp.title=key==='wingScale'?'Length':'Angle shift';
          const o=el('output','val',fmt(+inp.value)); inp.addEventListener('input',()=>{ const arr=d.blade[key].slice(); arr[i]=+inp.value; o.textContent=fmt(+inp.value); onChange('blade.'+key,arr,{commit:false}); });
          inp.addEventListener('change',()=>{ const arr=d.blade[key].slice(); arr[i]=+inp.value; onChange('blade.'+key,arr,{commit:true}); });
          const c=el('div','pw-c'); c.appendChild(inp); c.appendChild(o); return c; };
        r.appendChild(mk('wingScale',0.3,1.15,0.01,v=>Math.round(v*100)+'%'));
        r.appendChild(mk('wingShift',-30,30,1,v=>(v>0?'+':'')+v+'°'));
        wrap.appendChild(r);
      }
      return wrap;
    }
    if(it.h){ row.appendChild(el('div','hint',esc(it.h))); }
    return row;
  },
  drawPad(d,onChange){
    const wrap=el('div','draw'); wrap.appendChild(el('div','pw-title','Draw one wing — left edge strikes first'));
    const cv=el('canvas'); cv.width=560; cv.height=200; wrap.appendChild(cv);
    const tools=el('div','draw-tools');
    const presets={Blade:'blade',Claw:'claw',Round:'round',Spike:'spike',Saw:'saw'};
    Object.entries(presets).forEach(([n,s])=>{ const b=el('button','chip',n); b.type='button'; b.addEventListener('click',()=>{ const arr=Array.from({length:24},(_,i)=>+BF.wingProfile(s,i/23).toFixed(3)); onChange('blade.custom',arr,{commit:true,re:true}); }); tools.appendChild(b); });
    wrap.appendChild(tools);
    const ctx=cv.getContext('2d'); let arr=d.blade.custom.slice(); const n=arr.length;
    const draw=()=>{ const w=cv.width,h=cv.height; ctx.clearRect(0,0,w,h);
      ctx.strokeStyle='rgba(140,130,200,.18)'; ctx.lineWidth=1; for(let i=0;i<=8;i++){ const x=i/8*w; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); } for(let i=0;i<=4;i++){ const y=i/4*h; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      const grd=ctx.createLinearGradient(0,0,0,h); grd.addColorStop(0,'rgba(46,242,255,.45)'); grd.addColorStop(1,'rgba(46,242,255,0)');
      ctx.beginPath(); ctx.moveTo(0,h); arr.forEach((v,i)=>ctx.lineTo(i/(n-1)*w,h-v*(h-14)-6)); ctx.lineTo(w,h); ctx.closePath(); ctx.fillStyle=grd; ctx.fill();
      ctx.beginPath(); arr.forEach((v,i)=>{ const x=i/(n-1)*w, y=h-v*(h-14)-6; i?ctx.lineTo(x,y):ctx.moveTo(x,y); }); ctx.strokeStyle='#2ef2ff'; ctx.lineWidth=3; ctx.shadowColor='#2ef2ff'; ctx.shadowBlur=10; ctx.stroke(); ctx.shadowBlur=0; };
    draw();
    let down=false, last=null;
    const at=e=>{ const r=cv.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height; return {i:Math.round(x*(n-1)), v:Math.max(0,Math.min(1,1-y))}; };
    const paint=e=>{ const p=at(e); const from=last||p; const a=Math.min(from.i,p.i), b=Math.max(from.i,p.i);
      for(let i=a;i<=b;i++){ if(i<0||i>=n) continue; const t=b===a?1:(i-from.i)/(p.i-from.i||1); arr[i]=+(from.v+(p.v-from.v)*Math.max(0,Math.min(1,t))).toFixed(3); }
      last=p; draw(); onChange('blade.custom',arr.slice(),{commit:false}); };
    cv.addEventListener('pointerdown',e=>{ down=true; last=null; cv.setPointerCapture(e.pointerId); paint(e); });
    cv.addEventListener('pointermove',e=>{ if(down) paint(e); });
    cv.addEventListener('pointerup',()=>{ down=false; last=null; onChange('blade.custom',arr.slice(),{commit:true}); });
    return wrap;
  },

  // ---------- right-hand spec sheet ----------
  hex(stats){
    const axes=[['attack','ATK'],['defense','DEF'],['stamina','STA'],['burst','BRS'],['stability','STB'],['speed','SPD']];
    const cx=110,cy=104,R=78, pt=(i,f)=>{ const a=-Math.PI/2+i*Math.PI/3; return [cx+R*f*Math.cos(a), cy+R*f*Math.sin(a)]; };
    const ring=f=>axes.map((_,i)=>pt(i,f).map(v=>v.toFixed(1)).join(',')).join(' ');
    const shape=axes.map(([k],i)=>pt(i,Math.max(0.04,stats[k]/100)).map(v=>v.toFixed(1)).join(',')).join(' ');
    const labels=axes.map(([k,l],i)=>{ const [x,y]=pt(i,1.2); return `<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle" class="hx-l">${l}</text><text x="${x.toFixed(1)}" y="${(y+16).toFixed(1)}" text-anchor="middle" class="hx-v">${stats[k]}</text>`; }).join('');
    return `<svg viewBox="0 0 220 214" class="hexchart" role="img" aria-label="Stats">
      ${[0.25,0.5,0.75,1].map(f=>`<polygon points="${ring(f)}" class="hx-grid"/>`).join('')}
      ${axes.map((_,i)=>{ const [x,y]=pt(i,1); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="hx-grid"/>`; }).join('')}
      <polygon points="${shape}" class="hx-shape"/>${labels}</svg>`;
  },
  // v5: element typing + the 3 moves each part brings to a launch formation
  battleKit(d){
    if(!BF.movePools) return '';
    const allowed=BF.allowedElements(d), els=BF.elementsOf(d), pe=BF.partElements(d), pools=BF.movePools(d);
    const chip=(e,attr,on)=>{ const E=BF.ELEMENTS[e]; return `<button type="button" class="elchip${on?' on':''}" ${attr}="${e}" style="--c:${E.color}">${E.icon} ${E.label}</button>`; };
    const vs=e=>{ const E=BF.ELEMENTS[e]; return E.strong.map(x=>BF.ELEMENTS[x].icon).join(''); };
    const weak=Object.keys(BF.ELEMENTS).filter(x=>BF.elemMult([x],els)>1.01).map(x=>BF.ELEMENTS[x].icon).join('')||'—';
    const strong=[...new Set(els.flatMap(e=>BF.ELEMENTS[e].strong))].map(x=>BF.ELEMENTS[x].icon).join('');
    return `<div class="block kitblk"><div class="blk-title">Battle kit</div>
      <div class="optrow"><span>Type</span><div class="elrow">${allowed.map(e=>chip(e,'data-elp',els[0]===e)).join('')}</div></div>
      ${allowed.length>1?`<div class="optrow"><span>2nd type</span><div class="elrow">${allowed.filter(e=>e!==els[0]).map(e=>chip(e,'data-els',els[1]===e)).join('')}<button type="button" class="elchip${els[1]?'':' on'}" data-els="">None</button></div></div>`:''}
      <div class="fine">Strong vs ${strong} · weak to ${weak}. Your parts allow: ${Object.entries(pe).map(([k,e])=>`${BF.PART_LABEL[k]} ${BF.ELEMENTS[e].icon}`).join(' · ')}</div>
      <div class="kitmoves">${['blade','core','driver'].map(part=>`<div class="kitpart"><span>${BF.PART_LABEL[part]}</span>${pools[part].map(m=>`<div class="kitmv" style="--c:${BF.ELEMENTS[m.el].color}" title="${esc(BF.MOVE_KINDS[m.kind].desc)}"><i>${BF.ELEMENTS[m.el].icon}</i><b>${esc(m.name)}</b><em>${esc(BF.MOVE_KINDS[m.kind].desc)}</em></div>`).join('')}</div>`).join('')}</div>
      <div class="fine">Pick 1 move per part each launch. Change the blade shape, ratchet/disc or tip to get different moves.</div></div>`;
  },
  sheet(root,d,asm,mp,actions){
    const an=actions.an, nm=BF.naming(d, an.type);
    const typeCol={attack:'var(--pink)',defense:'var(--amber)',stamina:'var(--cyan)',balance:'var(--violet)'}[nm.type];
    const parts=mp.per.map(p=>{ const part=asm.parts.find(x=>x.id===p.id); const mats=[...new Set(part.bodies.map(b=>BF.MATERIALS[BF.partMaterial(d,part,b.role).mat].label))].join(' + ');
      return `<tr><td>${esc(p.label)}</td><td class="mono">${p.mass.toFixed(1)} g</td><td class="dim">${esc(mats)}${p.inserts?` · +${p.inserts.toFixed(1)} g metal`:''}</td></tr>`; }).join('');
    const checks=BF.Settings&&!BF.Settings.get('printChecks')?[]:[...asm.issues.map(i=>({...i,cat:'Geometry'})),...an.checks];
    const cats=['Thin walls','Overhangs','Balance','Weight'];
    const chips=cats.map(c=>{ const hits=checks.filter(x=>x.cat===c && x.lvl!=='info'); const lv=hits.some(h=>h.lvl==='bad')?'bad':hits.length?'warn':'ok'; return `<span class="chk ${lv}">${c}</span>`; }).join('');
    const issues=checks.sort((a,b)=>({bad:0,warn:1,info:2}[a.lvl]-{bad:0,warn:1,info:2}[b.lvl])).map(i=>`<li class="iss ${i.lvl}">${esc(i.msg)}</li>`).join('');
    const ex=actions.exportOpts;
    const spin=an.spin>=100?Math.round(an.spin)+' s':an.spin.toFixed(1)+' s';
    root.innerHTML=`
      <div class="idcard">
        <div class="id-type" style="--tc:${typeCol}">${nm.type.toUpperCase()} TYPE · ${d.system==='X'?'BEYBLADE X':'BURST'}</div>
        <div class="id-name">${esc(nm.name)}</div>
        <div class="id-code">${esc(nm.code)}</div>
        <div class="id-row">
          ${d.nameMode==='auto'?`<button class="chip" data-act="reroll">New name</button>`:''}
          <button class="chip" data-act="rename">${d.nameMode==='auto'?'Name it myself':'Use auto name'}</button>
        </div>
        ${d.nameMode==='manual'?`<input id="nameInput" class="txt" maxlength="28" value="${esc(d.name||nm.auto)}" placeholder="Bey name">`:''}
      </div>
      <div class="block statblock">
        ${this.hex(an.stats)}
        <div class="spinrow"><span>Est. spin time</span><b class="mono">${spin}</b></div>
        <div class="fine">Physics estimate from mass, inertia (${(mp.Izz/1000).toFixed(1)} g·cm²), tip friction and drag. Launch power, hits and stadium wear change real results.</div>
      </div>
      ${this.battleKit(d)}
      <div class="block">
        <div class="kv"><span>Total weight</span><b class="mono big">${mp.mass.toFixed(1)} g</b></div>
        <div class="kv"><span>Diameter</span><b class="mono">${(BF.mainPart(asm).meta.R*2).toFixed(1)} mm</b></div>
        <div class="kv"><span>Height</span><b class="mono">${asm.height.toFixed(1)} mm</b></div>
        <div class="kv"><span>Balance offset</span><b class="mono">${mp.offset<0.005?'0.00':mp.offset.toFixed(2)} mm</b></div>
        <table class="parts">${parts}</table>
        <div class="fine">Weights assume ${Math.round(d.print.infill*100)}% infill with solid walls.</div>
      </div>
      <div class="block">
        <div class="blk-title">Print check</div>
        <div class="chks">${chips}</div>
        ${issues?`<ul class="issues">${issues}</ul>`:''}
      </div>
      <div class="block exportblk">
        <div class="blk-title">Export for printing</div>
        <div class="optrow"><span>Format</span><div class="seg sm">${[['stl','STL'],['threemf','3MF']].map(([k,l])=>`<button type="button" class="${ex[k]?'on':''}" data-ex="${k}">${l}</button>`).join('')}</div></div>
        <div class="optrow"><span>Layout</span><div class="seg sm">${[['perPart','Per part'],['plate','One plate']].map(([k,l])=>`<button type="button" class="${ex[k]?'on':''}" data-ex="${k}">${l}</button>`).join('')}</div></div>
        <div class="optrow"><span>Split by color</span><button type="button" class="tog${ex.split?' on':''}" data-ex="split" aria-pressed="${ex.split}"><i></i></button></div>
        <button class="btn primary wide" data-act="export">Export files</button>
        <div class="fine">${BF.Store.status==='connected'?`Saves to ${esc(BF.Store.dir.name)}\\exports\\ with print notes.`:'Downloads a .zip — connect your folder to save straight to O:.'}</div>
      </div>
      <div class="block">
        <div class="blk-title">Have Claude model it</div>
        <button class="btn wide" data-act="prompt">Get Claude prompt</button>
      </div>
      <div class="block acts">
        <button class="btn primary" data-act="save">Save to library</button>
        <button class="btn" data-act="random">Surprise me</button>
      </div>
      <div class="block acts">
        <button class="btn" data-act="card">Bey card</button>
        <button class="btn" data-act="showcase">Showcase</button>
        <button class="btn" data-act="share">Share</button>
      </div>
      <div class="block">
        <div class="blk-title">Presets</div>
        <div class="presets">${BF.PRESETS.map(p=>`<button class="preset" data-preset="${p.id}"><b>${esc(p.name)}</b><span>${p.sys==='X'?'X':'Burst'} · ${esc(p.blurb)}</span></button>`).join('')}</div>
      </div>`;
    root.querySelectorAll('[data-act]').forEach(b=>b.addEventListener('click',()=>actions[b.dataset.act](b)));
    root.querySelectorAll('[data-ex]').forEach(b=>b.addEventListener('click',()=>actions.toggleEx(b.dataset.ex)));
    root.querySelectorAll('[data-elp]').forEach(b=>b.addEventListener('click',()=>actions.setEl('p',b.dataset.elp)));
    root.querySelectorAll('[data-els]').forEach(b=>b.addEventListener('click',()=>actions.setEl('s',b.dataset.els||null)));
    root.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>actions.preset(b.dataset.preset)));
    const ni=root.querySelector('#nameInput'); if(ni) ni.addEventListener('change',()=>actions.setName(ni.value));
  }
};
})();
