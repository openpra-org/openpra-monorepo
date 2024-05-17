import { test, expect } from "@playwright/test";
import { signUp } from "../../e2e/tests/signup.spec";

test.describe("Fmea test", () => {
  const internalEvent = "IE" + Math.floor(Math.random() * 1000000);
  test.beforeEach(async ({ page }) => {
    const username = "test" + Math.floor(Math.random() * 1000000);
    await signUp({ page, username });

    await page.getByRole("button", { name: "Create Internal Events" }).click();

    await page.getByLabel("Internal Events name").fill(internalEvent);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.locator("a").filter({ hasText: internalEvent })).toHaveText(internalEvent);
  });

  test("displays internal events page", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await expect(page.getByRole("button").filter({ hasText: "Initiating Events" })).toHaveText("Initiating Events");
  });

  test("creates initiating event", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    // expect
    await expect(page.getByRole("button").filter({ hasText: "Add Row" }).first()).toHaveText("Add Row");
  });

  test("Add New Row", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    await page.getByRole("button").filter({ hasText: "Add Row" }).click();
    // expect
    await expect(page.locator('div[data-grid-visible-row-index="0"]')).toBeVisible();
  });

  test("Add New Column Modal", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    await page.getByRole("button").filter({ hasText: "Add Column" }).click();
    // expect
    await expect(page.locator("h1").filter({ hasText: "Add a New Column" })).toHaveText("Add a New Column");
  });

  test("Add New Column to datagrid", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    await page.getByRole("button").filter({ hasText: "Add Column" }).click();
    await page.getByLabel("Column Name").fill("Test Column");
    await page.getByRole("button").filter({ hasText: "Add Column" }).nth(1).click();

    // expect
    await expect(page.locator("(//div[text()='Test Column'])[1]")).toBeVisible();
  });

  test("Edit a row text cell", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    await page.getByRole("button").filter({ hasText: "Add Column" }).click();
    await page.getByLabel("Column Name").fill("Test Column For Edit");
    await page.getByRole("button").filter({ hasText: "Add Column" }).nth(1).click();
    await page.getByRole("button").filter({ hasText: "Add Row" }).click();
    await page
      .locator('div[data-grid-row-index="0"] >> div[data-testid="Test Column For Edit"]')
      .nth(1)
      .fill("Testing Text");
    await page.locator('div[data-grid-row-index="0"] >> div[data-testid="Test Column For Edit"]').nth(1).press("Tab");
    // expect
    await expect(
      page.locator('div[data-grid-row-index="0"] >> div[data-testid="Test Column For Edit"]').nth(1),
    ).toHaveText("Testing Text");
  });

  test("Edit a row dropdown cell", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    await page.getByRole("button").filter({ hasText: "Add Column" }).click();
    await page.getByLabel("Column Name").fill("Test Column For Edit DropDown");
    await page.locator(".euiModalBody .euiSelect.euiFormControlLayout--1icons").nth(0).selectOption({ index: 1 });

    await page.getByRole("button").filter({ hasText: "Add Option" }).click();
    await page.locator("//label[text()='Option 1']/following::input").fill("1");
    await page.getByRole("button").filter({ hasText: "Add Option" }).click();
    await page.getByRole("button").filter({ hasText: "Add Column" }).nth(1).click();
    await page
      .locator('[data-testid="Test Column For Edit DropDown"]')
      .nth(0)
      .locator("select.euiSelect")
      .selectOption({ value: "0" });
    await expect(
      page.locator('[data-testid="Test Column For Edit DropDown"]').nth(0).locator("select.euiSelect"),
    ).toHaveValue("0");
  });

  test("Edit New Column Modal", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();

    const initiatingEventName = "Initiating Event" + Math.floor(Math.random() * 1000);

    await page.getByRole("button").filter({ hasText: "Create Initiating Event" }).click();
    await page.getByLabel("Initiating Event name").fill(initiatingEventName);
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({ hasText: "Initiating Events" }).click();
    await page.locator("a").filter({ hasText: initiatingEventName }).click();
    await page.getByRole("button").filter({ hasText: "FMEA" }).first().click();
    await page.getByRole("button").filter({ hasText: "Add Column" }).click();
    await page.getByLabel("Column Name").fill("Test Column For Edit Modal");
    await page.getByRole("button").filter({ hasText: "Add Column" }).nth(1).click();
    await page.locator("(//div[@title='Test Column For Edit']//button)[1]").click();

    // expect
    await expect(page.locator("h1").filter({ hasText: "Edit Column" })).toHaveText("Edit Column");
  });
});
