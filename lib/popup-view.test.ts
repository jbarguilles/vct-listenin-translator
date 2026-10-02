import { describe, expect, it } from 'vitest';
import { popupView } from './popup-view';

describe('popupView', () => {
  it('offers Disarm whenever the tab is Armed', () => {
    expect(popupView({ keysComplete: false, onTwitch: false, armed: true })).toEqual({
      armLabel: 'Disarm',
      armDisabled: false,
      hint: 'Armed: this tab’s audio is being captured.',
    });
  });

  it('blocks arming until both keys are saved', () => {
    const view = popupView({ keysComplete: false, onTwitch: true, armed: false });
    expect(view.armDisabled).toBe(true);
    expect(view.hint).toBe('Save both API keys to arm.');
  });

  it('blocks arming off Twitch', () => {
    const view = popupView({ keysComplete: true, onTwitch: false, armed: false });
    expect(view.armDisabled).toBe(true);
    expect(view.hint).toBe('Open a Twitch stream to arm.');
  });

  it('is ready on Twitch with keys', () => {
    expect(popupView({ keysComplete: true, onTwitch: true, armed: false })).toEqual({
      armLabel: 'Arm',
      armDisabled: false,
      hint: 'Ready. Arming captures this tab’s audio.',
    });
  });
});
