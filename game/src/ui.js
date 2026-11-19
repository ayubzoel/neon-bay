// Neon Bay — the DOM panels: start screen, pause, game over, shops,
// dialogues, the safe-house interior, wardrobe and garage. The canvas
// draws the world; these panels are the menus and the shop counters.
const PANELS = ['startScreen', 'pauseMenu', 'overScreen', 'shopPanel', 'dialogPanel', 'interiorPanel', 'wardrobePanel', 'garagePanel'];

function $(id) {
  return document.getElementById(id);
}

export function createUI(handlers) {
  const toast = $('toast');
  let toastTimer = 0;
  let orbitHintShown = false;

  function showPanel(name) {
    for (const id of PANELS) $(id).classList.toggle('hidden', id !== name);
  }
  function hideAll() {
    for (const id of PANELS) $(id).classList.add('hidden');
  }

  function bind(id, fn) {
    const el = $(id);
    if (el) el.addEventListener('click', fn);
  }
  bind('btnNew', () => handlers.onNewGame());
  bind('btnContinue', () => handlers.onContinue());
  bind('btnHow', () => {
    const el = $('howText');
    el.hidden = !el.hidden;
  });
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
    showShop(kind, title, items, money) {
      $('shopTitle').textContent = title;
      $('shopMoney').textContent = `Your cash: $${money.toLocaleString('en-US')}`;
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
        buy.textContent = item.owned ? 'Owned' : `$${item.price}`;
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
        buy.textContent = item.owned ? (item.current ? 'Wearing' : 'Wear') : `$${item.price}`;
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
        p.textContent = 'No cars stored. Drive a car to the safe house and press G to park it.';
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
        desc.textContent = `Condition ${Math.max(0, Math.round(car.hp))}%`;
        left.appendChild(name);
        left.appendChild(desc);
        const take = document.createElement('button');
        take.className = 'btn buy';
        take.textContent = 'Take out';
        take.addEventListener('click', () => handlers.onGarage(i));
        row.appendChild(left);
        row.appendChild(take);
        list.appendChild(row);
      });
      showPanel('garagePanel');
    },
    showToast(text) {
      if (!text) {
        toast.classList.remove('show');
        return;
      }
      toast.textContent = text;
      toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
    },
    /** v2 camera hint: shown once per session, the first time play starts. */
    showOrbitHintOnce() {
      if (orbitHintShown) return;
      orbitHintShown = true;
      this.showToast('Drag mouse to orbit the camera — scroll to zoom.');
    },
  };
}
