// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_CONTINUE, ACTION_INTERACT, ACTION_MELEE, ACTION_MISSION, ACTION_PAUSE, ACTION_RELOAD, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { drawHUD } from './hud.js';
import { createAudio } from './audio.js';
import { emptyDriver, stepGame } from './game.js';
import { currentObjective, advanceDialog, startMission, MISSIONS } from './missions.js';
import { saveGame, loadGame, applySave, hasSave } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261121;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const state = world.state;
const renderer = createRenderer(canvas);
const audio = createAudio();
state._hasSave = hasSave();
// Debug hook for play-testing in the browser console.
window.__solmar = state;

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, { objective: currentObjective(state), over: null });
    if (scene.screen === SCREEN_PLAY) {
      drawHUD(renderer.ctx, state, renderer.view);
    }
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let overKind = null;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startNewGame() {
    world.reset();
    state._hasSave = hasSave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Playing Solmar City. Mara Solis, courier driver. Press M to start the first job.');
  }

  function continueGame() {
    const data = loadGame();
    world.reset();
    if (data) {
      applySave(state, data, (st, id, step) => {
        const def = MISSIONS.find((m) => m.id === id);
        if (def && !state.completedMissions.includes(id)) startMission(st, def, step);
      });
      state.toasts.push({ text: 'Save loaded — welcome back, Mara.', left: 3 });
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce('Continued your game.');
  }

  function toTitle() {
    saveGame(state);
    world.reset();
    state._hasSave = hasSave();
    screen = SCREEN_TITLE;
    announce('Solmar City. Press Enter for a new game.');
  }

  function handleEvents(events) {
    if (events & EVENT_BUSTED) {
      overKind = 'busted';
      screen = SCREEN_OVER;
      audio.busted();
      saveGame(state);
      announce('Busted. The PD took you in.');
    } else if (events & EVENT_WASTED) {
      overKind = 'wasted';
      screen = SCREEN_OVER;
      audio.busted();
      saveGame(state);
      announce('Wasted. You woke up at St. Lumen Hospital.');
    }
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      saveGame(state);
      announce('Job done. Payday.');
    }
    if (events & EVENT_MISSION_FAIL) {
      audio.error();
    }
    if (events & 32) audio.shot(); // EVENT_SHOT
    if (events & 64) audio.pickup(); // EVENT_PICKUP
    if (events & 128) audio.crash(); // EVENT_HIT
    if (events & 16) announce('Wanted level up — the PD is coming.');
  }

  function buildDriver() {
    const d = emptyDriver();
    const mouse = input.mouse();
    const p = state.player;
    if (p.car) {
      d.up = input.up();
      d.down = input.down();
      d.left = input.left();
      d.right = input.right();
    } else {
      d.move = input.move();
      d.run = input.run();
      // Aim: convert the mouse's screen position into world coordinates.
      const cam = state.camera;
      d.mouseWorld = { x: cam.x + mouse.x, y: cam.y + mouse.y };
      d.shooting = mouse.down;
    }
    const actions = input.takeActions();
    d.interact = Boolean(actions & ACTION_INTERACT);
    d.melee = Boolean(actions & ACTION_MELEE);
    d.reload = Boolean(actions & ACTION_RELOAD);
    d.mission = Boolean(actions & ACTION_MISSION);
    d._actions = actions;
    d._click = input.takeClick();
    return d;
  }

  function handleScreens(driver) {
    const actions = driver._actions;
    if (state.dialog) {
      if ((actions & ACTION_CONFIRM) || driver._click) {
        advanceDialog(state);
        audio.blip();
      }
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONTINUE && state._hasSave) continueGame();
      else if (actions & ACTION_CONFIRM) startNewGame();
      else if (driver._click) startNewGame();
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        overKind = null;
        announce('Back on the streets.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    // Playing.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  }

  function step() {
    const driver = buildDriver();
    handleScreens(driver);
    if (screen === SCREEN_TITLE) {
      // The title screen lives over a slowly idling city.
      stepGame(state, emptyDriver(), STEP);
      return;
    }
    if (screen !== SCREEN_PLAY || state.dialog) return;
    const events = stepGame(state, driver, STEP);
    handleEvents(events);
    audio.update(state.player.car ? Math.abs(state.player.car.speed) : 0, state.player.wanted);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Every screen reads input every step (title, play, paused, over); only the play
    // screen advances the world, and the title idles the city behind it.
    while (accumulator >= STEP) {
      step();
      accumulator -= STEP;
    }
    const mouse = screen === SCREEN_PLAY ? input.mouse() : null;
    renderer.view.mouse = mouse;
    renderer.draw(state, screen, { objective: currentObjective(state), over: overKind });
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      drawHUD(renderer.ctx, state, renderer.view);
    }
  }

  // Leaving the tab pauses a running game rather than letting the city run unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(state);
      announce('Paused.');
    }
  });

  announce('Solmar City. Press Enter to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
