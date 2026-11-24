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

  const menuActions: {
    id: 'GARAGE' | 'STAGE' | 'UPGRADES' | 'SHOP';
    label: string;
    detail: string;
    icon: React.ReactNode;
    badge?: boolean;
    screen: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>;
  }[] = [
    {
      id: 'GARAGE',
      label: 'GARAGE',
      detail: vehicle.name,
      icon: <Warehouse className="h-4 w-4 text-amber-300" />,
      screen: 'GARAGE',
    },
    {
      id: 'STAGE',
      label: 'STAGES',
      detail: stage.name,
      icon: <MapPin className="h-4 w-4 text-sky-300" />,
      screen: 'WORLD_MAP',
    },
    {
      id: 'UPGRADES',
      label: 'UPGRADES',
      detail: 'TUNE RIG',
      icon: <Wrench className="h-4 w-4 text-emerald-300" />,
      screen: 'UPGRADES',
    },
    {
      id: 'SHOP',
      label: 'SHOP',
      detail: freeGemsReady ? 'FREE GEMS' : 'BOOSTS',
      icon: <ShoppingCart className="h-4 w-4 text-amber-300" />,
      badge: freeGemsReady,
      screen: 'SHOP',
    },
  ];

  return (
    <div className="safe-screen-pad pointer-events-none absolute inset-0 z-10 flex flex-col justify-between gap-2">
      {/* Top Bar: Compact Driver Profile + Currency & Utility Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="panel-bevel pointer-events-auto flex items-center gap-2.5 rounded-sm border border-white/15 px-2.5 py-1.5 sm:px-3">
          <DriverAvatarIcon className="h-9 w-9 shrink-0 rounded-sm border border-white/25 sm:h-10 sm:w-10" />
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg leading-none font-bold tracking-wider text-white uppercase sm:text-xl">
                RACER
              </span>
              <span className="font-mono-num inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 tabular-nums">
                <RankShieldIcon className="h-3 w-3 shrink-0" />
                LV {driverLevel}
              </span>
            </div>
            <div className="text-[10px] font-bold tracking-[0.14em] whitespace-nowrap text-slate-300 uppercase sm:text-[11px]">
              {vehicle.name} · {stage.name}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex min-h-[44px] items-center gap-1.5 rounded-sm border border-white/15 px-2.5 text-white transition hover:border-amber-400/70"
            title="Tickets"
          >
            <FuelCanIcon className="h-4 w-4 shrink-0" />
            <span className="font-mono-num text-xs font-bold whitespace-nowrap tabular-nums sm:text-sm">
              {save.tickets}/{MAX_TICKETS}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex min-h-[44px] items-center gap-1.5 rounded-sm border border-white/15 px-2.5 text-white transition hover:border-amber-400/70"
            title="Coins"
          >
            <CoinIcon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
            <span className="font-mono-num text-xs font-bold whitespace-nowrap tabular-nums sm:text-sm">
              {save.coins.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="panel-bevel flex min-h-[44px] items-center gap-1.5 rounded-sm border border-white/15 px-2.5 text-white transition hover:border-sky-400/70"
            title="Gems"
          >
            <GemIcon className="h-4 w-4 shrink-0 sm:h-5 sm:w-5" />
            <span className="font-mono-num text-xs font-bold whitespace-nowrap tabular-nums sm:text-sm">
              {save.gems.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('MISSIONS', 'MISSIONS')}
            aria-label="Open Missions"
            title="Career Missions & Season 12"
            className="panel-bevel relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/15 text-amber-300 transition hover:border-amber-400/70"
          >
            <ClipboardList className="h-4 w-4" />
            {claimableCount > 0 && (
              <span className="font-mono-num absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-red-600 px-1 text-[10px] font-bold text-white tabular-nums">
                {claimableCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('MISSIONS', 'SEASON')}
            aria-label="Season 12 Events"
            title={`Season 12 · Tier ${activeTier.tier}`}
            className="panel-bevel hidden min-h-[44px] items-center gap-1.5 rounded-sm border border-white/15 px-2.5 text-slate-100 transition hover:border-amber-400/70 sm:flex"
          >
            <Trophy className="h-4 w-4 shrink-0 text-amber-300" />
            <span className="font-display text-base leading-none font-bold tracking-wider whitespace-nowrap uppercase">
              S12 T{activeTier.tier}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SETTINGS')}
            aria-label="Open Settings"
            className="panel-bevel flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/15 text-slate-200 transition hover:border-amber-400/70 hover:text-white"
          >
            <Settings className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="panel-bevel flex min-h-[44px] min-w-[44px] items-center justify-center rounded-sm border border-white/15 text-slate-200 transition hover:border-white/40 hover:text-white"
          >
            {save.muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Center-Right Vertical Menu Column (Leaves Left & Center Unobstructed for 3/4 Crawling Rig) */}
      <div className="flex flex-1 items-center justify-end py-1">
        <div className="compact-title-lockup pointer-events-auto flex w-56 flex-col items-stretch sm:w-64">
          {/* Upright Industrial Condensed Stacked Wordmark */}
          <div className="mb-3 flex flex-col items-center text-center drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]">
            <span className="font-display text-5xl leading-[0.78] font-bold tracking-[0.04em] text-stone-100 uppercase sm:text-6xl">
              JACK
            </span>
            <span className="font-display text-6xl leading-[0.78] font-bold tracking-[0.04em] text-white uppercase sm:text-7xl">
              HILL
            </span>
            <span className="font-display mt-0.5 text-2xl leading-none font-semibold tracking-[0.18em] text-amber-300 uppercase sm:text-3xl">
              CRAWL GAME
            </span>
          </div>

          {/* Primary Sharp Amber PLAY Bar */}
          <button
            type="button"
            onClick={onPlay}
            className="flex min-h-[52px] w-full flex-col items-center justify-center rounded-sm bg-amber-500 px-5 py-2 text-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.5)] transition hover:bg-amber-400 active:translate-y-0.5"
          >
            <span className="font-display text-3xl leading-none font-bold tracking-widest uppercase sm:text-4xl">
              PLAY
            </span>
            <span className="font-mono-num mt-0.5 text-[10px] font-bold tracking-wider whitespace-nowrap text-slate-900 tabular-nums">
              BEST {stageBest}M · {stage.name.toUpperCase()}
              {activeBoostCount > 0 ? ` · ${activeBoostCount} BOOST` : ''}
            </span>
          </button>

          {/* Hairline-Divided Crisp Menu Stack */}
          <nav
            aria-label="Main Menu Actions"
            className="mt-1 flex flex-col divide-y divide-amber-400/20 bg-slate-950/70"
          >
            {menuActions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenScreen(item.screen)}
                className="group flex min-h-[44px] items-center justify-between px-3 py-1.5 text-left transition hover:bg-amber-500/15"
              >
                <span className="flex items-center gap-2">
                  {item.icon}
                  <span className="font-display text-2xl leading-none font-semibold tracking-wider whitespace-nowrap text-stone-100 uppercase group-hover:text-amber-300">
                    {item.label}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="font-mono-num text-[10px] font-bold tracking-wider whitespace-nowrap text-slate-400 uppercase group-hover:text-slate-200">
                    {item.detail}
                  </span>
                  {item.badge && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                  )}
                </span>
              </button>
            ))}

            {/* Compact Daily Challenge Row */}
            <button
              type="button"
              onClick={() =>
                dailyClaimReady ? onClaimDailyChallenge() : onOpenScreen('MISSIONS', 'MISSIONS')
              }
              className="flex min-h-[44px] items-center justify-between px-3 py-1.5 text-left transition hover:bg-amber-500/15"
            >
              <span className="flex flex-col leading-tight">
                <span
                  className={`text-[10px] font-bold tracking-widest uppercase ${
                    dailyClaimReady
                      ? 'text-emerald-300'
                      : daily.claimed
                        ? 'text-slate-400'
                        : 'text-amber-300'
                  }`}
                >
                  {dailyClaimReady
                    ? 'CLAIM DAILY'
                    : daily.claimed
                      ? 'DAILY DONE'
                      : 'DAILY RUN'}
                </span>
                <span className="font-mono-num text-[11px] font-bold text-stone-200 tabular-nums">
                  {dailyCurrent}/{daily.targetMeters}m
                </span>
              </span>
              {daily.claimed ? (
                <Check className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <span className="font-mono-num text-xs font-bold whitespace-nowrap text-amber-300 tabular-nums">
                  +{daily.rewardCoins}c
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Bottom-Left Compact 7-Vehicle Quick-Switch Strip */}
      <div className="flex items-end justify-start">
        <div className="panel-bevel frontier-scroll pointer-events-auto flex max-w-full items-center gap-1.5 overflow-x-auto rounded-sm border border-white/15 px-2 py-1.5">
          {VEHICLES.map((v) => {
            const unlocked = save.unlockedVehicles[v.id];
            const selected = save.selectedVehicle === v.id;
            const paintHex =
              PAINT_SWATCHES.find((p) => p.id === save.vehiclePaints[v.id])?.primary ?? '#d92b1e';
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
                className={`flex min-h-[44px] shrink-0 items-center gap-2 rounded-sm border px-2.5 py-1 text-left transition ${
                  selected
                    ? 'border-amber-400 bg-amber-500/20 text-white'
                    : unlocked
                      ? 'border-white/15 bg-slate-900/90 text-slate-200 hover:border-white/40 hover:text-white'
                      : 'border-white/10 bg-slate-950/90 text-slate-400 hover:border-amber-400/50 hover:text-slate-200'
                }`}
              >
                <VehicleSilhouetteIcon
                  vehicleId={v.id}
                  color={paintHex}
                  className="h-4 w-8 shrink-0 sm:h-5 sm:w-9"
                />
                <div className="leading-tight">
                  <div className="font-display flex items-center gap-1 text-base leading-none font-semibold tracking-wide whitespace-nowrap uppercase">
                    <span>{v.name}</span>
                    {!unlocked && <Lock className="h-3 w-3 shrink-0 text-amber-400" />}
                  </div>
                  <div className="font-mono-num text-[10px] font-bold whitespace-nowrap tabular-nums">
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
    </div>
  );
};
