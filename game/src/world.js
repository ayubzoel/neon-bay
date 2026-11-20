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
// * The map is 2400x1800 (v6: x/4, y/3 of the v5 9600x5400) and the
//   road CENTRELINES are the v5 ones scaled, so missions, shops,
//   barriers, GPS and the road graph keep working. What changes is the
//   DENSITY: Builder B's roadgraph narrows every road to 7 m residential
//   (16 m arterial ring), densifies the grid to ~150 m blocks, and adds
//   the square ring road — buildWorld enumerates its cells from the FINAL
//   road list (after buildRoadGraph mutates it), so buildings fill the
//   real blocks, never the v3 grid. Building faces sit 6 m from a
//   residential centreline and 10.5 m from an arterial one (road half +
//   2.5 m sidewalk).
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
  asphaltMat, cityGroundMat, concreteMat, dirtMat, facadeMat, grassMat, neonSignMat, nightLightMat, plazaMat, shopSignMat,
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

// v6: the map is 2400x1800 (x/4, y/3 of v5) — same metre scale, same
// road widths, same districts, only the city is smaller and denser.
// Every centreline below is the v5 value scaled: avenues x/4, streets
// y/3, so missions, shops, barriers, GPS and the road graph keep
// working on the small map.
export const AVENUES = [75, 225, 375, 525, 675, 825, 975, 1125, 1275, 1425];
export const STREETS = [566.7, 716.7, 866.7, 1016.7, 1166.7, 1316.7, 1466.7, 1616.7, 1750];
export const BEACH_AVENUES = [1600, 1800, 2000, 2200];
export const BEACH_ROADS = [666.7, 866.7, 1000, 1333.3, 1466.7, 1666.7];
export const PEAK_ROADS = [150, 300];
export const PEAK_CLIMBS = [375, 900, 1125, 2100];
// Through-roads with a gate: downtown streets 866.7/1466.7 reach the beach,
// downtown avenues 375/1125 climb into the peaks.
export const BEACH_GATE_YS = [866.7, 1466.7];
export const PEAK_GATE_XS = [375, 1125];
export const PEAK_BOUNDARY_Y = 450;
export const BEACH_BOUNDARY_X = 1500;

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
  const { buildings, roads, trees, gates, walls, shops, activitySpots, graph, parks, foothills } = data;
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
  // `culled` gives the mesh a hand-computed bounding sphere so frustum
  // culling works; `slack` pads it for the instances' own size. three
  // r149 has no InstancedMesh.computeBoundingSphere (it arrived in r156)
  // — calling it crashes the game — and r149's Frustum.intersectsObject
  // reads object.boundingSphere when it is non-null, so a manual sphere
  // keeps culling working. (The Node count stub faked the method, which
  // is why this only surfaced in the real browser.) The default 20 m
  // slack fits trees and lamps; a 63 m tower sticks ~39 m past its
  // origin, so building groups pass 45 or the tower top would pop out
  // of the sphere and get culled while still on screen.
  function makeInstanced(geo, mat, items, culled = false, slack = 20) {
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
      // Centre = mean of the instance positions; radius = the farthest
      // instance from that centre, plus slack for instance sizes.
      let cx = 0; let cy = 0; let cz = 0;
      for (const it of items) { cx += it.x; cy += it.y; cz += it.z; }
      const n = Math.max(1, items.length);
      const centre = new THREE.Vector3(cx / n, cy / n, cz / n);
      let radius = 0;
      for (const it of items) {
        const d = Math.hypot(it.x - centre.x, it.y - centre.y, it.z - centre.z);
        if (d > radius) radius = d;
      }
      im.boundingSphere = new THREE.Sphere(centre, radius + slack);
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
      // Winding: both triangles must face UP (+Y). The v4 order
      // (0,1,2),(0,2,3) wound them DOWN — computeVertexNormals gave
      // (0,-1,0) and FrontSide culling hid every merged ground mesh
      // from above, so the asphalt, sidewalks, median, curbs, markings
      // and dirt patches were INVISIBLE in v4 (the "road" everyone saw
      // was just the district ground plane — the root cause of Ayub's
      // "aspal, trotoar, tanah terlihat sama"). Fixed in v5 by
      // swapping the second vertex of each triangle: (0,2,1),(0,3,2).
      const io = i * 6;
      const vo = i * 4;
      // Triangle A: corners 0, 2, 1. Triangle B: corners 0, 3, 2.
      idx[io] = vo; idx[io + 1] = vo + 2; idx[io + 2] = vo + 1;
      idx[io + 3] = vo; idx[io + 4] = vo + 3; idx[io + 5] = vo + 2;
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

  // District ground: one repeating procedural texture per district, not
  // flat colour — warm city ground downtown, sand at the beach, grass in
  // the peaks. Downtown uses cityGroundMat (warm mid grey-brown), which
  // is deliberately neither the sidewalk grey nor the asphalt grey.
  const groundMats = [cityGroundMat(), sandMat(), grassMat()];
  for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
    const r = DISTRICT_RECTS[i];
    meshes.push(groundPlane(r.w, r.h, groundMats[i], r.x + r.w / 2, r.y + r.h / 2, 0, true));
  }
  // Water (slightly above ground so it never z-fights).
  for (const w of WATER_RECTS) {
    meshes.push(groundPlane(w.w, w.h, waterMat(), w.x + w.w / 2, w.y + w.h / 2, 0.02));
  }
  // Pocket parks: a grass patch on the city ground, so a park reads as a
  // park, with a paved plaza in its middle third (the fifth surface).
  for (const p of parks || []) {
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;
    meshes.push(groundPlane(p.w, p.h, grassMat(), pcx, pcy, 0.03, true));
    meshes.push(groundPlane(p.w / 3, p.h / 3, plazaMat(), pcx, pcy, 0.035, true));
  }

  // Roads: sidewalks, asphalt, and the 1.5 m median on arterials only —
  // all merged into a few meshes. Elevated roads (viaduct deck, hill
  // climbs) slope inside the merged quads: the deck sits at deckZ, the
  // hill follows its sine profile, with 50 m ramps at the viaduct ends
  // so cars climb onto the deck instead of stepping up.
  //
  // The curb is REAL geometry: every flat sidewalk is two raised strips
  // (0.10 m, against asphalt at 0.04) flanking the road, so the step
  // reads from the third-person camera, plus a dark curb-shadow strip
  // hugging each road edge. The strips stop at every intersection — a
  // raised strip across a cross street would read as a speed bump —
  // and the four corner squares of each crossing are paved as patches,
  // so the sidewalk wraps the corner instead of leaving a hole.
  // Elevated (hill/viaduct) roads keep the old flat sidewalk below the
  // deck: their profile is a slope, not a step.
  const walkMat = sidewalkMat();
  const roadMat = asphaltMat();
  const medianMat = basic('#f8fafc', { transparent: true, opacity: 0.7 });
  const curbMat = basic('#1c2126', { transparent: true, opacity: 0.55 });
  const walkQuads = [];
  const roadQuads = [];
  const medianQuads = [];
  const curbQuads = [];
  function hillProfile(r, y) {
    const span = r.to - r.from;
    return r.hillHeight * Math.sin((Math.PI * (r.to - y)) / span);
  }
  // Where a flat road's sidewalk strips may run: the road's own span
  // minus the corridors (road + 2.5 m sidewalk each side) of every
  // perpendicular road crossing it. Returns [start, end] intervals along
  // the road, each longer than 1 m.
  function stripSegments(r) {
    const vertical = r.vertical;
    const lo = vertical ? r.y : r.x;
    const hi = lo + (vertical ? r.h : r.w);
    const mid = vertical ? r.x + r.w / 2 : r.y + r.h / 2;
    const blocked = [];
    for (const o of roads) {
      if (o.vertical === vertical || o.elevated) continue;
      // The crossing road must actually cross this road's centre line,
      // and its corridor must overlap this road's span.
      const across = vertical ? [o.x, o.x + o.w] : [o.y, o.y + o.h];
      if (across[0] > mid || across[1] < mid) continue;
      const along = vertical ? [o.y, o.y + o.h] : [o.x, o.x + o.w];
      if (along[1] + 2.5 < lo || along[0] - 2.5 > hi) continue;
      blocked.push([along[0] - 2.5, along[1] + 2.5]);
    }
    blocked.sort((a, b) => a[0] - b[0]);
    // Subtract the sorted blocked intervals from [lo, hi].
    const segs = [];
    let cursor = lo;
    for (const [bs, be] of blocked) {
      if (bs > cursor) segs.push([cursor, Math.min(bs, hi)]);
      if (be > cursor) cursor = be;
    }
    if (hi > cursor) segs.push([cursor, hi]);
    return segs.filter(([a, b]) => b - a > 1);
  }
  for (const r of roads) {
    const cx = r.vertical ? r.x + r.w / 2 : 0;
    const cy = !r.vertical ? r.y + r.h / 2 : 0;
    const len = r.vertical ? r.h : r.w;
    const start = r.vertical ? r.y : r.x;
    const end = start + len;
    if (r.elevated === 'hill') {
      // 16 sloped strips following the sine profile (flat sidewalk,
      // below the deck — see the note above).
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
      // Raised sidewalk strips (0.10 m), trimmed at every crossing.
      for (const [a, b] of stripSegments(r)) {
        walkQuads.push(quad(r.x - 2.5, a, r.x, b, 0.10));
        walkQuads.push(quad(r.x + r.w, a, r.x + r.w + 2.5, b, 0.10));
      }
      // The four paved corner squares of each crossing — emitted here,
      // from the vertical road's side, so no corner is paved twice.
      // Side intervals: the 2.5 m strips left and right of the asphalt.
      // End intervals: the 2.5 m strips before and after the cross road.
      const sideSpans = [[r.x - 2.5, r.x], [r.x + r.w, r.x + r.w + 2.5]];
      for (const o of roads) {
        if (o.vertical || o.elevated) continue;
        if (o.x > cx || o.x + o.w < cx) continue;
        if (o.y + o.h < r.y || o.y > r.y + r.h) continue;
        const endSpans = [[o.y - 2.5, o.y], [o.y + o.h, o.y + o.h + 2.5]];
        for (const [sx0, sx1] of sideSpans) {
          for (const [sy0, sy1] of endSpans) walkQuads.push(quad(sx0, sy0, sx1, sy1, 0.10));
        }
      }
      roadQuads.push(quad(r.x, r.y, r.x + r.w, r.y + r.h, 0.04));
      // Curb shadow: a dark 0.4 m strip on the road, hugging each edge.
      curbQuads.push(quad(r.x, r.y, r.x + 0.4, r.y + r.h, 0.045));
      curbQuads.push(quad(r.x + r.w - 0.4, r.y, r.x + r.w, r.y + r.h, 0.045));
      if (r.type === 'arterial') medianQuads.push(quad(cx - 0.75, r.y, cx + 0.75, r.y + r.h, 0.05));
    } else {
      // Horizontal roads sit 1 mm higher than vertical ones, so the two
      // asphalt layers never z-fight where they cross.
      for (const [a, b] of stripSegments(r)) {
        walkQuads.push(quad(a, r.y - 2.5, b, r.y, 0.101));
        walkQuads.push(quad(a, r.y + r.h, b, r.y + r.h + 2.5, 0.101));
      }
      roadQuads.push(quad(r.x, r.y, r.x + r.w, r.y + r.h, 0.041));
      curbQuads.push(quad(r.x, r.y, r.x + r.w, r.y + 0.4, 0.046));
      curbQuads.push(quad(r.x, r.y + r.h - 0.4, r.x + r.w, r.y + r.h, 0.046));
      if (r.type === 'arterial') medianQuads.push(quad(r.x, cy - 0.75, r.x + r.w, cy + 0.75, 0.051));
    }
  }
  const walkMesh = buildMergedMesh(walkQuads, walkMat);
  if (walkMesh) meshes.push(walkMesh);
  const roadMesh = buildMergedMesh(roadQuads, roadMat);
  if (roadMesh) meshes.push(roadMesh);
  const medianMesh = buildMergedMesh(medianQuads, medianMat);
  if (medianMesh) meshes.push(medianMesh);
  const curbMesh = buildMergedMesh(curbQuads, curbMat);
  if (curbMesh) meshes.push(curbMesh);

  // --- Road markings ------------------------------------------------------
  // The asphalt texture is isotropic (its baked dashes mapped wrong on
  // horizontal roads), so the lines are geometry now: solid white edge
  // lines, a dashed yellow centre line on residential streets (3 m dash,
  // 6 m gap), dashed white lane lines on arterials (+/-4.25 m, between
  // the inner and outer lanes). Every line stops 12 m short of an
  // intersection. Elevated roads stay unmarked — their deck is a slope
  // the flat quads cannot follow.
  const markingWhite = [];
  const markingYellow = [];
  let markingDashCount = 0;
  const crossNodes = graph ? graph.nodes.filter((n) => n.crossing && n.level === 0) : [];
  // Flat-road intervals between intersections (12 m clear of each node).
  function markingSegments(r) {
    const vertical = r.vertical;
    const lo = vertical ? r.y : r.x;
    const hi = lo + (vertical ? r.h : r.w);
    const mid = vertical ? r.x + r.w / 2 : r.y + r.h / 2;
    const stops = [];
    for (const n of crossNodes) {
      // A node stops this road only if it sits on the road's centre line
      // (within 1 m) and inside the road's span (1 m of slack).
      const onCentre = vertical ? Math.abs(n.x - mid) < 1 : Math.abs(n.y - mid) < 1;
      const along = vertical ? n.y : n.x;
      if (onCentre && along >= lo - 1 && along <= hi + 1) stops.push(along);
    }
    stops.sort((a, b) => a - b);
    const segs = [];
    let cursor = lo;
    for (const s of stops) {
      if (s - 12 > cursor) segs.push([cursor, s - 12]);
      if (s + 12 > cursor) cursor = s + 12;
    }
    if (hi > cursor) segs.push([cursor, hi]);
    return segs.filter(([a, b]) => b - a > 4);
  }
  const lineWhiteMat = basic('#f8fafc', { transparent: true, opacity: 0.85 });
  const lineYellowMat = basic('#facc15', { transparent: true, opacity: 0.9 });
  // One 0.15 m-wide line quad, laid along the road at lateral offset
  // `off` from the centre line, from `a` to `b` along the road.
  function paintLine(list, vertical, centre, off, a, b, z) {
    const halfW = 0.075;
    if (vertical) list.push(quad(centre + off - halfW, a, centre + off + halfW, b, z));
    else list.push(quad(a, centre + off - halfW, b, centre + off + halfW, z));
  }
  for (const r of roads) {
    if (r.elevated) continue;
    const half = r.vertical ? r.w / 2 : r.h / 2;
    const c = r.vertical ? r.x + r.w / 2 : r.y + r.h / 2;
    const z = r.vertical ? 0.05 : 0.051;
    for (const [a, b] of markingSegments(r)) {
      // Edge lines: solid white, just inside the curb.
      for (const s of [-1, 1]) paintLine(markingWhite, r.vertical, c, s * (half - 0.35), a, b, z);
      // Dashes: 3 m on, 6 m off.
      for (let p = a; p + 3 <= b; p += 9) {
        if (r.type === 'arterial') {
          for (const s of [-1, 1]) paintLine(markingWhite, r.vertical, c, s * 4.25, p, p + 3, z);
        } else {
          paintLine(markingYellow, r.vertical, c, 0, p, p + 3, z);
        }
        markingDashCount += 1;
      }
    }
  }
  const markingWhiteMesh = buildMergedMesh(markingWhite, lineWhiteMat);
  if (markingWhiteMesh) meshes.push(markingWhiteMesh);
  const markingYellowMesh = buildMergedMesh(markingYellow, lineYellowMat);
  if (markingYellowMesh) meshes.push(markingYellowMesh);

  // Zebra crossings: one striped crossing on EVERY approach of every
  // at-grade intersection, sized to the road it crosses (7 m
  // residential, 16 m arterial — the old 8x8 square was too narrow for
  // the ring road and too wide for a side street). Stripes run parallel
  // to the traffic they face. Two textures (residential / arterial) keep
  // the stripe width at ~0.75 m on both widths.
  // Paint a 64x64 stripe texture: vertical bars of `bar` px every
  // `pitch` px, starting at `first`.
  function stripeTexture(first, pitch, bar) {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 64;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(248, 250, 252, 0.85)';
    for (let x = first; x < 64; x += pitch) g.fillRect(x, 2, bar, 60);
    return new THREE.CanvasTexture(cv);
  }
  const zebraMatRes = new THREE.MeshBasicMaterial({ map: stripeTexture(4, 12, 6), transparent: true, opacity: 0.8 });
  const zebraMatArt = new THREE.MeshBasicMaterial({ map: stripeTexture(2, 6, 3), transparent: true, opacity: 0.8 });
  let zebraCount = 0;
  if (graph) {
    const zebraGeo = new THREE.PlaneGeometry(8, 8);
    zebraGeo.rotateX(-Math.PI / 2);
    const resItems = [];
    const artItems = [];
    // The flat roads meeting at this node, and the widest of each
    // direction (the crossing spans the widest road it crosses).
    function roadsAt(n, vertical) {
      return roads.filter((rd) => rd.vertical === vertical && !rd.elevated
        && n.x >= rd.x - 1 && n.x <= rd.x + rd.w + 1 && n.y >= rd.y - 1 && n.y <= rd.y + rd.h + 1);
    }
    for (const n of crossNodes) {
      const vRoads = roadsAt(n, true);
      const hRoads = roadsAt(n, false);
      const vHalf = vRoads.length ? Math.max(...vRoads.map((rd) => rd.w / 2)) : 0;
      const hHalf = hRoads.length ? Math.max(...hRoads.map((rd) => rd.h / 2)) : 0;
      // Crossing a vertical road: wide in x, 3 m deep, on both approaches.
      // Wide (arterial) crossings go to the dense-stripe texture.
      if (vHalf > 0) {
        for (const s of [-1, 1]) {
          const item = { x: n.x, y: 0.06, z: n.y + s * (hHalf + 2.5), sx: (vHalf * 2) / 8, sy: 1, sz: 3 / 8, ry: 0 };
          (vHalf * 2 > 10 ? artItems : resItems).push(item);
          zebraCount += 1;
        }
      }
      // Crossing a horizontal road: the same, rotated 90 degrees.
      if (hHalf > 0) {
        for (const s of [-1, 1]) {
          const item = { x: n.x + s * (vHalf + 2.5), y: 0.06, z: n.y, sx: (hHalf * 2) / 8, sy: 1, sz: 3 / 8, ry: Math.PI / 2 };
          (hHalf * 2 > 10 ? artItems : resItems).push(item);
          zebraCount += 1;
        }
      }
    }
    const zebraResMesh = makeInstanced(zebraGeo, zebraMatRes, resItems);
    if (zebraResMesh) meshes.push(zebraResMesh);
    const zebraArtMesh = makeInstanced(zebraGeo, zebraMatArt, artItems);
    if (zebraArtMesh) meshes.push(zebraArtMesh);
  }

  // Map sectors (3 columns x 2 rows), shared by the trees below and
  // the buildings: every instanced group is split per sector and
  // frustum-culled, so the renderer only draws the sectors near the
  // camera instead of the whole 2.4 x 1.8 km map at once (the building
  // groups used to be one whole-map mesh with frustumCulled=false,
  // ~180k tris always rendered). A sector's bounding sphere is ~600 m,
  // so the sectors behind the camera are culled; the ones ahead render.
  const SECTOR_COLS = 3;
  const SECTOR_ROWS = 2;
  const SECTOR_W = WORLD_WIDTH / SECTOR_COLS;
  const SECTOR_H = WORLD_HEIGHT / SECTOR_ROWS;
  const SECTORS = [];
  for (let row = 0; row < SECTOR_ROWS; row += 1) {
    for (let col = 0; col < SECTOR_COLS; col += 1) {
      SECTORS.push({
        x0: col * SECTOR_W, x1: (col + 1) * SECTOR_W,
        y0: row * SECTOR_H, y1: (row + 1) * SECTOR_H,
      });
    }
  }
  // Sector index of a point, clamped into the grid (points on the far
  // edge fall in the last column / row instead of nowhere).
  function sectorOf(x, y) {
    const col = Math.min(SECTOR_COLS - 1, Math.max(0, Math.floor(x / SECTOR_W)));
    const row = Math.min(SECTOR_ROWS - 1, Math.max(0, Math.floor(y / SECTOR_H)));
    return row * SECTOR_COLS + col;
  }

  // Buildings: INSTANCED, in literal metres. One InstancedMesh per
  // (sector, facade variant, quantized w/h/d) — footprints and heights
  // come from small discrete sets, so ~5000 buildings collapse into a
  // few dozen draw calls per sector instead of one whole-map mesh.
  // Facade materials are white-based (facadeMat('#ffffff', variant))
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
    // The group key starts with the sector, so each (sector,
    // variant, size) gets its own culled InstancedMesh.
    const sec = sectorOf(b.x + b.w / 2, b.y + b.h / 2);
    const key = `${sec}|${variant}|${b.w}x${h}x${b.h}`;
    if (!bGroups.has(key)) bGroups.set(key, { variant, w: b.w, h, d: b.h, items: [] });
    bGroups.get(key).items.push({
      x: b.x + b.w / 2, y: h / 2, z: b.y + b.h / 2, sx: 1, sy: 1, sz: 1, color: b.color,
    });
    if (b.kind === 'house' || b.kind === 'cabin') {
      pyramidRoofs.push({
        x: b.x + b.w / 2, y: h + 0.8, z: b.y + b.h / 2,
        sx: b.w * 0.72, sy: 1.6, sz: b.h * 0.72, ry: Math.PI / 4, color: b.roofColor || '#7c2d12',
        sec,
      });
    } else {
      flatRoofs.push({
        x: b.x + b.w / 2, y: h + 0.15, z: b.y + b.h / 2, sx: b.w + 0.2, sy: 0.3, sz: b.h + 0.2,
        sec,
      });
    }
    // A real front door, ~2.1 m tall, on the south face.
    if (b.kind === 'house' || b.kind === 'cabin' || b.kind === 'shop') {
      doors.push({ x: b.x + b.w / 2, y: 1.05, z: b.y + b.h + 0.15, sx: 1, sy: 2.1, sz: 0.3, sec });
    }
  }
  for (const g of bGroups.values()) {
    // Culled per sector (slack 45: a 63 m tower extends ~39 m past its
    // origin, so the default 20 m slack would pop its top off-screen).
    const im = makeInstanced(buildingGeo(g.w, g.h, g.d), facadeMat('#ffffff', g.variant), g.items, true, 45);
    if (im) meshes.push(im);
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  // Roofs and doors are sector-split like the buildings: one culled
  // mesh per sector instead of one whole-map mesh. The helper emits the
  // per-sector instanced mesh for one item list + geometry + material.
  function sectorInstanced(items, geo, mat) {
    for (let s = 0; s < SECTORS.length; s += 1) {
      const m = makeInstanced(geo, mat, items.filter((r) => r.sec === s), true);
      if (m) meshes.push(m);
    }
  }
  sectorInstanced(flatRoofs, unitBox, roofMat());
  const pyramidGeo = new THREE.ConeGeometry(1, 1, 4);
  // White base so each roof's instanceColor shows true (a coloured base
  // would multiply and muddy it).
  sectorInstanced(pyramidRoofs, pyramidGeo, std('#ffffff'));
  sectorInstanced(doors, unitBox, std('#5b3a1e'));

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

  // Trees: INSTANCED and SECTOR-SPLIT — two trunk meshes (normal +
  // palm) and one crown mesh per kind (pine cone, oak sphere, park sphere,
  // palm sphere), per map sector (SECTORS is defined above, before the
  // buildings — the buildings reuse the same sectors).
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1, 6);
  trunkGeo.translate(0, 0.5, 0);
  const palmTrunkGeo = new THREE.CylinderGeometry(0.1, 0.16, 1, 6);
  palmTrunkGeo.translate(0, 0.5, 0);
  const pineCrownGeo = new THREE.ConeGeometry(1, 1, 6);
  pineCrownGeo.translate(0, 0.5, 0);
  // 5x3 segments = 30 tris per crown instead of the v4 6x4 = 48: the
  // same rounded crown at street distance, ~18 tris saved on every oak,
  // park and palm crown in the city.
  const sphereCrownGeo = new THREE.SphereGeometry(1, 5, 3);
  sphereCrownGeo.translate(0, 0.5, 0);
  const trunkMat = std('#78350f');
  const pineMat = std('#166534');
  const palmMat = std('#15803d');
  const oakMat = std('#2d6a2e');
  const parkMat = std('#22c55e');
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

  // --- Relief: gentle mounds where the ground was dead flat. ------------
  // The ground plane itself stays flat: buildings sit on it at y=0 and
  // Leo walks at y=0, so displacing it would bury both. Relief is low,
  // wide, half-buried spheres in parks, peaks forest and beach dunes,
  // plus solid foothill cones on the map's north/west verges (built in
  // buildWorld as solids, so Leo can never clip into them). Mound
  // heights are capped (parks <=1.2 m, dunes <=1.0 m, forest <=1.8 m).
  // The mound list is returned as `moundList` (centre, radii, height)
  // so player.js can sample the same ellipsoids and lift Leo's feet
  // onto them instead of letting him sink (v5b terrain-following).
  //
  // Clearance helpers: a candidate spot must be clear of buildings
  // (150 m spatial grid), roads, water and gameplay points. Rectangles
  // are tested with a shared overlap check; points with a distance check.
  const bGrid = new Map();
  const BG = 150;
  for (const b of buildings) {
    const gx0 = Math.floor(b.x / BG);
    const gx1 = Math.floor((b.x + b.w) / BG);
    const gy0 = Math.floor(b.y / BG);
    const gy1 = Math.floor((b.y + b.h) / BG);
    for (let gx = gx0; gx <= gx1; gx += 1) {
      for (let gy = gy0; gy <= gy1; gy += 1) {
        const k = `${gx},${gy}`;
        if (!bGrid.has(k)) bGrid.set(k, []);
        bGrid.get(k).push(b);
      }
    }
  }
  // True when the circle (x, y, r+pad) overlaps the rect (rx, ry, rw, rh).
  function circleHitsRect(x, y, r, pad, rx, ry, rw, rh) {
    return x + r + pad > rx && x - r - pad < rx + rw && y + r + pad > ry && y - r - pad < ry + rh;
  }
  function clearOfBuildings(x, y, r) {
    const gx = Math.floor(x / BG);
    const gy = Math.floor(y / BG);
    for (let ix = gx - 1; ix <= gx + 1; ix += 1) {
      for (let iy = gy - 1; iy <= gy + 1; iy += 1) {
        const cell = bGrid.get(`${ix},${iy}`);
        if (!cell) continue;
        for (const b of cell) {
          if (circleHitsRect(x, y, r, 2, b.x, b.y, b.w, b.h)) return false;
        }
      }
    }
    return true;
  }
  function clearOfRoads(x, y, r, pad = 3) {
    for (const rd of roads) {
      if (circleHitsRect(x, y, r, pad, rd.x, rd.y, rd.w, rd.h)) return false;
    }
    return true;
  }
  function clearOfWater(x, y, r, pad = 2) {
    for (const wr of WATER_RECTS) {
      if (circleHitsRect(x, y, r, pad, wr.x, wr.y, wr.w, wr.h)) return false;
    }
    return true;
  }
  function clearOfPoints(x, y, r) {
    const keepOut = [...STORY_MISSIONS, ...SIDE_QUEST_PLACES, ...SHOP_DEFS, ...ACTIVITY_SPOTS];
    for (const pt of keepOut) {
      if (Math.hypot(pt.x - x, pt.y - y) < r + 14) return false;
    }
    return true;
  }
  // All four clearance checks at once (roads take the caller's pad).
  function clearForMound(x, y, r, roadPad) {
    return clearOfRoads(x, y, r, roadPad)
      && clearOfBuildings(x, y, r)
      && clearOfPoints(x, y, r)
      && clearOfWater(x, y, r);
  }
  const grassMounds = [];
  const sandMounds = [];
  // Pocket parks: two gentle mounds each, in the corners clear of the
  // central plaza (the plaza occupies the middle third).
  for (const p of parks || []) {
    for (const [fx, fy] of [[0.22, 0.25], [0.78, 0.72]]) {
      const mx = p.x + p.w * fx + (hash01(p.x, p.y + fx * 100) - 0.5) * p.w * 0.1;
      const my = p.y + p.h * fy + (hash01(p.y, p.x + fy * 100) - 0.5) * p.h * 0.1;
      const mr = 8 + hash01(p.x + fx * 50, p.y) * 10;
      grassMounds.push({ x: mx, y: 0, z: my, sx: mr, sy: 0.6 + hash01(p.y, fx * 90) * 0.6, sz: mr });
    }
  }
  // Peaks forest: rolling ground, well off every road and building.
  let placed = 0;
  for (let i = 0; i < 220 && placed < 26; i += 1) {
    const mx = 30 + hash01(i, 7) * 2340;
    const my = 30 + hash01(i, 21) * 393.3;
    const mr = 30 + hash01(i, 33) * 40;
    if (!clearForMound(mx, my, mr, 6)) continue;
    grassMounds.push({ x: mx, y: 0, z: my, sx: mr, sy: 1.0 + hash01(i, 55) * 0.8, sz: mr * (0.8 + hash01(i, 77) * 0.4) });
    placed += 1;
  }
  const forestMounds = placed;
  // Beach dunes: low sand rises along the shore strip, east of the last
  // shore avenue and clear of the ring road and the palms.
  placed = 0;
  for (let i = 0; i < 120 && placed < 12; i += 1) {
    const mx = 2225 + hash01(i, 91) * 60;
    const my = 500 + hash01(i, 101) * 1233.3;
    const mr = 10 + hash01(i, 113) * 12;
    if (!clearForMound(mx, my, mr, 4)) continue;
    sandMounds.push({ x: mx, y: 0, z: my, sx: mr, sy: 0.6 + hash01(i, 127) * 0.4, sz: mr });
    placed += 1;
  }
  const duneCount = placed;
  const moundGeo = new THREE.SphereGeometry(1, 12, 8);
  const grassMoundMesh = makeInstanced(moundGeo, grassMat(), grassMounds);
  if (grassMoundMesh) meshes.push(grassMoundMesh);
  const sandMoundMesh = makeInstanced(moundGeo, sandMat(), sandMounds);
  if (sandMoundMesh) meshes.push(sandMoundMesh);
  // Terrain sampling data for player.js: one flat entry per mound with
  // the ellipsoid parameters (centre x/z, radii, peak height). The mesh
  // is a unit sphere scaled (rx, h, rz) about y=0, so the surface height
  // at (x, y) is h * sqrt(1 - dx^2 - dz^2) with dx, dz normalised.
  const moundList = [
    ...grassMounds.map((m) => ({ x: m.x, z: m.z, rx: m.sx, rz: m.sz, h: m.sy })),
    ...sandMounds.map((m) => ({ x: m.x, z: m.z, rx: m.sx, rz: m.sz, h: m.sy })),
  ];
  // Peaks dirt patches: brown earth showing through the grass, 120 flat
  // quads scattered through the mountain band, clear of the roads.
  const dirtQuads = [];
  placed = 0;
  for (let i = 0; i < 400 && placed < 120; i += 1) {
    const dx = 30 + hash01(i, 141) * 2340;
    const dy = 30 + hash01(i, 153) * 393.3;
    const dw = 6 + hash01(i, 167) * 10;
    const dh = 5 + hash01(i, 179) * 8;
    if (!clearOfRoads(dx, dy, Math.max(dw, dh) / 2, 2)) continue;
    if (!clearOfWater(dx, dy, Math.max(dw, dh) / 2)) continue;
    dirtQuads.push(quad(dx - dw / 2, dy - dh / 2, dx + dw / 2, dy + dh / 2, 0.02));
    placed += 1;
  }
  const dirtMesh = buildMergedMesh(dirtQuads, dirtMat());
  if (dirtMesh) meshes.push(dirtMesh);

  // Foothills: solid cones on the north/west verges (buildWorld), a
  // closer hill range in front of the backdrop peaks. Rocky when tall,
  // grassy when low; sunk 1 m so the base reads as planted, not floating.
  const foothillGeo = new THREE.ConeGeometry(1, 1, 7);
  for (const f of foothills || []) {
    const m = new THREE.Mesh(foothillGeo, f.h >= 20 ? rockMat() : grassMat());
    m.scale.set(f.r, f.h, f.r);
    m.position.set(f.x, f.h / 2 - 1, f.y);
    meshes.push(m);
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
  // Airport forecourt: a plaza patch in front of the terminal, south
  // of the street that passes the terminal and clear of the runway.
  meshes.push(groundPlane(70, 36, plazaMat(), AIRPORT.x + 420, AIRPORT.y + 142, 0.035, true));
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
      const off = (n.x <= 22.5 || n.x >= 2290 || n.y <= 30 || n.y >= 1770) ? 10.5 : 5.5;
      const lx = n.x + off;
      const ly = n.y + off;
      return lx > 7.5 && lx < 2295 && ly > 10 && ly < 1790
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
      const off = (n.x <= 22.5 || n.x >= 2290 || n.y <= 30 || n.y >= 1770) ? 10.5 : 5.5;
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
  return {
    meshes, densityMeshes, trafficLightData, lampCount, graph,
    markings: { dashes: markingDashCount, zebras: zebraCount },
    mounds: { grass: grassMounds.length, sand: sandMounds.length, forest: forestMounds, dunes: duneCount },
    moundList,
    dirtPatches: dirtQuads.length,
    foothills: (foothills || []).length,
    plazaPatches: (parks || []).length + 1,
  };
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
  // (20,450), (2292.5,450) and (1500,1773.3), so the walls need matching
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
  // Beach wall: x = 1500, y 450..1800, gaps at the two through streets
  // and the ring-road south crossing.
  wallRun(1, false, BEACH_BOUNDARY_X, PEAK_BOUNDARY_Y, WORLD_HEIGHT,
    [...BEACH_GATE_YS.map((gy) => [gy - 6, gy + 6]), [RING.south - 6, RING.south + 6]]);
  // Peaks wall: y = 450, x 0..2400, gaps at the two through avenues and
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
  // Beach: shore avenues + shore roads (through-roads 866.7/1466.7 continue).
  for (const x of BEACH_AVENUES) vRoad(x, PEAK_BOUNDARY_Y, WORLD_HEIGHT);
  for (const y of BEACH_ROADS) hRoad(y, BEACH_BOUNDARY_X, RING.east);
  // Peaks: two mountain roads; the y=150 road is split around the lake.
  hRoad(150, 0, 1625);
  hRoad(150, 2025, WORLD_WIDTH);
  hRoad(300, 0, WORLD_WIDTH);
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
        const inTowerCore = district === 0 && cx >= 675 && cx <= 1125 && cy >= 866.7 && cy <= 1466.7;
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
      x: rng.range(20, 2375), y: rng.range(20, 433.3), kind: 'pine',
      h: 4 + rng.range(0, 4), r: 2 + rng.range(0, 2),
    };
    if (rectsOverlap({ x: t.x - 2, y: t.y - 2, w: 4, h: 4 },
      { x: lake.x - 10, y: lake.y - 10, w: lake.w + 20, h: lake.h + 20 })) continue;
    if (roads.some((r) => t.x > r.x - 2 && t.x < r.x + r.w + 2 && t.y > r.y - 2 && t.y < r.y + r.h + 2)) continue;
    trees.push(t);
  }

  // The safe house is a solid building (14 x 11 m at the door side of the
  // lot — the lot itself stays walkable so Leo can reach the door).
  const safeHouseB = { x: 116.8, y: 525.7, w: 14, h: 11 };
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
  // ring road (x 2292.5) and the sea (x 2300), so the beach reads as a
  // palm-lined resort strip.
  for (let y = 500; y <= 1766.7; y += 43.3) {
    trees.push({ x: 2296.3 + rng.range(-2, 2), y, kind: 'palm', h: 10 + rng.range(0, 5), r: 2.5 + rng.range(0, 1.5) });
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

  // ---- Foothills: real relief on the map's north/west verges ----------
  // A closer hill range in front of the backdrop peaks (data.js
  // MOUNTAIN_PEAKS): cones 12-30 m tall on the empty strips between the
  // ring road and the map edge, where nothing else lives. Each cone is a
  // solid (its bounding square goes into `solids`) so Leo can never walk
  // into it and clip through the slope — the only relief in the game
  // that is solid, and the only place the ground truly rises. A few
  // pines stand at each foot, just outside the cone.
  const foothills = [];
  function foothillClear(cx, cy, r) {
    // Inside the map with a 5 m margin.
    if (cx - r < 5 || cy - r < 5 || cx + r > WORLD_WIDTH - 5 || cy + r > WORLD_HEIGHT - 5) return false;
    // Clear of roads and water (3 m pad), buildings, and gameplay spots.
    const rects = [...roads, ...WATER_RECTS];
    for (const rc of rects) {
      if (cx + r + 3 > rc.x && cx - r - 3 < rc.x + rc.w && cy + r + 3 > rc.y && cy - r - 3 < rc.y + rc.h) return false;
    }
    if (overlapsBuilding(cx - r, cy - r, 2 * r, 2 * r)) return false;
    for (const k of keepOuts) if (Math.hypot(k.x - cx, k.y - cy) < r + k.r + 4) return false;
    return true;
  }
  // Candidate spots: a row along the north verge (y ~5-13) every 137.5 m,
  // and a column along the west verge (x ~4-10) every 216.7 m, jittered.
  const foothillSpots = [];
  for (let x = 75; x <= 2350; x += 137.5) foothillSpots.push([x + rng.range(-30, 30), 5 + rng.range(0, 8.3)]);
  for (let y = 566.7; y <= 1733.3; y += 216.7) foothillSpots.push([3.8 + rng.range(0, 6.3), y + rng.range(-40, 40)]);
  for (const [fx, fy] of foothillSpots) {
    const fr = 22 + rng.range(0, 14);
    const fh = 12 + rng.range(0, 18);
    if (!foothillClear(fx, fy, fr)) continue;
    foothills.push({ x: fx, y: fy, r: fr, h: fh });
    solids.push({ x: fx - fr, y: fy - fr, w: 2 * fr, h: 2 * fr });
    for (let i = 0; i < 3; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      trees.push({
        x: fx + Math.cos(a) * fr * 1.05, y: fy + Math.sin(a) * fr * 1.05,
        kind: 'pine', h: 4 + rng.range(0, 4), r: 2 + rng.range(0, 2),
      });
    }
  }

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
    buildings, roads, trees, parks, foothills, solids, gates, walls, shops, activitySpots, graph,
    collides, collidesRect, barrierDistrictAt,
    randomRoadPoint, randomSidewalkPoint, nearestRoadPoint,
    safeHouse: safeHouseB,
  };
  const built = buildMeshes(world);
  world.meshes = built.meshes;
  world.densityMeshes = built.densityMeshes;
  world.trafficLightData = built.trafficLightData;
  // Terrain height for player.js (v5b): the ground the hero stands on.
  // Mounds are half-buried unit spheres scaled (rx, h, rz) about y=0,
  // so the surface over a mound is the ellipsoid height
  // h * sqrt(1 - dx^2 - dz^2); overlapping mounds take the tallest.
  // Roads, sidewalks and plazas are flat by construction (mounds are
  // placed clear of them), so this returns exactly 0 there.
  world.moundList = built.moundList || [];
  world.groundHeightAt = (x, y) => {
    let top = 0;
    for (const m of world.moundList) {
      const dx = (x - m.x) / m.rx;
      const dz = (y - m.z) / m.rz;
      const q = dx * dx + dz * dz;
      if (q >= 1) continue;
      const h = m.h * Math.sqrt(1 - q);
      if (h > top) top = h;
    }
    return top;
  };
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
  // World stats for testers and the build report (render.js exposes
  // these as window.__neonBay.worldStats).
  const treesByKind = {};
  for (const t of trees) treesByKind[t.kind] = (treesByKind[t.kind] || 0) + 1;
  const buildingsByKind = {};
  for (const b of buildings) buildingsByKind[b.kind] = (buildingsByKind[b.kind] || 0) + 1;
  const byDistrict = [0, 0, 0];
  for (const b of buildings) byDistrict[b.district] += 1;
  const roadsByType = { residential: 0, arterial: 0 };
  for (const r of roads) roadsByType[r.type === 'arterial' ? 'arterial' : 'residential'] += 1;
  // Surface / relief tallies (from the mesh build, so they count what
  // was actually drawn, not what was planned).
  const reliefStats = {
    markings: built.markings,
    mounds: built.mounds,
    dirtPatches: built.dirtPatches,
    foothills: built.foothills,
    plazaPatches: built.plazaPatches,
  };
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
    ...reliefStats,
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
