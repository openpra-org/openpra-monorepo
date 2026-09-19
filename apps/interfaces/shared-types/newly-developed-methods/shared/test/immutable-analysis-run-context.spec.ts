import {
  AnalysisRunProvenanceListSchema,
  ImmutableAnalysisRunContextSchema,
  createImmutableAnalysisRunContext,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174900";
const QUERY_NODE_ID = "223e4567-e89b-42d3-a456-426614174900";

describe("immutable workbook analysis-run context", () => {
  const input = {
    owner: { workbookId: "esq-workbook", workbookRevision: 4, modelId: MODEL_ID },
    sourceWorkbooks: [
      { workbookId: "esq-workbook", workbookRevision: 4 },
      { workbookId: "sy-workbook", workbookRevision: 7 },
      { workbookId: "da-workbook", workbookRevision: 3 },
      { workbookId: "hr-workbook", workbookRevision: 5 },
    ],
    workbookSnapshots: [
      {
        hostType: "ESQ" as const,
        identity: { workbookId: "esq-workbook", workbookRevision: 4 },
        mef: { name: "ESQ snapshot", hclConfigurations: [] },
      },
      {
        hostType: "SY" as const,
        identity: { workbookId: "sy-workbook", workbookRevision: 7 },
        mef: { name: "SY snapshot", systemLogicModels: [] },
      },
      {
        hostType: "DA" as const,
        identity: { workbookId: "da-workbook", workbookRevision: 3 },
        mef: { name: "DA snapshot", parameters: [] },
      },
      {
        hostType: "HRA" as const,
        identity: { workbookId: "hr-workbook", workbookRevision: 5 },
        mef: { name: "HRA snapshot", humanFailureEvents: [], hepQuantifications: [] },
      },
    ],
  };

  it("requires an exact immutable snapshot for every contributing workbook revision", () => {
    expect(ImmutableAnalysisRunContextSchema.safeParse(input).success).toBe(true);
  });

  it.each([
    { ...input, sourceWorkbooks: [input.sourceWorkbooks[0], input.sourceWorkbooks[0]] },
    { ...input, sourceWorkbooks: [input.sourceWorkbooks[1]] },
    { ...input, workbookSnapshots: [input.workbookSnapshots[0]] },
    {
      ...input,
      workbookSnapshots: [
        input.workbookSnapshots[0],
        {
          ...input.workbookSnapshots[1],
          identity: { ...input.workbookSnapshots[1].identity, workbookRevision: 8 },
        },
      ],
    },
    {
      ...input,
      workbookSnapshots: [input.workbookSnapshots[0], input.workbookSnapshots[0]],
    },
  ])("rejects inconsistent source/snapshot context %#", (candidate) => {
    expect(ImmutableAnalysisRunContextSchema.safeParse(candidate).success).toBe(false);
  });

  it("deep-clones and freezes the captured MEFs", () => {
    const mutableInput = structuredClone(input);
    const captured = createImmutableAnalysisRunContext(mutableInput);
    mutableInput.workbookSnapshots[0].mef.name = "changed after capture";

    expect(captured.workbookSnapshots[0].mef.name).toBe("ESQ snapshot");
    expect(Object.isFrozen(captured)).toBe(true);
    expect(Object.isFrozen(captured.workbookSnapshots)).toBe(true);
    expect(Object.isFrozen(captured.workbookSnapshots[0].mef)).toBe(true);
  });

  it("ties ESQ run targets and entity references to every exact source revision", () => {
    const provenance = {
      schemaVersion: "1.0.0" as const,
      runs: [{
        run: {
          schemaVersion: "1.0.0" as const,
          id: "323e4567-e89b-42d3-a456-426614174900",
          owner: input.owner,
          sourceWorkbooks: input.sourceWorkbooks,
          methodType: "BAYESIAN_NETWORK" as const,
          status: "SUCCEEDED" as const,
          requestedBy: "analyst",
          requestedAt: "2026-08-25T12:00:00.000Z",
          startedAt: "2026-08-25T12:00:01.000Z",
          completedAt: "2026-08-25T12:00:02.000Z",
          engine: { name: "PRAXIS", version: "1.0.0" },
          failure: null,
        },
        target: {
          targetType: "BAYESIAN_NETWORK_QUERY" as const,
          model: input.owner,
          queryNodeIds: [QUERY_NODE_ID],
          evidenceNodeIds: [],
        },
        contributions: input.workbookSnapshots.map((snapshot) => ({
          hostType: snapshot.hostType,
          workbook: snapshot.identity,
          models: snapshot.hostType === "ESQ"
            ? [{ workbookId: snapshot.identity.workbookId, modelId: MODEL_ID }]
            : [],
          entities: snapshot.hostType === "ESQ"
            ? [{
              referenceType: "BAYESIAN_NETWORK_NODE" as const,
              workbookId: snapshot.identity.workbookId,
              modelId: MODEL_ID,
              entityId: QUERY_NODE_ID,
            }]
            : [],
        })),
      }],
    };

    expect(AnalysisRunProvenanceListSchema.safeParse(provenance).success).toBe(true);
    expect(AnalysisRunProvenanceListSchema.safeParse({
      ...provenance,
      runs: [{
        ...provenance.runs[0],
        contributions: provenance.runs[0]!.contributions.slice(0, -1),
      }],
    }).success).toBe(false);
  });
});
