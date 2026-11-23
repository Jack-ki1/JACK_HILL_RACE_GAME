# Hill Climb Racing 3: Frontier

A 3D/2.5D off-road physics racing game built with React 19, TypeScript, Tailwind CSS v4, Three.js, and Web Audio.

## Core Features
- **180Hz Suspension & Traction Physics**: Independent dual-wheel coilover springs, asymmetric compression/rebound hydraulic damping, bump-stop saturation, Pacejka-style surface traction, 4WD differential bias, mid-air pitch rotation, hull/roll-cage protection, 65ms impact hitstop, and decaying camera shake.
- **4 Procedural 3D Stages**:
  - **Countryside**: Sunlit green hills, loamy trails, pine forests, and wooden bridges.
  - **Red Canyon**: Sandstone mesas, saguaro cacti, dust motes, deep canyon gorges, and wooden trestle bridges.
  - **Frost Peaks**: Night alpine ridges, animated Aurora Borealis ribbons, falling snow, active vehicle headlights, and low-grip ice patches.
  - **Moon Crater**: 0.38g lunar gravity, deep crater bowls, starry sky, and extended aerial stunt hangtime.
- **5 Playable 3D Vehicles & Interactive Garage Turntable**:
  - **Ranger**, **Monster**, **Buggy**, **Muscle**, and **Superbike** modeled procedurally in Three.js with dynamic coilover shocks, lugged rotating axles, exhaust/nitro flame cones, and spring-damped driver heads.
  - Drag-to-spin 360° workshop showroom with 8 custom paint finishes and 4 wheel/rim styles.
- **Upgrades, Tuning Bench, Shop & Season 12 Progression**:
  - 5 mechanical upgrades (`Engine`, `Suspension`, `Tires`, `4WD`, `Fuel Tank`) up to Level 10.
  - Live Physics Tuning Bench with presets (`Frontier Stock`, `Hill Climber`, `Stunt Jumper`, `Low-G Arcade`) and 8 real-time sliders.
  - In-game Supply Shop (`Offers`, `Currency`, `Boosts`, `Chests`), Career Missions, and Season 12 Wild Roads tiers persisted in `localStorage`.

## Controls
- **Drive / Pitch Right (Gas)**: `D`, `ArrowRight`, or on-screen `GAS` pedal
- **Brake / Reverse / Pitch Left**: `A`, `ArrowLeft`, or on-screen `BRAKE` pedal
- **Nitro Boost**: `Shift` or on-screen `NITRO` button
- **Handbrake**: `Space`
- **Pause / Resume**: `P` or `Escape`
- **Quick Restart**: `R`
- **Mute Audio**: `M`

## Development & Verification
```bash
npm install
npm run lint     # TypeScript type-check (tsc --noEmit)
npm run build    # Production Vite bundle
npm run dev      # Local server on port 3000
```
