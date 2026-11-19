// Neon Bay — the map: three districts, streets, buildings, the airport,
// the beach and the peaks, plus the collision tests every system uses.
// Districts 1 and 2 are fenced off by barriers until missions unlock them.
import { AIRPORT, DISTRICT_RECTS, SAFE_HOUSE, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { ACTIVITY_SPOTS, SHOP_DEFS } from './data.js';

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function districtAt(x, y) {
  if (y < 900) return 2;
  if (x >= 3000) return 1;
  return 0;
}

export function isWater(x, y) {
  return WATER_RECTS.some((r) => pointInRect(x, y, r));
}

export function buildWorld(rng) {
  const buildings = [];
  const roads = [];
  const trees = [];
  const solids = [];
  const gates = [
    // Beach gate: the two roads crossing x = 3000.
    { x: 2990, y: 1450, w: 24, h: 110, district: 1, label: 'Beach Gate' },
    { x: 2990, y: 3050, w: 24, h: 110, district: 1, label: 'Beach Gate' },
    // Peaks gate: the roads crossing y = 900.
    { x: 650, y: 890, w: 110, h: 24, district: 2, label: 'Peaks Gate' },
    { x: 2350, y: 890, w: 110, h: 24, district: 2, label: 'Peaks Gate' },
  ];

  // City grid streets.
  const streetXs = [300, 700, 1100, 1500, 1900, 2300, 2700];
  const streetYs = [1100, 1500, 1900, 2300, 2700, 3100, 3400];
  for (const x of streetXs) roads.push({ x: x - 32, y: 900, w: 64, h: 2700, vertical: true });
  for (const y of streetYs) roads.push({ x: 0, y: y - 32, w: 3000, h: 64, vertical: false });
  // Beach road and the mountain road.
  roads.push({ x: 3168, y: 900, w: 64, h: 2700, vertical: true });
  roads.push({ x: 3000, y: 1900, w: 1400, h: 64, vertical: false });
  roads.push({ x: 0, y: 400, w: 4800, h: 64, vertical: false });
  roads.push({ x: 1200, y: 400, w: 64, h: 500, vertical: true });
  roads.push({ x: 3400, y: 400, w: 64, h: 500, vertical: true });

  // City blocks: buildings fill the blocks between streets, with parks left open.
  const cityColors = ['#3f4a5a', '#4a3b52', '#37474f', '#4e342e', '#2f3e46', '#5d4037'];
  for (let bx = 0; bx < streetXs.length - 1; bx += 1) {
    for (let by = 0; by < streetYs.length - 1; by += 1) {
      const x0 = streetXs[bx] + 40;
      const y0 = streetYs[by] + 40;
      const x1 = streetXs[bx + 1] - 40;
      const y1 = streetYs[by + 1] - 40;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      if (rng.chance(0.18)) {
        // A park: trees instead of a building.
        for (let t = 0; t < 4; t += 1) trees.push({ x: rng.range(x0, x1), y: rng.range(y0, y1), kind: 'park' });
        continue;
      }
      const w = rng.range(90, Math.min(220, x1 - x0));
      const h = rng.range(80, Math.min(200, y1 - y0));
      const b = { x: x0, y: y0, w, h, color: rng.pick(cityColors), district: 0, tall: rng.chance(0.4) };
      if (rectsOverlap(b, { x: AIRPORT.x, y: AIRPORT.y, w: AIRPORT.w, h: AIRPORT.h })) continue;
      if (rectsOverlap(b, { x: SAFE_HOUSE.x - 40, y: SAFE_HOUSE.y - 40, w: 260, h: 200 })) continue;
      buildings.push(b);
      solids.push(b);
    }
  }

  // Beach: hotels along the boardwalk, palm trees on the sand.
  const beachColors = ['#f59e0b', '#0ea5e9', '#ec4899', '#f8fafc'];
  for (let i = 0; i < 10; i += 1) {
    const b = { x: 3300 + i * 100, y: 1050 + (i % 3) * 260, w: 90, h: 130, color: beachColors[i % beachColors.length], district: 1, tall: false };
    buildings.push(b);
    solids.push(b);
  }
  for (let i = 0; i < 26; i += 1) trees.push({ x: rng.range(3600, 4350), y: rng.range(1000, 3500), kind: 'palm' });

  // Peaks: cabins, pines and rocks.
  for (let i = 0; i < 8; i += 1) {
    const b = { x: rng.range(200, 4500), y: rng.range(120, 780), w: 100, h: 80, color: '#6b4f2a', district: 2, tall: false };
    buildings.push(b);
    solids.push(b);
  }
  for (let i = 0; i < 60; i += 1) trees.push({ x: rng.range(80, 4700), y: rng.range(60, 860), kind: 'pine' });

  // The safe house is a solid building with a door.
  const house = { x: SAFE_HOUSE.x, y: SAFE_HOUSE.y, w: SAFE_HOUSE.w, h: SAFE_HOUSE.h, color: '#7c3aed', district: 0, tall: false };
  buildings.push(house);
  solids.push(house);

  const shops = SHOP_DEFS.map((s) => ({ ...s, w: 90, h: 70 }));
  const activitySpots = ACTIVITY_SPOTS.map((s) => ({ ...s, r: 46 }));

  function collides(x, y, r, unlocked) {
    if (x - r < 0 || y - r < 0 || x + r > WORLD_WIDTH || y + r > WORLD_HEIGHT) return true;
    for (const s of solids) {
      if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
    }
    if (unlocked) {
      for (const g of gates) {
        if (!unlocked[g.district] && x + r > g.x && x - r < g.x + g.w && y + r > g.y && y - r < g.y + g.h) return true;
      }
    }
    return false;
  }

  function collidesRect(x, y, w, h, unlocked) {
    return collides(x + w / 2, y + h / 2, Math.max(w, h) / 2, unlocked);
  }

  function randomRoadPoint(district) {
    const districtRoads = roads.filter((r) => districtAt(r.x + r.w / 2, r.y + r.h / 2) === district);
    const road = districtRoads[Math.floor(rng.next() * districtRoads.length)] || roads[0];
    return {
      x: road.x + rng.range(8, Math.max(9, road.w - 8)),
      y: road.y + rng.range(8, Math.max(9, road.h - 8)),
    };
  }

  function nearestRoadPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const r of roads) {
      const cx = Math.max(r.x, Math.min(x, r.x + r.w));
      const cy = Math.max(r.y, Math.min(y, r.y + r.h));
      const d = (cx - x) ** 2 + (cy - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { x: cx, y: cy };
      }
    }
    return best;
  }

  return {
    buildings, roads, trees, solids, gates, shops, activitySpots,
    collides, collidesRect, randomRoadPoint, nearestRoadPoint,
  };
}
