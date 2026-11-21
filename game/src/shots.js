// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a small
// autopilot (drive toward the objective, keep the car on the road, shoot the nearest
// gangster), so every frame is what a short game really looks like — and the same seed
// always gives the same frame.
import { LANDMARKS, STEP } from './config.js';
import { angleDiff, dist } from './world.js';
import { emptyDriver, stepGame } from './game.js';
import { startMission, MISSIONS } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Drive the player's car along a route of road waypoints: throttle, brake and steer.
 * Returns a driver function that advances to the next waypoint when close to the current one. */
function driveRoute(waypoints) {
  let index = 0;
  return function drive(state) {
    const p = state.player;
    const car = p.car;
    const d = emptyDriver();
    if (!car) return d;
    let wp = waypoints[index];
    if (!wp) wp = waypoints[waypoints.length - 1];
    if (dist(car.x, car.y, wp.x, wp.y) < 90 && index < waypoints.length - 1) {
      index += 1;
      wp = waypoints[index];
    }
    // Aim past the corner: once close to a waypoint, steer at a point beyond it along
    // the outgoing road, so the car sweeps through the intersection on a racing line
    // instead of turning on top of the corner (or cutting the block to get there).
    let tx = wp.x;
    let ty = wp.y;
    if (index < waypoints.length - 1) {
      const d = dist(car.x, car.y, wp.x, wp.y);
      if (d < 220) {
        const nx = waypoints[index + 1];
        const len = Math.hypot(nx.x - wp.x, nx.y - wp.y) || 1;
        tx = wp.x + ((nx.x - wp.x) / len) * 90;
        ty = wp.y + ((nx.y - wp.y) / len) * 90;
      }
    }
    const want = Math.atan2(ty - car.y, tx - car.x);
    const diff = angleDiff(car.angle, want);
    d.up = true;
    d.left = diff < -0.08;
    d.right = diff > 0.08;
    // Brake for any real turn — but only down to a rolling speed, so the car can
    // still steer through the corner instead of stopping in it.
    if (Math.abs(diff) > 0.45 && Math.abs(car.speed) > 140) d.brake = true;
    // Overtake: a car right ahead means swinging into the other lane to pass it.
    let blocker = null;
    for (const other of state.cars) {
      if (other === car) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 110 && side < 40) { blocker = other; break; }
    }
    if (blocker) {
      // Aim 100 px ahead and 55 px to the left of the heading: the passing lane.
      const lx = -Math.sin(car.angle);
      const ly = Math.cos(car.angle);
      const ox = car.x + Math.cos(car.angle) * 110 + lx * 55;
      const oy = car.y + Math.sin(car.angle) * 110 + ly * 55;
      const odiff = angleDiff(car.angle, Math.atan2(oy - car.y, ox - car.x));
      d.left = odiff < -0.05;
      d.right = odiff > 0.05;
      d.up = true;
    }
    return d;
  };
}

/** Clear traffic cars near a route so the staged drive has open road ahead. */
function clearRouteTraffic(state, waypoints) {
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.kind !== 'traffic') continue;
    for (const wp of waypoints) {
      if (dist(car.x, car.y, wp.x, wp.y) < 420) {
        state.cars.splice(i, 1);
        break;
      }
    }
  }
}
/** Clear pedestrians near a route so the staged drive does not run anyone over. */
function clearRoutePeds(state, waypoints) {
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.kind !== 'walker') continue;
    for (const wp of waypoints) {
      if (dist(ped.x, ped.y, wp.x, wp.y) < 320) {
        state.peds.splice(i, 1);
        break;
      }
    }
  }
}

function snapCamera(state) {
  state.camera.x = state.player.x - 640;
  state.camera.y = state.player.y - 360;
}

/** Walk the player toward a target point. */
function walkToward(state, tx, ty) {
  const p = state.player;
  const d = emptyDriver();
  const dx = tx - p.x;
  const dy = ty - p.y;
  const len = Math.hypot(dx, dy);
  if (len < 12) return d;
  d.move = { x: dx / len, y: dy / len };
  d.run = true;
  return d;
}

/** Get the player into the nearest car (the taxi at the stand, or any parked car). */
function enterNearestCar(state) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked') continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  best.kind = 'player';
  best.driver = false;
  p.car = best;
  p.x = best.x;
  p.y = best.y;
  p.angle = best.angle;
}

function simulate(state, seconds, driverFn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const driver = driverFn(state, i);
    stepGame(state, driver, STEP);
    if (state.player.health <= 0) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * `world` is the object createWorld returns ({state, reset, ...}).
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  state.shotMode = true;
  if (name === 'drive') {
    // Mara in the taxi, driving up Solmar Row with traffic around her.
    enterNearestCar(state);
    const waypoints = [
      { x: 700, y: 600 },
      { x: 700, y: 950 },
      { x: 1500, y: 950 },
      { x: 1500, y: 1300 },
      { x: 1900, y: 1300 },
    ];
    clearRouteTraffic(state, waypoints);
    clearRoutePeds(state, waypoints);
    simulate(state, 9, driveRoute(waypoints));
    snapCamera(state);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'chase') {
    // Three stars, PD interceptors on her tail, mission objective on the HUD.
    enterNearestCar(state);
    startMission(state, MISSIONS[2]); // its intro already puts 3 stars on Mara
    state.dialog = null; // screenshots show the chase, not the dialogue box
    const waypoints = [
      { x: 700, y: 950 },
      { x: 700, y: 1300 },
      { x: 2300, y: 1300 },
      { x: 2300, y: 600 },
      { x: 2744, y: 450 },
    ];
    clearRouteTraffic(state, waypoints);
    clearRoutePeds(state, waypoints);
    simulate(state, 11, driveRoute(waypoints));
    snapCamera(state);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'mission') {
    // Harbor Pickup: Mara on foot at the warehouse, gangsters in sight, pistol out.
    startMission(state, MISSIONS[1]);
    state.dialog = null;
    // On the road just north of the warehouse, with a clear walk to its door.
    state.player.x = 700;
    state.player.y = 2030;
    snapCamera(state);
    // Walk into the warehouse yard, then aim at the nearest gangster.
    simulate(state, 6, (s, i) => {
      const d = walkToward(s, LANDMARKS.harborWarehouse.x - 40, LANDMARKS.harborWarehouse.y);
      let gang = null;
      let bestD = Infinity;
      for (const ped of s.peds) {
        if (ped.kind !== 'gang') continue;
        const dd = dist(s.player.x, s.player.y, ped.x, ped.y);
        if (dd < bestD) { bestD = dd; gang = ped; }
      }
      if (gang && bestD < 420) {
        d.mouseWorld = { x: gang.x, y: gang.y };
        d.shooting = i % 40 === 0; // a measured few shots, not an empty magazine
      }
      return d;
    });
    snapCamera(state);
    return { screen: SCREEN_PLAY };
  }
  // Default: the title screen over a living city.
  simulate(state, 4, () => emptyDriver());
  return { screen: SCREEN_TITLE };
}
