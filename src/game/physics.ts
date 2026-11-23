import {
  CollectibleSpawn,
  getCollectibleForSlot,
  getTunnelInfo,
  sampleTerrain,
  TerrainSample,
} from './terrain';
import {
  InputState,
  SaveData,
  StageConfig,
  SurfaceType,
  VehicleConfig,
} from '../types/game';
import { START_X } from './constants';

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
  onLanding: (intensity: number, surface: SurfaceType) => void;
  onGearShift?: (gear: number) => void;
  onCrash: (reason: string) => void;
  onParticle: (p: ParticleBurst) => void;
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
  private collectedSlots = new Set<number>();
  private fuelSaverActive = false;
  private nitroBoosterActive = false;
  private magnetActive = false;
  private hasSnorkel = false;
  private lowSpeedFuelTimer = 0;
  private headContactTimer = 0;
  private particleAccum = 0;
  private wheelieRewardStep = 0;
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

  constructor(
    stage: StageConfig,
    vehicle: VehicleConfig,
    save: SaveData,
    cb: PhysicsCallbacks,
    consumeBoosters = false,
  ) {
    this.stage = stage;
    this.vehicle = vehicle;
    this.save = save;
    this.cb = cb;

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
        ? 1.1
        : v.id === 'monster'
          ? 2.1
          : v.id === 'cheetah_vc'
            ? 1.5
            : v.id === 'donk_leonida'
              ? 1.78
              : 1.65;
    this.engineTorque =
      23.5 * v.powerMult * (1 + 0.08 * u.engine) * t.enginePower * snorkelPowerMult;
    this.topSpeed =
      v.topSpeedMs *
      (1 + 0.045 * u.engine) *
      (0.85 + 0.15 * t.enginePower) *
      snorkelSpeedMult;

    this.springK = 54.0 * v.springMult * (1 + 0.07 * u.suspension) * t.suspensionStiffness;
    this.dampComp = 7.4 * (1 + 0.06 * u.suspension) * t.damping;
    this.dampRebound = 10.6 * (1 + 0.06 * u.suspension) * t.damping;

    this.tireMu = 1.48 * s.gripMult * v.gripMult * (1 + 0.07 * u.tires) * t.tireGrip;
    // Base rear/front drive split enhanced by 4WD upgrade
    const awdBonus = u.awd * 0.045;
    this.awdShare = Math.min(0.95, Math.max(0.15, (1 - t.rearDriveBias) + awdBonus));
    this.airTorque = 6.2 * v.airControlMult * t.airControl;
    this.gravity = BASE_GRAVITY * s.gravityMult * t.gravityScale;

    const fuelUpgrade = 1 + 0.1 * u.fuel;
    this.fuelBurnMult = (this.fuelSaverActive ? 0.52 : 1.0) / fuelUpgrade;
  }

  private createInitialState(): VehiclePhysicsState {
    const x = START_X;
    const ground = sampleTerrain(x, this.stage);
    const wheelR = this.vehicle.wheelRadius;
    const startY = ground.y + this.vehicle.suspensionRest + wheelR - 0.14;
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
    const ly = -v.suspensionRest + comp;
    const cs = Math.cos(s.angle);
    const sn = Math.sin(s.angle);
    return {
      x: s.x + lx * cs - ly * sn,
      y: s.y + lx * sn + ly * cs,
    };
  }

  public step(dt: number, input: InputState): void {
    const s = this.state;
    const v = this.vehicle;

    // Decay screen shake smoothly even during hitstop
    s.shakeIntensity = Math.max(0, s.shakeIntensity - dt * 2.8);

    if (s.hitstopTimer > 0) {
      s.hitstopTimer = Math.max(0, s.hitstopTimer - dt);
      return;
    }

    if (s.crashed) {
      // Let crashed chassis settle briefly
      s.vx *= 1 - Math.min(1, dt * 3);
      s.vy -= this.gravity * dt * 0.6;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      return;
    }

    const gas = input.gas && s.fuel > 0 ? 1 : 0;
    const brake = input.brake ? 1 : 0;
    const nitroPressed = input.nitro && gas > 0 && s.nitroEnergy > 2 && s.fuel > 0;
    s.nitroActive = nitroPressed;
    s.braking = brake > 0 || input.handbrake;

    if (nitroPressed) {
      const drainRate = this.nitroBoosterActive ? 14 : 22;
      s.nitroEnergy = Math.max(0, s.nitroEnergy - drainRate * dt);
    } else {
      const regenRate = this.nitroBoosterActive ? 14 : 9.5;
      s.nitroEnergy = Math.min(100, s.nitroEnergy + regenRate * dt);
    }

    const targetThr = gas - brake * 0.78;
    s.throttle += (targetThr - s.throttle) * Math.min(1, dt * 11);

    // Fuel consumption
    if (s.fuel > 0) {
      const burn = (1.35 + gas * 2.1 + (nitroPressed ? 1.8 : 0)) * this.fuelBurnMult;
      s.fuel = Math.max(0, s.fuel - burn * dt);
    }

    const cs = Math.cos(s.angle);
    const sn = Math.sin(s.angle);

    let totalFx = 0;
    let totalFy = -this.mass * this.gravity;
    let totalTorque = 0;

    // Nitro thrust along chassis forward vector
    if (nitroPressed) {
      const nitroForce = (this.nitroBoosterActive ? 18.5 : 13.5) * v.powerMult;
      totalFx += cs * nitroForce;
      totalFy += sn * nitroForce;
      totalTorque += 0.45 * v.powerMult; // subtle heroic wheelie pull
    }

    const wasAirborne = !s.groundedR && !s.groundedF;
    let impactMaxVy = 0;
    let lastTouchSurface: SurfaceType = 'dirt';

    // Evaluate Rear (0) and Front (1) wheel suspension & tire contact
    const evalWheel = (isFront: boolean): boolean => {
      const lx = isFront ? v.wheelbase * 0.5 : -v.wheelbase * 0.5;
      const wScale = isFront ? v.frontWheelScale : v.rearWheelScale;
      const wRadius = v.wheelRadius * wScale;
      const prevComp = isFront ? s.compF : s.compR;

      // Wheel hub position at current compression
      const ly = -v.suspensionRest + prevComp;
      const rx = lx * cs - ly * sn;
      const ry = lx * sn + ly * cs;
      const wx = s.x + rx;
      const wy = s.y + ry;

      const terr: TerrainSample = sampleTerrain(wx, this.stage);
      // Distance that wheel bottom penetrates terrain along vertical / normal
      const wheelBottomY = wy - wRadius;
      const pen = (terr.y - wheelBottomY) * Math.max(0.35, terr.ny);

      if (pen > 0) {
        // Compute target compression from penetration
        const nextComp = Math.min(v.suspensionTravel, Math.max(0, prevComp + pen * 0.85));
        const velComp = (nextComp - prevComp) / dt;
        const clampedCompVel = Math.max(-12, Math.min(12, velComp));

        // Progressive spring + bump stop + asymmetric hydraulic damper
        const travelFrac = nextComp / v.suspensionTravel;
        const bumpStop = travelFrac > 0.84 ? Math.pow((travelFrac - 0.84) / 0.16, 2) * 32 : 0;
        const dampRate = clampedCompVel >= 0 ? this.dampComp : this.dampRebound;
        let normalForce = this.springK * nextComp + dampRate * clampedCompVel + bumpStop;
        // Additional direct support if suspension is bottomed out
        if (prevComp + pen > v.suspensionTravel) {
          const hardPen = prevComp + pen - v.suspensionTravel;
          normalForce += hardPen * 165;
        }
        normalForce = Math.max(0, Math.min(95, normalForce));

        // Velocity of contact patch
        const vx = s.vx - s.omega * ry;
        const vy = s.vy + s.omega * rx;
        const vn = vx * terr.nx + vy * terr.ny;
        const vt = vx * terr.tx + vy * terr.ty;

        if (vn < -impactMaxVy) {
          impactMaxVy = -vn;
          lastTouchSurface = terr.surface;
        }

        // Drive torque allocation
        const driveBias = isFront ? this.awdShare : 1 - this.awdShare * 0.55;
        const speedRatio = Math.abs(vt) / this.topSpeed;
        const torqueFalloff = s.throttle * vt > 0 ? Math.max(0.08, 1 - Math.pow(speedRatio, 1.8)) : 1.0;

        let driveCmd = s.throttle * this.engineTorque * driveBias * torqueFalloff;
        if (nitroPressed) driveCmd *= 1.32;

        if (input.handbrake) {
          driveCmd = -Math.sign(vt) * Math.min(Math.abs(vt) * 18, 22);
        } else if (gas === 0 && brake === 0) {
          // Gentle engine braking / rolling resistance
          driveCmd -= vt * 0.65;
        } else if (brake > 0 && vt > 1.2) {
          // Strong braking when moving forward
          driveCmd = -brake * 24.0;
        }

        const maxTraction = this.tireMu * terr.muMult * normalForce;
        const tractionForce = Math.max(-maxTraction, Math.min(maxTraction, driveCmd));

        // Update wheel angular spin with realistic tire slip
        const targetSpin =
          input.handbrake
            ? 0
            : vt / wRadius + ((driveCmd - tractionForce) * 0.25) / wRadius;
        const nextSpin = (isFront ? s.spinF : s.spinR) + (targetSpin - (isFront ? s.spinF : s.spinR)) * Math.min(1, dt * 18);

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
        // Spring extends back toward 0 when airborne
        const nextComp = Math.max(0, prevComp - Math.min(prevComp, 2.8 * dt));
        const velComp = (nextComp - prevComp) / dt;
        const freeSpin = s.throttle * (this.topSpeed / wRadius) * 0.9;
        const curSpin = isFront ? s.spinF : s.spinR;
        const nextSpin = curSpin + (freeSpin - curSpin) * Math.min(1, dt * (gas || brake ? 4.5 : 0.8));

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
          if (upDot < -0.32 && (!v.hasRollCage || impactSpeed > 7.5 || this.headContactTimer > 0.18)) {
            this.triggerCrash('Driver Head Impact!');
            return;
          }
        }
        const vx = s.vx - s.omega * ry;
        const vy = s.vy + s.omega * rx;
        const vn = vx * terr.nx + vy * terr.ny;
        const vt = vx * terr.tx + vy * terr.ty;

        const hullN = Math.max(0, Math.min(120, pen * 115 - vn * 14));
        const hullT = Math.max(-hullN * 0.42, Math.min(hullN * 0.42, -vt * 8));

        const fx = hullN * terr.nx + hullT * terr.tx;
        const fy = hullN * terr.ny + hullT * terr.ty;
        totalFx += fx;
        totalFy += fy;
        totalTorque += rx * fy - ry * fx;

        if (pen > 0.08 && Math.abs(vt) > 3.5 && Math.random() < 0.35) {
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

    if (headTouching) {
      this.headContactTimer += dt;
      if (this.headContactTimer > 0.42 && Math.cos(s.angle) < -0.2) {
        this.triggerCrash('Rollover Crash!');
        return;
      }
    } else {
      this.headContactTimer = Math.max(0, this.headContactTimer - dt * 2);
    }

    // Air control & Stunt tracking
    const airborne = !s.groundedR && !s.groundedF;
    if (airborne) {
      const airInput = (input.gas ? 1 : 0) - (input.brake ? 1 : 0);
      totalTorque += airInput * this.airTorque;
      s.airTime += dt;
      s.airTimeTotal += dt;
      s.airAccumAngle += s.omega * dt;
    } else {
      if (wasAirborne && s.airTime > 0.42) {
        const fullFlips = Math.floor(Math.abs(s.airAccumAngle) / TAU + 0.22);
        const airBonus = s.airTime > 0.85 ? Math.floor(s.airTime * 22) : 0;
        const flipBonus = fullFlips * 150;

        const groundAtLanding = sampleTerrain(s.x, this.stage);
        const groundAngle = Math.atan(groundAtLanding.slope);
        const angleDiff = Math.abs(((s.angle - groundAngle + Math.PI) % TAU) - Math.PI);
        const isPerfectLanding = s.airTime > 0.65 && angleDiff < 0.22;
        const perfectBonus = isPerfectLanding ? 60 : 0;

        if (isPerfectLanding) {
          s.vx += Math.cos(groundAngle) * 1.8;
        }

        const totalBonus = airBonus + flipBonus + perfectBonus;
        if (totalBonus > 0) {
          s.runCoins += totalBonus;
          s.flips += fullFlips;
          const isBackflip = s.airAccumAngle > 0;
          const label =
            fullFlips > 0
              ? `${fullFlips > 1 ? fullFlips + 'x ' : ''}${isBackflip ? 'BACKFLIP' : 'FRONTFLIP'}${isPerfectLanding ? ' + CLEAN!' : '!'}`
              : isPerfectLanding
                ? `CLEAN LANDING! ${s.airTime.toFixed(1)}s`
                : `BIG AIR ${s.airTime.toFixed(1)}s`;
          this.cb.onStunt(label, totalBonus, fullFlips);
        }
        if (impactMaxVy > 2.2) {
          const intensity = Math.min(1, impactMaxVy / 14);
          s.shakeIntensity = Math.max(s.shakeIntensity, intensity * 0.42);
          this.cb.onLanding(intensity, lastTouchSurface);
        }
      }
      s.airTime = 0;
      s.airAccumAngle = 0;
    }

    // Wheelie tracking (rear wheel on ground, front wheel lifted for >= 1.2s)
    if (s.groundedR && !s.groundedF && s.vx > 3.5) {
      s.wheelieTime += dt;
      const step = Math.floor(s.wheelieTime / 1.4);
      if (step > this.wheelieRewardStep) {
        this.wheelieRewardStep = step;
        s.runCoins += 35;
        this.cb.onStunt('WHEELIE!', 35, 0);
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
    // Clamp absurd velocity spikes
    s.vx = Math.max(-45, Math.min(55, s.vx));
    s.vy = Math.max(-45, Math.min(45, s.vy));

    s.omega += (totalTorque / this.inertia) * dt;
    // Mild angular damping to prevent runaway spin
    s.omega *= 1 - Math.min(0.4, (airborne ? 0.65 : 2.1) * dt);
    s.omega = Math.max(-10, Math.min(10, s.omega));

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

    // Update speed, RPM & gear telemetry
    const forwardSpeed = Math.abs(s.vx * cs + s.vy * sn);
    const kmh = Math.round(forwardSpeed * 3.6);
    if (kmh > s.maxSpeedKmh) s.maxSpeedKmh = kmh;

    const gearThresholds = [0, 9, 17, 25, 33, 50];
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
    const targetRpm = Math.min(
      1.0,
      0.16 + gearProgress * 0.58 + (gas > 0 ? 0.24 : 0) + (nitroPressed ? 0.14 : 0),
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

    // Particle emissions (exhaust, nitro flames, tire dirt/snow roost)
    this.particleAccum += dt;
    const emitInterval = nitroPressed ? 0.018 : 0.045;
    if (this.particleAccum >= emitInterval) {
      this.particleAccum = 0;

      // Exhaust / Nitro plume from rear tailpipe
      if (gas > 0 || nitroPressed) {
        const tailX = s.x - (v.chassisLength * 0.48) * cs - 0.1 * sn;
        const tailY = s.y - (v.chassisLength * 0.48) * sn + 0.1 * cs;
        this.cb.onParticle({
          kind: nitroPressed ? 'nitro' : 'smoke',
          x: tailX,
          y: tailY,
          z: 0.42,
          vx: s.vx * 0.25 - cs * (nitroPressed ? 8 : 3) + (Math.random() - 0.5),
          vy: (Math.random() - 0.3) * 1.4,
          vz: (Math.random() - 0.5) * 0.6,
          size: nitroPressed ? 0.34 : 0.26,
          life: nitroPressed ? 0.28 : 0.55,
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
          size: 0.16 + Math.random() * 0.1,
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
      const dist = Math.hypot(s.x - item.x, s.y + 0.35 - item.y);
      const effectiveRadius = item.kind === 'coin' ? pickupRadius : 2.1;
      if (dist < effectiveRadius) {
        this.collectedSlots.add(i);
        if (item.kind === 'fuel') {
          s.fuel = 100;
          this.cb.onFuel(item.x, item.y);
        } else {
          s.runCoins += item.value;
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
