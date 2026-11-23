import React from 'react';
import { ArrowLeft, Check, ShieldCheck } from 'lucide-react';
import {
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFS,
} from '../game/constants';
import { SaveData, UpgradeKey, VehicleConfig, VehicleId } from '../types/game';
import { CoinIcon, GemIcon, UpgradePartIcon } from './GameIcons';

interface UpgradesModalProps {
  save: SaveData;
  vehicle: VehicleConfig;
  onClose: () => void;
  onBuyUpgrade: (vehicleId: VehicleId, key: UpgradeKey) => void;
}

const NODE_STEPS = Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => i + 1);

export const UpgradesModal: React.FC<UpgradesModalProps> = ({
  save,
  vehicle,
  onClose,
  onBuyUpgrade,
}) => {
  const levels = save.upgrades[vehicle.id];
  const totalLevel =
    (levels.engine ?? 0) +
    (levels.suspension ?? 0) +
    (levels.tires ?? 0) +
    (levels.awd ?? 0) +
    (levels.fuel ?? 0);
  const maxTotal = UPGRADE_DEFS.length * MAX_UPGRADE_LEVEL;

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-slate-950 p-4 text-white sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="panel-bevel flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 text-white transition hover:border-amber-400"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-wider uppercase italic sm:text-3xl">
              UPGRADE TREE
            </h1>
            <p className="text-xs font-bold tracking-widest text-amber-300 uppercase">
              {vehicle.name} · TUNING RANK {totalLevel}/{maxTotal}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5">
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <div className="panel-bevel flex items-center gap-2 rounded-lg border border-white/15 px-3 py-1.5">
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 5-Track Tiered Node Progression Tree */}
      <div className="frontier-scroll my-3 flex flex-1 flex-col justify-center gap-2.5 overflow-y-auto py-1">
        {UPGRADE_DEFS.map((def) => {
          const level = levels[def.key] ?? 0;
          const cost = getUpgradeCost(def.key, level);
          const isMaxed = level >= MAX_UPGRADE_LEVEL;
          const canAfford = !isMaxed && save.coins >= cost;

          return (
            <div
              key={def.key}
              className="panel-bevel flex flex-col justify-between gap-3 rounded-2xl border px-4 py-3 lg:flex-row lg:items-center"
              style={{ borderColor: `${def.accentColor}48` }}
            >
              {/* Left Part Identity */}
              <div className="flex items-center gap-3 lg:w-64 lg:shrink-0">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-slate-950 shadow-inner">
                  <UpgradePartIcon part={def.key} className="h-9 w-9" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg font-extrabold tracking-wide text-white uppercase italic">
                      {def.name}
                    </span>
                    <span
                      className="font-mono-num rounded px-1.5 py-0.5 text-[10px] font-extrabold"
                      style={{
                        backgroundColor: `${def.accentColor}26`,
                        color: def.accentColor,
                      }}
                    >
                      LV {level}/{MAX_UPGRADE_LEVEL}
                    </span>
                  </div>
                  <div
                    className="text-[11px] font-bold"
                    style={{ color: def.accentColor }}
                  >
                    {def.effectPerLevel}
                  </div>
                  <p className="hidden truncate text-[11px] text-slate-400 sm:block">
                    {def.description}
                  </p>
                </div>
              </div>

              {/* Center Connected Milestone Node Track (1..10) */}
              <div className="flex flex-1 items-center px-1 sm:px-3">
                {NODE_STEPS.map((step, idx) => {
                  const unlocked = step <= level;
                  const isNext = step === level + 1;
                  const isMilestone = step === 3 || step === 6 || step === 10;
                  return (
                    <React.Fragment key={step}>
                      {idx > 0 && (
                        <div
                          className="h-1 flex-1 transition-colors duration-300"
                          style={{
                            backgroundColor: unlocked
                              ? def.accentColor
                              : 'rgba(51, 65, 85, 0.75)',
                          }}
                        />
                      )}
                      <div
                        className={`relative flex shrink-0 items-center justify-center rounded-full border-2 font-mono-num text-[10px] font-extrabold transition-all ${
                          isMilestone ? 'h-8 w-8' : 'h-6 w-6 sm:h-7 sm:w-7'
                        } ${
                          unlocked
                            ? 'text-slate-950 shadow-lg'
                            : isNext
                              ? 'border-white/70 bg-slate-900 text-white'
                              : 'border-slate-700 bg-slate-950 text-slate-500'
                        }`}
                        style={
                          unlocked
                            ? {
                                backgroundColor: def.accentColor,
                                borderColor: '#ffffff',
                                boxShadow: `0 0 12px ${def.accentColor}88`,
                              }
                            : isNext
                              ? { borderColor: def.accentColor }
                              : undefined
                        }
                        title={
                          isMilestone
                            ? `Tier ${step} Milestone`
                            : `Level ${step}`
                        }
                      >
                        {unlocked ? (
                          isMilestone ? (
                            <ShieldCheck className="h-4 w-4" />
                          ) : (
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          )
                        ) : (
                          step
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Right Upgrade CTA */}
              <div className="flex items-center justify-end lg:w-40 lg:shrink-0">
                <button
                  type="button"
                  disabled={!canAfford}
                  onClick={() => onBuyUpgrade(vehicle.id, def.key)}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-display text-sm font-extrabold tracking-wider uppercase italic shadow transition lg:w-36 ${
                    isMaxed
                      ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                      : canAfford
                        ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105 active:translate-y-0.5'
                        : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-500'
                  }`}
                >
                  {isMaxed ? (
                    'MAXED'
                  ) : (
                    <>
                      <CoinIcon className="h-4 w-4" />
                      {cost.toLocaleString()}
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Tip */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
        <span>
          Milestones at Lv 3, 6 & 10 boost <strong className="text-white">{vehicle.name}</strong> class rating & trail performance.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="panel-bevel rounded-lg border border-white/15 px-4 py-1.5 font-display text-xs font-extrabold tracking-wider text-white uppercase italic hover:border-white/40"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
