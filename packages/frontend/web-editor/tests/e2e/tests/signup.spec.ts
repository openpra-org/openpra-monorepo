import { test, expect, Page } from "@playwright/test";

export async function SignUp({
  page,
  username,
}: {
  page: Page;
  username: string;
}): Promise<void> {
  await page.goto("/");
  await page.getByPlaceholder("First name").fill("Playwright");
  await page.getByPlaceholder("Last name").fill("press");
  await page.getByPlaceholder("Email").fill("playwright@gmail.com");
  await page.getByPlaceholder("Username").fill(username);
  await page.getByPlaceholder("Password", { exact: true }).fill("Playwright12");
  await page.getByPlaceholder("Confirm Password").fill("Playwright12");
  await page.getByRole("button", { name: "Sign Up" }).click();
}

export async function LogOut({ page }: { page: Page }): Promise<void> {
  await page.getByTestId("user-menu").click();
  await page.getByRole("button", { name: "Log out" }).click();
}

test.describe("Signup", () => {
  // if we want to access alias in test, we need to change arrow function => to function ()
  test("can register a new account", async ({ page }) => {
    // added delay as sometimes it can make tests flaky if typing too fast (default is 10)
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await SignUp({ page, username });
    await expect(page.getByTestId("user-menu")).toBeVisible();
  });

  test("Account already created", async ({ page }) => {
    // added delay as sometimes it can make tests flaky if typing too fast (default is 10)
    const username = "playwright" + Math.floor(Math.random() * 1000);
    await SignUp({ page, username });
    await LogOut({ page });
    await SignUp({ page, username });
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
