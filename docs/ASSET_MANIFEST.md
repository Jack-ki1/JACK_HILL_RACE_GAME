# Procedural Asset & Audio Manifest (`jack_hill_game`)

All 3D models, PBR textures, normal/bump maps, SVG icons, and sound effects are procedurally generated in code (zero external runtime binary asset downloads).

- **3D Vehicles, Leonida Customizations & Trail Accessories (`src/game/models.ts`)**:
  - **Shared Cabin, Chassis & Running Gear**: Bucket seats with headrests, dashboard with illuminated gauge pod, center shifter lever, steering column/wheel, side mirrors, front winches/D-ring shackles, dual exhaust pipe bore tips with **upshift & lift-off backfire flame cones** (`backfireGlow`), diagonal rear roll-cage gusset struts (`makeTube`), radiator core backing mesh behind grilles, reactive brake-light emissive materials, **Halo LED DRL headlight rings**, **Leonida `JACK-06` sunset license plates**, additive headlight volumetric cones, dual-layer Nitro afterburner plumes, and articulated `armRear` / `armFront` suspension control arms with helical coilover springs.
  - **Dynamic Dirt / Grime Overlay (`dirtOverlayMesh` / `dirtMat`)**: Accumulates dynamically with distance driven and wheelspin across each stage, tinted per biome.
  - **Selectable Neon Underglow (`NEON_COLORS`)**: 6 chassis underglow options (`off`, `vice_pink`, `leonida_cyan`, `miami_mint`, `sunset_amber`, `uv_violet`) with physical chassis light tubes + additive ground neon pool (`neonPoolMesh`) and showroom turntable glow ring tinting.
  - **Selectable Liveries (`LIVERY_DEFS`)**: 7 body graphic packages (`clean`, `vice_stripes`, `carbon_hood`, `leonida_interceptor`, `sunset_rally`, `sticker_bomb`, `viper_stripe`).
  - **Selectable 3D Accessories**: `lightbar`, `bullbar`, `whip_flag`, and `snorkel` (`Ram-Air Snorkel`: +4% torque & +3% top speed).
  - **Ghost Rival Silhouette (`buildGhostVehicle3D`)**: Subtle warm amber-gold silhouette (`opacity: 0.28`, `depthWrite: false`) rendered at `z = -1.35` strictly during `PLAYING` mode when enabled.
  - **Wheel Assemblies**: Deep-dish rim lip, beadlock rim bolts, locking center hubs, perforated brake disc rotors, painted brake calipers, staggered lugged tires with linear bump relief (`createTireBumpTexture`), plus stretched low-profile rubber over oversized 28" 10-spoke chrome rims (`isDonk`) on the Leonida Donk.
  - **Articulated Human Driver**: Multi-segment pelvis/thighs/shins/boots, G-force leaning `torsoGroup` with racing jacket & 5-point harness, 2-segment arms with gloves gripping the wheel/bars, neck, sculpted jaw/nose head (`headGroup`) with comms headset, goggles/visor, and trail/full-face helmet.
  - **7 Vehicles**: `ranger`, `monster`, `buggy`, `muscle`, `superbike`, `cheetah_vc`, and `donk_leonida`.
- **Procedural Textures & Bump Maps (`src/game/textures.ts`)**:
  - `createCoinTexture`, `createTerrainStrataTexture` (with crisp turf/snow overhanging lip contrast), `createRoadTrackTexture` (including Vice Coastway asphalt + dashed highway markings), `createLicensePlateTexture`, `createSurfaceBumpTexture`, `createTireBumpTexture`, `createDirtGrimeTexture`, `createWoodPlankTexture`, `createGarageFloorTexture`, `createEarthTexture`, `createSignpostTexture`, and `createSoftGlowTexture`.
- **Custom SVG Vector Iconography (`src/components/GameIcons.tsx`, `src/components/WorldMapModal.tsx`)**:
  - Coin, Gem, Fuel Canister, Driver Avatar, Rank Shield (`RankShieldIcon`), 7 Vehicle Silhouettes (`VehicleSilhouetteIcon`), Upgrade Part icons (`UpgradePartIcon`), Bronze Crate, Gold Chest, Nitro Bottle, Coin Magnet, plus custom procedural biome hero SVGs inside Stage Select.
- **5 Biomes & Orthographic Showroom (`src/game/worldScene.ts`, `src/game/garageScene.ts`)**:
  - Biomes: `vice_coast` (Vice Coastway), `countryside`, `red_canyon`, `frost_peaks`, and `moon`.
  - Orthogonal side-view chase camera with dynamic look-ahead & zoom-out, Rayleigh sun-scatter sky shader, Moon Earth disc, curved Leonida Palm Trees, Vice Neon Highway Sign Gantries, Lifeguard Towers, coastal Jersey barriers, Hot Air Balloons, Utility Poles, rocky boulders, Cave Tunnels, wooden/causeway bridges, and terrain-tracking contact shadows (water skips intentionally omitted).
  - Workshop garage bay defaulting to `profile` camera matching gameplay side-view framing, with 6 presets (`profile`, `hero`, `front`, `rear`, `cockpit`, `wheels`), turntable radial contact shadow plane, neon-synced glow ring, and gantry/lift props.
- **Web Audio (`src/game/audio.ts`)**:
  - Vehicle-pitched dual-oscillator engine synth tuned per all 7 vehicles, bandpass noise Nitro jet, upshift exhaust pop (`playGearShift()`), coins, fuel arpeggio, stunt fanfare, suspension landing thud, crash sweep, UI clicks, and Master & SFX volume controls.
