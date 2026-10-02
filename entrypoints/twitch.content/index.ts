import './style.css';
import { browser } from 'wxt/browser';
import { createShadowRootUi } from 'wxt/utils/content-script-ui/shadow-root';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { renderChip } from '@/lib/chip';
import type { ArmingReply, BackgroundMsg, ContentMsg } from '@/lib/messages';
import { playerSelector } from '@/lib/twitch';

export default defineContentScript({
  matches: ['*://*.twitch.tv/*'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    let armed = false;
    const disarm = () => {
      browser.runtime.sendMessage({ type: 'disarm' } satisfies BackgroundMsg).catch(() => {});
    };

    const ui = await createShadowRootUi<HTMLElement>(ctx, {
      name: 'listenin-armed-chip',
      position: 'inline',
      anchor: () => playerSelector(document),
      append: 'last',
      onMount(container) {
        renderChip(container, armed, disarm);
        return container;
      },
    });
    // Twitch is a SPA that can replace the player in place; WXT's autoMount only notices
    // when no player exists, so re-parent the chip ourselves whenever its anchor changes.
    const sync = () => {
      const anchor = document.querySelector(playerSelector(document));
      if (anchor && ui.shadowHost.parentElement !== anchor) {
        ui.remove();
        ui.mount();
      } else if (!anchor && ui.mounted) {
        ui.remove();
      }
    };
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        sync();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => {
      observer.disconnect();
      ui.remove();
    });
    sync();

    const setArmed = (next: boolean) => {
      armed = next;
      if (ui.mounted) renderChip(ui.mounted, armed, disarm);
    };

    // A push from the background is newer than our initial query; don't let a late reply overwrite it.
    let sawPush = false;
    browser.runtime.onMessage.addListener((msg: ContentMsg) => {
      if ((msg as ContentMsg | null)?.type !== 'arming-changed') return;
      sawPush = true;
      setArmed(msg.armed);
    });

    const reply = (await browser.runtime
      .sendMessage({ type: 'get-arming' } satisfies BackgroundMsg)
      .catch(() => undefined)) as ArmingReply | undefined;
    if (!sawPush && reply) setArmed(reply.armed);
  },
});
