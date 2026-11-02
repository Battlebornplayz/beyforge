/* BeyForge — online play over WebRTC (PeerJS). Host runs the physics; the guest renders host snapshots. */
(function(){
'use strict';
const BF=window.BF;
const PREFIX='beyforge-v3-';
const LETTERS='ABCDEFGHJKMNPQRSTUVWXYZ';
const code4=()=>Array.from({length:4},()=>LETTERS[Math.floor(Math.random()*LETTERS.length)]).join('');

BF.Net = {
  peer:null, conn:null, role:null, code:null, handlers:{}, status:'off',
  on(type,fn){ this.handlers[type]=fn; },
  emit(type,data){ const f=this.handlers[type]; if(f) f(data); },
  setStatus(s,info){ this.status=s; this.emit('status',{s,info}); },
  available(){ return typeof window.Peer==='function'; },
  host(){
    this.close(); this.role='host'; this.code=code4(); this.setStatus('connecting');
    const p=this.peer=new Peer(PREFIX+this.code,{debug:0});
    p.on('open',()=>this.setStatus('waiting',this.code));
    p.on('connection',c=>{ if(this.conn){ c.close(); return; } this.bind(c); });
    p.on('error',e=>{ if(e.type==='unavailable-id') return this.host(); this.setStatus('error',friendly(e)); });
  },
  join(code){
    this.close(); this.role='guest'; this.code=code.toUpperCase().trim(); this.setStatus('connecting');
    const p=this.peer=new Peer({debug:0});
    p.on('open',()=>{ const c=p.connect(PREFIX+this.code,{reliable:true}); this.bind(c);
      setTimeout(()=>{ if(this.status==='connecting') this.setStatus('error','No match found for code '+this.code+'. Check the code and that the host is still on the lobby screen.'); },9000); });
    p.on('error',e=>this.setStatus('error',friendly(e)));
  },
  bind(c){
    this.conn=c;
    c.on('open',()=>this.setStatus('connected'));
    c.on('data',m=>{ if(m && m.t) this.emit(m.t,m); });
    c.on('close',()=>{ this.conn=null; this.setStatus('closed'); });
    c.on('error',()=>this.setStatus('error','Connection dropped.'));
  },
  send(m){ if(this.conn && this.conn.open) this.conn.send(m); },
  close(){ try{ if(this.conn) this.conn.close(); }catch(e){} try{ if(this.peer) this.peer.destroy(); }catch(e){} this.conn=null; this.peer=null; this.role=null; this.status='off'; }
};
function friendly(e){
  const t=e&&e.type;
  if(t==='peer-unavailable') return 'No match with that code. Check the code and that the host is still waiting.';
  if(t==='network'||t==='server-error'||t==='socket-error') return 'Can’t reach the matchmaking server. Check your internet connection.';
  if(t==='browser-incompatible') return 'This browser doesn’t support online play.';
  return 'Online error: '+(e&&e.message||t||'unknown');
}
})();
