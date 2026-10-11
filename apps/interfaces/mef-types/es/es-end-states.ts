import { EndState } from "../core/events";
import type { SuccessCriteriaDevelopment } from "../sc/success-criteria-development";
import type { EsEndStateDefinition, EsEndStateKind, EventSequenceAnalysis, EventTreeSequence } from "./event-sequence-analysis";

const SAFE_END_STATE_ID = "end-state-safe-stable";
const OPEN_RELEASE_END_STATE_ID = "end-state-release";

function releaseEndStateId(releaseCategoryId: string): string {
  return `end-state-${releaseCategoryId}`;
}

function endStateOfKind(kind: EsEndStateKind): EndState {
  return kind === "RELEASE" ? EndState.RADIONUCLIDE_RELEASE : EndState.SUCCESSFUL_MITIGATION;
}

function withEndStateCatalog(es: EventSequenceAnalysis, sc?: SuccessCriteriaDevelopment): EventSequenceAnalysis {
  if ((es.endStateDefinitions ?? []).length > 0) return es;
  const scSafe = sc?.endStateDefinitions.find((definition) => definition.endState === EndState.SUCCESSFUL_MITIGATION);
  const safeDefinition = scSafe?.definition ?? sc?.safeStableStateDefinition.definition;
  const definitions: EsEndStateDefinition[] = [{
    id: SAFE_END_STATE_ID,
    code: "SSS",
    name: "Safe stable state",
    kind: "SAFE_STABLE",
    ...(safeDefinition === undefined ? {} : { definition: safeDefinition }),
    ...(scSafe === undefined ? {} : { scEndStateId: scSafe.uuid }),
  }];
  const mappings = es.releaseCategoryMappings ?? [];
  const categories = [...new Set([
    ...mappings.map((mapping) => mapping.releaseCategoryId),
    ...es.eventSequences.flatMap((sequence) => (sequence.releaseCategoryId === undefined ? [] : [sequence.releaseCategoryId])),
  ])];
  for (const category of categories) {
    const mapping = mappings.find((candidate) => candidate.releaseCategoryId === category);
    const scRelease = sc?.endStateDefinitions.find((definition) => definition.resultingReleaseCategoryId === category || definition.releaseCategoryReferences.includes(category));
    const definition = scRelease?.definition ?? mapping?.mappingBasis;
    definitions.push({
      id: releaseEndStateId(category),
      code: category,
      name: mapping?.name !== undefined && mapping.name.length > 0 ? mapping.name : `${category} release`,
      kind: "RELEASE",
      releaseCategoryId: category,
      ...(definition === undefined || definition.length === 0 ? {} : { definition }),
      ...(scRelease === undefined ? {} : { scEndStateId: scRelease.uuid }),
    });
  }
  const linked = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence]));
  const endStateId = (endState: EndState | undefined, releaseCategoryId: string | undefined): string | undefined => {
    if (endState === EndState.SUCCESSFUL_MITIGATION) return SAFE_END_STATE_ID;
    if (endState !== EndState.RADIONUCLIDE_RELEASE) return undefined;
    if (releaseCategoryId !== undefined && categories.includes(releaseCategoryId)) return releaseEndStateId(releaseCategoryId);
    return OPEN_RELEASE_END_STATE_ID;
  };
  const eventSequences = es.eventSequences.map((sequence) => {
    const id = endStateId(sequence.endState, sequence.releaseCategoryId);
    return id === undefined ? sequence : { ...sequence, endStateId: id };
  });
  const eventTrees = es.eventTrees?.map((tree) => ({
    ...tree,
    sequences: Object.fromEntries(Object.entries(tree.sequences).map(([sequenceId, sequence]): [string, EventTreeSequence] => {
      if (tree.transfers?.[sequenceId] !== undefined) return [sequenceId, sequence];
      const record = sequence.eventSequenceId === undefined ? undefined : linked.get(sequence.eventSequenceId);
      const id = endStateId(sequence.endState ?? record?.endState, record?.releaseCategoryId);
      return [sequenceId, id === undefined ? sequence : { ...sequence, endStateId: id }];
    })),
  }));
  const usesOpenRelease = eventSequences.some((sequence) => sequence.endStateId === OPEN_RELEASE_END_STATE_ID)
    || (eventTrees ?? []).some((tree) => Object.values(tree.sequences).some((sequence) => sequence.endStateId === OPEN_RELEASE_END_STATE_ID));
  if (usesOpenRelease) definitions.push({ id: OPEN_RELEASE_END_STATE_ID, code: "REL", name: "Release without a category", kind: "RELEASE" });
  return { ...es, endStateDefinitions: definitions, eventSequences, ...(eventTrees === undefined ? {} : { eventTrees }) };
}

export { endStateOfKind, withEndStateCatalog };
