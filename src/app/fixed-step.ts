export const FIXED_STEP_SECONDS = 1 / 60;
export const MAX_FRAME_DELTA_SECONDS = 0.25;
export const MAX_CATCH_UP_STEPS = 5;

export interface FixedStepState {
  readonly accumulatorSeconds: number;
  readonly simulatedSteps: number;
  readonly droppedSeconds: number;
}

export function advanceFixedStep(
  accumulatorSeconds: number,
  frameDeltaSeconds: number,
): FixedStepState {
  const safeAccumulator = Number.isFinite(accumulatorSeconds) && accumulatorSeconds >= 0
    ? accumulatorSeconds
    : 0;
  const safeFrameDelta = Number.isFinite(frameDeltaSeconds) && frameDeltaSeconds >= 0
    ? Math.min(frameDeltaSeconds, MAX_FRAME_DELTA_SECONDS)
    : 0;
  let accumulator = safeAccumulator + safeFrameDelta;
  let simulatedSteps = 0;

  while (accumulator >= FIXED_STEP_SECONDS && simulatedSteps < MAX_CATCH_UP_STEPS) {
    accumulator -= FIXED_STEP_SECONDS;
    simulatedSteps += 1;
  }

  const droppedSeconds = accumulator >= FIXED_STEP_SECONDS ? accumulator : 0;
  if (droppedSeconds > 0) accumulator = 0;

  return { accumulatorSeconds: accumulator, simulatedSteps, droppedSeconds };
}
