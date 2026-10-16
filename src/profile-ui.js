import { loadBadges, badgeElements, initializeAccess, mountBadgeAdmin } from './badges.js';
// Edición del perfil. El archivo no almacena imágenes ni datos en el navegador:
// Amplify los envía a S3 y a la base de datos cuando el backend esté desplegado.
import { avatarUrl, configureAmplify, loadProfile, saveAvatar, saveProfile, signOut } from './auth-client.js';

const form = document.getElementById('profileForm');
const notice = document.getElementById('profileNotice');
const preview = document.getElementById('avatarPreview');
const avatarInput = document.getElementById('avatarInput');
const bio = form.elements.bio;
const bioCount = document.getElementById('bioCount');
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
      phoneNumber: form.elements.phoneNumber.value,
    });
    profileId = saved.id;
    if (currentAvatarPath) setAvatar(await avatarUrl(currentAvatarPath), form.elements.nickname.value.trim().slice(0, 1).toUpperCase());
    selectedAvatar = null;
    showNotice('Perfil guardado.');
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
    form.elements.phoneNumber.value = account?.phoneNumber || '';
    if (!account?.phoneNumber) showNotice('Completá tu teléfono para guardar el perfil y participar en nuevos torneos.');
    // Las insignias se cargan aparte: un error no impide editar el perfil.
    void (async () => { try {
      const access = await initializeAccess();
      await loadBadges();
      document.getElementById('profileBadges').replaceChildren(badgeElements(user.userId));
      if (access.isCreator) await mountBadgeAdmin();
    } catch { showNotice('No pudimos cargar las insignias. Podés editar tu perfil y recargar para reintentar.', true); } })();
    if (profile) {
      profileId = profile.id;
      currentAvatarPath = profile.avatarPath || '';
      form.elements.nickname.value = profile.nickname || '';
      bio.value = profile.bio || '';
      if (currentAvatarPath) setAvatar(await avatarUrl(currentAvatarPath), profile.nickname?.slice(0, 1).toUpperCase());
    } else setAvatar('', user.username?.slice(0, 1).toUpperCase() || '?');
    bioCount.textContent = String(bio.value.length);
  } catch (error) {
    showNotice(error.name === 'UserUnAuthenticatedException' ? 'Iniciá sesión para editar tu perfil.' : 'No pudimos cargar tu perfil. Tus datos siguen guardados: recargá para reintentar.', true);
    form.querySelectorAll('input,textarea,button[type="submit"]').forEach(control => { control.disabled = true; });
  }
}


window.proveitLoadingDone?.('page');
