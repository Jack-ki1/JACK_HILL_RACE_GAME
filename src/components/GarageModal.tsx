import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
  Lightbulb,
  Lock,
  Paintbrush,
  Shield,
  Sparkles,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  ACCESSORY_DEFS,
  getUpgradeCost,
  LIVERY_DEFS,
  MAX_UPGRADE_LEVEL,
  NEON_COLORS,
  PAINT_SWATCHES,
  UPGRADE_DEFS,
  VEHICLES,
  WHEEL_STYLES,
} from '../game/constants';
import {
  GarageCameraPreset,
  GarageSceneController,
} from '../game/garageScene';
import {
  GraphicsQuality,
  LiveryId,
  NeonColorId,
  SaveData,
  UpgradeKey,
  VehicleAccessoryId,
  VehicleId,
  WheelStyleId,
} from '../types/game';
import {
  CoinIcon,
  GemIcon,
  UpgradePartIcon,
  VehicleSilhouetteIcon,
} from './GameIcons';

interface GarageModalProps {
  save: SaveData;
  initialVehicleId?: VehicleId;
  graphicsQuality: GraphicsQuality;
  onClose: () => void;
  onSelectVehicle: (id: VehicleId) => void;
  onUnlockVehicle: (id: VehicleId) => void;
  onSetPaint: (vehicleId: VehicleId, paintId: string) => void;
  onSetNeon: (vehicleId: VehicleId, neonId: NeonColorId) => void;
  onSetLivery: (vehicleId: VehicleId, liveryId: LiveryId) => void;
  onSelectOrUnlockWheel: (vehicleId: VehicleId, wheelId: WheelStyleId) => void;
  onToggleOrUnlockAccessory: (vehicleId: VehicleId, accId: VehicleAccessoryId) => void;
  onBuyUpgrade: (vehicleId: VehicleId, key: UpgradeKey) => void;
  onOpenUpgrades: () => void;
}

type GarageDrawer = 'PAINT' | 'NEON' | 'LIVERY' | 'WHEELS' | 'PARTS' | null;

export const GarageModal: React.FC<GarageModalProps> = ({
  save,
  initialVehicleId,
  graphicsQuality,
  onClose,
  onSelectVehicle,
  onUnlockVehicle,
  onSetPaint,
  onSetNeon,
  onSetLivery,
  onSelectOrUnlockWheel,
  onToggleOrUnlockAccessory,
  onBuyUpgrade,
  onOpenUpgrades,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<GarageSceneController | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [inspectedId, setInspectedId] = useState<VehicleId>(
    initialVehicleId ?? save.selectedVehicle,
  );
  const [drawer, setDrawer] = useState<GarageDrawer>(null);
  const [camPreset, setCamPreset] = useState<GarageCameraPreset>('hero');
  const [lightsOn, setLightsOn] = useState<boolean>(true);

  useEffect(() => {
    if (initialVehicleId) {
      setInspectedId(initialVehicleId);
    }
  }, [initialVehicleId]);

  const vehicle = VEHICLES.find((v) => v.id === inspectedId) ?? VEHICLES[0];
  const isUnlocked = save.unlockedVehicles[vehicle.id];
  const isEquipped = save.selectedVehicle === vehicle.id;
  const activePaintId = save.vehiclePaints[vehicle.id] || vehicle.defaultPaintId;
  const activeWheelId = save.vehicleWheels[vehicle.id] || 'steel';
  const activeAccessories = save.vehicleAccessories?.[vehicle.id] ?? ['lightbar'];
  const accessoriesKey = activeAccessories.join(',');
  const activeNeonId = save.vehicleNeons?.[vehicle.id] ?? 'off';
  const activeLiveryId = save.vehicleLiveries?.[vehicle.id] ?? 'clean';
  const levels = save.upgrades[vehicle.id];

  const unlockedCount = VEHICLES.filter((v) => save.unlockedVehicles[v.id]).length;

  // Dynamic Class Grade & Performance Ratings out of 400
  const totalLevel =
    (levels.engine ?? 0) +
    (levels.suspension ?? 0) +
    (levels.tires ?? 0) +
    (levels.awd ?? 0) +
    (levels.fuel ?? 0);

  const powerScore = Math.min(
    400,
    Math.round(145 * vehicle.powerMult + (levels.engine ?? 0) * 19),
  );
  const suspScore = Math.min(
    400,
    Math.round(160 * vehicle.springMult + (levels.suspension ?? 0) * 20),
  );
  const gripScore = Math.min(
    400,
    Math.round(150 * vehicle.gripMult + (levels.tires ?? 0) * 20 + (levels.awd ?? 0) * 4),
  );
  const fuelScore = Math.min(
    400,
    Math.round(170 + (levels.fuel ?? 0) * 23),
  );
  const avgScore = Math.round((powerScore + suspScore + gripScore + fuelScore) / 4);
  const classGrade =
    avgScore >= 330 ? 'S' : avgScore >= 265 ? 'A' : avgScore >= 205 ? 'B' : 'C';
  const gradeColor =
    classGrade === 'S'
      ? 'border-amber-300 bg-amber-500/25 text-amber-300'
      : classGrade === 'A'
        ? 'border-violet-400 bg-violet-500/25 text-violet-200'
        : classGrade === 'B'
          ? 'border-sky-400 bg-sky-500/25 text-sky-200'
          : 'border-slate-400 bg-slate-700/60 text-slate-200';

  const specBars = [
    { label: 'POWER', score: powerScore, color: '#3b82f6' },
    { label: 'SUSPENSION', score: suspScore, color: '#f59e0b' },
    { label: 'GRIP', score: gripScore, color: '#22c55e' },
    { label: 'FUEL', score: fuelScore, color: '#ef4444' },
  ];

  // Mount dedicated 3D showroom turntable controller
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const ctrl = new GarageSceneController(el);
    ctrl.applyGraphicsQuality(graphicsQuality);
    ctrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, [graphicsQuality]);

  // Update 3D turntable whenever inspected vehicle, paint, wheel, accessories, neon, or livery change
  useEffect(() => {
    ctrlRef.current?.setVehicle(
      inspectedId,
      activePaintId,
      activeWheelId,
      true,
      activeAccessories,
      activeNeonId,
      activeLiveryId,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectedId, activePaintId, activeWheelId, accessoriesKey, activeNeonId, activeLiveryId]);

  const selectCameraPreset = (preset: GarageCameraPreset) => {
    setCamPreset(preset);
    ctrlRef.current?.setCameraPreset(preset);
  };

  const handleToggleLights = () => {
    setLightsOn((prev) => {
      const next = !prev;
      ctrlRef.current?.setHeadlights(next);
      return next;
    });
  };

  const scrollCarousel = (dir: -1 | 1) => {
    carouselRef.current?.scrollBy({ left: dir * 220, behavior: 'smooth' });
  };

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-slate-950 text-white">
      {/* Fullscreen Isolated 3D Showroom Canvas */}
      <div
        ref={mountRef}
        className="touch-gameplay absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {/* Top Header Bar */}
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-3 p-4 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to Menu"
            className="panel-bevel flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white transition hover:border-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl leading-none font-extrabold tracking-wider uppercase italic">
              GARAGE
            </h1>
            <p className="mt-0.5 text-xs font-semibold tracking-widest text-slate-300 uppercase">
              COLLECTION {unlockedCount}/{VEHICLES.length}
            </p>
          </div>
        </div>

        {/* Center Vehicle Title Banner */}
        <div className="hidden flex-col items-center text-center md:flex">
          <div className="font-display text-3xl font-extrabold tracking-wider text-white uppercase italic drop-shadow">
            {vehicle.name}
          </div>
          <div className="text-[11px] font-bold tracking-[0.28em] text-sky-300 uppercase">
            {vehicle.vehicleClass} · DRAG TO SPIN 360°
          </div>
        </div>

        {/* Top-Right Currencies */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5">
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <div className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5">
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Zone: Left Vehicle Spec & Quick-Tune Card + Right Customization Rail */}
      <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left Spec Sheet + Quick Upgrade Controls */}
        <div className="panel-bevel pointer-events-auto hidden w-72 flex-col gap-2.5 rounded-2xl border border-white/15 p-3.5 sm:flex">
          {/* Spec Sheet Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <div className="font-display text-xl leading-none font-extrabold tracking-wide text-white uppercase italic">
                {vehicle.name}
              </div>
              <div className="font-mono-num mt-0.5 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                LEVEL {totalLevel} · {vehicle.id === 'superbike' ? 'RWD' : '4WD'}
              </div>
            </div>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg border font-display text-xl font-extrabold italic ${gradeColor}`}
            >
              {classGrade}
            </div>
          </div>

          {/* 4 Segmented Vehicle Performance Bars */}
          <div className="flex flex-col gap-1.5">
            {specBars.map((bar) => (
              <div key={bar.label} className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider">
                  <span className="text-slate-300">{bar.label}</span>
                  <span className="font-mono-num text-white">{bar.score} / 400</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.round((bar.score / 400) * 100)}%`,
                      backgroundColor: bar.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[10px] font-bold">
            <div className="rounded-lg border border-white/10 bg-[#111923] px-2 py-1 text-slate-300">
              TOP SPEED:{' '}
              <span className="font-mono-num text-white">
                {Math.round(vehicle.topSpeedMs * 3.6 * (1 + 0.045 * (levels.engine ?? 0)))} km/h
              </span>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#111923] px-2 py-1 text-slate-300">
              AIR CTRL:{' '}
              <span className="font-mono-num text-sky-300">
                {vehicle.airControlMult.toFixed(2)}x
              </span>
            </div>
          </div>

          {/* Quick Mechanical Part Rows */}
          <div className="mt-0.5 flex flex-col gap-1.5 border-t border-white/10 pt-2">
            {UPGRADE_DEFS.map((def) => {
              const lv = levels[def.key] ?? 0;
              const cost = getUpgradeCost(def.key, lv);
              const maxed = lv >= MAX_UPGRADE_LEVEL;
              const canAfford = isUnlocked && !maxed && save.coins >= cost;
              return (
                <div
                  key={def.key}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900/90 px-2 py-1.5"
                >
                  <UpgradePartIcon part={def.key} className="h-6 w-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase">
                      <span className="truncate text-white">{def.name}</span>
                      <span className="font-mono-num text-amber-300">
                        {lv}/{MAX_UPGRADE_LEVEL}
                      </span>
                    </div>
                  </div>
                  {isUnlocked && (
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onBuyUpgrade(vehicle.id, def.key)}
                      title={maxed ? 'Max Level' : `Upgrade (${cost} coins)`}
                      className={`rounded px-2 py-0.5 text-[10px] font-extrabold transition ${
                        maxed
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : canAfford
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {maxed ? 'MAX' : `+${cost}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Customization Actions & Slide-out Drawer */}
        <div className="pointer-events-auto ml-auto flex items-center gap-3">
          {drawer === 'PAINT' && (
            <div className="panel-bevel w-60 rounded-2xl border border-white/20 p-3.5">
              <div className="mb-2.5 font-display text-xs font-extrabold tracking-widest text-amber-300 uppercase italic">
                SELECT FINISH
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PAINT_SWATCHES.map((sw) => {
                  const selected = activePaintId === sw.id;
                  return (
                    <button
                      key={sw.id}
                      type="button"
                      onClick={() => onSetPaint(vehicle.id, sw.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs font-semibold transition ${
                        selected
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : 'border-white/10 bg-slate-900 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-white/40"
                        style={{ backgroundColor: sw.primary }}
                      />
                      <span className="truncate">{sw.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {drawer === 'NEON' && (
            <div className="panel-bevel w-64 rounded-2xl border border-white/20 p-3.5">
              <div className="mb-2.5 font-display text-xs font-extrabold tracking-widest text-pink-300 uppercase italic">
                UNDERGLOW NEON KIT
              </div>
              <div className="grid grid-cols-2 gap-2">
                {NEON_COLORS.map((nc) => {
                  const selected = activeNeonId === nc.id;
                  return (
                    <button
                      key={nc.id}
                      type="button"
                      onClick={() => onSetNeon(vehicle.id, nc.id)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs font-semibold transition ${
                        selected
                          ? 'border-pink-400 bg-pink-500/20 text-white'
                          : 'border-white/10 bg-slate-900 text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <span
                        className="h-4 w-4 shrink-0 rounded-full border border-white/40"
                        style={{
                          backgroundColor: nc.id === 'off' ? '#1e293b' : nc.hex,
                          boxShadow: nc.id === 'off' ? undefined : `0 0 8px ${nc.hex}`,
                        }}
                      />
                      <span className="truncate">{nc.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {drawer === 'LIVERY' && (
            <div className="panel-bevel w-72 rounded-2xl border border-white/20 p-3.5">
              <div className="mb-2.5 font-display text-xs font-extrabold tracking-widest text-cyan-300 uppercase italic">
                LEONIDA LIVERIES
              </div>
              <div className="frontier-scroll flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1">
                {LIVERY_DEFS.map((lv) => {
                  const selected = activeLiveryId === lv.id;
                  const swatchBg =
                    lv.id === 'sticker_bomb'
                      ? 'linear-gradient(135deg, #ff2e93 0%, #22d3ee 34%, #facc15 68%, #a3e635 100%)'
                      : lv.id === 'viper_stripe'
                        ? 'linear-gradient(90deg, #0f172a 0%, #0f172a 20%, #ffffff 22%, #ef4444 30%, #ef4444 45%, #0f172a 47%, #0f172a 53%, #ef4444 55%, #ef4444 70%, #ffffff 78%, #0f172a 80%, #0f172a 100%)'
                        : lv.id === 'vice_stripes'
                          ? 'linear-gradient(90deg, #ec4899 0%, #ec4899 45%, #22d3ee 55%, #22d3ee 100%)'
                          : lv.id === 'carbon_hood'
                            ? '#1f2937'
                            : lv.id === 'leonida_interceptor'
                              ? 'linear-gradient(180deg, #f8fafc 0%, #0f172a 100%)'
                              : lv.id === 'sunset_rally'
                                ? 'linear-gradient(135deg, #f59e0b 0%, #fb7185 100%)'
                                : '#475569';
                  return (
                    <button
                      key={lv.id}
                      type="button"
                      onClick={() => onSetLivery(vehicle.id, lv.id)}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
                        selected
                          ? 'border-cyan-400 bg-cyan-500/20 text-white'
                          : 'border-white/15 bg-slate-900 text-slate-200 hover:border-white/35'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">{lv.name}</div>
                        <div className="truncate text-[10px] text-slate-400">{lv.desc}</div>
                      </div>
                      <span
                        className="h-5 w-6 shrink-0 rounded border border-white/35"
                        style={{ background: swatchBg }}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {drawer === 'WHEELS' && (
            <div className="panel-bevel w-64 rounded-2xl border border-white/20 p-3.5">
              <div className="mb-2.5 font-display text-xs font-extrabold tracking-widest text-sky-300 uppercase italic">
                WHEEL &amp; RIM STYLES
              </div>
              <div className="flex flex-col gap-2">
                {WHEEL_STYLES.map((ws) => {
                  const owned = save.unlockedWheels[ws.id];
                  const equipped = activeWheelId === ws.id;
                  const canBuy = save.coins >= ws.price;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => onSelectOrUnlockWheel(vehicle.id, ws.id)}
                      disabled={!owned && !canBuy}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-bold transition ${
                        equipped
                          ? 'border-sky-400 bg-sky-500/20 text-white'
                          : owned || canBuy
                            ? 'border-white/15 bg-slate-900 text-slate-200 hover:border-white/35'
                            : 'border-white/5 bg-slate-900/50 text-slate-500'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border-2"
                          style={{
                            backgroundColor: ws.tireColor,
                            borderColor: ws.rimColor,
                          }}
                        />
                        {ws.name}
                      </span>
                      {equipped ? (
                        <span className="text-sky-300">EQUIPPED</span>
                      ) : owned ? (
                        <span className="text-emerald-300">EQUIP</span>
                      ) : (
                        <span className="flex items-center gap-1 text-amber-300">
                          <CoinIcon className="h-3.5 w-3.5" />
                          {ws.price}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {drawer === 'PARTS' && (
            <div className="panel-bevel w-68 rounded-2xl border border-white/20 p-3.5">
              <div className="mb-2.5 font-display text-xs font-extrabold tracking-widest text-orange-300 uppercase italic">
                3D TRAIL ACCESSORIES
              </div>
              <div className="flex flex-col gap-2">
                {ACCESSORY_DEFS.map((acc) => {
                  const owned = save.unlockedAccessories?.[acc.id] ?? false;
                  const equipped = activeAccessories.includes(acc.id);
                  const canBuy = save.coins >= acc.price;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onToggleOrUnlockAccessory(vehicle.id, acc.id)}
                      disabled={!owned && !canBuy}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition ${
                        equipped
                          ? 'border-orange-400 bg-orange-500/20 text-white'
                          : owned || canBuy
                            ? 'border-white/15 bg-slate-900 text-slate-200 hover:border-white/35'
                            : 'border-white/5 bg-slate-900/50 text-slate-500'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white">{acc.name}</div>
                        <div className="truncate text-[10px] text-slate-400">
                          {acc.desc}
                        </div>
                      </div>
                      {equipped ? (
                        <span className="shrink-0 text-[10px] font-extrabold text-orange-300">
                          ON
                        </span>
                      ) : owned ? (
                        <span className="shrink-0 text-[10px] font-extrabold text-emerald-300">
                          EQUIP
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-amber-300">
                          <CoinIcon className="h-3.5 w-3.5" />
                          {acc.price}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Vertical Buttons */}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'PAINT' ? null : 'PAINT'))}
              className={`panel-bevel flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                drawer === 'PAINT'
                  ? 'border-amber-400 text-amber-200'
                  : 'border-white/20 text-slate-200 hover:border-white/40'
              }`}
            >
              <Paintbrush className="h-4 w-4 text-amber-300" />
              <span className="font-display tracking-wider italic">PAINT</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'NEON' ? null : 'NEON'))}
              className={`panel-bevel flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                drawer === 'NEON'
                  ? 'border-pink-400 text-pink-200'
                  : 'border-white/20 text-slate-200 hover:border-white/40'
              }`}
            >
              <Zap className="h-4 w-4 text-pink-400" />
              <span className="font-display tracking-wider italic">NEON</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'LIVERY' ? null : 'LIVERY'))}
              className={`panel-bevel flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                drawer === 'LIVERY'
                  ? 'border-cyan-400 text-cyan-200'
                  : 'border-white/20 text-slate-200 hover:border-white/40'
              }`}
            >
              <Layers className="h-4 w-4 text-cyan-300" />
              <span className="font-display tracking-wider italic">LIVERY</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'WHEELS' ? null : 'WHEELS'))}
              className={`panel-bevel flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                drawer === 'WHEELS'
                  ? 'border-sky-400 text-sky-200'
                  : 'border-white/20 text-slate-200 hover:border-white/40'
              }`}
            >
              <Sparkles className="h-4 w-4 text-sky-300" />
              <span className="font-display tracking-wider italic">WHEELS</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'PARTS' ? null : 'PARTS'))}
              className={`panel-bevel flex w-20 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-[11px] font-bold transition ${
                drawer === 'PARTS'
                  ? 'border-orange-400 text-orange-200'
                  : 'border-white/20 text-slate-200 hover:border-white/40'
              }`}
            >
              <Shield className="h-4 w-4 text-orange-300" />
              <span className="font-display tracking-wider italic">PARTS</span>
            </button>

            <button
              type="button"
              onClick={onOpenUpgrades}
              className="panel-bevel flex w-20 flex-col items-center gap-1 rounded-xl border border-white/20 px-2 py-2 text-[11px] font-bold text-slate-200 transition hover:border-emerald-400"
            >
              <Wrench className="h-4 w-4 text-emerald-300" />
              <span className="font-display tracking-wider italic">UPGRADE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Vehicle Action + 5-Vehicle Selector Carousel */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-2.5 p-4 pt-2 sm:px-6">
        {/* Compact Showroom Camera & Rig Inspection Strip */}
        <div className="panel-bevel pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 self-center rounded-xl border border-white/15 px-2.5 py-1.5">
          <Camera className="mr-1 hidden h-3.5 w-3.5 text-sky-300 sm:block" />
          {(
            [
              { id: 'hero', label: '3/4 HERO' },
              { id: 'profile', label: 'PROFILE' },
              { id: 'front', label: 'FRONT' },
              { id: 'rear', label: 'REAR' },
              { id: 'cockpit', label: 'COCKPIT' },
              { id: 'wheels', label: 'SHOCKS' },
            ] as const
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectCameraPreset(preset.id)}
              className={`rounded-lg px-2.5 py-1 font-display text-[11px] font-bold tracking-wider uppercase transition ${
                camPreset === preset.id
                  ? 'bg-sky-500/25 text-sky-200 ring-1 ring-sky-400/70'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <span className="mx-1 h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={() => ctrlRef.current?.triggerBounce()}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-slate-900 px-2.5 py-1 font-display text-[11px] font-bold tracking-wider text-amber-200 uppercase transition hover:border-amber-400"
          >
            <ArrowDownUp className="h-3.5 w-3.5 text-amber-300" />
            TEST SHOCKS
          </button>

          <button
            type="button"
            onClick={handleToggleLights}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-display text-[11px] font-bold tracking-wider uppercase transition ${
              lightsOn
                ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                : 'border-white/15 bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            LIGHTS
          </button>
        </div>

        {/* Selected Vehicle CTA Row */}
        <div className="panel-bevel pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 px-4 py-2.5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-extrabold text-white uppercase italic">
                {vehicle.name}
              </span>
              <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold tracking-wider text-sky-300 uppercase">
                {vehicle.vehicleClass}
              </span>
            </div>
            <p className="truncate text-xs text-slate-300">{vehicle.tagline}</p>
          </div>

          {isUnlocked ? (
            <button
              type="button"
              onClick={() => {
                onSelectVehicle(vehicle.id);
                onClose();
              }}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-sm font-extrabold tracking-wider uppercase italic shadow-lg transition ${
                isEquipped
                  ? 'border border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
              }`}
            >
              <Check className="h-4 w-4" />
              {isEquipped ? 'EQUIPPED · DONE' : 'SELECT VEHICLE'}
            </button>
          ) : (
            <button
              type="button"
              disabled={save.coins < vehicle.price}
              onClick={() => onUnlockVehicle(vehicle.id)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-sm font-extrabold tracking-wider uppercase italic shadow-lg transition ${
                save.coins >= vehicle.price
                  ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105'
                  : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-400'
              }`}
            >
              <CoinIcon className="h-4 w-4" />
              UNLOCK · {vehicle.price.toLocaleString()}
            </button>
          )}
        </div>

        {/* Bottom 5-Vehicle Carousel */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollCarousel(-1)}
            aria-label="Scroll vehicles left"
            className="panel-bevel flex h-20 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 text-slate-300 hover:border-white/40 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            ref={carouselRef}
            className="frontier-scroll flex flex-1 gap-2.5 overflow-x-auto pb-1"
          >
            {VEHICLES.map((v) => {
              const unlocked = save.unlockedVehicles[v.id];
              const equipped = save.selectedVehicle === v.id;
              const inspected = inspectedId === v.id;
              const paintHex =
                PAINT_SWATCHES.find((p) => p.id === save.vehiclePaints[v.id])
                  ?.primary ?? '#d92b1e';

              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    setInspectedId(v.id);
                    if (unlocked) onSelectVehicle(v.id);
                  }}
                  className={`panel-bevel relative flex min-w-[160px] flex-1 flex-col items-center justify-between rounded-xl border p-2.5 transition ${
                    inspected
                      ? 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.28)]'
                      : 'border-white/15 hover:border-white/35'
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[11px] font-bold uppercase">
                    <span className="font-display tracking-wider text-white italic">
                      {v.name}
                    </span>
                    {equipped ? (
                      <span className="text-amber-300">★</span>
                    ) : !unlocked ? (
                      <Lock className="h-3.5 w-3.5 text-slate-400" />
                    ) : null}
                  </div>
                  <VehicleSilhouetteIcon
                    vehicleId={v.id}
                    color={paintHex}
                    className="my-1 h-10 w-20"
                  />
                  {!unlocked ? (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300">
                      <CoinIcon className="h-3.5 w-3.5" />
                      {v.price.toLocaleString()}
                    </div>
                  ) : (
                    <div className="text-[10px] font-semibold tracking-wider text-emerald-300 uppercase">
                      {equipped ? 'EQUIPPED' : 'OWNED'}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollCarousel(1)}
            aria-label="Scroll vehicles right"
            className="panel-bevel flex h-20 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 text-slate-300 hover:border-white/40 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
