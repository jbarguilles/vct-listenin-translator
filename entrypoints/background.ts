import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { ArmingController } from '@/lib/arming';
import { sessionArmingStore } from '@/lib/arming-store';
import { keysComplete, loadKeys } from '@/lib/keys';
import type { ArmingReply, BackgroundMsg, ContentMsg, OffscreenMsg, Reply } from '@/lib/messages';

async function hasOffscreenDocument(): Promise<boolean> {
  const contexts = await browser.runtime.getContexts({
    contextTypes: [browser.runtime.ContextType.OFFSCREEN_DOCUMENT],
  });
  return contexts.length > 0;
}

async function sendToOffscreen(msg: OffscreenMsg): Promise<void> {
  const reply = (await browser.runtime.sendMessage(msg)) as Reply | undefined;
  if (!reply?.ok) throw new Error(reply?.error ?? 'Offscreen document did not respond');
}

export default defineBackground(() => {
  const controller = new ArmingController(sessionArmingStore(), {
    getStreamId: (tabId) => browser.tabCapture.getMediaStreamId({ targetTabId: tabId }),

    async startCapture(streamId) {
      if (!(await hasOffscreenDocument())) {
        await browser.offscreen.createDocument({
          url: 'offscreen.html',
          reasons: [browser.offscreen.Reason.USER_MEDIA],
          justification: 'Capture the Armed Twitch tab audio and play it back to the Viewer.',
        });
      }
      await sendToOffscreen({ target: 'offscreen', type: 'start-capture', streamId });
    },

    async stopCapture() {
      if (!(await hasOffscreenDocument())) return;
      await sendToOffscreen({ target: 'offscreen', type: 'stop-capture' }).catch(() => {});
      // May race a document that is already closing; either way it's gone.
      await browser.offscreen.closeDocument().catch(() => {});
    },

    notifyTab(tabId, armed) {
      // The tab may have no content script (not Twitch) or be gone; that's fine.
      browser.tabs.sendMessage(tabId, { type: 'arming-changed', armed } satisfies ContentMsg).catch(() => {});
    },
  });

  async function arm(tabId: number): Promise<Reply> {
    try {
      if (!keysComplete(await loadKeys())) return { ok: false, error: 'Save both API keys first.' };
      await controller.arm(tabId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
    if (typeof raw !== 'object' || raw === null) return;
    const msg = raw as BackgroundMsg;
    switch (msg.type) {
      case 'arm':
        void arm(msg.tabId).then(sendResponse);
        return true;
      case 'disarm':
        void controller.disarm().then(() => sendResponse({ ok: true } satisfies Reply));
        return true;
      case 'get-arming': {
        const tabId = msg.tabId ?? sender.tab?.id;
        void controller
          .armedTabId()
          .then((armedId) => sendResponse({ armed: tabId !== undefined && armedId === tabId } satisfies ArmingReply))
          .catch(() => sendResponse({ armed: false } satisfies ArmingReply));
        return true;
      }
      case 'capture-ended':
        void controller.disarm();
        return;
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => void controller.handleTabClosed(tabId));
});
