// Neon Bay — every vehicle: cars, bikes, boats and planes. All four drive:
// cars and bikes on roads, boats on the water, planes off the airport runway.
// Traffic cars cruise the roads on their own; any parked or NPC car can be stolen.
//
// v2: the update/drive/traffic/enter/exit/spawn logic is unchanged from v1.
// Only the drawing is 3D now: drawVehicle/drawVehicles build pooled
// THREE groups (body + cabin + wheels, hull, fuselage + wings) via the
// renderer's mesh pool. Meshes face +X; rotation.y = -angle (v1 heading).
import { AIRPORT, AMBIENT_CROWD, DENSITY_LEVELS, DEFAULT_DENSITY, DRAW_FAR_METRES, FURNITURE_SECTORS, TRAFFIC_LIGHT_POLE_HEIGHT, VEHICLE_STATS, WORLD_HEIGHT, WORLD_WIDTH, keybindFor } from './config.js';
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
// arterial's inner lane (placeOnGraph picks the lane). `spot` is an
// optional pre-picked placement ({seg, segT, segDir, lane, x, y} as
// placeOnGraph returns) — the living-city balancer passes one near the
// hero; without it the car is placed anywhere in the district, as in v4.
function makeTrafficCar(world, rng, district, spot) {
  const s = spot || placeOnGraph(world, rng, district);
  const v = makeVehicle(rng.chance(0.15) ? 'bike' : 'car', s.x, s.y, 0, 'traffic');
  v.seg = s.seg;
  v.segT = s.segT;
  v.segDir = s.segDir;
  v.lane = s.lane;
  v.cruise = 11 + rng.range(0, 6);
  const seg = world.graph.segments[s.seg];
  v.angle = Math.atan2((seg.by - seg.ay) * s.segDir, (seg.bx - seg.ax) * s.segDir);
  v.speed = v.cruise;
  v.z = seg.za + (seg.zb - seg.za) * s.segT;
  return v;
}

export function spawnVehicles(state, world, rng) {
  const list = [];
  // Parked + traffic counts follow the density setting (config.js
  // DENSITY_LEVELS); 'high' is the v4 default: 22 parked, 42 moving.
  const density = DENSITY_LEVELS[state.densityLevel] || DENSITY_LEVELS[DEFAULT_DENSITY];
  // v5 living city: part of the downtown quota is born on the roads around
  // the hero (he starts downtown), so there is traffic outside the door
  // from the first frame — the rest scatter city-wide as in v4, so the
  // totals do not change.
  const hero = activeCharacter(state);
  const nearParked = Math.min(AMBIENT_CROWD.initialNear.parked, density.parked[0]);
  const closeParked = Math.min(AMBIENT_CROWD.initialClose.parked, nearParked);
  const nearTraffic = Math.min(AMBIENT_CROWD.initialNear.traffic, density.traffic[0]);
  const closeTraffic = Math.min(AMBIENT_CROWD.initialClose.traffic, nearTraffic);
  for (let d = 0; d < 3; d += 1) {
    for (let i = 0; i < density.parked[d]; i += 1) {
      let spot = null;
      if (d === 0 && i < nearParked) {
        // The first couple park on the hero's own street, kerbside.
        const lo = i < closeParked ? AMBIENT_CROWD.parkedCloseMin : AMBIENT_CROWD.parkedSpawnMin;
        const hi = i < closeParked ? AMBIENT_CROWD.parkedCloseMax : AMBIENT_CROWD.parkedSpawnMax;
        spot = lanePointNear(world.graph, rng, hero.x, hero.y, lo, hi, state, true);
      }
      if (!spot) spot = placeOnGraph(world, rng, d, true);
      // Parked cars sit kerbside (outer lane): recompute the point for
      // lane 0, since lanePointNear may have picked the inner lane.
      if (d === 0 && i < nearParked) {
        const seg0 = world.graph.segments[spot.seg];
        const kerb = world.graph.lanePoint(seg0, spot.segT, spot.segDir, 0);
        spot = { ...spot, lane: 0, x: kerb.x, y: kerb.y, z: kerb.z || 0 };
      }
      const v = makeVehicle(rng.chance(0.25) ? 'bike' : 'car', spot.x, spot.y, 0, 'parked');
      const seg = world.graph.segments[spot.seg];
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      list.push(v);
    }
  }
  for (let d = 0; d < 3; d += 1) {
    for (let i = 0; i < density.traffic[d]; i += 1) {
      if (d === 0 && i < nearTraffic) {
        // The first couple cruise the hero's own street.
        const lo = i < closeTraffic ? AMBIENT_CROWD.trafficCloseMin : AMBIENT_CROWD.trafficSpawnMin;
        const hi = i < closeTraffic ? AMBIENT_CROWD.trafficCloseMax : AMBIENT_CROWD.trafficSpawnMax;
        const spot = lanePointNear(world.graph, rng, hero.x, hero.y, lo, hi, state, false);
        list.push(spot ? makeTrafficCar(world, rng, d, spot) : makeTrafficCar(world, rng, d));
      } else {
        list.push(makeTrafficCar(world, rng, d));
      }
    }
  }
  // Boats in the open water along the east edge (x 2320-2375).
  for (let i = 0; i < 3; i += 1) {
    list.push(makeVehicle('boat', 2320 + rng.range(0, 55), rng.range(533.3, 1666.7), rng.range(0, Math.PI * 2), 'parked'));
  }
  // Two planes on the new runway (x 1012.5-1312.5, y 1550-1590).
  list.push(makeVehicle('plane', 1137.5, 1570, 0, 'parked'));
  list.push(makeVehicle('plane', 1200, 1570, 0, 'parked'));
  // The player's starter car, parked by the safe house.
  const starter = makeVehicle('car', 155, 540, 0, 'player');
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

// --- v5 living city: lane points near the hero --------------------------
// A ground-level graph node within maxR of (x, y), by reservoir sampling
// (one pass over the nodes, no array built).
function randomGroundNodeNear(graph, rng, x, y, maxR) {
  const r2 = maxR * maxR;
  let count = 0;
  let pick = null;
  for (const n of graph.nodes) {
    if (n.level !== 0) continue;
    const dx = n.x - x;
    const dy = n.y - y;
    if (dx * dx + dy * dy > r2) continue;
    count += 1;
    if (rng.next() < 1 / count) pick = n;
  }
  return pick;
}

/** A lane placement in the band [minR, maxR] around (x, y), in the shape
 * placeOnGraph returns ({seg, segT, segDir, lane, x, y, z}): pick a nearby
 * intersection, take a random street off it, and sit in that street's
 * right-hand lane for a random direction. Never spawns a car heading into
 * a locked district gate, and with groundOnly it stays off viaduct decks
 * (parked cars). Falls back to the nearest lane of a random point in the
 * band; returns null only if the graph has nothing usable nearby. */
function lanePointNear(graph, rng, x, y, minR, maxR, state, groundOnly = false) {
  for (let tries = 0; tries < 12; tries += 1) {
    const node = randomGroundNodeNear(graph, rng, x, y, maxR);
    if (!node || !node.segs || node.segs.length === 0) break;
    const seg = graph.segments[node.segs[Math.floor(rng.next() * node.segs.length)]];
    if (!seg) continue;
    if (groundOnly && seg.level !== 0) continue;
    const dir = rng.next() < 0.5 ? 1 : -1;
    const lane = seg.lanes === 4 && rng.next() < 0.3 ? 1 : 0;
    const t = rng.range(0.08, 0.92);
    const p = graph.lanePoint(seg, t, dir, lane);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < minR * 0.7 || d > maxR) continue;
    // Never spawn heading into a locked gate: the car would U-turn at the
    // barrier instead of joining the flow.
    const endId = dir >= 0 ? seg.b : seg.a;
    const end = graph.nodes[endId];
    if (end && end.gateDistrict !== null && !(state.unlocked && state.unlocked[end.gateDistrict])) continue;
    return { seg: seg.id, segT: t, segDir: dir, lane, x: p.x, y: p.y, z: p.z || 0 };
  }
  const a = rng.range(0, Math.PI * 2);
  const r = rng.range(minR, maxR);
  const near = graph.nearestSegmentPoint(x + Math.cos(a) * r, y + Math.sin(a) * r);
  if (!near) return null;
  const seg = near.seg;
  if (groundOnly && seg.level !== 0) return null;
  const dir = rng.next() < 0.5 ? 1 : -1;
  const lane = seg.lanes === 4 && rng.next() < 0.3 ? 1 : 0;
  const p = graph.lanePoint(seg, near.t, dir, lane);
  return { seg: seg.id, segT: near.t, segDir: dir, lane, x: p.x, y: p.y, z: p.z || 0 };
}

// A lane spot near the hero with no other traffic car close by, so
// recycled cars never spawn in a pile-up. A few tries, then give up for
// this tick (the balancer runs again a second later).
function laneSpotNear(state, graph, rng, x, y, minR, maxR, groundOnly) {
  for (let tries = 0; tries < 6; tries += 1) {
    const spot = lanePointNear(graph, rng, x, y, minR, maxR, state, groundOnly);
    if (!spot) return null;
    let clear = true;
    for (const v of state.vehicles) {
      if (v.owner !== 'traffic' || v.hp <= 0) continue;
      if (Math.hypot(v.x - spot.x, v.y - spot.y) < AMBIENT_CROWD.trafficGap) { clear = false; break; }
    }
    if (clear) return spot;
  }
  return null;
}

/** The traffic balancer (v5 living city): once per sim-second, count the
 * moving traffic cars and the parked road cars near the hero and, if the
 * district target (config.js AMBIENT_CROWD) is not met, recycle the
 * farthest ones — same-district first — onto lanes near the hero. A
 * recycled traffic car keeps its cruise speed and rejoins the flow in its
 * right-hand lane (the red-light logic in updateTraffic below is
 * untouched: a recycled car still stops at red). Parked cars are recycled
 * to ground-level lanes near the hero, in the outer (kerbside) lane.
 * Totals never change: this only moves cars that already exist. The
 * player's car, boats and planes are never touched. */
function maintainTrafficCrowd(state, world, dt, rng) {
  const cfg = AMBIENT_CROWD;
  state.crowdTrafficCd = (state.crowdTrafficCd || 0) - dt;
  if (state.crowdTrafficCd > 0) return;
  state.crowdTrafficCd = cfg.checkSeconds;
  const hero = activeCharacter(state);
  const graph = world.graph;
  const district = districtAt(hero.x, hero.y);
  const target = cfg.targets[district] || cfg.targets[0];

  // --- moving traffic ---
  let count = 0;
  const far = [];
  for (const v of state.vehicles) {
    if (v.owner !== 'traffic' || v.hp <= 0) continue;
    const d = Math.hypot(v.x - hero.x, v.y - hero.y);
    if (d <= cfg.trafficNear) count += 1;
    else far.push({ v, d, same: districtAt(v.x, v.y) === district });
  }
  let need = target.traffic - count;
  if (need > 0 && far.length > 0) {
    far.sort((a, b) => (b.same - a.same) || (b.d - a.d));
    const moves = Math.min(need, cfg.maxPerTick.traffic, far.length);
    for (let i = 0; i < moves; i += 1) {
      const v = far[i].v;
      const spot = laneSpotNear(state, graph, rng, hero.x, hero.y, cfg.trafficSpawnMin, cfg.trafficSpawnMax, false);
      if (!spot) continue;
      const seg = graph.segments[spot.seg];
      v.seg = spot.seg;
      v.segT = spot.segT;
      v.segDir = spot.segDir;
      v.lane = spot.lane;
      v.x = spot.x;
      v.y = spot.y;
      v.z = spot.z || 0;
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      if (!v.cruise) v.cruise = 11 + ((v.id * 37) % 60) / 10;
      v.speed = v.cruise;
      v.waitT = 0;
    }
  }
  // Close top-up: if the road right around the hero is nearly empty,
  // recycle ONE far car into the far side of the close band (90-140 m),
  // so a car drives into view within seconds. Only below target — never
  // on a busy street. Cars stay far out because they are big and obvious.
  let close = 0;
  for (const v of state.vehicles) {
    if (v.owner !== 'traffic' || v.hp <= 0) continue;
    if (Math.hypot(v.x - hero.x, v.y - hero.y) <= cfg.trafficCloseRadius) close += 1;
  }
  if (close < cfg.trafficCloseTarget) {
    for (const entry of far) {
      const v = entry.v;
      if (Math.hypot(v.x - hero.x, v.y - hero.y) <= cfg.trafficNear) continue;
      const spot = laneSpotNear(state, graph, rng, hero.x, hero.y, cfg.trafficCloseSpawnMin, cfg.trafficCloseSpawnMax, false);
      if (!spot) break;
      const seg = graph.segments[spot.seg];
      v.seg = spot.seg;
      v.segT = spot.segT;
      v.segDir = spot.segDir;
      v.lane = spot.lane;
      v.x = spot.x;
      v.y = spot.y;
      v.z = spot.z || 0;
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      if (!v.cruise) v.cruise = 11 + ((v.id * 37) % 60) / 10;
      v.speed = v.cruise;
      v.waitT = 0;
      break; // one per tick
    }
  }

  // --- parked road cars (kerbside, outer lane) ---
  const isParkedRoad = (v) => v.owner === 'parked' && (v.kind === 'car' || v.kind === 'bike');
  let pCount = 0;
  const pFar = [];
  for (const v of state.vehicles) {
    if (!isParkedRoad(v)) continue;
    const d = Math.hypot(v.x - hero.x, v.y - hero.y);
    if (d <= cfg.parkedNear) pCount += 1;
    else pFar.push({ v, d, same: districtAt(v.x, v.y) === district });
  }
  const pNeed = target.parked - pCount;
  if (pNeed > 0 && pFar.length > 0) {
    pFar.sort((a, b) => (b.same - a.same) || (b.d - a.d));
    const moves = Math.min(pNeed, cfg.maxPerTick.parked, pFar.length);
    for (let i = 0; i < moves; i += 1) {
      const v = pFar[i].v;
      const spot = lanePointNear(graph, rng, hero.x, hero.y, cfg.parkedSpawnMin, cfg.parkedSpawnMax, state, true);
      if (!spot) continue;
      const seg = graph.segments[spot.seg];
      // Kerbside = the OUTER lane: recompute the point for lane 0, since
      // lanePointNear may have picked the inner lane on an arterial.
      const kerb = graph.lanePoint(seg, spot.segT, spot.segDir, 0);
      v.seg = spot.seg;
      v.segT = spot.segT;
      v.segDir = spot.segDir;
      v.lane = 0; // outer lane = kerbside
      v.x = kerb.x;
      v.y = kerb.y;
      v.z = kerb.z || 0;
      v.angle = Math.atan2((seg.by - seg.ay) * spot.segDir, (seg.bx - seg.ax) * spot.segDir);
      v.speed = 0;
    }
  }
}

function updateTraffic(state, world, dt, rng) {
  // v5 living city: keep the roads around the hero busy (recycles far
  // cars in, never adds any). Runs on its own 1 s throttle inside.
  maintainTrafficCrowd(state, world, dt, rng);
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
  // v5 perf: fewer segments per lamp (6x4 = 48 tris instead of 8x6 = 96)
  // — the same 0.32 m bulb at street distance, half the triangles on
  // every one of the ~1800 lamps in the city.
  const lampGeo = new T.SphereGeometry(0.16, 6, 4);

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

  // Traffic lights: one pole per REAL approach of each major junction
  // (v7). The approaches are derived from the junction node's incident
  // segments, not assumed to be four: a T-junction has three approaches,
  // and a phantom fourth pole would stand on a corner no traffic ever
  // comes from. For each segment the approach direction is the direction
  // of travel toward the node; the pole stands at the near-right corner
  // (right-hand traffic) — back from the node by the cross road's
  // sidewalk-centre offset, and out by the approach road's own
  // sidewalk-centre offset — so the pole is exactly on the sidewalk
  // corner, never in the middle of the road, never off the sidewalk
  // (the v6 formula used maxHalf for both offsets, which pushed the
  // poles 3.25 m past the sidewalk wherever a residential road met the
  // arterial ring). The lamp face points back toward the incoming
  // driver, and the head is wide across the road it faces.
  // The lamp positions are recorded so the per-frame update can light them.
  const SIDEWALK_CENTRE = 1.25; // sidewalk centre = road half-width + 2.5 / 2
  for (const light of graph.trafficLights) {
    const node = graph.nodes[light.nodeId];
    const seenDir = new Set();
    for (const segId of node.segs) {
      const s = graph.segments[segId];
      // Far end of this segment: travel toward the node from there.
      const ox = s.a === node.id ? s.bx : s.ax;
      const oy = s.a === node.id ? s.by : s.ay;
      let dx = node.x - ox;
      let dy = node.y - oy;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      const dkey = `${dx.toFixed(3)},${dy.toFixed(3)}`;
      if (seenDir.has(dkey)) continue; // two collinear segments, same approach
      seenDir.add(dkey);
      const axis = s.vertical ? 'ns' : 'ew';
      // Widest road crossing this approach at the node (the cross road
      // whose sidewalk corner the pole stands on).
      let crossHalf = 0;
      for (const sid2 of node.segs) {
        const s2 = graph.segments[sid2];
        if (s2.vertical !== s.vertical) crossHalf = Math.max(crossHalf, s2.half);
      }
      if (crossHalf === 0) crossHalf = s.half;
      const along = crossHalf + SIDEWALK_CENTRE;
      const lat = s.half + SIDEWALK_CENTRE;
      const rx = -dy; // right of the direction of travel (y grows south)
      const ry = dx;
      const px = node.x - dx * along + rx * lat;
      const py = node.y - dy * along + ry * lat;
      const lx = -dx * 0.3; // lamp face toward the incoming driver
      const lz = -dy * 0.3;
      const wideX = axis === 'ns';
      poles.push({ px, py: TRAFFIC_LIGHT_POLE_HEIGHT / 2, pz: py, rx: 0, ry: 0, rz: 0, sx: 0.14, sy: TRAFFIC_LIGHT_POLE_HEIGHT, sz: 0.14 });
      heads.push(wideX
        ? { px, py: 4.4, pz: py, rx: 0, ry: 0, rz: 0, sx: 0.6, sy: 1.1, sz: 0.35 }
        : { px, py: 4.4, pz: py, rx: 0, ry: 0, rz: 0, sx: 0.35, sy: 1.1, sz: 0.6 });
      const lampYs = { red: 4.75, yellow: 4.4, green: 4.05 };
      for (const color of ['red', 'yellow', 'green']) {
        lampSpots.push({
          nodeId: light.nodeId, axis, color,
          x: px + lx, y: lampYs[color], z: py + lz,
        });
      }
    }
  }

  // --- v5 perf: sector-split instancing ---------------------------------
  // One InstancedMesh per kind per map sector (FURNITURE_SECTORS: 4 x 3
  // sectors of 2400 x 1800 m), each with its own bounding sphere and
  // frustumCulled = true, so the renderer only draws the sectors near
  // the camera instead of the whole city's dashes (~120k tris) and lamps
  // (~175k tris) every frame. three r149 has no
  // InstancedMesh.computeBoundingSphere (it arrived in r156), so the
  // sphere is computed by hand from the instance positions plus each
  // instance's half-diagonal — a long deck slab extends far past its
  // origin, and the sphere must cover it. Same approach as world.js
  // makeInstanced (trees), just finer sectors.
  // v7 fix (same root cause as world.js): r149's Frustum.intersectsObject
  // reads ONLY geometry.boundingSphere and never object.boundingSphere,
  // so a hand-computed mesh.boundingSphere was ignored and culling tested
  // the shared unit geometry's tiny sphere at the world origin — whenever
  // the map corner left the frustum, ALL road furniture (decks, barriers,
  // pillars, medians, dashes, traffic-light poles/heads/lamps) vanished.
  // instanced() therefore clones the geometry per sector mesh and puts
  // the hand-computed sphere on the clone, which r149 does read.
  const SECTOR_W = WORLD_WIDTH / FURNITURE_SECTORS.cols;
  const SECTOR_H = WORLD_HEIGHT / FURNITURE_SECTORS.rows;
  const SECTOR_N = FURNITURE_SECTORS.cols * FURNITURE_SECTORS.rows;
  function sectorOf(x, z) {
    const cx = Math.max(0, Math.min(FURNITURE_SECTORS.cols - 1, Math.floor(x / SECTOR_W)));
    const cz = Math.max(0, Math.min(FURNITURE_SECTORS.rows - 1, Math.floor(z / SECTOR_H)));
    return cz * FURNITURE_SECTORS.cols + cx;
  }
  function instanced(list, geometry, material) {
    if (list.length === 0) return null;
    const centre = new T.Vector3();
    for (const tr of list) {
      centre.x += tr.px;
      centre.y += tr.py;
      centre.z += tr.pz;
    }
    centre.divideScalar(Math.max(1, list.length));
    let radius = 0;
    for (const tr of list) {
      const dx = tr.px - centre.x;
      const dy = tr.py - centre.y;
      const dz = tr.pz - centre.z;
      const halfDiag = 0.5 * Math.hypot(tr.sx || 1, tr.sy || 1, tr.sz || 1);
      radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy + dz * dz) + halfDiag);
    }
    // v7: the sector sphere must live on the GEOMETRY (see the note
    // above) — r149 culling never reads mesh.boundingSphere. Each sector
    // mesh gets its own geometry clone carrying its sphere.
    const sphere = new T.Sphere(centre, radius);
    const geo = geometry.clone();
    geo.boundingSphere = sphere;
    const mesh = new T.InstancedMesh(geo, material, list.length);
    list.forEach((tr, i) => {
      mesh.setMatrixAt(i, _furnMatrix(tr.px, tr.py, tr.pz, tr.rx, tr.ry, tr.rz, tr.sx, tr.sy, tr.sz, T));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingSphere = sphere;
    mesh.frustumCulled = true;
    return mesh;
  }
  // Bucket one transform list by sector; returns an array of meshes
  // indexed by sector (null where the sector has no instances).
  function sectored(list, geometry, material) {
    const buckets = Array.from({ length: SECTOR_N }, () => []);
    for (const tr of list) buckets[sectorOf(tr.px, tr.pz)].push(tr);
    return buckets.map((b) => instanced(b, geometry, material));
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

  // Group the lamp spots by POLE (unique position), then poles by
  // approach (node + axis): the two poles on one axis share a phase, but
  // each pole has its own three lamps. (v4 grouped by node+axis and the
  // second pole's lamps overwrote the first's, so 2 of the 4 poles at
  // every junction were never updated and showed all three lamps lit.)
  const poleMap = new Map();
  for (const spot of lampSpots) {
    const pkey = `${spot.x},${spot.z}`;
    if (!poleMap.has(pkey)) poleMap.set(pkey, { nodeId: spot.nodeId, axis: spot.axis, lamps: {} });
    poleMap.get(pkey).lamps[spot.color] = spot;
  }
  const approaches = new Map();
  for (const pole of poleMap.values()) {
    const key = `${pole.nodeId}-${pole.axis}`;
    if (!approaches.has(key)) approaches.set(key, { nodeId: pole.nodeId, axis: pole.axis, poles: [] });
    approaches.get(key).poles.push(pole);
  }
  const redSpots = lampSpots.filter((s) => s.color === 'red');
  const yellowSpots = lampSpots.filter((s) => s.color === 'yellow');
  const greenSpots = lampSpots.filter((s) => s.color === 'green');
  // Per-sector lamp meshes, per colour. Each pole records which sector
  // mesh and index its three lamps live in, so the per-frame update can
  // touch exactly the lamps whose colour changed.
  function lampMeshes(spots, mat) {
    const buckets = Array.from({ length: SECTOR_N }, () => []);
    const idx = new Map();
    for (const s of spots) {
      const si = sectorOf(s.x, s.z);
      idx.set(`${s.x},${s.z}`, { si, i: buckets[si].length });
      buckets[si].push({ px: s.x, py: s.y, pz: s.z, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1 });
    }
    return { meshes: buckets.map((b) => instanced(b, lampGeo, mat)), idx };
  }
  const lampRed = lampMeshes(redSpots, redMat);
  const lampYellow = lampMeshes(yellowSpots, yellowMat);
  const lampGreen = lampMeshes(greenSpots, greenMat);
  for (const a of approaches.values()) {
    for (const pole of a.poles) {
      for (const [color, table] of [['red', lampRed], ['yellow', lampYellow], ['green', lampGreen]]) {
        const spot = pole.lamps[color];
        const loc = table.idx.get(`${spot.x},${spot.z}`);
        pole[color] = { mesh: table.meshes[loc.si], i: loc.i, x: spot.x, y: spot.y, z: spot.z };
      }
    }
    // Last lit colour (null = never set): the per-frame update only
    // touches approaches whose colour changed since the last frame.
    a.color = null;
  }

  return {
    graph,
    sectors: {
      deck: sectored(slabs, unitBox, asphalt),
      barrier: sectored(barriers, unitBox, concrete),
      pillar: sectored(pillars, unitBox, pierMat),
      median: sectored(medians, unitBox, medianMat),
      dash: sectored(dashes, unitBox, dashMat),
      pole: sectored(poles, unitBox, poleMat),
      head: sectored(heads, unitBox, headMat),
      lampRed: lampRed.meshes,
      lampYellow: lampYellow.meshes,
      lampGreen: lampGreen.meshes,
    },
    approaches: [...approaches.values()],
    counts: {
      deckSlabs: slabs.length, barriers: barriers.length, pillars: pillars.length,
      medians: medians.length, dashes: dashes.length, poles: poles.length,
      lights: graph.trafficLights.length, approaches: approaches.size,
      sectors: SECTOR_N,
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
  }
  // Exposed for automated tests (window.__neonBay.state): how much road
  // furniture actually got built, and the pole height it was built with.
  // state is recreated on New Game while _furn (module cache) survives,
  // so (re)attach the handle whenever this state object lacks it.
  if (!state.roadFurniture) {
    state.roadFurniture = { counts: _furn.counts, poleHeight: TRAFFIC_LIGHT_POLE_HEIGHT };
  }
  const f = _furn;
  const gen = f.gen || 0;
  // One pool.get per sector mesh (a Map lookup). The meshes carry their
  // own bounding spheres with frustumCulled = true, so the renderer only
  // draws the sectors near the camera — the dashes and lamps of the far
  // side of the city never reach the GPU.
  const nSec = FURNITURE_SECTORS.cols * FURNITURE_SECTORS.rows;
  const kinds = ['deck', 'barrier', 'pillar', 'median', 'dash', 'pole', 'head', 'lampRed', 'lampYellow', 'lampGreen'];
  for (let si = 0; si < nSec; si += 1) {
    for (const key of kinds) {
      const mesh = f.sectors[key][si];
      if (!mesh) continue;
      pool.get(`furn-${gen}-s${si}-${key}`, () => mesh);
    }
  }
  // Traffic-light lamps: light the lamp that matches the phase, hide the
  // other two (scale 0). The phase comes from the same clock as the
  // traffic logic, so a car that stops at red sees a red lamp. Only
  // approaches whose colour CHANGED since the last frame are touched —
  // a phase flips ~4x per 30 s per light, so this is a handful of
  // setMatrixAt calls per frame instead of 1713, and only the sector
  // meshes that changed get their instance buffer re-uploaded.
  const t = state.trafficTime || 0;
  const zero = new T.Matrix4().makeScale(0, 0, 0);
  const one = new T.Matrix4();
  const dirty = new Set();
  function setLamp(entry, on) {
    if (!entry || !entry.mesh || entry.i === undefined) return;
    if (on) {
      one.makeTranslation(entry.x, entry.y, entry.z);
      entry.mesh.setMatrixAt(entry.i, one);
    } else {
      entry.mesh.setMatrixAt(entry.i, zero);
    }
    dirty.add(entry.mesh);
  }
  for (const a of f.approaches) {
    const st = graph.lightStateAt(a.nodeId, t);
    const color = a.axis === 'ns' ? st.ns : st.ew;
    if (color === a.color) continue;
    a.color = color;
    // Both poles on this axis show the same colour.
    for (const pole of a.poles) {
      setLamp(pole.red, color === 'red');
      setLamp(pole.yellow, color === 'yellow');
      setLamp(pole.green, color === 'green');
    }
  }
  for (const mesh of dirty) mesh.instanceMatrix.needsUpdate = true;
  // Debug read-back for tests: for the first few approaches, which lamp
  // is actually lit in the instance buffer vs the logical phase colour.
  // A lit lamp's matrix is a translation (element 0 = 1); a hidden one
  // is a zero scale (element 0 = 0). Catches a wrong sector/index
  // mapping: exactly one of red/yellow/green must read lit, and it must
  // match a.color.
  const sample = [];
  for (let k = 0; k < Math.min(4, f.approaches.length); k += 1) {
    const a = f.approaches[k];
    const pole = a.poles[0];
    const lit = {};
    for (const color of ['red', 'yellow', 'green']) {
      const e = pole[color];
      lit[color] = !!e.mesh && e.mesh.instanceMatrix.array[e.i * 16] === 1;
    }
    sample.push({ nodeId: a.nodeId, axis: a.axis, color: a.color, lit });
  }
  state.roadFurniture.lampSample = sample;
  void time;
}

export function drawVehicles(pool, state, time) {
  drawRoadFurniture(pool, state, time);
  // v5 perf: vehicles farther than ~250 m from the camera focus (+ the
  // follow distance) are not drawn — pool.get is skipped, so the pool
  // drops their mesh at endFrame and it is rebuilt when they come near.
  // 250 m is safely beyond the visible range at every zoom level, and
  // the player's own car is always drawn.
  const cam = state.camera || null;
  const cut = cam ? DRAW_FAR_METRES + (cam.dist || 14) : Infinity;
  const cut2 = cut * cut;
  const camX = cam ? cam.x : 0;
  const camY = cam ? cam.y : 0;
  for (const v of state.vehicles) {
    if (state.playerVehicle === v) continue;
    if (cam) {
      const dx = v.x - camX;
      const dy = v.y - camY;
      if (dx * dx + dy * dy > cut2) continue;
    }
    drawVehicle(pool, v, time);
  }
  if (state.playerVehicle) drawVehicle(pool, state.playerVehicle, time);
}
