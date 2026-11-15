// Plays the cinematic scenes. Each scene is one HTML file (contract.html, sold.html, ...) whose
// <script id="scene"> calls Cinematic.scene(id, { duration, cues, init, render }).
//   Open a scene file directly to watch it (Cinematic.page() at its end runs it full-window).
//   Other pages pull a scene in with: await Cinematic.load("contract"), then Cinematic.create(...).
// A scene can also wait for the player: give it holdAt (seconds). Time stops there until the scene calls kit.release(),
// which also sends a "release" event. A page can release it too: scene.release(). Scenes can send other events
// with kit.signal(name): the contract sends "signed" once there's ink on the line.

// Timing helpers the scenes use (t = seconds into the scene).
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));          // 0 before a, 1 after b, a ramp between
const lerp = (a, b, p) => a + (b - a) * p;
const eo = (x) => 1 - Math.pow(1 - x, 3);                     // ease out
const ei = (x) => x * x * x;                                  // ease in
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // ease in and out
const eob = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); // overshoot

const Cinematic = (() => {
  const defs = {};

  // ---- sounds (made in the browser for now)
  let actx = null, muted = true;
  const ac = () => { actx ||= new AudioContext(); if (actx.state === "suspended") actx.resume(); return actx; };
  function tone(f, d, type, g0, when, glide) {
    if (muted) return;
    const a = ac(), t0 = a.currentTime + (when || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(f, t0);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + d);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(g0 || 0.2, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + d + 0.05);
  }
  function noise(d, g0, hp) {
    if (muted) return;
    const a = ac(), n = Math.floor(a.sampleRate * d), b = a.createBuffer(1, n, a.sampleRate), data = b.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    f.type = "highpass"; f.frequency.value = hp || 2000; g.gain.value = g0 || 0.1;
    s.buffer = b; s.connect(f).connect(g).connect(a.destination); s.start();
  }
  const SOUNDS = {
    roll: () => noise(1.2, 0.05, 700),
    tick: () => noise(0.03, 0.12, 4000),
    pop: () => tone(520, 0.12, "sine", 0.25, 0, 900),
    click: () => noise(0.04, 0.25, 1500),
    chime: () => { tone(1046, 0.6, "triangle", 0.15); tone(1568, 0.7, "triangle", 0.1, 0.08); },
    sparkle: () => [1760, 2093, 2637].forEach((f, i) => tone(f, 0.3, "sine", 0.08, i * 0.06)),
    ding: () => { tone(1318, 0.9, "sine", 0.22); tone(1976, 0.6, "sine", 0.08); },
    thud: () => tone(90, 0.35, "sine", 0.35, 0, 50),
    whoosh: () => noise(0.3, 0.06, 1200),
    hit: () => [262, 330, 392, 523].forEach((f) => tone(f, 1.6, "triangle", 0.09)),
  };

  // The 1920x1080 picture, scaled to fit its container.
  function film(container) {
    const root = document.createElement("div"); root.className = "film";
    const viewport = document.createElement("div"); viewport.className = "viewport";
    root.append(viewport); container.append(root);
    const fit = () => { const r = root.getBoundingClientRect(); viewport.style.transform = `scale(${Math.min(r.width / 1920, r.height / 1080)})`; };
    new ResizeObserver(fit).observe(root); fit();
    return { root, viewport };
  }

  // Build a scene on the film. Returns a player for it.
  // opts.manual: the page sends the scene's moments itself (scene.send("stamp")) instead of the scene's
  // own `auto` times, e.g. the app stamps SOLD when the player clicks NEXT.
  function create(id, { viewport }, opts = {}) {
    const def = Object.create(defs[id]);
    const stage = document.createElement("div"); stage.className = "stage"; viewport.append(stage);
    const kit = {
      stage, seg, lerp, eo, ei, eio, eob, clamp01,
      h(html) { const t = document.createElement("template"); t.innerHTML = String(html).trim(); return t.content.firstElementChild; },
    };
    let t = 0, playing = false, last = 0, released = false;
    kit.release = () => { if (!released) { released = true; events.dispatchEvent(new Event("release")); } }; // the player did their part
    kit.signal = (name) => events.dispatchEvent(new Event(name)); // a scene telling the page something (e.g. "signed")
    kit.sound = (name) => SOUNDS[name]?.();
    def.init?.(kit);

    const events = new EventTarget(), say = (name) => events.dispatchEvent(new Event(name));
    // holdEnd: the scene keeps running past its duration (clouds drift, smoke rises) instead of freezing;
    // "end" still fires once when it gets there.
    let ended = false;
    const render = () => def.render(def.holdEnd ? t : Math.min(t, def.duration), kit);
    function frame(now) {
      if (!playing) return;
      const prev = t; t = t + Math.min(0.1, (now - last) / 1000); if (!def.holdEnd) t = Math.min(def.duration, t); last = now;
      if (def.holdAt != null && !released && t > def.holdAt) t = Math.max(prev, def.holdAt); // waiting for the player
      for (const [at, sound] of def.cues || []) if (prev < at && t >= at) SOUNDS[sound]?.();
      if (!opts.manual) for (const [at, name] of def.auto || []) if (prev < at && t >= at) p.send(name);
      render();
      if (t >= def.duration && !ended) { ended = true; if (!def.holdEnd) { playing = false; say("change"); } say("end"); if (!def.holdEnd) return; }
      requestAnimationFrame(frame);
    }
    const p = {
      id, duration: def.duration, events,
      get time() { return t; },
      get playing() { return playing; },
      get waiting() { return def.holdAt != null && !released && t >= def.holdAt; },
      show(on = true) { stage.style.visibility = on ? "visible" : "hidden"; },
      play() { if (t >= def.duration && !def.holdEnd) { t = 0; ended = false; } if (playing) return; playing = true; last = performance.now(); say("change"); requestAnimationFrame(frame); },
      pause() { playing = false; say("change"); },
      seek(s) { t = Math.max(0, Math.min(def.duration, s)); render(); },
      release() { kit.release(); },
      send(name) { def[name]?.(kit, t); }, // tell the scene to do something now, e.g. "stamp"
      restart() { released = false; ended = false; def.reset?.(kit); p.seek(0); p.play(); },
    };
    render();
    return p;
  }

  // Bring a scene into this page from its HTML file: its <style id="scene-style"> and <script id="scene">.
  // the cinematics folder (this file sits in its shared/ folder)
  const base = (document.currentScript?.src || location.href).replace(/[^/]*$/, "").replace(/shared\/$/, "");
  const loading = {};
  function load(id) {
    return (loading[id] ||= fetch(base + id + ".html").then((r) => r.text()).then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const css = doc.getElementById("scene-style"), js = doc.getElementById("scene");
      if (css) { const s = document.createElement("style"); s.textContent = css.textContent; document.head.append(s); }
      const s = document.createElement("script"); s.textContent = js.textContent; document.head.append(s);
    }));
  }

  // Run the scene this file defines, full-window on black. ?controls adds pause/restart/sound.
  // On its own it loops, and the contract carries on by itself once it's signed.
  function page() {
    const id = Object.keys(defs)[0];
    document.body.style.cssText = "margin:0;height:100vh;display:grid;place-items:center;background:#000;overflow:hidden";
    const screen = document.createElement("div");
    screen.style.cssText = "position:relative;width:min(100vw,calc(100vh*16/9));aspect-ratio:16/9";
    document.body.append(screen);
    const scene = create(id, film(screen));
    scene.show();
    scene.events.addEventListener("end", () => scene.restart());
    scene.events.addEventListener("signed", () => setTimeout(scene.release, 800));
    if (new URLSearchParams(location.search).has("controls")) {
      const s = document.createElement("script"); s.src = base + "shared/controls.js";
      s.onload = () => {
        const c = addControls(screen, {
          playing: () => scene.playing, togglePlay: () => (scene.playing ? scene.pause() : scene.play()),
          restart: () => scene.restart(), muted: () => muted, toggleSound: () => setMuted(!muted),
        });
        scene.events.addEventListener("change", c.update);
      };
      document.head.append(s);
    }
    window.scene = scene;
    scene.play();
  }
  function setMuted(m) { muted = !!m; if (!muted) ac(); }

  return {
    scene(id, def) { defs[id] = def; },
    film, create, load, page,
    get muted() { return muted; },
    setMuted,
  };
})();

// also on window, so ES modules (the app) can reach it
window.Cinematic = Cinematic;
