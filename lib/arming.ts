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
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: ArmingStore,
    private readonly ports: ArmingPorts,
  ) {}

  armedTabId(): Promise<number | null> {
    return this.store.get();
  }

  /** Runs operations one at a time so the store and the real capture can't diverge. */
  private serialize<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }

  arm(tabId: number): Promise<void> {
    return this.serialize(() => this.armInner(tabId));
  }

  disarm(): Promise<void> {
    return this.serialize(() => this.disarmInner());
  }

  handleTabClosed(tabId: number): Promise<void> {
    return this.serialize(async () => {
      if ((await this.store.get()) === tabId) await this.disarmInner();
    });
  }

  private async armInner(tabId: number): Promise<void> {
    const current = await this.store.get();
    if (current === tabId) return;
    if (current !== null) await this.disarmInner();

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

  private async disarmInner(): Promise<void> {
    const current = await this.store.get();
    if (current === null) return;
    await this.store.set(null);
    try {
      await this.ports.stopCapture();
    } finally {
      this.ports.notifyTab(current, false);
    }
  }
}
