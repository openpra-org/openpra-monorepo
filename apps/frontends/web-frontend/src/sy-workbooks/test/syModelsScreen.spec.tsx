import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type {
  SystemBasicEvent,
  SystemLogicModel,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemBasicEventToFaultTreeBasicEvent } from "interfaces-mef-types/sy/system-models";
import {
  FaultTreeEditor,
  applyFaultTreeOperation,
  type FaultTreeEditorProps,
  type FaultTreeOperation,
  type FaultTreeOperationResult,
} from "../../newly-developed-methods/fault-tree";
import {
  validateFaultTreeModel,
  type FaultTreeAnalysisResult,
  type FaultTreeExecuteResult,
} from "interfaces-shared-types/newly-developed-methods/fault-tree";
import { getSyFaultTreeResult, runSyFaultTree, validateSyFaultTree } from "../syWorkbookApi";
import { createEmptyBayesianNetwork } from "../../newly-developed-methods/bayesian-network";
import { ModelsScreen } from "../SySystemModels";
import { settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";

jest.mock("../../newly-developed-methods/fault-tree", () => ({
  FaultTreeEditor: jest.fn(() => null),
  FaultTreeResults: jest.fn(() => null),
  applyFaultTreeOperation: jest.fn(),
}));

jest.mock("interfaces-shared-types/newly-developed-methods/fault-tree", () => ({
  validateFaultTreeModel: jest.fn(),
}));

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => jest.requireActual("./syUncertaintyPraxis"));

jest.mock("../syWorkbookApi", () => ({
  getSyFaultTreeResult: jest.fn(),
  runSyFaultTree: jest.fn(),
  validateSyFaultTree: jest.fn(),
}));

const SYSTEM_ID = "system-rcs";
const MODEL_ID = "ft-rcs";
const BASIC_EVENT_ID = "be-pump-fails";
const CREATED_MODEL_ID = "00000000-0000-4000-8000-000000000001";
const RUN_ID = "00000000-0000-4000-8000-000000000002";

const MODEL_LAYOUT = {
  viewport: { x: 12, y: 24, zoom: 1.25 },
  mode: "MANUAL" as const,
  direction: "LEFT_TO_RIGHT" as const,
};

const LOGIC_MODEL: SystemLogicModel = {
  uuid: MODEL_ID,
  code: "FT-RCS",
  name: "Reactor cooling fault tree",
  systemReference: SYSTEM_ID,
  description: "Loss of reactor cooling",
  modelRepresentation: "FAULT_TREE",
  topGate: { gateId: "gate-top" },
  gates: [
    {
      id: "gate-top",
      code: "G-TOP",
      name: "Cooling unavailable",
      description: "Cooling cannot be delivered",
      kind: "GATE",
      gateType: "OR",
    },
  ],
  leafNodes: [
    {
      id: "leaf-pump",
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId: BASIC_EVENT_ID,
    },
  ],
  gateInputs: [
    {
      id: "input-pump",
      gateId: "gate-top",
      childId: "leaf-pump",
      order: 0,
    },
  ],
  nodePositions: [
    { nodeId: "gate-top", position: { x: 40, y: 20 } },
    { nodeId: "leaf-pump", position: { x: 160, y: 20 } },
  ],
  layout: MODEL_LAYOUT,
  implementsSrs: [{ sr: "SY-A7", hlr: "A" }],
};

function point(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function linked(entityId: string): UncertainExpression {
  return { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId } };
}

const BASIC_EVENT: SystemBasicEvent = {
  uuid: BASIC_EVENT_ID,
  code: "BE-PUMP-FS",
  name: "Pump fails to start",
  description: "Demand failure of the cooling pump",
  eventType: "BASIC",
  failureMode: "FAILURE_TO_START",
  expression: point(0.02),
  repairModeled: true,
  implementsSrs: [{ sr: "SY-A14", hlr: "A" }],
};

function makeAnalysis(overrides: Partial<SystemsAnalysis> = {}): SystemsAnalysis {
  return {
    systemDefinitions: [
      {
        uuid: SYSTEM_ID,
        name: "Reactor cooling system",
        abbreviation: "RCS",
        description: "Remove reactor heat",
        boundaries: ["Reactor vessel", "Heat exchanger"],
        successCriteriaIds: [],
        successCriterion: "One cooling train for 24 hours",
        applicablePlantOperatingStates: ["POS-1"],
        modeledComponentsAndFailures: {},
        informationBasis: "as-built-as-operated",
        implementsSrs: [{ sr: "SY-A1", hlr: "A" }],
      },
    ],
    systemLogicModels: [{ ...LOGIC_MODEL }],
    systemBasicEvents: [{ ...BASIC_EVENT }],
    systemDependencies: [],
    variableSuccessCriteria: [],
    ...overrides,
  } as unknown as SystemsAnalysis;
}

const mockMutateSy = jest.fn();

let mockWorkbookContext: {
  sy: SystemsAnalysis;
  shortOf: (id: string) => string;
  editable: boolean;
  mutateSy: typeof mockMutateSy;
  runtime: {
    workbookId: string | null;
    revision: number | null;
    saveStatus: "saving" | "saved" | "failed";
  };
  controlledParameters: Array<{
    workbookId: string;
    workbookName: string;
    parameterId: string;
    parameterName: string;
    estimate: UncertainExpression;
    unit: "PROBABILITY" | "PER_HOUR";
  }>;
  controlledLegacyParameters: Array<{
    workbookId: string;
    workbookName: string;
    parameterId: string;
    parameterName: string;
    parameterType: "PROBABILITY" | "FREQUENCY" | "FAILURE_RATE";
    value: number;
    rateUnit?: "HOUR" | "YEAR";
  }>;
  controlledHumanFailures: Array<{
    workbookId: string;
    workbookName: string;
    humanFailureEventId: string;
    humanFailureEventName: string;
    hfeTiming: "POST_INITIATOR";
    quantificationId: string;
    methodology: string;
    value: number;
    valueKind: "MEAN";
  }>;
};

jest.mock("../syWorkbookContext", () => ({
  useSyWorkbook: () => mockWorkbookContext,
}));

const mockedFaultTreeEditor = jest.mocked(FaultTreeEditor);
const mockedApplyFaultTreeOperation = jest.mocked(applyFaultTreeOperation);
const mockedValidateFaultTreeModel = jest.mocked(validateFaultTreeModel);
const mockedRunSyFaultTree = jest.mocked(runSyFaultTree);
const mockedGetSyFaultTreeResult = jest.mocked(getSyFaultTreeResult);
const mockedValidateSyFaultTree = jest.mocked(validateSyFaultTree);

function setWorkbookContext({
  sy = makeAnalysis(),
  editable = true,
  workbookId = "sy-workbook",
  revision = 7,
  saveStatus = "saved",
  controlledParameters = [],
  controlledLegacyParameters = [],
  controlledHumanFailures = [],
}: {
  sy?: SystemsAnalysis;
  editable?: boolean;
  workbookId?: string | null;
  revision?: number | null;
  saveStatus?: "saving" | "saved" | "failed";
  controlledParameters?: typeof mockWorkbookContext.controlledParameters;
  controlledLegacyParameters?: typeof mockWorkbookContext.controlledLegacyParameters;
  controlledHumanFailures?: typeof mockWorkbookContext.controlledHumanFailures;
} = {}): void {
  mockWorkbookContext = {
    sy,
    editable,
    mutateSy: mockMutateSy,
    runtime: { workbookId, revision, saveStatus },
    controlledParameters,
    controlledLegacyParameters,
    controlledHumanFailures,
    shortOf: (id: string) => (id === SYSTEM_ID ? "RCS" : id),
  };
}

function openTab(name: string): void {
  fireEvent.click(screen.getByRole("tab", { name }));
}

function latestEditorProps(): FaultTreeEditorProps {
  const calls = mockedFaultTreeEditor.mock.calls;
  if (calls.length === 0) throw new Error("The canonical fault-tree editor was not rendered");
  return calls[calls.length - 1][0];
}

function projectedModel(): FaultTreeEditorProps["model"] {
  return {
    modelId: MODEL_ID,
    code: LOGIC_MODEL.code,
    name: LOGIC_MODEL.name,
    description: LOGIC_MODEL.description,
    topGate: LOGIC_MODEL.topGate,
    gates: LOGIC_MODEL.gates,
    leafNodes: LOGIC_MODEL.leafNodes,
    gateInputs: LOGIC_MODEL.gateInputs,
    nodePositions: LOGIC_MODEL.nodePositions,
    layout: LOGIC_MODEL.layout,
  };
}

const FAULT_TREE_HINT = "Right-click a gate to add gates, basic events, house events or transfers. Give each basic event a value in the Basic events tab. Type it, or link a DA estimate after linking a DA workbook in Step 01.";

describe("ModelsScreen canonical fault-tree host", () => {
  it("shows the PRAXIS fault-tree calculation, workflow, and algorithm controls below the editor", () => {
    const network = createEmptyBayesianNetwork("Dependency network");
    setWorkbookContext({ sy: makeAnalysis({ dependencyBayesianNetworks: [network] }) });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);

    openTab("Fault tree");
    expect(screen.getByText(FAULT_TREE_HINT)).toBeInTheDocument();
    expect(latestEditorProps().capabilities.canRunAnalysis).toBe(false);
    expect(latestEditorProps().showResults).toBe(false);
    expect(latestEditorProps().showHeaderStatus).toBe(false);
    openTab("Quantification");
    expect(screen.getByRole("region", { name: "Fault-tree quantification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run probability" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Probability", exact: true })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Manual" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "Fault-tree algorithm" })).toHaveValue("BDD");
    expect(screen.queryByText(/HCL configuration/)).not.toBeInTheDocument();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockedFaultTreeEditor.mockImplementation(() => null);
    mockedValidateFaultTreeModel.mockReturnValue([]);
    mockedValidateSyFaultTree.mockResolvedValue({
      schemaVersion: "1.0.0",
      validation: {
        schemaVersion: "1.0.0",
        owner: { workbookId: "sy-workbook", modelId: MODEL_ID, workbookRevision: 7 },
        mode: "ANALYSIS_READY",
        valid: true,
        issues: [],
        validatedAt: "2026-08-22T12:00:00.000Z",
      },
    });
    setWorkbookContext();
  });

  it("reveals compatible cut-set settings and batch model selection", () => {
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Quantification");

    fireEvent.click(screen.getByRole("radio", { name: "Cut sets", exact: true }));
    expect(screen.getByRole("combobox", { name: "Fault-tree algorithm" })).toHaveValue("ZBDD");
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    const algorithm = screen.getByRole("combobox", { name: "Fault-tree algorithm" });
    const advanced = screen.getByLabelText("Advanced fault-tree settings");
    expect(algorithm.compareDocumentPosition(advanced) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.getByRole("combobox", { name: "Fault-tree probability method" })).toHaveValue("EXACT");
    expect(screen.getByRole("spinbutton", { name: "Maximum cut-set order" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Expand common-cause groups" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Batch" }));
    expect(screen.getByRole("group", { name: "Fault trees" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run cut sets batch" })).toBeEnabled();
  });

  it("reveals Monte Carlo convergence and variance-reduction settings", () => {
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Quantification");

    fireEvent.change(screen.getByRole("combobox", { name: "Fault-tree algorithm" }), { target: { value: "MONTE_CARLO" } });
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByRole("spinbutton", { name: "Fault-tree trials" })).toHaveValue(10_000);
    fireEvent.click(screen.getByRole("checkbox", { name: "Stop when converged" }));
    expect(screen.getByRole("spinbutton", { name: "Monte Carlo convergence delta" })).toHaveValue(0.1);
    expect(screen.getByRole("spinbutton", { name: "Monte Carlo confidence" })).toHaveValue(0.95);
    fireEvent.change(screen.getByRole("combobox", { name: "Monte Carlo variance reduction" }), { target: { value: "IMPORTANCE_SAMPLING" } });
    expect(screen.queryByRole("spinbutton", { name: "Monte Carlo convergence delta" })).not.toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Importance sampling bias factor" })).toHaveValue(10);
  });

  it("shows an empty state when a new workbook has no system definitions", () => {
    setWorkbookContext({
      sy: makeAnalysis({ systemDefinitions: [], systemLogicModels: [], systemBasicEvents: [] }),
    });

    const onOpenSystems = jest.fn();
    render(<ModelsScreen sysId="" setSysId={jest.fn()} openDrawer={jest.fn()} onOpenSystems={onOpenSystems} />);

    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "No systems are in scope yet. Add them in the Systems in scope section of Step 01, then describe and build each one here.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Systems in scope" }));
    expect(onOpenSystems).toHaveBeenCalledTimes(1);
    expect(mockedFaultTreeEditor).not.toHaveBeenCalled();
  });

  it("projects the normalized system model and root catalogue into one canonical editor", async () => {
    const validationIssue = {
      code: "TEST_WARNING",
      severity: "WARNING" as const,
      message: "Test validation warning",
      entityId: MODEL_ID,
      fieldPath: ["topGate"],
    };
    mockedValidateFaultTreeModel.mockReturnValue([validationIssue]);

    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    expect(mockedFaultTreeEditor).toHaveBeenCalled();
    await waitFor(() => expect(latestEditorProps().catalogue.basicEvents[0]?.probability).toEqual({ value: 0.02, expression: point(0.02) }));
    const props = latestEditorProps();
    expect(props.model).toEqual(projectedModel());
    expect(props.readOnlyBasicEventValues).toEqual({ [BASIC_EVENT_ID]: "0.02" });
    expect(props.catalogue).toEqual({
      basicEvents: [
        {
          id: BASIC_EVENT_ID,
          code: BASIC_EVENT.code,
          name: BASIC_EVENT.name,
          description: BASIC_EVENT.description,
          probability: { value: 0.02, expression: point(0.02) },
        },
      ],
      presentations: [
        {
          basicEventId: BASIC_EVENT_ID,
          failureModeLabel: "Fail to start",
          failureModeShort: "FS",
          commonCause: false,
          repairCredited: true,
        },
      ],
    });
    expect(mockedValidateFaultTreeModel).toHaveBeenCalledWith(props.model, {
      basicEventCatalogue: {
        workbookId: "sy-workbook",
        basicEvents: props.catalogue.basicEvents,
      },
      availableTransferTargets: [],
      faultTreeModels: [props.model],
    });
    expect(props.validation).toEqual([validationIssue]);
  });

  it("shows a legacy controlled rate on a common cause event read-only without recalculating it", () => {
    const basis = { kind: "FAILURE_RATE" as const, conversion: "LINEAR" as const,
      failureRate: { value: .001, unit: "HOUR" as const }, missionTime: { value: 100, unit: "HOUR" as const } };
    const { expression: _expression, ...plain } = BASIC_EVENT;
    setWorkbookContext({
      sy: makeAnalysis({ systemBasicEvents: [{ ...plain, failureMode: "COMMON_CAUSE_FAILURE", probability: .1, quantificationBasis: basis,
        controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "parameter-1" } }] }),
      controlledLegacyParameters: [{ workbookId: "da-workbook", workbookName: "DA", parameterId: "parameter-1",
        parameterName: "Rate", parameterType: "FAILURE_RATE", rateUnit: "HOUR", value: .002 }],
    });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");
    expect(latestEditorProps().catalogue.basicEvents[0]?.probability).toMatchObject({ value: .1, quantificationBasis: basis });
    expect(latestEditorProps().readOnlyBasicEventValues).toEqual({ [BASIC_EVENT_ID]: "Rate 1.0E-3 per hour over 100 hours" });
    expect(mockMutateSy).not.toHaveBeenCalled();
  });

  it("feeds the editor the point of a linked DA estimate and keeps the value read-only there", async () => {
    setWorkbookContext({
      sy: makeAnalysis({ systemBasicEvents: [{ ...BASIC_EVENT, expression: linked("parameter-1") }] }),
      controlledParameters: [{
        workbookId: "da-workbook",
        workbookName: "Approved DA",
        parameterId: "parameter-1",
        parameterName: "Pump demand failure",
        estimate: point(0.025),
        unit: "PROBABILITY",
      }],
    });

    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    expect(latestEditorProps().readOnlyBasicEventValues).toEqual({ [BASIC_EVENT_ID]: "Pump demand failure" });
    await waitFor(() => expect(latestEditorProps().catalogue.basicEvents[0]?.probability).toEqual({ value: 0.025, expression: linked("parameter-1") }));
  });

  it("explains a component value that cannot be evaluated in the editor validation", async () => {
    mockedValidateFaultTreeModel.mockReturnValue([{
      code: "FT_BASIC_EVENT_PROBABILITY_INVALID",
      severity: "ERROR",
      message: "Basic-event probability must be finite and between zero and one",
      entityId: BASIC_EVENT_ID,
      fieldPath: ["basicEvents", 0, "probability", "value"],
    }]);
    setWorkbookContext({ sy: makeAnalysis({ systemBasicEvents: [{ ...BASIC_EVENT, expression: linked("parameter-gone") }] }) });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    expect(latestEditorProps().validation).toEqual([]);
    await waitFor(() => expect(latestEditorProps().validation).toEqual([expect.objectContaining({
      message: "BE-PUMP-FS: MEF Error: Undefined Element Error: parameter 'da-workbook:parameter-gone' not found",
    })]));
  });

  it("renders a human-error event with the current selected HRA quantification", () => {
    const { expression: _expression, ...plain } = BASIC_EVENT;
    const controlledSy = makeAnalysis({
      systemBasicEvents: [{
        ...plain,
        failureMode: "HUMAN_ERROR",
        probability: 0.9,
        controlledDataSource: {
          referenceType: "HUMAN_FAILURE_EVENT",
          workbookId: "hr-workbook",
          entityId: "hfe-1",
          quantificationId: "hep-1",
        },
      }],
    });
    setWorkbookContext({
      sy: controlledSy,
      controlledHumanFailures: [{
        workbookId: "hr-workbook",
        workbookName: "Approved HRA",
        humanFailureEventId: "hfe-1",
        humanFailureEventName: "Operator fails to align cooling",
        hfeTiming: "POST_INITIATOR",
        quantificationId: "hep-1",
        methodology: "THERP",
        value: 0.037,
        valueKind: "MEAN",
      }],
    });

    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    expect(latestEditorProps().catalogue.basicEvents[0]?.probability).toEqual({
      value: 0.037,
      controlledDataSource: {
        referenceType: "HUMAN_FAILURE_EVENT",
        workbookId: "hr-workbook",
        entityId: "hfe-1",
        quantificationId: "hep-1",
      },
    });
  });

  it("writes an emitted editor operation back to the selected model and root basic-event catalogue", () => {
    const operation: FaultTreeOperation = {
      type: "UPDATE_MODEL",
      patch: { name: "Updated cooling fault tree" },
    };
    const next: FaultTreeOperationResult = {
      model: {
        ...projectedModel(),
        name: "Updated cooling fault tree",
      },
      catalogue: {
        basicEvents: [
          {
            id: BASIC_EVENT_ID,
            code: "BE-PUMP-UPDATED",
            name: "Updated pump event",
            description: "Updated event description",
            probability: { value: 0.04 },
          },
          {
            id: "be-valve-fails",
            code: "BE-VALVE-FS",
            name: "Valve fails to open",
            description: "Demand failure of the isolation valve",
            probability: { value: 0.01 },
          },
        ],
        presentations: [],
      },
    };
    mockedApplyFaultTreeOperation.mockReturnValue(next);
    const original = makeAnalysis();
    setWorkbookContext({ sy: original });

    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");
    const editorProps = latestEditorProps();

    act(() => editorProps.onOperation(operation));

    expect(mockedApplyFaultTreeOperation).toHaveBeenCalledWith(
      editorProps.model,
      editorProps.catalogue,
      operation,
    );
    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const mutator = mockMutateSy.mock.calls[0][0] as (draft: SystemsAnalysis) => SystemsAnalysis;
    const updated = mutator(original);

    expect(updated.systemLogicModels[0]).toEqual({
      ...LOGIC_MODEL,
      name: "Updated cooling fault tree",
    });
    expect(updated.systemLogicModels[0]).not.toHaveProperty("modelId");
    expect(updated.systemBasicEvents).toEqual([
      {
        ...BASIC_EVENT,
        code: "BE-PUMP-UPDATED",
        name: "Updated pump event",
        description: "Updated event description",
      },
      {
        uuid: "be-valve-fails",
        code: "BE-VALVE-FS",
        name: "Valve fails to open",
        description: "Demand failure of the isolation valve",
        eventType: "BASIC",
        expression: point(0.01),
        repairModeled: false,
        implementsSrs: [],
      },
    ]);
    expect(updated.systemBasicEvents[0]).not.toHaveProperty("probability");
    expect(updated.systemLogicModels[0]).not.toHaveProperty("basicEvents");
  });

  it("keeps the law of a basic event created in the editor as its SY expression", () => {
    const law: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: { family: "LOGNORMAL", mean: 1e-3, errorFactor: 3, level: 0.95 }, lower: null, upper: 1 } } };
    const created = { id: "be-new", code: "BE-NEW", name: "New basic event", description: "", probability: { value: 1e-3, expression: law } };
    const original = makeAnalysis();
    mockedApplyFaultTreeOperation.mockReturnValue({
      model: projectedModel(),
      catalogue: { basicEvents: [...original.systemBasicEvents.map(systemBasicEventToFaultTreeBasicEvent), created], presentations: [] },
    });
    setWorkbookContext({ sy: original });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    act(() => latestEditorProps().onOperation({ type: "ADD_BASIC_EVENT", basicEvent: created, parentGateId: "gate-top" }));

    const mutator = mockMutateSy.mock.calls[0]![0] as (draft: SystemsAnalysis) => SystemsAnalysis;
    const added = mutator(original).systemBasicEvents.find((event) => event.uuid === "be-new");
    expect(added).toMatchObject({ code: "BE-NEW", expression: law });
    expect(added).not.toHaveProperty("probability");
    expect(added).not.toHaveProperty("quantificationBasis");
  });

  it("keeps node selection in the canonical inspector until an explicit open request", () => {
    const openDrawer = jest.fn();
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={openDrawer} />);
    openTab("Fault tree");

    act(() => latestEditorProps().onSelectionChange({ kind: "LEAF", leafId: "leaf-pump" }));
    expect(openDrawer).not.toHaveBeenCalled();

    act(() => latestEditorProps().onOpenReference({ kind: "BASIC_EVENT", basicEventId: BASIC_EVENT_ID }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "be", id: BASIC_EVENT_ID });
  });

  it("uses read-only editor capabilities when the workbook cannot be edited", () => {
    setWorkbookContext({ editable: false });

    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    expect(screen.queryByText(FAULT_TREE_HINT)).not.toBeInTheDocument();
    expect(latestEditorProps().capabilities).toEqual({
      mode: "READ_ONLY",
      canEditBasicEvents: false,
      canEditLayout: false,
      canImport: false,
      canExport: true,
      canRunAnalysis: false,
    });
  });

  it("only offers creation for a system without a fault tree in author mode", () => {
    const withoutModel = makeAnalysis({ systemLogicModels: [] });
    setWorkbookContext({ sy: withoutModel, editable: false });
    const { rerender } = render(
      <ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />,
    );
    openTab("Fault tree");

    expect(screen.getByText("This system has no fault tree yet. Create it here, then right-click a gate to add its inputs.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create fault tree" })).not.toBeInTheDocument();
    expect(mockedFaultTreeEditor).not.toHaveBeenCalled();

    setWorkbookContext({ sy: withoutModel, editable: true });
    rerender(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    const randomUuid = jest.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CREATED_MODEL_ID);

    fireEvent.click(screen.getByRole("button", { name: "Create fault tree" }));

    expect(mockMutateSy).toHaveBeenCalledTimes(1);
    const mutator = mockMutateSy.mock.calls[0][0] as (draft: SystemsAnalysis) => SystemsAnalysis;
    const updated = mutator(withoutModel);
    expect(updated.systemLogicModels).toEqual([
      {
        uuid: CREATED_MODEL_ID,
        code: "FT-RCS",
        name: "Reactor cooling system fault tree",
        systemReference: SYSTEM_ID,
        description: "Remove reactor heat",
        modelRepresentation: "FAULT_TREE",
        topGate: null,
        gates: [],
        leafNodes: [],
        gateInputs: [],
        nodePositions: [],
        layout: {
          viewport: { x: 0, y: 0, zoom: 1 },
          mode: "AUTOMATIC",
          direction: "TOP_TO_BOTTOM",
        },
        implementsSrs: [{ sr: "SY-A7", hlr: "A" }],
      },
    ]);
    randomUuid.mockRestore();
  });

  it("represents a non-detailed system model without applying fault-tree validation", () => {
    const nonDetailed = {
      ...LOGIC_MODEL,
      topGate: null,
      gates: [],
      leafNodes: [],
      gateInputs: [],
      nodePositions: [],
      nonDetailedModelJustification: "System-level data are sufficient.",
    } satisfies SystemLogicModel;
    setWorkbookContext({ sy: makeAnalysis({ systemLogicModels: [nonDetailed] }) });

    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Fault tree");

    expect(screen.getByText(/uses a system-level model, so it has no fault tree/i)).toBeInTheDocument();
    expect(mockedValidateFaultTreeModel).not.toHaveBeenCalled();
    expect(mockedFaultTreeEditor).not.toHaveBeenCalled();
  });

  it("passes workbook identity to analysis APIs and wires the immutable result back to the editor", async () => {
    const owner = {
      workbookId: "sy-workbook",
      modelId: MODEL_ID,
      workbookRevision: 7,
    };
    const timestamp = "2026-08-22T12:00:00.000Z";
    const execution: FaultTreeExecuteResult = {
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: RUN_ID,
        owner,
        sourceWorkbooks: [{ workbookId: owner.workbookId, workbookRevision: owner.workbookRevision }],
        methodType: "FAULT_TREE",
        status: "SUCCEEDED",
        requestedBy: "analyst",
        requestedAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        engine: { name: "test-engine", version: "1" },
        failure: null,
      },
    };
    const result: FaultTreeAnalysisResult = {
      schemaVersion: "1.0.0",
      runId: RUN_ID,
      owner,
      topGateId: "gate-top",
      topEventProbability: 0.001,
      validationIssues: [],
      completedAt: timestamp,
    };
    mockedRunSyFaultTree.mockResolvedValue(execution);
    mockedGetSyFaultTreeResult.mockResolvedValue(result);
    const { rerender } = render(
      <ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />,
    );
    openTab("Quantification");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run probability" })); });
    openTab("Fault tree");

    expect(mockedValidateSyFaultTree).toHaveBeenCalledWith("sy-workbook", MODEL_ID, 7);
    expect(mockedRunSyFaultTree).toHaveBeenCalledWith("sy-workbook", MODEL_ID, 7, {
      calculationType: "PROBABILITY",
      workflow: "MANUAL",
      settings: expect.objectContaining({ algorithm: "BDD", approximation: "EXACT" }),
    });
    expect(mockedGetSyFaultTreeResult).toHaveBeenCalledWith("sy-workbook", MODEL_ID, RUN_ID);
    await waitFor(() => expect(latestEditorProps().analysisResult).toEqual(result));
    expect(latestEditorProps().resultIsStale).toBe(false);

    setWorkbookContext({ revision: 8 });
    rerender(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    expect(latestEditorProps().analysisResult).toEqual(result);
    expect(latestEditorProps().resultIsStale).toBe(true);
  });

  it("runs the selected fault trees through the batch workflow settings", async () => {
    const timestamp = "2026-08-22T12:00:00.000Z";
    const owner = { workbookId: "sy-workbook", modelId: MODEL_ID, workbookRevision: 7 };
    mockedRunSyFaultTree.mockResolvedValue({
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: RUN_ID,
        owner,
        sourceWorkbooks: [{ workbookId: owner.workbookId, workbookRevision: owner.workbookRevision }],
        methodType: "FAULT_TREE",
        status: "SUCCEEDED",
        requestedBy: "analyst",
        requestedAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        engine: { name: "test-engine", version: "1" },
        failure: null,
      },
    });
    mockedGetSyFaultTreeResult.mockResolvedValue({
      schemaVersion: "1.0.0",
      runId: RUN_ID,
      owner,
      topGateId: "gate-top",
      topEventProbability: 0.001,
      calculationType: "PROBABILITY",
      workflow: "BATCH",
      algorithm: "BDD",
      probabilityMethod: "EXACT",
      validationIssues: [],
      completedAt: timestamp,
    });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Quantification");

    fireEvent.click(screen.getByRole("radio", { name: "Batch" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run probability batch" })); });

    expect(mockedRunSyFaultTree).toHaveBeenCalledWith(
      "sy-workbook",
      MODEL_ID,
      7,
      expect.objectContaining({ calculationType: "PROBABILITY", workflow: "BATCH" }),
    );
    expect(mockedGetSyFaultTreeResult).toHaveBeenCalledWith("sy-workbook", MODEL_ID, RUN_ID);
  });

  it("surfaces a structured failed-run message without requesting a nonexistent result", async () => {
    const timestamp = "2026-08-22T12:00:00.000Z";
    mockedRunSyFaultTree.mockResolvedValue({
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: RUN_ID,
        owner: { workbookId: "sy-workbook", modelId: MODEL_ID, workbookRevision: 7 },
        sourceWorkbooks: [{ workbookId: "sy-workbook", workbookRevision: 7 }],
        methodType: "FAULT_TREE",
        status: "FAILED",
        requestedBy: "analyst",
        requestedAt: timestamp,
        startedAt: timestamp,
        completedAt: timestamp,
        engine: { name: "test-engine", version: "1" },
        failure: {
          kind: "VALIDATION",
          code: "FT_INVALID",
          message: "The solver rejected an invalid transfer.",
          details: {},
        },
      },
    });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Quantification");

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run probability" })); });

    expect(await screen.findByText("The solver rejected an invalid transfer.")).toBeInTheDocument();
    expect(mockedGetSyFaultTreeResult).not.toHaveBeenCalled();
  });

  it("marks an existing result stale while local changes are saving", async () => {
    const owner = { workbookId: "sy-workbook", modelId: MODEL_ID, workbookRevision: 7 };
    const result: FaultTreeAnalysisResult = {
      schemaVersion: "1.0.0",
      runId: RUN_ID,
      owner,
      topGateId: "gate-top",
      topEventProbability: 0.001,
      validationIssues: [],
      completedAt: "2026-08-22T12:00:00.000Z",
    };
    mockedRunSyFaultTree.mockResolvedValue({
      schemaVersion: "1.0.0",
      run: {
        schemaVersion: "1.0.0",
        id: RUN_ID,
        owner,
        sourceWorkbooks: [{ workbookId: owner.workbookId, workbookRevision: owner.workbookRevision }],
        methodType: "FAULT_TREE",
        status: "SUCCEEDED",
        requestedBy: "analyst",
        requestedAt: result.completedAt,
        startedAt: result.completedAt,
        completedAt: result.completedAt,
        engine: { name: "test-engine", version: "1" },
        failure: null,
      },
    });
    mockedGetSyFaultTreeResult.mockResolvedValue(result);
    const { rerender } = render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);
    openTab("Quantification");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run probability" })); });
    openTab("Fault tree");
    await waitFor(() => expect(latestEditorProps().analysisResult).toEqual(result));

    setWorkbookContext({ saveStatus: "saving" });
    rerender(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);

    expect(latestEditorProps().resultIsStale).toBe(true);
  });
});

describe("ModelsScreen system tabs", () => {
  const SUPPORT_ID = "system-ccw";

  function analysisWithMission(overrides: Partial<SystemsAnalysis> = {}): SystemsAnalysis {
    const base = makeAnalysis();
    return makeAnalysis({
      systemDefinitions: [
        { ...base.systemDefinitions[0]!, missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } } },
        { ...base.systemDefinitions[0]!, uuid: SUPPORT_ID, name: "Component cooling water", abbreviation: "CCW" },
      ],
      ...overrides,
    });
  }

  function applyLastMutation(base: SystemsAnalysis): SystemsAnalysis {
    const calls = mockMutateSy.mock.calls;
    const mutator = calls[calls.length - 1]![0] as (draft: SystemsAnalysis) => SystemsAnalysis;
    return mutator(base);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedFaultTreeEditor.mockImplementation(() => null);
    mockedValidateFaultTreeModel.mockReturnValue([]);
  });

  it("shows the system description and opens its editors", async () => {
    const openDrawer = jest.fn();
    setWorkbookContext({ sy: analysisWithMission() });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={openDrawer} />);

    expect(screen.getByRole("tab", { name: "Description" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Remove reactor heat")).toBeInTheDocument();
    expect(screen.getByText("…")).toBeInTheDocument();
    await act(async () => { await settledWithPraxis(() => undefined); });
    expect(screen.getByText("72 h")).toBeInTheDocument();
    expect(screen.getByText("Typed 72 hours")).toBeInTheDocument();
    expect(screen.getByText("Reactor vessel")).toBeInTheDocument();
    expect(screen.queryByText("Support systems")).not.toBeInTheDocument();

    const definition = screen.getByRole("region", { name: "Definition" });
    fireEvent.click(within(definition).getByRole("button", { name: "Edit" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "sysdef", id: SYSTEM_ID });
    const boundary = screen.getByRole("region", { name: "Model boundary" });
    fireEvent.click(within(boundary).getByRole("button", { name: "Edit" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "boundary", id: SYSTEM_ID });
  });

  it("adds a success-criterion variant and an alignment, then opens their editors", () => {
    const sy = analysisWithMission();
    const openDrawer = jest.fn();
    setWorkbookContext({ sy });
    const randomUuid = jest.spyOn(globalThis.crypto, "randomUUID");
    randomUuid.mockReturnValueOnce("00000000-0000-4000-8000-000000000021").mockReturnValueOnce("00000000-0000-4000-8000-000000000022");
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={openDrawer} />);

    fireEvent.click(screen.getByRole("button", { name: "Add variant" }));
    expect(applyLastMutation(sy).variableSuccessCriteria).toEqual([
      expect.objectContaining({ uuid: "00000000-0000-4000-8000-000000000021", systemReference: SYSTEM_ID, basis: "" }),
    ]);
    expect(openDrawer).toHaveBeenCalledWith({ kind: "variant", id: "00000000-0000-4000-8000-000000000021" });

    fireEvent.click(screen.getByRole("button", { name: "Add alignment" }));
    expect(applyLastMutation(sy).systemDefinitions[0]!.alignments).toEqual([
      expect.objectContaining({ uuid: "00000000-0000-4000-8000-000000000022", modeled: true, isNormalAlignment: true }),
    ]);
    expect(openDrawer).toHaveBeenCalledWith({ kind: "alignment", id: "00000000-0000-4000-8000-000000000022" });
    randomUuid.mockRestore();
  });

  it("flags an alignment that is not modeled without a reason", () => {
    const sy = analysisWithMission();
    const withAlignment = makeAnalysis({
      systemDefinitions: [
        { ...sy.systemDefinitions[0]!, alignments: [{ uuid: "align-b", name: "Train B standby", systemReference: SYSTEM_ID, isNormalAlignment: false, modeled: false, implementsSrs: [] }] },
        sy.systemDefinitions[1]!,
      ],
    });
    const openDrawer = jest.fn();
    setWorkbookContext({ sy: withAlignment });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={openDrawer} />);

    const alignments = screen.getByRole("table", { name: "Alignments" });
    expect(within(alignments).getByText("Reason required")).toBeInTheDocument();
    fireEvent.click(within(alignments).getByRole("button", { name: "Edit Train B standby" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "alignment", id: "align-b" });
  });

  it("lists the tree's basic events in a read table and opens the editor from a row", async () => {
    const openDrawer = jest.fn();
    const { expression: _expression, ...plain } = BASIC_EVENT;
    setWorkbookContext({
      sy: analysisWithMission({
        systemBasicEvents: [
          { ...BASIC_EVENT },
          {
            ...BASIC_EVENT,
            uuid: "be-pump-fr",
            code: "BE-PUMP-FR",
            name: "Pump fails to run",
            failureMode: "FAILURE_TO_RUN",
            expression: { node: "MODEL", model: { form: "MISSION", rate: linked("parameter-rate"), missionTime: { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 72 } } } } },
          },
          {
            ...BASIC_EVENT,
            uuid: "be-gone",
            code: "BE-GONE",
            name: "Valve fails to open",
            failureMode: "FAILURE_TO_OPEN",
            expression: linked("parameter-gone"),
          },
          {
            ...plain,
            uuid: "be-hfe",
            code: "BE-HFE",
            name: "Operator fails to start the pump",
            failureMode: "HUMAN_ERROR",
            probability: 0.002,
            controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-workbook", entityId: "parameter-hep" },
          },
        ],
        systemLogicModels: [{
          ...LOGIC_MODEL,
          leafNodes: [
            ...LOGIC_MODEL.leafNodes,
            { id: "leaf-pump-fr", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-pump-fr" },
            { id: "leaf-gone", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-gone" },
            { id: "leaf-hfe", kind: "BASIC_EVENT_REFERENCE", basicEventId: "be-hfe" },
          ],
        }],
      }),
      controlledParameters: [
        { workbookId: "da-workbook", workbookName: "Approved DA", parameterId: "parameter-rate", parameterName: "Pump run failure rate", unit: "PER_HOUR",
          estimate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 0.00004 } } } },
      ],
      controlledLegacyParameters: [
        { workbookId: "da-workbook", workbookName: "Approved DA", parameterId: "parameter-hep", parameterName: "Operator start failure", parameterType: "PROBABILITY", value: 0.003 },
      ],
    });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={openDrawer} />);
    fireEvent.click(screen.getByRole("tab", { name: /Basic events/ }));

    const table = screen.getByRole("table", { name: "Basic events" });
    expect(within(table).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(table).queryAllByRole("combobox")).toHaveLength(0);
    const handEntered = within(table).getByText("Pump fails to start").closest("tr")!;
    expect(within(handEntered).getByText("0.02")).toBeInTheDocument();
    await waitFor(() => expect(within(handEntered).getByText("2.0E-2")).toBeInTheDocument());
    expect(within(handEntered).getAllByText("Typed")).toHaveLength(2);
    const linkedRow = within(table).getByText("Pump fails to run").closest("tr")!;
    expect(within(linkedRow).getByText("Mission: rate Pump run failure rate over 72 hours")).toBeInTheDocument();
    await waitFor(() => expect(within(linkedRow).getByText("2.9E-3")).toBeInTheDocument());
    expect(within(linkedRow).getByText("DA · Pump run failure rate")).toBeInTheDocument();
    expect(within(linkedRow).queryByText("Value changed in DA")).toBeNull();
    const gone = within(table).getByText("Valve fails to open").closest("tr")!;
    expect(within(gone).getByText("Linked source unavailable")).toHaveClass("sy-error");
    await waitFor(() => expect(within(gone).getByText("MEF Error: Undefined Element Error: parameter 'da-workbook:parameter-gone' not found")).toHaveClass("sy-error"));
    const human = within(table).getByText("Operator fails to start the pump").closest("tr")!;
    expect(within(human).getByText("3.0E-3")).toBeInTheDocument();
    expect(within(human).getByText("Value changed in DA")).toBeInTheDocument();

    fireEvent.click(within(table).getByRole("button", { name: "Edit BE-PUMP-FS" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "be", id: BASIC_EVENT_ID });
  });

  it("opens a house event's editor from its row", () => {
    const openDrawer = jest.fn();
    const house = { id: "leaf-house", kind: "HOUSE_EVENT" as const, code: "H-TRAIN-A", name: "Train A in service", description: "", state: true };
    setWorkbookContext({ sy: analysisWithMission({ systemLogicModels: [{ ...LOGIC_MODEL, leafNodes: [...LOGIC_MODEL.leafNodes, house] }] }) });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={openDrawer} />);
    fireEvent.click(screen.getByRole("tab", { name: /Basic events/ }));

    const table = screen.getByRole("table", { name: "House events" });
    expect(within(table).getByText("True")).toBeInTheDocument();
    fireEvent.click(within(table).getByRole("button", { name: "Edit H-TRAIN-A" }));
    expect(openDrawer).toHaveBeenCalledWith({ kind: "house", id: "leaf-house", modelId: MODEL_ID });
  });

  it("passes the system mission time expression to the fault-tree editor and its PRAXIS point to the SIL run", async () => {
    const sy = analysisWithMission();
    setWorkbookContext({ sy });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);

    openTab("Fault tree");
    await act(async () => { await settledWithPraxis(() => undefined); });
    expect(latestEditorProps().defaultMissionTime).toEqual(sy.systemDefinitions.find((system) => system.uuid === SYSTEM_ID)?.missionTime);
    expect(latestEditorProps().parameterTable).toBeInstanceOf(Map);

    openTab("Quantification");
    fireEvent.click(screen.getByRole("radio", { name: "SIL" }));
    fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.queryByRole("spinbutton", { name: "Mission time hours" })).not.toBeInTheDocument();
    expect(screen.getByText("SIL uses the system mission time of 72 h.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Run SIL" })); });
    expect(mockedRunSyFaultTree).toHaveBeenCalledWith("sy-workbook", MODEL_ID, 7, expect.objectContaining({ calculationType: "SIL", settings: expect.objectContaining({ missionTimeHours: 72 }) }));
  });

  it("blocks a SIL run when the system has no mission time", () => {
    setWorkbookContext({ sy: makeAnalysis() });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);

    openTab("Fault tree");
    expect(latestEditorProps().defaultMissionTime).toBeUndefined();
    openTab("Quantification");
    fireEvent.click(screen.getByRole("radio", { name: "SIL" }));
    expect(screen.getByText("SIL needs a system mission time. Set it in the system definition.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run SIL" })).toBeDisabled();
  });

  it("asks for a top gate before quantifying", () => {
    setWorkbookContext({ sy: analysisWithMission({ systemLogicModels: [{ ...LOGIC_MODEL, topGate: null }] }) });
    render(<ModelsScreen sysId={SYSTEM_ID} setSysId={jest.fn()} openDrawer={jest.fn()} />);

    openTab("Quantification");
    expect(screen.getByText("Set the top gate in the Fault tree tab before quantifying this system.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Fault-tree quantification" })).not.toBeInTheDocument();
  });
});
