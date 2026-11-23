import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp,
  ArrowLeft,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Lock,
  Paintbrush,
  Sparkles,
  Wrench,
} from 'lucide-react';
import {
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
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
  SaveData,
  UpgradeKey,
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
  onClose: () => void;
  onSelectVehicle: (id: VehicleId) => void;
  onUnlockVehicle: (id: VehicleId) => void;
  onSetPaint: (vehicleId: VehicleId, paintId: string) => void;
  onSelectOrUnlockWheel: (vehicleId: VehicleId, wheelId: WheelStyleId) => void;
  onBuyUpgrade: (vehicleId: VehicleId, key: UpgradeKey) => void;
  onOpenUpgrades: () => void;
}

type GarageDrawer = 'PAINT' | 'WHEELS' | null;

export const GarageModal: React.FC<GarageModalProps> = ({
  save,
  onClose,
  onSelectVehicle,
  onUnlockVehicle,
  onSetPaint,
  onSelectOrUnlockWheel,
  onBuyUpgrade,
  onOpenUpgrades,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const ctrlRef = useRef<GarageSceneController | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const [inspectedId, setInspectedId] = useState<VehicleId>(save.selectedVehicle);
  const [drawer, setDrawer] = useState<GarageDrawer>(null);
  const [camPreset, setCamPreset] = useState<GarageCameraPreset>('hero');
  const [lightsOn, setLightsOn] = useState<boolean>(true);

  const vehicle = VEHICLES.find((v) => v.id === inspectedId) ?? VEHICLES[0];
  const isUnlocked = save.unlockedVehicles[vehicle.id];
  const isEquipped = save.selectedVehicle === vehicle.id;
  const activePaintId = save.vehiclePaints[vehicle.id] || vehicle.defaultPaintId;
  const activeWheelId = save.vehicleWheels[vehicle.id] || 'steel';
  const levels = save.upgrades[vehicle.id];

  const unlockedCount = VEHICLES.filter((v) => save.unlockedVehicles[v.id]).length;

  // Mount dedicated 3D showroom turntable controller
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const ctrl = new GarageSceneController(el);
    ctrlRef.current = ctrl;
    return () => {
      ctrl.dispose();
      ctrlRef.current = null;
    };
  }, []);

  // Update 3D turntable whenever inspected vehicle, paint, or wheel changes
  useEffect(() => {
    ctrlRef.current?.setVehicle(inspectedId, activePaintId, activeWheelId, true);
  }, [inspectedId, activePaintId, activeWheelId]);

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
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
      />

      {/* Top Header Bar */}
      <div className="pointer-events-none relative z-10 flex items-center justify-between gap-3 p-4 sm:px-6">
        <div className="pointer-events-auto flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to Menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-slate-950/90 text-white shadow-lg transition hover:border-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl leading-none font-black tracking-wider uppercase">
              GARAGE
            </h1>
            <p className="mt-0.5 text-xs font-semibold tracking-widest text-slate-300 uppercase">
              VEHICLE COLLECTION {unlockedCount}/{VEHICLES.length}
            </p>
          </div>
        </div>

        {/* Center Vehicle Title Banner */}
        <div className="hidden flex-col items-center text-center md:flex">
          <div className="font-display text-3xl font-black tracking-wider text-white uppercase drop-shadow">
            {vehicle.name}
          </div>
          <div className="text-[11px] font-bold tracking-[0.28em] text-sky-300 uppercase">
            CLASS: {vehicle.vehicleClass} · DRAG TO SPIN 360°
          </div>
        </div>

        {/* Top-Right Currencies */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-1.5 shadow">
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/90 px-3 py-1.5 shadow">
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Middle Zone: Left Stat Bars + Right Customization Rail */}
      <div className="pointer-events-none relative z-10 flex flex-1 items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left Upgrade & Telemetry Stat Bars */}
        <div className="pointer-events-auto hidden w-64 flex-col gap-2 rounded-2xl border border-white/15 bg-slate-950/88 p-3.5 shadow-2xl sm:flex">
          {UPGRADE_DEFS.map((def) => {
            const lv = levels[def.key] ?? 0;
            const cost = getUpgradeCost(def.key, lv);
            const maxed = lv >= MAX_UPGRADE_LEVEL;
            const canAfford = isUnlocked && !maxed && save.coins >= cost;
            return (
              <div
                key={def.key}
                className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-slate-900/90 px-2.5 py-2"
              >
                <UpgradePartIcon part={def.key} className="h-8 w-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase">
                    <span className="truncate text-white">{def.name}</span>
                    <span className="font-mono-num text-amber-300">
                      LV {lv}/{MAX_UPGRADE_LEVEL}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(lv / MAX_UPGRADE_LEVEL) * 100}%`,
                        backgroundColor: def.accentColor,
                      }}
                    />
                  </div>
                </div>
                {isUnlocked && (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onBuyUpgrade(vehicle.id, def.key)}
                    title={maxed ? 'Max Level' : `Upgrade (${cost} coins)`}
                    className={`rounded-lg px-2 py-1 text-[10px] font-extrabold transition ${
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

        {/* Right Customization Actions & Slide-out Drawer */}
        <div className="pointer-events-auto ml-auto flex items-center gap-3">
          {drawer === 'PAINT' && (
            <div className="w-60 rounded-2xl border border-white/20 bg-slate-950/92 p-3.5 shadow-2xl">
              <div className="mb-2.5 font-display text-xs font-bold tracking-widest text-amber-300 uppercase">
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

          {drawer === 'WHEELS' && (
            <div className="w-64 rounded-2xl border border-white/20 bg-slate-950/92 p-3.5 shadow-2xl">
              <div className="mb-2.5 font-display text-xs font-bold tracking-widest text-sky-300 uppercase">
                WHEEL & RIM STYLES
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

          {/* Right Vertical Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'PAINT' ? null : 'PAINT'))}
              className={`flex w-20 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold shadow-xl transition ${
                drawer === 'PAINT'
                  ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                  : 'border-white/20 bg-slate-950/90 text-slate-200 hover:border-white/40'
              }`}
            >
              <Paintbrush className="h-5 w-5 text-amber-300" />
              <span className="font-display tracking-wider">PAINT</span>
            </button>

            <button
              type="button"
              onClick={() => setDrawer((d) => (d === 'WHEELS' ? null : 'WHEELS'))}
              className={`flex w-20 flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-bold shadow-xl transition ${
                drawer === 'WHEELS'
                  ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                  : 'border-white/20 bg-slate-950/90 text-slate-200 hover:border-white/40'
              }`}
            >
              <Sparkles className="h-5 w-5 text-sky-300" />
              <span className="font-display tracking-wider">WHEELS</span>
            </button>

            <button
              type="button"
              onClick={onOpenUpgrades}
              className="flex w-20 flex-col items-center gap-1.5 rounded-xl border border-white/20 bg-slate-950/90 px-2 py-3 text-xs font-bold text-slate-200 shadow-xl transition hover:border-emerald-400"
            >
              <Wrench className="h-5 w-5 text-emerald-300" />
              <span className="font-display tracking-wider">UPGRADE</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Vehicle Action + 5-Vehicle Selector Carousel */}
      <div className="pointer-events-none relative z-10 flex flex-col gap-2.5 p-4 pt-2 sm:px-6">
        {/* Compact Showroom Camera & Rig Inspection Strip */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 self-center rounded-xl border border-white/15 bg-slate-950/90 px-2.5 py-1.5 shadow-xl">
          <Camera className="mr-1 hidden h-3.5 w-3.5 text-sky-300 sm:block" />
          {(
            [
              { id: 'hero', label: '3/4 HERO' },
              { id: 'profile', label: 'PROFILE' },
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
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-slate-950/90 px-4 py-2.5 shadow-xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-black text-white uppercase">
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
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-sm font-black tracking-wider uppercase shadow-lg transition ${
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
              className={`flex items-center gap-2 rounded-xl px-5 py-2.5 font-display text-sm font-black tracking-wider uppercase shadow-lg transition ${
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
            className="flex h-20 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-950/90 text-slate-300 hover:border-white/40 hover:text-white"
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
                  className={`relative flex min-w-[160px] flex-1 flex-col items-center justify-between rounded-xl border p-2.5 transition ${
                    inspected
                      ? 'border-sky-400 bg-slate-900 shadow-[0_0_20px_rgba(56,189,248,0.28)]'
                      : 'border-white/15 bg-slate-950/90 hover:border-white/35'
                  }`}
                >
                  <div className="flex w-full items-center justify-between text-[11px] font-bold uppercase">
                    <span className="font-display tracking-wider text-white">
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
            className="flex h-20 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-950/90 text-slate-300 hover:border-white/40 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
