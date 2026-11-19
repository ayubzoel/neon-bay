// Neon Bay — the five-star wanted system. At 1 star patrol cars chase you;
// 2 adds bikes, 3 adds more of both, 4 adds a helicopter, 5 adds a tank.
// Every unit shoots, and the tank fires shells that explode.
import { WANTED, WANTED_SIGHT_RANGE } from './config.js';
import { activeCharacter, addWanted } from './state.js';

function spawnPoint(state, world) {
  const hero = activeCharacter(state);
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 620 + Math.random() * 260;
    const x = hero.x + Math.cos(angle) * dist;
    const y = hero.y + Math.sin(angle) * dist;
    if (x < 40 || y < 40 || x > 4760 || y > 3560) continue;
    if (world.collides(x, y, 20, state.unlocked)) continue;
    return { x, y };
  }
  return { x: hero.x + 650, y: hero.y };
}

function makePolice(kind, x, y) {
  const stats = {
    car: { speed: 330, hp: 80 },
    bike: { speed: 390, hp: 45 },
    heli: { speed: 260, hp: 120 },
    tank: { speed: 120, hp: 400 },
  }[kind];
  return { kind, x, y, angle: 0, speed: 0, hp: stats.hp, maxHp: stats.hp, shootCd: 1 + Math.random(), ramCd: 0 };
}

function maintainForce(state, world) {
  const want = WANTED[state.wanted] || WANTED[0];
  const counts = { car: 0, bike: 0, heli: 0, tank: 0 };
  for (const p of state.police) counts[p.kind] += 1;
  for (const kind of ['car', 'bike', 'heli', 'tank']) {
    while (counts[kind] < want[kind === 'car' ? 'cars' : kind === 'bike' ? 'bikes' : kind === 'heli' ? 'helis' : 'tanks']) {
      const p = spawnPoint(state, world);
      state.police.push(makePolice(kind, p.x, p.y));
      counts[kind] += 1;
    }
  }
  if (state.wanted === 0) state.police.length = 0;
}

function policeShoot(state, p, targetX, targetY) {
  if (p.shootCd > 0) return;
  const dist = Math.hypot(targetX - p.x, targetY - p.y);
  if (dist > WANTED_SIGHT_RANGE) return;
  p.shootCd = p.kind === 'tank' ? 2.2 : p.kind === 'heli' ? 0.9 : 0.7;
  const spread = (Math.random() - 0.5) * 0.22;
  const angle = Math.atan2(targetY - p.y, targetX - p.x) + spread;
  const speed = p.kind === 'tank' ? 300 : 640;
  state.bullets.push({
    x: p.x, y: p.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    damage: p.kind === 'tank' ? 55 : p.kind === 'heli' ? 12 : 10,
    from: 'police', life: 1.6, blast: p.kind === 'tank' ? 70 : 0, kind: p.kind === 'tank' ? 'shell' : 'bullet',
  });
}

function steerToward(p, tx, ty, dt, turnRate) {
  const target = Math.atan2(ty - p.y, tx - p.x);
  let diff = target - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  p.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
}

export function updatePolice(state, world, dt) {
  maintainForce(state, world);
  const hero = activeCharacter(state);
  const targetX = hero.x;
  const targetY = hero.y;
  let anyCanSee = false;
  for (let i = state.police.length - 1; i >= 0; i -= 1) {
    const p = state.police[i];
    if (p.hp <= 0) {
      state.police.splice(i, 1);
      state.particles.push({ x: p.x, y: p.y, kind: 'explosion', life: 0.6, max: 0.6 });
      continue;
    }
    p.shootCd -= dt;
    p.ramCd -= dt;
    const dist = Math.hypot(targetX - p.x, targetY - p.y);
    if (dist < WANTED_SIGHT_RANGE) anyCanSee = true;
    if (dist > 1600) {
      const s = spawnPoint(state, world);
      p.x = s.x;
      p.y = s.y;
    }
    if (p.kind === 'heli') {
      steerToward(p, targetX, targetY, dt, 1.6);
      p.speed = Math.min(260, p.speed + 120 * dt);
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      policeShoot(state, p, targetX, targetY);
    } else if (p.kind === 'tank') {
      steerToward(p, targetX, targetY, dt, 0.9);
      p.speed = Math.min(120, p.speed + 60 * dt);
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!world.collides(nx, ny, 22, state.unlocked)) {
        p.x = nx;
        p.y = ny;
      }
      policeShoot(state, p, targetX, targetY);
    } else {
      const top = p.kind === 'bike' ? 390 : 330;
      steerToward(p, targetX, targetY, dt, 2.6);
      p.speed = Math.min(top, p.speed + 260 * dt);
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!world.collides(nx, p.y, 14, state.unlocked)) p.x = nx;
      else p.angle += Math.PI / 3;
      if (!world.collides(p.x, ny, 14, state.unlocked)) p.y = ny;
      else p.angle -= Math.PI / 3;
      policeShoot(state, p, targetX, targetY);
      if (dist < 30 && p.ramCd <= 0) {
        p.ramCd = 1;
        state.bullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, damage: 8, from: 'police', life: 0.01, blast: 0, kind: 'ram' });
      }
    }
  }
  state.policeCanSee = anyCanSee;
  return anyCanSee;
}

/** A crime the police saw: raise the wanted level. */
export function commitCrime(state, stars, reason) {
  addWanted(state, stars, reason);
}

function drawUnit(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  if (p.kind === 'heli') {
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    const rotor = time * 20;
    ctx.beginPath();
    ctx.moveTo(Math.cos(rotor) * 34, Math.sin(rotor) * 6);
    ctx.lineTo(-Math.cos(rotor) * 34, -Math.sin(rotor) * 6);
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(14, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'tank') {
    ctx.fillStyle = '#3f6212';
    ctx.beginPath();
    ctx.roundRect(-24, -16, 48, 32, 6);
    ctx.fill();
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a2e05';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(30, 0);
    ctx.stroke();
  } else if (p.kind === 'bike') {
    ctx.fillStyle = '#1e40af';
    ctx.beginPath();
    ctx.roundRect(-17, -6, 34, 12, 5);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(6, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.roundRect(-23, -11, 46, 22, 6);
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-14, -11, 28, 4);
    ctx.fillRect(-14, 7, 28, 4);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-20, -3, 6, 6);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-20, -3, 3, 6);
  }
  ctx.restore();
  // Health bar for damaged units.
  if (p.hp < p.maxHp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 18, p.y - 28, 36, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(p.x - 18, p.y - 28, 36 * (p.hp / p.maxHp), 5);
  }
}

export function drawPolice(ctx, state, time) {
  for (const p of state.police) drawUnit(ctx, p, time);
}
