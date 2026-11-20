// Neon Bay — the interactive map + GPS navigation (Builder C, v3).
//
// One module for everything map-shaped:
//  - the destination list (mission, side jobs, shops, safe house,
//    activities, airport, contacts, any road point),
//  - GPS routing along the road graph (never a straight line through
//    buildings), remaining distance, and arrival,
//  - the full-screen map panel: zoom (wheel / buttons / pinch), pan
//    (drag), click-to-navigate, symbols and legend,
//  - the small symbols + route the minimap and the HUD reuse.
//
// The map panel itself is DOM (#mapPanel in index.html) with its own 2D
// canvas; the game loop pauses while it is open (main.js), so the world
// behind it is frozen. No network, no assets: every glyph is text.
import { DISTRICT_RECTS, SAFE_HOUSE, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { ACTIVITY_SPOTS, PEAK_HOMES, WORSHIP_PLACES } from './data.js';
import { showMessage } from './state.js';
import { missionTitle } from './missions.js';
import { addStrings, onLangChange, t } from './i18n.js';

// v4 i18n: every word the map shows — legend, groups, GPS messages.
// Place NAMES (shops, worship places, roads) are proper nouns and stay;
// the words around them translate. Mission wrappers reuse the keys
// registered in missions.js ('mission.objectiveNext', 'mission.sideStarted').
addStrings('en', {
  'map.symbol.mission': 'Main mission',
  'map.symbol.side': 'Side job',
  'map.symbol.food': 'Food — diner / cafe',
  'map.symbol.gun': 'Gun shop',
  'map.symbol.clothes': 'Clothes shop',
  'map.symbol.mods': 'Car mods workshop',
  'map.symbol.safehouse': 'Safe house',
  'map.symbol.pool': 'Pool',
  'map.symbol.golf': 'Golf',
  'map.symbol.race': 'Race',
  'map.symbol.swim': 'Swim',
  'map.symbol.darts': 'Darts',
  'map.symbol.gym': 'Gym',
  'map.symbol.fish': 'Fishing',
  'map.symbol.airport': 'Airport',
  'map.symbol.npc': 'Contact — Maya / Rico',
  'map.symbol.road': 'Road point',
  'map.symbol.player': 'You — Leo Vance',
  'map.symbol.worship': 'Place of worship',
  'map.symbol.housing': 'Housing block',
  'map.symbol.flyover': 'Ring-road flyover',
  'map.lockedLegend': 'Locked district — finish the mission to open it',
  'map.locked': 'LOCKED',
  'map.lockedSuffix': ' — locked',
  'map.lockedBeach': 'Sunset Beach is locked — finish Main Mission 20 to open the gate.',
  'map.lockedPeaks': 'Cinder Peaks is locked — finish Main Mission 40 to open the gate.',
  'map.noRoute': 'No road route to that spot — pick somewhere the roads reach.',
  'map.gpsSet': 'GPS: {label} — {total} m',
  'map.roadPoint': 'Road point',
  'map.navCancelled': 'Navigation cancelled.',
  'map.offRoad': 'That spot is off the road — pick a place from the list or tap a road.',
  'map.noDest': 'No destination — pick a place or tap a road',
  'map.group.jobs': 'Jobs',
  'map.group.shops': 'Shops',
  'map.group.places': 'Places',
  'map.group.activities': 'Activities',
  'map.group.landmarks': 'Landmarks',
  'map.dest.safehouse': 'Safe House',
  'map.dest.airport': 'Airport — Cargo Terminal',
  'map.dest.maya': 'Maya Reyes (contact)',
  'map.dest.rico': 'Rico Alvarez (missions)',
  'map.landmark.home': 'Peak Home · {road}',
  'map.landmark.flyoverNorth': 'North Ring Flyover',
  'map.landmark.flyoverWest': 'West Ring Flyover',
  'map.landmark.flyoverEast': 'East Ring Flyover',
  'map.landmark.flyoverSouth': 'South Ring Flyover',
});
addStrings('id', {
  'map.symbol.mission': 'Misi utama',
  'map.symbol.side': 'Pekerjaan sampingan',
  'map.symbol.food': 'Makanan — restoran / kafe',
  'map.symbol.gun': 'Toko senjata',
  'map.symbol.clothes': 'Toko pakaian',
  'map.symbol.mods': 'Bengkel modifikasi mobil',
  'map.symbol.safehouse': 'Safe house',
  'map.symbol.pool': 'Biliar',
  'map.symbol.golf': 'Golf',
  'map.symbol.race': 'Balapan',
  'map.symbol.swim': 'Renang',
  'map.symbol.darts': 'Dart',
  'map.symbol.gym': 'Gym',
  'map.symbol.fish': 'Memancing',
  'map.symbol.airport': 'Bandara',
  'map.symbol.npc': 'Kontak — Maya / Rico',
  'map.symbol.road': 'Titik jalan',
  'map.symbol.player': 'Kamu — Leo Vance',
  'map.symbol.worship': 'Tempat ibadah',
  'map.symbol.housing': 'Blok perumahan',
  'map.symbol.flyover': 'Flyover jalan lingkar',
  'map.lockedLegend': 'Wilayah terkunci — selesaikan misi untuk membukanya',
  'map.locked': 'TERKUNCI',
  'map.lockedSuffix': ' — terkunci',
  'map.lockedBeach': 'Sunset Beach terkunci — selesaikan Misi Utama 20 untuk membuka gerbang.',
  'map.lockedPeaks': 'Cinder Peaks terkunci — selesaikan Misi Utama 40 untuk membuka gerbang.',
  'map.noRoute': 'Tidak ada rute jalan ke tempat itu — pilih tempat yang terjangkau jalan.',
  'map.gpsSet': 'GPS: {label} — {total} m',
  'map.roadPoint': 'Titik jalan',
  'map.navCancelled': 'Navigasi dibatalkan.',
  'map.offRoad': 'Tempat itu di luar jalan — pilih dari daftar atau ketuk jalan.',
  'map.noDest': 'Belum ada tujuan — pilih tempat atau ketuk jalan',
  'map.group.jobs': 'Pekerjaan',
  'map.group.shops': 'Toko',
  'map.group.places': 'Tempat',
  'map.group.activities': 'Aktivitas',
  'map.group.landmarks': 'Landmark',
  'map.dest.safehouse': 'Safe House',
  'map.dest.airport': 'Bandara — Terminal Kargo',
  'map.dest.maya': 'Maya Reyes (kontak)',
  'map.dest.rico': 'Rico Alvarez (misi)',
  'map.landmark.home': 'Rumah Peak · {road}',
  'map.landmark.flyoverNorth': 'Flyover Lingkar Utara',
  'map.landmark.flyoverWest': 'Flyover Lingkar Barat',
  'map.landmark.flyoverEast': 'Flyover Lingkar Timur',
  'map.landmark.flyoverSouth': 'Flyover Lingkar Selatan',
});

const GROUND = ['#3a3f4a', '#d9b96a', '#6b7a72'];

/**
 * v4 landmarks (Builder C): places the v4 city adds — houses of worship,
 * housing blocks and ring-road flyovers. Worship places and peak homes
 * come straight from Builder A's data.js (WORSHIP_PLACES, PEAK_HOMES) so
 * the symbols always match the buildings world.js actually builds; the
 * map never invents a place of its own.
 * NOTE for the tester / Builders A+B: the four flyovers mark the ring
 * road's four legs at the map's edge midpoints — no ring-road geometry
 * exists in data.js/roadgraph.js yet, so these four points are
 * provisional. When Builder A builds the ring road, move them onto the
 * real overpasses; the symbols, legend and GPS entries follow this table.
 */
export const V4_LANDMARKS = [
  ...WORSHIP_PLACES.map((w, i) => ({
    id: `lm-worship-${i}`, kind: 'worship', label: w.name, x: w.x, y: w.y,
  })),
  ...PEAK_HOMES.map((h, i) => ({
    id: `lm-home-${i}`, kind: 'housing',
    // Homes have no names in data.js — label by the road they sit on.
    // The label is resolved at render time (labelKey + labelVars) so a
    // language switch re-labels them without rebuilding this table.
    labelKey: 'map.landmark.home',
    labelVars: {
      road: Math.abs(h.x - 1500) < 200 || Math.abs(h.x - 3600) < 200 || Math.abs(h.x - 4500) < 200 || Math.abs(h.x - 8400) < 200
        ? 'Climb Rd'
        : h.y < 700 ? 'Ridge Rd' : 'Valley Rd',
    },
    x: h.x, y: h.y,
  })),
  // Ring-road flyovers (provisional edge midpoints — see note above).
  { id: 'lm-flyover-north', kind: 'flyover', labelKey: 'map.landmark.flyoverNorth', x: 4800, y: 150 },
  { id: 'lm-flyover-west', kind: 'flyover', labelKey: 'map.landmark.flyoverWest', x: 150, y: 2700 },
  { id: 'lm-flyover-east', kind: 'flyover', labelKey: 'map.landmark.flyoverEast', x: 9050, y: 2700 },
  { id: 'lm-flyover-south', kind: 'flyover', labelKey: 'map.landmark.flyoverSouth', x: 4800, y: 5250 },
];

/** Resolve a landmark's display label in the active language. */
export function landmarkLabel(lm) {
  return lm.labelKey ? t(lm.labelKey, lm.labelVars) : lm.label;
}

/** Which district a world point sits in (0 Downtown, 1 Beach, 2 Peaks). */
export function districtAt(x, y) {
  if (y < DISTRICT_RECTS[2].y + DISTRICT_RECTS[2].h) return 2;
  if (x >= DISTRICT_RECTS[1].x) return 1;
  return 0;
}

/** One symbol per kind of place: an emoji glyph, a colour, a legend label.
 *  `label` stays as the English default (render.js reads only color/emoji);
 *  `labelKey` is the i18n key resolved at render time by symbolLabel(). */
export const SYMBOLS = {
  mission: { emoji: '⭐', color: '#fde047', label: 'Main mission', labelKey: 'map.symbol.mission' },
  side: { emoji: '💼', color: '#60a5fa', label: 'Side job', labelKey: 'map.symbol.side' },
  food: { emoji: '🍔', color: '#f59e0b', label: 'Food — diner / cafe', labelKey: 'map.symbol.food' },
  gun: { emoji: '🔫', color: '#ef4444', label: 'Gun shop', labelKey: 'map.symbol.gun' },
  clothes: { emoji: '👕', color: '#ec4899', label: 'Clothes shop', labelKey: 'map.symbol.clothes' },
  mods: { emoji: '🔧', color: '#22d3ee', label: 'Car mods workshop', labelKey: 'map.symbol.mods' },
  safehouse: { emoji: '🏠', color: '#a78bfa', label: 'Safe house', labelKey: 'map.symbol.safehouse' },
  pool: { emoji: '🎱', color: '#f97316', label: 'Pool', labelKey: 'map.symbol.pool' },
  golf: { emoji: '⛳', color: '#22c55e', label: 'Golf', labelKey: 'map.symbol.golf' },
  race: { emoji: '🏁', color: '#eab308', label: 'Race', labelKey: 'map.symbol.race' },
  swim: { emoji: '🏊', color: '#38bdf8', label: 'Swim', labelKey: 'map.symbol.swim' },
  darts: { emoji: '🎯', color: '#f472b6', label: 'Darts', labelKey: 'map.symbol.darts' },
  gym: { emoji: '🏋️', color: '#a3e635', label: 'Gym', labelKey: 'map.symbol.gym' },
  // v4: Pier 9 Fishing (Builder A's ACTIVITY_SPOTS) — the activity itself
  // is Builder B's work; the map just gives it its symbol instead of the
  // generic road pin.
  fish: { emoji: '🎣', color: '#38bdf8', label: 'Fishing', labelKey: 'map.symbol.fish' },
  airport: { emoji: '✈️', color: '#93c5fd', label: 'Airport', labelKey: 'map.symbol.airport' },
  npc: { emoji: '👤', color: '#f472b6', label: 'Contact — Maya / Rico', labelKey: 'map.symbol.npc' },
  road: { emoji: '📍', color: '#22d3ee', label: 'Road point', labelKey: 'map.symbol.road' },
  player: { emoji: '🔺', color: '#fde047', label: 'You — Leo Vance', labelKey: 'map.symbol.player' },
  // v4 landmarks (Builder C): houses of worship, housing, ring-road flyovers.
  worship: { emoji: '⛪', color: '#fbbf24', label: 'Place of worship', labelKey: 'map.symbol.worship' },
  housing: { emoji: '🏘️', color: '#fb923c', label: 'Housing block', labelKey: 'map.symbol.housing' },
  flyover: { emoji: '🌉', color: '#a78bfa', label: 'Ring-road flyover', labelKey: 'map.symbol.flyover' },
};

/** Legend / tooltip label for a symbol kind, in the active language. */
export function symbolLabel(kind) {
  const s = SYMBOLS[kind];
  if (!s) return kind;
  if (!s.labelKey) return s.label;
  const v = t(s.labelKey);
  return v === s.labelKey ? s.label : v;
}

export const LEGEND_ORDER = [
  'mission', 'side', 'food', 'gun', 'clothes', 'mods', 'safehouse',
  'pool', 'golf', 'race', 'swim', 'darts', 'gym', 'fish', 'airport', 'npc',
  'worship', 'housing', 'flyover', 'player',
];

/** Every place the player can navigate to right now. */
export function getDestinations(state, world) {
  const list = [];
  const add = (d) => {
    d.district = districtAt(d.x, d.y);
    d.locked = !state.unlocked[d.district];
    list.push(d);
  };
  const active = state.missions.active;
  if (active) add({ id: 'mission-active', kind: 'mission', label: t('mission.objectiveNext', { id: active.id, title: missionTitle(active) }), x: active.x, y: active.y });
  const side = state.missions.activeSide;
  if (side) add({ id: 'side-active', kind: 'side', label: t('mission.sideStarted', { title: side.title }), x: side.x, y: side.y });
  for (const q of (state.missions.sidePool || []).slice(0, 6)) {
    add({ id: `side-${q.id}`, kind: 'side', label: q.title, x: q.x, y: q.y });
  }
  for (const s of world.shops) {
    add({ id: `shop-${s.id}`, kind: s.kind, label: s.name, x: s.x + s.w / 2, y: s.y + s.h / 2 });
  }
  add({ id: 'safehouse', kind: 'safehouse', label: t('map.dest.safehouse'), x: SAFE_HOUSE.door.x, y: SAFE_HOUSE.door.y });
  for (const a of world.activitySpots) {
    add({ id: `act-${a.kind}`, kind: a.kind, label: a.name, x: a.x, y: a.y });
  }
  add({ id: 'airport', kind: 'airport', label: t('map.dest.airport'), x: 4650, y: 4710 });
  // v4 landmarks (worship / housing / flyovers): navigable like any shop.
  // They render on the big map, the minimap (render.js draws every
  // destination) and in the Landmarks list below. Labels resolve here so
  // a language switch re-labels them on the next list rebuild.
  for (const lm of V4_LANDMARKS) {
    add({ id: lm.id, kind: lm.kind, label: landmarkLabel(lm), x: lm.x, y: lm.y });
  }
  for (const n of state.npcs) {
    if (n.kind === 'friend') add({ id: 'npc-maya', kind: 'npc', label: t('map.dest.maya'), x: n.x, y: n.y });
    if (n.kind === 'giver') add({ id: 'npc-rico', kind: 'npc', label: t('map.dest.rico'), x: n.x, y: n.y });
  }
  return list;
}

/** Where the player is right now: the car, or Leo on foot. */
export function navPosition(state) {
  const v = state.playerVehicle;
  return v ? { x: v.x, y: v.y } : { x: state.hero.x, y: state.hero.y };
}

function polylineLength(pts) {
  let total = 0;
  for (let i = 0; i + 1 < pts.length; i += 1) total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return total;
}

/** Route polyline from (x1, y1) to (x2, y2) along the road graph, or null. */
export function buildRoute(state, world, x1, y1, x2, y2) {
  const nodePath = world.graph.findPath(x1, y1, x2, y2, state.unlocked);
  if (!nodePath || nodePath.length === 0) return null;
  // The whole node path, start node included: even when the hero and the
  // destination share one nearest intersection, the route still runs
  // hero -> intersection -> destination instead of cutting the block.
  const pts = [{ x: x1, y: y1 }];
  // Join the road first: the nearest point on the nearest centreline, so
  // the opening leg runs to the road (across the pavement at most) and
  // every leg after it runs along a road, never across a block.
  const near = world.graph.nearestSegmentPoint(x1, y1);
  if (near && Math.hypot(near.x - x1, near.y - y1) > 4) pts.push({ x: near.x, y: near.y });
  for (const p of nodePath) {
    const last = pts[pts.length - 1];
    if (Math.hypot(p.x - last.x, p.y - last.y) > 4) pts.push({ x: p.x, y: p.y });
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(x2 - last.x, y2 - last.y) > 10) pts.push({ x: x2, y: y2 });
  return pts;
}

/**
 * Set a GPS destination. Locked districts are refused with a clear
 * message; a destination with no road route is refused too. The route
 * follows the road graph (findPath), never a straight line.
 */
export function setDestination(state, world, dest) {
  const d = districtAt(dest.x, dest.y);
  if (!state.unlocked[d]) {
    const msg = d === 1 ? t('map.lockedBeach') : t('map.lockedPeaks');
    showMessage(state, msg, 4);
    return { ok: false, reason: 'locked', message: msg };
  }
  const pos = navPosition(state);
  const path = buildRoute(state, world, pos.x, pos.y, dest.x, dest.y);
  if (!path || path.length < 2) {
    const msg = t('map.noRoute');
    showMessage(state, msg, 4);
    return { ok: false, reason: 'noroute', message: msg };
  }
  state.nav = {
    id: dest.id || 'road', kind: dest.kind || 'road',
    label: dest.label || t('map.roadPoint'), x: dest.x, y: dest.y,
    path, total: Math.round(polylineLength(path)),
  };
  state.navRepath = 0;
  showMessage(state, t('map.gpsSet', { label: state.nav.label, total: state.nav.total }), 4);
  return { ok: true, nav: state.nav };
}

/** Rebuild the active route from where the player is now (same destination). */
export function rebuildNavRoute(state, world) {
  if (!state.nav) return false;
  const pos = navPosition(state);
  const path = buildRoute(state, world, pos.x, pos.y, state.nav.x, state.nav.y);
  if (!path || path.length < 2) return false;
  state.nav.path = path;
  state.nav.total = Math.round(polylineLength(path));
  return true;
}

export function clearNav(state) {
  state.nav = null;
  state.navRepath = 0;
}

/**
 * Metres left along the route: distance to the nearest point on the
 * polyline plus the polyline length from there to the destination.
 * Shrinks as the player drives towards the target.
 */
export function navRemaining(state) {
  const nav = state.nav;
  if (!nav || !nav.path || nav.path.length < 2) return 0;
  const pos = navPosition(state);
  let best = null;
  let bestD = Infinity;
  let bestSeg = 0;
  let bestT = 0;
  for (let i = 0; i + 1 < nav.path.length; i += 1) {
    const a = nav.path[i];
    const b = nav.path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((pos.x - a.x) * dx + (pos.y - a.y) * dy) / len2));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = (px - pos.x) ** 2 + (py - pos.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py };
      bestSeg = i;
      bestT = t;
    }
  }
  let remaining = Math.sqrt(bestD);
  for (let i = bestSeg; i + 1 < nav.path.length; i += 1) {
    const a = i === bestSeg ? best : nav.path[i];
    const b = nav.path[i + 1];
    remaining += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.round(remaining);
}

/** Route polyline trimmed to start at the player's current position. */
export function navPathFromPlayer(state) {
  const nav = state.nav;
  if (!nav || !nav.path || nav.path.length < 2) return null;
  const pos = navPosition(state);
  let best = null;
  let bestD = Infinity;
  let bestSeg = 0;
  for (let i = 0; i + 1 < nav.path.length; i += 1) {
    const a = nav.path[i];
    const b = nav.path[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((pos.x - a.x) * dx + (pos.y - a.y) * dy) / len2));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = (px - pos.x) ** 2 + (py - pos.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = { x: px, y: py };
      bestSeg = i;
    }
  }
  return [{ x: pos.x, y: pos.y }, best, ...nav.path.slice(bestSeg + 1)];
}

// --- The full-screen map panel -------------------------------------------
export function createMapController(opts) {
  const { getState, getWorld } = opts;
  const panel = document.getElementById('mapPanel');
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const listEl = document.getElementById('mapList');
  const legendEl = document.getElementById('mapLegend');
  const destEl = document.getElementById('mapDest');
  const cancelBtn = document.getElementById('btnCancelNav');
  const closeBtn = document.getElementById('btnCloseMap');
  const zoomInBtn = document.getElementById('btnZoomIn');
  const zoomOutBtn = document.getElementById('btnZoomOut');

  const view = { cx: WORLD_WIDTH / 2, cy: WORLD_HEIGHT / 2, zoom: 0.1 };
  let open = false;
  let pulseTimer = 0;
  let fitZoom = 0.1;

  // Legend: one row per symbol, built from the same table the map draws.
  // Rebuilt on language change (symbolLabel resolves the active language).
  function buildLegend() {
    if (!legendEl) return;
    legendEl.innerHTML = '';
    for (const kind of LEGEND_ORDER) {
      const s = SYMBOLS[kind];
      const row = document.createElement('div');
      row.className = 'map-legend-row';
      const badge = document.createElement('span');
      badge.className = 'map-badge';
      badge.style.background = s.color;
      badge.textContent = s.emoji;
      const label = document.createElement('span');
      label.textContent = symbolLabel(kind);
      row.appendChild(badge);
      row.appendChild(label);
      legendEl.appendChild(row);
    }
    const locked = document.createElement('div');
    locked.className = 'map-legend-row';
    const lockBadge = document.createElement('span');
    lockBadge.className = 'map-badge';
    lockBadge.style.background = '#20242e';
    lockBadge.textContent = '🔒';
    const lockLabel = document.createElement('span');
    lockLabel.textContent = t('map.lockedLegend');
    locked.appendChild(lockBadge);
    locked.appendChild(lockLabel);
    legendEl.appendChild(locked);
  }
  buildLegend();
  // v4 i18n: re-render the legend, list and destination label live when
  // the language changes while the map is open.
  onLangChange(() => {
    if (!open) return;
    buildLegend();
    updateDestLabel();
    rebuildList();
    draw();
  });

  function sizeCanvas() {
    if (!canvas) return { w: 0, h: 0 };
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    return { w, h, dpr };
  }

  function fitView() {
    const { w, h } = sizeCanvas();
    if (w <= 0 || h <= 0) return;
    fitZoom = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT) * 0.98;
    view.zoom = fitZoom;
    view.cx = WORLD_WIDTH / 2;
    view.cy = WORLD_HEIGHT / 2;
  }

  function clampView() {
    const { w, h } = sizeCanvas();
    const hw = w / (2 * view.zoom);
    const hh = h / (2 * view.zoom);
    view.cx = hw >= WORLD_WIDTH / 2 ? WORLD_WIDTH / 2 : Math.max(hw - 120, Math.min(WORLD_WIDTH - hw + 120, view.cx));
    view.cy = hh >= WORLD_HEIGHT / 2 ? WORLD_HEIGHT / 2 : Math.max(hh - 120, Math.min(WORLD_HEIGHT - hh + 120, view.cy));
  }

  function toScreen(x, y) {
    const { w, h } = sizeCanvas();
    return { x: (x - view.cx) * view.zoom + w / 2, y: (y - view.cy) * view.zoom + h / 2 };
  }

  function toWorld(sx, sy) {
    const { w, h } = sizeCanvas();
    return { x: (sx - w / 2) / view.zoom + view.cx, y: (sy - h / 2) / view.zoom + view.cy };
  }

  function zoomAt(sx, sy, factor) {
    const before = toWorld(sx, sy);
    view.zoom = Math.max(fitZoom * 0.9, Math.min(fitZoom * 16, view.zoom * factor));
    const after = toWorld(sx, sy);
    view.cx += before.x - after.x;
    view.cy += before.y - after.y;
    clampView();
    draw();
  }

  function drawBadge(sx, sy, kind, radius, selected) {
    const s = SYMBOLS[kind] || SYMBOLS.road;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? '#fde047' : '#0b0e14';
    ctx.stroke();
    ctx.font = `${Math.round(radius * 1.05)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.emoji, sx, sy + 1);
    ctx.restore();
  }

  function draw() {
    if (!ctx || !open) return;
    const state = getState();
    const world = getWorld();
    const { w, h, dpr } = sizeCanvas();
    if (w <= 0 || h <= 0) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, w, h);
    const s2 = (x, y) => toScreen(x, y);

    // Districts: locked ones stay dark grey with a padlock.
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      const r = DISTRICT_RECTS[i];
      const locked = !state.unlocked[i];
      const a = s2(r.x, r.y);
      const b = s2(r.x + r.w, r.y + r.h);
      ctx.fillStyle = locked ? '#20242e' : GROUND[i];
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      // The padlock label is drawn last (after the symbols), with a dark
      // pill behind it, so a badge sitting on the district centre cannot
      // cover the text.
    }
    // Water.
    ctx.fillStyle = '#0e7490';
    for (const wr of WATER_RECTS) {
      const a = s2(wr.x, wr.y);
      const b = s2(wr.x + wr.w, wr.y + wr.h);
      ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    }
    // Roads.
    ctx.fillStyle = '#3d4451';
    for (const r of world.roads) {
      const a = s2(r.x, r.y);
      const b = s2(r.x + r.w, r.y + r.h);
      ctx.fillRect(a.x, a.y, Math.max(1, b.x - a.x), Math.max(1, b.y - a.y));
    }
    // Gates: red while closed, green once the district opens.
    for (const g of world.gates) {
      const a = s2(g.x, g.y);
      const b = s2(g.x + g.w, g.y + g.h);
      ctx.fillStyle = state.unlocked[g.district] ? '#22c55e' : '#dc2626';
      ctx.fillRect(a.x, a.y, Math.max(2, b.x - a.x), Math.max(2, b.y - a.y));
    }
    // District names — skipped for locked districts, whose padlock label
    // already names them (drawing both put two labels on the same spot).
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fafc';
    if (state.unlocked[0]) ctx.fillText(t('district.downtown'), ...Object.values(s2(3000, 3375)));
    if (state.unlocked[1]) ctx.fillText(t('district.beach'), ...Object.values(s2(7800, 3375)));
    if (state.unlocked[2]) ctx.fillText(t('district.peaks'), ...Object.values(s2(4800, 675)));

    // GPS route along the roads, with direction chevrons.
    const nav = state.nav;
    if (nav && nav.path && nav.path.length > 1) {
      const pts = [{ x: navPosition(state).x, y: navPosition(state).y }, ...nav.path.slice(1)];
      ctx.save();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => {
        const q = s2(p.x, p.y);
        if (i === 0) ctx.moveTo(q.x, q.y);
        else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 14]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Chevrons every ~350 world units, pointing along the route.
      for (let i = 0; i + 1 < pts.length; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / 350);
        for (let k = 1; k <= steps; k += 1) {
          const t = k / (steps + 1);
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          const q = s2(x, y);
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(ang);
          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.moveTo(9, 0);
          ctx.lineTo(-6, -7);
          ctx.lineTo(-6, 7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }
      // Pulsing ring on the destination.
      const d = s2(nav.x, nav.y);
      const pulse = 14 + Math.sin((typeof performance !== 'undefined' ? performance.now() : 0) / 300) * 4;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(d.x, d.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Symbols. Badges grow a little with zoom but never crowd the map:
    // labels only appear when zoomed in.
    const badgeR = Math.max(7, Math.min(15, 10 * Math.sqrt(view.zoom / fitZoom)));
    const showLabels = view.zoom >= fitZoom * 1.6;
    const dests = getDestinations(state, world);
    for (const dest of dests) {
      const p = s2(dest.x, dest.y);
      if (p.x < -30 || p.y < -30 || p.x > w + 30 || p.y > h + 30) continue;
      ctx.save();
      if (dest.locked) ctx.globalAlpha = 0.45;
      drawBadge(p.x, p.y, dest.kind, badgeR, nav && nav.id === dest.id);
      if (dest.locked) {
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText('🔒', p.x + badgeR, p.y - badgeR);
      }
      ctx.restore();
      if (showLabels && !dest.locked) {
        ctx.font = 'bold 11px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const label = dest.label.length > 26 ? `${dest.label.slice(0, 25)}…` : dest.label;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(5,8,16,0.8)';
        ctx.fillRect(p.x + badgeR + 3, p.y - 8, tw + 8, 16);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(label, p.x + badgeR + 7, p.y);
      }
    }
    // The player: a gold arrow, rotated to the hero's heading.
    const pos = navPosition(state);
    const pp = s2(pos.x, pos.y);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(state.hero.angle || 0);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#0b0e14';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -9);
    ctx.lineTo(-10, 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Locked-district padlock labels, on top of everything, on a pill.
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      if (state.unlocked[i]) continue;
      const r = DISTRICT_RECTS[i];
      const c = s2(r.x + r.w / 2, r.y + r.h / 2);
      const label = `🔒 ${t(['district.downtown', 'district.beach', 'district.peaks'][i])} — ${t('map.locked')}`;
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(5,8,16,0.85)';
      ctx.fillRect(c.x - tw / 2 - 10, c.y - 13, tw + 20, 26);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, c.x, c.y);
    }
  }

  function updateDestLabel() {
    const state = getState();
    if (destEl) {
      destEl.textContent = state.nav
        ? `GPS ▸ ${state.nav.label} — ${navRemaining(state)} m`
        : t('map.noDest');
    }
    if (cancelBtn) cancelBtn.classList.toggle('hidden', !state.nav);
  }

  function rebuildList() {
    if (!listEl) return;
    const state = getState();
    const world = getWorld();
    listEl.innerHTML = '';
    const groups = [
      [t('map.group.jobs'), (d) => d.kind === 'mission' || d.kind === 'side'],
      [t('map.group.shops'), (d) => ['food', 'gun', 'clothes', 'mods'].includes(d.kind)],
      [t('map.group.places'), (d) => ['safehouse', 'airport', 'npc'].includes(d.kind)],
      [t('map.group.activities'), (d) => ['pool', 'golf', 'race', 'swim', 'darts', 'gym', 'fish'].includes(d.kind)],
      // v4 landmarks: worship, housing, ring-road flyovers.
      [t('map.group.landmarks'), (d) => ['worship', 'housing', 'flyover'].includes(d.kind)],
    ];
    const dests = getDestinations(state, world);
    for (const [title, match] of groups) {
      const items = dests.filter(match);
      if (items.length === 0) continue;
      const h = document.createElement('div');
      h.className = 'map-list-group';
      h.textContent = title;
      listEl.appendChild(h);
      for (const dest of items) {
        const s = SYMBOLS[dest.kind] || SYMBOLS.road;
        const btn = document.createElement('button');
        btn.className = 'map-dest' + (state.nav && state.nav.id === dest.id ? ' selected' : '');
        btn.disabled = dest.locked;
        const badge = document.createElement('span');
        badge.className = 'map-badge';
        badge.style.background = dest.locked ? '#374151' : s.color;
        badge.textContent = dest.locked ? '🔒' : s.emoji;
        const label = document.createElement('span');
        label.className = 'map-dest-label';
        label.textContent = dest.label + (dest.locked ? t('map.lockedSuffix') : '');
        btn.appendChild(badge);
        btn.appendChild(label);
        btn.addEventListener('click', () => {
          if (state.nav && state.nav.id === dest.id) {
            clearNav(state);
            showMessage(state, t('map.navCancelled'));
          } else {
            setDestination(state, world, dest);
          }
          updateDestLabel();
          rebuildList();
          draw();
        });
        listEl.appendChild(btn);
      }
    }
  }

  /** Pick whatever the click landed on: a place, or a free road point. */
  function pickAt(sx, sy) {
    const state = getState();
    const world = getWorld();
    const pt = toWorld(sx, sy);
    const dests = getDestinations(state, world);
    let best = null;
    let bestD = Infinity;
    for (const dest of dests) {
      const p = toScreen(dest.x, dest.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bestD) {
        bestD = d;
        best = dest;
      }
    }
    if (best && bestD < 26) {
      if (state.nav && state.nav.id === best.id) {
        clearNav(state);
        showMessage(state, t('map.navCancelled'));
        updateDestLabel();
        rebuildList();
        draw();
        return { ok: true, cancelled: true };
      }
      const res = setDestination(state, world, best);
      updateDestLabel();
      rebuildList();
      draw();
      return res;
    }
    // Free click: a locked district can never be a destination.
    const d = districtAt(pt.x, pt.y);
    if (!state.unlocked[d]) {
      const msg = d === 1 ? t('map.lockedBeach') : t('map.lockedPeaks');
      showMessage(state, msg, 4);
      if (destEl) destEl.textContent = msg;
      return { ok: false, reason: 'locked', message: msg };
    }
    if (world.graph.isOnRoad(pt.x, pt.y, 10)) {
      const res = setDestination(state, world, { id: 'road', kind: 'road', label: t('map.roadPoint'), x: pt.x, y: pt.y });
      updateDestLabel();
      rebuildList();
      draw();
      return res;
    }
    // Off-road click: snap to the nearest road if it is close, else refuse.
    const near = world.graph.nearestSegmentPoint(pt.x, pt.y);
    if (near && near.dist <= 250) {
      const res = setDestination(state, world, { id: 'road', kind: 'road', label: t('map.roadPoint'), x: near.x, y: near.y });
      updateDestLabel();
      rebuildList();
      draw();
      return res;
    }
    const msg = t('map.offRoad');
    showMessage(state, msg, 4);
    if (destEl) destEl.textContent = msg;
    return { ok: false, reason: 'offroad', message: msg };
  }

  // --- Pointer input on the map canvas: drag to pan, pinch to zoom,
  // a tap (no drag) to pick a destination. ------------------------------
  const pointers = new Map();
  let downAt = null;
  let pinchDist = 0;
  let pinchMid = null;
  let moved = 0;

  if (canvas) {
    canvas.addEventListener('pointerdown', (event) => {
      // Synthetic pointer events (automated tests) have no active pointer
      // to capture; a real finger or mouse always does.
      try { canvas.setPointerCapture(event.pointerId); } catch { /* no active pointer */ }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        const rect = canvas.getBoundingClientRect();
        downAt = { x: event.clientX - rect.left, y: event.clientY - rect.top, t: Date.now() };
        moved = 0;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        downAt = null;
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!pointers.has(event.pointerId)) return;
      const prev = pointers.get(event.pointerId);
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const rect = canvas.getBoundingClientRect();
        if (pinchDist > 0 && dist > 0) {
          zoomAt(mid.x - rect.left, mid.y - rect.top, dist / pinchDist);
        }
        if (pinchMid) {
          view.cx -= (mid.x - pinchMid.x) / view.zoom;
          view.cy -= (mid.y - pinchMid.y) / view.zoom;
          clampView();
          draw();
        }
        pinchDist = dist;
        pinchMid = mid;
        moved += Math.abs(dx) + Math.abs(dy);
        return;
      }
      if (downAt) {
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) {
          view.cx -= dx / view.zoom;
          view.cy -= dy / view.zoom;
          clampView();
          draw();
        }
      }
    });
    const endPointer = (event) => {
      const wasTap = pointers.size === 1 && downAt && moved <= 6 && Date.now() - downAt.t < 600;
      const tap = wasTap ? { x: downAt.x, y: downAt.y } : null;
      pointers.delete(event.pointerId);
      if (pointers.size < 2) {
        pinchDist = 0;
        pinchMid = null;
      }
      if (pointers.size === 0) downAt = null;
      if (tap) pickAt(tap.x, tap.y);
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', (event) => {
      pointers.delete(event.pointerId);
      if (pointers.size === 0) downAt = null;
      pinchDist = 0;
      pinchMid = null;
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, Math.exp(-event.deltaY * 0.0012));
    }, { passive: false });
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  if (zoomInBtn) zoomInBtn.addEventListener('click', () => {
    const { w, h } = sizeCanvas();
    zoomAt(w / 2, h / 2, 1.45);
  });
  if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => {
    const { w, h } = sizeCanvas();
    zoomAt(w / 2, h / 2, 1 / 1.45);
  });
  if (closeBtn) closeBtn.addEventListener('click', () => opts.onClose && opts.onClose());
  if (cancelBtn) cancelBtn.addEventListener('click', () => {
    const state = getState();
    clearNav(state);
    showMessage(state, t('map.navCancelled'));
    updateDestLabel();
    rebuildList();
    draw();
  });
  window.addEventListener('resize', () => {
    if (open) draw();
  });

  return {
    view,
    get isOpen() { return open; },
    open() {
      if (!panel) return;
      open = true;
      panel.classList.remove('hidden');
      fitView();
      rebuildList();
      updateDestLabel();
      draw();
      clearInterval(pulseTimer);
      pulseTimer = setInterval(() => { if (open) draw(); }, 500);
    },
    close() {
      open = false;
      clearInterval(pulseTimer);
      if (panel) panel.classList.add('hidden');
    },
    draw,
    rebuildList,
    updateDestLabel,
    pickAt,
    zoomAt,
    fitView,
    setView(cx, cy, zoom) {
      view.cx = cx;
      view.cy = cy;
      view.zoom = zoom;
      clampView();
      draw();
    },
  };
}
