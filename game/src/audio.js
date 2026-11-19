// Neon Bay — synthesized sound effects.
// No audio files, no network: every sound is built from oscillators / filtered
// noise through a lazily-created AudioContext. Every public function is guarded
// so a missing or blocked AudioContext can never throw.

let audioCtx = null;
let muted = false;

function ensureCtx() {
  if (audioCtx) return audioCtx;
  try {
    const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext))
      || (typeof AudioContext !== 'undefined' ? AudioContext : null);
    if (!AC) return null;
    audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/**
 * Create the (lazily-built) AudioContext. Safe to call before any user
 * gesture — the context is simply created suspended and resumed on first use.
 */
export function initAudio() {
  const ctx = ensureCtx();
  if (ctx && ctx.state === 'suspended') {
    try {
      const p = ctx.resume();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // Resume needs a gesture in some browsers; sounds stay queued until then.
    }
  }
  return ctx;
}

/** Silence all future sounds (already-playing ones fade out on their own). */
export function setMuted(value) {
  muted = !!value;
}

function masterGain(ctx, volumeScale = 1) {
  const g = ctx.createGain();
  g.gain.value = 0.22 * Math.max(0, Math.min(1, volumeScale));
  g.connect(ctx.destination);
  return g;
}

// One oscillator blip, optionally sliding in pitch. dur is in seconds.
function tone(ctx, out, { freq = 440, freqEnd = null, dur = 0.15, type = 'sine', gain = 1, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// A burst of white noise through a lowpass filter, optionally sweeping down.
function noiseBurst(ctx, out, { dur = 0.2, gain = 1, filterFreq = 1200, filterEnd = null, delay = 0 }) {
  const t0 = ctx.currentTime + delay;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.max(10, filterFreq), t0);
  if (filterEnd !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(10, filterEnd), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, gain), t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

// Sound recipes: every sound is < 0.6 s except 'siren' (0.9 s).
const RECIPES = {
  shoot(ctx, out) {
    tone(ctx, out, { freq: 880, freqEnd: 220, dur: 0.12, type: 'square', gain: 0.5 });
    noiseBurst(ctx, out, { dur: 0.06, gain: 0.35, filterFreq: 3000 });
  },
  shotgun(ctx, out) {
    noiseBurst(ctx, out, { dur: 0.25, gain: 0.9, filterFreq: 2200, filterEnd: 300 });
    tone(ctx, out, { freq: 160, freqEnd: 60, dur: 0.2, type: 'sine', gain: 0.7 });
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
    // Two-tone wail, 0.9 s total.
    tone(ctx, out, { freq: 660, dur: 0.45, type: 'sine', gain: 0.45 });
    tone(ctx, out, { freq: 880, dur: 0.45, type: 'sine', gain: 0.45, delay: 0.45 });
  },
  unlock(ctx, out) {
    // District gate opens: a rising chime.
    [392, 523, 659, 784].forEach((f, i) => {
      tone(ctx, out, { freq: f, dur: 0.18, type: 'triangle', gain: 0.5, delay: i * 0.09 });
    });
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
 * Names: shoot, shotgun, explosion, hit, coin, pickup, click, mission,
 * wanted, splash, heal, denied, engine, siren, unlock, gate.
 */
export function playSfx(name) {
  playSfxAtVolume(name, 1);
}

// Where the listener (the hero) is, for 3D distance attenuation. Updated by
// the main loop; (0, 0) until the first update means "no attenuation yet".
let listenerX = 0;
let listenerY = 0;
let listenerSet = false;

/** Tell the audio system where the hero is (world coords). Never throws. */
export function setListenerPosition(x, y) {
  if (Number.isFinite(x) && Number.isFinite(y)) {
    listenerX = x;
    listenerY = y;
    listenerSet = true;
  }
}

/**
 * Play a sound positioned at world (x, y): full volume within ~150 units of
 * the hero, fading to silence by ~900 units. hx/hy override the stored
 * listener position when given. Never throws, even with no AudioContext.
 */
export function playSfx3D(name, x, y, hx, hy) {
  try {
    const lx = Number.isFinite(hx) ? hx : listenerX;
    const ly = Number.isFinite(hy) ? hy : listenerY;
    if (!Number.isFinite(hx) && !listenerSet) {
      playSfxAtVolume(name, 1);
      return;
    }
    const dist = Math.hypot(x - lx, y - ly);
    const volume = Math.max(0, Math.min(1, 1 - (dist - 150) / 750));
    if (volume <= 0.02) return;
    playSfxAtVolume(name, volume);
  } catch {
    // Audio must never break gameplay.
  }
}

function playSfxAtVolume(name, volumeScale) {
  try {
    if (muted) return;
    const recipe = RECIPES[name];
    if (!recipe) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        const p = ctx.resume();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        return;
      }
      if (ctx.state === 'suspended') return;
    }
    recipe(ctx, masterGain(ctx, volumeScale));
  } catch {
    // Audio must never break gameplay.
  }
}
