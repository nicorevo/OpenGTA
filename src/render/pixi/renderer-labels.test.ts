import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompiledChunkV0, CompiledLabel } from "../../world/compiler/compiled.ts";

// Minimal pixi.js fake: just enough scene-graph surface (children, destroy,
// text) to unit-test the renderer's label lifecycle without WebGL. The full
// visual behavior stays covered by the e2e suite in a real browser.
const fakeState = vi.hoisted(() => ({
  texts: [] as Array<{ readonly text: string; destroyed: boolean; position: { x: number; y: number }; scale: { x: number; y: number } }>,
}));

vi.mock("pixi.js", () => {
  class FakeContainer {
    children: FakeContainer[] = [];
    zIndex = 0;
    sortableChildren = false;
    visible = true;
    rotation = 0;
    position = { x: 0, y: 0, set(x: number, y: number) { this.x = x; this.y = y; } };
    // Records the last uniform scale so tests can assert world-space sizing
    // (labels and the view transform both go through `scale.set`).
    scale = { x: 1, y: 1, set(value: number) { this.x = value; this.y = value; } };
    skew = { x: 0, y: 0 }; // vehicle drift flex: a render concern
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
  class FakeSprite extends FakeContainer {
    anchor = { set() { /* sprite origin */ } };
  }
  const Assets = { load: async () => ({ width: 192, height: 93, source: {} }) };
  class FakeText extends FakeContainer {
    destroyed = false;
    anchor = { set() { /* anchor is a render concern */ } };
    get text() { return this.options.text; }
    // Deterministic "rasterized" size at the 128px design font: enough for
    // the renderer's width/height probe without a real text layout engine.
    get width() { return this.options.text.length * 64; }
    get height() { return 128; }
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
  return { Assets, Sprite: FakeSprite, Application: FakeApplication, Container: FakeContainer, Graphics: FakeGraphics, Text: FakeText, Point: FakePoint };
});

import { createPixiRenderer, labelTextKey, labelFitScale, labelWorldHeightM, polylineLengthMeters } from "./renderer.ts";

const canvas = { parentElement: {} } as unknown as HTMLCanvasElement;

type FixtureRoad = CompiledChunkV0["roads"][number];

function labelText(featureId: string, text: string, x: number, y: number, priority: number): CompiledLabel {
  return { featureId, text, position: { x, y }, angle: 0, kind: "road", priority };
}
function placeLabel(featureId: string, text: string, x: number, y: number, priority: number): CompiledLabel {
  return { featureId, text, position: { x, y }, angle: 0, kind: "place", priority };
}
function roadFixture(featureId: string, widthMeters: number, lengthMeters: number): FixtureRoad {
  return { featureId, surface: { outer: [], holes: [] }, centerline: [{ x: 0, y: 0 }, { x: lengthMeters, y: 0 }], widthMeters, styleKey: "road:residential" };
}
function makeChunk(id: string, labels: readonly CompiledLabel[], roads: readonly FixtureRoad[] = []): CompiledChunkV0 {
  return {
    schemaVersion: 0,
    id,
    spatial: { regionId: id, bounds: { minX: -10, minY: -10, maxX: 10, maxY: 10 }, originOffset: { x: 0, y: 0 } },
    ground: [],
    roads,
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
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)]));
    expect(fakeState.texts).toHaveLength(baseline);
    renderer.dispose();
  });

  it("destroys the previous label texts on rebuild and keeps one per visible label", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
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
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
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
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [labelText("a1", "Major", 1, 2, 90), labelText("a2", "Minor", 3, 4, 40)]));
    expect(fakeState.texts).toHaveLength(baseline + 1);
    expect(fakeState.texts[baseline]?.text).toBe("Major");
    renderer.dispose();
  });

  it("drops the remaining texts when labels are toggled off", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
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

describe("label sizing helpers (carreggiata)", () => {
  it("sizes a road label to 42% of the carriageway, clamped to 1.2-4 m", () => {
    expect(labelWorldHeightM({ kind: "road" }, 6)).toBeCloseTo(2.52, 10);
    expect(labelWorldHeightM({ kind: "road" }, 3.5)).toBeCloseTo(1.47, 10);
    expect(labelWorldHeightM({ kind: "road" }, 1)).toBe(1.2);
    expect(labelWorldHeightM({ kind: "road" }, 20)).toBe(4);
  });

  it("uses a fixed height for place labels and for roads without width data", () => {
    expect(labelWorldHeightM({ kind: "place" })).toBe(3);
    expect(labelWorldHeightM({ kind: "road" })).toBe(3);
  });

  it("fits the name within 80% of the road length, keeping the height fit otherwise", () => {
    // 128px design height: pure height fit, name short enough (10.24 m <= 16 m).
    expect(labelFitScale(512, 128, 2.56, 20)).toBeCloseTo(0.02, 10);
    // Name too long (20.48 m > 16 m): extra shrink to the 80% length budget.
    expect(labelFitScale(1024, 128, 2.56, 20)).toBeCloseTo(0.015625, 10);
    // Very short road: shrunk further (3.2 m budget on a 10.24 m name).
    expect(labelFitScale(512, 128, 2.56, 4)).toBeCloseTo(0.00625, 10);
    // No length data: height fit only.
    expect(labelFitScale(512, 128, 2.56, undefined)).toBeCloseTo(0.02, 10);
  });

  it("measures the centerline length in meters", () => {
    expect(polylineLengthMeters([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 3, y: 4 }])).toBe(7);
    expect(polylineLengthMeters([{ x: 0, y: 0 }])).toBe(0);
    expect(polylineLengthMeters([])).toBe(0);
  });
});

describe("label world scale (nitidezza e carreggiata)", () => {
  it("scales a road label to 42% of its road width (128px design raster)", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)], [roadFixture("a1", 6, 40)]));
    // 6 m road -> 2.52 m target height on a 128px raster -> scale 2.52/128.
    expect(fakeState.texts[baseline]?.scale.x).toBeCloseTo(2.52 / 128, 10);
    renderer.dispose();
  });

  it("scales a place label to the fixed 3 m height", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.setChunk(makeChunk("a", [placeLabel("park:1", "Parco", 1, 2, 105)]));
    expect(fakeState.texts[baseline]?.scale.x).toBeCloseTo(3 / 128, 10);
    renderer.dispose();
  });

  it("shrinks a long name so it stays on a short road", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    // "One" rasterizes to 192x128; on a 6 m x 4 m road the 3.78 m width
    // exceeds the 3.2 m (80%) budget and shrinks by 3.2/3.78.
    renderer.setChunk(makeChunk("a", [labelText("a1", "One", 1, 2, 90)], [roadFixture("a1", 6, 4)]));
    expect(fakeState.texts[baseline]?.scale.x).toBeCloseTo((2.52 / 128) * (3.2 / 3.78), 10);
    renderer.dispose();
  });
});

describe("label text key (un nome per via)", () => {
  it("trims and collapses whitespace, casefolds", () => {
    expect(labelTextKey("  Via   X ")).toBe("via x");
    expect(labelTextKey("VIALE Venticinque LUGLIO")).toBe("viale venticinque luglio");
  });

  it("keeps distinct names distinct", () => {
    expect(labelTextKey("Via X")).not.toBe(labelTextKey("Via Y"));
    expect(labelTextKey("Via X")).not.toBe(labelTextKey("Via X 2"));
  });

  it("maps empty or blank text to the empty key", () => {
    expect(labelTextKey("")).toBe("");
    expect(labelTextKey("   ")).toBe("");
  });
});

describe("label dedup across chunks", () => {
  it("keeps one copy per feature across chunks, nearest to the camera target wins", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.updateVehicle({ x: 10, y: 0 }, 0); // camera target
    renderer.setChunk(makeChunk("a", [labelText("osm:way:1000", "Via X", -100, 0, 90)]));
    renderer.setChunk(makeChunk("b", [labelText("osm:way:1000", "Via X", 20, 0, 90)]));
    const alive = fakeState.texts.slice(baseline).filter((text) => !text.destroyed);
    expect(alive).toHaveLength(1);
    // Chunk b's copy (x=20, distance 10) beats chunk a's (x=-100, distance 110);
    // world y is flipped (-label.position.y), so 0 may be -0 on screen.
    expect(alive[0]?.position.x).toBe(20);
    expect(alive[0]?.position.y).toBeCloseTo(0, 10);
    renderer.dispose();
  });

  it("unifies the per-chunk part copies of the same source way", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.updateVehicle({ x: 0, y: 0 }, 0);
    renderer.setChunk(makeChunk("a", [labelText("osm:way:1000:part:0", "Via X", -100, 0, 90)]));
    renderer.setChunk(makeChunk("b", [labelText("osm:way:1000:part:0", "Via X", 20, 0, 90)]));
    const alive = fakeState.texts.slice(baseline).filter((text) => !text.destroyed);
    expect(alive).toHaveLength(1);
    renderer.dispose();
  });

  it("keeps one label per street name across distinct features, nearest to the camera wins", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.updateVehicle({ x: 0, y: 0 }, 0);
    // A street compiled from two OSM ways (segments/dual carriageway) arrives
    // as two distinct features with the same name: one label may survive.
    renderer.setChunk(makeChunk("a", [labelText("osm:way:1000", "Via X", -100, 0, 90)]));
    renderer.setChunk(makeChunk("b", [labelText("osm:way:2000", "Via X", 20, 0, 90)]));
    const alive = fakeState.texts.slice(baseline).filter((text) => !text.destroyed);
    expect(alive).toHaveLength(1);
    // The copy at x=20 (distance 20) beats the one at x=-100 (distance 100).
    expect(alive[0]?.position.x).toBe(20);
    renderer.dispose();
  });

  it("unifies case-variant spellings of the same street name", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.updateVehicle({ x: 0, y: 0 }, 0);
    // OSM carries both "Viale venticinque luglio" and "Viale Venticinque
    // Luglio" for the same street: visually one name, one label.
    renderer.setChunk(makeChunk("a", [labelText("osm:way:1000", "Viale venticinque luglio", -100, 0, 90)]));
    renderer.setChunk(makeChunk("b", [labelText("osm:way:2000", "Viale Venticinque Luglio", 20, 0, 90)]));
    const alive = fakeState.texts.slice(baseline).filter((text) => !text.destroyed);
    expect(alive).toHaveLength(1);
    expect(alive[0]?.text).toBe("Viale Venticinque Luglio");
    renderer.dispose();
  });

  it("keeps distinct street names as separate labels", async () => {
    const renderer = await createPixiRenderer(canvas);
    const baseline = fakeState.texts.length; // no vehicle texts at init (taxi has no decals)
    renderer.toggleLabels();
    renderer.updateVehicle({ x: 0, y: 0 }, 0);
    renderer.setChunk(makeChunk("a", [labelText("osm:way:1000", "Via X", -100, 0, 90)]));
    renderer.setChunk(makeChunk("b", [labelText("osm:way:2000", "Via Y", 20, 0, 90)]));
    const alive = fakeState.texts.slice(baseline).filter((text) => !text.destroyed);
    expect(alive).toHaveLength(2);
    renderer.dispose();
  });
});
