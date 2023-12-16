import { InternalEventsModel } from "../types/modelTypes/largeModels/internalEventsModel";
import { InternalHazardsModel } from "../types/modelTypes/largeModels/internalHazardsModel";
import { ExternalHazardsModel } from "../types/modelTypes/largeModels/externalHazardsModel";
import { FullScopeModel } from "../types/modelTypes/largeModels/fullScopeModel";
import TypedModel, {
  TypedModelJSON,
} from "../types/modelTypes/largeModels/typedModel";
import AuthService from "./AuthService";
import ApiManager from "./ApiManager";
import { RemoveParentIds } from "./NestedModelApiManager";
const API_ENDPOINT = "/api";
const OPTION_CACHE = "no-cache"; // *default, no-cache, reload, force-cache, only-if-cached
const TYPED_ENDPOINT = `${API_ENDPOINT}/typed-models`;
const DELETE_NESTED_END = "/delete-nested";
const INTERNAL_EVENTS_ENDPOINT = `${TYPED_ENDPOINT}/internal-events`;
const EXTERNAL_HAZARDS_ENDPOINT = `${TYPED_ENDPOINT}/external-hazards`;
const INTERNAL_HAZARDS_ENDPOINT = `${TYPED_ENDPOINT}/internal-hazards`;
const FULL_SCOPE_ENDPOINT = `${TYPED_ENDPOINT}/full-scope`;
const TYPED_MODEL_TYPE_LOCATION = 1;
const TYPED_MODEL_ID_LOCATION = 2;

/**
 * gets a list of internal events based on a users id
 * @param id - the id of the user whose events we want to load
 * @returns a promise with an internal event list
 */
export function GetInternalEvents(id = -1): Promise<InternalEventsModel[]> {
  return Get(`${INTERNAL_EVENTS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<InternalEventsModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * gets a list of external hazards based on a users id
 * @param id - the id of the user whose events we want to load
 * @returns a promise with an external hazards list
 */
export function GetExternalHazards(id = -1): Promise<ExternalHazardsModel[]> {
  return Get(`${EXTERNAL_HAZARDS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<ExternalHazardsModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * gets a list of internal hazards based on a users id
 * @param id - the id of the user whose models we want to load
 * @returns a promise with an internal hazards list
 */
export function GetInternalHazards(id = -1): Promise<InternalHazardsModel[]> {
  return Get(`${INTERNAL_HAZARDS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<InternalEventsModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * gets a list of full scope based on a users id
 * @param id - the id of the user whose models we want to load
 * @returns a promise with a full scope list
 */
export function GetFullScopeModels(id = -1): Promise<FullScopeModel[]> {
  return Get(`${FULL_SCOPE_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<FullScopeModel[]>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

//singular get current

/**
 *   takes in nothing and gives the current model the user is on based on their page
 * useful for getting data, or possibly using  to add things to later down the line
 * @returns the model the user is currently viewing
 */
export function GetCurrentTypedModel(): Promise<TypedModel> {
  //setting up data so get current model doesn't need unknown parameters, as it will probably be called frequently
  const userId = ApiManager.getCurrentUser().user_id;
  const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character
  const currentModelType = splitPath[TYPED_MODEL_TYPE_LOCATION]; // The second part is "internal-events"
  const modelId = parseInt(splitPath[TYPED_MODEL_ID_LOCATION]);
  return Get(
    `${TYPED_ENDPOINT}/${currentModelType}/${modelId}/?userId=${Number(
      userId,
    )}`,
  )
    .then((response) => response.json() as Promise<TypedModel>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

export function GetCurrentModelId(): number {
  //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
  const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character // The second part is "internal-events"
  return parseInt(splitPath[TYPED_MODEL_ID_LOCATION]);
}

export function GetCurrentModelType(): string {
  //setting up data so get current model doesn't need any parameters, as it will probably be called frequently
  const splitPath = window.location.pathname.split("/"); // Gets the path part of the URL (/internal-events/2) // Splits the path into segments using the '/' character // The second part is "internal-events"
  return splitPath[TYPED_MODEL_TYPE_LOCATION];
}

/**
 * gets a list of internal events based on a users id
 * @param url - the url where we are grabbing a data list from
 * @returns a promise with a list of a type of models
 */
export function Get(url: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
  });
}

//post Methods

/**
 *  is the method that posts a new internal event
 * @param data - the new internal Event Model
 * @returns a promise with a typed model
 */
export function PostInternalEvent(
  data: Partial<TypedModelJSON>,
): Promise<TypedModel> {
  return Post(`${INTERNAL_EVENTS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<TypedModel>,
  );
}

/**
 *  is the method that posts a new internal hazard
 * @param data - the new internal hazard
 * @returns a promise with a typed model
 */
export function PostInternalHazard(
  data: Partial<TypedModelJSON>,
): Promise<TypedModel> {
  return Post(`${INTERNAL_HAZARDS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<TypedModel>,
  );
}

/**
 *  posts a new external hazard
 * @param data - the new external hazard model
 * @returns a promise with a typed model
 */
export function PostExternalHazard(
  data: Partial<TypedModelJSON>,
): Promise<TypedModel> {
  return Post(`${EXTERNAL_HAZARDS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<TypedModel>,
  );
}

/**
 *  is the method that posts a new full scope
 * @param data - the new full scope model
 * @returns a promise with a typed model
 */
export function PostFullScope(
  data: Partial<TypedModelJSON>,
): Promise<TypedModel> {
  return Post(`${FULL_SCOPE_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<TypedModel>,
  );
}

/**
 *  is the method that posts one of the model types
 * @param url - the endpoint we are going to
 * @param data - the new model
 * @returns a promise with the response from the backend
 */
export function Post(
  url: string,
  data: Partial<TypedModelJSON>,
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

//patch methods

/**
 * Patches an internal event by updating its users list, and label
 * @param modelId - the model id of the model to be patched
 * @param userId - the id of the user who is patching the model
 * @param data - the partial of an internal events model that at least contains a label and users list
 * @returns the newly patched model in a promise
 */
export function PatchInternalEvent(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<InternalEventsModel> {
  return Patch(
    `${INTERNAL_EVENTS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`,
    data,
  ).then((response) => response.json() as Promise<InternalEventsModel>);
}

/**
 * Patches an external hazard by updating its users list, and label
 * @param modelId - the model id of the model to be patched
 * @param userId - the id of the user who is patching the model
 * @param data - the partial of an external hazards model that at least contains a label and users list
 * @returns the newly patched model in a promise
 */
export function PatchExternalHazard(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<ExternalHazardsModel> {
  return Patch(
    `${EXTERNAL_HAZARDS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`,
    data,
  ).then((response) => response.json() as Promise<ExternalHazardsModel>);
}

/**
 * Patches an internal hazard by updating its users list, and label
 * @param modelId - the model id of the model to be patched
 * @param userId - the id of the user who is patching the model
 * @param data - the partial of an internal hazards model that at least contains a label and users list
 * @returns the newly patched model in a promise
 */
export function PatchInternalHazard(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<InternalHazardsModel> {
  return Patch(
    `${INTERNAL_HAZARDS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`,
    data,
  ).then((response) => response.json() as Promise<InternalHazardsModel>);
}

/**
 * Patches a full scope by updating its users list, and label
 * @param modelId - the model id of the model to be patched
 * @param userId - the id of the user who is patching the model
 * @param data - the partial of a full scope model that at least contains a label and users list
 * @returns the newly patched model in a promise
 */
export function PatchFullScope(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<FullScopeModel> {
  return Patch(
    `${FULL_SCOPE_ENDPOINT}/${modelId}/?userId=${Number(userId)}`,
    data,
  ).then((response) => response.json() as Promise<FullScopeModel>);
}

/**
 * Patches a typed model, is generic and used by other things in this file only
 * @param url - the url we grab the data from, passed by the other methods
 * @param data - the partial of a model, or a collection of data for a nested model, or a collection of data from a nested model and a parent id.
 * @returns the newly patched model in a promise
 */
function Patch(
  url: string,
  data:
    | Partial<TypedModelJSON>
    | { nestedId: number; nestedType: string }
    | { modelId: number; nestedId: number; nestedType: string },
): Promise<Response> {
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

//delete methods

/**
 * deletes an internal event with a given model id
 * @param id - id of model
 * @returns a promise with the deleted internal event
 */
export async function DeleteInternalEvent(
  id = -1,
): Promise<InternalEventsModel> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(
    `${INTERNAL_EVENTS_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(
      userId,
    )}`,
  )
    .then((response) => response.json() as Promise<InternalEventsModel>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * deletes an external hazard with a given model id
 * @param id - id of model
 * @returns a promise with the deleted external hazard
 */
export async function DeleteExternalHazard(
  id = -1,
): Promise<ExternalHazardsModel> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(
    `${EXTERNAL_HAZARDS_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(
      userId,
    )}`,
  )
    .then((response) => response.json() as Promise<ExternalHazardsModel>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * deletes an internal hazard with a given model id
 * @param id - id of model
 * @returns a promise with the deleted internal hazard
 */
export async function DeleteInternalHazard(
  id = -1,
): Promise<InternalHazardsModel> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(
    `${INTERNAL_HAZARDS_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(
      userId,
    )}`,
  )
    .then((response) => response.json() as Promise<InternalHazardsModel>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * deletes a full scope with a given model id
 * @param id - id of model
 * @returns a promise with the deleted full scope
 */
export async function DeleteFullScope(id = -1): Promise<FullScopeModel> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(
    `${FULL_SCOPE_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(userId)}`,
  )
    .then((response) => response.json() as Promise<FullScopeModel>) // Parse the response as JSON
    .catch((error) => {
      throw error; // Re-throw the error to propagate it if needed
    });
}

/**
 * deletes something, one fo the 4 model types
 * @param url - the url of where we are deleting things from
 * @returns a promise with the deleted model
 */
export function DeleteCall(url: string): Promise<Response> {
  return fetch(url, {
    method: "DELETE",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
  });
}

/**
 * puts the nested model's id at the appropriate endpoint
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function AddNestedToInternalEvent(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<InternalEventsModel> {
  return Patch(`${INTERNAL_EVENTS_ENDPOINT}`, body).then(
    (response) => response.json() as Promise<InternalEventsModel>,
  );
}

/**
 * puts the nested model's id at the appropriate endpoint
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function AddNestedToInternalHazard(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<InternalHazardsModel> {
  return Patch(`${INTERNAL_HAZARDS_ENDPOINT}`, body).then(
    (response) => response.json() as Promise<InternalHazardsModel>,
  );
}

/**
 * puts the nested model's id at the appropriate endpoint
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function AddNestedToExternalHazard(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<ExternalHazardsModel> {
  return Patch(`${EXTERNAL_HAZARDS_ENDPOINT}`, body).then(
    (response) => response.json() as Promise<ExternalHazardsModel>,
  );
}

/**
 * puts the nested model's id at the appropriate endpoint
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function AddNestedToFullScope(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<FullScopeModel> {
  return Patch(`${FULL_SCOPE_ENDPOINT}`, body).then(
    (response) => response.json() as Promise<FullScopeModel>,
  );
}

//deleting nested models

/**
 * removes the nested model's id at the appropriate endpoint
 * @param modelId -  the id of the typed model
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function DeleteNestedFromInternalEvent(
  modelId: number,
  body: { nestedId: number; nestedType: string },
): Promise<InternalEventsModel> {
  return Patch(
    `${INTERNAL_EVENTS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`,
    body,
  ).then((response) => response.json() as Promise<InternalEventsModel>);
}

/**
 * removes the nested model's id at the appropriate endpoint
 * @param modelId -  the id of the typed model
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function DeleteNestedFromInternalHazard(
  modelId: number,
  body: { nestedId: number; nestedType: string },
): Promise<InternalHazardsModel> {
  return Patch(
    `${INTERNAL_HAZARDS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`,
    body,
  ).then((response) => response.json() as Promise<InternalHazardsModel>);
}

/**
 * removes the nested model's id at the appropriate endpoint
 * @param modelId -  the id of the typed model
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @returns a promise with the updated model
 */
export function DeleteNestedFromExternalHazard(
  modelId: number,
  body: { nestedId: number; nestedType: string },
): Promise<ExternalHazardsModel> {
  return Patch(
    `${EXTERNAL_HAZARDS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`,
    body,
  ).then((response) => response.json() as Promise<ExternalHazardsModel>);
}

/**
 * removes the nested model's id at the appropriate endpoint
 * @param body - contains a model id number, a nested id number, and a nested type that is a string of the camel case of the nested model type
 * @param modelId - the id of the typed model
 * @returns a promise with the updated model
 */
export function DeleteNestedFromFullScope(
  modelId: number,
  body: { nestedId: number; nestedType: string },
): Promise<FullScopeModel> {
  return Patch(
    `${FULL_SCOPE_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`,
    body,
  ).then((response) => response.json() as Promise<FullScopeModel>);
}
