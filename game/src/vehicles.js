// Neon Bay — every vehicle: cars, bikes, boats and planes. All four drive:
// cars and bikes on roads, boats on the water, planes off the airport runway.
// Traffic cars cruise the roads on their own; any parked or NPC car can be stolen.
//
// v2: the update/drive/traffic/enter/exit/spawn logic is unchanged from v1.
// Only the drawing is 3D now: drawVehicle/drawVehicles build pooled
// THREE groups (body + cabin + wheels, hull, fuselage + wings) via the
// renderer's mesh pool. Meshes face +X; rotation.y = -angle (v1 heading).
import { AIRPORT, DENSITY_LEVELS, DEFAULT_DENSITY, TRAFFIC_LIGHT_POLE_HEIGHT, VEHICLE_STATS, keybindFor } from './config.js';
import { activeCharacter, showMessage } from './state.js';
import { districtAt, isWater } from './world.js';
import { playSfx, playSfx3D, setEngine } from './audio.js';
import { addStrings, t } from './i18n.js';
import { applyPedDensity } from './npc.js';
import { registerNightGlow } from './textures.js';

// --- i18n strings (Builder C owns game/src/i18n.js).
const VEHICLE_STRINGS_EN = {
  'vehicle.barrierBeach': 'Sunset Beach is locked — finish Main Mission 20 to open the gate.',
  'vehicle.barrierPeaks': 'Cinder Peaks is locked — finish Main Mission 40 to open the gate.',
};
const VEHICLE_STRINGS_ID = {
  'vehicle.barrierBeach': 'Sunset Beach terkunci — selesaikan Misi Utama 20 untuk membuka gerbang.',
  'vehicle.barrierPeaks': 'Cinder Peaks terkunci — selesaikan Misi Utama 40 untuk membuka gerbang.',
};
addStrings('en', VEHICLE_STRINGS_EN);
addStrings('id', VEHICLE_STRINGS_ID);

// How many times each vehicle/police sound trigger fired (for the
// Playwright audio test — the sounds themselves are synthesized in
// audio.js and cannot be heard by a test runner).
function audioStats(state) {
  return state.audioStats || (state.audioStats = { horn: 0, engine: 0, skid: 0, crash: 0, siren: 0 });
}

function fallbackRng() {
  return {
    next: () => Math.random(),
    range: (a, b) => a + Math.random() * (b - a),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
  };
}

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
    // lane 0 is the outer lane, lane 1 the inner one (arterial only);
    // cruise is this car's own cruising speed in m/s.
    seg: null, segT: 0, segDir: 1, lane: 0, cruise: 0,
  };
}

/** Put a traffic car on a random graph segment, in its right-hand lane. */
function placeOnGraph(world, rng, district, groundOnly = false) {
  const pick = world.graph.randomLanePoint(rng, [district], { groundOnly });
  const seg = pick.seg;
  return {
    seg: seg.id,
    segT: segTOf(seg, pick.point),
    segDir: pick.dir,
    lane: pick.lane,
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
// One moving AI car/bike on the graph, in its own lane, cruising 11-17
// m/s (40-60 km/h). About one in six is a bike, and a few drive the
// arterial's inner lane (placeOnGraph picks the lane).
function makeTrafficCar(world, rng, district) {
  const spot = placeOnGraph(world, rng, district);
  const v = makeVehicle(rng.chance(0.15) ? 'bike' : 'car', spot.x, spot.y, 0, 'traffic');
  v.seg = spot.seg;
  v.segT = spot.segT;
  v.segDir = spot.segDir;
  v.lane = spot.lane;
  v.cruise = 11 + rng.range(0, 6);
  const seg = world.graph.segments[spot.seg];
  v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
  v.speed = v.cruise;
  v.z = seg.za + (seg.zb - seg.za) * spot.segT;
  return v;
}

export function spawnVehicles(state, world, rng) {
  const list = [];
  // Parked + traffic counts follow the density setting (config.js
  // DENSITY_LEVELS); 'high' is the v4 default: 22 parked, 42 moving.
  const density = DENSITY_LEVELS[state.densityLevel] || DENSITY_LEVELS[DEFAULT_DENSITY];
  for (let d = 0; d < 3; d += 1) {
    for (let i = 0; i < density.parked[d]; i += 1) {
      const spot = placeOnGraph(world, rng, d, true);
      const v = makeVehicle(rng.chance(0.25) ? 'bike' : 'car', spot.x, spot.y, 0, 'parked');
      const seg = world.graph.segments[spot.seg];
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      list.push(v);
    }
  }
  for (let d = 0; d < 3; d += 1) {
    for (let i = 0; i < density.traffic[d]; i += 1) {
      list.push(makeTrafficCar(world, rng, d));
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

/** Settings hook: set the vehicle density live ('low' | 'medium' |
 * 'high', see config.js DENSITY_LEVELS). Moving AI cars and parked
 * cars/bikes are added or removed to match the level; boats, planes and
 * the player's car are never touched. rng is optional. */
export function applyTrafficDensity(level, state, world, rng) {
  const density = DENSITY_LEVELS[level] || DENSITY_LEVELS[DEFAULT_DENSITY];
  if (!state.vehicles) return density;
  const r = rng || fallbackRng();
  // Moving traffic: remove excess PER DISTRICT (same reason as
  // applyPedDensity in npc.js — trimming from the end would empty the
  // peaks/beach first and the per-district spawn below would add them
  // back on top of an over-target downtown).
  const counts = [0, 0, 0];
  for (const v of state.vehicles) {
    if (v.owner === 'traffic') counts[districtAt(v.x, v.y)] += 1;
  }
  for (let d = 0; d < 3; d += 1) {
    let over = counts[d] - density.traffic[d];
    if (over <= 0) continue;
    for (let i = state.vehicles.length - 1; i >= 0 && over > 0; i -= 1) {
      if (state.vehicles[i].owner === 'traffic' && districtAt(state.vehicles[i].x, state.vehicles[i].y) === d) {
        state.vehicles.splice(i, 1);
        over -= 1;
      }
    }
  }
  // Re-count after the removal (counts above are pre-removal).
  counts[0] = 0; counts[1] = 0; counts[2] = 0;
  for (const v of state.vehicles) {
    if (v.owner === 'traffic') counts[districtAt(v.x, v.y)] += 1;
  }
  for (let d = 0; d < 3; d += 1) {
    for (let i = counts[d]; i < density.traffic[d]; i += 1) {
      state.vehicles.push(makeTrafficCar(world, r, d));
    }
  }
  // Parked cars/bikes (boats and planes are owner 'parked' too, but they
  // are not road traffic and are never counted or removed here). Excess
  // removed per district, same as traffic above.
  const isParkedRoad = (v) => v.owner === 'parked' && (v.kind === 'car' || v.kind === 'bike');
  const pCounts = [0, 0, 0];
  for (const v of state.vehicles) {
    if (isParkedRoad(v)) pCounts[districtAt(v.x, v.y)] += 1;
  }
  for (let d = 0; d < 3; d += 1) {
    let over = pCounts[d] - density.parked[d];
    if (over <= 0) continue;
    for (let i = state.vehicles.length - 1; i >= 0 && over > 0; i -= 1) {
      if (isParkedRoad(state.vehicles[i]) && districtAt(state.vehicles[i].x, state.vehicles[i].y) === d) {
        state.vehicles.splice(i, 1);
        over -= 1;
      }
    }
  }
  // Re-count after the removal.
  pCounts[0] = 0; pCounts[1] = 0; pCounts[2] = 0;
  for (const v of state.vehicles) {
    if (isParkedRoad(v)) pCounts[districtAt(v.x, v.y)] += 1;
  }
  for (let d = 0; d < 3; d += 1) {
    for (let i = pCounts[d]; i < density.parked[d]; i += 1) {
      const spot = placeOnGraph(world, r, d, true);
      const v = makeVehicle(r.chance(0.25) ? 'bike' : 'car', spot.x, spot.y, 0, 'parked');
      const seg = world.graph.segments[spot.seg];
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      state.vehicles.push(v);
    }
  }
  return density;
}

/** Settings hook: set the traffic + pedestrian density live ('low' |
 * 'medium' | 'high'). One call from the Settings menu adjusts both the
 * cars (here) and the pedestrians (npc.js). Safe to call any time; it
 * only adds or removes ambient vehicles and peds, never the player's car,
 * boats, planes or mission NPCs. Returns the level actually applied. */
export function applyDensity(level, state, world, rng) {
  const lvl = DENSITY_LEVELS[level] ? level : DEFAULT_DENSITY;
  state.densityLevel = lvl;
  applyPedDensity(lvl, state, world, rng);
  applyTrafficDensity(lvl, state, world, rng);
  return lvl;
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
  // Skid: hard braking (S while moving fast) or a sharp turn at speed
  // squeals the tyres. Throttled so a long slide is one squeal per 0.8 s.
  const braking = input.moveY() > 0 && v.speed > 15;
  const sharpTurn = Math.abs(steer) > 0.6 && Math.abs(v.speed) > 25;
  if (braking || sharpTurn) {
    v.skidCd = (v.skidCd || 0) - dt;
    if (v.skidCd <= 0) {
      const hero = activeCharacter(state);
      playSfx3D('skid', v.x, v.y, hero.x, hero.y);
      audioStats(state).skid += 1;
      v.skidCd = 0.8;
    }
  } else {
    v.skidCd = 0;
  }
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  // Collision radius in metres (a car is 4.5 m long, a bike ~2 m).
  const radius = v.kind === 'bike' ? 1.2 : v.kind === 'plane' ? 5 : 2.5;
  // Crash thud: only for a real impact (fast + a wall), at most once a
  // second per vehicle. A very hard impact uses the explosion recipe.
  const speedBefore = v.speed;
  const crashSound = () => {
    if (Math.abs(speedBefore) <= 12) return;
    const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
    if (v.crashCdAt && now - v.crashCdAt < 1) return;
    v.crashCdAt = now;
    const hero = activeCharacter(state);
    playSfx3D(Math.abs(speedBefore) > 30 ? 'explosion' : 'hit', v.x, v.y, hero.x, hero.y);
    audioStats(state).crash += 1;
  };
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
      crashSound();
      const bd = hitBarrier(nx, v.y);
      if (bd) barrierMessage(state, bd);
    }
    if (!world.collides(v.x, ny, radius, state.unlocked)) v.y = ny;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
      crashSound();
      const bd = hitBarrier(v.x, ny);
      if (bd) barrierMessage(state, bd);
    }
    if (v.kind === 'plane' && onRunway && v.speed > stats.takeoffSpeed) v.z = 4;
  }
  // Elevation: the road under the car sets its height, so driving up a
  // viaduct ramp or a hill road lifts the car onto the deck (and driving
  // off it drops it back to the street). Planes and boats manage their own z.
  if (v.kind !== 'plane' && v.kind !== 'boat' && world.graph) {
    const e = world.graph.elevationAt(v.x, v.y, v.z || 0);
    const target = e.elev;
    v.z = (v.z || 0) + (target - (v.z || 0)) * Math.min(1, dt * 6);
    if (Math.abs(target - v.z) < 0.05) v.z = target;
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
  showMessage(state, t(district === 1 ? 'vehicle.barrierBeach' : 'vehicle.barrierPeaks'), 3);
}

function updateTraffic(state, world, dt, rng) {
  const graph = world.graph;
  // The traffic-light clock: every light's phase is a pure function of
  // this time, so the logic here and the lamps in drawRoadFurniture agree.
  state.trafficTime = (state.trafficTime || 0) + dt;
  const t = state.trafficTime;
  const traffic = state.vehicles.filter((v) => v.owner === 'traffic' && v.hp > 0);
  for (const v of traffic) {
    let seg = graph.segments[v.seg];
    if (!seg) {
      // Recovered (e.g. loaded mid-game): drop onto the nearest segment.
      const near = graph.nearestSegmentPoint(v.x, v.y);
      v.seg = near.seg.id;
      v.segT = near.t;
      v.segDir = 1;
      v.lane = 0;
      seg = near.seg;
    }
    if (!v.cruise) v.cruise = 11 + ((v.id * 37) % 60) / 10;
    // Keep distance: slow down (or stop) for a car ahead in the same lane,
    // or for any car right in front of the nose. Gaps are in metres now.
    let desired = v.cruise;
    for (const o of traffic) {
      if (o === v) continue;
      if (o.seg === v.seg && o.segDir === v.segDir && (o.lane || 0) === (v.lane || 0)) {
        const ahead = (o.segT - v.segT) * v.segDir * seg.length;
        if (ahead > 0 && ahead < 12) desired = ahead < 6 ? 0 : 6;
      } else if (Math.hypot(o.x - v.x, o.y - v.y) < 8) {
        const hx = Math.cos(v.angle);
        const hy = Math.sin(v.angle);
        const dot = ((o.x - v.x) * hx + (o.y - v.y) * hy) / Math.max(1, Math.hypot(o.x - v.x, o.y - v.y));
        if (dot > 0.5) desired = 0;
      }
    }
    // Traffic light at the end of this segment: stop at the stop line
    // (11 m before the intersection) on red or yellow, unless already
    // past it — then drive through.
    const endNodeId = v.segDir >= 0 ? seg.b : seg.a;
    const endNode = graph.nodes[endNodeId];
    const distToNode = (v.segDir >= 0 ? 1 - v.segT : v.segT) * seg.length;
    let lightColor = null;
    if (endNode && endNode.light) {
      const st = graph.lightStateAt(endNode.id, t);
      lightColor = seg.vertical ? st.ns : st.ew;
      if ((lightColor === 'red' || lightColor === 'yellow') && distToNode > 11 && distToNode < 22) {
        desired = 0;
      }
    }
    const stats = VEHICLE_STATS[v.kind];
    if (v.speed < desired) v.speed = Math.min(desired, v.speed + stats.accel * 0.4 * dt);
    else if (v.speed > desired) v.speed = Math.max(desired, v.speed - stats.accel * 0.8 * dt);
    // Advance along the segment, in the right-hand lane.
    v.segT += (v.segDir * v.speed * dt) / Math.max(1, seg.length);
    // Stop line: never roll into a red-light intersection — but only
    // while the car has NOT passed the line yet (distToNode is the
    // pre-advance distance; a car already clearly past it — more than
    // 5 cm — drives through instead of being yanked back). The 5 cm
    // margin matters: a car held exactly ON the line reads distToNode
    // 11.0, and a strict "> 11" would release the clamp and let it
    // accelerate through the red. A car held at the line is STOPPED
    // (speed 0): the >11 stop condition above switches off exactly at
    // the line, so without this the car would sit at the line revving
    // at cruise speed.
    if ((lightColor === 'red' || lightColor === 'yellow') && distToNode > 11 - 0.05) {
      const stopT = 11 / Math.max(1, seg.length);
      if (v.segDir >= 0) v.segT = Math.min(v.segT, 1 - stopT);
      else v.segT = Math.max(v.segT, stopT);
      const distNow = (v.segDir >= 0 ? 1 - v.segT : v.segT) * seg.length;
      if (distNow <= 11.01) v.speed = 0;
    }
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
        // A residential street has one lane per direction; keep the inner
        // lane only while the car is on an arterial.
        if (next.lanes !== 4) v.lane = 0;
        seg = next;
      }
    }
    const p = graph.lanePoint(seg, v.segT, v.segDir, v.lane || 0);
    v.x = p.x;
    v.y = p.y;
    v.z = p.z || 0;
    v.angle = Math.atan2((seg.by - seg.ay) * v.segDir, (seg.bx - seg.ax) * v.segDir);
  }
  // AI sound, throttled so the street never becomes a wall of noise: the
  // nearest moving traffic car within 60 m of the hero hums its engine,
  // and a car stuck at a red light (or behind another car) for a while
  // honks — at most one AI honk every 1.5 s across the whole city.
  const hero = activeCharacter(state);
  let nearestEngine = null;
  let nearestD = 60;
  state.aiHornCd = (state.aiHornCd || 0) - dt;
  for (const v of traffic) {
    if (v.speed > 3) {
      const d = Math.hypot(v.x - hero.x, v.y - hero.y);
      if (d < nearestD) { nearestD = d; nearestEngine = v; }
    }
    if (v.speed < 0.5) {
      v.waitT = (v.waitT || 0) + dt;
      if (v.waitT > 4 && state.aiHornCd <= 0 && Math.hypot(v.x - hero.x, v.y - hero.y) < 80) {
        v.waitT = 0;
        playSfx3D('horn', v.x, v.y, hero.x, hero.y);
        audioStats(state).horn += 1;
        state.aiHornCd = 1.5;
      }
    } else {
      v.waitT = 0;
    }
  }
  state.aiEngineCd = (state.aiEngineCd || 0) - dt;
  if (nearestEngine && state.aiEngineCd <= 0) {
    playSfx3D('engine', nearestEngine.x, nearestEngine.y, hero.x, hero.y);
    audioStats(state).engine += 1;
    state.aiEngineCd = 0.9;
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
    vehicleAudio(state, v, dt, input);
  } else if (state.engineLoopOn) {
    // Player left the vehicle (or it was destroyed): silence the engine
    // loop — vehicleAudio only runs while a player vehicle exists.
    setEngine(false, 0);
    state.engineLoopOn = false;
  }
  updateTraffic(state, world, dt, rng);
}

// Player-vehicle sound: the horn (H, rebindable via Settings — see
// config.js keybindFor) and the engine LOOP (audio.js setEngine): one
// continuous engine whose pitch rises with speed, steered every frame.
// Boats add a splash; planes sweep the same pitch range at higher speed.
function vehicleAudio(state, v, dt, input) {
  const stats = audioStats(state);
  if (input.pressed(keybindFor(state, 'horn'))) {
    // 'horn' recipe is still missing from audio.js (Builder C) — the call
    // is counted here and stays a silent no-op until the recipe lands.
    playSfx('horn');
    stats.horn += 1;
  }
  // Player engine LOOP (audio.js setEngine, the API Builder C built for
  // this file): one continuous engine whose pitch rises with speed, steered
  // every frame — no more per-shot re-triggering. speed01 = 0..1 of the
  // vehicle's top speed, so a plane at 85 m/s and a boat at 25 m/s both
  // sweep the full pitch range.
  const maxSpeed = (VEHICLE_STATS[v.kind] && VEHICLE_STATS[v.kind].maxSpeed) || 55;
  const driving = Math.abs(v.speed) > 1;
  setEngine(driving, Math.min(1, Math.abs(v.speed) / maxSpeed));
  // Edge-triggered count so tests can verify the loop is driven (the loop
  // itself cannot be heard by a test runner).
  if (driving && !state.engineLoopOn) stats.engine += 1;
  state.engineLoopOn = driving;
  // Boat: water splash alongside the engine loop, throttled.
  v.splashCd = (v.splashCd || 0) - dt;
  if (driving && v.kind === 'boat' && v.splashCd <= 0) {
    playSfx('splash');
    v.splashCd = 0.6;
  }
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
  cap.position.z = w / 2 + 0.02;
  g.add(cap);
  const cap2 = cap.clone();
  cap2.position.z = -w / 2 - 0.02;
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

// v4: all vehicles are built in metres (1 unit = 1 m). A car is 4.5 m
// long and 1.8 m wide, so it fills most of its 3.5 m lane instead of
// looking like a toy on a 64 m highway.
function buildCarGroup(v) {
  const g = new THREE.Group();
  const body = box(4.5, 0.62, 1.8, bodyMat(v.color));
  body.position.y = 0.62;
  g.add(body);
  // Cabin: tinted glass, slightly raked by sitting it back.
  const cabin = box(2.3, 0.5, 1.6, glassMat());
  cabin.position.set(-0.1, 1.18, 0);
  g.add(cabin);
  // Chrome window trim + bumpers.
  const trim = box(2.35, 0.08, 1.65, chromeMat());
  trim.position.set(-0.1, 0.95, 0);
  g.add(trim);
  const bumperF = box(0.25, 0.3, 1.8, chromeMat());
  bumperF.position.set(2.25, 0.45, 0);
  g.add(bumperF);
  const bumperR = box(0.25, 0.3, 1.8, chromeMat());
  bumperR.position.set(-2.25, 0.45, 0);
  g.add(bumperR);
  // Headlight strip (front, +X) and taillight strip (rear, -X).
  const head = box(0.1, 0.2, 1.5, headlightMat());
  head.position.set(2.26, 0.68, 0);
  g.add(head);
  const tail = box(0.1, 0.2, 1.5, taillightMat());
  tail.position.set(-2.26, 0.68, 0);
  g.add(tail);
  // Licence plate on the rear bumper.
  const plate = box(0.06, 0.22, 0.6, plateMat());
  plate.position.set(-2.4, 0.45, 0);
  g.add(plate);
  const wheelPos = [[1.45, 0.82], [1.45, -0.82], [-1.45, 0.82], [-1.45, -0.82]];
  for (const [wx, wz] of wheelPos) {
    const w = wheel(0.33, 0.22);
    w.position.set(wx, 0.33, wz);
    g.add(w);
  }
  const shadow = blobShadow(2.8, 1.3);
  shadow.position.y = 0.05;
  g.add(shadow);
  g.userData.shadow = shadow;
  const smoke = new THREE.Mesh(geo('smoke-ball', () => new THREE.SphereGeometry(0.4, 8, 6)), smokeMat());
  smoke.position.set(-1.4, 1.2, 0);
  smoke.visible = false;
  g.add(smoke);
  g.userData.smoke = smoke;
  return g;
}

function buildBikeGroup(v) {
  const g = new THREE.Group();
  const frame = box(2.1, 0.22, 0.4, bodyMat(v.color));
  frame.position.y = 0.62;
  g.add(frame);
  const tank = box(0.7, 0.25, 0.35, bodyMat(v.color));
  tank.position.set(0.25, 0.85, 0);
  g.add(tank);
  const seat = box(0.6, 0.2, 0.35, glassMat());
  seat.position.set(-0.5, 0.85, 0);
  g.add(seat);
  const head = box(0.1, 0.2, 0.3, headlightMat());
  head.position.set(1.06, 0.65, 0);
  g.add(head);
  const tail = box(0.1, 0.18, 0.3, taillightMat());
  tail.position.set(-1.06, 0.65, 0);
  g.add(tail);
  for (const wx of [0.8, -0.8]) {
    const w = wheel(0.33, 0.15);
    w.position.set(wx, 0.33, 0);
    g.add(w);
  }
  const shadow = blobShadow(1.4, 0.6);
  shadow.position.y = 0.05;
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

function buildBoatGroup(v) {
  const g = new THREE.Group();
  const hull = box(6, 0.8, 2.2, bodyMat(v.color));
  hull.position.y = 0.4;
  g.add(hull);
  const deck = box(2.4, 0.5, 1.7, whiteMat());
  deck.position.set(-0.5, 1.0, 0);
  g.add(deck);
  // Windshield + mast + a small stern light.
  const shield = box(0.9, 0.5, 1.7, glassMat());
  shield.position.set(1.0, 1.05, 0);
  g.add(shield);
  const mast = box(0.25, 2.2, 0.25, whiteMat());
  mast.position.set(0.5, 1.8, 0);
  g.add(mast);
  const stern = box(0.15, 0.25, 0.35, taillightMat());
  stern.position.set(-3.05, 0.7, 0);
  g.add(stern);
  const shadow = blobShadow(3.6, 1.6);
  shadow.position.y = 0.05;
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

function buildPlaneGroup(v) {
  const g = new THREE.Group();
  const fuselage = box(9, 1.0, 1.6, bodyMat(v.color));
  fuselage.position.y = 0.9;
  g.add(fuselage);
  const wing = box(2.2, 0.18, 11, bodyMat(v.color));
  wing.position.set(0.2, 0.9, 0);
  g.add(wing);
  const tailWing = box(1.4, 0.15, 3.4, bodyMat(v.color));
  tailWing.position.set(-3.9, 0.95, 0);
  g.add(tailWing);
  const tailFin = box(1.4, 1.5, 0.2, bodyMat(v.color));
  tailFin.position.set(-3.9, 1.6, 0);
  g.add(tailFin);
  const nose = box(1.0, 0.7, 1.2, glassMat());
  nose.position.set(4.4, 0.9, 0);
  g.add(nose);
  // Twin engines under the wings + a landing light on the nose.
  for (const wz of [1.6, -1.6]) {
    const eng = new THREE.Mesh(geo('engine', () => new THREE.CylinderGeometry(0.4, 0.4, 1.4, 8)), bodyMat(v.color));
    eng.rotation.z = Math.PI / 2;
    eng.position.set(0.2, 0.55, wz);
    g.add(eng);
  }
  const lamp = box(0.15, 0.25, 0.35, headlightMat());
  lamp.position.set(5.0, 0.7, 0);
  g.add(lamp);
  for (const wz of [0.7, -0.7]) {
    const w = wheel(0.35, 0.25);
    w.position.set(1.0, 0.35, wz);
    g.add(w);
  }
  const shadow = blobShadow(4.5, 3.2);
  shadow.position.y = 0.05;
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

const BUILDERS = { car: buildCarGroup, bike: buildBikeGroup, boat: buildBoatGroup, plane: buildPlaneGroup };

/** Draw one vehicle in 3D through the pool. */
export function drawVehicle(pool, v, time) {
  if (!v || v.hp <= 0) return;
  const g = pool.get(`veh-${v.id}`, () => (BUILDERS[v.kind] || buildCarGroup)(v));
  // v.z is the road elevation (viaduct deck, hill road) — or flight
  // altitude for a plane. The group sits on it either way.
  const height = v.z || 0;
  g.position.set(v.x, height, v.y);
  g.rotation.y = -v.angle;
  // Body colour can change (neon paint job): re-tint every body part.
  if (g.userData.color !== v.color) {
    g.userData.color = v.color;
    g.traverse((o) => {
      if (o.isMesh && bodyMats.has(o.material)) o.material = bodyMat(v.color);
    });
  }
  // Blob shadow: on the road surface under the car — on the deck when the
  // car is on a viaduct. A flying plane keeps its shadow on the ground
  // below, shrinking as it climbs.
  if (g.userData.shadow) {
    const s = g.userData.shadow;
    if (!g.userData.shadowBase) g.userData.shadowBase = [s.scale.x, s.scale.y];
    const base = g.userData.shadowBase;
    if (v.kind === 'plane') {
      s.position.y = 0.05 - height;
      const shrink = Math.max(0.35, 1 - height / 60);
      s.scale.set(base[0] * shrink, base[1] * shrink, 1);
      s.material.opacity = 0.28 * shrink;
    } else {
      s.position.y = 0.05;
      s.scale.set(base[0], base[1], 1);
      s.material.opacity = 0.28;
    }
  }
  if (g.userData.smoke) {
    g.userData.smoke.visible = v.hp < v.maxHp * 0.4 && (time % 1) < 0.5;
  }
}

// --- v4 road furniture ---------------------------------------------------
// Viaduct decks, hill ribbons, arterial medians, lane dashes and traffic
// lights. All static geometry is one InstancedMesh per kind (a handful of
// draw calls for the whole city), built once per world and cached; only
// the traffic-light lamps change per frame (their phase follows the same
// trafficTime clock the traffic logic uses).
let _furn = null;
let _furnGen = 0;

function _furnMatrix(px, py, pz, rx, ry, rz, sx, sy, sz, T) {
  const m = new T.Matrix4();
  const q = new T.Quaternion();
  q.setFromEuler(new T.Euler(rx, ry, rz));
  m.compose(new T.Vector3(px, py, pz), q, new T.Vector3(sx, sy, sz));
  return m;
}

function buildRoadFurniture(T, graph) {
  const slabs = []; // {px,py,pz,rx,rz,sx,sy,sz}
  const barriers = [];
  const pillars = [];
  const medians = [];
  const dashes = [];
  const poles = [];
  const heads = [];
  const lampSpots = []; // {nodeId, axis, color, x, y, z}
  const unitBox = new T.BoxGeometry(1, 1, 1);
  const lampGeo = new T.SphereGeometry(0.16, 8, 6);

  for (const s of graph.segments) {
    if (s.level === 1) {
      // Elevated deck (viaduct or hill road): a sloped slab, edge barriers,
      // and support piers where the deck is high.
      const width = s.walkable ? 8 : 9;
      const len = s.length;
      const mx = (s.ax + s.bx) / 2;
      const my = (s.ay + s.by) / 2;
      const midZ = (s.za + s.zb) / 2;
      const dz = s.zb - s.za;
      if (s.vertical) {
        const rx = -Math.atan2(dz, len);
        slabs.push({ px: mx, py: midZ - 0.4, pz: my, rx, ry: 0, rz: 0, sx: width, sy: 0.8, sz: len });
        for (const side of [-1, 1]) {
          const lat = side * (width / 2 - 0.15);
          const off = new T.Vector3(lat, 0.55, 0).applyEuler(new T.Euler(rx, 0, 0));
          barriers.push({ px: mx + off.x, py: midZ - 0.4 + off.y, pz: my + off.z, rx, ry: 0, rz: 0, sx: 0.25, sy: 1.1, sz: len });
        }
        if (midZ > 4) {
          for (const side of [-1, 1]) {
            pillars.push({ px: mx + side * (width / 2 - 0.6), py: (midZ - 0.8) / 2, pz: my, rx: 0, ry: 0, rz: 0, sx: 1.2, sy: Math.max(0.5, midZ - 0.8), sz: 1.2 });
          }
        }
      } else {
        const rz = Math.atan2(dz, len);
        slabs.push({ px: mx, py: midZ - 0.4, pz: my, rx: 0, ry: 0, rz, sx: len, sy: 0.8, sz: width });
        for (const side of [-1, 1]) {
          const lat = side * (width / 2 - 0.15);
          const off = new T.Vector3(0, 0.55, lat).applyEuler(new T.Euler(0, 0, rz));
          barriers.push({ px: mx + off.x, py: midZ - 0.4 + off.y, pz: my + off.z, rx: 0, ry: 0, rz, sx: len, sy: 1.1, sz: 0.25 });
        }
        if (midZ > 4) {
          for (const side of [-1, 1]) {
            pillars.push({ px: mx, py: (midZ - 0.8) / 2, pz: my + side * (width / 2 - 0.6), rx: 0, ry: 0, rz: 0, sx: 1.2, sy: Math.max(0.5, midZ - 0.8), sz: 1.2 });
          }
        }
      }
    }
    if (s.type === 'arterial' && s.level === 0) {
      // Median: a low concrete divider along the centreline, with gaps at
      // the intersections so cars can turn.
      const gapLen = s.length - 20;
      if (gapLen >= 4) {
        const mx = (s.ax + s.bx) / 2;
        const my = (s.ay + s.by) / 2;
        if (s.vertical) medians.push({ px: mx, py: 0.18, pz: my, rx: 0, ry: 0, rz: 0, sx: 1.5, sy: 0.35, sz: gapLen });
        else medians.push({ px: mx, py: 0.18, pz: my, rx: 0, ry: 0, rz: 0, sx: gapLen, sy: 0.35, sz: 1.5 });
      }
      // Lane dashes between the inner and outer lanes (±4.25 m), 2 m dash
      // every 6 m, clear of the intersections.
      const n = Math.floor((s.length - 24) / 6);
      for (let k = 0; k < n; k += 1) {
        const d = 12 + k * 6 + 1;
        const t = d / s.length;
        const cx = s.ax + (s.bx - s.ax) * t;
        const cy = s.ay + (s.by - s.ay) * t;
        for (const side of [-1, 1]) {
          if (s.vertical) dashes.push({ px: cx + side * 4.25, py: 0.65, pz: cy, rx: 0, ry: 0, rz: 0, sx: 0.18, sy: 0.03, sz: 2 });
          else dashes.push({ px: cx, py: 0.65, pz: cy + side * 4.25, rx: 0, ry: 0, rz: 0, sx: 2, sy: 0.03, sz: 0.18 });
        }
      }
    }
  }

  // Traffic lights: four approaches per major junction (one pole per
  // approach, on the sidewalk at the near-right corner, head ~5 m up).
  // The lamp positions are recorded so the per-frame update can light them.
  for (const light of graph.trafficLights) {
    const node = graph.nodes[light.nodeId];
    let maxHalf = 3.5;
    for (const segId of node.segs) maxHalf = Math.max(maxHalf, graph.segments[segId].half);
    const off = maxHalf + 1.25;
    const approaches = [
      { axis: 'ns', px: node.x + off, py: node.y + off, lx: 0, lz: 0.3, wideX: true }, // northbound
      { axis: 'ns', px: node.x - off, py: node.y - off, lx: 0, lz: -0.3, wideX: true }, // southbound
      { axis: 'ew', px: node.x - off, py: node.y + off, lx: -0.3, lz: 0, wideX: false }, // eastbound
      { axis: 'ew', px: node.x + off, py: node.y - off, lx: 0.3, lz: 0, wideX: false }, // westbound
    ];
    for (const a of approaches) {
      poles.push({ px: a.px, py: TRAFFIC_LIGHT_POLE_HEIGHT / 2, pz: a.py, rx: 0, ry: 0, rz: 0, sx: 0.14, sy: TRAFFIC_LIGHT_POLE_HEIGHT, sz: 0.14 });
      heads.push(a.wideX
        ? { px: a.px, py: 4.4, pz: a.py, rx: 0, ry: 0, rz: 0, sx: 0.6, sy: 1.1, sz: 0.35 }
        : { px: a.px, py: 4.4, pz: a.py, rx: 0, ry: 0, rz: 0, sx: 0.35, sy: 1.1, sz: 0.6 });
      const lampYs = { red: 4.75, yellow: 4.4, green: 4.05 };
      for (const color of ['red', 'yellow', 'green']) {
        lampSpots.push({
          nodeId: light.nodeId, axis: a.axis, color,
          x: a.px + a.lx, y: lampYs[color], z: a.py + a.lz,
        });
      }
    }
  }

  function instanced(list, geometry, material) {
    if (list.length === 0) return null;
    const mesh = new T.InstancedMesh(geometry, material, list.length);
    list.forEach((tr, i) => {
      mesh.setMatrixAt(i, _furnMatrix(tr.px, tr.py, tr.pz, tr.rx, tr.ry, tr.rz, tr.sx, tr.sy, tr.sz, T));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }
  const asphalt = new T.MeshStandardMaterial({ color: 0x2f333a, roughness: 0.95, metalness: 0 });
  const concrete = new T.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.9, metalness: 0 });
  const pierMat = new T.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9, metalness: 0 });
  const medianMat = new T.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85, metalness: 0 });
  const dashMat = new T.MeshBasicMaterial({ color: 0xf8fafc });
  const poleMat = new T.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.4 });
  const headMat = new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6, metalness: 0.2 });
  const redMat = new T.MeshBasicMaterial({ color: 0xef4444 });
  const yellowMat = new T.MeshBasicMaterial({ color: 0xfacc15 });
  const greenMat = new T.MeshBasicMaterial({ color: 0x22c55e });

  // Group the lamp spots by approach (node + axis): each approach has one
  // red, one yellow and one green instance, in three separate meshes.
  const approaches = new Map();
  for (const spot of lampSpots) {
    const key = `${spot.nodeId}-${spot.axis}`;
    if (!approaches.has(key)) approaches.set(key, { nodeId: spot.nodeId, axis: spot.axis, lamps: {} });
    approaches.get(key).lamps[spot.color] = spot;
  }
  const redSpots = lampSpots.filter((s) => s.color === 'red');
  const yellowSpots = lampSpots.filter((s) => s.color === 'yellow');
  const greenSpots = lampSpots.filter((s) => s.color === 'green');
  const redIdx = new Map(redSpots.map((s, i) => [`${s.nodeId}-${s.axis}`, i]));
  const yellowIdx = new Map(yellowSpots.map((s, i) => [`${s.nodeId}-${s.axis}`, i]));
  const greenIdx = new Map(greenSpots.map((s, i) => [`${s.nodeId}-${s.axis}`, i]));
  for (const a of approaches.values()) {
    a.red = { i: redIdx.get(`${a.nodeId}-${a.axis}`), ...a.lamps.red };
    a.yellow = { i: yellowIdx.get(`${a.nodeId}-${a.axis}`), ...a.lamps.yellow };
    a.green = { i: greenIdx.get(`${a.nodeId}-${a.axis}`), ...a.lamps.green };
  }

  return {
    graph,
    deck: instanced(slabs, unitBox, asphalt),
    barrier: instanced(barriers, unitBox, concrete),
    pillar: instanced(pillars, unitBox, pierMat),
    median: instanced(medians, unitBox, medianMat),
    dash: instanced(dashes, unitBox, dashMat),
    pole: instanced(poles, unitBox, poleMat),
    head: instanced(heads, unitBox, headMat),
    lampRed: instanced(redSpots.map((s) => ({ px: s.x, py: s.y, pz: s.z, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 })), lampGeo, redMat),
    lampYellow: instanced(yellowSpots.map((s) => ({ px: s.x, py: s.y, pz: s.z, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 })), lampGeo, yellowMat),
    lampGreen: instanced(greenSpots.map((s) => ({ px: s.x, py: s.y, pz: s.z, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 })), lampGeo, greenMat),
    approaches: [...approaches.values()],
    counts: {
      deckSlabs: slabs.length, barriers: barriers.length, pillars: pillars.length,
      medians: medians.length, dashes: dashes.length, poles: poles.length,
      lights: graph.trafficLights.length, approaches: approaches.size,
    },
  };
}

function drawRoadFurniture(pool, state, time) {
  const T = (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
  const graph = state.world && state.world.graph;
  if (!T || !graph) return;
  if (!_furn || _furn.graph !== graph) {
    _furn = buildRoadFurniture(T, graph);
    _furnGen += 1;
    _furn.gen = _furnGen;
    // Exposed for automated tests (window.__neonBay.state): how much road
    // furniture actually got built, and the pole height it was built with.
    state.roadFurniture = { counts: _furn.counts, poleHeight: TRAFFIC_LIGHT_POLE_HEIGHT };
  }
  const f = _furn;
  const gen = f.gen || 0;
  for (const [key, mesh] of [['deck', f.deck], ['barrier', f.barrier], ['pillar', f.pillar], ['median', f.median], ['dash', f.dash], ['pole', f.pole], ['head', f.head], ['lampRed', f.lampRed], ['lampYellow', f.lampYellow], ['lampGreen', f.lampGreen]]) {
    if (!mesh) continue;
    pool.get(`furn-${gen}-${key}`, () => mesh);
  }
  // Traffic-light lamps: light the lamp that matches the phase, hide the
  // other two (scale 0). The phase comes from the same clock as the
  // traffic logic, so a car that stops at red sees a red lamp.
  const t = state.trafficTime || 0;
  const zero = new T.Matrix4().makeScale(0, 0, 0);
  const one = new T.Matrix4();
  function setLamp(mesh, entry, on) {
    if (!mesh || entry.i === undefined) return;
    if (on) {
      one.makeTranslation(entry.x, entry.y, entry.z);
      mesh.setMatrixAt(entry.i, one);
    } else {
      mesh.setMatrixAt(entry.i, zero);
    }
  }
  let dirty = false;
  for (const a of f.approaches) {
    const st = graph.lightStateAt(a.nodeId, t);
    const color = a.axis === 'ns' ? st.ns : st.ew;
    setLamp(f.lampRed, a.red, color === 'red');
    setLamp(f.lampYellow, a.yellow, color === 'yellow');
    setLamp(f.lampGreen, a.green, color === 'green');
    dirty = true;
  }
  if (dirty) {
    if (f.lampRed) f.lampRed.instanceMatrix.needsUpdate = true;
    if (f.lampYellow) f.lampYellow.instanceMatrix.needsUpdate = true;
    if (f.lampGreen) f.lampGreen.instanceMatrix.needsUpdate = true;
  }
  void time;
}

export function drawVehicles(pool, state, time) {
  drawRoadFurniture(pool, state, time);
  for (const v of state.vehicles) {
    if (state.playerVehicle === v) continue;
    drawVehicle(pool, v, time);
  }
  if (state.playerVehicle) drawVehicle(pool, state.playerVehicle, time);
}
