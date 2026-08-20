import { createHighWindsPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/high-winds-pra-seed-factory";
import { groupHighWindsConformance, highWindsConformanceItems, highWindsConformanceScore } from "../highWindsPraConformance";

describe("High Winds PRA conformance", () => {
  it.each(["htgr", "sfr"] as const)("shows every applicable SR ready for the %s example", (variant) => {
    const items = highWindsConformanceItems(createHighWindsPraExample(variant));
    const score = highWindsConformanceScore(items);
    expect(items).toHaveLength(123);
    expect(score.warn).toBe(0);
    expect(score.blocked).toBe(0);
    expect(score.percent).toBe(100);
    expect(items.every((item) => !item.text.toLowerCase().includes("implementation pending") && !item.text.toLowerCase().includes("not implemented"))).toBe(true);
    expect(groupHighWindsConformance(items).map(([name]) => name)).toEqual(expect.arrayContaining([
      expect.stringContaining("WHA"), expect.stringContaining("WFR"), expect.stringContaining("WPR"),
    ]));
  });
});
