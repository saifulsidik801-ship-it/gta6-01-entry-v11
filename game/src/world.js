// Azura Bay — the city itself. Shaped-mesh rendering: extruded profiles,
// lathe forms, tube trunks, emissive neon and lit windows over a gradient
// dusk sky. Everything is built from code and canvas textures — no images.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';
import { range, pick, int } from './random.js';

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function textSpriteTexture(text, fg, bg, font) {
  return canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.font = font || '900 64px Anton, Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = fg; g.shadowBlur = 26;
    g.fillStyle = fg; g.fillText(text, w / 2, h / 2 + 2);
    g.shadowBlur = 0; g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

// ---- sky: gradient dome shader, low sun, drifting clouds -----------------
export function makeSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec3 vP; uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      void main(){
        float h = normalize(vP).y;
        vec3 c = h > 0.22 ? mix(mid, top, smoothstep(0.22, 0.75, h)) : mix(low, mid, smoothstep(-0.05, 0.22, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 18), skyMat);
  scene.add(dome);

  // low sun disc, warm and huge on the horizon
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 40),
    new THREE.MeshBasicMaterial({ color: 0xffe6b0, fog: false }),
  );
  sun.position.set(-260, 66, -620);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(70, 40),
    new THREE.MeshBasicMaterial({ color: 0xff9a5c, transparent: true, opacity: 0.28, fog: false }),
  );
  glow.position.set(-260, 66, -625);
  glow.lookAt(0, 40, 0);
  scene.add(glow);

  // soft clouds: flattened white blobs drifting slowly
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffe9d6, transparent: true, opacity: 0.75, fog: false });
  for (let i = 0; i < 14; i++) {
    const grp = new THREE.Group();
    const n = 3 + (i % 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(14 + ((i * 7 + j * 13) % 16), 10, 8), cloudMat);
      s.scale.y = 0.32;
      s.position.set(j * 16 - n * 7, (j % 2) * 3, (j % 3) * 6 - 6);
      grp.add(s);
    }
    grp.position.set(-500 + ((i * 173) % 1000), 120 + ((i * 37) % 90), -650 + ((i * 211) % 900));
    scene.add(grp);
    clouds.push(grp);
  }
  return { clouds, mat: skyMat };
}

// ---- ground: road, sidewalks, beach, sea ---------------------------------
export function makeGround(scene) {
  const roadTex = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#3d4149'; g.fillRect(0, 0, w, h);
    // asphalt noise
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = 'rgba(255,255,255,' + (Math.random() * 0.05) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    // double yellow centre lines
    g.fillStyle = '#f7c948';
    g.fillRect(w / 2 - 14, 0, 7, h); g.fillRect(w / 2 + 7, 0, 7, h);
    // white lane dashes
    g.fillStyle = '#e8ecf2';
    for (let y = 0; y < h; y += 86) { g.fillRect(w / 4 - 4, y, 8, 46); g.fillRect((3 * w) / 4 - 4, y, 8, 46); }
    // edge lines
    g.fillRect(6, 0, 5, h); g.fillRect(w - 11, 0, 5, h);
  });
  roadTex.wrapS = THREE.RepeatWrapping; roadTex.wrapT = THREE.RepeatWrapping;
  roadTex.repeat.set(1, 7);
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.roadHalf * 2, CITY.roadLength),
    new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.85, metalness: 0.05 }),
  );
  road.rotation.x = -Math.PI / 2;
  road.receiveShadow = true;
  scene.add(road);

  // sidewalks
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x9a938a, roughness: 0.95 });
  for (const sx of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, CITY.roadLength), walkMat);
    walk.position.set(sx * (CITY.roadHalf + 3.5), 0.17, 0);
    walk.receiveShadow = true;
    scene.add(walk);
  }

  // beach sand, east of the road
  const sandTex = canvasTex(256, 512, (g, w, h) => {
    g.fillStyle = '#f8f0da'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = 'rgba(190,160,110,' + (Math.random() * 0.14) + ')';
      g.fillRect(Math.random() * w, Math.random() * h, 3, 2);
    }
  });
  sandTex.wrapS = THREE.RepeatWrapping; sandTex.wrapT = THREE.RepeatWrapping;
  sandTex.repeat.set(3, 10);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(52, CITY.roadLength),
    new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(CITY.beachX + 26, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  // sea: animated canvas waves, east edge
  const seaTex = canvasTex(256, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#37b8a8'); grad.addColorStop(1, '#1d6f8f');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      for (let x = 0; x <= w; x += 8) g.lineTo(x, i * 30 + Math.sin(x * 0.05 + i) * 5 + 12);
      g.stroke();
    }
  });
  seaTex.wrapS = THREE.RepeatWrapping; seaTex.wrapT = THREE.RepeatWrapping;
  seaTex.repeat.set(2, 12);
  const seaMat = new THREE.MeshStandardMaterial({ map: seaTex, roughness: 0.25, metalness: 0.35 });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, CITY.roadLength + 260), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(CITY.seaX + 130, -0.4, 0);
  scene.add(sea);
  return { seaTex };
}

// ---- buildings: varied blocks, lit windows, glass towers, neon signs -----
const BUILDING_COLORS = [0xffd9a0, 0xffb37a, 0xf2e3c9, 0xc9d6e8, 0xff9d8a, 0x9fd8c9, 0xe8b4d8, 0x8fb8e8];

function windowTexture(rng, litRatio, base) {
  return canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#' + base.toString(16).padStart(6, '0');
    g.fillRect(0, 0, w, h);
    for (let y = 8; y < h - 8; y += 22) {
      for (let x = 8; x < w - 8; x += 18) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? (rng() < 0.7 ? '#ffd98a' : '#9fd8ff') : 'rgba(0,0,0,0.28)';
        g.fillRect(x, y, 11, 14);
      }
    }
  });
}

function neonSign(scene, text, color, w, x, y, z, ry) {
  const tex = textSpriteTexture(text, color, 'rgba(10,10,18,0.92)');
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), mat);
  sign.position.set(x, y, z);
  sign.rotation.y = ry;
  scene.add(sign);
  const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16 });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.15, w / 3.2), glowMat);
  glow.position.set(x, y, z);
  glow.rotation.y = ry;
  glow.translateZ(-0.15);
  scene.add(glow);
  return sign;
}

export function makeBuildings(scene, rng, colliders) {
  const signs = [];
  // west blocks: two rows of buildings along the boulevard
  for (let z = -270; z < 275; z += 46) {
    if (z === -224) continue; // the Azura Customs plaza takes this slot
    const depth = pick(rng, [26, 34, 42]);
    const height = pick(rng, [14, 18, 24, 30, 38, 52]);
    const color = pick(rng, BUILDING_COLORS);
    const glass = rng() < 0.3;
    const mat = glass
      ? new THREE.MeshStandardMaterial({ color: 0x6f9fc9, roughness: 0.15, metalness: 0.85, emissive: 0x0a2038, emissiveIntensity: 0.5 })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(depth, height, 40), mat);
    b.position.set(-(CITY.roadHalf + 7 + depth / 2), height / 2, z);
    b.castShadow = true; b.receiveShadow = true;
    scene.add(b);
    colliders.push({ x0: b.position.x - depth / 2, x1: b.position.x + depth / 2, z0: z - 20, z1: z + 20 });
    // lit window band on the road-facing side
    const winTex = windowTexture(rng, 0.55, color);
    const win = new THREE.Mesh(
      new THREE.PlaneGeometry(38, height * 0.86),
      new THREE.MeshBasicMaterial({ map: winTex }),
    );
    win.position.set(-(CITY.roadHalf + 7) + 0.15, height / 2, z);
    win.rotation.y = Math.PI / 2;
    scene.add(win);
    // rooftop clutter: AC boxes + antenna
    const ac = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 3), new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9 }));
    ac.position.set(b.position.x + range(rng, -6, 6), height + 0.8, z + range(rng, -10, 10));
    scene.add(ac);
    if (rng() < 0.5) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 9, 6), new THREE.MeshStandardMaterial({ color: 0x333a44 }));
      ant.position.set(b.position.x - depth / 3, height + 4.5, z - 12);
      scene.add(ant);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
      tip.position.set(ant.position.x, height + 9, ant.position.z);
      scene.add(tip);
    }
  }
  // glass towers at the north end (skyline anchor)
  for (let i = 0; i < 3; i++) {
    const h = 78 + i * 22;
    const t = new THREE.Mesh(
      new THREE.BoxGeometry(30, h, 30),
      new THREE.MeshStandardMaterial({ color: 0x8fb8d9, roughness: 0.2, metalness: 0.7, emissive: 0x2a4a6a, emissiveIntensity: 0.9 }),
    );
    t.position.set(-78 - i * 8, h / 2, -268 + i * 44);
    t.castShadow = true;
    scene.add(t);
    colliders.push({ x0: t.position.x - 15, x1: t.position.x + 15, z0: t.position.z - 15, z1: t.position.z + 15 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(32, 2.5, 32), new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xffc93c, emissiveIntensity: 1.4 }));
    top.position.set(t.position.x, h + 1.2, t.position.z);
    scene.add(top);
  }
  // neon signs along the boulevard
  signs.push(neonSign(scene, 'AZURA BAY', '#ffd34d', 26, -16, 26, -210, Math.PI / 2));
  signs.push(neonSign(scene, 'NEON ROW', '#ff5ed8', 18, -16, 20, -40, Math.PI / 2));
  signs.push(neonSign(scene, 'GOLD COAST', '#7dffb0', 20, -16, 24, 120, Math.PI / 2));
  signs.push(neonSign(scene, 'MARINA QUAY', '#5ec8ff', 20, -16, 22, 220, Math.PI / 2));
  signs.push(neonSign(scene, 'HOTEL PALMA', '#ff9a3d', 18, -16, 30, -150, Math.PI / 2));
  return { signs };
}

// ---- palms: curved TubeGeometry trunks, radial fronds ---------------------
export function makePalm(rng, height) {
  const palm = new THREE.Group();
  const lean = range(rng, 0.08, 0.3);
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * height * 0.3, height * 0.5, 0),
    new THREE.Vector3(lean * height, height, 0),
  ]);
  const trunk = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 10, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 1 }),
  );
  trunk.castShadow = true;
  palm.add(trunk);
  const top = new THREE.Vector3(lean * height, height, 0);
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x35c463, roughness: 0.9, side: THREE.DoubleSide });
  const frondMat2 = new THREE.MeshStandardMaterial({ color: 0x4ad676, roughness: 0.9, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rng() * 0.3;
    const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 4.6, 1, 4), i % 2 ? frondMat : frondMat2);
    // droop the tip by bending the plane's far vertices down
    const pos = frond.geometry.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const y = pos.getY(v);
      if (y > 0) pos.setZ(v, (y * y) * 0.22);
    }
    frond.geometry.computeVertexNormals();
    frond.position.copy(top);
    frond.rotation.order = 'YXZ';
    frond.rotation.y = a;
    frond.rotation.x = -1.15;
    frond.translateY(2.1);
    palm.add(frond);
  }
  // coconuts
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 1 }));
    nut.position.set(top.x + Math.cos(i * 2.1) * 0.5, top.y - 0.3, Math.sin(i * 2.1) * 0.5);
    palm.add(nut);
  }
  return palm;
}

export function makePalms(scene, rng) {
  const palms = [];
  for (let z = -272; z < 275; z += 26) {
    // keep the customs plaza clear: no palm in front of the bay
    const nearCustoms = z > -238 && z < -210;
    if (!nearCustoms) {
      const p1 = makePalm(rng, range(rng, 9, 13));
      p1.position.set(-15.5, 0, z + range(rng, -4, 4));
      scene.add(p1); palms.push(p1);
    }
    if (rng() < 0.85) {
      const p2 = makePalm(rng, range(rng, 8, 12));
      p2.position.set(19.5, 0, z + range(rng, -6, 6));
      scene.add(p2); palms.push(p2);
    }
    if (rng() < 0.4) {
      const p3 = makePalm(rng, range(rng, 7, 10));
      p3.position.set(44, 0, z + range(rng, -8, 8));
      scene.add(p3); palms.push(p3);
    }
  }
  return palms;
}

// ---- beach props: umbrellas, towels, lifeguard tower ----------------------
export function makeBeach(scene, rng) {
  const umbrellaColors = [0xff5e7a, 0x37b8ff, 0xffd34d, 0x7dffb0, 0xff9a3d];
  for (let i = 0; i < 16; i++) {
    const z = -260 + i * 34 + range(rng, -8, 8);
    const x = 34 + rng() * 26;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
    pole.position.set(x, 1.5, z);
    scene.add(pole);
    const um = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 1.1, 10, 1, true),
      new THREE.MeshStandardMaterial({ color: pick(rng, umbrellaColors), roughness: 0.8, side: THREE.DoubleSide }),
    );
    um.position.set(x, 3.2, z);
    scene.add(um);
    const towel = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 2.4), new THREE.MeshStandardMaterial({ color: pick(rng, umbrellaColors), roughness: 1 }));
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = rng() * Math.PI;
    towel.position.set(x + range(rng, -2, 2), 0.06, z + range(rng, 1, 4));
    scene.add(towel);
  }
  // lifeguard tower
  const tower = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.4, 6), legMat);
    leg.position.set(lx, 2.2, lz);
    tower.add(leg);
  }
  const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.2, 3), new THREE.MeshStandardMaterial({ color: 0xff5e7a, roughness: 0.8 }));
  hut.position.y = 5.4;
  hut.castShadow = true;
  tower.add(hut);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
  roof.position.y = 7.1; roof.rotation.y = Math.PI / 4;
  tower.add(roof);
  tower.position.set(40, 0, -60);
  scene.add(tower);
}

// ---- night market: stalls, awnings, string lights, lanterns ---------------
export function makeMarket(scene, rng) {
  const group = new THREE.Group();
  const stallColors = [0xff5e7a, 0xffd34d, 0x37b8ff, 0x7dffb0, 0xff9a3d, 0xc98aff];
  const stalls = [];
  const awningTex = (c1, c2) => canvasTex(128, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c1 : c2; g.fillRect(i * 16, 0, 16, h); }
  });
  for (let i = 0; i < 10; i++) {
    const stall = new THREE.Group();
    const z = -78 + i * 15 + range(rng, -2, 2);
    const x = -19 - (i % 2) * 7;
    const col = pick(rng, stallColors);
    const counter = new THREE.Mesh(new THREE.BoxGeometry(4.4, 1.1, 2.2), new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 }));
    counter.position.y = 0.55;
    counter.castShadow = true;
    stall.add(counter);
    const awn = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 2.6),
      new THREE.MeshStandardMaterial({ map: awningTex('#' + col.toString(16).padStart(6, '0'), '#ffffff'), side: THREE.DoubleSide, roughness: 0.85 }),
    );
    awn.rotation.x = -Math.PI / 2 + 0.5;
    awn.position.set(0, 2.6, 0.4);
    awn.castShadow = true;
    stall.add(awn);
    for (const px of [-2.1, 2.1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x333a44 }));
      pole.position.set(px, 1.3, 0.9);
      stall.add(pole);
    }
    // goods on the counter: fruit piles, boxes, lanterns
    for (let k = 0; k < 5; k++) {
      const good = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 8),
        new THREE.MeshStandardMaterial({ color: pick(rng, [0xff6a3d, 0xffd34d, 0x7dffb0, 0xff5e7a]), roughness: 0.6 }),
      );
      good.position.set(-1.6 + k * 0.8, 1.25, range(rng, -0.5, 0.5));
      stall.add(good);
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    bulb.position.set(0, 2.1, 0.4);
    stall.add(bulb);
    const lamp = new THREE.PointLight(0xffc98a, 12, 12, 1.8);
    lamp.position.set(0, 2.1, 0.4);
    stall.add(lamp);
    stall.position.set(x, 0, z);
    group.add(stall);
    stalls.push(stall);
  }
  // string lights across the market street
  const bulbs = [];
  for (let z = -84; z < 70; z += 12) {
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 24, 4),
      new THREE.MeshBasicMaterial({ color: 0x222222 }),
    );
    line.rotation.z = Math.PI / 2;
    line.position.set(-14, 7.5, z);
    group.add(line);
    for (let k = 0; k < 7; k++) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 8),
        new THREE.MeshBasicMaterial({ color: pick(rng, [0xffd34d, 0xff5e7a, 0x7dffb0, 0x37b8ff]) }),
      );
      b.position.set(-24 + k * 3.4, 7.3 - Math.sin((k / 6) * Math.PI) * 0.7, z);
      group.add(b);
      bulbs.push(b);
    }
  }
  // big NEON ROW arch over the market entrance
  const archTex = textSpriteTexture('★ NEON ROW ★', '#ff5ed8', 'rgba(10,10,18,0.95)');
  const arch = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: archTex, transparent: true }));
  arch.position.set(-8, 8.6, -84);
  group.add(arch);
  scene.add(group);
  return { stalls, bulbs };
}

// ---- Azura Customs garage: open bay, gold glow, lift ----------------------
// Built as walls + roof with the east side open, so the gold car inside is
// visible from the street — never a solid box (a solid box would hide it).
export function makeCustoms(scene, rng) {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.7, metalness: 0.4 });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 22), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.9 }));
  floor.position.set(-34, 0.15, -224);
  floor.receiveShadow = true;
  group.add(floor);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 22), wallMat);
  back.position.set(-48.5, 6, -224);
  back.castShadow = true;
  group.add(back);
  for (const sz of [-235, -213]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(30, 12, 1), wallMat);
    side.position.set(-34, 6, sz);
    side.castShadow = true;
    group.add(side);
  }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 22), wallMat);
  roof.position.set(-34, 12.2, -224);
  roof.castShadow = true;
  group.add(roof);
  // front beam over the open bay + pillars
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 22), wallMat);
  beam.position.set(-19.5, 11, -224);
  group.add(beam);
  for (const pz of [-234, -214]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 1), wallMat);
    pillar.position.set(-19.5, 6, pz);
    group.add(pillar);
  }
  const goldGlow = new THREE.PointLight(0xffc93c, 200, 34, 1.5);
  goldGlow.position.set(-26, 4, -224);
  group.add(goldGlow);
  const bayLight = new THREE.PointLight(0xffe9a8, 80, 22, 1.6);
  bayLight.position.set(-21, 3.5, -219);
  group.add(bayLight);
  const signTex = textSpriteTexture('AZURA CUSTOMS', '#ffd34d', 'rgba(10,10,18,0.95)');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
  sign.position.set(-18.8, 10.6, -224);
  sign.rotation.y = Math.PI / 2;
  group.add(sign);
  // lift platform inside the bay
  const lift = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.5, 10), new THREE.MeshStandardMaterial({ color: 0x6a7180, roughness: 0.6, metalness: 0.6 }));
  lift.position.set(-24, 0.55, -224);
  group.add(lift);
  // tool cabinets + tyres against the back wall
  for (let i = 0; i < 3; i++) {
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1), new THREE.MeshStandardMaterial({ color: pick(rng, [0xd83a3a, 0x2a6fd8, 0xffc93c]), roughness: 0.5, metalness: 0.5 }));
    cab.position.set(-46.5, 1.1, -232 + i * 3.4);
    group.add(cab);
  }
  for (let i = 0; i < 4; i++) {
    const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.24, 10, 18), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }));
    tyre.position.set(-45.5, 0.55 + (i % 2) * 1.1, -218 + Math.floor(i / 2) * 1.4);
    tyre.rotation.y = Math.PI / 2;
    group.add(tyre);
  }
  scene.add(group);
  return { door: new THREE.Vector3(-19, 0, -224), lift };
}

// ---- street props: lamps, traffic lights, billboards, benches -------------
export function makeStreetProps(scene, rng, colliders) {
  const lamps = [];
  for (let z = -270; z < 275; z += 54) {
    if (z > -240 && z < -200) continue; // keep the customs plaza clear
    for (const sx of [-1, 1]) {
      const x = sx * 14.6;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8), new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.6, metalness: 0.6 }));
      pole.position.set(x, 3.75, z);
      pole.castShadow = true;
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), pole.material);
      arm.rotation.z = Math.PI / 2;
      arm.position.set(x - sx * 1, 7.4, z);
      scene.add(arm);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffe9a8, emissiveIntensity: 2.2 }));
      head.position.set(x - sx * 2, 7.35, z);
      scene.add(head);
      lamps.push(head);
    }
  }
  // traffic lights at the market crossing, on the west sidewalk
  for (const z of [-84, 66]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 6.5, 8), new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.6, roughness: 0.5 }));
    pole.position.set(-12.5, 3.25, z);
    scene.add(pole);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.7), new THREE.MeshStandardMaterial({ color: 0x111318 }));
    box.position.set(-12.5, 6.6, z);
    scene.add(box);
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.22, 12), new THREE.MeshBasicMaterial({ color: i === 0 ? 0xff4444 : 0x331111 }));
      lamp.position.set(-12.5, 7.2 - i * 0.55, z + 0.36);
      scene.add(lamp);
    }
  }
  // billboards
  const bb1 = textSpriteTexture('AZURA BAY ★', '#ffd34d', '#101c3a');
  const board1 = new THREE.Mesh(new THREE.PlaneGeometry(16, 6), new THREE.MeshBasicMaterial({ map: bb1 }));
  board1.position.set(-24, 16, 40);
  board1.rotation.y = Math.PI / 2;
  scene.add(board1);
  const bb2 = textSpriteTexture('GOLD PAINT — 24K', '#7dffb0', '#1a0b2e');
  const board2 = new THREE.Mesh(new THREE.PlaneGeometry(14, 5), new THREE.MeshBasicMaterial({ map: bb2 }));
  board2.position.set(-24, 15, 190);
  board2.rotation.y = Math.PI / 2;
  scene.add(board2);
  // benches + planters on the west sidewalk
  for (let z = -240; z < 260; z += 72) {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }));
    bench.position.set(-14.8, 0.6, z);
    scene.add(bench);
  }
  return { lamps };
}

// ---- build everything -----------------------------------------------------
export function buildWorld(scene, rng) {
  const colliders = [];
  const sky = makeSky(scene);
  const ground = makeGround(scene);
  const buildings = makeBuildings(scene, rng, colliders);
  const palms = makePalms(scene, rng);
  makeBeach(scene, rng);
  const market = makeMarket(scene, rng);
  const customs = makeCustoms(scene, rng);
  const props = makeStreetProps(scene, rng, colliders);

  // lighting: warm low sun from the east so the road-facing facades catch
  // the gold light, plus a cool fill and a bright hemisphere
  const sun = new THREE.DirectionalLight(0xffd9a0, 3.1);
  sun.position.set(200, 95, -80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -160; sun.shadow.camera.right = 160;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fc0ee, 0x4a3a26, 1.2));
  const fill = new THREE.DirectionalLight(0x7fb2ff, 0.5);
  fill.position.set(200, 80, 200);
  scene.add(fill);

  return {
    colliders, ...ground, ...buildings, palms, market, customs, ...props, sky,
    update(dt, t) {
      ground.seaTex.offset.y = t * 0.02;
      ground.seaTex.offset.x = Math.sin(t * 0.1) * 0.01;
      for (const c of sky.clouds) c.position.x += dt * 1.2;
      for (let i = 0; i < market.bulbs.length; i++) {
        const b = market.bulbs[i];
        b.material.color.setHSL(((i % 4) / 4 + Math.sin(t * 2 + i) * 0.02), 0.9, 0.55 + Math.sin(t * 3 + i * 1.7) * 0.12);
      }
    },
  };
}
