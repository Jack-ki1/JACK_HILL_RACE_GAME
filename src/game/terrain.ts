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

export function getBridgeInfo(
  x: number,
  stage: StageConfig,
): { active: boolean; startX: number; length: number; s: number } {
  if (!stage.hasBridges || stage.bridgeInterval <= 0) {
    return { active: false, startX: 0, length: 0, s: 0 };
  }
  const firstBridge = stage.id === 'red_canyon' ? 145 : 260;
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

/**
 * Base organic terrain height in meters (Y-up).
 * Smooth C1-continuous waves, launchpad flattening, progressive climbing ramps,
 * and stage-specific signature features (canyon gorges, lunar crater bowls, frost peaks).
 */
export function sampleBaseGroundHeight(x: number, stage: StageConfig): number {
  const dist = Math.max(0, x - START_X);
  // Smooth launchpad around start so spawn is level and stable
  const launchBlend = smoothstep((dist - 10) / 35);
  // Progressive difficulty ramp: gentle at start, steeper climbs after 400m..1800m
  const difficulty = 0.55 + Math.min(1.45, dist / 950);
  const wl = stage.wavelengthMult;
  const amp = stage.ampMult * launchBlend * difficulty;

  // Multi-octave rolling hills
  const h1 = Math.sin(x / (18 * wl)) * 2.4;
  const h2 = Math.sin(x / (8.2 * wl) + 1.4) * 1.05;
  const h3 = Math.sin(x / (3.9 * wl) + 2.6) * 0.34;
  // Micro bumpiness (subtle pebbles/undulations)
  const h4 = Math.sin(x / 1.45) * 0.07;

  // Gradual macro elevation waves (long climbs & valley descents)
  const macroClimb =
    Math.sin(dist / 160) * 3.8 * smoothstep((dist - 80) / 140) +
    Math.max(0, (dist - 150) * 0.012);

  let y = macroClimb + amp * (h1 + h2 + h3 + h4);

  // Signature tabletop jump ramps every ~125m after 90m
  if (dist > 90) {
    const rampPeriod = 125;
    const m = ((dist - 90) % rampPeriod + rampPeriod) % rampPeriod;
    const rampUp = smoothstep((m - 72) / 12);
    const rampDown = 1 - smoothstep((m - 92) / 7);
    y += rampUp * rampDown * 2.4 * stage.ampMult * Math.min(1.2, difficulty);
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

  return y;
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
  if (stage.id === 'frost_peaks') {
    // Periodic slick blue-ice stretches after 80m
    const dist = Math.max(0, x - START_X);
    if (dist > 75) {
      const sector = Math.floor(x / 24);
      if (hash01(sector + 41) < 0.36) {
        return { surface: 'ice', muMult: 0.48 };
      }
    }
    return { surface: 'snow', muMult: 0.86 };
  }
  if (stage.id === 'red_canyon') {
    const sector = Math.floor(x / 18);
    if (hash01(sector + 17) < 0.35) {
      return { surface: 'rock', muMult: 1.05 };
    }
    return { surface: 'dirt', muMult: 0.94 };
  }
  if (stage.id === 'moon') {
    return { surface: 'regolith', muMult: 0.96 };
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
      y: groundY + 1.05,
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
