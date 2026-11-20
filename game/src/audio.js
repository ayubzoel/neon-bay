// Neon Bay — the ONE audio system. Every sound is synthesized locally
// (Web Audio API): no audio files, no network, 0 external requests.
//
// Architecture (master integration, v4):
//   AudioContext (created lazily, resumed on the first user gesture) →
//   master bus → destination, with four category buses feeding it:
//   music / sfx / ambience / vehicle. Each bus has its own volume +
//   mute, wired to the Settings sliders, so a slider moves its category
//   live. Builders A/B must call THIS module (never create their own
//   AudioContext): weather.js ambience → setAmbience(kind), vehicles.js
//   engine → setEngine(on, speed01), police.js siren → setSiren(on).
//
// Performance: one shared 1 s noise buffer (no per-shot allocation),
// short-lived nodes only for one-shots, persistent nodes for loops,
// a 100 ms lookahead scheduler for music, and a cap on concurrent SFX
// so auto-fire can never flood the mixer. Every public function is
// guarded — a missing or blocked AudioContext can never throw, and
// audio can never break gameplay.

let audioCtx = null;
let masterBus = null;
const buses = {}; // music | sfx | ambience | vehicle → GainNode
const volumes = { master: 0.8, music: 0.6, sfx: 0.9, ambience: 0.5, vehicle: 0.7 };
const mutedCats = { music: false, sfx: false, ambience: false, vehicle: false };
let muted = false;
let noiseBuffer = null;
let activeOneShots = 0;
const MAX_ONE_SHOTS = 12;

// Trim so the old recipe gains (tuned for a 0.22 master) land at the same
// loudness through the new buses: master 0.8 × cat 0.9 × trim 0.3 ≈ 0.22.
const BUS_TRIM = { music: 0.35, sfx: 0.3, ambience: 0.3, vehicle: 0.3 };

function ensureCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
      || (typeof AudioContext !== 'undefined' ? AudioContext : null);
    if (!AC) return null;
    audioCtx = new AC();
    masterBus = audioCtx.createGain();
    masterBus.gain.value = volumes.master * (muted ? 0 : 1);
    masterBus.connect(audioCtx.destination);
    for (const cat of Object.keys(BUS_TRIM)) {
      const g = audioCtx.createGain();
      g.gain.value = volumes[cat] * BUS_TRIM[cat] * (mutedCats[cat] ? 0 : 1);
      g.connect(masterBus);
      buses[cat] = g;
    }
    // One shared white-noise buffer for every burst, hat and swell.
    const len = audioCtx.sampleRate;
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    startLoops();
    setupTone();
    startMusicScheduler();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function applyBus(cat) {
  if (!audioCtx || !buses[cat]) return;
  buses[cat].gain.setTargetAtTime(
    volumes[cat] * BUS_TRIM[cat] * (mutedCats[cat] ? 0 : 1),
    audioCtx.currentTime, 0.03,
  );
}

function applyMaster() {
  if (!audioCtx || !masterBus) return;
  masterBus.gain.setTargetAtTime(volumes.master * (muted ? 0 : 1), audioCtx.currentTime, 0.03);
}

// --- Volume / mute API (Settings) -----------------------------------------
export function setMasterVolume(v) {
  volumes.master = Math.max(0, Math.min(1, Number(v) || 0));
  applyMaster();
}
export function setCategoryVolume(cat, v) {
  if (!(cat in volumes) || cat === 'master') return;
  volumes[cat] = Math.max(0, Math.min(1, Number(v) || 0));
  applyBus(cat);
}
export function setCategoryMuted(cat, value) {
  if (!(cat in mutedCats)) return;
  mutedCats[cat] = !!value;
  applyBus(cat);
}
/** Silence all future sounds (already-playing ones fade out on their own). */
export function setMuted(value) {
  muted = !!value;
  applyMaster();
}
export function isMuted() {
  return muted;
}
export function getVolumes() {
  return { ...volumes, muted, mutedCategories: { ...mutedCats } };
}
/** Apply a whole Settings audio block at once (boot + preset + slider). */
export function applyAudioSettings(a) {
  if (!a || typeof a !== 'object') return;
  if (a.master !== undefined) volumes.master = Math.max(0, Math.min(1, Number(a.master) || 0));
  for (const cat of ['music', 'sfx', 'ambience', 'vehicle']) {
    if (a[cat] !== undefined) volumes[cat] = Math.max(0, Math.min(1, Number(a[cat]) || 0));
  }
  muted = !!a.muted;
  if (a.mutedCategories && typeof a.mutedCategories === 'object') {
    for (const cat of Object.keys(mutedCats)) {
      if (a.mutedCategories[cat] !== undefined) mutedCats[cat] = !!a.mutedCategories[cat];
    }
  }
  ensureCtx();
  applyMaster();
  for (const cat of Object.keys(buses)) applyBus(cat);
}

// --- Context lifecycle (autoplay policy) -----------------------------------
let gestureHooked = false;
/**
 * Create the (lazily-built) AudioContext. Safe to call before any user
 * gesture — the context is simply created suspended and resumed on first
 * use. The first real gesture (click / key) resumes it.
 */
export function initAudio() {
  const ctx = ensureCtx();
  if (ctx) resumeAudio();
  if (!gestureHooked && typeof window !== 'undefined') {
    gestureHooked = true;
    const onGesture = () => resumeAudio();
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
  }
  return ctx;
}

export function resumeAudio() {
  const ctx = audioCtx || ensureCtx();
  if (!ctx) return false;
  if (ctx.state === 'suspended') {
    try {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      return false;
    }
  }
  // Tone.js shares this context; its start() is a no-op resume when the
  // context is already running.
  if (toneLib) {
    try {
      const p = toneLib.start();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Ignore — the native resume above is the real one.
    }
  }
  return ctx.state === 'running';
}

// --- One-shot primitives ----------------------------------------------------
function busOut(cat) {
  return buses[cat] || (audioCtx ? audioCtx.destination : null);
}

// One oscillator blip, optionally sliding in pitch. dur is in seconds.
function tone(ctx, out, { freq = 440, freqEnd = null, dur = 0.15, type = 'sine', gain = 1, delay = 0, at = null, pan = 0 }) {
  const t0 = at !== null ? at : ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  connectPan(ctx, g, out, pan);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
  return dur;
}

// A burst of the shared noise buffer through a filter, optionally sweeping.
function noiseBurst(ctx, out, { dur = 0.2, gain = 1, filterFreq = 1200, filterEnd = null, filterType = 'lowpass', delay = 0, at = null, pan = 0 }) {
  const t0 = at !== null ? at : ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(Math.max(10, filterFreq), t0);
  if (filterEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(10, filterEnd), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  connectPan(ctx, g, out, pan);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
  return dur;
}

function connectPan(ctx, node, out, pan) {
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    p.connect(out);
  } else {
    node.connect(out);
  }
}

// --- Sound recipes ----------------------------------------------------------
// Every sound is < 0.6 s except 'siren' (0.9 s one-shot wail).
const RECIPES = {
  shoot(ctx, out) {
    tone(ctx, out, { freq: 880, freqEnd: 220, dur: 0.12, type: 'square', gain: 0.5 });
    noiseBurst(ctx, out, { dur: 0.06, gain: 0.35, filterFreq: 3000 });
  },
  // v4: every weapon sounds different.
  pistol(ctx, out) {
    tone(ctx, out, { freq: 1500, freqEnd: 320, dur: 0.07, type: 'square', gain: 0.55 });
    noiseBurst(ctx, out, { dur: 0.05, gain: 0.4, filterFreq: 4500, filterType: 'highpass' });
  },
  rifle(ctx, out) {
    tone(ctx, out, { freq: 900, freqEnd: 140, dur: 0.14, type: 'square', gain: 0.6 });
    noiseBurst(ctx, out, { dur: 0.1, gain: 0.5, filterFreq: 2600 });
  },
  shotgun(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.25, gain: 0.9, filterFreq: 2200, filterEnd: 300 });
    tone(ctx, out, { freq: 160, freqEnd: 60, dur: 0.2, type: 'sine', gain: 0.7 });
  },
  bazooka(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.5, gain: 0.7, filterFreq: 900, filterEnd: 120 });
    tone(ctx, out, { freq: 120, freqEnd: 40, dur: 0.5, type: 'sine', gain: 0.8 });
  },
  throw(ctx, out) {
    // A thrown grenade whistles away.
    tone(ctx, out, { freq: 1200, freqEnd: 600, dur: 0.25, type: 'sine', gain: 0.25 });
  },
  swing(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.15, gain: 0.4, filterFreq: 2000, filterEnd: 500, filterType: 'bandpass' });
  },
  reload(ctx, out) {
    tone(ctx, out, { freq: 1800, dur: 0.03, type: 'square', gain: 0.3 });
    noiseBurst(ctx, out, { dur: 0.04, gain: 0.3, filterFreq: 3000, delay: 0.05 });
    tone(ctx, out, { freq: 1200, dur: 0.04, type: 'square', gain: 0.35, delay: 0.14 });
  },
  step(ctx, out) {
    // One soft footstep: a low tap, pitch jittered so strides never drone.
    noiseBurst(ctx, out, { dur: 0.06, gain: 0.22, filterFreq: 420 + Math.random() * 260 });
  },
  explosion(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.5, gain: 1, filterFreq: 900, filterEnd: 80 });
    tone(ctx, out, { freq: 90, freqEnd: 35, dur: 0.5, type: 'sine', gain: 0.9 });
  },
  hit(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.1, gain: 0.5, filterFreq: 900 });
    tone(ctx, out, { freq: 200, freqEnd: 90, dur: 0.15, type: 'triangle', gain: 0.6 });
  },
  coin(ctx, out) {
    tone(ctx, out, { freq: 988, dur: 0.09, type: 'sine', gain: 0.6 });
    tone(ctx, out, { freq: 1319, dur: 0.16, type: 'sine', gain: 0.6, delay: 0.08 });
  },
  pickup(ctx, out) {
    tone(ctx, out, { freq: 440, freqEnd: 880, dur: 0.15, type: 'sine', gain: 0.5 });
  },
  click(ctx, out) {
    tone(ctx, out, { freq: 1200, dur: 0.05, type: 'square', gain: 0.25 });
  },
  mission(ctx, out) {
    [523, 659, 784].forEach((f, i) => {
      tone(ctx, out, { freq: f, dur: 0.16, type: 'triangle', gain: 0.55, delay: i * 0.11 });
    });
  },
  wanted(ctx, out) {
    tone(ctx, out, { freq: 700, dur: 0.22, type: 'square', gain: 0.4 });
    tone(ctx, out, { freq: 500, dur: 0.22, type: 'square', gain: 0.4, delay: 0.24 });
  },
  splash(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.3, gain: 0.6, filterFreq: 1400, filterEnd: 400 });
  },
  heal(ctx, out) {
    [523, 659, 784].forEach((f) => {
      tone(ctx, out, { freq: f, dur: 0.4, type: 'sine', gain: 0.3 });
    });
  },
  denied(ctx, out) {
    tone(ctx, out, { freq: 160, freqEnd: 110, dur: 0.25, type: 'sawtooth', gain: 0.4 });
  },
  engine(ctx, out) {
    tone(ctx, out, { freq: 110, freqEnd: 330, dur: 0.5, type: 'sawtooth', gain: 0.35 });
    noiseBurst(ctx, out, { dur: 0.4, gain: 0.15, filterFreq: 500 });
  },
  siren(ctx, out) {
    // Two-tone wail, 0.9 s total (one-shot; the loop is setSiren()).
    tone(ctx, out, { freq: 660, dur: 0.45, type: 'sine', gain: 0.45 });
    tone(ctx, out, { freq: 880, dur: 0.45, type: 'sine', gain: 0.45, delay: 0.45 });
  },
  horn(ctx, out) {
    // v4.1 (Builder B trigger: vehicles.js H key): a car horn — two
    // detuned tones a major third apart, short and loud, like a real
    // dual-tone horn. Called via playSfx('horn').
    tone(ctx, out, { freq: 370, dur: 0.35, type: 'square', gain: 0.4 });
    tone(ctx, out, { freq: 466, dur: 0.35, type: 'square', gain: 0.4 });
    tone(ctx, out, { freq: 740, dur: 0.35, type: 'sawtooth', gain: 0.12 });
  },
  skid(ctx, out) {
    // v4.1 (Builder B trigger: vehicles.js braking / sharp turn):
    // a tire screech — narrow band-passed noise with a high squeal on
    // top, fading as the slide ends. Called via playSfx3D('skid').
    noiseBurst(ctx, out, { dur: 0.5, gain: 0.5, filterFreq: 1100, filterEnd: 700, filterType: 'bandpass' });
    tone(ctx, out, { freq: 1250, freqEnd: 900, dur: 0.45, type: 'sine', gain: 0.18 });
  },
  hornFar(ctx, out) {
    // v4.2: a DISTANT car horn — the same dual-tone interval as 'horn'
    // but quieter, lower and longer, as if it drifted in from a few
    // blocks away. Fired by the ambience one-shot scheduler in the city.
    tone(ctx, out, { freq: 340, dur: 0.6, type: 'square', gain: 0.10 });
    tone(ctx, out, { freq: 428, dur: 0.6, type: 'square', gain: 0.10 });
    tone(ctx, out, { freq: 680, dur: 0.6, type: 'sawtooth', gain: 0.03 });
  },
  gull(ctx, out) {
    // v4.2: a seagull cry at the beach — two descending squeals.
    tone(ctx, out, { freq: 1500, freqEnd: 950, dur: 0.35, type: 'sawtooth', gain: 0.16 });
    tone(ctx, out, { freq: 1350, freqEnd: 850, dur: 0.3, type: 'sawtooth', gain: 0.12, delay: 0.42 });
  },
  bird(ctx, out) {
    // v4.2: a mountain bird — three quick ascending chirps.
    [2500, 2900, 3300].forEach((f, i) => {
      tone(ctx, out, { freq: f, freqEnd: f + 400, dur: 0.07, type: 'sine', gain: 0.22, delay: i * 0.09 });
    });
  },
  cricket(ctx, out) {
    // v4.2: one cricket chirp — three fast high blips. The night
    // ambience replays it every few seconds (see setAmbience).
    [0, 0.05, 0.1].forEach((d) => {
      tone(ctx, out, { freq: 4200, dur: 0.03, type: 'sine', gain: 0.14, delay: d });
    });
  },
  unlock(ctx, out) {
    // District gate opens: a rising chime.
    [392, 523, 659, 784].forEach((f, i) => {
      tone(ctx, out, { freq: f, dur: 0.18, type: 'triangle', gain: 0.5, delay: i * 0.09 });
    });
  },
  backpack(ctx, out) {
    // v4: the bag's zipper — a quick low-to-high zip when it opens.
    tone(ctx, out, { freq: 300, freqEnd: 700, dur: 0.12, type: 'triangle', gain: 0.4 });
    tone(ctx, out, { freq: 700, freqEnd: 900, dur: 0.08, type: 'triangle', gain: 0.3, delay: 0.1 });
  },
  swap(ctx, out) {
    // v4: swapping weapons in the backpack — a short metallic click-clack.
    tone(ctx, out, { freq: 900, dur: 0.05, type: 'square', gain: 0.3 });
    noiseBurst(ctx, out, { dur: 0.07, gain: 0.35, filterFreq: 2500, delay: 0.05 });
    tone(ctx, out, { freq: 500, dur: 0.06, type: 'square', gain: 0.3, delay: 0.09 });
  },
  gate(ctx, out) {
    // Heavy gate bar lifting: low metallic clunk.
    tone(ctx, out, { freq: 90, freqEnd: 55, dur: 0.35, type: 'sine', gain: 0.8 });
    noiseBurst(ctx, out, { dur: 0.2, gain: 0.4, filterFreq: 500, filterEnd: 120 });
  },
};

/**
 * Play a synthesized sound effect by name. Unknown names and a missing
 * AudioContext are silently ignored — this function never throws.
 * Names: shoot, pistol, rifle, shotgun, bazooka, throw, swing, reload,
 * step, explosion, hit, coin, pickup, click, mission, wanted, splash,
 * heal, denied, engine, siren, horn, skid, unlock, gate, backpack, swap,
 * hornFar, gull, bird, cricket (ambient one-shots, see setAmbience).
 * opts: { volume 0..1, pan -1..1 }.
 */
export function playSfx(name, opts = {}) {
  return playSfxAtVolume(name, opts.volume !== undefined ? opts.volume : 1, opts.pan || 0, 'sfx');
}

// Where the listener (the hero) is, for 3D distance attenuation. Updated by
// the main loop; (0, 0) until the first update means "no attenuation yet".
let listenerX = 0;
let listenerY = 0;
let listenerSet = false;

/** Tell the audio system where the hero is (world coords, metres). Never throws. */
export function setListenerPosition(x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) {
    listenerX = x;
    listenerY = y;
    listenerSet = true;
  }
}

/**
 * Play a sound positioned at world (x, y) in METRES: full volume within
 * ~12 m of the hero, fading to silence by ~120 m, panned left/right by
 * relative x. hx/hy override the stored listener position when given.
 * Never throws, even with no AudioContext.
 */
export function playSfx3D(name, x, y, hx, hy) {
  try {
    const lx = Number.isFinite(hx) ? hx : listenerX;
    const ly = Number.isFinite(hy) ? hy : listenerY;
    if (!Number.isFinite(hx) && !listenerSet) {
      return playSfxAtVolume(name, 1, 0, 'sfx');
    }
    const dist = Math.hypot(x - lx, y - ly);
    const volume = Math.max(0, Math.min(1, 1 - (dist - 12) / 108));
    if (volume <= 0.02) return false;
    return playSfxAtVolume(name, volume, Math.max(-1, Math.min(1, (x - lx) / 60)), 'sfx');
  } catch {
    // Audio must never break gameplay.
    return false;
  }
}

function playSfxAtVolume(name, volumeScale, pan, cat) {
  try {
    if (muted) return false;
    // Footsteps are droppable ambience when the mixer is busy.
    if (activeOneShots >= MAX_ONE_SHOTS && name === 'step') return false;
    const recipe = RECIPES[name];
    if (!recipe) return false;
    const ctx = ensureCtx();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      resumeAudio();
      if (ctx.state === 'suspended') return false;
    }
    const out = busOut(cat);
    if (!out) return false;
    const g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, volumeScale));
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(out);
    } else {
      g.connect(out);
    }
    activeOneShots += 1;
    setTimeout(() => { activeOneShots = Math.max(0, activeOneShots - 1); }, 600);
    recipe(ctx, g);
    return true;
  } catch {
    // Audio must never break gameplay.
    return false;
  }
}

// --- Persistent loops: engine, siren, ambience ------------------------------
const loops = { engine: null, siren: null, ambience: null };

function startLoops() {
  const ctx = audioCtx;
  if (!ctx) return;
  // Engine: a sawtooth whose pitch follows speed, through a lowpass.
  {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(filter);
    filter.connect(g);
    g.connect(busOut('vehicle'));
    osc.start();
    loops.engine = { osc, filter, gain: g, on: false, speed01: 0 };
  }
  // Siren: a sine wailing between two tones via a slow LFO on frequency.
  {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 770;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g);
    g.connect(busOut('vehicle'));
    osc.start();
    lfo.start();
    loops.siren = { osc, lfo, gain: g, on: false };
  }
  // Ambience: the shared noise loop through a filter + a slow swell LFO.
  {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    const g = ctx.createGain();
    g.gain.value = 0;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    src.connect(filter);
    filter.connect(g);
    g.connect(busOut('ambience'));
    src.start();
    lfo.start();
    loops.ambience = { src, filter, lfo, lfoGain, gain: g, kind: 'none', base: 0 };
  }
}

/**
 * Vehicle engine loop (Builder B hook — vehicles.js / main.js call this,
 * nobody else builds engine sound). speed01 is 0..1 of top speed.
 */
export function setEngine(on, speed01 = 0) {
  try {
    const ctx = ensureCtx();
    const L = loops.engine;
    if (!ctx || !L) return;
    const s = Math.max(0, Math.min(1, Number(speed01) || 0));
    L.on = !!on;
    L.speed01 = s;
    const t = ctx.currentTime;
    L.osc.frequency.setTargetAtTime(55 + s * 165, t, 0.08);
    L.filter.frequency.setTargetAtTime(500 + s * 900, t, 0.08);
    L.gain.gain.setTargetAtTime(on ? 0.10 + s * 0.12 : 0, t, 0.1);
  } catch {
    // Audio must never break gameplay.
  }
}

/** Police siren loop (Builder B hook — police.js / main.js). */
export function setSiren(on, dist01 = 0) {
  try {
    const ctx = ensureCtx();
    const L = loops.siren;
    if (!ctx || !L) return;
    L.on = !!on;
    const d = Math.max(0, Math.min(1, Number(dist01) || 0));
    L.gain.gain.setTargetAtTime(on ? 0.16 * (1 - d * 0.7) : 0, ctx.currentTime, 0.15);
  } catch {
    // Audio must never break gameplay.
  }
}

const AMBIENCE_KINDS = {
  none: { filter: 320, base: 0, lfo: 0.03, lfoRate: 0.13 },
  city: { filter: 320, base: 0.10, lfo: 0.03, lfoRate: 0.13 },
  beach: { filter: 700, base: 0.12, lfo: 0.08, lfoRate: 0.09 },
  peaks: { filter: 1100, base: 0.07, lfo: 0.05, lfoRate: 0.07 },
  rain: { filter: 2400, base: 0.14, lfo: 0.02, lfoRate: 0.2 },
  // v4.2: night is QUIETER than the day city hum (base 0.04 vs 0.10) —
  // traffic thins out — and the crickets (below) carry it instead.
  night: { filter: 900, base: 0.04, lfo: 0.02, lfoRate: 0.05 },
};

/**
 * District ambience (Builder A hook — weather.js / main.js call this):
 * 'city' traffic hum, 'beach' surf swell, 'peaks' mountain wind,
 * 'rain' rainfall, 'none' silence. Crossfades by ramping.
 */
// v4.2: ambient one-shots — a distant horn in the city, gulls at the
// beach, birds in the peaks, crickets at night (fast, every 1.5–4 s).
// One chained timer per ambience kind; cleared whenever the kind changes
// or ambience is silenced. All of it routes through the ambience bus, so
// the Settings ambience volume/mute applies to the one-shots too.
const AMBIENT_ONESHOT = { city: 'hornFar', beach: 'gull', peaks: 'bird', night: 'cricket' };
function scheduleAmbientOneShot() {
  try {
    const L = loops.ambience;
    if (!L) return;
    if (L.oneShotTimer) { clearTimeout(L.oneShotTimer); L.oneShotTimer = null; }
    const name = AMBIENT_ONESHOT[L.kind];
    if (!name) return; // 'none' / 'rain': no wildlife.
    const delay = L.kind === 'night'
      ? 1500 + Math.random() * 2500
      : 8000 + Math.random() * 12000;
    L.oneShotTimer = setTimeout(() => {
      L.oneShotTimer = null;
      if (L.kind && AMBIENT_ONESHOT[L.kind]) {
        playSfxAtVolume(AMBIENT_ONESHOT[L.kind], 0.6, Math.random() * 1.6 - 0.8, 'ambience');
      }
      scheduleAmbientOneShot();
    }, delay);
  } catch {
    // Audio must never break gameplay.
  }
}
export function setAmbience(kind) {
  try {
    const ctx = ensureCtx();
    const L = loops.ambience;
    if (!ctx || !L) return;
    const k = AMBIENCE_KINDS[kind] ? kind : 'none';
    const p = AMBIENCE_KINDS[k];
    const changed = k !== L.kind;
    L.kind = k;
    L.base = p.base;
    if (changed) scheduleAmbientOneShot();
    const t = ctx.currentTime;
    L.filter.frequency.setTargetAtTime(p.filter, t, 0.4);
    L.lfo.frequency.setTargetAtTime(p.lfoRate, t, 0.4);
    L.lfoGain.gain.setTargetAtTime(p.lfo, t, 0.4);
    L.gain.gain.setTargetAtTime(p.base, t, 0.4);
  } catch {
    // Audio must never break gameplay.
  }
}

// --- Procedural music --------------------------------------------------------
// One lookahead scheduler, 16th-note steps, per-mode patterns. Modes:
// menu / downtown / beach / peaks + radio0..2 (car radio stations).
// Radio: 0 'Neon FM' (fast groove), 1 'Bay Waves' (chill), 2 'Peak Static'
// (sparse). All notes are simple oscillators — no samples, no network.
const MUSIC_MODES = {
  menu: { bpm: 76, bass: [45, 0, 0, 45, 0, 0, 41, 0, 0, 41, 0, 0, 48, 0, 0, 48], lead: [69, 0, 72, 0, 76, 0, 72, 0, 65, 0, 69, 0, 72, 0, 67, 0], hat: false, kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  downtown: { bpm: 104, bass: [33, 0, 33, 0, 36, 0, 33, 0, 38, 0, 33, 0, 36, 0, 40, 0], lead: [57, 0, 0, 60, 0, 0, 63, 0, 0, 60, 0, 57, 0, 0, 55, 0], hat: true, kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
  beach: { bpm: 84, bass: [48, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0], lead: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 72, 0, 71, 0, 0, 0], hat: false, kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  peaks: { bpm: 66, bass: [38, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0], lead: [62, 0, 0, 0, 65, 0, 0, 0, 69, 0, 0, 0, 67, 0, 0, 0], hat: false, kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  radio0: { bpm: 116, bass: [33, 0, 33, 0, 36, 0, 33, 0, 38, 0, 33, 0, 36, 0, 40, 0], lead: [57, 0, 60, 0, 63, 0, 60, 0, 65, 0, 63, 0, 60, 0, 57, 0], hat: true, kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
  radio1: { bpm: 90, bass: [48, 0, 0, 0, 45, 0, 0, 0, 43, 0, 0, 0, 45, 0, 0, 0], lead: [72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 79, 0, 76, 0, 72, 0], hat: false, kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0] },
  radio2: { bpm: 72, bass: [38, 0, 0, 0, 0, 0, 41, 0, 36, 0, 0, 0, 0, 0, 43, 0], lead: [62, 0, 0, 65, 0, 0, 69, 0, 0, 0, 67, 0, 65, 0, 0, 0], hat: false, kick: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
};
export const RADIO_STATIONS = ['Neon FM', 'Bay Waves', 'Peak Static'];

let musicMode = 'menu';
let radioChannel = 0;
let musicTimer = null;
let nextNoteTime = 0;
let musicStep = 0;

// --- Tone.js music engine (v4, skill: tone-js 15.5.72, vendored) ---------
// Tone.js drives the music when its vendored UMD build loaded
// (game/vendor/tone.min.js, window.Tone). It shares THIS module's
// AudioContext so its synths route through the same music bus and the
// same Settings volume, and there is exactly one context to resume.
// If Tone is missing or its setup throws, musicEngine stays 'pure' and
// the hand-rolled lookahead scheduler below plays the same patterns —
// the game never depends on Tone being there.
let toneLib = null;
let toneInstruments = null;
let toneStep = 0;
let musicEngine = 'pure';

function setupTone() {
  if (toneLib !== null || !audioCtx) return;
  try {
    const TG = (typeof globalThis !== 'undefined' && globalThis.Tone) || null;
    if (!TG || typeof TG.Context !== 'function' || typeof TG.getTransport !== 'function') return;
    TG.setContext(new TG.Context({ context: audioCtx }));
    const out = busOut('music');
    const kick = new TG.MembraneSynth({
      pitchDecay: 0.04, octaves: 6,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.6 },
    });
    kick.volume.value = -5;
    kick.connect(out);
    const bass = new TG.MonoSynth({
      oscillator: { type: 'sawtooth' },
      filter: { type: 'lowpass', frequency: 700, Q: 2 },
      envelope: { attack: 0.005, decay: 0.25, sustain: 0.2, release: 0.3 },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.1, baseFrequency: 120, octaves: 2.5 },
    });
    bass.volume.value = -10;
    bass.connect(out);
    const delay = new TG.FeedbackDelay('8n', 0.35);
    delay.wet.value = 0.25;
    delay.connect(out);
    const lead = new TG.PolySynth(TG.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.8 },
    });
    lead.volume.value = -14;
    lead.connect(delay);
    const hat = new TG.MetalSynth({
      envelope: { attack: 0.001, decay: 0.06, release: 0.02 },
      harmonicity: 5.1, modulationIndex: 24, resonance: 4200, octaves: 1.2,
    });
    hat.volume.value = -22;
    hat.connect(out);
    toneLib = TG;
    toneInstruments = { kick, bass, lead, hat, delay };
    musicEngine = 'tone';
    const loop = new TG.Loop((time) => {
      try {
        const mode = MUSIC_MODES[musicMode];
        if (!mode || musicMode === 'off') return;
        const step = toneStep % 16;
        const bassN = mode.bass[step];
        if (bassN) bass.triggerAttackRelease(midiToFreq(bassN), '16n', time);
        const leadN = mode.lead[step];
        if (leadN) lead.triggerAttackRelease(midiToFreq(leadN), '16n', time);
        if (mode.kick && mode.kick[step]) kick.triggerAttackRelease('C1', '8n', time);
        if (mode.hat && step % 4 === 2) hat.triggerAttackRelease('C6', '32n', time);
        toneStep += 1;
      } catch {
        // A bad note must never kill the loop.
      }
    }, '16n');
    loop.start(0);
    TG.getTransport().bpm.value = (MUSIC_MODES[musicMode] || MUSIC_MODES.menu).bpm;
    TG.getTransport().start();
  } catch {
    toneLib = null;
    toneInstruments = null;
    musicEngine = 'pure';
  }
}

function midiToFreq(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function startMusicScheduler() {
  if (musicTimer !== null) return;
  musicTimer = setInterval(() => {
    try {
      // The Tone.js engine owns the music when it is up; this scheduler
      // is only the fallback for a missing/failed Tone build.
      if (musicEngine !== 'pure') return;
      const ctx = audioCtx;
      if (!ctx || ctx.state !== 'running') return;
      if (musicMode === 'off' || muted || mutedCats.music || volumes.music <= 0) return;
      const mode = MUSIC_MODES[musicMode];
      if (!mode) return;
      const stepDur = 60 / mode.bpm / 4;
      if (nextNoteTime < ctx.currentTime) nextNoteTime = ctx.currentTime + 0.05;
      while (nextNoteTime < ctx.currentTime + 0.35) {
        const step = musicStep % 16;
        const bass = mode.bass[step];
        const lead = mode.lead[step];
        const out = busOut('music');
        if (bass) tone(ctx, out, { freq: midiToFreq(bass), dur: stepDur * 1.8, type: 'triangle', gain: 0.5, at: nextNoteTime });
        if (lead) tone(ctx, out, { freq: midiToFreq(lead), dur: stepDur * 1.4, type: 'sine', gain: 0.32, at: nextNoteTime });
        if (mode.hat && step % 4 === 2) noiseBurst(ctx, out, { dur: 0.03, gain: 0.12, filterFreq: 6000, filterType: 'highpass', at: nextNoteTime });
        musicStep += 1;
        nextNoteTime += stepDur;
      }
    } catch {
      // The scheduler must never throw into the game loop.
    }
  }, 100);
}

/** Switch the procedural music loop ('menu' | 'downtown' | 'beach' | 'peaks' | 'radio0..2' | 'off'). */
export function setMusic(mode) {
  if (mode === 'off' || MUSIC_MODES[mode]) {
    musicMode = mode;
    musicStep = 0;
    toneStep = 0;
    nextNoteTime = 0;
    if (toneLib) {
      try {
        const m = MUSIC_MODES[mode];
        if (m) toneLib.getTransport().bpm.value = m.bpm;
      } catch {
        // A transport hiccup falls back to the current tempo.
      }
    }
  }
}
export function getMusicMode() {
  return musicMode;
}
/** Car radio: channel 0..2. Switches the music to that station's loop immediately (the audio director in main.js re-asserts it while driving). Returns the station name. */
export function setRadioChannel(i) {
  radioChannel = ((Math.floor(Number(i)) || 0) % RADIO_STATIONS.length + RADIO_STATIONS.length) % RADIO_STATIONS.length;
  setMusic('radio' + radioChannel);
  return RADIO_STATIONS[radioChannel];
}
export function getRadioChannel() {
  return radioChannel;
}
export function cycleRadio() {
  return setRadioChannel(radioChannel + 1);
}

/** Play a short preview through one category bus (Settings test buttons). */
export function playTest(cat) {
  try {
    const ctx = ensureCtx();
    if (!ctx) return false;
    resumeAudio();
    if (cat === 'music') {
      const out = busOut('music');
      [69, 72, 76].forEach((m, i) => tone(ctx, out, { freq: midiToFreq(m), dur: 0.25, type: 'triangle', gain: 0.5, delay: i * 0.12 }));
      return true;
    }
    if (cat === 'ambience') {
      const out = busOut('ambience');
      noiseBurst(ctx, out, { dur: 1.2, gain: 0.5, filterFreq: 800, filterEnd: 300 });
      return true;
    }
    if (cat === 'vehicle') {
      playSfxAtVolume('engine', 1, 0, 'vehicle');
      return true;
    }
    if (cat === 'master') {
      playSfxAtVolume('coin', 1, 0, 'sfx');
      return true;
    }
    playSfxAtVolume('coin', 1, 0, 'sfx');
    return true;
  } catch {
    return false;
  }
}

/** Debug / test snapshot: context state, volumes, loops, music, radio. */
export function getAudioState() {
  return {
    ctxState: audioCtx ? audioCtx.state : 'none',
    running: !!audioCtx && audioCtx.state === 'running',
    muted,
    volumes: { ...volumes },
    mutedCategories: { ...mutedCats },
    musicMode,
    musicEngine,
    tone: !!toneLib,
    radioChannel,
    radioStation: RADIO_STATIONS[radioChannel],
    ambience: loops.ambience ? loops.ambience.kind : 'none',
    engineOn: loops.engine ? loops.engine.on : false,
    sirenOn: loops.siren ? loops.siren.on : false,
    activeOneShots,
  };
}
