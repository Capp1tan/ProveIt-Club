// Los distintos eventos comparten una sola presentación, sin formularios dentro de la campana.
export function notificationItems(invitations=[],feed={}){
 const items=[],tournaments=new Map();
 for(const i of invitations){const key=i.tournamentId+':'+(i.termsVersion || 0);if(!tournaments.has(key))tournaments.set(key,[]);tournaments.get(key).push(i);}
 for(const [key,invites] of tournaments){const i=invites[0],judge=invites.some(x=>x.role==='JUDGE'),player=invites.some(x=>x.role==='PARTICIPANT');items.push({id:'tournament:'+key,text:i.termsChangedBy
 ?(i.termsChangedBy==='JUDGE'?'El juez o jurado cambió las condiciones de «':'El organizador cambió las condiciones de «')+i.tournamentName+'». Revisalas antes de volver a confirmar tu participación.'
 :judge&&player?'Te invitaron a competir y ser juez en «'+i.tournamentName+'».':judge?'Te invitaron como juez a «'+i.tournamentName+'».':'Te invitaron a «'+i.tournamentName+'».',href:'/torneo.html?id='+encodeURIComponent(i.tournamentId),icon:judge?'judge':'tournament'});}
 const requests=new Set();for(const p of feed.friendRequests || []){if(!p.profileId || requests.has(p.profileId))continue;requests.add(p.profileId);items.push({id:'friend:'+p.profileId,text:(p.nickname || 'Una persona')+' te envió una solicitud de amistad.',href:'/amigos.html',profileId:p.profileId,avatarPath:p.avatarPath,icon:'friend'});}
 for(const n of feed.announcements || []){if(!n.id || (!n.title && !n.message))continue;let href=null;try{const u=new URL(n.href,'https://proveitclub.win');if(n.href && u.origin==='https://proveitclub.win' && !u.username && !u.password)href=u.pathname+u.search+u.hash;}catch{}items.push({id:'notice:'+n.id,text:[n.title,n.message].filter(Boolean).join(' · '),href,icon:'site'});}
 return items.slice(0,60);
}
