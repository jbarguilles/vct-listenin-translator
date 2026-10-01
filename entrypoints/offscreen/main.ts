import { browser } from 'wxt/browser';
import { isOffscreenMsg, type BackgroundMsg, type Reply } from '@/lib/messages';
import { startPassthrough } from '@/lib/passthrough';

let stopCapture: (() => Promise<void>) | null = null;

async function start(streamId: string): Promise<void> {
  await stop();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId },
    },
    video: false,
  } as MediaStreamConstraints);

  // Fires if Chrome ends the capture (e.g. tab crashed), not on our own stop().
  stream.getAudioTracks()[0]?.addEventListener('ended', () => {
    stopCapture = null;
    void browser.runtime.sendMessage({ type: 'capture-ended' } satisfies BackgroundMsg);
  });

  stopCapture = startPassthrough(stream);
}

async function stop(): Promise<void> {
  const current = stopCapture;
  stopCapture = null;
  await current?.();
}

browser.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!isOffscreenMsg(msg)) return;
  const work = msg.type === 'start-capture' ? start(msg.streamId) : stop();
  work.then(
    () => sendResponse({ ok: true } satisfies Reply),
    (err: unknown) => sendResponse({ ok: false, error: String(err) } satisfies Reply),
  );
  return true; // keep the channel open for the async reply
});
