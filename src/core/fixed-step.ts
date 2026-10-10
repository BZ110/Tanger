/** Pure clock. The application owns requestAnimationFrame and visibility. */
export class FixedStep {
  private accumulator = 0;
  constructor(
    readonly stepSeconds = 1 / 60,
    private readonly maxSteps = 8,
  ) {}

  advance(elapsed: number, update: (dt: number) => void): number {
    this.accumulator += Math.max(
      0,
      Math.min(elapsed, this.stepSeconds * this.maxSteps),
    );
    let steps = 0;
    while (
      this.accumulator + Number.EPSILON >= this.stepSeconds &&
      steps < this.maxSteps
    ) {
      update(this.stepSeconds);
      this.accumulator = Math.max(0, this.accumulator - this.stepSeconds);
      steps++;
    }
    return this.accumulator / this.stepSeconds;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
