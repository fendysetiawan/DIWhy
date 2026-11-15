// Pixel-art helpers shared by the scenes (defines W).
// DIWHY opening: cozy farm-sim pixel art on a 480 x 270 grid (4 stage px per pixel), matched to the team's portrait sprites:
// warm saturated tones, dark-brown edging (never black), lit from the upper left.
window.W = {
  ink(w) { return 'stroke:var(--line);stroke-width:' + (w || 4) + ';stroke-linejoin:round;stroke-linecap:round'; },
  boil(t) { const k = Math.floor(t * 12) % 3; return [[0, 0], [1.2, -0.8], [-0.9, 1.1]][k]; },
  push(kit, t, dur, a, b) { return a + (b - a) * kit.eio(kit.seg(t, 0, dur)); },
  R(x, y, w, h, c) { return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" style="fill:var(--' + c + ')"/>'; },
  svg(cls, inner) { return '<svg class="art pix ' + cls + '" viewBox="0 0 320 180" preserveAspectRatio="none" shape-rendering="crispEdges">' + inner + '</svg>'; },
  sprite(rows, x, y, map) { let s = ''; rows.forEach((row, r) => { let k = 0; while (k < row.length) { const ch = row[k]; if (ch === '.' || !map[ch]) { k++; continue; } let e = k; while (e < row.length && row[e] === ch) e++; s += W.R(x + k, y + r, e - k, 1, map[ch]); k = e; } }); return s; },
  disc(cx, cy, r, c) { let s = ''; for (let dy = -r; dy < r; dy++) { const w = Math.round(Math.sqrt(r * r - (dy + 0.5) * (dy + 0.5))); if (w > 0) s += W.R(cx - w, cy + dy, 2 * w, 1, c); } return s; },
  dith(id, a, b) { return '<pattern id="' + id + '" width="2" height="2" patternUnits="userSpaceOnUse">' + (a ? '<rect width="2" height="2" style="fill:var(--' + a + ')"/>' : '') + '<rect width="1" height="1" style="fill:var(--' + b + ')"/><rect x="1" y="1" width="1" height="1" style="fill:var(--' + b + ')"/></pattern>'; },
  // Snap a move to whole art pixels: 4 stage px each on the 480 x 270 grid.
  px(v) { return Math.round(v) * 4; },

  // ---- palette, read from the film's four colors, plus the sprites' lush greens and accents
  hex(c) { c = String(c).trim(); if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) || 0); },
  mix(a, b, p) { const A = W.hex(a), B = W.hex(b); return '#' + A.map((v, i) => Math.round(v * p + B[i] * (1 - p)).toString(16).padStart(2, '0')).join(''); },
  pal(kit) {
    const cs = getComputedStyle(kit.stage), g = (n, d) => { const v = cs.getPropertyValue(n).trim(); return /^#[0-9a-f]{3,6}$/i.test(v) ? v : d; };
    const G = g('--ground', '#F8E5CC'), M = g('--main', '#D9692E'), S = g('--second', '#2B1A14'), A = g('--accent', '#2B5FB8'), m = W.mix;
    return { cream: G, creamL: m(G, '#FFFFFF', 0.6), cream2: m(G, M, 0.82), peach: m(G, M, 0.6), peach2: m(G, M, 0.4), terra: M, terraL: m(M, G, 0.7), terra2: m(M, S, 0.7),
      woodL: m(M, G, 0.55), wood: m(M, S, 0.62), wood2: m(M, S, 0.42), brownL: m(S, M, 0.45), brown: m(S, M, 0.7), brown2: m(S, M, 0.88), ink: S,
      blue: A, blueL: m(A, G, 0.5), blue2: m(A, G, 0.72), blue3: m(A, S, 0.62), slate: m(S, A, 0.72), slate2: m(S, A, 0.85),
      gold: '#F2B33D', goldL: '#F8D77A', pink: '#E8728D', violet: '#8C6BC9',
      grassL: '#A5D15F', grass: '#7DB646', grass2: '#5E9A36', leafL: '#B4DA6A', leaf: '#6CA640', leaf2: '#467F2E', leaf3: '#2C5524' };
  },
  // ---- paint pixel art once onto a small canvas; it becomes a CSS background (no canvas stays on the stage)
  paint(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const g = {
      x, w, h,
      r(X, Y, Wd, Hd, col, a) { if (!col) return; x.globalAlpha = a == null ? 1 : a; x.fillStyle = col; x.fillRect(Math.round(X), Math.round(Y), Math.round(Wd), Math.round(Hd)); x.globalAlpha = 1; },
      p(X, Y, col, a) { g.r(X, Y, 1, 1, col, a); },
      oval(cx, cy, rx, ry, col, a) { for (let dy = -ry; dy < ry; dy++) { const ww = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow((dy + 0.5) / ry, 2)))); if (ww > 0) g.r(cx - ww, cy + dy, 2 * ww, 1, col, a); } },
      dith(X, Y, Wd, Hd, col, ph, a) { for (let j = 0; j < Hd; j++) for (let i = (j + (ph || 0)) % 2; i < Wd; i += 2) g.r(X + i, Y + j, 1, 1, col, a); },
      // a filled polygon with hard pixel edges (no smoothing)
      poly(pts, col, a) {
        const ys = pts.map(q => q[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
        for (let y = y0; y < y1; y++) { const yy = y + 0.5, xs = [];
          for (let i = 0; i < pts.length; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= yy && by > yy) || (by <= yy && ay > yy)) xs.push(ax + (yy - ay) * (bx - ax) / (by - ay)); }
          xs.sort((p, q) => p - q); for (let k = 0; k + 1 < xs.length; k += 2) g.r(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, col, a); }
      },
      // a leafy cluster: dark base, mid, light lobes on the upper left, a few bright speckles
      bush(cx, cy, rx, ry, P, seed) {
        const r = W.rng(seed); g.oval(cx + 1, cy + 2, rx, ry, P.leaf3); g.oval(cx, cy, rx, ry, P.leaf2);
        for (let k = 0; k < 7; k++) { const a = r() * 6.28, d = r() * 0.55; g.oval(cx + Math.cos(a) * rx * d - rx * 0.12, cy + Math.sin(a) * ry * d - ry * 0.15, Math.max(2, rx * 0.42), Math.max(2, ry * 0.42), P.leaf); }
        for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = r() * 0.45; g.oval(cx - rx * 0.3 + Math.cos(a) * rx * d * 0.6, cy - ry * 0.32 + Math.sin(a) * ry * d * 0.6, Math.max(1, rx * 0.22), Math.max(1, ry * 0.2), P.leafL); }
      },
    };
    fn(g); return c.toDataURL();
  },
  rng(seed) { let s = seed | 0 || 1; return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 8) & 0xffffff) / 0x1000000; }; },
  // place a painted image as a pixel layer (art units -> stage px)
  layer(kit, data, x, y, w, h, cls) { const el = kit.h('<div class="pixl ' + (cls || '') + '" style="left:' + x * 4 + 'px;top:' + y * 4 + 'px;width:' + w * 4 + 'px;height:' + h * 4 + 'px"></div>'); el.style.backgroundImage = 'url(' + data + ')'; return el; },
};
