import {
  eventTreeOutcomeRank,
  eventTreeOutcomes,
  isEventTreeBranchState,
  type EventSequence,
  type EventTree,
  type EventTreeBranch,
  type EventTreeOutcome,
  type EventTreePath,
  type EventTreeSequence,
  type FunctionalEvent,
} from "interfaces-mef-types/es/event-sequence-analysis";
import { DEFAULT_ANNUALIZATION_CONVENTION, type EventTreeInitiatingEventFrequency } from "interfaces-mef-types/modeling";
import { lawBounds, parameterReferenceKey, type UncertainExpression, type UncertainParameter, type UncertainUnit } from "interfaces-mef-types/core/uncertainty";
import { UncertainExpressionSchema } from "interfaces-mef-types/zod/core/uncertainty";
import { EndState } from "interfaces-mef-types/core/events";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { v5 as uuidV5 } from "uuid";
import type {
  EventTreeLeafReference,
  EventTreeNodeView,
  EventTreeOperation,
  EventTreePresentationView,
  EventTreeValidationFinding,
} from "./eventTreeTypes";

const MAX_FUNCTIONAL_EVENTS = 10;
const EVENT_TREE_ENTITY_NAMESPACE = "39c9df12-4a98-5e99-8d6a-a763bb27fca1";

type InitiatingFrequencyUnit = "PER_YEAR" | "PER_HOUR";

const INITIATING_FREQUENCY_UNITS: ReadonlySet<UncertainUnit> = new Set<UncertainUnit>(["PER_YEAR", "PER_HOUR"]);

type FrequencyParameterTable = ReadonlyMap<string, UncertainParameter>;

const NO_FREQUENCY_PARAMETERS: FrequencyParameterTable = new Map();

function frequencyRateUnits(expression: UncertainExpression, table: FrequencyParameterTable = NO_FREQUENCY_PARAMETERS, seen: ReadonlySet<string> = new Set()): InitiatingFrequencyUnit[] {
  switch (expression.node) {
    case "VALUE":
      return expression.value.unit === "PER_YEAR" || expression.value.unit === "PER_HOUR" ? [expression.value.unit] : [];
    case "PARAMETER": {
      const key = parameterReferenceKey(expression.reference);
      const parameter = table.get(key);
      return parameter === undefined || seen.has(key) ? [] : frequencyRateUnits(parameter.expression, table, new Set([...seen, key]));
    }
    case "OPERATION":
      return [...new Set(expression.operands.flatMap((operand) => frequencyRateUnits(operand, table, seen)))];
    case "MODEL":
      return [];
  }
}

function initiatingFrequencyUnit(expression: UncertainExpression, table: FrequencyParameterTable = NO_FREQUENCY_PARAMETERS): InitiatingFrequencyUnit {
  const units = frequencyRateUnits(expression, table);
  return units.length === 1 && units[0] === "PER_HOUR" ? "PER_HOUR" : "PER_YEAR";
}

function pointInitiatingFrequency(value: number): EventTreeInitiatingEventFrequency {
  return {
    expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "POINT", value } } },
    annualization: { ...DEFAULT_ANNUALIZATION_CONVENTION },
  };
}

function topologyEntityId(value: string): string {
  return uuidV5(value, EVENT_TREE_ENTITY_NAMESPACE);
}

function orderedFunctionalEvents(model: EventTree): FunctionalEvent[] {
  return Object.values(model.functionalEvents).sort(
    (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
  );
}

type OutcomePath = Record<string, EventTreeOutcome>;

interface PathMember {
  id: string;
  origin: string;
  path: OutcomePath;
}

function sequencePathKey(path: OutcomePath, eventIds: readonly string[]): string {
  return eventIds.map((id) => `${id}:${path[id] ?? ""}`).join("|");
}

function orderedOutcomes(outcomes: Iterable<EventTreeOutcome>): EventTreeOutcome[] {
  return [...new Set(outcomes)].sort((left, right) => eventTreeOutcomeRank(left) - eventTreeOutcomeRank(right));
}

function sharesPrefix(path: OutcomePath, reference: OutcomePath, prefixEventIds: readonly string[]): boolean {
  return prefixEventIds.every((eventId) => path[eventId] === reference[eventId]);
}

function groupedByPrefix(members: readonly PathMember[], prefixEventIds: readonly string[]): PathMember[][] {
  const groups = new Map<string, PathMember[]>();
  for (const member of members) {
    const key = sequencePathKey(member.path, prefixEventIds);
    groups.set(key, [...(groups.get(key) ?? []), member]);
  }
  return [...groups.values()];
}

function outcomeSchemes(eventIds: readonly string[], members: readonly PathMember[]): Map<string, Map<string, string>> {
  const schemes = new Map<string, Map<string, string>>(members.map((member) => [member.origin, new Map<string, string>()]));
  eventIds.forEach((eventId, depth) => {
    for (const group of groupedByPrefix(members, eventIds.slice(0, depth))) {
      const scheme = orderedOutcomes(group.map((member) => member.path[eventId] ?? "BYPASSED")).join(",");
      for (const member of group) schemes.get(member.origin)?.set(eventId, scheme);
    }
  });
  return schemes;
}

function sequencePathsFromTopology(model: EventTree): Map<string, OutcomePath> {
  const paths = new Map<string, OutcomePath>();
  const walk = (branchId: string, path: OutcomePath, visited: Set<string>): void => {
    if (visited.has(branchId)) return;
    const branch = model.branches[branchId];
    if (branch === undefined) return;
    const nextVisited = new Set(visited).add(branchId);
    for (const outcome of branch.paths) {
      const nextPath = branch.functionalEventId === undefined
        ? { ...path }
        : { ...path, [branch.functionalEventId]: outcome.state };
      if (outcome.targetType === "BRANCH") walk(outcome.target, nextPath, nextVisited);
      if (outcome.targetType === "SEQUENCE") paths.set(outcome.target, nextPath);
    }
  };
  if (model.initialState.branchId.length > 0) walk(model.initialState.branchId, {}, new Set());
  const eventIds = orderedFunctionalEvents(model).map((event) => event.uuid);
  for (const sequence of Object.values(model.sequences)) {
    const path = {
      ...(paths.get(sequence.uuid) ?? {}),
      ...(sequence.functionalEventStates ?? {}),
    };
    for (const eventId of eventIds) {
      if (path[eventId] === undefined) path[eventId] = "BYPASSED";
    }
    paths.set(sequence.uuid, path);
  }
  return paths;
}

function buildCompleteTopology(
  model: EventTree,
  functionalEvents: FunctionalEvent[],
): Pick<EventTree, "functionalEvents" | "branches" | "initialState" | "sequences" | "transfers"> {
  const eventIds = functionalEvents.map((event) => event.uuid);
  const previousPaths = sequencePathsFromTopology(model);
  const previousCandidates = Object.values(model.sequences).map((sequence) => ({
    sequence,
    path: previousPaths.get(sequence.uuid) ?? {},
  }));
  const sequences: Record<string, EventTreeSequence> = {};
  const transfers: NonNullable<EventTree["transfers"]> = {};
  let desiredPaths: OutcomePath[];
  if (eventIds.length === 0) {
    desiredPaths = [];
  } else if (previousCandidates.length === 0) {
    desiredPaths = [Object.fromEntries(eventIds.map((eventId): [string, EventTreeOutcome] => [eventId, "BYPASSED"]))];
  } else {
    const projected = previousCandidates.map(({ path }) => Object.fromEntries(
      eventIds.map((eventId): [string, EventTreeOutcome] => [eventId, path[eventId] ?? "BYPASSED"]),
    ));
    desiredPaths = [...new Map(projected.map((path) => [sequencePathKey(path, eventIds), path])).values()];
  }

  const paths: Array<{ id: string; path: OutcomePath }> = [];
  desiredPaths.forEach((path, index) => {
    const key = sequencePathKey(path, eventIds);
    const previousCandidate = previousCandidates.find((candidate) => sequencePathKey(
      Object.fromEntries(eventIds.map((eventId) => [eventId, candidate.path[eventId] ?? "BYPASSED"])),
      eventIds,
    ) === key);
    const previous = previousCandidate?.sequence ?? previousCandidates.find((candidate) =>
      Object.entries(candidate.path).every(([eventId, outcome]) => path[eventId] === undefined || path[eventId] === outcome),
    )?.sequence;
    const id = previousCandidate !== undefined
      ? previousCandidate.sequence.uuid
      : topologyEntityId(`${model.uuid}:sequence:${key}`);
    sequences[id] = {
      uuid: id,
      name: previous?.name ?? `Sequence ${String(index + 1)}`,
      endState: previous?.endState ?? EndState.SUCCESSFUL_MITIGATION,
      eventSequenceId: previous?.eventSequenceId,
      ...(previous?.endStateId === undefined ? {} : { endStateId: previous.endStateId }),
      functionalEventStates: path,
    };
    const priorTransfer = model.transfers?.[previous?.uuid ?? ""];
    if (priorTransfer !== undefined) transfers[id] = priorTransfer;
    paths.push({ id, path });
  });

  const branches: Record<string, EventTreeBranch> = {};
  const build = (depth: number, candidates: typeof paths): { target: string; targetType: "BRANCH" | "SEQUENCE" } => {
    if (depth >= eventIds.length) return { target: candidates[0]?.id ?? "", targetType: "SEQUENCE" };
    const functionalEventId = eventIds[depth] ?? "";
    const id = topologyEntityId(`${model.uuid}:branch:${String(depth)}:${candidates.map((candidate) => candidate.id).join(",")}`);
    const outcomes = orderedOutcomes(candidates.map((candidate) => candidate.path[functionalEventId] ?? "BYPASSED")).map((state) => ({
      state,
      ...build(depth + 1, candidates.filter((candidate) => (candidate.path[functionalEventId] ?? "BYPASSED") === state)),
    }));
    branches[id] = {
      uuid: id,
      name: functionalEvents[depth]?.name ?? functionalEventId,
      functionalEventId,
      paths: outcomes,
    };
    return { target: id, targetType: "BRANCH" };
  };
  const root = eventIds.length === 0 ? null : build(0, paths);
  return {
    functionalEvents: Object.fromEntries(functionalEvents.map((event, order) => [event.uuid, { ...event, order }])),
    branches,
    initialState: { branchId: root?.targetType === "BRANCH" ? root.target : "" },
    sequences,
    transfers: Object.keys(transfers).length === 0 ? undefined : transfers,
  };
}

function eventLabel(model: EventTree, eventId: string): string {
  const event = model.functionalEvents[eventId];
  return event?.label ?? event?.name ?? eventId;
}

function reorderedEvents(model: EventTree, operation: EventTreeOperation): FunctionalEvent[] | undefined {
  const events = orderedFunctionalEvents(model);
  if (operation.kind === "MOVE_FUNCTIONAL_EVENT") {
    const from = events.findIndex((event) => event.uuid === operation.functionalEventId);
    const to = from + operation.direction;
    if (from < 0 || to < 0 || to >= events.length) return undefined;
    const next = [...events];
    const moving = next[from];
    const other = next[to];
    if (moving === undefined || other === undefined) return undefined;
    next[from] = other;
    next[to] = moving;
    return next;
  }
  if (operation.kind === "REORDER_FUNCTIONAL_EVENT") {
    const from = events.findIndex((event) => event.uuid === operation.functionalEventId);
    const to = Math.max(0, Math.min(operation.targetIndex, events.length - 1));
    if (from < 0 || from === to) return undefined;
    const next = [...events];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return undefined;
    next.splice(to, 0, moved);
    return next;
  }
  return undefined;
}

function reorderedSequences(model: EventTree, events: readonly FunctionalEvent[]): Pick<EventTree, "sequences" | "transfers"> | string {
  const oldIds = orderedFunctionalEvents(model).map((event) => event.uuid);
  const newIds = events.map((event) => event.uuid);
  const derived = sequencePathsFromTopology(model);
  const original: PathMember[] = Object.values(model.sequences).map((sequence) => ({ id: sequence.uuid, origin: sequence.uuid, path: derived.get(sequence.uuid) ?? {} }));
  const schemes = outcomeSchemes(oldIds, original);
  let members = original;
  for (const [depth, eventId] of newIds.entries()) {
    const next: PathMember[] = [];
    for (const group of groupedByPrefix(members, newIds.slice(0, depth))) {
      const branching = group.filter((member) => (member.path[eventId] ?? "BYPASSED") !== "BYPASSED");
      if (new Set(branching.map((member) => schemes.get(member.origin)?.get(eventId) ?? "")).size > 1) {
        return `${eventLabel(model, eventId)} has different branches on different routes, so the events cannot swap places.`;
      }
      const outcomes = orderedOutcomes(branching.map((member) => member.path[eventId] ?? "BYPASSED"));
      for (const member of group) {
        if (outcomes.length === 0 || (member.path[eventId] ?? "BYPASSED") !== "BYPASSED") {
          next.push(member);
          continue;
        }
        for (const outcome of outcomes) {
          next.push({ id: topologyEntityId(`${model.uuid}:sequence:${member.id}:${eventId}:${outcome}`), origin: member.origin, path: { ...member.path, [eventId]: outcome } });
        }
      }
    }
    members = next;
  }
  const sequences: Record<string, EventTreeSequence> = {};
  const transfers: NonNullable<EventTree["transfers"]> = {};
  for (const member of members) {
    const base = model.sequences[member.origin];
    if (base === undefined) continue;
    sequences[member.id] = { ...base, uuid: member.id, functionalEventStates: member.path };
    const transfer = model.transfers?.[member.origin];
    if (transfer !== undefined) transfers[member.id] = transfer;
  }
  return { sequences, transfers: Object.keys(transfers).length === 0 ? undefined : transfers };
}

function eventTreeMoveProblem(model: EventTree, operation: EventTreeOperation): string | undefined {
  const events = reorderedEvents(model, operation);
  if (events === undefined) return undefined;
  const moved = reorderedSequences(model, events);
  return typeof moved === "string" ? moved : undefined;
}

function withBranchChange(model: EventTree, operation: Extract<EventTreeOperation, { kind: "ADD_BRANCH" | "REMOVE_BRANCH" }>): EventTree {
  const events = orderedFunctionalEvents(model);
  const eventIds = events.map((event) => event.uuid);
  const eventIndex = eventIds.indexOf(operation.functionalEventId);
  const derivedPaths = sequencePathsFromTopology(model);
  const selectedPath = derivedPaths.get(operation.sequenceId);
  if (eventIndex < 0 || selectedPath === undefined) return model;
  const prefix = eventIds.slice(0, eventIndex);
  const outcomeOf = (sequence: EventTreeSequence): EventTreeOutcome => derivedPaths.get(sequence.uuid)?.[operation.functionalEventId] ?? "BYPASSED";
  const affected = Object.values(model.sequences).filter((sequence) => sharesPrefix(derivedPaths.get(sequence.uuid) ?? {}, selectedPath, prefix));
  const current = orderedOutcomes(affected.map(outcomeOf));
  const sequences: Record<string, EventTreeSequence> = { ...model.sequences };
  const transfers = { ...(model.transfers ?? {}) };
  const renamed = new Map<EventTreeOutcome, EventTreeOutcome>();
  if (operation.kind === "ADD_BRANCH") {
    if (current.length >= 2) return model;
    const next = eventTreeOutcomes(current.length + 1);
    const offset = operation.position === "TOP" ? 1 : 0;
    current.forEach((outcome, index) => renamed.set(outcome, next[index + offset] ?? outcome));
    const added = next[operation.position === "TOP" ? 0 : current.length] ?? "BYPASSED";
    const path = Object.fromEntries(eventIds.map((eventId, index): [string, EventTreeOutcome] => [
      eventId,
      index < eventIndex ? (selectedPath[eventId] ?? "BYPASSED") : index === eventIndex ? added : "BYPASSED",
    ]));
    const id = topologyEntityId(`${model.uuid}:sequence:added:${sequencePathKey(path, eventIds)}`);
    sequences[id] = {
      uuid: id,
      name: `Sequence ${String(Object.keys(sequences).length + 1)}`,
      endState: EndState.SUCCESSFUL_MITIGATION,
      functionalEventStates: path,
    };
  } else {
    if (current.length <= 1) return model;
    const removed = selectedPath[operation.functionalEventId] ?? "BYPASSED";
    const kept = current.filter((outcome) => outcome !== removed);
    const next = eventTreeOutcomes(kept.length);
    kept.forEach((outcome, index) => renamed.set(outcome, next[index] ?? outcome));
    for (const sequence of affected) {
      if (outcomeOf(sequence) !== removed) continue;
      delete sequences[sequence.uuid];
      delete transfers[sequence.uuid];
    }
  }
  for (const sequence of affected) {
    if (sequences[sequence.uuid] === undefined) continue;
    const outcome = outcomeOf(sequence);
    sequences[sequence.uuid] = {
      ...sequence,
      functionalEventStates: { ...(derivedPaths.get(sequence.uuid) ?? {}), [operation.functionalEventId]: renamed.get(outcome) ?? outcome },
    };
  }
  const intermediate = { ...model, sequences, transfers: Object.keys(transfers).length === 0 ? undefined : transfers };
  return { ...model, ...buildCompleteTopology(intermediate, events) };
}

function applyEventTreeOperation(model: EventTree, operation: EventTreeOperation): EventTree {
  if (operation.kind === "REPLACE") return operation.model;
  if (operation.kind === "UPDATE_TREE") return { ...model, ...operation.changes };
  if (operation.kind === "SET_FAULT_TREE_REFERENCE") {
    const current = model.functionalEvents[operation.functionalEventId];
    if (current === undefined) return model;
    return {
      ...model,
      functionalEvents: {
        ...model.functionalEvents,
        [current.uuid]: { ...current, faultTreeTopEvent: operation.reference, faultTreeId: undefined },
      },
    };
  }
  if (operation.kind === "UPDATE_FUNCTIONAL_EVENT") {
    const current = model.functionalEvents[operation.functionalEventId];
    if (current === undefined) return model;
    return {
      ...model,
      functionalEvents: {
        ...model.functionalEvents,
        [current.uuid]: { ...current, ...operation.changes },
      },
      branches: Object.fromEntries(Object.entries(model.branches).map(([id, branch]) => [
        id,
        branch.functionalEventId === current.uuid && operation.changes.name !== undefined
          ? { ...branch, name: operation.changes.name }
          : branch,
      ])),
    };
  }
  if (operation.kind === "SET_SEQUENCE_END_STATE") {
    const current = model.sequences[operation.sequenceId];
    if (current === undefined) return model;
    const { [operation.sequenceId]: _removed, ...remainingTransfers } = model.transfers ?? {};
    return {
      ...model,
      sequences: {
        ...model.sequences,
        [current.uuid]: {
          ...withoutEndStateId(current),
          endState: operation.endState === "SUCCESSFUL_MITIGATION"
            ? EndState.SUCCESSFUL_MITIGATION
            : EndState.RADIONUCLIDE_RELEASE,
          ...(operation.endStateId === undefined ? {} : { endStateId: operation.endStateId }),
        },
      },
      transfers: Object.keys(remainingTransfers).length === 0 ? undefined : remainingTransfers,
    };
  }
  if (operation.kind === "SET_SEQUENCE_TRANSFER") {
    const current = model.sequences[operation.sequenceId];
    if (current === undefined) return model;
    const transfers = { ...(model.transfers ?? {}) };
    if (operation.targetEventTreeId === null) delete transfers[operation.sequenceId];
    else transfers[operation.sequenceId] = {
      targetEventTreeId: operation.targetEventTreeId,
    };
    return {
      ...model,
      sequences: {
        ...model.sequences,
        [current.uuid]: operation.targetEventTreeId === null
          ? { ...current, endState: current.endState ?? EndState.SUCCESSFUL_MITIGATION }
          : { ...withoutEndStateId(current), endState: undefined },
      },
      transfers: Object.keys(transfers).length === 0 ? undefined : transfers,
    };
  }
  if (operation.kind === "ADD_BRANCH" || operation.kind === "REMOVE_BRANCH") return withBranchChange(model, operation);
  if (operation.kind === "MOVE_FUNCTIONAL_EVENT" || operation.kind === "REORDER_FUNCTIONAL_EVENT") {
    const events = reorderedEvents(model, operation);
    if (events === undefined) return model;
    const moved = reorderedSequences(model, events);
    if (typeof moved === "string") return model;
    return { ...model, ...buildCompleteTopology({ ...model, ...moved }, events) };
  }
  if (operation.kind === "SET_FUNCTIONAL_EVENT_BYPASS") {
    const events = orderedFunctionalEvents(model);
    const eventIndex = events.findIndex((event) => event.uuid === operation.functionalEventId);
    const derivedPaths = sequencePathsFromTopology(model);
    const selectedPath = derivedPaths.get(operation.sequenceId);
    if (eventIndex < 0 || selectedPath === undefined) return model;
    const prefixEventIds = events.slice(0, eventIndex).map((event) => event.uuid);
    const affected = Object.values(model.sequences).filter((sequence) => sharesPrefix(derivedPaths.get(sequence.uuid) ?? {}, selectedPath, prefixEventIds));
    const sequences: Record<string, EventTreeSequence> = { ...model.sequences };
    const transfers = { ...(model.transfers ?? {}) };
    if (operation.bypassed) {
      const retainedOutcome = selectedPath[operation.functionalEventId];
      if (retainedOutcome === undefined || retainedOutcome === "BYPASSED") return model;
      for (const sequence of affected) {
        const path = derivedPaths.get(sequence.uuid) ?? {};
        if (path[operation.functionalEventId] !== retainedOutcome) {
          delete sequences[sequence.uuid];
          delete transfers[sequence.uuid];
          continue;
        }
        sequences[sequence.uuid] = {
          ...sequence,
          functionalEventStates: { ...path, [operation.functionalEventId]: "BYPASSED" },
        };
      }
    } else {
      if (selectedPath[operation.functionalEventId] !== "BYPASSED") return model;
      for (const sequence of affected) {
        const path = derivedPaths.get(sequence.uuid) ?? {};
        if (path[operation.functionalEventId] !== "BYPASSED") continue;
        const successPath = { ...path, [operation.functionalEventId]: "SUCCESS" as const };
        const failurePath = { ...path, [operation.functionalEventId]: "FAILURE" as const };
        sequences[sequence.uuid] = { ...sequence, functionalEventStates: successPath };
        const failureId = topologyEntityId(`${model.uuid}:sequence:${sequencePathKey(failurePath, events.map((event) => event.uuid))}`);
        sequences[failureId] = {
          ...sequence,
          uuid: failureId,
          name: `${sequence.name} failure branch`,
          functionalEventStates: failurePath,
        };
        const transfer = model.transfers?.[sequence.uuid];
        if (transfer !== undefined) transfers[failureId] = transfer;
      }
    }
    const intermediate = {
      ...model,
      sequences,
      transfers: Object.keys(transfers).length === 0 ? undefined : transfers,
    };
    return { ...model, ...buildCompleteTopology(intermediate, events) };
  }

  let events = orderedFunctionalEvents(model);
  if (operation.kind === "ADD_FUNCTIONAL_EVENT") {
    if (events.length >= MAX_FUNCTIONAL_EVENTS) return model;
    const index = Math.max(0, Math.min(operation.index ?? events.length, events.length));
    events = [...events.slice(0, index), operation.functionalEvent, ...events.slice(index)];
  } else if (operation.kind === "DELETE_FUNCTIONAL_EVENT") {
    events = events.filter((event) => event.uuid !== operation.functionalEventId);
  }
  return { ...model, ...buildCompleteTopology(model, events) };
}

function createEmptyEventTree(
  initiatingEventId: string,
  plantOperatingStateId?: string,
  initiatingEventFrequency?: number,
): EventTree {
  const uuid = crypto.randomUUID();
  return {
    uuid,
    name: "New event tree",
    initiatingEventId,
    initiatingEventFrequency: initiatingEventFrequency === undefined ? undefined : pointInitiatingFrequency(initiatingEventFrequency),
    plantOperatingStateId,
    endStateIds: {
      SUCCESSFUL_MITIGATION: crypto.randomUUID(),
      RADIONUCLIDE_RELEASE: crypto.randomUUID(),
    },
    functionalEvents: {},
    sequences: {},
    branches: {},
    initialState: { branchId: "" },
    implementsSrs: [],
  };
}

function uniqueFunctionalEventCode(model: EventTree): string {
  const used = new Set(Object.values(model.functionalEvents).map((event) => event.label ?? event.uuid));
  let index = used.size + 1;
  while (used.has(`FE-${String(index)}`)) index += 1;
  return `FE-${String(index)}`;
}

function withoutEndStateId(sequence: EventTreeSequence): EventTreeSequence {
  const { endStateId: _previous, ...rest } = sequence;
  return rest;
}

function validateEventTree(model: EventTree, allTrees: Array<EventTree | string>, endStateIds?: ReadonlySet<string>): EventTreeValidationFinding[] {
  const findings: EventTreeValidationFinding[] = [];
  const treeModels = allTrees.filter((tree): tree is EventTree => typeof tree !== "string");
  const treeIds = new Set(allTrees.map((tree) => typeof tree === "string" ? tree : tree.uuid));
  const treeById = new Map(treeModels.map((tree) => [tree.uuid, tree]));
  const error = (code: string, message: string, entityId?: string): void => {
    findings.push({ code, message, severity: "ERROR", ...(entityId === undefined ? {} : { entityId }) });
  };
  if (model.name.trim().length === 0) error("ET_NAME_REQUIRED", "Event-tree name is required.", model.uuid);
  if (model.initiatingEventId.trim().length === 0) error("ET_INITIATOR_REQUIRED", "Select an initiating event.", model.uuid);
  const frequency = model.initiatingEventFrequency;
  if (frequency === undefined) error("ET_FREQUENCY_REQUIRED", "Enter an initiating-event frequency.", model.uuid);
  else if (!UncertainExpressionSchema.safeParse(frequency.expression).success) error("ET_FREQUENCY_INVALID", "The initiating-event frequency is not a valid expression.", model.uuid);
  else if (frequency.expression.node === "VALUE" && !INITIATING_FREQUENCY_UNITS.has(frequency.expression.value.unit)) error("ET_FREQUENCY_UNIT", "The initiating-event frequency must be per year or per hour.", model.uuid);
  else if (frequency.expression.node === "VALUE" && lawBounds(frequency.expression.value.law).lower < 0) error("ET_FREQUENCY_NEGATIVE", "The initiating-event frequency cannot go below zero.", model.uuid);
  const events = orderedFunctionalEvents(model);
  const derivedPaths = sequencePathsFromTopology(model);
  if (events.length === 0) error("ET_FUNCTIONAL_EVENT_REQUIRED", "Add at least one functional event.", model.uuid);
  events.forEach((event, order) => {
    if (event.order !== order) error("ET_ORDER_INVALID", "Functional-event order must be contiguous.", event.uuid);
    const splitsSuccessFailure = [...derivedPaths.values()].some((path) => path[event.uuid] === "SUCCESS" || path[event.uuid] === "FAILURE");
    if (event.faultTreeTopEvent === undefined && splitsSuccessFailure) {
      error("ET_FT_LINK_REQUIRED", `Link ${event.label ?? event.name} to a fault-tree top event.`, event.uuid);
    }
  });
  const reachableSequences = new Set<string>();
  const visit = (branchId: string, stack: Set<string>): void => {
    if (stack.has(branchId)) {
      error("ET_BRANCH_LOOP", "Event-tree branches cannot contain a loop.", branchId);
      return;
    }
    const branch = model.branches[branchId];
    if (branch === undefined) {
      error("ET_BRANCH_MISSING", `Branch ${branchId} does not exist.`, branchId);
      return;
    }
    const bypasses = branch.paths.filter((path) => path.state === "BYPASSED");
    if (branch.paths.length === 0) {
      error("ET_BRANCH_INCOMPLETE", `${branch.name} needs at least one path.`, branch.uuid);
    }
    if (bypasses.length > 0 && branch.paths.length !== 1) {
      error("ET_BRANCH_BYPASS_INVALID", `${branch.name} cannot mix a bypass with other paths.`, branch.uuid);
    }
    if (branch.paths.length > 2 || branch.paths.some((path) => isEventTreeBranchState(path.state))) {
      error("ET_BRANCH_COUNT", `${branch.name} has more than two branches. Use a success and a failure branch.`, branch.uuid);
    } else if (branch.paths.length === 2 && bypasses.length === 0 && !(["SUCCESS", "FAILURE"] as const).every((state) => branch.paths.some((path) => path.state === state))) {
      error("ET_BRANCH_STATES_INVALID", `${branch.name} needs one success and one failure path.`, branch.uuid);
    }
    const states = new Set<EventTreeOutcome>();
    for (const path of branch.paths) {
      if (states.has(path.state)) {
        error("ET_BRANCH_PATH_DUPLICATE", `${branch.name} repeats its ${path.state.toLowerCase()} path.`, branch.uuid);
      }
      states.add(path.state);
      if (path.targetType === "BRANCH") visit(path.target, new Set(stack).add(branchId));
      else if (path.targetType === "SEQUENCE") reachableSequences.add(path.target);
    }
  };
  if (model.initialState.branchId.length > 0) visit(model.initialState.branchId, new Set());
  for (const sequence of Object.values(model.sequences)) {
    if (!reachableSequences.has(sequence.uuid)) error("ET_SEQUENCE_UNREACHABLE", `${sequence.name} is not reachable from the initiating event.`, sequence.uuid);
    const transfer = model.transfers?.[sequence.uuid];
    if (transfer === undefined && sequence.endState === undefined) error("ET_SEQUENCE_RESULT_REQUIRED", `${sequence.name} needs an end state or transfer.`, sequence.uuid);
    else if (transfer === undefined && endStateIds !== undefined && (sequence.endStateId === undefined || !endStateIds.has(sequence.endStateId))) error("ET_SEQUENCE_END_STATE_REQUIRED", `${sequence.name} needs an end state from the workbook's end states.`, sequence.uuid);
    if (transfer !== undefined && !treeIds.has(transfer.targetEventTreeId)) error("ET_TRANSFER_MISSING", `${sequence.name} references a missing event tree.`, sequence.uuid);
    const reachesOwner = (treeId: string, visited: Set<string>): boolean => {
      if (treeId === model.uuid) return true;
      if (visited.has(treeId)) return false;
      const tree = treeById.get(treeId);
      if (tree === undefined) return false;
      const nextVisited = new Set(visited).add(treeId);
      return Object.values(tree.transfers ?? {}).some((candidate) => reachesOwner(candidate.targetEventTreeId, nextVisited));
    };
    if (transfer !== undefined && reachesOwner(transfer.targetEventTreeId, new Set())) error("ET_TRANSFER_LOOP", `${sequence.name} creates an event-tree transfer loop.`, sequence.uuid);
  }
  return findings;
}

function createEventTreePresentation(
  model: EventTree,
  eventSequences: EventSequence[],
  analysisResult?: EventTreeAnalysisResult | null,
): EventTreePresentationView {
  const events = orderedFunctionalEvents(model);
  const eventIndex = new Map(events.map((event, index) => [event.uuid, index]));
  const linkedSequences = new Map(eventSequences.map((sequence) => [sequence.uuid, sequence]));
  const results = new Map((analysisResult?.sequences ?? []).map((result) => [result.sequenceId, result]));
  const node = (branchId: string, seen: Set<string>): EventTreeNodeView => {
    const branch = model.branches[branchId];
    if (branch === undefined || seen.has(branchId)) return { fe: 0, outcomes: [{ state: "SUCCESS", child: { seq: "" } }, { state: "FAILURE", child: { seq: "" } }] };
    const nextSeen = new Set(seen).add(branchId);
    const nextChild = (path: EventTreePath): EventTreeNodeView | EventTreeLeafReference =>
      path.targetType === "BRANCH" ? node(path.target, nextSeen) : { seq: path.target };
    return {
      fe: eventIndex.get(branch.functionalEventId ?? "") ?? 0,
      outcomes: orderedOutcomes(branch.paths.map((path) => path.state)).flatMap((state) => {
        const path = branch.paths.find((candidate) => candidate.state === state);
        return path === undefined ? [] : [{ state, child: nextChild(path) }];
      }),
    };
  };
  const derivedPaths = sequencePathsFromTopology(model);
  return {
    id: model.uuid,
    name: model.name,
    initiatingEventId: model.initiatingEventId,
    initiatingEventFrequency: model.initiatingEventFrequency,
    functionalEvents: events.map((event) => ({
      id: event.uuid,
      code: event.label ?? event.uuid,
      label: event.name,
      linked: event.faultTreeTopEvent !== undefined,
    })),
    node: model.initialState.branchId.length === 0 ? { seq: "" } : node(model.initialState.branchId, new Set()),
    sequences: Object.values(model.sequences).map((sequence) => {
      const linked = sequence.eventSequenceId === undefined ? undefined : linkedSequences.get(sequence.eventSequenceId);
      const result = results.get(sequence.uuid);
      return {
        id: sequence.uuid,
        name: linked?.name ?? sequence.name,
        endState: String(sequence.endState ?? linked?.endState ?? ""),
        sequenceFamilyId: linked?.sequenceFamilyId,
        releaseCategoryId: linked?.releaseCategoryId,
        meanFrequency: typeof linked?.meanFrequency === "number" ? linked.meanFrequency : linked?.meanFrequency?.value,
        path: derivedPaths.get(sequence.uuid) ?? {},
        endStateId: sequence.endStateId,
        transferTargetId: model.transfers?.[sequence.uuid]?.targetEventTreeId,
        conditionalProbability: result?.conditionalProbability,
        annualFrequency: result?.annualFrequency,
      };
    }),
  };
}

export {
  MAX_FUNCTIONAL_EVENTS,
  applyEventTreeOperation,
  createEmptyEventTree,
  createEventTreePresentation,
  eventTreeMoveProblem,
  frequencyRateUnits,
  initiatingFrequencyUnit,
  orderedFunctionalEvents,
  sequencePathsFromTopology,
  uniqueFunctionalEventCode,
  validateEventTree,
  type FrequencyParameterTable,
  type InitiatingFrequencyUnit,
};
