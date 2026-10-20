import { useEffect, useRef, useState } from "react";
import { canonicalJson } from "interfaces-mef-types/core/uncertainty";
import type { EsqIeSync, EsqInitiatorRecord, EsqTypedInitiator, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { InitiatingEventFrequencyQuantification, InitiatingEventGroup, InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { getIeWorkbook, patchIeWorkbook } from "../ie-workbooks/ieWorkbookApi";
import { ieGroupRecord, linkOf, typedInitiatorsOf, withMergedInitiators } from "./esqModel";
import { exampleLinkVariant } from "./esqViewData";

type EsqIeSyncState = "IDLE" | "SYNCING" | "FAILED" | "EXAMPLE";

interface EsqIeSyncStatus {
  state: EsqIeSyncState;
  message?: string;
}

interface EsqInitiatorSyncUpdate {
  id: string;
  expected: string;
  synced: EsqIeSync;
  record?: EsqInitiatorRecord;
}

interface EsqIeSyncPlan {
  push: EsqTypedInitiator[];
  updates: EsqInitiatorSyncUpdate[];
}

type EsqMutate = (mutator: (esq: EventSequenceQuantification) => EventSequenceQuantification) => void;

const IE_SYNC_IDLE: EsqIeSyncStatus = { state: "IDLE" };

function initiatorFingerprint(record: EsqInitiatorRecord): string {
  return canonicalJson({
    name: record.name.trim(),
    description: (record.description ?? "").trim(),
    stateIds: [...record.stateIds].sort(),
    frequency: record.frequency ?? null,
    heldBy: record.heldBy === "DA" ? "DA" : "TYPED",
    holderId: record.heldBy === "DA" ? record.holderId ?? null : null,
  });
}

function withGroupFields(group: InitiatingEventGroup, record: EsqInitiatorRecord, daWorkbookId: string | undefined): InitiatingEventGroup {
  const { controlledDataSource: _link, frequency: _frequency, ...rest } = group;
  const next: InitiatingEventGroup = { ...rest, name: record.name, description: record.description ?? "", applicableStates: [...record.stateIds] };
  if (record.frequency !== undefined) next.frequency = structuredClone(record.frequency);
  if (record.heldBy === "DA" && record.holderId !== undefined && daWorkbookId !== undefined) {
    next.controlledDataSource = { referenceType: "WORKBOOK_PARAMETER", workbookId: daWorkbookId, entityId: record.holderId };
  }
  return next;
}

function newGroup(record: EsqInitiatorRecord, daWorkbookId: string | undefined): InitiatingEventGroup {
  return withGroupFields({
    uuid: record.id,
    name: record.name,
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
  }, record, daWorkbookId);
}

function withQuantification(quantifications: readonly InitiatingEventFrequencyQuantification[], record: EsqInitiatorRecord): InitiatingEventFrequencyQuantification[] {
  const frequency = record.frequency;
  if (frequency === undefined) return [...quantifications];
  if (quantifications.some((entry) => entry.initiatorOrGroupId === record.id)) {
    return quantifications.map((entry) => (entry.initiatorOrGroupId === record.id ? { ...entry, frequency: structuredClone(frequency) } : entry));
  }
  return [...quantifications, {
    initiatorOrGroupId: record.id,
    frequency: structuredClone(frequency),
    basis: "GENERIC_DATA",
    plantCalendarYearBasis: false,
    posTimeFractionApplied: false,
    dataSourceJustification: "",
    recoveryActionsIncluded: false,
    implementsSrs: [],
  }];
}

function withEsqInitiators(ie: InitiatingEventsAnalysis, records: readonly EsqInitiatorRecord[], daWorkbookId: string | undefined): InitiatingEventsAnalysis {
  let groups = [...ie.initiatingEventGroups];
  let quantifications = [...ie.quantifications];
  for (const record of records) {
    const known = groups.some((group) => group.uuid === record.id);
    groups = known ? groups.map((group) => (group.uuid === record.id ? withGroupFields(group, record, daWorkbookId) : group)) : [...groups, newGroup(record, daWorkbookId)];
    quantifications = withQuantification(quantifications, record);
  }
  const needsDa = daWorkbookId !== undefined && records.some((record) => record.heldBy === "DA") && (ie.linkedWorkbooks?.DA ?? "").length === 0;
  return { ...ie, initiatingEventGroups: groups, quantifications, ...(needsDa ? { linkedWorkbooks: { ...ie.linkedWorkbooks, DA: daWorkbookId } } : {}) };
}

function planIeSync(typed: readonly EsqTypedInitiator[], ie: InitiatingEventsAnalysis, workbookId: string): EsqIeSyncPlan {
  const push: EsqTypedInitiator[] = [];
  const updates: EsqInitiatorSyncUpdate[] = [];
  for (const entry of typed) {
    const expected = initiatorFingerprint(entry);
    const group = ie.initiatingEventGroups.find((candidate) => candidate.uuid === entry.id);
    const held = group === undefined ? undefined : ieGroupRecord(group);
    const heldPrint = held === undefined ? undefined : initiatorFingerprint(held);
    const pushedHere = entry.synced?.workbookId === workbookId;
    if (heldPrint === expected) {
      if (!pushedHere || entry.synced?.fingerprint !== expected) updates.push({ id: entry.id, expected, synced: { workbookId, fingerprint: expected } });
      continue;
    }
    if (pushedHere && entry.synced?.fingerprint === expected) {
      if (held !== undefined && heldPrint !== undefined) updates.push({ id: entry.id, expected, synced: { workbookId, fingerprint: heldPrint }, record: { ...held, id: entry.id } });
      continue;
    }
    push.push(entry);
  }
  return { push, updates };
}

function withSyncedInitiators(esq: EventSequenceQuantification, updates: readonly EsqInitiatorSyncUpdate[]): EventSequenceQuantification {
  if (updates.length === 0) return esq;
  const applied = (entry: EsqTypedInitiator): EsqInitiatorSyncUpdate | undefined => {
    const update = updates.find((candidate) => candidate.id === entry.id);
    return update !== undefined && initiatorFingerprint(entry) === update.expected ? update : undefined;
  };
  const current = typedInitiatorsOf(esq);
  if (!current.some((entry) => applied(entry) !== undefined)) return esq;
  const adopted = current.some((entry) => applied(entry)?.record !== undefined);
  const typedInitiators = current.map((entry): EsqTypedInitiator => {
    const update = applied(entry);
    if (update === undefined) return entry;
    if (update.record === undefined) return { ...entry, synced: update.synced };
    const { typed: _typed, ...fields } = update.record;
    return { ...fields, synced: update.synced };
  });
  const next: EventSequenceQuantification = { ...esq, modelDecisions: { ...(esq.modelDecisions ?? {}), typedInitiators } };
  const model = next.model;
  return adopted && model !== undefined ? { ...next, model: withMergedInitiators(model, next) } : next;
}

function ieWritable(workbookId: string): boolean {
  return exampleLinkVariant(workbookId) === undefined;
}

function useEsqIeSync(esq: EventSequenceQuantification | undefined, ie: InitiatingEventsAnalysis | undefined, editable: boolean, mutateEsq: EsqMutate): { ie: InitiatingEventsAnalysis | undefined; status: EsqIeSyncStatus } {
  const workbookId = esq === undefined ? undefined : linkOf(esq, "IE");
  const daWorkbookId = esq === undefined ? undefined : linkOf(esq, "DA");
  const typed = esq?.modelDecisions?.typedInitiators;
  const [latest, setLatest] = useState<{ workbookId: string; mef: InitiatingEventsAnalysis } | null>(null);
  const [status, setStatus] = useState<EsqIeSyncStatus>(IE_SYNC_IDLE);
  const [retry, setRetry] = useState(0);
  const running = useRef(false);
  const pending = useRef(false);
  const current = latest !== null && latest.workbookId === workbookId ? latest.mef : ie;

  useEffect(() => {
    if (!editable || workbookId === undefined || current === undefined || typed === undefined || typed.length === 0) {
      setStatus(IE_SYNC_IDLE);
      return;
    }
    if (!ieWritable(workbookId)) {
      setStatus({ state: "EXAMPLE" });
      return;
    }
    const plan = planIeSync(typed, current, workbookId);
    if (plan.updates.length > 0) mutateEsq((draft) => withSyncedInitiators(draft, plan.updates));
    if (plan.push.length === 0) {
      if (!running.current) setStatus(IE_SYNC_IDLE);
      return;
    }
    if (running.current) {
      pending.current = true;
      return;
    }
    running.current = true;
    setStatus({ state: "SYNCING" });
    const pushed = plan.push.map((entry): EsqInitiatorSyncUpdate => {
      const fingerprint = initiatorFingerprint(entry);
      return { id: entry.id, expected: fingerprint, synced: { workbookId, fingerprint } };
    });
    getIeWorkbook(workbookId)
      .then((fresh) => patchIeWorkbook(workbookId, fresh.mef, withEsqInitiators(fresh.mef, plan.push, daWorkbookId)))
      .then((response) => {
        setLatest({ workbookId, mef: response.mef });
        mutateEsq((draft) => withSyncedInitiators(draft, pushed));
        setStatus(IE_SYNC_IDLE);
      })
      .catch((error) => {
        setStatus({ state: "FAILED", message: error instanceof Error ? error.message : "The IE workbook did not accept the change." });
      })
      .finally(() => {
        running.current = false;
        if (pending.current) {
          pending.current = false;
          setRetry((count) => count + 1);
        }
      });
  }, [editable, workbookId, daWorkbookId, current, typed, mutateEsq, retry]);

  return { ie: current, status };
}

export {
  IE_SYNC_IDLE,
  initiatorFingerprint,
  withEsqInitiators,
  planIeSync,
  withSyncedInitiators,
  ieWritable,
  useEsqIeSync,
  type EsqIeSyncState,
  type EsqIeSyncStatus,
  type EsqInitiatorSyncUpdate,
  type EsqIeSyncPlan,
};
