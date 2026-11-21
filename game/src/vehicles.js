// Car physics and collisions: arcade top-down driving. A car accelerates along its heading,
// steers harder at low speed, drags toward a stop, and slides along buildings instead of
// sticking to them. Car-car hits push both apart and trade a little speed.
import { CAR, ROADS, WORLD } from './config.js';
import { angleDiff, clamp, dist, hitBuilding } from './world.js';

const CAR_HALF_LEN = CAR.length / 2;
const CAR_HALF_WID = CAR.width / 2;

/** Drive one car one step. `drive` is {throttle, brake, steer} from the player or an AI. */
export function stepCar(state, car, dt, drive) {
  const onRoadNow = onRoadAt(car.x, car.y);
  const drag = onRoadNow ? CAR.drag : CAR.offroadDrag;
  if (drive.throttle > 0) {
    car.speed += CAR.accel * drive.throttle * dt;
  } else if (drive.throttle < 0) {
    car.speed += CAR.reverseAccel * drive.throttle * dt;
  }
  if (drive.brake) {
    const before = car.speed;
    car.speed -= Math.sign(car.speed) * CAR.brake * dt;
    if (Math.sign(before) !== Math.sign(car.speed)) car.speed = 0;
  }
  // Drag and speed caps (a car may carry its own maxSpeed, e.g. police interceptors).
  car.speed -= car.speed * drag * dt;
  const maxSpeed = car.maxSpeed ?? CAR.maxSpeed;
  car.speed = clamp(car.speed, -CAR.maxReverse, maxSpeed);
  if (Math.abs(car.speed) < 2 && drive.throttle === 0) car.speed = 0;
  // Steering scales with speed so the car cannot spin on the spot — but never to zero,
  // or a slow car could never finish a turn it braked for.
  const steerAuthority = clamp(Math.abs(car.speed) / 160, 0.25, 1);
  car.angle += drive.steer * CAR.turnRate * steerAuthority * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
  // Buildings: test the car's front and rear, slide along the wall on a hit. A hit
  // scrubs speed but never stops the car dead — scraping a wall should feel like
  // scraping a wall, not hitting a brick one.
  const hit = resolveCarBuildings(state, car);
  if (hit) {
    if (Math.abs(car.speed) > 240) {
      car.speed *= -0.1;
      return { crashed: true, speed: Math.abs(car.speed) };
    }
    car.speed *= 0.9;
  }
  return { crashed: false, speed: 0 };
}

/** Is this point on a road (same grid test world.js uses)? */
function onRoadAt(x, y) {
  const half = ROADS.width / 2 + 6;
  for (const rx of ROADS.vertical) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS.horizontal) if (Math.abs(y - ry) <= half) return true;
  return false;
}

function resolveCarBuildings(state, car) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  let hit = false;
  // Check the four corners; on a hit, push the whole car back out along the short axis.
  const corners = [
    { x: car.x + cos * CAR_HALF_LEN - sin * CAR_HALF_WID, y: car.y + sin * CAR_HALF_LEN + cos * CAR_HALF_WID },
    { x: car.x + cos * CAR_HALF_LEN + sin * CAR_HALF_WID, y: car.y + sin * CAR_HALF_LEN - cos * CAR_HALF_WID },
    { x: car.x - cos * CAR_HALF_LEN - sin * CAR_HALF_WID, y: car.y - sin * CAR_HALF_LEN + cos * CAR_HALF_WID },
    { x: car.x - cos * CAR_HALF_LEN + sin * CAR_HALF_WID, y: car.y - sin * CAR_HALF_LEN - cos * CAR_HALF_WID },
  ];
  for (const c of corners) {
    const b = hitBuilding(state, c.x, c.y, 4);
    if (!b) continue;
    hit = true;
    // Push out along the smallest overlap axis.
    const left = c.x - b.x;
    const right = b.x + b.w - c.x;
    const top = c.y - b.y;
    const bottom = b.y + b.h - c.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) car.x -= left + 4;
    else if (min === right) car.x += right + 4;
    else if (min === top) car.y -= top + 4;
    else car.y += bottom + 4;
  }
  return hit;
}

/** Cheap car-car collision: push apart, and trade speed only on a real impact.
 * Cars passing in opposite lanes (40 px apart) brush past each other: the positional
 * push nudges them, but their speeds are untouched, so traffic never grinds to a halt. */
export function collideCars(a, b) {
  const d = dist(a.x, a.y, b.x, b.y);
  const min = 54;
  if (d >= min || d < 0.001) return false;
  const push = (min - d) / 2;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  a.x -= nx * push;
  a.y -= ny * push;
  b.x += nx * push;
  b.y += ny * push;
  // Closing speed along the line between them: positive when they are moving into
  // each other (a rear-end or a head-on), near zero when they just pass side by side.
  const avx = Math.cos(a.angle) * a.speed;
  const avy = Math.sin(a.angle) * a.speed;
  const bvx = Math.cos(b.angle) * b.speed;
  const bvy = Math.sin(b.angle) * b.speed;
  const closing = -((bvx - avx) * nx + (bvy - avy) * ny);
  if (closing > 30) {
    const avg = (a.speed + b.speed) / 2;
    a.speed = avg * 0.7;
    b.speed = avg * 0.7;
    return true; // a real impact: the caller may play a crash sound
  }
  return false; // just a brush while passing: no impact, no sound
}

/** Steer a car toward a target point (used by police chase and the shot autopilot). */
export function steerToward(car, tx, ty, maxSpeed) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = angleDiff(car.angle, want);
  const steer = clamp(diff * 2.2, -1, 1);
  const throttle = Math.abs(diff) > 1.9 ? -0.4 : 1;
  return { throttle, brake: false, steer, maxSpeed };
}

/** Parked-car door: the nearest car within reach of a point, if any. */
export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.cars) {
    const d = dist(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}
