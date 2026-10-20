import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { EsqEventRecordSchema, EsqParameterRecordSchema } from "interfaces-mef-types/zod/esq/event-sequence-quantification";
import type { CcfFactorModel, UncertainExpression, UncertainParameter, UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { FrequencyUnit, type UncertainFrequency } from "interfaces-mef-types/core/events";
import type { InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { treeFrequency } from "interfaces-mef-types/esq/esq-run-inputs";
import {
  initiatorCodeLock,
  initiatorCodeTaken,
  initiatorRecordOf,
  modelComplete,
  modelViewOf,
  nextTypedInitiatorCode,
  parameterTableOf,
  withFamilyChoice,
  withFunctionLink,
  withInitiatorChoice,
  withInitiatorCode,
  withModelImported,
  withSequenceChoice,
  withTreeMissionTime,
  withTypedInitiator,
  withTypedInitiatorRecord,
  withTypedTrees,
  withValueBinding,
} from "../esqModel";
import { createdValues } from "../esqHandoff";
import { EMPTY_UPSTREAM } from "../esqLinks";
import { createEmptyEventTree } from "../../newly-developed-methods/event-tree";
import { stepsFromMef } from "../esqSelectors";
import { parametersFor } from "../../newly-developed-methods/shared/useUncertainty";
import { pointsOf } from "../../newly-developed-methods/shared/uncertaintyPoints";
import { evaluateUncertainty } from "../../newly-developed-methods/shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../newly-developed-methods/shared/test/praxisUncertainty";
import { PUMP_ESTIMATE, daParameter, fanMission, linkedEsq, liveImport, modelUpstream } from "./esqModelFixtures";

jest.mock("../../newly-developed-methods/shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

const NOW = "2026-10-05T12:00:00.000Z";

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

async function pointOf(esq: EventSequenceQuantification, expression: UncertainExpression | undefined, unit: UncertainUnit = "PER_YEAR"): Promise<number | undefined> {
  if (expression === undefined) return undefined;
  return (await pointsOf([{ key: "point", expression, unit }], parameterTableOf(esq))).get("point");
}

function hours(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value } } };
}

function storedImport(esq: EventSequenceQuantification = linkedEsq()): EventSequenceQuantification {
  return withModelImported(esq, modelUpstream(), NOW);
}

function imported(esq: EventSequenceQuantification = linkedEsq()): EventSequenceQuantification {
  return liveImport(esq, modelUpstream(), NOW);
}

function checks(esq: EventSequenceQuantification): string[] {
  return (modelViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function linkCooling(esq: EventSequenceQuantification): EventSequenceQuantification {
  return withFunctionLink(esq, "RT", { functionId: "RT", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } } });
}

function withDivision(expression: UncertainExpression): EventSequenceQuantification {
  const upstream = modelUpstream();
  const sy = upstream.sy;
  if (sy === undefined) throw new Error("SY fixture missing");
  sy.systemBasicEvents = sy.systemBasicEvents.map((event) => (event.uuid === "E-4" ? { ...event, expression } : event));
  return linkCooling(liveImport(linkedEsq(), upstream, NOW));
}

function resolvedEsq(): EventSequenceQuantification {
  let esq = linkCooling(imported());
  esq = withFunctionLink(esq, "COOL", { functionId: "COOL", rules: [{ id: "R-1", groupIds: ["IEG-01"], stateIds: ["POS-02"], target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } }, reason: "Shutdown uses the same cooling train." }] });
  esq = withFamilyChoice(esq, "F-REL", { familyId: "F-REL", groupingReason: "Both states release through the same path." });
  esq = withFamilyChoice(esq, "F-OK", { familyId: "F-OK", groupingReason: "No release in either state." });
  return esq;
}

describe("ESQ Step 02 common cause checks", () => {
  const vectorReference = { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: "da-1", entityId: "ccfv/SRC-06/CCF-DEM/ALPHA_DIRICHLET/C3" };

  function withGroup(factors: CcfFactorModel): EventSequenceQuantification {
    const upstream = modelUpstream();
    const sy = upstream.sy;
    const da = upstream.da;
    if (sy === undefined || da === undefined) throw new Error("fixtures missing");
    da.ccfVectors = [{ id: vectorReference.entityId, sourceId: "SRC-06", kind: "ALPHA_DIRICHLET", template: "CCF-DEM", groupSize: 3, rowIds: [], vector: { family: "DIRICHLET", concentrations: [3, 2, 1] } }];
    da.ccfFactors = [{ id: "ccff/SRC-21/EB-T7-36-BETAN-N2", sourceId: "SRC-21", rowId: "EB-T7-36-BETAN-N2", expression: { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: 0.1 } } } }];
    sy.commonCauseFailureGroups = [{ uuid: "CCF-1", name: "Pump and division", description: "", scope: "INTERSYSTEM", affectedComponents: [], affectedSystems: ["SYS-COOL", "SYS-RPS"], factors, members: { basicEvents: [{ id: "E-1" }, { id: "E-4" }] }, implementsSrs: [] }];
    let esq = linkCooling(liveImport(linkedEsq(), upstream, NOW));
    esq = withFunctionLink(esq, "COOL", { functionId: "COOL", rules: [{ id: "R-1", groupIds: ["IEG-01"], stateIds: ["POS-02"], target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } }, reason: "Shutdown uses the same cooling train." }] });
    return esq;
  }

  it("reads the DA vectors and factors the common cause groups link from the live DA workbook", () => {
    const esq = withGroup({ model: "ALPHA_FACTOR", testing: "STAGGERED", alphas: { node: "PARAMETER", reference: vectorReference } });
    expect(esq.model?.vectors).toEqual([{ reference: vectorReference, vector: { family: "DIRICHLET", concentrations: [3, 2, 1] } }]);
    expect(esq.model?.ccfFactors?.map((factor) => factor.reference.entityId)).toEqual(["ccff/SRC-21/EB-T7-36-BETAN-N2"]);
    expect(checks(esq)).toContain("error:Common cause factors:CCF-1");
    expect(modelViewOf(esq)?.findings.find((finding) => finding.check === "Common cause factors")?.detail).toBe("Alpha factor needs exactly 2 factors for 2 members, not 3.");
  });

  it("matches the PRAXIS size rules for phi and the binomial failure rate", () => {
    const phi = withGroup({ model: "PHI_FACTOR", phis: { node: "VALUE", law: { family: "FIXED", values: [1] } } });
    expect(modelViewOf(phi)?.findings.find((finding) => finding.check === "Common cause factors")?.detail).toBe("Phi factor needs exactly 2 factors for 2 members, not 1.");
    const bfr = withGroup({ model: "BINOMIAL_FAILURE_RATE", independent: daParameter("P-1"), nonLethalShock: daParameter("P-PT"), componentFailure: { node: "VALUE", value: { unit: "FRACTION", law: { family: "POINT", value: 0.4 } } }, lethalShock: daParameter("P-PT") });
    expect(checks(bfr).filter((line) => line.includes("Common cause"))).toEqual([]);
    expect(bfr.model?.ccfGroups[0]?.total).toBeUndefined();
  });
});

describe("ESQ Step 02 model import", () => {
  it("imports trees, sequences, families, functions, tops and values from the linked workbooks", () => {
    const model = imported().model;
    expect(model?.trees.map((tree) => `${tree.id}:${tree.transferEntry}`)).toEqual(["ET-A:false", "ET-B:false", "ET-T:true"]);
    expect(model?.sequences.find((sequence) => sequence.id === "A-3")).toMatchObject({ transferTreeId: "ET-T", transferCarries: ["Trip failed"], path: { RT: "FAILURE" } });
    expect(model?.sequences.find((sequence) => sequence.id === "A-2")).toMatchObject({ familyId: "F-REL", releaseCategoryId: "RC-1", path: { RT: "SUCCESS", COOL: "FAILURE" } });
    expect(model?.functions.map((record) => `${record.id}:${record.treeIds.length}:${record.esLinks.length}`)).toEqual(["RT:1:0", "COOL:3:2"]);
    expect(model?.tops.map((top) => `${top.code}:${top.transferModelIds.join(",")}`)).toEqual(["COOL-TOP:M-SUP", "SUP-TOP:", "RPS-TOP:"]);
    expect(model?.events.map((event) => `${event.code}:${event.heldBy}:${event.holderId ?? ""}`)).toEqual(["COOL-PMP-FS:DA:P-1", "SUP-HFE:HRA:HFE-1", "SUP-FAN-FR:TYPED:", "RPS-DIV-FS:TYPED:"]);
    expect(model?.initiators[0]).toMatchObject({ id: "IEG-01", frequency: { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "LOGNORMAL", mean: 2.943, errorFactor: 2.3, level: 0.95 } } }, basis: "per-plant-year" }, stateIds: ["POS-01", "POS-02"] });
    expect(model?.changes).toBeUndefined();
  });

  it("copies the SY expression of component events and links the DA parameters", () => {
    const model = imported().model;
    const pump = model?.events.find((event) => event.id === "E-1");
    expect(pump).toMatchObject({ failureMode: "FAILURE_TO_START", expression: daParameter("P-1"), heldBy: "DA", holderId: "P-1" });
    expect(pump).not.toHaveProperty("value");
    expect(pump).not.toHaveProperty("valueUnit");
    expect(pump).not.toHaveProperty("missionTime");
    expect(model?.events.find((event) => event.id === "E-2")).toMatchObject({ failureMode: "HUMAN_ERROR", value: 1e-3, valueUnit: "PROBABILITY", missionTime: hours(24) });
    expect(model?.trees.every((tree) => tree.missionTime === undefined)).toBe(true);
    expect(model?.events.find((event) => event.id === "E-2")).not.toHaveProperty("expression");
    expect(storedImport().model?.parameters.find((parameter) => parameter.id === "P-1")).toEqual({ id: "P-1", name: "Pump fails to start", parameterType: "PROBABILITY" });
    const estimate = model?.parameters.find((parameter) => parameter.id === "P-1");
    expect(estimate).toEqual({ id: "P-1", name: "Pump fails to start", parameterType: "PROBABILITY", quantificationModel: "DEMAND_PROBABILITY", estimate: PUMP_ESTIMATE, evidenceKind: "GENERIC_NUCLEAR" });
    expect(model?.parameters.find((parameter) => parameter.id === "P-IE")).toEqual({ id: "P-IE", name: "Loss of cooling", parameterType: "FREQUENCY", quantificationModel: "FREQUENCY", estimate: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 3 } } } });
    expect(model?.parameters.find((parameter) => parameter.id === "P-SF")).toMatchObject({ value: 0.01, valueType: "MEAN", distribution: { median: 8e-3, errorFactor: 3 } });
    for (const event of model?.events ?? []) expect(EsqEventRecordSchema.safeParse(event).success).toBe(true);
    for (const parameter of model?.parameters ?? []) expect(EsqParameterRecordSchema.safeParse(parameter).success).toBe(true);
  });

  it("weights each group frequency by the hours in its operating states", async () => {
    const esq = imported();
    const view = modelViewOf(esq);
    const states = view?.initiators[0]?.states ?? [];
    expect(states.find((state) => state.stateId === "POS-01")?.share).toBe(7300 / 7894);
    expect(await pointOf(esq, states.find((state) => state.stateId === "POS-01")?.expression)).toBeCloseTo(2.943 * 7300 / 7894, 12);
    expect(await pointOf(esq, states.find((state) => state.stateId === "POS-02")?.expression)).toBeCloseTo(2.943 * 594 / 7894, 12);
    expect(view?.initiators[0]?.hours).toBe(7894);
  });

  it("uses typed shares when the plan asks for them and checks they add up", async () => {
    let esq = imported();
    esq = { ...esq, quantificationPlan: { stateWeighting: { value: "TYPED_SHARES", reason: "Startup carries more of the frequency." } } };
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "IE", shares: [{ stateId: "POS-01", percent: 80 }, { stateId: "POS-02", percent: 10 }] });
    expect(checks(esq)).toContain("error:Shares do not add up:IEG-01");
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "IE", shares: [{ stateId: "POS-01", percent: 80 }, { stateId: "POS-02", percent: 20 }] });
    const states = modelViewOf(esq)?.initiators[0]?.states ?? [];
    expect(await pointOf(esq, states.find((state) => state.stateId === "POS-02")?.expression)).toBeCloseTo(2.943 * 0.2, 12);
    expect(checks(esq).some((entry) => entry.startsWith("error:Shares"))).toBe(false);
  });

  it("takes a typed or DA frequency in place of the IE value", async () => {
    let esq = withInitiatorChoice(imported(), "IEG-01", { groupId: "IEG-01", source: "DA", parameterId: "P-IE" });
    expect(modelViewOf(esq)?.initiators[0]?.expression).toEqual(daParameter("P-IE"));
    expect(await pointOf(esq, modelViewOf(esq)?.initiators[0]?.expression)).toBe(3);
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "TYPED", expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 1.5 } } } });
    expect(await pointOf(esq, modelViewOf(esq)?.initiators[0]?.expression)).toBe(1.5);
    expect(checks(esq)).toEqual(expect.arrayContaining(["warning:No basis:IEG-01", "warning:No distribution:IEG-01"]));
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "TYPED", expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "GAMMA", shape: 1.5, rate: 1 } } }, basis: "Fleet data." });
    expect(checks(esq).filter((entry) => entry.endsWith(":IEG-01") && entry.startsWith("warning:No"))).toEqual([]);
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "TYPED", expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-other", entityId: "P-IE" } }, basis: "Fleet data." });
    expect(checks(esq).filter((entry) => entry.endsWith(":IEG-01"))).toEqual([]);
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "DA", parameterId: "P-SF" });
    expect(checks(esq)).toContain("error:No DA estimate:IEG-01");
  });

  it("gives a tree drawn in a new project its typed frequency when no operating state exists", () => {
    const typed: UncertainExpression = { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.5 } } };
    let esq = withTypedTrees(linkedEsq(), [{ ...createEmptyEventTree("IE-1"), label: "ET-ESQ-01" }], EMPTY_UPSTREAM, NOW);
    esq = withInitiatorChoice(esq, "IE-1", { groupId: "IE-1", source: "TYPED", expression: typed, unit: FrequencyUnit.PER_REACTOR_YEAR, basis: "Fleet data." });
    const model = esq.model;
    const tree = model?.trees.find((candidate) => candidate.code === "ET-ESQ-01");
    if (model === undefined || tree === undefined) throw new Error("the drawn tree is not in the model");
    expect(tree.stateId).toBeUndefined();
    expect(treeFrequency(esq, model, tree)).toEqual(typed);
    expect(checks(esq)).toContain("warning:No operating state:IE-1");
    expect(checks(esq)).not.toContain("error:No operating state:IE-1");
  });

  it("resolves each tree from a rule, then the ESQ default, then the ES link", () => {
    let esq = imported();
    const cool = (): { tree: string; origin: string }[] => (modelViewOf(esq)?.functions.find((view) => view.record.id === "COOL")?.resolved ?? []).map((entry) => ({ tree: entry.tree.id, origin: entry.link.origin }));
    expect(cool()).toEqual([{ tree: "ET-A", origin: "ES" }, { tree: "ET-B", origin: "NONE" }, { tree: "ET-T", origin: "ES" }]);
    esq = withFunctionLink(esq, "COOL", { functionId: "COOL", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } }, rules: [{ id: "R-1", groupIds: [], stateIds: ["POS-02"], target: { kind: "SPLIT_FRACTION", expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "LOGNORMAL", mean: 0.01, errorFactor: 3, level: 0.95 } } }, basis: "Shutdown cooling demand." }, reason: "No shutdown model in SY." }] });
    expect(cool()).toEqual([{ tree: "ET-A", origin: "ESQ" }, { tree: "ET-B", origin: "RULE" }, { tree: "ET-T", origin: "ESQ" }]);
    expect(checks(esq)).toContain("error:Changed without a reason:COOL");
  });

  it("lists every function that a tree in scope leaves unlinked", () => {
    expect(checks(imported())).toEqual(expect.arrayContaining(["error:Not linked:RT", "error:Not linked:COOL"]));
    expect(checks(linkCooling(imported()))).not.toContain("error:Not linked:RT");
  });

  it("counts the transfer tree through its parent and keeps transfer sequences out of families", () => {
    const view = modelViewOf(imported());
    expect(view?.trees.map((tree) => tree.id)).toEqual(["ET-A", "ET-B", "ET-T"]);
    expect(view?.sequences.find((sequence) => sequence.record.id === "A-3")?.familyId).toBeUndefined();
    expect(view?.initiators.map((initiator) => initiator.id)).toEqual(["IEG-01"]);
    expect(checks(imported())).toContain("note:Transfer in a family:A-3");
  });

  it("asks for a reason when a family mixes operating states", () => {
    let esq = imported();
    expect(checks(esq)).toEqual(expect.arrayContaining(["error:Mixed without a reason:F-REL", "error:Mixed without a reason:F-OK"]));
    esq = withFamilyChoice(esq, "F-REL", { familyId: "F-REL", groupingReason: "Both states release through the same path." });
    expect(checks(esq)).not.toContain("error:Mixed without a reason:F-REL");
  });

  it("asks for a reason when a sequence moves to another family", () => {
    const esq = withSequenceChoice(imported(), "A-2", { sequenceId: "A-2", familyId: "F-OK", reason: "" });
    expect(modelViewOf(esq)?.sequences.find((sequence) => sequence.record.id === "A-2")?.familyId).toBe("F-OK");
    expect(checks(esq)).toContain("error:Changed without a reason:A-2");
  });

  it("reaches basic events through transfers and flags values below CC-II", () => {
    let esq = linkCooling(imported());
    const values = modelViewOf(esq)?.values ?? [];
    expect(values.map((value) => `${value.code}:${value.functionIds.join(",")}`)).toEqual(["COOL-PMP-FS:COOL", "SUP-HFE:COOL", "SUP-FAN-FR:COOL", "RPS-DIV-FS:RT"]);
    expect(values.find((value) => value.code === "COOL-PMP-FS")).toMatchObject({ component: true, expression: daParameter("P-1") });
    expect(values.find((value) => value.code === "COOL-PMP-FS")).not.toHaveProperty("value");
    expect(values.find((value) => value.code === "SUP-HFE")).toMatchObject({ component: false, expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 1e-3 } } } });
    expect(checks(esq)).toEqual(expect.arrayContaining(["warning:Not bound:SUP-FAN-FR", "warning:Not bound:RPS-DIV-FS", "warning:No distribution:SUP-FAN-FR", "warning:No distribution:RPS-DIV-FS"]));
    expect(checks(esq)).not.toContain("warning:No distribution:COOL-PMP-FS");
    esq = withValueBinding(esq, "E-4", { eventId: "E-4", heldBy: "DA", holderId: "P-PT", reason: "" });
    expect(modelViewOf(esq)?.values.find((value) => value.code === "RPS-DIV-FS")?.expression).toEqual(daParameter("P-PT"));
    expect(checks(esq)).toEqual(expect.arrayContaining(["error:Changed without a reason:RPS-DIV-FS", "warning:No distribution:RPS-DIV-FS"]));
    expect(checks(esq)).not.toContain("warning:Point estimate at CC-II:RPS-DIV-FS");
    expect(checks({ ...esq, capabilityCategory: "CC-I" }).some((entry) => entry.includes("CC-II") || entry.includes("No distribution"))).toBe(false);
  });

  it("puts a DA rate into the one rate of the SY mission model and refuses it elsewhere", () => {
    const rate = "Fan fails to run is a rate. Bind it only to an event whose SY value is a mission or standby model of one rate.";
    const typed = withValueBinding(linkCooling(imported()), "E-3", { eventId: "E-3", heldBy: "DA", holderId: "P-FR", reason: "Fleet data for the fan." });
    expect(modelViewOf(typed)?.values.find((value) => value.code === "SUP-FAN-FR")?.problem).toBe(rate);
    expect(checks(typed)).toContain("error:Value cannot be used:SUP-FAN-FR");
    const upstream = modelUpstream();
    const sy = upstream.sy;
    if (sy === undefined) throw new Error("SY fixture missing");
    sy.systemBasicEvents = sy.systemBasicEvents.map((event) => (event.uuid === "E-3" ? { ...event, expression: fanMission(daParameter("P-OLD")) } : event));
    let esq = withValueBinding(linkCooling(liveImport(linkedEsq(), upstream, NOW)), "E-3", { eventId: "E-3", heldBy: "DA", holderId: "P-FR", reason: "Fleet data for the fan." });
    const fan = modelViewOf(esq)?.values.find((value) => value.code === "SUP-FAN-FR");
    expect(fan?.expression).toEqual(fanMission(daParameter("P-FR")));
    expect(fan?.missionTime).toEqual(hours(24));
    expect(checks(esq)).not.toContain("warning:No distribution:SUP-FAN-FR");
    expect(checks(esq).filter((entry) => entry.endsWith(":SUP-FAN-FR") && entry.startsWith("error"))).toEqual([]);
    esq = withValueBinding(esq, "E-4", { eventId: "E-4", heldBy: "DA", holderId: "P-FR", reason: "Wrong binding." });
    expect(modelViewOf(esq)?.values.find((value) => value.code === "RPS-DIV-FS")?.problem).toBe(rate);
    expect(checks(esq)).toContain("error:Value cannot be used:RPS-DIV-FS");
  });

  it("runs a typed SY expression of several DA parameters when every reference resolves", () => {
    const product: UncertainExpression = { node: "OPERATION", operation: "MULTIPLY", operands: [daParameter("P-1"), daParameter("P-PT")] };
    const esq = withDivision(product);
    expect(esq.model?.events.find((event) => event.id === "E-4")).toMatchObject({ heldBy: "TYPED", expression: product });
    expect(checks(esq).filter((entry) => entry.startsWith("error") && entry.endsWith(":RPS-DIV-FS"))).toEqual([]);
    expect(checks(esq)).toContain("warning:Not bound:RPS-DIV-FS");
    expect(checks(esq)).not.toContain("warning:No distribution:RPS-DIV-FS");
    const division = modelViewOf(esq)?.values.find((value) => value.code === "RPS-DIV-FS")?.expression;
    if (division === undefined) throw new Error("no expression");
    expect(parametersFor([division], parameterTableOf(esq)).map((parameter) => parameter.reference.entityId)).toEqual(["P-1", "P-PT"]);
  });

  it("shows each DA reference a run would refuse and leaves values from other workbooks to the run", () => {
    const foreign: UncertainExpression = { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-9", entityId: "P-1" } };
    const product: UncertainExpression = { node: "OPERATION", operation: "MULTIPLY", operands: [daParameter("P-9"), daParameter("P-SF"), foreign] };
    const esq = withDivision(product);
    const findings = (modelViewOf(esq)?.findings ?? []).filter((finding) => finding.item === "RPS-DIV-FS" && finding.severity === "error").map((finding) => `${finding.check}:${finding.detail}`);
    expect(findings).toEqual(["DA parameter missing:RPS-DIV-FS reads DA parameter P-9, which the Step 02 import does not hold."]);
  });

  it("warns through PRAXIS points when a tree lasts longer than the running events under its functions", async () => {
    const missionChecks = (esq: EventSequenceQuantification, table: ReadonlyMap<string, UncertainParameter>): Promise<string[]> =>
      settledWithPraxis(() => (modelViewOf(esq, undefined, table)?.findings ?? []).filter((finding) => finding.check.startsWith("Mission time") || finding.check === "No tree mission time").map((finding) => `${finding.severity}:${finding.check}:${finding.item}`));
    const untimedUpstream = modelUpstream();
    const es = untimedUpstream.es;
    if (es === undefined) throw new Error("ES fixture missing");
    untimedUpstream.es = { ...es, eventTrees: (es.eventTrees ?? []).map(({ missionTime: _hours, ...tree }) => tree) };
    expect(await missionChecks(liveImport(linkedEsq(), untimedUpstream, NOW), new Map())).toEqual(["note:No tree mission time:ET-A, ET-B and ET-T"]);
    const base = imported();
    expect(base.model?.trees.map((tree) => tree.esMissionTime)).toEqual([hours(72), hours(72), hours(72)]);
    expect(await missionChecks(base, new Map())).toEqual(["warning:Mission time:COOL"]);
    expect(checks(withTreeMissionTime(base, "ET-A", hours(72))).some((entry) => entry.includes("Mission time"))).toBe(false);
    const typed = withTreeMissionTime(withTreeMissionTime(withTreeMissionTime(base, "ET-A", hours(72)), "ET-B", hours(24)), "ET-T", hours(24));
    expect(await missionChecks(typed, new Map())).toEqual(["warning:Mission time:COOL"]);
    const scReference = { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: "sc-1", entityId: "MT-LONG" };
    const law: UncertainExpression = { node: "VALUE", value: { unit: "HOURS", law: { family: "LOGNORMAL", mean: 72, errorFactor: 2, level: 0.95 } } };
    const linked = withTreeMissionTime(typed, "ET-A", { node: "PARAMETER", reference: scReference });
    const table = new Map([["sc-1:MT-LONG", { reference: scReference, expression: law }]]);
    expect(await missionChecks(linked, table)).toEqual(["warning:Mission time:COOL"]);
    const short = new Map([["sc-1:MT-LONG", { reference: scReference, expression: hours(12) }]]);
    expect(await missionChecks(linked, short)).toEqual([]);
    expect((await missionChecks(linked, new Map())).map((entry) => entry.split(":").slice(0, 2).join(":"))).toEqual(["warning:Mission time not checked"]);
  });

  it("keeps a tree mission time across a new import", () => {
    const first = withTreeMissionTime(storedImport(), "ET-A", hours(72));
    const again = withModelImported(first, modelUpstream(), NOW);
    expect(again.model?.trees.find((tree) => tree.id === "ET-A")?.missionTime).toEqual(hours(72));
    expect(again.model?.changes).toEqual([]);
  });

  it("records what changed on a new import and keeps the ESQ choices", () => {
    const first = withFamilyChoice(storedImport(), "F-REL", { familyId: "F-REL", groupingReason: "Kept." });
    const upstream = modelUpstream();
    const es = upstream.es;
    if (es === undefined) throw new Error("ES fixture missing");
    upstream.es = {
      ...es,
      eventSequenceFamilies: es.eventSequenceFamilies.map((family) => (family.uuid === "F-OK" ? { ...family, name: "Safe and stable" } : family)),
      eventTrees: (es.eventTrees ?? []).filter((tree) => tree.uuid !== "ET-B"),
      eventSequences: es.eventSequences.filter((sequence) => sequence.eventTreeId !== "ET-B"),
    };
    const next = withModelImported(first, upstream, "2026-10-06T12:00:00.000Z");
    const changes = (next.model?.changes ?? []).map((change) => `${change.table}:${change.id}:${change.change}`);
    expect(changes).toEqual(expect.arrayContaining(["TREE:ET-B:REMOVED", "SEQUENCE:B-1:REMOVED", "FAMILY:F-OK:CHANGED"]));
    expect(next.modelDecisions?.familyChoices?.[0]?.groupingReason).toBe("Kept.");
    expect(withModelImported(next, upstream, "2026-10-07T12:00:00.000Z").model?.changes).toEqual([]);
  });

  it("reports no change when the stored rows differ from a new import only in key order", () => {
    const first = storedImport();
    const model = first.model;
    if (model === undefined) throw new Error("Model missing");
    const reordered = <T extends object>(row: T): T => Object.fromEntries(Object.entries(row).reverse()) as T;
    const stored = { ...first, model: { ...model, trees: model.trees.map(reordered), sequences: model.sequences.map(reordered), events: model.events.map(reordered) } };
    expect(withModelImported(stored, modelUpstream(), "2026-10-06T12:00:00.000Z").model?.changes).toEqual([]);
  });

  it("drops null fields that stored workbooks carry", () => {
    const upstream = modelUpstream();
    const nulled = <T>(value: T): T => JSON.parse(JSON.stringify(value, (_key, entry: string | number | boolean | object | null | undefined) => (entry === undefined ? null : entry)));
    const es = upstream.es;
    if (es === undefined) throw new Error("ES fixture missing");
    upstream.es = nulled({ ...es, eventSequences: es.eventSequences.map((sequence) => ({ ...sequence, releaseCategoryId: undefined, eventTreeId: sequence.eventTreeId })) });
    const esq = withModelImported(linkedEsq(), upstream, NOW);
    expect(JSON.stringify({ ...esq.model, parameters: [] })).not.toContain("null");
    expect(esq.model?.parameters.find((parameter) => parameter.id === "P-1")).toEqual({ id: "P-1", name: "Pump fails to start", parameterType: "PROBABILITY" });
    expect(esq.model?.sequences.find((sequence) => sequence.id === "A-2")?.releaseCategoryId).toBeUndefined();
  });

  it("leaves trees out when Step 01 excludes their operating state", () => {
    const base = imported();
    const esq: EventSequenceQuantification = { ...base, modelIntegration: { ...base.modelIntegration, scopeExclusions: [{ aspect: "OPERATING_STATE", item: "Shutdown", reason: "Covered by the shutdown PRA." }] } };
    const view = modelViewOf(esq);
    expect(view?.trees.map((tree) => tree.id)).toEqual(["ET-A", "ET-T"]);
    expect(view?.outOfScope).toBe(2);
  });

  it("completes the step once no check is an error", () => {
    expect(modelComplete(imported())).toBe(false);
    const esq = resolvedEsq();
    expect(checks(esq).filter((entry) => entry.startsWith("error"))).toEqual([]);
    expect(modelComplete(esq)).toBe(true);
    expect(stepsFromMef(esq, "preparer").find((step) => step.id === "model")?.status).toBe("complete");
  });
});

describe("ESQ Step 02 initiating events typed in ESQ", () => {
  const frequency: UncertainFrequency = { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.02 } } }, basis: FrequencyUnit.PER_REACTOR_YEAR };

  function drawn(stateId?: string): EventSequenceQuantification {
    return withTypedTrees(linkedEsq(), [{ ...createEmptyEventTree("IEG-ESQ-01", stateId), label: "ET-ESQ-01" }], EMPTY_UPSTREAM, NOW);
  }

  function typedHere(stateIds: string[] = []): EventSequenceQuantification {
    return withTypedInitiator(drawn(stateIds[0]), { id: "IEG-ESQ-01", name: "Loss of forced cooling", stateIds, frequency, heldBy: "TYPED" }, EMPTY_UPSTREAM, NOW);
  }

  it("quantifies a drawn tree from the initiating event typed in its tree", () => {
    const esq = typedHere();
    const model = esq.model;
    const tree = model?.trees.find((candidate) => candidate.code === "ET-ESQ-01");
    if (model === undefined || tree === undefined) throw new Error("the drawn tree is not in the model");
    expect(model.initiators).toEqual([{ id: "IEG-ESQ-01", name: "Loss of forced cooling", stateIds: [], frequency, heldBy: "TYPED", typed: true }]);
    expect(treeFrequency(esq, model, tree)).toEqual(frequency.expression);
    expect(checks(esq).filter((entry) => entry.startsWith("error") && entry.endsWith(":IEG-ESQ-01"))).toEqual([]);
    expect(checks(esq)).toContain("warning:No distribution:IEG-ESQ-01");
  });

  it("replaces the IE record and the old typed choice when an IE initiating event is edited in its tree", () => {
    const shares = [{ stateId: "POS-01", percent: 90 }, { stateId: "POS-02", percent: 10 }];
    let esq = withInitiatorChoice(imported(), "IEG-01", { groupId: "IEG-01", source: "TYPED", expression: frequency.expression, unit: FrequencyUnit.PER_REACTOR_YEAR, basis: "Fleet data.", shares });
    const record = initiatorRecordOf(esq, "IEG-01");
    expect(record).toMatchObject({ id: "IEG-01", name: "Loss of cooling", heldBy: "TYPED", frequency });
    esq = withTypedInitiator(esq, { ...record, name: "Loss of cooling in both loops" }, modelUpstream(), NOW);
    expect(esq.modelDecisions?.initiatorChoices).toEqual([{ groupId: "IEG-01", source: "IE", shares }]);
    expect(esq.model?.initiators.filter((entry) => entry.id === "IEG-01")).toEqual([expect.objectContaining({ name: "Loss of cooling in both loops", typed: true, frequency })]);
    expect(withModelImported(esq, modelUpstream(), NOW).model?.initiators.filter((entry) => entry.id === "IEG-01")).toEqual([expect.objectContaining({ name: "Loss of cooling in both loops", typed: true })]);
  });

  it("picks the next ESQ code that no tree, coverage item or IE group uses", () => {
    const esq = drawn();
    expect(nextTypedInitiatorCode(esq)).toBe("IEG-ESQ-02");
    const ie = { initiatingEventGroups: [{ uuid: "ieg-esq-02" }] } as InitiatingEventsAnalysis;
    expect(nextTypedInitiatorCode(esq, ie)).toBe("IEG-ESQ-03");
  });

  it("words the checks of an ESQ initiating event without naming IE", () => {
    const detail = modelViewOf(typedHere(["POS-01", "POS-02"]))?.findings.find((finding) => finding.check === "State without a tree")?.detail;
    expect(detail).toBe("IEG-ESQ-01 applies to POS-02, but no tree starts with it there.");
  });

  it("renames an initiating event code everywhere ESQ uses it and marks the IE group for renaming", () => {
    let esq = withInitiatorChoice(typedHere(["POS-01"]), "IEG-ESQ-01", { groupId: "IEG-ESQ-01", source: "IE", shares: [{ stateId: "POS-01", percent: 100 }] });
    esq = {
      ...esq,
      modelIntegration: { ...esq.modelIntegration, scopeCoverage: { ...esq.modelIntegration.scopeCoverage, initiatingEventGroups: ["IEG-ESQ-01"] } },
      logic: { flags: [{ id: "FL-1", name: "Long outage", state: true, groupIds: ["IEG-ESQ-01"], stateIds: [], basis: "" }] },
      modelDecisions: { ...esq.modelDecisions, typedInitiators: (esq.modelDecisions?.typedInitiators ?? []).map((entry) => ({ ...entry, synced: { workbookId: "ie-1", fingerprint: "pushed" } })) },
    };
    const renamed = withInitiatorCode(esq, "IEG-ESQ-01", "IEG-LOFC", EMPTY_UPSTREAM, NOW);
    expect(renamed.modelDecisions?.typedTrees?.map((tree) => tree.initiatingEventId)).toEqual(["IEG-LOFC"]);
    expect(renamed.model?.trees.find((tree) => tree.code === "ET-ESQ-01")?.initiatorId).toBe("IEG-LOFC");
    expect(renamed.model?.initiators.map((record) => record.id)).toEqual(["IEG-LOFC"]);
    expect(renamed.modelDecisions?.initiatorChoices).toEqual([{ groupId: "IEG-LOFC", source: "IE", shares: [{ stateId: "POS-01", percent: 100 }] }]);
    expect(renamed.modelIntegration.scopeCoverage.initiatingEventGroups).toEqual(["IEG-LOFC"]);
    expect(renamed.logic?.flags?.[0]?.groupIds).toEqual(["IEG-LOFC"]);
    expect(renamed.modelDecisions?.typedInitiators?.[0]).toMatchObject({ id: "IEG-LOFC", name: "Loss of forced cooling", synced: { workbookId: "ie-1", fingerprint: "pushed", groupId: "IEG-ESQ-01" } });
  });

  it("moves a name that was only the code along with the code", () => {
    const esq = withTypedTrees(linkedEsq(), [{ ...createEmptyEventTree("IE-1"), label: "ET-ESQ-01" }], EMPTY_UPSTREAM, NOW);
    const renamed = withInitiatorCode(esq, "IE-1", "LOFC", EMPTY_UPSTREAM, NOW);
    expect(renamed.modelDecisions?.typedInitiators).toEqual([expect.objectContaining({ id: "LOFC", name: "LOFC" })]);
    expect(renamed.model?.trees.find((tree) => tree.code === "ET-ESQ-01")?.initiatorId).toBe("LOFC");
  });

  it("refuses a code in use and locks codes that IE or ES own", () => {
    const esq = typedHere();
    expect(initiatorCodeTaken(esq, "ieg-esq-01", "IE-9")).toBe(true);
    expect(initiatorCodeTaken(esq, "IEG-LOFC", "IEG-ESQ-01")).toBe(false);
    expect(initiatorCodeLock(esq, "IEG-ESQ-01")).toBeUndefined();
    const fromIe = imported();
    expect(initiatorCodeLock(fromIe, "IEG-01")).toBe("IE");
    expect(withTypedInitiatorRecord(fromIe, initiatorRecordOf(fromIe, "IEG-01")).modelDecisions?.typedInitiators?.[0]?.ieOwned).toBe(true);
    expect(initiatorCodeLock(liveImport(linkedEsq(), { ...modelUpstream(), ie: undefined }, NOW), "IEG-01")).toBe("ES");
  });

  it("lists the typed frequency as a value made in ESQ until the IE workbook holds it", () => {
    let esq = typedHere();
    expect(createdValues(esq).filter((entry) => entry.key === "initiator:IEG-ESQ-01")).toEqual([{ key: "initiator:IEG-ESQ-01", item: "IEG-ESQ-01", expression: frequency.expression, where: "Step 02 initiating event frequency", source: "" }]);
    const typedInitiators = (esq.modelDecisions?.typedInitiators ?? []).map((entry) => ({ ...entry, synced: { workbookId: "ie-1", fingerprint: "pushed" } }));
    esq = { ...esq, modelDecisions: { ...esq.modelDecisions, typedInitiators } };
    expect(createdValues(esq).some((entry) => entry.key === "initiator:IEG-ESQ-01")).toBe(false);
  });
});
