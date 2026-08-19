export interface FrameMetricsSnapshot {
  readonly frames: number;
  readonly fps: number;
  readonly averageFrameMs: number;
  readonly medianFrameMs: number;
  readonly p95FrameMs: number;
  readonly p99FrameMs: number;
  readonly maxFrameMs: number;
  readonly longFrames: number;
  readonly physicsSteps: number;
  readonly averagePhysicsMs: number;
}

export class RuntimeMetrics {
  private readonly frameTimes: number[] = [];
  private physicsTime = 0;
  private frames = 0;
  private longFrames = 0;
  private physicsSteps = 0;
  private startedAt = performance.now();

  recordFrame(frameMs: number, physicsMs: number): void {
    const safeFrameMs = Number.isFinite(frameMs) && frameMs >= 0 ? frameMs : 0;
    this.frameTimes.push(safeFrameMs);
    if (this.frameTimes.length > 1800) this.frameTimes.shift();
    this.frames += 1;
    if (safeFrameMs > 33.3) this.longFrames += 1;
    this.physicsTime += Math.max(0, physicsMs);
    this.physicsSteps += 1;
  }

  snapshot(): FrameMetricsSnapshot {
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const percentile = (rank: number): number => sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * rank))];
    const totalFrameMs = this.frameTimes.reduce((sum, value) => sum + value, 0);
    const elapsedSeconds = Math.max(0.001, (performance.now() - this.startedAt) / 1000);
    return { frames: this.frames, fps: this.frames / elapsedSeconds, averageFrameMs: this.frameTimes.length ? totalFrameMs / this.frameTimes.length : 0, medianFrameMs: percentile(0.5), p95FrameMs: percentile(0.95), p99FrameMs: percentile(0.99), maxFrameMs: sorted.at(-1) ?? 0, longFrames: this.longFrames, physicsSteps: this.physicsSteps, averagePhysicsMs: this.physicsSteps ? this.physicsTime / this.physicsSteps : 0 };
  }
}
