// Neon Bay — shared constants: world size, districts, tuning, prices.
// Every number the other modules need lives here, so the game is tuned in one place.
import { addStrings } from './i18n.js';
export const TILE = 32;
// v3: ~3x the v2 area (4800x3600 = 17.28M -> 9600x5400 = 51.84M units^2).
export const WORLD_WIDTH = 9600;
export const WORLD_HEIGHT = 5400;

// Districts, west to east and south to north. District 0 is open at the start;
// district 1 (beach) opens after main mission 20, district 2 (mountains) after 40.
export const DISTRICTS = [
  { id: 0, name: 'Downtown Neon Bay', short: 'Downtown', color: '#2e3440', locked: false },
  { id: 1, name: 'Sunset Beach', short: 'Beach', color: '#c9a227', locked: true },
  { id: 2, name: 'Cinder Peaks', short: 'Peaks', color: '#5b6b7a', locked: true },
];
export const DISTRICT_RECTS = [
  { x: 0, y: 1350, w: 6000, h: 4050 }, // city: south-west block
  { x: 6000, y: 1350, w: 3600, h: 4050 }, // beach: east strip
  { x: 0, y: 0, w: 9600, h: 1350 }, // mountains: north band
];
// Open water runs along the far east edge and a lake sits in the peaks.
export const WATER_RECTS = [
  { x: 9200, y: 1350, w: 400, h: 4050 },
  { x: 6600, y: 90, w: 1400, h: 480 },
];
// Airport, south-east downtown (moved from the v2 spot for the bigger map).
export const AIRPORT = { x: 3900, y: 4300, w: 1700, h: 900, runway: { x: 4050, y: 4650, w: 1200, h: 120 } };
// Safe house: KEPT at its v2 spot on purpose. player.js checks the door at
// the literal (495, 1610) and shops.js sleeps/garages the car at (560, 1620);
// both files are outside this build's scope, so moving the house would break
// entering it. It still sits in downtown, a short walk from the start.
export const SAFE_HOUSE = { x: 420, y: 1500, w: 150, h: 110, door: { x: 495, y: 1610 } };

export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay-save-v1';

// A full in-game day lasts 8 real minutes; seasons flip every 3 game days.
export const MINUTES_PER_DAY = 1440;
export const DAY_LENGTH_SECONDS = 480;
export const SEASON_DAYS = 3;

// Player tuning (metres per second: a brisk walk is ~3.5 m/s, a run ~7).
export const PLAYER_WALK_SPEED = 3.5;
export const PLAYER_RUN_SPEED = 7;
export const PLAYER_SWIM_SPEED = 1.5;
export const PLAYER_MAX_HP = 100;
export const PLAYER_START_MONEY = 250;

// Wanted level: what hunts the player at each star, and how fast heat grows.
export const WANTED = [
  { stars: 0, cars: 0, bikes: 0, helis: 0, tanks: 0 },
  { stars: 1, cars: 2, bikes: 0, helis: 0, tanks: 0 },
  { stars: 2, cars: 2, bikes: 2, helis: 0, tanks: 0 },
  { stars: 3, cars: 3, bikes: 3, helis: 0, tanks: 0 },
  { stars: 4, cars: 3, bikes: 3, helis: 1, tanks: 0 },
  { stars: 5, cars: 4, bikes: 4, helis: 2, tanks: 1 },
];
export const WANTED_DECAY_SECONDS = 45;
export const WANTED_SIGHT_RANGE = 150;

// Weapons: damage, range, fire rate, bullet speed, price, ammo price.
export const WEAPONS = {
  pistol: { name: 'Pistol', damage: 18, range: 320, fireRate: 0.28, bulletSpeed: 620, price: 0, ammoPrice: 2, magSize: 12, auto: false, color: '#d1d5db' },
  rifle: { name: 'Rifle', damage: 26, range: 560, fireRate: 0.12, bulletSpeed: 900, price: 1200, ammoPrice: 4, magSize: 30, auto: true, color: '#9ca3af' },
  shotgun: { name: 'Shotgun', damage: 14, range: 220, fireRate: 0.8, bulletSpeed: 520, price: 900, ammoPrice: 5, magSize: 6, auto: false, pellets: 6, color: '#f59e0b' },
  melee: { name: 'Baseball Bat', damage: 30, range: 56, fireRate: 0.45, bulletSpeed: 0, price: 150, ammoPrice: 0, magSize: Infinity, auto: false, color: '#a16207' },
  grenade: { name: 'Grenade', damage: 90, range: 260, fireRate: 1.1, bulletSpeed: 340, price: 500, ammoPrice: 25, magSize: 1, auto: false, blast: 90, color: '#22c55e' },
  bazooka: { name: 'Bazooka', damage: 160, range: 700, fireRate: 1.6, bulletSpeed: 480, price: 4500, ammoPrice: 120, magSize: 1, auto: false, blast: 130, color: '#ef4444' },
};
export const WEAPON_ORDER = ['pistol', 'rifle', 'shotgun', 'melee', 'grenade', 'bazooka'];

// Food heals; clothes change the visible outfit; car mods tune the owned car.
export const FOODS = [
  { id: 'burger', name: 'Bay Burger', price: 12, heal: 25 },
  { id: 'noodles', name: 'Neon Noodles', price: 18, heal: 40 },
  { id: 'shake', name: 'Sunset Shake', price: 8, heal: 12 },
  { id: 'medkit', name: 'Medkit', price: 60, heal: 100 },
];
export const CLOTHES = [
  { id: 'street', name: 'Street Wear', price: 0, color: '#3b82f6', accent: '#f8fafc' },
  { id: 'neon', name: 'Neon Nights', price: 120, color: '#d946ef', accent: '#fde68a' },
  { id: 'racer', name: 'Racer Suit', price: 250, color: '#ef4444', accent: '#111827' },
  { id: 'beach', name: 'Beach Fit', price: 90, color: '#f59e0b', accent: '#0ea5e9' },
  { id: 'tux', name: 'Sharp Suit', price: 600, color: '#111827', accent: '#f8fafc' },
];
export const CAR_MODS = [
  { id: 'engine1', name: 'Turbo Engine I', price: 800, speed: 8, armor: 0 },
  { id: 'engine2', name: 'Turbo Engine II', price: 1800, speed: 15, armor: 60 },
  { id: 'armor1', name: 'Armored Plates', price: 1000, speed: 0, armor: 60 },
  { id: 'paint', name: 'Neon Paint Job', price: 300, speed: 0, armor: 0 },
];

// Vehicles (metres per second: city traffic cruises ~14 m/s = 50 km/h, a
// fast car tops out ~55 m/s = 198 km/h). Turn rates are radians per second.
export const VEHICLE_STATS = {
  car: { accel: 14, maxSpeed: 55, turn: 2.6, hp: 120 },
  bike: { accel: 16, maxSpeed: 60, turn: 3.4, hp: 70 },
  boat: { accel: 8, maxSpeed: 25, turn: 2.0, hp: 100 },
  plane: { accel: 12, maxSpeed: 85, turn: 1.8, hp: 150, takeoffSpeed: 30 },
};

// Mission structure: 60 main missions, 20 per district; 100 side quests in the pool.
export const MAIN_MISSION_COUNT = 60;
export const MISSIONS_PER_DISTRICT = 20;
export const SIDE_QUEST_POOL = 100;
export const DISTRICT_UNLOCK_MISSION = [0, 20, 40];

// v4 scale (1 unit = 1 metre, Leo Vance 1.8 m): the road cross-sections
// every system shares. A residential street is 7 m wide (2 x 3.5 m lanes)
// with a 2.5 m sidewalk on each side; an arterial is 16 m wide (4 x 3.5 m
// lanes + a 1.5 m median) with the same sidewalks. Building faces start at
// the sidewalk edge (road half + sidewalk width), so world.js places them
// at 6 m from a residential centreline and 10.5 m from an arterial one.
export const LANE_WIDTH = 3.5;
export const SIDEWALK_WIDTH = 2.5;
export const ROAD_RES_HALF = 3.5; // residential: 2 lanes, 7 m total
export const ROAD_ART_HALF = 8; // arterial: 4 lanes + 1.5 m median, 16 m total
export const ROAD_MEDIAN_HALF = 0.75; // half of the 1.5 m arterial median
export const ROAD_RES_LANE_OFFSET = 1.75; // lane centre, residential
export const ROAD_ART_LANE_OUTER = 6; // outer lane centre, arterial
export const ROAD_ART_LANE_INNER = 2.5; // inner lane centre, arterial
export const ROAD_RES_SIDEWALK_OFFSET = 4.75; // 3.5 + 2.5 / 2
export const ROAD_ART_SIDEWALK_OFFSET = 9.25; // 8 + 2.5 / 2

// Traffic lights: a full cycle is 30 s (12 s green, 3 s yellow per axis).
export const TRAFFIC_LIGHT_CYCLE = 30;
export const TRAFFIC_LIGHT_GREEN = 12;
export const TRAFFIC_LIGHT_YELLOW = 3;
// Traffic-light pole height (~5 m) and street-lamp height (~6 m).
export const TRAFFIC_LIGHT_POLE_HEIGHT = 5;
export const STREET_LAMP_HEIGHT = 6;

// Vehicle sizes in metres (a car is ~4.5 m long, ~1.8 m wide).
export const CAR_LENGTH = 4.5;
export const CAR_WIDTH = 1.8;
// Third-person 3D camera (v2): orbit yaw, pitch and follow distance.
// v4: distances are metres behind a 1.8 m-tall Leo (was 260 for a 34-unit
// figure) — 14 m default, 6 m closest, 32 m farthest.
export const CAMERA_PITCH_DEFAULT = 0.45;
export const CAMERA_DIST_DEFAULT = 14;
export const CAMERA_MIN_DIST = 6;
export const CAMERA_MAX_DIST = 32;
export const CAMERA_PITCH_MIN = 0.15;
export const CAMERA_PITCH_MAX = 1.1;
// Height of a standing character mesh, in world units (used to scale figures).
// v4: 1 unit = 1 m, Leo Vance is 1.8 m tall. NOTE: player.js still builds
// Leo's figure ~34 tall (that file is outside this build's scope) — it must
// be rebuilt at 1.8 for the proportions to match; NPCs (npc.js) already are.
export const CHARACTER_HEIGHT = 1.8;

// --- v4 traffic density (Settings: Low / Medium / High) -----------------
// How many walking pedestrians, moving AI cars and parked cars each level
// spawns, per district [downtown, beach, peaks]. 'high' is the v4 default
// and matches the counts the game shipped with; 'low' is the performance
// option for weak machines (SwiftShader already runs v3 at ~4 fps).
// spawnNpcs (npc.js) and spawnVehicles (vehicles.js) read state.densityLevel
// at spawn time; applyDensity (vehicles.js) adjusts a live game.
export const DENSITY_LEVELS = {
  low: { label: 'Low', peds: [40, 15, 8], traffic: [12, 5, 4], parked: [8, 3, 1] },
  medium: { label: 'Medium', peds: [60, 22, 14], traffic: [18, 7, 5], parked: [12, 3, 1] },
  high: { label: 'High', peds: [85, 32, 23], traffic: [24, 10, 8], parked: [16, 4, 2] },
};
export const DEFAULT_DENSITY = 'high';

// --- v4 default PC keybinds (Settings: display + rebind) ----------------
// The single source of truth for what each key does. Every entry below is
// a key the game actually reads: movement/run/confirm/pause live in
// input.js (MOVE_KEYS, CONFIRM_KEYS, PAUSE_KEYS, Shift), the rest are read
// with input.pressed(code) in main.js (E/F/Q/G/M/B), combat.js (R,
// Digit1-6), player.js (Space = jump) and vehicles.js (H = horn).
// `code` is the primary key, `alt` a fixed secondary that always works
// alongside it (arrow keys for movement, Enter for confirm, Escape for
// pause, right Shift for run). `rebindable` is false for mouse actions:
// they are shown for reference but cannot take a keyboard key.
// NOTE — Space does double duty by design (it is not a bug in this table):
// on menus it confirms/starts (input.js CONFIRM_KEYS), in play it jumps
// (player.js). Rebinding 'confirm' or 'jump' must keep that in mind.
// The horn (H) is wired in vehicles.js updateVehicles, which reads
// input.pressed(keybindFor(state, 'horn')) — no input.js change needed,
// because input.js records every key press in its pressed set.
export const DEFAULT_KEYBINDS = [
  { action: 'moveUp', label: 'Move up', code: 'KeyW', alt: 'ArrowUp', context: 'play', rebindable: true },
  { action: 'moveDown', label: 'Move down', code: 'KeyS', alt: 'ArrowDown', context: 'play', rebindable: true },
  { action: 'moveLeft', label: 'Move left', code: 'KeyA', alt: 'ArrowLeft', context: 'play', rebindable: true },
  { action: 'moveRight', label: 'Move right', code: 'KeyD', alt: 'ArrowRight', context: 'play', rebindable: true },
  { action: 'run', label: 'Run', code: 'ShiftLeft', alt: 'ShiftRight', context: 'play', rebindable: true },
  { action: 'jump', label: 'Jump', code: 'Space', alt: null, context: 'play', rebindable: true, note: 'Shares Space with Confirm (menus).' },
  { action: 'confirm', label: 'Confirm / Start', code: 'Space', alt: 'Enter', context: 'menu', rebindable: true, note: 'Shares Space with Jump (in play).' },
  { action: 'pause', label: 'Pause', code: 'KeyP', alt: 'Escape', context: 'play', rebindable: true },
  { action: 'interact', label: 'Interact / Talk', code: 'KeyE', alt: null, context: 'play', rebindable: true },
  { action: 'enterVehicle', label: 'Enter / Exit vehicle', code: 'KeyF', alt: null, context: 'play', rebindable: true },
  { action: 'pickpocket', label: 'Pickpocket', code: 'KeyQ', alt: null, context: 'play', rebindable: true },
  { action: 'storeCar', label: 'Store car at safe house', code: 'KeyG', alt: null, context: 'play', rebindable: true },
  { action: 'map', label: 'Toggle map', code: 'KeyM', alt: null, context: 'play', rebindable: true },
  { action: 'backpack', label: 'Open backpack', code: 'KeyB', alt: null, context: 'play', rebindable: true },
  { action: 'reload', label: 'Reload weapon', code: 'KeyR', alt: null, context: 'play', rebindable: true },
  { action: 'weapon1', label: 'Weapon: Pistol', code: 'Digit1', alt: null, context: 'play', rebindable: true },
  { action: 'weapon2', label: 'Weapon: Rifle', code: 'Digit2', alt: null, context: 'play', rebindable: true },
  { action: 'weapon3', label: 'Weapon: Shotgun', code: 'Digit3', alt: null, context: 'play', rebindable: true },
  { action: 'weapon4', label: 'Weapon: Baseball Bat', code: 'Digit4', alt: null, context: 'play', rebindable: true },
  { action: 'weapon5', label: 'Weapon: Grenade', code: 'Digit5', alt: null, context: 'play', rebindable: true },
  { action: 'weapon6', label: 'Weapon: Bazooka', code: 'Digit6', alt: null, context: 'play', rebindable: true },
  { action: 'horn', label: 'Horn', code: 'KeyH', alt: null, context: 'driving', rebindable: true },
  { action: 'fire', label: 'Fire weapon', code: 'MouseLeft', alt: null, context: 'play', rebindable: false, note: 'Mouse button, not a key.' },
  { action: 'cameraOrbit', label: 'Orbit camera', code: 'MouseDrag', alt: null, context: 'play', rebindable: false, note: 'Drag the mouse.' },
  { action: 'cameraZoom', label: 'Zoom camera', code: 'MouseWheel', alt: null, context: 'play', rebindable: false, note: 'Mouse wheel.' },
];

/** The key code for an action: the player's rebind (state.keybinds) wins,
 * otherwise the default above. Returns null for an unknown action. */
export function keybindFor(state, action) {
  const custom = state && state.keybinds && state.keybinds[action];
  if (typeof custom === 'string' && custom) return custom;
  const entry = DEFAULT_KEYBINDS.find((b) => b.action === action);
  return entry ? entry.code : null;
}

/** The full effective { action: code } map (defaults + the player's
 * rebinds). The Settings menu displays and edits this. */
export function effectiveKeybinds(state) {
  const out = {};
  for (const b of DEFAULT_KEYBINDS) out[b.action] = b.code;
  if (state && state.keybinds) {
    for (const [action, code] of Object.entries(state.keybinds)) {
      if (typeof code === 'string' && code && out[action] !== undefined) out[action] = code;
    }
  }
  return out;
}

// --- i18n: names of the data tables above --------------------------------
// Builder C owns game/src/i18n.js (t, addStrings, setLang, getLang); it
// does not exist yet, so the real addStrings is loaded dynamically and
// this file registers its strings when it lands. Until then addStrings is
// a no-op and the English names in the tables above are what the game
// shows (English is the default language). This is a loading shim, not a
// second i18n system: no language switching or persistence lives here.
// The keys below are for the display sites (ui.js, shops.js, combat.js —
// outside this build's scope): they should show these names with
// t('district.downtown'), t('weapon.pistol'), t('food.burger'),
// t('clothes.racer'), t('mod.engine1') and t('density.high') instead of
// reading the .name/.label fields directly. Proper nouns (district names,
// brand-like food names) are identical in both languages on purpose.
const CONFIG_STRINGS_EN = {
  'district.downtown': 'Downtown Neon Bay',
  'district.downtown.short': 'Downtown',
  'district.beach': 'Sunset Beach',
  'district.beach.short': 'Beach',
  'district.peaks': 'Cinder Peaks',
  'district.peaks.short': 'Peaks',
  'weapon.pistol': 'Pistol',
  'weapon.rifle': 'Rifle',
  'weapon.shotgun': 'Shotgun',
  'weapon.melee': 'Baseball Bat',
  'weapon.grenade': 'Grenade',
  'weapon.bazooka': 'Bazooka',
  'food.burger': 'Bay Burger',
  'food.noodles': 'Neon Noodles',
  'food.shake': 'Sunset Shake',
  'food.medkit': 'Medkit',
  'clothes.street': 'Street Wear',
  'clothes.neon': 'Neon Nights',
  'clothes.racer': 'Racer Suit',
  'clothes.beach': 'Beach Fit',
  'clothes.tux': 'Sharp Suit',
  'mod.engine1': 'Turbo Engine I',
  'mod.engine2': 'Turbo Engine II',
  'mod.armor1': 'Armored Plates',
  'mod.paint': 'Neon Paint Job',
  'density.low': 'Low',
  'density.medium': 'Medium',
  'density.high': 'High',
};
const CONFIG_STRINGS_ID = {
  'district.downtown': 'Downtown Neon Bay',
  'district.downtown.short': 'Downtown',
  'district.beach': 'Sunset Beach',
  'district.beach.short': 'Beach',
  'district.peaks': 'Cinder Peaks',
  'district.peaks.short': 'Peaks',
  'weapon.pistol': 'Pistol',
  'weapon.rifle': 'Senapan',
  'weapon.shotgun': 'Shotgun',
  'weapon.melee': 'Pemukul Bisbol',
  'weapon.grenade': 'Granat',
  'weapon.bazooka': 'Bazoka',
  'food.burger': 'Bay Burger',
  'food.noodles': 'Neon Noodles',
  'food.shake': 'Sunset Shake',
  'food.medkit': 'Medkit',
  'clothes.street': 'Street Wear',
  'clothes.neon': 'Neon Nights',
  'clothes.racer': 'Setelan Pembalap',
  'clothes.beach': 'Beach Fit',
  'clothes.tux': 'Setelan Rapi',
  'mod.engine1': 'Mesin Turbo I',
  'mod.engine2': 'Mesin Turbo II',
  'mod.armor1': 'Pelat Baja',
  'mod.paint': 'Cat Neon',
  'density.low': 'Rendah',
  'density.medium': 'Sedang',
  'density.high': 'Tinggi',
};
addStrings('en', CONFIG_STRINGS_EN);
addStrings('id', CONFIG_STRINGS_ID);
