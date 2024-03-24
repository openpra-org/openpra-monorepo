import TypedModel, { typedModelType } from "./typedModel";

/**
 * Internal events models do the same thing as a typed model for now, just have their own object for sorting purposes
 */
export class InternalEventsModel extends TypedModel {}

export type InternalEventsModelType = typedModelType;

export type InternalEventsMetadata = {
  _id: string;
  label: {
    name: string;
    description: string;
  };
  users: number[];
};
