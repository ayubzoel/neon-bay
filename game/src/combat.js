// Neon Bay — combat: six weapons, bullets, melee swings, grenades and the
// bazooka. Shooting in public is a crime; the police notice.
//
// v4 (Builder C): the weapons live in Leo's backpack. state.weapons is the
// backpack's contents — every owned weapon stays stored there with its own
// magazine and reserve ammo, and the active weapon is just the one Leo is
// holding right now. Buying a gun stores it in the backpack (shops.js);
// switching (digits, backpack panel, mouse wheel) only changes which stored
// weapon is in hand, never drops one.
//
// v4 METER SCALE: 1 world unit = 1 meter, Leo 1.8 m. Bullet speeds in
// config.js were already metres-per-second-like (pistol 620, rifle 900),
// so they stand. What was tuned to the v3 34-unit Leo is scaled here by
// V3_TO_M (1.8/34): muzzle offset, melee reach, blast radii,
// tracer/particle sizes. v4.1: NPCs (npc.js) are 1.8 m and cars
// (vehicles.js) 4.5 m long now, so the hit radii are meters too —
// 0.6 m vs a person, per-kind vs vehicles — and bullet hits use a SWEPT
// test (segment from the previous step to the new one), because a rifle
// bullet flies ~15 m per 1/60 s step and a point test at 0.6 m would
// tunnel straight through its target. The hit radius vs Leo himself is
// 0.6 m.
import { WEAPONS, WEAPON_ORDER } from './config.js';
import { activeCharacter, damagePlayer, showMessage } from './state.js';
import { commitCrime } from './police.js';
import { playSfx, playSfx3D } from './audio.js';
import { addStrings, t } from './i18n.js';

/** v3 config numbers were tuned to a 34-unit figure; this is the ratio
 * that turns them into meters (1.8 m Leo / 34 v3 units). It is a fixed
 * historical ratio — NOT derived from config CHARACTER_HEIGHT, which is
 * 1.8 now and would make the ratio 1 (a 90 m grenade blast). */
const V3_TO_M = 1.8 / 34;

// v4 i18n: messages this module shows, in English + Bahasa Indonesia.
// (Weapon model names come from config.js and stay as proper nouns.)
addStrings('en', {
  'combat.backpackFull': 'Backpack is full — six weapons is all it holds.',
  'combat.noAmmo': 'No {name} ammo — buy more at Ironworks Arms.',
  'combat.reloaded': '{name} reloaded.',
  'combat.notOwned': '{name} not owned — visit a gun shop.',
});
addStrings('id', {
  'combat.backpackFull': 'Tas penuh — enam senjata adalah batasnya.',
  'combat.noAmmo': 'Tidak ada amunisi {name} — beli lagi di Ironworks Arms.',
  'combat.reloaded': '{name} sudah diisi ulang.',
  'combat.notOwned': '{name} belum dimiliki — kunjungi toko senjata.',
});

/** Muzzle sits ~1 m in front of a 1.8 m Leo. */
const MUZZLE_OFFSET_M = 1.0;
/** A bat swing connects within ~2.2 m of Leo's centre (arm + bat + body). */
const MELEE_REACH_M = 2.2;
/** Enemy bullets hurt Leo within 0.6 m of his centre. */
const PLAYER_HIT_RADIUS_M = 0.6;
/** v4.1 meter hit radii: a person is ~0.6 m wide; vehicles are hit by
 * half-length plus a small margin (car 4.5 m, bike ~2 m, boat ~8 m). */
const NPC_HIT_RADIUS_M = 0.6;
const POLICE_HIT_RADIUS_M = 0.6;
function vehicleHitRadiusM(v) {
  if (v.kind === 'bike') return 1.4;
  if (v.kind === 'boat') return 4.5;
  if (v.kind === 'plane') return 6;
  return 2.6; // car (4.5 m long) and anything unknown
}

/**
 * Distance from a point to a segment — the swept hit test. A bullet moves
 * up to ~15 m in one 1/60 s step, so testing only its end point would let
 * it tunnel through a 0.6 m target; the segment from the previous step
 * to the new one catches everything it passed through.
 */
function segPointDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let tt = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  tt = Math.max(0, Math.min(1, tt));
  return Math.hypot(px - (x1 + tt * dx), py - (y1 + tt * dy));
}

/** Backpack capacity: six slots — exactly the six weapon kinds in v3/v4. */
export const BACKPACK_CAPACITY = WEAPON_ORDER.length;

/** How many weapon kinds the backpack currently holds. */
export function backpackOwnedCount(state) {
  return WEAPON_ORDER.filter((key) => state.weapons[key] && state.weapons[key].owned).length;
}

/**
 * Store a weapon kind in the backpack. A kind already stored is a no-op
 * success; a new kind is refused once all six slots are full.
 */
export function storeInBackpack(state, key) {
  const owned = state.weapons[key];
  if (!owned) return { ok: false, reason: 'unknown' };
  if (owned.owned) return { ok: true, reason: 'already' };
  if (backpackOwnedCount(state) >= BACKPACK_CAPACITY) {
    showMessage(state, t('combat.backpackFull'));
    return { ok: false, reason: 'full' };
  }
  owned.owned = true;
  return { ok: true, reason: 'stored' };
}

/**
 * Everything the backpack panel needs, in weapon order: owned weapons
 * first (with their own mag + reserve ammo), then the unowned kinds the
 * player can still buy at a gun shop.
 */
export function backpackItems(state) {
  const items = [];
  for (const key of WEAPON_ORDER) {
    const def = WEAPONS[key];
    const owned = state.weapons[key] || { owned: false, ammo: 0, mag: 0 };
    items.push({
      key,
      name: t(`weapon.${key}`),
      owned: !!owned.owned,
      active: state.weapon === key,
      mag: owned.mag,
      ammo: owned.ammo,
      magSize: def.magSize,
      auto: def.auto,
      damage: def.damage,
      range: def.range,
      color: def.color,
      price: def.price,
    });
  }
  return items;
}

/** Total reserve ammo across every owned ranged weapon in the backpack. */
export function backpackAmmoTotal(state) {
  return WEAPON_ORDER.reduce((total, key) => {
    const owned = state.weapons[key];
    const ranged = owned && owned.owned && WEAPONS[key].magSize !== Infinity;
    return ranged ? total + owned.ammo + owned.mag : total;
  }, 0);
}

/** If the active weapon is somehow not owned, fall back to the first owned one. */
export function ensureActiveWeapon(state) {
  const owned = state.weapons[state.weapon];
  if (owned && owned.owned) return state.weapon;
  for (const key of WEAPON_ORDER) {
    if (state.weapons[key] && state.weapons[key].owned) {
      state.weapon = key;
      return key;
    }
  }
  return state.weapon;
}

function playerAim(state, mouseWorld) {
  const hero = activeCharacter(state);
  return Math.atan2(mouseWorld.y - hero.y, mouseWorld.x - hero.x);
}

function fireWeapon(state, mouseWorld) {
  const hero = activeCharacter(state);
  const key = state.weapon;
  const def = WEAPONS[key];
  const owned = state.weapons[key];
  if (!owned || !owned.owned) return;
  if (state.fireCd > 0) return;
  if (owned.mag <= 0) {
    reloadWeapon(state);
    return;
  }
  state.fireCd = def.fireRate;
  hero.angle = playerAim(state, mouseWorld);
  if (key === 'melee') {
    swingMelee(state, hero);
    return;
  }
  const pellets = def.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const spread = (Math.random() - 0.5) * (key === 'shotgun' ? 0.3 : 0.07);
    const a = hero.angle + spread;
    state.bullets.push({
      x: hero.x + Math.cos(a) * MUZZLE_OFFSET_M, y: hero.y + Math.sin(a) * MUZZLE_OFFSET_M,
      vx: Math.cos(a) * def.bulletSpeed, vy: Math.sin(a) * def.bulletSpeed,
      damage: def.damage, from: 'player', life: def.range / def.bulletSpeed,
      // v4 meter scale: config blast radii were tuned to the v3 34-unit
      // Leo (grenade 90, bazooka 130) — in meters that is ~4.8 m / ~6.9 m
      // (V3_TO_M above; do NOT derive this from CHARACTER_HEIGHT).
      blast: (def.blast || 0) * V3_TO_M, kind: key === 'grenade' ? 'grenade' : key === 'bazooka' ? 'rocket' : 'bullet',
    });
  }
  owned.mag -= 1;
  // v4 audio: every weapon sounds different (audio.js recipes) — the
  // pistol cracks, the rifle barks, the shotgun booms, the bazooka
  // whooshes, a thrown grenade whistles. Explosions sound at the blast.
  if (key === 'grenade') playSfx('throw');
  else if (key === 'bazooka') playSfx('bazooka');
  else if (key === 'shotgun') playSfx('shotgun');
  else if (key === 'rifle') playSfx('rifle');
  else playSfx('pistol');
  state.particles.push({ x: hero.x + Math.cos(hero.angle) * (MUZZLE_OFFSET_M + 0.2), y: hero.y + Math.sin(hero.angle) * (MUZZLE_OFFSET_M + 0.2), kind: 'muzzle', life: 0.08, max: 0.08 });
}

function swingMelee(state, hero) {
  // A visible swing arc so the bat feels like it connects.
  playSfx('swing');
  state.particles.push({
    x: hero.x + Math.cos(hero.angle) * (MELEE_REACH_M * 0.55), y: hero.y + Math.sin(hero.angle) * (MELEE_REACH_M * 0.55),
    kind: 'swing', angle: hero.angle, life: 0.18, max: 0.18,
  });
  for (const npc of state.npcs) {
    if (npc.kind === 'police') continue;
    const d = Math.hypot(npc.x - hero.x, npc.y - hero.y);
    if (d > MELEE_REACH_M) continue;
    const a = Math.atan2(npc.y - hero.y, npc.x - hero.x);
    let diff = a - hero.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) damageNpc(state, npc, WEAPONS.melee.damage, true);
  }
  for (const p of state.police) {
    if (Math.hypot(p.x - hero.x, p.y - hero.y) < MELEE_REACH_M) {
      p.hp -= WEAPONS.melee.damage;
      if (p.hp <= 0) state.stats.kills += 1;
    }
  }
}

export function reloadWeapon(state) {
  const owned = state.weapons[state.weapon];
  const def = WEAPONS[state.weapon];
  if (!owned || !owned.owned || def.magSize === Infinity) return;
  const need = def.magSize - owned.mag;
  const take = Math.min(need, owned.ammo);
  if (take <= 0) {
    playSfx('denied');
    showMessage(state, t('combat.noAmmo', { name: t(`weapon.${state.weapon}`) }));
    return;
  }
  owned.ammo -= take;
  owned.mag += take;
  playSfx('reload');
  showMessage(state, t('combat.reloaded', { name: t(`weapon.${state.weapon}`) }));
}

export function switchWeapon(state, key) {
  const owned = state.weapons[key];
  if (!owned || !owned.owned) {
    showMessage(state, t('combat.notOwned', { name: t(`weapon.${key}`) }));
    return false;
  }
  if (state.weapon === key) return true;
  state.weapon = key;
  playSfx('swap');
  showMessage(state, t(`weapon.${key}`));
  return true;
}

/**
 * Cycle to the next (dir +1) or previous (dir -1) owned weapon in the
 * backpack — the mouse wheel and the backpack panel's arrows use this.
 * Skips unowned kinds and wraps around; a lone weapon stays put.
 */
export function cycleWeapon(state, dir) {
  const ownedKeys = WEAPON_ORDER.filter((key) => state.weapons[key] && state.weapons[key].owned);
  if (ownedKeys.length <= 1) return state.weapon;
  const idx = ownedKeys.indexOf(state.weapon);
  const next = ownedKeys[(idx + dir + ownedKeys.length) % ownedKeys.length];
  switchWeapon(state, next);
  return state.weapon;
}

export function damageNpc(state, npc, damage, byPlayer) {
  npc.hp -= damage;
  state.particles.push({ x: npc.x, y: npc.y - 1, kind: 'text', text: `-${damage}`, life: 0.7, max: 0.7 });
  if (npc.hp > 0) return false;
  if (npc.kind === 'ped') {
    state.pickups.push({ kind: 'cash', x: npc.x, y: npc.y, amount: npc.money, taken: false });
    if (byPlayer) {
      state.stats.kills += 1;
      commitCrime(state, 1, 'Someone saw that');
    }
  }
  if (npc.kind === 'enemy') {
    state.stats.kills += 1;
    state.pickups.push({ kind: 'cash', x: npc.x, y: npc.y, amount: 30 + Math.floor(Math.random() * 40), taken: false });
    for (const key of ['active', 'activeSide']) {
      const a = state.missions[key];
      if (a && (a.type === 'eliminate' || a.type === 'fight')) a.kills += 1;
    }
  }
  state.npcs = state.npcs.filter((n) => n !== npc);
  return true;
}

function blastDamage(state, x, y, radius, damage, from) {
  const hero = activeCharacter(state);
  const hurt = (tx, ty) => Math.hypot(tx - x, ty - y) < radius;
  if (from === 'player' || from === 'police') {
    if (hurt(hero.x, hero.y) && from !== 'player') damagePlayer(state, damage * 0.6);
    if (hurt(hero.x, hero.y) && from === 'player') damagePlayer(state, damage * 0.25);
  }
  for (const npc of [...state.npcs]) {
    if (hurt(npc.x, npc.y)) damageNpc(state, npc, damage, from === 'player');
  }
  for (const p of state.police) {
    if (hurt(p.x, p.y)) {
      p.hp -= damage;
      if (p.hp <= 0 && from === 'player') state.stats.kills += 1;
    }
  }
  for (const v of state.vehicles) {
    if (hurt(v.x, v.y)) v.hp -= damage;
  }
  // v4 audio: the blast is positional — loud up close, faint far away.
  playSfx3D('explosion', x, y);
  state.particles.push({ x, y, kind: 'explosion', life: 0.6, max: 0.6 });
}

export function updateBullets(state, world, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    // Swept test: remember where the step started, so a 900 m/s bullet
    // cannot tunnel through a 0.6 m target between steps.
    const px = b.x;
    const py = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && b.kind !== 'ram' && world.collides(b.x, b.y, 0.1, state.unlocked)) {
      dead = true;
      if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
      else state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.2, max: 0.2 });
    }
    if (!dead && b.kind !== 'ram') {
      const hero = activeCharacter(state);
      // v4.1: bullets vs people/vehicles use meter radii (0.6 m vs a
      // person, per-kind vs vehicles) with the swept segment test.
      if (b.from !== 'player' && segPointDist(hero.x, hero.y, px, py, b.x, b.y) < PLAYER_HIT_RADIUS_M) {
        dead = true;
        damagePlayer(state, b.damage);
        if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
      }
      if (!dead) {
        for (const npc of [...state.npcs]) {
          if (segPointDist(npc.x, npc.y, px, py, b.x, b.y) < NPC_HIT_RADIUS_M) {
            dead = true;
            if (b.from === 'player') damageNpc(state, npc, b.damage, true);
            else damageNpc(state, npc, b.damage, false);
            if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
            break;
          }
        }
      }
      if (!dead) {
        for (const p of state.police) {
          if (segPointDist(p.x, p.y, px, py, b.x, b.y) < POLICE_HIT_RADIUS_M) {
            dead = true;
            if (b.from === 'player') {
              p.hp -= b.damage;
              if (p.hp <= 0) state.stats.kills += 1;
            }
            if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
            break;
          }
        }
      }
      if (!dead) {
        for (const v of state.vehicles) {
          if (v === state.playerVehicle) continue;
          if (segPointDist(v.x, v.y, px, py, b.x, b.y) < vehicleHitRadiusM(v)) {
            dead = true;
            v.hp -= b.damage;
            if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
            break;
          }
        }
      }
    }
    if (b.kind === 'ram') dead = true;
    if (dead) state.bullets.splice(i, 1);
  }
  if (state.crimeCooldown > 0) state.crimeCooldown -= dt;
}

export function updateCombat(state, dt, input, mouseWorld) {
  if (state.fireCd > 0) state.fireCd -= dt;
  const def = WEAPONS[state.weapon];
  const wantFire = def.auto ? input.mouse.down : input.mouse.clicked;
  if (wantFire && state.screen === 'play') fireWeapon(state, mouseWorld);
  if (input.pressedAction('reload')) reloadWeapon(state);
  for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
    if (input.pressed(`Digit${i + 1}`)) switchWeapon(state, WEAPON_ORDER[i]);
  }
  if (input.pressed('KeyQ')) {
    // Handled by main loop via nearest NPC; kept here as a no-op guard.
  }
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

function sphere3(T, r, color, opts = {}) {
  const m = new T.Mesh(
    new T.SphereGeometry(r, 10, 8),
    new T.MeshLambertMaterial({ color, ...opts }),
  );
  return m;
}

// v4 meter scale: tracer/particle sizes were tuned to the v3 34-unit Leo
// (tracer 14 long, explosion up to 58 wide) — scaled by V3_TO_M
// so a muzzle flash is centimetres and an explosion a few meters wide.
const TRACER_LEN_M = 14 * V3_TO_M;
const TRACER_W_M = 2.5 * V3_TO_M;
const ROCKET_R_M = 6 * V3_TO_M;
const GRENADE_R_M = 5 * V3_TO_M;
const MUZZLE_R_M = 5 * V3_TO_M;
const SPARK_R_M = 3 * V3_TO_M;
const EXPLOSION_R_M = 12 * V3_TO_M;
const EXPLOSION_GROW_M = 46 * V3_TO_M;
const SWING_R_M = 40 * V3_TO_M;

export function drawBullets(pool, state) {
  if (!isPool(pool)) {
    drawBullets2D(pool, state);
    return;
  }
  const T = three();
  state.bullets.forEach((b, i) => {
    if (b.kind === 'ram') return;
    const mesh = pool.get(`bullet-${i}-${b.kind}`, () => {
      if (!T) return dummyObj();
      if (b.kind === 'rocket' || b.kind === 'shell') return sphere3(T, ROCKET_R_M, 0xf97316);
      if (b.kind === 'grenade') return sphere3(T, GRENADE_R_M, 0x22c55e);
      const m = new T.Mesh(
        new T.BoxGeometry(TRACER_LEN_M, TRACER_W_M, TRACER_W_M),
        new T.MeshLambertMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.6 }),
      );
      return m;
    });
    mesh.position.set(b.x, b.kind === 'grenade' ? 1.0 : 1.4, b.y);
    mesh.rotation.y = -Math.atan2(b.vy, b.vx);
    mesh.visible = true;
  });
  // Particles: explosions grow and fade, sparks/muzzle flashes are small
  // bright spheres, a melee swing is a flat fading disc. 'text' particles
  // have no 3D equivalent and are skipped.
  state.particles.forEach((p, i) => {
    if (p.kind === 'text') return;
    const mesh = pool.get(`particle-${i}-${p.kind}`, () => {
      if (!T) return dummyObj();
      if (p.kind === 'explosion') {
        return sphere3(T, 1, 0xf97316, { transparent: true, emissive: 0xf97316, emissiveIntensity: 0.8 });
      }
      if (p.kind === 'swing') {
        const m = new T.Mesh(
          new T.CylinderGeometry(SWING_R_M, SWING_R_M, 0.1, 20, 1, false, 0, Math.PI * 0.9),
          new T.MeshBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.7, side: T.DoubleSide, depthWrite: false }),
        );
        return m;
      }
      return sphere3(T, p.kind === 'muzzle' ? MUZZLE_R_M : SPARK_R_M, 0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.8 });
    });
    if (p.kind === 'explosion') {
      const t = 1 - p.life / p.max;
      mesh.scale.set(EXPLOSION_R_M + t * EXPLOSION_GROW_M, EXPLOSION_R_M + t * EXPLOSION_GROW_M, EXPLOSION_R_M + t * EXPLOSION_GROW_M);
      if (mesh.material) mesh.material.opacity = Math.max(0, 1 - t);
      mesh.position.set(p.x, 1, p.y);
    } else if (p.kind === 'swing') {
      const t = 1 - p.life / p.max;
      if (mesh.material) mesh.material.opacity = Math.max(0, 0.7 * (1 - t));
      mesh.rotation.y = -(p.angle || 0) + t * 0.9;
      mesh.position.set(p.x, 1.2, p.y);
    } else {
      mesh.scale.set(1, 1, 1);
      mesh.position.set(p.x, 1.4, p.y);
    }
    mesh.visible = true;
  });
}

function drawBullets2D(ctx, state) {
  // v4 meter scale: all radii were v3 units (a 6-unit rocket dot is 6 m
  // wide next to a 1.8 m Leo) — scaled by V3_TO_M here.
  const S = V3_TO_M;
  for (const b of state.bullets) {
    if (b.kind === 'ram') continue;
    ctx.save();
    if (b.kind === 'rocket' || b.kind === 'shell') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6 * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3 * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'grenade') {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5 * S, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3 * S;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const p of state.particles) {
    if (p.kind === 'explosion') {
      const t = 1 - p.life / p.max;
      ctx.fillStyle = `rgba(249, 115, 22, ${1 - t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (12 + t * 46) * S, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(253, 230, 138, ${1 - t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (6 + t * 22) * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'swing') {
      const t = 1 - p.life / p.max;
      ctx.strokeStyle = `rgba(254, 240, 138, ${1 - t})`;
      ctx.lineWidth = 5 * S;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 34 * S, (p.angle || 0) - 0.8, (p.angle || 0) + 0.8);
      ctx.stroke();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'muzzle') {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * S, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'text') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y - (1 - p.life / p.max) * 18 * S);
    }
  }
}
