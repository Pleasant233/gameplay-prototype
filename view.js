// 3D 卡通视口（部落冲突 / 皇室战争质感）：只负责画面与拾取，不改规则
(function (root) {
  const T = 1.12;
  const ELC = { metal: 0xffc928, wood: 0x5ad13a, water: 0x38a8ff, fire: 0xff5a2a, earth: 0xd0904a };
  // h 高度，top 顶面色，side 侧壁色（泥土），kind 决定装饰
  const LOOK = {
    ruin:          { h: 0.22, top: 0xcdb78f, side: 0x8a6a48, kind: 'ruin' },
    pollute_water: { h: 0.14, top: 0x8a8a62, side: 0x5a4a3a, kind: 'water', dirty: 1 },
    pollute_earth: { h: 0.20, top: 0x9fa040, side: 0x6a5a30, kind: 'land', dirty: 1 },
    pollute_rock:  { h: 0.48, top: 0x84749a, side: 0x4e425e, kind: 'rock', dirty: 1 },
    barren:        { h: 0.18, top: 0xdcba78, side: 0x9a6a3a, kind: 'land' },
    rock:          { h: 0.32, top: 0xb4aea4, side: 0x7a6e60, kind: 'rock' },
    sand:          { h: 0.16, top: 0xf7dc8c, side: 0xc89a50, kind: 'sand' },
    bare:          { h: 0.56, top: 0xbea482, side: 0x7a5e40, kind: 'peak' },
    grass:         { h: 0.20, top: 0x7fd442, side: 0x9a6436, kind: 'land', flowers: 1 },
    water:         { h: 0.14, top: 0xf2da9a, side: 0xb08a50, kind: 'water' },
    lava:          { h: 0.46, top: 0x5e4a4a, side: 0x3a2a2a, kind: 'lava' },
    waste:         { h: 0.18, top: 0xcab262, side: 0x8a6a3a, kind: 'land', dry: 1 },
    peak:          { h: 0.80, top: 0xc8ccd6, side: 0x8a8e98, kind: 'peak', snow: 1 },
    forest:        { h: 0.24, top: 0x5fbc3a, side: 0x8a5a30, kind: 'forest' },
    wet:           { h: 0.16, top: 0x62b45e, side: 0x6a5a3a, kind: 'water', wet: 1 },
    mine:          { h: 0.36, top: 0xae8e64, side: 0x6a5034, kind: 'mine' },
    valley:        { h: 0.20, top: 0x6fcc52, side: 0x8a6034, kind: 'land', creek: 1 },
    rain:          { h: 0.26, top: 0x3fa844, side: 0x7a5028, kind: 'forest', dense: 1 },
    fertile:       { h: 0.20, top: 0x8ccc3a, side: 0x7a4e28, kind: 'land', flowers: 1 },
    creek:         { h: 0.20, top: 0x8ade62, side: 0x8a6034, kind: 'land', creek: 1 },
  };
  const ORE_C = { gold: 0xffcc22, silver: 0xdfe8f2, copper: 0xe08a4a, iron: 0x8a96a6 };

  let scene, camera, renderer, clock, sun;
  let G, D, EL;
  let cb = {};
  let tileMap = {};
  let pads = {};
  let pickables, fxGroup, ghost;
  let hoverK = null, selectedK = null, modeRef = null, stateRef = null;
  let cam, keys = {};
  let particles = [], rings = [], beams = [], sways = [], waters = [], lavas = [], bobs = [];
  let pGeo, pPos, pCol, pObj;
  let intro = 1, lastRound = 1, shake = 0;
  const pointer = { x: 0, y: 0, down: null, ndc: new THREE.Vector2() };
  const ray = new THREE.Raycaster();
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();

  const geo = {};
  const mats = {};
  const matCache = {};
  const slabCache = {};

  function wp(k, y) {
    const [x, z] = G.parse(k);
    return new THREE.Vector3((x - 3) * T, y || 0, (z - 3) * T);
  }
  function hashk(k) {
    let h = 2166136261;
    for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  // 共享材质（按参数缓存，不随地块销毁）
  function M(color, extra) {
    const key = color + (extra ? JSON.stringify(extra) : '');
    if (!matCache[key]) matCache[key] = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, extra || {}));
    return matCache[key];
  }
  // 地块独占材质（颜色随属性变化），移除时销毁
  function ownMat(color, extra) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.8, metalness: 0 }, extra || {}));
    m.userData.own = true;
    return m;
  }
  function colTint(base, attrs) {
    const c = new THREE.Color(base);
    if (attrs && attrs.some(v => v < 0)) c.lerp(new THREE.Color(0x5a4a40), 0.3);
    let max = 0, i = 0;
    (attrs || []).forEach((v, idx) => { if (v > max) { max = v; i = idx; } });
    if (max > 0) c.lerp(new THREE.Color(ELC[EL[i].key]), 0.08 * Math.min(max, 4) / 4);
    return c;
  }

  // 圆角厚板：卡通地块的“饼干”造型，顶面 / 侧壁两种材质
  // 地块方块：侧壁向下延伸到 -0.25 埋入地面，顶面材质索引 0 其余索引 1
  function tileSlab(w, h) {
    var key = 'ts|' + w + '|' + h;
    if (slabCache[key]) return slabCache[key];
    var depth = h + 0.28;
    var g = new THREE.BoxGeometry(w, depth, w);
    g.translate(0, h - depth / 2, 0);
    var grp = g.groups;
    for (var i = 0; i < grp.length; i++) grp[i].materialIndex = (i === 2) ? 0 : 1;
    slabCache[key] = g;
    return g;
  }
  function padSlab(w, h) {
    var key = 'ps|' + w + '|' + h;
    if (slabCache[key]) return slabCache[key];
    var g = new THREE.BoxGeometry(w, h, w);
    g.translate(0, h / 2 - 0.01, 0);
    var grp = g.groups;
    for (var i = 0; i < grp.length; i++) grp[i].materialIndex = (i === 2) ? 0 : 1;
    slabCache[key] = g;
    return g;
  }

  function initGeos() {
    geo.box = new THREE.BoxGeometry(1, 1, 1);
    geo.sph = new THREE.SphereGeometry(0.5, 16, 12);
    geo.sphL = new THREE.SphereGeometry(0.5, 8, 6);
    geo.cone = new THREE.ConeGeometry(0.5, 1, 10);
    geo.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
    geo.coneL = new THREE.ConeGeometry(0.5, 1, 6);
    geo.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    geo.trunk = new THREE.CylinderGeometry(0.35, 0.5, 1, 8);
    geo.cylT = new THREE.CylinderGeometry(0.1, 0.26, 1, 16, 1, true);
    geo.octa = new THREE.OctahedronGeometry(0.5);
    geo.ico = new THREE.IcosahedronGeometry(0.5, 0);
    geo.dode = new THREE.DodecahedronGeometry(0.5, 0);
    geo.plane = new THREE.PlaneGeometry(1, 1);
    geo.circle = new THREE.CircleGeometry(0.5, 24);
    geo.ring = new THREE.RingGeometry(0.5, 0.6, 48);
    geo.torus = new THREE.TorusGeometry(0.5, 0.12, 8, 24);
    geo.halo = new THREE.TorusGeometry(0.5, 0.06, 6, 24);
    geo.pad = padSlab(0.92, 0.06);
    geo.hill = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.disk = new THREE.CircleGeometry(160, 48);
    mats.ground = new THREE.MeshStandardMaterial({ color: 0x5cb03c, roughness: 1 });
    mats.pad = new THREE.MeshStandardMaterial({ color: 0x86c45a, roughness: 0.9 });
    mats.padSide = new THREE.MeshStandardMaterial({ color: 0x5a9a3a, roughness: 0.9 });
    mats.padLegal = new THREE.MeshStandardMaterial({ color: 0xb8f070, roughness: 0.6, emissive: 0x5ab020, emissiveIntensity: 0.45 });
    mats.hill = new THREE.MeshStandardMaterial({ color: 0x5cb440, roughness: 1, flatShading: true });
    mats.hill2 = new THREE.MeshStandardMaterial({ color: 0x4ea838, roughness: 1, flatShading: true });
    mats.ghost = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.5, emissive: 0x88ff66, emissiveIntensity: 0.4 });
    mats.sel = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    mats.tgt = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    mats.water = new THREE.MeshStandardMaterial({ color: 0x2fb0ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x0a4a8a, emissiveIntensity: 0.25 });
    mats.dirtyW = new THREE.MeshStandardMaterial({ color: 0x6a8a3a, roughness: 0.3, transparent: true, opacity: 0.92 });
    mats.lava = new THREE.MeshStandardMaterial({ color: 0xff6a10, roughness: 0.4, emissive: 0xff4a00, emissiveIntensity: 1.2 });
    mats.shadow = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false });
  }

  function makeSky() {
    const g = new THREE.SphereGeometry(200, 32, 20);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, fog: false, depthWrite: false,
      vertexShader: 'varying vec3 v; void main(){ v=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'varying vec3 v;',
        'void main(){',
        '  float h = v.y;',
        '  vec3 top = vec3(0.20, 0.55, 0.98);',
        '  vec3 hor = vec3(0.72, 0.90, 1.00);',
        '  vec3 c = mix(hor, top, smoothstep(0.0, 0.6, h));',
        '  gl_FragColor = vec4(c, 1.0);',
        '}',
      ].join('\n'),
    });
    return new THREE.Mesh(g, m);
  }

  // 周边：草地、圆润小山、环岛树林、白云
  function addHorizon() {
    const ground = new THREE.Mesh(geo.disk, mats.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.22;
    ground.receiveShadow = true;
    scene.add(ground);
    const rnd = hashk('horizon');
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2 + rnd() * 0.2;
      const r = 34 + rnd() * 24;
      const s = 3 + rnd() * 5;
      const m = new THREE.Mesh(geo.hill, i % 2 ? mats.hill : mats.hill2);
      m.scale.set(s * 1.4, s * (0.3 + rnd() * 0.25), s);
      m.position.set(Math.cos(a) * r, -0.05, Math.sin(a) * r);
      m.rotation.y = rnd() * 3;
      scene.add(m);
    }
    // 环岛树林
    const deco = new THREE.Group();
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 10.5 + rnd() * 13;
      addTree(deco, Math.cos(a) * r, 0, Math.sin(a) * r, 1.2 + rnd() * 1.4, rnd() > 0.55, rnd, true);
    }
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = 9.5 + rnd() * 10;
      addRock(deco, Math.cos(a) * r, 0, Math.sin(a) * r, 0.3 + rnd() * 0.5, rnd);
    }
    scene.add(deco);
    // 云
    const cloudM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false });
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(rnd() * 3);
      for (let j = 0; j < n; j++) {
        const p = new THREE.Mesh(geo.sphL, cloudM);
        p.scale.setScalar(2.2 + rnd() * 2);
        p.position.set(j * 1.8 - n, rnd() * 0.8, rnd() * 1.2);
        c.add(p);
      }
      const a = rnd() * Math.PI * 2, r = 40 + rnd() * 30;
      c.position.set(Math.cos(a) * r, 16 + rnd() * 10, Math.sin(a) * r);
      c.userData.drift = 0.3 + rnd() * 0.4;
      scene.add(c);
      bobs.push({ m: c, y: c.position.y, p: rnd() * 6, a: 0.6, cloud: c.userData.drift });
    }
  }

  function addPad(k) {
    const m = new THREE.Mesh(geo.pad, [mats.pad, mats.padSide]);
    const p = wp(k);
    m.position.set(p.x, 0, p.z);
    m.receiveShadow = true;
    m.userData.k = k;
    m.userData.pad = true;
    pickables.add(m);
    pads[k] = m;
  }

  // ---------- 装饰模型 ----------
  function addTree(parent, x, y, z, scale, pine, rnd, still) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rnd() * 6;
    const trunk = new THREE.Mesh(geo.trunk, M(0x8a5a2e));
    trunk.scale.set(0.09 * scale, 0.26 * scale, 0.09 * scale);
    trunk.position.y = 0.13 * scale;
    trunk.castShadow = true;
    g.add(trunk);
    const top = new THREE.Group();
    top.position.y = 0.22 * scale;
    if (pine) {
      [[0.36, 0.30, 0.04], [0.28, 0.26, 0.20], [0.18, 0.22, 0.34]].forEach(([w, h, yy], i) => {
        const c = new THREE.Mesh(geo.coneL, M(i % 2 ? 0x2f9a4a : 0x268a40, { flatShading: true }));
        c.scale.set(w * scale, h * scale, w * scale);
        c.position.y = yy * scale + h * scale * 0.5;
        c.castShadow = true;
        top.add(c);
      });
    } else {
      const greens = [0x5cc83a, 0x4cb432, 0x6ad448];
      [[0, 0.18, 0, 0.42], [0.1, 0.12, 0.06, 0.3], [-0.09, 0.1, -0.05, 0.28], [0.02, 0.3, -0.02, 0.28]].forEach(([px, py, pz, s], i) => {
        const b = new THREE.Mesh(geo.sph, M(greens[i % 3]));
        b.scale.setScalar(s * scale);
        b.position.set(px * scale, py * scale, pz * scale);
        b.castShadow = true;
        top.add(b);
      });
    }
    g.add(top);
    parent.add(g);
    if (!still) sways.push({ m: top, p: rnd() * 6, a: 0.04 + rnd() * 0.03 });
    return g;
  }

  function addRock(parent, x, y, z, s, rnd, color) {
    const r = new THREE.Mesh(geo.dode, M(color || 0xa6a6b0, { flatShading: true, roughness: 0.9 }));
    r.scale.set(s * (0.8 + rnd() * 0.4), s * (0.55 + rnd() * 0.4), s * (0.8 + rnd() * 0.4));
    r.position.set(x, y + s * 0.18, z);
    r.rotation.set(rnd(), rnd() * 3, rnd() * 0.4);
    r.castShadow = true;
    r.receiveShadow = true;
    parent.add(r);
    return r;
  }

  function addTuft(parent, x, y, z, color, s) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(geo.coneL, M(color));
      c.scale.set(0.035 * s, 0.11 * s, 0.035 * s);
      c.position.set((i - 1) * 0.03 * s, 0.05 * s, (i % 2) * 0.02 * s);
      c.rotation.z = (i - 1) * 0.35;
      g.add(c);
    }
    parent.add(g);
  }

  function addFlower(parent, x, y, z, color) {
    const stem = new THREE.Mesh(geo.cyl, M(0x3a9a2a));
    stem.scale.set(0.012, 0.07, 0.012);
    stem.position.set(x, y + 0.035, z);
    const head = new THREE.Mesh(geo.sphL, M(color, { emissive: color, emissiveIntensity: 0.15 }));
    head.scale.setScalar(0.045);
    head.position.set(x, y + 0.075, z);
    parent.add(stem, head);
  }

  function addCactus(parent, x, y, z) {
    const m = M(0x4aa83a);
    const b = new THREE.Mesh(geo.cyl, m);
    b.scale.set(0.07, 0.24, 0.07); b.position.set(x, y + 0.12, z); b.castShadow = true;
    const cap = new THREE.Mesh(geo.sph, m); cap.scale.setScalar(0.07); cap.position.set(x, y + 0.24, z);
    const arm = new THREE.Mesh(geo.cyl, m); arm.scale.set(0.045, 0.1, 0.045); arm.position.set(x + 0.06, y + 0.16, z);
    const armT = new THREE.Mesh(geo.sph, m); armT.scale.setScalar(0.045); armT.position.set(x + 0.06, y + 0.21, z);
    parent.add(b, cap, arm, armT);
  }

  function addWaterPool(group, look, h, scale, rnd) {
    var wg = new THREE.BoxGeometry(0.86 * scale, 0.04, 0.86 * scale); wg.translate(0, 0.02, 0); const w = new THREE.Mesh(wg, look.dirty ? mats.dirtyW : mats.water);
    w.position.y = h - 0.02;
    group.add(w);
    waters.push({ m: w, p: rnd() * 6, y: h - 0.02 });
    return w;
  }

  function buildScenery(group, look, k, h) {
    const rnd = hashk(k);
    const kind = look.kind;
    const R = () => (rnd() - 0.5) * 0.6;
    if (kind === 'forest') {
      const n = look.dense ? 3 : 2;
      for (let i = 0; i < n; i++) addTree(group, R(), h, R(), 0.75 + rnd() * 0.3, look.dense && i === 2, rnd);
      addTuft(group, R(), h, R(), 0x4aa830, 1);
    } else if (kind === 'peak') {
      const m = new THREE.Mesh(geo.coneL, M(look.snow ? 0x9aa0ac : 0xa08866, { flatShading: true, roughness: 0.9 }));
      const ph = look.snow ? 0.75 : 0.45;
      m.scale.set(0.62, ph, 0.62);
      m.position.set(0.02, h + ph / 2, 0);
      m.rotation.y = rnd() * 3;
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      if (look.snow) {
        const s = new THREE.Mesh(geo.coneL, M(0xffffff, { flatShading: true, roughness: 0.6 }));
        s.scale.set(0.29, 0.35, 0.29);
        s.position.set(0.02, h + ph - 0.17, 0);
        s.rotation.y = m.rotation.y;
        group.add(s);
      }
      addRock(group, 0.3, h, 0.28, 0.16, rnd);
      if (!look.snow) addTree(group, -0.3, h, 0.28, 0.55, true, rnd);
    } else if (kind === 'rock') {
      addRock(group, -0.12, h, -0.08, 0.3, rnd, look.dirty ? 0x7a6a8a : 0xb0aab0);
      addRock(group, 0.2, h, 0.16, 0.2, rnd, look.dirty ? 0x6a5a7a : 0x9a96a0);
      if (look.dirty) addPuddle(group, h, rnd);
    } else if (kind === 'mine') {
      // 矿洞入口：深色洞口 + 木门框
      const hole = new THREE.Mesh(geo.sph, M(0x2a2018));
      hole.scale.set(0.3, 0.26, 0.12); hole.position.set(0, h + 0.06, -0.22);
      const wood = M(0xa06a34);
      const p1 = new THREE.Mesh(geo.box, wood); p1.scale.set(0.05, 0.22, 0.05); p1.position.set(-0.14, h + 0.11, -0.16);
      const p2 = p1.clone(); p2.position.x = 0.14;
      const beam = new THREE.Mesh(geo.box, wood); beam.scale.set(0.36, 0.05, 0.06); beam.position.set(0, h + 0.23, -0.16);
      [p1, p2, beam].forEach(o => { o.castShadow = true; });
      group.add(hole, p1, p2, beam);
      addRock(group, 0.28, h, 0.2, 0.16, rnd, 0x8a7a6a);
    } else if (kind === 'ruin') {
      const st = M(0xd8ccb0), st2 = M(0xb8a888);
      const w1 = new THREE.Mesh(geo.box, st); w1.scale.set(0.34, 0.2, 0.07); w1.position.set(-0.08, h + 0.1, -0.22);
      const w2 = new THREE.Mesh(geo.box, st2); w2.scale.set(0.07, 0.14, 0.26); w2.position.set(-0.24, h + 0.07, -0.05);
      const col = new THREE.Mesh(geo.cyl, st); col.scale.set(0.07, 0.28, 0.07); col.position.set(0.22, h + 0.14, -0.2);
      const cap = new THREE.Mesh(geo.box, st2); cap.scale.set(0.11, 0.035, 0.11); cap.position.set(0.22, h + 0.29, -0.2);
      [w1, w2, col, cap].forEach(o => { o.castShadow = true; o.receiveShadow = true; group.add(o); });
      addRock(group, 0.15, h, 0.2, 0.1, rnd, 0xc8bca0);
      addTuft(group, -0.15, h, 0.2, 0x7ab040, 1);
    } else if (kind === 'sand') {
      if (rnd() > 0.3) addCactus(group, R() * 0.8, h, R() * 0.8);
      addRock(group, R(), h, R(), 0.1, rnd, 0xd8b070);
    } else if (kind === 'land') {
      const tc = look.dirty ? 0x8a8a30 : look.dry ? 0xb0a040 : 0x4ab830;
      for (let i = 0; i < 3; i++) addTuft(group, R(), h, R(), tc, 1);
      if (look.flowers) {
        const fc = [0xff5a7a, 0xffe14a, 0xffffff, 0xb07aff];
        for (let i = 0; i < 3; i++) addFlower(group, R(), h, R(), fc[Math.floor(rnd() * 4)]);
      }
      if (look.dirty) addPuddle(group, h, rnd);
      if (look === LOOK.barren || look.dry) addRock(group, R(), h, R(), 0.1, rnd, 0xc0a070);
    }
    if (kind === 'water') {
      addWaterPool(group, look, h, look.wet ? 0.7 : 0.82, rnd);
      if (look.wet) {
        for (let i = 0; i < 3; i++) addTuft(group, (rnd() > 0.5 ? 1 : -1) * 0.36, h, R(), 0x3a9a40, 1.3);
      }
      const lily = new THREE.Mesh(geo.circle, M(0x4ac040, { side: THREE.DoubleSide }));
      lily.rotation.x = -Math.PI / 2; lily.scale.setScalar(0.12);
      lily.position.set(R() * 0.6, h + 0.025, R() * 0.6);
      if (!look.dirty) group.add(lily);
    }
    if (kind === 'lava') {
      var lg = new THREE.BoxGeometry(0.54, 0.04, 0.54); lg.translate(0, 0.02, 0); const pool = new THREE.Mesh(lg, mats.lava);
      pool.position.y = h - 0.015;
      group.add(pool);
      lavas.push(pool);
      for (let i = 0; i < 4; i++) {
        const a = i / 4 * Math.PI * 2 + 0.4;
        addRock(group, Math.cos(a) * 0.38, h, Math.sin(a) * 0.38, 0.14, rnd, 0x3a2e2e);
      }
    }
    if (look.creek) {
      var sg2 = new THREE.BoxGeometry(0.16, 0.03, 0.86); sg2.translate(0, 0.015, 0); const s = new THREE.Mesh(sg2, mats.water);
      
      s.position.set(0, h - 0.005, 0);
      group.add(s);
      waters.push({ m: s, p: rnd() * 6, y: h - 0.005 });
    }
  }

  function addPuddle(group, h, rnd) {
    const p = new THREE.Mesh(geo.circle, M(0x6a7a2a, { roughness: 0.3 }));
    p.rotation.x = -Math.PI / 2;
    p.scale.set(0.28, 0.2, 1);
    p.position.set((rnd() - 0.5) * 0.4, h + 0.006, (rnd() - 0.5) * 0.4);
    group.add(p);
  }

  function addPlant(group, p, x, z, h) {
    if (p.kind === 'tree') addTree(group, x, h, z, 0.85, false, hashk(String(p.id)));
    else if (p.kind === 'shrub') {
      const g = new THREE.Group();
      g.position.set(x, h, z);
      [[0, 0.07, 0, 0.17], [0.07, 0.05, 0.03, 0.12], [-0.06, 0.05, -0.02, 0.12]].forEach(([a, b, c, s]) => {
        const m = new THREE.Mesh(geo.sph, M(0x4cbc3a));
        m.scale.setScalar(s); m.position.set(a, b, c); m.castShadow = true; g.add(m);
      });
      const berry = new THREE.Mesh(geo.sphL, M(0xff3a5a)); berry.scale.setScalar(0.03); berry.position.set(0.05, 0.13, 0.05);
      g.add(berry);
      group.add(g);
      sways.push({ m: g, p: p.id, a: 0.05 });
    } else if (p.kind === 'crop') {
      const g = new THREE.Group();
      g.position.set(x, h, z);
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(geo.cyl, M(0xc8a030)); s.scale.set(0.012, 0.13, 0.012);
        const ox = (i % 3 - 1) * 0.04, oz = (i > 2 ? 0.04 : -0.02);
        s.position.set(ox, 0.065, oz);
        const ear = new THREE.Mesh(geo.sphL, M(0xffd040)); ear.scale.set(0.03, 0.06, 0.03); ear.position.set(ox, 0.15, oz);
        g.add(s, ear);
      }
      group.add(g);
      sways.push({ m: g, p: p.id, a: 0.07 });
    } else {
      addTuft(group, x, h, z, p.kind === 'weed' ? 0x2a8a5a : 0x6ad840, p.kind === 'weed' ? 1.8 : 1.3);
    }
  }

  // ---------- 动物：身体 + 头 + 耳朵 / 角 / 尾巴 ----------
  function part(g, gm, color, sx, sy, sz, x, y, z, extra) {
    const m = new THREE.Mesh(gm, M(color, extra));
    m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true;
    g.add(m);
    return m;
  }
  function eyes(g, x, y, z, gap, s) {
    part(g, geo.sphL, 0x1a1a1a, s, s, s, x, y, z + gap);
    part(g, geo.sphL, 0x1a1a1a, s, s, s, x, y, z - gap);
  }
  function legs(g, color, x, z, h, w) {
    [[x, z], [x, -z], [-x, z], [-x, -z]].forEach(([a, b]) => part(g, geo.cyl, color, w, h, w, a, h / 2, b));
  }
  function makeAnimal(kind, el) {
    const g = new THREE.Group();
    const glow = el ? { emissive: ELC[el], emissiveIntensity: 0.35 } : undefined;
    switch (kind) {
      case 'rabbit':
        part(g, geo.sph, 0xf5f0e8, 0.14, 0.12, 0.11, 0, 0.07, 0, glow);
        part(g, geo.sph, 0xf5f0e8, 0.09, 0.09, 0.09, 0.07, 0.13, 0, glow);
        part(g, geo.sph, 0xffd0d8, 0.025, 0.1, 0.035, 0.06, 0.22, 0.025);
        part(g, geo.sph, 0xffd0d8, 0.025, 0.1, 0.035, 0.06, 0.22, -0.025);
        part(g, geo.sphL, 0xffffff, 0.05, 0.05, 0.05, -0.08, 0.08, 0);
        eyes(g, 0.11, 0.14, 0, 0.025, 0.015);
        break;
      case 'fish':
        part(g, geo.sph, 0xff8a3a, 0.16, 0.08, 0.05, 0, 0, 0, glow);
        part(g, geo.cone4, 0xff6a20, 0.06, 0.08, 0.02, -0.1, 0, 0).rotation.z = Math.PI / 2;
        eyes(g, 0.05, 0.015, 0, 0.022, 0.012);
        break;
      case 'bird': {
        part(g, geo.sph, 0xff4a3a, 0.1, 0.09, 0.08, 0, 0, 0, glow);
        part(g, geo.sph, 0xff4a3a, 0.07, 0.07, 0.07, 0.05, 0.05, 0, glow);
        part(g, geo.cone4, 0xffb020, 0.025, 0.05, 0.025, 0.095, 0.05, 0).rotation.z = -Math.PI / 2;
        const w1 = part(g, geo.sph, 0xd02a2a, 0.08, 0.02, 0.06, -0.01, 0.02, 0.05); w1.userData.wing = 1;
        const w2 = part(g, geo.sph, 0xd02a2a, 0.08, 0.02, 0.06, -0.01, 0.02, -0.05); w2.userData.wing = -1;
        eyes(g, 0.075, 0.065, 0, 0.022, 0.01);
        break;
      }
      case 'bear':
        legs(g, 0x6a4026, 0.05, 0.04, 0.06, 0.04);
        part(g, geo.sph, 0x7a4a2a, 0.2, 0.15, 0.15, 0, 0.12, 0, glow);
        part(g, geo.sph, 0x7a4a2a, 0.12, 0.11, 0.11, 0.1, 0.18, 0, glow);
        part(g, geo.sph, 0xc89a6a, 0.05, 0.04, 0.05, 0.16, 0.17, 0);
        part(g, geo.sphL, 0x5a3420, 0.04, 0.04, 0.03, 0.08, 0.24, 0.04);
        part(g, geo.sphL, 0x5a3420, 0.04, 0.04, 0.03, 0.08, 0.24, -0.04);
        eyes(g, 0.15, 0.2, 0, 0.03, 0.014);
        break;
      case 'deer':
        legs(g, 0x8a5a30, 0.05, 0.03, 0.1, 0.022);
        part(g, geo.sph, 0xb07040, 0.17, 0.09, 0.09, 0, 0.13, 0, glow);
        part(g, geo.cyl, 0xb07040, 0.04, 0.09, 0.04, 0.07, 0.19, 0, glow).rotation.z = -0.5;
        part(g, geo.sph, 0xb07040, 0.07, 0.06, 0.06, 0.1, 0.24, 0, glow);
        [-1, 1].forEach(s => {
          part(g, geo.cyl, 0xf0e0c0, 0.01, 0.08, 0.01, 0.09, 0.3, s * 0.025).rotation.x = s * 0.4;
          part(g, geo.cyl, 0xf0e0c0, 0.008, 0.04, 0.008, 0.11, 0.32, s * 0.04).rotation.z = -0.8;
        });
        part(g, geo.sphL, 0xffffff, 0.035, 0.035, 0.035, -0.09, 0.15, 0);
        eyes(g, 0.125, 0.25, 0, 0.022, 0.011);
        break;
      case 'leopard':
        legs(g, 0xe0a040, 0.06, 0.035, 0.07, 0.025);
        part(g, geo.sph, 0xf0b040, 0.2, 0.09, 0.09, 0, 0.1, 0, glow);
        part(g, geo.sph, 0xf0b040, 0.08, 0.075, 0.075, 0.11, 0.14, 0, glow);
        for (let i = 0; i < 4; i++) part(g, geo.sphL, 0x5a3a1a, 0.025, 0.012, 0.025, -0.06 + i * 0.04, 0.145, (i % 2 ? 0.02 : -0.015));
        part(g, geo.cyl, 0xf0b040, 0.018, 0.14, 0.018, -0.12, 0.14, 0).rotation.z = 0.9;
        eyes(g, 0.145, 0.155, 0, 0.022, 0.011);
        break;
      case 'cow':
        legs(g, 0xf0f0f0, 0.06, 0.04, 0.08, 0.03);
        part(g, geo.sph, 0xfafafa, 0.22, 0.13, 0.13, 0, 0.14, 0, glow);
        part(g, geo.sphL, 0x2a2a2a, 0.07, 0.05, 0.02, -0.02, 0.17, 0.06);
        part(g, geo.sphL, 0x2a2a2a, 0.05, 0.05, 0.02, 0.05, 0.12, -0.06);
        part(g, geo.sph, 0xfafafa, 0.1, 0.09, 0.09, 0.12, 0.17, 0, glow);
        part(g, geo.sph, 0xffb0b8, 0.05, 0.04, 0.07, 0.17, 0.15, 0);
        part(g, geo.cone, 0xf0e0b0, 0.02, 0.05, 0.02, 0.11, 0.23, 0.04);
        part(g, geo.cone, 0xf0e0b0, 0.02, 0.05, 0.02, 0.11, 0.23, -0.04);
        eyes(g, 0.15, 0.19, 0, 0.032, 0.012);
        break;
      case 'sheep':
      default:
        legs(g, 0x3a3a3a, 0.04, 0.03, 0.06, 0.022);
        [[0, 0.11, 0, 0.11], [0.05, 0.12, 0.04, 0.08], [-0.05, 0.12, -0.03, 0.08], [0.02, 0.15, -0.03, 0.08], [-0.04, 0.1, 0.04, 0.08]]
          .forEach(([x, y, z, s]) => part(g, geo.sph, 0xffffff, s * 1.3, s, s, x, y, z, glow));
        part(g, geo.sph, 0x3a3030, 0.07, 0.07, 0.065, 0.1, 0.13, 0);
        eyes(g, 0.13, 0.145, 0, 0.022, 0.01);
        part(g, geo.sphL, 0xffffff, 0.02, 0.02, 0.02, 0.135, 0.15, 0.022);
        part(g, geo.sphL, 0xffffff, 0.02, 0.02, 0.02, 0.135, 0.15, -0.022);
        break;
    }
    if (el) {
      const halo = new THREE.Mesh(geo.halo, M(ELC[el], { emissive: ELC[el], emissiveIntensity: 1 }));
      halo.rotation.x = Math.PI / 2;
      halo.scale.setScalar(0.14);
      halo.position.y = 0.32;
      g.add(halo);
    }
    return g;
  }

  function signature(t) {
    return t.type + '|' + t.attrs.join(',') + '|' + t.spirits.map(s => s.el).join('') + '|' + t.beasts.map(b => b.el).join('') +
      '|' + t.plants.map(p => p.kind).join('') + '|' + t.animals.map(a => a.kind + (a.el || '')).join('') +
      '|' + t.ores.join('') + '|' + (t.spring ? 1 : 0) + (t.shelter ? 1 : 0);
  }

  function rebuildUnits(node, t, h) {
    const g = node.units;
    while (g.children.length) g.remove(g.children[0]);
    const rnd = hashk(node.k + 'u');
    if (t.shelter) {
      const house = new THREE.Group();
      house.position.set(0.24, h, 0.2);
      house.rotation.y = -0.5;
      part(house, geo.box, 0xfff0d0, 0.24, 0.16, 0.2, 0, 0.08, 0);
      const roof = part(house, geo.cone4, 0xe0402a, 0.26, 0.15, 0.26, 0, 0.235, 0, { flatShading: true });
      roof.rotation.y = Math.PI / 4;
      roof.scale.set(0.24, 0.15, 0.22);
      part(house, geo.box, 0x8a5030, 0.05, 0.09, 0.01, 0, 0.045, 0.1);
      part(house, geo.box, 0x8adcff, 0.04, 0.04, 0.01, 0.07, 0.1, 0.101, { emissive: 0x3a8aff, emissiveIntensity: 0.4 });
      part(house, geo.box, 0x9a7a6a, 0.04, 0.09, 0.04, -0.07, 0.27, 0.03);
      g.add(house);
    }
    if (t.spring) {
      const sp = new THREE.Group();
      sp.position.set(-0.24, h, -0.2);
      const ring = new THREE.Mesh(geo.torus, M(0xb0b0b8, { flatShading: true }));
      ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.12); ring.position.y = 0.02;
      const pool = new THREE.Mesh(geo.circle, mats.water);
      pool.rotation.x = -Math.PI / 2; pool.scale.setScalar(0.2); pool.position.y = 0.03;
      const jet = new THREE.Mesh(geo.sph, M(0x9ae4ff, { emissive: 0x3ab0ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }));
      jet.scale.set(0.05, 0.12, 0.05); jet.position.y = 0.1;
      sp.add(ring, pool, jet);
      g.add(sp);
      bobs.push({ m: jet, y: 0.1, p: rnd() * 5, a: 0.03, squash: 1 });
    }
    t.plants.forEach((p, i) => {
      const a = (i / Math.max(1, t.plants.length)) * Math.PI * 2 + 0.6;
      addPlant(g, p, Math.cos(a) * 0.3, Math.sin(a) * 0.3, h);
    });
    t.ores.forEach((o, i) => {
      const cl = new THREE.Group();
      cl.position.set(-0.3 + i * 0.18, h, 0.3);
      [[0, 0, 0.09, 0], [0.04, 0.02, 0.06, 0.5], [-0.035, -0.02, 0.055, -0.5]].forEach(([x, z, s, rz]) => {
        const c = new THREE.Mesh(geo.octa, M(ORE_C[o], { metalness: 0.6, roughness: 0.25, emissive: ORE_C[o], emissiveIntensity: 0.25, flatShading: true }));
        c.scale.set(s, s * 2, s); c.position.set(x, s * 0.8, z); c.rotation.z = rz; c.castShadow = true;
        cl.add(c);
      });
      g.add(cl);
    });
    t.animals.forEach((a, i) => {
      const m = makeAnimal(a.kind, a.el);
      const ang = (i / Math.max(1, t.animals.length)) * Math.PI * 2 + 0.3;
      const r = 0.2;
      const fly = a.kind === 'bird', swim = a.kind === 'fish';
      const y = h + (fly ? 0.3 : swim ? 0.02 : 0);
      m.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
      m.rotation.y = -ang - Math.PI / 2;
      g.add(m);
      bobs.push({ m, y, p: i * 1.3 + rnd(), a: fly ? 0.05 : 0.012, hop: !fly && !swim, fly, wander: { r, ang, sp: fly ? 0.6 : 0.15 } });
    });
    t.spirits.forEach((s, i) => {
      const sg = new THREE.Group();
      const core = new THREE.Mesh(geo.sph, M(0xffffff, { emissive: ELC[s.el], emissiveIntensity: 1.2 }));
      core.scale.setScalar(0.07);
      const shell = new THREE.Mesh(geo.sph, M(ELC[s.el], { emissive: ELC[s.el], emissiveIntensity: 0.6, transparent: true, opacity: 0.45, depthWrite: false }));
      shell.scale.setScalar(0.13);
      const halo = new THREE.Mesh(geo.halo, M(ELC[s.el], { emissive: ELC[s.el], emissiveIntensity: 0.9 }));
      halo.scale.setScalar(0.09); halo.rotation.x = 1.2;
      sg.add(core, shell, halo);
      const y = h + 0.42 + (i % 3) * 0.06;
      g.add(sg);
      bobs.push({ m: sg, y, p: i * 2.1, a: 0.04, orbit: 0.2 + (i % 2) * 0.06, sp: 0.8 + (i % 3) * 0.2, spin: 2 });
    });
    t.beasts.forEach((b, i) => {
      const bg = new THREE.Group();
      const crystal = new THREE.Mesh(geo.ico, M(ELC[b.el], { emissive: ELC[b.el], emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.2, flatShading: true }));
      crystal.scale.set(0.22, 0.32, 0.22);
      crystal.castShadow = true;
      const inner = new THREE.Mesh(geo.octa, M(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 }));
      inner.scale.setScalar(0.1);
      const ring = new THREE.Mesh(geo.halo, M(ELC[b.el], { emissive: ELC[b.el], emissiveIntensity: 1 }));
      ring.rotation.x = Math.PI / 2; ring.scale.setScalar(0.3);
      bg.add(crystal, inner, ring);
      const y = h + 0.75 + i * 0.2;
      bg.position.set(0, y, 0);
      g.add(bg);
      bobs.push({ m: bg, y, p: i, a: 0.07, spin: 1.2 });
    });
  }

  function makeTile(k, t, animate) {
    const look = LOOK[G.TYPE[t.type].look] || LOOK.grass;
    const group = new THREE.Group();
    const p = wp(k);
    group.position.set(p.x, animate ? 2.2 : 0, p.z);
    const h = look.h;
    const terrain = new THREE.Mesh(tileSlab(1.04, h), [ownMat(colTint(look.top, t.attrs)), ownMat(colTint(look.side, t.attrs), { roughness: 0.95 })]);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    terrain.userData.k = k;
    group.add(terrain);
    // 顶面描边（分割感）
    var ew = 0.52, ey = h + 0.005;
    var edgePts = [[-ew,ey,-ew], [ew,ey,-ew], [ew,ey,ew], [-ew,ey,ew], [-ew,ey,-ew]];
    var edgeArr = [];
    for (var ei = 0; ei < edgePts.length; ei++) edgeArr.push(edgePts[ei][0], edgePts[ei][1], edgePts[ei][2]);
    var edgeG = new THREE.BufferGeometry();
    edgeG.setAttribute('position', new THREE.Float32BufferAttribute(edgeArr, 3));
    var edgeLine = new THREE.Line(edgeG, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12, linewidth: 1 }));
    group.add(edgeLine);
    const scenery = new THREE.Group();
    group.add(scenery);
    buildScenery(scenery, look, k, h);
    scenery.traverse(o => { if (o.isMesh && !o.material.transparent && o.geometry !== geo.circle) o.castShadow = true; });
    const units = new THREE.Group();
    group.add(units);
    const node = { k, group, terrain, units, look, sig: '', rise: animate ? 1 : 0, lift: 0 };
    node.sig = signature(t);
    rebuildUnits(node, t, h);
    pickables.add(terrain);
    scene.add(group);
    tileMap[k] = node;
    if (pads[k]) pads[k].visible = false;
  }

  function removeTile(k) {
    const n = tileMap[k];
    if (!n) return;
    scene.remove(n.group);
    n.terrain.material.forEach(m => m.dispose());
    pickables.remove(n.terrain);
    delete tileMap[k];
    if (pads[k]) pads[k].visible = true;
  }

  function updateTile(n, t) {
    const sig = signature(t);
    if (sig === n.sig) return;
    n.sig = sig;
    const look = LOOK[G.TYPE[t.type].look] || LOOK.grass;
    n.terrain.material[0].color.copy(colTint(look.top, t.attrs));
    n.terrain.material[1].color.copy(colTint(look.side, t.attrs));
    rebuildUnits(n, t, look.h);
    n.pop = 1;   // 变化时轻弹一下
  }

  function ensureGhost() {
    if (ghost) return;
    ghost = new THREE.Mesh(tileSlab(1.02, 0.14), mats.ghost);
    ghost.visible = false;
    scene.add(ghost);
  }

  // ---------- 特效 ----------
  function spawnBurst(pos, color, n, speed, life, up) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n && particles.length < 480; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
      particles.push({
        p: pos.clone(),
        v: new THREE.Vector3(Math.cos(a) * r, (up || 0.9) * (Math.random() * speed + 0.4), Math.sin(a) * r),
        life: life * (0.7 + Math.random() * 0.5), max: life, c,
      });
    }
  }
  function spawnRing(pos, color, size) {
    const m = new THREE.Mesh(geo.ring, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    fxGroup.add(m);
    rings.push({ m, t: 0, life: 0.6, size: size || 3 });
  }
  function spawnBeam(pos, color) {
    const m = new THREE.Mesh(geo.cylT, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    m.position.copy(pos);
    m.position.y += 2.4;
    m.scale.set(1, 4.8, 1);
    fxGroup.add(m);
    beams.push({ m, t: 0, life: 0.6 });
  }

  function fx(kind, cell, extra) {
    if (!cell || !G.SHAPE_KEYS.has(cell)) return;
    const look = stateRef && stateRef.cells[cell] ? LOOK[G.TYPE[stateRef.cells[cell].type].look] : LOOK.grass;
    const pos = wp(cell, (look ? look.h : 0.2) + 0.05);
    const map = {
      place: 0xffe066, purify: 0xffffff, mine: 0xffcc22, spring: 0x38c0ff,
      rich: 0xd0904a, burn: 0xff5a1a, merge: ELC[extra] || 0xffffff,
      crystal: ELC[extra] || 0xffffff, charm: 0xfff4c0, shelter: 0xffffff,
    };
    const c = map[kind] || 0xffffff;
    if (kind === 'place') {
      if (tileMap[cell] && tileMap[cell].rise > 0) return;   // 落地时再播
      spawnRing(wp(cell, 0.02), c, 2.2);
      spawnBurst(wp(cell, 0.1), 0xd8c090, 22, 1.4, 0.6, 0.5);   // 落地扬尘
      shake = Math.max(shake, 0.12);
      return;
    }
    spawnRing(pos, c);
    setTimeout(() => spawnRing(pos, c, 2), 120);
    if (kind !== 'shelter') spawnBeam(pos, c);
    const hot = kind === 'burn';
    spawnBurst(pos, c, hot ? 46 : 28, hot ? 2 : 1.3, 0.9, 1.2);
    spawnBurst(pos, 0xffffff, 10, 0.8, 0.6, 1.5);
    if (hot || kind === 'merge') shake = Math.max(shake, 0.25);
    const n = tileMap[cell];
    if (n) n.pop = 1;
  }

  // 竖屏时视野变窄，按宽高比拉远
  const baseR = () => (camera && camera.aspect < 1 ? 13 / Math.max(0.5, camera.aspect) * 0.85 : 13);
  const LOW = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.hardwareConcurrency || 8) <= 4;

  function initCam() {
    cam = {
      sph: new THREE.Spherical(18, 0.88, 0.78),
      target: new THREE.Vector3(0, 0.2, 0),
      gR: baseR(), gP: 0.9, gT: 0.78, gx: 0, gy: 0.2, gz: 0,
    };
    camera.position.setFromSpherical(cam.sph);
    camera.position.add(cam.target);
    camera.lookAt(cam.target);
  }

  function updateCam(dt) {
    if (intro > 0) {
      intro = Math.max(0, intro - dt * 0.55);
      cam.gR = baseR() + intro * 16;
      cam.gP = 0.9 - intro * 0.15;
    }
    let panX = 0, panZ = 0;
    if (keys.KeyW || keys.ArrowUp) panZ -= 1;
    if (keys.KeyS || keys.ArrowDown) panZ += 1;
    if (keys.KeyA || keys.ArrowLeft) panX -= 1;
    if (keys.KeyD || keys.ArrowRight) panX += 1;
    if (keys.KeyQ) cam.gT += dt * 1.1;
    if (keys.KeyE) cam.gT -= dt * 1.1;
    if (keys.KeyR) cam.gR = Math.max(8, cam.gR - dt * 10);
    if (keys.KeyF) cam.gR = Math.min(60, cam.gR + dt * 10);
    if (panX || panZ) {
      const ele = v1.setFromSpherical(cam.sph);
      const right = v2.set(ele.z, 0, -ele.x).normalize();
      const fwd = v1.set(-ele.x, 0, -ele.z).normalize();
      const sp = 8 * dt;
      cam.gx += right.x * panX * sp + fwd.x * panZ * sp;
      cam.gz += right.z * panX * sp + fwd.z * panZ * sp;
    }
    cam.gx = THREE.MathUtils.clamp(cam.gx, -10, 10);
    cam.gz = THREE.MathUtils.clamp(cam.gz, -10, 10);
    cam.gP = THREE.MathUtils.clamp(cam.gP, 0.42, 1.22);
    cam.gR = THREE.MathUtils.clamp(cam.gR, 8, 60);
    const k = 1 - Math.exp(-dt * 8);
    cam.sph.radius += (cam.gR - cam.sph.radius) * k;
    cam.sph.phi += (cam.gP - cam.sph.phi) * k;
    cam.sph.theta += (cam.gT - cam.sph.theta) * k;
    cam.target.x += (cam.gx - cam.target.x) * k;
    cam.target.y += (cam.gy - cam.target.y) * k;
    cam.target.z += (cam.gz - cam.target.z) * k;
    camera.position.setFromSpherical(cam.sph).add(cam.target);
    camera.lookAt(cam.target);
  }

  function pickCell(cx, cy) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.ndc.x = ((cx - r.left) / r.width) * 2 - 1;
    pointer.ndc.y = -((cy - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(pointer.ndc, camera);
    const hits = ray.intersectObjects(pickables.children, false);
    return hits.length ? hits[0].object.userData.k : null;
  }

  function panBy(dx, dy) {
    const ele = v1.setFromSpherical(cam.sph);
    const right = v2.set(ele.z, 0, -ele.x).normalize();
    const fwd = v1.set(-ele.x, 0, -ele.z).normalize();
    const sp = cam.sph.radius * 0.0022;
    cam.gx -= right.x * dx * sp + fwd.x * dy * sp;
    cam.gz -= right.z * dx * sp + fwd.z * dy * sp;
  }

  // 统一鼠标 / 触屏：单指旋转，双指捏合缩放 + 平移，右键平移
  function bindInput(dom) {
    const pts = new Map();
    let tap = null, pinch = null;
    const two = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
    dom.addEventListener('pointerdown', e => {
      if (e.button > 2) return;
      try { dom.setPointerCapture(e.pointerId); } catch (_) { /* 部分浏览器不支持 */ }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
      if (pts.size === 1) tap = { x: e.clientX, y: e.clientY, b: e.button, moved: false, touch: e.pointerType !== 'mouse' };
      else { tap = null; pinch = two(); }
    });
    dom.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (p) {
        const dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pts.size >= 2 && pinch) {
          const n = two();
          if (n.d > 0 && pinch.d > 0) cam.gR *= pinch.d / n.d;
          panBy(n.x - pinch.x, n.y - pinch.y);
          pinch = n;
        } else if (pts.size === 1 && tap) {
          if (Math.abs(e.clientX - tap.x) + Math.abs(e.clientY - tap.y) > (tap.touch ? 10 : 5)) tap.moved = true;
          if (tap.moved) {
            if (p.b === 0) { cam.gT -= dx * 0.005; cam.gP -= dy * 0.004; }
            else panBy(dx, dy);
          }
        }
      }
      if (e.pointerType === 'mouse') {
        const k = pickCell(e.clientX, e.clientY);
        hoverK = k;
        if (cb.onHover) cb.onHover(k, e.clientX, e.clientY);
      }
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      const d = tap;
      if (pts.size === 0) tap = null;
      if (e.type !== 'pointerup' || !d || d.moved || d.b !== 0 || pts.size) return;
      const k = pickCell(e.clientX, e.clientY);
      if (d.touch) hoverK = k;   // 触屏无悬停：用点击位置驱动放置预览
      if (k) { if (cb.onCell) cb.onCell(k); }
      else if (cb.onMiss) cb.onMiss();
    };
    dom.addEventListener('pointerup', up);
    dom.addEventListener('pointercancel', up);
    dom.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse') return;
      if (hoverK && cb.onHover) cb.onHover(null, 0, 0);
      hoverK = null;
    });
    dom.addEventListener('wheel', e => {
      e.preventDefault();
      cam.gR *= (e.deltaY > 0 ? 1.08 : 0.92);
    }, { passive: false });
    dom.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => { if (e.target.closest && e.target.closest('button, input, dialog')) return; keys[e.code] = true; if (e.code === 'Space') { cam.gx = 0; cam.gz = 0; cam.gR = baseR(); cam.gP = 0.9; cam.gT = 0.78; e.preventDefault(); } });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { keys = {}; });
  }

  function updateFX(dt, time) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.v.y -= 2.2 * dt;
      p.v.multiplyScalar(1 - dt * 0.8);
      p.p.addScaledVector(p.v, dt);
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    const n = particles.length;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      pPos[i * 3] = p.p.x; pPos[i * 3 + 1] = p.p.y; pPos[i * 3 + 2] = p.p.z;
      const a = Math.max(0, p.life / p.max);
      pCol[i * 3] = p.c.r * a; pCol[i * 3 + 1] = p.c.g * a; pCol[i * 3 + 2] = p.c.b * a;
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    pGeo.computeBoundingSphere();

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t += dt;
      const u = r.t / r.life;
      const e = 1 - Math.pow(1 - u, 3);
      r.m.scale.setScalar(0.6 + e * r.size);
      r.m.material.opacity = 1 - u;
      if (u >= 1) { fxGroup.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t += dt;
      const u = b.t / b.life;
      b.m.material.opacity = 0.6 * (1 - u);
      b.m.scale.x = b.m.scale.z = 1 + u * 1.6;
      b.m.rotation.y += dt * 3;
      if (u >= 1) { fxGroup.remove(b.m); b.m.material.dispose(); beams.splice(i, 1); }
    }
    sways.forEach(s => { s.m.rotation.z = Math.sin(time * 0.9 + s.p) * s.a; s.m.rotation.x = Math.cos(time * 0.7 + s.p) * s.a * 0.6; });
    waters.forEach(w => { w.m.position.y = w.y + Math.sin(time * 1.8 + w.p) * 0.01; });
    const lv = 1 + Math.sin(time * 3.2) * 0.35;
    lavas.forEach(m => { m.material.emissiveIntensity = lv; });
    mats.water.emissiveIntensity = 0.22 + Math.sin(time * 2) * 0.08;
    bobs.forEach(b => {
      const m = b.m;
      if (b.cloud) { m.position.x += dt * b.cloud; if (m.position.x > 70) m.position.x = -70; return; }
      if (b.orbit) {
        // 元素灵绕地块中心转圈
        const a = time * b.sp + b.p;
        m.position.set(Math.cos(a) * b.orbit, b.y + Math.sin(time * 2.4 + b.p) * b.a, Math.sin(a) * b.orbit);
        m.rotation.y += dt * b.spin;
        return;
      }
      if (b.wander) {
        // 动物：小范围踱步 + 跳跳 / 扇翅
        const w = b.wander;
        const a = w.ang + Math.sin(time * w.sp + b.p) * (b.fly ? 3 : 0.7);
        m.position.x = Math.cos(a) * w.r;
        m.position.z = Math.sin(a) * w.r;
        m.rotation.y = -a - Math.PI / 2 * Math.sign(Math.cos(time * w.sp + b.p) || 1);
        if (b.hop) m.position.y = b.y + Math.abs(Math.sin(time * 4 + b.p)) * 0.025;
        else m.position.y = b.y + Math.sin(time * 2 + b.p) * b.a;
        if (b.fly) m.children.forEach(c => { if (c.userData.wing) c.rotation.x = c.userData.wing * Math.sin(time * 18 + b.p) * 0.7; });
        return;
      }
      m.position.y = b.y + Math.sin(time * 2.1 + b.p) * b.a;
      if (b.squash) m.scale.y = 0.12 * (1 + Math.sin(time * 6 + b.p) * 0.25);
      if (b.spin) m.rotation.y += dt * b.spin;
    });
    // 只保留仍在场景中的对象
    const live = o => { let p = o; while (p) { if (p === scene) return true; p = p.parent; } return false; };
    if (Math.floor(time * 2) !== Math.floor((time - dt) * 2)) {
      bobs = bobs.filter(b => live(b.m));
      sways = sways.filter(s => live(s.m));
      waters = waters.filter(w => live(w.m));
      lavas = lavas.filter(m => live(m));
    }

    if (stateRef) {
      for (const k of Object.keys(stateRef.cells)) {
        const t = stateRef.cells[k];
        const look = LOOK[G.TYPE[t.type].look] || LOOK.grass;
        if (t.spring && Math.random() < dt * 4) {
          const p = wp(k, look.h + 0.15); p.x -= 0.24; p.z -= 0.2;
          spawnBurst(p, 0x8adcff, 1, 0.25, 0.6, 1.2);
        }
        if (look.kind === 'lava' && Math.random() < dt * 3) spawnBurst(wp(k, look.h + 0.05), 0xff7a20, 1, 0.3, 0.8, 1.3);
        if (t.beasts.length && Math.random() < dt * 3) spawnBurst(wp(k, look.h + 0.75), ELC[t.beasts[0].el], 1, 0.4, 0.7, 0.6);
        if (look.kind === 'water' && !look.dirty && Math.random() < dt * 1.2) {
          const p = wp(k, look.h + 0.03); p.x += (Math.random() - 0.5) * 0.6; p.z += (Math.random() - 0.5) * 0.6;
          spawnBurst(p, 0xffffff, 1, 0.05, 0.4, 0.3);
        }
      }
    }
  }

  function updateHighlights(dt, time) {
    const legal = (modeRef && modeRef.kind === 'place') ? new Set(G.legalPlacements(stateRef)) : new Set();
    const targets = new Set();
    if (modeRef && stateRef && modeRef.kind !== 'place') {
      if (modeRef.kind === 'moveSpirit' || modeRef.kind === 'moveAnimal') {
        G.neighbors(modeRef.from).forEach(n => { if (stateRef.cells[n]) targets.add(n); });
      } else Object.keys(stateRef.cells).forEach(k => targets.add(k));
    }
    const pulse = Math.sin(time * 4);
    mats.padLegal.emissiveIntensity = 0.35 + pulse * 0.18;
    for (const k of Object.keys(pads)) {
      const pad = pads[k];
      if (!pad.visible) continue;
      const on = legal.has(k);
      pad.material = on ? [mats.padLegal, mats.padSide] : [mats.pad, mats.padSide];
      const lift = on ? 0.03 + pulse * 0.015 : 0;
      pad.position.y += (-0.03 + lift - pad.position.y) * Math.min(1, dt * 10);
    }
    if (ghost) {
      const show = modeRef && modeRef.kind === 'place' && hoverK && legal.has(hoverK);
      ghost.visible = !!show;
      if (show) {
        const p = wp(hoverK);
        ghost.position.set(p.x, 0.12 + Math.sin(time * 5) * 0.04, p.z);
      }
    }
    for (const k of Object.keys(tileMap)) {
      const n = tileMap[k];
      if (!n.selBox) {
        // 方形虚线框：四条边的 LineSegments
        var pts = [], hw = 0.55;
        [[-hw,-hw,hw,-hw],[hw,-hw,hw,hw],[hw,hw,-hw,hw],[-hw,hw,-hw,-hw]].forEach(function(e){
          for (var i = 0; i <= 16; i++) { var t2 = i / 16; pts.push(e[0]+(e[2]-e[0])*t2, 0, e[1]+(e[3]-e[1])*t2); }
        });
        var bg = new THREE.BufferGeometry();
        bg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        n.selBox = new THREE.LineSegments(bg, new THREE.LineDashedMaterial({ color: 0xffd23a, dashSize: 0.08, gapSize: 0.06, linewidth: 2, transparent: true, opacity: 0.95, depthWrite: false }));
        n.selBox.computeLineDistances();
        n.selBox.visible = false;
        n.group.add(n.selBox);
        // 四角 L 形角标
        var cg = new THREE.Group(), cl = 0.1;
        [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(d){
          var lm = M(0xffd23a, { emissive: 0xffd23a, emissiveIntensity: 0.4 });
          var h1 = new THREE.Mesh(new THREE.BoxGeometry(cl, 0.02, 0.018), lm);
          h1.position.set(d[0]*hw - d[0]*cl/2, 0, d[1]*hw);
          var v1b = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, cl), lm);
          v1b.position.set(d[0]*hw, 0, d[1]*hw - d[1]*cl/2);
          cg.add(h1, v1b);
        });
        n.corners = cg;
        n.corners.visible = false;
        n.group.add(cg);
      }
      var sel = selectedK === k, tg = targets.has(k);
      n.selBox.visible = sel || tg;
      n.corners.visible = sel || tg;
      if (sel || tg) {
        var c = tg && !sel ? 0x5ad0ff : 0xffd23a;
        n.selBox.material.color.setHex(c);
        n.selBox.material.dashSize = 0.08 + Math.sin(time * 6) * 0.01;
        n.selBox.position.y = n.look.h + 0.04;
        n.corners.position.y = n.look.h + 0.04;
        var breath = 1 + Math.sin(time * 3) * 0.03;
        n.corners.scale.setScalar(breath);
      }
      // 选中地块抬起，悬停微抬
      var goal = sel ? 0.06 : 0;
      n.lift += (goal - n.lift) * Math.min(1, dt * 12);
    }
  }

  // 回弹缓动（超过目标再回落）
  function backOut(u) { const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(0.05, clock.getDelta());
    const time = clock.elapsedTime;
    updateCam(dt);
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 0.8);
    }
    updateHighlights(dt, time);
    for (const k of Object.keys(tileMap)) {
      const n = tileMap[k];
      let y = n.lift, sxz = 1, sy = 1;
      if (n.rise > 0) {
        n.rise = Math.max(0, n.rise - dt * 2.5);
        var u = 1 - n.rise;
        y += (1 - backOut(u)) * 2.2;
        if (n.rise === 0) { n.pop = 1; fx('place', k); }
      }
      if (n.pop > 0) {
        // 落地挤压
        n.pop = Math.max(0, n.pop - dt * 3.5);
        const s = Math.sin(n.pop * Math.PI) * n.pop;
        sy = 1 - s * 0.25; sxz = 1 + s * 0.12;
      }
      n.group.position.y = y;
      n.group.scale.set(sxz, sy, sxz);
    }
    updateFX(dt, time);
    renderer.render(scene, camera);
  }

  function resize() {
    if (!renderer) return;
    const el = renderer.domElement.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  function sync(S, ui) {
    if (stateRef && S !== stateRef) {
      // 新游戏：清空地块，镜头重新入场
      Object.keys(tileMap).forEach(removeTile);
      lastRound = S.round; intro = 0.6;
      cam.gx = 0; cam.gz = 0;
    }
    const fresh = !stateRef || S !== stateRef;
    stateRef = S;
    modeRef = ui.mode;
    selectedK = ui.selected;
    const keysNow = new Set(Object.keys(S.cells));
    for (const k of Object.keys(tileMap)) if (!keysNow.has(k)) removeTile(k);
    for (const k of keysNow) {
      if (!tileMap[k]) makeTile(k, S.cells[k], !fresh);
      else updateTile(tileMap[k], S.cells[k]);
    }
    if (S.round !== lastRound) {
      lastRound = S.round;
      shake = Math.max(shake, 0.2);
      for (const k of keysNow) {
        const t = S.cells[k];
        const h = (LOOK[G.TYPE[t.type].look] || LOOK.grass).h;
        spawnBurst(wp(k, h + 0.1), 0xfff2a0, 3, 0.5, 0.9, 1.4);
        if (t.spirits.length) spawnRing(wp(k, h + 0.05), ELC[t.spirits[0].el], 1.2);
      }
    }
    ensureGhost();
    if (ui.focus && tileMap[ui.focus]) focus(ui.focus);
  }

  function supported() {
    try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (_) { return false; }
  }

  // 圆形柔光粒子贴图
  function dotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function init(el, handlers) {
    G = root.Game; D = root.GameData; EL = D.ELEMENTS;
    cb = handlers || {};
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xb8e0ff, 45, 120);
    camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    renderer = new THREE.WebGLRenderer({ antialias: !LOW || (window.devicePixelRatio || 1) < 2, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(LOW ? 1.5 : 2, window.devicePixelRatio || 1));
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = LOW ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.outline = 'none';
    renderer.domElement.tabIndex = 0;

    initGeos();
    scene.add(makeSky());
    // 明亮的卡通光照：天空蓝 / 草地绿半球光 + 暖色主光
    scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x6a9040, 0.42));
        sun = new THREE.DirectionalLight(0xfff0d0, 0.78);
    sun.position.set(12, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 60;
    sun.shadow.bias = -0.0008;
    sun.shadow.radius = 3;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xb0d8ff, 0.14);
    fill.position.set(-10, 8, -12);
    scene.add(fill);
    addHorizon();

    pickables = new THREE.Group();
    scene.add(pickables);
    fxGroup = new THREE.Group();
    scene.add(fxGroup);
    G.SHAPE.forEach(([x, y]) => addPad(G.key(x, y)));

    pPos = new Float32Array(500 * 3);
    pCol = new Float32Array(500 * 3);
    pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    pObj = new THREE.Points(pGeo, new THREE.PointsMaterial({
      size: 0.2, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    pObj.frustumCulled = false;
    scene.add(pObj);

    clock = new THREE.Clock();
    initCam();
    bindInput(renderer.domElement);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    resize();
    loop();
  }

  function project(k) {
    if (!camera || !renderer || !k || !G.SHAPE_KEYS.has(k)) return null;
    const look = stateRef && stateRef.cells[k] ? LOOK[G.TYPE[stateRef.cells[k].type].look] : null;
    const pos = wp(k, (look ? look.h : 0) + 0.4);
    pos.project(camera);
    if (pos.z > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: (pos.x * 0.5 + 0.5) * r.width + r.left, y: (-pos.y * 0.5 + 0.5) * r.height + r.top };
  }

  function focus(k) {
    if (!k || !cam) return;
    const p = wp(k);
    cam.gx = p.x; cam.gz = p.z;
  }

  root.View = { init, sync, resize, fx, focus, supported, project };
})(this);
