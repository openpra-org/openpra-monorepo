import { createExternalFloodPraSeed } from "../../../../../backends/web-backend/src/example-workbooks/seeds/external-flood-pra-seed-factory";
import { externalFloodConformanceItems, externalFloodConformanceScore } from "../externalFloodPraConformance";

describe("External Flood PRA conformance", () => {
  it.each(["HTGR", "SFR"] as const)("covers the complete %s example SR catalog", (variant) => {
    const items = externalFloodConformanceItems(createExternalFloodPraSeed(variant));
    const score = externalFloodConformanceScore(items);
    expect(items).toHaveLength(109);
    expect(score).toMatchObject({ met: 109, applicable: 109, blocked: 0, warn: 0, percent: 100 });
    expect(items.map((item) => item.section).join(" ")).toContain("XFHA");
    expect(items.map((item) => item.section).join(" ")).toContain("XFFR");
    expect(items.map((item) => item.section).join(" ")).toContain("XFPR");
  });
});
