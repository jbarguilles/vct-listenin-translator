import { browser } from 'wxt/browser';
import { keysComplete, loadKeys, saveKeys } from '@/lib/keys';
import type { ArmingReply, BackgroundMsg, Reply } from '@/lib/messages';
import { popupView } from '@/lib/popup-view';
import { isTwitchUrl } from '@/lib/twitch';

const gladiaInput = document.querySelector<HTMLInputElement>('#gladia-key')!;
const anthropicInput = document.querySelector<HTMLInputElement>('#anthropic-key')!;
const saveButton = document.querySelector<HTMLButtonElement>('#save-keys')!;
const armButton = document.querySelector<HTMLButtonElement>('#arm')!;
const hint = document.querySelector<HTMLParagraphElement>('#hint')!;
const error = document.querySelector<HTMLParagraphElement>('#error')!;

function send<T>(msg: BackgroundMsg): Promise<T> {
  return browser.runtime.sendMessage(msg) as Promise<T>;
}

async function refresh() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const keys = await loadKeys();
  const { armed } =
    tab?.id === undefined ? { armed: false } : await send<ArmingReply>({ type: 'get-arming', tabId: tab.id });

  const view = popupView({ keysComplete: keysComplete(keys), onTwitch: isTwitchUrl(tab?.url), armed });
  armButton.textContent = view.armLabel;
  armButton.disabled = view.armDisabled;
  hint.textContent = view.hint;
  return { tab, armed };
}

saveButton.addEventListener('click', async () => {
  await saveKeys({ gladia: gladiaInput.value, anthropic: anthropicInput.value });
  error.textContent = '';
  await refresh();
});

armButton.addEventListener('click', async () => {
  const { tab, armed } = await refresh();
  if (tab?.id === undefined) return;
  armButton.disabled = true;
  const reply = await send<Reply>(armed ? { type: 'disarm' } : { type: 'arm', tabId: tab.id });
  error.textContent = reply.ok ? '' : reply.error;
  await refresh();
});

// No top-level await: Vite's default build target rejects it.
void (async () => {
  const keys = await loadKeys();
  gladiaInput.value = keys.gladia;
  anthropicInput.value = keys.anthropic;
  await refresh();
})();
