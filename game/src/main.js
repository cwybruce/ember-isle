// Ember Isle — main game: state, loop, missions, wanted level, police, combat, save.
import { buildWorld, tileAt, isSolidFor, isDriveable, T, WORLD_W, WORLD_H } from './world.js';
import { makeTerrainCanvas, drawWorld, drawEntities, drawMinimap } from './render.js';
import { makeAudio } from './audio.js';
import { makeInput } from './input.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mmCanvas = document.getElementById('minimap');
const mmCtx = mmCanvas.getContext('2d');
const $ = (id) => document.getElementById(id);

const WEAPONS = {
  pistol: { name: 'Pistol', dmg: 34, rate: 0.28, spread: 0.05, speed: 900, mag: 12, auto: false },
  smg: { name: 'SMG', dmg: 16, rate: 0.09, spread: 0.12, speed: 950, mag: 32, auto: true },
  shotgun: { name: 'Shotgun', dmg: 15, rate: 0.7, spread: 0.22, speed: 800, mag: 6, auto: false, pellets: 6 },
};

const MISSIONS = [
  {
    id: 'm1', name: 'Hot Wheels', giver: 'Mara Voss',
    brief: 'Mara needs a ride. Steal the green Dune Pickup in town and bring it to Rook\'s Garage.',
    target: (w) => ({ x: w.places.town.x - 60, y: w.places.town.y + 210 }),
    done: (s) => s.player.vehicle && s.player.vehicle.kind === 'pickup' && near(s.player, s.world.places.garage, 170),
    reward: 500, wantedOnStart: 1,
  },
  {
    id: 'm2', name: 'Beach Run', giver: 'Old Finn',
    brief: 'Finn stashed a package on the little islet west of the docks. Take a boat from the pier, grab it, and bring it back to the Beach Shack.',
    target: (w) => ({ x: w.places.islet.x, y: w.places.islet.y }),
    done: (s) => s.flags.gotPackage && near(s.player, s.world.places.beach, 150),
    reward: 800, wantedOnStart: 0,
  },
  {
    id: 'm3', name: 'Volcano Heist', giver: 'Dr. Ash',
    brief: 'The Observatory holds a crate of survey gold. Grab it — the mountain is awake and so are the cops.',
    target: (w) => ({ x: w.places.observatory.x, y: w.places.observatory.y }),
    done: (s) => s.flags.gotCrate && near(s.player, s.world.places.hideout, 170),
    reward: 1500, wantedOnStart: 2,
  },
  {
    id: 'm4', name: 'Ember King', giver: 'Mara Voss',
    brief: 'Last job. Deliver the Syndicate ledger to the Hideout with a 3-star tail on you. Lose the cops or outrun them — then the island is yours.',
    target: (w) => ({ x: w.places.hideout.x, y: w.places.hideout.y }),
    done: (s) => near(s.player, s.world.places.hideout, 150) && s.flags.deliveredLedger,
    reward: 3000, wantedOnStart: 3,
  },
];

function near(p, place, r) { return Math.hypot(p.x - place.x, p.y - place.y) < r; }

const audio = makeAudio();
const input = makeInput(canvas);
const world = buildWorld(20261122);
const terrain = makeTerrainCanvas(world, world.rand);

const state = {
  world, terrain,
  mode: 'menu', // menu | playing | paused | gameover
  time: 0, clock: 8 * 60, day: 1,
  player: {
    x: world.places.garage.x + 40, y: world.places.garage.y + 190,
    angle: 0, aimAngle: 0, health: 100, money: 250,
    weapon: 'pistol', ammo: 12, reserve: 60, fireCd: 0,
    inVehicle: false, vehicle: null, speed: 0,
  },
  wanted: 0, wantedHeat: 0,
  missionIdx: 0, missionStage: 'brief', // brief | active | done
  flags: {},
  waypoint: null,
  peds: [], traffic: [], police: [], bullets: [], pickups: [],
  particles: [],
  toast: '', toastUntil: 0,
  stats: { stolen: 0, arrests: 0, kills: 0 },
  saveSlot: null,
};

// --- NPC spawns ------------------------------------------------------------
const PED_COLORS = ['#ffd43b', '#74c0fc', '#ffa8a8', '#b2f2bb', '#d0bfff', '#ff8787'];
function spawnPeds(n) {
  for (let i = 0; i < n; i++) {
    const wps = world.waypoints;
    const wp = wps[Math.floor(Math.random() * wps.length)];
    state.peds.push({
      x: wp[0] + (Math.random() - 0.5) * 120, y: wp[1] + (Math.random() - 0.5) * 120,
      angle: Math.random() * Math.PI * 2, speed: 26 + Math.random() * 22,
      color: PED_COLORS[i % PED_COLORS.length], fleeing: false, retarget: 0,
    });
  }
}
function spawnTraffic(n) {
  const colors = ['#e03131', '#1971c2', '#f08c00', '#2f9e44', '#e9ecef', '#fab005'];
  for (let i = 0; i < n; i++) {
    const wps = world.waypoints;
    const idx = Math.floor(Math.random() * wps.length);
    const wp = wps[idx], next = wps[(idx + 1) % wps.length];
    state.traffic.push({
      kind: Math.random() < 0.3 ? 'pickup' : 'sedan', x: wp[0], y: wp[1],
      angle: Math.atan2(next[1] - wp[1], next[0] - wp[0]),
      color: colors[i % colors.length], speed: 90 + Math.random() * 50,
      wpIdx: idx, vx: 0, vy: 0, health: 100, npc: true, police: false,
    });
  }
}
spawnPeds(26);
spawnTraffic(9);

// --- helpers ---------------------------------------------------------------
function toast(title, sub = '', secs = 3.5) {
  $('toast').innerHTML = sub ? `${title}<small>${sub}</small>` : title;
  state.toastUntil = state.time + secs;
}
function addWanted(n, reason) {
  const before = state.wanted;
  state.wanted = Math.min(5, state.wanted + n);
  state.wantedHeat = 100;
  if (state.wanted > before) {
    toast(`${'★'.repeat(state.wanted)} WANTED LEVEL ${state.wanted}`, reason || 'The law is coming.');
    audio.siren();
  }
}
function setObjective(html) { $('objective').innerHTML = html; }
function updateHUD() {
  const p = state.player;
  let stars = '';
  for (let i = 0; i < 5; i++) stars += `<span class="${i < state.wanted ? '' : 'off'}">★</span>`;
  $('stars').innerHTML = stars;
  $('healthfill').style.width = `${Math.max(0, p.health)}%`;
  $('healthfill').style.background = p.health > 50 ? 'linear-gradient(90deg,#37d67a,#a5e635)' : p.health > 25 ? 'linear-gradient(90deg,#fab005,#ffd43b)' : 'linear-gradient(90deg,#e03131,#ff8787)';
  $('money').textContent = `$${p.money.toLocaleString('en-US')}`;
  const hh = Math.floor(state.clock / 60) % 24, mm = Math.floor(state.clock % 60);
  const night = isNight();
  $('clock').textContent = `Day ${state.day} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${night ? 'Night — volcano glow' : 'Day'}`;
  const w = WEAPONS[p.weapon];
  $('vehname').textContent = p.inVehicle && p.vehicle
    ? `${p.vehicle.name} · ${w.name} ${p.ammo}/${p.reserve}`
    : `${w.name} ${p.ammo}/${p.reserve} · on foot`;
  document.querySelector('#speedo .big').textContent = Math.round(Math.abs(p.speed || 0) * 0.36);
  if (state.time > state.toastUntil) $('toast').innerHTML = '';
}
function isNight() {
  const hh = Math.floor(state.clock / 60) % 24;
  return hh >= 19 || hh < 6;
}

// --- missions --------------------------------------------------------------
function currentMission() { return MISSIONS[state.missionIdx] || null; }
function startMission() {
  const m = currentMission();
  if (!m) { setObjective('<b>Free roam.</b> The island is yours. Cause chaos, lose the cops, or just drive the coast road at sunset.'); state.waypoint = null; return; }
  state.missionStage = 'active';
  state.waypoint = m.target(world);
  if (m.wantedOnStart > state.wanted) addWanted(m.wantedOnStart - state.wanted, `${m.giver} warned you: this one is loud.`);
  setObjective(`<b>${m.name}</b> — ${m.giver}<br>${m.brief}<br>Reward: <b>$${m.reward}</b>`);
  toast(`MISSION: ${m.name}`, m.giver);
  audio.mission();
}
function completeMission() {
  const m = currentMission();
  state.player.money += m.reward;
  state.flags = {};
  audio.cash();
  toast(`MISSION COMPLETE: ${m.name}`, `+$${m.reward} · Next job incoming…`, 4);
  state.missionIdx++;
  state.missionStage = 'brief';
  setTimeout(() => { if (state.mode === 'playing') startMission(); }, 2500);
  state.waypoint = null;
}

// --- combat / vehicles -----------------------------------------------------
function tryEnterVehicle() {
  const p = state.player;
  if (p.inVehicle) {
    const v = p.vehicle;
    p.inVehicle = false; p.vehicle = null;
    p.x = v.x + Math.cos(v.angle + Math.PI / 2) * 44;
    p.y = v.y + Math.sin(v.angle + Math.PI / 2) * 44;
    p.speed = 0;
    audio.stopEngine();
    return;
  }
  let best = null, bestD = 70;
  for (const v of world.vehicles) {
    const d = Math.hypot(v.x - p.x, v.y - p.y);
    if (d < bestD) { best = v; bestD = d; }
  }
  if (best) {
    if (best.parked) { best.parked = false; state.stats.stolen++; addWanted(1, 'Grand theft auto. Someone saw that.'); }
    p.inVehicle = true; p.vehicle = best; p.speed = 0;
    toast(best.name, 'E to get out · WASD to drive');
    audio.unlock();
  }
}
function shoot() {
  const p = state.player;
  if (p.fireCd > 0 || p.inVehicle) return;
  const w = WEAPONS[p.weapon];
  if (p.ammo <= 0) { toast('RELOAD!', 'Press R'); return; }
  p.ammo--; p.fireCd = w.rate;
  audio.shoot(p.weapon);
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = p.aimAngle + (Math.random() - 0.5) * w.spread * 2;
    state.bullets.push({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed, life: 0.7, dmg: w.dmg });
  }
  state.particles.push({ x: p.x + Math.cos(p.aimAngle) * 20, y: p.y + Math.sin(p.aimAngle) * 20, life: 0.08, kind: 'flash' });
}
function damagePlayer(n) {
  const p = state.player;
  p.health -= n;
  if (p.health <= 0) {
    p.health = 0;
    state.mode = 'gameover';
    $('gameover-text').textContent = state.wanted > 0
      ? `Wasted at wanted level ${state.wanted}. The Ember Isle police impounded your ride and your pride.`
      : 'You went down on Ember Isle. The volcano keeps glowing without you.';
    $('gameover').classList.remove('hidden');
    audio.stopEngine();
  }
}

// --- police ----------------------------------------------------------------
function policeTargetCount() {
  return state.wanted === 0 ? 0 : state.wanted <= 1 ? 1 : state.wanted <= 2 ? 2 : state.wanted <= 3 ? 3 : 4;
}
function spawnPolice() {
  const p = state.player;
  const a = Math.random() * Math.PI * 2;
  state.police.push({
    kind: 'sedan', x: p.x + Math.cos(a) * 700, y: p.y + Math.sin(a) * 700,
    angle: 0, color: '#1c1c1c', speed: 300 + state.wanted * 14,
    vx: 0, vy: 0, health: 100, npc: true, police: true, ramCd: 0,
  });
}

// --- save ------------------------------------------------------------------
const SAVE_KEY = 'ember-isle-save-v1';
function saveGame() {
  const p = state.player;
  const data = { x: p.x, y: p.y, money: p.money, health: p.health, missionIdx: state.missionIdx, wanted: state.wanted, day: state.day, clock: state.clock, weapon: p.weapon, ammo: p.ammo, reserve: p.reserve };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); toast('GAME SAVED', 'Progress stored in this browser.'); } catch { toast('SAVE FAILED', 'Browser storage unavailable.'); }
}
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// --- update ----------------------------------------------------------------
function update(dt) {
  state.time += dt;
  state.clock += dt * 0.9; // ~1 game hour per 67 real seconds
  if (state.clock >= 24 * 60) { state.clock -= 24 * 60; state.day++; }
  const p = state.player;
  p.fireCd = Math.max(0, p.fireCd - dt);

  // aim
  const rect = canvas.getBoundingClientRect();
  const mx = input.mouse.x - rect.left, my = input.mouse.y - rect.top;
  const cam = camera();
  p.aimAngle = Math.atan2(my - canvas.height / 2, mx - canvas.width / 2);

  // wanted decay
  if (state.wanted > 0) {
    state.wantedHeat = Math.max(0, state.wantedHeat - dt * (p.inVehicle ? 1.2 : 2.2));
    if (state.wantedHeat <= 0) {
      state.wanted--;
      state.wantedHeat = state.wanted > 0 ? 60 : 0;
      if (state.wanted === 0) toast('CLEAN', 'You slipped the tail. For now.');
    }
  }
  while (state.police.length < policeTargetCount()) spawnPolice();
  if (state.wanted === 0 && state.police.length) state.police.length = 0;

  // --- player movement ---
  const onWater = p.inVehicle && p.vehicle && p.vehicle.kind === 'boat';
  if (p.inVehicle && p.vehicle) {
    const v = p.vehicle;
    const fwd = (input.isDown('w') || input.isDown('arrowup') ? 1 : 0) - (input.isDown('s') || input.isDown('arrowdown') ? 0.55 : 0);
    const steer = (input.isDown('a') || input.isDown('arrowleft') ? -1 : 0) + (input.isDown('d') || input.isDown('arrowright') ? 1 : 0);
    const maxSpeed = v.speed * (onWater ? 1 : 1);
    p.speed += fwd * (onWater ? 140 : 260) * dt;
    p.speed *= Math.pow(onWater ? 0.9 : 0.85, dt); // drag (cars coast; S brakes/reverses)
    p.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, p.speed));
    if (Math.abs(p.speed) > 5) v.angle += steer * 1.9 * dt * Math.sign(p.speed) * (onWater ? 0.7 : 1);
    const nx = v.x + Math.cos(v.angle) * p.speed * dt;
    const ny = v.y + Math.sin(v.angle) * p.speed * dt;
    if (onWater) {
      if (tileAt(world, nx, ny) === T.WATER || tileAt(world, nx, ny) === T.BEACH || tileAt(world, nx, ny) === T.DOCK) { v.x = nx; v.y = ny; }
      else { p.speed *= -0.3; audio.crash(); }
    } else if (isDriveable(world, nx, ny) && !hitBuilding(nx, ny, 20)) {
      v.x = nx; v.y = ny;
    } else {
      if (Math.abs(p.speed) > 120) { audio.crash(); burst(v.x, v.y, '#ffb347', 10); }
      p.speed *= -0.25;
    }
    p.x = v.x; p.y = v.y; p.angle = v.angle;
    if (Math.abs(p.speed) > 20) audio.startEngine(Math.abs(p.speed)); else audio.stopEngine();
    // running over peds (crime!)
    for (const ped of state.peds) {
      if (Math.hypot(ped.x - v.x, ped.y - v.y) < 26 && Math.abs(p.speed) > 60) {
        ped.fleeing = true; ped.x += Math.cos(v.angle) * 30; ped.y += Math.sin(v.angle) * 30;
        addWanted(1, 'You ran someone over. Bad look.');
      }
    }
  } else {
    const sp = (input.isDown('shift') ? 250 : 165) * dt;
    let dx = (input.isDown('d') || input.isDown('arrowright') ? 1 : 0) - (input.isDown('a') || input.isDown('arrowleft') ? 1 : 0);
    let dy = (input.isDown('s') || input.isDown('arrowdown') ? 1 : 0) - (input.isDown('w') || input.isDown('arrowup') ? 1 : 0);
    if (dx || dy) {
      const l = Math.hypot(dx, dy); dx /= l; dy /= l;
      const nx = p.x + dx * sp, ny = p.y + dy * sp;
      if (!isSolidFor(world, nx, p.y, false) && !hitBuilding(nx, p.y, 12)) p.x = nx;
      if (!isSolidFor(world, p.x, ny, false) && !hitBuilding(p.x, ny, 12)) p.y = ny;
      p.angle = Math.atan2(dy, dx);
    }
    p.speed = 0;
    if (input.mouse.down || input.mouse.clicked) shoot();
  }

  // weapon switching / reload / enter vehicle / pause / mute
  if (input.wasPressed('1')) { p.weapon = 'pistol'; p.ammo = Math.min(p.ammo, 12); }
  if (input.wasPressed('2')) { p.weapon = 'smg'; }
  if (input.wasPressed('3')) { p.weapon = 'shotgun'; }
  if (input.wasPressed('r')) {
    const w = WEAPONS[p.weapon];
    const need = w.mag - p.ammo;
    const take = Math.min(need, p.reserve);
    if (take > 0) { p.ammo += take; p.reserve -= take; audio.pickup(); }
  }
  if (input.wasPressed('e')) tryEnterVehicle();
  if (input.wasPressed('m')) { const m = audio.toggleMute(); toast(m ? 'SOUND OFF' : 'SOUND ON'); }
  if (input.wasPressed('p') || input.wasPressed('escape')) pauseGame();

  // --- bullets ---
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      for (const ped of state.peds) {
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 12) {
          ped.fleeing = true; ped.x += b.vx * 0.02; ped.y += b.vy * 0.02;
          burst(b.x, b.y, '#ff5a5a', 6); audio.hit();
          addWanted(1, 'Shots fired in public. Witnesses called it in.');
          dead = true; break;
        }
      }
      if (!dead) for (const v of state.police) {
        if (Math.hypot(v.x - b.x, v.y - b.y) < 26) { v.health -= b.dmg; burst(b.x, b.y, '#ffd23e', 6); dead = true; if (v.health <= 0) { burst(v.x, v.y, '#ff5a5a', 20); state.police.splice(state.police.indexOf(v), 1); addWanted(1, 'You shot a cop car. That escalates things.'); } break; }
      }
      if (!dead && isSolidFor(world, b.x, b.y, false)) { burst(b.x, b.y, '#ccc', 4); dead = true; }
    }
    if (dead) b.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  // --- peds ---
  for (const ped of state.peds) {
    ped.retarget -= dt;
    if (ped.retarget <= 0) { ped.angle = Math.random() * Math.PI * 2; ped.retarget = 2 + Math.random() * 4; }
    const away = Math.atan2(ped.y - p.y, ped.x - p.x);
    const fleeing = ped.fleeing || Math.hypot(ped.x - p.x, ped.y - p.y) < 60;
    const sp = ped.speed * (fleeing ? 2.1 : 1) * dt;
    const a = fleeing ? away : ped.angle;
    const nx = ped.x + Math.cos(a) * sp, ny = ped.y + Math.sin(a) * sp;
    if (!isSolidFor(world, nx, ny, false) && !hitBuilding(nx, ny, 10)) { ped.x = nx; ped.y = ny; }
    ped.angle = a;
  }

  // --- traffic ---
  for (const v of state.traffic) {
    const wps = world.waypoints;
    const target = wps[v.wpIdx % wps.length];
    const d = Math.hypot(target[0] - v.x, target[1] - v.y);
    if (d < 40) v.wpIdx = (v.wpIdx + 1 + Math.floor(Math.random() * 2)) % wps.length;
    const want = Math.atan2(target[1] - v.y, target[0] - v.x);
    let diff = want - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.angle += Math.max(-1.4 * dt, Math.min(1.4 * dt, diff));
    const nx = v.x + Math.cos(v.angle) * v.speed * dt;
    const ny = v.y + Math.sin(v.angle) * v.speed * dt;
    if (isDriveable(world, nx, ny) && !hitBuilding(nx, ny, 18)) { v.x = nx; v.y = ny; }
    else v.wpIdx = (v.wpIdx + 5) % wps.length;
  }

  // --- police chase ---
  for (const v of state.police) {
    v.ramCd -= dt;
    const want = Math.atan2(p.y - v.y, p.x - v.x);
    let diff = want - v.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    v.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
    const sp = v.speed * (Math.abs(diff) > 1.2 ? 0.5 : 1);
    const nx = v.x + Math.cos(v.angle) * sp * dt;
    const ny = v.y + Math.sin(v.angle) * sp * dt;
    if (isDriveable(world, nx, ny) && !hitBuilding(nx, ny, 18)) { v.x = nx; v.y = ny; }
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < 46 && v.ramCd <= 0) {
      v.ramCd = 0.9;
      damagePlayer(p.inVehicle ? 6 : 14);
      burst(p.x, p.y, '#ff5a5a', 8);
      audio.crash();
      if (p.inVehicle && p.vehicle) p.speed *= 0.4;
    }
    if (v.health <= 0) { burst(v.x, v.y, '#ff5a5a', 20); state.police.splice(state.police.indexOf(v), 1); }
  }

  // --- pickups ---
  for (const pk of state.pickups) {
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      if (pk.kind === 'cash') { p.money += pk.value; audio.cash(); toast(`+$${pk.value}`); }
      else if (pk.kind === 'health') { p.health = Math.min(100, p.health + 40); audio.pickup(); toast('HEALTH +40'); }
      else if (pk.kind === 'ammo') { p.reserve += 48; audio.pickup(); toast('AMMO +48'); }
      else if (pk.kind === 'package') { state.flags.gotPackage = true; audio.mission(); toast('PACKAGE SECURED', 'Bring it to the Beach Shack.'); state.waypoint = { x: world.places.beach.x, y: world.places.beach.y }; }
      else if (pk.kind === 'crate') { state.flags.gotCrate = true; audio.mission(); toast('SURVEY GOLD SECURED', 'Get to the Hideout — the cops are coming.'); addWanted(1, 'The Observatory alarm is screaming.'); state.waypoint = { x: world.places.hideout.x, y: world.places.hideout.y }; }
      else if (pk.kind === 'ledger') { state.flags.deliveredLedger = true; audio.mission(); toast('LEDGER IN HAND', 'Deliver it to the Hideout.'); state.waypoint = { x: world.places.hideout.x, y: world.places.hideout.y }; }
      pk.taken = true;
    }
  }
  state.pickups = state.pickups.filter((pk) => !pk.taken);

  // mission item spawns
  const m = currentMission();
  if (m && state.missionStage === 'active') {
    if (m.id === 'm2' && !state.flags.gotPackage && !state.pickups.some((pk) => pk.kind === 'package') && near(p, world.places.islet, 260)) {
      state.pickups.push({ kind: 'package', x: world.places.islet.x, y: world.places.islet.y, value: 0 });
    }
    if (m.id === 'm3' && !state.flags.gotCrate && !state.pickups.some((pk) => pk.kind === 'crate') && near(p, world.places.observatory, 260)) {
      state.pickups.push({ kind: 'crate', x: world.places.observatory.x, y: world.places.observatory.y, value: 0 });
    }
    if (m.id === 'm4' && !state.flags.deliveredLedger && !state.pickups.some((pk) => pk.kind === 'ledger') && near(p, world.places.town, 300)) {
      state.pickups.push({ kind: 'ledger', x: world.places.town.x + 190, y: world.places.town.y - 30, value: 0 });
    }
    if (m.done(state)) completeMission();
  }

  // ambient pickups respawn
  if (state.pickups.filter((pk) => pk.kind === 'cash').length < 4 && Math.random() < dt * 0.05) {
    const wp = world.waypoints[Math.floor(Math.random() * world.waypoints.length)];
    state.pickups.push({ kind: Math.random() < 0.6 ? 'cash' : Math.random() < 0.5 ? 'health' : 'ammo', x: wp[0], y: wp[1], value: 50 + Math.floor(Math.random() * 150) });
  }

  // particles
  for (const pt of state.particles) pt.life -= dt;
  state.particles = state.particles.filter((pt) => pt.life > 0);

  // lava damage
  if (!p.inVehicle && tileAt(world, p.x, p.y) === T.LAVA) damagePlayer(30 * dt);
  if (p.inVehicle && p.vehicle && tileAt(world, p.x, p.y) === T.LAVA) { /* cars can't enter lava (blocked) */ }

  updateHUD();
  input.endFrame();
}
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) state.particles.push({ x, y, life: 0.3 + Math.random() * 0.3, kind: 'spark', color, vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.5) * 200 });
}
function hitBuilding(x, y, pad) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return true;
  }
  return false;
}

// --- camera / render -------------------------------------------------------
function camera() {
  const p = state.player;
  const w = canvas.width, h = canvas.height;
  return {
    x: Math.max(0, Math.min(WORLD_W - w, p.x - w / 2)),
    y: Math.max(0, Math.min(WORLD_H - h, p.y - h / 2)),
    w, h,
  };
}
function render() {
  const cam = camera();
  const night = isNight() ? 1 : 0;
  drawWorld(ctx, world, terrain, cam, state.time, night);
  drawEntities(ctx, state, cam, state.time);
  // particles
  for (const pt of state.particles) {
    ctx.fillStyle = pt.color || '#ffe066';
    ctx.globalAlpha = Math.max(0, pt.life * 3);
    ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.kind === 'flash' ? 12 : 3, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // crosshair
  if (state.mode === 'playing' && !state.player.inVehicle) {
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
    const mx = input.mouse.x, my = input.mouse.y;
    ctx.beginPath(); ctx.arc(mx, my, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 13, my); ctx.lineTo(mx - 5, my); ctx.moveTo(mx + 5, my); ctx.lineTo(mx + 13, my);
    ctx.moveTo(mx, my - 13); ctx.lineTo(mx, my - 5); ctx.moveTo(mx, my + 5); ctx.lineTo(mx, my + 13); ctx.stroke();
  }
  drawMinimap(mmCtx, state);
}

// --- flow ------------------------------------------------------------------
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

function showScreen(id) {
  for (const s of ['menu', 'pause', 'gameover']) $(s).classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}
function startGame(fromSave) {
  if (fromSave) {
    const s = loadSave();
    if (s) {
      Object.assign(state.player, { x: s.x, y: s.y, money: s.money, health: s.health, weapon: s.weapon, ammo: s.ammo, reserve: s.reserve });
      state.missionIdx = s.missionIdx; state.wanted = s.wanted; state.day = s.day; state.clock = s.clock;
    }
  } else {
    Object.assign(state.player, { x: world.places.garage.x + 40, y: world.places.garage.y + 190, health: 100, money: 250, weapon: 'pistol', ammo: 12, reserve: 60, inVehicle: false, vehicle: null });
    state.missionIdx = 0; state.wanted = 0; state.wantedHeat = 0; state.day = 1; state.clock = 8 * 60; state.flags = {};
  }
  state.mode = 'playing';
  showScreen(null);
  audio.unlock();
  startMission();
  $('status').textContent = 'Ember Isle started. Follow the gold waypoint.';
}
function pauseGame() {
  if (state.mode !== 'playing') return;
  state.mode = 'paused';
  showScreen('pause');
  audio.stopEngine();
}
function resumeGame() { state.mode = 'playing'; showScreen(null); audio.unlock(); }

$('btn-start').addEventListener('click', () => startGame(false));
$('btn-continue').addEventListener('click', () => startGame(true));
$('btn-resume').addEventListener('click', resumeGame);
$('btn-save').addEventListener('click', () => { saveGame(); resumeGame(); });
$('btn-quit').addEventListener('click', () => { state.mode = 'menu'; showScreen('menu'); refreshMenu(); });
$('btn-retry').addEventListener('click', () => startGame(false));
$('btn-menu2').addEventListener('click', () => { state.mode = 'menu'; showScreen('menu'); refreshMenu(); });

function refreshMenu() {
  $('btn-continue').classList.toggle('hidden', !loadSave());
}
refreshMenu();

// screenshot presets (?shot=...) — see shots.js
const shotApplied = applyShot(state, world, { startGame, startMission, toast, setObjective });
if (shotApplied) {
  // keep the menu visible for the start shot; hide HUD clutter for clean frames
  if (new URLSearchParams(location.search).get('shot') === 'start') { /* menu stays */ }
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'playing') update(dt);
  else if (state.mode === 'menu') { state.time += dt; }
  if (state.mode !== 'menu' || new URLSearchParams(location.search).get('shot')) render();
  else render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
