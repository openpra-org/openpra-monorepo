import {
  ImmutableAnalysisRunContextSchema,
  createImmutableAnalysisRunContext,
} from "..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174900";

describe("immutable workbook analysis-run context", () => {
  const input = {
    owner: { workbookId: "esq-workbook", workbookRevision: 4, modelId: MODEL_ID },
    sourceWorkbooks: [
      { workbookId: "esq-workbook", workbookRevision: 4 },
      { workbookId: "sy-workbook", workbookRevision: 7 },
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
});
