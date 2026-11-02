/* BeyForge — STL / 3MF export, print notes, Claude prompt */
(function(){
'use strict';
const BF=window.BF;
const ROLE_NAME={main:'body',accent:'accent',tip:'tip'};

// print-ready copy of a body's triangles: flipped if needed, sitting on z=0, centered
function printTris(part, roleFilter){
  let zmin=Infinity,zmax=-Infinity;
  part.bodies.forEach(b=>{ const p=b.geo.attributes.position.array; for(let i=2;i<p.length;i+=3){ zmin=Math.min(zmin,p[i]); zmax=Math.max(zmax,p[i]); } });
  const out=[];
  part.bodies.forEach(b=>{
    if(roleFilter && b.role!==roleFilter) return;
    const p=b.geo.attributes.position.array, a=new Float32Array(p.length);
    for(let i=0;i<p.length;i+=3){
      if(part.printFlip){ a[i]=p[i]; a[i+1]=-p[i+1]; a[i+2]=zmax-p[i+2]; }
      else { a[i]=p[i]; a[i+1]=p[i+1]; a[i+2]=p[i+2]-zmin; }
    }
    out.push({role:b.role, pos:a});
  });
  return out;
}
function concat(list){ let n=0; list.forEach(x=>n+=x.length); const o=new Float32Array(n); let k=0; list.forEach(x=>{ o.set(x,k); k+=x.length; }); return o; }
function offset(pos,dx,dy){ const o=new Float32Array(pos.length); for(let i=0;i<pos.length;i+=3){ o[i]=pos[i]+dx; o[i+1]=pos[i+1]+dy; o[i+2]=pos[i+2]; } return o; }
function bounds(pos){ let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity; for(let i=0;i<pos.length;i+=3){ x0=Math.min(x0,pos[i]); x1=Math.max(x1,pos[i]); y0=Math.min(y0,pos[i+1]); y1=Math.max(y1,pos[i+1]); } return {x0,y0,x1,y1}; }

BF.stl = function(pos, name){
  const n=pos.length/9, buf=new ArrayBuffer(84+n*50), dv=new DataView(buf);
  const head=('BeyForge '+(name||'')).slice(0,79); for(let i=0;i<head.length;i++) dv.setUint8(i,head.charCodeAt(i)&127);
  dv.setUint32(80,n,true); let o=84;
  for(let i=0;i<pos.length;i+=9){
    const ux=pos[i+3]-pos[i],uy=pos[i+4]-pos[i+1],uz=pos[i+5]-pos[i+2],vx=pos[i+6]-pos[i],vy=pos[i+7]-pos[i+1],vz=pos[i+8]-pos[i+2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const l=Math.hypot(nx,ny,nz)||1;
    dv.setFloat32(o,nx/l,true); dv.setFloat32(o+4,ny/l,true); dv.setFloat32(o+8,nz/l,true); o+=12;
    for(let k=0;k<9;k++){ dv.setFloat32(o,pos[i+k],true); o+=4; }
    dv.setUint16(o,0,true); o+=2;
  }
  return new Uint8Array(buf);
};

function meshXML(pos){
  const map=new Map(), verts=[], tris=[];
  const vid=(x,y,z)=>{ const k=x.toFixed(4)+','+y.toFixed(4)+','+z.toFixed(4); let id=map.get(k); if(id===undefined){ id=verts.length; map.set(k,id); verts.push(`<vertex x="${x.toFixed(4)}" y="${y.toFixed(4)}" z="${z.toFixed(4)}"/>`); } return id; };
  for(let i=0;i<pos.length;i+=9){ const a=vid(pos[i],pos[i+1],pos[i+2]), b=vid(pos[i+3],pos[i+4],pos[i+5]), c=vid(pos[i+6],pos[i+7],pos[i+8]); if(a!==b&&b!==c&&a!==c) tris.push(`<triangle v1="${a}" v2="${b}" v3="${c}"/>`); }
  return `<mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh>`;
}
const xmlEsc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// groups: [{name, bodies:[{name,color,pos}]}] -> one 3MF; each group is an object built from colored parts
BF.threeMF = async function(groups, title){
  const colors=[]; const cidx=c=>{ c=c.toUpperCase(); let i=colors.indexOf(c); if(i<0){ i=colors.length; colors.push(c); } return i; };
  let id=2; const objs=[], items=[];
  groups.forEach(g=>{
    const comps=[];
    g.bodies.forEach(b=>{ const oid=id++; objs.push(`<object id="${oid}" type="model" name="${xmlEsc(b.name)}" pid="1" pindex="${cidx(b.color)}">${meshXML(b.pos)}</object>`); comps.push(oid); });
    if(comps.length===1) items.push(`<item objectid="${comps[0]}"/>`);
    else { const gid=id++; objs.push(`<object id="${gid}" type="model" name="${xmlEsc(g.name)}"><components>${comps.map(c=>`<component objectid="${c}"/>`).join('')}</components></object>`); items.push(`<item objectid="${gid}"/>`); }
  });
  const model=`<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Title">${xmlEsc(title)}</metadata><metadata name="Application">BeyForge</metadata>
<resources><basematerials id="1">${colors.map((c,i)=>`<base name="Color ${i+1}" displaycolor="${c}FF"/>`).join('')}</basematerials>${objs.join('')}</resources><build>${items.join('')}</build></model>`;
  const zip=new JSZip();
  zip.file('[Content_Types].xml','<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>');
  zip.file('_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>');
  zip.file('3D/3dmodel.model',model);
  return await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
};

// Build every file for an export. opts: {stl, threemf, perPart, plate, split}
BF.buildExport = async function(asm, opts){
  const d=asm.d, nm=BF.naming(d), slug=BF.Store.slug(nm.full), files=[];
  const parts=asm.parts.map(part=>{
    const tris=printTris(part);
    const bodies=tris.map(t=>({role:t.role, pos:t.pos, color:BF.partMaterial(d,part,t.role).color, name:`${part.label} ${ROLE_NAME[t.role]}`}));
    return {part, bodies, all:concat(tris.map(t=>t.pos))};
  });
  if(opts.perPart){
    for(const p of parts){
      const base=`${slug}_${p.part.id}`;
      if(opts.stl){
        if(opts.split && p.bodies.length>1) p.bodies.forEach(b=>files.push({name:`${base}_${ROLE_NAME[b.role]}.stl`, data:BF.stl(b.pos,b.name)}));
        else files.push({name:`${base}.stl`, data:BF.stl(p.all,p.part.label)});
      }
      if(opts.threemf){
        const bodies=opts.split?p.bodies:[{name:p.part.label,color:p.bodies[0].color,pos:p.all}];
        files.push({name:`${base}.3mf`, data:await BF.threeMF([{name:p.part.label,bodies}], `${nm.full} — ${p.part.label}`)});
      }
    }
  }
  if(opts.plate){
    // lay parts out in a row, 8 mm apart, centered on the bed
    let x=0; const placed=[];
    parts.forEach(p=>{ const b=bounds(p.all); const dx=x-b.x0, dy=-(b.y0+b.y1)/2; placed.push({p,dx,dy}); x+=b.x1-b.x0+8; });
    const shift=-(x-8)/2;
    const groups=placed.map(({p,dx,dy})=>({name:p.part.label, bodies:(opts.split?p.bodies:[{name:p.part.label,color:p.bodies[0].color,pos:p.all}]).map(b=>({...b,pos:offset(b.pos,dx+shift,dy)}))}));
    if(opts.stl){
      if(opts.split){ const byRole={}; groups.forEach(g=>g.bodies.forEach(b=>{ const r=b.role||'main'; (byRole[r]=byRole[r]||[]).push(b.pos); })); Object.entries(byRole).forEach(([r,list])=>files.push({name:`${slug}_plate_${ROLE_NAME[r]}.stl`, data:BF.stl(concat(list),'plate '+r)})); }
      else files.push({name:`${slug}_plate.stl`, data:BF.stl(concat(groups.flatMap(g=>g.bodies.map(b=>b.pos))),'plate')});
    }
    if(opts.threemf) files.push({name:`${slug}_plate.3mf`, data:await BF.threeMF(groups, nm.full)});
  }
  files.push({name:`${slug}_print-notes.txt`, data:BF.printNotes(asm)});
  files.push({name:`${slug}.bey.json`, data:JSON.stringify(d,null,1)});
  return {slug, files};
};

BF.printNotes = function(asm){
  const d=asm.d, nm=BF.naming(d), mp=BF.massProps(asm), D=asm.D;
  const L=[`${nm.full}`, `${d.system==='X'?'Beyblade X':'Burst'} · ${d.spin} spin · made in BeyForge`, ''];
  L.push('PARTS');
  asm.parts.forEach(p=>{ const mats=[...new Set(p.bodies.map(b=>{ const m=BF.partMaterial(d,p,b.role); return `${BF.MATERIALS[m.mat].label} ${m.color}`; }))].join(' + ');
    L.push(`- ${p.label}: ${mats}. Print ${p.printFlip?'upside-down (flat face on the bed)':'flat side down'}.`); });
  L.push('', 'SETTINGS', `- Layer height 0.12–0.16 mm, 4 walls, ${Math.round(d.print.infill*100)}% infill on the ${BF.mainPart(asm).label.toLowerCase()} (100% on small parts).`,
    `- Fit tolerance baked in: ${d.print.tolerance} mm. If parts are too tight, raise it in Print & fit and re-export.`,
    '- Multicolor files share one origin: load them together as one object and assign each to a toolhead.');
  const ins=BF.INSERTS[d.weights.insert]; const cnt=asm.parts.reduce((s,p)=>s+(p.inserts||[]).length,0);
  if(cnt) L.push('', 'INSERTS', `- ${cnt} × ${ins.label} (${(ins.mass*cnt).toFixed(1)} g). Pockets open on the underside: press in, add a drop of CA glue.`);
  L.push('', 'ESTIMATES', `- Total ${mp.mass.toFixed(1)} g · ${(BF.mainPart(asm).meta.R*2).toFixed(1)} mm wide · ${asm.height.toFixed(1)} mm tall`);
  return L.join('\r\n');
};

BF.claudePrompt = function(asm, an){
  const d=asm.d, nm=BF.naming(d, an&&an.type), D=asm.D, b=d.blade, isX=d.system==='X', tip=BF.TIPS[d.bit.tip];
  const mp=BF.massProps(asm); const bm=BF.mainPart(asm).meta;
  const lines=[
`I designed a custom ${isX?'Beyblade X':'Beyblade Burst'} called "${nm.full}" in my BeyForge app and want a clean, printable 3D model of it for my Flashforge Creator 5 Pro. Please write a fully parametric OpenSCAD file (every number below as a variable at the top) that outputs each part as a separate printable body, oriented for printing, with no supports needed where possible. Units are millimeters.`,
'',
`OVERALL: ${an?an.type+' type, ':''}${d.spin} spin${d.spin==='dual'?' (wings symmetric front and back)':''}, ${(bm.R*2).toFixed(1)} mm max diameter, ${asm.height.toFixed(1)} mm assembled height, target weight ≈ ${mp.mass.toFixed(1)} g.`,
'',
`${isX?'BLADE':'LAYER'}:`,
`- ${Math.round(b.wings)} contact points, wing shape "${b.shape}"${b.shape==='custom'?` (wing silhouette as 24 height samples from leading to trailing edge, 0–1: ${b.custom.map(v=>(+v).toFixed(2)).join(', ')})`:''}.`,
`- Outer diameter ${b.diameter} mm, solid core radius ${bm.Rcore.toFixed(1)} mm, each wing spans ${Math.round((b.shape==='ring'?1:b.wingWidth)*360/Math.round(b.wings))}° of arc, sharp leading edge strikes first.`,
`- Wings swept ${b.sweep}° at the tips, edges softened ~${b.soft}°, contact surface angled ${b.slope}° (${b.slope>=0?'upper attack — top edge set back':'lower attack — top edge sticks out'}).`,
`- Core height ${bm.H.toFixed(1)} mm, top surface slopes down to ${bm.tipZ.toFixed(1)} mm thick at the wing tips. Flat bottom.`,
!d.symmetry?`- Asymmetric: per-wing length scale ${b.wingScale.slice(0,Math.round(b.wings)).map(v=>(+v).toFixed(2)).join(', ')}; angle shifts ${b.wingShift.slice(0,Math.round(b.wings)).join(', ')}°.`:null,
isX?`- Center hole Ø${(D.plugR*2+D.tol*2).toFixed(2)} mm with 3 notches (${D.tabDeg+4}° wide, ${(D.tabDepth+D.tol).toFixed(2)} mm deep) that key onto the ratchet plug.`
   :`- Center hole Ø${(D.bShaftR*2+D.tol*2).toFixed(2)} mm with ${d.lock.teeth} notches (${(D.prongDeg+5-d.lock.strength*0.9).toFixed(1)}° wide, ${(D.prongDepth+D.tol).toFixed(2)} mm deep) for the driver's lock prongs — narrower notches = tighter burst lock.`,
d.deco.emblem!=='none'?`- Raised "${d.deco.emblem}" emblem (0.5 mm tall) on top of each wing, about ${Math.round(d.deco.emblemSize*100)}% of the wing's width.`:null,
d.deco.text?`- Raised lettering "${d.deco.text.toUpperCase()}" curved around the top of the core, 0.5 mm tall.`:null,
d.deco.texture!=='none'?`- Surface texture: ${d.deco.textureCount}× raised ${d.deco.texture} per wing.`:null,
(BF.mainPart(asm).inserts||[]).length?`- ${BF.mainPart(asm).inserts.length} blind pockets on the underside for ${BF.INSERTS[d.weights.insert].label}s (Ø${(BF.INSERTS[d.weights.insert].dia+2*D.tol).toFixed(2)} mm, ${BF.INSERTS[d.weights.insert].depth} mm deep), evenly spaced ${Math.hypot(BF.mainPart(asm).inserts[0].x,BF.mainPart(asm).inserts[0].y).toFixed(1)} mm from center.`:null,
'',
isX?`RATCHET: ${d.ratchet.points}-${d.ratchet.height} — ring Ø${(D.ratchetR*2).toFixed(1)} mm, ${(d.ratchet.height/10).toFixed(1)} mm tall, with ${d.ratchet.points} sawtooth contact points sticking out ${D.ratchetTooth} mm. On top: a Ø${(D.plugR*2).toFixed(1)} mm plug, ${D.plugH} mm tall, with 3 tabs (${D.tabDeg}°, ${D.tabDepth} mm) that lock into the blade. Center socket Ø${(D.shaftR*2+D.tol*2).toFixed(2)} mm with 2 key slots for the bit shaft.`
   :`DISC: ${BF.discCode(d)} — ${d.disc.shape} outline${['star','wing','gear'].includes(d.disc.shape)?` with ${d.disc.lobes} lobes`:''}, Ø${d.disc.diameter} mm, ${d.disc.thickness} mm thick${d.disc.rim>0.07?`, plus a ${(d.disc.rim*3).toFixed(1)} mm rim hanging below the outer edge for rim weight`:''}. Center hole Ø${(D.bShaftR*2+D.tol*2).toFixed(2)} mm with 2 key slots.${(asm.parts.find(p=>p.id==='disc').inserts||[]).length?` ${asm.parts.find(p=>p.id==='disc').inserts.length} through-pockets for ${BF.INSERTS[d.weights.insert].label}s.`:''}`,
'',
`${isX?'BIT':'DRIVER'}: ${tip.label} tip (${isX?tip.x:tip.burst}) — contact Ø${d.bit.width} mm, tip section ${d.bit.tipLen} mm tall, body Ø${((isX?D.bitBodyR:D.drvBodyR)*2).toFixed(1)} mm. Keyed shaft Ø${((isX?D.shaftR:D.bShaftR)*2).toFixed(1)} mm with 2 keys.${!isX?` ${d.lock.teeth} lock prongs (${D.prongDepth} mm out, ${D.prongH} mm tall) at the top of the shaft.`:''}${isX&&d.bit.gear?` Xtreme Dash gear ring with ${d.bit.gearTeeth} teeth around the body.`:''}${BF.TIPS[d.bit.tip].rubber||d.bit.tipMaterial==='TPU'?' The tip is a separate TPU part that press-fits on.':''}`,
'',
`PRINT: ${d.print.tolerance} mm clearance on every fit. Colors — ${isX?'blade':'layer'} ${d.blade.color}, accents ${d.deco.accent}, ${isX?'ratchet '+d.ratchet.color:'disc '+d.disc.color}, ${isX?'bit':'driver'} ${d.bit.color}, tip ${d.bit.tipColor}. Keep emblems/text as separate bodies so I can print them in a second color.`,
'',
`I've also exported STL/3MF files from BeyForge for this design; I can attach them if a reference helps. Make it look sharp and competition-ready while keeping the measurements above.`
  ];
  return lines.filter(l=>l!==null).join('\n').replace(/\n{3,}/g,'\n\n');
};

// Save files: into the connected folder (exports/<slug>/), else as a .zip download
BF.saveExport = async function(result){
  if(BF.Store.status==='connected'){
    for(const f of result.files) await BF.Store.write(`exports/${result.slug}/${f.name}`, f.data);
    return {where:`${BF.Store.dir.name}\\exports\\${result.slug}`, count:result.files.length};
  }
  const zip=new JSZip(); result.files.forEach(f=>zip.file(f.name,f.data));
  const blob=await zip.generateAsync({type:'blob'}); const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=result.slug+'.zip'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  return {where:'Downloads ('+result.slug+'.zip)', count:result.files.length};
};
})();
