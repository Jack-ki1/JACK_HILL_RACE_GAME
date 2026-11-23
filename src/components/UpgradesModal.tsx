import React from 'react';
import { ArrowLeft } from 'lucide-react';
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

export const UpgradesModal: React.FC<UpgradesModalProps> = ({
  save,
  vehicle,
  onClose,
  onBuyUpgrade,
}) => {
  const levels = save.upgrades[vehicle.id];

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
              UPGRADES
            </h1>
            <p className="text-xs font-semibold tracking-widest text-amber-300 uppercase">
              TUNING WORKSHOP · {vehicle.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5">
            <CoinIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.coins.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5">
            <GemIcon className="h-5 w-5" />
            <span className="font-mono-num text-sm font-bold">
              {save.gems.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* 5 Tall Color-Coded Mechanical Upgrade Cards */}
      <div className="frontier-scroll my-auto grid grid-cols-1 gap-3 overflow-y-auto py-4 sm:grid-cols-2 lg:grid-cols-5">
        {UPGRADE_DEFS.map((def) => {
          const level = levels[def.key] ?? 0;
          const cost = getUpgradeCost(def.key, level);
          const isMaxed = level >= MAX_UPGRADE_LEVEL;
          const canAfford = !isMaxed && save.coins >= cost;
          const pct = Math.round((level / MAX_UPGRADE_LEVEL) * 100);

          return (
            <div
              key={def.key}
              className="flex flex-col justify-between rounded-2xl border bg-slate-900/95 p-4 shadow-xl"
              style={{ borderColor: `${def.accentColor}66` }}
            >
              <div>
                <div
                  className="mb-3 flex items-center justify-center rounded-xl py-2 font-display text-sm font-black tracking-wider text-white uppercase"
                  style={{
                    backgroundColor: `${def.accentColor}26`,
                    border: `1px solid ${def.accentColor}55`,
                  }}
                >
                  {def.name}
                </div>

                <div className="my-4 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-slate-950 shadow-inner">
                    <UpgradePartIcon part={def.key} className="h-14 w-14" />
                  </div>
                </div>

                <div className="text-center">
                  <div className="font-display text-sm font-bold tracking-wider text-slate-200">
                    LEVEL {level} / {MAX_UPGRADE_LEVEL}
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-950 p-0.5">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: def.accentColor,
                      }}
                    />
                  </div>
                  <div
                    className="mt-2 text-xs font-bold"
                    style={{ color: def.accentColor }}
                  >
                    {def.effectPerLevel}
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                    {def.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!canAfford}
                onClick={() => onBuyUpgrade(vehicle.id, def.key)}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 font-display text-sm font-black tracking-wider uppercase shadow transition ${
                  isMaxed
                    ? 'border border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                    : canAfford
                      ? 'bg-gradient-to-b from-yellow-300 to-amber-500 text-slate-950 hover:brightness-105 active:translate-y-0.5'
                      : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-500'
                }`}
              >
                {isMaxed ? (
                  'MAX LEVEL'
                ) : (
                  <>
                    <CoinIcon className="h-4 w-4" />
                    {cost.toLocaleString()}
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer Tip */}
      <div className="flex items-center justify-between border-t border-white/10 pt-3 text-xs text-slate-400">
        <span>
          Upgrades apply permanently to <strong className="text-white">{vehicle.name}</strong> physics & fuel efficiency.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-white/15 bg-slate-900 px-4 py-1.5 font-display text-xs font-bold tracking-wider text-white uppercase hover:border-white/40"
        >
          DONE
        </button>
      </div>
    </div>
  );
};
