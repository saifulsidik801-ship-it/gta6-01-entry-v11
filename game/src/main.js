// Azura Bay — entry point. Boots the renderer, builds the city, runs the
// arcade driving / on-foot loop, the police chase, missions and the HUD.
// ?shot=chase|market|custom|map stages one frozen action frame for the
// screenshots instead of starting the playable game.

import * as THREE from 'three';
import { CITY, TUNING, MISSIONS, CREW_LINES, RADIO } from './config.js';
import { mulberry32 } from './random.js';
import { buildWorld } from './world.js';
import { createCar, createHelicopter, flashPolice, spinWheels, makeTraffic, updateTraffic } from './vehicles.js';
import { makeCrowd, updateCrowd, createPlayer, walkPedestrian } from './people.js';
import * as HUD from './hud.js';
import { initAudio, setEngine, setSiren, blip } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7);
const shotName = params.get('shot');
const rng = mulberry32(seed);

addEventListener('error', (e) => { window.__SHOT_ERROR__ = String(e.message); });

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
// Software rasterizers (SwiftShader / llvmpipe) cannot push a 2048 PCFSoft
// shadow map at any sane frame rate: detect them and drop to a cheap map,
// and render the live game at half resolution (screenshots keep full res).
// Real GPUs keep the full-quality shadows.
let softwareGL = false;
try {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  softwareGL = /swiftshader|llvmpipe|software/i.test(gpu);
  if (softwareGL) {
    renderer.shadowMap.type = THREE.BasicShadowMap;
    console.log('software GL (' + gpu + '): cheap shadows');
  }
} catch { /* keep full quality */ }
renderer.setPixelRatio(softwareGL && !shotName ? 0.5 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = softwareGL ? THREE.BasicShadowMap : THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.65;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe0a878, 300, 980);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

const world = buildWorld(scene, rng);
const sun = scene.children.find((o) => o.isDirectionalLight && o.castShadow);

const game = {
  scene, camera, renderer, rng, world, sun,
  hero: null, police: [], traffic: [], crowd: [], heli: null,
  scooter: null, shotPeds: [], shotCamera: null,
  state: 'loading',
  money: 18450, rp: 3900, wanted: 3, hp: 72, armour: 55,
  missionIdx: 5, clockMin: 16 * 60, dent: 62, onFoot: false,
  camMode: 0, time: 0,
};
window.__GAME__ = game;

// ---- hero car ---------------------------------------------------------------
const heroMesh = createCar({ color: 0xff8a1e, length: 4.8, spoiler: true });
heroMesh.position.set(2.75, 0, 60);
heroMesh.rotation.y = Math.PI / 2;
scene.add(heroMesh);
// headlight beams
for (const hz of [-0.6, 0.6]) {
  const beam = new THREE.SpotLight(0xfff2c0, 260, 55, 0.42, 0.55, 1.1);
  beam.position.set(2.3, 0.55, hz);
  const tgt = new THREE.Object3D();
  tgt.position.set(24, -0.4, hz * 2.2);
  heroMesh.add(tgt);
  beam.target = tgt;
  heroMesh.add(beam);
}
game.hero = { mesh: heroMesh, x: 2.75, z: 60, heading: Math.PI, speed: 0, steer: 0 };

const player = createPlayer();
player.visible = false;
scene.add(player);

game.traffic = makeTraffic(scene, rng, 14);
game.crowd = makeCrowd(scene, rng, 42);

// ---- police pool: a FIXED set of units, parked at the boulevard ends -----
// Never create or remove lights at runtime: three.js recompiles every
// shader program when the light count changes, which stalls the game for
// seconds under software GL. The pool stays in the scene forever; units
// just drive in from their park spots when wanted, and stand down after.
const PARK_SPOTS = [
  { x: -8.25, z: -272 }, { x: 8.25, z: -272 },
  { x: -8.25, z: 272 }, { x: 8.25, z: 272 },
];
for (let i = 0; i < 4; i++) {
  const car = createCar({ police: true, length: 4.6 });
  car.position.set(PARK_SPOTS[i].x, 0, PARK_SPOTS[i].z);
  car.rotation.y = i < 2 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(car);
  // light bar dim while parked (lights stay in the scene, intensity 0)
  const lb = car.userData.lightBar;
  if (lb) { lb.redMat.emissiveIntensity = 0.3; lb.blueMat.emissiveIntensity = 0.3; }
  if (car.userData.redLight) car.userData.redLight.intensity = 0;
  if (car.userData.blueLight) car.userData.blueLight.intensity = 0;
  game.police.push({
    mesh: car, x: PARK_SPOTS[i].x, z: PARK_SPOTS[i].z,
    heading: Math.PI, speed: 0, active: false, park: PARK_SPOTS[i],
  });
}

// ---- air unit: always in the scene, parked far north-west when idle ------
game.heli = createHelicopter();
game.heli.position.set(-160, 130, -320);
scene.add(game.heli);

// ---- input ------------------------------------------------------------------
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') nextMission();
  if (e.code === 'KeyC') { game.camMode = (game.camMode + 1) % 3; blip(520); }
  if (e.code === 'KeyE') toggleEnterExit();
  if (e.code === 'KeyZ') crewAbility('ZARA', 'Plates swapped — APD lost your trail.');
  if (e.code === 'KeyX') crewAbility('RIO', 'Quick fix — dents patched, armour topped up.');
  if (e.code === 'KeyC' && e.shiftKey) crewAbility('KIKI', 'Eyes out — police positions marked.');
  if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].includes(e.code)) {
    document.querySelectorAll('.wslot').forEach((el, i) => el.classList.toggle('sel', i === Number(e.code.slice(-1)) - 1));
    blip(700);
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });

function crewAbility(name, line) {
  if (game.state !== 'playing') return;
  if (name === 'ZARA') game.wanted = Math.max(0, game.wanted - 2);
  if (name === 'RIO') { game.dent = Math.max(0, game.dent - 30); game.armour = Math.min(100, game.armour + 25); }
  HUD.setDialogue(name, line);
  HUD.toast(name, line, 2200);
  blip(880);
}

function nextMission() {
  game.missionIdx = (game.missionIdx + 1) % MISSIONS.length;
  HUD.setMission(MISSIONS[game.missionIdx]);
  blip(660);
}

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    document.getElementById('pause-screen').style.display = 'flex';
  } else if (game.state === 'paused') {
    game.state = 'playing';
    document.getElementById('pause-screen').style.display = 'none';
  }
}

function toggleEnterExit() {
  if (game.state !== 'playing') return;
  if (!game.onFoot) {
    game.onFoot = true;
    player.visible = true;
    player.position.set(game.hero.x - 3, 0, game.hero.z);
    player.rotation.y = game.hero.heading - Math.PI / 2;
    heroMesh.visible = false;
    HUD.setSpeed(0, 'ON FOOT', game.dent);
  } else {
    const d = Math.hypot(player.position.x - game.hero.x, player.position.z - game.hero.z);
    if (d < 5) {
      game.onFoot = false;
      player.visible = false;
      heroMesh.visible = true;
      HUD.setDialogue('KIRA VOSS', 'Good — wheels beat feet every time in this city.');
    }
  }
}

// ---- save / load -------------------------------------------------------------
function saveGame() {
  try {
    localStorage.setItem('azura-bay-save', JSON.stringify({
      money: game.money, rp: game.rp, missionIdx: game.missionIdx,
      hp: game.hp, armour: game.armour, clockMin: game.clockMin,
    }));
  } catch { /* private mode — play on without saving */ }
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem('azura-bay-save') || 'null');
    if (!s) return;
    game.money = s.money ?? game.money;
    game.rp = s.rp ?? game.rp;
    game.missionIdx = s.missionIdx ?? game.missionIdx;
    game.hp = s.hp ?? game.hp;
    game.armour = s.armour ?? game.armour;
    game.clockMin = s.clockMin ?? game.clockMin;
  } catch { /* ignore a corrupt save */ }
}
loadGame();
setInterval(saveGame, 15000);
addEventListener('beforeunload', saveGame);

// ---- police ------------------------------------------------------------------
function ensurePolice() {
  const want = game.wanted >= 3 ? 4 : game.wanted >= 1 ? 2 : 0;
  for (let i = 0; i < game.police.length; i++) game.police[i].active = i < want;
}

function updatePolice(dt, t) {
  ensurePolice();
  for (const p of game.police) {
    // active units hunt the hero; stood-down units drive back to their park
    const tx = p.active ? game.hero.x : p.park.x;
    const tz = p.active ? game.hero.z : p.park.z;
    const dx = tx - p.x;
    const dz = tz - p.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (!p.active && dist < 3) {
      p.speed = 0;
      flashPolice(p.mesh, 0.5);
      if (p.mesh.userData.redLight) p.mesh.userData.redLight.intensity = 0;
      if (p.mesh.userData.blueLight) p.mesh.userData.blueLight.intensity = 0;
      continue;
    }
    const targetHeading = Math.atan2(dx, dz);
    let dh = targetHeading - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
    const wantSpeed = p.active ? (dist > 60 ? TUNING.policeSpeed : dist > 12 ? 34 : 20) : 16;
    p.speed += (wantSpeed - p.speed) * Math.min(1, dt * 1.2);
    p.x += Math.sin(p.heading) * p.speed * dt;
    p.z += Math.cos(p.heading) * p.speed * dt;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.heading - Math.PI / 2;
    if (p.active) {
      flashPolice(p.mesh, t);
      spinWheels(p.mesh, p.speed, dt);
      if (dist < 4.5) {
        game.dent = Math.min(100, game.dent + 2);
        game.hp = Math.max(0, game.hp - 1);
        game.hero.speed *= 0.94;
        if (Math.random() < 0.02) HUD.setDialogue('KIRA VOSS', 'They are ramming you! Break away down a side street!');
      }
    } else {
      spinWheels(p.mesh, p.speed, dt);
    }
  }
  // air unit: hunts at 3 stars, otherwise holds far north-west
  if (game.heli) {
    const h = game.heli;
    const tx = game.wanted >= 3 ? game.hero.x - 14 : -160;
    const tz = game.wanted >= 3 ? game.hero.z - 30 : -320;
    h.position.x += (tx - h.position.x) * Math.min(1, dt * 0.5);
    h.position.z += (tz - h.position.z) * Math.min(1, dt * 0.5);
    h.position.y = (game.wanted >= 3 ? 42 : 130) + Math.sin(t * 0.7) * 2;
    h.rotation.y = 0.5 + Math.sin(t * 0.3) * 0.2;
    h.rotation.z = 0.12;
    h.userData.rotor.rotation.y = t * 24;
  }
  setSiren(game.wanted > 0 && game.state === 'playing', t);
}

// ---- driving -------------------------------------------------------------------
function updateDriving(dt) {
  const hero = game.hero;
  const fwd = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
  const back = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
  const left = (keys.KeyA || keys.ArrowLeft) ? 1 : 0;
  const right = (keys.KeyD || keys.ArrowRight) ? 1 : 0;
  if (fwd) hero.speed += TUNING.heroAccel * dt;
  if (back) hero.speed -= (hero.speed > 0.5 ? TUNING.heroBrake : TUNING.heroAccel * 0.6) * dt;
  hero.speed -= hero.speed * 0.35 * dt; // drag
  if (!fwd && !back) hero.speed -= Math.sign(hero.speed) * Math.min(Math.abs(hero.speed), 8 * dt);
  hero.speed = Math.max(-14, Math.min(TUNING.heroTopSpeed, hero.speed));
  const steerInput = (left ? 1 : 0) - (right ? 1 : 0);
  const steerAuthority = Math.min(1, Math.abs(hero.speed) / 12);
  hero.heading += steerInput * 1.9 * steerAuthority * dt * Math.sign(hero.speed || 1);
  if (keys.Space) {
    hero.heading += steerInput * 1.4 * dt;
    hero.speed *= (1 - 0.6 * dt);
  }
  hero.x += Math.sin(hero.heading) * hero.speed * dt;
  hero.z += Math.cos(hero.heading) * hero.speed * dt;
  // stay in the world: soft walls at the boulevard ends + beach edge
  if (hero.z > 276) { hero.z = 276; hero.speed *= -0.3; }
  if (hero.z < -276) { hero.z = -276; hero.speed *= -0.3; }
  if (hero.x > 66) { hero.x = 66; hero.speed *= 0.6; }
  if (hero.x < -52) { hero.x = -52; hero.speed *= 0.6; }
  // building collision: simple AABB push-out
  for (const c of world.colliders) {
    if (hero.x > c.x0 - 1.6 && hero.x < c.x1 + 1.6 && hero.z > c.z0 - 1.6 && hero.z < c.z1 + 1.6) {
      const pushL = hero.x - (c.x0 - 1.6);
      const pushR = (c.x1 + 1.6) - hero.x;
      const pushB = hero.z - (c.z0 - 1.6);
      const pushF = (c.z1 + 1.6) - hero.z;
      const m = Math.min(pushL, pushR, pushB, pushF);
      if (m === pushL) hero.x = c.x0 - 1.6;
      else if (m === pushR) hero.x = c.x1 + 1.6;
      else if (m === pushB) hero.z = c.z0 - 1.6;
      else hero.z = c.z1 + 1.6;
      if (Math.abs(hero.speed) > 12) {
        game.dent = Math.min(100, game.dent + 4);
        game.wanted = Math.min(5, game.wanted + 1);
        HUD.toast('CRASH', 'The whole street heard that one.', 1800);
      }
      hero.speed *= 0.45;
    }
  }
  // traffic bumps
  for (const c of game.traffic) {
    const d = Math.hypot(c.mesh.position.x - hero.x, c.mesh.position.z - hero.z);
    if (d < 3.4 && Math.abs(hero.speed) > 4) {
      game.dent = Math.min(100, game.dent + 2);
      hero.speed *= 0.55;
      c.speed = Math.max(4, c.speed - 3);
      if (Math.random() < 0.3) game.wanted = Math.min(5, game.wanted + 1);
    }
  }
  hero.mesh.position.set(hero.x, 0, hero.z);
  hero.mesh.rotation.y = hero.heading - Math.PI / 2;
  hero.mesh.rotation.z = -steerInput * Math.min(0.06, Math.abs(hero.speed) * 0.0012) - (keys.Space ? steerInput * 0.05 : 0);
  spinWheels(hero.mesh, hero.speed, dt);
  setEngine(Math.abs(hero.speed) / TUNING.heroTopSpeed, true);
}

function updateOnFoot(dt) {
  const sprint = keys.ShiftLeft || keys.ShiftRight;
  const sp = (sprint ? 7 : 3.6) * dt;
  let mx = 0, mz = 0;
  if (keys.KeyW || keys.ArrowUp) mz -= 1;
  if (keys.KeyS || keys.ArrowDown) mz += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (mx || mz) {
    const len = Math.hypot(mx, mz);
    player.position.x += (mx / len) * sp;
    player.position.z += (mz / len) * sp;
    player.rotation.y = Math.atan2(mx, mz) - Math.PI / 2 + Math.PI;
    walkPedestrian(player, dt, game.time * 2.2);
    setEngine(0, false);
  }
}

// ---- camera ---------------------------------------------------------------------
function updateCamera(dt) {
  const hero = game.hero;
  if (game.shotCamera) return; // staged shot: camera is fixed
  const back = game.camMode === 0 ? TUNING.camDist : game.camMode === 1 ? 20 : 9;
  const height = game.camMode === 0 ? TUNING.camHeight : game.camMode === 1 ? 12 : 4.5;
  const fx = Math.sin(hero.heading), fz = Math.cos(hero.heading);
  // sit slightly to the car's right so the wedge profile reads three-quarter
  const rx = Math.cos(hero.heading), rz = -Math.sin(hero.heading);
  const tx = hero.x - fx * back + rx * 4.5;
  const tz = hero.z - fz * back + rz * 4.5;
  const k = 1 - Math.pow(0.0001, dt);
  camera.position.x += (tx - camera.position.x) * k;
  camera.position.y += (height - camera.position.y) * k;
  camera.position.z += (tz - camera.position.z) * k;
  camera.lookAt(hero.x + fx * 8 - rx * 1.5, 1.6, hero.z + fz * 8 - rz * 1.5);
}

// ---- mission marker + district -----------------------------------------------------
function districtAt(x, z) {
  if (z > 140) return ['MARINA QUAY', 'Harbour Drive', 66];
  if (x < -6 && z > -90 && z < 70) return ['NEON ROW', 'Lantern Avenue', 74];
  return ['GOLDEN STRAND', 'Strand Boulevard', 58];
}

const MISSION_SPOTS = [
  { x: -24, z: -224 }, { x: -19, z: 0 }, { x: -24, z: -224 },
  { x: 40, z: 250 }, { x: 2.75, z: -260 }, { x: 40, z: 250 },
];

// ---- HUD refresh -------------------------------------------------------------------
function refreshHud() {
  const hero = game.hero;
  HUD.setSpeed(Math.abs(hero.speed) * 3.6, game.onFoot ? 'ON FOOT' : 'SOLARA GT', game.dent);
  HUD.setVitals(game.hp, game.armour);
  HUD.setMoney(game.money);
  HUD.setStars(game.wanted);
  HUD.setClock(game.clockMin);
  const [dn, ds, dp] = districtAt(hero.x, hero.z);
  HUD.setDistrict(dn, ds, dp);
  HUD.drawMinimap({
    hero: { x: hero.x, z: hero.z, heading: hero.heading },
    police: game.police.map((p) => ({ x: p.x, z: p.z })),
    traffic: game.traffic.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
    mission: MISSION_SPOTS[game.missionIdx],
  });
}

// ---- main loop -----------------------------------------------------------------------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (game.state === 'playing') {
    game.time += dt;
    game.clockMin += dt * 0.9;
    if (game.onFoot) updateOnFoot(dt);
    else updateDriving(dt);
    updateTraffic(game.traffic, dt, game.hero.z, game.time);
    updateCrowd(game.crowd, dt, game.time);
    updatePolice(dt, game.time);
    world.update(dt, game.time);
    // mission: reach the marker
    const spot = MISSION_SPOTS[game.missionIdx];
    const d = Math.hypot(game.hero.x - spot.x, game.hero.z - spot.z);
    if (d < 9) {
      game.money += 1250;
      game.rp += 420;
      HUD.setRank(game.rp, 5200);
      HUD.toast('MISSION COMPLETE', MISSIONS[game.missionIdx].obj + ' — $1,250 banked', 3200);
      HUD.setDialogue('KIRA VOSS', 'Clean. The crew is talking about you all over the Strand.');
      blip(990);
      nextMission();
    }
    // wanted slowly cools when no police are close
    if (game.police.length && Math.random() < dt * 0.02) game.wanted = Math.max(0, game.wanted - 1);
    if (game.hp <= 0) {
      game.hp = 72; game.armour = 55; game.wanted = 0; game.dent = 20;
      game.hero.x = 2.75; game.hero.z = 60; game.hero.speed = 0;
      HUD.toast('BUSTED', 'APD impounded the Solara. Kira got it back — this time.', 3400);
    }
    updateCamera(dt);
    refreshHud();
  } else if (game.state === 'shot') {
    world.update(0, 1.2);
  }
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- boot ------------------------------------------------------------------------------
function startPlaying() {
  initAudio();
  document.getElementById('start-screen').style.display = 'none';
  game.state = 'playing';
  HUD.setMission(MISSIONS[game.missionIdx]);
  HUD.setResponse(6, 3);
  HUD.setVitals(game.hp, game.armour);
  HUD.setMoney(game.money);
  HUD.setStars(game.wanted);
  HUD.setClock(game.clockMin);
  HUD.setRank(game.rp, 5200);
  HUD.setAirUnit(true);
  HUD.setRadio(RADIO[0]);
  HUD.setDialogue(CREW_LINES[0].who, CREW_LINES[0].line);
  HUD.toast('AZURA BAY', 'Steal a car. Lose the cops. Own the Strand.', 3000);
}

document.getElementById('play-btn').addEventListener('click', startPlaying);
document.getElementById('resume-btn').addEventListener('click', togglePause);

if (shotName) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('start-screen').style.display = 'none';
  game.state = 'shot';
  // staged shots use only their own placed cars and people: clear the
  // random live traffic and crowd so nothing photobombs the frame
  for (const c of game.traffic) scene.remove(c.mesh);
  game.traffic = [];
  for (const w of game.crowd) scene.remove(w.mesh);
  game.crowd = [];
  stageShot(game, shotName);
  // staged HUD values stand as-is; only the minimap is drawn live
  HUD.drawMinimap({
    hero: { x: game.hero.x, z: game.hero.z, heading: game.hero.heading },
    police: game.police.map((p) => ({ x: p.x, z: p.z })),
    traffic: game.traffic.map((c) => ({ x: c.mesh.position.x, z: c.mesh.position.z })),
    mission: MISSION_SPOTS[game.missionIdx],
  });
  renderer.render(scene, camera);
  window.__SHOT_READY__ = true;
  document.title = 'AZURA BAY — shot ' + shotName;
} else {
  renderer.render(scene, camera);
  document.getElementById('loading').style.display = 'none';
  game.state = 'menu';
  // slow cinematic orbit behind the start screen
  camera.position.set(26, 10, 120);
  camera.lookAt(0, 2, 0);
  // menu orbit (the real loop starts once PLAY is pressed)
  (function menuOrbit() {
    if (game.state !== 'menu') return;
    const t = performance.now() / 1000;
    camera.position.set(Math.sin(t * 0.08) * 60, 14 + Math.sin(t * 0.05) * 3, 90 + Math.cos(t * 0.08) * 40);
    camera.lookAt(0, 2, -20);
    renderer.render(scene, camera);
    requestAnimationFrame(menuOrbit);
  })();
  // keep the world alive behind the menu
  setInterval(() => {
    if (game.state === 'menu') {
      game.time += 0.1;
      updateTraffic(game.traffic, 0.1, 0, game.time);
      updateCrowd(game.crowd, 0.1, game.time);
      world.update(0.1, game.time);
    }
  }, 100);
  // the real loop starts once PLAY is pressed; wire it here so shots stay out
  const playBtn = document.getElementById('play-btn');
  playBtn.addEventListener('click', () => requestAnimationFrame(loop), { once: true });
}
