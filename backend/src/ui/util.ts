// Small helpers shared by the game UI and the dev tools.

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export const pct = (n: number, max: number) => Math.min(100, Math.max(0, (n / max) * 100));

/** Set or remove a URL query parameter without reloading the page. */
export function setParam(name: string, value: string | number | null): void {
  const url = new URL(location.href);
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, String(value));
  history.replaceState(null, '', url);
}
