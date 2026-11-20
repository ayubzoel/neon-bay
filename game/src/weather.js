// Neon Bay — weather & lighting.
// v2: computeLighting is unchanged (the renderer still uses it). The old
// 2D overlay (drawWeatherOverlay) is gone — weather is now real 3D light:
// createWeather(scene) installs a sun, a hemisphere light and rain points,
// and update(state, dt) drives them from the game clock. No assets, no network.
// Sky palettes come from SKY_COLORS in data.js (day/dusk/night/rain).
import { SKY_COLORS } from './data.js';
import { DISTRICT_RECTS } from './config.js';

/**
 * Compute lighting for the current game clock.
 * @param {object} state - game state ({ time: { minutes }, season, rain })
 * @returns {{ darkness: number, tint: string, rainIntensity: number }}
 *   darkness 0 at noon, ~0.5 at midnight; tint is the night-blue overlay colour.
 */
export function computeLighting(state) {
  const minutes = state && state.time && Number.isFinite(state.time.minutes)
    ? state.time.minutes
    : 12 * 60; // default to noon when the clock is missing
  const hour = ((minutes / 60) % 24 + 24) % 24;

  let darkness;
  if (hour < 5 || hour >= 20) {
    darkness = 0.5; // full dark: 00:00-05:00 and 20:00-24:00
  } else if (hour < 7) {
    darkness = 0.5 * (1 - (hour - 5) / 2); // dawn ramp 05:00-07:00
  } else if (hour < 18) {
    darkness = 0; // bright day 07:00-18:00
  } else {
    darkness = 0.5 * ((hour - 18) / 2); // dusk ramp 18:00-20:00
  }

  if (state && state.season === 'rainy') darkness += 0.08;
  darkness = Math.min(1, Math.max(0, darkness));

  const rainIntensity = state && Number.isFinite(state.rain)
    ? Math.min(1, Math.max(0, state.rain))
    : 0;

  return {
    darkness,
    tint: darkness > 0.25 ? '#0b1026' : '#1a1a2e',
    rainIntensity,
  };
}

/**
 * Day-part for an hour (0-24): 'night' | 'dawn' | 'day' | 'dusk'.
 * Used by the ambience rig (night is quieter, crickets) and by Settings.
 */
export function timeBand(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5 || h >= 20) return 'night';
  if (h < 7) return 'dawn';
  if (h < 18) return 'day';
  return 'dusk';
}

/**
 * Settings hook (Builder C calls this from the Settings menu): move the
 * game clock to `hours` (0-24, fractional). Applies immediately, no
 * restart; the clock keeps advancing from there.
 */
export function setTimeOfDay(state, hours) {
  if (!state) return;
  state.time = state.time || {};
  state.time.minutes = Math.round((((hours % 24) + 24) % 24) * 60);
  if (!Number.isFinite(state.time.day)) state.time.day = 1;
}

/**
 * Settings hook (Builder C calls this from the Settings menu): change the
 * weather. 'clear' -> summer, no rain; 'rain' -> rainy, 0.7; 'storm' ->
 * rainy, 1; 'drizzle' -> rainy, 0.3. Applies immediately, no restart.
 */
export function setWeather(state, kind) {
  if (!state) return;
  switch (kind) {
    case 'rain': state.season = 'rainy'; state.rain = 0.7; break;
    case 'storm': state.season = 'rainy'; state.rain = 1; break;
    case 'drizzle': state.season = 'rainy'; state.rain = 0.3; break;
    case 'clear': default: state.season = 'summer'; state.rain = 0; break;
  }
}

const RAIN_COUNT = 800;
const RAIN_W = 700;
const RAIN_H = 420;
const RAIN_D = 700;

const DAY_SKY = new THREE.Color(SKY_COLORS.day.sky);
const DUSK_SKY = new THREE.Color(SKY_COLORS.dusk.sky);
const NIGHT_SKY = new THREE.Color(SKY_COLORS.night.sky);
const RAIN_SKY = new THREE.Color(SKY_COLORS.rain.sky);
const _sky = new THREE.Color();
const _tmp = new THREE.Color();
const _hemiSky = new THREE.Color();
const _hemiGround = new THREE.Color();

/** Vertical sky-gradient textures (day/dusk/night/rain), painted once. */
function skyGradientTexture(key, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [at, color] of stops) grad.addColorStop(at, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
  const tex = new THREE.CanvasTexture(canvas);
  if ('sRGBEncoding' in THREE) tex.encoding = THREE.sRGBEncoding;
  return tex;
}

const SKY_GRADIENTS = {
  day: null, dusk: null, night: null, rain: null,
};
function skyGradient(which) {
  if (!SKY_GRADIENTS[which]) {
    const stops = {
      day: [[0, '#3f7fb8'], [0.45, '#87ceeb'], [0.75, '#cfe8f5'], [1, '#e8f3f8']],
      dusk: [[0, '#3a2a4a'], [0.45, '#e8907c'], [0.75, '#f7c873'], [1, '#ffe8b0']],
      night: [[0, '#02040a'], [0.5, '#0b1026'], [0.8, '#1a2340'], [1, '#232c4d']],
      rain: [[0, '#3d4a55'], [0.5, '#5b6b7a'], [0.8, '#7a8a94'], [1, '#93a3ab']],
    }[which];
    SKY_GRADIENTS[which] = skyGradientTexture(which, stops);
  }
  return SKY_GRADIENTS[which];
}

// ---------------------------------------------------------------------------
// Ambient audio — driven through audio.js, the ONE audio system.
// audio.js (Builder C) owns the AudioContext, the buses (music/sfx/
// ambience/vehicle) and the persistent ambience loop; its docstring says
// "weather.js ambience → setAmbience(kind)". So this module does NOT build
// a parallel rig or its own AudioContext: update() maps the hero's district
// + rain to one of audio.js's ambience kinds ('city' | 'beach' | 'peaks' |
// 'rain') and calls audio.js setAmbience(kind) when it changes. The
// Settings hooks below (onTimeMode/onWeatherMode, registered into
// window.__neonBayHooks for main.js) apply the chosen time/weather once on
// the next frame. Everything is guarded: audio must never break gameplay.
//
// Honest gaps (audio.js is Builder C's file, not mine): the ambience kinds
// have no night variant, so night is not yet quieter and there are no
// crickets; and there are no horn/gull/bird one-shots in the loop. Both are
// small additions to audio.js's AMBIENCE_KINDS / startLoops — flagged to
// the coordinator, not built here as a second audio system.
import { setAmbience as setAudioAmbience, getAudioState } from './audio.js';

const AMB_KIND_BY_DISTRICT = ['city', 'beach', 'peaks'];
let _ambienceKind = 'none';
let _ambienceDistrict = 0;
let _ambienceTimeOfDay = 'day';
let _ambienceRain = 0;
let _pendingTimeMode = null;
let _pendingWeatherMode = null;

/** District index (0 downtown, 1 beach, 2 peaks) for a hero position. */
export function districtAt(hero) {
  if (!hero) return 0;
  if (hero.y < DISTRICT_RECTS[2].y + DISTRICT_RECTS[2].h) return 2;
  if (hero.x >= DISTRICT_RECTS[1].x) return 1;
  return 0;
}

/**
 * The audio.js ambience kind for a game state: 'rain' when it is raining
 * hard, otherwise the hero's district ('city' | 'beach' | 'peaks').
 * Pure function — no audio side effects, easy to test.
 */
export function ambienceKindFor(state) {
  const rain = state && Number.isFinite(state.rain) ? state.rain : 0;
  if (rain > 0.4) return 'rain';
  return AMB_KIND_BY_DISTRICT[districtAt(state ? state.hero : null)];
}

/** Last driven ambience state (for the window.__neonBay debug hook). */
export function getAmbienceState() {
  let audioKind = null;
  try { audioKind = getAudioState ? getAudioState().ambience : null; } catch { /* ignore */ }
  return {
    kind: _ambienceKind,
    audioKind,
    district: ['downtown', 'beach', 'peaks'][_ambienceDistrict],
    timeOfDay: _ambienceTimeOfDay,
    rain: Math.round(_ambienceRain * 100) / 100,
  };
}

/**
 * Settings hook (main.js calls this via window.__neonBayHooks.onTimeMode
 * with 'auto' | 'day' | 'night'): jump the clock once to noon / 22:00 on
 * the next frame, then let it run. 'auto' does nothing.
 */
export function setTimeMode(mode) {
  _pendingTimeMode = mode === 'day' || mode === 'night' ? mode : null;
}

/**
 * Settings hook (main.js calls this via window.__neonBayHooks.onWeatherMode
 * with 'auto' | 'clear' | 'rain'): apply the weather once on the next
 * frame. 'auto' does nothing.
 */
export function setWeatherMode(mode) {
  _pendingWeatherMode = mode === 'clear' || mode === 'rain' ? mode : null;
}

/**
 * Install the 3D weather rig (sun, hemisphere light, rain) into the scene.
 * @param {THREE.Scene} scene
 * @returns {{ update: (state: object, dt: number) => void, getAmbienceState: () => object, ambienceKindFor: Function, districtAt: Function, setTimeMode: Function, setWeatherMode: Function }}
 */
export function createWeather(scene) {
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(400, 600, 300);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a3f4a, 0.9);
  scene.add(hemi);

  // Gradient sky dome: a big inverted sphere with a painted vertical
  // gradient (day/dusk/night/rain), following the camera focus. One draw
  // call, no fog on it, drawn behind everything.
  const skyGeo = new THREE.SphereGeometry(3800, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyGradient('day'), side: THREE.BackSide, fog: false, depthWrite: false,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.frustumCulled = false;
  skyDome.renderOrder = -1;
  scene.add(skyDome);
  let skyWhich = 'day';

  // Rain: one Points cloud in a box around the camera focus. The cloud
  // itself is repositioned to the focus each frame; drops fall and wrap.
  const positions = new Float32Array(RAIN_COUNT * 3);
  const speeds = new Float32Array(RAIN_COUNT);
  for (let i = 0; i < RAIN_COUNT; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * RAIN_W;
    positions[i * 3 + 1] = Math.random() * RAIN_H;
    positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_D;
    speeds[i] = 60 + Math.random() * 60; // 60-120 m/s: heavy rain, not supersonic
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xaec2e0, size: 2.2, transparent: true, opacity: 0,
    sizeAttenuation: true, depthWrite: false,
  });
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.visible = false;
  rain.frustumCulled = false;
  scene.add(rain);

  // v4: night sky — stars and a moon, so the night is a sky, not a void.
  // 700 stars on a dome around the focus (opacity follows the darkness),
  // and a pale moon disc hanging north-west of the focus. Both follow the
  // camera focus like the sky dome and the rain cloud do.
  const STAR_COUNT = 700;
  const starPos = new Float32Array(STAR_COUNT * 3);
  for (let i = 0; i < STAR_COUNT; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * Math.PI * 0.45 + 0.08;
    const r = 3300;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xffffff, size: 2, transparent: true, opacity: 0,
    sizeAttenuation: false, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.visible = false;
  stars.frustumCulled = false;
  scene.add(stars);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0, transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(90, 24), moonMat);
  moon.visible = false;
  moon.frustumCulled = false;
  scene.add(moon);

  function update(state, dt) {
    const { darkness, rainIntensity } = computeLighting(state);
    const minutes = state && state.time && Number.isFinite(state.time.minutes) ? state.time.minutes : 12 * 60;
    const hour = ((minutes / 60) % 24 + 24) % 24;

    // Sun angle: rises 06:00, sets 18:00. At night it becomes dim moonlight.
    const sunAngle = ((hour - 6) / 12) * Math.PI;
    const elev = Math.sin(sunAngle);
    const fx = state && state.camera ? state.camera.x || 0 : 0;
    const fz = state && state.camera ? state.camera.y || 0 : 0;
    if (elev > 0) {
      sun.position.set(fx + Math.cos(sunAngle) * 900, 120 + elev * 700, fz + 320);
      sun.intensity = 1.15 - darkness * 0.9;
      // Warm at dawn/dusk, white at noon.
      const warm = Math.max(0, 1 - elev * 2.2);
      sun.color.setRGB(1, 1 - warm * 0.25, 1 - warm * 0.45);
    } else {
      sun.position.set(fx - 300, 500, fz - 200);
      sun.intensity = 0.3; // moonlight: a touch stronger so the neon city reads
      sun.color.setHex(0x8ea2c8);
    }
    hemi.intensity = 0.95 - darkness * 0.55;
    // Hemisphere colours follow the same palette as the sky: warm at dusk,
    // deep blue at night, grey in the rain.
    const pal = (rainIntensity > 0.4) ? 'rain'
      : darkness > 0.35 ? 'night'
      : (hour >= 17 && hour < 20) ? 'dusk' : 'day';
    _hemiSky.set(SKY_COLORS[pal].hemiSky);
    _hemiGround.set(SKY_COLORS[pal].hemiGround);
    hemi.color.lerp(_hemiSky, Math.min(1, dt * 2 + 0.05));
    hemi.groundColor.lerp(_hemiGround, Math.min(1, dt * 2 + 0.05));

    // Sky dome: swap the gradient texture when the palette changes, and
    // keep the dome centred on the camera focus.
    const skyPick = (rainIntensity > 0.4) ? 'rain'
      : darkness > 0.35 ? 'night'
      : (hour >= 17 && hour < 20 && Math.max(0, 1 - Math.abs(hour - 18.5) / 1.5) > 0.3) ? 'dusk' : 'day';
    if (skyPick !== skyWhich) {
      skyWhich = skyPick;
      skyMat.map = skyGradient(skyPick);
      skyMat.needsUpdate = true;
    }
    skyDome.position.set(fx, 0, fz);

    // Sky + fog: day blue, dusk orange, night dark, rain grey.
    _sky.copy(DAY_SKY);
    if (darkness > 0) {
      const dusk = hour >= 17 && hour < 20 ? Math.max(0, 1 - Math.abs(hour - 18.5) / 1.5) : 0;
      if (dusk > 0) _tmp.copy(DUSK_SKY).lerp(DAY_SKY, 1 - dusk);
      else _tmp.copy(NIGHT_SKY);
      _sky.lerp(_tmp, Math.min(1, darkness * 2));
    }
    if (rainIntensity > 0) _sky.lerp(RAIN_SKY, rainIntensity * 0.6);
    scene.background = _sky;
    if (scene.fog) scene.fog.color.copy(_sky);

    // Rain follows the camera focus and falls.
    rain.visible = rainIntensity > 0.03;
    if (rain.visible) {
      rainMat.opacity = 0.55 * rainIntensity;
      rain.position.set(fx, 0, fz);
      if (dt > 0) {
        const pos = rainGeo.attributes.position.array;
        for (let i = 0; i < RAIN_COUNT; i += 1) {
          let y = pos[i * 3 + 1] - speeds[i] * dt;
          if (y < 0) y += RAIN_H;
          pos[i * 3 + 1] = y;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
    }

    // Stars + moon: fade in with the darkness, follow the focus.
    const nightT = Math.min(1, Math.max(0, darkness * 2));
    stars.visible = nightT > 0.05;
    if (stars.visible) {
      starMat.opacity = 0.9 * nightT;
      stars.position.set(fx, 0, fz);
    }
    moon.visible = nightT > 0.05;
    if (moon.visible) {
      moonMat.opacity = nightT;
      moon.position.set(fx - 1400, 1100, fz - 900);
      moon.lookAt(fx, 60, fz);
    }

    // Ambience: drive audio.js's loop from the hero's district + rain.
    // Settings time/weather modes (if the player picked them) apply once.
    if (_pendingTimeMode) {
      setTimeOfDay(state, _pendingTimeMode === 'day' ? 12 : 22);
      _pendingTimeMode = null;
    }
    if (_pendingWeatherMode) {
      setWeather(state, _pendingWeatherMode);
      _pendingWeatherMode = null;
    }
    _ambienceDistrict = districtAt(state.hero);
    _ambienceTimeOfDay = darkness > 0.35 ? 'night' : 'day';
    _ambienceRain = rainIntensity;
    const kind = ambienceKindFor(state);
    if (kind !== _ambienceKind) {
      _ambienceKind = kind;
      try { setAudioAmbience(kind); } catch { /* audio never breaks the game */ }
    }
  }

  // Register the Settings hooks so main.js applySettings() can drive
  // time/weather through this module (the hooks are called with the mode
  // only; the state is applied on the next update()).
  if (typeof window !== 'undefined') {
    window.__neonBayHooks = window.__neonBayHooks || {};
    window.__neonBayHooks.onTimeMode = setTimeMode;
    window.__neonBayHooks.onWeatherMode = setWeatherMode;
  }

  return { update, getAmbienceState, ambienceKindFor, districtAt, setTimeMode, setWeatherMode };
}
