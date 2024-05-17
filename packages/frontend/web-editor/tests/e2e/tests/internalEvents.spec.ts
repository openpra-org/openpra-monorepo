import { test, expect } from "@playwright/test";
import { SignUp } from "./signup.spec";

test.describe("Internal Events", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await SignUp({ page, username });
  });
  // if we want to access alias in test, we need to change arrow function => to function ()
  test("Can create events", async ({ page }) => {
    await page.getByRole("button", { name: "Create Internal Events" }).click();
    await page.getByLabel("Internal Events name").fill("IE 1");
    await page.getByLabel("Internal Events description").fill("IE 1 description");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.locator("a").filter({ hasText: "I1" }).click();
    await expect(page.locator("button").filter({ hasText: "Plant Operating State Analysis" })).toBeVisible();
  });
});
