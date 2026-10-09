import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { createRequire } from "module";
import path from "path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parameterReferenceKey, type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { applyWorkbookPatch, createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { fetchJson } from "../../api/client";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { scMissionTimeTable } from "../../sc-workbooks/scMissionTimeLinks";
import { EventDialogContent } from "../SyEventDialogs";
import { ModelsScreen } from "../SySystemModels";
import { buildLinkedInputs, controlledParameterOptions } from "../syLinks";
import { useReferencedScSources } from "../syMissionTimes";
import { toExp } from "../syViewData";
import { SyWorkbookProvider, type SyControlledParameterOption, type SyMutator } from "../syWorkbookContext";
import { stripNulls } from "../../../../../backends/web-backend/src/pos-workbooks/mef-normalize";
import { adaptSyFaultTreeSnapshot } from "../../../../../backends/web-backend/src/newly-developed-methods/shared/praxis-snapshot-adapters";
import { CC_SNAPSHOT_INSTANCE } from "../../../../../backends/web-backend/src/example-workbooks/seeds/cross-cutting-seed";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { SC_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sc-seed-htgr";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";

jest.mock("../../api/client", () => ({ ...jest.requireActual<typeof import("../../api/client")>("../../api/client"), fetchJson: jest.fn() }));
jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));
jest.mock("../../newly-developed-methods/fault-tree/faultTreeImage", () => ({ renderFaultTreePng: jest.fn() }));
jest.mock("../../newly-developed-methods/shared/useAnalysisSourceGuard", () => ({ useAnalysisSourceGuard: () => ({ sourceWarning: null }) }));
jest.mock("../syWorkbookApi", () => ({ getSyFaultTreeResult: jest.fn(), runSyFaultTree: jest.fn(), validateSyFaultTree: jest.fn() }));

interface PraxisNative {
  execute: (requestJson: string) => string;
}

interface FaultTreeAnswer {
  result?: { topEventProbability?: number };
  error?: { message: string };
}

const SYSTEM_ID = "22222222-2222-4222-8222-222222222222";
const EVENT_ID = "55555555-5555-4555-8555-555555555555";
const EVENT_NAME = "Fan fails to start";
const MODEL_ID = "66666666-6666-4666-8666-666666666666";
const GATE_ID = "11111111-1111-4111-8111-111111111111";
const LEAF_ID = "44444444-4444-4444-8444-444444444444";
const DA_WORKBOOK = "da-project";
const EXAMPLE_SC = "example-sc-htgr";
const NO_OPTIONS = { ES: [], SC: [], POS: [], DA: [], HRA: [] };

const BETA: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "BETA", alpha: 2, beta: 998, lower: 0, upper: 1 } } };

const LAW_OPTION: SyControlledParameterOption = {
  workbookId: DA_WORKBOOK,
  workbookName: "Project DA",
  parameterId: "DA-FAN-FS",
  parameterName: "Cavity fan fails to start",
  estimate: BETA,
  unit: "PROBABILITY",
};

const HTGR_OPTIONS = controlledParameterOptions([{ entry: { id: DA_WORKBOOK, name: "Project DA" }, workbook: { mef: DA_ANALYSIS_HTGR } }]);

const SC_TABLE = scMissionTimeTable(EXAMPLE_SC, { missionTimes: SC_ANALYSIS_HTGR.missionTimes, componentMissionTimes: SC_ANALYSIS_HTGR.componentMissionTimes ?? [] });

function missionLinked(option: SyControlledParameterOption): boolean {
  const estimate = option.estimate;
  if (estimate.node !== "MODEL" || estimate.model.form !== "MISSION") return false;
  const time = estimate.model.missionTime;
  return time.node === "PARAMETER" && time.reference.workbookId === EXAMPLE_SC && time.reference.entityId === "MT-DLOFC" && option.unit === "PROBABILITY";
}

function dlofcOption(): SyControlledParameterOption {
  const found = HTGR_OPTIONS.find(missionLinked);
  if (found === undefined) throw new Error("The HTGR DA example has no MISSION estimate on MT-DLOFC.");
  return found;
}

function link(workbookId: string, entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId } };
}

function linkedExpression(option: SyControlledParameterOption): UncertainExpression {
  return link(option.workbookId, option.parameterId);
}

function runParameters(option: SyControlledParameterOption): Map<string, UncertainParameter> {
  const parameter: UncertainParameter = { reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: option.workbookId, entityId: option.parameterId }, expression: option.estimate };
  return new Map([[parameterReferenceKey(parameter.reference), parameter], ...SC_TABLE]);
}

async function expectedPoint(option: SyControlledParameterOption): Promise<number> {
  const parameters = [...runParameters(option).values()];
  const response = await praxisUncertainty({ parameters, laws: [], operations: [], expressions: [{ id: "0", expression: linkedExpression(option), unit: "PROBABILITY", probabilities: [] }] });
  const [answer] = response.expressions;
  if (answer === undefined || !("point" in answer)) throw new Error("PRAXIS gave no point for the DA estimate.");
  return answer.point;
}

function praxisNative(): PraxisNative {
  return createRequire(__filename)(path.resolve(__dirname, "../../../../../solvers/praxis-node/index.js"));
}

function quantifiedTop(saved: SystemsAnalysis, option: SyControlledParameterOption): number {
  const adapted = adaptSyFaultTreeSnapshot({ workbookId: "sy-project", workbookRevision: 4, mef: saved }, MODEL_ID, { parameters: runParameters(option) });
  expect(adapted.basicEventCatalogue.basicEvents).toEqual([{ id: EVENT_ID, expression: linkedExpression(option) }]);
  const answer: FaultTreeAnswer = JSON.parse(praxisNative().execute(JSON.stringify({
    schemaVersion: "1.0.0",
    request: {
      schemaVersion: "1.0.0", methodType: "FAULT_TREE", modelId: MODEL_ID, revision: 4, requestedBy: "analyst",
      calculationType: "PROBABILITY", workflow: "MANUAL",
      settings: { algorithm: "BDD", approximation: "EXACT", variableOrder: "DFS", reorderBudgetSeconds: 60, expandCcf: false, numTrials: 2_000, seed: 847, missionTimeHours: 8_760 },
    },
    modelSnapshots: [{ ...adapted.modelSnapshot, projectId: "run" }],
    resources: { faultTreeBasicEventCatalogue: { ...adapted.basicEventCatalogue, projectId: "run" } },
  })));
  if (answer.error !== undefined || answer.result?.topEventProbability === undefined) throw new Error(answer.error?.message ?? "PRAXIS gave no top event probability.");
  return answer.result.topEventProbability;
}

function analysis(expression: UncertainExpression): SystemsAnalysis {
  return SystemsAnalysisSchema.parse(stripNulls(JSON.parse(JSON.stringify({
    ...SY_ANALYSIS_HTGR,
    systemDefinitions: [{
      uuid: SYSTEM_ID,
      name: "Reactor cavity cooling",
      abbreviation: "RCCS",
      boundaries: [],
      successCriteriaIds: [],
      missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } },
      modeledComponentsAndFailures: {},
      informationBasis: "as-designed-as-intended",
      implementsSrs: [],
    }],
    systemLogicModels: [{
      uuid: MODEL_ID,
      code: "FT-RCCS",
      name: "Cavity cooling fault tree",
      systemReference: SYSTEM_ID,
      description: "Cavity cooling fails",
      modelRepresentation: "FAULT_TREE",
      topGate: { gateId: GATE_ID },
      gates: [{ id: GATE_ID, kind: "GATE", gateType: "OR", code: "TOP", name: "Cavity cooling fails", description: "" }],
      leafNodes: [{ id: LEAF_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_ID }],
      gateInputs: [{ id: "77777777-7777-4777-8777-777777777771", gateId: GATE_ID, childId: LEAF_ID, order: 0 }],
      nodePositions: [{ nodeId: GATE_ID, position: { x: 100, y: 24 } }, { nodeId: LEAF_ID, position: { x: 100, y: 172 } }],
      layout: { mode: "MANUAL", direction: "TOP_TO_BOTTOM", viewport: { x: 0, y: 0, zoom: 1 } },
      implementsSrs: [],
    }],
    systemBasicEvents: [{ uuid: EVENT_ID, code: "RCCS-FAN-FS", name: EVENT_NAME, eventType: "BASIC", failureMode: "FAILURE_TO_START", expression, implementsSrs: [] }],
    commonCauseFailureGroups: [],
    systemDependencies: [],
  }))));
}

function saveOnServer(server: SystemsAnalysis, before: SystemsAnalysis, after: SystemsAnalysis): SystemsAnalysis {
  return SystemsAnalysisSchema.parse(stripNulls(applyWorkbookPatch(server, createWorkbookPatch(before, after))));
}

interface HostProps {
  initial: SystemsAnalysis;
  options: readonly SyControlledParameterOption[];
  onSaved: (sy: SystemsAnalysis) => void;
}

function Host({ initial, options, onSaved }: HostProps): JSX.Element {
  const [sy, setSy] = useState(initial);
  const [parameters, setParameters] = useState<SyControlledParameterOption[]>([]);
  const server = useRef(initial);
  const shown = useRef(initial);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve([...options]).then((loaded) => {
      if (!cancelled) setParameters(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [options]);
  useEffect(() => {
    if (sy === shown.current) return;
    server.current = saveOnServer(server.current, shown.current, sy);
    shown.current = sy;
    onSaved(server.current);
  }, [sy, onSaved]);
  const referenced = useReferencedScSources(sy, parameters, undefined, undefined);
  const links = useMemo(() => buildLinkedInputs(NO_OPTIONS, {}, undefined, undefined, undefined, referenced), [referenced]);
  const data = useMemo(() => ({ sy, cc: CC_SNAPSHOT_INSTANCE, nms: [], links }), [sy, links]);
  const mutateSy = useCallback((mutator: SyMutator) => setSy((current) => mutator(current)), []);
  const runtime = useMemo(() => ({ workbookId: "sy-project", projectId: "project", revision: 3, saveStatus: "saved" as const }), []);
  return (
    <SyWorkbookProvider data={data} editable mutateSy={mutateSy} runtime={runtime} controlledParameters={parameters}>
      <ModelsScreen sysId={SYSTEM_ID} setSysId={() => undefined} openDrawer={() => undefined} />
      <section aria-label="Basic event window">
        <EventDialogContent context={{ kind: "be", id: EVENT_ID }} onClose={() => undefined} />
      </section>
    </SyWorkbookProvider>
  );
}

async function praxisSettled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

function windowPoint(): string {
  return within(screen.getByRole("region", { name: "Basic event window" })).getByText("Point value", { exact: false }).textContent ?? "";
}

function openTab(name: string): void {
  fireEvent.click(screen.getByRole("tab", { name: (label) => label.startsWith(name) }));
}

function tableValue(): string {
  const table = screen.getByRole("table", { name: "Basic events" });
  const row = within(table).getAllByRole("row").find((candidate) => candidate.textContent?.includes("RCCS-FAN-FS") === true);
  if (row === undefined) throw new Error("No basic event row.");
  return within(row).getAllByRole("cell")[2]?.textContent ?? "";
}

function canvasValue(): string {
  return within(screen.getByRole("button", { name: EVENT_NAME })).getByText((_, element) => element?.classList.contains("ftbox__prob") === true).textContent ?? "";
}

async function expectEverywhere(point: number): Promise<void> {
  await praxisSettled();
  expect(windowPoint()).toBe(`Point value ${toExp(point)}`);
  openTab("Basic events");
  await praxisSettled();
  expect(tableValue().startsWith(toExp(point))).toBe(true);
  openTab("Fault tree");
  await praxisSettled();
  expect(canvasValue()).toBe(point.toExponential(1));
  fireEvent.click(screen.getByRole("button", { name: EVENT_NAME }));
  await praxisSettled();
  expect(screen.getByText(`Point value ${point.toExponential(1)}. Edit the value in the basic event window.`)).toBeInTheDocument();
}

async function chooseInWindow(option: SyControlledParameterOption): Promise<void> {
  await praxisSettled();
  const source = within(screen.getByRole("region", { name: "Basic event window" })).getByRole("combobox", { name: "Source" });
  fireEvent.change(source, { target: { value: `${option.workbookId}:${option.parameterId}` } });
  await praxisSettled();
}

async function checkFlow(option: SyControlledParameterOption): Promise<void> {
  const point = await expectedPoint(option);
  const initial = analysis(link("example-da-htgr", option.parameterId));
  let saved = initial;
  const record = (next: SystemsAnalysis): void => {
    saved = next;
  };
  const first = render(<Host initial={initial} options={[option]} onSaved={record} />);
  await praxisSettled();
  expect(windowPoint()).toBe(`Point value Linked value ${option.parameterId} is in workbook example-da-htgr, which is not loaded.`);
  await chooseInWindow(option);
  expect(saved.systemBasicEvents.find((event) => event.uuid === EVENT_ID)?.expression).toEqual(linkedExpression(option));
  await expectEverywhere(point);
  first.unmount();

  render(<Host initial={saved} options={[option]} onSaved={record} />);
  await expectEverywhere(point);
  expect(quantifiedTop(saved, option)).toBeCloseTo(point, 15);
}

describe("SY basic event linked to a DA estimate", () => {
  beforeEach(() => {
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    jest.mocked(fetchJson).mockReset();
    jest.mocked(fetchJson).mockResolvedValue({ sc: { mef: SC_ANALYSIS_HTGR } });
  });

  it("shows the DA estimate's PRAXIS point in the window, the table, the canvas, the side panel and the run, before and after a reload", async () => {
    await checkFlow(LAW_OPTION);
  });

  it("does the same for a DA estimate whose mission model links an SC mission time", async () => {
    await checkFlow(dlofcOption());
    expect(fetchJson).toHaveBeenCalledWith("/api/example-workbooks/sc-bundle?example=htgr");
  });
});
