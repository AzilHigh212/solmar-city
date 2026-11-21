// Traffic and pedestrians. Traffic cars drive along the road grid on the right-hand side,
// turning at intersections; pedestrians stroll the sidewalks and scatter when scared.
// Cars and walkers far from the player are recycled back near them so the city always
// feels busy wherever the player is.
import { CAR, ROADS, TRAFFIC, WORLD } from './config.js';
import { clamp, dist } from './world.js';
import { collideCars, stepCar } from './vehicles.js';

const DESPAWN_DIST = 1400;
const INTERSECTION_TURN = 0.3;

/** Pick a new direction at an intersection: straight, left or right (never a U-turn). */
function chooseTurn(rng, car) {
  const options = [];
  if (car.axis === 'v') {
    options.push({ axis: 'v', dir: car.dir });
    options.push({ axis: 'h', dir: rng.chance(0.5) ? 1 : -1 });
  } else {
    options.push({ axis: 'h', dir: car.dir });
    options.push({ axis: 'v', dir: rng.chance(0.5) ? 1 : -1 });
  }
  const pick = options[Math.floor(rng.next() * options.length)];
  car.axis = pick.axis;
  car.dir = pick.dir;
}

/** Is this car at an intersection (close to a crossing road)? */
function atIntersection(car) {
  const margin = 46;
  if (car.axis === 'v') {
    for (const ry of ROADS.horizontal) if (Math.abs(car.y - ry) < margin) return true;
  } else {
    for (const rx of ROADS.vertical) if (Math.abs(car.x - rx) < margin) return true;
  }
  return false;
}

/** Snap a traffic car back onto its lane after a turn, so it never drifts off the road. */
function lanePosition(car) {
  if (car.axis === 'v') {
    // Find the vertical road this car is on: the nearest one.
    let best = ROADS.vertical[0];
    let bestD = Infinity;
    for (const rx of ROADS.vertical) {
      const d = Math.abs(car.x - rx);
      if (d < bestD) { bestD = d; best = rx; }
    }
    // Right-hand traffic: heading south uses the east lane, heading north the west lane.
    return best + (car.dir > 0 ? ROADS.lane : -ROADS.lane);
  }
  let best = ROADS.horizontal[0];
  let bestD = Infinity;
  for (const ry of ROADS.horizontal) {
    const d = Math.abs(car.y - ry);
    if (d < bestD) { bestD = d; best = ry; }
  }
  return best + (car.dir > 0 ? ROADS.lane : -ROADS.lane);
}

export function updateTraffic(state, dt) {
  const rng = state.rng;
  const player = state.player;
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    const car = cars[i];
    if (car.kind !== 'traffic') continue;
    // Keep the city full: recycle a car that has driven far away from the player.
    if (dist(car.x, car.y, player.x, player.y) > DESPAWN_DIST) {
      cars.splice(i, 1);
      i -= 1;
      continue;
    }
    // At an intersection, sometimes turn onto the crossing road.
    if (atIntersection(car) && rng.chance(INTERSECTION_TURN * dt * 60)) {
      chooseTurn(rng, car);
    }
    // Steer along the lane: ease the angle toward the road direction, ease the
    // position onto the lane centreline.
    const wantAngle = car.axis === 'v' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
    const lane = lanePosition(car);
    if (car.axis === 'v') car.x += clamp(lane - car.x, -60 * dt, 60 * dt);
    else car.y += clamp(lane - car.y, -60 * dt, 60 * dt);
    // Slow to a crawl if another car is right ahead — never a dead stop, so queues creep.
    let blocked = false;
    for (const other of cars) {
      if (other === car || other.kind === 'parked') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 80 && side < 36) { blocked = true; break; }
    }
    const speed = blocked ? 60 : car.targetSpeed;
    car.speed += clamp(speed - car.speed, -500 * dt, 300 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, WORLD.width - 40);
    car.y = clamp(car.y, 40, WORLD.height - 40);
  }
  // Top up traffic near the player so the streets never empty out (not in shot mode:
  // staged scenes keep the traffic they started with).
  let trafficCount = 0;
  for (const car of cars) if (car.kind === 'traffic') trafficCount += 1;
  if (trafficCount < TRAFFIC.cars && state._spawnTraffic && !state.shotMode) {
    state._spawnTraffic(player);
  }
  // Car-car collisions (traffic vs everything).
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      if (a.kind === 'parked' && b.kind === 'parked') continue;
      if (collideCars(a, b)) {
        if ((a.kind === 'player' || b.kind === 'player') && Math.abs(a.speed) + Math.abs(b.speed) > 200) {
          state.events |= 128; // EVENT_HIT
        }
      }
    }
  }
}

export function updatePeds(state, dt) {
  const rng = state.rng;
  const player = state.player;
  for (let i = 0; i < state.peds.length; i += 1) {
    const ped = state.peds[i];
    if (ped.health <= 0) {
      state.peds.splice(i, 1);
      i -= 1;
      continue;
    }
    if (ped.scared > 0) {
      ped.scared -= dt;
      // Flee from the player (or from a speeding car).
      const away = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.angle = away;
      ped.x += Math.cos(away) * ped.speed * 1.9 * dt;
      ped.y += Math.sin(away) * ped.speed * 1.9 * dt;
      continue;
    }
    if (ped.kind === 'gang' || ped.kind === 'cop') continue; // driven by combat.js / police.js
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    // Stroll toward a target on the sidewalk; pick a new one when arrived.
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      ped.wait = rng.range(0.5, 4);
      // New target: a sidewalk point a block or two away.
      const road = rng.pick(ROADS.vertical);
      const cross = rng.pick(ROADS.horizontal);
      const side = rng.chance(0.5) ? 1 : -1;
      if (rng.chance(0.5)) {
        ped.targetX = road + side * (ROADS.width / 2 + 12);
        ped.targetY = clamp(ped.y + rng.range(-320, 320), 40, WORLD.height - 40);
      } else {
        ped.targetY = cross + side * (ROADS.width / 2 + 12);
        ped.targetX = clamp(ped.x + rng.range(-320, 320), 40, WORLD.width - 40);
      }
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
  }
  // Recycle walkers that wandered far away.
  let walkers = 0;
  for (const ped of state.peds) if (ped.kind === 'walker') walkers += 1;
  if (walkers < TRAFFIC.peds && state._spawnPed) state._spawnPed(player);
}
