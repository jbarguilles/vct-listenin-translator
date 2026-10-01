import { beforeEach, describe, expect, it } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { keysComplete, loadKeys, saveKeys } from './keys';

describe('keys', () => {
  beforeEach(() => fakeBrowser.reset());

  it('loads empty keys when none are saved', async () => {
    expect(await loadKeys()).toEqual({ gladia: '', anthropic: '' });
  });

  it('saves trimmed keys and loads them back', async () => {
    await saveKeys({ gladia: '  g-123 ', anthropic: '\tsk-ant-456\n' });
    expect(await loadKeys()).toEqual({ gladia: 'g-123', anthropic: 'sk-ant-456' });
  });

  it('is complete only when both keys are non-blank', () => {
    expect(keysComplete({ gladia: 'g', anthropic: 'a' })).toBe(true);
    expect(keysComplete({ gladia: 'g', anthropic: '' })).toBe(false);
    expect(keysComplete({ gladia: '   ', anthropic: 'a' })).toBe(false);
  });
});
