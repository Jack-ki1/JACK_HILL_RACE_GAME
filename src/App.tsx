import { useCallback, useEffect, useRef, useState } from 'react';
import { GameOverModal, PauseModal } from './components/PauseAndGameOverModal';
import { GameplayHud, GameplayHudHandle } from './components/GameplayHud';
import { GarageModal } from './components/GarageModal';
import { MissionsModal } from './components/MissionsModal';
import { ShopActionResult, ShopModal } from './components/ShopModal';
import { TitleOverlay } from './components/TitleOverlay';
import { TuningModal } from './components/TuningModal';
import { UpgradesModal } from './components/UpgradesModal';
import { WorldMapModal } from './components/WorldMapModal';
import { SoundEngine } from './game/audio';
import {
  getStageById,
  getUpgradeCost,
  getVehicleById,
  MAX_TICKETS,
  MAX_UPGRADE_LEVEL,
  START_X,
  WHEEL_STYLES,
} from './game/constants';
import { HillClimbPhysics } from './game/physics';
import {
  isStageUnlocked,
  loadSaveData,
  persistSaveData,
  regenTickets,
  resetSaveData,
} from './game/storage';
import { WorldSceneController } from './game/worldScene';
import {
  GameScreen,
  InputState,
  RunSummary,
  SaveData,
  StageId,
  StuntCallout,
  TuningConfig,
  UpgradeKey,
  VehicleId,
  WheelStyleId,
} from './types/game';

export default function App() {
  const worldMountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<WorldSceneController | null>(null);
  const hudRef = useRef<GameplayHudHandle>(null);
  const soundRef = useRef<SoundEngine | null>(null);

  const [save, setSave] = useState<SaveData>(() => loadSaveData());
  const [screen, setScreen] = useState<GameScreen>('TITLE_MENU');
  const [returnScreen, setReturnScreen] = useState<'TITLE_MENU' | 'PAUSED' | 'GAME_OVER'>('TITLE_MENU');
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [contextLost, setContextLost] = useState(false);

  const saveRef = useRef(save);
  const screenRef = useRef(screen);
  const stuntRef = useRef<StuntCallout | null>(null);
  const stuntSeqRef = useRef(1);
  const crashTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    saveRef.current = save;
    persistSaveData(save);
    soundRef.current?.setMuted(save.muted);
  }, [save]);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const updateSave = useCallback((updater: (prev: SaveData) => SaveData) => {
    setSave((prev) => updater(prev));
  }, []);

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
          sound.updateEngine(
            !s.crashed,
            s.rpm,
            s.throttle,
            s.nitroActive,
            curSave.selectedVehicle,
          );

          if (stuntRef.current) {
            stuntRef.current.remainingSec -= dt;
            if (stuntRef.current.remainingSec <= 0) {
              stuntRef.current = null;
            }
          }

          const dist = Math.max(0, Math.floor(s.x - START_X));
          const speedMs = Math.hypot(s.vx, s.vy);

          hudRef.current?.updateLive({
            distanceMeters: dist,
            bestMeters: Math.floor(curSave.stageBests[curSave.selectedStage] ?? 0),
            fuelPct: s.fuel,
            runCoins: s.runCoins,
            totalCoins: curSave.coins,
            gems: curSave.gems,
            speedKmh: Math.round(speedMs * 3.6),
            rpmNorm: s.rpm,
            boostNorm: s.nitroActive ? 0.92 : s.nitroEnergy / 100,
            nitroEnergy: s.nitroEnergy,
            gear: s.gear,
            airborne: !s.groundedR && !s.groundedF,
            callout: stuntRef.current,
          });
        } else {
          sound.updateEngine(false, 0, 0, false);
        }
      },
      () => setContextLost(true),
    );

    const initialSave = saveRef.current;
    const initialStage = getStageById(initialSave.selectedStage);
    const initialVehicle = getVehicleById(initialSave.selectedVehicle);
    world.applyStageEnvironment(initialStage);
    world.rebuildVehicleModel(
      initialVehicle,
      initialSave.vehiclePaints[initialVehicle.id] || initialVehicle.defaultPaintId,
      initialSave.vehicleWheels[initialVehicle.id] || 'steel',
      initialStage.headlightsOn,
    );
    world.setMode('TITLE');

    worldRef.current = world;

    return () => {
      if (crashTimeoutRef.current !== null) {
        clearTimeout(crashTimeoutRef.current);
      }
      sound.updateEngine(false, 0, 0, false);
      world.dispose();
      worldRef.current = null;
    };
  }, []);

  // Sync hero background vehicle/stage whenever edited from menus
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    if (screen === 'TITLE_MENU' || screen === 'WORLD_MAP' || screen === 'GARAGE') {
      const stage = getStageById(save.selectedStage);
      const vehicle = getVehicleById(save.selectedVehicle);
      world.applyStageEnvironment(stage);
      world.rebuildVehicleModel(
        vehicle,
        save.vehiclePaints[vehicle.id] || vehicle.defaultPaintId,
        save.vehicleWheels[vehicle.id] || 'steel',
        stage.headlightsOn,
      );
    }
  }, [
    screen,
    save.selectedStage,
    save.selectedVehicle,
    save.vehiclePaints,
    save.vehicleWheels,
  ]);

  const startRace = useCallback((stageOverride?: StageId) => {
    soundRef.current?.unlock();
    soundRef.current?.playClick(true);

    if (crashTimeoutRef.current !== null) {
      clearTimeout(crashTimeoutRef.current);
      crashTimeoutRef.current = null;
    }

    const cur = saveRef.current;
    const targetStageId =
      stageOverride && isStageUnlocked(stageOverride, cur)
        ? stageOverride
        : cur.selectedStage;
    const stage = getStageById(targetStageId);
    const vehicle = getVehicleById(cur.selectedVehicle);

    const hasBoosters =
      cur.boosters.fuelSaver > 0 ||
      cur.boosters.nitroCharge > 0 ||
      cur.boosters.coinMagnet > 0;

    // Deduct ticket (when available) & arm owned boosters for this run
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

    stuntRef.current = null;
    setRunSummary(null);
    setScreen('PLAYING');
    screenRef.current = 'PLAYING';

    worldRef.current?.setInput({
      gas: false,
      brake: false,
      nitro: false,
      handbrake: false,
    });

    worldRef.current?.startRun(nextSave, stage, vehicle, hasBoosters, {
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
      onLanding: (intensity) => {
        soundRef.current?.playLanding(intensity);
      },
      onGearShift: () => {
        soundRef.current?.playGearShift();
      },
      onCrash: (reason) => {
        soundRef.current?.playCrash();
        const physics = worldRef.current?.getPhysics();
        if (!physics) return;

        const s = physics.state;
        const distMeters = Math.max(0, Math.floor(s.x - START_X));
        const coinsEarned = s.runCoins + Math.floor(distMeters * 0.45);
        const prevBest = Math.floor(saveRef.current.stageBests[stage.id] ?? 0);
        const isNewBest = distMeters > prevBest;
        const nextBest = Math.max(prevBest, distMeters);

        setSave((prev) => ({
          ...prev,
          coins: prev.coins + coinsEarned,
          stageBests: {
            ...prev.stageBests,
            [stage.id]: Math.max(prev.stageBests[stage.id] ?? 0, distMeters),
          },
          totals: {
            distanceMeters: prev.totals.distanceMeters + distMeters,
            coinsCollected: prev.totals.coinsCollected + coinsEarned,
            flipsCompleted: prev.totals.flipsCompleted + s.flips,
            bestSingleRunMeters: Math.max(
              prev.totals.bestSingleRunMeters,
              distMeters,
            ),
            runsCompleted: prev.totals.runsCompleted + 1,
          },
        }));

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
          });
          setScreen('GAME_OVER');
        }, 900);
      },
    });
  }, []);

  const goHome = useCallback(() => {
    soundRef.current?.playClick();
    if (crashTimeoutRef.current !== null) {
      clearTimeout(crashTimeoutRef.current);
      crashTimeoutRef.current = null;
    }
    worldRef.current?.setMode('TITLE');
    setRunSummary(null);
    setScreen('TITLE_MENU');
  }, []);

  const pauseRace = useCallback(() => {
    if (screenRef.current !== 'PLAYING') return;
    soundRef.current?.playClick();
    worldRef.current?.setMode('PAUSED');
    worldRef.current?.setInput({
      gas: false,
      brake: false,
      nitro: false,
      handbrake: false,
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

  const handleInputChange = useCallback((partial: Partial<InputState>) => {
    soundRef.current?.unlock();
    worldRef.current?.setInput(partial);
  }, []);

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
          startRace();
        }
      } else if (e.code === 'Enter') {
        if (cur === 'TITLE_MENU' || cur === 'GAME_OVER') {
          e.preventDefault();
          startRace();
        } else if (cur === 'PAUSED') {
          e.preventDefault();
          resumeRace();
        }
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        if (cur === 'PLAYING') {
          pauseRace();
        } else if (cur === 'PAUSED') {
          resumeRace();
        } else if (
          cur === 'GARAGE' ||
          cur === 'UPGRADES' ||
          cur === 'WORLD_MAP' ||
          cur === 'SHOP' ||
          cur === 'MISSIONS' ||
          cur === 'TUNING'
        ) {
          setScreen(returnScreen);
        }
      } else if (e.code === 'KeyR') {
        if (cur === 'PLAYING' || cur === 'PAUSED' || cur === 'GAME_OVER') {
          startRace();
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
      }
    };

    const onBlur = () => {
      worldRef.current?.setInput({
        gas: false,
        brake: false,
        nitro: false,
        handbrake: false,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [pauseRace, resumeRace, returnScreen, startRace, toggleMute]);

  // Garage / Upgrades / Shop / Missions callbacks
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
      title: 'FRONTIER BUNDLE UNLOCKED!',
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

  const activeStage = getStageById(save.selectedStage);
  const activeVehicle = getVehicleById(save.selectedVehicle);

  const openModalFrom = (
    target: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>,
    origin: 'TITLE_MENU' | 'PAUSED' | 'GAME_OVER' = 'TITLE_MENU',
  ) => {
    soundRef.current?.unlock();
    soundRef.current?.playClick();
    setReturnScreen(origin);
    setScreen(target);
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950 select-none">
      {/* Isolated Full-Screen 3D WebGL2 Canvas Mount (Never add React children here) */}
      <div ref={worldMountRef} className="absolute inset-0" />

      {/* Title Menu Overlay */}
      {screen === 'TITLE_MENU' && (
        <TitleOverlay
          save={save}
          stage={activeStage}
          vehicle={activeVehicle}
          onPlay={() => startRace()}
          onOpenScreen={(s) => openModalFrom(s, 'TITLE_MENU')}
          onToggleMute={toggleMute}
        />
      )}

      {/* Active Gameplay HUD */}
      {(screen === 'PLAYING' || screen === 'PAUSED') && (
        <GameplayHud
          ref={hudRef}
          muted={save.muted}
          stageName={activeStage.name}
          onInputChange={handleInputChange}
          onPause={pauseRace}
          onToggleMute={toggleMute}
        />
      )}

      {/* Pause Modal */}
      {screen === 'PAUSED' && (
        <PauseModal
          stageName={activeStage.name}
          onResume={resumeRace}
          onRestart={() => startRace()}
          onOpenGarage={() => openModalFrom('GARAGE', 'PAUSED')}
          onGoHome={goHome}
        />
      )}

      {/* Game Over Modal */}
      {screen === 'GAME_OVER' && runSummary && (
        <GameOverModal
          summary={runSummary}
          onRetry={() => startRace()}
          onOpenGarage={() => openModalFrom('GARAGE', 'GAME_OVER')}
          onGoHome={goHome}
        />
      )}

      {/* Interactive 3D Garage Showroom */}
      {screen === 'GARAGE' && (
        <GarageModal
          save={save}
          onClose={() => {
            soundRef.current?.playClick();
            setScreen(returnScreen);
          }}
          onSelectVehicle={handleSelectVehicle}
          onUnlockVehicle={handleUnlockVehicle}
          onSetPaint={handleSetPaint}
          onSelectOrUnlockWheel={handleSelectOrUnlockWheel}
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
        />
      )}

      {/* World Map Stage Selector */}
      {screen === 'WORLD_MAP' && (
        <WorldMapModal
          save={save}
          onClose={() => {
            soundRef.current?.playClick();
            setScreen('TITLE_MENU');
          }}
          onSelectStage={(stageId) => {
            soundRef.current?.playClick();
            if (isStageUnlocked(stageId, save)) {
              updateSave((prev) => ({ ...prev, selectedStage: stageId }));
            }
          }}
          onStartRace={(stageId) => startRace(stageId)}
          onOpenEvents={() => openModalFrom('MISSIONS', 'TITLE_MENU')}
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
  );
}
