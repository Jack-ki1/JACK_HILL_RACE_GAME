import React, { useState } from 'react';
import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { DEFAULT_TUNING, TUNING_PRESETS } from '../game/constants';
import { TuningConfig } from '../types/game';

interface TuningModalProps {
  tuning: TuningConfig;
  onUpdateTuning: (next: TuningConfig) => void;
  onResetSave: () => void;
  onClose: () => void;
}

const SLIDERS: {
  key: keyof TuningConfig;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}[] = [
  { key: 'enginePower', label: 'Engine Power Multiplier', min: 0.6, max: 1.8, step: 0.05, unit: 'x' },
  { key: 'suspensionStiffness', label: 'Suspension Spring Rate', min: 0.6, max: 1.6, step: 0.05, unit: 'x' },
  { key: 'damping', label: 'Hydraulic Damper', min: 0.5, max: 1.6, step: 0.05, unit: 'x' },
  { key: 'tireGrip', label: 'Tire Compound Grip', min: 0.6, max: 1.6, step: 0.05, unit: 'x' },
  { key: 'airControl', label: 'Mid-Air Pitch Torque', min: 0.5, max: 2.0, step: 0.05, unit: 'x' },
  { key: 'gravityScale', label: 'Stage Gravity Scale', min: 0.5, max: 1.5, step: 0.05, unit: 'x' },
  { key: 'rearDriveBias', label: 'Rear Axle Drive Bias', min: 0.2, max: 0.9, step: 0.05, unit: '' },
  { key: 'cameraZoom', label: 'Camera Zoom Factor', min: 0.75, max: 1.35, step: 0.05, unit: 'x' },
];

export const TuningModal: React.FC<TuningModalProps> = ({
  tuning,
  onUpdateTuning,
  onResetSave,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

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
              PHYSICS TUNING BENCH
            </h1>
            <p className="text-xs font-semibold tracking-widest text-violet-300 uppercase">
              SUSPENSION · TRACTION · DRIVETRAIN TELEMETRY
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onUpdateTuning({ ...DEFAULT_TUNING })}
          className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-3.5 py-2 text-xs font-bold text-slate-200 hover:border-white/40"
        >
          <RotateCcw className="h-4 w-4" />
          STOCK DEFAULTS
        </button>
      </div>

      {/* Presets Row */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TUNING_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onUpdateTuning({ ...p.values })}
            className="rounded-xl border border-violet-400/35 bg-slate-900 px-4 py-2 font-display text-xs font-bold tracking-wider text-violet-200 uppercase transition hover:border-violet-300 hover:bg-violet-500/20"
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Sliders Grid */}
      <div className="frontier-scroll my-4 grid flex-1 grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {SLIDERS.map((s) => {
          const val = tuning[s.key];
          return (
            <label
              key={s.key}
              className="flex flex-col justify-between rounded-2xl border border-white/12 bg-slate-900 p-4"
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-sm font-bold tracking-wide text-slate-100 uppercase">
                  {s.label}
                </span>
                <span className="font-mono-num text-sm font-black text-amber-300">
                  {val.toFixed(2)}
                  {s.unit ?? ''}
                </span>
              </div>
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={val}
                onChange={(e) =>
                  onUpdateTuning({
                    ...tuning,
                    [s.key]: parseFloat(e.target.value),
                  })
                }
                className="mt-3 h-2 w-full cursor-pointer accent-amber-400"
              />
              <div className="mt-1 flex justify-between font-mono-num text-[10px] text-slate-500">
                <span>{s.min}</span>
                <span>{s.max}</span>
              </div>
            </label>
          );
        })}
      </div>

      {/* Footer Save Management */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950/60"
          >
            <Trash2 className="h-4 w-4" />
            RESET SAVE PROGRESS
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-rose-300">
              Erase coins, vehicles & records?
            </span>
            <button
              type="button"
              onClick={() => {
                onResetSave();
                setConfirmReset(false);
              }}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-black text-white"
            >
              CONFIRM RESET
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className="rounded-lg border border-white/15 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-300"
            >
              CANCEL
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 px-6 py-2.5 font-display text-sm font-black tracking-wider text-slate-950 uppercase"
        >
          APPLY & CLOSE
        </button>
      </div>
    </div>
  );
};
