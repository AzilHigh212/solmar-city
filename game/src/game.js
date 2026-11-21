// The game step: one fixed 1/60 s tick that drives every system in order — the player,
// traffic, pedestrians, police, combat, missions, particles and toasts. main.js calls it;
// shots.js calls it too, with a scripted driver, so the screenshots are real gameplay.
import { STEP } from './config.js';
import { createWorld, dist, EVENT_BUSTED, EVENT_WASTED } from './world.js';
import { stepPlayerOnFoot, pressEnterExit, meleeSwing, regen } from './player.js';
import { stepCar, collideCars } from './vehicles.js';
import { updateTraffic, updatePeds } from './traffic.js';
import { updatePolice, addWanted, wastePlayer } from './police.js';
import { firePistol, startReload, updateReload, updateBullets, updateGangsters } from './combat.js';
import { updateMission, startMission, nextMission } from './missions.js';

export { createWorld };

/** A no-op driver: nothing pressed. Shots replace its fields. */
export function emptyDriver() {
  return {
    move: { x: 0, y: 0 },
    run: false,
    up: false,
    down: false,
    left: false,
    right: false,
    brake: false,
    mouseWorld: null,
    shooting: false,
    interact: false,
    melee: false,
    reload: false,
    mission: false,
  };
}

/** Run one fixed step. `driver` is the frame's input (real or scripted). */
export function stepGame(state, driver, dt = STEP) {
  const p = state.player;
  state.time += dt;
  state.events = 0;

  // --- The player ---
  if (p.car) {
    // S / Down brakes while moving forward and reverses once stopped; the autopilot
    // can also ask for a brake-only slowdown (for corners) via driver.brake.
    const drive = {
      throttle: driver.up ? 1 : 0,
      brake: Boolean(driver.brake),
      steer: (driver.right ? 1 : 0) - (driver.left ? 1 : 0),
    };
    if (driver.down) {
      if (p.car.speed > 20) drive.brake = true;
      else drive.throttle = -1;
    }
    const result = stepCar(state, p.car, dt, drive);
    p.x = p.car.x;
    p.y = p.car.y;
    p.angle = p.car.angle;
    p.car.brakeLight = drive.brake;
    if (result.crashed) {
      state.events |= 128;
      if (state._particles) state._particles(p.car.x, p.car.y, '#e8d44d', 8, 200);
    }
    // Running over pedestrians in a car is a crime.
    for (const ped of state.peds) {
      if (ped.health <= 0) continue;
      if (dist(ped.x, ped.y, p.x, p.y) < 34 && Math.abs(p.car.speed) > 60) {
        ped.health = 0;
        ped.scared = 0;
        if (ped.kind === 'walker') {
          state.stats.pedsHit += 1;
          addWanted(state, 1);
        }
        if (state._particles) state._particles(ped.x, ped.y, '#e84a4a', 10, 180);
      }
    }
  } else {
    stepPlayerOnFoot(state, driver.move, driver.run, dt);
    // Aim where the mouse points (screen coords are converted by the caller).
    if (driver.mouseWorld) {
      p.angle = Math.atan2(driver.mouseWorld.y - p.y, driver.mouseWorld.x - p.x);
    }
    if (driver.shooting) {
      // A measured trigger: one shot per 0.22 s, so holding the mouse is a steady
      // rhythm, not a bullet hose that empties the magazine in a blink.
      if (driver.mouseWorld) {
        if (p.shotCooldown <= 0 && firePistol(state, driver.mouseWorld.x, driver.mouseWorld.y)) {
          p.shotCooldown = 0.22;
        }
      }
    }
    if (p.shotCooldown > 0) p.shotCooldown -= dt;
  }
  if (driver.interact) {
    const result = pressEnterExit(state);
    if (result.crime) {
      addWanted(state, 1);
      state.toasts.push({ text: 'Grand theft auto! The PD is onto you.', left: 3 });
    } else if (result.action === 'enter') {
      state.toasts.push({ text: `${result.stolen} — yours now. Drive!`, left: 2.5 });
    }
  }
  if (driver.melee) {
    const kind = meleeSwing(state);
    if (kind === 'cop') addWanted(state, 1);
    if (kind) state.events |= 128;
  }
  if (driver.reload) startReload(state);
  if (driver.mission) {
    if (!state.mission) {
      const next = nextMission(state);
      if (next) {
        startMission(state, next);
        state.toasts.push({ text: `Job started: ${next.title}`, left: 3 });
      } else {
        state.toasts.push({ text: 'Story complete — free roam!', left: 3 });
      }
    }
  }

  // --- The city ---
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateBullets(state, dt);
  updateGangsters(state, dt);
  updateReload(state, dt);
  regen(state, dt);
  updateMission(state, dt);

  // Gangsters drop cash when they go down.
  for (const ped of state.peds) {
    if (ped.kind === 'gang' && ped.health <= 0 && !ped.dropped) {
      ped.dropped = true;
      state.pickups.push({ x: ped.x, y: ped.y, amount: 40 + Math.floor(state.rng.next() * 40) });
    }
  }
  // Pick up cash.
  for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = state.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) < 36) {
      state.money += pk.amount;
      p.money = state.money;
      state.events |= 64;
      state.toasts.push({ text: `+$${pk.amount}`, left: 2 });
      state.pickups.splice(i, 1);
    }
  }

  // Particles and toasts age out.
  for (let i = state.particles.length - 1; i >= 0; i -= 1) {
    const pt = state.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    if (pt.life <= 0) state.particles.splice(i, 1);
  }
  for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
    state.toasts[i].left -= dt;
    if (state.toasts[i].left <= 0) state.toasts.splice(i, 1);
  }

  // Wasted: health hit zero.
  if (p.health <= 0) {
    wastePlayer(state);
    state.events |= EVENT_WASTED;
  }
  return state.events;
}
