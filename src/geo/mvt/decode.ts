/**
 * Internal, bounded PBF/MVT decoder (contract C-MVT).
 *
 * The decoder is project-owned on purpose: no external MVT library, no renderer
 * dependency, no decoder object leaking outside this module. Tiles are
 * untrusted input (SECURITY.md, migration document sections 49-51), so every
 * budget is enforced while reading:
 *
 * - tile bytes (default 8 MiB)                -> response-too-large
 * - declared features per tile (default 10 000; a feature skipped because its
 *   geometry type is unknown still counts against the budget)
 *                                             -> response-too-large
 * - points per geometry (default 50 000)      -> response-too-large
 * - properties per feature (default 256)      -> response-too-large
 * - layers per tile (default 64)              -> response-too-large
 * - structural/protobuf/MVT violations        -> invalid-tile
 * - AbortSignal cancelled before or during    -> aborted
 *
 * Decoded geometry stays in tile-local units (`0..extent` plus buffer) and is
 * finite by construction: overflow of the accumulated coordinates is rejected.
 * Polygon rings are closed (first point repeated at the end) and interior rings
 * are attached to the exterior ring they follow, following the MVT winding
 * rule (positive shoelace area in tile coordinates = exterior).
 */
import { TileSourceError } from "./errors.ts";
import { DEFAULT_TILE_EXTENT, type TilePoint } from "./math.ts";

export const DEFAULT_MAX_TILE_BYTES = 8 * 1024 * 1024;
export const DEFAULT_MAX_FEATURES_PER_TILE = 10_000;
export const DEFAULT_MAX_POINTS_PER_GEOMETRY = 50_000;
export const DEFAULT_MAX_PROPERTIES_PER_FEATURE = 256;
export const DEFAULT_MAX_LAYERS_PER_TILE = 64;

const POINT_GEOMETRY = 1;
const LINE_GEOMETRY = 2;
const POLYGON_GEOMETRY = 3;

const MOVE_TO = 1;
const LINE_TO = 2;
const CLOSE_PATH = 7;

const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

const MAX_VARINT_BYTES = 10;

export type DecodedPropertyValue = string | number | boolean;

export interface DecodedPointGeometry {
  readonly type: "point";
  readonly points: readonly TilePoint[];
}

export interface DecodedLineGeometry {
  readonly type: "line";
  readonly lines: readonly (readonly TilePoint[])[];
}

export interface DecodedPolygon {
  readonly exterior: readonly TilePoint[];
  readonly holes: readonly (readonly TilePoint[])[];
}

export interface DecodedPolygonGeometry {
  readonly type: "polygon";
  readonly polygons: readonly DecodedPolygon[];
}

export type DecodedGeometry = DecodedPointGeometry | DecodedLineGeometry | DecodedPolygonGeometry;

export interface DecodedVectorFeature {
  readonly layer: string;
  readonly id: number | undefined;
  readonly properties: Readonly<Record<string, DecodedPropertyValue>>;
  readonly geometry: DecodedGeometry;
}

export interface DecodedVectorLayer {
  readonly name: string;
  readonly version: number;
  readonly extent: number;
  readonly features: readonly DecodedVectorFeature[];
}

export interface DecodedVectorTile {
  readonly byteLength: number;
  readonly layerCount: number;
  readonly featureCount: number;
  readonly layers: readonly DecodedVectorLayer[];
}

export interface DecodeVectorTileOptions {
  /** Byte budget of the whole tile. Defaults to {@link DEFAULT_MAX_TILE_BYTES}. */
  readonly maxBytes?: number;
  /** Feature budget of the whole tile. Defaults to {@link DEFAULT_MAX_FEATURES_PER_TILE}. */
  readonly maxFeatures?: number;
  /** Point budget of a single feature geometry. Defaults to {@link DEFAULT_MAX_POINTS_PER_GEOMETRY}. */
  readonly maxPointsPerGeometry?: number;
  /** Property budget of a single feature. Defaults to {@link DEFAULT_MAX_PROPERTIES_PER_FEATURE}. */
  readonly maxProperties?: number;
  /** Layer budget of the whole tile. Defaults to {@link DEFAULT_MAX_LAYERS_PER_TILE}. */
  readonly maxLayers?: number;
  /** Cancellation signal, checked before and inside every decode loop. */
  readonly signal?: AbortSignal;
}

interface Limits {
  readonly maxBytes: number;
  readonly maxFeatures: number;
  readonly maxPointsPerGeometry: number;
  readonly maxProperties: number;
  readonly maxLayers: number;
}

interface RawFeature {
  readonly id: number | undefined;
  readonly tags: readonly number[];
  readonly type: number;
  readonly geometry: PbReader | undefined;
}

interface RawLayer {
  name: string | undefined;
  version: number;
  extent: number;
  readonly keys: string[];
  readonly values: DecodedPropertyValue[];
  readonly features: RawFeature[];
}

const textDecoder = new TextDecoder("utf-8", { fatal: true });

function invalid(message: string, cause?: unknown): TileSourceError {
  return new TileSourceError("invalid-tile", message, cause);
}

function tooLarge(message: string): TileSourceError {
  return new TileSourceError("response-too-large", message);
}

/** Checked at every loop boundary so a cancelled decode stops the work. */
function checkAborted(signal: AbortSignal | undefined): void {
  if (signal !== undefined && signal.aborted) throw new TileSourceError("aborted", "MVT tile decode aborted");
}

/** Reader over a protobuf byte range. Instances never leave this module. */
class PbReader {
  private offset: number;

  constructor(
    private readonly bytes: Uint8Array,
    private readonly view: DataView,
    private readonly limit: number,
    offset = 0,
  ) {
    this.offset = offset;
  }

  static over(bytes: Uint8Array, limit: number): PbReader {
    return new PbReader(bytes, new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), limit);
  }

  get done(): boolean {
    return this.offset >= this.limit;
  }

  varint(): number {
    let result = 0;
    let shift = 0;
    for (let index = 0; index < MAX_VARINT_BYTES; index += 1) {
      if (this.offset >= this.limit) throw invalid("truncated varint");
      const byte = this.bytes[this.offset];
      this.offset += 1;
      result += (byte % 128) * 2 ** shift;
      if (byte < 128) {
        if (!Number.isFinite(result)) throw invalid("varint out of range");
        return result;
      }
      shift += 7;
    }
    throw invalid("varint exceeds 10 bytes");
  }

  /** Reads a length-delimited field and returns a reader limited to its payload. */
  bytesField(): PbReader {
    const length = this.varint();
    if (!Number.isSafeInteger(length) || length > this.limit - this.offset) {
      throw invalid("length-delimited field exceeds the tile buffer");
    }
    const start = this.offset;
    this.offset += length;
    return new PbReader(this.bytes, this.view, start + length, start);
  }

  stringField(): string {
    const length = this.varint();
    if (!Number.isSafeInteger(length) || length > this.limit - this.offset) {
      throw invalid("string field exceeds the tile buffer");
    }
    const start = this.offset;
    this.offset += length;
    try {
      return textDecoder.decode(this.bytes.subarray(start, start + length));
    } catch (cause) {
      throw invalid("string field is not valid UTF-8", cause);
    }
  }

  float32Field(): number {
    this.advance(4);
    return this.view.getFloat32(this.offset - 4, true);
  }

  float64Field(): number {
    this.advance(8);
    return this.view.getFloat64(this.offset - 8, true);
  }

  skip(wire: number): void {
    if (wire === WIRE_VARINT) {
      this.varint();
      return;
    }
    if (wire === WIRE_FIXED64) {
      this.advance(8);
      return;
    }
    if (wire === WIRE_BYTES) {
      this.advance(this.varint());
      return;
    }
    if (wire === WIRE_FIXED32) {
      this.advance(4);
      return;
    }
    throw invalid(`unsupported protobuf wire type ${wire}`);
  }

  private advance(count: number): void {
    if (!Number.isSafeInteger(count) || count < 0 || count > this.limit - this.offset) {
      throw invalid("field exceeds the tile buffer");
    }
    this.offset += count;
  }
}

function readFieldKey(reader: PbReader): { readonly field: number; readonly wire: number } {
  const key = reader.varint();
  const wire = key % 8;
  return { field: (key - wire) / 8, wire };
}

function readZigZag(reader: PbReader): number {
  const raw = reader.varint();
  return raw % 2 === 1 ? -(raw + 1) / 2 : raw / 2;
}

function requireLimit(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer`);
  return value;
}

function resolveLimits(options: DecodeVectorTileOptions): Limits {
  return {
    maxBytes: requireLimit(options.maxBytes, DEFAULT_MAX_TILE_BYTES, "maxBytes"),
    maxFeatures: requireLimit(options.maxFeatures, DEFAULT_MAX_FEATURES_PER_TILE, "maxFeatures"),
    maxPointsPerGeometry: requireLimit(options.maxPointsPerGeometry, DEFAULT_MAX_POINTS_PER_GEOMETRY, "maxPointsPerGeometry"),
    maxProperties: requireLimit(options.maxProperties, DEFAULT_MAX_PROPERTIES_PER_FEATURE, "maxProperties"),
    maxLayers: requireLimit(options.maxLayers, DEFAULT_MAX_LAYERS_PER_TILE, "maxLayers"),
  };
}

function parseValue(reader: PbReader, signal: AbortSignal | undefined): DecodedPropertyValue {
  let value: DecodedPropertyValue | undefined;
  while (!reader.done) {
    checkAborted(signal);
    const { field, wire } = readFieldKey(reader);
    if (field === 1 && wire === WIRE_BYTES) value = reader.stringField();
    else if (field === 2 && wire === WIRE_FIXED32) value = reader.float32Field();
    else if (field === 3 && wire === WIRE_FIXED64) value = reader.float64Field();
    else if (field === 4 && wire === WIRE_VARINT) {
      const raw = reader.varint();
      value = raw >= 2 ** 63 ? raw - 2 ** 64 : raw;
    } else if (field === 5 && wire === WIRE_VARINT) value = reader.varint();
    else if (field === 6 && wire === WIRE_VARINT) value = readZigZag(reader);
    else if (field === 7 && wire === WIRE_VARINT) value = reader.varint() !== 0;
    else reader.skip(wire);
  }
  if (value === undefined) throw invalid("MVT value message without a value");
  if (typeof value === "number" && !Number.isFinite(value)) throw invalid("non-finite MVT value");
  return value;
}

function readPacked(reader: PbReader, budget: number, message: string): number[] {
  const values: number[] = [];
  while (!reader.done) {
    values.push(reader.varint());
    if (values.length > budget) throw tooLarge(message);
  }
  return values;
}

function parseFeature(reader: PbReader, limits: Limits, signal: AbortSignal | undefined): RawFeature {
  let id: number | undefined;
  let tags: number[] = [];
  let type = 0;
  let geometry: PbReader | undefined;
  while (!reader.done) {
    checkAborted(signal);
    const { field, wire } = readFieldKey(reader);
    if (field === 1 && wire === WIRE_VARINT) id = reader.varint();
    else if (field === 2 && wire === WIRE_BYTES) tags = readPacked(reader.bytesField(), limits.maxProperties * 2, "feature exceeds the property budget");
    else if (field === 2 && wire === WIRE_VARINT) {
      if (tags.length >= limits.maxProperties * 2) throw tooLarge("feature exceeds the property budget");
      tags.push(reader.varint());
    } else if (field === 3 && wire === WIRE_VARINT) type = reader.varint();
    else if (field === 4 && wire === WIRE_BYTES) geometry = reader.bytesField();
    else reader.skip(wire);
  }
  return { id, tags, type, geometry };
}

function parseLayer(reader: PbReader, limits: Limits, signal: AbortSignal | undefined, countedFeatures: number): RawLayer {
  const layer: RawLayer = { name: undefined, version: 1, extent: DEFAULT_TILE_EXTENT, keys: [], values: [], features: [] };
  while (!reader.done) {
    checkAborted(signal);
    const { field, wire } = readFieldKey(reader);
    if (field === 1 && wire === WIRE_BYTES) layer.name = reader.stringField();
    else if (field === 2 && wire === WIRE_BYTES) {
      if (countedFeatures + layer.features.length >= limits.maxFeatures) throw tooLarge("tile exceeds the feature budget");
      layer.features.push(parseFeature(reader.bytesField(), limits, signal));
    } else if (field === 3 && wire === WIRE_BYTES) layer.keys.push(reader.stringField());
    else if (field === 4 && wire === WIRE_BYTES) layer.values.push(parseValue(reader.bytesField(), signal));
    else if (field === 5 && wire === WIRE_VARINT) layer.extent = reader.varint();
    else if (field === 15 && wire === WIRE_VARINT) layer.version = reader.varint();
    else reader.skip(wire);
  }
  return layer;
}

function signedArea(ring: readonly TilePoint[]): number {
  let doubled = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    doubled += current.x * next.y - next.x * current.y;
  }
  return doubled / 2;
}

function closeRing(ring: readonly TilePoint[]): readonly TilePoint[] {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first.x === last.x && first.y === last.y) return ring;
  return [...ring, first];
}

function decodeGeometry(reader: PbReader, type: number, limits: Limits, signal: AbortSignal | undefined): DecodedGeometry {
  let x = 0;
  let y = 0;
  let pointCount = 0;
  const points: TilePoint[] = [];
  const lines: TilePoint[][] = [];
  const rings: TilePoint[][] = [];
  let current: TilePoint[] | undefined;

  while (!reader.done) {
    checkAborted(signal);
    const command = reader.varint();
    const id = command % 8;
    const count = Math.floor(command / 8);
    if (id === MOVE_TO || id === LINE_TO) {
      if (count <= 0) throw invalid("geometry command with a zero count");
      pointCount += count;
      if (pointCount > limits.maxPointsPerGeometry) throw tooLarge("geometry exceeds the point budget");
      if (id === MOVE_TO) {
        if (type === POINT_GEOMETRY) {
          for (let index = 0; index < count; index += 1) {
            ({ x, y } = advancePoint(reader, x, y));
            points.push({ x, y });
          }
          continue;
        }
        if (count !== 1) throw invalid("MoveTo command with a count greater than 1");
        ({ x, y } = advancePoint(reader, x, y));
        if (current !== undefined) {
          if (type === LINE_GEOMETRY) lines.push(current);
          else throw invalid("polygon ring without a ClosePath");
        }
        current = [{ x, y }];
        continue;
      }
      if (current === undefined) throw invalid("LineTo command without a MoveTo");
      for (let index = 0; index < count; index += 1) {
        ({ x, y } = advancePoint(reader, x, y));
        current.push({ x, y });
      }
    } else if (id === CLOSE_PATH) {
      if (count !== 1) throw invalid("ClosePath command with a count different from 1");
      if (type !== POLYGON_GEOMETRY) throw invalid("ClosePath command outside a polygon feature");
      if (current === undefined || current.length < 3) throw invalid("polygon ring with fewer than 3 points");
      rings.push(current);
      current = undefined;
    } else {
      throw invalid(`unknown geometry command ${id}`);
    }
  }

  if (type === POINT_GEOMETRY) {
    if (points.length === 0) throw invalid("point geometry without points");
    return { type: "point", points };
  }
  if (type === LINE_GEOMETRY) {
    if (current !== undefined) lines.push(current);
    if (lines.length === 0) throw invalid("line geometry without parts");
    for (const line of lines) {
      if (line.length < 2) throw invalid("linestring with fewer than 2 points");
    }
    return { type: "line", lines };
  }
  if (current !== undefined || rings.length === 0) throw invalid("polygon geometry has an unclosed ring");
  const polygons: { readonly exterior: readonly TilePoint[]; readonly holes: (readonly TilePoint[])[] }[] = [];
  for (const ring of rings) {
    const closed = closeRing(ring);
    // A degenerate (zero area) ring is kept as its own exterior instead of
    // being silently dropped: the canonical layer decides what to do with it.
    if (signedArea(closed) >= 0) {
      polygons.push({ exterior: closed, holes: [] });
      continue;
    }
    const outer = polygons[polygons.length - 1];
    if (outer === undefined) throw invalid("polygon hole before its exterior ring");
    outer.holes.push(closed);
  }
  return { type: "polygon", polygons };
}

function advancePoint(reader: PbReader, x: number, y: number): { readonly x: number; readonly y: number } {
  const nextX = x + readZigZag(reader);
  const nextY = y + readZigZag(reader);
  if (!Number.isSafeInteger(nextX) || !Number.isSafeInteger(nextY)) throw invalid("geometry coordinate out of range");
  return { x: nextX, y: nextY };
}

function resolveProperties(raw: RawFeature, layer: RawLayer, limits: Limits): Readonly<Record<string, DecodedPropertyValue>> {
  if (raw.tags.length % 2 !== 0) throw invalid("feature tags are not key/value pairs");
  const propertyCount = raw.tags.length / 2;
  if (propertyCount > limits.maxProperties) throw tooLarge("feature exceeds the property budget");
  const properties: Record<string, DecodedPropertyValue> = {};
  for (let index = 0; index < propertyCount; index += 1) {
    const key = layer.keys[raw.tags[index * 2]];
    const value = layer.values[raw.tags[index * 2 + 1]];
    if (key === undefined) throw invalid("feature tag references an unknown key");
    if (value === undefined) throw invalid("feature tag references an unknown value");
    properties[key] = value;
  }
  return properties;
}

function buildLayer(raw: RawLayer, limits: Limits, signal: AbortSignal | undefined): DecodedVectorLayer {
  if (raw.name === undefined || raw.name.length === 0) throw invalid("MVT layer without a name");
  if (raw.version !== 1 && raw.version !== 2) throw invalid(`unsupported MVT layer version ${raw.version}`);
  if (!Number.isSafeInteger(raw.extent) || raw.extent <= 0) throw invalid("MVT layer with an invalid extent");
  const features: DecodedVectorFeature[] = [];
  for (const rawFeature of raw.features) {
    checkAborted(signal);
    if (rawFeature.type === 0) continue;
    if (rawFeature.type !== POINT_GEOMETRY && rawFeature.type !== LINE_GEOMETRY && rawFeature.type !== POLYGON_GEOMETRY) {
      throw invalid(`unknown geometry type ${rawFeature.type}`);
    }
    if (rawFeature.geometry === undefined) throw invalid("feature without geometry");
    features.push({
      layer: raw.name,
      id: rawFeature.id,
      properties: resolveProperties(rawFeature, raw, limits),
      geometry: decodeGeometry(rawFeature.geometry, rawFeature.type, limits, signal),
    });
  }
  return { name: raw.name, version: raw.version, extent: raw.extent, features };
}

/**
 * Decodes an MVT/PBF tile into the project-owned model.
 *
 * The input is untrusted: size, structure and geometry are validated against
 * explicit budgets and every failure is a typed {@link TileSourceError}.
 */
export function decodeVectorTile(bytes: Uint8Array, options: DecodeVectorTileOptions = {}): DecodedVectorTile {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("tile bytes must be a Uint8Array");
  const limits = resolveLimits(options);
  const signal = options.signal;
  if (bytes.byteLength > limits.maxBytes) throw tooLarge("tile exceeds the byte budget");
  checkAborted(signal);
  const reader = PbReader.over(bytes, bytes.byteLength);
  const layers: DecodedVectorLayer[] = [];
  let featureCount = 0;
  let declaredFeatures = 0;
  while (!reader.done) {
    checkAborted(signal);
    const { field, wire } = readFieldKey(reader);
    if (field === 3 && wire === WIRE_BYTES) {
      if (layers.length >= limits.maxLayers) throw tooLarge("tile exceeds the layer budget");
      const raw = parseLayer(reader.bytesField(), limits, signal, declaredFeatures);
      declaredFeatures += raw.features.length;
      const layer = buildLayer(raw, limits, signal);
      featureCount += layer.features.length;
      layers.push(layer);
    } else {
      reader.skip(wire);
    }
  }
  return { byteLength: bytes.byteLength, layerCount: layers.length, featureCount, layers };
}
