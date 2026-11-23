// Azura Bay — shot director. Every screenshot is a frozen instant of real
// action: a pursuit at full speed, a market at full bustle, a gold respray
// mid-burst, a city alive from the air. Each shot is staged from a fixed
// seed, advanced a fixed number of simulation steps, then rendered once —
// so the same shot always comes out the same way.

import * as THREE from 'three';
import { MISSIONS, CREW_LINES, RADIO } from './config.js';
import { createCar, createHelicopter, createScooter, flashPolice, spinWheels } from './vehicles.js';
import { createPedestrian, walkPedestrian } from './people.js';
import * as HUD from './hud.js';

function softTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const dustTex = softTexture('rgba(255,240,210,0.85)', 'rgba(255,240,210,0)');
const goldTex = softTexture('rgba(255,215,80,0.95)', 'rgba(255,180,40,0)');
const steamTex = softTexture('rgba(255,255,255,0.7)', 'rgba(255,255,255,0)');

function burst(scene, tex, origin, count, spread, size, color) {
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false });
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(mat);
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    s.position.set(origin.x + Math.cos(a) * r, origin.y + Math.random() * spread * 0.7, origin.z + Math.sin(a) * r);
    const sc = size * (0.5 + Math.random());
    s.scale.set(sc, sc, 1);
    s.material.opacity = 0.55 + Math.random() * 0.4;
    group.add(s);
  }
  scene.add(group);
  return group;
}

// Speed streaks rushing past the camera: thin bright planes.
function speedLines(scene, camera, count) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, depthWrite: false });
  for (let i = 0; i < count; i++) {
    const len = 6 + Math.random() * 10;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, len), mat);
    const side = Math.random() < 0.5 ? -1 : 1;
    line.position.set(
      camera.position.x + side * (4 + Math.random() * 14),
      0.8 + Math.random() * 5,
      camera.position.z - 10 - Math.random() * 70,
    );
    line.rotation.x = -Math.PI / 2 + 0.12;
    line.rotation.z = (Math.random() - 0.5) * 0.3;
    group.add(line);
  }
  scene.add(group);
  return group;
}

function placePolice(game, spots) {
  for (const s of spots) {
    const car = createCar({ police: true, length: 4.6 });
    car.position.set(s.x, 0, s.z);
    car.rotation.y = s.heading - Math.PI / 2;
    game.scene.add(car);
    game.police.push({ mesh: car, x: s.x, z: s.z, heading: s.heading, speed: s.speed || 30 });
  }
}

function placeTraffic(game, spots) {
  for (const s of spots) {
    const car = createCar({ color: s.color, length: 4.4 });
    car.position.set(s.x, 0, s.z);
    car.rotation.y = s.heading - Math.PI / 2;
    game.scene.add(car);
    game.traffic.push({ mesh: car, x: s.x, z: s.z, lane: s.x, dir: 1, speed: 12, swerve: 0 });
  }
}

function placeHeli(game, x, y, z, bank) {
  // reuse the scene's own helicopter (created at boot) so the light count
  // never changes between the live game and the staged shots
  const heli = game.heli || createHelicopter();
  if (!game.heli) game.scene.add(heli);
  heli.position.set(x, y, z);
  heli.rotation.z = bank || 0.18;
  heli.rotation.y = 0.5;
  heli.visible = true;
  game.heli = heli;
  return heli;
}

function setCam(game, pos, target) {
  game.camera.position.set(pos[0], pos[1], pos[2]);
  game.camera.lookAt(target[0], target[1], target[2]);
  game.shotCamera = { pos, target };
}

function baseHud(missionIdx, dialogueIdx) {
  HUD.setMission(MISSIONS[missionIdx]);
  HUD.setResponse(6, 5);
  HUD.setVitals(72, 55);
  HUD.setMoney(18450);
  HUD.setStars(5);
  HUD.setClock(16 * 60);
  HUD.setRank(3900, 5200);
  HUD.setAirUnit(true);
  HUD.setRadio(RADIO[0]);
  HUD.setDialogue(CREW_LINES[dialogueIdx].who, CREW_LINES[dialogueIdx].line);
}

// ---- CHASE: 111 km/h down the Strand, police closing, chopper overhead ----
function stageChase(game) {
  const hero = game.hero;
  hero.x = 2.75; hero.z = 62; hero.heading = Math.PI; hero.speed = 30.8;
  hero.mesh.position.set(hero.x, 0, hero.z);
  hero.mesh.rotation.y = hero.heading - Math.PI / 2;
  hero.mesh.rotation.z = -0.035; // leaning into the overtake
  hero.mesh.rotation.x = 0.012;
  placePolice(game, [
    { x: -2.75, z: 24, heading: Math.PI, speed: 28 },
    { x: 8.25, z: 50, heading: Math.PI, speed: 31 },
    { x: -8.25, z: -42, heading: 0, speed: 26 },
  ]);
  placeTraffic(game, [
    { x: -2.75, z: -8, heading: Math.PI, color: 0xf2f4f6 },
    { x: -8.25, z: -58, heading: Math.PI, color: 0x2a6fd8 },
    { x: 8.25, z: -92, heading: Math.PI, color: 0xe83a3a },
    { x: -2.75, z: -126, heading: Math.PI, color: 0xffd34d },
    { x: 8.25, z: -158, heading: Math.PI, color: 0x37b8ff },
  ]);
  // red scooter darting along the beach side, rider leaning
  const scooter = createScooter(0xe83a3a);
  scooter.position.set(8.6, 0, 46);
  scooter.rotation.y = Math.PI / 2 - 0.15;
  game.scene.add(scooter);
  game.scooter = scooter;
  placeHeli(game, -6, 29, 16, 0.22);
  // light dust kicked up behind the hero's rear wheels
  burst(game.scene, dustTex, new THREE.Vector3(2.75, 0.5, 66.5), 6, 1.6, 1.1, 0xffe0b0);
  speedLines(game.scene, { position: new THREE.Vector3(8, 3.6, 72) }, 14);
  setCam(game, [8, 3.6, 72], [-4.5, 1.8, 18]);
  baseHud(5, 0);
  HUD.setDistrict('GOLDEN STRAND', 'Strand Boulevard', 58);
  HUD.setSpeed(111, 'SOLARA GT', 62);
  // settle the action: spin wheels, flash the light bars, bank the heli
  for (let i = 0; i < 40; i++) {
    const t = i / 30;
    for (const p of game.police) { flashPolice(p.mesh, t); spinWheels(p.mesh, p.speed, 1 / 30); }
    spinWheels(hero.mesh, hero.speed, 1 / 30);
    if (game.heli) game.heli.userData.rotor.rotation.y = t * 22;
  }
}

// ---- MARKET: neon bustle, crowd mid-stride, headlights sweeping in -------
function stageMarket(game) {
  const hero = game.hero;
  hero.x = -10; hero.z = -14; hero.heading = Math.PI; hero.speed = 5.5;
  hero.mesh.position.set(hero.x, 0, hero.z);
  hero.mesh.rotation.y = hero.heading - Math.PI / 2;
  hero.mesh.rotation.z = 0;
  // night-market dusk: darken the sky dome, dim the sun, let neon own it
  const sky = game.world.sky.mat;
  sky.uniforms.top.value.set(0x0e1a3a);
  sky.uniforms.mid.value.set(0x2a3a6a);
  sky.uniforms.low.value.set(0x8a4a5a);
  game.sun.intensity = 0.5;
  game.sun.color.set(0xff9a6a);
  game.scene.fog.color.set(0x5a4468);
  // crowd flooding the market street, mid-stride all around the car
  const spots = [
    [-13, -30, 0.4], [-4, -34, 2.6], [-12, -8, 5.1], [-5, -2, 1.2],
    [-16, -44, 3.8], [-3, -52, 0.9], [-14, 8, 4.4], [-6, 14, 2.2],
    [-18, -18, 5.6], [-2, -24, 3.3], [-15, -64, 1.7], [-4, 6, 0.2],
    [-10, -16, 2.9], [-14, -24, 0.7], [-7, -38, 4.1], [-17, -4, 1.9],
    [-3, -14, 5.5], [-11, 2, 3.6], [15.5, -12, 2.4], [16, -30, 0.8],
  ];
  for (const [x, z, h] of spots) {
    const p = createPedestrian(game.rng);
    p.position.set(x, 0, z);
    p.rotation.y = h;
    walkPedestrian(p, 0, 0.6 + z * 0.13); // frozen mid-stride
    game.scene.add(p);
    game.shotPeds.push(p);
  }
  // vendor flipping food — steam bursting off the grill
  burst(game.scene, steamTex, new THREE.Vector3(-19, 2.2, -28), 12, 1.6, 1.6, 0xffffff);
  burst(game.scene, steamTex, new THREE.Vector3(-19, 2.2, -44), 9, 1.4, 1.4, 0xffffff);
  // a second car nosing in behind, headlights on
  placeTraffic(game, [
    { x: 2.75, z: -44, heading: Math.PI, color: 0x2a6fd8 },
    { x: 8.25, z: -52, heading: 0, color: 0xffd34d },
  ]);
  placeHeli(game, 30, 48, -50, 0.1);
  setCam(game, [-1, 3.2, -1], [-14, 1.6, -28]);
  baseHud(1, 3);
  HUD.setMission(MISSIONS[1]);
  HUD.setDistrict('NEON ROW', 'Lantern Avenue', 74);
  HUD.setSpeed(19, 'SOLARA GT', 12);
  HUD.setClock(20 * 60 + 24);
  HUD.setStars(2);
  HUD.setResponse(2, 2);
  HUD.setDialogue('KIKI', 'Two units on Lantern, one chopper overhead. Market crowd is your cover.');
}

// ---- CUSTOM: gold respray mid-burst, mechanic spraying, sparks flying -----
function stageCustom(game) {
  const hero = game.hero;
  // gold car up on the lift inside the open bay, nose out toward the street
  hero.x = -24; hero.z = -224; hero.heading = Math.PI / 2; hero.speed = 0;
  hero.mesh.traverse((o) => {
    if (o.isMesh && o.material && o.material.metalness !== undefined && o.material.color) {
      if (o.material.color.getHex() === 0xff8a1e) {
        o.material.color.set(0xffc93c);
        o.material.roughness = 0.16;
        o.material.emissive.set(0x664400);
        o.material.emissiveIntensity = 0.4;
      }
    }
  });
  hero.mesh.position.set(hero.x, 0.55, hero.z);
  hero.mesh.rotation.y = hero.heading - Math.PI / 2;
  hero.mesh.rotation.z = 0;
  // mechanic mid-spray: arm up, gold mist bursting from the gun to the door
  const mech = createPedestrian(game.rng);
  mech.position.set(-16.5, 0, -219);
  mech.rotation.y = Math.PI / 2 + 0.4;
  walkPedestrian(mech, 0, 0.9);
  game.scene.add(mech);
  game.shotPeds.push(mech);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.14), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 }));
  gun.position.set(-18.2, 1.35, -220.5);
  gun.rotation.z = -0.3;
  game.scene.add(gun);
  burst(game.scene, goldTex, new THREE.Vector3(-20.5, 1.3, -222.5), 26, 1.8, 0.9, 0xffd34d);
  burst(game.scene, goldTex, new THREE.Vector3(-22, 0.9, -223.5), 18, 1.2, 0.7, 0xffc93c);
  // sparks off the grinder at the rear wheel
  burst(game.scene, goldTex, new THREE.Vector3(-26.5, 0.5, -226.5), 16, 1.1, 0.45, 0xfff2a0);
  // gold paint cans + a second gold car waiting outside
  for (let i = 0; i < 4; i++) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 0.9, roughness: 0.25 }));
    can.position.set(-17, 0.3, -228 + i * 0.8);
    game.scene.add(can);
  }
  placeTraffic(game, [
    { x: 2.75, z: -186, heading: Math.PI, color: 0xffc93c },
    { x: -2.75, z: -176, heading: Math.PI, color: 0x2a6fd8 },
  ]);
  game.sun.intensity = 1.4;
  setCam(game, [-4, 3.8, -202], [-25, 2.4, -224]);
  baseHud(2, 2);
  HUD.setMission(MISSIONS[2]);
  HUD.setDistrict('GOLDEN STRAND', 'Azura Customs', 81);
  HUD.setSpeed(0, 'SOLARA GT · 24K GOLD', 0);
  HUD.setClock(18 * 60 + 40);
  HUD.setStars(0);
  HUD.setResponse(0, 0);
  HUD.setAirUnit(false);
  HUD.setDialogue('RIO', 'Gold paint is still wet, boss. One scratch and I charge you double.');
  for (let i = 0; i < 30; i++) spinWheels(hero.mesh, 0, 0);
}

// ---- MAP: the whole city alive from the air --------------------------------
const mapOverlay = document.createElement('div');
mapOverlay.id = 'map-overlay';
mapOverlay.style.cssText = 'position:fixed;inset:0;z-index:6;pointer-events:none;display:none;font-family:Anton,Arial,sans-serif;';
document.body.appendChild(mapOverlay);

function stageMap(game) {
  const hero = game.hero;
  hero.x = 2.75; hero.z = -40; hero.heading = Math.PI; hero.speed = 24;
  hero.mesh.position.set(hero.x, 0, hero.z);
  hero.mesh.rotation.y = hero.heading - Math.PI / 2;
  placePolice(game, [
    { x: -2.75, z: -12, heading: Math.PI, speed: 26 },
    { x: 8.25, z: 4, heading: Math.PI, speed: 25 },
  ]);
  placeTraffic(game, [
    { x: -2.75, z: -90, heading: Math.PI, color: 0xf2f4f6 },
    { x: 8.25, z: -140, heading: Math.PI, color: 0xe83a3a },
    { x: -8.25, z: 60, heading: Math.PI, color: 0x2a6fd8 },
    { x: 2.75, z: 120, heading: 0, color: 0xffd34d },
    { x: -2.75, z: 180, heading: Math.PI, color: 0x37b8ff },
    { x: 8.25, z: -200, heading: Math.PI, color: 0x9fd8c9 },
  ]);
  placeHeli(game, -30, 60, -90, 0.15);
  // light trails: traffic at speed leaves long glowing streaks
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.65 });
  const trailMat2 = new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.65 });
  for (let i = 0; i < 8; i++) {
    const lane = [-8.25, -2.75, 2.75, 8.25][i % 4];
    const z = -220 + i * 52;
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 26), i % 2 ? trailMat2 : trailMat);
    trail.rotation.x = -Math.PI / 2;
    trail.position.set(lane, 0.12, z);
    game.scene.add(trail);
  }
  setCam(game, [100, 195, 205], [-8, 0, -30]);
  game.camera.updateMatrixWorld(true); // projections below need the fresh matrices
  baseHud(5, 4);
  HUD.setDistrict('AZURA BAY', 'Whole city — live', 92);
  HUD.setSpeed(86, 'SOLARA GT', 34);
  HUD.setClock(17 * 60 + 12);
  // district labels projected onto the aerial view, with screen offsets so
  // they never collide; dialogue is hidden for the map shot
  document.getElementById('dialogue').style.display = 'none';
  const labels = [
    { text: 'AZURA BAY', sub: 'CITY OF GLASS AND GOLD', x: -60, y: 0, z: -260, size: 36, dx: 0, dy: -100 },
    { text: 'GOLDEN STRAND', sub: 'BEACH BOULEVARD', x: 45, y: 0, z: -60, size: 24, dx: 150, dy: 30 },
    { text: 'NEON ROW', sub: 'NIGHT MARKET', x: -30, y: 0, z: -10, size: 24, dx: -150, dy: -30 },
    { text: 'MARINA QUAY', sub: 'HARBOUR DRIVE', x: -15, y: 0, z: 130, size: 24, dx: 40, dy: 30 },
    { text: 'AZURA CUSTOMS', sub: '24K GOLD PAINT', x: -40, y: 0, z: -224, size: 18, dx: -140, dy: 40 },
  ];
  const v = new THREE.Vector3();
  let html = '';
  for (const L of labels) {
    v.set(L.x, L.y, L.z).project(game.camera);
    if (v.z > 1) continue;
    const sx = (v.x * 0.5 + 0.5) * window.innerWidth + L.dx;
    const sy = (-v.y * 0.5 + 0.5) * window.innerHeight + L.dy;
    html += '<div style="position:absolute;left:' + sx.toFixed(0) + 'px;top:' + sy.toFixed(0) + 'px;transform:translate(-50%,-50%);text-align:center;text-shadow:0 2px 8px rgba(0,0,0,.85)">'
      + '<div style="font-size:' + L.size + 'px;color:#ffe9a8;letter-spacing:2px">' + L.text + '</div>'
      + '<div style="font-size:12px;color:#7dffb0;letter-spacing:3px;font-family:sans-serif;font-weight:700">' + L.sub + '</div></div>';
  }
  // route line across the city, top centre where nothing else sits
  html += '<div style="position:absolute;left:50%;top:14px;transform:translateX(-50%);background:rgba(8,12,26,.75);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:8px 12px;font-family:sans-serif;text-align:center">'
    + '<div style="font-family:Anton,sans-serif;font-size:16px;color:#ffe9a8">ROUTE — THE GLASS RUN</div>'
    + '<div style="font-size:12px;color:#cfe3ff">Customs → Neon Row → Golden Strand → Marina Quay · 4.2 km · 2:41 best</div></div>';
  mapOverlay.innerHTML = html;
  mapOverlay.style.display = 'block';
  for (let i = 0; i < 40; i++) {
    const t = i / 30;
    for (const p of game.police) flashPolice(p.mesh, t);
    if (game.heli) game.heli.userData.rotor.rotation.y = t * 22;
  }
}

export function stageShot(game, name) {
  game.shotPeds = [];
  if (name === 'chase') stageChase(game);
  else if (name === 'market') stageMarket(game);
  else if (name === 'custom') stageCustom(game);
  else if (name === 'map') stageMap(game);
  else stageChase(game);
}
