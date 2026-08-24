import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { EventSequenceQuantificationSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { ES_ANALYSIS } from "../seeds/es-seed";
import { ES_ANALYSIS_HTGR } from "../seeds/es-seed-htgr";
import { ESQ_ANALYSIS } from "../seeds/esq-seed";
import { ESQ_ANALYSIS_HTGR } from "../seeds/esq-seed-htgr";
import { SY_ANALYSIS } from "../seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../seeds/sy-seed-htgr";
import {
  EXAMPLE_DEPENDENCY_IDS,
  reconcileExampleEsqDependencyReferences,
  reconcileExampleEventTreeDependencyReferences,
} from "../seeds/dependency-model-seed";

const variants = [
  { name: "SFR", esq: ESQ_ANALYSIS, es: ES_ANALYSIS, sy: SY_ANALYSIS },
  { name: "HTGR", esq: ESQ_ANALYSIS_HTGR, es: ES_ANALYSIS_HTGR, sy: SY_ANALYSIS_HTGR },
] as const;

describe("dependency example models", () => {
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
});
