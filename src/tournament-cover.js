import { communityAction } from './community-api.js';

// La portada se prepara localmente y sólo se sube al publicar, nunca al avanzar de etapa.
export async function prepareCover(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || !file.size) {
    throw new Error('Elegí una imagen JPG, PNG o WebP de hasta 5 MB.');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('La imagen es demasiado pesada. Probá con otra más pequeña.');
    return blob;
  } finally { bitmap.close(); }
}

export async function uploadTournamentCover(tournamentId, blob) {
  const grant = await communityAction('COVER_UPLOAD', { tournamentId, contentType: blob.type, size: blob.size });
  const response = await fetch(grant.url, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error('No pudimos subir la portada. Reintentá; todavía no se inició ningún cobro.');
  return grant.path;
}

export async function tournamentCoverUrl(tournamentId) {
  return (await communityAction('COVER_URL', { tournamentId })).url;
}
