import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { seismicConformanceItems } from "../seismicPraConformance";
import { secondaryHazardFanSeries } from "../seismicPraHazardCharts";

describe("Seismic PRA Step 07 secondary hazards", () => {
  it.each(["htgr", "sfr"] as const)(
    "provides a complete site-specific hazard inventory for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const evaluation =
        mef.seismicHazardAnalysis.secondaryHazardEvaluation;
      const types = new Set(evaluation.hazards.map((hazard) => hazard.hazardType));

      expect(evaluation.hazards).toHaveLength(7);
      expect(types).toEqual(new Set([
        "FAULT_DISPLACEMENT",
        "LANDSLIDE",
        "SOIL_LIQUEFACTION",
        "SOIL_SETTLEMENT",
        "GROUND_FAILURE",
        "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING",
        "TSUNAMI_OR_SEICHE",
      ]));
      expect(evaluation.siteAndRegionalHazardListSources).toHaveLength(6);
      expect(evaluation.crossHazardDependencies).toHaveLength(3);
      expect(evaluation.hazards.every((hazard) =>
        hazard.description.length > 0
        && hazard.initiatingMechanisms.length > 0
        && hazard.siteEvidenceRefs.length >= 3
        && hazard.potentiallyAffectedArea.length > 0)).toBe(true);
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "screens six hazards and quantifies the retained liquefaction hazard for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const hazards =
        mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards;
      const screened = hazards.filter((hazard) =>
        hazard.screening.disposition === "SCREENED_OUT");
      const retained = hazards.find((hazard) =>
        hazard.screening.disposition === "RETAINED");

      expect(screened).toHaveLength(6);
      expect(screened.every((hazard) =>
        ["SCR-2", "SCR-3"].includes(hazard.screening.criterion)
        && hazard.screening.demonstrablyConservative
        && hazard.screening.methodology.length > 0
        && hazard.screening.screeningBasis.length > 0
        && hazard.screening.calculationsAndEvidenceRefs.length > 0)).toBe(true);

      expect(retained?.uuid).toBe("SECONDARY-LIQUEFACTION");
      expect(retained?.screening.criterion).toBe("NOT_SCREENED");
      expect(retained?.retainedAnalysis?.hazardCurves).toHaveLength(4);
      expect(retained?.retainedAnalysis?.hazardCurves.every((curve) =>
        curve.points.length === 9)).toBe(true);
      expect(retained?.retainedAnalysis?.failureMechanisms).toHaveLength(2);
      expect(retained?.retainedAnalysis?.uncertainties).toHaveLength(4);
      expect(retained?.retainedAnalysis?.dataAndModelRefs).toHaveLength(6);
      expect(retained?.retainedAnalysis?.affectedSeismicEquipmentListItemRefs)
        .toEqual(["SEL-SECONDARY"]);
    },
  );

  it("uses reactor-specific site conditions and displacement frequencies", () => {
    const htgr = createSeismicPraExample("htgr");
    const sfr = createSeismicPraExample("sfr");
    const retained = (mef: typeof htgr) =>
      mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards
        .find((hazard) => hazard.uuid === "SECONDARY-LIQUEFACTION")!;
    const mean = (mef: typeof htgr) =>
      retained(mef).retainedAnalysis!.hazardCurves
        .find((curve) => curve.statistic === "MEAN")!;

    expect(retained(htgr).potentiallyAffectedArea).toContain("RCCS");
    expect(retained(sfr).potentiallyAffectedArea).toContain("decay-heat-removal");
    expect(mean(htgr).points[0]?.annualFrequencyOfExceedance)
      .not.toBe(mean(sfr).points[0]?.annualFrequencyOfExceedance);
    expect(
      htgr.seismicHazardAnalysis.secondaryHazardEvaluation.hazards
        .find((hazard) => hazard.hazardType === "FAULT_DISPLACEMENT")
        ?.screening.screeningBasis,
    ).toContain("46 km");
    expect(
      sfr.seismicHazardAnalysis.secondaryHazardEvaluation.hazards
        .find((hazard) => hazard.hazardType === "FAULT_DISPLACEMENT")
        ?.screening.screeningBasis,
    ).toContain("31 km");
  });

  it.each(["htgr", "sfr"] as const)(
    "builds an ordered 5th-to-95th distribution fan for %s",
    (variant) => {
      const retained = createSeismicPraExample(variant)
        .seismicHazardAnalysis.secondaryHazardEvaluation.hazards
        .find((hazard) => hazard.uuid === "SECONDARY-LIQUEFACTION")
        ?.retainedAnalysis;
      const series = secondaryHazardFanSeries(retained?.hazardCurves ?? []);

      expect(series).toHaveLength(9);
      expect(series.every((point, index) =>
        point.x > 0
        && (index === 0 || point.x > series[index - 1]!.x)
        && point.low <= point.median
        && point.median <= point.mean
        && point.mean <= point.high)).toBe(true);
    },
  );

  it("returns a truthful empty fan when a required fractile is missing", () => {
    const retained = createSeismicPraExample("htgr")
      .seismicHazardAnalysis.secondaryHazardEvaluation.hazards
      .find((hazard) => hazard.uuid === "SECONDARY-LIQUEFACTION")
      ?.retainedAnalysis;
    const curves = retained?.hazardCurves.filter((curve) =>
      curve.fractile !== 0.95) ?? [];

    expect(secondaryHazardFanSeries(curves)).toEqual([]);
  });
});

describe("Seismic PRA HLR-H readiness", () => {
  function statuses(variant: "htgr" | "sfr"): Record<string, string> {
    return Object.fromEntries(
      seismicConformanceItems(createSeismicPraExample(variant))
        .filter((item) => item.id.startsWith("SHA-H"))
        .map((item) => [item.id, item.status]),
    );
  }

  it.each(["htgr", "sfr"] as const)(
    "reports the conditional HLR-H requirements correctly for %s",
    (variant) => {
      expect(statuses(variant)).toEqual({
        "SHA-H1": "ok",
        "SHA-H2": "ok",
        "SHA-H3": "ok",
        "SHA-H4": "na",
      });
    },
  );

  it("requires a complete hazard-class inventory for SHA-H1", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards =
      mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards
        .filter((hazard) => hazard.hazardType !== "FAULT_DISPLACEMENT");

    expect(seismicConformanceItems(mef)
      .find((item) => item.id === "SHA-H1")?.status).toBe("warn");
  });

  it("requires a conservative technical screening basis for SHA-H2", () => {
    const mef = createSeismicPraExample("sfr");
    mef.seismicHazardAnalysis.secondaryHazardEvaluation.hazards[0]!
      .screening.screeningBasis = "";

    expect(seismicConformanceItems(mef)
      .find((item) => item.id === "SHA-H2")?.status).toBe("warn");
  });

  it("requires curves, uncertainty, SEL links, and outputs for SHA-H3", () => {
    const mef = createSeismicPraExample("htgr");
    const retained = mef.seismicHazardAnalysis.secondaryHazardEvaluation
      .hazards.find((hazard) => hazard.uuid === "SECONDARY-LIQUEFACTION")
      ?.retainedAnalysis;
    if (retained !== undefined) retained.outputRefs = [];

    expect(seismicConformanceItems(mef)
      .find((item) => item.id === "SHA-H3")?.status).toBe("warn");
  });

  it("requires the full XFHA interface when flooding is retained", () => {
    const mef = createSeismicPraExample("sfr");
    const flood = mef.seismicHazardAnalysis.secondaryHazardEvaluation
      .hazards.find((hazard) =>
        hazard.hazardType === "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING")!;
    const liquefaction = mef.seismicHazardAnalysis.secondaryHazardEvaluation
      .hazards.find((hazard) => hazard.uuid === "SECONDARY-LIQUEFACTION")!;
    flood.screening.disposition = "RETAINED";
    flood.screening.criterion = "NOT_SCREENED";
    flood.retainedAnalysis = liquefaction.retainedAnalysis;

    expect(seismicConformanceItems(mef)
      .find((item) => item.id === "SHA-H4")?.status).toBe("warn");
  });
});
