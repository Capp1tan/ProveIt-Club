let galleryEndpointPromise;

async function winnerGalleryEndpoint() {
  if (!galleryEndpointPromise) {
    galleryEndpointPromise = fetch('/amplify_outputs.json', { cache: 'no-cache' })
      .then((response) => response.ok ? response.json() : null)
      .then((outputs) => outputs?.custom?.winnerGalleryFeedUrl || '')
      .catch(() => '');
  }
  return galleryEndpointPromise;
}

export async function loadWinnerGallery() {
  const endpoint = await winnerGalleryEndpoint();
  if (!endpoint) return [];
  const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) return [];
  const result = await response.json();
  return Array.isArray(result.photos) ? result.photos.slice(0, 40) : [];
}
