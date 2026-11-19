// Neon Bay — keyboard, mouse and touch input. Held keys steer; one-shot
// presses are edge-triggered so a press between frames is never lost.
// Touch gets a virtual joystick plus FIRE / CAR / E / RUN buttons.
// v3: no character switch — Leo Vance is the only hero, so Tab/C and the
// SWAP button are gone.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};
const CONFIRM_KEYS = new Set(['Space', 'Enter']);
const PAUSE_KEYS = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = new Set();
  const pressedSet = new Set();
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const joy = { x: 0, y: 0, active: false };
  const touchEdge = { enter: false, interact: false };
  let touchRun = false;

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
    if (PAUSE_KEYS.has(event.code)) {
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

  return {
    mouse,
    get run() {
      return held.has('ShiftLeft') || held.has('ShiftRight') || touchRun;
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
      return false;
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
    },
  };
}
