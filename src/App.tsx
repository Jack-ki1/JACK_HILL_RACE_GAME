import { useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { GameOverModal, PauseModal } from './components/PauseAndGameOverModal';
import { GameplayHud, GameplayHudHandle } from './components/GameplayHud';
import { GarageModal } from './components/GarageModal';
import { MissionsModal } from './components/MissionsModal';
import { FirstRunTutorialOverlay } from './components/OnboardingAndOrientation';
import { PaddockModal } from './components/PaddockModal';
import { SettingsModal } from './components/SettingsModal';
import { ShopActionResult, ShopModal } from './components/ShopModal';
import { SummitModal } from './components/SummitModal';
import { TitleOverlay } from './components/TitleOverlay';
import { TuningModal } from './components/TuningModal';
import { UpgradesModal } from './components/UpgradesModal';
import { WorldMapModal } from './components/WorldMapModal';
import { SoundEngine } from './game/audio';
import {
  ACCESSORY_DEFS,
  getStageById,
  getUpgradeCost,
  getVehicleById,
  MAX_EQUIPPED_PARTS,
  MAX_TICKETS,
  MAX_UPGRADE_LEVEL,
  START_X,
  TUNING_PART_DEFS,
  WHEEL_STYLES,
} from './game/constants';
import { HillClimbPhysics } from './game/physics';
import {
  isStageUnlocked,
  loadSaveData,
  persistSaveData,
  refreshDailyChallenge,
  regenTickets,
  resetSaveData,
} from './game/storage';
import { interpolateGhostSample, WorldSceneController } from './game/worldScene';
import {
  computeEvolutionBonuses,
  createDefaultHillMastery,
  createInitialWeights,
} from './shared/nnCore';
import {
  CameraMode,
  ClimbSetupConfig,
  ClimbTireId,
  GameScreen,
  GameSettings,
  InputState,
  LiveryId,
  MedalTier,
  NeonColorId,
  NnServerState,
  NnTrainingSample,
  RunSummary,
  SaveData,
  StageId,
  StuntCallout,
  SummitAnalytics,
  TuningConfig,
  TuningPartId,
  UpgradeKey,
  VehicleAccessoryId,
  VehicleId,
  WheelStyleId,
} from './types/game';

function createFallbackNnState(): NnServerState {
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

export default function App() {
  const worldMountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WorldSceneController | null>(null);
  const hudRef = useRef<GameplayHudHandle>(null);
  const soundRef = useRef<SoundEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [returnScreen, setReturnScreen] = useState<
    'TITLE_MENU' | 'PADDOCK' | 'PAUSED' | 'GAME_OVER' | 'SUMMIT'
  >('TITLE_MENU');
  const [missionsTab, setMissionsTab] = useState<'MISSIONS' | 'SEASON'>('MISSIONS');
  const [garageInitialVehicle, setGarageInitialVehicle] = useState<VehicleId | undefined>(undefined);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [summitAnalytics, setSummitAnalytics] = useState<SummitAnalytics | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [gamepadActive, setGamepadActive] = useState(false);
  const [touchDetected, setTouchDetected] = useState(false);
  const [aiAutoPilot, setAiAutoPilot] = useState(false);
  const [watchAiMode, setWatchAiMode] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');

  const [nnState, setNnState] = useState<NnServerState>(() => createFallbackNnState());
  const [nnBusy, setNnBusy] = useState(false);
  const [pendingSamplesCount, setPendingSamplesCount] = useState(0);

  const saveRef = useRef(save);
  const screenRef = useRef(screen);
  const aiAutoPilotRef = useRef(aiAutoPilot);
  const watchAiModeRef = useRef(watchAiMode);
  const cameraModeRef = useRef(cameraMode);
  const nnStateRef = useRef(nnState);
  const pendingSamplesRef = useRef<NnTrainingSample[]>([]);
  const nnFlushInFlightRef = useRef(false);
  const stuntRef = useRef<StuntCallout | null>(null);
  const stuntSeqRef = useRef(1);
  const crashTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    saveRef.current = save;
    persistSaveData(save);
    soundRef.current?.setMuted(save.muted);
    soundRef.current?.setVolumes(save.settings.masterVolume, save.settings.sfxVolume);
    worldRef.current?.applyGraphicsQuality(save.settings.graphicsQuality);
    worldRef.current?.setCameraShakeMode(save.settings.cameraShake);
    worldRef.current?.setShowGhost(save.settings.showGhost);
    worldRef.current?.setRivalMode(save.settings.rivalMode);
  }, [save]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  useEffect(() => {
    aiAutoPilotRef.current = aiAutoPilot;
  }, [aiAutoPilot]);

  useEffect(() => {
    watchAiModeRef.current = watchAiMode;
  }, [watchAiMode]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    nnStateRef.current = nnState;
    worldRef.current?.setNnConfig(
      nnState.weights,
      nnState.hillMastery,
      nnState.evolutionBonuses,
      saveRef.current.aiAutoTune,
    );
  }, [nnState, save.aiAutoTune]);

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => updater(prev));
  }, []);

  // Hydrate persistent Neural Network weights & hill mastery from backend API
  useEffect(() => {
    let active = true;
    fetch('/api/nn/state')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: NnServerState | null) => {
        if (active && data && data.weights && data.hillMastery) {
          setNnState(data);
        }
      })
      .catch(() => {
        // Offline / fallback keeps local initial NN state active
      });
    return () => {
      active = false;
    };
  }, []);

  const flushTrainingSamples = useCallback(async (forceManual = false) => {
    if (nnFlushInFlightRef.current) return;
    if (pendingSamplesRef.current.length === 0) return;

    nnFlushInFlightRef.current = true;
    if (forceManual) setNnBusy(true);
    const batchSize = Math.min(64, pendingSamplesRef.current.length);
    const batch = pendingSamplesRef.current.slice(0, batchSize);
    pendingSamplesRef.current = pendingSamplesRef.current.slice(batchSize);
    setPendingSamplesCount(pendingSamplesRef.current.length);

    try {
      const res = await fetch('/api/nn/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageId: saveRef.current.selectedStage,
          samples: batch,
        }),
      });
      if (res.ok) {
        const nextState = (await res.json()) as NnServerState;
        if (nextState && nextState.weights) {
          setNnState(nextState);
        }
      }
    } catch {
      // Ignore transient network errors so driving never stutters
    } finally {
      nnFlushInFlightRef.current = false;
      if (forceManual) setNnBusy(false);
    }
  }, []);

  const handleResetNn = useCallback(async () => {
    if (nnBusy) return;
    soundRef.current?.playClick();
    setNnBusy(true);
    pendingSamplesRef.current = [];
    setPendingSamplesCount(0);
    try {
      const res = await fetch('/api/nn/reset', { method: 'POST' });
      if (res.ok) {
        const fresh = (await res.json()) as NnServerState;
        if (fresh && fresh.weights) {
          setNnState(fresh);
          return;
        }
      }
    } catch {
      // Fall back to fresh deterministic local weights if backend unavailable
    } finally {
      setNnBusy(false);
    }
    setNnState(createFallbackNnState());
  }, [nnBusy]);

  // Ticket regeneration tick
  useEffect(() => {
    const id = window.setInterval(() => {
      setSave((prev) => {
        const next = regenTickets(prev);
        return next === prev ? prev : next;
      });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // Initialize SoundEngine and persistent WebGL WorldSceneController
  useEffect(() => {
    const sound = new SoundEngine();
    sound.setMuted(saveRef.current.muted);
    sound.setVolumes(
      saveRef.current.settings.masterVolume,
      saveRef.current.settings.sfxVolume,
    );
    soundRef.current = sound;

    const mount = worldMountRef.current;
    if (!mount) return;

    const world = new WorldSceneController(
      mount,
      (dt, physics: HillClimbPhysics | null) => {
        const curScreen = screenRef.current;
        if (curScreen === 'PLAYING' && physics) {
          const s = physics.state;
          const curSave = saveRef.current;
          const curStage = getStageById(curSave.selectedStage);
          const curVehicle = getVehicleById(curSave.selectedVehicle);
          const speedMs = Math.hypot(s.vx, s.vy);
          const wheelSlip =
            s.burnoutCharge > 0.1 ||
            (Math.abs(s.throttle) > 0.6 &&
              s.surface !== 'asphalt' &&
              Math.abs(s.spinR * curVehicle.wheelRadius - s.vx) > 3.5);

          sound.updateEngine(
            !s.crashed,
            s.rpm,
            s.throttle,
            s.nitroActive,
            curSave.selectedVehicle,
          );
          sound.updateSurfaceNoise(
            !s.crashed && (s.groundedR || s.groundedF),
            speedMs,
            s.surface,
            wheelSlip,
          );

          if (stuntRef.current) {
            stuntRef.current.remainingSec -= dt;
            if (stuntRef.current.remainingSec <= 0) {
              stuntRef.current = null;
            }
          }

          const dist = Math.max(0, Math.floor(s.x - START_X));
          const summitMeters = Math.max(100, curStage.summitMeters);
          const progressFrac = Math.max(0, Math.min(1, (s.x - START_X) / summitMeters));
          const rival = worldRef.current?.getRivalDelta() ?? {
            delta: null,
            label: 'AI' as const,
          };

          const aiPhysics = worldRef.current?.getAiPhysics() ?? null;
          const aiNormX =
            curSave.climbSetup.climbMode === 'head_to_head' &&
            !watchAiModeRef.current &&
            aiPhysics
              ? Math.max(0, Math.min(1, (aiPhysics.state.x - START_X) / summitMeters))
              : null;

          const ghostTrack = curSave.stageGhosts?.[curStage.id] ?? [];
          let ghostNormX: number | null = null;
          if (
            (curSave.climbSetup.climbMode === 'ghost' || curSave.settings.showGhost) &&
            !watchAiModeRef.current &&
            ghostTrack.length >= 2
          ) {
            const elapsedSec = worldRef.current?.getRunElapsedSec() ?? s.elapsedTimeSec;
            const ghostSample = interpolateGhostSample(ghostTrack, elapsedSec);
            if (ghostSample) {
              ghostNormX = Math.max(0, Math.min(1, (ghostSample.x - START_X) / summitMeters));
            }
          }

          hudRef.current?.updateLive({
            distanceMeters: dist,
            summitMeters,
            progressFrac,
            climbTimeSec: s.elapsedTimeSec,
            bestMeters: Math.floor(curSave.stageBests[curSave.selectedStage] ?? 0),
            nextFuelMeters: physics.getNextFuelDistanceMeters(),
            ghostDeltaMeters: rival.delta,
            rivalLabel: rival.label,
            aiAutoPilot: worldRef.current?.isAiAutoPilot() ?? false,
            watchAiMode: watchAiModeRef.current,
            fuelPct: s.fuel,
            tireHealthPct: s.tireHealth,
            runCoins: s.runCoins,
            totalCoins: curSave.coins,
            gems: curSave.gems,
            speedKmh: Math.round(speedMs * 3.6),
            rpmNorm: s.rpm,
            boostNorm: s.nitroActive ? 0.92 : s.nitroEnergy / 100,
            nitroEnergy: s.nitroEnergy,
            gear: s.gear,
            airborne: !s.groundedR && !s.groundedF,
            inWater: false,
            inTunnel: s.inTunnel,
            surface: s.surface,
            turboChargeNorm: s.turboChargeNorm,
            overchargedActive: s.overchargedActive,
            rollcageIntact: s.rollcageIntact,
            hasRollCage: curVehicle.hasRollCage,
            comboCount: s.comboCount,
            hasJumpShocks: s.hasJumpShocks,
            slopeDeg: s.slopeDeg,
            suspensionLoadNorm: s.suspensionLoadNorm,
            airRotationDeg: s.airRotationDeg,
            burnoutCharge: s.burnoutCharge,
            landingGrade: s.landingGrade,
            lowRangeActive: s.lowRangeActive,
            hasLowRange: s.hasLowRange,
            activeAeroActive: s.activeAeroActive,
            vehicleId: curSave.selectedVehicle,
            callout: stuntRef.current,
            playerNormX: progressFrac,
            aiNormX,
            ghostNormX,
            cameraMode: cameraModeRef.current,
            weather: curSave.climbSetup.weather,
            timeOfDay: curSave.climbSetup.timeOfDay,
            nnTelemetry: worldRef.current?.getLatestNnTelemetry() ?? null,
          });
        } else {
          sound.updateEngine(false, 0, 0, false);
          sound.updateSurfaceNoise(false, 0, 'dirt', false);
        }
      },
      () => setContextLost(true),
    );

    const initialSave = saveRef.current;
    const initialStage = getStageById(initialSave.selectedStage);
    const initialVehicle = getVehicleById(initialSave.selectedVehicle);
    world.applyStageEnvironment(
      initialStage,
      initialSave.climbSetup.weather,
      initialSave.climbSetup.timeOfDay,
    );
    world.applyGraphicsQuality(initialSave.settings.graphicsQuality);
    world.setCameraShakeMode(initialSave.settings.cameraShake);
    world.setShowGhost(initialSave.settings.showGhost);
    world.setRivalMode(initialSave.settings.rivalMode);
    world.setNnConfig(
      nnStateRef.current.weights,
      nnStateRef.current.hillMastery,
      nnStateRef.current.evolutionBonuses,
      initialSave.aiAutoTune,
    );
    world.rebuildVehicleModel(
      initialVehicle,
      initialSave.vehiclePaints[initialVehicle.id] || initialVehicle.defaultPaintId,
      initialSave.vehicleWheels[initialVehicle.id] || 'steel',
      initialStage.headlightsOn || initialSave.climbSetup.timeOfDay === 'night',
      initialSave.vehicleAccessories?.[initialVehicle.id] ?? ['lightbar'],
      initialSave.vehicleNeons?.[initialVehicle.id] ?? 'off',
      initialSave.vehicleLiveries?.[initialVehicle.id] ?? 'clean',
      initialSave.upgrades?.[initialVehicle.id],
      initialSave.tuning?.rideHeight ?? 0,
    );
    world.setMode('TITLE');

    worldRef.current = world;

    return () => {
      if (crashTimeoutRef.current !== null) {
        clearTimeout(crashTimeoutRef.current);
      }
      sound.updateEngine(false, 0, 0, false);
      sound.updateSurfaceNoise(false, 0, 'dirt', false);
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  // Sync showroom turntable / backdrop vehicle & weather whenever edited from menus
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    if (
      screen === 'TITLE_MENU' ||
      screen === 'PADDOCK' ||
      screen === 'WORLD_MAP' ||
      screen === 'GARAGE'
    ) {
      const stage = getStageById(save.selectedStage);
      const vehicle = getVehicleById(save.selectedVehicle);
      const lightsOn =
        stage.headlightsOn ||
        save.climbSetup.timeOfDay === 'night' ||
        save.climbSetup.timeOfDay === 'dusk' ||
        save.climbSetup.weather === 'storm';
      world.applyStageEnvironment(stage, save.climbSetup.weather, save.climbSetup.timeOfDay);
      world.rebuildVehicleModel(
        vehicle,
        save.vehiclePaints[vehicle.id] || vehicle.defaultPaintId,
        save.vehicleWheels[vehicle.id] || 'steel',
        lightsOn,
        save.vehicleAccessories?.[vehicle.id] ?? ['lightbar'],
        save.vehicleNeons?.[vehicle.id] ?? 'off',
        save.vehicleLiveries?.[vehicle.id] ?? 'clean',
        save.upgrades?.[vehicle.id],
        save.tuning?.rideHeight ?? 0,
      );
    }
  }, [
    screen,
    save.selectedStage,
    save.selectedVehicle,
    save.climbSetup.weather,
    save.climbSetup.timeOfDay,
    save.vehiclePaints,
    save.vehicleWheels,
    save.vehicleAccessories,
    save.vehicleNeons,
    save.vehicleLiveries,
    save.upgrades,
    save.tuning.rideHeight,
  ]);

  const startRace = useCallback(
    (stageOverride?: StageId, watchAi = false) => {
      soundRef.current?.unlock();
      soundRef.current?.playClick(true);

      if (crashTimeoutRef.current !== null) {
        clearTimeout(crashTimeoutRef.current);
        crashTimeoutRef.current = null;
      }

      const cur = saveRef.current;
      const targetStageId = stageOverride ?? cur.selectedStage;
      const stage = getStageById(targetStageId);
      const vehicle = getVehicleById(cur.selectedVehicle);
      const climbTireId: ClimbTireId =
        cur.vehicleClimbTires?.[vehicle.id] ?? 'all_terrain';

      const hasBoosters =
        cur.boosters.fuelSaver > 0 ||
        cur.boosters.nitroCharge > 0 ||
        cur.boosters.coinMagnet > 0;

      const nextSave: SaveData = {
        ...cur,
        selectedStage: targetStageId,
        tickets: cur.tickets > 0 ? cur.tickets - 1 : 0,
        ticketTimestamp:
          cur.tickets >= MAX_TICKETS ? Date.now() : cur.ticketTimestamp,
        boosters: {
          fuelSaver: Math.max(0, cur.boosters.fuelSaver - 1),
          nitroCharge: Math.max(0, cur.boosters.nitroCharge - 1),
          coinMagnet: Math.max(0, cur.boosters.coinMagnet - 1),
        },
      };
      setSave(nextSave);
      saveRef.current = nextSave;

      watchAiModeRef.current = watchAi;
      setWatchAiMode(watchAi);
      aiAutoPilotRef.current = watchAi;
      setAiAutoPilot(watchAi);

      stuntRef.current = null;
      setRunSummary(null);
      setSummitAnalytics(null);
      setScreen('PLAYING');
      screenRef.current = 'PLAYING';

      worldRef.current?.setInput({
        gas: false,
        brake: false,
        nitro: false,
        handbrake: false,
        jump: false,
        lowRange: false,
        steerPitchAmount: undefined,
      });
      worldRef.current?.setAiAutoPilot(watchAi);
      worldRef.current?.setCameraMode(cameraModeRef.current);

      let summitHandled = false;

      worldRef.current?.startRun(
        nextSave,
        stage,
        vehicle,
        hasBoosters,
        {
          onCoin: (value) => {
            soundRef.current?.playCoin(value);
          },
          onFuel: () => {
            soundRef.current?.playFuel();
            stuntRef.current = {
              id: stuntSeqRef.current++,
              title: 'FUEL REFILLED!',
              bonusCoins: 0,
              remainingSec: 1.2,
            };
          },
          onStunt: (title, bonusCoins) => {
            soundRef.current?.playStunt();
            stuntRef.current = {
              id: stuntSeqRef.current++,
              title,
              bonusCoins,
              remainingSec: 1.65,
            };
          },
          onLanding: (intensity, _surface, grade) => {
            soundRef.current?.playLanding(intensity);
            if (grade === 'PERFECT') {
              soundRef.current?.playPerfectLanding();
            }
          },
          onGearShift: () => {
            soundRef.current?.playGearShift();
          },
          onTurboSurge: () => {
            soundRef.current?.playTurboSurge();
          },
          onJumpShock: () => {
            soundRef.current?.playJumpShock();
          },
          onRollcageBreak: () => {
            soundRef.current?.playRollcageBreak();
          },
          onScrape: (intensity) => {
            soundRef.current?.playScrape(intensity);
          },
          onHumanSample: (sample) => {
            if (pendingSamplesRef.current.length >= 64) {
              pendingSamplesRef.current.shift();
            }
            pendingSamplesRef.current.push(sample);
            setPendingSamplesCount(pendingSamplesRef.current.length);
            if (pendingSamplesRef.current.length >= 16 && !nnFlushInFlightRef.current) {
              void flushTrainingSamples(false);
            }
          },
          onSummitCrossed: () => {
            if (summitHandled) return;
            summitHandled = true;
            soundRef.current?.playStunt();
            soundRef.current?.playPerfectLanding();

            const physics = worldRef.current?.getPhysics();
            if (!physics) return;
            const s = physics.state;

            worldRef.current?.setMode('PAUSED');
            worldRef.current?.setInput({
              gas: false,
              brake: false,
              nitro: false,
              handbrake: false,
              jump: false,
              lowRange: false,
              steerPitchAmount: undefined,
            });

            const distMeters = stage.summitMeters;
            const climbTimeSec = Math.max(1, s.elapsedTimeSec);
            const topSpeedKmh = s.maxSpeedKmh;
            const avgSpeedKmh = Math.round((distMeters / climbTimeSec) * 3.6);
            const cleanLinePct =
              s.totalDriveSamples > 0
                ? Math.round((s.cleanLineSamples / s.totalDriveSamples) * 100)
                : 100;

            const medal: MedalTier =
              climbTimeSec <= stage.medalTargets.goldSec
                ? 'GOLD'
                : climbTimeSec <= stage.medalTargets.silverSec
                  ? 'SILVER'
                  : climbTimeSec <= stage.medalTargets.bronzeSec
                    ? 'BRONZE'
                    : 'FINISHER';

            const medalBonus =
              medal === 'GOLD' ? 400 : medal === 'SILVER' ? 250 : medal === 'BRONZE' ? 150 : 85;
            const coinsEarned = s.runCoins + Math.floor(distMeters * 0.55) + medalBonus;

            const recordedGhost = worldRef.current?.getRecordedGhost() ?? [];
            const prevBest = Math.floor(saveRef.current.stageBests[stage.id] ?? 0);
            const isNewBest = distMeters >= prevBest;
            const aiMarginMeters = worldRef.current?.getAiMarginMeters() ?? null;

            const sectorSplits: [number, number, number] = [
              s.sectorSplits[0] > 0 ? s.sectorSplits[0] : Number((climbTimeSec * 0.34).toFixed(2)),
              s.sectorSplits[1] > 0 ? s.sectorSplits[1] : Number((climbTimeSec * 0.68).toFixed(2)),
              s.sectorSplits[2] > 0 ? s.sectorSplits[2] : Number(climbTimeSec.toFixed(2)),
            ];

            setSave((prev) => {
              const refreshed = refreshDailyChallenge(prev);
              const nextGhostMap =
                isNewBest && recordedGhost.length >= 2
                  ? { ...refreshed.stageGhosts, [stage.id]: recordedGhost }
                  : refreshed.stageGhosts;

              return {
                ...refreshed,
                coins: refreshed.coins + coinsEarned,
                stageBests: {
                  ...refreshed.stageBests,
                  [stage.id]: Math.max(refreshed.stageBests[stage.id] ?? 0, distMeters),
                },
                stageGhosts: nextGhostMap,
                dailyChallenge: {
                  ...refreshed.dailyChallenge,
                  bestMeters: Math.max(refreshed.dailyChallenge.bestMeters, distMeters),
                },
                totals: {
                  distanceMeters: refreshed.totals.distanceMeters + distMeters,
                  coinsCollected: refreshed.totals.coinsCollected + coinsEarned,
                  flipsCompleted: refreshed.totals.flipsCompleted + s.flips,
                  bestSingleRunMeters: Math.max(
                    refreshed.totals.bestSingleRunMeters,
                    distMeters,
                  ),
                  runsCompleted: refreshed.totals.runsCompleted + 1,
                },
              };
            });

            const curNn = nnStateRef.current;
            const masteryBefore = curNn.hillMastery[stage.id] ?? 0;
            const baseAnalytics: SummitAnalytics = {
              stageId: stage.id,
              stageName: stage.name,
              climbMode: saveRef.current.climbSetup.climbMode,
              difficulty: saveRef.current.climbSetup.difficulty,
              weather: saveRef.current.climbSetup.weather,
              timeOfDay: saveRef.current.climbSetup.timeOfDay,
              medal,
              climbTimeSec,
              topSpeedKmh,
              avgSpeedKmh,
              cleanLinePct,
              wheelspinDistMeters: s.wheelspinDistMeters,
              tireHealthRemaining: s.tireHealth,
              sectorSplits,
              masteryBefore,
              masteryAfter: masteryBefore,
              aiMarginMeters,
              coinsEarned,
              flips: s.flips,
              bonusesSnapshot: curNn.evolutionBonuses,
              aiAutoTuneActive: saveRef.current.aiAutoTune,
            };

            setSummitAnalytics(baseAnalytics);
            setScreen('SUMMIT');
            screenRef.current = 'SUMMIT';

            void (async () => {
              await flushTrainingSamples(false);
              try {
                const res = await fetch('/api/nn/summit', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    stageId: stage.id,
                    climbTimeSec,
                    cleanLinePct,
                    difficulty: saveRef.current.climbSetup.difficulty,
                    completed: true,
                  }),
                });
                if (res.ok) {
                  const data = (await res.json()) as {
                    state: NnServerState;
                    masteryBefore: number;
                    masteryAfter: number;
                  };
                  if (data?.state?.weights) {
                    setNnState(data.state);
                    setSummitAnalytics((prev) =>
                      prev
                        ? {
                            ...prev,
                            masteryBefore: data.masteryBefore,
                            masteryAfter: data.masteryAfter,
                            bonusesSnapshot: data.state.evolutionBonuses,
                          }
                        : prev,
                    );
                  }
                }
              } catch {
                // Keep optimistic analytics if offline
              }
            })();
          },
          onCrash: (reason) => {
            if (summitHandled) return;
            if (reason.includes('Head Impact')) {
              soundRef.current?.playNeckCrack();
            }
            soundRef.current?.playCrash();
            void flushTrainingSamples(false);

            const physics = worldRef.current?.getPhysics();
            if (!physics) return;

            const s = physics.state;
            const distMeters = Math.max(0, Math.floor(s.x - START_X));
            const coinsEarned = s.runCoins + Math.floor(distMeters * 0.45);
            const prevBest = Math.floor(saveRef.current.stageBests[stage.id] ?? 0);
            const isNewBest = distMeters > prevBest;
            const nextBest = Math.max(prevBest, distMeters);
            const recordedGhost = worldRef.current?.getRecordedGhost() ?? [];
            const aiMarginMeters = worldRef.current?.getAiMarginMeters() ?? null;

            setSave((prev) => {
              const refreshed = refreshDailyChallenge(prev);
              const nextGhostMap =
                isNewBest && recordedGhost.length >= 2
                  ? { ...refreshed.stageGhosts, [stage.id]: recordedGhost }
                  : refreshed.stageGhosts;

              return {
                ...refreshed,
                coins: refreshed.coins + coinsEarned,
                stageBests: {
                  ...refreshed.stageBests,
                  [stage.id]: Math.max(refreshed.stageBests[stage.id] ?? 0, distMeters),
                },
                stageGhosts: nextGhostMap,
                dailyChallenge: {
                  ...refreshed.dailyChallenge,
                  bestMeters: Math.max(refreshed.dailyChallenge.bestMeters, distMeters),
                },
                totals: {
                  distanceMeters: refreshed.totals.distanceMeters + distMeters,
                  coinsCollected: refreshed.totals.coinsCollected + coinsEarned,
                  flipsCompleted: refreshed.totals.flipsCompleted + s.flips,
                  bestSingleRunMeters: Math.max(
                    refreshed.totals.bestSingleRunMeters,
                    distMeters,
                  ),
                  runsCompleted: refreshed.totals.runsCompleted + 1,
                },
              };
            });

            crashTimeoutRef.current = window.setTimeout(() => {
              worldRef.current?.setMode('GAME_OVER');
              setRunSummary({
                reason,
                distanceMeters: distMeters,
                coinsEarned,
                flips: s.flips,
                maxSpeedKmh: s.maxSpeedKmh,
                airTimeTotal: s.airTimeTotal,
                isNewBest,
                stageBestMeters: nextBest,
                stageName: stage.name,
                aiMarginMeters,
              });
              setScreen('GAME_OVER');
            }, 900);
          },
        },
        {
          climbSetup: nextSave.climbSetup,
          climbTireId,
          watchAiMode: watchAi,
          aiAutoTune: nextSave.aiAutoTune,
          nnWeights: nnStateRef.current.weights,
          hillMastery: nnStateRef.current.hillMastery,
          evolutionBonuses: nnStateRef.current.evolutionBonuses,
        },
      );
    },
    [flushTrainingSamples],
  );

  const goHome = useCallback(() => {
    soundRef.current?.playClick();
    if (crashTimeoutRef.current !== null) {
      clearTimeout(crashTimeoutRef.current);
      crashTimeoutRef.current = null;
    }
    void flushTrainingSamples(false);
    worldRef.current?.setMode('TITLE');
    setRunSummary(null);
    setSummitAnalytics(null);
    setWatchAiMode(false);
    setAiAutoPilot(false);
    setScreen('TITLE_MENU');
  }, [flushTrainingSamples]);

  const openPaddock = useCallback(() => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    if (crashTimeoutRef.current !== null) {
      clearTimeout(crashTimeoutRef.current);
      crashTimeoutRef.current = null;
    }
    void flushTrainingSamples(false);
    worldRef.current?.setMode('TITLE');
    setRunSummary(null);
    setSummitAnalytics(null);
    setWatchAiMode(false);
    setAiAutoPilot(false);
    setScreen('PADDOCK');
  }, [flushTrainingSamples]);

  const pauseRace = useCallback(() => {
    if (screenRef.current !== 'PLAYING') return;
    soundRef.current?.playClick();
    worldRef.current?.setMode('PAUSED');
    worldRef.current?.setInput({
      gas: false,
      brake: false,
      nitro: false,
      handbrake: false,
      jump: false,
      lowRange: false,
      steerPitchAmount: undefined,
    });
    setScreen('PAUSED');
  }, []);

  const resumeRace = useCallback(() => {
    if (screenRef.current !== 'PAUSED') return;
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    worldRef.current?.setMode('PLAYING');
    setScreen('PLAYING');
  }, []);

  const toggleMute = useCallback(() => {
    soundRef.current?.unlock();
    updateSave((prev) => ({ ...prev, muted: !prev.muted }));
  }, [updateSave]);

  const handleToggleAiAutoPilot = useCallback(() => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    setAiAutoPilot((prev) => {
      const next = !prev;
      aiAutoPilotRef.current = next;
      worldRef.current?.setAiAutoPilot(next);
      return next;
    });
  }, []);

  const handleCycleCamera = useCallback(() => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    const order: CameraMode[] = ['chase', 'wide', 'bumper'];
    const next = order[(order.indexOf(cameraModeRef.current) + 1) % order.length];
    cameraModeRef.current = next;
    setCameraMode(next);
    worldRef.current?.setCameraMode(next);
  }, []);

  const handleToggleGhost = useCallback(() => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    updateSave((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        showGhost: !prev.settings.showGhost,
      },
    }));
  }, [updateSave]);

  const handleToggleGyro = useCallback(async () => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    const nextEnabled = !saveRef.current.gyroEnabled;
    if (nextEnabled && typeof window !== 'undefined') {
      const devOri = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (devOri && typeof devOri.requestPermission === 'function') {
        try {
          const perm = await devOri.requestPermission();
          if (perm !== 'granted') return;
        } catch {
          return;
        }
      }
    }
    updateSave((prev) => ({ ...prev, gyroEnabled: nextEnabled }));
    if (!nextEnabled) {
      worldRef.current?.setInput({ steerPitchAmount: undefined });
    }
  }, [updateSave]);

  const handleInputChange = useCallback((partial: Partial<InputState>) => {
    soundRef.current?.unlock();
    worldRef.current?.setInput(partial);
  }, []);

  // Optional DeviceOrientation Tilt / Gyro steering during active manual drive
  useEffect(() => {
    if (
      screen !== 'PLAYING' ||
      !save.gyroEnabled ||
      aiAutoPilot ||
      watchAiMode ||
      typeof window === 'undefined'
    ) {
      worldRef.current?.setInput({ steerPitchAmount: undefined });
      return;
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (screenRef.current !== 'PLAYING') return;
      const isLandscape = window.innerWidth > window.innerHeight;
      const rawTilt = isLandscape ? (e.beta ?? 0) : (e.gamma ?? 0);
      const clamped = Math.max(-35, Math.min(35, rawTilt));
      if (Math.abs(clamped) < 4) {
        worldRef.current?.setInput({ steerPitchAmount: 0 });
      } else {
        // Positive tilt pitches nose up (backflip/gas direction), negative noses down
        worldRef.current?.setInput({
          steerPitchAmount: Math.max(-1, Math.min(1, clamped / 28)),
        });
      }
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      worldRef.current?.setInput({ steerPitchAmount: undefined });
    };
  }, [screen, save.gyroEnabled, aiAutoPilot, watchAiMode]);

  // Global keyboard & blur controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      soundRef.current?.unlock();

      if (e.code === 'KeyM') {
        toggleMute();
        return;
      }

      const cur = screenRef.current;

      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (cur === 'PLAYING') worldRef.current?.setInput({ gas: true });
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        if (cur === 'PLAYING') worldRef.current?.setInput({ brake: true });
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (cur === 'PLAYING') worldRef.current?.setInput({ nitro: true });
      } else if (e.code === 'Space') {
        if (cur === 'PLAYING') {
          e.preventDefault();
          worldRef.current?.setInput({ handbrake: true });
        } else if (cur === 'TITLE_MENU') {
          e.preventDefault();
          startRace(undefined, false);
        }
      } else if (e.code === 'Enter') {
        if (cur === 'TITLE_MENU' || cur === 'GAME_OVER') {
          e.preventDefault();
          startRace(undefined, false);
        } else if (cur === 'PAUSED') {
          e.preventDefault();
          resumeRace();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (cur === 'PLAYING') {
          pauseRace();
        } else if (cur === 'PAUSED') {
          resumeRace();
        } else if (cur === 'PADDOCK') {
          goHome();
        } else if (
          cur === 'GARAGE' ||
          cur === 'UPGRADES' ||
          cur === 'WORLD_MAP' ||
          cur === 'SHOP' ||
          cur === 'MISSIONS' ||
          cur === 'TUNING' ||
          cur === 'SETTINGS'
        ) {
          setScreen(returnScreen);
        }
      } else if (e.code === 'KeyC') {
        if (cur === 'PLAYING') {
          e.preventDefault();
          handleCycleCamera();
        }
      } else if (e.code === 'KeyI') {
        if (cur === 'PLAYING') {
          e.preventDefault();
          handleToggleAiAutoPilot();
        }
      } else if (e.code === 'KeyL') {
        if (cur === 'PLAYING') {
          worldRef.current?.setInput({ lowRange: true });
        }
      } else if (e.code === 'KeyR') {
        if (cur === 'PLAYING' || cur === 'PAUSED' || cur === 'GAME_OVER' || cur === 'SUMMIT') {
          startRace(undefined, watchAiModeRef.current);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        worldRef.current?.setInput({ gas: false });
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        worldRef.current?.setInput({ brake: false });
      } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        worldRef.current?.setInput({ nitro: false });
      } else if (e.code === 'Space') {
        worldRef.current?.setInput({ handbrake: false });
      } else if (e.code === 'KeyL') {
        worldRef.current?.setInput({ lowRange: false });
      }
    };

    const clearInputs = () => {
      worldRef.current?.setInput({
        gas: false,
        brake: false,
        nitro: false,
        handbrake: false,
        jump: false,
        lowRange: false,
        steerPitchAmount: undefined,
      });
    };

    const onVisibilityChange = () => {
      if (document.hidden) clearInputs();
    };

    const onFirstTouch = () => {
      soundRef.current?.unlock();
      setTouchDetected(true);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInputs);
    window.addEventListener('orientationchange', clearInputs);
    window.addEventListener('touchstart', onFirstTouch, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInputs);
      window.removeEventListener('orientationchange', clearInputs);
      window.removeEventListener('touchstart', onFirstTouch);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [
    goHome,
    handleCycleCamera,
    handleToggleAiAutoPilot,
    pauseRace,
    resumeRace,
    returnScreen,
    startRace,
    toggleMute,
  ]);

  // Ensure held inputs clear whenever navigating away from active PLAYING mode
  useEffect(() => {
    if (screen !== 'PLAYING') {
      worldRef.current?.setInput({
        gas: false,
        brake: false,
        nitro: false,
        handbrake: false,
        jump: false,
        lowRange: false,
        steerPitchAmount: undefined,
      });
    }
  }, [screen]);

  // Standard Gamepad polling (RT/LT/A/X/RB/B/Y/Start) without overriding keyboard/touch
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    let rafId = 0;
    const prevPad = {
      gas: false,
      brake: false,
      nitro: false,
      handbrake: false,
      start: false,
    };

    const syncConnection = () => {
      const pads = navigator.getGamepads();
      const hasPad = Array.from(pads).some((p) => Boolean(p && p.connected));
      setGamepadActive(hasPad);
    };

    const releasePadInputs = () => {
      const reset: Partial<InputState> = {};
      if (prevPad.gas) {
        prevPad.gas = false;
        reset.gas = false;
      }
      if (prevPad.brake) {
        prevPad.brake = false;
        reset.brake = false;
      }
      if (prevPad.nitro) {
        prevPad.nitro = false;
        reset.nitro = false;
      }
      if (prevPad.handbrake) {
        prevPad.handbrake = false;
        reset.handbrake = false;
      }
      if (Object.keys(reset).length > 0) {
        worldRef.current?.setInput(reset);
      }
    };

    const poll = () => {
      const pads = navigator.getGamepads();
      const pad = Array.from(pads).find((p) => Boolean(p && p.connected)) ?? null;

      if (pad) {
        const cur = screenRef.current;
        const startPressed = Boolean(pad.buttons[9]?.pressed);
        if (startPressed && !prevPad.start) {
          if (cur === 'PLAYING') {
            pauseRace();
          } else if (cur === 'PAUSED') {
            resumeRace();
          }
        }
        prevPad.start = startPressed;

        if (cur === 'PLAYING') {
          const stickX = pad.axes[0] ?? 0;
          const nextGas = Boolean(
            (pad.buttons[7]?.value ?? 0) > 0.25 ||
              pad.buttons[7]?.pressed ||
              pad.buttons[0]?.pressed ||
              stickX > 0.45,
          );
          const nextBrake = Boolean(
            (pad.buttons[6]?.value ?? 0) > 0.25 ||
              pad.buttons[6]?.pressed ||
              pad.buttons[2]?.pressed ||
              stickX < -0.45,
          );
          const nextNitro = Boolean(
            pad.buttons[5]?.pressed || pad.buttons[1]?.pressed,
          );
          const nextHandbrake = Boolean(
            pad.buttons[3]?.pressed || pad.buttons[4]?.pressed,
          );

          const diff: Partial<InputState> = {};
          if (nextGas !== prevPad.gas) {
            prevPad.gas = nextGas;
            diff.gas = nextGas;
          }
          if (nextBrake !== prevPad.brake) {
            prevPad.brake = nextBrake;
            diff.brake = nextBrake;
          }
          if (nextNitro !== prevPad.nitro) {
            prevPad.nitro = nextNitro;
            diff.nitro = nextNitro;
          }
          if (nextHandbrake !== prevPad.handbrake) {
            prevPad.handbrake = nextHandbrake;
            diff.handbrake = nextHandbrake;
          }
          if (Object.keys(diff).length > 0) {
            soundRef.current?.unlock();
            worldRef.current?.setInput(diff);
          }
        } else {
          releasePadInputs();
        }
        rafId = requestAnimationFrame(poll);
      } else {
        prevPad.start = false;
        releasePadInputs();
        rafId = 0;
      }
    };

    const startPolling = () => {
      syncConnection();
      if (!rafId) {
        rafId = requestAnimationFrame(poll);
      }
    };

    syncConnection();
    const initialPads = navigator.getGamepads();
    if (Array.from(initialPads).some((p) => Boolean(p && p.connected))) {
      rafId = requestAnimationFrame(poll);
    }

    window.addEventListener('gamepadconnected', startPolling);
    window.addEventListener('gamepaddisconnected', syncConnection);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      releasePadInputs();
      window.removeEventListener('gamepadconnected', startPolling);
      window.removeEventListener('gamepaddisconnected', syncConnection);
    };
  }, [pauseRace, resumeRace]);

  // Garage / Paddock / Upgrades / Shop / Missions callbacks
  const handleSelectVehicle = (id: VehicleId) => {
    soundRef.current?.playClick();
    updateSave((prev) =>
      prev.unlockedVehicles[id] ? { ...prev, selectedVehicle: id } : prev,
    );
  };

  const handleUnlockVehicle = (id: VehicleId) => {
    const v = getVehicleById(id);
    updateSave((prev) => {
      if (prev.unlockedVehicles[id] || prev.coins < v.price) return prev;
      soundRef.current?.playClick(true);
      return {
        ...prev,
        coins: prev.coins - v.price,
        selectedVehicle: id,
        unlockedVehicles: { ...prev.unlockedVehicles, [id]: true },
      };
    });
  };

  const handleSetPaint = (vehicleId: VehicleId, paintId: string) => {
    soundRef.current?.playClick();
    updateSave((prev) => ({
      ...prev,
      vehiclePaints: { ...prev.vehiclePaints, [vehicleId]: paintId },
    }));
  };

  const handleSetNeon = (vehicleId: VehicleId, neonId: NeonColorId) => {
    soundRef.current?.playClick();
    updateSave((prev) => ({
      ...prev,
      vehicleNeons: { ...prev.vehicleNeons, [vehicleId]: neonId },
    }));
  };

  const handleSetLivery = (vehicleId: VehicleId, liveryId: LiveryId) => {
    soundRef.current?.playClick();
    updateSave((prev) => ({
      ...prev,
      vehicleLiveries: { ...prev.vehicleLiveries, [vehicleId]: liveryId },
    }));
  };

  const handleSetClimbTire = (vehicleId: VehicleId, tireId: ClimbTireId) => {
    soundRef.current?.playClick();
    updateSave((prev) => ({
      ...prev,
      vehicleClimbTires: {
        ...prev.vehicleClimbTires,
        [vehicleId]: tireId,
      },
    }));
  };

  const handleUpdateClimbSetup = (next: ClimbSetupConfig) => {
    soundRef.current?.playClick();
    updateSave((prev) => ({ ...prev, climbSetup: next }));
  };

  const handleSelectOrUnlockWheel = (
    vehicleId: VehicleId,
    wheelId: WheelStyleId,
  ) => {
    const style = WHEEL_STYLES.find((w) => w.id === wheelId);
    if (!style) return;
    updateSave((prev) => {
      const owned = prev.unlockedWheels[wheelId];
      if (!owned) {
        if (prev.coins < style.price) return prev;
        soundRef.current?.playClick(true);
        return {
          ...prev,
          coins: prev.coins - style.price,
          unlockedWheels: { ...prev.unlockedWheels, [wheelId]: true },
          vehicleWheels: { ...prev.vehicleWheels, [vehicleId]: wheelId },
        };
      }
      soundRef.current?.playClick();
      return {
        ...prev,
        vehicleWheels: { ...prev.vehicleWheels, [vehicleId]: wheelId },
      };
    });
  };

  const handleToggleOrUnlockAccessory = (
    vehicleId: VehicleId,
    accId: VehicleAccessoryId,
  ) => {
    const def = ACCESSORY_DEFS.find((a) => a.id === accId);
    if (!def) return;
    updateSave((prev) => {
      const owned = prev.unlockedAccessories?.[accId] ?? false;
      const curList = prev.vehicleAccessories?.[vehicleId] ?? [];
      if (!owned) {
        if (prev.coins < def.price) return prev;
        soundRef.current?.playClick(true);
        const nextList = curList.includes(accId) ? curList : [...curList, accId];
        return {
          ...prev,
          coins: prev.coins - def.price,
          unlockedAccessories: { ...prev.unlockedAccessories, [accId]: true },
          vehicleAccessories: { ...prev.vehicleAccessories, [vehicleId]: nextList },
        };
      }
      soundRef.current?.playClick();
      const nextList = curList.includes(accId)
        ? curList.filter((item) => item !== accId)
        : [...curList, accId];
      return {
        ...prev,
        vehicleAccessories: { ...prev.vehicleAccessories, [vehicleId]: nextList },
      };
    });
  };

  const handleToggleOrUnlockTuningPart = (
    vehicleId: VehicleId,
    partId: TuningPartId,
  ) => {
    const def = TUNING_PART_DEFS.find((p) => p.id === partId);
    if (!def) return;
    updateSave((prev) => {
      const owned = prev.unlockedTuningParts?.[partId] ?? false;
      const curList = prev.vehicleTuningParts?.[vehicleId] ?? [];
      if (!owned) {
        if (prev.coins < def.price) return prev;
        soundRef.current?.playClick(true);
        const canAutoEquip = curList.length < MAX_EQUIPPED_PARTS && !curList.includes(partId);
        const nextList = canAutoEquip ? [...curList, partId] : curList;
        return {
          ...prev,
          coins: prev.coins - def.price,
          unlockedTuningParts: { ...prev.unlockedTuningParts, [partId]: true },
          vehicleTuningParts: { ...prev.vehicleTuningParts, [vehicleId]: nextList },
        };
      }
      const equipped = curList.includes(partId);
      if (!equipped && curList.length >= MAX_EQUIPPED_PARTS) {
        return prev;
      }
      soundRef.current?.playClick();
      const nextList = equipped
        ? curList.filter((item) => item !== partId)
        : [...curList, partId];
      return {
        ...prev,
        vehicleTuningParts: { ...prev.vehicleTuningParts, [vehicleId]: nextList },
      };
    });
  };

  const handleBuyUpgrade = (vehicleId: VehicleId, key: UpgradeKey) => {
    updateSave((prev) => {
      const levels = prev.upgrades[vehicleId];
      const curLv = levels[key] ?? 0;
      if (curLv >= MAX_UPGRADE_LEVEL) return prev;
      const cost = getUpgradeCost(key, curLv);
      if (prev.coins < cost) return prev;
      soundRef.current?.playClick(true);
      return {
        ...prev,
        coins: prev.coins - cost,
        upgrades: {
          ...prev.upgrades,
          [vehicleId]: {
            ...levels,
            [key]: curLv + 1,
          },
        },
      };
    });
  };

  const handleClaimFreeGems = (): ShopActionResult | null => {
    const cur = saveRef.current;
    if (cur.freeGemsTimestamp > 0 && Date.now() - cur.freeGemsTimestamp < 120_000) {
      return null;
    }
    soundRef.current?.playStunt();
    updateSave((prev) => ({
      ...prev,
      gems: prev.gems + 15,
      freeGemsTimestamp: Date.now(),
    }));
    return {
      title: '+15 GEMS CLAIMED!',
      detail: 'Free supply gems added to your vault.',
    };
  };

  const handleExchangeGemsForCoins = (
    gemCost: number,
    coinGain: number,
  ): boolean => {
    if (saveRef.current.gems < gemCost) return false;
    soundRef.current?.playClick(true);
    updateSave((prev) =>
      prev.gems >= gemCost
        ? { ...prev, gems: prev.gems - gemCost, coins: prev.coins + coinGain }
        : prev,
    );
    return true;
  };

  const handleExchangeCoinsForGems = (
    coinCost: number,
    gemGain: number,
  ): boolean => {
    if (saveRef.current.coins < coinCost) return false;
    soundRef.current?.playClick(true);
    updateSave((prev) =>
      prev.coins >= coinCost
        ? { ...prev, coins: prev.coins - coinCost, gems: prev.gems + gemGain }
        : prev,
    );
    return true;
  };

  const handleBuyStarterPack = (): ShopActionResult | null => {
    if (saveRef.current.gems < 25) return null;
    soundRef.current?.playStunt();
    updateSave((prev) =>
      prev.gems >= 25
        ? {
            ...prev,
            gems: prev.gems - 25,
            coins: prev.coins + 4500,
            boosters: {
              fuelSaver: prev.boosters.fuelSaver + 1,
              nitroCharge: prev.boosters.nitroCharge + 1,
              coinMagnet: prev.boosters.coinMagnet + 1,
            },
          }
        : prev,
    );
    return {
      title: 'LEONIDA BUNDLE UNLOCKED!',
      detail: '+4,500 Coins and +1x Fuel Saver, Nitro Charge & Coin Magnet.',
    };
  };

  const handleBuyBooster = (
    kind: 'fuelSaver' | 'nitroCharge' | 'coinMagnet',
    coinCost: number,
  ): boolean => {
    if (saveRef.current.coins < coinCost) return false;
    soundRef.current?.playClick(true);
    updateSave((prev) =>
      prev.coins >= coinCost
        ? {
            ...prev,
            coins: prev.coins - coinCost,
            boosters: {
              ...prev.boosters,
              [kind]: prev.boosters[kind] + 1,
            },
          }
        : prev,
    );
    return true;
  };

  const handleRefillTickets = (coinCost: number): boolean => {
    if (
      saveRef.current.tickets >= MAX_TICKETS ||
      saveRef.current.coins < coinCost
    ) {
      return false;
    }
    soundRef.current?.playFuel();
    updateSave((prev) =>
      prev.coins >= coinCost
        ? {
            ...prev,
            coins: prev.coins - coinCost,
            tickets: MAX_TICKETS,
            ticketTimestamp: Date.now(),
          }
        : prev,
    );
    return true;
  };

  const handleOpenChest = (tier: 'bronze' | 'gold'): ShopActionResult | null => {
    const cur = saveRef.current;
    if (tier === 'bronze') {
      if (cur.coins < 600) return null;
      const coinRoll = 800 + Math.floor(Math.random() * 801);
      const gemRoll = 4 + Math.floor(Math.random() * 6);
      soundRef.current?.playStunt();
      updateSave((prev) => ({
        ...prev,
        coins: prev.coins - 600 + coinRoll,
        gems: prev.gems + gemRoll,
      }));
      return {
        title: 'BRONZE CRATE OPENED!',
        detail: `Found +${coinRoll.toLocaleString()} Coins and +${gemRoll} Gems.`,
      };
    } else {
      if (cur.gems < 30) return null;
      const coinRoll = 2500 + Math.floor(Math.random() * 3001);
      soundRef.current?.playStunt();
      updateSave((prev) => ({
        ...prev,
        gems: prev.gems - 30,
        coins: prev.coins + coinRoll,
        boosters: {
          fuelSaver: prev.boosters.fuelSaver + 1,
          nitroCharge: prev.boosters.nitroCharge + 1,
          coinMagnet: prev.boosters.coinMagnet + 1,
        },
      }));
      return {
        title: 'GOLD CHEST OPENED!',
        detail: `Found +${coinRoll.toLocaleString()} Coins plus +1x of all 3 Boosters!`,
      };
    }
  };

  const handleClaimReward = (key: string, coins: number, gems: number) => {
    soundRef.current?.playStunt();
    updateSave((prev) => {
      if (prev.claimedRewards[key]) return prev;
      return {
        ...prev,
        coins: prev.coins + coins,
        gems: prev.gems + gems,
        claimedRewards: { ...prev.claimedRewards, [key]: true },
      };
    });
  };

  const handleUpdateTuning = (next: TuningConfig) => {
    updateSave((prev) => ({ ...prev, tuning: next }));
    worldRef.current?.getPhysics()?.recomputeParams();
  };

  const handleUpdateSettings = (next: GameSettings) => {
    updateSave((prev) => ({ ...prev, settings: next }));
  };

  const activeStage = getStageById(save.selectedStage);
  const activeVehicle = getVehicleById(save.selectedVehicle);

  const openModalFrom = (
    target: Exclude<GameScreen, 'TITLE_MENU' | 'PADDOCK' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'SUMMIT'>,
    origin: 'TITLE_MENU' | 'PADDOCK' | 'PAUSED' | 'GAME_OVER' | 'SUMMIT' = 'TITLE_MENU',
    nextMissionsTab?: 'MISSIONS' | 'SEASON',
    inspectVehicleId?: VehicleId,
  ) => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    if (nextMissionsTab) {
      setMissionsTab(nextMissionsTab);
    }
    if (target === 'GARAGE') {
      setGarageInitialVehicle(inspectVehicleId);
    }
    setReturnScreen(origin);
    setScreen(target);
  };

  return (
    <MotionConfig reducedMotion={save.settings.reducedMotion ? 'always' : 'user'}>
      <div className="relative h-full w-full overflow-hidden bg-slate-950 select-none">
        {/* Isolated Full-Screen 3D WebGL2 Canvas Mount (Never add React children here) */}
        <div ref={worldMountRef} className="absolute inset-0" />

        {/* Home Page (Showroom Only on Rotating Grey Circular Turntable) */}
        {screen === 'TITLE_MENU' && (
          <TitleOverlay
            save={save}
            stage={activeStage}
            vehicle={activeVehicle}
            onEnterPaddock={openPaddock}
            onQuickClimb={() => startRace(undefined, false)}
            onOpenSettings={() => openModalFrom('SETTINGS', 'TITLE_MENU')}
            onToggleMute={toggleMute}
          />
        )}

        {/* First-Run Driver Onboarding Briefing */}
        {screen === 'TITLE_MENU' && !save.tutorialSeen && (
          <FirstRunTutorialOverlay
            onDismiss={() => {
              soundRef.current?.playClick(true);
              updateSave((prev) => ({ ...prev, tutorialSeen: true }));
            }}
          />
        )}

        {/* Dedicated Paddock Configuration Overlay */}
        {screen === 'PADDOCK' && (
          <PaddockModal
            save={save}
            nnState={nnState}
            pendingSamplesCount={pendingSamplesCount}
            nnBusy={nnBusy}
            onBackToShowroom={goHome}
            onUpdateClimbSetup={handleUpdateClimbSetup}
            onSelectStage={(stageId) => {
              soundRef.current?.playClick();
              updateSave((prev) => ({ ...prev, selectedStage: stageId }));
            }}
            onSelectVehicle={handleSelectVehicle}
            onUnlockVehicle={handleUnlockVehicle}
            onSetClimbTire={handleSetClimbTire}
            onSetPaint={handleSetPaint}
            onSetLivery={handleSetLivery}
            onToggleAutoTune={() => {
              soundRef.current?.playClick();
              updateSave((prev) => ({ ...prev, aiAutoTune: !prev.aiAutoTune }));
            }}
            onManualTrain={() => void flushTrainingSamples(true)}
            onResetNn={() => void handleResetNn()}
            onOpenGarage={() => openModalFrom('GARAGE', 'PADDOCK')}
            onOpenUpgrades={() => openModalFrom('UPGRADES', 'PADDOCK')}
            onLaunchClimb={(watchAi) => startRace(undefined, watchAi)}
          />
        )}

        {/* Minimalist Active Climb HUD */}
        {(screen === 'PLAYING' || screen === 'PAUSED') && (
          <GameplayHud
            ref={hudRef}
            muted={save.muted}
            stage={activeStage}
            showHints={save.settings.showControlHints}
            showTouchControls={
              save.settings.touchControlsMode === 'always' ||
              (save.settings.touchControlsMode === 'auto' && touchDetected)
            }
            gamepadActive={gamepadActive}
            aiAutoPilot={aiAutoPilot}
            watchAiMode={watchAiMode}
            cameraMode={cameraMode}
            showGhost={save.settings.showGhost}
            gyroEnabled={save.gyroEnabled}
            onCycleCamera={handleCycleCamera}
            onToggleAiAutoPilot={handleToggleAiAutoPilot}
            onToggleGhost={handleToggleGhost}
            onToggleGyro={() => void handleToggleGyro()}
            onOpenSettings={() => {
              if (screenRef.current === 'PLAYING') {
                pauseRace();
              }
              openModalFrom('SETTINGS', 'PAUSED');
            }}
            onReturnToPaddock={openPaddock}
            onInputChange={handleInputChange}
            onPause={pauseRace}
            onToggleMute={toggleMute}
          />
        )}

        {/* Pause Modal */}
        {screen === 'PAUSED' && (
          <PauseModal
            stageName={activeStage.name}
            touchControlsMode={save.settings.touchControlsMode}
            onCycleTouchControls={() => {
              soundRef.current?.playClick();
              updateSave((prev) => {
                const order = ['auto', 'always', 'off'] as const;
                const nextMode =
                  order[(order.indexOf(prev.settings.touchControlsMode) + 1) % order.length];
                return {
                  ...prev,
                  settings: { ...prev.settings, touchControlsMode: nextMode },
                };
              });
            }}
            onResume={resumeRace}
            onRestart={() => startRace(undefined, watchAiMode)}
            onOpenPaddock={openPaddock}
            onOpenSettings={() => openModalFrom('SETTINGS', 'PAUSED')}
            onGoHome={goHome}
          />
        )}

        {/* Summit Finish Analytics Pop-up */}
        {screen === 'SUMMIT' && summitAnalytics && (
          <SummitModal
            analytics={summitAnalytics}
            onClimbAgain={() => startRace(summitAnalytics.stageId, watchAiMode)}
            onOpenPaddock={openPaddock}
            onGoShowroom={goHome}
          />
        )}

        {/* Game Over Modal */}
        {screen === 'GAME_OVER' && runSummary && (
          <GameOverModal
            summary={runSummary}
            onRetry={() => startRace(undefined, watchAiMode)}
            onOpenPaddock={openPaddock}
            onGoHome={goHome}
          />
        )}

        {/* Interactive 3D Garage Showroom */}
        {screen === 'GARAGE' && (
          <GarageModal
            save={save}
            initialVehicleId={garageInitialVehicle}
            graphicsQuality={save.settings.graphicsQuality}
            onClose={() => {
              soundRef.current?.playClick();
              setGarageInitialVehicle(undefined);
              setScreen(returnScreen);
            }}
            onSelectVehicle={handleSelectVehicle}
            onUnlockVehicle={handleUnlockVehicle}
            onSetPaint={handleSetPaint}
            onSetNeon={handleSetNeon}
            onSetLivery={handleSetLivery}
            onSelectOrUnlockWheel={handleSelectOrUnlockWheel}
            onToggleOrUnlockAccessory={handleToggleOrUnlockAccessory}
            onToggleOrUnlockTuningPart={handleToggleOrUnlockTuningPart}
            onBuyUpgrade={handleBuyUpgrade}
            onOpenUpgrades={() => openModalFrom('UPGRADES', returnScreen)}
          />
        )}

        {/* Mechanical Upgrades Screen */}
        {screen === 'UPGRADES' && (
          <UpgradesModal
            save={save}
            vehicle={activeVehicle}
            onClose={() => {
              soundRef.current?.playClick();
              setScreen(returnScreen);
            }}
            onBuyUpgrade={handleBuyUpgrade}
            onOpenTuning={() => openModalFrom('TUNING', returnScreen)}
          />
        )}

        {/* World Map Stage Selector */}
        {screen === 'WORLD_MAP' && (
          <WorldMapModal
            save={save}
            onClose={() => {
              soundRef.current?.playClick();
              setScreen(returnScreen);
            }}
            onSelectStage={(stageId) => {
              soundRef.current?.playClick();
              if (isStageUnlocked(stageId, save)) {
                updateSave((prev) => ({ ...prev, selectedStage: stageId }));
              }
            }}
            onStartRace={(stageId) => startRace(stageId, false)}
            onOpenEvents={() => openModalFrom('MISSIONS', 'TITLE_MENU', 'SEASON')}
          />
        )}

        {/* Shop Depot */}
        {screen === 'SHOP' && (
          <ShopModal
            save={save}
            onClose={() => {
              soundRef.current?.playClick();
              setScreen(returnScreen);
            }}
            onClaimFreeGems={handleClaimFreeGems}
            onExchangeGemsForCoins={handleExchangeGemsForCoins}
            onExchangeCoinsForGems={handleExchangeCoinsForGems}
            onBuyStarterPack={handleBuyStarterPack}
            onBuyBooster={handleBuyBooster}
            onRefillTickets={handleRefillTickets}
            onOpenChest={handleOpenChest}
          />
        )}

        {/* Missions & Season 12 Wild Roads */}
        {screen === 'MISSIONS' && (
          <MissionsModal
            save={save}
            initialTab={missionsTab}
            onClose={() => {
              soundRef.current?.playClick();
              setScreen(returnScreen);
            }}
            onClaimReward={handleClaimReward}
          />
        )}

        {/* Physics Tuning Bench */}
        {screen === 'TUNING' && (
          <TuningModal
            tuning={save.tuning}
            onUpdateTuning={handleUpdateTuning}
            onResetSave={() => {
              const fresh = resetSaveData();
              setSave(fresh);
            }}
            onClose={() => {
              soundRef.current?.playClick();
              setScreen(returnScreen);
            }}
          />
        )}

        {/* Settings & Controls */}
        {screen === 'SETTINGS' && (
          <SettingsModal
            settings={save.settings}
            muted={save.muted}
            onUpdateSettings={handleUpdateSettings}
            onToggleMute={toggleMute}
            onReplayTutorial={() => {
              soundRef.current?.playClick();
              updateSave((prev) => ({ ...prev, tutorialSeen: false }));
              setScreen('TITLE_MENU');
            }}
            onClose={() => {
              soundRef.current?.playClick();
              setScreen(returnScreen);
            }}
          />
        )}

        {/* WebGL Context Lost Recovery Banner */}
        {contextLost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-6 text-center text-white">
            <div className="max-w-sm rounded-2xl border border-rose-500/50 bg-slate-900 p-6">
              <h2 className="font-display text-xl font-black text-rose-300 uppercase">
                GRAPHICS CONTEXT INTERRUPTED
              </h2>
              <p className="mt-2 text-xs text-slate-300">
                WebGL lost hardware graphics access. Reload the page to restore the 3D engine safely.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-4 rounded-xl bg-amber-400 px-5 py-2.5 font-display text-sm font-black text-slate-950 uppercase"
              >
                RELOAD GAME
              </button>
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
