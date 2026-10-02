export interface PopupState {
  keysComplete: boolean;
  onTwitch: boolean;
  armed: boolean;
}

export interface PopupView {
  armLabel: 'Arm' | 'Disarm';
  armDisabled: boolean;
  hint: string;
}

export function popupView({ keysComplete, onTwitch, armed }: PopupState): PopupView {
  if (armed) return { armLabel: 'Disarm', armDisabled: false, hint: 'Armed: this tab’s audio is being captured.' };
  if (!keysComplete) return { armLabel: 'Arm', armDisabled: true, hint: 'Save both API keys to arm.' };
  if (!onTwitch) return { armLabel: 'Arm', armDisabled: true, hint: 'Open a Twitch stream to arm.' };
  return { armLabel: 'Arm', armDisabled: false, hint: 'Ready. Arming captures this tab’s audio.' };
}
