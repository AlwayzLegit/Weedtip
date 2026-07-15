/**
 * Parses a YouTube or Vimeo watch URL into a safe, privacy-friendly embed URL.
 * Only these two providers are supported, so the storefront never frames an
 * arbitrary origin (the CSP frame-src is scoped to exactly these hosts).
 * Returns null for anything unrecognized.
 */
export type VideoEmbed = { provider: 'youtube' | 'vimeo'; embedUrl: string };

const YT_ID = /^[\w-]{6,20}$/;
const VIMEO_ID = /^\d{6,12}$/;

export function videoEmbed(url: string | null | undefined): VideoEmbed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '');

  // YouTube: watch?v=ID, youtu.be/ID, /embed/ID, /shorts/ID
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = u.searchParams.get('v');
    const fromPath = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1];
    const id = fromQuery ?? fromPath;
    if (id && YT_ID.test(id)) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).split('/')[0];
    if (id && YT_ID.test(id)) return { provider: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }

  // Vimeo: vimeo.com/ID, player.vimeo.com/video/ID
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.split('/').filter(Boolean).find((seg) => VIMEO_ID.test(seg));
    if (id) return { provider: 'vimeo', embedUrl: `https://player.vimeo.com/video/${id}` };
  }

  return null;
}
