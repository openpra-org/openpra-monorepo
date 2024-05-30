/**
 * Representation of a logical gate in a fault tree.
 */
export type GateSchema = EventSchema & {
  /**
   * Boolean operator of the gate.
   */
  operator: "and" | "or" | "atleast" | "not" | "xor" | "nor" | "xnor" | "nand" | "imply";
  /**
   * Minimum number for the combination operator, can be null.
   */
  kNum?: number;
  /**
   * Set of gate arguments.
   */
  gArguments?: GateSchema[];
  /**
   * Set of basic event arguments.
   */
  bArguments?: BasicEventSchema[];
  /**
   * Set of house event arguments.
   */
  hArguments?: HouseEventSchema[];
  /**
   * Set of undefined event arguments.
   */
  uArguments?: EventSchema[];
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
 * Representation of a basic event in a fault tree, which includes a probability estimate.
 */
export type BasicEventSchema = EventSchema & {
  probability: PointEstimateSchema;
};
/**
 * Probability of the basic event occurring, must be between 0 and 1 exclusive.
 */
export type PointEstimateSchema = number;
/**
 * Representation of a house event in a fault tree, which contains is a boolean flag
 */
export type HouseEventSchema = EventSchema & {
  /**
   * The flag is either set or unset (true/false).
   */
  flag: boolean;
};

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
