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
}

export type VpsClientState = "idle" | "loading" | "applied" | "failed";

export interface VpsClientDiagnostics {
  readonly cellId: string | undefined;
  readonly state: VpsClientState;
  readonly profileId?: string;
  readonly source?: "generated" | "cache" | "lvp";
  readonly error?: string;
}

interface AppliedEntry {
  readonly cellId: string;
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

  let applied: AppliedEntry | undefined;
  let lastCell: string | undefined;
  let lastSource: "generated" | "cache" | "lvp" | undefined;
  let lastError: string | undefined;
  const inflight = new Map<string, Promise<void>>();
  const attempts = new Map<string, Attempt>();

  const state = (): VpsClientState =>
    inflight.size > 0 ? "loading" : applied ? "applied" : lastError ? "failed" : "idle";

  async function request(cellId: string, location: { readonly latitude: number; readonly longitude: number }): Promise<void> {
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
      } else {
        applied = { cellId, profile: parsed.profile, source: parsed.source, at: now() };
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
     * cell and return the applied profile (undefined = keep LVP).
     */
    sync(location: { readonly latitude: number; readonly longitude: number } | undefined): VisualProfile | undefined {
      if (location !== undefined) {
        const cellId = latLngToCell(location.latitude, location.longitude, 9);
        lastCell = cellId;
        if (applied?.cellId !== cellId) applied = undefined;
        const attempt = attempts.get(cellId);
        const elapsed = now() - (attempt?.at ?? -Infinity);
        const retryDelay = attempt?.applied ? cacheTtlMs : cooldownMs;
        if (!inflight.has(cellId) && elapsed >= retryDelay) {
          inflight.set(cellId, request(cellId, location).finally(() => {
            inflight.delete(cellId);
          }));
        }
      }
      return applied?.profile;
    },
    diagnostics(): VpsClientDiagnostics {
      return {
        cellId: lastCell,
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
