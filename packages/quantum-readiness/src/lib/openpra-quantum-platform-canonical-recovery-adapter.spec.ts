import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { runOpenPraQuantumCanonicalRecovery } from "./openpra-quantum-platform-canonical-recovery-adapter";

function makeTempPayload(counts: Record<string, number>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "openpra-recovery-"));
  const file = path.join(dir, "payload.json");
  fs.writeFileSync(file, JSON.stringify({ counts }, null, 2));
  return file;
}

describe("OpenPRA canonical recovery adapter", () => {
  it("recovers bitstrings from valid payload", () => {
    const payloadPath = makeTempPayload({ "00000000": 10, "11111111": 5 });

    const result = runOpenPraQuantumCanonicalRecovery({
      rawResultEnvelope: {
        backendRawPayload: {
          rawPayloadPath: payloadPath,
        },
      },
    });

    expect(result.recoveryStatus).toBe("recovered");
    expect(result.recoveredBitstrings["00000000"]).toBe(10);
  });

  it("handles empty counts", () => {
    const payloadPath = makeTempPayload({});

    const result = runOpenPraQuantumCanonicalRecovery({
      rawResultEnvelope: {
        backendRawPayload: {
          rawPayloadPath: payloadPath,
        },
      },
    });

    expect(result.recoveryStatus).toBe("no_signal");
  });

  it("rejects invalid input", () => {
    const result = runOpenPraQuantumCanonicalRecovery({
      rawResultEnvelope: null as any,
    });

    expect(result.recoveryStatus).toBe("invalid_input");
  });
});
