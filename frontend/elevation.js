/* DIWhy elevation props: small pixel pictures drawn over the 2D elevation view (the 533 x 300 canvas)
   so the player sees what the event card is about (smoke, a beehive, a cat in the vent...).

   How it is used:
   - each event in events/*.csv has a `visual` column: tokens like `smoke@dryer` or `thought:stack@ceiling`
   - game-link.js calls DIWHY_ELEV.show(tokens) when a card opens and DIWHY_ELEV.clear() when it is answered
   - index.html calls DIWHY_ELEV.draw(ctx, jobId, now) every frame, right after the job's own scene
   - a backend test loads this file and checks every CSV token against KIT, so keep KIT a plain literal

   Token grammar: prop[:variant]@anchor, tokens separated by spaces; each part is lowercase letters, digits, - and _
   (the same rule as backend/src/content/csv.ts).
   Job ids are the page's: wall (kitchen wall), bath (toilet), dryer.
   Every anchor keeps a prop of about 48 x 48 px inside the canvas and out of the bottom-left corner
   (x < 256 and y > 144), where the event card sits.
   Some objects move as the job goes on (the dryer is pulled out and a new one wheeled in; the toilet is lifted
   out and a new one dropped in). index.html's draw functions publish where they are now in DIWHY_ELEV.scene
   ({ dryerX } for the dryer job, { toilet: { x, y } or null } for the bathroom) and the anchors that name
   those objects follow them. Plain script, no build step. */
(function () {
  'use strict';

  var KIT = {
    props: {
      smoke: {}, scorch: {}, melt: {}, lint: {}, crushed: {}, hole: {}, bees: {}, honey: {}, dust: {},
      plug: {}, toowide: {}, dent: {}, cat: {}, nest: {}, wires: {}, panel: {}, pipe: {}, duct: {},
      beam: {}, crack: {}, gap: {}, mismatch: {}, hazmat: {}, calendar: {}, rust: {}, rot: {},
      drip: {}, puddle: {}, stain: {}, smell: {}, sound: {}, wobble: {}, measure: {}, snap: {},
      fan: {}, soldout: {}, partner: {},
      thought: { variants: ['island', 'lights', 'hallway', 'squeak', 'vanity', 'bidet', 'fan', 'stack', 'smart', 'shelf'] }
    },
    anchors: {
      wall:  { opening: [330, 112], outlet: [484, 200], ceiling: [400, 26], floor: [330, 264], beam: [330, 58], door: [492, 226] },
      bath:  { valve: [304, 226], base: [284, 226], drain: [284, 244], tank: [284, 196], vanity: [440, 206], below: [340, 276],
               fan: [480, 26], door: [492, 226], ceiling: [400, 26], floor: [340, 264] },
      dryer: { dryer: [340, 150], outlet: [400, 212], hose: [440, 132], vent: [447, 106], wall: [350, 84], floor: [330, 264],
               shelf: [170, 104], door: [492, 226], ceiling: [400, 26] }
    }
  };

  var OUT = '#2b1a12', BURST_MS = 1500;
  var current = [];            /* [{ prop, variant, anchor }] */
  var burstState = null;       /* { kind, anchor, start } (start is set on the first draw) */
  var scene = {};              /* where the moving objects are now, published by index.html's draw functions */
  var W = 533, H = 300, FLOOR_Y = 250;

  /* Where an anchor is right now. Fixed ones are as in KIT; the dryer anchor follows the dryer, and the toilet's
     base and tank follow the toilet while one stands (a lifted-out toilet or one still dropping in leaves the
     flange, where they sit instead). Nothing is ever left under the event card or off the canvas. */
  function resolve(jobId, name) {
    var table = KIT.anchors[jobId], base = table && table[name];
    if (!base) return null;
    var x = base[0], y = base[1], sc = scene || {};
    if (jobId === 'dryer' && name === 'dryer' && typeof sc.dryerX === 'number') x = sc.dryerX + 42;
    if (jobId === 'bath' && (name === 'base' || name === 'tank')) {
      var t = sc.toilet;
      if (t && typeof t.x === 'number' && typeof t.y === 'number') {
        if (t.x + 56 >= 262 && t.y >= FLOOR_Y - 12) { x = t.x + 28; y = t.y - (name === 'base' ? 24 : 54); }
        else { y = name === 'base' ? 236 : 222; } /* no toilet standing: the flange in the floor */
      } else if (t === null) y = name === 'base' ? 236 : 222;
    }
    if (y > 120 && x < 280) x = 280; /* the event card covers the bottom left */
    return [Math.max(24, Math.min(W - 24, Math.round(x))), Math.max(24, Math.min(H - 24, Math.round(y)))];
  }

  function reduced() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* whole-pixel helpers, the same style as the page's fr / fb / fo */
  function pen(ctx) {
    var r = function (x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    var b = function (x, y, w, h, c) { r(x - 1, y - 1, w + 2, h + 2, OUT); r(x, y, w, h, c); };
    var o = function (cx, cy, rx, ry, c) {
      for (var yy = -ry; yy <= ry; yy++) { var half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / ry) * (yy / ry)))); r(cx - half, cy + yy, half * 2 + 1, 1, c); }
    };
    var oo = function (cx, cy, rx, ry, c) { o(cx, cy, rx + 1, ry + 1, OUT); o(cx, cy, rx, ry, c); };
    return { r: r, b: b, o: o, oo: oo };
  }

  /* one function per prop: (pen, x, y, variant, t) with (x, y) the anchor, t in ms. Keep inside 24 px of the anchor. */
  var DRAWERS = {
    smoke: function (p, x, y, v, t) {
      for (var i = 0; i < 4; i++) {
        var ph = ((t / 1400) + i / 4) % 1, yy = y + 16 - ph * 32, xx = x + Math.round(Math.sin(ph * 6 + i * 2) * 5), rad = 3 + ph * 5;
        p.oo(xx, yy, Math.round(rad), Math.round(rad * .8), ph < .5 ? '#6f6f6f' : ph < .8 ? '#9a9a9a' : '#c4c4c4');
      }
      p.r(x - 6, y + 17, 12, 3, '#e8622a'); p.r(x - 3, y + 17 - (Math.floor(t / 120) % 2), 6, 2, '#ffc23a');
    },
    scorch: function (p, x, y, v, t) {
      p.o(x, y, 20, 16, '#7a5a40'); p.o(x, y, 15, 11, '#4a3526'); p.o(x, y + 2, 9, 6, '#2e2018');
      for (var i = 0; i < 5; i++) p.r(x - 14 + i * 7, y - 22 + (i % 2) * 3, 2, 8 - (i % 3) * 2, '#4a3526');
      for (var k = 0; k < 4; k++) if ((Math.floor(t / 160) + k) % 3 === 0) p.r(x - 8 + k * 5, y + 4 + (k % 2) * 3, 2, 2, '#ff9a3c');
    },
    melt: function (p, x, y, v, t) {
      p.b(x - 8, y - 12, 16, 22, '#efe9dd');
      p.o(x, y - 2, 7, 8, '#6b3a1e'); p.o(x + 1, y - 3, 4, 5, '#2e2018');
      var drip = 4 + Math.round((Math.sin(t / 500) + 1) * 3);
      p.r(x - 5, y + 6, 4, 4 + drip, '#8a4a22'); p.r(x + 3, y + 6, 3, 3 + (drip >> 1), '#6b3a1e');
      if ((Math.floor(t / 140) % 3) === 0) { p.r(x - 3, y - 6, 2, 2, '#ffc23a'); p.r(x + 2, y - 1, 2, 2, '#ff7a2a'); }
    },
    lint: function (p, x, y, v, t) {
      for (var i = 0; i < 6; i++) {
        var dx = Math.round(Math.sin(t / 700 + i * 1.7) * 6), dy = Math.round(Math.cos(t / 900 + i) * 3);
        p.o(x - 14 + i * 5 + dx, y - 8 + (i % 3) * 7 + dy, 5 + (i % 2) * 2, 4 + (i % 2), i % 2 ? '#d7d3cc' : '#bdb8b0');
      }
      p.r(x - 12, y + 12, 24, 3, '#bdb8b0'); p.r(x - 8, y + 10, 16, 3, '#d7d3cc');
    },
    crushed: function (p, x, y) {
      p.b(x - 21, y - 7, 5, 14, '#c8ccd0'); p.b(x + 17, y - 7, 5, 14, '#c8ccd0');
      for (var i = 0; i < 5; i++) p.b(x - 14 + i * 6, y - 1 + (i % 2), 5, 3, i % 2 ? '#aeb3b8' : '#e2e5e8');
      p.r(x - 3, y - 20, 7, 1, '#d13a2a'); p.r(x - 2, y - 19, 5, 1, '#d13a2a'); p.r(x - 1, y - 18, 3, 1, '#d13a2a'); p.r(x, y - 17, 1, 1, '#d13a2a');
      p.r(x - 1, y - 24, 3, 4, '#d13a2a');
    },
    hole: function (p, x, y) {
      p.o(x, y, 19, 16, OUT); p.o(x, y, 16, 13, '#d9c9a3'); p.o(x, y + 1, 13, 10, '#2e1c10'); p.o(x, y + 2, 9, 6, '#120a06');
      [[-18, -4], [-14, -14], [12, -15], [18, 5], [-10, 15], [9, 16]].forEach(function (d) { p.r(x + d[0], y + d[1], 3, 2, '#efe2c4'); });
    },
    bees: function (p, x, y, v, t) {
      for (var i = 0; i < 6; i++) {
        var a = t / 500 * (i % 2 ? 1 : -1) + i * 1.05, rad = 9 + (i % 3) * 5;
        var bx = x + Math.round(Math.cos(a) * rad), by = y + Math.round(Math.sin(a * 1.3) * rad * .8);
        p.r(bx - 2, by - 1, 5, 3, '#2b1a12'); p.r(bx - 1, by, 1, 1, '#f2c94c'); p.r(bx + 1, by, 1, 1, '#f2c94c');
        p.r(bx - 1, by - 3 + (Math.floor(t / 80 + i) % 2), 2, 2, '#e8f4ff');
      }
    },
    honey: function (p, x, y, v, t) {
      p.o(x, y - 8, 17, 9, '#a8681a'); p.o(x, y - 9, 15, 7, '#e0a020'); p.r(x - 8, y - 12, 6, 2, '#ffd75a');
      [-11, -3, 7].forEach(function (d, i) {
        var len = 6 + i * 3 + Math.round((Math.sin(t / 700 + i * 2) + 1) * 2);
        p.r(x + d, y - 2, 4, len, '#e0a020'); p.o(x + d + 1, y - 2 + len, 2, 2, '#e0a020'); p.r(x + d, y - 2, 1, len - 1, '#ffd75a');
      });
    },
    dust: function (p, x, y, v, t) {
      for (var i = 0; i < 6; i++) {
        var gr = (t / 2500 + i / 6) % 1, cx = x - 14 + i * 5 + Math.round(Math.sin(t / 600 + i) * 3), cy = y + 6 - Math.round(gr * 20) + (i % 2) * 3;
        p.o(cx, cy, 6 + (i % 3) * 2, 5 + (i % 2) * 2, gr < .6 ? '#e0dcd2' : '#efece4');
      }
      for (var k = 0; k < 8; k++) p.r(x - 18 + ((k * 37 + Math.floor(t / 90)) % 36), y - 16 + ((k * 23 + Math.floor(t / 70)) % 32), 2, 2, '#fffaf0');
    },
    plug: function (p, x, y, v, t) {
      p.b(x - 21, y - 11, 15, 22, '#efe9dd'); p.r(x - 17, y - 6, 2, 4, OUT); p.r(x - 11, y - 6, 2, 4, OUT); p.r(x - 14, y + 2, 2, 4, OUT);
      p.b(x + 4, y - 9, 17, 18, '#3a3f45');
      [[7, -14], [12, -14], [17, -14], [12, 9]].forEach(function (d) { p.r(x + d[0], y + d[1] + (d[1] < 0 ? 4 : 0), 2, 5, '#d9dee2'); });
      if (Math.floor(t / 400) % 2) { p.r(x - 2, y - 10, 2, 8, '#d13a2a'); p.r(x - 2, y - 1, 2, 2, '#d13a2a'); }
    },
    toowide: function (p, x, y, v, t) {
      p.b(x - 18, y - 18, 4, 36, '#8a5a30'); p.b(x + 14, y - 18, 4, 36, '#8a5a30');
      p.b(x - 21, y - 8, 42, 24, '#f2f4f5'); p.r(x - 21, y - 8, 42, 4, '#e4e8ea'); p.o(x, y + 6, 7, 7, '#9aa6ad');
      var s = Math.floor(t / 300) % 2;
      p.r(x - 21, y - 21, 42, 2, '#d13a2a'); p.r(x - 21 + s, y - 23, 2, 6, '#d13a2a'); p.r(x + 19 - s, y - 23, 2, 6, '#d13a2a');
    },
    dent: function (p, x, y) {
      p.o(x, y, 20, 6, '#5a3a22'); p.o(x, y - 1, 15, 4, '#3b2615'); p.o(x - 2, y - 1, 8, 2, '#24160c');
      [[-22, -3], [-17, 5], [16, -5], [21, 3], [-4, 8], [6, -8]].forEach(function (d) { p.r(x + d[0], y + d[1], 3, 2, '#c99158'); });
      p.r(x - 16, y - 3, 6, 1, '#7d4f2a'); p.r(x + 10, y + 2, 7, 1, '#7d4f2a');
    },
    cat: function (p, x, y, v, t) {
      var tail = Math.round(Math.sin(t / 250) * 3);
      p.r(x + 9, y + 2 + tail, 8, 3, OUT); p.r(x + 10, y + 3 + tail, 6, 1, '#e0903a'); p.r(x + 15, y - 2 + tail, 3, 5, OUT); p.r(x + 16, y - 1 + tail, 1, 3, '#e0903a');
      p.oo(x, y + 6, 10, 8, '#e0903a'); p.r(x - 4, y + 2, 2, 5, '#b86a20'); p.r(x + 2, y + 2, 2, 5, '#b86a20');
      p.oo(x, y - 8, 8, 7, '#e0903a');
      p.r(x - 8, y - 18, 4, 5, OUT); p.r(x - 7, y - 16, 2, 3, '#e0903a'); p.r(x + 5, y - 18, 4, 5, OUT); p.r(x + 6, y - 16, 2, 3, '#e0903a');
      var blink = Math.floor(t / 1600) % 4 === 0;
      p.r(x - 5, y - 10, 3, blink ? 1 : 3, '#7ed957'); p.r(x + 2, y - 10, 3, blink ? 1 : 3, '#7ed957');
      p.r(x - 1, y - 6, 2, 1, '#e8a0a0');
    },
    nest: function (p, x, y, v, t) {
      var bob = Math.floor(t / 300) % 2;
      p.oo(x, y + 8, 18, 8, '#8a5a30'); p.o(x, y + 5, 14, 4, '#5a3a1e');
      for (var i = 0; i < 9; i++) p.r(x - 18 + i * 4, y + 12 - (i % 3) * 3, 5, 1, i % 2 ? '#b07a46' : '#6b4423');
      p.o(x - 6, y + 4, 3, 2, '#bfe3f2'); p.o(x + 7, y + 4, 3, 2, '#bfe3f2');
      p.oo(x, y - 6 - bob, 7, 6, '#f2c94c'); p.r(x + 7, y - 7 - bob, 4, 2, '#e07a2a'); p.r(x + 3, y - 9 - bob, 2, 2, OUT);
      p.r(x - 8, y - 4 - bob, 6, 3, '#d9a82a');
    },
    wires: function (p, x, y, v, t) {
      var cols = ['#d13a2a', '#f2c94c', '#3b6688'];
      p.b(x - 16, y - 18, 32, 4, '#6b4423');
      for (var c = 0; c < 3; c++) {
        var len = 14 + c * 4;
        for (var k = 0; k < len; k += 2) { var px = x - 12 + c * 12 + Math.round(Math.sin(k * .4 + c + t / 600) * 2); p.r(px - 1, y - 14 + k, 4, 3, OUT); }
        for (var k2 = 0; k2 < len; k2 += 2) { var px2 = x - 12 + c * 12 + Math.round(Math.sin(k2 * .4 + c + t / 600) * 2); p.r(px2, y - 14 + k2, 2, 2, cols[c]); }
        var ex = x - 12 + c * 12 + Math.round(Math.sin(len * .4 + c + t / 600) * 2);
        p.r(ex, y - 12 + len, 2, 3, '#e8a050');
        if ((Math.floor(t / 130) + c) % 4 === 0) { p.r(ex - 3, y - 8 + len, 2, 2, '#fff7c2'); p.r(ex + 3, y - 10 + len, 2, 2, '#ffe07a'); }
      }
    },
    panel: function (p, x, y, v, t) {
      p.b(x - 14, y - 20, 28, 40, '#a8b0b5'); p.r(x - 11, y - 17, 22, 34, '#8c969c');
      for (var i = 0; i < 6; i++) { p.r(x - 9, y - 14 + i * 5, 8, 3, i % 2 ? '#2b3138' : '#d9dee2'); p.r(x + 1, y - 14 + i * 5, 8, 3, i % 3 ? '#d9dee2' : '#2b3138'); }
      p.b(x + 8, y - 24, 6, 5, (Math.floor(t / 300) % 2) ? '#d13a2a' : '#7a2a22');
      p.r(x - 14, y + 12, 4, 8, '#f2c94c'); p.r(x + 12, y + 8, 4, 9, '#d13a2a'); p.r(x - 3, y + 20, 5, 3, '#3b6688');
    },
    pipe: function (p, x, y, v, t) {
      p.b(x - 5, y - 22, 10, 44, '#e8e8e8'); p.r(x - 3, y - 22, 2, 44, '#ffffff'); p.r(x + 2, y - 22, 2, 44, '#c7cdd0');
      for (var i = 0; i < 3; i++) p.b(x - 8, y - 14 + i * 14, 16, 4, '#cfd5d8');
      p.r(x + 8, y - 4, 10, 1, '#8c99a3');
      for (var k = 0; k < 2; k++) { var ph = ((t / 1200) + k / 2) % 1; p.r(x - 1, y + 18 - ph * 38, 2, 3, '#bfe3f2'); }
    },
    duct: function (p, x, y, v, t) {
      p.b(x - 22, y - 9, 44, 18, '#c4ccd0'); p.r(x - 22, y - 9, 44, 3, '#e6ecef'); p.r(x - 22, y + 6, 44, 3, '#9aa6ad');
      for (var i = 1; i < 5; i++) p.r(x - 22 + i * 9, y - 9, 1, 18, '#8c99a3');
      var s = Math.floor(t / 150) % 9;
      for (var k = 0; k < 4; k++) { var ax = x - 18 + ((k * 9 + s) % 36); p.r(ax, y - 2, 4, 1, '#5aa9d6'); p.r(ax + 3, y - 3, 1, 3, '#5aa9d6'); p.r(ax + 3, y + 1, 1, 1, '#5aa9d6'); }
    },
    beam: function (p, x, y) {
      p.b(x - 22, y - 8, 44, 16, '#8a5a30'); p.r(x - 22, y - 8, 44, 3, '#b37a45'); p.r(x - 22, y + 5, 44, 3, '#6e4423');
      for (var i = 0; i < 5; i++) p.r(x - 18 + i * 9, y - 2 + (i % 2) * 2, 5, 1, '#6e4423');
      p.r(x - 22, y - 12, 4, 4, '#8c99a3'); p.r(x + 18, y - 12, 4, 4, '#8c99a3');
    },
    crack: function (p, x, y, v, t) {
      var pts = [[-22, -2], [-16, 2], [-10, -3], [-4, 3], [2, -2], [9, 4], [15, -1], [22, 3]];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i], n = b[0] - a[0];
        for (var k = 0; k <= n; k++) { var yy = Math.round(a[1] + (b[1] - a[1]) * k / n); p.r(x + a[0] + k, y + yy - 1, 1, 4, OUT); }
      }
      for (var j = 1; j < pts.length; j++) { var a2 = pts[j - 1], b2 = pts[j], n2 = b2[0] - a2[0]; for (var m = 0; m <= n2; m++) p.r(x + a2[0] + m, y + Math.round(a2[1] + (b2[1] - a2[1]) * m / n2), 1, 2, '#7a6a5a'); }
      p.r(x - 3, y + 8, 2, 8, OUT); p.r(x + 8, y + 12, 1, 4, OUT);
      var fall = Math.floor(t / 100) % 8; p.r(x + 4, y + 4 + fall * 2, 2, 2, '#c9bfae');
    },
    gap: function (p, x, y) {
      p.b(x - 22, y - 6, 44, 12, '#1a0f0a'); p.r(x - 22, y - 6, 44, 2, '#3b2615');
      for (var i = 0; i < 6; i++) p.r(x - 20 + i * 8, y + 1, 5, 1, '#7d4f2a');
      for (var k = 0; k < 8; k++) { p.r(x - 22 + k * 6, y - 8 - (k % 2), 3, 2, '#c99158'); p.r(x - 19 + k * 6, y + 6 + (k % 3 === 0 ? 1 : 0), 3, 2, '#c99158'); }
    },
    mismatch: function (p, x, y) {
      p.b(x - 22, y - 9, 22, 18, '#c99158'); p.b(x, y - 9, 22, 18, '#e0d8c6');
      for (var i = 0; i < 3; i++) { p.r(x - 22, y - 9 + i * 6 + 5, 22, 1, '#7d4f2a'); }
      p.r(x - 14, y - 9, 1, 6, '#7d4f2a'); p.r(x - 7, y - 3, 1, 6, '#7d4f2a'); p.r(x - 15, y + 3, 1, 6, '#7d4f2a');
      p.r(x + 6, y - 9, 1, 18, '#cfc6b2'); p.r(x + 14, y - 9, 1, 18, '#cfc6b2');
      p.r(x - 1, y - 12, 2, 24, '#d13a2a'); p.r(x - 4, y - 14, 8, 2, '#d13a2a'); p.r(x - 4, y + 12, 8, 2, '#d13a2a');
    },
    hazmat: function (p, x, y, v, t) {
      for (var i = 0; i < 24; i++) { var half = Math.round(i * .62); p.r(x - half - 1, y - 20 + i, 1, 1, OUT); p.r(x + half, y - 20 + i, 1, 1, OUT); }
      p.r(x - 14, y + 3, 28, 1, OUT);
      for (var j = 1; j < 23; j++) { var h = Math.round(j * .62); p.r(x - h, y - 20 + j, h * 2, 1, '#f2c94c'); }
      p.r(x - 1, y - 8, 3, 9, OUT); p.r(x - 1, y + 3 - 1, 3, 3, OUT);
      for (var k = 0; k < 5; k++) p.r(x - 22 + ((k * 11 + Math.floor(t / 100)) % 44), y - 4 + ((k * 7 + Math.floor(t / 130)) % 20), 2, 2, '#d7d3cc');
    },
    calendar: function (p, x, y, v, t) {
      p.b(x - 15, y - 18, 30, 36, '#fffaf0'); p.r(x - 15, y - 18, 30, 8, '#d13a2a'); p.r(x - 9, y - 21, 3, 6, OUT); p.r(x + 6, y - 21, 3, 6, OUT);
      var n = Math.floor(t / 500) % 4;
      for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
        var cx = x - 11 + c * 6, cy = y - 6 + r * 7, hit = (r * 4 + c) < 4 + n;
        p.r(cx, cy, 4, 4, '#e8e2d6'); if (hit && r === 0) { p.r(cx, cy + 1, 4, 1, '#d13a2a'); p.r(cx + 1, cy, 1, 4, '#d13a2a'); }
      }
    },
    rust: function (p, x, y, v, t) {
      p.b(x - 10, y - 14, 20, 9, '#8c99a3'); p.r(x - 10, y - 14, 20, 2, '#c4d0d6'); p.b(x - 5, y - 5, 10, 18, '#9aa6ad');
      [[-8, -12], [-3, -10], [3, -13], [6, -9], [-4, 0], [1, 4], [-2, 9], [3, 2], [-6, -6]].forEach(function (d, i) { p.r(x + d[0], y + d[1], 3 + (i % 2), 2 + (i % 3 === 0 ? 1 : 0), i % 2 ? '#b5532a' : '#8a3a1a'); });
      for (var k = 0; k < 3; k++) { var ph = ((t / 1500) + k / 3) % 1; p.r(x - 9 + k * 9, y + 4 + ph * 18, 2, 2, '#b5532a'); }
    },
    rot: function (p, x, y, v, t) {
      p.b(x - 22, y - 7, 44, 14, '#7a5a38');
      for (var i = 0; i < 4; i++) p.r(x - 20 + i * 11, y - 4 + (i % 2) * 4, 7, 1, '#5a3e22');
      p.o(x - 8, y, 9, 5, '#3b2a1a'); p.o(x + 10, y + 1, 7, 4, '#2e2012'); p.o(x - 9, y - 1, 4, 2, '#4a6a3a');
      p.r(x + 8, y - 2, 3, 2, '#4a6a3a');
      var ph = (t / 1100) % 1; p.r(x - 8, y + 8 + ph * 12, 2, 3, '#5d9fc4');
    },
    drip: function (p, x, y, v, t) {
      p.b(x - 10, y - 10, 20, 7, '#b9c2c8'); p.r(x - 10, y - 10, 20, 2, '#e8eef1'); p.b(x - 3, y - 17, 6, 7, '#8c99a3'); p.b(x + 8, y - 5, 5, 8, '#d13a2a');
      for (var k = 0; k < 3; k++) { var ph = ((t / 900) + k / 3) % 1, dy = y - 1 + ph * ph * 19; p.r(x - 1 + (k - 1) * 4, dy, 2, 3, '#5aa9d6'); p.r(x + (k - 1) * 4 - 1, dy + 1, 1, 1, '#bfe3f2'); }
      p.o(x, y + 21, 8, 2, '#5d9fc4');
    },
    puddle: function (p, x, y, v, t) {
      p.o(x, y + 10, 21, 6, '#3f7ea3'); p.o(x, y + 10, 19, 5, '#5d9fc4'); p.o(x - 6, y + 9, 8, 2, '#9fd0ea');
      var r = Math.floor(t / 250) % 4; p.r(x + 8 - r, y + 9, 4 + r * 2, 1, '#bfe3f2');
      p.r(x - 12, y + 3, 2, 4, '#5d9fc4'); p.r(x + 12, y + 2, 2, 5, '#5d9fc4');
      var ph = (t / 1000) % 1; p.r(x - 2, y - 2 + ph * 10, 2, 3, '#5aa9d6');
    },
    stain: function (p, x, y) {
      p.o(x, y, 22, 10, '#a8743a'); p.o(x, y, 18, 8, '#c9a468'); p.o(x, y, 12, 5, '#cdb98f'); p.o(x + 1, y, 6, 2, '#b98a4a');
      p.r(x - 14, y + 7, 3, 4, '#a8743a'); p.r(x + 11, y + 6, 2, 5, '#a8743a');
    },
    smell: function (p, x, y, v, t) {
      for (var c = 0; c < 3; c++) {
        for (var k = 0; k < 14; k++) {
          var px = x - 10 + c * 10 + Math.round(Math.sin(k * .5 + t / 350) * 2), py = y + 20 - k * 3;
          p.r(px - 1, py - 1, 4, 4, '#4a6a22'); p.r(px, py, 2, 2, c === 1 ? '#a6d04a' : '#8fbf4a');
        }
      }
      var f = Math.floor(t / 200); p.r(x + 12 + (f % 4), y - 18 + (f % 3) * 2, 2, 2, OUT);
    },
    sound: function (p, x, y, v, t) {
      var pulse = Math.floor(t / 250) % 3;
      for (var i = 1; i <= 3; i++) {
        var h = 3 + i * 3, px = x - 4 + i * 6;
        p.r(px - 1, y - h - 1, 4, h * 2 + 3, OUT);
        p.r(px, y - h, 2, h * 2 + 1, i - 1 === pulse ? '#fff7c2' : '#f2c94c');
      }
      p.r(x - 5, y - 3, 3, 6, OUT); p.r(x - 4, y - 2, 1, 4, '#fff7c2');
    },
    wobble: function (p, x, y, v, t) {
      var s = Math.floor(t / 150) % 2 ? 2 : -2;
      p.b(x - 12, y - 4, 24, 8, '#f2f4f5'); p.b(x - 10, y + 4, 20, 4, '#e4e6e2');
      p.r(x - 22, y + 12, 44, 2, OUT);
      [-1, 1].forEach(function (d) {
        for (var i = 0; i < 3; i++) { var px = x + d * (16 + i * 2) + (i % 2 ? s : -s); p.r(px - 1, y - 14 + i * 9 - 1, 4, 5, OUT); p.r(px, y - 14 + i * 9, 2, 3, '#fff7c2'); }
      });
    },
    measure: function (p, x, y, v, t) {
      p.b(x - 21, y - 4, 42, 9, '#f2c94c');
      for (var i = 0; i < 11; i++) p.r(x - 19 + i * 4, y - 4, 1, i % 2 ? 3 : 5, OUT);
      p.b(x - 22, y - 12, 3, 24, '#8c99a3'); p.b(x + 20, y - 12, 3, 24, '#8c99a3');
      var m = Math.round((Math.sin(t / 600) + 1) * 8); p.r(x - 5 + m, y + 7, 3, 3, '#d13a2a'); p.r(x - 4 + m, y + 10, 1, 4, '#d13a2a');
    },
    snap: function (p, x, y, v, t) {
      p.b(x - 21, y - 9, 18, 7, '#c4d0d6'); p.b(x + 3, y + 3, 18, 7, '#9aa6ad'); p.r(x - 3, y - 9, 3, 1, OUT);
      p.r(x - 4, y - 8, 4, 3, '#fff7c2'); p.r(x + 2, y + 2, 3, 3, '#fff7c2');
      if (Math.floor(t / 180) % 2) { p.r(x - 1, y - 4, 2, 6, '#ffe07a'); p.r(x - 4, y - 1, 8, 2, '#ffe07a'); } else { p.r(x - 4, y - 5, 2, 2, '#ffe07a'); p.r(x + 3, y + 1, 2, 2, '#ffe07a'); p.r(x, y - 1, 3, 3, '#fff7c2'); }
    },
    fan: function (p, x, y, v, t) {
      p.b(x - 16, y - 12, 32, 24, '#e8ecee'); p.r(x - 14, y - 10, 28, 20, '#8c969c');
      var s = Math.floor(t / 70) % 4;
      p.r(x - 11, y - 1, 22, 2, '#c4d0d6'); p.r(x - 1, y - 9, 2, 18, '#c4d0d6');
      if (s % 2) { for (var i = -7; i <= 7; i += 2) { p.r(x + i, y + i, 2, 2, '#e8eef1'); p.r(x + i, y - i, 2, 2, '#e8eef1'); } }
      p.o(x, y, 3, 3, OUT);
      for (var k = 0; k < 4; k++) p.r(x - 12 + k * 7, y + 13, 5, 1, '#9aa6ad');
    },
    soldout: function (p, x, y, v, t) {
      p.r(x - 1, y - 24, 2, 8, OUT);
      p.b(x - 14, y - 15, 28, 24, '#fff7c2'); p.r(x - 11, y - 12, 3, 3, OUT);
      for (var i = 0; i < 12; i++) { p.r(x - 8 + i, y - 7 + i * 1, 3, 2, '#d13a2a'); p.r(x + 3 - i, y - 7 + i * 1, 3, 2, '#d13a2a'); }
    },
    partner: function (p, x, y, v, t) {
      var tap = Math.floor(t / 250) % 2;
      p.r(x - 6, y + 8, 5, 12, '#3b6688'); p.r(x + 1, y + 8, 5, 12, '#3b6688');
      p.b(x - 7, y + 18, 6, 3, '#2b1a12'); p.b(x + 1, y + 18 - tap, 6, 3, '#2b1a12');
      p.b(x - 8, y - 6, 16, 16, '#d1586a'); p.r(x - 8, y - 6, 16, 3, '#e57a8a');
      p.b(x - 11, y - 4, 4, 12, '#f0c8a0'); p.b(x + 7, y - 4, 4, 12, '#f0c8a0');
      p.b(x - 6, y - 20, 12, 13, '#f0c8a0'); p.r(x - 7, y - 21, 14, 6, '#5a3a2a'); p.r(x - 7, y - 16, 3, 6, '#5a3a2a');
      p.r(x - 3, y - 14, 2, 2, OUT); p.r(x + 2, y - 14, 2, 2, OUT); p.r(x - 2, y - 9, 4, 1, '#a8503a');
    },
    thought: function (p, x, y, v, t) {
      p.oo(x - 2, y - 2, 19, 13, '#ffffff'); p.oo(x - 14, y + 14, 3, 3, '#ffffff'); p.oo(x - 18, y + 19, 2, 2, '#ffffff');
      var ix = x - 2, iy = y - 2;
      var ICONS = {
        island: function () { p.b(ix - 10, iy - 1, 20, 8, '#8a5a30'); p.r(ix - 11, iy - 4, 22, 3, '#e4d8bf'); p.r(ix - 4, iy - 3, 6, 1, '#5e7f96'); p.r(ix + 5, iy - 9, 1, 6, '#8c99a3'); p.r(ix + 3, iy - 9, 3, 1, '#8c99a3'); },
        lights: function () { p.r(ix - 11, iy - 9, 22, 2, '#8a8a8a'); [-7, 0, 7].forEach(function (d) { p.r(ix + d - 2, iy - 7, 5, 2, '#ffe07a'); p.r(ix + d - 3, iy - 4, 7, 1, '#fff2b0'); p.r(ix + d - 4, iy - 2, 9, 1, '#fff7d0'); p.r(ix + d - 5, iy, 11, 1, '#fffbe8'); }); },
        hallway: function () { p.b(ix - 10, iy - 8, 20, 16, '#b8b0a0'); p.r(ix - 5, iy - 4, 10, 8, '#6a6a6a'); p.r(ix - 10, iy + 4, 20, 1, '#8a8a8a'); p.r(ix - 9, iy - 4, 3, 5, '#e0a040'); p.r(ix + 6, iy - 4, 3, 5, '#5aa9d6'); },
        squeak: function () { p.b(ix - 9, iy - 8, 10, 16, '#a8703f'); p.r(ix - 1, iy, 1, 2, '#f2c94c'); p.r(ix - 9, iy - 5, 2, 2, OUT); p.r(ix - 9, iy + 3, 2, 2, OUT); p.r(ix + 4, iy - 5, 5, 1, OUT); p.r(ix + 5, iy - 2, 6, 1, OUT); p.r(ix + 4, iy + 1, 5, 1, OUT); },
        vanity: function () { p.b(ix - 9, iy + 1, 18, 7, '#9a6236'); p.b(ix - 6, iy - 9, 12, 9, '#b4d4e2'); p.r(ix - 5, iy - 8, 3, 1, '#ffffff'); p.r(ix, iy - 1, 1, 2, '#8c99a3'); p.r(ix, iy - 1, 3, 1, '#8c99a3'); },
        bidet: function () { p.b(ix - 6, iy - 9, 12, 6, '#f2f4f5'); p.o(ix, iy + 1, 9, 4, '#f2f4f5'); p.r(ix - 9, iy + 1, 18, 1, '#c4d0d6'); p.r(ix + 1, iy - 3, 1, 2, '#5aa9d6'); p.r(ix + 2, iy - 4, 1, 1, '#5aa9d6'); p.r(ix + 8, iy - 8, 2, 2, '#ffe07a'); },
        fan: function () { var s = Math.floor(t / 90) % 2; p.r(ix - 9, iy - 1, 18, 2, '#8c99a3'); p.r(ix - 1, iy - 9, 2, 18, '#8c99a3'); if (s) { for (var i = -6; i <= 6; i += 2) { p.r(ix + i, iy + i, 2, 2, '#5e6a72'); p.r(ix + i, iy - i, 2, 2, '#5e6a72'); } } p.o(ix, iy, 2, 2, OUT); },
        stack: function () { p.b(ix - 8, iy - 10, 16, 9, '#f2f4f5'); p.o(ix, iy - 5, 3, 3, '#9aa6ad'); p.b(ix - 8, iy + 1, 16, 9, '#dfe4e6'); p.o(ix, iy + 5, 3, 3, '#5e7f96'); },
        smart: function () { p.b(ix - 4, iy - 9, 8, 17, '#3a3f45'); p.r(ix - 3, iy - 7, 6, 11, '#7fd0ff'); p.r(ix - 1, iy + 5, 2, 1, '#d9dee2'); p.r(ix + 6, iy - 6, 1, 1, '#2b1a12'); p.r(ix + 7, iy - 7, 1, 3, '#2b1a12'); p.r(ix + 8, iy - 8, 1, 5, '#2b1a12'); },
        shelf: function () { for (var i = 0; i < 22; i++) p.r(ix - 11 + i, iy + 3 + ((i / 8) | 0) * -1 + 2, 1, 2, '#8a5a30'); p.r(ix - 9, iy - 4, 3, 7, '#c8382c'); p.r(ix - 5, iy - 5, 3, 8, '#3b6688'); p.r(ix - 1, iy - 3, 3, 6, '#f2c94c'); p.r(ix + 4, iy - 5, 3, 7, '#7ed957'); }
      };
      (ICONS[v] || ICONS.island)();
    }
  };

  /* ---------- parsing ---------- */
  function parseToken(tok) {
    var m = /^([a-z0-9_-]+)(?::([a-z0-9_-]+))?@([a-z0-9_-]+)$/.exec(String(tok).trim());
    if (!m) return null;
    return { prop: m[1], variant: m[2] || null, anchor: m[3] };
  }

  function show(tokens) {
    var list = Array.isArray(tokens) ? tokens : String(tokens || '').split(/\s+/);
    var next = [];
    list.forEach(function (raw) {
      var tok = String(raw == null ? '' : raw).trim();
      if (!tok) return;
      var t = parseToken(tok);
      var def = t && KIT.props[t.prop];
      if (!t || !def || (t.variant && !(def.variants && def.variants.indexOf(t.variant) >= 0))) { console.warn('elevation: unknown prop token "' + tok + '"'); return; }
      next.push(t);
    });
    current = next;
  }

  function clear() { current = []; }

  /* The blow-up is centred on the first picture of the card that was just answered, so call this before clear().
     It keeps the anchor's name, not the props, so the next card's show() never cuts it short. */
  function burst(kind) {
    burstState = { kind: kind === 'water' || kind === 'sparks' ? kind : 'dust', anchor: current.length ? current[0].anchor : null, start: null };
  }

  /* ---------- the blow-up: a screen shake and a spray of particles ---------- */
  function drawBurst(ctx, p, jobId, now, still) {
    if (!burstState) return;
    if (burstState.start === null || now < burstState.start) burstState.start = now;
    var u = (now - burstState.start) / BURST_MS;
    if (u >= 1) { burstState = null; return; }
    var kind = burstState.kind, fade = 1 - u;
    var cx = 340, cy = 150, at = burstState.anchor && resolve(jobId, burstState.anchor);
    if (at) { cx = at[0]; cy = at[1]; }
    var n = still ? 10 : 26;
    for (var k = 0; k < n; k++) {
      var ang = k * 2.399 + (kind === 'water' ? -1.2 : 0), sp = 30 + (k * 53) % 90, life = u * (0.6 + (k % 5) * .1);
      var px = cx + Math.cos(ang) * sp * life * (kind === 'water' ? .6 : 1), py = cy + Math.sin(ang) * sp * life * .8 + (kind === 'water' || kind === 'dust' ? life * life * 70 : 0);
      if (kind === 'water') { p.r(px, py, 3, 4, k % 2 ? '#5aa9d6' : '#bfe3f2'); }
      else if (kind === 'sparks') { p.r(px, py, 2, 2, k % 3 ? '#ffe07a' : '#ff7a2a'); if (k % 4 === 0) p.r(px - 3, py, 8, 1, '#fff7c2'); }
      else { var rad = 3 + Math.round(u * 6) + (k % 3); p.o(px, py, rad, Math.max(2, rad - 1), fade > .5 ? (k % 2 ? '#c4beb2' : '#d7d3cc') : '#e8e4da'); }
    }
    if (u < .25) { var w = Math.round(30 + u * 160); p.r(cx - w / 2, cy - 1, w, 3, kind === 'water' ? '#e8f6ff' : '#fff7c2'); }
  }

  /* ---------- draw ---------- */
  function draw(ctx, jobId, now) {
    var anchors = KIT.anchors[jobId];
    if (!anchors || !ctx) return;
    now = typeof now === 'number' ? now : 0;
    var still = reduced(), t = still ? now * .35 : now, p = pen(ctx);
    if (burstState && !still && ctx.canvas && ctx.drawImage) {
      var st = burstState.start === null ? now : burstState.start, u = (now - st) / BURST_MS;
      if (u >= 0 && u < 1) { var amp = Math.round(6 * (1 - u)), s = Math.floor(now / 40) % 2 ? 1 : -1; ctx.drawImage(ctx.canvas, s * amp, (Math.floor(now / 55) % 2 ? 1 : -1) * Math.round(amp / 2)); }
    }
    for (var i = 0; i < current.length; i++) {
      var c = current[i], a = resolve(jobId, c.anchor), fn = DRAWERS[c.prop];
      if (!a || !fn) continue;
      fn(p, a[0], a[1], c.variant || (KIT.props[c.prop].variants ? KIT.props[c.prop].variants[0] : null), t);
    }
    drawBurst(ctx, p, jobId, now, still);
  }

  window.DIWHY_ELEV = {
    KIT: KIT, show: show, burst: burst, clear: clear, draw: draw, resolve: resolve,
    get scene() { return scene; },
    set scene(v) { scene = v && typeof v === 'object' ? v : {}; }
  };
})();
