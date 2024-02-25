import { test, expect } from "@playwright/test";
import { signUp, logOut } from "./signup.spec";

test.describe("Signup", () => {
  // if we want to access alias in test, we need to change arrow function => to function ()
  test("can register a new account", async ({ page }) => {
    // added delay as sometimes it can make tests flaky if typing too fast (default is 10)
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await signUp({ page, username });
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });

  test("Account already created", async ({ page }) => {
    // added delay as sometimes it can make tests flaky if typing too fast (default is 10)
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await signUp({ page, username });
    await logOut({ page });
    await signUp({ page, username });
    await expect(page.getByText("Invalid Username")).toBeVisible();
  });

  test("Incorrect input", async ({ page }) => {
    await page.goto("/");
    await page
      .getByPlaceholder("Password", { exact: true })
      .fill("Playwright12");
    await page.getByPlaceholder("Confirm Password").fill("Playwright");
    await page.getByPlaceholder("Email").fill("a");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await expect(page.getByText("First name is empty")).toBeVisible();
    await expect(page.getByText("Last name is empty")).toBeVisible();
    await expect(page.getByText("Passwords do not match")).toBeVisible();
    await expect(page.getByText("Invalid Username")).toBeVisible();
  });
});

test.describe("Login", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });
  // if we want to access alias in test, we need to change arrow function => to function ()
  test("Can Login", async ({ page }) => {
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await signUp({ page, username });
    await logOut({ page });
    await page.getByRole("tab", { name: "Login" }).click();
    await page.getByPlaceholder("Username").fill(username);
    await page
      .getByPlaceholder("Password", { exact: true })
      .fill("Playwright12");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });

  test("Invalid input", async ({ page }) => {
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await page.getByRole("tab", { name: "Login" }).click();
    await page.getByPlaceholder("Username").fill(username);
    await page
      .getByPlaceholder("Password", { exact: true })
      .fill("Playwright12");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.getByText("Invalid username or password")).toBeVisible();
  });
});
