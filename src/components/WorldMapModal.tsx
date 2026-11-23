import React from 'react';
import { ArrowLeft, Check, Flag, Lock, Star, Trophy } from 'lucide-react';
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
  countryside: { x: '14%', y: '70%' },
  red_canyon: { x: '34%', y: '52%' },
  frost_peaks: { x: '56%', y: '34%' },
  moon: { x: '84%', y: '20%' },
  vice_coast: { x: '78%', y: '73%' },
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
  const selectedHazards = getStageHazards(selectedStage);

  return (
    <div className="fixed inset-0 z-30 flex flex-col justify-between bg-slate-950 p-4 text-white sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
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
              WORLD MAP
            </h1>
            <p className="text-xs font-bold tracking-widest text-sky-300 uppercase">
              JACK_HILL_GAME · 5 BIOMES &amp; LEONIDA COASTWAY
            </p>
          </div>
        </div>

        <div className="panel-bevel flex items-center gap-2 rounded-xl border border-amber-400/30 px-3.5 py-2">
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
            <linearGradient id="viceLand" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ff5ea8" />
              <stop offset="55%" stopColor="#fb923c" />
              <stop offset="100%" stopColor="#2e1065" />
            </linearGradient>
          </defs>

          <rect width="1200" height="540" fill="url(#mapOcean)" />

          {/* Subtle Topographic Grid & Elevation Contours */}
          <g stroke="#38bdf8" strokeOpacity="0.08" strokeWidth="1.2" fill="none">
            <path d="M0 120 Q300 90 600 135 T1200 110" />
            <path d="M0 240 Q320 205 640 250 T1200 225" />
            <path d="M0 360 Q280 330 620 375 T1200 350" />
            <path d="M0 470 Q340 440 660 480 T1200 460" />
          </g>

          {/* Countryside Rolling Meadow Island */}
          <path
            d="M40 310 Q140 200 280 250 Q350 320 310 430 Q180 490 60 420 Z"
            fill="url(#greenLand)"
            stroke="#86efac"
            strokeOpacity="0.4"
            strokeWidth="3"
          />
          <path
            d="M80 330 Q150 250 250 285 Q295 340 265 400 Q175 435 95 390 Z"
            fill="none"
            stroke="#bbf7d0"
            strokeOpacity="0.22"
            strokeWidth="1.5"
          />
          {/* Countryside Pine & Barn silhouettes */}
          <g fill="#1b4322" fillOpacity="0.72">
            <polygon points="105,305 117,275 129,305" />
            <polygon points="240,295 251,268 262,295" />
            <rect x="195" y="388" width="22" height="16" rx="2" fill="#991b1b" />
          </g>

          {/* Red Canyon Mesa */}
          <path
            d="M320 220 Q460 150 590 215 Q635 310 565 405 Q430 430 340 340 Z"
            fill="url(#canyonLand)"
            stroke="#fdba74"
            strokeOpacity="0.42"
            strokeWidth="3"
          />
          {/* Sandstone Mesa Plateau Silhouettes */}
          <path d="M395 230 L412 205 L455 205 L470 230 Z" fill="#7c2d12" fillOpacity="0.65" />
          <path d="M510 300 L525 275 L562 275 L575 300 Z" fill="#7c2d12" fillOpacity="0.65" />

          {/* Frost Peaks Range */}
          <path
            d="M610 140 Q740 80 885 150 Q925 270 845 360 Q715 385 625 280 Z"
            fill="url(#frostLand)"
            stroke="#bfdbfe"
            strokeOpacity="0.52"
            strokeWidth="3"
          />
          {/* Alpine Jagged Peaks */}
          <polygon points="695,180 735,112 775,180" fill="#f8fafc" fillOpacity="0.72" />
          <polygon points="785,205 820,136 858,205" fill="#e0f2fe" fillOpacity="0.65" />

          {/* Starfield & Moon Crater Orbit Disc */}
          <g fill="#e2e8f0" fillOpacity="0.55">
            <circle cx="905" cy="58" r="2" />
            <circle cx="1140" cy="70" r="2.2" />
            <circle cx="1165" cy="215" r="1.8" />
            <circle cx="945" cy="245" r="1.6" />
          </g>
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
          <circle cx="1040" cy="84" r="11" fill="#4b5563" fillOpacity="0.5" />

          {/* Vice Coastway Neon Sunset Peninsula (Leonida Highway) */}
          <path
            d="M740 340 Q890 295 1070 325 Q1165 375 1130 465 Q980 515 790 465 Q710 415 740 340 Z"
            fill="url(#viceLand)"
            stroke="#00f5ff"
            strokeOpacity="0.55"
            strokeWidth="3"
          />
          <g stroke="#22d3ee" strokeWidth="2.5" strokeOpacity="0.7" fill="none">
            <line x1="830" y1="435" x2="835" y2="395" />
            <path d="M815 398 Q835 385 855 398" />
            <line x1="1030" y1="420" x2="1035" y2="378" />
            <path d="M1015 382 Q1035 368 1055 382" />
          </g>

          {/* Winding Trail Glow Underlay + Dashed Expedition Route */}
          <path
            d="M168 378 C240 340, 320 305, 408 280 C520 245, 590 205, 672 184 C790 155, 900 132, 1008 108"
            fill="none"
            stroke="#ffc52e"
            strokeWidth="10"
            strokeLinecap="round"
            strokeOpacity="0.22"
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
          {/* Vice Coastway Highway Spur */}
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
              className={`panel-bevel absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3.5 py-2.5 text-left transition ${
                active
                  ? 'scale-105 border-amber-300 ring-2 ring-amber-400/50'
                  : unlocked
                    ? 'border-white/25 hover:scale-105 hover:border-white/60'
                    : 'border-white/10 opacity-85 hover:opacity-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-extrabold tracking-wider text-white uppercase italic sm:text-base">
                  {stage.name}
                </span>
                {active && <Check className="h-4 w-4 text-emerald-400" />}
                {!unlocked && <Lock className="h-3.5 w-3.5 text-amber-400" />}
              </div>

              <div className="mt-0.5 flex items-center gap-2 font-mono-num text-[11px] font-bold text-slate-300">
                <span>BEST: {best}m</span>
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

        {/* Bottom-Left Stage Details & Obstacles Card */}
        <div className="panel-bevel absolute bottom-3 left-3 max-w-md rounded-xl border border-white/15 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <Flag className="h-4 w-4 text-amber-400" />
            <span className="font-display text-lg font-extrabold tracking-wider uppercase italic">
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

          {/* Obstacles & Hazards Strip */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {selectedHazards.map((tag) => (
              <span
                key={tag.label}
                className={`rounded border px-1.5 py-0.5 text-[10px] font-extrabold tracking-wider uppercase ${tag.colorClass}`}
              >
                {tag.label}
              </span>
            ))}
          </div>

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
          className="panel-bevel flex items-center gap-2 rounded-xl border border-white/20 px-5 py-3 font-display text-sm font-extrabold tracking-wider uppercase italic hover:border-white/40"
        >
          <ArrowLeft className="h-4 w-4" />
          BACK
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenEvents}
            className="panel-bevel flex items-center gap-2 rounded-xl border border-violet-400/40 px-5 py-3 font-display text-sm font-extrabold tracking-wider text-violet-200 uppercase italic hover:border-violet-300"
          >
            <Trophy className="h-4 w-4 text-yellow-300" />
            EVENTS
          </button>

          <button
            type="button"
            disabled={!selectedUnlocked}
            onClick={() => onStartRace(selectedStage.id)}
            className={`flex items-center gap-2 rounded-xl px-8 py-3 font-display text-base font-extrabold tracking-wider uppercase italic shadow-xl transition ${
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
