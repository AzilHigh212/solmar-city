// The wanted level and the Solmar PD. Crimes raise stars; police cars spawn and chase,
// foot cops run the player down on foot, and a caught player is BUSTED (fined, respawned
// at the station). Stars fade when the player stays clean and out of sight.
import { LANDMARKS, POLICE } from './config.js';
import { clamp, dist } from './world.js';
import { stepCar, steerToward } from './vehicles.js';

export function addWanted(state, stars) {
  const p = state.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + stars, 0, POLICE.maxStars);
  p.lastCrimeAt = state.time;
  p.wantedTimer = POLICE.decaySeconds;
  if (p.wanted > before) {
    state.events |= 16; // EVENT_CRIME
    if (p.wanted >= 3) state.events |= 16;
  }
}

/** How many police cars the current wanted level calls for. */
function wantedCopCars(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(1 + wanted, 6);
}

/** Any cop (car or foot) close to the player? */
function copNear(state, range) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < range) return true;
  }
  for (const ped of state.peds) {
    if (ped.kind === 'cop' && dist(ped.x, ped.y, p.x, p.y) < range) return true;
  }
  return false;
}

export function updatePolice(state, dt) {
  const p = state.player;
  const wanted = p.wanted;
  // Wanted decay: stay clean and unseen for a while and a star drops off.
  if (wanted > 0) {
    const quietFor = state.time - p.lastCrimeAt;
    if (quietFor > 8 && !copNear(state, 520)) {
      p.wantedTimer -= dt;
      if (p.wantedTimer <= 0) {
        p.wanted -= 1;
        p.wantedTimer = POLICE.decaySeconds;
      }
    } else {
      p.wantedTimer = POLICE.decaySeconds;
    }
  }
  // Spawn police cars up to the wanted level's quota.
  let copCars = 0;
  for (const car of state.cars) if (car.kind === 'police') copCars += 1;
  const wantCars = wantedCopCars(wanted);
  if (copCars < wantCars && state._spawnPoliceCar) {
    state._spawnPoliceCar(p);
  }
  if (wanted === 0) {
    // No wanted level: police drift off and despawn.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      if (state.cars[i].kind === 'police') state.cars.splice(i, 1);
    }
    for (let i = state.peds.length - 1; i >= 0; i -= 1) {
      if (state.peds[i].kind === 'cop') state.peds.splice(i, 1);
    }
    p.bustHold = 0;
    return;
  }
  // Foot cops: when the player is on foot, cops get out and chase on foot.
  let footCops = 0;
  for (const ped of state.peds) if (ped.kind === 'cop') footCops += 1;
  if (!p.car && wanted >= 1 && footCops < Math.min(wanted, 3) && state._spawnCop) {
    state._spawnCop(p);
  }
  // Chase: police cars steer at the player through the same physics as any car, so
  // they slide along buildings instead of driving through them.
  const target = p.car ?? p;
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const drive = steerToward(car, target.x, target.y, POLICE.copCarSpeed);
    stepCar(state, car, dt, { throttle: 1, brake: false, steer: drive.steer });
    const d = dist(car.x, car.y, target.x, target.y);
    // Ram: slow the player's car on contact.
    if (p.car && d < 70) {
      p.car.speed *= 1 - 1.0 * dt;
    }
  }
  for (const ped of state.peds) {
    if (ped.kind !== 'cop') continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    const ang = Math.atan2(p.y - ped.y, p.x - ped.x);
    ped.angle = ang;
    ped.x += Math.cos(ang) * ped.speed * dt;
    ped.y += Math.sin(ang) * ped.speed * dt;
    // A foot cop who catches the player starts the arrest.
    if (d < POLICE.bustDistance) {
      p.bustHold += dt;
    }
  }
  // Busted: held by a cop on foot, or boxed in while driving slowly.
  let boxedIn = false;
  if (p.car && Math.abs(p.car.speed) < 40) {
    let near = 0;
    for (const car of state.cars) {
      if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < 90) near += 1;
    }
    if (near >= 2) boxedIn = true;
  }
  if (boxedIn) p.bustHold += dt;
  else if (!p.car && p.bustHold > 0 && !copNear(state, POLICE.bustDistance + 6)) p.bustHold = 0;
  if (p.bustHold >= POLICE.bustHoldSeconds) {
    bustPlayer(state);
  }
}

/** BUSTED: fined, wanted cleared, respawned at the police station. */
export function bustPlayer(state) {
  const p = state.player;
  const fine = Math.min(150, Math.max(25, Math.floor(state.money * 0.15)));
  state.money = Math.max(0, state.money - fine);
  p.money = state.money;
  p.wanted = 0;
  p.bustHold = 0;
  p.health = 100;
  if (p.car) {
    p.car.kind = 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.x = LANDMARKS.policeStation.x + 40;
  p.y = LANDMARKS.policeStation.y + 40;
  p.invulnerable = 2;
  state.stats.arrests += 1;
  state.events |= 1; // EVENT_BUSTED
  state._lastFine = fine;
}

/** WASTED: health hit zero; lose a little cash, wake up at the hospital. */
export function wastePlayer(state) {
  const p = state.player;
  const loss = Math.min(100, Math.max(10, Math.floor(state.money * 0.1)));
  state.money = Math.max(0, state.money - loss);
  p.money = state.money;
  p.wanted = Math.max(0, p.wanted - 1);
  p.health = 100;
  if (p.car) {
    p.car.kind = 'parked';
    p.car.speed = 0;
    p.car = null;
  }
  p.x = LANDMARKS.hospital.x + 40;
  p.y = LANDMARKS.hospital.y + 40;
  p.invulnerable = 2;
  state.stats.wasted += 1;
  state.events |= 2; // EVENT_WASTED
  state._lastLoss = loss;
}
