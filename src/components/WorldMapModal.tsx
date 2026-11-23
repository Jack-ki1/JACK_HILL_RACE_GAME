import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Compass,
  Flag,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Star,
  Trophy,
} from 'lucide-react';
import { STAGES } from '../game/constants';
import { getStageStars, isStageUnlocked } from '../game/storage';
import { SaveData, StageConfig, StageId } from '../types/game';

interface WorldMapModalProps {
  save: SaveData;
  onClose: () => void;
  onSelectStage: (stageId: StageId) => void;
  onStartRace: (stageId: StageId) => void;
  onOpenEvents: () => void;
}

const NODE_POSITIONS: Record<StageId, { x: string; y: string }> = {
  countryside: { x: '16%', y: '68%' },
  red_canyon: { x: '36%', y: '50%' },
  frost_peaks: { x: '56%', y: '34%' },
  moon: { x: '82%', y: '22%' },
  vice_coast: { x: '78%', y: '72%' },
};

function getStageHazards(stage: StageConfig): { label: string; colorClass: string }[] {
  const tags: { label: string; colorClass: string }[] = [];
  if (stage.id === 'vice_coast') {
    tags.push({
      label: 'ASPHALT COASTWAY',
      colorClass: 'border-pink-400/50 bg-pink-500/20 text-pink-200',
    });
  }
  if (stage.hasBridges) {
    tags.push({
      label: stage.id === 'vice_coast' ? 'CAUSEWAY BRIDGES' : 'WOODEN BRIDGES',
      colorClass: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
    });
  }
  if (stage.hasTunnels) {
    tags.push({
      label: 'CAVE TUNNELS',
      colorClass: 'border-orange-400/40 bg-orange-500/15 text-orange-200',
    });
  }
  if (stage.gripMult < 0.8) {
    tags.push({
      label: 'ICE PATCHES',
      colorClass: 'border-cyan-300/40 bg-cyan-500/15 text-cyan-200',
    });
  }
  if (stage.gravityMult < 0.5) {
    tags.push({
      label: 'LOW-G CRATERS',
      colorClass: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
    });
  }
  return tags;
}

function renderBiomeArtwork(stageId: StageId): React.ReactNode {
  if (stageId === 'vice_coast') {
    return (
      <svg viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="vcSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1d1847" />
            <stop offset="55%" stopColor="#b03a82" />
            <stop offset="100%" stopColor="#ff9a68" />
          </linearGradient>
        </defs>
        <rect width="640" height="240" fill="url(#vcSky)" />
        <circle cx="485" cy="96" r="44" fill="#ffc978" fillOpacity="0.92" />
        <path d="M0 165 Q160 140 320 158 T640 150 L640 240 L0 240 Z" fill="#172554" />
        <path d="M0 185 Q180 162 380 182 T640 175 L640 240 L0 240 Z" fill="#334155" />
        <line x1="0" y1="205" x2="640" y2="198" stroke="#fbbf24" strokeDasharray="18 14" strokeWidth="4" />
        <g stroke="#0f172a" strokeWidth="6" strokeLinecap="round">
          <line x1="110" y1="184" x2="96" y2="95" />
          <line x1="560" y1="178" x2="574" y2="82" />
        </g>
        <g fill="#15803d">
          <path d="M96 95 Q55 82 38 108 Q70 100 96 95 Z" />
          <path d="M96 95 Q138 78 154 106 Q124 100 96 95 Z" />
          <path d="M574 82 Q532 68 514 96 Q544 88 574 82 Z" />
          <path d="M574 82 Q618 70 632 98 Q604 88 574 82 Z" />
        </g>
      </svg>
    );
  }
  if (stageId === 'red_canyon') {
    return (
      <svg viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="rcSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#1e497a" />
            <stop offset="100%" stopColor="#f7b277" />
          </linearGradient>
        </defs>
        <rect width="640" height="240" fill="url(#rcSky)" />
        <circle cx="510" cy="64" r="28" fill="#fef3c7" />
        <path d="M25 170 L65 92 L160 92 L195 170 Z" fill="#a8442a" />
        <path d="M360 175 L395 104 L515 104 L545 175 Z" fill="#8f3620" />
        <path d="M0 172 Q140 138 290 166 T640 156 L640 240 L0 240 Z" fill="#c95c38" />
        <path d="M0 198 Q180 178 360 196 T640 186 L640 240 L0 240 Z" fill="#7c2d12" />
        <rect x="260" y="128" width="12" height="44" rx="6" fill="#2f6f36" />
        <rect x="248" y="138" width="12" height="8" rx="4" fill="#2f6f36" />
      </svg>
    );
  }
  if (stageId === 'frost_peaks') {
    return (
      <svg viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="fpSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#071124" />
            <stop offset="100%" stopColor="#1e3a5f" />
          </linearGradient>
        </defs>
        <rect width="640" height="240" fill="url(#fpSky)" />
        <path d="M40 58 Q200 18 360 52 T620 35" fill="none" stroke="#34d399" strokeOpacity="0.45" strokeWidth="18" strokeLinecap="round" />
        <polygon points="40,185 155,68 270,185" fill="#475569" />
        <polygon points="155,68 195,112 155,102 122,112" fill="#f8fafc" />
        <polygon points="310,185 450,55 590,185" fill="#334155" />
        <polygon points="450,55 496,105 450,94 408,105" fill="#e0f2fe" />
        <path d="M0 180 Q160 155 340 175 T640 168 L640 240 L0 240 Z" fill="#dbeafe" />
        <path d="M0 202 Q180 185 380 202 T640 194 L640 240 L0 240 Z" fill="#1e293b" />
      </svg>
    );
  }
  if (stageId === 'moon') {
    return (
      <svg viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
        <rect width="640" height="240" fill="#05070f" />
        <g fill="#f8fafc" fillOpacity="0.75">
          <circle cx="80" cy="42" r="2" />
          <circle cx="195" cy="70" r="1.5" />
          <circle cx="330" cy="34" r="2.2" />
          <circle cx="560" cy="48" r="1.8" />
          <circle cx="490" cy="95" r="1.4" />
        </g>
        <circle cx="145" cy="68" r="32" fill="#2563eb" />
        <path d="M126 55 Q150 48 165 66 Q148 80 132 72 Z" fill="#22c55e" fillOpacity="0.75" />
        <path d="M0 165 Q130 142 260 168 Q390 194 520 156 T640 164 L640 240 L0 240 Z" fill="#9ca3af" />
        <ellipse cx="290" cy="195" rx="48" ry="11" fill="#4b5563" />
        <ellipse cx="495" cy="186" rx="34" ry="8" fill="#6b7280" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 640 240" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="csSky" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#1b67b2" />
          <stop offset="100%" stopColor="#9cd7ff" />
        </linearGradient>
      </defs>
      <rect width="640" height="240" fill="url(#csSky)" />
      <circle cx="520" cy="54" r="26" fill="#fef08a" />
      <path d="M0 158 Q160 120 340 148 T640 134 L640 240 L0 240 Z" fill="#3c7d3b" />
      <path d="M0 176 Q175 144 360 174 T640 164 L640 240 L0 240 Z" fill="#54ab45" />
      <path d="M0 198 Q180 176 380 198 T640 190 L640 240 L0 240 Z" fill="#704a2b" />
      <rect x="442" y="138" width="38" height="26" fill="#991b1b" />
      <polygon points="438,138 461,120 484,138" fill="#3f3f46" />
      <polygon points="95,168 112,118 129,168" fill="#1e5628" />
      <polygon points="135,172 150,126 165,172" fill="#236630" />
    </svg>
  );
}

export const WorldMapModal: React.FC<WorldMapModalProps> = ({
  save,
  onClose,
  onSelectStage,
  onStartRace,
  onOpenEvents,
}) => {
  const [viewMode, setViewMode] = useState<'STAGES' | 'MAP'>('STAGES');
  const [inspectedStageId, setInspectedStageId] = useState<StageId>(save.selectedStage);

  useEffect(() => {
    setInspectedStageId(save.selectedStage);
  }, [save.selectedStage]);

  const totalStars = STAGES.reduce(
    (sum, s) => sum + getStageStars(s.id, save.stageBests[s.id] ?? 0),
    0,
  );
  const selectedStage =
    STAGES.find((s) => s.id === inspectedStageId) ?? STAGES[0];
  const selectedUnlocked = isStageUnlocked(selectedStage.id, save);
  const selectedHazards = getStageHazards(selectedStage);
  const selectedBest = Math.floor(save.stageBests[selectedStage.id] ?? 0);
  const selectedStars = getStageStars(selectedStage.id, selectedBest);

  const handlePickStage = (id: StageId) => {
    setInspectedStageId(id);
    if (isStageUnlocked(id, save)) {
      onSelectStage(id);
    }
  };

  return (
    <div className="safe-screen-pad fixed inset-0 z-30 flex flex-col justify-between gap-3 bg-slate-950 text-white">
      {/* Header + View Switcher */}
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
              {viewMode === 'STAGES' ? 'STAGE SELECT' : 'WORLD MAP'}
            </h1>
            <p className="text-xs font-bold tracking-widest text-sky-300 uppercase">
              JACK_HILL_GAME · {STAGES.length} BIOMES
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="panel-bevel flex items-center gap-1 rounded-xl border border-white/15 p-1">
            <button
              type="button"
              onClick={() => setViewMode('STAGES')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-xs font-extrabold tracking-wider uppercase italic transition ${
                viewMode === 'STAGES'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              STAGE SELECT
            </button>
            <button
              type="button"
              onClick={() => setViewMode('MAP')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-display text-xs font-extrabold tracking-wider uppercase italic transition ${
                viewMode === 'MAP'
                  ? 'bg-sky-400 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              WORLD MAP
            </button>
          </div>

          <div className="panel-bevel flex items-center gap-1.5 rounded-xl border border-amber-400/30 px-3 py-2">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="font-mono-num text-sm font-extrabold text-amber-300">
              {totalStars}/{STAGES.length * 3}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Stage Select Hero + Cards OR Panoramic World Map */}
      {viewMode === 'STAGES' ? (
        <div className="frontier-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {/* Featured Selected Stage Card */}
          <div className="panel-bevel grid grid-cols-1 overflow-hidden rounded-2xl border border-white/15 md:grid-cols-12">
            <div className="relative h-40 overflow-hidden md:col-span-5 md:h-auto">
              {renderBiomeArtwork(selectedStage.id)}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 flex items-center gap-1">
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    className={`h-4 w-4 ${
                      n <= selectedStars
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col justify-between gap-3 p-4 md:col-span-7">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Compass className="h-4 w-4 text-amber-400" />
                  <h2 className="font-display text-2xl font-extrabold tracking-wider uppercase italic">
                    {selectedStage.name}
                  </h2>
                  {!selectedUnlocked && (
                    <span className="inline-flex items-center gap-1 rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-300 uppercase">
                      <Lock className="h-3 w-3" />
                      LOCKED
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-300 sm:text-sm">
                  {selectedStage.subtitle}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="font-mono-num text-amber-300">
                    BEST {selectedBest}m
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono-num text-sky-300">
                    {selectedStage.gravityMult.toFixed(2)}G GRAVITY
                  </span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono-num text-emerald-300">
                    {Math.round(selectedStage.gripMult * 100)}% GRIP
                  </span>
                </div>

                {selectedHazards.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {selectedHazards.map((tag) => (
                      <span
                        key={tag.label}
                        className={`rounded border px-2 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${tag.colorClass}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                )}

                {!selectedUnlocked && (
                  <p className="mt-2.5 text-xs font-bold text-amber-300">
                    Unlock Requirement: {selectedStage.unlockRequirementText}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={!selectedUnlocked}
                  onClick={() => onStartRace(selectedStage.id)}
                  className={`flex items-center gap-2 rounded-xl px-7 py-2.5 font-display text-base font-extrabold tracking-wider uppercase italic shadow-lg transition ${
                    selectedUnlocked
                      ? 'bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 text-slate-950 hover:brightness-105'
                      : 'cursor-not-allowed border border-white/10 bg-slate-800 text-slate-500'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  {selectedUnlocked ? `RACE ${selectedStage.name}` : 'LOCKED'}
                </button>
              </div>
            </div>
          </div>

          {/* 5-Biome Selector Strip / Grid */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {STAGES.map((stage) => {
              const unlocked = isStageUnlocked(stage.id, save);
              const best = Math.floor(save.stageBests[stage.id] ?? 0);
              const stars = getStageStars(stage.id, best);
              const isSelected = inspectedStageId === stage.id;
              const isActiveEquipped = save.selectedStage === stage.id;

              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handlePickStage(stage.id)}
                  className={`panel-bevel flex flex-col overflow-hidden rounded-2xl border text-left transition ${
                    isSelected
                      ? 'border-amber-300 ring-1 ring-amber-400/60'
                      : unlocked
                        ? 'border-white/15 hover:border-white/40'
                        : 'border-white/10 opacity-80 hover:opacity-100'
                  }`}
                >
                  <div className="h-2 w-full" style={{ background: stage.badgeGradient }} />
                  <div className="flex flex-1 flex-col justify-between gap-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-display text-base font-extrabold tracking-wider text-white uppercase italic">
                          {stage.name}
                        </div>
                        <div className="font-mono-num text-[11px] font-bold text-slate-300">
                          BEST {best}m
                        </div>
                      </div>
                      {isActiveEquipped ? (
                        <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                      ) : !unlocked ? (
                        <Lock className="h-4 w-4 shrink-0 text-amber-400" />
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((n) => (
                          <Star
                            key={n}
                            className={`h-3.5 w-3.5 ${
                              n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-mono-num text-[10px] font-bold text-slate-400">
                        {stage.gravityMult.toFixed(2)}G
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Interactive Panoramic Terrain Map */
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-slate-900 shadow-2xl">
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
              <linearGradient id="viceLand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff5ea8" />
                <stop offset="55%" stopColor="#fb923c" />
                <stop offset="100%" stopColor="#2e1065" />
              </linearGradient>
            </defs>

            <rect width="1200" height="540" fill="url(#mapOcean)" />

            <g stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="1.2" fill="none">
              <path d="M0 120 Q300 90 600 135 T1200 110" />
              <path d="M0 240 Q320 205 640 250 T1200 225" />
              <path d="M0 360 Q280 330 620 375 T1200 350" />
              <path d="M0 470 Q340 440 660 480 T1200 460" />
            </g>

            <path
              d="M40 310 Q140 200 280 250 Q350 320 310 430 Q180 490 60 420 Z"
              fill="url(#greenLand)"
              stroke="#86efac"
              strokeOpacity="0.4"
              strokeWidth="3"
            />
            <g fill="#1b4322" fillOpacity="0.72">
              <polygon points="105,305 117,275 129,305" />
              <polygon points="240,295 251,268 262,295" />
              <rect x="195" y="388" width="22" height="16" rx="2" fill="#991b1b" />
            </g>

            <path
              d="M320 220 Q460 150 590 215 Q635 310 565 405 Q430 430 340 340 Z"
              fill="url(#canyonLand)"
              stroke="#fdba74"
              strokeOpacity="0.42"
              strokeWidth="3"
            />
            <path d="M395 230 L412 205 L455 205 L470 230 Z" fill="#7c2d12" fillOpacity="0.65" />
            <path d="M510 300 L525 275 L562 275 L575 300 Z" fill="#7c2d12" fillOpacity="0.65" />

            <path
              d="M610 140 Q740 80 885 150 Q925 270 845 360 Q715 385 625 280 Z"
              fill="url(#frostLand)"
              stroke="#bfdbfe"
              strokeOpacity="0.52"
              strokeWidth="3"
            />
            <polygon points="695,180 735,112 775,180" fill="#f8fafc" fillOpacity="0.72" />
            <polygon points="785,205 820,136 858,205" fill="#e0f2fe" fillOpacity="0.65" />

            <circle
              cx="1030"
              cy="130"
              r="108"
              fill="url(#moonLand)"
              stroke="#cbd5e1"
              strokeOpacity="0.48"
              strokeWidth="3"
            />
            <circle cx="995" cy="105" r="22" fill="#4b5563" fillOpacity="0.65" />
            <circle cx="1065" cy="145" r="16" fill="#4b5563" fillOpacity="0.65" />

            <path
              d="M740 340 Q890 295 1070 325 Q1165 375 1130 465 Q980 515 790 465 Q710 415 740 340 Z"
              fill="url(#viceLand)"
              stroke="#00f5ff"
              strokeOpacity="0.55"
              strokeWidth="3"
            />

            <path
              d="M168 378 C240 340, 320 305, 408 280 C520 245, 590 205, 672 184 C790 155, 900 132, 1008 108"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.5"
              strokeDasharray="12 10"
              strokeLinecap="round"
              strokeOpacity="0.88"
            />
            <path
              d="M408 280 C550 325, 740 365, 936 394"
              fill="none"
              stroke="#ff2a85"
              strokeWidth="4"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeOpacity="0.85"
            />
          </svg>

          {STAGES.map((stage) => {
            const pos = NODE_POSITIONS[stage.id];
            const unlocked = isStageUnlocked(stage.id, save);
            const best = Math.floor(save.stageBests[stage.id] ?? 0);
            const stars = getStageStars(stage.id, best);
            const active = inspectedStageId === stage.id;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => handlePickStage(stage.id)}
                style={{ left: pos.x, top: pos.y }}
                className={`panel-bevel absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-2.5 py-1.5 text-left transition sm:rounded-2xl sm:px-3.5 sm:py-2.5 ${
                  active
                    ? 'scale-105 border-amber-300 ring-2 ring-amber-400/50'
                    : unlocked
                      ? 'border-white/25 hover:scale-105 hover:border-white/60'
                      : 'border-white/10 opacity-85 hover:opacity-100'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xs font-extrabold tracking-wider text-white uppercase italic sm:text-base">
                    {stage.name}
                  </span>
                  {save.selectedStage === stage.id && (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  {!unlocked && <Lock className="h-3.5 w-3.5 text-amber-400" />}
                </div>
                <div className="font-mono-num text-[10px] font-bold text-slate-300 sm:text-[11px]">
                  BEST: {best}m
                </div>
                <div className="mt-0.5 flex items-center gap-0.5">
                  {[1, 2, 3].map((n) => (
                    <Star
                      key={n}
                      className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                        n <= stars ? 'fill-amber-400 text-amber-400' : 'text-slate-600'
                      }`}
                    />
                  ))}
                </div>
              </button>
            );
          })}

          <div className="panel-bevel absolute bottom-3 left-3 hidden max-w-md rounded-xl border border-white/15 p-3 sm:block">
            <div className="flex flex-wrap items-center gap-2">
              <Flag className="h-4 w-4 text-amber-400" />
              <span className="font-display text-lg font-extrabold tracking-wider uppercase italic">
                {selectedStage.name}
              </span>
              <span className="font-mono-num text-[10px] font-bold text-sky-300">
                {selectedStage.gravityMult.toFixed(2)}g
              </span>
              <span className="font-mono-num text-[10px] font-bold text-emerald-300">
                GRIP {Math.round(selectedStage.gripMult * 100)}%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">{selectedStage.subtitle}</p>
            {!selectedUnlocked && (
              <p className="mt-1 text-xs font-bold text-amber-300">
                Unlock Requirement: {selectedStage.unlockRequirementText}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="panel-bevel flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 font-display text-sm font-extrabold tracking-wider uppercase italic hover:border-white/40 sm:px-5 sm:py-3"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenEvents}
            className="panel-bevel flex items-center gap-2 rounded-xl border border-violet-400/40 px-4 py-2.5 font-display text-sm font-extrabold tracking-wider text-violet-200 uppercase italic hover:border-violet-300 sm:px-5 sm:py-3"
          >
            <Trophy className="h-4 w-4 text-yellow-300" />
            EVENTS
          </button>

          <button
            type="button"
            disabled={!selectedUnlocked}
            onClick={() => onStartRace(selectedStage.id)}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 font-display text-base font-extrabold tracking-wider uppercase italic shadow-xl transition sm:px-8 sm:py-3 ${
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
