/** Generic success/failure reply for commands. */
export type Reply = { ok: true } | { ok: false; error: string };

/** Messages handled by the background service worker. */
export type BackgroundMsg =
  | { type: 'arm'; tabId: number }
  | { type: 'disarm' }
  | { type: 'get-arming'; tabId?: number }
  | { type: 'capture-ended' };

/** Reply to `get-arming`: whether the given (or sending) tab is Armed. */
export interface ArmingReply {
  armed: boolean;
}

/** Messages sent from background to the Twitch content script. */
export type ContentMsg = { type: 'arming-changed'; armed: boolean };

/** Messages handled by the offscreen document. */
export type OffscreenMsg =
  | { target: 'offscreen'; type: 'start-capture'; streamId: string }
  | { target: 'offscreen'; type: 'stop-capture' };

export function isOffscreenMsg(msg: unknown): msg is OffscreenMsg {
  return typeof msg === 'object' && msg !== null && (msg as { target?: unknown }).target === 'offscreen';
}
