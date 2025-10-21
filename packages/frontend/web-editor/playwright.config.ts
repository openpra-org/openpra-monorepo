import path from "node:path";
import { defineConfig } from "@playwright/test";
import { nxE2EPreset } from "@nx/playwright/preset";
import { workspaceRoot } from "@nx/devkit";

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env.BASE_URL ?? "http://localhost:4200";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const storageState = path.join(workspaceRoot, "packages/frontend/web-editor/e2e/.auth/user.json");

export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: "./tests" }),
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    headless: true,
  },
  // Reduce flakiness across environments
  retries: 1,
  // Run your local dev server before starting the tests
  webServer: {
    command: "pnpm exec playwright install-deps && nx run-many -t serve -p frontend-web-editor web-backend",
    url: "http://localhost:8000/api",
    reuseExistingServer: false,
    cwd: workspaceRoot,
    timeout: 120 * 1000,
  },
  projects: [
    {
      name: "setup",
      // The setup spec is a TSX file in this repo
      testMatch: /.*setup\.spec\.(ts|tsx)$/,
    },
    {
      name: "Admin Tests",
      testMatch: "**/adminPage.spec.ts",
      dependencies: ["setup"],
      use: {
        storageState,
      },
    },
  ],
});
