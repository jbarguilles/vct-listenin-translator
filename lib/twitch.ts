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

/** The first player selector that matches now, so the chip anchors to the most specific element. */
export function playerSelector(doc: Document): string {
  return PLAYER_SELECTORS.find((selector) => doc.querySelector(selector)) ?? PLAYER_SELECTORS[0]!;
}
