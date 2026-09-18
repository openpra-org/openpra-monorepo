import { InitiatingEventsAnalysisSchema } from "interfaces-mef-types/zod/ie/initiating-event-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { DataAnalysisSchema } from "interfaces-mef-types/zod/da/data-analysis";
import { HumanReliabilityAnalysisSchema } from "interfaces-mef-types/zod/hr/human-reliability-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { RiskIntegrationSchema } from "interfaces-mef-types/zod/ri/risk-integration";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  DA_ANALYSIS_HCL,
  ES_ANALYSIS_HCL,
  ESQ_ANALYSIS_HCL,
  IE_ANALYSIS_HCL,
  HR_ANALYSIS_HCL,
  RC_ANALYSIS_HCL,
  RI_ANALYSIS_HCL,
  SY_ANALYSIS_HCL,
} from "../seeds/hcl-case-study-seed";
import {
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
  reconcileExampleSyDependencyOwnership,
  reconcileExampleRiskResultReferences,
} from "../seeds/dependency-model-seed";
import { DA_EXAMPLES, ES_EXAMPLES, ESQ_EXAMPLES, HR_EXAMPLES, IE_EXAMPLES, RC_EXAMPLES, RI_EXAMPLES, SY_EXAMPLES } from "../seeds";

describe("HCL dissertation case-study example", () => {
  it("provides schema-complete IE, SY, HRA, DA, ES, ESQ, RC, and RI workbooks", () => {
    expect(() => InitiatingEventsAnalysisSchema.parse(IE_ANALYSIS_HCL)).not.toThrow();
    expect(() => SystemsAnalysisSchema.parse(SY_ANALYSIS_HCL)).not.toThrow();
    expect(() => DataAnalysisSchema.parse(DA_ANALYSIS_HCL)).not.toThrow();
    expect(() => HumanReliabilityAnalysisSchema.parse(HR_ANALYSIS_HCL)).not.toThrow();
    expect(() => EventSequenceAnalysisSchema.parse(ES_ANALYSIS_HCL)).not.toThrow();
    expect(() => EventSequenceQuantificationSchema.parse(ESQ_ANALYSIS_HCL)).not.toThrow();
    expect(() => RadiologicalConsequenceAnalysisSchema.parse(RC_ANALYSIS_HCL)).not.toThrow();
    expect(() => RiskIntegrationSchema.parse(RI_ANALYSIS_HCL)).not.toThrow();
  });

  it("reconstructs the published case-study model inventory", () => {
    expect(SY_ANALYSIS_HCL.systemLogicModels).toHaveLength(22);
    expect(DA_ANALYSIS_HCL.parameters).toHaveLength(23);
    expect(HR_ANALYSIS_HCL.humanFailureEvents).toHaveLength(2);
    expect(HR_ANALYSIS_HCL.hepQuantifications).toHaveLength(2);
    expect(ES_ANALYSIS_HCL.eventTrees).toHaveLength(3);
    expect(ES_ANALYSIS_HCL.eventSequences).toHaveLength(45);
    expect(SY_ANALYSIS_HCL.dependencyBayesianNetworks).toHaveLength(1);
    expect(SY_ANALYSIS_HCL.dependencyHclConfigurations).toHaveLength(1);
    expect(ESQ_ANALYSIS_HCL.bayesianNetworks).toHaveLength(0);
    expect(ESQ_ANALYSIS_HCL.hclConfigurations).toHaveLength(0);
    expect(ES_ANALYSIS_HCL.eventTrees?.map(({ label }) => label)).toEqual(["LOOP", "SBO", "FLEX"]);
    expect(ES_ANALYSIS_HCL.eventSequenceFamilies.map(({ name }) => name)).toEqual(
      expect.arrayContaining(["Successful stabilization", "Core damage", "LOCA", "ATWS"]),
    );
  });

  it("is offered by each associated workbook selector", () => {
    for (const examples of [IE_EXAMPLES, SY_EXAMPLES, HR_EXAMPLES, DA_EXAMPLES, ES_EXAMPLES, ESQ_EXAMPLES, RC_EXAMPLES, RI_EXAMPLES]) {
      expect(examples).toContainEqual(expect.objectContaining({ id: "hcl" }));
    }
  });

  it("reconciles every local FT, BE, BN, and event-tree reference", () => {
    const syWorkbookId = "real-hcl-sy-workbook";
    const esqWorkbookId = "real-hcl-esq-workbook";
    const sy = SystemsAnalysisSchema.parse(reconcileExampleSyDependencyOwnership(
      SystemsAnalysisSchema.parse(structuredClone(SY_ANALYSIS_HCL)),
      syWorkbookId,
    ));
    const es = EventSequenceAnalysisSchema.parse(reconcileExampleEventTreeDependencyReferences(
      EventSequenceAnalysisSchema.parse(structuredClone(ES_ANALYSIS_HCL)),
      sy,
      syWorkbookId,
    ));
    const esq = EventSequenceQuantificationSchema.parse(reconcileExampleEsqDependencyReferences(
      EventSequenceQuantificationSchema.parse(structuredClone(ESQ_ANALYSIS_HCL)),
      esqWorkbookId,
      sy,
      syWorkbookId,
    ));

    const modelIds = new Set(sy.systemLogicModels.map(({ uuid }) => uuid));
    const basicEventIds = new Set(sy.systemBasicEvents.map(({ uuid }) => uuid));
    expect(sy.systemBasicEvents.every((event) => event.controlledDataSource === undefined)).toBe(true);
    expect(sy.humanFailureEventIntegrations).toEqual([]);
    const ownedConfiguration = sy.dependencyHclConfigurations?.[0];
    expect(ownedConfiguration?.bayesianNetwork.workbookId).toBe(syWorkbookId);
    expect(ownedConfiguration?.faultTrees).toHaveLength(22);
    expect(ownedConfiguration?.faultTrees.every(({ workbookId, modelId }) =>
      workbookId === syWorkbookId && modelIds.has(modelId))).toBe(true);
    expect(ownedConfiguration?.bindings.every(({ faultTreeBasicEvent, bayesianNetworkNode }) =>
      faultTreeBasicEvent.workbookId === syWorkbookId &&
      basicEventIds.has(faultTreeBasicEvent.entityId) &&
      bayesianNetworkNode.workbookId === syWorkbookId)).toBe(true);
    for (const tree of es.eventTrees ?? []) {
      for (const functionalEvent of Object.values(tree.functionalEvents)) {
        expect(functionalEvent.faultTreeTopEvent?.workbookId).toBe(syWorkbookId);
        expect(modelIds.has(functionalEvent.faultTreeTopEvent!.modelId)).toBe(true);
      }
    }

    expect(esq.hclConfigurations).toEqual([]);
    expect(esq.bayesianNetworks).toEqual([]);
    const network = sy.dependencyBayesianNetworks[0]!;
    expect(validateBayesianNetworkModel(network, {
      evidence: ownedConfiguration!.baseEvidence,
      hclBindings: ownedConfiguration!.bindings,
      workbookId: syWorkbookId,
    }).filter(({ severity }) => severity === "ERROR")).toEqual([]);

    const risk = reconcileExampleRiskResultReferences(
      es,
      "real-hcl-es-workbook",
      esq,
      esqWorkbookId,
      RadiologicalConsequenceAnalysisSchema.parse(structuredClone(RC_ANALYSIS_HCL)),
      "real-hcl-rc-workbook",
      RiskIntegrationSchema.parse(structuredClone(RI_ANALYSIS_HCL)),
      "real-hcl-ri-workbook",
    );
    const rc = RadiologicalConsequenceAnalysisSchema.parse(risk.radiologicalConsequence);
    const ri = RiskIntegrationSchema.parse(risk.riskIntegration);
    expect(ri.compiledRiskInputs).toHaveLength(3);
    expect(ri.compiledRiskInputs.every((input) =>
      input.eventSequenceFamilyReference?.workbookId === "real-hcl-es-workbook" &&
      input.familyQuantificationReferences?.every((reference) => reference.workbookId === esqWorkbookId) === true &&
      input.consequenceResultReference?.workbookId === "real-hcl-rc-workbook")).toBe(true);
    expect(ri.integratedRiskResults.metrics[0]!.value).toBeCloseTo(2.9402e-4, 12);
    expect(rc.riskIntegrationFeedback?.integratedRiskResultReference?.workbookId).toBe("real-hcl-ri-workbook");
  });
});
