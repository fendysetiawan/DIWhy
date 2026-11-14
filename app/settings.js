// Player settings, remembered in this browser. (Restored from git history 391db4d.)

const KEY = "diwhy:settings";

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}

export function getSetting(name, fallback) {
  const v = load()[name];
  return v === undefined ? fallback : v;
}

export function setSetting(name, value) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...load(), [name]: value })); } catch {}
}
