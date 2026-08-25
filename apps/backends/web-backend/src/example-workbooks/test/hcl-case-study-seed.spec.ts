import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  ES_ANALYSIS_HCL,
  ESQ_ANALYSIS_HCL,
  IE_ANALYSIS_HCL,
  SY_ANALYSIS_HCL,
} from "../seeds/hcl-case-study-seed";
import {
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
} from "../seeds/dependency-model-seed";
import { ES_EXAMPLES, ESQ_EXAMPLES, IE_EXAMPLES, SY_EXAMPLES } from "../seeds";

describe("HCL dissertation case-study example", () => {
  it("provides schema-complete IE, SY, ES, and ESQ workbooks", () => {
    expect(() => InitiatingEventsAnalysisSchema.parse(IE_ANALYSIS_HCL)).not.toThrow();
    expect(() => SystemsAnalysisSchema.parse(SY_ANALYSIS_HCL)).not.toThrow();
    expect(() => EventSequenceAnalysisSchema.parse(ES_ANALYSIS_HCL)).not.toThrow();
    expect(() => EventSequenceQuantificationSchema.parse(ESQ_ANALYSIS_HCL)).not.toThrow();
  });

  it("reconstructs the published case-study model inventory", () => {
    expect(SY_ANALYSIS_HCL.systemLogicModels).toHaveLength(22);
    expect(ES_ANALYSIS_HCL.eventTrees).toHaveLength(3);
    expect(ES_ANALYSIS_HCL.eventSequences).toHaveLength(45);
    expect(ES_ANALYSIS_HCL.eventTrees?.map(({ label }) => label)).toEqual(["LOOP", "SBO", "FLEX"]);
    expect(ES_ANALYSIS_HCL.eventSequenceFamilies.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Successful stabilization", "Core damage", "LOCA", "ATWS"]),
    );
  });

  it("is offered by each associated workbook selector", () => {
    for (const examples of [IE_EXAMPLES, SY_EXAMPLES, ES_EXAMPLES, ESQ_EXAMPLES]) {
      expect(examples).toContainEqual(expect.objectContaining({ id: "hcl" }));
    }
  });

  it("reconciles every local FT, BE, BN, and event-tree reference", () => {
    const syWorkbookId = "real-hcl-sy-workbook";
    const esqWorkbookId = "real-hcl-esq-workbook";
    const es = EventSequenceAnalysisSchema.parse(reconcileExampleEventTreeDependencyReferences(
      EventSequenceAnalysisSchema.parse(structuredClone(ES_ANALYSIS_HCL)),
      SY_ANALYSIS_HCL,
      syWorkbookId,
    ));
    const esq = EventSequenceQuantificationSchema.parse(reconcileExampleEsqDependencyReferences(
      EventSequenceQuantificationSchema.parse(structuredClone(ESQ_ANALYSIS_HCL)),
      esqWorkbookId,
      SY_ANALYSIS_HCL,
      syWorkbookId,
    ));

    const modelIds = new Set(SY_ANALYSIS_HCL.systemLogicModels.map(({ uuid }) => uuid));
    const basicEventIds = new Set(SY_ANALYSIS_HCL.systemBasicEvents.map(({ uuid }) => uuid));
    for (const tree of es.eventTrees ?? []) {
      for (const functionalEvent of Object.values(tree.functionalEvents)) {
        expect(functionalEvent.faultTreeTopEvent?.workbookId).toBe(syWorkbookId);
        expect(modelIds.has(functionalEvent.faultTreeTopEvent!.modelId)).toBe(true);
      }
    }

    const configuration = esq.hclConfigurations[0]!;
    const network = esq.bayesianNetworks[0]!;
    expect(configuration.bayesianNetwork.workbookId).toBe(esqWorkbookId);
    expect(configuration.faultTrees).toHaveLength(22);
    expect(configuration.faultTrees.every(({ workbookId, modelId }) =>
      workbookId === syWorkbookId && modelIds.has(modelId))).toBe(true);
    expect(configuration.bindings.every(({ faultTreeBasicEvent }) =>
      faultTreeBasicEvent.workbookId === syWorkbookId && basicEventIds.has(faultTreeBasicEvent.entityId))).toBe(true);
    expect(validateBayesianNetworkModel(network, {
      evidence: configuration.baseEvidence,
      hclBindings: configuration.bindings,
      workbookId: esqWorkbookId,
    }).filter(({ severity }) => severity === "ERROR")).toEqual([]);
  });
});
