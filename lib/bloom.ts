import * as THREE from "three";

// TypeScript port of design/bouquet-engine.js (three.js bouquet and bluebirds for the landing hero).
// Changes from the mockup: `three` comes from npm, reduced motion is passed in, and pause()/resume()
// let the caller stop rendering while the canvas is off screen.

export interface BloomItem {
  id: string;
}

export interface BloomCallbacks {
  onHover?: (id: string | null) => void;
  onPrune?: (id: string) => void;
}

export interface Bloom {
  prune(id: string): void;
  regrow(): void;
  setProgress(p: number): void;
  spawnFlock(): void;
  pause(): void;
  resume(): void;
  dispose(): void;
}

interface PetalData {
  id: string;
  parent: THREE.Object3D;
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  fall: { t: number; v: THREE.Vector3; spin: THREE.Vector3 } | null;
  grow: number;
}

interface Flight {
  t: number;
  dur: number;
  dir: number;
  y: number;
  z: number;
  amp: number;
  ph: number;
  flap: number;
}

type PetalMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> & { userData: PetalData };

export function createBloom(
  canvas: HTMLCanvasElement,
  items: BloomItem[],
  cb: BloomCallbacks,
  opts: { reduceMotion: boolean }
): Bloom | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch {
    return null;
  }
  const reduce = opts.reduceMotion;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(0xe9e1e5, 7, 20);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  // Scroll progress 0 = small and hazy behind the headline, 1 = close up and interactive.
  const prog = { target: 0, cur: 0 };
  let interactive = false;
  let wide = true;
  const V = THREE.Vector3;
  const CAM0 = new V(0, 4.2, 13.5);
  const CAM1 = new V(0, 3.0, 7.6);
  const LOOK0 = new V(0, 1.6, 0);
  const LOOK1 = new V(0, 0.85, 0);
  const tmpA = new V();

  scene.add(new THREE.HemisphereLight(0xfbf6f8, 0x6f8466, 1.25));
  const key = new THREE.DirectionalLight(0xfff1e6, 2.6);
  key.position.set(3.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xc9d8ea, 2.0);
  rim.position.set(-4, 3.5, -5);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffd6dc, 9, 14, 2);
  warm.position.set(-2.5, 1.6, 3.2);
  scene.add(warm);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: 0x344c3d, opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const jit = (a: number) => (rnd() - 0.5) * 2 * a;

  // One petal: a subdivided plane bent into a cupped, curled, ruffled shape with a base-to-tip color ramp.
  // bend: total angle the petal curls through along its length (positive = tip falls outward, negative = curls inward).
  function petalGeo(len: number, wid: number, cup: number, bend: number, ruffle: number, base: THREE.ColorRepresentation, tip: THREE.ColorRepresentation, ph: number) {
    const g = new THREE.PlaneGeometry(1, 1, 22, 34);
    const p = g.attributes.position;
    const cols = new Float32Array(p.count * 3);
    const cb_ = new THREE.Color(base);
    const ct = new THREE.Color(tip);
    const c = new THREE.Color();
    const B = Math.abs(bend) < 0.001 ? 0.001 : bend;
    const R = len / B;
    const C = 0.5;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i);
      const v = p.getY(i) + 0.5;
      // spoon outline: narrow claw at the base, widest past the middle, round cap at the tip
      const w = v < C ? wid * (0.22 + 0.78 * Math.sin(((v / C) * Math.PI) / 2)) : wid * Math.sqrt(Math.max(0, 1 - Math.pow((v - C) / (1 - C), 2)));
      const edge = Math.abs(u) * 2;
      const x = u * w;
      // centerline bent on a circular arc
      const phi = (v * len) / R;
      let y = R * Math.sin(phi);
      let z = R * (1 - Math.cos(phi));
      // cup across the width, plus a soft ruffle at the rim near the tip
      let d = cup * edge * edge * w * 0.6;
      d += ruffle * 0.05 * len * Math.sin(u * 9 + ph) * Math.pow(v, 3.5) * edge;
      y += d * Math.sin(phi);
      z -= d * Math.cos(phi);
      p.setXYZ(i, x, y, z);
      c.copy(cb_).lerp(ct, Math.pow(v, 0.7));
      c.multiplyScalar(1 - 0.06 * edge);
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    return g;
  }

  function petalMat(sheen: THREE.ColorRepresentation) {
    return new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.5,
      metalness: 0,
      sheen: 1,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color(sheen),
      side: THREE.DoubleSide,
    });
  }

  const LAYERS = [
    { n: 10, len: 1.5, wid: 1.12, tilt: 0.92, cup: 0.34, curl: 0.75, ruffle: 1.0, r: 0.24, map: true },
    { n: 5, len: 1.42, wid: 1.14, tilt: 0.68, cup: 0.44, curl: 0.42, ruffle: 0.9, r: 0.2, map: true },
    { n: 9, len: 1.24, wid: 1.0, tilt: 0.46, cup: 0.54, curl: 0.12, ruffle: 0.8, r: 0.15, map: false },
    { n: 8, len: 1.16, wid: 0.88, tilt: 0.2, cup: 0.66, curl: -0.3, ruffle: 0.6, r: 0.11, map: false },
    { n: 7, len: 1.0, wid: 0.76, tilt: 0.02, cup: 0.76, curl: -0.65, ruffle: 0.4, r: 0.07, map: false },
    { n: 6, len: 0.8, wid: 0.6, tilt: -0.1, cup: 0.86, curl: -1.0, ruffle: 0.2, r: 0.035, map: false },
  ];

  interface Palette {
    base: number;
    tip: number;
    inner: number;
    sheen: number;
    center: number;
  }

  function makeFlower(palette: Palette, scale: number, mapItems: BloomItem[] | null) {
    const root = new THREE.Group();
    const mapped: PetalMesh[] = [];
    const shared = petalMat(palette.sheen);
    let idx = 0;
    LAYERS.forEach((L, li) => {
      const lighten = li / (LAYERS.length - 1);
      const base = new THREE.Color(palette.base).lerp(new THREE.Color(palette.inner), lighten * 0.6);
      const tip = new THREE.Color(palette.tip).lerp(new THREE.Color(palette.inner), lighten * 0.35);
      const offset = li * 0.37;
      for (let k = 0; k < L.n; k++) {
        const pivot = new THREE.Object3D();
        pivot.rotation.y = offset + (k / L.n) * Math.PI * 2 + jit(0.12);
        const geo = petalGeo(L.len * (1 + jit(0.08)), L.wid * (1 + jit(0.08)), L.cup, L.curl + jit(0.05), L.ruffle, base, tip, rnd() * 6);
        const item = mapItems && L.map ? mapItems[idx] : null;
        // Mapped petals get their own material so hover can tint just that petal.
        const mat = item ? petalMat(palette.sheen) : shared;
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.z = L.r;
        mesh.rotation.x = L.tilt + jit(0.07);
        mesh.rotation.z = jit(0.08);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        pivot.add(mesh);
        root.add(pivot);
        if (item) {
          mesh.userData = { id: item.id, parent: pivot, pos: mesh.position.clone(), quat: mesh.quaternion.clone(), fall: null, grow: 0 } satisfies PetalData;
          mapped.push(mesh as unknown as PetalMesh);
          idx++;
        }
      }
    });
    // stamens peeking from the center
    const stamen = new THREE.MeshStandardMaterial({ color: palette.center, roughness: 0.7 });
    for (let s = 0; s < 14; s++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), stamen);
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * 0.12;
      b.position.set(Math.cos(a) * rr, 0.5 + rnd() * 0.12, Math.sin(a) * rr);
      root.add(b);
    }
    // sepals and leaves
    const leafMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide, clearcoat: 0.3, clearcoatRoughness: 0.6 });
    for (let q = 0; q < 3; q++) {
      const lp = new THREE.Object3D();
      lp.rotation.y = q * 2.1 + 0.6;
      const leaf = new THREE.Mesh(petalGeo(1.7, 0.6, 0.4, 0.8, 0.2, 0x4e6142, 0x9db08d, q), leafMat);
      leaf.position.set(0, -0.12, 0.15);
      leaf.rotation.x = 1.2;
      leaf.castShadow = true;
      lp.add(leaf);
      root.add(lp);
    }
    root.scale.setScalar(scale);
    return { root, mapped };
  }

  const bouquet = new THREE.Group();
  scene.add(bouquet);

  const main = makeFlower({ base: 0x9e4e5e, tip: 0xf0c3c8, inner: 0xe39aa3, sheen: 0xffe6ea, center: 0xd9c38a }, 1, items);
  main.root.position.set(0, 1.0, 0);
  bouquet.add(main.root);

  const lav = makeFlower({ base: 0x8f7584, tip: 0xf3ecef, inner: 0xd8cbd1, sheen: 0xffffff, center: 0xcfc08e }, 0.56, null);
  lav.root.position.set(-2.05, 0.66, -1.3);
  lav.root.rotation.set(0.25, 0.4, 0.18);
  bouquet.add(lav.root);

  const sky = makeFlower({ base: 0x6f89a8, tip: 0xe9f0f7, inner: 0xc2d1e2, sheen: 0xffffff, center: 0xcfc08e }, 0.5, null);
  sky.root.position.set(2.0, 0.56, -1.1);
  sky.root.rotation.set(0.2, -0.6, -0.2);
  bouquet.add(sky.root);

  const mappedMeshes = main.mapped;
  const byId = new Map(mappedMeshes.map((m) => [m.userData.id, m]));

  // --- interaction ---
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered: PetalMesh | null = null;
  let drag: { moved: number; last: number } | null = null;
  let spinVel = 0;
  let tiltTarget = 0;

  function setHover(m: PetalMesh | null) {
    if (hovered === m) return;
    if (hovered) hovered.material.emissive.setHex(0x000000);
    hovered = m;
    if (hovered) hovered.material.emissive.setHex(0x3a1420);
    canvas.style.cursor = hovered ? "pointer" : drag ? "grabbing" : interactive ? "grab" : "default";
    cb.onHover?.(hovered ? hovered.userData.id : null);
  }

  function pick(ev: PointerEvent): PetalMesh | null {
    const r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const live = mappedMeshes.filter((m) => !m.userData.fall && m.visible);
    const hits = ray.intersectObjects(live, false);
    return hits.length ? (hits[0].object as PetalMesh) : null;
  }

  function onDown(ev: PointerEvent) {
    if (!interactive) return;
    drag = { moved: 0, last: ev.clientX };
    canvas.style.cursor = "grabbing";
  }
  function onMove(ev: PointerEvent) {
    if (!interactive) return;
    if (drag) {
      const dx = ev.clientX - drag.last;
      drag.last = ev.clientX;
      drag.moved += Math.abs(dx) + Math.abs(ev.movementY || 0);
      bouquet.rotation.y += dx * 0.009;
      spinVel = dx * 0.009 * 60;
      tiltTarget = Math.max(-0.25, Math.min(0.3, tiltTarget + (ev.movementY || 0) * 0.003));
      return;
    }
    setHover(pick(ev));
  }
  function onUp(ev: PointerEvent) {
    if (!interactive) {
      drag = null;
      return;
    }
    const wasClick = drag && drag.moved < 6;
    drag = null;
    if (wasClick) {
      const m = pick(ev);
      if (m) prune(m.userData.id);
    }
    canvas.style.cursor = hovered ? "pointer" : "grab";
  }
  function onLeave() {
    drag = null;
    setHover(null);
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.style.cursor = "default";

  function prune(id: string) {
    const m = byId.get(id);
    if (!m || m.userData.fall) return;
    if (hovered === m) setHover(null);
    scene.attach(m);
    m.material.transparent = true;
    const out = new THREE.Vector3(m.position.x, 0, m.position.z).normalize();
    m.userData.fall = { t: 0, v: new THREE.Vector3(out.x * 0.9, 0.6, out.z * 0.9), spin: new THREE.Vector3(jit(2.5), jit(2.5), jit(2.5)) };
    cb.onPrune?.(id);
  }

  function regrow() {
    for (const m of mappedMeshes) {
      if (!m.userData.fall) continue;
      const d = m.userData;
      d.parent.add(m);
      m.position.copy(d.pos);
      m.quaternion.copy(d.quat);
      m.scale.setScalar(0.001);
      m.material.opacity = 1;
      m.material.transparent = false;
      m.visible = true;
      d.fall = null;
      d.grow = 0.001;
    }
  }

  // --- birds: tiny 3D bluebirds that cross the scene now and then ---
  function wingGeo() {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.18);
    sh.lineTo(0.45, -0.2);
    sh.lineTo(1.05, -0.02);
    sh.lineTo(0.95, 0.12);
    sh.lineTo(0.55, 0.24);
    sh.lineTo(0.15, 0.26);
    sh.lineTo(0, 0.2);
    const g = new THREE.ShapeGeometry(sh, 6);
    g.rotateX(-Math.PI / 2);
    return g;
  }
  const birdBody = new THREE.MeshStandardMaterial({ color: 0x3f6fb0, roughness: 0.5, fog: false });
  const birdWing = new THREE.MeshStandardMaterial({ color: 0x6f9bd6, roughness: 0.55, side: THREE.DoubleSide, fog: false });
  const birdBelly = new THREE.MeshStandardMaterial({ color: 0xf1e6dc, roughness: 0.7, fog: false });
  const birdBeak = new THREE.MeshStandardMaterial({ color: 0x344c3d, roughness: 0.5, fog: false });
  const WG = wingGeo();

  interface Bird extends THREE.Group {
    userData: { lw: THREE.Object3D; rw: THREE.Object3D; fly: Flight | null };
  }

  function makeBird(): Bird {
    const b = new THREE.Group() as Bird;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), birdBody);
    body.scale.set(0.52, 0.5, 1.0);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), birdBelly);
    belly.scale.set(0.46, 0.4, 0.82);
    belly.position.set(0, -0.08, 0.08);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), birdBody);
    head.position.set(0, 0.2, 0.5);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 8), birdBeak);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.17, 0.85);
    const tail = new THREE.Mesh(WG, birdWing);
    tail.scale.set(0.5, 1, 0.9);
    tail.rotation.y = Math.PI / 2 + Math.PI;
    tail.position.set(0, 0.02, -0.45);
    const lw = new THREE.Object3D();
    lw.position.set(0.18, 0.12, 0.05);
    const lm = new THREE.Mesh(WG, birdWing);
    lw.add(lm);
    const rw = new THREE.Object3D();
    rw.position.set(-0.18, 0.12, 0.05);
    rw.scale.x = -1;
    const rm = new THREE.Mesh(WG, birdWing);
    rw.add(rm);
    [body, head, lm, rm].forEach((m) => (m.castShadow = true));
    b.add(body, belly, head, beak, tail, lw, rw);
    b.scale.setScalar(0.24);
    b.visible = false;
    b.userData = { lw, rw, fly: null };
    scene.add(b);
    return b;
  }
  // No birds at all for reduced-motion users.
  const birds: Bird[] = reduce ? [] : Array.from({ length: 6 }, makeBird);
  let nextFlock = 1.2;
  const lookAhead = new V();

  function spawnFlock() {
    const idle = birds.filter((b) => !b.userData.fly);
    if (!idle.length) return;
    const dir = rnd() < 0.5 ? 1 : -1;
    const n = Math.min(idle.length, 1 + Math.floor(rnd() * 3));
    const y = 1.9 + rnd() * 1.9;
    const z = -2.6 + rnd() * 4.2;
    const dur = 6.5 + rnd() * 3;
    for (let i = 0; i < n; i++) {
      idle[i].userData.fly = { t: -i * (0.35 + rnd() * 0.3), dur, dir, y: y + jit(0.35), z: z + jit(0.7), amp: 0.2 + rnd() * 0.35, ph: rnd() * 6, flap: 15 + rnd() * 6 };
    }
  }
  function birdPos(f: Flight, u: number, out: THREE.Vector3) {
    return out.set(f.dir * (-9.5 + 19 * u), f.y + Math.sin(u * Math.PI * 2 + f.ph) * f.amp, f.z + Math.sin(u * Math.PI * 3 + f.ph) * 0.5);
  }
  function stepBirds(dt: number, time: number) {
    if (reduce) return;
    nextFlock -= dt;
    if (nextFlock <= 0) {
      spawnFlock();
      // A new flock every 5 to 12 seconds.
      nextFlock = 5 + rnd() * 7;
    }
    for (const b of birds) {
      const f = b.userData.fly;
      if (!f) continue;
      f.t += dt;
      if (f.t < 0) {
        b.visible = false;
        continue;
      }
      const u = f.t / f.dur;
      if (u >= 1) {
        b.userData.fly = null;
        b.visible = false;
        continue;
      }
      b.visible = true;
      birdPos(f, u, b.position);
      b.lookAt(birdPos(f, Math.min(1, u + 0.01), lookAhead));
      const gliding = Math.sin(time * 1.4 + f.ph) < -0.45;
      const a = gliding ? 0.25 : Math.sin(time * f.flap + f.ph) * 0.95;
      b.userData.lw.rotation.z = a;
      b.userData.rw.rotation.z = a;
    }
  }

  function setProgress(p: number) {
    prog.target = Math.max(0, Math.min(1, p));
    const on = prog.target > 0.88;
    if (on !== interactive) {
      interactive = on;
      if (!on) {
        drag = null;
        setHover(null);
      }
      canvas.style.cursor = on ? "grab" : "default";
    }
  }
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  // --- size ---
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    wide = w / h > 1.15;
    camera.fov = w / h < 0.9 ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  // --- loop ---
  const timer = new THREE.Clock();
  let raf = 0;
  let running = false;
  let t = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, timer.getDelta());
    t += dt;
    if (!drag) {
      spinVel *= Math.pow(0.04, dt);
      const auto = reduce || hovered ? 0 : 0.16;
      bouquet.rotation.y += (auto + spinVel) * dt;
    }
    bouquet.rotation.x += (tiltTarget - bouquet.rotation.x) * Math.min(1, dt * 4);
    // Reduced motion: jump to the scroll position instead of easing toward it.
    prog.cur = reduce ? prog.target : prog.cur + (prog.target - prog.cur) * Math.min(1, dt * 5);
    const e = ease(prog.cur);
    camera.position.lerpVectors(CAM0, CAM1, e);
    camera.lookAt(tmpA.lerpVectors(LOOK0, LOOK1, e));
    bouquet.position.x = (wide ? 2.9 : 0) * (1 - e);
    bouquet.position.y = (wide ? 0 : -0.6) * (1 - e);
    fog.near = 7 + 9 * e;
    fog.far = 20 + 30 * e;
    stepBirds(dt, t);
    if (!reduce) {
      main.root.position.y = 1.0 + Math.sin(t * 1.1) * 0.045;
      lav.root.position.y = 0.66 + Math.sin(t * 1.3 + 1) * 0.035;
      sky.root.position.y = 0.56 + Math.sin(t * 0.9 + 2) * 0.035;
    }
    for (const m of mappedMeshes) {
      const d = m.userData;
      if (d.fall) {
        const f = d.fall;
        f.t += dt;
        f.v.y -= 2.4 * dt;
        f.v.multiplyScalar(Math.pow(0.55, dt));
        m.position.addScaledVector(f.v, dt);
        if (m.position.y < 0.02) {
          m.position.y = 0.02;
          f.v.y = 0;
          f.spin.multiplyScalar(0.9);
        }
        m.rotation.x += f.spin.x * dt;
        m.rotation.y += f.spin.y * dt;
        m.rotation.z += f.spin.z * dt;
        m.material.opacity = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 1.1);
        if (f.t > 2.1) m.visible = false;
      } else if (d.grow) {
        d.grow = Math.min(1, d.grow + dt * 1.8);
        const g = 1 - Math.pow(1 - d.grow, 3);
        m.scale.setScalar(Math.max(0.001, g));
        if (d.grow >= 1) d.grow = 0;
      }
    }
    renderer.render(scene, camera);
  }

  function resume() {
    if (running) return;
    running = true;
    timer.getDelta(); // drop the time spent paused
    frame();
  }
  function pause() {
    running = false;
    cancelAnimationFrame(raf);
  }
  resume();

  return {
    prune,
    regrow,
    setProgress,
    spawnFlock,
    pause,
    resume,
    dispose() {
      pause();
      ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      WG.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
