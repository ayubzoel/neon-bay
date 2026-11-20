// Neon Bay — the people: pedestrians who walk the sidewalks, shopkeepers
// behind their counters, and mission givers with a job for you. Talk with E,
// pickpocket with Q — but getting caught brings the police.
//
// v3: pedestrians walk ONLY on sidewalks (roadgraph.js). A walk is a path
// along the road graph: each leg is walked on its right-hand sidewalk, and
// the road is crossed only at intersections, inside the zebra zone, when
// the path turns onto a new street. Nobody cuts through blocks, parks or
// buildings, and nobody wanders at random. Stationary NPCs (givers,
// shopkeepers) never move. Fleeing pedestrians run along the sidewalks too.
import { AMBIENT_CROWD, DENSITY_LEVELS, DEFAULT_DENSITY, DRAW_FAR_METRES } from './config.js';
import { DIALOGUE_GREETINGS, DIALOGUE_TIPS, MAYA_LINES, NPC_NAMES } from './data.js';
import { addStrings, t } from './i18n.js';
import { activeCharacter, addMoney, addWanted } from './state.js';
import { districtAt } from './world.js';
import { hairMat, pantsMat, shoeMat, skinMat, stdMat } from './textures.js';

const PED_COLORS = ['#f59e0b', '#22c55e', '#a855f7', '#14b8a6', '#f97316', '#e2e8f0', '#84cc16'];
const SKIN_TONES = [0xe8b98a, 0xc98e5f, 0x8d5524, 0xf2c89b];
const HAIR_COLORS = [0x1f2937, 0x3b1f1a, 0x6b7280, 0xb45309, 0x111827];

// --- i18n (Builder C owns game/src/i18n.js: t, addStrings, setLang,
// getLang). NPC dialogue lines themselves live in data.js (outside this
// build's scope) and are already English; their Indonesian translations
// belong to the data.js owner.
const NPC_STRINGS_EN = {
  'npc.lifted': 'Lifted {take} from {name}',
  'npc.caughtStealing': '{name} caught you stealing',
};
const NPC_STRINGS_ID = {
  'npc.lifted': 'Mencopet {take} dari {name}',
  'npc.caughtStealing': '{name} memergokimu mencuri',
};
addStrings('en', NPC_STRINGS_EN);
addStrings('id', NPC_STRINGS_ID);

function makePed(rng, x, y, z = 0) {
  return {
    kind: 'ped',
    name: rng.pick(NPC_NAMES),
    x, y, z, angle: rng.range(0, Math.PI * 2),
    // Walking speed in m/s: a relaxed stroll is ~1.2-1.8 m/s.
    speed: 1.2 + rng.next() * 0.6,
    money: 10 + Math.floor(rng.next() * 90),
    color: rng.pick(PED_COLORS),
    skin: rng.pick(SKIN_TONES),
    hairColor: rng.pick(HAIR_COLORS),
    hair: rng.chance(0.3) ? 'long' : 'short',
    state: 'walk',
    path: null, pathIdx: 0,
    waitTimer: rng.range(0, 3),
    stuckTimer: 0,
    hp: 40,
  };
}

export function spawnNpcs(state, world, rng) {
  const list = [];
  // Crowd size follows the density setting (config.js DENSITY_LEVELS);
  // 'high' is the v4 default: 85 downtown, 32 beach, 23 peaks.
  const density = DENSITY_LEVELS[state.densityLevel] || DENSITY_LEVELS[DEFAULT_DENSITY];
  // v5 living city: part of the downtown quota is born on the sidewalks
  // around the hero (he starts downtown at the safe house), so the street
  // outside the door is busy from the first frame instead of empty — the
  // rest scatter city-wide exactly as in v4, so the totals do not change.
  const hero = activeCharacter(state);
  const near0 = Math.min(AMBIENT_CROWD.initialNear.peds, density.peds[0]);
  const close0 = Math.min(AMBIENT_CROWD.initialClose.peds, near0);
  for (let i = 0; i < density.peds[0]; i += 1) {
    let p;
    if (i < close0) {
      // On the hero's own street: the first thing the player sees is
      // people walking past, not an empty road.
      p = sidewalkPointNear(world.graph, rng, hero.x, hero.y, AMBIENT_CROWD.pedCloseMin, AMBIENT_CROWD.pedCloseMax);
    } else if (i < near0) {
      p = sidewalkPointNear(world.graph, rng, hero.x, hero.y, AMBIENT_CROWD.pedSpawnMin, AMBIENT_CROWD.pedSpawnMax);
    } else {
      p = world.randomSidewalkPoint(0);
    }
    list.push(makePed(rng, p.x, p.y, p.z || 0));
  }
  for (let i = 0; i < density.peds[1]; i += 1) {
    const p = world.randomSidewalkPoint(1);
    list.push(makePed(rng, p.x, p.y, p.z || 0));
  }
  for (let i = 0; i < density.peds[2]; i += 1) {
    const p = world.randomSidewalkPoint(2);
    list.push(makePed(rng, p.x, p.y, p.z || 0));
  }
  for (const shop of world.shops) {
    list.push({
      kind: 'shopkeeper', name: rng.pick(NPC_NAMES), x: shop.x + 3, y: shop.y + 2.5,
      angle: Math.PI / 2, speed: 0, money: 0, color: '#f8fafc', state: 'idle',
      shopId: shop.id, hp: 100,
    });
  }
  // Rico, the diner owner who hands out the first missions, waits on the
  // sidewalk by the Neon Diner (1800, 2558).
  list.push({
    kind: 'giver', name: 'Rico Alvarez', x: 1740, y: 2558, angle: Math.PI / 2,
    speed: 0, money: 0, color: '#f59e0b', state: 'idle', hp: 100,
  });
  // Maya Reyes, Leo's old friend from the neighbourhood: no longer playable,
  // she waits by the diner with a lead whenever Leo needs one. Talk to her.
  list.push({
    kind: 'friend', name: 'Maya Reyes', x: 1700, y: 2650, angle: Math.PI / 2,
    speed: 0, money: 0, color: '#ec4899', skin: 0xf2c89b, hairColor: 0x3b1f1a,
    hair: 'long', state: 'idle', hp: 100,
  });
  state.npcs = list;
}

// --- v5 living city: sidewalk points near the hero ----------------------
// Pick a ground-level graph node within maxR of (x, y) by reservoir
// sampling (one pass over the nodes, no array built — the graph has
// thousands of nodes and this runs a few times a second at most).
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

/** A sidewalk point in the band [minR, maxR] around (x, y): pick a nearby
 * intersection, take a random street off it, and stand on that street's
 * sidewalk. Falls back to the nearest sidewalk of a random point in the
 * band, so it always returns a real sidewalk — never a building, a park,
 * or the middle of a road. */
export function sidewalkPointNear(graph, rng, x, y, minR, maxR) {
  for (let tries = 0; tries < 10; tries += 1) {
    const node = randomGroundNodeNear(graph, rng, x, y, maxR);
    if (!node || !node.segs || node.segs.length === 0) break;
    const seg = graph.segments[node.segs[Math.floor(rng.next() * node.segs.length)]];
    if (!seg || (seg.level !== 0 && !seg.walkable)) continue;
    const p = graph.sidewalkPoint(seg, rng.range(0.1, 0.9), rng.next() < 0.5 ? 1 : -1);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d >= minR * 0.5 && d <= maxR) return p;
  }
  const a = rng.range(0, Math.PI * 2);
  const r = rng.range(minR, maxR);
  return graph.nearestSidewalkPoint(x + Math.cos(a) * r, y + Math.sin(a) * r);
}

/** The pedestrian balancer (v5 living city): once per sim-second, count
 * the walking peds near the hero and, if the district target
 * (config.js AMBIENT_CROWD) is not met, recycle the farthest peds —
 * same-district ones first, so the beach and peaks keep their own crowds
 * — onto sidewalks near the hero. A recycled ped drops its old path and
 * picks a new one where it lands, so it walks on like it always lived
 * there. Totals never change: this only moves peds that already exist.
 * Stationary NPCs (givers, shopkeepers, Maya) are never touched. */
export function maintainPedCrowd(state, world, dt, rng) {
  const cfg = AMBIENT_CROWD;
  state.crowdPedCd = (state.crowdPedCd || 0) - dt;
  if (state.crowdPedCd > 0) return;
  state.crowdPedCd = cfg.checkSeconds;
  const hero = activeCharacter(state);
  const district = districtAt(hero.x, hero.y);
  const target = (cfg.targets[district] || cfg.targets[0]).peds;
  let count = 0;
  const far = [];
  for (const n of state.npcs) {
    if (n.kind !== 'ped') continue;
    const d = Math.hypot(n.x - hero.x, n.y - hero.y);
    if (d <= cfg.pedNear) count += 1;
    else far.push({ n, d, same: districtAt(n.x, n.y) === district });
  }
  const need = target - count;
  if (need > 0 && far.length > 0) {
    // Same-district peds first (keep the other districts populated), then
    // farthest first within each group.
    far.sort((a, b) => (b.same - a.same) || (b.d - a.d));
    const moves = Math.min(need, cfg.maxPerTick.peds, far.length);
    for (let i = 0; i < moves; i += 1) {
      const ped = far[i].n;
      const p = sidewalkPointNear(world.graph, rng, hero.x, hero.y, cfg.pedSpawnMin, cfg.pedSpawnMax);
      if (!p) continue;
      ped.x = p.x;
      ped.y = p.y;
      ped.z = p.z || 0;
      ped.path = null;
      ped.pathIdx = 0;
      ped.state = 'walk';
      ped.waitTimer = rng.range(0, 2);
      ped.stuckTimer = 0;
    }
  }
  // Close top-up: if the near field is nearly empty, recycle ONE far ped
  // into the far side of the close band, so the street right around the
  // hero never goes quiet while the ring refills. Only when the count
  // within 120 m is below target — never on a busy street.
  let close = 0;
  for (const n of state.npcs) {
    if (n.kind !== 'ped') continue;
    if (Math.hypot(n.x - hero.x, n.y - hero.y) <= cfg.pedCloseRadius) close += 1;
  }
  if (close < cfg.pedCloseTarget) {
    // Reuse the far list (same-district first, farthest first); the main
    // top-up above may have already moved some of them — skip any that
    // already landed near the hero.
    for (const entry of far) {
      const ped = entry.n;
      if (Math.hypot(ped.x - hero.x, ped.y - hero.y) <= cfg.pedNear) continue;
      const p = sidewalkPointNear(world.graph, rng, hero.x, hero.y, cfg.pedCloseSpawnMin, cfg.pedCloseSpawnMax);
      if (!p) break;
      ped.x = p.x;
      ped.y = p.y;
      ped.z = p.z || 0;
      ped.path = null;
      ped.pathIdx = 0;
      ped.state = 'walk';
      ped.waitTimer = rng.range(0, 2);
      ped.stuckTimer = 0;
      break; // one per tick
    }
  }
}

function fallbackRng() {
  return {
    next: () => Math.random(),
    range: (a, b) => a + Math.random() * (b - a),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
  };
}

/** Settings hook: set the walking-pedestrian density live ('low' |
 * 'medium' | 'high', see config.js DENSITY_LEVELS). Extra peds are removed
 * (walking peds only — givers, shopkeepers and friends stay); missing peds
 * are spawned on sidewalks across all three districts. Called by
 * applyDensity (vehicles.js) and directly by the Settings menu.
 * rng is optional: without one a Math.random shim is used. */
export function applyPedDensity(level, state, world, rng) {
  const density = DENSITY_LEVELS[level] || DENSITY_LEVELS[DEFAULT_DENSITY];
  if (!state.npcs) return density;
  const r = rng || fallbackRng();
  // Remove excess PER DISTRICT, not just the total: trimming from the end
  // of the list would empty the peaks/beach first and leave downtown over
  // target, and the per-district spawn below would then add the missing
  // districts back on top — 'low' would end up at 86 peds, not 63.
  const counts = [0, 0, 0];
  for (const n of state.npcs) {
    if (n.kind === 'ped') counts[districtAt(n.x, n.y)] += 1;
  }
  for (let d = 0; d < 3; d += 1) {
    let over = counts[d] - density.peds[d];
    if (over <= 0) continue;
    for (let i = state.npcs.length - 1; i >= 0 && over > 0; i -= 1) {
      if (state.npcs[i].kind === 'ped' && districtAt(state.npcs[i].x, state.npcs[i].y) === d) {
        state.npcs.splice(i, 1);
        over -= 1;
      }
    }
  }
  // Re-count after the removal (counts above are pre-removal).
  counts[0] = 0; counts[1] = 0; counts[2] = 0;
  for (const n of state.npcs) {
    if (n.kind === 'ped') counts[districtAt(n.x, n.y)] += 1;
  }
  for (let d = 0; d < 3; d += 1) {
    for (let i = counts[d]; i < density.peds[d]; i += 1) {
      const p = world.randomSidewalkPoint(d);
      state.npcs.push(makePed(r, p.x, p.y, p.z || 0));
    }
  }
  return density;
}

function nearestBullet(state, npc) {
  for (const b of state.bullets) {
    if (Math.hypot(b.x - npc.x, b.y - npc.y) < 18) return true;
  }
  return false;
}

// Districts this pedestrian may walk in: its own, plus any unlocked one.
function allowedDistricts(state, npc) {
  const cur = districtAt(npc.x, npc.y);
  const out = [cur];
  for (let d = 0; d < 3; d += 1) {
    if (state.unlocked[d] && !out.includes(d)) out.push(d);
  }
  return out;
}

// Pick a new destination node and build the sidewalk path to it.
function pickNewPath(state, world, npc, rng, minDist = 0) {
  const allowed = allowedDistricts(state, npc);
  for (let tries = 0; tries < 6; tries += 1) {
    const node = world.graph.randomNode(rng, allowed);
    if (!node) return false;
    if (minDist > 0 && Math.hypot(node.x - npc.x, node.y - npc.y) < minDist) continue;
    const nodePath = world.graph.findPath(npc.x, npc.y, node.x, node.y, state.unlocked, { allowElevated: false, z1: npc.z || 0 });
    if (!nodePath || nodePath.length < 2) continue;
    const waypoints = world.graph.sidewalkWaypoints(nodePath, { x: npc.x, y: npc.y });
    if (waypoints.length === 0) continue;
    // Join: first walk along the sidewalk the pedestrian is already on, to
    // the intersection where the new path starts — never cut straight across
    // a road mid-block to reach the first waypoint. The hop from the join
    // point to the first waypoint then happens inside the intersection
    // (the zebra zone), where crossing is allowed.
    const near = world.graph.nearestSegmentPoint(npc.x, npc.y);
    if (near) {
      const seg = near.seg;
      const start = nodePath[0];
      const rx = -(seg.by - seg.ay) / Math.max(1, seg.length);
      const ry = (seg.bx - seg.ax) / Math.max(1, seg.length);
      const cx = seg.ax + (seg.bx - seg.ax) * near.t;
      const cy = seg.ay + (seg.by - seg.ay) * near.t;
      const side = (npc.x - cx) * rx + (npc.y - cy) * ry >= 0 ? 1 : -1;
      // If the start node lies on this segment, join it on this sidewalk;
      // otherwise join the nearer end of this segment.
      const dx = seg.bx - seg.ax;
      const dy = seg.by - seg.ay;
      const len2 = dx * dx + dy * dy || 1;
      const tNode = ((start.x - seg.ax) * dx + (start.y - seg.ay) * dy) / len2;
      let join;
      if (tNode >= 0 && tNode <= 1) join = world.graph.sidewalkPoint(seg, tNode, side);
      else {
        const dA = Math.hypot(start.x - seg.ax, start.y - seg.ay);
        const dB = Math.hypot(start.x - seg.bx, start.y - seg.by);
        join = world.graph.sidewalkPoint(seg, dA <= dB ? 0 : 1, side);
      }
      if (Math.hypot(join.x - npc.x, join.y - npc.y) > 0.6) waypoints.unshift(join);
    }
    npc.path = waypoints;
    npc.pathIdx = 0;
    npc.stuckTimer = 0;
    return true;
  }
  return false;
}

function followPath(state, world, npc, dt, speed) {
  if (!npc.path || npc.pathIdx >= npc.path.length) return true;
  const wp = npc.path[npc.pathIdx];
  const dx = wp.x - npc.x;
  const dy = wp.y - npc.y;
  const d = Math.hypot(dx, dy);
  if (d < 0.6) {
    npc.pathIdx += 1;
    // Sidewalk waypoints carry the road elevation (hill roads climb), so
    // the pedestrian rides the slope instead of floating or sinking.
    if (wp.z !== undefined) npc.z = wp.z;
    return npc.pathIdx >= npc.path.length;
  }
  npc.angle = Math.atan2(dy, dx);
  const step = speed * dt;
  const nx = npc.x + (dx / d) * step;
  const ny = npc.y + (dy / d) * step;
  // Sidewalk waypoints never enter a solid, but a peaks cabin can sit on a
  // path: slide along it, and give up if truly stuck.
  const movedX = !world.collides(nx, npc.y, 0.6, state.unlocked);
  const movedY = !world.collides(npc.x, ny, 0.6, state.unlocked);
  if (movedX) npc.x = nx;
  if (movedY) npc.y = ny;
  // Ride the sidewalk elevation as the pedestrian walks (hill roads).
  if (wp.z !== undefined) npc.z = (npc.z || 0) + (wp.z - (npc.z || 0)) * Math.min(1, dt * 6);
  if (!movedX && !movedY) {
    npc.stuckTimer += dt;
    if (npc.stuckTimer > 2) {
      npc.path = null;
      npc.stuckTimer = 0;
      return true;
    }
  } else {
    npc.stuckTimer = 0;
  }
  return false;
}

export function updateNpcs(state, world, dt, rng) {
  // v5 living city: keep the streets around the hero populated (recycles
  // far peds in, never adds any). Runs on its own 1 s throttle inside.
  maintainPedCrowd(state, world, dt, rng);
  const hero = activeCharacter(state);
  for (const npc of state.npcs) {
    if (npc.kind !== 'ped') continue;
    if (npc.state === 'flee') {
      const done = followPath(state, world, npc, dt, 4.5);
      if (done || Math.hypot(hero.x - npc.x, hero.y - npc.y) > 60) {
        npc.state = 'walk';
        npc.path = null;
        npc.waitTimer = rng.range(0, 2);
      }
      continue;
    }
    if (nearestBullet(state, npc) || state.wanted >= 3) {
      npc.state = 'flee';
      // Run away along the sidewalks, not in a straight line through walls.
      if (!pickNewPath(state, world, npc, rng, 60)) {
        npc.state = 'walk';
        npc.path = null;
      }
      continue;
    }
    if (npc.waitTimer > 0) {
      npc.waitTimer -= dt;
      if (npc.waitTimer <= 0 && !pickNewPath(state, world, npc, rng)) {
        npc.waitTimer = rng.range(1, 4);
      }
      continue;
    }
    if (!npc.path) {
      if (!pickNewPath(state, world, npc, rng)) {
        npc.waitTimer = rng.range(1, 4);
      }
      continue;
    }
    const done = followPath(state, world, npc, dt, npc.speed);
    if (done) {
      npc.path = null;
      npc.waitTimer = rng.range(1, 5);
    }
  }
}

export function talkToNpc(state, npc) {
  if (npc.kind === 'giver') return null; // Mission givers open the mission dialog instead.
  if (npc.kind === 'friend') return MAYA_LINES[Math.floor(Math.random() * MAYA_LINES.length)];
  const lines = [...DIALOGUE_GREETINGS, ...DIALOGUE_TIPS];
  return lines[Math.floor(Math.random() * lines.length)];
}

/** Pickpocket the nearest pedestrian: cash if it works, heat if it does not. */
export function pickpocket(state, npc) {
  if (npc.kind !== 'ped') return false;
  const hero = activeCharacter(state);
  const dist = Math.hypot(npc.x - hero.x, npc.y - hero.y);
  if (dist > 3) return false;
  const seen = Math.random() < 0.35 || state.police.some((p) => Math.hypot(p.x - hero.x, p.y - hero.y) < 40);
  if (Math.random() < 0.7 && !seen) {
    const take = Math.min(npc.money, 10 + Math.floor(Math.random() * 70));
    npc.money -= take;
    state.stats.stolen += take;
    addMoney(state, take, t('npc.lifted', { take: `$${take}`, name: npc.name }));
    npc.state = 'flee';
    return true;
  }
  addWanted(state, 1, t('npc.caughtStealing', { name: npc.name }));
  npc.state = 'flee';
  return false;
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

function shirtMaterial(T, color) {
  return stdMat(`shirt-${color}`, () => new T.MeshStandardMaterial({
    color, roughness: 0.9, metalness: 0,
  }));
}

/**
 * Pedestrian, 1.8 m tall, facing +X, in human proportions: shoes, legs on
 * hip pivots (0.82 m), arms on shoulder pivots (1.45 m) that swing while
 * walking, shirt, skin-toned head with hair (short, or long down the back
 * for Maya and some passers-by). Shirt, skin and hair vary per person.
 * (v4: 1 unit = 1 m, Leo Vance is 1.8 m — the same scale as the cars and
 * the roads. The old figure was ~29 units tall.)
 */
function buildPedFigure(T, npc) {
  if (!T) return dummyObj();
  const g = new T.Group();
  const skin = skinMat(npc.skin || 0xe8b98a);
  const hair = hairMat(npc.hairColor || 0x1f2937);
  const pants = pantsMat();
  const shoes = shoeMat();
  const shirt = shirtMaterial(T, npc.color || '#e2e8f0');
  function leg(pz) {
    const pivot = new T.Group();
    pivot.position.set(0, 0.82, pz);
    pivot.add(box3(T, 0.16, 0.82, 0.16, pants, 0, -0.41, 0));
    pivot.add(box3(T, 0.28, 0.08, 0.16, shoes, 0.05, -0.78, 0));
    g.add(pivot);
    return pivot;
  }
  function arm(pz) {
    const pivot = new T.Group();
    pivot.position.set(0, 1.45, pz);
    pivot.add(box3(T, 0.11, 0.55, 0.11, shirt, 0, -0.275, 0));
    pivot.add(box3(T, 0.09, 0.08, 0.09, skin, 0, -0.58, 0));
    g.add(pivot);
    return pivot;
  }
  const legL = leg(-0.09);
  const legR = leg(0.09);
  const armL = arm(-0.26);
  const armR = arm(0.26);
  const body = box3(T, 0.2, 0.6, 0.42, shirt, 0, 1.18, 0);
  const head = box3(T, 0.22, 0.24, 0.22, skin, 0, 1.62, 0);
  const hairTop = box3(T, 0.24, 0.06, 0.24, hair, -0.01, 1.76, 0);
  g.add(body);
  g.add(head);
  g.add(hairTop);
  if (npc.hair === 'long') {
    // Long hair down the back (-X side, behind the face).
    g.add(box3(T, 0.07, 0.3, 0.24, hair, -0.12, 1.62, 0));
  }
  g.userData = { legL, legR, armL, armR, body, shirtMat: shirt };
  return g;
}

export function drawNpcs(pool, state, time) {
  if (!isPool(pool)) {
    drawNpcs2D(pool, state, time);
    return;
  }
  const T = three();
  // v5 perf: pedestrians farther than ~250 m from the camera focus (+ the
  // follow distance) are not drawn — pool.get (and the per-frame shirt
  // material swap and limb animation) is skipped, so the pool drops
  // their mesh at endFrame and it is rebuilt when they come near again.
  // 250 m is safely beyond the visible range at every zoom level.
  const cam = state.camera || null;
  const cut = cam ? DRAW_FAR_METRES + (cam.dist || 14) : Infinity;
  const cut2 = cut * cut;
  const camX = cam ? cam.x : 0;
  const camY = cam ? cam.y : 0;
  state.npcs.forEach((npc, i) => {
    if (cam) {
      const dx = npc.x - camX;
      const dy = npc.y - camY;
      if (dx * dx + dy * dy > cut2) return;
    }
    const mesh = pool.get(`npc-${i}`, () => buildPedFigure(T, npc));
    mesh.position.set(npc.x, npc.z || 0, npc.y);
    mesh.rotation.y = -npc.angle;
    mesh.visible = true;
    const ud = mesh.userData || {};
    // The pool key is the NPC's index, and indices shift when an NPC is
    // removed — so swap the shirt material to this NPC's colour instead of
    // mutating a shared one.
    const shirt = shirtMaterial(T, npc.color || '#e2e8f0');
    if (ud.body) ud.body.material = shirt;
    if (ud.armL && ud.armL.children[0]) ud.armL.children[0].material = shirt;
    if (ud.armR && ud.armR.children[0]) ud.armR.children[0].material = shirt;
    const walking = npc.state === 'walk' || npc.state === 'flee';
    const swing = walking ? Math.sin(time * 8 + npc.x * 0.05) * 0.5 : 0;
    if (ud.legL) ud.legL.rotation.z = swing;
    if (ud.legR) ud.legR.rotation.z = -swing;
    if (ud.armL) ud.armL.rotation.z = -swing * 0.7;
    if (ud.armR) ud.armR.rotation.z = swing * 0.7;
    if (npc.kind === 'giver') {
      // Floating yellow octahedron "!" marker, bobbing above the giver.
      const mark = pool.get(`npc-mark-${i}`, () => {
        if (!T) return dummyObj();
        return new T.Mesh(
          new T.OctahedronGeometry(0.35),
          new T.MeshLambertMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.4 }),
        );
      });
      mark.position.set(npc.x, 2.1 + Math.sin(time * 4) * 0.1, npc.y);
      mark.rotation.y = time * 2;
      mark.visible = true;
    }
  });
}

function drawNpcs2D(ctx, state, time) {
  for (const npc of state.npcs) {
    const bob = npc.state === 'walk' ? Math.sin(time * 8 + npc.x) * 0.05 : 0;
    ctx.save();
    ctx.translate(npc.x, npc.y + bob * 0.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 0.3, 0.35, 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = npc.color;
    ctx.beginPath();
    ctx.arc(0, 0, 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(npc.angle) * 0.07, Math.sin(npc.angle) * 0.07, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (npc.kind === 'giver') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 0.7px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', npc.x, npc.y - 0.8 + Math.sin(time * 4) * 0.1);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 0.4px system-ui, sans-serif';
      ctx.fillText(npc.name, npc.x, npc.y - 1.2);
    }
  }
}
