import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledChunkV0 } from "../../world/compiler/compiled.ts";
import { defaultProfile, parisProfile, romeProfile } from "../theme/index.ts";

// Fake pixi.js extended with what the theme tests need: a Graphics instance
// counter (presentation rebuilds create new Graphics objects) and the
// background color setter (app.renderer.background.color.set).
const fakeState = vi.hoisted(() => ({
  graphicsCreated: 0,
  initBackgrounds: [] as number[],
  backgroundSets: [] as number[],
}));

vi.mock("pixi.js", () => {
  class FakeContainer {
    children: FakeContainer[] = [];
    zIndex = 0;
    sortableChildren = false;
    visible = true;
    rotation = 0;
    position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    scale = { x: 1, y: 1, set(value: number) { this.x = value; this.y = value; } };
    skew = { x: 0, y: 0 };
    addChild(...items: FakeContainer[]) { this.children.push(...items); }
    removeChild(item: FakeContainer) { const index = this.children.indexOf(item); if (index >= 0) this.children.splice(index, 1); }
    removeChildren(): FakeContainer[] { return this.children.splice(0); }
    setMask() { /* mask is a WebGL concern */ }
    sortChildren() { /* painter order is a render concern */ }
    destroy(options?: { children?: boolean }) { if (options?.children) for (const child of this.children) child.destroy(); this.children.length = 0; }
  }
  class FakeGraphics extends FakeContainer {
    constructor() { super(); fakeState.graphicsCreated += 1; }
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
  class FakeSprite extends FakeContainer {
    anchor = { set() { /* sprite origin */ } };
  }
  const Assets = { load: async () => ({ width: 192, height: 93, source: {} }) };
  class FakeText extends FakeContainer {
    anchor = { set() { /* anchor is a render concern */ } };
    get text() { return this.options.text; }
    get width() { return this.options.text.length * 64; }
    get height() { return 128; }
    constructor(readonly options: { text: string }) { super(); }
  }
  class FakeApplication {
    stage = new FakeContainer();
    screen = { width: 1280, height: 720 };
    tickers: Array<() => void> = [];
    ticker = {
      add: (fn: () => void) => { this.tickers.push(fn); },
      remove: (fn: () => void) => { this.tickers = this.tickers.filter((t) => t !== fn); },
    };
    renderer = {
      background: {
        color: { setValue(color: number) { fakeState.backgroundSets.push(color); } },
      },
    };
    async init(options?: { background?: number }) { if (options?.background !== undefined) fakeState.initBackgrounds.push(options.background); }
    destroy() { /* teardown is a render concern */ }
  }
  class FakePoint { constructor(readonly x: number, readonly y: number) { /* geometry probe */ } }
  return { Assets, Sprite: FakeSprite, Application: FakeApplication, Container: FakeContainer, Graphics: FakeGraphics, Text: FakeText, Point: FakePoint };
});

import { createPixiRenderer } from "./renderer.ts";

const canvas = { parentElement: {} } as unknown as HTMLCanvasElement;

/** One ground area, one road, one generic + one typed building per chunk. */
function makeChunk(id: string): CompiledChunkV0 {
  const square = {
    outer: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }],
    holes: [] as { x: number; y: number }[][],
  };
  return {
    schemaVersion: 0,
    id,
    spatial: { regionId: id, bounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 }, originOffset: { x: 0, y: 0 } },
    ground: [{ featureId: `g:${id}`, styleKey: "land:park", area: square }],
    roads: [{
      featureId: `r:${id}`,
      surface: square,
      centerline: [{ x: 0, y: 0 }, { x: 30, y: 0 }],
      widthMeters: 6,
      styleKey: "road:primary",
    }],
    buildings: [
      { featureId: `b1:${id}`, styleKey: "building:unknown", roof: square, visualHeightMeters: 12, fakeDepth: { enabled: true, scale: 1 } },
      { featureId: `b2:${id}`, styleKey: "building:historic", roof: square, visualHeightMeters: 12, fakeDepth: { enabled: true, scale: 1 } },
    ],
    labels: [],
    collisions: [],
    featureIndex: {},
    diagnostics: { inputFeatureCount: 0, compiledFeatureCount: 0, skippedFeatureCount: 0, warnings: [], stageDurationsMs: { total: 0 } },
  };
}

beforeEach(() => {
  fakeState.graphicsCreated = 0;
  fakeState.initBackgrounds.length = 0;
  fakeState.backgroundSets.length = 0;
});

describe("createPixiRenderer visual profile", () => {
  it("defaults to the default profile when no option is passed", async () => {
    const renderer = await createPixiRenderer(canvas);
    expect(renderer.visualProfileId()).toBe("default");
    expect(fakeState.initBackgrounds).toEqual([defaultProfile.ground.base]);
    renderer.dispose();
  });

  it("applies the profile passed at creation (id + background tone)", async () => {
    const renderer = await createPixiRenderer(canvas, { visualProfile: parisProfile });
    expect(renderer.visualProfileId()).toBe("paris");
    expect(fakeState.initBackgrounds).toEqual([parisProfile.ground.base]);
    renderer.dispose();
  });
});

describe("setVisualProfile", () => {
  it("is a no-op when the profile id does not change", async () => {
    const renderer = await createPixiRenderer(canvas);
    renderer.setChunk(makeChunk("a"));
    const before = fakeState.graphicsCreated;
    const setsBefore = fakeState.backgroundSets.length;
    renderer.setVisualProfile(defaultProfile);
    expect(fakeState.graphicsCreated).toBe(before);
    expect(fakeState.backgroundSets).toHaveLength(setsBefore);
    expect(renderer.presentationCounts().chunkPresentations).toBe(1);
    renderer.dispose();
  });

  it("rebuilds presentations only when the id changes", async () => {
    const renderer = await createPixiRenderer(canvas);
    const chunk = makeChunk("a");
    renderer.setChunk(chunk);
    const baseline = fakeState.graphicsCreated;
    const before = renderer.presentationCounts();
    const camera = renderer.cameraState();

    renderer.setVisualProfile(romeProfile);

    expect(renderer.visualProfileId()).toBe("rome");
    expect(fakeState.backgroundSets).toEqual([romeProfile.ground.base]);
    // every per-chunk Graphics layer is redrawn exactly once (7 per chunk)
    expect(fakeState.graphicsCreated).toBe(baseline + 7);
    // data and view are untouched: same presentations, same camera
    expect(renderer.presentationCounts()).toEqual(before);
    expect(renderer.cameraState().zoomLevel).toBe(camera.zoomLevel);
    expect(renderer.cameraState().bounds).toEqual(camera.bounds);
    renderer.dispose();
  });

  it("keeps the compiled chunks: re-setting the same chunk is still a no-op after a switch", async () => {
    const renderer = await createPixiRenderer(canvas);
    const chunk = makeChunk("a");
    renderer.setChunk(chunk);
    renderer.setVisualProfile(parisProfile);
    const after = fakeState.graphicsCreated;
    renderer.setChunk(chunk); // must not rebuild: same content reference
    expect(fakeState.graphicsCreated).toBe(after);
    expect(renderer.presentationCounts().chunkPresentations).toBe(1);
    renderer.dispose();
  });

  it("switching back and forth stays stable (no leak, same counts)", async () => {
    const renderer = await createPixiRenderer(canvas);
    renderer.setChunk(makeChunk("a"));
    const counts = renderer.presentationCounts();
    renderer.setVisualProfile(romeProfile);
    expect(renderer.presentationCounts()).toEqual(counts);
    renderer.setVisualProfile(parisProfile);
    expect(renderer.presentationCounts()).toEqual(counts);
    expect(renderer.visualProfileId()).toBe("paris");
    renderer.dispose();
  });

  it("does not touch the vehicle pose", async () => {
    const renderer = await createPixiRenderer(canvas);
    renderer.setChunk(makeChunk("a"));
    renderer.updateVehicle({ x: 10, y: 5 }, 0.6);
    const cameraBefore = renderer.cameraState();
    renderer.setVisualProfile(romeProfile);
    expect(renderer.cameraState().bounds).toEqual(cameraBefore.bounds);
    renderer.dispose();
  });
});
