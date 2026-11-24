# jack_hill_game

A 3D rock-crawling and hill-climb racing game built with React 19, TypeScript, Tailwind CSS v4, Three.js, and Web Audio.

## Core Features
- **180Hz Suspension & Traction Physics**: Independent dual-wheel coilover springs, asymmetric compression/rebound hydraulic damping, bump-stop saturation, Pacejka-style surface traction, AWD torque split bias, mid-air pitch rotation, hull/roll-cage protection, 65ms impact hitstop, and decaying camera shake.
- **Dual-Angle Perspective Camera**: Low front-right 3/4 rock-crawling hero showcase on the Title screen transitioning smoothly into a crisp 2.5D perspective side-follow chase camera during runs, tuned for desktop (`1920×1080`), portrait mobile (`360×740`), and landscape mobile (`740×360`) viewports with safe-area padding (`env(safe-area-inset-*)`).
- **5 Procedural Biomes**:
  - **Vice Coastway**: Twilight coral/neon coastal highway, causeway bridges, lifeguard towers, and curved Leonida palm trees.
  - **Countryside**: Golden-hour backlit overcast sky, faceted rock shelves, scrub grass tufts, pine forests, barns, and wooden bridges.
  - **Red Canyon**: Layered sandstone mesas, craggy rock outcrops, saguaro cacti, dust motes, and wooden trestle bridges.
  - **Frost Peaks**: Night alpine ridges, animated Aurora Borealis ribbons, snowfall, headlights, and low-grip ice patches.
  - **Moon Crater**: `0.38g` lunar gravity, deep crater bowls, starry sky, and extended aerial stunt hangtime.
- **7 Playable 3D Vehicles & Profile-First Garage**:
  - **Ranger**, **Monster**, **Buggy**, **Muscle**, **Superbike**, **Cheetah VC**, and **Donk Leonida** modeled procedurally in Three.js with riveted fender flares, crisp door shutlines, expedition roof racks with X-taped rally floodlights, 7-coil coilover shocks, 20-lug mud-terrain tires with side-biter teeth, weathered paint micro-grain, dynamic off-road grime overlay, and sculpted human drivers.
  - Interactive 360° Garage showroom defaulting to side `PROFILE` view, with 8 paint swatches, 6 neon underglow kits, 7 liveries (including `Sticker Bomb` & `Viper Stripe`), 4 wheel styles, and 4 functional trail accessories (`Light Bar`, `Reinforced Bullbar`, `Whip Flag`, and `Ram-Air Snorkel` adding +4% engine torque & +3% top speed).
- **Ghost Rival, Upgrades, Tuning Bench, Daily Challenge & Season 12 Progression**:
  - Subtle warm amber-gold Ghost Rival silhouette recording personal best runs per stage (`PLAYING` mode only, toggleable in Settings) with live `RIVAL +/-Xm` HUD delta.
  - 5 mechanical upgrades (`Engine`, `Suspension`, `Tires`, `4WD`, `Fuel Tank`) up to Level 10 plus direct access to the 8-slider **Physics Tuning Bench**.
  - Local date-keyed **Daily Challenge**, Career Missions, Season 12 Wild Roads tiers, and Supply Depot Shop persisted in browser `localStorage` (`hcr3_frontier_save_v1`).

## Controls
- **Drive / Pitch Right (Gas)**: `D`, `ArrowRight`, or on-screen `GAS` pedal
- **Brake / Reverse / Pitch Left**: `A`, `ArrowLeft`, or on-screen `BRAKE` pedal
- **Nitro Boost**: `Shift` or on-screen `NITRO` button
- **Handbrake**: `Space`
- **Pause / Resume**: `P` or `Escape`
- **Quick Restart**: `R`
- **Mute Audio**: `M`
- **Gamepad**: Standard `RT/A` Gas, `LT/X` Brake, `RB/B` Nitro, `Y` Handbrake, `Start` Pause

## Development & Verification
```bash
npm install
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production Vite bundle
npm run dev      # Local server on port 3000
```
