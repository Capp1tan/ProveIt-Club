const el=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const icons={
 instagram:'<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7"/>',
 twitch:'<path d="M4 3h17v12l-5 5h-5l-4 3v-3H3V6zM8 3v13h4v3l3-3h4V3M12 7v5m4-5v5"/>',
 discord:'<path d="M8 5 5 6 2 17l5 2 1-2m8-12 3 1 3 11-5 2-1-2M7 8c3-2 7-2 10 0M6 16c4 2 8 2 12 0"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/>',
 custom:'<path d="m9 15 6-6m-7 9-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 8a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1"/>'
};
export function socialLinks(profile){
 const root=el('div','','profile-social-links');if(!profile?.canView)return root;
 let links;try{links=JSON.parse(profile.socialLinks || '{}');}catch{return root;}
 for(const [key,value] of Object.entries(links)){
  if(!icons[key] || !value)continue;const label={instagram:'Instagram',twitch:'Twitch',discord:'Discord',custom:'Enlace personal'}[key];
  const copy=key==='discord' && !value.startsWith('https://'),node=el(copy?'button':'a','','social-icon');
  node.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">'+icons[key]+'</svg>';
  const text=el('span',label);node.append(text);node.title=copy?'Copiar usuario de Discord':'Abrir '+label;node.setAttribute('aria-label',node.title);
  if(copy){node.type='button';node.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(value);text.textContent='Copiado';}catch{text.textContent=value;}});}
  else{try{const u=new URL(value);if(u.protocol!=='https:' || u.username || u.password)continue;node.href=u.href;node.target='_blank';node.rel='noopener noreferrer';}catch{continue;}}
  root.append(node);
 }return root;
}
export function reputationPanel(rep,enabled=false){
 const root=el('section','','judge-reputation');if(!enabled && !(rep?.events || rep?.votes || rep?.confirmedReports))return root;
 root.append(el('h3','Reputación como juez'));
 if(!rep){root.append(el('p','Cargando reputación…'));return root;}
 if(rep.stars===null)root.append(el('p','Sin valoraciones'));
 else{
  const stars=el('div','','judge-stars');stars.setAttribute('role','img');stars.setAttribute('aria-label',rep.stars+' de 5 estrellas');
  const base=el('span','★★★★★'),fill=el('span','★★★★★');fill.style.width=(rep.stars/5*100)+'%';stars.append(base,fill);root.append(stars,el('strong',rep.stars.toLocaleString('es')+' / 5'));
 }
 root.append(el('p',rep.events+' torneos arbitrados · '+rep.votes+' valoraciones'),el('small',rep.positive+' positivas · '+rep.negative+' negativas · '+rep.confirmedReports+' reclamos confirmados'));
 if(rep.votes>0 && rep.votes<5)root.append(el('small','Pocas valoraciones. Consultá también la cantidad de eventos.'));
 root.append(el('small','Las estrellas reflejan votos: 1 + 4 × proporción positiva. Los reclamos se muestran por separado.'));
 if(rep.comments?.length){
  const comments=el('details','','judge-comment-list');
  comments.append(el('summary','Comentarios recibidos ('+rep.comments.length+')'));
  for(const entry of rep.comments){
   const item=el('article','','judge-feedback');
   item.append(el('strong',entry.tournamentName),el('p',entry.comment));
   comments.append(item);
  }
  root.append(comments);
 }
 return root;
}
