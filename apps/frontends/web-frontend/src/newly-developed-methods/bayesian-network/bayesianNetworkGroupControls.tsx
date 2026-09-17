import { useEffect, useMemo, useState, type JSX } from "react";
import type { BayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  type BayesianNetworkVisualSubmodel,
  removeBayesianNetworkSubmodel,
  saveBayesianNetworkSubmodel,
} from "./bayesianNetworkInterchange";

/** Author GeNIe presentation groups inside the shared BN editor. */
export function BayesianNetworkGroupControls({ model, groups, onChange }: {
  model: BayesianNetworkModel;
  groups: BayesianNetworkVisualSubmodel[];
  onChange: (model: BayesianNetworkModel) => void;
}): JSX.Element {
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = groups.find((group) => group.id === groupId);
  useEffect(() => {
    setName(selected?.name ?? "");
    setParentId(selected?.parentId ?? "");
    setMembers(selected?.nodeIds ?? []);
    setError(null);
  }, [selected, model.modelId]);
  const excludedParents = useMemo(() => {
    const excluded = new Set(groupId === "" ? [] : [groupId]);
    for (const group of groups) {
      if (group.parentId !== null && excluded.has(group.parentId)) excluded.add(group.id);
    }
    return excluded;
  }, [groups, groupId]);
  const visibleNodes = model.nodes.filter((node) => `${node.code} ${node.name}`.toLowerCase().includes(search.toLowerCase()));
  const ownerByNodeId = new Map(groups.flatMap((group) => group.nodeIds.map((id) => [id, group] as const)));
  function apply(remove = false): void {
    try {
      const next = remove && selected !== undefined
        ? removeBayesianNetworkSubmodel(model, selected.id)
        : saveBayesianNetworkSubmodel(model, {
          ...(selected === undefined ? {} : { id: selected.id }),
          name, parentId: parentId || null, nodeIds: members,
        });
      onChange(next);
      setGroupId("");
      setName("");
      setParentId("");
      setMembers([]);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update groups.");
    }
  }
  return (
    <section className="bneditor__groups" id={`bn-groups-${model.modelId}`} aria-label="Manage BN groups">
      <div className="bneditor__group-form">
        <p>Group existing nodes for display. Removing a group keeps its nodes and nested groups.</p>
        <div className="bneditor__group-fields">
          <label><span>Group</span><select aria-label="Group to edit" value={selected?.id ?? ""} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">New group</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}
          </select></label>
          <label><span>Name</span><input aria-label="Group name" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label><span>Parent group</span><select aria-label="Parent group" value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">Root</option>
            {groups.filter((group) => !excludedParents.has(group.id)).map((group) => <option key={group.id} value={group.id}>{group.path}</option>)}
          </select></label>
        </div>
        <label className="bneditor__field"><span>Find nodes</span><input aria-label="Find group nodes" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <div className="bneditor__group-members" aria-label="Group members">
          {visibleNodes.map((node) => {
            const owner = ownerByNodeId.get(node.id);
            return <label key={node.id}>
              <input type="checkbox" aria-label={`Include ${node.code} in group`} checked={members.includes(node.id)} onChange={(event) =>
                setMembers((current) => event.target.checked ? [...current, node.id] : current.filter((id) => id !== node.id))} />
              <span>{node.code} — {node.name}<small>{owner?.path ?? "Root"}</small></span>
            </label>;
          })}
          {visibleNodes.length === 0 && <span>No matching nodes.</span>}
        </div>
        <div className="bneditor__group-actions">
          <span>{members.length} selected</span>
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={name.trim() === ""} onClick={() => apply()}>{selected === undefined ? "Create group" : "Save group"}</button>
          {selected !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => apply(true)}>Remove group</button>}
        </div>
        {error !== null && <p className="bneditor__error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
