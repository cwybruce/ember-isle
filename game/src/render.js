// Ember Isle rendering: pre-rendered terrain, entities, effects, minimap.
import { TILE, COLS, ROWS, WORLD_W, WORLD_H, T, tileAt } from './world.js';

const TERRAIN_COLORS = {
  [T.WATER]: '#0b3d66', [T.BEACH]: '#d9b380', [T.GRASS]: '#4d8a3f',
  [T.JUNGLE]: '#2e6b2f', [T.ROAD]: '#3a3f46', [T.TOWN]: '#6b6f75',
  [T.LAVA]: '#ff5a00', [T.ROCK]: '#4a3f3a', [T.DOCK]: '#8a6a45',
};

export function makeTerrainCanvas(world, rand) {
  const cv = document.createElement('canvas');
  cv.width = WORLD_W; cv.height = WORLD_H;
  const g = cv.getContext('2d');
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = world.grid[r * COLS + c];
      g.fillStyle = TERRAIN_COLORS[t];
      g.fillRect(c * TILE, r * TILE, TILE, TILE);
      // subtle per-tile variation
      const v = (rand() - 0.5) * 14;
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 160})` : `rgba(0,0,0,${-v / 160})`;
      g.fillRect(c * TILE, r * TILE, TILE, TILE);
    }
  }
  // road centre dashes
  g.strokeStyle = 'rgba(255,220,120,.55)';
  g.lineWidth = 3; g.setLineDash([22, 26]);
  for (const [a, b] of world.roads) {
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  g.setLineDash([]);
  // lava crater glow core
  const vg = g.createRadialGradient(world.volcano.x, world.volcano.y, 20, world.volcano.x, world.volcano.y, 160);
  vg.addColorStop(0, '#fff3b0'); vg.addColorStop(0.45, '#ff7a00'); vg.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = vg; g.beginPath(); g.arc(world.volcano.x, world.volcano.y, 160, 0, Math.PI * 2); g.fill();
  // beach foam ring
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 5;
  for (let i = 0; i < 220; i++) {
    const a = (i / 220) * Math.PI * 2;
    const x = world.volcano.x + Math.cos(a) * WORLD_W * 0.46 * 0.97;
    const y = world.volcano.y + Math.sin(a) * WORLD_H * 0.44 * 0.97;
    g.beginPath(); g.arc(x, y, 6 + (i % 5), 0, Math.PI * 2); g.stroke();
  }
  // buildings
  for (const b of world.buildings) {
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    const cols = { shop: '#c9a227', bar: '#8b3a2f', house: '#7a6a58', hotel: '#4a6fa5', police: '#2f4b7c', garage: '#5c5c66', observatory: '#9c7a3c', hideout: '#3d5a45', shack: '#a08050', warehouse: '#6e5a3e' };
    g.fillStyle = cols[b.kind] || '#777';
    g.fillRect(b.x, b.y, b.w, b.h);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.fillRect(b.x, b.y, b.w, 12);
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2;
    g.strokeRect(b.x, b.y, b.w, b.h);
    g.fillStyle = '#fff';
    g.font = 'bold 13px Verdana';
    g.fillText(b.label, b.x + 6, b.y + b.h / 2 + 4);
  }
  // docks pier planks
  g.strokeStyle = 'rgba(0,0,0,.25)';
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (world.grid[r * COLS + c] === T.DOCK) {
      g.beginPath(); g.moveTo(c * TILE, r * TILE + 16); g.lineTo(c * TILE + TILE, r * TILE + 16); g.stroke();
    }
  }
  return cv;
}

export function drawWorld(ctx, world, terrain, cam, time, night) {
  ctx.drawImage(terrain, cam.x, cam.y, cam.w, cam.h, 0, 0, cam.w, cam.h);
  // animated lava shimmer
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
  ctx.fillStyle = `rgba(255,${Math.floor(120 + 80 * pulse)},0,${0.10 + 0.08 * pulse})`;
  ctx.beginPath(); ctx.arc(world.volcano.x - cam.x, world.volcano.y - cam.y, 150, 0, Math.PI * 2); ctx.fill();
  // lava flow glow dots
  for (const flow of world.flows) {
    for (let i = 0; i < flow.length; i += 3) {
      const [x, y] = flow[i];
      const sx = x - cam.x, sy = y - cam.y;
      if (sx < -40 || sy < -40 || sx > cam.w + 40 || sy > cam.h + 40) continue;
      ctx.fillStyle = `rgba(255,${140 + Math.floor(60 * Math.sin(time * 3 + i))},20,.8)`;
      ctx.beginPath(); ctx.arc(sx, sy, 4 + 2 * Math.sin(time * 2 + i), 0, Math.PI * 2); ctx.fill();
    }
  }
  // water sparkle
  ctx.fillStyle = 'rgba(255,255,255,.10)';
  for (let i = 0; i < 60; i++) {
    const x = ((i * 397 + time * 12) % WORLD_W) - cam.x;
    const y = ((i * 251 + time * 7) % WORLD_H) - cam.y;
    if (tileAt(world, x + cam.x, y + cam.y) === T.WATER) ctx.fillRect(x, y, 5, 2);
  }
  // trees
  for (const tr of world.trees) {
    const sx = tr.x - cam.x, sy = tr.y - cam.y;
    if (sx < -30 || sy < -30 || sx > cam.w + 30 || sy > cam.h + 30) continue;
    ctx.fillStyle = '#5a3d22';
    ctx.fillRect(sx - 2, sy - 2, 4, 8);
    if (tr.palm) {
      ctx.strokeStyle = '#2f7d32'; ctx.lineWidth = 3;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        ctx.beginPath(); ctx.moveTo(sx, sy - 4);
        ctx.lineTo(sx + Math.cos(a) * 13 * tr.s, sy - 4 + Math.sin(a) * 9 * tr.s); ctx.stroke();
      }
      ctx.fillStyle = '#8d6e3f'; ctx.beginPath(); ctx.arc(sx, sy - 4, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#1f5c26';
      ctx.beginPath(); ctx.arc(sx, sy - 6, 11 * tr.s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2e7d32';
      ctx.beginPath(); ctx.arc(sx - 3, sy - 9, 7 * tr.s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // night overlay + volcano glow
  if (night > 0) {
    ctx.fillStyle = `rgba(6,10,34,${0.42 * night})`;
    ctx.fillRect(0, 0, cam.w, cam.h);
    const gx = world.volcano.x - cam.x, gy = world.volcano.y - cam.y;
    const glow = ctx.createRadialGradient(gx, gy, 40, gx, gy, 520);
    glow.addColorStop(0, `rgba(255,90,0,${0.55 * night})`);
    glow.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(gx, gy, 520, 0, Math.PI * 2); ctx.fill();
  }
}

function drawVehicle(ctx, v, sx, sy, time) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(v.angle);
  const isBoat = v.kind === 'boat';
  const len = isBoat ? 64 : 52, wid = isBoat ? 24 : 26;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
  ctx.fillStyle = v.color;
  if (isBoat) {
    ctx.beginPath();
    ctx.moveTo(len / 2, 0); ctx.lineTo(len / 2 - 14, -wid / 2); ctx.lineTo(-len / 2, -wid / 2);
    ctx.lineTo(-len / 2, wid / 2); ctx.lineTo(len / 2 - 14, wid / 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(-8, -wid / 2 + 4, 22, wid - 8);
  } else {
    ctx.fillRect(-len / 2, -wid / 2, len, wid);
    ctx.fillStyle = 'rgba(20,30,40,.85)'; ctx.fillRect(-4, -wid / 2 + 3, 16, wid - 6);
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(len / 2 - 3, -wid / 2 + 2, 3, 6); ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 6);
    ctx.fillStyle = '#ff5a5a';
    ctx.fillRect(-len / 2, -wid / 2 + 2, 3, 6); ctx.fillRect(-len / 2, wid / 2 - 8, 3, 6);
  }
  ctx.fillStyle = '#111';
  ctx.fillRect(-len / 2 + 6, -wid / 2 - 3, 10, 4); ctx.fillRect(-len / 2 + 6, wid / 2 - 1, 10, 4);
  ctx.fillRect(len / 2 - 16, -wid / 2 - 3, 10, 4); ctx.fillRect(len / 2 - 16, wid / 2 - 1, 10, 4);
  ctx.restore();
  if (v.police) {
    const blink = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = blink ? '#ff2d2d' : '#2d7dff';
    ctx.beginPath(); ctx.arc(sx, sy - 16, 5, 0, Math.PI * 2); ctx.fill();
  }
}

export function drawEntities(ctx, state, cam, time) {
  const { world } = state;
  // mission waypoint marker
  const wp = state.waypoint;
  if (wp) {
    const sx = wp.x - cam.x, sy = wp.y - cam.y;
    const bob = Math.sin(time * 3) * 6;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.moveTo(sx, sy - 34 + bob); ctx.lineTo(sx - 12, sy - 58 + bob); ctx.lineTo(sx + 12, sy - 58 + bob); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,62,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx, sy, 18 + 4 * Math.sin(time * 3), 0, Math.PI * 2); ctx.stroke();
  }
  // vehicles
  for (const v of world.vehicles) drawVehicle(ctx, v, v.x - cam.x, v.y - cam.y, time);
  for (const v of state.police) drawVehicle(ctx, v, v.x - cam.x, v.y - cam.y, time);
  for (const v of state.traffic) drawVehicle(ctx, v, v.x - cam.x, v.y - cam.y, time);
  // pedestrians
  for (const p of state.peds) {
    const sx = p.x - cam.x, sy = p.y - cam.y;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(sx + Math.cos(p.angle) * 4, sy + Math.sin(p.angle) * 4, 3.5, 0, Math.PI * 2); ctx.fill();
    if (p.fleeing) {
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px Verdana';
      ctx.fillText('!', sx - 2, sy - 12);
    }
  }
  // pickups / mission items
  for (const pk of state.pickups) {
    const sx = pk.x - cam.x, sy = pk.y - cam.y;
    const bob = Math.sin(time * 4) * 3;
    ctx.fillStyle = pk.kind === 'cash' ? '#37d67a' : pk.kind === 'health' ? '#ff5a5a' : '#ffd23e';
    ctx.beginPath(); ctx.arc(sx, sy + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = 'bold 11px Verdana'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : '◆', sx, sy + bob + 4);
    ctx.textAlign = 'left';
  }
  // bullets
  ctx.fillStyle = '#ffe066';
  for (const b of state.bullets) {
    ctx.beginPath(); ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // player
  const p = state.player;
  const px = p.x - cam.x, py = p.y - cam.y;
  ctx.save(); ctx.translate(px, py); ctx.rotate(p.aimAngle);
  ctx.fillStyle = '#1b1b1b';
  ctx.fillRect(6, -2, 16, 4); // gun barrel
  ctx.restore();
  ctx.fillStyle = p.inVehicle ? 'rgba(0,0,0,0)' : '#ffcf9e';
  if (!p.inVehicle) {
    ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8590c';
    ctx.beginPath(); ctx.arc(px, py, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(px + Math.cos(p.aimAngle) * 5, py + Math.sin(p.aimAngle) * 5, 5, 0, Math.PI * 2); ctx.fill();
  }
  // off-screen waypoint arrow
  if (wp) {
    const dx = wp.x - p.x, dy = wp.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 500) {
      const a = Math.atan2(dy, dx);
      const ax = px + Math.cos(a) * 120, ay = py + Math.sin(a) * 120;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 12px Verdana';
      ctx.fillText(`${Math.round(d)}m`, ax - 14, ay + 26);
    }
  }
}

export function drawMinimap(ctx, state) {
  const mm = ctx.canvas;
  const sx = mm.width / WORLD_W, sy = mm.height / WORLD_H;
  ctx.clearRect(0, 0, mm.width, mm.height);
  ctx.drawImage(state.terrain, 0, 0, mm.width, mm.height);
  const p = state.player;
  ctx.fillStyle = '#ffd23e';
  if (state.waypoint) {
    ctx.beginPath(); ctx.arc(state.waypoint.x * sx, state.waypoint.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff2d2d';
  for (const v of state.police) { ctx.fillRect(v.x * sx - 2, v.y * sy - 2, 4, 4); }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
}
