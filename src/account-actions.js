import { deleteMyAccount, deleteTournament } from './maintenance-api.js';
import { fetchAuthSession, signOut } from './auth-client.js';
import { listClubTournaments } from './tournaments-api.js';
import { myPendingPayments } from './billing-api.js';
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
export function mountAccountActions(isCreator) {
  const section=el('section','');section.className='profile-card';section.id='accountActions';
  const message=el('p','');message.setAttribute('role','status');
  if(isCreator) {
    section.append(el('h2','Administración de torneos'),el('p','Podés eliminar cualquier torneo desde su página. La limpieza general elimina los torneos y solicitudes existentes al comenzar; los nuevos se conservan. Los recibos no se borran ni se reembolsan.'));
    const button=el('button','Eliminar todos los torneos existentes');button.type='button';button.className='danger-button';button.id='deleteAllTournaments';
    button.addEventListener('click',async()=>{
      if(!window.confirm('¿Eliminar todos los torneos y solicitudes actuales? Se ocultarán y bloquearán; no se devuelve dinero.'))return;
      button.disabled=true;const before=new Date().toISOString();
      try {
        const [tournaments,payments]=await Promise.all([listClubTournaments(),myPendingPayments({includeExpired:true})]);
        const ids=[...new Set([...tournaments,...payments].filter(t=>t.createdAt<=before).map(t=>t.id))];
        for(let i=0;i<ids.length;i++){message.textContent=`Eliminando ${i+1} de ${ids.length}…`;await deleteTournament(ids[i]);}
        message.textContent=`Limpieza completada: ${ids.length} torneos o solicitudes eliminados.`;
      } catch(error){message.textContent='La limpieza no terminó: '+error.message+' Podés reintentar; se omitirán los ya eliminados.';}
      finally{button.disabled=false;}
    });section.append(button);
  } else {
    section.append(el('h2','Eliminar mi cuenta'),el('p','Se eliminarán tu acceso, perfil, fotos, teléfono e insignias. Se cancelarán tus torneos y dejarás de participar en los pendientes de otras personas. Los resultados históricos y recibos de pagos se conservan. No se elimina tu cuenta de Google ni de Mercado Pago.'));
    const label=el('label','Escribí ELIMINAR MI CUENTA para confirmar');label.className='profile-field';
    const input=el('input','');input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label','Confirmación de eliminación');label.append(input);
    const button=el('button','Eliminar mi cuenta definitivamente');button.type='button';button.className='danger-button';button.disabled=true;
    input.addEventListener('input',()=>{button.disabled=input.value!=='ELIMINAR MI CUENTA';});
    button.addEventListener('click',async()=>{
      if(input.value!=='ELIMINAR MI CUENTA' || !window.confirm('¿Eliminar definitivamente tu cuenta de ProveIt? No podrás recuperar este perfil.'))return;
      button.disabled=true;input.disabled=true;message.textContent='Eliminando cuenta… No cierres esta página.';
      try {
        // El SDK sólo puede borrar archivos de la identidad autenticada por IAM.
        const session=await fetchAuthSession();
        if(session.identityId) {
          const {list,remove}=await import('aws-amplify/storage');let nextToken;
          do {
            const page=await list({path:'profile-pictures/'+session.identityId+'/',options:{pageSize:100,nextToken}});
            for(const photo of page.items)await remove({path:photo.path});nextToken=page.nextToken;
          } while(nextToken);
        }
        await deleteMyAccount();
        for(const storage of [localStorage,sessionStorage])for(const key of Object.keys(storage))if(key.startsWith('proveit:'))storage.removeItem(key);
        try{await signOut({global:true});}catch{/* La identidad ya fue eliminada del servidor. */}
        location.replace('/?cuenta=eliminada');
      } catch(error){message.textContent='No se completó la baja: '+error.message+' Volvé a pulsar el botón para retomar la limpieza.';button.disabled=false;input.disabled=false;}
    });section.append(label,button);
  }
  section.append(message);document.querySelector('main').append(section);
}
