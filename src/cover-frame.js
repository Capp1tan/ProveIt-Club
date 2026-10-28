// Geometría compartida por la vista previa y el archivo final 9:16.
export const COVER_WIDTH=1080,COVER_HEIGHT=1920;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function coverFrame(iw,ih,fw,fh,state={}){
 if(![iw,ih,fw,fh].every(n=>Number.isFinite(n)&&n>0))throw new Error('No pudimos leer las dimensiones de la imagen.');
 const mode=state.mode==='contain'?'contain':'cover',zoom=clamp(Number(state.zoom)||1,1,4);
 const scale=(mode==='contain'?Math.min(fw/iw,fh/ih):Math.max(fw/iw,fh/ih))*zoom;
 const width=iw*scale,height=ih*scale,maxX=Math.abs(width-fw)/2,maxY=Math.abs(height-fh)/2;
 return {width,height,maxX,maxY,x:(fw-width)/2+clamp(Number(state.x)||0,-1,1)*maxX,y:(fh-height)/2+clamp(Number(state.y)||0,-1,1)*maxY};
}
export function drawCoverFrame(ctx,image,state){
 const {width:fw,height:fh}=ctx.canvas,box=coverFrame(image.width,image.height,fw,fh,state);
 ctx.clearRect(0,0,fw,fh);ctx.fillStyle='#171c29';ctx.fillRect(0,0,fw,fh);
 if(state.mode==='contain'){
  // El fondo desenfocado llena los márgenes sin cortar la fotografía principal.
  const scale=Math.max(fw/image.width,fh/image.height)*1.2,w=image.width*scale,h=image.height*scale;
  ctx.save();ctx.filter=`blur(${fw/30}px)`;ctx.drawImage(image,(fw-w)/2,(fh-h)/2,w,h);ctx.restore();ctx.fillStyle='#10131c33';ctx.fillRect(0,0,fw,fh);
 }
 ctx.drawImage(image,box.x,box.y,box.width,box.height);return box;
}
export async function encodeCoverFrame(image,state){
 const canvas=document.createElement('canvas');canvas.width=COVER_WIDTH;canvas.height=COVER_HEIGHT;
 drawCoverFrame(canvas.getContext('2d'),image,state);
 for(const quality of [.86,.76,.64]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));if(blob && blob.type==='image/webp' && blob.size<=2*1024*1024)return blob;}
 throw new Error('No pudimos optimizar esta imagen. Probá con otra fotografía.');
}
