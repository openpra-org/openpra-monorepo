import { randomUUID } from "node:crypto";
import { arrayField, field, isRecord, recordField, textField, without, type Json, type JsonRecord } from "./uncertainty-migration-json";

const COPIED_RECORD_FIELDS = [
  "initiatingEventId",
  "plantOperatingStateId",
  "endState",
  "endStateId",
  "sequenceFamilyId",
  "releaseCategoryId",
  "affectedReactorSourceCombinations",
];

function distinctName(base: string, taken: ReadonlySet<string>): string {
  if (base.length === 0) {
    let index = 1;
    while (taken.has(`Sequence ${String(index)}`)) index += 1;
    return `Sequence ${String(index)}`;
  }
  if (!taken.has(base)) return base;
  let index = 2;
  while (taken.has(`${base}-${String(index)}`)) index += 1;
  return `${base}-${String(index)}`;
}

function copiedRecord(record: JsonRecord, uuid: string, name: string, treeId: string, sequenceId: string, sequence: JsonRecord): JsonRecord {
  const copied: JsonRecord = { uuid, name, eventTreeId: treeId, eventTreeSequenceId: sequenceId, implementsSrs: [] };
  for (const key of COPIED_RECORD_FIELDS) {
    const value = field(record, key);
    if (value !== undefined) copied[key] = value;
  }
  const states = field(sequence, "functionalEventStates");
  if (states !== undefined) copied["functionalEventStates"] = states;
  return copied;
}

function withAddedIds(list: Json | undefined, added: readonly string[]): Json[] {
  return [...(Array.isArray(list) ? list : []), ...added];
}

function withDistinctEsSequences(mef: JsonRecord): JsonRecord {
  const trees = arrayField(mef, "eventTrees");
  if (trees === undefined) return mef;
  const records = new Map((arrayField(mef, "eventSequences") ?? []).flatMap((record) => {
    if (!isRecord(record)) return [];
    const id = textField(record, "uuid");
    return id === undefined ? [] : [[id, record] as const];
  }));
  const takenNames = new Set<string>();
  const usedRecords = new Set<string>();
  const copies: JsonRecord[] = [];
  let changed = false;
  const nextTrees = trees.map((tree): Json => {
    if (!isRecord(tree)) return tree;
    const sequences = recordField(tree, "sequences");
    if (sequences === undefined) return tree;
    const treeId = textField(tree, "uuid") ?? "";
    let treeChanged = false;
    const nextSequences = Object.fromEntries(Object.entries(sequences).map(([sequenceId, sequence]): [string, Json] => {
      if (!isRecord(sequence)) return [sequenceId, sequence];
      let next: JsonRecord = sequence;
      const stored = field(sequence, "name");
      const current = typeof stored === "string" ? stored : "";
      const name = distinctName(current, takenNames);
      takenNames.add(name);
      if (name !== current) next = { ...next, name };
      const recordId = textField(sequence, "eventSequenceId");
      if (recordId !== undefined) {
        if (!usedRecords.has(recordId)) usedRecords.add(recordId);
        else {
          const record = records.get(recordId);
          if (record === undefined) {
            next = without(next, ["eventSequenceId"]);
          } else {
            const uuid = randomUUID();
            copies.push(copiedRecord(record, uuid, name, treeId, sequenceId, next));
            next = { ...next, eventSequenceId: uuid };
          }
        }
      }
      if (next !== sequence) treeChanged = true;
      return [sequenceId, next];
    }));
    if (!treeChanged) return tree;
    changed = true;
    return { ...tree, sequences: nextSequences };
  });
  if (!changed) return mef;
  const familyMembers = new Map<string, string[]>();
  const categoryMembers = new Map<string, string[]>();
  for (const copy of copies) {
    const uuid = textField(copy, "uuid") ?? "";
    const family = textField(copy, "sequenceFamilyId");
    const category = textField(copy, "releaseCategoryId");
    if (family !== undefined) familyMembers.set(family, [...(familyMembers.get(family) ?? []), uuid]);
    if (category !== undefined) categoryMembers.set(category, [...(categoryMembers.get(category) ?? []), uuid]);
  }
  const families = arrayField(mef, "eventSequenceFamilies");
  const mappings = arrayField(mef, "releaseCategoryMappings");
  return {
    ...mef,
    eventTrees: nextTrees,
    eventSequences: [...(arrayField(mef, "eventSequences") ?? []), ...copies],
    ...(families === undefined ? {} : {
      eventSequenceFamilies: families.map((family): Json => {
        if (!isRecord(family)) return family;
        const added = familyMembers.get(textField(family, "uuid") ?? "");
        return added === undefined ? family : { ...family, memberSequenceIds: withAddedIds(field(family, "memberSequenceIds"), added) };
      }),
    }),
    ...(mappings === undefined ? {} : {
      releaseCategoryMappings: mappings.map((mapping): Json => {
        if (!isRecord(mapping)) return mapping;
        const added = categoryMembers.get(textField(mapping, "releaseCategoryId") ?? "");
        return added === undefined ? mapping : { ...mapping, eventSequenceIds: withAddedIds(field(mapping, "eventSequenceIds"), added) };
      }),
    }),
  };
}

export { withDistinctEsSequences };
