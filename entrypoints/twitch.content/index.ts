import './style.css';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { renderChip } from '@/lib/chip';
import type { ArmingReply, BackgroundMsg, ContentMsg } from '@/lib/messages';
import { findPlayer } from '@/lib/twitch';

export default defineContentScript({
  matches: ['*://*.twitch.tv/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let armed = false;
    const disarm = () => void browser.runtime.sendMessage({ type: 'disarm' } satisfies BackgroundMsg);

    const ui = await createShadowRootUi<HTMLElement>(ctx, {
      name: 'listenin-armed-chip',
      position: 'inline',
      anchor: () => findPlayer(document),
      append: 'last',
      onMount(container) {
        renderChip(container, armed, disarm);
        return container;
      },
    });
    // Twitch is a SPA: the player is replaced on navigation, so follow it.
    ui.autoMount();

    const setArmed = (next: boolean) => {
      armed = next;
      if (ui.mounted) renderChip(ui.mounted, armed, disarm);
    };

    browser.runtime.onMessage.addListener((msg: ContentMsg) => {
      if (msg.type === 'arming-changed') setArmed(msg.armed);
    });

    const reply = (await browser.runtime.sendMessage({ type: 'get-arming' } satisfies BackgroundMsg)) as ArmingReply;
    setArmed(reply.armed);
  },
});
