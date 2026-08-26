import { render, screen } from "@testing-library/react";
import type { AnalysisRunProvenance } from "interfaces-shared-types/newly-developed-methods";
import { EsqAnalysisRunProvenance } from "../esqAnalysisRunProvenance";

const ESQ_WORKBOOK_ID = "esq-workbook";
const SY_WORKBOOK_ID = "sy-workbook";
const CONFIGURATION_ID = "123e4567-e89b-42d3-a456-426614174900";
const FAULT_TREE_ID = "223e4567-e89b-42d3-a456-426614174900";
const TOP_EVENT_ID = "323e4567-e89b-42d3-a456-426614174900";
const RUN_ID = "423e4567-e89b-42d3-a456-426614174900";

const provenance: AnalysisRunProvenance = {
  run: {
    schemaVersion: "1.0.0",
    id: RUN_ID,
    owner: {
      workbookId: ESQ_WORKBOOK_ID,
      workbookRevision: 7,
      modelId: CONFIGURATION_ID,
    },
    sourceWorkbooks: [
      { workbookId: ESQ_WORKBOOK_ID, workbookRevision: 7 },
      { workbookId: SY_WORKBOOK_ID, workbookRevision: 11 },
    ],
    methodType: "HYBRID_CAUSAL_LOGIC",
    status: "SUCCEEDED",
    requestedBy: "analyst",
    requestedAt: "2026-08-25T12:00:00.000Z",
    startedAt: "2026-08-25T12:00:01.000Z",
    completedAt: "2026-08-25T12:00:02.000Z",
    engine: { name: "PRAXIS", version: "1.0.0" },
    failure: null,
  },
  target: {
    targetType: "HCL_FAULT_TREE",
    configuration: {
      workbookId: ESQ_WORKBOOK_ID,
      workbookRevision: 7,
      modelId: CONFIGURATION_ID,
    },
    faultTreeTopEvent: {
      workbookId: SY_WORKBOOK_ID,
      workbookRevision: 11,
      modelId: FAULT_TREE_ID,
      entityId: TOP_EVENT_ID,
    },
  },
  contributions: [
    {
      hostType: "ESQ",
      workbook: { workbookId: ESQ_WORKBOOK_ID, workbookRevision: 7 },
      models: [{ workbookId: ESQ_WORKBOOK_ID, modelId: CONFIGURATION_ID }],
      entities: [],
    },
    {
      hostType: "SY",
      workbook: { workbookId: SY_WORKBOOK_ID, workbookRevision: 11 },
      models: [{ workbookId: SY_WORKBOOK_ID, modelId: FAULT_TREE_ID }],
      entities: [{
        referenceType: "FAULT_TREE_TOP_EVENT",
        workbookId: SY_WORKBOOK_ID,
        modelId: FAULT_TREE_ID,
        entityId: TOP_EVENT_ID,
      }],
    },
  ],
};

describe("ESQ immutable analysis-run provenance", () => {
  it("shows the exact run, target, workbook revisions, models, and entities", () => {
    render(<EsqAnalysisRunProvenance runs={[provenance]} loading={false} error={null} />);

    expect(screen.getByRole("region", { name: "Immutable analysis runs" })).toBeInTheDocument();
    expect(screen.getByText("HCL fault-tree quantification")).toBeInTheDocument();
    expect(screen.getByText(RUN_ID)).toBeInTheDocument();
    expect(screen.getByText(`${ESQ_WORKBOOK_ID} / ${CONFIGURATION_ID} / revision 7`)).toBeInTheDocument();
    expect(screen.getByText(SY_WORKBOOK_ID)).toBeInTheDocument();
    expect(screen.getByText("revision 11")).toBeInTheDocument();
    expect(screen.getAllByText(FAULT_TREE_ID)).not.toHaveLength(0);
    expect(screen.getByText(`FAULT_TREE_TOP_EVENT · ${FAULT_TREE_ID} / ${TOP_EVENT_ID}`)).toBeInTheDocument();
  });

  it("keeps the empty state brief", () => {
    render(<EsqAnalysisRunProvenance runs={[]} loading={false} error={null} />);
    expect(screen.getByText(/Run exact inference or HCL quantification/)).toBeInTheDocument();
  });
});
