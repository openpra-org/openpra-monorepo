import { ESQ_PLAN_DEFAULTS, type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { EMPTY_UPSTREAM, type EsqUpstream } from "../esqLinks";
import { blankEsq } from "./esqFixtures";
import {
  filterConformance,
  planChanged,
  planValues,
  scopeItemsToComplete,
  scopeRowsView,
  stepsFromMef,
  withPlan,
  withPlanDefault,
  withPlanReason,
  withRestIncluded,
  withScopeItemAdded,
  withScopeReason,
  withScopeState,
} from "../esqSelectors";

const POS = {
  plantOperatingStates: [
    { uuid: "POS-01", name: "Full power", radioactiveMaterialSources: [{ name: "In-core fuel" }, { name: "Primary plateout" }] },
    { uuid: "POS-02", name: "Cold shutdown", radioactiveMaterialSources: [{ name: "In-core fuel (decay)" }, { name: "Primary plateout" }] },
  ],
} as PlantOperatingStatesAnalysis;

const IE = {
  initiatingEventGroups: [
    { uuid: "IEG-01", name: "Loss of forced cooling" },
    { uuid: "IEG-02", name: "Loss of offsite power" },
  ],
} as InitiatingEventsAnalysis;

const ES = {
  scopeDefinition: { plantOperatingStateIds: ["POS-01"], initiatingEventIds: ["IEG-01"], radioactiveMaterialSources: ["SRC-1"] },
  eventSequences: [{ initiatingEventId: "HZ-FIRE", plantOperatingStateId: "POS-01" }],
} as EventSequenceAnalysis;

const UPSTREAM: EsqUpstream = { ...EMPTY_UPSTREAM, pos: POS, ie: IE, es: ES };

function withCoverage(esq: EventSequenceQuantification, coverage: Partial<EventSequenceQuantification["modelIntegration"]["scopeCoverage"]>): EventSequenceQuantification {
  return { ...esq, modelIntegration: { ...esq.modelIntegration, scopeCoverage: { ...esq.modelIntegration.scopeCoverage, ...coverage } } };
}

function completeEsq(): EventSequenceQuantification {
  const base = withCoverage({
    ...blankEsq(),
    praScope: "Internal events at all operating states.",
    linkedWorkbooks: { ES: "example-es-htgr", IE: "example-ie-htgr", POS: "example-pos-htgr" },
    quantificationPlan: { modulesPerPlant: { value: 1 } },
  }, {
    hazardGroups: ["Internal events"],
    plantOperatingStates: ["POS-01", "POS-02"],
    radionuclideSources: ["In-core fuel", "Primary plateout", "In-core fuel (decay)"],
    initiatingEventGroups: ["IEG-01", "IEG-02", "HZ-FIRE"],
  });
  const hazards = ["Internal floods", "Internal fires", "Seismic events", "High winds", "External floods", "Other internal and external hazards"];
  return {
    ...base,
    modelIntegration: {
      ...base.modelIntegration,
      multiReactorInclusionBasis: "Single-unit site.",
      scopeExclusions: hazards.map((item) => ({ aspect: "HAZARD_GROUP" as const, item, reason: "Quantified in its own hazard PRA workbook." })),
    },
  };
}

describe("ESQ scope coverage", () => {
  it("lists initiator groups from IE and ES, with the ES column and the recorded decisions", () => {
    const covered = withCoverage(blankEsq(), { initiatingEventGroups: ["IEG-01"] });
    const esq = {
      ...covered,
      modelIntegration: { ...covered.modelIntegration, scopeExclusions: [{ aspect: "INITIATOR_GROUP" as const, item: "IEG-02", reason: "Bounded by IEG-01" }] },
    };
    const rows = scopeRowsView(esq, UPSTREAM, "INITIATOR_GROUP");
    expect(rows.map((row) => [row.key, row.label, row.inEs, row.state, row.reason, row.byHand])).toEqual([
      ["IEG-01", "Loss of forced cooling", true, "included", "", false],
      ["IEG-02", "Loss of offsite power", false, "excluded", "Bounded by IEG-01", false],
      ["HZ-FIRE", "HZ-FIRE", true, "unset", "", false],
    ]);
  });

  it("leaves out the entry of a tree that is only reached by transfer", () => {
    const linked = {
      scopeDefinition: { plantOperatingStateIds: ["POS-01"], initiatingEventIds: ["IEG-LOOP"], radioactiveMaterialSources: [] as string[] },
      eventTrees: [
        { uuid: "ET-LOOP", initiatingEventId: "IEG-LOOP", transfers: { t1: { targetEventTreeId: "ET-SBO" } } },
        { uuid: "ET-SBO", initiatingEventId: "SBO-TRANSFER-ENTRY" },
      ],
      eventSequences: [{ initiatingEventId: "SBO-TRANSFER-ENTRY", plantOperatingStateId: "POS-01" }],
    } as EventSequenceAnalysis;
    expect(scopeRowsView(blankEsq(), { ...EMPTY_UPSTREAM, es: linked }, "INITIATOR_GROUP").map((row) => row.key)).toEqual(["IEG-LOOP"]);
  });

  it("takes operating states and sources from POS and leaves the ES column off sources", () => {
    const states = scopeRowsView(blankEsq(), UPSTREAM, "OPERATING_STATE");
    expect(states.map((row) => [row.key, row.inEs])).toEqual([["POS-01", true], ["POS-02", false]]);
    const sources = scopeRowsView(blankEsq(), UPSTREAM, "SOURCE");
    expect(sources.map((row) => [row.key, row.inEs])).toEqual([
      ["In-core fuel", undefined],
      ["Primary plateout", undefined],
      ["In-core fuel (decay)", undefined],
    ]);
    expect(scopeRowsView(blankEsq(), { ...EMPTY_UPSTREAM, es: ES }, "SOURCE").map((row) => row.key)).toEqual(["SRC-1"]);
  });

  it("offers the seven standard hazard groups", () => {
    expect(scopeRowsView(blankEsq(), EMPTY_UPSTREAM, "HAZARD_GROUP").map((row) => row.label)).toEqual([
      "Internal events",
      "Internal floods",
      "Internal fires",
      "Seismic events",
      "High winds",
      "External floods",
      "Other internal and external hazards",
    ]);
  });

  it("keeps a recorded item outside the linked workbooks as a hand entry until it is set back to Not set", () => {
    const esq = withCoverage(blankEsq(), { initiatingEventGroups: ["IEG-99"] });
    const extra = scopeRowsView(esq, UPSTREAM, "INITIATOR_GROUP").find((row) => row.key === "IEG-99");
    expect(extra?.byHand).toBe(true);
    if (extra === undefined) throw new Error("missing row");
    const cleared = withScopeState(esq, "INITIATOR_GROUP", extra, "unset");
    expect(scopeRowsView(cleared, UPSTREAM, "INITIATOR_GROUP").some((row) => row.key === "IEG-99")).toBe(false);
  });

  it("moves an item between the included list and the exclusions", () => {
    const row = { key: "Seismic events", label: "Seismic events" };
    const excluded = withScopeReason(withScopeState(blankEsq(), "HAZARD_GROUP", row, "excluded"), "HAZARD_GROUP", row, "Own hazard PRA");
    expect(excluded.modelIntegration.scopeExclusions).toEqual([{ aspect: "HAZARD_GROUP", item: "Seismic events", reason: "Own hazard PRA" }]);
    expect(excluded.modelIntegration.scopeCoverage.hazardGroups).toEqual([]);
    const included = withScopeState(excluded, "HAZARD_GROUP", row, "included");
    expect(included.modelIntegration.scopeCoverage.hazardGroups).toEqual(["Seismic events"]);
    expect(included.modelIntegration.scopeExclusions).toEqual([]);
  });

  it("adds a hand entry once and includes every item not set", () => {
    const added = withScopeItemAdded(withScopeItemAdded(blankEsq(), "HAZARD_GROUP", "Volcanic ash"), "HAZARD_GROUP", " volcanic ash ");
    expect(added.modelIntegration.scopeCoverage.hazardGroups).toEqual(["Volcanic ash"]);
    const rest = withRestIncluded(blankEsq(), "OPERATING_STATE", scopeRowsView(blankEsq(), UPSTREAM, "OPERATING_STATE"));
    expect(rest.modelIntegration.scopeCoverage.plantOperatingStates).toEqual(["POS-01", "POS-02"]);
  });
});

describe("ESQ quantification plan", () => {
  it("falls back to the published defaults", () => {
    expect(planValues(blankEsq())).toEqual({
      frequencyBasis: ESQ_PLAN_DEFAULTS.frequencyBasis,
      stateWeighting: ESQ_PLAN_DEFAULTS.stateWeighting,
      moduleCounting: ESQ_PLAN_DEFAULTS.moduleCounting,
      reportingFloorPerYear: 1e-7,
      convergenceStepPercent: 5,
    });
  });

  it("asks for a reason when a default changes and forgets it on restore", () => {
    const changed = withPlan(completeEsq(), { ...completeEsq().quantificationPlan, reportingFloorPerYear: { value: 1e-6 } });
    expect(planChanged(changed, "reportingFloorPerYear")).toBe(true);
    expect(scopeItemsToComplete(changed, UPSTREAM)).toEqual(["Give a reason for the changed reporting floor."]);
    const reasoned = withPlanReason(changed, "reportingFloorPerYear", "The application reports down to 1E-6.");
    expect(scopeItemsToComplete(reasoned, UPSTREAM)).toEqual([]);
    const restored = withPlanDefault(reasoned, "reportingFloorPerYear");
    expect(planChanged(restored, "reportingFloorPerYear")).toBe(false);
    expect(restored.quantificationPlan?.reportingFloorPerYear).toBeUndefined();
  });
});

describe("ESQ scope completion", () => {
  it("lists what a blank workbook still needs", () => {
    expect(scopeItemsToComplete(blankEsq(), EMPTY_UPSTREAM)).toEqual([
      "Write the PRA scope.",
      "Link the ES workbook.",
      "Include at least one hazard group.",
      "Set Included or Excluded for 7 hazard groups.",
      "Include at least one operating state.",
      "Include at least one source.",
      "Include at least one initiator group.",
      "Set the number of modules per plant.",
      "Give the basis for leaving out sequences with several reactors.",
    ]);
  });

  it("asks for reasons on exclusions and decisions on new linked items", () => {
    const esq = completeEsq();
    const missingReason = {
      ...esq,
      modelIntegration: { ...esq.modelIntegration, scopeExclusions: (esq.modelIntegration.scopeExclusions ?? []).map((exclusion) => ({ ...exclusion, reason: exclusion.item === "High winds" ? "" : exclusion.reason })) },
    };
    expect(scopeItemsToComplete(missingReason, UPSTREAM)).toEqual(["Give a reason for the excluded hazard group."]);
    const newGroup: EsqUpstream = { ...UPSTREAM, ie: { initiatingEventGroups: [...IE.initiatingEventGroups, { uuid: "IEG-03", name: "Steam ingress" }] } as InitiatingEventsAnalysis };
    expect(scopeItemsToComplete(esq, newGroup)).toEqual(["Set Included or Excluded for 1 initiator group."]);
  });

  it("marks Scope complete only when nothing is left", () => {
    expect(stepsFromMef(completeEsq(), "preparer", UPSTREAM).find((step) => step.id === "scope")?.status).toBe("complete");
    expect(stepsFromMef(blankEsq(), "preparer", UPSTREAM).find((step) => step.id === "scope")?.status).toBe("idle");
  });
});

describe("ESQ conformance scope", () => {
  it("marks ESQ-C11 and C15 not applicable until an external hazard group is included", () => {
    const internalOnly = filterConformance(completeEsq(), "cc-ii", "pre_operational");
    expect(internalOnly.find((item) => item.id === "ESQ-C11")?.status).toBe("na");
    expect(internalOnly.find((item) => item.id === "ESQ-C15")?.status).toBe("na");
    const seismic = withCoverage(completeEsq(), { hazardGroups: ["Internal events", "Seismic events"] });
    expect(filterConformance(seismic, "cc-ii", "pre_operational").find((item) => item.id === "ESQ-C11")?.status).toBe("warn");
  });
});
