// Ember Isle world: island terrain, roads, town, volcano, docks, vehicles, NPCs.
// All original. Deterministic from a seed so screenshots are reproducible.
export const TILE = 32;
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const COLS = WORLD_W / TILE; // 100
export const ROWS = WORLD_H / TILE; // 75

// Terrain codes
export const T = { WATER: 0, BEACH: 1, GRASS: 2, JUNGLE: 3, ROAD: 4, TOWN: 5, LAVA: 6, ROCK: 7, DOCK: 8 };

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

export function buildWorld(seed = 20261122) {
  const rand = mulberry32(seed);
  const grid = new Uint8Array(COLS * ROWS);
  const cx = WORLD_W / 2, cy = WORLD_H * 0.30; // volcano centre (north)
  const at = (c, r) => grid[r * COLS + c];
  const set = (c, r, v) => { if (c >= 0 && c < COLS && r >= 0 && r < ROWS) grid[r * COLS + c] = v; };

  // Base: island ellipse with noisy coast, water outside.
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
      const nx = (x - cx) / (WORLD_W * 0.46), ny = (y - cy) / (WORLD_H * 0.44);
      const wob = 0.10 * Math.sin(x * 0.004 + 1.7) + 0.08 * Math.cos(y * 0.005 + 0.4);
      const d = Math.hypot(nx, ny) + wob;
      let t = T.GRASS;
      if (d > 1.0) t = T.WATER;
      else if (d > 0.93) t = T.BEACH;
      else if (rand() < 0.30) t = T.JUNGLE;
      grid[r * COLS + c] = t;
    }
  }

  // Volcano: rock cone + lava crater + lava flows.
  const volcano = { x: cx, y: cy, r: 330 };
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
      const d = dist(x, y, cx, cy);
      if (d < 120) set(c, r, T.LAVA);
      else if (d < 330) set(c, r, T.ROCK);
    }
  }
  // Lava flows: two winding streams from crater to the sea.
  const flows = [];
  for (const [ang, len] of [[2.35, 620], [0.85, 700], [3.6, 520]]) {
    let x = cx, y = cy, a = ang;
    const pts = [];
    for (let i = 0; i < len; i += 26) {
      a += (rand() - 0.5) * 0.35;
      x += Math.cos(a) * 26; y += Math.sin(a) * 26;
      pts.push([x, y]);
      const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (at(c + dc, r + dr) !== T.WATER) set(c + dc, r + dr, T.LAVA);
      }
      if (at(c, r) === T.WATER) break;
    }
    flows.push(pts);
  }

  // Roads: ring road around the volcano + spokes to town, docks, beach, observatory.
  const roads = [];
  function road(a, b) {
    roads.push([a, b]);
    const steps = Math.ceil(dist(a[0], a[1], b[0], b[1]) / 16);
    for (let i = 0; i <= steps; i++) {
      const x = a[0] + (b[0] - a[0]) * i / steps;
      const y = a[1] + (b[1] - a[1]) * i / steps;
      const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) {
        if (at(c + dc, r + dr) !== T.WATER && at(c + dc, r + dr) !== T.LAVA) set(c + dc, r + dr, T.ROAD);
      }
    }
  }
  const town = { x: WORLD_W * 0.30, y: WORLD_H * 0.66 };
  const docks = { x: WORLD_W * 0.16, y: WORLD_H * 0.55 };
  const beach = { x: WORLD_W * 0.78, y: WORLD_H * 0.78 };
  const observatory = { x: cx + 420, y: cy + 260 };
  const garage = { x: WORLD_W * 0.42, y: WORLD_H * 0.62 };
  const hideout = { x: WORLD_W * 0.70, y: WORLD_H * 0.55 };
  const islet = { x: WORLD_W * 0.10, y: WORLD_H * 0.30 };
  // ring road (octagon around volcano)
  const ring = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring.push([cx + Math.cos(a) * 560, cy + Math.sin(a) * 470]);
  }
  for (let i = 0; i < 8; i++) road(ring[i], ring[(i + 1) % 8]);
  road([town.x, town.y], [ring[5][0], ring[5][1]]);
  road([docks.x, docks.y], [ring[4][0], ring[4][1]]);
  road([beach.x, beach.y], [ring[2][0], ring[2][1]]);
  road([observatory.x, observatory.y], [ring[1][0], ring[1][1]]);
  road([garage.x, garage.y], [town.x, town.y]);
  road([hideout.x, hideout.y], [ring[0][0], ring[0][1]]);
  road([town.x, town.y], [beach.x, beach.y]);

  // Town ground
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
    if (dist(x, y, town.x, town.y) < 260 && at(c, r) !== T.ROAD && at(c, r) !== T.WATER) set(c, r, T.TOWN);
  }
  // Docks: wooden pier into the water
  for (let i = 0; i < 14; i++) {
    const x = docks.x - 20 - i * 26, y = docks.y;
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    set(c, r, T.DOCK); set(c, r + 1, T.DOCK);
  }
  // Small islet off the west coast
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
    if (dist(x, y, islet.x, islet.y) < 110) set(c, r, T.BEACH);
  }

  // Buildings (rects, no overlap with roads/lava/water)
  const buildings = [];
  function addBuilding(x, y, w, h, kind, label) {
    buildings.push({ x, y, w, h, kind, label });
  }
  // Town blocks
  const townSpots = [
    [town.x - 150, town.y - 130, 120, 84, 'shop', 'Corner Store'],
    [town.x + 60, town.y - 140, 140, 90, 'bar', 'The Molten Mug'],
    [town.x - 170, town.y + 40, 130, 90, 'house', 'Row House'],
    [town.x + 50, town.y + 60, 150, 96, 'hotel', 'Ember Hotel'],
    [town.x - 40, town.y - 210, 110, 80, 'police', 'Police Station'],
    [town.x + 190, town.y - 30, 100, 80, 'house', 'Beach House'],
  ];
  for (const [x, y, w, h, kind, label] of townSpots) addBuilding(x, y, w, h, kind, label);
  addBuilding(garage.x - 90, garage.y - 60, 180, 120, 'garage', "Rook's Garage");
  addBuilding(observatory.x - 70, observatory.y - 50, 140, 100, 'observatory', 'Volcano Observatory');
  addBuilding(hideout.x - 80, hideout.y - 55, 160, 110, 'hideout', 'Hideout');
  addBuilding(beach.x - 60, beach.y - 40, 120, 80, 'shack', 'Beach Shack');
  addBuilding(docks.x + 30, docks.y - 90, 110, 70, 'warehouse', 'Dock Warehouse');

  // Trees (jungle + scattered), avoid roads/buildings/lava/water
  const trees = [];
  function blocked(x, y) {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    const t = (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? T.WATER : at(c, r);
    if (t === T.ROAD || t === T.WATER || t === T.LAVA || t === T.DOCK || t === T.TOWN) return true;
    for (const b of buildings) if (x > b.x - 24 && x < b.x + b.w + 24 && y > b.y - 24 && y < b.y + b.h + 24) return true;
    return false;
  }
  for (let i = 0; i < 2600; i++) {
    const x = rand() * WORLD_W, y = rand() * WORLD_H;
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    const t = at(c, r);
    const p = t === T.JUNGLE ? 0.30 : t === T.GRASS ? 0.05 : 0;
    if (rand() < p && !blocked(x, y)) trees.push({ x, y, s: 0.8 + rand() * 0.6, palm: t === T.BEACH || rand() < 0.25 });
  }
  // Palm fringe on beaches
  for (let i = 0; i < 120; i++) {
    const a = rand() * Math.PI * 2;
    const rr = 0.94 + rand() * 0.05;
    const x = cx + Math.cos(a) * WORLD_W * 0.46 * rr;
    const y = cy + Math.sin(a) * WORLD_H * 0.44 * rr;
    if (x > 0 && y > 0 && x < WORLD_W && y < WORLD_H && !blocked(x, y)) trees.push({ x, y, s: 0.9 + rand() * 0.5, palm: true });
  }

  // Road waypoints for traffic (the ring + spokes)
  const waypoints = [];
  for (const [a, b] of roads) {
    const steps = Math.max(2, Math.round(dist(a[0], a[1], b[0], b[1]) / 220));
    for (let i = 0; i <= steps; i++) waypoints.push([a[0] + (b[0] - a[0]) * i / steps, a[1] + (b[1] - a[1]) * i / steps]);
  }

  // Vehicles: player-usable + traffic spawns
  const vehicles = [];
  const vehDefs = [
    { kind: 'offroad', x: garage.x + 40, y: garage.y + 150, color: '#e8590c', name: 'Trailblazer 4x4', speed: 340 },
    { kind: 'pickup', x: town.x - 60, y: town.y + 210, color: '#2f9e44', name: 'Dune Pickup', speed: 320 },
    { kind: 'sedan', x: town.x + 200, y: town.y + 180, color: '#1971c2', name: 'Island Sedan', speed: 330 },
    { kind: 'boat', x: docks.x - 180, y: docks.y + 40, color: '#f1f3f5', name: 'Harbor Skiff', speed: 260 },
    { kind: 'boat', x: docks.x - 120, y: docks.y - 60, color: '#ffd43b', name: 'Sunfish Boat', speed: 260 },
    { kind: 'pickup', x: beach.x + 120, y: beach.y + 60, color: '#862e9c', name: 'Sand Runner', speed: 320 },
    { kind: 'offroad', x: hideout.x + 140, y: hideout.y + 90, color: '#c2255c', name: 'Cinder Buggy', speed: 350 },
  ];
  vehDefs.forEach((v, i) => vehicles.push({ id: i, ...v, angle: rand() * Math.PI * 2, vx: 0, vy: 0, health: 100, parked: true, npc: false }));

  return {
    seed, grid, volcano, flows, roads, buildings, trees, waypoints,
    places: { town, docks, beach, observatory, garage, hideout, islet },
    vehicles, rand,
  };
}

export function tileAt(world, x, y) {
  const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return T.WATER;
  return world.grid[r * COLS + c];
}

export function isSolidFor(world, x, y, onWater) {
  const t = tileAt(world, x, y);
  if (onWater) return t !== T.WATER && t !== T.DOCK && t !== T.BEACH;
  if (t === T.WATER || t === T.LAVA) return true;
  for (const b of world.buildings) {
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

export function isDriveable(world, x, y) {
  const t = tileAt(world, x, y);
  return t !== T.WATER && t !== T.LAVA;
}
