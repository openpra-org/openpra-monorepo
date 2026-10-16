import { arrayField, isRecord, recordField, textField, withArray, withRecord, type Json, type JsonRecord } from "./uncertainty-migration-json";

const SAFE_END_STATE_ID = "end-state-safe-stable";
const OPEN_RELEASE_END_STATE_ID = "end-state-release";

function releaseEndStateId(releaseCategoryId: string): string {
  return `end-state-${releaseCategoryId}`;
}

function recordsOf(values: Json[] | undefined): JsonRecord[] {
  return (values ?? []).flatMap((value) => (isRecord(value) ? [value] : []));
}

function withEsEndStateCatalog(mef: JsonRecord): JsonRecord {
  if ((arrayField(mef, "endStateDefinitions") ?? []).length > 0) return mef;
  const mappings = recordsOf(arrayField(mef, "releaseCategoryMappings"));
  const sequences = recordsOf(arrayField(mef, "eventSequences"));
  const categories = [...new Set([...mappings, ...sequences].flatMap((record) => {
    const category = textField(record, "releaseCategoryId");
    return category === undefined || category.length === 0 ? [] : [category];
  }))];
  const definitions: JsonRecord[] = [{ id: SAFE_END_STATE_ID, code: "SSS", name: "Safe stable state", kind: "SAFE_STABLE" }];
  for (const category of categories) {
    const mapping = mappings.find((candidate) => textField(candidate, "releaseCategoryId") === category);
    const name = mapping === undefined ? undefined : textField(mapping, "name");
    const basis = mapping === undefined ? undefined : textField(mapping, "mappingBasis");
    definitions.push({
      id: releaseEndStateId(category),
      code: category,
      name: name !== undefined && name.length > 0 ? name : `${category} release`,
      kind: "RELEASE",
      releaseCategoryId: category,
      ...(basis === undefined || basis.length === 0 ? {} : { definition: basis }),
    });
  }
  const linked = new Map(sequences.flatMap((sequence) => {
    const id = textField(sequence, "uuid");
    return id === undefined ? [] : [[id, sequence] as const];
  }));
  const openRelease = new Set<string>();
  const endStateId = (endState: string | undefined, releaseCategoryId: string | undefined): string | undefined => {
    if (endState === "SUCCESSFUL_MITIGATION") return SAFE_END_STATE_ID;
    if (endState !== "RADIONUCLIDE_RELEASE") return undefined;
    if (releaseCategoryId !== undefined && categories.includes(releaseCategoryId)) return releaseEndStateId(releaseCategoryId);
    openRelease.add(OPEN_RELEASE_END_STATE_ID);
    return OPEN_RELEASE_END_STATE_ID;
  };
  const withSequences = withArray(mef, "eventSequences", (sequence) => {
    const id = endStateId(textField(sequence, "endState"), textField(sequence, "releaseCategoryId"));
    return id === undefined ? sequence : { ...sequence, endStateId: id };
  });
  const withTrees = withArray(withSequences, "eventTrees", (tree) => withRecord(tree, "sequences", (treeSequences) => {
    const transfers = recordField(tree, "transfers") ?? {};
    return Object.fromEntries(Object.entries(treeSequences).map(([sequenceId, sequence]): [string, Json] => {
      if (!isRecord(sequence) || transfers[sequenceId] !== undefined) return [sequenceId, sequence];
      const recordId = textField(sequence, "eventSequenceId");
      const record = recordId === undefined ? undefined : linked.get(recordId);
      const endState = textField(sequence, "endState") ?? (record === undefined ? undefined : textField(record, "endState"));
      const id = endStateId(endState, record === undefined ? undefined : textField(record, "releaseCategoryId"));
      return [sequenceId, id === undefined ? sequence : { ...sequence, endStateId: id }];
    }));
  }));
  if (openRelease.size > 0) definitions.push({ id: OPEN_RELEASE_END_STATE_ID, code: "REL", name: "Release without a category", kind: "RELEASE" });
  return { ...withTrees, endStateDefinitions: definitions };
}

export { withEsEndStateCatalog };
