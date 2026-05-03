import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { OpenPraQuantumPreparedCase, assertOpenPraQuantumPreparedCase } from "./openpra-quantum-platform-prepared-case";
import {
  OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION,
  OpenPraQuantumProvenanceBlock,
  assertOpenPraQuantumProvenanceBlock,
} from "./openpra-quantum-platform-provenance-failure";

export interface OpenPraQuantumIbmAdapterInput {
  preparedCase: OpenPraQuantumPreparedCase;
  outputDirectory: string;
  ibmBackendName: string;
  shotCount: number;
  circuitArtifactPath: string;
  dryRun: true;
  generatedTimestampUtc: string;
  adapterToolVersion: string;
  repositoryRootIfAvailable?: string;
  gitBranchIfAvailable?: string;
  gitCommitIfAvailable?: string;
  hostNameIfAvailable?: string;
  userNameIfAvailable?: string;
  commandOrEntrypointIfAvailable?: string;
}

export interface OpenPraQuantumIbmSubmissionManifest {
  schemaName: "OPENPRA_QUANTUM_IBM_SUBMISSION_MANIFEST";
  schemaVersion: "v1";
  preparedCaseId: string;
  backendFamily: "ibm_gate";
  backendMode: "remote_hardware";
  ibmBackendName: string;
  shotCount: number;
  circuitArtifactPath: string;
  dryRun: true;
  liveSubmissionPerformed: false;
  generatedTimestampUtc: string;
  boundednessStatement: string;
}

export interface OpenPraQuantumIbmAdapterResult {
  preparedCaseId: string;
  backendFamily: "ibm_gate";
  backendMode: "remote_hardware";
  executionStatus: "dry_run_completed";
  parserStatus: "parser_not_applicable";
  submissionManifestPath: string;
  adapterProvenancePath: string;
  rawResultPathIfAvailable?: string;
  sha256Path: string;
  liveSubmissionPerformed: false;
  backendSubmissionIdIfAvailable?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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

function validateIbmDryRunInput(input: OpenPraQuantumIbmAdapterInput): void {
  assertOpenPraQuantumPreparedCase(input.preparedCase);

  if (input.preparedCase.backendFamily !== "ibm_gate") {
    throw new Error("IBM adapter requires preparedCase.backendFamily = ibm_gate");
  }

  if (input.preparedCase.backendMode !== "remote_hardware") {
    throw new Error("IBM adapter requires preparedCase.backendMode = remote_hardware");
  }

  if (!input.dryRun) {
    throw new Error("IBM adapter v1 implementation only supports dryRun = true");
  }

  if (!isNonEmptyString(input.ibmBackendName)) {
    throw new Error("ibmBackendName is required");
  }

  if (!Number.isInteger(input.shotCount) || input.shotCount <= 0) {
    throw new Error("shotCount must be a positive integer");
  }

  if (!isNonEmptyString(input.circuitArtifactPath)) {
    throw new Error("circuitArtifactPath is required");
  }

  if (!isNonEmptyString(input.adapterToolVersion)) {
    throw new Error("adapterToolVersion is required");
  }

  if (!isNonEmptyString(input.generatedTimestampUtc)) {
    throw new Error("generatedTimestampUtc is required");
  }
}

export function runOpenPraQuantumIbmAdapterDryRun(
  input: OpenPraQuantumIbmAdapterInput,
): OpenPraQuantumIbmAdapterResult {
  validateIbmDryRunInput(input);

  fs.mkdirSync(input.outputDirectory, { recursive: true });

  const submissionManifestPath = path.join(input.outputDirectory, "openpra_quantum_ibm_submission_manifest_v1.json");
  const adapterProvenancePath = path.join(input.outputDirectory, "openpra_quantum_ibm_adapter_provenance_v1.json");
  const sha256Path = path.join(input.outputDirectory, "openpra_quantum_ibm_adapter_artifacts_v1.sha256");

  const submissionManifest: OpenPraQuantumIbmSubmissionManifest = {
    schemaName: "OPENPRA_QUANTUM_IBM_SUBMISSION_MANIFEST",
    schemaVersion: "v1",
    preparedCaseId: input.preparedCase.preparedCaseId,
    backendFamily: "ibm_gate",
    backendMode: "remote_hardware",
    ibmBackendName: input.ibmBackendName,
    shotCount: input.shotCount,
    circuitArtifactPath: input.circuitArtifactPath,
    dryRun: true,
    liveSubmissionPerformed: false,
    generatedTimestampUtc: input.generatedTimestampUtc,
    boundednessStatement:
      "This IBM adapter dry run validates submission packaging only. It does not contact IBM, does not submit a job, and does not establish hardware execution evidence.",
  };

  const adapterProvenance: OpenPraQuantumProvenanceBlock = {
    provenanceSchemaVersion: OPENPRA_QUANTUM_PROVENANCE_SCHEMA_VERSION,
    generatedTimestampUtc: input.generatedTimestampUtc,
    generatingTool: "openpra_quantum_platform_ibm_adapter_dry_run",
    generatingToolVersion: input.adapterToolVersion,
    repositoryRootIfAvailable: input.repositoryRootIfAvailable,
    gitBranchIfAvailable: input.gitBranchIfAvailable,
    gitCommitIfAvailable: input.gitCommitIfAvailable,
    hostNameIfAvailable: input.hostNameIfAvailable,
    userNameIfAvailable: input.userNameIfAvailable,
    commandOrEntrypointIfAvailable: input.commandOrEntrypointIfAvailable,
    inputArtifactPaths: [input.preparedCase.submissionManifestPath, input.circuitArtifactPath],
    outputArtifactPaths: [submissionManifestPath, adapterProvenancePath, sha256Path],
    evidenceClass: "dry_run_evidence",
    boundednessStatement:
      "This provenance block records an IBM adapter dry run only. It is not IBM hardware execution evidence.",
  };

  assertOpenPraQuantumProvenanceBlock(adapterProvenance);

  writeJsonFile(submissionManifestPath, submissionManifest);
  writeJsonFile(adapterProvenancePath, adapterProvenance);
  writeSha256Manifest(sha256Path, [submissionManifestPath, adapterProvenancePath]);

  return {
    preparedCaseId: input.preparedCase.preparedCaseId,
    backendFamily: "ibm_gate",
    backendMode: "remote_hardware",
    executionStatus: "dry_run_completed",
    parserStatus: "parser_not_applicable",
    submissionManifestPath,
    adapterProvenancePath,
    sha256Path,
    liveSubmissionPerformed: false,
  };
}
