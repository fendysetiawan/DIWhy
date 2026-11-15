// The picker: one choice at a time, ◀ ▶ (or the arrow keys) for the others; click it (or Enter) to go with it.
// The phone's reply box and a job's surprise both use it, so choosing always looks and works the same.
// Its buttons say what they do: data-pick="-1" / "1" on the arrows, data-go on the choice.

import pickIcon from '@art/icons/pick.svg?raw';
import { escapeHtml } from './Toast';

/** The picker showing `text`; ◀ ▶ only when there's more than one choice. */
export function drawPicker(text: string, more: boolean): string {
  const arrow = (step: number) =>
    more ? `<button type="button" class="picker-arrow${step > 0 ? ' next' : ''}" data-pick="${step}" aria-label="Another choice">${pickIcon}</button>` : '';
  return `<div class="picker">${arrow(-1)}<button type="button" class="picker-text" data-go>${escapeHtml(text)}</button>${arrow(1)}</div>`;
}
