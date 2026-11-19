// Neon Bay — the map: three districts, streets, buildings, the airport,
// the beach and the peaks, plus the collision tests every system uses.
// Districts 1 and 2 are fenced off by barriers until missions unlock them.
//
// v2: buildWorld also returns `meshes` — static THREE.Object3D meshes for
// the whole world (ground, roads, buildings, trees, mountains, water,
// airport, gates, shops, activity spots, safe house). The renderer adds
// them to the scene once. Uses the global THREE (no import); geometry and
// materials are shared wherever possible. Data (buildings, roads, trees,
// solids, gates, shops, activitySpots, collides, ...) is unchanged from v1.
import { AIRPORT, DISTRICT_RECTS, SAFE_HOUSE, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { ACTIVITY_SPOTS, MOUNTAIN_PEAKS, SHOP_DEFS } from './data.js';

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

// Deterministic 0..1 hash of (seed, index): stable without touching rng,
// so the mesh layout never shifts the spawn sequence.
function hash01(seed, index) {
  const s = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const GROUND_COLORS = ['#3a3f4a', '#d9b96a', '#6b7a72'];

/** Build the static 3D meshes for the world data. Returns THREE.Object3D[]. */
function buildMeshes(data) {
  const { buildings, roads, trees, gates, shops, activitySpots } = data;
  const meshes = [];
  const geoCache = new Map();
  const matCache = new Map();

  function lambert(color, opts = {}) {
    const key = `lam-${color}-${opts.transparent ? 't' : 'o'}-${opts.opacity ?? 1}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshLambertMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 }));
    }
    return matCache.get(key);
  }
  function basic(color, opts = {}) {
    const key = `bas-${color}-${opts.transparent ? 't' : 'o'}-${opts.opacity ?? 1}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 }));
    }
    return matCache.get(key);
  }
  // A flat plane lying on the ground: PlaneGeometry is XY-facing, rotate -90° on X.
  function groundPlane(w, d, material, x, z, y = 0) {
    const key = `plane-${w}x${d}`;
    if (!geoCache.has(key)) geoCache.set(key, new THREE.PlaneGeometry(w, d));
    const m = new THREE.Mesh(geoCache.get(key), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  }

  // District ground.
  for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
    const r = DISTRICT_RECTS[i];
    meshes.push(groundPlane(r.w, r.h, lambert(GROUND_COLORS[i]), r.x + r.w / 2, r.y + r.h / 2, 0));
  }
  // Water (slightly above ground so it never z-fights).
  for (const w of WATER_RECTS) {
    meshes.push(groundPlane(w.w, w.h, lambert('#0e7490', { transparent: true, opacity: 0.9 }), w.x + w.w / 2, w.y + w.h / 2, 0.5));
  }
  // Roads: dark strip + a dashed-looking centre line (one thin strip).
  const roadMat = lambert('#23272f');
  const lineMat = basic('#fde047', { transparent: true, opacity: 0.45 });
  for (const r of roads) {
    meshes.push(groundPlane(r.w, r.h, roadMat, r.x + r.w / 2, r.y + r.h / 2, 0.6));
    if (r.vertical) meshes.push(groundPlane(3, r.h * 0.92, lineMat, r.x + r.w / 2, r.y + r.h / 2, 0.7));
    else meshes.push(groundPlane(r.w * 0.92, 3, lineMat, r.x + r.w / 2, r.y + r.h / 2, 0.7));
  }

  // Shared window texture: one canvas, one texture, tinted per building
  // by the material colour.
  const winCanvas = document.createElement('canvas');
  winCanvas.width = 64;
  winCanvas.height = 128;
  const wctx = winCanvas.getContext('2d');
  wctx.fillStyle = '#ffffff';
  wctx.fillRect(0, 0, 64, 128);
  wctx.fillStyle = 'rgba(30, 41, 59, 0.55)';
  for (let wy = 8; wy < 120; wy += 16) {
    for (let wx = 8; wx < 56; wx += 14) wctx.fillRect(wx, wy, 9, 10);
  }
  const winTex = new THREE.CanvasTexture(winCanvas);
  const buildingMats = new Map();
  function buildingMat(color) {
    if (!buildingMats.has(color)) {
      buildingMats.set(color, new THREE.MeshLambertMaterial({ map: winTex, color }));
    }
    return buildingMats.get(color);
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  for (const b of buildings) {
    const h = b.tall ? 70 + hash01(b.x, b.y) * 50 : 26 + hash01(b.x, b.y) * 16;
    const m = new THREE.Mesh(unitBox, buildingMat(b.color));
    m.scale.set(b.w, h, b.h);
    m.position.set(b.x + b.w / 2, h / 2, b.y + b.h / 2);
    meshes.push(m);
    // Flat roof cap so the top is not a stretched window texture.
    const roof = new THREE.Mesh(unitBox, lambert('#1f2937'));
    roof.scale.set(b.w + 2, 2, b.h + 2);
    roof.position.set(b.x + b.w / 2, h + 1, b.y + b.h / 2);
    meshes.push(roof);
  }

  // Trees: shared trunk + crown geometry, one group per tree.
  const trunkGeo = new THREE.CylinderGeometry(3, 4, 14, 6);
  const crownGeo = new THREE.ConeGeometry(13, 30, 7);
  const palmCrownGeo = new THREE.SphereGeometry(12, 7, 5);
  const trunkMat = lambert('#78350f');
  const pineMat = lambert('#166534');
  const palmMat = lambert('#15803d');
  const parkMat = lambert('#22c55e');
  for (const t of trees) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 7;
    g.add(trunk);
    const crown = new THREE.Mesh(t.kind === 'palm' ? palmCrownGeo : crownGeo, t.kind === 'palm' ? palmMat : t.kind === 'park' ? parkMat : pineMat);
    crown.position.y = t.kind === 'palm' ? 22 : 26;
    g.add(crown);
    g.position.set(t.x, 0, t.y);
    meshes.push(g);
  }

  // Peaks: mountain cones + snow caps from MOUNTAIN_PEAKS (data.js).
  const mountainGeo = new THREE.ConeGeometry(1, 1, 7);
  const rockMat = lambert('#6b7280');
  const snowMat = lambert('#e2e8f0');
  for (const p of MOUNTAIN_PEAKS) {
    const mx = p.x;
    const mz = p.y;
    const mr = p.radius;
    const mh = p.height;
    const m = new THREE.Mesh(mountainGeo, rockMat);
    m.scale.set(mr, mh, mr);
    m.position.set(mx, mh / 2 - 4, mz);
    meshes.push(m);
    const cap = new THREE.Mesh(mountainGeo, snowMat);
    cap.scale.set(mr * 0.34, mh * 0.3, mr * 0.34);
    cap.position.set(mx, mh - mh * 0.15 - 4, mz);
    meshes.push(cap);
  }

  // Airport: runway + centre line + terminal + control tower.
  const rw = AIRPORT.runway;
  meshes.push(groundPlane(rw.w, rw.h, lambert('#1f2937'), rw.x + rw.w / 2, rw.y + rw.h / 2, 0.8));
  meshes.push(groundPlane(rw.w * 0.9, 4, basic('#f8fafc', { transparent: true, opacity: 0.6 }), rw.x + rw.w / 2, rw.y + rw.h / 2, 0.9));
  const terminal = new THREE.Mesh(unitBox, lambert('#94a3b8'));
  terminal.scale.set(180, 34, 90);
  terminal.position.set(AIRPORT.x + 420, 17, AIRPORT.y + 90);
  meshes.push(terminal);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(10, 14, 90, 8), lambert('#cbd5e1'));
  tower.position.set(AIRPORT.x + 120, 45, AIRPORT.y + 90);
  meshes.push(tower);
  const towerTop = new THREE.Mesh(unitBox, lambert('#38bdf8'));
  towerTop.scale.set(36, 18, 36);
  towerTop.position.set(AIRPORT.x + 120, 96, AIRPORT.y + 90);
  meshes.push(towerTop);

  // Locked-district gates: red barriers. Tagged with the district so the
  // renderer can hide them once the district unlocks.
  for (const g of gates) {
    const m = new THREE.Mesh(unitBox, lambert('#dc2626'));
    m.scale.set(g.w, 26, g.h);
    m.position.set(g.x + g.w / 2, 13, g.y + g.h / 2);
    m.userData.gateDistrict = g.district;
    meshes.push(m);
  }

  // Shops: coloured box + a flat sign slab on top.
  const shopColors = { food: '#f59e0b', gun: '#ef4444', clothes: '#ec4899', mods: '#22d3ee' };
  for (const s of shops) {
    const m = new THREE.Mesh(unitBox, lambert(shopColors[s.kind] || '#0ea5e9'));
    m.scale.set(s.w, 30, s.h);
    m.position.set(s.x + s.w / 2, 15, s.y + s.h / 2);
    meshes.push(m);
    const sign = new THREE.Mesh(unitBox, basic('#f8fafc'));
    sign.scale.set(s.w + 6, 4, s.h + 6);
    sign.position.set(s.x + s.w / 2, 32, s.y + s.h / 2);
    meshes.push(sign);
  }

  // Activity spots: flat orange discs.
  const discGeo = new THREE.CircleGeometry(1, 20);
  const discMat = basic('#f59e0b', { transparent: true, opacity: 0.85 });
  for (const s of activitySpots) {
    const m = new THREE.Mesh(discGeo, discMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(s.r, s.r, 1);
    m.position.set(s.x, 0.8, s.y);
    meshes.push(m);
  }

  // Safe house: purple box with a lighter roof.
  const house = new THREE.Mesh(unitBox, lambert('#7c3aed'));
  house.scale.set(SAFE_HOUSE.w, 34, SAFE_HOUSE.h);
  house.position.set(SAFE_HOUSE.x + SAFE_HOUSE.w / 2, 17, SAFE_HOUSE.y + SAFE_HOUSE.h / 2);
  meshes.push(house);
  const houseRoof = new THREE.Mesh(unitBox, lambert('#4c1d95'));
  houseRoof.scale.set(SAFE_HOUSE.w + 4, 4, SAFE_HOUSE.h + 4);
  houseRoof.position.set(SAFE_HOUSE.x + SAFE_HOUSE.w / 2, 36, SAFE_HOUSE.y + SAFE_HOUSE.h / 2);
  meshes.push(houseRoof);

  return meshes;
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

  const world = {
    buildings, roads, trees, solids, gates, shops, activitySpots,
    collides, collidesRect, randomRoadPoint, nearestRoadPoint,
  };
  world.meshes = buildMeshes(world);
  return world;
}
