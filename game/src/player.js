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
  // Camera-relative movement (v2): W walks away from the camera, D strafes
  // right across the screen. The camera forward on the ground plane is
  // (sin yaw, cos yaw); right is (cos yaw, -sin yaw).
  const yaw = (state.camera && state.camera.yaw) || 0;
  const fwd = -input.moveY();
  const str = input.moveX();
  const fx = Math.sin(yaw);
  const fy = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const ry = -Math.sin(yaw);
  let mx = fx * fwd + rx * str;
  let my = fy * fwd + ry * str;
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

// --- v2 3D drawing -------------------------------------------------------
// The first argument is the mesh pool (pool.get(id, buildFn)); while the v1
// 2D renderer is still in place it is a canvas context instead, and the old
// 2D figure below is used so the game stays playable either way.

function isPool(arg) {
  return !!arg && typeof arg.get === 'function';
}

function three() {
  return (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
}

// Stand-in for a THREE object when three.js is not loaded (unit tests):
// accepts position/rotation/scale writes and never throws.
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

/**
 * Low-poly figure, ~CHARACTER_HEIGHT tall, facing +X: legs and arms on pivot
 * groups so they can swing while walking, outfit-coloured body, skin head,
 * Leo with short dark hair, Maya with long hair down her back.
 */
function buildCharacterFigure(T, char) {
  if (!T) return dummyObj();
  const g = new T.Group();
  const skin = char.sex === 'female' ? 0xf2c89b : 0xe8b98a;
  const pants = 0x1f2937;
  const hairColor = char.sex === 'female' ? 0x3b1f1a : 0x1f2937;

  function limb(w, h, d, color, px, py, pz, ox, oy, oz) {
    const pivot = new T.Group();
    pivot.position.set(px, py, pz);
    const mesh = box3(T, w, h, d, color, ox, oy, oz);
    pivot.add(mesh);
    g.add(pivot);
    return pivot;
  }

  const legL = limb(7, 10, 6, pants, 0, 10, -4, 0, -5, 0);
  const legR = limb(7, 10, 6, pants, 0, 10, 4, 0, -5, 0);
  const armL = limb(5, 12, 5, char.outfitColor || char.color, 0, 23, -10.5, 0, -6, 0);
  const armR = limb(5, 12, 5, char.outfitColor || char.color, 0, 23, 10.5, 0, -6, 0);
  const body = box3(T, 10, 14, 16, char.outfitColor || char.color, 0, 17, 0);
  const head = box3(T, 9, 9, 9, skin, 0, 28.5, 0);
  const hair = box3(T, 10, 3, 10, hairColor, 0, 33.5, 0);
  g.add(body);
  g.add(head);
  g.add(hair);
  if (char.sex === 'female') {
    // Long hair down the back (-X side, behind the face).
    g.add(box3(T, 3, 12, 10, hairColor, -5.5, 27, 0));
  }
  g.userData = {
    legL, legR, armL, armR, body,
    armLMesh: armL.children[0], armRMesh: armR.children[0],
  };
  return g;
}

/** Draw one character as a 3D low-poly figure (v2), or 2D while on the v1 renderer. */
export function drawCharacter(pool, char, isActive, time) {
  if (!isPool(pool)) {
    drawCharacter2D(pool, char, isActive, time);
    return;
  }
  const T = three();
  const mesh = pool.get(`char-${char.id}`, () => buildCharacterFigure(T, char));
  const lift = char.jump > 0 ? 14 : 0;
  mesh.position.set(char.x, (char.swimming ? -4 : 0) + lift, char.y);
  mesh.rotation.y = -char.angle;
  mesh.visible = true;
  const body = mesh.userData && mesh.userData.body;
  if (body && body.material && body.material.color) {
    try {
      body.material.color.set(char.outfitColor || char.color);
      for (const key of ['armLMesh', 'armRMesh']) {
        const arm = mesh.userData[key];
        if (arm && arm.material && arm.material.color) arm.material.color.set(char.outfitColor || char.color);
      }
    } catch {
      // Invalid colour string: keep the built colour.
    }
  }
  // Walk swing: legs and arms rotate about their pivots (local Z = lateral).
  const swing = char.moving ? Math.sin(time * 10) * 0.55 : 0;
  const ud = mesh.userData || {};
  if (ud.legL) ud.legL.rotation.z = swing;
  if (ud.legR) ud.legR.rotation.z = -swing;
  if (ud.armL) ud.armL.rotation.z = -swing * 0.8;
  if (ud.armR) ud.armR.rotation.z = swing * 0.8;
  if (isActive) {
    const ring = pool.get('char-ring', () => {
      if (!T) return dummyObj();
      const m = new T.Mesh(
        new T.RingGeometry(18, 22, 24),
        new T.MeshLambertMaterial({ color: 0xfde68a, side: T.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    ring.position.set(char.x, 1.5, char.y);
    ring.visible = true;
  }
}

/** Draw one top-down character: shadow, outfit body, head, facing tick, name tag. */
function drawCharacter2D(ctx, char, isActive, time) {
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
