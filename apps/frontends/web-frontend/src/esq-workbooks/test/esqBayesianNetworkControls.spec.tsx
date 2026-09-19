import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import { EsqEventTreeHclWorkspace } from "../esqEventTreeHclWorkspace";
import { ToastProvider } from "../../toast/toastProvider";
import { listWorkbooks } from "../../workbooks/workbookApi";
import { getSyWorkbook } from "../../sy-workbooks/syWorkbookApi";
import { getEsWorkbook } from "../../es-workbooks/esWorkbookApi";
import { importBayesianNetworkXdsl, readBayesianNetworkSubmodels } from "../../newly-developed-methods/bayesian-network/bayesianNetworkInterchange";

jest.mock("../../workbooks/workbookApi", () => ({ listWorkbooks: jest.fn() }));
jest.mock("../../sy-workbooks/syWorkbookApi", () => ({ getSyWorkbook: jest.fn() }));
jest.mock("../../es-workbooks/esWorkbookApi", () => ({ getEsWorkbook: jest.fn() }));

const sample = readFileSync(resolve(__dirname, "../../newly-developed-methods/bayesian-network/test/fixtures/grouping-demo.xdsl"), "utf8");
const empty = { uuid: "test-esq", bayesianNetworks: [], hclConfigurations: [] } as unknown as EventSequenceQuantification;

function Workbook({ editable = true, initial = empty, changed = jest.fn(), initialNetworkId = null, initialSourceWorkbookId = null }: {
  editable?: boolean;
  initial?: EventSequenceQuantification;
  changed?: jest.Mock;
  initialNetworkId?: string | null;
  initialSourceWorkbookId?: string | null;
}) {
  const [esq, setEsq] = useState(initial);
  return <ToastProvider><EsqWorkbookProvider data={{ esq, links: null }} editable={editable}
    runtime={{ workbookId: "local-esq", projectId: "project", revision: 1, saveStatus: "saved" }}
    mutateEsq={(mutate) => setEsq((current) => { const next = mutate(current); changed(next); return next; })}>
    <EsqEventTreeHclWorkspace initialNetworkId={initialNetworkId} initialSourceWorkbookId={initialSourceWorkbookId} />
  </EsqWorkbookProvider></ToastProvider>;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listWorkbooks).mockResolvedValue({ workbooks: [] } as Awaited<ReturnType<typeof listWorkbooks>>);
});

it("creates a network, imports XDSL and groups its nodes through the actual ESQ workspace and editor", async () => {
  const user = userEvent.setup();
  const changed = jest.fn();
  const { container } = render(<Workbook changed={changed} />);
  await user.click(await screen.findByRole("button", { name: "Add network", exact: true }));
  expect(screen.getByRole("button", { name: "Manage groups", exact: true })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "File", exact: true }));
  await user.click(screen.getByRole("menuitem", { name: "Import XDSL", exact: true }));
  const file = new File([], "grouping-demo.xdsl");
  Object.defineProperty(file, "text", { value: async () => sample });
  fireEvent.change(container.querySelector('input[type="file"][accept*=".xdsl"]')!, { target: { files: [file] } });
  const confirmation = await screen.findByRole("alertdialog", { name: "Replace this Bayesian network?" });
  await user.click(within(confirmation).getByRole("button", { name: "Replace network" }));
  expect(screen.getByRole("button", { name: "BN node Power supply", exact: true })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Manage groups", exact: true }));
  await user.type(screen.getByRole("textbox", { name: "Group name", exact: true }), "Power systems");
  await user.click(screen.getByLabelText("Include Power in group", { exact: true }));
  await user.click(screen.getByRole("button", { name: "Create group", exact: true }));
  const stored = (changed.mock.lastCall![0] as EventSequenceQuantification).bayesianNetworks[0]!;
  expect(stored.nodes).toHaveLength(5);
  expect(readBayesianNetworkSubmodels(stored).find((group) => group.name === "Power systems")!.nodeIds).toHaveLength(1);
  await user.selectOptions(screen.getByLabelText("BN graph view", { exact: true }), "SUBMODELS");
  expect(screen.getByRole("button", { name: "Open submodel Power systems", exact: true })).toBeInTheDocument();
});

it("explains linked-network restrictions beside visible controls and links to the owner", async () => {
  const user = userEvent.setup();
  const network = importBayesianNetworkXdsl(sample);
  const configuration = { modelId: "hcl", code: "HCL", bayesianNetwork: { workbookId: "source-sy", modelId: network.modelId },
    faultTrees: [{ workbookId: "source-sy", modelId: "ft" }], bindings: [], baseEvidence: { observations: [] } };
  jest.mocked(listWorkbooks).mockImplementation(async (_project, element) => ({ workbooks: [{ id: element === "SY" ? "source-sy" : "source-es", name: "Source systems — Fault Trees" }] }) as Awaited<ReturnType<typeof listWorkbooks>>);
  jest.mocked(getSyWorkbook).mockResolvedValue({ mef: { systemLogicModels: [], systemBasicEvents: [], dependencyBayesianNetworks: [network], dependencyHclConfigurations: [configuration] } } as unknown as Awaited<ReturnType<typeof getSyWorkbook>>);
  jest.mocked(getEsWorkbook).mockResolvedValue({ mef: { eventTrees: [{ uuid: "et", name: "ET", sequences: {}, functionalEvents: { f: { uuid: "f", name: "F", faultTreeTopEvent: { workbookId: "source-sy", modelId: "ft", entityId: "top" } } } }] } } as unknown as Awaited<ReturnType<typeof getEsWorkbook>>);
  const changed = jest.fn();
  render(<Workbook changed={changed} />);
  await user.selectOptions(await screen.findByLabelText("Dependency configuration"), "SY:source-sy:hcl");
  expect(screen.getByRole("button", { name: "Manage groups", exact: true })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "File", exact: true }));
  expect(screen.getByRole("menuitem", { name: "Import XDSL", exact: true })).toBeDisabled();
  expect(screen.getByText(/linked from Source systems and is read-only here/)).toBeInTheDocument();
  expect(screen.queryByText(/linked from Source systems — Fault Trees/)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Open Systems workbook" })).toHaveAttribute(
    "href",
    `/sy-workbooks/source-sy?step=deps&network=${network.modelId}&esqWorkbook=local-esq`,
  );
  expect(changed).not.toHaveBeenCalled();
});

it("selects the linked Systems Analysis network from an ESQ deep link", async () => {
  const first = importBayesianNetworkXdsl(sample);
  const linked = { ...first, modelId: "linked-network", code: "BN-LINKED", name: "Linked network" };
  jest.mocked(listWorkbooks).mockImplementation(async (_project, element) => ({
    workbooks: element === "SY" ? [{ id: "source-sy", name: "Source systems" }] : [],
  }) as Awaited<ReturnType<typeof listWorkbooks>>);
  jest.mocked(getSyWorkbook).mockResolvedValue({
    mef: {
      systemLogicModels: [],
      systemBasicEvents: [],
      dependencyBayesianNetworks: [first, linked],
      dependencyHclConfigurations: [],
    },
  } as unknown as Awaited<ReturnType<typeof getSyWorkbook>>);

  render(<Workbook initialNetworkId={linked.modelId} initialSourceWorkbookId="source-sy" />);

  expect(await screen.findByLabelText("Dependency configuration")).toHaveValue(
    `NETWORK:SY:source-sy:${linked.modelId}`,
  );
  expect(screen.getByLabelText("Bayesian-network code")).toHaveTextContent("BN-LINKED");
});

it("explains workbook permissions when a local network cannot be edited", async () => {
  const user = userEvent.setup();
  render(<Workbook editable={false} initial={{ ...empty, bayesianNetworks: [importBayesianNetworkXdsl(sample)] }} />);
  expect(screen.getByRole("button", { name: "Manage groups", exact: true })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "File", exact: true }));
  expect(screen.getByRole("menuitem", { name: "Import XDSL", exact: true })).toBeDisabled();
  expect(screen.getByText(/Editing requires the preparer role/)).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Open Systems workbook" })).not.toBeInTheDocument();
});
