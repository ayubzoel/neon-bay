// Neon Bay — the map: three districts, streets, buildings, the airport,
// the beach and the peaks, plus the collision tests every system uses.
// Districts 1 and 2 are fenced off by full barrier walls until missions
// unlock them; the only way through is a staffed gate on a through-road.
//
// v3: the world is ~3x the v2 area (9600x5400). Downtown is a proper grid
// (10 avenues x 9 streets), the beach has its own shore roads and boardwalk
// strip, the peaks have mountain roads and a lake. Streets, sidewalks and
// zebra crossings come from the road graph (roadgraph.js): NPCs walk the
// sidewalks, traffic drives the lanes, police chase along the graph.
//
// buildWorld also returns `meshes` — static THREE.Object3D meshes for the
// whole world. The renderer adds them to the scene once. Uses the global
// THREE (no import); geometry and materials are shared wherever possible.
import { AIRPORT, DISTRICT_RECTS, SAFE_HOUSE, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { ACTIVITY_SPOTS, MOUNTAIN_PEAKS, SHOP_DEFS } from './data.js';
import { buildRoadGraph } from './roadgraph.js';

// v3 street layout: 10 avenues, 9 cross streets downtown; 4 shore avenues
// and 6 shore roads at the beach; 2 mountain roads and 4 climbs in the peaks.
export const AVENUES = [300, 900, 1500, 2100, 2700, 3300, 3900, 4500, 5100, 5700];
export const STREETS = [1700, 2150, 2600, 3050, 3500, 3950, 4400, 4850, 5250];
export const BEACH_AVENUES = [6400, 7200, 8000, 8800];
export const BEACH_ROADS = [2000, 2600, 3000, 4000, 4400, 5000];
export const PEAK_ROADS = [450, 900];
export const PEAK_CLIMBS = [1500, 3600, 4500, 8400];
// Through-roads with a gate: downtown streets 2600/4400 reach the beach,
// downtown avenues 1500/4500 climb into the peaks.
export const BEACH_GATE_YS = [2600, 4400];
export const PEAK_GATE_XS = [1500, 4500];
export const PEAK_BOUNDARY_Y = 1350;
export const BEACH_BOUNDARY_X = 6000;

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

export function districtAt(x, y) {
  if (y < PEAK_BOUNDARY_Y) return 2;
  if (x >= BEACH_BOUNDARY_X) return 1;
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
  const { buildings, roads, trees, gates, walls, shops, activitySpots, graph } = data;
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
  // Sidewalks first (a pale strip wider than the road), then the road itself
  // on top, so every street reads as asphalt with a pavement on both sides.
  const walkMat = lambert('#6b7280');
  const roadMat = lambert('#23272f');
  const lineMat = basic('#fde047', { transparent: true, opacity: 0.45 });
  for (const r of roads) {
    if (r.vertical) meshes.push(groundPlane(r.w + 40, r.h, walkMat, r.x + r.w / 2, r.y + r.h / 2, 0.55));
    else meshes.push(groundPlane(r.w, r.h + 40, walkMat, r.x + r.w / 2, r.y + r.h / 2, 0.55));
  }
  for (const r of roads) {
    meshes.push(groundPlane(r.w, r.h, roadMat, r.x + r.w / 2, r.y + r.h / 2, 0.6));
    if (r.vertical) meshes.push(groundPlane(3, r.h * 0.92, lineMat, r.x + r.w / 2, r.y + r.h / 2, 0.7));
    else meshes.push(groundPlane(r.w * 0.92, 3, lineMat, r.x + r.w / 2, r.y + r.h / 2, 0.7));
  }
  // Zebra crossings: one striped square per intersection (a canvas texture
  // with white bars, so each crossing is a single mesh, not a dozen).
  const zebraCanvas = document.createElement('canvas');
  zebraCanvas.width = 64;
  zebraCanvas.height = 64;
  const zctx = zebraCanvas.getContext('2d');
  zctx.clearRect(0, 0, 64, 64);
  zctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  for (let i = 4; i < 64; i += 12) {
    zctx.fillRect(i, 2, 6, 60);
    zctx.fillRect(2, i, 60, 6);
  }
  const zebraTex = new THREE.CanvasTexture(zebraCanvas);
  const zebraMat = new THREE.MeshBasicMaterial({ map: zebraTex, transparent: true, opacity: 0.8 });
  if (graph) {
    for (const n of graph.nodes) {
      if (!n.crossing) continue;
      meshes.push(groundPlane(76, 76, zebraMat, n.x, n.y, 0.75));
    }
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

  // District barrier walls: solid concrete, always present (only the gates
  // in them ever open). Drawn as long grey slabs along each border.
  for (const w of walls) {
    const m = new THREE.Mesh(unitBox, lambert('#52525b'));
    m.scale.set(w.w, 34, w.h);
    m.position.set(w.x + w.w / 2, 17, w.y + w.h / 2);
    meshes.push(m);
    const cap = new THREE.Mesh(unitBox, lambert('#f59e0b'));
    cap.scale.set(w.w, 3, w.h + 2);
    cap.position.set(w.x + w.w / 2, 35, w.y + w.h / 2);
    meshes.push(cap);
  }

  // Gates: a staffed checkpoint in each through-road — two posts, a red
  // barrier bar across the gap, and a guard booth beside it. Only the bar
  // is tagged with the district, so the renderer hides just the bar when
  // the district unlocks and the gate stands open; posts and booth stay.
  for (const g of gates) {
    const vertical = g.h > g.w;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    // Barrier bar across the gap (tagged: hidden once unlocked).
    const bar = new THREE.Mesh(unitBox, lambert('#dc2626'));
    bar.scale.set(g.w, 26, g.h);
    bar.position.set(cx, 13, cy);
    bar.userData.gateDistrict = g.district;
    meshes.push(bar);
    const stripe = new THREE.Mesh(unitBox, basic('#f8fafc'));
    stripe.scale.set(vertical ? 4 : g.w, 6, vertical ? g.h : 4);
    stripe.position.set(cx, 28, cy);
    stripe.userData.gateDistrict = g.district;
    meshes.push(stripe);
    // Posts at both ends of the gap.
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(unitBox, lambert('#f59e0b'));
      if (vertical) {
        post.scale.set(12, 40, 12);
        post.position.set(cx, 20, cy + s * (g.h / 2 + 4));
      } else {
        post.scale.set(12, 40, 12);
        post.position.set(cx + s * (g.w / 2 + 4), 20, cy);
      }
      meshes.push(post);
    }
    // Guard booth beside the gate.
    const booth = new THREE.Mesh(unitBox, lambert('#0ea5e9'));
    booth.scale.set(44, 30, 44);
    if (vertical) booth.position.set(cx + 52, 15, cy + 56);
    else booth.position.set(cx + 56, 15, cy - 52);
    meshes.push(booth);
    const boothRoof = new THREE.Mesh(unitBox, lambert('#155e75'));
    boothRoof.scale.set(48, 4, 48);
    boothRoof.position.set(booth.position.x, 32, booth.position.z);
    meshes.push(boothRoof);
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

  // ---- Barrier walls + gates (v3) -------------------------------------
  // The wall runs the whole length of each district border; the only gaps
  // are the gate openings on the through-roads. Wall pieces are solids,
  // gates are separate so they can open when the district unlocks.
  const gates = [];
  for (const gy of BEACH_GATE_YS) {
    gates.push({ x: BEACH_BOUNDARY_X - 12, y: gy - 32, w: 24, h: 64, district: 1, label: 'Beach Gate' });
  }
  for (const gx of PEAK_GATE_XS) {
    gates.push({ x: gx - 32, y: PEAK_BOUNDARY_Y - 12, w: 64, h: 24, district: 2, label: 'Peaks Gate' });
  }
  const walls = [];
  function wallRun(district, horizontal, fixed, from, to, gaps) {
    // gaps: sorted [start, end] intervals along the run that stay open.
    let cur = from;
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [gs, ge] of sorted) {
      if (gs > cur) walls.push(horizontal
        ? { x: cur, y: fixed - 12, w: gs - cur, h: 24, district }
        : { x: fixed - 12, y: cur, w: 24, h: gs - cur, district });
      cur = Math.max(cur, ge);
    }
    if (to > cur) walls.push(horizontal
      ? { x: cur, y: fixed - 12, w: to - cur, h: 24, district }
      : { x: fixed - 12, y: cur, w: 24, h: to - cur, district });
  }
  // Beach wall: x = 6000, y 1350..5400, gaps at the two through streets.
  wallRun(1, false, BEACH_BOUNDARY_X, PEAK_BOUNDARY_Y, WORLD_HEIGHT,
    BEACH_GATE_YS.map((gy) => [gy - 32, gy + 32]));
  // Peaks wall: y = 1350, x 0..9600, gaps at the two through avenues.
  wallRun(2, true, PEAK_BOUNDARY_Y, 0, WORLD_WIDTH,
    PEAK_GATE_XS.map((gx) => [gx - 32, gx + 32]));
  for (const w of walls) solids.push(w);

  // ---- Roads -----------------------------------------------------------
  // City grid: 10 avenues x 9 streets.
  for (const x of AVENUES) roads.push({ x: x - 32, y: PEAK_BOUNDARY_Y, w: 64, h: WORLD_HEIGHT - PEAK_BOUNDARY_Y, vertical: true });
  for (const y of STREETS) roads.push({ x: 0, y: y - 32, w: BEACH_BOUNDARY_X, h: 64, vertical: false });
  // Beach: shore avenues + shore roads (through-roads 2600/4400 continue).
  for (const x of BEACH_AVENUES) roads.push({ x: x - 32, y: PEAK_BOUNDARY_Y, w: 64, h: WORLD_HEIGHT - PEAK_BOUNDARY_Y, vertical: true });
  for (const y of BEACH_ROADS) roads.push({ x: BEACH_BOUNDARY_X, y: y - 32, w: 9200 - BEACH_BOUNDARY_X, h: 64, vertical: false });
  // Peaks: two mountain roads; the y=450 road is split around the lake.
  roads.push({ x: 0, y: 450 - 32, w: 6500, h: 64, vertical: false });
  roads.push({ x: 8100, y: 450 - 32, w: WORLD_WIDTH - 8100, h: 64, vertical: false });
  roads.push({ x: 0, y: 900 - 32, w: WORLD_WIDTH, h: 64, vertical: false });
  for (const x of PEAK_CLIMBS) roads.push({ x: x - 32, y: 0, w: 64, h: PEAK_BOUNDARY_Y, vertical: true });

  // The road graph: intersections, lanes, sidewalks, zebra crossings.
  const gateNodes = [
    ...BEACH_GATE_YS.map((gy) => ({ x: BEACH_BOUNDARY_X, y: gy, district: 1 })),
    ...PEAK_GATE_XS.map((gx) => ({ x: gx, y: PEAK_BOUNDARY_Y, district: 2 })),
  ];
  const graph = buildRoadGraph(roads, gateNodes, districtAt);

  // ---- City blocks: buildings fill the blocks between streets ----------
  const cityColors = ['#3f4a5a', '#4a3b52', '#37474f', '#4e342e', '#2f3e46', '#5d4037'];
  for (let bx = 0; bx < AVENUES.length - 1; bx += 1) {
    for (let by = 0; by < STREETS.length - 1; by += 1) {
      // Blocks are inset 56 from the street centrelines (v3): the road is
      // 32 half-wide and the sidewalk runs 32..52, so buildings must start
      // past 52 or they would swallow the pavement NPCs walk on.
      const x0 = AVENUES[bx] + 56;
      const y0 = STREETS[by] + 56;
      const x1 = AVENUES[bx + 1] - 56;
      const y1 = STREETS[by + 1] - 56;
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

  // Beach: hotels in the blocks between the shore roads, palms on the sand.
  const beachColors = ['#f59e0b', '#0ea5e9', '#ec4899', '#f8fafc'];
  let hi = 0;
  for (const hx of [6500, 7300, 8100]) {
    for (const hy of [1700, 2750, 4150]) {
      const b = { x: hx, y: hy, w: 120, h: 160, color: beachColors[hi % beachColors.length], district: 1, tall: false };
      hi += 1;
      buildings.push(b);
      solids.push(b);
    }
  }
  for (let i = 0; i < 26; i += 1) trees.push({ x: rng.range(8900, 9150), y: rng.range(1500, 5300), kind: 'palm' });

  // Peaks: cabins, pines and rocks (cabins keep clear of the lake).
  const lake = WATER_RECTS[1];
  for (let i = 0; i < 8; i += 1) {
    const b = { x: rng.range(200, 9400), y: rng.range(120, 1250), w: 100, h: 80, color: '#6b4f2a', district: 2, tall: false };
    if (rectsOverlap(b, { x: lake.x - 60, y: lake.y - 60, w: lake.w + 120, h: lake.h + 120 })) continue;
    // Cabins must not sit on a road or its sidewalk, or pedestrians walking
    // the pavement would have to slide around (or through) them.
    if (roads.some((r) => rectsOverlap(b, { x: r.x - 56, y: r.y - 56, w: r.w + 112, h: r.h + 112 }))) continue;
    buildings.push(b);
    solids.push(b);
  }
  for (let i = 0; i < 60; i += 1) trees.push({ x: rng.range(80, 9500), y: rng.range(60, 1300), kind: 'pine' });

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

  // Which locked district's barrier (wall or closed gate) is this point
  // pushing against, if any? 0 = none. Used for the "locked" message.
  function barrierDistrictAt(x, y, pad, unlocked) {
    if (!unlocked) return 0;
    for (const w of walls) {
      if (unlocked[w.district]) continue;
      if (x > w.x - pad && x < w.x + w.w + pad && y > w.y - pad && y < w.y + w.h + pad) return w.district;
    }
    for (const g of gates) {
      if (unlocked[g.district]) continue;
      if (x > g.x - pad && x < g.x + g.w + pad && y > g.y - pad && y < g.y + g.h + pad) return g.district;
    }
    return 0;
  }

  function randomRoadPoint(district) {
    const p = graph.randomLanePoint(rng, [district]);
    return p.point;
  }

  function randomSidewalkPoint(district) {
    return graph.randomSidewalkPoint(rng, [district]);
  }

  function nearestRoadPoint(x, y) {
    return graph.nearestLanePoint(x, y);
  }

  const world = {
    buildings, roads, trees, solids, gates, walls, shops, activitySpots, graph,
    collides, collidesRect, barrierDistrictAt,
    randomRoadPoint, randomSidewalkPoint, nearestRoadPoint,
  };
  world.meshes = buildMeshes(world);
  return world;
}
