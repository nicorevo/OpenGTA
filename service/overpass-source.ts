import type { OsmArea, OsmCellFeatures, OsmNode, OsmWay } from "../src/vps/index.ts";
import type { SpatialCell } from "../src/vps/index.ts";
import type { RateLimiter } from "./rate-limit.ts";

/**
 * Service-side OSM source (VPS-10, spec 7/101): the only layer that talks to
 * Overpass. Shape verified against the live API (VPS-10 recon, 2026-09-22):
 * POST form `data=<QL>` with Content-Type application/x-www-form-urlencoded
 * and a User-Agent; `out geom` returns way geometry and relation member
 * geometry, which is how way lengths and building areas are computed.
 *
 * Failures THROW: the pipeline (VPS-09) catches them and degrades the cell
 * to vision-only evidence (spec 80) — this module never returns partial data
 * as if it were complete.
 */

const USER_AGENT = "OpenGTA-VPS/1.0 (service-side evidence collection)";

interface OverpassGeometryPoint {
  readonly lat: number;
  readonly lon: number;
}

interface OverpassMember {
  readonly type: string;
  readonly ref: number;
  readonly role?: string;
  readonly geometry?: readonly OverpassGeometryPoint[];
}

interface OverpassElement {
  readonly type: string;
  readonly id: number;
  readonly tags?: Record<string, string>;
  readonly geometry?: readonly OverpassGeometryPoint[];
  readonly members?: readonly OverpassMember[];
}

interface OverpassResponse {
  readonly elements?: readonly OverpassElement[];
}

/**
 * The Overpass query. Tag vocabulary mirrors the collector (VPS-05) exactly:
 * only what collectOsmEvidence can classify is fetched.
 */
/** Overpass boxes at 6 decimal places (~0.1 m) — full JS precision is noise. */
const f6 = (value: number): number => Math.round(value * 1e6) / 1e6;

function buildQuery(south: number, west: number, north: number, east: number): string {
  const box = `(${f6(south)},${f6(west)},${f6(north)},${f6(east)})`;
  return [
    "[out:json][timeout:25];",
    "(",
    `node["natural"="tree"]${box};`,
    `node["amenity"="bench"]${box};`,
    `node["barrier"="bollard"]${box};`,
    `way["highway"~"residential|primary|secondary|tertiary|unclassified|service|living_street|pedestrian|footway|path|cycleway|track"]${box};`,
    `way["building"~"."]${box};`,
    `relation["building"~"."]${box};`,
    `relation["landuse"~"grass|forest|cemetery"]${box};`,
    `relation["natural"~"wood|grass|scrub"]${box};`,
    `relation["leisure"~"park|garden|recreation_ground|common"]${box};`,
    ");",
    "out geom;",
  ].join("\n");
}

const M_PER_DEG_LAT = 111_320;

function metersPerDegLon(latitude: number): number {
  return M_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180);
}

/** Equirectangular segment length; plenty for ~km-scale geometries. */
function segmentMeters(a: OverpassGeometryPoint, b: OverpassGeometryPoint): number {
  const latM = (b.lat - a.lat) * M_PER_DEG_LAT;
  const lonM = (b.lon - a.lon) * metersPerDegLon((a.lat + b.lat) / 2);
  return Math.hypot(latM, lonM);
}

function polylineLengthM(points: readonly OverpassGeometryPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += segmentMeters(points[i - 1], points[i]);
  }
  return total;
}

/** Shoelace area in meters², equirectangular projection; |.| so winding order never matters. */
function polygonAreaM2(ring: readonly OverpassGeometryPoint[]): number {
  if (ring.length < 3) return 0;
  const lat0 = ring[0].lat;
  const kLon = metersPerDegLon(lat0);
  let sum = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const x1 = a.lon * kLon;
    const y1 = a.lat * M_PER_DEG_LAT;
    const x2 = b.lon * kLon;
    const y2 = b.lat * M_PER_DEG_LAT;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Concatenate the outer-ring members (in ref order) into one closed ring. */
function outerRingOf(relation: OverpassElement): OverpassGeometryPoint[] {
  const ring: OverpassGeometryPoint[] = [];
  for (const member of relation.members ?? []) {
    if (member.type !== "way" || member.role !== "outer" || !Array.isArray(member.geometry)) continue;
    ring.push(...member.geometry);
  }
  return ring;
}

function hasTags(tags: Record<string, string> | undefined): tags is Record<string, string> {
  return tags !== undefined && Object.keys(tags).length > 0;
}

export interface OsmSourceOptions {
  readonly endpoint: string;
  readonly fetchImpl?: typeof fetch;
  readonly rateLimiter?: RateLimiter;
}

export function createOsmSource(options: OsmSourceOptions) {
  const doFetch = options.fetchImpl ?? fetch;
  const rateLimiter = options.rateLimiter;

  return async (cell: SpatialCell): Promise<OsmCellFeatures> => {
    if (rateLimiter) await rateLimiter.acquire();

    const { south, west, north, east } = cell.bounds;
    let response: Response;
    try {
      response = await doFetch(options.endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
        body: new URLSearchParams({ data: buildQuery(south, west, north, east) }).toString(),
      });
    } catch (err) {
      throw new Error(`overpass unreachable: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!response.ok) {
      throw new Error(`overpass responded ${response.status} ${response.statusText}`.trim());
    }

    let parsed: OverpassResponse;
    try {
      parsed = (await response.json()) as OverpassResponse;
    } catch {
      throw new Error("overpass returned a non-JSON body");
    }
    const elements = Array.isArray(parsed.elements) ? parsed.elements : [];

    const nodes: OsmNode[] = [];
    const ways: OsmWay[] = [];
    const areas: OsmArea[] = [];

    for (const el of elements) {
      if (el.type === "node") {
        if (hasTags(el.tags)) nodes.push({ tags: el.tags });
      } else if (el.type === "way") {
        if (!hasTags(el.tags)) continue;
        if (el.tags.highway !== undefined) {
          const lengthM = Array.isArray(el.geometry) ? polylineLengthM(el.geometry) : 0;
          ways.push({ tags: el.tags, lengthM });
        } else if (el.tags.building !== undefined && Array.isArray(el.geometry)) {
          // single-way building: closed rings become areas, open polylines are skipped
          const closed =
            el.geometry.length >= 4 &&
            el.geometry[0].lat === el.geometry[el.geometry.length - 1].lat &&
            el.geometry[0].lon === el.geometry[el.geometry.length - 1].lon;
          if (closed) areas.push({ tags: el.tags, areaM2: polygonAreaM2(el.geometry) });
        }
      } else if (el.type === "relation") {
        if (!hasTags(el.tags)) continue;
        const ring = outerRingOf(el);
        if (ring.length >= 4) {
          areas.push({ tags: el.tags, areaM2: polygonAreaM2(ring) });
        }
      }
    }

    return { nodes, ways, areas };
  };
}
