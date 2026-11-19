// Neon Bay — keyboard, mouse and touch input. Held keys steer; one-shot
// presses are edge-triggered so a press between frames is never lost.
// Touch gets a virtual joystick plus FIRE / CAR / E / SWAP / RUN buttons.
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
  const touchEdge = { enter: false, interact: false, switch: false };
  let touchRun = false;

  function onKeyDown(event) {
    if (event.code === 'Tab') {
      event.preventDefault();
      if (!event.repeat) pressedSet.add('Tab');
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
    mouse.down = false;
    joy.x = 0;
    joy.y = 0;
    touchRun = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
  });
  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });

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
  bindTouchButton('btnSwitch', () => { touchEdge.switch = true; });
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
      if (code === 'Tab' && touchEdge.switch) {
        touchEdge.switch = false;
        return true;
      }
      return false;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
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
      pressedSet.clear();
      touchEdge.enter = false;
      touchEdge.interact = false;
      touchEdge.switch = false;
    },
  };
}
