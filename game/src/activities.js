// Neon Bay — minigames (activities).
// Screen-based games (pool, golf, darts, gym) run while state.screen === 'activity'.
// Race and swim are world-based challenges that run on the play screen.
// Plain ES modules, canvas primitives only, no network, no external assets.

import { addMoney } from './state.js';
import { playSfx } from './audio.js';
import { addStrings, t } from './i18n.js';

// Minigame strings (en default, id below). 'Neon' / 'Pier 9' are proper
// nouns and stay as-is; the words around them translate.
addStrings('en', {
  'act.pool.title': 'Neon Pool',
  'act.pool.stats': 'Pocketed {pocketed}/6  •  Shots left {shots}  •  $50 per ball',
  'act.pool.perfect': 'Pool finished! Pocketed 6/6 — earned ${earned}.',
  'act.pool.done': 'Pool finished! Pocketed {pocketed}/6 — earned ${earned}.',
  'act.golf.title': 'Neon Golf — Hole {hole} of 3',
  'act.golf.stats': 'Strokes {strokes} (par 3)  •  Total {total} (par 9)',
  'act.golf.splash': 'Splash! Ball back to the tee (+1 stroke).',
  'act.golf.done': 'Golf finished! {strokes} strokes (par 9) — earned ${reward}.',
  'act.golf.hole': 'Hole {hole} of 3 — par 3.',
  'act.golf.water': 'WATER',
  'act.golf.sand': 'SAND',
  'act.darts.title': 'Neon Darts',
  'act.darts.stats': 'Darts {thrown}/3  •  Points {points}  •  $2 per point (max $200)',
  'act.darts.done': 'Darts finished! {points} points — earned ${reward}.',
  'act.gym.title': 'Neon Gym — 10 second challenge',
  'act.gym.stats': 'Reps {reps}  •  $5 per rep over 20 (max $150)',
  'act.gym.done': 'Gym finished! {reps} reps in 10s — earned ${reward}.',
  'act.fish.title': 'Pier 9 Fishing',
  'act.fish.stats': 'Cast {cast}/3  •  Caught {caught}  •  Earned ${earned}  •  Click when the fish is in the gold zone',
  'act.fish.now': 'NOW! Click to catch it!',
  'act.fish.caught': 'Caught one! +${value}',
  'act.fish.missed': 'Missed — the fish darted away!',
  'act.fish.done': 'Fishing finished! Caught {caught}/3 — earned ${earned}.',
  'act.race.needVehicle': 'You need a vehicle to race!',
  'act.race.started': 'Race started! Hit all 5 checkpoints — first one is glowing.',
  'act.race.done': 'Race finished in {time}s — earned ${reward}!',
  'act.race.checkpoint': 'Checkpoint {index}/{total} — next one is glowing.',
  'act.swim.started': 'Swim challenge! Collect all 6 buoys in 60 seconds — $40 each.',
  'act.swim.buoy': 'Buoy {collected}/6 collected! +$40',
  'act.swim.done': 'Swim challenge over — {collected}/6 buoys.',
  'act.swim.doneBonus': 'Swim challenge over — {collected}/6 buoys, +$100 bonus for all 6!',
  'act.quit': 'Minigame quit.',
  'act.esc': 'ESC to quit',
});
addStrings('id', {
  'act.pool.title': 'Biliar Neon',
  'act.pool.stats': 'Masuk {pocketed}/6  •  Tembakan tersisa {shots}  •  $50 per bola',
  'act.pool.perfect': 'Biliar selesai! Masuk 6/6 — dapat ${earned}.',
  'act.pool.done': 'Biliar selesai! Masuk {pocketed}/6 — dapat ${earned}.',
  'act.golf.title': 'Golf Neon — Lubang {hole} dari 3',
  'act.golf.stats': 'Pukulan {strokes} (par 3)  •  Total {total} (par 9)',
  'act.golf.splash': 'Cebur! Bola kembali ke tee (+1 pukulan).',
  'act.golf.done': 'Golf selesai! {strokes} pukulan (par 9) — dapat ${reward}.',
  'act.golf.hole': 'Lubang {hole} dari 3 — par 3.',
  'act.golf.water': 'AIR',
  'act.golf.sand': 'PASIR',
  'act.darts.title': 'Dart Neon',
  'act.darts.stats': 'Dart {thrown}/3  •  Poin {points}  •  $2 per poin (maks $200)',
  'act.darts.done': 'Dart selesai! {points} poin — dapat ${reward}.',
  'act.gym.title': 'Gym Neon — tantangan 10 detik',
  'act.gym.stats': 'Rep {reps}  •  $5 per rep di atas 20 (maks $150)',
  'act.gym.done': 'Gym selesai! {reps} rep dalam 10 detik — dapat ${reward}.',
  'act.fish.title': 'Memancing di Pier 9',
  'act.fish.stats': 'Lemparan {cast}/3  •  Tertangkap {caught}  •  Dapat ${earned}  •  Klik saat ikan di zona emas',
  'act.fish.now': 'SEKARANG! Klik untuk menangkapnya!',
  'act.fish.caught': 'Dapat satu! +${value}',
  'act.fish.missed': 'Lolos — ikannya kabur!',
  'act.fish.done': 'Memancing selesai! Tertangkap {caught}/3 — dapat ${earned}.',
  'act.race.needVehicle': 'Kamu butuh kendaraan untuk balapan!',
  'act.race.started': 'Balapan dimulai! Lewati 5 checkpoint — yang pertama menyala.',
  'act.race.done': 'Balapan selesai dalam {time} detik — dapat ${reward}!',
  'act.race.checkpoint': 'Checkpoint {index}/{total} — selanjutnya menyala.',
  'act.swim.started': 'Tantangan renang! Kumpulkan 6 pelampung dalam 60 detik — $40 tiap satu.',
  'act.swim.buoy': 'Pelampung {collected}/6 terkumpul! +$40',
  'act.swim.done': 'Tantangan renang selesai — {collected}/6 pelampung.',
  'act.swim.doneBonus': 'Tantangan renang selesai — {collected}/6 pelampung, +$100 bonus semua 6!',
  'act.quit': 'Minigame dihentikan.',
  'act.esc': 'ESC untuk keluar',
});

export const ACTIVITY_KINDS = ['pool', 'golf', 'race', 'swim', 'darts', 'gym', 'fish'];

// --- Activity sounds ---
// All sound goes through audio.js (the ONE audio system, Builder C): the
// fishing catch/miss blips are playSfx('coin') / playSfx('splash') at the
// result sites below. No AudioContext, no oscillators in this module —
// audio.js owns the context, the buses and the mute/volume settings.

// Race: 5 checkpoints forming a loop on real downtown roads (v3 world):
// west along street 866.7, south down avenue 375, east along street 1466.7,
// north up avenue 975, and back to the start — the loop closes by
// returning to where it began. Every checkpoint sits on an intersection.
export const RACE_CHECKPOINTS = [
  { x: 675, y: 866.7 },
  { x: 375, y: 866.7 },
  { x: 375, y: 1466.7 },
  { x: 975, y: 1466.7 },
  { x: 675, y: 866.7 },
];

// Swim: 6 buoys in the open water along the far east edge (x 2332-2375,
// y 566.7-1600) — the sea east of Sunset Beach. Start at the Pier 9 Swim
// spot on the sand (2262.5, 880.7) and swim east into the water to reach them.
export const SWIM_BUOYS = [
  { x: 2337.5, y: 566.7 },
  { x: 2375, y: 766.7 },
  { x: 2332.5, y: 966.7 },
  { x: 2372.5, y: 1166.7 },
  { x: 2337.5, y: 1400 },
  { x: 2375, y: 1600 },
];

const FALLBACK_VIEW = { x: 0, y: 0, w: 1280, h: 720 };
const CHECKPOINT_RADIUS = 90;
const BUOY_RADIUS = 40;

// Last view passed to drawActivity — updateActivity has no view argument, so
// mouse aiming reuses the most recent drawn view to convert screen pixels to
// world coords. Falls back to treating the mouse as world coords.
// lastInput is the most recent input object, so drawActivity can draw the
// live pool aim line even though it receives no input argument.
let lastView = null;
let lastInput = null;

// The 2D overlay canvas for screen-based minigames (v2: #mini, added by
// index.html above the WebGL canvas; created here as a fallback if absent).
let miniCanvas = null;

function getMiniCanvas() {
  if (miniCanvas) return miniCanvas;
  if (typeof document === 'undefined') return null;
  let canvas = document.getElementById('mini');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'mini';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;display:none;z-index:6;touch-action:none;';
    document.body.appendChild(canvas);
  }
  miniCanvas = canvas;
  wireMiniInput(canvas);
  return canvas;
}

// The #mini overlay sits above the game canvas, so its pointer events never
// reach input.js: forward them to the shared input object instead, so clicks
// inside a minigame still aim, shoot and press buttons.
function wireMiniInput(canvas) {
  if (!canvas || canvas.dataset.neonWired) return;
  canvas.dataset.neonWired = '1';
  canvas.addEventListener('pointermove', (event) => {
    if (lastInput && lastInput.mouse) {
      lastInput.mouse.x = event.clientX;
      lastInput.mouse.y = event.clientY;
    }
  });
  canvas.addEventListener('pointerdown', (event) => {
    if (lastInput && lastInput.mouse) {
      lastInput.mouse.x = event.clientX;
      lastInput.mouse.y = event.clientY;
      lastInput.mouse.down = true;
      lastInput.mouse.clicked = true;
    }
  });
  canvas.addEventListener('pointerup', () => {
    if (lastInput && lastInput.mouse) lastInput.mouse.down = false;
  });
}

/** Hide the minigame overlay canvas (called by the renderer on other screens). */
export function hideActivityCanvas() {
  try {
    const canvas = miniCanvas || (typeof document !== 'undefined' ? document.getElementById('mini') : null);
    if (canvas && canvas.style.display !== 'none') canvas.style.display = 'none';
  } catch {
    // Hiding must never break the game loop.
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function showMsg(state, text, seconds = 3) {
  if (!state) return;
  state.message = text;
  state.messageTimer = seconds;
}

// Award money without overwriting the caller's message (addMoney only shows
// a message when given a reason). Falls back to a direct bump if stats is absent.
function award(state, amount) {
  if (!state || !amount) return;
  try {
    addMoney(state, amount);
  } catch {
    state.money = Math.max(0, (state.money || 0) + amount);
    if (state.stats) state.stats.earned = (state.stats.earned || 0) + Math.max(0, amount);
  }
}

function pressed(input, code) {
  return !!(input && typeof input.pressed === 'function' && input.pressed(code));
}

function mouseClicked(input) {
  return !!(input && input.mouse && input.mouse.clicked);
}

// Convert the mouse (screen pixels, relative to the game canvas) to world
// coords using the last drawn view and the canvas's on-screen size.
function mouseWorld(input) {
  const m = input && input.mouse ? input.mouse : null;
  if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return null;
  const view = lastView || FALLBACK_VIEW;
  try {
    if (typeof document !== 'undefined') {
      const canvas = document.getElementById('game') || document.querySelector('canvas');
      const rect = canvas && typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : null;
      if (rect && rect.width > 0 && rect.height > 0) {
        return {
          x: view.x + (m.x / rect.width) * view.w,
          y: view.y + (m.y / rect.height) * view.h,
        };
      }
    }
  } catch {
    // Fall through to the 1:1 fallback below.
  }
  return { x: m.x, y: m.y };
}

// ---------------------------------------------------------------------------
// Starting activities
// ---------------------------------------------------------------------------

/**
 * Start a minigame. Screen-based kinds set state.activity and switch
 * state.screen to 'activity'. 'race' and 'swim' are world-based: they set
 * state.race / state.swimChallenge and leave state.screen as 'play'.
 * Returns true when the activity started, false otherwise.
 */
export function startActivity(state, kind) {
  if (!state || !ACTIVITY_KINDS.includes(kind)) return false;
  if (kind === 'race') return startRaceChallenge(state);
  if (kind === 'swim') return startSwimChallenge(state);

  const base = { kind, elapsed: 0, done: false };
  if (kind === 'pool') {
    state.activity = { ...base, balls: null, table: null, shots: 8, pocketed: 0 };
  } else if (kind === 'golf') {
    state.activity = {
      ...base, hole: 0, strokes: 0, totalStrokes: 0,
      ball: { x: 0, y: 0, vx: 0, vy: 0 }, started: false,
    };
  } else if (kind === 'darts') {
    state.activity = { ...base, darts: [], points: 0, thrown: 0 };
  } else if (kind === 'gym') {
    state.activity = { ...base, timeLeft: 10, reps: 0 };
  } else if (kind === 'fish') {
    // v4: pier fishing — 3 casts. A fish swims back and forth under the
    // pier while a gold strike zone drifts; click when the fish is inside
    // the zone to land it ($40 + $20 per cast). A click outside the zone
    // scares the fish away for that cast.
    state.activity = {
      ...base, casts: 0, caught: 0, earned: 0,
      phase: 'swim', result: '', resultTimer: 0, value: 0,
    };
  }
  state.screen = 'activity';
  return true;
}

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

const POOL_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
const POOL_BALL_R = 11;
const POOL_POCKET_R = 26;

function poolTable(view) {
  const w = Math.min(view.w * 0.86, 920);
  const h = w * 0.5;
  return {
    x: view.x + (view.w - w) / 2,
    y: view.y + (view.h - h) / 2 - 10,
    w, h,
  };
}

function poolPockets(table) {
  return [
    { x: table.x, y: table.y },
    { x: table.x + table.w / 2, y: table.y },
    { x: table.x + table.w, y: table.y },
    { x: table.x, y: table.y + table.h },
    { x: table.x + table.w / 2, y: table.y + table.h },
    { x: table.x + table.w, y: table.y + table.h },
  ];
}

function initPool(act, view) {
  const table = poolTable(view);
  act.table = table;
  const balls = [{
    x: table.x + table.w * 0.22, y: table.y + table.h / 2,
    vx: 0, vy: 0, cue: true, color: '#f8fafc', pocketed: false,
  }];
  const ax = table.x + table.w * 0.72;
  const ay = table.y + table.h / 2;
  const spots = [
    [0, 0], [1, -0.5], [1, 0.5], [2, -1], [2, 0], [2, 1],
  ];
  for (let i = 0; i < 6; i += 1) {
    balls.push({
      x: ax + spots[i][0] * POOL_BALL_R * 2.1,
      y: ay + spots[i][1] * POOL_BALL_R * 2.1,
      vx: 0, vy: 0, cue: false, color: POOL_COLORS[i], pocketed: false,
    });
  }
  act.balls = balls;
}

function poolBallsMoving(act) {
  return act.balls.some((b) => !b.pocketed && Math.hypot(b.vx, b.vy) > 8);
}

function stepPoolPhysics(act, dt) {
  const table = act.table;
  const balls = act.balls;
  let pocketedNow = 0;
  for (const b of balls) {
    if (b.pocketed) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const damp = Math.exp(-1.1 * dt);
    b.vx *= damp;
    b.vy *= damp;
    if (Math.hypot(b.vx, b.vy) < 8) { b.vx = 0; b.vy = 0; }
    // Wall bounce (cushions).
    if (b.x - POOL_BALL_R < table.x) { b.x = table.x + POOL_BALL_R; b.vx = Math.abs(b.vx) * 0.8; }
    if (b.x + POOL_BALL_R > table.x + table.w) { b.x = table.x + table.w - POOL_BALL_R; b.vx = -Math.abs(b.vx) * 0.8; }
    if (b.y - POOL_BALL_R < table.y) { b.y = table.y + POOL_BALL_R; b.vy = Math.abs(b.vy) * 0.8; }
    if (b.y + POOL_BALL_R > table.y + table.h) { b.y = table.y + table.h - POOL_BALL_R; b.vy = -Math.abs(b.vy) * 0.8; }
  }
  // Ball-ball: push overlapping balls apart and exchange the velocity
  // component along the line between them (equal-mass elastic-ish).
  for (let i = 0; i < balls.length; i += 1) {
    for (let j = i + 1; j < balls.length; j += 1) {
      const a = balls[i];
      const b = balls[j];
      if (a.pocketed || b.pocketed) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = POOL_BALL_R * 2;
      if (d > 0.01 && d < min) {
        const nx = dx / d;
        const ny = dy / d;
        const overlap = (min - d) / 2;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel < 0) {
          const impulse = -rel;
          a.vx -= impulse * nx; a.vy -= impulse * ny;
          b.vx += impulse * nx; b.vy += impulse * ny;
        }
      }
    }
  }
  // Pockets.
  const pockets = poolPockets(table);
  for (const b of balls) {
    if (b.pocketed) continue;
    for (const p of pockets) {
      if (dist(b.x, b.y, p.x, p.y) < POOL_POCKET_R) {
        if (b.cue) {
          // Scratch: respot the cue ball at its starting spot (no money).
          b.vx = 0; b.vy = 0;
          b.x = table.x + table.w * 0.22;
          b.y = table.y + table.h / 2;
        } else {
          b.pocketed = true;
          b.vx = 0; b.vy = 0;
          pocketedNow += 1;
        }
        break;
      }
    }
  }
  return pocketedNow;
}

function updatePool(state, act, dt, input) {
  const view = lastView || FALLBACK_VIEW;
  if (!act.balls) initPool(act, view);
  act.elapsed += dt;
  const cue = act.balls[0];

  if (poolBallsMoving(act)) {
    const gained = stepPoolPhysics(act, dt);
    if (gained > 0) {
      act.pocketed += gained;
      award(state, gained * 50);
    }
    return null;
  }

  if (act.pocketed >= 6) {
    act.done = true;
    showMsg(state, t('act.pool.perfect', { earned: act.pocketed * 50 }));
    return 'done';
  }
  if (act.shots <= 0) {
    act.done = true;
    showMsg(state, t('act.pool.done', { pocketed: act.pocketed, earned: act.pocketed * 50 }));
    return 'done';
  }

  if (mouseClicked(input)) {
    const m = mouseWorld(input);
    if (m && !cue.pocketed) {
      const d = dist(cue.x, cue.y, m.x, m.y);
      if (d > 4) {
        const power = clamp(d / 500, 0.1, 1);
        const speed = power * 950;
        cue.vx = ((m.x - cue.x) / d) * speed;
        cue.vy = ((m.y - cue.y) / d) * speed;
        act.shots -= 1;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Golf
// ---------------------------------------------------------------------------

function golfCourse(view) {
  const w = Math.min(view.w * 0.72, 820);
  const h = 300;
  return {
    x: view.x + (view.w - w) / 2,
    y: view.y + (view.h - h) / 2,
    w, h,
  };
}

function golfHoleLayout(act, course) {
  const tee = { x: course.x + 80, y: course.y + course.h / 2 };
  const hole = {
    x: tee.x + 520 + act.hole * 60,
    y: course.y + course.h / 2 + (act.hole % 2 === 0 ? -60 : 60),
  };
  const hazards = [
    // Water sits below the direct tee-to-hole line: a straight shot clears
    // it, a wild one pays for it.
    { x: (tee.x + hole.x) / 2, y: course.y + course.h / 2 + 85, r: 40, kind: 'water' },
  ];
  if (act.hole >= 1) {
    hazards.push({ x: tee.x + 380, y: course.y + course.h / 2 - 80, r: 38, kind: 'sand' });
  }
  return { tee, hole, hazards };
}

function initGolfHole(act, view) {
  const course = golfCourse(view);
  const layout = golfHoleLayout(act, course);
  act.course = course;
  act.layout = layout;
  act.ball.x = layout.tee.x;
  act.ball.y = layout.tee.y;
  act.ball.vx = 0;
  act.ball.vy = 0;
  act.started = true;
}

function updateGolf(state, act, dt, input) {
  const view = lastView || FALLBACK_VIEW;
  if (!act.started) initGolfHole(act, view);
  act.elapsed += dt;
  const ball = act.ball;
  const layout = act.layout;
  const course = act.course;
  const speed = Math.hypot(ball.vx, ball.vy);

  if (speed > 12) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    let damp = Math.exp(-1.6 * dt);
    for (const hz of layout.hazards) {
      if (hz.kind === 'sand' && dist(ball.x, ball.y, hz.x, hz.y) < hz.r) damp = Math.exp(-3.5 * dt);
    }
    ball.vx *= damp;
    ball.vy *= damp;
    if (Math.hypot(ball.vx, ball.vy) < 12) { ball.vx = 0; ball.vy = 0; }
    // Soft bounce off the green's edges.
    if (ball.x < course.x + 8) { ball.x = course.x + 8; ball.vx = Math.abs(ball.vx) * 0.5; }
    if (ball.x > course.x + course.w - 8) { ball.x = course.x + course.w - 8; ball.vx = -Math.abs(ball.vx) * 0.5; }
    if (ball.y < course.y + 8) { ball.y = course.y + 8; ball.vy = Math.abs(ball.vy) * 0.5; }
    if (ball.y > course.y + course.h - 8) { ball.y = course.y + course.h - 8; ball.vy = -Math.abs(ball.vy) * 0.5; }
    // Water hazard: ball back to the tee, +1 stroke.
    for (const hz of layout.hazards) {
      if (hz.kind === 'water' && dist(ball.x, ball.y, hz.x, hz.y) < hz.r) {
        ball.x = layout.tee.x;
        ball.y = layout.tee.y;
        ball.vx = 0; ball.vy = 0;
        act.strokes += 1;
        showMsg(state, t('act.golf.splash'));
        break;
      }
    }
    // A slow ball rolling over the hole drops in — fall through to the
    // at-rest hole check below instead of waiting for a full stop.
    const rollingIn = dist(ball.x, ball.y, layout.hole.x, layout.hole.y) < 14
      && Math.hypot(ball.vx, ball.vy) < 300;
    if (rollingIn) { ball.vx = 0; ball.vy = 0; }
    if (!rollingIn) return null;
  }

  // Ball at rest: check for a holed putt.
  if (dist(ball.x, ball.y, layout.hole.x, layout.hole.y) < 14) {
    act.totalStrokes += act.strokes;
    act.strokes = 0;
    if (act.hole >= 2) {
      act.done = true;
      const over = Math.max(0, act.totalStrokes - 9);
      const reward = Math.max(0, 300 - 25 * over);
      award(state, reward);
      showMsg(state, t('act.golf.done', { strokes: act.totalStrokes, reward }));
      return 'done';
    }
    act.hole += 1;
    act.started = false;
    showMsg(state, t('act.golf.hole', { hole: act.hole + 1 }));
    return null;
  }

  if (mouseClicked(input)) {
    const m = mouseWorld(input);
    if (m) {
      const d = dist(ball.x, ball.y, m.x, m.y);
      if (d > 4) {
        const power = clamp(d / 400, 0.15, 1);
        const sp = power * 750;
        ball.vx = ((m.x - ball.x) / d) * sp;
        ball.vy = ((m.y - ball.y) / d) * sp;
        act.strokes += 1;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Darts
// ---------------------------------------------------------------------------

function dartsBoard(view) {
  const r = Math.min(view.w, view.h) * 0.26;
  return { x: view.x + view.w / 2, y: view.y + view.h / 2 - 10, r };
}

function dartsAim(board, elapsed) {
  return {
    x: board.x + Math.sin(elapsed * 1.7) * board.r * 0.8,
    y: board.y + Math.sin(elapsed * 2.3 + 1) * board.r * 0.8,
  };
}

function dartsScore(board, x, y) {
  const d = dist(x, y, board.x, board.y);
  if (d <= board.r * 0.18) return 100; // bullseye
  if (d <= board.r * 0.65) return 50; // inner ring
  if (d <= board.r) return 25; // outer ring
  return 0; // miss
}

function updateDarts(state, act, dt, input) {
  const view = lastView || FALLBACK_VIEW;
  const board = dartsBoard(view);
  act.elapsed += dt;
  if (act.thrown >= 3) return null; // finish handled below after the 3rd throw
  if (mouseClicked(input)) {
    const aim = dartsAim(board, act.elapsed);
    const pts = dartsScore(board, aim.x, aim.y);
    act.darts.push({ x: aim.x, y: aim.y, points: pts });
    act.points += pts;
    act.thrown += 1;
    if (act.thrown >= 3) {
      act.done = true;
      const reward = Math.min(200, act.points * 2);
      award(state, reward);
      showMsg(state, t('act.darts.done', { points: act.points, reward }));
      return 'done';
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Gym
// ---------------------------------------------------------------------------

function updateGym(state, act, dt, input) {
  act.elapsed += dt;
  act.timeLeft -= dt;
  if (pressed(input, 'Space') || mouseClicked(input)) act.reps += 1;
  if (act.timeLeft <= 0) {
    act.done = true;
    const reward = Math.min(150, Math.max(0, act.reps - 20) * 5);
    award(state, reward);
    showMsg(state, t('act.gym.done', { reps: act.reps, reward }));
    return 'done';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fishing (v4, screen-based, Pier 9)
// ---------------------------------------------------------------------------

function fishLayout(view) {
  const waterY = view.y + view.h * 0.42;
  const cx = view.x + view.w / 2;
  const range = Math.min(view.w * 0.36, 430);
  return { waterY, cx, range, fishY: view.y + view.h * 0.68 };
}

function fishPositions(act, view) {
  const L = fishLayout(view);
  const speed = 1.1 + act.casts * 0.45;
  const fishX = L.cx + Math.sin(act.elapsed * speed) * L.range;
  const zoneX = L.cx + Math.sin(act.elapsed * 0.45 + 1) * L.range * 0.55;
  return { ...L, fishX, zoneX, zoneW: 120 };
}

function updateFish(state, act, dt, input) {
  act.elapsed += dt;
  if (act.phase === 'result') {
    act.resultTimer -= dt;
    if (act.resultTimer <= 0) {
      if (act.casts >= 3) {
        act.done = true;
        showMsg(state, t('act.fish.done', { caught: act.caught, earned: act.earned }));
        return 'done';
      }
      act.phase = 'swim';
      act.elapsed = 0;
    }
    return null;
  }
  if (mouseClicked(input)) {
    const view = lastView || FALLBACK_VIEW;
    const pos = fishPositions(act, view);
    act.casts += 1;
    if (Math.abs(pos.fishX - pos.zoneX) < pos.zoneW / 2) {
      act.value = 40 + (act.casts - 1) * 20;
      act.caught += 1;
      act.earned += act.value;
      award(state, act.value);
      act.result = t('act.fish.caught', { value: act.value });
      playSfx('coin');
    } else {
      act.value = 0;
      act.result = t('act.fish.missed');
      playSfx('splash');
    }
    act.phase = 'result';
    act.resultTimer = 1.4;
  }
  return null;
}

function drawFish(ctx, state, view) {
  const act = state.activity;
  const pos = fishPositions(act, view);
  ctx.save();
  // Sky + pier + sea.
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(view.x, view.y + view.h * 0.2, view.w, 26);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(view.x, view.y + view.h * 0.2 + 26, view.w, 14);
  const sea = ctx.createLinearGradient(0, pos.waterY, 0, view.y + view.h);
  sea.addColorStop(0, '#0e7490');
  sea.addColorStop(1, '#082f49');
  ctx.fillStyle = sea;
  ctx.fillRect(view.x, pos.waterY, view.w, view.y + view.h - pos.waterY);
  // Strike zone: a gold band on the water.
  ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
  ctx.fillRect(pos.zoneX - pos.zoneW / 2, pos.waterY, pos.zoneW, view.y + view.h - pos.waterY);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.strokeRect(pos.zoneX - pos.zoneW / 2, pos.waterY, pos.zoneW, view.y + view.h - pos.waterY);
  // The fish: a shadow under the water, darker when it is in the zone.
  const inZone = Math.abs(pos.fishX - pos.zoneX) < pos.zoneW / 2;
  ctx.fillStyle = inZone ? '#facc15' : '#164e63';
  ctx.beginPath();
  ctx.ellipse(pos.fishX, pos.fishY, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pos.fishX - 24, pos.fishY);
  ctx.lineTo(pos.fishX - 38, pos.fishY - 10);
  ctx.lineTo(pos.fishX - 38, pos.fishY + 10);
  ctx.closePath();
  ctx.fill();
  // Fishing line from the rod tip down to the zone.
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(view.x + view.w / 2, view.y + view.h * 0.2 + 26);
  ctx.lineTo(pos.zoneX, pos.waterY + 30);
  ctx.stroke();
  // Bobber.
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(pos.zoneX, pos.waterY + 30, 7, 0, Math.PI * 2);
  ctx.fill();
  if (act.phase === 'result') {
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(act.result, view.x + view.w / 2, view.y + view.h * 0.32);
  } else if (inZone) {
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('act.fish.now'), view.x + view.w / 2, view.y + view.h * 0.32);
  }
  ctx.restore();
  drawHud(ctx, view, t('act.fish.title'),
    t('act.fish.stats', { cast: Math.min(act.casts + 1, 3), caught: act.caught, earned: act.earned }));
}

// ---------------------------------------------------------------------------
// Screen-based update / draw
// ---------------------------------------------------------------------------

/**
 * Advance the current screen-based minigame one frame.
 * Returns 'done' when the minigame finished (caller restores screen to
 * 'play'), or null while it is still running. Escape quits with no reward.
 */
export function updateActivity(state, dt, input) {
  try {
    if (!state || !state.activity) return null;
    const act = state.activity;
    if (act.done) return 'done';
    if (input) lastInput = input;
    if (pressed(input, 'Escape')) {
      act.done = true;
      showMsg(state, t('act.quit'));
      return 'done';
    }
    const step = Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
    if (act.kind === 'pool') return updatePool(state, act, step, input);
    if (act.kind === 'golf') return updateGolf(state, act, step, input);
    if (act.kind === 'darts') return updateDarts(state, act, step, input);
    if (act.kind === 'gym') return updateGym(state, act, step, input);
    if (act.kind === 'fish') return updateFish(state, act, step, input);
    return null;
  } catch {
    return null;
  }
}

function drawHud(ctx, view, title, stats) {
  ctx.save();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.fillRect(view.x, view.y, view.w, 46);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, view.x + 16, view.y + 23);
  ctx.textAlign = 'right';
  ctx.font = '16px sans-serif';
  ctx.fillText(stats, view.x + view.w - 16, view.y + 23);
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(t('act.esc'), view.x + view.w / 2, view.y + view.h - 18);
  ctx.restore();
}

function drawPool(ctx, state, view) {
  const act = state.activity;
  const table = act.table || poolTable(view);
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Table: wooden rim + green felt.
  ctx.fillStyle = '#7c2d12';
  ctx.fillRect(table.x - 18, table.y - 18, table.w + 36, table.h + 36);
  ctx.fillStyle = '#15803d';
  ctx.fillRect(table.x, table.y, table.w, table.h);
  // Pockets.
  ctx.fillStyle = '#020617';
  for (const p of poolPockets(table)) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  // Balls.
  if (act.balls) {
    const cue = act.balls[0];
    for (const b of act.balls) {
      if (b.pocketed) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, POOL_BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Aim line from the cue ball toward the mouse while the balls are still
    // (drawn by drawPoolAim, which uses the last input seen by updateActivity).
    void cue;
  }
  ctx.restore();
  drawHud(ctx, view, t('act.pool.title'), t('act.pool.stats', { pocketed: act.pocketed, shots: act.shots }));
}

function drawPoolAim(ctx, state, view, input) {
  // Drawn separately so it can use the live mouse position.
  const act = state && state.activity;
  if (!act || act.kind !== 'pool' || !act.balls || poolBallsMoving(act) || act.shots <= 0) return;
  const m = mouseWorld(input);
  if (!m) return;
  const cue = act.balls[0];
  if (cue.pocketed) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(cue.x, cue.y);
  const d = Math.max(1, dist(cue.x, cue.y, m.x, m.y));
  ctx.lineTo(cue.x + ((m.x - cue.x) / d) * 130, cue.y + ((m.y - cue.y) / d) * 130);
  ctx.stroke();
  ctx.restore();
}

function drawGolf(ctx, state, view) {
  const act = state.activity;
  const course = act.course || golfCourse(view);
  const layout = act.layout || golfHoleLayout(act, course);
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Green.
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(course.x, course.y, course.w, course.h);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(course.x + 10, course.y + 10, course.w - 20, course.h - 20);
  // Hazards.
  for (const hz of layout.hazards) {
    ctx.fillStyle = hz.kind === 'water' ? '#0ea5e9' : '#eab308';
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(hz.kind === 'water' ? t('act.golf.water') : t('act.golf.sand'), hz.x, hz.y);
  }
  // Hole + flag.
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(layout.hole.x, layout.hole.y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(layout.hole.x, layout.hole.y);
  ctx.lineTo(layout.hole.x, layout.hole.y - 42);
  ctx.stroke();
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(layout.hole.x, layout.hole.y - 42);
  ctx.lineTo(layout.hole.x + 22, layout.hole.y - 34);
  ctx.lineTo(layout.hole.x, layout.hole.y - 26);
  ctx.closePath();
  ctx.fill();
  // Tee marker.
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(layout.tee.x, layout.tee.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  // Ball.
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(act.ball.x, act.ball.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawHud(ctx, view, t('act.golf.title', { hole: act.hole + 1 }),
    t('act.golf.stats', { strokes: act.strokes, total: act.totalStrokes }));
}

function drawDarts(ctx, state, view) {
  const act = state.activity;
  const board = dartsBoard(view);
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Board rings: outer 25, inner 50, bullseye 100.
  const rings = [
    { r: board.r, color: '#f5e6c8' },
    { r: board.r * 0.65, color: '#c0392b' },
    { r: board.r * 0.18, color: '#14532d' },
  ];
  for (const ring of rings) {
    ctx.fillStyle = ring.color;
    ctx.beginPath();
    ctx.arc(board.x, board.y, ring.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.arc(board.x, board.y, board.r * 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('100', board.x, board.y - board.r * 0.3);
  ctx.fillText('50', board.x, board.y + board.r * 0.45);
  ctx.fillText('25', board.x, board.y - board.r * 0.82);
  // Thrown darts.
  for (const d of act.darts) {
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(String(d.points), d.x, d.y - 14);
  }
  // Oscillating aim marker.
  const aim = dartsAim(board, act.elapsed || 0);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(aim.x, aim.y, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(aim.x - 20, aim.y);
  ctx.lineTo(aim.x + 20, aim.y);
  ctx.moveTo(aim.x, aim.y - 20);
  ctx.lineTo(aim.x, aim.y + 20);
  ctx.stroke();
  ctx.restore();
  drawHud(ctx, view, t('act.darts.title'), t('act.darts.stats', { thrown: act.thrown, points: act.points }));
}

function drawGym(ctx, state, view) {
  const act = state.activity;
  const room = {
    x: view.x + view.w * 0.2, y: view.y + view.h * 0.22,
    w: view.w * 0.6, h: view.h * 0.5,
  };
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(view.x, view.y, view.w, view.h);
  // Gym room: wall, floor, bench, barbell.
  ctx.fillStyle = '#334155';
  ctx.fillRect(room.x, room.y, room.w, room.h * 0.62);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(room.x, room.y + room.h * 0.62, room.w, room.h * 0.38);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(room.x + room.w * 0.3, room.y + room.h * 0.55, room.w * 0.4, room.h * 0.14);
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(room.x + room.w * 0.12, room.y + room.h * 0.42, room.w * 0.76, 10);
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.arc(room.x + room.w * 0.12, room.y + room.h * 0.42 + 5, 22, 0, Math.PI * 2);
  ctx.arc(room.x + room.w * 0.88, room.y + room.h * 0.42 + 5, 22, 0, Math.PI * 2);
  ctx.fill();
  // Rep counter + progress bar.
  const cx = view.x + view.w / 2;
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${act.reps} reps`, cx, view.y + view.h * 0.14);
  ctx.font = '20px sans-serif';
  ctx.fillStyle = '#facc15';
  ctx.fillText(`${Math.max(0, act.timeLeft).toFixed(1)}s left — press SPACE or click!`, cx, view.y + view.h * 0.2 - 8);
  const barW = Math.min(view.w * 0.6, 560);
  const barX = cx - barW / 2;
  const barY = room.y + room.h + 26;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(barX, barY, barW, 22);
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(barX, barY, barW * clamp(act.reps / 40, 0, 1), 22);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, 22);
  ctx.restore();
  drawHud(ctx, view, t('act.gym.title'),
    t('act.gym.stats', { reps: act.reps }));
}

/**
 * Draw the current screen-based minigame on the 2D #mini overlay canvas.
 * v2 form: drawActivity(state, view). The old 3-arg form
 * drawActivity(ctx, state, view) still works (v1 renderer).
 * @param {object} state - game state (state.activity selects the game)
 * @param {{ x: number, y: number, w: number, h: number }} view - visible rect in CSS px
 */
export function drawActivity(a, b, c) {
  try {
    // v1 3-arg form: the first argument is a 2D context.
    if (a && typeof a.fillRect === 'function') {
      drawActivityOnCtx(a, b, c);
      return;
    }
    const state = a;
    const view = b;
    if (!state || !state.activity || !view) return;
    const canvas = getMiniCanvas();
    if (!canvas) return;
    const w = Math.max(1, Math.round(view.w));
    const h = Math.max(1, Math.round(view.h));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawActivityOnCtx(ctx, state, { x: 0, y: 0, w: view.w, h: view.h });
  } catch {
    // Drawing must never break the game loop.
  }
}

function drawActivityOnCtx(ctx, state, view) {
  try {
    if (!ctx || !state || !state.activity || !view) return;
    lastView = { x: view.x, y: view.y, w: view.w, h: view.h };
    const act = state.activity;
    if (act.kind === 'pool') {
      drawPool(ctx, state, view);
      drawPoolAim(ctx, state, view, lastInput);
    } else if (act.kind === 'golf') drawGolf(ctx, state, view);
    else if (act.kind === 'darts') drawDarts(ctx, state, view);
    else if (act.kind === 'gym') drawGym(ctx, state, view);
    else if (act.kind === 'fish') drawFish(ctx, state, view);
  } catch {
    // Drawing must never break the game loop.
  }
}

// ---------------------------------------------------------------------------
// Race (world-based)
// ---------------------------------------------------------------------------

/**
 * Start the airport/downtown checkpoint race. Requires a vehicle.
 * Returns false (with a message) when the player is on foot.
 */
export function startRaceChallenge(state) {
  if (!state) return false;
  if (!state.playerVehicle) {
    showMsg(state, t('act.race.needVehicle'));
    return false;
  }
  state.race = {
    checkpoints: RACE_CHECKPOINTS.map((p) => ({ x: p.x, y: p.y })),
    index: 0,
    time: 0,
    best: state.race && Number.isFinite(state.race.best) ? state.race.best : null,
  };
  showMsg(state, t('act.race.started'));
  return true;
}

/**
 * Advance the race timer; when the player's vehicle (or character on foot)
 * comes within 90px of the current checkpoint, advance to the next one.
 * Finishing all 5 pays $400 minus $2 per second over 120s (minimum $100).
 */
export function updateRaceChallenge(state, dt) {
  try {
    if (!state || !state.race) return;
    const race = state.race;
    if (!Array.isArray(race.checkpoints) || race.checkpoints.length === 0) {
      state.race = null;
      return;
    }
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    race.time = (race.time || 0) + step;

    const pos = state.playerVehicle || state.hero;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return;

    const target = race.checkpoints[race.index || 0];
    if (!target) return;
    if (dist(pos.x, pos.y, target.x, target.y) < CHECKPOINT_RADIUS) {
      race.index = (race.index || 0) + 1;
      if (race.index >= race.checkpoints.length) {
        const over = Math.max(0, race.time - 120);
        const reward = Math.max(100, 400 - 2 * over);
        award(state, reward);
        if (state.stats) state.stats.racesWon = (state.stats.racesWon || 0) + 1;
        showMsg(state, t('act.race.done', { time: race.time.toFixed(1), reward }));
        state.race = null;
      } else {
        showMsg(state, t('act.race.checkpoint', { index: race.index, total: race.checkpoints.length }));
      }
    }
  } catch {
    // Never break the main loop.
  }
}

// ---------------------------------------------------------------------------
// Swim (world-based)
// ---------------------------------------------------------------------------

/**
 * Start the buoy-collecting swim challenge: 6 buoys in the eastern water,
 * 60 seconds on the clock. Each buoy pays $40; collecting all 6 adds $100.
 */
export function startSwimChallenge(state) {
  if (!state) return false;
  state.swimChallenge = {
    buoys: SWIM_BUOYS.map((p) => ({ x: p.x, y: p.y, taken: false })),
    collected: 0,
    time: 60,
  };
  showMsg(state, t('act.swim.started'));
  return true;
}

/**
 * Count the swim timer down; collecting a buoy (within 40px) pays $40.
 * Finishes when time runs out or all 6 buoys are collected (+$100 bonus).
 */
export function updateSwimChallenge(state, dt) {
  try {
    if (!state || !state.swimChallenge) return;
    const ch = state.swimChallenge;
    const step = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    ch.time = (ch.time || 0) - step;

    const hero = state.hero;
    if (hero && Number.isFinite(hero.x) && Number.isFinite(hero.y) && Array.isArray(ch.buoys)) {
      for (const buoy of ch.buoys) {
        if (!buoy.taken && dist(hero.x, hero.y, buoy.x, buoy.y) < BUOY_RADIUS) {
          buoy.taken = true;
          ch.collected = (ch.collected || 0) + 1;
          award(state, 40);
          showMsg(state, t('act.swim.buoy', { collected: ch.collected }));
        }
      }
    }

    if (ch.time <= 0 || (ch.collected || 0) >= 6) {
      let bonus = 0;
      if ((ch.collected || 0) >= 6) {
        bonus = 100;
        award(state, bonus);
      }
      showMsg(state, bonus ? t('act.swim.doneBonus', { collected: ch.collected || 0 }) : t('act.swim.done', { collected: ch.collected || 0 }));
      state.swimChallenge = null;
    }
  } catch {
    // Never break the main loop.
  }
}
