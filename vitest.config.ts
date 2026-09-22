import { defineConfig } from "vitest/config";

// The deterministic bench suites (DoS guard, MVT parity gate, zoom demand)
// are part of the standard gate. The network-dependent benchmark stays out:
// run it explicitly with `npm run test:bench` (vitest.bench.config.ts).
export default defineConfig({
  test: {
    include: ["src/**/*.{test,spec}.ts", "service/**/*.{test,spec}.ts", "tests/bench/**/*.test.ts"],
    exclude: ["tests/bench/mvt-benchmark.test.ts"],
  },
});
