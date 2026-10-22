export async function optimizeAvatar(file){
 const bitmap=await createImageBitmap(file);
 try{
  const scale=Math.min(1,768/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No pudimos preparar la foto.');
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.88));
  if(!blob)throw new Error('No pudimos preparar la foto.');
  return blob.size<file.size?new File([blob],'perfil.webp',{type:blob.type}):file;
 }finally{bitmap.close();}
}
