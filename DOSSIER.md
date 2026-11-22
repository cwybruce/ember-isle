# Ember Isle — Dossier

## Game
**Ember Isle** is a complete open-world crime game set on a tropical volcano island,
built from scratch for make.fun's "Make GTA 6" bounty (gta6-01). Pure static files:
`game/index.html` plus hand-written ES modules under `game/src/`. No build step,
no library, no network request of any kind — every asset is generated in code
(terrain, sprites, and all sound via WebAudio synthesis).

## What is in the world
- **The island** (3200×2400): black-sand beaches, jungle dirt roads, a town with
  named buildings (Police Station, The Molten Mug, Ember Hotel, Corner Store),
  Rook's Garage, the Volcano Observatory, a Hideout, docks with a wooden pier,
  a small offshore islet, and a live volcano with a glowing crater and three
  winding lava flows.
- **Vehicles**: 7 drivable — Trailblazer 4x4, Dune Pickup, Island Sedan, Cinder
  Buggy, Sand Runner, and two boats (Harbor Skiff, Sunfish Boat). Enter/exit with E.
- **Traffic & pedestrians**: 9 AI cars following the road network, 26 pedestrians
  who wander and flee from gunfire or speeding cars.
- **Wanted system**: 0–5 stars. Stealing cars, shooting, and running people over
  raise heat; police cars spawn and ram you. Heat cools off when you lay low.
- **Missions & story (4 jobs)**: Hot Wheels (steal a pickup for Mara Voss),
  Beach Run (boat to the islet for Old Finn), Volcano Heist (survey gold at the
  Observatory, escape a 3-star tail), Ember King (deliver the Syndicate ledger).
  Gold waypoint markers, on-screen objectives, cash rewards.
- **Combat**: pistol / SMG / shotgun (keys 1/2/3, R reload), mouse aim, click to
  fire; health pickups, cash and ammo scattered around the island.
- **HUD**: wanted stars, health bar, cash, live minimap, day/night clock
  (nights bring the volcano glow), speedometer and vehicle name.
- **Flow**: animated title screen, pause menu, game-over screen, save/continue
  via browser localStorage. Sound: synthesized engine hum, gunshots, sirens,
  pickups (M mutes).

## Controls
WASD move / drive · Mouse aim · Click shoot · E enter / exit vehicle ·
Shift sprint · R reload · 1/2/3 weapons · P / Esc pause · M mute.

## How to run
```sh
node serve.ts
```
Then open http://localhost:8080. Or serve `game/` with any static file server
and open `index.html`. Desktop Chrome recommended; keyboard + mouse.

## Screenshots (all real renders of this game's own code, 1280×720)
1. `1-start.jpg` — title screen over the island at dawn.
2. `2-drive.jpg` — driving the Trailblazer 4x4 at 85 km/h on the coast road,
   mission "Hot Wheels" active, waypoint on Rook's Garage.
3. `3-boat.jpg` — the Harbor Skiff at 64 km/h off the docks, mission
   "Beach Run", waypoint 732 m out to the islet.
4. `4-night.jpg` — night chase at 21:40: 3-star wanted, two police cars with
   flashing lights pursuing the Cinder Buggy past a lava flow, volcano glow.

## Originality
Everything is original: island, characters (Rook Marlowe, Mara Voss, Old Finn,
Dr. Ash), vehicles, names, story, art, and sound. Nothing from Rockstar Games'
Grand Theft Auto series or any other commercial game.
