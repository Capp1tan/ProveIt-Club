import {competitionState} from '../shared/competition.ts';
import './tournament-draw-reveal.css';

export const FIRST_BOOM_SECONDS = 3.9;
export const FINAL_BOOM_SECONDS = 9;
const SHUFFLE_INTERVAL_SECONDS = 0.06;
const STRUCTURE_BUILD_SECONDS = 1.7;
const AUDIO_URL = '/audio/tournament-draw.mp3';
const seenDraws = new Set();
let activeReveal;

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => {const p=clamp(value);return p*p*(3-2*p);};

export function cancelDrawReveal(){activeReveal?.();}

export function animateDraw(t, section, accountId){
  const state=competitionState(t);
  if(!accountId || !state.drawnAt || t.winnerProfileId || t.status==='COMPLETED' || document.hidden || section.dataset.revealing)return;
  const key='proveit:draw-viewed:'+accountId+':'+t.id+':'+state.drawnAt;
  if(seenDraws.has(key))return;
  try{if(localStorage.getItem(key))return;}catch{}
  const board=section.querySelector('.draw-board'),status=section.querySelector('.bracket-reveal-status');
  if(!board || !status)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  if(reduced.matches)return;
  cancelDrawReveal();

  const slots=[...board.querySelectorAll('.draw-player')];
  const names=[...board.querySelectorAll('[data-player-id] .participant-name')];
  const originalNames=names.map(node=>node.textContent);
  const paths=[...board.querySelectorAll('.bracket-connections path')];
  const contestants=[...new Set(t.participantNames || originalNames)];
  const outlines=[];
  const layers=[...document.querySelectorAll('header.topbar, #tournamentDetail > :not(#tournamentDraw):not(:has(#tournamentDraw)), .bracket-stage-heading, #tournamentChat')];
  const priorInert=layers.map(node=>node.inert),priorBoardInert=board.inert;
  const originalStatus=status.textContent;
  const listeners=new AbortController();
  const audio=new Audio(AUDIO_URL);
  audio.preload='auto';
  let frame=0,ended=false,locked=false,marked=false,lastShuffle=-1;
  let clockMode='pending',elapsed=0,clockStart=performance.now(),resumeAudio=false;
  let lastFocus=-1;
  const soundButton=document.createElement('button');
  soundButton.type='button';soundButton.className='format-choice draw-reveal-sound';soundButton.textContent='Activar audio';soundButton.hidden=true;
  section.querySelector('.bracket-reveal-header')?.append(soundButton);
  const ns='http://www.w3.org/2000/svg';
  for(const slot of slots){
    const svg=document.createElementNS(ns,'svg'),rect=document.createElementNS(ns,'rect');
    svg.classList.add('draw-slot-outline');svg.setAttribute('aria-hidden','true');
    rect.setAttribute('pathLength','1');rect.setAttribute('rx','8');rect.setAttribute('x','.75');rect.setAttribute('y','.75');svg.append(rect);slot.append(svg);
    outlines.push(rect);
    if(slot.querySelector('.draw-self'))slot.classList.add('draw-self-slot');
  }
  const starts=slots.map((slot,index)=>{
    const column=[...board.querySelectorAll('.draw-round')].indexOf(slot.closest('.draw-round'));
    return Math.min(column*.42+index*.045,1.12);
  });
  function sizeOutlines(){
    for(let i=0;i<slots.length;i++){
      outlines[i].setAttribute('width',Math.max(0,slots[i].clientWidth-1.5));
      outlines[i].setAttribute('height',Math.max(0,slots[i].clientHeight-1.5));
    }
  }
  const observer=new ResizeObserver(sizeOutlines);
  for(const slot of slots)observer.observe(slot);
  const removal=new MutationObserver(()=>{if(!section.isConnected)cleanup();});
  removal.observe(document.body,{childList:true,subtree:true});

  function seconds(){return clockMode==='audio'?audio.currentTime:clockMode==='silent'?elapsed+(performance.now()-clockStart)/1000:0;}
  function silentClock(){
    if(ended)return;
    elapsed=clockMode==='audio'?audio.currentTime:seconds();clockStart=performance.now();clockMode='silent';
    audio.pause();soundButton.hidden=locked;
  }
  function focus(time){
    let p=smooth(time/3.6);
    if(time>FINAL_BOOM_SECONDS+.7)p*=1-smooth((time-FINAL_BOOM_SECONDS-.7)/1.4);
    if(Math.abs(p-lastFocus)<.002)return;
    lastFocus=p;
    document.body.style.setProperty('--draw-room-opacity',1-p*.76);
    document.body.style.setProperty('--draw-room-blur',p*2.2+'px');
    section.style.setProperty('--draw-focus-rise',-p*8+'px');
    section.style.setProperty('--draw-focus-glow',p*.13);
  }
  function structure(time){
    const elapsed=Math.min(time-FIRST_BOOM_SECONDS,STRUCTURE_BUILD_SECONDS);
    for(let i=0;i<slots.length;i++){
      const p=clamp((elapsed-starts[i])/.48);
      slots[i].style.setProperty('--draw-outline',1-p);
      slots[i].style.setProperty('--draw-slot-opacity',clamp(p*4));
      slots[i].style.setProperty('--draw-slot-fill',smooth((p-.25)/.75));
      slots[i].style.setProperty('--draw-slot-y',(1-p)*8+'px');
      slots[i].style.setProperty('--draw-slot-scale',.96+p*.04);
      slots[i].style.setProperty('--draw-name-opacity',clamp((elapsed-starts[i]-.44)/.15));
    }
    for(let i=0;i<paths.length;i++){
      const p=clamp((elapsed-.65-Math.min(i*.035,.35))/.6);
      paths[i].style.setProperty('--draw-line-dash',1-p);
      paths[i].style.setProperty('--draw-line-opacity',p>0?1:0);
    }
  }
  function markSeen(){
    if(marked || document.hidden || !section.isConnected)return;
    marked=true;seenDraws.add(key);try{localStorage.setItem(key,'1');}catch{}
  }
  function cleanup(){
    if(ended)return;
    ended=true;cancelAnimationFrame(frame);clearTimeout(startDeadline);
    audio.pause();audio.removeAttribute('src');audio.load();listeners.abort();observer.disconnect();removal.disconnect();
    for(let i=0;i<names.length;i++)names[i].textContent=originalNames[i];
    for(const rect of outlines)rect.parentElement.remove();
    for(const slot of slots){for(const property of ['--draw-outline','--draw-slot-opacity','--draw-slot-fill','--draw-slot-y','--draw-slot-scale','--draw-name-opacity'])slot.style.removeProperty(property);}
    for(const path of paths){path.style.removeProperty('--draw-line-dash');path.style.removeProperty('--draw-line-opacity');}
    for(let i=0;i<layers.length;i++)layers[i].inert=priorInert[i];
    board.inert=priorBoardInert;status.textContent=originalStatus;soundButton.remove();
    delete section.dataset.revealing;delete section.dataset.drawPhase;section.classList.remove('draw-reveal-paused');
    section.style.removeProperty('--draw-focus-rise');section.style.removeProperty('--draw-focus-glow');
    document.body.classList.remove('draw-cinematic');
    document.body.style.removeProperty('--draw-room-opacity');document.body.style.removeProperty('--draw-room-blur');
    if(activeReveal===cleanup)activeReveal=undefined;
  }
  function tick(){
    if(ended)return;
    if(!section.isConnected){cleanup();return;}
    const time=seconds();focus(time);
    if(time>=FINAL_BOOM_SECONDS){
      if(!locked){
        locked=true;section.dataset.drawPhase='locked';
        for(let i=0;i<names.length;i++)names[i].textContent=originalNames[i];
        status.textContent='Cruces sorteados';soundButton.hidden=true;
      }
      if(time>=FINAL_BOOM_SECONDS+.6)markSeen();
      const finishAt=Number.isFinite(audio.duration)?Math.max(audio.duration,FINAL_BOOM_SECONDS+2.3):FINAL_BOOM_SECONDS+2.3;
      if(time>=finishAt){cleanup();return;}
    }else if(time>=FIRST_BOOM_SECONDS){
      if(section.dataset.drawPhase!=='shuffle'){section.dataset.drawPhase='shuffle';status.textContent='Sorteando cruces';}
      structure(time);
      const step=Math.floor((time-FIRST_BOOM_SECONDS)/SHUFFLE_INTERVAL_SECONDS);
      if(step!==lastShuffle){lastShuffle=step;for(let i=0;i<names.length;i++)names[i].textContent=contestants[Math.floor(Math.random()*contestants.length)];}
    }
    frame=requestAnimationFrame(tick);
  }
  async function play(){
    try{
      await audio.play();
      if(ended){audio.pause();return;}
      clearTimeout(startDeadline);
      if(clockMode==='silent')audio.currentTime=seconds();
      clockMode='audio';soundButton.hidden=true;
      if(document.hidden){resumeAudio=true;audio.pause();}
    }catch{silentClock();}
  }
  soundButton.addEventListener('click',()=>void play(),{signal:listeners.signal});
  audio.addEventListener('error',silentClock,{signal:listeners.signal});
  audio.addEventListener('ended',()=>{if(!locked)silentClock();},{signal:listeners.signal});
  document.addEventListener('visibilitychange',()=>{
    if(ended)return;
    if(document.hidden){
      elapsed=seconds();resumeAudio=clockMode==='audio'&&!audio.paused;audio.pause();cancelAnimationFrame(frame);section.classList.add('draw-reveal-paused');
    }else{
      section.classList.remove('draw-reveal-paused');clockStart=performance.now();
      if(resumeAudio){resumeAudio=false;void play();}
      frame=requestAnimationFrame(tick);
    }
  },{signal:listeners.signal});
  reduced.addEventListener('change',()=>{if(reduced.matches){markSeen();cleanup();}},{signal:listeners.signal});
  window.addEventListener('pagehide',cleanup,{signal:listeners.signal});
  activeReveal=cleanup;section.dataset.revealing='true';section.dataset.drawPhase='anticipation';
  board.inert=true;document.body.classList.add('draw-cinematic');
  for(const layer of layers)layer.inert=true;
  status.textContent='Sorteo de participantes';
  focus(0);sizeOutlines();
  section.scrollIntoView({behavior:'smooth',block:'center'});
  const startDeadline=setTimeout(()=>{if(clockMode==='pending')silentClock();},2000);
  void play();frame=requestAnimationFrame(tick);
}
