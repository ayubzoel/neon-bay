// Neon Bay — the five-star wanted system. At 1 star patrol cars chase you;
// 2 adds bikes, 3 adds more of both, 4 adds a helicopter, 5 adds a tank.
// Every unit shoots, and the tank fires shells that explode.
import { WANTED, WANTED_SIGHT_RANGE } from './config.js';
import { activeCharacter, addWanted } from './state.js';
import { playSfx3D } from './audio.js';
import { glassMat, hubcapMat, stdMat, tyreMat } from './textures.js';

// Siren throttle: at most one wail every 2.5 s, from the nearest unit.
let sirenCd = 0;

function spawnPoint(state, world) {
  const hero = activeCharacter(state);
  for (let tries = 0; tries < 12; tries += 1) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 620 + Math.random() * 260;
    const x = hero.x + Math.cos(angle) * dist;
    const y = hero.y + Math.sin(angle) * dist;
    if (x < 40 || y < 40 || x > 9560 || y > 5360) continue;
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
  return { kind, x, y, angle: 0, speed: 0, hp: stats.hp, maxHp: stats.hp, shootCd: 1 + Math.random(), ramCd: 0, path: null, pathIdx: 0, repathCd: 0 };
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
      // Ground units chase along the road graph (v3): re-path to the
      // player's nearest intersection every ~1.2 s, follow the waypoints,
      // and only fall back to a straight line when no road route exists
      // (e.g. the player is off-road in a park). Tanks take the same route,
      // just slower. Helicopters still fly straight.
      p.repathCd -= dt;
      if (p.repathCd <= 0 || !p.path) {
        p.repathCd = 1.2;
        const nodePath = world.graph.findPath(p.x, p.y, targetX, targetY, state.unlocked);
        if (nodePath && nodePath.length > 1) {
          p.path = [...nodePath.slice(1), { x: targetX, y: targetY }];
          p.pathIdx = 0;
        } else {
          p.path = null;
        }
      }
      let wx = targetX;
      let wy = targetY;
      if (p.path && p.pathIdx < p.path.length) {
        wx = p.path[p.pathIdx].x;
        wy = p.path[p.pathIdx].y;
        if (Math.hypot(wx - p.x, wy - p.y) < 46) {
          p.pathIdx += 1;
          if (p.pathIdx < p.path.length) {
            wx = p.path[p.pathIdx].x;
            wy = p.path[p.pathIdx].y;
          }
        }
      }
      steerToward(p, wx, wy, dt, 0.9);
      p.speed = Math.min(120, p.speed + 60 * dt);
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      if (!world.collides(nx, ny, 22, state.unlocked)) {
        p.x = nx;
        p.y = ny;
      }
      policeShoot(state, p, targetX, targetY);
    } else {
      p.repathCd -= dt;
      if (p.repathCd <= 0 || !p.path) {
        p.repathCd = 1.2;
        const nodePath = world.graph.findPath(p.x, p.y, targetX, targetY, state.unlocked);
        if (nodePath && nodePath.length > 1) {
          p.path = [...nodePath.slice(1), { x: targetX, y: targetY }];
          p.pathIdx = 0;
        } else {
          p.path = null;
        }
      }
      let wx = targetX;
      let wy = targetY;
      if (p.path && p.pathIdx < p.path.length) {
        wx = p.path[p.pathIdx].x;
        wy = p.path[p.pathIdx].y;
        if (Math.hypot(wx - p.x, wy - p.y) < 40) {
          p.pathIdx += 1;
          if (p.pathIdx < p.path.length) {
            wx = p.path[p.pathIdx].x;
            wy = p.path[p.pathIdx].y;
          }
        }
      }
      const top = p.kind === 'bike' ? 390 : 330;
      steerToward(p, wx, wy, dt, 2.6);
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
  // Positional siren: the nearest unit wails when it is close enough to hear.
  sirenCd -= dt;
  if (sirenCd <= 0 && state.police.length > 0) {
    let nearest = null;
    let nearestD = Infinity;
    for (const p of state.police) {
      const d = Math.hypot(p.x - hero.x, p.y - hero.y);
      if (d < nearestD) {
        nearestD = d;
        nearest = p;
      }
    }
    if (nearest && nearestD < 900) {
      playSfx3D('siren', nearest.x, nearest.y, hero.x, hero.y);
      sirenCd = 2.5;
    }
  }
  return anyCanSee;
}

/** A crime the police saw: raise the wanted level. */
export function commitCrime(state, stars, reason) {
  addWanted(state, stars, reason);
}

// --- v2 3D drawing -------------------------------------------------------
// First argument is the mesh pool; a canvas context falls back to the v1 2D
// drawing so the game stays playable until the 3D renderer lands.
function isPool(arg) {
  return !!arg && typeof arg.get === 'function';
}

function three() {
  return (typeof globalThis !== 'undefined' && globalThis.THREE) || null;
}

function dummyObj() {
  return {
    position: { set() {} },
    rotation: {},
    scale: { set() {} },
    visible: true,
    material: { color: { set() {} }, transparent: false, opacity: 1 },
    userData: {},
  };
}

function box3(T, w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    material,
  );
  m.position.set(x, y, z);
  return m;
}

function paintMat(T, color) {
  return stdMat(`police-paint-${color.toString(16)}`, () => new T.MeshStandardMaterial({
    color, roughness: 0.35, metalness: 0.55,
  }));
}

/** Build one police unit as a detailed 3D group, facing +X. */
function buildPoliceUnit(T, kind) {
  if (!T) return dummyObj();
  const g = new T.Group();
  const dark = stdMat('police-dark', () => new T.MeshStandardMaterial({ color: 0x111827, roughness: 0.8, metalness: 0.2 }));
  const white = stdMat('police-white', () => new T.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6, metalness: 0 }));
  if (kind === 'heli') {
    g.add(box3(T, 40, 12, 16, paintMat(T, 0x1e3a5f), 0, 0, 0));
    g.add(box3(T, 26, 6, 6, paintMat(T, 0x1e3a5f), -30, 2, 0));
    g.add(box3(T, 10, 8, 12, glassMat(), 16, 0, 0));
    const rotor = box3(T, 72, 1.5, 4, stdMat('police-rotor', () => new T.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.6 })), 0, 10, 0);
    const tail = box3(T, 4, 1.5, 40, stdMat('police-rotor', () => new T.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.6 })), 0, 10, 0);
    const rotorGroup = new T.Group();
    rotorGroup.position.set(0, 10, 0);
    rotor.position.set(0, 0, 0);
    tail.position.set(0, 0, 0);
    rotorGroup.add(rotor);
    rotorGroup.add(tail);
    g.add(rotorGroup);
    // Landing skids.
    g.add(box3(T, 30, 2, 3, dark, 0, -10, -8));
    g.add(box3(T, 30, 2, 3, dark, 0, -10, 8));
    g.userData = { rotor: rotorGroup };
  } else if (kind === 'tank') {
    g.add(box3(T, 48, 12, 32, paintMat(T, 0x3f6212), 0, 6, 0));
    g.add(box3(T, 20, 8, 20, paintMat(T, 0x65a30d), 0, 16, 0));
    g.add(box3(T, 32, 4, 4, dark, 24, 16, 0));
    g.add(box3(T, 52, 4, 6, dark, 0, 2, -16));
    g.add(box3(T, 52, 4, 6, dark, 0, 2, 16));
    // Antenna + muzzle brake on the barrel.
    const antenna = new T.Mesh(new T.CylinderGeometry(0.8, 0.8, 22, 5), dark);
    antenna.position.set(-8, 30, -8);
    g.add(antenna);
    g.add(box3(T, 6, 6, 6, dark, 40, 16, 0));
  } else if (kind === 'bike') {
    g.add(box3(T, 34, 8, 10, paintMat(T, 0x1e40af), 0, 6, 0));
    g.add(box3(T, 10, 10, 8, white, 4, 12, 0));
    g.add(box3(T, 8, 8, 8, dark, -12, 5, 0));
    for (const wx of [13, -13]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(7, 7, 3, 10), tyreMat());
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 7, 0);
      g.add(wheel);
    }
    g.add(box3(T, 2, 3, 6, stdMat('police-beacon', () => new T.MeshStandardMaterial({
      color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8, roughness: 0.4, metalness: 0,
    })), 4, 20, 0));
  } else {
    // Patrol car: black body, white doors, chrome bumpers, wheels with
    // hubcaps, and a red/blue light bar that flashes (drawPolice drives it).
    g.add(box3(T, 46, 10, 22, paintMat(T, 0x111827), 0, 5, 0));
    g.add(box3(T, 24, 8, 20, white, -2, 13, 0));
    g.add(box3(T, 24, 1.5, 21, stdMat('police-chrome', () => new T.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.25, metalness: 0.9 })), -2, 9.5, 0));
    for (const [wx, wz] of [[15, 11], [15, -11], [-15, 11], [-15, -11]]) {
      const wheel = new T.Mesh(new T.CylinderGeometry(5.5, 5.5, 4, 10), tyreMat());
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 5.5, wz);
      g.add(wheel);
      const cap = new T.Mesh(new T.CylinderGeometry(3, 3, 0.8, 8), hubcapMat());
      cap.rotation.x = Math.PI / 2;
      cap.position.set(wx, 5.5, wz + (wz > 0 ? 2.2 : -2.2));
      g.add(cap);
    }
    const redMat = stdMat('police-light-red', () => new T.MeshStandardMaterial({
      color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0,
    }));
    const blueMat = stdMat('police-light-blue', () => new T.MeshStandardMaterial({
      color: 0x1e3a8a, emissive: 0x3b82f6, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0,
    }));
    g.add(box3(T, 10, 4, 10, redMat, -2, 19, -5));
    g.add(box3(T, 10, 4, 10, blueMat, -2, 19, 5));
    g.userData = { lightRed: redMat, lightBlue: blueMat };
  }
  return g;
}

export function drawPolice(pool, state, time) {
  if (!isPool(pool)) {
    for (const p of state.police) drawUnit(pool, p, time);
    return;
  }
  const T = three();
  state.police.forEach((p, i) => {
    const mesh = pool.get(`police-${i}-${p.kind}`, () => buildPoliceUnit(T, p.kind));
    // Helicopters fly above the street; everything else sits on the ground.
    mesh.position.set(p.x, p.kind === 'heli' ? 70 : 0, p.y);
    mesh.rotation.y = -p.angle;
    mesh.visible = true;
    const rotor = mesh.userData && mesh.userData.rotor;
    if (rotor) rotor.rotation.y = time * 20;
    // Patrol-car light bar: red and blue alternate, ~3 flashes a second.
    const ud = mesh.userData || {};
    if (ud.lightRed && ud.lightBlue) {
      const redOn = Math.sin(time * 9) > 0;
      ud.lightRed.emissiveIntensity = redOn ? 2.6 : 0.25;
      ud.lightBlue.emissiveIntensity = redOn ? 0.25 : 2.6;
    }
  });
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
