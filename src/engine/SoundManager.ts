// Sound: one music track and one voice at a time (a new one stops the last), effects can overlap.

// The mix: music and the ambience (steps, hums) quietly underneath; voices and what you do on top.
const MUSIC_VOLUME = 0.12;
const STEPS_VOLUME = 0.35;
const FADE_MS = 600;

export class SoundManager {
  private music: HTMLAudioElement | null = null;
  private voice: HTMLAudioElement | null = null;
  private steps: HTMLAudioElement | null = null;
  private muted = false;
  /** Every sound playing right now (effects, voices, music, a track fading out), so mute reaches them all. */
  private readonly playing = new Set<HTMLAudioElement>();

  /** Turn all sound on or off (everything already playing too). */
  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const a of this.playing) a.muted = muted;
    if (!muted && this.music?.paused) this.startMusic(this.music);
  }

  /** Play a short effect once, e.g. play(pop, 0.25) with pop imported from assets/audio/ui/pop.wav. */
  play(src: string, volume = 0.8): HTMLAudioElement | null {
    if (this.muted) return null;
    const a = this.track(new Audio(src));
    a.volume = volume;
    a.addEventListener('ended', () => this.playing.delete(a));
    a.play().catch(() => this.playing.delete(a));
    return a;
  }

  /** Say a line (the narrator, a character): stops whoever was talking, e.g. say(player.voice('emote')). */
  say(src: string, volume = 1): void {
    this.stopVoice();
    this.voice = this.play(src, volume);
  }

  /** Loop footsteps while someone walks (null: stop). Changing surface swaps the loop. */
  setFootsteps(src: string | null): void {
    this.steps = this.loop(this.steps, src, STEPS_VOLUME);
  }

  /** A sound a thing makes, looped (the fridge's hum, the furnace): set its volume as you move, stop it when you leave. */
  emit(src: string): { setVolume(volume: number): void; stop(): void } {
    const a = this.track(new Audio(src));
    a.loop = true;
    a.volume = 0;
    a.play().catch(() => {});
    return {
      setVolume: (volume) => {
        a.volume = volume;
      },
      stop: () => {
        a.pause();
        this.playing.delete(a);
      },
    };
  }

  /** Swap a looping sound for another (or stop it). */
  private loop(current: HTMLAudioElement | null, src: string | null, volume: number): HTMLAudioElement | null {
    if (current && src && current.src.endsWith(src)) return current;
    if (current) {
      current.pause();
      this.playing.delete(current);
    }
    if (!src || this.muted) return null;
    const a = this.track(new Audio(src));
    a.loop = true;
    a.volume = volume;
    a.play().catch(() => {});
    return a;
  }

  /** Cut off whoever is talking. */
  private stopVoice(): void {
    if (!this.voice) return;
    this.voice.pause();
    this.playing.delete(this.voice);
    this.voice = null;
  }

  /** Loop a music track, fading out the one before, e.g. playMusic(music) with music imported from assets/audio/music/. */
  playMusic(src: string): void {
    if (this.music?.src.endsWith(src)) return;
    const old = this.music;
    if (old)
      fadeTo(old, 0, () => {
        old.pause();
        this.playing.delete(old);
      });
    const a = this.track(new Audio(src));
    a.loop = true;
    a.volume = 0;
    this.music = a;
    if (!this.muted) this.startMusic(a);
  }

  private startMusic(a: HTMLAudioElement): void {
    a.play()
      .then(() => fadeTo(a, MUSIC_VOLUME))
      .catch(() => {});
  }

  private track(a: HTMLAudioElement): HTMLAudioElement {
    a.muted = this.muted;
    this.playing.add(a);
    return a;
  }
}

function fadeTo(a: HTMLAudioElement, to: number, then?: () => void): void {
  const from = a.volume;
  const start = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - start) / FADE_MS);
    a.volume = Math.min(1, Math.max(0, from + (to - from) * k)); // never a hair outside 0–1
    if (k < 1) requestAnimationFrame(step);
    else then?.();
  };
  requestAnimationFrame(step);
}
