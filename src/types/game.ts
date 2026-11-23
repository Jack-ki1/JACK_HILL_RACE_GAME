export type GameScreen =
  | 'TITLE_MENU'
  | 'PLAYING'
  | 'PAUSED'
  | 'GAME_OVER'
  | 'GARAGE'
  | 'UPGRADES'
  | 'WORLD_MAP'
  | 'SHOP'
  | 'MISSIONS'
  | 'TUNING';

export type StageId = 'countryside' | 'red_canyon' | 'frost_peaks' | 'moon';

export type VehicleId = 'ranger' | 'monster' | 'buggy' | 'muscle' | 'superbike';

export type WheelStyleId = 'steel' | 'beadlock' | 'alloy' | 'carbon';

export type SurfaceType = 'dirt' | 'rock' | 'wood' | 'snow' | 'ice' | 'regolith';

export type UpgradeKey = 'engine' | 'suspension' | 'tires' | 'awd' | 'fuel';

export interface StageConfig {
  id: StageId;
  name: string;
  subtitle: string;
  unlockRequirementText: string;
  unlockPrevBestMeters: number;
  skyTop: string;
  skyHorizon: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  topSurfaceColor: string;
  topSurfaceEdgeColor: string;
  dirtUpperColor: string;
  dirtLowerColor: string;
  farRidgeColor: string;
  midRidgeColor: string;
  gravityMult: number;
  gripMult: number;
  ampMult: number;
  wavelengthMult: number;
  hasBridges: boolean;
  bridgeInterval: number;
  hasAurora: boolean;
  hasStars: boolean;
  hasSnowfall: boolean;
  hasDustHaze: boolean;
  headlightsOn: boolean;
  badgeGradient: string;
}

export interface VehicleConfig {
  id: VehicleId;
  name: string;
  tagline: string;
  vehicleClass: string;
  price: number;
  wheelbase: number;
  wheelRadius: number;
  rearWheelScale: number;
  frontWheelScale: number;
  suspensionRest: number;
  suspensionTravel: number;
  chassisHeight: number;
  chassisLength: number;
  headY: number;
  headX: number;
  hasRollCage: boolean;
  powerMult: number;
  springMult: number;
  gripMult: number;
  airControlMult: number;
  topSpeedMs: number;
  defaultPaintId: string;
}

export interface PaintSwatch {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
}

export interface WheelStyleConfig {
  id: WheelStyleId;
  name: string;
  rimColor: string;
  tireColor: string;
  spokeCount: number;
  metalness: number;
  roughness: number;
  price: number;
}

export interface TuningConfig {
  enginePower: number;
  suspensionStiffness: number;
  damping: number;
  tireGrip: number;
  airControl: number;
  gravityScale: number;
  rearDriveBias: number;
  cameraZoom: number;
}

export interface UpgradeLevels {
  engine: number;
  suspension: number;
  tires: number;
  awd: number;
  fuel: number;
}

export interface SaveData {
  coins: number;
  gems: number;
  tickets: number;
  ticketTimestamp: number;
  freeGemsTimestamp: number;
  selectedStage: StageId;
  selectedVehicle: VehicleId;
  unlockedVehicles: Record<VehicleId, boolean>;
  vehiclePaints: Record<VehicleId, string>;
  vehicleWheels: Record<VehicleId, WheelStyleId>;
  unlockedWheels: Record<WheelStyleId, boolean>;
  upgrades: Record<VehicleId, UpgradeLevels>;
  stageBests: Record<StageId, number>;
  boosters: {
    fuelSaver: number;
    nitroCharge: number;
    coinMagnet: number;
  };
  claimedRewards: Record<string, boolean>;
  totals: {
    distanceMeters: number;
    coinsCollected: number;
    flipsCompleted: number;
    bestSingleRunMeters: number;
    runsCompleted: number;
  };
  tuning: TuningConfig;
  muted: boolean;
}

export interface StuntCallout {
  id: number;
  title: string;
  bonusCoins: number;
  remainingSec: number;
}

export interface RunSummary {
  reason: string;
  distanceMeters: number;
  coinsEarned: number;
  flips: number;
  maxSpeedKmh: number;
  airTimeTotal: number;
  isNewBest: boolean;
  stageBestMeters: number;
  stageName: string;
}

export interface HudLiveSnapshot {
  distanceMeters: number;
  bestMeters: number;
  fuelPct: number;
  runCoins: number;
  totalCoins: number;
  gems: number;
  speedKmh: number;
  rpmNorm: number;
  boostNorm: number;
  nitroEnergy: number;
  gear: number;
  airborne: boolean;
  callout: StuntCallout | null;
}

export interface InputState {
  gas: boolean;
  brake: boolean;
  nitro: boolean;
  handbrake: boolean;
}
