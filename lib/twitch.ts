/**
 * Selectors for the Twitch video player, most specific first. Twitch changes
 * its markup; re-verify in DevTools if the Armed chip stops appearing.
 */
export const PLAYER_SELECTORS = ['[data-a-target="video-player"]', '.video-player__container'];

export function isTwitchUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'twitch.tv' || hostname.endsWith('.twitch.tv');
  } catch {
    return false;
  }
}

export function findPlayer(doc: Document): HTMLElement | null {
  for (const selector of PLAYER_SELECTORS) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}
