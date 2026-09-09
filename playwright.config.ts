import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.OPENGTA_E2E_PORT ?? 5180);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid OPENGTA_E2E_PORT");
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL,
    channel: "chrome",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: baseURL,
  },
});
