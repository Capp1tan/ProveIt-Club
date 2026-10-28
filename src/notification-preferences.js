// Preferencia local compartida por el perfil y la campana; conserva la elección anterior.
const key='proveit:notification-sound';
export function notificationSoundEnabled(){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
export function setNotificationSound(enabled){try{localStorage.setItem(key,enabled?'on':'off');}catch{}window.dispatchEvent(new Event('proveit:notification-sound-changed'));}
export function watchNotificationSound(listener){window.addEventListener('proveit:notification-sound-changed',listener);window.addEventListener('storage',event=>{if(event.key===key || event.key===null)listener();});}
export function notificationSoundSetting(){
 const label=document.createElement('label');label.className='profile-sound-setting';
 const input=document.createElement('input');input.type='checkbox';input.checked=notificationSoundEnabled();
 label.append(input,document.createTextNode('Sonido de invitaciones a torneos'));
 input.addEventListener('change',()=>setNotificationSound(input.checked));
 watchNotificationSound(()=>{input.checked=notificationSoundEnabled();});return label;
}
