import { browser } from 'wxt/browser';
import { keysComplete, loadKeys, saveKeys } from '@/lib/keys';
import type { ArmingReply, BackgroundMsg, Reply } from '@/lib/messages';
import { popupView } from '@/lib/popup-view';
import { isTwitchUrl } from '@/lib/twitch';

const gladiaInput = document.querySelector<HTMLInputElement>('#gladia-key')!;
const anthropicInput = document.querySelector<HTMLInputElement>('#anthropic-key')!;
const keysForm = document.querySelector<HTMLFormElement>('#keys-form')!;
const saved = document.querySelector<HTMLParagraphElement>('#saved')!;
const armButton = document.querySelector<HTMLButtonElement>('#arm')!;
const hint = document.querySelector<HTMLParagraphElement>('#hint')!;
const error = document.querySelector<HTMLParagraphElement>('#error')!;

function send<T>(msg: BackgroundMsg): Promise<T | undefined> {
  return browser.runtime.sendMessage(msg) as Promise<T | undefined>;
}

async function refresh() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  const keys = await loadKeys();
  const armed =
    tab?.id === undefined ? false : ((await send<ArmingReply>({ type: 'get-arming', tabId: tab.id }))?.armed ?? false);

  const view = popupView({ keysComplete: keysComplete(keys), onTwitch: isTwitchUrl(tab?.url), armed });
  armButton.textContent = view.armLabel;
  armButton.disabled = view.armDisabled;
  hint.textContent = view.hint;
  return { tab, armed };
}

keysForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await saveKeys({ gladia: gladiaInput.value, anthropic: anthropicInput.value });
    saved.textContent = 'Keys saved.';
    error.textContent = '';
  } catch (err) {
    error.textContent = err instanceof Error ? err.message : String(err);
  }
  await refresh().catch(() => {});
});

armButton.addEventListener('click', async () => {
  if (armButton.disabled) return;
  armButton.disabled = true;
  try {
    const { tab, armed } = await refresh();
    armButton.disabled = true;
    if (tab?.id === undefined) return;
    const reply = await send<Reply>(armed ? { type: 'disarm' } : { type: 'arm', tabId: tab.id });
    error.textContent = !reply ? 'No response from the extension. Try again.' : reply.ok ? '' : reply.error;
  } catch (err) {
    error.textContent = err instanceof Error ? err.message : String(err);
  } finally {
    await refresh().catch(() => {});
  }
});

// No top-level await: Vite's default build target rejects it.
void (async () => {
  const keys = await loadKeys();
  gladiaInput.value = keys.gladia;
  anthropicInput.value = keys.anthropic;
  await refresh();
})().catch((err: unknown) => {
  error.textContent = err instanceof Error ? err.message : String(err);
});
