// Neon Bay — the map: three districts, streets, buildings, the airport,
// the beach and the peaks, plus the collision tests every system uses.
// Districts 1 and 2 are fenced off by full barrier walls until missions
// unlock them; the only way through is a staffed gate on a through-road.
//
// v4.1 — BIG map AND correct scale, both at once, LITERAL metres:
// * 1 world unit = 1 metre. Leo Vance is 1.8 m tall (player.js builds the
//   figure at 1.8; config CHARACTER_HEIGHT = 1.8). Every size below is in
//   metres: house 3 / 6.5 m, shophouse 9 m, mid-rise 15-25 m, tower
//   40-63 m, door 2.1 m, window ~1.2 m (facade tile 9.6 x 19.2 m in
//   textures.js), tree 4-8 m, palm 10-15 m, lamp 6 m, wall 3 m.
// * The map stays 9600x5400 (9.6 x 5.4 km) and the road CENTRELINES stay
//   where v3 put them, so missions, shops, barriers, GPS and the road graph
//   keep working. What changes is the DENSITY: Builder B's roadgraph
//   (prepareRoads) narrows every road to 7 m residential (16 m arterial
//   ring), densifies the grid to ~150 m blocks, and adds the square ring
//   road — buildWorld enumerates its cells from the FINAL road list (after
//   buildRoadGraph mutates it), so buildings fill the real blocks, never
//   the v3 grid. Building faces sit 6 m from a residential centreline and
//   10.5 m from an arterial one (road half + 2.5 m sidewalk).
// * Mountains are a backdrop range NORTH of the map edge (centres
//   y <= -600, bases clear of every road) — real 500-800 m peaks, hazy in
//   the fog, never pyramids looming over downtown (see data.js).
// * Performance: buildings, roofs, doors, trees, lamps and traffic lights
//   are all InstancedMesh (one draw call per size/material group, trees
//   split into 6 map sectors so the frustum can cull them), materials are
//   shared, facades are canvas textures. Collision uses a 150 m spatial
//   hash over the solids, not a linear scan.
//
// buildWorld also returns `meshes` — static THREE.Object3D meshes for the
// whole world. The renderer adds them to the scene once. Uses the global
// THREE (no import); geometry and materials are shared wherever possible.
import { AIRPORT, DISTRICT_RECTS, ROAD_ART_HALF, ROAD_RES_HALF, SAFE_HOUSE, SIDEWALK_WIDTH, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import {
  ACTIVITY_SPOTS, MOUNTAIN_PEAKS, NEON_SIGNS, PEAK_HOMES, PEAK_POIS,
  SHOP_DEFS, SIDE_QUEST_PLACES, STORY_MISSIONS, WORSHIP_PLACES,
} from './data.js';
import { RING, buildRoadGraph } from './roadgraph.js';
import {
  asphaltMat, concreteMat, facadeMat, grassMat, neonSignMat, nightLightMat, shopSignMat,
  rockMat, roofMat, sandMat, sidewalkMat, waterMat,
} from './textures.js';
import { addStrings, t } from './i18n.js';

// Gate labels, translated through the i18n system (default English).
addStrings('en', {
  'gate.beach': 'Beach Gate',
  'gate.peaks': 'Peaks Gate',
  'gate.ring.beach': 'Ring Road Gate',
  'gate.ring.peaks': 'Ring Road Gate',
});
addStrings('id', {
  'gate.beach': 'Gerbang Pantai',
  'gate.peaks': 'Gerbang Pegunungan',
  'gate.ring.beach': 'Gerbang Ring Road',
  'gate.ring.peaks': 'Gerbang Ring Road',
});

// v3 street layout: 10 avenues, 9 cross streets downtown; 4 shore avenues
// and 6 shore roads at the beach; 2 mountain roads and 4 climbs in the peaks.
// (Roadgraph densifies these to ~150 m blocks and adds the ring road.)
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

// --- Realistic scale: 1 unit = 1 metre, Leo = 1.8 m. -------------------
export const LEO_HEIGHT_UNITS = 1.8;
export const UNITS_PER_METER = 1;
/** Metres -> world units (identity at the literal metre scale). */
export const M = (meters) => meters;
// Building heights (metres): house 3 / 6.5, shophouse 9, mid-rise 15-25,
// downtown slab tower 40-63, beach hotel 9-20.
const HOUSE_H = [3, 6.5];
const MID_H = [15, 19, 22, 25];
const BEACH_H = [9, 12, 15, 18, 20];
const TOWER_H = [40, 48, 56, 63];
// Quantized footprints (w x d, metres) — a small discrete set, so the
// instanced building groups stay bounded no matter how many buildings.
const HOUSE_F = [[14, 11], [18, 13]];
const MID_F = [[24, 20], [30, 22]];
const TOWER_F = [[30, 24], [36, 28]];
// How far a building face sits from a road centreline: road half +
// 2.5 m sidewalk. Street trees sit on the sidewalk's outer edge.
export const RES_INSET = ROAD_RES_HALF + SIDEWALK_WIDTH; // 3.5 + 2.5 = 6
export const ART_INSET = ROAD_ART_HALF + SIDEWALK_WIDTH; // 8 + 2.5 = 10.5
export const BUILD_INSET = RES_INSET;
export const TREE_OFFSET_RES = ROAD_RES_HALF + SIDEWALK_WIDTH - 0.5; // 5.5
export const TREE_OFFSET_ART = ROAD_ART_HALF + SIDEWALK_WIDTH - 0.5; // 10
export const TREE_OFFSET = TREE_OFFSET_RES;

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

/** Build the static 3D meshes for the world data. Returns THREE.Object3D[]. */
function buildMeshes(data) {
  const { buildings, roads, trees, gates, walls, shops, activitySpots, graph, parks } = data;
  const meshes = [];
  const geoCache = new Map();
  const matCache = new Map();
  // Meshes whose instance count / visibility the graphics-quality hook
  // scales (setVisualDensity): tree sectors, lamps, neon signs.
  const densityMeshes = { trees: [], lamps: [], signs: [] };

  // v3: MeshStandardMaterial everywhere (semi-realistic light response),
  // cached by colour so the whole city shares a handful of materials.
  function std(color, opts = {}) {
    const key = `std-${color}-${opts.transparent ? 't' : 'o'}-${opts.opacity ?? 1}`;
    if (!matCache.has(key)) {
      matCache.set(key, new THREE.MeshStandardMaterial({
        color, roughness: 0.9, metalness: 0,
        transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
      }));
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
  // scaleUV tiles a repeating texture once per 8 m instead of stretching
  // one copy across the whole plane.
  function groundPlane(w, d, material, x, z, y = 0, scaleUV = false) {
    const key = `plane-${w}x${d}-${scaleUV ? 'uv' : 'flat'}`;
    if (!geoCache.has(key)) {
      const geo = new THREE.PlaneGeometry(w, d);
      if (scaleUV) {
        const uv = geo.attributes.uv;
        for (let i = 0; i < uv.count; i += 1) uv.setXY(i, uv.getX(i) * (w / 8), uv.getY(i) * (d / 8));
      }
      geoCache.set(key, geo);
    }
    const m = new THREE.Mesh(geoCache.get(key), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  }

  // Shared dummy for composing instance matrices.
  const dummy = new THREE.Object3D();
  function makeInstanced(geo, mat, items, culled = false) {
    if (items.length === 0) return null;
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(it.sx, it.sy, it.sz);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (it.color) im.setColorAt(i, new THREE.Color(it.color));
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    if (culled) {
      // three r149 has no InstancedMesh.computeBoundingSphere (it arrived
      // in r156) — calling it crashes the game. Compute the sphere by hand
      // from the instance positions instead: r149's Frustum.intersectsObject
      // uses object.boundingSphere when it is non-null, so this also keeps
      // frustum culling working. +20 m slack covers the instance sizes.
      // (The Node count stub had computeBoundingSphere faked, which is why
      // this only surfaced in the real browser.)
      // Centre = mean of the instance positions; radius = farthest
      // instance from that centre, plus slack for instance sizes.
      const centre = new THREE.Vector3();
      for (const it of items) {
        centre.x += it.x;
        centre.y += it.y;
        centre.z += it.z;
      }
      centre.divideScalar(Math.max(1, items.length));
      let radius = 0;
      for (const it of items) {
        const dx = it.x - centre.x;
        const dy = it.y - centre.y;
        const dz = it.z - centre.z;
        radius = Math.max(radius, Math.sqrt(dx * dx + dy * dy + dz * dz));
      }
      im.boundingSphere = new THREE.Sphere(centre, radius + 20);
      im.frustumCulled = true;
    } else {
      im.frustumCulled = false;
    }
    return im;
  }

  // Merged ground quads: one draw call for ALL sidewalks, one for ALL
  // roads, one for ALL arterial medians — instead of a mesh per road.
  // A quad is { x0, y0, x1, y1, z00, z10, z11, z01 }: corner heights, so
  // viaduct ramps and hill climbs can slope inside the same mesh.
  function buildMergedMesh(quads, material) {
    if (quads.length === 0) return null;
    const pos = new Float32Array(quads.length * 12);
    const uv = new Float32Array(quads.length * 8);
    const idx = new Uint32Array(quads.length * 6);
    quads.forEach((q, i) => {
      const o = i * 12;
      pos[o] = q.x0; pos[o + 1] = q.z00; pos[o + 2] = q.y0;
      pos[o + 3] = q.x1; pos[o + 4] = q.z10; pos[o + 5] = q.y0;
      pos[o + 6] = q.x1; pos[o + 7] = q.z11; pos[o + 8] = q.y1;
      pos[o + 9] = q.x0; pos[o + 10] = q.z01; pos[o + 11] = q.y1;
      const u = (q.x1 - q.x0) / 8;
      const v = (q.y1 - q.y0) / 8;
      const uo = i * 8;
      uv[uo] = 0; uv[uo + 1] = 0;
      uv[uo + 2] = u; uv[uo + 3] = 0;
      uv[uo + 4] = u; uv[uo + 5] = v;
      uv[uo + 6] = 0; uv[uo + 7] = v;
      const io = i * 6;
      const vo = i * 4;
      idx[io] = vo; idx[io + 1] = vo + 1; idx[io + 2] = vo + 2;
      idx[io + 3] = vo; idx[io + 4] = vo + 2; idx[io + 5] = vo + 3;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    return mesh;
  }
  function quad(x0, y0, x1, y1, z) {
    return { x0, y0, x1, y1, z00: z, z10: z, z11: z, z01: z };
  }

  // District ground: concrete slabs downtown, sand at the beach, grass and
  // dirt in the peaks — each a repeating procedural texture, not flat colour.
  const groundMats = [concreteMat(), sandMat(), grassMat()];
  for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
    const r = DISTRICT_RECTS[i];
    meshes.push(groundPlane(r.w, r.h, groundMats[i], r.x + r.w / 2, r.y + r.h / 2, 0, true));
  }
  // Water (slightly above ground so it never z-fights).
  for (const w of WATER_RECTS) {
    meshes.push(groundPlane(w.w, w.h, waterMat(), w.x + w.w / 2, w.y + w.h / 2, 0.02));
  }
  // Pocket parks: a grass patch on the concrete, so a park reads as a park.
  for (const p of parks || []) {
    meshes.push(groundPlane(p.w, p.h, grassMat(), p.x + p.w / 2, p.y + p.h / 2, 0.03, true));
  }

  // Roads: sidewalks (road + 2.5 m each side), asphalt, and the 1.5 m
  // median on arterials only — all merged into 3 meshes. Elevated roads
  // (viaduct deck, hill climbs) slope inside the merged quads: the deck
  // sits at deckZ, the hill follows its sine profile, with 50 m ramps at
  // the viaduct ends so cars climb onto the deck instead of stepping up.
  const walkMat = sidewalkMat();
  const roadMat = asphaltMat();
  const medianMat = basic('#f8fafc', { transparent: true, opacity: 0.7 });
  const walkQuads = [];
  const roadQuads = [];
  const medianQuads = [];
  function hillProfile(r, y) {
    const span = r.to - r.from;
    return r.hillHeight * Math.sin((Math.PI * (r.to - y)) / span);
  }
  for (const r of roads) {
    const cx = r.vertical ? r.x + r.w / 2 : 0;
    const cy = !r.vertical ? r.y + r.h / 2 : 0;
    const len = r.vertical ? r.h : r.w;
    const start = r.vertical ? r.y : r.x;
    const end = start + len;
    if (r.elevated === 'hill') {
      // 16 sloped strips following the sine profile.
      const N = 16;
      for (let i = 0; i < N; i += 1) {
        const y0 = r.from + ((r.to - r.from) * i) / N;
        const y1 = r.from + ((r.to - r.from) * (i + 1)) / N;
        const z0 = hillProfile(r, y0);
        const z1 = hillProfile(r, y1);
        walkQuads.push({ x0: cx - r.w / 2 - 2.5, y0, x1: cx + r.w / 2 + 2.5, y1, z00: z0 + 0.03, z10: z0 + 0.03, z11: z1 + 0.03, z01: z1 + 0.03 });
        roadQuads.push({ x0: cx - r.w / 2, y0, x1: cx + r.w / 2, y1, z00: z0 + 0.04, z10: z0 + 0.04, z11: z1 + 0.04, z01: z1 + 0.04 });
      }
    } else if (r.elevated === 'viaduct') {
      const dz = r.deckZ;
      const ramp = 50;
      // Pieces along the road: [start, from-ramp] flat, ramp up, deck,
      // ramp down, [to+ramp, end] flat. Sidewalk mirrors the road.
      const pieces = [];
      if (r.from - ramp > start) pieces.push([start, r.from - ramp, 0, 0]);
      pieces.push([Math.max(start, r.from - ramp), r.from, 0, dz]);
      pieces.push([r.from, r.to, dz, dz]);
      pieces.push([r.to, Math.min(end, r.to + ramp), dz, 0]);
      if (r.to + ramp < end) pieces.push([r.to + ramp, end, 0, 0]);
      for (const [a, b, za, zb] of pieces) {
        walkQuads.push({ x0: cx - r.w / 2 - 2.5, y0: a, x1: cx + r.w / 2 + 2.5, y1: b, z00: za + 0.03, z10: za + 0.03, z11: zb + 0.03, z01: zb + 0.03 });
        roadQuads.push({ x0: cx - r.w / 2, y0: a, x1: cx + r.w / 2, y1: b, z00: za + 0.04, z10: za + 0.04, z11: zb + 0.04, z01: zb + 0.04 });
      }
    } else if (r.vertical) {
      walkQuads.push(quad(r.x - 2.5, r.y, r.x + r.w + 2.5, r.y + r.h, 0.03));
      roadQuads.push(quad(r.x, r.y, r.x + r.w, r.y + r.h, 0.04));
      if (r.type === 'arterial') medianQuads.push(quad(cx - 0.75, r.y, cx + 0.75, r.y + r.h, 0.05));
    } else {
      // Horizontal roads sit 1 mm higher than vertical ones, so the two
      // asphalt layers never z-fight where they cross.
      walkQuads.push(quad(r.x, r.y - 2.5, r.x + r.w, r.y + r.h + 2.5, 0.031));
      roadQuads.push(quad(r.x, r.y, r.x + r.w, r.y + r.h, 0.041));
      if (r.type === 'arterial') medianQuads.push(quad(r.x, cy - 0.75, r.x + r.w, cy + 0.75, 0.051));
    }
  }
  const walkMesh = buildMergedMesh(walkQuads, walkMat);
  if (walkMesh) meshes.push(walkMesh);
  const roadMesh = buildMergedMesh(roadQuads, roadMat);
  if (roadMesh) meshes.push(roadMesh);
  const medianMesh = buildMergedMesh(medianQuads, medianMat);
  if (medianMesh) meshes.push(medianMesh);

  // Zebra crossings: one striped square per at-grade intersection (a
  // canvas texture with white bars). A single InstancedMesh covers every
  // crossing in the city in 1 draw call instead of one mesh per crossing.
  // Stripes run in ONE direction only (parallel bars, ~0.75 m wide with
  // 0.75 m gaps) — a real crosswalk is parallel stripes, not a grid.
  const zebraCanvas = document.createElement('canvas');
  zebraCanvas.width = 64;
  zebraCanvas.height = 64;
  const zctx = zebraCanvas.getContext('2d');
  zctx.clearRect(0, 0, 64, 64);
  zctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  // Parallel bars only: 6 px wide, 12 px pitch, starting 4 px in, so the
  // stripes run in a single direction with ~0.75 m gaps between them.
  for (let x = 4; x < 64; x += 12) {
    zctx.fillRect(x, 2, 6, 60);
  }
  const zebraTex = new THREE.CanvasTexture(zebraCanvas);
  const zebraMat = new THREE.MeshBasicMaterial({ map: zebraTex, transparent: true, opacity: 0.8 });
  if (graph) {
    const zebraGeo = new THREE.PlaneGeometry(8, 8);
    zebraGeo.rotateX(-Math.PI / 2);
    const spots = graph.nodes.filter((n) => n.crossing && n.level === 0);
    const zebraMesh = makeInstanced(zebraGeo, zebraMat, spots.map((n) => ({
      x: n.x, y: 0.06, z: n.y, sx: 1, sy: 1, sz: 1,
    })));
    if (zebraMesh) meshes.push(zebraMesh);
  }

  // Buildings, v4.1: INSTANCED, in literal metres. One InstancedMesh per
  // (facade variant, quantized w/h/d) — footprints and heights come from
  // small discrete sets, so ~3000 buildings collapse into a few dozen draw
  // calls. Facade materials are white-based (facadeMat('#ffffff', variant))
  // and each instance carries its own tint via setColorAt. Facade UVs tile
  // every 9.6 m horizontally and 19.2 m vertically (textures.js), so a
  // window stays ~1.2 x 1.0 m at any building size.
  const FACADE_TILE_U = 9.6;
  const FACADE_TILE_V = 19.2;
  const buildingGeoCache = new Map();
  function buildingGeo(w, h, d) {
    const key = `${w}x${h}x${d}`;
    if (buildingGeoCache.has(key)) return buildingGeoCache.get(key);
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    // BoxGeometry faces, 4 verts each: +x, -x, +y, -y, +z, -z.
    const faceDims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f += 1) {
      const [du, dv] = faceDims[f];
      for (let v = 0; v < 4; v += 1) {
        const i = f * 4 + v;
        uv.setXY(i, uv.getX(i) * (du / FACADE_TILE_U), uv.getY(i) * (dv / FACADE_TILE_V));
      }
    }
    buildingGeoCache.set(key, g);
    return g;
  }
  // Facade variant by building kind: houses get the plaster 'house' front,
  // towers the dense glass 'tower' curtain, the rest cycle brick/concrete/
  // glass by hash (variant indices match FACADE_VARIANTS in textures.js).
  const VARIANT = { house: 3, tower: 4 };
  const bGroups = new Map();
  const flatRoofs = [];
  const pyramidRoofs = [];
  const doors = [];
  for (const b of buildings) {
    const h = b.height;
    const variant = VARIANT[b.kind] !== undefined ? VARIANT[b.kind]
      : Math.floor(hash01(b.y, b.x) * 3);
    const key = `${variant}|${b.w}x${h}x${b.h}`;
    if (!bGroups.has(key)) bGroups.set(key, { variant, w: b.w, h, d: b.h, items: [] });
    bGroups.get(key).items.push({
      x: b.x + b.w / 2, y: h / 2, z: b.y + b.h / 2, sx: 1, sy: 1, sz: 1, color: b.color,
    });
    if (b.kind === 'house' || b.kind === 'cabin') {
      pyramidRoofs.push({
        x: b.x + b.w / 2, y: h + 0.8, z: b.y + b.h / 2,
        sx: b.w * 0.72, sy: 1.6, sz: b.h * 0.72, ry: Math.PI / 4, color: b.roofColor || '#7c2d12',
      });
    } else {
      flatRoofs.push({
        x: b.x + b.w / 2, y: h + 0.15, z: b.y + b.h / 2, sx: b.w + 0.2, sy: 0.3, sz: b.h + 0.2,
      });
    }
    // A real front door, ~2.1 m tall, on the south face.
    if (b.kind === 'house' || b.kind === 'cabin' || b.kind === 'shop') {
      doors.push({ x: b.x + b.w / 2, y: 1.05, z: b.y + b.h + 0.15, sx: 1, sy: 2.1, sz: 0.3 });
    }
  }
  for (const g of bGroups.values()) {
    const im = makeInstanced(buildingGeo(g.w, g.h, g.d), facadeMat('#ffffff', g.variant), g.items);
    if (im) meshes.push(im);
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const flatRoofMesh = makeInstanced(unitBox, roofMat(), flatRoofs);
  if (flatRoofMesh) meshes.push(flatRoofMesh);
  const pyramidGeo = new THREE.ConeGeometry(1, 1, 4);
  // White base so each roof's instanceColor shows true (a coloured base
  // would multiply and muddy it).
  const pyramidMesh = makeInstanced(pyramidGeo, std('#ffffff'), pyramidRoofs);
  if (pyramidMesh) meshes.push(pyramidMesh);
  const doorMesh = makeInstanced(unitBox, std('#5b3a1e'), doors);
  if (doorMesh) meshes.push(doorMesh);

  // Neon signs: one glowing plane per sign, on the south face of a tall
  // building (towers downtown, hotels at the beach), ~62% up the facade.
  // Text + colour cycle NEON_SIGNS (data.js); the material glows at night
  // (neonSignMat, textures.js). Capped so the city glitters, not strobes.
  // Sign texts are in-world proper-noun signage, so they stay as-is in
  // every language (i18n contract: proper nouns are not translated).
  const signBuildings = buildings.filter((b) => (b.kind === 'tower' || (b.district === 1 && b.kind === 'mid')) && b.height >= 15);
  let signCount = 0;
  for (const b of signBuildings) {
    if (signCount >= 24) break;
    if (hash01(b.x, b.y) > 0.62) continue;
    const sign = NEON_SIGNS[signCount % NEON_SIGNS.length];
    signCount += 1;
    const signW = Math.min(b.w * 0.8, 12);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(signW, 2), neonSignMat(sign.text, sign.color));
    plane.position.set(b.x + b.w / 2, b.height * 0.62, b.y + b.h + 0.15);
    meshes.push(plane);
    densityMeshes.signs.push(plane);
  }

  // Places of worship: small bespoke meshes on top of their instanced hall
  // (the hall itself is a normal 'worship' building above). Dome + minarets
  // for a mosque, tower + cross for a church, tiered roofs for a temple.
  // All sizes in metres: hall 6 m, minarets 9 m, church tower 9 m.
  for (const b of buildings) {
    if (b.kind !== 'worship') continue;
    const cx = b.x + b.w / 2;
    const cz = b.y + b.h / 2;
    const h = b.height;
    if (b.worship === 'mosque') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(Math.min(b.w, b.h) * 0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), std('#0d9488'));
      dome.position.set(cx, h, cz);
      meshes.push(dome);
      for (const s of [-1, 1]) {
        const min = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, h * 1.5, 8), std('#f8fafc'));
        min.position.set(cx + s * (b.w / 2 - 0.5), (h * 1.5) / 2, b.y + b.h + 0.4);
        meshes.push(min);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1, 8), std('#f59e0b'));
        tip.position.set(cx + s * (b.w / 2 - 0.5), h * 1.5 + 0.5, b.y + b.h + 0.4);
        meshes.push(tip);
      }
    } else if (b.worship === 'church') {
      const tower = new THREE.Mesh(unitBox, std('#f8fafc'));
      tower.scale.set(1.4, h * 1.5, 1.4);
      tower.position.set(cx, (h * 1.5) / 2, b.y + b.h + 0.5);
      meshes.push(tower);
      const crossV = new THREE.Mesh(unitBox, std('#f59e0b'));
      crossV.scale.set(0.25, 1.4, 0.25);
      crossV.position.set(cx, h * 1.5 + 0.9, b.y + b.h + 0.5);
      meshes.push(crossV);
      const crossH = new THREE.Mesh(unitBox, std('#f59e0b'));
      crossH.scale.set(0.9, 0.25, 0.25);
      crossH.position.set(cx, h * 1.5 + 1.1, b.y + b.h + 0.5);
      meshes.push(crossH);
    } else {
      // temple: two tiered roofs shrinking upward, red + gold.
      for (let tier = 0; tier < 2; tier += 1) {
        const tw = b.w * (0.9 - tier * 0.25);
        const td = b.h * (0.9 - tier * 0.25);
        const roof = new THREE.Mesh(pyramidGeo, std(tier === 0 ? '#b91c1c' : '#f59e0b'));
        roof.scale.set(tw * 0.72, 1.4, td * 0.72);
        roof.rotation.y = Math.PI / 4;
        roof.position.set(cx, h + 0.7 + tier * 1.3, cz);
        meshes.push(roof);
      }
    }
  }

  // Trees, v4.1: INSTANCED and SECTOR-SPLIT — two trunk meshes (normal +
  // palm) and one crown mesh per kind (pine cone, oak sphere, park sphere,
  // palm sphere), per map sector (3 x 2). Each sector's meshes carry their
  // own bounding sphere and frustumCulled = true, so the renderer only
  // draws the sectors near the camera instead of ~4000 trees at once.
  // Sizes are realistic in metres: pine/oak/park 4-8 m, coconut palm
  // 10-15 m, trunk ~0.25 m thick, crown radius 2-4 m.
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const palmTrunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 1, 6);
  palmTrunkGeo.translate(0, 0.5, 0);
  const pineCrownGeo = new THREE.ConeGeometry(1, 1, 6);
  pineCrownGeo.translate(0, 0.5, 0);
  const sphereCrownGeo = new THREE.SphereGeometry(1, 6, 4);
  sphereCrownGeo.translate(0, 0.5, 0);
  const trunkMat = std('#78350f');
  const pineMat = std('#166534');
  const palmMat = std('#15803d');
  const oakMat = std('#2d6a2e');
  const parkMat = std('#22c55e');
  const SECTORS = [
    { x0: 0, x1: 3200, y0: 0, y1: 2700 },
    { x0: 3200, x1: 6400, y0: 0, y1: 2700 },
    { x0: 6400, x1: 9600, y0: 0, y1: 2700 },
    { x0: 0, x1: 3200, y0: 2700, y1: 5400 },
    { x0: 3200, x1: 6400, y0: 2700, y1: 5400 },
    { x0: 6400, x1: 9600, y0: 2700, y1: 5400 },
  ];
  for (const sec of SECTORS) {
    const inSec = trees.filter((tr) => tr.x >= sec.x0 && tr.x < sec.x1 && tr.y >= sec.y0 && tr.y < sec.y1);
    if (inSec.length === 0) continue;
    const trunks = [];
    const palmTrunks = [];
    const crowns = { pine: [], oak: [], park: [], palm: [] };
    for (const tr of inSec) {
      const trunkH = tr.h * 0.38;
      const crownH = tr.h - trunkH;
      if (tr.kind === 'palm') {
        palmTrunks.push({ x: tr.x, y: 0, z: tr.y, sx: 0.9, sy: trunkH, sz: 0.9 });
        crowns.palm.push({
          x: tr.x, y: trunkH + crownH * 0.85, z: tr.y,
          sx: tr.r * 1.35, sy: crownH * 0.25, sz: tr.r * 1.35,
        });
      } else {
        trunks.push({ x: tr.x, y: 0, z: tr.y, sx: 1, sy: trunkH, sz: 1 });
        if (tr.kind === 'pine') {
          crowns.pine.push({
            x: tr.x, y: trunkH, z: tr.y, sx: tr.r, sy: crownH, sz: tr.r,
          });
        } else {
          crowns[tr.kind === 'oak' ? 'oak' : 'park'].push({
            x: tr.x, y: trunkH + crownH * 0.3, z: tr.y,
            sx: tr.r, sy: crownH * 0.45, sz: tr.r,
          });
        }
      }
    }
    const trunkMesh = makeInstanced(trunkGeo, trunkMat, trunks, true);
    if (trunkMesh) { meshes.push(trunkMesh); densityMeshes.trees.push(trunkMesh); }
    const palmTrunkMesh = makeInstanced(palmTrunkGeo, trunkMat, palmTrunks, true);
    if (palmTrunkMesh) { meshes.push(palmTrunkMesh); densityMeshes.trees.push(palmTrunkMesh); }
    const crownMats = { pine: pineMat, oak: oakMat, park: parkMat, palm: palmMat };
    const crownGeos = { pine: pineCrownGeo, oak: sphereCrownGeo, park: sphereCrownGeo, palm: sphereCrownGeo };
    for (const kind of Object.keys(crowns)) {
      const m = makeInstanced(crownGeos[kind], crownMats[kind], crowns[kind], true);
      if (m) { meshes.push(m); densityMeshes.trees.push(m); }
    }
  }

  // Peaks: mountain cones + snow caps from MOUNTAIN_PEAKS (data.js).
  // v4.1: a real backdrop range NORTH of the map edge (centres y <= -600,
  // bases clear of every road) — 500-800 m peaks, hazed by the fog, never
  // pyramids looming over downtown. The Peaks settlement lives on the
  // roads below them.
  const mountainGeo = new THREE.ConeGeometry(1, 1, 7);
  const mountainMat = rockMat();
  const snowMat = std('#e2e8f0');
  for (const p of MOUNTAIN_PEAKS) {
    const mx = p.x;
    const mz = p.y;
    const mr = p.radius;
    const mh = p.height;
    const m = new THREE.Mesh(mountainGeo, mountainMat);
    m.scale.set(mr, mh, mr);
    m.position.set(mx, mh / 2 - 4, mz);
    meshes.push(m);
    const cap = new THREE.Mesh(mountainGeo, snowMat);
    cap.scale.set(mr * 0.34, mh * 0.3, mr * 0.34);
    cap.position.set(mx, mh - mh * 0.15 - 4, mz);
    meshes.push(cap);
  }

  // Airport: runway + centre line + terminal + control tower.
  // v4.1, literal metres: terminal 60 x 12 x 30 m, tower 30 m tall.
  const rw = AIRPORT.runway;
  meshes.push(groundPlane(rw.w, rw.h, asphaltMat(), rw.x + rw.w / 2, rw.y + rw.h / 2, 0.04, true));
  meshes.push(groundPlane(rw.w * 0.9, 2, basic('#f8fafc', { transparent: true, opacity: 0.6 }), rw.x + rw.w / 2, rw.y + rw.h / 2, 0.05));
  const terminal = new THREE.Mesh(unitBox, std('#94a3b8'));
  terminal.scale.set(60, 12, 30);
  terminal.position.set(AIRPORT.x + 420, 6, AIRPORT.y + 90);
  meshes.push(terminal);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 30, 8), std('#cbd5e1'));
  tower.position.set(AIRPORT.x + 120, 15, AIRPORT.y + 90);
  meshes.push(tower);
  const towerTop = new THREE.Mesh(unitBox, std('#38bdf8'));
  towerTop.scale.set(8, 3, 8);
  towerTop.position.set(AIRPORT.x + 120, 31.5, AIRPORT.y + 90);
  meshes.push(towerTop);

  // District barrier walls: solid concrete, always present (only the gates
  // in them ever open). Drawn as long grey slabs along each border.
  // v4.1: 3 m tall, 1 m thick, with an amber cap.
  for (const w of walls) {
    const m = new THREE.Mesh(unitBox, concreteMat());
    m.scale.set(w.w, 3, w.h);
    m.position.set(w.x + w.w / 2, 1.5, w.y + w.h / 2);
    meshes.push(m);
    const cap = new THREE.Mesh(unitBox, std('#f59e0b'));
    cap.scale.set(w.w, 0.3, w.h + 0.2);
    cap.position.set(w.x + w.w / 2, 3.15, w.y + w.h / 2);
    meshes.push(cap);
  }

  // Gates: a staffed checkpoint in each through-road — two posts, a red
  // barrier bar across the gap, and a guard booth beside it (staffed gates
  // only; ring-road gates get posts + bar, no booth). Only the bar is
  // tagged with the district, so the renderer hides just the bar when
  // the district unlocks and the gate stands open; posts and booth stay.
  // v4.1, literal metres: 12 m gap, 1 m bar, 3 m posts, 3 m booth.
  for (const g of gates) {
    const vertical = g.h > g.w;
    const cx = g.x + g.w / 2;
    const cy = g.y + g.h / 2;
    // Barrier bar across the gap (tagged: hidden once unlocked).
    const bar = new THREE.Mesh(unitBox, std('#dc2626'));
    bar.scale.set(g.w, 1, g.h);
    bar.position.set(cx, 0.5, cy);
    bar.userData.gateDistrict = g.district;
    meshes.push(bar);
    const stripe = new THREE.Mesh(unitBox, basic('#f8fafc'));
    stripe.scale.set(vertical ? 0.3 : g.w, 0.15, vertical ? g.h : 0.3);
    stripe.position.set(cx, 1.05, cy);
    stripe.userData.gateDistrict = g.district;
    meshes.push(stripe);
    // Posts at both ends of the gap (3 m tall).
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(unitBox, std('#f59e0b'));
      if (vertical) {
        post.scale.set(0.4, 3, 0.4);
        post.position.set(cx, 1.5, cy + s * (g.h / 2 + 0.6));
      } else {
        post.scale.set(0.4, 3, 0.4);
        post.position.set(cx + s * (g.w / 2 + 0.6), 1.5, cy);
      }
      meshes.push(post);
    }
    // Guard booth beside the gate (3 m tall, staffed gates only).
    if (!g.ring) {
      const booth = new THREE.Mesh(unitBox, std('#0ea5e9'));
      booth.scale.set(3, 3, 3);
      if (vertical) booth.position.set(cx + 6, 1.5, cy + 8);
      else booth.position.set(cx + 8, 1.5, cy - 6);
      meshes.push(booth);
      const boothRoof = new THREE.Mesh(unitBox, std('#155e75'));
      boothRoof.scale.set(3.2, 0.3, 3.2);
      boothRoof.position.set(booth.position.x, 3.15, booth.position.z);
      meshes.push(boothRoof);
    }
  }

  // Shops: coloured box + a vertical name plate on the south face.
  // v4.1: two storeys (~6 m), 12 x 10 m, name plate painted by shopSignMat
  // (canvas text, textures.js). The box sits at the pre-computed offset
  // (bx, by) beside its road, never on it. Shop names are proper nouns —
  // shown as-is in every language.
  const shopColors = { food: '#f59e0b', gun: '#ef4444', clothes: '#ec4899', mods: '#22d3ee' };
  for (const s of shops) {
    const bx = s.bx !== undefined ? s.bx : s.x;
    const by = s.by !== undefined ? s.by : s.y;
    const m = new THREE.Mesh(unitBox, std(shopColors[s.kind] || '#0ea5e9'));
    m.scale.set(s.w, 6, s.h);
    m.position.set(bx, 3, by);
    meshes.push(m);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.5), shopSignMat(s.name, shopColors[s.kind] || '#0ea5e9'));
    plate.position.set(bx, 4.5, by + 5.1);
    meshes.push(plate);
  }

  // Activity spots: flat orange discs (6 m radius).
  const discGeo = new THREE.CircleGeometry(1, 20);
  const discMat = basic('#f59e0b', { transparent: true, opacity: 0.85 });
  for (const s of activitySpots) {
    const m = new THREE.Mesh(discGeo, discMat);
    m.rotation.x = -Math.PI / 2;
    m.scale.set(s.r, s.r, 1);
    m.position.set(s.x, 0.06, s.y);
    meshes.push(m);
  }

  // Safe house: purple box with a lighter roof (2 storeys, ~6 m). The
  // building is 14 x 11 m at the door side of the lot — the lot itself
  // stays walkable so Leo can reach the door. (data.safeHouse is the
  // building rect computed by buildWorld; SAFE_HOUSE in config is the lot.)
  const sh = data.safeHouse || { x: SAFE_HOUSE.x, y: SAFE_HOUSE.y, w: 14, h: 11 };
  const house = new THREE.Mesh(unitBox, std('#7c3aed'));
  house.scale.set(sh.w, 6, sh.h);
  house.position.set(sh.x + sh.w / 2, 3, sh.y + sh.h / 2);
  meshes.push(house);
  const houseRoof = new THREE.Mesh(unitBox, std('#4c1d95'));
  houseRoof.scale.set(sh.w + 0.4, 0.3, sh.h + 0.4);
  houseRoof.position.set(sh.x + sh.w / 2, 6.15, sh.y + sh.h / 2);
  meshes.push(houseRoof);

  // Street lamps: one lamp on the sidewalk corner of every at-grade
  // intersection. Two InstancedMeshes (poles + heads) cover the whole city
  // in 2 draw calls; the heads glow warm at night (nightLightMat).
  // v4.1: poles 6 m tall, heads 0.8 x 0.25 x 0.35 m, on the sidewalk
  // corner (5.5 m off the centreline, 10.5 m on the arterial ring).
  let lampCount = 0;
  if (graph) {
    // Keep lamps on dry land inside the map: skip spots whose corner would
    // land in the sea, the peaks lake, the airport, or past the world edge.
    const lampSpots = graph.nodes.filter((n) => {
      if (!n.crossing || n.level !== 0) return false;
      const off = (n.x <= 90 || n.x >= 9160 || n.y <= 90 || n.y >= 5310) ? 10.5 : 5.5;
      const lx = n.x + off;
      const ly = n.y + off;
      return lx > 30 && lx < 9180 && ly > 30 && ly < 5360
        && !isWater(lx, ly)
        && !(lx > AIRPORT.x - 10 && lx < AIRPORT.x + AIRPORT.w + 10 && ly > AIRPORT.y - 10 && ly < AIRPORT.y + AIRPORT.h + 10);
    });
    const lampDummy = new THREE.Object3D();
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 6, 6);
    poleGeo.translate(0, 3, 0);
    const poles = new THREE.InstancedMesh(poleGeo, std('#334155'), lampSpots.length);
    lampCount = lampSpots.length;
    const headGeo = new THREE.BoxGeometry(0.8, 0.25, 0.35);
    headGeo.translate(0, 6.05, 0);
    const heads = new THREE.InstancedMesh(headGeo, nightLightMat('lamp-head', 0xfde68a, 0.15, 1.8), lampSpots.length);
    lampSpots.forEach((n, i) => {
      const off = (n.x <= 90 || n.x >= 9160 || n.y <= 90 || n.y >= 5310) ? 10.5 : 5.5;
      lampDummy.position.set(n.x + off, 0, n.y + off);
      lampDummy.rotation.set(0, 0, 0);
      lampDummy.scale.set(1, 1, 1);
      lampDummy.updateMatrix();
      poles.setMatrixAt(i, lampDummy.matrix);
      heads.setMatrixAt(i, lampDummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    poles.frustumCulled = false;
    heads.frustumCulled = false;
    poles.userData.fullCount = lampSpots.length;
    heads.userData.fullCount = lampSpots.length;
    meshes.push(poles);
    meshes.push(heads);
    densityMeshes.lamps.push(poles, heads);
  }

  // Traffic lights: a pole + head + three lamps at every at-grade
  // junction of two major roads (graph.trafficLights). Poles and heads are
  // instanced; the lamps are one InstancedMesh with per-instance colour,
  // so render.js can repaint them live from graph.lightStateAt (red /
  // yellow / green per axis, offset per node so the city is not in sync).
  let trafficLightData = null;
  if (graph && graph.trafficLights && graph.trafficLights.length > 0) {
    const tls = graph.trafficLights;
    const tlDummy = new THREE.Object3D();
    const tlPoleGeo = new THREE.CylinderGeometry(0.08, 0.1, 5, 6);
    tlPoleGeo.translate(0, 2.5, 0);
    const tlPoles = new THREE.InstancedMesh(tlPoleGeo, std('#1f2937'), tls.length);
    const tlHeadGeo = new THREE.BoxGeometry(0.4, 1, 0.3);
    tlHeadGeo.translate(0, 5.2, 0);
    const tlHeads = new THREE.InstancedMesh(tlHeadGeo, std('#111827'), tls.length);
    const tlLampGeo = new THREE.SphereGeometry(0.09, 6, 4);
    const tlLamps = new THREE.InstancedMesh(tlLampGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), tls.length * 3);
    const dim = new THREE.Color('#1f2937');
    tls.forEach((tlNode, i) => {
      tlDummy.position.set(tlNode.x, 0, tlNode.y);
      tlDummy.rotation.set(0, 0, 0);
      tlDummy.scale.set(1, 1, 1);
      tlDummy.updateMatrix();
      tlPoles.setMatrixAt(i, tlDummy.matrix);
      tlHeads.setMatrixAt(i, tlDummy.matrix);
      // Three lamps on the south face of the head: red top, yellow, green.
      const lampYs = [5.55, 5.2, 4.85];
      for (let k = 0; k < 3; k += 1) {
        tlDummy.position.set(tlNode.x, lampYs[k], tlNode.y + 0.18);
        tlDummy.updateMatrix();
        tlLamps.setMatrixAt(i * 3 + k, tlDummy.matrix);
        tlLamps.setColorAt(i * 3 + k, dim);
      }
    });
    tlPoles.instanceMatrix.needsUpdate = true;
    tlHeads.instanceMatrix.needsUpdate = true;
    tlLamps.instanceMatrix.needsUpdate = true;
    if (tlLamps.instanceColor) tlLamps.instanceColor.needsUpdate = true;
    tlPoles.frustumCulled = false;
    tlHeads.frustumCulled = false;
    tlLamps.frustumCulled = false;
    meshes.push(tlPoles, tlHeads, tlLamps);
    trafficLightData = { mesh: tlLamps, nodeIds: tls.map((n) => n.nodeId), count: tls.length };
  }

  // Remember full instance counts so setVisualDensity can scale them.
  for (const m of densityMeshes.trees) m.userData.fullCount = m.count;
  // The road graph is exposed so render.js can repaint the traffic lights
  // live (graph.lightStateAt) and Settings/tests can read the network.
  return { meshes, densityMeshes, trafficLightData, lampCount, graph };
}

export function buildWorld(rng) {
  const buildings = [];
  const roads = [];
  const trees = [];
  const parks = [];
  const solids = [];

  // ---- Barrier walls + gates (v3 logic, v4.1 metre sizes) ---------------
  // The wall runs the whole length of each district border; the only gaps
  // are the gate openings on the through-roads — plus the three ring-road
  // crossings (Builder B's roadgraph routes the ring through the walls at
  // (80,1350), (9170,1350) and (6000,5320), so the walls need matching
  // gaps there or the player can never drive the ring after unlocking).
  // Wall pieces are solids, gates are separate so they can open when the
  // district unlocks. Walls are 1 m thick, 3 m tall; gates are 12 m wide.
  const gates = [];
  for (const gy of BEACH_GATE_YS) {
    gates.push({ x: BEACH_BOUNDARY_X - 1, y: gy - 6, w: 2, h: 12, district: 1, label: t('gate.beach') });
  }
  for (const gx of PEAK_GATE_XS) {
    gates.push({ x: gx - 6, y: PEAK_BOUNDARY_Y - 1, w: 12, h: 2, district: 2, label: t('gate.peaks') });
  }
  // Ring-road gates (no booth, no staff — just a bar across the ring).
  gates.push({ x: RING.west - 6, y: PEAK_BOUNDARY_Y - 1, w: 12, h: 2, district: 2, ring: true, label: t('gate.ring.peaks') });
  gates.push({ x: RING.east - 6, y: PEAK_BOUNDARY_Y - 1, w: 12, h: 2, district: 2, ring: true, label: t('gate.ring.peaks') });
  gates.push({ x: BEACH_BOUNDARY_X - 1, y: RING.south - 6, w: 2, h: 12, district: 1, ring: true, label: t('gate.ring.beach') });
  const walls = [];
  function wallRun(district, horizontal, fixed, from, to, gaps) {
    // gaps: sorted [start, end] intervals along the run that stay open.
    let cur = from;
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const [gs, ge] of sorted) {
      if (gs > cur) walls.push(horizontal
        ? { x: cur, y: fixed - 0.5, w: gs - cur, h: 1, district }
        : { x: fixed - 0.5, y: cur, w: 1, h: gs - cur, district });
      cur = Math.max(cur, ge);
    }
    if (to > cur) walls.push(horizontal
      ? { x: cur, y: fixed - 0.5, w: to - cur, h: 1, district }
      : { x: fixed - 0.5, y: cur, w: 1, h: to - cur, district });
  }
  // Beach wall: x = 6000, y 1350..5400, gaps at the two through streets
  // and the ring-road south crossing.
  wallRun(1, false, BEACH_BOUNDARY_X, PEAK_BOUNDARY_Y, WORLD_HEIGHT,
    [...BEACH_GATE_YS.map((gy) => [gy - 6, gy + 6]), [RING.south - 6, RING.south + 6]]);
  // Peaks wall: y = 1350, x 0..9600, gaps at the two through avenues and
  // the two ring-road crossings.
  wallRun(2, true, PEAK_BOUNDARY_Y, 0, WORLD_WIDTH,
    [...PEAK_GATE_XS.map((gx) => [gx - 6, gx + 6]), [RING.west - 6, RING.west + 6], [RING.east - 6, RING.east + 6]]);
  for (const w of walls) solids.push(w);

  // ---- Roads (v3 centrelines, 7 m wide) ---------------------------------
  // City grid: 10 avenues x 9 streets. The roadgraph narrows them (already
  // 7 m), densifies the grid to ~150 m blocks and adds the ring road — the
  // `roads` array is mutated in place by buildRoadGraph, so everything
  // below reads the FINAL network.
  function vRoad(cx, y0, y1) {
    roads.push({ x: cx - ROAD_RES_HALF, y: y0, w: ROAD_RES_HALF * 2, h: y1 - y0, vertical: true });
  }
  function hRoad(cy, x0, x1) {
    roads.push({ x: x0, y: cy - ROAD_RES_HALF, w: x1 - x0, h: ROAD_RES_HALF * 2, vertical: false });
  }
  for (const x of AVENUES) vRoad(x, PEAK_BOUNDARY_Y, WORLD_HEIGHT);
  for (const y of STREETS) hRoad(y, 0, BEACH_BOUNDARY_X);
  // Beach: shore avenues + shore roads (through-roads 2600/4400 continue).
  for (const x of BEACH_AVENUES) vRoad(x, PEAK_BOUNDARY_Y, WORLD_HEIGHT);
  for (const y of BEACH_ROADS) hRoad(y, BEACH_BOUNDARY_X, 9200);
  // Peaks: two mountain roads; the y=450 road is split around the lake.
  hRoad(450, 0, 6500);
  hRoad(450, 8100, WORLD_WIDTH);
  hRoad(900, 0, WORLD_WIDTH);
  for (const x of PEAK_CLIMBS) vRoad(x, 0, PEAK_BOUNDARY_Y);

  // The road graph: intersections, lanes, sidewalks, zebra crossings.
  // (Mutates `roads`: narrows, densifies, ring, viaducts, hills.)
  const gateNodes = [
    ...BEACH_GATE_YS.map((gy) => ({ x: BEACH_BOUNDARY_X, y: gy, district: 1 })),
    ...PEAK_GATE_XS.map((gx) => ({ x: gx, y: PEAK_BOUNDARY_Y, district: 2 })),
  ];
  const graph = buildRoadGraph(roads, gateNodes, districtAt);

  // ---- Keep-outs: nothing may be built on a mission / shop / activity --
  // point, or the player could never reach it (a building is solid). A
  // point ON a road is fine — roads stay walkable — so this only gates
  // building plots, never lanes. Worship places and POIs are placed by
  // hand and exempt (the Hermit Hut IS mission 52's talk spot).
  // Radii in metres (a mission point needs ~12 m of clear standing room).
  const keepOuts = [
    ...STORY_MISSIONS.map((m) => ({ x: m.x, y: m.y, r: 12 })),
    ...SIDE_QUEST_PLACES.map((p) => ({ x: p.x, y: p.y, r: 12 })),
    ...SHOP_DEFS.map((s) => ({ x: s.x + 6, y: s.y + 5, r: 20 })),
    ...ACTIVITY_SPOTS.map((s) => ({ x: s.x, y: s.y, r: 15 })),
    // Peaks hand-placed homes + POIs: the fill must not pave over them
    // (a fill house overlapping a hand home would block the home itself).
    ...PEAK_HOMES.map((p) => ({ x: p.x, y: p.y, r: 12 })),
    ...PEAK_POIS.map((p) => ({ x: p.x, y: p.y, r: 12 })),
    { x: SAFE_HOUSE.door.x, y: SAFE_HOUSE.door.y, r: 8 },
  ];
  function nearKeepOut(x, y, pad = 0, except = null) {
    return keepOuts.some((k) => (!except || Math.hypot(k.x - except.x, k.y - except.y) > 1)
      && Math.hypot(x - k.x, y - k.y) < k.r + pad);
  }
  const safeHouseLot = { x: SAFE_HOUSE.x - 6, y: SAFE_HOUSE.y - 6, w: SAFE_HOUSE.w + 12, h: SAFE_HOUSE.h + 12 };
  function plotClear(x, y, w, h) {
    // A plot is clear when no keep-out point lies inside it (expanded by
    // 12, so the player can always stand on the point), it does not
    // overlap the airport, the safe-house lot or open water, and it is
    // not on a road (1 m margin — plots sit 6+ m from the centreline).
    for (const k of keepOuts) {
      if (k.x > x - 12 && k.x < x + w + 12 && k.y > y - 12 && k.y < y + h + 12) return false;
    }
    if (rectsOverlap({ x, y, w, h }, { x: AIRPORT.x, y: AIRPORT.y, w: AIRPORT.w, h: AIRPORT.h })) return false;
    if (rectsOverlap({ x, y, w, h }, safeHouseLot)) return false;
    if (WATER_RECTS.some((wr) => rectsOverlap({ x, y, w, h }, { x: wr.x - 2, y: wr.y - 2, w: wr.w + 4, h: wr.h + 4 }))) return false;
    if (roads.some((r) => rectsOverlap({ x, y, w, h }, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }))) return false;
    return true;
  }
  function overlapsBuilding(x, y, w, h) {
    return buildings.some((b) => rectsOverlap({ x, y, w, h }, b));
  }

  // If a plot holds a mission / shop / activity point, the whole plot is
  // not lost: fit the largest sub-rectangle beside the point (12 clear of
  // it), so mission-dense cells — most of the beach — still get a building
  // next to the point instead of standing empty.
  function fitPlot(px, py, pw, ph) {
    const pts = keepOuts.filter((k) => k.x > px - 12 && k.x < px + pw + 12 && k.y > py - 12 && k.y < py + ph + 12);
    if (pts.length === 0) return null;
    const cands = [];
    for (const k of pts) {
      cands.push({ x: px, y: py, w: k.x - 12 - px, h: ph });
      cands.push({ x: k.x + 12, y: py, w: px + pw - (k.x + 12), h: ph });
      cands.push({ x: px, y: py, w: pw, h: k.y - 12 - py });
      cands.push({ x: px, y: k.y + 12, w: pw, h: py + ph - (k.y + 12) });
    }
    let best = null;
    for (const c of cands) {
      if (c.w < 20 || c.h < 16) continue;
      if (!plotClear(c.x, c.y, c.w, c.h)) continue;
      if (!best || c.w * c.h > best.w * best.h) best = c;
    }
    // Middle strips BETWEEN two points (a plot holding two mission
    // points can still host a building in the gap between them).
    const byY = [...pts].sort((a, b) => a.y - b.y);
    for (let i = 0; i + 1 < byY.length; i += 1) {
      const c = { x: px, y: byY[i].y + 12, w: pw, h: byY[i + 1].y - 12 - (byY[i].y + 12) };
      if (c.w >= 20 && c.h >= 16 && plotClear(c.x, c.y, c.w, c.h) && (!best || c.w * c.h > best.w * best.h)) best = c;
    }
    const byX = [...pts].sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < byX.length; i += 1) {
      const c = { x: byX[i].x + 12, y: py, w: byX[i + 1].x - 12 - (byX[i].x + 12), h: ph };
      if (c.w >= 20 && c.h >= 16 && plotClear(c.x, c.y, c.w, c.h) && (!best || c.w * c.h > best.w * best.h)) best = c;
    }
    return best;
  }

  // ---- City blocks: EVERY cell gets buildings (v4.1) --------------------
  // Cells are the rectangles between neighbouring road centrelines of the
  // FINAL network (roadgraph-densified, ~150 m blocks). Each cell is split
  // into up to 4 plots; each plot gets one building sized to the plot, at
  // a realistic height for its type. A few cells (deterministic ~3%)
  // become pocket parks instead: trees + a grass patch, never a bare slab.
  const cityColors = ['#3f4a5a', '#4a3b52', '#37474f', '#4e342e', '#2f3e46', '#5d4037', '#6b7280', '#7d7468'];
  const houseColors = ['#d9c8a8', '#e8dcc3', '#c9b8a3', '#b8c4a8', '#d8b4a0', '#a8b8c4'];
  const beachColors = ['#f59e0b', '#0ea5e9', '#ec4899', '#f8fafc', '#34d399', '#fbbf24'];
  const downtownCells = { total: 0, empty: 0 };
  const beachCells = { total: 0, empty: 0 };
  const peaksCells = { total: 0, empty: 0 };
  // Road centrelines + type ('arterial' | 'residential' | 'wall') per band.
  function bandLines(x0, x1, y0, y1) {
    const vMap = new Map();
    const hMap = new Map();
    for (const r of roads) {
      if (r.vertical) {
        const cx = r.x + r.w / 2;
        if (cx < x0 || cx > x1) continue;
        if (r.y + r.h < y0 || r.y > y1) continue;
        const type = r.type === 'arterial' ? 'arterial' : 'residential';
        if (!vMap.has(cx) || type === 'arterial') vMap.set(cx, type);
      } else {
        const cy = r.y + r.h / 2;
        if (cy < y0 || cy > y1) continue;
        if (r.x + r.w < x0 || r.x > x1) continue;
        const type = r.type === 'arterial' ? 'arterial' : 'residential';
        if (!hMap.has(cy) || type === 'arterial') hMap.set(cy, type);
      }
    }
    if (!vMap.has(x0)) vMap.set(x0, 'wall');
    if (!vMap.has(x1)) vMap.set(x1, 'wall');
    if (!hMap.has(y0)) hMap.set(y0, 'wall');
    if (!hMap.has(y1)) hMap.set(y1, 'wall');
    return {
      vLines: [...vMap.keys()].sort((a, b) => a - b),
      hLines: [...hMap.keys()].sort((a, b) => a - b),
      vMap, hMap,
    };
  }
  function insetFor(type) {
    return type === 'arterial' ? ART_INSET : RES_INSET;
  }
  function fillCells(band, district, counter, opts = {}) {
    const { density = 1, maxPlots = 4, parkChance = 0.03 } = opts;
    const { vLines, hLines, vMap, hMap } = band;
    for (let vi = 0; vi + 1 < vLines.length; vi += 1) {
      for (let hi = 0; hi + 1 < hLines.length; hi += 1) {
        const x0 = vLines[vi] + insetFor(vMap.get(vLines[vi]));
        const y0 = hLines[hi] + insetFor(hMap.get(hLines[hi]));
        const x1 = vLines[vi + 1] - insetFor(vMap.get(vLines[vi + 1]));
        const y1 = hLines[hi + 1] - insetFor(hMap.get(hLines[hi + 1]));
        if (x1 - x0 < 25 || y1 - y0 < 20) continue;
        // The airport is open tarmac, not a building block: cells whose
        // centre is inside it are not counted as blocks at all.
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        if (district === 0 && pointInRect(cx, cy, { x: AIRPORT.x, y: AIRPORT.y, w: AIRPORT.w, h: AIRPORT.h })) continue;
        if (district === 2 && isWater(cx, cy)) continue;
        // Peaks are a sparse mountain settlement, not a city grid: most
        // cells stay forest (pines), a few get a house.
        if (rng.next() > density) continue;
        counter.total += 1;
        // Pocket park: ~3% of cells, never in the tower core.
        const inTowerCore = district === 0 && cx >= 2700 && cx <= 4500 && cy >= 2600 && cy <= 4400;
        if (parkChance > 0 && !inTowerCore && rng.chance(parkChance)) {
          parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
          const n = 6 + Math.floor(rng.next() * 5);
          for (let i = 0; i < n; i += 1) {
            trees.push({
              x: rng.range(x0 + 2, x1 - 2), y: rng.range(y0 + 2, y1 - 2),
              kind: 'park', h: 4 + rng.range(0, 4), r: 2.5 + rng.range(0, 1.5),
            });
          }
          continue;
        }
        // Plots: 2 columns/rows when the cell is wide/tall, else 1.
        const cols = (x1 - x0) > 90 ? 2 : 1;
        const rows = (y1 - y0) > 90 ? 2 : 1;
        const plotCount = Math.min(cols * rows, maxPlots);
        let filled = false;
        for (let p = 0; p < plotCount; p += 1) {
          const c = p % cols;
          const r = Math.floor(p / cols);
          const px0 = x0 + (c * (x1 - x0)) / cols + 4;
          const px1 = x0 + ((c + 1) * (x1 - x0)) / cols - 4;
          const py0 = y0 + (r * (y1 - y0)) / rows + 4;
          const py1 = y0 + ((r + 1) * (y1 - y0)) / rows - 4;
          let rect = { x: px0, y: py0, w: px1 - px0, h: py1 - py0 };
          if (rect.w < 20 || rect.h < 16) continue;
          if (!plotClear(rect.x, rect.y, rect.w, rect.h)) {
            const fit = fitPlot(rect.x, rect.y, rect.w, rect.h);
            if (!fit) continue;
            rect = fit;
          }
          // A worship place inside this plot takes the plot (hall built
          // around its centre, other plots in the cell stay normal) — but
          // only when the point sits well inside the plot, so the hall
          // never overhangs into the neighbour's building.
          const worship = WORSHIP_PLACES.find((w) => w.district === district
            && w.x >= rect.x + 12 && w.x <= rect.x + rect.w - 12
            && w.y >= rect.y + 12 && w.y <= rect.y + rect.h - 12);
          if (worship) {
            const b = {
              x: worship.x - 10, y: worship.y - 8, w: 20, h: 16,
              color: '#f8fafc', district, tall: false, kind: 'worship',
              worship: worship.kind, height: 6, roofColor: '#b91c1c',
            };
            buildings.push(b);
            solids.push(b);
            filled = true;
            continue;
          }
          let kind;
          let height;
          let color;
          let roofColor;
          let footprint;
          if (district === 1) {
            // Beach: hotels (9-20 m) or beach houses (3-6.5 m).
            if (rng.chance(0.68)) {
              kind = 'mid'; height = rng.pick(BEACH_H); color = rng.pick(beachColors); footprint = rng.pick(MID_F);
            } else {
              kind = 'house'; height = rng.pick(HOUSE_H); color = rng.pick(houseColors); roofColor = rng.pick(['#b45309', '#7c2d12', '#0e7490']); footprint = rng.pick(HOUSE_F);
            }
          } else if (district === 2) {
            // Peaks: houses only.
            kind = 'house'; height = rng.pick(HOUSE_H); color = rng.pick(houseColors); roofColor = rng.pick(['#7c2d12', '#374151']); footprint = rng.pick(HOUSE_F);
          } else if (inTowerCore) {
            // Downtown core: slab towers (40-63 m) or mid-rise flats.
            if (rng.chance(0.55)) {
              kind = 'tower'; height = rng.pick(TOWER_H); color = rng.pick(cityColors); footprint = rng.pick(TOWER_F);
            } else {
              kind = 'mid'; height = rng.pick(MID_H); color = rng.pick(cityColors); footprint = rng.pick(MID_F);
            }
          } else if (rng.chance(0.3)) {
            // Mid-rise flat (15-25 m) on the wider plots, houses elsewhere.
            kind = 'mid'; height = rng.pick(MID_H); color = rng.pick(cityColors); footprint = rng.pick(MID_F);
          } else {
            kind = 'house'; height = rng.pick(HOUSE_H); color = rng.pick(houseColors);
            roofColor = rng.pick(['#b45309', '#7c2d12', '#374151', '#0e7490']); footprint = rng.pick(HOUSE_F);
          }
          // The building is centred in its plot (the rest is yard).
          const bw = Math.min(rect.w - 4, footprint[0]);
          const bd = Math.min(rect.h - 4, footprint[1]);
          if (bw < 10 || bd < 8) continue;
          const b = {
            x: rect.x + (rect.w - bw) / 2, y: rect.y + (rect.h - bd) / 2,
            w: bw, h: bd, color, district,
            tall: kind === 'tower', kind, height, roofColor,
          };
          buildings.push(b);
          solids.push(b);
          filled = true;
          // A yard tree or two beside houses and small flats.
          if ((kind === 'house' || height < 15) && rng.chance(0.7)) {
            trees.push({
              x: b.x + rng.range(2, Math.max(3, b.w - 2)),
              y: b.y + b.h - rng.range(2, 5),
              kind: rng.chance(0.5) ? 'oak' : 'park',
              h: 4 + rng.range(0, 4), r: 2 + rng.range(0, 2),
            });
          }
        }
        if (!filled) counter.empty += 1;
      }
    }
  }
  const downtownBand = bandLines(RING.west, BEACH_BOUNDARY_X, PEAK_BOUNDARY_Y, RING.south);
  const beachBand = bandLines(BEACH_BOUNDARY_X, RING.east, PEAK_BOUNDARY_Y, RING.south);
  const peaksBand = bandLines(RING.west, RING.east, RING.north, PEAK_BOUNDARY_Y);
  fillCells(downtownBand, 0, downtownCells, { density: 1, maxPlots: 4, parkChance: 0.03 });
  fillCells(beachBand, 1, beachCells, { density: 1, maxPlots: 4, parkChance: 0.03 });
  fillCells(peaksBand, 2, peaksCells, { density: 0.4, maxPlots: 1, parkChance: 0 });

  // Worship places that fell outside every filled plot (e.g. in a park
  // cell or a keep-out gap) still get built, on their own cleared patch.
  let worshipSkipped = 0;
  for (const w of WORSHIP_PLACES) {
    if (buildings.some((b) => b.kind === 'worship' && Math.abs(b.x + b.w / 2 - w.x) < 5 && Math.abs(b.y + b.h / 2 - w.y) < 5)) continue;
    const b = {
      x: w.x - 10, y: w.y - 8, w: 20, h: 16, color: '#f8fafc',
      district: w.district, tall: false, kind: 'worship', worship: w.kind,
      height: 6, roofColor: '#b91c1c',
    };
    if (!plotClear(b.x, b.y, b.w, b.h) || overlapsBuilding(b.x, b.y, b.w, b.h)) {
      worshipSkipped += 1;
      continue;
    }
    buildings.push(b);
    solids.push(b);
  }

  // Peaks: homes from data.js (along the roads) + POIs. A home too close
  // to a mission point is skipped (the player must reach the point).
  const lake = WATER_RECTS[1];
  for (const home of PEAK_HOMES) {
    const b = {
      x: home.x - 7, y: home.y - 5.5, w: 14, h: 11, color: rng.pick(houseColors),
      district: 2, tall: false, kind: 'house', height: rng.pick(HOUSE_H),
      roofColor: rng.pick(['#7c2d12', '#374151']),
    };
    if (nearKeepOut(b.x + b.w / 2, b.y + b.h / 2, 0, home)) continue;
    if (rectsOverlap(b, { x: lake.x - 10, y: lake.y - 10, w: lake.w + 20, h: lake.h + 20 })) continue;
    // Homes sit ~16 m off the centreline (road half 3.5 + sidewalk 2.5 +
    // a verge); a 1 m margin is the right clearance test here.
    if (roads.some((r) => rectsOverlap(b, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }))) continue;
    if (overlapsBuilding(b.x, b.y, b.w, b.h)) continue;
    buildings.push(b);
    solids.push(b);
    if (rng.chance(0.8)) {
      trees.push({
        x: b.x + b.w + rng.range(2, 6), y: b.y + rng.range(2, b.h - 2),
        kind: 'pine', h: 4 + rng.range(0, 4), r: 2 + rng.range(0, 2),
      });
    }
  }
  // Peaks POIs (lookouts, stalls, the Hermit Hut): small distinct halls,
  // always built (they are destinations, not random fill).
  const poiColors = { lookout: '#9ca3af', stall: '#f97316', cabin: '#6b4f2a' };
  for (const poi of PEAK_POIS) {
    const b = {
      x: poi.x - 6, y: poi.y - 5, w: 12, h: 10, color: poiColors[poi.kind] || '#9ca3af',
      district: 2, tall: false, kind: 'poi', poiKind: poi.kind, height: poi.kind === 'lookout' ? 4 : 3,
      roofColor: '#374151',
    };
    buildings.push(b);
    solids.push(b);
  }
  // Peaks pines: many, kept off the lake and the roads.
  for (let i = 0; i < 260; i += 1) {
    const t = {
      x: rng.range(80, 9500), y: rng.range(60, 1300), kind: 'pine',
      h: 4 + rng.range(0, 4), r: 2 + rng.range(0, 2),
    };
    if (rectsOverlap({ x: t.x - 2, y: t.y - 2, w: 4, h: 4 },
      { x: lake.x - 10, y: lake.y - 10, w: lake.w + 20, h: lake.h + 20 })) continue;
    if (roads.some((r) => t.x > r.x - 2 && t.x < r.x + r.w + 2 && t.y > r.y - 2 && t.y < r.y + r.h + 2)) continue;
    trees.push(t);
  }

  // The safe house is a solid building (14 x 11 m at the door side of the
  // lot — the lot itself stays walkable so Leo can reach the door).
  const safeHouseB = { x: 488, y: 1599, w: 14, h: 11 };
  const safeHouse = {
    x: safeHouseB.x, y: safeHouseB.y, w: safeHouseB.w, h: safeHouseB.h,
    color: '#7c3aed', district: 0, tall: false, kind: 'house', height: 6,
    roofColor: '#4c1d95',
  };
  buildings.push(safeHouse);
  solids.push(safeHouse);

  // Street trees: both sides of every road, ~150 m apart, clear of
  // intersections (so they never block a zebra crossing or a corner lamp).
  // Oaks and park trees downtown, palms on the beach roads, pines in the
  // peaks — all at realistic heights. The tree sits on the sidewalk's
  // outer edge (5.5 m off a residential centreline, 10 m off an arterial).
  const crossings = graph.nodes.filter((n) => n.crossing && n.level === 0);
  const crossBuckets = new Map();
  for (const n of crossings) {
    const key = `${Math.floor(n.x / 150)},${Math.floor(n.y / 150)}`;
    if (!crossBuckets.has(key)) crossBuckets.set(key, []);
    crossBuckets.get(key).push(n);
  }
  function nearCrossing(cx, cy, d) {
    const bx = Math.floor(cx / 150);
    const by = Math.floor(cy / 150);
    for (let gx = bx - 1; gx <= bx + 1; gx += 1) {
      for (let gy = by - 1; gy <= by + 1; gy += 1) {
        const bucket = crossBuckets.get(`${gx},${gy}`);
        if (!bucket) continue;
        for (const n of bucket) {
          if (Math.hypot(n.x - cx, n.y - cy) < d) return true;
        }
      }
    }
    return false;
  }
  for (const r of roads) {
    const len = r.vertical ? r.h : r.w;
    const steps = Math.floor(len / 150);
    const off = r.type === 'arterial' ? TREE_OFFSET_ART : TREE_OFFSET_RES;
    for (let s = 0; s <= steps; s += 1) {
      const along = (s + 0.5) * (len / (steps + 1));
      for (const side of [-1, 1]) {
        const cx = r.vertical ? r.x + r.w / 2 + side * off : r.x + along;
        const cy = r.vertical ? r.y + along : r.y + r.h / 2 + side * off;
        if (cx < 40 || cx > WORLD_WIDTH - 40 || cy < 40 || cy > WORLD_HEIGHT - 40) continue;
        if (isWater(cx, cy)) continue;
        if (cx > AIRPORT.x - 10 && cx < AIRPORT.x + AIRPORT.w + 10 && cy > AIRPORT.y - 10 && cy < AIRPORT.y + AIRPORT.h + 10) continue;
        if (cx > safeHouseLot.x && cx < safeHouseLot.x + safeHouseLot.w && cy > safeHouseLot.y && cy < safeHouseLot.y + safeHouseLot.h) continue;
        // Keep intersections clear: no tree within 7 m of a crossing node
        // (the zebra is 8 m wide, the corner lamp sits at +5.5).
        if (nearCrossing(cx, cy, 7)) continue;
        // Not on a mission / shop / activity point.
        if (nearKeepOut(cx, cy, -9)) continue;
        const d = districtAt(cx, cy);
        const kind = d === 1 ? (rng.chance(0.55) ? 'palm' : 'oak')
          : d === 2 ? 'pine' : (rng.chance(0.5) ? 'oak' : 'park');
        const h = kind === 'palm' ? 10 + rng.range(0, 5)
          : 4 + rng.range(0, 4);
        trees.push({ x: cx, y: cy, kind, h, r: kind === 'palm' ? 2.5 + rng.range(0, 1.5) : 2 + rng.range(0, 2) });
      }
    }
  }
  // Coconut rows along the shore: palms lining the sand strip between the
  // ring road (x 9170) and the sea (x 9200), so the beach reads as a
  // palm-lined resort strip.
  for (let y = 1500; y <= 5300; y += 130) {
    trees.push({ x: 9185 + rng.range(-2, 2), y, kind: 'palm', h: 10 + rng.range(0, 5), r: 2.5 + rng.range(0, 1.5) });
  }

  // Shops: the interact point stays where data.js put it; the building
  // (12 x 10 m) sits 12 m to one side, on the first side that clears
  // every road — never on the road itself.
  const shops = SHOP_DEFS.map((s) => {
    let bx = s.x + 12;
    let by = s.y;
    for (const [ox, oy] of [[12, 0], [-12, 0], [0, 12], [0, -12]]) {
      const cand = { x: s.x + ox - 6, y: s.y + oy - 5, w: 12, h: 10 };
      if (cand.x < 10 || cand.y < 10 || cand.x + 12 > WORLD_WIDTH - 10 || cand.y + 10 > WORLD_HEIGHT - 10) continue;
      if (isWater(cand.x + 6, cand.y + 5)) continue;
      if (roads.some((r) => rectsOverlap(cand, { x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 }))) continue;
      if (overlapsBuilding(cand.x, cand.y, cand.w, cand.h)) continue;
      bx = s.x + ox;
      by = s.y + oy;
      break;
    }
    return { ...s, w: 12, h: 10, bx, by };
  });
  const activitySpots = ACTIVITY_SPOTS.map((s) => ({ ...s, r: 6 }));

  // Collision: a 150 m spatial hash over the solids, so a query only
  // checks the solids in the 3x3 cells around the point instead of all
  // ~3000 of them every frame.
  const HASH_CELL = 150;
  const solidHash = new Map();
  for (const s of solids) {
    const x0 = Math.floor(s.x / HASH_CELL);
    const x1 = Math.floor((s.x + s.w) / HASH_CELL);
    const y0 = Math.floor(s.y / HASH_CELL);
    const y1 = Math.floor((s.y + s.h) / HASH_CELL);
    for (let gx = x0; gx <= x1; gx += 1) {
      for (let gy = y0; gy <= y1; gy += 1) {
        const key = `${gx},${gy}`;
        if (!solidHash.has(key)) solidHash.set(key, []);
        solidHash.get(key).push(s);
      }
    }
  }
  function collides(x, y, r, unlocked) {
    if (x - r < 0 || y - r < 0 || x + r > WORLD_WIDTH || y + r > WORLD_HEIGHT) return true;
    const cx = Math.floor(x / HASH_CELL);
    const cy = Math.floor(y / HASH_CELL);
    for (let gx = cx - 1; gx <= cx + 1; gx += 1) {
      for (let gy = cy - 1; gy <= cy + 1; gy += 1) {
        const bucket = solidHash.get(`${gx},${gy}`);
        if (!bucket) continue;
        for (const s of bucket) {
          if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
        }
      }
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
    buildings, roads, trees, parks, solids, gates, walls, shops, activitySpots, graph,
    collides, collidesRect, barrierDistrictAt,
    randomRoadPoint, randomSidewalkPoint, nearestRoadPoint,
    safeHouse: safeHouseB,
  };
  const built = buildMeshes(world);
  world.meshes = built.meshes;
  world.densityMeshes = built.densityMeshes;
  world.trafficLightData = built.trafficLightData;
  // Graphics-quality hook (render.js applyGraphicsQuality calls this):
  // scale the instanced tree / lamp counts and hide the far neon signs.
  world.visualDensity = 1;
  world.setVisualDensity = (frac) => {
    const f = Math.min(1, Math.max(0.1, Number(frac) || 1));
    world.visualDensity = f;
    for (const m of world.densityMeshes.trees) {
      m.count = Math.max(1, Math.floor((m.userData.fullCount || m.count) * f));
    }
    for (const m of world.densityMeshes.lamps) {
      m.count = Math.max(1, Math.floor((m.userData.fullCount || m.count) * f));
    }
    world.densityMeshes.signs.forEach((m, i) => {
      m.visible = i < Math.ceil(world.densityMeshes.signs.length * f);
    });
  };
  // v4.1 stats for testers and the build report (render.js exposes these
  // as window.__neonBay.worldStats).
  const treesByKind = {};
  for (const t of trees) treesByKind[t.kind] = (treesByKind[t.kind] || 0) + 1;
  const buildingsByKind = {};
  for (const b of buildings) buildingsByKind[b.kind] = (buildingsByKind[b.kind] || 0) + 1;
  const byDistrict = [0, 0, 0];
  for (const b of buildings) byDistrict[b.district] += 1;
  const roadsByType = { residential: 0, arterial: 0 };
  for (const r of roads) roadsByType[r.type === 'arterial' ? 'arterial' : 'residential'] += 1;
  world.stats = {
    buildings: buildings.length,
    buildingsByKind,
    buildingsByDistrict: byDistrict,
    towers: buildings.filter((b) => b.kind === 'tower').length,
    tallest: buildings.length > 0 ? Math.max(...buildings.map((b) => b.height)) : 0,
    trees: trees.length,
    treesByKind,
    palms: treesByKind.palm || 0,
    worship: buildings.filter((b) => b.kind === 'worship').length,
    worshipSkipped,
    peaksHomes: buildings.filter((b) => b.district === 2 && b.kind === 'house').length,
    peaksPois: buildings.filter((b) => b.kind === 'poi').length,
    downtownCells,
    beachCells,
    peaksCells,
    parks: parks.length,
    roads: roads.length,
    roadsByType,
    graphNodes: graph.nodes.length,
    graphSegments: graph.segments.length,
    trafficLights: graph.trafficLights ? graph.trafficLights.length : 0,
    lamps: built.lampCount || 0,
    meshes: world.meshes.length,
    scale: {
      leoUnits: LEO_HEIGHT_UNITS, leoMeters: 1.8,
      unitsPerMeter: UNITS_PER_METER,
      houseMeters: [3, 6.5], midMeters: [15, 25], towerMeters: [40, 63],
      treeMeters: [4, 15], lampMeters: 6, doorMeters: 2.1, windowMeters: 1.2,
      roadResMeters: 7, roadArtMeters: 16, sidewalkMeters: 2.5,
      mapMeters: [WORLD_WIDTH, WORLD_HEIGHT],
    },
  };
  return world;
}
