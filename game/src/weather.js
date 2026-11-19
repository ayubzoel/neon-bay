// Neon Bay — weather & lighting.
// Pure day/night cycle + rain overlay. No assets, no network, canvas primitives only.

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

// Deterministic 0..1 hash of (seed, index): stable per frame, no stored state.
function hash01(seed, index) {
  const s = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Paint the weather overlay over the visible world rect.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} state - game state
 * @param {{ x: number, y: number, w: number, h: number }} view - visible world rect
 * @param {number} dt - frame delta in seconds (unused; rain animates off the clock)
 */
export function drawWeatherOverlay(ctx, state, view, dt) {
  if (!ctx || !view || !state) return;
  const w = view.w || 0;
  const h = view.h || 0;
  if (w <= 0 || h <= 0) return;

  const { darkness, tint, rainIntensity } = computeLighting(state);

  ctx.save();
  try {
    // Night darkness: a translucent tint over the whole visible rect.
    if (darkness > 0) {
      ctx.globalAlpha = darkness;
      ctx.fillStyle = tint;
      ctx.fillRect(view.x, view.y, w, h);
      ctx.globalAlpha = 1;
    }

    // Soft moon glow in the top-right of the view on dark nights.
    if (darkness > 0.35) {
      const mx = view.x + w * 0.86;
      const my = view.y + h * 0.16;
      const glowR = Math.min(w, h) * 0.11;
      const glow = ctx.createRadialGradient(mx, my, 2, mx, my, glowR);
      glow.addColorStop(0, 'rgba(226, 232, 240, 0.55)');
      glow.addColorStop(0.35, 'rgba(203, 213, 225, 0.18)');
      glow.addColorStop(1, 'rgba(203, 213, 225, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(mx, my, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(241, 245, 249, 0.9)';
      ctx.beginPath();
      ctx.arc(mx, my, Math.max(6, glowR * 0.16), 0, Math.PI * 2);
      ctx.fill();
    }

    // Rain streaks. Never throws when rain is 0 — the loop simply draws nothing.
    if (rainIntensity > 0) {
      const now = (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now();
      const tick = now / 16; // ~60 fps frame counter
      const count = Math.round(rainIntensity * 120);
      const fallSpeed = 0.35 + rainIntensity * 0.4; // fraction of view height per frame
      ctx.strokeStyle = 'rgba(174, 194, 224, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < count; i += 1) {
        const rx = hash01(1, i);
        const ry = hash01(2, i);
        const x = view.x + rx * w;
        // Streaks fall over time; the modulo wraps them back to the top.
        const y = view.y + (((ry + tick * fallSpeed * (0.6 + rx * 0.8)) % 1) + 1) % 1 * h;
        const len = 10 + hash01(3, i) * 8;
        ctx.moveTo(x, y);
        ctx.lineTo(x - len * 0.25, y + len);
      }
      ctx.stroke();
    }
  } finally {
    ctx.restore();
  }
}
