import {coverFrame,drawCoverFrame,encodeCoverFrame,COVER_WIDTH,COVER_HEIGHT} from './cover-frame.js';
import '../cover-editor.css';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
/** Editor local: no sube archivos ni modifica el torneo hasta «Usar imagen». */
export async function editCover(file,initial={},signal){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type) || !file.size || file.size>5*1024*1024)throw new Error('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.');
 const image=await createImageBitmap(file);if(signal?.aborted){image.close();return null;}
 if(image.width*image.height>60000000){image.close();throw new Error('La imagen tiene demasiados píxeles. Usá una versión más pequeña.');}
 return new Promise(resolve=>{
  const state={mode:initial.mode==='contain'?'contain':'cover',zoom:initial.zoom || 1,x:initial.x || 0,y:initial.y || 0};
  const dialog=el('dialog','','cover-editor'),layout=el('div','','cover-editor-layout'),preview=el('div','','cover-editor-preview'),controls=el('section','','cover-editor-controls');
  dialog.setAttribute('aria-labelledby','coverEditorTitle');
  const canvas=el('canvas','','cover-editor-canvas');canvas.width=360;canvas.height=640;canvas.tabIndex=0;canvas.setAttribute('aria-label','Encuadre de la portada. Arrastrá para mover la foto o usá las flechas del teclado.');canvas.setAttribute('aria-describedby','coverEditorHelp');
  const heading=el('h2','Ajustá tu portada');heading.id='coverEditorTitle';
  const help=el('p','Arrastrá la foto para moverla. También podés usar las flechas del teclado.','cover-editor-help');help.id='coverEditorHelp';
  const dimensions=el('p',`Tu imagen: ${image.width} × ${image.height} px`,'cover-editor-help');
  const recommendation=el('p','Recomendado: 1080 × 1920 px · vertical 9:16, como una historia.','cover-editor-recommendation');
  if(image.width<COVER_WIDTH || image.height<COVER_HEIGHT)dimensions.append(el('small',' Una foto pequeña puede perder nitidez al ampliarla.'));
  const options=el('div','','cover-editor-modes'),buttons=[];
  for(const [mode,label] of [['cover','Llenar recuadro'],['contain','Mostrar foto completa']]){const b=el('button',label);b.type='button';b.addEventListener('click',()=>{Object.assign(state,{mode,zoom:1,x:0,y:0});paint();});buttons.push([b,mode]);options.append(b);}
  const fitHelp=el('p','«Mostrar foto completa» usa un fondo desenfocado para adaptar fotos horizontales o cuadradas.','cover-editor-help');
  const zoomLabel=el('label','Zoom'),zoom=el('input'),zoomValue=el('output');zoom.type='range';zoom.min='1';zoom.max='4';zoom.step='.01';zoom.setAttribute('aria-label','Zoom de la portada');zoomLabel.append(zoom,zoomValue);
  const reset=el('button','Centrar imagen','cover-editor-reset');reset.type='button';reset.addEventListener('click',()=>{state.x=0;state.y=0;state.zoom=1;paint();});
  const actions=el('div','','cover-editor-actions'),cancel=el('button','Cancelar'),apply=el('button','Usar imagen','primary-button'),message=el('p','','cover-editor-help');cancel.type=apply.type='button';message.setAttribute('role','status');
  actions.append(cancel,apply);controls.append(heading,recommendation,dimensions,help,options,fitHelp,zoomLabel,reset,message,actions);preview.append(canvas);layout.append(preview,controls);dialog.append(layout);document.body.append(dialog);
  let settled=false,frame=0,pointer=null;
  function paint(){if(settled)return;drawCoverFrame(canvas.getContext('2d'),image,state);zoom.value=String(state.zoom);zoomValue.textContent=Math.round(state.zoom*100)+'%';for(const [button,mode] of buttons)button.setAttribute('aria-pressed',String(mode===state.mode));}
  function schedulePaint(){if(frame)return;frame=requestAnimationFrame(()=>{frame=0;paint();});}
  function finish(result){if(settled)return;settled=true;cancelAnimationFrame(frame);signal?.removeEventListener('abort',abort);dialog.close();dialog.remove();image.close();resolve(result);}
  const abort=()=>finish(null);signal?.addEventListener('abort',abort,{once:true});
  zoom.addEventListener('input',()=>{state.zoom=Number(zoom.value);schedulePaint();});
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0 || pointer)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');});
  canvas.addEventListener('pointermove',event=>{
   if(!pointer || pointer.id!==event.pointerId)return;const rect=canvas.getBoundingClientRect(),box=coverFrame(image.width,image.height,canvas.width,canvas.height,state);
   if(box.maxX)state.x=Math.max(-1,Math.min(1,state.x+(event.clientX-pointer.x)*canvas.width/rect.width/box.maxX));
   if(box.maxY)state.y=Math.max(-1,Math.min(1,state.y+(event.clientY-pointer.y)*canvas.height/rect.height/box.maxY));
   pointer.x=event.clientX;pointer.y=event.clientY;schedulePaint();
  });
  const release=()=>{pointer=null;canvas.classList.remove('dragging');};canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('keydown',event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];if(!direction)return;event.preventDefault();const step=event.shiftKey ? .15 : .04;state.x=Math.max(-1,Math.min(1,state.x+direction[0]*step));state.y=Math.max(-1,Math.min(1,state.y+direction[1]*step));paint();});
  cancel.addEventListener('click',()=>finish(null));dialog.addEventListener('cancel',event=>{event.preventDefault();finish(null);});
  apply.addEventListener('click',async()=>{if(apply.disabled)return;apply.disabled=true;message.textContent='Preparando portada…';try{const framing={...state},blob=await encodeCoverFrame(image,framing);finish({blob,framing});}catch(error){if(!settled){message.textContent=error.message || 'No pudimos preparar la portada.';apply.disabled=false;}}});
  paint();dialog.showModal();canvas.focus();
 });
}
