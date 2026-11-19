// Neon Bay — combat: six weapons, bullets, melee swings, grenades and the
// bazooka. Shooting in public is a crime; the police notice.
import { WEAPONS, WEAPON_ORDER } from './config.js';
import { activeCharacter, damagePlayer, showMessage } from './state.js';
import { commitCrime } from './police.js';

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
      x: hero.x + Math.cos(a) * 20, y: hero.y + Math.sin(a) * 20,
      vx: Math.cos(a) * def.bulletSpeed, vy: Math.sin(a) * def.bulletSpeed,
      damage: def.damage, from: 'player', life: def.range / def.bulletSpeed,
      blast: def.blast || 0, kind: key === 'grenade' ? 'grenade' : key === 'bazooka' ? 'rocket' : 'bullet',
    });
  }
  owned.mag -= 1;
  state.particles.push({ x: hero.x + Math.cos(hero.angle) * 24, y: hero.y + Math.sin(hero.angle) * 24, kind: 'muzzle', life: 0.08, max: 0.08 });
}

function swingMelee(state, hero) {
  for (const npc of state.npcs) {
    if (npc.kind === 'police') continue;
    const d = Math.hypot(npc.x - hero.x, npc.y - hero.y);
    if (d > 60) continue;
    const a = Math.atan2(npc.y - hero.y, npc.x - hero.x);
    let diff = a - hero.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < 1.1) damageNpc(state, npc, WEAPONS.melee.damage, true);
  }
  for (const p of state.police) {
    if (Math.hypot(p.x - hero.x, p.y - hero.y) < 60) {
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
    showMessage(state, `No ${def.name} ammo — buy more at Ironworks Arms.`);
    return;
  }
  owned.ammo -= take;
  owned.mag += take;
  showMessage(state, `${def.name} reloaded.`);
}

export function switchWeapon(state, key) {
  const owned = state.weapons[key];
  if (!owned || !owned.owned) {
    showMessage(state, `${WEAPONS[key].name} not owned — visit a gun shop.`);
    return;
  }
  state.weapon = key;
  showMessage(state, WEAPONS[key].name);
}

export function damageNpc(state, npc, damage, byPlayer) {
  npc.hp -= damage;
  state.particles.push({ x: npc.x, y: npc.y - 18, kind: 'text', text: `-${damage}`, life: 0.7, max: 0.7 });
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
  state.particles.push({ x, y, kind: 'explosion', life: 0.6, max: 0.6 });
}

export function updateBullets(state, world, dt) {
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    let dead = b.life <= 0;
    if (!dead && b.kind !== 'ram' && world.collides(b.x, b.y, 2, state.unlocked)) {
      dead = true;
      if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
      else state.particles.push({ x: b.x, y: b.y, kind: 'spark', life: 0.2, max: 0.2 });
    }
    if (!dead && b.kind !== 'ram') {
      const hero = activeCharacter(state);
      if (b.from !== 'player' && Math.hypot(b.x - hero.x, b.y - hero.y) < 13) {
        dead = true;
        damagePlayer(state, b.damage);
        if (b.blast) blastDamage(state, b.x, b.y, b.blast, b.damage, b.from);
      }
      if (!dead) {
        for (const npc of [...state.npcs]) {
          if (Math.hypot(b.x - npc.x, b.y - npc.y) < 13) {
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
          if (Math.hypot(b.x - p.x, b.y - p.y) < 16) {
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
          if (Math.hypot(b.x - v.x, b.y - v.y) < 18) {
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
  if (input.pressed('KeyR')) reloadWeapon(state);
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
      if (b.kind === 'rocket' || b.kind === 'shell') return sphere3(T, 6, 0xf97316);
      if (b.kind === 'grenade') return sphere3(T, 5, 0x22c55e);
      const m = new T.Mesh(
        new T.BoxGeometry(14, 2.5, 2.5),
        new T.MeshLambertMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.6 }),
      );
      return m;
    });
    mesh.position.set(b.x, b.kind === 'grenade' ? 10 : 18, b.y);
    mesh.rotation.y = -Math.atan2(b.vy, b.vx);
    mesh.visible = true;
  });
  // Particles: explosions grow and fade, sparks/muzzle flashes are small
  // bright spheres. 'text' particles have no 3D equivalent and are skipped.
  state.particles.forEach((p, i) => {
    if (p.kind === 'text') return;
    const mesh = pool.get(`particle-${i}-${p.kind}`, () => {
      if (!T) return dummyObj();
      if (p.kind === 'explosion') {
        return sphere3(T, 1, 0xf97316, { transparent: true, emissive: 0xf97316, emissiveIntensity: 0.8 });
      }
      return sphere3(T, p.kind === 'muzzle' ? 5 : 3, 0xfde047, { emissive: 0xfde047, emissiveIntensity: 0.8 });
    });
    if (p.kind === 'explosion') {
      const t = 1 - p.life / p.max;
      mesh.scale.set(12 + t * 46, 12 + t * 46, 12 + t * 46);
      if (mesh.material) mesh.material.opacity = Math.max(0, 1 - t);
      mesh.position.set(p.x, 10, p.y);
    } else {
      mesh.scale.set(1, 1, 1);
      mesh.position.set(p.x, 18, p.y);
    }
    mesh.visible = true;
  });
}

function drawBullets2D(ctx, state) {
  for (const b of state.bullets) {
    if (b.kind === 'ram') continue;
    ctx.save();
    if (b.kind === 'rocket' || b.kind === 'shell') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (b.kind === 'grenade') {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
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
      ctx.arc(p.x, p.y, 12 + t * 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(253, 230, 138, ${1 - t})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6 + t * 22, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'muzzle') {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'text') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.text, p.x, p.y - (1 - p.life / p.max) * 18);
    }
  }
}
