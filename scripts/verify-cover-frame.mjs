import assert from 'node:assert/strict';
import {coverFrame,COVER_WIDTH,COVER_HEIGHT} from '../src/cover-frame.js';
let checks=0;
for(const [iw,ih] of [[1920,1080],[1080,1920],[800,800],[120,70],[500,3500]]){
 for(const x of [-1,0,1])for(const y of [-1,0,1]){
  const box=coverFrame(iw,ih,COVER_WIDTH,COVER_HEIGHT,{mode:'cover',zoom:1,x,y});
  assert.ok(box.x<=1e-7 && box.y<=1e-7 && box.x+box.width>=COVER_WIDTH-1e-7 && box.y+box.height>=COVER_HEIGHT-1e-7);checks++;
  const fit=coverFrame(iw,ih,COVER_WIDTH,COVER_HEIGHT,{mode:'contain',zoom:1,x,y});
  assert.ok(fit.x>=-1e-7 && fit.y>=-1e-7 && fit.x+fit.width<=COVER_WIDTH+1e-7 && fit.y+fit.height<=COVER_HEIGHT+1e-7);checks++;
  const preview=coverFrame(iw,ih,360,640,{mode:'cover',zoom:2,x,y}),output=coverFrame(iw,ih,1080,1920,{mode:'cover',zoom:2,x,y});
  for(const key of ['x','y','width','height'])assert.ok(Math.abs(preview[key]*3-output[key])<1e-6);checks++;
 }
}
assert.throws(()=>coverFrame(0,500,1080,1920),/dimensiones/);checks++;
console.log(`${checks} comprobaciones correctas: recorte sin huecos, foto completa sin cortes y exportación igual a la vista previa.`);
