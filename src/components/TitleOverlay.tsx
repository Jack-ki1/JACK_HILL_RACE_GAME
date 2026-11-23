import React from 'react';
import {
  Check,
  ClipboardList,
  Lock,
  MapPin,
  Settings,
  ShoppingCart,
  Trophy,
  Volume2,
  VolumeX,
  Warehouse,
  Wrench,
} from 'lucide-react';
import {
  MAX_TICKETS,
  PAINT_SWATCHES,
  SEASON_TIERS,
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
  onClaimDailyChallenge: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  stage,
  vehicle,
  onPlay,
  onOpenScreen,
  onSelectVehicle,
  onToggleMute,
  onClaimDailyChallenge,
}) => {
  const claimableCount = countClaimableRewards(save);
  const freeGemsReady = getFreeGemsRemainingMs(save) === 0;
  const stageBest = Math.floor(save.stageBests[stage.id] ?? 0);

  const totalDist = Math.floor(save.totals.distanceMeters);
  const activeTier =
    SEASON_TIERS.find((t) => totalDist < t.targetMeters) ??
    SEASON_TIERS[SEASON_TIERS.length - 1];

  const daily = save.dailyChallenge;
  const dailyCurrent = Math.min(daily.targetMeters, Math.floor(daily.bestMeters));
  const dailyPct = Math.round((dailyCurrent / Math.max(1, daily.targetMeters)) * 100);
  const dailyComplete = daily.bestMeters >= daily.targetMeters;
  const dailyClaimReady = dailyComplete && !daily.claimed;

  const driverLevel = Math.max(
    1,
    1 + Math.floor(save.totals.distanceMeters / 750) + Math.floor(save.totals.flipsCompleted / 3),
  );

  const activeBoostCount =
    (save.boosters.fuelSaver > 0 ? 1 : 0) +
    (save.boosters.nitroCharge > 0 ? 1 : 0) +
    (save.boosters.coinMagnet > 0 ? 1 : 0);

  const dockTabs: {
    id: 'SHOP' | 'STAGE' | 'VEHICLE' | 'TUNE';
    label: string;
    icon: React.ReactNode;
    badge?: boolean;
    screen: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>;
  }[] = [
    {
      id: 'SHOP',
      label: 'SHOP',
      icon: <ShoppingCart className="h-4 w-4 text-amber-300" />,
      badge: freeGemsReady,
      screen: 'SHOP',
    },
    {
      id: 'STAGE',
      label: 'STAGE',
      icon: <MapPin className="h-4 w-4 text-sky-300" />,
      screen: 'WORLD_MAP',
    },
    {
      id: 'VEHICLE',
      label: 'VEHICLE',
      icon: <Warehouse className="h-4 w-4 text-cyan-300" />,
      screen: 'GARAGE',
    },
    {
      id: 'TUNE',
      label: 'TUNE',
      icon: <Wrench className="h-4 w-4 text-emerald-300" />,
      screen: 'UPGRADES',
    },
  ];

  return (
    <div className="safe-screen-pad pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-2">
      {/* Top Bar: Driver Profile + Currencies + Utility Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="panel-bevel pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/15 px-2.5 py-1.5 sm:px-3">
          <DriverAvatarIcon className="h-9 w-9 shrink-0 rounded-lg border border-white/25 sm:h-10 sm:w-10" />
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-display text-sm font-extrabold tracking-wider text-white italic sm:text-base">
                RACER
              </span>
              <span className="font-mono-num inline-flex items-center gap-0.5 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-black text-amber-300">
                <RankShieldIcon className="h-3 w-3" />
                LV {driverLevel}
              </span>
            </div>
            <div className="text-[10px] font-bold tracking-widest text-sky-300 uppercase sm:text-[11px]">
              {vehicle.name} · {stage.name}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex h-10 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-white transition hover:border-amber-400/60"
            title="Tickets"
          >
            <FuelCanIcon className="h-4 w-4" />
            <span className="font-mono-num text-xs font-bold sm:text-sm">
              {save.tickets}/{MAX_TICKETS}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex h-10 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-white transition hover:border-amber-400/60"
            title="Coins"
          >
            <CoinIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-mono-num text-xs font-bold sm:text-sm">
              {save.coins.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex h-10 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-white transition hover:border-sky-400/60"
            title="Gems"
          >
            <GemIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="font-mono-num text-xs font-bold sm:text-sm">
              {save.gems.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('MISSIONS', 'MISSIONS')}
            aria-label="Open Missions"
            title="Career Missions & Season 12"
            className="panel-bevel relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-orange-300 transition hover:border-amber-400/60"
          >
            <ClipboardList className="h-4 w-4" />
            {claimableCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white">
                {claimableCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('MISSIONS', 'SEASON')}
            aria-label="Season 12 Events"
            title={`Season 12 · Tier ${activeTier.tier}`}
            className="panel-bevel hidden h-10 items-center gap-1.5 rounded-lg border border-violet-400/35 px-2.5 text-violet-200 transition hover:border-violet-300 sm:flex"
          >
            <Trophy className="h-4 w-4 text-yellow-300" />
            <span className="font-display text-xs font-extrabold tracking-wider uppercase italic">
              S12 T{activeTier.tier}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SETTINGS')}
            aria-label="Open Settings"
            className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-400/60 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-white/40 hover:text-white"
          >
            {save.muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Upper-Right Compact Title Lockup + Daily Challenge Chip (Center left unobstructed for hero vehicle) */}
      <div className="flex items-start justify-end">
        <div className="compact-title-lockup flex flex-col items-end gap-2 text-right">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2 drop-shadow-[0_6px_18px_rgba(9,13,22,0.85)]">
              <div className="flex flex-col items-end leading-[0.86]">
                <span className="font-display text-2xl font-extrabold tracking-tight text-white uppercase italic sm:text-4xl lg:text-5xl">
                  JACK HILL
                </span>
                <span className="font-display bg-gradient-to-r from-pink-400 via-amber-300 to-cyan-300 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent uppercase italic sm:text-4xl lg:text-5xl">
                  GAME
                </span>
              </div>
              <span className="font-display bg-gradient-to-b from-pink-400 via-amber-300 to-cyan-400 bg-clip-text pr-1 text-4xl leading-none font-extrabold text-transparent italic drop-shadow-[0_4px_0_rgba(120,53,15,0.95)] sm:text-6xl lg:text-7xl">
                06
              </span>
            </div>
            <div className="mt-1 flex w-full max-w-[260px] items-center gap-2 sm:max-w-[320px]">
              <div className="h-[2px] flex-1 bg-gradient-to-r from-pink-500 to-amber-400" />
              <span className="font-display text-[10px] font-extrabold tracking-[0.24em] text-cyan-300 uppercase italic sm:text-xs sm:tracking-[0.3em]">
                JACK_HILL_GAME
              </span>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-amber-400 to-cyan-400" />
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              dailyClaimReady ? onClaimDailyChallenge() : onOpenScreen('MISSIONS', 'MISSIONS')
            }
            className={`panel-bevel pointer-events-auto w-56 rounded-xl border px-3 py-2 text-left transition sm:w-64 ${
              dailyClaimReady
                ? 'border-emerald-400/80 ring-1 ring-emerald-400/50 hover:brightness-110'
                : 'border-white/15 hover:border-amber-400/60'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-extrabold tracking-widest uppercase">
              <span className={dailyClaimReady ? 'text-emerald-300' : 'text-amber-300'}>
                {dailyClaimReady
                  ? 'DAILY COMPLETE · CLAIM'
                  : daily.claimed
                    ? 'DAILY CHALLENGE · DONE'
                    : 'DAILY CHALLENGE'}
              </span>
              <span className="font-mono-num text-white">
                {dailyCurrent}/{daily.targetMeters}m
              </span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2">
              <span className="font-display text-xs font-bold text-white italic sm:text-sm">
                Reach {daily.targetMeters.toLocaleString()}m in One Run
              </span>
              {daily.claimed ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
              ) : (
                <span className="font-mono-num shrink-0 text-[10px] font-bold text-amber-300">
                  +{daily.rewardCoins}c
                </span>
              )}
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full ${
                  dailyComplete
                    ? 'bg-gradient-to-r from-emerald-400 to-green-300'
                    : 'bg-gradient-to-r from-amber-400 to-yellow-300'
                }`}
                style={{ width: `${dailyPct}%` }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Dock: Direct Vehicle Selector + Classic 4 Tabs & Prominent PLAY CTA */}
      <div className="flex flex-col gap-2">
        {/* Horizontal Vehicle Selector Strip */}
        <div className="pointer-events-auto flex max-w-full items-center self-center">
          <div className="panel-bevel frontier-scroll flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-white/15 px-2 py-1.5">
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
                  className={`flex shrink-0 items-center gap-2 rounded-lg border px-2 py-1 text-left transition ${
                    selected
                      ? 'border-amber-300 bg-amber-400/20 text-white shadow-[0_0_12px_rgba(251,191,36,0.28)]'
                      : unlocked
                        ? 'border-white/15 bg-slate-900/90 text-slate-200 hover:border-white/40 hover:text-white'
                        : 'border-white/10 bg-slate-950/85 text-slate-400 hover:border-amber-400/45 hover:text-slate-200'
                  }`}
                >
                  <VehicleSilhouetteIcon
                    vehicleId={v.id}
                    color={paintHex}
                    className="h-4 w-8 shrink-0 sm:h-5 sm:w-9"
                  />
                  <div className="leading-tight">
                    <div className="font-display flex items-center gap-1 text-[11px] font-extrabold tracking-wide whitespace-nowrap uppercase italic">
                      <span>{v.name}</span>
                      {!unlocked && <Lock className="h-3 w-3 text-amber-400" />}
                    </div>
                    <div className="font-mono-num text-[9px] font-bold whitespace-nowrap text-slate-400">
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

        {/* Classic Arcade Dock: 4 Primary Tabs + PLAY CTA */}
        <div className="flex flex-col-reverse items-stretch justify-between gap-2 sm:flex-row sm:items-end">
          {/* 4 Classic Pill Tabs */}
          <nav
            aria-label="Primary Garage and Stage Tabs"
            className="panel-bevel pointer-events-auto grid grid-cols-4 gap-1.5 rounded-2xl border border-white/15 p-1.5 sm:flex sm:items-center sm:gap-2"
          >
            {dockTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onOpenScreen(tab.screen)}
                className="relative flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl border border-white/10 bg-slate-900/90 px-2.5 py-1.5 text-white transition hover:border-amber-400/70 sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5"
              >
                {tab.icon}
                <span className="font-display text-xs font-extrabold tracking-wider whitespace-nowrap uppercase italic sm:text-sm">
                  {tab.label}
                </span>
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-extrabold text-white">
                    !
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Primary PLAY CTA */}
          <div className="pointer-events-auto flex flex-col items-stretch gap-1 sm:items-end">
            {activeBoostCount > 0 && (
              <div className="panel-bevel self-center rounded-md border border-emerald-400/40 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-300 uppercase sm:self-end">
                {activeBoostCount} Booster{activeBoostCount > 1 ? 's' : ''} Armed
              </div>
            )}
            <button
              type="button"
              onClick={onPlay}
              className="group relative flex min-w-[200px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 px-8 py-2.5 shadow-[0_6px_0_#92400e,0_14px_24px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_2px_0_#92400e] sm:min-w-[240px] sm:py-3"
            >
              <span className="font-display text-2xl font-extrabold tracking-wider text-slate-950 italic sm:text-3xl">
                PLAY
              </span>
              <span className="font-mono-num text-[11px] font-extrabold whitespace-nowrap text-slate-900">
                BEST: {stageBest}m · {stage.name.toUpperCase()}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
