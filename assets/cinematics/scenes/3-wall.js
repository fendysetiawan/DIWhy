// Scene 3: the wall. Edit this file; opening.html and preview.html both play it.
Cinematic.scene("wall", {
  duration: 5.5,
  // [seconds, sound] - sounds are listed in player.js
  cues: [
    [4.05, "ding"],
  ],
  init(kit) {
    const P = W.pal(kit);
    // The living room as a game interior seen from above: back wall, a side wall with the doorway, a wide plank floor.
    const bg = W.paint(560, 300, g => {
      const r = W.rng(41);
      g.r(0, 0, 560, 300, P.brown2);
      // back wall: striped wallpaper, wood wainscot
      g.r(30, 16, 530, 76, P.cream2);
      for (let x = 34; x < 560; x += 10) { g.r(x, 20, 2, 46, P.peach, 0.75); for (let y = 26; y < 64; y += 12) g.p(x + 5, y, P.terraL); }
      g.r(30, 16, 530, 4, P.wood2); g.r(30, 16, 530, 1, P.wood); g.r(30, 20, 530, 2, P.ink, 0.12);
      g.r(30, 64, 530, 3, P.woodL); g.r(30, 67, 530, 23, P.wood); for (let x = 36; x < 560; x += 34) { g.r(x, 71, 28, 16, P.wood2, 0.5); g.r(x, 71, 28, 1, P.woodL); g.r(x, 71, 1, 16, P.woodL); }
      g.r(30, 90, 530, 3, P.wood2);
      // floor planks
      for (let y = 93, i = 0; y < 300; y += 8, i++) { g.r(30, y, 530, 8, i % 3 === 1 ? W.mix(P.wood, P.terra2, 0.55) : P.wood); g.r(30, y, 530, 1, P.woodL, 0.7); g.r(30, y + 7, 530, 1, P.wood2);
        for (let x = 30 + ((i * 47) % 90); x < 560; x += 90) g.r(x, y + 1, 1, 6, P.wood2); if (i % 2) g.oval(60 + (i * 83) % 480, y + 4, 2, 1, P.wood2); }
      // side wall with a doorway
      g.r(14, 16, 16, 284, P.brownL); g.r(14, 16, 16, 2, P.woodL); g.r(28, 16, 2, 284, P.ink, 0.25);
      g.r(14, 160, 16, 48, P.terra2); for (let y = 161; y < 208; y += 8) g.r(14, y, 16, 1, P.wood2); g.r(10, 156, 24, 4, P.wood2); g.r(10, 208, 24, 4, P.wood2);
      // window with blue curtains
      g.r(70, 24, 62, 40, P.cream); g.r(74, 28, 54, 32, P.blue2); g.r(74, 28, 54, 12, P.blueL); g.r(100, 28, 2, 32, P.cream); g.r(74, 43, 54, 2, P.cream);
      for (let i = 0; i < 9; i++) { g.p(80 + i, 40 - i, P.creamL); g.p(108 + i, 56 - i, P.creamL); }
      g.r(66, 64, 70, 3, P.cream2); g.r(66, 67, 70, 1, P.peach2);
      [[58, 14], [130, 14]].forEach(([x, w]) => { g.r(x, 20, w, 48, P.blue); for (let k = 2; k < w; k += 4) g.r(x + k, 20, 1, 48, P.blue3); g.r(x, 20, 2, 48, P.blueL); g.r(x - 2, 18, w + 4, 3, P.gold); });
      // picture frame
      g.r(412, 28, 38, 28, P.gold); g.r(412, 28, 38, 1, P.goldL); g.r(415, 31, 32, 22, P.blue2); g.poly([[415, 53], [426, 42], [434, 47], [447, 38], [447, 53]], P.leaf); g.oval(440, 36, 3, 3, P.goldL); g.r(450, 30, 2, 28, P.ink, 0.25);
      // rug
      g.r(186, 150, 210, 88, P.ink, 0.2); g.r(182, 146, 210, 88, P.terra2); g.r(188, 152, 198, 76, P.terra); g.r(198, 162, 178, 56, P.cream2);
      for (let k = 0; k < 5; k++) { const cx = 222 + k * 33, cy = 190; g.poly([[cx, cy - 12], [cx + 10, cy], [cx, cy + 12], [cx - 10, cy]], k % 2 ? P.gold : P.blue); g.poly([[cx, cy - 5], [cx + 4, cy], [cx, cy + 5], [cx - 4, cy]], P.cream2); }
      for (let x = 184; x < 392; x += 3) { g.p(x, 144, P.cream); g.p(x, 235, P.cream); }
      // couch
      g.r(380, 118, 136, 6, P.ink, 0.22);
      g.r(384, 74, 124, 18, P.blue3); g.r(384, 74, 124, 2, P.blueL); g.r(384, 90, 124, 22, P.blue); for (let x = 425; x < 508; x += 41) g.r(x, 92, 1, 20, P.blue3); g.r(386, 92, 120, 2, P.blueL);
      g.r(384, 112, 124, 8, P.blue3); g.r(376, 80, 12, 40, P.blue); g.r(376, 80, 12, 2, P.blueL); g.r(504, 80, 12, 40, P.blue3); g.r(504, 80, 12, 2, P.blue);
      g.r(392, 82, 18, 12, P.gold); g.r(392, 82, 18, 2, P.goldL); g.r(482, 82, 18, 12, P.pink); g.r(482, 82, 18, 2, P.creamL);
      // floor lamp with a warm pool
      g.oval(530, 124, 34, 14, P.goldL, 0.18); g.oval(530, 120, 8, 3, P.brown); g.r(529, 58, 2, 62, P.brown); g.r(518, 48, 24, 10, P.goldL); g.r(518, 48, 24, 2, P.creamL); g.r(518, 57, 24, 1, P.gold);
      // fiddle-leaf plant, left of the bare wall
      g.oval(176, 116, 14, 4, P.ink, 0.25); g.r(164, 98, 22, 18, P.terra); g.r(164, 98, 22, 2, P.terraL); g.r(182, 98, 4, 18, P.terra2);
      g.r(174, 70, 2, 30, P.leaf3); g.bush(174, 74, 16, 22, P, 8); g.bush(166, 88, 10, 10, P, 9);
    });
    const light = W.paint(560, 300, g => {
      g.poly([[74, 64], [128, 64], [250, 300], [176, 300]], P.goldL, 0.18); g.poly([[86, 64], [118, 64], [226, 300], [196, 300]], P.goldL, 0.12);
      g.oval(290, 44, 60, 26, P.goldL, 0.12);
    });
    const fg = W.paint(170, 110, g => { g.bush(110, 70, 64, 46, P, 51); g.bush(40, 90, 42, 30, P, 52); g.bush(150, 30, 34, 30, P, 53); for (let k = 0; k < 6; k++) g.r(70 + k * 14, 40 + (k % 3) * 9, 1, 30, P.leaf3, 0.6); });
    const mote = W.paint(1, 1, g => g.p(0, 0, P.creamL));
    const world = kit.h('<div class="cam wall-world" style="width:2240px;height:1200px"></div>');
    world.append(W.layer(kit, bg, 0, 0, 560, 300, 'wall-room'));
    this.light = W.layer(kit, light, 0, 0, 560, 300, 'wall-light'); world.append(this.light);
    this.motes = [...Array(10)].map(() => { const m = W.layer(kit, mote, 0, 0, 1, 1, 'wall-mote'); world.append(m); return m; });
    this.fg = W.layer(kit, fg, 360, 200, 170, 110, 'wall-plant');
    const root = kit.h('<div class="ground" style="background:var(--brown2, #2B1A14)"></div>');
    root.append(world, this.fg); kit.stage.append(root); this.world = world;
  },
  render(t) {
    const e = eio(seg(t, -0.3, 5.5));
    this.world.style.transform = 'translate(' + W.px(-20) + 'px,' + W.px(-8) + 'px)';
    this.fg.style.transform = 'translate(' + W.px(-10) + 'px,' + W.px(10) + 'px)';
    this.light.style.opacity = (0.85 + 0.15 * Math.sin(t * 1.3)).toFixed(3);
    this.motes.forEach((m, k) => {
      const q = ((t * 0.09 + k / 10) % 1 + 1) % 1, y = 70 + q * 200;
      m.style.left = W.px(90 + (y - 64) * 0.5 + (k * 17) % 36 + Math.sin(t * 0.8 + k) * 2) + 'px'; m.style.top = W.px(y) + 'px';
      m.style.opacity = q < 0.1 || q > 0.9 ? 0.4 : 0.95;
    });
  },
});
