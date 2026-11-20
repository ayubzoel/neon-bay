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
    hero: makeHero(700, 1750),
    weapons,
    weapon: 'pistol',
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
    objective: 'Talk to Rico at the Neon Diner to start your story.',
    camera: { x: 700, y: 1750, yaw: 0, pitch: CAMERA_PITCH_DEFAULT, dist: CAMERA_DIST_DEFAULT },
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
      showMessage(state, state.season === 'rainy' ? 'Rainy season has arrived.' : 'Summer is back in Neon Bay.');
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
  if (reason) showMessage(state, `${amount > 0 ? '+' : ''}$${amount} — ${reason}`);
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
  if (reason) showMessage(state, `Wanted level ${state.wanted}★ — ${reason}`);
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
    if (state.wanted === 0) showMessage(state, 'You lost the cops.');
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
    missions: { mainIndex: state.missions.mainIndex, completedMain: state.missions.completedMain, sideDone: state.missions.sideDone },
    unlocked: state.unlocked,
    ownedCars: state.ownedCars,
    garage: state.garage,
    mods: state.mods,
    stats: state.stats,
  };
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(serializable(state)));
    showMessage(state, 'Game saved.');
    return true;
  } catch {
    showMessage(state, 'Could not save (storage unavailable).');
    return false;
  }
}

export function loadSaveData() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySaveData(state, data) {
  if (!data) return false;
  state.money = data.money ?? state.money;
  state.time = data.time ?? state.time;
  state.season = data.season ?? state.season;
  // v3 saves store `hero`; v2 saves stored `characters[0]` (Leo) — both load.
  const savedHero = data.hero || (Array.isArray(data.characters) ? data.characters[0] : null);
  if (savedHero) Object.assign(state.hero, savedHero);
  if (data.weapons) state.weapons = data.weapons;
  if (data.weapon) state.weapon = data.weapon;
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
