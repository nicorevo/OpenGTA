export interface PresentationState {
  readonly labelsVisible: boolean;
}

export function createPresentationState(): PresentationState {
  return { labelsVisible: false };
}

export function toggleLabels(state: PresentationState): PresentationState {
  return { labelsVisible: !state.labelsVisible };
}
