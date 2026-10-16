import { scheduleLabel } from './tournament-schedule.js';
const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const tournamentUrl=t=>'https://proveitclub.win/torneo.html?id='+encodeURIComponent(t.id);
// La imagen se dibuja localmente: no envía fotos ni datos de perfiles a terceros.
async function storyFile(t){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,1080,1920);gradient.addColorStop(0,'#17251a');gradient.addColorStop(1,'#090d0a');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1920);
  ctx.strokeStyle='#b9f33f';ctx.lineWidth=3;ctx.strokeRect(65,65,950,1790);
  ctx.fillStyle='#b9f33f';ctx.font='bold 48px sans-serif';ctx.fillText('prove.it / CLUB',105,190);
  const wrap=(text,x,y,width,line,max)=>{const chars=Array.from(String(text || '')),lines=[];let row='';for(const char of chars){if(ctx.measureText(row+char).width>width && row){lines.push(row);row=char;}else row+=char;}if(row)lines.push(row);lines.slice(0,max).forEach((value,i)=>{let out=value;if(i===max-1 && lines.length>max)out=value.slice(0,-1)+'…';ctx.fillText(out,x,y+i*line);});};
  ctx.fillStyle='#eff4e9';ctx.font='bold 80px sans-serif';wrap(t.name,105,350,870,96,3);
  ctx.fillStyle='#a8b59f';ctx.font='32px sans-serif';wrap(t.activity,105,670,870,44,2);
  ctx.fillStyle='#b9f33f';ctx.font='bold 32px sans-serif';ctx.fillText('ESTO ESTÁ EN JUEGO',105,850);
  ctx.fillStyle='#ffffff';ctx.font='bold 64px sans-serif';wrap(t.prizeTitle || 'Premio por anunciar',105,955,870,78,3);
  ctx.fillStyle='#a8b59f';ctx.font='28px sans-serif';ctx.fillText('PREMIO PROVISIONAL',105,1215);
  ctx.font='30px sans-serif';wrap(scheduleLabel(t.startsAt,t.timeZone),105,1305,870,42,2);
  const {default:QRCode}=await import('qrcode');const qr=document.createElement('canvas');await QRCode.toCanvas(qr,tournamentUrl(t),{width:260,margin:2,color:{dark:'#101310',light:'#ffffff'}});ctx.drawImage(qr,105,1450,260,260);
  ctx.fillStyle='#eff4e9';ctx.font='bold 34px sans-serif';ctx.fillText('¿TE SUMÁS?',410,1530);ctx.font='27px sans-serif';ctx.fillText('Escaneá para ver el torneo',410,1585);ctx.fillStyle='#b9f33f';ctx.fillText('proveitclub.win',410,1635);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('No pudimos generar la historia.');return new File([blob],'proveit-torneo-'+t.id+'.png',{type:'image/png'});
}
export function sharePanel(t){
  const section=el('section','','tournament-panel tournament-sharing');section.append(el('h2','Que se enteren todos'),el('p','Compartí el desafío. Para consultar el torneo se necesita una cuenta en ProveIt.','field-help'));
  const actions=el('div','','prize-actions'),message=el('p','','field-help');message.setAttribute('role','status');
  const copy=el('button','Copiar enlace','format-choice');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(tournamentUrl(t));message.textContent='Enlace copiado.';}catch{message.textContent=tournamentUrl(t);}});actions.append(copy);
  if(navigator.share){const share=el('button','Compartir…','primary-button');share.type='button';share.addEventListener('click',async()=>{try{await navigator.share({title:t.name,text:t.name+(t.prizeTitle?' · Esto está en juego: '+t.prizeTitle:''),url:tournamentUrl(t)});}catch(error){if(error.name!=='AbortError')message.textContent='No se pudo abrir Compartir. Usá Copiar enlace.';}});actions.append(share);}
  for(const [name,href] of [['WhatsApp','https://wa.me/?text='+encodeURIComponent(t.name+' '+tournamentUrl(t))],['Facebook','https://www.facebook.com/sharer/sharer.php?u='+encodeURIComponent(tournamentUrl(t))],['X','https://twitter.com/intent/tweet?text='+encodeURIComponent(t.name)+'&url='+encodeURIComponent(tournamentUrl(t))]]){const a=el('a',name,'format-choice');a.href=href;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);}
  const prepare=el('button','Crear imagen para historia','format-choice');prepare.type='button';actions.append(prepare);
  prepare.addEventListener('click',async()=>{prepare.disabled=true;message.textContent='Preparando historia…';try{
    const file=await storyFile(t),url=URL.createObjectURL(file),preview=el('img');preview.src=url;preview.alt='Historia del torneo '+t.name;preview.className='story-preview';
    const output=el('div','','story-output'),download=el('a','Descargar historia PNG','primary-button');download.href=url;download.download=file.name;
    output.append(preview,download,el('p','En Instagram: subí esta imagen a tu historia y agregá el sticker Enlace con la dirección del torneo.','field-help'));
    if(navigator.canShare?.({files:[file]})){const share=el('button','Compartir imagen…','format-choice');share.type='button';share.addEventListener('click',async()=>{try{await navigator.share({files:[file]});}catch(error){if(error.name!=='AbortError')message.textContent='Podés descargar el PNG y subirlo manualmente.';}});output.append(share);}
    section.append(output);prepare.hidden=true;message.textContent='Historia lista. Usá Copiar enlace para el sticker de Instagram.';
    // Se libera el recurso cuando la sala vuelve a dibujarse o se cierra la página.
    const observer=new MutationObserver(()=>{if(!section.isConnected){URL.revokeObjectURL(url);observer.disconnect();}});observer.observe(document.body,{childList:true,subtree:true});
  }catch(error){message.textContent=error.message;prepare.disabled=false;}});
  section.append(actions,message);return section;
}
