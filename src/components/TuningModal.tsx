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
  helper: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}[] = [
  {
    key: 'enginePower',
    label: 'Engine Power Multiplier',
    helper: 'Controls throttle torque & peak top speed.',
    min: 0.6,
    max: 1.8,
    step: 0.05,
    unit: 'x',
  },
  {
    key: 'suspensionStiffness',
    label: 'Suspension Spring Rate',
    helper: 'Higher values stiffen coilovers for big jumps.',
    min: 0.6,
    max: 1.6,
    step: 0.05,
    unit: 'x',
  },
  {
    key: 'damping',
    label: 'Hydraulic Damper',
    helper: 'Absorbs bounce oscillation on rough landings.',
    min: 0.5,
    max: 1.6,
    step: 0.05,
    unit: 'x',
  },
  {
    key: 'tireGrip',
    label: 'Tire Compound Grip',
    helper: 'Increases climbing traction on steep dirt & ice.',
    min: 0.6,
    max: 1.6,
    step: 0.05,
    unit: 'x',
  },
  {
    key: 'airControl',
    label: 'Mid-Air Pitch Torque',
    helper: 'Boosts flip rotation authority while airborne.',
    min: 0.5,
    max: 2.0,
    step: 0.05,
    unit: 'x',
  },
  {
    key: 'gravityScale',
    label: 'Stage Gravity Scale',
    helper: 'Scales downward pull across all biomes.',
    min: 0.5,
    max: 1.5,
    step: 0.05,
    unit: 'x',
  },
  {
    key: 'rearDriveBias',
    label: 'Rear Axle Drive Bias',
    helper: 'Balances rear wheelie punch vs front pull.',
    min: 0.2,
    max: 0.9,
    step: 0.05,
    unit: '',
  },
  {
    key: 'cameraZoom',
    label: 'Camera Zoom Factor',
    helper: 'Lower zooms out for wider jump landing preview.',
    min: 0.75,
    max: 1.35,
    step: 0.05,
    unit: 'x',
  },
];

export const TuningModal: React.FC<TuningModalProps> = ({
  tuning,
  onUpdateTuning,
  onResetSave,
  onClose,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const activePreset = TUNING_PRESETS.find((p) =>
    (Object.keys(DEFAULT_TUNING) as (keyof TuningConfig)[]).every(
      (k) => Math.abs(p.values[k] - tuning[k]) < 0.001,
    ),
  );

  // Live SVG visualizer geometry derived from current tuning sliders
  const rideDrop = Math.round((1.6 - tuning.suspensionStiffness) * 14);
  const frontShare = Math.round((1 - tuning.rearDriveBias) * 100);
  const rearShare = Math.round(tuning.rearDriveBias * 100);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-[#080d13] p-4 text-white sm:p-6">
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
              PHYSICS TUNING BENCH
            </h1>
            <p className="text-xs font-bold tracking-widest text-violet-300 uppercase">
              SUSPENSION · TRACTION · DRIVETRAIN TELEMETRY
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onUpdateTuning({ ...DEFAULT_TUNING })}
          className="panel-bevel flex items-center gap-2 rounded-xl border border-white/15 px-3.5 py-2 font-display text-xs font-extrabold tracking-wider text-slate-200 uppercase hover:border-amber-400"
        >
          <RotateCcw className="h-4 w-4" />
          STOCK DEFAULTS
        </button>
      </div>

      {/* Presets Row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {TUNING_PRESETS.map((p) => {
          const isSelected = activePreset?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onUpdateTuning({ ...p.values })}
              className={`rounded-xl border px-4 py-2 font-display text-xs font-extrabold tracking-wider uppercase italic transition ${
                isSelected
                  ? 'border-violet-300 bg-violet-500/30 text-white shadow'
                  : 'panel-bevel border-white/15 text-violet-200 hover:border-violet-300/60'
              }`}
            >
              {p.name}
            </button>
          );
        })}
        <span className="ml-auto font-mono-num text-[11px] font-bold text-slate-400 uppercase">
          PROFILE: {activePreset ? activePreset.name : 'CUSTOM TUNED'}
        </span>
      </div>

      {/* Live Chassis Telemetry Visualizer + Sliders */}
      <div className="frontier-scroll my-3 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Reactive Chassis Blueprint Card */}
        <div className="panel-bevel flex flex-col items-center justify-between gap-4 rounded-2xl border border-violet-400/35 p-3.5 sm:flex-row">
          <svg
            viewBox="0 0 320 96"
            className="h-24 w-full max-w-[320px] shrink-0"
            aria-hidden="true"
          >
            {/* Ground line */}
            <line x1="16" y1="82" x2="304" y2="82" stroke="#334155" strokeWidth="2" />
            {/* Chassis frame shifting with spring stiffness */}
            <g transform={`translate(0, ${rideDrop * 0.4})`}>
              <path
                d="M72 44 L105 24 L185 24 L238 42 L252 54 L66 54 Z"
                fill="#1b2733"
                stroke="#38bdf8"
                strokeWidth="2"
              />
              {/* Coilover springs */}
              <path
                d="M96 54 L90 59 L102 63 L90 67 L96 71"
                fill="none"
                stroke="#ffc52e"
                strokeWidth={Math.max(1.8, tuning.suspensionStiffness * 2.2)}
                strokeLinecap="round"
              />
              <path
                d="M224 54 L218 59 L230 63 L218 67 L224 71"
                fill="none"
                stroke="#ffc52e"
                strokeWidth={Math.max(1.8, tuning.suspensionStiffness * 2.2)}
                strokeLinecap="round"
              />
            </g>
            {/* Rear & Front Tires */}
            <circle cx="96" cy="70" r="14" fill="#0f172a" stroke="#94a3b8" strokeWidth="4" />
            <circle cx="224" cy="70" r="14" fill="#0f172a" stroke="#94a3b8" strokeWidth="4" />
            {/* Torque split bars */}
            <rect x="46" y="10" width={Math.max(8, rearShare * 0.6)} height="6" rx="2" fill="#a66bff" />
            <rect x="274 - Math.max(8, frontShare * 0.6)" y="10" width={Math.max(8, frontShare * 0.6)} height="6" rx="2" fill="#27c9f4" />
          </svg>

          <div className="grid w-full flex-1 grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-[#111923] px-3 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">DRIVE SPLIT</div>
              <div className="font-mono-num font-bold text-violet-300">
                {rearShare}%R / {frontShare}%F
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111923] px-3 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">SPRING RATE</div>
              <div className="font-mono-num font-bold text-amber-300">
                {tuning.suspensionStiffness.toFixed(2)}x
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111923] px-3 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">GRIP FACTOR</div>
              <div className="font-mono-num font-bold text-emerald-300">
                {tuning.tireGrip.toFixed(2)}x
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#111923] px-3 py-2">
              <div className="text-[10px] font-bold text-slate-400 uppercase">GRAVITY</div>
              <div className="font-mono-num font-bold text-sky-300">
                {tuning.gravityScale.toFixed(2)}g
              </div>
            </div>
          </div>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {SLIDERS.map((s) => {
            const val = tuning[s.key];
            const isDefault = Math.abs(val - DEFAULT_TUNING[s.key]) < 0.001;
            return (
              <div
                key={s.key}
                className="panel-bevel flex flex-col justify-between rounded-2xl border border-white/12 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-sm font-extrabold tracking-wide text-slate-100 uppercase italic">
                      {s.label}
                    </div>
                    <div className="text-[11px] text-slate-400">{s.helper}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num text-sm font-black text-amber-300">
                      {val.toFixed(2)}
                      {s.unit ?? ''}
                    </span>
                    {!isDefault && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTuning({
                            ...tuning,
                            [s.key]: DEFAULT_TUNING[s.key],
                          })
                        }
                        title={`Reset ${s.label}`}
                        aria-label={`Reset ${s.label}`}
                        className="rounded border border-white/15 bg-[#111923] p-1 text-slate-400 hover:border-amber-400 hover:text-white"
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={val}
                  aria-label={s.label}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Save Management */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
        {!confirmReset ? (
          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-950/35 px-4 py-2 text-xs font-bold text-rose-300 hover:bg-rose-950/60"
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
              className="rounded-lg border border-white/15 bg-[#111923] px-3 py-1.5 text-xs font-bold text-slate-300"
            >
              CANCEL
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] px-6 py-2.5 font-display text-sm font-black tracking-wider text-slate-950 uppercase italic shadow-lg hover:brightness-105"
        >
          APPLY & CLOSE
        </button>
      </div>
    </div>
  );
};
