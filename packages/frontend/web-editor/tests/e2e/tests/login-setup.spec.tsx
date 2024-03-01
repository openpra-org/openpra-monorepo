import { test as setup, expect } from "@playwright/test";

const authFile = "packages/frontend/web-editor/e2e/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  const username = "playwright" + Math.floor(Math.random() * 1000);
  await page.goto("/");
  await page.getByPlaceholder("First name").fill("Playwright");
  await page.getByPlaceholder("Last name").fill("press");
  await page.getByPlaceholder("Email").fill(username + "@gmail.com");
  await page.getByPlaceholder("Username").fill(username);
  await page.getByPlaceholder("Password", { exact: true }).fill("Playwright12");
  await page.getByPlaceholder("Confirm Password").fill("Playwright12");
  await page.getByRole("button", { name: "Sign Up" }).click();
  await expect(page.getByTestId("user-menu")).toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});
