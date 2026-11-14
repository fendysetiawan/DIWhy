// Shared bits every screen uses: make a full-window screen, and fade it out.

export function createScreen(root, className, html) {
  const el = document.createElement("main");
  el.className = `screen ${className}`;
  el.innerHTML = html;
  root.append(el);
  return el;
}

export function leave(el, ms = 600) {
  el.classList.add("out");
  return new Promise((resolve) => setTimeout(() => { el.remove(); resolve(); }, ms));
}
