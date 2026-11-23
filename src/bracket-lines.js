// Conexiones entre los cruces realmente guardados, sin inventar resultados.
export function connectBracket(canvas, links) {
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.classList.add('bracket-connections');svg.setAttribute('aria-hidden','true');svg.setAttribute('preserveAspectRatio','none');canvas.prepend(svg);
  const paths=links.map(link=>{const path=document.createElementNS(ns,'path');path.setAttribute('pathLength','1');path.dataset.source=link.source;path.dataset.target=link.target;path.dataset.outcome=link.outcome;svg.append(path);return {...link,path};});
  let frame;
  function paint() {
    if(!canvas.isConnected)return;
    const base=canvas.getBoundingClientRect(),width=Math.max(1,Math.ceil(base.width)),height=Math.max(1,Math.ceil(base.height));
    svg.setAttribute('width',String(width));svg.setAttribute('height',String(height));svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    const cards=new Map([...canvas.querySelectorAll('[data-match-id]')].map(card=>[card.dataset.matchId,card]));
    for(const link of paths) {
      const from=cards.get(link.source),to=cards.get(link.target),slot=to?.querySelector('[data-slot="'+link.slot+'"]');
      if(!from || !to || !slot){link.path.setAttribute('d','');continue;}
      const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),c=slot.getBoundingClientRect();
      const first=from.querySelector('[data-slot="0"]')?.getBoundingClientRect();
      const second=from.querySelector('[data-slot="1"]')?.getBoundingClientRect();
      const top=first?first.top+first.height/2-base.top:undefined;
      const bottom=second?second.top+second.height/2-base.top:undefined;
      const pair=top!==undefined && bottom!==undefined;
      if(link.orientation==='ranking'){
        const entrants=[...from.querySelectorAll('.draw-player[data-slot]')];
        if(!entrants.length){link.path.setAttribute('d','');continue;}
        const points=entrants.map(node=>{const r=node.getBoundingClientRect();return {x:r.left+r.width/2-base.left,y:r.bottom-base.top};});
        const center=points.reduce((sum,p)=>sum+p.x,0)/points.length;
        const joinY=Math.max(...points.map(p=>p.y))+14,targetX=c.left+c.width/2-base.left,targetY=c.top-base.top;
        const branches=points.map(p=>`M ${p.x} ${p.y} V ${joinY}`).join(' ');
        link.path.setAttribute('d',`${branches} M ${Math.min(...points.map(p=>p.x))} ${joinY} H ${Math.max(...points.map(p=>p.x))} M ${center} ${joinY} V ${targetY-14} H ${targetX} V ${targetY}`);
        continue;
      }
      if(link.orientation==='vertical' && pair){
        const left=first.left+first.width/2-base.left,right=second.left+second.width/2-base.left;
        const leftBottom=first.bottom-base.top,rightBottom=second.bottom-base.top;
        const center=(left+right)/2,targetX=c.left+c.width/2-base.left,targetY=c.top-base.top;
        const joinY=Math.max(leftBottom,rightBottom)+14;
        link.path.setAttribute('d',`M ${left} ${leftBottom} V ${joinY} H ${right} V ${rightBottom} M ${center} ${joinY} V ${targetY-14} H ${targetX} V ${targetY}`);
        continue;
      }
      const x1=a.right-base.left,x2=b.left-base.left,y2=c.top+c.height/2-base.top;
      const y1=pair?(top+bottom)/2:a.top+a.height/2-base.top;
      const mid=x1+Math.max(12,(x2-x1)/2);
      if(link.joinPlayers && pair){
        link.path.setAttribute('d',`M ${x1} ${top} H ${mid} V ${bottom} H ${x1} M ${mid} ${y1} V ${y2} H ${x2}`);
        continue;
      }
      link.path.setAttribute('d',`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`);
    }
  }
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(paint);};
  const observer=new ResizeObserver(schedule);
  observer.observe(canvas);
  canvas.querySelectorAll('.draw-match,[data-slot]').forEach(node=>observer.observe(node));
  function highlight(event) {const card=event.target.closest?.('[data-match-id]');for(const link of paths)link.path.dataset.active=String(Boolean(card && (link.source===card.dataset.matchId || link.target===card.dataset.matchId)));}
  canvas.addEventListener('pointerover',highlight);canvas.addEventListener('focusin',highlight);
  canvas.addEventListener('pointerleave',()=>{for(const link of paths)link.path.dataset.active='false';});
  canvas.addEventListener('focusout',event=>{if(!canvas.contains(event.relatedTarget))for(const link of paths)link.path.dataset.active='false';});
  schedule();document.fonts?.ready.then(()=>{if(canvas.isConnected)schedule();});
  return ()=>{observer.disconnect();cancelAnimationFrame(frame);};
}
