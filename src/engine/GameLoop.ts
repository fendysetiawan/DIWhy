// The game loop: calls tick(dt) every frame, dt in seconds.

export class GameLoop {
  private last = 0;

  start(tick: (dt: number) => void): void {
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - (this.last || now)) / 1000); // cap after a stall
      this.last = now;
      tick(dt);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}
