// La fecha se guarda en UTC. La zona IANA conserva cómo la eligió el organizador.
export const noJudgeConsent = 'Este torneo no tiene juez. Acepto que el organizador decida el resultado final, incluso si participa en el torneo.';
export const consentVersion = 'NO_JUDGE_V1';
export const timeZones = ['America/Argentina/Buenos_Aires','America/Montevideo','America/Asuncion','America/Sao_Paulo','America/Santiago','America/Bogota','America/Lima','America/La_Paz','America/Caracas','America/Mexico_City','America/Guatemala','America/Costa_Rica','America/Panama','America/Santo_Domingo','America/Puerto_Rico','America/Havana','America/El_Salvador','America/Managua','America/Tegucigalpa','America/Port-au-Prince','America/Jamaica','UTC'];
const zoneNames=['Buenos Aires (Argentina)','Montevideo (Uruguay)','Asunción (Paraguay)','San Pablo (Brasil)','Santiago (Chile)','Bogotá (Colombia)','Lima (Perú)','La Paz (Bolivia)','Caracas (Venezuela)','Ciudad de México (México)','Guatemala','Costa Rica','Panamá','Santo Domingo (República Dominicana)','Puerto Rico','La Habana (Cuba)','El Salvador','Managua (Nicaragua)','Tegucigalpa (Honduras)','Puerto Príncipe (Haití)','Jamaica','UTC'];
export const zoneLabel = zone => zoneNames[timeZones.indexOf(zone)] || zone.replaceAll('_',' ');
function partsAt(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' });
  return Object.fromEntries(formatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
// Se prueban los offsets cercanos para detectar horas inexistentes o repetidas
// por cambios de horario. Nunca se elige silenciosamente una de dos horas.
export function localToUtc(value, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value || '');
  if (!match) throw new Error('Elegí el día y la hora del torneo.');
  const [year,month,day,hour,minute] = match.slice(1).map(Number);
  if (year<2026 || year>2100 || month<1 || month>12 || day<1 || day>31 || hour>23 || minute>59) throw new Error('Fecha u hora inválida.');
  const nominal = Date.UTC(year,month-1,day,hour,minute);
  const check = new Date(nominal);
  if (check.getUTCFullYear()!==year || check.getUTCMonth()!==month-1 || check.getUTCDate()!==day) throw new Error('Fecha inválida.');
  const offsets = new Set();
  for (let hours=-36;hours<=36;hours+=6) {
    const sample=nominal+hours*3600000, p=partsAt(new Date(sample),timeZone);
    offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-sample);
  }
  const candidates=[...offsets].map(offset=>nominal-offset).filter(timestamp=>{
    const p=partsAt(new Date(timestamp),timeZone);
    return p.year===year && p.month===month && p.day===day && p.hour===hour && p.minute===minute;
  });
  if (!candidates.length) throw new Error('Esa hora no existe en la zona elegida por un cambio de horario. Elegí otra.');
  if (candidates.length>1) throw new Error('Esa hora se repite por un cambio de horario. Elegí otra hora para evitar confusiones.');
  return new Date(candidates[0]).toISOString();
}
export function scheduleLabel(startsAt, timeZone) {
  if (!startsAt) return 'Sin fecha programada (torneo anterior)';
  try { return new Intl.DateTimeFormat('es-AR',{timeZone:timeZone || 'UTC',weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZoneName:'short'}).format(new Date(startsAt))+' · '+zoneLabel(timeZone || 'UTC'); }
  catch { return 'No pudimos leer la fecha programada.'; }
}
export function countdownLabel(startsAt,now=Date.now()) {
  const remaining=Math.ceil((new Date(startsAt).getTime()-now)/1000);
  if (!Number.isFinite(remaining)) return '';
  if (remaining<=0) return 'Horario de inicio alcanzado';
  const days=Math.floor(remaining/86400),hours=Math.floor(remaining%86400/3600),minutes=Math.floor(remaining%3600/60),seconds=remaining%60;
  return `Faltan ${days ? days+' d · ' : ''}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
