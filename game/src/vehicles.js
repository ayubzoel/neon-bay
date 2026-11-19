// Neon Bay — every vehicle: cars, bikes, boats and planes. All four drive:
// cars and bikes on roads, boats on the water, planes off the airport runway.
// Traffic cars cruise the roads on their own; any parked or NPC car can be stolen.
//
// v2: the update/drive/traffic/enter/exit/spawn logic is unchanged from v1.
// Only the drawing is 3D now: drawVehicle/drawVehicles build pooled
// THREE groups (body + cabin + wheels, hull, fuselage + wings) via the
// renderer's mesh pool. Meshes face +X; rotation.y = -angle (v1 heading).
import { VEHICLE_STATS } from './config.js';
import { activeCharacter } from './state.js';
import { isWater } from './world.js';

const CAR_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#e2e8f0', '#14b8a6', '#f97316'];
const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Falcon', 'Dune', 'Marlin', 'Viper', 'Cruiser'];

let vehicleId = 1;

function makeVehicle(kind, x, y, angle, owner) {
  const stats = VEHICLE_STATS[kind];
  return {
    id: vehicleId++,
    kind, x, y, angle, speed: 0, z: 0, hp: stats.hp, maxHp: stats.hp,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    name: CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)],
    owner: owner || 'parked',
    modSpeed: 0, modArmor: 0,
    waypoint: null, waitTimer: 0,
  };
}

/** Parked cars, traffic, boats at the pier and two planes at the airport. */
export function spawnVehicles(state, world, rng) {
  const list = [];
  for (let i = 0; i < 14; i += 1) {
    const p = world.randomRoadPoint(0);
    list.push(makeVehicle(rng.chance(0.25) ? 'bike' : 'car', p.x, p.y, rng.range(0, Math.PI * 2), 'parked'));
  }
  for (let i = 0; i < 6; i += 1) {
    const p = world.randomRoadPoint(0);
    const v = makeVehicle('car', p.x, p.y, rng.range(0, Math.PI * 2), 'traffic');
    v.waypoint = world.randomRoadPoint(0);
    list.push(v);
  }
  for (let i = 0; i < 3; i += 1) {
    list.push(makeVehicle('boat', 4480 + rng.range(0, 200), rng.range(1200, 3200), rng.range(0, Math.PI * 2), 'parked'));
  }
  list.push(makeVehicle('plane', 2350, 2945, 0, 'parked'));
  list.push(makeVehicle('plane', 2500, 2945, 0, 'parked'));
  // The player's starter car, parked by the safe house.
  const starter = makeVehicle('car', 620, 1620, 0, 'player');
  starter.color = '#22d3ee';
  starter.name = 'Neon Comet';
  list.push(starter);
  state.vehicles = list;
}

export function nearestVehicle(state, maxDist) {
  const hero = activeCharacter(state);
  let best = null;
  let bestD = maxDist;
  for (const v of state.vehicles) {
    if (v.hp <= 0) continue;
    const d = Math.hypot(v.x - hero.x, v.y - hero.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function enterVehicle(state, vehicle) {
  state.playerVehicle = vehicle;
  vehicle.owner = 'player';
  // The player's bought mods apply to any car they drive.
  vehicle.modSpeed = state.mods.engine || 0;
  if (state.mods.paint) vehicle.color = '#d946ef';
  const hero = activeCharacter(state);
  hero.x = vehicle.x;
  hero.y = vehicle.y;
  return vehicle;
}

export function exitVehicle(state) {
  const v = state.playerVehicle;
  if (!v) return;
  const hero = activeCharacter(state);
  hero.x = v.x + Math.cos(v.angle + Math.PI / 2) * 34;
  hero.y = v.y + Math.sin(v.angle + Math.PI / 2) * 34;
  v.speed = 0;
  state.playerVehicle = null;
}

function driveVehicle(state, world, v, dt, input) {
  const stats = VEHICLE_STATS[v.kind];
  const maxSpeed = stats.maxSpeed + (v.modSpeed || 0);
  const forward = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -0.55 : 0;
  const steer = input.moveX();
  if (v.kind === 'plane' && v.z > 0) {
    v.speed = Math.min(maxSpeed, v.speed + stats.accel * 0.6 * dt);
  } else if (forward !== 0) {
    v.speed += forward * stats.accel * dt;
    v.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, v.speed));
  } else {
    v.speed *= Math.max(0, 1 - dt * 1.4);
    if (Math.abs(v.speed) < 4) v.speed = 0;
  }
  if (Math.abs(v.speed) > 8) v.angle += steer * stats.turn * dt * Math.sign(v.speed) * Math.min(1, Math.abs(v.speed) / 120);
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  const radius = v.kind === 'bike' ? 12 : v.kind === 'plane' ? 26 : 16;
  if (v.kind === 'boat') {
    if (isWater(nx, ny)) {
      v.x = nx;
      v.y = ny;
    } else {
      v.speed *= 0.5;
    }
  } else if (v.kind === 'plane' && v.z > 0) {
    v.x = nx;
    v.y = ny;
    v.z = Math.min(320, v.z + dt * 60);
    if (input.moveY() > 0) v.z = Math.max(0, v.z - dt * 90);
  } else {
    const onRunway = nx > 2200 && nx < 2760 && ny > 2880 && ny < 3010;
    if (!world.collides(nx, v.y, radius, state.unlocked)) v.x = nx;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
    }
    if (!world.collides(v.x, ny, radius, state.unlocked)) v.y = ny;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
    }
    if (v.kind === 'plane' && onRunway && v.speed > stats.takeoffSpeed) v.z = 4;
  }
  if (v.hp <= 0 && state.playerVehicle === v) {
    exitVehicle(state);
  }
}

function updateTraffic(state, world, dt, rng) {
  for (const v of state.vehicles) {
    if (v.owner !== 'traffic' || v.hp <= 0) continue;
    if (!v.waypoint || Math.hypot(v.waypoint.x - v.x, v.waypoint.y - v.y) < 40) {
      v.waypoint = world.randomRoadPoint(0);
    }
    const target = Math.atan2(v.waypoint.y - v.y, v.waypoint.x - v.x);
    let diff = target - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const stats = VEHICLE_STATS[v.kind];
    v.speed = Math.min(150, v.speed + stats.accel * 0.4 * dt);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (!world.collides(nx, ny, 14, state.unlocked)) {
      v.x = nx;
      v.y = ny;
    } else {
      v.waypoint = world.randomRoadPoint(0);
      v.angle += Math.PI / 2;
    }
    void rng;
  }
}

export function updateVehicles(state, world, dt, input, rng) {
  if (state.playerVehicle) {
    const v = state.playerVehicle;
    driveVehicle(state, world, v, dt, input);
    const hero = activeCharacter(state);
    hero.x = v.x;
    hero.y = v.y;
    hero.angle = v.angle;
    state.camera.x = v.x;
    state.camera.y = v.y;
  }
  updateTraffic(state, world, dt, rng);
}

// ---------------------------------------------------------------------------
// 3D drawing (v2) — pooled groups, shared geometry/materials.
// ---------------------------------------------------------------------------

const _geo = new Map();
function geo(key, make) {
  if (!_geo.has(key)) _geo.set(key, make());
  return _geo.get(key);
}
const _mat = new Map();
function mat(key, make) {
  if (!_mat.has(key)) _mat.set(key, make());
  return _mat.get(key);
}
const bodyMat = (color) => mat(`body-${color}`, () => {
  const m = new THREE.MeshLambertMaterial({ color });
  bodyMats.add(m);
  return m;
});
const bodyMats = new Set();
const glassMat = () => mat('glass', () => new THREE.MeshLambertMaterial({ color: '#0f172a' }));
const tyreMat = () => mat('tyre', () => new THREE.MeshLambertMaterial({ color: '#111827' }));
const whiteMat = () => mat('white', () => new THREE.MeshLambertMaterial({ color: '#f8fafc' }));
const smokeMat = () => mat('smoke', () => new THREE.MeshLambertMaterial({ color: '#6b7280', transparent: true, opacity: 0.8 }));

function unitBox() {
  return geo('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
}
function box(w, h, d, material) {
  const m = new THREE.Mesh(unitBox(), material);
  m.scale.set(w, h, d);
  return m;
}
function wheel(r, w) {
  const m = new THREE.Mesh(geo(`wheel-${r}-${w}`, () => new THREE.CylinderGeometry(r, r, w, 10)), tyreMat());
  m.rotation.x = Math.PI / 2; // axle along Z (car faces +X)
  return m;
}
function blobShadow(rx, rz) {
  // Own material per shadow: opacity varies per vehicle (flying plane).
  const m = new THREE.Mesh(geo('blob-circle', () => new THREE.CircleGeometry(1, 20)),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.scale.set(rx, rz, 1);
  return m;
}

function buildCarGroup(v) {
  const g = new THREE.Group();
  const body = box(46, 10, 22, bodyMat(v.color));
  body.position.y = 8;
  g.add(body);
  const cabin = box(20, 8, 18, glassMat());
  cabin.position.set(-2, 16, 0);
  g.add(cabin);
  const wheelPos = [[15, 11], [15, -11], [-15, 11], [-15, -11]];
  for (const [wx, wz] of wheelPos) {
    const w = wheel(5.5, 4);
    w.position.set(wx, 5.5, wz);
    g.add(w);
  }
  const shadow = blobShadow(30, 16);
  shadow.position.y = 0.7;
  g.add(shadow);
  g.userData.shadow = shadow;
  const smoke = new THREE.Mesh(geo('smoke-ball', () => new THREE.SphereGeometry(7, 8, 6)), smokeMat());
  smoke.position.set(-14, 16, 0);
  smoke.visible = false;
  g.add(smoke);
  g.userData.smoke = smoke;
  return g;
}

function buildBikeGroup(v) {
  const g = new THREE.Group();
  const frame = box(34, 5, 8, bodyMat(v.color));
  frame.position.y = 9;
  g.add(frame);
  const seat = box(10, 4, 7, glassMat());
  seat.position.set(-8, 13, 0);
  g.add(seat);
  for (const wx of [13, -13]) {
    const w = wheel(7, 3);
    w.position.set(wx, 7, 0);
    g.add(w);
  }
  const shadow = blobShadow(22, 10);
  shadow.position.y = 0.7;
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

function buildBoatGroup(v) {
  const g = new THREE.Group();
  const hull = box(52, 9, 20, bodyMat(v.color));
  hull.position.y = 4;
  g.add(hull);
  const deck = box(20, 6, 14, whiteMat());
  deck.position.set(-4, 11, 0);
  g.add(deck);
  const mast = box(3, 22, 3, whiteMat());
  mast.position.set(4, 20, 0);
  g.add(mast);
  const shadow = blobShadow(32, 14);
  shadow.position.y = 0.7;
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

function buildPlaneGroup(v) {
  const g = new THREE.Group();
  const fuselage = box(64, 9, 12, bodyMat(v.color));
  fuselage.position.y = 10;
  g.add(fuselage);
  const wing = box(16, 2, 52, bodyMat(v.color));
  wing.position.set(2, 10, 0);
  g.add(wing);
  const tailWing = box(10, 2, 24, bodyMat(v.color));
  tailWing.position.set(-28, 11, 0);
  g.add(tailWing);
  const tailFin = box(10, 14, 2, bodyMat(v.color));
  tailFin.position.set(-28, 18, 0);
  g.add(tailFin);
  const nose = box(8, 7, 10, glassMat());
  nose.position.set(32, 10, 0);
  g.add(nose);
  for (const wz of [6, -6]) {
    const w = wheel(4, 3);
    w.position.set(8, 4, wz);
    g.add(w);
  }
  const shadow = blobShadow(38, 28);
  shadow.position.y = 0.7;
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

const BUILDERS = { car: buildCarGroup, bike: buildBikeGroup, boat: buildBoatGroup, plane: buildPlaneGroup };

/** Draw one vehicle in 3D through the pool. */
export function drawVehicle(pool, v, time) {
  if (!v || v.hp <= 0) return;
  const g = pool.get(`veh-${v.id}`, () => (BUILDERS[v.kind] || buildCarGroup)(v));
  const flyZ = v.kind === 'plane' ? (v.z || 0) : 0;
  g.position.set(v.x, flyZ, v.y);
  g.rotation.y = -v.angle;
  // Body colour can change (neon paint job): re-tint every body part.
  if (g.userData.color !== v.color) {
    g.userData.color = v.color;
    g.traverse((o) => {
      if (o.isMesh && bodyMats.has(o.material)) o.material = bodyMat(v.color);
    });
  }
  // Blob shadow stays on the ground while a plane flies.
  if (g.userData.shadow) {
    const s = g.userData.shadow;
    if (!g.userData.shadowBase) g.userData.shadowBase = [s.scale.x, s.scale.y];
    const base = g.userData.shadowBase;
    s.position.y = 0.7 - flyZ;
    const shrink = Math.max(0.35, 1 - flyZ / 900);
    s.scale.set(base[0] * shrink, base[1] * shrink, 1);
    s.material.opacity = 0.28 * shrink;
  }
  if (g.userData.smoke) {
    g.userData.smoke.visible = v.hp < v.maxHp * 0.4 && (time % 1) < 0.5;
  }
}

export function drawVehicles(pool, state, time) {
  for (const v of state.vehicles) {
    if (state.playerVehicle === v) continue;
    drawVehicle(pool, v, time);
  }
  if (state.playerVehicle) drawVehicle(pool, state.playerVehicle, time);
}
