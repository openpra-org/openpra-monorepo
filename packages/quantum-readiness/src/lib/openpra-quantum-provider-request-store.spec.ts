import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createOpenPraQuantumProviderExecutionRequest } from "./openpra-quantum-provider-request-contract";
import {
  loadLatestOpenPraQuantumProviderExecutionRequest,
  persistOpenPraQuantumProviderExecutionRequest,
} from "./openpra-quantum-provider-request-store";

describe("openpra-quantum-provider-request-store", () => {
  it("persists and loads a provider execution request", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-provider-request-"));

    const request = createOpenPraQuantumProviderExecutionRequest({
      requestId: "provider-request-0698",
      subtreeId: "G:G348",
      caseLabel: "phase2b_row_0698__G_G348",
      providerName: "ibm_runtime",
      backendName: "ibm_torino",
      shots: 8192,
      resilienceLevel: 0,
      createdAtUtc: "2026-04-17T17:03:17.743Z",
      notes: "WS6 exact path request",
    });

    const persisted = persistOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      request,
      inputArtifactPaths: [],
      scriptVersion: "openpra-quantum-provider-request-store.spec",
    });

    const loaded = loadLatestOpenPraQuantumProviderExecutionRequest({
      rootDirectoryPath: tempDir,
      caseLabel: "phase2b_row_0698__G_G348",
    });

    expect(loaded.request.requestId).toBe("provider-request-0698");
    expect(loaded.request.backendName).toBe("ibm_torino");
    expect(fs.existsSync(persisted.requestPath)).toBe(true);
    expect(fs.existsSync(persisted.provenanceManifestPath)).toBe(true);
  });
});
