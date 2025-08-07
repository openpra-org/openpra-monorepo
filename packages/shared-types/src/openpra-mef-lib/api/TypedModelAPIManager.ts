import { AuthService } from "../../lib/api/AuthService";
import {
  TypedModelDeleteRequest,
  TypedModelGetRequest,
  TypedModelPatchRequest,
  TypedModelPostRequest,
} from "../../openpra-mef-types/api/TypedModelRequest";
import { TypedModel } from "../../openpra-mef-types/modelTypes/largeModels/TypedModel";

const API_ENDPOINT = "/api";
const OPTION_CACHE = "no-cache"; // *default, no-cache, reload, force-cache, only-if-cached
const TYPED_ENDPOINT = `${API_ENDPOINT}/typed-models`;

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

export function Post(url: string, data: TypedModelPostRequest): Promise<Response> {
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

function Patch(url: string, data: TypedModelPatchRequest): Promise<Response> {
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

export function Delete(url: string): Promise<Response> {
  return fetch(url, {
    method: "DELETE",
    cache: OPTION_CACHE,
    headers: {
      "Content-Type": "application/json",
      Authorization: `JWT ${AuthService.getEncodedToken()}`,
    },
  });
}

export function GetTypedModels(typedModelReq: TypedModelGetRequest): Promise<TypedModel[]> {
  const URL = `${TYPED_ENDPOINT}/${typedModelReq.typedModelName}?userId=${typedModelReq.userId}`;
  console.log(URL + "URL");
  return Get(URL)
    .then((response) => response.json() as Promise<TypedModel[]>)
    .catch((error) => {
      throw error;
    });
}

export function PostTypedModel(typedModelReq: TypedModelPostRequest): Promise<TypedModel> {
  return Post(`${TYPED_ENDPOINT}/`, typedModelReq)
    .then((response) => response.json() as Promise<TypedModel>)
    .catch((error) => {
      throw error;
    });
}

export function PatchTypedModel(modelId: string, typedModelReq: TypedModelPatchRequest): Promise<TypedModel> {
  return Patch(`${TYPED_ENDPOINT}/${modelId}`, typedModelReq)
    .then((response) => response.json() as Promise<TypedModel>)
    .catch((error) => {
      throw error;
    });
}

export function DeleteTypedModel(modelId: string, typedModelReq: TypedModelDeleteRequest): Promise<TypedModel> {
  //   await RemoveParentIds(id);

  return Delete(`${TYPED_ENDPOINT}/${typedModelReq.typedModelName}/${modelId}?userId=${typedModelReq.userId}`)
    .then((response) => response.json() as Promise<TypedModel>)
    .catch((error) => {
      throw error;
    });
}
