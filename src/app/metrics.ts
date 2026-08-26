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
  readonly p95PhysicsMs: number;
  readonly simulationDebtDrops: number;
  readonly droppedSimulationSeconds: number;
}

function percentile(values: readonly number[], rank: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * rank))];
}

export class RuntimeMetrics {
  private readonly frameTimes: number[] = [];
  private readonly physicsTimes: number[] = [];
  private physicsTime = 0;
  private frames = 0;
  private longFrames = 0;
  private physicsSteps = 0;
  private simulationDebtDrops = 0;
  private droppedSimulationSeconds = 0;
  private startedAt = performance.now();

  recordFrame(frameMs: number): void {
    const safeFrameMs = Number.isFinite(frameMs) && frameMs >= 0 ? frameMs : 0;
    this.frameTimes.push(safeFrameMs);
    if (this.frameTimes.length > 1_800) this.frameTimes.shift();
    this.frames += 1;
    if (safeFrameMs > 33.3) this.longFrames += 1;
  }

  recordPhysicsStep(physicsMs: number): void {
    const safePhysicsMs = Number.isFinite(physicsMs) && physicsMs >= 0 ? physicsMs : 0;
    this.physicsTimes.push(safePhysicsMs);
    if (this.physicsTimes.length > 3_600) this.physicsTimes.shift();
    this.physicsTime += safePhysicsMs;
    this.physicsSteps += 1;
  }

  recordSimulationDebtDrop(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.simulationDebtDrops += 1;
    this.droppedSimulationSeconds += seconds;
  }

  snapshot(): FrameMetricsSnapshot {
    const totalFrameMs = this.frameTimes.reduce((sum, value) => sum + value, 0);
    const elapsedSeconds = Math.max(0.001, (performance.now() - this.startedAt) / 1_000);
    return {
      frames: this.frames,
      fps: this.frames / elapsedSeconds,
      averageFrameMs: this.frameTimes.length ? totalFrameMs / this.frameTimes.length : 0,
      medianFrameMs: percentile(this.frameTimes, 0.5),
      p95FrameMs: percentile(this.frameTimes, 0.95),
      p99FrameMs: percentile(this.frameTimes, 0.99),
      maxFrameMs: this.frameTimes.length ? Math.max(...this.frameTimes) : 0,
      longFrames: this.longFrames,
      physicsSteps: this.physicsSteps,
      averagePhysicsMs: this.physicsSteps ? this.physicsTime / this.physicsSteps : 0,
      p95PhysicsMs: percentile(this.physicsTimes, 0.95),
      simulationDebtDrops: this.simulationDebtDrops,
      droppedSimulationSeconds: this.droppedSimulationSeconds,
    };
  }
}
