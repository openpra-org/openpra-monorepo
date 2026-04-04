import { LabelJSON } from "shared-types/src/lib/types/Label";
import { NestedModel, NestedModelJSON } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import {
  AddNestedToExternalHazard,
  AddNestedToFullScope,
  AddNestedToInternalEvent,
  AddNestedToInternalHazard,
  DeleteNestedFromExternalHazard,
  DeleteNestedFromFullScope,
  DeleteNestedFromInternalEvent,
  DeleteNestedFromInternalHazard,
  GetCurrentModelId,
  GetCurrentModelType,
} from "./TypedModelApiManager";
import { AuthService } from "./AuthService";

export const API_ENDPOINT = "/api";

export const NESTED_ENDPOINT = `${API_ENDPOINT}/nested-models`;

export const INITIATING_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/initiating-events`;

export const EVENT_SEQUENCE_DIAGRAMS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-diagrams`;

export const EVENT_SEQUENCE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-analysis`;

export const EVENT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/event-trees`;

export const BAYESIAN_NETWORKS_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-networks`;

export const FAULT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/fault-trees`;

const HEAT_BALANCE_FAULT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/heat-balance-fault-trees`;
const FUNCTIONAL_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/functional-events`;
const MARKOV_CHAINS_ENDPOINT = `${NESTED_ENDPOINT}/markov-chains`;
const BAYESIAN_ESTIMATION_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-estimations`;
const WEIBULL_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/weibull-analysis`;
const RISK_INTEGRATION_ENDPOINT = `${NESTED_ENDPOINT}/risk-integration`;
const RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/radiological-consequence-analysis`;
const MECHANISTIC_SOURCE_TERM_ENDPOINT = `${NESTED_ENDPOINT}/mechanistic-source-term`;
const EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-quantification-diagram`;
const DATA_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/data-analysis`;
const HUMAN_RELIABILITY_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/human-reliability-analysis`;
const SYSTEMS_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/systems-analysis`;
const SUCCESS_CRITERIA_ENDPOINT = `${NESTED_ENDPOINT}/success-criteria`;
const OPERATING_STATE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/operating-state-analysis`;
const NESTED_MODEL_TYPE_LOCATION = 3;

export function GetCurrentNestedModelType(): string {
  const splitPath = window.location.pathname.split("/");
  return splitPath[NESTED_MODEL_TYPE_LOCATION];
}

const OPTION_CACHE = "no-cache";

import {
  DeleteInitiatingEvent,
  GetInitiatingEvents,
  PostInitiatingEvent,
  PatchInitiatingEventLabel,
} from "./NestedModelsAPI/InitiatingEventsApiManager";

import {
  DeleteEventSequenceDiagram,
  GetEventSequenceDiagrams,
  PostEventSequenceDiagram,
  PatchEventSequenceDiagramLabel,
} from "./NestedModelsAPI/EventSequenceDiagramsApiManager";

import {
  DeleteEventSequenceAnalysis,
  GetEventSequenceAnalysis,
  PostEventSequenceAnalysis,
  PatchEventSequenceAnalysisLabel,
} from "./NestedModelsAPI/EventSequenceAnalysisApiManager";

import {
  DeleteEventTree,
  GetEventTrees,
  PostEventTree,
  PatchEventTreeLabel,
} from "./NestedModelsAPI/EventTreesApiManager";

import {
  DeleteBayesianNetwork,
  GetBayesianNetworks,
  PostBayesianNetwork,
  PatchBayesianNetworkLabel,
} from "./NestedModelsAPI/BayesianNetworksApiManager";

import {
  DeleteFaultTree,
  GetFaultTrees,
  PostFaultTree,
  PatchFaultTreeLabel,
} from "./NestedModelsAPI/FaultTreesApiManager";

import {
  GetComponentParameters,
  PostComponentParameter,
  PatchComponentParameter,
  DeleteComponentParameter,
} from "./NestedModelsAPI/ComponentParameterApiManager";

export type {
  ComponentParameterType,
  CreateComponentParameterBody,
  UpdateComponentParameterBody,
} from "./NestedModelsAPI/ComponentParameterApiManager";

export {
  GetEventSequenceDiagrams,
  GetInitiatingEvents,
  GetEventSequenceAnalysis,
  GetEventTrees,
  GetBayesianNetworks,
  GetFaultTrees,
  GetComponentParameters,
};

export {
  PostEventSequenceDiagram,
  PostInitiatingEvent,
  PostEventSequenceAnalysis,
  PostEventTree,
  PostBayesianNetwork,
  PostFaultTree,
  PostComponentParameter,
};

export {
  PatchEventSequenceDiagramLabel,
  PatchInitiatingEventLabel,
  PatchEventSequenceAnalysisLabel,
  PatchEventTreeLabel,
  PatchBayesianNetworkLabel,
  PatchFaultTreeLabel,
  PatchComponentParameter,
};

export {
  DeleteEventSequenceDiagram,
  DeleteInitiatingEvent,
  DeleteEventSequenceAnalysis,
  DeleteEventTree,
  DeleteBayesianNetwork,
  DeleteFaultTree,
  DeleteComponentParameter,
};

export async function GetPreviousCounterValue(): Promise<number> {
  return await Get(NESTED_ENDPOINT).then((response) => response.json() as Promise<number>);
}

export async function PostHeatBalanceFaultTree(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("faultTrees");
  return returnResponse;
}

export async function PostFunctionalEvent(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${FUNCTIONAL_EVENTS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("functionalEvents");
  return returnResponse;
}

export async function PostMarkovChain(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${MARKOV_CHAINS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("markovChains");
  return returnResponse;
}

export async function PostBayesianEstimation(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${BAYESIAN_ESTIMATION_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("bayesianEstimations");
  return returnResponse;
}

export async function PostWeibullAnalysis(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${WEIBULL_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("weibullAnalysis");
  return returnResponse;
}

export async function PostRiskIntegration(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${RISK_INTEGRATION_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("riskIntegration");
  return returnResponse;
}

export async function PostRadiologicalConsequenceAnalysis(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("RadiologicalConsequenceAnalysis");
  return returnResponse;
}

export async function PostMechanisticSourceTerm(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${MECHANISTIC_SOURCE_TERM_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("mechanisticSourceTerms");
  return returnResponse;
}

export async function PostEventSequenceQuantificationDiagram(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("eventSequenceQuantificationDiagrams");
  return returnResponse;
}

export async function PostDataAnalysis(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${DATA_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("dataAnalysis");
  return returnResponse;
}

export async function PostHumanReliabilityAnalysis(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("humanReliabilityAnalysis");
  return returnResponse;
}

export async function PostSystemsAnalysis(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${SYSTEMS_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("systemsAnalysis");
  return returnResponse;
}

export async function PostSuccessCriteria(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${SUCCESS_CRITERIA_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("successCriteria");
  return returnResponse;
}

export async function PostOperatingStateAnalysis(data: NestedModelJSON): Promise<NestedModel> {
  const returnResponse = await Post(`${OPERATING_STATE_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("operatingStateAnalysis");
  return returnResponse;
}

async function AddNestedModelToTypedModel(type: string): Promise<void> {
  const body = {
    modelId: GetCurrentModelId(),
    nestedId: await GetPreviousCounterValue(),
    nestedType: type,
  };
  const currentModelType = GetCurrentModelType();

  if (currentModelType === "internal-events") {
    await AddNestedToInternalEvent(body);
  } else if (currentModelType === "internal-hazards") {
    await AddNestedToInternalHazard(body);
  } else if (currentModelType === "external-hazards") {
    await AddNestedToExternalHazard(body);
  } else if (currentModelType === "full-scope") {
    await AddNestedToFullScope(body);
  }
}

export async function Post(url: string, data: NestedModelJSON, typedModel = ""): Promise<Response> {
  return fetch(url, {
    method: "POST",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
    body: JSON.stringify({ data, typedModel }),
  });
}

export function GetHeatBalanceFaultTrees(id = -1): Promise<NestedModel[]> {
  return Get(`${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetFunctionalEvents(id = -1): Promise<NestedModel[]> {
  return Get(`${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetMarkovChains(id = -1): Promise<NestedModel[]> {
  return Get(`${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetBayesianEstimations(id = -1): Promise<NestedModel[]> {
  return Get(`${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetWeibullAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetRiskIntegration(id = -1): Promise<NestedModel[]> {
  return Get(`${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetRadiologicalConsequenceAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetMechanisticSourceTerm(id = -1): Promise<NestedModel[]> {
  return Get(`${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetEventSequenceQuantificationDiagram(id = -1): Promise<NestedModel[]> {
  return Get(`${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetDataAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetHumanReliabilityAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetSystemsAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetSuccessCriteria(id = -1): Promise<NestedModel[]> {
  return Get(`${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function GetOperatingStateAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export async function Get(url: string): Promise<Response> {
  return await fetch(url, {
    method: "GET",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
  });
}

export function PatchBayesianEstimationLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${BAYESIAN_ESTIMATION_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchHeatBalanceFaultTreeLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchFunctionalEventLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${FUNCTIONAL_EVENTS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchMarkovChainLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${MARKOV_CHAINS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchWeibullAnalysisLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${WEIBULL_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchRiskIntegrationLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${RISK_INTEGRATION_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchRadiologicalConsequenceLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchMechanisticSourceTermLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${MECHANISTIC_SOURCE_TERM_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchEventSequenceQuantificationDiagramLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchDataAnalysisLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${DATA_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchHumanReliabilityLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchSystemsAnalysisLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${SYSTEMS_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchSuccessCriteriaLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${SUCCESS_CRITERIA_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function PatchOperatingStateLabel(id: number, data: LabelJSON): Promise<NestedModel> {
  return Patch(`${OPERATING_STATE_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

export function Patch(url: string, data: unknown): Promise<Response> {
  return fetch(url, {
    method: "PATCH",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
    body: JSON.stringify(data),
  });
}

export function PostDirect(url: string, data: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
    body: JSON.stringify(data),
  });
}

export async function DeleteFunctionalEvent(id = -1): Promise<NestedModel> {
  const response = await Delete(`${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "functionalEvents");
  return response;
}

export async function DeleteHeatBalanceFaultTree(id = -1): Promise<NestedModel> {
  const response = await Delete(`${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "faultTrees");
  return response;
}

export async function DeleteMarkovChain(id = -1): Promise<NestedModel> {
  const response = await Delete(`${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "markovChains");
  return response;
}

export async function DeleteBayesianEstimation(id = -1): Promise<NestedModel> {
  const response = await Delete(`${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "bayesianEstimations");
  return response;
}

export async function DeleteWeibullAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(`${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "weibullAnalysis");
  return response;
}

export async function DeleteRiskIntegration(id = -1): Promise<NestedModel> {
  const response = await Delete(`${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "riskIntegration");
  return response;
}

export async function DeleteRadiologicalConsequenceAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(`${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "radiologicalConsequenceAnalysis");
  return response;
}

export async function DeleteMechanisticSourceTerm(id = -1): Promise<NestedModel> {
  const response = await Delete(`${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "mechanisticSourceTerms");
  return response;
}

export async function DeleteEventSequenceQuantificationDiagram(id = -1): Promise<NestedModel> {
  const response = await Delete(`${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "eventSequenceQuantificationDiagrams");
  return response;
}

export async function DeleteDataAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(`${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "dataAnalysis");
  return response;
}

export async function DeleteHumanReliabilityAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(`${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "humanReliabilityAnalysis");
  return response;
}

export async function DeleteSystemsAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(`${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "systemsAnalysis");
  return response;
}

export async function DeleteSuccessCriteria(id = -1): Promise<NestedModel> {
  const response = await Delete(`${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "successCriteria");
  return response;
}

export async function DeleteOperatingStateAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(`${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await RemoveNestedIds(id, "operatingStateAnalysis");
  return response;
}

export async function RemoveParentIds(parentId = -1): Promise<number> {
  return await Delete(`${NESTED_ENDPOINT}/?modelId=${Number(parentId)}`).then(
    (response) => response.json() as Promise<number>,
  );
}

export function Delete(url: string): Promise<Response> {
  return fetch(url, {
    method: "Delete",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
  });
}

export async function RemoveNestedIds(id: number | string, type: string): Promise<void> {
  const modelId = GetCurrentModelId();
  const body = {
    nestedId: id,
    nestedType: type,
  };
  const currentModelType = GetCurrentModelType();

  if (currentModelType === "internal-events") {
    await DeleteNestedFromInternalEvent(modelId, body);
  } else if (currentModelType === "internal-hazards") {
    await DeleteNestedFromInternalHazard(modelId, body);
  } else if (currentModelType === "external-hazards") {
    await DeleteNestedFromExternalHazard(modelId, body);
  } else if (currentModelType === "full-scope") {
    await DeleteNestedFromFullScope(modelId, body);
  }
}
