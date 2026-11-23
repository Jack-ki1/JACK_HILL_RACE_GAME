import React from 'react';
import { ArrowLeft, Check, Flag, Lock, Star, Trophy } from 'lucide-react';
import { STAGES } from '../game/constants';
import { getStageStars, isStageUnlocked } from '../game/storage';
import { SaveData, StageId } from '../types/game';

interface WorldMapModalProps {
  save: SaveData;
  onClose: () => void;
  onSelectStage: (stageId: StageId) => void;
  onStartRace: (stageId: StageId) => void;
  onOpenEvents: () => void;
}

const NODE_POSITIONS: Record<StageId, { x: string; y: string }> = {
  countryside: { x: '15%', y: '62%' },
  red_canyon: { x: '40%', y: '48%' },
  frost_peaks: { x: '66%', y: '34%' },
  moon: { x: '86%', y: '22%' },
};

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  save,
  onClose,
  onSelectStage,
  onStartRace,
  onOpenEvents,
}) => {
  const totalStars = STAGES.reduce(
    (sum, s) => sum + getStageStars(s.id, save.stageBests[s.id] ?? 0),
    0,
  );
  const selectedStage =
    STAGES.find((s) => s.id === save.selectedStage) ?? STAGES[0];
  const selectedUnlocked = isStageUnlocked(selectedStage.id, save);

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
              WORLD MAP
            </h1>
            <p className="text-xs font-semibold tracking-widest text-sky-300 uppercase">
              FRONTIER EXPEDITION · 4 UNIQUE ENVIRONMENTS
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-slate-900 px-3.5 py-2">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-mono-num text-sm font-extrabold text-amber-300">
            {totalStars} / {STAGES.length * 3}
          </span>
        </div>
      </div>

      {/* Interactive Panoramic Terrain Map */}
      <div className="relative my-3 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
        {/* Stylized SVG Regional Biomes + Connecting Trail */}
        <svg
          viewBox="0 0 1200 540"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="mapOcean" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#163856" />
              <stop offset="55%" stopColor="#1d2b44" />
              <stop offset="100%" stopColor="#090d1f" />
            </linearGradient>
            <linearGradient id="greenLand" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4da844" />
              <stop offset="100%" stopColor="#265b27" />
            </linearGradient>
            <linearGradient id="canyonLand" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#d9773f" />
              <stop offset="100%" stopColor="#7a2a19" />
            </linearGradient>
            <linearGradient id="frostLand" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#dbeafe" />
              <stop offset="100%" stopColor="#3b638f" />
            </linearGradient>
            <radialGradient id="moonLand" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#9ca3af" />
              <stop offset="100%" stopColor="#374151" />
            </radialGradient>
          </defs>

          <rect width="1200" height="540" fill="url(#mapOcean)" />

          {/* Countryside Rolling Meadow Island */}
          <path
            d="M40 310 Q140 200 280 250 Q350 320 310 430 Q180 490 60 420 Z"
            fill="url(#greenLand)"
            stroke="#86efac"
            strokeOpacity="0.35"
            strokeWidth="3"
          />

          {/* Red Canyon Mesa */}
          <path
            d="M320 220 Q460 150 590 215 Q635 310 565 405 Q430 430 340 340 Z"
            fill="url(#canyonLand)"
            stroke="#fdba74"
            strokeOpacity="0.4"
            strokeWidth="3"
          />

          {/* Frost Peaks Range */}
          <path
            d="M610 140 Q740 80 885 150 Q925 270 845 360 Q715 385 625 280 Z"
            fill="url(#frostLand)"
            stroke="#bfdbfe"
            strokeOpacity="0.5"
            strokeWidth="3"
          />

          {/* Moon Crater Orbit Disc */}
          <circle cx="1030" cy="130" r="108" fill="url(#moonLand)" stroke="#cbd5e1" strokeOpacity="0.45" strokeWidth="3" />
          <circle cx="995" cy="105" r="22" fill="#4b5563" fillOpacity="0.65" />
          <circle cx="1065" cy="145" r="16" fill="#4b5563" fillOpacity="0.65" />

          {/* Winding Trail Route */}
          <path
            d="M180 335 C270 305, 360 280, 480 260 C600 240, 680 205, 790 185 C885 168, 955 145, 1030 120"
            fill="none"
            stroke="#ffffff"
            strokeWidth="5"
            strokeDasharray="12 10"
            strokeLinecap="round"
            strokeOpacity="0.82"
          />
        </svg>

        {/* Interactive Stage Nodes */}
        {STAGES.map((stage) => {
          const pos = NODE_POSITIONS[stage.id];
          const unlocked = isStageUnlocked(stage.id, save);
          const best = Math.floor(save.stageBests[stage.id] ?? 0);
          const stars = getStageStars(stage.id, best);
          const active = save.selectedStage === stage.id;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              style={{ left: pos.x, top: pos.y }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3.5 py-2.5 text-left shadow-2xl transition ${
                active
                  ? 'scale-105 border-amber-300 bg-slate-950/95 ring-2 ring-amber-400/50'
                  : unlocked
                    ? 'border-white/25 bg-slate-950/88 hover:scale-105 hover:border-white/60'
                    : 'border-white/10 bg-slate-950/85 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-black tracking-wider text-white uppercase sm:text-base">
                  {stage.name}
                </span>
                {active && (
                  <Check className="h-4 w-4 text-emerald-400" />
                )}
                {!unlocked && <Lock className="h-3.5 w-3.5 text-amber-400" />}
              </div>

              <div className="mt-0.5 font-mono-num text-[11px] font-bold text-slate-300">
                BEST: {best}m
              </div>

              <div className="mt-1 flex items-center gap-0.5">
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    className={`h-3.5 w-3.5 ${
                      n <= stars
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>
            </button>
          );
        })}

        {/* Bottom-Left Stage Details Card */}
        <div className="absolute bottom-3 left-3 max-w-md rounded-xl border border-white/15 bg-slate-950/92 p-3.5 shadow-xl">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-amber-400" />
            <span className="font-display text-base font-black tracking-wider uppercase">
              {selectedStage.name}
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono-num text-[10px] font-bold text-sky-300">
              {selectedStage.gravityMult.toFixed(2)}g
            </span>
            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono-num text-[10px] font-bold text-emerald-300">
              GRIP {Math.round(selectedStage.gripMult * 100)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-300">{selectedStage.subtitle}</p>
          {!selectedUnlocked && (
            <p className="mt-1.5 text-xs font-bold text-amber-300">
              Unlock Requirement: {selectedStage.unlockRequirementText}
            </p>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl border border-white/20 bg-slate-900 px-5 py-3 font-display text-sm font-bold tracking-wider uppercase hover:border-white/40"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenEvents}
            className="flex items-center gap-2 rounded-xl border border-violet-400/40 bg-slate-900 px-5 py-3 font-display text-sm font-bold tracking-wider text-violet-200 uppercase hover:border-violet-300"
          >
            <Trophy className="h-4 w-4 text-yellow-300" />
            EVENTS
          </button>

          <button
            type="button"
            disabled={!selectedUnlocked}
            onClick={() => onStartRace(selectedStage.id)}
            className={`flex items-center gap-2 rounded-xl px-8 py-3 font-display text-base font-black tracking-wider uppercase shadow-xl transition ${
              selectedUnlocked
                ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:brightness-110'
                : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-500'
            }`}
          >
            <Flag className="h-5 w-5" />
            {selectedUnlocked ? 'RACE' : 'LOCKED'}
          </button>
        </div>
      </div>
    </div>
  );
};
