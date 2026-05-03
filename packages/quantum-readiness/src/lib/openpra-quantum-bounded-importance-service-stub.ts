import {
  buildOpenPraQuantumBoundedImportanceParityResult,
  type OpenPraQuantumBoundedImportanceParityResult,
} from "./openpra-quantum-bounded-importance-parity-harness";
import {
  buildOpenPraQuantumBoundedImportanceResponse,
  type BuildOpenPraQuantumBoundedImportanceResponseParams,
  type OpenPraQuantumBoundedImportanceResponse,
} from "./openpra-quantum-bounded-importance-contract";

export interface OpenPraQuantumBoundedImportanceServiceStubResult {
  response: OpenPraQuantumBoundedImportanceResponse;
  parityAgainstExpected: OpenPraQuantumBoundedImportanceParityResult | null;
}

export interface BuildOpenPraQuantumBoundedImportanceServiceStubParams
  extends BuildOpenPraQuantumBoundedImportanceResponseParams {
  expectedResponse?: OpenPraQuantumBoundedImportanceResponse | null;
}

export function buildOpenPraQuantumBoundedImportanceServiceStub(
  params: BuildOpenPraQuantumBoundedImportanceServiceStubParams,
): OpenPraQuantumBoundedImportanceServiceStubResult {
  const response = buildOpenPraQuantumBoundedImportanceResponse(params);

  const parityAgainstExpected =
    params.expectedResponse ?
      buildOpenPraQuantumBoundedImportanceParityResult(response, params.expectedResponse)
    : null;

  return {
    response,
    parityAgainstExpected,
  };
}
