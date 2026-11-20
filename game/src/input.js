// Neon Bay — keyboard, mouse and touch input. Held keys steer; one-shot
// presses are edge-triggered so a press between frames is never lost.
// Touch gets a virtual joystick plus FIRE / CAR / E / RUN buttons.
// v3: no character switch — Leo Vance is the only hero, so Tab/C and the
// SWAP button are gone.
//
// v4 (Builder C — Settings): the gameplay keys are REBINDABLE. Actions
// (moveUp, interact, backpack, …) map to KeyboardEvent.codes through
// DEFAULT_BINDINGS; Settings edits them and input.js applies the new map
// immediately — no restart. Game code reads actions via pressedAction()
// / moveX() / moveY() / run; the raw-code pressed(code) stays for the
// minigames and the fixed 1–6 weapon keys.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

/** Default key for every rebindable action. */
export const DEFAULT_BINDINGS = {
  moveUp: 'KeyW',
  moveDown: 'KeyS',
  moveLeft: 'KeyA',
  moveRight: 'KeyD',
  jump: 'Space',
  run: 'ShiftLeft',
  interact: 'KeyE',
  enterVehicle: 'KeyF',
  reload: 'KeyR',
  pickpocket: 'KeyQ',
  park: 'KeyG',
  backpack: 'KeyB',
  // v6: H holsters / draws the active weapon (combat.js toggleHolster).
  holster: 'KeyH',
  map: 'KeyM',
  pause: 'KeyP',
  mute: 'KeyN',
  radio: 'KeyV',
};

/** Actions the Settings menu lets the player rebind. `run` stays on
 *  Shift (both left and right count) and shooting stays on the mouse;
 *  weapon keys 1–6 are fixed by the backpack layout. */
export const REBINDABLE_ACTIONS = [
  'moveUp', 'moveDown', 'moveLeft', 'moveRight', 'jump',
  'interact', 'enterVehicle', 'reload', 'pickpocket', 'park',
  'backpack', 'holster', 'map', 'pause', 'mute', 'radio',
];

const CONFIRM_KEYS = new Set(['Space', 'Enter']);

// Arrow keys always steer too (they are not rebindable alternates).
const ARROW_KEYS = {
  ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
};

let BINDINGS = { ...DEFAULT_BINDINGS };

function buildMoveMap() {
  return {
    [BINDINGS.moveUp]: [0, -1], ArrowUp: [0, -1],
    [BINDINGS.moveDown]: [0, 1], ArrowDown: [0, 1],
    [BINDINGS.moveLeft]: [-1, 0], ArrowLeft: [-1, 0],
    [BINDINGS.moveRight]: [1, 0], ArrowRight: [1, 0],
  };
}
let MOVE_KEYS = buildMoveMap();

/** Current action → code map (a copy). */
export function getBindings() {
  return { ...BINDINGS };
}

/** Apply stored bindings (Settings): unknown actions, bad codes and
 *  duplicates are dropped, the rest take effect immediately. */
export function loadBindings(stored) {
  const next = { ...DEFAULT_BINDINGS };
  if (stored && typeof stored === 'object') {
    const used = new Set(Object.values(next));
    for (const action of REBINDABLE_ACTIONS) {
      const code = stored[action];
      if (typeof code !== 'string' || code.length === 0) continue;
      if (used.has(code) && next[action] !== code) continue;
      used.delete(next[action]);
      used.add(code);
      next[action] = code;
    }
  }
  BINDINGS = next;
  MOVE_KEYS = buildMoveMap();
  return { ...BINDINGS };
}

/**
 * Rebind one action. Returns { ok: true } or { ok: false, reason,
 * takenBy } — a code already used by another action is refused so two
 * actions can never share a key.
 */
export function setBinding(action, code) {
  if (!REBINDABLE_ACTIONS.includes(action)) return { ok: false, reason: 'fixed' };
  if (typeof code !== 'string' || code.length === 0) return { ok: false, reason: 'badcode' };
  const takenBy = REBINDABLE_ACTIONS.find((a) => a !== action && BINDINGS[a] === code);
  if (takenBy) return { ok: false, reason: 'taken', takenBy };
  BINDINGS[action] = code;
  MOVE_KEYS = buildMoveMap();
  return { ok: true };
}

export function resetBindings() {
  BINDINGS = { ...DEFAULT_BINDINGS };
  MOVE_KEYS = buildMoveMap();
  return { ...BINDINGS };
}

// --- Vibration (v4 Settings: touch vibration on/off) ----------------------
let vibrationEnabled = true;
export function setVibration(enabled) {
  vibrationEnabled = !!enabled;
}
export function vibrate(ms = 15) {
  try {
    if (vibrationEnabled && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  } catch {
    // Vibration is a nicety, never an error.
  }
}

export function createInput(canvas) {
  const held = new Set();
  const pressedSet = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const joy = { x: 0, y: 0, active: false };
  const touchEdge = { enter: false, interact: false, backpack: false };
  let touchRun = false;
  // Rebind capture: while set, the next real keydown is the new binding.
  let rebinding = null;
  let onRebindDone = null;

  // --- v2 camera orbit: drag on the canvas orbits, wheel zooms. A press
  // only counts as a click (shoot) when it is released without orbiting,
  // so dragging the camera never fires the weapon. Touch: only drags that
  // start on the right half of the screen orbit (left half is the stick).
  let orbitDx = 0;
  let orbitDy = 0;
  let orbitWheel = 0;
  let drag = null; // { pointerId, lastX, lastY, startX, startY, orbiting }
  const ORBIT_MIN_PX = 6;

  function cancelDrag() {
    drag = null;
    mouse.down = false;
  }

  function onKeyDown(event) {
    // Rebind capture eats the key (Escape cancels) and nothing else.
    if (rebinding) {
      if (event.code === 'Escape') {
        const cb = onRebindDone;
        const action = rebinding;
        rebinding = null;
        onRebindDone = null;
        if (cb) cb(action, null);
        event.preventDefault();
        return;
      }
      if (['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(event.code)) return;
      if (event.repeat) return;
      const cb = onRebindDone;
      const action = rebinding;
      const code = event.code;
      rebinding = null;
      onRebindDone = null;
      if (cb) cb(action, code);
      event.preventDefault();
      return;
    }
    if (MOVE_KEYS[event.code] || event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (CONFIRM_KEYS.has(event.code)) {
      if (!event.repeat) {
        actions |= ACTION_CONFIRM;
        pressedSet.add(event.code);
      }
      event.preventDefault();
      return;
    }
    if (event.code === 'Escape' || event.code === BINDINGS.pause) {
      if (!event.repeat) {
        actions |= ACTION_PAUSE;
        pressedSet.add(event.code);
      }
      return;
    }
    if (!event.repeat) pressedSet.add(event.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    cancelDrag();
    joy.x = 0;
    joy.y = 0;
    touchRun = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.lastX;
    const dy = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    if (!drag.orbiting) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <= ORBIT_MIN_PX) return;
      drag.orbiting = true;
      mouse.down = false;
      mouse.clicked = false;
    }
    orbitDx += dx;
    orbitDy += dy;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    // Touch drags on the left half belong to the joystick area, not the camera.
    if (event.pointerType === 'touch' && event.clientX < window.innerWidth / 2) return;
    drag = {
      pointerId: event.pointerId,
      lastX: event.clientX, lastY: event.clientY,
      startX: event.clientX, startY: event.clientY,
      orbiting: false,
    };
    mouse.down = true;
    // clicked is set on pointerup, only when this press never became an orbit.
  });
  function endDrag(event) {
    if (!drag) {
      mouse.down = false;
      return;
    }
    if (event && event.pointerId !== drag.pointerId) return;
    const wasOrbit = drag.orbiting;
    drag = null;
    mouse.down = false;
    if (!wasOrbit) mouse.clicked = true;
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', cancelDrag);
  window.addEventListener('pointerup', (event) => {
    if (drag) endDrag(event);
    else mouse.down = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    orbitWheel += event.deltaY;
  }, { passive: false });

  // Touch controls: joystick + action buttons, wired to the same state.
  const touchRoot = document.getElementById('touch');
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stickKnob');
  const isTouch = 'ontouchstart' in window || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (isTouch && touchRoot) touchRoot.classList.add('on');
  if (stick) {
    let stickPointer = null;
    const updateStick = (clientX, clientY) => {
      const rect = stick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = (clientX - cx) / (rect.width / 2);
      let dy = (clientY - cy) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) {
        dx /= len;
        dy /= len;
      }
      joy.x = dx;
      joy.y = dy;
      joy.active = true;
      knob.style.left = `${44 + dx * 40}px`;
      knob.style.top = `${44 + dy * 40}px`;
    };
    stick.addEventListener('pointerdown', (event) => {
      stickPointer = event.pointerId;
      stick.setPointerCapture(event.pointerId);
      updateStick(event.clientX, event.clientY);
    });
    stick.addEventListener('pointermove', (event) => {
      if (event.pointerId === stickPointer) updateStick(event.clientX, event.clientY);
    });
    const releaseStick = () => {
      stickPointer = null;
      joy.x = 0;
      joy.y = 0;
      joy.active = false;
      knob.style.left = '44px';
      knob.style.top = '44px';
    };
    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);
  }
  function bindTouchButton(id, down, up) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      vibrate(12);
      down();
    });
    el.addEventListener('pointerup', () => up && up());
    el.addEventListener('pointercancel', () => up && up());
    el.addEventListener('pointerleave', () => up && up());
  }
  bindTouchButton('btnFire', () => { mouse.down = true; mouse.clicked = true; }, () => { mouse.down = false; });
  bindTouchButton('btnEnter', () => { touchEdge.enter = true; });
  bindTouchButton('btnInteract', () => { touchEdge.interact = true; });
  bindTouchButton('btnRun', () => { touchRun = true; }, () => { touchRun = false; });
  // v4: the touch backpack button raises the same edge as the B key.
  bindTouchButton('btnBackpackTouch', () => { touchEdge.backpack = true; });

  return {
    mouse,
    get run() {
      return held.has(BINDINGS.run) || held.has('ShiftLeft') || held.has('ShiftRight') || touchRun;
    },
    moveX() {
      let x = 0;
      for (const code of held) {
        if (MOVE_KEYS[code]) x += MOVE_KEYS[code][0];
      }
      return Math.max(-1, Math.min(1, x + joy.x));
    },
    moveY() {
      let y = 0;
      for (const code of held) {
        if (MOVE_KEYS[code]) y += MOVE_KEYS[code][1];
      }
      return Math.max(-1, Math.min(1, y + joy.y));
    },
    isDown(code) {
      return held.has(code);
    },
    pressed(code) {
      if (pressedSet.has(code)) {
        pressedSet.delete(code);
        return true;
      }
      if (code === 'KeyF' && touchEdge.enter) {
        touchEdge.enter = false;
        return true;
      }
      if (code === 'KeyE' && touchEdge.interact) {
        touchEdge.interact = false;
        return true;
      }
      // v4: the touch backpack button is the B key.
      if (code === 'KeyB' && touchEdge.backpack) {
        touchEdge.backpack = false;
        return true;
      }
      return false;
    },
    /**
     * v4 Settings: edge-triggered press for a rebindable ACTION, using
     * the current binding. Touch buttons raise the same edges as their
     * keyboard twins (CAR → enterVehicle, E → interact, BAG → backpack),
     * and Escape always counts as 'pause' alongside the bound key.
     */
    pressedAction(action) {
      const code = BINDINGS[action];
      if (code && pressedSet.has(code)) {
        pressedSet.delete(code);
        return true;
      }
      if (action === 'pause' && pressedSet.has('Escape')) {
        pressedSet.delete('Escape');
        return true;
      }
      if (action === 'enterVehicle' && touchEdge.enter) {
        touchEdge.enter = false;
        return true;
      }
      if (action === 'interact' && touchEdge.interact) {
        touchEdge.interact = false;
        return true;
      }
      if (action === 'backpack' && touchEdge.backpack) {
        touchEdge.backpack = false;
        return true;
      }
      return false;
    },
    /** Start capturing the next keydown as the new binding for `action`.
     *  `cb(action, code | null)` fires once — null when Escape cancels. */
    startRebind(action, cb) {
      if (!REBINDABLE_ACTIONS.includes(action)) return false;
      rebinding = action;
      onRebindDone = typeof cb === 'function' ? cb : null;
      return true;
    },
    getRebinding() {
      return rebinding;
    },
    cancelRebind() {
      rebinding = null;
      onRebindDone = null;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Take accumulated camera-orbit input since the last call, then clear it. */
    takeOrbit() {
      const out = { dx: orbitDx, dy: orbitDy, wheel: orbitWheel };
      orbitDx = 0;
      orbitDy = 0;
      orbitWheel = 0;
      return out;
    },
    /** Clear per-frame edges after the frame's steps have read them.
     *  Only the mouse click is cleared here: key presses stay queued so a
     *  tap that lands while the frame is drawing is read by the next frame
     *  instead of being lost. */
    endFrame() {
      mouse.clicked = false;
    },
    /** Drop queued edges while a panel or the title is up, so a key tapped
     *  in a menu does not fire the moment play resumes. */
    clearStaleEdges() {
      mouse.clicked = false;
      cancelDrag();
      pressedSet.clear();
      touchEdge.enter = false;
      touchEdge.interact = false;
      touchEdge.backpack = false;
    },
  };
}
