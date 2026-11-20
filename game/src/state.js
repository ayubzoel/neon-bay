// Neon Bay — the one game state object, plus clock, money, damage, wanted
// and save/load. Every system reads and writes this object; nothing else
// holds game progress, so saving is one JSON dump of the fields below.
//
// v3: one protagonist only — Leo Vance. Maya Reyes is no longer a playable
// character (and there is no character switch): she stands by the Neon
// Diner as Leo's friend and contact. state.hero is the single hero object;
// activeCharacter(state) is kept as the accessor every module already uses.
import {
  CAMERA_DIST_DEFAULT,
  CAMERA_PITCH_DEFAULT,
  DAY_LENGTH_SECONDS,
  MINUTES_PER_DAY,
  PLAYER_MAX_HP,
  PLAYER_START_MONEY,
  SAVE_KEY,
  SEASON_DAYS,
  WANTED_DECAY_SECONDS,
  WEAPONS,
} from './config.js';
import { districtAt } from './world.js';
import { addStrings, getLang, t } from './i18n.js';

// v4 i18n (Builder C): every user-facing word this module shows goes
// through t() — English here, Bahasa Indonesia below.
addStrings('en', {
  'msg.season.rainy': 'Rainy season has arrived.',
  'msg.season.summer': 'Summer is back in Neon Bay.',
  'msg.wanted': 'Wanted level {stars}★ — {reason}',
  'msg.lostCops': 'You lost the cops.',
  'msg.saved': 'Game saved.',
  'msg.saveFailed': 'Could not save (storage unavailable).',
  'msg.money': '{sign}${amount} — {reason}',
  'msg.objectiveStart': 'Talk to Rico at the Neon Diner to start your story.',
  'msg.loot.cash': 'Mission loot',
  'msg.loot.ammo': 'Loot: +{amount} {weapon} ammo in your backpack.',
  'msg.loot.cashOnly': 'Mission loot',
  'msg.foundCash': 'Found cash',
  'msg.mission.complete': '{kind} complete: {title}',
  'msg.mission.bought': 'Bought {item}',
  'save.slot.empty': 'Empty slot',
  'save.slot.meta': 'Mission {missions} · ${money} · {district}',
});
addStrings('id', {
  'msg.season.rainy': 'Musim hujan telah tiba.',
  'msg.season.summer': 'Musim panas kembali ke Neon Bay.',
  'msg.wanted': 'Level buronan {stars}★ — {reason}',
  'msg.lostCops': 'Kamu berhasil lolos dari polisi.',
  'msg.saved': 'Game tersimpan.',
  'msg.saveFailed': 'Tidak bisa menyimpan (penyimpanan tidak tersedia).',
  'msg.money': '{sign}${amount} — {reason}',
  'msg.objectiveStart': 'Bicara dengan Rico di Neon Diner untuk memulai ceritamu.',
  'msg.loot.cash': 'Jarahan misi',
  'msg.loot.ammo': 'Jarahan: +{amount} amunisi {weapon} di tasku.',
  'msg.loot.cashOnly': 'Jarahan misi',
  'msg.foundCash': 'Menemukan uang',
  'msg.mission.complete': '{kind} selesai: {title}',
  'msg.mission.bought': 'Membeli {item}',
  'save.slot.empty': 'Slot kosong',
  'save.slot.meta': 'Misi {missions} · ${money} · {district}',
});

/** District name for a world position, in the active language.
 * Short form (config.js 'district.*.short') — toasts and slot meta read
 * better with 'Downtown' than the full 'Downtown Neon Bay'; the full
 * names (config.js 'district.*') are for map labels and sentences. */
export function districtNameFor(x, y) {
  const d = districtAt(x, y);
  if (d === 1) return t('district.beach.short');
  if (d === 2) return t('district.peaks.short');
  return t('district.downtown.short');
}

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_INTERIOR = 'interior';
export const SCREEN_SHOP = 'shop';
export const SCREEN_ACTIVITY = 'activity';
export const SCREEN_DIALOG = 'dialog';

/** The one hero: Leo Vance, alone on the streets of Neon Bay. */
function makeHero(x, y) {
  return {
    id: 'leo', name: 'Leo Vance', sex: 'male', x, y, angle: -Math.PI / 2,
    color: '#3b82f6', outfitColor: '#3b82f6',
    hp: PLAYER_MAX_HP, armor: 0, outfit: 'street',
    speed: 0, moving: false, swimming: false, stamina: 100,
  };
}

export function createGameState(seed) {
  const weapons = {};
  for (const [key, def] of Object.entries(WEAPONS)) {
    weapons[key] = { owned: key === 'pistol' || key === 'melee', ammo: key === 'pistol' ? 48 : 0, mag: def.magSize };
  }
  return {
    seed,
    screen: SCREEN_TITLE,
    prevScreen: SCREEN_PLAY,
    time: { minutes: 8 * 60, day: 1 },
    season: 'summer',
    rain: 0,
    money: PLAYER_START_MONEY,
    // v5 spawn: Leo starts ON street 1700 (x 495, the road by the safe
    // house) — the v4 default (700, 1750) was inside a building solid.
    // validateHeroSpawn() (player.js) still re-checks this at New Game /
    // Continue / respawn, so a future map change can never strand him.
    hero: makeHero(495, 1700),
    weapons,
    weapon: 'pistol',
    // v4 backpack: six slots (one per weapon kind), all of v3's weapons fit.
    // state.weapons IS the backpack's contents; this records its capacity
    // and whether the panel is open, so saves stay explicit about it.
    backpack: { capacity: 6 },
    backpackOpen: false,
    wanted: 0,
    wantedTimer: 0,
    missions: { mainIndex: 0, completedMain: [], active: null, activeSide: null, sidePool: [], sideDone: 0 },
    unlocked: [true, false, false],
    npcs: [],
    police: [],
    traffic: [],
    bullets: [],
    particles: [],
    pickups: [],
    vehicles: [],
    playerVehicle: null,
    ownedCars: [],
    garage: [],
    mods: { engine: 0, armor: 0, paint: false },
    inventory: { food: 0 },
    stats: { kills: 0, stolen: 0, earned: 0, missionsDone: 0, sideDone: 0, deaths: 0, racesWon: 0 },
    activity: null,
    shop: null,
    nav: null,
    navRepath: 0,
    dialog: null,
    interior: null,
    message: '',
    messageTimer: 0,
    objective: t('msg.objectiveStart'),
    camera: { x: 495, y: 1700, yaw: 0, pitch: CAMERA_PITCH_DEFAULT, dist: CAMERA_DIST_DEFAULT },
    muted: false,
    elapsed: 0,
  };
}

/** The hero. Kept as a function so every module reads it the same way. */
export function activeCharacter(state) {
  return state.hero;
}

export function showMessage(state, text, seconds = 3) {
  state.message = text;
  state.messageTimer = seconds;
}

/** Advance the clock: 8 real minutes make one game day; seasons flip every 3 days. */
export function advanceClock(state, dt) {
  const minutesPerSecond = MINUTES_PER_DAY / DAY_LENGTH_SECONDS;
  state.time.minutes += dt * minutesPerSecond;
  if (state.time.minutes >= MINUTES_PER_DAY) {
    state.time.minutes -= MINUTES_PER_DAY;
    state.time.day += 1;
    if (state.time.day % SEASON_DAYS === 0) {
      state.season = state.season === 'summer' ? 'rainy' : 'summer';
      showMessage(state, state.season === 'rainy' ? t('msg.season.rainy') : t('msg.season.summer'));
    }
  }
  const targetRain = state.season === 'rainy' ? 0.7 : 0;
  state.rain += (targetRain - state.rain) * Math.min(1, dt * 0.2);
}

export function currentHour(state) {
  return Math.floor(state.time.minutes / 60);
}

export function isNight(state) {
  const hour = currentHour(state);
  return hour < 6 || hour >= 19;
}

export function clockText(state) {
  const hour = currentHour(state);
  const minute = Math.floor(state.time.minutes % 60);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function addMoney(state, amount, reason) {
  state.money = Math.max(0, state.money + amount);
  if (amount > 0) state.stats.earned += amount;
  if (reason) showMessage(state, t('msg.money', { sign: amount > 0 ? '+' : '', amount, reason }));
  return state.money;
}

export function damagePlayer(state, amount) {
  const hero = activeCharacter(state);
  let left = amount;
  if (hero.armor > 0) {
    const absorbed = Math.min(hero.armor, left);
    hero.armor -= absorbed;
    left -= absorbed;
  }
  hero.hp = Math.max(0, hero.hp - left);
  return hero.hp;
}

export function healPlayer(state, amount) {
  const hero = activeCharacter(state);
  hero.hp = Math.min(PLAYER_MAX_HP, hero.hp + amount);
  return hero.hp;
}

export function addWanted(state, stars, reason) {
  if (stars <= 0) return state.wanted;
  state.wanted = Math.min(5, state.wanted + stars);
  state.wantedTimer = WANTED_DECAY_SECONDS;
  if (reason) showMessage(state, t('msg.wanted', { stars: state.wanted, reason }));
  return state.wanted;
}

/** Heat fades while no police officer can see the player. */
export function decayWanted(state, dt, policeCanSee) {
  if (state.wanted === 0) return;
  if (policeCanSee) {
    state.wantedTimer = WANTED_DECAY_SECONDS;
    return;
  }
  state.wantedTimer -= dt;
  if (state.wantedTimer <= 0) {
    state.wanted -= 1;
    state.wantedTimer = WANTED_DECAY_SECONDS;
    if (state.wanted === 0) showMessage(state, t('msg.lostCops'));
  }
}

function serializable(state) {
  return {
    money: state.money,
    time: state.time,
    season: state.season,
    hero: { x: state.hero.x, y: state.hero.y, hp: state.hero.hp, armor: state.hero.armor, outfit: state.hero.outfit },
    weapons: state.weapons,
    weapon: state.weapon,
    backpack: state.backpack || { capacity: 6 },
    missions: { mainIndex: state.missions.mainIndex, completedMain: state.missions.completedMain, sideDone: state.missions.sideDone },
    unlocked: state.unlocked,
    ownedCars: state.ownedCars,
    garage: state.garage,
    mods: state.mods,
    stats: state.stats,
  };
}

export function saveGame(state, slot = 1) {
  try {
    window.localStorage.setItem(slotKey(slot), JSON.stringify({ ...serializable(state), savedAt: Date.now() }));
    showMessage(state, t('msg.saved'));
    return true;
  } catch {
    showMessage(state, t('msg.saveFailed'));
    return false;
  }
}

export function loadSaveData(slot = 1) {
  try {
    const raw = window.localStorage.getItem(slotKey(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// --- Save slots (v4 Settings) --------------------------------------------
// Slot 1 is the v3 key ('neon-bay-save-v1') so old saves keep working;
// slots 2–3 are new keys. One slot = one JSON dump + a savedAt stamp.
export const SAVE_SLOTS = [1, 2, 3];

export function slotKey(slot) {
  const n = Number(slot) === 2 ? 2 : Number(slot) === 3 ? 3 : 1;
  return n === 1 ? SAVE_KEY : `${SAVE_KEY}-slot-${n}`;
}

/** Summary of one slot for the Settings panel (date, money, progress, place). */
export function saveSlotMeta(slot) {
  const data = loadSaveData(slot);
  if (!data) return { slot, has: false };
  const hero = data.hero || null;
  return {
    slot,
    has: true,
    date: data.savedAt ? new Date(data.savedAt) : null,
    money: data.money ?? 0,
    missions: (data.missions?.completedMain?.length ?? 0) + (data.missions?.sideDone ?? 0),
    district: hero ? districtNameFor(hero.x, hero.y) : '',
  };
}

export function listSaveSlots() {
  return SAVE_SLOTS.map((slot) => saveSlotMeta(slot));
}

export function deleteSave(slot) {
  try {
    window.localStorage.removeItem(slotKey(slot));
    return true;
  } catch {
    return false;
  }
}

export function deleteAllSaves() {
  let ok = true;
  for (const slot of SAVE_SLOTS) ok = deleteSave(slot) && ok;
  return ok;
}

/** { filename, json } for the Settings export button, or null when empty. */
export function exportSaveJson(slot) {
  const data = loadSaveData(slot);
  if (!data) return null;
  return { filename: `neon-bay-save-slot-${slot}.json`, json: JSON.stringify(data, null, 2) };
}

/** Validate + store an imported save JSON into a slot. Returns true on success. */
export function importSaveJson(slot, text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || typeof data.money !== 'number' || !data.hero) return false;
    window.localStorage.setItem(slotKey(slot), JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// --- Settings (v4) --------------------------------------------------------
// One JSON object in localStorage, applied live — no restart needed.
// Language is the exception: the single source of truth is the i18n key
// (neon-bay-lang-v1); settings.language only mirrors it.
export const SETTINGS_KEY = 'neon-bay-settings-v1';

export const DEFAULT_SETTINGS = {
  audio: { master: 0.8, music: 0.6, sfx: 0.9, ambience: 0.5, vehicle: 0.7, muted: false, mutedCategories: {} },
  controls: { sensitivity: 1, invertY: false, touchSize: 'normal', vibration: true },
  graphics: { quality: 'medium', showHud: true, showMinimap: true },
  language: 'en',
  time: { dayNight: 'auto', weather: 'auto' },
  save: { autosave: true, autosaveMinutes: 5 },
};

function clamp01(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}

/** Deep-merge stored settings onto the defaults, discarding bad values. */
export function validateSettings(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!raw || typeof raw !== 'object') return out;
  const a = raw.audio || {};
  out.audio.master = clamp01(a.master, out.audio.master);
  out.audio.music = clamp01(a.music, out.audio.music);
  out.audio.sfx = clamp01(a.sfx, out.audio.sfx);
  out.audio.ambience = clamp01(a.ambience, out.audio.ambience);
  out.audio.vehicle = clamp01(a.vehicle, out.audio.vehicle);
  out.audio.muted = !!a.muted;
  if (a.mutedCategories && typeof a.mutedCategories === 'object') {
    for (const cat of ['music', 'sfx', 'ambience', 'vehicle']) {
      if (a.mutedCategories[cat] !== undefined) out.audio.mutedCategories[cat] = !!a.mutedCategories[cat];
    }
  }
  const c = raw.controls || {};
  const sens = Number(c.sensitivity);
  out.controls.sensitivity = Number.isFinite(sens) ? Math.max(0.3, Math.min(2.5, sens)) : 1;
  out.controls.invertY = !!c.invertY;
  out.controls.touchSize = ['small', 'normal', 'large'].includes(c.touchSize) ? c.touchSize : 'normal';
  out.controls.vibration = c.vibration !== false;
  const g = raw.graphics || {};
  out.graphics.quality = ['low', 'medium', 'high'].includes(g.quality) ? g.quality : 'medium';
  out.graphics.showHud = g.showHud !== false;
  out.graphics.showMinimap = g.showMinimap !== false;
  const tm = raw.time || {};
  out.time.dayNight = ['auto', 'day', 'night'].includes(tm.dayNight) ? tm.dayNight : 'auto';
  out.time.weather = ['auto', 'clear', 'rain'].includes(tm.weather) ? tm.weather : 'auto';
  const sv = raw.save || {};
  out.save.autosave = sv.autosave !== false;
  const mins = Number(sv.autosaveMinutes);
  out.save.autosaveMinutes = Number.isFinite(mins) ? Math.max(1, Math.min(30, Math.floor(mins))) : 5;
  // Bindings live in input.js (DEFAULT_BINDINGS); they are stored under
  // controls.bindings and merged by loadBindings() — see input.js.
  if (c.bindings && typeof c.bindings === 'object') out.controls.bindings = c.bindings;
  // Language always follows the i18n key, never a stale stored copy.
  out.language = getLang();
  return out;
}

export function loadSettings() {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return validateSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return validateSettings(null);
  }
}

export function saveSettings(settings) {
  try {
    const copy = JSON.parse(JSON.stringify(settings || {}));
    copy.language = getLang();
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(copy));
    return true;
  } catch {
    return false;
  }
}

export function resetSettings() {
  const fresh = validateSettings(null);
  saveSettings(fresh);
  return fresh;
}

export function applySaveData(state, data) {
  if (!data) return false;
  state.money = data.money ?? state.money;
  state.time = data.time ?? state.time;
  state.season = data.season ?? state.season;
  // v3 saves store `hero`; v2 saves stored `characters[0]` (Leo) — both load.
  const savedHero = data.hero || (Array.isArray(data.characters) ? data.characters[0] : null);
  if (savedHero) Object.assign(state.hero, savedHero);
  // v4: validate the backpack on load — a hand-edited or older save must
  // never leave Leo holding a weapon he does not own, or negative ammo.
  // Unknown kinds are dropped, missing kinds are rebuilt unowned, and the
  // active weapon falls back to the first owned kind.
  if (data.weapons) {
    const clean = {};
    for (const [key, def] of Object.entries(WEAPONS)) {
      const saved = data.weapons[key];
      clean[key] = {
        owned: !!(saved && saved.owned),
        ammo: Math.max(0, Math.floor((saved && saved.ammo) || 0)),
        mag: def.magSize === Infinity ? def.magSize : Math.max(0, Math.min(def.magSize, Math.floor((saved && saved.mag) ?? def.magSize))),
      };
    }
    // The pistol and the bat are starter gear: a save that owns neither is
    // corrupt, so restore both rather than leaving Leo unarmed.
    if (!clean.pistol.owned && !clean.melee.owned) {
      clean.pistol = { owned: true, ammo: 48, mag: WEAPONS.pistol.magSize };
      clean.melee = { owned: true, ammo: 0, mag: Infinity };
    }
    state.weapons = clean;
  }
  if (data.weapon) state.weapon = data.weapon;
  if (data.backpack && Number.isFinite(data.backpack.capacity)) {
    state.backpack = { capacity: Math.max(1, Math.min(6, Math.floor(data.backpack.capacity))) };
  }
  if (!state.weapons[state.weapon] || !state.weapons[state.weapon].owned) {
    for (const key of Object.keys(WEAPONS)) {
      if (state.weapons[key].owned) {
        state.weapon = key;
        break;
      }
    }
  }
  if (data.missions) {
    state.missions.mainIndex = data.missions.mainIndex ?? 0;
    state.missions.completedMain = data.missions.completedMain ?? [];
    state.missions.sideDone = data.missions.sideDone ?? 0;
  }
  if (data.unlocked) state.unlocked = data.unlocked;
  if (data.ownedCars) state.ownedCars = data.ownedCars;
  if (data.garage) state.garage = data.garage;
  if (data.mods) state.mods = data.mods;
  if (data.stats) state.stats = data.stats;
  return true;
}
