import path = require("path");
import { defineConfig } from "@playwright/test";
import { nxE2EPreset } from "@nx/playwright/preset";
import { workspaceRoot } from "@nx/devkit";

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env.BASE_URL ?? "http://localhost:4200";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export const STORAGE_STATE = path.join(__dirname, "playwright/.auth/user.json");

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
    command: "nx run-many -t serve --all",
    url: "http://localhost:4200",
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
  // projects: [
  //   {
  //     name: 'Signup',
  //     testMatch: 'signup.spec.ts',
  //   },
  //   {
  //     name: 'Login',
  //     testMatch: 'login.spec.ts',
  //     dependencies: ['Signup']
  //   },
  //   {
  //     name: 'Dashboard',
  //     testMatch: '**/*.dashboard.ts',
  //     dependencies: ['Login'],
  //     use: {
  //       storageState: STORAGE_STATE,
  //     },
  //   },
  // ],
});
