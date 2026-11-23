import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Flame, Gamepad2, Pause, Volume2, VolumeX } from 'lucide-react';
import { HudLiveSnapshot, InputState } from '../types/game';
import { CoinIcon, FuelCanIcon, GemIcon } from './GameIcons';

export interface GameplayHudHandle {
  updateLive: (snap: HudLiveSnapshot) => void;
}

interface GameplayHudProps {
  muted: boolean;
  stageName: string;
  showHints: boolean;
  gamepadActive: boolean;
  onInputChange: (partial: Partial<InputState>) => void;
  onPause: () => void;
  onToggleMute: () => void;
}

// Precomputed radial tick marks (-125deg to +125deg around 50,50)
const DIAL_TICKS = Array.from({ length: 9 }, (_, idx) => {
  const frac = idx / 8;
  const deg = -125 + frac * 250;
  const rad = ((deg - 90) * Math.PI) / 180;
  const rOuter = 43;
  const rInner = idx % 2 === 0 ? 35 : 38;
  const rLabel = 28;
  return {
    idx,
    x1: 50 + Math.cos(rad) * rInner,
    y1: 50 + Math.sin(rad) * rInner,
    x2: 50 + Math.cos(rad) * rOuter,
    y2: 50 + Math.sin(rad) * rOuter,
    lx: 50 + Math.cos(rad) * rLabel,
    ly: 50 + Math.sin(rad) * rLabel,
    isRedline: idx >= 7,
    isMajor: idx % 2 === 0,
  };
});

export const GameplayHud = forwardRef<GameplayHudHandle, GameplayHudProps>(
  ({ muted, stageName, showHints, gamepadActive, onInputChange, onPause, onToggleMute }, ref) => {
    const distRef = useRef<HTMLSpanElement>(null);
    const bestRef = useRef<HTMLSpanElement>(null);
    const rivalDeltaRef = useRef<HTMLSpanElement>(null);
    const fuelFillRef = useRef<HTMLDivElement>(null);
    const fuelTextRef = useRef<HTMLSpanElement>(null);
    const nextFuelRef = useRef<HTMLSpanElement>(null);
    const fuelBoxRef = useRef<HTMLDivElement>(null);
    const hazardRef = useRef<HTMLDivElement>(null);
    const runCoinsRef = useRef<HTMLSpanElement>(null);
    const gemsRef = useRef<HTMLSpanElement>(null);

    const speedRef = useRef<HTMLSpanElement>(null);
    const gearRef = useRef<HTMLSpanElement>(null);
    const rpmNeedleRef = useRef<SVGGElement>(null);
    const boostNeedleRef = useRef<SVGGElement>(null);
    const nitroFillRef = useRef<HTMLDivElement>(null);
    const gaugeFuelRef = useRef<HTMLDivElement>(null);

    const calloutBoxRef = useRef<HTMLDivElement>(null);
    const calloutTitleRef = useRef<HTMLDivElement>(null);
    const calloutBonusRef = useRef<HTMLDivElement>(null);

    const brakeBtnRef = useRef<HTMLButtonElement>(null);
    const gasBtnRef = useRef<HTMLButtonElement>(null);
    const nitroBtnRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(ref, () => ({
      updateLive(snap: HudLiveSnapshot) {
        if (distRef.current) {
          distRef.current.textContent = `${snap.distanceMeters}m`;
        }
        if (bestRef.current) {
          bestRef.current.textContent = `BEST ${snap.bestMeters}m`;
        }

        if (rivalDeltaRef.current) {
          if (snap.ghostDeltaMeters !== null) {
            const rounded = Math.round(snap.ghostDeltaMeters);
            const ahead = rounded >= 0;
            rivalDeltaRef.current.style.display = 'inline-flex';
            rivalDeltaRef.current.textContent = ahead
              ? `RIVAL +${rounded}m`
              : `RIVAL ${rounded}m`;
            rivalDeltaRef.current.className = ahead
              ? 'font-mono-num inline-flex items-center rounded border border-emerald-400/50 bg-emerald-950/90 px-2 py-0.5 text-[10px] font-extrabold text-emerald-300'
              : 'font-mono-num inline-flex items-center rounded border border-amber-400/50 bg-amber-950/90 px-2 py-0.5 text-[10px] font-extrabold text-amber-300';
          } else {
            rivalDeltaRef.current.style.display = 'none';
          }
        }

        if (runCoinsRef.current) {
          runCoinsRef.current.textContent = (
            snap.totalCoins + snap.runCoins
          ).toLocaleString();
        }
        if (gemsRef.current) {
          gemsRef.current.textContent = snap.gems.toLocaleString();
        }

        const clampedFuel = Math.max(0, Math.min(100, snap.fuelPct));
        if (fuelFillRef.current) {
          fuelFillRef.current.style.width = `${clampedFuel}%`;
          fuelFillRef.current.style.background =
            clampedFuel <= 22
              ? 'linear-gradient(90deg, #ef4444, #f97316)'
              : clampedFuel <= 45
                ? 'linear-gradient(90deg, #f59e0b, #facc15)'
                : 'linear-gradient(90deg, #22c55e, #84cc16)';
        }
        if (gaugeFuelRef.current) {
          gaugeFuelRef.current.style.width = `${clampedFuel}%`;
        }
        if (fuelTextRef.current) {
          fuelTextRef.current.textContent =
            clampedFuel <= 22 ? 'LOW FUEL!' : `${Math.round(clampedFuel)}%`;
        }
        if (nextFuelRef.current) {
          nextFuelRef.current.textContent =
            snap.nextFuelMeters !== null ? `FUEL IN ${snap.nextFuelMeters}m` : 'FUEL --';
          nextFuelRef.current.style.color =
            clampedFuel <= 28 ? '#fca5a5' : '#94a3b8';
        }
        if (fuelBoxRef.current) {
          fuelBoxRef.current.style.borderColor =
            clampedFuel <= 22
              ? 'rgba(239, 68, 68, 0.9)'
              : 'rgba(255, 255, 255, 0.16)';
        }

        if (hazardRef.current) {
          if (snap.inTunnel) {
            hazardRef.current.style.display = 'inline-flex';
            hazardRef.current.textContent = 'CAVE TUNNEL';
            hazardRef.current.className =
              'font-display inline-flex items-center rounded border border-amber-400/60 bg-amber-950/90 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-amber-300 uppercase italic';
          } else {
            hazardRef.current.style.display = 'none';
          }
        }

        if (speedRef.current) {
          speedRef.current.textContent = String(snap.speedKmh);
        }
        if (gearRef.current) {
          gearRef.current.textContent = `G${snap.gear}`;
        }

        // Sweep needle angles (-125deg min to +125deg max)
        if (rpmNeedleRef.current) {
          const deg = -125 + Math.max(0, Math.min(1, snap.rpmNorm)) * 250;
          rpmNeedleRef.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
        }
        if (boostNeedleRef.current) {
          const deg = -125 + Math.max(0, Math.min(1, snap.boostNorm)) * 250;
          boostNeedleRef.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
        }
        if (nitroFillRef.current) {
          nitroFillRef.current.style.width = `${Math.round(snap.nitroEnergy)}%`;
        }

        if (calloutBoxRef.current && calloutTitleRef.current && calloutBonusRef.current) {
          if (snap.callout && snap.callout.remainingSec > 0) {
            calloutBoxRef.current.style.opacity = String(
              Math.min(1, snap.callout.remainingSec * 1.4),
            );
            calloutBoxRef.current.style.transform = 'translateY(0px) scale(1) skewX(-8deg)';
            calloutTitleRef.current.textContent = snap.callout.title;
            calloutBonusRef.current.textContent =
              snap.callout.bonusCoins > 0
                ? `+${snap.callout.bonusCoins} COINS`
                : 'TANK FULL';
          } else {
            calloutBoxRef.current.style.opacity = '0';
            calloutBoxRef.current.style.transform =
              'translateY(-10px) scale(0.92) skewX(-8deg)';
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
        {/* Top Row: Left Fuel + Currencies | Center Distance + Stage + Rival | Right Mute + Pause */}
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left Fuel Gauge & Currencies */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <div
              ref={fuelBoxRef}
              className="panel-bevel flex items-center gap-2 rounded-xl border border-white/15 px-2.5 py-1.5 sm:px-3"
            >
              <FuelCanIcon className="h-4 w-4 shrink-0" />
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-1.5">
                  <div className="h-2.5 w-16 overflow-hidden rounded-sm bg-slate-800 sm:w-28">
                    <div
                      ref={fuelFillRef}
                      className="h-full transition-none"
                      style={{ width: '100%', background: '#22c55e' }}
                    />
                  </div>
                  <span
                    ref={fuelTextRef}
                    className="font-mono-num min-w-[36px] text-right text-[10px] font-bold text-white sm:text-[11px]"
                  >
                    100%
                  </span>
                </div>
                <span
                  ref={nextFuelRef}
                  className="font-mono-num mt-0.5 text-[9px] font-bold tracking-wider text-slate-400 sm:text-[10px]"
                >
                  FUEL IN --m
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="panel-bevel flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 sm:gap-1.5 sm:px-2.5">
                <CoinIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span
                  ref={runCoinsRef}
                  className="font-mono-num text-xs font-extrabold text-white sm:text-sm"
                >
                  0
                </span>
              </div>
              <div className="panel-bevel flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 sm:gap-1.5 sm:px-2.5">
                <GemIcon className="h-3.5 w-3.5" />
                <span
                  ref={gemsRef}
                  className="font-mono-num text-xs font-bold text-sky-200 sm:text-sm"
                >
                  0
                </span>
              </div>
            </div>
          </div>

          {/* Top-Center Distance, Stage & Rival Delta */}
          <div className="flex flex-col items-center gap-1 text-center">
            <div className="panel-bevel rounded-xl border border-white/15 px-3 py-1.5 sm:px-5">
              <span
                ref={distRef}
                className="font-display block text-2xl leading-none font-extrabold tracking-wide text-white italic sm:text-3xl"
              >
                0m
              </span>
              <div className="mt-0.5 flex items-center justify-center gap-1.5 text-[9px] font-bold tracking-widest text-slate-300 uppercase sm:text-[10px]">
                <span className="max-w-[90px] truncate sm:max-w-none">{stageName}</span>
                <span>·</span>
                <span ref={bestRef} className="font-mono-num text-amber-300 whitespace-nowrap">
                  BEST 0m
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span ref={rivalDeltaRef} style={{ display: 'none' }} />
              <div
                ref={hazardRef}
                style={{ display: 'none' }}
                className="font-display"
              >
                CAVE TUNNEL
              </div>
            </div>
          </div>

          {/* Top-Right Touch-Friendly Mute & Pause */}
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="panel-bevel flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-white transition hover:border-white/40"
            >
              {muted ? (
                <VolumeX className="h-5 w-5 text-rose-400" />
              ) : (
                <Volume2 className="h-5 w-5 text-emerald-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause Game"
              className="panel-bevel flex h-11 w-11 items-center justify-center rounded-xl border border-white/20 text-white transition hover:border-amber-400/70"
            >
              <Pause className="h-5 w-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Center Floating Angled Italic Arcade Stunt Callout (no bulky box) */}
        <div className="flex justify-center">
          <div
            ref={calloutBoxRef}
            className="flex flex-col items-center text-center transition-opacity duration-150"
            style={{ opacity: 0, transform: 'skewX(-8deg)' }}
          >
            <div
              ref={calloutTitleRef}
              className="font-display text-3xl leading-none font-extrabold tracking-wide text-amber-300 uppercase italic drop-shadow-[0_4px_0_rgba(15,23,42,0.95)] sm:text-4xl"
            >
              BACKFLIP!
            </div>
            <div
              ref={calloutBonusRef}
              className="font-mono-num mt-0.5 text-sm font-black tracking-wider text-emerald-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]"
            >
              +150 COINS
            </div>
          </div>
        </div>

        {/* Bottom Row: Brake Pedal | 3-Dial Motorsport Cluster | Nitro + Gas Pedal */}
        <div className="flex items-end justify-between gap-1.5 sm:gap-3">
          {/* Left Brake Pedal */}
          <button
            ref={brakeBtnRef}
            type="button"
            {...bindPedal('brake', brakeBtnRef)}
            aria-label="Brake"
            className="pedal-metal compact-hud-pedal pointer-events-auto flex h-20 w-16 shrink-0 flex-col items-center justify-end rounded-xl border-2 border-slate-500 pb-2 shadow-[0_6px_0_#334155,0_12px_20px_rgba(0,0,0,0.55)] transition-transform sm:h-28 sm:w-24 sm:shadow-[0_8px_0_#334155,0_14px_24px_rgba(0,0,0,0.55)]"
          >
            <span className="font-display rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-extrabold tracking-widest text-white italic sm:px-2 sm:text-xs">
              BRAKE
            </span>
          </button>

          {/* Center 3-Dial Motorsport Instrument Cluster */}
          <div className="flex min-w-0 flex-col items-center gap-1">
            <div className="flex items-end gap-1 sm:gap-3">
              {/* RPM Gauge with radial tick marks */}
              <div className="hud-dial compact-hud-dial-sm relative h-14 w-14 shrink-0 rounded-full border-2 border-slate-500 p-0.5 sm:h-24 sm:w-24 sm:p-1">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="5"
                    strokeDasharray="195 276"
                    strokeDashoffset="-40"
                    transform="rotate(142 50 50)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="5"
                    strokeDasharray="48 276"
                    strokeDashoffset="-146"
                    transform="rotate(142 50 50)"
                  />
                  {DIAL_TICKS.map((t) => (
                    <g key={t.idx}>
                      <line
                        x1={t.x1}
                        y1={t.y1}
                        x2={t.x2}
                        y2={t.y2}
                        stroke={t.isRedline ? '#f87171' : '#94a3b8'}
                        strokeWidth={t.isMajor ? '2' : '1.2'}
                        strokeLinecap="round"
                      />
                      {t.isMajor && (
                        <text
                          x={t.lx}
                          y={t.ly + 2.5}
                          textAnchor="middle"
                          fontSize="7.5"
                          fontWeight="800"
                          fill={t.isRedline ? '#fca5a5' : '#cbd5e1'}
                        >
                          {t.idx}
                        </text>
                      )}
                    </g>
                  ))}
                  <g
                    ref={rpmNeedleRef}
                    style={{
                      transformOrigin: '50px 50px',
                      transform: 'rotate(-125deg)',
                    }}
                  >
                    <line
                      x1="50"
                      y1="54"
                      x2="50"
                      y2="16"
                      stroke="#f97316"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />
                    <circle cx="50" cy="50" r="5" fill="#e2e8f0" />
                  </g>
                </svg>
                <span className="font-display absolute inset-x-0 bottom-1 text-center text-[8px] font-extrabold tracking-widest text-slate-300 italic sm:bottom-2 sm:text-[10px]">
                  RPM
                </span>
              </div>

              {/* Center KM/H + Gear + Mini Fuel Gauge */}
              <div className="hud-dial compact-hud-dial-lg relative flex h-17 w-17 shrink-0 flex-col items-center justify-center rounded-full border-2 border-slate-400 sm:h-28 sm:w-28">
                <span
                  ref={gearRef}
                  className="font-mono-num text-[9px] font-extrabold tracking-widest text-amber-400 sm:text-[10px]"
                >
                  G1
                </span>
                <span
                  ref={speedRef}
                  className="font-mono-num compact-hud-speed text-xl leading-none font-black text-white sm:text-4xl"
                >
                  0
                </span>
                <span className="font-display text-[8px] font-bold tracking-widest text-slate-400 italic sm:text-[10px]">
                  KM/H
                </span>
                <div className="mt-0.5 hidden items-center gap-1 sm:mt-1.5 sm:flex">
                  <span className="text-[8px] font-bold text-rose-400">E</span>
                  <div className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-800">
                    <div
                      ref={gaugeFuelRef}
                      className="h-full bg-emerald-400"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <span className="text-[8px] font-bold text-emerald-400">F</span>
                </div>
              </div>

              {/* Boost Pressure Gauge with radial tick marks */}
              <div className="hud-dial compact-hud-dial-sm relative h-14 w-14 shrink-0 rounded-full border-2 border-slate-500 p-0.5 sm:h-24 sm:w-24 sm:p-1">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="5"
                    strokeDasharray="195 276"
                    transform="rotate(142 50 50)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="5"
                    strokeDasharray="70 276"
                    strokeDashoffset="-124"
                    transform="rotate(142 50 50)"
                  />
                  {DIAL_TICKS.map((t) => (
                    <line
                      key={t.idx}
                      x1={t.x1}
                      y1={t.y1}
                      x2={t.x2}
                      y2={t.y2}
                      stroke={t.idx >= 6 ? '#38bdf8' : '#64748b'}
                      strokeWidth={t.isMajor ? '2' : '1.2'}
                      strokeLinecap="round"
                    />
                  ))}
                  <g
                    ref={boostNeedleRef}
                    style={{
                      transformOrigin: '50px 50px',
                      transform: 'rotate(-125deg)',
                    }}
                  >
                    <line
                      x1="50"
                      y1="54"
                      x2="50"
                      y2="16"
                      stroke="#38bdf8"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                    />
                    <circle cx="50" cy="50" r="5" fill="#e2e8f0" />
                  </g>
                </svg>
                <span className="font-display absolute inset-x-0 bottom-1 text-center text-[8px] font-extrabold tracking-widest text-sky-300 italic sm:bottom-2 sm:text-[10px]">
                  BOOST
                </span>
              </div>
            </div>

            {showHints && (
              <div className="panel-bevel hidden items-center gap-2 rounded-md border border-white/10 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-300 md:flex">
                <span>A/D or ←/→ Drive · Shift Nitro · Space Handbrake · P Pause</span>
                {gamepadActive && (
                  <span className="inline-flex items-center gap-1 rounded bg-violet-500/25 px-1.5 py-0.2 text-violet-200">
                    <Gamepad2 className="h-3 w-3" />
                    PAD
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right Gas + Nitro Controls (stacked cleanly on mobile portrait, side-by-side on wider viewports) */}
          <div className="pointer-events-auto flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:items-end sm:gap-2">
            <button
              ref={nitroBtnRef}
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
              className="touch-gameplay panel-bevel compact-hud-nitro flex h-13 w-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-sky-400/60 text-sky-300 transition hover:border-sky-300 active:scale-95 sm:h-20 sm:w-20 sm:gap-1"
            >
              <Flame className="h-4 w-4 text-sky-400 sm:h-5 sm:w-5" />
              <span className="font-display text-[9px] font-extrabold tracking-widest italic sm:text-[10px]">
                NITRO
              </span>
              <div className="h-1 w-10 overflow-hidden rounded-full bg-slate-800 sm:h-1.5 sm:w-11">
                <div
                  ref={nitroFillRef}
                  className="h-full bg-sky-400"
                  style={{ width: '100%' }}
                />
              </div>
            </button>

            <button
              ref={gasBtnRef}
              type="button"
              {...bindPedal('gas', gasBtnRef)}
              aria-label="Gas"
              className="pedal-metal compact-hud-pedal flex h-20 w-16 flex-col items-center justify-end rounded-xl border-2 border-slate-500 pb-2 shadow-[0_6px_0_#334155,0_12px_20px_rgba(0,0,0,0.55)] transition-transform sm:h-28 sm:w-24 sm:shadow-[0_8px_0_#334155,0_14px_24px_rgba(0,0,0,0.55)]"
            >
              <span className="font-display rounded bg-slate-900/90 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-white italic sm:px-2.5 sm:text-xs">
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
