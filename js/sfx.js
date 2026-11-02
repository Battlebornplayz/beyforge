/* BeyForge — synthesized sound effects (no audio files). Starts after the first tap, as browsers require. */
(function(){
'use strict';
const BF=window.BF;
let ctx=null, master=null, revOsc=null, revGain=null, lastClash=0;
const muted=()=>BF.LS.get('bf.muted',false)||(BF.Settings&&!BF.Settings.get('sound'));
function ac(){ if(muted()) return null; if(!ctx){ try{ ctx=new (window.AudioContext||window.webkitAudioContext)(); master=ctx.createGain(); master.gain.value=BF.Settings?BF.Settings.get('volume'):0.5; BF.Settings&&BF.Settings.on(k=>{ if(k==='volume'&&master) master.gain.value=BF.Settings.get('volume'); }); master.connect(ctx.destination); }catch(e){ return null; } } if(ctx.state==='suspended') ctx.resume(); return ctx; }
function noise(dur){ const c=ac(); const b=c.createBuffer(1,Math.floor(c.sampleRate*dur),c.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; const s=c.createBufferSource(); s.buffer=b; return s; }
function env(g,t,a,peak,dec){ g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(peak,t+a); g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec); }
function tone(type,f0,f1,dur,vol){ const c=ac(); if(!c) return; const t=c.currentTime, o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur); env(g,t,0.01,vol,dur); o.connect(g).connect(master); o.start(t); o.stop(t+dur+0.05); }
function hiss(dur,freq,vol,q){ const c=ac(); if(!c) return; const t=c.currentTime, n=noise(dur), f=c.createBiquadFilter(), g=c.createGain(); f.type='bandpass'; f.frequency.value=freq; f.Q.value=q||1; env(g,t,0.005,vol,dur); n.connect(f).connect(g).connect(master); n.start(t); }

BF.Sfx = {
  // punchy menu sounds
  ui(kind){ if(BF.Settings&&BF.Settings.get('uiSounds')===false) return;
    if(kind==='click'){ tone('square',1400,900,0.035,0.05); hiss(0.03,5000,0.04,2); }
    else if(kind==='tab'){ hiss(0.16,1800,0.07,0.8); tone('sine',500,900,0.12,0.035); }
    else if(kind==='coin'){ tone('square',1568,1568,0.06,0.05); setTimeout(()=>tone('square',2093,2093,0.12,0.05),60); }
    else if(kind==='open'){ hiss(0.2,2600,0.06,1.2); tone('triangle',300,700,0.18,0.05); }
    else if(kind==='close'){ tone('triangle',600,300,0.12,0.04); } },
  get muted(){ return muted(); },
  toggle(){ BF.LS.set('bf.muted',!muted()); if(muted()&&revGain){ this.rev(false); } return muted(); },
  beep(go){ tone('square',go?880:520,go?1320:520,go?0.35:0.12,0.18); },
  rev(on){
    const c=ac(); if(!c) return;
    if(on){ revOsc=c.createOscillator(); revGain=c.createGain(); revOsc.type='sawtooth'; revOsc.frequency.setValueAtTime(90,c.currentTime); revOsc.frequency.linearRampToValueAtTime(420,c.currentTime+1.3);
      const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1400; revGain.gain.value=0.07; revOsc.connect(f).connect(revGain).connect(master); revOsc.start(); }
    else if(revOsc){ const t=c.currentTime; revGain.gain.exponentialRampToValueAtTime(0.0001,t+0.1); revOsc.stop(t+0.12); revOsc=null; }
  },
  rip(){ hiss(0.45,2400,0.35,0.7); tone('sawtooth',300,1400,0.35,0.08); },
  clash(s){ const now=performance.now(); if(now-lastClash<45) return; lastClash=now; const v=Math.min(0.5,0.08+s/5000); hiss(0.12,3200+Math.random()*1500,v,2.5); tone('triangle',1800+Math.random()*900,600,0.09,v*0.5); },
  dash(){ hiss(0.3,5200,0.12,4); tone('sine',600,1600,0.25,0.06); },
  move(kind){ tone('sawtooth',260,1300,0.32,0.11); hiss(0.35,2400,0.16,3); setTimeout(()=>tone('square',880,1760,0.12,0.06),140); },
  status(){ tone('triangle',520,260,0.18,0.07); },
  click(n){ tone('square',1400+(n||1)*400,900,0.05,0.12); setTimeout(()=>tone('square',1100+(n||1)*400,700,0.04,0.09),55); },
  burst(){ hiss(0.7,900,0.6,0.6); tone('square',220,40,0.6,0.25); setTimeout(()=>hiss(0.4,3000,0.3,1.5),80); },
  finish(how){ const notes={spin:[523,659],over:[523,784,1046],burst:[392,523,784,1046],xtreme:[523,659,784,1046,1318]}[how]||[523,784];
    notes.forEach((n,i)=>setTimeout(()=>tone('square',n,n,0.16,0.12),i*95)); },
  click(){ tone('sine',900,700,0.05,0.05); }
};
})();
