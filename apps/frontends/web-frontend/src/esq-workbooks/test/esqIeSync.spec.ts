import type { EsqInitiatorRecord, EsqTypedInitiator, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { InitiatingEventGroup, InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { FrequencyUnit, type UncertainFrequency } from "interfaces-mef-types/core/events";
import { initiatorFingerprint, planIeSync, withEsqInitiators, withSyncedInitiators } from "../esqIeSync";
import { ieGroupRecord, withTypedTrees } from "../esqModel";
import { EMPTY_UPSTREAM } from "../esqLinks";
import { createEmptyEventTree } from "../../newly-developed-methods/event-tree";
import { blankEsq } from "./esqFixtures";

const NOW = "2026-10-20T12:00:00.000Z";

const FREQUENCY: UncertainFrequency = { expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value: 0.02 } } }, basis: FrequencyUnit.PER_REACTOR_YEAR };

const TYPED: EsqTypedInitiator = { id: "IEG-ESQ-01", name: "Loss of forced cooling", description: "Both circulators trip.", stateIds: ["POS-01"], frequency: FREQUENCY, heldBy: "TYPED" };

function group(fields: Partial<InitiatingEventGroup> & { uuid: string; name: string }): InitiatingEventGroup {
  return {
    description: "",
    memberInitiatorIds: [],
    groupingBasis: "",
    boundingInitiatorId: "",
    similarMitigationRequirements: [],
    groupingDoesNotMaskRiskSignificantSequences: false,
    comparableImpactAcrossMembers: false,
    challengedSafetyFunctions: [],
    applicableStates: [],
    implementsSrs: [],
    ...fields,
  };
}

function matching(): InitiatingEventGroup {
  return group({ uuid: "IEG-ESQ-01", name: "Loss of forced cooling", description: "Both circulators trip.", applicableStates: ["POS-01"], frequency: FREQUENCY });
}

function ieOf(groups: InitiatingEventGroup[]): InitiatingEventsAnalysis {
  return { initiatingEventGroups: groups, quantifications: [], linkedWorkbooks: {} } as InitiatingEventsAnalysis;
}

function only<T>(items: readonly T[]): T {
  const [first] = items;
  if (first === undefined || items.length !== 1) throw new Error(`Expected one item, found ${items.length}.`);
  return first;
}

function esqWith(typed: EsqTypedInitiator[]): EventSequenceQuantification {
  const esq: EventSequenceQuantification = { ...blankEsq(), linkedWorkbooks: { IE: "ie-1" }, modelDecisions: { typedInitiators: typed } };
  return withTypedTrees(esq, [{ ...createEmptyEventTree("IEG-ESQ-01"), label: "ET-ESQ-01" }], EMPTY_UPSTREAM, NOW);
}

describe("ESQ initiating events written to the linked IE workbook", () => {
  it("creates an IE group with blank grouping fields and a frequency entry for a new ESQ initiating event", () => {
    const ie = withEsqInitiators(ieOf([]), [TYPED], undefined);
    const created = only(ie.initiatingEventGroups);
    expect(created).toEqual(matching());
    expect(created.controlledDataSource).toBeUndefined();
    expect(ie.quantifications).toEqual([{
      initiatorOrGroupId: "IEG-ESQ-01",
      frequency: FREQUENCY,
      basis: "GENERIC_DATA",
      plantCalendarYearBasis: false,
      posTimeFractionApplied: false,
      dataSourceJustification: "",
      recoveryActionsIncluded: false,
      implementsSrs: [],
    }]);
    expect(initiatorFingerprint(ieGroupRecord(created))).toBe(initiatorFingerprint(TYPED));
  });

  it("updates the matching IE group in place and keeps the fields only IE edits", () => {
    const existing = group({ uuid: "IEG-ESQ-01", name: "Old name", groupingBasis: "Same mitigation.", memberInitiatorIds: ["IE-7"] });
    const frequency: UncertainFrequency = { expression: { node: "PARAMETER", reference: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-IE" } }, basis: FrequencyUnit.PER_PLANT_YEAR };
    const record: EsqInitiatorRecord = { ...TYPED, heldBy: "DA", holderId: "P-IE", frequency };
    const ie = withEsqInitiators(ieOf([existing]), [record], "da-1");
    expect(only(ie.initiatingEventGroups)).toMatchObject({
      uuid: "IEG-ESQ-01",
      name: "Loss of forced cooling",
      groupingBasis: "Same mitigation.",
      memberInitiatorIds: ["IE-7"],
      applicableStates: ["POS-01"],
      frequency,
      controlledDataSource: { referenceType: "WORKBOOK_PARAMETER", workbookId: "da-1", entityId: "P-IE" },
    });
    expect(ie.linkedWorkbooks?.DA).toBe("da-1");
    expect(initiatorFingerprint(ieGroupRecord(only(ie.initiatingEventGroups)))).toBe(initiatorFingerprint(record));
  });

  it("only records the match when the IE group already holds the ESQ values", () => {
    const fingerprint = initiatorFingerprint(TYPED);
    const plan = planIeSync([TYPED], ieOf([matching()]), "ie-1");
    expect(plan.push).toEqual([]);
    expect(plan.updates).toEqual([{ id: "IEG-ESQ-01", expected: fingerprint, synced: { workbookId: "ie-1", fingerprint } }]);
  });

  it("pushes an ESQ initiating event the IE workbook lacks, also right after a new IE link", () => {
    expect(planIeSync([TYPED], ieOf([]), "ie-1").push).toEqual([TYPED]);
    const elsewhere: EsqTypedInitiator = { ...TYPED, synced: { workbookId: "ie-old", fingerprint: initiatorFingerprint(TYPED) } };
    expect(planIeSync([elsewhere], ieOf([]), "ie-1").push).toEqual([elsewhere]);
  });

  it("pushes an ESQ edit made after the last push", () => {
    const edited: EsqTypedInitiator = { ...TYPED, name: "Loss of forced cooling in both loops", synced: { workbookId: "ie-1", fingerprint: initiatorFingerprint(TYPED) } };
    expect(planIeSync([edited], ieOf([matching()]), "ie-1").push).toEqual([edited]);
  });

  it("takes an IE edit when ESQ has not changed since the last push", () => {
    const pushed: EsqTypedInitiator = { ...TYPED, synced: { workbookId: "ie-1", fingerprint: initiatorFingerprint(TYPED) } };
    const edited = group({ ...matching(), applicableStates: ["POS-01", "POS-02"] });
    const held = ieGroupRecord(edited);
    const plan = planIeSync([pushed], ieOf([edited]), "ie-1");
    expect(plan.push).toEqual([]);
    expect(plan.updates).toEqual([{ id: "IEG-ESQ-01", expected: initiatorFingerprint(TYPED), synced: { workbookId: "ie-1", fingerprint: initiatorFingerprint(held) }, record: held }]);
  });

  it("does not bring back an IE group deleted after the last push", () => {
    const pushed: EsqTypedInitiator = { ...TYPED, synced: { workbookId: "ie-1", fingerprint: initiatorFingerprint(TYPED) } };
    expect(planIeSync([pushed], ieOf([]), "ie-1")).toEqual({ push: [], updates: [] });
  });

  it("marks a push as synced only when ESQ did not change while it ran", () => {
    const fingerprint = initiatorFingerprint(TYPED);
    const update = { id: "IEG-ESQ-01", expected: fingerprint, synced: { workbookId: "ie-1", fingerprint } };
    expect(withSyncedInitiators(esqWith([TYPED]), [update]).modelDecisions?.typedInitiators).toEqual([{ ...TYPED, synced: { workbookId: "ie-1", fingerprint } }]);
    const changed = esqWith([{ ...TYPED, name: "Edited during the push" }]);
    expect(withSyncedInitiators(changed, [update])).toBe(changed);
  });

  it("adopts an IE edit into the ESQ record and every model view of it", () => {
    const fingerprint = initiatorFingerprint(TYPED);
    const held = ieGroupRecord(group({ ...matching(), description: "Edited in IE." }));
    const synced = { workbookId: "ie-1", fingerprint: initiatorFingerprint(held) };
    const next = withSyncedInitiators(esqWith([{ ...TYPED, synced: { workbookId: "ie-1", fingerprint } }]), [{ id: "IEG-ESQ-01", expected: fingerprint, synced, record: held }]);
    expect(next.modelDecisions?.typedInitiators).toEqual([{ ...held, synced }]);
    expect(next.model?.initiators.find((record) => record.id === "IEG-ESQ-01")).toMatchObject({ description: "Edited in IE.", typed: true });
  });
});
