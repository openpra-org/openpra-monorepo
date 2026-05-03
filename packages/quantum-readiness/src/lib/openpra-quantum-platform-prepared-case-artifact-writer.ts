import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import {
  OpenPraQuantumPreparedCasePackage,
  buildOpenPraQuantumPreparedCasePackage,
  OpenPraQuantumPreparedCaseBuilderInput,
} from "./openpra-quantum-platform-prepared-case-builder";
import { assertOpenPraQuantumPreparedCase } from "./openpra-quantum-platform-prepared-case";
import { assertOpenPraQuantumProvenanceBlock } from "./openpra-quantum-platform-provenance-failure";

export interface OpenPraQuantumPreparedCaseArtifactWriteInput extends OpenPraQuantumPreparedCaseBuilderInput {
  outputDirectory: string;
}

export interface OpenPraQuantumPreparedCaseArtifactWriteResult {
  package: OpenPraQuantumPreparedCasePackage;
  outputDirectory: string;
  preparedCasePath: string;
  provenancePath: string;
  manifestPath: string;
  sha256Path: string;
}

function writeJsonFile(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256File(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return createHash("sha256").update(new Uint8Array(data)).digest("hex");
}

function writeSha256Manifest(sha256Path: string, files: ReadonlyArray<string>): void {
  const lines = files.map((filePath) => `${sha256File(filePath)}  ${filePath}`).join("\n");

  fs.writeFileSync(sha256Path, `${lines}\n`, "utf8");
}

export function writeOpenPraQuantumPreparedCaseArtifacts(
  input: OpenPraQuantumPreparedCaseArtifactWriteInput,
): OpenPraQuantumPreparedCaseArtifactWriteResult {
  const preparedCasePackage = buildOpenPraQuantumPreparedCasePackage(input);

  assertOpenPraQuantumPreparedCase(preparedCasePackage.preparedCase);
  assertOpenPraQuantumProvenanceBlock(preparedCasePackage.provenanceBlock);

  fs.mkdirSync(input.outputDirectory, { recursive: true });

  const preparedCasePath = path.join(input.outputDirectory, "openpra_quantum_prepared_case_v1.json");
  const provenancePath = path.join(input.outputDirectory, "openpra_quantum_prepared_case_provenance_v1.json");
  const manifestPath = path.join(input.outputDirectory, "openpra_quantum_prepared_case_manifest_v1.json");
  const sha256Path = path.join(input.outputDirectory, "openpra_quantum_prepared_case_artifacts_v1.sha256");

  writeJsonFile(preparedCasePath, preparedCasePackage.preparedCase);
  writeJsonFile(provenancePath, preparedCasePackage.provenanceBlock);

  const manifest = {
    schemaName: "OPENPRA_QUANTUM_PREPARED_CASE_ARTIFACT_MANIFEST",
    schemaVersion: "v1",
    preparedCaseId: preparedCasePackage.preparedCase.preparedCaseId,
    generatedTimestampUtc: input.generatedTimestampUtc,
    artifactPaths: {
      preparedCasePath,
      provenancePath,
      sha256Path,
    },
    boundednessStatement: preparedCasePackage.preparedCase.boundednessStatement,
  };

  writeJsonFile(manifestPath, manifest);
  writeSha256Manifest(sha256Path, [preparedCasePath, provenancePath, manifestPath]);

  return {
    package: preparedCasePackage,
    outputDirectory: input.outputDirectory,
    preparedCasePath,
    provenancePath,
    manifestPath,
    sha256Path,
  };
}
