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
} from 'lucide-react';
import { MAX_TICKETS, SEASON_TIERS } from '../game/constants';
import { countClaimableRewards, getFreeGemsRemainingMs } from '../game/storage';
import { GameScreen, SaveData, StageConfig, VehicleConfig } from '../types/game';
import {
  CoinIcon,
  DriverAvatarIcon,
  FuelCanIcon,
  GemIcon,
  VehicleSilhouetteIcon,
} from './GameIcons';

interface TitleOverlayProps {
  save: SaveData;
  stage: StageConfig;
  vehicle: VehicleConfig;
  onPlay: () => void;
  onOpenScreen: (screen: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>) => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  stage,
  vehicle,
  onPlay,
  onOpenScreen,
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

  const navItems: {
    id: 'SHOP' | 'GARAGE' | 'UPGRADES' | 'MISSIONS' | 'EVENTS' | 'TUNING';
    label: string;
    icon: React.ReactNode;
    badge?: number | boolean;
    screen: Exclude<GameScreen, 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER'>;
  }[] = [
    {
      id: 'SHOP',
      label: 'SHOP',
      icon: <ShoppingCart className="w-5 h-5 text-amber-300" />,
      badge: freeGemsReady,
      screen: 'SHOP',
    },
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
      id: 'MISSIONS',
      label: 'MISSIONS',
      icon: <ClipboardList className="w-5 h-5 text-orange-300" />,
      badge: claimableCount > 0 ? claimableCount : false,
      screen: 'MISSIONS',
    },
    {
      id: 'EVENTS',
      label: 'EVENTS',
      icon: <Trophy className="w-5 h-5 text-yellow-300" />,
      screen: 'MISSIONS',
    },
    {
      id: 'TUNING',
      label: 'TUNING',
      icon: <Sliders className="w-5 h-5 text-violet-300" />,
      screen: 'TUNING',
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
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-white/15 bg-slate-950/85 px-3 py-2 shadow-xl">
          <DriverAvatarIcon className="h-10 w-10 shrink-0 rounded-lg border border-white/20" />
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-wider text-white">
              RACER
            </div>
            <div className="text-[11px] font-semibold tracking-widest text-amber-300 uppercase">
              {vehicle.vehicleClass} · {vehicle.name}
            </div>
          </div>
        </div>

        {/* Currency & Utility Strip */}
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/85 px-3 py-1.5 text-white shadow-lg transition hover:border-amber-400/60"
          >
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/85 px-3 py-1.5 text-white shadow-lg transition hover:border-sky-400/60"
          >
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onOpenScreen('SHOP')}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/85 px-3 py-1.5 text-white shadow-lg transition hover:border-red-400/60"
            title="Adventure Fuel Tickets"
          >
            <FuelCanIcon className="h-4 w-4" />
            <span className="font-mono-num text-sm font-bold">
              {save.tickets}/{MAX_TICKETS}
            </span>
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-slate-950/85 text-slate-200 shadow-lg transition hover:border-white/40 hover:text-white"
          >
            {save.muted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Middle Zone: Left Vertical Nav + Right-Sky Title Lockup */}
      <div className="my-auto flex items-center justify-between gap-4 py-2">
        {/* Left Navigation Stack */}
        <nav
          aria-label="Main Menu"
          className="pointer-events-auto flex flex-col gap-2"
        >
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onOpenScreen(item.screen)}
              className="group relative flex w-36 items-center gap-3 rounded-xl border border-white/15 bg-slate-950/85 px-3.5 py-2.5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-amber-400/60 hover:bg-slate-900"
            >
              {item.icon}
              <span className="font-display text-sm font-bold tracking-wider text-white">
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

        {/* Right Sky Logo Lockup (framed in open negative space) */}
        <div className="hidden max-w-md flex-col items-end pr-2 text-right sm:flex lg:max-w-lg lg:pr-6">
          <div className="flex items-center gap-2 drop-shadow-[0_6px_18px_rgba(15,23,42,0.75)]">
            <div className="flex flex-col items-end leading-[0.88]">
              <span className="font-display -skew-x-6 text-4xl font-black tracking-tight text-white uppercase lg:text-5xl">
                HILL CLIMB
              </span>
              <span className="font-display -skew-x-6 text-4xl font-black tracking-tight text-white uppercase lg:text-5xl">
                RACING
              </span>
            </div>
            <span className="font-display -skew-x-6 bg-gradient-to-b from-yellow-300 via-amber-400 to-orange-500 bg-clip-text text-7xl font-black text-transparent drop-shadow-[0_4px_0_rgba(120,53,15,0.9)] lg:text-8xl">
              3
            </span>
          </div>
          <div className="mt-2 flex w-full max-w-[330px] items-center gap-3">
            <div className="h-[2px] flex-1 bg-white/75" />
            <span className="font-display text-sm font-bold tracking-[0.38em] text-white uppercase drop-shadow">
              FRONTIER
            </span>
            <div className="h-[2px] flex-1 bg-white/75" />
          </div>
        </div>
      </div>

      {/* Bottom Dock: Season 12 Card | PLAY CTA | ADVENTURE Map */}
      <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-end">
        {/* Season 12 Card */}
        <button
          type="button"
          onClick={() => onOpenScreen('MISSIONS')}
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-violet-400/35 bg-slate-950/88 px-3.5 py-2.5 text-left shadow-xl transition hover:border-violet-300"
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
            <div className="font-display text-base font-extrabold tracking-wide text-white">
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
            <div className="rounded-md border border-emerald-400/40 bg-slate-950/85 px-2.5 py-0.5 text-[11px] font-bold tracking-wider text-emerald-300 uppercase">
              {activeBoostCount} Booster{activeBoostCount > 1 ? 's' : ''} Armed
            </div>
          )}
          <button
            type="button"
            onClick={onPlay}
            className="group relative flex min-w-[230px] flex-col items-center justify-center rounded-2xl border-2 border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 px-10 py-3 shadow-[0_8px_0_#92400e,0_16px_28px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_3px_0_#92400e]"
          >
            <span className="font-display text-3xl font-black tracking-wider text-slate-950">
              PLAY
            </span>
            <span className="font-mono-num text-xs font-bold text-slate-900">
              BEST: {stageBest}m · {stage.name.toUpperCase()}
            </span>
          </button>
        </div>

        {/* Adventure World Map CTA */}
        <button
          type="button"
          onClick={() => onOpenScreen('WORLD_MAP')}
          className="pointer-events-auto flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-slate-950/88 px-5 py-3 shadow-xl transition hover:-translate-y-0.5 hover:border-sky-400/60 hover:bg-slate-900"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/20 text-sky-300">
            <MapPin className="h-6 w-6" />
          </div>
          <div className="text-left">
            <div className="text-[10px] font-bold tracking-widest text-sky-300 uppercase">
              4 STAGES
            </div>
            <div className="font-display text-base font-extrabold tracking-wider text-white">
              ADVENTURE
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
