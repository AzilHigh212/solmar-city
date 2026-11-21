// Solmar City — the world: city generation, the shared game state, collision helpers
// and spawners. No drawing and no browser in here: the rules live in the other modules
// and read this state. step() is not here either; main.js drives each system in turn.
import { CAR, CAR_MODELS, COLORS, DISTRICTS, LANDMARKS, PED_COLORS, PLAYER, POLICE, ROADS, TRAFFIC, WORLD } from './config.js';
import { createRandom } from './random.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_WASTED = 2;
export const EVENT_MISSION_DONE = 4;
export const EVENT_MISSION_FAIL = 8;
export const EVENT_CRIME = 16;
export const EVENT_SHOT = 32;
export const EVENT_PICKUP = 64;
export const EVENT_HIT = 128;

export function dist(ax, ay, bx, by) {
  return Math.hypot(bx - ax, by - ay);
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Shortest signed turn from angle `from` toward `to`, in radians. */
export function angleDiff(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[1];
}

/** Build the city: roads from the grid, buildings filling the blocks, parks and palms. */
function buildCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const half = ROADS.width / 2;
  // Blocks run between neighbouring road centrelines, plus the edge strips.
  const xs = [0, ...ROADS.vertical, WORLD.width];
  const ys = [0, ...ROADS.horizontal, WORLD.height];
  for (let bx = 0; bx < xs.length - 1; bx += 1) {
    for (let by = 0; by < ys.length - 1; by += 1) {
      const x0 = xs[bx] + (bx === 0 ? 0 : half + 14);
      const x1 = xs[bx + 1] - (bx === xs.length - 2 ? 0 : half + 14);
      const y0 = ys[by] + (by === 0 ? 0 : half + 14);
      const y1 = ys[by + 1] - (by === ys.length - 2 ? 0 : half + 14);
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 70 || bh < 70) continue;
      // The western strip is beach, not buildings.
      if (x0 < 200) continue;
      const district = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      // One block in six is a park with palms.
      if (rng.chance(0.16) && bw > 130 && bh > 130) {
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        const count = Math.floor((bw * bh) / 9000);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: rng.range(x0 + 20, x1 - 20), y: rng.range(y0 + 20, y1 - 20) });
        }
        continue;
      }
      // Split big blocks into two or four buildings.
      const cols = bw > 260 ? 2 : 1;
      const rows = bh > 220 ? 2 : 1;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          const w = bw / cols - 18;
          const h = bh / rows - 18;
          if (w < 46 || h < 46) continue;
          const tall = district.name === 'Downtown' && rng.chance(0.55);
          buildings.push({
            x: x0 + (cx * bw) / cols + 9,
            y: y0 + (cy * bh) / rows + 9,
            w,
            h,
            color: rng.pick(district.palette),
            tall,
            district: district.name,
          });
        }
      }
      // A palm or two on the block corners.
      if (rng.chance(0.5)) trees.push({ x: x0 + 12, y: y0 + 12 });
      if (rng.chance(0.5)) trees.push({ x: x1 - 12, y: y1 - 12 });
    }
  }
  return { buildings, trees, parks };
}

/** Is the point on a road (within the road width, plus a little shoulder)? */
export function onRoad(x, y) {
  const half = ROADS.width / 2 + 6;
  for (const rx of ROADS.vertical) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS.horizontal) if (Math.abs(y - ry) <= half) return true;
  return false;
}

/** Nearest point on the road grid to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS.vertical) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 0, WORLD.height) }; }
  }
  for (const ry of ROADS.horizontal) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 0, WORLD.width), y: ry }; }
  }
  return best;
}

export function createWorld(seed) {
  const rng = createRandom(seed);
  const city = buildCity(rng);
  const state = {
    seed,
    rng,
    time: 0,
    buildings: city.buildings,
    trees: city.trees,
    parks: city.parks,
    player: null,
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    toasts: [],
    events: 0,
    camera: { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y },
    mission: null,
    completedMissions: [],
    money: 120,
    stats: { carsStolen: 0, arrests: 0, wasted: 0, shotsFired: 0, pedsHit: 0, missionsDone: 0 },
    dialog: null,
    paused: false,
    over: null,
    shotMode: false,
  };

  function makePlayer(x, y) {
    return {
      x, y,
      angle: -Math.PI / 2,
      health: PLAYER.healthMax,
      money: state.money,
      ammo: PLAYER.magazine,
      reserve: 60,
      reload: 0,
      firing: 0,
      shotCooldown: 0,
      car: null,
      wanted: 0,
      wantedTimer: 0,
      lastCrimeAt: -999,
      bustHold: 0,
      invulnerable: 0,
      running: false,
    };
  }

  function makeCar(x, y, angle, model, kind) {
    return {
      id: state.cars.length + 1,
      x, y, angle,
      speed: 0,
      model: model.name,
      body: model.body,
      roof: model.roof,
      kind, // 'traffic' | 'parked' | 'police' | 'player'
      axis: 'v',
      dir: 1,
      lane: 0,
      targetSpeed: TRAFFIC.carSpeed,
      health: 100,
      driver: kind === 'traffic',
      brakeLight: false,
      horn: 0,
    };
  }

  /** Put a car on a road, driving along it. `near` biases the spawn toward a point. */
  function spawnTrafficCar(near) {
    const vertical = rng.chance(0.5);
    let x;
    let y;
    let angle;
    let axis;
    let dir;
    if (vertical) {
      const road = rng.pick(ROADS.vertical);
      const lane = rng.chance(0.5) ? -ROADS.lane : ROADS.lane;
      x = road + lane;
      y = near ? clamp(near.y + rng.range(-500, 500), 60, WORLD.height - 60) : rng.range(60, WORLD.height - 60);
      dir = lane < 0 ? 1 : -1; // right-hand traffic: east lane goes south
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      axis = 'v';
    } else {
      const road = rng.pick(ROADS.horizontal);
      const lane = rng.chance(0.5) ? -ROADS.lane : ROADS.lane;
      y = road + lane;
      x = near ? clamp(near.x + rng.range(-500, 500), 60, WORLD.width - 60) : rng.range(60, WORLD.width - 60);
      dir = lane < 0 ? 1 : -1;
      angle = dir > 0 ? 0 : Math.PI;
      axis = 'h';
    }
    const car = makeCar(x, y, angle, rng.pick(CAR_MODELS), 'traffic');
    car.axis = axis;
    car.dir = dir;
    car.speed = TRAFFIC.carSpeed * rng.range(0.8, 1.1);
    state.cars.push(car);
    return car;
  }

  function spawnParkedCar() {
    // Parked along a road edge, near a random intersection.
    const road = rng.pick(ROADS.vertical);
    const cross = rng.pick(ROADS.horizontal);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = road + side * (ROADS.width / 2 + 16);
    const y = clamp(cross + rng.range(-140, 140), 60, WORLD.height - 60);
    const car = makeCar(x, y, side > 0 ? Math.PI / 2 : -Math.PI / 2, rng.pick(CAR_MODELS), 'parked');
    state.cars.push(car);
    return car;
  }

  function spawnPed(near) {
    const road = rng.pick(ROADS.vertical);
    const cross = rng.pick(ROADS.horizontal);
    const onVertical = rng.chance(0.5);
    let x;
    let y;
    if (onVertical) {
      x = road + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 12);
      y = near ? clamp(near.y + rng.range(-400, 400), 40, WORLD.height - 40) : rng.range(40, WORLD.height - 40);
    } else {
      y = cross + (rng.chance(0.5) ? 1 : -1) * (ROADS.width / 2 + 12);
      x = near ? clamp(near.x + rng.range(-400, 400), 40, WORLD.width - 40) : rng.range(40, WORLD.width - 40);
    }
    const ped = {
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: TRAFFIC.pedSpeed * rng.range(0.7, 1.3),
      color: rng.pick(PED_COLORS),
      kind: 'walker',
      health: 100,
      wait: rng.range(0, 3),
      targetX: x,
      targetY: y,
      scared: 0,
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnPoliceCar(near) {
    const point = nearestRoadPoint(
      clamp(near.x + (rng.chance(0.5) ? 1 : -1) * POLICE.spawnDistance, 80, WORLD.width - 80),
      clamp(near.y + (rng.chance(0.5) ? 1 : -1) * POLICE.spawnDistance, 80, WORLD.height - 80),
    );
    const car = makeCar(point.x, point.y, 0, { name: 'PD Interceptor', body: '#1c2733', roof: '#f5f2e8' }, 'police');
    car.speed = POLICE.copCarSpeed * 0.7;
    car.maxSpeed = POLICE.copCarSpeed;
    state.cars.push(car);
    return car;
  }

  function spawnCopOnFoot(near) {
    const ped = spawnPed(near);
    ped.kind = 'cop';
    ped.color = '#1c2733';
    ped.speed = 260;
    ped.health = 100;
    return ped;
  }

  function spawnGangster(x, y) {
    const ped = {
      x, y,
      angle: rng.range(0, Math.PI * 2),
      speed: 150,
      color: '#5a1f1f',
      kind: 'gang',
      health: 100,
      wait: 0,
      targetX: x,
      targetY: y,
      scared: 0,
      shootTimer: rng.range(0.5, 1.5),
    };
    state.peds.push(ped);
    return ped;
  }

  function addToast(text, seconds = 3) {
    state.toasts.push({ text, left: seconds });
  }

  function addParticles(x, y, color, count, speed = 160) {
    for (let i = 0; i < count; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.3, speed);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rng.range(0.3, 0.8), max: 0.8, color, size: rng.range(2, 5) });
    }
  }

  function reset() {
    state.time = 0;
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.toasts = [];
    state.events = 0;
    state.mission = null;
    state.completedMissions = [];
    state.money = 120;
    state.stats = { carsStolen: 0, arrests: 0, wasted: 0, shotsFired: 0, pedsHit: 0, missionsDone: 0 };
    state.dialog = null;
    state.over = null;
    state.player = makePlayer(LANDMARKS.safehouse.x, LANDMARKS.safehouse.y);
    // The player's first ride: a yellow taxi waiting at the stand.
    const taxi = makeCar(LANDMARKS.taxiStand.x, LANDMARKS.taxiStand.y, Math.PI / 2, CAR_MODELS[2], 'parked');
    state.cars.push(taxi);
    for (let i = 0; i < TRAFFIC.cars; i += 1) spawnTrafficCar();
    for (let i = 0; i < 6; i += 1) spawnParkedCar();
    for (let i = 0; i < TRAFFIC.peds; i += 1) spawnPed();
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  // Spawn hooks the traffic module uses to keep the streets busy near the player.
  state._spawnTraffic = (near) => spawnTrafficCar(near);
  state._spawnPed = (near) => spawnPed(near);
  state._spawnPoliceCar = (near) => spawnPoliceCar(near);
  state._spawnCop = (near) => spawnCopOnFoot(near);
  state._spawnGang = (x, y) => spawnGangster(x, y);
  state._particles = (x, y, color, count, speed) => addParticles(x, y, color, count, speed);

  reset();

  return {
    state,
    reset,
    spawnTrafficCar,
    spawnParkedCar,
    spawnPed,
    spawnPoliceCar,
    spawnCopOnFoot,
    spawnGangster,
    addToast,
    addParticles,
    makePlayer,
  };
}

/** First building the circle (x, y, r) overlaps, or null. */
export function hitBuilding(state, x, y, r) {
  for (const b of state.buildings) {
    const cx = clamp(x, b.x, b.x + b.w);
    const cy = clamp(y, b.y, b.y + b.h);
    if (dist(x, y, cx, cy) < r) return b;
  }
  return null;
}

/** Push a circle out of buildings and the world edge; returns the building hit, if any. */
export function resolveCircle(state, body, r) {
  let hit = null;
  for (const b of state.buildings) {
    const cx = clamp(body.x, b.x, b.x + b.w);
    const cy = clamp(body.y, b.y, b.y + b.h);
    const d = dist(body.x, body.y, cx, cy);
    if (d < r && d > 0.001) {
      const push = (r - d) / d;
      body.x += (body.x - cx) * push;
      body.y += (body.y - cy) * push;
      hit = b;
    } else if (d <= 0.001) {
      body.x = b.x - r;
      hit = b;
    }
  }
  body.x = clamp(body.x, 24, WORLD.width - 24);
  body.y = clamp(body.y, 24, WORLD.height - 24);
  return hit;
}

/** Keep a point inside the world. */
export function clampToWorld(body) {
  body.x = clamp(body.x, 24, WORLD.width - 24);
  body.y = clamp(body.y, 24, WORLD.height - 24);
}
