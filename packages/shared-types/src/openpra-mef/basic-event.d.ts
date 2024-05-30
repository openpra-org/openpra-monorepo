/**
 * Representation of a basic event in a fault tree, which includes a probability estimate.
 */
export type BasicEventSchema = EventSchema & {
  probability: PointEstimateSchema;
};
/**
 * A type code consisting of three uppercase letters followed by a hyphen and three digits
 */
export type TypeCodeSchema = string;
/**
 * A Unique Universal Identifier representation
 */
export type UUIDSchema = string;
/**
 * Probability of the basic event occurring, must be between 0 and 1 exclusive.
 */
export type PointEstimateSchema = number;

/**
 * Representation of a base class for an event in a fault tree.
 */
export interface EventSchema {
  /**
   * Identifier for the event node.
   */
  name: string;
  typecode?: TypeCodeSchema;
  uuid?: UUIDSchema;
  /**
   * List of unique parent events. This is a simplification as JSON does not support sets directly.
   */
  parents: EventSchema[];
}
