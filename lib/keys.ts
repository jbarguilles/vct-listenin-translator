import { browser } from 'wxt/browser';

/** The Viewer's own provider keys (ADR-0001, ADR-0002). */
export interface ApiKeys {
  gladia: string;
  anthropic: string;
}

const STORAGE_KEY = 'apiKeys';
const EMPTY: ApiKeys = { gladia: '', anthropic: '' };

export async function loadKeys(): Promise<ApiKeys> {
  const stored = await browser.storage.local.get(STORAGE_KEY);
  return { ...EMPTY, ...(stored[STORAGE_KEY] as Partial<ApiKeys> | undefined) };
}

export async function saveKeys(keys: ApiKeys): Promise<void> {
  const trimmed: ApiKeys = { gladia: keys.gladia.trim(), anthropic: keys.anthropic.trim() };
  await browser.storage.local.set({ [STORAGE_KEY]: trimmed });
}

export function keysComplete(keys: ApiKeys): boolean {
  return keys.gladia.trim() !== '' && keys.anthropic.trim() !== '';
}
