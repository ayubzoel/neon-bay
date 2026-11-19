// Neon Bay — on-foot movement: walking, running, swimming and jumping.
// Collision slides along walls. v3: Leo Vance is the only playable
// character — there is no companion following him any more.
import { PLAYER_RUN_SPEED, PLAYER_SWIM_SPEED, PLAYER_WALK_SPEED, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { activeCharacter } from './state.js';
import { isWater } from './world.js';
import { hairMat, pantsMat, shoeMat, skinMat, stdMat } from './textures.js';

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

/** Move the hero (Leo). */
export function updatePlayer(state, world, dt, input) {
  const hero = activeCharacter(state);
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

// --- v3 3D drawing -------------------------------------------------------
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

function box3(T, w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function jacketMaterial(T, color) {
  return stdMat(`jacket-${color}`, () => new T.MeshStandardMaterial({
    color, roughness: 0.85, metalness: 0,
  }));
}

/**
 * Leo Vance, ~34 tall, facing +X, in realistic human proportions: shoes,
 * legs on hip pivots, jacketed torso with a shirt front, arms on shoulder
 * pivots with hands, a head with hair, eyes and a nose. Legs and arms swing
 * while he walks; the outfit colour follows the wardrobe.
 */
function buildCharacterFigure(T, char) {
  if (!T) return dummyObj();
  const g = new T.Group();
  const skin = skinMat();
  const hair = hairMat();
  const pants = pantsMat();
  const shoes = shoeMat();
  const jacket = jacketMaterial(T, char.outfitColor || char.color);
  const shirt = stdMat('shirt-light', () => new T.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9, metalness: 0 }));
  const dark = stdMat('eye-dark', () => new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0 }));

  function limb(w, h, d, material, px, py, pz, ox, oy, oz) {
    const pivot = new T.Group();
    pivot.position.set(px, py, pz);
    pivot.add(box3(T, w, h, d, material, ox, oy, oz));
    g.add(pivot);
    return pivot;
  }

  // Legs: hip pivots at y=13, shoes at the feet.
  const legL = limb(5.5, 10, 5.5, pants, 0, 13, -3.2, 0, -5, 0);
  const legR = limb(5.5, 10, 5.5, pants, 0, 13, 3.2, 0, -5, 0);
  legL.add(box3(T, 6, 3, 9, shoes, 1.5, -11.5, 0));
  legR.add(box3(T, 6, 3, 9, shoes, 1.5, -11.5, 0));
  // Arms: shoulder pivots at y=24, hands at the ends.
  const armL = limb(4.5, 10, 4.5, jacket, 0, 24, -9.8, 0, -5, 0);
  const armR = limb(4.5, 10, 4.5, jacket, 0, 24, 9.8, 0, -5, 0);
  armL.add(box3(T, 4, 3.5, 4, skin, 0, -11.5, 0));
  armR.add(box3(T, 4, 3.5, 4, skin, 0, -11.5, 0));
  // Torso: jacket, shirt front on the +X face, collar.
  const body = box3(T, 9, 12, 15, jacket, 0, 19, 0);
  const shirtFront = box3(T, 1, 9, 9, shirt, 4.6, 19, 0);
  const collar = box3(T, 3, 2, 12, jacket, 0, 25.5, 0);
  // Head: skin, short dark hair on top and at the back, eyes and nose.
  const head = box3(T, 8, 8, 8, skin, 0, 29, 0);
  const hairTop = box3(T, 8.6, 2.4, 8.6, hair, -0.3, 33.6, 0);
  const hairBack = box3(T, 2.6, 5, 8.6, hair, -4.4, 30.5, 0);
  const eyeL = box3(T, 0.8, 1.4, 1.4, dark, 4.1, 30, -2);
  const eyeR = box3(T, 0.8, 1.4, 1.4, dark, 4.1, 30, 2);
  const nose = box3(T, 1, 1.6, 1.2, skin, 4.3, 28.4, 0);
  g.add(body);
  g.add(shirtFront);
  g.add(collar);
  g.add(head);
  g.add(hairTop);
  g.add(hairBack);
  g.add(eyeL);
  g.add(eyeR);
  g.add(nose);
  g.userData = {
    legL, legR, armL, armR, body,
    armLMesh: armL.children[0], armRMesh: armR.children[0],
  };
  return g;
}

/** Draw Leo as a 3D figure (v3), or 2D while on the v1 renderer. */
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
  // Outfit changes (wardrobe / neon paint) swap the jacket material on
  // the torso and arms to the cached material for the new colour.
  const ud = mesh.userData || {};
  const jacket = jacketMaterial(T, char.outfitColor || char.color);
  if (ud.body) ud.body.material = jacket;
  if (ud.armLMesh) ud.armLMesh.material = jacket;
  if (ud.armRMesh) ud.armRMesh.material = jacket;
  // Walk swing: legs and arms rotate about their pivots (local Z = lateral),
  // arms counter-swinging against the legs, plus a small step bob.
  const swing = char.moving ? Math.sin(time * 10) * 0.55 : 0;
  if (ud.legL) ud.legL.rotation.z = swing;
  if (ud.legR) ud.legR.rotation.z = -swing;
  if (ud.armL) ud.armL.rotation.z = -swing * 0.8;
  if (ud.armR) ud.armR.rotation.z = swing * 0.8;
  if (char.moving) mesh.position.y += Math.abs(Math.sin(time * 10)) * 1.2;
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
  ctx.fillStyle = '#e8b98a';
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
