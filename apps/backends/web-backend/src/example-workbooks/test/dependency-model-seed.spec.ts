import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { RadiologicalConsequenceAnalysisSchema } from "interfaces-mef-types/zod/rc/radiological-consequence-analysis";
import { RiskIntegrationSchema } from "interfaces-mef-types/zod/ri/risk-integration";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { ES_ANALYSIS } from "../seeds/es-seed";
import { ES_ANALYSIS_HTGR } from "../seeds/es-seed-htgr";
import { ESQ_ANALYSIS } from "../seeds/esq-seed";
import { ESQ_ANALYSIS_HTGR } from "../seeds/esq-seed-htgr";
import { SY_ANALYSIS } from "../seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";
import { DA_ANALYSIS } from "../seeds/da-seed";
import { DA_ANALYSIS_HTGR } from "../seeds/da-seed-htgr";
import { HR_ANALYSIS } from "../seeds/hr-seed";
import { HR_ANALYSIS_HTGR } from "../seeds/hr-seed-htgr";
import { RC_ANALYSIS } from "../seeds/rc-seed";
import { RC_ANALYSIS_HTGR } from "../seeds/rc-seed-htgr";
import { RI_ANALYSIS } from "../seeds/ri-seed";
import { RI_ANALYSIS_HTGR } from "../seeds/ri-seed-htgr";
import {
  EXAMPLE_DEPENDENCY_IDS,
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
  reconcileExampleSyDataAnalysisReferences,
  reconcileExampleSyHumanReliabilityReferences,
  reconcileExampleSyDependencyOwnership,
  reconcileExampleRiskResultReferences,
} from "../seeds/dependency-model-seed";

const variants = [
  { name: "SFR", esq: ESQ_ANALYSIS, es: ES_ANALYSIS, sy: SY_ANALYSIS, da: DA_ANALYSIS, hr: HR_ANALYSIS, rc: RC_ANALYSIS, ri: RI_ANALYSIS },
  { name: "HTGR", esq: ESQ_ANALYSIS_HTGR, es: ES_ANALYSIS_HTGR, sy: SY_ANALYSIS_HTGR, da: DA_ANALYSIS_HTGR, hr: HR_ANALYSIS_HTGR, rc: RC_ANALYSIS_HTGR, ri: RI_ANALYSIS_HTGR },
] as const;

describe("dependency example models", () => {
  it.each(variants)("makes the dependency BN editable from SY, ES, and HRA in $name", ({ sy, es, hr }) => {
    const networks = [
      sy.dependencyBayesianNetworks?.[0],
      es.dependencyModels?.bayesianNetworks?.[0],
      hr.dependencyBayesianNetworks?.[0],
    ];
    expect(networks.every((network) => network !== undefined)).toBe(true);
    for (const network of networks) {
      expect(network?.modelId).toBe(EXAMPLE_DEPENDENCY_IDS.network);
      expect(validateBayesianNetworkModel(network!, { evidence: { observations: [] } })
        .filter(({ severity }) => severity === "ERROR")).toEqual([]);
    }
  });

  it.each(variants)("links every quantified human-error event in $name to its HRA HFE and primary HEP", ({ sy, da, hr }) => {
    const reconciled = SystemsAnalysisSchema.parse(reconcileExampleSyHumanReliabilityReferences(
      reconcileExampleSyDataAnalysisReferences(
        SystemsAnalysisSchema.parse(structuredClone(sy)),
        da,
        "real-da-workbook",
      ),
      hr,
      "real-hr-workbook",
    ));
    const humanEvents = reconciled.systemBasicEvents.filter((event) => event.failureMode === "HUMAN_ERROR");
    expect(humanEvents.length).toBeGreaterThan(0);
    expect(humanEvents.every((event) => {
      const source = event.controlledDataSource;
      if (source?.referenceType !== "HUMAN_FAILURE_EVENT") return false;
      const quantification = hr.hepQuantifications.find((entry) => entry.uuid === source.quantificationId);
      return source.workbookId === "real-hr-workbook" &&
        quantification?.hfeId === source.entityId &&
        (quantification.meanHep ?? quantification.pointEstimateHep) === event.probability;
    })).toBe(true);
    expect(reconciled.humanFailureEventIntegrations.every((integration) =>
      integration.hfeSource?.referenceType === "HUMAN_FAILURE_EVENT" &&
      integration.hfeSource.workbookId === "real-hr-workbook" &&
      integration.hfeSource.entityId === integration.hfeReference)).toBe(true);
  });

  it.each(variants)("provides a valid, quantifiable BN and linked HCL model for $name", ({ esq, sy }) => {
    const source = EventSequenceQuantificationSchema.parse(JSON.parse(JSON.stringify(esq)));
    const reconciled = reconcileExampleEsqDependencyReferences(
      source,
      "real-esq-workbook",
      sy,
      "real-sy-workbook",
    );
    const parsed = EventSequenceQuantificationSchema.parse(reconciled);
    const network = parsed.bayesianNetworks.find(({ modelId }) => modelId === EXAMPLE_DEPENDENCY_IDS.network);
    const configuration = parsed.hclConfigurations.find(
      ({ modelId }) => modelId === EXAMPLE_DEPENDENCY_IDS.hclConfiguration,
    );

    expect(network).toBeDefined();
    expect(configuration).toBeDefined();
    expect(validateBayesianNetworkModel(network!, {
      evidence: configuration!.baseEvidence,
      hclBindings: configuration!.bindings,
      workbookId: "real-esq-workbook",
    }).filter(({ severity }) => severity === "ERROR")).toEqual([]);
    expect(network!.conditionalProbabilityTables).toHaveLength(network!.nodes.length);
    network!.conditionalProbabilityTables.forEach((table) => {
      table.rows.forEach((row) => {
        expect(row.values.reduce((sum, value) => sum + value.probability, 0)).toBeCloseTo(1, 12);
      });
    });

    const rpsTree = sy.systemLogicModels.find(({ systemReference }) => systemReference === "SYS-RPS");
    const expectedBasicEventIds = ["RPS-DVA-FS", "RPS-DVB-FS"].map(
      (code) => sy.systemBasicEvents.find((event) => event.code === code)!.uuid,
    );
    expect(configuration!.bayesianNetwork).toEqual({
      workbookId: "real-esq-workbook",
      modelId: network!.modelId,
    });
    expect(configuration!.faultTrees).toEqual([{
      workbookId: "real-sy-workbook",
      modelId: rpsTree!.uuid,
    }]);
    expect(configuration!.bindings.map((binding) => binding.faultTreeBasicEvent.entityId).sort())
      .toEqual(expectedBasicEventIds.sort());

    const ownedSystems = SystemsAnalysisSchema.parse(reconcileExampleSyDependencyOwnership(
      SystemsAnalysisSchema.parse(structuredClone(sy)),
      "real-sy-workbook",
    ));
    const ownedNetwork = ownedSystems.dependencyBayesianNetworks?.find(
      ({ modelId }) => modelId === EXAMPLE_DEPENDENCY_IDS.network,
    );
    const ownedConfiguration = ownedSystems.dependencyHclConfigurations?.find(
      ({ modelId }) => modelId === EXAMPLE_DEPENDENCY_IDS.hclConfiguration,
    );
    expect(ownedNetwork).toBeDefined();
    expect(ownedConfiguration?.bayesianNetwork).toEqual({
      workbookId: "real-sy-workbook",
      modelId: EXAMPLE_DEPENDENCY_IDS.network,
    });
    expect(ownedConfiguration?.faultTrees).toEqual([{
      workbookId: "real-sy-workbook",
      modelId: rpsTree!.uuid,
    }]);
    expect(ownedConfiguration?.bindings.every((binding) =>
      binding.faultTreeBasicEvent.workbookId === "real-sy-workbook" &&
      binding.bayesianNetworkNode.workbookId === "real-sy-workbook")).toBe(true);
  });

  it.each(variants)("provides an HCL-executable demonstration event tree for $name", ({ es, sy }) => {
    const source = EventSequenceAnalysisSchema.parse(JSON.parse(JSON.stringify(es)));
    const reconciled = reconcileExampleEventTreeDependencyReferences(source, sy, "real-sy-workbook");
    const parsed = EventSequenceAnalysisSchema.parse(reconciled);
    const tree = parsed.eventTrees?.find(({ uuid }) => uuid === EXAMPLE_DEPENDENCY_IDS.eventTree);
    const functionalEvent = tree?.functionalEvents[EXAMPLE_DEPENDENCY_IDS.functionalEvent];
    const rpsTree = sy.systemLogicModels.find(({ systemReference }) => systemReference === "SYS-RPS");

    expect(tree).toBeDefined();
    expect(tree!.sequences).toHaveProperty(EXAMPLE_DEPENDENCY_IDS.successSequence);
    expect(tree!.sequences).toHaveProperty(EXAMPLE_DEPENDENCY_IDS.failureSequence);
    expect(functionalEvent?.faultTreeTopEvent).toEqual({
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: "real-sy-workbook",
      modelId: rpsTree!.uuid,
      entityId: rpsTree!.topGate!.gateId,
    });
  });

  it.each(variants)("links $name end states, family frequencies, consequence results, and integrated risk", ({ es, esq, rc, ri }) => {
    const reconciled = reconcileExampleRiskResultReferences(
      EventSequenceAnalysisSchema.parse(structuredClone(es)),
      "real-es-workbook",
      EventSequenceQuantificationSchema.parse(structuredClone(esq)),
      "real-esq-workbook",
      RadiologicalConsequenceAnalysisSchema.parse(structuredClone(rc)),
      "real-rc-workbook",
      RiskIntegrationSchema.parse(structuredClone(ri)),
      "real-ri-workbook",
    );
    const consequence = RadiologicalConsequenceAnalysisSchema.parse(reconciled.radiologicalConsequence);
    const integration = RiskIntegrationSchema.parse(reconciled.riskIntegration);

    for (const input of integration.compiledRiskInputs) {
      expect(input.eventSequenceFamilyReference).toEqual({
        referenceType: "EVENT_SEQUENCE_FAMILY",
        workbookId: "real-es-workbook",
        entityId: input.eventSequenceFamilyRef,
      });
      const sourceQuantifications = esq.familyQuantifications.filter(
        (entry) => entry.eventSequenceFamilyRef === input.eventSequenceFamilyRef,
      );
      expect(input.familyQuantificationReferences?.map(({ workbookId, entityId }) => ({ workbookId, entityId })))
        .toEqual(sourceQuantifications.map(({ uuid }) => ({ workbookId: "real-esq-workbook", entityId: uuid })));
      expect(input.frequency).toBeCloseTo(sourceQuantifications.reduce(
        (sum, entry) => sum + (typeof entry.meanFrequency === "number" ? entry.meanFrequency : entry.meanFrequency.value),
        0,
      ), 14);
      expect(input.consequenceResultReference?.workbookId).toBe("real-rc-workbook");
    }

    for (const metric of integration.integratedRiskResults.metrics) {
      const expected = integration.compiledRiskInputs.reduce((sum, input) => {
        const result = input.consequences.find((entry) => entry.metric === metric.consequenceMeasureRef);
        return sum + input.frequency * (result?.meanValue ?? 0);
      }, 0);
      expect(metric.value).toBeCloseTo(expected, 14);
    }
    expect(consequence.riskIntegrationFeedback?.integratedRiskResultReference).toEqual({
      referenceType: "INTEGRATED_RISK_RESULT",
      workbookId: "real-ri-workbook",
      entityId: integration.integratedRiskResults.uuid,
    });
  });
});
