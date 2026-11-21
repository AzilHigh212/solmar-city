// Keyboard and mouse input. Held keys are read every frame; one-shot presses (confirm,
// pause, interact, reload, melee) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;
export const ACTION_MELEE = 16;
export const ACTION_MISSION = 32;
export const ACTION_CONTINUE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const MELEE = new Set(['KeyF']);
const MISSION = new Set(['KeyM']);
const CONTINUE = new Set(['KeyC']);
const RUN = new Set(['ShiftLeft', 'ShiftRight', 'Shift']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (INTERACT.has(event.code)) actions |= ACTION_INTERACT;
    else if (RELOAD.has(event.code)) actions |= ACTION_RELOAD;
    else if (MELEE.has(event.code)) actions |= ACTION_MELEE;
    else if (MISSION.has(event.code)) actions |= ACTION_MISSION;
    else if (CONTINUE.has(event.code)) actions |= ACTION_CONTINUE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    event.preventDefault();
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(set) {
    for (const code of set) if (keys.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector from WASD/arrows, normalised, in screen space (y down). */
    move() {
      const x = (held(RIGHT) ? 1 : 0) - (held(LEFT) ? 1 : 0);
      const y = (held(DOWN) ? 1 : 0) - (held(UP) ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    up() { return held(UP); },
    down() { return held(DOWN); },
    left() { return held(LEFT); },
    right() { return held(RIGHT); },
    run() { return held(RUN); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
