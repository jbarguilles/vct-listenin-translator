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
