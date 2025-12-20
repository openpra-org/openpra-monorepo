import { LabelJSON } from 'shared-types/src/lib/types/Label';
import {
  NestedModel,
  NestedModelJSON,
} from 'shared-types/src/lib/types/modelTypes/innerModels/nestedModel';
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
} from './TypedModelApiManager';
import { AuthService } from './AuthService';

// used constants
/** Base API prefix for all endpoints. */
export const API_ENDPOINT = '/api';
/** Base path for nested model APIs. */
export const NESTED_ENDPOINT = `${API_ENDPOINT}/nested-models`;
/** Endpoint for initiating events nested models. */
export const INITIATING_EVENTS_ENDPOINT = `${NESTED_ENDPOINT}/initiating-events`;
/** Endpoint for event sequence diagrams nested models. */
export const EVENT_SEQUENCE_DIAGRAMS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-diagrams`;
/** Endpoint for event sequence analysis nested models. */
export const EVENT_SEQUENCE_ANALYSIS_ENDPOINT = `${NESTED_ENDPOINT}/event-sequence-analysis`;
/** Endpoint for event trees nested models. */
export const EVENT_TREES_ENDPOINT = `${NESTED_ENDPOINT}/event-trees`;
/** Endpoint for Bayesian networks nested models. */
export const BAYESIAN_NETWORKS_ENDPOINT = `${NESTED_ENDPOINT}/bayesian-networks`;
/** Endpoint for fault trees nested models. */
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
//const NESTED_MODEL_ID_LOCATION = 4;

/**
 * Infer the current nested model type from the browser URL pathname.
 * Example: `/models/\{typedModelType\}/\{id\}/\{nestedModelType\}` → returns the nestedModelType segment.
 * @returns Current nested model type segment from the path.
 */
export function GetCurrentNestedModelType(): string {
  const splitPath = window.location.pathname.split('/');
  return splitPath[NESTED_MODEL_TYPE_LOCATION];
}

const OPTION_CACHE = 'no-cache'; // *default, no-cache, reload, force-cache, only-if-cached

import {
  DeleteInitiatingEvent,
  GetInitiatingEvents,
  PostInitiatingEvent,
  PatchInitiatingEventLabel,
} from './NestedModelsAPI/InitiatingEventsApiManager';

import {
  DeleteEventSequenceDiagram,
  GetEventSequenceDiagrams,
  PostEventSequenceDiagram,
  PatchEventSequenceDiagramLabel,
} from './NestedModelsAPI/EventSequenceDiagramsApiManager';

import {
  DeleteEventSequenceAnalysis,
  GetEventSequenceAnalysis,
  PostEventSequenceAnalysis,
  PatchEventSequenceAnalysisLabel,
} from './NestedModelsAPI/EventSequenceAnalysisApiManager';

import {
  DeleteEventTree,
  GetEventTrees,
  PostEventTree,
  PatchEventTreeLabel,
} from './NestedModelsAPI/EventTreesApiManager';

import {
  DeleteBayesianNetwork,
  GetBayesianNetworks,
  PostBayesianNetwork,
  PatchBayesianNetworkLabel,
} from './NestedModelsAPI/BayesianNetworksApiManager';

import {
  DeleteFaultTree,
  GetFaultTrees,
  PostFaultTree,
  PatchFaultTreeLabel,
} from './NestedModelsAPI/FaultTreesApiManager';

// Get Methods
export {
  GetEventSequenceDiagrams,
  GetInitiatingEvents,
  GetEventSequenceAnalysis,
  GetEventTrees,
  GetBayesianNetworks,
  GetFaultTrees,
};

// Post Methods
export {
  PostEventSequenceDiagram,
  PostInitiatingEvent,
  PostEventSequenceAnalysis,
  PostEventTree,
  PostBayesianNetwork,
  PostFaultTree,
};

// Patch Methods
export {
  PatchEventSequenceDiagramLabel,
  PatchInitiatingEventLabel,
  PatchEventSequenceAnalysisLabel,
  PatchEventTreeLabel,
  PatchBayesianNetworkLabel,
  PatchFaultTreeLabel,
};

// Delete Methods
export {
  DeleteEventSequenceDiagram,
  DeleteInitiatingEvent,
  DeleteEventSequenceAnalysis,
  DeleteEventTree,
  DeleteBayesianNetwork,
  DeleteFaultTree,
};

//Don't use '' keyword, dynamically passing functions hates it on the frontend

/**
 * Retrieve the previous counter value used for nested model identifiers.
 * @returns Numeric counter value from the backend.
 */
export async function GetPreviousCounterValue(): Promise<number> {
  return await Get(NESTED_ENDPOINT).then(
    (response) => response.json() as Promise<number>,
  );
}

//Post methods
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
  await AddNestedModelToTypedModel('faultTrees');
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
  await AddNestedModelToTypedModel('functionalEvents');
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
  await AddNestedModelToTypedModel('markovChains');
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
  await AddNestedModelToTypedModel('bayesianEstimations');
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
  await AddNestedModelToTypedModel('weibullAnalysis');
  return returnResponse;
}

// Risk Integration
/**
 * Create a Risk Integration nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostRiskIntegration(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${RISK_INTEGRATION_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel('riskIntegration');
  return returnResponse;
}

// Radiological Consequence Analysis
/**
 * Create a Radiological Consequence Analysis nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostRadiologicalConsequenceAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel('RadiologicalConsequenceAnalysis');
  return returnResponse;
}

// Mechanistic Source Term
/**
 * Create a Mechanistic Source Term nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostMechanisticSourceTerm(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel('mechanisticSourceTerms');
  return returnResponse;
}

// Event Sequence Quantification Diagram
/**
 * Create an Event Sequence Quantification Diagram nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostEventSequenceQuantificationDiagram(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel('eventSequenceQuantificationDiagrams');
  return returnResponse;
}

// Data Analysis
/**
 * Create a Data Analysis nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostDataAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${DATA_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel('dataAnalysis');
  return returnResponse;
}

// Human Reliability Analysis
/**
 * Create a Human Reliability Analysis nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostHumanReliabilityAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel('humanReliabilityAnalysis');
  return returnResponse;
}

// Systems Analysis
/**
 * Create a Systems Analysis nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostSystemsAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${SYSTEMS_ANALYSIS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel('systemsAnalysis');
  return returnResponse;
}

// Success Criteria
/**
 * Create a Success Criteria nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostSuccessCriteria(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(`${SUCCESS_CRITERIA_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<NestedModel>,
  );
  await AddNestedModelToTypedModel('successCriteria');
  return returnResponse;
}

// Operating State Analysis
/**
 * Create an Operating State Analysis nested model and link it to the current typed model.
 *
 * @param data - Nested model payload containing label and parent id
 * @returns Promise resolving to the created nested model
 */
export async function PostOperatingStateAnalysis(
  data: NestedModelJSON,
): Promise<NestedModel> {
  const returnResponse = await Post(
    `${OPERATING_STATE_ANALYSIS_ENDPOINT}/`,
    data,
  ).then((response) => response.json() as Promise<NestedModel>);
  await AddNestedModelToTypedModel('operatingStateAnalysis');
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
  if (currentModelType === 'internal-events') {
    await AddNestedToInternalEvent(body);
  } else if (currentModelType === 'internal-hazards') {
    await AddNestedToInternalHazard(body);
  } else if (currentModelType === 'external-hazards') {
    await AddNestedToExternalHazard(body);
  } else if (currentModelType === 'full-scope') {
    await AddNestedToFullScope(body);
  }
}

/**
 * generic Post for all the types of methods
 * @param url - the url we are Posting to
 * @param data - the nested model we are using to Post
 * @param typedModel - the typed model to be updated
 * @returns the nested model promise after Posting
 */
export async function Post(
  url: string,
  data: NestedModelJSON,
  typedModel = '',
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    cache: OPTION_CACHE,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
    body: JSON.stringify({ data, typedModel }), // body data type must match "Content-Type" header
  });
}

//Get methods
/**
 * Get Heat Balance Fault Trees for a given parent typed model id.
 * @param id - Parent typed model identifier (defaults to -1 to fetch empty/none).
 * @returns Promise resolving to a list of nested models.
 */
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

/**
 * Get Risk Integration analyses for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetRiskIntegration(id = -1): Promise<NestedModel[]> {
  return Get(`${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Radiological Consequence Analysis models for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetRadiologicalConsequenceAnalysis(
  id = -1,
): Promise<NestedModel[]> {
  return Get(`${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Mechanistic Source Term analyses for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetMechanisticSourceTerm(id = -1): Promise<NestedModel[]> {
  return Get(`${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Event Sequence Quantification Diagrams for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
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

/**
 * Get Data Analysis models for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetDataAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Human Reliability Analysis models for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetHumanReliabilityAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Systems Analysis models for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetSystemsAnalysis(id = -1): Promise<NestedModel[]> {
  return Get(`${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Success Criteria models for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
export function GetSuccessCriteria(id = -1): Promise<NestedModel[]> {
  return Get(`${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<NestedModel[]>)
    .catch((error) => {
      throw error;
    });
}

/**
 * Get Operating State Analysis models for a given parent typed model id.
 * @param id - Parent typed model identifier.
 * @returns Promise resolving to a list of nested models.
 */
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
    method: 'GET',
    cache: OPTION_CACHE,
    headers: {
      'Content-Type': 'application/json',
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

/**
 * Update the label for a Risk Integration nested model.
 *
 * @param id - The id of the Risk Integration model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
// Risk Integration
export function PatchRiskIntegrationLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${RISK_INTEGRATION_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * Update the label for a Radiological Consequence Analysis nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
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

/**
 * Update the label for a Mechanistic Source Term nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
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

/**
 * Update the label for an Event Sequence Quantification Diagram nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
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

/**
 * Update the label for a Data Analysis nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
// Data Analysis
export function PatchDataAnalysisLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${DATA_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * Update the label for a Human Reliability Analysis nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
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

/**
 * Update the label for a Systems Analysis nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
// Systems Analysis
export function PatchSystemsAnalysisLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${SYSTEMS_ANALYSIS_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * Update the label for a Success Criteria nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
// Success Criteria
export function PatchSuccessCriteriaLabel(
  id: number,
  data: LabelJSON,
): Promise<NestedModel> {
  return Patch(`${SUCCESS_CRITERIA_ENDPOINT}/${id}`, JSON.stringify(data)).then(
    (response) => response.json() as Promise<NestedModel>,
  );
}

/**
 * Update the label for an Operating State Analysis nested model.
 *
 * @param id - The id of the model to update
 * @param data - Label payload with name and optional description
 * @returns A promise resolving to the updated nested model
 */
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
    method: 'PATCH',
    cache: OPTION_CACHE,
    headers: {
      'Content-Type': 'application/json',
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
export async function DeleteFunctionalEvent(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${FUNCTIONAL_EVENTS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'functionalEvents');
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
  await RemoveNestedIds(id, 'faultTrees');
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
  await RemoveNestedIds(id, 'markovChains');
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
  await RemoveNestedIds(id, 'bayesianEstimations');
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
  await RemoveNestedIds(id, 'weibullAnalysis');
  return response;
}

// Risk Integration
/**
 * Delete a Risk Integration nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteRiskIntegration(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${RISK_INTEGRATION_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'riskIntegration');
  return response;
}

// Radiological Consequence Analysis
/**
 * Delete a Radiological Consequence Analysis nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteRadiologicalConsequenceAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${RADIOLOGICAL_CONSEQUENCE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'radiologicalConsequenceAnalysis');
  return response;
}

// Mechanistic Source Term
/**
 * Delete a Mechanistic Source Term nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteMechanisticSourceTerm(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${MECHANISTIC_SOURCE_TERM_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'mechanisticSourceTerms');
  return response;
}

// Event Sequence Quantification Diagram
/**
 * Delete an Event Sequence Quantification Diagram nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteEventSequenceQuantificationDiagram(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${EVENT_SEQUENCE_QUANTIFICATION_DIAGRAM_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'eventSequenceQuantificationDiagrams');
  return response;
}

// Data Analysis
/**
 * Delete a Data Analysis nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteDataAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${DATA_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'dataAnalysis');
  return response;
}

// Human Reliability Analysis
/**
 * Delete a Human Reliability Analysis nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteHumanReliabilityAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${HUMAN_RELIABILITY_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'humanReliabilityAnalysis');
  return response;
}

// Systems Analysis
/**
 * Delete a Systems Analysis nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteSystemsAnalysis(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${SYSTEMS_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'systemsAnalysis');
  return response;
}

// Success Criteria
/**
 * Delete a Success Criteria nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteSuccessCriteria(id = -1): Promise<NestedModel> {
  const response = await Delete(
    `${SUCCESS_CRITERIA_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'successCriteria');
  return response;
}

// Operating State Analysis
/**
 * Delete an Operating State Analysis nested model by id and unlink it from its parent typed model.
 *
 * @param id - Nested model identifier to delete
 * @returns Promise resolving to the deleted nested model
 */
export async function DeleteOperatingStateAnalysis(
  id = -1,
): Promise<NestedModel> {
  const response = await Delete(
    `${OPERATING_STATE_ANALYSIS_ENDPOINT}/?id=${Number(id)}`,
  ).then((response) => response.json() as Promise<NestedModel>);
  await RemoveNestedIds(id, 'operatingStateAnalysis');
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
    method: 'Delete',
    cache: OPTION_CACHE,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
  });
}

/**
 * decouples nested ids from a parent
 * @param id - the id of the nested model
 * @param type - the type of the nested model
 */
export async function RemoveNestedIds(
  id: number | string,
  type: string,
): Promise<void> {
  const modelId = GetCurrentModelId();
  const body = {
    nestedId: id,
    nestedType: type,
  };
  const currentModelType = GetCurrentModelType();

  // Delete the nested analysis from the appropriate parent type
  if (currentModelType === 'internal-events') {
    await DeleteNestedFromInternalEvent(modelId, body);
  } else if (currentModelType === 'internal-hazards') {
    await DeleteNestedFromInternalHazard(modelId, body);
  } else if (currentModelType === 'external-hazards') {
    await DeleteNestedFromExternalHazard(modelId, body);
  } else if (currentModelType === 'full-scope') {
    await DeleteNestedFromFullScope(modelId, body);
  }
}
