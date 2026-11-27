import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowUp,
  Camera,
  Compass,
  Cpu,
  Flame,
  Gamepad2,
  Gauge,
  Ghost,
  Home,
  Pause,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { sampleElevationProfile } from '../game/terrain';
import { NN_INPUT_LABELS, NN_OUTPUT_LABELS } from '../shared/nnCore';
import {
  CameraMode,
  HudLiveSnapshot,
  InputState,
  NnLiveTelemetry,
  StageConfig,
} from '../types/game';

export interface GameplayHudHandle {
  updateLive: (snap: HudLiveSnapshot) => void;
}

interface GameplayHudProps {
  muted: boolean;
  stage: StageConfig;
  showHints: boolean;
  showTouchControls: boolean;
  gamepadActive: boolean;
  aiAutoPilot: boolean;
  watchAiMode: boolean;
  cameraMode: CameraMode;
  showGhost: boolean;
  gyroEnabled: boolean;
  onCycleCamera: () => void;
  onToggleAiAutoPilot: () => void;
  onToggleGhost: () => void;
  onToggleGyro: () => void;
  onOpenSettings: () => void;
  onReturnToPaddock: () => void;
  onInputChange: (partial: Partial<InputState>) => void;
  onPause: () => void;
  onToggleMute: () => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, sec);
  const mins = Math.floor(s / 60);
  const rem = s - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

export const GameplayHud = forwardRef<GameplayHudHandle, GameplayHudProps>(
  (
    {
      muted,
      stage,
      showHints,
      showTouchControls,
      gamepadActive,
      aiAutoPilot,
      watchAiMode,
      cameraMode,
      showGhost,
      gyroEnabled,
      onCycleCamera,
      onToggleAiAutoPilot,
      onToggleGhost,
      onToggleGyro,
      onOpenSettings,
      onReturnToPaddock,
      onInputChange,
      onPause,
      onToggleMute,
    },
    ref,
  ) => {
    const [xRayOpen, setXRayOpen] = useState(false);
    const [telemetry, setTelemetry] = useState<NnLiveTelemetry | null>(null);
    const xRayOpenRef = useRef(false);
    const lastTelemUpdateRef = useRef(0);

    const distRef = useRef<HTMLSpanElement>(null);
    const timeRef = useRef<HTMLSpanElement>(null);
    const rivalDeltaRef = useRef<HTMLSpanElement>(null);
    const fuelFillRef = useRef<HTMLDivElement>(null);
    const fuelTextRef = useRef<HTMLSpanElement>(null);
    const tireFillRef = useRef<HTMLDivElement>(null);
    const tireTextRef = useRef<HTMLSpanElement>(null);

    const playerMarkerRef = useRef<SVGCircleElement>(null);
    const aiMarkerRef = useRef<SVGCircleElement>(null);
    const ghostMarkerRef = useRef<SVGCircleElement>(null);

    const speedRef = useRef<HTMLSpanElement>(null);
    const gearRef = useRef<HTMLSpanElement>(null);
    const slopeRef = useRef<HTMLSpanElement>(null);
    const nitroFillRef = useRef<HTMLDivElement>(null);

    const calloutBoxRef = useRef<HTMLDivElement>(null);
    const calloutTitleRef = useRef<HTMLDivElement>(null);
    const calloutBonusRef = useRef<HTMLDivElement>(null);

    const brakeBtnRef = useRef<HTMLButtonElement>(null);
    const gasBtnRef = useRef<HTMLButtonElement>(null);
    const jumpBtnRef = useRef<HTMLButtonElement>(null);
    const lowRangeBtnRef = useRef<HTMLButtonElement>(null);

    // Precompute Top-Left Elevation Minimap SVG paths from live terrain height function
    const minimapGeometry = useMemo(() => {
      const pts = sampleElevationProfile(stage, 48);
      const w = 180;
      const h = 44;
      let minY = Infinity;
      let maxY = -Infinity;
      pts.forEach((p) => {
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
      const spanY = Math.max(4, maxY - minY);
      const coords = pts.map((p) => {
        const x = 6 + p.normX * (w - 12);
        const y = h - 7 - ((p.y - minY) / spanY) * (h - 14);
        return { x, y };
      });
      const linePath = coords
        .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
        .join(' ');
      const areaPath = `${linePath} L ${(w - 6).toFixed(1)} ${h} L 6 ${h} Z`;
      return { coords, linePath, areaPath, w, h };
    }, [stage]);

    const pointAtNormX = (normX: number) => {
      const clamped = Math.max(0, Math.min(1, normX));
      const idx = clamped * (minimapGeometry.coords.length - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(minimapGeometry.coords.length - 1, i0 + 1);
      const frac = idx - i0;
      const a = minimapGeometry.coords[i0];
      const b = minimapGeometry.coords[i1];
      return {
        x: a.x + (b.x - a.x) * frac,
        y: a.y + (b.y - a.y) * frac,
      };
    };

    const toggleXRay = () => {
      const next = !xRayOpenRef.current;
      xRayOpenRef.current = next;
      setXRayOpen(next);
    };

    useImperativeHandle(ref, () => ({
      updateLive(snap: HudLiveSnapshot) {
        if (distRef.current) {
          distRef.current.textContent = `${snap.distanceMeters}/${snap.summitMeters}m`;
        }
        if (timeRef.current) {
          timeRef.current.textContent = formatClock(snap.climbTimeSec);
        }

        if (playerMarkerRef.current) {
          const p = pointAtNormX(snap.playerNormX);
          playerMarkerRef.current.setAttribute('cx', p.x.toFixed(1));
          playerMarkerRef.current.setAttribute('cy', p.y.toFixed(1));
        }
        if (aiMarkerRef.current) {
          if (snap.aiNormX !== null) {
            const p = pointAtNormX(snap.aiNormX);
            aiMarkerRef.current.style.display = 'inline';
            aiMarkerRef.current.setAttribute('cx', p.x.toFixed(1));
            aiMarkerRef.current.setAttribute('cy', p.y.toFixed(1));
          } else {
            aiMarkerRef.current.style.display = 'none';
          }
        }
        if (ghostMarkerRef.current) {
          if (snap.ghostNormX !== null) {
            const p = pointAtNormX(snap.ghostNormX);
            ghostMarkerRef.current.style.display = 'inline';
            ghostMarkerRef.current.setAttribute('cx', p.x.toFixed(1));
            ghostMarkerRef.current.setAttribute('cy', p.y.toFixed(1));
          } else {
            ghostMarkerRef.current.style.display = 'none';
          }
        }

        if (rivalDeltaRef.current) {
          if (snap.ghostDeltaMeters !== null) {
            const rounded = Math.round(snap.ghostDeltaMeters);
            const ahead = rounded >= 0;
            rivalDeltaRef.current.style.display = 'inline';
            rivalDeltaRef.current.textContent = ahead
              ? `${snap.rivalLabel} +${rounded}m`
              : `${snap.rivalLabel} ${rounded}m`;
            rivalDeltaRef.current.style.color = ahead ? '#6ee7b7' : '#67e8f9';
          } else {
            rivalDeltaRef.current.style.display = 'none';
          }
        }

        const clampedFuel = Math.max(0, Math.min(100, snap.fuelPct));
        if (fuelFillRef.current) {
          fuelFillRef.current.style.width = `${clampedFuel}%`;
          fuelFillRef.current.style.background =
            clampedFuel <= 22 ? '#ef4444' : clampedFuel <= 45 ? '#f59e0b' : '#22c55e';
        }
        if (fuelTextRef.current) {
          fuelTextRef.current.textContent = `${Math.round(clampedFuel)}%`;
        }

        const clampedTire = Math.max(0, Math.min(100, snap.tireHealthPct));
        if (tireFillRef.current) {
          tireFillRef.current.style.width = `${clampedTire}%`;
          tireFillRef.current.style.background =
            clampedTire <= 35 ? '#f97316' : '#38bdf8';
        }
        if (tireTextRef.current) {
          tireTextRef.current.textContent = `${Math.round(clampedTire)}%`;
        }

        if (jumpBtnRef.current) {
          jumpBtnRef.current.style.display = showTouchControls && snap.hasJumpShocks ? 'flex' : 'none';
        }
        if (lowRangeBtnRef.current) {
          lowRangeBtnRef.current.style.display = showTouchControls && snap.hasLowRange ? 'flex' : 'none';
        }

        if (speedRef.current) {
          speedRef.current.textContent = String(snap.speedKmh);
        }
        if (gearRef.current) {
          gearRef.current.textContent = `G${snap.gear}`;
        }
        if (slopeRef.current) {
          const deg = Math.round(snap.slopeDeg);
          slopeRef.current.textContent = `${deg >= 0 ? '+' : ''}${deg}°`;
          slopeRef.current.style.color = Math.abs(deg) >= 24 ? '#fbbf24' : '#cbd5e1';
        }
        if (nitroFillRef.current) {
          nitroFillRef.current.style.width = `${Math.round(Math.max(0, Math.min(100, snap.nitroEnergy)))}%`;
        }

        if (calloutBoxRef.current && calloutTitleRef.current && calloutBonusRef.current) {
          if (snap.callout && snap.callout.remainingSec > 0) {
            calloutBoxRef.current.style.opacity = String(
              Math.min(1, snap.callout.remainingSec * 1.4),
            );
            calloutTitleRef.current.textContent = snap.callout.title;
            calloutBonusRef.current.textContent =
              snap.callout.bonusCoins > 0 ? `+${snap.callout.bonusCoins} COINS` : 'CLEAN';
          } else {
            calloutBoxRef.current.style.opacity = '0';
          }
        }

        if (xRayOpenRef.current && snap.nnTelemetry) {
          const now = performance.now();
          if (now - lastTelemUpdateRef.current > 90) {
            lastTelemUpdateRef.current = now;
            setTelemetry(snap.nnTelemetry);
          }
        }
      },
    }));

    const bindPedal = (
      key: keyof InputState,
      btnRef: React.RefObject<HTMLButtonElement | null>,
    ) => ({
      onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        if (btnRef.current) {
          btnRef.current.classList.remove('pedal-metal');
          btnRef.current.classList.add('pedal-metal-active', 'translate-y-1');
        }
        onInputChange({ [key]: true });
      },
      onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
        e.preventDefault();
        if (btnRef.current) {
          btnRef.current.classList.add('pedal-metal');
          btnRef.current.classList.remove('pedal-metal-active', 'translate-y-1');
        }
        onInputChange({ [key]: false });
      },
      onPointerCancel: () => {
        if (btnRef.current) {
          btnRef.current.classList.add('pedal-metal');
          btnRef.current.classList.remove('pedal-metal-active', 'translate-y-1');
        }
        onInputChange({ [key]: false });
      },
    });

    return (
      <div className="touch-gameplay safe-screen-pad pointer-events-none absolute inset-0 z-10 flex flex-col justify-between">
        {/* TOP ROW: Left Elevation/Route Minimap | Right Compact Icon Toolbar */}
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left Hill Elevation Minimap (with START & SUMMIT markers) */}
          <div className="panel-bevel pointer-events-auto w-44 rounded-xl border border-white/15 p-2 sm:w-52">
            <div className="mb-1 flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
              <span className="truncate text-slate-200">{stage.name}</span>
              <span ref={timeRef} className="font-mono-num text-amber-300 tabular-nums">
                00:00.0
              </span>
            </div>

            <div className="relative overflow-hidden rounded-md border border-white/10 bg-slate-950/90">
              <svg viewBox={`0 0 ${minimapGeometry.w} ${minimapGeometry.h}`} className="block h-11 w-full">
                <path d={minimapGeometry.areaPath} fill="rgba(56, 189, 248, 0.14)" />
                <path
                  d={minimapGeometry.linePath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.6"
                />
                {/* Start Marker */}
                <circle
                  cx={minimapGeometry.coords[0].x}
                  cy={minimapGeometry.coords[0].y}
                  r="3"
                  fill="#34d399"
                />
                {/* Summit Finish Marker */}
                <rect
                  x={minimapGeometry.coords[minimapGeometry.coords.length - 1].x - 3}
                  y={minimapGeometry.coords[minimapGeometry.coords.length - 1].y - 6}
                  width="6"
                  height="6"
                  fill="#fbbf24"
                />
                {/* Ghost Dot */}
                <circle
                  ref={ghostMarkerRef}
                  cx="6"
                  cy="22"
                  r="2.8"
                  fill="#facc15"
                  style={{ display: 'none' }}
                />
                {/* AI Dot */}
                <circle
                  ref={aiMarkerRef}
                  cx="6"
                  cy="22"
                  r="3.2"
                  fill="#22d3ee"
                  style={{ display: 'none' }}
                />
                {/* Player Dot */}
                <circle
                  ref={playerMarkerRef}
                  cx={minimapGeometry.coords[0].x}
                  cy={minimapGeometry.coords[0].y}
                  r="3.8"
                  fill="#f97316"
                  stroke="#ffffff"
                  strokeWidth="1"
                />
              </svg>
              <div className="flex justify-between px-1 pb-0.5 text-[8px] font-bold tracking-widest uppercase">
                <span className="text-emerald-300">START</span>
                <span className="text-amber-300">SUMMIT</span>
              </div>
            </div>

            {/* Compact Minimap Footer: Distance / Fuel / Tire Health */}
            <div className="mt-1.5 flex items-center justify-between text-[10px] font-bold">
              <span ref={distRef} className="font-mono-num text-white tabular-nums">
                0/{stage.summitMeters}m
              </span>
              <span
                ref={rivalDeltaRef}
                style={{ display: 'none' }}
                className="font-mono-num tabular-nums"
              />
            </div>

            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[9px] font-bold">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">FUEL</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div ref={fuelFillRef} className="h-full bg-emerald-400" style={{ width: '100%' }} />
                </div>
                <span ref={fuelTextRef} className="font-mono-num text-slate-200 tabular-nums">
                  100%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-400">TIRE</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div ref={tireFillRef} className="h-full bg-sky-400" style={{ width: '100%' }} />
                </div>
                <span ref={tireTextRef} className="font-mono-num text-slate-200 tabular-nums">
                  100%
                </span>
              </div>
            </div>
          </div>

          {/* Top-Right Compact Clickable Icon Row (keeps hill completely unobstructed) */}
          <div className="flex flex-col items-end gap-2">
            <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1">
              <button
                type="button"
                onClick={onCycleCamera}
                aria-label="Cycle Camera Angle"
                title={`Camera: ${cameraMode.toUpperCase()}`}
                className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-400 hover:text-white"
              >
                <Camera className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={toggleXRay}
                aria-label="Toggle AI X-Ray Brain View"
                title="AI X-Ray Brain View"
                className={`panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  xRayOpen
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                    : 'border-white/15 text-slate-200 hover:border-cyan-400/70'
                }`}
              >
                <Activity className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleAiAutoPilot}
                aria-label="Toggle Autopilot"
                title="Autopilot (I)"
                className={`panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  aiAutoPilot || watchAiMode
                    ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200'
                    : 'border-white/15 text-slate-200 hover:border-cyan-400/70'
                }`}
              >
                <Cpu className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleGhost}
                aria-label="Toggle Ghost"
                title={showGhost ? 'Hide Ghost' : 'Show Ghost'}
                className={`panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  showGhost
                    ? 'border-amber-400/70 bg-amber-500/20 text-amber-200'
                    : 'border-white/15 text-slate-400 hover:text-white'
                }`}
              >
                <Ghost className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleGyro}
                aria-label="Toggle Tilt Steering"
                title={gyroEnabled ? 'Tilt Steering ON' : 'Tilt Steering OFF'}
                className={`panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border transition ${
                  gyroEnabled
                    ? 'border-emerald-400 bg-emerald-500/25 text-emerald-200'
                    : 'border-white/15 text-slate-300 hover:border-emerald-400/60'
                }`}
              >
                <Compass className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                title="Mute / Unmute (M)"
                className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white transition hover:border-white/40"
              >
                {muted ? (
                  <VolumeX className="h-4 w-4 text-rose-400" />
                ) : (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                )}
              </button>

              <button
                type="button"
                onClick={onOpenSettings}
                aria-label="Settings"
                title="Settings"
                className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-400/70"
              >
                <Settings className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onPause}
                aria-label="Pause"
                title="Pause (P)"
                className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-white transition hover:border-amber-400/70"
              >
                <Pause className="h-4 w-4 fill-current" />
              </button>

              <button
                type="button"
                onClick={onReturnToPaddock}
                aria-label="Return to Paddock"
                title="Return to Paddock"
                className="panel-bevel flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 text-slate-200 transition hover:border-amber-400/70"
              >
                <Home className="h-4 w-4" />
              </button>
            </div>

            {/* Optional AI X-Ray Brain View Panel */}
            {xRayOpen && (
              <div className="panel-bevel pointer-events-auto w-64 rounded-xl border border-cyan-400/45 p-2.5 text-white shadow-2xl sm:w-72">
                <div className="flex items-center justify-between text-[10px] font-bold tracking-wider uppercase">
                  <span className="text-cyan-300">AI X-RAY BRAIN · 12→24→16→3</span>
                  <span className="font-mono-num text-slate-300">
                    {telemetry ? `${Math.round(telemetry.nnAuthority * 100)}%` : '0%'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[10px] font-semibold text-slate-400">
                  {telemetry?.modeLabel ?? 'Waiting for climb frame...'}
                </div>

                <svg viewBox="0 0 220 96" className="mt-1.5 h-24 w-full rounded bg-slate-950/90 p-1">
                  {/* Inputs (12 nodes) */}
                  {(telemetry?.inputs ?? new Array(12).fill(0)).slice(0, 12).map((val, idx) => {
                    const y = 6 + idx * 7.6;
                    const mag = Math.min(1, Math.abs(val));
                    const fill = val >= 0 ? `rgba(56,189,248,${0.25 + mag * 0.75})` : `rgba(251,146,60,${0.25 + mag * 0.75})`;
                    return (
                      <g key={`in_${idx}`}>
                        <circle cx="14" cy={y} r={2.2 + mag * 1.1} fill={fill} />
                        <title>{NN_INPUT_LABELS[idx]}: {val.toFixed(2)}</title>
                      </g>
                    );
                  })}
                  {/* H1 (sample 12 of 24 for crisp SVG) */}
                  {(telemetry?.h1 ?? new Array(24).fill(0))
                    .filter((_, i) => i % 2 === 0)
                    .map((val, idx) => {
                      const y = 6 + idx * 7.6;
                      const mag = Math.min(1, Math.abs(val));
                      const fill = val >= 0 ? `rgba(52,211,153,${0.25 + mag * 0.75})` : `rgba(244,63,94,${0.25 + mag * 0.75})`;
                      return <circle key={`h1_${idx}`} cx="78" cy={y} r={2.3 + mag * 1.1} fill={fill} />;
                    })}
                  {/* H2 (sample 8 of 16) */}
                  {(telemetry?.h2 ?? new Array(16).fill(0))
                    .filter((_, i) => i % 2 === 0)
                    .map((val, idx) => {
                      const y = 12 + idx * 10.5;
                      const mag = Math.min(1, Math.abs(val));
                      const fill = val >= 0 ? `rgba(167,139,250,${0.25 + mag * 0.75})` : `rgba(251,191,36,${0.25 + mag * 0.75})`;
                      return <circle key={`h2_${idx}`} cx="142" cy={y} r={2.8 + mag * 1.2} fill={fill} />;
                    })}
                  {/* Outputs (3 nodes) */}
                  {[
                    telemetry?.outputs.steerPitch ?? 0,
                    telemetry?.outputs.throttle ?? 0,
                    telemetry?.outputs.brake ?? 0,
                  ].map((val, idx) => {
                    const y = 20 + idx * 28;
                    const mag = Math.min(1, Math.abs(val));
                    return (
                      <g key={`out_${idx}`}>
                        <circle
                          cx="202"
                          cy={y}
                          r={4.2 + mag * 1.6}
                          fill={idx === 2 ? '#fb7185' : idx === 1 ? '#34d399' : '#38bdf8'}
                          opacity={0.35 + mag * 0.65}
                        />
                        <text x="192" y={y + 3} textAnchor="end" fontSize="6.5" fill="#cbd5e1">
                          {NN_OUTPUT_LABELS[idx].split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-[10px] font-bold">
                  <div className="rounded bg-slate-900 px-1.5 py-1 text-center">
                    <div className="text-[8px] text-slate-400 uppercase">Steer</div>
                    <div className="font-mono-num text-sky-300 tabular-nums">
                      {(telemetry?.outputs.steerPitch ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded bg-slate-900 px-1.5 py-1 text-center">
                    <div className="text-[8px] text-slate-400 uppercase">Throttle</div>
                    <div className="font-mono-num text-emerald-300 tabular-nums">
                      {Math.round((telemetry?.outputs.throttle ?? 0) * 100)}%
                    </div>
                  </div>
                  <div className="rounded bg-slate-900 px-1.5 py-1 text-center">
                    <div className="text-[8px] text-slate-400 uppercase">Brake</div>
                    <div className="font-mono-num text-rose-300 tabular-nums">
                      {Math.round((telemetry?.outputs.brake ?? 0) * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center Stunt Callout (Unobstructed Terrain Center) */}
        <div className="flex flex-col items-center justify-center gap-1">
          {watchAiMode && (
            <div className="rounded-md border border-cyan-400/60 bg-slate-950/85 px-3 py-0.5 text-[10px] font-extrabold tracking-widest text-cyan-200 uppercase">
              Watching AI Climb · Live Neural Telemetry
            </div>
          )}
          <div
            ref={calloutBoxRef}
            className="flex flex-col items-center text-center transition-opacity duration-150"
            style={{ opacity: 0 }}
          >
            <div
              ref={calloutTitleRef}
              className="font-display text-3xl leading-none font-extrabold tracking-wide text-amber-300 uppercase italic drop-shadow-[0_4px_0_rgba(15,23,42,0.95)]"
            >
              CLIMB!
            </div>
            <div
              ref={calloutBonusRef}
              className="font-mono-num text-xs font-black tracking-wider text-emerald-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
            >
              +50 COINS
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Driving Pedals / Controls & Compact Speed/Gear Bar */}
        <div className="flex items-end justify-between gap-2">
          <div className={`pointer-events-auto flex items-end gap-1.5 ${showTouchControls ? 'flex' : 'hidden'}`}>
            <button
              ref={brakeBtnRef}
              type="button"
              {...bindPedal('brake', brakeBtnRef)}
              aria-label="Brake"
              className="pedal-metal compact-hud-pedal flex h-20 w-16 shrink-0 flex-col items-center justify-end rounded-xl border-2 border-slate-500 pb-2 shadow-[0_6px_0_#334155,0_12px_20px_rgba(0,0,0,0.55)] transition-transform sm:h-24 sm:w-20"
            >
              <span className="font-display rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-white italic">
                BRAKE
              </span>
            </button>
            <button
              ref={lowRangeBtnRef}
              type="button"
              style={{ display: 'none' }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                onInputChange({ lowRange: true });
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                onInputChange({ lowRange: false });
              }}
              onPointerCancel={() => onInputChange({ lowRange: false })}
              aria-label="4WD Low Range"
              className="touch-gameplay panel-bevel flex min-h-[44px] w-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-400/60 text-amber-200 transition active:scale-95 sm:h-18 sm:w-16"
            >
              <Gauge className="h-4 w-4 text-amber-300" />
              <span className="font-display text-[9px] font-extrabold tracking-widest italic">4WD L</span>
            </button>
          </div>

          {/* Minimal Bottom-Center Telemetry Pill-Free Bar */}
          <div className="mx-auto flex flex-col items-center gap-1">
            <div className="panel-bevel flex items-center gap-3 rounded-xl border border-white/15 px-4 py-1.5">
              <div className="flex items-baseline gap-1">
                <span ref={speedRef} className="font-mono-num text-2xl font-black text-white tabular-nums">
                  0
                </span>
                <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  km/h
                </span>
              </div>
              <span className="text-slate-600">·</span>
              <span ref={gearRef} className="font-mono-num text-sm font-black text-amber-400 tabular-nums">
                G1
              </span>
              <span className="text-slate-600">·</span>
              <span ref={slopeRef} className="font-mono-num text-xs font-bold text-slate-300 tabular-nums">
                +0°
              </span>
            </div>

            {showHints && (
              <div className="hidden items-center gap-2 text-[10px] font-semibold text-slate-300/80 md:flex drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                <span>A/D or ←/→ Drive · Shift Nitro · Space Brake · L 4WD Low · I Auto · P Pause</span>
                {gamepadActive && (
                  <span className="inline-flex items-center gap-1 text-violet-300">
                    <Gamepad2 className="h-3 w-3" />
                    PAD
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Gas / Nitro / Jump Pedals */}
          <div className={`pointer-events-auto shrink-0 items-end gap-1.5 ${showTouchControls ? 'flex' : 'hidden'}`}>
            <button
              ref={jumpBtnRef}
              type="button"
              style={{ display: 'none' }}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                onInputChange({ jump: true });
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                onInputChange({ jump: false });
              }}
              onPointerCancel={() => onInputChange({ jump: false })}
              aria-label="Jump Shocks"
              className="touch-gameplay panel-bevel flex min-h-[44px] w-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-400/70 text-amber-300 transition active:scale-95 sm:h-18 sm:w-16"
            >
              <ArrowUp className="h-4 w-4 text-amber-300" />
              <span className="font-display text-[9px] font-extrabold tracking-widest italic">
                JUMP
              </span>
            </button>

            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                onInputChange({ nitro: true, gas: true });
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                onInputChange({ nitro: false, gas: false });
              }}
              onPointerCancel={() => onInputChange({ nitro: false, gas: false })}
              aria-label="Nitro Boost"
              className="touch-gameplay panel-bevel compact-hud-nitro flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-xl border border-sky-400/60 text-sky-300 transition active:scale-95 sm:h-18 sm:w-16"
            >
              <Flame className="h-4 w-4 text-sky-400" />
              <span className="font-display text-[9px] font-extrabold tracking-widest italic">
                NITRO
              </span>
              <div className="h-1 w-9 overflow-hidden rounded-full bg-slate-800">
                <div ref={nitroFillRef} className="h-full bg-sky-400" style={{ width: '100%' }} />
              </div>
            </button>

            <button
              ref={gasBtnRef}
              type="button"
              {...bindPedal('gas', gasBtnRef)}
              aria-label="Gas"
              className="pedal-metal compact-hud-pedal flex h-20 w-16 flex-col items-center justify-end rounded-xl border-2 border-slate-500 pb-2 shadow-[0_6px_0_#334155,0_12px_20px_rgba(0,0,0,0.55)] transition-transform sm:h-24 sm:w-20"
            >
              <span className="font-display rounded bg-slate-900/90 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-white italic">
                GAS
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  },
);

GameplayHud.displayName = 'GameplayHud';
