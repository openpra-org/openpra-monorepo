import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  modelComplete,
  modelViewOf,
  withFamilyChoice,
  withFunctionLink,
  withInitiatorChoice,
  withModelImported,
  withSequenceChoice,
  withValueBinding,
} from "../esqModel";
import { stepsFromMef } from "../esqSelectors";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-10-05T12:00:00.000Z";

function imported(esq: EventSequenceQuantification = linkedEsq()): EventSequenceQuantification {
  return withModelImported(esq, modelUpstream(), NOW);
}

function checks(esq: EventSequenceQuantification): string[] {
  return (modelViewOf(esq)?.findings ?? []).map((finding) => `${finding.severity}:${finding.check}:${finding.item}`);
}

function linkCooling(esq: EventSequenceQuantification): EventSequenceQuantification {
  return withFunctionLink(esq, "RT", { functionId: "RT", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } } });
}

function resolvedEsq(): EventSequenceQuantification {
  let esq = linkCooling(imported());
  esq = withFunctionLink(esq, "COOL", { functionId: "COOL", rules: [{ id: "R-1", groupIds: ["IEG-01"], stateIds: ["POS-02"], target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-COOL", gateId: "G-COOL" } }, reason: "Shutdown uses the same cooling train." }] });
  esq = withFamilyChoice(esq, "F-REL", { familyId: "F-REL", groupingReason: "Both states release through the same path." });
  esq = withFamilyChoice(esq, "F-OK", { familyId: "F-OK", groupingReason: "No release in either state." });
  return esq;
}

describe("ESQ Step 02 model import", () => {
  it("imports trees, sequences, families, functions, tops and values from the linked workbooks", () => {
    const model = imported().model;
    expect(model?.trees.map((tree) => `${tree.id}:${tree.transferEntry}`)).toEqual(["ET-A:false", "ET-B:false", "ET-T:true"]);
    expect(model?.sequences.find((sequence) => sequence.id === "A-3")).toMatchObject({ transferTreeId: "ET-T", transferCarries: ["Trip failed"], path: { RT: "FAILURE" } });
    expect(model?.sequences.find((sequence) => sequence.id === "A-2")).toMatchObject({ familyId: "F-REL", releaseCategoryId: "RC-1", path: { RT: "SUCCESS", COOL: "FAILURE" } });
    expect(model?.functions.map((record) => `${record.id}:${record.treeIds.length}:${record.esLinks.length}`)).toEqual(["RT:1:0", "COOL:3:2"]);
    expect(model?.tops.map((top) => `${top.code}:${top.transferModelIds.join(",")}`)).toEqual(["COOL-TOP:M-SUP", "SUP-TOP:", "RPS-TOP:"]);
    expect(model?.events.map((event) => `${event.code}:${event.heldBy}:${event.holderId ?? ""}`)).toEqual(["COOL-PMP-FS:DA:P-1", "SUP-HFE:HRA:HFE-1", "SUP-FAN-FR:TYPED:", "RPS-DIV-FS:TYPED:"]);
    expect(model?.initiators[0]).toMatchObject({ id: "IEG-01", meanFrequency: 2.943, medianFrequency: 2.5889, errorFactor: 2.3, stateIds: ["POS-01", "POS-02"] });
    expect(model?.parameters.find((parameter) => parameter.id === "P-1")).toMatchObject({ distributionType: "Lognormal", evidenceKind: "GENERIC_NUCLEAR" });
    expect(model?.changes).toBeUndefined();
  });

  it("weights each group frequency by the hours in its operating states", () => {
    const view = modelViewOf(imported());
    const states = view?.initiators[0]?.states ?? [];
    expect(states.find((state) => state.stateId === "POS-01")?.frequency).toBeCloseTo(2.943 * 7300 / 7894, 12);
    expect(states.find((state) => state.stateId === "POS-02")?.frequency).toBeCloseTo(2.943 * 594 / 7894, 12);
    expect(view?.initiators[0]?.hours).toBe(7894);
  });

  it("uses typed shares when the plan asks for them and checks they add up", () => {
    let esq = imported();
    esq = { ...esq, quantificationPlan: { stateWeighting: { value: "TYPED_SHARES", reason: "Startup carries more of the frequency." } } };
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "IE", shares: [{ stateId: "POS-01", percent: 80 }, { stateId: "POS-02", percent: 10 }] });
    expect(checks(esq)).toContain("error:Shares do not add up:IEG-01");
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "IE", shares: [{ stateId: "POS-01", percent: 80 }, { stateId: "POS-02", percent: 20 }] });
    const states = modelViewOf(esq)?.initiators[0]?.states ?? [];
    expect(states.find((state) => state.stateId === "POS-02")?.frequency).toBeCloseTo(2.943 * 0.2, 12);
    expect(checks(esq).some((entry) => entry.startsWith("error:Shares"))).toBe(false);
  });

  it("takes a typed or DA frequency in place of the IE value", () => {
    let esq = withInitiatorChoice(imported(), "IEG-01", { groupId: "IEG-01", source: "DA", parameterId: "P-IE" });
    expect(modelViewOf(esq)?.initiators[0]?.mean).toBe(3);
    esq = withInitiatorChoice(esq, "IEG-01", { groupId: "IEG-01", source: "TYPED", mean: 1.5 });
    expect(modelViewOf(esq)?.initiators[0]?.mean).toBe(1.5);
    expect(checks(esq)).toEqual(expect.arrayContaining(["warning:No basis:IEG-01", "warning:No distribution:IEG-01"]));
  });

  it("resolves each tree from a rule, then the ESQ default, then the ES link", () => {
    let esq = imported();
    const cool = (): { tree: string; origin: string }[] => (modelViewOf(esq)?.functions.find((view) => view.record.id === "COOL")?.resolved ?? []).map((entry) => ({ tree: entry.tree.id, origin: entry.link.origin }));
    expect(cool()).toEqual([{ tree: "ET-A", origin: "ES" }, { tree: "ET-B", origin: "NONE" }, { tree: "ET-T", origin: "ES" }]);
    esq = withFunctionLink(esq, "COOL", { functionId: "COOL", target: { kind: "FAULT_TREE", top: { workbookId: "sy-1", modelId: "M-RPS", gateId: "G-RPS" } }, rules: [{ id: "R-1", groupIds: [], stateIds: ["POS-02"], target: { kind: "SPLIT_FRACTION", value: 0.01, errorFactor: 3, basis: "Shutdown cooling demand." }, reason: "No shutdown model in SY." }] });
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
    expect(values.find((value) => value.code === "COOL-PMP-FS")?.value).toBe(2e-3);
    expect(checks(esq)).toEqual(expect.arrayContaining(["warning:Not bound:SUP-FAN-FR", "warning:Not bound:RPS-DIV-FS"]));
    esq = withValueBinding(esq, "E-4", { eventId: "E-4", heldBy: "DA", holderId: "P-PT", reason: "" });
    expect(checks(esq)).toEqual(expect.arrayContaining(["error:Changed without a reason:RPS-DIV-FS", "warning:Point estimate at CC-II:RPS-DIV-FS", "warning:No distribution:RPS-DIV-FS"]));
    expect(checks({ ...esq, capabilityCategory: "CC-I" }).some((entry) => entry.includes("CC-II"))).toBe(false);
  });

  it("warns when a tree lasts longer than the running events under its functions", () => {
    expect(checks(imported())).toContain("warning:Mission time:COOL");
  });

  it("records what changed on a new import and keeps the ESQ choices", () => {
    const first = withFamilyChoice(imported(), "F-REL", { familyId: "F-REL", groupingReason: "Kept." });
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
    const first = imported();
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
    expect(JSON.stringify(esq.model)).not.toContain("null");
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
