// Save and load, in localStorage only (this browser, no server). What is kept: cash, the
// missions finished, where Mara is standing, and the run's stats. The save is written when
// a mission ends, when the player is busted or wasted, and when the game pauses.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      version: 1,
      money: state.money,
      completedMissions: state.completedMissions,
      mission: state.mission ? { id: state.mission.def.id, step: state.mission.step } : null,
      x: Math.round(p.x),
      y: Math.round(p.y),
      health: Math.round(p.health),
      ammo: p.ammo,
      reserve: p.reserve,
      stats: state.stats,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

/** Apply a loaded save onto a fresh world (called right after createWorld). */
export function applySave(state, data, startMissionFn) {
  state.money = data.money;
  state.completedMissions = [...data.completedMissions];
  state.stats = { ...state.stats, ...data.stats };
  const p = state.player;
  p.x = data.x;
  p.y = data.y;
  p.health = data.health;
  p.ammo = data.ammo;
  p.reserve = data.reserve;
  p.money = data.money;
  p.wanted = 0;
  state.camera.x = p.x;
  state.camera.y = p.y;
  // An unfinished job is still there: restart it at the step it was on.
  if (data.mission && startMissionFn) {
    startMissionFn(state, data.mission.id, data.mission.step);
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage off: nothing to clear.
  }
}
