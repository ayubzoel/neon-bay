// Neon Bay — the five-star wanted system. At 1 star patrol cars chase you;
// 2 adds bikes, 3 adds more of both, 4 adds a helicopter, 5 adds a tank.
// Every unit shoots, and the tank fires shells that explode.
import { WANTED, WANTED_SIGHT_RANGE } from './config.js';
import { activeCharacter, addWanted } from './state.js';
import { setSiren } from './audio.js';
import { addStrings, t } from './i18n.js';
import { glassMat, hubcapMat, stdMat, tyreMat } from './textures.js';

// --- i18n strings (Builder C owns game/src/i18n.js).
const POLICE_STRINGS_EN = {
  'crime.seen': 'Someone saw that',
  'crime.carStolen': 'Car stolen in plain sight',
};
const POLICE_STRINGS_ID = {
  'crime.seen': 'Ada yang melihat itu',
  'crime.carStolen': 'Mobil dicuri di depan umum',
};
addStrings('en', POLICE_STRINGS_EN);
addStrings('id', POLICE_STRINGS_ID);

function spawnPoint(state, world) {
  const hero = activeCharacter(state);
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 25;
    const x = hero.x + Math.cos(angle) * dist;
    const y = hero.y + Math.sin(angle) * dist;
    if (x < 40 || y < 40 || x > 9560 || y > 5360) continue;
    // Spawn ON a lane, not in a random spot: the nearest lane point to the
    // random offset, so the unit starts on the road and stays there.
    const lane = world.graph ? world.graph.nearestLanePoint(x, y) : { x, y };
    if (world.collides(lane.x, lane.y, 2, state.unlocked)) continue;
    return { x: lane.x, y: lane.y };
  }
  const lane = world.graph ? world.graph.nearestLanePoint(hero.x + 65, hero.y) : { x: hero.x + 65, y: hero.y };
  return { x: lane.x, y: lane.y };
}

function makePolice(kind, x, y) {
  // Speeds in m/s: a patrol car chases at ~60 m/s (216 km/h), a bike
  // slightly faster, a tank crawls at 18 m/s.
  const stats = {
    car: { speed: 60, hp: 80 },
    bike: { speed: 65, hp: 45 },
    heli: { speed: 45, hp: 120 },
    tank: { speed: 18, hp: 400 },
  }[kind];
  return { kind, x, y, z: 0, angle: 0, speed: 0, hp: stats.hp, maxHp: stats.hp, shootCd: 1 + Math.random(), ramCd: 0, path: null, pathIdx: 0, repathCd: 0, pathTarget: null, lastX: x, lastY: y, stuckT: 0 };
}

function maintainForce(state, world) {
  const want = WANTED[state.wanted] || WANTED[0];
  const counts = { car: 0, bike: 0, heli: 0, tank: 0 };
  for (const p of state.police) counts[p.kind] += 1;
  for (const kind of ['car', 'bike', 'heli', 'tank']) {
    while (counts[kind] < want[kind === 'car' ? 'cars' : kind === 'bike' ? 'bikes' : kind === 'heli' ? 'helis' : 'tanks']) {
      const p = spawnPoint(state, world);
      state.police.push(makePolice(kind, p.x, p.y));
      counts[kind] += 1;
    }
  }
  if (state.wanted === 0) state.police.length = 0;
}

function policeShoot(state, p, targetX, targetY) {
  if (p.shootCd > 0) return;
  const dist = Math.hypot(targetX - p.x, targetY - p.y);
  if (dist > WANTED_SIGHT_RANGE) return;
  p.shootCd = p.kind === 'tank' ? 2.2 : p.kind === 'heli' ? 0.9 : 0.7;
  const spread = (Math.random() - 0.5) * 0.22;
  const angle = Math.atan2(targetY - p.y, targetX - p.x) + spread;
  const speed = p.kind === 'tank' ? 300 : 640;
  state.bullets.push({
    x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    damage: p.kind === 'tank' ? 55 : p.kind === 'heli' ? 12 : 10,
    from: 'police', life: 1.6, blast: p.kind === 'tank' ? 70 : 0, kind: p.kind === 'tank' ? 'shell' : 'bullet',
  });
}

function steerToward(p, tx, ty, dt, turnRate) {
  const target = Math.atan2(ty - p.y, tx - p.x);
  let diff = target - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  p.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
}

// Lane waypoints for a node path: each leg is driven in its right-hand
// lane (via the graph, so the lane offset matches the road type — 1.75 m
// on a residential street, 6 m on an arterial), two points per leg —
// mid-leg and just before the next intersection — so the unit never has to
// cut a corner across a block. The final point is the nearest lane point
// to the player, so the unit holds on the road and shoots from there
// instead of driving onto the sidewalk the player stands on.
function laneWaypoints(nodePath, tx, ty, graph) {
  const pts = [];
  for (let i = 0; i + 1 < nodePath.length; i += 1) {
    const a = nodePath[i];
    const b = nodePath[i + 1];
    const aNode = graph && graph.nodeAt ? graph.nodeAt(a.x, a.y, a.level || 0) : null;
    const bNode = graph && graph.nodeAt ? graph.nodeAt(b.x, b.y, b.level || 0) : null;
    const seg = aNode && bNode && graph.segmentBetween ? graph.segmentBetween(aNode.id, bNode.id) : null;
    if (seg) {
      const dir = seg.a === aNode.id ? 1 : -1;
      const stopBack = Math.min(0.5, 4 / seg.length);
      const mid = graph.lanePoint(seg, 0.5, dir, 0);
      const end = graph.lanePoint(seg, dir >= 0 ? 1 - stopBack : stopBack, dir, 0);
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(mid.x - last.x, mid.y - last.y) > 0.5) pts.push({ x: mid.x, y: mid.y, z: mid.z || 0 });
      pts.push({ x: end.x, y: end.y, z: end.z || 0 });
    } else {
      // Fallback (no graph lookup): right-hand offset from the leg itself.
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const rx = -uy;
      const ry = ux;
      const mid = { x: (a.x + b.x) / 2 + rx * 1.75, y: (a.y + b.y) / 2 + ry * 1.75 };
      const end = { x: b.x - ux * 4 + rx * 1.75, y: b.y - uy * 4 + ry * 1.75 };
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(mid.x - last.x, mid.y - last.y) > 0.5) pts.push(mid);
      pts.push(end);
    }
  }
  if (graph) {
    const lane = graph.nearestLanePoint(tx, ty);
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(lane.x - last.x, lane.y - last.y) > 0.5) pts.push({ x: lane.x, y: lane.y, z: lane.z || 0 });
  } else {
    pts.push({ x: tx, y: ty });
  }
  return pts;
}

// Ground chase (cars, bikes, tanks): follow the road graph in the lane.
// Re-paths ONLY when needed — no path, path finished, the target moved
// far from the one this path was built for, or the unit is stuck.
// (The old code re-pathed every 1.2 s and reset pathIdx to 0, so the unit
// almost always steered at the first waypoint — straight across whatever
// block lay between it and the player — and spawned off-road.)
function chaseGround(state, world, p, tx, ty, dt, top, turnRate, accel) {
  // Police staged by shots.js predate these fields — normalise them.
  if (p.stuckT === undefined) p.stuckT = 0;
  if (p.lastX === undefined) { p.lastX = p.x; p.lastY = p.y; }
  const dist = Math.hypot(tx - p.x, ty - p.y);
  const targetMoved = !p.pathTarget || Math.hypot(tx - p.pathTarget.x, ty - p.pathTarget.y) > 60;
  // Re-path ONLY when needed: no path yet, the target moved far from the
  // one this path was built for, or the unit is stuck. NOT merely when
  // the path is finished: a finished path means the unit is at the hero's
  // nearest lane point, and it should HOLD there (see the else-branch
  // below) — re-pathing on finish would rebuild every frame, and when
  // findPath returns a trivial path (unit already at the nearest node)
  // the old code set p.path = null and the unit beelined straight at
  // the hero's exact position, across whatever block lay between.
  if (!p.path || targetMoved || p.stuckT > 1.2) {
    const nodePath = world.graph.findPath(p.x, p.y, tx, ty, state.unlocked, { z1: p.z || 0 });
    if (nodePath && nodePath.length > 1) {
      p.path = laneWaypoints(nodePath, tx, ty, world.graph);
      p.pathIdx = 0;
      p.pathTarget = { x: tx, y: ty };
    } else {
      // No road route (already at the nearest node, or unreachable):
      // hold at the hero's nearest lane point — never beeline off-road.
      const lane = world.graph ? world.graph.nearestLanePoint(tx, ty) : { x: tx, y: ty };
      p.path = [{ x: lane.x, y: lane.y, z: lane.z || 0 }];
      p.pathIdx = 0;
      p.pathTarget = { x: tx, y: ty };
    }
    p.stuckT = 0;
  }
  let wx = tx;
  let wy = ty;
  if (p.path && p.pathIdx < p.path.length) {
    wx = p.path[p.pathIdx].x;
    wy = p.path[p.pathIdx].y;
    const reach = p.kind === 'tank' ? 6 : 5;
    if (Math.hypot(wx - p.x, wy - p.y) < reach) {
      p.pathIdx += 1;
      if (p.pathIdx < p.path.length) {
        wx = p.path[p.pathIdx].x;
        wy = p.path[p.pathIdx].y;
      }
    }
  } else if (p.path && p.path.length > 0) {
    // Path finished: hold at the last waypoint — the hero's nearest lane
    // point — instead of steering straight at the hero's exact position,
    // which may be on a sidewalk, in a park, or inside a block. The unit
    // stays on the road and shoots from the lane.
    const last = p.path[p.path.length - 1];
    wx = last.x;
    wy = last.y;
  }
  // Hold on the road once close: shoot from the lane instead of driving
  // onto the sidewalk (or the park) where the player stands. The hold
  // distance is speed-aware — a bike at 65 m/s needs ~41 m to stop at
  // the 52 m/s^2 max decel below (v^2/2a), so a fixed 18 m hold would
  // overshoot the lane and end up next to the player, off the road.
  // The hold ALSO applies when the path is finished (atEnd) and the unit
  // is already at the last waypoint — it is at the hero's nearest lane
  // point and there is nowhere better to go. Without that, a unit whose
  // hero stands deep inside a block (farther than 18 m from any road)
  // would orbit the last waypoint forever at the sharp-turn speed,
  // drifting off the road, instead of stopping on the lane.
  // (But atEnd alone does NOT hold: a unit that overshot the waypoint
  // while braking must drive back to it — see the arrival cap below.)
  const atEnd = !p.path || p.pathIdx >= p.path.length;
  const dT = Math.hypot(wx - p.x, wy - p.y);
  const hold = dist < 18 + (p.speed * p.speed) / 104 || (atEnd && dT < 6);
  const target = Math.atan2(wy - p.y, wx - p.x);
  let diff = target - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = hold ? turnRate * 1.5 : turnRate;
  p.angle += Math.max(-turn * dt, Math.min(turn * dt, diff));
  // Slow for sharp turns: a fast car cannot make a 90-degree corner
  // inside a 7 m street, so it cuts the block. A slow car can.
  let want = hold ? 0 : top * (Math.abs(diff) > 0.9 ? 0.35 : Math.abs(diff) > 0.45 ? 0.6 : 1);
  // Arrive stopped at the final waypoint (v = sqrt(2*a*d), a = 52 m/s^2):
  // without this a unit approaching its last waypoint at speed overshoots
  // it by its braking distance and parks off the road, toward the hero —
  // and the hold above (atEnd) would then keep it parked there. The cap
  // also lets an overshot unit drive back to the waypoint and stop on it.
  if (p.path && p.pathIdx >= p.path.length - 1) {
    want = Math.min(want, Math.sqrt(104 * Math.max(0, dT - 1)));
  }
  p.speed += Math.max(-52 * dt, Math.min(accel * dt, want - p.speed));
  if (p.speed < 0) p.speed = 0;
  const nx = p.x + Math.cos(p.angle) * p.speed * dt;
  const ny = p.y + Math.sin(p.angle) * p.speed * dt;
  // Axis-separated movement slides along a wall instead of stopping dead.
  const r = p.kind === 'tank' ? 3.5 : 2.3;
  if (!world.collides(nx, p.y, r, state.unlocked)) p.x = nx;
  if (!world.collides(p.x, ny, r, state.unlocked)) p.y = ny;
  // Road elevation (viaducts, hill roads): the unit rides the deck it is
  // chasing along, like traffic does.
  if (world.graph) {
    const e = world.graph.elevationAt(p.x, p.y, p.z || 0);
    const targetZ = e.elev;
    p.z = (p.z || 0) + (targetZ - (p.z || 0)) * Math.min(1, dt * 6);
    if (Math.abs(targetZ - p.z) < 0.05) p.z = targetZ;
  }
  // Stuck: barely moving while trying to drive means the road ahead is
  // blocked — re-path (with a steering nudge) instead of grinding a wall.
  const moved = Math.hypot(p.x - p.lastX, p.y - p.lastY);
  if (p.speed > 8 && moved < p.speed * dt * 0.3) {
    p.stuckT += dt;
    if (p.stuckT > 1.2) p.angle += (Math.random() - 0.5) * 1.4;
  } else {
    p.stuckT = Math.max(0, p.stuckT - dt * 2);
  }
  p.lastX = p.x;
  p.lastY = p.y;
  return { dist, hold };
}

export function updatePolice(state, world, dt) {
  maintainForce(state, world);
  const hero = activeCharacter(state);
  const targetX = hero.x;
  const targetY = hero.y;
  let anyCanSee = false;
  for (let i = state.police.length - 1; i >= 0; i -= 1) {
    const p = state.police[i];
    if (p.hp <= 0) {
      state.police.splice(i, 1);
      state.particles.push({ x: p.x, y: p.y, kind: 'explosion', life: 0.6, max: 0.6 });
      continue;
    }
    p.shootCd -= dt;
    p.ramCd -= dt;
    const dist = Math.hypot(targetX - p.x, targetY - p.y);
    if (dist < WANTED_SIGHT_RANGE) anyCanSee = true;
    if (dist > 250) {
      const s = spawnPoint(state, world);
      p.x = s.x;
      p.y = s.y;
      p.z = 0;
    }
    if (p.kind === 'heli') {
      steerToward(p, targetX, targetY, dt, 1.6);
      p.speed = Math.min(45, p.speed + 12 * dt);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      policeShoot(state, p, targetX, targetY);
    } else if (p.kind === 'tank') {
      // Ground units chase along the road graph (v3, fixed in the map
      // build): lane waypoints, re-path only when needed, slow for
      // corners, hold on the road once close. Helicopters still fly straight.
      chaseGround(state, world, p, targetX, targetY, dt, 18, 1.4, 8);
      policeShoot(state, p, targetX, targetY);
    } else {
      const res = chaseGround(state, world, p, targetX, targetY, dt, p.kind === 'bike' ? 65 : 60, p.kind === 'bike' ? 3.0 : 2.8, 20);
      policeShoot(state, p, targetX, targetY);
      if (res.dist < 4 && p.ramCd <= 0) {
        p.ramCd = 1;
        state.bullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, damage: 8, from: 'police', life: 0.01, blast: 0, kind: 'ram' });
      }
    }
  }
  state.policeCanSee = anyCanSee;
  // Positional siren LOOP (audio.js setSiren, the API Builder C built for
  // this file): one continuous wail, driven by the nearest chasing unit.
  // dist01 = 0 nearby (loud) .. 1 at 120 m (quiet), so the siren really
  // approaches and recedes with distance. Counted edge-triggered so tests
  // can verify the loop is driven (the loop itself cannot be heard by a
  // test runner).
  let nearest = null;
  let nearestD = Infinity;
  for (const p of state.police) {
    const d = Math.hypot(p.x - hero.x, p.y - hero.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = p;
    }
  }
  const chasing = !!nearest && nearestD < 120;
  setSiren(chasing, Math.min(1, nearestD / 120));
  const stats = state.audioStats || (state.audioStats = { horn: 0, engine: 0, skid: 0, crash: 0, siren: 0 });
  if (chasing && !state.sirenLoopOn) stats.siren += 1;
  state.sirenLoopOn = chasing;
  return anyCanSee;
}

// The crime reasons arrive as raw English from the call sites
// (combat.js, main.js — outside this build's scope). Known ones are
// translated here; an unknown reason falls back to the raw text
// (English, the default language). Call sites should eventually pass
// the key instead of the sentence.
/** A crime the police saw: raise the wanted level. */
const CRIME_REASON_KEYS = {
  'Someone saw that': 'crime.seen',
  'Car stolen in plain sight': 'crime.carStolen',
};
export function commitCrime(state, stars, reason) {
  const key = CRIME_REASON_KEYS[reason];
  addWanted(state, stars, key ? t(key) : reason);
}

// --- v2 3D drawing -------------------------------------------------------
// First argument is the mesh pool; a canvas context falls back to the v1 2D
// drawing so the game stays playable until the 3D renderer lands.
function isPool(arg) {
  return !!arg && typeof arg.get === 'function';
}

function three() {
  return (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
}

function dummyObj() {
  return {
    position: { set() {} },
    rotation: {},
    scale: { set() {} },
    visible: true,
    material: { color: { set() {} }, transparent: false, opacity: 1 },
    userData: {},
  };
}

function box3(T, w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    material,
  );
  m.position.set(x, y, z);
  return m;
}

function paintMat(T, color) {
  return stdMat(`police-paint-${color.toString(16)}`, () => new T.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.55,
  }));
}

/** Build one police unit as a detailed 3D group, facing +X. Dimensions
 * are metres (v4): a patrol car is 4.5 m long, a tank 7 m, a helicopter's
 * rotor spans 9 m. */
function buildPoliceUnit(T, kind) {
  if (!T) return dummyObj();
  const g = new T.Group();
  const dark = stdMat('police-dark', () => new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.2 }));
  const white = stdMat('police-white', () => new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, metalness: 0 }));
  if (kind === 'heli') {
    g.add(box3(T, 5.5, 1.4, 2.2, paintMat(T, 0x1e3a5f), 0, 0, 0));
    g.add(box3(T, 3.2, 0.7, 0.8, paintMat(T, 0x1e3a5f), -3.8, 0.2, 0));
    g.add(box3(T, 1.4, 0.9, 1.6, glassMat(), 2.2, 0, 0));
    const rotor = box3(T, 9, 0.18, 0.5, stdMat('police-rotor', () => new T.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.6 })), 0, 1.2, 0);
    const tail = box3(T, 0.5, 0.18, 5, stdMat('police-rotor', () => new T.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.6 })), 0, 1.2, 0);
    const rotorGroup = new T.Group();
    rotorGroup.position.set(0, 1.2, 0);
    rotor.position.set(0, 0, 0);
    tail.position.set(0, 0, 0);
    rotorGroup.add(rotor);
    rotorGroup.add(tail);
    g.add(rotorGroup);
    // Landing skids.
    g.add(box3(T, 4, 0.25, 0.35, dark, 0, -1.2, -1));
    g.add(box3(T, 4, 0.25, 0.35, dark, 0, -1.2, 1));
    g.userData = { rotor: rotorGroup };
  } else if (kind === 'tank') {
    g.add(box3(T, 6.5, 1.3, 3.4, paintMat(T, 0x3f6212), 0, 0.65, 0));
    g.add(box3(T, 2.6, 0.9, 2.2, paintMat(T, 0x65a30d), 0, 1.75, 0));
    g.add(box3(T, 3.8, 0.45, 0.45, dark, 3, 1.75, 0));
    g.add(box3(T, 7, 0.45, 0.65, dark, 0, 0.25, -1.7));
    g.add(box3(T, 7, 0.45, 0.65, dark, 0, 0.25, 1.7));
    // Antenna + muzzle brake on the barrel.
    const antenna = new T.Mesh(new T.CylinderGeometry(0.09, 0.09, 2.4, 5), dark);
    antenna.position.set(-1, 3.2, -0.9);
    g.add(antenna);
    g.add(box3(T, 0.7, 0.65, 0.65, dark, 4.8, 1.75, 0));
  } else if (kind === 'bike') {
    g.add(box3(T, 2.1, 0.5, 0.5, paintMat(T, 0x1e40af), 0, 0.55, 0));
    g.add(box3(T, 0.6, 0.6, 0.45, white, 0.25, 0.95, 0));
    g.add(box3(T, 0.5, 0.45, 0.45, dark, -0.75, 0.45, 0));
    for (const wx of [0.8, -0.8]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 0.15, 10), tyreMat());
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.33, 0);
      g.add(wheel);
    }
    g.add(box3(T, 0.12, 0.18, 0.35, stdMat('police-beacon', () => new T.MeshStandardMaterial({
      color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0,
    })), 0.25, 1.35, 0));
  } else {
    // Patrol car: black body, white doors, chrome bumpers, wheels with
    // hubcaps, and a red/blue light bar that flashes (drawPolice drives it).
    g.add(box3(T, 4.5, 0.62, 1.8, paintMat(T, 0x111827), 0, 0.62, 0));
    g.add(box3(T, 2.3, 0.5, 1.6, white, -0.1, 1.18, 0));
    g.add(box3(T, 2.35, 0.08, 1.65, stdMat('police-chrome', () => new T.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.25, metalness: 0.9 })), -0.1, 0.95, 0));
    for (const [wx, wz] of [[1.45, 0.82], [1.45, -0.82], [-1.45, 0.82], [-1.45, -0.82]]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(0.33, 0.33, 0.22, 10), tyreMat());
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.33, wz);
      g.add(wheel);
      const cap = new T.Mesh(new T.CylinderGeometry(0.18, 0.18, 0.05, 8), hubcapMat());
      cap.rotation.x = Math.PI / 2;
      cap.position.set(wx, 0.33, wz + (wz > 0 ? 0.13 : -0.13));
      g.add(cap);
    }
    const redMat = stdMat('police-light-red', () => new T.MeshStandardMaterial({
      color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0,
    }));
    const blueMat = stdMat('police-light-blue', () => new T.MeshStandardMaterial({
      color: 0x1e3a8a, emissive: 0x3b82f6, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0,
    }));
    g.add(box3(T, 0.55, 0.22, 0.55, redMat, -0.1, 1.5, -0.35));
    g.add(box3(T, 0.55, 0.22, 0.55, blueMat, -0.1, 1.5, 0.35));
    g.userData = { lightRed: redMat, lightBlue: blueMat };
  }
  return g;
}

export function drawPolice(pool, state, time) {
  if (!isPool(pool)) {
    for (const p of state.police) drawUnit(pool, p, time);
    return;
  }
  const T = three();
  state.police.forEach((p, i) => {
    const mesh = pool.get(`police-${i}-${p.kind}`, () => buildPoliceUnit(T, p.kind));
    // Helicopters fly ~25 m above the street; ground units sit on the road
    // elevation (a viaduct deck, a hill road) under them.
    mesh.position.set(p.x, p.kind === 'heli' ? 25 : (p.z || 0), p.y);
    mesh.rotation.y = -p.angle;
    mesh.visible = true;
    const rotor = mesh.userData && mesh.userData.rotor;
    if (rotor) rotor.rotation.y = time * 20;
    // Patrol-car light bar: red and blue alternate, ~3 flashes a second.
    const ud = mesh.userData || {};
    if (ud.lightRed && ud.lightBlue) {
      const redOn = Math.sin(time * 9) > 0;
      ud.lightRed.emissiveIntensity = redOn ? 2.6 : 0.25;
      ud.lightBlue.emissiveIntensity = redOn ? 0.25 : 2.6;
    }
  });
}

function drawUnit(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.kind === 'heli') {
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 2.8, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.4;
    const rotor = time * 20;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * 4.5, Math.sin(rotor) * 0.8);
    ctx.lineTo(-Math.cos(rotor) * 4.5, -Math.sin(rotor) * 0.8);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(1.8, 0, 0.6, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'tank') {
    ctx.fillStyle = '#3f6212';
    ctx.beginPath();
    ctx.roundRect(-3.2, -1.7, 6.5, 3.4, 0.6);
    ctx.fill();
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.arc(0, 0, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a2e05';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();
  } else if (p.kind === 'bike') {
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.roundRect(-1.1, -0.3, 2.1, 0.6, 0.3);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0.4, 0, 0.25, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(-2.25, -0.9, 4.5, 1.8, 0.4);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-1.2, -0.9, 2.4, 0.3);
    ctx.fillRect(-1.2, 0.6, 2.4, 0.3);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-2, -0.25, 0.5, 0.5);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-2, -0.25, 0.25, 0.5);
  }
  ctx.restore();
  // Health bar for damaged units.
  if (p.hp < p.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 2, p.y - 3, 4, 0.6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(p.x - 2, p.y - 3, 4 * (p.hp / p.maxHp), 0.6);
  }
}
