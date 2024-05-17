import { test, expect, Page } from "@playwright/test";

test.describe("Settings E2E", () => {
  /**
   * This function will use Page object to redirect to user profile page
   * @param page - Playwright Page object
   */
  async function goToUserProfilePage(page: Page): Promise<void> {
    await page.goto("/");
    await page.getByTestId("user-menu").click();
    await page.getByTestId("root-settings").click();
    await expect(page.getByTestId("profile-name")).toBeVisible();
  }

  /**
   * This function will use Page object to redirect to edit user profile page
   * @param page - Playwright Page object
   */
  async function goToUserEditPage(page: Page): Promise<void> {
    await goToUserProfilePage(page);
    await page.getByTestId("profile-details-container").hover();
    await page.getByTestId("profile-details-pencil").click();
  }

  test("can see settings icon", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("user-menu").click();
    await expect(page.getByTestId("root-settings")).toBeVisible();
  });

  test("can see user profile page", async ({ page }) => {
    await goToUserProfilePage(page);
    await expect(page.getByTestId("profile-name")).toBeVisible();
    await expect(page.getByTestId("profile-username")).toBeVisible();
    await expect(page.getByTestId("profile-email")).toBeVisible();
  });

  test("can see edit user pencil icon", async ({ page }) => {
    await goToUserProfilePage(page);
    await page.getByTestId("profile-details-container").hover();
    await expect(page.getByTestId("profile-details-pencil")).toBeVisible();
  });

  test("can see the edit user profile", async ({ page }) => {
    await goToUserEditPage(page);
    await expect(page.getByTestId("edit-user-title")).toBeVisible();
  });

  test("can see the correct profile details", async ({ page }) => {
    await goToUserEditPage(page);
    await expect(page.getByTestId("edit-user-first-name")).toHaveValue("Playwright");
    await expect(page.getByTestId("edit-user-last-name")).toHaveValue("press");
  });

  test("can edit user's details", async ({ page }) => {
    await goToUserEditPage(page);
    await expect(page.getByTestId("edit-user-first-name")).toHaveValue("Playwright");
    await page.getByTestId("edit-user-last-name").fill("suppress");
    await page.getByTestId("edit-user-first-name").fill("Playwright Changed");
    await page.getByTestId("edit-user-username").fill("new_username");
    await page.getByTestId("edit-user-email").fill("new_email@gmail.com");
    await page.getByTestId("edit-user-submit").click();
    await goToUserProfilePage(page);
    await expect(page.getByTestId("profile-name")).toHaveText("Playwright Changed suppress");
    await expect(page.getByTestId("profile-username")).toHaveText("new_username");
    await expect(page.getByTestId("profile-email")).toHaveText("new_email@gmail.com");
  });
});
