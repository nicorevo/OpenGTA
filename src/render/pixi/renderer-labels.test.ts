import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledChunkV0, CompiledLabel } from "../../world/compiler/compiled.ts";

// Minimal pixi.js fake: just enough scene-graph surface (children, destroy,
// text) to unit-test the renderer's label lifecycle without WebGL. The full
// visual behavior stays covered by the e2e suite in a real browser.
const fakeState = vi.hoisted(() => ({
  texts: [] as Array<{ readonly text: string; destroyed: boolean; position: { x: number; y: number } }>,
}));

vi.mock("pixi.js", () => {
  class FakeContainer {
    children: FakeContainer[] = [];
    zIndex = 0;
    sortableChildren = false;
    visible = true;
    rotation = 0;
    position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    scale = { set() { /* view transform: not needed for label logic */ } };
    addChild(...items: FakeContainer[]) { this.children.push(...items); }
    removeChild(item: FakeContainer) { const index = this.children.indexOf(item); if (index >= 0) this.children.splice(index, 1); }
    removeChildren(): FakeContainer[] { return this.children.splice(0); }
    setMask() { /* mask is a WebGL concern */ }
    sortChildren() { /* painter order is a render concern */ }
    destroy(options?: { children?: boolean }) { if (options?.children) for (const child of this.children) child.destroy(); this.children.length = 0; }
  }
  class FakeGraphics extends FakeContainer {
    poly() { return this; }
    fill() { return this; }
    cut() { return this; }
    roundRect() { return this; }
    circle() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    closePath() { return this; }
    stroke() { return this; }
    containsPoint() { return false; }
  }
  class FakeText extends FakeContainer {
    destroyed = false;
    anchor = { set() { /* anchor is a render concern */ } };
    get text() { return this.options.text; }
    constructor(readonly options: { text: string }) {
      super();
      fakeState.texts.push(this);
    }
    destroy() { this.destroyed = true; super.destroy(); }
  }
  class FakeApplication {
    stage = new FakeContainer();
    screen = { width: 1280, height: 720 };
    tickers: Array<() => void> = [];
    ticker = {
      add: (fn: () => void) => { this.tickers.push(fn); },
      remove: (fn: () => void) => { this.tickers = this.tickers.filter((t) => t !== fn); },
    };
    async init() { /* no WebGL in unit tests */ }
    destroy() { /* teardown is a render concern */ }
  }
  class FakePoint { constructor(readonly x: number, readonly y: number) { /* geometry probe */ } }
  return { Application: FakeApplication, Container: FakeContainer, Graphics: FakeGraphics, Text: FakeText, Point: FakePoint };
});

import { createPixiRenderer } from "./renderer.ts";

const canvas = { parentElement: {} } as unknown as HTMLCanvasElement;

function labelText(featureId: string, text: string, x: number, y: number, priority: number): CompiledLabel {
  return { featureId, text, position: { x, y }, angle: 0, kind: "road", priority };
}
function makeChunk(id: string, labels: readonly CompiledLabel[]): CompiledChunkV0 {
  return {
    schemaVersion: 0,
    id,
    spatial: { regionId: id, bounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 }, originOffset: { x: 0, y: 0 } },
    ground: [],
    roads: [],
    buildings: [],
    labels,
    collisions: [],
    featureIndex: {},
    diagnostics: { inputFeatureCount: 0, compiledFeatureCount: 0, skippedFeatureCount: 0, warnings: [], stageDurationsMs: { total: 0 } },
  };
}

describe("label rebuild lifecycle", () => {
  beforeEach(() => { fakeState.texts.length = 0; });

  it("creates no label texts while labels are hidden", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // the car's decal texts, created at init
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)]));
    expect(fakeState.texts).toHaveLength(baseline);
    renderer.dispose();
  });

  it("destroys the previous label texts on rebuild and keeps one per visible label", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // the car's decal texts, created at init
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)]));
    expect(fakeState.texts).toHaveLength(baseline + 1);
    expect(fakeState.texts[baseline]?.destroyed).toBe(false);
    // A new chunk object with the same content forces the streaming rebuild.
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)]));
    expect(fakeState.texts).toHaveLength(baseline + 2);
    expect(fakeState.texts[baseline]?.destroyed).toBe(true);
    expect(fakeState.texts[baseline + 1]?.destroyed).toBe(false);
    expect(renderer.presentationDiagnostics().labels).toBe(1);
    renderer.dispose();
  });

  it("creates a label only for its own chunk and drops it with the chunk", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // the car's decal texts, created at init
    const alive = () => fakeState.texts.slice(baseline).filter((text) => !text.destroyed).map((text) => text.text).sort();
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90), labelText("a2", "Two", 3, 4, 90)]));
    expect(alive()).toEqual(["One", "Two"]);
    renderer.setChunk(makeChunk("b", [labelText("b1", "Three", 5, 6, 90)]));
    expect(alive()).toEqual(["One", "Three", "Two"]);
    renderer.removeChunk("a");
    expect(alive()).toEqual(["Three"]);
    expect(renderer.presentationDiagnostics().labels).toBe(1);
    renderer.dispose();
  });

  it("filters labels by the LOD profile priority", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // the car's decal texts, created at init
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [labelText("a1", "Major", 1, 2, 90), labelText("a2", "Minor", 3, 4, 40)]));
    expect(fakeState.texts).toHaveLength(baseline + 1);
    expect(fakeState.texts[baseline]?.text).toBe("Major");
    renderer.dispose();
  });

  it("drops the remaining texts when labels are toggled off", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // the car's decal texts, created at init
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)]));
    expect(fakeState.texts).toHaveLength(baseline + 1);
    renderer.toggleLabels();
    expect(fakeState.texts[baseline]?.destroyed).toBe(true);
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)]));
    expect(fakeState.texts).toHaveLength(baseline + 1);
    renderer.dispose();
  });
});
