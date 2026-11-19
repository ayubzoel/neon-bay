// Neon Bay — the people: pedestrians who wander the sidewalks, shopkeepers
// behind their counters, and mission givers with a job for you. Talk with E,
// pickpocket with Q — but getting caught brings the police.
import { DIALOGUE_GREETINGS, DIALOGUE_TIPS, NPC_NAMES } from './data.js';
import { activeCharacter, addMoney, addWanted, showMessage } from './state.js';

const PED_COLORS = ['#f59e0b', '#22c55e', '#a855f7', '#14b8a6', '#f97316', '#e2e8f0', '#84cc16'];

function makePed(rng, x, y) {
  return {
    kind: 'ped',
    name: rng.pick(NPC_NAMES),
    x, y, angle: rng.range(0, Math.PI * 2),
    speed: 45 + rng.next() * 30,
    money: 10 + Math.floor(rng.next() * 90),
    color: rng.pick(PED_COLORS),
    state: 'walk',
    targetX: x, targetY: y,
    waitTimer: rng.range(0, 3),
    hp: 40,
  };
}

export function spawnNpcs(state, world, rng) {
  const list = [];
  for (let i = 0; i < 46; i += 1) {
    const p = world.randomRoadPoint(0);
    list.push(makePed(rng, p.x, p.y));
  }
  for (let i = 0; i < 14; i += 1) {
    const p = world.randomRoadPoint(1);
    list.push(makePed(rng, p.x, p.y));
  }
  for (let i = 0; i < 8; i += 1) {
    const p = world.randomRoadPoint(2);
    list.push(makePed(rng, p.x, p.y));
  }
  for (const shop of world.shops) {
    list.push({
      kind: 'shopkeeper', name: rng.pick(NPC_NAMES), x: shop.x + 45, y: shop.y + 35,
      angle: Math.PI / 2, speed: 0, money: 0, color: '#f8fafc', state: 'idle',
      shopId: shop.id, hp: 100,
    });
  }
  // Rico, the diner owner who hands out the first missions, waits by the diner.
  list.push({
    kind: 'giver', name: 'Rico Alvarez', x: 940, y: 1660, angle: Math.PI / 2,
    speed: 0, money: 0, color: '#f59e0b', state: 'idle', hp: 100,
  });
  state.npcs = list;
}

function nearestBullet(state, npc) {
  for (const b of state.bullets) {
    if (Math.hypot(b.x - npc.x, b.y - npc.y) < 130) return true;
  }
  return false;
}

export function updateNpcs(state, world, dt, rng) {
  const hero = activeCharacter(state);
  for (const npc of state.npcs) {
    if (npc.kind !== 'ped') continue;
    if (npc.state === 'flee') {
      const dx = npc.x - hero.x;
      const dy = npc.y - hero.y;
      const d = Math.hypot(dx, dy) || 1;
      npc.angle = Math.atan2(dy, dx);
      const nx = npc.x + Math.cos(npc.angle) * 170 * dt;
      const ny = npc.y + Math.sin(npc.angle) * 170 * dt;
      if (!world.collides(nx, npc.y, 12, state.unlocked)) npc.x = nx;
      if (!world.collides(npc.x, ny, 12, state.unlocked)) npc.y = ny;
      if (Math.hypot(hero.x - npc.x, hero.y - npc.y) > 420) npc.state = 'walk';
      continue;
    }
    if (nearestBullet(state, npc) || state.wanted >= 3) {
      npc.state = 'flee';
      continue;
    }
    if (npc.waitTimer > 0) {
      npc.waitTimer -= dt;
      if (npc.waitTimer <= 0) {
        const p = world.randomRoadPoint(0);
        npc.targetX = p.x;
        npc.targetY = p.y;
      }
      continue;
    }
    const dx = npc.targetX - npc.x;
    const dy = npc.targetY - npc.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      npc.waitTimer = rng.range(1, 5);
      continue;
    }
    npc.angle = Math.atan2(dy, dx);
    const nx = npc.x + Math.cos(npc.angle) * npc.speed * dt;
    const ny = npc.y + Math.sin(npc.angle) * npc.speed * dt;
    if (!world.collides(nx, npc.y, 12, state.unlocked)) npc.x = nx;
    if (!world.collides(npc.x, ny, 12, state.unlocked)) npc.y = ny;
  }
}

export function talkToNpc(state, npc) {
  if (npc.kind === 'giver') return null; // Mission givers open the mission dialog instead.
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

function box3(T, w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    new T.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

/** Low-poly pedestrian, ~29 tall, facing +X, legs swinging while walking. */
function buildPedFigure(T, npc) {
  if (!T) return dummyObj();
  const g = new T.Group();
  const pants = 0x1f2937;
  function leg(pz) {
    const pivot = new T.Group();
    pivot.position.set(0, 9, pz);
    pivot.add(box3(T, 6, 9, 5, pants, 0, -4.5, 0));
    g.add(pivot);
    return pivot;
  }
  const legL = leg(-3.5);
  const legR = leg(3.5);
  const body = box3(T, 9, 12, 14, npc.color || '#e2e8f0', 0, 15, 0);
  const head = box3(T, 8, 8, 8, 0xe8b98a, 0, 25, 0);
  g.add(body);
  g.add(head);
  g.userData = { legL, legR, body };
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
    if (ud.body && ud.body.material && ud.body.material.color) {
      try {
        ud.body.material.color.set(npc.color || '#e2e8f0');
      } catch {
        // Keep the built colour on a bad colour string.
      }
    }
    const walking = npc.state === 'walk' || npc.state === 'flee';
    const swing = walking ? Math.sin(time * 8 + npc.x * 0.05) * 0.5 : 0;
    if (ud.legL) ud.legL.rotation.z = swing;
    if (ud.legR) ud.legR.rotation.z = -swing;
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
