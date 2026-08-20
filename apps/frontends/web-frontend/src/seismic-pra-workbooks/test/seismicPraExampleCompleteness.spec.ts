import { validateSeismicPra } from "interfaces-mef-types/seismic/seismic-pra-validation";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { seismicConformanceItems } from "../seismicPraConformance";

function emptyStringPaths(value: unknown, path = ""): string[] {
  if (value === "") return [path];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => emptyStringPaths(item, `${path}[${index}]`));
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      emptyStringPaths(item, path.length > 0 ? `${path}.${key}` : key),
    );
  }
  return [];
}

describe("complete Seismic PRA examples", () => {
  it.each(["htgr", "sfr"] as const)(
    "produces a complete, internally valid %s workbook",
    (variant) => {
      const mef = createSeismicPraExample(variant);

      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
      expect(validateSeismicPra(mef)).toEqual([]);
      expect(emptyStringPaths(mef)).toEqual([]);
      expect(mef.conformanceMatrix).toHaveLength(109);
      expect(
        mef.conformanceMatrix.filter((row) => row.status === "NOT_APPLICABLE"),
      ).toHaveLength(variant === "sfr" ? 8 : 7);
      expect(
        mef.conformanceMatrix.every(
          (row) => row.status === "MET" || row.status === "NOT_APPLICABLE",
        ),
      ).toBe(true);
      expect(
        mef.conformanceMatrix.every(
          (row) =>
            row.satisfiedByElementPaths.length === 1 &&
            row.satisfiedByElementPaths[0]!.split(".").length >= 2 &&
            row.evidence.includes(row.sr),
        ),
      ).toBe(true);
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "labels the %s values as illustrative rather than licensing data",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const limitations = mef.metadata.limitations.join(" ");

      expect(limitations).toContain("illustrative fictional reference design and site");
      expect(limitations).toContain("not suitable for licensing or safety decisions");
      expect(mef.seismicHazardAnalysis.documentation.limitations).toEqual(
        mef.metadata.limitations,
      );
      expect(mef.evidenceRegister).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ uuid: "EVIDENCE-NON-LWR-STANDARD" }),
          expect.objectContaining({ uuid: "EVIDENCE-SSHAC-GUIDANCE" }),
          expect.objectContaining({ uuid: "EVIDENCE-USGS-2023-NSHM" }),
          expect.objectContaining({
            uuid: `EVIDENCE-REACTOR-BASIS-${variant.toUpperCase()}`,
          }),
        ]),
      );
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "documents the full structured hazard and multidisciplinary review process for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const process = mef.seismicHazardAnalysis.analysisBasis.structuredProcess;

      expect(process.participants).toHaveLength(6);
      expect(new Set(process.participants.map((participant) => participant.role))).toEqual(
        new Set([
          "PROJECT_MANAGER",
          "TECHNICAL_INTEGRATOR",
          "EVALUATOR_EXPERT",
          "PEER_REVIEWER",
        ]),
      );
      expect(process.activities.map((activity) => activity.activityType)).toEqual([
        "PLANNING",
        "DATA_EVALUATION",
        "WORKSHOP",
        "MODEL_DEVELOPMENT",
        "INTEGRATION",
        "REVIEW",
      ]);
      expect(mef.metadata.reviewers).toHaveLength(3);
      expect(mef.activePeerReviewIds).toEqual(["SEISMIC-PEER-REVIEW-2026"]);
      expect(
        mef.seismicHazardAnalysis.documentation.reviewRecordRefs,
      ).toHaveLength(4);
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "documents model uncertainty and alternatives through SHA, SFR, and SPR for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const uncertaintyDocuments = [
        mef.modelUncertainty,
        mef.seismicHazardAnalysis.modelUncertainty,
        mef.seismicFragilityAnalysis.modelUncertainty,
        mef.seismicPlantResponseAnalysis.modelUncertainty,
      ];

      expect(
        uncertaintyDocuments.every(
          (document) =>
            document.uncertaintySources.length >= 3 &&
            document.relatedAssumptions.length >= 1 &&
            document.reasonableAlternatives.length >= 2,
        ),
      ).toBe(true);
    },
  );

  it("uses consistent identified-site coordinates and western-US tectonic models", () => {
    const htgr = createSeismicPraExample("htgr");
    const sfr = createSeismicPraExample("sfr");
    const htgrSha = htgr.seismicHazardAnalysis;
    const sfrSha = sfr.seismicHazardAnalysis;

    expect(htgrSha.analysisBasis.site).toMatchObject({
      boundsAllSitesInScope: false,
      location: { latitude: 35.642, longitude: -112.284, elevation: 1460 },
    });
    expect(sfrSha.analysisBasis.site).toMatchObject({
      boundsAllSitesInScope: false,
      location: { latitude: 43.186, longitude: -116.421, elevation: 812 },
    });
    expect(
      htgrSha.responseSpectraEvaluation.controlPoints.find(
        (point) => point.controlPointType === "FREE_FIELD",
      )?.coordinateReference,
    ).toBe("35.6420 N, 112.2840 W");
    expect(
      sfrSha.responseSpectraEvaluation.controlPoints.find(
        (point) => point.controlPointType === "FREE_FIELD",
      )?.coordinateReference,
    ).toBe("43.1860 N, 116.4210 W");

    for (const sha of [htgrSha, sfrSha]) {
      const modelText = [
        ...sha.groundMotionCharacterization.predictionModels.map(
          (model) => `${model.uuid} ${model.name} ${model.tectonicRegionTypes.join(" ")}`,
        ),
        sha.earthScienceInputs.studyRegions[0]?.tectonicSetting ?? "",
      ].join(" ");
      expect(modelText).not.toContain("NGA-East");
      expect(modelText.toLowerCase()).not.toContain("stable continental");
      expect(modelText).toContain("USGS 2023");
    }
    expect(
      seismicConformanceItems(htgr).find((item) => item.id === "SHA-I3"),
    ).toMatchObject({
      status: "na",
      meta: "Not applicable to an identified-site PRA",
    });
    expect(
      seismicConformanceItems(sfr).find((item) => item.id === "SHA-I3"),
    ).toMatchObject({
      status: "na",
      meta: "Not applicable to an identified-site PRA",
    });
  });

  it("keeps the fictional source geometry separate from real regional analog events", () => {
    const htgr = createSeismicPraExample("htgr").seismicHazardAnalysis;
    const sfr = createSeismicPraExample("sfr").seismicHazardAnalysis;

    expect(htgr.sourceCharacterization.earthquakeSources.map((source) => source.name)).toEqual(
      expect.arrayContaining([
        "Cedar Basin local fault zone",
        "Colorado Plateau transition source region",
      ]),
    );
    expect(sfr.sourceCharacterization.earthquakeSources.map((source) => source.name)).toEqual(
      expect.arrayContaining([
        "Pioneer Mesa local fault zone",
        "Central Idaho extensional source system",
      ]),
    );
    expect(
      sfr.earthScienceInputs.earthquakeCatalog.events.map((event) => event.locationDescription),
    ).toEqual(
      expect.arrayContaining(["Borah Peak earthquake", "Stanley earthquake"]),
    );
    expect(
      [...htgr.earthScienceInputs.earthquakeCatalog.events,
        ...sfr.earthScienceInputs.earthquakeCatalog.events]
        .filter((event) => event.recordType === "PALEOSEISMIC")
        .every((event) => event.locationDescription.startsWith("Illustrative")),
    ).toBe(true);
  });
});
