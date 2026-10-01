# W1: Tab Capture and Armed State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Viewer can Arm a Twitch tab from the extension popup, the tab's Broadcast mix is captured while its audio keeps playing, an "Armed · listening" chip shows in the Twitch player, and clicking the chip disarms.

**Architecture:** The background service worker owns the Armed state through an `ArmingController`, a pure class with injected ports so it can be unit tested. The state is persisted in `storage.session` because the service worker sleeps. Capture runs in an offscreen document: it calls `getUserMedia` with a tab stream ID and routes the stream back to the speakers through an `AudioContext` so the tab isn't muted. A Twitch content script renders the chip in a shadow root anchored to the player. The popup stores the Viewer's two API keys and arms or disarms the active tab. No audio leaves the machine in W1; Gladia comes in W2.

**Tech Stack:** WXT 0.21 (Manifest V3, Vite), TypeScript, Vitest + `wxt/testing` (fake browser), happy-dom for DOM tests. Chromium only.

Vocabulary follows `CONTEXT.md` (Armed, Viewer, Broadcast mix). Decisions: `docs/adr/`.

---

## File Structure

```
wxt.config.ts                       manifest + permissions
vitest.config.ts                    WxtVitest plugin
tsconfig.json                       extends WXT's generated config
lib/
  messages.ts                       message + reply types shared by all contexts
  keys.ts (+ .test.ts)              Viewer API keys: load/save/complete
  twitch.ts (+ .test.ts)            Twitch URL check + player anchor lookup
  arming.ts (+ .test.ts)            ArmingController (pure) + ports/store interfaces
  arming-store.ts                   storage.session-backed ArmingStore
  passthrough.ts (+ .test.ts)       MediaStream -> speakers via AudioContext
  chip.ts (+ .test.ts)              renders the Armed chip into a container
  popup-view.ts (+ .test.ts)        popup button/hint state from inputs
entrypoints/
  background.ts                     wires ArmingController to chrome APIs
  offscreen/index.html, main.ts     getUserMedia(tab) + passthrough
  twitch.content/index.ts, style.css  Armed chip on twitch.tv
  popup/index.html, main.ts, style.css  key entry + Arm/Disarm
```

Each `lib/` file has one responsibility and no chrome-API calls except `keys.ts` and `arming-store.ts`, which use `browser.storage` (faked in tests). Entrypoints are thin glue.

---

### Task 1: Scaffold the WXT project

**Files:**
- Create: `package.json`, `wxt.config.ts`, `tsconfig.json`, `vitest.config.ts`
- Modify: `README.md`

- [ ] **Step 1: Branch**

```bash
cd ~/Documents/Jade/vct-listenin-translator
git checkout -b w1-tab-capture
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "vct-listenin-translator",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wxt",
    "build": "wxt build",
    "compile": "tsc --noEmit",
    "test": "vitest run",
    "postinstall": "wxt prepare"
  }
}
```

- [ ] **Step 3: Install dev dependencies**

Run: `npm i -D wxt typescript vitest happy-dom`
Expected: installs cleanly, and `postinstall` creates `.wxt/` (already gitignored).

- [ ] **Step 4: Create `wxt.config.ts`**

```ts
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'VCT Listen-in Translator',
    description: 'Live translated subtitles for VCT team comms Listen-ins.',
    permissions: ['tabCapture', 'offscreen', 'storage', 'activeTab'],
    minimum_chrome_version: '116',
  },
});
```

`activeTab` lets the popup read the active tab's URL and counts as the user invoking the extension, which `tabCapture.getMediaStreamId` requires. Chrome 116 is the first version where the service worker can call `getMediaStreamId`.

- [ ] **Step 5: Create `tsconfig.json` and `vitest.config.ts`**

```json
{
  "extends": "./.wxt/tsconfig.json"
}
```

```ts
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
});
```

- [ ] **Step 6: Add a placeholder background so the build has an entrypoint**

Create `entrypoints/background.ts`:

```ts
import { defineBackground } from 'wxt/utils/define-background';

export default defineBackground(() => {});
```

- [ ] **Step 7: Verify it builds**

Run: `npx wxt prepare && npm run compile && npm run build`
Expected: no type errors, and `.output/chrome-mv3/manifest.json` exists with the four permissions.

- [ ] **Step 8: Add a Development section to `README.md`**

Append:

```md
## Development

Requires Node 20+ and Chrome/Edge 116+.

    npm install
    npm run dev      # launches Chrome with the extension loaded
    npm test         # unit tests
    npm run build    # production build in .output/chrome-mv3
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json wxt.config.ts tsconfig.json vitest.config.ts entrypoints/background.ts README.md
git commit -m "chore: scaffold WXT extension"
```

---

### Task 2: Message types and Viewer API keys

**Files:**
- Create: `lib/messages.ts`, `lib/keys.ts`
- Test: `lib/keys.test.ts`

- [ ] **Step 1: Create `lib/messages.ts`** (types only, no test)

```ts
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
```

- [ ] **Step 2: Write the failing test `lib/keys.test.ts`**

```ts
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run lib/keys.test.ts`
Expected: FAIL. The import `./keys` can't be resolved.

- [ ] **Step 4: Implement `lib/keys.ts`**

```ts
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
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run lib/keys.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/messages.ts lib/keys.ts lib/keys.test.ts
git commit -m "feat: message types and Viewer API key storage"
```

---

### Task 3: Twitch helpers

**Files:**
- Create: `lib/twitch.ts`
- Test: `lib/twitch.test.ts`

- [ ] **Step 1: Write the failing test `lib/twitch.test.ts`**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { findPlayer, isTwitchUrl } from './twitch';

describe('isTwitchUrl', () => {
  it('accepts twitch.tv and its subdomains', () => {
    expect(isTwitchUrl('https://www.twitch.tv/valorant')).toBe(true);
    expect(isTwitchUrl('https://twitch.tv/videos/123')).toBe(true);
    expect(isTwitchUrl('https://m.twitch.tv/valorant')).toBe(true);
  });

  it('rejects other hosts, garbage, and missing urls', () => {
    expect(isTwitchUrl('https://nottwitch.tv/x')).toBe(false);
    expect(isTwitchUrl('https://youtube.com/watch?v=1')).toBe(false);
    expect(isTwitchUrl('not a url')).toBe(false);
    expect(isTwitchUrl(undefined)).toBe(false);
  });
});

describe('findPlayer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers the data-a-target player', () => {
    document.body.innerHTML =
      '<div class="video-player__container"><div data-a-target="video-player" id="p"></div></div>';
    expect(findPlayer(document)?.id).toBe('p');
  });

  it('falls back to the player container class', () => {
    document.body.innerHTML = '<div class="video-player__container" id="c"></div>';
    expect(findPlayer(document)?.id).toBe('c');
  });

  it('returns null when there is no player', () => {
    expect(findPlayer(document)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/twitch.test.ts`
Expected: FAIL. The import `./twitch` can't be resolved.

- [ ] **Step 3: Implement `lib/twitch.ts`**

```ts
/**
 * Selectors for the Twitch video player, most specific first. Twitch changes
 * its markup; re-verify in DevTools if the Armed chip stops appearing.
 */
export const PLAYER_SELECTORS = ['[data-a-target="video-player"]', '.video-player__container'];

export function isTwitchUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname === 'twitch.tv' || hostname.endsWith('.twitch.tv');
  } catch {
    return false;
  }
}

export function findPlayer(doc: Document): HTMLElement | null {
  for (const selector of PLAYER_SELECTORS) {
    const el = doc.querySelector<HTMLElement>(selector);
    if (el) return el;
  }
  return null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/twitch.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/twitch.ts lib/twitch.test.ts
git commit -m "feat: Twitch URL and player lookup helpers"
```

---

### Task 4: ArmingController

The background service worker can be stopped after about 30 s idle while the offscreen document keeps capturing. The Armed tab is therefore kept in an `ArmingStore` (backed by `storage.session` in production), never in a field.

Rules:
- Only one tab is Armed at a time. Arming tab B disarms tab A first.
- If capture fails to start, clean up and stay unarmed.
- Closing the Armed tab, or the capture ending on its own, disarms.

**Files:**
- Create: `lib/arming.ts`, `lib/arming-store.ts`
- Test: `lib/arming.test.ts`

- [ ] **Step 1: Write the failing test `lib/arming.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { ArmingController, type ArmingPorts, type ArmingStore } from './arming';

function setup(overrides: Partial<ArmingPorts> = {}) {
  let stored: number | null = null;
  const store: ArmingStore = {
    get: async () => stored,
    set: async (tabId) => {
      stored = tabId;
    },
  };
  const ports: ArmingPorts = {
    getStreamId: vi.fn(async (tabId: number) => `stream-${tabId}`),
    startCapture: vi.fn(async () => {}),
    stopCapture: vi.fn(async () => {}),
    notifyTab: vi.fn(),
    ...overrides,
  };
  return { controller: new ArmingController(store, ports), ports };
}

describe('ArmingController', () => {
  it('arms a tab: captures its stream and notifies it', async () => {
    const { controller, ports } = setup();
    await controller.arm(7);
    expect(ports.getStreamId).toHaveBeenCalledWith(7);
    expect(ports.startCapture).toHaveBeenCalledWith('stream-7');
    expect(ports.notifyTab).toHaveBeenCalledWith(7, true);
    expect(await controller.armedTabId()).toBe(7);
  });

  it('ignores arming the already Armed tab', async () => {
    const { controller, ports } = setup();
    await controller.arm(7);
    await controller.arm(7);
    expect(ports.startCapture).toHaveBeenCalledTimes(1);
  });

  it('disarms the previous tab before arming another', async () => {
    const { controller, ports } = setup();
    await controller.arm(7);
    await controller.arm(9);
    expect(ports.stopCapture).toHaveBeenCalledTimes(1);
    expect(ports.notifyTab).toHaveBeenCalledWith(7, false);
    expect(ports.notifyTab).toHaveBeenLastCalledWith(9, true);
    expect(await controller.armedTabId()).toBe(9);
  });

  it('disarms: stops capture and notifies the tab', async () => {
    const { controller, ports } = setup();
    await controller.arm(7);
    await controller.disarm();
    expect(ports.stopCapture).toHaveBeenCalledTimes(1);
    expect(ports.notifyTab).toHaveBeenLastCalledWith(7, false);
    expect(await controller.armedTabId()).toBeNull();
  });

  it('does nothing when disarming while not Armed', async () => {
    const { controller, ports } = setup();
    await controller.disarm();
    expect(ports.stopCapture).not.toHaveBeenCalled();
    expect(ports.notifyTab).not.toHaveBeenCalled();
  });

  it('cleans up and stays unarmed when capture fails to start', async () => {
    const { controller, ports } = setup({
      startCapture: vi.fn(async () => {
        throw new Error('Permission denied');
      }),
    });
    await expect(controller.arm(7)).rejects.toThrow('Permission denied');
    expect(ports.stopCapture).toHaveBeenCalledTimes(1);
    expect(ports.notifyTab).not.toHaveBeenCalled();
    expect(await controller.armedTabId()).toBeNull();
  });

  it('disarms when the Armed tab is closed, ignores other tabs', async () => {
    const { controller, ports } = setup();
    await controller.arm(7);
    await controller.handleTabClosed(3);
    expect(ports.stopCapture).not.toHaveBeenCalled();
    await controller.handleTabClosed(7);
    expect(ports.stopCapture).toHaveBeenCalledTimes(1);
    expect(await controller.armedTabId()).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/arming.test.ts`
Expected: FAIL. The import `./arming` can't be resolved.

- [ ] **Step 3: Implement `lib/arming.ts`**

```ts
/** Where the Armed tab id lives; must survive service worker restarts. */
export interface ArmingStore {
  get(): Promise<number | null>;
  set(tabId: number | null): Promise<void>;
}

/** Side effects the controller needs; real chrome APIs in background.ts. */
export interface ArmingPorts {
  getStreamId(tabId: number): Promise<string>;
  startCapture(streamId: string): Promise<void>;
  stopCapture(): Promise<void>;
  notifyTab(tabId: number, armed: boolean): void;
}

/** Owns the Armed state: at most one tab's Broadcast mix is captured. */
export class ArmingController {
  constructor(
    private readonly store: ArmingStore,
    private readonly ports: ArmingPorts,
  ) {}

  armedTabId(): Promise<number | null> {
    return this.store.get();
  }

  async arm(tabId: number): Promise<void> {
    const current = await this.store.get();
    if (current === tabId) return;
    if (current !== null) await this.disarm();

    try {
      const streamId = await this.ports.getStreamId(tabId);
      await this.ports.startCapture(streamId);
    } catch (err) {
      await this.ports.stopCapture();
      throw err;
    }
    await this.store.set(tabId);
    this.ports.notifyTab(tabId, true);
  }

  async disarm(): Promise<void> {
    const current = await this.store.get();
    if (current === null) return;
    await this.store.set(null);
    await this.ports.stopCapture();
    this.ports.notifyTab(current, false);
  }

  async handleTabClosed(tabId: number): Promise<void> {
    if ((await this.store.get()) === tabId) await this.disarm();
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/arming.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Implement `lib/arming-store.ts`** (thin glue around `storage.session`, so no unit test)

```ts
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
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm run compile`
Expected: no errors

```bash
git add lib/arming.ts lib/arming.test.ts lib/arming-store.ts
git commit -m "feat: ArmingController with session-persisted Armed tab"
```

---

### Task 5: Audio passthrough

Capturing a tab mutes it for the Viewer. Connecting the captured stream to an `AudioContext`'s destination plays it again.

**Files:**
- Create: `lib/passthrough.ts`
- Test: `lib/passthrough.test.ts`

- [ ] **Step 1: Write the failing test `lib/passthrough.test.ts`**

```ts
import { describe, expect, it, vi } from 'vitest';
import { startPassthrough } from './passthrough';

function fakes() {
  const destination = {};
  const source = { connect: vi.fn() };
  const ctx = {
    destination,
    createMediaStreamSource: vi.fn(() => source),
    close: vi.fn(async () => {}),
  };
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { destination, source, ctx, track, stream };
}

describe('startPassthrough', () => {
  it('routes the stream to the speakers', () => {
    const { destination, source, ctx, stream } = fakes();
    startPassthrough(stream, () => ctx as unknown as AudioContext);
    expect(ctx.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(source.connect).toHaveBeenCalledWith(destination);
  });

  it('stop() ends the capture and closes the context', async () => {
    const { ctx, track, stream } = fakes();
    const stop = startPassthrough(stream, () => ctx as unknown as AudioContext);
    await stop();
    expect(track.stop).toHaveBeenCalled();
    expect(ctx.close).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/passthrough.test.ts`
Expected: FAIL. The import `./passthrough` can't be resolved.

- [ ] **Step 3: Implement `lib/passthrough.ts`**

```ts
/**
 * Plays a captured tab stream back to the speakers so the tab isn't muted
 * while Armed. Returns a function that ends the capture.
 */
export function startPassthrough(
  stream: MediaStream,
  makeContext: () => AudioContext = () => new AudioContext(),
): () => Promise<void> {
  const ctx = makeContext();
  ctx.createMediaStreamSource(stream).connect(ctx.destination);
  return async () => {
    for (const track of stream.getTracks()) track.stop();
    await ctx.close();
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/passthrough.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/passthrough.ts lib/passthrough.test.ts
git commit -m "feat: audio passthrough for captured tab"
```

---

### Task 6: Offscreen capture document

MV3 service workers can't call `getUserMedia`, so the offscreen document does it. Unit tests cover the logic it relies on (`startPassthrough`). This glue is checked manually in Task 10.

**Files:**
- Create: `entrypoints/offscreen/index.html`, `entrypoints/offscreen/main.ts`

- [ ] **Step 1: Create `entrypoints/offscreen/index.html`**

WXT builds `entrypoints/offscreen/index.html` as the unlisted page `/offscreen.html`.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Listen-in capture</title>
  </head>
  <body>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Create `entrypoints/offscreen/main.ts`**

```ts
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
```

- [ ] **Step 3: Typecheck and build**

Run: `npm run compile && npm run build`
Expected: no errors, and `.output/chrome-mv3/offscreen.html` exists.

- [ ] **Step 4: Commit**

```bash
git add entrypoints/offscreen
git commit -m "feat: offscreen document captures tab audio with passthrough"
```

---

### Task 7: Background wiring

**Files:**
- Modify: `entrypoints/background.ts` (replace the placeholder)

- [ ] **Step 1: Replace `entrypoints/background.ts`**

```ts
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
      await browser.offscreen.closeDocument();
    },

    notifyTab(tabId, armed) {
      // The tab may have no content script (not Twitch) or be gone; that's fine.
      browser.tabs.sendMessage(tabId, { type: 'arming-changed', armed } satisfies ContentMsg).catch(() => {});
    },
  });

  async function arm(tabId: number): Promise<Reply> {
    if (!keysComplete(await loadKeys())) return { ok: false, error: 'Save both API keys first.' };
    try {
      await controller.arm(tabId);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  browser.runtime.onMessage.addListener((raw, sender, sendResponse) => {
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
          .then((armedId) => sendResponse({ armed: tabId !== undefined && armedId === tabId } satisfies ArmingReply));
        return true;
      }
      case 'capture-ended':
        void controller.disarm();
        return;
    }
  });

  browser.tabs.onRemoved.addListener((tabId) => void controller.handleTabClosed(tabId));
});
```

- [ ] **Step 2: Typecheck, test, build**

Run: `npm run compile && npm test && npm run build`
Expected: no type errors, all tests pass (17), build succeeds.

If `tsc` rejects `getMediaStreamId` returning a Promise, the installed `@types/chrome` is the callback-only version. Wrap it instead:
`new Promise<string>((resolve) => browser.tabCapture.getMediaStreamId({ targetTabId: tabId }, resolve))`.

- [ ] **Step 3: Commit**

```bash
git add entrypoints/background.ts
git commit -m "feat: background wires arming to tab capture and offscreen document"
```

---

### Task 8: Armed chip on Twitch

The chip shows only while the tab is Armed. Clicking it disarms. It is positioned absolutely *inside* the shadow root. WXT resets the shadow host with `:host{all:initial !important}`, so the host stays `position: static`, and the chip's containing block becomes the Twitch player.

**Files:**
- Create: `lib/chip.ts`, `entrypoints/twitch.content/index.ts`, `entrypoints/twitch.content/style.css`
- Test: `lib/chip.test.ts`

- [ ] **Step 1: Write the failing test `lib/chip.test.ts`**

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderChip } from './chip';

describe('renderChip', () => {
  let container: HTMLElement;
  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders nothing when not Armed', () => {
    renderChip(container, false, () => {});
    expect(container.childElementCount).toBe(0);
  });

  it('renders the Armed chip', () => {
    renderChip(container, true, () => {});
    const chip = container.querySelector('button.chip');
    expect(chip?.textContent).toContain('Armed · listening');
    expect(chip?.getAttribute('title')).toBe('Click to disarm');
  });

  it('calls onDisarm when clicked', () => {
    const onDisarm = vi.fn();
    renderChip(container, true, onDisarm);
    container.querySelector<HTMLButtonElement>('button.chip')!.click();
    expect(onDisarm).toHaveBeenCalledTimes(1);
  });

  it('re-rendering replaces rather than duplicates', () => {
    renderChip(container, true, () => {});
    renderChip(container, true, () => {});
    expect(container.querySelectorAll('button.chip')).toHaveLength(1);
    renderChip(container, false, () => {});
    expect(container.childElementCount).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/chip.test.ts`
Expected: FAIL. The import `./chip` can't be resolved.

- [ ] **Step 3: Implement `lib/chip.ts`**

```ts
/** Renders the Armed chip into `container`, or clears it when not Armed. */
export function renderChip(container: HTMLElement, armed: boolean, onDisarm: () => void): void {
  container.replaceChildren();
  if (!armed) return;

  const dot = document.createElement('span');
  dot.className = 'dot';
  dot.textContent = '●';

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'chip';
  chip.title = 'Click to disarm';
  chip.append(dot, ' Armed · listening');
  chip.addEventListener('click', onDisarm);

  container.append(chip);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/chip.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create `entrypoints/twitch.content/style.css`**

```css
.chip {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border: 0;
  border-radius: 999px;
  background: rgba(15, 17, 21, 0.8);
  color: #fff;
  font: 600 12px/1.4 system-ui, sans-serif;
  cursor: pointer;
}

.chip:hover {
  background: rgba(255, 70, 85, 0.9);
}

.chip .dot {
  color: #ff4655;
}

.chip:hover .dot {
  color: #fff;
}
```

- [ ] **Step 6: Create `entrypoints/twitch.content/index.ts`**

```ts
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
```

- [ ] **Step 7: Typecheck, test, build**

Run: `npm run compile && npm test && npm run build`
Expected: no errors, all tests pass (21), and `.output/chrome-mv3/manifest.json` lists a content script for `*://*.twitch.tv/*`.

- [ ] **Step 8: Commit**

```bash
git add lib/chip.ts lib/chip.test.ts entrypoints/twitch.content
git commit -m "feat: Armed chip in the Twitch player, click to disarm"
```

---

### Task 9: Popup (keys + Arm/Disarm)

**Files:**
- Create: `lib/popup-view.ts`, `entrypoints/popup/index.html`, `entrypoints/popup/main.ts`, `entrypoints/popup/style.css`
- Test: `lib/popup-view.test.ts`

- [ ] **Step 1: Write the failing test `lib/popup-view.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { popupView } from './popup-view';

describe('popupView', () => {
  it('offers Disarm whenever the tab is Armed', () => {
    expect(popupView({ keysComplete: false, onTwitch: false, armed: true })).toEqual({
      armLabel: 'Disarm',
      armDisabled: false,
      hint: 'Armed: this tab’s audio is being captured.',
    });
  });

  it('blocks arming until both keys are saved', () => {
    const view = popupView({ keysComplete: false, onTwitch: true, armed: false });
    expect(view.armDisabled).toBe(true);
    expect(view.hint).toBe('Save both API keys to arm.');
  });

  it('blocks arming off Twitch', () => {
    const view = popupView({ keysComplete: true, onTwitch: false, armed: false });
    expect(view.armDisabled).toBe(true);
    expect(view.hint).toBe('Open a Twitch stream to arm.');
  });

  it('is ready on Twitch with keys', () => {
    expect(popupView({ keysComplete: true, onTwitch: true, armed: false })).toEqual({
      armLabel: 'Arm',
      armDisabled: false,
      hint: 'Ready. Arming captures this tab’s audio.',
    });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run lib/popup-view.test.ts`
Expected: FAIL. The import `./popup-view` can't be resolved.

- [ ] **Step 3: Implement `lib/popup-view.ts`**

```ts
export interface PopupState {
  keysComplete: boolean;
  onTwitch: boolean;
  armed: boolean;
}

export interface PopupView {
  armLabel: 'Arm' | 'Disarm';
  armDisabled: boolean;
  hint: string;
}

export function popupView({ keysComplete, onTwitch, armed }: PopupState): PopupView {
  if (armed) return { armLabel: 'Disarm', armDisabled: false, hint: 'Armed: this tab’s audio is being captured.' };
  if (!keysComplete) return { armLabel: 'Arm', armDisabled: true, hint: 'Save both API keys to arm.' };
  if (!onTwitch) return { armLabel: 'Arm', armDisabled: true, hint: 'Open a Twitch stream to arm.' };
  return { armLabel: 'Arm', armDisabled: false, hint: 'Ready. Arming captures this tab’s audio.' };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run lib/popup-view.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Create `entrypoints/popup/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Listen-in Translator</title>
    <link rel="stylesheet" href="./style.css" />
  </head>
  <body>
    <h1>Listen-in Translator</h1>

    <section>
      <label>
        Gladia API key
        <input id="gladia-key" type="password" autocomplete="off" spellcheck="false" />
      </label>
      <label>
        Anthropic API key
        <input id="anthropic-key" type="password" autocomplete="off" spellcheck="false" />
      </label>
      <button id="save-keys" type="button">Save keys</button>
      <p class="note">Keys stay in this browser and are sent only to Gladia and Anthropic.</p>
    </section>

    <section>
      <button id="arm" type="button" disabled>Arm</button>
      <p id="hint"></p>
      <p id="error" role="alert"></p>
    </section>

    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 6: Create `entrypoints/popup/style.css`**

```css
:root {
  --bg: #ffffff;
  --fg: #0f1115;
  --muted: #5b6270;
  --accent: #ff4655;
  --field: #f1f2f4;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1115;
    --fg: #ece8e1;
    --muted: #9aa0ab;
    --field: #1c1f26;
  }
}

body {
  width: 300px;
  margin: 0;
  padding: 16px;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.4 system-ui, sans-serif;
}

h1 {
  margin: 0 0 12px;
  font-size: 16px;
}

section + section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--field);
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 600;
}

input {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin-top: 4px;
  padding: 6px 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: var(--field);
  color: var(--fg);
}

button {
  padding: 6px 14px;
  border: 0;
  border-radius: 6px;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.note,
#hint {
  color: var(--muted);
  font-size: 12px;
}

#error {
  color: var(--accent);
  font-size: 12px;
}
```

- [ ] **Step 7: Create `entrypoints/popup/main.ts`**

```ts
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
```

- [ ] **Step 8: Typecheck, test, build**

Run: `npm run compile && npm test && npm run build`
Expected: no errors, all tests pass (25), build succeeds, and the manifest has `action.default_popup: "popup.html"`.

- [ ] **Step 9: Commit**

```bash
git add lib/popup-view.ts lib/popup-view.test.ts entrypoints/popup
git commit -m "feat: popup for Viewer keys and Arm/Disarm"
```

---

### Task 10: Manual verification in Chrome (W1 "done when")

Tab capture, offscreen audio and Twitch's DOM can't be unit tested. Check them by hand. For VODs, use any VCT match on `twitch.tv/valorant/videos`.

- [ ] **Step 1: Launch**

Run: `npm run dev`
Expected: Chrome opens with the extension loaded. If it doesn't, load `.output/chrome-mv3-dev` via `chrome://extensions` → Developer mode → Load unpacked.

- [ ] **Step 2: Key gating**

Open the popup on a non-Twitch tab. Arm should be disabled with the hint "Save both API keys to arm." Enter any two non-empty values (W1 makes no API calls) and click Save keys. The hint becomes "Open a Twitch stream to arm." Reopen the popup: the keys are still filled in.

- [ ] **Step 3: Arm with audio passthrough (the core check)**

Play a VCT VOD on Twitch with sound on. Open the popup and click Arm.
Expected:
- **Audio keeps playing, with no gap longer than about 1 s.**
- Chrome shows the tab-capture indicator on the tab.
- The `● Armed · listening` chip appears at the top right of the player.
- The popup shows Disarm.

If arming fails with "Extension has not been invoked for the current page", Chrome didn't count the popup click as invoking the extension. Move the `getMediaStreamId` call into `entrypoints/popup/main.ts`, add `streamId` to the `arm` message, and have the `getStreamId` port return it.

If the chip is missing, run `document.querySelector('[data-a-target="video-player"]')` and `document.querySelector('.video-player__container')` in DevTools. Update `PLAYER_SELECTORS` in `lib/twitch.ts` to whichever matches, and re-run `npx vitest run lib/twitch.test.ts`. If the chip is in the wrong place, the anchor isn't `position: relative`. Anchor to its positioned parent instead.

- [ ] **Step 4: Theater and fullscreen**

Switch to theater mode, then fullscreen. The chip should stay visible at the top right. If it disappears in fullscreen, Twitch is fullscreening an ancestor that doesn't contain the anchor. Switch `PLAYER_SELECTORS` to the element that matches `document.fullscreenElement`.

- [ ] **Step 5: Disarm via the chip**

Click the chip. It disappears, the capture indicator goes away, audio continues, and the popup shows Arm.

- [ ] **Step 6: Service worker sleep**

Arm, then leave the tab playing for 2+ minutes. `chrome://extensions` should show the service worker as inactive. Click the chip. It still disarms, which proves the Armed state survived in `storage.session`.

- [ ] **Step 7: One Armed tab at a time, and closing**

Arm tab A, open a second Twitch tab B, and arm B. A's chip disappears and B's appears. Close B. Open the popup on A: it shows Arm.

- [ ] **Step 8: SPA navigation**

While Armed, click through to another channel on the same tab. The chip re-appears on the new player, and audio still plays.

- [ ] **Step 9: Mark W1 done and push**

In `docs/PLAN.md`, change the W1 row's milestone cell to start with `✅ `.

```bash
git add docs/PLAN.md lib/twitch.ts entrypoints
git commit -m "docs: mark W1 done"
git push -u origin w1-tab-capture
```

Then use superpowers:finishing-a-development-branch to merge or open a PR into `main`.
