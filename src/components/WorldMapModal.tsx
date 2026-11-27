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
              JACK HILL CRAWL · {STAGES.length} BIOMES
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
        /* Interactive Topographic & Satellite Vector World Map */
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl">
          <svg
            viewBox="0 0 1200 540"
            preserveAspectRatio="xMidYMid slice"
            className="h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="mapOcean" cx="45%" cy="48%" r="72%">
                <stop offset="0%" stopColor="#0f3458" />
                <stop offset="55%" stopColor="#0b223d" />
                <stop offset="100%" stopColor="#050b18" />
              </radialGradient>
              <linearGradient id="coastalShelf" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e6b8a" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#0f3e63" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="greenLand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#5ec250" />
                <stop offset="60%" stopColor="#358536" />
                <stop offset="100%" stopColor="#1f5126" />
              </linearGradient>
              <linearGradient id="canyonLand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ea8b49" />
                <stop offset="60%" stopColor="#b84b29" />
                <stop offset="100%" stopColor="#6c2214" />
              </linearGradient>
              <linearGradient id="frostLand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f1f5f9" />
                <stop offset="55%" stopColor="#93c5fd" />
                <stop offset="100%" stopColor="#335b87" />
              </linearGradient>
              <radialGradient id="moonLand" cx="38%" cy="34%" r="62%">
                <stop offset="0%" stopColor="#d1d5db" />
                <stop offset="60%" stopColor="#6b7280" />
                <stop offset="100%" stopColor="#1f2937" />
              </radialGradient>
              <linearGradient id="viceLand" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fb7185" />
                <stop offset="48%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#3b0764" />
              </linearGradient>
            </defs>

            <rect width="1200" height="540" fill="url(#mapOcean)" />

            {/* Latitude / Longitude Cartographic Grid */}
            <g stroke="#38bdf8" strokeOpacity="0.09" strokeWidth="1">
              {[120, 240, 360, 480, 600, 720, 840, 960, 1080].map((gx) => (
                <line key={`vx-${gx}`} x1={gx} y1="0" x2={gx} y2="540" />
              ))}
              {[90, 180, 270, 360, 450].map((gy) => (
                <line key={`hy-${gy}`} x1="0" y1={gy} x2="1200" y2={gy} />
              ))}
            </g>

            {/* Ocean Bathymetry Shelves & Currents */}
            <path
              d="M25 305 Q150 165 300 230 Q435 125 605 185 Q755 65 920 140 Q945 265 865 355 Q1020 295 1165 340 Q1185 480 990 520 Q745 485 570 430 Q330 460 155 495 Q25 435 25 305 Z"
              fill="url(#coastalShelf)"
            />
            <g stroke="#38bdf8" strokeOpacity="0.14" strokeWidth="1.2" fill="none" strokeDasharray="6 8">
              <path d="M0 130 Q260 95 530 145 T1200 108" />
              <path d="M0 285 Q290 250 580 295 T1200 265" />
              <path d="M0 450 Q340 415 680 465 T1200 440" />
            </g>

            {/* 1. COUNTRYSIDE BIOME: Rolling Meadows, Pine Forest, River Delta & Elevation Contours */}
            <g>
              <path
                d="M36 308 Q138 190 286 244 Q358 318 314 432 Q182 496 58 424 Z"
                fill="url(#greenLand)"
                stroke="#86efac"
                strokeOpacity="0.48"
                strokeWidth="2.5"
              />
              {/* Elevation contour rings */}
              <path
                d="M72 325 Q152 232 260 268 Q312 326 280 404 Q178 448 86 392 Z"
                fill="none"
                stroke="#bbf7d0"
                strokeOpacity="0.28"
                strokeWidth="1.5"
              />
              <path
                d="M108 336 Q165 270 236 296 Q268 338 242 384 Q176 410 120 374 Z"
                fill="#4ade80"
                fillOpacity="0.14"
                stroke="#dcfce7"
                strokeOpacity="0.32"
                strokeWidth="1.2"
              />
              {/* Winding valley river */}
              <path
                d="M154 222 Q190 278 164 335 T216 456"
                fill="none"
                stroke="#38bdf8"
                strokeOpacity="0.72"
                strokeWidth="5"
                strokeLinecap="round"
              />
              {/* Pine clusters & red barn landmark */}
              <g fill="#14532d" fillOpacity="0.82">
                <polygon points="96,306 108,274 120,306" />
                <polygon points="114,316 125,286 136,316" />
                <polygon points="242,294 254,264 266,294" />
                <polygon points="258,308 269,280 280,308" />
                <polygon points="122,404 132,380 142,404" />
              </g>
              <rect x="200" y="382" width="22" height="16" rx="2" fill="#b91c1c" />
              <polygon points="198,382 211,371 224,382" fill="#e2e8f0" />
            </g>

            {/* 2. RED CANYON BIOME: Mesa Terraces, Gorge & Trestle Span */}
            <g>
              <path
                d="M318 222 Q462 146 594 214 Q640 314 568 408 Q432 436 338 342 Z"
                fill="url(#canyonLand)"
                stroke="#fdba74"
                strokeOpacity="0.48"
                strokeWidth="2.5"
              />
              {/* Topographic canyon gorge */}
              <path
                d="M356 268 Q458 232 548 278 Q568 338 518 378 Q428 394 374 332 Z"
                fill="#7c2d12"
                fillOpacity="0.32"
                stroke="#fed7aa"
                strokeOpacity="0.28"
                strokeWidth="1.4"
              />
              {/* Shaded mesas */}
              <path d="M390 232 L408 202 L456 202 L472 232 Z" fill="#9a3412" />
              <path d="M408 202 L456 202 L448 214 L414 214 Z" fill="#fb923c" fillOpacity="0.6" />
              <path d="M506 304 L524 274 L564 274 L578 304 Z" fill="#7c2d12" />
              <path d="M524 274 L564 274 L556 286 L530 286 Z" fill="#fdba74" fillOpacity="0.55" />
              {/* Dry riverbed */}
              <path
                d="M398 372 Q458 318 520 342"
                fill="none"
                stroke="#451a03"
                strokeOpacity="0.55"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </g>

            {/* 3. FROST PEAKS BIOME: Glacier Ridges, Snow Caps & Aurora Ribbon */}
            <g>
              <path
                d="M608 138 Q742 74 888 148 Q930 272 848 364 Q712 390 622 282 Z"
                fill="url(#frostLand)"
                stroke="#bae6fd"
                strokeOpacity="0.58"
                strokeWidth="2.5"
              />
              {/* Glacier contour rings */}
              <path
                d="M648 168 Q746 112 854 166 Q884 256 822 328 Q720 346 656 266 Z"
                fill="none"
                stroke="#ffffff"
                strokeOpacity="0.34"
                strokeWidth="1.4"
              />
              {/* Shaded relief peaks */}
              <polygon points="692,190 738,108 784,190" fill="#334155" fillOpacity="0.65" />
              <polygon points="738,108 784,190 742,190" fill="#e0f2fe" fillOpacity="0.88" />
              <polygon points="782,218 824,138 866,218" fill="#1e293b" fillOpacity="0.62" />
              <polygon points="824,138 866,218 826,218" fill="#f8fafc" fillOpacity="0.82" />
              {/* Aurora ribbon */}
              <path
                d="M640 120 Q720 82 810 110 T895 104"
                fill="none"
                stroke="#34d399"
                strokeOpacity="0.45"
                strokeWidth="8"
                strokeLinecap="round"
              />
            </g>

            {/* 4. MOON BIOME: Orbital Crater Sphere, Terminator Shadow & Mare Basins */}
            <g>
              <circle
                cx="1032"
                cy="128"
                r="108"
                fill="url(#moonLand)"
                stroke="#e2e8f0"
                strokeOpacity="0.52"
                strokeWidth="2.5"
              />
              <circle cx="992" cy="100" r="24" fill="#374151" fillOpacity="0.68" stroke="#cbd5e1" strokeOpacity="0.3" strokeWidth="1.5" />
              <circle cx="1068" cy="148" r="18" fill="#374151" fillOpacity="0.62" stroke="#cbd5e1" strokeOpacity="0.28" strokeWidth="1.5" />
              <circle cx="1036" cy="76" r="11" fill="#4b5563" fillOpacity="0.65" />
              <circle cx="964" cy="158" r="13" fill="#4b5563" fillOpacity="0.58" />
              {/* Lunar rover base beacon */}
              <rect x="980" y="114" width="12" height="8" rx="2" fill="#facc15" />
            </g>

            {/* 5. VICE COASTWAY BIOME: Barrier Islands, Causeway Bridges & Neon Strip */}
            <g>
              <path
                d="M736 338 Q890 292 1074 322 Q1172 374 1134 468 Q982 520 788 468 Q706 416 736 338 Z"
                fill="url(#viceLand)"
                stroke="#22d3ee"
                strokeOpacity="0.62"
                strokeWidth="2.5"
              />
              {/* Barrier island & bay */}
              <path
                d="M840 356 Q952 332 1068 358 Q1096 408 1044 446 Q924 464 832 422 Z"
                fill="#0f172a"
                fillOpacity="0.34"
                stroke="#f472b6"
                strokeOpacity="0.35"
                strokeWidth="1.5"
              />
              {/* Causeway span */}
              <line x1="796" y1="398" x2="1088" y2="392" stroke="#22d3ee" strokeWidth="3.5" strokeOpacity="0.8" />
              {/* Deco skyline blocks */}
              <g fill="#f43f5e" fillOpacity="0.72">
                <rect x="985" y="362" width="10" height="22" rx="1.5" />
                <rect x="1000" y="352" width="12" height="32" rx="1.5" fill="#fbbf24" fillOpacity="0.75" />
                <rect x="1016" y="366" width="9" height="18" rx="1.5" fill="#22d3ee" fillOpacity="0.75" />
              </g>
            </g>

            {/* Main Frontier Highway & Vice Coastway Route with Mile Markers */}
            <path
              d="M192 368 C258 332, 336 298, 432 270 C535 238, 600 198, 672 184 C786 155, 898 132, 984 118"
              fill="none"
              stroke="#0f172a"
              strokeWidth="9"
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
            <path
              d="M192 368 C258 332, 336 298, 432 270 C535 238, 600 198, 672 184 C786 155, 898 132, 984 118"
              fill="none"
              stroke="#f8fafc"
              strokeWidth="4"
              strokeDasharray="12 10"
              strokeLinecap="round"
              strokeOpacity="0.92"
            />
            <path
              d="M432 270 C570 318, 745 362, 936 388"
              fill="none"
              stroke="#0f172a"
              strokeWidth="8"
              strokeLinecap="round"
              strokeOpacity="0.55"
            />
            <path
              d="M432 270 C570 318, 745 362, 936 388"
              fill="none"
              stroke="#ff2a85"
              strokeWidth="3.8"
              strokeDasharray="10 8"
              strokeLinecap="round"
              strokeOpacity="0.92"
            />

            {/* Route Waypoint Pins */}
            <g fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5">
              <circle cx="312" cy="312" r="4.5" />
              <circle cx="566" cy="224" r="4.5" />
              <circle cx="835" cy="146" r="4.5" />
              <circle cx="695" cy="340" r="4.5" fill="#22d3ee" />
            </g>

            {/* Subtle Atmospheric Cloud Wisps */}
            <g fill="#ffffff" fillOpacity="0.06">
              <ellipse cx="260" cy="135" rx="95" ry="18" />
              <ellipse cx="640" cy="465" rx="130" ry="20" />
              <ellipse cx="1060" cy="260" rx="85" ry="14" />
            </g>

            {/* Compass Rose (Top Left) */}
            <g transform="translate(56, 56)" opacity="0.7">
              <circle cx="0" cy="0" r="24" fill="#0f172a" fillOpacity="0.55" stroke="#38bdf8" strokeOpacity="0.45" strokeWidth="1.5" />
              <polygon points="0,-18 5,-3 0,-7 -5,-3" fill="#fbbf24" />
              <polygon points="0,18 4,3 0,7 -4,3" fill="#94a3b8" />
              <polygon points="-18,0 -3,-4 -7,0 -3,4" fill="#94a3b8" />
              <polygon points="18,0 3,-4 7,0 3,4" fill="#94a3b8" />
              <text x="0" y="-27" textAnchor="middle" fill="#fbbf24" fontSize="9" fontWeight="bold">N</text>
            </g>
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
