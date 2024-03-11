import path = require("path");
import { defineConfig } from "@playwright/test";
import { nxE2EPreset } from "@nx/playwright/preset";
import { workspaceRoot } from "@nx/devkit";
import { devices } from "@playwright/experimental-ct-react";

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env.BASE_URL ?? "http://localhost:4200";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export const STORAGE_STATE = path.join(
  __dirname,
  "packages/frontend/web-editor/e2e/.auth/user.json",
);

// eslint-disable-next-line import/no-default-export
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: "./tests" }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
  },
  // Run your local dev server before starting the tests
  webServer: {
    command: "nx run-many -t serve",
    url: "http://localhost:8000/api",
    reuseExistingServer: false,
    cwd: workspaceRoot,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*setup.spec\.ts/,
    },
    {
      name: "Admin Tests",
      testMatch: "**/adminPage.spec.ts",
      dependencies: ["setup"],
      use: {
        storageState: "packages/frontend/web-editor/e2e/.auth/user.json",
      },
    },
  ],
});
