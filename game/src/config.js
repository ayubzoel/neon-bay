// Neon Bay — shared constants: world size, districts, tuning, prices.
// Every number the other modules need lives here, so the game is tuned in one place.
export const TILE = 32;
export const WORLD_WIDTH = 4800;
export const WORLD_HEIGHT = 3600;

// Districts, west to east and south to north. District 0 is open at the start;
// district 1 (beach) opens after main mission 20, district 2 (mountains) after 40.
export const DISTRICTS = [
  { id: 0, name: 'Downtown Neon Bay', short: 'Downtown', color: '#2e3440', locked: false },
  { id: 1, name: 'Sunset Beach', short: 'Beach', color: '#c9a227', locked: true },
  { id: 2, name: 'Cinder Peaks', short: 'Peaks', color: '#5b6b7a', locked: true },
];
export const DISTRICT_RECTS = [
  { x: 0, y: 900, w: 3000, h: 2700 }, // city: south-west block
  { x: 3000, y: 900, w: 1800, h: 2700 }, // beach: east strip
  { x: 0, y: 0, w: 4800, h: 900 }, // mountains: north band
];
// Open water runs along the far east edge and a lake sits in the peaks.
export const WATER_RECTS = [
  { x: 4400, y: 900, w: 400, h: 2700 },
  { x: 3300, y: 60, w: 700, h: 320 },
];
export const AIRPORT = { x: 2050, y: 2650, w: 850, h: 600, runway: { x: 2200, y: 2900, w: 560, h: 90 } };
export const SAFE_HOUSE = { x: 420, y: 1500, w: 150, h: 110, door: { x: 495, y: 1610 } };

export const STEP = 1 / 60;
export const SAVE_KEY = 'neon-bay-save-v1';

// A full in-game day lasts 8 real minutes; seasons flip every 3 game days.
export const MINUTES_PER_DAY = 1440;
export const DAY_LENGTH_SECONDS = 480;
export const SEASON_DAYS = 3;

// Player tuning.
export const PLAYER_WALK_SPEED = 150;
export const PLAYER_RUN_SPEED = 235;
export const PLAYER_SWIM_SPEED = 85;
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
export const WANTED_SIGHT_RANGE = 520;

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
  { id: 'engine1', name: 'Turbo Engine I', price: 800, speed: 60, armor: 0 },
  { id: 'engine2', name: 'Turbo Engine II', price: 1800, speed: 120, armor: 0 },
  { id: 'armor1', name: 'Armored Plates', price: 1000, speed: 0, armor: 60 },
  { id: 'paint', name: 'Neon Paint Job', price: 300, speed: 0, armor: 0 },
];

// Vehicles.
export const VEHICLE_STATS = {
  car: { accel: 420, maxSpeed: 430, turn: 2.6, hp: 120 },
  bike: { accel: 520, maxSpeed: 500, turn: 3.4, hp: 70 },
  boat: { accel: 300, maxSpeed: 360, turn: 2.0, hp: 100 },
  plane: { accel: 380, maxSpeed: 620, turn: 1.8, hp: 150, takeoffSpeed: 380 },
};

// Mission structure: 60 main missions, 20 per district; 100 side quests in the pool.
export const MAIN_MISSION_COUNT = 60;
export const MISSIONS_PER_DISTRICT = 20;
export const SIDE_QUEST_POOL = 100;
export const DISTRICT_UNLOCK_MISSION = [0, 20, 40];

// Third-person 3D camera (v2): orbit yaw, pitch and follow distance.
export const CAMERA_PITCH_DEFAULT = 0.45;
export const CAMERA_DIST_DEFAULT = 260;
export const CAMERA_MIN_DIST = 140;
export const CAMERA_MAX_DIST = 520;
export const CAMERA_PITCH_MIN = 0.15;
export const CAMERA_PITCH_MAX = 1.1;
// Height of a standing character mesh, in world units (used to scale figures).
export const CHARACTER_HEIGHT = 34;
