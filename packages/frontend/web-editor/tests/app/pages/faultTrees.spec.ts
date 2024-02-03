import { test, expect } from "@playwright/test";
import { signUp } from "../../e2e/tests/signup.spec";

test.describe("fault tree test", () => {
  const internalEvent = "IE" + Math.floor(Math.random() * 1000);
  test.beforeEach(async ({ page }) => {
    // sign up with a test user
    const username = "test" + Math.floor(Math.random() * 1000);
    await signUp({ page, username });

    // create a test internal event
    await page.getByRole("button", { name: "Create Internal Events" }).click();

    await page.getByLabel("Internal Events name").fill(internalEvent);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(
      page.locator("a").filter({ hasText: internalEvent }),
    ).toHaveText(internalEvent);
  });

  test("displays internal events page", async ({ page }) => {
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await expect(
      page.locator("button").filter({ hasText: "Fault Trees" }),
    ).toHaveText("Fault Trees");
  });

  test("creates fault tree", async ({ page }) => {

    // open fault tree page
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({hasText: "Fault Trees"}).click();

    // test fault tree name
    const faultTreeName = "FE" + Math.floor(Math.random() * 1000);

    //create a fault tree
    await page
      .getByRole("button")
      .filter({ hasText: "Create Fault Tree" })
      .click();
    await page.getByLabel("Fault Tree Name").fill(faultTreeName);
    await page.getByRole("button", {name: "Create", exact: true}).click();

    //TODO: Below part will be removed once navigation is fixed
    // re-navigate to the fault tree
    await page.locator("a").filter({hasText: internalEvent}).click();
    await page.getByRole("button").filter({hasText: "Fault Trees"}).click();

    // expect
    await expect(page.locator("a").filter({hasText: faultTreeName})).toHaveText(faultTreeName);
  });

  test("opens editor and has default structure", async ({page}) => {
    // open fault tree page
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({hasText: "Fault Trees"}).click();

    // test fault tree name
    const faultTreeName = "FE" + Math.floor(Math.random() * 1000);

    //create a fault tree
    await page
        .getByRole("button")
        .filter({ hasText: "Create Fault Tree" })
        .click();
    await page.getByLabel("Fault Tree Name").fill(faultTreeName);
    await page.getByRole("button", {name: "Create", exact: true}).click();

    //TODO: Below part will be removed once navigation is fixed
    // re-navigate to the fault tree
    await page.locator("a").filter({hasText: internalEvent}).click();
    await page.getByRole("button").filter({hasText: "Fault Trees"}).click();

    // open fault tree editor
    await page.locator("a").filter({hasText: faultTreeName}).click();

    // expect
    await expect(page.getByTestId("or-gate-node")).toContainText("OR Gate");
  })
});
