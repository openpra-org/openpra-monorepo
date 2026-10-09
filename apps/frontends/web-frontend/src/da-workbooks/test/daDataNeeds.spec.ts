import { readFileSync } from "fs";
import { join } from "path";
import { z } from "zod";
import type { DaBasicEventNeed, DaDataNeeds, DaElicitation, DaHumanErrorNeed, DaInitiatorNeed, DaSource, DaSourceEntry, DataAnalysis, DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import { DaSourceEntrySchema } from "interfaces-mef-types/zod/da/data-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { DA_INL_2020_ID, DA_NASCORD_ID, DA_SOURCE_CATALOG, daCatalogSource } from "interfaces-mef-types/da/generic-sources";
import type { UncertainExpression, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { FrequencyUnit } from "interfaces-mef-types/core/events";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { daNeedChecks, parameterFindings, withAutoMapping, withLinkedValuesSynced, withNeedParameter, withNeedsMerged, withOutlierGroup } from "../daSelectors";
import { entriesFromRows, guessMapping, libraryCount, libraryEntries, parseDelimited, sourceFindings, withStoredEntry } from "../daSourcing";
import { elicitationLaw, lawSummary, operationLaw, parameterPriorLaw } from "../daLaws";
import { linkScExamples } from "./daScExamples";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

function point(unit: UncertainUnit, value: number): UncertainExpression {
  return { node: "VALUE", value: { unit, law: { family: "POINT", value } } };
}

function perYear(mean: number, errorFactor: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean, errorFactor, level: 0.95 } } };
}

function mission(rate: number, hours: number): UncertainExpression {
  return { node: "MODEL", model: { form: "MISSION", rate: point("PER_HOUR", rate), missionTime: point("HOURS", hours) } };
}

const NOW = "2026-10-03T12:00:00.000Z";

const DATASETS = join(__dirname, "../../../../../interfaces/mef-types/da");

function dataset(name: string): DaSourceEntry[] {
  return z.array(DaSourceEntrySchema).parse(JSON.parse(readFileSync(join(DATASETS, name), "utf-8")));
}

function catalogSourceOf(catalogId: string, id: string): DaSource {
  const source = daCatalogSource(catalogId, id);
  if (source === undefined) throw new Error(catalogId);
  return source;
}

function blankDa(needs: DaDataNeeds): DataAnalysis {
  return {
    uuid: "da-test",
    name: "DA test",
    type: TechnicalElementTypes.DATA_ANALYSIS,
    version: "1",
    created: NOW,
    modified: NOW,
    workflowState: "DRAFT",
    workflowHistory: [],
    capabilityCategory: "CC-II",
    plantStage: "PRE_OPERATIONAL",
    metadata: {
      versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
      analysisDate: NOW,
      analysts: [],
      reviewers: [],
      scope: "",
      limitations: [],
      lastModifiedDate: NOW,
      lastModifiedBy: "tester",
    },
    conformanceMatrix: [],
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
    activePeerReviewIds: [],
    activeAuditIds: [],
    praScope: "",
    scopeDecisions: [{ kind: "TEST_MAINTENANCE", included: false, exclusionReason: "Not modeled" }],
    dataNeeds: needs,
    parameters: [],
    componentBoundaries: [],
    documentation: {
      processDescription: "",
      systemComponentBoundaries: "",
      basicEventProbabilityModels: "",
      genericParameterSources: "",
      plantSpecificDataSourcesAndPeriods: "",
      dataExclusionJustifications: "",
      demandAndExposureCounting: "",
      unavailabilityTreatment: "",
      repairAndRecoveryData: "",
      lpsdOutageData: "",
      componentGroupingAndOutliers: "",
      ccfParameterBasis: "",
      bayesianPriorRationales: "",
      parameterEstimatesWithUncertainty: "",
      multiPosGenericUse: "",
      modelUncertaintySources: "",
      asBuiltLimitations: "",
      praTaskInterfaces: "",
      implementsSrs: [],
    },
  };
}

function event(id: string, fields: Partial<DaBasicEventNeed> = {}): DaBasicEventNeed {
  return { id, code: id.toUpperCase(), name: `Event ${id}`, included: true, importedKind: "DEMAND", kind: "DEMAND", expression: point("PROBABILITY", 1e-3), valueHeldBy: "TYPED", ...fields };
}

function needs(fields: Partial<DaDataNeeds>): DaDataNeeds {
  return { importedAt: NOW, sources: [], basicEvents: [], initiators: [], humanErrors: [], ccfGroups: [], states: [], ...fields };
}

describe("withNeedsMerged", () => {
  it("keeps DA decisions and hand entries, and reports what the new import changed", () => {
    const previous = needs({
      basicEvents: [
        event("a", { kind: "STANDBY", testIntervalHours: 720, changeReason: "Tested monthly" }),
        event("b", { importedKind: "RUNNING", kind: "RUNNING", importedMissionTime: point("HOURS", 24), missionTime: point("HOURS", 1), changeReason: "First hour only" }),
        event("c", { included: false, exclusionReason: "Duplicate of A" }),
        event("gone"),
        event("hand", { manual: { source: "Walkdown" } }),
      ],
      states: [{ id: "POS-01", name: "Full power", durationHours: 7300, included: false, exclusionReason: "Out of scope" }],
    });
    const next = needs({
      basicEvents: [
        event("a"),
        event("b", { importedKind: "RUNNING", kind: "RUNNING", importedMissionTime: point("HOURS", 24), missionTime: point("HOURS", 24) }),
        event("c", { expression: point("PROBABILITY", 2e-3) }),
        event("new"),
      ],
      states: [{ id: "POS-01", name: "Full power", durationHours: 7300, included: true }],
    });

    const merged = withNeedsMerged(previous, next);
    const byId = new Map(merged.basicEvents.map((need) => [need.id, need]));

    expect(byId.get("a")?.kind).toBe("STANDBY");
    expect(byId.get("a")?.testIntervalHours).toBe(720);
    expect(byId.get("b")?.missionTime).toEqual(point("HOURS", 1));
    expect(byId.get("b")?.changeReason).toBe("First hour only");
    expect(byId.get("c")?.included).toBe(false);
    expect(byId.get("c")?.exclusionReason).toBe("Duplicate of A");
    expect(byId.get("c")?.expression).toEqual(point("PROBABILITY", 2e-3));
    expect(byId.has("gone")).toBe(false);
    expect(byId.get("hand")?.manual?.source).toBe("Walkdown");
    expect(merged.states[0]?.included).toBe(false);
    expect(merged.changes).toEqual([
      { element: "SY", id: "c", change: "CHANGED" },
      { element: "SY", id: "new", change: "ADDED" },
      { element: "SY", id: "gone", change: "REMOVED", label: "GONE" },
    ]);
  });

  it("reports no changes on the first import", () => {
    const merged = withNeedsMerged(needs({ importedAt: undefined, basicEvents: [event("hand", { manual: { source: "Drawing" } })] }), needs({ basicEvents: [event("a")] }));
    expect(merged.changes).toBeUndefined();
    expect(merged.basicEvents.map((need) => need.id)).toEqual(["a", "hand"]);
  });
});

describe("daNeedChecks", () => {
  it("flags the gaps that block the step", () => {
    const da = blankDa(needs({
      basicEvents: [
        event("edited", { importedKind: "DEMAND", kind: "STANDBY" }),
        event("running", { importedKind: "RUNNING", kind: "RUNNING" }),
        event("unset", { importedKind: undefined, kind: undefined }),
        event("excluded", { included: false }),
        event("maintenance", { importedKind: "UNAVAILABILITY", kind: "UNAVAILABILITY" }),
      ],
      ccfGroups: [{ id: "CCF-1", name: "Pumps", systemIds: [], memberIds: ["running", "missing"], included: true }],
    }));

    const findings = daNeedChecks(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);

    expect(findings).toEqual(expect.arrayContaining([
      "error:Edited without a reason:EDITED",
      "error:No test interval:EDITED",
      "error:No mission time:RUNNING",
      "error:No event type:UNSET",
      "error:Excluded without a reason:EXCLUDED",
      "error:Unknown member:CCF-1",
      "warning:Out of scope:MAINTENANCE",
    ]));
    expect(findings.indexOf("warning:Out of scope:MAINTENANCE")).toBeGreaterThan(findings.indexOf("error:Unknown member:CCF-1"));
  });

  it("passes a complete inventory", () => {
    const da = blankDa(needs({
      basicEvents: [event("a"), event("b", { importedKind: "RUNNING", kind: "RUNNING", importedMissionTime: point("HOURS", 24), missionTime: point("HOURS", 24) })],
      ccfGroups: [{ id: "CCF-1", name: "Pair", systemIds: [], memberIds: ["a", "b"], included: true }],
    }));
    expect(daNeedChecks(da).filter((finding) => finding.severity === "error")).toEqual([]);
  });
});

function initiator(id: string, fields: Partial<DaInitiatorNeed> = {}): DaInitiatorNeed {
  return { id, name: `Initiator ${id}`, stateIds: ["POS-01"], memberIds: [], frequency: { expression: point("PER_YEAR", 0.1), basis: FrequencyUnit.PER_PLANT_YEAR }, included: true, ...fields };
}

function human(id: string, fields: Partial<DaHumanErrorNeed> = {}): DaHumanErrorNeed {
  return { id, hfeId: id.toUpperCase(), name: `Action ${id}`, kind: "HUMAN_ERROR", value: 3e-3, valueKind: "MEAN", stateIds: ["POS-01"], included: true, ...fields };
}

function parameter(uuid: string, fields: Partial<DataAnalysisParameter> = {}): DataAnalysisParameter {
  return { uuid, name: `Parameter ${uuid}`, parameterType: "PROBABILITY", value: 1e-3, valueType: "MEAN", implementsSrs: [], ...fields };
}

function component(uuid: string, fields: Partial<DataAnalysisParameter> = {}): DataAnalysisParameter {
  return { uuid, name: `Parameter ${uuid}`, parameterType: "PROBABILITY", estimate: point("PROBABILITY", 1e-3), implementsSrs: [], ...fields };
}

describe("withAutoMapping", () => {
  it("maps each event to the parameter its owner names and links the typed values", () => {
    const da = {
      ...blankDa(needs({
        basicEvents: [
          event("held", { valueHeldBy: "DA", valueHolderId: "DA-BE-1" }),
          event("rate", { importedKind: "RUNNING", kind: "RUNNING", expression: mission(2e-4, 24), missionTime: point("HOURS", 24) }),
          event("mission", { importedKind: "RUNNING", kind: "RUNNING", expression: point("PROBABILITY", 5e-3), missionTime: point("HOURS", 24) }),
          event("operator", { importedKind: "HUMAN_ERROR", kind: "HUMAN_ERROR", valueHeldBy: "HRA", valueHolderId: "HFE-A" }),
          event("hand", { manual: { source: "Walkdown" } }),
          event("excluded", { included: false, exclusionReason: "Screened" }),
          event("ccf", { importedKind: "COMMON_CAUSE", kind: "COMMON_CAUSE" }),
        ],
        initiators: [initiator("IG-1"), initiator("IG-2", { memberIds: ["IE-LOOP"], frequency: undefined }), initiator("IG-3", { memberIds: ["IE-A", "IE-B"], frequency: { expression: perYear(0.3, 3), basis: FrequencyUnit.PER_PLANT_YEAR } })],
        humanErrors: [human("hfe-a"), human("rec-1", { kind: "RECOVERY", value: 0.2 })],
      })),
      parameters: [parameter("DA-BE-1", { basicEventRef: "HELD" }), parameter("DA-IE-1", { parameterType: "FREQUENCY", basicEventRef: "IE-LOOP", value: 2e-2 }), parameter("DA-IE-2", { parameterType: "FREQUENCY", basicEventRef: "IE-A", value: 0.1 })],
    };

    const mapped = withAutoMapping(da);
    const events = new Map((mapped.dataNeeds?.basicEvents ?? []).map((need) => [need.id, need.parameterId]));
    const byId = new Map(mapped.parameters.map((p) => [p.uuid, p]));

    expect(events.get("held")).toBe("DA-BE-1");
    expect(byId.get("DA-BE-1")).toMatchObject({ quantificationModel: "DEMAND_PROBABILITY", estimate: point("PROBABILITY", 1e-3) });
    expect(byId.get("DA-BE-1")?.value).toBeUndefined();
    expect(byId.get("DA-BE-1")?.valueType).toBeUndefined();
    expect(events.get("hand")).toBeUndefined();
    expect(events.get("excluded")).toBeUndefined();
    expect(events.has("ccf")).toBe(true);
    expect(events.get("ccf")).toBeUndefined();

    const rate = byId.get(events.get("rate") ?? "");
    expect(rate).toMatchObject({ quantificationModel: "RUNNING_RATE", parameterType: "FAILURE_RATE", estimate: point("PER_HOUR", 2e-4), valueMode: "LINKED", valueLink: { element: "SY", needId: "rate" } });
    expect(rate?.value).toBeUndefined();
    const linkedMission = byId.get(events.get("mission") ?? "");
    expect(linkedMission).toMatchObject({ quantificationModel: "MISSION_PROBABILITY", parameterType: "PROBABILITY", estimate: point("PROBABILITY", 5e-3) });
    expect(linkedMission?.missionTime).toBeUndefined();

    const hep = mapped.dataNeeds?.humanErrors.find((need) => need.id === "hfe-a")?.parameterId;
    expect(byId.get(hep ?? "")).toMatchObject({ quantificationModel: "HUMAN_ERROR", parameterType: "HUMAN_ERROR_PROBABILITY", value: 3e-3, stateIds: ["POS-01"] });
    expect(events.get("operator")).toBe(hep);
    const recovery = mapped.dataNeeds?.humanErrors.find((need) => need.id === "rec-1")?.parameterId;
    expect(byId.get(recovery ?? "")?.quantificationModel).toBe("NON_RECOVERY");

    const initiators = new Map((mapped.dataNeeds?.initiators ?? []).map((need) => [need.id, need.parameterId]));
    expect(byId.get(initiators.get("IG-1") ?? "")).toMatchObject({ quantificationModel: "FREQUENCY", parameterType: "FREQUENCY", estimate: point("PER_YEAR", 0.1), valueMode: "LINKED" });
    expect(byId.get(initiators.get("IG-1") ?? "")?.value).toBeUndefined();
    expect(initiators.get("IG-2")).toBe("DA-IE-1");
    expect(byId.get("DA-IE-1")).toMatchObject({ quantificationModel: "FREQUENCY", estimate: point("PER_YEAR", 2e-2) });
    expect(byId.get("DA-IE-1")?.valueType).toBeUndefined();
    expect(byId.get(initiators.get("IG-3") ?? "")).toMatchObject({ estimate: perYear(0.3, 3), valueMode: "LINKED", valueLink: { element: "IE", needId: "IG-3" } });
    expect(byId.get("DA-IE-2")?.quantificationModel).toBeUndefined();

    expect(mapped.parameters.filter((p) => p.uuid.startsWith("DA-P-")).map((p) => p.uuid)).toEqual(["DA-P-001", "DA-P-002", "DA-P-003", "DA-P-004", "DA-P-005", "DA-P-006"]);
    expect(withAutoMapping(mapped)).toEqual(mapped);
  });
});

describe("parameterFindings", () => {
  it("flags mapping, model, state and population gaps", async () => {
    const da: DataAnalysis = {
      ...blankDa(needs({
        basicEvents: [
          event("demand", { parameterId: "DA-RATE" }),
          event("short", { importedKind: "RUNNING", kind: "RUNNING", missionTime: point("HOURS", 1), parameterId: "DA-MISSION" }),
          event("loose"),
          event("ghost", { parameterId: "DA-GONE" }),
        ],
        states: [{ id: "POS-01", name: "Power", included: true }, { id: "POS-02", name: "Shutdown", included: true }],
      })),
      parameters: [
        component("DA-RATE", { parameterType: "FAILURE_RATE", quantificationModel: "RUNNING_RATE", componentBoundaryRef: "CB-1", estimate: point("PER_HOUR", 1e-5) }),
        component("DA-MISSION", { quantificationModel: "MISSION_PROBABILITY", estimate: mission(1e-5, 24), componentBoundaryRef: "CB-1", stateIds: ["POS-01", "POS-02"] }),
        parameter("DA-HIGH", { parameterType: "HUMAN_ERROR_PROBABILITY", quantificationModel: "HUMAN_ERROR", value: 1.5 }),
        component("DA-LINK", { quantificationModel: "DEMAND_PROBABILITY", valueMode: "LINKED", valueLink: { element: "SY", needId: "loose" }, componentBoundaryRef: "CB-1" }),
      ],
      componentBoundaries: [{ uuid: "CB-1", name: "Pump", systemId: "SYS-1", description: "", boundaries: [], includedItems: ["Pump"], boundaryBasis: "Matches the event", implementsSrs: [] }],
      componentGroupings: [{ uuid: "CG-1", name: "Pumps", systemId: "SYS-1", groupId: "CG-1", componentIds: ["P-1"], groupingBasis: "TYPE_ONLY", designCharacteristics: [], environmentalConditions: [], serviceConditions: [], groupingJustification: "", implementsSrs: [] }],
      outlierComponents: [{ uuid: "OL-1", systemId: "SYS-1", componentId: "P-9", potentialGroupId: "CG-1", exclusionReason: "", exclusionJustification: "", differentiatingCharacteristics: [], alternativeHandling: "", status: "TENTATIVE", implementsSrs: [] }],
    };

    const findings = await settledWithPraxis(() => parameterFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));

    expect(findings).toEqual(expect.arrayContaining([
      "error:Model does not fit:DEMAND",
      "error:Mission time differs:SHORT",
      "error:Not mapped:LOOSE",
      "error:Parameter missing:GHOST",
      "error:States without a reason:DA-MISSION",
      "error:Out of range:DA-HIGH",
      "error:Link broken:DA-LINK",
      "warning:Not used:DA-HIGH",
      "warning:Type only:CG-1",
      "warning:Too few members:CG-1",
      "error:No reason:OL-1",
    ]));
    expect(findings).not.toContain("warning:No boundary:DA-RATE");
  });

  it("accepts an SC component time inside the need's sequence and flags every other mission time that differs", async () => {
    linkScExamples();
    const sc = (entityId: string): UncertainExpression => ({ node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "example-sc-htgr", entityId } });
    const missionOf = (time: UncertainExpression): UncertainExpression => ({ node: "MODEL", model: { form: "MISSION", rate: point("PER_HOUR", 1e-5), missionTime: time } });
    const da: DataAnalysis = {
      ...blankDa(needs({
        basicEvents: [
          event("same-sequence", { importedKind: "RUNNING", kind: "RUNNING", missionTime: sc("MT-PLOFC"), parameterId: "DA-CMT" }),
          event("other-sequence", { importedKind: "RUNNING", kind: "RUNNING", missionTime: sc("MT-DLOFC"), parameterId: "DA-CMT-2" }),
          event("typed", { importedKind: "RUNNING", kind: "RUNNING", missionTime: sc("MT-DLOFC"), parameterId: "DA-TYPED" }),
          event("linked", { importedKind: "RUNNING", kind: "RUNNING", missionTime: sc("MT-DLOFC"), parameterId: "DA-LINKED" }),
        ],
      })),
      parameters: [
        component("DA-CMT", { quantificationModel: "MISSION_PROBABILITY", estimate: missionOf(sc("CMT-2")) }),
        component("DA-CMT-2", { quantificationModel: "MISSION_PROBABILITY", estimate: missionOf(sc("CMT-2")) }),
        component("DA-TYPED", { quantificationModel: "MISSION_PROBABILITY", estimate: missionOf(point("HOURS", 1)) }),
        component("DA-LINKED", { quantificationModel: "MISSION_PROBABILITY", estimate: missionOf(sc("MT-DLOFC")) }),
      ],
    };
    const differs = (await settledWithPraxis(() => parameterFindings(da))).filter((finding) => finding.check === "Mission time differs").map((finding) => finding.item);
    expect(differs).toEqual(["OTHER-SEQUENCE", "TYPED"]);
  });

  it("flags a component estimate whose law leaves its unit", async () => {
    const lognormal = { family: "LOGNORMAL" as const, mean: 0.2, errorFactor: 10, level: 0.95 };
    const da: DataAnalysis = {
      ...blankDa(needs({})),
      parameters: [
        component("DA-POINT", { quantificationModel: "DEMAND_PROBABILITY", estimate: point("PROBABILITY", 1.5) }),
        component("DA-WIDE", { quantificationModel: "DEMAND_PROBABILITY", estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: lognormal } } }),
        component("DA-RATE", { quantificationModel: "MISSION_PROBABILITY", estimate: { node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "NORMAL", mean: 1e-5, standardDeviation: 1e-5 } } }, missionTime: point("HOURS", 24) } } }),
        component("DA-CUT", { quantificationModel: "DEMAND_PROBABILITY", estimate: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "TRUNCATED", law: lognormal, lower: null, upper: 1 } } } }),
      ],
    };
    const range = await settledWithPraxis(() => parameterFindings(da).filter((finding) => finding.check === "Out of range").map((finding) => `${finding.severity} ${finding.item}: ${finding.detail}`));
    expect(range).toEqual([
      "error DA-POINT: The point law goes above 1, but it is a probability. Truncate it at 1, or pick a law that stays in range.",
      "error DA-WIDE: The lognormal law goes above 1, but it is a probability. Truncate it at 1, or pick a law that stays in range.",
      "error DA-RATE: The normal law goes below 0. Truncate it at 0, or pick a law that stays in range.",
    ]);
  });

  it("checks the states and values an event brings to its parameter", async () => {
    const da: DataAnalysis = {
      ...blankDa(needs({
        initiators: [initiator("IG-1", { stateIds: ["POS-01", "POS-04"], parameterId: "DA-F" })],
        humanErrors: [human("hfe-a", { stateIds: ["POS-01"], value: 2e-3, parameterId: "DA-H" })],
        states: [{ id: "POS-01", name: "Power", included: true }, { id: "POS-04", name: "Shutdown", included: true }],
      })),
      parameters: [
        component("DA-F", { parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: point("PER_YEAR", 0.1), stateIds: ["POS-01"] }),
        parameter("DA-H", { parameterType: "HUMAN_ERROR_PROBABILITY", quantificationModel: "HUMAN_ERROR", value: 3e-3, stateIds: ["POS-01"] }),
      ],
    };
    const findings = await settledWithPraxis(() => parameterFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
    expect(findings).toEqual(["error:States not covered:IG-1", "warning:Values differ:HFE-A"]);
  });

  it("asks for a state reason unless the link brings the states", () => {
    const da: DataAnalysis = {
      ...blankDa(needs({
        basicEvents: [event("a", { parameterId: "DA-S" })],
        initiators: [initiator("IG-1", { stateIds: ["POS-01", "POS-04"], parameterId: "DA-F" })],
        states: [{ id: "POS-01", name: "Power", included: true }, { id: "POS-04", name: "Shutdown", included: true }],
      })),
      parameters: [
        component("DA-S", { quantificationModel: "DEMAND_PROBABILITY", componentBoundaryRef: "CB-1", valueMode: "LINKED", valueLink: { element: "SY", needId: "a" }, stateIds: ["POS-01", "POS-04"] }),
        component("DA-F", { parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: point("PER_YEAR", 0.1), valueMode: "LINKED", valueLink: { element: "IE", needId: "IG-1" }, stateIds: ["POS-01", "POS-04"] }),
      ],
      componentBoundaries: [{ uuid: "CB-1", name: "Valve", systemId: "SYS-1", description: "", boundaries: [], includedItems: ["Valve body"], boundaryBasis: "Matches the event", implementsSrs: [] }],
    };
    expect(parameterFindings(da).map((finding) => `${finding.check}:${finding.item}`)).toEqual(["States without a reason:DA-S"]);
  });

  it("passes a mapped and defined set, and compares the values through PRAXIS", async () => {
    const da: DataAnalysis = {
      ...blankDa(needs({ basicEvents: [event("a", { parameterId: "DA-1" }), event("b", { parameterId: "DA-1" })] })),
      parameters: [component("DA-1", { quantificationModel: "DEMAND_PROBABILITY", componentBoundaryRef: "CB-1" })],
      componentBoundaries: [{ uuid: "CB-1", name: "Valve", systemId: "SYS-1", description: "", boundaries: [], includedItems: ["Valve body", "Operator"], boundaryBasis: "Matches the events", implementsSrs: [] }],
    };
    expect(await settledWithPraxis(() => parameterFindings(da))).toEqual([]);
    const differs: DataAnalysis = { ...da, dataNeeds: needs({ basicEvents: [event("a", { parameterId: "DA-1", expression: point("PROBABILITY", 2e-3) }), event("b", { parameterId: "DA-1" })] }) };
    expect((await settledWithPraxis(() => parameterFindings(differs))).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`)).toEqual(["warning:Values differ:A"]);
  });
});

describe("parameter links", () => {
  it("refreshes linked values on import and keeps the map", () => {
    const linked = component("DA-P-001", { quantificationModel: "DEMAND_PROBABILITY", valueMode: "LINKED", valueLink: { element: "SY", needId: "a" } });
    const typed = component("DA-P-002", { quantificationModel: "DEMAND_PROBABILITY", estimate: point("PROBABILITY", 4e-3) });
    const before = { ...blankDa(needs({ basicEvents: [event("a", { parameterId: "DA-P-001" }), event("b", { parameterId: "DA-P-002" })] })), parameters: [linked, typed] };
    const merged = withNeedsMerged(before.dataNeeds, needs({ basicEvents: [event("a", { expression: point("PROBABILITY", 2e-3) }), event("b", { expression: point("PROBABILITY", 9e-3) })] }));
    const after = withLinkedValuesSynced({ ...before, dataNeeds: merged });

    expect(after.dataNeeds?.basicEvents.map((need) => need.parameterId)).toEqual(["DA-P-001", "DA-P-002"]);
    const states = withLinkedValuesSynced({
      ...blankDa(needs({ initiators: [initiator("IG-1", { stateIds: ["POS-01", "POS-04"], parameterId: "DA-F" })] })),
      parameters: [component("DA-F", { quantificationModel: "FREQUENCY", parameterType: "FREQUENCY", valueMode: "LINKED", valueLink: { element: "IE", needId: "IG-1" }, estimate: point("PER_YEAR", 0.2), stateIds: ["POS-01"] })],
    });
    expect(states.parameters[0]?.stateIds).toEqual(["POS-01", "POS-04"]);
    expect(states.parameters[0]?.estimate).toEqual(point("PER_YEAR", 0.1));
    expect(after.parameters.map((p) => p.estimate)).toEqual([point("PROBABILITY", 2e-3), point("PROBABILITY", 4e-3)]);
    expect(withLinkedValuesSynced(after)).toBe(after);
  });

  it("unmaps an event and sets a new parameter's model from its event", () => {
    const da = { ...blankDa(needs({ basicEvents: [event("a", { importedKind: "STANDBY", kind: "STANDBY", parameterId: "DA-1" })] })), parameters: [component("DA-1", { quantificationModel: "DEMAND_PROBABILITY" }), parameter("DA-2", { parameterType: "OTHER" })] };
    const cleared = withNeedParameter(da, "SY", "a", undefined);
    expect(cleared.dataNeeds?.basicEvents[0]?.parameterId).toBeUndefined();
    const remapped = withNeedParameter(cleared, "SY", "a", "DA-2");
    expect(remapped.parameters[1]).toMatchObject({ quantificationModel: "STANDBY_RATE", parameterType: "FAILURE_RATE", estimate: point("PER_HOUR", 1e-3) });
    expect(remapped.parameters[1]?.value).toBeUndefined();
    expect(remapped.parameters[1]?.valueType).toBeUndefined();
  });

  it("moves an outlier between the groups that hold it out", () => {
    const group = { name: "Pumps", systemId: "SYS-1", componentIds: ["P-1", "P-2"], groupingBasis: "TYPE_AND_SERVICE_CONDITIONS" as const, designCharacteristics: [], environmentalConditions: [], serviceConditions: [], groupingJustification: "Same pumps", implementsSrs: [] };
    const da = { ...blankDa(needs({})), componentGroupings: [{ ...group, uuid: "CG-1", groupId: "CG-1", excludedOutliers: ["OL-1"] }, { ...group, uuid: "CG-2", groupId: "CG-2" }] };
    const moved = withOutlierGroup(da, "OL-1", "CG-2");
    expect(moved.componentGroupings?.map((g) => g.excludedOutliers)).toEqual([[], ["OL-1"]]);
    expect(withOutlierGroup(moved, "OL-1", "CG-2")).toBe(moved);
  });
});

function inlRow(code: string): DaSourceEntry {
  const entry = dataset("source-inl-2020.json").find((candidate) => candidate.id === code);
  if (entry === undefined) throw new Error(code);
  return entry;
}

function library(): DaSource[] {
  const inl = catalogSourceOf(DA_INL_2020_ID, "SRC-01");
  return [
    { ...inl, entries: [inlRow("CTG-FTLR"), inlRow("FAN-FTS-NS")] },
    {
      id: "SRC-02",
      name: "WSRC-TR-93-262",
      kind: "GENERIC_NUCLEAR",
      origin: "OTHER_NUCLEAR",
      covers: "Savannah River generic rates",
      yearsFrom: "1993",
      boundaryConvention: "",
      failureCounting: "Category 1 aggregated events",
      quality: "Lognormal, error factor 10",
      reference: "WSRC-TR-93-262 Rev. 1",
      entries: [{ id: "ALR-NR-I", component: "Alarm or annunciator", failureMode: "Fails to alarm", quantity: "PER_HOUR", law: { family: "LOGNORMAL", mean: 3e-5, errorFactor: 10, level: 0.95 }, mean: 3e-5 }],
    },
  ];
}

describe("sources and priors", () => {
  it("scales a catalog prior and turns a standby rate into a probability per demand", async () => {
    const da: DataAnalysis = {
      ...blankDa(needs({})),
      sources: library(),
      parameters: [
        component("DA-RUN", { parameterType: "PROBABILITY", quantificationModel: "MISSION_PROBABILITY", evidenceKind: "GENERIC_NUCLEAR", evidenceReason: "No gas turbine of this design has operated.", priorUseId: "U-1", sourceUses: [{ id: "U-1", sourceId: "SRC-01", entryId: "CTG-FTLR", verdict: "SCALED", boundary: "SAME", reason: "Same machine class.", factors: [{ id: "F-1", name: "Helium plant duty", nominal: 2, low: 1, high: 4, basis: "Start profile differs." }] }] }),
        component("DA-ALARM", { quantificationModel: "DEMAND_PROBABILITY", evidenceKind: "GENERIC_NUCLEAR", evidenceReason: "No plant records before operation.", priorUseId: "U-1", sourceUses: [{ id: "U-1", sourceId: "SRC-02", entryId: "ALR-NR-I", verdict: "APPLIES", boundary: "ADJUSTED", reason: "Annunciator on a quarterly test.", standbyHours: 1095 }] }),
        component("DA-OPEN", { quantificationModel: "DEMAND_PROBABILITY", sourceUses: [{ id: "U-1", sourceId: "SRC-02", entryId: "ALR-NR-I", verdict: "APPLIES", boundary: "DIFFERENT", reason: "" }] }),
      ],
    };

    const run = await settledWithPraxis(() => parameterPriorLaw(da, da.parameters[0] ?? component("x")));
    if (run.status !== "ready") throw new Error("PRAXIS gave no prior.");
    expect(run.value).toMatchObject({ quantity: "PER_HOUR", factor: 2, cut: false, law: { family: "GAMMA", shape: 2.5, rate: expect.closeTo(180, 9) } });
    const alarm = await settledWithPraxis(() => parameterPriorLaw(da, da.parameters[1] ?? component("x")));
    if (alarm.status !== "ready") throw new Error("PRAXIS gave no prior.");
    expect(alarm.value).toMatchObject({ quantity: "PER_DEMAND", factor: 1095, cut: true, law: { family: "TRUNCATED", lower: null, upper: 1, law: { family: "LOGNORMAL", mean: expect.closeTo(3e-5 * 1095, 12), errorFactor: expect.closeTo(10, 9), level: 0.95 } } });

    const findings = await settledWithPraxis(() => sourceFindings(da).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
    expect(findings).toEqual(expect.arrayContaining([
      "warning:Source incomplete:SRC-02",
      "error:No prior:DA-OPEN",
      "error:No reason:DA-OPEN",
      "error:Boundary differs:DA-OPEN",
      "error:No exposure hours:DA-OPEN",
      "warning:No evidence rung:DA-OPEN",
    ]));
    expect(findings.filter((finding) => finding.endsWith(":DA-RUN") || finding.endsWith(":DA-ALARM"))).toEqual(["warning:Cut at one:DA-ALARM"]);
  });

  it("ships every built-in estimate of a catalog source, each passing the entry checks", async () => {
    expect(DA_SOURCE_CATALOG.map((source) => source.id).sort()).toEqual(["CCF-2020", "CREDO", "EBR-II-PRA", "EGG-SSRE-8875", "IAEA-TECDOC-478", "IAEA-TECDOC-719", "ICDE", "INL-2020", "MIL-HDBK-217F", "NASCORD", "NSWC-11", "NUCLARR", "NUREG-1715", "NUREG-1829", "NUREG-CR-4550", "NUREG-CR-5496", "NUREG-CR-5750", "NUREG-CR-6890", "SAND2020-10828", "SAND2022-14164", "WSRC-TR-93-262"].sort());
    const assets = readFileSync(join(__dirname, "../daCatalogAssets.mjs"), "utf-8");
    for (const catalog of DA_SOURCE_CATALOG) {
      const name = catalog.dataset;
      const entries = dataset(name);
      expect(entries).toHaveLength(catalog.estimates);
      expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
      expect(entries.every((entry) => entry.catalogCode === entry.id)).toBe(true);
      expect(assets.includes(`"${name}"`)).toBe(true);
      const errors = (await settledWithPraxis(() => sourceFindings({ ...blankDa(needs({})), sources: [{ ...catalogSourceOf(catalog.id, "SRC-01"), entries }] }))).filter((finding) => finding.severity === "error");
      expect(errors).toEqual([]);
    }
  }, 60000);

  it("lists the published rows and keeps a stored copy in their place", () => {
    const edited = { ...inlRow("AOV-FTO"), mean: 1e-3 };
    const own = { id: "E-001", component: "Helium valve", failureMode: "Fails to open", quantity: "PER_DEMAND" as const, mean: 2e-3 };
    const source: DaSource = { ...catalogSourceOf(DA_INL_2020_ID, "SRC-01"), entries: [edited, own] };
    const published = dataset("source-inl-2020.json");
    const rows = libraryEntries(source, published);
    expect(rows).toHaveLength(published.length + 1);
    expect(rows[0]).toBe(edited);
    expect(rows[rows.length - 1]).toBe(own);
    expect(libraryCount(source)).toBe(433);
    const da: DataAnalysis = { ...blankDa(needs({})), sources: [{ ...source, entries: [] }] };
    const once = withStoredEntry(da, "SRC-01", inlRow("AOV-FTC"));
    expect(once.sources?.[0]?.entries.map((entry) => entry.id)).toEqual(["AOV-FTC"]);
    expect(withStoredEntry(once, "SRC-01", inlRow("AOV-FTC")).sources?.[0]?.entries).toHaveLength(1);
  });

  it("ships a 95 percent interval as a lognormal about the mean", async () => {
    const row = dataset("source-nascord.json").find((entry) => entry.id === "NAS-PMP-MECH-FTR");
    if (row?.law === undefined) throw new Error("NAS-PMP-MECH-FTR has no law.");
    const response = await praxisUncertainty({ parameters: [], laws: [{ id: "0", value: { unit: "PER_HOUR", law: row.law }, probabilities: [0.025, 0.975], curveProbabilities: [] }], expressions: [], operations: [] });
    const summary = response.laws[0];
    if (summary === undefined || "error" in summary) throw new Error("PRAXIS gave no summary.");
    expect(Math.abs(summary.mean - 2.6e-5) / 2.6e-5).toBeLessThan(1e-9);
    const spread = (summary.quantiles[1]?.value ?? 0) / (summary.quantiles[0]?.value ?? 1);
    expect(Math.abs(spread - 3.6 / 1.7) / (3.6 / 1.7)).toBeLessThan(1e-4);
  });

  it("turns a frequency per year into a rate per hour", async () => {
    const ie: DaSource = { id: "SRC-03", name: "IE workbook", kind: "TECHNOLOGY", origin: "SAME_TECHNOLOGY", covers: "Initiators", yearsFrom: "1964", boundaryConvention: "Groups", failureCounting: "Counts", quality: "One plant", reference: "IE workbook", entries: [{ id: "IE-26", component: "Partial subassembly flow blockage", failureMode: "Member initiator frequency", quantity: "PER_YEAR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 3, exposure: 25 }] }, failures: 3, exposure: 25 }] };
    const use = { id: "U-1", sourceId: "SRC-03", entryId: "IE-26", verdict: "APPLIES" as const, boundary: "ADJUSTED" as const, reason: "The loop passage is larger." };
    const fields = { quantificationModel: "MISSION_PROBABILITY" as const, evidenceKind: "TECHNOLOGY" as const, evidenceReason: "The plant does not operate yet.", priorUseId: "U-1" };
    const open: DataAnalysis = { ...blankDa(needs({})), sources: [ie], parameters: [component("DA-1", { ...fields, sourceUses: [use] })] };
    expect(await settledWithPraxis(() => sourceFindings(open).map((finding) => finding.check))).toEqual(["No hours per year"]);
    const converted: DataAnalysis = { ...open, parameters: [component("DA-1", { ...fields, sourceUses: [{ ...use, hoursPerYear: 8760 }] })] };
    const prior = await settledWithPraxis(() => parameterPriorLaw(converted, converted.parameters[0] ?? component("x")));
    if (prior.status !== "ready") throw new Error("PRAXIS gave no prior.");
    expect(prior.value).toMatchObject({ quantity: "PER_HOUR", law: { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 3, exposure: expect.closeTo(25 * 8760, 6) }] } });
    expect(await settledWithPraxis(() => sourceFindings(converted))).toEqual([]);
  });

  it("imports per-year counts as a Poisson posterior", () => {
    const table = parseDelimited(["Code,Description,Failures,Exposure,Unit", "LOOP,Loss of offsite power,3,25,y", ""].join("\n"));
    const result = entriesFromRows(table.slice(1), guessMapping(table[0] ?? []), undefined, []);
    expect(result.entries.map((entry) => [entry.quantity, entry.law])).toEqual([["PER_YEAR", { family: "POSTERIOR", prior: null, evidence: [{ likelihood: "POISSON", failures: 3, exposure: 25 }] }]]);
  });

  it("imports a delimited file through a field mapping", () => {
    const text = "Code,Description,Failures,Demands or Hours,d or h,Distribution,Mean,5th,95th,α,β\nAOV-FTO,Air-Operated Valve Fails To Open,50,\"165,942\",d,Beta,3.04E-04,2.37E-04,3.78E-04,50.5,1.66E+05\nAOV-FC,Air-Operated Valve Fails To Control,167,\"1,109,287,000\",h,Gamma,1.75E-07,1.50E-08,4.86E-07,1.26,7.17E+06\n,,,,,,,,,,\n";
    const table = parseDelimited(text);
    const mapping = guessMapping(table[0] ?? []);
    expect(mapping).toMatchObject({ id: 0, failureMode: 1, failures: 2, exposure: 3, quantity: 4, distribution: 5, mean: 6, p05: 7, p95: 8, alpha: 9, beta: 10 });
    const result = entriesFromRows(table.slice(1), mapping, undefined, []);
    expect(result.skipped).toBe(0);
    expect(result.pending).toBe(0);
    expect(result.entries.map((entry) => [entry.id, entry.quantity, entry.exposure])).toEqual([["AOV-FTO", "PER_DEMAND", 165942], ["AOV-FC", "PER_HOUR", 1109287000]]);
    expect(result.entries.map((entry) => entry.law)).toEqual([{ family: "BETA", alpha: 50.5, beta: 1.66e5, lower: 0, upper: 1 }, { family: "GAMMA", shape: 1.26, rate: 7.17e6 }]);
    expect(result.entries.every((entry) => entry.distribution === undefined)).toBe(true);
  });

  it("pools an elicitation through PRAXIS and checks it against Section 4.2", async () => {
    const expert = (id: string, p05: number, median: number, p95: number) => ({ id, name: `Evaluator ${id}`, role: "EVALUATOR" as const, outside: true, expertise: "Passive cooling", p05, median, p95, acceptsResponsibility: true });
    const elicitation: DaElicitation = { id: "EJ-01", issue: "Duct blockage over 72 h", objective: "Prior for the duct parameter", quantity: "PROBABILITY", importance: "HIGH", complexity: "MEDIUM", structure: "PANEL", outsideReason: "No in-house operating experience", experts: [expert("A", 1e-3, 3e-3, 1e-2), expert("B", 5e-4, 2e-3, 8e-3), expert("C", 2e-3, 5e-3, 2e-2)], pooling: "LINEAR", integrator: "", responsibility: "INTEGRATOR" };
    const pooled = await settledWithPraxis(() => elicitationLaw(elicitation));
    if (pooled.status !== "ready" || pooled.law.family !== "MIXTURE") throw new Error("PRAXIS gave no pool.");
    expect(pooled.law.components.map((part) => part.weight)).toEqual([1, 1, 1]);
    const fits = await settledWithPraxis(() => elicitation.experts.map((expert) => operationLaw({ kind: "LOGNORMAL_FIT", mean: null, median: expert.median ?? 0, quantiles: [{ probability: 0.05, value: expert.p05 ?? 0 }, { probability: 0.95, value: expert.p95 ?? 0 }] })));
    const means = fits.map((fit) => (fit.status === "ready" && fit.law.family === "LOGNORMAL" ? fit.law.mean : Number.NaN));
    const summary = await settledWithPraxis(() => lawSummary("FACTOR", pooled.law));
    if (summary.status !== "ready") throw new Error("PRAXIS gave no summary.");
    const closed = elicitation.experts.map((expert) => {
      const sigma = Math.log((expert.p95 ?? 1) / (expert.p05 ?? 1)) / (2 * 1.6448536269514722);
      return (expert.median ?? 0) * Math.exp((sigma * sigma) / 2);
    });
    means.forEach((mean, index) => expect(Math.abs(mean / (closed[index] ?? 1) - 1)).toBeLessThan(1e-12));
    expect(Math.abs(summary.value.mean / (closed.reduce((total, mean) => total + mean, 0) / closed.length) - 1)).toBeLessThan(1e-9);
    const findings = (await settledWithPraxis(() => sourceFindings({ ...blankDa(needs({})), elicitations: [elicitation] }))).map((finding) => `${finding.check}:${finding.item}`);
    expect(findings).toEqual(["No owner:EJ-01", "Not used:EJ-01"]);
  });
});
