// Neon Bay — every vehicle: cars, bikes, boats and planes. All four drive:
// cars and bikes on roads, boats on the water, planes off the airport runway.
// Traffic cars cruise the roads on their own; any parked or NPC car can be stolen.
//
// v2: the update/drive/traffic/enter/exit/spawn logic is unchanged from v1.
// Only the drawing is 3D now: drawVehicle/drawVehicles build pooled
// THREE groups (body + cabin + wheels, hull, fuselage + wings) via the
// renderer's mesh pool. Meshes face +X; rotation.y = -angle (v1 heading).
import { AIRPORT, VEHICLE_STATS } from './config.js';
import { activeCharacter, showMessage } from './state.js';
import { isWater } from './world.js';
import { registerNightGlow } from './textures.js';

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
    // Traffic state on the road graph (v3): the segment the car drives on,
    // its position along it (0..1) and its direction (+1 = a->b, -1 = b->a).
    seg: null, segT: 0, segDir: 1,
  };
}

/** Put a traffic car on a random graph segment, in its right-hand lane. */
function placeOnGraph(world, rng, district) {
  const pick = world.graph.randomLanePoint(rng, [district]);
  const seg = pick.seg;
  return {
    seg: seg.id,
    segT: segTOf(seg, pick.point),
    segDir: pick.dir,
    x: pick.point.x, y: pick.point.y,
  };
}

function segTOf(seg, point) {
  const dx = seg.bx - seg.ax;
  const dy = seg.by - seg.ay;
  const len2 = dx * dx + dy * dy || 1;
  return Math.max(0, Math.min(1, ((point.x - seg.ax) * dx + (point.y - seg.ay) * dy) / len2));
}

/** Parked cars, traffic, boats at the pier and two planes at the airport. */
export function spawnVehicles(state, world, rng) {
  const list = [];
  // Parked cars sit in a lane on a road (v3: on the graph, not mid-block).
  for (let i = 0; i < 16; i += 1) {
    const spot = placeOnGraph(world, rng, 0);
    const v = makeVehicle(rng.chance(0.25) ? 'bike' : 'car', spot.x, spot.y, 0, 'parked');
    const seg = world.graph.segments[spot.seg];
    const dx = (seg.bx - seg.ax) * spot.segDir;
    const dy = (seg.by - seg.ay) * spot.segDir;
    v.angle = Math.atan2(dy, dx);
    list.push(v);
  }
  for (let i = 0; i < 4; i += 1) {
    const spot = placeOnGraph(world, rng, 1);
    const v = makeVehicle('car', spot.x, spot.y, 0, 'parked');
    const seg = world.graph.segments[spot.seg];
    v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
    list.push(v);
  }
  for (let i = 0; i < 2; i += 1) {
    const spot = placeOnGraph(world, rng, 2);
    const v = makeVehicle('car', spot.x, spot.y, 0, 'parked');
    const seg = world.graph.segments[spot.seg];
    v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
    list.push(v);
  }
  // Traffic: downtown 12, beach 5, peaks 3 — all driving the graph.
  const trafficPlan = [[0, 12], [1, 5], [2, 3]];
  for (const [district, count] of trafficPlan) {
    for (let i = 0; i < count; i += 1) {
      const spot = placeOnGraph(world, rng, district);
      const v = makeVehicle('car', spot.x, spot.y, 0, 'traffic');
      v.seg = spot.seg;
      v.segT = spot.segT;
      v.segDir = spot.segDir;
      const seg = world.graph.segments[spot.seg];
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      v.speed = 90 + rng.range(0, 50);
      list.push(v);
    }
  }
  // Boats in the open water along the east edge (x 9200-9600).
  for (let i = 0; i < 3; i += 1) {
    list.push(makeVehicle('boat', 9280 + rng.range(0, 220), rng.range(1600, 5000), rng.range(0, Math.PI * 2), 'parked'));
  }
  // Two planes on the new runway (x 4050-5250, y 4650-4770).
  list.push(makeVehicle('plane', 4550, 4710, 0, 'parked'));
  list.push(makeVehicle('plane', 4800, 4710, 0, 'parked'));
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
    const rw = AIRPORT.runway;
    const onRunway = nx > rw.x && nx < rw.x + rw.w && ny > rw.y && ny < rw.y + rw.h;
    const hitBarrier = (px, py) => world.barrierDistrictAt(px, py, 24, state.unlocked);
    if (!world.collides(nx, v.y, radius, state.unlocked)) v.x = nx;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
      const bd = hitBarrier(nx, v.y);
      if (bd) barrierMessage(state, bd);
    }
    if (!world.collides(v.x, ny, radius, state.unlocked)) v.y = ny;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
      const bd = hitBarrier(v.x, ny);
      if (bd) barrierMessage(state, bd);
    }
    if (v.kind === 'plane' && onRunway && v.speed > stats.takeoffSpeed) v.z = 4;
  }
  if (v.hp <= 0 && state.playerVehicle === v) {
    exitVehicle(state);
  }
}

/** Locked-district message when the player's vehicle hits a barrier. */
export function barrierMessage(state, district) {
  const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
  if (state.barrierMsgAt && now - state.barrierMsgAt < 4) return;
  state.barrierMsgAt = now;
  showMessage(state, district === 1
    ? 'Sunset Beach is locked — finish Main Mission 20 to open the gate.'
    : 'Cinder Peaks is locked — finish Main Mission 40 to open the gate.', 3);
}

function updateTraffic(state, world, dt, rng) {
  const graph = world.graph;
  const traffic = state.vehicles.filter((v) => v.owner === 'traffic' && v.hp > 0);
  for (const v of traffic) {
    let seg = graph.segments[v.seg];
    if (!seg) {
      // Recovered (e.g. loaded mid-game): drop onto the nearest segment.
      const near = graph.nearestSegmentPoint(v.x, v.y);
      v.seg = near.seg.id;
      v.segT = near.t;
      v.segDir = 1;
      seg = near.seg;
    }
    // Keep distance: slow down (or stop) for a car ahead in the same lane,
    // or for any car right in front of the nose.
    let desired = 150;
    for (const o of traffic) {
      if (o === v) continue;
      if (o.seg === v.seg && o.segDir === v.segDir) {
        const ahead = (o.segT - v.segT) * v.segDir * seg.length;
        if (ahead > 0 && ahead < 120) desired = ahead < 60 ? 0 : 45;
      } else if (Math.hypot(o.x - v.x, o.y - v.y) < 64) {
        const hx = Math.cos(v.angle);
        const hy = Math.sin(v.angle);
        const dot = ((o.x - v.x) * hx + (o.y - v.y) * hy) / Math.max(1, Math.hypot(o.x - v.x, o.y - v.y));
        if (dot > 0.5) desired = 0;
      }
    }
    const stats = VEHICLE_STATS[v.kind];
    if (v.speed < desired) v.speed = Math.min(desired, v.speed + stats.accel * 0.4 * dt);
    else if (v.speed > desired) v.speed = Math.max(desired, v.speed - stats.accel * 0.8 * dt);
    // Advance along the segment, in the right-hand lane.
    v.segT += (v.segDir * v.speed * dt) / Math.max(1, seg.length);
    const endNodeId = v.segDir >= 0 ? seg.b : seg.a;
    if (v.segT >= 1 || v.segT <= 0) {
      // Reached an intersection: pick a next segment at this node.
      const node = graph.nodes[endNodeId];
      const candidates = [];
      for (const segId of node.segs) {
        if (segId === v.seg) continue;
        const next = graph.segments[segId];
        const farId = next.a === endNodeId ? next.b : next.a;
        const far = graph.nodes[farId];
        // Never drive through a locked gate.
        if (far.gateDistrict !== null && !state.unlocked[far.gateDistrict]) continue;
        candidates.push({ seg: next, farId });
      }
      if (candidates.length === 0) {
        // Dead end: turn around.
        v.segDir = -v.segDir;
        v.segT = Math.max(0, Math.min(1, v.segT));
      } else {
        // Prefer going straight (same axis), otherwise turn at random.
        const straight = candidates.filter((c) => c.seg.vertical === seg.vertical);
        const pick = (straight.length > 0 ? straight : candidates)[Math.floor(rng.next() * (straight.length > 0 ? straight.length : candidates.length))];
        const next = pick.seg;
        v.seg = next.id;
        v.segDir = next.a === endNodeId ? 1 : -1;
        v.segT = v.segDir >= 0 ? 0.02 : 0.98;
        seg = next;
      }
    }
    const p = graph.lanePoint(seg, v.segT, v.segDir);
    v.x = p.x;
    v.y = p.y;
    v.angle = Math.atan2((seg.by - seg.ay) * v.segDir, (seg.bx - seg.ax) * v.segDir);
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
// 3D drawing (v3) — pooled groups, shared geometry/materials. Bodies use
// MeshStandardMaterial car paint (metallic, low roughness) so they read as
// real paint under the sun; wheels get hubcaps, headlights/taillights glow
// at night, and every car carries a licence plate and bumpers.
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
// Body paint per colour (standard material); bodyMats tracks them so a
// paint job can re-tint the whole car at once.
const bodyMat = (color) => mat(`body-${color}`, () => {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  bodyMats.add(m);
  return m;
});
const bodyMats = new Set();
const glassMat = () => mat('glass', () => new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.85 }));
const tyreMat = () => mat('tyre', () => new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.95, metalness: 0 }));
const hubcapMat = () => mat('hubcap', () => new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.9 }));
const chromeMat = () => mat('chrome', () => new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.25, metalness: 0.9 }));
const whiteMat = () => mat('white', () => new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, metalness: 0 }));
const smokeMat = () => mat('smoke', () => new THREE.MeshLambertMaterial({ color: '#6b7280', transparent: true, opacity: 0.8 }));
// Headlights (warm white) and taillights (red): bright at night.
const headlightMat = () => mat('headlight', () => {
  const m = new THREE.MeshStandardMaterial({ color: 0xfff7cc, emissive: 0xfff2b0, emissiveIntensity: 0.25, roughness: 0.3, metalness: 0 });
  registerNightGlow(m, 0.25, 2.2);
  return m;
});
const taillightMat = () => mat('taillight', () => {
  const m = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0 });
  registerNightGlow(m, 0.35, 2.0);
  return m;
});
const plateMat = () => mat('plate', () => new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5, metalness: 0.1 }));

function unitBox() {
  return geo('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
}
function box(w, h, d, material) {
  const m = new THREE.Mesh(unitBox(), material);
  m.scale.set(w, h, d);
  return m;
}
function wheel(r, w) {
  // Tyre (dark cylinder, axle along Z) + a chrome hubcap disc on the
  // outer face, so wheels read as wheels instead of black discs.
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(geo(`wheel-${r}-${w}`, () => new THREE.CylinderGeometry(r, r, w, 12)), tyreMat());
  tyre.rotation.x = Math.PI / 2;
  g.add(tyre);
  const cap = new THREE.Mesh(geo(`hubcap-${r}`, () => new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.8, 10)), hubcapMat());
  cap.rotation.x = Math.PI / 2;
  cap.position.z = w / 2 + 0.2;
  g.add(cap);
  const cap2 = cap.clone();
  cap2.position.z = -w / 2 - 0.2;
  g.add(cap2);
  return g;
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
  // Cabin: tinted glass, slightly raked by sitting it back.
  const cabin = box(20, 8, 18, glassMat());
  cabin.position.set(-2, 16, 0);
  g.add(cabin);
  // Chrome window trim + bumpers.
  const trim = box(21, 1.5, 19, chromeMat());
  trim.position.set(-2, 12.2, 0);
  g.add(trim);
  const bumperF = box(3, 4, 22, chromeMat());
  bumperF.position.set(23.5, 6, 0);
  g.add(bumperF);
  const bumperR = box(3, 4, 22, chromeMat());
  bumperR.position.set(-23.5, 6, 0);
  g.add(bumperR);
  // Headlight strip (front, +X) and taillight strip (rear, -X).
  const head = box(1.5, 3, 18, headlightMat());
  head.position.set(23.4, 9, 0);
  g.add(head);
  const tail = box(1.5, 3, 18, taillightMat());
  tail.position.set(-23.4, 9, 0);
  g.add(tail);
  // Licence plate on the rear bumper.
  const plate = box(1, 4, 10, plateMat());
  plate.position.set(-25.2, 6, 0);
  g.add(plate);
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
  const tank = box(12, 5, 7, bodyMat(v.color));
  tank.position.set(4, 13, 0);
  g.add(tank);
  const seat = box(10, 4, 7, glassMat());
  seat.position.set(-8, 13, 0);
  g.add(seat);
  const head = box(2, 4, 6, headlightMat());
  head.position.set(17.5, 10, 0);
  g.add(head);
  const tail = box(2, 3, 6, taillightMat());
  tail.position.set(-17.5, 10, 0);
  g.add(tail);
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
  // Windshield + mast + a small stern light.
  const shield = box(8, 6, 14, glassMat());
  shield.position.set(8, 12, 0);
  g.add(shield);
  const mast = box(3, 22, 3, whiteMat());
  mast.position.set(4, 20, 0);
  g.add(mast);
  const stern = box(2, 3, 4, taillightMat());
  stern.position.set(-26.5, 8, 0);
  g.add(stern);
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
  // Twin engines under the wings + a landing light on the nose.
  for (const wz of [14, -14]) {
    const eng = new THREE.Mesh(geo('engine', () => new THREE.CylinderGeometry(3.5, 3.5, 12, 8)), bodyMat(v.color));
    eng.rotation.z = Math.PI / 2;
    eng.position.set(2, 6, wz);
    g.add(eng);
  }
  const lamp = box(2, 3, 4, headlightMat());
  lamp.position.set(36.5, 8, 0);
  g.add(lamp);
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
