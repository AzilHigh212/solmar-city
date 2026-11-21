// Missions and the story. Mara Solis, a courier driver in Solmar City, takes jobs from a
// fixer named Dario: a fare, a package, a police chase, and one big score. Each mission is
// a list of steps — go somewhere, hold still, lose the heat — with dialogue that plays
// between them. Finish a mission for cash; get busted or wasted and it fails, ready to retry.
import { LANDMARKS } from './config.js';
import { dist } from './world.js';
import { addWanted } from './police.js';

export const MISSIONS = [
  {
    id: 'm1',
    title: 'First Fare',
    brief: 'Dario needs a driver. Pick up the fare at Marina Pier and take them to the hotel.',
    reward: 150,
    start: { x: LANDMARKS.taxiStand.x, y: LANDMARKS.taxiStand.y, label: 'Taxi Stand' },
    intro: [
      ['DARIO', 'Mara. You still owe me for that busted axle. Drive my cab, we call it even.'],
      ['MARA', 'One fare, Dario. Then we talk about the axle.'],
      ['DARIO', 'Marina Pier. Fare is waiting. Do not keep them waiting.'],
    ],
    steps: [
      { type: 'enterCar', label: 'Get in the taxi at the stand' },
      { type: 'goto', x: LANDMARKS.marinaPier.x, y: LANDMARKS.marinaPier.y, radius: 90, label: 'Pick up the fare at Marina Pier' },
      { type: 'goto', x: LANDMARKS.downtownHotel.x, y: LANDMARKS.downtownHotel.y, radius: 90, label: 'Drop the fare at the Grand Solmar Hotel' },
    ],
    outro: [
      ['FARE', 'You drive like the city owes you money. I like it.'],
      ['DARIO', 'Not bad. The axle is still on you, though.'],
    ],
  },
  {
    id: 'm2',
    title: 'Harbor Pickup',
    brief: 'A package is waiting at the Harbor Warehouse. The crew watching it is not friendly.',
    reward: 300,
    start: { x: LANDMARKS.harborWarehouse.x, y: LANDMARKS.harborWarehouse.y, label: 'Harbor Warehouse' },
    intro: [
      ['DARIO', 'Second job. A crate at the Harbor Warehouse. Bring it to Cafe Alba.'],
      ['MARA', 'Why does every crate of yours have armed men standing next to it?'],
      ['DARIO', 'Those men are the reason the pay is good.'],
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.harborWarehouse.x, y: LANDMARKS.harborWarehouse.y, radius: 80, label: 'Reach the Harbor Warehouse' },
      { type: 'hold', x: LANDMARKS.harborWarehouse.x, y: LANDMARKS.harborWarehouse.y, radius: 70, seconds: 3, label: 'Grab the package — hold still' },
      { type: 'goto', x: LANDMARKS.oldTownCafe.x, y: LANDMARKS.oldTownCafe.y, radius: 80, label: 'Deliver the package to Cafe Alba' },
    ],
    outro: [
      ['DARIO', 'Delivered. The cafe owner asks no questions. Neither do I.'],
      ['MARA', 'Next time the men with guns come with a warning.'],
    ],
  },
  {
    id: 'm3',
    title: 'Heat in the Hills',
    brief: 'The PD is all over you. Lose the heat and get to the Hillside Lookout.',
    reward: 400,
    start: { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Safehouse' },
    intro: [
      ['DARIO', 'Mara, the PD picked up your plate. Three stars. Get out of the city centre.'],
      ['MARA', 'Three stars for a package run? Your friends are thorough.'],
      ['DARIO', 'Hillside Lookout. Lose them on the way up.'],
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.hillsLookout.x, y: LANDMARKS.hillsLookout.y, radius: 100, label: 'Reach the Hillside Lookout' },
      { type: 'loseHeat', label: 'Lose the heat — stay clean until the stars fade' },
    ],
    outro: [
      ['DARIO', 'Clean. You drive like a ghost when you want to.'],
      ['MARA', 'Remind me again why I keep answering your calls.'],
    ],
  },
  {
    id: 'm4',
    title: 'The Solmar Score',
    brief: 'One last job: the vault at Solmar National Bank, then a getaway to the Safehouse.',
    reward: 1000,
    start: { x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, label: 'Solmar National Bank' },
    intro: [
      ['DARIO', 'Last one, I promise. The bank on Solmar Row. In, out, gone.'],
      ['MARA', 'A bank, Dario. You said the axle was the worst of it.'],
      ['DARIO', 'After this, no more calls. The city is yours, Mara.'],
    ],
    steps: [
      { type: 'goto', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 90, label: 'Reach Solmar National Bank' },
      { type: 'hold', x: LANDMARKS.bank.x, y: LANDMARKS.bank.y, radius: 70, seconds: 4, label: 'Crack the vault — hold still' },
      { type: 'goto', x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, radius: 90, label: 'Getaway! Reach the Safehouse' },
    ],
    outro: [
      ['MARA', 'It is done. Solmar City, every street of it, is mine now.'],
      ['DARIO', 'Then drive, Mara. The sun is coming up over the bay.'],
    ],
  },
];

/** The next mission the player has not finished, or null when the story is done. */
export function nextMission(state) {
  for (const m of MISSIONS) {
    if (!state.completedMissions.includes(m.id)) return m;
  }
  return null;
}

/** Where the next mission starts (for the map marker), or null. */
export function nextMissionStart(state) {
  const m = nextMission(state);
  return m ? m.start : null;
}

function showDialog(state, lines) {
  state.dialog = { lines, index: 0 };
}

/** Start a mission. `step` lets a loaded save resume mid-mission (no intro replay). */
export function startMission(state, def, step = 0) {
  state.mission = {
    def,
    step,
    holdLeft: 0,
    entered: false,
    guardsSpawned: false,
  };
  if (step === 0) showDialog(state, def.intro);
  if (def.id === 'm3' && step === 0) addWanted(state, 3);
}

/** The current objective for the HUD: a point and a label, or null. */
export function currentObjective(state) {
  if (!state.mission) {
    const start = nextMissionStart(state);
    if (!start) return null;
    return { x: start.x, y: start.y, label: 'Next job: ' + nextMission(state).title + ' — press M to start', marker: 'M' };
  }
  const step = state.mission.def.steps[state.mission.step];
  if (!step) return null;
  if (step.type === 'enterCar') return { x: LANDMARKS.taxiStand.x, y: LANDMARKS.taxiStand.y, label: step.label, marker: '!' };
  if (step.type === 'loseHeat') return { x: state.player.x, y: state.player.y, label: step.label, marker: '!' };
  return { x: step.x, y: step.y, label: step.label, marker: '!' };
}

/** Advance the dialogue box one line; returns true when it closed. */
export function advanceDialog(state) {
  if (!state.dialog) return true;
  state.dialog.index += 1;
  if (state.dialog.index >= state.dialog.lines.length) {
    state.dialog = null;
    return true;
  }
  return false;
}

function completeMission(state) {
  const m = state.mission.def;
  state.completedMissions.push(m.id);
  state.money += m.reward;
  state.player.money = state.money;
  state.stats.missionsDone += 1;
  state.mission = null;
  state.events |= 4; // EVENT_MISSION_DONE
  showDialog(state, [...m.outro, ['PAYDAY', `+$${m.reward} — total $${state.money}`]]);
}

function failMission(state, reason) {
  if (!state.mission) return;
  state.mission = null;
  state.events |= 8; // EVENT_MISSION_FAIL
  showDialog(state, [['DARIO', reason + ' The job is still there when you are ready. Press M to try again.']]);
}

/** One step of the mission state machine. Call every frame while a mission is active. */
export function updateMission(state, dt) {
  const m = state.mission;
  if (!m) return;
  const p = state.player;
  const step = m.def.steps[m.step];
  if (!step) {
    completeMission(state);
    return;
  }
  if (step.type === 'enterCar') {
    if (p.car) {
      m.step += 1;
      m.holdLeft = 0;
    }
    return;
  }
  if (step.type === 'goto') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      // Mission 2: the warehouse is guarded — spawn the crew when the player arrives.
      if (m.def.id === 'm2' && m.step === 0 && !m.guardsSpawned) {
        m.guardsSpawned = true;
        if (state._spawnGang) {
          state._spawnGang(step.x - 90, step.y + 40);
          state._spawnGang(step.x + 90, step.y - 30);
        }
      }
      m.step += 1;
      m.holdLeft = 0;
    }
    return;
  }
  if (step.type === 'hold') {
    if (dist(p.x, p.y, step.x, step.y) < step.radius) {
      if (!m.holdStarted) {
        m.holdStarted = true;
        m.holdLeft = step.seconds;
        if (m.def.id === 'm4' && !m.guardsSpawned) {
          m.guardsSpawned = true;
          if (state._spawnGang) {
            state._spawnGang(step.x - 110, step.y + 60);
            state._spawnGang(step.x + 110, step.y + 60);
          }
        }
      }
      m.holdLeft -= dt;
      if (m.holdLeft <= 0) {
        m.step += 1;
        m.holdLeft = 0;
        m.holdStarted = false;
        if (m.def.id === 'm4' && m.step === 2) addWanted(state, 4);
      }
    } else {
      m.holdStarted = false;
      m.holdLeft = step.seconds;
    }
    return;
  }
  if (step.type === 'loseHeat') {
    if (p.wanted === 0) {
      m.step += 1;
    }
    return;
  }
}

/** Called when the player is busted or wasted mid-mission. */
export function onPlayerDown(state, busted) {
  if (!state.mission) return;
  failMission(state, busted ? 'Busted. The PD took you in.' : 'Wasted. You woke up at St. Lumen.');
}
