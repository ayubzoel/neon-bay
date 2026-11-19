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

export function drawNpcs(ctx, state, time) {
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
