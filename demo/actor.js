// The actor: a visible mouse that does what a player would do, so the demo shows the real game.
//
// It moves a fake pointer to a target, ripples, and sends REAL events (pointerdown, mousedown,
// pointerup, mouseup, click) to the real element. Nothing is mocked: the page's own handlers run.
// Everything is scaled by `speed` (1.5 by default for the demo). The real user can take over:
// Escape, or moving the real mouse, stops the demo and gives the page back.

const ARROW = `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
  <path d="M4 2l15 9-6.5 1.6L9.6 19z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

export class Stopped extends Error {
  constructor() {
    super("the demo was stopped");
    this.name = "Stopped";
  }
}

const reducedMotion = () => !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
// The same easing the frontend uses for its larger movements: cubic-bezier(.65, 0, .25, 1), approximated.
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createActor({ speed = 1.5, trusted = (e) => e.isTrusted } = {}) {
  let stopped = false;
  const rejectors = new Set();

  const cursor = document.createElement("div");
  cursor.id = "diwhyDemoCursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = ARROW;
  Object.assign(cursor.style, {
    position: "fixed", left: "0", top: "0", width: "28px", height: "28px", zIndex: "2147483647",
    pointerEvents: "none", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.45))", willChange: "transform",
  });
  document.body.append(cursor);

  const badge = document.createElement("div");
  badge.id = "diwhyDemoBadge";
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = `DEMO  ${speed}x  Esc to stop`;
  Object.assign(badge.style, {
    position: "fixed", left: "50%", bottom: "10px", transform: "translateX(-50%)", zIndex: "2147483646",
    padding: "6px 12px", border: "2px solid #f7e8d1", borderRadius: "8px", background: "rgba(12,20,80,.85)",
    color: "#f7e8d1", font: '10px/1.4 "Press Start 2P", ui-monospace, monospace', pointerEvents: "none",
  });
  document.body.append(badge);

  let x = window.innerWidth * 0.5;
  let y = window.innerHeight * 0.65;
  const place = () => (cursor.style.transform = `translate(${x}px, ${y}px)`);
  place();

  const sleep = (ms) =>
    new Promise((resolve, reject) => {
      if (stopped) return reject(new Stopped());
      const entry = { reject };
      rejectors.add(entry);
      setTimeout(() => {
        rejectors.delete(entry);
        resolve();
      }, ms / speed);
    });

  function stop() {
    if (stopped) return;
    stopped = true;
    window.removeEventListener("keydown", onKey, true);
    window.removeEventListener("mousemove", onMove, true);
    cursor.remove();
    badge.remove();
    for (const r of rejectors) r.reject(new Stopped());
    rejectors.clear();
  }

  // The real user takes over: Escape, or a real mouse that moves more than a little.
  let travelled = 0;
  let last = null;
  const onKey = (e) => { if (e.key === "Escape" && trusted(e)) stop(); };
  const onMove = (e) => {
    if (!trusted(e)) return;
    if (last) travelled += Math.hypot(e.clientX - last.x, e.clientY - last.y);
    last = { x: e.clientX, y: e.clientY };
    if (travelled > 60) stop();
  };
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("mousemove", onMove, true);

  const q = (target) => (typeof target === "string" ? document.querySelector(target) : target);

  /** Resolve with the element when it appears (and is on screen). Gives up after `timeout` ms of real time. */
  function waitFor(target, { timeout = 90000 } = {}) {
    return waitForAny([target], { timeout }).then(([el]) => el);
  }

  /** Resolve with [element, index] for the first of several selectors to appear. */
  function waitForAny(targets, { timeout = 90000 } = {}) {
    return new Promise((resolve, reject) => {
      if (stopped) return reject(new Stopped());
      const started = Date.now();
      const entry = { reject: (e) => { clearInterval(timer); reject(e); } };
      rejectors.add(entry);
      const timer = setInterval(() => {
        for (let i = 0; i < targets.length; i++) {
          const el = q(targets[i]);
          if (el && !el.hidden && !el.disabled) {
            clearInterval(timer);
            rejectors.delete(entry);
            return resolve([el, i]);
          }
        }
        if (Date.now() - started > timeout) {
          clearInterval(timer);
          rejectors.delete(entry);
          reject(new Error(`the demo gave up waiting for ${targets.join(" or ")}`));
        }
      }, 40);
    });
  }

  async function moveTo(tx, ty, ms = 850) {
    if (stopped) throw new Stopped();
    if (reducedMotion()) { x = tx; y = ty; place(); return; }
    const fromX = x, fromY = y;
    const dist = Math.hypot(tx - fromX, ty - fromY);
    const duration = Math.max(250, Math.min(ms, 200 + dist * 0.9)) / speed;
    const t0 = performance.now();
    await new Promise((resolve, reject) => {
      const entry = { reject };
      rejectors.add(entry);
      const step = (now) => {
        if (stopped) return;
        const t = Math.min(1, (now - t0) / duration);
        const k = ease(t);
        x = fromX + (tx - fromX) * k;
        y = fromY + (ty - fromY) * k;
        place();
        if (t < 1) requestAnimationFrame(step);
        else { rejectors.delete(entry); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  const pointOf = (el, at) => {
    const r = el.getBoundingClientRect();
    return at ? { x: r.left + r.width * at.x, y: r.top + r.height * at.y } : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  const fire = (el, type, init = {}) => {
    const Ctor = type.startsWith("pointer") ? window.PointerEvent || window.MouseEvent : window.MouseEvent;
    el.dispatchEvent(new Ctor(type, {
      bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0,
      pointerId: 1, pointerType: "mouse", isPrimary: true, view: window, ...init,
    }));
  };

  function ripple() {
    const r = document.createElement("div");
    Object.assign(r.style, {
      position: "fixed", left: `${x - 16}px`, top: `${y - 16}px`, width: "32px", height: "32px", borderRadius: "50%",
      border: "3px solid rgba(255,255,255,.95)", boxShadow: "0 0 0 2px rgba(17,17,17,.4)", pointerEvents: "none",
      zIndex: "2147483645", opacity: "1", transform: "scale(.4)",
      transition: `transform ${0.45 / speed}s ease-out, opacity ${0.45 / speed}s ease-out`,
    });
    document.body.append(r);
    requestAnimationFrame(() => { r.style.transform = "scale(1.6)"; r.style.opacity = "0"; });
    setTimeout(() => r.remove(), 600 / speed);
  }

  /** Point at something without pressing it: the pointer moves there and the element lights up. */
  async function hover(target, at) {
    const el = q(target) || (await waitFor(target));
    const p = pointOf(el, at);
    await moveTo(p.x, p.y);
    fire(el, "pointerover"); fire(el, "mouseover"); fire(el, "pointermove"); fire(el, "mousemove");
    if (typeof el.focus === "function") el.focus({ preventScroll: true }); // lights up the brand's hover style
    await sleep(380);
    return el;
  }

  /** Move to it, press it, release it. Like a person with a mouse. */
  async function click(target, at) {
    const el = await hover(typeof target === "string" ? (q(target) || (await waitFor(target))) : target, at);
    ripple();
    fire(el, "pointerdown"); fire(el, "mousedown", { buttons: 1 });
    await sleep(90);
    fire(el, "pointerup"); fire(el, "mouseup");
    el.click();
    await sleep(260);
    return el;
  }

  /** Click on the page itself (for "click to continue"). */
  async function clickAnywhere() {
    const nx = window.innerWidth * (0.45 + Math.random() * 0.1);
    const ny = window.innerHeight * 0.35;
    await moveTo(nx, ny, 600);
    ripple();
    const el = document.elementFromPoint(nx, ny) || document.body;
    fire(el, "pointerdown"); fire(el, "mousedown", { buttons: 1 });
    await sleep(80);
    fire(el, "pointerup"); fire(el, "mouseup"); fire(el, "click");
    await sleep(200);
  }

  /** Press on a canvas and draw along `points` (each {x, y} from 0 to 1 across the canvas). */
  async function drag(target, points) {
    const el = q(target) || (await waitFor(target));
    const r = el.getBoundingClientRect();
    const abs = points.map((p) => ({ x: r.left + p.x * r.width, y: r.top + p.y * r.height }));
    await moveTo(abs[0].x, abs[0].y);
    ripple();
    fire(el, "pointerdown", { buttons: 1 });
    for (const p of abs.slice(1)) {
      if (stopped) throw new Stopped();
      x = p.x; y = p.y; place();
      fire(el, "pointermove", { buttons: 1 });
      await sleep(16);
    }
    fire(el, "pointerup");
    await sleep(200);
  }

  return { stop, sleep, waitFor, waitForAny, moveTo, hover, click, clickAnywhere, drag, get stopped() { return stopped; }, speed };
}
