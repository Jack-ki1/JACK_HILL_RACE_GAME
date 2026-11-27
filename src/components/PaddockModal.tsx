import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  CloudRain,
  CloudSun,
  Compass,
  Cpu,
  Eye,
  Flag,
  Flame,
  Lock,
  Moon,
  Mountain,
  Play,
  RotateCcw,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Warehouse,
  Wrench,
} from 'lucide-react';
import {
  CLIMB_TIRES,
  LIVERY_DEFS,
  PAINT_SWATCHES,
  STAGES,
  VEHICLES,
} from '../game/constants';
import { renderVehiclePreviewDataUrl } from '../game/vehicleThumbnails';
import {
  ClimbDifficulty,
  ClimbMode,
  ClimbSetupConfig,
  ClimbTireId,
  LiveryId,
  NnServerState,
  SaveData,
  StageId,
  SurfaceCategory,
  TimeOfDay,
  VehicleId,
  WeatherCondition,
} from '../types/game';
import { CoinIcon } from './GameIcons';

interface PaddockModalProps {
  save: SaveData;
  nnState: NnServerState;
  pendingSamplesCount: number;
  nnBusy: boolean;
  onBackToShowroom: () => void;
  onUpdateClimbSetup: (next: ClimbSetupConfig) => void;
  onSelectStage: (stageId: StageId) => void;
  onSelectVehicle: (vehicleId: VehicleId) => void;
  onUnlockVehicle: (vehicleId: VehicleId) => void;
  onSetClimbTire: (vehicleId: VehicleId, tireId: ClimbTireId) => void;
  onSetPaint: (vehicleId: VehicleId, paintId: string) => void;
  onSetLivery: (vehicleId: VehicleId, liveryId: LiveryId) => void;
  onToggleAutoTune: () => void;
  onManualTrain: () => void;
  onResetNn: () => void;
  onOpenGarage: () => void;
  onOpenUpgrades: () => void;
  onLaunchClimb: (watchAi: boolean) => void;
}

type MiddleTab = 'PICK_HILL' | 'AI_MODEL';
type MobileColTab = 'SETUP' | 'HILLS_AI' | 'CAR';

const BIOME_FILTERS: { id: 'ALL' | SurfaceCategory; label: string }[] = [
  { id: 'ALL', label: 'All Hills' },
  { id: 'dirt_mud', label: 'Dirt & Mud' },
  { id: 'rock_canyon', label: 'Rock & Scree' },
  { id: 'snow_ice', label: 'Snow & Ice' },
  { id: 'lunar', label: 'Lunar' },
  { id: 'asphalt', label: 'Asphalt' },
];

const WEATHER_OPTS: { id: WeatherCondition; label: string; note: string; icon: React.ReactNode }[] = [
  { id: 'dry', label: 'Dry', note: '100% Grip', icon: <Sun className="h-4 w-4 text-amber-300" /> },
  { id: 'wet', label: 'Wet', note: '-12% Grip', icon: <CloudRain className="h-4 w-4 text-sky-300" /> },
  { id: 'storm', label: 'Storm', note: '-22% Grip', icon: <CloudSun className="h-4 w-4 text-indigo-300" /> },
];

const TIME_OPTS: { id: TimeOfDay; label: string; icon: React.ReactNode }[] = [
  { id: 'dawn', label: 'Dawn', icon: <Sunrise className="h-3.5 w-3.5 text-amber-300" /> },
  { id: 'day', label: 'Day', icon: <Sun className="h-3.5 w-3.5 text-yellow-300" /> },
  { id: 'dusk', label: 'Dusk', icon: <Sunset className="h-3.5 w-3.5 text-rose-300" /> },
  { id: 'night', label: 'Night', icon: <Moon className="h-3.5 w-3.5 text-sky-300" /> },
];

const MODE_OPTS: { id: ClimbMode; label: string; desc: string }[] = [
  { id: 'time_attack', label: 'Summit Time Attack', desc: 'Solo clock run to summit gate' },
  { id: 'head_to_head', label: 'Head-to-Head', desc: 'Race live Neural AI opponent' },
  { id: 'ghost', label: 'Ghost Run', desc: 'Chase your saved best climb' },
];

const DIFF_OPTS: { id: ClimbDifficulty; label: string; desc: string }[] = [
  { id: 'rookie', label: 'Rookie', desc: 'Relaxed AI pace' },
  { id: 'pro', label: 'Pro', desc: 'Competitive pace' },
  { id: 'extreme', label: 'Extreme', desc: 'Aggressive summit pace' },
];

export const PaddockModal: React.FC<PaddockModalProps> = ({
  save,
  nnState,
  pendingSamplesCount,
  nnBusy,
  onBackToShowroom,
  onUpdateClimbSetup,
  onSelectStage,
  onSelectVehicle,
  onUnlockVehicle,
  onSetClimbTire,
  onSetPaint,
  onSetLivery,
  onToggleAutoTune,
  onManualTrain,
  onResetNn,
  onOpenGarage,
  onOpenUpgrades,
  onLaunchClimb,
}) => {
  const [middleTab, setMiddleTab] = useState<MiddleTab>('PICK_HILL');
  const [mobileCol, setMobileCol] = useState<MobileColTab>('HILLS_AI');
  const [biomeFilter, setBiomeFilter] = useState<'ALL' | SurfaceCategory>('ALL');
  const [imgErrors, setImgErrors] = useState<Record<string, boolean>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const setup = save.climbSetup;
  const activeStage = STAGES.find((s) => s.id === save.selectedStage) ?? STAGES[0];
  const activeVehicle = VEHICLES.find((v) => v.id === save.selectedVehicle) ?? VEHICLES[0];
  const activeTireId = save.vehicleClimbTires?.[activeVehicle.id] ?? 'all_terrain';
  const activePaintId = save.vehiclePaints[activeVehicle.id] ?? activeVehicle.defaultPaintId;
  const activeLiveryId = save.vehicleLiveries?.[activeVehicle.id] ?? 'clean';

  const filteredStages = useMemo(
    () =>
      biomeFilter === 'ALL'
        ? STAGES
        : STAGES.filter((s) => s.surfaceCategory === biomeFilter),
    [biomeFilter],
  );

  const vehiclePreviews = useMemo(() => {
    const map: Record<string, string> = {};
    VEHICLES.forEach((v) => {
      map[v.id] = renderVehiclePreviewDataUrl(
        v,
        save.vehiclePaints[v.id] ?? v.defaultPaintId,
        save.vehicleWheels[v.id] ?? 'steel',
        save.vehicleLiveries?.[v.id] ?? 'clean',
        save.vehicleClimbTires?.[v.id] ?? 'all_terrain',
      );
    });
    return map;
  }, [save.vehiclePaints, save.vehicleWheels, save.vehicleLiveries, save.vehicleClimbTires]);

  const lossCurvePath = useMemo(() => {
    const hist = nnState.lossHistory.length > 0 ? nnState.lossHistory : [nnState.recentLoss];
    const maxL = Math.max(0.25, ...hist);
    const w = 220;
    const h = 44;
    if (hist.length === 1) {
      const y = h - Math.min(1, hist[0] / maxL) * (h - 8) - 4;
      return `M 0 ${y.toFixed(1)} L ${w} ${y.toFixed(1)}`;
    }
    return hist
      .map((val, idx) => {
        const x = (idx / (hist.length - 1)) * w;
        const y = h - Math.min(1, val / maxL) * (h - 8) - 4;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [nnState.lossHistory, nnState.recentLoss]);

  const launchCtaLabel =
    setup.climbMode === 'time_attack'
      ? 'CLIMB SOLO'
      : setup.climbMode === 'ghost'
        ? 'RUN GHOST'
        : 'RACE AI';

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#080d13]/96 p-3 text-white backdrop-blur-sm sm:p-4">
      {/* Top Paddock Header */}
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBackToShowroom}
            aria-label="Back to Showroom"
            className="panel-bevel flex min-h-[42px] items-center gap-1.5 rounded-lg border border-white/15 px-3 text-xs font-bold tracking-wider text-slate-200 uppercase transition hover:border-amber-400/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Showroom</span>
          </button>
          <div>
            <h1 className="font-display text-2xl leading-none font-bold tracking-wider text-white uppercase sm:text-3xl">
              PADDOCK
            </h1>
            <div className="mt-0.5 text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              {activeStage.name} · {activeVehicle.name} · {setup.weather.toUpperCase()} · {setup.timeOfDay.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="panel-bevel flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5">
            <CoinIcon className="h-4 w-4" />
            <span className="font-mono-num text-xs font-bold tabular-nums text-amber-300">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenGarage}
            className="panel-bevel flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[11px] font-bold tracking-wider text-sky-300 uppercase transition hover:border-sky-400"
          >
            <Warehouse className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">3D Garage</span>
          </button>
          <button
            type="button"
            onClick={onOpenUpgrades}
            className="panel-bevel flex min-h-[38px] items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[11px] font-bold tracking-wider text-emerald-300 uppercase transition hover:border-emerald-400"
          >
            <Wrench className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upgrades</span>
          </button>
        </div>
      </header>

      {/* Mobile Column Switcher (< lg) */}
      <div className="mt-2 grid shrink-0 grid-cols-3 gap-1.5 lg:hidden">
        {(
          [
            { id: 'SETUP', label: '1. Climb Setup' },
            { id: 'HILLS_AI', label: '2. Hills & AI' },
            { id: 'CAR', label: '3. Car Pick' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileCol(tab.id)}
            className={`min-h-[40px] rounded-lg border px-2 font-display text-sm font-bold tracking-wider whitespace-nowrap uppercase transition ${
              mobileCol === tab.id
                ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                : 'border-white/15 bg-[#111923] text-slate-400'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Compact 3-Column Laptop & Mobile-Responsive Paddock Grid */}
      <div className="mt-2.5 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        {/* LEFT COLUMN — Climb Setup (Stage Conditions ONLY) */}
        <section
          className={`panel-bevel frontier-scroll flex-col gap-3 overflow-y-auto rounded-xl border border-white/15 p-3 lg:col-span-3 lg:flex ${
            mobileCol === 'SETUP' ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-amber-300" />
              <h2 className="font-display text-xl leading-none font-bold tracking-wider uppercase">
                CLIMB SETUP
              </h2>
            </div>
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              CONDITIONS
            </span>
          </div>

          {/* Weather */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Weather
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {WEATHER_OPTS.map((w) => {
                const active = setup.weather === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onUpdateClimbSetup({ ...setup, weather: w.id })}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-2 py-2 text-center transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-white/12 bg-[#111923] text-slate-300 hover:border-white/30'
                    }`}
                  >
                    {w.icon}
                    <span className="font-display text-sm leading-none font-bold tracking-wide uppercase">
                      {w.label}
                    </span>
                    <span className="font-mono-num text-[9px] text-slate-400">{w.note}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time of Day */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Time of Day
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_OPTS.map((t) => {
                const active = setup.timeOfDay === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onUpdateClimbSetup({ ...setup, timeOfDay: t.id })}
                    className={`flex min-h-[44px] flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-1.5 transition ${
                      active
                        ? 'border-sky-400 bg-sky-500/20 text-white'
                        : 'border-white/12 bg-[#111923] text-slate-300 hover:border-white/30'
                    }`}
                  >
                    {t.icon}
                    <span className="text-[10px] font-bold tracking-wider uppercase">
                      {t.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Climb Mode */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Climb Mode
            </div>
            <div className="flex flex-col gap-1.5">
              {MODE_OPTS.map((m) => {
                const active = setup.climbMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateClimbSetup({ ...setup, climbMode: m.id })}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/18 text-white'
                        : 'border-white/12 bg-[#111923] text-slate-300 hover:border-white/30'
                    }`}
                  >
                    <div>
                      <div className="font-display text-base leading-none font-bold tracking-wide uppercase">
                        {m.label}
                      </div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{m.desc}</div>
                    </div>
                    {active && <Check className="h-4 w-4 shrink-0 text-amber-300" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-300 uppercase">
              Difficulty
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {DIFF_OPTS.map((d) => {
                const active = setup.difficulty === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onUpdateClimbSetup({ ...setup, difficulty: d.id })}
                    title={d.desc}
                    className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg border px-2 py-1.5 text-center transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'border-white/12 bg-[#111923] text-slate-300 hover:border-white/30'
                    }`}
                  >
                    <span className="font-display text-sm leading-none font-bold tracking-wide uppercase">
                      {d.label}
                    </span>
                    <span className="mt-0.5 text-[9px] text-slate-400">{d.desc.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* MIDDLE COLUMN — Hills & AI (Two Tabs: Pick Hill | AI Model) */}
        <section
          className={`panel-bevel min-h-0 flex-col overflow-hidden rounded-xl border border-white/15 lg:col-span-5 lg:flex ${
            mobileCol === 'HILLS_AI' ? 'flex' : 'hidden'
          }`}
        >
          {/* Two Tab Header */}
          <div className="grid shrink-0 grid-cols-2 border-b border-white/10 bg-[#0d141d]">
            <button
              type="button"
              onClick={() => setMiddleTab('PICK_HILL')}
              className={`flex min-h-[46px] items-center justify-center gap-2 border-b-2 px-3 font-display text-lg font-bold tracking-wider uppercase transition ${
                middleTab === 'PICK_HILL'
                  ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mountain className="h-4 w-4" />
              Pick Hill
            </button>
            <button
              type="button"
              onClick={() => setMiddleTab('AI_MODEL')}
              className={`flex min-h-[46px] items-center justify-center gap-2 border-b-2 px-3 font-display text-lg font-bold tracking-wider uppercase transition ${
                middleTab === 'AI_MODEL'
                  ? 'border-cyan-400 bg-cyan-500/10 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="h-4 w-4" />
              AI Model
            </button>
          </div>

          {middleTab === 'PICK_HILL' ? (
            <div className="flex min-h-0 flex-1 flex-col p-3">
              {/* Interactive Surface / Biome Filter Pills */}
              <div className="frontier-scroll mb-2.5 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
                {BIOME_FILTERS.map((f) => {
                  const active = biomeFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setBiomeFilter(f.id)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap uppercase transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                          : 'border-white/15 bg-[#111923] text-slate-300 hover:border-white/35'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Hill Cards Grid with Rendered Preview Images (Zero AI controls at bottom) */}
              <div className="frontier-scroll grid flex-1 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredStages.map((s) => {
                  const selected = save.selectedStage === s.id;
                  const mastery = Math.round(nnState.hillMastery[s.id] ?? 0);
                  const bestM = Math.floor(save.stageBests[s.id] ?? 0);
                  const hasImgErr = Boolean(imgErrors[s.id]);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onSelectStage(s.id)}
                      className={`group flex flex-col overflow-hidden rounded-xl border text-left transition ${
                        selected
                          ? 'border-amber-400 bg-amber-500/12 shadow-[0_0_0_1px_rgba(251,191,36,0.4)]'
                          : 'border-white/12 bg-[#111923] hover:border-white/35'
                      }`}
                    >
                      <div className="relative h-28 w-full overflow-hidden bg-slate-900">
                        {!hasImgErr ? (
                          <img
                            src={s.previewImage}
                            alt={s.name}
                            onError={() =>
                              setImgErrors((prev) => ({ ...prev, [s.id]: true }))
                            }
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div
                            className="h-full w-full"
                            style={{ background: s.badgeGradient }}
                          />
                        )}
                        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#0b1119] via-[#0b1119]/60 to-transparent" />
                        <div className="font-mono-num absolute top-2 right-2 rounded bg-slate-950/85 px-2 py-0.5 text-[10px] font-bold text-cyan-300 tabular-nums">
                          AI {mastery}%
                        </div>
                        <div className="absolute bottom-2 left-2.5">
                          <div className="font-display text-xl leading-none font-bold tracking-wide text-white uppercase">
                            {s.name}
                          </div>
                          <div className="text-[10px] font-semibold tracking-wider text-slate-300 uppercase">
                            {s.surfaceLabel}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col justify-between gap-2 p-2.5">
                        <div className="font-mono-num flex items-center justify-between text-[11px] font-bold text-slate-200 tabular-nums">
                          <span>+{s.elevationGainMeters}m Climb</span>
                          <span>{s.maxGradePct}% Max</span>
                          <span>{s.summitMeters}m</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-white/10 pt-1.5 text-[10px] font-semibold text-slate-400">
                          <span className="font-mono-num tabular-nums">
                            Best {bestM}m
                          </span>
                          <span className={selected ? 'text-amber-300 font-bold' : ''}>
                            {selected ? 'SELECTED' : 'SELECT HILL'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Tab 2 — AI Model (NN stats, architecture, mastery breakdown, Auto-Tune, Train/Reset, guidelines) */
            <div className="frontier-scroll flex flex-1 flex-col gap-3 overflow-y-auto p-3">
              {/* NN Stats & Loss Sparkline */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-white/10 bg-[#111923] p-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Steps</div>
                  <div className="font-mono-num mt-0.5 text-base font-black text-white tabular-nums">
                    {nnState.trainingSteps}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#111923] p-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Samples</div>
                  <div className="font-mono-num mt-0.5 text-base font-black text-cyan-300 tabular-nums">
                    {nnState.samplesCaptured}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#111923] p-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Loss</div>
                  <div className="font-mono-num mt-0.5 text-base font-black text-emerald-300 tabular-nums">
                    {nnState.recentLoss.toFixed(3)}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#111923] p-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Summits</div>
                  <div className="font-mono-num mt-0.5 text-base font-black text-amber-300 tabular-nums">
                    {nnState.summitsCompleted}
                  </div>
                </div>
              </div>

              {/* Architecture + Loss Trend */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-[#111923] p-2.5">
                  <div className="text-[10px] font-bold tracking-wider text-cyan-300 uppercase">
                    Architecture
                  </div>
                  <div className="font-mono-num mt-1 text-xs font-bold text-white">
                    12 → 24 → 16 → 3 MLP
                  </div>
                  <div className="mt-1 text-[11px] leading-snug text-slate-400">
                    Inputs: slope near/mid/far, curvature, pitch &amp; heading error, speed, slip, grip, tire wear, clearance, crest risk.
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-[#111923] p-2.5">
                  <div className="flex items-center justify-between text-[10px] font-bold tracking-wider text-emerald-300 uppercase">
                    <span>Training Loss Trend</span>
                    <span className="font-mono-num tabular-nums">
                      Mastery {nnState.evolutionBonuses.overallMasteryPct}%
                    </span>
                  </div>
                  <svg viewBox="0 0 220 44" className="mt-1.5 h-11 w-full rounded bg-slate-950/70 p-1">
                    <path
                      d={lossCurvePath}
                      fill="none"
                      stroke="#34d399"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              {/* Multi-Hill Mastery Breakdown */}
              <div className="rounded-lg border border-white/10 bg-[#111923] p-2.5">
                <div className="mb-2 text-[10px] font-bold tracking-wider text-slate-300 uppercase">
                  Multi-Hill Neural Mastery
                </div>
                <div className="space-y-1.5">
                  {STAGES.map((st) => {
                    const pct = Math.round(nnState.hillMastery[st.id] ?? 0);
                    return (
                      <div key={st.id} className="flex items-center gap-2 text-xs">
                        <span className="w-24 shrink-0 truncate font-semibold text-slate-200">
                          {st.name}
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-mono-num w-9 text-right text-[11px] font-bold text-cyan-300 tabular-nums">
                          {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Auto-Tune Evolution Toggle & Vehicle/Terrain Bonuses */}
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 font-display text-base leading-none font-bold tracking-wide text-white uppercase">
                      <Sparkles className="h-4 w-4 text-cyan-300" />
                      AI Auto-Tune Vehicle Evolution
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-300">
                      Applies learned torque, damping, slip drag &amp; tire wear bonuses to your rig.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onToggleAutoTune}
                    className={`min-h-[38px] shrink-0 rounded-lg border px-3 font-display text-sm font-bold tracking-wider uppercase transition ${
                      save.aiAutoTune
                        ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                        : 'border-white/20 bg-slate-900 text-slate-400'
                    }`}
                  >
                    {save.aiAutoTune ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  <div className="rounded bg-slate-950/75 px-2 py-1.5 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Low Torque</div>
                    <div className="font-mono-num text-xs font-extrabold text-amber-300 tabular-nums">
                      +{nnState.evolutionBonuses.torqueBonusPct}%
                    </div>
                  </div>
                  <div className="rounded bg-slate-950/75 px-2 py-1.5 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Susp Damp</div>
                    <div className="font-mono-num text-xs font-extrabold text-sky-300 tabular-nums">
                      +{nnState.evolutionBonuses.suspensionDampingPct}%
                    </div>
                  </div>
                  <div className="rounded bg-slate-950/75 px-2 py-1.5 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Slip Drag</div>
                    <div className="font-mono-num text-xs font-extrabold text-emerald-300 tabular-nums">
                      -{nnState.evolutionBonuses.slipDragReductionPct}%
                    </div>
                  </div>
                  <div className="rounded bg-slate-950/75 px-2 py-1.5 text-center">
                    <div className="text-[9px] font-bold text-slate-400 uppercase">Tire Life</div>
                    <div className="font-mono-num text-xs font-extrabold text-violet-300 tabular-nums">
                      +{nnState.evolutionBonuses.tireWearResistancePct}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Manual Train / Reset Actions + Guidelines */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={nnBusy || pendingSamplesCount === 0}
                  onClick={onManualTrain}
                  className="flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-cyan-400/50 bg-cyan-500/20 px-3 font-display text-sm font-bold tracking-wider text-cyan-200 uppercase transition hover:bg-cyan-500/30 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Flame className="h-4 w-4" />
                  Train Batch ({pendingSamplesCount})
                </button>

                {!confirmReset ? (
                  <button
                    type="button"
                    disabled={nnBusy}
                    onClick={() => setConfirmReset(true)}
                    className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-[#111923] px-3 font-display text-sm font-bold tracking-wider text-slate-300 uppercase transition hover:border-rose-400/60 hover:text-rose-200"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Weights
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={nnBusy}
                      onClick={() => {
                        setConfirmReset(false);
                        onResetNn();
                      }}
                      className="min-h-[40px] rounded-lg border border-rose-500 bg-rose-600/30 px-3 font-display text-sm font-bold tracking-wider text-rose-100 uppercase"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[40px] rounded-lg border border-white/15 bg-[#111923] px-2.5 text-xs font-bold text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] leading-relaxed text-slate-300">
                <strong className="text-white">How AI Learning Works:</strong> Driving manually without Autopilot captures slope, traction, and throttle-modulation samples to train the persistent backend MLP. Reaching a Summit Finish raises that hill&apos;s mastery and unlocks stronger Auto-Tune bonuses.
              </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN — Car Pick (Vehicle Image Cards + Tires + Paint/Livery + Launch CTAs at bottom ONLY) */}
        <section
          className={`panel-bevel min-h-0 flex-col justify-between overflow-hidden rounded-xl border border-white/15 p-3 lg:col-span-4 lg:flex ${
            mobileCol === 'CAR' ? 'flex' : 'hidden'
          }`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <h2 className="font-display text-xl leading-none font-bold tracking-wider uppercase">
              CAR PICK
            </h2>
            <span className="text-[11px] font-bold tracking-wider text-amber-300 uppercase">
              {activeVehicle.name}
            </span>
          </div>

          <div className="frontier-scroll my-2 flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {/* Vehicle Studio Cards */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {VEHICLES.map((v) => {
                const owned = Boolean(save.unlockedVehicles[v.id]);
                const selected = save.selectedVehicle === v.id;
                const canAfford = save.coins >= v.price;
                const torqueScore = Math.round(v.powerMult * 100);
                const suspMm = Math.round(v.suspensionTravel * 100);
                const gripScore = Math.round(v.gripMult * 100);
                return (
                  <div
                    key={v.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-2 transition ${
                      selected
                        ? 'border-amber-400 bg-amber-500/12'
                        : 'border-white/12 bg-[#111923] hover:border-white/30'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => (owned ? onSelectVehicle(v.id) : onUnlockVehicle(v.id))}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      <img
                        src={vehiclePreviews[v.id]}
                        alt={v.name}
                        className="h-14 w-24 shrink-0 rounded-lg border border-white/10 bg-slate-950 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-display truncate text-lg leading-none font-bold tracking-wide text-white uppercase">
                            {v.name}
                          </span>
                          {!owned && <Lock className="h-3.5 w-3.5 shrink-0 text-amber-400" />}
                        </div>
                        <div className="mt-0.5 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                          {v.vehicleClass}
                        </div>
                        <div className="font-mono-num mt-1 flex flex-wrap items-center gap-x-2 text-[10px] font-bold text-slate-200 tabular-nums">
                          <span>TRQ {torqueScore}</span>
                          <span>·</span>
                          <span>SUSP {suspMm}</span>
                          <span>·</span>
                          <span>GRIP {gripScore}</span>
                          <span>·</span>
                          <span>{v.weightKg}kg</span>
                        </div>
                        {!owned && (
                          <div
                            className={`mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold ${
                              canAfford ? 'text-amber-300' : 'text-slate-400'
                            }`}
                          >
                            <CoinIcon className="h-3 w-3" />
                            <span>Unlock {v.price.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Tires Selector inside Car Pick */}
            <div className="border-t border-white/10 pt-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold tracking-wider uppercase">
                <span className="text-slate-300">Climb Tires</span>
                <span className="text-amber-300">
                  {CLIMB_TIRES.find((t) => t.id === activeTireId)?.name}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {CLIMB_TIRES.map((tire) => {
                  const active = activeTireId === tire.id;
                  return (
                    <button
                      key={tire.id}
                      type="button"
                      onClick={() => onSetClimbTire(activeVehicle.id, tire.id)}
                      title={tire.desc}
                      className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition ${
                        active
                          ? 'border-amber-400 bg-amber-500/18 text-white'
                          : 'border-white/12 bg-[#111923] text-slate-300 hover:border-white/30'
                      }`}
                    >
                      <span className="font-display text-sm leading-none font-bold tracking-wide uppercase">
                        {tire.name}
                      </span>
                      <span className="mt-0.5 text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                        {tire.tag}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paint & Livery inside Car Pick */}
            <div className="border-t border-white/10 pt-2.5">
              <div className="mb-1.5 text-[11px] font-bold tracking-wider text-slate-300 uppercase">
                Paint &amp; Livery
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {PAINT_SWATCHES.slice(0, 8).map((swatch) => {
                  const active = activePaintId === swatch.id;
                  return (
                    <button
                      key={swatch.id}
                      type="button"
                      onClick={() => onSetPaint(activeVehicle.id, swatch.id)}
                      aria-label={`Paint ${swatch.name}`}
                      title={swatch.name}
                      className={`h-7 w-7 rounded-md border-2 transition ${
                        active ? 'scale-110 border-white' : 'border-white/20 hover:border-white/60'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${swatch.primary} 55%, ${swatch.accent} 55%)`,
                      }}
                    />
                  );
                })}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {LIVERY_DEFS.slice(0, 5).map((liv) => {
                  const active = activeLiveryId === liv.id;
                  return (
                    <button
                      key={liv.id}
                      type="button"
                      onClick={() => onSetLivery(activeVehicle.id, liv.id)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-bold tracking-wider uppercase transition ${
                        active
                          ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                          : 'border-white/12 bg-[#111923] text-slate-300 hover:border-white/30'
                      }`}
                    >
                      {liv.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ONLY Launch Buttons placed at the bottom of Car Pick */}
          <div className="grid shrink-0 grid-cols-1 gap-2 border-t border-white/10 pt-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => onLaunchClimb(false)}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-amber-500 px-3 py-2.5 text-slate-950 shadow-lg transition hover:bg-amber-400 active:translate-y-0.5"
            >
              {setup.climbMode === 'head_to_head' ? (
                <Flag className="h-4 w-4 shrink-0" />
              ) : (
                <Play className="h-4 w-4 shrink-0 fill-current" />
              )}
              <span className="font-display text-xl leading-none font-bold tracking-wider whitespace-nowrap uppercase">
                {launchCtaLabel}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onLaunchClimb(true)}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-lg border border-cyan-400/60 bg-cyan-500/18 px-3 py-2.5 text-cyan-100 transition hover:bg-cyan-500/30 active:translate-y-0.5"
            >
              <Eye className="h-4 w-4 shrink-0 text-cyan-300" />
              <Bot className="h-4 w-4 shrink-0 text-cyan-300 sm:hidden" />
              <span className="font-display text-xl leading-none font-bold tracking-wider whitespace-nowrap uppercase">
                WATCH AI CLIMB
              </span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
