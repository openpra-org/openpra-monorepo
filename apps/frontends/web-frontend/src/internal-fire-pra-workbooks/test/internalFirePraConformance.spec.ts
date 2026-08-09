import { createInternalFirePraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/internal-fire-pra-seed-factory";
import { groupInternalFireConformance, internalFireConformanceItems, internalFireConformanceScore } from "../internalFirePraConformance";

describe("Internal Fire PRA conformance", () => {
  it.each(["htgr", "sfr"] as const)("shows every applicable SR ready for the %s example", (variant) => {
    const items = internalFireConformanceItems(createInternalFirePraExample(variant));
    const score = internalFireConformanceScore(items);
    expect(items).toHaveLength(165);
    expect(score.warn).toBe(0);
    expect(score.blocked).toBe(0);
    expect(score.percent).toBe(100);
    expect(items.every((item) => !item.text.includes("implementation pending") && !item.text.includes("implementing record"))).toBe(true);
    expect(groupInternalFireConformance(items).map(([name]) => name)).toEqual(expect.arrayContaining([
      expect.stringContaining("FPP"), expect.stringContaining("FES"), expect.stringContaining("FCS"), expect.stringContaining("FQLS"), expect.stringContaining("FPRM"),
      expect.stringContaining("FSS"), expect.stringContaining("FIGN"), expect.stringContaining("FCF"), expect.stringContaining("FHR"), expect.stringContaining("FESQ"),
    ]));
  });
});
