import type {
  EventSequence,
  EventTree,
  EventTreeBranch,
  EventTreeSequence,
  FunctionalEvent,
  SystemStatus,
} from "interfaces-mef-types/es/event-sequence-analysis";
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

function topologyEntityId(value: string): string {
  return uuidV5(value, EVENT_TREE_ENTITY_NAMESPACE);
}

function orderedFunctionalEvents(model: EventTree): FunctionalEvent[] {
  return Object.values(model.functionalEvents).sort(
    (left, right) => (left.order ?? Number.MAX_SAFE_INTEGER) - (right.order ?? Number.MAX_SAFE_INTEGER),
  );
}

function sequencePathKey(path: Record<string, SystemStatus>, eventIds: string[]): string {
  return eventIds.map((id) => `${id}:${path[id] ?? ""}`).join("|");
}

function sequencePathsFromTopology(model: EventTree): Map<string, Record<string, SystemStatus>> {
  const paths = new Map<string, Record<string, SystemStatus>>();
  const walk = (branchId: string, path: Record<string, SystemStatus>, visited: Set<string>): void => {
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
  expansionEventId?: string,
): Pick<EventTree, "functionalEvents" | "branches" | "initialState" | "sequences" | "transfers"> {
  const eventIds = functionalEvents.map((event) => event.uuid);
  const previousPaths = sequencePathsFromTopology(model);
  const previousCandidates = Object.values(model.sequences).map((sequence) => ({
    sequence,
    path: previousPaths.get(sequence.uuid) ?? {},
  }));
  const sequences: Record<string, EventTreeSequence> = {};
  const transfers: NonNullable<EventTree["transfers"]> = {};
  let desiredPaths: Array<Record<string, SystemStatus>>;
  if (eventIds.length === 0) {
    desiredPaths = [];
  } else if (previousCandidates.length === 0) {
    desiredPaths = Array.from({ length: 2 ** eventIds.length }, (_, index) => Object.fromEntries(
      eventIds.map((eventId, eventIndex) => [
        eventId,
        ((index >> (eventIds.length - eventIndex - 1)) & 1) === 0 ? "SUCCESS" : "FAILURE",
      ]),
    ));
  } else {
    const projected = previousCandidates.map(({ path }) => Object.fromEntries(
      eventIds.map((eventId) => [eventId, path[eventId] ?? "BYPASSED"]),
    ) as Record<string, SystemStatus>);
    desiredPaths = expansionEventId === undefined
      ? projected
      : projected.flatMap((path) => [
          { ...path, [expansionEventId]: "SUCCESS" as const },
          { ...path, [expansionEventId]: "FAILURE" as const },
        ]);
    desiredPaths = [...new Map(desiredPaths.map((path) => [sequencePathKey(path, eventIds), path])).values()];
  }

  const paths: Array<{ id: string; path: Record<string, SystemStatus> }> = [];
  desiredPaths.forEach((path, index) => {
    const key = sequencePathKey(path, eventIds);
    const previousCandidate = previousCandidates.find((candidate) => sequencePathKey(
      Object.fromEntries(eventIds.map((eventId) => [eventId, candidate.path[eventId] ?? "BYPASSED"])),
      eventIds,
    ) === key);
    const previous = previousCandidate?.sequence ?? previousCandidates.find((candidate) =>
      Object.entries(candidate.path).every(([eventId, outcome]) => path[eventId] === undefined || path[eventId] === outcome),
    )?.sequence;
    const id = expansionEventId === undefined && previousCandidate !== undefined
      ? previousCandidate.sequence.uuid
      : topologyEntityId(`${model.uuid}:sequence:${key}`);
    sequences[id] = {
      uuid: id,
      name: previous?.name ?? `Sequence ${String(index + 1)}`,
      endState: previous?.endState ?? EndState.SUCCESSFUL_MITIGATION,
      eventSequenceId: previous?.eventSequenceId,
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
    const outcomes = (["SUCCESS", "FAILURE", "BYPASSED"] as const).flatMap((state) => {
      const matching = candidates.filter((candidate) => candidate.path[functionalEventId] === state);
      return matching.length === 0 ? [] : [{ state, ...build(depth + 1, matching) }];
    });
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
          ...current,
          endState: operation.endState === "SUCCESSFUL_MITIGATION"
            ? EndState.SUCCESSFUL_MITIGATION
            : EndState.RADIONUCLIDE_RELEASE,
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
      ...(operation.targetSequenceId === undefined ? {} : { targetSequenceId: operation.targetSequenceId }),
    };
    return {
      ...model,
      sequences: {
        ...model.sequences,
        [current.uuid]: operation.targetEventTreeId === null
          ? { ...current, endState: current.endState ?? EndState.SUCCESSFUL_MITIGATION }
          : { ...current, endState: undefined },
      },
      transfers: Object.keys(transfers).length === 0 ? undefined : transfers,
    };
  }
  if (operation.kind === "SET_FUNCTIONAL_EVENT_BYPASS") {
    const events = orderedFunctionalEvents(model);
    const eventIndex = events.findIndex((event) => event.uuid === operation.functionalEventId);
    const derivedPaths = sequencePathsFromTopology(model);
    const selectedPath = derivedPaths.get(operation.sequenceId);
    if (eventIndex < 0 || selectedPath === undefined) return model;
    const prefixEventIds = events.slice(0, eventIndex).map((event) => event.uuid);
    const sharesPrefix = (path: Record<string, SystemStatus>): boolean => prefixEventIds.every(
      (eventId) => path[eventId] === selectedPath[eventId],
    );
    const affected = Object.values(model.sequences).filter((sequence) => sharesPrefix(derivedPaths.get(sequence.uuid) ?? {}));
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
  } else if (operation.kind === "MOVE_FUNCTIONAL_EVENT") {
    const from = events.findIndex((event) => event.uuid === operation.functionalEventId);
    const to = from + operation.direction;
    if (from < 0 || to < 0 || to >= events.length) return model;
    const next = [...events];
    [next[from], next[to]] = [next[to]!, next[from]!];
    events = next;
  } else if (operation.kind === "REORDER_FUNCTIONAL_EVENT") {
    const from = events.findIndex((event) => event.uuid === operation.functionalEventId);
    const to = Math.max(0, Math.min(operation.targetIndex, events.length - 1));
    if (from < 0 || from === to) return model;
    const next = [...events];
    const [moved] = next.splice(from, 1);
    if (moved === undefined) return model;
    next.splice(to, 0, moved);
    events = next;
  }
  return {
    ...model,
    ...buildCompleteTopology(
      model,
      events,
      operation.kind === "ADD_FUNCTIONAL_EVENT" ? operation.functionalEvent.uuid : undefined,
    ),
  };
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
    initiatingEventFrequency: initiatingEventFrequency === undefined ? undefined : { value: initiatingEventFrequency },
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

function validateEventTree(model: EventTree, allTrees: Array<EventTree | string>): EventTreeValidationFinding[] {
  const findings: EventTreeValidationFinding[] = [];
  const treeModels = allTrees.filter((tree): tree is EventTree => typeof tree !== "string");
  const treeIds = new Set(allTrees.map((tree) => typeof tree === "string" ? tree : tree.uuid));
  const treeById = new Map(treeModels.map((tree) => [tree.uuid, tree]));
  const error = (code: string, message: string, entityId?: string): void => {
    findings.push({ code, message, severity: "ERROR", ...(entityId === undefined ? {} : { entityId }) });
  };
  if (model.name.trim().length === 0) error("ET_NAME_REQUIRED", "Event-tree name is required.", model.uuid);
  if (model.initiatingEventId.trim().length === 0) error("ET_INITIATOR_REQUIRED", "Select an initiating event.", model.uuid);
  const frequency = model.initiatingEventFrequency?.value;
  if (frequency === undefined || !Number.isFinite(frequency) || frequency < 0) {
    error("ET_FREQUENCY_REQUIRED", "Enter a finite, non-negative initiating-event frequency.", model.uuid);
  }
  const events = orderedFunctionalEvents(model);
  const derivedPaths = sequencePathsFromTopology(model);
  if (events.length === 0) error("ET_FUNCTIONAL_EVENT_REQUIRED", "Add at least one functional event.", model.uuid);
  events.forEach((event, order) => {
    if (event.order !== order) error("ET_ORDER_INVALID", "Functional-event order must be contiguous.", event.uuid);
    const bypassedEverywhere = derivedPaths.size > 0 && [...derivedPaths.values()].every((path) => path[event.uuid] === "BYPASSED");
    if (event.faultTreeTopEvent === undefined && !bypassedEverywhere) {
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
    const expectedStates = bypasses.length > 0 ? (["BYPASSED"] as const) : (["SUCCESS", "FAILURE"] as const);
    if (bypasses.length > 0 && branch.paths.length !== 1) {
      error("ET_BRANCH_BYPASS_INVALID", `${branch.name} must use either one bypass path or success and failure paths.`, branch.uuid);
    }
    for (const state of expectedStates) {
      const matchingPaths = branch.paths.filter((path) => path.state === state);
      if (matchingPaths.length !== 1) error("ET_BRANCH_INCOMPLETE", `${branch.name} needs exactly one ${state.toLowerCase()} path.`, branch.uuid);
      const path = matchingPaths[0];
      if (path?.targetType === "BRANCH") visit(path.target, new Set(stack).add(branchId));
      else if (path?.targetType === "SEQUENCE") reachableSequences.add(path.target);
    }
    if (bypasses.length > 0) {
      for (const state of ["SUCCESS", "FAILURE"] as const) {
        const path = branch.paths.find((candidate) => candidate.state === state);
        if (path?.targetType === "BRANCH") visit(path.target, new Set(stack).add(branchId));
        else if (path?.targetType === "SEQUENCE") reachableSequences.add(path.target);
      }
    }
  };
  if (model.initialState.branchId.length > 0) visit(model.initialState.branchId, new Set());
  for (const sequence of Object.values(model.sequences)) {
    if (!reachableSequences.has(sequence.uuid)) error("ET_SEQUENCE_UNREACHABLE", `${sequence.name} is not reachable from the initiating event.`, sequence.uuid);
    const transfer = model.transfers?.[sequence.uuid];
    if (transfer === undefined && sequence.endState === undefined) error("ET_SEQUENCE_RESULT_REQUIRED", `${sequence.name} needs an end state or transfer.`, sequence.uuid);
    if (transfer !== undefined && !treeIds.has(transfer.targetEventTreeId)) error("ET_TRANSFER_MISSING", `${sequence.name} references a missing event tree.`, sequence.uuid);
    if (transfer !== undefined && (transfer.targetSequenceId === undefined || transfer.targetSequenceId.length === 0)) error("ET_TRANSFER_SEQUENCE_REQUIRED", `${sequence.name} needs a target sequence.`, sequence.uuid);
    const targetTree = transfer === undefined ? undefined : treeById.get(transfer.targetEventTreeId);
    if (targetTree !== undefined && transfer?.targetSequenceId !== undefined && targetTree.sequences[transfer.targetSequenceId] === undefined) {
      error("ET_TRANSFER_SEQUENCE_MISSING", `${sequence.name} references a missing target sequence.`, sequence.uuid);
    }
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
    if (branch === undefined || seen.has(branchId)) return { fe: 0, S: { seq: "" }, F: { seq: "" } };
    const nextSeen = new Set(seen).add(branchId);
    const success = branch.paths.find((path) => path.state === "SUCCESS");
    const failure = branch.paths.find((path) => path.state === "FAILURE");
    const bypassed = branch.paths.find((path) => path.state === "BYPASSED");
    const nextChild = (path: typeof success): EventTreeNodeView | EventTreeLeafReference =>
      path === undefined ? { seq: "" } : path.targetType === "BRANCH" ? node(path.target, nextSeen) : { seq: path.target };
    return {
      fe: eventIndex.get(branch.functionalEventId ?? "") ?? 0,
      ...(success === undefined ? {} : { S: nextChild(success) }),
      ...(failure === undefined ? {} : { F: nextChild(failure) }),
      ...(bypassed === undefined ? {} : { B: nextChild(bypassed) }),
    };
  };
  const derivedPaths = sequencePathsFromTopology(model);
  return {
    id: model.uuid,
    name: model.name,
    initiatingEventId: model.initiatingEventId,
    initiatingEventFrequency: model.initiatingEventFrequency?.value,
    functionalEvents: events.map((event) => ({
      id: event.uuid,
      code: event.label ?? event.uuid,
      label: event.name,
      sub: event.description ?? "",
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
  orderedFunctionalEvents,
  sequencePathsFromTopology,
  uniqueFunctionalEventCode,
  validateEventTree,
};
