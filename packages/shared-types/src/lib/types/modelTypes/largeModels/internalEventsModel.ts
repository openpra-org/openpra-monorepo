import TypedModel, { typedModelType } from './typedModel';

/**
 * Internal events models do the same thing as a typed model for now, just have their own object for sorting purposes
 */
export class InternalEventsModel extends TypedModel {}

/** Persisted document shape for an Internal Events model. */
export type InternalEventsModelType = typedModelType;

/**
 * Additional metadata stored alongside an internal events model.
 */
export interface InternalEventsMetadata {
  _id: string;
  label: {
    name: string;
    description: string;
  };
  users: number[];
}
