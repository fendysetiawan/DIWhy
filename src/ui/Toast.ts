// Toasts: little cards that pop up bottom right (a text arriving). They stay until you click one (to act on it) or
// dismiss it with its ✕. At most three at once: the oldest goes first.

import closeIcon from '@art/icons/close.svg?raw';

const MAX = 3;

interface ToastOptions {
  /** A picture on the left (HTML: a face, an icon). */
  icon: string;
  title: string;
  text: string;
  /** What a click does (it also closes the toast). */
  onClick?: () => void;
}

export class Toasts {
  readonly el = document.createElement('div');

  constructor() {
    this.el.className = 'toasts';
    this.el.setAttribute('aria-live', 'polite');
    document.body.append(this.el);
  }

  show({ icon, title, text, onClick }: ToastOptions): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<button class="toast-open" type="button">${icon}<b>${escapeHtml(title)}</b><p>${escapeHtml(text)}</p></button>
      <button class="toast-close" type="button" aria-label="Dismiss">${closeIcon}</button>`;
    toast.addEventListener('pointerdown', (e) => e.stopPropagation()); // not a "press any key"
    toast.addEventListener('click', (e) => {
      e.stopPropagation();
      toast.remove();
      if (!(e.target as HTMLElement).closest('.toast-close')) onClick?.();
    });
    this.el.append(toast);
    while (this.el.children.length > MAX) this.el.firstElementChild?.remove();
  }

  /** Clear them all (the intro, or the phone just opened). */
  clear(): void {
    this.el.replaceChildren();
  }
}

/** Text safe to put in HTML. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[ch]};`);
}
