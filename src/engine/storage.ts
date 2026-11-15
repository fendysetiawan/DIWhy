// Saving to the browser (localStorage), as JSON. Fails quietly: in private browsing nothing is kept.

/** Read what was saved under `key`, or null if there's nothing (or it can't be read). */
export function loadData<T>(key: string): T | null {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}

/** Save `data` under `key`. */
export function saveData(key: string, data: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // full, or private browsing: it just isn't kept
  }
}
