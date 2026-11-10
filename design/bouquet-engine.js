function createBloom(canvas, items, cb) {
  var THREE = window.THREE;
  if (!THREE || !canvas) return null;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  } catch (e) { return null; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe9e1e5, 7, 20);
  var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  // Scroll progress 0 = small and hazy behind the headline, 1 = close up and interactive.
  var prog = { target: 0, cur: 0 };
  var interactive = false;
  var wide = true;
  var V = THREE.Vector3;
  var CAM0 = new V(0, 4.2, 13.5), CAM1 = new V(0, 3.0, 7.6);
  var LOOK0 = new V(0, 1.6, 0), LOOK1 = new V(0, 0.85, 0);
  var tmpA = new V(), tmpB = new V();

  scene.add(new THREE.HemisphereLight(0xfbf6f8, 0x6f8466, 1.25));
  var key = new THREE.DirectionalLight(0xfff1e6, 2.6);
  key.position.set(3.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1; key.shadow.camera.far = 20;
  key.shadow.camera.left = -4; key.shadow.camera.right = 4; key.shadow.camera.top = 4; key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.03;
  scene.add(key);
  var rim = new THREE.DirectionalLight(0xc9d8ea, 2.0);
  rim.position.set(-4, 3.5, -5);
  scene.add(rim);
  var warm = new THREE.PointLight(0xffd6dc, 9, 14, 2);
  warm.position.set(-2.5, 1.6, 3.2);
  scene.add(warm);

  var ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x344c3d, opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  function jit(a) { return (rnd() - 0.5) * 2 * a; }

  // One petal: a subdivided plane bent into a cupped, curled, ruffled shape with a base-to-tip color ramp.
  // bend: total angle the petal curls through along its length (positive = tip falls outward, negative = curls inward).
  function petalGeo(len, wid, cup, bend, ruffle, base, tip, ph) {
    var g = new THREE.PlaneGeometry(1, 1, 22, 34);
    var p = g.attributes.position;
    var cols = new Float32Array(p.count * 3);
    var cb_ = new THREE.Color(base), ct = new THREE.Color(tip), c = new THREE.Color();
    var B = Math.abs(bend) < 0.001 ? 0.001 : bend;
    var R = len / B;
    var C = 0.5;
    for (var i = 0; i < p.count; i++) {
      var u = p.getX(i), v = p.getY(i) + 0.5;
      // spoon outline: narrow claw at the base, widest past the middle, round cap at the tip
      var w = v < C
        ? wid * (0.22 + 0.78 * Math.sin((v / C) * Math.PI / 2))
        : wid * Math.sqrt(Math.max(0, 1 - Math.pow((v - C) / (1 - C), 2)));
      var edge = Math.abs(u) * 2;
      var x = u * w;
      // centerline bent on a circular arc
      var phi = (v * len) / R;
      var y = R * Math.sin(phi);
      var z = R * (1 - Math.cos(phi));
      // cup across the width, plus a soft ruffle at the rim near the tip
      var d = cup * edge * edge * w * 0.6;
      d += ruffle * 0.05 * len * Math.sin(u * 9 + ph) * Math.pow(v, 3.5) * edge;
      y += d * Math.sin(phi);
      z -= d * Math.cos(phi);
      p.setXYZ(i, x, y, z);
      c.copy(cb_).lerp(ct, Math.pow(v, 0.7));
      c.multiplyScalar(1 - 0.06 * edge);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }

  function petalMat(sheen) {
    return new THREE.MeshPhysicalMaterial({
      vertexColors: true, roughness: 0.5, metalness: 0,
      sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(sheen),
      side: THREE.DoubleSide
    });
  }

  var LAYERS = [
    { n: 10, len: 1.5, wid: 1.12, tilt: 0.92, cup: 0.34, curl: 0.75, ruffle: 1.0, r: 0.24, map: true },
    { n: 5, len: 1.42, wid: 1.14, tilt: 0.68, cup: 0.44, curl: 0.42, ruffle: 0.9, r: 0.2, map: true },
    { n: 9, len: 1.24, wid: 1.0, tilt: 0.46, cup: 0.54, curl: 0.12, ruffle: 0.8, r: 0.15 },
    { n: 8, len: 1.16, wid: 0.88, tilt: 0.2, cup: 0.66, curl: -0.3, ruffle: 0.6, r: 0.11 },
    { n: 7, len: 1.0, wid: 0.76, tilt: 0.02, cup: 0.76, curl: -0.65, ruffle: 0.4, r: 0.07 },
    { n: 6, len: 0.8, wid: 0.6, tilt: -0.1, cup: 0.86, curl: -1.0, ruffle: 0.2, r: 0.035 }
  ];

  function makeFlower(palette, scale, mapItems) {
    var root = new THREE.Group();
    var mapped = [];
    var shared = petalMat(palette.sheen);
    var idx = 0;
    LAYERS.forEach(function (L, li) {
      var lighten = li / (LAYERS.length - 1);
      var base = new THREE.Color(palette.base).lerp(new THREE.Color(palette.inner), lighten * 0.6);
      var tip = new THREE.Color(palette.tip).lerp(new THREE.Color(palette.inner), lighten * 0.35);
      var offset = li * 0.37;
      for (var k = 0; k < L.n; k++) {
        var pivot = new THREE.Object3D();
        pivot.rotation.y = offset + (k / L.n) * Math.PI * 2 + jit(0.12);
        var geo = petalGeo(L.len * (1 + jit(0.08)), L.wid * (1 + jit(0.08)), L.cup, L.curl + jit(0.05), L.ruffle, base, tip, rnd() * 6);
        var item = mapItems && L.map ? mapItems[idx] : null;
        var mat = item ? petalMat(palette.sheen) : shared;
        var mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = L.r;
        mesh.rotation.x = L.tilt + jit(0.07);
        mesh.rotation.z = jit(0.08);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pivot.add(mesh);
        root.add(pivot);
        if (item) {
          mesh.userData = { id: item.id, parent: pivot, pos: mesh.position.clone(), quat: mesh.quaternion.clone(), fall: null, grow: 0 };
          mapped.push(mesh);
          idx++;
        }
      }
    });
    // stamens peeking from the center
    var stamen = new THREE.MeshStandardMaterial({ color: palette.center, roughness: 0.7 });
    for (var s = 0; s < 14; s++) {
      var b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), stamen);
      var a = rnd() * Math.PI * 2, rr = rnd() * 0.12;
      b.position.set(Math.cos(a) * rr, 0.5 + rnd() * 0.12, Math.sin(a) * rr);
      root.add(b);
    }
    // sepals and leaves
    var leafBase = 0x4e6142, leafTip = 0x9db08d;
    var leafMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide, clearcoat: 0.3, clearcoatRoughness: 0.6 });
    for (var q = 0; q < 3; q++) {
      var lp = new THREE.Object3D();
      lp.rotation.y = q * 2.1 + 0.6;
      var leaf = new THREE.Mesh(petalGeo(1.7, 0.6, 0.4, 0.8, 0.2, leafBase, leafTip, q), leafMat);
      leaf.position.set(0, -0.12, 0.15);
      leaf.rotation.x = 1.2;
      leaf.castShadow = true;
      lp.add(leaf);
      root.add(lp);
    }
    root.scale.setScalar(scale);
    return { root: root, mapped: mapped };
  }

  var bouquet = new THREE.Group();
  scene.add(bouquet);

  var main = makeFlower({ base: 0x9e4e5e, tip: 0xf0c3c8, inner: 0xe39aa3, sheen: 0xffe6ea, center: 0xd9c38a }, 1, items);
  main.root.position.set(0, 1.0, 0);
  bouquet.add(main.root);

  var lav = makeFlower({ base: 0x8f7584, tip: 0xf3ecef, inner: 0xd8cbd1, sheen: 0xffffff, center: 0xcfc08e }, 0.56, null);
  lav.root.position.set(-2.05, 0.66, -1.3);
  lav.root.rotation.set(0.25, 0.4, 0.18);
  bouquet.add(lav.root);

  var sky = makeFlower({ base: 0x6f89a8, tip: 0xe9f0f7, inner: 0xc2d1e2, sheen: 0xffffff, center: 0xcfc08e }, 0.5, null);
  sky.root.position.set(2.0, 0.56, -1.1);
  sky.root.rotation.set(0.2, -0.6, -0.2);
  bouquet.add(sky.root);

  var mappedMeshes = main.mapped;
  var byId = {};
  mappedMeshes.forEach(function (m) { byId[m.userData.id] = m; });

  // --- interaction ---
  var ray = new THREE.Raycaster();
  var ndc = new THREE.Vector2();
  var hovered = null;
  var drag = null;
  var spinVel = 0;
  var tiltTarget = 0;

  function setHover(m) {
    if (hovered === m) return;
    if (hovered) hovered.material.emissive.setHex(0x000000);
    hovered = m;
    if (hovered) hovered.material.emissive.setHex(0x3a1420);
    canvas.style.cursor = hovered ? 'pointer' : (drag ? 'grabbing' : 'grab');
    if (cb.onHover) cb.onHover(hovered ? hovered.userData.id : null);
  }

  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var live = mappedMeshes.filter(function (m) { return !m.userData.fall && m.visible; });
    var hits = ray.intersectObjects(live, false);
    return hits.length ? hits[0].object : null;
  }

  function onDown(ev) {
    if (!interactive) return;
    drag = { x: ev.clientX, y: ev.clientY, moved: 0, last: ev.clientX };
    canvas.style.cursor = 'grabbing';
  }
  function onMove(ev) {
    if (!interactive) return;
    if (drag) {
      var dx = ev.clientX - drag.last;
      drag.last = ev.clientX;
      drag.moved += Math.abs(dx) + Math.abs(ev.movementY || 0);
      bouquet.rotation.y += dx * 0.009;
      spinVel = dx * 0.009 * 60;
      tiltTarget = Math.max(-0.25, Math.min(0.3, tiltTarget + (ev.movementY || 0) * 0.003));
      return;
    }
    setHover(pick(ev));
  }
  function onUp(ev) {
    if (!interactive) { drag = null; return; }
    var wasClick = drag && drag.moved < 6;
    drag = null;
    if (wasClick) {
      var m = pick(ev);
      if (m) prune(m.userData.id);
    }
    canvas.style.cursor = hovered ? 'pointer' : 'grab';
  }
  function onLeave() { drag = null; setHover(null); }

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.style.cursor = 'default';

  function prune(id) {
    var m = byId[id];
    if (!m || m.userData.fall) return;
    if (hovered === m) setHover(null);
    scene.attach(m);
    m.material.transparent = true;
    var out = new THREE.Vector3(m.position.x, 0, m.position.z).normalize();
    m.userData.fall = { t: 0, v: new THREE.Vector3(out.x * 0.9, 0.6, out.z * 0.9), spin: new THREE.Vector3(jit(2.5), jit(2.5), jit(2.5)) };
    if (cb.onPrune) cb.onPrune(id);
  }

  function regrow() {
    mappedMeshes.forEach(function (m) {
      if (!m.userData.fall) return;
      var d = m.userData;
      d.parent.add(m);
      m.position.copy(d.pos);
      m.quaternion.copy(d.quat);
      m.scale.setScalar(0.001);
      m.material.opacity = 1;
      m.material.transparent = false;
      m.visible = true;
      d.fall = null;
      d.grow = 0.001;
    });
  }

  // --- birds: tiny 3D bluebirds that cross the scene now and then ---
  function wingGeo() {
    var sh = new THREE.Shape();
    sh.moveTo(0, -0.18); sh.lineTo(0.45, -0.2); sh.lineTo(1.05, -0.02); sh.lineTo(0.95, 0.12);
    sh.lineTo(0.55, 0.24); sh.lineTo(0.15, 0.26); sh.lineTo(0, 0.2);
    var g = new THREE.ShapeGeometry(sh, 6);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  var birdBody = new THREE.MeshStandardMaterial({ color: 0x3f6fb0, roughness: 0.5, fog: false });
  var birdWing = new THREE.MeshStandardMaterial({ color: 0x6f9bd6, roughness: 0.55, side: THREE.DoubleSide, fog: false });
  var birdBelly = new THREE.MeshStandardMaterial({ color: 0xf1e6dc, roughness: 0.7, fog: false });
  var birdBeak = new THREE.MeshStandardMaterial({ color: 0x344c3d, roughness: 0.5, fog: false });
  var WG = wingGeo();
  function makeBird() {
    var b = new THREE.Group();
    var body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), birdBody);
    body.scale.set(0.52, 0.5, 1.0);
    var belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), birdBelly);
    belly.scale.set(0.46, 0.4, 0.82); belly.position.set(0, -0.08, 0.08);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), birdBody);
    head.position.set(0, 0.2, 0.5);
    var beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), birdBeak);
    beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.17, 0.85);
    var tail = new THREE.Mesh(WG, birdWing);
    tail.scale.set(0.5, 1, 0.9); tail.rotation.y = Math.PI / 2 + Math.PI; tail.position.set(0, 0.02, -0.45);
    var lw = new THREE.Object3D(); lw.position.set(0.18, 0.12, 0.05);
    var lm = new THREE.Mesh(WG, birdWing); lw.add(lm);
    var rw = new THREE.Object3D(); rw.position.set(-0.18, 0.12, 0.05); rw.scale.x = -1;
    var rm = new THREE.Mesh(WG, birdWing); rw.add(rm);
    [body, head, lm, rm].forEach(function (m) { m.castShadow = true; });
    b.add(body, belly, head, beak, tail, lw, rw);
    b.scale.setScalar(0.24);
    b.visible = false;
    b.userData = { lw: lw, rw: rw, fly: null };
    scene.add(b);
    return b;
  }
  var birds = [];
  for (var bi = 0; bi < 6; bi++) birds.push(makeBird());
  var nextFlock = 1.2;
  var lookAhead = new V();
  function spawnFlock() {
    var idle = birds.filter(function (b) { return !b.userData.fly; });
    if (!idle.length) return;
    var dir = rnd() < 0.5 ? 1 : -1;
    var n = Math.min(idle.length, 1 + Math.floor(rnd() * 3));
    var y = 1.9 + rnd() * 1.9, z = -2.6 + rnd() * 4.2, dur = 6.5 + rnd() * 3;
    for (var i = 0; i < n; i++) {
      idle[i].userData.fly = { t: -i * (0.35 + rnd() * 0.3), dur: dur, dir: dir, y: y + jit(0.35), z: z + jit(0.7), amp: 0.2 + rnd() * 0.35, ph: rnd() * 6, flap: 15 + rnd() * 6 };
    }
  }
  function birdPos(f, u, out) {
    return out.set(f.dir * (-9.5 + 19 * u), f.y + Math.sin(u * Math.PI * 2 + f.ph) * f.amp, f.z + Math.sin(u * Math.PI * 3 + f.ph) * 0.5);
  }
  function stepBirds(dt, time) {
    if (reduce) return;
    nextFlock -= dt;
    if (nextFlock <= 0) { spawnFlock(); nextFlock = 5 + rnd() * 7; }
    birds.forEach(function (b) {
      var f = b.userData.fly;
      if (!f) return;
      f.t += dt;
      if (f.t < 0) { b.visible = false; return; }
      var u = f.t / f.dur;
      if (u >= 1) { b.userData.fly = null; b.visible = false; return; }
      b.visible = true;
      birdPos(f, u, b.position);
      b.lookAt(birdPos(f, Math.min(1, u + 0.01), lookAhead));
      var gliding = Math.sin(time * 1.4 + f.ph) < -0.45;
      var a = gliding ? 0.25 : Math.sin(time * f.flap + f.ph) * 0.95;
      b.userData.lw.rotation.z = a;
      b.userData.rw.rotation.z = a;
    });
  }

  function setProgress(p) {
    prog.target = Math.max(0, Math.min(1, p));
    var on = prog.target > 0.88;
    if (on !== interactive) {
      interactive = on;
      if (!on) { drag = null; setHover(null); }
      canvas.style.cursor = on ? 'grab' : 'default';
    }
  }
  function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  // --- size ---
  function resize() {
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = w / h > 1.15;
    camera.fov = w / h < 0.9 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  var ro = window.ResizeObserver ? new ResizeObserver(resize) : null;
  if (ro) ro.observe(canvas); else window.addEventListener('resize', resize);
  resize();

  // --- loop ---
  var clock = new THREE.Clock();
  var raf = 0;
  var t = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    t += dt;
    if (!drag) {
      spinVel *= Math.pow(0.04, dt);
      var auto = reduce || hovered ? 0 : 0.16;
      bouquet.rotation.y += (auto + spinVel) * dt;
    }
    bouquet.rotation.x += (tiltTarget - bouquet.rotation.x) * Math.min(1, dt * 4);
    prog.cur += (prog.target - prog.cur) * Math.min(1, dt * 5);
    var e = ease(prog.cur);
    camera.position.lerpVectors(CAM0, CAM1, e);
    camera.lookAt(tmpA.lerpVectors(LOOK0, LOOK1, e));
    bouquet.position.x = (wide ? 2.9 : 0) * (1 - e);
    bouquet.position.y = (wide ? 0 : -0.6) * (1 - e);
    scene.fog.near = 7 + 9 * e;
    scene.fog.far = 20 + 30 * e;
    stepBirds(dt, t);
    if (!reduce) {
      main.root.position.y = 1.0 + Math.sin(t * 1.1) * 0.045;
      lav.root.position.y = 0.66 + Math.sin(t * 1.3 + 1) * 0.035;
      sky.root.position.y = 0.56 + Math.sin(t * 0.9 + 2) * 0.035;
    }
    mappedMeshes.forEach(function (m) {
      var d = m.userData;
      if (d.fall) {
        var f = d.fall;
        f.t += dt;
        f.v.y -= 2.4 * dt;
        f.v.multiplyScalar(Math.pow(0.55, dt));
        m.position.addScaledVector(f.v, dt);
        if (m.position.y < 0.02) { m.position.y = 0.02; f.v.y = 0; f.spin.multiplyScalar(0.9); }
        m.rotation.x += f.spin.x * dt; m.rotation.y += f.spin.y * dt; m.rotation.z += f.spin.z * dt;
        m.material.opacity = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 1.1);
        if (f.t > 2.1) m.visible = false;
      } else if (d.grow) {
        d.grow = Math.min(1, d.grow + dt * 1.8);
        var e = 1 - Math.pow(1 - d.grow, 3);
        m.scale.setScalar(Math.max(0.001, e));
        if (d.grow >= 1) d.grow = 0;
      }
    });
    renderer.render(scene, camera);
  }
  frame();

  return {
    prune: prune,
    regrow: regrow,
    setProgress: setProgress,
    spawnFlock: spawnFlock,
    dispose: function () {
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect(); else window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      scene.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose();
    }
  };
}
