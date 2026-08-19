import { describe, expect, it } from "vitest";
import { createPresentationState, toggleLabels } from "./presentation.ts";

describe("gameplay presentation", () => {
  it("starts in a clean driving view without labels", () => {
    expect(createPresentationState().labelsVisible).toBe(false);
  });

  it("allows labels to be toggled for orientation/debug", () => {
    const state = createPresentationState();
    expect(toggleLabels(state).labelsVisible).toBe(true);
    expect(toggleLabels(toggleLabels(state)).labelsVisible).toBe(false);
  });
});
