// The HUD: cash, health, ammo, wanted stars, the mission objective, and the minimap.
// Everything is drawn on the canvas in screen space, after the world. The minimap is a
// small live map of the whole city: roads, the player, cars, police and the objective.
import { COLORS, LANDMARKS, ROADS, WORLD } from './config.js';
import { currentObjective } from './missions.js';

const MAP_SIZE = 190;
const MAP_MARGIN = 14;

export function drawHUD(ctx, state, view) {
  const p = state.player;
  const w = view.width;
  const h = view.height;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: cash, health bar, ammo. Taller when driving, for the car line.
  drawPanel(ctx, 12, 12, 250, p.car ? 112 : 86);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(`$${state.money}`, 26, 40);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#c9c4b4';
  ctx.fillText('MARA SOLIS', 26, 58);
  // Health bar.
  ctx.fillStyle = '#222';
  ctx.fillRect(26, 66, 150, 10);
  ctx.fillStyle = p.health > 40 ? '#5ac96f' : '#e84a4a';
  ctx.fillRect(26, 66, 150 * Math.max(0, p.health / 100), 10);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.health)} HP`, 182, 75);
  // Ammo / reload.
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = p.reload > 0 ? '#ffd34d' : COLORS.hudText;
  const ammoText = p.reload > 0 ? 'RELOADING…' : `AMMO ${p.ammo} / ${p.reserve}`;
  ctx.fillText(ammoText, 26, 92);
  if (p.car) {
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${p.car.model}  •  ${Math.round(Math.abs(p.car.speed) * 0.12)} mph`, 26, 112);
  }

  // Top-right: wanted stars. Taller when wanted, for the cool-off hint.
  drawPanel(ctx, w - 12 - 210, 12, 210, p.wanted > 0 ? 86 : 52);
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillStyle = '#c9c4b4';
  ctx.fillText('WANTED', w - 12 - 196, 32);
  for (let i = 0; i < 5; i += 1) {
    const x = w - 12 - 196 + i * 34;
    const y = 50;
    ctx.fillStyle = i < p.wanted ? COLORS.wanted : 'rgba(255,255,255,0.22)';
    drawStar(ctx, x + 11, y, 11, i < p.wanted && Math.floor(state.time * 4) % 2 === 0);
  }
  if (p.wanted > 0) {
    ctx.fillStyle = '#ff8a8a';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('Lose the cops to cool off', w - 12 - 196, 82);
  }

  // Bottom-centre: mission objective.
  const obj = currentObjective(state);
  if (obj) {
    const label = obj.label;
    ctx.font = 'bold 15px system-ui, sans-serif';
    const tw = ctx.measureText(label).width;
    const bw = Math.min(w - 40, tw + 48);
    drawPanel(ctx, (w - bw) / 2, h - 64, bw, 40);
    ctx.fillStyle = COLORS.accent;
    ctx.fillText('◆ ' + label, (w - bw) / 2 + 24, h - 38);
  }

  // Toasts above the objective line.
  let ty = h - 116;
  ctx.font = '14px system-ui, sans-serif';
  for (const toast of state.toasts) {
    const tw = ctx.measureText(toast.text).width;
    drawPanel(ctx, (w - tw - 32) / 2, ty, tw + 32, 30);
    ctx.fillStyle = COLORS.hudText;
    ctx.fillText(toast.text, (w - tw) / 2, ty + 20);
    ty -= 36;
  }

  // Minimap, bottom-right.
  drawMinimap(ctx, state, w - MAP_MARGIN - MAP_SIZE, h - MAP_MARGIN - MAP_SIZE - 8, MAP_SIZE);

  // Crosshair when on foot and armed.
  if (!p.car && view.mouse) {
    const mx = view.mouse.x;
    const my = view.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.moveTo(mx - 14, my);
    ctx.lineTo(mx - 5, my);
    ctx.moveTo(mx + 5, my);
    ctx.lineTo(mx + 14, my);
    ctx.moveTo(mx, my - 14);
    ctx.lineTo(mx, my - 5);
    ctx.moveTo(mx, my + 5);
    ctx.lineTo(mx, my + 14);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = COLORS.hudPanel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
}

function drawStar(ctx, x, y, r, glow) {
  ctx.save();
  if (glow) {
    ctx.shadowColor = '#ff4d4d';
    ctx.shadowBlur = 12;
  }
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rad;
    const py = y + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawMinimap(ctx, state, x, y, size) {
  const scale = size / Math.max(WORLD.width, WORLD.height);
  ctx.save();
  ctx.fillStyle = 'rgba(12,18,28,0.78)';
  ctx.beginPath();
  ctx.roundRect(x - 6, y - 6, size + 12, size + 12, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  // Ground: grass, then the beach strip on the west edge.
  ctx.fillStyle = '#5d8a48';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#c9b183';
  ctx.fillRect(x, y, 180 * scale, size);
  ctx.fillStyle = '#2b87a8';
  ctx.fillRect(x, y, 60 * scale, size);
  // Roads.
  ctx.strokeStyle = '#3a3a42';
  ctx.lineWidth = Math.max(2, ROADS.width * scale);
  for (const rx of ROADS.vertical) {
    ctx.beginPath();
    ctx.moveTo(x + rx * scale, y);
    ctx.lineTo(x + rx * scale, y + size);
    ctx.stroke();
  }
  for (const ry of ROADS.horizontal) {
    ctx.beginPath();
    ctx.moveTo(x, y + ry * scale);
    ctx.lineTo(x + size, y + ry * scale);
    ctx.stroke();
  }
  // Landmarks: hospital, police, bank.
  ctx.fillStyle = '#f5f2e8';
  for (const key of ['hospital', 'policeStation', 'bank']) {
    const lm = LANDMARKS[key];
    ctx.fillRect(x + lm.x * scale - 2, y + lm.y * scale - 2, 4, 4);
  }
  // Objective marker (pulsing yellow diamond).
  const obj = currentObjective(state);
  if (obj) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = COLORS.accent;
    ctx.save();
    ctx.translate(x + obj.x * scale, y + obj.y * scale);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  // Cars: traffic amber, police flashing blue/red, player's car white.
  for (const car of state.cars) {
    if (car.kind === 'police') {
      ctx.fillStyle = Math.floor(state.time * 4) % 2 === 0 ? '#2f6df6' : '#ff4d4d';
    } else if (car.kind === 'player') {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = '#ffd34d';
    }
    ctx.fillRect(x + car.x * scale - 2, y + car.y * scale - 2, 4, 4);
  }
  // The player: a white arrow pointing where they face.
  const p = state.player;
  ctx.save();
  ctx.translate(x + p.x * scale, y + p.y * scale);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  // Frame label.
  ctx.fillStyle = 'rgba(245,242,232,0.85)';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText('SOLMAR CITY', x, y - 10);
}
