import {
  Delete,
  Get,
  INITIATING_EVENTS_ENDPOINT,
  Patch,
  Post,
} from "../NestedModelApiManager";
import {
  NestedModelJSON,
  NestedModelType,
} from "../../types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "../../types/Label";

/**
 * Gets the list of the type of nested model
 * @param id - the parent model id, the parent whose list is to be retrieved
 * @returns a list of the nested models at  endpoint in a promise
 */
export async function GetInitiatingEvents(
  id: string,
): Promise<NestedModelType[]> {
  try {
    const response = await Get(`${INITIATING_EVENTS_ENDPOINT}/?id=${id}`);
    return (await response.json()) as Promise<NestedModelType[]>;
  } catch (error) {
    console.error("Failed to fetch initiating events:", error);
    throw error;
  }
}

/**
 * Posts the type of nested model, and adds its id to its parent
 * @param data - a nestedModelJSON containing a label and a parent id
 * @param typedModel - the typed model to be updated
 * @returns a promise with the nested model, containing only those features
 */
// TODO:: === work on changing this to Partial<NestedModelJSON> ===
export async function PostInitiatingEvent(
  data: NestedModelJSON,
  typedModel: string,
): Promise<NestedModelType> {
  try {
    const response = await Post(
      `${INITIATING_EVENTS_ENDPOINT}/`,
      data,
      typedModel,
    );
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to post initiating event:", error);
    throw error;
  }
}

/**
 * updates the label for the type of nested model
 * @param id - the id of the nested model
 * @param data - a labelJSON with a name and optional description
 * @returns a promise with the new updated model, with its label
 */
export async function PatchInitiatingEventLabel(
  id: string,
  data: LabelJSON,
): Promise<NestedModelType> {
  try {
    const response = await Patch(`${INITIATING_EVENTS_ENDPOINT}/${id}`, data);
    return (await response.json()) as Promise<NestedModelType>;
  } catch (error) {
    console.error("Failed to patch initiating event:", error);
    throw error;
  }
}

/**
 * Deletes a nested model from the typed model and database
 * @param id - the id of the model to be Deleted
 * @param type - the typed model that this nested model belongs to
 * @returns the Deleted model
 */
export async function DeleteInitiatingEvent(
  id: string,
  type: string,
): Promise<void> {
  try {
    await Delete(`${INITIATING_EVENTS_ENDPOINT}/?id=${id}&type=${type}`);
  } catch (error) {
    console.error("Failed to delete initiating event:", error);
    throw error;
  }
}
