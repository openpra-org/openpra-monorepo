import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const BASE_URL = process.env["BASE_URL"] ?? "http://localhost:4201";
const TEST_USERNAME = "bayesian_network_e2e";
const TEST_PASSWORD = "Playwright!42";

interface ProjectResponse {
  id: string;
}

interface WorkbookResponse {
  id: string;
}

interface SyWorkbookResponse {
  mef: {
    systemLogicModels: Array<{
      uuid: string;
      leafNodes: Array<{ kind: string; basicEventId?: string }>;
    }>;
    systemBasicEvents: Array<{ uuid: string; code: string }>;
  };
}

interface EsqWorkbookResponse {
  revision: number;
  mef: {
    bayesianNetworks: Array<{
      modelId: string;
      code: string;
      name: string;
      nodes: Array<{ id: string; code: string; name: string }>;
      edges: Array<{ parentNodeId: string; childNodeId: string }>;
      conditionalProbabilityTables: Array<{
        nodeId: string;
        rows: Array<{ values: Array<{ probability: number }> }>;
      }>;
    }>;
    hclConfigurations: Array<{
      bayesianNetwork: { workbookId: string; modelId: string };
      bindings: Array<{
        faultTreeBasicEvent: { workbookId: string; entityId: string };
        bayesianNetworkNode: { workbookId: string; modelId: string; entityId: string };
        trueStateIds: string[];
      }>;
    }>;
  };
}

interface LoginResponse {
  token: string;
}

interface JsonResponse {
  ok(): boolean;
  status(): number;
  text(): Promise<string>;
}

let api: APIRequestContext;
let token = "";
let projectId = "";
let syWorkbookId = "";
let esqWorkbookId = "";
let faultTreeModelId = "";
let basicEventId = "";

async function json<T>(response: JsonResponse, action: string): Promise<T> {
  const body = await response.text();
  expect(response.ok(), `${action} failed (${response.status()}): ${body}`).toBeTruthy();
  return JSON.parse(body) as T;
}

async function waitForEsqSave(page: Page, action: () => Promise<void>): Promise<void> {
  const saved = page.waitForResponse((response) =>
    response.request().method() === "PATCH"
    && response.url().includes(`/api/esq-workbooks/${esqWorkbookId}`)
    && response.ok());
  await action();
  await saved;
  await expect(page.locator(".poshd__save-pill")).toContainText("Saved");
}

test.beforeAll(async () => {
  const anonymous = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const signup = await anonymous.post("/api/auth/signup", {
    data: {
      fullName: "Bayesian Network Playwright",
      email: "bayesian-network-e2e@example.test",
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
    "Log in the Bayesian-network Playwright user",
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
      data: { name: `Bayesian-network E2E ${suffix}`, mode: "internal-events", pageLayout: "modern" },
    }),
    "Create a persistent Bayesian-network E2E project",
  );
  projectId = project.id;

  const systemsWorkbook = await json<WorkbookResponse>(
    await api.post(`/api/projects/${projectId}/workbooks`, {
      data: { elementCode: "SY", name: "Bayesian-network fault-tree source" },
    }),
    "Create the source Systems Analysis workbook",
  );
  syWorkbookId = systemsWorkbook.id;
  const systems = await json<SyWorkbookResponse>(
    await api.post(`/api/sy-workbooks/${syWorkbookId}/load-example`, { data: { example: "sfr" } }),
    "Load a deterministic fault-tree source",
  );
  const faultTree = systems.mef.systemLogicModels.find((candidate) =>
    candidate.leafNodes.some((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE"));
  const basicEventReference = faultTree?.leafNodes.find((leaf) =>
    leaf.kind === "BASIC_EVENT_REFERENCE" && leaf.basicEventId !== undefined);
  expect(faultTree).toBeDefined();
  expect(basicEventReference?.basicEventId).toBeDefined();
  expect(systems.mef.systemBasicEvents.some((event) => event.uuid === basicEventReference!.basicEventId)).toBeTruthy();
  faultTreeModelId = faultTree!.uuid;
  basicEventId = basicEventReference!.basicEventId!;

  const esqWorkbook = await json<WorkbookResponse>(
    await api.post(`/api/projects/${projectId}/workbooks`, {
      data: { elementCode: "ESQ", name: "Bayesian-network vertical slice" },
    }),
    "Create the ESQ host workbook",
  );
  esqWorkbookId = esqWorkbook.id;
});

test.afterAll(async () => {
  if (api === undefined) return;
  if (projectId !== "") {
    const cleanup = await api.delete(`/api/projects/${projectId}`);
    expect(cleanup.status(), "Clean up the Bayesian-network E2E project").toBe(204);
  }
  await api.dispose();
});

test("creates, edits, validates, queries, links, and reloads the canonical Bayesian network", async ({ page }, testInfo) => {
  await page.addInitScript((jwt) => window.localStorage.setItem("id_token", jwt), token);
  await page.goto(`/esq-workbooks/${esqWorkbookId}`);
  await page.getByRole("button", { name: /Dependencies/ }).click();

  const workspace = page.getByLabel("Bayesian-network dependency model");
  await expect(workspace).toBeVisible();
  await waitForEsqSave(page, async () => {
    await workspace.getByRole("button", { name: "Add network" }).click();
  });

  let editor = workspace.getByTestId("bayesian-network-editor");
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "File" }).click();
  const fileMenu = editor.getByRole("menu", { name: "Bayesian-network file actions" });
  await expect(fileMenu).toBeVisible();
  await expect(fileMenu.getByRole("menuitem")).toHaveText([
    "Export XDSL",
    "Export JSON",
    "Import XDSL",
    "Import JSON",
  ]);
  await editor.getByRole("button", { name: "File" }).click();
  await expect(fileMenu).toHaveCount(0);
  await waitForEsqSave(page, async () => {
    await editor.getByRole("button", { name: "Add node" }).click();
  });
  await waitForEsqSave(page, async () => {
    await editor
      .getByLabel("Bayesian-network node inspector")
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Cause");
  });
  await waitForEsqSave(page, async () => {
    await editor.getByRole("button", { name: "Add node" }).click();
  });
  await waitForEsqSave(page, async () => {
    await editor
      .getByLabel("Bayesian-network node inspector")
      .getByRole("textbox", { name: "Name", exact: true })
      .fill("Consequence");
  });

  const causeNode = editor.getByRole("button", { name: "BN node Cause" });
  const consequenceNode = editor.getByRole("button", { name: "BN node Consequence" });
  await causeNode.hover();
  const connectionHandle = editor.getByRole("button", { name: "Connection handle N-1 right" });
  const destinationHandle = editor.getByRole("button", { name: "Connection handle N-2 left" });
  const consequenceShell = consequenceNode.locator("..");
  const handleBox = await connectionHandle.boundingBox();
  const destinationHandleBox = await destinationHandle.boundingBox();
  const consequenceBox = await consequenceNode.boundingBox();
  expect(handleBox).not.toBeNull();
  expect(destinationHandleBox).not.toBeNull();
  expect(consequenceBox).not.toBeNull();
  await waitForEsqSave(page, async () => {
    await page.mouse.move(
      handleBox!.x + handleBox!.width / 2,
      handleBox!.y + handleBox!.height / 2,
    );
    await page.mouse.down();
    await expect(editor.locator(".bneditor__connection-preview")).toHaveCount(1);
    await page.mouse.move(
      consequenceBox!.x + consequenceBox!.width / 2,
      consequenceBox!.y + consequenceBox!.height / 2,
      { steps: 5 },
    );
    await expect(consequenceShell).toHaveClass(/is-connection-candidate/);
    await expect(consequenceShell).not.toHaveClass(/is-connection-target/);
    await expect(consequenceShell.locator(".bneditor__handle.is-dock-option")).toHaveCount(4);
    await expect(consequenceShell.locator(".bneditor__handle.is-dock-active")).toHaveCount(0);
    await page.mouse.move(
      destinationHandleBox!.x + destinationHandleBox!.width / 2,
      destinationHandleBox!.y + destinationHandleBox!.height / 2,
      { steps: 4 },
    );
    await expect(consequenceShell).toHaveClass(/is-connection-target/);
    await expect(destinationHandle).toHaveClass(/is-dock-active/);
    await expect(editor.locator(".bneditor__connection-preview")).toHaveClass(/is-docked/);
    await page.mouse.up();
  });
  await expect(editor.getByTestId("bayesian-network-edge")).toHaveCount(1);
  await expect(editor.getByText(/Connecting from/)).toHaveCount(0);
  await expect(editor.getByRole("button", { name: /Connect from/ })).toHaveCount(0);

  const causeBox = await causeNode.boundingBox();
  expect(causeBox).not.toBeNull();
  await page.mouse.click(
    (causeBox!.x + causeBox!.width + consequenceBox!.x) / 2,
    causeBox!.y + causeBox!.height / 2,
    { button: "right" },
  );
  await expect(editor.getByRole("menu", { name: "Actions for connection N-1 to N-2" })).toBeVisible();
  await expect(editor.getByRole("menuitem", { name: "Delete connection" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor.getByRole("menu", { name: "Actions for connection N-1 to N-2" })).toHaveCount(0);

  const cpt = editor.getByLabel("CPT for N-2");
  const falseProbability = cpt.getByLabel("N-2 FALSE probability").first();
  await waitForEsqSave(page, async () => {
    await falseProbability.fill("0.8");
  });
  await expect(cpt.locator("tbody tr").first()).toHaveClass(/is-invalid/);
  await waitForEsqSave(page, async () => {
    await cpt.getByRole("button", { name: "Normalize row" }).first().click();
  });
  await expect(cpt.locator("tbody tr").first()).not.toHaveClass(/is-invalid/);

  await editor.getByLabel("Bayesian-network query node").selectOption({ label: "N-2" });
  await editor.getByLabel("Evidence for N-1").selectOption({ label: "TRUE" });
  await editor.getByRole("button", { name: "Run exact inference" }).click();
  await expect(editor.getByLabel("Posterior distribution")).toContainText("50.0000%");

  await waitForEsqSave(page, async () => {
    await editor.getByRole("button", { name: "Create HCL configuration" }).click();
  });
  await expect(editor.getByLabel("Fault tree for binding")).toHaveValue(`${syWorkbookId}:${faultTreeModelId}`);
  await editor.getByLabel("Fault tree for binding").selectOption(`${syWorkbookId}:${faultTreeModelId}`);
  await editor.getByLabel("Basic event for binding").selectOption(basicEventId);
  await editor.getByLabel("BN node for binding").selectOption({ label: "N-1" });
  await editor.getByRole("checkbox", { name: "TRUE" }).click();
  await waitForEsqSave(page, async () => {
    await editor.getByRole("button", { name: "Add binding" }).click();
  });
  await expect(editor.getByLabel("HCL bindings")).toContainText("N-1");

  await page.reload();
  await page.getByRole("button", { name: /Dependencies/ }).click();
  editor = page.getByTestId("bayesian-network-editor");
  await expect(editor.getByRole("button", { name: "BN node Cause" })).toBeVisible();
  await expect(editor.getByRole("button", { name: "BN node Consequence" })).toBeVisible();
  await expect(editor.getByTestId("bayesian-network-edge")).toHaveCount(1);
  await expect(editor.getByLabel("HCL bindings")).toContainText("N-1");
  const inspectorOverflow = await editor.getByLabel("Bayesian-network node inspector").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(inspectorOverflow.scrollWidth).toBeLessThanOrEqual(inspectorOverflow.clientWidth);
  const canvasControls = editor.getByLabel("Bayesian-network canvas controls");
  await expect(canvasControls).toBeVisible();
  const controlsOverflow = await canvasControls.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(controlsOverflow.scrollWidth).toBeLessThanOrEqual(controlsOverflow.clientWidth);
  const workspaceHeight = await editor.locator(".bneditor__workspace").evaluate((element) => element.clientHeight);
  await editor.getByRole("button", { name: "BN node Consequence" }).click();
  expect(await editor.locator(".bneditor__workspace").evaluate((element) => element.clientHeight)).toBe(workspaceHeight);
  await editor.screenshot({ path: testInfo.outputPath("bayesian-network-editor.png") });

  const persisted = await json<EsqWorkbookResponse>(
    await api.get(`/api/esq-workbooks/${esqWorkbookId}`),
    "Reload the persisted Bayesian network and HCL binding",
  );
  expect(persisted.mef.bayesianNetworks).toHaveLength(1);
  const network = persisted.mef.bayesianNetworks[0]!;
  expect(network.nodes.map(({ name }) => name).sort()).toEqual(["Cause", "Consequence"]);
  expect(network.edges).toHaveLength(1);
  network.conditionalProbabilityTables.forEach((table) => {
    table.rows.forEach((row) => {
      expect(row.values.reduce((sum, value) => sum + value.probability, 0)).toBeCloseTo(1, 12);
    });
  });
  expect(persisted.mef.hclConfigurations).toHaveLength(1);
  expect(persisted.mef.hclConfigurations[0]).toEqual(expect.objectContaining({
    bayesianNetwork: { workbookId: esqWorkbookId, modelId: network.modelId },
    bindings: [expect.objectContaining({
      faultTreeBasicEvent: expect.objectContaining({ workbookId: syWorkbookId, entityId: basicEventId }),
      bayesianNetworkNode: expect.objectContaining({ workbookId: esqWorkbookId, modelId: network.modelId }),
      trueStateIds: expect.arrayContaining([expect.any(String)]),
    })],
  }));
  expect(persisted.revision).toBeGreaterThan(1);
});
