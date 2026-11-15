/* eslint-disable @typescript-eslint/no-unused-vars -- copied from the design export as-is */
// Landing page art, ported unchanged from the "Phylax Mockup.html" design export (Home page).
// PhylaxArt draws the 2D canvases (grass edge, dithered step art); createField3D draws the WebGL
// hero field with three.js. Kept as plain JS so it stays a straight copy of the designer's file.
import * as THREE from "three";


// ---- Phylax meadow. One painted world drawn into the hero canvas and the field canvas below it. ----
// The tall grass at the seam is shared, so the two canvases read as one continuous meadow.
var PhylaxArt = (function () {
  function rng(s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) { var c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t, al) {
    var x = hex(a), y = hex(b);
    var r = Math.round(x[0] + (y[0] - x[0]) * t), g = Math.round(x[1] + (y[1] - x[1]) * t), bl = Math.round(x[2] + (y[2] - x[2]) * t);
    return al == null ? 'rgb(' + r + ',' + g + ',' + bl + ')' : 'rgba(' + r + ',' + g + ',' + bl + ',' + al + ')';
  }
  function mk(w, h) { var c = document.createElement('canvas'); if (w) { c.width = w; c.height = h; } return c; }
  function isReduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  var HAZE = '#E4E3D6';

  // ---------------- flower heads, painted once into small sprites ----------------
  function paintHead(kind, r, c1, c2, R, dpr) {
    var tall = kind === 'spike';
    var w = Math.ceil((tall ? r * 1.5 : r * 2.6) * dpr), h = Math.ceil((tall ? r * 4.4 : r * 2.6) * dpr);
    var c = mk(w, h), g = c.getContext('2d');
    g.scale(dpr, dpr);
    var cx = w / dpr / 2, cy = tall ? h / dpr - r * 0.2 : h / dpr / 2;
    g.translate(cx, cy);
    var i, a;
    if (kind === 'cosmos') {
      var n = 8;
      for (i = 0; i < n; i++) {
        a = i / n * Math.PI * 2 + (R() - 0.5) * 0.18;
        var L = r * (0.88 + R() * 0.16), pw = r * (0.38 + R() * 0.06);
        g.save(); g.rotate(a);
        var pg = g.createLinearGradient(0, 0, 0, -L);
        pg.addColorStop(0, c1); pg.addColorStop(0.55, c2); pg.addColorStop(1, mix(c2.length === 7 ? c2 : '#FFFFFF', '#FFFFFF', 0.3));
        g.fillStyle = pg;
        g.beginPath(); g.moveTo(0, 0);
        g.bezierCurveTo(-pw * 0.9, -L * 0.3, -pw, -L * 0.82, -pw * 0.5, -L);
        g.lineTo(-pw * 0.22, -L * 0.93); g.lineTo(0, -L * 1.01); g.lineTo(pw * 0.22, -L * 0.93); g.lineTo(pw * 0.5, -L);
        g.bezierCurveTo(pw, -L * 0.82, pw * 0.9, -L * 0.3, 0, 0); g.fill();
        g.strokeStyle = 'rgba(90,40,50,0.10)'; g.lineWidth = Math.max(0.4, r * 0.03);
        g.beginPath(); g.moveTo(0, -L * 0.15); g.lineTo(0, -L * 0.8); g.stroke();
        g.restore();
      }
      var cg = g.createRadialGradient(-r * 0.05, -r * 0.06, 0, 0, 0, r * 0.26);
      cg.addColorStop(0, '#F3D27A'); cg.addColorStop(1, '#A8722A');
      g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * 0.24, 0, Math.PI * 2); g.fill();
    } else if (kind === 'daisy') {
      var nd = 18;
      for (i = 0; i < nd; i++) {
        a = i / nd * Math.PI * 2 + (R() - 0.5) * 0.12;
        g.save(); g.rotate(a);
        var dg = g.createLinearGradient(0, 0, 0, -r);
        dg.addColorStop(0, '#DCD8CE'); dg.addColorStop(0.4, '#FBFAF6'); dg.addColorStop(1, '#FFFFFF');
        g.fillStyle = dg;
        g.beginPath(); g.ellipse(0, -r * 0.52, r * 0.11, r * (0.44 + R() * 0.08), 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      var yg = g.createRadialGradient(-r * 0.08, -r * 0.08, 0, 0, 0, r * 0.3);
      yg.addColorStop(0, '#F6DC78'); yg.addColorStop(0.7, '#DDA93A'); yg.addColorStop(1, '#B98325');
      g.fillStyle = yg; g.beginPath(); g.arc(0, 0, r * 0.27, 0, Math.PI * 2); g.fill();
    } else if (kind === 'poppy') {
      for (i = 0; i < 5; i++) {
        a = i / 5 * Math.PI * 2 + R() * 0.3;
        g.save(); g.rotate(a);
        var pp = g.createRadialGradient(0, 0, r * 0.1, 0, -r * 0.4, r * 0.7);
        pp.addColorStop(0, c1); pp.addColorStop(1, c2);
        g.fillStyle = pp; g.globalAlpha = 0.92;
        g.beginPath(); g.ellipse(0, -r * 0.42, r * 0.5, r * 0.52, 0, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
      g.fillStyle = '#3E3B33'; g.beginPath(); g.arc(0, 0, r * 0.16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#E8D27E';
      for (i = 0; i < 10; i++) { a = i / 10 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * r * 0.22, Math.sin(a) * r * 0.22, r * 0.035, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'lace') {
      for (i = 0; i < 16; i++) {
        a = i * 2.4; var rr = r * 0.78 * Math.sqrt((i + 0.5) / 16);
        var ux = Math.cos(a) * rr, uy = Math.sin(a) * rr;
        for (var j = 0; j < 7; j++) {
          var b = j / 7 * Math.PI * 2 + R();
          var dx = ux + Math.cos(b) * r * 0.13, dy = uy + Math.sin(b) * r * 0.13;
          g.fillStyle = dy > 0 ? '#DCD7CA' : '#FCFAF4';
          g.beginPath(); g.arc(dx, dy, r * 0.065, 0, Math.PI * 2); g.fill();
        }
      }
    } else if (kind === 'spike') {
      for (i = 0; i < 16; i++) {
        var y = -i * r * 0.25, s = r * (0.34 - i * 0.017);
        var t = i / 15;
        g.fillStyle = mix(c1, c2, t);
        g.beginPath(); g.ellipse(-s * 0.55, y, s * 0.62, s * 0.5, -0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = mix(c1, c2, Math.min(1, t + 0.15));
        g.beginPath(); g.ellipse(s * 0.55, y - r * 0.12, s * 0.62, s * 0.5, 0.4, 0, Math.PI * 2); g.fill();
      }
    } else {
      var bg2 = g.createLinearGradient(0, r * 0.5, 0, -r * 0.6);
      bg2.addColorStop(0, '#6F8657'); bg2.addColorStop(1, c1);
      g.fillStyle = bg2; g.beginPath(); g.ellipse(0, 0, r * 0.32, r * 0.55, 0, 0, Math.PI * 2); g.fill();
    }
    return { c: c, w: w / dpr, h: h / dpr, ax: cx, ay: cy, tall: tall };
  }

  // ---------------- the meadow ----------------
  function createMeadow(hero, field, opts) {
    opts = opts || {};
    var hx = hero.getContext('2d'), fx = field ? field.getContext('2d') : null;
    if (!hx) return null;
    var reduce = isReduced();
    var W = 0, HH = 0, FH = 0, D = 1, FD = 1;
    var sky = mk(), hills = mk(), scene = mk(), tiny = mk(), fbg = mk(), back = mk();
    var sx = scene.getContext('2d'), tx = tiny.getContext('2d');
    var clouds = [], bands = [], motes = [], bokeh = [];
    var ptr = { x: -9999, y: -9999, v: 0 };
    var vis = { hero: true, field: true };
    var start = performance.now(), prev = start, raf = 0, last = -1, time = 0;

    function windAt(x, y, t) {
      var gx = ((t * 230) % (W + 1100)) - 550;
      var gx2 = ((t * 170 + W * 0.6) % (W + 1100)) - 550;
      var g = Math.exp(-Math.pow((x - gx) / 280, 2)) + 0.7 * Math.exp(-Math.pow((x - gx2) / 220, 2));
      var w = 0.45 * Math.sin(t * 1.05 + x * 0.0042) + 0.2 * Math.sin(t * 2.6 + x * 0.013 + 1.3) + g * 0.95;
      if (ptr.v > 0.01) {
        var dx = x - ptr.x, dy = y - ptr.y;
        w += (dx > 0 ? 1 : -1) * Math.exp(-dx * dx / 12000 - dy * dy / 30000) * ptr.v * 2.4;
      }
      return w;
    }

    // ----- static layers -----
    function drawSky() {
      sky.width = Math.round(W * D); sky.height = Math.round(HH * D);
      var g = sky.getContext('2d'); g.setTransform(D, 0, 0, D, 0, 0);
      var s = g.createLinearGradient(0, 0, 0, HH * 0.72);
      s.addColorStop(0, '#6A8CB3'); s.addColorStop(0.38, '#9AB4CD'); s.addColorStop(0.7, '#D5DEE0'); s.addColorStop(0.86, '#EFE6D3'); s.addColorStop(1, '#F4E9D2');
      g.fillStyle = s; g.fillRect(0, 0, W, HH);
      var sunX = W * 0.8, sunY = HH * 0.16;
      var gl = g.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(W, HH) * 0.62);
      gl.addColorStop(0, 'rgba(255,246,226,0.95)'); gl.addColorStop(0.12, 'rgba(255,238,210,0.55)'); gl.addColorStop(0.45, 'rgba(250,230,205,0.18)'); gl.addColorStop(1, 'rgba(250,230,205,0)');
      g.fillStyle = gl; g.fillRect(0, 0, W, HH);
    }
    function ridge(R, y0, amp, f, ph) {
      var pts = [];
      for (var x = -20; x <= W + 20; x += 10) {
        pts.push([x, y0 + Math.sin(x / W * Math.PI * f + ph) * amp + Math.sin(x / W * Math.PI * f * 2.3 + ph * 1.7) * amp * 0.35 + Math.sin(x / W * Math.PI * f * 6.1 + ph) * amp * 0.08]);
      }
      return pts;
    }
    function fillRidge(g, pts, top, bot, yTop, yBot) {
      g.beginPath(); g.moveTo(-20, yBot);
      for (var i = 0; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.lineTo(W + 20, yBot); g.closePath();
      var gr = g.createLinearGradient(0, yTop, 0, yBot);
      gr.addColorStop(0, top); gr.addColorStop(1, bot);
      g.fillStyle = gr; g.fill();
    }
    function texture(g, R, pts, depth, n, light, dark, len) {
      for (var i = 0; i < n; i++) {
        var p = pts[Math.floor(R() * pts.length)];
        var x = p[0] + R() * 10, y = p[1] + 3 + Math.pow(R(), 1.6) * depth;
        g.fillStyle = R() < 0.5 ? light : dark;
        g.fillRect(x, y - len * (0.5 + R()), 1, len * (0.5 + R()));
      }
    }
    function drawHills() {
      hills.width = Math.round(W * D); hills.height = Math.round(HH * D);
      var g = hills.getContext('2d'); g.setTransform(D, 0, 0, D, 0, 0);
      var R = rng(5);
      var r0 = ridge(R, HH * 0.6, HH * 0.022, 2.1, 0.6);
      fillRidge(g, r0, '#A6B7C0', '#B9C4BE', HH * 0.57, HH * 0.7);
      // a soft line of far trees on the ridge
      for (var i = 0; i < 26; i++) {
        var p = r0[Math.floor(R() * r0.length)];
        var tr = 6 + R() * 12;
        var tg = g.createRadialGradient(p[0], p[1], 0, p[0], p[1], tr);
        tg.addColorStop(0, 'rgba(120,142,140,0.55)'); tg.addColorStop(1, 'rgba(120,142,140,0)');
        g.fillStyle = tg; g.beginPath(); g.ellipse(p[0], p[1] - tr * 0.2, tr * 1.4, tr * 0.8, 0, 0, Math.PI * 2); g.fill();
      }
      var hz = g.createLinearGradient(0, HH * 0.55, 0, HH * 0.68);
      hz.addColorStop(0, 'rgba(240,233,214,0)'); hz.addColorStop(0.6, 'rgba(240,233,214,0.55)'); hz.addColorStop(1, 'rgba(240,233,214,0.2)');
      g.fillStyle = hz; g.fillRect(0, HH * 0.55, W, HH * 0.13);
      var r1 = ridge(R, HH * 0.635, HH * 0.02, 1.5, 2.2);
      fillRidge(g, r1, '#B9C196', '#A3B07F', HH * 0.6, HH * 0.75);
      texture(g, R, r1, HH * 0.06, 2200 * W / 1440, 'rgba(214,212,160,0.5)', 'rgba(128,146,98,0.45)', 3);
      var r2 = ridge(R, HH * 0.672, HH * 0.024, 1.2, 4.1);
      fillRidge(g, r2, '#A0AF78', '#869A62', HH * 0.64, HH * 0.8);
      texture(g, R, r2, HH * 0.08, 2600 * W / 1440, 'rgba(206,206,148,0.5)', 'rgba(104,124,78,0.45)', 4);
      var r3 = ridge(R, HH * 0.712, HH * 0.012, 1.8, 0.9);
      fillRidge(g, r3, '#869A61', '#3E5434', HH * 0.7, HH * 1.0);
      // a warm haze sitting low over the far fields
      var hz2 = g.createLinearGradient(0, HH * 0.6, 0, HH * 0.76);
      hz2.addColorStop(0, 'rgba(246,236,212,0.35)'); hz2.addColorStop(1, 'rgba(246,236,212,0)');
      g.fillStyle = hz2; g.fillRect(0, HH * 0.6, W, HH * 0.16);
    }
    function cloudSprite(R, cw, ch, wisp) {
      var q = 0.24; // painted at reduced resolution, then scaled up: the softness comes for free
      var c = mk(Math.ceil(cw * 1.5 * q), Math.ceil(ch * 1.7 * q)), g = c.getContext('2d');
      g.scale(q, q); g.translate(cw * 0.25, ch * 0.45);
      var i, x, y, r, gr;
      if (wisp) {
        for (i = 0; i < 14; i++) {
          x = cw * (0.15 + R() * 0.7); y = ch * (0.4 + (R() - 0.5) * 0.4); r = ch * (0.2 + R() * 0.25);
          gr = g.createRadialGradient(x, y, 0, x, y, r);
          gr.addColorStop(0, 'rgba(255,252,246,0.55)'); gr.addColorStop(1, 'rgba(255,252,246,0)');
          g.fillStyle = gr; g.save(); g.translate(x, y); g.scale(3.2, 1); g.translate(-x, -y);
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore();
        }
        return c;
      }
      for (i = 0; i < 18; i++) {
        x = cw * (0.12 + R() * 0.76); y = ch * (0.72 + R() * 0.1); r = ch * (0.12 + R() * 0.12);
        gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(184,192,214,0.7)'); gr.addColorStop(1, 'rgba(184,192,214,0)');
        g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); g.fill();
      }
      if ('filter' in g) g.filter = 'blur(1.5px)';
      for (i = 0; i < 70; i++) {
        var u = R();
        var tower = Math.exp(-Math.pow((u - 0.5) * 2.4, 2));
        x = cw * (0.1 + u * 0.8); y = ch * (0.72 - tower * (0.25 + R() * 0.4)); r = ch * (0.06 + R() * 0.1) * (0.7 + tower * 0.7);
        gr = g.createRadialGradient(x + r * 0.25, y - r * 0.3, r * 0.05, x, y, r);
        gr.addColorStop(0, 'rgba(255,253,248,0.9)'); gr.addColorStop(0.45, 'rgba(246,242,240,0.7)'); gr.addColorStop(0.8, 'rgba(214,214,228,0.22)'); gr.addColorStop(1, 'rgba(214,214,228,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      for (i = 0; i < 10; i++) {
        x = cw * (0.35 + R() * 0.5); y = ch * (0.25 + R() * 0.35); r = ch * (0.06 + R() * 0.08);
        gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,236,214,0.6)'); gr.addColorStop(1, 'rgba(255,236,214,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
      return c;
    }
    function buildClouds() {
      var R = rng(31);
      var spec = [
        { x: 0.58, y: 0.05, w: 0.36, h: 0.3, v: 6 },
        { x: 0.12, y: 0.2, w: 0.2, h: 0.13, v: 9 },
        { x: 0.95, y: 0.3, w: 0.22, h: 0.15, v: 8 },
        { x: 0.3, y: 0.1, w: 0.34, h: 0.06, v: 13, wisp: true },
        { x: 0.75, y: 0.42, w: 0.3, h: 0.05, v: 16, wisp: true },
        { x: 0.05, y: 0.44, w: 0.12, h: 0.07, v: 11 }
      ];
      clouds = spec.map(function (s) {
        var cw = W * s.w, ch = HH * s.h;
        return { x: W * s.x, y: HH * s.y, w: cw, h: ch, v: s.v * (reduce ? 0 : 1), img: cloudSprite(R, cw, ch, s.wisp) };
      });
    }
    function drawFieldBg() {
      fbg.width = Math.round(W * FD); fbg.height = Math.round(FH * FD);
      var g = fbg.getContext('2d'); g.setTransform(FD, 0, 0, FD, 0, 0);
      var gr = g.createLinearGradient(0, 0, 0, FH);
      gr.addColorStop(0, '#3E5434'); gr.addColorStop(0.14, '#41573A'); gr.addColorStop(0.24, '#55693F'); gr.addColorStop(0.4, '#8C9259'); gr.addColorStop(0.58, '#C4BC8A'); gr.addColorStop(0.78, '#EAE3D1'); gr.addColorStop(1, '#F7F3F5');
      g.fillStyle = gr; g.fillRect(0, 0, W, FH);
      // sun coming through from the upper right
      var sl = g.createRadialGradient(W * 0.85, FH * 0.42, 0, W * 0.85, FH * 0.42, W * 0.55);
      sl.addColorStop(0, 'rgba(255,238,196,0.5)'); sl.addColorStop(1, 'rgba(255,238,196,0)');
      g.fillStyle = sl; g.fillRect(0, 0, W, FH);
      // the out-of-focus close grass, painted at quarter size so it comes out blurred
      var q = 0.12;
      back.width = Math.ceil(W * q); back.height = Math.ceil(FH * q);
      var b = back.getContext('2d'); b.setTransform(q, 0, 0, q, 0, 0);
      var R = rng(91), n = Math.round(300 * W / 1440);
      for (var i = 0; i < n; i++) {
        var u = R();
        var root = FH * (0.46 + u * 0.2), hgt = Math.min(120 + u * 260 + R() * 90, root - FH * 0.2), wd = 4 + u * 16 + R() * 6;
        var x = R() * W, lean = (R() - 0.5) * 0.5;
        var tone = R();
        var cs = u < 0.35 ? ['#4C6338', '#7D8B52', '#8E9358', '#A3A56A'] : ['#6F8456', '#8C9A64', '#A7AE78', '#B8B583', '#C9C08C'];
        var c = cs[Math.floor(tone * cs.length)];
        b.globalAlpha = 0.3 + u * 0.4;
        var tipx = x + Math.sin(lean) * hgt, tipy = root - Math.cos(lean) * hgt;
        var bgd = b.createLinearGradient(0, root, 0, tipy);
        bgd.addColorStop(0, mix(c, '#3E5434', 0.5)); bgd.addColorStop(0.6, c); bgd.addColorStop(1, mix('#C9C08C', '#F6EED6', R()));
        b.fillStyle = bgd;
        b.beginPath(); b.moveTo(x - wd / 2, root);
        b.quadraticCurveTo(x - wd * 0.3 + (tipx - x) * 0.3, root - hgt * 0.6, tipx, tipy);
        b.quadraticCurveTo(x + wd * 0.3 + (tipx - x) * 0.3, root - hgt * 0.6, x + wd / 2, root);
        b.fill();
      }
      // a few blurred blossoms
      var bc = ['#E7B7BA', '#FFFFFF', '#D8C6DE', '#F6E7B9'];
      for (i = 0; i < 26 * W / 1440; i++) {
        b.globalAlpha = 0.5 + R() * 0.4; b.fillStyle = bc[Math.floor(R() * bc.length)];
        b.beginPath(); b.arc(R() * W, FH * (0.3 + R() * 0.4), 6 + R() * 14, 0, Math.PI * 2); b.fill();
      }
      b.globalAlpha = 1;
      bokeh = [];
      for (i = 0; i < 22; i++) bokeh.push({ x: R() * W, y: FH * (0.12 + R() * 0.5), r: 10 + R() * 34, a: 0.06 + R() * 0.14, ph: R() * 6.28, v: 3 + R() * 6 });
    }

    // ----- grass bands and flowers, in world coordinates (y = 0 at the top of the hero) -----
    var PALS = [['#3B5232', '#B9BC80'], ['#4A6338', '#D7CC93'], ['#557048', '#A6B585'], ['#435A33', '#C7C38A']];
    var KINDS = ['cosmos', 'cosmos', 'daisy', 'daisy', 'daisy', 'lace', 'lace', 'spike', 'spike', 'poppy', 'bud'];
    var PETALS = { cosmos: [['#C9727E', '#F2C3C6'], ['#D8959B', '#FBE4E3'], ['#E3DADE', '#FFFFFF'], ['#B884A0', '#EAC9D8']], poppy: [['#C8656A', '#EBA19E'], ['#D8959B', '#F6CFCB']], spike: [['#7E6A9C', '#C9B8DE'], ['#6F86B4', '#C7D5EC'], ['#B07D97', '#E9C7D6']], bud: [['#D8959B', '#D8959B'], ['#E3DADE', '#E3DADE']] };
    function layout() {
      var R = rng(77), k = Math.max(0.45, W / 1440), phone = W < 700;
      var sideBias = phone ? 1 : 0.62;
      var defs = [
        { y0: 0.7, y1: 0.75, h: [5, 13], w: 1.1, n: 1300, haze: 0.38, flex: 0.45, d: 0.1, fl: 0 },
        { y0: 0.745, y1: 0.82, h: [10, 24], w: 1.5, n: 1100, haze: 0.2, flex: 0.6, d: 0.22, fl: 70, fr: [1.6, 2.6], specks: true },
        { y0: 0.81, y1: 0.9, h: [20, 46], w: 2.2, n: 950, haze: 0.07, flex: 0.8, d: 0.36, fl: 46, fr: [3.2, 5] },
        { y0: 0.89, y1: 0.99, h: [40, 92], w: 3.2, n: 760, haze: 0, flex: 1, d: 0.5, fl: 30, fr: [5.5, 8.5] },
        { y0: 0.98, y1: 1.16, h: [80, 180], w: 4.6, n: 700, haze: 0, flex: 1.1, d: 0.64, fl: 14, fr: [8, 12] },
        { y0: 1.06, y1: 1.5, h: [150, 330], w: 6.5, n: 420, persp: true, haze: 0, flex: 1.2, d: 0.78, fl: 7, fr: [11, 16], cap: true }
      ];
      bands = defs.map(function (d, bi) {
        var bl = [], fl = [], n = Math.round(d.n * k);
        var y0 = HH * d.y0, y1 = HH * d.y1;
        for (var i = 0; i < n; i++) {
          var x = R() * (W + 40) - 20, y = y0 + R() * (y1 - y0);
          var h = d.persp ? d.h[0] + ((y - y0) / (y1 - y0)) * (d.h[1] - d.h[0]) * (0.6 + R() * 0.4) : d.h[0] + Math.pow(R(), 1.3) * (d.h[1] - d.h[0]);
          if (d.cap && x < W * 0.5 && !phone) h = Math.min(h, y - HH * 0.86);
          if (d.cap && phone) h = Math.min(h, y - HH * 0.9);
          if (h < 8) continue;
          bl.push({ x: x, y: y, h: h, w: d.w * (0.7 + R() * 0.6) * (d.persp ? 0.7 + (y - y0) / (y1 - y0) * 0.8 : 1), lean: (R() - 0.5) * 0.5, p: Math.floor(R() * PALS.length), j: R() * 0.35, fx: 0.8 + R() * 0.4 });
        }
        var nf = Math.round((d.fl || 0) * k);
        for (var f = 0; f < nf; f++) {
          var u = bi >= 3 ? 1 - Math.pow(R(), sideBias) : R();
          var fxp = bi >= 3 && !phone ? W * (0.36 + u * 0.68) : R() * W;
          var fy = y0 + R() * (Math.min(y1, y0 + HH * 0.2) - y0);
          var kind = d.specks && R() < 0.75 ? 'speck' : KINDS[Math.floor(R() * KINDS.length)];
          var r = d.fr[0] + R() * (d.fr[1] - d.fr[0]);
          var pal = (PETALS[kind] || PETALS.cosmos)[Math.floor(R() * (PETALS[kind] || PETALS.cosmos).length)];
          var stem = d.h[0] * 0.9 + R() * (d.h[1] - d.h[0]) * 0.75 + r * 2;
          if (d.cap && !phone && fxp < W * 0.5) stem = Math.min(stem, fy - HH * 0.86);
          var fo = {
            x: fxp, y: fy, h: stem, r: r, kind: kind, lean: (R() - 0.5) * 0.4, tilt: 0.45 + R() * 0.5, ph: R() * 6.28,
            c: kind === 'speck' ? ['#F4DCDD', '#FFFFFF', '#E7D7EC', '#F6E3A6'][Math.floor(R() * 4)] : null,
            d: d.d + 0.5 + R() * 0.7
          };
          if (kind !== 'speck') fo.spr = paintHead(kind, r, pal[0], pal[1], R, D);
          fl.push(fo);
        }
        fl.sort(function (a, b) { return a.y - b.y; });
        return { d: d, blades: bl, flowers: fl, y0: y0, y1: y1, top: y0 - d.h[1], bot: y1 };
      });
      motes = [];
      for (var m = 0; m < 46; m++) motes.push({ x: R() * W, y: HH * (0.4 + R() * 0.55) + (m % 2 ? 0 : HH * 0.5 + R() * FH * 0.5), r: 0.8 + R() * 1.8, ph: R() * 6.28, v: 6 + R() * 14 });
    }

    function drawBand(g, band, t, oy, oh) {
      if (band.bot < oy || band.top > oy + oh) return;
      var d = band.d, grow0 = reduce ? 1 : 0;
      var bucket = [[], [], [], []];
      var bl = band.blades, i;
      for (i = 0; i < bl.length; i++) {
        var b = bl[i];
        if (b.y < oy || b.y - b.h > oy + oh) continue;
        bucket[b.p].push(b);
      }
      for (var p = 0; p < 4; p++) {
        var list = bucket[p];
        if (!list.length) continue;
        g.beginPath();
        for (i = 0; i < list.length; i++) {
          b = list[i];
          var gr = grow0 || easeOut(clamp01((t - d.d - b.j) / 1.3));
          if (gr <= 0) continue;
          var h = b.h * (0.15 + 0.85 * gr);
          var bend = b.lean + (reduce ? 0 : windAt(b.x, b.y, t - b.j * 0.4) * 0.2 * d.flex * b.fx);
          var tx = b.x + Math.sin(bend) * h, ty = b.y - Math.cos(bend) * h;
          var cx = b.x + Math.sin(bend) * h * 0.32, cy = b.y - h * 0.6;
          g.moveTo(b.x - b.w / 2, b.y);
          g.quadraticCurveTo(cx - b.w * 0.28, cy, tx, ty);
          g.quadraticCurveTo(cx + b.w * 0.28, cy, b.x + b.w / 2, b.y);
        }
        var pal = PALS[p];
        var lg = g.createLinearGradient(0, band.y1, 0, band.top);
        var base = d.haze ? mix(pal[0], HAZE, d.haze * 1.3 > 1 ? 1 : d.haze * 1.3) : pal[0];
        var tip = d.haze ? mix(pal[1], HAZE, d.haze) : pal[1];
        lg.addColorStop(0, base); lg.addColorStop(0.55, mix(pal[0], pal[1], 0.45)); lg.addColorStop(1, tip);
        g.fillStyle = lg; g.fill();
      }
      var fl = band.flowers;
      for (i = 0; i < fl.length; i++) drawFlower(g, fl[i], t, d, oy, oh);
    }
    function drawFlower(g, f, t, d, oy, oh) {
      if (f.y < oy || f.y - f.h - f.r * 3 > oy + oh) return;
      var gr = reduce ? 1 : easeOut(clamp01((t - f.d) / 1.4));
      if (gr <= 0) return;
      var h = f.h * gr;
      var bend = f.lean + (reduce ? 0 : windAt(f.x, f.y, t) * 0.17 * d.flex + Math.sin(t * 1.7 + f.ph) * 0.03);
      var tx = f.x + Math.sin(bend) * h, ty = f.y - Math.cos(bend) * h;
      if (f.kind === 'speck') {
        g.fillStyle = f.c; g.beginPath(); g.arc(tx, ty, f.r * (0.4 + gr * 0.6), 0, Math.PI * 2); g.fill();
        return;
      }
      g.strokeStyle = d.haze ? mix('#4F6A43', HAZE, d.haze) : '#4A6340';
      g.lineWidth = Math.max(0.7, f.r * 0.11); g.lineCap = 'round';
      g.beginPath(); g.moveTo(f.x, f.y); g.quadraticCurveTo(f.x + Math.sin(bend) * h * 0.25, f.y - h * 0.55, tx, ty); g.stroke();
      var s = reduce ? 1 : easeBack(clamp01((t - f.d - 0.8) / 0.75));
      if (s <= 0.01) {
        g.fillStyle = '#6F8657'; g.beginPath(); g.ellipse(tx, ty, f.r * 0.22, f.r * 0.36, bend, 0, Math.PI * 2); g.fill();
        return;
      }
      var sp = f.spr;
      g.save(); g.translate(tx, ty);
      if (sp.tall) { g.rotate(bend); g.scale(s, s); }
      else { g.rotate(bend * 0.6); g.scale(s, s * f.tilt); }
      if (d.haze) g.globalAlpha = 1 - d.haze * 0.5;
      g.drawImage(sp.c, -sp.ax, -sp.ay, sp.w, sp.h);
      g.restore();
      g.globalAlpha = 1;
    }
    function drawMotes(g, t, oy, oh) {
      for (var i = 0; i < motes.length; i++) {
        var m = motes[i];
        if (m.y < oy || m.y > oy + oh) continue;
        var x = ((m.x + t * m.v + Math.sin(t * 0.6 + m.ph) * 20) % (W + 40) + W + 40) % (W + 40) - 20;
        var y = m.y + Math.sin(t * 0.8 + m.ph) * 14;
        var a = 0.35 + 0.35 * Math.sin(t * 1.9 + m.ph);
        if (a <= 0) continue;
        var gr = g.createRadialGradient(x, y, 0, x, y, m.r * 3);
        gr.addColorStop(0, 'rgba(255,248,220,' + a.toFixed(3) + ')'); gr.addColorStop(1, 'rgba(255,248,220,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, m.r * 3, 0, Math.PI * 2); g.fill();
      }
    }
    function shimmer(g, t) {
      if (reduce) return;
      g.save(); g.globalCompositeOperation = 'soft-light';
      for (var s = 0; s < 2; s++) {
        var gx = s ? ((t * 170 + W * 0.6) % (W + 1100)) - 550 : ((t * 230) % (W + 1100)) - 550;
        var gy = HH * 0.8;
        var gr = g.createRadialGradient(gx, gy, 0, gx, gy, 300);
        gr.addColorStop(0, 'rgba(255,244,200,0.55)'); gr.addColorStop(1, 'rgba(255,244,200,0)');
        g.fillStyle = gr; g.save(); g.translate(gx, gy); g.scale(1.4, 0.45); g.translate(-gx, -gy);
        g.beginPath(); g.arc(gx, gy, 300, 0, Math.PI * 2); g.fill(); g.restore();
      }
      g.restore();
    }

    function paintHero(t, dt) {
      var g = sx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(sky, 0, 0);
      g.setTransform(D, 0, 0, D, 0, 0);
      for (var i = 0; i < clouds.length; i++) {
        var c = clouds[i];
        c.x += c.v * dt;
        if (c.x - c.w * 0.75 > W + 20) c.x = -c.w * 0.75 - 20;
        g.drawImage(c.img, c.x - c.w * 0.75, c.y - c.h * 0.45, c.w * 1.5, c.h * 1.7);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(hills, 0, 0);
      g.setTransform(D, 0, 0, D, 0, 0);
      for (i = 0; i < bands.length; i++) {
        drawBand(g, bands[i], t, 0, HH);
        if (i === 1) shimmer(g, t);
      }
      drawMotes(g, t, 0, HH);
    }
    function paintField(t) {
      if (!fx || !FH || !fbg.width || !fbg.height || !back.width) return;
      var g = fx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(fbg, 0, 0);
      g.setTransform(FD, 0, 0, FD, 0, -HH * FD);
      for (var i = 3; i < bands.length; i++) drawBand(g, bands[i], t, HH, FH);
      // bokeh drifting in the light
      g.setTransform(FD, 0, 0, FD, 0, 0);
      for (i = 0; i < bokeh.length; i++) {
        var b = bokeh[i];
        var bx = (b.x + Math.sin(t * 0.3 + b.ph) * 30 + t * b.v) % (W + 80) - 40, by = b.y + Math.sin(t * 0.5 + b.ph) * 12;
        var gr = g.createRadialGradient(bx, by, 0, bx, by, b.r);
        gr.addColorStop(0, 'rgba(255,246,214,' + b.a + ')'); gr.addColorStop(0.7, 'rgba(255,246,214,' + (b.a * 0.6) + ')'); gr.addColorStop(1, 'rgba(255,246,214,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(bx, by, b.r, 0, Math.PI * 2); g.fill();
      }
      var haze = g.createLinearGradient(0, FH * 0.5, 0, FH);
      haze.addColorStop(0, 'rgba(247,243,245,0)'); haze.addColorStop(1, 'rgba(247,243,245,0.55)');
      g.fillStyle = haze; g.fillRect(0, FH * 0.5, W, FH * 0.5);
      // close grass, swaying as one soft layer
      var sw = reduce ? 0 : Math.sin(t * 0.9) * 0.035 + windAt(W * 0.5, HH, t) * 0.02;
      g.save();
      g.transform(1, 0, sw, 1, -sw * FH, 0);
      g.drawImage(back, 0, 0, W, FH);
      g.restore();
      g.setTransform(FD, 0, 0, FD, 0, -HH * FD);
      drawMotes(g, t, HH, FH);
      g.setTransform(FD, 0, 0, FD, 0, 0);
      var mist = g.createLinearGradient(0, FH * 0.46, 0, FH);
      mist.addColorStop(0, 'rgba(247,243,245,0)'); mist.addColorStop(0.3, 'rgba(244,239,232,0.55)'); mist.addColorStop(0.55, 'rgba(246,242,240,0.9)'); mist.addColorStop(1, 'rgba(247,243,245,1)');
      g.fillStyle = mist; g.fillRect(0, FH * 0.46, W, FH * 0.54);
    }

    var PIX = [56, 40, 28, 18, 12, 8, 5, 3], STEP = 0.14;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      time = reduce ? 99 : (now - start) / 1000;
      ptr.v *= 0.94;
      if (!W || !HH) return;
      if (vis.hero && scene.width && sky.width && hills.width) {
        paintHero(time, dt);
        hx.setTransform(1, 0, 0, 1, 0, 0);
        var ph = reduce ? 99 : time / STEP;
        if (ph < PIX.length) {
          var block = PIX[Math.floor(ph)] * D;
          var tw = Math.max(1, Math.ceil(hero.width / block)), th = Math.max(1, Math.ceil(hero.height / block));
          if (tiny.width !== tw || tiny.height !== th) { tiny.width = tw; tiny.height = th; }
          if (!tiny.width || !tiny.height) return;
          tx.imageSmoothingEnabled = true; tx.drawImage(scene, 0, 0, tw, th);
          hx.imageSmoothingEnabled = false;
          hx.drawImage(tiny, 0, 0, tw, th, 0, 0, tw * block, th * block);
        } else if (ph < PIX.length + 2.5) {
          var a = (ph - PIX.length) / 2.5;
          hx.imageSmoothingEnabled = false;
          hx.drawImage(tiny, 0, 0, tiny.width, tiny.height, 0, 0, tiny.width * PIX[PIX.length - 1] * D, tiny.height * PIX[PIX.length - 1] * D);
          hx.imageSmoothingEnabled = true;
          hx.globalAlpha = a; hx.drawImage(scene, 0, 0); hx.globalAlpha = 1;
        } else {
          hx.imageSmoothingEnabled = true;
          hx.drawImage(scene, 0, 0);
        }
      }
      if (vis.field && fx) paintField(time);
    }

    function resize() {
      var w = hero.clientWidth, h = hero.clientHeight;
      if (!w || !h) return;
      D = Math.min(1.5, window.devicePixelRatio || 1);
      FD = Math.min(1.25, window.devicePixelRatio || 1);
      W = w; HH = h; FH = field ? field.clientHeight : 0;
      hero.width = scene.width = Math.round(W * D); hero.height = scene.height = Math.round(HH * D);
      if (field) { field.width = Math.round(W * FD); field.height = Math.round(FH * FD); }
      drawSky(); drawHills(); buildClouds(); layout();
      if (field) drawFieldBg();
    }
    function onMove(e) {
      var el = e.currentTarget === hero.parentNode ? hero : field;
      var r = el.getBoundingClientRect();
      var sc = el.clientWidth / (r.width || 1);
      var x = (e.clientX - r.left) * sc, y = (e.clientY - r.top) * sc + (el === field ? HH : 0);
      var dv = Math.min(1, Math.hypot(x - ptr.x, y - ptr.y) / 40);
      ptr.x = x; ptr.y = y; ptr.v = Math.min(1, ptr.v + dv * 0.25);
    }
    var hostA = hero.parentNode, hostB = field && field.parentNode;
    hostA.addEventListener('pointermove', onMove);
    if (hostB) hostB.addEventListener('pointermove', onMove);
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) { ro.observe(hero); if (field) ro.observe(field); } else window.addEventListener('resize', resize);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.target === hero) vis.hero = e.isIntersecting; else vis.field = e.isIntersecting; });
    }) : null;
    if (io) { io.observe(hero); if (field) io.observe(field); }
    resize();
    raf = requestAnimationFrame(frame);
    return {
      replay: function () { start = performance.now(); },
      dispose: function () {
        cancelAnimationFrame(raf);
        hostA.removeEventListener('pointermove', onMove);
        if (hostB) hostB.removeEventListener('pointermove', onMove);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
        if (io) io.disconnect();
      }
    };
  }

  // ---------------- grass edge: a swaying silhouette that grows out of a solid band ----------------
  function createEdge(canvas, color) {
    var g = canvas.getContext('2d');
    if (!g) return null;
    var reduce = isReduced(), W = 0, H = 0, D = 1, blades = [], raf = 0, t0 = performance.now(), vis = true;
    function layout() {
      var R = rng(13); blades = [];
      var n = Math.round(W / 3.2);
      for (var i = 0; i < n; i++) blades.push({ x: R() * (W + 20) - 10, h: H * (0.25 + Math.pow(R(), 1.8) * 0.75), w: 2 + R() * 3, lean: (R() - 0.5) * 0.5, ph: R() * 6.28 });
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!vis) return;
      var t = reduce ? 0 : (now - t0) / 1000;
      g.setTransform(D, 0, 0, D, 0, 0);
      g.clearRect(0, 0, W, H);
      g.fillStyle = color; g.strokeStyle = color; g.lineCap = 'round';
      g.beginPath();
      for (var i = 0; i < blades.length; i++) {
        var b = blades[i];
        var bend = b.lean + (reduce ? 0 : (0.16 * Math.sin(t * 1.1 + b.x * 0.004) + 0.05 * Math.sin(t * 2.7 + b.ph)));
        var tx = b.x + Math.sin(bend) * b.h, ty = H + 2 - Math.cos(bend) * b.h;
        if (b.head) {
          g.moveTo(tx + b.head, ty); g.arc(tx, ty, b.head, 0, Math.PI * 2);
          g.moveTo(b.x + 0.7, H + 2); g.quadraticCurveTo(b.x + Math.sin(bend) * b.h * 0.3, H - b.h * 0.6, tx + 0.7, ty);
          g.lineTo(tx - 0.7, ty); g.quadraticCurveTo(b.x + Math.sin(bend) * b.h * 0.3 - 1.4, H - b.h * 0.6, b.x - 0.7, H + 2);
          continue;
        }
        g.moveTo(b.x - b.w / 2, H + 2);
        g.quadraticCurveTo(b.x + Math.sin(bend) * b.h * 0.32 - b.w * 0.3, H - b.h * 0.6, tx, ty);
        g.quadraticCurveTo(b.x + Math.sin(bend) * b.h * 0.32 + b.w * 0.3, H - b.h * 0.6, b.x + b.w / 2, H + 2);
      }
      g.fill();
    }
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
      D = Math.min(1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
      layout();
    }
    var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(canvas);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }) : null;
    if (io) io.observe(canvas);
    resize();
    raf = requestAnimationFrame(frame);
    return { dispose: function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); } };
  }

  // ---------------- dithered botanical drawings for the step cards ----------------
  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function petalFlower(g, x, y, r, rot, n) {
    for (var i = 0; i < n; i++) {
      var a = rot + i / n * Math.PI * 2;
      g.save(); g.translate(x, y); g.rotate(a);
      var pg = g.createLinearGradient(0, 0, 0, -r);
      pg.addColorStop(0, 'rgb(255,40,40)'); pg.addColorStop(1, 'rgb(255,190,190)');
      g.fillStyle = pg;
      g.beginPath(); g.ellipse(0, -r * 0.55, r * 0.3, r * 0.55, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    g.fillStyle = '#222'; g.beginPath(); g.arc(x, y, r * 0.24, 0, Math.PI * 2); g.fill();
  }
  function stem(g, x0, y0, x1, y1, bend, w) {
    g.strokeStyle = '#333'; g.lineWidth = w; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + bend, (y0 + y1) / 2, x1, y1); g.stroke();
  }
  function leaf(g, x, y, len, ang, shade) {
    g.save(); g.translate(x, y); g.rotate(ang);
    var lg = g.createLinearGradient(0, -len * 0.2, 0, len * 0.2);
    lg.addColorStop(0, shade ? '#555' : '#777'); lg.addColorStop(1, '#222');
    g.fillStyle = lg;
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0); g.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0); g.fill();
    g.restore();
  }
  var SCENES = {
    sprout: function (g, w, h, t) {
      var ex = w * 0.5, ey = h * 0.66, ew = Math.min(150, w * 0.46), eh = ew * 0.56;
      var sw = Math.sin(t * 1.3) * 6;
      var top = ey - eh / 2 - h * 0.4;
      stem(g, ex, ey - eh * 0.1, ex + sw, top, sw * 0.6, 3);
      leaf(g, ex + sw * 0.4, ey - eh * 0.5 - h * 0.12, 30, -0.5 + Math.sin(t * 1.3) * 0.08, 1);
      leaf(g, ex + sw * 0.6, ey - eh * 0.5 - h * 0.2, 26, Math.PI + 0.45 + Math.sin(t * 1.3 + 1) * 0.08, 0);
      var bud = g.createRadialGradient(ex + sw - 2, top - 3, 0, ex + sw, top, 9);
      bud.addColorStop(0, 'rgb(255,200,200)'); bud.addColorStop(1, 'rgb(255,30,30)');
      g.fillStyle = bud; g.beginPath(); g.ellipse(ex + sw, top, 7, 10, sw * 0.03, 0, Math.PI * 2); g.fill();
      var eg = g.createLinearGradient(0, ey - eh / 2, 0, ey + eh / 2);
      eg.addColorStop(0, '#d8d8d8'); eg.addColorStop(1, '#8a8a8a');
      g.fillStyle = eg; g.fillRect(ex - ew / 2, ey - eh / 2, ew, eh);
      g.strokeStyle = '#222'; g.lineWidth = 2.5;
      g.strokeRect(ex - ew / 2, ey - eh / 2, ew, eh);
      g.beginPath(); g.moveTo(ex - ew / 2, ey - eh / 2); g.lineTo(ex, ey + eh * 0.08); g.lineTo(ex + ew / 2, ey - eh / 2); g.stroke();
      g.fillStyle = '#444';
      for (var i = 0; i < 9; i++) g.fillRect(ex - ew * 0.4 + i * ew * 0.1, ey + eh / 2 + 10, ew * 0.06, 2);
    },
    trio: function (g, w, h, t) {
      var base = h * 0.92;
      g.fillStyle = '#555';
      for (var x = 10; x < w - 10; x += 7) g.fillRect(x, base, 3, 2);
      var xs = [0.3, 0.5, 0.7], hs = [0.5, 0.66, 0.5];
      for (var i = 0; i < 3; i++) {
        var sw = Math.sin(t * 1.2 + i * 0.9) * 7;
        var fx = w * xs[i], top = base - h * hs[i];
        stem(g, fx, base, fx + sw, top, sw * 0.5, 2.6);
        leaf(g, fx + sw * 0.2, base - h * 0.16, 22, i % 2 ? -0.6 : Math.PI + 0.6, i % 2);
        petalFlower(g, fx + sw, top, 15 + (i === 1 ? 4 : 0), t * 0.15 + i, 7);
      }
    },
    snip: function (g, w, h, t) {
      var base = h * 0.95, fx = w * 0.36;
      var cyc = (t % 3.2) / 3.2;
      var sw = Math.sin(t * 1.1) * 4;
      stem(g, fx, base, fx + sw, h * 0.2, sw * 0.5, 2.8);
      leaf(g, fx, base - h * 0.2, 24, -0.6, 1);
      petalFlower(g, fx + sw, h * 0.2, 15, 0.4, 6);
      // a petal that falls after each snip
      if (cyc > 0.32) {
        var pt = (cyc - 0.32) / 0.68;
        var px = fx + 22 + pt * 30 + Math.sin(pt * 9) * 8, py = h * 0.34 + pt * h * 0.55;
        g.save(); g.translate(px, py); g.rotate(pt * 5);
        g.fillStyle = 'rgb(255,80,80)'; g.globalAlpha = 1 - pt * 0.4;
        g.beginPath(); g.ellipse(0, 0, 4, 7, 0, 0, Math.PI * 2); g.fill();
        g.restore(); g.globalAlpha = 1;
      }
      // shears, opening and snapping shut
      var open = cyc < 0.25 ? 0.42 * (1 - Math.pow(cyc / 0.25, 3)) : cyc < 0.6 ? 0 : 0.42 * clamp01((cyc - 0.6) / 0.3);
      var sx0 = fx + 12, sy0 = h * 0.42;
      g.save(); g.translate(sx0 + 46, sy0 + 6); g.rotate(-0.25);
      for (var s = -1; s <= 1; s += 2) {
        g.save(); g.rotate(s * open);
        var bg = g.createLinearGradient(0, -8, 0, 8);
        bg.addColorStop(0, '#bbb'); bg.addColorStop(1, '#555');
        g.fillStyle = bg;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-58, s * 2); g.quadraticCurveTo(-30, s * 9, 0, s * 6); g.closePath(); g.fill();
        g.strokeStyle = '#222'; g.lineWidth = 6;
        g.beginPath(); g.ellipse(34, s * 14, 13, 9, s * 0.4, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 5; g.beginPath(); g.moveTo(0, s * 2); g.lineTo(24, s * 10); g.stroke();
        g.restore();
      }
      g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, 3.5, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  };
  function createDither(canvas, kind, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var reduce = isReduced();
    var CELL = opts.cell || 3, INK = opts.ink || '#344C3D', ACC = opts.accent || '#C9727E';
    var W = 0, H = 0, D = 1, src = mk(), sg = src.getContext('2d', { willReadFrequently: true });
    var raf = 0, t0 = performance.now(), shown = reduce ? 1 : -1, vis = false, lastDraw = 0;
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight; if (!W || !H) return;
      D = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * D); canvas.height = Math.round(H * D);
      src.width = Math.ceil(W / CELL); src.height = Math.ceil(H / CELL);
    }
    function draw(t) {
      var cw = src.width, ch = src.height;
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.fillStyle = '#fff'; sg.fillRect(0, 0, cw, ch);
      sg.setTransform(1 / CELL, 0, 0, 1 / CELL, 0, 0);
      SCENES[kind](sg, W, H, reduce ? 0 : t);
      var px = sg.getImageData(0, 0, cw, ch).data;
      var rev = shown < 0 ? 0 : reduce ? 1 : clamp01((t - shown) / 1.3);
      ctx.setTransform(D, 0, 0, D, 0, 0);
      ctx.clearRect(0, 0, W, H);
      var sz = CELL - 0.6;
      ctx.fillStyle = INK; ctx.beginPath();
      var acc = [];
      for (var y = 0; y < ch; y++) {
        var k = clamp01(rev * 1.6 - (y / ch) * 0.6);
        if (k <= 0) continue;
        for (var x = 0; x < cw; x++) {
          var i = (y * cw + x) * 4;
          var r = px[i] / 255, gg = px[i + 1] / 255;
          var a = r - gg, ink = 1 - r;
          var th = (BAYER[(x & 3) + (y & 3) * 4] + 0.5) / 16;
          var lim = th + (1 - k) * (1 - th);
          if (a * 1.1 > lim) acc.push(x, y);
          else if (ink * 1.15 > lim) ctx.rect(x * CELL, y * CELL, sz, sz);
        }
      }
      ctx.fill();
      ctx.fillStyle = ACC; ctx.beginPath();
      for (var j = 0; j < acc.length; j += 2) ctx.rect(acc[j] * CELL, acc[j + 1] * CELL, sz, sz);
      ctx.fill();
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      if (!vis || !W) return;
      if (now - lastDraw < 45) return;
      lastDraw = now;
      draw((now - t0) / 1000);
    }
    var ro = window.ResizeObserver ? new ResizeObserver(function () { resize(); lastDraw = 0; }) : null;
    if (ro) ro.observe(canvas);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      vis = es[0].isIntersecting;
      if (vis && shown < 0) shown = (performance.now() - t0) / 1000 + (opts.delay || 0);
    }, { threshold: 0.15 }) : null;
    if (io) io.observe(canvas); else { vis = true; shown = 0; }
    resize();
    raf = requestAnimationFrame(frame);
    return { dispose: function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); } };
  }

  return { meadow: createMeadow, edge: createEdge, dither: createDither };
})();

// ---- Phylax hero field (WebGL, three.js). A low camera in a grass field: ~90k instanced blades that bend in
// travelling gusts, dandelion clocks, and a perspective cloud layer drifting overhead. ----
function createField3D(canvas, opts) {
  opts = opts || {};
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' }); }
  catch (e) { return null; }
  if (!renderer.getContext()) return null;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = (canvas.clientWidth || 1440) < 700;
  var DPR = Math.min(phone ? 2 : 1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x9ab4cd, 1);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
  camera.rotation.order = 'YXZ';

  var NOISE = [
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }',
    'float fbm(vec2 p){ float a = 0.5, s = 0.0; mat2 m = mat2(1.6, 1.2, -1.2, 1.6); for (int i = 0; i < 6; i++) { s += a * noise(p); p = m * p; a *= 0.5; } return s; }'
  ].join('\n');

  // shared wind: broad gusts that roll across the field plus a finer ripple
  var WIND = [
    'uniform float uTime;',
    'const vec2 WDIR = vec2(0.92, -0.38);',
    'float gust(vec2 xz){',
    '  float g = noise(xz * 0.16 - WDIR * uTime * 0.55);',
    '  float r = noise(xz * 0.65 - WDIR * uTime * 1.25);',
    '  return smoothstep(0.25, 0.85, g) * 0.85 + r * 0.3;',
    '}',
    'vec3 bendBlade(vec3 base, float y, float h, float lean, vec2 ldir, float seed){',
    '  float w = gust(base.xz);',
    '  float flutter = sin(uTime * 3.1 + seed * 40.0) * 0.06;',
    '  vec2 dir = normalize(WDIR * (0.15 + w) + ldir * (0.6 + lean));',
    '  float amt = lean * 0.8 + w * 0.6 + flutter;',
    '  float k = y * y;',
    '  vec3 p = base;',
    '  p.xz += dir * h * amt * k * 0.85;',
    '  p.y += h * y * (1.0 - 0.28 * amt * amt * y);',
    '  return p;',
    '}'
  ].join('\n');

  // ---------- sky ----------
  var skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: [
      'precision highp float;', 'varying vec3 vDir;', 'uniform float uTime;', NOISE,
      'float cloud(vec2 p){',
      '  vec2 q = vec2(fbm(p * 0.45 + 3.1), fbm(p * 0.45 + 7.7));',
      '  float b = fbm(p * 0.6 + q * 1.2);',
      '  float d = fbm(p * 2.8 + q * 1.6);',
      '  return b * 0.74 + d * 0.32;',
      '}',
      'void main(){',
      '  vec3 d = normalize(vDir);',
      '  float el = d.y;',
      '  vec3 top = vec3(0.380, 0.560, 0.750);',
      '  vec3 mid = vec3(0.590, 0.730, 0.860);',
      '  vec3 hor = vec3(0.850, 0.890, 0.910);',
      '  vec3 col = mix(hor, mid, smoothstep(-0.02, 0.2, el));',
      '  col = mix(col, top, smoothstep(0.18, 0.7, el));',
      '  float e = max(el, 0.0) + 0.16;',
      '  vec2 p = d.xz / e * 0.8 + vec2(uTime * 0.03, -uTime * 0.009);',
      '  vec2 up = -normalize(d.xz + 1e-4);',
      '  float n = cloud(p);',
      '  float cover = mix(0.52, 0.66, smoothstep(0.15, 0.8, el));',
      '  float dens = smoothstep(cover, cover + 0.05, n);',
      '  float above = cloud(p + up * 0.22);',
      '  float shadow = smoothstep(cover - 0.02, cover + 0.2, above) * (1.0 - smoothstep(cover + 0.05, cover + 0.3, n) * 0.5);',
      '  float rim = 1.0 - smoothstep(cover + 0.02, cover + 0.22, n);',
      '  vec3 white = vec3(1.0, 0.995, 0.98);',
      '  vec3 grey = vec3(0.66, 0.72, 0.80);',
      '  vec3 cl = mix(white, grey, shadow * 0.85);',
      '  cl = mix(cl, white, rim * (1.0 - shadow) * 0.4);',
      '  cl = mix(cl, vec3(0.86, 0.91, 0.93), 0.45 * (1.0 - smoothstep(0.0, 0.14, el)));',
      '  col = mix(col, cl, dens * smoothstep(-0.005, 0.03, el));',
      '  col = mix(col, hor, (1.0 - smoothstep(-0.03, 0.03, el)) * 0.6);',
      '  gl_FragColor = vec4(col, 1.0);',
      '}'
    ].join('\n')
  });
  var sky = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false;
  scene.add(sky);

  // ---------- ground ----------
  function groundY(z) { var d = -z - 13; return d > 0 ? -0.0042 * d * d : 0; }
  var gGeo = new THREE.PlaneGeometry(120, 80, 120, 160);
  gGeo.rotateX(-Math.PI / 2);
  gGeo.translate(0, 0, -36);
  var gp = gGeo.attributes.position;
  for (var i = 0; i < gp.count; i++) gp.setY(i, groundY(gp.getZ(i)) - 0.02);
  var groundMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec3 vW; varying float vD; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vD = -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: [
      'precision highp float;', 'varying vec3 vW; varying float vD;', NOISE,
      'void main(){',
      '  float n = fbm(vW.xz * 2.2);',
      '  vec3 c = mix(vec3(0.03, 0.07, 0.015), vec3(0.12, 0.22, 0.05), n);',
      '  c = mix(c, vec3(0.30, 0.42, 0.20), smoothstep(10.0, 30.0, vD) * 0.5);',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n')
  });
  scene.add(new THREE.Mesh(gGeo, groundMat));

  // ---------- grass blades ----------
  var SEG = 5;
  function bladeGeo() {
    var g = new THREE.BufferGeometry();
    var pos = [], idx = [];
    for (var s = 0; s <= SEG; s++) {
      var y = s / SEG;
      if (s < SEG) { pos.push(-0.5, y, 0, 0.5, y, 0); }
      else pos.push(0, 1, 0);
    }
    for (s = 0; s < SEG - 1; s++) { var a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    var l = (SEG - 1) * 2; idx.push(l, l + 1, l + 2);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  }
  var R = (function (s) { return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })(1234);
  var SPREAD = phone ? 0.86 : 1.3, BACK = phone ? 0 : 1.5;
  function scatter(count, near, far, spread) {
    var off = new Float32Array(count * 3), prm = new Float32Array(count * 4);
    for (var i = 0; i < count; i++) {
      var u = R();
      var d = near * Math.pow(far / near, u);
      // reach past the view edge on wide screens, and from where the camera starts the intro (1.4 back)
      var half = (d + BACK) * spread + 0.6;
      var x = (R() * 2 - 1) * half, z = -d;
      off[i * 3] = x; off[i * 3 + 1] = groundY(z); off[i * 3 + 2] = z;
      prm[i * 4] = R(); prm[i * 4 + 1] = R(); prm[i * 4 + 2] = R(); prm[i * 4 + 3] = d;
    }
    return { off: off, prm: prm };
  }
  var grassVS = [
    'precision highp float;',
    'attribute vec3 iOff; attribute vec4 iPrm;',
    'uniform vec2 uH; uniform float uW; uniform float uKind;',
    'varying float vY; varying float vSeed; varying float vGust; varying float vD; varying float vSide;',
    NOISE, WIND,
    'void main(){',
    '  float seed = iPrm.x;',
    '  float h = mix(uH.x, uH.y, pow(iPrm.y, 1.3));',
    '  float yaw = iPrm.z * 6.2832;',
    '  vec2 ldir = vec2(cos(yaw), sin(yaw));',
    '  float lean = 0.15 + seed * 0.35;',
    '  float y = position.y;',
    '  float taper = (1.0 - pow(y, 1.6));',
    '  float width = uW * (0.7 + seed * 0.6) * (1.0 + iPrm.w * 0.07);',
    '  vec3 p = bendBlade(iOff, y, h, lean, ldir, seed);',
    '  vec2 side = vec2(-ldir.y, ldir.x);',
    '  p.xz += side * position.x * width * taper;',
    '  vY = y; vSeed = seed; vGust = gust(iOff.xz); vSide = position.x + 0.5;',
    '  vec4 mv = viewMatrix * vec4(p, 1.0);',
    '  vD = -mv.z;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  var grassFS = [
    'precision highp float;',
    'uniform float uKind;',
    'varying float vY; varying float vSeed; varying float vGust; varying float vD; varying float vSide;',
    'void main(){',
    '  vec3 dark = vec3(0.025, 0.065, 0.015);',
    '  vec3 mid  = mix(vec3(0.13, 0.27, 0.05), vec3(0.22, 0.36, 0.08), vSeed);',
    '  vec3 tip  = mix(vec3(0.36, 0.50, 0.15), vec3(0.62, 0.62, 0.34), smoothstep(0.82, 1.0, vSeed));',
    '  vec3 c = mix(dark, mid, smoothstep(0.0, 0.45, vY));',
    '  c = mix(c, tip, smoothstep(0.45, 1.0, vY));',
    '  if (uKind > 0.5) c = mix(dark, vec3(0.30, 0.42, 0.12), smoothstep(0.0, 0.6, vY));',
    '  c *= 0.86 + 0.24 * vSide;',
    '  c = mix(c, c * 1.3 + vec3(0.05, 0.05, 0.01), smoothstep(0.5, 1.0, vGust) * smoothstep(0.3, 1.0, vY) * 0.7);',
    '  vec3 haze = vec3(0.42, 0.56, 0.42);',
    '  c = mix(c, haze, smoothstep(7.0, 26.0, vD) * 0.42);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');
  var uTime = { value: 0 };
  function bladeField(count, near, far, hMin, hMax, width, kind) {
    var geo = new THREE.InstancedBufferGeometry();
    var base = bladeGeo();
    geo.index = base.index; geo.attributes.position = base.attributes.position;
    var s = scatter(count, near, far, SPREAD);
    geo.setAttribute('iOff', new THREE.InstancedBufferAttribute(s.off, 3));
    geo.setAttribute('iPrm', new THREE.InstancedBufferAttribute(s.prm, 4));
    geo.instanceCount = count;
    var mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      uniforms: { uTime: uTime, uH: { value: new THREE.Vector2(hMin, hMax) }, uW: { value: width }, uKind: { value: kind } },
      vertexShader: grassVS, fragmentShader: grassFS
    });
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    return { mesh: m, off: s.off, prm: s.prm, h: [hMin, hMax] };
  }
  // Desktop spreads blades wider so the sides stay covered; the extra count keeps the density the same.
  var N = phone ? 45000 : 142000;
  bladeField(Math.round(N * 0.58), 0.8, 24, 0.16, 0.42, 0.022, 0);
  bladeField(Math.round(N * 0.42), 0.3, 9, 0.22, 0.46, 0.016, 0);

  // ---------- dandelion clocks: thin stems plus soft seed-head billboards ----------
  var DN = phone ? 1000 : 3300;
  var stems = bladeField(DN, 3.2, 16, 0.3, 0.46, 0.006, 1);
  var hGeo = new THREE.InstancedBufferGeometry();
  var quad = new THREE.PlaneGeometry(1, 1);
  hGeo.index = quad.index; hGeo.attributes.position = quad.attributes.position; hGeo.attributes.uv = quad.attributes.uv;
  hGeo.setAttribute('iOff', new THREE.InstancedBufferAttribute(stems.off, 3));
  hGeo.setAttribute('iPrm', new THREE.InstancedBufferAttribute(stems.prm, 4));
  hGeo.instanceCount = DN;
  var headMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: uTime, uH: { value: new THREE.Vector2(0.3, 0.46) } },
    vertexShader: [
      'precision highp float;',
      'attribute vec3 iOff; attribute vec4 iPrm; uniform vec2 uH;',
      'varying vec2 vUv; varying float vD; varying float vSeed;',
      NOISE, WIND,
      'void main(){',
      '  float seed = iPrm.x; float h = mix(uH.x, uH.y, pow(iPrm.y, 1.3));',
      '  float yaw = iPrm.z * 6.2832; vec2 ldir = vec2(cos(yaw), sin(yaw));',
      '  vec3 tip = bendBlade(iOff, 1.0, h, 0.15 + seed * 0.35, ldir, seed);',
      '  vec4 mv = viewMatrix * vec4(tip, 1.0);',
      '  float size = 0.032 + seed * 0.022;',
      '  mv.xy += position.xy * size;',
      '  vUv = uv; vD = -mv.z; vSeed = seed;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'precision highp float;',
      'varying vec2 vUv; varying float vD; varying float vSeed;',
      'void main(){',
      '  vec2 q = vUv * 2.0 - 1.0;',
      '  float r = length(q);',
      '  float a = atan(q.y, q.x);',
      '  float fibres = 0.75 + 0.25 * sin(a * 23.0 + vSeed * 30.0);',
      '  float body = smoothstep(1.0, 0.55, r) * fibres;',
      '  body = max(body, smoothstep(0.32, 0.1, r));',
      '  if (body < 0.04) discard;',
      '  vec3 c = mix(vec3(0.80, 0.80, 0.74), vec3(1.0, 0.99, 0.95), smoothstep(0.0, 1.0, q.y * 0.5 + 0.6));',
      '  c = mix(c, vec3(0.62, 0.58, 0.46), smoothstep(0.22, 0.0, r) * 0.6);',
      '  c = mix(c, vec3(0.70, 0.78, 0.74), smoothstep(7.0, 22.0, vD) * 0.35);',
      '  gl_FragColor = vec4(c, body * 0.92);',
      '}'
    ].join('\n')
  });
  var heads = new THREE.Mesh(hGeo, headMat);
  heads.frustumCulled = false;
  scene.add(heads);

  // ---------- pixel intro pass ----------
  var rt = new THREE.WebGLRenderTarget(4, 4, { samples: 0 });
  var postScene = new THREE.Scene(), postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var postMat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: rt.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uBlock: { value: 1 }, uMix: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'precision highp float;', 'uniform sampler2D tMap; uniform vec2 uRes; uniform float uBlock; uniform float uMix; varying vec2 vUv;',
      'void main(){',
      '  vec2 cell = uBlock / uRes;',
      '  vec2 puv = (floor(vUv / cell) + 0.5) * cell;',
      '  vec4 a = texture2D(tMap, puv), b = texture2D(tMap, vUv);',
      '  gl_FragColor = mix(a, b, uMix);',
      '}'
    ].join('\n'),
    depthTest: false, depthWrite: false
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));

  // ---------- camera, pointer, scroll ----------
  var look = { x: 0, y: 0, tx: 0, ty: 0 }, scrollK = 0;
  function onMove(e) {
    var r = canvas.getBoundingClientRect();
    look.tx = ((e.clientX - r.left) / (r.width || 1) - 0.5);
    look.ty = ((e.clientY - r.top) / (r.height || 1) - 0.5);
  }
  var host = canvas.parentNode;
  host.addEventListener('pointermove', onMove);
  var W = 0, H = 0;
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 62 : 50;
    camera.updateProjectionMatrix();
    rt.setSize(Math.round(w * DPR), Math.round(h * DPR));
    postMat.uniforms.uRes.value.set(w * DPR, h * DPR);
  }
  var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
  var vis = true;
  var io = window.IntersectionObserver ? new IntersectionObserver(function (es) { vis = es[0].isIntersecting; }) : null;
  if (io) io.observe(canvas);
  resize();

  var PIX = [56, 40, 28, 18, 12, 8, 5, 3], STEP = 0.14;
  var start = performance.now(), raf = 0;
  function ease(t) { return 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3); }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!vis || !W) return;
    var t = reduce ? 40 : (now - start) / 1000;
    uTime.value = reduce ? 6 : now / 1000 % 10000;
    skyMat.uniforms.uTime.value = uTime.value;
    look.x += (look.tx - look.x) * 0.05; look.y += (look.ty - look.y) * 0.05;
    var intro = ease(t / 3.2);
    camera.position.set(look.x * 0.25, 0.78 - intro * 0.2 - scrollK * 0.12, 1.4 * (1 - intro) - scrollK * 0.6);
    camera.rotation.set((phone ? 0.16 : 0.2) - scrollK * 0.05 - look.y * 0.03, -look.x * 0.07, 0);
    sky.position.copy(camera.position);
    var ph = t / STEP;
    if (ph < PIX.length + 2.5 && !reduce) {
      renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
      postMat.uniforms.uBlock.value = PIX[Math.min(PIX.length - 1, Math.floor(ph))] * DPR;
      postMat.uniforms.uMix.value = ph < PIX.length ? 0 : (ph - PIX.length) / 2.5;
      renderer.render(postScene, postCam);
    } else {
      renderer.render(scene, camera);
    }
  }
  raf = requestAnimationFrame(frame);
  return {
    replay: function () { start = performance.now(); },
    setScroll: function (k) { scrollK = Math.max(0, Math.min(1, k)); },
    dispose: function () {
      cancelAnimationFrame(raf);
      host.removeEventListener('pointermove', onMove);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      if (io) io.disconnect();
      renderer.dispose();
    }
  };
}

export { PhylaxArt, createField3D };
