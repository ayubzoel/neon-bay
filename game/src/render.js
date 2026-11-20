// Neon Bay — drawing only: the 3D city, the beach, the peaks, every entity,
// the HUD with its minimap, and the map overlay.
//
// v2: WebGL via three.js (global THREE, vendored UMD — no CDN, no network).
// World (x, y) maps to THREE (x, height, z) with z = y; meshes face +X and
// rotation.y = -heading. The camera is third-person: position = focus -
// forward*dist*cos(pitch) + up*dist*sin(pitch), forward = (sin yaw, 0, cos yaw).
// Static world meshes come from world.meshes and are added to the scene once.
// Per-frame entities go through the mesh pool (Map id -> Object3D): modules
// get-or-build their meshes and the pool drops whatever a frame did not touch.
// HUD + minimap + map overlay live on the 2D #hud canvas above the WebGL one.
import { DISTRICT_RECTS, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { clockText } from './state.js';
import { drawCharacter } from './player.js';
import { drawVehicles } from './vehicles.js';
import { drawNpcs } from './npc.js';
import { drawPolice } from './police.js';
import { drawBullets } from './combat.js';
import { drawMissionMarkers } from './missions.js';
import { createWeather } from './weather.js';
import { drawShopSigns } from './shops.js';
import { drawActivity, hideActivityCanvas } from './activities.js';
import { updateNightGlow } from './textures.js';
import { getDestinations, navPathFromPlayer, navRemaining, SYMBOLS } from './map.js';
import { addStrings, t } from './i18n.js';

// HUD strings for this module (en is the default language; id below).
// Weapon names are generic type names, so they translate; the objective
// and prompt lines come from missions.js and are translated there.
addStrings('en', {
  'hud.locked': 'LOCKED',
  'hud.season.summer': 'Summer',
  'hud.season.rainy': 'Rainy Season',
  'hud.clock': '{clock} · Day {day} · {season}',
  'hud.gps': 'GPS ▸ {label} — {dist} m',
  'hud.webglError': 'WebGL is not available in this browser, so Neon Bay 3D cannot start. Try a browser with hardware acceleration enabled.',
  'weapon.pistol': 'Pistol',
  'weapon.rifle': 'Rifle',
  'weapon.shotgun': 'Shotgun',
  'weapon.melee': 'Baseball Bat',
  'weapon.grenade': 'Grenade',
  'weapon.bazooka': 'Bazooka',
});
addStrings('id', {
  'hud.locked': 'TERKUNCI',
  'hud.season.summer': 'Musim Panas',
  'hud.season.rainy': 'Musim Hujan',
  'hud.clock': '{clock} · Hari {day} · {season}',
  'hud.gps': 'GPS ▸ {label} — {dist} m',
  'hud.webglError': 'WebGL tidak tersedia di browser ini, jadi Neon Bay 3D tidak bisa dimulai. Coba browser dengan akselerasi perangkat keras.',
  'weapon.pistol': 'Pistol',
  'weapon.rifle': 'Senapan',
  'weapon.shotgun': 'Senapan Gentel',
  'weapon.melee': 'Pemukul Bisbol',
  'weapon.grenade': 'Granat',
  'weapon.bazooka': 'Bazoka',
});

/** Display name of the equipped weapon in the active language. */
function weaponName(id) {
  return id ? t(`weapon.${id}`) : '';
}

// Graphics quality levels (Settings hook — Builder C calls
// applyGraphicsQuality from the Settings menu; it applies immediately,
// no restart). low: short fog, no blob shadows, half the trees/decor.
// medium: the v3 look. high: full density, far fog, dpr up to 1.5.
// v5 (Builder A): DPR is capped at 1.5 even on high — SwiftShader and
// other software renderers rasterize every pixel on the CPU, and a 2x
// buffer quadruples that work for no visible gain on this art style.
// Density is trimmed too (medium 0.8 -> 0.65, high 1 -> 0.85): the
// trees are ~450k of the ~490k triangles per frame, and density is the
// only tree lever that lives on this side of world.js.
export const QUALITY_LEVELS = {
  low: { dpr: 1, fogNear: 300, fogFar: 900, far: 1500, density: 0.4, shadows: false },
  medium: { dpr: 1.25, fogNear: 800, fogFar: 2400, far: 4500, density: 0.65, shadows: true },
  high: { dpr: 1.5, fogNear: 1200, fogFar: 3600, far: 7000, density: 0.85, shadows: true },
};
let _qualityLevel = 'high';
let _qualityApply = null; // set by createRenderer; null until the renderer exists
export function applyGraphicsQuality(level) {
  const l = QUALITY_LEVELS[level] ? level : 'medium';
  _qualityLevel = l;
  if (_qualityApply) _qualityApply(l);
  return l;
}
export function getGraphicsQuality() { return _qualityLevel; }

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_ACTIVITY = 'activity';

const GROUND = ['#3a3f4a', '#d9b96a', '#6b7a72'];
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Mesh pool: modules get-or-build one Object3D per id per frame. */
class MeshPool {
  constructor(scene) {
    this.scene = scene;
    this.map = new Map();
    this.touched = new Set();
  }

  get(id, buildFn) {
    let obj = this.map.get(id);
    if (!obj) {
      obj = buildFn();
      this.map.set(id, obj);
      this.scene.add(obj);
    }
    this.touched.add(id);
    return obj;
  }

  endFrame() {
    for (const [id, obj] of this.map) {
      if (!this.touched.has(id)) {
        this.scene.remove(obj);
        this.map.delete(id);
      }
    }
    this.touched.clear();
  }
}

const _coinGeo = new Map();
function coinMesh(color) {
  if (!_coinGeo.box) _coinGeo.box = new THREE.BoxGeometry(0.5, 0.08, 0.5);
  if (!_coinGeo[color]) {
    _coinGeo[color] = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
  }
  return new THREE.Mesh(_coinGeo.box, _coinGeo[color]);
}

export function createRenderer(canvas) {
  const view = { scale: 1, w: 0, h: 0, dpr: 1 };
  let renderer;
  try {
    // v5 perf: antialias off. In SwiftShader MSAA is resolved on the CPU
    // for every presented frame (a one-triangle canvas already runs ~30%
    // faster without it), and on hardware GPUs the loss is one soft edge
    // pass on otherwise flat-shaded art. No shadow maps either (v4).
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  } catch (err) {
    const el = document.getElementById('webglError');
    if (el) {
      el.hidden = false;
      el.textContent = t('hud.webglError');
    }
    return {
      draw() {},
      view,
      screenToGround() { return { x: 0, y: 0 }; },
      applyGraphicsQuality,
      getGraphicsQuality,
    };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY_LEVELS[_qualityLevel].dpr));
  if ('sRGBEncoding' in THREE) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = false; // no shadow maps: blob shadows only

  // v5 perf: detect a software GL renderer (SwiftShader / llvmpipe /
  // other CPU rasterizers) once. On one, the drawing buffer is capped at
  // DPR 1 and the tree density at 0.5 no matter what Settings says — a
  // software rasterizer pays per pixel and per triangle, and a user who
  // picks "high" on SwiftShader would otherwise sit at ~1 fps again.
  // Hardware GPUs are untouched. Exposed as __neonBay.softwareRendering.
  let softwareRendering = false;
  try {
    const gl = renderer.getContext();
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const glName = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '') : '';
    softwareRendering = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(glName);
  } catch { softwareRendering = false; }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#87b5d6');
  scene.fog = new THREE.Fog(0x87b5d6, QUALITY_LEVELS[_qualityLevel].fogNear, QUALITY_LEVELS[_qualityLevel].fogFar);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, QUALITY_LEVELS[_qualityLevel].far);
  camera.position.set(700, 20, 1750);

  const weather = createWeather(scene);
  const pool = new MeshPool(scene);
  const worldsAdded = new WeakSet();
  const raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  let lastTime = null;
  let lastNightGlowT = -10;
  let lastUnlockedKey = null;
  let currentWorld = null;
  let qualityDpr = QUALITY_LEVELS[_qualityLevel].dpr;
  let effectiveDensity = QUALITY_LEVELS[_qualityLevel].density;
  let shadowsEnabled = QUALITY_LEVELS[_qualityLevel].shadows;

  // Apply a quality level now (renderer/scene/camera) and to the world
  // once it loads (density). Registered as the module-level hook above.
  // v5: on a software renderer the DPR is forced to 1 and the density
  // capped at 0.5 (see the detection above) — the Settings label stays
  // what the player picked, only the effective values are clamped.
  function applyPixelRatio() {
    // WebGL buffer: a software rasterizer pays per pixel, so render the
    // 3D buffer at 0.75x there (CSS upscales the canvas — slightly soft,
    // much cheaper). The 2D HUD keeps full DPR so its text stays sharp.
    const pr = Math.min(window.devicePixelRatio || 1, qualityDpr) * (softwareRendering ? 0.75 : 1);
    renderer.setPixelRatio(pr);
    view.renderDpr = pr;
  }
  function applyQuality(level) {
    const q = QUALITY_LEVELS[level];
    qualityDpr = softwareRendering ? 1 : q.dpr;
    // v5: the density the world actually uses — the draw() world-load
    // block must use THIS, not the raw table value, or a software-mode
    // cap (0.5) would be silently overridden back to the table value
    // (0.65 medium) on the first frame.
    effectiveDensity = softwareRendering ? Math.min(q.density, 0.5) : q.density;
    shadowsEnabled = q.shadows;
    scene.fog.near = q.fogNear;
    scene.fog.far = q.fogFar;
    camera.far = q.far;
    camera.updateProjectionMatrix();
    applyPixelRatio();
    resize();
    if (currentWorld && currentWorld.setVisualDensity) currentWorld.setVisualDensity(effectiveDensity);
  }
  _qualityApply = applyQuality;

  // --- 2D HUD overlay -------------------------------------------------
  const hud = document.getElementById('hud');
  const hctx = hud ? hud.getContext('2d') : null;
  const fonts = new Map();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, qualityDpr);
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    applyPixelRatio();
    renderer.setSize(view.w, view.h, false);
    camera.aspect = view.w / Math.max(1, view.h);
    camera.updateProjectionMatrix();
    view.scale = Math.max(0.55, Math.min(view.w / 1150, view.h / 720));
    if (hud) {
      hud.width = Math.round(view.w * dpr);
      hud.height = Math.round(view.h * dpr);
      hud.style.width = `${view.w}px`;
      hud.style.height = `${view.h}px`;
    }
  }

  function text(value, x, y, size, color, align = 'left', bold = false) {
    const key = `${size}-${bold}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    hctx.font = fonts.get(key);
    hctx.fillStyle = color;
    hctx.textAlign = align;
    hctx.fillText(value, x, y);
  }

  /** Shorten a string with an ellipsis so it fits inside maxWidth px. */
  function fitText(value, size, maxWidth, bold = false) {
    const key = `${size}-${bold}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    hctx.font = fonts.get(key);
    if (hctx.measureText(value).width <= maxWidth) return value;
    let s = value;
    while (s.length > 1 && hctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
    return `${s}…`;
  }

  // --- v5 perf caches ---------------------------------------------------
  // drawMinimap() + drawNav3D() run every frame, but what they read
  // changes rarely: the destination list only changes when the mission,
  // the side pool or an unlock changes, and the GPS path only changes
  // when the route does or the hero moves ~4 m. Rebuilding both every
  // frame re-allocates a path array and re-scans 150 NPCs for nothing.
  let _destCache = { key: '', dests: null };
  function cachedDestinations(state) {
    const key = `${state.unlocked ? state.unlocked.join('') : ''}|${state.missions.active ? state.missions.active.id : ''}|${state.missions.activeSide ? state.missions.activeSide.id : ''}|${(state.missions.sidePool || []).length}`;
    if (_destCache.key !== key || !_destCache.dests) {
      _destCache = { key, dests: getDestinations(state, state.world) };
    }
    return _destCache.dests;
  }
  let _navCache = { nav: null, qx: 0, qy: 0, pts: null };
  function cachedNavPath(state) {
    const nav = state.nav;
    if (!nav || !nav.path || nav.path.length < 2) return null;
    const qx = Math.round(state.hero.x / 4);
    const qy = Math.round(state.hero.y / 4);
    if (_navCache.nav !== nav || _navCache.qx !== qx || _navCache.qy !== qy || !_navCache.pts) {
      _navCache = { nav, qx, qy, pts: navPathFromPlayer(state) };
    }
    return _navCache.pts;
  }

  function drawMinimap(state, mw = 190, mh = 142) {
    const x0 = view.w - mw - 14;
    const y0 = 14;
    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;
    hctx.save();
    hctx.fillStyle = 'rgba(10,14,22,0.85)';
    hctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      const r = DISTRICT_RECTS[i];
      const locked = !state.unlocked[i];
      // Locked districts read as dark grey on the minimap, with a padlock.
      hctx.fillStyle = locked ? '#20242e' : GROUND[i];
      hctx.fillRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
      if (locked) {
        const cx = x0 + (r.x + r.w / 2) * sx;
        const cy = y0 + (r.y + r.h / 2) * sy;
        hctx.strokeStyle = '#f8fafc';
        hctx.lineWidth = 1.6;
        hctx.beginPath();
        hctx.arc(cx, cy - 2, 4, Math.PI, 0);
        hctx.stroke();
        hctx.fillStyle = '#f8fafc';
        hctx.fillRect(cx - 6, cy - 2, 12, 9);
        hctx.fillStyle = '#94a3b8';
        hctx.font = 'bold 8px system-ui, sans-serif';
        hctx.textAlign = 'center';
        hctx.fillText(t('hud.locked'), cx, cy + 18);
      }
    }
    hctx.fillStyle = '#0e7490';
    for (const w of WATER_RECTS) hctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, w.w * sx, w.h * sy);
    // GPS route along the roads, drawn before the markers so they sit on top.
    const navPts = cachedNavPath(state);
    if (navPts && navPts.length > 1) {
      hctx.strokeStyle = '#22d3ee';
      hctx.lineWidth = 2;
      hctx.beginPath();
      navPts.forEach((p, i) => {
        if (i === 0) hctx.moveTo(x0 + p.x * sx, y0 + p.y * sy);
        else hctx.lineTo(x0 + p.x * sx, y0 + p.y * sy);
      });
      hctx.stroke();
    }
    // Small symbols for every kind of place (same colours as the big map).
    for (const dest of cachedDestinations(state)) {
      const dx = x0 + dest.x * sx;
      const dy = y0 + dest.y * sy;
      if (dest.locked) continue;
      const color = (SYMBOLS[dest.kind] || SYMBOLS.road).color;
      hctx.fillStyle = color;
      if (dest.kind === 'mission') {
        hctx.save();
        hctx.translate(dx, dy);
        hctx.rotate(Math.PI / 4);
        hctx.fillRect(-3.5, -3.5, 7, 7);
        hctx.restore();
      } else if (dest.kind === 'side') {
        hctx.beginPath();
        hctx.arc(dx, dy, 3.5, 0, Math.PI * 2);
        hctx.fill();
      } else {
        hctx.fillRect(dx - 2.5, dy - 2.5, 5, 5);
      }
    }
    const hero = state.hero;
    const active = state.missions.active || state.missions.activeSide;
    if (active) {
      hctx.fillStyle = '#fde047';
      hctx.beginPath();
      hctx.arc(x0 + active.x * sx, y0 + active.y * sy, 5, 0, Math.PI * 2);
      hctx.fill();
    }
    for (const p of state.police) {
      hctx.fillStyle = '#ef4444';
      hctx.fillRect(x0 + p.x * sx - 2, y0 + p.y * sy - 2, 4, 4);
    }
    // The player: a gold arrow pointing the way Leo faces.
    hctx.save();
    hctx.translate(x0 + hero.x * sx, y0 + hero.y * sy);
    hctx.rotate(hero.angle || 0);
    hctx.fillStyle = '#fde047';
    hctx.beginPath();
    hctx.moveTo(7, 0);
    hctx.lineTo(-5, -5);
    hctx.lineTo(-5, 5);
    hctx.closePath();
    hctx.fill();
    hctx.restore();
    hctx.strokeStyle = '#f8fafc';
    hctx.lineWidth = 1;
    hctx.beginPath();
    hctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 8, 0, Math.PI * 2);
    hctx.stroke();
    hctx.restore();
  }

  function drawHud(state, time) {
    const hero = state.hero;
    // v6 narrow layout (phones, view.w < 700): the top row and the bottom
    // strip are re-stacked so nothing overlaps — the desktop geometry
    // below is untouched for view.w >= 700.
    const narrow = view.w < 700;
    hctx.save();
    // Money and vitals, top-left. Narrow: the panel shrinks to 170 px
    // and the minimap to ~118 px, so the two fit side by side in 390 px
    // with room for the clock pill below them (v6 — the 250 px panel and
    // 190 px minimap overlapped each other and the clock).
    const panelW = narrow ? 170 : 250;
    const barW = narrow ? 146 : 200;
    hctx.fillStyle = 'rgba(10,14,22,0.8)';
    hctx.fillRect(12, 12, panelW, 86);
    text(fitText(`$${state.money.toLocaleString('en-US')}`, 26, barW, true), 24, 40, 26, '#4ade80', 'left', true);
    text(fitText(`${hero.name}  ·  ${weaponName(state.weapon)}`, 14, barW), 24, 62, 14, '#e2e8f0');
    // HP red bar, armor grey bar.
    hctx.fillStyle = '#1f2937';
    hctx.fillRect(24, 70, barW, 10);
    hctx.fillStyle = '#ef4444';
    hctx.fillRect(24, 70, barW * Math.max(0, hero.hp / 100), 10);
    hctx.fillStyle = '#1f2937';
    hctx.fillRect(24, 84, barW, 7);
    hctx.fillStyle = '#9ca3af';
    hctx.fillRect(24, 84, barW * Math.max(0, hero.armor / 100), 7);
    // Wanted stars under the minimap. Narrow: under the shrunken minimap
    // and lower, because the clock / GPS / prompt pills stack above them.
    const mmW = narrow ? Math.max(80, Math.min(118, view.w - 204)) : 190;
    const mmH = narrow ? Math.round(mmW * 142 / 190) : 142;
    const sx = narrow ? view.w - 164 : view.w - 190 - 14;
    const starsY = narrow ? 230 : 178;
    for (let i = 0; i < 5; i += 1) {
      text('★', sx + i * 30, starsY, 26, i < state.wanted ? '#fbbf24' : 'rgba(255,255,255,0.25)', 'left', true);
    }
    // Clock, season and day, top-centre — on a dark pill so the white text
    // stays readable against a bright noon sky (tester report: low
    // contrast at 10:15 in daylight). Narrow: the pill drops to a second
    // row under the money panel and minimap — centred at the top it
    // overlapped both (v6).
    const seasonLabel = state.season === 'rainy' ? t('hud.season.rainy') : t('hud.season.summer');
    const clockLabel = t('hud.clock', { clock: clockText(state), day: state.time.day, season: seasonLabel });
    hctx.font = `bold 17px ${FONT}`;
    const clockW = hctx.measureText(clockLabel).width;
    const clockY = narrow ? 110 : 12;
    hctx.fillStyle = 'rgba(10,14,22,0.78)';
    hctx.beginPath();
    if (typeof hctx.roundRect === 'function') hctx.roundRect(view.w / 2 - clockW / 2 - 12, clockY, clockW + 24, 28, 14);
    else hctx.rect(view.w / 2 - clockW / 2 - 12, clockY, clockW + 24, 28);
    hctx.fill();
    text(clockLabel, view.w / 2, clockY + 20, 17, '#f8fafc', 'center', true);
    // GPS: destination + remaining distance, under the clock.
    if (state.nav) {
      const gpsLabel = t('hud.gps', { label: state.nav.label, dist: navRemaining(state) });
      const gpsText = fitText(gpsLabel, 14, Math.min(560, view.w - 40));
      hctx.font = `bold 14px ${FONT}`;
      const gpsW = hctx.measureText(gpsText).width;
      const gpsY = narrow ? 142 : 44;
      hctx.fillStyle = 'rgba(8,47,73,0.85)';
      hctx.beginPath();
      if (typeof hctx.roundRect === 'function') hctx.roundRect(view.w / 2 - gpsW / 2 - 10, gpsY, gpsW + 20, 24, 12);
      else hctx.rect(view.w / 2 - gpsW / 2 - 10, gpsY, gpsW + 20, 24);
      hctx.fill();
      text(gpsText, view.w / 2, gpsY + 17, 14, '#a5f3fc', 'center', true);
    }
    // Objective + weapon/ammo. Narrow (phone): the bottom strip is the
    // touch buttons' turf — the objective bar moves above the stick
    // (clear of the E button), the ammo gets its own pill at the
    // bottom-right (clear of the CAR button), and the prompt moves to a
    // pill under the clock/GPS stack (v6 — all three collided with the
    // buttons and with each other at 390 px).
    const w = state.weapons[state.weapon];
    let ammoText = `${weaponName(state.weapon)}  ${w && w.mag === Infinity ? '∞' : `${w ? w.mag : 0} / ${w ? w.ammo : 0}`}`;
    if (narrow && state.playerVehicle) {
      ammoText += `  ·  ${Math.round(Math.abs(state.playerVehicle.speed) * 0.36)} km/h`;
    }
    if (narrow) {
      // Objective bar above the stick AND above the BAG / MAP touch
      // buttons (their top edge is bottom 182): bottom 240, clear of the
      // E button (its left edge is view.w - 86) and of the stick top
      // (bottom 152). v6 tester fix: the old bottom-206 bar sat at
      // y view.h-206..view.h-160 and the BAG / MAP circles (y 662..724
      // at 390x844) covered its lower-right corner and part of the text.
      const objW = Math.min(284, view.w - 106);
      hctx.fillStyle = 'rgba(10,14,22,0.75)';
      hctx.fillRect(12, view.h - 240, objW, 46);
      text(fitText(`◆ ${state.objective}`, 15, objW - 24), 24, view.h - 212, 15, '#fde68a');
      // Ammo pill, bottom-right: glyphs end 7+ px above the CAR/RUN
      // buttons' bottom edge (bottom 40).
      hctx.font = `bold 17px ${FONT}`;
      const ammoW = hctx.measureText(ammoText).width;
      hctx.fillStyle = 'rgba(10,14,22,0.75)';
      hctx.beginPath();
      if (typeof hctx.roundRect === 'function') hctx.roundRect(view.w - 24 - ammoW - 16, view.h - 38, ammoW + 16, 30, 10);
      else hctx.rect(view.w - 24 - ammoW - 16, view.h - 38, ammoW + 16, 30);
      hctx.fill();
      text(ammoText, view.w - 24, view.h - 15, 17, '#e2e8f0', 'right', true);
    } else {
      // Objective, bottom-left — text clipped to the bar so it can never
      // run under the weapon readout at the bottom-right.
      hctx.fillStyle = 'rgba(10,14,22,0.75)';
      const objW = Math.min(560, view.w - 28);
      hctx.fillRect(12, view.h - 58, objW, 46);
      // Reserve the ammo readout's width when it would overlap the bar
      // (mid-size windows: the bar ends at 572 but the ammo starts
      // around view.w - 160).
      hctx.font = `bold 17px ${FONT}`;
      const ammoW = hctx.measureText(ammoText).width;
      const ammoLeft = view.w - 24 - ammoW;
      const objTextW = (12 + objW > ammoLeft)
        ? Math.max(60, ammoLeft - 24 - 12) : objW - 24;
      text(fitText(`◆ ${state.objective}`, 15, objTextW), 24, view.h - 30, 15, '#fde68a');
      // Weapon and ammo, bottom-right.
      text(ammoText, view.w - 24, view.h - 30, 17, '#e2e8f0', 'right', true);
      if (state.playerVehicle) {
        text(`${state.playerVehicle.name}  ${Math.round(Math.abs(state.playerVehicle.speed) * 0.36)} km/h`, view.w - 24, view.h - 56, 15, '#93c5fd', 'right', true);
      }
    }
    // Interaction prompt. Narrow: a pill under the clock/GPS stack — at
    // the bottom it sat under the RUN/CAR buttons and the stick (v6).
    if (state.prompt) {
      if (narrow) {
        const promptText = fitText(state.prompt, 17, Math.min(560, view.w - 40), true);
        hctx.font = `bold 17px ${FONT}`;
        const promptW = hctx.measureText(promptText).width;
        hctx.fillStyle = 'rgba(10,14,22,0.78)';
        hctx.beginPath();
        if (typeof hctx.roundRect === 'function') hctx.roundRect(view.w / 2 - promptW / 2 - 12, 170, promptW + 24, 28, 14);
        else hctx.rect(view.w / 2 - promptW / 2 - 12, 170, promptW + 24, 28);
        hctx.fill();
        text(promptText, view.w / 2, 190, 17, '#f8fafc', 'center', true);
      } else {
        text(state.prompt, view.w / 2, view.h - 84, 17, '#f8fafc', 'center', true);
      }
    }
    hctx.restore();
    drawMinimap(state, mmW, mmH);
    void time;
  }

  // --- 3D navigation aids ------------------------------------------------
  // The full map lives in the DOM panel (map.js); what the 3D world shows
  // is the GPS guidance itself: a light beacon over the destination and a
  // chain of flat arrows lying on the road along the route.
  function drawNav3D(state, time) {
    const nav = state.nav;
    if (!nav || !nav.path || nav.path.length < 2) return;
    const T = (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
    if (!T) return;
    const beacon = pool.get('nav-beacon', () => {
      const m = new T.Mesh(
        new T.CylinderGeometry(1, 1, 12, 12, 1, true),
        new T.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.28, side: T.DoubleSide, depthWrite: false }),
      );
      return m;
    });
    beacon.position.set(nav.x, 6, nav.y);
    beacon.visible = true;
    const cone = pool.get('nav-cone', () => {
      const m = new T.Mesh(
        new T.ConeGeometry(0.8, 1.5, 4),
        new T.MeshBasicMaterial({ color: 0x22d3ee }),
      );
      return m;
    });
    cone.position.set(nav.x, 3.5 + Math.sin(time * 3) * 0.3, nav.y);
    cone.rotation.y = time;
    cone.visible = true;
    // Flat arrows on the road, one every ~12 m along the route
    // from the player. The cone geometry is pre-rotated to point along +Z,
    // so a Y rotation aims it down the road.
    const pts = cachedNavPath(state);
    if (pts && pts.length > 1) {
      let placed = 0;
      for (let i = 0; i + 1 < pts.length && placed < 40; i += 1) {
        const a = pts[i];
        const b = pts[i + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const steps = Math.floor(len / 12);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        for (let k = 1; k <= steps && placed < 40; k += 1) {
          const t = k / (steps + 1);
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t;
          const idx = placed;
          placed += 1;
          const arrow = pool.get(`nav-arrow-${idx}`, () => {
            const geo = new T.ConeGeometry(0.5, 1.2, 4);
            geo.rotateX(Math.PI / 2);
            return new T.Mesh(geo, new T.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 }));
          });
          arrow.position.set(x, 0.25, y);
          arrow.rotation.set(0, Math.PI / 2 - ang, 0);
          arrow.visible = true;
        }
      }
    }
  }

  // --- 3D frame --------------------------------------------------------
  // v4: ambient boats on the sea — they sail back and forth along the
  // coast (never moored), so the beach reads as a living resort shore.
  // One boat per lane: hull + cabin always, a sail on sailboats, crates on
  // fishing boats, a windshield on speedboats. Positions are exposed as
  // window.__neonBay.boats so testers can watch them move.
  // v4.1, realistic scale (1 unit = 1 m): a motorboat hull is ~8 m long.
  // Speeds are angular rates along the run — range*speed stays 6-8 m/s,
  // a believable boat speed, not a speedboat on fast-forward.
  // v6: scaled to the 2400x1800 map (x/4, y/3, range/3) — the water strip
  // is x 2300..2400, y 450..1800, so the boats sail along it (x wobble
  // +/-18 m stays inside the strip; ranges keep y inside the water).
  const BOATS = [
    { x: 2325, yc: 633.3, range: 106.7, speed: 0.022, phase: 0.0, kind: 'sail' },
    { x: 2350, yc: 833.3, range: 140, speed: 0.018, phase: 1.3, kind: 'fish' },
    { x: 2337.5, yc: 1033.3, range: 126.7, speed: 0.02, phase: 2.1, kind: 'speed' },
    { x: 2362.5, yc: 1233.3, range: 100, speed: 0.024, phase: 0.7, kind: 'sail' },
    { x: 2325, yc: 1433.3, range: 153.3, speed: 0.016, phase: 2.8, kind: 'fish' },
    { x: 2350, yc: 1633.3, range: 113.3, speed: 0.021, phase: 1.9, kind: 'speed' },
    { x: 2337.5, yc: 733.3, range: 86.7, speed: 0.026, phase: 3.6, kind: 'sail' },
    { x: 2362.5, yc: 933.3, range: 120, speed: 0.019, phase: 4.4, kind: 'fish' },
    { x: 2325, yc: 1133.3, range: 100, speed: 0.023, phase: 5.1, kind: 'speed' },
    { x: 2350, yc: 1533.3, range: 133.3, speed: 0.018, phase: 0.4, kind: 'sail' },
  ];
  const boatPositions = BOATS.map((b) => ({ x: b.x, y: b.yc, angle: 0, kind: b.kind }));
  function buildBoatGroup(T, kind) {
    const g = new T.Group();
    const hullMat = new T.MeshStandardMaterial({ color: kind === 'fish' ? 0x1e6f8e : 0xf8fafc, roughness: 0.5, metalness: 0.2 });
    const hull = new T.Mesh(new T.BoxGeometry(8, 1.2, 2.5), hullMat);
    hull.position.y = 0.6;
    g.add(hull);
    const cabinMat = new T.MeshStandardMaterial({ color: kind === 'speed' ? 0x1f2937 : 0xe2e8f0, roughness: 0.6, metalness: 0.1 });
    const cabin = new T.Mesh(new T.BoxGeometry(3, 1.2, 2), cabinMat);
    cabin.position.set(kind === 'sail' ? -0.8 : 0.4, 1.2, 0);
    g.add(cabin);
    if (kind === 'sail') {
      const mast = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 6, 6), new T.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 }));
      mast.position.set(0.8, 3.6, 0);
      g.add(mast);
      const sail = new T.Mesh(new T.BoxGeometry(0.4, 4.5, 2.6), new T.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8, side: T.DoubleSide }));
      sail.position.set(0.8, 3.4, 0);
      sail.rotation.z = 0.12;
      g.add(sail);
    } else if (kind === 'fish') {
      const crateMat = new T.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9 });
      for (const [cx, cz] of [[-2.4, -0.8], [-2.4, 0.8]]) {
        const crate = new T.Mesh(new T.BoxGeometry(1.6, 1.2, 1.2), crateMat);
        crate.position.set(cx, 1.2, cz);
        g.add(crate);
      }
    } else {
      const shield = new T.Mesh(new T.BoxGeometry(1.6, 1.2, 2.4), new T.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.8 }));
      shield.position.set(2.4, 1.2, 0);
      g.add(shield);
    }
    return g;
  }
  function drawBoats(time) {
    const T = (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
    if (!T) return;
    BOATS.forEach((b, i) => {
      const t = time * b.speed + b.phase;
      const y = b.yc + Math.sin(t) * b.range;
      const x = b.x + Math.sin(t * 0.7 + b.phase) * 18;
      // Heading follows the velocity: mostly along +/-y, so the boat
      // turns around at the ends of its run instead of sliding backwards.
      const vy = Math.cos(t);
      const vx = Math.cos(t * 0.7 + b.phase) * 18 * b.speed * 0.7;
      const heading = Math.atan2(vy, vx);
      const boat = pool.get(`boat-${i}`, () => buildBoatGroup(T, b.kind));
      boat.position.set(x, 0.1 + Math.sin(time * 1.3 + i) * 0.15, y);
      boat.rotation.y = -heading;
      boat.visible = true;
      boatPositions[i] = { x: Math.round(x), y: Math.round(y), angle: heading, kind: b.kind };
    });
  }

  function drawPickups(state, time) {
    let i = 0;
    for (const p of state.pickups) {
      if (p.taken) continue;
      const idx = i;
      i += 1;
      const color = p.kind === 'cash' ? '#4ade80' : '#f59e0b';
      const coin = pool.get(`pickup-${idx}`, () => coinMesh(color));
      coin.position.set(p.x, 0.6 + Math.sin(time * 2 + idx) * 0.15, p.y);
      coin.rotation.y = time * 3 + idx;
      if (coin.material.color.getHexString() !== color.slice(1)) {
        coin.material = _coinGeo[color] || coin.material;
      }
    }
  }

  function drawBlobShadow(id, x, z, rx = 0.9, rz = 0.5) {
    const s = pool.get(id, () => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(1, 20),
        new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }),
      );
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    s.scale.set(rx, rz, 1);
    s.position.set(x, 0.7, z);
  }

  function draw(state, world, screen, time) {
    state.world = world;
    const dt = lastTime === null ? 0.016 : Math.max(0, Math.min(0.1, time - lastTime));
    lastTime = time;

    // Static world meshes, added once.
    if (world && world.meshes && !worldsAdded.has(world)) {
      for (const m of world.meshes) scene.add(m);
      worldsAdded.add(world);
    }
    // Locked-district gates vanish once their district unlocks.
    // v5 perf: gates only change when an unlock flips, so re-scan the
    // mesh list only then instead of every frame (321 meshes/frame).
    const unlockedKey = state.unlocked ? state.unlocked.join('') : '';
    if (unlockedKey !== lastUnlockedKey) {
      lastUnlockedKey = unlockedKey;
      if (world && world.meshes) {
        for (const m of world.meshes) {
          if (m.userData && m.userData.gateDistrict !== undefined) {
            m.visible = !state.unlocked[m.userData.gateDistrict];
          }
        }
      }
    }

    // Third-person camera. Focus is the hero, or the vehicle they drive.
    const hero = state.hero;
    const focusX = state.playerVehicle ? state.playerVehicle.x : hero.x;
    const focusZ = state.playerVehicle ? state.playerVehicle.y : hero.y;
    const focusY = state.playerVehicle
      ? (state.playerVehicle.kind === 'plane' ? (state.playerVehicle.z || 0) : 0)
      : (hero.groundY || 0); // v5b: camera follows Leo up a mound
    const cam = state.camera || {};
    const yaw = Number.isFinite(cam.yaw) ? cam.yaw : 0;
    const pitch = Number.isFinite(cam.pitch) ? cam.pitch : 0.45;
    // v4.1 scale framing (1 unit = 1 m, Leo 1.8 m): at the default 14 m
    // follow distance Leo fills ~1/5-1/4 of the frame height and reads as
    // the focus. On foot the camera closes in (x0.55, clamped 6.5-9 m);
    // in a vehicle the wider view stays, so the car and the road ahead
    // stay proportional. The wheel still zooms — this only re-anchors
    // the default range on foot.
    const rawDist = Number.isFinite(cam.dist) ? cam.dist : 14;
    const dist = state.playerVehicle ? rawDist : Math.max(6.5, Math.min(rawDist * 0.55, 9));
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    camera.position.set(focusX - fx * dist * cp, focusY + dist * sp, focusZ - fz * dist * cp);
    camera.lookAt(focusX, focusY + 1, focusZ);

    // v5 perf: tree sectors fully beyond the fog are invisible anyway
    // (fog colour == sky colour at fogFar), so hide them instead of
    // rasterizing their ~200k triangles. Sectors carry their own
    // bounding sphere (world.js makeInstanced, culled=true); the check
    // is 29 sphere tests per frame. At the spawn this hides 3 of 6
    // sectors. Lamps/signs stay: they are 2 whole-map meshes + 24
    // planes, not the cost.
    if (world && world.densityMeshes && world.densityMeshes.trees) {
      const fogFar = scene.fog.far;
      const cx = camera.position.x;
      const cy = camera.position.y;
      const cz = camera.position.z;
      for (const m of world.densityMeshes.trees) {
        const bs = m.boundingSphere;
        if (!bs) continue;
        const dx = bs.center.x - cx;
        const dy = bs.center.y - cy;
        const dz = bs.center.z - cz;
        m.visible = Math.sqrt(dx * dx + dy * dy + dz * dz) - bs.radius < fogFar;
      }
    }

    // The world just loaded (or changed): apply the pending visual
    // density from the current quality level (low/medium hide trees).
    // v5: effectiveDensity, not the raw table value — see applyQuality.
    if (world && world !== currentWorld) {
      currentWorld = world;
      if (world.setVisualDensity) world.setVisualDensity(effectiveDensity);
    }

    weather.update(state, dt);
    // Night glow: lit windows, street lamps and headlights follow the
    // clock — throttled to 2 Hz (v5 perf): darkness moves over minutes,
    // not frames, and the sweep itself is pure per-frame overhead.
    if (time - lastNightGlowT >= 0.5) {
      lastNightGlowT = time;
      updateNightGlow(state);
    }

    // Traffic lights: the per-approach poles are road furniture
    // (vehicles.js drawRoadFurniture repaints their lamps from the same
    // graph.lightStateAt cycle). v7 removed the old centre-of-junction
    // poles from world.js, so there is nothing to repaint here any more.

    drawMissionMarkers(pool, state);
    drawNav3D(state, time);
    drawShopSigns(pool, world);
    drawBoats(time);
    drawVehicles(pool, state, time);
    drawNpcs(pool, state, time);
    drawPolice(pool, state, time);
    if (!state.playerVehicle) {
      if (shadowsEnabled) drawBlobShadow('shadow-hero', hero.x, hero.y);
      drawCharacter(pool, hero, true, time);
    }
    drawBullets(pool, state);
    drawPickups(state, time);
    pool.endFrame();

    // Debug hook for testers (main.js already keeps fps on this object —
    // only add properties, never replace it).
    if (typeof window !== 'undefined') {
      const nb = window.__neonBay || (window.__neonBay = {});
      nb.worldStats = world ? world.stats || null : null;
      nb.heroGroundY = hero.groundY || 0; // v5b: mound height under Leo's feet
      nb.heroPos = { x: hero.x, y: hero.y, groundY: hero.groundY || 0 };
      nb.boats = boatPositions;
      nb.cameraDist = dist;
      nb.cameraPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      nb.cameraYaw = yaw;
      nb.quality = _qualityLevel;
      nb.softwareRendering = softwareRendering;
      nb.effectiveDpr = qualityDpr;
      nb.renderDpr = view.renderDpr || qualityDpr;
      nb.rendererInfo = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
      nb.ambience = weather.getAmbienceState ? weather.getAmbienceState() : null;
      let nearNpcs = 0;
      let nearVehicles = 0;
      if (state.npcs) {
        for (const n of state.npcs) if (Math.hypot(n.x - focusX, n.y - focusZ) < 100) nearNpcs += 1;
      }
      if (state.vehicles) {
        for (const v of state.vehicles) if (Math.hypot(v.x - focusX, v.y - focusZ) < 100) nearVehicles += 1;
      }
      nb.nearby = { npcs: nearNpcs, vehicles: nearVehicles };
    }

    // Synchronous WebGL render: two paints are enough for a screenshot.
    renderer.render(scene, camera);

    // HUD on the 2D overlay canvas.
    if (hctx) {
      hctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      hctx.clearRect(0, 0, view.w, view.h);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_ACTIVITY) drawHud(state, time);
      // The full map is the DOM panel (map.js), not a canvas overlay.
    }
    if (screen === SCREEN_ACTIVITY) {
      drawActivity(state, { x: 0, y: 0, w: view.w, h: view.h });
    } else {
      hideActivityCanvas();
    }
  }

  /** Raycast from the camera through a client (mouse) point to the ground plane. */
  function screenToGround(clientX, clientY) {
    _ndc.set((clientX / Math.max(1, view.w)) * 2 - 1, -(clientY / Math.max(1, view.h)) * 2 + 1);
    raycaster.setFromCamera(_ndc, camera);
    const o = raycaster.ray.origin;
    const d = raycaster.ray.direction;
    if (Math.abs(d.y) < 1e-6) return { x: o.x, y: o.z };
    const t = -o.y / d.y;
    if (t < 0) return { x: o.x, y: o.z };
    return { x: o.x + d.x * t, y: o.z + d.z * t };
  }

  // Register the Settings hook: main.js applySettings() calls
  // hooks.onQualityChange(level) when the player changes quality, and this
  // makes it reach the renderer. Apply the stored level now in case it
  // was set before the renderer existed (Settings load at boot).
  if (typeof window !== 'undefined') {
    window.__neonBayHooks = window.__neonBayHooks || {};
    window.__neonBayHooks.onQualityChange = applyGraphicsQuality;
  }
  applyQuality(_qualityLevel);

  resize();
  window.addEventListener('resize', resize);
  return { draw, view, screenToGround, applyGraphicsQuality, getGraphicsQuality };
}
