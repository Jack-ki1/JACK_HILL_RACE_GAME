import { StageConfig, SurfaceType } from '../types/game';
import { START_X } from './constants';

export interface TerrainSample {
  y: number;
  groundY: number;
  slope: number;
  nx: number;
  ny: number;
  tx: number;
  ty: number;
  surface: SurfaceType;
  muMult: number;
  isBridge: boolean;
  bridgeStartX: number;
  bridgeLength: number;
}

export interface TerrainLookaheadPoint {
  dx: number;
  dy: number;
  slope: number;
  surface: SurfaceType;
}

export interface CollectibleSpawn {
  index: number;
  kind: 'coin' | 'fuel';
  x: number;
  y: number;
  value: number;
}

export function smoothstep(t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return t * t * (3 - 2 * t);
}

export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function perlinGrad1D(cell: number): number {
  return hash01(cell * 17.3 + 5.1) * 2 - 1;
}

export function perlin1D(x: number): number {
  const i0 = Math.floor(x);
  const i1 = i0 + 1;
  const f = x - i0;
  // Quintic Hermite fade curve (6t^5 - 15t^4 + 10t^3) for smooth C2 terrain derivatives
  const u = f * f * f * (f * (f * 6 - 15) + 10);
  const g0 = perlinGrad1D(i0) * f;
  const g1 = perlinGrad1D(i1) * (f - 1);
  return g0 + (g1 - g0) * u;
}

export function fbmPerlin1D(x: number, octaves = 3): number {
  let sum = 0;
  let amp = 0.58;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += perlin1D(x * freq + i * 31.7) * amp;
    freq *= 2.04;
    amp *= 0.48;
  }
  return sum;
}

export function getBridgeInfo(
  x: number,
  stage: StageConfig,
): { active: boolean; startX: number; length: number; s: number } {
  if (!stage.hasBridges || stage.bridgeInterval <= 0) {
    return { active: false, startX: 0, length: 0, s: 0 };
  }
  const firstBridge =
    stage.id === 'red_canyon' ? 145 : stage.id === 'vice_coast' ? 210 : 260;
  if (x < firstBridge) {
    return { active: false, startX: 0, length: 0, s: 0 };
  }
  const interval = stage.bridgeInterval;
  const length = stage.id === 'red_canyon' ? 38 : 32;
  const offset = x - firstBridge;
  const mod = ((offset % interval) + interval) % interval;
  if (mod < length) {
    return {
      active: true,
      startX: x - mod,
      length,
      s: mod / length,
    };
  }
  return { active: false, startX: 0, length: 0, s: 0 };
}

export function getWaterCrossingInfo(
  _x: number,
  _stage: StageConfig,
): { active: boolean; startX: number; length: number; s: number; waterY: number } {
  return { active: false, startX: 0, length: 0, s: 0, waterY: -999 };
}

export function getTunnelInfo(
  x: number,
  stage: StageConfig,
): { active: boolean; startX: number; length: number; s: number; ceilingY: number } {
  if (!stage.hasTunnels) {
    return { active: false, startX: 0, length: 0, s: 0, ceilingY: 999 };
  }
  const firstTunnel = 335;
  if (x < firstTunnel) {
    return { active: false, startX: 0, length: 0, s: 0, ceilingY: 999 };
  }
  const interval = 315;
  const length = 28;
  const offset = x - firstTunnel;
  const mod = ((offset % interval) + interval) % interval;
  if (mod < length) {
    const startX = x - mod;
    if (
      getBridgeInfo(startX - 4, stage).active ||
      getBridgeInfo(startX + length + 4, stage).active
    ) {
      return { active: false, startX: 0, length: 0, s: 0, ceilingY: 999 };
    }
    let maxFloor = -Infinity;
    for (let k = 0; k <= 4; k++) {
      maxFloor = Math.max(maxFloor, sampleBaseGroundHeightRaw(startX + (k / 4) * length, stage));
    }
    return {
      active: true,
      startX,
      length,
      s: mod / length,
      ceilingY: maxFloor + 5.8,
    };
  }
  return { active: false, startX: 0, length: 0, s: 0, ceilingY: 999 };
}

/**
 * Base organic terrain height in meters (Y-up).
 * Combines 1D Perlin FBM chunks (non-repeating endless off-road variety),
 * smooth C1-continuous waves, launchpad flattening, progressive climbing chunks,
 * and stage-specific signature features (canyon gorges, lunar crater bowls).
 */
function sampleBaseGroundHeightRaw(x: number, stage: StageConfig): number {
  const dist = Math.max(0, x - START_X);
  // Smooth launchpad around start so spawn is level and stable
  const launchBlend = smoothstep((dist - 12) / 30);
  // Progressive chunked difficulty ramp every 90m with smooth cosine transitions
  const chunkPhase = dist / 90;
  const chunkIdx = Math.floor(chunkPhase);
  const chunkFrac = 0.5 - 0.5 * Math.cos(Math.PI * (chunkPhase - chunkIdx));
  const chunkChallenge =
    0.92 + 0.22 * (hash01(chunkIdx * 7 + 3) * (1 - chunkFrac) + hash01((chunkIdx + 1) * 7 + 3) * chunkFrac);
  const difficulty = (0.62 + Math.min(1.55, dist / 850)) * chunkChallenge;
  const wl = stage.wavelengthMult;
  const amp = stage.ampMult * launchBlend * difficulty;

  // Multi-octave rolling hills + Perlin gradient FBM endless ridge variation
  const h1 = Math.sin(x / (16.5 * wl)) * 2.15;
  const h2 = Math.sin(x / (7.6 * wl) + 1.4) * 1.05;
  const h3 = Math.sin(x / (3.6 * wl) + 2.6) * 0.34;
  const h4 = Math.sin(x / 1.45) * 0.07;
  const perlinRelief = fbmPerlin1D(x / (18.0 * wl), 3) * 3.65;

  // Dramatic macro steep 25-40 deg hill ascents followed by fast compression valleys
  const ridgeCycle = Math.sin(dist / (78 * wl)) * 4.4 * smoothstep((dist - 45) / 85);
  const macroClimb =
    ridgeCycle +
    Math.sin(dist / 165) * 4.2 * smoothstep((dist - 80) / 130) +
    Math.max(0, (dist - 120) * 0.016);

  let y = macroClimb + amp * (h1 + h2 + h3 + h4 + perlinRelief);

  // Signature sharp launch crests / tabletop jumps every ~110m after 75m
  if (dist > 75) {
    const rampPeriod = 110;
    const m = ((dist - 75) % rampPeriod + rampPeriod) % rampPeriod;
    const rampUp = smoothstep((m - 60) / 10);
    const rampDown = 1 - smoothstep((m - 76) / 6);
    y += rampUp * rampDown * 3.0 * stage.ampMult * Math.min(1.25, difficulty);
  }

  // Rhythmic whoops / moguls section between 40% and 55% of every 160m block after 140m
  if (dist > 140) {
    const whoopMod = ((dist - 140) % 160 + 160) % 160;
    if (whoopMod < 36) {
      const env = Math.sin((whoopMod / 36) * Math.PI);
      y += env * Math.sin(whoopMod * 1.15) * 0.42 * stage.ampMult;
    }
  }

  // Moon crater bowls: smooth curved depression lips for big low-G launches
  if (stage.id === 'moon' && dist > 60) {
    const craterPeriod = 105;
    const cm = ((dist - 60) % craterPeriod + craterPeriod) % craterPeriod;
    const cCenter = 52;
    const cRadius = 22;
    const dNorm = (cm - cCenter) / cRadius;
    if (Math.abs(dNorm) < 1.35) {
      const bowl = Math.exp(-dNorm * dNorm * 2.2) * -3.6;
      const rim = Math.exp(-Math.pow(Math.abs(dNorm) - 0.95, 2) * 12) * 1.85;
      y += (bowl + rim) * launchBlend;
    }
  }

  // Deep canyon gorge depression beneath bridges
  const br = getBridgeInfo(x, stage);
  if (br.active) {
    const gorgeProfile = Math.sin(Math.PI * br.s);
    const gorgeDepth = stage.id === 'red_canyon' ? 16.5 : 8.5;
    y -= gorgeDepth * Math.pow(gorgeProfile, 0.55);
  }

  // Smooth Summit Finish plateau pad so crossing the finish gate feels clean and stable
  const summitX = getSummitX(stage);
  if (x > summitX - 16) {
    const blend = smoothstep((x - (summitX - 16)) / 10);
    const plateauBase =
      macroClimb +
      stage.ampMult *
        0.4 *
        (Math.sin((summitX - 16) / (16.5 * wl)) * 1.4);
    y = y * (1 - blend * 0.72) + plateauBase * (blend * 0.72);
  }

  return y;
}

export function getSummitX(stage: StageConfig): number {
  return START_X + stage.summitMeters;
}

export interface MinimapPoint {
  normX: number;
  y: number;
  surface: SurfaceType;
}

export function sampleElevationProfile(
  stage: StageConfig,
  sampleCount = 60,
): MinimapPoint[] {
  const pts: MinimapPoint[] = [];
  const span = stage.summitMeters;
  for (let i = 0; i < sampleCount; i++) {
    const normX = i / Math.max(1, sampleCount - 1);
    const x = START_X + normX * span;
    const y = sampleDriveHeight(x, stage);
    const { surface } = getSurfaceAt(x, stage);
    pts.push({ normX, y, surface });
  }
  return pts;
}

export function sampleBaseGroundHeight(x: number, stage: StageConfig): number {
  return sampleBaseGroundHeightRaw(x, stage);
}

export function sampleDriveHeight(x: number, stage: StageConfig): number {
  const br = getBridgeInfo(x, stage);
  if (br.active) {
    const yL = sampleBaseGroundHeight(br.startX - 0.1, stage);
    const yR = sampleBaseGroundHeight(br.startX + br.length + 0.1, stage);
    const linearY = yL + (yR - yL) * br.s;
    // Slight wooden suspension bridge sag in the middle
    const sag = -0.75 * Math.sin(Math.PI * br.s);
    return linearY + sag;
  }
  return sampleBaseGroundHeight(x, stage);
}

export function getSurfaceAt(x: number, stage: StageConfig): { surface: SurfaceType; muMult: number } {
  const br = getBridgeInfo(x, stage);
  if (br.active) {
    return { surface: 'wood', muMult: 0.94 };
  }
  const dist = Math.max(0, x - START_X);
  if (stage.id === 'frost_peaks') {
    // Periodic slick blue-ice stretches after 75m
    if (dist > 75) {
      const sector = Math.floor(x / 24);
      if (hash01(sector + 41) < 0.36) {
        return { surface: 'ice', muMult: 0.48 };
      }
    }
    return { surface: 'snow', muMult: 0.86 };
  }
  if (stage.id === 'red_canyon') {
    if (dist > 85) {
      const sandSector = Math.floor(x / 20);
      if (hash01(sandSector + 67) < 0.28) {
        return { surface: 'sand', muMult: 0.72 };
      }
    }
    const sector = Math.floor(x / 18);
    if (hash01(sector + 17) < 0.35) {
      return { surface: 'rock', muMult: 1.05 };
    }
    return { surface: 'dirt', muMult: 0.94 };
  }
  if (stage.id === 'vice_coast') {
    if (dist > 110) {
      const sandSector = Math.floor(x / 24);
      if (hash01(sandSector + 91) < 0.22) {
        return { surface: 'sand', muMult: 0.78 };
      }
    }
    return { surface: 'asphalt', muMult: 1.08 };
  }
  if (stage.id === 'moon') {
    return { surface: 'regolith', muMult: 0.96 };
  }
  if (dist > 95) {
    const mudSector = Math.floor(x / 22);
    if (hash01(mudSector + 31) < 0.28) {
      return { surface: 'mud', muMult: 0.60 };
    }
  }
  return { surface: 'dirt', muMult: 1.0 };
}

export function sampleTerrain(x: number, stage: StageConfig): TerrainSample {
  const eps = 0.25;
  const y = sampleDriveHeight(x, stage);
  const yL = sampleDriveHeight(x - eps, stage);
  const yR = sampleDriveHeight(x + eps, stage);
  const slope = (yR - yL) / (2 * eps);
  const len = Math.hypot(1, slope);
  const tx = 1 / len;
  const ty = slope / len;
  // Normal pointing UP (perpendicular to tangent in XY plane where +Y is up)
  const nx = -slope / len;
  const ny = 1 / len;

  const br = getBridgeInfo(x, stage);
  const { surface, muMult } = getSurfaceAt(x, stage);

  return {
    y,
    groundY: sampleBaseGroundHeight(x, stage),
    slope,
    nx,
    ny,
    tx,
    ty,
    surface,
    muMult,
    isBridge: br.active,
    bridgeStartX: br.startX,
    bridgeLength: br.length,
  };
}

/**
 * Fast mathematical lookahead sensor array for the autonomous AI driver
 * (inspired by alexzh3/hillclimbracing & Code Bullet forward slope rays).
 */
export function sampleLookaheadProfile(
  x: number,
  count: number,
  stepMeters: number,
  stage: StageConfig,
): TerrainLookaheadPoint[] {
  const baseY = sampleDriveHeight(x, stage);
  const pts: TerrainLookaheadPoint[] = [];
  const eps = 0.4;
  for (let i = 1; i <= count; i++) {
    const dx = i * stepMeters;
    const sx = x + dx;
    const sy = sampleDriveHeight(sx, stage);
    const syR = sampleDriveHeight(sx + eps, stage);
    const syL = sampleDriveHeight(sx - eps, stage);
    const slope = (syR - syL) / (2 * eps);
    const { surface } = getSurfaceAt(sx, stage);
    pts.push({
      dx,
      dy: sy - baseY,
      slope,
      surface,
    });
  }
  return pts;
}

/**
 * Deterministic collectible spawning (coins & fuel jerrycans).
 * Fuel jerrycans spawn reliably every ~115m so runs stay tactical and fair.
 */
export function getCollectibleForSlot(slot: number, stage: StageConfig): CollectibleSpawn | null {
  if (slot < 4) return null;
  const x = START_X + slot * 6.5;

  // Fuel jerrycan every 17 slots (~110.5m)
  if (slot % 17 === 12) {
    const groundY = sampleDriveHeight(x, stage);
    return {
      index: slot,
      kind: 'fuel',
      x,
      y: groundY + (stage.id === 'moon' ? 1.35 : 1.05),
      value: 100,
    };
  }

  // Coin clusters along crests & bridges
  const clusterId = Math.floor(slot / 5);
  const posInCluster = slot % 5;
  const br = getBridgeInfo(x, stage);
  const spawnChance = br.active ? 0.92 : 0.62;
  if (hash01(clusterId * 13 + 7) > spawnChance) {
    return null;
  }

  const groundY = sampleDriveHeight(x, stage);
  const arcLift = posInCluster === 2 ? 0.75 : posInCluster === 1 || posInCluster === 3 ? 0.4 : 0.0;
  const baseElevation = br.active ? 1.15 : 0.95 + hash01(clusterId + 99) * 0.7;
  const roll = hash01(slot * 19 + 53);
  const value = roll < 0.62 ? 5 : roll < 0.87 ? 25 : roll < 0.97 ? 100 : 500;

  return {
    index: slot,
    kind: 'coin',
    x,
    y: groundY + baseElevation + arcLift,
    value,
  };
}
