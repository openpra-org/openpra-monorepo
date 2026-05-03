import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";

import { GraphModelService } from "../src/graphModels/graphModel.service";
import { cloneOpenPraFixture, openPraNormalizedCase1 } from "../src/quantumReadiness/openPraFaultTreeGraph.fixtures";
import { QuantumReadinessController } from "../src/quantumReadiness/quantumReadiness.controller";
import { QuantumReadinessService } from "../src/quantumReadiness/quantumReadiness.service";

interface PreparationWorkflowRunHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      preparation: string;
    };
  };
  preparationWrite: {
    bundlePath: string;
    artifactPaths: string[];
  };
}

interface RecoveryWorkflowRunHttpResponse {
  workflowRun: {
    workflowRunDir: string;
    manifestPath: string;
    directories: {
      recovery: string;
    };
  };
  recoveryWrite: {
    recoveryArtifactPath: string;
  };
}

interface SummaryRow {
  artifact_id: string;
  route: string;
  status_code: number;
  pass: boolean;
  request_file: string;
  response_file: string;
  note: string;
}

const REPO_ROOT = path.resolve(__dirname, "../../..");
const OUT_BASE = path.join(REPO_ROOT, "_work", "openpra_quantum_ws2_ws3_rest_evidence_bundle_v1");

function utcNowIso(): string {
  return new Date().toISOString();
}

function utcStamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeText(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function walkDirectories(startDir: string, visit: (dirPath: string) => void): void {
  if (!fs.existsSync(startDir)) {
    return;
  }

  const stack = [startDir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    visit(current);

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      stack.push(path.join(current, entry.name));
    }
  }
}

function findFirstFileRecursive(startDir: string, fileName: string): string | null {
  let found: string | null = null;
  walkDirectories(startDir, (dirPath) => {
    if (found !== null) {
      return;
    }
    const candidate = path.join(dirPath, fileName);
    if (fs.existsSync(candidate)) {
      found = candidate;
    }
  });
  return found;
}

function getPhaseCaseAnchor(dirPath: string): string | null {
  const normalized = dirPath.split(path.sep);
  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    if (/^phase2b_row_.+__G_.+/.test(normalized[i])) {
      return normalized.slice(0, i + 1).join(path.sep);
    }
  }
  return null;
}

function discoverRealBaselineCaseAnchors(): string[] {
  const roots = [
    path.join(REPO_ROOT, "_work", "openpra_quantum_simulator_validation_v1_real"),
    path.join(REPO_ROOT, "_work", "openpra_quantum_simulator_validation_v1_real_exhaust_ac"),
  ];

  const anchors = new Set<string>();

  for (const root of roots) {
    walkDirectories(root, (dirPath) => {
      const anchor = getPhaseCaseAnchor(dirPath);
      if (anchor === null) {
        return;
      }
      if (anchor.includes(`${path.sep}_quarantine${path.sep}`)) {
        return;
      }

      const packageMetadata = findFirstFileRecursive(anchor, "package_metadata.json");
      const rawCounts = findFirstFileRecursive(anchor, "raw_counts.json");
      const classicalReference = findFirstFileRecursive(anchor, "classical_reference_mcs.json");

      if (packageMetadata && rawCounts && classicalReference) {
        anchors.add(anchor);
      }
    });
  }

  return Array.from(anchors).sort();
}

function normalizeCandidateDirFromAnchor(
  anchorDir: string,
  outDir: string,
): {
  candidateDir: string;
  modelId: string;
  subtreeId: string;
  preparationArtifactPath: string | null;
  sourceFiles: {
    packageMetadata: string;
    rawCounts: string;
    classicalReference: string;
  };
} {
  const packageMetadata = findFirstFileRecursive(anchorDir, "package_metadata.json");
  const rawCounts = findFirstFileRecursive(anchorDir, "raw_counts.json");
  const classicalReference = findFirstFileRecursive(anchorDir, "classical_reference_mcs.json");

  if (!packageMetadata || !rawCounts || !classicalReference) {
    throw new Error(`Missing recovery inputs under anchor: ${anchorDir}`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const packageTarget = path.join(outDir, "package_metadata.json");
  const rawCountsTarget = path.join(outDir, "raw_counts.json");
  const classicalTarget = path.join(outDir, "classical_reference_mcs.json");

  fs.copyFileSync(packageMetadata, packageTarget);
  fs.copyFileSync(rawCounts, rawCountsTarget);
  fs.copyFileSync(classicalReference, classicalTarget);

  const packageJson = JSON.parse(fs.readFileSync(packageTarget, "utf8")) as Record<string, unknown>;

  const modelId =
    (packageJson.model_id as string | undefined) ??
    (packageJson.modelId as string | undefined) ??
    (packageJson.phase2b_row_id as string | undefined) ??
    path.basename(anchorDir).split("__")[0];

  const subtreeId =
    (packageJson.candidate_root_node_id as string | undefined) ??
    (packageJson.candidateRootNodeId as string | undefined) ??
    (packageJson.root_gate_id as string | undefined) ??
    path.basename(anchorDir).split("__")[1]?.replace(/^G_/, "G:") ??
    "UNKNOWN_SUBTREE";

  const preparationArtifactPath = findFirstFileRecursive(anchorDir, "openpra_quantum_preparation_artifact_v1.json");

  return {
    candidateDir: outDir,
    modelId,
    subtreeId,
    preparationArtifactPath,
    sourceFiles: {
      packageMetadata,
      rawCounts,
      classicalReference,
    },
  };
}

function csvEscape(value: string | number | boolean): string {
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

describe("QuantumReadiness WS2 WS3 REST evidence bundle", () => {
  let app: INestApplication;
  let graphModelServiceMock: { getFaultTreeGraph: jest.Mock };

  beforeAll(async () => {
    graphModelServiceMock = {
      getFaultTreeGraph: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QuantumReadinessController],
      providers: [
        QuantumReadinessService,
        {
          provide: GraphModelService,
          useValue: graphModelServiceMock,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api/quantum-readiness");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("builds the WS2 WS3 REST evidence bundle", async () => {
    const stamp = utcStamp();
    const runDir = path.join(OUT_BASE, `OPENPRA_WS2_WS3_REST_EVIDENCE_BUNDLE_v1_${stamp}`);
    const controlDir = path.join(runDir, "CONTROL");
    const requestsDir = path.join(runDir, "REQUESTS");
    const responsesDir = path.join(runDir, "RESPONSES");
    const normalizedInputsDir = path.join(runDir, "NORMALIZED_BASELINE_INPUTS");
    const manifestsDir = path.join(runDir, "MANIFESTS");

    [controlDir, requestsDir, responsesDir, normalizedInputsDir, manifestsDir].forEach((dirPath) =>
      fs.mkdirSync(dirPath, { recursive: true }),
    );

    const summaryRows: SummaryRow[] = [];
    const manifestFiles: Array<{ relative_path: string; sha256: string; size_bytes: number }> = [];

    const preparationRootDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-ws2-preparation-rest-"));

    const preparationRequestBody = {
      rootDir: preparationRootDir,
      modelId: "openpra_graph_case_1",
      subtreeId: "TOP",
      modelName: "Preparation Workflow Graph",
      graph: cloneOpenPraFixture(openPraNormalizedCase1),
    };

    const preparationRequestPath = path.join(requestsDir, "01_ws2_preparation_workflow_run_request_v1.json");
    writeJson(preparationRequestPath, preparationRequestBody);

    const preparationResponse = await request(app.getHttpServer())
      .post("/api/quantum-readiness/workflow/preparation-run")
      .send(preparationRequestBody)
      .expect(200);

    const preparationBody = preparationResponse.body as PreparationWorkflowRunHttpResponse;

    expect(fs.existsSync(preparationBody.workflowRun.workflowRunDir)).toBe(true);
    expect(fs.existsSync(preparationBody.workflowRun.manifestPath)).toBe(true);
    expect(fs.existsSync(preparationBody.workflowRun.directories.preparation)).toBe(true);
    expect(fs.existsSync(preparationBody.preparationWrite.bundlePath)).toBe(true);
    expect(preparationBody.preparationWrite.artifactPaths.length).toBeGreaterThan(0);

    const preparationResponsePath = path.join(responsesDir, "01_ws2_preparation_workflow_run_response_v1.json");
    writeJson(preparationResponsePath, {
      captured_at_utc: utcNowIso(),
      route: "/api/quantum-readiness/workflow/preparation-run",
      status_code: preparationResponse.status,
      response_json: preparationBody,
    });

    summaryRows.push({
      artifact_id: "01_ws2_preparation_workflow_run",
      route: "/api/quantum-readiness/workflow/preparation-run",
      status_code: preparationResponse.status,
      pass: preparationResponse.status === 200,
      request_file: path.relative(runDir, preparationRequestPath),
      response_file: path.relative(runDir, preparationResponsePath),
      note: "Authoritative direct WS2 REST run using the controller HTTP spec fixture graph.",
    });

    const anchors = discoverRealBaselineCaseAnchors();
    expect(anchors.length).toBeGreaterThanOrEqual(3);

    const selectedAnchors = anchors.slice(0, 3);

    for (let index = 0; index < selectedAnchors.length; index += 1) {
      const anchor = selectedAnchors[index];
      const normalizedDir = path.join(
        normalizedInputsDir,
        `${String(index + 1).padStart(2, "0")}_${path.basename(anchor)}`,
      );
      const normalized = normalizeCandidateDirFromAnchor(anchor, normalizedDir);
      const recoveryRootDir = fs.mkdtempSync(path.join(os.tmpdir(), `openpra-ws3-recovery-rest-${index + 1}-`));

      const requestBody = {
        rootDir: recoveryRootDir,
        candidateDir: normalized.candidateDir,
        modelId: normalized.modelId,
        subtreeId: normalized.subtreeId,
      };

      const requestPath = path.join(
        requestsDir,
        `${String(index + 2).padStart(2, "0")}_ws3_recovery_workflow_run_request_v1.json`,
      );
      writeJson(requestPath, {
        baseline_anchor_dir: anchor,
        normalized_candidate_dir: normalized.candidateDir,
        preparation_artifact_path: normalized.preparationArtifactPath,
        source_files: normalized.sourceFiles,
        request_body: requestBody,
      });

      const response = await request(app.getHttpServer())
        .post("/api/quantum-readiness/workflow/recovery-run")
        .send(requestBody)
        .expect(200);

      const body = response.body as RecoveryWorkflowRunHttpResponse;

      expect(fs.existsSync(body.workflowRun.workflowRunDir)).toBe(true);
      expect(fs.existsSync(body.workflowRun.manifestPath)).toBe(true);
      expect(fs.existsSync(body.workflowRun.directories.recovery)).toBe(true);
      expect(fs.existsSync(body.recoveryWrite.recoveryArtifactPath)).toBe(true);

      const responsePath = path.join(
        responsesDir,
        `${String(index + 2).padStart(2, "0")}_ws3_recovery_workflow_run_response_v1.json`,
      );
      writeJson(responsePath, {
        captured_at_utc: utcNowIso(),
        route: "/api/quantum-readiness/workflow/recovery-run",
        status_code: response.status,
        baseline_anchor_dir: anchor,
        normalized_candidate_dir: normalized.candidateDir,
        preparation_artifact_path: normalized.preparationArtifactPath,
        source_files: normalized.sourceFiles,
        response_json: body,
      });

      summaryRows.push({
        artifact_id: `${String(index + 2).padStart(2, "0")}_ws3_recovery_workflow_run`,
        route: "/api/quantum-readiness/workflow/recovery-run",
        status_code: response.status,
        pass: response.status === 200,
        request_file: path.relative(runDir, requestPath),
        response_file: path.relative(runDir, responsePath),
        note: `Real baseline-derived WS3 REST run from ${path.basename(anchor)}`,
      });
    }

    const summaryCsvPath = path.join(controlDir, "openpra_ws2_ws3_rest_evidence_summary_v1.csv");
    const summaryCsvLines = [
      "artifact_id,route,status_code,pass,request_file,response_file,note",
      ...summaryRows.map((row) =>
        [row.artifact_id, row.route, row.status_code, row.pass, row.request_file, row.response_file, row.note]
          .map(csvEscape)
          .join(","),
      ),
    ];
    writeText(summaryCsvPath, `${summaryCsvLines.join("\n")}\n`);

    const memoPath = path.join(controlDir, "openpra_ws2_ws3_rest_evidence_memo_v1.md");
    writeText(
      memoPath,
      [
        "# OpenPRA WS2 WS3 REST Evidence Memo v1",
        "",
        `Generated at UTC: ${utcNowIso()}`,
        "",
        "Purpose:",
        "Capture direct REST evidence for the preparation and recovery service paths.",
        "",
        "WS2 evidence:",
        "- Direct POST /api/quantum-readiness/workflow/preparation-run",
        "- Uses the authoritative controller HTTP spec graph fixture contract",
        "- Captures request and response JSON",
        "",
        "WS3 evidence:",
        "- Three direct POST /api/quantum-readiness/workflow/recovery-run calls",
        "- Inputs are normalized from real baseline-derived candidate directories discovered under _work",
        "- Captures request and response JSON for each case",
        "",
        "Boundary note:",
        "- The real 34-case baseline directories are already post-preparation artifact outputs.",
        "- For that reason, the direct WS2 REST capture uses the authoritative graph fixture contract while the selected real baseline-derived cases are tied in through their existing preparation artifacts and recovery inputs.",
        "",
        `Selected real baseline-derived anchors: ${selectedAnchors.length}`,
        ...selectedAnchors.map((anchor, idx) => `- ${idx + 1}. ${anchor}`),
      ].join("\n") + "\n",
    );

    const summaryJsonPath = path.join(controlDir, "openpra_ws2_ws3_rest_evidence_summary_v1.json");
    writeJson(summaryJsonPath, {
      artifact_name: "OPENPRA_WS2_WS3_REST_EVIDENCE_BUNDLE_v1",
      generated_at_utc: utcNowIso(),
      ws2_route: "/api/quantum-readiness/workflow/preparation-run",
      ws3_route: "/api/quantum-readiness/workflow/recovery-run",
      selected_real_baseline_anchor_count: selectedAnchors.length,
      selected_real_baseline_anchors: selectedAnchors,
      summary_rows: summaryRows,
    });

    const allFiles = [summaryCsvPath, memoPath, summaryJsonPath];
    walkDirectories(runDir, (dirPath) => {
      for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        if (!entry.isFile()) {
          continue;
        }
        const filePath = path.join(dirPath, entry.name);
        if (filePath.endsWith("openpra_ws2_ws3_rest_evidence_manifest_v1.json")) {
          continue;
        }
        if (filePath.endsWith("openpra_ws2_ws3_rest_evidence_manifest_v1.json.sha256")) {
          continue;
        }
        if (!allFiles.includes(filePath)) {
          allFiles.push(filePath);
        }
      }
    });

    for (const filePath of allFiles.sort()) {
      manifestFiles.push({
        relative_path: path.relative(runDir, filePath),
        sha256: sha256File(filePath),
        size_bytes: fs.statSync(filePath).size,
      });
    }

    const manifestPath = path.join(manifestsDir, "openpra_ws2_ws3_rest_evidence_manifest_v1.json");
    writeJson(manifestPath, {
      artifact_name: "OPENPRA_WS2_WS3_REST_EVIDENCE_MANIFEST_v1",
      generated_at_utc: utcNowIso(),
      file_count: manifestFiles.length,
      files: manifestFiles,
    });

    const manifestShaPath = path.join(manifestsDir, "openpra_ws2_ws3_rest_evidence_manifest_v1.json.sha256");
    writeText(manifestShaPath, `${sha256File(manifestPath)}  ${path.basename(manifestPath)}\n`);

    expect(summaryRows.every((row) => row.pass)).toBe(true);
  });
});
