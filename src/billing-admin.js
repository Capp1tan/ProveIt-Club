import { tournamentFee,setTournamentFee,money } from './billing-api.js';
export async function mountBillingAdmin(host=document.querySelector('main')){
  const panel=document.createElement('section');panel.className='profile-card';
  const title=document.createElement('h2');title.textContent='Tarifa por crear torneo';
  const help=document.createElement('p');help.textContent='Los cambios se aplican a solicitudes nuevas. Cada pago pendiente conserva su importe original.';
  const form=document.createElement('form'),label=document.createElement('label');label.className='profile-field';label.textContent='Precio en pesos argentinos';
  const input=document.createElement('input');input.type='number';input.min='.01';input.max='1000000';input.step='.01';input.required=true;label.append(input);
  const toggleLabel=document.createElement('label'),toggle=document.createElement('input');toggle.type='checkbox';toggleLabel.append(toggle,document.createTextNode(' Permitir nuevas solicitudes'));
  const submit=document.createElement('button');submit.type='submit';submit.className='primary-button';submit.textContent='Guardar tarifa';
  const status=document.createElement('p');status.setAttribute('role','status');
  const current=await tournamentFee();input.value=String(current.amountCents/100);toggle.checked=current.enabled;status.textContent=money(current.amountCents)+' · '+(current.mode==='TEST'?'Modo de prueba':'Cobros reales');
  form.append(label,toggleLabel,submit);panel.append(title,help,form,status);host.append(panel);
  form.addEventListener('submit',async event=>{event.preventDefault();submit.disabled=true;try{const cents=Math.round(Number(input.value)*100);const saved=await setTournamentFee(cents,toggle.checked);status.textContent='Tarifa guardada: '+money(saved.amountCents);}catch(error){status.textContent=error.message;}finally{submit.disabled=false;}});
}
