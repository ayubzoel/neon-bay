// Neon Bay — the screenshot scenes behind ?shot=start|play|chase|night.
// Each one stages a fixed, deterministic scene from the real game state
// (real rules, real entities, fixed positions), so the same seed always
// gives the same frame. main.js paints the staged scene twice and sets
// window.__shotReady for the screenshot.
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { startMainMission } from './missions.js';
import { setDestination } from './map.js';

function placeHeroInCar(state, x, y, angle) {
  const hero = state.hero;
  const car = state.vehicles.find((v) => v.owner === 'player') || state.vehicles[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 120;
  state.playerVehicle = car;
  hero.x = x;
  hero.y = y;
  hero.angle = angle;
  state.camera.x = x;
  state.camera.y = y;
}

/**
 * v4 meter scale: stage Leo ON FOOT (1.8 m tall) instead of in a car, so
 * the frame proves the ratio — Leo against the avenue, the traffic and
 * the towers behind him. The camera sits ~8.5 m behind him: at FOV 55°
 * a 1.8 m figure fills ~21% of the frame height (the 1/5–1/4 target).
 */
function placeHeroOnFoot(state, x, y, angle) {
  const hero = state.hero;
  state.playerVehicle = null;
  hero.x = x;
  hero.y = y;
  hero.angle = angle;
  hero.moving = true;
  state.camera.x = x;
  state.camera.y = y;
}

/**
 * Park traffic on the avenue ahead of the hero, so the play shot shows a
 * busy street. Cars are 4.5 m long (vehicles.js, v4.1 meter scale), so
 * they are staged 30–120 m up the road in the arterial lane centres
 * (x 373.5 / 376.5): close enough to read as traffic next to the 1.8 m
 * hero, far enough not to hide him. (Tester fix: the old staging put
 * them 150–480 m away on a stale "46 u car" note, and the shot showed
 * an empty road.)
 */
function placeTraffic(state, positions) {
  const cars = state.vehicles.filter((v) => v !== state.playerVehicle);
  positions.forEach(([x, y, angle], i) => {
    const v = cars[i % cars.length];
    if (!v) return;
    v.x = x;
    v.y = y;
    v.angle = angle;
    v.speed = 0;
  });
}

/**
 * Move pedestrians out of the hero's immediate frame. NPCs are 1.8 m
 * now (npc.js, v4.1 meter scale — the old "~30 u tall" note is stale),
 * so they belong in the frame as people; only one standing within 4 m
 * of Leo is moved, so nobody overlaps him. (Tester fix: the old 150 m
 * clear-out emptied the street of people.)
 */
function moveNpcsAway(state, x, y, minDist) {
  for (const n of state.npcs) {
    if (Math.hypot(n.x - x, n.y - y) < minDist) {
      n.x += 750;
      n.y += 666.7;
    }
  }
}

function placePolice(state, positions) {
  state.police = positions.map(([kind, x, y]) => ({
    kind, x, y, angle: Math.PI, speed: 200, hp: kind === 'tank' ? 400 : kind === 'heli' ? 120 : 80,
    maxHp: kind === 'tank' ? 400 : kind === 'heli' ? 120 : 80, shootCd: 2, ramCd: 0,
    path: null, pathIdx: 0, repathCd: 0, pathTarget: null, lastX: x, lastY: y, stuckT: 0,
  }));
}

export function stageShot(name, state, world) {
  state.showMap = false;
  if (name === 'start') {
    state.screen = SCREEN_TITLE;
    state.time.minutes = 9 * 60;
    state.time.day = 1;
    state.season = 'summer';
    state.rain = 0;
    state.camera.x = 375;
    state.camera.y = 700;
    // Wide panorama over downtown.
    state.camera.yaw = 0.6;
    state.camera.pitch = 0.5;
    state.camera.dist = 300;
    state.money = 1250;
    return { screen: SCREEN_TITLE };
  }
  if (name === 'play') {
    state.screen = SCREEN_PLAY;
    state.time.minutes = 10 * 60 + 15;
    state.season = 'summer';
    state.rain = 0;
    state.money = 1250;
    state.wanted = 0;
    startMainMission(state, 0);
    // v4: Leo on foot, mid-avenue 375, heading north (-π/2) up the
    // street; the camera sits behind him (yaw π looks north) at 9.5 m,
    // so the 1.8 m hero fills ~1/5 of the frame with the towers of
    // downtown rising behind him and traffic ahead on the avenue.
    placeHeroOnFoot(state, 375, 633.3, -Math.PI / 2);
    placeTraffic(state, [
      [373.5, 623.3, -Math.PI / 2],
      [376.5, 613.3, -Math.PI / 2],
      [373.5, 603.3, -Math.PI / 2],
      [376.5, 593.3, -Math.PI / 2],
    ]);
    moveNpcsAway(state, 375, 633.3, 4);
    state.camera.x = 375;
    state.camera.y = 633.3;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.45;
    state.camera.dist = 9.5;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    state.screen = SCREEN_PLAY;
    state.time.minutes = 17 * 60 + 40;
    state.season = 'summer';
    state.rain = 0;
    state.money = 3400;
    state.wanted = 3;
    startMainMission(state, 4);
    placeHeroInCar(state, 375, 633.3, -Math.PI / 2);
    // Police around the car (north, up the avenue, and closing in from
    // behind) so the chase is visible in the frame — the camera sits
    // close behind the hero looking north. (Tester fix: the old camera
    // sat 300 m away, so the chase read as a speck on an empty plain.)
    placePolice(state, [
      ['car', 373.5, 624],
      ['car', 376.5, 619.3],
      ['bike', 373.5, 615],
      ['bike', 376.5, 626],
      ['car', 375, 610.7],
    ]);
    state.camera.x = 375;
    state.camera.y = 633.3;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.32;
    state.camera.dist = 32;
    return { screen: SCREEN_PLAY };
  }
  if (name === 'night') {
    state.screen = SCREEN_PLAY;
    state.time.minutes = 23 * 60;
    state.season = 'rainy';
    state.rain = 0.8;
    state.money = 5200;
    state.wanted = 1;
    state.unlocked[1] = true;
    const hero = state.hero;
    const bike = state.vehicles.find((v) => v.kind === 'bike') || state.vehicles[0];
    // On avenue 975 at street 566.7 (a real road), heading north (-Y).
    bike.x = 975;
    bike.y = 566.7;
    bike.angle = -Math.PI / 2;
    bike.speed = 0;
    state.playerVehicle = bike;
    hero.x = 975;
    hero.y = 566.7;
    state.camera.x = 975;
    state.camera.y = 566.7;
    // Behind the bike, looking north up the avenue: the patrol car ahead
    // is visible up the road, under the street lamps.
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.4;
    state.camera.dist = 320;
    placePolice(state, [['car', 975, 483.3]]);
    state.objective = 'Side job: Deliver the package to Pier 9 before dawn.';
    return { screen: SCREEN_PLAY };
  }
  if (name === 'map') {
    state.screen = SCREEN_PLAY;
    state.time.minutes = 10 * 60 + 15;
    state.season = 'summer';
    state.rain = 0;
    state.money = 1250;
    state.wanted = 0;
    startMainMission(state, 0);
    // Heading north up avenue 375, same staging as the play shot, so the
    // frozen 3D scene behind the map is the real game.
    placeHeroInCar(state, 375, 633.3, -Math.PI / 2);
    state.camera.x = 375;
    state.camera.y = 633.3;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.45;
    state.camera.dist = 260;
    // GPS to the airport: a long route across downtown, visible on the map
    // with its symbols and legend. main.js opens the map panel for this shot.
    // v4: the panel now also shows the 10 new landmarks (3 worship, 3
    // housing, 4 ring-road flyovers) in the legend and the Landmarks list,
    // and fitView frames the whole 2400 x 1800 m city — the big-map proof.
    setDestination(state, world, { id: 'airport', kind: 'airport', label: 'Airport — Cargo Terminal', x: 1162.5, y: 1570 });
    state.showMap = true;
    return { screen: SCREEN_PLAY };
  }
  return { screen: SCREEN_TITLE };
}
