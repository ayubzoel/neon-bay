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
import { DIALOGUE_GREETINGS, DIALOGUE_TIPS, MAYA_LINES, NPC_NAMES } from './data.js';
import { activeCharacter, addMoney, addWanted } from './state.js';
import { districtAt } from './world.js';
import { hairMat, pantsMat, shoeMat, skinMat, stdMat } from './textures.js';

const PED_COLORS = ['#f59e0b', '#22c55e', '#a855f7', '#14b8a6', '#f97316', '#e2e8f0', '#84cc16'];
const SKIN_TONES = [0xe8b98a, 0xc98e5f, 0x8d5524, 0xf2c89b];
const HAIR_COLORS = [0x1f2937, 0x3b1f1a, 0x6b7280, 0xb45309, 0x111827];

function makePed(rng, x, y) {
  return {
    kind: 'ped',
    name: rng.pick(NPC_NAMES),
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: 45 + rng.next() * 30,
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
  // The map is ~3x the v2 area, so the crowds grow with it.
  for (let i = 0; i < 60; i += 1) {
    const p = world.randomSidewalkPoint(0);
    list.push(makePed(rng, p.x, p.y));
  }
  for (let i = 0; i < 20; i += 1) {
    const p = world.randomSidewalkPoint(1);
    list.push(makePed(rng, p.x, p.y));
  }
  for (let i = 0; i < 12; i += 1) {
    const p = world.randomSidewalkPoint(2);
    list.push(makePed(rng, p.x, p.y));
  }
  for (const shop of world.shops) {
    list.push({
      kind: 'shopkeeper', name: rng.pick(NPC_NAMES), x: shop.x + 45, y: shop.y + 35,
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

function nearestBullet(state, npc) {
  for (const b of state.bullets) {
    if (Math.hypot(b.x - npc.x, b.y - npc.y) < 130) return true;
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
    const nodePath = world.graph.findPath(npc.x, npc.y, node.x, node.y, state.unlocked);
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
      if (Math.hypot(join.x - npc.x, join.y - npc.y) > 12) waypoints.unshift(join);
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
  if (d < 10) {
    npc.pathIdx += 1;
    return npc.pathIdx >= npc.path.length;
  }
  npc.angle = Math.atan2(dy, dx);
  const step = speed * dt;
  const nx = npc.x + (dx / d) * step;
  const ny = npc.y + (dy / d) * step;
  // Sidewalk waypoints never enter a solid, but a peaks cabin can sit on a
  // path: slide along it, and give up if truly stuck.
  const movedX = !world.collides(nx, npc.y, 12, state.unlocked);
  const movedY = !world.collides(npc.x, ny, 12, state.unlocked);
  if (movedX) npc.x = nx;
  if (movedY) npc.y = ny;
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
  const hero = activeCharacter(state);
  for (const npc of state.npcs) {
    if (npc.kind !== 'ped') continue;
    if (npc.state === 'flee') {
      const done = followPath(state, world, npc, dt, 170);
      if (done || Math.hypot(hero.x - npc.x, hero.y - npc.y) > 420) {
        npc.state = 'walk';
        npc.path = null;
        npc.waitTimer = rng.range(0, 2);
      }
      continue;
    }
    if (nearestBullet(state, npc) || state.wanted >= 3) {
      npc.state = 'flee';
      // Run away along the sidewalks, not in a straight line through walls.
      if (!pickNewPath(state, world, npc, rng, 350)) {
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
  if (dist > 60) return false;
  const seen = Math.random() < 0.35 || state.police.some((p) => Math.hypot(p.x - hero.x, p.y - hero.y) < 300);
  if (Math.random() < 0.7 && !seen) {
    const take = Math.min(npc.money, 10 + Math.floor(Math.random() * 70));
    npc.money -= take;
    state.stats.stolen += take;
    addMoney(state, take, `Lifted $${take} from ${npc.name}`);
    npc.state = 'flee';
    return true;
  }
  addWanted(state, 1, `${npc.name} caught you stealing`);
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
 * Pedestrian, ~29 tall, facing +X, in human proportions: shoes, legs on
 * hip pivots, arms on shoulder pivots that swing while walking, shirt,
 * skin-toned head with hair (short, or long down the back for Maya and
 * some passers-by). Shirt, skin and hair vary per person.
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
    pivot.position.set(0, 9, pz);
    pivot.add(box3(T, 6, 9, 5, pants, 0, -4.5, 0));
    pivot.add(box3(T, 6, 2.5, 8, shoes, 1, -9.5, 0));
    g.add(pivot);
    return pivot;
  }
  function arm(pz) {
    const pivot = new T.Group();
    pivot.position.set(0, 20, pz);
    pivot.add(box3(T, 4, 9, 4, shirt, 0, -4.5, 0));
    pivot.add(box3(T, 3.5, 2.5, 3.5, skin, 0, -10, 0));
    g.add(pivot);
    return pivot;
  }
  const legL = leg(-3.5);
  const legR = leg(3.5);
  const armL = arm(-8.5);
  const armR = arm(8.5);
  const body = box3(T, 9, 12, 14, shirt, 0, 15, 0);
  const head = box3(T, 8, 8, 8, skin, 0, 25, 0);
  const hairTop = box3(T, 8.6, 2.2, 8.6, hair, -0.3, 29.4, 0);
  g.add(body);
  g.add(head);
  g.add(hairTop);
  if (npc.hair === 'long') {
    // Long hair down the back (-X side, behind the face).
    g.add(box3(T, 2.6, 11, 8.6, hair, -4.4, 24, 0));
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
  state.npcs.forEach((npc, i) => {
    const mesh = pool.get(`npc-${i}`, () => buildPedFigure(T, npc));
    mesh.position.set(npc.x, 0, npc.y);
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
          new T.OctahedronGeometry(9),
          new T.MeshLambertMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.4 }),
        );
      });
      mark.position.set(npc.x, 44 + Math.sin(time * 4) * 3, npc.y);
      mark.rotation.y = time * 2;
      mark.visible = true;
    }
  });
}

function drawNpcs2D(ctx, state, time) {
  for (const npc of state.npcs) {
    const bob = npc.state === 'walk' ? Math.sin(time * 8 + npc.x) * 1.5 : 0;
    ctx.save();
    ctx.translate(npc.x, npc.y + bob * 0.2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 9, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = npc.color;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(Math.cos(npc.angle) * 2, Math.sin(npc.angle) * 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (npc.kind === 'giver') {
      ctx.fillStyle = '#fde047';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', npc.x, npc.y - 22 + Math.sin(time * 4) * 3);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(npc.name, npc.x, npc.y - 34);
    }
  }
}
