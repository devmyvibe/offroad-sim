# Offroad Sim

סימולטור רכב שטח תלת-ממדי בדפדפן: איסוזו טרופר 3.1 דיזל במדבר, עם שלושה מסלולים (ואדי חול, הצלבות, מדרגות סלע), מצבי הנעה 2H/4H/4L, שליטה במקלדת ובמגע, עברית ואנגלית.

A browser 3D off-road simulator: an Isuzu Trooper 3.1 TD in a procedural desert with three trails, 2H/4H/4L drivetrain, keyboard and touch controls, Hebrew and English UI.

## Stack

- [Vite](https://vitejs.dev) + TypeScript
- [Three.js](https://threejs.org) rendering (procedural terrain splat material, sky, dust)
- [Rapier](https://rapier.rs) physics (heightfield terrain, raycast vehicle controller)
- Web Audio synthesized engine/tyre/wind sound (no audio files)
- No backend: progress is saved in `localStorage`

## Run

```bash
npm install
npm run dev
```

Open the printed URL (also reachable from a phone on the same network via the `Network` address).

```bash
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/
```

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Throttle / brake-reverse | W/S or ↑/↓ | right pedals |
| Steer | A/D or ←/→ | left slider |
| Handbrake | Space | P |
| Drive mode 2H → 4H → 4L | E / Q | ◀ 2H / 4L ▶ |
| Camera (chase / cockpit) | C | 📷 |
| Reset to last checkpoint | R | ↺ |
| Pause / menu | Esc | ☰ |
| Debug free camera | F3 | – |

4L can only be engaged or released near a standstill, like the real transfer case.

## Project layout

```
src/
  core/      Game loop (fixed-step physics), input, settings, save, PRNG
  physics/   Rapier world wrapper
  terrain/   Heightmap, noise, trail stamps, mesh + collider, splat material, procedural textures
  world/     Map definition, sky/sun, obstacles (rock ledges, humps), props, dust
  vehicle/   Trooper spec, drivetrain, vehicle controller, procedural body, audio
  trails/    Trail definitions, run logic (checkpoints/timer/stars), markers
  camera/    Chase and free cameras
  ui/        HUD, menus, touch controls, i18n (he/en)
scripts/
  screenshot.mjs   Headless Chromium screenshot + console-error check
```

## Test hooks (URL parameters)

Useful for automated checks in headless Chromium (software WebGL):

- `?quality=low|medium|high`, `?lang=he|en`
- `?run=wadi|crossings|rocksteps` start a trail directly
- `?free=1`, `?trail=<id>&t=<metres>` spawn on a trail, `?spawn=x,z,heading`
- `?mode=2H|4H|4L`
- `?autopilot=<id>&throttle=0.8&cap=15` follow a trail (pure pursuit)
- `?drive=throttle,steer,seconds` constant input
- `?headless=1` run physics on a timer (no GPU needed), `?fastsim=1` allow more physics steps per frame
- `?cam=x,y,z,yaw,pitch` free camera, `?orbit=<rad>` lock the chase-camera orbit, `?nofog=1`

Example:

```bash
npm run dev -- --port 5199
node scripts/screenshot.mjs menu --url="http://localhost:5199/?lang=he"
```

## Tuning

Vehicle numbers live in `src/vehicle/TrooperSpec.ts` (mass, suspension, torque curve, gear ratios, grip per surface, sand drag). Trails and rock step heights are in `src/trails/trails.ts`; the map in `src/world/Map01.ts`.

## Roadmap

- Replace the procedural Trooper body with a GLB model
- CC0 PBR textures (Poly Haven) in `public/`
- Capacitor wrapper for iOS/Android
- Differential lock, tyre pressure, winch
