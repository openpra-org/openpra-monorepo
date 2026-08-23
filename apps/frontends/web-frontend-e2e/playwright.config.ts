import { nxE2EPreset } from "@nx/playwright/preset";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["BASE_URL"] ?? "http://localhost:4201";

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: "./src", generateBlobReports: false }),
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
