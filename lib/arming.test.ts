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
