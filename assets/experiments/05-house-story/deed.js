// The deed: pops up over the house. Sign in the box, then press Start.
//
// Usage: openDeed().then(() => { /* signed and started */ });
// Signature drawing is adapted from experiments/03-the-deed.

function openDeed() {
  const backdrop = document.getElementById("deed");
  const wrap = backdrop.querySelector(".deed-pad");
  const pad = wrap.querySelector("canvas");
  const ctx = pad.getContext("2d");
  const start = backdrop.querySelector(".deed-start");

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
    pad.setPointerCapture(e.pointerId);
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
    start.disabled = !strokes.some((s) => s.pts.length > 2);
  };

  backdrop.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add("on");
    resize();
  });
  window.addEventListener("resize", resize);

  return new Promise((resolve) => {
    start.onclick = () => {
      window.removeEventListener("resize", resize);
      backdrop.classList.remove("on");
      backdrop.classList.add("leaving");
      setTimeout(() => { backdrop.hidden = true; resolve(); }, 450);
    };
  });
}
