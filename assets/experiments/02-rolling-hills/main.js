// Rolling hills: a procedural "green hill, blue sky" background.
// Painted entirely in canvas — no photo. Sky + drifting clouds animate on one
// canvas; the hill is painted once per resize onto a second canvas on top.

(() => {
  const skyCv = document.getElementById("sky");
  const landCv = document.getElementById("land");
  const sky = skyCv.getContext("2d");
  const land = landCv.getContext("2d");

  // ---------- seeded random so a layout is repeatable ----------
  let seed = 7;
  function rng() {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rand = (a, b) => a + (b - a) * rng();

  let W = 0, H = 0, DPR = 1;

  // ---------- the hill's silhouette ----------
  // Smooth bump peaking a little left of centre, easing down to the right.
  const hillY = (x) => {
    const u = x / W;
    return H * (0.585 - 0.085 * Math.exp(-(((u - 0.36) / 0.34) ** 2)) + 0.018 * u);
  };
  // the darker field line across the foreground
  const fieldY = (x) => {
    const u = x / W;
    return H * (0.84 - 0.035 * u + 0.008 * Math.sin(u * 5));
  };

  // ---------- sky (static gradient, cached) ----------
  let skyBg = null;
  function paintSkyBg() {
    skyBg = document.createElement("canvas");
    skyBg.width = W * DPR; skyBg.height = H * DPR;
    const c = skyBg.getContext("2d");
    c.scale(DPR, DPR);
    const g = c.createLinearGradient(0, 0, 0, H * 0.62);
    g.addColorStop(0, "#1450c8");
    g.addColorStop(0.45, "#2f72dc");
    g.addColorStop(0.85, "#6ea4ec");
    g.addColorStop(1, "#a9c8f2");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // wispy cirrus streaks, upper half
    const streaks = 26;
    for (let i = 0; i < streaks; i++) {
      const x = rand(-0.1, 1.0) * W;
      const y = rand(0.04, 0.32) * H;
      const len = rand(0.06, 0.2) * W;
      softBlob(c, x, y, len, len * rand(0.05, 0.12), rand(-0.55, -0.25), rand(0.06, 0.18));
    }
  }

  // An elongated soft white ellipse.
  function softBlob(c, x, y, rx, ry, rot, a, color = "255,255,255") {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(1, ry / rx);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${color},${a})`);
    g.addColorStop(1, `rgba(${color},0)`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, rx, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // ---------- cumulus clouds (each pre-rendered to its own canvas) ----------
  let clouds = [];
  function makeCloud(size) {
    // a cluster of puffs with a flattish base
    const puffs = [];
    const n = Math.round(rand(8, 16));
    const span = size * rand(1.6, 2.8);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const r = size * rand(0.35, 0.7) * (1 - Math.abs(t - 0.5) * 0.9);
      puffs.push({ x: t * span + rand(-0.1, 0.1) * size, y: -r * rand(0.3, 0.8), r });
    }
    // a few top puffs to give it height
    for (let i = 0; i < n / 2; i++) {
      puffs.push({ x: rand(0.2, 0.8) * span, y: -size * rand(0.5, 0.9), r: size * rand(0.3, 0.5) });
    }

    const pad = size;
    const cw = span + pad * 2, ch = size * 2.2;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil(cw * DPR); cv.height = Math.ceil(ch * DPR);
    const c = cv.getContext("2d");
    c.scale(DPR, DPR);
    const baseY = ch * 0.72;

    c.save();
    c.beginPath();
    c.rect(0, 0, cw, baseY + size * 0.08); // flatten the bottom
    c.clip();
    for (const p of puffs) {
      const px = pad + p.x, py = baseY + p.y;
      const g = c.createRadialGradient(px, py, p.r * 0.2, px, py, p.r);
      g.addColorStop(0, "rgba(255,255,255,0.95)");
      g.addColorStop(0.5, "rgba(255,255,255,0.6)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, p.r, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();

    // grey-blue shading toward the base
    c.globalCompositeOperation = "source-atop";
    const sh = c.createLinearGradient(0, baseY - size * 0.9, 0, baseY + size * 0.1);
    sh.addColorStop(0, "rgba(150,175,215,0)");
    sh.addColorStop(1, "rgba(150,175,215,0.55)");
    c.fillStyle = sh;
    c.fillRect(0, 0, cw, ch);
    c.globalCompositeOperation = "source-over";

    return { cv, w: cw, h: ch, baseY };
  }

  function makeClouds() {
    clouds = [];
    const unit = Math.min(W, H);
    // a big bank sitting low near the horizon, right of centre
    for (let i = 0; i < 9; i++) {
      const size = unit * rand(0.05, 0.1);
      clouds.push({ ...makeCloud(size), x: rand(0.35, 1.05) * W, y: rand(0.42, 0.53) * H, speed: rand(4, 7) });
    }
    // mid-sky scattered ones
    for (let i = 0; i < 7; i++) {
      const size = unit * rand(0.035, 0.07);
      clouds.push({ ...makeCloud(size), x: rand(-0.1, 1.0) * W, y: rand(0.2, 0.4) * H, speed: rand(6, 10) });
    }
    // small high puffs
    for (let i = 0; i < 6; i++) {
      const size = unit * rand(0.015, 0.03);
      clouds.push({ ...makeCloud(size), x: rand(0, 1) * W, y: rand(0.1, 0.28) * H, speed: rand(9, 14) });
    }
    clouds.sort((a, b) => a.y - b.y); // far (higher) first
  }

  // ---------- land (painted once per resize) ----------
  function hillPath(c) {
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) c.lineTo(x, hillY(x));
    c.lineTo(W, hillY(W));
    c.lineTo(W, H);
    c.closePath();
  }

  function paintLand() {
    landCv.width = W * DPR; landCv.height = H * DPR;
    const c = land;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);

    // distant blue hills on the right horizon
    c.fillStyle = "#7f93b8";
    c.beginPath();
    c.moveTo(W * 0.7, H);
    for (let x = W * 0.7; x <= W; x += 4) {
      const u = (x - W * 0.7) / (W * 0.3);
      c.lineTo(x, H * (0.585 - 0.022 * Math.sin(u * Math.PI * 0.9) - 0.01 * Math.sin(u * 9)));
    }
    c.lineTo(W, H);
    c.fill();
    // haze on top of them
    const hz = c.createLinearGradient(0, H * 0.54, 0, H * 0.6);
    hz.addColorStop(0, "rgba(200,220,245,0)");
    hz.addColorStop(1, "rgba(200,220,245,0.5)");
    c.fillStyle = hz;
    c.fillRect(W * 0.7, H * 0.54, W * 0.3, H * 0.06);

    c.save();
    hillPath(c);
    c.clip();

    // base green: bright yellow-green crest, deeper green below
    const g = c.createLinearGradient(0, H * 0.5, 0, H);
    g.addColorStop(0, "#8fc43a");
    g.addColorStop(0.3, "#6aa82a");
    g.addColorStop(0.7, "#4c8a1e");
    g.addColorStop(1, "#3d7419");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // sunlit patch across the middle of the slope
    softBlob(c, W * 0.5, H * 0.68, W * 0.45, H * 0.14, -0.05, 0.35, "214,230,90");
    // a cloud shadow drifting over the left flank
    softBlob(c, W * 0.12, H * 0.72, W * 0.32, H * 0.13, 0.08, 0.45, "30,60,15");

    // grass texture: thousands of tiny strokes
    const blades = Math.round((W * H) / 45);
    for (let i = 0; i < blades; i++) {
      const x = rng() * W;
      const top = hillY(x);
      const y = top + rng() ** 1.4 * (H - top);
      const depth = (y - top) / (H - top); // 0 at crest, 1 at bottom
      const len = 1 + depth * 4 * rng();
      const light = rng() < 0.5;
      c.strokeStyle = light
        ? `rgba(190,225,90,${0.08 + 0.12 * rng()})`
        : `rgba(25,60,10,${0.08 + 0.14 * rng()})`;
      c.lineWidth = 0.6 + depth * 0.8;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + (rng() - 0.5) * len * 0.6, y - len);
      c.stroke();
    }

    // the darker field line in the foreground
    c.strokeStyle = "rgba(45,40,15,0.3)";
    c.lineWidth = Math.max(1.5, H * 0.003);
    c.beginPath();
    for (let x = 0; x <= W; x += 4) c.lineTo(x, fieldY(x));
    c.stroke();
    // slightly richer green below it
    c.fillStyle = "rgba(60,110,20,0.25)";
    c.beginPath();
    c.moveTo(0, H);
    for (let x = 0; x <= W; x += 4) c.lineTo(x, fieldY(x) + 2);
    c.lineTo(W, H);
    c.fill();

    // little yellow flowers dotted in the foreground
    const flowers = Math.round(W / 4);
    for (let i = 0; i < flowers; i++) {
      const x = rng() * W;
      const y = fieldY(x) + 6 + rng() * (H - fieldY(x));
      c.fillStyle = `rgba(240,225,90,${0.5 + 0.4 * rng()})`;
      c.fillRect(x, y, 1.6, 1.6);
    }

    // soft highlight right along the crest
    c.lineWidth = 6;
    c.strokeStyle = "rgba(200,235,120,0.25)";
    c.beginPath();
    for (let x = 0; x <= W; x += 4) c.lineTo(x, hillY(x) + 2);
    c.stroke();

    c.restore();
  }

  // ---------- setup ----------
  function build() {
    seed = layoutSeed;
    paintSkyBg();
    makeClouds();
    paintLand();
  }

  let layoutSeed = 7;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    skyCv.width = W * DPR; skyCv.height = H * DPR;
    build();
  }

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "r") {
      layoutSeed = (Math.random() * 1e9) | 0;
      build();
    }
  });

  // ---------- render loop: sky + drifting clouds ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    sky.setTransform(1, 0, 0, 1, 0, 0);
    sky.drawImage(skyBg, 0, 0);
    sky.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const cl of clouds) {
      cl.x += cl.speed * dt;
      if (cl.x > W + 20) cl.x = -cl.w - 20;
      sky.drawImage(cl.cv, cl.x - cl.w / 2, cl.y - cl.baseY, cl.w, cl.h);
    }
    requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
