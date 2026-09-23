import { latLngToCell } from "h3-js";
import type { VisualProfile } from "../../render/theme/types.ts";
import { parseVpsProfileResponse } from "./validate.ts";

export interface VpsProfileClientDeps {
  /** Injected fetch (testability); only the subset the client uses. */
  readonly fetch: (
    url: string,
    init?: { readonly signal?: AbortSignal },
  ) => Promise<{ readonly ok: boolean; readonly status: number; readonly json: () => Promise<unknown> }>;
  /** Origin of the VPS service (spec 106), e.g. http://127.0.0.1:8787. */
  readonly baseUrl: string;
  /** Injectable clock for cache/cooldown tests. */
  readonly now?: () => number;
  /** Per-request timeout; a hung service must never block the game. */
  readonly timeoutMs?: number;
  /** How long an applied profile stays authoritative for its cell. */
  readonly cacheTtlMs?: number;
  /** How long a failed (or lvp-only) cell stays quiet before retrying. */
  readonly cooldownMs?: number;
  /**
   * How long an applied profile keeps rendering after it stopped matching
   * the current cell, as long as the location stays in the same city theme
   * (sticky, v1.1): a cold generation takes 20-40 s while a driven cell
   * boundary is crossed every 20-50 s, so dropping to LVP on every cell
   * change would keep the player on the fallback almost forever.
   */
  readonly stickyMaxMs?: number;
}

export type VpsClientState = "idle" | "loading" | "applied" | "failed";

export interface VpsClientDiagnostics {
  readonly cellId: string | undefined;
  /** LVP theme id of the last synced location. */
  readonly cityKey?: string;
  readonly state: VpsClientState;
  readonly profileId?: string;
  readonly source?: "generated" | "cache" | "lvp";
  readonly error?: string;
}

interface AppliedEntry {
  readonly cellId: string;
  /** City theme the profile was requested for; a late response from another
   * city is never applied (no cross-city bleed). */
  readonly cityKey: string;
  readonly profile: VisualProfile;
  readonly source: "generated" | "cache";
  readonly at: number;
}

interface Attempt {
  readonly at: number;
  readonly applied: boolean;
}

/**
 * Client-side VPS profile source (spec 54 level 1, spec 106). Fire-and-forget
 * semantics: sync() starts at most one background fetch per h3 cell (the same
 * cell the service uses) and returns the last good generated profile, or
 * undefined so the caller keeps the LVP resolution. The client never blocks
 * rendering, never retries a failing cell inside the cooldown, and drops an
 * applied profile as soon as the location moves to a different cell (no
 * cross-city palette bleed).
 */
export function createVpsProfileClient(deps: VpsProfileClientDeps) {
  const now = deps.now ?? Date.now;
  // A cold cell takes 30+ seconds to generate on the service side: the
  // timeout must clear the slowest observed generation (36 s) with margin.
  const timeoutMs = deps.timeoutMs ?? 60_000;
  const cacheTtlMs = deps.cacheTtlMs ?? 10 * 60_000;
  const cooldownMs = deps.cooldownMs ?? 60_000;
  const stickyMaxMs = deps.stickyMaxMs ?? 120_000;

  let applied: AppliedEntry | undefined;
  let lastCell: string | undefined;
  let lastCityKey: string | undefined;
  let lastSource: "generated" | "cache" | "lvp" | undefined;
  let lastError: string | undefined;
  const inflight = new Map<string, Promise<void>>();
  const attempts = new Map<string, Attempt>();

  const state = (): VpsClientState =>
    inflight.size > 0 ? "loading" : applied ? "applied" : lastError ? "failed" : "idle";

  async function request(cellId: string, location: { readonly latitude: number; readonly longitude: number }, cityKey: string): Promise<void> {
    try {
      const url = `${deps.baseUrl}/v1/profile?lat=${location.latitude}&lon=${location.longitude}`;
      const response = await deps.fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`vps service responded ${response.status}`);
      const parsed = parseVpsProfileResponse(await response.json());
      if (parsed === undefined) throw new Error("vps service response malformed");
      if (parsed.source === "lvp") {
        // The service has no generated profile for this cell; the client
        // keeps its own (finer) LVP resolution.
        applied = undefined;
        lastSource = "lvp";
        lastError = undefined;
      } else if (cityKey === lastCityKey) {
        // A response is only authoritative while the player stayed in the
        // city it was requested for: stamping at request time, not resolve
        // time, is what makes a late cross-city response inert.
        applied = { cellId, cityKey, profile: parsed.profile, source: parsed.source, at: now() };
        lastSource = parsed.source;
        lastError = undefined;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unknown vps service error";
    } finally {
      attempts.set(cellId, { at: now(), applied: applied?.cellId === cellId });
    }
  }

  return {
    /**
     * Call from the UI tick: ensure a background fetch for the location's
     * cell and return the profile to render (undefined = keep LVP).
     *
     * `cityKey` is the LVP theme id resolved for the location (the same
     * city identity the service's parent resolver approximates). Sticky
     * rendering: an applied profile keeps rendering across cell boundaries
     * inside the same city and is dropped on city change or after
     * stickyMaxMs, so driving never flickers back to LVP.
     */
    sync(location: { readonly latitude: number; readonly longitude: number } | undefined, cityKey: string): VisualProfile | undefined {
      if (location !== undefined) {
        lastCityKey = cityKey;
        const cellId = latLngToCell(location.latitude, location.longitude, 9);
        lastCell = cellId;
        const stale = applied !== undefined && (applied.cityKey !== cityKey || now() - applied.at > stickyMaxMs);
        if (stale) applied = undefined;
        const attempt = attempts.get(cellId);
        const fresh = applied !== undefined && applied.cellId === cellId && now() - applied.at <= stickyMaxMs;
        const elapsed = now() - (attempt?.at ?? -Infinity);
        // A fresh applied cell is authoritative for the whole TTL; anything
        // else (stale, failed, never seen) retries only after the cooldown.
        const retryDelay = attempt !== undefined && attempt.applied && fresh ? cacheTtlMs : cooldownMs;
        if (!inflight.has(cellId) && elapsed >= retryDelay) {
          inflight.set(cellId, request(cellId, location, cityKey).finally(() => {
            inflight.delete(cellId);
          }));
        }
      }
      return applied?.profile;
    },
    diagnostics(): VpsClientDiagnostics {
      return {
        cellId: lastCell,
        ...(lastCityKey !== undefined ? { cityKey: lastCityKey } : {}),
        state: state(),
        ...(applied
          ? { profileId: applied.profile.id, source: applied.source }
          : lastSource !== undefined
            ? { source: lastSource }
            : {}),
        ...(lastError !== undefined ? { error: lastError } : {}),
      };
    },
  };
}
