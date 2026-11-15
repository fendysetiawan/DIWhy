// Scene 4: the estimate. Edit this file; opening.html and preview.html both play it.
Cinematic.scene("estimate", {
  duration: 7,
  // [seconds, sound] - sounds are listed in player.js
  cues: [
    [0.8, "pop"],
    [2.65, "thud"],
    [4.78, "whoosh"],
    [4.9, "hit"],
    [3.45, "tick"],
    [3.54, "tick"],
    [3.63, "tick"],
    [3.72, "tick"],
    [3.81, "tick"],
    [3.9, "tick"],
    [3.99, "tick"],
    [4.08, "tick"],
    [4.17, "tick"],
    [4.26, "tick"],
    [4.35, "tick"],
    [4.44, "tick"],
    [4.53, "tick"],
    [4.62, "tick"],
  ],
  init(kit) {
    const P = W.pal(kit);
    // A warm wooden table from above, lit from the upper left; the phone's shadow falls to the lower right.
    const bg = W.paint(500, 285, g => {
      g.r(0, 0, 500, 285, P.wood);
      for (let y = 0, i = 0; y < 285; y += 30, i++) { const r = W.rng(i + 70); g.r(0, y, 500, 1, P.woodL); g.r(0, y + 29, 500, 1, P.wood2);
        for (let k = 0; k < 18; k++) g.r(r() * 500, y + 3 + r() * 24, 20 + r() * 70, 1, P.wood2, 0.45);
        const j = (i % 2 ? 90 : 360) + (i * 41) % 60; g.r(j, y + 1, 1, 28, P.wood2); g.r(j + 1, y + 1, 1, 28, P.woodL, 0.6); g.oval(40 + (i * 131) % 420, y + 15, 4, 2, P.wood2, 0.6); }
      for (let k = 0; k < 6; k++) g.oval(90, 60, 240 - k * 32, 150 - k * 20, P.goldL, 0.05);
      g.r(200, 40, 112, 212, P.ink, 0.22); g.r(203, 38, 106, 216, P.ink, 0.12);
    });
    const phone = W.paint(112, 212, g => {
      g.r(4, 0, 104, 212, P.brown2); g.r(0, 4, 112, 204, P.brown2); g.r(1, 1, 110, 210, P.brown2);
      g.r(1, 4, 1, 204, P.brownL); g.r(4, 1, 104, 1, P.brownL); g.r(110, 4, 1, 204, P.ink); g.r(4, 210, 104, 1, P.ink);
      g.r(8, 16, 96, 180, P.cream); g.r(8, 16, 96, 28, P.cream2); g.r(8, 44, 96, 1, P.peach2);
      g.oval(56, 29, 8, 8, P.peach2); g.oval(55, 28, 5, 5, P.terraL);
      g.r(12, 176, 78, 12, P.creamL); g.r(12, 187, 78, 1, P.peach); g.oval(97, 182, 5, 5, P.blue); g.p(95, 180, P.blueL);
      g.dith(8, 45, 36, 60, P.creamL, 0, 0.6);
      g.r(45, 7, 22, 2, P.ink); g.oval(76, 8, 2, 2, P.slate);
      g.r(42, 201, 28, 2, P.brownL);
    });
    const kb = W.paint(96, 76, g => {
      g.r(0, 0, 96, 76, P.cream2); g.r(0, 0, 96, 1, P.peach2);
      [[10, 0, 4], [9, 4, 19], [7, 13, 34]].forEach(([n, off, y]) => { for (let i = 0; i < n; i++) { g.r(3 + off + i * 9, y, 8, 12, P.creamL); g.r(3 + off + i * 9, y + 11, 8, 1, P.peach); } });
      g.r(22, 52, 50, 12, P.creamL); g.r(22, 63, 50, 1, P.peach); g.r(3, 52, 16, 12, P.peach2); g.r(76, 52, 17, 12, P.blue); g.r(76, 52, 17, 1, P.blueL);
    });
    const dot = W.paint(6, 6, g => { g.oval(3, 3, 3, 3, P.blue); g.p(2, 2, P.blueL); });
    const world = kit.h('<div class="cam estimate-world" style="width:2000px;height:1140px"></div>');
    world.append(W.layer(kit, bg, 0, 0, 500, 285, 'estimate-table'));
    const ph = kit.h('<div class="estimate-phone" style="position:absolute;left:776px;top:136px;width:448px;height:848px"></div>');
    ph.append(W.layer(kit, phone, 0, 0, 112, 212));
    const clip = kit.h('<div class="estimate-screen" style="position:absolute;left:32px;top:64px;width:384px;height:720px;overflow:hidden"></div>');
    this.kb = W.layer(kit, kb, 0, 180, 96, 76, 'estimate-keyboard'); clip.append(this.kb); ph.append(clip);
    this.dot = W.layer(kit, dot, 63, 21, 6, 6, 'estimate-dot'); ph.append(this.dot);
    world.append(ph);
    const root = kit.h('<div class="ground" style="background:var(--terra)"></div>');
    root.append(world);
    kit.stage.append(root); Object.assign(this, { world, ph });
  },
  render(t, kit) {
    const e = eio(seg(t, 0, 7));
    this.world.style.transform = 'translate(' + W.px(-10) + 'px,' + W.px(-5) + 'px)';
    const buzz = seg(t, 0.8, 1.2), gr = seg(t, 2.6, 3.2);
    const sx = (buzz > 0 && buzz < 1 ? Math.round(Math.sin(buzz * Math.PI * 6)) : 0) + (gr > 0 && gr < 1 ? Math.round(1.4 * Math.sin(gr * Math.PI * 4) * (1 - gr)) : 0);
    this.ph.style.transform = 'translateX(' + W.px(sx) + 'px)';
    this.dot.style.opacity = t >= 0.85 ? 1 : 0;
    const up = eo(seg(t, 3.0, 3.4)) * (1 - eio(seg(t, 4.85, 5.2)));
    this.kb.style.top = W.px(lerp(180, 104, up)) + 'px';
  },
});
