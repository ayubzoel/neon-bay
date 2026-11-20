// Neon Bay — the mission engine: 60 main missions with a story arc, plus a
// pool of 100 repeatable side quests. Every mission is one objective:
// reach a place, talk, drive, chase, eliminate, deliver, race, collect or survive.
import { DISTRICT_UNLOCK_MISSION, MISSIONS_PER_DISTRICT, SIDE_QUEST_POOL, WEAPONS, WEAPON_ORDER } from './config.js';
import { STORY_MISSIONS, generateSideQuest } from './data.js';
import { activeCharacter, addMoney, addWanted, saveGame, showMessage } from './state.js';
import { commitCrime } from './police.js';
import { playSfx } from './audio.js';
import { randomHeading, randomLootDrop, randomPointInDisc } from './random.js';
import { addStrings, t } from './i18n.js';

/**
 * Title / brief of a mission in the ACTIVE language (data.js contract).
 * Main missions carry a data.js key ('mission.N') whose title/brief are
 * registered there in en+id — read them with t(). Side quests were
 * already translated at generation (generateSideQuest calls t() with the
 * template keys), so their .title/.brief ARE the translated strings and
 * are shown as-is. Callers must never display a raw .title/.brief for a
 * main mission — that is how English leaked into the Indonesian UI.
 */
export function missionTitle(m) {
  if (!m) return '';
  return m.key ? t(`${m.key}.title`) : m.title;
}
export function missionBrief(m) {
  if (!m) return '';
  return m.key ? t(`${m.key}.brief`) : m.brief;
}

/** Rebuild the HUD objective line for the active mission in the active
 * language (used after a language switch, when the stored line is stale). */
export function objectiveLineFor(state) {
  const active = state.missions.active;
  if (active) return t('mission.objective', { id: active.id, title: missionTitle(active), brief: missionBrief(active) });
  const side = state.missions.activeSide;
  if (side) return t('mission.sideObjective', { title: missionTitle(side), brief: missionBrief(side) });
  return t('mission.findNext');
}
addStrings('en', {
  'mission.word': 'Mission',
  'mission.sideWord': 'Side job',
  'mission.objective': 'Mission {id}: {title} — {brief}',
  'mission.objectiveNext': 'Mission {id}: {title}',
  'mission.sideObjective': 'Side job: {title} — {brief}',
  'mission.sideStarted': 'Side job: {title}',
  'mission.findNext': 'Find the next job — talk to Rico or check the map.',
  'mission.beachOpen': 'Sunset Beach is open! Drive east past the gate.',
  'mission.peaksOpen': 'Cinder Peaks is open! Head north past the gate.',
  'mission.storyComplete': 'You did it — Neon Bay is yours. The story is complete!',
  'mission.outOfTime': '{title}: out of time. Try again!',
  'mission.escort': 'Picked up the passenger — now take them to the Neon Diner.',
  'mission.package': 'Package collected.',
  'mission.storyDone': 'Story complete — free roam Neon Bay!',
  'mission.sideNext': 'Pick a new side job from the map (yellow ! markers).',
  'mission.lootCash': '+ ${amount} loot',
  'mission.lootAmmo': '+ {amount} {weapon} ammo',
});
addStrings('id', {
  'mission.word': 'Misi',
  'mission.sideWord': 'Pekerjaan sampingan',
  'mission.objective': 'Misi {id}: {title} — {brief}',
  'mission.objectiveNext': 'Misi {id}: {title}',
  'mission.sideObjective': 'Pekerjaan sampingan: {title} — {brief}',
  'mission.sideStarted': 'Pekerjaan sampingan: {title}',
  'mission.findNext': 'Cari pekerjaan berikutnya — bicara dengan Rico atau cek peta.',
  'mission.beachOpen': 'Sunset Beach terbuka! Berkendara ke timur melewati gerbang.',
  'mission.peaksOpen': 'Cinder Peaks terbuka! Menuju utara melewati gerbang.',
  'mission.storyComplete': 'Kamu berhasil — Neon Bay milikmu. Ceritanya selesai!',
  'mission.outOfTime': '{title}: waktu habis. Coba lagi!',
  'mission.escort': 'Penumpang sudah naik — antar mereka ke Neon Diner.',
  'mission.package': 'Paket terkumpul.',
  'mission.storyDone': 'Cerita selesai — jelajahi Neon Bay dengan bebas!',
  'mission.sideNext': 'Ambil pekerjaan sampingan baru dari peta (penanda ! kuning).',
  'mission.lootCash': '+ ${amount} jarahan',
  'mission.lootAmmo': '+ {amount} amunisi {weapon}',
});

// Seeded helpers take an rng object; gameplay spawns use Math.random.
// MATH_RNG carries the full rng interface (next/range/int) so helpers
// like randomLootDrop can use it without a seeded generator.
const MATH_RNG = {
  next: () => Math.random(),
  range: (a, b) => a + Math.random() * (b - a),
  int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
};

export function buildSidePool(state, rng) {
  state.missions.sidePool = [];
  for (let i = 0; i < SIDE_QUEST_POOL; i += 1) {
    state.missions.sidePool.push(generateSideQuest(rng, i + 1));
  }
  // Shuffle so the six jobs on the map are a fresh mix every new game,
  // while the seed still fixes which mix that is.
  if (rng && typeof rng.shuffle === 'function') rng.shuffle(state.missions.sidePool);
}

function spawnEnemies(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomPointInDisc(MATH_RNG, x, y, 80);
    state.npcs.push({
      kind: 'enemy',
      name: 'Vulture',
      x: p.x,
      y: p.y,
      // v4 meter scale: a running human hunts at ~3.2 m/s (v3: 110 u/s).
      angle: randomHeading(MATH_RNG), speed: 3.2, money: 30, color: '#7f1d1d',
      state: 'hunt', hp: 50, maxHp: 50, shootCd: 1 + Math.random(),
    });
  }
}

function spawnPickups(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomPointInDisc(MATH_RNG, x, y, 110);
    state.pickups.push({ kind: 'package', x: p.x, y: p.y, taken: false });
  }
}

function spawnChaseTarget(state, x, y) {
  const v = {
    id: 9000 + Math.floor(Math.random() * 900), kind: 'car', x, y, angle: randomHeading(MATH_RNG), speed: 0, z: 0,
    hp: 90, maxHp: 90, color: '#111827', name: 'Getaway Car', owner: 'target',
    modSpeed: 0, modArmor: 0, waypoint: null, waitTimer: 0,
  };
  state.vehicles.push(v);
  return v;
}

/** Begin main mission `index` (0-based). Returns false when there is none left. */
export function startMainMission(state, index) {
  const data = STORY_MISSIONS[index];
  if (!data) return false;
  const active = {
    ...data, isMain: true, kills: 0, killsNeeded: data.enemies || 0,
    timeLeft: data.type === 'race' ? 100 : data.type === 'survive' ? 60 : 0,
    collected: 0, collectNeeded: data.type === 'collect' ? 5 : 0,
    stage: 'go', targetVehicle: null,
  };
  if (data.enemies > 0) spawnEnemies(state, data.x, data.y, data.enemies);
  if (data.type === 'collect') spawnPickups(state, data.x, data.y, 5);
  if (data.type === 'chase') active.targetVehicle = spawnChaseTarget(state, data.x, data.y);
  state.missions.active = active;
  state.objective = t('mission.objective', { id: data.id, title: missionTitle(data), brief: missionBrief(data) });
  showMessage(state, t('mission.objectiveNext', { id: data.id, title: missionTitle(data) }));
  return true;
}

export function startSideQuest(state, quest) {
  const active = {
    ...quest, isMain: false, kills: 0, killsNeeded: quest.type === 'fight' ? 3 : 0,
    timeLeft: quest.type === 'race' ? 80 : 0,
    collected: 0, collectNeeded: quest.type === 'collect' ? 4 : 0,
    stage: 'go', targetVehicle: null,
  };
  if (quest.type === 'fight') spawnEnemies(state, quest.x, quest.y, 3);
  if (quest.type === 'collect') spawnPickups(state, quest.x, quest.y, 4);
  state.missions.activeSide = active;
  state.objective = t('mission.sideObjective', { title: quest.title, brief: quest.brief });
  showMessage(state, t('mission.sideStarted', { title: quest.title }));
  return true;
}

function completeObjective(state, active) {
  const reward = active.reward;
  addMoney(state, reward, t('msg.mission.complete', { kind: active.isMain ? t('mission.word') : t('mission.sideWord'), title: missionTitle(active) }));
  // v4: every finished job also drops loot into the backpack — ammo for a
  // weapon Leo already carries (or a cash bonus when he carries none that
  // takes ammo). The loot never replaces the mission reward, it tops it up.
  grantMissionLoot(state);
  if (active.isMain) {
    state.missions.completedMain.push(active.id);
    state.missions.mainIndex = active.id;
    state.stats.missionsDone += 1;
    if (active.id === DISTRICT_UNLOCK_MISSION[1]) {
      state.unlocked[1] = true;
      playSfx('unlock');
      showMessage(state, t('mission.beachOpen'), 5);
    }
    if (active.id === DISTRICT_UNLOCK_MISSION[2]) {
      state.unlocked[2] = true;
      playSfx('unlock');
      showMessage(state, t('mission.peaksOpen'), 5);
    }
    if (active.id === 60) showMessage(state, t('mission.storyComplete'), 6);
  } else {
    state.missions.sideDone += 1;
    state.stats.sideDone += 1;
    state.missions.sidePool = state.missions.sidePool.filter((q) => q.id !== active.id);
    state.missions.sidePool.push(generateSideQuest({ next: Math.random, range: (a, b) => a + Math.random() * (b - a), int: (a, b) => Math.floor(a + Math.random() * (b - a + 1)), pick: (l) => l[Math.floor(Math.random() * l.length)], chance: (p) => Math.random() < p }, Date.now() % 100000));
  }
  state.missions.active = active.isMain ? null : state.missions.active;
  state.missions.activeSide = active.isMain ? state.missions.activeSide : null;
  if (active.targetVehicle) {
    state.vehicles = state.vehicles.filter((v) => v !== active.targetVehicle);
  }
  state.objective = active.isMain
    ? (STORY_MISSIONS[active.id] ? t('mission.objectiveNext', { id: STORY_MISSIONS[active.id].id, title: missionTitle(STORY_MISSIONS[active.id]) }) : t('mission.storyDone'))
    : t('mission.sideNext');
  saveGame(state);
}

function checkReach(state, active, tx, ty) {
  const hero = activeCharacter(state);
  const px = state.playerVehicle ? state.playerVehicle.x : hero.x;
  const py = state.playerVehicle ? state.playerVehicle.y : hero.y;
  // v4 meter-scale note: 80 m is kept on purpose, not an oversight.
  // Mission targets sit inside city blocks, often ~40 m from the nearest
  // road (mission 1's diner target is ~42 m off street 2600), and several
  // sit inside building footprints — a realistic 5 m arrival radius
  // would make them uncompletable. Shrinking this needs mission targets
  // moved onto roads/pavements first (flagged for the coordinator).
  return Math.hypot(tx - px, ty - py) < 80;
}

/** Advance the active objectives; returns true when something completed. */
export function updateMissions(state, dt) {
  for (const key of ['active', 'activeSide']) {
    const active = state.missions[key];
    if (!active) continue;
    if (active.timeLeft > 0) {
      active.timeLeft -= dt;
      if (active.timeLeft <= 0) {
        if (active.type === 'survive') {
          completeObjective(state, active);
          return true;
        }
        showMessage(state, t('mission.outOfTime', { title: missionTitle(active) }));
        state.missions[key] = null;
        state.objective = t('mission.findNext');
        return false;
      }
    }
    if (active.type === 'eliminate' || active.type === 'fight') {
      if (active.kills >= active.killsNeeded) {
        completeObjective(state, active);
        return true;
      }
      continue;
    }
    if (active.type === 'collect') {
      if (active.collected >= active.collectNeeded) {
        completeObjective(state, active);
        return true;
      }
      continue;
    }
    if (active.type === 'chase' && active.targetVehicle) {
      const v = active.targetVehicle;
      const hero = activeCharacter(state);
      if (v.hp <= 0 || Math.hypot(v.x - hero.x, v.y - hero.y) < 70) {
        completeObjective(state, active);
        return true;
      }
      continue;
    }
    if (active.type === 'survive') continue;
    if (active.type === 'drive' && !state.playerVehicle) continue;
    if (checkReach(state, active, active.x, active.y)) {
      if (active.type === 'escort' && active.stage === 'go') {
        active.stage = 'return';
        active.x = 1740;
        active.y = 2558;
        showMessage(state, t('mission.escort'));
        continue;
      }
      completeObjective(state, active);
      return true;
    }
  }
  return false;
}

/** Enemies hunt the player and shoot. Called from the main loop. */
export function updateEnemies(state, dt) {
  const hero = activeCharacter(state);
  for (const npc of state.npcs) {
    if (npc.kind !== 'enemy') continue;
    npc.shootCd -= dt;
    const dx = hero.x - npc.x;
    const dy = hero.y - npc.y;
    const dist = Math.hypot(dx, dy) || 1;
    npc.angle = Math.atan2(dy, dx);
    if (dist > 220) {
      npc.x += (dx / dist) * npc.speed * dt;
      npc.y += (dy / dist) * npc.speed * dt;
    } else if (npc.shootCd <= 0 && dist < 420) {
      npc.shootCd = 1.1;
      const spread = (Math.random() - 0.5) * 0.2;
      const a = Math.atan2(dy, dx) + spread;
      state.bullets.push({
        x: npc.x, y: npc.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520,
        damage: 9, from: 'enemy', life: 1.4, blast: 0, kind: 'bullet',
      });
    }
  }
}

/** Pick up packages and cash lying around. */
export function updatePickups(state) {
  const hero = activeCharacter(state);
  for (const p of state.pickups) {
    if (p.taken) continue;
    // v4 meter-scale note: 36 m is kept on purpose (see checkReach) —
    // collect packages spawn anywhere in a 110 m disc around the target,
    // including inside building footprints, so a realistic 1.5 m pickup
    // radius could strand some of them behind walls.
    if (Math.hypot(p.x - hero.x, p.y - hero.y) < 36) {
      p.taken = true;
      if (p.kind === 'package') {
        for (const key of ['active', 'activeSide']) {
          const a = state.missions[key];
          if (a && a.type === 'collect') a.collected += 1;
        }
        // v4 audio: a soft pickup blip when a package lands in the bag.
        playSfx('pickup');
        showMessage(state, t('mission.package'));
      } else if (p.kind === 'cash') {
        playSfx('coin');
        addMoney(state, p.amount || 25, t('msg.foundCash'));
      }
    }
  }
  state.pickups = state.pickups.filter((p) => !p.taken);
}

export function nextMainMission(state) {
  return STORY_MISSIONS[state.missions.mainIndex] || null;
}

/**
 * v4 mission loot (random.js): ammo lands in the backpack for a random
 * owned weapon that takes ammo; cash lands straight in the wallet when
 * Leo only carries the bat (or the roll says cash). Returns a short
 * description for the toast, or '' when nothing dropped.
 */
export function grantMissionLoot(state) {
  const drop = randomLootDrop(MATH_RNG);
  if (!drop) return '';
  if (drop.kind === 'cash') {
    addMoney(state, drop.amount, t('msg.loot.cash'));
    return t('mission.lootCash', { amount: drop.amount });
  }
  const ranged = WEAPON_ORDER.filter((key) => {
    const owned = state.weapons[key];
    return owned && owned.owned && WEAPONS[key].magSize !== Infinity;
  });
  if (ranged.length === 0) {
    addMoney(state, 30, t('msg.loot.cash'));
    return t('mission.lootCash', { amount: 30 });
  }
  const key = ranged[Math.floor(Math.random() * ranged.length)];
  state.weapons[key].ammo += drop.amount;
  showMessage(state, t('msg.loot.ammo', { amount: drop.amount, weapon: t(`weapon.${key}`) }));
  return t('mission.lootAmmo', { amount: drop.amount, weapon: t(`weapon.${key}`) });
}

export function missionsRemainingInDistrict(state, district) {
  const start = district * MISSIONS_PER_DISTRICT;
  return STORY_MISSIONS.slice(start, start + MISSIONS_PER_DISTRICT).filter((m) => !state.missions.completedMain.includes(m.id)).length;
}

// --- v2 3D drawing -------------------------------------------------------
// First argument is the mesh pool; a canvas context falls back to the v1 2D
// drawing so the game stays playable until the 3D renderer lands.
// The renderer calls drawMissionMarkers(pool, state) with no time argument,
// so the bob/pulse animation reads the clock directly.
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

export function drawMissionMarkers(pool, state) {
  if (!isPool(pool)) {
    drawMissionMarkers2D(pool, state);
    return;
  }
  const T = three();
  const time = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
  const active = state.missions.active || state.missions.activeSide;
  if (active) {
    const pulse = 1 + Math.sin(time * 3.3) * 0.15;
    const disc = pool.get('marker-main', () => {
      if (!T) return dummyObj();
      return new T.Mesh(
        new T.CylinderGeometry(26, 26, 4, 24),
        new T.MeshLambertMaterial({ color: 0xfde047, transparent: true, opacity: 0.35, emissive: 0xfde047, emissiveIntensity: 0.3 }),
      );
    });
    disc.scale.set(pulse, 1, pulse);
    disc.position.set(active.x, 2, active.y);
    disc.visible = true;
    const arrow = pool.get('marker-arrow', () => {
      if (!T) return dummyObj();
      return new T.Mesh(
        new T.ConeGeometry(10, 20, 10),
        new T.MeshLambertMaterial({ color: 0xfde047, emissive: 0xfde047, emissiveIntensity: 0.5 }),
      );
    });
    arrow.position.set(active.x, 48 + Math.sin(time * 4) * 4, active.y);
    arrow.visible = true;
  }
  // Side-job markers: the next few jobs in the pool, small floating octahedra.
  state.missions.sidePool.slice(0, 6).forEach((q, i) => {
    const mark = pool.get(`marker-side-${i}`, () => {
      if (!T) return dummyObj();
      return new T.Mesh(
        new T.OctahedronGeometry(9),
        new T.MeshLambertMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.4 }),
      );
    });
    mark.position.set(q.x, 30 + Math.sin(time * 3 + i * 1.3) * 4, q.y);
    mark.rotation.y = time * 2 + i;
    mark.visible = true;
  });
}

function drawMissionMarkers2D(ctx, state) {
  const active = state.missions.active || state.missions.activeSide;
  if (active) {
    const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
    ctx.save();
    ctx.translate(active.x, active.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(10, -14);
    ctx.lineTo(-10, -14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // Side-job markers: the next few jobs in the pool.
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const q of state.missions.sidePool.slice(0, 6)) {
    ctx.fillText('?', q.x, q.y - 14);
  }
}

export { commitCrime };
