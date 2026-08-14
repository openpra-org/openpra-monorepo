import { createOtherHazardsPraSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/other-hazards-pra-seed-factory";
import {
  groupOtherHazardsConformance,
  otherHazardsConformanceItems,
  otherHazardsConformanceScore,
} from "../otherHazardsPraConformance";

describe("Other Hazards PRA conformance", () => {
  it.each(["HTGR", "SFR"] as const)("shows every applicable SR ready for the %s example", (variant) => {
    const items = otherHazardsConformanceItems(createOtherHazardsPraSeed(variant));
    const score = otherHazardsConformanceScore(items);

    expect(items).toHaveLength(53);
    expect(score).toMatchObject({ met: 53, applicable: 53, warn: 0, blocked: 0, percent: 100 });
    expect(items.every((item) => !/implementation pending|not implemented/i.test(item.text))).toBe(true);
    expect(groupOtherHazardsConformance(items).map(([name]) => name)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("OHA"),
        expect.stringContaining("OFR"),
        expect.stringContaining("OPR"),
      ]),
    );
  });
});
