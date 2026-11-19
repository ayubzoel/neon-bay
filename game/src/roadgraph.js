// Neon Bay — the road graph: intersections, lanes, sidewalks and zebra
// crossings, built from the road rectangles world.js lays down.
// Everything that moves on the street uses this graph, so pedestrians stay
// on sidewalks, traffic stays in its lane, and police chase along roads
// instead of cutting through buildings.
//
// Coordinates are world (x, y), y growing south. A road is 64 wide, so its
// centreline is 32 from each edge; a lane centre sits 14 from the centreline
// (right-hand traffic: offset to the right of the direction of travel) and
// a sidewalk centre sits 42 from it (32 road half + 10 sidewalk half).
//
// Nodes are road intersections (plus road ends and gate crossings). A node
// that sits on a district border carries gateDistrict: paths may only pass
// through it when that district is unlocked.
export const ROAD_HALF = 32;
export const LANE_OFFSET = 14;
export const SIDEWALK_OFFSET = 42;
export const SIDEWALK_HALF = 12;

function nodeKey(x, y) {
  return `${x},${y}`;
}

export function buildRoadGraph(roads, gateNodes, districtAt) {
  const nodes = [];
  const byKey = new Map();
  function addNode(x, y, crossing) {
    const key = nodeKey(x, y);
    let n = byKey.get(key);
    if (!n) {
      n = { id: nodes.length, x, y, crossing: !!crossing, gateDistrict: null, district: districtAt(x, y), segs: [] };
      nodes.push(n);
      byKey.set(key, n);
    } else if (crossing) n.crossing = true;
    return n;
  }

  const verticals = roads.filter((r) => r.vertical);
  const horizontals = roads.filter((r) => !r.vertical);

  // Intersections: every vertical road crossing a horizontal one.
  for (const v of verticals) {
    const vx = v.x + v.w / 2;
    for (const h of horizontals) {
      const hy = h.y + h.h / 2;
      if (vx >= h.x && vx <= h.x + h.w && hy >= v.y && hy <= v.y + v.h) {
        addNode(vx, hy, true);
      }
    }
  }
  // Road ends, so paths can reach the edge of the map.
  for (const r of roads) {
    if (r.vertical) {
      addNode(r.x + r.w / 2, r.y + 40, false);
      addNode(r.x + r.w / 2, r.y + r.h - 40, false);
    } else {
      addNode(r.x + 40, r.y + r.h / 2, false);
      addNode(r.x + r.w - 40, r.y + r.h / 2, false);
    }
  }
  // Gate crossings on the district borders.
  for (const g of gateNodes || []) {
    const n = addNode(g.x, g.y, true);
    n.gateDistrict = g.district;
  }

  // Segments: along each road, join consecutive nodes on its centreline.
  const segments = [];
  const segBetween = new Map();
  function link(a, b) {
    const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
    if (segBetween.has(key)) return segBetween.get(key);
    const vertical = a.x === b.x;
    const seg = {
      id: segments.length, a: a.id, b: b.id,
      ax: a.x, ay: a.y, bx: b.x, by: b.y, vertical,
      length: Math.hypot(b.x - a.x, b.y - a.y),
    };
    if (seg.length < 4) return null;
    segments.push(seg);
    segBetween.set(key, seg);
    a.segs.push(seg.id);
    b.segs.push(seg.id);
    return seg;
  }
  for (const r of roads) {
    let onRoad;
    if (r.vertical) {
      const vx = r.x + r.w / 2;
      onRoad = nodes.filter((n) => n.x === vx && n.y >= r.y - 1 && n.y <= r.y + r.h + 1)
        .sort((p, q) => p.y - q.y);
    } else {
      const hy = r.y + r.h / 2;
      onRoad = nodes.filter((n) => n.y === hy && n.x >= r.x - 1 && n.x <= r.x + r.w + 1)
        .sort((p, q) => p.x - q.x);
    }
    for (let i = 0; i + 1 < onRoad.length; i += 1) link(onRoad[i], onRoad[i + 1]);
  }

  function nodeAt(x, y) {
    return byKey.get(nodeKey(x, y)) || null;
  }

  function nearestNode(x, y, allowedDistricts) {
    let best = null;
    let bestD = Infinity;
    for (const n of nodes) {
      if (allowedDistricts && !allowedDistricts.includes(n.district) && n.gateDistrict === null) continue;
      const d = (n.x - x) ** 2 + (n.y - y) ** 2;
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
    };
  }

  // Point in the right-hand lane for travel in direction dir (+1 = a->b,
  // -1 = b->a). dir flips the right side, so both directions keep right.
  function lanePoint(seg, t, dir) {
    return pointOn(seg, t, LANE_OFFSET * (dir >= 0 ? 1 : -1));
  }

  // Point on the sidewalk. side +1 is the right sidewalk when travelling
  // a->b, -1 the left one.
  function sidewalkPoint(seg, t, side) {
    return pointOn(seg, t, SIDEWALK_OFFSET * (side >= 0 ? 1 : -1));
  }

  function nearestSidewalkPoint(x, y) {
    const near = nearestSegmentPoint(x, y);
    if (!near) return { x, y };
    // Pick the sidewalk side closer to the query point.
    const right = sidewalkPoint(near.seg, near.t, 1);
    const left = sidewalkPoint(near.seg, near.t, -1);
    const dr = (right.x - x) ** 2 + (right.y - y) ** 2;
    const dl = (left.x - x) ** 2 + (left.y - y) ** 2;
    return dr <= dl ? right : left;
  }

  function nearestLanePoint(x, y) {
    const near = nearestSegmentPoint(x, y);
    if (!near) return { x, y };
    return lanePoint(near.seg, near.t, 1);
  }

  // Breadth-first search over intersection nodes. Gate nodes are only
  // passable when their district is unlocked. Returns the node points from
  // start to goal (inclusive), or null when no route exists.
  function findPath(x1, y1, x2, y2, unlocked) {
    const start = nearestNode(x1, y1);
    const goal = nearestNode(x2, y2);
    if (!start || !goal) return null;
    if (start.id === goal.id) return [{ x: x2, y: y2 }];
    const prev = new Map([[start.id, -1]]);
    const queue = [start.id];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur === goal.id) break;
      const node = nodes[cur];
      for (const segId of node.segs) {
        const seg = segments[segId];
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
      path.push({ x: nodes[cur].x, y: nodes[cur].y });
      cur = prev.get(cur);
    }
    path.reverse();
    return path;
  }

  // Sidewalk waypoints for a node path: each leg is walked on its right-hand
  // sidewalk, so the only road crossings happen at intersections (the zebra
  // zone), when the path turns onto a new leg. Waypoints sit a fixed 30
  // units from each node, so a very long leg does not start with a long
  // diagonal hop across the road. The first leg keeps the side the walker
  // is already on (startPos), so joining the path never means crossing the
  // road mid-block: the crossing waits for the first turn, at an intersection.
  function sidewalkWaypoints(nodePath, startPos) {
    if (!nodePath || nodePath.length === 0) return [];
    const out = [];
    for (let i = 0; i + 1 < nodePath.length; i += 1) {
      const a = nodeAt(nodePath[i].x, nodePath[i].y);
      const b = nodeAt(nodePath[i + 1].x, nodePath[i + 1].y);
      if (!a || !b) continue;
      const key = `${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`;
      const seg = segBetween.get(key);
      if (!seg) continue;
      // Travel direction along the segment as stored or reversed.
      const forward = seg.a === a.id;
      let side = forward ? 1 : -1;
      if (i === 0 && startPos) {
        const r = rightOf(seg);
        const mx = (seg.ax + seg.bx) / 2;
        const my = (seg.ay + seg.by) / 2;
        const off = (startPos.x - mx) * r.x + (startPos.y - my) * r.y;
        if (Math.abs(off) <= 70) side = off >= 0 ? 1 : -1;
      }
      if (seg.length < 70) {
        out.push(sidewalkPoint(seg, 0.5, side));
      } else {
        const d = Math.min(30, seg.length * 0.25) / seg.length;
        const t0 = forward ? d : 1 - d;
        const t1 = forward ? 1 - d : d;
        out.push(sidewalkPoint(seg, t0, side));
        out.push(sidewalkPoint(seg, t1, side));
      }
    }
    return out;
  }

  function isOnRoad(x, y, pad = 6) {
    const near = nearestSegmentPoint(x, y);
    return !!near && near.dist <= ROAD_HALF + pad;
  }

  function isOnSidewalk(x, y) {
    // Inside an intersection square: a zebra crossing, allowed. The square
    // covers road half (32) + sidewalk (20) + a little margin.
    for (const n of nodes) {
      if (n.crossing && Math.abs(x - n.x) <= ROAD_HALF + 22 && Math.abs(y - n.y) <= ROAD_HALF + 22) return true;
    }
    const near = nearestSegmentPoint(x, y);
    if (!near) return false;
    // Sidewalk band: just outside the road edge, on either side.
    return near.dist >= ROAD_HALF - 4 && near.dist <= ROAD_HALF + SIDEWALK_HALF + 8;
  }

  function randomNode(rng, allowedDistricts) {
    const pool = allowedDistricts
      ? nodes.filter((n) => allowedDistricts.includes(n.district))
      : nodes;
    if (pool.length === 0) return nodes[0];
    return pool[Math.floor(rng.next() * pool.length)];
  }

  function randomSidewalkPoint(rng, allowedDistricts) {
    const segPool = segments.filter((s) => {
      const d = districtAt((s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      return !allowedDistricts || allowedDistricts.includes(d);
    });
    const seg = segPool.length > 0
      ? segPool[Math.floor(rng.next() * segPool.length)]
      : segments[Math.floor(rng.next() * segments.length)];
    return sidewalkPoint(seg, rng.range(0.05, 0.95), rng.next() < 0.5 ? 1 : -1);
  }

  function randomLanePoint(rng, allowedDistricts) {
    const segPool = segments.filter((s) => {
      const d = districtAt((s.ax + s.bx) / 2, (s.ay + s.by) / 2);
      return !allowedDistricts || allowedDistricts.includes(d);
    });
    const seg = segPool.length > 0
      ? segPool[Math.floor(rng.next() * segPool.length)]
      : segments[Math.floor(rng.next() * segments.length)];
    const dir = rng.next() < 0.5 ? 1 : -1;
    return { point: lanePoint(seg, rng.range(0.05, 0.95), dir), seg, dir };
  }

  return {
    nodes, segments,
    nearestNode, nearestSegmentPoint,
    lanePoint, sidewalkPoint, nearestSidewalkPoint, nearestLanePoint,
    findPath, sidewalkWaypoints, isOnRoad, isOnSidewalk,
    randomNode, randomSidewalkPoint, randomLanePoint,
  };
}
