// Azura Bay — people: pedestrians with swinging legs, market crowds,
// beachgoers, and the on-foot player. All built from capsules and spheres.

import * as THREE from 'three';
import { range, pick } from './random.js';

const SHIRTS = [0xff5e7a, 0x37b8ff, 0xffd34d, 0x7dffb0, 0xffffff, 0xff9a3d, 0xc98aff, 0x2a6fd8];
const SKINS = [0xe8b98a, 0xc98a5a, 0x8a5a34, 0xf2c9a0];

export function createPedestrian(rng) {
  const p = new THREE.Group();
  const shirt = pick(rng, SHIRTS);
  const skin = pick(rng, SKINS);
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.55, 4, 8),
    new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 }),
  );
  body.position.y = 1.05;
  body.castShadow = true;
  p.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), new THREE.MeshStandardMaterial({ color: skin, roughness: 0.8 }));
  head.position.y = 1.62;
  p.add(head);
  // hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.21, 10, 10, 0, Math.PI * 2, 0, Math.PI / 2.4),
    new THREE.MeshStandardMaterial({ color: pick(rng, [0x1a1a1a, 0x4a2a12, 0x777777]), roughness: 1 }),
  );
  hair.position.y = 1.64;
  p.add(hair);
  const legMat = new THREE.MeshStandardMaterial({ color: pick(rng, [0x2a3444, 0x6b5a44, 0xdddddd]), roughness: 0.95 });
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 6), legMat);
  const legR = legL.clone();
  legL.position.set(0, 0.42, 0.11);
  legR.position.set(0, 0.42, -0.11);
  p.add(legL); p.add(legR);
  const armMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.9 });
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.4, 4, 6), armMat);
  const armR = armL.clone();
  armL.position.set(0, 1.1, 0.32);
  armR.position.set(0, 1.1, -0.32);
  p.add(armL); p.add(armR);
  p.userData = { legL, legR, armL, armR, phase: rng() * Math.PI * 2, speed: range(rng, 0.9, 1.7) };
  return p;
}

export function walkPedestrian(p, dt, t) {
  const u = p.userData;
  const swing = Math.sin(t * 5 * u.speed + u.phase) * 0.55;
  u.legL.rotation.x = swing;
  u.legR.rotation.x = -swing;
  u.armL.rotation.x = -swing * 0.7;
  u.armR.rotation.x = swing * 0.7;
}

// A crowd that wanders the sidewalks, the beach and the market plaza.
export function makeCrowd(scene, rng, count) {
  const walkers = [];
  const zones = [
    { x0: -14.5, x1: -12, z0: -270, z1: 270, dir: 1 },   // west sidewalk
    { x0: 15, x1: 17.5, z0: -270, z1: 270, dir: -1 },     // east sidewalk
    { x0: 30, x1: 62, z0: -270, z1: 270, dir: 1 },        // beach
    { x0: -26, x1: -16, z0: -84, z1: 66, dir: 1 },        // market plaza
  ];
  for (let i = 0; i < count; i++) {
    const zone = pick(rng, zones);
    const p = createPedestrian(rng);
    const x = range(rng, zone.x0, zone.x1);
    const z = range(rng, zone.z0, zone.z1);
    p.position.set(x, 0, z);
    p.rotation.y = range(rng, 0, Math.PI * 2);
    scene.add(p);
    walkers.push({
      mesh: p, zone, x, z,
      heading: range(rng, 0, Math.PI * 2),
      speed: p.userData.speed,
      pause: 0,
    });
  }
  return walkers;
}

export function updateCrowd(walkers, dt, t) {
  for (const w of walkers) {
    if (w.pause > 0) { w.pause -= dt; continue; }
    w.x += Math.sin(w.heading) * w.speed * dt;
    w.z += Math.cos(w.heading) * w.speed * dt;
    // stay inside the zone; bounce and pause at the edges
    if (w.x < w.zone.x0 || w.x > w.zone.x1 || w.z < w.zone.z0 || w.z > w.zone.z1) {
      w.heading = w.heading + Math.PI * (0.9 + Math.random() * 0.2);
      w.x = Math.max(w.zone.x0, Math.min(w.zone.x1, w.x));
      w.z = Math.max(w.zone.z0, Math.min(w.zone.z1, w.z));
      w.pause = 0.4 + Math.random() * 1.4;
    }
    w.mesh.position.set(w.x, 0, w.z);
    w.mesh.rotation.y = w.heading - Math.PI / 2;
    walkPedestrian(w.mesh, dt, t);
  }
}

// The player on foot: gold jacket, dark jeans, ready to steal a car.
export function createPlayer() {
  const p = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.26, 0.6, 4, 8),
    new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.7 }),
  );
  jacket.position.y = 1.08;
  jacket.castShadow = true;
  p.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 12), new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.8 }));
  head.position.y = 1.68;
  p.add(head);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.09, 12), new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 0.6 }));
  cap.position.y = 1.84;
  p.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.24), cap.material);
  brim.position.set(0.22, 1.8, 0);
  p.add(brim);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1c2432, roughness: 0.95 });
  const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.55, 4, 6), legMat);
  const legR = legL.clone();
  legL.position.set(0, 0.45, 0.12);
  legR.position.set(0, 0.45, -0.12);
  p.add(legL); p.add(legR);
  const armMat = new THREE.MeshStandardMaterial({ color: 0xffc93c, roughness: 0.7 });
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.45, 4, 6), armMat);
  const armR = armL.clone();
  armL.position.set(0, 1.12, 0.34);
  armR.position.set(0, 1.12, -0.34);
  p.add(armL); p.add(armR);
  p.userData = { legL, legR, armL, armR, phase: 0 };
  return p;
}
