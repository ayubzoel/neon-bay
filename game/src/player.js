// Neon Bay — on-foot movement: walking, running, swimming and jumping.
// Collision slides along walls. v3: Leo Vance is the only playable
// character — there is no companion following him any more.
//
// v4 METER SCALE (Builder C): 1 world unit = 1 meter, Leo Vance is 1.8 m
// tall on a 9600 x 5400 m map. The figure is built DIRECTLY in meters
// from config.js CHARACTER_HEIGHT (1.8) — proportions are fractions of
// that height, so the mesh is exactly 1.8 units tall with no scale hack.
// NPCs (npc.js) are 1.8 m and cars (vehicles.js) 4.5 m long, so Leo now
// stands eye-to-eye with pedestrians and shoulder-high to a car roof,
// as a 1.8 m human should. Camera distances (render.js/config.js,
// 14/6/32 m) are tuned for this height. Speeds are meters per second:
// walk 1.5, run 4.2, swim 1.0. On foot, crossing downtown takes minutes
// — cars are the way to travel (their speeds live in vehicles.js).
import { CHARACTER_HEIGHT, WEAPONS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { activeCharacter } from './state.js';
import { isWater } from './world.js';
import { hairMat, pantsMat, shoeMat, skinMat, stdMat } from './textures.js';
import { playSfx } from './audio.js';
import { addStrings, t } from './i18n.js';

// v4 i18n: the "E — ..." prompt labels. Shop / spot / NPC names are
// proper nouns from data.js and stay as they are.
addStrings('en', {
  'player.enterShop': 'Enter {name}',
  'player.enterSafehouse': 'Enter Safe House',
  'player.playActivity': 'Play {name}',
  'player.talkTo': 'Talk to {name}',
});
addStrings('id', {
  'player.enterShop': 'Masuk {name}',
  'player.enterSafehouse': 'Masuk Safe House',
  'player.playActivity': 'Main {name}',
  'player.talkTo': 'Bicara dengan {name}',
});

/** One footstep every ~0.75 m walked — the stride of a 1.8 m human. */
const STEP_DISTANCE_M = 0.75;

/** Leo Vance is 1.8 m tall — straight from config.js, the single source of truth for character height. */
export const LEO_HEIGHT_UNITS = CHARACTER_HEIGHT;
/** Walk / run / swim speeds in meters per second for a 1.8 m human. */
const WALK_SPEED_MPS = 1.5;
const RUN_SPEED_MPS = 4.2;
const SWIM_SPEED_MPS = 1.0;

const RADIUS = 0.4;

// --- v5 spawn safety (Builder A): a spawn point must be validated open
// ground, never inside a building. The v4 default (700, 1750) sits
// INSIDE a building solid (world.collides true at r=0.4) — Leo spawned
// stuck in a wall. findOpenGround() returns the nearest point that is
// neither inside a solid nor in water, so New Game / Continue / respawn
// all land on walkable ground.

/** True when (x, y) is walkable: not inside a solid, not in water. */
export function isOpenGround(world, x, y, unlocked, radius = RADIUS) {
  if (!world || typeof world.collides !== 'function') return true;
  if (world.collides(x, y, radius, unlocked)) return false;
  return !isWater(x, y);
}

/**
 * Nearest open ground to (x, y). Tries, in order: the point itself, the
 * nearest road-lane point (roads are open by construction), then a spiral
 * search out to `maxDist` m. Deterministic — no rng, so the same spawn
 * always lands on the same spot. Returns { x, y, moved, dist } where
 * `moved` is how far the point had to shift (0 = already open).
 */
export function findOpenGround(world, x, y, unlocked, radius = RADIUS, maxDist = 400) {
  if (isOpenGround(world, x, y, unlocked, radius)) return { x, y, moved: 0, dist: 0 };
  // The road network is the fastest escape: the nearest lane point is
  // open ground unless a locked gate sits on it (collides() checks the
  // gates when `unlocked` is passed, so validate the candidate too).
  if (world && typeof world.nearestRoadPoint === 'function') {
    try {
      const road = world.nearestRoadPoint(x, y);
      const rp = road && (road.point || road);
      if (rp && Number.isFinite(rp.x) && Number.isFinite(rp.y)) {
        const d = Math.hypot(rp.x - x, rp.y - y);
        if (d <= Math.max(150, maxDist) && isOpenGround(world, rp.x, rp.y, unlocked, radius)) {
          return { x: rp.x, y: rp.y, moved: d, dist: d };
        }
      }
    } catch { /* fall through to the spiral search */ }
  }
  // Spiral search: expanding rings, 16 samples per ring, ~2 m steps —
  // a building is at most a few dozen metres across, so the first open
  // ring is normally the sidewalk or yard right outside it.
  const step = 2;
  for (let r = step; r <= maxDist; r += step) {
    const n = 16;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const cx = x + Math.cos(a) * r;
      const cy = y + Math.sin(a) * r;
      if (isOpenGround(world, cx, cy, unlocked, radius)) {
        return { x: cx, y: cy, moved: r, dist: r };
      }
    }
  }
  // Nothing open within maxDist (should not happen on this map): return
  // the input unchanged and let the caller see moved = -1.
  return { x, y, moved: -1, dist: -1 };
}

/**
 * Move the hero (and the camera anchor) onto validated open ground.
 * Call after New Game, Continue / slot load, and respawn. Returns the
 * findOpenGround() result so main.js can expose it for tests.
 */
export function validateHeroSpawn(state, world) {
  const hero = activeCharacter(state);
  const res = findOpenGround(world, hero.x, hero.y, state.unlocked);
  hero.x = res.x;
  hero.y = res.y;
  if (state.camera) {
    state.camera.x = res.x;
    state.camera.y = res.y;
  }
  return res;
}

function moveWithCollision(state, world, char, dx, dy) {
  const r = RADIUS;
  // Axis-separated slide: try X first against the (possibly updated)
  // position, then Y, so the hero slides along walls instead of sticking.
  const tryX = char.x + dx;
  if (!world.collides(tryX, char.y, r, state.unlocked)) char.x = tryX;
  const tryY = char.y + dy;
  if (!world.collides(char.x, tryY, r, state.unlocked)) char.y = tryY;
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
  // v4 meter scale: a 1.8 m human walks ~1.5 m/s and runs ~4.2 m/s — the
  // v3 config speeds (150/235 u/s) would be 540/846 km/h in meters.
  // Gameplay consequence: crossing downtown on foot now takes minutes,
  // not seconds — cars are the way to travel (their speeds live in
  // vehicles.js/config.js, outside this build).
  const speed = inWater ? SWIM_SPEED_MPS : input.run ? RUN_SPEED_MPS : WALK_SPEED_MPS;
  hero.moving = len > 0.15;
  if (hero.moving) hero.angle = Math.atan2(my, mx);
  if (input.pressedAction('jump') && !inWater) hero.jump = 0.28;
  if (hero.jump > 0) hero.jump -= dt;

  // v4 audio: footsteps while walking/running on land — one soft tap per
  // stride, so the pace is audible without a per-frame sound call.
  if (hero.moving && !inWater) {
    hero.stepAcc = (hero.stepAcc || 0) + speed * dt;
    if (hero.stepAcc >= STEP_DISTANCE_M) {
      hero.stepAcc = 0;
      playSfx('step');
    }
  } else {
    hero.stepAcc = 0;
  }

  if (inWater) {
    hero.stamina = Math.max(0, hero.stamina - dt * 5);
    if (hero.stamina <= 0) hero.hp = Math.max(1, hero.hp - dt * 2);
  } else {
    hero.stamina = Math.min(100, hero.stamina + dt * 12);
  }

  moveWithCollision(state, world, hero, mx * speed * dt, my * speed * dt);

  // v5b terrain-following: the hero's feet follow the relief. The ground
  // height comes from world.groundHeightAt (the same mound ellipsoids
  // world.js draws); roads, sidewalks and plazas are flat by
  // construction, so this is exactly 0 on every road. Stored on the
  // hero so drawCharacter (which has no world) can lift the mesh, and
  // so the camera and tests can read it. Swimming ignores it — water
  // sits at y=0 and mounds are placed clear of water anyway.
  hero.groundY = hero.swimming ? 0
    : (world && typeof world.groundHeightAt === 'function'
      ? world.groundHeightAt(hero.x, hero.y) : 0);

  state.camera.x = hero.x;
  state.camera.y = hero.y;
}

/** What the player can interact with right here, nearest first. */
export function nearestInteractable(state, world) {
  const hero = activeCharacter(state);
  const out = [];
  for (const shop of world.shops) {
    const d = Math.hypot(shop.x + 45 - hero.x, shop.y + 35 - hero.y);
    if (d < 110) out.push({ kind: 'shop', shop, dist: d, label: t('player.enterShop', { name: shop.name }) });
  }
  const doorD = Math.hypot(495 - hero.x, 1610 - hero.y);
  if (doorD < 70) out.push({ kind: 'safehouse', dist: doorD, label: t('player.enterSafehouse') });
  for (const spot of world.activitySpots) {
    const d = Math.hypot(spot.x - hero.x, spot.y - hero.y);
    if (d < spot.r + 30) out.push({ kind: 'activity', spot, dist: d, label: t('player.playActivity', { name: spot.name }) });
  }
  for (const npc of state.npcs) {
    if (npc.kind === 'giver' || npc.kind === 'shopkeeper') continue;
    const d = Math.hypot(npc.x - hero.x, npc.y - hero.y);
    if (d < 60) out.push({ kind: 'npc', npc, dist: d, label: t('player.talkTo', { name: npc.name }) });
  }
  for (const npc of state.npcs) {
    if (npc.kind !== 'giver') continue;
    const d = Math.hypot(npc.x - hero.x, npc.y - hero.y);
    if (d < 70) out.push({ kind: 'giver', npc, dist: d, label: t('player.talkTo', { name: npc.name }) });
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
 * v4.1: the active weapon, worn on Leo's back — built in METERS, like
 * the figure. Long guns (rifle, shotgun, bazooka) and the bat are slung
 * diagonally across the back; the pistol sits holstered at the hip; a
 * grenade clips to the belt. Real sizes: a rifle ~0.95 m, a bazooka
 * ~1.15 m, a bat ~0.85 m, a pistol ~0.20 m. Built once per weapon
 * switch and cached by drawCharacter in userData.
 */
function buildBackWeapon(T, key) {
  if (!T) return null;
  const def = WEAPONS[key] || WEAPONS.pistol;
  const mat = stdMat(`backweapon-${key}`, () => new T.MeshStandardMaterial({
    color: def.color, roughness: 0.6, metalness: 0.4,
  }));
  let mesh;
  if (key === 'pistol') {
    mesh = new T.Mesh(new T.BoxGeometry(0.07, 0.2, 0.1), mat);
    mesh.position.set(-0.09, 0.62, 0.24);
    mesh.rotation.z = 0.3;
  } else if (key === 'grenade') {
    mesh = new T.Mesh(new T.SphereGeometry(0.055, 10, 8), mat);
    mesh.position.set(-0.1, 0.72, 0.24);
  } else {
    const long = key === 'bazooka' ? 1.15 : key === 'melee' ? 0.85 : 0.95;
    const thick = key === 'bazooka' ? 0.1 : 0.06;
    mesh = new T.Mesh(new T.BoxGeometry(thick, long, thick), mat);
    mesh.position.set(-0.16, 1.08, 0);
    mesh.rotation.x = 0.55;
  }
  return mesh;
}

/**
 * Leo Vance, exactly CHARACTER_HEIGHT (1.8 m) tall, facing +X, in
 * realistic human proportions: shoes, legs on hip pivots, jacketed
 * torso with a shirt front, arms on shoulder pivots with hands, a head
 * with hair, eyes and a nose. Legs and arms swing while he walks; the
 * outfit colour follows the wardrobe.
 *
 * Built DIRECTLY in meters (v4.1): every dimension is either a fraction
 * of H = CHARACTER_HEIGHT or an absolute meter size for a 1.8 m human —
 * no v3-unit construction, no group scale. Hip at 0.47H, shoulders at
 * 0.76H, head top at H. Axes: +X is where Leo faces, +Y is up, +Z is
 * lateral (shoulder width).
 */
function buildCharacterFigure(T, char) {
  if (!T) return dummyObj();
  const H = CHARACTER_HEIGHT;
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

  // Legs: hip pivots at 0.47H, shoes at the feet (sole at y=0).
  const hipY = 0.47 * H;
  const legLen = 0.44 * H;
  const legL = limb(0.15, legLen, 0.15, pants, 0, hipY, -0.095, 0, -legLen / 2, 0);
  const legR = limb(0.15, legLen, 0.15, pants, 0, hipY, 0.095, 0, -legLen / 2, 0);
  legL.add(box3(T, 0.28, 0.09, 0.12, shoes, 0.06, -legLen - 0.01, 0));
  legR.add(box3(T, 0.28, 0.09, 0.12, shoes, 0.06, -legLen - 0.01, 0));
  // Arms: shoulder pivots at 0.76H, hands at the ends.
  const shoulderY = 0.76 * H;
  const armLen = 0.34 * H;
  const armL = limb(0.11, armLen, 0.11, jacket, 0, shoulderY, -0.275, 0, -armLen / 2, 0);
  const armR = limb(0.11, armLen, 0.11, jacket, 0, shoulderY, 0.275, 0, -armLen / 2, 0);
  armL.add(box3(T, 0.1, 0.09, 0.1, skin, 0, -armLen - 0.02, 0));
  armR.add(box3(T, 0.1, 0.09, 0.1, skin, 0, -armLen - 0.02, 0));
  // Torso: jacket, shirt front on the +X face, collar.
  const torsoH = 0.32 * H;
  const torsoY = 0.63 * H;
  const body = box3(T, 0.24, torsoH, 0.44, jacket, 0, torsoY, 0);
  const shirtFront = box3(T, 0.02, 0.42, 0.3, shirt, 0.13, torsoY, 0);
  const collar = box3(T, 0.08, 0.05, 0.34, jacket, 0, 0.80 * H, 0);
  // Head: skin, short dark hair on top and at the back, eyes and nose.
  // Head top reaches exactly H (hair cap closes the last centimetres).
  const headH = 0.15 * H;
  const headY = 0.885 * H;
  const head = box3(T, 0.21, headH, 0.21, skin, 0, headY, 0);
  const hairTop = box3(T, 0.23, 0.05, 0.23, hair, -0.01, 0.975 * H, 0);
  const hairBack = box3(T, 0.06, 0.16, 0.23, hair, -0.11, 0.92 * H, 0);
  const eyeL = box3(T, 0.02, 0.03, 0.03, dark, 0.11, 0.89 * H, -0.05);
  const eyeR = box3(T, 0.02, 0.03, 0.03, dark, 0.11, 0.89 * H, 0.05);
  const nose = box3(T, 0.03, 0.04, 0.03, skin, 0.12, 0.865 * H, 0);
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
  // v4.1 meter scale: a jump lifts Leo ~0.25 m; swimming sinks him just
  // below the waterline (the v3 -1.0 was v3 units, i.e. ~0.05 m).
  // v5b: the mesh also stands on the terrain — groundY is the mound
  // height under the hero's feet (0 on roads), sampled in updatePlayer.
  const lift = char.jump > 0 ? 0.25 : 0;
  const groundY = char.swimming ? 0 : (char.groundY || 0);
  mesh.position.set(char.x, (char.swimming ? -0.05 : groundY) + lift, char.y);
  mesh.rotation.y = -char.angle;
  mesh.visible = true;
  // v4: the active weapon rides on Leo's back (main.js keeps
  // char.weaponKey in step with state.weapon), so what the backpack holds
  // is visible in the world — long guns slung diagonally, the bat upright,
  // the pistol holstered at the hip, a grenade clipped to the belt.
  const ud0 = mesh.userData || {};
  const weaponKey = char.weaponKey || 'pistol';
  if (ud0.backWeaponKey !== weaponKey) {
    if (ud0.backWeapon && typeof mesh.remove === 'function') mesh.remove(ud0.backWeapon);
    ud0.backWeaponKey = weaponKey;
    ud0.backWeapon = buildBackWeapon(T, weaponKey);
    if (ud0.backWeapon && typeof mesh.add === 'function') mesh.add(ud0.backWeapon);
  }
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
  if (char.moving) mesh.position.y += Math.abs(Math.sin(time * 10)) * 0.03;
  if (isActive) {
    const ring = pool.get('char-ring', () => {
      if (!T) return dummyObj();
      const m = new T.Mesh(
        new T.RingGeometry(0.55, 0.7, 24),
        new T.MeshLambertMaterial({ color: 0xfde68a, side: T.DoubleSide }),
      );
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    ring.position.set(char.x, 0.05 + (char.swimming ? 0 : (char.groundY || 0)), char.y);
    ring.visible = true;
  }
}

/** Draw one top-down character: shadow, outfit body, head, facing tick, name tag. */
function drawCharacter2D(ctx, char, isActive, time) {
  const bob = char.moving ? Math.sin(time * 10) * 0.08 : 0;
  const lift = char.jump > 0 ? 0.3 : 0;
  ctx.save();
  ctx.translate(char.x, char.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 0.4, 0.5, 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, -lift);
  // Body in the outfit colour, head in skin tone, a facing tick for the aim.
  // v4 meter scale: a 1.8 m figure is ~0.9 wide on this top-down view.
  ctx.fillStyle = char.outfitColor || char.color;
  ctx.beginPath();
  ctx.arc(0, 0, 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath();
  ctx.arc(Math.cos(char.angle) * 0.12, Math.sin(char.angle) * 0.12 + bob * 0.3, 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 0.12;
  ctx.beginPath();
  ctx.moveTo(Math.cos(char.angle) * 0.4, Math.sin(char.angle) * 0.4);
  ctx.lineTo(Math.cos(char.angle) * 0.7, Math.sin(char.angle) * 0.7);
  ctx.stroke();
  if (isActive) {
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.arc(0, 0, 0.65, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (isActive) {
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(char.name, char.x, char.y - 2.6);
  }
}
