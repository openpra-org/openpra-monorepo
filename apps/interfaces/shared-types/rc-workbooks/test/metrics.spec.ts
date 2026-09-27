import { RcConsequenceMetricSchema, RcConsequenceMetricsSchema } from "interfaces-mef-types/zod/rc/metrics";
import type { RcConsequenceMetric } from "interfaces-mef-types/rc/metrics";
import {
  RC_METRIC_DEFAULT_EXCLUSION,
  blankRcMetric,
  nextRcMetricId,
  rcAspectDecision,
  rcMetricAspects,
  rcProtectiveActionsNeeded,
  rcMetricIssues,
  rcMetricNumberList,
  rcMetricOpenRcSupport,
  rcMetricPresets,
  rcMetricReceptorText,
  rcMetricStatisticsText,
  rcMetricUnit,
  rcMetricWindowText,
} from "../metrics";

const preset = (key: string): RcConsequenceMetric => {
  const found = rcMetricPresets.find((item) => item.key === key);
  if (found === undefined) throw new Error(`Missing preset ${key}`);
  return { id: "RCM-01", ...found.metric };
};

describe("Consequence metric presets", () => {
  it("are complete, valid records with the published definitions", () => {
    expect(rcMetricPresets.map((item) => item.key)).toEqual(["lmp-fc", "epz", "qho-early", "qho-latent"]);
    for (const item of rcMetricPresets) {
      const metric = preset(item.key);
      expect(RcConsequenceMetricSchema.safeParse(metric).success).toBe(true);
      expect(rcMetricIssues(metric)).toEqual([]);
    }
    const lmp = preset("lmp-fc"), epz = preset("epz"), early = preset("qho-early"), latent = preset("qho-latent");
    expect(lmp.window).toEqual({ seconds: 2592000, start: "RELEASE_ONSET" });
    expect(epz.window).toEqual({ seconds: 345600, start: "RELEASE_ONSET" });
    expect(early.receptor).toEqual({ kind: "AVERAGE_BEYOND_EAB", distanceKm: 1.609344 });
    expect(latent.receptor).toEqual({ kind: "AVERAGE_BEYOND_EAB", distanceKm: 16.09344 });
    expect(rcMetricWindowText(lmp.window)).toBe("30 days from release onset");
    expect(rcMetricWindowText(epz.window)).toBe("96 hours from release onset");
    expect(rcMetricReceptorText(early.receptor)).toBe("Average individual within 1.609 km (1 mi) of the EAB");
    expect(rcMetricReceptorText(latent.receptor)).toBe("Average individual within 16.09 km (10 mi) of the EAB");
    expect(rcMetricReceptorText({ kind: "WITHIN_RADIUS", radiusKm: 80 })).toBe("Everyone within 80 km of the release");
    expect(rcMetricStatisticsText(lmp)).toBe("Mean · 5th, 50th, 95th percentiles · Chance of exceeding 0.001 Sv (100 mrem)");
    expect(rcMetricStatisticsText(epz)).toBe("Mean · 50th, 95th percentiles · Chance of exceeding 0.01 Sv (1 rem)");
  });

  it("states which metrics OpenRC can serve today", () => {
    expect(rcMetricOpenRcSupport(preset("lmp-fc")).status).toBe("YES");
    expect(rcMetricOpenRcSupport(preset("epz")).status).toBe("YES");
    expect(rcMetricOpenRcSupport(preset("qho-early"))).toEqual({ status: "NO", reason: "OpenRC has no health-effect model yet." });
    expect(rcMetricOpenRcSupport({ ...preset("lmp-fc"), protectiveActionsCredited: true })).toEqual({ status: "NO", reason: "OpenRC has no protective-action model yet." });
    expect(rcMetricOpenRcSupport({ id: "RCM-02", ...blankRcMetric }).status).toBe("UNKNOWN");
  });
});

describe("Metric-driven evaluation aspects", () => {
  it("requires the aspects a metric needs and defaults the rest to excluded", () => {
    const lmp = preset("lmp-fc"), early = { ...preset("qho-early"), id: "RCM-02" };
    expect(rcMetricAspects(lmp)).toEqual(["RCPA", "RCME", "RCAD", "RCDO", "RCQ"]);
    expect(rcMetricAspects(early)).toContain("RCHE");
    expect(rcMetricAspects({ ...lmp, quantity: "ECONOMIC_COST" })).toContain("RCEC");
    const scope = { metrics: [lmp], evaluationDecisions: [{ subElement: "RCAD" as const, included: false, exclusionReason: "Old choice" }] };
    expect(rcAspectDecision(scope, "RCAD")).toMatchObject({ included: true, required: true, neededBy: [lmp] });
    expect(rcAspectDecision(scope, "RCHE")).toEqual({ included: false, required: false, neededBy: [], exclusionReason: RC_METRIC_DEFAULT_EXCLUSION, defaulted: true });
    expect(rcAspectDecision({ ...scope, evaluationDecisions: [{ subElement: "RCHE", included: true }] }, "RCHE")).toMatchObject({ included: true, required: false, defaulted: false });
    expect(rcAspectDecision({ metrics: [lmp, early] }, "RCHE")).toMatchObject({ included: true, required: true, neededBy: [early] });
  });

  it("leaves aspects unset without metrics or with custom measures", () => {
    const custom = { id: "RCM-01", ...blankRcMetric };
    expect(rcAspectDecision({ metrics: [] }, "RCEC").included).toBeUndefined();
    expect(rcAspectDecision({ metrics: [custom] }, "RCEC").included).toBeUndefined();
    expect(rcAspectDecision({ metrics: [custom], evaluationDecisions: [{ subElement: "RCEC", included: false, exclusionReason: "Dose only" }] }, "RCEC"))
      .toMatchObject({ included: false, exclusionReason: "Dose only" });
  });

  it("asks for protective actions only when a metric credits them", () => {
    expect(rcProtectiveActionsNeeded(undefined)).toBe(true);
    expect(rcProtectiveActionsNeeded([preset("lmp-fc"), { ...preset("epz"), id: "RCM-02" }])).toBe(false);
    expect(rcProtectiveActionsNeeded([preset("lmp-fc"), { ...preset("qho-latent"), id: "RCM-02" }])).toBe(true);
    expect(rcProtectiveActionsNeeded([{ id: "RCM-01", ...blankRcMetric }])).toBe(true);
  });
});

describe("Consequence metric records", () => {
  it("lists what a new custom metric still needs", () => {
    const metric: RcConsequenceMetric = { id: "RCM-01", ...blankRcMetric };
    expect(rcMetricIssues(metric)).toEqual(["Name the metric.", "Give the unit of the custom measure.", "Describe the receptors.", "State the criterion or use.", "Cite the basis."]);
    expect(rcMetricUnit({ ...metric, customUnit: "index per event" })).toBe("index per event");
    expect(rcMetricIssues({ ...preset("qho-early"), receptor: { kind: "AVERAGE_BEYOND_EAB" }, window: undefined, statistics: { mean: false, percentiles: [], exceedanceThresholds: [] } }))
      .toEqual(["Set the distance beyond the EAB.", "Set the exposure window.", "Choose at least one statistic."]);
  });

  it("numbers new metrics and cleans typed lists", () => {
    expect(nextRcMetricId([])).toBe("RCM-01");
    expect(nextRcMetricId([preset("lmp-fc"), { ...preset("epz"), id: "RCM-07" }, { ...preset("epz"), id: "OTHER" }])).toBe("RCM-08");
    expect(rcMetricNumberList("95, 5, 50, 5, 120, x", (value) => value > 0 && value < 100)).toEqual([5, 50, 95]);
    expect(rcMetricWindowText({ seconds: 1577880000, start: "PLUME_ARRIVAL" })).toBe("50 years from plume arrival at the receptor");
    expect(rcMetricWindowText({ seconds: 86400, start: "RELEASE_ONSET" })).toBe("24 hours from release onset");
  });

  it("rejects duplicate identifiers and invalid statistics", () => {
    expect(RcConsequenceMetricsSchema.safeParse([preset("lmp-fc"), preset("epz")]).success).toBe(false);
    expect(RcConsequenceMetricSchema.safeParse({ ...preset("lmp-fc"), statistics: { mean: true, percentiles: [100], exceedanceThresholds: [] } }).success).toBe(false);
    expect(RcConsequenceMetricSchema.safeParse({ ...preset("lmp-fc"), statistics: { mean: true, percentiles: [5, 5], exceedanceThresholds: [] } }).success).toBe(false);
    expect(RcConsequenceMetricSchema.safeParse({ ...preset("lmp-fc"), window: { seconds: 0, start: "RELEASE_ONSET" } }).success).toBe(false);
  });
});
