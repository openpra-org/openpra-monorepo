/**
 * An enum of various gateTypes types.
 *
 * @enum {Object}
 */
enum GateTypes {
  AND = "and",
  AT_LEAST = "atleast",
  CARDINALITY = "cardinality",
  IFF = "iff",
  IMPLY = "imply",
  NAND = "nand",
  NOR = "nor",
  NOT = "not",
  OR = "or",
  XOR = "xor"
}

export const GateTypeDescriptions = {
  [GateTypes.AND]: "AND Gate",
  [GateTypes.AT_LEAST]: "K/N Gate",
  [GateTypes.CARDINALITY]: "CARDINALITY Gate",
  [GateTypes.IFF]: "IFF Gate",
  [GateTypes.IMPLY]: "IMPLY Gate",
  [GateTypes.NAND]: "NAND Gate",
  [GateTypes.NOR]: "NOR Gate",
  [GateTypes.NOT]: "NOT Gate",
  [GateTypes.OR]: "OR Gate",
  [GateTypes.XOR]: "XOR Gate"
};

export default GateTypes;
