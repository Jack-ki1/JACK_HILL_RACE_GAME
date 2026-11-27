import React from 'react';
import { Flame, Fuel, RotateCw, Wrench, X } from 'lucide-react';

interface FirstRunTutorialOverlayProps {
  onDismiss: () => void;
}

export const FirstRunTutorialOverlay: React.FC<FirstRunTutorialOverlayProps> = ({
  onDismiss,
}) => (
  <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-4 text-white">
    <div className="panel-bevel w-full max-w-2xl rounded-2xl border border-amber-400/45 p-5 shadow-2xl sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-extrabold tracking-widest text-amber-300 uppercase">
            DRIVER BRIEFING
          </span>
          <h2 className="mt-1 font-display text-2xl font-black tracking-wider uppercase italic sm:text-3xl">
            WELCOME TO JACK HILL CRAWL
          </h2>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Skip Briefing"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#111923] text-slate-300 hover:border-white/40 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#111923] p-3.5">
          <RotateCw className="h-6 w-6 text-amber-300" />
          <h3 className="mt-2 font-display text-base font-extrabold uppercase italic">
            1. BALANCE IN AIR
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Hold <strong className="text-white">GAS (D / →)</strong> to pitch back, and{' '}
            <strong className="text-white">BRAKE (A / ←)</strong> to nose down. Land flat on your tires to stick flips and earn bonus coins!
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111923] p-3.5">
          <Fuel className="h-6 w-6 text-rose-400" />
          <h3 className="mt-2 font-display text-base font-extrabold uppercase italic">
            2. WATCH FUEL & NITRO
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Track the next red Jerrycan marker on your fuel gauge. Tap{' '}
            <strong className="text-white">NITRO (Shift)</strong> on steep climbs or jumps to launch across gorges.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#111923] p-3.5">
          <Wrench className="h-6 w-6 text-sky-300" />
          <h3 className="mt-2 font-display text-base font-extrabold uppercase italic">
            3. UPGRADE & UNLOCK
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Customize <strong className="text-white">Neon Underglow, Liveries &amp; Upgrades</strong> in the Garage, unlock the <strong className="text-white">Cheetah VC &amp; Leonida Donk</strong>, and conquer all 5 biomes!
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Flame className="h-4 w-4 text-sky-300" />
          <span>Replay anytime inside Settings.</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-xl bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] px-7 py-2.5 font-display text-sm font-black tracking-wider text-slate-950 uppercase shadow-lg hover:brightness-105"
        >
          START DRIVING
        </button>
      </div>
    </div>
  </div>
);
