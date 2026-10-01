// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { findPlayer, isTwitchUrl } from './twitch';

describe('isTwitchUrl', () => {
  it('accepts twitch.tv and its subdomains', () => {
    expect(isTwitchUrl('https://www.twitch.tv/valorant')).toBe(true);
    expect(isTwitchUrl('https://twitch.tv/videos/123')).toBe(true);
    expect(isTwitchUrl('https://m.twitch.tv/valorant')).toBe(true);
  });

  it('rejects other hosts, garbage, and missing urls', () => {
    expect(isTwitchUrl('https://nottwitch.tv/x')).toBe(false);
    expect(isTwitchUrl('https://youtube.com/watch?v=1')).toBe(false);
    expect(isTwitchUrl('not a url')).toBe(false);
    expect(isTwitchUrl(undefined)).toBe(false);
  });
});

describe('findPlayer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers the data-a-target player', () => {
    document.body.innerHTML =
      '<div class="video-player__container"><div data-a-target="video-player" id="p"></div></div>';
    expect(findPlayer(document)?.id).toBe('p');
  });

  it('falls back to the player container class', () => {
    document.body.innerHTML = '<div class="video-player__container" id="c"></div>';
    expect(findPlayer(document)?.id).toBe('c');
  });

  it('returns null when there is no player', () => {
    expect(findPlayer(document)).toBeNull();
  });
});
