import React from 'react';
import { Home, Play, RotateCcw, Settings, Smartphone, Trophy, Warehouse } from 'lucide-react';
import { motion } from 'motion/react';
import { RunSummary, TouchControlsMode } from '../types/game';
import { CoinIcon } from './GameIcons';

interface PauseModalProps {
  stageName: string;
  touchControlsMode: TouchControlsMode;
  onCycleTouchControls: () => void;
  onResume: () => void;
  onRestart: () => void;
  onOpenPaddock: () => void;
  onOpenSettings: () => void;
  onGoHome: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  stageName,
  touchControlsMode,
  onCycleTouchControls,
  onResume,
  onRestart,
  onOpenPaddock,
  onOpenSettings,
  onGoHome,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/80 p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.16 }}
      className="panel-bevel w-full max-w-sm rounded-2xl border border-white/20 p-6 text-white shadow-2xl"
    >
      <div className="text-center">
        <div className="text-xs font-bold tracking-widest text-amber-300 uppercase">
          {stageName}
        </div>
        <h2 className="mt-1 font-display text-3xl font-extrabold tracking-wider uppercase italic">
          PAUSED
        </h2>
      </div>

      <div className="mt-6 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onResume}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] py-3 font-display text-base font-black tracking-wider text-slate-950 uppercase italic shadow-lg hover:brightness-105"
        >
          <Play className="h-5 w-5 fill-current" />
          RESUME
        </button>

        <button
          type="button"
          onClick={onRestart}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] py-3 font-display text-sm font-bold tracking-wider uppercase hover:border-white/40"
        >
          <RotateCcw className="h-4 w-4" />
          RESTART CLIMB
        </button>

        <button
          type="button"
          onClick={onCycleTouchControls}
          className="flex w-full items-center justify-between rounded-xl border border-white/15 bg-[#111923] px-3.5 py-2.5 font-display text-xs font-bold tracking-wider uppercase hover:border-emerald-400"
        >
          <span className="flex items-center gap-2 text-slate-200">
            <Smartphone className="h-4 w-4 text-emerald-300" />
            TOUCH PEDALS
          </span>
          <span className="font-mono-num rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-black text-emerald-300">
            {touchControlsMode.toUpperCase()}
          </span>
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenPaddock}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] py-3 font-display text-sm font-bold tracking-wider uppercase hover:border-sky-400"
          >
            <Warehouse className="h-4 w-4 text-sky-300" />
            PADDOCK
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] py-3 font-display text-sm font-bold tracking-wider uppercase hover:border-amber-400"
          >
            <Settings className="h-4 w-4 text-amber-300" />
            SETTINGS
          </button>
        </div>

        <button
          type="button"
          onClick={onGoHome}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] py-3 font-display text-sm font-bold tracking-wider text-slate-300 uppercase hover:border-white/40 hover:text-white"
        >
          <Home className="h-4 w-4" />
          SHOWROOM
        </button>
      </div>
    </motion.div>
  </div>
);

interface GameOverModalProps {
  summary: RunSummary;
  onRetry: () => void;
  onOpenPaddock: () => void;
  onGoHome: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  summary,
  onRetry,
  onOpenPaddock,
  onGoHome,
}) => (
  <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/82 p-4">
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="panel-bevel w-full max-w-md rounded-2xl border border-white/20 p-6 text-white shadow-2xl"
    >
      <div className="text-center">
        <div className="inline-block rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1 text-xs font-extrabold tracking-widest text-rose-300 uppercase">
          {summary.reason}
        </div>
        <h2 className="mt-2 font-display text-3xl font-extrabold tracking-wider uppercase italic">
          CLIMB ENDED
        </h2>
        <p className="text-xs font-bold tracking-widest text-slate-400 uppercase">
          {summary.stageName}
        </p>
      </div>

      {/* Main Distance Result */}
      <div className="mt-5 rounded-2xl border border-amber-400/40 bg-[#111923] p-4 text-center">
        {summary.isNewBest && (
          <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-amber-400 px-2.5 py-0.5 text-[11px] font-black tracking-wider text-slate-950 uppercase">
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
        {summary.aiMarginMeters !== null && (
          <div
            className={`mt-1.5 font-mono-num text-xs font-extrabold uppercase ${
              summary.aiMarginMeters >= 0 ? 'text-emerald-300' : 'text-cyan-300'
            }`}
          >
            {summary.aiMarginMeters >= 0
              ? `BEAT AI RACER BY +${summary.aiMarginMeters}m`
              : `AI RACER LED BY +${Math.abs(summary.aiMarginMeters)}m`}
          </div>
        )}
      </div>

      {/* 4 Telemetry Stats */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            COINS
          </div>
          <div className="mt-1 flex items-center justify-center gap-1 font-mono-num text-sm font-black text-amber-300">
            <CoinIcon className="h-3.5 w-3.5" />+{summary.coinsEarned}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            FLIPS
          </div>
          <div className="mt-1 font-mono-num text-sm font-black text-sky-300">
            {summary.flips}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            TOP SPEED
          </div>
          <div className="mt-1 font-mono-num text-sm font-black text-emerald-300">
            {summary.maxSpeedKmh} km/h
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5 text-center">
          <div className="text-[10px] font-bold text-slate-400 uppercase">
            AIR TIME
          </div>
          <div className="mt-1 font-mono-num text-sm font-black text-violet-300">
            {summary.airTimeTotal.toFixed(1)}s
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] py-3.5 font-display text-base font-black tracking-wider text-slate-950 uppercase italic shadow-lg hover:brightness-105"
        >
          <RotateCcw className="h-5 w-5" />
          CLIMB AGAIN
        </button>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onOpenPaddock}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] py-2.5 font-display text-sm font-bold tracking-wider uppercase hover:border-sky-400"
          >
            <Warehouse className="h-4 w-4 text-sky-300" />
            PADDOCK
          </button>

          <button
            type="button"
            onClick={onGoHome}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] py-2.5 font-display text-sm font-bold tracking-wider text-slate-300 uppercase hover:border-white/40 hover:text-white"
          >
            <Home className="h-4 w-4" />
            SHOWROOM
          </button>
        </div>
      </div>
    </motion.div>
  </div>
);
