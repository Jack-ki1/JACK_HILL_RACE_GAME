# QA & Verification Report (`jack_hill_game`)

## Executed Automated Checks
1. **TypeScript Static Type Check (`npm run lint` / `tsc --noEmit`)**
   - **Status**: Passed (exit code 0, zero TypeScript diagnostics).
2. **Production Bundle (`vite build`)**
   - **Status**: Passed (`compile_applet` succeeded cleanly).
3. **35-Matrix 180Hz Physics, Ghost Replay, Snorkel Perk & Save Migration Verification (`npx tsx`)**
   - **Legacy Save Migration (`loadSaveData`)**: Verified an older `hcr3_frontier_save_v1` JSON payload missing `dailyChallenge`, `settings`, `tutorialSeen`, `boosters`, `upgrades`, `vehicleNeons`, `vehicleLiveries`, `stageGhosts`, `cheetah_vc`, `donk_leonida`, and `vice_coast` migrates cleanly without losing `coins`, `gems`, `stageBests`, or `selectedVehicle`.
   - **Daily Challenge Rollover (`refreshDailyChallenge`)**: Verified stale date keys reset cleanly (`bestMeters = 0`, `claimed = false`) on a new local calendar day while preserving in-progress state within the same calendar day.
   - **Ghost Interpolation (`interpolateGhostSample`)**: Verified empty-track `null` return, start/end time clamping, linear `(x, y)` midpoint interpolation, and shortest-arc angular wraparound across `±π`.
   - **Physics Simulation (`HillClimbPhysics`)**: Executed 1,800 substeps (10s at 180Hz) across all 35 combinations (`7 vehicles` × `5 stages`) with a pitch-stabilizing test driver; all vehicle states (`x`, `y`, `vx`, `vy`) remained finite (`45m`–`320m`).
   - **Ram-Air Snorkel Perk**: Verified equipping `snorkel` yields `1.04x` `engineTorque` (+4%) and `1.03x` `topSpeed` (+3%).
4. **UI, CSS & Asset Hygiene Audit**
   - `grep` over `src/` and `index.html` returned `CLEAN_CSS_AUDIT`: zero `backdrop-blur`, zero `border-l-4`, and zero decorative `animate-pulse`/`animate-ping`/`animate-bounce` classes.
   - `index.html` loads `Teko` (`500/600/700`) + `Outfit` + `JetBrains Mono` with `viewport-fit=cover`; `src/index.css` sets `100dvh`, safe-area inset padding (`env(safe-area-inset-*)`), and compact landscape rules (`@media (max-height: 450px)`).
   - Non-runtime reference artifacts were moved from `public/assets/aistudio/` into `docs/references/` leaving `public/` clean so the production bundle contains zero unused reference assets.

## Verified Architecture Safeguards
- Gameplay HUD updates (`RPM`, `KM/H`, `BOOST`, fuel bar, `FUEL IN XXm`, `RIVAL +/-XXm`, active `CAVE TUNNEL` badge, gear, distance) bypass React state reconciliation via imperative refs (`GameplayHudHandle`).
- `window` `blur`, `orientationchange`, `visibilitychange`, and transitions away from `PLAYING` clear held driving inputs so pedals never stick; standard Gamepad polling (`navigator.getGamepads()`) tracks state diffs cleanly alongside keyboard and touch pedals.
- `TITLE` screen shows the low front-right 3/4 rock-crawling vehicle on faceted rock terrain with zero Ghost Rival overlay; personal-best amber Ghost Rival playback runs strictly during `PLAYING` mode when enabled in Settings.
- Water skips remain removed (`hasWaterCrossings: false`, `inWater: false`).
- Software WebGL fallback (`SwiftShader` / `llvmpipe`) throttles frame pacing (`afterDraw` `fenceSync`) and disables expensive shadow maps automatically, with user-selectable Graphics Quality tiers (`auto`, `high`, `medium`, `low`).

## Scope & Visual Check Note
- **Completed**: Dual-angle `THREE.PerspectiveCamera` (`TITLE` 3/4 rock crawl hero shot + `PLAYING` 2.5D chase cam), procedural 5-octave FBM overcast/golden-hour sky shader with contrails, 512×512 rock-fracture & weathered paint `NoColorSpace` bump maps, `(X)(X)(X)(X)` rally light covers, 20-lug mud-terrain wheels with side-biters, 7-coil coilover shocks, riveted fender flares, natural human 4-wheeler driver, upright `Teko` stacked Title lockup + hairline-divided menu stack, 7 vehicles, 7 liveries (`Sticker Bomb`, `Viper Stripe`, etc.), dynamic dirt/grime accumulation, 6 Neon Underglow kits, 4 trail accessories, profile-default 3D Garage showroom, Stage Select + World Map views, Upgrade Tree + Pro Tuning Bench link, Daily Challenge claim loop, Supply Depot Shop, Career Missions & Season 12 Championship, and Settings.
- **Not Executed**: Headless Chromium WebGL visual rendering and multi-viewport screenshot inspection (`360×740`, `740×360`, `1920×1080`) could not be executed in this container because no Chromium/Playwright browser binary is installed (`which chromium` returned none).
