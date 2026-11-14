// The contract (plan scene 1): a paper unrolls over the dark screen, the text is too small and
// blurry to read, and the player signs and presses the green check.
// Adapted from the team's house-story experiment (git history 391db4d, deed.js).
//
//   await signDeed(screenElement)   resolves once the player has signed and pressed the check

const speed = () => window.DIWHY_SPEED || 1;

export function signDeed(root) {
  const backdrop = document.createElement("div");
  backdrop.className = "deed-backdrop";
  backdrop.innerHTML = `
    <div class="deed" role="dialog" aria-label="Final purchase agreement for the house">
      <h2 class="deed-title">Final purchase agreement</h2>
      <p class="deed-price">$750,000</p>
      <p class="deed-line l1">The buyer agrees to take the house</p>
      <p class="deed-line l2">exactly as it is, with everything in it,</p>
      <p class="deed-line l3">and everything living in it.</p>
      <span class="deed-label">Sign here</span>
      <div class="deed-pad"><canvas aria-label="Signature box: draw your signature"></canvas></div>
      <button class="deed-check" type="button" aria-label="Accept and sign" disabled>&#10003;</button>
    </div>`;
  root.append(backdrop);

  const pad = backdrop.querySelector("canvas");
  const ctx = pad.getContext("2d");
  const check = backdrop.querySelector(".deed-check");

  let strokes = [];
  let current = null;
  let DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    const r = pad.getBoundingClientRect();
    pad.width = Math.round(r.width * DPR);
    pad.height = Math.round(r.height * DPR);
    ctx.clearRect(0, 0, pad.width, pad.height);
    for (const s of strokes) {
      s.w = 2.4;
      for (let i = 1; i < s.pts.length; i++) segment(s, i);
    }
  }

  // ballpoint feel: the line thins when you move fast
  function segment(s, i) {
    const p = s.pts, a = p[i - 1], b = p[i], prev = p[i - 2] || a;
    const v = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(b.t - a.t, 1);
    s.w = s.w * 0.6 + Math.max(1.2, Math.min(3.4, 3.6 - v * 1.4)) * 0.4;
    ctx.strokeStyle = "#1d1b19";
    ctx.lineCap = ctx.lineJoin = "round";
    ctx.lineWidth = s.w * DPR;
    ctx.beginPath();
    ctx.moveTo(((prev.x + a.x) / 2) * DPR, ((prev.y + a.y) / 2) * DPR);
    ctx.quadraticCurveTo(a.x * DPR, a.y * DPR, ((a.x + b.x) / 2) * DPR, ((a.y + b.y) / 2) * DPR);
    ctx.stroke();
  }

  const point = (e) => {
    const r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  };

  pad.onpointerdown = (e) => {
    try { pad.setPointerCapture(e.pointerId); } catch { /* a scripted pointer has nothing to capture */ }
    current = { pts: [point(e)], w: 2.4 };
    strokes.push(current);
  };
  pad.onpointermove = (e) => {
    if (!current) return;
    const p = point(e), last = current.pts[current.pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
    current.pts.push(p);
    segment(current, current.pts.length - 1);
  };
  pad.onpointerup = pad.onpointercancel = () => {
    current = null;
    check.disabled = !strokes.some((s) => s.pts.length > 2);
  };

  requestAnimationFrame(() => {
    backdrop.classList.add("on");
    resize();
  });
  window.addEventListener("resize", resize);

  return new Promise((resolve) => {
    check.onclick = () => {
      window.removeEventListener("resize", resize);
      backdrop.classList.remove("on");
      backdrop.classList.add("leaving");
      setTimeout(() => { backdrop.remove(); resolve(); }, 450 / speed());
    };
  });
}
