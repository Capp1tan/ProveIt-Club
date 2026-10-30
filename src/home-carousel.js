import '../home-carousel.css';
import '../home-community.css';
// Rotación discreta. Sin controles visibles: se detiene fuera de pantalla, al
// ocultar la pestaña, con foco/hover o cuando se prefiere movimiento reducido.
const root=document.querySelector('[data-home-carousel]');
if(root){const slides=[...root.querySelectorAll('[data-carousel-slide]')],reduced=matchMedia('(prefers-reduced-motion: reduce)');let current=0,timer,visible=true,hover=false,focus=false,request=0;
 const schedule=()=>{clearTimeout(timer);if(visible&&!hover&&!focus&&!document.hidden&&!reduced.matches)timer=setTimeout(go,4000);};
 async function go(){const token=++request,next=(current+1)%slides.length;try{await slides[next].querySelector('img').decode();}catch{schedule();return;}if(token!==request)return;if(document.hidden || reduced.matches){schedule();return;}slides.forEach((s,i)=>{s.classList.toggle('is-active',i===next);s.setAttribute('aria-hidden',String(i!==next));});current=next;schedule();}
 root.addEventListener('mouseenter',()=>{hover=true;schedule();});root.addEventListener('mouseleave',()=>{hover=false;schedule();});root.addEventListener('focusin',()=>{focus=true;schedule();});root.addEventListener('focusout',()=>{focus=false;schedule();});document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);if('IntersectionObserver'in window)new IntersectionObserver(([e])=>{visible=e.isIntersecting;schedule();},{threshold:.15}).observe(root);schedule();}
