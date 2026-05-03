export type OpenPraQuantumBitOrder = "declared" | "reversed";

export interface OpenPraQuantumBitVariableMap {
  bitIndex: number;
  basicEventId: string;
}

export interface OpenPraQuantumSemanticMcsMappingInput {
  bitstring: string;
  variableMap: OpenPraQuantumBitVariableMap[];
  orientation: OpenPraQuantumBitOrder;
}

export interface OpenPraQuantumSemanticMcsMappingOutput {
  mappingStatus: "mapped" | "invalid_input";
  orientation: OpenPraQuantumBitOrder;
  activeBasicEvents: string[];
  boundednessStatement: string;
  errors: string[];
}

function isBinaryBitstring(value: string): boolean {
  return /^[01]+$/.test(value);
}

function normalizeBitstring(bitstring: string, orientation: OpenPraQuantumBitOrder): string {
  return orientation === "reversed" ? bitstring.split("").reverse().join("") : bitstring;
}

export function mapOpenPraQuantumBitstringToCandidateMcs(
  input: OpenPraQuantumSemanticMcsMappingInput,
): OpenPraQuantumSemanticMcsMappingOutput {
  const errors: string[] = [];

  if (!input.bitstring || !isBinaryBitstring(input.bitstring)) {
    errors.push("bitstring must be a nonempty binary string");
  }

  if (!Array.isArray(input.variableMap) || input.variableMap.length === 0) {
    errors.push("variableMap must be a nonempty array");
  }

  if (input.orientation !== "declared" && input.orientation !== "reversed") {
    errors.push("orientation must be declared or reversed");
  }

  if (errors.length > 0) {
    return {
      mappingStatus: "invalid_input",
      orientation: input.orientation,
      activeBasicEvents: [],
      boundednessStatement: "Invalid input. No MCS interpretation is performed.",
      errors,
    };
  }

  const oriented = normalizeBitstring(input.bitstring, input.orientation);
  const activeBasicEvents: string[] = [];

  for (const item of input.variableMap) {
    if (
      typeof item.bitIndex !== "number" ||
      item.bitIndex < 0 ||
      item.bitIndex >= oriented.length ||
      !item.basicEventId
    ) {
      errors.push("variableMap contains invalid entry");
      continue;
    }

    if (oriented[item.bitIndex] === "1") {
      activeBasicEvents.push(item.basicEventId);
    }
  }

  if (errors.length > 0) {
    return {
      mappingStatus: "invalid_input",
      orientation: input.orientation,
      activeBasicEvents: [],
      boundednessStatement: "Invalid variable map. No MCS interpretation is performed.",
      errors,
    };
  }

  return {
    mappingStatus: "mapped",
    orientation: input.orientation,
    activeBasicEvents,
    boundednessStatement:
      "Bitstring has been mapped to a candidate basic event set. This is not yet a confirmed minimal cut set until compared against the classical reference.",
    errors: [],
  };
}
