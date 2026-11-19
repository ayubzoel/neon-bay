// Neon Bay — every vehicle: cars, bikes, boats and planes. All four drive:
// cars and bikes on roads, boats on the water, planes off the airport runway.
// Traffic cars cruise the roads on their own; any parked or NPC car can be stolen.
import { VEHICLE_STATS } from './config.js';
import { activeCharacter } from './state.js';
import { isWater } from './world.js';

const CAR_COLORS = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#e2e8f0', '#14b8a6', '#f97316'];
const CAR_NAMES = ['Comet', 'Stallion', 'Bison', 'Falcon', 'Dune', 'Marlin', 'Viper', 'Cruiser'];

let vehicleId = 1;

function makeVehicle(kind, x, y, angle, owner) {
  const stats = VEHICLE_STATS[kind];
  return {
    id: vehicleId++,
    kind, x, y, angle, speed: 0, z: 0, hp: stats.hp, maxHp: stats.hp,
    color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    name: CAR_NAMES[Math.floor(Math.random() * CAR_NAMES.length)],
    owner: owner || 'parked',
    modSpeed: 0, modArmor: 0,
    waypoint: null, waitTimer: 0,
  };
}

/** Parked cars, traffic, boats at the pier and two planes at the airport. */
export function spawnVehicles(state, world, rng) {
  const list = [];
  for (let i = 0; i < 14; i += 1) {
    const p = world.randomRoadPoint(0);
    list.push(makeVehicle(rng.chance(0.25) ? 'bike' : 'car', p.x, p.y, rng.range(0, Math.PI * 2), 'parked'));
  }
  for (let i = 0; i < 6; i += 1) {
    const p = world.randomRoadPoint(0);
    const v = makeVehicle('car', p.x, p.y, rng.range(0, Math.PI * 2), 'traffic');
    v.waypoint = world.randomRoadPoint(0);
    list.push(v);
  }
  for (let i = 0; i < 3; i += 1) {
    list.push(makeVehicle('boat', 4480 + rng.range(0, 200), rng.range(1200, 3200), rng.range(0, Math.PI * 2), 'parked'));
  }
  list.push(makeVehicle('plane', 2350, 2945, 0, 'parked'));
  list.push(makeVehicle('plane', 2500, 2945, 0, 'parked'));
  // The player's starter car, parked by the safe house.
  const starter = makeVehicle('car', 620, 1620, 0, 'player');
  starter.color = '#22d3ee';
  starter.name = 'Neon Comet';
  list.push(starter);
  state.vehicles = list;
}

export function nearestVehicle(state, maxDist) {
  const hero = activeCharacter(state);
  let best = null;
  let bestD = maxDist;
  for (const v of state.vehicles) {
    if (v.hp <= 0) continue;
    const d = Math.hypot(v.x - hero.x, v.y - hero.y);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

export function enterVehicle(state, vehicle) {
  state.playerVehicle = vehicle;
  vehicle.owner = 'player';
  // The player's bought mods apply to any car they drive.
  vehicle.modSpeed = state.mods.engine || 0;
  if (state.mods.paint) vehicle.color = '#d946ef';
  const hero = activeCharacter(state);
  hero.x = vehicle.x;
  hero.y = vehicle.y;
  return vehicle;
}

export function exitVehicle(state) {
  const v = state.playerVehicle;
  if (!v) return;
  const hero = activeCharacter(state);
  hero.x = v.x + Math.cos(v.angle + Math.PI / 2) * 34;
  hero.y = v.y + Math.sin(v.angle + Math.PI / 2) * 34;
  v.speed = 0;
  state.playerVehicle = null;
}

function driveVehicle(state, world, v, dt, input) {
  const stats = VEHICLE_STATS[v.kind];
  const maxSpeed = stats.maxSpeed + (v.modSpeed || 0);
  const forward = input.moveY() < 0 ? 1 : input.moveY() > 0 ? -0.55 : 0;
  const steer = input.moveX();
  if (v.kind === 'plane' && v.z > 0) {
    v.speed = Math.min(maxSpeed, v.speed + stats.accel * 0.6 * dt);
  } else if (forward !== 0) {
    v.speed += forward * stats.accel * dt;
    v.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, v.speed));
  } else {
    v.speed *= Math.max(0, 1 - dt * 1.4);
    if (Math.abs(v.speed) < 4) v.speed = 0;
  }
  if (Math.abs(v.speed) > 8) v.angle += steer * stats.turn * dt * Math.sign(v.speed) * Math.min(1, Math.abs(v.speed) / 120);
  const nx = v.x + Math.cos(v.angle) * v.speed * dt;
  const ny = v.y + Math.sin(v.angle) * v.speed * dt;
  const radius = v.kind === 'bike' ? 12 : v.kind === 'plane' ? 26 : 16;
  if (v.kind === 'boat') {
    if (isWater(nx, ny)) {
      v.x = nx;
      v.y = ny;
    } else {
      v.speed *= 0.5;
    }
  } else if (v.kind === 'plane' && v.z > 0) {
    v.x = nx;
    v.y = ny;
    v.z = Math.min(320, v.z + dt * 60);
    if (input.moveY() > 0) v.z = Math.max(0, v.z - dt * 90);
  } else {
    const onRunway = nx > 2200 && nx < 2760 && ny > 2880 && ny < 3010;
    if (!world.collides(nx, v.y, radius, state.unlocked)) v.x = nx;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
    }
    if (!world.collides(v.x, ny, radius, state.unlocked)) v.y = ny;
    else {
      v.speed *= -0.25;
      v.hp -= 4;
    }
    if (v.kind === 'plane' && onRunway && v.speed > stats.takeoffSpeed) v.z = 4;
  }
  if (v.hp <= 0 && state.playerVehicle === v) {
    exitVehicle(state);
  }
}

function updateTraffic(state, world, dt, rng) {
  for (const v of state.vehicles) {
    if (v.owner !== 'traffic' || v.hp <= 0) continue;
    if (!v.waypoint || Math.hypot(v.waypoint.x - v.x, v.waypoint.y - v.y) < 40) {
      v.waypoint = world.randomRoadPoint(0);
    }
    const target = Math.atan2(v.waypoint.y - v.y, v.waypoint.x - v.x);
    let diff = target - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const stats = VEHICLE_STATS[v.kind];
    v.speed = Math.min(150, v.speed + stats.accel * 0.4 * dt);
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (!world.collides(nx, ny, 14, state.unlocked)) {
      v.x = nx;
      v.y = ny;
    } else {
      v.waypoint = world.randomRoadPoint(0);
      v.angle += Math.PI / 2;
    }
    void rng;
  }
}

export function updateVehicles(state, world, dt, input, rng) {
  if (state.playerVehicle) {
    const v = state.playerVehicle;
    driveVehicle(state, world, v, dt, input);
    const hero = activeCharacter(state);
    hero.x = v.x;
    hero.y = v.y;
    hero.angle = v.angle;
    state.camera.x = v.x;
    state.camera.y = v.y;
  }
  updateTraffic(state, world, dt, rng);
}

function drawCarShape(ctx, v, time) {
  ctx.save();
  ctx.translate(v.x, v.y - (v.z || 0) * 0.4);
  ctx.rotate(v.angle);
  const w = v.kind === 'bike' ? 34 : v.kind === 'plane' ? 64 : 46;
  const h = v.kind === 'bike' ? 14 : v.kind === 'plane' ? 20 : 22;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
  ctx.fillStyle = v.color;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(15,23,42,0.85)';
  const cabinW = w * 0.42;
  ctx.beginPath();
  ctx.roundRect(-cabinW / 2, -h / 2 + 3, cabinW, h - 6, 4);
  ctx.fill();
  if (v.kind === 'plane') {
    ctx.fillStyle = v.color;
    ctx.fillRect(-6, -h / 2 - 16, 12, 8);
    ctx.fillRect(-6, h / 2 + 8, 12, 8);
    ctx.fillRect(w / 2 - 4, -3, 12, 6);
  }
  if (v.kind === 'boat') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-w / 2 + 6, -4, 12, 8);
  }
  if (time % 1 < 0.5 && v.hp < v.maxHp * 0.4) {
    ctx.fillStyle = '#6b7280';
    ctx.beginPath();
    ctx.arc(-w / 4, -h / 2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (v.z > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(v.x, v.y + 10, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawVehicle(ctx, v, time) {
  drawCarShape(ctx, v, time);
  if (v.owner === 'player') {
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(v.name, v.x, v.y - 26 - (v.z || 0) * 0.4);
  }
}

export function drawVehicles(ctx, state, time) {
  for (const v of state.vehicles) {
    if (state.playerVehicle === v) continue;
    drawVehicle(ctx, v, time);
  }
  if (state.playerVehicle) drawVehicle(ctx, state.playerVehicle, time);
}
