// Pause, restart and sound buttons, for previewing. Not part of any scene.
// addControls(container, { playing(), togglePlay(), restart(), muted(), toggleSound() }) -> call .update() when things change.
function addControls(container, target) {
  const css = document.createElement("style");
  css.textContent = `
    .controls { position: absolute; right: 16px; bottom: 16px; display: flex; gap: 8px; z-index: 10; }
    .controls button { width: 44px; height: 44px; display: grid; place-items: center; padding: 0; cursor: pointer;
      border: 2px solid #F8E5CC; border-radius: 10px; background: rgba(43, 26, 20, .8); color: #F8E5CC; }
    .controls svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }`;
  const icon = {
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="M7 5l12 7-12 7z"/>',
    restart: '<path d="M4 4v6h6"/><path d="M5.5 15a8 8 0 1 0 1.5-8.5L4 10"/>',
    soundOff: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
    soundOn: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9a4 4 0 0 1 0 6"/>',
  };
  const bar = document.createElement("div"); bar.className = "controls";
  const button = (onclick) => { const b = document.createElement("button"); b.type = "button"; b.onclick = () => { onclick(); update(); }; bar.append(b); return b; };
  const set = (b, name, label) => { b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon[name]}</svg>`; b.title = label; b.setAttribute("aria-label", label); };
  const play = button(() => target.togglePlay()), restart = button(() => target.restart()), sound = button(() => target.toggleSound());
  set(restart, "restart", "Restart");
  function update() {
    target.playing() ? set(play, "pause", "Pause") : set(play, "play", "Play");
    target.muted() ? set(sound, "soundOff", "Turn sound on") : set(sound, "soundOn", "Turn sound off");
  }
  container.append(css, bar); update();
  return { update };
}
