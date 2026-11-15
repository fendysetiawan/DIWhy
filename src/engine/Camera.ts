// The camera: shows a level filling the window, and keeps you in view when the window can't show all of it (phones).

export class Camera {
  constructor(
    private readonly stage: HTMLElement,
    private readonly size: { w: number; h: number },
  ) {}

  /** Look at (x, y): the level scaled to fill the window, centred there but never past its edges. */
  follow(x: number, y: number): void {
    const { w, h } = this.size;
    const k = Math.max(innerWidth / w, innerHeight / h);
    const ox = clamp(innerWidth / 2 - x * k, innerWidth - w * k, 0);
    const oy = clamp(innerHeight / 2 - y * k, innerHeight - h * k, 0);
    this.stage.style.transform = `translate(${ox}px, ${oy}px) scale(${k})`;
    this.stage.style.setProperty('--k', String(k)); // hints divide by it to stay one size on screen
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
