import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:4201";
const TEST_USERNAME = "event_tree_e2e";
const TEST_PASSWORD = "Playwright!42";

interface ProjectResponse { id: string }
interface WorkbookResponse { id: string }
interface LoginResponse { token: string }
interface JsonResponse { ok(): boolean; status(): number; text(): Promise<string> }
interface SyWorkbookResponse {
  mef: {
    systemLogicModels: Array<{
      uuid: string;
      code: string;
      name: string;
      topGate: { gateId: string } | null;
      gates: Array<{ id: string; code: string }>;
      leafNodes: Array<{ kind: string }>;
    }>;
  };
}
interface EsWorkbookResponse {
  revision: number;
  mef: {
    eventTrees: Array<{
      uuid: string;
      name: string;
      initiatingEventFrequency?: { value: number };
      functionalEvents: Record<string, { uuid: string; name: string; faultTreeTopEvent?: { workbookId: string; modelId: string; entityId: string } }>;
      sequences: Record<string, { functionalEventStates?: Record<string, string> }>;
      branches: Record<string, { paths: Array<{ state: string }> }>;
    }>;
  };
}

let api: APIRequestContext;
let token = "";
let projectId = "";
let syWorkbookId = "";
let esWorkbookId = "";
let esqWorkbookId = "";
let faultTreeModelId = "";
let faultTreeTopGateId = "";
let faultTreeTopGateCode = "";
let faultTreeTopGateName = "";

async function json<T>(response: JsonResponse, action: string): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${action} failed (${response.status()}): ${body}`).toBeTruthy();
  return JSON.parse(body) as T;
}

async function waitForEsSave(page: Page, action: () => Promise<void>): Promise<void> {
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PATCH"
    && response.url().includes(`/api/es-workbooks/${esWorkbookId}`)
    && response.ok());
  await action();
  await saved;
  await expect(page.getByTestId("event-tree-editor").getByText("Saved", { exact: true })).toBeVisible();
}

test.beforeAll(async () => {
  const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const signup = await anonymous.post("/api/auth/signup", { data: {
    fullName: "Event Tree Playwright",
    email: "event-tree-e2e@example.test",
    organization: "OpenPRA",
    username: TEST_USERNAME,
    password: TEST_PASSWORD,
  } });
  expect([201, 409]).toContain(signup.status());
  const login = await json<LoginResponse>(await anonymous.post("/api/auth/login", {
    data: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
  }), "Log in the event-tree Playwright user");
  token = login.token;
  await anonymous.dispose();

  api = await playwrightRequest.newContext({ baseURL: BASE_URL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  projectId = (await json<ProjectResponse>(await api.post("/api/projects", {
    data: { name: `Event-tree E2E ${suffix}`, mode: "internal-events", pageLayout: "modern" },
  }), "Create the event-tree E2E project")).id;

  syWorkbookId = (await json<WorkbookResponse>(await api.post(`/api/projects/${projectId}/workbooks`, {
    data: { elementCode: "SY", name: "Event-tree fault-tree source" },
  }), "Create the source Systems Analysis workbook")).id;
  const systems = await json<SyWorkbookResponse>(await api.post(`/api/sy-workbooks/${syWorkbookId}/load-example`, {
    data: { example: "sfr" },
  }), "Load a quantifiable fault-tree source");
  const faultTree = systems.mef.systemLogicModels.find((candidate) =>
    candidate.topGate !== null
    && candidate.leafNodes.length > 0
    && candidate.leafNodes.every((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE"));
  expect(faultTree).toBeDefined();
  faultTreeModelId = faultTree!.uuid;
  faultTreeTopGateId = faultTree!.topGate!.gateId;
  faultTreeTopGateCode = faultTree!.gates.find(({ id }) => id === faultTreeTopGateId)!.code;
  faultTreeTopGateName = faultTree!.name;

  esWorkbookId = (await json<WorkbookResponse>(await api.post(`/api/projects/${projectId}/workbooks`, {
    data: { elementCode: "ES", name: "Event-tree vertical slice" },
  }), "Create the ES host workbook")).id;
  esqWorkbookId = (await json<WorkbookResponse>(await api.post(`/api/projects/${projectId}/workbooks`, {
    data: { elementCode: "ESQ", name: "Event-tree read-only consumer" },
  }), "Create the ESQ consumer workbook")).id;
  await json(await api.post(`/api/esq-workbooks/${esqWorkbookId}/load-example`, {
    data: { example: "sfr" },
  }), "Load the ESQ event-tree example");
});

test.afterAll(async () => {
  if (api === undefined) return;
  if (projectId !== "") expect((await api.delete(`/api/projects/${projectId}`)).status()).toBe(204);
  await api.dispose();
});

test("creates, edits, reloads, validates, links, and quantifies the canonical event tree", async ({ page }, testInfo) => {
  await page.addInitScript((jwt) => window.localStorage.setItem("id_token", jwt), token);
  await page.goto(`/es-workbooks/${esWorkbookId}`);
  await page.getByRole("button", { name: "02 Event Sequences" }).click();

  const createSaved = page.waitForResponse((response) => response.request().method() === "PATCH" && response.url().includes(`/api/es-workbooks/${esWorkbookId}`) && response.ok());
  await page.getByRole("button", { name: "Add event tree" }).click();
  await createSaved;
  let editor = page.getByTestId("event-tree-editor");
  await expect(editor).toBeVisible();

  await waitForEsSave(page, async () => {
    await editor.getByLabel("Event-tree name").fill("Loss of flow event tree");
    await editor.getByLabel("Event-tree name").press("Tab");
  });
  await waitForEsSave(page, async () => {
    await editor.getByLabel("Initiating-event frequency").fill("0.01");
    await editor.getByLabel("Initiating-event frequency").press("Tab");
  });
  await waitForEsSave(page, async () => {
    await editor.getByRole("button", { name: "Add functional event" }).click();
  });
  await expect(editor.getByLabel("Event-tree selection inspector")).toBeVisible();
  await waitForEsSave(page, async () => {
    await editor.getByLabel("Event-tree selection inspector").getByLabel("Name").fill("Reactor trip");
    await editor.getByLabel("Event-tree selection inspector").getByLabel("Name").press("Tab");
  });

  await editor.getByRole("button", { name: "Link fault tree" }).click();
  const picker = page.getByRole("dialog", { name: /Select a fault-tree top event/ });
  await expect(picker).toBeVisible();
  await expect(picker.locator("select").first()).toHaveValue(syWorkbookId);
  await picker.locator("select").nth(1).selectOption(faultTreeModelId);
  const topGate = picker.getByRole("button", { name: new RegExp(faultTreeTopGateName, "i") }).first();
  await expect(topGate).toBeVisible();
  await topGate.click();
  await expect(picker.locator(".eslink__selection-summary")).toHaveText(faultTreeTopGateCode);
  await expect(picker.getByText(faultTreeTopGateId)).toHaveCount(0);
  await waitForEsSave(page, async () => {
    await picker.getByRole("button", { name: "Link selected top event" }).click();
  });

  await expect(editor.getByRole("button", { name: "Valid" })).toBeVisible();
  await editor.getByRole("button", { name: "Run", exact: true }).click();
  await expect(editor.getByText("Latest result")).toBeVisible();
  await expect(editor.getByText("2 quantified sequences")).toBeVisible();
  await editor.getByRole("button", { name: "Sequence table" }).click();
  await expect(editor.locator("tbody tr")).toHaveCount(2);
  await editor.screenshot({ path: testInfo.outputPath("event-tree-editor.png") });

  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForFunction(() => {
    const rail = document.querySelector<HTMLElement>('[aria-label="ES analysis steps"]');
    const dock = document.querySelector<HTMLElement>('[aria-label="Conformance checklist"]');
    return rail !== null && dock !== null
      && rail.getBoundingClientRect().right <= 1
      && dock.getBoundingClientRect().left >= window.innerWidth - 1;
  });
  const narrowInspectorOverflow = await editor.getByLabel("Event-tree selection inspector").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(narrowInspectorOverflow.scrollWidth).toBeLessThanOrEqual(narrowInspectorOverflow.clientWidth);
  expect(narrowInspectorOverflow.scrollHeight).toBeLessThanOrEqual(narrowInspectorOverflow.clientHeight);
  await editor.screenshot({ path: testInfo.outputPath("event-tree-narrow.png") });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.reload();
  await page.getByRole("button", { name: "02 Event Sequences" }).click();
  editor = page.getByTestId("event-tree-editor");
  await expect(editor.getByLabel("Event-tree name")).toHaveValue("Loss of flow event tree");
  await expect(editor.getByText("Reactor trip?")).toBeVisible();

  const persisted = await json<EsWorkbookResponse>(await api.get(`/api/es-workbooks/${esWorkbookId}`), "Reload the persisted event tree");
  expect(persisted.mef.eventTrees).toHaveLength(1);
  const tree = persisted.mef.eventTrees[0]!;
  expect(tree.initiatingEventFrequency).toEqual({ value: 0.01 });
  expect(Object.values(tree.functionalEvents)).toEqual([
    expect.objectContaining({
      name: "Reactor trip",
      faultTreeTopEvent: { workbookId: syWorkbookId, modelId: faultTreeModelId, entityId: faultTreeTopGateId, referenceType: "FAULT_TREE_TOP_EVENT" },
    }),
  ]);
  expect(Object.values(tree.sequences)).toHaveLength(2);
  expect(Object.values(tree.branches)[0]?.paths.map((path) => path.state).sort()).toEqual(["FAILURE", "SUCCESS"]);
});

test("uses the canonical event-tree component for the ESQ read-only host", async ({ page }, testInfo) => {
  await page.addInitScript((jwt) => window.localStorage.setItem("id_token", jwt), token);
  await page.goto(`/esq-workbooks/${esqWorkbookId}`);
  await page.getByRole("button", { name: "Integrate & Quantify", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Linked event-tree model" })).toBeVisible();
  const editor = page.getByTestId("event-tree-editor");
  await expect(editor).toBeVisible();
  await expect(editor.getByText("Reactor trip?").first()).toBeVisible();
  await expect(editor.getByRole("button", { name: "Add functional event" })).toHaveCount(0);
  await expect(editor.getByRole("button", { name: "Undo event-tree edit" })).toHaveCount(0);
  await editor.screenshot({ path: testInfo.outputPath("event-tree-read-only.png") });
});
