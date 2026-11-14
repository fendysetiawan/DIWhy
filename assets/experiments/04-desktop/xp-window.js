// A simple retro XP-style window: blue title bar, close button, drag to move.
//
// Usage:
//   const win = openXPWindow({ title: "DIY", body: "<p>Hello</p>" });
//   win.close();
//
// `body` can be an HTML string or a DOM node.

function openXPWindow({ title = "Untitled", body = "", width = 480, height = 320 } = {}) {
  const win = document.createElement("div");
  win.className = "xp-window";
  win.style.width = `${width}px`;
  win.style.height = `${height}px`;
  win.style.left = `${Math.max(16, (innerWidth - width) / 2)}px`;
  win.style.top = `${Math.max(16, (innerHeight - height) / 2.5)}px`;

  win.innerHTML = `
    <div class="xp-titlebar">
      <span class="xp-title"></span>
      <div class="xp-buttons">
        <button class="xp-btn xp-min" aria-label="Minimise" tabindex="-1">_</button>
        <button class="xp-btn xp-max" aria-label="Maximise" tabindex="-1">□</button>
        <button class="xp-btn xp-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="xp-body"></div>
  `;
  win.querySelector(".xp-title").textContent = title;
  const bodyEl = win.querySelector(".xp-body");
  if (typeof body === "string") bodyEl.innerHTML = body;
  else bodyEl.append(body);

  const close = () => win.remove();
  win.querySelector(".xp-close").addEventListener("click", close);

  // drag by the title bar
  const bar = win.querySelector(".xp-titlebar");
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".xp-btn")) return;
    const dx = e.clientX - win.offsetLeft;
    const dy = e.clientY - win.offsetTop;
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      win.style.left = `${ev.clientX - dx}px`;
      win.style.top = `${Math.max(0, ev.clientY - dy)}px`;
    };
    const up = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
    };
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
  });

  document.body.append(win);
  return { el: win, body: bodyEl, close };
}
