import React from 'react';
import { Flag, Play, Settings, Volume2, VolumeX } from 'lucide-react';
import { SaveData, StageConfig, VehicleConfig } from '../types/game';

interface TitleOverlayProps {
  save: SaveData;
  stage: StageConfig;
  vehicle: VehicleConfig;
  onEnterPaddock: () => void;
  onQuickClimb: () => void;
  onOpenSettings: () => void;
  onToggleMute: () => void;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  save,
  stage,
  vehicle,
  onEnterPaddock,
  onQuickClimb,
  onOpenSettings,
  onToggleMute,
}) => {
  return (
    <div className="safe-screen-pad pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
      {/* Top Bar: Minimal Showroom Header + Settings & Audio Icons Only */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto drop-shadow-[0_4px_18px_rgba(0,0,0,0.85)]">
          <div className="text-[11px] font-bold tracking-[0.22em] text-amber-300 uppercase">
            Neural Hill-Climb Telemetry
          </div>
          <h1 className="font-display mt-0.5 text-5xl leading-[0.84] font-bold tracking-wider text-white uppercase sm:text-6xl">
            JACK HILL CRAWL
          </h1>
          <p className="mt-1.5 max-w-md text-xs font-medium text-slate-200/90 sm:text-sm">
            Steep crest ascents, loose traction physics, and an adaptive neural driver trained by your climbs.
          </p>
        </div>

        <div className="pointer-events-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={save.muted ? 'Unmute audio' : 'Mute audio'}
            title={save.muted ? 'Unmute audio' : 'Mute audio'}
            className="panel-bevel flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-white/40 hover:text-white"
          >
            {save.muted ? (
              <VolumeX className="h-5 w-5 text-rose-400" />
            ) : (
              <Volume2 className="h-5 w-5 text-emerald-400" />
            )}
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open Settings"
            title="Settings & Controls"
            className="panel-bevel flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-400/70 hover:text-white"
          >
            <Settings className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Bottom Primary Showroom Navigation Only (Center Unobstructed for Rotating Circular Turntable) */}
      <div className="flex flex-col items-center gap-2.5 pb-1">
        <div className="pointer-events-auto flex w-full max-w-md flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={onEnterPaddock}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-lg bg-amber-500 px-6 py-3 text-slate-950 shadow-[0_12px_28px_rgba(0,0,0,0.55)] transition hover:bg-amber-400 active:translate-y-0.5"
          >
            <Flag className="h-5 w-5 shrink-0" />
            <span className="font-display text-2xl leading-none font-bold tracking-widest whitespace-nowrap uppercase">
              ENTER PADDOCK
            </span>
          </button>

          <button
            type="button"
            onClick={onQuickClimb}
            className="panel-bevel flex min-h-[52px] flex-1 items-center justify-center gap-2.5 rounded-lg border border-white/25 px-6 py-3 text-white shadow-[0_12px_28px_rgba(0,0,0,0.5)] transition hover:border-amber-400/80 hover:text-amber-300 active:translate-y-0.5"
          >
            <Play className="h-5 w-5 shrink-0 fill-current text-amber-400" />
            <span className="font-display text-2xl leading-none font-bold tracking-widest whitespace-nowrap uppercase">
              QUICK CLIMB
            </span>
          </button>
        </div>

        <div className="text-center text-[11px] font-semibold tracking-[0.14em] text-slate-300/90 uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          {vehicle.name} · {stage.name} · {stage.summitMeters}m Summit
        </div>
      </div>
    </div>
  );
};
