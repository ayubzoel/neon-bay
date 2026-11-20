// Neon Bay — the road graph: intersections, lanes, sidewalks and zebra
// crossings, built from the road rectangles world.js lays down.
// Everything that moves on the street uses this graph, so pedestrians stay
// on sidewalks, traffic stays in its lane, and police chase along roads
// instead of cutting through buildings.
//
// v4 — 1 unit = 1 metre, Leo Vance 1.8 m. The v3 roads were 64 m wide
// (a 16-lane highway) with 46 m cars; now a residential street is 7 m
// (2 x 3.5 m lanes) and an arterial 16 m (4 x 3.5 m lanes + 1.5 m median),
// with 2.5 m sidewalks on each side. Road CENTRELINES are unchanged, so
// missions, barriers, gates and GPS stay exactly where they were — only
// the widths changed. The grid is denser too: downtown blocks are ~150 m
// (was 600 x 450 m), so the map is a real city grid, not a few giant roads.
//
// The graph also builds what world.js does not know about: the square ring
// road around the whole map, the two viaducts (avenue 3300 downtown and
// avenue 7200 at the beach — the road itself rises onto the deck), the two
// hill roads into Cinder Peaks (climbs 1500/4500 rise ~20 m and fall again),
// and the traffic lights at every major junction. Elevation lives on the
// nodes (z) and segments (za/zb); cars, police and pedestrians read it.
//
// Coordinates are world (x, y), y growing south. A lane centre sits 1.75 m
// from the centreline on a residential street (right-hand traffic: offset
// to the right of the direction of travel); on an arterial the outer lane
// is 6 m out and the inner lane 2.5 m out, with the median between them.
// A sidewalk centre sits half + 1.25 m from the centreline.
//
// Nodes are road intersections (plus road ends and gate crossings). A node
// that sits on a district border carries gateDistrict: paths may only pass
// through it when that district is unlocked. Nodes also carry a level:
// 0 = at grade, 1 = elevated (viaduct deck, hill crest). Two nodes can
// share (x, y) at different levels — a street passing under a viaduct.
import {
  ROAD_ART_HALF,
  ROAD_ART_LANE_INNER,
  ROAD_ART_LANE_OUTER,
  ROAD_ART_SIDEWALK_OFFSET,
  ROAD_RES_HALF,
  ROAD_RES_LANE_OFFSET,
  ROAD_RES_SIDEWALK_OFFSET,
  SIDEWALK_WIDTH,
  TRAFFIC_LIGHT_CYCLE,
  TRAFFIC_LIGHT_GREEN,
  TRAFFIC_LIGHT_YELLOW,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';

export const ROAD_HALF = ROAD_RES_HALF;
export const LANE_OFFSET = ROAD_RES_LANE_OFFSET;
export const SIDEWALK_OFFSET = ROAD_RES_SIDEWALK_OFFSET;
export const SIDEWALK_HALF = SIDEWALK_WIDTH / 2;

// The square ring road: an arterial loop around the whole map. Its legs sit
// just inside the map edge (80 m west/north, 9170 m east, 5320 m south) so
// no road ends at the map edge any more — every road terminates into the
// ring. The ring crosses the district walls at three points; those crossings
// are gate nodes (same unlock logic as the four staffed gates: beach after
// main mission 20, peaks after 40), so the loop closes once the districts
// open. NOTE for world.js: the wall solids need matching gaps at
// (80,1350), (9170,1350) and (6000,5320), or the player cannot drive the
// ring through the walls even after unlocking (traffic follows the graph
// and is unaffected, the player's car collides with the wall).
export const RING = { west: 80, east: 9170, north: 80, south: 5320 };

// Viaducts: the avenue itself rises onto the deck. Ramps are one city
// block long; the deck is 9 m (downtown) / 8 m (beach) above the street.
// Hill roads: the climb rises ~20 m mid-way and falls again (a sine
// profile), bridging over the peaks roads it crosses.
export const VIADUCTS = [
  { x: 3300, from: 1700, to: 5250, deckZ: 9, kind: 'viaduct' },
  { x: 7200, from: 2000, to: 5000, deckZ: 8, kind: 'viaduct' },
];
export const HILL_CLIMBS = [
  { x: 1500, from: 80, to: 1350, height: 20, kind: 'hill' },
  { x: 4500, from: 80, to: 1350, height: 20, kind: 'hill' },
];

function nodeKey(x, y, level) {
  return `${x},${y},${level || 0}`;
}

// Split a gap [a, b] into pieces of about `target` m; returns the interior
// cut positions (rounded to whole metres).
function splitGap(a, b, target = 150) {
  const n = Math.max(1, Math.round((b - a) / target));
  const out = [];
  for (let i = 1; i < n; i += 1) out.push(Math.round(a + ((b - a) * i) / n));
  return out;
}

// Narrow the roads world.js laid down to v4 widths, trim their ends to the
// ring road, densify the grid, and add the ring. The `roads` array is
// mutated in place on purpose: world.js renders every road in it, so the
// new and narrowed roads are drawn automatically.
function prepareRoads(roads) {
  const stats = { narrowed: 0, added: 0, arterial: 0, residential: 0 };
  for (const r of roads) {
    r.type = 'residential';
    r.major = true;
    if (r.vertical) {
      const cx = r.x + r.w / 2;
      r.x = cx - ROAD_RES_HALF;
      r.w = ROAD_RES_HALF * 2;
      // BUGFIX (v4): moving the top end down to the ring must shorten the
      // road too — otherwise a peaks climb starting at y=0 would span
      // 80..1430 and poke 80 m past the peaks wall into downtown.
      if (r.y < RING.north + 1) { r.h -= (RING.north - r.y); r.y = RING.north; } // a peaks climb: top at the ring
      if (r.y + r.h > RING.south) r.h = RING.south - r.y; // bottom at the ring
    } else {
      const cy = r.y + r.h / 2;
      r.y = cy - ROAD_RES_HALF;
      r.h = ROAD_RES_HALF * 2;
      // BUGFIX (v4): moving the left end right to the ring must shorten the
      // road too — otherwise a downtown street starting at x=0 would span
      // 80..6080 and swallow the beach roads' west-end nodes, linking
      // downtown avenues straight into the beach and bypassing every gate.
      if (r.x < RING.west + 1) { r.w -= (RING.west - r.x); r.x = RING.west; } // left end at the ring
      if (r.x + r.w > RING.east) r.w = RING.east - r.x; // right end at the ring
    }
    stats.narrowed += 1;
  }

  function addRoad(rect) {
    rect.type = rect.type || 'residential';
    rect.major = !!rect.major;
    roads.push(rect);
    stats.added += 1;
    return rect;
  }
  function vRoad(x, y, h, major = false) {
    return addRoad({ x: x - ROAD_RES_HALF, y, w: ROAD_RES_HALF * 2, h, vertical: true, major });
  }
  function hRoad(x, y, w, major = false) {
    return addRoad({ x, y: y - ROAD_RES_HALF, w, h: ROAD_RES_HALF * 2, vertical: false, major });
  }

  // ---- Dense downtown grid (~150 m blocks) ---------------------------
  // Existing avenues/streets keep their centrelines; new ones split the
  // gaps. The safe house (420-570, 1500-1610) and the airport runway
  // (4050-5250, 4650-4770) are never crossed: those roads are split around
  // them instead, so the house and the runway stay intact.
  const avenues = [...new Set(roads.filter((r) => r.vertical && r.y >= 1350 && r.x + r.w / 2 < 6000)
    .map((r) => r.x + r.w / 2))].sort((a, b) => a - b);
  const streets = [...new Set(roads.filter((r) => !r.vertical && r.y >= 1350 && r.x < 6000)
    .map((r) => r.y + r.h / 2))].sort((a, b) => a - b);
  // Keep-outs: a new avenue must not run through a shop lot — the shop
  // building sits on its lot, and a road through it would put the door on
  // the asphalt. Ironworks Arms (1200), Neon Diner (1800), Velvet Thread
  // (2400) and Turbo Works (3600) keep a 600 m block; the neighbouring
  // new avenues still densify the area. Avenue 4650 is split around the
  // airport runway, like street 4700 already is.
  const SKIP_AVENUES = new Set([1200, 1800, 2400, 3600]);
  const avenueCuts = [0, ...avenues, 6000];
  for (let i = 0; i + 1 < avenueCuts.length; i += 1) {
    for (const x of splitGap(avenueCuts[i], avenueCuts[i + 1])) {
      if (SKIP_AVENUES.has(x)) continue;
      if (x === 450) {
        vRoad(450, 1350, 150); // north of the safe house
        vRoad(450, 1610, RING.south - 1610); // south of it
      } else if (x === 4650) {
        vRoad(4650, 1350, 4650 - 1350); // north of the runway
        vRoad(4650, 4770, RING.south - 4770); // south of it
      } else {
        vRoad(x, 1350, RING.south - 1350);
      }
    }
  }
  const streetCuts = [1350, ...streets, 5400];
  for (let i = 0; i + 1 < streetCuts.length; i += 1) {
    for (const y of splitGap(streetCuts[i], streetCuts[i + 1])) {
      if (y === 1525) {
        hRoad(80, 1525, 340); // west of the safe house
        hRoad(570, 1525, 6000 - 570); // east of it
      } else if (y === 4700) {
        hRoad(80, 4700, 4050 - 80); // west of the runway
        hRoad(5250, 4700, 6000 - 5250); // east of it
      } else {
        // (v4 re-check: with the current base streets the gaps split to
        // 1850/2000 and 3650/3800, so Iron Paradise Gym + Downtown Temple
        // at y=1800 and Sunset Mosque at y=3600 already sit 50 m clear of
        // the nearest new street — no shift needed.)
        hRoad(80, y, 6000 - 80);
      }
    }
  }

  // ---- Beach: resort spacing, avenues placed between the hotel rows ---
  // Hotels sit at x 6500/7300/8100 (120 wide) and y 1700/2750/4150 (160
  // tall); the new avenues run in the gaps between the hotel columns and
  // the new roads in the gaps between the hotel rows, so no road crosses
  // a hotel.
  for (const x of [6200, 6900, 7700, 8500, 9000]) vRoad(x, 1350, RING.south - 1350);
  // Beach roads: 1930 (not 1950) keeps 28 m clear of the Old Lighthouse
  // at (8700, 1958); 3250 (not 3200) keeps the Harbor Chapel at
  // (7550, 3200) clear. The rest run between the hotel rows as before.
  for (const y of [1550, 1930, 2300, 2450, 3250, 3500, 3800, 4600, 4800, 5200]) {
    hRoad(6000, y, RING.east - 6000);
  }

  // ---- Peaks: mountain spacing (a dense grid makes no sense on a mountain)
  // New horizontal roads; y=150/270 are split around the lake (x 6600-8000).
  // y=270 (not 300) keeps the Ski Lodge and the peak cabins at y=300 clear;
  // y=630 (not 600) keeps the cabin at (1630, 600) clear.
  for (const y of [630, 750, 1050, 1200]) hRoad(80, y, RING.east - 80);
  for (const y of [150, 270]) {
    hRoad(80, y, 6560 - 80);
    hRoad(8040, y, RING.east - 8040);
  }
  // 8850 (not 9000): the peak cabin at (9000, 560) sits on the 9000 line.
  for (const x of [2400, 5400, 6300, 8100, 8850]) vRoad(x, RING.north, 1350 - RING.north);

  // ---- The square ring road (arterial, 4 lanes + median) --------------
  addRoad({ x: RING.west - ROAD_ART_HALF, y: RING.north - ROAD_ART_HALF, w: ROAD_ART_HALF * 2, h: RING.south - RING.north + ROAD_ART_HALF * 2, vertical: true, type: 'arterial', major: true });
  addRoad({ x: RING.east - ROAD_ART_HALF, y: RING.north - ROAD_ART_HALF, w: ROAD_ART_HALF * 2, h: RING.south - RING.north + ROAD_ART_HALF * 2, vertical: true, type: 'arterial', major: true });
  addRoad({ x: RING.west - ROAD_ART_HALF, y: RING.north - ROAD_ART_HALF, w: RING.east - RING.west + ROAD_ART_HALF * 2, h: ROAD_ART_HALF * 2, vertical: false, type: 'arterial', major: true });
  addRoad({ x: RING.west - ROAD_ART_HALF, y: RING.south - ROAD_ART_HALF, w: RING.east - RING.west + ROAD_ART_HALF * 2, h: ROAD_ART_HALF * 2, vertical: false, type: 'arterial', major: true });

  // ---- Mark the elevated roads (their segments are built separately) ---
  function markElevated(cx, kind, extra) {
    const r = roads.find((q) => q.vertical && Math.abs((q.x + q.w / 2) - cx) < 1);
    if (!r) return;
    r.elevated = kind;
    r.skipGeneric = true;
    Object.assign(r, extra);
  }
  for (const v of VIADUCTS) markElevated(v.x, 'viaduct', { from: v.from, to: v.to, deckZ: v.deckZ });
  for (const h of HILL_CLIMBS) markElevated(h.x, 'hill', { from: h.from, to: h.to, hillHeight: h.height });

  for (const r of roads) {
    if (r.type === 'arterial') stats.arterial += 1;
    else stats.residential += 1;
  }
  return stats;
}

export function buildRoadGraph(roads, gateNodes, districtAt) {
  const roadStats = prepareRoads(roads);
  // Ring crossings over the district walls use the same gate mechanism as
  // the staffed gates (see RING above).
  const allGates = [...(gateNodes || []),
    { x: RING.west, y: 1350, district: 2 },
    { x: RING.east, y: 1350, district: 2 },
    { x: 6000, y: RING.south, district: 1 },
  ];

  const nodes = [];
  const byKey = new Map();
  function addNode(x, y, crossing, level = 0, z = 0) {
    const key = nodeKey(x, y, level);
    let n = byKey.get(key);
    if (!n) {
      n = {
        id: nodes.length, x, y, z, level,
        crossing: !!crossing, gateDistrict: null,
        district: districtAt(x, y), segs: [], end: false,
      };
      nodes.push(n);
      byKey.set(key, n);
    } else if (crossing) n.crossing = true;
    return n;
  }

  const verticals = roads.filter((r) => r.vertical);
  const horizontals = roads.filter((r) => !r.vertical);

  // Intersections: every vertical road crossing a horizontal one. These are
  // at-grade (level 0) nodes; an elevated road crossing a street still
  // creates one, because the street passes underneath at grade.
  for (const v of verticals) {
    const vx = v.x + v.w / 2;
    for (const h of horizontals) {
      const hy = h.y + h.h / 2;
      if (vx >= h.x && vx <= h.x + h.w && hy >= v.y && hy <= v.y + v.h) {
        addNode(vx, hy, true, 0, 0);
      }
    }
  }
  // Road ends, so paths can reach the edge of the map.
  for (const r of roads) {
    if (r.vertical) {
      addNode(r.x + r.w / 2, r.y + 4, false, 0, 0).end = true;
      addNode(r.x + r.w / 2, r.y + r.h - 4, false, 0, 0).end = true;
    } else {
      addNode(r.x + 4, r.y + r.h / 2, false, 0, 0).end = true;
      addNode(r.x + r.w - 4, r.y + r.h / 2, false, 0, 0).end = true;
    }
  }
  // Gate crossings on the district borders.
  for (const g of allGates) {
    const n = addNode(g.x, g.y, true, 0, 0);
    n.gateDistrict = g.district;
  }

  // Segments: along each road, join consecutive nodes on its centreline.
  const segments = [];
  const segBetween = new Map();
  function link(a, b, info) {
    const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    if (segBetween.has(key)) return segBetween.get(key);
    const vertical = a.x === b.x;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 4) return null;
    const seg = {
      id: segments.length, a: a.id, b: b.id,
      ax: a.x, ay: a.y, bx: b.x, by: b.y, vertical,
      length,
      type: info.type, lanes: info.lanes, half: info.half,
      level: info.level, walkable: info.walkable, major: info.major,
      za: a.z, zb: b.z,
    };
    segments.push(seg);
    segBetween.set(key, seg);
    a.segs.push(seg.id);
    b.segs.push(seg.id);
    return seg;
  }
  function roadInfo(r, level = 0, walkable = true) {
    const arterial = r.type === 'arterial';
    return {
      type: r.type, lanes: arterial ? 4 : 2,
      half: arterial ? ROAD_ART_HALF : ROAD_RES_HALF,
      level, walkable, major: !!r.major,
    };
  }
  // Generic roads: only their at-grade (level 0) nodes, sorted along the
  // centreline. Elevated roads are skipped here and built below.
  for (const r of roads) {
    if (r.skipGeneric) continue;
    let onRoad;
    if (r.vertical) {
      const vx = r.x + r.w / 2;
      onRoad = nodes.filter((n) => n.level === 0 && n.x === vx && n.y >= r.y - 1 && n.y <= r.y + r.h + 1)
        .sort((p, q) => p.y - q.y);
    } else {
      const hy = r.y + r.h / 2;
      onRoad = nodes.filter((n) => n.level === 0 && n.y === hy && n.x >= r.x - 1 && n.x <= r.x + r.w + 1)
        .sort((p, q) => p.x - q.x);
    }
    for (let i = 0; i + 1 < onRoad.length; i += 1) link(onRoad[i], onRoad[i + 1], roadInfo(r, 0, true));
  }

  // Elevated roads: the road itself rises. Profile nodes sit at every
  // crossing inside the elevated stretch (level 1, at the deck/hill
  // height); outside it the road stays at grade (level 0). The link list
  // is the sorted union of the profile nodes and the at-grade nodes near
  // the ends — the at-grade crossing nodes in the middle are NOT linked,
  // because the street passes underneath and never joins the deck.
  function elevationAtProfile(r, pos) {
    if (r.elevated === 'viaduct') return r.deckZ;
    const span = r.to - r.from;
    return r.hillHeight * Math.sin((Math.PI * (r.to - pos)) / span);
  }
  for (const r of roads) {
    if (!r.elevated) continue;
    const vertical = r.vertical;
    const c = vertical ? r.x + r.w / 2 : r.y + r.h / 2;
    // Crossings inside the stretch, from the roads that cross this one.
    const crossers = vertical
      ? horizontals.filter((h) => c >= h.x && c <= h.x + h.w)
      : verticals.filter((v) => c >= v.y && c <= v.y + v.h);
    for (const q of crossers) {
      const pos = vertical ? q.y + q.h / 2 : q.x + q.w / 2;
      if (pos > r.from && pos < r.to) {
        addNode(vertical ? c : pos, vertical ? pos : c, false, 1, elevationAtProfile(r, pos));
      }
    }
    // Link list: level-1 profile nodes, plus at-grade nodes at/near the
    // ends (road ends, gates, ring crossings, approach intersections).
    // At-grade crossing nodes inside the stretch are NOT linked: the street
    // passes underneath and never joins the deck.
    const onLine = nodes.filter((n) => {
      if (vertical ? n.x !== c : n.y !== c) return false;
      const pos = vertical ? n.y : n.x;
      if (n.level === 1) return pos > r.from && pos < r.to;
      return n.end || n.gateDistrict !== null || pos <= r.from || pos >= r.to;
    }).sort((p, q) => (vertical ? p.y - q.y : p.x - q.x));
    for (let i = 0; i + 1 < onLine.length; i += 1) {
      const a = onLine[i];
      const b = onLine[i + 1];
      const level = a.level === 1 || b.level === 1 ? 1 : 0;
      const walkable = r.elevated === 'hill' ? true : level === 0;
      link(a, b, roadInfo(r, level, walkable));
    }
  }

  // Traffic lights: at-grade junctions of two major roads (a real
  // intersection, not a corner or a street passing under a viaduct).
  const trafficLights = [];
  for (const n of nodes) {
    if (n.level !== 0 || !n.crossing || n.segs.length < 3) continue;
    let majorV = false;
    let majorH = false;
    for (const segId of n.segs) {
      const s = segments[segId];
      if (!s.major) continue;
      if (s.vertical) majorV = true;
      else majorH = true;
    }
    if (majorV && majorH) {
      n.light = true;
      trafficLights.push({ nodeId: n.id, x: n.x, y: n.y });
    }
  }

  // A light's cycle is a pure function of (node, time): 12 s green, 3 s
  // yellow per axis, 30 s total, offset per node so the city is not in sync.
  function lightStateAt(nodeId, t) {
    const off = (nodeId * 7) % TRAFFIC_LIGHT_CYCLE;
    const phase = (((t || 0) + off) % TRAFFIC_LIGHT_CYCLE + TRAFFIC_LIGHT_CYCLE) % TRAFFIC_LIGHT_CYCLE;
    if (phase < TRAFFIC_LIGHT_GREEN) return { ns: 'green', ew: 'red' };
    if (phase < TRAFFIC_LIGHT_GREEN + TRAFFIC_LIGHT_YELLOW) return { ns: 'yellow', ew: 'red' };
    if (phase < TRAFFIC_LIGHT_GREEN + TRAFFIC_LIGHT_YELLOW + TRAFFIC_LIGHT_GREEN) return { ns: 'red', ew: 'green' };
    return { ns: 'red', ew: 'yellow' };
  }

  function nodeAt(x, y, level = 0) {
    return byKey.get(nodeKey(x, y, level)) || null;
  }

  function nearestNode(x, y, allowedDistricts, zHint = 0) {
    let best = null;
    let bestD = Infinity;
    for (const n of nodes) {
      if (allowedDistricts && !allowedDistricts.includes(n.district) && n.gateDistrict === null) continue;
      const dz = (n.z - zHint) * 12;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2 + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  // Closest point on any road centreline, with its segment and parameter.
  function nearestSegmentPoint(x, y) {
    let best = null;
    let bestD = Infinity;
    for (const s of segments) {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = s.ax + dx * t;
      const py = s.ay + dy * t;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = { seg: s, t, x: px, y: py, dist: Math.sqrt(d) };
      }
    }
    return best;
  }

  // Road elevation at a point, aware of stacked roads: among the segments
  // whose corridor the point is inside, prefer the one whose height is
  // closest to the caller's current height — so a car under a viaduct stays
  // on the street below, and a car on the deck stays on the deck. Off-road
  // (no corridor nearby) the elevation is ground (0).
  function elevationAt(x, y, zHint = 0) {
    let best = null;
    let bestScore = Infinity;
    for (const s of segments) {
      const dx = s.bx - s.ax;
      const dy = s.by - s.ay;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((x - s.ax) * dx + (y - s.ay) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = s.ax + dx * t;
      const py = s.ay + dy * t;
      const dist = Math.hypot(px - x, py - y);
      if (dist > s.half + 2) continue;
      const elev = s.za + (s.zb - s.za) * t;
      const score = dist + Math.abs(elev - zHint) * 12;
      if (score < bestScore) {
        bestScore = score;
        best = { elev, dist, seg: s, t };
      }
    }
    return best || { elev: 0, dist: Infinity, seg: null, t: 0 };
  }

  // Unit vector to the right of the a->b direction (y grows south, so the
  // right of east is south: right(dx, dy) = (-dy, dx)).
  function rightOf(seg) {
    const d = Math.max(1, seg.length);
    return { x: -(seg.by - seg.ay) / d, y: (seg.bx - seg.ax) / d };
  }

  function pointOn(seg, t, offset) {
    const r = rightOf(seg);
    return {
      x: seg.ax + (seg.bx - seg.ax) * t + r.x * offset,
      y: seg.ay + (seg.by - seg.ay) * t + r.y * offset,
      z: seg.za + (seg.zb - seg.za) * t,
    };
  }

  // Lane offset for a direction on this segment: residential has one lane
  // per direction (1.75 m out); arterial has two (outer 6 m, inner 2.5 m).
  function laneOffset(seg, dir, lane = 0) {
    const base = seg.lanes === 4 ? (lane === 0 ? ROAD_ART_LANE_OUTER : ROAD_ART_LANE_INNER) : ROAD_RES_LANE_OFFSET;
    return base * (dir >= 0 ? 1 : -1);
  }

  // Point in the right-hand lane for travel in direction dir (+1 = a->b,
  // -1 = b->a). dir flips the right side, so both directions keep right.
  // lane 0 is the outer lane, lane 1 the inner one (arterial only).
  function lanePoint(seg, t, dir, lane = 0) {
    return pointOn(seg, t, laneOffset(seg, dir, lane));
  }

  // Point on the sidewalk. side +1 is the right sidewalk when travelling
  // a->b, -1 the left one.
  function sidewalkPoint(seg, t, side) {
    return pointOn(seg, t, (seg.half + SIDEWALK_WIDTH / 2) * (side >= 0 ? 1 : -1));
  }

  function nearestSidewalkPoint(x, y) {
    const near = nearestSegmentPoint(x, y);
    if (!near) return { x, y, z: 0 };
    // Pick the sidewalk side closer to the query point.
    const right = sidewalkPoint(near.seg, near.t, 1);
    const left = sidewalkPoint(near.seg, near.t, -1);
    const dr = (right.x - x) ** 2 + (right.y - y) ** 2;
    const dl = (left.x - x) ** 2 + (left.y - y) ** 2;
    return dr <= dl ? right : left;
  }

  function nearestLanePoint(x, y) {
    const near = nearestSegmentPoint(x, y);
    if (!near) return { x, y, z: 0 };
    return lanePoint(near.seg, near.t, 1);
  }

  function segmentBetween(aId, bId) {
    return segBetween.get(`${Math.min(aId, bId)}-${Math.max(aId, bId)}`) || null;
  }

  // Breadth-first search over intersection nodes. Gate nodes are only
  // passable when their district is unlocked. opts.allowElevated=false
  // keeps pedestrians off viaduct decks (hill roads are walkable, so they
  // stay allowed). Returns the node points from start to goal (inclusive),
  // or null when no route exists.
  function findPath(x1, y1, x2, y2, unlocked, opts = {}) {
    const allowElevated = opts.allowElevated !== false;
    const start = nearestNode(x1, y1, undefined, opts.z1 || 0);
    const goal = nearestNode(x2, y2, undefined, opts.z2 || 0);
    if (!start || !goal) return null;
    if (start.id === goal.id) return [{ x: x2, y: y2, z: goal.z, level: goal.level }];
    const prev = new Map([[start.id, -1]]);
    const queue = [start.id];
    let qi = 0;
    while (qi < queue.length) {
      const cur = queue[qi];
      qi += 1;
      if (cur === goal.id) break;
      const node = nodes[cur];
      for (const segId of node.segs) {
        const seg = segments[segId];
        if (!allowElevated && seg.level !== 0 && !seg.walkable) continue;
        const nextId = seg.a === cur ? seg.b : seg.a;
        if (prev.has(nextId)) continue;
        const next = nodes[nextId];
        if (next.gateDistrict !== null && !(unlocked && unlocked[next.gateDistrict])) continue;
        prev.set(nextId, cur);
        queue.push(nextId);
      }
    }
    if (!prev.has(goal.id)) return null;
    const path = [];
    let cur = goal.id;
    while (cur !== -1) {
      path.push({ x: nodes[cur].x, y: nodes[cur].y, z: nodes[cur].z, level: nodes[cur].level });
      cur = prev.get(cur);
    }
    path.reverse();
    return path;
  }

  // Sidewalk waypoints for a node path: each leg is walked on its right-hand
  // sidewalk, so the only road crossings happen at intersections (the zebra
  // zone), when the path turns onto a new leg. Waypoints sit a fixed 4 m
  // from each node, so a very long leg does not start with a long diagonal
  // hop across the road. The first leg keeps the side the walker is already
  // on (startPos), so joining the path never means crossing the road
  // mid-block: the crossing waits for the first turn, at an intersection.
  function sidewalkWaypoints(nodePath, startPos) {
    if (!nodePath || nodePath.length === 0) return [];
    const out = [];
    for (let i = 0; i + 1 < nodePath.length; i += 1) {
      const a = nodeAt(nodePath[i].x, nodePath[i].y, nodePath[i].level || 0);
      const b = nodeAt(nodePath[i + 1].x, nodePath[i + 1].y, nodePath[i + 1].level || 0);
      if (!a || !b) continue;
      const seg = segmentBetween(a.id, b.id);
      if (!seg) continue;
      // Travel direction along the segment as stored or reversed.
      const forward = seg.a === a.id;
      let side = forward ? 1 : -1;
      if (i === 0 && startPos) {
        const r = rightOf(seg);
        const mx = (seg.ax + seg.bx) / 2;
        const my = (seg.ay + seg.by) / 2;
        const off = (startPos.x - mx) * r.x + (startPos.y - my) * r.y;
        if (Math.abs(off) <= 8) side = off >= 0 ? 1 : -1;
      }
      if (seg.length < 10) {
        out.push(sidewalkPoint(seg, 0.5, side));
      } else {
        const d = Math.min(4, seg.length * 0.25) / seg.length;
        const t0 = forward ? d : 1 - d;
        const t1 = forward ? 1 - d : d;
        out.push(sidewalkPoint(seg, t0, side));
        out.push(sidewalkPoint(seg, t1, side));
      }
    }
    return out;
  }

  function isOnRoad(x, y, pad = 0.5) {
    const near = nearestSegmentPoint(x, y);
    return !!near && near.dist <= near.seg.half + pad;
  }

  function isOnSidewalk(x, y) {
    // Inside an intersection square: a zebra crossing, allowed. The square
    // covers the widest road half (8) + sidewalk (2.5) + a little margin.
    for (const n of nodes) {
      if (n.crossing && n.level === 0 && Math.abs(x - n.x) <= 12 && Math.abs(y - n.y) <= 12) return true;
    }
    const near = nearestSegmentPoint(x, y);
    if (!near) return false;
    // Sidewalk band: just outside the road edge, on either side.
    return near.dist >= near.seg.half - 0.5 && near.dist <= near.seg.half + SIDEWALK_WIDTH + 1;
  }

  function randomNode(rng, allowedDistricts, opts = {}) {
    const pool = nodes.filter((n) => {
      if (allowedDistricts && !allowedDistricts.includes(n.district)) return false;
      if (opts.groundOnly && n.level !== 0) {
        const walkable = n.segs.some((s) => segments[s].walkable);
        if (!walkable) return false;
      }
      return true;
    });
    if (pool.length === 0) return nodes[0];
    return pool[Math.floor(rng.next() * pool.length)];
  }

  function randomSidewalkPoint(rng, allowedDistricts) {
    const segPool = segments.filter((s) => {
      if (s.level !== 0 && !s.walkable) return false;
      const d = districtAt((s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      return !allowedDistricts || allowedDistricts.includes(d);
    });
    const seg = segPool.length > 0
      ? segPool[Math.floor(rng.next() * segPool.length)]
      : segments[Math.floor(rng.next() * segments.length)];
    return sidewalkPoint(seg, rng.range(0.05, 0.95), rng.next() < 0.5 ? 1 : -1);
  }

  function randomLanePoint(rng, allowedDistricts, opts = {}) {
    const segPool = segments.filter((s) => {
      if (opts.groundOnly && s.level !== 0) return false;
      const d = districtAt((s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      return !allowedDistricts || allowedDistricts.includes(d);
    });
    const seg = segPool.length > 0
      ? segPool[Math.floor(rng.next() * segPool.length)]
      : segments[Math.floor(rng.next() * segments.length)];
    const dir = rng.next() < 0.5 ? 1 : -1;
    const lane = seg.lanes === 4 && rng.next() < 0.3 ? 1 : 0;
    return { point: lanePoint(seg, rng.range(0.05, 0.95), dir, lane), seg, dir, lane };
  }

  return {
    nodes, segments, trafficLights, roadStats,
    nearestNode, nearestSegmentPoint, elevationAt,
    lanePoint, sidewalkPoint, nearestSidewalkPoint, nearestLanePoint,
    findPath, sidewalkWaypoints, isOnRoad, isOnSidewalk,
    randomNode, randomSidewalkPoint, randomLanePoint,
    segmentBetween, lightStateAt, nodeAt,
  };
}
