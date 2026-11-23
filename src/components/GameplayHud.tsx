import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Flame, Pause, Volume2, VolumeX } from 'lucide-react';
import { HudLiveSnapshot, InputState } from '../types/game';
import { CoinIcon, FuelCanIcon, GemIcon } from './GameIcons';

export interface GameplayHudHandle {
  updateLive: (snap: HudLiveSnapshot) => void;
}

interface GameplayHudProps {
  muted: boolean;
  stageName: string;
  onInputChange: (partial: Partial<InputState>) => void;
  onPause: () => void;
  onToggleMute: () => void;
}

export const GameplayHud = forwardRef<GameplayHudHandle, GameplayHudProps>(
  ({ muted, stageName, onInputChange, onPause, onToggleMute }, ref) => {
    const distRef = useRef<HTMLSpanElement>(null);
    const bestRef = useRef<HTMLSpanElement>(null);
    const fuelFillRef = useRef<HTMLDivElement>(null);
    const fuelTextRef = useRef<HTMLSpanElement>(null);
    const fuelBoxRef = useRef<HTMLDivElement>(null);
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
        if (fuelBoxRef.current) {
          fuelBoxRef.current.style.borderColor =
            clampedFuel <= 22
              ? 'rgba(239, 68, 68, 0.9)'
              : 'rgba(255, 255, 255, 0.16)';
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
            calloutBoxRef.current.style.transform = 'translateY(0px) scale(1)';
            calloutTitleRef.current.textContent = snap.callout.title;
            calloutBonusRef.current.textContent = `+${snap.callout.bonusCoins} COINS`;
          } else {
            calloutBoxRef.current.style.opacity = '0';
            calloutBoxRef.current.style.transform = 'translateY(-8px) scale(0.95)';
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
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
        {/* Top Row: Currency | Distance & Fuel | Pause */}
        <div className="flex items-start justify-between gap-2">
          {/* Top-Left Currencies */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1 shadow">
              <CoinIcon className="h-5 w-5" />
              <span
                ref={runCoinsRef}
                className="font-mono-num text-sm font-extrabold text-white sm:text-base"
              >
                0
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/80 px-2.5 py-1 shadow">
              <GemIcon className="h-4 w-4" />
              <span
                ref={gemsRef}
                className="font-mono-num text-xs font-bold text-sky-200 sm:text-sm"
              >
                0
              </span>
            </div>
          </div>

          {/* Top-Center Distance + Compact Fuel Bar */}
          <div className="flex flex-col items-center">
            <span
              ref={distRef}
              className="font-display text-3xl leading-none font-black tracking-wide text-white drop-shadow-[0_3px_6px_rgba(0,0,0,0.75)] sm:text-4xl"
            >
              0m
            </span>
            <div className="mt-1 flex items-center gap-2 text-[10px] font-bold tracking-widest text-slate-200 uppercase drop-shadow">
              <span>{stageName}</span>
              <span>·</span>
              <span ref={bestRef} className="font-mono-num text-amber-300">
                BEST 0m
              </span>
            </div>

            <div
              ref={fuelBoxRef}
              className="mt-1.5 flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/85 px-2.5 py-1 shadow-lg"
            >
              <FuelCanIcon className="h-4 w-4 shrink-0" />
              <div className="h-2.5 w-28 overflow-hidden rounded-full bg-slate-800 sm:w-36">
                <div
                  ref={fuelFillRef}
                  className="h-full rounded-full transition-none"
                  style={{ width: '100%', background: '#22c55e' }}
                />
              </div>
              <span
                ref={fuelTextRef}
                className="font-mono-num min-w-[44px] text-right text-[11px] font-bold text-white"
              >
                100%
              </span>
            </div>
          </div>

          {/* Top-Right Pause & Mute */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-slate-950/85 text-white shadow-lg transition hover:border-white/40"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
            </button>
            <button
              type="button"
              onClick={onPause}
              aria-label="Pause Game"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-slate-950/85 text-white shadow-lg transition hover:border-amber-400/70"
            >
              <Pause className="h-5 w-5 fill-current" />
            </button>
          </div>
        </div>

        {/* Center Stunt Callout Banner (zero layout shift) */}
        <div className="flex justify-center">
          <div
            ref={calloutBoxRef}
            className="flex flex-col items-center rounded-xl border border-amber-300/60 bg-slate-950/88 px-5 py-2 text-center shadow-2xl transition-opacity duration-150"
            style={{ opacity: 0 }}
          >
            <div
              ref={calloutTitleRef}
              className="font-display text-xl font-black tracking-wider text-yellow-300 uppercase sm:text-2xl"
            >
              BACKFLIP!
            </div>
            <div
              ref={calloutBonusRef}
              className="font-mono-num text-xs font-extrabold text-emerald-300"
            >
              +150 COINS
            </div>
          </div>
        </div>

        {/* Bottom Row: Brake Pedal | 3-Gauge Cluster | Nitro + Gas Pedal */}
        <div className="flex items-end justify-between gap-2">
          {/* Left Brake Pedal */}
          <button
            ref={brakeBtnRef}
            type="button"
            {...bindPedal('brake', brakeBtnRef)}
            aria-label="Brake"
            className="pedal-metal pointer-events-auto flex h-24 w-20 flex-col items-center justify-end rounded-xl border-2 border-slate-500 pb-2 shadow-[0_8px_0_#334155,0_14px_24px_rgba(0,0,0,0.55)] transition-transform sm:h-28 sm:w-24"
          >
            <span className="font-display rounded bg-slate-900/85 px-2 py-0.5 text-[11px] font-extrabold tracking-widest text-white">
              BRAKE
            </span>
          </button>

          {/* Center 3-Dial Motorsport Instrument Cluster */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-end gap-1.5 sm:gap-3">
              {/* RPM Gauge */}
              <div className="relative h-20 w-20 rounded-full border-2 border-slate-500 bg-slate-950/92 p-1 shadow-xl sm:h-24 sm:w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="6"
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
                    strokeWidth="6"
                    strokeDasharray="48 276"
                    strokeDashoffset="-146"
                    transform="rotate(142 50 50)"
                  />
                  <g
                    ref={rpmNeedleRef}
                    style={{
                      transformOrigin: '50px 50px',
                      transform: 'rotate(-100deg)',
                    }}
                  >
                    <line
                      x1="50"
                      y1="54"
                      x2="50"
                      y2="16"
                      stroke="#f97316"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <circle cx="50" cy="50" r="5.5" fill="#cbd5e1" />
                  </g>
                </svg>
                <span className="font-display absolute inset-x-0 bottom-2 text-center text-[10px] font-bold tracking-wider text-slate-300">
                  RPM
                </span>
              </div>

              {/* Center KM/H + Gear + Mini Fuel Gauge */}
              <div className="relative flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-slate-400 bg-slate-950/95 shadow-2xl sm:h-28 sm:w-28">
                <span
                  ref={gearRef}
                  className="font-mono-num text-[10px] font-bold tracking-widest text-amber-400"
                >
                  G1
                </span>
                <span
                  ref={speedRef}
                  className="font-mono-num text-3xl leading-none font-black text-white sm:text-4xl"
                >
                  0
                </span>
                <span className="font-display text-[10px] font-bold tracking-widest text-slate-400">
                  KM/H
                </span>
                <div className="mt-1.5 flex items-center gap-1">
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

              {/* Boost Pressure Gauge */}
              <div className="relative h-20 w-20 rounded-full border-2 border-slate-500 bg-slate-950/92 p-1 shadow-xl sm:h-24 sm:w-24">
                <svg viewBox="0 0 100 100" className="h-full w-full">
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="6"
                    strokeDasharray="195 276"
                    transform="rotate(142 50 50)"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="6"
                    strokeDasharray="70 276"
                    strokeDashoffset="-124"
                    transform="rotate(142 50 50)"
                  />
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
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    <circle cx="50" cy="50" r="5.5" fill="#cbd5e1" />
                  </g>
                </svg>
                <span className="font-display absolute inset-x-0 bottom-2 text-center text-[10px] font-bold tracking-wider text-sky-300">
                  BOOST
                </span>
              </div>
            </div>

            <div className="hidden rounded-md bg-slate-950/70 px-2.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-300 sm:block">
              A/D or ←/→ Drive · Shift Nitro · Space Handbrake · P Pause
            </div>
          </div>

          {/* Right Gas + Nitro Controls */}
          <div className="pointer-events-auto flex items-end gap-2">
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
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-xl border border-sky-400/60 bg-slate-950/90 text-sky-300 shadow-xl transition hover:border-sky-300 active:scale-95 sm:h-20 sm:w-20"
            >
              <Flame className="h-5 w-5 text-sky-400" />
              <span className="font-display text-[10px] font-extrabold tracking-widest">
                NITRO
              </span>
              <div className="h-1.5 w-11 overflow-hidden rounded-full bg-slate-800">
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
              className="pedal-metal flex h-24 w-20 flex-col items-center justify-end rounded-xl border-2 border-slate-500 pb-2 shadow-[0_8px_0_#334155,0_14px_24px_rgba(0,0,0,0.55)] transition-transform sm:h-28 sm:w-24"
            >
              <span className="font-display rounded bg-slate-900/85 px-2.5 py-0.5 text-[11px] font-extrabold tracking-widest text-white">
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
