import {
  InputState,
  NnLiveTelemetry,
  NnTrainingSample,
  NnWeightsBlob,
  StageConfig,
  TuningPartId,
  VehicleConfig,
} from '../types/game';
import { createInitialWeights, forwardPass } from '../shared/nnCore';
import { VehiclePhysicsState } from './physics';
import { getTunnelInfo, sampleLookaheadProfile, sampleTerrain } from './terrain';

const TAU = Math.PI * 2;
let cachedDefaultWeights: NnWeightsBlob | null = null;

function getFallbackWeights(): NnWeightsBlob {
  if (!cachedDefaultWeights) {
    cachedDefaultWeights = createInitialWeights();
  }
  return cachedDefaultWeights;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function wrapAngle(rad: number): number {
  let a = (rad + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

/**
 * Extracts the 12 normalized hill-climbing state features matching NN_INPUT_LABELS:
 * [0] Slope Near, [1] Slope Mid, [2] Slope Far, [3] Curvature,
 * [4] Pitch Err, [5] Heading Err, [6] Speed, [7] Wheel Slip,
 * [8] Surface Grip, [9] Tire Health, [10] Clearance / Tunnel, [11] Crest Risk
 */
export function extractNnFeatures(
  state: VehiclePhysicsState,
  vehicle: VehicleConfig,
  stage: StageConfig,
): number[] {
  const speedForward = Math.max(8, Math.abs(state.vx));
  const stepMeters = Math.max(2.6, Math.min(5.2, speedForward * 0.145));
  const profile = sampleLookaheadProfile(state.x, 6, stepMeters, stage);
  const near = profile[0];
  const mid = profile[2] ?? near;
  const far = profile[4] ?? mid;

  const terr = sampleTerrain(state.x, stage);
  const groundPitch = Math.atan(terr.slope);
  const targetPitch = Math.atan(near.slope);
  const pitchErr = wrapAngle(targetPitch - state.angle);
  const headingErr = wrapAngle(groundPitch - state.angle);

  const forwardSpeed = state.vx * Math.cos(state.angle) + state.vy * Math.sin(state.angle);
  const wheelSpeed = Math.abs(state.spinR * vehicle.wheelRadius * state.tireRadiusScale);
  const slip = Math.max(0, wheelSpeed - Math.abs(forwardSpeed));

  const tunnel = getTunnelInfo(state.x, stage);
  const aheadTunnel = getTunnelInfo(state.x + 12, stage);
  const clearanceNorm = tunnel.active
    ? clamp((tunnel.ceilingY - (state.y + vehicle.headY + 0.35)) / 4.0, -1, 1)
    : aheadTunnel.active
      ? 0.25
      : 1.0;

  const crestDrop = Math.max(0, near.slope - far.slope);
  const crestRisk = clamp((crestDrop * 1.4) * clamp(Math.abs(state.vx) / 28, 0.1, 1.3), 0, 1.5);
  const curvature = clamp(mid.slope - near.slope, -1.5, 1.5);

  return [
    clamp(near.slope, -1.5, 1.5),
    clamp(mid.slope, -1.5, 1.5),
    clamp(far.slope, -1.5, 1.5),
    curvature,
    clamp(pitchErr / 1.2, -1.5, 1.5),
    clamp(headingErr / 1.2, -1.5, 1.5),
    clamp(forwardSpeed / Math.max(12, vehicle.topSpeedMs), -1, 1.5),
    clamp(slip / 14, 0, 1.5),
    clamp(terr.muMult * stage.gripMult, 0.2, 1.5),
    clamp(state.tireHealth / 100, 0, 1),
    clearanceNorm,
    crestRisk,
  ];
}

/**
 * Lookahead safety & physics guardrail controller used both as fallback
 * and safety supervisor blended with the trained Neural Network policy.
 */
function computeLookaheadGuardrail(
  state: VehiclePhysicsState,
  vehicle: VehicleConfig,
  stage: StageConfig,
  equippedParts: TuningPartId[] = [],
  targetSpeedScale = 1.0,
): {
  gas: boolean;
  brake: boolean;
  nitro: boolean;
  jump: boolean;
  throttleAmount: number;
  brakeAmount: number;
  steerPitchAmount: number;
  guardrailReason: string;
} {
  const speedForward = Math.max(8, Math.abs(state.vx));
  const stepMeters = Math.max(2.6, Math.min(5.2, speedForward * 0.145));
  const profile = sampleLookaheadProfile(state.x, 8, stepMeters, stage);
  const near = profile[0];
  const mid = profile[1] ?? near;
  const far = profile[3] ?? mid;

  const airborne = !state.groundedR && !state.groundedF;
  const topTargetMs = vehicle.topSpeedMs * targetSpeedScale;
  const maxAheadSlope = Math.max(near.slope, mid.slope, far.slope);
  const hasJumpShocks = equippedParts.includes('jump_shocks');
  const normAngle = wrapAngle(state.angle);

  const inTunnel = getTunnelInfo(state.x, stage).active;
  const nearTunnel =
    inTunnel ||
    getTunnelInfo(state.x + 10, stage).active ||
    getTunnelInfo(state.x + 22, stage).active;

  if (airborne) {
    const gEff = Math.max(3.5, 15.8 * stage.gravityMult);
    const estAirSec = Math.max(
      0.16,
      (state.vy + Math.sqrt(Math.max(0, state.vy * state.vy + 2 * gEff * 2.4))) / gEff,
    );
    const predDist = Math.max(stepMeters, state.vx * estAirSec * 0.85);
    const landingIdx = Math.min(
      profile.length - 1,
      Math.max(0, Math.round(predDist / stepMeters) - 1),
    );
    const landingSlope = profile[landingIdx]?.slope ?? near.slope;

    const targetPitch = Math.atan(landingSlope) * (nearTunnel ? 0.55 : 0.88);
    const pitchErr = wrapAngle(targetPitch - state.angle);
    const kp = Math.cos(state.angle) < 0.35 ? 2.25 : 1.85;
    const kd = Math.cos(state.angle) < 0.35 ? 0.46 : 0.41;
    const pitchCmd = clamp(pitchErr * kp - state.omega * kd, -1, 1);

    const wantGas = pitchCmd > 0.11;
    const wantBrake = pitchCmd < -0.11;
    const useNitro =
      wantGas &&
      !nearTunnel &&
      state.nitroEnergy > 38 &&
      state.vy < -3.5 &&
      Math.cos(state.angle) > 0.76;

    return {
      gas: wantGas,
      brake: wantBrake,
      nitro: useNitro,
      jump: false,
      throttleAmount: wantGas ? clamp(pitchCmd, 0.35, 1) : 0,
      brakeAmount: wantBrake ? clamp(-pitchCmd, 0.35, 1) : 0,
      steerPitchAmount: pitchCmd,
      guardrailReason: 'AIR STABILIZE',
    };
  }

  const wheelieLimit = vehicle.hasRollCage ? 0.84 : 0.68;
  if (normAngle > wheelieLimit || (normAngle > 0.5 && state.omega > 0.45)) {
    return {
      gas: false,
      brake: true,
      nitro: false,
      jump: false,
      throttleAmount: 0,
      brakeAmount: 0.9,
      steerPitchAmount: -0.9,
      guardrailReason: 'ANTI-LOOPOUT',
    };
  }

  if (normAngle < -0.78 && state.omega < -0.35) {
    return {
      gas: true,
      brake: false,
      nitro: false,
      jump: false,
      throttleAmount: 0.85,
      brakeAmount: 0,
      steerPitchAmount: 0.85,
      guardrailReason: 'NOSE RECOVERY',
    };
  }

  let wantJump = false;
  if (hasJumpShocks && !nearTunnel && state.groundedR && state.groundedF) {
    const crestLaunch = near.slope > 0.25 && far.slope < 0.04 && state.vx > 10.5;
    const mudHurdle =
      (near.surface === 'mud' || mid.surface === 'mud') &&
      state.vx > 8.5 &&
      Math.cos(normAngle) > 0.86;
    wantJump = crestLaunch || mudHurdle;
  }

  const inHeavyBog =
    state.surface === 'mud' || state.surface === 'sand' || near.surface === 'mud';
  const steepUp = maxAheadSlope > 0.32 || near.slope > 0.26;
  const steepDown = near.slope < -0.44 && state.vx > topTargetMs * 0.78;
  const crestDropoff =
    !vehicle.hasRollCage &&
    near.slope > 0.14 &&
    (mid.slope < -0.22 || far.slope < -0.34) &&
    state.vx > Math.min(topTargetMs * 0.82, 34);
  const tunnelSpeedCap = nearTunnel && state.vx > Math.min(topTargetMs * 0.86, 33);

  let throttleAmount = 0.96;
  let brakeAmount = 0;
  let reason = 'CLIMB DRIVE';

  if (tunnelSpeedCap) {
    throttleAmount = 0;
    brakeAmount = state.vx > 36 ? 0.65 : 0;
    reason = 'TUNNEL CLEARANCE';
  } else if (crestDropoff) {
    throttleAmount = 0.18;
    brakeAmount = state.vx > 40 ? 0.55 : 0;
    reason = 'CREST MODULATION';
  } else if (steepDown) {
    throttleAmount = 0.15;
    brakeAmount = state.vx > topTargetMs ? 0.65 : 0;
    reason = 'DESCENT CONTROL';
  } else if (state.vx > topTargetMs * 1.04 && !steepUp && !inHeavyBog) {
    throttleAmount = 0.25;
    reason = 'PACE CAP';
  } else if (normAngle > 0.45 && state.omega > 0.24) {
    throttleAmount = 0.2;
    reason = 'TRACTION FEATHER';
  } else if (steepUp && (state.surface === 'ice' || state.surface === 'mud')) {
    // Modulate throttle slightly on loose/icy steep ascents to preserve bite
    throttleAmount = 0.84;
    reason = 'TRACTION CLIMB';
  }

  const wantNitro =
    throttleAmount > 0.5 &&
    !nearTunnel &&
    !crestDropoff &&
    state.nitroEnergy > 24 &&
    ((steepUp && state.vx < topTargetMs * 0.72) ||
      (inHeavyBog && state.vx < topTargetMs * 0.65) ||
      (state.vx < 7.5 && near.slope > 0.16));

  return {
    gas: throttleAmount > 0.12,
    brake: brakeAmount > 0.12,
    nitro: wantNitro,
    jump: wantJump,
    throttleAmount,
    brakeAmount,
    steerPitchAmount: clamp((throttleAmount - brakeAmount) * 0.6, -1, 1),
    guardrailReason: reason,
  };
}

/**
 * Hybrid Neural Network + Lookahead Safety Guardrail Controller.
 * Blends the live MLP forward pass with ballistic & anti-loopout guardrails
 * based on the hill's learned mastery percentage.
 */
export function computeHybridNnControl(
  state: VehiclePhysicsState,
  vehicle: VehicleConfig,
  stage: StageConfig,
  weights: NnWeightsBlob | null,
  hillMasteryPct: number,
  equippedParts: TuningPartId[] = [],
  targetSpeedScale = 1.0,
): { input: InputState; telemetry: NnLiveTelemetry } {
  const activeWeights = weights ?? getFallbackWeights();
  const features = extractNnFeatures(state, vehicle, stage);
  const nnResult = forwardPass(activeWeights, features);

  if (state.crashed || state.fuel <= 0) {
    return {
      input: {
        gas: false,
        brake: false,
        nitro: false,
        handbrake: false,
        jump: false,
        throttleAmount: 0,
        brakeAmount: 0,
        steerPitchAmount: 0,
      },
      telemetry: {
        ...nnResult.telemetry,
        nnAuthority: 0,
        modeLabel: state.crashed ? 'CRASHED' : 'OUT OF FUEL',
      },
    };
  }

  const guard = computeLookaheadGuardrail(
    state,
    vehicle,
    stage,
    equippedParts,
    targetSpeedScale,
  );

  // Critical safety override when near rollover or severe nose-dive
  const normAngle = wrapAngle(state.angle);
  const emergencyOverride =
    (!state.groundedR && !state.groundedF && Math.cos(state.angle) < 0.25) ||
    normAngle > (vehicle.hasRollCage ? 0.8 : 0.65) ||
    normAngle < -0.75;

  const alpha = emergencyOverride
    ? 0.15
    : clamp(0.25 + (hillMasteryPct / 100) * 0.65, 0.25, 0.9);

  // Scale throttle softly by targetSpeedScale when acting as rival difficulty
  const nnThr = clamp(nnResult.throttle * clamp(targetSpeedScale, 0.72, 1.08), 0, 1);
  const nnBrk = clamp(nnResult.brake, 0, 1);
  const nnPitch = clamp(nnResult.steerPitch, -1, 1);

  let finalThr = clamp(alpha * nnThr + (1 - alpha) * guard.throttleAmount, 0, 1);
  let finalBrk = clamp(alpha * nnBrk + (1 - alpha) * guard.brakeAmount, 0, 1);
  const finalPitch = clamp(alpha * nnPitch + (1 - alpha) * guard.steerPitchAmount, -1, 1);

  // Prevent simultaneous heavy gas + brake deadlock while climbing
  if (finalThr > 0.35 && finalBrk > 0.35) {
    if (guard.brakeAmount > 0.4) {
      finalThr = 0;
    } else {
      finalBrk *= 0.25;
    }
  }
  // Ensure forward drive when nearly stopped on climb start
  if (Math.abs(state.vx) < 1.2 && guard.throttleAmount > 0.4) {
    finalThr = Math.max(finalThr, 0.75);
    finalBrk = 0;
  }

  const input: InputState = {
    gas: finalThr > 0.14,
    brake: finalBrk > 0.2,
    nitro: guard.nitro,
    handbrake: false,
    jump: guard.jump,
    lowRange:
      state.hasLowRange &&
      (features[0] > 0.38 || state.surface === 'mud' || state.surface === 'rock') &&
      Math.abs(state.vx) < 12,
    throttleAmount: finalThr,
    brakeAmount: finalBrk,
    steerPitchAmount: finalPitch,
  };

  return {
    input,
    telemetry: {
      ...nnResult.telemetry,
      outputs: {
        steerPitch: finalPitch,
        throttle: finalThr,
        brake: finalBrk,
      },
      nnAuthority: Number(alpha.toFixed(2)),
      modeLabel: emergencyOverride ? `SAFETY · ${guard.guardrailReason}` : `NN ${Math.round(alpha * 100)}% · ${guard.guardrailReason}`,
    },
  };
}

/**
 * Captures clean unassisted human driving samples to stream to the backend NN trainer.
 */
export function captureHumanClimbSample(
  state: VehiclePhysicsState,
  input: InputState,
  vehicle: VehicleConfig,
  stage: StageConfig,
): NnTrainingSample | null {
  if (state.crashed || state.fuel <= 0) return null;
  if (state.vx < 2.0) return null;
  if (Math.cos(state.angle) < 0.45) return null;

  const thr =
    input.throttleAmount !== undefined
      ? clamp(input.throttleAmount, 0, 1)
      : input.gas
        ? 1
        : 0;
  const brk =
    input.brakeAmount !== undefined
      ? clamp(input.brakeAmount, 0, 1)
      : input.brake
        ? 1
        : 0;
  const pitch =
    input.steerPitchAmount !== undefined
      ? clamp(input.steerPitchAmount, -1, 1)
      : clamp(thr - brk, -1, 1);

  if (thr < 0.05 && brk < 0.05 && Math.abs(pitch) < 0.05) {
    return null;
  }

  const inputs = extractNnFeatures(state, vehicle, stage);
  const weight = state.slopeDeg > 14 ? 1.45 : 1.0;

  return {
    inputs,
    targets: [
      Number(pitch.toFixed(4)),
      Number(thr.toFixed(4)),
      Number(brk.toFixed(4)),
    ],
    weight,
  };
}

export function computeAiDriverControl(
  state: VehiclePhysicsState,
  vehicle: VehicleConfig,
  stage: StageConfig,
  equippedParts: TuningPartId[] = [],
  targetSpeedScale = 1.0,
): InputState {
  return computeHybridNnControl(
    state,
    vehicle,
    stage,
    null,
    30,
    equippedParts,
    targetSpeedScale,
  ).input;
}
