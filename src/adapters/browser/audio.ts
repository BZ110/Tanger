import type { AudioPort } from '../../application/ports';
import type { CombatEvent } from '../../game/simulation';

/** Original synthesized UI/combat sounds; no extracted recordings. */
export class BrowserAudio implements AudioPort {
  private context: AudioContext | undefined;
  private volume = 0.4;
  unlock(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => undefined);
    } catch {
      this.context = undefined;
    }
  }
  setVolume(volume: number): void {
    this.volume = volume;
  }
  effect(event: CombatEvent): void {
    const context = this.context;
    if (!context || context.state !== 'running' || this.volume === 0) return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const frequency =
      event.kind === 'hit'
        ? 130
        : event.kind === 'dash'
          ? 330
          : event.kind === 'damage'
            ? 80
            : event.kind === 'step'
              ? 660
              : 220;
    const duration = event.kind === 'hit' ? 0.1 : 0.08;
    oscillator.type =
      event.kind === 'hit' || event.kind === 'damage' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 0.35,
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(this.volume * 0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  dispose(): void {
    if (this.context) void this.context.close();
    this.context = undefined;
  }
}
