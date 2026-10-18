import {mountJudgeReportAdmin} from './judge-ui.js';
import {mountPublicProfile} from './profile-public.js';
import {viewClubProfile} from './community-api.js';
import {reputationPanel} from './profile-components.js';
import '../community.css';
import { mountPhoneCountry } from './phone-country.js';
import { mountBillingAdmin } from './billing-admin.js';
import { mountAccountActions } from './account-actions.js';
import { loadBadges, badgeElements, decorateAvatar, initializeAccess, mountBadgeAdmin } from './badges.js';
// Edición del perfil. El archivo no almacena imágenes ni datos en el navegador:
// Amplify los envía a S3 y a la base de datos cuando el backend esté desplegado.
import { fetchUserAttributes, avatarUrl, configureAmplify, loadProfile, saveAvatar, saveProfile, signOut } from './auth-client.js';

const targetId=new URLSearchParams(location.search).get('id');
if(targetId){await configureAmplify();await mountPublicProfile(targetId);}else{
const form = document.getElementById('profileForm');
const notice = document.getElementById('profileNotice');
const preview = document.getElementById('avatarPreview');
const avatarInput = document.getElementById('avatarInput');
const bio = form.elements.bio;
const bioCount = document.getElementById('bioCount');
const phoneField=mountPhoneCountry();
let profileId = null;
let currentAvatarPath = '';
let selectedAvatar = null;

function showNotice(text, error = false) {
  notice.textContent = text;
  notice.dataset.error = String(error);
}
function setAvatar(src, fallback = '?') {
  preview.replaceChildren();
  if (src) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = 'Foto de perfil';
    preview.append(image);
  } else preview.textContent = fallback;
}

document.getElementById('signOutButton').addEventListener('click', async () => {
  try { await signOut(); location.href = '/'; }
  catch (error) { showNotice(error.message, true); }
});

bio.addEventListener('input', () => { bioCount.textContent = String(bio.value.length); });
avatarInput.addEventListener('change', () => {
  selectedAvatar = avatarInput.files?.[0] || null;
  if (!selectedAvatar) return;
  if (selectedAvatar.size > 2 * 1024 * 1024) {
    avatarInput.value = '';
    selectedAvatar = null;
    return showNotice('La foto supera el máximo de 2 MB.', true);
  }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedAvatar.type)) {
    avatarInput.value = '';
    selectedAvatar = null;
    return showNotice('Elegí una imagen JPG, PNG o WebP.', true);
  }
  setAvatar(URL.createObjectURL(selectedAvatar));
  showNotice('Vista previa lista. Se subirá al guardar.');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  showNotice('Guardando…');
  try {
    if (selectedAvatar) currentAvatarPath = await saveAvatar(selectedAvatar);
    const saved = await saveProfile(profileId, {
      nickname: form.elements.nickname.value,
      bio: bio.value,
      avatarPath: currentAvatarPath,
      phoneNumber: phoneField.value(),visibility:form.elements.visibility.value,judgeEnabled:form.elements.judgeEnabled.checked,
      socialLinks:JSON.stringify(Object.fromEntries(['instagram','twitch','discord','custom'].map(k=>[k,form.elements[k].value.trim()]))),
    });
    profileId = saved.id;
    if (currentAvatarPath) setAvatar(await avatarUrl(currentAvatarPath), form.elements.nickname.value.trim().slice(0, 1).toUpperCase());
    selectedAvatar = null;
    showNotice('Perfil guardado.');
    if(new URLSearchParams(location.search).has('registro')){history.replaceState(null,'','/perfil.html');document.querySelector('.profile-heading h1').textContent='Tu perfil.';}
    window.dispatchEvent(new Event('proveit:profile-updated'));
  } catch (error) { showNotice(error.message || 'No se pudo guardar el perfil.', true); }
  finally { button.disabled = false; }
});

const ready = await configureAmplify();
if (!ready) {
  showNotice('Esta pantalla está preparada, pero el backend todavía no está conectado. Falta el despliegue de Amplify.', true);
  form.querySelectorAll('input,textarea,select,button').forEach(control => { control.disabled = true; });
} else {
  try {
    const { user, profile, account } = await loadProfile({ includePrivate: true });
    phoneField.load(account?.phoneNumber || '');
    if (!account?.phoneNumber) showNotice('Completá tu teléfono para guardar el perfil y participar en nuevos torneos.');
    // Las insignias se cargan aparte: un error no impide editar el perfil.
    void (async () => { try {
      const access = await initializeAccess();
      phoneField.optional(Boolean(access.phoneOptional));
      if(access.phoneOptional && !account?.phoneNumber)showNotice('Tu cuenta puede participar sin teléfono.');
      mountAccountActions(access.isCreator);
      await loadBadges();
      decorateAvatar(preview, user.userId);
      document.getElementById('profileBadges').replaceChildren(badgeElements(user.userId));
      if (access.isCreator) {
       const adminCard=document.createElement('section');adminCard.className='profile-card';const title=document.createElement('h2');title.textContent='Centro de administración';const link=document.createElement('a');link.href='/admin.html';link.className='primary-button';link.textContent='Abrir panel de datos del club ↗';adminCard.append(title,link);document.querySelector('main').prepend(adminCard);
       await mountBadgeAdmin(); await mountBillingAdmin();await mountJudgeReportAdmin(); }
    } catch { showNotice('No pudimos cargar las insignias. Podés editar tu perfil y recargar para reintentar.', true); } })();
    if (profile) {
      profileId = profile.id;
      form.elements.visibility.value=profile.visibility==='PUBLIC'?'PUBLIC':'PRIVATE';form.elements.judgeEnabled.checked=Boolean(profile.judgeEnabled);
      let links={};try{links=JSON.parse(profile.socialLinks || '{}');}catch{}
      for(const k of ['instagram','twitch','discord','custom'])form.elements[k].value=links[k] || '';
      const ownLink=document.createElement('a');ownLink.href='/perfil.html?id='+encodeURIComponent(profile.id);ownLink.textContent='Tu perfil es '+(profile.visibility==='PUBLIC'?'público':'privado');ownLink.className='field-help';form.prepend(ownLink);
      void viewClubProfile(profile.id).then(p=>{document.getElementById('ownJudgeReputation').replaceChildren(reputationPanel(p.reputation,p.judgeEnabled));}).catch(()=>{});
      currentAvatarPath = profile.avatarPath || '';
      form.elements.nickname.value = profile.nickname || '';
      bio.value = profile.bio || '';
      if (currentAvatarPath) setAvatar(await avatarUrl(currentAvatarPath), profile.nickname?.slice(0, 1).toUpperCase());
    } else {
      setAvatar('','?');
      try{const attrs=await fetchUserAttributes();form.elements.nickname.value=attrs.nickname || '';if(!account?.phoneNumber)phoneField.load(attrs.phone_number || '');}catch{}
      document.querySelector('.profile-heading h1').textContent='Completá tu registro.';
      document.querySelector('.profile-heading>p:last-child').textContent='Elegí un nick único y agregá tu teléfono privado para empezar. La foto y los demás datos son opcionales.';
      showNotice('Completá y guardá el perfil para continuar. Si el nick o teléfono ya están en uso, te lo indicaremos.');
    }
    bioCount.textContent = String(bio.value.length);
  } catch (error) {
    showNotice(error.name === 'UserUnAuthenticatedException' ? 'Iniciá sesión para editar tu perfil.' : 'No pudimos cargar tu perfil. Tus datos siguen guardados: recargá para reintentar.', true);
    form.querySelectorAll('input,textarea,button[type="submit"]').forEach(control => { control.disabled = true; });
  }
}


window.proveitLoadingDone?.('page');

}
