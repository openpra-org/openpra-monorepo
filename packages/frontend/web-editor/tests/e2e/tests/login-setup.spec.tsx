import { test, expect } from "@playwright/test";
import { screen } from "@testing-library/react";

test.describe("SignUp Form Tests", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  const testUser = {
    firstName: "Test",
    lastName: "User",
    email: "testuser@example.com",
    username: "testuser123",
    password: "TestPassword123",
  };

  test("validates empty form fields", async ({ page }) => {
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByText("First name is empty")).toBeVisible();
    await expect(page.getByText("Last name is empty")).toBeVisible();
    await expect(page.getByText("Email invalid or already exists!")).toBeVisible();
    await expect(page.getByText("Username is invalid!")).toBeVisible();
  });

  test("validates email format", async ({ page }) => {
    await page.getByPlaceholder("Email").fill("invalid-email");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByText("Email invalid or already exists!")).toBeVisible();
  });

  test("checks email debouncing", async ({ page }) => {
    const email = "test@example.com";
    await page.getByPlaceholder("Email").fill(email);
    // Wait for debounce
    await page.waitForTimeout(1000);
    await expect(page.getByPlaceholder("Email")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("checks username debouncing", async ({ page }) => {
    const username = "testuser";
    await page.getByPlaceholder("Username").fill(username);
    // Wait for debounce
    await page.waitForTimeout(1000);
    await expect(page.getByPlaceholder("Username")).not.toHaveAttribute("aria-invalid", "true");
  });

  test("validates password match", async ({ page }) => {
    await page.getByPlaceholder("Password", { exact: true }).fill("Password123");
    await page.getByPlaceholder("Confirm Password").fill("Password124");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
  });

  test("successful signup with valid data", async ({ page }) => {
    const username = "playwright" + Math.floor(Math.random() * 1000);
    const email = username + "@gmail.com";

    await page.getByPlaceholder("First name").fill("Playwright");
    await page.getByPlaceholder("Last name").fill("Test");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Username").fill(username);
    await page.getByPlaceholder("Password", { exact: true }).fill("Playwright12");
    await page.getByPlaceholder("Confirm Password").fill("Playwright12");

    // Wait for debounce validations
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });

  test("prevents duplicate registration after logout", async ({ page }) => {
    // First registration
    const username = "playwright" + Math.floor(Math.random() * 1000);
    const email = username + "@gmail.com";

    await page.getByPlaceholder("First name").fill("Playwright");
    await page.getByPlaceholder("Last name").fill("Test");
    await page.getByPlaceholder("Email").fill(email);
    await page.getByPlaceholder("Username").fill(username);
    await page.getByPlaceholder("Password", { exact: true }).fill("Playwright12");
    await page.getByPlaceholder("Confirm Password").fill("Playwright12");

    // Wait for debounce validations
    await page.waitForTimeout(1000);

    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByTestId("user-menu")).toBeVisible();

    // Logout
    await page.getByTestId("user-menu").click();
    await page.getByTestId("logout-button").click();

    // Attempt second registration with same credentials
    await page.goto("/");
    await page.getByPlaceholder("First name").fill(testUser.firstName);
    await page.getByPlaceholder("Last name").fill(testUser.lastName);
    await page.getByPlaceholder("Email").fill(testUser.email);
    await page.getByPlaceholder("Username").fill(testUser.username);
    await page.getByPlaceholder("Password", { exact: true }).fill(testUser.password);
    await page.getByPlaceholder("Confirm Password").fill(testUser.password);

    // Check for error messages
    await expect(page.getByText(/email.*exists/i)).toBeVisible();
    await expect(page.getByText(/username.*exists/i)).toBeVisible();
  });

  test("validates form field updates", async ({ page }) => {
    await page.getByPlaceholder("First name").fill("John");
    await page.getByPlaceholder("First name").clear();
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByText("First name is empty")).toBeVisible();
  });
});
