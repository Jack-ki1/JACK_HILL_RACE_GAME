import { SurfaceType } from '../types/game';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private nitroGain: GainNode | null = null;
  private nitroFilter: BiquadFilterNode | null = null;
  private roadGain: GainNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;
  private muted = false;
  private masterVol = 0.75;
  private sfxVol = 0.9;
  private coinCombo = 0;
  private lastCoinTime = 0;
  private lastScrapeTime = 0;

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : this.masterVol * 0.85, this.ctx.currentTime, 0.03);
    }
  }

  public setVolumes(master: number, sfx: number): void {
    this.masterVol = Math.max(0, Math.min(1, master));
    this.sfxVol = Math.max(0, Math.min(1, sfx));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVol * 0.85,
        this.ctx.currentTime,
        0.03,
      );
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public unlock(): void {
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.masterVol * 0.85;
        this.masterGain.connect(this.ctx.destination);

        // Dual-oscillator off-road engine synth
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 320;
        this.engineFilter.Q.value = 2.2;

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;

        this.engineOsc1 = this.ctx.createOscillator();
        this.engineOsc1.type = 'sawtooth';
        this.engineOsc1.frequency.value = 52;

        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'triangle';
        this.engineOsc2.frequency.value = 26;

        this.engineOsc1.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);

        this.engineOsc1.start();
        this.engineOsc2.start();

        // Filtered noise node for Nitro boost jet
        const bufferSize = this.ctx.sampleRate * 1.5;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        noise.loop = true;

        this.nitroFilter = this.ctx.createBiquadFilter();
        this.nitroFilter.type = 'bandpass';
        this.nitroFilter.frequency.value = 780;
        this.nitroFilter.Q.value = 1.1;

        this.nitroGain = this.ctx.createGain();
        this.nitroGain.gain.value = 0;

        noise.connect(this.nitroFilter);
        this.nitroFilter.connect(this.nitroGain);
        this.nitroGain.connect(this.masterGain);
        noise.start();

        // Surface tire crunch / gravel / mud loop
        const roadSrc = this.ctx.createBufferSource();
        roadSrc.buffer = noiseBuffer;
        roadSrc.loop = true;

        this.roadFilter = this.ctx.createBiquadFilter();
        this.roadFilter.type = 'bandpass';
        this.roadFilter.frequency.value = 340;
        this.roadFilter.Q.value = 0.85;

        this.roadGain = this.ctx.createGain();
        this.roadGain.gain.value = 0;

        roadSrc.connect(this.roadFilter);
        this.roadFilter.connect(this.roadGain);
        this.roadGain.connect(this.masterGain);
        roadSrc.start();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
    } catch {
      // Ignore Web Audio restriction errors gracefully
    }
  }

  public updateEngine(
    active: boolean,
    rpm: number,
    throttle: number,
    nitro: boolean,
    vehicleId: string = 'ranger',
  ): void {
    if (!this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain || !this.nitroGain || !this.nitroFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!active || this.muted) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.nitroGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    const pitchScale =
      vehicleId === 'superbike'
        ? 1.75
        : vehicleId === 'cheetah_vc'
          ? 1.38
          : vehicleId === 'buggy'
            ? 1.25
            : vehicleId === 'monster'
              ? 0.78
              : vehicleId === 'donk_leonida'
                ? 0.82
                : vehicleId === 'muscle'
                  ? 0.86
                  : 1.0;
    const baseFreq = (42 + rpm * 112 + (nitro ? 26 : 0)) * pitchScale;
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2.frequency.setTargetAtTime(
      vehicleId === 'muscle' || vehicleId === 'monster' || vehicleId === 'donk_leonida'
        ? baseFreq * 0.5
        : baseFreq * 0.75,
      now,
      0.03,
    );
    this.engineFilter.frequency.setTargetAtTime(
      210 + rpm * 720 + Math.max(0, throttle) * 320,
      now,
      0.04,
    );
    this.engineGain.gain.setTargetAtTime(0.045 + Math.abs(throttle) * 0.055, now, 0.04);

    this.nitroFilter.frequency.setTargetAtTime(nitro ? 1150 : 500, now, 0.05);
    this.nitroGain.gain.setTargetAtTime(nitro ? 0.14 : 0, now, 0.04);
  }

  public updateSurfaceNoise(
    grounded: boolean,
    speedMs: number,
    surface: SurfaceType,
    wheelspin = false,
  ): void {
    if (!this.ctx || !this.roadGain || !this.roadFilter) return;
    const now = this.ctx.currentTime;
    if (!grounded || this.muted || this.sfxVol <= 0.01 || (speedMs < 1.2 && !wheelspin)) {
      this.roadGain.gain.setTargetAtTime(0, now, 0.05);
      return;
    }
    const freq =
      surface === 'mud'
        ? 220
        : surface === 'sand'
          ? 640
          : surface === 'ice'
            ? 1450
            : surface === 'asphalt'
              ? 460
              : 540;
    const baseGain =
      surface === 'asphalt'
        ? 0.018
        : surface === 'mud'
          ? 0.048
          : surface === 'ice'
            ? 0.032
            : 0.038;
    const speedFactor = Math.min(1.3, speedMs / 22 + (wheelspin ? 0.45 : 0));
    this.roadFilter.frequency.setTargetAtTime(freq + speedMs * 12, now, 0.05);
    this.roadGain.gain.setTargetAtTime(baseGain * speedFactor * this.sfxVol, now, 0.05);
  }

  public playScrape(intensity = 0.6): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    if (now - this.lastScrapeTime < 0.085) return;
    this.lastScrapeTime = now;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190 + Math.random() * 90, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.075);
    g.gain.setValueAtTime(0.09 * Math.min(1, intensity) * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playPerfectLanding(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    [587.33, 880].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      const t = now + i * 0.045;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.12 * this.sfxVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.17);
    });
  }

  public playGearShift(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(165, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.075);
    g.gain.setValueAtTime(0.11 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playCoin(value: number): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    if (now - this.lastCoinTime < 0.7) {
      this.coinCombo = Math.min(8, this.coinCombo + 1);
    } else {
      this.coinCombo = 0;
    }
    this.lastCoinTime = now;

    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const basePitch = value >= 100 ? 987 : value >= 25 ? 880 : 784;
    const pitch = basePitch * Math.pow(1.045, this.coinCombo);
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 1.48, now + 0.09);

    g.gain.setValueAtTime(0.14 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playFuel(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + idx * 0.055;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.16 * this.sfxVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  public playStunt(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      const t = now + i * 0.04;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.12 * this.sfxVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  public playLanding(intensity: number): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.14);
    g.gain.setValueAtTime(0.18 * Math.min(1, intensity) * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playCrash(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.42);
    g.gain.setValueAtTime(0.28 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.46);
  }

  public playSplash(intensity: number): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const dur = 0.24;
    const buf = this.ctx.createBuffer(1, Math.floor(this.ctx.sampleRate * dur), this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + dur);
    filter.Q.value = 0.85;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16 * Math.min(1, Math.max(0.25, intensity)) * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);
    src.start(now);
  }

  public playTurboSurge(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.16);
    g.gain.setValueAtTime(0.14 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playJumpShock(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.11);
    g.gain.setValueAtTime(0.2 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playRollcageBreak(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    [340, 210, 110].forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'square';
      const t = now + idx * 0.03;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, t + 0.12);
      g.gain.setValueAtTime(0.16 * this.sfxVol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.13);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.14);
    });
  }

  public playNeckCrack(): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.08);
    g.gain.setValueAtTime(0.28 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  public playClick(upgrade = false): void {
    if (!this.ctx || !this.masterGain || this.muted || this.sfxVol <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = upgrade ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(upgrade ? 620 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(upgrade ? 930 : 320, now + 0.07);
    g.gain.setValueAtTime(0.1 * this.sfxVol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.09);
  }
}
