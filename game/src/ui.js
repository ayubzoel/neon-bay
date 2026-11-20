// Neon Bay — the DOM panels: start screen, pause, game over, shops,
// dialogues, the safe-house interior, wardrobe, garage, backpack and the
// v4 Settings menu. The canvas draws the world; these panels are the
// menus and the shop counters.
//
// v4 (Builder C): the backpack panel — Leo's weapon bag. Every owned
// weapon with its own magazine + reserve ammo, one row per kind, click
// (or the 1–6 keys, or the mouse wheel) to equip.
//
// v4 i18n: every string this module renders — panel titles, buttons,
// shop rows, backpack rows, the Settings menu, and the static HTML
// strings (index.html carries data-i18n="key" for those) — is registered
// here in English + Bahasa Indonesia and rendered through t(). Nothing
// user-facing is hardcoded in this file.
import { addStrings, getLang, onLangChange, t } from './i18n.js';
import { REBINDABLE_ACTIONS } from './input.js';

const PANELS = ['startScreen', 'pauseMenu', 'overScreen', 'shopPanel', 'dialogPanel', 'interiorPanel', 'wardrobePanel', 'garagePanel', 'backpackPanel', 'settingsPanel'];

// --- Strings -------------------------------------------------------------
addStrings('en', {
  // Static HTML (index.html, via data-i18n / data-i18n-html).
  'menu.subtitle': 'AN OPEN-WORLD CRIME STORY — DOWNTOWN · SUNSET BEACH · CINDER PEAKS',
  'menu.intro1': 'Leo Vance came to Neon Bay with empty pockets and big plans. Sixty main missions stand between him and the top of the city — and two locked districts, a five-star police force, and everyone who wants him gone. His old friend Maya waits by the Neon Diner with a lead.',
  'menu.intro2': 'Drive, swim, fly, race, play pool and golf, run shops, steal, and survive. One man, one city, no backup.',
  'menu.newGame': 'New Game',
  'menu.continue': 'Continue',
  'menu.howTo': 'How to Play',
  'menu.settings': 'Settings',
  'menu.howHtml': '<b>WASD / Arrows</b> move · <b>Mouse</b> aim · <b>Click</b> shoot · <b>E</b> interact / talk · <b>F</b> enter or exit a vehicle · <b>R</b> reload · <b>Q</b> pickpocket · <b>Shift</b> run · <b>Space</b> jump · <b>1–6</b> weapons · <b>B</b> backpack · <b>Scroll</b> cycle weapon (when the backpack is open) · <b>M</b> map · <b>N</b> mute · <b>V</b> radio station · <b>Esc</b> pause.<br>Drag mouse to orbit the camera, scroll to zoom. On phones: left stick to move, on-screen buttons to shoot, enter, interact and run.',
  'pause.title': 'Paused',
  'pause.text': 'Neon Bay waits for no one — except right now.',
  'pause.resume': 'Resume',
  'pause.save': 'Save Game',
  'pause.quit': 'Quit to Title',
  'over.title': 'Wasted',
  'over.respawn': 'Respawn at the Safe House ($100)',
  'over.quit': 'Quit to Title',
  'shop.leave': 'Leave',
  'interior.title': 'Safe House',
  'interior.text': 'Home sweet home. Change your look, check the garage, rest up.',
  'interior.wardrobe': 'Wardrobe — change clothes',
  'interior.garage': 'Garage — stored cars',
  'interior.sleep': 'Sleep — heal up & save',
  'interior.leave': 'Leave the safe house',
  'wardrobe.title': 'Wardrobe',
  'wardrobe.text': 'Your outfit shows on your character in the streets.',
  'wardrobe.done': 'Done',
  'garage.title': 'Garage',
  'garage.text': 'Cars you parked here. Pick one to take out.',
  'garage.done': 'Done',
  'backpack.close': 'Close (B)',
  'hud.map': '🗺️ Map — M',
  'hud.backpack': '🎒 Backpack — B',
  'hud.muteOn': '🔊 Sound — N',
  'hud.muteOff': '🔇 Muted — N',
  'map.close': 'Close ✕ (M)',
  'map.destTitle': 'Destinations',
  'map.legendTitle': 'Legend',
  'map.hint': 'Scroll / pinch to zoom · drag to pan · click a place or a road to set GPS. Grey districts are locked — finish the mission to open them. The game is paused while the map is open.',
  'map.cancelNav': 'Cancel navigation',
  'touch.fire': 'FIRE',
  'touch.enter': 'CAR',
  'touch.run': 'RUN',
  'touch.map': 'MAP',
  'touch.backpack': 'BAG',
  // Dynamic panel strings.
  'shop.cash': 'Your cash: ${money}',
  'shop.owned': 'Owned',
  'shop.wear': 'Wear',
  'shop.wearing': 'Wearing',
  'garage.empty': 'No cars stored. Drive a car to the safe house and press G to park it.',
  'garage.takeOut': 'Take out',
  'garage.condition': 'Condition {hp}%',
  'wardrobe.everyday': 'Everyday look',
  'wardrobe.fresh': 'A fresh {name} look',
  'backpack.title': 'Backpack — {owned} / {capacity} weapons',
  'backpack.hint': 'Click a weapon to equip it · keys 1–6 switch · mouse wheel cycles · B closes',
  'backpack.inHand': ' — in hand',
  'backpack.noAmmo': 'Damage {damage} · no ammo needed',
  'backpack.ammo': 'Damage {damage} · Mag {mag}/{magSize} · Reserve {ammo} rounds',
  'backpack.notOwned': 'Not owned — buy at Ironworks Arms for ${price}',
  'backpack.equip': 'Equip',
  'backpack.locked': 'Locked',
  'backpack.inHandBtn': 'In hand',
  'ui.orbitHint': 'Drag mouse to orbit the camera — scroll to zoom.',
  'ui.dialogDefault': 'Nice talking to you.',
  // Settings menu.
  'settings.title': 'Settings',
  'settings.close': 'Close',
  'settings.savedAuto': 'Settings save automatically and apply right away — no restart needed.',
  'settings.section.save': 'Save Data',
  'settings.section.audio': 'Audio',
  'settings.section.controls': 'Controls',
  'settings.section.other': 'Other',
  'settings.slot': 'Slot {n}',
  'settings.slot.save': 'Save',
  'settings.slot.load': 'Load',
  'settings.slot.delete': 'Delete',
  'settings.slot.export': 'Export',
  'settings.slot.import': 'Import',
  'settings.slot.savedOn': 'Saved {date}',
  'settings.slot.empty': 'Empty slot',
  'settings.autosave': 'Autosave',
  'settings.autosaveInterval': 'Autosave every',
  'settings.autosaveMin': '{n} min',
  'settings.resetProgress': 'Reset progress (delete all saves)',
  'settings.confirmAgain': 'Click again to confirm',
  'settings.resetDone': 'Progress reset — all saves deleted.',
  'settings.audio.master': 'Master volume',
  'settings.audio.music': 'Music',
  'settings.audio.sfx': 'Sound effects',
  'settings.audio.ambience': 'Ambience',
  'settings.audio.vehicle': 'Vehicles',
  'settings.audio.mute': 'Mute',
  'settings.audio.test': 'Test',
  'settings.audio.presetSilent': 'Silent',
  'settings.audio.presetNormal': 'Normal',
  'settings.audio.presetLoud': 'Loud',
  'settings.controls.moveUp': 'Move forward',
  'settings.controls.moveDown': 'Move back',
  'settings.controls.moveLeft': 'Move left',
  'settings.controls.moveRight': 'Move right',
  'settings.controls.jump': 'Jump',
  'settings.controls.run': 'Run (hold)',
  'settings.controls.interact': 'Interact / talk',
  'settings.controls.enterVehicle': 'Enter / exit vehicle',
  'settings.controls.reload': 'Reload',
  'settings.controls.pickpocket': 'Pickpocket',
  'settings.controls.park': 'Park car (safe house)',
  'settings.controls.backpack': 'Backpack',
  'settings.controls.map': 'Map',
  'settings.controls.pause': 'Pause',
  'settings.controls.mute': 'Mute / unmute',
  'settings.controls.radio': 'Next radio station',
  'settings.controls.fire': 'Shoot (mouse click)',
  'settings.controls.weapons': 'Weapons 1–6',
  'settings.controls.fixed': 'fixed',
  'settings.pressKey': 'Press a key… (Esc cancels)',
  'settings.keyTaken': 'That key is already used by {action}.',
  'settings.sensitivity': 'Camera sensitivity',
  'settings.invertY': 'Invert camera Y',
  'settings.touchSize': 'Touch controls size',
  'settings.touchSize.small': 'Small',
  'settings.touchSize.normal': 'Normal',
  'settings.touchSize.large': 'Large',
  'settings.vibration': 'Vibration on phone',
  'settings.resetBindings': 'Reset controls to default',
  'settings.graphics.quality': 'Graphics quality',
  'settings.graphics.low': 'Low',
  'settings.graphics.medium': 'Medium',
  'settings.graphics.high': 'High',
  'settings.language': 'Language',
  'settings.language.en': 'English',
  'settings.language.id': 'Bahasa Indonesia',
  'settings.dayNight': 'Day / night',
  'settings.dayNight.auto': 'Automatic',
  'settings.dayNight.day': 'Day',
  'settings.dayNight.night': 'Night',
  'settings.weather': 'Weather',
  'settings.weather.auto': 'Automatic',
  'settings.weather.clear': 'Clear',
  'settings.weather.rain': 'Rain',
  'settings.showHud': 'Show HUD',
  'settings.showMinimap': 'Show minimap',
  'settings.resetAll': 'Reset all settings to default',
});
addStrings('id', {
  'menu.subtitle': 'KISAH KRIMINAL DUNIA TERBUKA — DOWNTOWN · SUNSET BEACH · CINDER PEAKS',
  'menu.intro1': 'Leo Vance datang ke Neon Bay dengan kantong kosong dan rencana besar. Enam puluh misi utama berdiri antara dia dan puncak kota — ditambah dua wilayah terkunci, polisi bintang lima, dan semua orang yang ingin menyingkirkannya. Teman lamanya Maya menunggu di Neon Diner dengan sebuah petunjuk.',
  'menu.intro2': 'Berkendara, berenang, terbang, balapan, main biliar dan golf, kelola toko, mencuri, dan bertahan hidup. Satu orang, satu kota, tanpa bantuan.',
  'menu.newGame': 'Game Baru',
  'menu.continue': 'Lanjutkan',
  'menu.howTo': 'Cara Bermain',
  'menu.settings': 'Pengaturan',
  'menu.howHtml': '<b>WASD / Panah</b> bergerak · <b>Mouse</b> membidik · <b>Klik</b> menembak · <b>E</b> interaksi / bicara · <b>F</b> masuk atau keluar kendaraan · <b>R</b> isi ulang · <b>Q</b> copet · <b>Shift</b> lari · <b>Spasi</b> lompat · <b>1–6</b> senjata · <b>B</b> tas · <b>Scroll</b> ganti senjata (saat tas terbuka) · <b>M</b> peta · <b>N</b> bisukan · <b>V</b> stasiun radio · <b>Esc</b> jeda.<br>Seret mouse untuk memutar kamera, scroll untuk zoom. Di HP: stik kiri untuk bergerak, tombol layar untuk menembak, masuk, interaksi, dan lari.',
  'pause.title': 'Jeda',
  'pause.text': 'Neon Bay tidak menunggu siapa pun — kecuali sekarang.',
  'pause.resume': 'Lanjutkan',
  'pause.save': 'Simpan Game',
  'pause.quit': 'Keluar ke Menu Utama',
  'over.title': 'Tewas',
  'over.respawn': 'Bangkit di Safe House ($100)',
  'over.quit': 'Keluar ke Menu Utama',
  'shop.leave': 'Pergi',
  'interior.title': 'Safe House',
  'interior.text': 'Rumahku surgaku. Ganti penampilan, cek garasi, istirahat.',
  'interior.wardrobe': 'Lemari — ganti pakaian',
  'interior.garage': 'Garasi — mobil tersimpan',
  'interior.sleep': 'Tidur — pulihkan HP & simpan',
  'interior.leave': 'Keluar dari safe house',
  'wardrobe.title': 'Lemari Pakaian',
  'wardrobe.text': 'Pakaianmu terlihat di karaktermu di jalanan.',
  'wardrobe.done': 'Selesai',
  'garage.title': 'Garasi',
  'garage.text': 'Mobil yang kamu parkir di sini. Pilih satu untuk dikeluarkan.',
  'garage.done': 'Selesai',
  'backpack.close': 'Tutup (B)',
  'hud.map': '🗺️ Peta — M',
  'hud.backpack': '🎒 Tas — B',
  'hud.muteOn': '🔊 Suara — N',
  'hud.muteOff': '🔇 Bisukan — N',
  'map.close': 'Tutup ✕ (M)',
  'map.destTitle': 'Destinasi',
  'map.legendTitle': 'Legenda',
  'map.hint': 'Scroll / cubit untuk zoom · seret untuk geser · klik tempat atau jalan untuk mengatur GPS. Wilayah abu-abu terkunci — selesaikan misi untuk membukanya. Game dijeda saat peta terbuka.',
  'map.cancelNav': 'Batalkan navigasi',
  'touch.fire': 'TEMBAK',
  'touch.enter': 'MOBIL',
  'touch.run': 'LARI',
  'touch.map': 'PETA',
  'touch.backpack': 'TAS',
  'shop.cash': 'Uangmu: ${money}',
  'shop.owned': 'Dimiliki',
  'shop.wear': 'Pakai',
  'shop.wearing': 'Dipakai',
  'garage.empty': 'Tidak ada mobil tersimpan. Bawa mobil ke safe house dan tekan G untuk memarkirnya.',
  'garage.takeOut': 'Keluarkan',
  'garage.condition': 'Kondisi {hp}%',
  'wardrobe.everyday': 'Penampilan sehari-hari',
  'wardrobe.fresh': 'Penampilan {name} yang segar',
  'backpack.title': 'Tas — {owned} / {capacity} senjata',
  'backpack.hint': 'Klik senjata untuk menggunakannya · tombol 1–6 mengganti · roda mouse menggilir · B menutup',
  'backpack.inHand': ' — di tangan',
  'backpack.noAmmo': 'Damage {damage} · tanpa amunisi',
  'backpack.ammo': 'Damage {damage} · Mag {mag}/{magSize} · Cadangan {ammo} peluru',
  'backpack.notOwned': 'Belum dimiliki — beli di Ironworks Arms seharga ${price}',
  'backpack.equip': 'Pakai',
  'backpack.locked': 'Terkunci',
  'backpack.inHandBtn': 'Di tangan',
  'ui.orbitHint': 'Seret mouse untuk memutar kamera — scroll untuk zoom.',
  'ui.dialogDefault': 'Senang bicara denganmu.',
  'settings.title': 'Pengaturan',
  'settings.close': 'Tutup',
  'settings.savedAuto': 'Pengaturan tersimpan otomatis dan langsung berlaku — tanpa restart.',
  'settings.section.save': 'Data Save',
  'settings.section.audio': 'Audio',
  'settings.section.controls': 'Kontrol',
  'settings.section.other': 'Lainnya',
  'settings.slot': 'Slot {n}',
  'settings.slot.save': 'Simpan',
  'settings.slot.load': 'Muat',
  'settings.slot.delete': 'Hapus',
  'settings.slot.export': 'Ekspor',
  'settings.slot.import': 'Impor',
  'settings.slot.savedOn': 'Disimpan {date}',
  'settings.slot.empty': 'Slot kosong',
  'settings.autosave': 'Autosave',
  'settings.autosaveInterval': 'Autosave setiap',
  'settings.autosaveMin': '{n} mnt',
  'settings.resetProgress': 'Reset progres (hapus semua save)',
  'settings.confirmAgain': 'Klik lagi untuk konfirmasi',
  'settings.resetDone': 'Progres direset — semua save dihapus.',
  'settings.audio.master': 'Volume utama',
  'settings.audio.music': 'Musik',
  'settings.audio.sfx': 'Efek suara',
  'settings.audio.ambience': 'Ambiens',
  'settings.audio.vehicle': 'Kendaraan',
  'settings.audio.mute': 'Bisukan',
  'settings.audio.test': 'Tes',
  'settings.audio.presetSilent': 'Hening',
  'settings.audio.presetNormal': 'Normal',
  'settings.audio.presetLoud': 'Keras',
  'settings.controls.moveUp': 'Maju',
  'settings.controls.moveDown': 'Mundur',
  'settings.controls.moveLeft': 'Kiri',
  'settings.controls.moveRight': 'Kanan',
  'settings.controls.jump': 'Lompat',
  'settings.controls.run': 'Lari (tahan)',
  'settings.controls.interact': 'Interaksi / bicara',
  'settings.controls.enterVehicle': 'Masuk / keluar kendaraan',
  'settings.controls.reload': 'Isi ulang',
  'settings.controls.pickpocket': 'Copet',
  'settings.controls.park': 'Parkir mobil (safe house)',
  'settings.controls.backpack': 'Tas',
  'settings.controls.map': 'Peta',
  'settings.controls.pause': 'Jeda',
  'settings.controls.mute': 'Bisukan / bunyikan',
  'settings.controls.radio': 'Stasiun radio berikutnya',
  'settings.controls.fire': 'Tembak (klik mouse)',
  'settings.controls.weapons': 'Senjata 1–6',
  'settings.controls.fixed': 'tetap',
  'settings.pressKey': 'Tekan tombol… (Esc batal)',
  'settings.keyTaken': 'Tombol itu sudah dipakai oleh {action}.',
  'settings.sensitivity': 'Sensitivitas kamera',
  'settings.invertY': 'Balik sumbu Y kamera',
  'settings.touchSize': 'Ukuran kontrol sentuh',
  'settings.touchSize.small': 'Kecil',
  'settings.touchSize.normal': 'Normal',
  'settings.touchSize.large': 'Besar',
  'settings.vibration': 'Getar di HP',
  'settings.resetBindings': 'Reset kontrol ke default',
  'settings.graphics.quality': 'Kualitas grafis',
  'settings.graphics.low': 'Rendah',
  'settings.graphics.medium': 'Sedang',
  'settings.graphics.high': 'Tinggi',
  'settings.language': 'Bahasa',
  'settings.language.en': 'English',
  'settings.language.id': 'Bahasa Indonesia',
  'settings.dayNight': 'Siang / malam',
  'settings.dayNight.auto': 'Otomatis',
  'settings.dayNight.day': 'Siang',
  'settings.dayNight.night': 'Malam',
  'settings.weather': 'Cuaca',
  'settings.weather.auto': 'Otomatis',
  'settings.weather.clear': 'Cerah',
  'settings.weather.rain': 'Hujan',
  'settings.showHud': 'Tampilkan HUD',
  'settings.showMinimap': 'Tampilkan minimap',
  'settings.resetAll': 'Reset semua pengaturan ke default',
});

/** Short display name for a KeyboardEvent.code ('KeyW' → 'W', 'Space' → 'Space'). */
export function keyDisplay(code) {
  if (!code) return '—';
  const arrows = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
  if (code in arrows) return arrows[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
  if (code === 'Escape') return 'Esc';
  return code;
}

function $(id) {
  return document.getElementById(id);
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = text;
  return n;
}

export function createUI(handlers) {
  const toast = $('toast');
  let toastTimer = 0;
  let orbitHintShown = false;
  // Last settings view, so a language switch can re-render the open panel.
  let lastSettingsView = null;

  function showPanel(name) {
    for (const id of PANELS) $(id).classList.toggle('hidden', id !== name);
  }
  function hideAll() {
    for (const id of PANELS) $(id).classList.add('hidden');
    lastSettingsView = null;
  }

  function bind(id, fn) {
    const el2 = $(id);
    if (el2) el2.addEventListener('click', fn);
  }
  bind('btnNew', () => handlers.onNewGame());
  bind('btnContinue', () => handlers.onContinue());
  bind('btnHow', () => {
    const how = $('howText');
    how.hidden = !how.hidden;
  });
  bind('btnSettings', () => handlers.onOpenSettings && handlers.onOpenSettings());
  bind('btnSettingsPause', () => handlers.onOpenSettings && handlers.onOpenSettings());
  bind('btnResume', () => handlers.onResume());
  bind('btnSave', () => handlers.onSave());
  bind('btnQuitTitle', () => handlers.onQuitTitle());
  bind('btnRespawn', () => handlers.onRespawn());
  bind('btnOverTitle', () => handlers.onQuitTitle());
  bind('btnCloseShop', () => handlers.onCloseShop());
  bind('btnWardrobe', () => handlers.onWardrobeOpen());
  bind('btnGarage', () => handlers.onGarageOpen());
  bind('btnSleep', () => handlers.onSleep());
  bind('btnLeaveHouse', () => handlers.onLeaveHouse());
  bind('btnCloseWardrobe', () => handlers.onWardrobeClose());
  bind('btnCloseGarage', () => handlers.onGarageClose());
  bind('btnCloseBackpack', () => handlers.onBackpackClose());
  bind('btnCloseSettings', () => handlers.onCloseSettings && handlers.onCloseSettings());

  // Re-render the open Settings panel when the language changes.
  onLangChange(() => {
    if (lastSettingsView) showSettings(lastSettingsView);
  });

  // --- Settings panel builders -------------------------------------------
  function section(titleKey) {
    const h = el('h3', 'settings-section', t(titleKey));
    return h;
  }
  function row(labelText) {
    const r = el('div', 'settings-row');
    r.appendChild(el('span', 'settings-label', labelText));
    return r;
  }
  function sliderRow(labelText, value01, onInput, opts = {}) {
    const r = row(labelText);
    const wrap = el('span', 'settings-control');
    const input = document.createElement('input');
    input.type = 'range';
    input.min = opts.min !== undefined ? String(opts.min) : '0';
    input.max = opts.max !== undefined ? String(opts.max) : '100';
    input.step = opts.step !== undefined ? String(opts.step) : '1';
    input.value = String(opts.min !== undefined ? value01 : Math.round(value01 * 100));
    input.setAttribute('aria-label', labelText);
    const val = el('span', 'settings-value', opts.format ? opts.format(value01) : `${Math.round(value01 * 100)}%`);
    input.addEventListener('input', () => {
      const v = opts.min !== undefined ? Number(input.value) : Number(input.value) / 100;
      val.textContent = opts.format ? opts.format(v) : `${Math.round(v * 100)}%`;
      onInput(v);
    });
    wrap.appendChild(input);
    wrap.appendChild(val);
    r.appendChild(wrap);
    return r;
  }
  function checkRow(labelText, checked, onChange) {
    const r = row(labelText);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.setAttribute('aria-label', labelText);
    input.addEventListener('change', () => onChange(input.checked));
    const wrap = el('span', 'settings-control');
    wrap.appendChild(input);
    r.appendChild(wrap);
    return r;
  }
  function selectRow(labelText, value, options, onChange) {
    const r = row(labelText);
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', labelText);
    for (const [v, label] of options) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = label;
      if (v === value) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener('change', () => onChange(sel.value));
    const wrap = el('span', 'settings-control');
    wrap.appendChild(sel);
    r.appendChild(wrap);
    return r;
  }
  function smallButton(text, onClick, className) {
    const b = el('button', 'btn small' + (className ? ` ${className}` : ''), text);
    b.addEventListener('click', onClick);
    return b;
  }
  /** Two-click confirm for destructive buttons: first click arms, second fires. */
  function armConfirm(button, fn) {
    let armed = false;
    let timer = 0;
    const original = button.textContent;
    button.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        button.textContent = t('settings.confirmAgain');
        button.classList.add('danger');
        timer = setTimeout(() => {
          armed = false;
          button.textContent = original;
          button.classList.remove('danger');
        }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      button.textContent = original;
      button.classList.remove('danger');
      fn();
    });
  }

  function showSettings(view) {
    lastSettingsView = view;
    const s = view.settings;
    const h = view.handlers;
    const body = $('settingsBody');
    body.innerHTML = '';
    const locale = getLang() === 'id' ? 'id-ID' : 'en-US';

    // --- Save Data ---
    body.appendChild(section('settings.section.save'));
    for (const slot of view.slots) {
      const r = el('div', 'settings-row settings-slot-row');
      const left = el('div');
      left.appendChild(el('div', 'name', t('settings.slot', { n: slot.slot })));
      const meta = el('div', 'desc', slot.has
        ? `${slot.date ? t('settings.slot.savedOn', { date: slot.date.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : ''} · ${t('save.slot.meta', { missions: slot.missions, money: slot.money, district: slot.district })}`
        : t('settings.slot.empty'));
      left.appendChild(meta);
      r.appendChild(left);
      const btns = el('div', 'settings-buttons');
      btns.appendChild(smallButton(t('settings.slot.save'), () => h.onSlotSave(slot.slot)));
      const loadBtn = smallButton(t('settings.slot.load'), () => h.onSlotLoad(slot.slot));
      loadBtn.disabled = !slot.has;
      btns.appendChild(loadBtn);
      const delBtn = smallButton(t('settings.slot.delete'), () => h.onSlotDelete(slot.slot));
      delBtn.disabled = !slot.has;
      btns.appendChild(delBtn);
      const expBtn = smallButton(t('settings.slot.export'), () => h.onSlotExport(slot.slot));
      expBtn.disabled = !slot.has;
      btns.appendChild(expBtn);
      btns.appendChild(smallButton(t('settings.slot.import'), () => h.onSlotImport(slot.slot)));
      r.appendChild(btns);
      body.appendChild(r);
    }
    body.appendChild(checkRow(t('settings.autosave'), s.save.autosave, (v) => h.onChange('save.autosave', v)));
    body.appendChild(selectRow(t('settings.autosaveInterval'), String(s.save.autosaveMinutes),
      [1, 2, 5, 10, 15, 30].map((n) => [String(n), t('settings.autosaveMin', { n })]),
      (v) => h.onChange('save.autosaveMinutes', Number(v))));
    const resetProgressBtn = smallButton(t('settings.resetProgress'), () => {}, 'danger');
    armConfirm(resetProgressBtn, () => h.onResetProgress());
    body.appendChild(resetProgressBtn);

    // --- Audio ---
    body.appendChild(section('settings.section.audio'));
    const audioCats = [
      ['master', 'settings.audio.master'],
      ['music', 'settings.audio.music'],
      ['sfx', 'settings.audio.sfx'],
      ['ambience', 'settings.audio.ambience'],
      ['vehicle', 'settings.audio.vehicle'],
    ];
    for (const [cat, labelKey] of audioCats) {
      const r = sliderRow(t(labelKey), s.audio[cat], (v) => h.onChange(`audio.${cat}`, v));
      const muteBox = document.createElement('input');
      muteBox.type = 'checkbox';
      muteBox.checked = cat === 'master' ? !!s.audio.muted : !!s.audio.mutedCategories[cat];
      muteBox.title = t('settings.audio.mute');
      muteBox.setAttribute('aria-label', t('settings.audio.mute'));
      muteBox.addEventListener('change', () => {
        h.onChange(cat === 'master' ? 'audio.muted' : `audio.mutedCategories.${cat}`, muteBox.checked);
      });
      const testBtn = smallButton(t('settings.audio.test'), () => h.onTestSound(cat));
      const wrap = el('span', 'settings-control');
      wrap.appendChild(muteBox);
      wrap.appendChild(testBtn);
      r.appendChild(wrap);
      body.appendChild(r);
    }
    const presetRow = el('div', 'settings-row');
    presetRow.appendChild(el('span', 'settings-label', ''));
    const presetBtns = el('div', 'settings-buttons');
    presetBtns.appendChild(smallButton(t('settings.audio.presetSilent'), () => h.onPreset('silent')));
    presetBtns.appendChild(smallButton(t('settings.audio.presetNormal'), () => h.onPreset('normal')));
    presetBtns.appendChild(smallButton(t('settings.audio.presetLoud'), () => h.onPreset('loud')));
    presetRow.appendChild(presetBtns);
    body.appendChild(presetRow);

    // --- Controls ---
    body.appendChild(section('settings.section.controls'));
    const bindings = view.bindings || {};
    for (const action of REBINDABLE_ACTIONS) {
      const r = row(t(`settings.controls.${action}`));
      const btn = smallButton(
        view.rebinding === action ? t('settings.pressKey') : keyDisplay(bindings[action]),
        () => h.onRebind(action),
      );
      btn.classList.add('keybind-btn');
      if (view.rebinding === action) btn.classList.add('capturing');
      const wrap = el('span', 'settings-control');
      wrap.appendChild(btn);
      r.appendChild(wrap);
      body.appendChild(r);
    }
    // Fixed (non-rebindable) rows, shown for reference.
    for (const [action, labelKey] of [['fire', 'settings.controls.fire'], ['weapons', 'settings.controls.weapons']]) {
      const r = row(`${t(labelKey)} (${t('settings.controls.fixed')})`);
      const fixed = el('span', 'settings-value', action === 'fire' ? 'Click' : '1–6');
      const wrap = el('span', 'settings-control');
      wrap.appendChild(fixed);
      r.appendChild(wrap);
      body.appendChild(r);
    }
    body.appendChild(sliderRow(t('settings.sensitivity'), s.controls.sensitivity, (v) => h.onChange('controls.sensitivity', v),
      { min: 0.3, max: 2.5, step: 0.1, format: (v) => `×${Number(v).toFixed(1)}` }));
    body.appendChild(checkRow(t('settings.invertY'), s.controls.invertY, (v) => h.onChange('controls.invertY', v)));
    body.appendChild(selectRow(t('settings.touchSize'), s.controls.touchSize,
      [['small', t('settings.touchSize.small')], ['normal', t('settings.touchSize.normal')], ['large', t('settings.touchSize.large')]],
      (v) => h.onChange('controls.touchSize', v)));
    body.appendChild(checkRow(t('settings.vibration'), s.controls.vibration, (v) => h.onChange('controls.vibration', v)));
    body.appendChild(smallButton(t('settings.resetBindings'), () => h.onResetBindings()));

    // --- Other ---
    body.appendChild(section('settings.section.other'));
    body.appendChild(selectRow(t('settings.graphics.quality'), s.graphics.quality,
      [['low', t('settings.graphics.low')], ['medium', t('settings.graphics.medium')], ['high', t('settings.graphics.high')]],
      (v) => h.onChange('graphics.quality', v)));
    body.appendChild(selectRow(t('settings.language'), getLang(),
      [['en', t('settings.language.en')], ['id', t('settings.language.id')]],
      (v) => h.onLanguage(v)));
    body.appendChild(selectRow(t('settings.dayNight'), s.time.dayNight,
      [['auto', t('settings.dayNight.auto')], ['day', t('settings.dayNight.day')], ['night', t('settings.dayNight.night')]],
      (v) => h.onChange('time.dayNight', v)));
    body.appendChild(selectRow(t('settings.weather'), s.time.weather,
      [['auto', t('settings.weather.auto')], ['clear', t('settings.weather.clear')], ['rain', t('settings.weather.rain')]],
      (v) => h.onChange('time.weather', v)));
    body.appendChild(checkRow(t('settings.showHud'), s.graphics.showHud, (v) => h.onChange('graphics.showHud', v)));
    body.appendChild(checkRow(t('settings.showMinimap'), s.graphics.showMinimap, (v) => h.onChange('graphics.showMinimap', v)));
    const resetAllBtn = smallButton(t('settings.resetAll'), () => {}, 'danger');
    armConfirm(resetAllBtn, () => h.onResetSettings());
    body.appendChild(resetAllBtn);

    const note = el('p', 'settings-note', t('settings.savedAuto'));
    body.appendChild(note);
    showPanel('settingsPanel');
  }

  return {
    showPanel,
    hideAll,
    showStart(hasSave) {
      showPanel('startScreen');
      $('btnContinue').style.display = hasSave ? 'block' : 'none';
    },
    showPause() {
      showPanel('pauseMenu');
    },
    showOver(text) {
      $('overText').textContent = text;
      showPanel('overScreen');
    },
    showSettings,
    showShop(kind, title, items, money) {
      $('shopTitle').textContent = title;
      $('shopMoney').textContent = t('shop.cash', { money: money.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US') });
      const list = $('shopItems');
      list.innerHTML = '';
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'shop-item';
        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = item.name;
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = item.desc;
        left.appendChild(name);
        left.appendChild(desc);
        const buy = document.createElement('button');
        buy.className = 'btn buy';
        buy.textContent = item.owned ? t('shop.owned') : `$${item.price}`;
        buy.disabled = item.owned || money < item.price;
        buy.addEventListener('click', () => handlers.onBuy(kind, item.id));
        row.appendChild(left);
        row.appendChild(buy);
        list.appendChild(row);
      }
      showPanel('shopPanel');
    },
    showDialog(speaker, text, options = []) {
      $('dialogSpeaker').textContent = speaker;
      $('dialogText').textContent = text;
      const box = $('dialogOptions');
      box.innerHTML = '';
      options.forEach((opt, i) => {
        const btn = document.createElement('button');
        btn.className = 'btn' + (opt.secondary ? ' secondary' : '');
        btn.textContent = opt.label;
        btn.addEventListener('click', () => handlers.onDialogOption(i));
        box.appendChild(btn);
      });
      showPanel('dialogPanel');
    },
    showInterior() {
      showPanel('interiorPanel');
    },
    showWardrobe(items) {
      const list = $('wardrobeItems');
      list.innerHTML = '';
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'shop-item';
        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = item.name;
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = item.desc;
        left.appendChild(name);
        left.appendChild(desc);
        const buy = document.createElement('button');
        buy.className = 'btn buy';
        buy.textContent = item.owned ? (item.current ? t('shop.wearing') : t('shop.wear')) : `$${item.price}`;
        buy.disabled = item.current;
        buy.addEventListener('click', () => handlers.onWardrobe(item.id));
        row.appendChild(left);
        row.appendChild(buy);
        list.appendChild(row);
      }
      showPanel('wardrobePanel');
    },
    showGarage(items) {
      const list = $('garageItems');
      list.innerHTML = '';
      if (items.length === 0) {
        const p = document.createElement('p');
        p.textContent = t('garage.empty');
        list.appendChild(p);
      }
      items.forEach((car, i) => {
        const row = document.createElement('div');
        row.className = 'shop-item';
        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = `${car.name} (${car.kind})`;
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = t('garage.condition', { hp: Math.max(0, Math.round(car.hp)) });
        left.appendChild(name);
        left.appendChild(desc);
        const take = document.createElement('button');
        take.className = 'btn buy';
        take.textContent = t('garage.takeOut');
        take.addEventListener('click', () => handlers.onGarage(i));
        row.appendChild(left);
        row.appendChild(take);
        list.appendChild(row);
      });
      showPanel('garagePanel');
    },
    /**
     * v4 backpack: one row per weapon kind in fixed 1–6 order. Owned rows
     * show mag / reserve ammo and an Equip button (disabled while active);
     * unowned rows show the shop price instead, so the bag doubles as a
     * shopping list. `capacity` is the slot count (6).
     */
    showBackpack(items, capacity) {
      const owned = items.filter((i) => i.owned).length;
      $('backpackTitle').textContent = t('backpack.title', { owned, capacity });
      $('backpackHint').textContent = t('backpack.hint');
      const list = $('backpackItems');
      list.innerHTML = '';
      items.forEach((item, i) => {
        const row = document.createElement('div');
        row.className = 'shop-item' + (item.active ? ' backpack-active' : '');
        row.dataset.weapon = item.key;
        const left = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'name';
        name.textContent = `${i + 1}. ${item.key ? t(`weapon.${item.key}`) : item.name}${item.active ? t('backpack.inHand') : ''}`;
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = item.owned
          ? (item.magSize === Infinity
            ? t('backpack.noAmmo', { damage: item.damage })
            : t('backpack.ammo', { damage: item.damage, mag: item.mag, magSize: item.magSize, ammo: item.ammo }))
          : t('backpack.notOwned', { price: item.price.toLocaleString(getLang() === 'id' ? 'id-ID' : 'en-US') });
        left.appendChild(name);
        left.appendChild(desc);
        const equip = document.createElement('button');
        equip.className = 'btn buy';
        equip.textContent = item.active ? t('backpack.inHandBtn') : item.owned ? t('backpack.equip') : t('backpack.locked');
        equip.disabled = !item.owned || item.active;
        equip.addEventListener('click', () => handlers.onBackpackSelect(item.key));
        row.appendChild(left);
        row.appendChild(equip);
        list.appendChild(row);
      });
      showPanel('backpackPanel');
    },
    showToast(text, seconds = 3.2) {
      if (!text) {
        toast.classList.remove('show');
        return;
      }
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      // v3: the caller passes the message lifetime (mission toasts live
      // longer than a one-line notice), so the toast never hides early.
      toastTimer = setTimeout(() => toast.classList.remove('show'), Math.max(800, seconds * 1000));
    },
    /** v2 camera hint: shown once per session, the first time play starts. */
    showOrbitHintOnce() {
      if (orbitHintShown) return;
      orbitHintShown = true;
      this.showToast(t('ui.orbitHint'));
    },
  };
}
