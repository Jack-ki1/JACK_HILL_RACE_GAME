import React from 'react';
import { Award, Flag, Home, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { MedalTier, SummitAnalytics } from '../types/game';
import { CoinIcon } from './GameIcons';

interface SummitModalProps {
  analytics: SummitAnalytics;
  onClimbAgain: () => void;
  onOpenPaddock: () => void;
  onGoShowroom: () => void;
}

const MEDAL_STYLE: Record<
  MedalTier,
  { label: string; border: string; bg: string; text: string }
> = {
  GOLD: {
    label: 'GOLD SUMMIT MEDAL',
    border: 'border-amber-400',
    bg: 'bg-amber-500/20',
    text: 'text-amber-300',
  },
  SILVER: {
    label: 'SILVER SUMMIT MEDAL',
    border: 'border-slate-300',
    bg: 'bg-slate-400/20',
    text: 'text-slate-200',
  },
  BRONZE: {
    label: 'BRONZE SUMMIT MEDAL',
    border: 'border-orange-400',
    bg: 'bg-orange-500/20',
    text: 'text-orange-300',
  },
  FINISHER: {
    label: 'SUMMIT FINISHER',
    border: 'border-emerald-400',
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-300',
  },
};

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(2).padStart(5, '0')}`;
}

export const SummitModal: React.FC<SummitModalProps> = ({
  analytics,
  onClimbAgain,
  onOpenPaddock,
  onGoShowroom,
}) => {
  const medal = MEDAL_STYLE[analytics.medal];
  const masteryGain = Math.max(0, analytics.masteryAfter - analytics.masteryBefore);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm sm:p-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="panel-bevel frontier-scroll max-h-[94dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/20 p-5 text-white shadow-2xl"
      >
        {/* Medal Header */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1 text-xs font-extrabold tracking-widest uppercase ${medal.border} ${medal.bg} ${medal.text}`}
          >
            {analytics.medal === 'GOLD' ? (
              <Trophy className="h-4 w-4" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            <span>{medal.label}</span>
          </div>

          <h2 className="font-display mt-2 text-3xl leading-none font-extrabold tracking-wider uppercase sm:text-4xl">
            SUMMIT REACHED
          </h2>
          <p className="mt-1 text-xs font-semibold tracking-wider text-slate-300 uppercase">
            {analytics.stageName} · {analytics.weather.toUpperCase()} · {analytics.timeOfDay.toUpperCase()}
          </p>
        </div>

        {/* Hero Time + Margin */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/35 bg-[#111923] px-4 py-3">
          <div>
            <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Official Climb Time
            </div>
            <div className="font-mono-num text-3xl font-black text-white tabular-nums">
              {formatClock(analytics.climbTimeSec)}
            </div>
          </div>

          <div className="text-right">
            <div className="flex items-center justify-end gap-1 font-mono-num text-sm font-black text-amber-300 tabular-nums">
              <CoinIcon className="h-4 w-4" />+{analytics.coinsEarned.toLocaleString()}
            </div>
            {analytics.aiMarginMeters !== null && (
              <div
                className={`mt-0.5 font-mono-num text-xs font-bold tabular-nums ${
                  analytics.aiMarginMeters >= 0 ? 'text-emerald-300' : 'text-cyan-300'
                }`}
              >
                {analytics.aiMarginMeters >= 0
                  ? `Beat AI by +${analytics.aiMarginMeters}m`
                  : `AI led by ${Math.abs(analytics.aiMarginMeters)}m`}
              </div>
            )}
          </div>
        </div>

        {/* Telemetry Metrics Grid */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Top Speed</div>
            <div className="font-mono-num mt-0.5 text-base font-black text-emerald-300 tabular-nums">
              {analytics.topSpeedKmh} km/h
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Avg Speed</div>
            <div className="font-mono-num mt-0.5 text-base font-black text-sky-300 tabular-nums">
              {analytics.avgSpeedKmh} km/h
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Clean Line</div>
            <div className="font-mono-num mt-0.5 text-base font-black text-amber-300 tabular-nums">
              {analytics.cleanLinePct}%
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Wheelspin Dist</div>
            <div className="font-mono-num mt-0.5 text-base font-black text-orange-300 tabular-nums">
              {analytics.wheelspinDistMeters.toFixed(1)}m
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Tire Health</div>
            <div className="font-mono-num mt-0.5 text-base font-black text-cyan-300 tabular-nums">
              {Math.round(analytics.tireHealthRemaining)}%
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#111923] p-2.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase">Stunt Flips</div>
            <div className="font-mono-num mt-0.5 text-base font-black text-violet-300 tabular-nums">
              {analytics.flips}
            </div>
          </div>
        </div>

        {/* Sector Splits */}
        <div className="mt-3 rounded-xl border border-white/10 bg-[#111923] p-3">
          <div className="mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            Sector Splits
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {analytics.sectorSplits.map((split, idx) => (
              <div key={idx} className="rounded-lg bg-slate-950/75 px-2 py-1.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Sector {idx + 1}
                </div>
                <div className="font-mono-num text-xs font-extrabold text-white tabular-nums">
                  {formatClock(split)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Mastery & Vehicle/Terrain Evolution Bonuses */}
        <div className="mt-3 rounded-xl border border-cyan-500/35 bg-cyan-950/20 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-display text-base font-bold tracking-wide text-cyan-200 uppercase">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              AI Hill Mastery
            </div>
            <div className="font-mono-num text-xs font-extrabold text-emerald-300 tabular-nums">
              {analytics.masteryBefore}% → {analytics.masteryAfter}% (+{masteryGain}%)
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5 text-center sm:grid-cols-4">
            <div className="rounded bg-slate-950/75 px-2 py-1">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Torque</div>
              <div className="font-mono-num text-xs font-bold text-amber-300 tabular-nums">
                +{analytics.bonusesSnapshot.torqueBonusPct}%
              </div>
            </div>
            <div className="rounded bg-slate-950/75 px-2 py-1">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Susp Damp</div>
              <div className="font-mono-num text-xs font-bold text-sky-300 tabular-nums">
                +{analytics.bonusesSnapshot.suspensionDampingPct}%
              </div>
            </div>
            <div className="rounded bg-slate-950/75 px-2 py-1">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Slip Drag</div>
              <div className="font-mono-num text-xs font-bold text-emerald-300 tabular-nums">
                -{analytics.bonusesSnapshot.slipDragReductionPct}%
              </div>
            </div>
            <div className="rounded bg-slate-950/75 px-2 py-1">
              <div className="text-[9px] font-bold text-slate-400 uppercase">Tire Life</div>
              <div className="font-mono-num text-xs font-bold text-violet-300 tabular-nums">
                +{analytics.bonusesSnapshot.tireWearResistancePct}%
              </div>
            </div>
          </div>
          <div className="mt-1.5 text-[10px] font-semibold text-slate-300">
            Auto-Tune Evolution: {analytics.aiAutoTuneActive ? 'Active on Rig' : 'Inactive (Toggle in Paddock AI Model)'}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <button
            type="button"
            onClick={onClimbAgain}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 font-display text-lg font-bold tracking-wider text-slate-950 uppercase transition hover:bg-amber-400"
          >
            <RotateCcw className="h-4 w-4" />
            Climb Again
          </button>

          <button
            type="button"
            onClick={onOpenPaddock}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/20 bg-[#111923] px-4 py-2.5 font-display text-lg font-bold tracking-wider text-white uppercase transition hover:border-amber-400"
          >
            <Flag className="h-4 w-4 text-amber-300" />
            Paddock
          </button>

          <button
            type="button"
            onClick={onGoShowroom}
            className="flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#111923] px-4 py-2.5 font-display text-lg font-bold tracking-wider text-slate-300 uppercase transition hover:border-white/40 hover:text-white"
          >
            <Home className="h-4 w-4" />
            Showroom
          </button>
        </div>
      </motion.div>
    </div>
  );
};
