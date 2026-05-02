import { mapOpenPraQuantumBitstringToCandidateMcs } from "./openpra-quantum-platform-semantic-mcs-mapping";

const variableMap = [
  { bitIndex: 0, basicEventId: "BE0" },
  { bitIndex: 1, basicEventId: "BE1" },
  { bitIndex: 2, basicEventId: "BE2" },
  { bitIndex: 3, basicEventId: "BE3" },
];

describe("OpenPRA semantic MCS mapping", () => {
  it("maps declared orientation bitstrings to active basic events", () => {
    const result = mapOpenPraQuantumBitstringToCandidateMcs({
      bitstring: "1010",
      variableMap,
      orientation: "declared",
    });

    expect(result.mappingStatus).toBe("mapped");
    expect(result.activeBasicEvents).toEqual(["BE0", "BE2"]);
  });

  it("maps reversed orientation bitstrings to active basic events", () => {
    const result = mapOpenPraQuantumBitstringToCandidateMcs({
      bitstring: "1010",
      variableMap,
      orientation: "reversed",
    });

    expect(result.mappingStatus).toBe("mapped");
    expect(result.activeBasicEvents).toEqual(["BE1", "BE3"]);
  });

  it("maps all zero bitstring to empty candidate set", () => {
    const result = mapOpenPraQuantumBitstringToCandidateMcs({
      bitstring: "0000",
      variableMap,
      orientation: "declared",
    });

    expect(result.mappingStatus).toBe("mapped");
    expect(result.activeBasicEvents).toEqual([]);
  });

  it("rejects nonbinary bitstrings", () => {
    const result = mapOpenPraQuantumBitstringToCandidateMcs({
      bitstring: "10X0",
      variableMap,
      orientation: "declared",
    });

    expect(result.mappingStatus).toBe("invalid_input");
    expect(result.errors).toContain("bitstring must be a nonempty binary string");
  });

  it("rejects invalid variable maps", () => {
    const result = mapOpenPraQuantumBitstringToCandidateMcs({
      bitstring: "1010",
      variableMap: [{ bitIndex: 99, basicEventId: "BAD" }],
      orientation: "declared",
    });

    expect(result.mappingStatus).toBe("invalid_input");
    expect(result.errors).toContain("variableMap contains invalid entry");
  });
});
