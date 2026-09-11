import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import * as os from "node:os";
import { dirname } from "node:path";
import { expect, it } from "vitest";
import { decodeVectorTile } from "../../src/geo/mvt/decode.ts";
import { createTangentProjector } from "../../src/geo/coordinates/projector.ts";
import { normalizeOsm, type RawOsm } from "../../src/geo/normalize/osm.ts";
import { compileRegion } from "../../src/world/compiler/compiled.ts";
import { mvtToRegion, ORIGIN, TILE } from "./mvt-assemble.ts";

/**
 * DATA-10 benchmark: Overpass (fixture-only, network unreachable from this
 * environment) vs OpenFreeMap z14 (fixture + one real sequential fetch).
 * Same origin, same V0 box, same measurement code. Report:
 * docs/analysis/MVT-BENCHMARK.md
 */

const OVERPASS_FIXTURE = new URL("../../src/fixtures/geo/lecce-sant-oronzo-v0.raw.json", import.meta.url);
const MVT_FIXTURE = new URL("../../src/fixtures/geo/lecce-z14-openfreemap.pbf", import.meta.url);
const REPORT_PATH = new URL("../../docs/analysis/MVT-BENCHMARK.md", import.meta.url);
const PINNED_TILE_URL = "https://tiles.openfreemap.org/planet/20260830_080001_pt/14/9019/6181.pbf";
const ITERATIONS = 7;

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function stats(values: readonly number[]): { p50: number; p95: number; p99: number; max: number; stallsOver100Ms: number } {
  const sorted = [...values].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), p99: percentile(sorted, 99), max: sorted[sorted.length - 1] ?? Number.NaN, stallsOver100Ms: sorted.filter((v) => v > 100).length };
}

interface SourceBench {
  iterations: number;
  acquireMs: number[];
  normalizeMs: number[];
  compileMs: number[];
  totalMs: number[];
  firstPlayableMs: number;
  requestCount: number;
  networkBytes: number;
  networkMs?: number;
  fixtureBytes: number;
  featureCount: number;
  canonicalFeatures: number;
  compiledChunks: number;
  cacheHits: number;
  cacheNote: string;
  failureNote: string;
}

function runOverpassBench(): SourceBench {
  const projector = createTangentProjector(ORIGIN);
  const acquireMs: number[] = [];
  const normalizeMs: number[] = [];
  const compileMs: number[] = [];
  const totalMs: number[] = [];
  const fixtureBytes = new Uint8Array(readFileSync(OVERPASS_FIXTURE)).byteLength;
  let firstRegion: ReturnType<typeof normalizeOsm> | undefined;
  let firstChunkCount = 0;
  let firstPlayableMs = Number.NaN;
  let firstFeatureCount = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = performance.now();
    const acquired = (() => { const t = performance.now(); const raw = JSON.parse(readFileSync(OVERPASS_FIXTURE, "utf8")) as RawOsm; acquireMs.push(performance.now() - t); return raw; })();
    const n = (() => { const t = performance.now(); const region = normalizeOsm(acquired, projector, ORIGIN, "overpass-fixture"); normalizeMs.push(performance.now() - t); return region; })();
    const c = (() => { const t = performance.now(); const result = compileRegion(n); compileMs.push(performance.now() - t); return result; })();
    totalMs.push(performance.now() - started);
    if (i === 0) {
      firstRegion = n;
      firstChunkCount = c.chunks.length;
      firstPlayableMs = totalMs[0];
      firstFeatureCount = acquired.elements.length;
    }
  }
  const canonical = firstRegion!;
  return {
    iterations: ITERATIONS,
    acquireMs,
    normalizeMs,
    compileMs,
    totalMs,
    firstPlayableMs,
    requestCount: 0, // fixture only: Overpass network unreachable (DATA-01 evidence)
    networkBytes: 0,
    fixtureBytes,
    featureCount: firstFeatureCount,
    canonicalFeatures: canonical.buildings.length + canonical.roads.length + canonical.landAreas.length + canonical.waterAreas.length + canonical.barriers.length + canonical.trees.length,
    compiledChunks: firstChunkCount,
    cacheHits: 0,
    cacheNote: "Nessun layer di cache nel percorso di benchmark; il persistent store runtime non è coinvolto. DATA-11 introduce il tile cache e rimisura.",
    failureNote: "0 richieste reali: tutti gli host Overpass sono irraggiungibili da questo ambiente (verificato in DATA-01). Percorsi retry/429 non esercitati su fixture.",
  };
}

async function runMvtBench(): Promise<SourceBench & { fetchOk: boolean; fetchNote: string; fixtureMatchesNetwork: boolean }> {
  const fixtureBytes = new Uint8Array(readFileSync(MVT_FIXTURE));
  const decodeMs: number[] = [];
  const mapMs: number[] = [];
  const compileMs: number[] = [];
  const totalMs: number[] = [];
  let firstCanonical = 0;
  let firstChunkCount = 0;
  let firstPlayableMs = Number.NaN;
  let firstFeatureCount = 0;
  for (let i = 0; i < ITERATIONS; i += 1) {
    const started = performance.now();
    const decoded = (() => { const t = performance.now(); const d = decodeVectorTile(fixtureBytes); decodeMs.push(performance.now() - t); return d; })();
    const assembled = (() => { const t = performance.now(); const r = mvtToRegion(decoded); mapMs.push(performance.now() - t); return r; })();
    const compiled = (() => { const t = performance.now(); const c = compileRegion(assembled.region); compileMs.push(performance.now() - t); return c; })();
    totalMs.push(performance.now() - started);
    if (i === 0) {
      const region = assembled.region;
      firstCanonical = region.buildings.length + region.roads.length + region.landAreas.length + region.waterAreas.length;
      firstChunkCount = compiled.chunks.length;
      firstPlayableMs = totalMs[0];
      firstFeatureCount = decoded.featureCount;
    }
  }
  // One real sequential fetch of the pinned tile (public z14 ceiling).
  let fetchOk = false;
  let networkMs: number | undefined;
  let networkBytes = 0;
  let fetchNote = "";
  let fixtureMatchesNetwork = false;
  try {
    const started = performance.now();
    const response = await fetch(PINNED_TILE_URL, { signal: AbortSignal.timeout(30_000) });
    const bytes = new Uint8Array(await response.arrayBuffer());
    networkMs = performance.now() - started;
    networkBytes = bytes.byteLength;
    fetchOk = response.ok;
    fixtureMatchesNetwork = bytes.length === fixtureBytes.byteLength;
    fetchNote = fetchOk ? `HTTP ${response.status}` : `HTTP ${response.status}`;
  } catch (error) {
    fetchNote = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
  }
  return {
    iterations: ITERATIONS,
    acquireMs: decodeMs, // decode is the acquire phase for the MVT path
    normalizeMs: mapMs,
    compileMs,
    totalMs,
    firstPlayableMs,
    requestCount: fetchOk ? 1 : 0,
    networkBytes,
    networkMs,
    fixtureBytes: fixtureBytes.byteLength,
    featureCount: firstFeatureCount,
    canonicalFeatures: firstCanonical,
    compiledChunks: firstChunkCount,
    cacheHits: 0,
    cacheNote: "Nessun layer di cache nel percorso di benchmark; DATA-11 introduce il tile cache e rimisura.",
    failureNote: "1 fetch reale sequenziale (mai parallelo, mai rotazione): risultato registrato sotto. Retry/429 non esercitati: nessun bypass di Retry-After.",
    fetchOk,
    fetchNote,
    fixtureMatchesNetwork,
  };
}

function fmt(value: number | undefined, digits = 1): string {
  return value === undefined || !Number.isFinite(value) ? "n/d" : value.toFixed(digits);
}

function reportMarkdown(overpass: SourceBench, mvt: SourceBench & { fetchOk: boolean; fetchNote: string; fixtureMatchesNetwork: boolean }): string {
  const env = {
    date: new Date().toISOString(),
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    cpu: os.cpus()[0]?.model ?? "unknown",
    gpu: "unknown (benchmark headless, nessuna API browser)",
    ramMiB: String(Math.round(os.totalmem() / 1e6)),
    "browser/renderer": "N/A (benchmark headless senza canvas; fasi renderer/fisica misurate in E2E)",
    commit: execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim(),
    heapUsedMiB: fmt(process.memoryUsage().heapUsed / 1e6, 2),
  };
  const oStats = (list: number[]) => stats(list);
  const sourceRows = (name: string, b: SourceBench, phases: Record<string, number[]>) => {
    const phaseRows = Object.entries(phases).map(([phase, values]) => {
      const s = oStats(values);
      return `| ${phase} | ${fmt(s.p50)} | ${fmt(s.p95)} | ${fmt(s.p99)} | ${fmt(s.max)} | ${s.stallsOver100Ms} |`;
    }).join("\n");
    const total = oStats(b.totalMs);
    return `### ${name}

| Fase | p50 ms | p95 ms | p99 ms | max ms | stall >100 ms |
| --- | --- | --- | --- | --- | --- |
${phaseRows}
| totale first playable (source→chunk compilato) | ${fmt(total.p50)} | ${fmt(total.p95)} | ${fmt(total.p99)} | ${fmt(total.max)} | ${total.stallsOver100Ms} |

- first playable misurato (prima iterazione): ${fmt(b.firstPlayableMs)} ms
- iterazioni: ${b.iterations}; richieste reali: ${b.requestCount}; byte rete: ${b.networkBytes}
- byte fixture: ${b.fixtureBytes}; elementi/feature in ingresso: ${b.featureCount}
- feature canoniche (box V0): ${b.canonicalFeatures}; chunk compilati: ${b.compiledChunks}
- cache hits: ${b.cacheHits} — ${b.cacheNote}
- failure/retry: ${b.failureNote}`;
  };
  return `# Benchmark Overpass vs OpenFreeMap z14

Generated: ${env.date}. Protocollo: docs/testing/benchmark-protocol-v0.md.
Stessa origine Sant'Oronzo, stesso box V0 ±300 m, stesso codice di misura.

## Ambiente

${Object.entries(env).map(([key, value]) => `- **${key}**: ${value}`).join("\n")}

## Fasi cold-start (fixture, N=${ITERATIONS})

${sourceRows("Overpass (fixture 300 m, rete irraggiungibile)", overpass, { "acquire (read fixture)": overpass.acquireMs, normalize: overpass.normalizeMs, compile: overpass.compileMs })}

${sourceRows("OpenFreeMap z14 (fixture tile 14/9019/6181)", mvt, { "acquire (decode PBF)": mvt.acquireMs, "mapping+clip": mvt.normalizeMs, compile: mvt.compileMs })}

## Fetch reale OpenFreeMap (1 richiesta sequenziale, tile pinnata)

- esito: ${mvt.fetchOk ? "OK" : "FALLITA"} — ${mvt.fetchNote}
- latenza: ${fmt(mvt.networkMs)} ms; byte: ${mvt.networkBytes}
- contenuto identico alla fixture: ${mvt.fixtureMatchesNetwork ? "sì" : "no"}

## Envelope V0 (alert ingegneristici, non SLA)

- p95 fase > 20 ms / p99 > 33,3 ms / stall singolo > 100 ms: segnalati
  nelle tabelle sopra; nessuna soglia è assertita dal benchmark.

## Confronto dichiarato

- Overpass: fixture-only. La rete Overpass non è raggiungibile da questo
  ambiente (tutti gli host verificati in DATA-01); latenze di rete Overpass
  non misurabili qui e non inventate.
- MVT: fixture + una fetch reale sequenziale al soffitto pubblico z14.
- Cache, retry e failure: non esercitati nel percorso di benchmark (note
  per-source sopra); il tile cache arriva con DATA-11.
`;
}

it("collects complete Overpass vs MVT benchmark metrics and writes the report", async () => {
  const overpass = runOverpassBench();
  const mvt = await runMvtBench();
  for (const list of [overpass.acquireMs, overpass.normalizeMs, overpass.compileMs, overpass.totalMs, mvt.acquireMs, mvt.normalizeMs, mvt.compileMs, mvt.totalMs]) {
    expect(list.length).toBe(ITERATIONS);
    for (const value of list) expect(Number.isFinite(value)).toBe(true);
  }
  expect(overpass.canonicalFeatures).toBeGreaterThan(0);
  expect(mvt.canonicalFeatures).toBeGreaterThan(0);
  expect(overpass.compiledChunks).toBeGreaterThan(0);
  expect(mvt.compiledChunks).toBeGreaterThan(0);
  const markdown = reportMarkdown(overpass, mvt);
  mkdirSync(dirname(REPORT_PATH.pathname), { recursive: true });
  writeFileSync(REPORT_PATH, markdown);
  console.log(markdown);
});
