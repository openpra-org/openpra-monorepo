import { test, expect, Page } from "@playwright/test";

test.describe("Forgot Password", () => {
  async function goToLoginPage(page: Page): Promise<void> {
    // Land on root; many apps show Sign Up by default
    await page.goto("/");

    // If there's an explicit "Log in / Sign in" switch, try to click it.
    const loginSwitch =
      page.getByRole("tab", { name: "Login" }).first()
        .or(page.getByRole("button", { name: "Login" }).first())
        .or(page.getByRole("link", { name: "Login" }).first());

    // Click it if present
    if (await loginSwitch.count()) {
      await loginSwitch.click();
    }
  }

  async function openForgotPasswordFromLogin(page: Page): Promise<void> {
    await goToLoginPage(page);

    // Most reliable selector for your exact markup:
    // <Link to="/forgot-password">Forgot password? Click here to reset.</Link>
    const forgotByHref = page.locator('a[href="/forgot-password"]');

    // Fallbacks (if your router injects base prefixes etc.)
    const forgotByText = page.getByText("Forgot password? Click here to reset.", { exact: true });
    const forgotByRole = page.getByRole("link", { name: /forgot password\?\s*click here to reset\.?/i });

    const forgotLink = forgotByHref.or(forgotByText).or(forgotByRole);

    await expect(forgotLink).toBeVisible({ timeout: 10_000 });
    await forgotLink.click();

    await expect(page).toHaveURL(/\/forgot-password(?:\/)?$/);
  }

  test("opens via link from login, submits, and shows success toast", async ({ page }) => {
    await page.route("**/api/forgot/request-reset-password", async (route) => {
      const body = JSON.parse(route.request().postData() || "{}");
      expect(body.email).toBeTruthy();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ message: "If your email exists, a reset link has been sent." }),
      });
    });

    await openForgotPasswordFromLogin(page);

    await page.getByPlaceholder(/enter your email/i).fill("forgot_user@ncsu.edu");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByText(/reset link has been sent/i)).toBeVisible();
  });

  test("shows error toast when backend fails", async ({ page }) => {
    await page.route("**/api/forgot/request-reset-password", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Failed to send reset email" }),
      });
    });

    await openForgotPasswordFromLogin(page);

    await page.getByPlaceholder(/enter your email/i).fill("forgot_user@ncsu.edu");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByText(/failed to send reset email/i)).toBeVisible();
  });
});
