/* eslint-disable @typescript-eslint/no-this-alias, @typescript-eslint/no-unused-vars -- copied from the design export as-is */
// Landing page motion, ported from the "Phylax Mockup.html" design export (Home page): boots the
// art, prints the year receipt, reveals sections on scroll and pages one section per gesture.
// It works on the DOM by element id, so the markup in Landing.tsx must keep those ids.
import { PhylaxArt, createField3D } from "./art";

export class LandingMotion {

  start() {
    var self = this, tries = 0;
    (function look() {
      if (self.dead || self.booted) return;
      var h = document.getElementById('meadow-hero');
      if (h && h.clientWidth) self.boot();
      else if (tries++ < 240) requestAnimationFrame(look);
    })();
  }

  dispose() {
    this.dead = true;
    (this.parts || []).forEach(function (p) { if (p) p.dispose(); });
    this.parts = [];
    if (this.io) this.io.disconnect();
    if (this.onScroll) document.removeEventListener('scroll', this.onScroll, true);
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    cancelAnimationFrame(this.tick);
    if (this.onWheel) {
      window.removeEventListener('wheel', this.onWheel);
      window.removeEventListener('touchstart', this.onTouchStart);
      window.removeEventListener('touchmove', this.onTouchMove);
      window.removeEventListener('touchend', this.onTouchEnd);
      window.removeEventListener('keydown', this.onKey);
      document.removeEventListener('click', this.onClick);
      document.removeEventListener('scroll', this.onPageScroll, true);
      window.removeEventListener('resize', this.onPageResize);
    }
    if (this.secNav && this.secNav.parentNode) this.secNav.parentNode.removeChild(this.secNav);
  }

  // three.js comes from the npm package (see art.js) instead of the design tool's blob URL.
  loadThree(cb) { cb(); }

  replay() { if (this.field) this.field.replay(); }

  boot() {
    if (this.booted || this.dead) return;
    this.booted = true;
    var self = this;
    var $ = function (id) { return document.getElementById(id); };
    this.parts = [];
    this.loadThree(function () {
      if (self.dead) return;
      self.field = createField3D($('meadow-hero'));
      self.parts.push(self.field);
    });
    var edge = $('edge-grass') ? PhylaxArt.edge($('edge-grass'), '#344C3D') : null;
    this.parts.push(edge,
      $('dither-1') ? PhylaxArt.dither($('dither-1'), 'sprout', { delay: 0.2 }) : null,
      $('dither-2') ? PhylaxArt.dither($('dither-2'), 'trio', { delay: 0.35 }) : null,
      $('dither-3') ? PhylaxArt.dither($('dither-3'), 'snip', { delay: 0.5 }) : null);

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.setupReceipt(reduce);
    this.setupPaging(reduce);
    if (reduce) return;

    if (window.IntersectionObserver) {
      var io = this.io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.remove('pre'); io.unobserve(e.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
      var vh = window.innerHeight || 900;
      document.querySelectorAll('[data-rv]').forEach(function (el) {
        if (el.getBoundingClientRect().top > vh * 0.9) { el.classList.add('pre'); io.observe(el); }
      });
    }
  }

  // ---------- section paging: one scroll = one section, with a clear transition and a section index on the right ----------
  setupPaging(reduce) {
    var self = this;
    var page = document.getElementById('page');
    var ids = ['hero', 'year', 'how', 'see', 'privacy'];
    var names = ['Field', 'Your year', 'How it works', 'What you\'ll see', 'Privacy'];
    var darkSec = { hero: true, privacy: true };
    var active = -1, animating = false, anim = 0, lockUntil = 0, lastWheel = 0, acc = 0, accTimer = 0;
    function enabled() { return (window.innerHeight || 900) < 1300; }
    function scroller() {
      var el = page && page.parentNode;
      while (el && el !== document.body && el !== document.documentElement) {
        var cs = getComputedStyle(el);
        if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2) return el;
        el = el.parentNode;
      }
      return document.scrollingElement || document.documentElement;
    }
    function vh() { return window.innerHeight || 900; }
    function docTop(el) { var y = 0; while (el) { y += el.offsetTop || 0; el = el.offsetParent; } return y; }
    function geom() {
      var sc = scroller();
      var base = (sc === document.scrollingElement || sc === document.documentElement) ? 0 : docTop(sc) + (sc.clientTop || 0);
      var t = ids.map(function (id) { var el = document.getElementById(id); return el ? docTop(el) - base : 0; });
      return { sc: sc, t: t, max: sc.scrollHeight - sc.clientHeight, cur: sc.scrollTop };
    }
    function range(g, i) {
      var lo = Math.min(g.t[i], g.max);
      var hi = i < ids.length - 1 ? Math.max(lo, Math.min(g.max, g.t[i + 1] - vh())) : g.max;
      return [lo, hi];
    }
    function indexAt(g) {
      var mid = g.cur + vh() * 0.5, i = 0;
      for (var k = 0; k < g.t.length; k++) if (g.t[k] <= mid) i = k;
      return i;
    }

    // ---- the index on the right ----
    var nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'Sections');
    nav.className = 'secnav';
    nav.innerHTML = ids.map(function (id, i) {
      return '<button type="button" data-i="' + i + '"><span class="lbl">' + names[i] + '</span><span class="num">0' + (i + 1) + '</span><span class="bar"></span></button>';
    }).join('');
    // the index is built but not shown; it only tracks which section is current
    this.secNav = nav;
    var btns = nav.querySelectorAll('button');
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      go(+b.getAttribute('data-i'));
    });
    function mark(i, fromNav) {
      nav.classList.toggle('on-dark', !!darkSec[ids[i]]);
      for (var k = 0; k < btns.length; k++) {
        btns[k].classList.toggle('cur', k === i);
        if (k === i) btns[k].setAttribute('aria-current', 'true'); else btns[k].removeAttribute('aria-current');
      }
      if (i !== active) {
        nav.classList.add('flash'); clearTimeout(self.flashT); self.flashT = setTimeout(function () { nav.classList.remove('flash'); }, 1800);
        active = i;
        if (self.onSectionEnter) self.onSectionEnter(ids[i]);
      }
    }
    function showNav() {
      var on = enabled();
      nav.style.display = on ? '' : 'none';
      // in paged mode every section fills the screen, so only one is ever in view
      ['hero', 'how', 'see', 'privacy'].forEach(function (id) {
        var el = document.getElementById(id); if (!el) return;
        if (id === 'hero') { el.style.height = on ? Math.max(640, vh()) + 'px' : ''; return; }
        el.style.minHeight = on ? vh() + 'px' : '';
        el.style.display = on && id !== 'privacy' ? 'flex' : '';
        el.style.flexDirection = 'column';
        el.style.justifyContent = 'center';
        el.style.boxSizing = 'border-box';
      });
    }

    function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function go(j, landBottom) {
      if (!enabled()) return;
      var g = geom();
      if (j < 0 || j >= ids.length) return;
      var r = range(g, j), target = landBottom ? r[1] : r[0];
      var sec = document.getElementById(ids[j]);
      if (sec && !reduce && j !== active) {
        sec.classList.remove('sec-in'); void sec.offsetWidth; sec.classList.add('sec-in');
        setTimeout(function () { sec.classList.remove('sec-in'); }, 1300);
      }
      mark(j);
      cancelAnimationFrame(anim);
      var from = g.sc.scrollTop, t0 = performance.now(), dur = reduce ? 1 : 900;
      animating = true;
      lockUntil = t0 + dur + 150;
      (function step(now) {
        var k = Math.min(1, (now - t0) / dur);
        g.sc.scrollTop = from + (target - from) * ease(k);
        if (k < 1) anim = requestAnimationFrame(step); else animating = false;
      })(t0);
    }
    function step(dir) {
      var g = geom(), i = active < 0 ? indexAt(g) : active, r = range(g, i);
      // a section taller than the screen scrolls inside first
      if (dir > 0 && g.cur < r[1] - 2) { glideBy(g, Math.min(r[1], g.cur + vh() * 0.6)); return; }
      if (dir < 0 && g.cur > r[0] + 2) { glideBy(g, Math.max(r[0], g.cur - vh() * 0.6)); return; }
      if (dir > 0) go(i + 1); else go(i - 1, true);
    }
    function glideBy(g, target) {
      cancelAnimationFrame(anim);
      var from = g.sc.scrollTop, t0 = performance.now(), dur = 520;
      animating = true; lockUntil = t0 + dur + 80;
      (function st(now) {
        var k = Math.min(1, (now - t0) / dur);
        g.sc.scrollTop = from + (target - from) * (1 - Math.pow(1 - k, 3));
        if (k < 1) anim = requestAnimationFrame(st); else animating = false;
      })(t0);
    }
    this.pager = {
      next: function (fromId) { if (enabled() && ids[active] === fromId && !animating) go(ids.indexOf(fromId) + 1); }
    };

    // ---- input: a gesture moves one section; trackpad momentum after it is swallowed ----
    this.onWheel = function (e) {
      if (!enabled() || e.ctrlKey) return;
      e.preventDefault();
      var now = performance.now();
      var quiet = now - lastWheel > 220;
      lastWheel = now;
      if (now < lockUntil) { lockUntil = Math.max(lockUntil, now + 120); return; }
      if (quiet) acc = 0;
      acc += e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? vh() : 1);
      if (Math.abs(acc) >= 24) { var d = acc > 0 ? 1 : -1; acc = 0; step(d); }
    };
    var ty = null, tx = 0;
    this.onTouchStart = function (e) { ty = e.touches[0].clientY; };
    this.onTouchMove = function (e) { if (enabled() && ty != null) e.preventDefault(); };
    this.onTouchEnd = function (e) {
      if (!enabled() || ty == null) return;
      var dy = ty - (e.changedTouches[0] ? e.changedTouches[0].clientY : ty); ty = null;
      if (Math.abs(dy) > 40 && performance.now() >= lockUntil) step(dy > 0 ? 1 : -1);
    };
    this.onKey = function (e) {
      if (!enabled()) return;
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
      var down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !/BUTTON|^A$/.test(tag));
      var up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
      if (e.key === 'Home') { e.preventDefault(); go(0); return; }
      if (e.key === 'End') { e.preventDefault(); go(ids.length - 1); return; }
      if (!down && !up) return;
      e.preventDefault();
      if (performance.now() < lockUntil) return;
      step(down ? 1 : -1);
    };
    this.onClick = function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var j = ids.indexOf(a.getAttribute('href').slice(1));
      if (j < 0 || !enabled()) return;
      e.preventDefault(); go(j);
    };
    // dragging the scrollbar still works: keep the index and the receipt in step with wherever you end up
    this.onPageScroll = function () { if (!animating && enabled()) mark(indexAt(geom())); };
    this.onPageResize = function () { showNav(); if (enabled()) mark(indexAt(geom())); };
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('touchstart', this.onTouchStart, { passive: true });
    window.addEventListener('touchmove', this.onTouchMove, { passive: false });
    window.addEventListener('touchend', this.onTouchEnd);
    window.addEventListener('keydown', this.onKey);
    document.addEventListener('click', this.onClick);
    document.addEventListener('scroll', this.onPageScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.onPageResize);
    showNav();
    if (enabled()) mark(indexAt(geom()));
  }

  // ---------- the year receipt: prints by itself when you arrive; loops on the canvas view ----------
  setupReceipt(reduce) {
    var self = this;
    var $ = function (id) { return document.getElementById(id); };
    var sec = $('year'), stage = $('year-stage'), wrap = $('rc-wrap'), clip = $('rc-clip'), paper = $('rc-paper');
    var hero = $('hero'), copy = $('hero-copy');
    if (!sec || !paper) return;
    var lines = Array.prototype.slice.call(paper.querySelectorAll('.rc-line'));
    var yh1 = $('yh-1'), yh2 = $('yh-2'), ycopy = $('year-copy'), stub = $('rc-stub'), printer = $('rc-printer'), led = $('rc-led');
    var stC = $('st-count'), stT = $('st-total'), stF = $('st-flag');
    var mode = 'auto', stageH = 900, t0 = performance.now(), playing = false, DUR = 9.5;
    var tear = (function () {
      var pts = [], w = 316;
      for (var x = 0; x <= w; x += 8) pts.push(x + 'px ' + ((x / 8) % 2 ? 7 : 0) + 'px');
      return 'polygon(' + pts.join(',') + ',' + w + 'px 100%,0 100%)';
    })();
    function layoutMode() {
      var vh = window.innerHeight || 900;
      mode = reduce ? 'still' : vh < 1300 ? 'paged' : 'auto';
      stageH = mode === 'auto' ? 900 : Math.max(620, vh);
      stage.style.height = stageH + 'px';
      sec.style.height = stageH + 'px';
    }
    function cl(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function eo(x) { return 1 - Math.pow(1 - cl(x), 3); }
    var lastShown = -1;
    function apply(p) {
      [yh1, yh2].forEach(function (el, i) {
        var k = eo((p - i * 0.025) / 0.1);
        el.style.transform = 'translateY(' + ((1 - k) * 60).toFixed(1) + 'px) scale(' + (1 + (1 - k) * 0.08).toFixed(3) + ')';
        el.style.filter = k < 0.99 ? 'blur(' + ((1 - k) * 16).toFixed(1) + 'px)' : '';
        el.style.opacity = k.toFixed(3);
      });
      var q = cl((p - 0.1) / 0.6);
      var full = paper.offsetHeight + 10;
      var shown = q * full;
      clip.style.height = (36 + shown).toFixed(1) + 'px';
      var col = wrap.parentNode, colTop = col.offsetTop || 0;
      var room = stageH - colTop - wrap.offsetTop - 96 - 60;
      var pan = eo((p - 0.7) / 0.06);
      wrap.style.transform = 'translateY(' + (-Math.max(0, shown - room) * (1 - pan)).toFixed(1) + 'px)';
      if (Math.abs(shown - lastShown) > 0.5) {
        lastShown = shown;
        var n = 0, tot = 0, fl = 0;
        for (var i = 0; i < lines.length; i++) {
          var el = lines[i];
          var on = el.offsetTop + el.offsetHeight - 36 <= shown;
          var amt = +el.getAttribute('data-amt');
          if (on && amt > 0) { n++; tot += amt; if (el.getAttribute('data-flag') === '1') fl++; }
        }
        stC.textContent = n; stT.textContent = '$' + Math.round(tot).toLocaleString('en-US'); stF.textContent = fl;
      }
      led.style.opacity = q > 0 && q < 1 ? (Math.sin(performance.now() / 70) > 0 ? '1' : '0.35') : '1';
      var r = cl((p - 0.77) / 0.15);
      if (r > 0) {
        clip.style.clipPath = tear; clip.style.webkitClipPath = tear;
        var tug = Math.sin(cl(r / 0.18) * Math.PI) * 14;
        var fall = cl((r - 0.15) / 0.85); fall = fall * fall;
        clip.style.transform = 'translate(' + (fall * 90).toFixed(1) + 'px,' + (tug + 12 * cl(r / 0.15) + fall * 1100).toFixed(1) + 'px) rotate(' + (fall * 18 + tug * 0.15).toFixed(2) + 'deg)';
        clip.style.opacity = (1 - cl((r - 0.55) / 0.45)).toFixed(3);
        stub.style.opacity = '1';
        var shake = r < 0.12 ? Math.sin(r * 140) * 4 * (1 - r / 0.12) : 0;
        printer.style.transform = 'translateX(' + shake.toFixed(1) + 'px) rotate(' + (shake * 0.3).toFixed(2) + 'deg)';
      } else {
        clip.style.clipPath = ''; clip.style.webkitClipPath = ''; clip.style.transform = ''; clip.style.opacity = '1';
        stub.style.opacity = '0'; printer.style.transform = '';
      }
      var o = cl((p - 0.93) / 0.07);
      ycopy.style.opacity = (1 - o * 0.6).toFixed(3);
      ycopy.style.transform = 'translateY(' + (-o * 30).toFixed(1) + 'px)';
    }
    function heroScroll() {
      if (!hero || !copy || reduce) return;
      var r = hero.getBoundingClientRect();
      var sc = hero.clientHeight / (r.height || 1);
      var px = Math.max(0, -r.top * sc), k = Math.min(1, px / (hero.clientHeight * 0.75));
      copy.style.transform = px ? 'translateY(' + (px * 0.38).toFixed(1) + 'px)' : '';
      copy.style.opacity = px ? (1 - k).toFixed(3) : '';
      copy.style.filter = k > 0.02 ? 'blur(' + (k * 10).toFixed(1) + 'px)' : '';
      if (self.field) self.field.setScroll(k);
    }
    this.onScroll = function () { heroScroll(); };
    this.onResize = function () { layoutMode(); heroScroll(); if (!playing && mode === 'paged') apply(done ? 1 : 0); };
    document.addEventListener('scroll', this.onScroll, { capture: true, passive: true });
    window.addEventListener('resize', this.onResize);
    layoutMode();
    var done = false;
    if (mode === 'still') { apply(0.72); return; }
    apply(0);
    var prevEnter = this.onSectionEnter;
    this.onSectionEnter = function (id) {
      if (prevEnter) prevEnter(id);
      if (id === 'year' && mode === 'paged') { t0 = performance.now(); playing = true; done = false; lastShown = -1; }
    };
    (function loop() {
      self.tick = requestAnimationFrame(loop);
      var now = performance.now();
      if (mode === 'auto') { apply(Math.min(1, (((now - t0) / 1000) % 12) / 10)); return; }
      if (!playing) return;
      var p = (now - t0) / 1000 / DUR;
      apply(Math.min(1, p));
      if (p >= 1) {
        playing = false; done = true;
        setTimeout(function () { if (self.pager && !self.dead) self.pager.next('year'); }, 250);
      }
    })();
  }
}
