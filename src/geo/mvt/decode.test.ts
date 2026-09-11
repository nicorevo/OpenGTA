import { describe, expect, it } from "vitest";
import { TileSourceError } from "./errors.ts";
import { decodeVectorTile } from "./decode.ts";

type Point = readonly [number, number];

const encoder = new TextEncoder();

function varint(value: number): number[] {
  const bytes: number[] = [];
  let rest = value;
  do {
    const byte = rest % 128;
    rest = Math.floor(rest / 128);
    bytes.push(rest > 0 ? byte + 128 : byte);
  } while (rest > 0);
  return bytes;
}

function zigzag(value: number): number {
  return value < 0 ? -value * 2 - 1 : value * 2;
}

function key(field: number, wire: number): number[] {
  return varint(field * 8 + wire);
}

function scalar(field: number, value: number): number[] {
  return [...key(field, 0), ...varint(value)];
}

function blob(field: number, payload: readonly number[]): number[] {
  return [...key(field, 2), ...varint(payload.length), ...payload];
}

function packed(field: number, values: readonly number[]): number[] {
  return blob(field, values.flatMap(varint));
}

function text(value: string): number[] {
  return [...encoder.encode(value)];
}

class Geometry {
  private readonly commands: number[] = [];
  private x = 0;
  private y = 0;

  moveTo(...points: readonly Point[]): this {
    return this.push(1, points);
  }

  lineTo(...points: readonly Point[]): this {
    return this.push(2, points);
  }

  /** Spec-compliant polygon ring: MoveTo with count 1, then LineTo, then ClosePath. */
  ring(...points: readonly Point[]): this {
    const [first, ...rest] = points;
    if (first === undefined) throw new Error("a ring needs at least one point");
    this.moveTo(first);
    if (rest.length > 0) this.lineTo(...rest);
    return this.closePath();
  }

  closePath(): this {
    this.commands.push(7 + (1 << 3));
    return this;
  }

  toArray(): number[] {
    return [...this.commands];
  }

  private push(command: number, points: readonly Point[]): this {
    this.commands.push(command + (points.length << 3));
    for (const point of points) {
      this.commands.push(zigzag(point[0] - this.x), zigzag(point[1] - this.y));
      this.x = point[0];
      this.y = point[1];
    }
    return this;
  }
}

interface TestFeature {
  readonly id?: number;
  readonly tags?: readonly number[];
  readonly type: number;
  readonly geometry: readonly number[];
}

interface TestLayer {
  readonly name: string;
  readonly version?: number;
  readonly extent?: number;
  readonly keys?: readonly string[];
  readonly values?: readonly (string | number | boolean)[];
  readonly features: readonly TestFeature[];
}

function fixed(field: number, wire: number, set: (view: DataView) => void): number[] {
  const buffer = new ArrayBuffer(wire === 1 ? 8 : 4);
  const view = new DataView(buffer);
  set(view);
  return [...key(field, wire), ...new Uint8Array(buffer)];
}

function valueBytes(value: string | number | boolean): number[] {
  if (typeof value === "string") return blob(1, text(value));
  if (typeof value === "boolean") return scalar(7, value ? 1 : 0);
  if (Number.isInteger(value)) return value < 0 ? scalar(6, zigzag(value)) : scalar(4, value);
  return fixed(3, 1, (view) => view.setFloat64(0, value, true));
}

function featureBytes(feature: TestFeature): number[] {
  const bytes: number[] = [];
  if (feature.id !== undefined) bytes.push(...scalar(1, feature.id));
  if (feature.tags !== undefined) bytes.push(...packed(2, feature.tags));
  bytes.push(...scalar(3, feature.type));
  bytes.push(...packed(4, feature.geometry));
  return bytes;
}

function layerBytes(layer: TestLayer): number[] {
  const bytes: number[] = [...blob(1, text(layer.name))];
  for (const feature of layer.features) bytes.push(...blob(2, featureBytes(feature)));
  for (const name of layer.keys ?? []) bytes.push(...blob(3, text(name)));
  for (const value of layer.values ?? []) bytes.push(...blob(4, valueBytes(value)));
  bytes.push(...scalar(5, layer.extent ?? 4096));
  bytes.push(...scalar(15, layer.version ?? 2));
  return bytes;
}

function tileBytes(layers: readonly TestLayer[]): Uint8Array {
  return new Uint8Array(layers.flatMap((layer) => blob(3, layerBytes(layer))));
}

const POINT = 1;
const LINE = 2;
const POLYGON = 3;

function square(x: number, y: number, size: number): Point[] {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
  ];
}

function pointLayer(): TestLayer {
  return {
    name: "poi",
    keys: ["class", "name"],
    values: ["restaurant", "Trattoria"],
    features: [
      { id: 7, tags: [0, 0, 1, 1], type: POINT, geometry: new Geometry().moveTo([2048, 1024]).toArray() },
      { tags: [0, 0], type: POINT, geometry: new Geometry().moveTo([10, 20], [30, 40]).toArray() },
    ],
  };
}

describe("decodeVectorTile", () => {
  it("decodes point features with properties and ids", () => {
    const tile = decodeVectorTile(tileBytes([pointLayer()]));
    expect(tile.layerCount).toBe(1);
    expect(tile.featureCount).toBe(2);
    const layer = tile.layers[0];
    expect(layer.name).toBe("poi");
    expect(layer.version).toBe(2);
    expect(layer.extent).toBe(4096);
    expect(layer.features[0].id).toBe(7);
    expect(layer.features[0].properties).toEqual({ class: "restaurant", name: "Trattoria" });
    expect(layer.features[0].geometry).toEqual({ type: "point", points: [{ x: 2048, y: 1024 }] });
    expect(layer.features[1].id).toBeUndefined();
    expect(layer.features[1].properties).toEqual({ class: "restaurant" });
    expect(layer.features[1].geometry).toEqual({ type: "point", points: [{ x: 10, y: 20 }, { x: 30, y: 40 }] });
  });

  it("resolves properties declared after the features in the byte stream", () => {
    const [feature] = pointLayer().features;
    const bytes = new Uint8Array([
      ...blob(3, [
        ...blob(1, text("poi")),
        ...blob(2, featureBytes(feature)),
        ...blob(3, text("class")),
        ...blob(3, text("name")),
        ...blob(4, valueBytes("restaurant")),
        ...blob(4, valueBytes("Trattoria")),
      ]),
    ]);
    expect(decodeVectorTile(bytes).layers[0].features[0].properties).toEqual({ class: "restaurant", name: "Trattoria" });
  });

  it("decodes line features with several parts", () => {
    const geometry = new Geometry()
      .moveTo([0, 0])
      .lineTo([100, 0], [100, 100])
      .moveTo([500, 500])
      .lineTo([600, 600], [700, 500], [800, 600]);
    const tile = decodeVectorTile(tileBytes([{ name: "transportation", features: [{ type: LINE, geometry: geometry.toArray() }] }]));
    expect(tile.layers[0].features[0].geometry).toEqual({
      type: "line",
      lines: [
        [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
        [{ x: 500, y: 500 }, { x: 600, y: 600 }, { x: 700, y: 500 }, { x: 800, y: 600 }],
      ],
    });
  });

  it("closes polygon rings and assigns holes to their exterior", () => {
    const geometry = new Geometry().ring(...square(0, 0, 100)).ring([20, 20], [20, 80], [80, 80], [80, 20]);
    const tile = decodeVectorTile(tileBytes([{ name: "building", features: [{ type: POLYGON, geometry: geometry.toArray() }] }]));
    const geometryResult = tile.layers[0].features[0].geometry;
    expect(geometryResult.type).toBe("polygon");
    if (geometryResult.type !== "polygon") throw new Error("unreachable");
    expect(geometryResult.polygons).toHaveLength(1);
    expect(geometryResult.polygons[0].exterior).toEqual([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
      { x: 0, y: 0 },
    ]);
    expect(geometryResult.polygons[0].holes).toHaveLength(1);
    expect(geometryResult.polygons[0].holes[0]).toHaveLength(5);
    expect(geometryResult.polygons[0].holes[0][0]).toEqual({ x: 20, y: 20 });
    expect(geometryResult.polygons[0].holes[0][4]).toEqual({ x: 20, y: 20 });
  });

  it("splits several exterior rings into a multipolygon", () => {
    const geometry = new Geometry().ring(...square(0, 0, 10)).ring(...square(100, 100, 10));
    const tile = decodeVectorTile(tileBytes([{ name: "building", features: [{ type: POLYGON, geometry: geometry.toArray() }] }]));
    const decoded = tile.layers[0].features[0].geometry;
    if (decoded.type !== "polygon") throw new Error("unreachable");
    expect(decoded.polygons).toHaveLength(2);
    expect(decoded.polygons[0].holes).toHaveLength(0);
    expect(decoded.polygons[1].holes).toHaveLength(0);
  });

  it("decodes every property value type without NaN or Infinity", () => {
    const layer: TestLayer = {
      name: "poi",
      keys: ["name", "rank", "height", "area", "oneway", "delta"],
      values: ["bar", 42, 3.5, 7.25, true, -3],
      features: [{ tags: [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], type: POINT, geometry: new Geometry().moveTo([0, 0]).toArray() }],
    };
    const feature = decodeVectorTile(tileBytes([layer])).layers[0].features[0];
    expect(feature.properties).toEqual({ name: "bar", rank: 42, height: 3.5, area: 7.25, oneway: true, delta: -3 });
    for (const value of Object.values(feature.properties)) {
      if (typeof value === "number") expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("decodes a float32 property value", () => {
    const bytes = new Uint8Array([
      ...blob(3, [
        ...blob(1, text("poi")),
        ...blob(2, featureBytes({ tags: [0, 0], type: POINT, geometry: new Geometry().moveTo([0, 0]).toArray() })),
        ...blob(3, text("slope")),
        ...blob(4, fixed(2, 5, (view) => view.setFloat32(0, 1.5, true))),
      ]),
    ]);
    expect(decodeVectorTile(bytes).layers[0].features[0].properties).toEqual({ slope: 1.5 });
  });

  it("keeps feature order, layer order and lets later duplicate keys win", () => {
    const tile = decodeVectorTile(tileBytes([
      { name: "water", keys: ["class"], values: ["lake", "river"], features: [{ type: POINT, geometry: new Geometry().moveTo([0, 0]).toArray(), tags: [0, 0, 0, 1] }] },
      { name: "place", features: [] },
    ]));
    expect(tile.layers.map((layer) => layer.name)).toEqual(["water", "place"]);
    expect(tile.layers[0].features[0].properties).toEqual({ class: "river" });
    expect(tile.layers[1].features).toHaveLength(0);
    expect(tile.featureCount).toBe(1);
  });

  it("treats an empty payload as an empty tile", () => {
    const tile = decodeVectorTile(new Uint8Array(0));
    expect(tile.layers).toHaveLength(0);
    expect(tile.layerCount).toBe(0);
    expect(tile.featureCount).toBe(0);
    expect(tile.byteLength).toBe(0);
  });

  it("skips features with an unknown geometry type", () => {
    const tile = decodeVectorTile(tileBytes([{ name: "poi", features: [{ type: 0, geometry: new Geometry().moveTo([1, 1]).toArray() }] }]));
    expect(tile.layers[0].features).toHaveLength(0);
    expect(tile.featureCount).toBe(0);
  });

  it("decodes coordinates outside the tile extent used as buffer", () => {
    const geometry = new Geometry().moveTo([-300, 4200]).lineTo([4500, -200]);
    const tile = decodeVectorTile(tileBytes([{ name: "transportation", features: [{ type: LINE, geometry: geometry.toArray() }] }]));
    expect(tile.layers[0].features[0].geometry).toEqual({
      type: "line",
      lines: [[{ x: -300, y: 4200 }, { x: 4500, y: -200 }]],
    });
  });
});

describe("decodeVectorTile malformed input", () => {
  function expectInvalidTile(bytes: Uint8Array): void {
    let thrown: unknown;
    try {
      decodeVectorTile(bytes);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(TileSourceError);
    expect((thrown as TileSourceError).code).toBe("invalid-tile");
    expect((thrown as TileSourceError).name).toBe("TileSourceError");
    expect((thrown as TileSourceError).message.length).toBeGreaterThan(0);
  }

  it("rejects truncated and unexpected top level bytes", () => {
    expectInvalidTile(new Uint8Array([0x1a, 0x80]));
    expectInvalidTile(new Uint8Array([0x1a, 0x20, 0x0a]));
    expectInvalidTile(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01]));
    expectInvalidTile(new Uint8Array([0x1b, 0x0c]));
  });

  it("rejects layers that violate the MVT schema", () => {
    expectInvalidTile(new Uint8Array(blob(3, [...scalar(15, 2)])));
    expectInvalidTile(new Uint8Array(blob(3, [...blob(1, text("water")), ...scalar(15, 3)])));
    expectInvalidTile(new Uint8Array(blob(3, [...blob(1, text("water")), ...scalar(5, 0)])));
    expectInvalidTile(new Uint8Array(blob(3, [...blob(1, text("water")), ...blob(1, [0xff, 0xfe])])));
    expectInvalidTile(new Uint8Array(blob(3, [...blob(1, text("water")), ...key(9, 6)])));
  });

  it("rejects features with inconsistent tags", () => {
    const oddTags = new Uint8Array(tileBytes([{ name: "poi", keys: ["class"], values: ["bar"], features: [{ type: POINT, tags: [0], geometry: new Geometry().moveTo([0, 0]).toArray() }] }]));
    expectInvalidTile(oddTags);
    const unknownKey = new Uint8Array(tileBytes([{ name: "poi", keys: ["class"], values: ["bar"], features: [{ type: POINT, tags: [4, 0], geometry: new Geometry().moveTo([0, 0]).toArray() }] }]));
    expectInvalidTile(unknownKey);
    const unknownValue = new Uint8Array(tileBytes([{ name: "poi", keys: ["class"], values: ["bar"], features: [{ type: POINT, tags: [0, 9], geometry: new Geometry().moveTo([0, 0]).toArray() }] }]));
    expectInvalidTile(unknownValue);
  });

  it("rejects invalid geometry command streams", () => {
    const lineToFirst = new Uint8Array(tileBytes([{ name: "transportation", features: [{ type: LINE, geometry: new Geometry().lineTo([10, 10]).toArray() }] }]));
    expectInvalidTile(lineToFirst);
    const emptyMoveTo = new Uint8Array(tileBytes([{ name: "poi", features: [{ type: POINT, geometry: [1] }] }]));
    expectInvalidTile(emptyMoveTo);
    const closedLine = new Uint8Array(tileBytes([{ name: "transportation", features: [{ type: LINE, geometry: new Geometry().moveTo([0, 0]).lineTo([5, 5]).closePath().toArray() }] }]));
    expectInvalidTile(closedLine);
    const unclosedPolygon = new Uint8Array(tileBytes([{ name: "building", features: [{ type: POLYGON, geometry: new Geometry().moveTo([0, 0]).lineTo([10, 0], [10, 10], [0, 10]).toArray() }] }]));
    expectInvalidTile(unclosedPolygon);
    const stretchedMoveTo = new Uint8Array(tileBytes([{ name: "building", features: [{ type: POLYGON, geometry: new Geometry().moveTo(...square(0, 0, 10)).closePath().toArray() }] }]));
    expectInvalidTile(stretchedMoveTo);
    const holeFirst = new Uint8Array(tileBytes([{ name: "building", features: [{ type: POLYGON, geometry: new Geometry().ring([20, 20], [20, 80], [80, 80], [80, 20]).ring(...square(0, 0, 100)).toArray() }] }]));
    expectInvalidTile(holeFirst);
    const unknownCommand = new Uint8Array(tileBytes([{ name: "poi", features: [{ type: POINT, geometry: new Geometry().moveTo([0, 0]).toArray().concat([5 + (1 << 3), 0]) }] }]));
    expectInvalidTile(unknownCommand);
    const truncatedGeometry = new Uint8Array(tileBytes([{ name: "poi", features: [{ type: POINT, geometry: [1 + (2 << 3), 4] }] }]));
    expectInvalidTile(truncatedGeometry);
  });
});

describe("decodeVectorTile limits and abort", () => {
  function bigPointLayer(features: number): TestLayer {
    return {
      name: "poi",
      features: Array.from({ length: features }, (_, index) => ({ id: index + 1, type: POINT, geometry: new Geometry().moveTo([index, index]).toArray() })),
    };
  }

  it("rejects a payload larger than the byte budget", () => {
    const bytes = tileBytes([pointLayer()]);
    expect(() => decodeVectorTile(bytes, { maxBytes: bytes.byteLength - 1 })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "response-too-large" }),
    );
    expect(decodeVectorTile(bytes, { maxBytes: bytes.byteLength }).layerCount).toBe(1);
  });

  it("rejects tiles with too many features", () => {
    const bytes = tileBytes([bigPointLayer(4)]);
    expect(() => decodeVectorTile(bytes, { maxFeatures: 3 })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "response-too-large" }),
    );
    expect(decodeVectorTile(bytes, { maxFeatures: 4 }).featureCount).toBe(4);
  });

  it("counts skipped features against the feature budget", () => {
    const bytes = tileBytes([{ name: "poi", features: Array.from({ length: 4 }, () => ({ type: 0, geometry: new Geometry().moveTo([0, 0]).toArray() })) }]);
    expect(() => decodeVectorTile(bytes, { maxFeatures: 3 })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "response-too-large" }),
    );
    expect(decodeVectorTile(bytes, { maxFeatures: 4 }).featureCount).toBe(0);
  });

  it("rejects geometries with too many points", () => {
    const geometry = new Geometry().moveTo([0, 0]).lineTo([1, 1], [2, 2], [3, 3]);
    const bytes = tileBytes([{ name: "transportation", features: [{ type: LINE, geometry: geometry.toArray() }] }]);
    expect(() => decodeVectorTile(bytes, { maxPointsPerGeometry: 3 })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "response-too-large" }),
    );
    expect(decodeVectorTile(bytes, { maxPointsPerGeometry: 4 }).featureCount).toBe(1);
  });

  it("rejects features with too many properties", () => {
    const bytes = tileBytes([{ name: "poi", keys: ["a", "b"], values: ["x", "y"], features: [{ type: POINT, tags: [0, 0, 1, 1], geometry: new Geometry().moveTo([0, 0]).toArray() }] }]);
    expect(() => decodeVectorTile(bytes, { maxProperties: 1 })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "response-too-large" }),
    );
    expect(decodeVectorTile(bytes, { maxProperties: 2 }).layers[0].features[0].properties).toEqual({ a: "x", b: "y" });
  });

  it("rejects tiles with too many layers", () => {
    const bytes = tileBytes([{ name: "water", features: [] }, { name: "place", features: [] }]);
    expect(() => decodeVectorTile(bytes, { maxLayers: 1 })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "response-too-large" }),
    );
    expect(decodeVectorTile(bytes, { maxLayers: 2 }).layerCount).toBe(2);
  });

  it("rejects invalid limit options", () => {
    const bytes = tileBytes([pointLayer()]);
    for (const options of [{ maxBytes: 0 }, { maxBytes: -1 }, { maxBytes: 1.5 }, { maxFeatures: 0 }, { maxPointsPerGeometry: -8 }, { maxProperties: Number.NaN }, { maxLayers: 0 }]) {
      expect(() => decodeVectorTile(bytes, options)).toThrow(RangeError);
    }
  });

  it("reports an already aborted signal and stops on abort during decoding", () => {
    const bytes = tileBytes([bigPointLayer(4)]);
    expect(() => decodeVectorTile(bytes, { signal: AbortSignal.abort() })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "aborted" }),
    );
    let reads = 0;
    const signal = {
      get aborted(): boolean {
        reads += 1;
        return reads > 1;
      },
    } as unknown as AbortSignal;
    expect(() => decodeVectorTile(bytes, { signal })).toThrow(
      expect.objectContaining({ name: "TileSourceError", code: "aborted" }),
    );
    expect(reads).toBeGreaterThan(1);
  });
});
