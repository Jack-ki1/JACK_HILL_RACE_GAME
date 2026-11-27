import {
  NnEvolutionBonuses,
  NnLiveTelemetry,
  NnTrainingSample,
  NnWeightsBlob,
  StageId,
} from '../types/game';

export const NN_INPUT_SIZE = 12;
export const NN_H1_SIZE = 24;
export const NN_H2_SIZE = 16;
export const NN_OUTPUT_SIZE = 3;

export const NN_INPUT_LABELS = [
  'Slope Near',
  'Slope Mid',
  'Slope Far',
  'Curvature',
  'Pitch Err',
  'Heading Err',
  'Speed',
  'Wheel Slip',
  'Grip',
  'Tire Health',
  'Clearance',
  'Crest Risk',
] as const;

export const NN_OUTPUT_LABELS = ['Steer / Pitch', 'Throttle', 'Brake'] as const;

export const STAGE_IDS: StageId[] = [
  'countryside',
  'red_canyon',
  'frost_peaks',
  'moon',
  'vice_coast',
];

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < lo ? lo : v > hi ? hi : v;
}

function sigmoid(x: number): number {
  const cx = clamp(x, -16, 16);
  return 1 / (1 + Math.exp(-cx));
}

function deterministicRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function createInitialWeights(seed = 20261127): NnWeightsBlob {
  const rng = deterministicRand(seed);
  const xavier = (fanIn: number, fanOut: number) => {
    const bound = Math.sqrt(6 / (fanIn + fanOut));
    return (rng() * 2 - 1) * bound;
  };

  const w1 = Array.from({ length: NN_INPUT_SIZE * NN_H1_SIZE }, () =>
    Number(xavier(NN_INPUT_SIZE, NN_H1_SIZE).toFixed(5)),
  );
  const b1 = new Array<number>(NN_H1_SIZE).fill(0);

  const w2 = Array.from({ length: NN_H1_SIZE * NN_H2_SIZE }, () =>
    Number(xavier(NN_H1_SIZE, NN_H2_SIZE).toFixed(5)),
  );
  const b2 = new Array<number>(NN_H2_SIZE).fill(0);

  const w3 = Array.from({ length: NN_H2_SIZE * NN_OUTPUT_SIZE }, () =>
    Number(xavier(NN_H2_SIZE, NN_OUTPUT_SIZE).toFixed(5)),
  );
  // Prior bias: neutral pitch (0), positive initial throttle (+0.65 -> ~66%), low brake (-0.85 -> ~30%)
  const b3 = [0, 0.65, -0.85];

  return {
    version: 1,
    inputSize: NN_INPUT_SIZE,
    h1Size: NN_H1_SIZE,
    h2Size: NN_H2_SIZE,
    outputSize: NN_OUTPUT_SIZE,
    w1,
    b1,
    w2,
    b2,
    w3,
    b3,
  };
}

export function createDefaultHillMastery(): Record<StageId, number> {
  return {
    countryside: 18,
    red_canyon: 12,
    frost_peaks: 10,
    moon: 8,
    vice_coast: 20,
  };
}

export function computeEvolutionBonuses(
  hillMastery: Record<StageId, number>,
): NnEvolutionBonuses {
  const vals = STAGE_IDS.map((id) => clamp(hillMastery[id] ?? 0, 0, 100));
  const avg = vals.reduce((acc, v) => acc + v, 0) / vals.length;
  const frac = avg / 100;

  return {
    overallMasteryPct: Math.round(avg),
    torqueBonusPct: Math.round(frac * 18),
    suspensionDampingPct: Math.round(frac * 20),
    slipDragReductionPct: Math.round(frac * 25),
    tireWearResistancePct: Math.round(frac * 30),
  };
}

export function forwardPass(
  weights: NnWeightsBlob,
  rawInputs: number[],
): {
  steerPitch: number;
  throttle: number;
  brake: number;
  telemetry: NnLiveTelemetry;
} {
  const inputs = new Array<number>(NN_INPUT_SIZE);
  for (let i = 0; i < NN_INPUT_SIZE; i++) {
    inputs[i] = clamp(rawInputs[i] ?? 0, -2, 2);
  }

  const h1 = new Array<number>(NN_H1_SIZE);
  for (let j = 0; j < NN_H1_SIZE; j++) {
    let sum = weights.b1[j] ?? 0;
    const base = j * NN_INPUT_SIZE;
    for (let i = 0; i < NN_INPUT_SIZE; i++) {
      sum += inputs[i] * (weights.w1[base + i] ?? 0);
    }
    h1[j] = Math.tanh(sum);
  }

  const h2 = new Array<number>(NN_H2_SIZE);
  for (let k = 0; k < NN_H2_SIZE; k++) {
    let sum = weights.b2[k] ?? 0;
    const base = k * NN_H1_SIZE;
    for (let j = 0; j < NN_H1_SIZE; j++) {
      sum += h1[j] * (weights.w2[base + j] ?? 0);
    }
    h2[k] = Math.tanh(sum);
  }

  const z3 = new Array<number>(NN_OUTPUT_SIZE);
  for (let m = 0; m < NN_OUTPUT_SIZE; m++) {
    let sum = weights.b3[m] ?? 0;
    const base = m * NN_H2_SIZE;
    for (let k = 0; k < NN_H2_SIZE; k++) {
      sum += h2[k] * (weights.w3[base + k] ?? 0);
    }
    z3[m] = sum;
  }

  const steerPitch = Math.tanh(z3[0]);
  const throttle = sigmoid(z3[1]);
  const brake = sigmoid(z3[2]);

  return {
    steerPitch,
    throttle,
    brake,
    telemetry: {
      inputs,
      h1,
      h2,
      outputs: { steerPitch, throttle, brake },
      nnAuthority: 0.5,
      modeLabel: 'HYBRID NN POLICY',
    },
  };
}

export function trainBatchSGD(
  weights: NnWeightsBlob,
  samples: NnTrainingSample[],
  learningRate = 0.014,
): { weights: NnWeightsBlob; avgLoss: number } {
  if (samples.length === 0) {
    return { weights, avgLoss: 0 };
  }

  const w1 = [...weights.w1];
  const b1 = [...weights.b1];
  const w2 = [...weights.w2];
  const b2 = [...weights.b2];
  const w3 = [...weights.w3];
  const b3 = [...weights.b3];

  const dw1 = new Float64Array(w1.length);
  const db1 = new Float64Array(b1.length);
  const dw2 = new Float64Array(w2.length);
  const db2 = new Float64Array(b2.length);
  const dw3 = new Float64Array(w3.length);
  const db3 = new Float64Array(b3.length);

  let totalLoss = 0;
  let totalWeight = 0;

  for (let sIdx = 0; sIdx < samples.length; sIdx++) {
    const sample = samples[sIdx];
    const sw = clamp(sample.weight ?? 1, 0.1, 3.0);
    const x = new Array<number>(NN_INPUT_SIZE);
    for (let i = 0; i < NN_INPUT_SIZE; i++) {
      x[i] = clamp(sample.inputs[i] ?? 0, -2, 2);
    }
    const targetSteer = clamp(sample.targets[0] ?? 0, -1, 1);
    const targetThr = clamp(sample.targets[1] ?? 0, 0, 1);
    const targetBrk = clamp(sample.targets[2] ?? 0, 0, 1);

    // Forward pass keeping intermediates
    const h1 = new Array<number>(NN_H1_SIZE);
    for (let j = 0; j < NN_H1_SIZE; j++) {
      let sum = b1[j];
      const base = j * NN_INPUT_SIZE;
      for (let i = 0; i < NN_INPUT_SIZE; i++) {
        sum += x[i] * w1[base + i];
      }
      h1[j] = Math.tanh(sum);
    }

    const h2 = new Array<number>(NN_H2_SIZE);
    for (let k = 0; k < NN_H2_SIZE; k++) {
      let sum = b2[k];
      const base = k * NN_H1_SIZE;
      for (let j = 0; j < NN_H1_SIZE; j++) {
        sum += h1[j] * w2[base + j];
      }
      h2[k] = Math.tanh(sum);
    }

    const z3 = new Array<number>(NN_OUTPUT_SIZE);
    for (let m = 0; m < NN_OUTPUT_SIZE; m++) {
      let sum = b3[m];
      const base = m * NN_H2_SIZE;
      for (let k = 0; k < NN_H2_SIZE; k++) {
        sum += h2[k] * w3[base + k];
      }
      z3[m] = sum;
    }

    const y0 = Math.tanh(z3[0]);
    const y1 = sigmoid(z3[1]);
    const y2 = sigmoid(z3[2]);

    const e0 = y0 - targetSteer;
    const e1 = y1 - targetThr;
    const e2 = y2 - targetBrk;
    const sampleLoss = 0.5 * (e0 * e0 + e1 * e1 + e2 * e2);
    totalLoss += sampleLoss * sw;
    totalWeight += sw;

    // Output layer gradients
    const dz3 = [
      e0 * (1 - y0 * y0) * sw,
      e1 * y1 * (1 - y1) * sw,
      e2 * y2 * (1 - y2) * sw,
    ];

    const dh2 = new Float64Array(NN_H2_SIZE);
    for (let m = 0; m < NN_OUTPUT_SIZE; m++) {
      const g = clamp(dz3[m], -1.5, 1.5);
      db3[m] += g;
      const base = m * NN_H2_SIZE;
      for (let k = 0; k < NN_H2_SIZE; k++) {
        dw3[base + k] += g * h2[k];
        dh2[k] += g * w3[base + k];
      }
    }

    const dh1 = new Float64Array(NN_H1_SIZE);
    for (let k = 0; k < NN_H2_SIZE; k++) {
      const g = clamp(dh2[k] * (1 - h2[k] * h2[k]), -1.5, 1.5);
      db2[k] += g;
      const base = k * NN_H1_SIZE;
      for (let j = 0; j < NN_H1_SIZE; j++) {
        dw2[base + j] += g * h1[j];
        dh1[j] += g * w2[base + j];
      }
    }

    for (let j = 0; j < NN_H1_SIZE; j++) {
      const g = clamp(dh1[j] * (1 - h1[j] * h1[j]), -1.5, 1.5);
      db1[j] += g;
      const base = j * NN_INPUT_SIZE;
      for (let i = 0; i < NN_INPUT_SIZE; i++) {
        dw1[base + i] += g * x[i];
      }
    }
  }

  const invW = 1 / Math.max(0.0001, totalWeight);
  const decay = 0.00015;
  const stepUpdate = (
    arr: number[],
    grads: Float64Array,
    applyDecay: boolean,
  ) => {
    for (let i = 0; i < arr.length; i++) {
      const g = clamp(grads[i] * invW, -1.2, 1.2);
      const next = arr[i] * (applyDecay ? 1 - decay : 1) - learningRate * g;
      arr[i] = Number(clamp(next, -4.5, 4.5).toFixed(6));
    }
  };

  stepUpdate(w1, dw1, true);
  stepUpdate(b1, db1, false);
  stepUpdate(w2, dw2, true);
  stepUpdate(b2, db2, false);
  stepUpdate(w3, dw3, true);
  stepUpdate(b3, db3, false);

  return {
    weights: {
      ...weights,
      w1,
      b1,
      w2,
      b2,
      w3,
      b3,
    },
    avgLoss: Number((totalLoss * invW).toFixed(5)),
  };
}
