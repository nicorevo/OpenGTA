import { defineConfig } from "vitest/config";

// Pathological/benchmark suites stay OUT of the default unit run: run them
// explicitly with `npx vitest run --config vitest.bench.config.ts`.
export default defineConfig({
  test: {
    include: ["tests/bench/**/*.test.ts"],
  },
});
