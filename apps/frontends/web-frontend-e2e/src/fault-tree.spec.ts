import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from "@playwright/test";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:4201";
const TEST_USERNAME = "fault_tree_e2e";
const TEST_PASSWORD = "Playwright!42";
const SOURCE_SYSTEM_ID = "SYS-GUARD";
const SOURCE_SYSTEM_NAME = "Guard vessel";
const TARGET_SYSTEM_ID = "SYS-PRIMARY";
const TARGET_TREE_CODE = "PCS-TOP";
const SHARED_BASIC_EVENT_CODE = "RPS-DVA-FS";
const TREE_NAME = "E2E basic-event and transfer tree";

interface ProjectResponse {
  id: string;
}

interface WorkbookResponse {
  id: string;
}

interface SyFaultTreeModel {
  uuid: string;
  systemReference: string;
  code: string;
  name: string;
  topGate: { gateId: string } | null;
  gates: Array<{ id: string }>;
  gateInputs: Array<{ id: string; gateId: string; childId: string }>;
  leafNodes: Array<{
    id: string;
    kind: string;
    basicEventId?: string;
    target?: { modelId: string; entityId: string };
  }>;
}

interface SyWorkbookResponse {
  revision: number;
  mef: {
    systemLogicModels: SyFaultTreeModel[];
    systemBasicEvents: Array<{ uuid: string; code: string; probability?: number }>;
  };
}

interface EsFaultTreeTopEventReference {
  referenceType: "FAULT_TREE_TOP_EVENT";
  workbookId: string;
  modelId: string;
  entityId: string;
}

interface EsWorkbookResponse {
  revision: number;
  mef: {
    eventTrees: Array<{
      uuid: string;
      functionalEvents: Record<
        string,
        { uuid: string; faultTreeTopEvent?: EsFaultTreeTopEventReference }
      >;
    }>;
  };
}

interface LoginResponse {
  token: string;
}

interface FaultTreeAnalysisResult {
  owner: { workbookRevision: number };
  topEventProbability: number;
  minimalCutSetCount: number;
  leadingCutSets: Array<{
    rank: number;
    order: number;
    probability: number;
    contribution: number;
    events: Array<{ basicEventId: string; complemented: boolean }>;
  }>;
}

interface JsonResponse {
  ok(): boolean;
  status(): number;
  text(): Promise<string>;
}

let api: APIRequestContext;
let token = "";
let projectId = "";
let workbookId = "";
let htgrWorkbookId = "";
let htgrSystemId = "";
let esWorkbookId = "";
let linkedEventTreeId = "";
let linkedFunctionalEventId = "";
let targetModelId = "";
let targetGateId = "";
let sharedBasicEventId = "";
let expectedCutSets: Array<{ basicEventId: string; code: string; probability: number }> = [];

async function json<T>(response: JsonResponse, action: string): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${action} failed (${response.status()}): ${body}`).toBeTruthy();
  return JSON.parse(body) as T;
}

async function waitForWorkbookSave(page: Page, action: () => Promise<void>): Promise<void> {
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PATCH"
    && response.url().includes(`/api/sy-workbooks/${workbookId}`)
    && response.ok());
  await action();
  await saved;
  await expect(page.getByTestId("fault-tree-editor").getByText("Saved", { exact: true })).toBeVisible();
}

async function openSystemModels(page: Page, systemId = SOURCE_SYSTEM_ID): Promise<Locator> {
  await page.getByRole("button", { name: "System Models", exact: true }).click();
  const systemSelect = page.locator(`select:has(option[value="${systemId}"])`);
  await expect(systemSelect).toBeVisible();
  await systemSelect.selectOption(systemId);
  return page.getByTestId("fault-tree-editor");
}

test.beforeAll(async () => {
  const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const signup = await anonymous.post("/api/auth/signup", {
    data: {
      fullName: "Fault Tree Playwright",
      email: "fault-tree-e2e@example.test",
      organization: "OpenPRA",
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    },
  });
  expect([201, 409]).toContain(signup.status());

  const login = await json<LoginResponse>(
    await anonymous.post("/api/auth/login", {
      data: { identifier: TEST_USERNAME, password: TEST_PASSWORD },
    }),
    "Log in the Playwright user",
  );
  token = login.token;
  await anonymous.dispose();

  api = await playwrightRequest.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const project = await json<ProjectResponse>(
    await api.post("/api/projects", {
      data: { name: `Fault tree E2E ${suffix}`, mode: "internal-events", pageLayout: "modern" },
    }),
    "Create a persistent E2E project",
  );
  projectId = project.id;

  const workbook = await json<WorkbookResponse>(
    await api.post(`/api/projects/${projectId}/workbooks`, {
      data: { elementCode: "SY", name: "Fault-tree vertical slice" },
    }),
    "Create an SY workbook",
  );
  workbookId = workbook.id;

  const loaded = await json<SyWorkbookResponse>(
    await api.post(`/api/sy-workbooks/${workbookId}/load-example`, { data: { example: "sfr" } }),
    "Load the deterministic SFR example",
  );
  const sourceModel = loaded.mef.systemLogicModels.find(({ systemReference }) => systemReference === SOURCE_SYSTEM_ID);
  expect(sourceModel, "The SFR example must include the Guard vessel logic model").toBeDefined();
  const targetModel = loaded.mef.systemLogicModels.find(({ systemReference }) => systemReference === TARGET_SYSTEM_ID);
  expect(targetModel?.topGate, "The SFR example must include a quantified primary-system tree").not.toBeNull();
  targetModelId = targetModel!.uuid;
  targetGateId = targetModel!.topGate!.gateId;
  const sharedEvent = loaded.mef.systemBasicEvents.find(({ code }) => code === SHARED_BASIC_EVENT_CODE);
  expect(sharedEvent?.probability, "The selected basic event must have a seeded probability").toBeDefined();
  sharedBasicEventId = sharedEvent!.uuid;

  const eventById = new Map(loaded.mef.systemBasicEvents.map((event) => [event.uuid, event]));
  expectedCutSets = [
    { basicEventId: sharedBasicEventId, code: sharedEvent!.code, probability: sharedEvent!.probability! },
    ...targetModel!.leafNodes.flatMap((leaf) => {
      if (leaf.kind !== "BASIC_EVENT_REFERENCE") return [];
      expect(leaf.basicEventId).toBeDefined();
      const event = eventById.get(leaf.basicEventId!);
      expect(event?.probability, `Target event ${leaf.basicEventId!} must have a probability`).toBeDefined();
      return [{ basicEventId: leaf.basicEventId!, code: event!.code, probability: event!.probability! }];
    }),
  ].sort((left, right) =>
    right.probability - left.probability
    || left.basicEventId.localeCompare(right.basicEventId));

  await json<SyWorkbookResponse>(
    await api.delete(
      `/api/sy-workbooks/${workbookId}/fault-trees/${sourceModel!.uuid}?expectedRevision=${loaded.revision}`,
    ),
    "Remove the source model so creation is exercised through the UI",
  );

  const htgrWorkbook = await json<WorkbookResponse>(
    await api.post(`/api/projects/${projectId}/workbooks`, {
      data: { elementCode: "SY", name: "HTGR fault-tree visual regression" },
    }),
    "Create an HTGR SY workbook",
  );
  htgrWorkbookId = htgrWorkbook.id;
  const loadedHtgr = await json<SyWorkbookResponse>(
    await api.post(`/api/sy-workbooks/${htgrWorkbookId}/load-example`, {
      data: { example: "htgr" },
    }),
    "Load the deterministic HTGR example",
  );
  const htgrModel = loadedHtgr.mef.systemLogicModels.find(
    ({ topGate, gateInputs }) => topGate !== null && gateInputs.length > 0,
  );
  expect(htgrModel, "The HTGR example must include a connected fault tree").toBeDefined();
  htgrSystemId = htgrModel!.systemReference;

  const esWorkbook = await json<WorkbookResponse>(
    await api.post(`/api/projects/${projectId}/workbooks`, {
      data: { elementCode: "ES", name: "Fault-tree reference consumer" },
    }),
    "Create a persistent ES workbook",
  );
  esWorkbookId = esWorkbook.id;
  const loadedEs = await json<EsWorkbookResponse>(
    await api.post(`/api/es-workbooks/${esWorkbookId}/load-example`, {
      data: { example: "sfr" },
    }),
    "Load the deterministic ES reference consumer",
  );
  const linkedTree = loadedEs.mef.eventTrees[0];
  const linkedFunctionalEvent = Object.values(linkedTree?.functionalEvents ?? {})[0];
  expect(linkedTree, "The ES example must include an event tree").toBeDefined();
  expect(linkedFunctionalEvent, "The ES event tree must include a functional event").toBeDefined();
  linkedEventTreeId = linkedTree!.uuid;
  linkedFunctionalEventId = linkedFunctionalEvent!.uuid;
});

test.afterAll(async () => {
  if (api === undefined) return;
  if (projectId !== "") {
    const cleanup = await api.delete(`/api/projects/${projectId}`);
    expect(cleanup.status(), "Clean up the exact E2E project").toBe(204);
  }
  await api.dispose();
});

test("authors, persists, quantifies, and invalidates a transferred fault tree", async ({ page }, testInfo) => {
  await page.addInitScript((jwt) => window.localStorage.setItem("id_token", jwt), token);
  await page.goto(`/sy-workbooks/${workbookId}`);

  await page.getByRole("button", { name: "System Models", exact: true }).click();
  const systemSelect = page.locator(`select:has(option[value="${SOURCE_SYSTEM_ID}"])`);
  await expect(systemSelect).toBeVisible();
  await systemSelect.selectOption(SOURCE_SYSTEM_ID);
  await expect(page.getByRole("button", { name: "Create fault tree" })).toBeVisible();

  await waitForWorkbookSave(page, async () => {
    await page.getByRole("button", { name: "Create fault tree" }).click();
  });
  let editor = page.getByTestId("fault-tree-editor");
  await expect(editor).toBeVisible();

  await waitForWorkbookSave(page, async () => {
    await editor.getByRole("button", { name: "Create top gate" }).click();
  });
  await waitForWorkbookSave(page, async () => {
    const treeName = editor.getByLabel("Fault-tree name");
    await treeName.fill(TREE_NAME);
    await treeName.press("Enter");
  });

  const topGate = editor.locator("button.ftbox--gate").first();
  await topGate.click({ button: "right" });
  let nodeMenu = editor.getByRole("menu", { name: /Actions for/ });
  await editor.screenshot({ path: testInfo.outputPath("fault-tree-gate-menu.png") });
  await nodeMenu.getByRole("menuitem", { name: "Add basic event" }).click();
  await nodeMenu.getByLabel("Search basic events").fill(SHARED_BASIC_EVENT_CODE);
  await editor.screenshot({ path: testInfo.outputPath("fault-tree-basic-event-chooser.png") });
  const matchingBasicEvent = nodeMenu.locator(".fteditor__context-results").getByRole("menuitem");
  await expect(matchingBasicEvent).toHaveCount(1);
  await waitForWorkbookSave(page, async () => {
    await matchingBasicEvent.click();
  });
  await topGate.click({ button: "right" });
  nodeMenu = editor.getByRole("menu", { name: /Actions for/ });
  await waitForWorkbookSave(page, async () => {
    await nodeMenu.getByRole("menuitem", { name: "Add transfer" }).click();
  });

  const transferNode = editor.locator("button.ftbox--tr").filter({ hasText: "New transfer" });
  await expect(transferNode).toBeVisible();
  const viewportBeforeInspector = await editor.locator(".fteditor__viewport").boundingBox();
  await transferNode.click();
  const viewportAfterInspector = await editor.locator(".fteditor__viewport").boundingBox();
  expect(viewportAfterInspector?.width).toBe(viewportBeforeInspector?.width);
  expect(viewportAfterInspector?.height).toBe(viewportBeforeInspector?.height);
  const inspectorBox = await editor.getByLabel("Selected fault-tree node inspector").boundingBox();
  const fittedStageBox = await editor.locator(".fteditor__stage").boundingBox();
  expect(fittedStageBox!.x + fittedStageBox!.width).toBeLessThanOrEqual(inspectorBox!.x + 1);
  expect(fittedStageBox!.y + fittedStageBox!.height).toBeLessThanOrEqual(
    viewportAfterInspector!.y + viewportAfterInspector!.height + 1,
  );
  await waitForWorkbookSave(page, async () => {
    await editor.getByLabel("Transfer target").selectOption(`${targetModelId}|${targetGateId}`);
  });

  await expect(editor.locator("button.ftbox--be").filter({ hasText: SHARED_BASIC_EVENT_CODE })).toBeVisible();
  await expect(transferNode).toContainText(`To ${TARGET_TREE_CODE}`);
  await expect(editor.getByTestId("fault-tree-edge")).toHaveCount(2);
  const edgePresentation = await editor.getByTestId("fault-tree-edge").first().evaluate((edge) => ({
    stroke: getComputedStyle(edge).stroke,
    width: getComputedStyle(edge).strokeWidth,
  }));
  expect(edgePresentation.stroke).not.toBe("none");
  expect(Number.parseFloat(edgePresentation.width)).toBeGreaterThanOrEqual(2);

  const basicEventNode = editor.locator("button.ftbox--be").filter({ hasText: SHARED_BASIC_EVENT_CODE });
  await basicEventNode.click({ button: "right" });
  const leafMenu = editor.getByRole("menu", { name: /Actions for/ });
  await expect(leafMenu.getByRole("menuitem", { name: "Delete node" })).toBeVisible();
  await expect(leafMenu.getByRole("menuitem", { name: "Add gate" })).toHaveCount(0);
  await expect(leafMenu.getByRole("menuitem", { name: "Add basic event" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const viewportBox = await editor.locator(".fteditor__viewport").boundingBox();
  const svgBox = await editor.locator(".ftsvg").boundingBox();
  const svgExtent = await editor.locator(".ftsvg").evaluate((svg) => ({
    width: Number(svg.getAttribute("width")),
    height: Number(svg.getAttribute("height")),
  }));
  const controlsBox = await editor.getByLabel("Fault-tree canvas controls").boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(svgExtent.width).toBeGreaterThan(300);
  expect(svgExtent.height).toBeGreaterThan(300);
  expect(svgBox!.height).toBeLessThan(svgExtent.height);
  expect(controlsBox!.x + controlsBox!.width).toBeLessThanOrEqual(viewportBox!.x + viewportBox!.width);
  await expect(editor.getByLabel("Add fault-tree node")).toHaveCount(0);
  await expect(editor.getByLabel("Fault-tree legend")).toHaveCount(0);

  await topGate.click({ button: "right" });
  nodeMenu = editor.getByRole("menu", { name: /Actions for/ });
  const contextBox = await nodeMenu.boundingBox();
  expect(contextBox!.x).toBeGreaterThanOrEqual(viewportBox!.x);
  expect(contextBox!.y).toBeGreaterThanOrEqual(viewportBox!.y);
  expect(contextBox!.x + contextBox!.width).toBeLessThanOrEqual(viewportBox!.x + viewportBox!.width);
  expect(contextBox!.y + contextBox!.height).toBeLessThanOrEqual(viewportBox!.y + viewportBox!.height);
  await expect(nodeMenu.getByRole("menuitem", { name: "Delete node" })).toBeVisible();
  await page.keyboard.press("Escape");

  const zoomBeforePan = await editor.getByLabel("Zoom level").textContent();
  const transformBeforePan = await editor.locator(".fteditor__stage").evaluate((stage) => getComputedStyle(stage).transform);
  await editor.locator(".fteditor__viewport").dispatchEvent("wheel", { deltaX: 0, deltaY: 60 });
  await expect(editor.getByLabel("Zoom level")).toHaveText(zoomBeforePan!);
  const transformAfterPan = await editor.locator(".fteditor__stage").evaluate((stage) => getComputedStyle(stage).transform);
  expect(transformAfterPan).toBe(transformBeforePan);
  await waitForWorkbookSave(page, async () => {
    await editor.getByRole("button", { name: "Fit" }).click();
  });
  await editor.screenshot({ path: testInfo.outputPath("fault-tree-wide.png") });
  await editor.locator(".ftsvg").screenshot({ path: testInfo.outputPath("fault-tree-svg.png") });

  await page.setViewportSize({ width: 760, height: 900 });
  await page.waitForFunction(() => {
    const rail = document.querySelector<HTMLElement>('[aria-label="SY analysis steps"]');
    const dock = document.querySelector<HTMLElement>('[aria-label="Conformance checklist"]');
    return rail !== null && dock !== null
      && rail.getBoundingClientRect().right <= 1
      && dock.getBoundingClientRect().left >= window.innerWidth - 1;
  });
  await expect(editor.getByLabel("Selected fault-tree node inspector")).toBeVisible();
  const narrowViewportBox = await editor.locator(".fteditor__viewport").boundingBox();
  const narrowControlsBox = await editor.getByLabel("Fault-tree canvas controls").boundingBox();
  expect(narrowControlsBox!.x + narrowControlsBox!.width).toBeLessThanOrEqual(narrowViewportBox!.x + narrowViewportBox!.width);
  await editor.screenshot({ path: testInfo.outputPath("fault-tree-narrow.png") });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.reload();
  editor = await openSystemModels(page);
  await expect(editor).toBeVisible();
  await expect(editor.getByLabel("Fault-tree name")).toHaveValue(TREE_NAME);
  await expect(editor.locator("button.ftbox--be").filter({ hasText: SHARED_BASIC_EVENT_CODE })).toBeVisible();
  const reloadedTransfer = editor.locator("button.ftbox--tr").filter({ hasText: "New transfer" });
  await expect(reloadedTransfer).toContainText(`To ${TARGET_TREE_CODE}`);

  await reloadedTransfer.dispatchEvent("click");
  await editor.getByRole("button", { name: "Open transfer target" }).click();
  await expect(page.locator(`select:has(option[value="${SOURCE_SYSTEM_ID}"])`)).toHaveValue(TARGET_SYSTEM_ID);
  await expect(page.getByTestId("fault-tree-editor").getByLabel("Tree code")).toHaveValue(TARGET_TREE_CODE);
  await page.locator(`select:has(option[value="${SOURCE_SYSTEM_ID}"])`).selectOption(SOURCE_SYSTEM_ID);
  editor = page.getByTestId("fault-tree-editor");

  const runResponse = page.waitForResponse((response) =>
    response.request().method() === "POST"
    && response.url().includes(`/api/sy-workbooks/${workbookId}/fault-trees/`)
    && response.url().endsWith("/runs"));
  const resultResponse = page.waitForResponse((response) =>
    response.request().method() === "GET"
    && response.url().includes(`/api/sy-workbooks/${workbookId}/fault-trees/`)
    && response.url().endsWith("/result")
    && response.ok());
  await editor.getByRole("button", { name: "Run analysis" }).click();
  await json<unknown>(await runResponse, "Execute the authored fault tree");
  const exactResult = await json<FaultTreeAnalysisResult>(await resultResponse, "Read exact fault-tree results");

  expect(exactResult.topEventProbability).toBeCloseTo(0.006363209690436578, 14);
  expect(exactResult.minimalCutSetCount).toBe(8);
  expect(exactResult.leadingCutSets).toHaveLength(8);
  expect(exactResult.leadingCutSets.every(({ order }) => order === 1)).toBeTruthy();
  expect(exactResult.leadingCutSets.map(({ events }) => events[0].basicEventId)).toEqual(
    expectedCutSets.map(({ basicEventId }) => basicEventId),
  );
  exactResult.leadingCutSets.forEach((cutSet, index) => {
    expect(cutSet.probability).toBeCloseTo(expectedCutSets[index].probability, 14);
    expect(cutSet.contribution).toBeCloseTo(
      expectedCutSets[index].probability / exactResult.topEventProbability,
      14,
    );
  });

  const results = editor.getByRole("region", { name: "Fault-tree analysis results" });
  await expect(results.getByText("Exact top-event probability").locator("..").getByLabel("6.36 times 10 to the power of −3")).toBeVisible();
  await expect(results.getByText("Minimal cut sets").locator("..")).toContainText("8");
  await expect(results.locator("tbody tr")).toHaveCount(8);
  await expect(results.locator("tbody tr").first()).toContainText(expectedCutSets[0].code);
  await expect(results.locator("tbody tr").first()).not.toContainText(expectedCutSets[0].basicEventId);
  await expect(results.locator("tbody tr").first().getByLabel("1.50 times 10 to the power of −3")).toBeVisible();
  await expect(results.locator("tbody tr").first()).toContainText("23.6%");
  await results.screenshot({ path: testInfo.outputPath("fault-tree-analysis-results.png") });

  await waitForWorkbookSave(page, async () => {
    const treeName = editor.getByLabel("Fault-tree name");
    await treeName.fill(`${TREE_NAME} revised`);
    await treeName.press("Enter");
  });
  await expect(editor.getByText("Results stale", { exact: true })).toBeVisible();
  await expect(results.getByText("Results are stale", { exact: true })).toBeVisible();

  const persisted = await json<SyWorkbookResponse>(
    await api.get(`/api/sy-workbooks/${workbookId}`),
    "Reload the persisted SY workbook",
  );
  const savedTree = persisted.mef.systemLogicModels.find(({ systemReference }) => systemReference === SOURCE_SYSTEM_ID);
  expect(savedTree?.name).toBe(`${TREE_NAME} revised`);
  expect(savedTree?.gates).toHaveLength(1);
  expect(savedTree?.leafNodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "BASIC_EVENT_REFERENCE", basicEventId: sharedBasicEventId }),
    expect.objectContaining({
      kind: "TRANSFER_REFERENCE",
      target: { modelId: targetModelId, entityId: targetGateId },
    }),
  ]));
  expect(persisted.revision).toBeGreaterThan(exactResult.owner.workbookRevision);
  await expect(page.getByText(SOURCE_SYSTEM_NAME, { exact: true }).first()).toBeVisible();

  await page.goto(`/es-workbooks/${esWorkbookId}`);
  await page.getByRole("button", { name: "Event Sequences", exact: true }).click();
  await page.getByLabel("Event tree", { exact: true }).selectOption(linkedEventTreeId);
  let eventTreeEditor = page.getByTestId("event-tree-editor");
  await eventTreeEditor.locator(".esdg__box").first().click();
  let eventInspector = eventTreeEditor.getByLabel("Event-tree selection inspector");
  await eventInspector.getByRole("button", { name: /(?:Link fault tree|Change link)/i }).click();

  const picker = page.getByRole("dialog", { name: /Select a fault-tree top event for/i });
  await expect(picker).toBeVisible();
  await picker.getByLabel("Systems workbook").selectOption(workbookId);
  const faultTreeSelect = picker.locator("select").nth(1);
  await expect(faultTreeSelect).toBeEnabled();
  await faultTreeSelect.selectOption(savedTree!.uuid);
  await picker.locator("button.ftbox--gate").click();

  const esSave = page.waitForResponse((response) =>
    response.request().method() === "PATCH"
    && response.url().includes(`/api/es-workbooks/${esWorkbookId}`)
    && response.ok());
  await picker.getByRole("button", { name: "Link selected top event" }).click();
  await esSave;
  await expect(page.getByRole("status")).toContainText("Saved");
  await expect(eventInspector).toContainText(savedTree!.uuid);
  await expect(eventInspector).toContainText(savedTree!.topGate!.gateId);

  await page.reload();
  await page.getByRole("button", { name: "Event Sequences", exact: true }).click();
  await page.getByLabel("Event tree", { exact: true }).selectOption(linkedEventTreeId);
  eventTreeEditor = page.getByTestId("event-tree-editor");
  await eventTreeEditor.locator(".esdg__box").first().click();
  eventInspector = eventTreeEditor.getByLabel("Event-tree selection inspector");
  await expect(eventInspector).toContainText(savedTree!.uuid);
  await expect(eventInspector).toContainText(savedTree!.topGate!.gateId);

  const persistedEs = await json<EsWorkbookResponse>(
    await api.get(`/api/es-workbooks/${esWorkbookId}`),
    "Reload the persisted ES workbook reference",
  );
  const persistedEventTree = persistedEs.mef.eventTrees.find(({ uuid }) => uuid === linkedEventTreeId);
  const persistedReference = Object.values(persistedEventTree?.functionalEvents ?? {}).find(
    ({ uuid }) => uuid === linkedFunctionalEventId,
  )?.faultTreeTopEvent;
  expect(persistedReference).toEqual({
    referenceType: "FAULT_TREE_TOP_EVENT",
    workbookId,
    modelId: savedTree!.uuid,
    entityId: savedTree!.topGate!.gateId,
  });
  expect(Object.keys(persistedReference ?? {}).sort()).toEqual([
    "entityId",
    "modelId",
    "referenceType",
    "workbookId",
  ]);
});

test("renders the default HTGR fault tree with node-local actions and connectors", async ({ page }, testInfo) => {
  await page.addInitScript((jwt) => window.localStorage.setItem("id_token", jwt), token);
  await page.goto(`/sy-workbooks/${htgrWorkbookId}`);

  const editor = await openSystemModels(page, htgrSystemId);
  await expect(editor).toBeVisible();
  expect(await editor.getByTestId("fault-tree-edge").count()).toBeGreaterThan(0);
  await expect(editor.getByLabel("Fault-tree canvas controls")).toBeVisible();
  await expect(editor.getByLabel("Add fault-tree node")).toHaveCount(0);
  await expect(editor.getByLabel("Fault-tree legend")).toHaveCount(0);
  await expect(editor.getByLabel("Selected fault-tree node inspector")).toHaveCount(0);
  await expect(editor.getByText(/Select a gate or event to inspect/i)).toHaveCount(0);

  await editor.locator("button.ftbox--gate").first().click({ button: "right" });
  const menu = editor.getByRole("menu", { name: /Actions for/ });
  await expect(menu.getByRole("menuitem", { name: "Add gate" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Add basic event" })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Delete node" })).toBeVisible();
  await page.keyboard.press("Escape");

  await editor.locator("button.ftbox--gate").nth(1).click({ button: "right" });
  const nonTopGateMenu = editor.getByRole("menu", { name: /Actions for/ });
  await expect(nonTopGateMenu.getByRole("menuitem", { name: "Add gate" })).toBeVisible();
  await expect(nonTopGateMenu.getByRole("menuitem", { name: "Add basic event" })).toBeVisible();
  await expect(nonTopGateMenu.getByRole("menuitem", { name: "Delete node" })).toBeVisible();
  await page.keyboard.press("Escape");

  const svgBox = await editor.locator(".ftsvg").boundingBox();
  const viewportBox = await editor.locator(".fteditor__viewport").boundingBox();
  const stageBox = await editor.locator(".fteditor__stage").boundingBox();
  const edgePresentation = await editor.getByTestId("fault-tree-edge").first().evaluate((edge) => ({
    stroke: getComputedStyle(edge).stroke,
    width: getComputedStyle(edge).strokeWidth,
  }));
  expect(stageBox!.x).toBeGreaterThanOrEqual(viewportBox!.x);
  expect(stageBox!.y).toBeGreaterThanOrEqual(viewportBox!.y);
  expect(stageBox!.x + stageBox!.width).toBeLessThanOrEqual(viewportBox!.x + viewportBox!.width + 1);
  expect(stageBox!.y + stageBox!.height).toBeLessThanOrEqual(viewportBox!.y + viewportBox!.height + 1);
  expect(svgBox!.width).toBeGreaterThan(300);
  expect(svgBox!.height).toBeGreaterThan(300);
  expect(edgePresentation.stroke).not.toBe("none");
  expect(Number.parseFloat(edgePresentation.width)).toBeGreaterThanOrEqual(2);
  await editor.screenshot({ path: testInfo.outputPath("fault-tree-htgr.png") });
});
