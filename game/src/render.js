// Rendering: the camera, the city, the cars and people, particles and bullets, then the
// screens (title, pause, busted/wasted, dialogue). Everything is flat vector art drawn on
// one canvas — no images, no fonts to load, nothing over the network.
import { CAR, COLORS, LANDMARKS, ROADS, WORLD } from './config.js';
import { nextMission } from './missions.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_OVER = 3;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { width: 1280, height: 720, scale: 1 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    view = { width: w, height: h, scale: dpr };
  }
  window.addEventListener('resize', resize);
  resize();

  /** Camera: follow the player (or their car) with a soft lag, clamped to the city. */
  function cameraFor(state) {
    const p = state.player;
    const tx = p.x - view.width / 2;
    const ty = p.y - view.height / 2;
    state.camera.x += (tx - state.camera.x) * 0.08;
    state.camera.y += (ty - state.camera.y) * 0.08;
    state.camera.x = Math.max(-80, Math.min(WORLD.width - view.width + 80, state.camera.x));
    state.camera.y = Math.max(-80, Math.min(WORLD.height - view.height + 80, state.camera.y));
    return state.camera;
  }

  function drawWorld(state, cam) {
    const x0 = cam.x - 60;
    const y0 = cam.y - 60;
    const x1 = cam.x + view.width + 60;
    const y1 = cam.y + view.height + 60;
    // Ground: grass everywhere, sand on the west beach, water at the far west edge.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(Math.max(x0, 0), y0, Math.min(x1, 190) - Math.max(x0, 0), y1 - y0);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(Math.max(x0, 0), y0, Math.min(x1, 70) - Math.max(x0, 0), y1 - y0);
    ctx.fillStyle = COLORS.waterDeep;
    ctx.fillRect(Math.max(x0, 0), y0, Math.min(x1, 26) - Math.max(x0, 0), y1 - y0);
    // Parks.
    for (const park of state.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Roads: asphalt, edge lines, dashed centrelines.
    ctx.fillStyle = COLORS.road;
    for (const rx of ROADS.vertical) {
      if (rx < x0 - 60 || rx > x1 + 60) continue;
      ctx.fillRect(rx - ROADS.width / 2, Math.max(y0, 0), ROADS.width, Math.min(y1, WORLD.height) - Math.max(y0, 0));
    }
    for (const ry of ROADS.horizontal) {
      if (ry < y0 - 60 || ry > y1 + 60) continue;
      ctx.fillRect(Math.max(x0, 0), ry - ROADS.width / 2, Math.min(x1, WORLD.width) - Math.max(x0, 0), ROADS.width);
    }
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of ROADS.vertical) {
      if (rx < x0 - 60 || rx > x1 + 60) continue;
      ctx.beginPath();
      ctx.moveTo(rx, Math.max(y0, 0));
      ctx.lineTo(rx, Math.min(y1, WORLD.height));
      ctx.stroke();
    }
    for (const ry of ROADS.horizontal) {
      if (ry < y0 - 60 || ry > y1 + 60) continue;
      ctx.beginPath();
      ctx.moveTo(Math.max(x0, 0), ry);
      ctx.lineTo(Math.min(x1, WORLD.width), ry);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // Sidewalk edges.
    ctx.strokeStyle = COLORS.sidewalk;
    ctx.lineWidth = 8;
    for (const rx of ROADS.vertical) {
      if (rx < x0 - 60 || rx > x1 + 60) continue;
      ctx.beginPath();
      ctx.moveTo(rx - ROADS.width / 2 - 4, Math.max(y0, 0));
      ctx.lineTo(rx - ROADS.width / 2 - 4, Math.min(y1, WORLD.height));
      ctx.moveTo(rx + ROADS.width / 2 + 4, Math.max(y0, 0));
      ctx.lineTo(rx + ROADS.width / 2 + 4, Math.min(y1, WORLD.height));
      ctx.stroke();
    }
    // Buildings: shadow, body, roof line, and a tall-building face for Downtown.
    for (const b of state.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = COLORS.buildingShadow;
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // Windows: a grid of small darker squares.
      ctx.fillStyle = 'rgba(20,30,44,0.35)';
      const cols = Math.max(1, Math.floor(b.w / 26));
      const rows = Math.max(1, Math.floor(b.h / 26));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx + cy) % 2 === 0) ctx.fillRect(b.x + 8 + cx * 26, b.y + 8 + cy * 26, 12, 12);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, 10);
      }
    }
    // Palm trees.
    for (const tree of state.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      ctx.strokeStyle = '#7a5a34';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(tree.x, tree.y);
      ctx.lineTo(tree.x + 3, tree.y - 12);
      ctx.stroke();
      ctx.fillStyle = '#3f8f4f';
      ctx.beginPath();
      ctx.arc(tree.x + 3, tree.y - 16, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a866';
      ctx.beginPath();
      ctx.arc(tree.x - 2, tree.y - 20, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Landmark labels, small and warm.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(20,26,34,0.75)';
    for (const key of Object.keys(LANDMARKS)) {
      const lm = LANDMARKS[key];
      if (lm.x < x0 || lm.x > x1 || lm.y < y0 || lm.y > y1) continue;
      ctx.fillText(lm.label, lm.x - 30, lm.y - 44);
    }
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Body.
    ctx.fillStyle = car.body;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 10);
    ctx.fill();
    // Roof and windshield.
    ctx.fillStyle = car.roof;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2 + 16, -CAR.width / 2 + 6, CAR.length - 34, CAR.width - 12, 7);
    ctx.fill();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(CAR.length / 2 - 16, -CAR.width / 2 + 7, 8, CAR.width - 14);
    ctx.fillRect(-CAR.length / 2 + 8, -CAR.width / 2 + 7, 8, CAR.width - 14);
    // Headlights and tail lights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 4, 3, 8);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 12, 3, 8);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-CAR.length / 2, -CAR.width / 2 + 4, 3, 8);
    ctx.fillRect(-CAR.length / 2, CAR.width / 2 - 12, 3, 8);
    // Police livery: white doors, light bar.
    if (car.kind === 'police') {
      ctx.fillStyle = '#f5f2e8';
      ctx.fillRect(-CAR.length / 2 + 18, -CAR.width / 2, CAR.length - 36, CAR.width);
      ctx.fillStyle = '#2f6df6';
      ctx.fillRect(-6, -CAR.width / 2 - 2, 12, 8);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-6, CAR.width / 2 - 6, 12, 8);
    }
    if (car.brakeLight) {
      ctx.fillStyle = 'rgba(255,60,40,0.85)';
      ctx.fillRect(-CAR.length / 2 - 4, -CAR.width / 2 + 4, 4, 8);
      ctx.fillRect(-CAR.length / 2 - 4, CAR.width / 2 - 12, 4, 8);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-CAR.length / 2 - 4, -CAR.width / 2 - 4, CAR.length + 8, CAR.width + 8, 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPed(ped) {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body: a coloured circle with a head.
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Gangsters and cops wear a marker so the player reads the threat.
    if (ped.kind === 'gang') {
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (ped.kind === 'cop') {
      ctx.fillStyle = '#dfe8ff';
      ctx.beginPath();
      ctx.arc(0, -2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Health bar over hurt gangsters and cops.
    if ((ped.kind === 'gang' || ped.kind === 'cop') && ped.health < 100) {
      ctx.fillStyle = '#222';
      ctx.fillRect(-12, -22, 24, 4);
      ctx.fillStyle = '#e84a4a';
      ctx.fillRect(-12, -22, 24 * Math.max(0, ped.health / 100), 4);
    }
    ctx.restore();
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.car) return; // the car drawing shows them
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.invulnerable > 0 && Math.floor(state.time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 4, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Mara: teal jacket, dark hair, facing her aim.
    ctx.rotate(p.angle);
    ctx.fillStyle = '#0f8a7a';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(4, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2b2118';
    ctx.beginPath();
    ctx.arc(1, 0, 6, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    // Pistol in hand when firing.
    if (p.firing > 0) {
      ctx.fillStyle = '#222';
      ctx.fillRect(10, -2, 12, 4);
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(26, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function draw(state, screen, opts) {
    const cam = cameraFor(state);
    ctx.setTransform(view.scale, 0, 0, view.scale, 0, 0);
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawWorld(state, cam);
    // Objective marker on the ground: a pulsing ring.
    const obj = opts.objective;
    if (obj && screen === SCREEN_PLAY) {
      const pulse = 26 + Math.sin(state.time * 4) * 6;
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd34d';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(obj.marker || '!', obj.x - 6, obj.y - pulse - 6);
    }
    // Pickups (cash drops).
    for (const pk of state.pickups) {
      ctx.fillStyle = '#5ac96f';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('$', pk.x - 4, pk.y + 4);
    }
    for (const car of state.cars) drawCar(car, state.player.car === car);
    for (const ped of state.peds) drawPed(ped);
    drawPlayer(state);
    // Bullets: short bright streaks.
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.stroke();
    }
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (screen === SCREEN_TITLE) drawTitle(state);
    else if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_OVER) drawOver(state, opts.over);
    if (state.dialog) drawDialog(state);
  }

  function dim() {
    ctx.fillStyle = 'rgba(8,12,20,0.55)';
    ctx.fillRect(0, 0, view.width, view.height);
  }

  function centreText(text, y, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, (view.width - w) / 2, y);
  }

  function drawTitle(state) {
    dim();
    // Sun and skyline silhouette behind the title.
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    ctx.arc(view.width / 2, view.height * 0.32, 90, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,120,0.5)';
    ctx.beginPath();
    ctx.arc(view.width / 2, view.height * 0.32, 120, 0, Math.PI * 2);
    ctx.fill();
    centreText('SOLMAR CITY', view.height * 0.32 + 8, 'bold 84px system-ui, sans-serif', '#f5f2e8');
    centreText('An open-world crime story  •  sun, streets and one last score', view.height * 0.32 + 52, '20px system-ui, sans-serif', '#ffd34d');
    const next = nextMission(state);
    const lines = [
      next ? `Next job: ${next.title} — ${next.brief}` : 'Story complete — Solmar City is yours. Free roam!',
      '',
      'WASD / arrows — walk & drive      E — get in / out / steal a car',
      'Mouse — aim      Click — shoot      R — reload      F — melee      Shift — run',
      'M — start the next job      P / Esc — pause      Missions pay cash. The PD notices crime.',
      '',
      'ENTER — New game' + (state._hasSave ? '      C — Continue' : ''),
    ];
    let y = view.height * 0.5;
    for (const line of lines) {
      const bold = line.startsWith('ENTER') || line.startsWith('Next job');
      centreText(line, y, (bold ? 'bold ' : '') + '18px system-ui, sans-serif', bold ? '#ffd34d' : '#f5f2e8');
      y += 30;
    }
    centreText('Progress saves automatically. Best played with sound on.', view.height - 36, '14px system-ui, sans-serif', '#c9c4b4');
  }

  function drawPaused(state) {
    dim();
    centreText('PAUSED', view.height * 0.4, 'bold 56px system-ui, sans-serif', '#f5f2e8');
    centreText('P / Esc — resume      S — save now      Q — quit to title', view.height * 0.4 + 44, '18px system-ui, sans-serif', '#c9c4b4');
    centreText(`Cash $${state.money}  •  Jobs done ${state.completedMissions.length} / 4  •  Cars stolen ${state.stats.carsStolen}`, view.height * 0.4 + 84, '16px system-ui, sans-serif', '#ffd34d');
  }

  function drawOver(state, over) {
    dim();
    const title = over === 'busted' ? 'BUSTED' : 'WASTED';
    const sub = over === 'busted'
      ? `The PD took you in. Fine: $${state._lastFine ?? 0}.`
      : `You woke up at St. Lumen Hospital. Lost: $${state._lastLoss ?? 0}.`;
    centreText(title, view.height * 0.4, 'bold 64px system-ui, sans-serif', over === 'busted' ? '#7fb2ff' : '#ff6b6b');
    centreText(sub, view.height * 0.4 + 46, '20px system-ui, sans-serif', '#f5f2e8');
    centreText('ENTER — keep playing', view.height * 0.4 + 92, 'bold 18px system-ui, sans-serif', '#ffd34d');
  }

  function drawDialog(state) {
    const dlg = state.dialog;
    const line = dlg.lines[dlg.index];
    const w = Math.min(view.width - 80, 860);
    const x = (view.width - w) / 2;
    const y = view.height - 190;
    ctx.fillStyle = 'rgba(12,18,28,0.88)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 110, 10);
    ctx.fill();
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillText(line[0], x + 22, y + 30);
    ctx.fillStyle = '#f5f2e8';
    ctx.font = '18px system-ui, sans-serif';
    wrapText(line[1], x + 22, y + 58, w - 44, 24);
    ctx.fillStyle = '#c9c4b4';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('ENTER / click — continue', x + 22, y + 96);
  }

  function wrapText(text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  return { draw, resize, ctx, get view() { return view; } };
}
