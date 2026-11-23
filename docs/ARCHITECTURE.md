# System Architecture

## Layer Separation
1. **3D Orthographic Side-View Rendering Layer (`src/game/worldScene.ts`, `src/game/garageScene.ts`, `src/game/models.ts`, `src/game/textures.ts`)**
   - `WorldSceneController` owns a dedicated WebGL2 canvas isolated outside React reconciliation using a responsive `THREE.OrthographicCamera` looking straight along `-Z` (`z = 45`).
   - Implements automatic software-WebGL detection (`SwiftShader`/`llvmpipe`) with `afterDraw` fence pacing so virtual environments remain responsive without GPU queue stalls.
   - Uses `RoomEnvironment` PMREM lighting, `SRGBColorSpace` output, `ACESFilmicToneMapping`, dynamic shadow frustum tracking, reusable object pools (coins, fuel cans, props, bridges, tunnels, milestone signs), and a 320-instance `InstancedMesh` particle buffer with zero allocations inside `tick()`.
   - Supports personal-best Ghost Rival recording (`0.12s` samples up to `2500` frames) and amber silhouette playback strictly during `PLAYING` mode.
2. **180Hz Physics & Terrain Layer (`src/game/physics.ts`, `src/game/terrain.ts`)**
   - `terrain.ts` evaluates continuous height `y`, surface tangent/normal `(tx, ty, nx, ny)`, wooden bridge sag & chasm detection, slick ice patches, cave tunnels, and collectible slot layouts in realistic meters (`1 unit = 1m`, `+Y` up).
   - `HillClimbPhysics` steps at `1/180s` fixed increments inside an accumulator loop, applying upgrade bonuses, accessory perks (`snorkel` +4% torque / +3% top speed), and real-time `TuningConfig` scalars while reporting discrete events via callbacks.
3. **Zero-Re-Render Gameplay HUD (`src/components/GameplayHud.tsx`)**
   - Exposes `updateLive(HudLiveSnapshot)` via `useImperativeHandle` + direct DOM/SVG refs so `RPM`, `KM/H`, `BOOST` needles, fuel bar, `FUEL IN Xm`, `RIVAL +/-Xm`, and distance counters animate at 60fps without triggering React renders.
4. **Application State & Persistence (`src/App.tsx`, `src/game/storage.ts`, `src/game/constants.ts`)**
   - Coordinates game screens (`TITLE_MENU`, `PLAYING`, `PAUSED`, `GAME_OVER`, `GARAGE`, `UPGRADES`, `WORLD_MAP`, `SHOP`, `MISSIONS`, `TUNING`, `SETTINGS`), keyboard/pointer/gamepad inputs with window/visibility/screen-change input clearing, `SoundEngine`, and `localStorage` serialization (`hcr3_frontier_save_v1`) including date-keyed Daily Challenge rollover (`refreshDailyChallenge`).
