// The Deed: one page, a photo of the house, a few conditions,
// one box to sign in and a Sign button.

(() => {
  const deed = document.getElementById("deed");
  const wrap = document.getElementById("padWrap");
  const pad = document.getElementById("pad");
  const ctx = pad.getContext("2d");
  const signBtn = document.getElementById("signBtn");
  const INK = getComputedStyle(document.documentElement).getPropertyValue("--sig").trim();

  // Strokes are kept as point lists so the box can be redrawn on resize.
  let strokes = [];
  let current = null;
  let locked = false;
  let DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 3);
    const r = pad.getBoundingClientRect();
    pad.width = Math.round(r.width * DPR);
    pad.height = Math.round(r.height * DPR);
    redraw();
  }

  function setInk() {
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  // Line thins out when you move fast, like a ballpoint.
  function drawSegment(s, i) {
    const p = s.pts, a = p[i - 1], b = p[i], prev = p[i - 2] || a;
    const v = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(b.t - a.t, 1);
    const w = (s.w = s.w * 0.6 + Math.max(1.2, Math.min(3.4, 3.6 - v * 1.4)) * 0.4);
    ctx.lineWidth = w * DPR;
    ctx.beginPath();
    ctx.moveTo(((prev.x + a.x) / 2) * DPR, ((prev.y + a.y) / 2) * DPR);
    ctx.quadraticCurveTo(a.x * DPR, a.y * DPR, ((a.x + b.x) / 2) * DPR, ((a.y + b.y) / 2) * DPR);
    ctx.stroke();
  }

  function drawDot(p) {
    ctx.beginPath();
    ctx.arc(p.x * DPR, p.y * DPR, 1.4 * DPR, 0, Math.PI * 2);
    ctx.fill();
  }

  function redraw() {
    ctx.clearRect(0, 0, pad.width, pad.height);
    setInk();
    for (const s of strokes) {
      drawDot(s.pts[0]);
      s.w = 2.4;
      for (let i = 1; i < s.pts.length; i++) drawSegment(s, i);
    }
  }

  const point = (e) => {
    const r = pad.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
  };

  function update() {
    wrap.classList.toggle("inked", strokes.length > 0);
    signBtn.disabled = locked || !strokes.some((s) => s.pts.length > 2);
  }

  pad.addEventListener("pointerdown", (e) => {
    if (locked || e.button > 0) return;
    pad.setPointerCapture(e.pointerId);
    setInk();
    current = { pts: [point(e)], w: 2.4 };
    strokes.push(current);
    drawDot(current.pts[0]);
    update();
  });

  pad.addEventListener("pointermove", (e) => {
    if (!current) return;
    for (const ev of e.getCoalescedEvents ? e.getCoalescedEvents() : [e]) {
      const p = point(ev);
      const last = current.pts[current.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) continue;
      current.pts.push(p);
      drawSegment(current, current.pts.length - 1);
    }
  });

  const end = () => { current = null; update(); };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);

  signBtn.addEventListener("click", () => {
    locked = true;
    deed.classList.add("signed");
    signBtn.textContent = "Signed";
    update();
  });

  new ResizeObserver(resize).observe(pad);
  update();
})();
