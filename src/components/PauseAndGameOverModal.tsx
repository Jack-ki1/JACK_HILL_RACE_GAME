import React from 'react';
import { Home, Play, RotateCcw, Trophy, Warehouse } from 'lucide-react';
import { RunSummary } from '../types/game';
import { CoinIcon } from './GameIcons';

interface PauseModalProps {
  stageName: string;
  onResume: () => void;
  onRestart: () => void;
  onOpenGarage: () => void;
  onGoHome: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stageName,
  onResume,
  onRestart,
  onOpenGarage,
  onGoHome,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/78 p-4">
    <div className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-950 p-6 text-white shadow-2xl">
      <div className="text-center">
        <div className="text-xs font-bold tracking-widest text-amber-300 uppercase">
          {stageName}
        </div>
        <h2 className="mt-1 font-display text-3xl font-black tracking-wider uppercase">
          PAUSED
        </h2>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 py-3 font-display text-base font-black tracking-wider text-slate-950 uppercase shadow-lg hover:brightness-105"
        >
          <Play className="h-5 w-5 fill-current" />
          RESUME
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900 py-3 font-display text-sm font-bold tracking-wider uppercase hover:border-white/40"
        >
          <RotateCcw className="h-4 w-4" />
          RESTART STAGE
        </button>

        <button
          type="button"
          onClick={onOpenGarage}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900 py-3 font-display text-sm font-bold tracking-wider uppercase hover:border-sky-400"
        >
          <Warehouse className="h-4 w-4 text-sky-300" />
          GARAGE
        </button>

        <button
          type="button"
          onClick={onGoHome}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900 py-3 font-display text-sm font-bold tracking-wider text-slate-300 uppercase hover:border-white/40 hover:text-white"
        >
          <Home className="h-4 w-4" />
          MAIN MENU
        </button>
      </div>
    </div>
  </div>
);

interface GameOverModalProps {
  summary: RunSummary;
  onRetry: () => void;
  onOpenGarage: () => void;
  onGoHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  onRetry,
  onOpenGarage,
  onGoHome,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4">
    <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-950 p-6 text-white shadow-2xl">
      <div className="text-center">
        <div className="inline-block rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-extrabold tracking-widest text-rose-300 uppercase">
          {summary.reason}
        </div>
        <h2 className="mt-2 font-display text-3xl font-black tracking-wider uppercase">
          RUN COMPLETE
        </h2>
        <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {summary.stageName}
        </p>
      </div>

      {/* Main Distance Result */}
      <div className="mt-5 rounded-2xl border border-amber-400/35 bg-slate-900 p-4 text-center">
        {summary.isNewBest && (
          <div className="mb-1 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-0.5 text-[11px] font-black tracking-wider text-slate-950 uppercase">
            <Trophy className="h-3.5 w-3.5" />
            NEW STAGE RECORD!
          </div>
        )}
        <div className="font-mono-num text-4xl font-black text-white">
          {summary.distanceMeters}m
        </div>
        <div className="mt-0.5 font-mono-num text-xs font-bold text-slate-400">
          STAGE BEST: {summary.stageBestMeters}m
        </div>
      </div>

      {/* Telemetry Stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-slate-900 p-3 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            COINS
          </div>
          <div className="mt-1 flex items-center justify-center gap-1 font-mono-num text-base font-black text-amber-300">
            <CoinIcon className="h-4 w-4" />+{summary.coinsEarned}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-3 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            FLIPS
          </div>
          <div className="mt-1 font-mono-num text-base font-black text-sky-300">
            {summary.flips}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-slate-900 p-3 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            TOP SPEED
          </div>
          <div className="mt-1 font-mono-num text-base font-black text-emerald-300">
            {summary.maxSpeedKmh} km/h
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 py-3.5 font-display text-base font-black tracking-wider text-slate-950 uppercase shadow-lg hover:brightness-105"
        >
          <RotateCcw className="h-5 w-5" />
          RACE AGAIN
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenGarage}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900 py-2.5 font-display text-sm font-bold tracking-wider uppercase hover:border-sky-400"
          >
            <Warehouse className="h-4 w-4 text-sky-300" />
            GARAGE
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-slate-900 py-2.5 font-display text-sm font-bold tracking-wider text-slate-300 uppercase hover:border-white/40 hover:text-white"
          >
            <Home className="h-4 w-4" />
            MENU
          </button>
        </div>
      </div>
    </div>
  </div>
);
