import { runOpenPraQuantumMcsMapping } from "./openpra-quantum-platform-mcs-mapping";

describe("OpenPRA MCS mapping stub", () => {
  it("returns not implemented", () => {
    const result = runOpenPraQuantumMcsMapping({
      recoveredBitstrings: { "000": 10 },
    });

    expect(result.mappingStatus).toBe("not_implemented");
    expect(Object.keys(result.mappedCutSets).length).toBe(0);
  });
});
