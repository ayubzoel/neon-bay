// Neon Bay — procedural textures and shared materials (v3, semi-realistic
// look). Every texture is drawn once on an offscreen canvas at load: no
// downloads, no network, no image files. Materials are cached by key, so a
// hundred buildings share a handful of materials instead of one each.
//
// Facades come in three variants (brick, concrete, glass curtain), each
// with a day map and a night emissive map (a subset of windows lit warm).
// Night glow: materials registered with registerNightGlow get their
// emissiveIntensity driven from the game clock by updateNightGlow(state).
import { computeLighting } from './weather.js';

function three() {
  return (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
}

const _texCache = new Map();
const _matCache = new Map();
// { material, day, night } — emissiveIntensity follows the darkness.
const _nightGlow = [];

function hash01(seed, index) {
  const s = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** One canvas texture per key; the draw callback paints it. */
export function canvasTexture(key, w, h, draw) {
  if (_texCache.has(key)) return _texCache.get(key);
  const T = three();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = T.RepeatWrapping;
  tex.wrapT = T.RepeatWrapping;
  if ('sRGBEncoding' in T) tex.encoding = T.sRGBEncoding;
  _texCache.set(key, tex);
  return tex;
}

/** One shared material per key. */
export function stdMat(key, make) {
  if (_matCache.has(key)) return _matCache.get(key);
  const m = make();
  _matCache.set(key, m);
  return m;
}

function speckle(ctx, w, h, count, colors, sizeMax = 2) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.globalAlpha = 0.08 + Math.random() * 0.16;
    const s = 1 + Math.random() * sizeMax;
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

// --- Ground ----------------------------------------------------------------

export function asphaltMat() {
  return stdMat('asphalt', () => {
    const T = three();
    const map = canvasTexture('asphalt', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#26292f';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 2600, ['#000000', '#3a3f47', '#4b5563', '#1f2937'], 2);
      // Cracks: thin dark jagged lines.
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i += 1) {
        ctx.beginPath();
        let x = Math.random() * w;
        let y = Math.random() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j += 1) {
          x += (Math.random() - 0.5) * 60;
          y += (Math.random() - 0.5) * 60;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      // Patched repairs: slightly lighter rectangles.
      ctx.fillStyle = 'rgba(75,85,99,0.35)';
      for (let i = 0; i < 4; i += 1) ctx.fillRect(Math.random() * w, Math.random() * h, 40 + Math.random() * 40, 26 + Math.random() * 26);
      // Faded centre dashes baked in (the road mesh also draws a centre line).
      ctx.fillStyle = 'rgba(253,224,71,0.20)';
      for (let y = 0; y < h; y += 64) ctx.fillRect(w / 2 - 2, y, 4, 30);
    });
    return new T.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  });
}

export function sidewalkMat() {
  return stdMat('sidewalk', () => {
    const T = three();
    const map = canvasTexture('sidewalk', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#767b85';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 1800, ['#5b6068', '#8b9099', '#454a52'], 2);
      // Expansion joints: a slab grid.
      ctx.strokeStyle = 'rgba(31,41,55,0.6)';
      ctx.lineWidth = 2;
      for (let i = 0; i <= w; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(w, i); ctx.stroke();
      }
      // Stains.
      ctx.fillStyle = 'rgba(31,41,55,0.18)';
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 14 + Math.random() * 22, 8 + Math.random() * 14, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return new T.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
  });
}

export function sandMat() {
  return stdMat('sand', () => {
    const T = three();
    const map = canvasTexture('sand', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#d9b96a';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 3200, ['#c9a227', '#e8d194', '#b8934a', '#f0e0a8'], 2);
      // Wind ripples.
      ctx.strokeStyle = 'rgba(160,130,60,0.25)';
      ctx.lineWidth = 1.5;
      for (let y = 8; y < h; y += 18) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y + Math.sin(x * 0.09 + y) * 3);
        ctx.stroke();
      }
    });
    return new T.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
  });
}

export function grassMat() {
  return stdMat('grass', () => {
    const T = three();
    const map = canvasTexture('grass', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#5d7a4e';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 3400, ['#4a6741', '#6b8a58', '#7d9b68', '#3f5a38'], 2);
      ctx.fillStyle = 'rgba(90,70,45,0.35)';
      for (let i = 0; i < 8; i += 1) {
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 30, 12 + Math.random() * 18, Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    return new T.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
  });
}

export function rockMat() {
  return stdMat('rock', () => {
    const T = three();
    const map = canvasTexture('rock', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 2600, ['#4b5563', '#9ca3af', '#374151', '#7d8590'], 3);
      ctx.strokeStyle = 'rgba(17,24,39,0.4)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i += 1) {
        ctx.beginPath();
        let x = Math.random() * w;
        let y = Math.random() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j += 1) {
          x += (Math.random() - 0.5) * 70;
          y += (Math.random() - 0.5) * 40;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    });
    return new T.MeshStandardMaterial({ map, roughness: 1, metalness: 0 });
  });
}

export function concreteMat() {
  return stdMat('concrete', () => {
    const T = three();
    const map = canvasTexture('concrete', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#5b6068';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 2200, ['#454a52', '#7d838c', '#3a3f47'], 2);
      ctx.fillStyle = 'rgba(31,41,55,0.22)';
      for (let i = 0; i < 5; i += 1) ctx.fillRect(0, Math.random() * h, w, 6 + Math.random() * 14);
    });
    return new T.MeshStandardMaterial({ map, roughness: 0.9, metalness: 0 });
  });
}

// --- Facades ---------------------------------------------------------------
// Each variant: a day map (walls + dark windows) and a night emissive map
// (black, with a subset of windows glowing warm). The material colour tints
// the day map, so one variant serves many building colours.

function facadeCanvases(variant) {
  const day = canvasTexture(`facade-${variant}-day`, 128, 256, (ctx, w, h) => {
    if (variant === 'brick') {
      ctx.fillStyle = '#8a5a44';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(60,30,20,0.5)';
      ctx.lineWidth = 1;
      for (let y = 0; y < h; y += 8) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < w; x += 16) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke();
        }
      }
    } else if (variant === 'glass' || variant === 'tower') {
      // Glass curtain wall: dark blue-grey with a pale mullion grid. The
      // tower variant is the same curtain, denser and darker (taller slabs).
      ctx.fillStyle = variant === 'tower' ? '#2c4a63' : '#3d5a73';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(180,210,230,0.35)';
      for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 14) ctx.fillRect(x, y, 9, 9);
    } else if (variant === 'house') {
      // Warm plaster house front: cream walls, a brown plinth at the base,
      // and a terracotta band at the top (under the pitched roof).
      ctx.fillStyle = '#e8dcc3';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 500, ['#d9c8a8', '#f2e8d0', '#cbb894'], 2);
      ctx.fillStyle = '#8a6b4a';
      ctx.fillRect(0, h - 14, w, 14);
      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, w, 10);
    } else {
      // concrete panels, stained and dull.
      ctx.fillStyle = '#9a938a';
      ctx.fillRect(0, 0, w, h);
      speckle(ctx, w, h, 700, ['#7d766e', '#b0a89e', '#6b655e'], 2);
      ctx.strokeStyle = 'rgba(60,55,50,0.55)';
      ctx.lineWidth = 2;
      for (let y = 0; y <= h; y += 42) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
    }
    // Windows: 1.2 m wide x 1.0 m tall on a 2.4 m floor rhythm. The tile is
    // 9.6 x 19.2 m at 128 x 256 px (13.33 px/m), so 16 x 13 px is a normal
    // window, not a slit. 4 across x 8 up, with a pale frame.
    for (let wy = 12; wy < h - 16; wy += 32) {
      for (let wx = 10; wx < w - 12; wx += 28) {
        ctx.fillStyle = 'rgba(226,232,240,0.85)';
        ctx.fillRect(wx - 1, wy - 1, 18, 15);
        ctx.fillStyle = variant === 'glass' || variant === 'tower' ? '#16324a' : '#1e293b';
        ctx.fillRect(wx, wy, 16, 13);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(wx, wy, 16, 4);
        // Cross mullion: a real window has a frame down the middle.
        ctx.fillStyle = 'rgba(226,232,240,0.6)';
        ctx.fillRect(wx + 7, wy, 2, 13);
      }
    }
  });
  const night = canvasTexture(`facade-${variant}-night`, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);
    // The same window grid (16 x 13 px), ~35% lit warm.
    for (let wy = 12, row = 0; wy < h - 16; wy += 32, row += 1) {
      for (let wx = 10, col = 0; wx < w - 12; wx += 28, col += 1) {
        if (hash01(row * 7 + col * 13, variant.length * 31 + row) < 0.35) {
          ctx.fillStyle = hash01(col, row * 5) < 0.5 ? '#fbbf24' : '#f59e0b';
          ctx.fillRect(wx, wy, 16, 13);
        }
      }
    }
  });
  return { day, night };
}

const FACADE_VARIANTS = ['brick', 'concrete', 'glass', 'house', 'tower'];

/** Facade material for a building colour; variant cycles by building hash. */
export function facadeMat(color, variantIndex = 0) {
  const variant = FACADE_VARIANTS[variantIndex % FACADE_VARIANTS.length];
  return stdMat(`facade-${variant}-${color}`, () => {
    const T = three();
    const { day, night } = facadeCanvases(variant);
    const m = new T.MeshStandardMaterial({
      map: day, emissiveMap: night, emissive: 0xffffff,
      emissiveIntensity: 0, color, roughness: 0.9, metalness: 0,
    });
    _nightGlow.push({ material: m, day: 0, night: 1 });
    return m;
  });
}

export function roofMat() {
  return stdMat('roof', () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: 0x27272a, roughness: 1, metalness: 0 });
  });
}

export function waterMat() {
  return stdMat('water', () => {
    const T = three();
    return new T.MeshStandardMaterial({
      color: 0x0e7490, roughness: 0.25, metalness: 0.15,
      transparent: true, opacity: 0.9,
    });
  });
}

// --- Characters & vehicles -------------------------------------------------

export function skinMat(tone = 0xe8b98a) {
  return stdMat(`skin-${tone.toString(16)}`, () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: tone, roughness: 0.7, metalness: 0 });
  });
}

export function hairMat(color = 0x2a1a12) {
  return stdMat(`hair-${color.toString(16)}`, () => {
    const T = three();
    return new T.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
  });
}

export function pantsMat() {
  return stdMat('pants', () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.9, metalness: 0 });
  });
}

export function shoeMat() {
  return stdMat('shoes', () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.6, metalness: 0.1 });
  });
}

/** Car paint: low roughness, some metalness — reads as paint, not plastic. */
export function carPaintMat(color) {
  return stdMat(`paint-${color}`, () => {
    const T = three();
    return new T.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  });
}

export function glassMat() {
  return stdMat('glass-std', () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.85 });
  });
}

export function tyreMat() {
  return stdMat('tyre', () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.95, metalness: 0 });
  });
}

export function hubcapMat() {
  return stdMat('hubcap', () => {
    const T = three();
    return new T.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.3, metalness: 0.9 });
  });
}

// --- Neon signs (v4) -----------------------------------------------------
// A glowing sign board: dark backing, bright block text, painted once per
// (text, colour) on a canvas. The material's emissive map is the same
// texture, so the sign reads by day and GLOWS at night (registered with
// registerNightGlow: dim 0.55, night 2.4). All sign texts are original.
// Shop name plate: a canvas texture with the shop's name on a dark plate
// in the shop's colour — the same canvas-text technique as the neon signs
// (crisp at street-view distance, no font file, no worker, no dependency).
// Why not troika-three-text: troika is ESM-only with bare-specifier imports
// ('three', 'troika-three-utils', ...) that need an import map in index.html
// (not this builder's file) and is untested against the vendored three r149;
// canvas text already serves every sign in this game. See the final report.
export function shopSignMat(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 72;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14141c';
  ctx.fillRect(0, 0, 512, 72);
  ctx.strokeStyle = color || '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 504, 64);
  ctx.fillStyle = '#fff8e7';
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(name).toUpperCase(), 256, 38);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex });
}

export function neonSignMat(text, color) {
  return stdMat(`neon-${text}-${color}`, () => {
    const T = three();
    const map = canvasTexture(`neon-${text}-${color}`, 256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0b0f1a';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = color;
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Shrink the text until it fits the board.
      let size = 34;
      let label = text;
      while (ctx.measureText(label).width > w - 24 && size > 12) {
        size -= 2;
        ctx.font = `bold ${size}px system-ui, sans-serif`;
      }
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.fillText(label, w / 2, h / 2 + 1);
      ctx.shadowBlur = 0;
    });
    const m = new T.MeshStandardMaterial({
      map, emissiveMap: map, emissive: 0xffffff,
      emissiveIntensity: 0.55, roughness: 0.4, metalness: 0,
    });
    _nightGlow.push({ material: m, day: 0.55, night: 2.4 });
    return m;
  });
}

/** A light that is dim by day and glows at night (lamps, headlights). */
export function nightLightMat(key, color, dayIntensity = 0.1, nightIntensity = 1.6) {  return stdMat(key, () => {
    const T = three();
    const m = new T.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: dayIntensity,
      roughness: 0.4, metalness: 0,
    });
    _nightGlow.push({ material: m, day: dayIntensity, night: nightIntensity });
    return m;
  });
}

/** Register any material whose emissiveIntensity should follow the night. */
export function registerNightGlow(material, dayIntensity, nightIntensity) {
  _nightGlow.push({ material, day: dayIntensity, night: nightIntensity });
}

/** Drive every registered night-glow material from the game clock. */
export function updateNightGlow(state) {
  const { darkness } = computeLighting(state);
  // Lamps and windows already warm up at dusk, before full darkness.
  const minutes = state && state.time && Number.isFinite(state.time.minutes) ? state.time.minutes : 12 * 60;
  const hour = ((minutes / 60) % 24 + 24) % 24;
  const dusk = hour >= 17 && hour < 20 ? Math.max(0, 1 - Math.abs(hour - 18.5) / 1.5) : 0;
  const t = Math.max(0, Math.min(1, Math.max(darkness * 2, dusk * 0.85)));
  for (const entry of _nightGlow) {
    entry.material.emissiveIntensity = entry.day + (entry.night - entry.day) * t;
  }
}
