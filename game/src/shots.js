// Screenshot presets for Ember Isle (?shot=<name>&seed=<n>).
// Each preset drops the player into a real, playable game state — nothing is faked:
// the frames are the game itself running in the browser.
export function applyShot(state, world, hooks) {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return false;
  const p = state.player;
  const menu = document.getElementById('menu');
  const hideMenu = () => { menu.classList.add('hidden'); state.mode = 'playing'; };

  if (shot === 'start') {
    // Title screen over the island at dawn.
    state.mode = 'menu';
    return true;
  }
  if (shot === 'drive') {
    hideMenu();
    state.clock = 17 * 60 + 30; // golden hour
    // On the town→beach coast road, heading along it (0.185 rad).
    p.x = 1344; p.y = 1656;
    const v = world.vehicles.find((vv) => vv.kind === 'offroad');
    v.x = p.x; v.y = p.y; v.angle = 0.185; v.parked = false;
    p.inVehicle = true; p.vehicle = v; p.speed = 240;
    state.wanted = 0;
    state.missionIdx = 0; state.missionStage = 'active';
    state.waypoint = { x: world.places.garage.x, y: world.places.garage.y };
    hooks.setObjective('<b>Hot Wheels</b> — Mara Voss<br>Steal the green Dune Pickup in town and bring it to Rook\'s Garage.<br>Reward: <b>$500</b>');
    return true;
  }
  if (shot === 'boat') {
    hideMenu();
    state.clock = 10 * 60 + 15; // bright morning on the water
    const v = world.vehicles.find((vv) => vv.kind === 'boat');
    v.x = world.places.docks.x - 170; v.y = world.places.docks.y + 120; v.angle = 2.6; v.parked = false;
    p.x = v.x; p.y = v.y;
    p.inVehicle = true; p.vehicle = v; p.speed = 180;
    state.wanted = 0;
    state.missionIdx = 1; state.missionStage = 'active';
    state.waypoint = { x: world.places.islet.x, y: world.places.islet.y };
    hooks.setObjective('<b>Beach Run</b> — Old Finn<br>Take a boat from the pier, grab the package on the little islet, bring it back to the Beach Shack.<br>Reward: <b>$800</b>');
    return true;
  }
  if (shot === 'night') {
    hideMenu();
    state.clock = 21 * 60 + 40; // deep night, volcano glow
    // Chase on the east ring road, lava flow glowing just off the road.
    const v = world.vehicles.find((vv) => vv.name === 'Cinder Buggy');
    v.x = world.volcano.x + 520; v.y = world.volcano.y + 330; v.angle = 0.9; v.parked = false;
    p.x = v.x; p.y = v.y;
    p.inVehicle = true; p.vehicle = v; p.speed = 240;
    p.health = 62; p.money = 2350;
    state.wanted = 3; state.wantedHeat = 80;
    state.missionIdx = 2; state.missionStage = 'active';
    state.waypoint = { x: world.places.hideout.x, y: world.places.hideout.y };
    // two police cars in pursuit
    for (let i = 0; i < 2; i++) {
      const a = 0.9 + Math.PI + (i - 0.5) * 0.5;
      state.police.push({ kind: 'sedan', x: p.x + Math.cos(a) * 260, y: p.y + Math.sin(a) * 260, angle: a, color: '#1c1c1c', speed: 330, vx: 0, vy: 0, health: 100, npc: true, police: true, ramCd: 0 });
    }
    hooks.setObjective('<b>Volcano Heist</b> — Dr. Ash<br>Survey gold secured. Get to the Hideout — the cops are coming.<br>Reward: <b>$1,500</b>');
    return true;
  }
  if (shot === 'mission') {
    hideMenu();
    state.clock = 15 * 60; // afternoon
    p.x = world.places.observatory.x - 240; p.y = world.places.observatory.y + 120;
    p.money = 1250;
    state.wanted = 1; state.wantedHeat = 60;
    state.missionIdx = 2; state.missionStage = 'active';
    state.waypoint = { x: world.places.observatory.x, y: world.places.observatory.y };
    state.pickups.push({ kind: 'crate', x: world.places.observatory.x, y: world.places.observatory.y, value: 0 });
    hooks.setObjective('<b>Volcano Heist</b> — Dr. Ash<br>The Observatory holds a crate of survey gold. Grab it — the mountain is awake and so are the cops.<br>Reward: <b>$1,500</b>');
    return true;
  }
  return false;
}
