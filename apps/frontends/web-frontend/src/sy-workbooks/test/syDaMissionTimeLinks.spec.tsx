import { act, fireEvent, render, screen } from "@testing-library/react";
import { useCallback, useMemo, useState } from "react";
import { parameterReferenceKey, type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { fetchJson } from "../../api/client";
import {
  FaultTreeEditor,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeOperation,
} from "../../newly-developed-methods/fault-tree";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { evaluateResolved } from "../../newly-developed-methods/shared/uncertaintyLinks";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { linkedScWorkbookIds } from "../../sc-workbooks/scMissionTimeSources";
import { EventDialogContent } from "../SyEventDialogs";
import { editorOptions, valueTable } from "../syBasicEventValues";
import { buildLinkedInputs, controlledParameterOptions } from "../syLinks";
import { syValueSources, useReferencedScSources } from "../syMissionTimes";
import { toExp } from "../syViewData";
import { SyWorkbookProvider, type SyControlledParameterOption, type SyMutator } from "../syWorkbookContext";
import { CC_SNAPSHOT_INSTANCE } from "../../../../../backends/web-backend/src/example-workbooks/seeds/cross-cutting-seed";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { SC_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sc-seed-htgr";
import { SY_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/sy-seed-htgr";

jest.mock("../../api/client", () => ({ ...jest.requireActual<typeof import("../../api/client")>("../../api/client"), fetchJson: jest.fn() }));
jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));
jest.mock("../../newly-developed-methods/fault-tree/faultTreeImage", () => ({ renderFaultTreePng: jest.fn() }));

const EXAMPLE_SC = "example-sc-htgr";
const MISSING = "Mission time MT-DLOFC is in SC workbook example-sc-htgr, which is not loaded.";
const SYSTEM_ID = "SYS-RCCS";
const EVENT_ID = "BE-RCCS-FAN";
const LEAF_ID = "44444444-4444-4444-8444-444444444444";
const GATE_ID = "11111111-1111-4111-8111-111111111111";

const PARAMETERS: SyControlledParameterOption[] = controlledParameterOptions([{ entry: { id: "da-project", name: "Project DA" }, workbook: { mef: DA_ANALYSIS_HTGR } }]);

function missionLink(expression: UncertainExpression): WorkbookParameterReference | undefined {
  if (expression.node !== "MODEL" || expression.model.form !== "MISSION") return undefined;
  const time = expression.model.missionTime;
  return time.node === "PARAMETER" ? time.reference : undefined;
}

function dlofcOption(): SyControlledParameterOption {
  const found = PARAMETERS.find((option) => {
    const link = missionLink(option.estimate);
    return link?.workbookId === EXAMPLE_SC && link.entityId === "MT-DLOFC" && option.unit === "PROBABILITY";
  });
  if (found === undefined) throw new Error("The HTGR DA example has no MISSION estimate on MT-DLOFC.");
  return found;
}

const OPTION = dlofcOption();
const OPTION_KEY = parameterReferenceKey({ workbookId: OPTION.workbookId, entityId: OPTION.parameterId });

function typed(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function inlined(expression: UncertainExpression): UncertainExpression {
  if (expression.node !== "MODEL" || expression.model.form !== "MISSION") throw new Error("Expected a MISSION estimate.");
  const time = SC_ANALYSIS_HTGR.missionTimes.find((entry) => entry.uuid === "MT-DLOFC")?.missionTime;
  if (time === undefined) throw new Error("The HTGR SC example has no MT-DLOFC.");
  return { node: "MODEL", model: { form: "MISSION", rate: expression.model.rate, missionTime: time } };
}

async function expectedPoint(): Promise<number> {
  const response = await praxisUncertainty({ parameters: [], laws: [], operations: [], expressions: [{ id: "0", expression: inlined(OPTION.estimate), unit: "PROBABILITY", probabilities: [] }] });
  const [answer] = response.expressions;
  if (answer === undefined || !("point" in answer)) throw new Error("PRAXIS gave no point for the inlined estimate.");
  return answer.point;
}

async function praxisSettled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

const SY: SystemsAnalysis = {
  ...SY_ANALYSIS_HTGR,
  systemDefinitions: [{
    uuid: SYSTEM_ID,
    name: "Reactor cavity cooling",
    boundaries: [],
    successCriteriaIds: [],
    missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } },
    modeledComponentsAndFailures: {},
    informationBasis: "as-designed-as-intended",
    implementsSrs: [],
  }],
  systemLogicModels: [],
  systemBasicEvents: [{ uuid: EVENT_ID, code: "RCCS-FAN-FR", name: "Fan fails to run", eventType: "BASIC", failureMode: "FAILURE_TO_RUN", expression: typed(0.01), implementsSrs: [] }],
  commonCauseFailureGroups: [],
};

const NO_OPTIONS = { ES: [], SC: [], POS: [], DA: [], HRA: [] };

function useProjectLinks(sy: SystemsAnalysis | null): ReturnType<typeof buildLinkedInputs> {
  const referenced = useReferencedScSources(sy, PARAMETERS, undefined, undefined);
  return useMemo(() => buildLinkedInputs(NO_OPTIONS, {}, undefined, undefined, undefined, referenced), [referenced]);
}

function SyHost(): JSX.Element {
  const [sy, setSy] = useState(SY);
  const links = useProjectLinks(sy);
  const data = useMemo(() => ({ sy, cc: CC_SNAPSHOT_INSTANCE, nms: [], links }), [sy, links]);
  const mutateSy = useCallback((mutator: SyMutator) => setSy((current) => mutator(current)), []);
  return (
    <SyWorkbookProvider data={data} editable mutateSy={mutateSy} controlledParameters={PARAMETERS}>
      <EventDialogContent context={{ kind: "be", id: EVENT_ID }} onClose={() => undefined} />
    </SyWorkbookProvider>
  );
}

const MODEL: FaultTreeEditorModel = {
  modelId: "66666666-6666-4666-8666-666666666666",
  code: "FT-RCCS",
  name: "Cavity cooling fault tree",
  description: "Cavity cooling fails",
  topGate: { gateId: GATE_ID },
  gates: [{ id: GATE_ID, kind: "GATE", gateType: "OR", code: "TOP", name: "Cavity cooling fails", description: "" }],
  leafNodes: [{ id: LEAF_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: EVENT_ID }],
  gateInputs: [{ id: "77777777-7777-4777-8777-777777777771", gateId: GATE_ID, childId: LEAF_ID, order: 0 }],
  nodePositions: [{ nodeId: GATE_ID, position: { x: 100, y: 24 } }, { nodeId: LEAF_ID, position: { x: 100, y: 172 } }],
  layout: { mode: "MANUAL", direction: "TOP_TO_BOTTOM", viewport: { x: 0, y: 0, zoom: 1 } },
};

const CATALOGUE: FaultTreeEditorCatalogue = {
  basicEvents: [{ id: EVENT_ID, code: "RCCS-FAN-FR", name: "Fan fails to run", description: "", probability: { value: 0.01, expression: typed(0.01) } }],
  presentations: [],
};

function FaultTreeHost({ onOperation }: { onOperation: (operation: FaultTreeOperation) => void }): JSX.Element {
  const links = useProjectLinks(null);
  const values = useMemo(() => syValueSources(PARAMETERS, links), [links]);
  return (
    <FaultTreeEditor
      model={MODEL}
      catalogue={CATALOGUE}
      capabilities={{ mode: "AUTHOR", canEditBasicEvents: true, canEditLayout: true, canImport: false, canExport: false, canRunAnalysis: false }}
      selection={{ kind: "LEAF", leafId: LEAF_ID }}
      validation={[]}
      saveState="saved"
      analysisResult={null}
      resultIsStale={false}
      daParameterOptions={editorOptions(PARAMETERS)}
      missionTimeOptions={values.missionTimeOptions}
      parameterTable={values.table}
      onOperation={onOperation}
      onSelectionChange={() => undefined}
      onOpenReference={() => undefined}
      onRun={() => undefined}
    />
  );
}

function pageText(): string {
  return document.body.textContent ?? "";
}

describe("DA estimates that link an SC mission time", () => {
  beforeEach(() => {
    jest.mocked(evaluateUncertainty).mockReset();
    jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
    jest.mocked(fetchJson).mockReset();
  });

  it("finds the SC workbook through the DA estimates even when the host links none", () => {
    expect(linkedScWorkbookIds([], valueTable(PARAMETERS, new Map<string, UncertainParameter>()))).toEqual([EXAMPLE_SC]);
  });

  it("answers an unloaded mission time with a clear message and keeps the rest of the batch", async () => {
    const parameter = { reference: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: OPTION.workbookId, entityId: OPTION.parameterId }, expression: OPTION.estimate };
    const response = await evaluateResolved({
      parameters: [parameter],
      laws: [],
      operations: [],
      expressions: [
        { id: "0", expression: { node: "PARAMETER", reference: parameter.reference }, unit: "PROBABILITY", probabilities: [] },
        { id: "1", expression: typed(0.1), unit: "PROBABILITY", probabilities: [] },
      ],
    });

    expect(response.expressions.find((answer) => answer.id === "0")).toEqual({ id: "0", error: MISSING });
    expect(response.expressions.find((answer) => answer.id === "1")).toMatchObject({ id: "1", point: 0.1 });
    expect(jest.mocked(evaluateUncertainty).mock.calls[0]?.[0].parameters).toEqual([]);
  });

  it("evaluates a DA estimate chosen in the SY basic event window once its SC workbook loads", async () => {
    jest.mocked(fetchJson).mockResolvedValue({ sc: { mef: SC_ANALYSIS_HTGR } });
    render(<SyHost />);
    await praxisSettled();

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: OPTION_KEY } });
    await praxisSettled();

    expect(fetchJson).toHaveBeenCalledWith("/api/example-workbooks/sc-bundle?example=htgr");
    expect(screen.getByText(toExp(await expectedPoint()))).toBeInTheDocument();
    expect(pageText().includes("Undefined Element")).toBe(false);
  });

  it("says which SC workbook is missing in the SY basic event window when it cannot load", async () => {
    jest.mocked(fetchJson).mockRejectedValue(new Error("Not found"));
    render(<SyHost />);
    await praxisSettled();

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: OPTION_KEY } });
    await praxisSettled();

    expect(screen.getByText(MISSING)).toBeInTheDocument();
    expect(pageText().includes("Undefined Element")).toBe(false);
  });

  it("saves a DA estimate chosen in the fault tree editor with its PRAXIS point", async () => {
    jest.mocked(fetchJson).mockResolvedValue({ sc: { mef: SC_ANALYSIS_HTGR } });
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeHost onOperation={onOperation} />);
    await praxisSettled();

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: OPTION_KEY } });
    await praxisSettled();

    const last = onOperation.mock.calls.at(-1)?.[0];
    if (last?.type !== "UPDATE_BASIC_EVENT") throw new Error("Expected a basic event update.");
    expect(last.basicEvent.probability.expression).toEqual({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: OPTION.workbookId, entityId: OPTION.parameterId } });
    expect(last.basicEvent.probability.value).toBe(await expectedPoint());
  });

  it("keeps the fault tree value unsaved and names the missing SC workbook when it cannot load", async () => {
    jest.mocked(fetchJson).mockRejectedValue(new Error("Not found"));
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeHost onOperation={onOperation} />);
    await praxisSettled();

    fireEvent.change(screen.getByRole("combobox", { name: "Source" }), { target: { value: OPTION_KEY } });
    await praxisSettled();

    expect(screen.getByRole("alert")).toHaveTextContent(`Not saved. ${MISSING}`);
    expect(onOperation).not.toHaveBeenCalled();
    expect(pageText().includes("Undefined Element")).toBe(false);
  });
});
