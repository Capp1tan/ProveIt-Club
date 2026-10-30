import '../home-carousel.css';

// Editá las fotos y sus textos alternativos en index.html. Este módulo sólo navega.
const root=document.querySelector('[data-home-carousel]');
if(root){
 const slides=[...root.querySelectorAll('[data-carousel-slide]')],dots=[...root.querySelectorAll('[data-carousel-dot]')];
 const pause=root.querySelector('[data-carousel-pause]'),status=root.querySelector('[data-carousel-status]');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let current=0,timer,request=0,paused=false,hover=false,visible=true,touchX;
 root.querySelectorAll('[data-carousel-controls]').forEach(n=>n.hidden=false);
 function schedule(){clearTimeout(timer);if(!paused&&!hover&&visible&&!document.hidden&&!reduced.matches)timer=setTimeout(()=>void go(current+1),4000);}
 function stop(){paused=true;pause.firstElementChild.textContent='▷';pause.setAttribute('aria-pressed','true');pause.setAttribute('aria-label','Reanudar cambio automático de imágenes');schedule();}
 async function go(index,manual=false){
  if(manual)stop();const next=(index+slides.length)%slides.length,token=++request;
  try{await slides[next].querySelector('img').decode();}catch{schedule();return;}
  if(token!==request)return;
  slides.forEach((slide,i)=>{slide.classList.toggle('is-active',i===next);slide.setAttribute('aria-hidden',String(i!==next));});
  dots.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===next)));
  current=next;if(manual)status.textContent=slides[next].dataset.carouselSlide;schedule();
 }
 dots.forEach((button,i)=>button.addEventListener('click',()=>void go(i,true)));
 root.querySelector('[data-carousel-prev]').addEventListener('click',()=>void go(current-1,true));
 root.querySelector('[data-carousel-next]').addEventListener('click',()=>void go(current+1,true));
 pause.addEventListener('click',()=>{if(!paused){stop();return;}paused=false;pause.firstElementChild.textContent='Ⅱ';pause.setAttribute('aria-pressed','false');pause.setAttribute('aria-label','Pausar cambio automático de imágenes');schedule();});
 root.addEventListener('mouseenter',()=>{hover=true;schedule();});root.addEventListener('mouseleave',()=>{hover=false;schedule();});
 // El teclado nunca persigue controles que cambian solos. Se reanuda explícitamente.
 root.addEventListener('focusin',event=>{if(event.target!==pause)stop();});
 root.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();void go(current+(event.key==='ArrowRight'?1:-1),true);}});
 const visual=root.querySelector('.home-carousel-visual');
 visual.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')touchX=event.clientX;});
 visual.addEventListener('pointerup',event=>{if(event.pointerType!=='touch'||touchX===undefined)return;const delta=event.clientX-touchX;touchX=undefined;if(Math.abs(delta)>45)void go(current+(delta<0?1:-1),true);});
 visual.addEventListener('pointercancel',()=>{touchX=undefined;});
 document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);
 if('IntersectionObserver' in window)new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();},{threshold:.15}).observe(root);
 schedule();
}
