// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { isTwitchUrl, playerSelector } from './twitch';

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

describe('playerSelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers the data-a-target player when both exist', () => {
    document.body.innerHTML =
      '<div class="video-player__container"><div data-a-target="video-player"></div></div>';
    expect(playerSelector(document)).toBe('[data-a-target="video-player"]');
  });

  it('falls back to the player container class when only it exists', () => {
    document.body.innerHTML = '<div class="video-player__container"></div>';
    expect(playerSelector(document)).toBe('.video-player__container');
  });

  it('returns the default selector when there is no player', () => {
    expect(playerSelector(document)).toBe('[data-a-target="video-player"]');
  });
});
