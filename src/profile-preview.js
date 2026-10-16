// Tarjeta pública compartida: no consulta teléfonos, correos ni datos privados.
// Cambiá este valor si querés ajustar el tiempo de espera al pasar el cursor.
const HOVER_DELAY = 500;
export class ProfilePreview {
  constructor({ avatar, badges }) {
    this.avatar=avatar;this.badges=badges;this.profiles=new Map();this.enabled=true;
    this.card=document.createElement('section');this.card.id='participantProfilePreview';
    this.card.className='profile-preview';this.card.hidden=true;
    this.card.setAttribute('role','dialog');this.card.setAttribute('aria-label','Vista previa de perfil');
    document.body.append(this.card);
    this.card.addEventListener('pointerenter',()=>clearTimeout(this.hideTimer));
    this.card.addEventListener('pointerleave',()=>this.scheduleHide());
    this.card.addEventListener('focusout',()=>this.scheduleHide());
    document.addEventListener('pointerdown',event=>{
      if(!this.card.contains(event.target) && !this.active?.contains(event.target))this.dismiss();
    });
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){const origin=this.active,inside=this.card.contains(document.activeElement);this.dismiss();if(inside){this.suppressFocus=origin;origin?.focus({preventScroll:true});}}});
    window.addEventListener('resize',()=>this.dismiss());
    // Al desplazar la llave se cierra para no quedar flotando sobre otro nombre.
    window.addEventListener('scroll',event=>{if(!this.card.contains(event.target))this.dismiss();},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.dismiss();});
  }
  setProfiles(profiles) {this.profiles=profiles;this.enabled=true;}
  lock() {this.dismiss();this.profiles=new Map();this.card.replaceChildren();this.enabled=false;}
  button(id, historicalName) {
    const profile=this.profiles.get(id), name=profile?.nickname || historicalName;
    const button=document.createElement('button');button.type='button';button.className='participant-trigger';
    button.setAttribute('aria-label','Ver perfil de '+name);button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-controls',this.card.id);button.setAttribute('aria-expanded','false');
    const text=document.createElement('span');text.className='participant-name';text.textContent=name;
    button.append(this.avatar(id,name),text,this.badges(profile?.owner?.split('::')[0]));
    const queue=()=>{if(!this.enabled || this.pinned || this.suppressFocus===button)return;clearTimeout(this.showTimer);clearTimeout(this.hideTimer);this.showTimer=setTimeout(()=>{if(button.isConnected)this.show(button,id,historicalName);},HOVER_DELAY);};
    button.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')queue();});
    button.addEventListener('pointerleave',()=>{clearTimeout(this.showTimer);this.scheduleHide();});
    button.addEventListener('focus',queue);
    button.addEventListener('blur',()=>{if(this.suppressFocus===button)this.suppressFocus=null;clearTimeout(this.showTimer);this.scheduleHide();});
    // Click, Enter y toque permiten abrirla sin depender de un cursor.
    button.addEventListener('click',()=>{clearTimeout(this.showTimer);if(this.active===button && !this.card.hidden && this.pinned)this.dismiss();else this.show(button,id,historicalName,true);});
    return button;
  }
  scheduleHide() {
    clearTimeout(this.hideTimer);this.hideTimer=setTimeout(()=>{
      if(this.pinned || this.card.matches(':hover') || this.active?.matches(':hover') || this.card.contains(document.activeElement) || this.active===document.activeElement)return;
      this.dismiss();
    },180);
  }
  dismiss() {clearTimeout(this.showTimer);clearTimeout(this.hideTimer);this.active?.setAttribute('aria-expanded','false');this.active=null;this.pinned=false;this.card.hidden=true;}
  show(button,id,historicalName,pin=false) {
    if(!this.enabled)return;
    this.dismiss();this.active=button;this.pinned=pin;button.setAttribute('aria-expanded','true');
    const profile=this.profiles.get(id), name=profile?.nickname || historicalName;
    this.card.replaceChildren();this.card.setAttribute('aria-label','Perfil de '+name);
    const close=document.createElement('button');close.type='button';close.className='profile-preview-close';close.textContent='×';close.setAttribute('aria-label','Cerrar vista previa');
    close.addEventListener('click',()=>{this.suppressFocus=button;this.dismiss();button.focus({preventScroll:true});});
    const head=document.createElement('div');head.className='profile-preview-heading';
    const title=document.createElement('h3');title.textContent=name;head.append(this.avatar(id,name),title);
    const bio=document.createElement('p');bio.className='profile-preview-bio';bio.textContent=profile ? profile.bio?.trim() || 'Todavía no agregó una biografía.' : 'Este perfil ya no está disponible. El nombre corresponde al registro del torneo.';
    this.card.append(close,head,this.badges(profile?.owner?.split('::')[0]),bio);
    const help=document.createElement('small');help.textContent='Perfil del club';this.card.append(help);
    this.card.hidden=false;this.position();
  }
  position() {
    if(!this.active?.isConnected)return this.dismiss();
    const rect=this.active.getBoundingClientRect(), card=this.card.getBoundingClientRect(), gap=10, margin=12;
    const left=Math.max(margin,Math.min(rect.left,window.innerWidth-card.width-margin));
    const below=rect.bottom+gap;
    const top=below+card.height<=window.innerHeight-margin ? below : Math.max(margin,rect.top-card.height-gap);
    this.card.style.left=left+'px';this.card.style.top=top+'px';
  }
}
