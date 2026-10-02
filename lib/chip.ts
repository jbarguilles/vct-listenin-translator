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
  chip.addEventListener('click', (event) => {
    event.stopPropagation();
    onDisarm();
  });

  container.append(chip);
}
