import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
    // Clear IndexedDB between tests via storageState
    storageState: { cookies: [], origins: [] },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/scoreflow-cricket/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
