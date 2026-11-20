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
    state.camera.x = 1500;
    state.camera.y = 2100;
    // Wide panorama over downtown.
    state.camera.yaw = 0.6;
    state.camera.pitch = 0.5;
    state.camera.dist = 900;
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
    // Heading north up avenue 1500 (angle -π/2); the camera sits behind
    // the car (yaw π looks north) so the street runs away ahead of it.
    placeHeroInCar(state, 1500, 1900, -Math.PI / 2);
    state.camera.x = 1500;
    state.camera.y = 1900;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.45;
    state.camera.dist = 260;
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
    placeHeroInCar(state, 1500, 1900, -Math.PI / 2);
    // Police ahead of the car (north, up the avenue) so the chase is
    // visible in the frame — the camera sits behind the hero looking north.
    placePolice(state, [
      ['car', 1500, 1550],
      ['car', 1500, 1350],
      ['bike', 1470, 1600],
      ['bike', 1530, 1450],
      ['car', 1500, 1700],
    ]);
    state.camera.x = 1500;
    state.camera.y = 1900;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.45;
    state.camera.dist = 300;
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
    // On avenue 3900 at street 1700 (a real road), heading north (-Y).
    bike.x = 3900;
    bike.y = 1700;
    bike.angle = -Math.PI / 2;
    bike.speed = 0;
    state.playerVehicle = bike;
    hero.x = 3900;
    hero.y = 1700;
    state.camera.x = 3900;
    state.camera.y = 1700;
    // Behind the bike, looking north up the avenue: the patrol car ahead
    // is visible up the road, under the street lamps.
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.4;
    state.camera.dist = 320;
    placePolice(state, [['car', 3900, 1450]]);
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
    // Heading north up avenue 1500, same staging as the play shot, so the
    // frozen 3D scene behind the map is the real game.
    placeHeroInCar(state, 1500, 1900, -Math.PI / 2);
    state.camera.x = 1500;
    state.camera.y = 1900;
    state.camera.yaw = Math.PI;
    state.camera.pitch = 0.45;
    state.camera.dist = 260;
    // GPS to the airport: a long route across downtown, visible on the map
    // with its symbols and legend. main.js opens the map panel for this shot.
    setDestination(state, world, { id: 'airport', kind: 'airport', label: 'Airport — Cargo Terminal', x: 4650, y: 4710 });
    state.showMap = true;
    return { screen: SCREEN_PLAY };
  }
  return { screen: SCREEN_TITLE };
}
