// Neon Bay — drawing only: the city, the beach, the peaks, every entity,
// the HUD with its minimap, and the map overlay. Flat canvas shapes, no assets.
import { AIRPORT, DISTRICT_RECTS, SAFE_HOUSE, WATER_RECTS, WORLD_HEIGHT, WORLD_WIDTH } from './config.js';
import { clockText, isNight } from './state.js';
import { drawCharacter } from './player.js';
import { drawVehicles } from './vehicles.js';
import { drawNpcs } from './npc.js';
import { drawPolice } from './police.js';
import { drawBullets } from './combat.js';
import { drawMissionMarkers } from './missions.js';
import { drawWeatherOverlay } from './weather.js';
import { drawActivity } from './activities.js';
import { WEAPONS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_ACTIVITY = 'activity';

const GROUND = ['#3a3f4a', '#d9b96a', '#6b7a72'];
const ROAD_COLOR = '#23272f';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, w: 0, h: 0, dpr: 1 };
  const fonts = new Map();

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    view.dpr = dpr;
    view.w = window.innerWidth;
    view.h = window.innerHeight;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    view.scale = Math.max(0.55, Math.min(view.w / 1150, view.h / 720));
  }

  function text(value, x, y, size, color, align = 'left', bold = false) {
    const key = `${size}-${bold}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  }

  /** Shorten a string with an ellipsis so it fits inside maxWidth px. */
  function fitText(value, size, maxWidth, bold = false) {
    const key = `${size}-${bold}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? 'bold ' : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    if (ctx.measureText(value).width <= maxWidth) return value;
    let s = value;
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
    return `${s}…`;
  }

  function drawGround(state, world, camX, camY, time) {
    // District ground.
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      const r = DISTRICT_RECTS[i];
      ctx.fillStyle = GROUND[i];
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    // Water, animated.
    ctx.fillStyle = '#0e7490';
    for (const w of WATER_RECTS) {
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i += 1) {
        const wy = w.y + ((i * 173 + time * 24) % w.h);
        ctx.beginPath();
        ctx.moveTo(w.x + 20, wy);
        ctx.lineTo(w.x + w.w - 20, wy);
        ctx.stroke();
      }
    }
    // Roads.
    ctx.fillStyle = ROAD_COLOR;
    for (const r of world.roads) ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(253,224,71,0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 22]);
    for (const r of world.roads) {
      ctx.beginPath();
      if (r.vertical) {
        ctx.moveTo(r.x + r.w / 2, r.y);
        ctx.lineTo(r.x + r.w / 2, r.y + r.h);
      } else {
        ctx.moveTo(r.x, r.y + r.h / 2);
        ctx.lineTo(r.x + r.w, r.y + r.h / 2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Airport runway.
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(AIRPORT.runway.x, AIRPORT.runway.y, AIRPORT.runway.w, AIRPORT.runway.h);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEON BAY INTL', AIRPORT.runway.x + AIRPORT.runway.w / 2, AIRPORT.runway.y + 55);
    ctx.strokeStyle = 'rgba(248,250,252,0.6)';
    ctx.setLineDash([24, 18]);
    ctx.beginPath();
    ctx.moveTo(AIRPORT.runway.x + 10, AIRPORT.runway.y + 45);
    ctx.lineTo(AIRPORT.runway.x + AIRPORT.runway.w - 10, AIRPORT.runway.y + 45);
    ctx.stroke();
    ctx.setLineDash([]);
    // Buildings.
    for (const b of world.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x, b.y, b.w, 8);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      }
    }
    // Trees.
    for (const t of world.trees) {
      ctx.fillStyle = t.kind === 'palm' ? '#15803d' : '#166534';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.kind === 'pine' ? 13 : 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.fillRect(t.x - 2, t.y + 6, 4, 8);
    }
    // Locked-district gates.
    for (const g of world.gates) {
      if (state.unlocked[g.district]) continue;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(g.x, g.y, g.w, g.h);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const cx = g.x + g.w / 2;
      const cy = g.y + g.h / 2;
      ctx.fillText('LOCKED', cx, g.w > g.h ? cy + 4 : cy - 10);
    }
    // Shops and activity spots.
    for (const shop of world.shops) {
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(shop.x, shop.y, shop.w, shop.h);
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(shop.name, shop.x + shop.w / 2, shop.y + shop.h / 2 + 4);
    }
    for (const spot of world.activitySpots) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, spot.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(spot.name, spot.x, spot.y + 4);
    }
    // Safe house.
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(SAFE_HOUSE.x, SAFE_HOUSE.y, SAFE_HOUSE.w, SAFE_HOUSE.h);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SAFE HOUSE', SAFE_HOUSE.x + SAFE_HOUSE.w / 2, SAFE_HOUSE.y + SAFE_HOUSE.h / 2 + 5);
  }

  function drawMinimap(state) {
    const mw = 190;
    const mh = 142;
    const x0 = view.w - mw - 14;
    const y0 = 14;
    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;
    ctx.save();
    ctx.fillStyle = 'rgba(10,14,22,0.85)';
    ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      const r = DISTRICT_RECTS[i];
      ctx.fillStyle = GROUND[i];
      ctx.fillRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
    }
    ctx.fillStyle = '#0e7490';
    for (const w of WATER_RECTS) ctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, w.w * sx, w.h * sy);
    const hero = state.characters[state.activeChar];
    const active = state.missions.active || state.missions.activeSide;
    if (active) {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(x0 + active.x * sx, y0 + active.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const p of state.police) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x0 + p.x * sx - 2, y0 + p.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawHud(state, time) {
    const hero = state.characters[state.activeChar];
    ctx.save();
    // Money and vitals, top-left.
    ctx.fillStyle = 'rgba(10,14,22,0.8)';
    ctx.fillRect(12, 12, 250, 86);
    text(`$${state.money.toLocaleString('en-US')}`, 24, 40, 26, '#4ade80', 'left', true);
    text(`${hero.name}  ·  ${state.weapon ? WEAPONS[state.weapon].name : ''}`, 24, 62, 14, '#e2e8f0');
    // HP red bar, armor grey bar.
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(24, 70, 200, 10);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(24, 70, 200 * Math.max(0, hero.hp / 100), 10);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(24, 84, 200, 7);
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(24, 84, 200 * Math.max(0, hero.armor / 100), 7);
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
    ctx.fillStyle = 'rgba(10,14,22,0.75)';
    const objW = Math.min(560, view.w - 28);
    ctx.fillRect(12, view.h - 58, objW, 46);
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
    ctx.restore();
    drawMinimap(state);
    void time;
  }

  function drawMapOverlay(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,8,16,0.9)';
    ctx.fillRect(0, 0, view.w, view.h);
    const mw = Math.min(view.w - 60, 900);
    const mh = mw * (WORLD_HEIGHT / WORLD_WIDTH);
    const x0 = (view.w - mw) / 2;
    const y0 = (view.h - mh) / 2;
    const sx = mw / WORLD_WIDTH;
    const sy = mh / WORLD_HEIGHT;
    for (let i = 0; i < DISTRICT_RECTS.length; i += 1) {
      const r = DISTRICT_RECTS[i];
      ctx.fillStyle = GROUND[i];
      ctx.fillRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
    }
    ctx.fillStyle = '#0e7490';
    for (const w of WATER_RECTS) ctx.fillRect(x0 + w.x * sx, y0 + w.y * sy, w.w * sx, w.h * sy);
    ctx.strokeStyle = '#475569';
    for (const r of state.world.roads) ctx.strokeRect(x0 + r.x * sx, y0 + r.y * sy, r.w * sx, r.h * sy);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEON BAY — Downtown', x0 + 1500 * sx, y0 + 2200 * sy);
    ctx.fillText('Sunset Beach', x0 + 3900 * sx, y0 + 2200 * sy);
    ctx.fillText('Cinder Peaks', x0 + 2400 * sx, y0 + 450 * sy);
    ctx.fillStyle = '#7c3aed';
    ctx.fillRect(x0 + SAFE_HOUSE.x * sx - 5, y0 + SAFE_HOUSE.y * sy - 5, 10, 10);
    const hero = state.characters[state.activeChar];
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(x0 + hero.x * sx, y0 + hero.y * sy, 8, 0, Math.PI * 2);
    ctx.fill();
    const active = state.missions.active || state.missions.activeSide;
    if (active) {
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x0 + active.x * sx, y0 + active.y * sy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    text('Map — press M to close', view.w / 2, y0 + mh + 30, 16, '#e2e8f0', 'center', true);
    ctx.restore();
  }

  function draw(state, world, screen, time) {
    state.world = world;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, view.w, view.h);
    const camX = Math.max(view.w / view.scale / 2, Math.min(WORLD_WIDTH - view.w / view.scale / 2, state.camera.x));
    const camY = Math.max(view.h / view.scale / 2, Math.min(WORLD_HEIGHT - view.h / view.scale / 2, state.camera.y));
    const vw = view.w / view.scale;
    const vh = view.h / view.scale;
    ctx.save();
    ctx.scale(view.scale, view.scale);
    ctx.translate(view.w / view.scale / 2 - camX, view.h / view.scale / 2 - camY);
    drawGround(state, world, camX, camY, time);
    drawMissionMarkers(ctx, state);
    for (const p of state.pickups) {
      if (p.taken) continue;
      ctx.fillStyle = p.kind === 'cash' ? '#4ade80' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'cash' ? '$' : '▣', p.x, p.y + 4);
    }
    drawVehicles(ctx, state, time);
    drawNpcs(ctx, state, time);
    drawPolice(ctx, state, time);
    const hero = state.characters[state.activeChar];
    const other = state.characters[1 - state.activeChar];
    if (!state.playerVehicle) drawCharacter(ctx, other, false, time);
    if (!state.playerVehicle) drawCharacter(ctx, hero, true, time);
    drawBullets(ctx, state);
    const viewRect = { x: camX - vw / 2, y: camY - vh / 2, w: vw, h: vh };
    drawWeatherOverlay(ctx, state, viewRect, 0.016);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_ACTIVITY) drawHud(state, time);
    if (state.showMap) drawMapOverlay(state);
    if (screen === SCREEN_ACTIVITY) {
      drawActivity(ctx, state, { x: 0, y: 0, w: view.w, h: view.h });
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
