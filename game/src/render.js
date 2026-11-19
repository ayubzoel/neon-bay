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
import { DISTRICT_RECTS, SAFE_HOUSE, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
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
import { WEAPONS } from './config.js';

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
  if (!_coinGeo.box) _coinGeo.box = new THREE.BoxGeometry(18, 3, 18);
  if (!_coinGeo[color]) {
    _coinGeo[color] = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.25 });
  }
  return new THREE.Mesh(_coinGeo.box, _coinGeo[color]);
}

export function createRenderer(canvas) {
  const view = { scale: 1, w: 0, h: 0, dpr: 1 };
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    const el = document.getElementById('webglError');
    if (el) {
      el.hidden = false;
      el.textContent = 'WebGL is not available in this browser, so Neon Bay 3D cannot start. Try a browser with hardware acceleration enabled.';
    }
    return {
      draw() {},
      view,
      screenToGround() { return { x: 0, y: 0 }; },
    };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  if ('sRGBEncoding' in THREE) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = false; // no shadow maps: blob shadows only

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#87b5d6');
  scene.fog = new THREE.Fog(0x87b5d6, 800, 2600);
  const camera = new THREE.PerspectiveCamera(55, 1, 1, 5000);
  camera.position.set(700, 300, 1750);

  const weather = createWeather(scene);
  const pool = new MeshPool(scene);
  const worldsAdded = new WeakSet();
  const raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  let lastTime = null;

  // --- 2D HUD overlay -------------------------------------------------
  const hud = document.getElementById('hud');
  const hctx = hud ? hud.getContext('2d') : null;
  const fonts = new Map();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
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

  function drawMinimap(state) {
    const mw = 190;
    const mh = 142;
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
        hctx.fillText('LOCKED', cx, cy + 18);
      }
    }
    hctx.fillStyle = '#0e7490';
    for (const w of WATER_RECTS) hctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, w.w * sx, w.h * sy);
    const hero = state.characters[state.activeChar];
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
    hctx.fillStyle = '#fde047';
    hctx.beginPath();
    hctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 5, 0, Math.PI * 2);
    hctx.fill();
    hctx.strokeStyle = '#f8fafc';
    hctx.lineWidth = 1;
    hctx.beginPath();
    hctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 7, 0, Math.PI * 2);
    hctx.stroke();
    hctx.restore();
  }

  function drawHud(state, time) {
    const hero = state.characters[state.activeChar];
    hctx.save();
    // Money and vitals, top-left.
    hctx.fillStyle = 'rgba(10,14,22,0.8)';
    hctx.fillRect(12, 12, 250, 86);
    text(`$${state.money.toLocaleString('en-US')}`, 24, 40, 26, '#4ade80', 'left', true);
    text(`${hero.name}  ·  ${state.weapon ? WEAPONS[state.weapon].name : ''}`, 24, 62, 14, '#e2e8f0');
    // HP red bar, armor grey bar.
    hctx.fillStyle = '#1f2937';
    hctx.fillRect(24, 70, 200, 10);
    hctx.fillStyle = '#ef4444';
    hctx.fillRect(24, 70, 200 * Math.max(0, hero.hp / 100), 10);
    hctx.fillStyle = '#1f2937';
    hctx.fillRect(24, 84, 200, 7);
    hctx.fillStyle = '#9ca3af';
    hctx.fillRect(24, 84, 200 * Math.max(0, hero.armor / 100), 7);
    // Wanted stars under the minimap.
    const sx = view.w - 190 - 14;
    for (let i = 0; i < 5; i += 1) {
      text('★', sx + i * 30, 178, 26, i < state.wanted ? '#fbbf24' : 'rgba(255,255,255,0.25)', 'left', true);
    }
    // Clock, season and day, top-centre.
    const seasonLabel = state.season === 'rainy' ? 'Rainy Season' : 'Summer';
    text(`${clockText(state)}  ·  Day ${state.time.day}  ·  ${seasonLabel}`, view.w / 2, 30, 17, '#e2e8f0', 'center', true);
    // Objective, bottom-left — text clipped to the bar so it can never
    // run under the weapon readout at the bottom-right.
    hctx.fillStyle = 'rgba(10,14,22,0.75)';
    const objW = Math.min(560, view.w - 28);
    hctx.fillRect(12, view.h - 58, objW, 46);
    text(fitText(`◆ ${state.objective}`, 15, objW - 24), 24, view.h - 30, 15, '#fde68a');
    // Weapon and ammo, bottom-right.
    const w = state.weapons[state.weapon];
    const ammoText = w && w.mag === Infinity ? '∞' : `${w ? w.mag : 0} / ${w ? w.ammo : 0}`;
    text(`${WEAPONS[state.weapon].name}  ${ammoText}`, view.w - 24, view.h - 30, 17, '#e2e8f0', 'right', true);
    if (state.playerVehicle) {
      text(`${state.playerVehicle.name}  ${Math.round(Math.abs(state.playerVehicle.speed) * 0.36)} km/h`, view.w - 24, view.h - 56, 15, '#93c5fd', 'right', true);
    }
    // Interaction prompt.
    if (state.prompt) {
      text(state.prompt, view.w / 2, view.h - 84, 17, '#f8fafc', 'center', true);
    }
    hctx.restore();
    drawMinimap(state);
    void time;
  }

  function drawMapOverlay(state) {
    hctx.save();
    hctx.fillStyle = 'rgba(5,8,16,0.9)';
    hctx.fillRect(0, 0, view.w, view.h);
    const mw = Math.min(view.w - 60, 900);
    const mh = mw * (WORLD_HEIGHT / WORLD_WIDTH);
    const x0 = (view.w - mw) / 2;
    const y0 = (view.h - mh) / 2;
    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      const r = DISTRICT_RECTS[i];
      hctx.fillStyle = GROUND[i];
      hctx.fillRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
    }
    hctx.fillStyle = '#0e7490';
    for (const w of WATER_RECTS) hctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, w.w * sx, w.h * sy);
    hctx.strokeStyle = '#475569';
    for (const r of state.world.roads) hctx.strokeRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
    hctx.fillStyle = '#f8fafc';
    hctx.font = 'bold 15px system-ui, sans-serif';
    hctx.textAlign = 'center';
    hctx.fillText('NEON BAY — Downtown', x0 + 1500 * sx, y0 + 2200 * sy);
    hctx.fillText('Sunset Beach', x0 + 3900 * sx, y0 + 2200 * sy);
    hctx.fillText('Cinder Peaks', x0 + 2400 * sx, y0 + 450 * sy);
    hctx.fillStyle = '#7c3aed';
    hctx.fillRect(x0 + SAFE_HOUSE.x * sx - 5, y0 + SAFE_HOUSE.y * sy - 5, 10, 10);
    const hero = state.characters[state.activeChar];
    hctx.fillStyle = '#fde047';
    hctx.beginPath();
    hctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 8, 0, Math.PI * 2);
    hctx.fill();
    const active = state.missions.active || state.missions.activeSide;
    if (active) {
      hctx.strokeStyle = '#fde047';
      hctx.lineWidth = 3;
      hctx.beginPath();
      hctx.arc(x0 + active.x * sx, y0 + active.y * sy, 12, 0, Math.PI * 2);
      hctx.stroke();
    }
    text('Map — press M to close', view.w / 2, y0 + mh + 30, 16, '#e2e8f0', 'center', true);
    hctx.restore();
  }

  // --- 3D frame --------------------------------------------------------
  function drawPickups(state, time) {
    let i = 0;
    for (const p of state.pickups) {
      if (p.taken) continue;
      const idx = i;
      i += 1;
      const color = p.kind === 'cash' ? '#4ade80' : '#f59e0b';
      const coin = pool.get(`pickup-${idx}`, () => coinMesh(color));
      coin.position.set(p.x, 10 + Math.sin(time * 2 + idx) * 3, p.y);
      coin.rotation.y = time * 3 + idx;
      if (coin.material.color.getHexString() !== color.slice(1)) {
        coin.material = _coinGeo[color] || coin.material;
      }
    }
  }

  function drawBlobShadow(id, x, z, rx = 16, rz = 9) {
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
    if (world && world.meshes) {
      for (const m of world.meshes) {
        if (m.userData && m.userData.gateDistrict !== undefined) {
          m.visible = !state.unlocked[m.userData.gateDistrict];
        }
      }
    }

    // Third-person camera. Focus is the hero, or the vehicle they drive.
    const hero = state.characters[state.activeChar];
    const focusX = state.playerVehicle ? state.playerVehicle.x : hero.x;
    const focusZ = state.playerVehicle ? state.playerVehicle.y : hero.y;
    const focusY = state.playerVehicle && state.playerVehicle.kind === 'plane' ? (state.playerVehicle.z || 0) : 0;
    const cam = state.camera || {};
    const yaw = Number.isFinite(cam.yaw) ? cam.yaw : 0;
    const pitch = Number.isFinite(cam.pitch) ? cam.pitch : 0.45;
    const dist = Number.isFinite(cam.dist) ? cam.dist : 260;
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    camera.position.set(focusX - fx * dist * cp, focusY + dist * sp, focusZ - fz * dist * cp);
    camera.lookAt(focusX, focusY + 18, focusZ);

    weather.update(state, dt);

    drawMissionMarkers(pool, state);
    drawShopSigns(pool, world);
    drawVehicles(pool, state, time);
    drawNpcs(pool, state, time);
    drawPolice(pool, state, time);
    const other = state.characters[1 - state.activeChar];
    if (!state.playerVehicle) {
      drawBlobShadow('shadow-hero', hero.x, hero.y);
      drawBlobShadow('shadow-other', other.x, other.y);
      drawCharacter(pool, other, false, time);
      drawCharacter(pool, hero, true, time);
    }
    drawBullets(pool, state);
    drawPickups(state, time);
    pool.endFrame();

    // Synchronous WebGL render: two paints are enough for a screenshot.
    renderer.render(scene, camera);

    // HUD on the 2D overlay canvas.
    if (hctx) {
      hctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      hctx.clearRect(0, 0, view.w, view.h);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_ACTIVITY) drawHud(state, time);
      if (state.showMap) drawMapOverlay(state);
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

  resize();
  window.addEventListener('resize', resize);
  return { draw, view, screenToGround };
}
