export const OPENPRA_QUANTUM_BACKEND_FAMILIES = ["local_gate", "ibm_gate", "annealing", "fixture"] as const;

export type OpenPraQuantumBackendFamily = (typeof OPENPRA_QUANTUM_BACKEND_FAMILIES)[number];

export const OPENPRA_QUANTUM_BACKEND_MODES = [
  "local_validation",
  "remote_hardware",
  "remote_simulator",
  "annealing_vendor_pending",
  "fixture_test",
  "dry_run",
] as const;

export type OpenPraQuantumBackendMode = (typeof OPENPRA_QUANTUM_BACKEND_MODES)[number];

export const OPENPRA_QUANTUM_ALLOWED_BACKEND_MODE_PAIRS: ReadonlyArray<{
  backendFamily: OpenPraQuantumBackendFamily;
  backendMode: OpenPraQuantumBackendMode;
}> = [
  { backendFamily: "local_gate", backendMode: "local_validation" },
  { backendFamily: "local_gate", backendMode: "dry_run" },
  { backendFamily: "ibm_gate", backendMode: "remote_hardware" },
  { backendFamily: "ibm_gate", backendMode: "remote_simulator" },
  { backendFamily: "ibm_gate", backendMode: "dry_run" },
  { backendFamily: "annealing", backendMode: "annealing_vendor_pending" },
  { backendFamily: "annealing", backendMode: "fixture_test" },
  { backendFamily: "annealing", backendMode: "dry_run" },
  { backendFamily: "fixture", backendMode: "fixture_test" },
  { backendFamily: "fixture", backendMode: "dry_run" },
];

export function isOpenPraQuantumBackendFamily(value: unknown): value is OpenPraQuantumBackendFamily {
  return typeof value === "string" && (OPENPRA_QUANTUM_BACKEND_FAMILIES as readonly string[]).includes(value);
}

export function isOpenPraQuantumBackendMode(value: unknown): value is OpenPraQuantumBackendMode {
  return typeof value === "string" && (OPENPRA_QUANTUM_BACKEND_MODES as readonly string[]).includes(value);
}

export function isAllowedOpenPraQuantumBackendModePair(input: {
  backendFamily: unknown;
  backendMode: unknown;
}): boolean {
  if (!isOpenPraQuantumBackendFamily(input.backendFamily) || !isOpenPraQuantumBackendMode(input.backendMode)) {
    return false;
  }

  return OPENPRA_QUANTUM_ALLOWED_BACKEND_MODE_PAIRS.some(
    (pair) => pair.backendFamily === input.backendFamily && pair.backendMode === input.backendMode,
  );
}
