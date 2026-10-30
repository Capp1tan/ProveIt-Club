// Una sola escucha incluye también las secciones agregadas después de cargar.
const running=new WeakMap();
document.addEventListener('click',e=>{
 const summary=e.target.closest('summary');if(!summary || e.target.closest('a,button,input,select,textarea'))return;
 const details=summary.parentElement;if(details.tagName!=='DETAILS' || matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 e.preventDefault();const previous=running.get(details),wasClosing=previous?.closing;const opening=previous?wasClosing:!details.open;
 const from=details.getBoundingClientRect().height;previous?.animation.cancel();details.style.height='';details.style.overflow='hidden';details.open=true;
 const to=opening?details.getBoundingClientRect().height:summary.getBoundingClientRect().height;
 const animation=details.animate([{height:from+'px'},{height:to+'px'}],{duration:220,easing:'cubic-bezier(.2,.7,.2,1)'});running.set(details,{animation,closing:!opening});
 animation.onfinish=()=>{details.open=opening;details.style.overflow='';running.delete(details);};
});
