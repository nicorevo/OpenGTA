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

const FRAME_WINDOW = 1_800;
const PHYSICS_WINDOW = 3_600;

export class RuntimeMetrics {
  private readonly frameTimes = new Float64Array(FRAME_WINDOW);
  private readonly physicsTimes = new Float64Array(PHYSICS_WINDOW);
  private frameCursor = 0;
  private frameCount = 0;
  private physicsCursor = 0;
  private physicsCount = 0;
  private physicsTime = 0;
  private frames = 0;
  private longFrames = 0;
  private physicsSteps = 0;
  private simulationDebtDrops = 0;
  private droppedSimulationSeconds = 0;
  private startedAt = performance.now();

  recordFrame(frameMs: number): void {
    const safeFrameMs = Number.isFinite(frameMs) && frameMs >= 0 ? frameMs : 0;
    this.frameTimes[this.frameCursor] = safeFrameMs;
    this.frameCursor = (this.frameCursor + 1) % FRAME_WINDOW;
    if (this.frameCount < FRAME_WINDOW) this.frameCount += 1;
    this.frames += 1;
    if (safeFrameMs > 33.3) this.longFrames += 1;
  }

  recordPhysicsStep(physicsMs: number): void {
    const safePhysicsMs = Number.isFinite(physicsMs) && physicsMs >= 0 ? physicsMs : 0;
    this.physicsTimes[this.physicsCursor] = safePhysicsMs;
    this.physicsCursor = (this.physicsCursor + 1) % PHYSICS_WINDOW;
    if (this.physicsCount < PHYSICS_WINDOW) this.physicsCount += 1;
    this.physicsTime += safePhysicsMs;
    this.physicsSteps += 1;
  }

  /** Oldest-to-newest view of the ring buffer's samples (O(window), only on snapshot). */
  private windowOf(buffer: Float64Array, cursor: number, count: number): number[] {
    const values: number[] = [];
    const start = (cursor - count + buffer.length) % buffer.length;
    for (let i = 0; i < count; i += 1) values.push(buffer[(start + i) % buffer.length]);
    return values;
  }

  recordSimulationDebtDrop(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.simulationDebtDrops += 1;
    this.droppedSimulationSeconds += seconds;
  }

  snapshot(): FrameMetricsSnapshot {
    const frameTimes = this.windowOf(this.frameTimes, this.frameCursor, this.frameCount);
    const physicsTimes = this.windowOf(this.physicsTimes, this.physicsCursor, this.physicsCount);
    const totalFrameMs = frameTimes.reduce((sum, value) => sum + value, 0);
    const elapsedSeconds = Math.max(0.001, (performance.now() - this.startedAt) / 1_000);
    return {
      frames: this.frames,
      fps: this.frames / elapsedSeconds,
      averageFrameMs: frameTimes.length ? totalFrameMs / frameTimes.length : 0,
      medianFrameMs: percentile(frameTimes, 0.5),
      p95FrameMs: percentile(frameTimes, 0.95),
      p99FrameMs: percentile(frameTimes, 0.99),
      maxFrameMs: frameTimes.length ? Math.max(...frameTimes) : 0,
      longFrames: this.longFrames,
      physicsSteps: this.physicsSteps,
      averagePhysicsMs: this.physicsSteps ? this.physicsTime / this.physicsSteps : 0,
      p95PhysicsMs: percentile(physicsTimes, 0.95),
      simulationDebtDrops: this.simulationDebtDrops,
      droppedSimulationSeconds: this.droppedSimulationSeconds,
    };
  }
}
