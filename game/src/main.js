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
  activeCharacter, addWanted, advanceClock, applySaveData, createGameState, damagePlayer, decayWanted, deleteAllSaves, deleteSave, exportSaveJson, importSaveJson, isNight, listSaveSlots, loadSaveData, loadSettings, resetSettings, saveGame, saveSettings, showMessage, validateSettings,
} from './state.js';
import { buildWorld, districtAt } from './world.js';
import { createRenderer } from './render.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput, getBindings, loadBindings, resetBindings, setBinding, setVibration } from './input.js';
import { createUI, keyDisplay } from './ui.js';
import { enterVehicle, exitVehicle, nearestVehicle, spawnVehicles, updateVehicles } from './vehicles.js';
import { nearestInteractable, updatePlayer, validateHeroSpawn } from './player.js';
import { spawnNpcs, talkToNpc, pickpocket, updateNpcs } from './npc.js';
import { updatePolice } from './police.js';
import { buildSidePool, missionBrief, missionTitle, nextMainMission, objectiveLineFor, startMainMission, startSideQuest, updateEnemies, updateMissions, updatePickups } from './missions.js';
import { updateBullets, updateCombat, BACKPACK_CAPACITY, backpackItems, cycleWeapon, switchWeapon, toggleHolster } from './combat.js';
import { buyItem, selectOutfit, shopItemsFor, sleepAtSafeHouse, storeCurrentCar, takeOutCar } from './shops.js';
import { hideActivityCanvas, startActivity, startRaceChallenge, startSwimChallenge, updateActivity, updateRaceChallenge, updateSwimChallenge } from './activities.js';
import { applyAudioSettings, cycleRadio, getAudioState, getRadioChannel, initAudio, isMuted, playSfx, playTest, setAmbience, setEngine, setListenerPosition, setMusic, setMuted, setSiren } from './audio.js';
import { stageShot } from './shots.js';
import { CLOTHES, WEAPON_ORDER } from './config.js';
import { clearNav, createMapController, getDestinations, navRemaining, rebuildNavRoute, setDestination } from './map.js';
import { addStrings, applyI18nToDOM, getLang, onLangChange, setLang, t } from './i18n.js';
import { NEON_SIGNS } from './data.js';
import { neonSignMat } from './textures.js';

// v4 i18n: announcements, dialogues, prompts and toasts from the main
// loop. Menu / panel strings live in ui.js, map strings in map.js.
addStrings('en', {
  'main.newGame': 'New game. Talk to Rico at the Neon Diner.',
  'main.welcomeBack': 'Welcome back to Neon Bay.',
  'main.playing': 'Playing. Talk to Rico at the Neon Diner.',
  'main.paused': 'Paused.',
  'main.resumed': 'Playing.',
  'main.respawn': 'Back on your feet at the safe house.',
  'main.titleHint': 'Neon Bay. Press Enter or click to start.',
  'main.parkNear': 'Park near the safe house to store this car.',
  'main.carStolenSeen': 'Car stolen in plain sight',
  'main.carStolenUnseen': 'Car stolen — nobody saw.',
  'main.needVehicleRace': 'You need a vehicle to race!',
  'main.arrived': 'Arrived at {label}.',
  'main.freeRoam': 'Free roam it is.',
  'main.finishedAll': 'You finished every main mission. Neon Bay is yours now — side jobs are still out there if you want cash.',
  'main.onMission': 'You are on "{title}". Follow the yellow marker on the map.',
  'main.startMission': 'Start mission {id}: {title} (${reward})',
  'main.notYet': 'Not yet.',
  'main.gotWork': 'Got work for you, {name}. {title} — {brief} Pays ${reward}.',
  'main.takeJob': 'Take the job (${reward})',
  'main.maybeLater': 'Maybe later.',
  'main.onIt': 'On it.',
  'main.prompt': '{key} — {label}',
  'main.enterVehicle': 'Enter {name} ({kind})',
  'main.takenDown': '{name} got taken down in {district}. The crew will remember this one.',
  'main.muted': 'Sound muted (N to unmute).',
  'main.unmuted': 'Sound on.',
  'main.radio': 'Radio: {station}',
  'main.noGameSave': 'Start or continue a game before saving.',
  'main.importOk': 'Save imported.',
  'main.importFail': 'That file is not a Neon Bay save.',
  'main.slotLoaded': 'Save loaded.',
  'main.slotDeleted': 'Save deleted.',
  'main.settingsReset': 'Settings reset to default.',
  'main.bindingsReset': 'Controls reset to default.',
  // Neon signage (data.js NEON_SIGNS order) — generic words translate,
  // the city name stays. Repainted by repaintNeonSigns() on language change.
  'neon.sign.0': 'NEON BAY',
  'neon.sign.1': 'PIER 9',
  'neon.sign.2': 'CASINO',
  'neon.sign.3': 'DINER',
  'neon.sign.4': 'SURF SHOP',
  'neon.sign.5': 'HOTEL',
  'neon.sign.6': 'LODGE',
  'neon.sign.7': 'MARKET',
});
addStrings('id', {
  'main.newGame': 'Game baru. Bicara dengan Rico di Neon Diner.',
  'main.welcomeBack': 'Selamat datang kembali di Neon Bay.',
  'main.playing': 'Bermain. Bicara dengan Rico di Neon Diner.',
  'main.paused': 'Jeda.',
  'main.resumed': 'Bermain.',
  'main.respawn': 'Kamu bangkit lagi di safe house.',
  'main.titleHint': 'Neon Bay. Tekan Enter atau klik untuk mulai.',
  'main.parkNear': 'Parkir dekat safe house untuk menyimpan mobil ini.',
  'main.carStolenSeen': 'Mobil dicuri di depan umum',
  'main.carStolenUnseen': 'Mobil dicuri — tidak ada yang melihat.',
  'main.needVehicleRace': 'Kamu butuh kendaraan untuk balapan!',
  'main.arrived': 'Tiba di {label}.',
  'main.freeRoam': 'Jelajah bebas saja.',
  'main.finishedAll': 'Kamu menyelesaikan semua misi utama. Neon Bay milikmu sekarang — pekerjaan sampingan masih ada kalau mau uang.',
  'main.onMission': 'Kamu sedang menjalani "{title}". Ikuti penanda kuning di peta.',
  'main.startMission': 'Mulai misi {id}: {title} (${reward})',
  'main.notYet': 'Belum.',
  'main.gotWork': 'Ada kerjaan buatmu, {name}. {title} — {brief} Bayaran ${reward}.',
  'main.takeJob': 'Ambil pekerjaan (${reward})',
  'main.maybeLater': 'Mungkin nanti.',
  'main.onIt': 'Siap.',
  'main.prompt': '{key} — {label}',
  'main.enterVehicle': 'Naik {name} ({kind})',
  'main.takenDown': '{name} tumbang di {district}. Kru akan mengingat ini.',
  'main.muted': 'Suara dibisukan (N untuk membunyikan).',
  'main.unmuted': 'Suara menyala.',
  'main.radio': 'Radio: {station}',
  'main.noGameSave': 'Mulai atau lanjutkan game dulu sebelum menyimpan.',
  'main.importOk': 'Save berhasil diimpor.',
  'main.importFail': 'File itu bukan save Neon Bay.',
  'main.slotLoaded': 'Save dimuat.',
  'main.slotDeleted': 'Save dihapus.',
  'main.settingsReset': 'Pengaturan direset ke default.',
  'main.bindingsReset': 'Kontrol direset ke default.',
  'neon.sign.0': 'NEON BAY',
  'neon.sign.1': 'DERMAGA 9',
  'neon.sign.2': 'KASINO',
  'neon.sign.3': 'RESTORAN',
  'neon.sign.4': 'TOKO SELANCAR',
  'neon.sign.5': 'HOTEL',
  'neon.sign.6': 'PONDOK',
  'neon.sign.7': 'PASAR',
});

// --- v4 Settings: cross-builder hook registry ------------------------------
// Builders A/B assign these (render.js quality, weather.js time/weather,
// npc.js/vehicles.js counts) — main.js calls them when a setting changes.
// Until they do, the setting is stored and the parts this build owns
// (HUD, minimap, touch size, sensitivity, audio, language) still apply.
window.__neonBayHooks = window.__neonBayHooks || {
  onQualityChange: null,
  onTimeMode: null,
  onWeatherMode: null,
  onNpcVehicleCount: null,
};

// Settings load once at boot and are applied live from then on.
let settings = loadSettings();

/** Apply the current settings to every system this build owns. */
function applySettings() {
  applyAudioSettings(settings.audio);
  loadBindings(settings.controls.bindings);
  setVibration(settings.controls.vibration);
  document.body.classList.remove('touch-small', 'touch-normal', 'touch-large');
  document.body.classList.add(`touch-${settings.controls.touchSize}`);
  const hud = document.getElementById('hud');
  if (hud) hud.style.display = settings.graphics.showHud ? '' : 'none';
  const mini = document.getElementById('mini');
  if (mini) mini.style.display = settings.graphics.showMinimap ? '' : 'none';
  const hooks = window.__neonBayHooks || {};
  try { if (typeof hooks.onQualityChange === 'function') hooks.onQualityChange(settings.graphics.quality); } catch { /* hook errors must not break settings */ }
  try { if (typeof hooks.onTimeMode === 'function') hooks.onTimeMode(settings.time.dayNight); } catch { /* see above */ }
  try { if (typeof hooks.onWeatherMode === 'function') hooks.onWeatherMode(settings.time.weather); } catch { /* see above */ }
  updateMuteButton();
}

function persistSettings() {
  settings.language = getLang();
  saveSettings(settings);
}

const MAX_FRAME = 0.25;

// Frames-per-second counter, exposed as window.__neonBay.fps for testers.
let fpsValue = 0;
let fpsFrames = 0;
let fpsWindowStart = 0;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
// The live input instance (created in runGame) — module scope so the
// Settings rebind handler can reach it.
let input = null;

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const rng = createRandom(seed);
const world = buildWorld(rng);

// v4 i18n: neon signs are 3D canvas textures baked at buildWorld time
// (world.js uses the raw NEON_SIGNS text), so a language switch — or a
// reload with another language saved — leaves the old text on the
// buildings. Repaint every sign mesh with the translated text; the meshes
// live in world.densityMeshes.signs in creation order, sign i cycling
// NEON_SIGNS[i % length] (see world.js buildMeshes). Cosmetic only —
// any failure here must never break the game.
function repaintNeonSigns() {
  try {
    const signs = world && world.densityMeshes && world.densityMeshes.signs;
    if (!signs || !signs.length) return;
    signs.forEach((mesh, i) => {
      const sign = NEON_SIGNS[i % NEON_SIGNS.length];
      mesh.material = neonSignMat(t(`neon.sign.${i % NEON_SIGNS.length}`), sign.color);
    });
  } catch (e) { /* neon signs are cosmetic */ }
}
repaintNeonSigns();
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
  const titles = { food: `${shop.name} — ${t('shop.kind.food')}`, gun: `${shop.name} — ${t('shop.kind.gun')}`, clothes: `${shop.name} — ${t('shop.kind.clothes')}`, mods: `${shop.name} — ${t('shop.kind.mods')}` };
  ui.showShop(shop.kind, titles[shop.kind] || shop.name, shopItemsFor(state, shop.kind), state.money);
}

// --- Interactive map (map.js): the DOM panel, the HUD button, the touch
// button. While it is open the game is truly paused (the loop below never
// steps the world), and closing it resumes exactly where it stopped.
const mapCtl = createMapController({
  getState: () => state,
  getWorld: () => world,
  onClose: () => closeMap(),
});
function openMap() {
  if (state.screen !== SCREEN_PLAY || state.showMap) return;
  state.showMap = true;
  mapCtl.open();
}
function closeMap() {
  if (!state.showMap) return;
  state.showMap = false;
  mapCtl.close();
}
function toggleMap() {
  if (state.showMap) closeMap();
  else openMap();
}
const btnMapEl = document.getElementById('btnMap');
if (btnMapEl) btnMapEl.addEventListener('click', () => toggleMap());
const btnMapTouchEl = document.getElementById('btnMapTouch');
if (btnMapTouchEl) btnMapTouchEl.addEventListener('click', () => toggleMap());
let btnMapShown = false;

// --- Backpack (map.js-style wiring, Builder C v4) ------------------------
// The bag holds every owned weapon with its own ammo (combat.js). While
// it is open the world is paused like the map: B / the HUD button / the
// touch BAG button toggle it, the mouse wheel cycles weapons instead of
// zooming the camera, and 1–6 / clicking a row equips.
function refreshBackpackPanel() {
  if (!state.backpackOpen) return;
  ui.showBackpack(backpackItems(state), BACKPACK_CAPACITY, state.holstered);
}
function openBackpack() {
  if (state.screen !== SCREEN_PLAY || state.backpackOpen || state.showMap) return;
  state.backpackOpen = true;
  refreshBackpackPanel();
  playSfx('backpack');
}
function closeBackpack() {
  if (!state.backpackOpen) return;
  state.backpackOpen = false;
  ui.hideAll();
  playSfx('backpack');
}
function toggleBackpack() {
  if (state.backpackOpen) closeBackpack();
  else openBackpack();
}
const btnBackpackEl = document.getElementById('btnBackpack');
if (btnBackpackEl) btnBackpackEl.addEventListener('click', () => toggleBackpack());
let btnBackpackShown = false;
// v4: the wheel also cycles weapons when the pointer is OVER the panel —
// the panel covers the middle of the screen, so a wheel over it never
// reaches the canvas listener (input.js) and would otherwise do nothing.
const backpackPanelEl = document.getElementById('backpackPanel');
if (backpackPanelEl) {
  backpackPanelEl.addEventListener('wheel', (event) => {
    if (!state.backpackOpen) return;
    event.preventDefault();
    cycleWeapon(state, event.deltaY > 0 ? 1 : -1);
    refreshBackpackPanel();
  }, { passive: false });
}

// --- Mute (v4 audio): the N key + the HUD speaker button toggle the
// master mute. The button label follows the state (and the language).
const btnMuteEl = document.getElementById('btnMute');
function updateMuteButton() {
  if (!btnMuteEl) return;
  btnMuteEl.textContent = isMuted() ? t('hud.muteOff') : t('hud.muteOn');
}
function toggleMute() {
  setMuted(!isMuted());
  settings.audio.muted = isMuted();
  persistSettings();
  updateMuteButton();
  playSfx('click');
  showMessage(state, isMuted() ? t('main.muted') : t('main.unmuted'));
}
if (btnMuteEl) btnMuteEl.addEventListener('click', () => toggleMute());
let btnMuteShown = false;

// --- Settings (v4): open from the title screen, the pause menu or the
// HUD gear button. The world is paused while it is open, like the map.
let settingsOpen = false;
let settingsReturnTo = null; // 'title' | 'paused' | 'play'
let settingsRebinding = null;
const importFileEl = document.getElementById('importSaveFile');
let importSlot = 1;

function buildSettingsView() {
  return {
    settings,
    slots: listSaveSlots(),
    bindings: getBindings(),
    rebinding: settingsRebinding,
    handlers: settingsHandlers,
  };
}
function refreshSettingsPanel() {
  if (settingsOpen) ui.showSettings(buildSettingsView());
}
function openSettings() {
  if (settingsOpen) return;
  if (state.screen === SCREEN_TITLE) settingsReturnTo = 'title';
  else if (state.screen === SCREEN_PAUSED) settingsReturnTo = 'paused';
  else if (state.screen === SCREEN_PLAY) {
    settingsReturnTo = 'play';
    state.screen = SCREEN_PAUSED;
  } else return;
  settingsOpen = true;
  settingsRebinding = null;
  ui.showSettings(buildSettingsView());
  playSfx('click');
}
function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  settingsRebinding = null;
  const back = settingsReturnTo;
  settingsReturnTo = null;
  if (back === 'title') ui.showStart(!!loadSaveData());
  else if (back === 'paused') ui.showPause();
  else {
    state.screen = SCREEN_PLAY;
    ui.hideAll();
  }
  playSfx('click');
}

const settingsHandlers = {
  onChange(path, value) {
    const parts = path.split('.');
    const group = parts[0];
    const key = parts.slice(1).join('.');
    if (group === 'audio' && key === 'muted') {
      settings.audio.muted = !!value;
      setMuted(settings.audio.muted);
    } else if (group === 'audio' && key.startsWith('mutedCategories.')) {
      const cat = key.split('.')[1];
      settings.audio.mutedCategories[cat] = !!value;
      applyAudioSettings(settings.audio);
    } else if (group === 'audio') {
      settings.audio[key] = value;
      applyAudioSettings(settings.audio);
    } else if (group === 'save') {
      settings.save[key] = value;
    } else if (group === 'controls') {
      settings.controls[key] = value;
    } else if (group === 'graphics') {
      settings.graphics[key] = value;
    } else if (group === 'time') {
      settings.time[key] = value;
    }
    persistSettings();
    applySettings();
  },
  onRebind(action) {
    if (!input) return;
    settingsRebinding = action;
    refreshSettingsPanel();
    input.startRebind(action, (act, code) => {
      settingsRebinding = null;
      if (code === null) {
        refreshSettingsPanel();
        return;
      }
      const res = setBinding(act, code);
      if (!res.ok) {
        showMessage(state, t('settings.keyTaken', { action: t(`settings.controls.${res.takenBy}`) || res.takenBy }), 4);
        refreshSettingsPanel();
        return;
      }
      settings.controls.bindings = getBindings();
      persistSettings();
      applySettings();
      refreshSettingsPanel();
    });
  },
  onResetBindings() {
    settings.controls.bindings = resetBindings();
    persistSettings();
    applySettings();
    showMessage(state, t('main.bindingsReset'));
    refreshSettingsPanel();
  },
  onPreset(name) {
    const presets = {
      silent: { master: 0, music: 0, sfx: 0, ambience: 0, vehicle: 0 },
      normal: { master: 0.8, music: 0.6, sfx: 0.9, ambience: 0.5, vehicle: 0.7 },
      loud: { master: 1, music: 0.9, sfx: 1, ambience: 0.8, vehicle: 1 },
    };
    const p = presets[name];
    if (!p) return;
    Object.assign(settings.audio, p);
    settings.audio.muted = false;
    settings.audio.mutedCategories = {};
    persistSettings();
    applySettings();
    refreshSettingsPanel();
  },
  onTestSound(cat) {
    playTest(cat);
  },
  onSlotSave(slot) {
    if (state.screen === SCREEN_TITLE) {
      showMessage(state, t('main.noGameSave'), 4);
      return;
    }
    if (saveGame(state, slot)) refreshSettingsPanel();
  },
  onSlotLoad(slot) {
    const data = loadSaveData(slot);
    if (!data) return;
    state = createGameState(seed);
    state.fireCd = 0;
    state.ownedClothes = ['street'];
    buildEntities();
    applySaveData(state, data);
    // A save (incl. pre-v5 saves) may hold a hero position inside a
    // building — re-validate before play resumes.
    window.__neonBay.lastSpawn = validateHeroSpawn(state, world);
    settingsOpen = false;
    settingsReturnTo = null;
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce(t('main.slotLoaded'));
    initAudio();
  },
  onSlotDelete(slot) {
    if (deleteSave(slot)) {
      showMessage(state, t('main.slotDeleted'));
      refreshSettingsPanel();
    }
  },
  onSlotExport(slot) {
    const exp = exportSaveJson(slot);
    if (!exp) return;
    const blob = new Blob([exp.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = exp.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  onSlotImport(slot) {
    importSlot = slot;
    if (importFileEl) importFileEl.click();
  },
  onResetProgress() {
    deleteAllSaves();
    showMessage(state, t('settings.resetDone'), 4);
    refreshSettingsPanel();
  },
  onResetSettings() {
    setLang('en');
    settings = resetSettings();
    persistSettings();
    applySettings();
    showMessage(state, t('main.settingsReset'), 4);
    refreshSettingsPanel();
  },
  onLanguage(lang) {
    if (setLang(lang)) {
      settings.language = getLang();
      persistSettings();
    }
    refreshSettingsPanel();
  },
  onClose() {
    closeSettings();
  },
};
if (importFileEl) {
  importFileEl.addEventListener('change', () => {
    const file = importFileEl.files && importFileEl.files[0];
    importFileEl.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importSaveJson(importSlot, String(reader.result || ''));
      showMessage(state, ok ? t('main.importOk') : t('main.importFail'), 4);
      refreshSettingsPanel();
    };
    reader.readAsText(file);
  });
}
const btnSettingsEl = document.getElementById('btnSettingsHud');
if (btnSettingsEl) btnSettingsEl.addEventListener('click', () => openSettings());
let btnSettingsShown = false;

// v4 i18n: static-HTML strings are applied at boot (data-i18n) and again
// on every language switch; dynamic panels re-render themselves.
applyI18nToDOM();
applySettings();
onLangChange(() => {
  updateMuteButton();
  if (state.backpackOpen) refreshBackpackPanel();
  // The HUD objective line was baked in the old language — rebuild it
  // from the active mission's data.js keys, and repaint the neon signs
  // (their canvas textures were baked at buildWorld time).
  if (state && (state.missions.active || state.missions.activeSide)) {
    state.objective = objectiveLineFor(state);
    announce(state.objective);
  }
  repaintNeonSigns();
});

const ui = createUI({
  onNewGame() {
    state = createGameState(seed);
    state.fireCd = 0;
    state.ownedClothes = ['street'];
    buildEntities();
    // v5 spawn safety: never start inside a building (see player.js).
    window.__neonBay.lastSpawn = validateHeroSpawn(state, world);
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce(t('main.newGame'));
    initAudio();
  },
  onContinue() {
    const data = loadSaveData();
    state = createGameState(seed);
    state.fireCd = 0;
    state.ownedClothes = ['street'];
    buildEntities();
    if (data) applySaveData(state, data);
    window.__neonBay.lastSpawn = validateHeroSpawn(state, world);
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce(t('main.welcomeBack'));
    initAudio();
  },
  onOpenSettings() {
    openSettings();
  },
  onCloseSettings() {
    closeSettings();
  },
  onResume() {
    state.screen = SCREEN_PLAY;
    state.backpackOpen = false;
    ui.hideAll();
  },
  onSave() {
    saveGame(state);
  },
  onQuitTitle() {
    state.backpackOpen = false;
    state.screen = SCREEN_TITLE;
    ui.showStart(!!loadSaveData());
  },
  onRespawn() {
    const hero = activeCharacter(state);
    state.money = Math.max(0, state.money - 100);
    hero.hp = 100;
    hero.armor = 0;
    hero.x = 140;
    hero.y = 540;
    // v5 spawn safety: the respawn point is validated like any other
    // spawn (it is clear today, but a map change must not strand Leo).
    window.__neonBay.lastSpawn = validateHeroSpawn(state, world);
    state.wanted = 0;
    state.police = [];
    state.stats.deaths += 1;
    state.screen = SCREEN_PLAY;
    ui.hideAll();
    announce(t('main.respawn'));
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
      id: c.id, name: t(`clothes.${c.id}`), price: c.price,
      desc: c.id === 'street' ? t('wardrobe.everyday') : t('wardrobe.fresh', { name: t(`clothes.${c.id}`) }),
      owned: (state.ownedClothes || []).includes(c.id) || c.price === 0,
      current: state.hero.outfit === c.id,
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
  onBackpackClose() {
    closeBackpack();
  },
  onBackpackSelect(key) {
    if (switchWeapon(state, key)) refreshBackpackPanel();
  },
  // v6: the panel's Holster / Draw button (also reachable on touch, where
  // there is no H key) — same toggle as the H key in updateCombat.
  onBackpackHolster() {
    toggleHolster(state);
    refreshBackpackPanel();
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
  state.dialogOptions = [{ label: t('ui.dialogDefault'), fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } }];
  ui.showDialog(npc.name, text, state.dialogOptions);
}

function openGiver(npc) {
  const next = nextMainMission(state);
  if (!next) {
    state.screen = SCREEN_DIALOG;
    state.dialogOptions = [{ label: t('main.freeRoam'), fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } }];
    ui.showDialog(npc.name, t('main.finishedAll'), state.dialogOptions);
    return;
  }
  if (state.missions.active) {
    state.screen = SCREEN_DIALOG;
    state.dialogOptions = [{ label: t('main.onIt'), fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } }];
    ui.showDialog(npc.name, t('main.onMission', { title: missionTitle(state.missions.active) }), state.dialogOptions);
    return;
  }
  state.screen = SCREEN_DIALOG;
  state.dialogOptions = [
    {
      label: t('main.startMission', { id: next.id, title: missionTitle(next), reward: next.reward }),
      fn: () => {
        startMainMission(state, next.id - 1);
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        playSfx('mission');
      },
    },
    {
      label: t('main.notYet'), secondary: true,
      fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); },
    },
  ];
  ui.showDialog(npc.name, t('main.gotWork', { name: activeCharacter(state).name, title: missionTitle(next), brief: missionBrief(next), reward: next.reward }), state.dialogOptions);
}

function openSideJob(quest) {
  state.screen = SCREEN_DIALOG;
  state.dialogOptions = [
    {
      label: t('main.takeJob', { reward: quest.reward }),
      fn: () => {
        startSideQuest(state, quest);
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        playSfx('mission');
      },
    },
    { label: t('main.maybeLater'), secondary: true, fn: () => { state.screen = SCREEN_PLAY; ui.hideAll(); } },
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
      if (!startRaceChallenge(state)) showMessage(state, t('main.needVehicleRace'));
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
  const v = nearestVehicle(state, 12);
  if (!v) return;
  if (v.owner === 'traffic') {
    const policeNear = state.police.some((p) => Math.hypot(p.x - v.x, p.y - v.y) < 420);
    if (policeNear || Math.random() < 0.4) addWanted(state, 1, t('main.carStolenSeen'));
    else showMessage(state, t('main.carStolenUnseen'));
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
  // v4 Settings: an explicit day/night choice pins the clock — 'auto'
  // lets it run, 'day' holds morning, 'night' holds evening.
  if (settings.time.dayNight === 'day' && isNight(state)) state.time.minutes = 10 * 60;
  if (settings.time.dayNight === 'night' && !isNight(state)) state.time.minutes = 20 * 60;
  // v4 Settings: an explicit weather choice pins the rain — 'auto'
  // follows the season, 'rain' forces a downpour, 'clear' forces dry.
  if (settings.time.weather === 'rain') state.rain = Math.max(state.rain, 0.7);
  if (settings.time.weather === 'clear') state.rain = Math.min(state.rain, 0.05);
  const ePressed = input.pressedAction('interact');
  const fPressed = input.pressedAction('enterVehicle');
  const qPressed = input.pressedAction('pickpocket');
  const gPressed = input.pressedAction('park');
  if (ePressed) handleInteract();
  if (fPressed) handleEnterVehicle();
  // M toggles the map in the frame loop (main.js), not here: while the map
  // is open stepPlay never runs, so a toggle here could never close it.
  if (gPressed && state.playerVehicle) {
    const hero = activeCharacter(state);
    // v4 meter scale: park within 30 m of the safe house (v3: 220).
    if (Math.hypot(hero.x - 140, hero.y - 540) < 30) storeCurrentCar(state);
    else showMessage(state, t('main.parkNear'));
  }
  if (qPressed) {
    const hero = activeCharacter(state);
    // v4 meter scale: pickpocket at arm's reach, ~2.5 m (v3: 60).
    const near = state.npcs.find((n) => n.kind === 'ped' && Math.hypot(n.x - hero.x, n.y - hero.y) < 2.5);
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
  // GPS navigation: arrive, re-route from the new position every few
  // seconds, and drop a mission destination whose mission is gone.
  if (state.nav) {
    if (state.nav.kind === 'mission' && !state.missions.active) {
      clearNav(state);
    } else {
      const remaining = navRemaining(state);
      // v4 meter-scale note: 90 m arrival is kept on purpose (see
      // checkReach in missions.js) — mission targets sit inside blocks
      // up to ~40 m from roads, so a realistic 10 m radius could strand
      // arrivals behind building walls.
      if (remaining < 90) {
        const label = state.nav.label;
        clearNav(state);
        showMessage(state, t('main.arrived', { label }));
        playSfx('mission');
      } else {
        state.navRepath = (state.navRepath || 0) + dt;
        if (state.navRepath > 3) {
          state.navRepath = 0;
          rebuildNavRoute(state, world);
        }
      }
    }
  }
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
  // v4 meter scale: step into a car from beside it (v3: 70). The check
  // is centre-based and cars are still 46 u long (vehicles.js, Builder A)
  // with half-width 11 — 12 m means "standing at the door" today, and
  // should drop to ~3 m once cars are rescaled to ~4.5 m long.
  const vehicle = state.playerVehicle ? null : nearestVehicle(state, 12);
  const bindings = getBindings();
  state.prompt = target
    ? t('main.prompt', { key: keyDisplay(bindings.interact), label: target.label })
    : vehicle ? t('main.prompt', { key: keyDisplay(bindings.enterVehicle), label: t('main.enterVehicle', { name: vehicle.name, kind: vehicle.kind }) }) : null;

  const hero = activeCharacter(state);
  if (hero.hp <= 0) {
    state.screen = SCREEN_OVER;
    ui.showOver(t('main.takenDown', { name: hero.name, district: state.unlocked[2] ? t('district.peaks') : state.unlocked[1] ? t('district.beach') : t('district.downtown') }));
    playSfx('wanted');
  }

  // Locked-district barrier message (v3): the player on foot is blocked by
  // world.collides inside player.js, which cannot report it — so the loop
  // notices a hero pressed against a locked wall/gate and says why.
  if (!state.playerVehicle && (input.moveX() !== 0 || input.moveY() !== 0)) {
    const bd = world.barrierDistrictAt(hero.x, hero.y, 40, state.unlocked);
    if (bd) {
      const now = (typeof performance !== 'undefined' ? performance.now() : 0) / 1000;
      if (!state.barrierMsgAt || now - state.barrierMsgAt > 4) {
        state.barrierMsgAt = now;
        showMessage(state, bd === 1 ? t('map.lockedBeach') : t('map.lockedPeaks'), 3);
      }
    }
  }
}

function runShot(name) {
  buildEntities();
  const scene = stageShot(name, state, world);
  // The map shot opens the real map panel (DOM) over the staged scene.
  if (name === 'map') mapCtl.open();
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

// --- v4 audio directors (called on a 0.25 s tick from the frame loop) -----
let audioDirTimer = 0;
let autosaveTimer = 0;
let lastMusicMode = null;
let lastAmbienceKind = null;
let lastSirenOn = false;

function updateAudioDirectors() {
  const hero = activeCharacter(state);
  const district = districtAt(hero.x, hero.y);
  // Music: the title menu has its own loop; on foot the district decides;
  // in a car the radio station decides.
  let mode = 'menu';
  if (state.screen === SCREEN_PLAY || state.screen === SCREEN_ACTIVITY) {
    mode = state.playerVehicle
      ? `radio${getRadioChannel()}`
      : district === 1 ? 'beach' : district === 2 ? 'peaks' : 'downtown';
  }
  if (mode !== lastMusicMode) {
    lastMusicMode = mode;
    setMusic(mode);
  }
  // Ambience: rain wins over everything; at night the city goes quiet
  // (night ambience + crickets) instead of the daytime traffic hum.
  const ambience = state.rain > 0.4 ? 'rain'
    : isNight(state) ? 'night'
    : district === 1 ? 'beach' : district === 2 ? 'peaks' : 'city';
  if (ambience !== lastAmbienceKind) {
    lastAmbienceKind = ambience;
    setAmbience(ambience);
  }
  // Engine: pitch follows the driven vehicle's speed (0 when on foot).
  const v = state.playerVehicle;
  setEngine(!!v, v ? Math.abs(v.speed || 0) / (v.cruise || 40) : 0);
  // Siren: wails while wanted and a police unit is close.
  let sirenOn = false;
  let sirenDist01 = 1;
  if (state.wanted > 0) {
    let best = Infinity;
    for (const p of state.police) best = Math.min(best, Math.hypot(p.x - hero.x, p.y - hero.y));
    if (best < 150) {
      sirenOn = true;
      sirenDist01 = best / 150;
    }
  }
  if (sirenOn !== lastSirenOn) {
    lastSirenOn = sirenOn;
    setSiren(sirenOn, sirenDist01);
  } else if (sirenOn) {
    setSiren(true, sirenDist01);
  }
}

function runGame() {
  buildEntities();
  input = createInput(canvas);
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
    // v4 backpack: while the bag is open the wheel cycles weapons instead
    // of zooming, and dragging does not orbit — the panel owns the input.
    const orbit = input.takeOrbit();
    if (state.backpackOpen) {
      if (orbit.wheel !== 0) {
        cycleWeapon(state, orbit.wheel > 0 ? 1 : -1);
        refreshBackpackPanel();
      }
      orbit.dx = 0;
      orbit.dy = 0;
      orbit.wheel = 0;
    }
    if (orbit.dx !== 0 || orbit.dy !== 0 || orbit.wheel !== 0) {
      // v4 Settings: camera sensitivity scales the orbit, invert Y flips it.
      const sens = settings.controls.sensitivity;
      const invert = settings.controls.invertY ? -1 : 1;
      state.camera.yaw -= orbit.dx * 0.005 * sens;
      state.camera.pitch = Math.max(
        CAMERA_PITCH_MIN,
        Math.min(CAMERA_PITCH_MAX, state.camera.pitch - orbit.dy * 0.003 * sens * invert),
      );
      state.camera.dist = Math.max(
        CAMERA_MIN_DIST,
        Math.min(CAMERA_MAX_DIST, state.camera.dist * (1 + orbit.wheel * 0.001)),
      );
    }
    // Positional audio follows the hero; the minigame overlay hides off-activity.
    const heroNow = activeCharacter(state);
    setListenerPosition(heroNow.x, heroNow.y);
    // v4: the 3D figure wears the active weapon on its back (player.js
    // reads char.weaponKey) — keep it in step with the backpack's choice.
    // v6: same for the holster state — drawn means in hand, holstered
    // means stowed on the back with empty hands.
    heroNow.weaponKey = state.weapon;
    heroNow.holstered = state.holstered;
    if (state.screen !== SCREEN_ACTIVITY) hideActivityCanvas();
    // v4: the HUD map button only shows during play.
    const wantMapBtn = state.screen === SCREEN_PLAY;
    if (wantMapBtn !== btnMapShown) {
      btnMapShown = wantMapBtn;
      if (btnMapEl) btnMapEl.style.display = wantMapBtn ? '' : 'none';
    }
    // v4: the HUD backpack button shows next to it, same rule.
    if (wantMapBtn !== btnBackpackShown) {
      btnBackpackShown = wantMapBtn;
      if (btnBackpackEl) btnBackpackEl.style.display = wantMapBtn ? '' : 'none';
    }
    // v4 audio/settings: the mute + settings HUD buttons, same rule.
    if (wantMapBtn !== btnMuteShown) {
      btnMuteShown = wantMapBtn;
      if (btnMuteEl) btnMuteEl.style.display = wantMapBtn ? '' : 'none';
    }
    if (wantMapBtn !== btnSettingsShown) {
      btnSettingsShown = wantMapBtn;
      if (btnSettingsEl) btnSettingsEl.style.display = wantMapBtn ? '' : 'none';
    }
    // v4 audio: music / ambience / engine / siren follow the world —
    // updated on a 0.25 s tick, not every frame, so the mixer is never
    // poked 60 times a second.
    audioDirTimer += elapsed;
    if (audioDirTimer >= 0.25) {
      audioDirTimer = 0;
      updateAudioDirectors();
    }
    // v4 Settings: autosave while playing (interval from Settings).
    if (state.screen === SCREEN_PLAY && settings.save.autosave) {
      autosaveTimer += elapsed;
      if (autosaveTimer >= settings.save.autosaveMinutes * 60) {
        autosaveTimer = 0;
        saveGame(state);
      }
    } else {
      autosaveTimer = 0;
    }
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
          // v5 spawn safety: a loaded hero may stand inside a building.
          window.__neonBay.lastSpawn = validateHeroSpawn(state, world);
        }
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        announce(t('main.playing'));
        // A Space/Enter tap that started the game must not also jump or
        // fire the moment play begins.
        input.clearStaleEdges();
      }
    }
    if (actions & ACTION_PAUSE) {
      if (settingsOpen) {
        // Esc / P closes Settings first — it never opens pause from behind it.
        closeSettings();
      } else if (state.showMap) {
        // Esc / P closes the map first — it never opens the pause menu
        // from behind the map.
        closeMap();
      } else if (state.backpackOpen) {
        // v4: Esc / P closes the backpack first, same as the map.
        closeBackpack();
      } else if (state.screen === SCREEN_PLAY) {
        state.screen = SCREEN_PAUSED;
        ui.showPause();
        announce(t('main.paused'));
        // The Escape/P tap that paused must not leak into play after resume.
        input.clearStaleEdges();
      } else if (state.screen === SCREEN_PAUSED) {
        state.screen = SCREEN_PLAY;
        ui.hideAll();
        announce(t('main.resumed'));
        input.clearStaleEdges();
      }
      // Any other screen (activity, shop, dialog, ...) keeps the Escape
      // in the queue: updateActivity reads it to quit the minigame.
    }

    if (state.screen === SCREEN_TITLE) {
      // Slow pan over downtown behind the title panel.
      const t = now / 1000;
      state.camera.x = 375 + Math.sin(t * 0.07) * 125;
      state.camera.y = 900 + Math.cos(t * 0.05) * 100;
      accumulator += elapsed;
      while (accumulator >= STEP) {
        updateNpcs(state, world, STEP, rng);
        accumulator -= STEP;
      }
      renderer.draw(state, world, SCREEN_TITLE, t);
      input.clearStaleEdges();
    } else if (state.screen === SCREEN_PLAY || state.screen === SCREEN_ACTIVITY) {
      // M toggles the map (open or close) from play.
      if (state.screen === SCREEN_PLAY && input.pressedAction('map')) toggleMap();
      // v4: B toggles the backpack (open or close) from play — the touch
      // BAG button raises the same edge (input.js).
      if (state.screen === SCREEN_PLAY && input.pressedAction('backpack')) toggleBackpack();
      // v4 audio: N mutes / unmutes everything; V cycles the car radio
      // while driving (the station name toasts).
      if (input.pressedAction('mute')) toggleMute();
      if (state.screen === SCREEN_PLAY && state.playerVehicle && input.pressedAction('radio')) {
        const station = cycleRadio();
        playSfx('click');
        showMessage(state, t('main.radio', { station }));
      }
      if (state.showMap || state.backpackOpen) {
        // The map / backpack is open: the world is truly paused — no
        // stepping, no clock, no movement. The frame only paints the
        // frozen scene behind the DOM panel, and drops any input that
        // arrives. Digits still switch weapons while the bag is open.
        accumulator = 0;
        input.takeOrbit();
        if (state.backpackOpen) {
          for (let i = 0; i < WEAPON_ORDER.length; i += 1) {
            if (input.pressed(`Digit${i + 1}`)) {
              if (switchWeapon(state, WEAPON_ORDER[i])) refreshBackpackPanel();
            }
          }
          // v6: H holsters / draws while the bag is open too (the panel
          // has its own button for the same action).
          if (input.pressedAction('holster')) {
            toggleHolster(state);
            refreshBackpackPanel();
          }
        }
        input.clearStaleEdges();
        input.endFrame();
        renderer.draw(state, world, state.screen, now / 1000);
      } else {
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
      }
    } else {
      accumulator = 0;
      renderer.draw(state, world, state.screen, now / 1000);
      input.clearStaleEdges();
    }

    if (state.message && state.message !== lastToast && state.messageTimer > 0) {
      lastToast = state.message;
      ui.showToast(state.message, state.messageTimer);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN_PLAY) {
      state.screen = SCREEN_PAUSED;
      ui.showPause();
      announce(t('main.paused'));
    }
  });

  announce(t('main.titleHint'));
  requestAnimationFrame(frame);
}

// Debug hook for automated play-testing (read-only from the page's own tests).
window.__neonBay = {
  get state() { return state; },
  // Project a screen point to the ground plane (renderer raycast) — the
  // same projection the shooting aim uses, exposed for tests/debugging.
  screenToGround(x, y) {
    return (renderer && typeof renderer.screenToGround === 'function')
      ? renderer.screenToGround(x, y) : null;
  },
  get fps() { return fpsValue; },
  world,
  seed,
  map: {
    open: openMap,
    close: closeMap,
    toggle: toggleMap,
    get showMap() { return state.showMap; },
    get nav() { return state.nav; },
    destinations: () => getDestinations(state, world),
    setDestination: (id) => {
      const dest = getDestinations(state, world).find((d) => d.id === id);
      if (!dest) return { ok: false, reason: 'notfound' };
      return setDestination(state, world, dest);
    },
    setRoadDestination: (x, y) => setDestination(state, world, { id: 'road', kind: 'road', label: 'Road point', x, y }),
    clearNav: () => clearNav(state),
    remaining: () => navRemaining(state),
    pickAt: (x, y) => mapCtl.pickAt(x, y),
    get view() { return mapCtl.view; },
  },
  startMission: (i) => startMainMission(state, i),
  // v4 backpack debug API for automated tests (read-only except select).
  backpack: {
    open: openBackpack,
    close: closeBackpack,
    toggle: toggleBackpack,
    get isOpen() { return state.backpackOpen; },
    items: () => backpackItems(state),
    select: (key) => {
      const ok = switchWeapon(state, key);
      if (ok) refreshBackpackPanel();
      return ok;
    },
    cycle: (dir) => {
      const key = cycleWeapon(state, dir);
      refreshBackpackPanel();
      return key;
    },
  },
  // v6 holster debug API for automated tests: toggle / read the
  // drawn-vs-holstered carry state, and draw explicitly.
  holster: {
    get isHolstered() { return !!state.holstered; },
    toggle: () => {
      const v = toggleHolster(state);
      refreshBackpackPanel();
      return v;
    },
    draw: () => { state.holstered = false; return false; },
  },
  // v4 audio debug API (Tone.js engine, buses, loops, music, radio).
  audio: {
    state: () => getAudioState(),
    setMusic: (mode) => setMusic(mode),
    setAmbience: (kind) => setAmbience(kind),
    setEngine: (on, speed01) => setEngine(on, speed01),
    setSiren: (on, dist01) => setSiren(on, dist01),
    test: (cat) => playTest(cat),
    toggleMute,
    cycleRadio: () => cycleRadio(),
  },
  // v4 settings debug API (read-only except apply/reset).
  settings: {
    get: () => JSON.parse(JSON.stringify(settings)),
    apply: (patch) => {
      settings = mergeSettingsPatch(patch);
      persistSettings();
      applySettings();
      return settings;
    },
    open: openSettings,
    close: closeSettings,
    get isOpen() { return settingsOpen; },
    slots: () => listSaveSlots(),
  },
  // v5 spawn debug API (Builder A): move the hero to (x, y), validate
  // the spawn exactly as New Game / Continue / respawn do, and report
  // where he landed. Test-only — it mutates the hero position.
  spawn: {
    validate: (x, y) => {
      const hero = activeCharacter(state);
      hero.x = x;
      hero.y = y;
      const res = validateHeroSpawn(state, world);
      return { ...res, collides: world.collides(res.x, res.y, 0.4, state.unlocked) };
    },
    get last() { return window.__neonBay.lastSpawn || null; },
  },
  // Cross-builder hook registry (Builders A/B assign their hooks here).
  hooks: window.__neonBayHooks,
};

function mergeSettingsPatch(patch) {
  // Deep-merge a partial patch onto the live settings, then run the
  // result through the validator (clamps + whitelists) from state.js.
  const merged = JSON.parse(JSON.stringify(settings));
  const deep = (dst, src) => {
    for (const [k, v] of Object.entries(src || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') deep(dst[k], v);
      else dst[k] = v;
    }
  };
  deep(merged, patch);
  return validateSettings(merged);
}

if (shot) runShot(shot);
else runGame();
