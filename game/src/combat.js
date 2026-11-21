// Combat: the pistol, bullets, and the people who shoot back. Bullets fly straight, stop
// at buildings, and hurt the first person they meet; shooting a bystander or a cop is a
// crime, shooting a gangster is self-defence. Gangsters take cover in place and fire back
// when the player gets close.
import { PLAYER } from './config.js';
import { angleDiff, clamp, dist, hitBuilding } from './world.js';
import { addWanted } from './police.js';

const BULLET_SPEED = 900;
const GANG_RANGE = 420;
const GANG_FIRE_INTERVAL = 1.6;
const GANG_DAMAGE = 9;

/** Fire the pistol toward a world point. Returns true if a shot left the barrel. */
export function firePistol(state, tx, ty) {
  const p = state.player;
  if (p.car) return false; // no drive-bys: get out to shoot
  if (p.reload > 0 || p.ammo <= 0) return false;
  const angle = Math.atan2(ty - p.y, tx - p.x);
  p.angle = angle;
  p.ammo -= 1;
  p.firing = 0.12;
  state.stats.shotsFired += 1;
  state.bullets.push({
    x: p.x + Math.cos(angle) * 20,
    y: p.y + Math.sin(angle) * 20,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: PLAYER.pistolRange / BULLET_SPEED,
    friendly: true,
    damage: PLAYER.pistolDamage,
  });
  state.events |= 32; // EVENT_SHOT
  return true;
}

/** Start reloading (R). Takes a moment; the magazine refills from the reserve. */
export function startReload(state) {
  const p = state.player;
  if (p.reload > 0 || p.ammo === PLAYER.magazine || p.reserve <= 0) return false;
  p.reload = PLAYER.reloadSeconds;
  return true;
}

export function updateReload(state, dt) {
  const p = state.player;
  if (p.reload > 0) {
    p.reload -= dt;
    if (p.reload <= 0) {
      const need = PLAYER.magazine - p.ammo;
      const take = Math.min(need, p.reserve);
      p.ammo += take;
      p.reserve -= take;
      p.reload = 0;
    }
  }
  if (p.firing > 0) p.firing -= dt;
}

/** Move bullets, test hits against people and buildings. */
export function updateBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && hitBuilding(state, b.x, b.y, 2)) {
      if (state._particles) state._particles(b.x, b.y, '#e8d44d', 4, 120);
      dead = true;
    }
    if (!dead) {
      // Friendly bullets can hit gangsters, cops and bystanders; enemy bullets hit the player.
      if (b.friendly) {
        for (const ped of state.peds) {
          if (ped.health <= 0) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.health -= b.damage;
            dead = true;
            if (ped.kind === 'gang') {
              ped.targetX = p.x;
              ped.targetY = p.y;
              ped.shootTimer = Math.min(ped.shootTimer, 0.4);
            } else if (ped.kind === 'cop') {
              addWanted(state, 1);
            } else {
              ped.scared = 4;
              state.stats.pedsHit += 1;
              addWanted(state, 1);
            }
            break;
          }
        }
      } else if (p.health > 0 && p.invulnerable <= 0 && dist(b.x, b.y, p.x, p.y) < 15) {
        p.health -= b.damage;
        p.lastHurtAt = state.time;
        dead = true;
        if (p.health <= 0) {
          p.health = 0;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

/** Gangsters: stand their ground, strafe a little, and shoot when the player is in range. */
export function updateGangsters(state, dt) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.kind !== 'gang' || ped.health <= 0) continue;
    const d = dist(ped.x, ped.y, p.x, p.y);
    ped.shootTimer -= dt;
    if (d < GANG_RANGE && p.health > 0) {
      // Face the player and fire.
      ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
      ped.targetX = p.x;
      ped.targetY = p.y;
      if (ped.shootTimer <= 0) {
        ped.shootTimer = GANG_FIRE_INTERVAL * (0.8 + state.rng.next() * 0.5);
        const angle = ped.angle + (state.rng.next() - 0.5) * 0.22;
        state.bullets.push({
          x: ped.x + Math.cos(angle) * 20,
          y: ped.y + Math.sin(angle) * 20,
          vx: Math.cos(angle) * BULLET_SPEED * 0.85,
          vy: Math.sin(angle) * BULLET_SPEED * 0.85,
          life: GANG_RANGE / BULLET_SPEED,
          friendly: false,
          damage: GANG_DAMAGE,
        });
        state.events |= 32;
      }
    } else {
      // Drift back toward their post.
      const dx = ped.targetX - ped.x;
      const dy = ped.targetY - ped.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 24) {
        ped.angle = Math.atan2(dy, dx);
        ped.x += (dx / dd) * ped.speed * 0.5 * dt;
        ped.y += (dy / dd) * ped.speed * 0.5 * dt;
      }
    }
  }
}

/** Hurt the player by an amount (car hits, bullets, melee). Returns true if they went down. */
export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invulnerable > 0 || p.health <= 0) return false;
  p.health -= amount;
  p.lastHurtAt = state.time;
  if (p.health <= 0) {
    p.health = 0;
    return true;
  }
  return false;
}
