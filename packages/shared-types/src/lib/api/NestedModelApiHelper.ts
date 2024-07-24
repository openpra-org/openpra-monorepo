// used constants
import { NestedModelJSON } from "../types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "../types/Label";
import { Delete, Get, Patch, Post } from "./NestedModelApiManager";

const API_ENDPOINT = "/api";
const NESTED_ENDPOINT = `${API_ENDPOINT}/nested-models`;

const NESTED_MODEL_TYPE_LOCATION = 3;

function GetCurrentNestedModelType(): string {
  const splitPath = window.location.pathname.split("/");
  return splitPath[NESTED_MODEL_TYPE_LOCATION];
}

const EndPoint = `${NESTED_ENDPOINT}/${GetCurrentNestedModelType()}`;

function GetModelName(): string {
  return GetCurrentNestedModelType()
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export async function GetNestedModel<NMType>(id: string): Promise<NMType[]> {
  try {
    const response = await Get(`${EndPoint}/?id=${id}`);
    return (await response.json()) as Promise<NMType[]>;
  } catch (error) {
    console.error(`Failed to fetch ${GetModelName()}:`, error);
    throw error;
  }
}

export async function PostNestedModel<NMType>(data: NestedModelJSON, typedModel: string): Promise<NMType> {
  try {
    const response = await Post(`${EndPoint}/`, data, typedModel);
    console.log(response);
    return (await response.json()) as Promise<NMType>;
  } catch (error) {
    console.error(`Failed to post ${GetModelName()}:`, error);
    throw error;
  }
}

export async function PatchNestedModel<NMType>(id: string, data: LabelJSON): Promise<NMType> {
  try {
    const response = await Patch(`${EndPoint}/${id}`, data);
    return (await response.json()) as Promise<NMType>;
  } catch (error) {
    console.error(`Failed to patch ${GetModelName()}:`, error);
    throw error;
  }
}

export async function DeleteNestedModel(id: string, type: string): Promise<void> {
  try {
    await Delete(`${EndPoint}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error(`Failed to delete ${GetModelName()}:`, error);
    throw error;
  }
}
