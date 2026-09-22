import type { GeoArea, StreetSample, StreetSamplingOptions } from "./types.ts";

/** Two samples closer than this are "the same position" for spread rules. */
export const MIN_POSITION_SPREAD_M = 30;
/** Default minimum heading difference between two shots of the same position. */
export const DEFAULT_HEADING_SPREAD_DEG = 45;
/** Spec 14 baseline: 5-10 positions x 2-3 headings. */
export const MAX_HEADINGS_PER_POSITION = 3;
const DEDUP_DISTANCE_M = 10;
const DEDUP_HEADING_DEG = 15;
const M_PER_DEG = 111_320;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371_000 * Math.asin(Math.sqrt(a));
}

function headingDeltaDeg(a?: number, b?: number): number | undefined {
  if (a === undefined || b === undefined) return undefined;
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

function parseTime(value?: string): number {
  if (value === undefined) return Number.NaN;
  const t = Date.parse(value);
  return Number.isNaN(t) ? Number.NaN : t;
}

/**
 * Deterministic street-image selection (spec 13-14): prefer images spread in
 * space, spread in heading, recent, non-duplicated, not concentrated on one
 * sequence. Pure function: no network, no clock (recency is relative to the
 * newest capture in the pool, so the same pool always selects the same set).
 */
export function selectStreetSamples(
  candidates: readonly StreetSample[],
  options: StreetSamplingOptions,
  area: GeoArea,
): StreetSample[] {
  const finite = candidates.filter(
    (c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude) && c.latitude >= -90 && c.latitude <= 90 && c.longitude >= -180 && c.longitude <= 180,
  );
  const inRadius = finite.filter((c) => haversineM(c.latitude, c.longitude, area.center.latitude, area.center.longitude) <= options.radiusMeters);
  if (inRadius.length === 0 || options.maxSamples <= 0) return [];

  const times = inRadius.map((c) => parseTime(c.capturedAt)).filter((t) => !Number.isNaN(t));
  const referenceTime = times.length > 0 ? Math.max(...times) : Number.NaN;
  const ageOf = (c: StreetSample): number => {
    const t = parseTime(c.capturedAt);
    if (Number.isNaN(t) || Number.isNaN(referenceTime)) return Number.POSITIVE_INFINITY;
    return Math.max(0, (referenceTime - t) / (365.25 * 24 * 3600 * 1000));
  };

  // Dedup: same sourceId once; near-identical position+heading once.
  // Sorted by (age, sourceId) first so "keep the newest" is deterministic
  // and independent of input order.
  const byNewestFirst = [...inRadius].sort((a, b) => ageOf(a) - ageOf(b) || a.sourceId.localeCompare(b.sourceId));
  const deduped: StreetSample[] = [];
  for (const cand of byNewestFirst) {
    const dup = deduped.some(
      (kept) =>
        kept.sourceId === cand.sourceId ||
        (haversineM(kept.latitude, kept.longitude, cand.latitude, cand.longitude) <= DEDUP_DISTANCE_M &&
          (headingDeltaDeg(kept.heading, cand.heading) ?? 0) < DEDUP_HEADING_DEG),
    );
    if (!dup) deduped.push(cand);
  }

  const windowYears = options.preferredRecencyYears;
  const tierOf = (c: StreetSample): number => (windowYears !== undefined && ageOf(c) <= windowYears ? 0 : 1);
  const scoreOrder = [...deduped].sort((a, b) => tierOf(a) - tierOf(b) || ageOf(a) - ageOf(b) || a.sourceId.localeCompare(b.sourceId));

  const minSpread = options.minDirectionalSpread ?? DEFAULT_HEADING_SPREAD_DEG;
  const picked: StreetSample[] = [];
  const nearCount = (c: StreetSample) => picked.filter((p) => haversineM(p.latitude, p.longitude, c.latitude, c.longitude) < MIN_POSITION_SPREAD_M).length;

  // Pass 1: spatial spread + heading spread + per-position heading cap.
  for (const cand of scoreOrder) {
    if (picked.length >= options.maxSamples) break;
    if (nearCount(cand) >= MAX_HEADINGS_PER_POSITION) continue;
    const conflict = picked.some((p) => {
      if (haversineM(p.latitude, p.longitude, cand.latitude, cand.longitude) >= MIN_POSITION_SPREAD_M) return false;
      const dh = headingDeltaDeg(p.heading, cand.heading);
      return dh !== undefined && dh < minSpread;
    });
    if (!conflict) picked.push(cand);
  }
  // Pass 2: fill with the best remaining positions (spatial spread only).
  for (const cand of scoreOrder) {
    if (picked.length >= options.maxSamples) break;
    if (picked.includes(cand)) continue;
    if (nearCount(cand) > 0) continue;
    picked.push(cand);
  }
  return picked;
}
