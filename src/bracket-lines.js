// Conexiones entre los cruces realmente guardados, sin inventar resultados.
export function connectBracket(canvas, links) {
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.classList.add('bracket-connections');svg.setAttribute('aria-hidden','true');canvas.prepend(svg);
  const paths=links.map(link=>{const path=document.createElementNS(ns,'path');path.dataset.source=link.source;path.dataset.target=link.target;path.dataset.outcome=link.outcome;svg.append(path);return {...link,path};});
  let frame;
  function paint() {
    if(!canvas.isConnected)return;
    const base=canvas.getBoundingClientRect();svg.setAttribute('width',String(Math.ceil(base.width)));svg.setAttribute('height',String(Math.ceil(base.height)));
    const cards=new Map([...canvas.querySelectorAll('[data-match-id]')].map(card=>[card.dataset.matchId,card]));
    for(const link of paths) {
      const from=cards.get(link.source),to=cards.get(link.target),slot=to?.querySelector('[data-slot="'+link.slot+'"]');
      if(!from || !to || !slot){link.path.setAttribute('d','');continue;}
      const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),c=slot.getBoundingClientRect();
      const x1=a.right-base.left,y1=a.top+a.height/2-base.top,x2=b.left-base.left,y2=c.top+c.height/2-base.top;
      const mid=x1+Math.max(12,(x2-x1)/2);
      link.path.setAttribute('d',`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
    }
  }
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);};
  const observer=new ResizeObserver(schedule);observer.observe(canvas);canvas.querySelectorAll('.draw-match').forEach(card=>observer.observe(card));
  function highlight(event) {const card=event.target.closest?.('[data-match-id]');for(const link of paths)link.path.dataset.active=String(Boolean(card && (link.source===card.dataset.matchId || link.target===card.dataset.matchId)));}
  canvas.addEventListener('pointerover',highlight);canvas.addEventListener('focusin',highlight);
  canvas.addEventListener('pointerleave',()=>{for(const link of paths)link.path.dataset.active='false';});
  canvas.addEventListener('focusout',event=>{if(!canvas.contains(event.relatedTarget))for(const link of paths)link.path.dataset.active='false';});
  schedule();document.fonts?.ready.then(()=>{if(canvas.isConnected)schedule();});
  return ()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
