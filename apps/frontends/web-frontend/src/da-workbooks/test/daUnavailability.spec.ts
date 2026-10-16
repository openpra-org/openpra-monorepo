import type { DataAnalysis, DataAnalysisParameter, DaRestorationPart, DaSource, DaSourceEntry, DaSourceUse } from "interfaces-mef-types/da/data-analysis";
import { DA_ANALYSIS_HTGR } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed-htgr";
import { DA_ANALYSIS } from "../../../../../backends/web-backend/src/example-workbooks/seeds/da-seed";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { parameterPoint, pointState, readyNumber } from "../daLaws";
import { maintenanceEstimate, maintenanceSpread, restorationEstimate, unavailabilityComplete, unavailabilityFindings, withUnavailability, type DaMaintenanceEstimate } from "../daUnavailability";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function close(actual: number | undefined, expected: number, tolerance = 1e-6): void {
  expect(actual).toBeDefined();
  expect(Math.abs((actual ?? 0) - expected) / Math.abs(expected)).toBeLessThan(tolerance);
}

function checks(da: DataAnalysis): Promise<string[]> {
  return settledWithPraxis(() => unavailabilityFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
}

function maintenance(id: string, next: Partial<DataAnalysisParameter>): DataAnalysisParameter {
  return { uuid: id, name: id, parameterType: "UNAVAILABILITY", quantificationModel: "UNAVAILABILITY", valueMode: "CALCULATED", implementsSrs: [], ...next };
}

function estimated(da: DataAnalysis, parameter: DataAnalysisParameter): Promise<DaMaintenanceEstimate> {
  return settledWithPraxis(() => maintenanceEstimate(da, parameter));
}

async function pointOf(estimate: DaMaintenanceEstimate): Promise<number | undefined> {
  const expression = estimate.estimate;
  return expression === undefined ? undefined : settledWithPraxis(() => readyNumber(pointState(expression, "FRACTION")));
}

function constrained(mean: number): DataAnalysisParameter["estimate"] {
  return { node: "VALUE", value: { unit: "FRACTION", law: { family: "CONSTRAINED_NONINFORMATIVE", mean } } };
}

function restoration(id: string, next: Partial<DataAnalysisParameter>): DataAnalysisParameter {
  return { uuid: id, name: id, parameterType: "PROBABILITY", valueType: "MEAN", quantificationModel: "NON_RECOVERY", valueMode: "CALCULATED", implementsSrs: [], ...next };
}

const ENTRIES: DaSourceEntry[] = [
  { id: "CTG", component: "Combustion turbine generator", failureMode: "Test or maintenance", quantity: "FRACTION", law: { family: "BETA", alpha: 0.5, beta: 9.5, lower: 0, upper: 1 } },
  { id: "PC", component: "Plant-centered LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 18.691108812822744, errorFactor: 36.6799, level: 0.95 } },
  { id: "SC", component: "Switchyard-centered LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 5.801107254676589, errorFactor: 16.1158, level: 0.95 } },
  { id: "GR", component: "Grid-related LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 3.577991209689045, errorFactor: 9.3652, level: 0.95 } },
  { id: "WR", component: "Weather-related LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 45.152678381581914, errorFactor: 26.3972, level: 0.95 } },
  { id: "PC-6890", component: "Plant-centered LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 1.0705616273649288, errorFactor: 8.30557, level: 0.95 } },
  { id: "SC-6890", component: "Switchyard-centered LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 1.4884978512561002, errorFactor: 7.89268, level: 0.95 } },
  { id: "GR-6890", component: "Grid-related LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 2.377499089934259, errorFactor: 5.75532, level: 0.95 } },
  { id: "WR-6890", component: "Weather-related LOOP", failureMode: "Recovery time", quantity: "HOURS", law: { family: "LOGNORMAL", mean: 15.755062566285455, errorFactor: 26.0521, level: 0.95 } },
  { id: "F-PC", component: "Plant-centered LOOP", failureMode: "Frequency", quantity: "PER_YEAR", law: { family: "GAMMA", shape: 6.5, rate: 1362.25 } },
  { id: "F-SC", component: "Switchyard-centered LOOP", failureMode: "Frequency", quantity: "PER_YEAR", law: { family: "GAMMA", shape: 9.5, rate: 1362.25 } },
  { id: "F-GR", component: "Grid-related LOOP", failureMode: "Frequency", quantity: "PER_YEAR", law: { family: "GAMMA", shape: 7.5, rate: 1362.25 } },
  { id: "F-WR", component: "Weather-related LOOP", failureMode: "Frequency", quantity: "PER_YEAR", law: { family: "GAMMA", shape: 0.62, rate: 83.54 } },
  { id: "EDG-REPAIR", component: "Emergency diesel generator repair", failureMode: "Repair time", quantity: "HOURS", law: { family: "WEIBULL", scale: 6.14, shape: 0.745, location: 0 } },
];

const SOURCE: DaSource = { id: "SRC-T", name: "Test source", kind: "GENERIC_NUCLEAR", origin: "OTHER_NUCLEAR", covers: "Test", boundaryConvention: "Test", failureCounting: "Test", quality: "Test", reference: "Test", entries: ENTRIES };

function use(id: string, entryId: string): DaSourceUse {
  return { id, sourceId: "SRC-T", entryId, verdict: "APPLIES", boundary: "SAME", reason: "Test" };
}

const CATEGORIES = ["PC", "SC", "GR", "WR"];

const COUNTS: Record<string, number> = { PC: 16, SC: 32, GR: 17, WR: 20, "PC-6890": 31, "SC-6890": 63, "GR-6890": 12, "WR-6890": 15 };

function loopParameter(withCounts: boolean, comparison: boolean): DataAnalysisParameter {
  const uses = [...CATEGORIES.map((key, index) => use(`U-${index + 1}`, key)), ...CATEGORIES.map((key, index) => use(`U-${index + 5}`, `${key}-6890`))];
  const parts = (offset: number, suffix: string): DaRestorationPart[] => CATEGORIES.map((key, index) => ({ useId: `U-${index + offset}`, weightSourceId: "SRC-T", weightEntryId: `F-${key}`, ...(withCounts ? { sampleSize: COUNTS[`${key}${suffix}`] } : {}) }));
  return restoration("DA-RC-01", {
    sourceUses: uses,
    restoration: { kind: "RECOVERY", subject: "Offsite power", from: "SOURCES", parts: parts(1, ""), ...(comparison ? { comparison: parts(5, "-6890") } : {}), windowHours: 33, windowReason: "Test", sequence: "Test" },
  });
}

function analysis(parameters: DataAnalysisParameter[], next: Partial<DataAnalysis> = {}): DataAnalysis {
  return { ...DA_ANALYSIS_HTGR, parameters, sources: [SOURCE], outages: [], ...next };
}

function parameterOf(da: DataAnalysis, id: string): DataAnalysisParameter {
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  if (parameter === undefined) throw new Error(id);
  return parameter;
}

describe("examples", () => {
  it("keeps both examples in step with their Step 06 maintenance inputs, with notes only", async () => {
    for (const seed of [DA_ANALYSIS_HTGR, DA_ANALYSIS]) {
      const da = { ...seed, parameters: seed.parameters.filter((parameter) => parameter.quantificationModel !== "NON_RECOVERY") };
      expect(await settledWithPraxis(() => withUnavailability(da))).toBe(da);
      expect((await settledWithPraxis(() => unavailabilityFindings(da))).filter((finding) => finding.severity !== "note")).toEqual([]);
      expect(await settledWithPraxis(() => unavailabilityComplete(da))).toBe(true);
    }
    expect(parameterOf(DA_ANALYSIS_HTGR, "DA-UA-11").estimate).toEqual(constrained(35 / 8760));
    close(await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(DA_ANALYSIS_HTGR, "DA-UA-11")))), 35 / 8760, 1e-12);
    close(await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(DA_ANALYSIS_HTGR, "DA-UA-12")))), 0.09966468583610884);
    close(await settledWithPraxis(() => readyNumber(parameterPoint(parameterOf(DA_ANALYSIS, "DA-UA-01")))), 35 / 8760, 1e-12);
  });
});

describe("test and maintenance unavailability", () => {
  it("divides the disabling hours by the required hours and puts a constrained noninformative law around them", async () => {
    const parameter = maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "PLANNED", requiredHoursPerYear: 8760, activities: [{ id: "A-1", activity: "Staggered maintenance", perYear: 1, hoursEach: 35, disablesFunction: true }, { id: "A-2", activity: "Walkdown", perYear: 12, hoursEach: 1, disablesFunction: false, reason: "Leaves the train running" }] } });
    const estimate = await estimated(analysis([parameter]), parameter);
    expect(estimate.estimate).toEqual(constrained(35 / 8760));
    const spread = await settledWithPraxis(() => maintenanceSpread(estimate));
    if (spread?.status !== "ready") throw new Error("PRAXIS gave no spread.");
    expect(spread.value.sampled).toBe(false);
    close(spread.value.mean, 0.003995433789954338, 1e-12);
    close(await pointOf(estimate), 0.003995433789954338, 1e-12);
    expect(estimate.left.map((item) => item.why)).toEqual(["NOT_DISABLING"]);
  });

  it("carries duration ranges into the unavailability as lognormal hours", async () => {
    const parameter = maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "PLANNED", requiredHoursPerYear: 8760, activities: [{ id: "A-1", activity: "Quarterly service", perYear: 4, hoursEach: 6, hoursLow: 3, hoursHigh: 12, disablesFunction: true, reason: "Plan" }] } });
    const estimate = await estimated(analysis([parameter]), parameter);
    expect(estimate.estimate).toEqual({
      node: "OPERATION",
      operation: "DIVIDE",
      operands: [
        { node: "OPERATION", operation: "MULTIPLY", operands: [{ node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 4 } } }, { node: "VALUE", value: { unit: "HOURS", law: { family: "LOGNORMAL", mean: 6, errorFactor: 2, level: 0.95 } } }] },
        { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value: 8760 } } },
      ],
    });
    close(await pointOf(estimate), 0.0027397260273972603, 1e-12);
    const spread = await settledWithPraxis(() => maintenanceSpread(estimate));
    if (spread?.status !== "ready") throw new Error("PRAXIS gave no spread.");
    const sigma = Math.log(2) / 1.6448536269514722;
    expect(spread.value.sampled).toBe(true);
    close(spread.value.mean, 0.0027397260273972603, 1e-2);
    close(spread.value.standardDeviation, ((4 * 6) / 8760) * Math.sqrt(Math.expm1(sigma * sigma)), 5e-2);
  });

  it("takes the joint hours of a coincident activity out of the train so they count once", async () => {
    const joint = maintenance("DA-UA-2", { maintenance: { kind: "COINCIDENT", method: "PLANNED", requiredHoursPerYear: 8760, equipment: ["Bank A", "Bank B"], activities: [{ id: "A-1", activity: "Joint equalize", perYear: 1, hoursEach: 6, disablesFunction: true, reason: "Plan" }] } });
    const train = maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "PLANNED", requiredHoursPerYear: 8760, overlapIds: ["DA-UA-2"], activities: [{ id: "A-1", activity: "Equalize", perYear: 2, hoursEach: 11, disablesFunction: true, reason: "Plan" }] } });
    const da = analysis([train, joint]);
    const estimate = await estimated(da, train);
    expect(estimate.overlapHours).toBe(6);
    expect(estimate.estimate).toEqual(constrained(16 / 8760));
    close(await pointOf(estimate), 0.0018264840182648401, 1e-12);
    close(await pointOf(await estimated(da, joint)), 6 / 8760, 1e-12);
    const wrong = analysis([maintenance("DA-UA-1", { maintenance: { ...train.maintenance, kind: "TRAIN", method: "PLANNED", overlapIds: ["DA-UA-9"] } }), joint]);
    expect(await checks(wrong)).toContain("error:Overlap missing:DA-UA-1");
  });

  it("multiplies a published fraction by the trains", async () => {
    const parameter = maintenance("DA-UA-1", { sourceUses: [use("U-1", "CTG")], priorUseId: "U-1", maintenance: { kind: "TRAIN", method: "GENERIC", trains: 2, trainsReason: "One at a time", basis: "Same class of machine" } });
    const estimate = await estimated(analysis([parameter]), parameter);
    const published = { family: "BETA" as const, alpha: 0.5, beta: 9.5, lower: 0, upper: 1 };
    expect(estimate.published).toEqual(published);
    close(estimate.perTrain, 0.05, 1e-12);
    expect(estimate.estimate).toEqual({ node: "VALUE", value: { unit: "FRACTION", law: { family: "TRUNCATED", law: { ...published, upper: 2 }, lower: null, upper: 1 } } });
    close(await pointOf(estimate), 0.09966468583610884);
    close(estimate.cutShift, 1 - 0.09966468583610884 / 0.1);
    expect(await checks(analysis([parameter]))).toContain("note:Cut at one:DA-UA-1");
  });

  it("builds q = f d / (1 + f d) from the outage frequency over the required hours and the mean outage duration", async () => {
    const parameter = maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "RECORDS", requiredHoursPerYear: 8760, requiredReason: "All year", records: [{ id: "R-1", activity: "Pump overhaul", hours: 30, disablesFunction: true }, { id: "R-2", activity: "Seal leak", hours: 12, disablesFunction: true }, { id: "R-3", activity: "Breaker work", hours: 9, disablesFunction: true, chargedTo: "SYS-AC" }] } });
    const da = analysis([parameter], { plantStage: "OPERATIONAL", dataPlan: { ...DA_ANALYSIS_HTGR.dataPlan, dataWindowStart: "2020-01-01", dataWindowEnd: "2022-01-01" } });
    const estimate = await estimated(da, parameter);
    const one = { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 1 } } };
    const frequency = { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 2, exposure: estimate.requiredHours }] } } };
    const duration = { node: "VALUE", value: { unit: "HOURS", law: { family: "DURATION", model: "EXPONENTIAL", times: [30, 12], censored: [], priors: [], output: { kind: "MEAN" } } } };
    close(estimate.requiredHours, 17531.991786447637, 1e-12);
    expect(estimate.estimate).toEqual({ node: "OPERATION", operation: "SUBTRACT", operands: [one, { node: "OPERATION", operation: "DIVIDE", operands: [one, { node: "OPERATION", operation: "ADD", operands: [one, { node: "OPERATION", operation: "MULTIPLY", operands: [frequency, duration] }] }] }] });
    expect(await checks(da)).toContain("warning:Support outage not carried:DA-UA-1");
    const noWindow = analysis([parameter], { plantStage: "OPERATIONAL", dataPlan: { ...DA_ANALYSIS_HTGR.dataPlan, dataWindowStart: undefined, dataWindowEnd: undefined } });
    expect((await estimated(noWindow, parameter)).problem).toBe("Records are counted over the data window. Set it in Step 01.");
  });

  it("updates the published fraction with the records, one trial per mean outage", async () => {
    const parameter = maintenance("DA-UA-1", { sourceUses: [use("U-1", "CTG")], priorUseId: "U-1", maintenance: { kind: "TRAIN", method: "BAYES", requiredHoursPerYear: 8760, requiredReason: "All year", basis: "Same class of machine", records: [{ id: "R-1", activity: "Overhaul", hours: 30, disablesFunction: true }, { id: "R-2", activity: "Seal leak", hours: 12, disablesFunction: true }] } });
    const da = analysis([parameter], { plantStage: "OPERATIONAL", dataPlan: { ...DA_ANALYSIS_HTGR.dataPlan, dataWindowStart: "2020-01-01", dataWindowEnd: "2022-01-01" } });
    const estimate = await estimated(da, parameter);
    const law = estimate.estimate?.node === "VALUE" ? estimate.estimate.value.law : undefined;
    if (law?.family !== "POSTERIOR") throw new Error("A posterior is expected.");
    const [term] = law.evidence;
    if (term?.likelihood !== "BINOMIAL") throw new Error("A binomial term is expected.");
    close(term.failures, 2, 1e-12);
    close(term.exposure, 834.8567517356017, 1e-12);
    close(await pointOf(estimate), 0.0029590815186884794, 1e-6);
  });

  it("asks for the required hours, the method and a range on risk-significant activities", async () => {
    const missing = maintenance("DA-UA-1", { isRiskSignificant: true, maintenance: { kind: "TRAIN", method: "PLANNED", activities: [{ id: "A-1", activity: "Service", perYear: 1, hoursEach: 8, disablesFunction: true }] } });
    const found = await checks(analysis([missing, maintenance("DA-UA-2", { valueMode: undefined })]));
    expect(found).toContain("error:Cannot estimate:DA-UA-1");
    expect(found).toContain("warning:No assumption:DA-UA-1");
    expect(found).toContain("warning:No range:DA-UA-1");
    expect(found).toContain("error:No method:DA-UA-2");
  });
});

describe("repair and recovery", () => {
  it("gives the restoration times to PRAXIS as a duration law with the open times censored", async () => {
    const parameter = restoration("DA-RC-02", { restoration: { kind: "RECOVERY", subject: "Cooling", from: "RECORDS", model: "WEIBULL", times: [{ id: "T-1", hours: 1 }, { id: "T-2", hours: 4 }, { id: "T-3", hours: 6, censored: true }], windowHours: 10, windowReason: "Test", sequence: "Test" } });
    const estimate = await settledWithPraxis(() => restorationEstimate(analysis([parameter], { plantStage: "OPERATIONAL" }), parameter));
    expect(estimate.estimate).toEqual({ node: "VALUE", value: { unit: "PROBABILITY", law: { family: "DURATION", model: "WEIBULL", times: [1, 4], censored: [6], priors: [], output: { kind: "EXCEEDANCE", time: 10 } } } });
  });

  it("turns a published lognormal with its event count into a prior on the log median that plant times update", async () => {
    const parameter = restoration("DA-RC-01", { sourceUses: [use("U-1", "PC")], restoration: { kind: "RECOVERY", subject: "Offsite power", from: "SOURCES", parts: [{ useId: "U-1", sampleSize: 16 }], times: [{ id: "T-1", hours: 2 }, { id: "T-2", hours: 5, censored: true }], windowHours: 33, windowReason: "Test", sequence: "Test" } });
    const estimate = await settledWithPraxis(() => restorationEstimate(analysis([parameter], { plantStage: "OPERATIONAL" }), parameter));
    const law = estimate.estimate?.node === "VALUE" ? estimate.estimate.value.law : undefined;
    if (law?.family !== "DURATION") throw new Error("A duration law is expected.");
    expect([law.model, law.times, law.censored, law.output]).toEqual(["LOGNORMAL", [2], [5], { kind: "EXCEEDANCE", time: 33 }]);
    const [mu, sigma] = law.priors;
    if (mu?.law.family !== "NORMAL" || sigma?.law.family !== "POINT") throw new Error("A normal prior on MU and a fixed SIGMA are expected.");
    close(mu.law.mean, Math.log(1.69893), 1e-6);
    close(sigma.law.value, 2.189999682694849, 1e-6);
    close(mu.law.standardDeviation, 2.189999682694849 / 4, 1e-6);
  });

  it("splits a published mixture of recovery time models into weighted duration parts", async () => {
    const mixture: DaSourceEntry = { id: "MIX", component: "Plant-centered LOSP", failureMode: "Time to recovery", quantity: "HOURS", law: { family: "MIXTURE", components: [{ weight: 0.0004, law: { family: "GAMMA", shape: 1, rate: 1.53506 } }, { weight: 0.041, law: { family: "LOGNORMAL", mean: 1.22728, errorFactor: 23.1632, level: 0.95 } }, { weight: 0.466, law: { family: "GAMMA", shape: 0.5197, rate: 0.7977 } }, { weight: 0.492, law: { family: "WEIBULL", scale: 0.473373, shape: 0.6544, location: 0 } }] } };
    const parameter = restoration("DA-RC-01", { sourceUses: [use("U-1", "MIX")], restoration: { kind: "RECOVERY", subject: "Offsite power", from: "SOURCES", parts: [{ useId: "U-1" }], windowHours: 2, windowReason: "Test", sequence: "Test" } });
    const da = analysis([parameter], { sources: [{ ...SOURCE, entries: [...ENTRIES, mixture] }] });
    const estimate = await settledWithPraxis(() => restorationEstimate(da, parameter));
    const expression = estimate.estimate;
    if (expression?.node !== "OPERATION") throw new Error("A weighted sum of duration parts is expected.");
    expect(expression.operands).toHaveLength(4);
    close(await settledWithPraxis(() => readyNumber(pointState(expression, "PROBABILITY"))), 0.078880415813339, 1e-6);
  });

  it("asks for a window, refuses mixed weights and flags records before operation", async () => {
    const parameter = loopParameter(true, false);
    const noWindow = restoration("DA-RC-01", { ...parameter, restoration: { ...parameter.restoration, kind: "RECOVERY", subject: "Offsite power", from: "SOURCES", windowHours: undefined } });
    expect(await checks(analysis([noWindow]))).toContain("error:No time window:DA-RC-01");
    const parts = parameter.restoration?.parts ?? [];
    const mixed = restoration("DA-RC-01", { ...parameter, restoration: { kind: "RECOVERY", subject: "Offsite power", from: "SOURCES", windowHours: 33, parts: [...parts.slice(0, 3), { useId: "U-4" }] } });
    const mixedDa = analysis([mixed]);
    expect((await settledWithPraxis(() => restorationEstimate(mixedDa, mixed))).problem).toBe("Weight every part, or none for equal weights.");
    const records = restoration("DA-RC-02", { restoration: { kind: "RECOVERY", subject: "Cooling", from: "RECORDS", times: [{ id: "T-1", hours: 2 }, { id: "T-2", hours: 5 }], windowHours: 10, windowReason: "Test", sequence: "Test" } });
    expect(await checks(analysis([records]))).toContain("warning:Records before operation:DA-RC-02");
  });
});

describe("value sync, outages and completion", () => {
  it("stores the calculated estimate and leaves typed values alone", async () => {
    const planned = maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "PLANNED", requiredHoursPerYear: 8760, activities: [{ id: "A-1", activity: "Service", perYear: 1, hoursEach: 35, disablesFunction: true, reason: "Plan" }] } });
    const typed = maintenance("DA-UA-2", { valueMode: "TYPED", estimate: { node: "VALUE", value: { unit: "FRACTION", law: { family: "BETA", alpha: 0.5, beta: 49.5, lower: 0, upper: 1 } } } });
    const synced = await settledWithPraxis(() => withUnavailability(analysis([planned, typed])));
    const stored = synced.parameters.find((parameter) => parameter.uuid === "DA-UA-1");
    expect(stored?.estimate).toEqual(constrained(0.003995433789954338));
    expect(stored?.value).toBeUndefined();
    expect(synced.parameters.find((parameter) => parameter.uuid === "DA-UA-2")).toBe(typed);
    expect(await settledWithPraxis(() => withUnavailability(synced))).toBe(synced);
  });

  it("checks outages against the operating states and completes once every value is in", async () => {
    const states = [{ id: "POS-06", name: "Refuelling", mode: "REFUELING_SHUTDOWN", durationHours: 120, entriesPerYear: 1, included: true }];
    const needs = { ...(DA_ANALYSIS_HTGR.dataNeeds ?? { sources: [], basicEvents: [], initiators: [], humanErrors: [], ccfGroups: [] }), states };
    const outage = { id: "OG-1", evolution: "Refuelling", outageType: "Refuelling", stateId: "POS-06", hours: 150, perYear: 2, basis: "PLANNED_SCHEDULE" as const };
    const da = analysis([], { dataNeeds: needs, outages: [outage, { ...outage, id: "OG-2", stateId: "POS-99" }] });
    const found = await checks(da);
    expect(found).toContain("warning:Count differs:OG-1");
    expect(found).toContain("warning:Hours differ:OG-1");
    expect(found).toContain("warning:Unknown state:OG-2");
    expect(await settledWithPraxis(() => unavailabilityComplete(da))).toBe(true);
    const planned = maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "PLANNED", activities: [] } });
    expect(await settledWithPraxis(() => unavailabilityComplete(analysis([planned])))).toBe(false);
    const filled = await settledWithPraxis(() => withUnavailability(analysis([maintenance("DA-UA-1", { maintenance: { kind: "TRAIN", method: "PLANNED", requiredHoursPerYear: 8760, requiredReason: "All year", activities: [{ id: "A-1", activity: "Service", perYear: 1, hoursEach: 35, disablesFunction: true, reason: "Plan" }] } })])));
    expect(await settledWithPraxis(() => unavailabilityComplete(filled))).toBe(true);
  });
});
