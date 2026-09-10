/**
 * ==============================================================================
 * NEXORA — Pure Procedural Web Audio Synthesis Engine
 * "Enter the Grid. Outsmart the Network."
 * ==============================================================================
 * 100% client-side acoustic frequency synthesis using the native Web Audio API.
 * Zero external MP3/WAV file dependencies. Zero latency. Instant acoustic feedback.
 */

class CyberAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.5;

  constructor() {
    // Load persisted audio preferences
    try {
      const savedMute = localStorage.getItem('nexora_audio_muted');
      if (savedMute !== null) {
        this.isMuted = savedMute === 'true';
      }
      const savedVol = localStorage.getItem('nexora_audio_volume');
      if (savedVol !== null) {
        this.masterVolume = parseFloat(savedVol);
      }
    } catch {
      // Local storage unavailable, use defaults
    }
  }

  /**
   * Initializes the AudioContext upon user gesture (browsers require user interaction).
   */
  private getContext(): AudioContext | null {
    if (this.isMuted) return null;

    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('nexora_audio_muted', String(muted));
    } catch {}
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem('nexora_audio_volume', String(this.masterVolume));
    } catch {}
  }

  /**
   * Standard Tactical Move: Subtle high-tech frequency pulse.
   */
  public playMoveSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);

    gain.gain.setValueAtTime(0.18 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Node Capture: Resonant cyber chord with harmonic overtones (+100 or +200 PTS).
   */
  public playCaptureSound(isSpecial: boolean = false): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const baseFreq = isSpecial ? 523.25 : 392.0; // C5 or G4
    const chordFrequencies = isSpecial
      ? [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2] // Major arpeggio
      : [baseFreq, baseFreq * 1.2, baseFreq * 1.5]; // Minor chord

    chordFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = isSpecial ? 'triangle' : 'sine';
      const startTime = now + idx * 0.04;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.05, startTime + 0.25);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq * 1.5, startTime);
      filter.Q.setValueAtTime(3, startTime);

      gain.gain.setValueAtTime(0.22 * this.masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.35);
    });
  }

  /**
   * Attack Action: Glitch laser zap followed by shield impact.
   */
  public playAttackSound(isBreach: boolean = false): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Laser Beam Zap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.12);

    gain.gain.setValueAtTime(0.28 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);

    // Impact Noise / Breach Shockwave
    if (isBreach) {
      setTimeout(() => {
        const subCtx = this.getContext();
        if (!subCtx) return;
        const subNow = subCtx.currentTime;

        const subOsc = subCtx.createOscillator();
        const subGain = subCtx.createGain();
        subOsc.type = 'square';
        subOsc.frequency.setValueAtTime(120, subNow);
        subOsc.frequency.exponentialRampToValueAtTime(40, subNow + 0.2);

        subGain.gain.setValueAtTime(0.35 * this.masterVolume, subNow);
        subGain.gain.exponentialRampToValueAtTime(0.001, subNow + 0.25);

        subOsc.connect(subGain);
        subGain.connect(subCtx.destination);
        subOsc.start(subNow);
        subOsc.stop(subNow + 0.25);
      }, 100);
    }
  }

  /**
   * Firewall Shield Raised: Sub-bass resonant shield activation drone.
   */
  public playDefendSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.linearRampToValueAtTime(330, now + 0.2);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(6, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3 * this.masterVolume, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  /**
   * Strategic Core Contested Alarm: Pulsing urgent two-tone siren.
   */
  public playCoreContestSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.12].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(offset === 0 ? 880 : 660, now + offset);

      gain.gain.setValueAtTime(0.2 * this.masterVolume, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.1);
    });
  }

  /**
   * Turn Notification: High-frequency cyber bell informing the operative to act.
   */
  public playTurnNotification(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now); // B5
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08); // E6

    gain.gain.setValueAtTime(0.25 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  /**
   * Tactical Radar Beacon Ping.
   */
  public playPingSound(type: 'attack' | 'defend' | 'scan' = 'scan'): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    let freq = 1200;
    if (type === 'attack') freq = 600;
    if (type === 'defend') freq = 900;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.1);

    gain.gain.setValueAtTime(0.22 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * Reverse Engineering / Cryptographic Decompile Click.
   */
  public playDecompileSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1400 + Math.random() * 600, now);

    gain.gain.setValueAtTime(0.12 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  /**
   * Grand Victory Fanfare: Majestic multi-tone brass arpeggio.
   */
  public playVictoryFanfare(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5, E5, G5, C6 triumphant ascending fanfare
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + idx * 0.12;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.3 * this.masterVolume, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });
  }

  /**
   * Defeat Sound: Bit-crushed descending frequency sweep.
   */
  public playDefeatSound(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.5);

    gain.gain.setValueAtTime(0.3 * this.masterVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.55);
  }
}

export const cyberAudio = new CyberAudioEngine();
