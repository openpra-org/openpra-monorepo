import { fireEvent, render, screen, within } from "@testing-library/react";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import type { PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { createBlankEs } from "../../../../../backends/web-backend/src/es-workbooks/blank-es";
import { createEmptyEventTree } from "../../newly-developed-methods/event-tree";
import type { IeDaFrequencyOption } from "../../ie-workbooks/ieDaLinks";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { EsWorkbookProvider, type EsMutator } from "../esWorkbookContext";
import { SequencesScreen } from "../esScreens";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

const NOW = "2026-10-08T00:00:00.000Z";

const CC: PRAConfigurationControl = {
  uuid: "cc-test",
  name: "CC test",
  type: TechnicalElementTypes.PRA_CONFIGURATION_CONTROL,
  version: "1",
  created: NOW,
  modified: NOW,
  workflowState: "DRAFT",
  workflowHistory: [],
  plantStage: "PRE_OPERATIONAL",
  metadata: { versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" }, analysisDate: NOW, analysts: [], reviewers: [], scope: "", limitations: [], lastModifiedDate: NOW, lastModifiedBy: "tester" },
  conformanceMatrix: [],
  internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
  activePeerReviewIds: [],
  activeAuditIds: [],
  freezeDate: "2026-05-01",
  monitoredChanges: [],
  praUpdateRecords: [],
  pendingChangeAssessments: [],
  computerCodeControls: [],
  documentation: { programDescription: "", changeMonitoringProcess: "", praMaintenanceProcess: "", cumulativeImpactProcess: "", codeControlProcess: "", implementsSrs: [] },
  invokedPriorToFirstPeerReview: false,
};

const perYear = (value: number): UncertainExpression => ({ node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value } } });

const OPTIONS: IeDaFrequencyOption[] = [
  { workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-IE-01", parameterName: "Loss of flow", estimate: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 4e-2, errorFactor: 3, level: 0.95 } } } },
  { workbookId: "da-1", workbookName: "Plant DA", parameterId: "DA-IE-02", parameterName: "Loss of heat sink", estimate: perYear(2e-3) },
];

function esWith(expression: UncertainExpression): EventSequenceAnalysis {
  const tree = { ...createEmptyEventTree("IE-1", "POS-1"), initiatingEventFrequency: { expression, annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 } } } as const;
  return { ...createBlankEs("ES", "tester"), eventTrees: [tree] };
}

function renderSequences(es: EventSequenceAnalysis) {
  const mutateEs = jest.fn<void, [EsMutator]>();
  render(
    <EsWorkbookProvider data={{ es, cc: CC, nms: [], posLink: { linkedPosWorkbookId: null, linkedName: null, states: [], sources: [] }, ieLink: { linkedIeWorkbookId: null, linkedName: null, initiators: [] }, daFrequencies: OPTIONS }} editable mutateEs={mutateEs}>
      <SequencesScreen />
    </EsWorkbookProvider>,
  );
  const applied = (): EventSequenceAnalysis => mutateEs.mock.calls.reduce((current, [mutator]) => mutator(current), es);
  return { applied };
}

describe("ES event-tree frequency links", () => {
  it("offers the DA frequency parameters of the project and links one", () => {
    const es = esWith(perYear(1e-2));
    const { applied } = renderSequences(es);
    const source = within(screen.getByRole("group", { name: "Initiating-event frequency" })).getByLabelText<HTMLSelectElement>("Source");
    expect(Array.from(source.options).map((option) => option.textContent)).toEqual(["Typed here", "DA-IE-01 in Plant DA", "DA-IE-02 in Plant DA"]);

    fireEvent.change(source, { target: { value: "da-1:DA-IE-02" } });

    expect(applied().eventTrees?.[0]?.initiatingEventFrequency?.expression).toEqual({
      node: "PARAMETER",
      reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-02" },
    });
  });

  it("shows the held link and lets the analyst type a value instead", () => {
    const es = esWith({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "DA-IE-01" } });
    const { applied } = renderSequences(es);
    const source = within(screen.getByRole("group", { name: "Initiating-event frequency" })).getByLabelText<HTMLSelectElement>("Source");
    expect(source.selectedOptions[0]?.textContent).toBe("DA-IE-01 in Plant DA");

    fireEvent.change(source, { target: { value: "" } });

    expect(applied().eventTrees?.[0]?.initiatingEventFrequency?.expression).toEqual(perYear(1e-2));
  });
});
