import {
  CollectibleSpawn,
  getCollectibleForSlot,
  getSummitX,
  getTunnelInfo,
  sampleTerrain,
  TerrainSample,
} from './terrain';
import {
  ClimbDifficulty,
  ClimbTireId,
  InputState,
  LandingGrade,
  NnEvolutionBonuses,
  SaveData,
  StageConfig,
  SurfaceType,
  TuningPartId,
  VehicleConfig,
  WeatherCondition,
} from '../types/game';
import { getClimbTireById, START_X } from './constants';

export interface ParticleBurst {
  kind: 'dirt' | 'smoke' | 'nitro' | 'spark' | 'coin' | 'snow' | 'fuel';
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  life: number;
}

export interface PhysicsCallbacks {
  onCoin: (value: number, x: number, y: number) => void;
  onFuel: (x: number, y: number) => void;
  onStunt: (title: string, bonusCoins: number, flipsAdded: number) => void;
  onLanding: (intensity: number, surface: SurfaceType, grade?: LandingGrade | null) => void;
  onGearShift?: (gear: number) => void;
  onTurboSurge?: () => void;
  onJumpShock?: () => void;
  onRollcageBreak?: () => void;
  onScrape?: (intensity: number) => void;
  onSummitCrossed?: () => void;
  onCrash: (reason: string) => void;
  onParticle: (p: ParticleBurst) => void;
}

export interface PhysicsRunOptions {
  weather?: WeatherCondition;
  climbTireId?: ClimbTireId;
  aiBonuses?: NnEvolutionBonuses | null;
  difficulty?: ClimbDifficulty;
  isAiRacer?: boolean;
}

const TAU = Math.PI * 2;
const BASE_GRAVITY = 15.8; // Tuned m/s^2 for crisp arcade-realism arcs

export interface VehiclePhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  compR: number;
  compF: number;
  velCompR: number;
  velCompF: number;
  spinR: number;
  spinF: number;
  rotR: number;
  rotF: number;
  groundedR: boolean;
  groundedF: boolean;
  inWater: boolean;
  inTunnel: boolean;
  waterDepth: number;
  surface: SurfaceType;
  throttle: number;
  rpm: number;
  gear: number;
  nitroActive: boolean;
  nitroEnergy: number; // 0..100 rechargeable boost reserve
  braking: boolean;
  torsoAngle: number;
  torsoVel: number;
  headAngle: number;
  headVel: number;
  fuel: number; // 0..100
  runCoins: number;
  flips: number;
  airTime: number;
  airTimeTotal: number;
  airAccumAngle: number;
  wheelieTime: number;
  maxSpeedKmh: number;
  rollcageIntact: boolean;
  turboChargeNorm: number;
  overchargedActive: boolean;
  coinBoostTimer: number;
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
  whipAngle: number;
  whipVel: number;
  effectiveSuspensionRest: number;
  tireRadiusScale: number;
  tireHealth: number;
  wheelspinDistMeters: number;
  elapsedTimeSec: number;
  cleanLineSamples: number;
  totalDriveSamples: number;
  sectorSplits: [number, number, number];
  summitCrossed: boolean;
  crashed: boolean;
  crashReason: string;
  hitstopTimer: number;
  shakeIntensity: number;
}

export class HillClimbPhysics {
  public state: VehiclePhysicsState;
  private stage: StageConfig;
  private vehicle: VehicleConfig;
  private save: SaveData;
  private weather: WeatherCondition;
  private climbTireId: ClimbTireId;
  private aiBonuses: NnEvolutionBonuses | null;
  private collectedSlots = new Set<number>();
  private fuelSaverActive = false;
  private nitroBoosterActive = false;
  private magnetActive = false;
  private hasSnorkel = false;
  private equippedParts = new Set<TuningPartId>();
  private lowSpeedFuelTimer = 0;
  private headContactTimer = 0;
  private particleAccum = 0;
  private wheelieRewardStep = 0;
  private jumpCooldown = 0;
  private prevJumpTrigger = false;
  private minUpDotInAir = 1;
  private comboWindowTimer = 0;
  private landingGradeTimer = 0;
  private prevVx = 0;
  private cb: PhysicsCallbacks;

  // Derived tuned parameters
  private mass = 1.0;
  private inertia = 1.65;
  private engineTorque = 1.0;
  private topSpeed = 31;
  private springK = 1.0;
  private dampComp = 1.0;
  private dampRebound = 1.0;
  private tireMu = 1.0;
  private awdShare = 0.5;
  private airTorque = 1.0;
  private gravity = BASE_GRAVITY;
  private fuelBurnMult = 1.0;
  private gearRatio = 1.0;
  private effectiveSuspRest = 0.56;
  private tireScaleBonus = 1.0;
  private slipDragScale = 1.0;
  private tireWearScale = 1.0;

  constructor(
    stage: StageConfig,
    vehicle: VehicleConfig,
    save: SaveData,
    cb: PhysicsCallbacks,
    consumeBoosters = false,
    options?: PhysicsRunOptions,
  ) {
    this.stage = stage;
    this.vehicle = vehicle;
    this.save = save;
    this.cb = cb;
    this.weather = options?.weather ?? save.climbSetup?.weather ?? 'dry';
    this.climbTireId =
      options?.climbTireId ?? save.vehicleClimbTires?.[vehicle.id] ?? 'all_terrain';
    this.aiBonuses = options?.aiBonuses ?? null;

    if (consumeBoosters) {
      if (save.boosters.fuelSaver > 0) {
        this.fuelSaverActive = true;
      }
      if (save.boosters.nitroCharge > 0) {
        this.nitroBoosterActive = true;
      }
      if (save.boosters.coinMagnet > 0) {
        this.magnetActive = true;
      }
    }

    this.hasSnorkel = Boolean(
      save.vehicleAccessories?.[vehicle.id]?.includes('snorkel'),
    );
    const parts = save.vehicleTuningParts?.[vehicle.id] ?? [];
    parts.forEach((p) => this.equippedParts.add(p));

    this.recomputeParams();
    this.state = this.createInitialState();
  }

  public recomputeParams(): void {
    const u = this.save.upgrades[this.vehicle.id];
    const t = this.save.tuning;
    const v = this.vehicle;
    const s = this.stage;
    const snorkelPowerMult = this.hasSnorkel ? 1.04 : 1.0;
    const snorkelSpeedMult = this.hasSnorkel ? 1.03 : 1.0;

    this.mass = 1.0;
    this.inertia =
      v.id === 'superbike'
        ? 1.35
        : v.id === 'monster'
          ? 2.65
          : v.id === 'buggy'
            ? 1.95
            : v.id === 'cheetah_vc'
              ? 2.05
              : v.id === 'donk_leonida'
                ? 2.38
                : 2.25;
    this.gearRatio = Math.max(0.75, Math.min(1.3, t.gearRatio ?? 1.0));
    const gearTorqueFactor = 1.12 - 0.12 * this.gearRatio;
    const gearSpeedFactor = 0.85 + 0.15 * this.gearRatio;

    const torqueMult = 1 + (this.aiBonuses?.torqueBonusPct ?? 0) / 100;
    const dampMult = 1 + (this.aiBonuses?.suspensionDampingPct ?? 0) / 100;
    this.slipDragScale = Math.max(0.65, 1 - (this.aiBonuses?.slipDragReductionPct ?? 0) / 100);
    const tireComp = getClimbTireById(this.climbTireId);
    this.tireWearScale =
      tireComp.wearMult * Math.max(0.55, 1 - (this.aiBonuses?.tireWearResistancePct ?? 0) / 100);

    const weatherGripMult =
      this.weather === 'storm' ? 0.78 : this.weather === 'wet' ? 0.88 : 1.0;

    this.engineTorque =
      23.5 *
      v.powerMult *
      (1 + 0.08 * u.engine) *
      t.enginePower *
      snorkelPowerMult *
      gearTorqueFactor *
      torqueMult;
    this.topSpeed =
      v.topSpeedMs *
      (1 + 0.045 * u.engine) *
      (0.85 + 0.15 * t.enginePower) *
      snorkelSpeedMult *
      gearSpeedFactor;

    this.springK = 52.0 * v.springMult * (1 + 0.07 * u.suspension) * t.suspensionStiffness;
    this.dampComp = 10.4 * (1 + 0.06 * u.suspension) * t.damping * dampMult;
    this.dampRebound = 12.2 * (1 + 0.06 * u.suspension) * t.damping * dampMult;

    this.tireMu =
      1.48 *
      s.gripMult *
      v.gripMult *
      (1 + 0.07 * u.tires) *
      t.tireGrip *
      weatherGripMult;
    const awdBonus = u.awd * 0.045;
    this.awdShare = Math.min(0.95, Math.max(0.15, (1 - t.rearDriveBias) + awdBonus));
    this.airTorque = 9.2 * v.airControlMult * t.airControl;
    this.gravity = BASE_GRAVITY * s.gravityMult * t.gravityScale;

    this.effectiveSuspRest = Math.max(
      0.28,
      v.suspensionRest +
        Math.min(0.14, Math.max(0, u.suspension - 1) * 0.014) +
        (t.rideHeight ?? 0),
    );
    this.tireScaleBonus = 1 + Math.min(0.085, Math.max(0, u.tires - 1) * 0.009);

    const fuelUpgrade = 1 + 0.1 * u.fuel;
    this.fuelBurnMult = (this.fuelSaverActive ? 0.52 : 1.0) / fuelUpgrade;
  }

  private createInitialState(): VehiclePhysicsState {
    const x = START_X;
    const ground = sampleTerrain(x, this.stage);
    const wheelR = this.vehicle.wheelRadius * this.tireScaleBonus;
    const startY = ground.y + this.effectiveSuspRest + wheelR - 0.14;
    const hasLowRange = this.vehicle.id === 'ranger' || this.vehicle.id === 'monster';
    return {
      x,
      y: startY,
      vx: 0,
      vy: 0,
      angle: 0,
      omega: 0,
      compR: 0.12,
      compF: 0.12,
      velCompR: 0,
      velCompF: 0,
      spinR: 0,
      spinF: 0,
      rotR: 0,
      rotF: 0,
      groundedR: true,
      groundedF: true,
      inWater: false,
      inTunnel: false,
      waterDepth: 0,
      surface: ground.surface,
      throttle: 0,
      rpm: 0.18,
      gear: 1,
      nitroActive: false,
      nitroEnergy: 100,
      braking: false,
      torsoAngle: 0,
      torsoVel: 0,
      headAngle: 0,
      headVel: 0,
      fuel: 100,
      runCoins: 0,
      flips: 0,
      airTime: 0,
      airTimeTotal: 0,
      airAccumAngle: 0,
      wheelieTime: 0,
      maxSpeedKmh: 0,
      rollcageIntact: this.vehicle.hasRollCage,
      turboChargeNorm: 0,
      overchargedActive: false,
      coinBoostTimer: 0,
      comboCount: 0,
      hasJumpShocks: this.equippedParts.has('jump_shocks'),
      slopeDeg: 0,
      suspensionLoadNorm: 0.25,
      airRotationDeg: 0,
      burnoutCharge: 0,
      landingGrade: null,
      lowRangeActive: false,
      hasLowRange,
      activeAeroActive: false,
      whipAngle: 0.12,
      whipVel: 0,
      effectiveSuspensionRest: this.effectiveSuspRest,
      tireRadiusScale: this.tireScaleBonus,
      tireHealth: 100,
      wheelspinDistMeters: 0,
      elapsedTimeSec: 0,
      cleanLineSamples: 0,
      totalDriveSamples: 0,
      sectorSplits: [0, 0, 0],
      summitCrossed: false,
      crashed: false,
      crashReason: '',
      hitstopTimer: 0,
      shakeIntensity: 0,
    };
  }

  public isSlotCollected(slot: number): boolean {
    return this.collectedSlots.has(slot);
  }

  public getNextFuelDistanceMeters(): number | null {
    const curSlot = Math.max(4, Math.floor((this.state.x - START_X) / 6.5));
    // Search next few fuel slots (every slot % 17 === 12)
    let nextSlot = curSlot + ((12 - (curSlot % 17) + 17) % 17);
    if (nextSlot < 12) nextSlot = 12;
    for (let k = 0; k < 4; k++) {
      const candidate = nextSlot + k * 17;
      if (!this.collectedSlots.has(candidate)) {
        const fx = START_X + candidate * 6.5;
        return Math.max(0, Math.round(fx - this.state.x));
      }
    }
    return null;
  }

  public getWheelWorldPosition(isFront: boolean): { x: number; y: number } {
    const s = this.state;
    const v = this.vehicle;
    const lx = isFront ? v.wheelbase * 0.5 : -v.wheelbase * 0.5;
    const comp = isFront ? s.compF : s.compR;
    const ly = -this.effectiveSuspRest + comp;
    const cs = Math.cos(s.angle);
    const sn = Math.sin(s.angle);
    return {
      x: s.x + lx * cs - ly * sn,
      y: s.y + lx * sn + ly * cs,
    };
  }

  private awardComboStunt(title: string, baseBonus: number, flipsAdded: number): void {
    const s = this.state;
    if (baseBonus > 0) {
      s.comboCount = this.comboWindowTimer > 0 ? Math.min(5, s.comboCount + 1) : 1;
      this.comboWindowTimer = 4.2;
      const mult = 1 + (s.comboCount - 1) * 0.25;
      const scaledBonus = Math.round(baseBonus * mult);
      s.runCoins += scaledBonus;
      s.flips += flipsAdded;
      const prefix = s.comboCount >= 2 ? `${s.comboCount}x COMBO · ` : '';
      this.cb.onStunt(`${prefix}${title}`, scaledBonus, flipsAdded);
    } else {
      this.cb.onStunt(title, 0, flipsAdded);
    }
  }

  public step(dt: number, input: InputState): void {
    const s = this.state;
    const v = this.vehicle;

    // Decay screen shake & timers smoothly even during hitstop
    s.shakeIntensity = Math.max(0, s.shakeIntensity - dt * 2.8);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    s.coinBoostTimer = Math.max(0, s.coinBoostTimer - dt);
    if (this.landingGradeTimer > 0) {
      this.landingGradeTimer = Math.max(0, this.landingGradeTimer - dt);
      if (this.landingGradeTimer === 0) s.landingGrade = null;
    }
    if (this.comboWindowTimer > 0) {
      this.comboWindowTimer = Math.max(0, this.comboWindowTimer - dt);
      if (this.comboWindowTimer === 0) s.comboCount = 0;
    }

    if (s.hitstopTimer > 0) {
      s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
      return;
    }

    if (s.crashed) {
      s.vx *= 1 - Math.min(1, dt * 3);
      s.vy -= this.gravity * dt * 0.6;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      return;
    }

    if (!s.summitCrossed) {
      s.elapsedTimeSec += dt;
    }

    const rawGas =
      input.throttleAmount !== undefined
        ? Math.max(0, Math.min(1, input.throttleAmount))
        : input.gas
          ? 1
          : 0;
    const rawBrake =
      input.brakeAmount !== undefined
        ? Math.max(0, Math.min(1, input.brakeAmount))
        : input.brake
          ? 1
          : 0;
    const gas = s.fuel > 0 ? rawGas : 0;
    const brake = rawBrake;
    const nitroPressed = input.nitro && gas > 0.1 && s.nitroEnergy > 2 && s.fuel > 0;
    s.nitroActive = nitroPressed;
    s.braking = brake > 0.1 || input.handbrake;
    s.lowRangeActive = Boolean(s.hasLowRange && input.lowRange);

    // Launch Burnout Charge: holding Brake + Gas while nearly stationary charges launch boost & spins rear tires
    const isBurnoutHolding =
      gas > 0 && brake > 0 && (s.groundedR || s.groundedF) && Math.abs(s.vx) < 3.2;
    if (isBurnoutHolding) {
      s.burnoutCharge = Math.min(1, s.burnoutCharge + dt * 0.85);
      s.vx *= 1 - Math.min(1, dt * 10);
      s.spinR = Math.min(48, s.spinR + 36 * dt);
      if (Math.random() < 0.55) {
        const rw = this.getWheelWorldPosition(false);
        this.cb.onParticle({
          kind: 'smoke',
          x: rw.x - 0.15,
          y: rw.y - v.wheelRadius * 0.72,
          z: (Math.random() > 0.5 ? 1 : -1) * 0.65,
          vx: -2.2 - Math.random() * 2.5,
          vy: 1.2 + Math.random() * 2.2,
          vz: (Math.random() - 0.5) * 1.8,
          size: 0.34,
          life: 0.55,
        });
      }
    } else if (s.burnoutCharge > 0.25 && gas > 0 && brake === 0) {
      // Unleash charged launch burst!
      const boostKick = 5.5 + s.burnoutCharge * 7.5;
      s.vx += Math.cos(s.angle) * boostKick;
      s.vy += Math.sin(s.angle) * boostKick * 0.4;
      s.shakeIntensity = Math.max(s.shakeIntensity, 0.32);
      if (s.burnoutCharge > 0.65) {
        this.cb.onTurboSurge?.();
        this.awardComboStunt('BURN LAUNCH!', 30, 0);
      }
      s.burnoutCharge = 0;
    } else {
      s.burnoutCharge = Math.max(0, s.burnoutCharge - dt * 1.4);
    }

    if (nitroPressed) {
      const drainRate = this.nitroBoosterActive ? 14 : 22;
      s.nitroEnergy = Math.max(0, s.nitroEnergy - drainRate * dt);
    } else {
      const regenRate = this.nitroBoosterActive ? 14 : 9.5;
      s.nitroEnergy = Math.min(100, s.nitroEnergy + regenRate * dt);
    }

    const targetThr = isBurnoutHolding ? 1 : gas - brake * 0.78;
    s.throttle += (targetThr - s.throttle) * Math.min(1, dt * 11);

    // Fuel consumption
    if (s.fuel > 0) {
      const burn = (1.35 + gas * 2.1 + (nitroPressed ? 1.8 : 0)) * this.fuelBurnMult;
      s.fuel = Math.max(0, s.fuel - burn * dt);
    }

    const cs = Math.cos(s.angle);
    const sn = Math.sin(s.angle);
    const curForwardSpeed = Math.abs(s.vx * cs + s.vy * sn);

    // Overcharged Turbo charging & activation
    if (this.equippedParts.has('overcharged_turbo')) {
      const wasActive = s.overchargedActive;
      if (gas > 0 && curForwardSpeed > this.topSpeed * 0.48) {
        s.turboChargeNorm = Math.min(1, s.turboChargeNorm + dt * 0.68);
        if (s.turboChargeNorm >= 1) {
          s.overchargedActive = true;
          if (!wasActive) {
            this.cb.onTurboSurge?.();
          }
        }
      } else {
        s.turboChargeNorm = Math.max(0, s.turboChargeNorm - dt * 0.52);
        if (s.turboChargeNorm < 0.72 || curForwardSpeed < this.topSpeed * 0.36) {
          s.overchargedActive = false;
        }
      }
    } else {
      s.turboChargeNorm = 0;
      s.overchargedActive = false;
    }

    const effectiveTopSpeed =
      this.topSpeed *
      (s.lowRangeActive ? 0.62 : 1.0) *
      (s.overchargedActive ? 1.22 : 1.0) *
      (s.coinBoostTimer > 0 ? 1.16 : 1.0);
    const hasWinterTires = this.equippedParts.has('winter_tires');

    let totalFx = 0;
    let totalFy = -this.mass * this.gravity;
    let totalTorque = 0;

    // Nitro thrust + Coin Boost / Overcharged Turbo forward kick along chassis forward vector
    if (nitroPressed) {
      const nitroForce = (this.nitroBoosterActive ? 18.5 : 13.5) * v.powerMult;
      totalFx += cs * nitroForce;
      totalFy += sn * nitroForce;
      totalTorque += 0.45 * v.powerMult;
    }
    if (s.overchargedActive && gas > 0) {
      const otForce = 7.2 * v.powerMult;
      totalFx += cs * otForce;
      totalFy += sn * otForce;
    }
    if (s.coinBoostTimer > 0 && gas > 0) {
      const cbForce = 5.4 * v.powerMult;
      totalFx += cs * cbForce;
      totalFy += sn * cbForce;
    }

    // Storm wind resistance on steep exposed climbs
    if (this.weather === 'storm' && s.vx > 6) {
      totalFx -= s.vx * 0.24 * this.slipDragScale;
    }

    // Cheetah VC Active Aero Wing: deploys upward on hard braking or steep dive for stability
    s.activeAeroActive =
      v.id === 'cheetah_vc' && ((brake > 0.1 && curForwardSpeed > 10) || (!s.groundedR && !s.groundedF && s.vy < -2));
    if (s.activeAeroActive && (s.groundedR || s.groundedF)) {
      totalFy -= Math.min(8.5, curForwardSpeed * 0.28);
    }

    // Kangaroo Jump Shocks manual spring burst (Space / JUMP button)
    const jumpTrigger = Boolean(
      input.jump || (input.handbrake && (s.groundedR || s.groundedF) && this.equippedParts.has('jump_shocks')),
    );
    if (
      this.equippedParts.has('jump_shocks') &&
      jumpTrigger &&
      !this.prevJumpTrigger &&
      this.jumpCooldown <= 0 &&
      (s.groundedR || s.groundedF)
    ) {
      this.jumpCooldown = 1.8;
      s.vy = Math.max(s.vy + 6.8, 7.6);
      s.vx += cs * 1.4;
      s.compR = 0;
      s.compF = 0;
      s.groundedR = false;
      s.groundedF = false;
      s.shakeIntensity = Math.max(s.shakeIntensity, 0.28);
      this.cb.onJumpShock?.();
      for (let j = 0; j < 10; j++) {
        this.cb.onParticle({
          kind: 'spark',
          x: s.x + (Math.random() - 0.5) * v.wheelbase,
          y: s.y - this.effectiveSuspRest,
          z: (Math.random() - 0.5) * 1.1,
          vx: (Math.random() - 0.5) * 4,
          vy: 1.5 + Math.random() * 3.5,
          vz: (Math.random() - 0.5) * 3,
          size: 0.16,
          life: 0.35,
        });
      }
    }
    this.prevJumpTrigger = jumpTrigger;

    const wasAirborne = !s.groundedR && !s.groundedF;
    let impactMaxVy = 0;
    let didBottomOut = false;
    let lastTouchSurface: SurfaceType = s.surface;

    // Evaluate Rear (0) and Front (1) wheel suspension & tire contact
    const evalWheel = (isFront: boolean): boolean => {
      const lx = isFront ? v.wheelbase * 0.5 : -v.wheelbase * 0.5;
      const wScale = isFront ? v.frontWheelScale : v.rearWheelScale;
      const wRadius = v.wheelRadius * wScale * this.tireScaleBonus;
      const prevComp = isFront ? s.compF : s.compR;

      // Wheel hub position at current compression
      const ly = -this.effectiveSuspRest + prevComp;
      const rx = lx * cs - ly * sn;
      const ry = lx * sn + ly * cs;
      const wx = s.x + rx;
      const wy = s.y + ry;

      const terr: TerrainSample = sampleTerrain(wx, this.stage);
      if (!isFront) {
        s.surface = terr.surface;
        s.slopeDeg = Math.round((Math.atan(terr.slope) * 180) / Math.PI);
      }

      // Distance that wheel bottom penetrates terrain along vertical / normal
      const wheelBottomY = wy - wRadius;
      const pen = (terr.y - wheelBottomY) * Math.max(0.35, terr.ny);

      if (pen > 0) {
        const vx = s.vx - s.omega * ry;
        const vy = s.vy + s.omega * rx;
        const vn = vx * terr.nx + vy * terr.ny;
        const vt = vx * terr.tx + vy * terr.ty;

        if (vn < -impactMaxVy) {
          impactMaxVy = -vn;
          lastTouchSurface = terr.surface;
        }

        const nextComp = Math.min(v.suspensionTravel, Math.max(0, prevComp + pen * 0.65));
        const velComp = (nextComp - prevComp) / dt;
        const clampedCompVel = Math.max(-12, Math.min(12, velComp));

        const travelFrac = nextComp / v.suspensionTravel;
        const bumpStop = travelFrac > 0.80 ? Math.pow((travelFrac - 0.80) / 0.20, 2) * 18 : 0;
        const dampRate = clampedCompVel >= 0 ? this.dampComp : this.dampRebound;
        let normalForce = this.springK * nextComp + dampRate * clampedCompVel + bumpStop;
        if (prevComp + pen > v.suspensionTravel) {
          didBottomOut = true;
          const hardPen = prevComp + pen - v.suspensionTravel;
          normalForce += hardPen * 92 + Math.max(0, -vn) * 11.5;
        }
        if (vn > 1.0 && travelFrac > 0.45) {
          normalForce *= Math.max(0.45, 1 - vn * 0.08);
        }
        normalForce = Math.max(0, Math.min(58, normalForce));

        // Drive torque allocation + 4x4 Low-Range crawl + Tuning Parts
        const driveBias = s.lowRangeActive ? 0.58 : isFront ? this.awdShare : 1 - this.awdShare * 0.55;
        const speedRatio = Math.abs(vt) / effectiveTopSpeed;
        const torqueFalloff = s.throttle * vt > 0 ? Math.max(0.08, 1 - Math.pow(speedRatio, 1.8)) : 1.0;

        let driveCmd =
          s.throttle *
          this.engineTorque *
          (s.lowRangeActive ? 1.65 : 1.0) *
          driveBias *
          torqueFalloff;
        if (
          terr.slope > 0.36 &&
          Math.abs(vt) < 12 &&
          v.id !== 'superbike' &&
          v.id !== 'cheetah_vc' &&
          s.throttle > 0
        ) {
          driveCmd *= 1.18;
        }
        if (nitroPressed) driveCmd *= 1.32;
        if (s.overchargedActive) driveCmd *= 1.36;
        if (s.coinBoostTimer > 0) driveCmd *= 1.24;
        if (isBurnoutHolding) driveCmd = 0;

        if (terr.surface === 'mud' || terr.surface === 'sand') {
          const baseDrag = terr.surface === 'mud' ? 2.0 : 1.2;
          const dragCoeff = (hasWinterTires ? baseDrag * 0.45 : baseDrag) * this.slipDragScale;
          driveCmd -= vt * dragCoeff;
        }

        if (input.handbrake && !this.equippedParts.has('jump_shocks')) {
          driveCmd = -Math.sign(vt) * Math.min(Math.abs(vt) * 18, 22);
        } else if (gas <= 0.02 && brake <= 0.02) {
          driveCmd -= vt * 0.65;
        } else if (brake > 0.05 && vt > 1.2) {
          driveCmd = -brake * (s.activeAeroActive ? 29.0 : 24.0);
        }

        const tireCompound = getClimbTireById(this.climbTireId);
        const compoundMult =
          terr.surface === 'mud' || terr.surface === 'sand'
            ? tireCompound.mudGrip
            : terr.surface === 'rock' || terr.surface === 'regolith'
              ? tireCompound.rockGrip
              : terr.surface === 'ice' || terr.surface === 'snow'
                ? tireCompound.iceSnowGrip
                : terr.surface === 'asphalt'
                  ? tireCompound.asphaltGrip
                  : tireCompound.dirtGrip;

        const winterSurfaceBonus =
          hasWinterTires &&
          (terr.surface === 'ice' ||
            terr.surface === 'snow' ||
            terr.surface === 'mud' ||
            terr.surface === 'sand')
            ? 1.48
            : 1.0;
        const lowRangeGripBonus = s.lowRangeActive ? 1.22 : 1.0;
        const tireHealthFactor = 0.78 + 0.22 * (s.tireHealth / 100);
        const maxTraction =
          this.tireMu *
          terr.muMult *
          compoundMult *
          winterSurfaceBonus *
          lowRangeGripBonus *
          tireHealthFactor *
          normalForce;
        const tractionForce = Math.max(-maxTraction, Math.min(maxTraction, driveCmd));

        const targetSpin =
          isBurnoutHolding && !isFront
            ? 42
            : input.handbrake && !this.equippedParts.has('jump_shocks')
              ? 0
              : vt / wRadius + ((driveCmd - tractionForce) * 0.25) / wRadius;
        const nextSpin =
          (isFront ? s.spinF : s.spinR) +
          (targetSpin - (isFront ? s.spinF : s.spinR)) * Math.min(1, dt * 18);

        if (isFront) {
          s.compF = nextComp;
          s.velCompF = clampedCompVel;
          s.spinF = nextSpin;
        } else {
          s.compR = nextComp;
          s.velCompR = clampedCompVel;
          s.spinR = nextSpin;
        }

        const fx = normalForce * terr.nx + tractionForce * terr.tx;
        const fy = normalForce * terr.ny + tractionForce * terr.ty;
        totalFx += fx;
        totalFy += fy;
        totalTorque += rx * fy - ry * fx;

        return true;
      } else {
        const nextComp = Math.max(0, prevComp - Math.min(prevComp, 2.8 * dt));
        const velComp = (nextComp - prevComp) / dt;
        const freeSpin = s.throttle * (effectiveTopSpeed / wRadius) * 0.9;
        const curSpin = isFront ? s.spinF : s.spinR;
        const nextSpin =
          curSpin + (freeSpin - curSpin) * Math.min(1, dt * (gas || brake ? 4.5 : 0.8));

        if (isFront) {
          s.compF = nextComp;
          s.velCompF = velComp;
          s.spinF = nextSpin;
        } else {
          s.compR = nextComp;
          s.velCompR = velComp;
          s.spinR = nextSpin;
        }
        return false;
      }
    };

    s.groundedR = evalWheel(false);
    s.groundedF = evalWheel(true);

    // Chassis hull & roll-cage collision points so body never clips through hills
    const hullPoints: { lx: number; ly: number; r: number; isHead?: boolean }[] = [
      { lx: -v.chassisLength * 0.45, ly: 0.1, r: 0.28 },
      { lx: v.chassisLength * 0.46, ly: 0.12, r: 0.28 },
      { lx: 0, ly: 0.05, r: 0.3 },
      { lx: v.headX - 0.55, ly: v.headY + 0.15, r: 0.24 },
      { lx: v.headX + 0.45, ly: v.headY + 0.12, r: 0.24 },
      { lx: v.headX, ly: v.headY + 0.22, r: 0.25, isHead: true },
    ];

    let headTouching = false;
    for (let i = 0; i < hullPoints.length; i++) {
      const hp = hullPoints[i];
      const rx = hp.lx * cs - hp.ly * sn;
      const ry = hp.lx * sn + hp.ly * cs;
      const wx = s.x + rx;
      const wy = s.y + ry;
      const terr = sampleTerrain(wx, this.stage);
      const pen = terr.y - (wy - hp.r);
      if (pen > 0) {
        if (hp.isHead) {
          headTouching = true;
          const upDot = Math.cos(s.angle); // < 0 means upside down
          const vx = s.vx - s.omega * ry;
          const vy = s.vy + s.omega * rx;
          const impactSpeed = Math.hypot(vx, vy);
          if (upDot < -0.32) {
            if (s.rollcageIntact) {
              // Breakable Rollcage absorbs the first hard inverted head crash!
              s.rollcageIntact = false;
              s.y += pen + 0.18;
              s.vy = Math.max(s.vy, 3.8);
              s.omega *= -0.35;
              this.headContactTimer = 0;
              s.shakeIntensity = Math.max(s.shakeIntensity, 0.72);
              this.cb.onRollcageBreak?.();
              this.awardComboStunt('ROLLCAGE SHATTERED!', 0, 0);
              for (let sp = 0; sp < 12; sp++) {
                this.cb.onParticle({
                  kind: 'spark',
                  x: wx + (Math.random() - 0.5) * 0.6,
                  y: terr.y + 0.12,
                  z: (Math.random() - 0.5) * 0.8,
                  vx: (Math.random() - 0.5) * 8,
                  vy: 2.5 + Math.random() * 5,
                  vz: (Math.random() - 0.5) * 4,
                  size: 0.18,
                  life: 0.45,
                });
              }
              return;
            }
            if (!v.hasRollCage || impactSpeed > 7.2 || this.headContactTimer > 0.18) {
              this.triggerCrash('Driver Head Impact!');
              return;
            }
          }
        }
        const vx = s.vx - s.omega * ry;
        const vy = s.vy + s.omega * rx;
        const vn = vx * terr.nx + vy * terr.ny;
        const vt = vx * terr.tx + vy * terr.ty;

        const hullN = Math.max(0, Math.min(68, pen * 74 - vn * 12));
        const hullT = Math.max(-hullN * 0.28, Math.min(hullN * 0.28, -vt * 3.8));

        const fx = hullN * terr.nx + hullT * terr.tx;
        const fy = hullN * terr.ny + hullT * terr.ty;
        totalFx += fx;
        totalFy += fy;
        totalTorque += rx * fy - ry * fx;

        if (pen > 0.08 && Math.abs(vt) > 3.5) {
          this.cb.onScrape?.(Math.min(1, Math.abs(vt) / 18));
          if (Math.random() < 0.38) {
            this.cb.onParticle({
              kind: 'spark',
              x: wx,
              y: terr.y + 0.1,
              z: (Math.random() - 0.5) * 0.6,
              vx: -vt * 0.35 + (Math.random() - 0.5) * 3,
              vy: 2 + Math.random() * 4,
              vz: (Math.random() - 0.5) * 2.5,
              size: 0.14,
              life: 0.35,
            });
          }
        }
      }
    }

    if (headTouching) {
      this.headContactTimer += dt;
      if (this.headContactTimer > 0.42 && Math.cos(s.angle) < -0.2 && !s.rollcageIntact) {
        this.triggerCrash('Rollover Crash!');
        return;
      }
    } else {
      this.headContactTimer = Math.max(0, this.headContactTimer - dt * 2);
    }

    // Air control, Aero Wings glide & Stunt / Landing Quality grading
    const airborne = !s.groundedR && !s.groundedF;
    if (airborne) {
      const airInput =
        input.steerPitchAmount !== undefined
          ? Math.max(-1, Math.min(1, input.steerPitchAmount))
          : gas - brake;
      totalTorque += airInput * this.airTorque;
      s.airTime += dt;
      s.airTimeTotal += dt;
      s.airAccumAngle += s.omega * dt;
      s.airRotationDeg = Math.round((s.airAccumAngle * 180) / Math.PI);
      this.minUpDotInAir = Math.min(this.minUpDotInAir, Math.cos(s.angle));

      if (this.equippedParts.has('wings') && s.airTime > 0.1) {
        const gravRatio = this.stage.gravityMult;
        const maxWingsLift = this.mass * this.gravity * 0.54;
        const lift = Math.min(maxWingsLift, Math.max(0, curForwardSpeed * 0.38 * gravRatio));
        totalFy += lift;
        if (s.vy < -2.0) {
          totalFy += Math.min(this.mass * this.gravity * 0.32, -s.vy * 0.55 * gravRatio);
        }
      }
    } else {
      if (wasAirborne && s.airTime > 0.38) {
        const fullFlips = Math.floor(Math.abs(s.airAccumAngle) / TAU + 0.22);
        const airBonus = s.airTime > 0.85 ? Math.floor(s.airTime * 22) : 0;
        const flipBonus = fullFlips * 150;

        const groundAtLanding = sampleTerrain(s.x, this.stage);
        const groundAngle = Math.atan(groundAtLanding.slope);
        const angleDiff = Math.abs(((s.angle - groundAngle + Math.PI) % TAU) - Math.PI);
        const isParallelPerfect = s.airTime > 0.48 && angleDiff < 0.11;
        const isCleanLanding = s.airTime > 0.52 && angleDiff < 0.25;
        const isHardImpact = didBottomOut || impactMaxVy > 8.2 || angleDiff > 0.55;
        const hasLandingBoost = isCleanLanding && this.equippedParts.has('landing_boost');
        const perfectBonus = isParallelPerfect ? 75 : isCleanLanding ? 40 : 0;
        const isCloseCall = fullFlips === 0 && this.minUpDotInAir < -0.52 && angleDiff < 0.58;
        const closeCallBonus = isCloseCall ? 75 : 0;

        let grade: LandingGrade | null = null;
        if (isParallelPerfect) grade = 'PERFECT';
        else if (isCleanLanding) grade = 'CLEAN';
        else if (isHardImpact) grade = 'HARD';
        s.landingGrade = grade;
        this.landingGradeTimer = grade ? 1.35 : 0;

        if (grade === 'HARD') {
          for (let sp = 0; sp < 10; sp++) {
            this.cb.onParticle({
              kind: sp % 2 === 0 ? 'spark' : 'dirt',
              x: s.x + (Math.random() - 0.5) * v.wheelbase,
              y: groundAtLanding.y + 0.12,
              z: (Math.random() - 0.5) * 1.1,
              vx: s.vx * 0.25 + (Math.random() - 0.5) * 6,
              vy: 1.5 + Math.random() * 3.5,
              vz: (Math.random() - 0.5) * 3,
              size: 0.18,
              life: 0.38,
            });
          }
        }

        if (hasLandingBoost) {
          s.vx += Math.cos(groundAngle) * 5.8;
          s.vy += Math.sin(groundAngle) * 2.2;
          this.cb.onTurboSurge?.();
          for (let sp = 0; sp < 8; sp++) {
            this.cb.onParticle({
              kind: 'nitro',
              x: s.x - cs * 1.4,
              y: s.y,
              z: (Math.random() - 0.5) * 0.8,
              vx: s.vx * 0.2 - cs * (6 + Math.random() * 4),
              vy: 1 + Math.random() * 2.5,
              vz: (Math.random() - 0.5) * 2,
              size: 0.24,
              life: 0.35,
            });
          }
        } else if (isParallelPerfect) {
          s.vx += Math.cos(groundAngle) * 2.6;
        } else if (isCleanLanding) {
          s.vx += Math.cos(groundAngle) * 1.4;
        }

        const baseBonus = airBonus + flipBonus + perfectBonus + closeCallBonus;
        if (baseBonus > 0) {
          const isBackflip = s.airAccumAngle > 0;
          const label =
            fullFlips > 0
              ? `${fullFlips > 1 ? fullFlips + 'x ' : ''}${isBackflip ? 'BACKFLIP' : 'FRONTFLIP'}${hasLandingBoost ? ' + BOOST!' : isParallelPerfect ? ' + PERFECT!' : isCleanLanding ? ' + CLEAN!' : '!'}`
              : isCloseCall
                ? 'CLOSE CALL!'
                : hasLandingBoost
                  ? `LANDING BOOST! ${s.airTime.toFixed(1)}s`
                  : isParallelPerfect
                    ? `PERFECT LANDING! ${s.airTime.toFixed(1)}s`
                    : isCleanLanding
                      ? `CLEAN LANDING! ${s.airTime.toFixed(1)}s`
                      : `BIG AIR ${s.airTime.toFixed(1)}s`;
          this.awardComboStunt(label, baseBonus, fullFlips);
        }
        if (impactMaxVy > 2.0 || grade) {
          const intensity = Math.min(1, impactMaxVy / 14);
          s.shakeIntensity = Math.max(s.shakeIntensity, intensity * (grade === 'HARD' ? 0.58 : 0.36));
          this.cb.onLanding(intensity, lastTouchSurface, grade);
        }
      }
      s.airTime = 0;
      s.airAccumAngle = 0;
      s.airRotationDeg = 0;
      this.minUpDotInAir = 1;
    }

    // Wheelie tracking (rear wheel on ground, front wheel lifted for >= 1.2s)
    if (s.groundedR && !s.groundedF && s.vx > 3.5) {
      s.wheelieTime += dt;
      const step = Math.floor(s.wheelieTime / 1.4);
      if (step > this.wheelieRewardStep) {
        this.wheelieRewardStep = step;
        this.awardComboStunt('WHEELIE!', 35, 0);
      }
    } else {
      s.wheelieTime = 0;
      this.wheelieRewardStep = 0;
    }

    s.inWater = false;
    s.waterDepth = 0;

    // Cave Tunnel ceiling clearance check
    const tunnel = getTunnelInfo(s.x, this.stage);
    s.inTunnel = tunnel.active;
    if (tunnel.active) {
      const roofY = s.y + v.headY + 0.35;
      if (roofY > tunnel.ceilingY) {
        const roofPen = roofY - tunnel.ceilingY;
        s.y -= roofPen * 0.85;
        s.vy = Math.min(-1.2, -Math.abs(s.vy) * 0.45);
        s.omega *= 0.4;
        s.shakeIntensity = Math.max(s.shakeIntensity, 0.45);
        for (let sp = 0; sp < 4; sp++) {
          this.cb.onParticle({
            kind: 'spark',
            x: s.x + (Math.random() - 0.5) * 1.1,
            y: tunnel.ceilingY - 0.1,
            z: (Math.random() - 0.5) * 1.0,
            vx: (Math.random() - 0.5) * 5,
            vy: -2 - Math.random() * 3,
            vz: (Math.random() - 0.5) * 2.5,
            size: 0.16,
            life: 0.35,
          });
        }
        if (Math.cos(s.angle) < -0.25 && roofPen > 0.22) {
          this.triggerCrash('Tunnel Ceiling Crash!');
          return;
        }
      }
    }

    // Integrate linear & angular motion
    s.vx += (totalFx / this.mass) * dt;
    s.vy += (totalFy / this.mass) * dt;
    s.vx = Math.max(-45, Math.min(58, s.vx));
    s.vy = Math.max(-45, Math.min(45, s.vy));

    s.omega += (totalTorque / this.inertia) * dt;
    // Anti-pitch shock absorber: prevents single-wheel crest clips from snapping violent cartwheels
    const crestShockDamp =
      (s.groundedR !== s.groundedF) && Math.abs(s.omega) > 1.8 ? 4.4 : 0;
    const angDamp = (airborne ? 0.65 : 2.2 + crestShockDamp) * dt;
    s.omega *= 1 - Math.min(0.45, angDamp);
    s.omega = Math.max(-9, Math.min(9, s.omega));

    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.omega * dt;

    // Prevent driving backwards behind start pad wall
    if (s.x < START_X - 4) {
      s.x = START_X - 4;
      s.vx = Math.max(0, s.vx);
    }

    // Check canyon gorge fall below bridge deck
    const centerGround = sampleTerrain(s.x, this.stage);
    if (centerGround.isBridge && s.y < centerGround.y - 4.8) {
      this.triggerCrash('Fell into Canyon!');
      return;
    }

    // Rotate wheels
    s.rotR += s.spinR * dt;
    s.rotF += s.spinF * dt;

    // Weight transfer / pitch assist when grounded with explicit steerPitchAmount (tilt / analog pitch)
    if (!airborne && input.steerPitchAmount !== undefined && Math.abs(input.steerPitchAmount) > 0.08) {
      totalTorque += input.steerPitchAmount * this.airTorque * 0.28;
    }

    // Tire wear, wheelspin distance, clean line tracking & sector splits
    const wheelSpeed = Math.abs(s.spinR * v.wheelRadius * this.tireScaleBonus);
    const groundSpeed = Math.abs(s.vx * cs + s.vy * sn);
    const slipSpeed = (s.groundedR || s.groundedF) ? Math.max(0, wheelSpeed - groundSpeed) : 0;
    if (slipSpeed > 1.8 && !s.summitCrossed) {
      s.wheelspinDistMeters += slipSpeed * dt * 0.5;
    }
    const baseWear = (0.14 + Math.min(2.2, slipSpeed * 0.24)) * this.tireWearScale * dt;
    if ((s.groundedR || s.groundedF) && groundSpeed > 0.5 && !s.summitCrossed) {
      s.tireHealth = Math.max(15, s.tireHealth - baseWear);
    }

    if (!s.summitCrossed && (s.groundedR || s.groundedF) && s.vx > 0.5) {
      s.totalDriveSamples += 1;
      const upDot = Math.cos(s.angle);
      if (upDot > 0.72 && slipSpeed < 4.5 && !headTouching) {
        s.cleanLineSamples += 1;
      }
    }

    const summitX = getSummitX(this.stage);
    const progressFrac = Math.max(0, (s.x - START_X) / Math.max(1, summitX - START_X));
    if (progressFrac >= 0.33 && s.sectorSplits[0] === 0) {
      s.sectorSplits[0] = Number(s.elapsedTimeSec.toFixed(2));
    }
    if (progressFrac >= 0.66 && s.sectorSplits[1] === 0) {
      s.sectorSplits[1] = Number(s.elapsedTimeSec.toFixed(2));
    }
    if (!s.summitCrossed && s.x >= summitX) {
      s.summitCrossed = true;
      s.sectorSplits[2] = Number(s.elapsedTimeSec.toFixed(2));
      if (s.sectorSplits[0] === 0) s.sectorSplits[0] = Number((s.elapsedTimeSec * 0.33).toFixed(2));
      if (s.sectorSplits[1] === 0) s.sectorSplits[1] = Number((s.elapsedTimeSec * 0.66).toFixed(2));
      this.cb.onSummitCrossed?.();
    }

    // Update speed, RPM, suspension load, whip spring & gear telemetry
    s.suspensionLoadNorm = Math.min(1, Math.max(0, (s.compR + s.compF) / (2 * v.suspensionTravel)));
    const accelX = (s.vx - this.prevVx) / Math.max(0.004, dt);
    this.prevVx = s.vx;
    const targetWhip = Math.min(0.85, Math.max(-0.45, 0.08 + Math.abs(s.vx) * 0.018 + accelX * 0.015 - s.omega * 0.08));
    const whipForce = (targetWhip - s.whipAngle) * 85 - s.whipVel * 7.5;
    s.whipVel += whipForce * dt;
    s.whipAngle = Math.max(-0.55, Math.min(0.95, s.whipAngle + s.whipVel * dt));

    const forwardSpeed = Math.abs(s.vx * cs + s.vy * sn);
    const kmh = Math.round(forwardSpeed * 3.6);
    if (kmh > s.maxSpeedKmh) s.maxSpeedKmh = kmh;

    const gr = this.gearRatio * (s.lowRangeActive ? 0.65 : 1.0);
    const gearThresholds = [0, 9 * gr, 17 * gr, 25 * gr, 33 * gr, 55 * gr];
    let gear = 1;
    for (let g = 1; g <= 5; g++) {
      if (forwardSpeed >= gearThresholds[g - 1]) gear = g;
    }
    if (gear > s.gear && gas > 0) {
      this.cb.onGearShift?.(gear);
      const tailX = s.x - (v.chassisLength * 0.48) * cs;
      const tailY = s.y - (v.chassisLength * 0.48) * sn;
      for (let b = 0; b < 4; b++) {
        this.cb.onParticle({
          kind: 'spark',
          x: tailX,
          y: tailY,
          z: 0.4,
          vx: s.vx * 0.2 - cs * (6 + Math.random() * 4),
          vy: (Math.random() - 0.3) * 2.5,
          vz: (Math.random() - 0.5) * 1.2,
          size: 0.22,
          life: 0.22,
        });
      }
    }
    s.gear = gear;
    const gMin = gearThresholds[gear - 1];
    const gMax = gearThresholds[gear];
    const gearProgress = Math.min(1, Math.max(0, (forwardSpeed - gMin) / Math.max(1, gMax - gMin)));
    const wheelSpinSlip = Math.max(0, Math.abs(s.spinR) * v.wheelRadius - forwardSpeed) * 0.04;
    const targetRpm = Math.min(
      1.0,
      0.16 +
        gearProgress * 0.56 +
        wheelSpinSlip +
        (gas > 0 ? 0.24 : 0) +
        (nitroPressed || s.overchargedActive ? 0.14 : 0),
    );
    s.rpm += (targetRpm - s.rpm) * Math.min(1, dt * 10);

    // Human Driver Torso + Head secondary spring kinematics (G-force lean)
    const targetTorso = -s.throttle * 0.18 + (s.braking ? 0.16 : 0) - s.omega * 0.05;
    const torsoForce = (targetTorso - s.torsoAngle) * 42 - s.torsoVel * 7.5;
    s.torsoVel += torsoForce * dt;
    s.torsoAngle = Math.max(-0.34, Math.min(0.32, s.torsoAngle + s.torsoVel * dt));

    const targetHead = -s.throttle * 0.22 + (s.braking ? 0.18 : 0) - s.omega * 0.1;
    const headForce = (targetHead - s.headAngle) * 58 - s.headVel * 8.2;
    s.headVel += headForce * dt;
    s.headAngle = Math.max(-0.5, Math.min(0.5, s.headAngle + s.headVel * dt));

    // Particle emissions (exhaust, nitro flames, tire dirt/snow/mud roost)
    this.particleAccum += dt;
    const emitInterval = nitroPressed || s.overchargedActive ? 0.018 : 0.045;
    if (this.particleAccum >= emitInterval) {
      this.particleAccum = 0;

      // Exhaust / Nitro plume from rear tailpipe
      if (gas > 0 || nitroPressed || s.overchargedActive) {
        const tailX = s.x - (v.chassisLength * 0.48) * cs - 0.1 * sn;
        const tailY = s.y - (v.chassisLength * 0.48) * sn + 0.1 * cs;
        const isJet = nitroPressed || s.overchargedActive;
        this.cb.onParticle({
          kind: isJet ? 'nitro' : 'smoke',
          x: tailX,
          y: tailY,
          z: 0.42,
          vx: s.vx * 0.25 - cs * (isJet ? 8 : 3) + (Math.random() - 0.5),
          vy: (Math.random() - 0.3) * 1.4,
          vz: (Math.random() - 0.5) * 0.6,
          size: isJet ? 0.34 : 0.26,
          life: isJet ? 0.28 : 0.55,
        });
      }

      // Tire dirt/snow spray when accelerating on ground
      if ((s.groundedR || s.groundedF) && Math.abs(s.throttle) > 0.25) {
        const rearWheel = this.getWheelWorldPosition(false);
        const isSnow = this.stage.id === 'frost_peaks';
        this.cb.onParticle({
          kind: isSnow ? 'snow' : 'dirt',
          x: rearWheel.x - 0.25,
          y: rearWheel.y - v.wheelRadius * 0.75,
          z: (Math.random() > 0.5 ? 1 : -1) * 0.78,
          vx: s.vx * 0.2 - cs * (3.5 + Math.random() * 3.5),
          vy: 1.8 + Math.random() * 2.8,
          vz: (Math.random() - 0.5) * 2.2,
          size: s.surface === 'mud' ? 0.22 + Math.random() * 0.12 : 0.16 + Math.random() * 0.1,
          life: 0.5,
        });
      }
    }

    // Collectibles collision + coin magnet pull
    const slotCenter = Math.floor((s.x - START_X) / 6.5);
    const pickupRadius = this.magnetActive ? 3.8 : 2.15;
    for (let i = Math.max(0, slotCenter - 2); i <= slotCenter + 3; i++) {
      if (this.collectedSlots.has(i)) continue;
      const item: CollectibleSpawn | null = getCollectibleForSlot(i, this.stage);
      if (!item) continue;
      const dx = s.x - item.x;
      const dy = s.y + 0.35 - item.y;
      const dyScale =
        item.kind === 'fuel'
          ? this.stage.id === 'moon'
            ? 0.52
            : 0.78
          : 1.0;
      const dist = Math.hypot(dx, dy * dyScale);
      const effectiveRadius = item.kind === 'coin' ? pickupRadius : 2.45;
      if (dist < effectiveRadius) {
        this.collectedSlots.add(i);
        if (item.kind === 'fuel') {
          s.fuel = 100;
          this.cb.onFuel(item.x, item.y);
        } else {
          s.runCoins += item.value;
          if (this.equippedParts.has('coin_boost')) {
            s.coinBoostTimer = 0.9;
          }
          this.cb.onCoin(item.value, item.x, item.y);
        }
      }
    }

    // Out-of-fuel check when nearly stopped
    if (s.fuel <= 0 && forwardSpeed < 0.75 && !airborne) {
      this.lowSpeedFuelTimer += dt;
      if (this.lowSpeedFuelTimer > 1.2) {
        this.triggerCrash('Out of Fuel!');
      }
    } else {
      this.lowSpeedFuelTimer = 0;
    }
  }

  private triggerCrash(reason: string): void {
    if (this.state.crashed) return;
    this.state.crashed = true;
    this.state.crashReason = reason;
    this.state.hitstopTimer = 0.065; // 65ms tactile hitstop
    this.state.shakeIntensity = 0.85;
    for (let i = 0; i < 18; i++) {
      this.cb.onParticle({
        kind: reason.includes('Fuel') ? 'smoke' : 'spark',
        x: this.state.x + (Math.random() - 0.5) * 1.4,
        y: this.state.y + 0.5 + Math.random() * 0.8,
        z: (Math.random() - 0.5) * 1.2,
        vx: (Math.random() - 0.5) * 9,
        vy: 2 + Math.random() * 7,
        vz: (Math.random() - 0.5) * 6,
        size: 0.22,
        life: 0.65,
      });
    }
    this.cb.onCrash(reason);
  }
}
