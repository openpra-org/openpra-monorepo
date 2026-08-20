import { createInternalFloodPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/internal-flood-pra-seed-factory";
import { groupInternalFloodConformance, internalFloodConformanceItems, internalFloodConformanceScore } from "../internalFloodPraConformance";

describe("Internal Flood PRA conformance", () => {
  it.each(["htgr", "sfr"] as const)("shows every applicable SR ready for the %s example", (variant) => {
    const items = internalFloodConformanceItems(createInternalFloodPraExample(variant));
    const score = internalFloodConformanceScore(items);
    expect(items).toHaveLength(108);
    expect(score).toEqual({ met: 107, applicable: 107, warn: 0, blocked: 0, na: 1, percent: 100 });
    expect(items.every((item) => !item.text.includes("implementation pending") && !item.text.includes("implementing record"))).toBe(true);
    expect(groupInternalFloodConformance(items).map(([name]) => name)).toEqual(expect.arrayContaining([
      expect.stringContaining("FLPP"), expect.stringContaining("FLSO"), expect.stringContaining("FLSN"),
      expect.stringContaining("FLEV"), expect.stringContaining("FLPR"), expect.stringContaining("FLHR"), expect.stringContaining("FLESQ"),
    ]));
  });
});
