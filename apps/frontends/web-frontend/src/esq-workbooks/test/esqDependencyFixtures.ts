import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqBayesianNetwork, EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { HclEvidenceScenario } from "interfaces-mef-types/modeling";
import type { EsqWorkbookRuntime } from "../esqWorkbookContext";
import { withModelImported } from "../esqModel";
import { TEST_ID, testBayesianNetworkModel } from "../../newly-developed-methods/bayesian-network/test/bayesianNetworkTestModel";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-11-15T12:00:00.000Z";

const ESQ_ID = "esq-1";

const SY_ID = "sy-1";

const CONFIGURATION_ID = "30000000-0000-4000-8000-000000000001";

const SCENARIO_LOW = "30000000-0000-4000-8000-000000000011";

const SCENARIO_HIGH = "30000000-0000-4000-8000-000000000012";

const SAVED: EsqWorkbookRuntime = { workbookId: ESQ_ID, projectId: "p-1", revision: 5, saveStatus: "saved" };

function testNetwork(): EsqBayesianNetwork {
  return testBayesianNetworkModel();
}

function dependencyScenarios(): HclEvidenceScenario[] {
  return [
    { id: SCENARIO_LOW, code: "LOW", name: "Low demand", enabled: true, evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aFalse }] } },
    { id: SCENARIO_HIGH, code: "HIGH", name: "High demand", enabled: true, evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] } },
  ];
}

function dependencyConfiguration(patch: Partial<EsqHclConfiguration> = {}): EsqHclConfiguration {
  return {
    modelId: CONFIGURATION_ID,
    code: "DEP-1",
    name: "Test network bindings",
    description: "",
    bayesianNetwork: { workbookId: ESQ_ID, modelId: TEST_ID.model },
    faultTrees: [{ workbookId: SY_ID, modelId: "M-COOL" }, { workbookId: SY_ID, modelId: "M-SUP" }],
    bindings: [],
    baseEvidence: { observations: [] },
    evidenceScenarios: [],
    solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
    ...patch,
  };
}

function dependencyEsq(configurations: EsqHclConfiguration[] = [dependencyConfiguration()], networks: EsqBayesianNetwork[] = [testNetwork()]): EventSequenceQuantification {
  return { ...withModelImported(linkedEsq(), modelUpstream()), bayesianNetworks: networks, hclConfigurations: configurations };
}

export {
  CONFIGURATION_ID,
  ESQ_ID,
  NOW,
  SAVED,
  SCENARIO_HIGH,
  SCENARIO_LOW,
  SY_ID,
  dependencyConfiguration,
  dependencyEsq,
  dependencyScenarios,
  testNetwork,
};
