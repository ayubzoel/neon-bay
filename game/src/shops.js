// Neon Bay — the economy: food that heals, guns and ammo, clothes that
// change how you look, car mods that change how you drive, and the safe
// house with its wardrobe, garage and bed.
import { CAR_MODS, CLOTHES, FOODS, WEAPONS } from './config.js';
import { WEAPON_SHOP_STOCK } from './data.js';
import { activeCharacter, addMoney, healPlayer, saveGame, showMessage } from './state.js';
import { registerNightGlow, stdMat } from './textures.js';

export function shopItemsFor(state, kind) {
  const items = [];
  if (kind === 'food') {
    for (const f of FOODS) items.push({ id: f.id, name: f.name, desc: `Restores ${f.heal} HP`, price: f.price });
  } else if (kind === 'gun') {
    for (const key of WEAPON_SHOP_STOCK) {
      const def = WEAPONS[key];
      const owned = state.weapons[key];
      if (owned.owned) {
        // Melee weapons need no ammo.
        if (def.magSize !== Infinity) items.push({ id: `ammo-${key}`, name: `${def.name} Ammo`, desc: `+${def.magSize * 2} rounds`, price: def.ammoPrice * def.magSize });
      } else {
        items.push({ id: `buy-${key}`, name: def.name, desc: `Damage ${def.damage} · Range ${def.range} · ${def.auto ? 'Automatic' : 'Single shot'}`, price: def.price });
      }
    }
  } else if (kind === 'clothes') {
    for (const c of CLOTHES) {
      items.push({ id: c.id, name: c.name, desc: state.hero.outfit === c.id ? 'Currently wearing' : 'Changes your look', price: c.price, owned: state.ownedClothes?.includes(c.id) || c.price === 0 });
    }
  } else if (kind === 'mods') {
    for (const m of CAR_MODS) {
      items.push({ id: m.id, name: m.name, desc: m.speed ? `+${m.speed} top speed` : m.armor ? `+${m.armor} vehicle armor` : 'Fresh neon paint', price: m.price, owned: state.mods[m.id] === true || state.mods.engine >= m.speed });
    }
  }
  return items;
}

export function buyItem(state, kind, itemId) {
  const item = shopItemsFor(state, kind).find((i) => i.id === itemId);
  if (!item) return false;
  if (state.money < item.price) {
    showMessage(state, 'Not enough cash for that.');
    return false;
  }
  if (item.owned) {
    showMessage(state, 'You already own that.');
    return false;
  }
  addMoney(state, -item.price, `Bought ${item.name}`);
  if (kind === 'food') {
    const food = FOODS.find((f) => f.id === itemId);
    if (food) healPlayer(state, food.heal);
  } else if (kind === 'gun') {
    if (itemId.startsWith('buy-')) {
      const key = itemId.slice(4);
      state.weapons[key].owned = true;
      state.weapons[key].ammo += WEAPONS[key].magSize * 2;
      state.weapons[key].mag = WEAPONS[key].magSize;
    } else if (itemId.startsWith('ammo-')) {
      const key = itemId.slice(5);
      state.weapons[key].ammo += WEAPONS[key].magSize * 2;
    }
  } else if (kind === 'clothes') {
    state.ownedClothes = state.ownedClothes || ['street'];
    if (!state.ownedClothes.includes(itemId)) state.ownedClothes.push(itemId);
    selectOutfit(state, itemId);
  } else if (kind === 'mods') {
    const mod = CAR_MODS.find((m) => m.id === itemId);
    if (mod) {
      if (mod.speed) state.mods.engine = Math.max(state.mods.engine, mod.speed);
      if (mod.armor) state.mods.armor = Math.max(state.mods.armor, mod.armor);
      if (mod.id === 'paint') state.mods.paint = true;
      if (state.playerVehicle) {
        state.playerVehicle.modSpeed = state.mods.engine;
        state.playerVehicle.maxHp = (state.playerVehicle.maxHp || 120) + mod.armor;
        state.playerVehicle.hp += mod.armor;
      }
    }
  }
  return true;
}

export function selectOutfit(state, outfitId) {
  const outfit = CLOTHES.find((c) => c.id === outfitId);
  if (!outfit) return false;
  state.hero.outfit = outfitId;
  state.hero.outfitColor = outfit.color;
  showMessage(state, `Now wearing: ${outfit.name}`);
  return true;
}

/** Park the car you are driving in the safe-house garage. */
export function storeCurrentCar(state) {
  const v = state.playerVehicle;
  if (!v) return false;
  const hero = activeCharacter(state);
  state.garage.push({ name: v.name, kind: v.kind, color: v.color, hp: v.hp });
  state.vehicles = state.vehicles.filter((x) => x !== v);
  state.playerVehicle = null;
  hero.x = 560;
  hero.y = 1620;
  showMessage(state, `${v.name} parked in the garage.`);
  return true;
}

/** Take a stored car out of the garage; it appears by the safe house. */
export function takeOutCar(state, index) {
  const car = state.garage[index];
  if (!car) return false;
  state.garage.splice(index, 1);
  const v = {
    id: 8000 + Math.floor(Math.random() * 900), kind: car.kind, x: 640, y: 1700, angle: 0,
    speed: 0, z: 0, hp: car.hp, maxHp: 120, color: car.color, name: car.name,
    owner: 'player', modSpeed: state.mods.engine, modArmor: 0, waypoint: null, waitTimer: 0,
  };
  state.vehicles.push(v);
  showMessage(state, `${car.name} is waiting outside.`);
  return true;
}

/** Sleep in the safe house: full heal, wanted cools off, game saved. */
export function sleepAtSafeHouse(state) {
  const hero = activeCharacter(state);
  hero.hp = 100;
  hero.armor = 50;
  state.wanted = Math.max(0, state.wanted - 2);
  state.time.minutes = 8 * 60;
  state.time.day += 1;
  saveGame(state);
  showMessage(state, 'You slept like a rock. Fresh day, full health.', 4);
}

// --- v2 3D drawing -------------------------------------------------------
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

// Sign board colour per shop kind.
const SHOP_SIGN_COLORS = {
  food: 0xf59e0b,
  gun: 0xef4444,
  clothes: 0xec4899,
  mods: 0x22c55e,
};

/**
 * A 3D sign over every shop: a pole plus a coloured board, so shops read
 * from the third-person camera. Called every frame by the 3D renderer.
 */
export function drawShopSigns(pool, world) {
  if (!pool || typeof pool.get !== 'function' || !world || !world.shops) return;
  const T = three();
  for (const shop of world.shops) {
    const cx = shop.x + (shop.w || 90) / 2;
    const cz = shop.y + (shop.h || 70) / 2;
    const color = SHOP_SIGN_COLORS[shop.kind] || 0x0ea5e9;
    const sign = pool.get(`shop-sign-${shop.id}`, () => {
      if (!T) return dummyObj();
      const g = new T.Group();
      const pole = new T.Mesh(
        new T.BoxGeometry(4, 40, 4),
        stdMat('shop-pole', () => new T.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, metalness: 0.3 })),
      );
      pole.position.set(0, 20, 0);
      // The board glows at night so shops stay findable after dark.
      const boardMat = stdMat(`shop-board-${color.toString(16)}`, () => {
        const m = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.25, roughness: 0.5, metalness: 0 });
        registerNightGlow(m, 0.25, 1.4);
        return m;
      });
      const board = new T.Mesh(
        new T.BoxGeometry(64, 16, 4),
        boardMat,
      );
      board.position.set(0, 44, 0);
      g.add(pole);
      g.add(board);
      return g;
    });
    sign.position.set(cx, 0, cz);
    sign.visible = true;
  }
}
