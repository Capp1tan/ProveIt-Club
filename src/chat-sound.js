// Audio corto sintetizado, sin archivos externos. El navegador necesita un gesto
// del usuario para habilitar AudioContext. Nunca reproducimos el historial.
const preference='proveit:chat-sound';
let enabled=true,audio,lastPlayed=0;
try{enabled=localStorage.getItem(preference)!=='off';}catch{}
const buttons=new Set();
async function unlock(){
 if(!enabled)return;
 try{const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return;audio ||=new Audio();if(audio.state!=='running')await audio.resume();}catch{/* La interfaz sigue funcionando sin audio. */}
}
document.addEventListener('pointerdown',()=>void unlock());document.addEventListener('keydown',()=>void unlock());
export function playMessageSound(){
 if(!enabled || !audio || audio.state!=='running' || Date.now()-lastPlayed<600)return;
 lastPlayed=Date.now();
 try{for(const [offset,frequency] of [[0,740],[0.105,988]]){const tone=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+offset;tone.type='sine';tone.frequency.value=frequency;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(0.055,start+0.012);gain.gain.exponentialRampToValueAtTime(0.001,start+0.16);tone.connect(gain);gain.connect(audio.destination);tone.start(start);tone.stop(start+0.18);tone.addEventListener('ended',()=>{tone.disconnect();gain.disconnect();},{once:true});}}catch{}
}
function render(){for(const button of buttons){const label=enabled?'Silenciar sonido de mensajes':'Activar sonido de mensajes';button.setAttribute('aria-label',label);button.title=label;button.setAttribute('aria-pressed',String(enabled));button.dataset.sound=enabled?'on':'off';button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4Z" stroke-linejoin="round"/>'+(enabled?'<path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke-linecap="round"/>':'<path d="m17 9 5 6m0-6-5 6" stroke-linecap="round"/>')+'</svg>';}}
export function chatSoundButton(){const button=document.createElement('button');button.type='button';button.className='chat-sound-toggle';buttons.add(button);button.addEventListener('click',()=>{enabled=!enabled;try{localStorage.setItem(preference,enabled?'on':'off');}catch{}render();if(enabled)void unlock();});render();return button;}
window.addEventListener('storage',event=>{if(event.key===preference){enabled=event.newValue!=='off';render();}});
