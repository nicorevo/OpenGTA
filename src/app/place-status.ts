import type { ReverseGeocodeResult } from "./geocode.ts";
import { toLocationContext, type LocationContext } from "./location-context.ts";

/** World-space size (meters) of the square zone that triggers a reverse lookup. */
export const PLACE_ZONE_METERS = 1000;
const DEFAULT_MIN_INTERVAL_MS = 5_000;

/**
 * Deterministic zone key for a world-space pose: floor division into square
 * cells. Points inside the same cell share a key; negative coordinates keep
 * consistent cell boundaries.
 */
export function zoneKeyForPose(x: number, y: number, cellSizeMeters: number = PLACE_ZONE_METERS): string {
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Invalid place pose");
  if (!Number.isFinite(cellSizeMeters) || cellSizeMeters <= 0) throw new Error("Invalid place cell size");
  return `z${Math.floor(x / cellSizeMeters)}:${Math.floor(y / cellSizeMeters)}`;
}

export interface PlaceTrackerOptions {
  readonly reverse: (latitude: number, longitude: number, signal?: AbortSignal) => Promise<ReverseGeocodeResult | undefined>;
  /** World-space pose to geographic coordinates for the reverse lookup. */
  readonly toLonLat: (x: number, y: number) => { readonly latitude: number; readonly longitude: number };
  /** Minimum milliseconds between two reverse requests (default 5000). */
  readonly minIntervalMs?: number;
  /** Zone cell size in meters (default PLACE_ZONE_METERS). */
  readonly cellSizeMeters?: number;
  /** Injectable clock for deterministic tests (default Date.now). */
  readonly clock?: () => number;
}

export interface PlaceTracker {
  /** Feed the current world-space pose; at most one request in flight. */
  track(x: number, y: number): void;
  /** Last resolved place name, undefined until the first success. */
  place(): string | undefined;
  /**
   * Last resolved structured context (LVP input). Kept until a new success:
   * failures and no-data answers must not clear it or cause theme flicker.
   */
  location(): LocationContext | undefined;
  /** Abort any in-flight request and stop tracking. */
  dispose(): void;
}

interface PendingZone { readonly key: string; readonly x: number; readonly y: number }

export function createPlaceTracker(options: PlaceTrackerOptions): PlaceTracker {
  const minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
  const cellSizeMeters = options.cellSizeMeters ?? PLACE_ZONE_METERS;
  const clock = options.clock ?? Date.now;
  let servedZone: string | undefined;
  let activeKey: string | undefined;
  let pendingZone: PendingZone | undefined;
  let lastRequestAt = -Infinity;
  let placeName: string | undefined;
  let locationCtx: LocationContext | undefined;
  let controller: AbortController | undefined;
  let disposed = false;

  function fire(key: string, x: number, y: number): void {
    if (disposed) return;
    activeKey = key;
    pendingZone = undefined;
    lastRequestAt = clock();
    controller = new AbortController();
    const signal = controller.signal;
    const { latitude, longitude } = options.toLonLat(x, y);
    options.reverse(latitude, longitude, signal).then(
      (candidate) => {
        if (disposed || signal.aborted) return;
        activeKey = undefined;
        servedZone = key;
        if (candidate) {
          placeName = candidate.name;
          locationCtx = toLocationContext(candidate);
        }
        tryPending();
      },
      () => {
        if (disposed) return;
        activeKey = undefined;
        tryPending();
      },
    );
  }

  function tryPending(): void {
    if (disposed || activeKey) return;
    if (clock() - lastRequestAt < minIntervalMs) return;
    const zone = pendingZone;
    pendingZone = undefined;
    if (zone === undefined || zone.key === servedZone) return;
    fire(zone.key, zone.x, zone.y);
  }

  function track(x: number, y: number): void {
    if (disposed) return;
    const key = zoneKeyForPose(x, y, cellSizeMeters);
    if (key === servedZone || key === activeKey) return;
    if (pendingZone?.key === key) {
      if (!activeKey && clock() - lastRequestAt >= minIntervalMs) fire(key, x, y);
      return;
    }
    pendingZone = { key, x, y };
    if (activeKey) return;
    if (clock() - lastRequestAt < minIntervalMs) return;
    fire(key, x, y);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    controller?.abort();
    activeKey = undefined;
    pendingZone = undefined;
  }

  return {
    track,
    place: () => placeName,
    location: () => locationCtx,
    dispose,
  };
}
