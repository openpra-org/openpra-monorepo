import { LabelJSON } from "../types/Label";
import {
  NestedModel,
  NestedModelJSON,
} from "../types/modelTypes/innerModels/nestedModel";
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
import AuthService from "./AuthService";

//used constants
const API_ENDPOINT = "/api";
const OPTION_CACHE = "no-cache"; // *default, no-cache, reload, force-cache, only-if-cached
const NESTED_ENDPOINT = `${API_ENDPOINT}/nested-models`;
const INITIATING_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/initiating-events`;
const HEAT_BALANCE_FAULT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/heat-balance-fault-trees`;
const EVENT_SEQUENCE_DIAGRAMS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-diagrams`;
const EVENT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/event-trees`;
const FUNCTIONAL_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/functional-events`;
const FAULT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/fault-trees`;
const BAYESIAN_NETWORKS_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-networks`;
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
const EVENT_SEQUENCE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-analysis`;
const OPERATING_STATE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/operating-state-analysis`;
//const NESTED_MODEL_TYPE_LOCATION = 3;
//const NESTED_MODEL_ID_LOCATION = 4;

//Don't use '' keyword, dynamically passing functions hates it on the frontend

//method to Get past counter value

export async function GetPreviousCounterValue(): Promise<number> {
  return await Get(`${NESTED_ENDPOINT}`).then(
    (response) => response.json() as Promise<number>,
  );
}

//Post methods

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostInitiatingEvent(
  data: NestedModelJSON,
): Promise<NestedModel> {
  //makes child exist
  const returnResponse = await Post(
    `${INITIATING_EVENTS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("initiatingEvents");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostHeatBalanceFaultTree(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("heatBalanceFaultTrees");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostEventSequenceDiagram(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("eventSequenceDiagrams");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostEventTree(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${EVENT_TREES_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("eventTrees");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostFunctionalEvent(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${FUNCTIONAL_EVENTS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("functionalEvents");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostFaultTree(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${FAULT_TREES_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("faultTrees");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostBayesianNetwork(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${BAYESIAN_NETWORKS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("bayesianNetworks");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostMarkovChain(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${MARKOV_CHAINS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("markovChains");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostBayesianEstimation(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${BAYESIAN_ESTIMATION_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("bayesianEstimations");
  return returnResponse;
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @returns a promise with the nested model, containing only those features
 */
export async function PostWeibullAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${WEIBULL_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("weibullAnalysis");
  return returnResponse;
}

// Risk Integration
export async function PostRiskIntegration(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${RISK_INTEGRATION_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("riskIntegration");
  return returnResponse;
}

// Radiological Consequence Analysis
export async function PostRadiologicalConsequenceAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("RadiologicalConsequenceAnalysis");
  return returnResponse;
}

// Mechanistic Source Term
export async function PostMechanisticSourceTerm(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("mechanisticSourceTerms");
  return returnResponse;
}

// Event Sequence Quantification Diagram
export async function PostEventSequenceQuantificationDiagram(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("eventSequenceQuantificationDiagrams");
  return returnResponse;
}

// Data Analysis
export async function PostDataAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${DATA_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("dataAnalysis");
  return returnResponse;
}

// Human Reliability Analysis
export async function PostHumanReliabilityAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("humanReliabilityAnalysis");
  return returnResponse;
}

// Systems Analysis
export async function PostSystemsAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${SYSTEMS_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("systemsAnalysis");
  return returnResponse;
}

// Success Criteria
export async function PostSuccessCriteria(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${SUCCESS_CRITERIA_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel("successCriteria");
  return returnResponse;
}

// Event Sequence Analysis
export async function PostEventSequenceAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel("eventSequenceAnalysis");
  return returnResponse;
}

// Operating State Analysis
export async function PostOperatingStateAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${OPERATING_STATE_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
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

  // Add the nested analysis to the appropriate parent type
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

/**
 * generic Post for all the types of methods
 * @param url - the url we are Posting to
 * @param data - the nested model we are using to Post
 * @returns the nested model promise after Posting
 */
export async function Post(
  url: string,
  data: NestedModelJSON,
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
}

//Get methods

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetInitiatingEvents(id = -1): Promise<NestedModel[]> {
  return Get(`${INITIATING_EVENTS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

export function GetHeatBalanceFaultTrees(id = -1): Promise<NestedModel[]> {
  return Get(`${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetEventSequenceDiagrams(id = -1): Promise<NestedModel[]> {
  return Get(`${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetEventTrees(id = -1): Promise<NestedModel[]> {
  return Get(`${EVENT_TREES_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetFunctionalEvents(id = -1): Promise<NestedModel[]> {
  return Get(`${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetFaultTrees(id = -1): Promise<NestedModel[]> {
  return Get(`${FAULT_TREES_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetBayesianNetworks(id = -1): Promise<NestedModel[]> {
  return Get(`${BAYESIAN_NETWORKS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetMarkovChains(id = -1): Promise<NestedModel[]> {
  return Get(`${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetBayesianEstimations(id = -1): Promise<NestedModel[]> {
  return Get(`${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export function GetWeibullAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

// Risk Integration
export function GetRiskIntegration(id = -1): Promise<NestedModel[]> {
  return Get(`${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Radiological Consequence Analysis
export function GetRadiologicalConsequenceAnalysis(
  id = -1,
): Promise<NestedModel[]> {
  return Get(`${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Mechanistic Source Term
export function GetMechanisticSourceTerm(id = -1): Promise<NestedModel[]> {
  return Get(`${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Event Sequence Quantification Diagram
export function GetEventSequenceQuantificationDiagram(
  id = -1,
): Promise<NestedModel[]> {
  return Get(
    `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`,
  )
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Data Analysis
export function GetDataAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Human Reliability Analysis
export function GetHumanReliabilityAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Systems Analysis
export function GetSystemsAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Success Criteria
export function GetSuccessCriteria(id = -1): Promise<NestedModel[]> {
  return Get(`${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Event Sequence Analysis
export function GetEventSequenceAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// Operating State Analysis
export function GetOperatingStateAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

// /**
//  * Get the current typed model give the url on the webpage
//  * @returns the current nested model the user is on
//  */
// export function GetCurrentTypedModel(): Promise<NestedModel> {
//   //setting up data so Get current model doesn't need any parameters, as it will probably be called frequently
//   const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
//   const currentModelType = splitPath[NESTED_MODEL_TYPE_LOCATION]; // The second part is "internal-events"
//   const modelId = parseInt(splitPath[NESTED_MODEL_ID_LOCATION]);
//   return Get(`${NESTED_ENDPOINT}/${currentModelType}/${modelId}/`)
//     .then((response) => response.json() as Promise<NestedModel>) // Parse the response as JSON
//     .catch((error) => {
//       console.error("Error fetching internal events:", error);
//       throw error; // Re-throw the error to propagate it if needed
//     });
// }

/**
 * generic Get for nested
 * @param url - the url we Get from
 * @returns a promise with a nested model or nested model list
 */
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

//Patch methods

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchBayesianEstimationLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${BAYESIAN_ESTIMATION_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchBayesianNetworkLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${BAYESIAN_NETWORKS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchEventSequenceDiagramLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchEventTreeLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${EVENT_TREES_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchFaultTreeLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${FAULT_TREES_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchHeatBalanceFaultTreeLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchFunctionalEventLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${FUNCTIONAL_EVENTS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchInitiatingEventLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${INITIATING_EVENTS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchMarkovChainLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${MARKOV_CHAINS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export function PatchWeibullAnalysisLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${WEIBULL_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

// Risk Integration
export function PatchRiskIntegrationLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${RISK_INTEGRATION_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

// Radiological Consequence Analysis
export function PatchRadiologicalConsequenceLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

// Mechanistic Source Term
export function PatchMechanisticSourceTermLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

// Event Sequence Quantification Diagram
export function PatchEventSequenceQuantificationDiagramLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

// Data Analysis
export function PatchDataAnalysisLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${DATA_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

// Human Reliability Analysis
export function PatchHumanReliabilityLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

// Systems Analysis
export function PatchSystemsAnalysisLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${SYSTEMS_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

// Success Criteria
export function PatchSuccessCriteriaLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${SUCCESS_CRITERIA_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

// Event Sequence Analysis
export function PatchEventSequenceAnalysisLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

// Operating State Analysis
export function PatchOperatingStateLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(
    `${OPERATING_STATE_ANALYSIS_ENDPOINT}/${id}`,
    JSON.stringify(data),
  ).then((response) => response.json() as Promise<NestedModel>);
}

/**
 * Patches a nested model
 * @param url - the url we grab the data from, passed by the other methods
 * @param data - the partial of a model that at least contains a label and users list
 * @returns the newly Patched model in a promise
 */
export function Patch(url: string, data: unknown): Promise<Response> {
  return fetch(url, {
    method: "PATCH",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
    body: JSON.stringify(data), // body data type must match "Content-Type" header
  });
}

//Delete methods

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteInitiatingEvent(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${INITIATING_EVENTS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "initiatingEvents");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteEventSequenceDiagram(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${EVENT_SEQUENCE_DIAGRAMS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "eventSequenceDiagrams");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteEventTree(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${EVENT_TREES_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "eventTrees");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteFunctionalEvent(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "functionalEvents");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteFaultTree(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${FAULT_TREES_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "faultTrees");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteHeatBalanceFaultTree(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${HEAT_BALANCE_FAULT_TREES_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "heatBalanceFaultTrees");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteBayesianNetwork(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${BAYESIAN_NETWORKS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "bayesianNetworks");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteMarkovChain(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${MARKOV_CHAINS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "markovChains");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteBayesianEstimation(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${BAYESIAN_ESTIMATION_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "bayesianEstimations");
  return response;
}

/**
 * Deletes a model from the endpoint
 * @param id - the id of the model to be Deleted
 * @returns the Deleted model
 */
export async function DeleteWeibullAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${WEIBULL_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "weibullAnalysis");
  return response;
}

// Risk Integration
export async function DeleteRiskIntegration(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "riskIntegration");
  return response;
}

// Radiological Consequence Analysis
export async function DeleteRadiologicalConsequenceAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "radiologicalConsequenceAnalysis");
  return response;
}

// Mechanistic Source Term
export async function DeleteMechanisticSourceTerm(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "mechanisticSourceTerms");
  return response;
}

// Event Sequence Quantification Diagram
export async function DeleteEventSequenceQuantificationDiagram(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "eventSequenceQuantificationDiagrams");
  return response;
}

// Data Analysis
export async function DeleteDataAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "dataAnalysis");
  return response;
}

// Human Reliability Analysis
export async function DeleteHumanReliabilityAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "humanReliabilityAnalysis");
  return response;
}

// Systems Analysis
export async function DeleteSystemsAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "systemsAnalysis");
  return response;
}

// Success Criteria
export async function DeleteSuccessCriteria(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "successCriteria");
  return response;
}

// Event Sequence Analysis
export async function DeleteEventSequenceAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${EVENT_SEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "eventSequenceAnalysis");
  return response;
}

// Operating State Analysis
export async function DeleteOperatingStateAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, "operatingStateAnalysis");
  return response;
}

//Delete for parent ids
/**
 * removes all instanced of the parent ids, and Deleted the models with nothing left
 * @param parentId - parent id to be removed from nested models
 */
export async function RemoveParentIds(parentId = -1): Promise<number> {
  return await Delete(`${NESTED_ENDPOINT}/?modelId=${Number(parentId)}`).then(
    (response) => response.json() as Promise<number>,
  );
}

/**
 * Deletes something from one of the 9 nested models
 * @param url - the url of where we are deleting things from
 * @returns a promise with the Deleted model
 */
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

// /**
//  * Gets the current model id, will not be used later in development
//  */
// export function GetCurrentNestedModelId(): number {
//   const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
//   const modelId = parseInt(splitPath[NESTED_MODEL_ID_LOCATION]);
//   if (modelId) {
//     return modelId;
//   }
//   return -1;
// }

/**
 * decouples nested ids from a parent
 * @param id - the id of the nested model
 * @param type - the type of the nested model
 */
export async function RemoveNestedIds(id: number, type: string): Promise<void> {
  const modelId = GetCurrentModelId();
  const body = {
    nestedId: id,
    nestedType: type,
  };
  const currentModelType = GetCurrentModelType();

  // Delete the nested analysis from the appropriate parent type
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
