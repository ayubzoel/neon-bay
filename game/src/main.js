// Neon Bay — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, game over, plus the DOM panels for shops,
// dialogues, the safe house and the minigames.
//
// ?seed=N fixes the world. ?shot=start|play|chase|night (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import {
  CAMERA_MAX_DIST,
  CAMERA_MIN_DIST,
  CAMERA_PITCH_MAX,
  CAMERA_PITCH_MIN,
  STEP,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './config.js';
import { createRandom } from './random.js';
import {
  SCREEN_ACTIVITY, SCREEN_DIALOG, SCREEN_INTERIOR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_SHOP, SCREEN_TITLE,
  activeCharacter, addWanted, advanceClock, applySaveData, createGameState, damagePlayer, decayWanted, loadSaveData, saveGame, showMessage, switchCharacter,
} from './state.js';
import { buildWorld } from './world.js';
import { createRenderer } from './render.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import { createUI } from './ui.js';
import { enterVehicle, exitVehicle, nearestVehicle, spawnVehicles, updateVehicles } from './vehicles.js';
import { nearestInteractable, updatePlayer } from './player.js';
import { spawnNpcs, talkToNpc, pickpocket, updateNpcs } from './npc.js';
import { updatePolice } from './police.js';
import { buildSidePool, nextMainMission, startMainMission, startSideQuest, updateEnemies, updateMissions, updatePickups } from './missions.js';
import { updateBullets, updateCombat } from './combat.js';
import { buyItem, selectOutfit, shopItemsFor, sleepAtSafeHouse, storeCurrentCar, takeOutCar } from './shops.js';
import { hideActivityCanvas, startActivity, startRaceChallenge, startSwimChallenge, updateActivity, updateRaceChallenge, updateSwimChallenge } from './activities.js';
import { initAudio, playSfx, setListenerPosition } from './audio.js';
import { stageShot } from './shots.js';
import { CLOTHES } from './config.js';

const MAX_FRAME = 0.25;

// Frames-per-second counter, exposed as window.__neonBay.fps for testers.
let fpsValue = 0;
let fpsFrames = 0;
let fpsWindowStart = 0;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const rng = createRandom(seed);
const world = buildWorld(rng);
const renderer = createRenderer(canvas);
let state = createGameState(seed);
state.fireCd = 0;
state.crimeCooldown = 0;
state.policeCanSee = false;
state.showMap = false;
state.prompt = null;
state.ownedClothes = ['street'];
state.dialogOptions = [];

function announce(message) {
  statusEl.textContent = message;
}

function buildEntities() {
  spawnVehicles(state, world, rng);
  spawnNpcs(state, world, rng);
  buildSidePool(state, rng);
}

function mouseWorld(input) {
  // v2: raycast from the 3D camera through the mouse point to the ground plane.
  if (renderer && typeof renderer.screenToGround === 'function') {
    return renderer.screenToGround(input.mouse.x, input.mouse.y);
  }
  const view = renderer.view;
  const vw = view.w / view.scale;
  const vh = view.h / view.scale;
  const camX = Math.max(vw / 2, Math.min(WORLD_WIDTH - vw / 2, state.camera.x));
  const camY = Math.max(vh / 2, Math.min(WORLD_HEIGHT - vh / 2, state.camera.y));
  return {
    x: camX + (input.mouse.x - view.w / 2) / view.scale,
    y: camY + (input.mouse.y - view.h / 2) / view.scale,
  };
}

function refreshShopPanel() {
  const shop = state.shop;
  if (!shop) return;
  const titles = { food: shop.name + ' — Food', gun: shop.name + ' — Guns & Ammo', clothes: shop.name + ' — Clothes', mods: shop.name + ' — Car Mods' };
  ui.showShop(shop.kind, titles[shop.kind] || shop.name, shopItemsFor(state, shop.kind), state.money);
}

const ui = createUI({
  onNewGame() {
    state = createGameState(seed);
    state.fireCd = 0;
    state.ownedClothes = ['street'];
    buildEntities();
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce('New game. Talk to Rico at the Neon Diner.');
  },
  onContinue() {
    const data = loadSaveData();
    state = createGameState(seed);
    state.fireCd = 0;
    state.ownedClothes = ['street'];
    buildEntities();
    if (data) applySaveData(state, data);
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce('Welcome back to Neon Bay.');
  },
  onResume() {
    state.screen = SCREEN_PLAY;
    ui.hideAll();
  },
  onSave() {
    saveGame(state);
  },
  onQuitTitle() {
    state.screen = SCREEN_TITLE;
    ui.showStart(!!loadSaveData());
  },
  onRespawn() {
    const hero = activeCharacter(state);
    state.money = Math.max(0, state.money - 100);
    hero.hp = 100;
    hero.armor = 0;
    hero.x = 560;
    hero.y = 1620;
    state.wanted = 0;
    state.police = [];
    state.stats.deaths += 1;
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce('Back on your feet at the safe house.');
  },
  onCloseShop() {
    state.screen = SCREEN_PLAY;
    state.shop = null;
    ui.hideAll();
  },
  onBuy(kind, id) {
    if (buyItem(state, kind, id)) refreshShopPanel();
  },
  onDialogOption(i) {
    const opt = state.dialogOptions[i];
    if (opt) opt.fn();
  },
  onWardrobeOpen() {
    const items = CLOTHES.map((c) => ({
      id: c.id, name: c.name, price: c.price,
      desc: c.id === 'street' ? 'Everyday look' : `A fresh ${c.name.toLowerCase()} look`,
      owned: (state.ownedClothes || []).includes(c.id) || c.price === 0,
      current: state.characters[0].outfit === c.id,
    }));
    ui.showWardrobe(items);
  },
  onGarageOpen() {
    ui.showGarage(state.garage);
  },
  onSleep() {
    sleepAtSafeHouse(state);
    ui.showInterior();
  },
  onLeaveHouse() {
    state.screen = SCREEN_PLAY;
    ui.hideAll();
  },
  onWardrobe(id) {
    const owned = (state.ownedClothes || []).includes(id);
    if (!owned) {
      if (!buyItem(state, 'clothes', id)) return;
    } else {
      selectOutfit(state, id);
    }
    this.onWardrobeOpen();
  },
  onGarage(i) {
    if (takeOutCar(state, i)) {
      state.screen = SCREEN_PLAY;
      ui.hideAll();
    }
  },
  onWardrobeClose() {
    ui.showInterior();
  },
  onGarageClose() {
    ui.showInterior();
  },
});

function openShop(shop) {
  state.shop = shop;
  state.screen = SCREEN_SHOP;
  refreshShopPanel();
  playSfx('click');
}

function openTalk(npc) {
  const text = talkToNpc(state, npc);
  if (text === null) return;
  state.screen = SCREEN_DIALOG;
  state.dialogOptions = [{ label: 'Nice talking to you.', fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } }];
  ui.showDialog(npc.name, text, state.dialogOptions);
}

function openGiver(npc) {
  const next = nextMainMission(state);
  if (!next) {
    state.screen = SCREEN_DIALOG;
    state.dialogOptions = [{ label: 'Free roam it is.', fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } }];
    ui.showDialog(npc.name, 'You finished every main mission. Neon Bay is yours now — side jobs are still out there if you want cash.', state.dialogOptions);
    return;
  }
  if (state.missions.active) {
    state.screen = SCREEN_DIALOG;
    state.dialogOptions = [{ label: 'On it.', fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } }];
    ui.showDialog(npc.name, `You are on "${state.missions.active.title}". Follow the yellow marker on the map.`, state.dialogOptions);
    return;
  }
  state.screen = SCREEN_DIALOG;
  state.dialogOptions = [
    {
      label: `Start mission ${next.id}: ${next.title} ($${next.reward})`,
      fn: () => {
        startMainMission(state, next.id - 1);
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        playSfx('mission');
      },
    },
    {
      label: 'Not yet.', secondary: true,
      fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); },
    },
  ];
  ui.showDialog(npc.name, `Got work for you, ${activeCharacter(state).name}. ${next.title} — ${next.brief} Pays $${next.reward}.`, state.dialogOptions);
}

function openSideJob(quest) {
  state.screen = SCREEN_DIALOG;
  state.dialogOptions = [
    {
      label: `Take the job ($${quest.reward})`,
      fn: () => {
        startSideQuest(state, quest);
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        playSfx('mission');
      },
    },
    { label: 'Maybe later.', secondary: true, fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } },
  ];
  ui.showDialog(quest.giver, `${quest.title} — ${quest.brief}`, state.dialogOptions);
}

function handleInteract() {
  const target = nearestInteractable(state, world);
  if (!target) return;
  if (target.kind === 'shop') openShop(target.shop);
  else if (target.kind === 'safehouse') {
    state.screen = SCREEN_INTERIOR;
    ui.showInterior();
    playSfx('click');
  } else if (target.kind === 'activity') {
    const kind = target.spot.kind;
    if (kind === 'race') {
      if (!startRaceChallenge(state)) showMessage(state, 'You need a vehicle to race!');
    } else if (kind === 'swim') {
      startSwimChallenge(state);
    } else {
      startActivity(state, kind);
    }
  } else if (target.kind === 'npc') {
    openTalk(target.npc);
  } else if (target.kind === 'giver') {
    openGiver(target.npc);
  }
}

function handleEnterVehicle() {
  if (state.playerVehicle) {
    exitVehicle(state);
    playSfx('click');
    return;
  }
  const v = nearestVehicle(state, 70);
  if (!v) return;
  if (v.owner === 'traffic') {
    const policeNear = state.police.some((p) => Math.hypot(p.x - v.x, p.y - v.y) < 420);
    if (policeNear || Math.random() < 0.4) addWanted(state, 1, 'Car stolen in plain sight');
    else showMessage(state, 'Car stolen — nobody saw.');
    state.stats.stolen += 1;
  }
  enterVehicle(state, v);
  playSfx('engine');
}

function stepPlay(dt, input) {
  if (state.screen === SCREEN_ACTIVITY) {
    const done = updateActivity(state, dt, input);
    if (done === 'done') {
      state.screen = SCREEN_PLAY;
      ui.hideAll();
    }
    return;
  }
  advanceClock(state, dt);
  const ePressed = input.pressed('KeyE');
  const fPressed = input.pressed('KeyF');
  const qPressed = input.pressed('KeyQ');
  const tabPressed = input.pressed('Tab') || input.pressed('KeyC');
  const mPressed = input.pressed('KeyM');
  const gPressed = input.pressed('KeyG');
  if (ePressed) handleInteract();
  if (fPressed) handleEnterVehicle();
  if (tabPressed) {
    switchCharacter(state);
    playSfx('click');
  }
  if (mPressed) state.showMap = !state.showMap;
  if (gPressed && state.playerVehicle) {
    const hero = activeCharacter(state);
    if (Math.hypot(hero.x - 560, hero.y - 1620) < 220) storeCurrentCar(state);
    else showMessage(state, 'Park near the safe house to store this car.');
  }
  if (qPressed) {
    const hero = activeCharacter(state);
    const near = state.npcs.find((n) => n.kind === 'ped' && Math.hypot(n.x - hero.x, n.y - hero.y) < 60);
    if (near) pickpocket(state, near);
  }

  if (state.playerVehicle) updateVehicles(state, world, dt, input, rng);
  else updatePlayer(state, world, dt, input);
  if (!state.playerVehicle) updateVehicles(state, world, dt, input, rng);
  updateNpcs(state, world, dt, rng);
  updateEnemies(state, dt);
  updatePolice(state, world, dt);
  decayWanted(state, dt, state.policeCanSee);
  updateMissions(state, dt);
  updatePickups(state);
  updateCombat(state, dt, input, mouseWorld(input));
  updateBullets(state, world, dt);
  updateRaceChallenge(state, dt);
  updateSwimChallenge(state, dt);
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    state.particles[i].life -= dt;
    if (state.particles[i].life <= 0) state.particles.splice(i, 1);
  }
  if (state.messageTimer > 0) state.messageTimer -= dt;

  // Prompt line under the HUD.
  const target = nearestInteractable(state, world);
  const vehicle = state.playerVehicle ? null : nearestVehicle(state, 70);
  state.prompt = target ? `E — ${target.label}` : vehicle ? `F — Enter ${vehicle.name} (${vehicle.kind})` : null;

  const hero = activeCharacter(state);
  if (hero.hp <= 0) {
    state.screen = SCREEN_OVER;
    ui.showOver(`${hero.name} got taken down in ${state.unlocked[2] ? 'Cinder Peaks' : state.unlocked[1] ? 'Sunset Beach' : 'Downtown'}. The crew will remember this one.`);
    playSfx('wanted');
  }
}

function runShot(name) {
  buildEntities();
  const scene = stageShot(name, state, world);
  // The title panel is DOM, not canvas: hide it for play scenes or it
  // would cover the staged frame. The start shot keeps it.
  if (scene.screen === SCREEN_TITLE) ui.showStart(!!loadSaveData());
  else ui.hideAll();
  let painted = 0;
  function paint() {
    renderer.draw(state, world, scene.screen, 4.2);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      // Both flags: the kit checks window.shotReady, older code used __shotReady.
      window.__shotReady = true;
      window.shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  buildEntities();
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let lastToast = '';
  ui.showStart(!!loadSaveData());
  initAudio();

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Frames per second for automated testing (window.__neonBay.fps).
    fpsFrames += 1;
    if (fpsWindowStart === 0) fpsWindowStart = now;
    else if (now - fpsWindowStart >= 1000) {
      fpsValue = Math.round((fpsFrames * 1000) / (now - fpsWindowStart));
      fpsFrames = 0;
      fpsWindowStart = now;
    }
    // v2 camera orbit: drag orbits, wheel zooms (drag up raises the camera).
    const orbit = input.takeOrbit();
    if (orbit.dx !== 0 || orbit.dy !== 0 || orbit.wheel !== 0) {
      state.camera.yaw -= orbit.dx * 0.005;
      state.camera.pitch = Math.max(
        CAMERA_PITCH_MIN,
        Math.min(CAMERA_PITCH_MAX, state.camera.pitch - orbit.dy * 0.003),
      );
      state.camera.dist = Math.max(
        CAMERA_MIN_DIST,
        Math.min(CAMERA_MAX_DIST, state.camera.dist * (1 + orbit.wheel * 0.001)),
      );
    }
    // Positional audio follows the hero; the minigame overlay hides off-activity.
    const heroNow = activeCharacter(state);
    setListenerPosition(heroNow.x, heroNow.y);
    if (state.screen !== SCREEN_ACTIVITY) hideActivityCanvas();
    if (state.screen === SCREEN_PLAY) ui.showOrbitHintOnce();
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (state.screen === SCREEN_TITLE) {
        const data = loadSaveData();
        if (data) {
          state = createGameState(seed);
          state.fireCd = 0;
          state.ownedClothes = ['street'];
          buildEntities();
          applySaveData(state, data);
        }
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        announce('Playing. Talk to Rico at the Neon Diner.');
        // A Space/Enter tap that started the game must not also jump or
        // fire the moment play begins.
        input.clearStaleEdges();
      }
    }
    if (actions & ACTION_PAUSE) {
      if (state.screen === SCREEN_PLAY) {
        state.screen = SCREEN_PAUSED;
        ui.showPause();
        announce('Paused.');
        // The Escape/P tap that paused must not leak into play after resume.
        input.clearStaleEdges();
      } else if (state.screen === SCREEN_PAUSED) {
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        announce('Playing.');
        input.clearStaleEdges();
      }
      // Any other screen (activity, shop, dialog, ...) keeps the Escape
      // in the queue: updateActivity reads it to quit the minigame.
    }

    if (state.screen === SCREEN_TITLE) {
      // Slow pan over downtown behind the title panel.
      const t = now / 1000;
      state.camera.x = 1500 + Math.sin(t * 0.07) * 500;
      state.camera.y = 2100 + Math.cos(t * 0.05) * 300;
      accumulator += elapsed;
      while (accumulator >= STEP) {
        updateNpcs(state, world, STEP, rng);
        accumulator -= STEP;
      }
      renderer.draw(state, world, SCREEN_TITLE, t);
      input.clearStaleEdges();
    } else if (state.screen === SCREEN_PLAY || state.screen === SCREEN_ACTIVITY) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        stepPlay(STEP, input);
        accumulator -= STEP;
        if (state.screen !== SCREEN_PLAY && state.screen !== SCREEN_ACTIVITY) break;
      }
      // Clicks are cleared after the steps read them, before the draw,
      // so a click that lands while drawing is read by the next frame.
      input.endFrame();
      renderer.draw(state, world, state.screen, now / 1000);
    } else {
      accumulator = 0;
      renderer.draw(state, world, state.screen, now / 1000);
      input.clearStaleEdges();
    }

    if (state.message && state.message !== lastToast && state.messageTimer > 0) {
      lastToast = state.message;
      ui.showToast(state.message);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      ui.showPause();
      announce('Paused.');
    }
  });

  announce('Neon Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// Debug hook for automated play-testing (read-only from the page's own tests).
window.__neonBay = { get state() { return state; }, get fps() { return fpsValue; }, world, seed };

if (shot) runShot(shot);
else runGame();
