export type GameScreen =
  | 'TITLE_MENU'
  | 'PADDOCK'
  | 'PLAYING'
  | 'PAUSED'
  | 'SUMMIT'
  | 'GAME_OVER'
  | 'GARAGE'
  | 'UPGRADES'
  | 'WORLD_MAP'
  | 'SHOP'
  | 'MISSIONS'
  | 'TUNING'
  | 'SETTINGS';

export type GraphicsQuality = 'auto' | 'high' | 'medium' | 'low';

export type CameraShakeMode = 'full' | 'subtle' | 'off';

export type RivalMode = 'ai' | 'ghost' | 'off';

export type TouchControlsMode = 'auto' | 'always' | 'off';

export type ProBuildId = 'stock' | 'crawler' | 'street' | 'donk';

export type LandingGrade = 'PERFECT' | 'CLEAN' | 'HARD';

export type WeatherCondition = 'dry' | 'wet' | 'storm';

export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export type ClimbMode = 'time_attack' | 'head_to_head' | 'ghost';

export type ClimbDifficulty = 'rookie' | 'pro' | 'extreme';

export type ClimbTireId = 'all_terrain' | 'mud_bogger' | 'rock_crawler' | 'ice_studded';

export type CameraMode = 'chase' | 'wide' | 'bumper';

export type SurfaceCategory = 'dirt_mud' | 'rock_canyon' | 'snow_ice' | 'lunar' | 'asphalt';

export type MedalTier = 'GOLD' | 'SILVER' | 'BRONZE' | 'FINISHER';

export interface ClimbSetupConfig {
  weather: WeatherCondition;
  timeOfDay: TimeOfDay;
  climbMode: ClimbMode;
  difficulty: ClimbDifficulty;
}

export interface ClimbTireConfig {
  id: ClimbTireId;
  name: string;
  tag: string;
  desc: string;
  dirtGrip: number;
  mudGrip: number;
  rockGrip: number;
  iceSnowGrip: number;
  asphaltGrip: number;
  wearMult: number;
  rimAccent: string;
}

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  graphicsQuality: GraphicsQuality;
  cameraShake: CameraShakeMode;
  showGhost: boolean;
  rivalMode: RivalMode;
  reducedMotion: boolean;
  showControlHints: boolean;
  touchControlsMode: TouchControlsMode;
}

export type StageId = 'countryside' | 'red_canyon' | 'frost_peaks' | 'moon' | 'vice_coast';

export type VehicleId =
  | 'ranger'
  | 'monster'
  | 'buggy'
  | 'muscle'
  | 'superbike'
  | 'cheetah_vc'
  | 'donk_leonida';

export type WheelStyleId = 'steel' | 'beadlock' | 'alloy' | 'carbon';

export type VehicleAccessoryId = 'lightbar' | 'bullbar' | 'whip_flag' | 'snorkel';

export type TuningPartId =
  | 'landing_boost'
  | 'wings'
  | 'overcharged_turbo'
  | 'coin_boost'
  | 'jump_shocks'
  | 'winter_tires';

export type NeonColorId =
  | 'off'
  | 'vice_pink'
  | 'leonida_cyan'
  | 'miami_mint'
  | 'sunset_amber'
  | 'uv_violet';

export type LiveryId =
  | 'clean'
  | 'vice_stripes'
  | 'carbon_hood'
  | 'leonida_interceptor'
  | 'sunset_rally'
  | 'sticker_bomb'
  | 'viper_stripe';

export type SurfaceType =
  | 'dirt'
  | 'mud'
  | 'sand'
  | 'rock'
  | 'wood'
  | 'snow'
  | 'ice'
  | 'regolith'
  | 'asphalt';

export type UpgradeKey = 'engine' | 'suspension' | 'tires' | 'awd' | 'fuel';

export interface GhostSample {
  t: number;
  x: number;
  y: number;
  a: number;
}

export interface StageConfig {
  id: StageId;
  name: string;
  subtitle: string;
  unlockRequirementText: string;
  unlockPrevBestMeters: number;
  summitMeters: number;
  elevationGainMeters: number;
  maxGradePct: number;
  surfaceCategory: SurfaceCategory;
  surfaceLabel: string;
  previewImage: string;
  medalTargets: {
    goldSec: number;
    silverSec: number;
    bronzeSec: number;
  };
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
  hasWaterCrossings: boolean;
  hasTunnels: boolean;
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
  weightKg: number;
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

export interface NeonColorConfig {
  id: NeonColorId;
  name: string;
  hex: string;
}

export interface LiveryConfig {
  id: LiveryId;
  name: string;
  desc: string;
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
  rideHeight: number;
  gearRatio: number;
  proBuild: ProBuildId;
}

export interface UpgradeLevels {
  engine: number;
  suspension: number;
  tires: number;
  awd: number;
  fuel: number;
}

export interface DailyChallengeState {
  dateKey: string;
  bestMeters: number;
  targetMeters: number;
  rewardCoins: number;
  rewardGems: number;
  claimed: boolean;
}

export interface SaveData {
  coins: number;
  gems: number;
  tickets: number;
  ticketTimestamp: number;
  freeGemsTimestamp: number;
  selectedStage: StageId;
  selectedVehicle: VehicleId;
  climbSetup: ClimbSetupConfig;
  aiAutoTune: boolean;
  gyroEnabled: boolean;
  unlockedVehicles: Record<VehicleId, boolean>;
  vehiclePaints: Record<VehicleId, string>;
  vehicleWheels: Record<VehicleId, WheelStyleId>;
  vehicleClimbTires: Record<VehicleId, ClimbTireId>;
  unlockedWheels: Record<WheelStyleId, boolean>;
  vehicleAccessories: Record<VehicleId, VehicleAccessoryId[]>;
  unlockedAccessories: Record<VehicleAccessoryId, boolean>;
  vehicleTuningParts: Record<VehicleId, TuningPartId[]>;
  unlockedTuningParts: Record<TuningPartId, boolean>;
  vehicleNeons: Record<VehicleId, NeonColorId>;
  vehicleLiveries: Record<VehicleId, LiveryId>;
  upgrades: Record<VehicleId, UpgradeLevels>;
  stageBests: Record<StageId, number>;
  stageGhosts: Record<StageId, GhostSample[]>;
  boosters: {
    fuelSaver: number;
    nitroCharge: number;
    coinMagnet: number;
  };
  claimedRewards: Record<string, boolean>;
  dailyChallenge: DailyChallengeState;
  totals: {
    distanceMeters: number;
    coinsCollected: number;
    flipsCompleted: number;
    bestSingleRunMeters: number;
    runsCompleted: number;
  };
  tuning: TuningConfig;
  muted: boolean;
  settings: GameSettings;
  tutorialSeen: boolean;
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
  aiMarginMeters: number | null;
}

export interface NnWeightsBlob {
  version: number;
  inputSize: number;
  h1Size: number;
  h2Size: number;
  outputSize: number;
  w1: number[];
  b1: number[];
  w2: number[];
  b2: number[];
  w3: number[];
  b3: number[];
}

export interface NnEvolutionBonuses {
  overallMasteryPct: number;
  torqueBonusPct: number;
  suspensionDampingPct: number;
  slipDragReductionPct: number;
  tireWearResistancePct: number;
}

export interface NnServerState {
  weights: NnWeightsBlob;
  trainingSteps: number;
  samplesCaptured: number;
  summitsCompleted: number;
  recentLoss: number;
  lossHistory: number[];
  hillMastery: Record<StageId, number>;
  evolutionBonuses: NnEvolutionBonuses;
  updatedAt: string;
}

export interface NnTrainingSample {
  inputs: number[];
  targets: [number, number, number];
  weight: number;
}

export interface NnLiveTelemetry {
  inputs: number[];
  h1: number[];
  h2: number[];
  outputs: {
    steerPitch: number;
    throttle: number;
    brake: number;
  };
  nnAuthority: number;
  modeLabel: string;
}

export interface SummitAnalytics {
  stageId: StageId;
  stageName: string;
  climbMode: ClimbMode;
  difficulty: ClimbDifficulty;
  weather: WeatherCondition;
  timeOfDay: TimeOfDay;
  medal: MedalTier;
  climbTimeSec: number;
  topSpeedKmh: number;
  avgSpeedKmh: number;
  cleanLinePct: number;
  wheelspinDistMeters: number;
  tireHealthRemaining: number;
  sectorSplits: [number, number, number];
  masteryBefore: number;
  masteryAfter: number;
  aiMarginMeters: number | null;
  coinsEarned: number;
  flips: number;
  bonusesSnapshot: NnEvolutionBonuses;
  aiAutoTuneActive: boolean;
}

export interface HudLiveSnapshot {
  distanceMeters: number;
  summitMeters: number;
  progressFrac: number;
  climbTimeSec: number;
  bestMeters: number;
  nextFuelMeters: number | null;
  ghostDeltaMeters: number | null;
  rivalLabel: 'AI' | 'RIVAL';
  aiAutoPilot: boolean;
  watchAiMode: boolean;
  fuelPct: number;
  tireHealthPct: number;
  runCoins: number;
  totalCoins: number;
  gems: number;
  speedKmh: number;
  rpmNorm: number;
  boostNorm: number;
  nitroEnergy: number;
  gear: number;
  airborne: boolean;
  inWater: boolean;
  inTunnel: boolean;
  surface: SurfaceType;
  turboChargeNorm: number;
  overchargedActive: boolean;
  rollcageIntact: boolean;
  hasRollCage: boolean;
  comboCount: number;
  hasJumpShocks: boolean;
  slopeDeg: number;
  suspensionLoadNorm: number;
  airRotationDeg: number;
  burnoutCharge: number;
  landingGrade: LandingGrade | null;
  lowRangeActive: boolean;
  hasLowRange: boolean;
  activeAeroActive: boolean;
  vehicleId: VehicleId;
  callout: StuntCallout | null;
  playerNormX: number;
  aiNormX: number | null;
  ghostNormX: number | null;
  cameraMode: CameraMode;
  weather: WeatherCondition;
  timeOfDay: TimeOfDay;
  nnTelemetry: NnLiveTelemetry | null;
}

export interface InputState {
  gas: boolean;
  brake: boolean;
  nitro: boolean;
  handbrake: boolean;
  jump?: boolean;
  lowRange?: boolean;
  throttleAmount?: number;
  brakeAmount?: number;
  steerPitchAmount?: number;
}
