import path from "node:path";
import { defineConfig } from "@playwright/test";
import { nxE2EPreset } from "@nx/playwright/preset";
import { workspaceRoot } from "@nx/devkit";
const baseURL = process.env.BASE_URL ?? "http://localhost:4200";
const storageState = path.join(workspaceRoot, "packages/frontend/web-editor/e2e/.auth/user.json");
export default defineConfig({
  ...nxE2EPreset(__filename, { testDir: "./tests" }),
  use: {
    baseURL,
    trace: "on-first-retry",
    headless: true,
  },
  retries: 1,
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
