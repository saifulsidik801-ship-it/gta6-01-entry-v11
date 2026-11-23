// Azura Bay — vehicles. Shaped-mesh wedge cars: a side-profile Shape
// extruded with a bevel, never a box. Lathe helicopter, tube-trunk palms
// live in world.js. Police light bars flash real red/blue point lights.

import * as THREE from 'three';
import { range, pick } from './random.js';

// Wedge side profile: low nose, long hood, raked cabin, short tail.
function wedgeShape(len, h) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0.28);
  s.lineTo(-len / 2 + 0.25, 0.62);          // tail deck
  s.lineTo(-len * 0.12, 0.78);              // rear window base
  s.lineTo(len * 0.08, 1.18);               // roof rear
  s.lineTo(len * 0.28, 1.22);               // roof
  s.lineTo(len * 0.44, 0.82);               // windshield base
  s.lineTo(len / 2 - 0.15, 0.62);           // nose tip
  s.lineTo(len / 2, 0.34);
  s.lineTo(len / 2 - 0.3, 0.22);
  s.lineTo(-len / 2 + 0.3, 0.22);
  s.closePath();
  return s;
}

function glassShape(len) {
  const s = new THREE.Shape();
  s.moveTo(-len * 0.10, 0.8);
  s.lineTo(len * 0.07, 1.14);
  s.lineTo(len * 0.26, 1.17);
  s.lineTo(len * 0.42, 0.8);
  s.closePath();
  return s;
}

export function createCar(opts = {}) {
  const {
    color = 0xff7a1a, length = 4.6, width = 1.9, police = false,
    spoiler = false, gold = false,
  } = opts;
  const car = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color, metalness: 0.6, roughness: gold ? 0.18 : 0.3,
    emissive: gold ? 0x664400 : 0x000000, emissiveIntensity: gold ? 0.35 : 0,
  });
  const bodyGeo = new THREE.ExtrudeGeometry(wedgeShape(length, 1.2), {
    depth: width - 0.3, bevelEnabled: true, bevelThickness: 0.14, bevelSize: 0.14, bevelSegments: 2, steps: 1,
  });
  bodyGeo.translate(0, 0, -(width - 0.3) / 2);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  car.add(body);

  // glass canopy
  const glassGeo = new THREE.ExtrudeGeometry(glassShape(length), {
    depth: width - 0.55, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, steps: 1,
  });
  glassGeo.translate(0, 0, -(width - 0.55) / 2);
  const glass = new THREE.Mesh(glassGeo, new THREE.MeshStandardMaterial({
    color: 0x0e1420, metalness: 0.9, roughness: 0.12,
  }));
  car.add(glass);

  // wheels: dark tyres + bright rims, spin around the z axle
  const wheels = [];
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
  const rimMat = new THREE.MeshStandardMaterial({ color: gold ? 0xffd34d : 0xd8dde6, metalness: 0.9, roughness: 0.25 });
  for (const [wx, wz] of [[length * 0.32, width / 2 - 0.05], [length * 0.32, -(width / 2 - 0.05)], [-length * 0.32, width / 2 - 0.05], [-length * 0.32, -(width / 2 - 0.05)]]) {
    const wheel = new THREE.Group();
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), tyreMat);
    tyre.rotation.x = Math.PI / 2;
    tyre.castShadow = true;
    wheel.add(tyre);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 10), rimMat);
    rim.rotation.x = Math.PI / 2;
    wheel.add(rim);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.34), rimMat);
      spoke.rotation.z = (i / 5) * Math.PI;
      wheel.add(spoke);
    }
    wheel.position.set(wx, 0.42, wz);
    car.add(wheel);
    wheels.push(wheel);
  }

  // headlights: emissive + a real beam for the hero car
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: 3 });
  for (const hz of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.42), headMat);
    lamp.position.set(length / 2 + 0.02, 0.52, hz);
    car.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff2222, emissiveIntensity: 2.4 });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, width - 0.5), tailMat);
  tail.position.set(-length / 2 - 0.02, 0.56, 0);
  car.add(tail);

  if (spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, width - 0.2), paint);
    wing.position.set(-length / 2 + 0.15, 1.12, 0);
    wing.castShadow = true;
    car.add(wing);
    for (const sz of [-0.6, 0.6]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.1), paint);
      strut.position.set(-length / 2 + 0.15, 0.9, sz);
      car.add(strut);
    }
  }

  let lightBar = null;
  let redLight = null;
  let blueLight = null;
  if (police) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 1.1), new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.4 }));
    bar.position.set(-0.1, 1.32, 0);
    car.add(bar);
    const redMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1a1a, emissiveIntensity: 4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x000033, emissive: 0x2266ff, emissiveIntensity: 4 });
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), redMat);
    red.position.set(-0.1, 1.42, -0.28);
    car.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), blueMat);
    blue.position.set(-0.1, 1.42, 0.28);
    car.add(blue);
    redLight = new THREE.PointLight(0xff2222, 0, 16, 1.6);
    redLight.position.set(-0.1, 1.9, -0.3);
    car.add(redLight);
    blueLight = new THREE.PointLight(0x2266ff, 0, 16, 1.6);
    blueLight.position.set(-0.1, 1.9, 0.3);
    car.add(blueLight);
    lightBar = { red, blue, redMat, blueMat };
    // police livery: white doors, black hood — paint the body two-tone
    body.material = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 0.5, roughness: 0.35 });
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, width - 0.4), new THREE.MeshStandardMaterial({ color: 0x14181f, metalness: 0.5, roughness: 0.4 }));
    hood.position.set(length * 0.32, 0.86, 0);
    car.add(hood);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x14181f }));
    door.position.set(0, 0.55, width / 2 + 0.01);
    car.add(door);
    const door2 = door.clone();
    door2.position.z = -(width / 2 + 0.01);
    door2.rotation.y = Math.PI;
    car.add(door2);
  }

  car.userData.wheels = wheels;
  car.userData.lightBar = lightBar;
  car.userData.redLight = redLight;
  car.userData.blueLight = blueLight;
  return car;
}

export function flashPolice(car, t) {
  const lb = car.userData.lightBar;
  if (!lb) return;
  const phase = Math.floor(t * 6) % 2 === 0;
  lb.redMat.emissiveIntensity = phase ? 5 : 0.4;
  lb.blueMat.emissiveIntensity = phase ? 0.4 : 5;
  if (car.userData.redLight) car.userData.redLight.intensity = phase ? 26 : 0;
  if (car.userData.blueLight) car.userData.blueLight.intensity = phase ? 0 : 26;
}

export function spinWheels(car, speed, dt) {
  for (const w of car.userData.wheels) w.rotation.z -= (speed * dt) / 0.42;
}

// ---- helicopter: lathe fuselage, rotor disc, spotlight --------------------
export function createHelicopter() {
  const heli = new THREE.Group();
  const profile = [];
  profile.push(new THREE.Vector2(0.01, -0.6));
  profile.push(new THREE.Vector2(0.9, -0.55));
  profile.push(new THREE.Vector2(1.35, -0.1));
  profile.push(new THREE.Vector2(1.25, 0.55));
  profile.push(new THREE.Vector2(0.7, 1.0));
  profile.push(new THREE.Vector2(0.01, 1.1));
  const fus = new THREE.Mesh(
    new THREE.LatheGeometry(profile, 14),
    new THREE.MeshStandardMaterial({ color: 0x4a6a8a, metalness: 0.55, roughness: 0.35 }),
  );
  fus.rotation.x = Math.PI / 2;
  fus.scale.set(1, 1, 1.6);
  fus.castShadow = true;
  heli.add(fus);
  // glass nose
  const nose = new THREE.Mesh(
    new THREE.SphereGeometry(0.85, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0x0e1420, metalness: 0.9, roughness: 0.1 }),
  );
  nose.position.set(0, 0.1, 1.9);
  nose.scale.set(1, 0.8, 0.9);
  heli.add(nose);
  // tail boom + fin + tail rotor
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 4.6, 8), new THREE.MeshStandardMaterial({ color: 0x1c2f4a, metalness: 0.6, roughness: 0.35 }));
  boom.rotation.x = Math.PI / 2;
  boom.position.set(0, 0.25, -3.4);
  heli.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.4, 0.9), new THREE.MeshStandardMaterial({ color: 0x1c2f4a, metalness: 0.6, roughness: 0.35 }));
  fin.position.set(0, 0.9, -5.4);
  heli.add(fin);
  // skids
  for (const sx of [-0.9, 0.9]) {
    const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 }));
    skid.rotation.x = Math.PI / 2;
    skid.position.set(sx, -1.05, 0.3);
    heli.add(skid);
  }
  // main rotor: two blades + blurred disc
  const rotor = new THREE.Group();
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.5, metalness: 0.4 });
  for (const a of [0, Math.PI / 2]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.07, 0.42), bladeMat);
    blade.rotation.y = a;
    rotor.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(4.7, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
  );
  disc.rotation.x = -Math.PI / 2;
  rotor.add(disc);
  rotor.position.y = 1.35;
  heli.add(rotor);
  // searchlight cone + spot
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(5.5, 26, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false }),
  );
  cone.rotation.x = Math.PI;
  cone.position.set(0, -14, 2);
  heli.add(cone);
  const spot = new THREE.SpotLight(0xfff2c0, 900, 60, 0.32, 0.5, 1.2);
  spot.position.set(0, -0.8, 1.5);
  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, -30, 6);
  heli.add(spotTarget);
  spot.target = spotTarget;
  heli.add(spot);
  heli.userData.rotor = rotor;
  heli.userData.spot = spot;
  return heli;
}

// ---- scooter: tiny wedge + rider ------------------------------------------
export function createScooter(color = 0xe83a3a) {
  const sc = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.5, 0.55),
    new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.4 }),
  );
  body.position.y = 0.55;
  body.castShadow = true;
  sc.add(body);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 }));
  seat.position.set(-0.45, 0.86, 0);
  sc.add(seat);
  for (const wx of [0.65, -0.65]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 1 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, 0.3, 0);
    sc.add(wheel);
  }
  // rider leaning forward, mid-ride
  const rider = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffd34d, roughness: 0.9 }));
  torso.position.y = 1.25;
  torso.rotation.x = 0.5;
  rider.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }));
  head.position.set(0.35, 1.72, 0);
  rider.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe83a3a, roughness: 0.3, metalness: 0.4 }));
  helmet.position.set(0.35, 1.74, 0);
  rider.add(helmet);
  rider.position.set(-0.35, 0, 0);
  sc.add(rider);
  return sc;
}

// ---- traffic: lane cars that cruise the boulevard and wrap around ----------
export const TRAFFIC_COLORS = [0xf2f4f6, 0x2a6fd8, 0xe83a3a, 0xffd34d, 0x37b8ff, 0x9fd8c9, 0xc98aff, 0xdddddd];

export function makeTraffic(scene, rng, count) {
  const cars = [];
  const lanes = [-8.25, -2.75, 2.75, 8.25];
  for (let i = 0; i < count; i++) {
    const lane = pick(rng, lanes);
    const dir = lane < 0 ? 1 : -1; // left lanes go north, right lanes south
    const car = createCar({ color: pick(rng, TRAFFIC_COLORS), length: range(rng, 4.1, 4.8) });
    car.position.set(lane + range(rng, -0.3, 0.3), 0, range(rng, -270, 270));
    // car forward is local +x; rotation.y = a - PI/2 maps forward to (sin a, 0, cos a)
    car.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; // northbound / southbound
    scene.add(car);
    cars.push({ mesh: car, lane, dir, speed: range(rng, 10, 16), z: car.position.z, swerve: 0 });
  }
  return cars;
}

export function updateTraffic(cars, dt, heroZ, t) {
  for (const c of cars) {
    c.z += c.dir * c.speed * dt;
    if (c.z > 285) c.z = -285;
    if (c.z < -285) c.z = 285;
    // one nervous driver swerves when the hero is near
    const near = Math.abs(c.z - heroZ) < 26;
    const targetSwerve = near ? Math.sin(t * 2.2 + c.lane) * 1.4 : 0;
    c.swerve += (targetSwerve - c.swerve) * Math.min(1, dt * 3);
    c.mesh.position.z = c.z;
    c.mesh.position.x = c.lane + c.swerve;
    spinWheels(c.mesh, c.speed, dt);
  }
}
