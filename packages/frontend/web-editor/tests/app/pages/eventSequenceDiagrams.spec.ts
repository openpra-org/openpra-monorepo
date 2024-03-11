import { test, expect } from "@playwright/test";
import { signUp } from "../../e2e/tests/signup.spec";

test.describe("event sequence test", () => {
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
      page.locator("button").filter({ hasText: "Event Sequence Diagrams" }),
    ).toHaveText("Event Sequence Diagrams");
  });

  test("creates event sequence diagram", async ({ page }) => {

    // open event sequence diagrams page
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({hasText: "Event Sequence Diagrams"}).click();

    // test event sequence diagram name
    const eventSequenceDiagramName = "ES" + Math.floor(Math.random() * 1000);

    //create an event sequence diagram
    await page
      .getByRole("button")
      .filter({ hasText: "Create Event Sequence Diagram" })
      .click();
    await page.getByLabel("Event Sequence Diagram Name").fill(eventSequenceDiagramName);
    await page.getByRole("button", {name: "Create", exact: true}).click();

    //TODO: Below part will be removed once navigation is fixed
    // re-navigate to the event sequence
    await page.locator("a").filter({hasText: internalEvent}).click();
    await page.getByRole("button").filter({hasText: "Event Sequence Diagrams"}).click();

    // expect
    await expect(page.locator("a").filter({hasText: eventSequenceDiagramName})).toHaveText(eventSequenceDiagramName);
  });

  test("opens editor and has default structure", async ({page}) => {
    // open event sequence page
    await page.locator("a").filter({ hasText: internalEvent }).click();
    await page.getByRole("button").filter({hasText: "Event Sequence Diagrams"}).click();

    // test event sequence diagram name
    const eventSequenceDiagramName = "ES" + Math.floor(Math.random() * 1000);

    //create an event sequence diagram
    await page
      .getByRole("button")
      .filter({ hasText: "Create Event Sequence Diagram" })
      .click();
    await page.getByLabel("Event Sequence Diagram Name").fill(eventSequenceDiagramName);
    await page.getByRole("button", {name: "Create", exact: true}).click();

    //TODO: Below part will be removed once navigation is fixed
    // re-navigate to the event sequence
    await page.locator("a").filter({hasText: internalEvent}).click();
    await page.getByRole("button").filter({hasText: "Event Sequence Diagrams"}).click();

    // open event sequence editor
    await page.locator("a").filter({hasText: eventSequenceDiagramName}).click();

    // expect
    await expect(page.getByTestId("initiating-event-node")).toContainText("Initiating Event");
  })
});
