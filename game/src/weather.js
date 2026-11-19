// Neon Bay — weather & lighting.
// v2: computeLighting is unchanged (the renderer still uses it). The old
// 2D overlay (drawWeatherOverlay) is gone — weather is now real 3D light:
// createWeather(scene) installs a sun, a hemisphere light and rain points,
// and update(state, dt) drives them from the game clock. No assets, no network.
// Sky palettes come from SKY_COLORS in data.js (day/dusk/night/rain).
import { SKY_COLORS } from './data.js';

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

/**
 * Install the 3D weather rig (sun, hemisphere light, rain) into the scene.
 * @param {THREE.Scene} scene
 * @returns {{ update: (state: object, dt: number) => void }}
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
    speeds[i] = 260 + Math.random() * 220;
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
      sun.intensity = 0.22;
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
  }

  return { update };
}
