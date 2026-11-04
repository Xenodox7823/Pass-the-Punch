/**
 * Announcer Voicelines Engine
 * Voicelines have been removed as per user request.
 * All methods are preserved as safe no-ops to maintain interface compatibility.
 */

class AnnouncerVoice {
  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public setEnabled(_val: boolean) {}

  public isEnabled(): boolean {
    return false;
  }

  public speak(
    _text: string,
    _options?: {
      pitch?: number;
      rate?: number;
      volume?: number;
      priority?: boolean;
    }
  ) {}

  public announceVictory() {}
  public announceDefeat() {}
  public announceMatchStart() {}
  public announceMayhem() {}
  public announceOvertime() {}
  public announceGigaBonk() {}
  public announceBonusPunch() {}
  public announceDoubleBonk() {}
  public announceOverload() {}
  public announceRingOut(_name: string) {}
}

export const announcer = new AnnouncerVoice();
