import {
  WorkbookModelDependenciesResponseSchema,
  WorkbookModelDependencySchema,
} from "../..";

const MODEL_ID = "123e4567-e89b-42d3-a456-426614174900";
const NODE_ID = "123e4567-e89b-42d3-a456-426614174901";

const dependency = {
  sourceHostType: "ESQ",
  sourceWorkbookId: "esq-workbook",
  path: "/hclConfigurations/0/bayesianNetwork",
  reference: { workbookId: "esq-workbook", modelId: MODEL_ID },
} as const;

describe("workbook model dependency contracts", () => {
  it("accepts model addresses and typed entity references with source pointers", () => {
    expect(WorkbookModelDependencySchema.safeParse(dependency).success).toBe(true);
    expect(
      WorkbookModelDependencySchema.safeParse({
        ...dependency,
        path: "/hclConfigurations/0/bindings/0/bayesianNetworkNode",
        reference: {
          referenceType: "BAYESIAN_NETWORK_NODE",
          workbookId: "esq-workbook",
          modelId: MODEL_ID,
          entityId: NODE_ID,
        },
      }).success,
    ).toBe(true);
  });

  it("returns a strict workbook-qualified target and deterministic dependency list", () => {
    expect(
      WorkbookModelDependenciesResponseSchema.safeParse({
        target: { workbookId: "esq-workbook", modelId: MODEL_ID },
        dependencies: [dependency],
      }).success,
    ).toBe(true);
  });

  it.each([
    { ...dependency, path: "hclConfigurations/0" },
    { ...dependency, sourceHostType: "PROJECT" },
    { ...dependency, projectId: "project-1" },
    { ...dependency, reference: { modelId: MODEL_ID } },
    { ...dependency, reference: { modelId: MODEL_ID, entityId: NODE_ID } },
  ])("rejects unqualified or project-owned dependency %#", (candidate) => {
    expect(WorkbookModelDependencySchema.safeParse(candidate).success).toBe(false);
  });
});
