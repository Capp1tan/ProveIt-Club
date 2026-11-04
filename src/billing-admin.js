import { tournamentFee,setTournamentFee,money } from './billing-api.js';
export async function mountBillingAdmin(host=document.querySelector('main')){
 const panel=document.createElement('section');panel.className='profile-card';
 const title=document.createElement('h2');title.textContent='Inscripción por participante';
 const help=document.createElement('p');help.textContent='Crear torneos es gratis. Esta configuración se aplica a todos los usuarios en torneos nuevos. Los torneos existentes y sus pagos conservan las condiciones originales.';
 const form=document.createElement('form'),label=document.createElement('label');label.className='profile-field';label.textContent='Tarifa habitual en pesos argentinos';
 const input=document.createElement('input');input.type='number';input.min='500';input.max='1000000';input.step='.01';input.required=true;label.append(input);
 const freeLabel=document.createElement('label'),free=document.createElement('input');free.type='checkbox';free.id='freeEntries';freeLabel.append(free,document.createTextNode(' Inscripciones gratis en todo el sitio y para todos los usuarios'));
 const freeHelp=document.createElement('p');freeHelp.className='social-help';freeHelp.textContent='Mientras esté activa, todos los torneos nuevos tendrán inscripción de $0, sin pasar por Mercado Pago. Al desactivarla se recupera la tarifa habitual; los torneos gratuitos ya creados siguen siendo gratuitos.';
 const toggleLabel=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggleLabel.append(toggle,document.createTextNode(' Permitir crear nuevos torneos'));
 const submit=document.createElement('button');submit.type='submit';submit.className='primary-button';submit.textContent='Guardar configuración';
 const status=document.createElement('p');status.setAttribute('role','status');
 const current=await tournamentFee();input.value=String((current.standardAmountCents ?? current.participantAmountCents ?? 50000)/100);toggle.checked=current.enabled;free.checked=current.freeEntries===true;
 const describe=saved=>saved.freeEntries?'Inscripciones gratis activas para todos en los nuevos torneos. Tarifa habitual guardada: '+money(saved.standardAmountCents):'Inscripción: '+money(saved.participantAmountCents ?? saved.standardAmountCents)+' · '+(saved.mode==='TEST'?'Modo de prueba':'Cobros reales');
 status.textContent=describe(current);form.append(freeLabel,freeHelp,label,toggleLabel,submit);panel.append(title,help,form,status);host.append(panel);
 form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const cents=Math.round(Number(input.value)*100);const saved=await setTournamentFee(cents,toggle.checked,free.checked);free.checked=saved.freeEntries===true;status.textContent='Configuración guardada. '+describe(saved);}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
}
