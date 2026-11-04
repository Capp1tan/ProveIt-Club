import {Hub} from 'aws-amplify/utils';
import '../deletion-dialog.css';
const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
let current=null;
export function confirmTournamentDeletion(name){
 if(current)return Promise.resolve(false);
 return new Promise(resolve=>{
  const origin=document.activeElement,dialog=el('dialog','','deletion-dialog'),form=el('form'),title=el('h2','Eliminar torneo'),description=el('p','Vas a eliminar «'+(name || 'este torneo')+'». Desaparecerá del catálogo y del historial de participaciones. No se realizarán devoluciones automáticas; los registros de pagos se conservan para revisión administrativa.'),label=el('label','Escribí ELIMINAR para confirmar'),input=el('input'),actions=el('div','','deletion-actions'),cancel=el('button','Cancelar'),submit=el('button','Eliminar torneo','deletion-submit');
  let confirmed=false;title.id='deleteTournamentTitle';description.id='deleteTournamentDescription';dialog.setAttribute('aria-labelledby',title.id);dialog.setAttribute('aria-describedby',description.id);input.autocomplete='off';input.spellcheck=false;input.required=true;input.maxLength=20;input.setAttribute('aria-label','Escribí ELIMINAR para confirmar');label.append(input);cancel.type='button';submit.type='submit';submit.disabled=true;actions.append(cancel,submit);form.append(title,description,label,actions);dialog.append(form);document.body.append(dialog);current=dialog;
  input.addEventListener('input',()=>{submit.disabled=input.value.trim()!=='ELIMINAR';});cancel.addEventListener('click',()=>dialog.close());
  form.addEventListener('submit',event=>{event.preventDefault();if(input.value.trim()!=='ELIMINAR')return;confirmed=true;dialog.close();});
  dialog.addEventListener('close',()=>{current=null;dialog.remove();if(origin?.isConnected)origin.focus();resolve(confirmed);},{once:true});
  dialog.showModal();input.focus();
 });
}
Hub.listen('auth',({payload})=>{if(['signedOut','signedIn'].includes(payload.event))current?.close();});
