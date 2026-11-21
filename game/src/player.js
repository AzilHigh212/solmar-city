// The player on foot: WASD movement, running, getting in and out of cars, stealing them,
// and a melee swing. Driving itself lives in vehicles.js; this module decides when the
// player is on foot and what E does next to a car.
import { CAR, PLAYER } from './config.js';
import { clamp, dist, resolveCircle } from './world.js';
import { nearestCar } from './vehicles.js';

const ENTER_DIST = 62;
const MELEE_RANGE = 46;
const MELEE_DAMAGE = 40;
const MELEE_ARC = 1.1;

/** Move the player on foot for one step. Returns nothing; mutates state.player. */
export function stepPlayerOnFoot(state, move, running, dt) {
  const p = state.player;
  const speed = running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  p.running = running && (move.x !== 0 || move.y !== 0);
  if (move.x !== 0 || move.y !== 0) {
    p.angle = Math.atan2(move.y, move.x);
    p.x += move.x * speed * dt;
    p.y += move.y * speed * dt;
  }
  resolveCircle(state, p, PLAYER.radius);
}

/** The nearest car the player could get into, or null. */
export function carInReach(state) {
  const p = state.player;
  return nearestCar(state, p.x, p.y, ENTER_DIST);
}

/**
 * Press E on foot: get into the nearest car, or get out of the one being driven.
 * Stealing an occupied car (traffic, or a police car) is a crime and raises the wanted level.
 * Returns a small report for the caller: {action, crime}.
 */
export function pressEnterExit(state) {
  const p = state.player;
  if (p.car) {
    const car = p.car;
    car.kind = 'parked';
    car.speed = 0;
    // Step out beside the car, on the driver's side.
    const side = Math.PI / 2;
    p.x = car.x + Math.cos(car.angle + side) * 44;
    p.y = car.y + Math.sin(car.angle + side) * 44;
    p.angle = car.angle;
    p.car = null;
    resolveCircle(state, p, PLAYER.radius);
    return { action: 'exit', crime: false };
  }
  const car = carInReach(state);
  if (!car) return { action: 'none', crime: false };
  let crime = false;
  if (car.kind === 'traffic' || car.kind === 'police') {
    // The driver bails out and runs; taking the car is grand theft auto.
    crime = true;
    state.stats.carsStolen += 1;
    const driver = { x: car.x, y: car.y, angle: 0, speed: 0, color: '#d8d8d8', kind: 'walker', health: 100, wait: 0, targetX: car.x, targetY: car.y, scared: 3 };
    driver.angle = Math.atan2(car.y - p.y, car.x - p.x) + Math.PI;
    state.peds.push(driver);
  }
  car.kind = 'player';
  car.driver = false;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  return { action: 'enter', crime, stolen: car.model };
}

/** Melee swing (F): hurt the nearest hostile or pedestrian in front of the player. */
export function meleeSwing(state) {
  const p = state.player;
  let hitKind = null;
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    const d = dist(p.x, p.y, p.x, p.y);
    if (d > MELEE_RANGE) continue;
    const to = Math.atan2(ped.y - p.y, ped.x - p.x);
    let diff = to - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) > MELEE_ARC) continue;
    ped.health -= MELEE_DAMAGE;
    hitKind = ped.kind;
    if (ped.kind === 'gang' || ped.kind === 'cop') {
      // They fight back: turn toward the player.
      ped.targetX = p.x;
      ped.targetY = p.y;
    } else {
      ped.scared = 3;
    }
  }
  return hitKind;
}

/** Heal a little over time when the player has not been hurt recently. */
export function regen(state, dt) {
  const p = state.player;
  if (p.invulnerable > 0) p.invulnerable -= dt;
  if (p.health > 0 && p.health < PLAYER.healthMax && state.time - (p.lastHurtAt ?? -999) > 8) {
    p.health = Math.min(PLAYER.healthMax, p.health + 4 * dt);
  }
}

/** Clamp the player's money to what they actually hold (missions pay into it). */
export function syncMoney(state) {
  state.player.money = state.money;
}
