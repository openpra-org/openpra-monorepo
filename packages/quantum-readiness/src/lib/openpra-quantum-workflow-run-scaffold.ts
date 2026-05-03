import fs from "node:fs";
import path from "node:path";

export interface OpenpraQuantumWorkflowRunScaffoldRequest {
  rootDir: string;
  modelId: string;
  subtreeId: string;
  workflowKind: "preparation" | "execution" | "recovery" | "recovery_batch" | "full_pipeline";
  requestedBy?: string;
  notes?: string[];
  createdAtUtc?: string;
}

export interface OpenpraQuantumWorkflowRunScaffoldResult {
  rootDir: string;
  workflowRunDir: string;
  manifestPath: string;
  directories: {
    artifacts: string;
    preparation: string;
    execution: string;
    recovery: string;
    batch: string;
    logs: string;
  };
}

interface OpenpraQuantumWorkflowRunManifest {
  schemaVersion: string;
  artifactType: "workflow_run_manifest";
  artifactId: string;
  createdAtUtc: string;
  requestedBy: string;
  workflowKind: string;
  modelId: string;
  subtreeId: string;
  notes: string[];
  directories: {
    artifacts: string;
    preparation: string;
    execution: string;
    recovery: string;
    batch: string;
    logs: string;
  };
}

const SCHEMA_VERSION = "1.0.0";
const MODULE_VERSION = "openpra-quantum-workflow-run-scaffold-v1";

export function buildOpenpraQuantumWorkflowRunScaffold(
  request: OpenpraQuantumWorkflowRunScaffoldRequest,
): OpenpraQuantumWorkflowRunScaffoldResult {
  const createdAtUtc = request.createdAtUtc ?? new Date().toISOString();
  const workflowRunDir = path.join(
    path.resolve(request.rootDir),
    buildRunDirName(request.workflowKind, request.modelId, request.subtreeId, createdAtUtc),
  );

  const directories = {
    artifacts: path.join(workflowRunDir, "artifacts"),
    preparation: path.join(workflowRunDir, "artifacts", "preparation"),
    execution: path.join(workflowRunDir, "artifacts", "execution"),
    recovery: path.join(workflowRunDir, "artifacts", "recovery"),
    batch: path.join(workflowRunDir, "artifacts", "batch"),
    logs: path.join(workflowRunDir, "logs"),
  };

  Object.values(directories).forEach((dirPath) => {
    fs.mkdirSync(dirPath, { recursive: true });
  });

  const manifestPath = path.join(workflowRunDir, "openpra_quantum_workflow_run_manifest_v1.json");

  const manifest: OpenpraQuantumWorkflowRunManifest = {
    schemaVersion: SCHEMA_VERSION,
    artifactType: "workflow_run_manifest",
    artifactId: buildArtifactId(request.workflowKind, request.modelId, request.subtreeId, createdAtUtc),
    createdAtUtc,
    requestedBy: request.requestedBy ?? MODULE_VERSION,
    workflowKind: request.workflowKind,
    modelId: request.modelId,
    subtreeId: request.subtreeId,
    notes: [...(request.notes ?? [])],
    directories,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");

  return {
    rootDir: path.resolve(request.rootDir),
    workflowRunDir,
    manifestPath,
    directories,
  };
}

function buildRunDirName(workflowKind: string, modelId: string, subtreeId: string, createdAtUtc: string): string {
  return [
    "openpra_quantum",
    sanitizeToken(workflowKind),
    sanitizeToken(modelId),
    sanitizeToken(subtreeId),
    sanitizeToken(createdAtUtc),
  ].join("_");
}

function buildArtifactId(workflowKind: string, modelId: string, subtreeId: string, createdAtUtc: string): string {
  return [
    "workflow_run_manifest",
    sanitizeToken(workflowKind),
    sanitizeToken(modelId),
    sanitizeToken(subtreeId),
    sanitizeToken(createdAtUtc),
  ].join(":");
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
