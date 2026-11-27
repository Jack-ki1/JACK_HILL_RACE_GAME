# QA & Verification Report (`jack_hill_game`)

## Executed Automated Checks
1. **TypeScript Static Type Check (`npm run lint` / `tsc --noEmit`)**
   - **Status**: Passed (exit code 0, zero TypeScript diagnostics).
2. **Production Bundle (`vite build`)**
   - **Status**: Passed (`compile_applet` succeeded cleanly).
3. **Extensive Playtest Benchmarks & Live Physics/AI Tuning (`npx tsx`)**
   - **70-Run 60s Matrix (`STOCK_NO_PARTS` & `LV5_META_PARTS` across all 7 vehicles × 5 stages)**:
     - **Discovered & Fixed**:
       1. *Moon Aero Wings Anti-Gravity*: `wings` originally produced up to `8.8 m/s²` lift against `0.38g` lunar gravity (`6.0 m/s²`), floating over fuel cans. Scaled `wings` lift strictly below `mass * gravity` (`0.54g` steady + `0.32g` glide) and added taller Moon fuel pickup reach (`dyScale = 0.52`, `2.45m` radius, `groundY + 1.35`).
       2. *Hard-Landing Trampoline Rebound & Crest-Clip Nose-Dives*: Single-frame wheel compression snap + undamped `hardPen` triggered `>5 rad/s` nose-down rebounds on sharp crests. Upgraded hydraulic compression damping (`dampComp: 10.4`), viscoelastic bottom-out energy absorption, vehicle rotational inertia (`1.35`–`2.65`) with proportional `airTorque`, softened hull bumper grab (`-vt * 3.8`), and single-wheel crest-clip angular shock damping.
       3. *Tunnel Entrance Headroom & AI Caution*: Increased cave tunnel ceiling (`maxFloor + 5.8`) and added tunnel-entrance caution + speed-adaptive 8-point ballistic lookahead + crest-dropoff throttle lift in `aiAgent.ts`, plus opportunistic high-air backflips on agile stunt rides (`buggy`, `superbike`).
     - **Final 60s Benchmark Result**: `0/35` crashes on Stock (35 flips, 0 fuel-outs) and `0/35` crashes on Lv5 + Meta Parts (42 flips, 0 fuel-outs).
   - **20-Run 90s Kangaroo & Winter/Mud Endurance (`Jump Shocks + Wings / Studded Chains + Overcharged Turbo`)**:
     - `0/20` crashes across all 5 stages (`2,004m`–`3,611m` distances, `177` Jump Shocks launches, `39%–99%` fuel remaining).
4. **UI, CSS & Asset Hygiene Audit**
   - Zero `backdrop-blur`, zero `border-l-4`, and zero decorative `animate-pulse`/`animate-ping`/`animate-bounce` classes.
   - `index.html` loads `Teko` (`500/600/700`) + `Outfit` + `JetBrains Mono` with `viewport-fit=cover`; `src/index.css` sets `100dvh`, safe-area inset padding, and compact landscape rules.

## Scope & Visual Check Note
- **Not Executed**: Headless Chromium WebGL visual rendering and multi-viewport screenshot inspection could not be executed in this container because no Chromium/Playwright browser binary is installed.
