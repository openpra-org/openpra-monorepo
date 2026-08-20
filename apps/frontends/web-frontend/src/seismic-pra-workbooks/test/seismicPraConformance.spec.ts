import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { seismicConformanceItems } from "../seismicPraConformance";

function hlrBStatuses(variant: "htgr" | "sfr"): Record<string, string> {
  return Object.fromEntries(
    seismicConformanceItems(createSeismicPraExample(variant))
      .filter((item) => item.id.startsWith("SHA-B"))
      .map((item) => [item.id, item.status]),
  );
}

describe("Seismic PRA HLR-B readiness", () => {
  it.each(["htgr", "sfr"] as const)("reports complete evidence coverage for %s", (variant) => {
    expect(hlrBStatuses(variant)).toEqual({
      "SHA-B1": "ok",
      "SHA-B2": "ok",
      "SHA-B3": "ok",
      "SHA-B4": "ok",
      "SHA-B5": "ok",
    });
  });

  it("requires an assessed model and method inventory for SHA-B4", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.earthScienceInputs.modelAndMethodInventory = [];

    const items = seismicConformanceItems(mef);
    expect(items.find((item) => item.id === "SHA-B4")?.status).toBe("warn");
    expect(items.find((item) => item.id === "SHA-B3")?.status).toBe("ok");
    expect(items.find((item) => item.id === "SHA-B5")?.status).toBe("ok");
  });

  it("requires historical, instrumental, and paleoseismic catalog coverage for SHA-B5", () => {
    const mef = createSeismicPraExample("sfr");
    mef.seismicHazardAnalysis.earthScienceInputs.earthquakeCatalog.events =
      mef.seismicHazardAnalysis.earthScienceInputs.earthquakeCatalog.events
        .filter((event) => event.recordType !== "PALEOSEISMIC");

    const items = seismicConformanceItems(mef);
    expect(items.find((item) => item.id === "SHA-B5")?.status).toBe("warn");
    expect(items.find((item) => item.id === "SHA-B4")?.status).toBe("ok");
  });

  it("requires the four core disciplines and currentness review for SHA-B1", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.earthScienceInputs.dataSets =
      mef.seismicHazardAnalysis.earthScienceInputs.dataSets
        .filter((dataSet) => dataSet.discipline !== "GEOPHYSICS");

    const item = seismicConformanceItems(mef).find((candidate) => candidate.id === "SHA-B1");
    expect(item?.status).toBe("warn");
  });
});

describe("Seismic PRA HLR-C and HLR-D readiness", () => {
  it.each(["htgr", "sfr"] as const)("reports complete source and ground-motion coverage for %s", (variant) => {
    const statuses = Object.fromEntries(
      seismicConformanceItems(createSeismicPraExample(variant))
        .filter((item) => item.id.startsWith("SHA-C") || item.id.startsWith("SHA-D"))
        .map((item) => [item.id, item.status]),
    );

    expect(statuses).toEqual({
      "SHA-C1": "ok",
      "SHA-C2": "ok",
      "SHA-C3": "ok",
      "SHA-C4": "ok",
      "SHA-C5": "ok",
      "SHA-D1": "ok",
      "SHA-D2": "ok",
      "SHA-D3": "ok",
      "SHA-D4": "ok",
    });
  });

  it("requires weighted source uncertainty branches for SHA-C3", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.sourceCharacterization.sourceLogicTree.nodes = [];

    expect(seismicConformanceItems(mef).find((item) => item.id === "SHA-C3")?.status).toBe("warn");
  });

  it("requires update justification when an existing source model is revised", () => {
    const mef = createSeismicPraExample("sfr");
    const assessment = mef.seismicHazardAnalysis.sourceCharacterization.existingModelAssessments[0];
    if (assessment !== undefined) assessment.updateJustification = "";

    expect(seismicConformanceItems(mef).find((item) => item.id === "SHA-C5")?.status).toBe("warn");
  });

  it("requires strong-motion data and balanced prediction-model weights", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.groundMotionCharacterization.strongMotionDataSets = [];
    mef.seismicHazardAnalysis.groundMotionCharacterization.predictionModels[0]!.logicTreeWeight = 0.8;
    const items = seismicConformanceItems(mef);

    expect(items.find((item) => item.id === "SHA-D1")?.status).toBe("warn");
    expect(items.find((item) => item.id === "SHA-D3")?.status).toBe("warn");
  });
});

describe("Seismic PRA HLR-E readiness", () => {
  it.each(["htgr", "sfr"] as const)("reports the identified-site requirements correctly for %s", (variant) => {
    const statuses = Object.fromEntries(
      seismicConformanceItems(createSeismicPraExample(variant))
        .filter((item) => item.id.startsWith("SHA-E"))
        .map((item) => [item.id, item.status]),
    );

    expect(statuses).toEqual({
      "SHA-E1": "ok",
      "SHA-E2": "na",
      "SHA-E3": "ok",
      "SHA-E4": "na",
      "SHA-E5": "ok",
      "SHA-E6": "na",
    });
  });

  it("requires documented conditions and material properties for SHA-E1", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.siteResponseAnalysis.topographyAndGeology.topographicDescription = "";

    expect(seismicConformanceItems(mef).find((item) => item.id === "SHA-E1")?.status).toBe("warn");
  });

  it("requires propagated uncertainty for SHA-E3", () => {
    const mef = createSeismicPraExample("sfr");
    mef.seismicHazardAnalysis.siteResponseAnalysis.uncertainties = [];

    expect(seismicConformanceItems(mef).find((item) => item.id === "SHA-E3")?.status).toBe("warn");
  });

  it("requires justified methods and linked inputs for SHA-E5", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.siteResponseAnalysis.methods[0]!.dimensionSelectionBasis = "";

    expect(seismicConformanceItems(mef).find((item) => item.id === "SHA-E5")?.status).toBe("warn");
  });
});
