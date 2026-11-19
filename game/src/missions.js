// Neon Bay — the mission engine: 60 main missions with a story arc, plus a
// pool of 100 repeatable side quests. Every mission is one objective:
// reach a place, talk, drive, chase, eliminate, deliver, race, collect or survive.
import { DISTRICT_UNLOCK_MISSION, MISSIONS_PER_DISTRICT, SIDE_QUEST_POOL } from './config.js';
import { STORY_MISSIONS, generateSideQuest } from './data.js';
import { activeCharacter, addMoney, addWanted, saveGame, showMessage } from './state.js';
import { commitCrime } from './police.js';
import { randomHeading, randomPointInDisc } from './random.js';

// Seeded helpers take an rng object; gameplay spawns use Math.random.
const MATH_RNG = { next: () => Math.random() };

export function buildSidePool(state, rng) {
  state.missions.sidePool = [];
  for (let i = 0; i < SIDE_QUEST_POOL; i += 1) {
    state.missions.sidePool.push(generateSideQuest(rng, i + 1));
  }
}

function spawnEnemies(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const p = randomPointInDisc(MATH_RNG, x, y, 80);
    state.npcs.push({
      kind: 'enemy',
      name: 'Vulture',
      x: p.x,
      y: p.y,
      angle: randomHeading(MATH_RNG), speed: 110, money: 30, color: '#7f1d1d',
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
  state.objective = `Mission ${data.id}: ${data.title} — ${data.brief}`;
  showMessage(state, `Mission ${data.id}: ${data.title}`);
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
  state.objective = `Side job: ${quest.title} — ${quest.brief}`;
  showMessage(state, `Side job: ${quest.title}`);
  return true;
}

function completeObjective(state, active) {
  const reward = active.reward;
  addMoney(state, reward, `${active.isMain ? 'Mission' : 'Side job'} complete: ${active.title}`);
  if (active.isMain) {
    state.missions.completedMain.push(active.id);
    state.missions.mainIndex = active.id;
    state.stats.missionsDone += 1;
    if (active.id === DISTRICT_UNLOCK_MISSION[1]) {
      state.unlocked[1] = true;
      showMessage(state, 'Sunset Beach is open! Drive east past the gate.', 5);
    }
    if (active.id === DISTRICT_UNLOCK_MISSION[2]) {
      state.unlocked[2] = true;
      showMessage(state, 'Cinder Peaks is open! Head north past the gate.', 5);
    }
    if (active.id === 60) showMessage(state, 'You did it — Neon Bay is yours. The story is complete!', 6);
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
    ? (STORY_MISSIONS[active.id] ? `Mission ${STORY_MISSIONS[active.id].id}: ${STORY_MISSIONS[active.id].title}` : 'Story complete — free roam Neon Bay!')
    : 'Pick a new side job from the map (yellow ! markers).';
  saveGame(state);
}

function checkReach(state, active, tx, ty) {
  const hero = activeCharacter(state);
  const px = state.playerVehicle ? state.playerVehicle.x : hero.x;
  const py = state.playerVehicle ? state.playerVehicle.y : hero.y;
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
        showMessage(state, `${active.title}: out of time. Try again!`);
        state.missions[key] = null;
        state.objective = 'Find the next job — talk to Rico or check the map.';
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
        showMessage(state, 'Picked up the passenger — now take them to the Neon Diner.');
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
    if (Math.hypot(p.x - hero.x, p.y - hero.y) < 36) {
      p.taken = true;
      if (p.kind === 'package') {
        for (const key of ['active', 'activeSide']) {
          const a = state.missions[key];
          if (a && a.type === 'collect') a.collected += 1;
        }
        showMessage(state, 'Package collected.');
      } else if (p.kind === 'cash') {
        addMoney(state, p.amount || 25, 'Found cash');
      }
    }
  }
  state.pickups = state.pickups.filter((p) => !p.taken);
}

export function nextMainMission(state) {
  return STORY_MISSIONS[state.missions.mainIndex] || null;
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
