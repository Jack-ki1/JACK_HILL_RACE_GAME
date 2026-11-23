import React from 'react';
import {
  MapPin,
  Sliders,
  ShoppingCart,
  Trophy,
  Volume2,
  VolumeX,
  Warehouse,
  Wrench,
  ClipboardList,
  Compass,
  Lock,
  Settings,
} from 'lucide-react';
import {
  MAX_TICKETS,
  PAINT_SWATCHES,
  SEASON_TIERS,
  STAGES,
  VEHICLES,
} from '../game/constants';
import { countClaimableRewards, getFreeGemsRemainingMs } from '../game/storage';
import {
  GameScreen,
  SaveData,
  StageConfig,
  VehicleConfig,
  VehicleId,
} from '../types/game';
import {
  CoinIcon,
  DriverAvatarIcon,
  FuelCanIcon,
  GemIcon,
  RankShieldIcon,
  VehicleSilhouetteIcon,
} from './GameIcons';

interface TitleOverlayProps {
  save: SaveData;
  stage: StageConfig;
  vehicle: VehicleConfig;
  onPlay: () => void;
  onOpenScreen: (
    screen: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>,
    missionsTab?: 'MISSIONS' | 'SEASON',
  ) => void;
  onSelectVehicle: (id: VehicleId) => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  stage,
  vehicle,
  onPlay,
  onOpenScreen,
  onSelectVehicle,
  onToggleMute,
}) => {
  const claimableCount = countClaimableRewards(save);
  const freeGemsReady = getFreeGemsRemainingMs(save) === 0;
  const stageBest = Math.floor(save.stageBests[stage.id] ?? 0);

  // Season 12 progress calculation
  const totalDist = Math.floor(save.totals.distanceMeters);
  const activeTier =
    SEASON_TIERS.find((t) => totalDist < t.targetMeters) ??
    SEASON_TIERS[SEASON_TIERS.length - 1];
  const prevTarget =
    activeTier.tier > 1 ? SEASON_TIERS[activeTier.tier - 2].targetMeters : 0;
  const tierSpan = Math.max(1, activeTier.targetMeters - prevTarget);
  const tierProgress = Math.min(
    1,
    Math.max(0, (totalDist - prevTarget) / tierSpan),
  );

  // Daily Challenge telemetry derived from persistent player totals
  const dailyTarget = 1200;
  const dailyCurrent = Math.min(dailyTarget, Math.floor(save.totals.bestSingleRunMeters));
  const dailyPct = Math.round((dailyCurrent / dailyTarget) * 100);

  const driverLevel = Math.max(
    1,
    1 + Math.floor(save.totals.distanceMeters / 750) + Math.floor(save.totals.flipsCompleted / 3),
  );

  const navItems: {
    id: 'SHOP' | 'GARAGE' | 'UPGRADES' | 'MISSIONS' | 'EVENTS' | 'TUNING' | 'SETTINGS';
    label: string;
    icon: React.ReactNode;
    badge?: number | boolean;
    screen: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>;
    missionsTab?: 'MISSIONS' | 'SEASON';
  }[] = [
    {
      id: 'GARAGE',
      label: 'GARAGE',
      icon: <Warehouse className="w-5 h-5 text-sky-300" />,
      screen: 'GARAGE',
    },
    {
      id: 'UPGRADES',
      label: 'UPGRADES',
      icon: <Wrench className="w-5 h-5 text-emerald-300" />,
      screen: 'UPGRADES',
    },
    {
      id: 'SHOP',
      label: 'SHOP',
      icon: <ShoppingCart className="w-5 h-5 text-amber-300" />,
      badge: freeGemsReady,
      screen: 'SHOP',
    },
    {
      id: 'MISSIONS',
      label: 'MISSIONS',
      icon: <ClipboardList className="w-5 h-5 text-orange-300" />,
      badge: claimableCount > 0 ? claimableCount : false,
      screen: 'MISSIONS',
      missionsTab: 'MISSIONS',
    },
    {
      id: 'EVENTS',
      label: 'EVENTS',
      icon: <Trophy className="w-5 h-5 text-yellow-300" />,
      screen: 'MISSIONS',
      missionsTab: 'SEASON',
    },
    {
      id: 'TUNING',
      label: 'TUNING',
      icon: <Sliders className="w-5 h-5 text-violet-300" />,
      screen: 'TUNING',
    },
    {
      id: 'SETTINGS',
      label: 'SETTINGS',
      icon: <Settings className="w-5 h-5 text-slate-300" />,
      screen: 'SETTINGS',
    },
  ];

  const activeBoostCount =
    (save.boosters.fuelSaver > 0 ? 1 : 0) +
    (save.boosters.nitroCharge > 0 ? 1 : 0) +
    (save.boosters.coinMagnet > 0 ? 1 : 0);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Bar */}
      <div className="flex items-start justify-between gap-4">
        {/* Racer Profile Badge */}
        <div className="panel-bevel pointer-events-auto flex items-center gap-3 rounded-xl border border-white/15 px-3 py-2">
          <DriverAvatarIcon className="h-10 w-10 shrink-0 rounded-lg border border-white/25" />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-base font-extrabold tracking-wider text-white italic">
                RACER
              </span>
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1.5 py-0.5 font-mono-num text-[10px] font-black text-amber-300">
                <RankShieldIcon className="h-3 w-3" />
                LV {driverLevel}
              </span>
            </div>
            <div className="text-[11px] font-bold tracking-widest text-sky-300 uppercase">
              {vehicle.vehicleClass} · {vehicle.name}
            </div>
          </div>
        </div>

        {/* Currency & Utility Strip */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-white transition hover:border-amber-400/60"
          >
            <FuelCanIcon className="h-4 w-4" />
            <span className="font-mono-num text-sm font-bold">
              {save.tickets}/{MAX_TICKETS}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-white transition hover:border-amber-400/60"
          >
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5 text-white transition hover:border-sky-400/60"
          >
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SETTINGS')}
            aria-label="Open Settings"
            className="panel-bevel flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-400/60 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="panel-bevel flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-white/40 hover:text-white"
          >
            {save.muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Middle Zone: Left Vertical Nav | Open Hero Jeep Center | Right-Sky Title + Compact Cards */}
      <div className="my-auto flex items-center justify-between gap-4 py-2">
        {/* Left Navigation Stack */}
        <nav
          aria-label="Main Menu"
          className="pointer-events-auto flex flex-col gap-1.5"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenScreen(item.screen, item.missionsTab)}
              className="panel-bevel group relative flex w-36 items-center gap-3 rounded-xl border border-white/15 px-3.5 py-2 text-left transition hover:-translate-y-0.5 hover:border-amber-400/70"
            >
              {item.icon}
              <span className="font-display text-sm font-extrabold tracking-wider text-white italic">
                {item.label}
              </span>
              {item.badge && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-slate-950 bg-red-600 px-1.5 text-[10px] font-extrabold text-white shadow">
                  {typeof item.badge === 'number' ? item.badge : '!'}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Right Flank: Motorsport Title Lockup + Daily Challenge & Biome Card */}
        <div className="flex max-w-[230px] flex-col items-end gap-2.5 pr-1 text-right sm:max-w-md sm:gap-3 lg:max-w-lg lg:pr-4">
          {/* Condensed Italic Title Lockup */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 drop-shadow-[0_6px_18px_rgba(9,13,22,0.85)]">
              <div className="flex flex-col items-end leading-[0.86]">
                <span className="font-display text-3xl font-extrabold tracking-tight text-white uppercase italic sm:text-4xl lg:text-5xl">
                  JACK HILL
                </span>
                <span className="font-display bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent uppercase italic sm:text-4xl lg:text-5xl">
                  GAME
                </span>
              </div>
              <span className="font-display bg-gradient-to-b from-pink-400 via-amber-300 to-cyan-400 bg-clip-text pr-1 text-5xl leading-none font-extrabold text-transparent italic drop-shadow-[0_4px_0_rgba(120,53,15,0.95)] sm:text-7xl lg:text-8xl">
                06
              </span>
            </div>
            <div className="mt-1.5 flex w-full max-w-[330px] items-center gap-2 sm:gap-3">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-pink-500 to-amber-400" />
              <span className="font-display text-[11px] font-extrabold tracking-[0.26em] text-cyan-300 uppercase italic drop-shadow sm:text-sm sm:tracking-[0.34em]">
                JACK_HILL_GAME
              </span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-amber-400 to-cyan-400" />
            </div>
          </div>

          {/* Compact Daily Challenge + Active Biome Cards (desktop) */}
          <div className="pointer-events-auto hidden w-64 flex-col gap-2 text-left lg:flex">
            <button
              type="button"
              onClick={() => onOpenScreen('MISSIONS')}
              className="panel-bevel rounded-xl border border-white/15 px-3.5 py-2.5 transition hover:border-amber-400/60"
            >
              <div className="flex items-center justify-between text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
                <span>DAILY CHALLENGE</span>
                <span className="font-mono-num text-white">
                  {dailyCurrent}/{dailyTarget}m
                </span>
              </div>
              <div className="mt-0.5 font-display text-sm font-bold text-white italic">
                Drive 1,200m in One Run
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
            </button>

            <button
              type="button"
              onClick={() => onOpenScreen('WORLD_MAP')}
              className="panel-bevel overflow-hidden rounded-xl border border-white/15 text-left transition hover:border-sky-400/60"
            >
              <div
                className="h-1.5 w-full"
                style={{ background: stage.badgeGradient }}
              />
              <div className="flex items-center justify-between px-3.5 py-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest text-sky-300 uppercase">
                    <Compass className="h-3 w-3" />
                    ACTIVE BIOME
                  </div>
                  <div className="font-display text-base font-extrabold tracking-wide text-white uppercase italic">
                    {stage.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono-num text-xs font-extrabold text-amber-300">
                    BEST {stageBest}m
                  </div>
                  <div className="font-mono-num text-[10px] font-bold text-slate-400">
                    {stage.gravityMult.toFixed(2)}G · {Math.round(stage.gripMult * 100)}% GRIP
                  </div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Zone: Direct Car Selector Strip + Main Dock */}
      <div className="flex flex-col gap-2.5">
        {/* Direct Car Selector Strip */}
        <div className="pointer-events-auto flex items-center gap-2 self-center max-w-full">
          <div className="panel-bevel flex items-center gap-1.5 overflow-x-auto frontier-scroll rounded-xl border border-white/15 px-2.5 py-1.5 max-w-full">
            <span className="hidden shrink-0 px-1.5 font-display text-[11px] font-extrabold tracking-widest text-amber-300 uppercase italic sm:inline">
              SELECT RIDE
            </span>
            <span className="hidden h-5 w-px shrink-0 bg-white/15 sm:inline-block" />
            {VEHICLES.map((v) => {
              const unlocked = save.unlockedVehicles[v.id];
              const selected = save.selectedVehicle === v.id;
              const paintHex =
                PAINT_SWATCHES.find((p) => p.id === save.vehiclePaints[v.id])
                  ?.primary ?? '#d92b1e';
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectVehicle(v.id)}
                  title={
                    unlocked
                      ? `Drive ${v.name}`
                      : `Inspect & unlock ${v.name} (${v.price.toLocaleString()} coins)`
                  }
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition ${
                    selected
                      ? 'border-amber-300 bg-amber-400/20 text-white shadow-[0_0_14px_rgba(251,191,36,0.28)]'
                      : unlocked
                        ? 'border-white/15 bg-slate-900/90 text-slate-200 hover:border-white/40 hover:text-white'
                        : 'border-white/10 bg-slate-950/85 text-slate-400 hover:border-amber-400/45 hover:text-slate-200'
                  }`}
                >
                  <VehicleSilhouetteIcon
                    vehicleId={v.id}
                    color={paintHex}
                    className="h-5 w-9 shrink-0"
                  />
                  <div className="leading-tight">
                    <div className="flex items-center gap-1 font-display text-[11px] font-extrabold tracking-wide uppercase italic whitespace-nowrap">
                      <span>{v.name}</span>
                      {!unlocked && <Lock className="h-3 w-3 text-amber-400" />}
                    </div>
                    <div className="font-mono-num text-[9px] font-bold text-slate-400 whitespace-nowrap">
                      {selected ? (
                        <span className="text-amber-300">ACTIVE</span>
                      ) : unlocked ? (
                        <span className="text-emerald-300">OWNED</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-amber-300">
                          <CoinIcon className="h-2.5 w-2.5" />
                          {v.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Dock: Season 12 Card | PLAY CTA | ADVENTURE Map */}
        <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-end">
        {/* Season 12 Card */}
        <button
          type="button"
          onClick={() => onOpenScreen('MISSIONS', 'SEASON')}
          className="panel-bevel pointer-events-auto flex items-center gap-3 rounded-xl border border-violet-400/35 px-3.5 py-2.5 text-left transition hover:border-violet-300"
        >
          <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-slate-900">
            <VehicleSilhouetteIcon
              vehicleId={vehicle.id}
              className="h-9 w-14"
            />
          </div>
          <div className="min-w-[165px]">
            <div className="text-[10px] font-bold tracking-widest text-rose-400 uppercase">
              SEASON 12 · TIER {activeTier.tier}
            </div>
            <div className="font-display text-base font-extrabold tracking-wide text-white italic">
              WILD ROADS
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                  style={{ width: `${Math.round(tierProgress * 100)}%` }}
                />
              </div>
              <span className="font-mono-num text-[11px] font-bold text-slate-300">
                {totalDist}/{activeTier.targetMeters}m
              </span>
            </div>
          </div>
        </button>

        {/* Primary PLAY Button */}
        <div className="pointer-events-auto flex flex-col items-center gap-1.5">
          {activeBoostCount > 0 && (
            <div className="panel-bevel rounded-md border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
              {activeBoostCount} Booster{activeBoostCount > 1 ? 's' : ''} Armed
            </div>
          )}
          <button
            type="button"
            onClick={onPlay}
            className="group relative flex min-w-[240px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 px-10 py-3 shadow-[0_8px_0_#92400e,0_16px_28px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_3px_0_#92400e]"
          >
            <span className="font-display text-3xl font-extrabold tracking-wider text-slate-950 italic">
              PLAY
            </span>
            <span className="font-mono-num text-xs font-extrabold text-slate-900">
              BEST: {stageBest}m · {stage.name.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Adventure World Map CTA */}
        <button
          type="button"
          onClick={() => onOpenScreen('WORLD_MAP')}
          className="panel-bevel pointer-events-auto flex items-center justify-center gap-3 rounded-xl border border-white/20 px-5 py-3 transition hover:-translate-y-0.5 hover:border-sky-400/60"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="text-left">
            <div className="text-[10px] font-bold tracking-widest text-sky-300 uppercase">
              {STAGES.length} BIOMES
            </div>
            <div className="font-display text-base font-extrabold tracking-wider text-white italic">
              ADVENTURE
            </div>
          </div>
        </button>
        </div>
      </div>
    </div>
  );
};
