import React, { useState } from 'react';
import {
  ArrowLeft,
  Gamepad2,
  HelpCircle,
  Keyboard,
  Maximize2,
  Minimize2,
  Monitor,
  RotateCcw,
  Smartphone,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DEFAULT_SETTINGS } from '../game/constants';
import { CameraShakeMode, GameSettings, GraphicsQuality } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  muted: boolean;
  onUpdateSettings: (next: GameSettings) => void;
  onToggleMute: () => void;
  onReplayTutorial: () => void;
  onClose: () => void;
}

const QUALITY_OPTIONS: { id: GraphicsQuality; label: string; desc: string }[] = [
  { id: 'auto', label: 'AUTO', desc: 'Matches hardware GPU / software renderer' },
  { id: 'high', label: 'HIGH', desc: 'Full 2x retina DPR & soft shadows' },
  { id: 'medium', label: 'MEDIUM', desc: 'Balanced 1.35x DPR & shadows' },
  { id: 'low', label: 'LOW', desc: '1x DPR, shadows off for max FPS' },
];

const SHAKE_OPTIONS: { id: CameraShakeMode; label: string }[] = [
  { id: 'full', label: 'FULL' },
  { id: 'subtle', label: 'SUBTLE' },
  { id: 'off', label: 'OFF' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  muted,
  onUpdateSettings,
  onToggleMute,
  onReplayTutorial,
  onClose,
}) => {
  const [fsSupported, setFsSupported] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenEnabled),
  );
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenEnabled) {
        setFsSupported(false);
        setStatusMsg('Fullscreen is restricted in this embedded frame.');
        return;
      }
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      setStatusMsg(null);
    } catch {
      setStatusMsg('Browser blocked fullscreen toggle.');
    }
  };

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
              SETTINGS & CONTROLS
            </h1>
            <p className="text-xs font-bold tracking-widest text-sky-300 uppercase">
              AUDIO · GRAPHICS QUALITY · ACCESSIBILITY · INPUT GUIDE
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onUpdateSettings({ ...DEFAULT_SETTINGS })}
          className="panel-bevel flex items-center gap-2 rounded-xl border border-white/15 px-3.5 py-2 font-display text-xs font-extrabold tracking-wider text-slate-200 uppercase transition hover:border-amber-400"
        >
          <RotateCcw className="h-4 w-4" />
          RESET DEFAULTS
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="frontier-scroll my-4 grid flex-1 grid-cols-1 gap-4 overflow-y-auto pr-1 lg:grid-cols-2">
        {/* Audio & Display */}
        <div className="panel-bevel flex flex-col gap-4 rounded-2xl border border-white/15 p-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              {muted ? (
                <VolumeX className="h-5 w-5 text-rose-400" />
              ) : (
                <Volume2 className="h-5 w-5 text-emerald-400" />
              )}
              <h2 className="font-display text-lg font-extrabold tracking-wider uppercase italic">
                AUDIO MIXER
              </h2>
            </div>
            <button
              type="button"
              onClick={onToggleMute}
              className={`rounded-lg border px-3 py-1 font-display text-xs font-extrabold tracking-wider uppercase transition ${
                muted
                  ? 'border-rose-400/50 bg-rose-500/20 text-rose-200'
                  : 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
              }`}
            >
              {muted ? 'MUTED' : 'SOUND ON'}
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-200 uppercase">Master Engine & Audio</span>
              <span className="font-mono-num text-amber-300">
                {Math.round(settings.masterVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.masterVolume}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  masterVolume: parseFloat(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-amber-400"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-200 uppercase">Stunts, Coins & Collisions SFX</span>
              <span className="font-mono-num text-sky-300">
                {Math.round(settings.sfxVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.sfxVolume}
              onChange={(e) =>
                onUpdateSettings({
                  ...settings,
                  sfxVolume: parseFloat(e.target.value),
                })
              }
              className="h-2 w-full cursor-pointer accent-sky-400"
            />
          </label>

          {/* Display & Onboarding Actions */}
          <div className="mt-1 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <button
              type="button"
              disabled={!fsSupported}
              onClick={toggleFullscreen}
              className="panel-steel flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 font-display text-xs font-extrabold tracking-wider text-white uppercase transition hover:border-sky-400 disabled:opacity-50"
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-sky-300" />
              ) : (
                <Maximize2 className="h-4 w-4 text-sky-300" />
              )}
              {isFullscreen ? 'EXIT FULLSCREEN' : 'FULLSCREEN'}
            </button>

            <button
              type="button"
              onClick={onReplayTutorial}
              className="panel-steel flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 font-display text-xs font-extrabold tracking-wider text-amber-200 uppercase transition hover:border-amber-400"
            >
              <HelpCircle className="h-4 w-4 text-amber-300" />
              REPLAY GUIDE
            </button>
          </div>
          {statusMsg && (
            <p className="text-[11px] font-semibold text-amber-300">{statusMsg}</p>
          )}
        </div>

        {/* Graphics & Accessibility */}
        <div className="panel-bevel flex flex-col gap-3.5 rounded-2xl border border-white/15 p-4">
          <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
            <Monitor className="h-5 w-5 text-sky-300" />
            <h2 className="font-display text-lg font-extrabold tracking-wider uppercase italic">
              3D RENDERING & MOTION
            </h2>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-bold tracking-wider text-slate-300 uppercase">
              Graphics Quality Tier
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {QUALITY_OPTIONS.map((q) => {
                const active = settings.graphicsQuality === q.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, graphicsQuality: q.id })
                    }
                    title={q.desc}
                    className={`rounded-xl border px-2.5 py-2 text-center font-display text-xs font-extrabold tracking-wider uppercase transition ${
                      active
                        ? 'border-sky-400 bg-sky-500/20 text-white'
                        : 'border-white/15 bg-[#111923] text-slate-300 hover:border-white/35'
                    }`}
                  >
                    {q.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {QUALITY_OPTIONS.find((q) => q.id === settings.graphicsQuality)?.desc}
            </p>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-bold tracking-wider text-slate-300 uppercase">
              Camera Impact Shake
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SHAKE_OPTIONS.map((opt) => {
                const active = settings.cameraShake === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, cameraShake: opt.id })
                    }
                    className={`rounded-xl border py-2 font-display text-xs font-extrabold tracking-wider uppercase transition ${
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                        : 'border-white/15 bg-[#111923] text-slate-300 hover:border-white/35'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              {
                key: 'showControlHints' as const,
                label: 'HUD HINTS',
                value: settings.showControlHints,
              },
              {
                key: 'reducedMotion' as const,
                label: 'REDUCED MOTION',
                value: settings.reducedMotion,
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() =>
                  onUpdateSettings({ ...settings, [item.key]: !item.value })
                }
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-bold transition ${
                  item.value
                    ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/15 bg-[#111923] text-slate-400'
                }`}
              >
                <span className="font-display tracking-wider uppercase">
                  {item.label}
                </span>
                <span className="font-mono-num text-[11px] font-black">
                  {item.value ? 'ON' : 'OFF'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Control Reference Cards (Full Width on Desktop) */}
        <div className="panel-bevel rounded-2xl border border-white/15 p-4 lg:col-span-2">
          <div className="mb-3 font-display text-base font-extrabold tracking-wider text-amber-300 uppercase italic">
            SUPPORTED INPUT SCHEMES
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-[#111923] p-3">
              <div className="mb-1.5 flex items-center gap-2 font-display text-sm font-extrabold text-white uppercase">
                <Keyboard className="h-4 w-4 text-sky-300" />
                DESKTOP KEYBOARD
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                <li><strong className="text-white">D / →</strong> Throttle & Air Back-Pitch</li>
                <li><strong className="text-white">A / ←</strong> Brake / Reverse & Nose-Down</li>
                <li><strong className="text-white">Shift</strong> Nitro Boost · <strong className="text-white">Space</strong> Handbrake</li>
                <li><strong className="text-white">P / Esc</strong> Pause · <strong className="text-white">R</strong> Quick Restart</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#111923] p-3">
              <div className="mb-1.5 flex items-center gap-2 font-display text-sm font-extrabold text-white uppercase">
                <Smartphone className="h-4 w-4 text-emerald-300" />
                TOUCH & MOBILE
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                <li><strong className="text-white">Left Pedal</strong> Hold Brake / Nose-Down</li>
                <li><strong className="text-white">Right Pedal</strong> Hold Gas / Back-Pitch</li>
                <li><strong className="text-white">Nitro Button</strong> Auto-throttles with Boost</li>
                <li>Landscape orientation recommended on phones</li>
              </ul>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#111923] p-3">
              <div className="mb-1.5 flex items-center gap-2 font-display text-sm font-extrabold text-white uppercase">
                <Gamepad2 className="h-4 w-4 text-violet-300" />
                STANDARD GAMEPAD
              </div>
              <ul className="space-y-1 text-xs text-slate-300">
                <li><strong className="text-white">RT / A</strong> Throttle · <strong className="text-white">LT / X</strong> Brake</li>
                <li><strong className="text-white">RB / B</strong> Nitro Boost · <strong className="text-white">Y</strong> Handbrake</li>
                <li><strong className="text-white">Start / Menu</strong> Pause / Resume</li>
                <li>Auto-detected when any controller connects</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Done CTA */}
      <div className="flex justify-end border-t border-white/10 pt-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-gradient-to-b from-[#ffd34e] to-[#f59e0b] px-7 py-2.5 font-display text-sm font-black tracking-wider text-slate-950 uppercase shadow-lg hover:brightness-105"
        >
          SAVE & RETURN
        </button>
      </div>
    </div>
  );
};
