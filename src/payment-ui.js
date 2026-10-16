import QRCode from 'qrcode';
import { checkPayment,savedPayment,money } from './billing-api.js';
import { Hub } from 'aws-amplify/utils';
const panel=document.getElementById('paymentPanel'),notice=document.getElementById('paymentNotice'),refresh=document.getElementById('refreshPayment');
const id=new URLSearchParams(location.search).get('id');let busy=false,stopped=false,qrUrl='';
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
function render(row){
  if(!row)throw new Error('No encontramos esta solicitud en tu cuenta. Ingresá con la cuenta que inició el torneo.');
  panel.replaceChildren();panel.append(node('p',row.paymentMode==='TEST'?'MODO DE PRUEBA · SIN COBRO REAL':'CREACIÓN DE TORNEO','eyebrow'),node('h1',row.tournamentName),node('p',money(row.amountCents),'payment-amount'));
  if(row.status==='APPROVED'){
    stopped=true;refresh.hidden=true;
    panel.append(node('h2','Pago confirmado'),node('p','Tu torneo ya está habilitado y las invitaciones fueron enviadas.'));
    const link=node('a','Ir al torneo ↗','primary-button');link.href='/torneo.html?id='+encodeURIComponent(id);panel.append(link);return;
  }
  if(row.status==='REVERSED'){stopped=true;panel.append(node('h2','Pago revertido'),node('p','El cobro fue devuelto o recibió un contracargo. Contactá al administrador.'));return;}
  if(Date.parse(row.expiresAt)<=Date.now()){
    stopped=true;panel.append(node('h2','El enlace de pago venció'),node('p','Si pagaste, usá «Consultar pago» para comprobar su acreditación antes de volver a pagar. Si no pagaste, iniciá un nuevo torneo.'));return;
  }
  panel.append(node('h2','Esperando tu pago'),node('p','El torneo se habilita cuando Mercado Pago confirme el cobro. No hace falta enviar comprobantes.'));
  if(row.checkoutUrl){
    const url=new URL(row.checkoutUrl);
    if(url.protocol!=='https:' || !['www.mercadopago.com.ar','sandbox.mercadopago.com.ar'].includes(url.hostname))throw new Error('Dirección de pago inválida.');
    const actions=node('div','','payment-actions'),link=node('a',row.paymentMode==='TEST'?'Abrir pago de prueba ↗':'Pagar con Mercado Pago ↗','primary-button');link.href=url.href;link.rel='noopener noreferrer';actions.append(link);panel.append(actions);
    const image=document.createElement('img');image.className='payment-qr';image.alt='QR para abrir este pago en Mercado Pago';image.width=240;image.height=240;
    const caption=node('p','Desde otro dispositivo, escaneá el QR con la cámara para abrir el mismo checkout.','field-help');
    panel.append(image,caption);
    // QR generado localmente: el enlace no se envía a servicios de imágenes externos.
    void QRCode.toDataURL(url.href,{width:240,margin:4,errorCorrectionLevel:'M',color:{dark:'#101310',light:'#ffffff'}}).then(src=>{if(image.isConnected)image.src=src;}).catch(()=>{image.remove();caption.textContent='Usá el botón para abrir Mercado Pago.';});
    qrUrl=url.href;
  }else panel.append(node('p','Preparando el enlace de pago. Consultá nuevamente en unos segundos.'));
  panel.append(node('small','Vence: '+new Intl.DateTimeFormat('es-AR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(row.expiresAt)),'field-help'));
}
async function update(manual=false){
  if(busy || document.hidden || (stopped&&!manual))return;busy=true;refresh.disabled=true;
  try{if(!/^[0-9a-f-]{36}$/i.test(id||''))throw new Error('El enlace no incluye una solicitud válida.');const row=await checkPayment(id);render(row);notice.hidden=true;}
  catch(error){notice.textContent=error.name==='UserUnAuthenticatedException'?'Ingresá con tu cuenta para consultar este pago.':error.message;notice.hidden=false;notice.dataset.error='true';}
  finally{busy=false;refresh.disabled=false;}
}
refresh.addEventListener('click',()=>void update(true));
Hub.listen('auth',({payload})=>{if(payload.event==='signedIn'){stopped=false;void update(true);}if(payload.event==='signedOut'){stopped=true;panel.replaceChildren();notice.hidden=false;notice.textContent='Ingresá con tu cuenta para consultar el pago.';}});
try{if(!id)throw new Error('Falta el identificador del pago.');render(await savedPayment(id));await update();}
catch(error){notice.hidden=false;notice.textContent=error.name==='UserUnAuthenticatedException'?'Ingresá con tu cuenta para consultar el pago.':error.message;}
finally{window.proveitLoadingDone?.('page');}
setInterval(()=>void update(),15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void update();});
