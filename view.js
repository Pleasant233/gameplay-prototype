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
  // A continuous landscape: height describes broad relief, not tile thickness.
  const RELIEF = { peak:0.25,bare:0.20,rock:0.155,pollute_rock:0.15,mine:0.15,lava:0.14,water:0.10,pollute_water:0.10,wet:0.11 };
  const LAND_COLORS = { ruin:0xd7b981,pollute_water:0x98b978,pollute_earth:0xa6b95c,pollute_rock:0xaa97b7,barren:0xdfbd79,rock:0xc7b9a3,sand:0xf1d78c,bare:0xc9ae84,grass:0x91cf60,water:0xf0d390,lava:0x9d7061,waste:0xcfb678,peak:0xb8d3df,forest:0x70b450,wet:0x71c6a3,mine:0xc5a174,valley:0x95d069,rain:0x56ab60,fertile:0xaacb54,creek:0x8ed28b };
  Object.entries(LOOK).forEach(([key,look])=>{look.h=RELIEF[key]||0.12;look.top=LAND_COLORS[key];});

  let scene, camera, renderer, clock, sun, post;
  let atmosphereOn=true;
  let G, D, EL;
  let cb = {};
  let tileMap = {};
  let landscape = {byCell:{},regions:[]};
  const reducedMotion=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let pads = {};
  let pickables, fxGroup, ghost;
  let hoverK = null, selectedK = null, modeRef = null, stateRef = null;
  let cam, keys = {};
  let particles = [], rings = [], beams = [], sways = [], waters = [], lavas = [], bobs = [];
  let pGeo, pPos, pCol, pObj, pLife, pSize, pShape;
  let trailGeo, trailPos, trailCol;
  let intro = 1, lastRound = 1, shake = 0;
  let spellFX = [], lights = [], runeMap;
  let queuedFX = [], regionPreview = null, regionPreviewKey = '';
  const wardMats = {};
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PAD_H = 0.11, HALF = T / 2;
  const TERRAIN_BOTTOM = -0.32, BASE_BOTTOM = -0.34;
  const AXIS = [-HALF, -HALF + 0.03, -T / 3, -T / 6, 0, T / 6, T / 3, HALF - 0.03, HALF];
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
  function glow(color, opacity) {
    const key='glow|'+color+'|'+opacity;
    if(!matCache[key])matCache[key]=new THREE.SpriteMaterial({map:mats.glowMap,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});
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

  // Every tile samples the same world-space relief. No per-cell plateau or bevel.
  function cellHeight(x, z) {
    const t = stateRef && stateRef.cells[G.key(x, z)];
    return t ? (LOOK[G.TYPE[t.type].look] || LOOK.grass).h : PAD_H;
  }
  function surfaceHeight(k, x, z) {
    const [cx,cz]=G.parse(k),wx=cx+x/T,wz=cz+z/T;
    const bx=Math.floor(wx),bz=Math.floor(wz),smooth=t=>t*t*(3-2*t);
    const u=smooth(wx-bx),v=smooth(wz-bz);
    const h=THREE.MathUtils.lerp(THREE.MathUtils.lerp(cellHeight(bx,bz),cellHeight(bx+1,bz),u),THREE.MathUtils.lerp(cellHeight(bx,bz+1),cellHeight(bx+1,bz+1),u),v);
    return h + Math.sin(wx*1.13+wz*0.39)*Math.cos(wz*0.92-wx*0.25)*0.012;
  }
  // World-space shading so neighbouring tiles agree: soft occlusion in hollows, warm light on high ground.
  const WARM_HIGH=new THREE.Color(0xfff1c8);
  function shadeSurface(c,k,x,z,h) {
    const d=0.34,ring=(surfaceHeight(k,x+d,z)+surfaceHeight(k,x-d,z)+surfaceHeight(k,x,z+d)+surfaceHeight(k,x,z-d))/4;
    const occlusion=THREE.MathUtils.clamp((ring-h)*2.6,0,0.2);
    c.multiplyScalar(1-occlusion);
    return c.lerp(WARM_HIGH,THREE.MathUtils.clamp((h-0.15)*1.1,0,0.12));
  }
  function sideColor(k) {
    const t=stateRef&&stateRef.cells[k];
    return t?colTint(effectiveLook(t).side,t.attrs):new THREE.Color(0x9a7650);
  }
  function cellColor(x,z) {
    const t=stateRef&&stateRef.cells[G.key(x,z)];
    // Unclaimed cells read as a softly mown lawn so placed land stands out.
    if(!t)return new THREE.Color((x+z)&1?0xb0cd89:0xb8d593);
    return colTint((LOOK[G.TYPE[t.type].look]||LOOK.grass).top,t.attrs);
  }
  function surfaceColor(k,x,z) {
    const [cx,cz]=G.parse(k),wx=cx+x/T,wz=cz+z/T,bx=Math.floor(wx),bz=Math.floor(wz);
    const blend=t=>{const u=THREE.MathUtils.clamp((t-0.32)/0.36,0,1);return u*u*(3-2*u);};
    const u=blend(wx-bx),v=blend(wz-bz);
    return cellColor(bx,bz).lerp(cellColor(bx+1,bz),u).lerp(cellColor(bx,bz+1).lerp(cellColor(bx+1,bz+1),u),v);
  }
  function landTexture() {
    const c=document.createElement('canvas');c.width=c.height=512;
    const x=c.getContext('2d'),rnd=hashk('land-grain');x.fillStyle='#f4f3eb';x.fillRect(0,0,512,512);
    for(let i=0;i<7000;i++){
      const shade=150+Math.floor(rnd()*100);x.fillStyle=`rgba(${shade},${shade},${shade},${0.03+rnd()*0.12})`;
      x.fillRect(rnd()*512,rnd()*512,1+rnd()*4,1+rnd()*3);
    }
    for(let i=0;i<100;i++){
      x.strokeStyle='rgba(110,106,80,0.045)';x.lineWidth=1+rnd()*3;x.beginPath();const px=rnd()*512,py=rnd()*512;
      x.moveTo(px,py);x.quadraticCurveTo(px+4,py-3,px+9+rnd()*12,py+rnd()*5);x.stroke();
    }
    const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;return texture;
  }
  function terrainGeometry(k) {
    const p = [], colors = [], uv=[], ix = [], n = AXIS.length;
    const [cx,cz]=G.parse(k);
    for (const z of AXIS) for (const x of AXIS) {
      const h=surfaceHeight(k, x, z);
      p.push(x, h, z);
      const c=shadeSurface(surfaceColor(k,x,z),k,x,z,h);colors.push(c.r,c.g,c.b);uv.push((cx+x/T)/3,(cz+z/T)/3);
    }
    for (let j=0;j<n-1;j++) for(let i=0;i<n-1;i++) {
      const a=j*n+i,b=a+1,c=a+n,d=c+1; ix.push(a,c,b,b,c,d);
    }
    const topCount = ix.length;
    const perimeter = [];
    for(let i=0;i<n;i++) perimeter.push([AXIS[i],-HALF]);
    for(let i=1;i<n;i++) perimeter.push([HALF,AXIS[i]]);
    for(let i=n-2;i>=0;i--) perimeter.push([AXIS[i],HALF]);
    for(let i=n-2;i>0;i--) perimeter.push([-HALF,AXIS[i]]);
    // Cookie-cut side walls: a dark grass lip over layered soil that fades toward the base.
    const soil=sideColor(k);
    const bands=[
      [0,0.05,null,0.74],
      [0.05,0.07,soil.clone().multiplyScalar(1.08),1],
      [-0.13,null,soil,0.82],
      [TERRAIN_BOTTOM,null,soil,0.5],
    ];
    for(let i=0;i<perimeter.length;i++) {
      const a=perimeter[i],b=perimeter[(i+1)%perimeter.length];
      const ha=surfaceHeight(k,...a),hb=surfaceHeight(k,...b);
      const level=(h,band)=>band[1]==null?band[0]:h-band[1];
      for(let j=0;j<bands.length-1;j++) {
        const top=bands[j],bottom=bands[j+1],s=p.length/3;
        const ya=[level(ha,top),level(hb,top),Math.min(level(ha,top),level(ha,bottom)),Math.min(level(hb,top),level(hb,bottom))];
        p.push(a[0],ya[0],a[1],b[0],ya[1],b[1],a[0],ya[2],a[1],b[0],ya[3],b[1]);
        const tone=(band,x,z)=>(band[2]?band[2].clone():surfaceColor(k,x,z)).multiplyScalar(band[3]);
        for(const c of [tone(top,...a),tone(top,...b),tone(bottom,...a),tone(bottom,...b)])colors.push(c.r,c.g,c.b);
        uv.push(0,0,1,0,0,1,1,1); ix.push(s,s+1,s+2,s+1,s+3,s+2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    g.setIndex(ix); g.addGroup(0,topCount,0); g.addGroup(topCount,ix.length-topCount,1); g.computeVertexNormals();
    return g;
  }
  function outlineGeometry(k) {
    const p=[];
    for(let side=0;side<4;side++) for(let i=0;i<AXIS.length-1;i++) {
      for(const a of [AXIS[i],AXIS[i+1]]) {
        const x=side===0?a:side===1?HALF:side===2?-a:-HALF;
        const z=side===0?-HALF:side===1?a:side===2?HALF:-a;
        p.push(x,surfaceHeight(k,x,z)+0.004,z);
      }
    }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); return g;
  }
  function anchorChildren(group,k,h) {
    group.children.forEach(o=> {
      if(o.userData.landscape)return;
      if(o.userData.groundOffset == null) o.userData.groundOffset=o.position.y-h;
      const next=visualHeight(k,o.position.x,o.position.z)+o.userData.groundOffset;
      const delta=next-o.position.y; o.position.y=next;
      const water=waters.find(w=>w.m===o); if(water) water.y+=delta;
      const bob=bobs.find(b=>b.m===o); if(bob) { bob.y+=delta; bob.cell=k; bob.offset=bob.y-visualHeight(k,o.position.x,o.position.z); }
    });
  }
  function releaseLocalGeometry(group) {
    const shared=new Set([...Object.values(geo),...Object.values(slabCache)]),disposed=new Set();
    const sharedMats=new Set([...Object.values(matCache),...Object.values(mats)]),disposedMats=new Set();
    group.traverse(o=>{
      if(o.isInstancedMesh&&o.dispose)o.dispose();
      if(o.geometry&&!shared.has(o.geometry)&&!disposed.has(o.geometry)){o.geometry.dispose();disposed.add(o.geometry);}
      for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){if(!sharedMats.has(m)&&!disposedMats.has(m)){m.dispose();disposedMats.add(m);}}
    });
  }
  function rebuildTerrain(n) {
    n.terrain.geometry.dispose(); n.terrain.geometry=terrainGeometry(n.k);
    n.edgeLine.geometry.dispose(); n.edgeLine.geometry=outlineGeometry(n.k);
    anchorChildren(n.scenery,n.k,n.look.h); anchorChildren(n.units,n.k,n.look.h);
  }
  function baseGeometry() {
    const edges=new Map();
    const code=p=>p.join(',');
    G.SHAPE.forEach(([x,z])=> {
      const v=[[2*x-7,2*z-7],[2*x-5,2*z-7],[2*x-5,2*z-5],[2*x-7,2*z-5]];
      const ns=[[x,z-1],[x+1,z],[x,z+1],[x-1,z]];
      ns.forEach((n,i)=>{if(!G.SHAPE_KEYS.has(G.key(...n))) edges.set(code(v[i]),v[(i+1)%4]);});
    });
    const start=edges.keys().next().value, points=[]; let at=start;
    do { const p=at.split(',').map(Number); points.push(new THREE.Vector2(p[0]*T/2,-p[1]*T/2)); at=code(edges.get(at)); } while(at!==start);
    const shape=new THREE.Shape(), radius=0.07;
    points.forEach((p,i)=>{
      const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length];
      const a=p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(radius));
      const b=p.clone().add(next.clone().sub(p).normalize().multiplyScalar(radius));
      if(i===0)shape.moveTo(a.x,a.y);else shape.lineTo(a.x,a.y);
      shape.quadraticCurveTo(p.x,p.y,b.x,b.y);
    }); shape.closePath();
    // The terrain walls already extend to TERRAIN_BOTTOM. A thick base with
    // walls up to y=0 duplicates those exterior faces and causes z-fighting.
    // Close the underside with only the remaining bottom rim instead.
    const g=new THREE.ExtrudeGeometry(shape,{depth:TERRAIN_BOTTOM-BASE_BOTTOM,bevelEnabled:false,steps:1,curveSegments:3});
    g.rotateX(-Math.PI/2); g.translate(0,BASE_BOTTOM,0);
    return g;
  }
  function addBase() {
    const g=baseGeometry();
    const m=new THREE.Mesh(g,M(0x805838,{roughness:1}));m.receiveShadow=true;m.castShadow=true;scene.add(m);
  }

  function dashedFrame(color) {
    const p=[],uv=[],ix=[],r=HALF-0.015,w=0.025;
    const v=[[-r,-r],[r,-r],[r,r],[-r,r]];
    for(let side=0;side<4;side++)for(let segment=0;segment<16;segment++) {
      const from=v[side],to=v[(side+1)%4],at=t=>[from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t];
      const a=at(segment/16),b=at((segment+1)/16),s=p.length/3;
      p.push(a[0],0,a[1],b[0],0,b[1],a[0]*(1-w/r),0,a[1]*(1-w/r),b[0]*(1-w/r),0,b[1]*(1-w/r));
      uv.push(side+segment/16,0,side+(segment+1)/16,0,side+segment/16,1,side+(segment+1)/16,1);ix.push(s,s+2,s+1,s+1,s+2,s+3);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ix);
    const material=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},tint:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,depthTest:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:'varying vec2 vUv; uniform float time; uniform vec3 tint; void main(){float dash=step(0.32,fract(vUv.x*8.0-time*0.8));gl_FragColor=vec4(tint,dash*0.95);}'
    });
    const group=new THREE.Group(),band=new THREE.Mesh(g,material);group.add(band);group.userData.band=band;
    const cornerMat=new THREE.MeshBasicMaterial({color,depthTest:false,depthWrite:false,transparent:true,opacity:0.95});
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(([x,z])=>{
      const a=new THREE.Mesh(geo.box,cornerMat),b=new THREE.Mesh(geo.box,cornerMat);
      a.scale.set(0.13,0.018,0.025);a.position.set(x*(r-0.045),0,z*r);
      b.scale.set(0.025,0.018,0.13);b.position.set(x*r,0,z*(r-0.045));group.add(a,b);
    });group.userData.cornerMat=cornerMat;return group;
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
    geo.dome = new THREE.SphereGeometry(1, LOW ? 12 : 24, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.cone = new THREE.ConeGeometry(0.5, 1, 10);
    geo.cone4 = new THREE.ConeGeometry(0.5, 1, 4);
    geo.coneL = new THREE.ConeGeometry(0.5, 1, 6);
    geo.cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    geo.trunk = new THREE.CylinderGeometry(0.35, 0.5, 1, 8);
    geo.cylT = new THREE.CylinderGeometry(0.1, 0.26, 1, 16, 1, true);
    geo.octa = new THREE.OctahedronGeometry(0.5);
    geo.ico = new THREE.IcosahedronGeometry(0.5, 0);
    geo.dode = new THREE.DodecahedronGeometry(0.5, 0);
    geo.pebble=new THREE.IcosahedronGeometry(0.5,1);
    geo.foliage=new THREE.IcosahedronGeometry(0.5,2);
    geo.ecologyFoliage=new THREE.IcosahedronGeometry(0.5,1);
    geo.mountain=new THREE.LatheGeometry([new THREE.Vector2(0.5,-0.5),new THREE.Vector2(0.43,-0.35),new THREE.Vector2(0.29,-0.06),new THREE.Vector2(0.12,0.34),new THREE.Vector2(0.04,0.5),new THREE.Vector2(0,0.52)],8);
    geo.plane = new THREE.PlaneGeometry(1, 1);
    geo.circle = new THREE.CircleGeometry(0.5, 24);
    geo.ring = new THREE.RingGeometry(0.5, 0.6, 48);
    geo.ripple = new THREE.RingGeometry(0.48, 0.50, 48);
    geo.torus = new THREE.TorusGeometry(0.5, 0.12, 8, 24);
    geo.halo = new THREE.TorusGeometry(0.5, 0.06, 6, 24);
    geo.pad = padSlab(T, 0.06);
    geo.hill = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    geo.disk = new THREE.CircleGeometry(160, 48);
    geo.sprite=new THREE.Sprite().geometry;
    mats.glowMap=dotTexture();
    mats.landMap=landTexture();
    mats.ground = new THREE.MeshStandardMaterial({ color: 0x879f65, roughness: 1, map:mats.landMap });
    mats.pad = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors:true, map:mats.landMap, roughness: 0.9 });
    mats.padSide = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors:true, roughness: 0.95 });
    mats.padLegal = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors:true, map:mats.landMap, roughness: 0.9, emissive: 0x67813b, emissiveIntensity: 0.2 });
    mats.hill = new THREE.MeshStandardMaterial({ color: 0x5cb440, roughness: 1, flatShading: true });
    mats.hill2 = new THREE.MeshStandardMaterial({ color: 0x4ea838, roughness: 1, flatShading: true });
    mats.ghost = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.72, depthWrite: false, roughness: 0.5, emissive: 0x88ff66, emissiveIntensity: 0.4 });
    mats.sel = new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
    mats.tgt = new THREE.MeshBasicMaterial({ color: 0x5ad0ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
    mats.water = new THREE.MeshStandardMaterial({ color: 0x2fb0ff, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x0a4a8a, emissiveIntensity: 0.25 });
    // Stylised caustic shimmer in world space so connected lakes share one continuous pattern.
    mats.waterTime={value:0};
    mats.water.onBeforeCompile=shader=>{
      shader.uniforms.waterTime=mats.waterTime;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWaterWorld;')
        .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWaterWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float waterTime;varying vec3 vWaterWorld;')
        .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
          vec2 wq=vWaterWorld.xz*2.3;
          float c1=sin(wq.x*1.7+waterTime*1.1+sin(wq.y*1.3+waterTime*.7)*1.4);
          float c2=sin(wq.y*1.9-waterTime*.9+sin(wq.x*1.1-waterTime*.6)*1.5);
          float caustic=pow(clamp(1.0-abs(c1+c2)*.5,0.0,1.0),6.0);
          totalEmissiveRadiance+=vec3(.55,.82,1.0)*caustic*.32;`);
    };
    mats.water.customProgramCacheKey=()=>'cartoon-water-caustic';
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

  // Cloud banks use joined rounded lobes, with a soft blue underside.
  let cloudBanks=[];
  function cloudDistance(x,z) {
    let d=100;
    for(const [cx,cz] of G.SHAPE){const dx=Math.max(0,Math.abs(x-(cx-3)*T)-HALF),dz=Math.max(0,Math.abs(z-(cz-3)*T)-HALF);d=Math.min(d,Math.hypot(dx,dz));}
    return d;
  }
  function cloudGeometry(variant) {
    // Smooth union avoids the visible intersecting-ball seams of a puff stack.
    const rnd=hashk('cloud-profile-'+variant),lobes=[[-0.05,-0.22,0,1.35,0.43,0.63]];
    for(const [x,y,z,r] of [[-0.9,0.05,0.02,0.60],[-0.28,0.32,-0.04,0.76],[0.52,0.16,0.04,0.66],[1.03,-0.07,0.01,0.46],[-0.55,-0.12,0.42,0.43],[0.38,-0.15,-0.38,0.46]]){
      lobes.push([x+(rnd()-.5)*.14,y+(rnd()-.5)*.18,z,r*(.92+rnd()*.16),r*(.82+rnd()*.15),r*(.85+rnd()*.16)]);
    }
    const field=(x,y,z)=>{
      let d=10;
      for(const [px,py,pz,rx,ry,rz] of lobes){
        const v=(Math.hypot((x-px)/rx,(y-py)/ry,(z-pz)/rz)-1)*Math.min(rx,ry,rz);
        const h=Math.max(.18-Math.abs(d-v),0)/.18;d=Math.min(d,v)-h*h*.18*.25;
      }
      return d;
    };
    const points=[],normals=[],indices=[],vertices=new Map(),nx=18,ny=10,nz=10,grid=[];
    for(let z=0;z<=nz;z++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
      const p=[-1.75+x*3.5/nx,-.85+y*2.05/ny,-1+z*2/nz];grid.push({p,d:field(...p)});
    }
    const id=(x,y,z)=>(z*(ny+1)+y)*(nx+1)+x;
    const gradient=p=>{const e=.008;return new THREE.Vector3(field(p[0]+e,p[1],p[2])-field(p[0]-e,p[1],p[2]),field(p[0],p[1]+e,p[2])-field(p[0],p[1]-e,p[2]),field(p[0],p[1],p[2]+e)-field(p[0],p[1],p[2]-e)).normalize();};
    const edge=(a,b)=>{const t=a.d/(a.d-b.d);return a.p.map((v,i)=>v+(b.p[i]-v)*t);};
    const triangle=(a,b,c)=>{
      const center=a.map((v,i)=>(v+b[i]+c[i])/3),n=gradient(center);
      const ab=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),ac=new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
      if(ab.cross(ac).dot(n)<0)[b,c]=[c,b];
      for(const p of [a,b,c]){
        const key=p.map(v=>v.toFixed(6)).join(',');let index=vertices.get(key);
        if(index==null){index=points.length/3;vertices.set(key,index);points.push(...p);const normal=gradient(p);normals.push(normal.x,normal.y,normal.z);}
        indices.push(index);
      }
    };
    const tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    for(let z=0;z<nz;z++)for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
      const cube=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map(([a,b,c])=>grid[id(x+a,y+b,z+c)]);
      for(const t of tetra){
        const inside=t.map(i=>cube[i]).filter(p=>p.d<0),outside=t.map(i=>cube[i]).filter(p=>p.d>=0);
        if(inside.length===1)triangle(...outside.map(p=>edge(inside[0],p)));
        else if(inside.length===3)triangle(...inside.map(p=>edge(outside[0],p)));
        else if(inside.length===2){const [a,b]=inside,[c,d]=outside,u=edge(a,c),v=edge(a,d),w=edge(b,c),q=edge(b,d);triangle(u,v,w);triangle(v,q,w);}
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);g.computeBoundingSphere();return g;
  }
  function addHorizon() {
    scene.background=new THREE.Color(0xbacddc);scene.fog.color.setHex(0xbacddc);
    const sea=new THREE.Mesh(geo.disk,new THREE.MeshBasicMaterial({color:0xd9e6ef}));
    sea.rotation.x=-Math.PI/2;sea.position.y=-2.4;sea.scale.setScalar(3);scene.add(sea);
    const material=new THREE.ShaderMaterial({
      uniforms:{sky:{value:new THREE.Color(0xbacddc)}},
      vertexShader:'varying vec3 cloudNormal;varying float cloudHeight;varying float cloudDepth;void main(){cloudNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);cloudHeight=position.y;vec4 p=modelViewMatrix*instanceMatrix*vec4(position,1.0);cloudDepth=-p.z;gl_Position=projectionMatrix*p;}',
      fragmentShader:'varying vec3 cloudNormal;varying float cloudHeight;varying float cloudDepth;uniform vec3 sky;void main(){vec3 n=normalize(cloudNormal);float light=smoothstep(-0.4,0.85,dot(n,normalize(vec3(-0.35,0.85,0.4))));float top=smoothstep(-0.5,0.45,cloudHeight);float shade=clamp(light*0.62+top*0.38,0.0,1.0);vec3 c=mix(vec3(0.70,0.80,0.89),vec3(1.0,0.99,0.97),shade);c=mix(c,sky,smoothstep(35.0,80.0,cloudDepth)*0.65);gl_FragColor=vec4(c,1.0);}'
    });
    const rnd=hashk('rounded-cloud-banks'),batches=[[],[],[],[]];
    for(let row=0,z=-29;z<=29;z+=3.8,row++)for(let x=-29;x<=29;x+=3.8){
      const cx=x+(row%2)*1.9+(rnd()-.5)*.8,cz=z+(rnd()-.5)*.8,s=1.5+rnd()*.4;
      if(cloudDistance(cx,cz)<1.65*s+.14)continue;
      const o=new THREE.Object3D();o.position.set(cx,-1.05+(rnd()-.5)*.22,cz);o.scale.set(s,s*.78,s);o.rotation.y=.78+(rnd()-.5)*.6;o.updateMatrix();batches[Math.floor(rnd()*4)].push(o.matrix.clone());
    }
    batches.forEach((matrices,i)=>{
      const bank=new THREE.InstancedMesh(cloudGeometry(i),material,matrices.length);matrices.forEach((m,j)=>bank.setMatrixAt(j,m));bank.frustumCulled=false;scene.add(bank);cloudBanks.push(bank);
    });
  }

  // Empty cells carry a few instanced grass tufts so the unclaimed lawn is not flat squares.
  // One draw call for the whole board; tufts on claimed cells are collapsed to zero scale.
  let lawn=null;
  function updateLawn() {
    const LAWN_PER_CELL=LOW?3:5;
    if(!lawn){
      const g=new THREE.ConeGeometry(0.5,1,4);g.translate(0,0.5,0);
      lawn=new THREE.InstancedMesh(g,M(0x8fc35c,{roughness:0.9,flatShading:true}),G.SHAPE.length*LAWN_PER_CELL);
      lawn.frustumCulled=false;lawn.receiveShadow=true;scene.add(lawn);
    }
    const m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),s=new THREE.Vector3(),at=new THREE.Vector3(),tint=new THREE.Color();
    G.SHAPE.forEach(([x,z],ci)=>{
      const k=G.key(x,z),empty=!(stateRef&&stateRef.cells[k]),rnd=hashk('lawn:'+k),c=wp(k);
      for(let i=0;i<LAWN_PER_CELL;i++){
        const lx=(rnd()-0.5)*0.9,lz=(rnd()-0.5)*0.9,h=0.05+rnd()*0.05,w=0.022+rnd()*0.014,j=ci*LAWN_PER_CELL+i;
        e.set((rnd()-0.5)*0.4,rnd()*6,(rnd()-0.5)*0.4);q.setFromEuler(e);
        s.set(empty?w:0,empty?h:0,empty?w:0);at.set(c.x+lx,surfaceHeight(k,lx,lz)-0.004,c.z+lz);
        lawn.setMatrixAt(j,m.compose(at,q,s));
        const l=0.86+rnd()*0.22;lawn.setColorAt(j,tint.setRGB(l,l*1.02,l*0.9));
      }
    });
    lawn.instanceMatrix.needsUpdate=true;if(lawn.instanceColor)lawn.instanceColor.needsUpdate=true;
  }
  function addPad(k) {
    const m = new THREE.Mesh(terrainGeometry(k), [mats.pad, mats.padSide]);
    const p = wp(k);
    m.position.set(p.x, 0, p.z);
    m.receiveShadow = true;
    m.userData.k = k;
    m.userData.pad = true;
    pickables.add(m); scene.add(m);
    pads[k] = m;
  }


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
        const c = new THREE.Mesh(geo.coneL, M(i % 2 ? 0x5caa55 : 0x3d8b47, { flatShading: true }));
        c.scale.set(w * scale, h * scale, w * scale);
        c.position.y = yy * scale + h * scale * 0.5;
        c.castShadow = true;
        top.add(c);
      });
    } else {
      const greens = [0x92d457, 0x72b942, 0xb1dd64];
      [[0, 0.18, 0, 0.42], [0.1, 0.12, 0.06, 0.3], [-0.09, 0.1, -0.05, 0.28], [0.02, 0.3, -0.02, 0.28]].forEach(([px, py, pz, s], i) => {
        const b = new THREE.Mesh(still?geo.ecologyFoliage:geo.foliage, M(greens[i % 3],{roughness:0.75}));
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
    const r = new THREE.Mesh(geo.pebble, M(color || 0xc4bbae, { flatShading: true, roughness: 0.85 }));
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
    const shape=new THREE.Shape();
    for(let i=0;i<=32;i++){const a=i/32*Math.PI*2,r=(0.37+Math.sin(a*3+1)*0.025+Math.cos(a*5)*0.012)*scale;
      if(i===0)shape.moveTo(Math.cos(a)*r,Math.sin(a)*r);else shape.lineTo(Math.cos(a)*r,Math.sin(a)*r);}
    const wg=new THREE.ShapeGeometry(shape);wg.rotateX(-Math.PI/2);
    const shore=new THREE.Mesh(wg,M(look.dirty?0xbac083:0xffe2a4,{roughness:0.95}));shore.scale.set(1.15,1,1.15);shore.position.y=h+0.015;group.add(shore);
    const w = new THREE.Mesh(wg, look.dirty ? mats.dirtyW : mats.water);
    w.position.y = h + 0.025;
    group.add(w);
    waters.push({ m: w, p: rnd() * 6, y: h + 0.025 });
    if(!look.dirty)for(let i=0;i<2;i++){
      const wave=new THREE.Mesh(geo.plane,new THREE.MeshBasicMaterial({color:0xd7f8ff,transparent:true,opacity:0.42,depthWrite:false,side:THREE.DoubleSide}));
      wave.rotation.x=-Math.PI/2;wave.scale.set(0.12,0.012,1);wave.position.set(i===0?-0.06:0.08,0.006,i===0?-0.06:0.09);w.add(wave);
    }
    return w;
  }

  // Static ecological decorations are instanced by geometry/material. Large
  // regions gain branches and undergrowth without a draw call per leaf.
  function batchScenery(group) {
    group.updateMatrixWorld(true);
    const inverse=new THREE.Matrix4().copy(group.matrixWorld).invert(),batches=new Map();
    group.traverse(o=>{
      if(!o.isMesh)return;
      const key=o.geometry.uuid+':'+o.material.uuid;
      if(!batches.has(key))batches.set(key,{geometry:o.geometry,material:o.material,matrices:[],castShadow:false});
      batches.get(key).castShadow ||= o.castShadow;
      batches.get(key).matrices.push(new THREE.Matrix4().multiplyMatrices(inverse,o.matrixWorld));
    });
    group.clear();
    const leafy=new Set([geo.foliage,geo.ecologyFoliage,geo.coneL]),at=new THREE.Vector3(),tint=new THREE.Color();
    for(const b of batches.values()){
      const mesh=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);
      b.matrices.forEach((matrix,i)=>{
        mesh.setMatrixAt(i,matrix);
        if(!leafy.has(b.geometry))return;
        // Canopy variation in world space: broad sunlit/shaded patches plus per-crown jitter,
        // so a large forest reads as layered woodland rather than one flat green.
        at.setFromMatrixPosition(matrix).applyMatrix4(group.matrixWorld);
        const patch=Math.sin(at.x*0.55+1.3)*Math.cos(at.z*0.47-0.4)*0.5+0.5;
        const jitter=Math.abs(Math.sin(at.x*12.9898+at.z*78.233)*43758.5453)%1;
        const light=0.74+patch*0.2+jitter*0.1;
        tint.setRGB(light*(1.02+patch*0.05),light,light*(0.94-patch*0.06));
        mesh.setColorAt(i,tint);
      });
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      mesh.castShadow=b.castShadow&&b.geometry!==geo.trunk;mesh.receiveShadow=true;mesh.userData.landscape=true;group.add(mesh);
    }
  }
  function modelHeight(region,k,x,z) {
    const [cx,cz]=G.parse(k),wx=cx+x/T,wz=cz+z/T;
    const factor=region.family==='mountain'?1:region.family==='sand'?.26:.34;
    return surfaceHeight(k,x,z)+.012+root.Landscape.ridge(region,wx,wz)*factor;
  }
  function visualHeight(k,x,z) {
    const region=landscape.byCell[k];
    return region&&['mountain','rock','dirtyRock','sand'].includes(region.family)?modelHeight(region,k,x,z):surfaceHeight(k,x,z);
  }
  function ridgeGeometry(region,k) {
    const [cx,cz]=G.parse(k),positions=[],colors=[],normals=[],indices=[],steps=8+region.level*(LOW?2:4);
    const snow=new THREE.Color(0xf1fbff),hasSnow=region.members.some(key=>G.TYPE[stateRef.cells[key].type].look==='peak');
    const rock=new THREE.Color(region.family==='sand'?0xeac779:region.family==='dirtyRock'?0x89749e:region.family==='mountain'?(hasSnow?0x91acb9:0xbc9871):0xb9b1a4);
    for(let j=0;j<=steps;j++)for(let i=0;i<=steps;i++){
      const x=(i/steps-.5)*T,z=(j/steps-.5)*T,y=modelHeight(region,k,x,z);
      positions.push(x,y,z);
      const relative=y-surfaceHeight(k,x,z),shade=.92+Math.sin((cx+x/T)*8+(cz+z/T)*6)*.07;
      const c=rock.clone().multiplyScalar(shade);
      if(hasSnow&&region.family==='mountain')c.lerp(snow,THREE.MathUtils.smoothstep(relative,.64,.87));
      colors.push(c.r,c.g,c.b);
      const e=.001,n=new THREE.Vector3(modelHeight(region,k,x-e,z)-modelHeight(region,k,x+e,z),2*e,modelHeight(region,k,x,z-e)-modelHeight(region,k,x,z+e)).normalize();
      normals.push(n.x,n.y,n.z);
      if(i<steps&&j<steps){const a=j*(steps+1)+i,b=a+1,c=a+steps+1;indices.push(a,c,b,b,c,c+1);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);return g;
  }
  function waterGeometry(region,k,inset) {
    const [cx,cz]=G.parse(k),positions=[],steps=16;
    const distance=(x,z)=>{
      if(region.family!=='river')return root.Landscape.clearance(region,cx+x/T,cz+z/T)-inset-.018*Math.sin((cx+x/T)*9)*Math.cos((cz+z/T)*7);
      // Streams run through tile centers, joining at exactly the same edge.
      let d=Math.hypot(x,z);
      for(const neighbor of G.neighbors(k).filter(n=>landscape.byCell[n]===region)){
        const [nx,nz]=G.parse(neighbor),ax=(nx-cx)*T,az=(nz-cz)*T;
        const t=Math.max(0,Math.min(.5,(x*ax+z*az)/(T*T)));
        d=Math.min(d,Math.hypot(x-t*ax,z-t*az));
      }
      return (.14+region.level*.016)-d-inset*T;
    };
    function triangle(points){
      let clipped=[];
      for(let i=0;i<3;i++){
        const a=points[i],b=points[(i+1)%3],da=distance(...a),db=distance(...b);
        if(da>=0)clipped.push(a);
        if((da>=0)!==(db>=0)){const t=da/(da-db);clipped.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
      }
      for(let i=1;i+1<clipped.length;i++)for(const [x,z] of [clipped[0],clipped[i],clipped[i+1]])
        positions.push(x,surfaceHeight(k,x,z)+(inset>.06?.025:.017),z);
    }
    for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){
      const x=(i/steps-.5)*T,z=(j/steps-.5)*T,d=T/steps;
      triangle([[x,z],[x,z+d],[x+d,z]]);triangle([[x+d,z],[x,z+d],[x+d,z+d]]);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
  }
  function buildLandscapeScenery(group,look,k) {
    const region=landscape.byCell[k];if(!region)return false;
    const family=region.family,dirtyWater=family==='dirtyLake'&&look.dirty,rnd=hashk('ecology:'+k),count=root.Landscape.density(region,LOW);
    const ground=(x,z)=>surfaceHeight(k,x,z);
    const point=i=>{const a=i*2.399963+hashk('position:'+k+':'+i)()*.35,r=.14+Math.sqrt((i+.5)/13)*.33;return [Math.cos(a)*r,Math.sin(a)*r];};
    group.userData.region={family,size:region.size,level:region.level};
    if(['mountain','rock','dirtyRock','sand'].includes(family)){
      const mesh=new THREE.Mesh(ridgeGeometry(region,k),M(0xffffff,{vertexColors:true,roughness:.88}));
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.landscape=true;mesh.userData.k=k;group.add(mesh);
      if(family==='mountain')pickables.add(mesh);
      // Growing ranges expose additional outcrops, scree and alpine trees.
      for(let i=0;i<count;i++){
        const [x,z]=point(i),y=modelHeight(region,k,x,z);
        if(family==='sand'&&i%3===0)addCactus(group,x,y,z);
        else addRock(group,x,y,z,.065+rnd()*.065,rnd,look.dirty?0x7c6a8b:look.snow?0xbdced4:0xc2ad85);
        if(region.level>1&&family==='mountain'&&!look.snow&&i%3===0)addTree(group,x,y,z,.3,true,rnd,true);
      }
    }else if(['lake','dirtyLake','river','lava'].includes(family)){
      const shore=new THREE.Mesh(waterGeometry(region,k,.035),M(family==='lava'?0x59483b:dirtyWater?0x98a564:0xffdd92));
      const water=new THREE.Mesh(waterGeometry(region,k,.105),family==='lava'?mats.lava:dirtyWater?mats.dirtyW:mats.water);
      shore.userData.landscape=water.userData.landscape=true;group.add(shore,water);
      if(family==='lava')lavas.push(water);else waters.push({m:water,y:0,p:hashk(region.members[0])()*6});
      for(let i=0;i<count;i++){
        const [x,z]=point(i),y=ground(x,z)+.035;
        if(family==='lava')addRock(group,x,y,z,.06+rnd()*.035,rnd,0x504539);
        else if(!dirtyWater){
          if(i%2===0){const lily=new THREE.Mesh(geo.circle,M(0x58b946,{side:THREE.DoubleSide}));lily.rotation.x=-Math.PI/2;lily.scale.setScalar(.055+rnd()*.045);lily.position.set(x,y,z);group.add(lily);}
          else if(region.level>0)addFlower(group,x,y,z,i%3?0xffadc6:0xffed9e);
        }
      }
    }else if(family==='forest'||family==='meadow'){
      for(let i=0;i<count;i++){
        const [x,z]=point(i),y=ground(x,z);
        if(family==='forest'){
          const s=.48+rnd()*.15+region.level*.08;
          const tree=addTree(group,x,y,z,s,look.dense||i%3===0,rnd,true);
          if(region.level>0)for(const sign of [-1,1]){
            const branch=new THREE.Mesh(geo.trunk,M(0x8a5a2e));branch.scale.set(.038*s,.2*s,.038*s);
            branch.position.set(sign*.055*s,.22*s,0);branch.rotation.z=-sign*.8;tree.add(branch);
          }
          if(region.level>1){addTuft(group,x+.08,y,z,0x439c39,.7);addFlower(group,x-.07,y,z+.06,0xffd273);}
        }else{
          addTuft(group,x,y,z,0x58af38,.8+region.level*.12);
          addFlower(group,x+.025,y,z+.018,[0xff788b,0xffdc51,0xf7f9e1,0xbd99ef][i%4]);
          if(region.level>1&&i%4===0)addRock(group,x,y,z,.06,rnd,0xd4c396);
        }
      }
      // A border grove spans the shared edge. One owner prevents duplicates.
      for(const neighbor of G.neighbors(k).filter(n=>landscape.byCell[n]===region&&n>k)){
        const [x,z]=G.parse(k),[nx,nz]=G.parse(neighbor),px=(nx-x)*HALF,pz=(nz-z)*HALF;
        if(family==='forest')addTree(group,px,ground(px,pz),pz,.5+region.level*.08,false,rnd,true);
        else for(let i=-1;i<=1;i++)addFlower(group,px+(nz-z)*i*.09,ground(px,pz),pz+(nx-x)*i*.09,0xffed9b);
      }
    }else return false;
    // Ridges and water retain their unique geometry/animation; other static
    // meshes share a small number of draw calls instead of thousands of leaves.
    const fixed=new THREE.Group(),special=[];
    for(const o of [...group.children]){if(o.userData.landscape)special.push(o);else fixed.add(o);}
    batchScenery(fixed);fixed.children.forEach(o=>o.userData.landscape=true);
    group.clear();group.add(...special,...[...fixed.children]);return true;
  }
  function rebuildScenery(node) {
    node.scenery.traverse(o=>{if(o.isMesh)pickables.delete(o);});
    const oldObjects=new Set();node.scenery.traverse(o=>oldObjects.add(o));
    sways=sways.filter(o=>!oldObjects.has(o.m));waters=waters.filter(o=>!oldObjects.has(o.m));lavas=lavas.filter(o=>!oldObjects.has(o));
    releaseLocalGeometry(node.scenery);node.scenery.clear();
    buildScenery(node.scenery,node.look,node.k,node.look.h);anchorChildren(node.scenery,node.k,node.look.h);
    if(node.frame)fitFrame(node);
  }
  function fitFrame(node) {
    const p=node.frame.userData.band.geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setY(i,visualHeight(node.k,p.getX(i),p.getZ(i))+.055);
    p.needsUpdate=true;
    node.frame.children.slice(1).forEach(c=>c.position.y=visualHeight(node.k,c.position.x,c.position.z)+.055);
    node.frame.position.y=0;
  }
  function buildScenery(group, look, k, h) {
    if(buildLandscapeScenery(group,look,k))return;
    const rnd = hashk(k);
    const kind = look.kind;
    const R = () => (rnd() - 0.5) * 0.6;
    if (kind === 'forest') {
      const n = look.dense ? 6 : 4;
      for (let i = 0; i < n; i++) {
        const a=i/n*Math.PI*2, r=0.18+rnd()*0.11;
        addTree(group,Math.cos(a)*r,h,Math.sin(a)*r,0.52+rnd()*0.24,look.dense||i%2===0,rnd);
      }
      addTuft(group, R(), h, R(), 0x4aa830, 1);
    } else if (kind === 'peak') {
      const m = new THREE.Mesh(geo.mountain, M(look.snow ? 0x91b4c9 : 0xbc9871, { flatShading: true, roughness: 0.8 }));
      const ph = look.snow ? 0.75 : 0.45;
      m.scale.set(0.62, ph, 0.62);
      m.position.set(0.02, h + ph / 2, 0);
      m.rotation.y = rnd() * 3;
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
      const foothill=new THREE.Mesh(geo.pebble,M(look.snow?0xa9c8d3:0xd2ad7c,{flatShading:true,roughness:0.9}));
      foothill.scale.set(0.65,0.20,0.64);foothill.position.set(0,h+0.05,0.02);group.add(foothill);
      const sidePeak=new THREE.Mesh(geo.mountain,m.material);sidePeak.scale.set(0.32,ph*0.55,0.34);sidePeak.position.set(-0.19,h+ph*0.275,0.16);sidePeak.rotation.y=m.rotation.y+0.8;group.add(sidePeak);
      if (look.snow) {
        const s = new THREE.Mesh(geo.mountain, M(0xf1fcff, { flatShading: true, roughness: 0.65 }));
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
    // Ruins, mines and dry/polluted ground keep their recognizable landmarks,
    // but gain connected stone paths and increasingly layered local details.
    const region=landscape.byCell[k];
    if(region){
      const detail=root.Landscape.density(region,LOW),extra=new THREE.Group();
      for(let i=0;i<detail;i++){
        const x=R()*1.4,z=R()*1.4,y=surfaceHeight(k,x,z);
        addRock(extra,x,y,z,.045+rnd()*.04,rnd,look.dirty?0x857754:0xcab58e);
        if(region.level&&i%3===0){
          if(look.kind==='ruin'){
            const column=new THREE.Mesh(geo.cyl,M(0xc9bea1));column.scale.set(.045,.12+region.level*.04,.045);column.position.set(x,y+column.scale.y/2,z);extra.add(column);
          }else addTuft(extra,x,y,z,look.dirty?0x858e36:0xa8ab51,.65+region.level*.12);
        }
      }
      if(['mine','ruin'].includes(region.family)){
        const positions=[];
        for(const neighbor of G.neighbors(k).filter(n=>landscape.byCell[n]===region)){
          const [x,z]=G.parse(k),[nx,nz]=G.parse(neighbor),dx=nx-x,dz=nz-z,w=.065;
          const p=[[dz*w,-dx*w],[dx*HALF+dz*w,dz*HALF-dx*w],[-dz*w,dx*w],[dx*HALF-dz*w,dz*HALF+dx*w]];
          for(const i of [0,2,1,1,2,3])positions.push(p[i][0],surfaceHeight(k,...p[i])+.024,p[i][1]);
        }
        if(positions.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();const path=new THREE.Mesh(g,M(0xcbb997,{roughness:1}));path.userData.landscape=true;group.add(path);}
      }
      batchScenery(extra);group.add(...[...extra.children]);
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
    } else if (['crop','wheat','corn'].includes(p.kind)) {
      const g = new THREE.Group();
      g.position.set(x, h, z);
      for (let i = 0; i < 5; i++) {
        const s = new THREE.Mesh(geo.cyl, M(0xc8a030)); s.scale.set(0.012, 0.13, 0.012);
        const ox = (i % 3 - 1) * 0.04, oz = (i > 2 ? 0.04 : -0.02);
        s.position.set(ox, 0.065, oz);
        const ear = new THREE.Mesh(geo.sphL, M(p.kind==='corn'?0xffc52e:p.kind==='wheat'?0xdab061:0xffd040)); ear.scale.set(0.03, 0.06, 0.03); ear.position.set(ox, 0.15, oz);
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

  function effectiveLook(t) {
    const look=LOOK[G.TYPE[t.type].look]||LOOK.grass;
    return look.dirty&&!t.attrs.some(v=>v<0)?Object.assign({},look,{dirty:0}):look;
  }
  function signature(t, k) {
    return t.type + '|' + t.attrs.join(',') + '|' + t.spirits.map(s => s.el).join('') + '|' + t.beasts.map(b => b.el).join('') +
      '|' + (t.guardians||[]).map(g=>g.id+':'+Object.values(g.power).join(',')).join(';') + '|' + t.plants.map(p => p.kind).join('') + '|' + t.animals.map(a => a.kind + (a.el || '')).join('') +
      '|' + t.ores.join('') + '|' + (t.spring ? 1 : 0) + (t.shelter ? 1 : 0) + '|' + [t.pond,t.farm,t.vein,t.oasis].join(',') + '|' + (t.cancers||[]).map(c=>c.el).join(',') + '|' + (stateRef.shields||[]).filter(sh=>sh.cells.includes(k)).map(sh=>sh.id+':'+Object.values(sh.defense).join(',')).join(';');
  }

  function rebuildUnits(node, t, h) {
    const g = node.units;
    releaseLocalGeometry(g);
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
    if((stateRef.shields||[]).some(sh=>sh.cells.includes(node.k))){
      const ward=new THREE.Group();ward.position.set(0,h+0.05,0);
      const defense=(stateRef.shields||[]).filter(sh=>sh.cells.includes(node.k)).reduce((a,sh)=>{EL.forEach(e=>a[e.key]=(a[e.key]||0)+sh.defense[e.key]);return a;},{});
      const main=EL.reduce((a,b)=>defense[b.key]>defense[a.key]?b:a,EL[0]);
      const dome=new THREE.Mesh(geo.dome,wardMaterial(ELC[main.key]));dome.scale.set(0.53,0.68,0.53);ward.add(dome);
      const marker=new THREE.Mesh(geo.octa,M(0x8bd8de,{emissive:0x3a858b,emissiveIntensity:0.15}));marker.scale.set(0.09,0.12,0.07);marker.position.set(-0.36,0.08,-0.36);ward.add(marker);
      for(const [x,z] of [[-0.42,-0.42],[0.42,-0.42],[0.42,0.42],[-0.42,0.42]]){const post=new THREE.Mesh(geo.box,M(0xa5dfd4));post.scale.set(0.025,0.1,0.025);post.position.set(x,0.04,z);ward.add(post);}g.add(ward);
    }
    if(t.pond&&!t.spring){
      const lake=new THREE.Mesh(geo.circle,mats.water);lake.rotation.x=-Math.PI/2;lake.scale.set(0.25,0.18,1);lake.position.set(-0.18,h+0.02,0.05);g.add(lake);
      const bank=new THREE.Mesh(geo.torus,M(0xe9d5a0));bank.rotation.x=Math.PI/2;bank.scale.set(0.16,0.12,0.012);bank.position.copy(lake.position);g.add(bank);
    }
    if(t.vein){const vein=new THREE.Mesh(geo.octa,M(0xe3b857,{metalness:0.35,roughness:0.5}));vein.scale.set(0.13,0.1,0.13);vein.position.set(0.22,h+0.05,-0.22);g.add(vein);}
    if(t.farm){for(let i=0;i<3;i++){const furrow=new THREE.Mesh(geo.box,M(0xb9864f));furrow.scale.set(0.32,0.025,0.045);furrow.position.set(0,h+0.015,-0.22+i*0.09);g.add(furrow);}}
    (t.cancers||[]).slice(0,8).forEach((c,i)=>{
      const orb=new THREE.Group(),body=new THREE.Mesh(geo.sph,M(0x6d537f,{emissive:0x542955,emissiveIntensity:0.12}));body.scale.set(0.085,0.1,0.08);orb.add(body);
      for(const x of [-0.026,0.026]){const eye=new THREE.Mesh(geo.sph,M(0xffe2a3));eye.scale.setScalar(0.018);eye.position.set(x,0.025,0.067);orb.add(eye);}
      // A faint toxic haze makes infection readable at board zoom without hiding the terrain.
      if(i<4){const haze=new THREE.Sprite(glow(0x9a5cc4,LOW?0.22:0.3));haze.scale.setScalar(0.3);orb.add(haze);}
      const y=h+0.22+(i%2)*0.08;g.add(orb);bobs.push({m:orb,y,p:i*1.5,a:0.025,orbit:0.28,sp:0.45,spin:0.3});
    });
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
    t.spirits.slice(0,18).forEach((s, i) => {
      const sg = new THREE.Group();
      const core = new THREE.Mesh(geo.octa, M(ELC[s.el], { emissive: ELC[s.el], emissiveIntensity: 0.45,metalness:0.2,roughness:0.35,flatShading:true }));
      core.scale.set(0.055,0.08,0.055);sg.add(core);
      if(i<8){const halo=new THREE.Sprite(glow(ELC[s.el],LOW?0.45:0.6));halo.scale.setScalar(0.24);sg.add(halo);}
      const y = h + 0.28 + (i % 3) * 0.055;
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
      const aura = new THREE.Sprite(glow(ELC[b.el], 0.28)); aura.scale.setScalar(0.5);
      bg.add(crystal, inner, ring, aura);
      const y = h + 0.75 + i * 0.2;
      bg.position.set(0, y, 0);
      g.add(bg);
      bobs.push({ m: bg, y, p: i, a: 0.07, spin: 1.2 });
    });
    (t.guardians||[]).slice(0,6).forEach((guardian,i)=>{
      const altar=new THREE.Group(),a=i*Math.PI*2/Math.max(1,t.guardians.length),r=t.guardians.length>1?.24:0;
      altar.position.set(Math.cos(a)*r,h,Math.sin(a)*r);altar.userData.guardianId=guardian.id;
      const foot=new THREE.Mesh(geo.cyl,M(0xe5c893,{roughness:.9}));foot.scale.set(.2,.065,.2);foot.position.y=.035;altar.add(foot);
      const halo=new THREE.Mesh(geo.torus,M(0xffd873,{emissive:0xe2a93b,emissiveIntensity:.18}));halo.rotation.x=Math.PI/2;halo.scale.set(.27,.27,.27);halo.position.y=.17;altar.add(halo);
      const core=new THREE.Mesh(geo.octa,M(0xfff2c8,{emissive:0xffe9a1,emissiveIntensity:.3,roughness:.3}));core.scale.set(.18,.3,.18);core.position.y=.38;altar.add(core);
      const colors=EL.flatMap(e=>Array(guardian.power[e.key]||0).fill(ELC[e.key]));
      colors.forEach((color,j)=>{const orb=new THREE.Mesh(geo.ico,M(color,{emissive:color,emissiveIntensity:.2}));const angle=j*Math.PI*2/5;orb.scale.setScalar(.095);orb.position.set(Math.cos(angle)*.27,.34+Math.sin(angle)*.05,Math.sin(angle)*.27);altar.add(orb);});
      g.add(altar);if(!reduced())bobs.push({m:core,y:.38,p:i,a:.015,spin:.35,guardian:true});
    });
  }

  function makeTile(k, t, animate) {
    const look = effectiveLook(t);
    const group = new THREE.Group();
    const p = wp(k);
    group.position.set(p.x, animate ? 2.2 : 0, p.z);
    const h = look.h;
    const terrain = new THREE.Mesh(terrainGeometry(k), [ownMat(0xffffff, { vertexColors: true,map:mats.landMap }), ownMat(0xffffff, { vertexColors: true, roughness: 0.95 })]);
    terrain.castShadow = true;
    terrain.receiveShadow = true;
    terrain.userData.k = k;
    group.add(terrain);
    // 顶面描边（分割感）
    const edgeLine = new THREE.LineSegments(outlineGeometry(k), new THREE.LineBasicMaterial({ color: 0x726850, transparent: true, opacity: 0.28 }));
    group.add(edgeLine);
    const scenery = new THREE.Group();
    group.add(scenery);
    buildScenery(scenery, look, k, h);
    scenery.traverse(o => { if (o.isMesh && !o.userData.landscape && !o.material.transparent && o.geometry !== geo.circle) o.castShadow = true; });
    const units = new THREE.Group();
    group.add(units);
    const node = { k, group, terrain, units, scenery, edgeLine, look, sceneryKey:t.type+':'+t.attrs.some(v=>v<0), sig: '', scenerySig:scenerySignature(k), rise: animate && !reducedMotion() ? 1 : 0, lift: 0 };
    node.sig = signature(t,k);
    rebuildUnits(node, t, h);
    anchorChildren(scenery,k,h); anchorChildren(units,k,h);
    pickables.add(terrain);
    scene.add(group);
    tileMap[k] = node;
    if (pads[k]) pads[k].visible = false;
  }

  function removeTile(k) {
    const n = tileMap[k];
    if (!n) return;
    scene.remove(n.group);
    const oldObjects=new Set();n.group.traverse(o=>oldObjects.add(o));
    sways=sways.filter(o=>!oldObjects.has(o.m));waters=waters.filter(o=>!oldObjects.has(o.m));bobs=bobs.filter(o=>!oldObjects.has(o.m));lavas=lavas.filter(o=>!oldObjects.has(o));
    n.scenery.traverse(o=>{if(o.isMesh)pickables.delete(o);});
    releaseLocalGeometry(n.scenery); releaseLocalGeometry(n.units);
    n.terrain.geometry.dispose(); n.edgeLine.geometry.dispose(); n.edgeLine.material.dispose();
    if(n.frame) { n.frame.userData.band.geometry.dispose(); n.frame.userData.band.material.dispose(); n.frame.userData.cornerMat.dispose(); }
    n.terrain.material.forEach(m => m.dispose());
    pickables.delete(n.terrain);
    delete tileMap[k];
    if (pads[k]) pads[k].visible = true;
  }

  function updateTile(n, t) {
    const sig = signature(t,n.k);
    if (sig === n.sig) return;
    n.sig = sig;
    const look = effectiveLook(t);
    const sceneryKey=t.type+':'+t.attrs.some(v=>v<0);
    n.look=look;
    if(sceneryKey!==n.sceneryKey){
      rebuildScenery(n);n.sceneryKey=sceneryKey;
    }
    n.previousColor = new THREE.Color(0x797554);
    rebuildUnits(n, t, look.h);
    anchorChildren(n.units,n.k,look.h);
    n.pop = 1;   // 变化时轻弹一下
  }

  function ensureGhost() {
    if (ghost) return;
    ghost = new THREE.Mesh(tileSlab(1.02, 0.14), mats.ghost);
    ghost.visible = false;
    scene.add(ghost);
  }

  // ---------- 特效 ----------
  function scenerySignature(k) {
    const [x,z]=G.parse(k),neighbors=[];
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)neighbors.push(stateRef.cells[G.key(x+dx,z+dz)]?.type||'-');
    return landscape.byCell[k].signature+'@'+neighbors.join(',');
  }
  function regionGrowth(event) {
    const {origin,milestone}=event,region=landscape.byCell[origin];
    if(!region||region.family!==event.region.family)return;
    if(cb.onRegionGrowth)cb.onRegionGrowth({cell:origin,name:region.name,size:region.size,level:region.level,milestone,merged:event.merged});
    if(reducedMotion())return;
    const distances=new Map([[origin,0]]),queue=[origin];
    for(let i=0;i<queue.length;i++)for(const k of G.neighbors(queue[i]))if(landscape.byCell[k]===region&&!distances.has(k)){distances.set(k,distances.get(queue[i])+1);queue.push(k);}
    queue.slice(0,LOW?12:24).forEach(k=>{
      const n=tileMap[k];if(!n)return;
      n.growth={t:-distances.get(k)*.075,milestone,family:region.family};
    });
    flashLight(wp(origin,visualHeight(origin,0,0)+.2),region.family==='lake'?0x57caff:0xbafa70);
    shake=Math.max(shake,milestone?.07:.025);
  }
  function spawnBurst(pos, color, n, speed, life, up, style) {
    if(reducedMotion())return;
    const c = new THREE.Color(color);
    n = Math.ceil(n * (LOW ? 0.5 : 1));
    for (let i = 0; i < n && particles.length < (LOW ? 400 : 800); i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * speed;
      particles.push({
        p: pos.clone(), prev: pos.clone(),
        v: new THREE.Vector3(Math.cos(a) * r, (up || 0.9) * (Math.random() * speed + 0.4), Math.sin(a) * r),
        life: life * (0.7 + Math.random() * 0.5), max: life, c,
        style:style||'spark',size:style==='dust'?0.22+Math.random()*0.12:style==='water'?0.06+Math.random()*0.05:0.055+Math.random()*0.055,
      });
      const p=particles[particles.length-1];p.expires=performance.now()/1000+p.life;
    }
  }
  function spawnRing(pos, color, size) {
    const m = new THREE.Mesh(geo.ripple, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, fog: false,
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    fxGroup.add(m);
    rings.push({ m, t: 0, born:performance.now()/1000, life: 0.6, size: size || 1.1 });
  }
  function spawnBeam(pos, color) {
    const m = new THREE.Mesh(geo.cylT, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    }));
    m.position.copy(pos);
    m.position.y += 0.9;
    m.scale.set(0.13, 1.8, 0.13);
    fxGroup.add(m);
    beams.push({ m, t: 0, born:performance.now()/1000, life: 0.6 });
  }

  function transient(m, life, update, delay) {
    if(spellFX.length>=(LOW?180:360))disposeFX(spellFX.shift().m);
    fxGroup.add(m);m.visible=!delay;update(0);spellFX.push({m,t:-(delay||0),born:performance.now()/1000+(delay||0),life,update});return m;
  }
  function disposeFX(m) {
    if(m.parent)m.parent.remove(m);
    m.material.dispose();if(m.userData.ownGeometry)m.geometry.dispose();
  }
  function scheduleFX(delay, run) { if(queuedFX.length>=(LOW?80:160))queuedFX.shift();queuedFX.push({at:performance.now()/1000+delay,run}); }
  function wardMaterial(color) {
    if(!wardMats[color])wardMats[color]=new THREE.ShaderMaterial({
      uniforms:{time:{value:0},tint:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
      vertexShader:'varying vec2 vUv;varying vec3 vNormal;varying vec3 vEye;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vEye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:'varying vec2 vUv;varying vec3 vNormal;varying vec3 vEye;uniform vec3 tint;uniform float time;void main(){vec2 p=vUv*vec2(20.,7.),h=vec2(1.732,1.);vec2 a=mod(p,h)-h*.5,b=mod(p-h*.5,h)-h*.5;vec2 q=abs(dot(a,a)<dot(b,b)?a:b);float grid=smoothstep(.44,.5,max(dot(q,vec2(.866,.5)),q.y));float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vEye))),2.);float sweep=pow(max(0.,1.-abs(vUv.y-fract(time*.18))/.08),2.);gl_FragColor=vec4(tint,.022+grid*.075+rim*.3+sweep*.045);}'
    });return wardMats[color];
  }
  // A single batched outer contour: no interior seams between connected cells.
  function regionMesh(cells,color,opacity) {
    const set=new Set(cells),p=[],ix=[];
    for(const k of cells){const [cx,cz]=G.parse(k),o=wp(k);
      const edges=[[-1,0,[[-HALF,-HALF],[-HALF,HALF],[-HALF+.04,-HALF],[-HALF+.04,HALF]]],[1,0,[[HALF,HALF],[HALF,-HALF],[HALF-.04,HALF],[HALF-.04,-HALF]]],[0,-1,[[HALF,-HALF],[-HALF,-HALF],[HALF,-HALF+.04],[-HALF,-HALF+.04]]],[0,1,[[-HALF,HALF],[HALF,HALF],[-HALF,HALF-.04],[HALF,HALF-.04]]]];
      for(const [dx,dz,points] of edges)if(!set.has(G.key(cx+dx,cz+dz))){const n=p.length/3;for(const [x,z] of points)p.push(o.x+x,visualHeight(k,x,z)+.075,o.z+z);ix.push(n,n+2,n+1,n+1,n+2,n+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);
    const m=new THREE.Mesh(g,fxMaterial(color,opacity));m.material.depthTest=false;m.renderOrder=3;m.userData.ownGeometry=true;m.userData.cells=cells;return m;
  }
  function clusterPulse(cell) {
    const cells=G.cluster(stateRef,cell);if(cells.length<2)return;
    const color=0xcfff78,origin=wp(cell),edge=regionMesh(cells,color,.9);
    transient(edge,reduced()?.35:1.65,u=>{edge.material.opacity=(1-u)*(.45+.4*Math.sin(u*Math.PI));});
    if(!reduced())for(const k of cells){const n=tileMap[k];if(!n)continue;
      const p=wp(k),delay=Math.min(1.1,p.distanceTo(origin)*.10);
      const overlay=new THREE.Mesh(n.terrain.geometry,new THREE.ShaderMaterial({uniforms:{progress:{value:0},tint:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,side:THREE.DoubleSide,
        vertexShader:'varying vec2 vPos;void main(){vPos=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:'varying vec2 vPos;uniform float progress;uniform vec3 tint;void main(){float band=max(0.,1.-abs(length(vPos)-progress*.9)/.16);gl_FragColor=vec4(tint,band*(1.-progress)*.5);}'
      }));transient(overlay,.85,u=>{overlay.material.uniforms.progress.value=u;},delay);n.group.add(overlay);
      scheduleFX(delay,()=>{spawnBurst(wp(k,visualHeight(k,0,0)+.15),color,LOW?3:5,.2,.7,.7);if(tileMap[k])tileMap[k].impact=.3;});
    }
    if(cb.onLink)cb.onLink(cells.length,cell);
  }
  function impact(cell,color,damage,index) {
    const pos=wp(cell,visualHeight(cell,0,0)+.06),blocked=damage<3;
    if(blocked)shieldImpact(cell,color);
    if(!reduced()){
      spawnBurst(pos,blocked?0xc6faff:color,blocked?12:18,.7,.7,1.1,blocked?'spark':'shard');
      if(damage)spawnBurst(pos,0xb9a18c,10,.75,.85,.32,'dust');
      const ring=new THREE.Mesh(geo.ring,fxMaterial(blocked?0xb4f4ff:color,.8));ring.position.copy(pos);ring.rotation.x=-Math.PI/2;
      transient(ring,.6,u=>{ring.scale.setScalar(.2+u*1.5);ring.material.opacity=(1-u)*.7;});
      shake=Math.max(shake,LOW?.045:.10);flashLight(pos,color);if(tileMap[cell])tileMap[cell].impact=.4;
    }
    if(cb.onImpact&&index%3===0)cb.onImpact(blocked);
  }
  function shieldImpact(cell,color) {
    const quiet=reduced(),pos=wp(cell,visualHeight(cell,0,0)+.03),m=new THREE.Mesh(geo.dome,fxMaterial(color||0x99e6ff,.28));m.position.copy(pos);
    transient(m,quiet?.3:.8,u=>{const v=quiet?0:u;m.scale.set(.53+v*.13,.68+v*.10,.53+v*.13);m.material.opacity=(1-u)*.32;});
    if(!quiet)for(let i=0;i<(LOW?4:8);i++){const a=i*Math.PI*2/(LOW?4:8),shard=new THREE.Mesh(geo.octa,fxMaterial(0xc4fbff,.8));shard.scale.setScalar(.1);transient(shard,.6,u=>{shard.position.set(pos.x+Math.cos(a)*(.35+u*.4),pos.y+.3+Math.sin(u*Math.PI)*.3,pos.z+Math.sin(a)*(.35+u*.4));shard.rotation.y=u*6;shard.material.opacity=1-u;});}
  }
  function meteorRain(events) {
    if(!events.length)return;
    const color=ELC[events[0].el]||0xffaa66;
    for(let i=0;i<events.length;i++){
      const e=events[i],pos=wp(e.cell,visualHeight(e.cell,0,0)+.07),delay=reduced()?0:.42+Math.min(1.35,i*.075);
      const warning=regionMesh([e.cell],color,.7);transient(warning,reduced()?.25:delay+.72,u=>{warning.material.opacity=reduced()?(1-u)*.5:.25+Math.sin(u*22)*.25;});
      if(reduced()){impact(e.cell,color,e.damage,i);continue;}
      const start=pos.clone().add(new THREE.Vector3(-1.9,3.5,-.85)),direction=start.clone().sub(pos).normalize();
      const head=new THREE.Mesh(geo.ico,fxMaterial(color,1));head.scale.setScalar(.30);
      const core=new THREE.Mesh(geo.sph,fxMaterial(0xfff7d0,1));core.scale.setScalar(.19);
      const tail=new THREE.Mesh(geo.cylT,new THREE.ShaderMaterial({uniforms:{tint:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader:'varying vec2 vUv;uniform vec3 tint;void main(){gl_FragColor=vec4(tint*1.25,pow(1.-vUv.y,1.4)*.7);}'
      }));tail.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
      for(const [m,isTail] of [[head,false],[core,false],[tail,true]])transient(m,.72,u=>{
        const t=u*u;m.position.copy(start).lerp(pos,t);
        if(isTail){m.position.addScaledVector(direction,.6);m.scale.set(.7,1.25,.7);m.material.opacity=.6+u*.2;}else if(m===head)m.rotation.set(u*4,u*7,0);
      },delay);
      scheduleFX(delay+.72,()=>impact(e.cell,color,e.damage,i));
    }
  }
  function shieldDeploy(shield) {
    const main=EL.reduce((a,b)=>shield.defense[b.key]>shield.defense[a.key]?b:a,EL[0]),color=ELC[main.key];
    const edge=regionMesh(shield.cells,color,.95);transient(edge,reduced()?.35:1.5,u=>{edge.material.opacity=(1-u)*.85;});
    shield.cells.forEach((k,i)=>scheduleFX(reduced()?0:Math.min(.7,i*.075),()=>{shieldImpact(k,color);if(!reduced())rune(wp(k,visualHeight(k,0,0)+.07),color);}));
  }
  function guardianFX(event) {
    const guardian=(stateRef.cells[event.cell]?.guardians||[]).find(g=>g.id===event.guardianId);
    const power=event.power||(guardian&&guardian.power);if(!power)return;
    const colors=EL.filter(e=>power[e.key]).map(e=>ELC[e.key]),quiet=reduced();
    const cells=event.targets||G.guardianArea(stateRef,event.cell),pos=wp(event.cell,surfaceHeight(event.cell,0,0)+.09);
    const edge=regionMesh(cells,0xffd873,.8);transient(edge,quiet?.4:event.kind==='guardianMerge'?1.4:.9,u=>{edge.material.opacity=(1-u)*.7;});
    if(quiet)return;
    if(event.kind==='guardianMerge'){
      rune(pos,0xffd873);flashLight(pos,0xffe8a5);
      for(let i=0;i<5;i++){const color=EL.flatMap(e=>Array(power[e.key]||0).fill(ELC[e.key]))[i],m=new THREE.Mesh(geo.octa,fxMaterial(color,.8));
        transient(m,1,u=>{const r=(1-u)*.7,a=i*Math.PI*2/5+u*4;m.position.set(pos.x+Math.cos(a)*r,pos.y+.2+u*.65,pos.z+Math.sin(a)*r);m.scale.setScalar(.12*(1-u)+.035);m.rotation.y=u*8;});}
    }else if(event.kind==='guardianMove'&&event.from){
      const start=wp(event.from,surfaceHeight(event.from,0,0)+.3),m=new THREE.Mesh(geo.octa,fxMaterial(0xffe5a2,.8));
      transient(m,.5,u=>{m.position.copy(start).lerp(pos,u);m.position.y+=Math.sin(u*Math.PI)*.45;m.scale.setScalar(.15*(1-u)+.06);m.material.opacity=(1-u)*.8;});
    }
    cells.forEach((k,i)=>scheduleFX(i*.045,()=>{const p=wp(k,surfaceHeight(k,0,0)+.1);colors.forEach(color=>spawnBurst(p,color,LOW?2:3,.25,.45,.55));}));
  }
  function fxMaterial(color, opacity) {
    return new THREE.MeshBasicMaterial({color,transparent:true,opacity:opacity==null?0.8:opacity,depthWrite:false,side:THREE.DoubleSide});
  }
  function runeTexture() {
    if(runeMap)return runeMap;
    const c=document.createElement('canvas');c.width=c.height=256;
    const x=c.getContext('2d');x.strokeStyle='#fff';x.lineWidth=3;
    for(const r of [80,104,116]){x.beginPath();x.arc(128,128,r,0,Math.PI*2);x.stroke();}
    for(let i=0;i<12;i++){
      x.save();x.translate(128,128);x.rotate(i*Math.PI/6);x.beginPath();x.moveTo(86,-6);x.lineTo(100,0);x.lineTo(86,6);x.moveTo(92,-9);x.lineTo(92,9);x.stroke();x.restore();
    }
    x.beginPath();for(let i=0;i<=6;i++){const a=i*Math.PI*2/3;x.lineTo(128+70*Math.cos(a),128+70*Math.sin(a));}x.stroke();
    runeMap=new THREE.CanvasTexture(c);return runeMap;
  }
  function spellOpening(pos,color,size) {
    if(reducedMotion())return;
    size=size||1;
    const flare=new THREE.Sprite(new THREE.SpriteMaterial({map:mats.glowMap,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false}));
    flare.position.copy(pos);flare.position.y+=0.25;
    transient(flare,0.55,u=>{flare.scale.setScalar((0.4+Math.sin(Math.min(1,u*2.2)*Math.PI/2)*1.3)*size);flare.material.opacity=(1-u)*(1-u)*0.75;});
    const wave=new THREE.Mesh(geo.ring,fxMaterial(color,0.6));wave.material.blending=THREE.AdditiveBlending;wave.rotation.x=-Math.PI/2;wave.position.copy(pos);wave.position.y+=0.02;
    transient(wave,0.7,u=>{const e=1-Math.pow(1-u,3);wave.scale.setScalar((0.3+e*1.5)*size);wave.material.opacity=(1-u)*0.55;},0.05);
  }
  function rune(pos,color) {
    const m=new THREE.Mesh(geo.plane,fxMaterial(color));m.material.map=runeTexture();m.rotation.x=-Math.PI/2;m.position.copy(pos);m.position.y+=0.015;
    m.material.blending=THREE.AdditiveBlending;
    transient(m,1.0,u=>{const e=1-Math.pow(1-Math.min(1,u*3),3);m.scale.setScalar(0.25+e*1.05);m.rotation.z=u*0.9;m.material.opacity=Math.min(1,u*6)*(1-u)*0.62;});
  }
  function flashLight(pos,color) {
    if(LOW)return;
    const slot=lights.find(f=>f.t>=0.4)||lights[0];
    slot.m.color.setHex(color);slot.m.position.copy(pos);slot.m.position.y+=0.5;slot.m.intensity=0.18;slot.t=0;slot.born=performance.now()/1000;
  }
  function burstAt(cell,color) {
    if(!stateRef||!G.SHAPE_KEYS.has(cell))return;
    spawnBurst(wp(cell,visualHeight(cell,0,0)+0.18),color||0xe7cf8e,3,0.2,0.35,0.7);
  }
  function fx(kind,cell,extra) {
    if(!cell||!G.SHAPE_KEYS.has(cell))return;
    const pos=wp(cell,visualHeight(cell,0,0)+0.035),n=tileMap[cell];
    const map={place:0xffe066,purify:0xfff5cf,mine:0xffcc22,spring:0x38c0ff,rich:0x79e84b,burn:0xff5a1a,merge:ELC[extra]||0xffffff,crystal:ELC[extra]||0xffffff,charm:0xfff4c0,shelter:0xffffff,infection:0x9d71b2,meteor:ELC[extra]||0xd69a67,shield:0x87d9e3,upgrade:0x8aca66};
    const c=map[kind]||0xffffff;
    if(kind==='meteor'){
      meteorRain([{cell,el:extra,damage:3}]);return;
    }
    if(kind==='shield'){
      shieldImpact(cell,ELC[extra]||0x8bd8de);return;
    }
    if(reduced()){if(kind==='place')clusterPulse(cell);return;}
    if(kind==='infection'){
      spawnBurst(pos,0x9d71b2,9,.35,.75,.45,'dust');
      for(let i=0;i<3;i++){const m=new THREE.Mesh(geo.octa,fxMaterial(0xc9a4e8,.65));transient(m,.8,u=>{const a=u*6+i*Math.PI*2/3;m.position.set(pos.x+Math.cos(a)*(.4-u*.3),pos.y+u*.5,pos.z+Math.sin(a)*(.4-u*.3));m.scale.setScalar(.14*(1-u));m.material.opacity=1-u;});}return;
    }
    if(kind==='upgrade'){
      const edge=regionMesh([cell],0xffe894,.9);transient(edge,1.25,u=>{edge.material.opacity=1-u;});
      spawnBeam(pos,0xcfff86);spawnBurst(pos,0xffe8a0,28,.65,1.1,1.5);flashLight(pos,0xf5e8a3);if(n)n.pop=1;
      for(let i=0;i<6;i++){const m=new THREE.Mesh(geo.octa,fxMaterial(i%2?0xa4ec67:0xffefb2,.8)),a=i*Math.PI/3;transient(m,1.05,u=>{m.position.set(pos.x+Math.cos(a+u*2)*(.5-u*.15),pos.y+.1+u*1.2,pos.z+Math.sin(a+u*2)*(.5-u*.15));m.scale.setScalar(.13*(1-u));m.rotation.y=u*7;m.material.opacity=1-u;});}clusterPulse(cell);return;
    }
    if(kind==='place'){
      if(n&&n.rise>0)return;
      spawnBurst(pos,0xc9b896,12,0.65,0.7,0.18,'dust');
      spawnBurst(pos,0x8d7150,8,0.8,0.55,0.3,'shard');shake=Math.max(shake,0.045);
      // Landing read: a quick ground shockwave and a soft warm flash under the new tile.
      spawnRing(pos,0xfff2c0,1.6);spellOpening(pos,0xffe7a0,0.7);
      clusterPulse(cell);
      G.neighbors(cell).forEach((k,i)=>{const other=tileMap[k];if(other)other.impactDelay=0.04*(i+1);});return;
    }
    if(['purify','charm','merge','crystal'].includes(kind))rune(pos,c);
    flashLight(pos,c);spellOpening(pos,c,kind==='burn'||kind==='merge'?1.25:1);if(cb.onFlash&&['purify','merge'].includes(kind))cb.onFlash(0.2);if(n)n.pop=1;
    if(kind==='purify'||kind==='charm'){
      spawnBeam(pos,c);spawnBurst(pos,0xdbe8c0,20,0.26,1.0,1.8);
      if(n){
        const m=new THREE.Mesh(n.terrain.geometry,new THREE.ShaderMaterial({
          uniforms:{progress:{value:0},tint:{value:n.previousColor||new THREE.Color(0x6b6850)}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,
          vertexShader:'varying vec2 local;void main(){local=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader:'varying vec2 local;uniform float progress;uniform vec3 tint;void main(){float a=smoothstep(progress-0.05,progress+0.05,length(local));gl_FragColor=vec4(tint,a*0.85);}'
        }));
        transient(m,0.85,u=>{m.material.uniforms.progress.value=u*0.9;});n.group.add(m);m.userData.sharedGeometry=true;
      }
    }else if(kind==='mine'){
      for(let i=0;i<4;i++){
        const angle=i*Math.PI/2+0.4;
        const crack=new THREE.Mesh(geo.box,fxMaterial(c));crack.scale.set(0.028,0.015,0.75);crack.position.copy(pos);crack.rotation.y=angle;transient(crack,0.8,u=>{crack.material.opacity=1-u;});
        const m=new THREE.Mesh(geo.octa,fxMaterial(c));m.scale.set(0.10,0.20,0.10);m.position.copy(pos);
        transient(m,1.05,u=>{m.position.set(pos.x+Math.cos(angle)*u*0.38,pos.y+Math.sin(u*Math.PI)*0.9,pos.z+Math.sin(angle)*u*0.38);m.rotation.y=u*5;m.material.opacity=Math.min(1,(1-u)*5);});
      }spawnBurst(pos,0xbd994d,14,0.55,0.7,1.1,'shard');
    }else if(kind==='spring'){
      const jet=new THREE.Mesh(geo.cyl,fxMaterial(c,0.7));jet.position.copy(pos);
      transient(jet,0.85,u=>{const h=Math.sin(u*Math.PI)*1.6;jet.scale.set(0.12,h,0.12);jet.position.y=pos.y+h/2;jet.material.opacity=(1-u)*0.8;});
      spawnBurst(pos,0x8ab7cf,30,0.7,0.85,1.6,'water');
      for(let i=0;i<2;i++){const r=new THREE.Mesh(geo.ripple,fxMaterial(0xa5c8d3));r.rotation.x=-Math.PI/2;r.position.copy(pos);transient(r,0.75,u=>{r.scale.setScalar(0.2+u*0.85);r.material.opacity=(1-u)*0.3;},0.2+i*0.15);}
    }else if(kind==='rich'){
      for(let i=0;i<12;i++){
        const a=i*Math.PI/6,m=new THREE.Mesh(i%2?geo.box:geo.octa,fxMaterial(i%2?0x9a6c34:0x7ee348));m.position.copy(pos);m.scale.setScalar(0.07);
        transient(m,0.95,u=>{m.position.set(pos.x+Math.cos(a)*u*0.65,pos.y+Math.sin(u*Math.PI)*(i%2?0.55:1),pos.z+Math.sin(a)*u*0.65);m.rotation.set(u*6,a,u*4);m.material.opacity=1-u;});
      }
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4,m=new THREE.Mesh(geo.cone,fxMaterial(0x8fff66));m.position.set(pos.x+Math.cos(a)*0.4,pos.y+0.07,pos.z+Math.sin(a)*0.4);
        transient(m,0.9,u=>{m.scale.set(0.09,Math.sin(u*Math.PI)*0.25,0.09);m.material.opacity=1-u;},i*0.045);
      }
    }else if(kind==='burn'){
      shake=Math.max(shake,0.14);const from=particles.length;spawnBurst(pos,0xf2a55b,36,0.45,0.9,1.8,'ember');
      for(const p of particles.slice(from)){p.swirl=pos.clone();p.angle=Math.random()*Math.PI*2;p.radius=0.05+Math.random()*0.20;}
      spawnBurst(pos,0x736d61,9,0.20,1.1,1.1,'dust');
      for(let i=0;i<5;i++){
        const flame=new THREE.Mesh(geo.cone,fxMaterial(i%2?0xe7ad62:0xc97e49));
        transient(flame,0.65,u=>{const a=u*5+i*Math.PI*2/5;flame.position.set(pos.x+Math.cos(a)*0.16,pos.y+u*0.6,pos.z+Math.sin(a)*0.16);flame.scale.set(0.10*(1-u),Math.sin(u*Math.PI)*0.5,0.10*(1-u));flame.material.opacity=(1-u)*0.55;},i*0.07);
      }
    }else if(kind==='merge'){
      shake=Math.max(shake,0.2);
      for(let i=0;i<3;i++){
        const m=new THREE.Mesh(geo.sph,fxMaterial(c));m.scale.setScalar(0.11);
        transient(m,0.8,u=>{const a=u*9+i*Math.PI*2/3,r=(1-u)*0.9;m.position.set(pos.x+Math.cos(a)*r,pos.y+0.25+u*0.45,pos.z+Math.sin(a)*r);});
      }
      const orb=new THREE.Mesh(geo.octa,fxMaterial(c));orb.position.copy(pos);orb.position.y+=0.7;
      transient(orb,0.6,u=>{orb.scale.setScalar(Math.sin(u*Math.PI)*0.45);orb.rotation.y=u*5;orb.material.opacity=1-u;},0.65);
      if(n)n.units.children.forEach(o=>{if(o.children.some(c=>c.geometry===geo.ico))o.userData.appear=0;});
    }else if(kind==='crystal'){
      spawnBurst(pos,c,16,0.55,0.7,0.9,'shard');
    }else{spawnBurst(pos,c,10,0.5,0.6,0.8);}
  }


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
    if(reduced()&&intro>0){intro=0;cam.gR=baseR();}
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
    const hits = ray.intersectObjects([...pickables].filter(m=>m.visible), false);
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
    const now=performance.now()/1000;
    for(let i=queuedFX.length-1;i>=0;i--){const f=queuedFX[i];if(now>=f.at){queuedFX.splice(i,1);f.run();}}
    Object.values(wardMats).forEach(m=>m.uniforms.time.value=reduced()?0:time);
    for(let i=spellFX.length-1;i>=0;i--){
      const f=spellFX[i];f.t=now-f.born;if(f.t<0)continue;
      f.m.visible=true;f.update(Math.min(1,f.t/f.life));
      if(f.t>=f.life){disposeFX(f.m);spellFX.splice(i,1);}
    }
    for(const f of lights){if(f.born!=null)f.t=now-f.born;f.m.intensity=0.18*Math.max(0,1-f.t/0.4);}
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.prev.copy(p.p);
      p.v.y -= (p.style==='dust'?0.3:p.style==='ember'?0:2.2) * dt;
      p.v.multiplyScalar(1 - dt * 0.8);
      p.p.addScaledVector(p.v, dt);
      p.life = p.expires-now;
      if(p.swirl){p.angle+=dt*8;p.p.x=p.swirl.x+Math.cos(p.angle)*p.radius;p.p.z=p.swirl.z+Math.sin(p.angle)*p.radius;}
      if (p.life <= 0) particles.splice(i, 1);
    }
    const n = particles.length;
    for (let i = 0; i < n; i++) {
      const p = particles[i];
      pPos[i * 3] = p.p.x; pPos[i * 3 + 1] = p.p.y; pPos[i * 3 + 2] = p.p.z;
      const a = Math.max(0, p.life / p.max);
      pCol[i * 3] = p.c.r; pCol[i * 3 + 1] = p.c.g; pCol[i * 3 + 2] = p.c.b;
      pLife[i]=a;pSize[i]=p.size*(p.style==='dust'?1.8-a:1);
      pShape[i]=p.style==='shard'?1:p.style==='water'?2:p.style==='dust'?3:0;
      if(trailGeo){
        const offset=p.style==='dust'?0:p.style==='water'?0.04:0.025,j=i*6;
        trailPos[j]=p.p.x;trailPos[j+1]=p.p.y;trailPos[j+2]=p.p.z;
        trailPos[j+3]=p.p.x-p.v.x*offset;trailPos[j+4]=p.p.y-p.v.y*offset;trailPos[j+5]=p.p.z-p.v.z*offset;
        for(let c=0;c<3;c++){const col=c===0?p.c.r:c===1?p.c.g:p.c.b;trailCol[j+c]=col*a;trailCol[j+c+3]=col*a*0.6;}
      }
    }
    pGeo.setDrawRange(0, n);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
    pGeo.attributes.life.needsUpdate=true;pGeo.attributes.size.needsUpdate=true;pGeo.attributes.shape.needsUpdate=true;
    pGeo.computeBoundingSphere();
    if(trailGeo){trailGeo.setDrawRange(0,n*2);trailGeo.attributes.position.needsUpdate=true;trailGeo.attributes.color.needsUpdate=true;}

    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i];
      r.t = now-r.born;
      const u = r.t / r.life;
      const e = 1 - Math.pow(1 - u, 3);
      r.m.scale.setScalar(0.2 + e * r.size);
      r.m.material.opacity = (1 - u)*0.3;
      if (u >= 1) { fxGroup.remove(r.m); r.m.material.dispose(); rings.splice(i, 1); }
    }
    for (let i = beams.length - 1; i >= 0; i--) {
      const b = beams[i];
      b.t = now-b.born;
      const u = b.t / b.life;
      b.m.material.opacity = 0.22 * (1 - u);
      b.m.scale.x = b.m.scale.z = 0.09 + u * 0.06;
      b.m.rotation.y += dt * 3;
      if (u >= 1) { fxGroup.remove(b.m); b.m.material.dispose(); beams.splice(i, 1); }
    }
    sways.forEach(s => { s.m.rotation.z = Math.sin(time * 0.9 + s.p) * s.a; s.m.rotation.x = Math.cos(time * 0.7 + s.p) * s.a * 0.6; });
    waters.forEach(w => { w.m.position.y = w.y + Math.sin(time * 1.8 + w.p) * 0.003; });
    const lv = 1 + Math.sin(time * 3.2) * 0.35;
    lavas.forEach(m => { m.material.emissiveIntensity = lv; });
    mats.water.emissiveIntensity = 0.22 + Math.sin(time * 2) * 0.08;
    mats.waterTime.value = reducedMotion() ? 0 : time;
    bobs.forEach(b => {
      const m = b.m;
      if(b.guardian&&reduced()){m.position.y=b.y;return;}
      if (b.cloud) { m.position.x += dt * b.cloud; if (m.position.x > 70) m.position.x = -70; return; }
      if (b.orbit) {
        // 元素灵绕地块中心转圈
        const a = time * b.sp + b.p;
        const x=Math.cos(a)*b.orbit,z=Math.sin(a)*b.orbit;
        m.position.set(x,(b.cell?visualHeight(b.cell,x,z)+b.offset:b.y)+Math.sin(time*2.4+b.p)*b.a,z);
        m.rotation.y += dt * b.spin;
        return;
      }
      if (b.wander) {
        // 动物：小范围踱步 + 跳跳 / 扇翅
        const w = b.wander;
        const a = w.ang + Math.sin(time * w.sp + b.p) * (b.fly ? 3 : 0.7);
        m.position.x = Math.cos(a) * w.r;
        m.position.z = Math.sin(a) * w.r;
        const ground=b.cell?visualHeight(b.cell,m.position.x,m.position.z)+b.offset:b.y;
        m.rotation.y = -a - Math.PI / 2 * Math.sign(Math.cos(time * w.sp + b.p) || 1);
        if (b.hop) m.position.y = ground + Math.abs(Math.sin(time * 4 + b.p)) * 0.025;
        else m.position.y = ground + Math.sin(time * 2 + b.p) * b.a;
        if (b.fly) m.children.forEach(c => { if (c.userData.wing) c.rotation.x = c.userData.wing * Math.sin(time * 18 + b.p) * 0.7; });
        return;
      }
      m.position.y = b.y + Math.sin(time * 2.1 + b.p) * b.a;
      if (b.squash) m.scale.y = 0.12 * (1 + Math.sin(time * 6 + b.p) * 0.25);
      if (b.spin) m.rotation.y += dt * b.spin;
      if(m.userData.appear!=null){m.userData.appear=Math.min(1,m.userData.appear+dt*2);m.scale.setScalar(Math.max(0.01,backOut(m.userData.appear)));if(m.userData.appear===1)delete m.userData.appear;}
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
        const look = effectiveLook(t);
        if (t.spring && Math.random() < dt * 4) {
          const p = wp(k, visualHeight(k,-.24,-.2) + 0.15); p.x -= 0.24; p.z -= 0.2;
          spawnBurst(p, 0x8adcff, 1, 0.25, 0.6, 1.2);
        }
        if (look.kind === 'lava' && Math.random() < dt * 3) spawnBurst(wp(k, look.h + 0.05), 0xff7a20, 1, 0.3, 0.8, 1.3);
        if (t.beasts.length && Math.random() < dt * 3) spawnBurst(wp(k, visualHeight(k,0,0) + 0.75), ELC[t.beasts[0].el], 1, 0.4, 0.7, 0.6);
        if (look.kind === 'water' && !look.dirty && Math.random() < dt * 1.2) {
          const p = wp(k, look.h + 0.03); p.x += (Math.random() - 0.5) * 0.6; p.z += (Math.random() - 0.5) * 0.6;
          spawnBurst(p, 0xffffff, 1, 0.05, 0.4, 0.3);
        }
      }
    }
  }

  function updateHighlights(dt, time) {
    updateRegionPreview(time);
    const legal = modeRef && modeRef.kind === 'place' ? new Set(G.legalPlacements(stateRef)) : new Set();
    const targets = new Set();
    if (modeRef && stateRef && modeRef.kind !== 'place') {
      for (const k of Object.keys(stateRef.cells)) {
        const t=stateRef.cells[k]; let ok=true;
        if(modeRef.kind==='moveSpirit') ok=G.neighbors(modeRef.from).includes(k)&&t.spirits.length<G.spiritCap(t);
        if(modeRef.kind==='moveAnimal') {
          const a=stateRef.cells[modeRef.from].animals.find(a=>a.id===modeRef.id);
          ok=G.neighbors(modeRef.from).includes(k)&&t.animals.length<D.RULES.maxAnimals&&!!a&&(a.kind!=='fish'||G.hasWater(t));
        }
        if(modeRef.kind==='shelter') ok=!t.shelter;
        if(modeRef.kind==='cast') ok=!!stateRef.placed&&stateRef.ap>0&&G.magicUnlocked(stateRef,modeRef.magic)&&!stateRef.magicUsed[modeRef.magic]&&(modeRef.magic!=='purify'||G.canPurify(stateRef,k));
        if(modeRef.kind==='moveBeast'){const b=stateRef.cells[modeRef.from].beasts.find(b=>b.id===modeRef.id);ok=G.neighbors(modeRef.from).includes(k)&&!!b&&t.attrs[EL.findIndex(e=>e.key===b.el)]>0;}
        if(modeRef.kind==='moveGuardian')ok=!!stateRef.placed&&stateRef.ap>0&&G.neighbors(modeRef.from).includes(k)&&(stateRef.cells[modeRef.from].guardians||[]).some(g=>g.id===modeRef.id);
        if(modeRef.kind==='movePlant'){const p=stateRef.cells[modeRef.from].plants.find(p=>p.id===modeRef.id);ok=G.neighbors(modeRef.from).includes(k)&&t.plants.length<D.RULES.maxPlants&&!!p&&(p.kind!=='weed'||G.hasWater(t));}
        if(ok) targets.add(k);
      }
    }
    mats.padLegal.emissiveIntensity = 0.35 + Math.sin(time*4)*0.18;
    for (const k of Object.keys(pads)) {
      const pad=pads[k]; if(!pad.visible)continue;
      pad.material=legal.has(k)?[mats.padLegal,mats.padSide]:[mats.pad,mats.padSide]; pad.position.y=0;
    }
    if(ghost) {
      const show=modeRef&&modeRef.kind==='place'&&hoverK&&legal.has(hoverK); ghost.visible=!!show;
      if(show) {
        // Preview the offered terrain colour and let it hover, so the player sees what lands where.
        const offer=stateRef.offers[modeRef.offer],look=offer&&LOOK[G.TYPE[offer].look];
        if(look)mats.ghost.color.setHex(look.top);mats.ghost.emissive.setHex(look?look.top:0x88ff66);mats.ghost.emissiveIntensity=0.35;
        const p=wp(hoverK);ghost.position.set(p.x,0.09+(reducedMotion()?0:0.05+Math.sin(time*4)*0.025),p.z);
        if(!ghost.userData.frame) {ghost.userData.frame=dashedFrame(0xffffff);scene.add(ghost.userData.frame);}
        const f=ghost.userData.frame;f.visible=true;f.position.set(p.x,PAD_H+0.14,p.z);f.userData.band.material.uniforms.time.value=time;
      }
      if(ghost.userData.frame&&!show)ghost.userData.frame.visible=false;
    }
    for(const k of Object.keys(tileMap)) {
      const n=tileMap[k],sel=selectedK===k,tg=targets.has(k);
      if((sel||tg)&&!n.frame){n.frame=dashedFrame(0xffd23a);fitFrame(n);n.group.add(n.frame);}
      if(n.frame){
        n.frame.visible=sel||tg;
        if(sel||tg){
          const c=tg&&!sel?0x5ad0ff:0xffd23a;
          n.frame.userData.band.material.uniforms.tint.value.setHex(c);n.frame.userData.cornerMat.color.setHex(c);
          n.frame.userData.band.material.uniforms.time.value=time;
          if(sel&&!n.wasSelected)n.selectTime=0;
          n.selectTime=(n.selectTime||0)+dt;
          const u=Math.min(1,n.selectTime/0.35);
          n.frame.scale.setScalar(1+0.3*(1-backOut(u))+Math.sin(time*3)*0.008);
        }
      }
      n.wasSelected=sel;n.lift+=((sel?0.06:0)-n.lift)*Math.min(1,dt*12);
    }
  }

  function updateRegionPreview(time) {
    const key=[hoverK,selectedK,modeRef&&JSON.stringify(modeRef),sync.terrainKey].join('|');
    if(key!==regionPreviewKey){
      if(regionPreview){disposeFX(regionPreview);regionPreview=null;}regionPreviewKey=key;
      let cells=[],color=0xcfff78;
      const k=hoverK||selectedK;
      if(k&&stateRef){
        if(modeRef&&modeRef.kind==='place'&&G.legalPlacements(stateRef).includes(k)){
          const type=stateRef.offers[modeRef.offer];if(type){const preview={...stateRef,cells:{...stateRef.cells,[k]:G.makeTile(type)}};cells=G.cluster(preview,k);}
        }else if(modeRef&&modeRef.kind==='deployShield'&&stateRef.cells[k]){
          const sh=stateRef.inv.shields.find(sh=>sh.id===modeRef.id);if(sh){cells=G.region(stateRef,k,sh.coverage);color=0x9deaff;}
        }else if(modeRef&&modeRef.kind==='moveGuardian'&&G.neighbors(modeRef.from).includes(k)&&stateRef.cells[k]){
          cells=G.guardianArea(stateRef,k);color=0xffd873;
        }else if(!modeRef&&stateRef.cells[k])cells=G.cluster(stateRef,k);
      }
      if(cells.length>1||(cells.length&&modeRef&&modeRef.kind==='deployShield')){regionPreview=regionMesh(cells,color,.7);scene.add(regionPreview);}
    }
    if(regionPreview)regionPreview.material.opacity=reduced()?.65:.55+Math.sin(time*3)*.15;
  }


  function backOut(u) { const c = 2.2; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); }

  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) { clock.getDelta(); return; }
    const elapsed=Math.max(0,clock.getDelta()),dt=Math.min(.05,elapsed);
    const time = clock.elapsedTime;
    updateCam(dt);
    if(reduced())shake=0;
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 0.8);
    }
    updateHighlights(dt, time);
    for (const k of Object.keys(tileMap)) {
      const n = tileMap[k];
      let y = n.lift, sxz = 1, sy = 1;
      if(n.impactDelay!=null){n.impactDelay-=dt;if(n.impactDelay<=0){n.impact=0.4;delete n.impactDelay;}}
      if(n.impact>0){n.impact=Math.max(0,n.impact-dt);y+=Math.sin(n.impact/0.4*Math.PI)*0.05;}
      if (n.rise > 0) {
        n.rise = Math.max(0, n.rise - dt * 2.5);
        var u = 1 - n.rise;
        y += (1 - backOut(u)) * 2.2;
        if (n.rise === 0) { n.pop = 1; fx('place', k);if(n.growthPending){regionGrowth(n.growthPending);delete n.growthPending;} }
      }
      if (n.pop > 0) {
        // 落地挤压
        n.pop = Math.max(0, n.pop - dt * 3.5);
        const s = Math.sin(n.pop * Math.PI) * n.pop;
        sy = 1 - s * 0.25; sxz = 1 + s * 0.12;
      }
      n.group.position.y = y;
      n.group.scale.set(sxz, sy, sxz);
      if(n.growth){
        const g=n.growth;g.t+=dt;
        if(g.t>=0){
          if(!g.started){g.started=true;spawnBurst(wp(k,visualHeight(k,0,0)+.2),g.family==='lake'?0x9be9ff:0xe1ff9c,g.milestone?7:3,.28,.65,.75,g.family==='lake'?'water':'spark');}
          const wave=Math.sin(Math.min(1,g.t/.65)*Math.PI);
          n.scenery.children.filter(o=>o.isInstancedMesh).forEach(o=>o.scale.y=1+wave*(g.milestone?.12:.055));
          n.terrain.material[0].emissive.setHex(0xa8c76a);n.terrain.material[0].emissiveIntensity=wave*.2;
          if(g.t>=.65||reducedMotion()){n.scenery.children.filter(o=>o.isInstancedMesh).forEach(o=>o.scale.y=1);n.terrain.material[0].emissiveIntensity=0;delete n.growth;}
        }
      }
    }
    updateFX(dt, time);
    cloudBanks.forEach((bank,i)=>{bank.position.y=Math.sin(time*0.18+i)*0.035;bank.position.x=Math.sin(time*0.065)*0.08;});
    if(post){
      const k=hoverK&&modeRef?hoverK:selectedK;
      const p=k?wp(k,visualHeight(k,0,0)+.2):cam.target.clone();
      if(k&&tileMap[k])p.y+=tileMap[k].group.position.y;
      post.render(scene,camera,p,dt);
    }else renderer.render(scene,camera);
  }

  function resize() {
    if (!renderer) return;
    const el = renderer.domElement.parentElement;
    const w = el.clientWidth, h = el.clientHeight;
    camera.aspect = w / Math.max(1, h);
    // Frame the board in the playable area above the card dock.
    camera.setViewOffset(w,h,0,h*(w<640?0.14:0.065),w,h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if(post)post.resize(w,h);
    if(pObj)pObj.material.uniforms.pointScale.value=h*0.8*renderer.getPixelRatio();
  }

  function sync(S, ui) {
    if (stateRef && S !== stateRef) {
      spellFX.forEach(f=>disposeFX(f.m));spellFX=[];queuedFX=[];
      if(regionPreview){disposeFX(regionPreview);regionPreview=null;}regionPreviewKey='';hoverK=null;shake=0;
      rings.concat(beams).forEach(f=>{fxGroup.remove(f.m);f.m.material.dispose();});rings=[];beams=[];
      lights.forEach(f=>{f.t=1;f.m.intensity=0;delete f.born;});particles=[];
      // 新游戏：清空地块，镜头重新入场
      Object.keys(tileMap).forEach(removeTile);
      lastRound = S.round; intro = 0.6;
      cam.gx = 0; cam.gz = 0;
    }
    const fresh = !stateRef || S !== stateRef;
    const previousLandscape=fresh?{byCell:{},regions:[]}:landscape;
    stateRef = S;
    landscape=root.Landscape.plan(S.cells,G.TYPE);
    modeRef = ui.mode;
    selectedK = ui.selected;
    const terrainKey=Object.keys(S.cells).map(k=>k+':'+S.cells[k].type+':'+S.cells[k].attrs.join(',')).join('|');
    const terrainChanged=terrainKey!==sync.terrainKey;sync.terrainKey=terrainKey;
    const keysNow = new Set(Object.keys(S.cells));
    for (const k of Object.keys(tileMap)) if (!keysNow.has(k)) removeTile(k);
    for (const k of keysNow) {
      if(tileMap[k]&&tileMap[k].sceneryKey.split(':')[0]!==S.cells[k].type)removeTile(k);
      if (!tileMap[k]) makeTile(k, S.cells[k], !fresh&&!reduced());
      else updateTile(tileMap[k], S.cells[k]);
      const node=tileMap[k],sig=scenerySignature(k);
      if(node.scenerySig!==sig){rebuildScenery(node);node.scenerySig=sig;}
    }
    if(terrainChanged){
      Object.values(tileMap).forEach(rebuildTerrain);
      Object.entries(pads).forEach(([k,m])=>{m.geometry.dispose();m.geometry=terrainGeometry(k);});
      updateLawn();
    }
    if(!fresh)for(const event of root.Landscape.growth(previousLandscape,landscape)){
      const node=tileMap[event.origin];
      if(node&&node.rise>0)node.growthPending=event;else regionGrowth(event);
    }
    if (S.round !== lastRound) {
      lastRound = S.round;
      shake = Math.max(shake, 0.2);
      for (const k of keysNow) {
        spawnBurst(wp(k, visualHeight(k,0,0) + 0.1), 0xfff2a0, 3, 0.5, 0.9, 1.4);
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
    scene.add(new THREE.HemisphereLight(0xe6f3ff, 0x8aa866, 0.46));
    // Late-afternoon key light: lower angle gives longer, more readable model shadows.
    sun = new THREE.DirectionalLight(0xffe9c4, 0.9);
    sun.position.set(13, 17, 7);
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
    const fill = new THREE.DirectionalLight(0xa8ccff, 0.2);
    fill.position.set(-10, 8, -12);
    scene.add(fill);
    addHorizon();

    pickables = new Set();
    fxGroup = new THREE.Group();
    scene.add(fxGroup);
    if(!LOW)for(let i=0;i<2;i++){const m=new THREE.PointLight(0xffffff,0,2.5,2);fxGroup.add(m);lights.push({m,t:1});}
    addBase();
    G.SHAPE.forEach(([x, y]) => addPad(G.key(x, y)));

    pPos = new Float32Array(800 * 3);
    pCol = new Float32Array(800 * 3);
    pLife=new Float32Array(800);pSize=new Float32Array(800);pShape=new Float32Array(800);
    pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
    pGeo.setAttribute('life',new THREE.BufferAttribute(pLife,1));pGeo.setAttribute('size',new THREE.BufferAttribute(pSize,1));pGeo.setAttribute('shape',new THREE.BufferAttribute(pShape,1));
    pObj = new THREE.Points(pGeo, new THREE.ShaderMaterial({
      uniforms:{pointScale:{value:700}},vertexColors:true,transparent:true,depthWrite:false,
      vertexShader:'attribute float life;attribute float size;attribute float shape;uniform float pointScale;varying vec3 tint;varying float alpha;varying float form;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*pointScale/max(0.1,-p.z),1.0,42.0);tint=color;alpha=life;form=shape;}',
      fragmentShader:'varying vec3 tint;varying float alpha;varying float form;void main(){vec2 p=gl_PointCoord*2.0-1.0;float r=length(p);float a=0.0;if(form<0.5){a=1.0-smoothstep(0.25,1.0,r);}else if(form<1.5){a=1.0-smoothstep(0.65,0.95,abs(p.x)+abs(p.y));}else if(form<2.5){a=1.0-smoothstep(0.6,1.0,length(p*vec2(1.0,0.75)));}else{a=(1.0-smoothstep(0.0,1.0,r))*0.3;}if(a<0.01)discard;gl_FragColor=vec4(tint,a*alpha*0.8);}'
    }));
    pObj.frustumCulled = false;
    scene.add(pObj);
    if(!LOW){
      trailPos=new Float32Array(800*6);trailCol=new Float32Array(800*6);trailGeo=new THREE.BufferGeometry();
      trailGeo.setAttribute('position',new THREE.BufferAttribute(trailPos,3));trailGeo.setAttribute('color',new THREE.BufferAttribute(trailCol,3));
      const trails=new THREE.LineSegments(trailGeo,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:0.22,depthWrite:false}));trails.frustumCulled=false;scene.add(trails);
    }

    clock = new THREE.Clock();
    if(root.ScenePostFX){post=root.ScenePostFX.create(renderer,{low:LOW});post.enabled=atmosphereOn;}
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
    const n=tileMap[k];
    const pos = wp(k, visualHeight(k,0,0) + 0.4 + (n?n.group.position.y:0));
    pos.project(camera);
    if (pos.z > 1 || pos.z < -1 || Math.abs(pos.x)>1.15 || Math.abs(pos.y)>1.15) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: (pos.x * 0.5 + 0.5) * r.width + r.left, y: (-pos.y * 0.5 + 0.5) * r.height + r.top };
  }

  function focus(k) {
    if (!k || !cam) return;
    const p = wp(k);
    cam.gx = p.x; cam.gz = p.z;
  }

  function setAtmosphere(enabled){atmosphereOn=!!enabled;if(post)post.enabled=atmosphereOn;}
  root.View = { init, sync, resize, fx, meteorRain, shieldDeploy, guardianFX, focus, supported, project, burstAt, setAtmosphere };
})(this);
