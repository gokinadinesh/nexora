/**
 * ==============================================================================
 * NEXORA — Tactical Cyber Voice Announcer
 * "Enter the Grid. Outsmart the Network."
 * ==============================================================================
 * Native browser speech synthesis with robotic pitch and cadence modulation.
 */

class CyberAnnouncer {
  private isEnabled: boolean = true;
  private voice: SpeechSynthesisVoice | null = null;
  private lastAnnouncementTime: number = 0;

  constructor() {
    try {
      const saved = localStorage.getItem('nexora_announcer_enabled');
      if (saved !== null) {
        this.isEnabled = saved === 'true';
      }
    } catch {}

    this.initVoice();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => this.initVoice();
    }
  }

  private initVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    // Prefer English robotic or deep voices
    this.voice =
      voices.find((v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Zira'))) ||
      voices.find((v) => v.lang.startsWith('en')) ||
      voices[0] ||
      null;
  }

  public getEnabled(): boolean {
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem('nexora_announcer_enabled', String(enabled));
    } catch {}
  }

  public toggle(): boolean {
    this.setEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public speak(text: string, force: boolean = false): void {
    if (!this.isEnabled && !force) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // Rate-limit announcements to prevent audio pile-up (at least 1.5s between calls unless forced)
    const now = Date.now();
    if (!force && now - this.lastAnnouncementTime < 1500) return;
    this.lastAnnouncementTime = now;

    try {
      window.speechSynthesis.cancel(); // Clear any pending speech
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.voice) {
        utterance.voice = this.voice;
      }
      utterance.pitch = 0.82; // Robotic lower tone
      utterance.rate = 1.08; // Crisp, fast military cadence
      utterance.volume = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Speech synthesis unsupported or blocked
    }
  }

  // Pre-configured tactical cues
  public announceMatchStart(): void {
    this.speak('Grid link established. Commencing cyber warfare.');
  }

  public announceCapture(nodeId: string, isSpecial: boolean = false): void {
    if (isSpecial) {
      this.speak('Strategic Core node captured. High bandwidth unlocked.');
    } else {
      this.speak(`Node ${nodeId} secured.`);
    }
  }

  public announceShieldBreach(): void {
    this.speak('Hostile firewall breached.');
  }

  public announceShieldRaised(): void {
    this.speak('Firewall shield engaged.');
  }

  public announceCoreContested(): void {
    this.speak('Alert: Strategic Core is contested.');
  }

  public announceVictory(): void {
    this.speak('Victory protocol achieved. Hostile network subdued.', true);
  }

  public announceDefeat(): void {
    this.speak('Operative offline. Network breached.', true);
  }
}

export const cyberAnnouncer = new CyberAnnouncer();
