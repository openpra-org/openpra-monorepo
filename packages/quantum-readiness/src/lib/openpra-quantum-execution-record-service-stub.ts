import {
  createOpenPraQuantumExecutionRecord,
  createOpenPraQuantumExecutionResult,
  type CreateOpenPraQuantumExecutionRecordParams,
  type CreateOpenPraQuantumExecutionResultParams,
  type OpenPraQuantumExecutionRecord,
  type OpenPraQuantumExecutionResult,
} from "./openpra-quantum-execution-bridge-contract";
import {
  persistOpenPraQuantumExecutionArtifacts,
  type OpenPraQuantumExecutionArtifactStoreResult,
} from "./openpra-quantum-execution-artifact-store";

export interface BuildOpenPraQuantumExecutionRecordServiceStubParams {
  rootDirectoryPath: string;
  executionRecord: CreateOpenPraQuantumExecutionRecordParams;
  executionResult?: CreateOpenPraQuantumExecutionResultParams | null;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumExecutionRecordServiceStubResult {
  executionRecord: OpenPraQuantumExecutionRecord;
  executionResult: OpenPraQuantumExecutionResult | null;
  persistedArtifacts: OpenPraQuantumExecutionArtifactStoreResult;
}

export function buildOpenPraQuantumExecutionRecordServiceStub(
  params: BuildOpenPraQuantumExecutionRecordServiceStubParams,
): OpenPraQuantumExecutionRecordServiceStubResult {
  const executionRecord = createOpenPraQuantumExecutionRecord(params.executionRecord);

  const executionResult = params.executionResult ? createOpenPraQuantumExecutionResult(params.executionResult) : null;

  const persistedArtifacts = persistOpenPraQuantumExecutionArtifacts({
    rootDirectoryPath: params.rootDirectoryPath,
    executionRecord,
    executionResult,
    inputArtifactPaths: params.inputArtifactPaths ?? [],
    scriptVersion: params.scriptVersion ?? "openpra-quantum-execution-record-service-stub-v1",
  });

  return {
    executionRecord,
    executionResult,
    persistedArtifacts,
  };
}
