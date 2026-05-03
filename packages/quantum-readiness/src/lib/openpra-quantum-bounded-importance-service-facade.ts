import {
  buildOpenPraQuantumBoundedImportanceServiceStub,
  type BuildOpenPraQuantumBoundedImportanceServiceStubParams,
  type OpenPraQuantumBoundedImportanceServiceStubResult,
} from "./openpra-quantum-bounded-importance-service-stub";
import {
  persistOpenPraQuantumBoundedImportanceArtifacts,
  type OpenPraQuantumBoundedImportanceArtifactStoreResult,
} from "./openpra-quantum-bounded-importance-artifact-store";

export interface BuildOpenPraQuantumBoundedImportanceServiceFacadeParams
  extends BuildOpenPraQuantumBoundedImportanceServiceStubParams {
  rootDirectoryPath: string;
  inputArtifactPaths?: string[];
  scriptVersion?: string;
}

export interface OpenPraQuantumBoundedImportanceServiceFacadeResult {
  stubResult: OpenPraQuantumBoundedImportanceServiceStubResult;
  persistedArtifacts: OpenPraQuantumBoundedImportanceArtifactStoreResult;
}

export function buildOpenPraQuantumBoundedImportanceServiceFacade(
  params: BuildOpenPraQuantumBoundedImportanceServiceFacadeParams,
): OpenPraQuantumBoundedImportanceServiceFacadeResult {
  const stubResult = buildOpenPraQuantumBoundedImportanceServiceStub(params);

  const persistedArtifacts = persistOpenPraQuantumBoundedImportanceArtifacts({
    rootDirectoryPath: params.rootDirectoryPath,
    response: stubResult.response,
    inputArtifactPaths: params.inputArtifactPaths ?? [],
    scriptVersion: params.scriptVersion ?? "openpra-quantum-bounded-importance-service-facade-v1",
  });

  return {
    stubResult,
    persistedArtifacts,
  };
}
