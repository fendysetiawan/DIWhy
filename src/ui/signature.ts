// Pixel handwriting: a name written small in a handwriting font, shown scaled up so it reads as pixel art.
// Colours come from CSS: --ink (the name and cursor) and --ink-faint (the empty hint).

const FONT = '"Caveat", cursive';

/** Make sure the handwriting font is loaded before the first draw. */
export function loadSignatureFont(): Promise<unknown> {
  return document.fonts.load(`22px ${FONT}`);
}

/** Draw `name` on the canvas, or a faint "Type your name" when empty; with `cursor`, a pixel cursor after it. */
export function drawSignature(canvas: HTMLCanvasElement, name: string, cursor: boolean): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const css = getComputedStyle(canvas);
  const ink = css.getPropertyValue('--ink');
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.font = `22px ${FONT}`;
  g.textBaseline = 'alphabetic';
  g.fillStyle = name ? ink : css.getPropertyValue('--ink-faint');
  g.fillText(name || 'Type your name', 4, 22, canvas.width - 12);
  if (!cursor) return;
  const x = name ? Math.min(4 + g.measureText(name).width + 2, canvas.width - 4) : 4;
  g.fillStyle = ink;
  g.fillRect(x, 6, 2, 18);
}
