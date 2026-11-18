import { defineConfig, devices } from "@playwright/test";

const PORT = 5174;
const isCI = Boolean(process.env.CI);

/**
 * End-to-end tests run against the dev server in fixture mode (AIC_FIXTURES=1): museum API
 * calls are answered from local data, and IIIF image requests are intercepted in the
 * browser (see e2e/fixtures.ts). Results never depend on the museum's servers.
 *
 * vinext allows one dev server per project folder; stop `npm run dev` before running these.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // One worker: the dev server compiles routes on first request, and the tests share it.
  workers: 1,
  fullyParallel: false,
  retries: isCI ? 1 : 0,
  forbidOnly: isCI,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "en-US",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: `npx vite dev --port ${PORT} --strictPort`,
    env: { AIC_FIXTURES: "1" },
    url: `http://localhost:${PORT}/icon.svg`,
    timeout: 180_000,
    reuseExistingServer: !isCI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
