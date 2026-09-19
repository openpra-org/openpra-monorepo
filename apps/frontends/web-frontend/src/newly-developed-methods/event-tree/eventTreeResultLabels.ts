import type { EventTreeSequenceAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { EventTreeEditorProps } from "./eventTreeTypes";

export function eventTreeSequenceLabel(
  sequence: EventTreeSequenceAnalysisResult,
  name: (modelId: string, sequenceId: string) => string | undefined,
): string {
  return (
    sequence.sequenceChain?.map((step) => name(step.modelId, step.entityId) ?? step.entityId).join(" → ") ??
    name("", sequence.sequenceId) ??
    sequence.sequenceId
  );
}

export function eventTreeResultName(
  model: EventTreeEditorProps["model"],
  availableTransfers: EventTreeEditorProps["availableTransfers"],
) {
  const name = (treeId: string, sequenceId: string): string | undefined => {
    if (treeId === model.uuid) return model.sequences[sequenceId]?.name;
    const tree = availableTransfers.find((candidate) => candidate.id === treeId);
    const index = tree?.sequenceIds.indexOf(sequenceId) ?? -1;
    return tree === undefined || index < 0 ? undefined : `${tree.name} / Sequence ${String(index + 1)}`;
  };
  return name;
}
