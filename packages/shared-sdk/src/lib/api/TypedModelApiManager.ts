import {
  InternalEventsModelType,
  InternalEventsMetadata,
  InternalEventsModel,
} from "shared-types/src/lib/types/modelTypes/largeModels/internalEventsModel";
import {
  InternalHazardsModel,
  InternalHazardsModelType,
} from "shared-types/src/lib/types/modelTypes/largeModels/internalHazardsModel";
import {
  ExternalHazardsModel,
  ExternalHazardsModelType,
} from "shared-types/src/lib/types/modelTypes/largeModels/externalHazardsModel";
import { FullScopeModel, FullScopeModelType } from "shared-types/src/lib/types/modelTypes/largeModels/fullScopeModel";
import TypedModel, { TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { AuthService } from "./AuthService";
import { ApiManager } from "./ApiManager";
import { RemoveParentIds } from "./NestedModelApiManager";
const API_ENDPOINT = "/api";
const OPTION_CACHE = "no-cache";
const TYPED_ENDPOINT = `${API_ENDPOINT}/typed-models`;
const DELETE_NESTED_END = "/delete-nested";
const INTERNAL_EVENTS_ENDPOINT = `${TYPED_ENDPOINT}/internal-events`;
const EXTERNAL_HAZARDS_ENDPOINT = `${TYPED_ENDPOINT}/external-hazards`;
const INTERNAL_HAZARDS_ENDPOINT = `${TYPED_ENDPOINT}/internal-hazards`;
const FULL_SCOPE_ENDPOINT = `${TYPED_ENDPOINT}/full-scope`;
const TYPED_MODEL_TYPE_LOCATION = 1;
const TYPED_MODEL_ID_LOCATION = 2;
const METADATA_ENDPOINT = `${API_ENDPOINT}/typed-models/metadata`;
const MD_INTERNAL_EVENTS_ENDPOINT = `${METADATA_ENDPOINT}/internal-events`;
export function GetInternalEventsMetadata(id = -1): Promise<InternalEventsMetadata[]> {
  return Get(`${MD_INTERNAL_EVENTS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<InternalEventsMetadata[]>)
    .catch((error) => {
      throw error;
    });
}
export function GetInternalEvents(id = -1): Promise<InternalEventsModelType[]> {
  return Get(`${INTERNAL_EVENTS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<InternalEventsModelType[]>)
    .catch((error) => {
      throw error;
    });
}
export function GetExternalHazards(id = -1): Promise<ExternalHazardsModelType[]> {
  return Get(`${EXTERNAL_HAZARDS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<ExternalHazardsModelType[]>)
    .catch((error) => {
      throw error;
    });
}
export function GetInternalHazards(id = -1): Promise<InternalHazardsModelType[]> {
  return Get(`${INTERNAL_HAZARDS_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<InternalHazardsModelType[]>)
    .catch((error) => {
      throw error;
    });
}
export function GetFullScopeModels(id = -1): Promise<FullScopeModelType[]> {
  return Get(`${FULL_SCOPE_ENDPOINT}/?id=${Number(id)}`)
    .then((response) => response.json() as Promise<FullScopeModelType[]>)
    .catch((error) => {
      throw error;
    });
}
export function GetCurrentTypedModel(): Promise<TypedModel> {
  const userId = ApiManager.getCurrentUser().user_id;
  const splitPath = window.location.pathname.split("/");
  const currentModelType = splitPath[TYPED_MODEL_TYPE_LOCATION];
  const modelId = parseInt(splitPath[TYPED_MODEL_ID_LOCATION]);
  return Get(`${TYPED_ENDPOINT}/${currentModelType}/${modelId}/?userId=${Number(userId)}`)
    .then((response) => response.json() as Promise<TypedModel>)
    .catch((error) => {
      throw error;
    });
}
export function GetCurrentModelIdString(): string {
  const splitPath = window.location.pathname.split("/");
  return splitPath[TYPED_MODEL_ID_LOCATION];
}
export function GetCurrentModelId(): number {
  const splitPath = window.location.pathname.split("/");
  return parseInt(splitPath[TYPED_MODEL_ID_LOCATION]);
}
export function GetCurrentModelType(): string {
  const splitPath = window.location.pathname.split("/");
  return splitPath[TYPED_MODEL_TYPE_LOCATION];
}
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
export function PostInternalEvent(data: Partial<TypedModelJSON>): Promise<InternalEventsModelType> {
  return Post(`${INTERNAL_EVENTS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<InternalEventsModelType>,
  );
}
export function PostInternalHazard(data: Partial<TypedModelJSON>): Promise<InternalHazardsModelType> {
  return Post(`${INTERNAL_HAZARDS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<InternalHazardsModelType>,
  );
}
export function PostExternalHazard(data: Partial<TypedModelJSON>): Promise<ExternalHazardsModelType> {
  return Post(`${EXTERNAL_HAZARDS_ENDPOINT}/`, data).then(
    (response) => response.json() as Promise<ExternalHazardsModelType>,
  );
}
export function PostFullScope(data: Partial<TypedModelJSON>): Promise<FullScopeModelType> {
  return Post(`${FULL_SCOPE_ENDPOINT}/`, data).then((response) => response.json() as Promise<FullScopeModelType>);
}
export function Post(url: string, data: Partial<TypedModelJSON>): Promise<Response> {
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
export function PatchInternalEvent(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<InternalEventsModelType> {
  return Patch(`${INTERNAL_EVENTS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, data).then(
    (response) => response.json() as Promise<InternalEventsModelType>,
  );
}
export function PatchExternalHazard(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<ExternalHazardsModelType> {
  return Patch(`${EXTERNAL_HAZARDS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, data).then(
    (response) => response.json() as Promise<ExternalHazardsModelType>,
  );
}
export function PatchInternalHazard(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<InternalHazardsModelType> {
  return Patch(`${INTERNAL_HAZARDS_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, data).then(
    (response) => response.json() as Promise<InternalHazardsModelType>,
  );
}
export function PatchFullScope(
  modelId: number,
  userId: number,
  data: Partial<TypedModelJSON>,
): Promise<FullScopeModelType> {
  return Patch(`${FULL_SCOPE_ENDPOINT}/${modelId}/?userId=${Number(userId)}`, data).then(
    (response) => response.json() as Promise<FullScopeModelType>,
  );
}
function Patch(
  url: string,
  data:
    | Partial<TypedModelJSON>
    | {
        nestedId: number | string;
        nestedType: string;
      }
    | {
        modelId: number;
        nestedId: number | string;
        nestedType: string;
      },
): Promise<Response> {
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
export async function DeleteInternalEvent(id = -1): Promise<InternalEventsModelType> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(`${INTERNAL_EVENTS_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(userId)}`)
    .then((response) => response.json() as Promise<InternalEventsModelType>)
    .catch((error) => {
      throw error;
    });
}
export async function DeleteExternalHazard(id = -1): Promise<ExternalHazardsModelType> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(`${EXTERNAL_HAZARDS_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(userId)}`)
    .then((response) => response.json() as Promise<ExternalHazardsModelType>)
    .catch((error) => {
      throw error;
    });
}
export async function DeleteInternalHazard(id = -1): Promise<InternalHazardsModelType> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(`${INTERNAL_HAZARDS_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(userId)}`)
    .then((response) => response.json() as Promise<InternalHazardsModelType>)
    .catch((error) => {
      throw error;
    });
}
export async function DeleteFullScope(id = -1): Promise<FullScopeModelType> {
  await RemoveParentIds(id);
  const userId = ApiManager.getCurrentUser().user_id;
  return await DeleteCall(`${FULL_SCOPE_ENDPOINT}/?modelId=${Number(id)}&userId=${Number(userId)}`)
    .then((response) => response.json() as Promise<FullScopeModelType>)
    .catch((error) => {
      throw error;
    });
}
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
export function AddNestedToInternalEvent(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<InternalEventsModel | null> {
  return Patch(INTERNAL_EVENTS_ENDPOINT, body).then(async (response) => {
    const text = await response.text();
    return text ? (JSON.parse(text) as InternalEventsModel) : null;
  });
}
export function AddNestedToInternalHazard(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<InternalHazardsModel | null> {
  return Patch(INTERNAL_HAZARDS_ENDPOINT, body).then(async (response) => {
    const text = await response.text();
    return text ? (JSON.parse(text) as InternalHazardsModel) : null;
  });
}
export function AddNestedToExternalHazard(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<ExternalHazardsModel | null> {
  return Patch(EXTERNAL_HAZARDS_ENDPOINT, body).then(async (response) => {
    const text = await response.text();
    return text ? (JSON.parse(text) as ExternalHazardsModel) : null;
  });
}
export function AddNestedToFullScope(body: {
  modelId: number;
  nestedId: number;
  nestedType: string;
}): Promise<FullScopeModel | null> {
  return Patch(FULL_SCOPE_ENDPOINT, body).then(async (response) => {
    const text = await response.text();
    return text ? (JSON.parse(text) as FullScopeModel) : null;
  });
}
export function DeleteNestedFromInternalEvent(
  modelId: number,
  body: {
    nestedId: number | string;
    nestedType: string;
  },
): Promise<InternalEventsModel> {
  return Patch(`${INTERNAL_EVENTS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, body).then(
    (response) => response.json() as Promise<InternalEventsModel>,
  );
}
export function DeleteNestedFromInternalHazard(
  modelId: number,
  body: {
    nestedId: number | string;
    nestedType: string;
  },
): Promise<InternalHazardsModel> {
  return Patch(`${INTERNAL_HAZARDS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, body).then(
    (response) => response.json() as Promise<InternalHazardsModel>,
  );
}
export function DeleteNestedFromExternalHazard(
  modelId: number,
  body: {
    nestedId: number | string;
    nestedType: string;
  },
): Promise<ExternalHazardsModel> {
  return Patch(`${EXTERNAL_HAZARDS_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, body).then(
    (response) => response.json() as Promise<ExternalHazardsModel>,
  );
}
export function DeleteNestedFromFullScope(
  modelId: number,
  body: {
    nestedId: number | string;
    nestedType: string;
  },
): Promise<FullScopeModel> {
  return Patch(`${FULL_SCOPE_ENDPOINT}/${modelId}/${DELETE_NESTED_END}`, body).then(
    (response) => response.json() as Promise<FullScopeModel>,
  );
}
