import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import {
  computeEvolutionBonuses,
  createDefaultHillMastery,
  createInitialWeights,
  NN_H1_SIZE,
  NN_H2_SIZE,
  NN_INPUT_SIZE,
  NN_OUTPUT_SIZE,
  STAGE_IDS,
  trainBatchSGD,
} from './src/shared/nnCore.ts';
import type {
  ClimbDifficulty,
  NnServerState,
  NnTrainingSample,
  StageId,
} from './src/types/game.ts';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const WEIGHTS_FILE = path.resolve(DATA_DIR, 'nn-weights.json');

function isValidStageId(val: unknown): val is StageId {
  return typeof val === 'string' && (STAGE_IDS as string[]).includes(val);
}

function clamp(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function createFreshState(): NnServerState {
  const hillMastery = createDefaultHillMastery();
  return {
    weights: createInitialWeights(),
    trainingSteps: 0,
    samplesCaptured: 0,
    summitsCompleted: 0,
    recentLoss: 0.145,
    lossHistory: [0.22, 0.19, 0.165, 0.145],
    hillMastery,
    evolutionBonuses: computeEvolutionBonuses(hillMastery),
    updatedAt: new Date().toISOString(),
  };
}

function validateWeightsBlob(raw: unknown) {
  const base = createInitialWeights();
  if (!raw || typeof raw !== 'object') return base;
  const obj = raw as Record<string, unknown>;
  const checkArr = (arr: unknown, expectedLen: number, fallback: number[]) => {
    if (!Array.isArray(arr) || arr.length !== expectedLen) return fallback;
    const out = new Array<number>(expectedLen);
    for (let i = 0; i < expectedLen; i++) {
      const n = Number(arr[i]);
      out[i] = Number.isFinite(n) ? clamp(n, -4.5, 4.5) : fallback[i];
    }
    return out;
  };
  return {
    version: 1,
    inputSize: NN_INPUT_SIZE,
    h1Size: NN_H1_SIZE,
    h2Size: NN_H2_SIZE,
    outputSize: NN_OUTPUT_SIZE,
    w1: checkArr(obj.w1, NN_INPUT_SIZE * NN_H1_SIZE, base.w1),
    b1: checkArr(obj.b1, NN_H1_SIZE, base.b1),
    w2: checkArr(obj.w2, NN_H1_SIZE * NN_H2_SIZE, base.w2),
    b2: checkArr(obj.b2, NN_H2_SIZE, base.b2),
    w3: checkArr(obj.w3, NN_H2_SIZE * NN_OUTPUT_SIZE, base.w3),
    b3: checkArr(obj.b3, NN_OUTPUT_SIZE, base.b3),
  };
}

function loadStateFromDisk(): NnServerState {
  try {
    if (!fs.existsSync(WEIGHTS_FILE)) {
      const fresh = createFreshState();
      persistStateToDisk(fresh);
      return fresh;
    }
    const rawText = fs.readFileSync(WEIGHTS_FILE, 'utf-8');
    const parsed = JSON.parse(rawText) as Partial<NnServerState>;
    const baseMastery = createDefaultHillMastery();
    const mastery: Record<StageId, number> = { ...baseMastery };
    if (parsed.hillMastery && typeof parsed.hillMastery === 'object') {
      for (const sid of STAGE_IDS) {
        const val = Number((parsed.hillMastery as Record<string, unknown>)[sid]);
        if (Number.isFinite(val)) {
          mastery[sid] = Math.round(clamp(val, 0, 100) * 10) / 10;
        }
      }
    }
    const lossHistory = Array.isArray(parsed.lossHistory)
      ? parsed.lossHistory
          .slice(-24)
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x >= 0 && x <= 10)
      : [0.145];

    return {
      weights: validateWeightsBlob(parsed.weights),
      trainingSteps: Math.max(0, Math.floor(Number(parsed.trainingSteps) || 0)),
      samplesCaptured: Math.max(0, Math.floor(Number(parsed.samplesCaptured) || 0)),
      summitsCompleted: Math.max(0, Math.floor(Number(parsed.summitsCompleted) || 0)),
      recentLoss: clamp(Number(parsed.recentLoss ?? lossHistory[lossHistory.length - 1] ?? 0.145), 0, 10),
      lossHistory: lossHistory.length > 0 ? lossHistory : [0.145],
      hillMastery: mastery,
      evolutionBonuses: computeEvolutionBonuses(mastery),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
    };
  } catch {
    return createFreshState();
  }
}

function persistStateToDisk(state: NnServerState): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = `${WEIGHTS_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  fs.renameSync(tmpFile, WEIGHTS_FILE);
}

let nnState: NnServerState = loadStateFromDisk();

async function bootstrapServer() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  app.get('/api/nn/state', (_req: Request, res: Response) => {
    res.json(nnState);
  });

  app.post('/api/nn/train', (req: Request, res: Response) => {
    const body = req.body as { stageId?: unknown; samples?: unknown } | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }
    const stageId: StageId = isValidStageId(body.stageId) ? body.stageId : 'countryside';
    if (!Array.isArray(body.samples) || body.samples.length === 0) {
      res.status(400).json({ error: 'Samples array must be non-empty' });
      return;
    }

    const sanitized: NnTrainingSample[] = [];
    const capped = body.samples.slice(0, 128);
    for (const raw of capped) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as { inputs?: unknown; targets?: unknown; weight?: unknown };
      if (!Array.isArray(obj.inputs) || obj.inputs.length !== NN_INPUT_SIZE) continue;
      if (!Array.isArray(obj.targets) || obj.targets.length !== NN_OUTPUT_SIZE) continue;
      const inputs = obj.inputs.map((v) => clamp(Number(v), -2, 2));
      const targets: [number, number, number] = [
        clamp(Number(obj.targets[0]), -1, 1),
        clamp(Number(obj.targets[1]), 0, 1),
        clamp(Number(obj.targets[2]), 0, 1),
      ];
      const weight = clamp(Number(obj.weight ?? 1), 0.1, 3.0);
      sanitized.push({ inputs, targets, weight });
    }

    if (sanitized.length === 0) {
      res.status(400).json({ error: 'No valid NN training samples supplied' });
      return;
    }

    const { weights, avgLoss } = trainBatchSGD(nnState.weights, sanitized, 0.015);
    const nextMastery = {
      ...nnState.hillMastery,
      [stageId]: Math.min(
        100,
        Math.round((nnState.hillMastery[stageId] + Math.min(1.4, sanitized.length * 0.035)) * 10) / 10,
      ),
    };
    const nextHistory = [...nnState.lossHistory.slice(-23), avgLoss];

    nnState = {
      weights,
      trainingSteps: nnState.trainingSteps + 1,
      samplesCaptured: nnState.samplesCaptured + sanitized.length,
      summitsCompleted: nnState.summitsCompleted,
      recentLoss: avgLoss,
      lossHistory: nextHistory,
      hillMastery: nextMastery,
      evolutionBonuses: computeEvolutionBonuses(nextMastery),
      updatedAt: new Date().toISOString(),
    };
    persistStateToDisk(nnState);
    res.json(nnState);
  });

  app.post('/api/nn/summit', (req: Request, res: Response) => {
    const body = req.body as {
      stageId?: unknown;
      climbTimeSec?: unknown;
      cleanLinePct?: unknown;
      difficulty?: unknown;
      completed?: unknown;
    };
    if (!body || !isValidStageId(body.stageId)) {
      res.status(400).json({ error: 'Valid stageId required' });
      return;
    }
    const stageId = body.stageId;
    const cleanLinePct = clamp(Number(body.cleanLinePct ?? 65), 0, 100);
    const completed = Boolean(body.completed);
    const diff: ClimbDifficulty =
      body.difficulty === 'rookie' || body.difficulty === 'extreme' ? body.difficulty : 'pro';

    const masteryBefore = nnState.hillMastery[stageId] ?? 0;
    const diffMult = diff === 'extreme' ? 1.4 : diff === 'pro' ? 1.15 : 0.9;
    const gain = completed
      ? (6.5 + (cleanLinePct / 100) * 6.5) * diffMult
      : 1.5 * diffMult;
    const masteryAfter = Math.min(100, Math.round((masteryBefore + gain) * 10) / 10);

    const nextMastery = {
      ...nnState.hillMastery,
      [stageId]: masteryAfter,
    };

    nnState = {
      ...nnState,
      summitsCompleted: nnState.summitsCompleted + (completed ? 1 : 0),
      hillMastery: nextMastery,
      evolutionBonuses: computeEvolutionBonuses(nextMastery),
      updatedAt: new Date().toISOString(),
    };
    persistStateToDisk(nnState);
    res.json({
      state: nnState,
      masteryBefore,
      masteryAfter,
    });
  });

  app.post('/api/nn/reset', (_req: Request, res: Response) => {
    nnState = createFreshState();
    persistStateToDisk(nnState);
    res.json(nnState);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Jack Hill Crawl server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrapServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
