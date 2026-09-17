import { describe, expect, it } from "vitest";
import { switchView, type ViewLoop } from "./view-toggle.ts";

/** A ViewLoop double that records every call in order. */
const fakeLoop = (name: string): { loop: ViewLoop; calls: string[] } => {
  const calls: string[] = [];
  let started = true;
  return {
    calls,
    loop: {
      get started() { return started; },
      stop: () => { started = false; calls.push(`${name}:stop`); },
      start: () => { started = true; calls.push(`${name}:start`); },
      render: () => { calls.push(`${name}:render`); },
    },
  };
};

describe("switchView", () => {
  it("stops the hidden view and starts the visible one with an immediate pass", () => {
    const topDown = fakeLoop("topDown");
    const firstPerson = fakeLoop("firstPerson");

    switchView(topDown.loop, firstPerson.loop);

    expect(topDown.calls).toEqual(["topDown:stop"]);
    expect(firstPerson.calls).toEqual(["firstPerson:start", "firstPerson:render"]);
    expect(topDown.loop.started).toBe(false);
    expect(firstPerson.loop.started).toBe(true);
  });

  it("renders the just-visible scene before anything else on the way back", () => {
    const topDown = fakeLoop("topDown");
    const firstPerson = fakeLoop("firstPerson");

    switchView(firstPerson.loop, topDown.loop);

    expect(firstPerson.calls).toEqual(["firstPerson:stop"]);
    expect(topDown.calls).toEqual(["topDown:start", "topDown:render"]);
  });

  it("keeps the invariant across repeated toggles", () => {
    const topDown = fakeLoop("topDown");
    const firstPerson = fakeLoop("firstPerson");

    switchView(topDown.loop, firstPerson.loop);
    switchView(firstPerson.loop, topDown.loop);
    switchView(topDown.loop, firstPerson.loop);

    expect(topDown.calls).toEqual(["topDown:stop", "topDown:start", "topDown:render", "topDown:stop"]);
    expect(firstPerson.calls).toEqual(["firstPerson:start", "firstPerson:render", "firstPerson:stop", "firstPerson:start", "firstPerson:render"]);
    expect(topDown.loop.started).toBe(false);
    expect(firstPerson.loop.started).toBe(true);
  });
});
