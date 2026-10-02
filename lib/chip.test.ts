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

  it('does not let clicks bubble to ancestors', () => {
    document.body.append(container);
    const onDisarm = vi.fn();
    const onAncestor = vi.fn();
    container.addEventListener('click', onAncestor);
    renderChip(container, true, onDisarm);
    container.querySelector<HTMLButtonElement>('button.chip')!.click();
    expect(onDisarm).toHaveBeenCalledTimes(1);
    expect(onAncestor).not.toHaveBeenCalled();
    container.remove();
  });
});
