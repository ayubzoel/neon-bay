// Neon Bay — on-foot movement: walking, running, swimming, jumping and the
// companion who follows the inactive character. Collision slides along walls.
import { PLAYER_RUN_SPEED, PLAYER_SWIM_SPEED, PLAYER_WALK_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { activeCharacter, inactiveCharacter } from './state.js';
import { isWater } from './world.js';

const RADIUS = 13;

function moveWithCollision(state, world, char, dx, dy) {
  const r = RADIUS;
  const nx = char.x + dx;
  if (!world.collides(nx, char.y, r, state.unlocked)) char.x = nx;
  const ny = char.y + dy;
  if (!world.collides(char.x, ny, r, state.unlocked)) char.y = ny;
  char.x = Math.max(r, Math.min(WORLD_WIDTH - r, char.x));
  char.y = Math.max(r, Math.min(WORLD_HEIGHT - r, char.y));
}

/** Move the active character; the inactive one follows behind. */
export function updatePlayer(state, world, dt, input) {
  const hero = activeCharacter(state);
  const other = inactiveCharacter(state);
  let mx = input.moveX();
  let my = input.moveY();
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const inWater = isWater(hero.x, hero.y);
  hero.swimming = inWater;
  const speed = inWater ? PLAYER_SWIM_SPEED : input.run ? PLAYER_RUN_SPEED : PLAYER_WALK_SPEED;
  hero.moving = len > 0.15;
  if (hero.moving) hero.angle = Math.atan2(my, mx);
  if (input.pressed('Space') && !inWater) hero.jump = 0.28;
  if (hero.jump > 0) hero.jump -= dt;

  if (inWater) {
    hero.stamina = Math.max(0, hero.stamina - dt * 5);
    if (hero.stamina <= 0) hero.hp = Math.max(1, hero.hp - dt * 2);
  } else {
    hero.stamina = Math.min(100, hero.stamina + dt * 12);
  }

  moveWithCollision(state, world, hero, mx * speed * dt, my * speed * dt);

  // The companion trails the active character and catches up after a drive.
  const dx = hero.x - other.x;
  const dy = hero.y - other.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 700) {
    other.x = hero.x - 40;
    other.y = hero.y + 40;
  } else if (dist > 46) {
    const followSpeed = dist > 200 ? PLAYER_RUN_SPEED + 40 : PLAYER_WALK_SPEED;
    const step = Math.min(dist - 40, followSpeed * dt);
    moveWithCollision(state, world, other, (dx / dist) * step, (dy / dist) * step);
    other.angle = Math.atan2(dy, dx);
    other.moving = true;
  } else {
    other.moving = false;
  }
  other.swimming = isWater(other.x, other.y);

  state.camera.x = hero.x;
  state.camera.y = hero.y;
}

/** What the player can interact with right here, nearest first. */
export function nearestInteractable(state, world) {
  const hero = activeCharacter(state);
  const out = [];
  for (const shop of world.shops) {
    const d = Math.hypot(shop.x + 45 - hero.x, shop.y + 35 - hero.y);
    if (d < 110) out.push({ kind: 'shop', shop, dist: d, label: `Enter ${shop.name}` });
  }
  const doorD = Math.hypot(495 - hero.x, 1610 - hero.y);
  if (doorD < 70) out.push({ kind: 'safehouse', dist: doorD, label: 'Enter Safe House' });
  for (const spot of world.activitySpots) {
    const d = Math.hypot(spot.x - hero.x, spot.y - hero.y);
    if (d < spot.r + 30) out.push({ kind: 'activity', spot, dist: d, label: `Play ${spot.name}` });
  }
  for (const npc of state.npcs) {
    if (npc.kind === 'giver' || npc.kind === 'shopkeeper') continue;
    const d = Math.hypot(npc.x - hero.x, npc.y - hero.y);
    if (d < 60) out.push({ kind: 'npc', npc, dist: d, label: `Talk to ${npc.name}` });
  }
  for (const npc of state.npcs) {
    if (npc.kind !== 'giver') continue;
    const d = Math.hypot(npc.x - hero.x, npc.y - hero.y);
    if (d < 70) out.push({ kind: 'giver', npc, dist: d, label: `Talk to ${npc.name}` });
  }
  out.sort((a, b) => a.dist - b.dist);
  return out[0] || null;
}

/** Draw one top-down character: shadow, outfit body, head, facing tick, name tag. */
export function drawCharacter(ctx, char, isActive, time) {
  const bob = char.moving ? Math.sin(time * 10) * 2 : 0;
  const lift = char.jump > 0 ? 6 : 0;
  ctx.save();
  ctx.translate(char.x, char.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 13, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -lift);
  // Body in the outfit colour, head in skin tone, a facing tick for the aim.
  ctx.fillStyle = char.outfitColor || char.color;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = char.sex === 'female' ? '#f2c89b' : '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(char.angle) * 3, Math.sin(char.angle) * 3 + bob * 0.3, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(Math.cos(char.angle) * 10, Math.sin(char.angle) * 10);
  ctx.lineTo(Math.cos(char.angle) * 18, Math.sin(char.angle) * 18);
  ctx.stroke();
  if (isActive) {
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 17, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (isActive) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(char.name, char.x, char.y - 24);
  }
}
