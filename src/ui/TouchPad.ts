// On a touch screen (or a phone-narrow window): a thin strip along the bottom, below the to-do list and the phone,
// with arrows to walk and USE. Only while you're walking around a level with nothing open. Its buttons press the same
// keys a keyboard would.

import arrowIcon from '@art/icons/back.svg?raw';

/** Each button and the key it holds down. */
const KEYS = { left: 'ArrowLeft', up: 'ArrowUp', down: 'ArrowDown', right: 'ArrowRight', use: 'Enter' } as const;

export class TouchPad {
  private readonly el = document.createElement('div');

  constructor() {
    this.el.className = 'touch-pad';
    this.el.hidden = true;
    this.el.dataset.silent = ''; // no click sound on every step
    const arrows = (['left', 'up', 'down', 'right'] as const)
      .map((d) => `<button class="button secondary icon-button pad-${d}" type="button" aria-label="Walk ${d}" data-key="${KEYS[d]}">${arrowIcon}</button>`)
      .join('');
    this.el.innerHTML = `<div class="pad-arrows">${arrows}</div><button class="button pad-use" type="button" data-key="${KEYS.use}">USE</button>`;
    for (const button of this.el.querySelectorAll<HTMLButtonElement>('[data-key]')) holdKey(button, button.dataset.key ?? '');
    document.body.append(this.el);
  }

  /** Show it (walking about, nothing open) or hide it, letting go of anything held. */
  setShown(shown: boolean): void {
    if (this.el.hidden === !shown) return;
    this.el.hidden = !shown;
    document.body.classList.toggle('with-pad', shown); // the corner buttons move up above it
    if (!shown) for (const code of Object.values(KEYS)) press(code, false);
  }
}

/** Holding the button holds its key down; letting go (or sliding off) lets it up. */
function holdKey(button: HTMLButtonElement, code: string): void {
  button.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // not a "press any key"
    e.preventDefault(); // no text selection or zoom on a long press
    button.setPointerCapture(e.pointerId);
    button.classList.add('pressed');
    press(code, true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
    button.addEventListener(type, () => {
      button.classList.remove('pressed');
      press(code, false);
    });
  }
}

const press = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code }));
