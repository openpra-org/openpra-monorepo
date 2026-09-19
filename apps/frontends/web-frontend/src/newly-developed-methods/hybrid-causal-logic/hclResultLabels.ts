import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import type {
  EventTreeAnalysisResult,
  EventTreeSequenceAnalysisResult,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclEventTreeOption } from "./hclBindingTypes";

function outcomeName(state: string): string {
  return (
    state === "SUCCESSFUL_MITIGATION" ? "Safe state"
    : state === "RADIONUCLIDE_RELEASE" ? "Release"
    : state
  );
}

/** Presentation metadata only. Legacy generated end-state IDs are resolved from returned sequences. */
export function hclEventTreeResultMetadata(
  trees: readonly Pick<EventTree, "uuid" | "name" | "sequences" | "endStateIds" | "transfers">[],
): Pick<HclEventTreeOption, "sequences" | "endStates"> {
  return {
    sequences: trees.flatMap((tree) =>
      Object.values(tree.sequences).map((sequence) => ({
        id: sequence.uuid,
        name: sequence.name,
        modelId: tree.uuid,
        modelName: tree.name,
        ...(tree.transfers?.[sequence.uuid] === undefined && sequence.endState !== undefined ?
          { endStateName: outcomeName(sequence.endState) }
        : {}),
      })),
    ),
    endStates: trees.flatMap((tree) =>
      Object.entries(tree.endStateIds ?? {}).flatMap(([state, id]) =>
        id === undefined ? [] : [{ id, name: outcomeName(state) }],
      ),
    ),
  };
}

export function sequenceEndState(sequence: EventTreeSequenceAnalysisResult): string | undefined {
  return sequence.result.kind === "END_STATE" ? sequence.result.endStateId : undefined;
}

export function hclResultLabels(options: readonly HclEventTreeOption[], results: readonly EventTreeAnalysisResult[]) {
  // Connected trees can be present only inside a root option. Keep their own identity.
  const sequences = new Map<string, { name: string; modelName: string; endStateName?: string }>();
  const sequenceKey = (modelId: string, id: string) => JSON.stringify([modelId, id]);
  options.forEach((option) =>
    option.sequences.forEach((sequence) => {
      const modelId = sequence.modelId ?? option.modelId;
      sequences.set(sequenceKey(modelId, sequence.id), {
        ...sequence,
        modelName: sequence.modelName ?? options.find((tree) => tree.modelId === modelId)?.modelName ?? modelId,
      });
    }),
  );
  const sequenceMetadata = (modelId: string, id: string) => sequences.get(sequenceKey(modelId, id));
  const names = new Map<string, Set<string>>();
  const addName = (id: string, name: string) => {
    const entries = names.get(id) ?? new Set<string>();
    entries.add(name);
    names.set(id, entries);
  };
  const resultModelIds = new Set(
    results.flatMap((result) => [
      result.owner.modelId,
      ...result.sequences.flatMap((sequence) => sequence.sequenceChain?.map((step) => step.modelId) ?? []),
    ]),
  );
  options
    .filter((option) => resultModelIds.has(option.modelId))
    .forEach((option) => option.endStates?.forEach((state) => addName(state.id, state.name)));
  results.forEach((result) =>
    result.sequences.forEach((sequence) => {
      const id = sequenceEndState(sequence);
      const terminal = sequence.sequenceChain?.at(-1);
      const name = sequenceMetadata(
        terminal?.modelId ?? result.owner.modelId,
        terminal?.entityId ?? sequence.sequenceId,
      )?.endStateName;
      if (id !== undefined && name !== undefined) addName(id, name);
    }),
  );
  return {
    sequenceName: (modelId: string, id: string): string | undefined => {
      const sequence = sequenceMetadata(modelId, id);
      return sequence === undefined ? undefined : `${sequence.modelName} / ${sequence.name}`;
    },
    endStateName: (id: string): string => {
      const values = names.get(id);
      return values?.size === 1 ? `${[...values][0]} (${id})` : id;
    },
  };
}
