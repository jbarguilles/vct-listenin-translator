import { browser } from 'wxt/browser';
import type { ArmingStore } from './arming';

const STORAGE_KEY = 'armedTabId';

/** Session storage clears when the browser closes, which also ends any capture. */
export function sessionArmingStore(): ArmingStore {
  return {
    async get() {
      const stored = await browser.storage.session.get(STORAGE_KEY);
      return (stored[STORAGE_KEY] as number | null | undefined) ?? null;
    },
    async set(tabId) {
      await browser.storage.session.set({ [STORAGE_KEY]: tabId });
    },
  };
}
