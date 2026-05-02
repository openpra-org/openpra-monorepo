export interface OpenPraQuantumCanonicalRecoveryInput {
  rawResultEnvelope: any;
}

export interface OpenPraQuantumCanonicalRecoveryOutput {
  recoveryStatus: "recovered" | "no_signal" | "invalid_input";
  recoveredBitstrings: Record<string, number>;
  boundednessStatement: string;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function runOpenPraQuantumCanonicalRecovery(
  input: OpenPraQuantumCanonicalRecoveryInput,
): OpenPraQuantumCanonicalRecoveryOutput {
  const envelope = input.rawResultEnvelope;

  if (!isObject(envelope)) {
    return {
      recoveryStatus: "invalid_input",
      recoveredBitstrings: {},
      boundednessStatement: "Invalid input: raw result envelope is not an object.",
    };
  }

  const payload = envelope.backendRawPayload;

  if (!isObject(payload) || !payload.rawPayloadPath) {
    return {
      recoveryStatus: "invalid_input",
      recoveredBitstrings: {},
      boundednessStatement: "Invalid input: missing backend raw payload.",
    };
  }

  let counts: Record<string, number> = {};

  try {
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(payload.rawPayloadPath, "utf8"));
    if (raw && typeof raw.counts === "object") {
      counts = raw.counts;
    }
  } catch {
    return {
      recoveryStatus: "invalid_input",
      recoveredBitstrings: {},
      boundednessStatement: "Failed to load raw payload for recovery.",
    };
  }

  if (!counts || Object.keys(counts).length === 0) {
    return {
      recoveryStatus: "no_signal",
      recoveredBitstrings: {},
      boundednessStatement: "No measurable signal present in IBM result counts.",
    };
  }

  return {
    recoveryStatus: "recovered",
    recoveredBitstrings: counts,
    boundednessStatement:
      "Canonical recovery performed as direct extraction of measured bitstring counts. No minimal cut set interpretation or PRA mapping is implied.",
  };
}
