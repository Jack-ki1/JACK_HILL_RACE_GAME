# Procedural Asset & Audio Manifest

All 3D models, PBR textures, normal/bump maps, SVG icons, and sound effects are 100% procedurally generated in code (zero external binary downloads or runtime network asset dependencies).

- **3D Vehicles (`src/game/models.ts`)**:
  - **Shared Cabin, Chassis & Running Gear**: Bucket seats with headrests, dashboard with illuminated gauge pod, center shifter lever, steering column/wheel, side mirrors, front winches/D-ring shackles, roof LED lightbars, dual exhaust tips, reactive brake-light emissive materials, additive headlight volumetric cones, dual-layer Nitro afterburner plumes, and articulated `armRear` / `armFront` suspension control arms with helical coilover springs.
  - **Wheel Assemblies**: Deep-dish rim lip, beadlock rim bolts, locking center hubs, perforated brake disc rotors, painted brake calipers, staggered lugged tires with linear bump relief (`createTireBumpTexture`).
  - **Articulated Human Driver**: Multi-segment pelvis/thighs/shins/boots, G-force leaning `torsoGroup` with racing jacket & 5-point harness, 2-segment arms with gloves gripping the wheel/bars, neck, sculpted jaw/nose head (`headGroup`) with comms headset, goggles/visor, and trail/full-face helmet.
  - **Vehicles**: `ranger` (bevel-extruded off-roader, 7-slot grille, rear spare), `monster` (lifted crawler pickup, oversized 0.78m tires), `buggy` (tubular sand rail with rear wing), `muscle` (widebody fastback with chrome supercharger intake & spoiler), `superbike` (aerodynamic fairing with gold USD forks & sport tuck rider).
- **Procedural Textures & Bump Maps (`src/game/textures.ts`)**:
  - `createCoinTexture`: Metallic gold coin faces with milled edge notches and denomination stamps (`5`, `25`, `100`, `500`).
  - `createTerrainStrataTexture`: Layered sedimentary geological cliff strata with overhanging turf/snow/dust shadow lip per stage.
  - `createRoadTrackTexture`: Two-track tire ruts and chevron tread impressions per stage.
  - `createSurfaceBumpTexture` & `createTireBumpTexture`: Linear-space (`NoColorSpace`) bump relief textures for terrain, cliff strata, and off-road tire lugs.
  - `createWoodPlankTexture`: Bridge plank wood grain and steel carriage bolts.
  - `createGarageFloorTexture`: Brushed epoxy concrete showroom floor with bay safety striping and turntable markings.
  - `createEarthTexture` & `createSignpostTexture`: Procedural Earth disc for Moon skybox and `100m`/`200m`... trail milestone signs.
  - `createSoftGlowTexture`: Radial gradient glow sprite for sun/moon halo.
- **Environments & Showroom (`src/game/worldScene.ts`, `src/game/garageScene.ts`)**:
  - Rayleigh sun-scatter sky shader, Moon Earth disc, canyon gorge river water, foreground speed-sense parallax markers, countryside barns, canyon sandstone spires, 4-tier pines, and a workshop garage bay with `RectAreaLight` overhead softbox, gantry trusses, hydraulic lift columns, mechanic tool cabinet, and stacked spare tires.
- **Web Audio (`src/game/audio.ts`)**:
  - Vehicle-pitched dual-oscillator engine synth (`sawtooth` + `triangle` through dynamic lowpass filter, tuned across `superbike`, `buggy`, `ranger`, `muscle`, and `monster`), bandpass noise Nitro jet, upshift exhaust pop (`playGearShift()`), coins, fuel arpeggio, stunt fanfare, suspension landing thud, crash sweep, and UI clicks.
