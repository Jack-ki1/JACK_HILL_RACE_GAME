import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, Trophy } from 'lucide-react';
import { MISSIONS, SEASON_TIERS } from '../game/constants';
import { getMissionProgress } from '../game/storage';
import { SaveData } from '../types/game';
import { CoinIcon, GemIcon } from './GameIcons';

interface MissionsModalProps {
  save: SaveData;
  onClose: () => void;
  onClaimReward: (key: string, coins: number, gems: number) => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  save,
  onClose,
  onClaimReward,
}) => {
  const [tab, setTab] = useState<'MISSIONS' | 'SEASON'>('MISSIONS');

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-slate-950 p-4 text-white sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-slate-900 text-white transition hover:border-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-black tracking-wider uppercase sm:text-3xl">
              {tab === 'MISSIONS' ? 'MISSIONS' : 'SEASON 12 · WILD ROADS'}
            </h1>
            <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
              CAREER MILESTONES & EVENT PASS REWARDS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('MISSIONS')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black tracking-wider uppercase ${
              tab === 'MISSIONS'
                ? 'bg-amber-400 text-slate-950'
                : 'border border-white/15 bg-slate-900 text-slate-300'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            MISSIONS
          </button>
          <button
            type="button"
            onClick={() => setTab('SEASON')}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 font-display text-xs font-black tracking-wider uppercase ${
              tab === 'SEASON'
                ? 'bg-violet-500 text-white'
                : 'border border-white/15 bg-slate-900 text-slate-300'
            }`}
          >
            <Trophy className="h-4 w-4" />
            SEASON 12
          </button>
        </div>
      </div>

      {/* Scrollable List */}
      <div className="frontier-scroll my-4 flex-1 overflow-y-auto pr-1">
        {tab === 'MISSIONS' ? (
          <div className="flex flex-col gap-3">
            {MISSIONS.map((m) => {
              const progress = Math.floor(getMissionProgress(m.metric, save));
              const pct = Math.min(100, Math.round((progress / m.target) * 100));
              const complete = progress >= m.target;
              const claimed = Boolean(save.claimedRewards[m.id]);

              return (
                <div
                  key={m.id}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900 p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-black tracking-wide uppercase">
                        {m.title}
                      </h2>
                      {claimed && (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                          <CheckCircle2 className="h-3 w-3" />
                          CLAIMED
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300">{m.desc}</p>
                    <div className="mt-2.5 flex items-center gap-3">
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-950">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="font-mono-num text-xs font-bold text-slate-200">
                        {Math.min(progress, m.target).toLocaleString()} /{' '}
                        {m.target.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold">
                      <CoinIcon className="h-4 w-4" />
                      <span className="font-mono-num text-amber-300">
                        +{m.rewardCoins}
                      </span>
                      <GemIcon className="ml-1 h-4 w-4" />
                      <span className="font-mono-num text-sky-300">
                        +{m.rewardGems}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!complete || claimed}
                      onClick={() =>
                        onClaimReward(m.id, m.rewardCoins, m.rewardGems)
                      }
                      className={`min-w-[110px] rounded-xl px-4 py-2.5 font-display text-xs font-black tracking-wider uppercase ${
                        claimed
                          ? 'bg-slate-800 text-slate-500'
                          : complete
                            ? 'bg-gradient-to-b from-emerald-400 to-green-600 text-slate-950 shadow-lg hover:brightness-105'
                            : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {claimed ? 'DONE' : complete ? 'CLAIM' : `${pct}%`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="rounded-2xl border border-violet-400/40 bg-slate-900 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-bold tracking-widest text-violet-300 uppercase">
                    CUMULATIVE FRONTIER DISTANCE
                  </div>
                  <div className="font-mono-num text-2xl font-black text-white">
                    {Math.floor(save.totals.distanceMeters).toLocaleString()}m
                  </div>
                </div>
                <div className="text-xs text-slate-300">
                  Drive across any stage to climb Wild Roads Event Tiers.
                </div>
              </div>
            </div>

            {SEASON_TIERS.map((tier) => {
              const key = `season_tier_${tier.tier}`;
              const dist = Math.floor(save.totals.distanceMeters);
              const pct = Math.min(100, Math.round((dist / tier.targetMeters) * 100));
              const complete = dist >= tier.targetMeters;
              const claimed = Boolean(save.claimedRewards[key]);

              return (
                <div
                  key={tier.tier}
                  className="flex flex-col justify-between gap-3 rounded-2xl border border-white/15 bg-slate-900 p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex flex-1 items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-400/40 bg-violet-500/20 font-display text-lg font-black text-violet-200">
                      {tier.tier}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between text-sm font-bold">
                        <span className="font-display uppercase">
                          {tier.rewardLabel}
                        </span>
                        <span className="font-mono-num text-xs text-slate-300">
                          {Math.min(dist, tier.targetMeters).toLocaleString()} /{' '}
                          {tier.targetMeters.toLocaleString()}m
                        </span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-950">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-bold">
                      <CoinIcon className="h-4 w-4" />
                      <span className="font-mono-num text-amber-300">
                        +{tier.rewardCoins}
                      </span>
                      <GemIcon className="ml-1 h-4 w-4" />
                      <span className="font-mono-num text-sky-300">
                        +{tier.rewardGems}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!complete || claimed}
                      onClick={() =>
                        onClaimReward(key, tier.rewardCoins, tier.rewardGems)
                      }
                      className={`min-w-[110px] rounded-xl px-4 py-2.5 font-display text-xs font-black tracking-wider uppercase ${
                        claimed
                          ? 'bg-slate-800 text-slate-500'
                          : complete
                            ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 shadow-lg hover:brightness-105'
                            : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-400'
                      }`}
                    >
                      {claimed ? 'CLAIMED' : complete ? 'CLAIM' : `${pct}%`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Career Stats */}
      <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-slate-900 px-3 py-2">
          <div className="text-[10px] text-slate-400 uppercase">Total Runs</div>
          <div className="font-mono-num text-sm font-bold text-white">
            {save.totals.runsCompleted}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 px-3 py-2">
          <div className="text-[10px] text-slate-400 uppercase">Best Run</div>
          <div className="font-mono-num text-sm font-bold text-amber-300">
            {Math.floor(save.totals.bestSingleRunMeters)}m
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 px-3 py-2">
          <div className="text-[10px] text-slate-400 uppercase">Clean Flips</div>
          <div className="font-mono-num text-sm font-bold text-sky-300">
            {save.totals.flipsCompleted}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 px-3 py-2">
          <div className="text-[10px] text-slate-400 uppercase">Lifetime Coins</div>
          <div className="font-mono-num text-sm font-bold text-emerald-300">
            {save.totals.coinsCollected.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
};
