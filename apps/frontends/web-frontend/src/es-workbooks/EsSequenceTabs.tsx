import { type JSX, useId, useMemo, useState } from "react";
import type { EsBarrierCondition, EsEndStateKind, EventSequenceAnalysis, EventSequenceFamily, EventTreeTransfer } from "interfaces-mef-types/es/event-sequence-analysis";
import { EndState } from "interfaces-mef-types/core/events";
import { endStateOfKind } from "interfaces-mef-types/es/es-end-states";
import { applyEventTreeOperation, validateEventTree } from "../newly-developed-methods/event-tree";
import { DialogHead, DialogShell } from "./EsScope";
import { useEsWorkbook } from "./esWorkbookContext";
import {
  dependencyBoundFunctionalEvents,
  endStateUseCount,
  familyRows,
  nextReleaseCategoryId,
  releaseCategoryInUse,
  releaseCategoryRows,
  transferLoops,
  transferRows,
  treeSequenceRows,
  unfamiliedSequences,
  withFamiliesByDefinition,
  withFamilyRemoved,
  withFamilySaved,
  withReleaseCategoryMerged,
  withReleaseCategoryRemoved,
  withReleaseCategorySaved,
  withSyncedSequenceEndState,
  withTransferEdited,
  withTreeSequenceClassification,
  type CoverageAxis,
  type TreeSequenceRow,
} from "./esSelectors";

type RecordTab = "sequences" | "endstates" | "categories" | "families" | "transfers" | "checks";

type EsCheckTarget =
  | { kind: "tree"; treeId: string; entityId?: string }
  | { kind: "endState"; id: string }
  | { kind: "category"; id: string }
  | { kind: "family"; id: string };

interface EsSequenceFinding {
  severity: "error" | "warning";
  check: string;
  item: string;
  detail: string;
  target?: EsCheckTarget;
}

const SEQUENCE_PAGE = 50;
const TABLE_PAGE = 10;
const NONE = "__none__";
const TRANSFER = "__transfer__";

const END_STATE_KINDS: { id: EsEndStateKind; label: string }[] = [
  { id: "SAFE_STABLE", label: "Safe stable state" },
  { id: "RELEASE", label: "Release" },
  { id: "INTERMEDIATE", label: "Intermediate state" },
];

const BARRIER_CONDITIONS: { id: EsBarrierCondition; label: string }[] = [
  { id: "INTACT", label: "Intact" },
  { id: "DEGRADED", label: "Degraded" },
  { id: "FAILED", label: "Failed" },
  { id: "BYPASSED", label: "Bypassed" },
];

function lines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

function counted(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function pageOf<T>(items: readonly T[], page: number, size: number): { current: number; shown: T[] } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages - 1);
  return { current, shown: items.slice(current * size, (current + 1) * size) };
}

function Pager({ current, size, total, one, many, onPage }: { current: number; size: number; total: number; one: string; many: string; onPage: (page: number) => void }): JSX.Element {
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return <span className="possubtle">{counted(total, one, many)}</span>;
  return (
    <span className="es-pager">
      <span className="possubtle">{current * size + 1} to {Math.min(total, (current + 1) * size)} of {counted(total, one, many)}</span>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={current === 0} onClick={() => onPage(current - 1)}>Previous</button>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={current >= pages - 1} onClick={() => onPage(current + 1)}>Next</button>
    </span>
  );
}

function withTreeSequenceEndState(es: EventSequenceAnalysis, treeId: string, sequenceId: string, endStateId: string): EventSequenceAnalysis {
  const definition = es.endStateDefinitions?.find((candidate) => candidate.id === endStateId);
  if (definition === undefined) return es;
  const next: EventSequenceAnalysis = {
    ...es,
    eventTrees: (es.eventTrees ?? []).map((tree) => (tree.uuid === treeId
      ? applyEventTreeOperation(tree, { kind: "SET_SEQUENCE_END_STATE", sequenceId, endState: definition.kind === "RELEASE" ? "RADIONUCLIDE_RELEASE" : "SUCCESSFUL_MITIGATION", endStateId })
      : tree)),
  };
  return withSyncedSequenceEndState(next, treeId, sequenceId);
}

function sequenceFindings(es: EventSequenceAnalysis): EsSequenceFinding[] {
  const trees = es.eventTrees ?? [];
  const definitions = es.endStateDefinitions ?? [];
  const endStateIds = new Set(definitions.map((definition) => definition.id));
  const codes = new Map(definitions.map((definition) => [definition.id, definition.code]));
  const findings: EsSequenceFinding[] = [];
  for (const tree of trees) {
    const bound = dependencyBoundFunctionalEvents(es, tree);
    for (const finding of validateEventTree(tree, trees, endStateIds)) {
      if (finding.code.startsWith("ET_FREQUENCY")) continue;
      if (finding.code === "ET_FT_LINK_REQUIRED" && finding.entityId !== undefined && bound.has(finding.entityId)) continue;
      findings.push({
        severity: finding.severity === "ERROR" ? "error" : "warning",
        check: "Event tree",
        item: tree.name,
        detail: finding.message,
        target: { kind: "tree", treeId: tree.uuid, ...(finding.entityId === undefined ? {} : { entityId: finding.entityId }) },
      });
    }
  }
  const names = new Map(trees.map((tree) => [tree.uuid, tree.name]));
  for (const treeId of transferLoops(es)) {
    findings.push({ severity: "error", check: "Transfers", item: names.get(treeId) ?? treeId, detail: "Its transfers lead back to this tree.", target: { kind: "tree", treeId } });
  }
  for (const definition of definitions) {
    if (definition.kind === "RELEASE" && definition.releaseCategoryId === undefined) {
      findings.push({ severity: "error", check: "End states", item: definition.code, detail: "A release end state needs a release category.", target: { kind: "endState", id: definition.id } });
    }
  }
  const categories = releaseCategoryRows(es);
  const firstWith = new Map<string, string>();
  for (const category of categories) {
    if (category.physicalReleaseCharacteristics.length === 0) {
      findings.push({ severity: "warning", check: "Release categories", item: category.id, detail: "No physical characteristics recorded (ES-C2).", target: { kind: "category", id: category.id } });
      continue;
    }
    const key = [...category.physicalReleaseCharacteristics].map((entry) => entry.toLowerCase()).sort().join("\n");
    const first = firstWith.get(key);
    if (first === undefined) firstWith.set(key, category.id);
    else findings.push({ severity: "warning", check: "Release categories", item: category.id, detail: `Same physical characteristics as ${first}.`, target: { kind: "category", id: category.id } });
  }
  const missing = new Map<string, number>();
  for (const row of unfamiliedSequences(es)) missing.set(row.treeId, (missing.get(row.treeId) ?? 0) + 1);
  for (const [treeId, count] of missing) {
    findings.push({ severity: "warning", check: "Families", item: names.get(treeId) ?? treeId, detail: `${counted(count, "sequence has", "sequences have")} no family.`, target: { kind: "tree", treeId } });
  }
  for (const family of familyRows(es)) {
    if (family.endStateIds.length > 1 && family.similarityBasis.trim().length === 0) {
      findings.push({ severity: "warning", check: "Families", item: family.name, detail: `Mixes ${family.endStateIds.map((id) => codes.get(id) ?? id).join(", ")} with no grouping basis (ES-C8).`, target: { kind: "family", id: family.id } });
    }
  }
  return [...findings.filter((finding) => finding.severity === "error"), ...findings.filter((finding) => finding.severity === "warning")];
}

function SequencesTable(): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const fieldId = useId();
  const rows = useMemo(() => treeSequenceRows(es), [es]);
  const trees = es.eventTrees ?? [];
  const definitions = es.endStateDefinitions ?? [];
  const endStates = new Map(definitions.map((definition) => [definition.id, definition]));
  const families = new Map(es.eventSequenceFamilies.map((family) => [family.uuid, family]));
  const treeNames = new Map(trees.map((tree) => [tree.uuid, tree.name]));
  const [treeFilter, setTreeFilter] = useState("");
  const [endStateFilter, setEndStateFilter] = useState("");
  const [familyFilter, setFamilyFilter] = useState("");
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const keyOf = (row: TreeSequenceRow): string => `${row.treeId}|${row.sequenceId}`;

  function matches(row: TreeSequenceRow): boolean {
    if (treeFilter.length > 0 && row.treeId !== treeFilter) return false;
    if (endStateFilter === NONE && (row.endStateId !== undefined || row.transferTargetId !== undefined)) return false;
    if (endStateFilter === TRANSFER && row.transferTargetId === undefined) return false;
    if (endStateFilter.length > 0 && endStateFilter !== NONE && endStateFilter !== TRANSFER && row.endStateId !== endStateFilter) return false;
    if (familyFilter === NONE) return row.familyId === undefined;
    return familyFilter.length === 0 || row.familyId === familyFilter;
  }

  const found = rows.filter(matches);
  const { current, shown } = pageOf(found, page, SEQUENCE_PAGE);
  const selected = found.filter((row) => picked.has(keyOf(row)));
  const allShown = shown.length > 0 && shown.every((row) => picked.has(keyOf(row)));

  function filterBy(set: (value: string) => void, value: string): void {
    set(value);
    setPage(0);
  }

  function toggle(row: TreeSequenceRow): void {
    setPicked((before) => {
      const next = new Set(before);
      if (next.has(keyOf(row))) next.delete(keyOf(row));
      else next.add(keyOf(row));
      return next;
    });
  }

  function toggleShown(): void {
    setPicked((before) => {
      const next = new Set(before);
      for (const row of shown) {
        if (allShown) next.delete(keyOf(row));
        else next.add(keyOf(row));
      }
      return next;
    });
  }

  function setEndState(endStateId: string): void {
    if (!editable || endStateId.length === 0 || selected.length === 0) return;
    mutateEs((draft) => selected.reduce((next, row) => withTreeSequenceEndState(next, row.treeId, row.sequenceId, endStateId), draft));
  }

  function setFamily(familyId: string): void {
    if (!editable || familyId.length === 0 || selected.length === 0) return;
    mutateEs((draft) => selected.reduce((next, row) => withTreeSequenceClassification(next, row.treeId, row.sequenceId, { sequenceFamilyId: familyId === NONE ? undefined : familyId }), draft));
  }

  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Tree</label>
            <select id={`${fieldId}-tree`} className="posfield__select" value={treeFilter} onChange={(event) => filterBy(setTreeFilter, event.target.value)}>
              <option value="">All trees</option>
              {trees.map((tree) => <option key={tree.uuid} value={tree.uuid}>{tree.name}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-end-state`}>End state</label>
            <select id={`${fieldId}-end-state`} className="posfield__select" value={endStateFilter} onChange={(event) => filterBy(setEndStateFilter, event.target.value)}>
              <option value="">All end states</option>
              <option value={NONE}>Not assigned</option>
              <option value={TRANSFER}>Transfer</option>
              {definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.code} · {definition.name}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-family`}>Family</label>
            <select id={`${fieldId}-family`} className="posfield__select" value={familyFilter} onChange={(event) => filterBy(setFamilyFilter, event.target.value)}>
              <option value="">All families</option>
              <option value={NONE}>No family</option>
              {es.eventSequenceFamilies.map((family) => <option key={family.uuid} value={family.uuid}>{family.name}</option>)}
            </select>
          </div>
        </div>
        <Pager current={current} size={SEQUENCE_PAGE} total={found.length} one="sequence" many="sequences" onPage={setPage} />
      </div>
      {editable && selected.length > 0 && (
        <div className="es-records__bulk">
          <span className="es-records__count">{counted(selected.length, "sequence", "sequences")} selected</span>
          <select className="posfield__select" aria-label="Set end state" value="" onChange={(event) => setEndState(event.target.value)}>
            <option value="">Set end state</option>
            {definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.code} · {definition.name}</option>)}
          </select>
          <select className="posfield__select" aria-label="Set family" value="" onChange={(event) => setFamily(event.target.value)}>
            <option value="">Set family</option>
            <option value={NONE}>No family</option>
            {es.eventSequenceFamilies.map((family) => <option key={family.uuid} value={family.uuid}>{family.name}</option>)}
          </select>
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setPicked(new Set())}>Clear selection</button>
        </div>
      )}
      {found.length === 0 ? <p className="posmuted es-records__empty">{rows.length === 0 ? "No sequences yet." : "No sequence matches these filters."}</p> : (
        <table className="postable postable--mid es-records" aria-label="Sequences">
          <thead>
            <tr>
              {editable && <th scope="col" className="es-records__pick"><input type="checkbox" aria-label="Select the sequences on this page" checked={allShown} onChange={toggleShown} /></th>}
              <th scope="col">Sequence</th>
              <th scope="col">End state</th>
              <th scope="col">Family</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const endState = row.endStateId === undefined ? undefined : endStates.get(row.endStateId);
              const family = row.familyId === undefined ? undefined : families.get(row.familyId);
              return (
                <tr key={keyOf(row)}>
                  {editable && <td className="es-records__pick"><input type="checkbox" aria-label={`Select ${row.name}`} checked={picked.has(keyOf(row))} onChange={() => toggle(row)} /></td>}
                  <td><span className="postable__name">{row.name}</span><span className="postable__name-sub">{row.treeName}</span></td>
                  <td>
                    {row.transferTargetId !== undefined
                      ? `Transfer to ${treeNames.get(row.transferTargetId) ?? row.transferTargetId}`
                      : endState === undefined ? <span className="posmuted">Not assigned</span> : `${endState.code} · ${endState.name}`}
                  </td>
                  <td>{family === undefined ? <span className="posmuted">None</span> : family.name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function EndStatesTable({ onAdd, onEdit }: { onAdd: () => void; onEdit: (endStateId: string) => void }): JSX.Element {
  const { es, editable } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const definitions = es.endStateDefinitions ?? [];
  const categoryNames = new Map(releaseCategoryRows(es).map((row) => [row.id, row.name]));
  const { current, shown } = pageOf(definitions, page, TABLE_PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager current={current} size={TABLE_PAGE} total={definitions.length} one="end state" many="end states" onPage={setPage} />
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onAdd}>Add end state</button>}
      </div>
      {definitions.length === 0 ? <p className="posmuted es-records__empty">No end states yet.</p> : (
        <table className="postable postable--mid es-records" aria-label="End states">
          <thead><tr><th scope="col">End state</th><th scope="col">Kind</th><th scope="col">Release category</th><th scope="col">Paths</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((definition) => {
              const categoryName = definition.releaseCategoryId === undefined ? undefined : categoryNames.get(definition.releaseCategoryId);
              return (
                <tr key={definition.id}>
                  <td><span className="postable__name posmono">{definition.code}</span><span className="postable__name-sub">{definition.name}</span></td>
                  <td>{END_STATE_KINDS.find((kind) => kind.id === definition.kind)?.label ?? definition.kind}</td>
                  <td>{definition.releaseCategoryId === undefined ? <span className="posmuted">None</span> : categoryName !== undefined && categoryName.length > 0 ? `${definition.releaseCategoryId} · ${categoryName}` : definition.releaseCategoryId}</td>
                  <td className="posmono">{endStateUseCount(es, definition.id)}</td>
                  <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${definition.code}`} onClick={() => onEdit(definition.id)}>{actionLabel}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function CategoriesTable({ onOpen }: { onOpen: (categoryId: string | undefined) => void }): JSX.Element {
  const { es, editable } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const rows = useMemo(() => releaseCategoryRows(es), [es]);
  const { current, shown } = pageOf(rows, page, TABLE_PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager current={current} size={TABLE_PAGE} total={rows.length} one="release category" many="release categories" onPage={setPage} />
        {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onOpen(undefined)}>Add release category</button>}
      </div>
      {rows.length === 0 ? <p className="posmuted es-records__empty">No release categories yet.</p> : (
        <table className="postable postable--mid es-records" aria-label="Release categories">
          <thead><tr><th scope="col">Release category</th><th scope="col">End states</th><th scope="col">Paths</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td><span className="postable__name posmono">{row.id}</span>{row.name.length > 0 && <span className="postable__name-sub">{row.name}</span>}</td>
                <td>{row.endStateCodes.length === 0 ? <span className="posmuted">None</span> : row.endStateCodes.join(", ")}</td>
                <td className="posmono">{row.sequenceCount}</td>
                <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${row.id}`} onClick={() => onOpen(row.id)}>{actionLabel}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function FamiliesTable({ onOpen }: { onOpen: (familyId: string | undefined) => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const rows = useMemo(() => familyRows(es), [es]);
  const ungrouped = useMemo(() => unfamiliedSequences(es).length, [es]);
  const codes = new Map((es.endStateDefinitions ?? []).map((definition) => [definition.id, definition.code]));
  const { current, shown } = pageOf(rows, page, TABLE_PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager current={current} size={TABLE_PAGE} total={rows.length} one="family" many="families" onPage={setPage} />
        {editable && (
          <div className="es-records__actions">
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={ungrouped === 0} onClick={() => mutateEs(withFamiliesByDefinition)}>Group {counted(ungrouped, "sequence", "sequences")}</button>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onOpen(undefined)}>Add family</button>
          </div>
        )}
      </div>
      {rows.length === 0 ? <p className="posmuted es-records__empty">No families yet.</p> : (
        <table className="postable postable--mid es-records" aria-label="Families">
          <thead><tr><th scope="col">Family</th><th scope="col">End states</th><th scope="col">Sequences</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={row.id}>
                <td><span className="postable__name">{row.name}</span></td>
                <td>{row.endStateIds.length === 0 ? <span className="posmuted">None</span> : row.endStateIds.map((id) => codes.get(id) ?? id).join(", ")}</td>
                <td className="posmono">{row.memberCount}</td>
                <td className="es-records__act"><button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} ${row.name}`} onClick={() => onOpen(row.id)}>{actionLabel}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function TransfersTable({ onEdit }: { onEdit: (treeId: string, sequenceId: string) => void }): JSX.Element {
  const { es, editable } = useEsWorkbook();
  const [page, setPage] = useState(0);
  const rows = useMemo(() => transferRows(es), [es]);
  const { current, shown } = pageOf(rows, page, TABLE_PAGE);
  const actionLabel = editable ? "Edit" : "View";
  return (
    <>
      <div className="es-records__bar">
        <Pager current={current} size={TABLE_PAGE} total={rows.length} one="transfer" many="transfers" onPage={setPage} />
      </div>
      {rows.length > 0 && (
        <table className="postable postable--mid es-records" aria-label="Transfers">
          <thead><tr><th scope="col">From</th><th scope="col">To</th><th scope="col" className="es-records__act" aria-label="Actions" /></tr></thead>
          <tbody>
            {shown.map((row) => (
              <tr key={`${row.treeId}|${row.sequenceId}`}>
                <td><span className="postable__name">{row.sequenceName}</span><span className="postable__name-sub">{row.treeName}</span></td>
                <td>{row.targetName}</td>
                <td className="es-records__act">
                  <button type="button" className="posnav__btn posnav__btn--sm" aria-label={`${actionLabel} the transfer of ${row.sequenceName}`} onClick={() => onEdit(row.treeId, row.sequenceId)}>{actionLabel}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function ChecksTable({ findings, onOpen }: { findings: readonly EsSequenceFinding[]; onOpen: (target: EsCheckTarget) => void }): JSX.Element {
  const [page, setPage] = useState(0);
  const { current, shown } = pageOf(findings, page, SEQUENCE_PAGE);
  return (
    <>
      <div className="es-records__bar">
        <Pager current={current} size={SEQUENCE_PAGE} total={findings.length} one="finding" many="findings" onPage={setPage} />
      </div>
      {findings.length > 0 && (
      <table className="postable postable--mid es-records" aria-label="Checks">
        <thead><tr><th scope="col">Severity</th><th scope="col">Check</th><th scope="col">Item</th><th scope="col">Detail</th></tr></thead>
        <tbody>
          {shown.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${String(current * SEQUENCE_PAGE + index)}`}>
                <td className={`es-severity es-severity--${finding.severity}`}>{finding.severity === "error" ? "Error" : "Warning"}</td>
                <td>{finding.check}</td>
                <td>{target === undefined ? finding.item : <button type="button" className="es-records__link" onClick={() => onOpen(target)}>{finding.item}</button>}</td>
                <td>{finding.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}
    </>
  );
}

function ReleaseCategoryDialog({ categoryId, onClose }: { categoryId: string | undefined; onClose: () => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const fieldId = useId();
  const rows = releaseCategoryRows(es);
  const existing = rows.find((row) => row.id === categoryId);
  const [id, setId] = useState(existing?.id ?? nextReleaseCategoryId(rows.map((row) => row.id)));
  const [name, setName] = useState(existing?.name ?? "");
  const [physical, setPhysical] = useState((existing?.physicalReleaseCharacteristics ?? []).join("\n"));
  const [common, setCommon] = useState((existing?.commonCharacteristics ?? []).join("\n"));
  const [basis, setBasis] = useState(existing?.mappingBasis ?? "");
  const [mergeInto, setMergeInto] = useState("");
  const code = id.trim();
  const taken = rows.some((row) => row.id === code && row.id !== existing?.id);
  const inUse = existing !== undefined && releaseCategoryInUse(es, existing.id);
  const ready = code.length > 0 && !taken;
  const others = rows.filter((row) => row.id !== existing?.id);

  function save(): void {
    if (!editable || !ready) return;
    mutateEs((current) => withReleaseCategorySaved(current, existing?.id, {
      id: code,
      name: name.trim(),
      physicalReleaseCharacteristics: lines(physical),
      commonCharacteristics: lines(common),
      mappingBasis: basis.trim(),
    }));
    onClose();
  }

  function merge(): void {
    if (!editable || existing === undefined || mergeInto.length === 0) return;
    mutateEs((current) => withReleaseCategoryMerged(current, existing.id, mergeInto));
    onClose();
  }

  function remove(): void {
    if (!editable || existing === undefined || inUse) return;
    mutateEs((current) => withReleaseCategoryRemoved(current, existing.id));
    onClose();
  }

  return (
    <DialogShell label="Release category" onClose={onClose}>
      <DialogHead cap={existing === undefined ? "New release category · ES-C1 · ES-C2" : "Release category · ES-C1 · ES-C2"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-id`}>ID</label>
            <input id={`${fieldId}-id`} className="posfield__input posmono" value={id} disabled={!editable} onChange={(event) => setId(event.target.value)} />
          </div>
          <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-name`}>Name</label>
            <input id={`${fieldId}-name`} className="posfield__input" value={name} disabled={!editable} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-physical`}>Physical characteristics</label>
            <textarea id={`${fieldId}-physical`} className="posfield__textarea" rows={3} value={physical} disabled={!editable} onChange={(event) => setPhysical(event.target.value)} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-common`}>Sequence characteristics</label>
            <textarea id={`${fieldId}-common`} className="posfield__textarea" rows={3} value={common} disabled={!editable} onChange={(event) => setCommon(event.target.value)} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-basis`}>Basis</label>
            <textarea id={`${fieldId}-basis`} className="posfield__textarea" rows={2} value={basis} disabled={!editable} onChange={(event) => setBasis(event.target.value)} />
          </div>
          {editable && existing !== undefined && others.length > 0 && (
            <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-merge`}>Merge into</label>
              <div className="es-dialog-list__row">
                <select id={`${fieldId}-merge`} className="posfield__select" value={mergeInto} onChange={(event) => setMergeInto(event.target.value)}>
                  <option value="">Choose a category</option>
                  {others.map((row) => <option key={row.id} value={row.id}>{row.name.length > 0 ? `${row.id} · ${row.name}` : row.id}</option>)}
                </select>
                <button type="button" className="posnav__btn posnav__btn--sm" disabled={mergeInto.length === 0} onClick={merge}>Merge</button>
              </div>
            </div>
          )}
        </div>
        {taken && <p className="es-scope-error" role="alert">{code} is already used by another release category.</p>}
        {editable && (
          <div className="posrow es-dialog-actions">
            {existing !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" disabled={inUse} title={inUse ? "End states or sequences use this category" : undefined} onClick={remove}>Delete release category</button>}
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={save}>{existing === undefined ? "Add release category" : "Save"}</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function FamilyDialog({ familyId, groups, states, onClose }: { familyId: string | undefined; groups: readonly CoverageAxis[]; states: readonly CoverageAxis[]; onClose: () => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const fieldId = useId();
  const existing = es.eventSequenceFamilies.find((family) => family.uuid === familyId);
  const definitions = es.endStateDefinitions ?? [];
  const [draft, setDraft] = useState<EventSequenceFamily>(() => existing ?? {
    uuid: crypto.randomUUID(),
    name: "",
    groupingCriteriaId: es.groupingCriteria?.[0]?.uuid ?? "",
    representativeInitiatingEventId: groups[0]?.id ?? "",
    representativePlantOperatingStateId: states[0]?.id ?? "",
    representativePlantResponse: "",
    releaseCategoryIds: [],
    memberSequenceIds: [],
    endState: EndState.SUCCESSFUL_MITIGATION,
    implementsSrs: [],
  });
  const ready = draft.name.trim().length > 0;
  const groupOptions = draft.representativeInitiatingEventId.length === 0 || groups.some((group) => group.id === draft.representativeInitiatingEventId) ? groups : [{ id: draft.representativeInitiatingEventId, name: "" }, ...groups];
  const stateOptions = draft.representativePlantOperatingStateId.length === 0 || states.some((state) => state.id === draft.representativePlantOperatingStateId) ? states : [{ id: draft.representativePlantOperatingStateId, name: "" }, ...states];

  function patch(fields: Partial<EventSequenceFamily>): void {
    setDraft((current) => ({ ...current, ...fields }));
  }

  function setEndState(endStateId: string): void {
    const definition = definitions.find((candidate) => candidate.id === endStateId);
    setDraft((current) => {
      const { endStateId: _previous, ...rest } = current;
      if (definition === undefined) return rest;
      return { ...rest, endStateId: definition.id, endState: endStateOfKind(definition.kind), releaseCategoryIds: definition.releaseCategoryId === undefined ? [] : [definition.releaseCategoryId] };
    });
  }

  function save(): void {
    if (!editable || !ready) return;
    mutateEs((current) => withFamilySaved(current, { ...draft, name: draft.name.trim() }));
    onClose();
  }

  function remove(): void {
    if (!editable || existing === undefined) return;
    mutateEs((current) => withFamilyRemoved(current, existing.uuid));
    onClose();
  }

  return (
    <DialogShell label="Family" onClose={onClose}>
      <DialogHead cap={existing === undefined ? "New family · ES-C8 · ES-A12" : "Family · ES-C8 · ES-A12"} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-name`}>Name</label>
            <input id={`${fieldId}-name`} className="posfield__input" value={draft.name} disabled={!editable} onChange={(event) => patch({ name: event.target.value })} />
          </div>
          <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-group`}>Initiating event group</label>
            <select id={`${fieldId}-group`} className="posfield__select" value={draft.representativeInitiatingEventId} disabled={!editable} onChange={(event) => patch({ representativeInitiatingEventId: event.target.value })}>
              <option value="">None</option>
              {groupOptions.map((group) => <option key={group.id} value={group.id}>{group.name.length > 0 ? `${group.id} · ${group.name}` : group.id}</option>)}
            </select>
          </div>
          <div className="posfield"><label className="posfield__label" htmlFor={`${fieldId}-state`}>Operating state</label>
            <select id={`${fieldId}-state`} className="posfield__select" value={draft.representativePlantOperatingStateId} disabled={!editable} onChange={(event) => patch({ representativePlantOperatingStateId: event.target.value })}>
              <option value="">None</option>
              {stateOptions.map((state) => <option key={state.id} value={state.id}>{state.name.length > 0 ? `${state.id} · ${state.name}` : state.id}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-end-state`}>End state</label>
            <select id={`${fieldId}-end-state`} className="posfield__select" value={draft.endStateId ?? ""} disabled={!editable} onChange={(event) => setEndState(event.target.value)}>
              <option value="">None</option>
              {definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.code} · {definition.name}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-description`}>Description</label>
            <textarea id={`${fieldId}-description`} className="posfield__textarea" rows={2} value={draft.description ?? ""} disabled={!editable} onChange={(event) => patch({ description: event.target.value })} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-response`}>Plant response</label>
            <textarea id={`${fieldId}-response`} className="posfield__textarea" rows={3} value={draft.representativePlantResponse} disabled={!editable} onChange={(event) => patch({ representativePlantResponse: event.target.value })} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-basis`}>Grouping basis</label>
            <textarea id={`${fieldId}-basis`} className="posfield__textarea" rows={2} value={draft.similarityBasis ?? ""} disabled={!editable} onChange={(event) => patch({ similarityBasis: event.target.value })} />
          </div>
        </div>
        {editable && (
          <div className="posrow es-dialog-actions">
            {existing !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Delete family</button>}
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={save}>{existing === undefined ? "Add family" : "Save"}</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function TransferDialog({ treeId, sequenceId, onClose }: { treeId: string; sequenceId: string; onClose: () => void }): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const fieldId = useId();
  const trees = es.eventTrees ?? [];
  const tree = trees.find((candidate) => candidate.uuid === treeId);
  const transfer = tree?.transfers?.[sequenceId];
  const [target, setTarget] = useState(transfer?.targetEventTreeId ?? "");
  const [conditions, setConditions] = useState((transfer?.transferConditions ?? []).join("\n"));
  const [preserved, setPreserved] = useState((transfer?.preservedDependencies ?? []).join("\n"));
  const targets = trees.filter((candidate) => candidate.uuid !== treeId);

  function save(): void {
    if (!editable || target.length === 0) return;
    const conditionLines = lines(conditions);
    const preservedLines = lines(preserved);
    const next: EventTreeTransfer = {
      targetEventTreeId: target,
      ...(conditionLines.length === 0 ? {} : { transferConditions: conditionLines }),
      ...(preservedLines.length === 0 ? {} : { preservedDependencies: preservedLines }),
    };
    mutateEs((current) => withTransferEdited(current, treeId, sequenceId, next));
    onClose();
  }

  function remove(): void {
    if (!editable) return;
    mutateEs((current) => ({
      ...current,
      eventTrees: (current.eventTrees ?? []).map((candidate) => (candidate.uuid === treeId ? applyEventTreeOperation(candidate, { kind: "SET_SEQUENCE_TRANSFER", sequenceId, targetEventTreeId: null }) : candidate)),
    }));
    onClose();
  }

  return (
    <DialogShell label="Transfer" onClose={onClose}>
      <DialogHead cap="Transfer · ES-A13" title={tree?.sequences[sequenceId]?.name ?? sequenceId} onClose={onClose} />
      <div className="modal__body">
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-target`}>Target tree</label>
            <select id={`${fieldId}-target`} className="posfield__select" value={target} disabled={!editable} onChange={(event) => setTarget(event.target.value)}>
              {targets.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{candidate.name}</option>)}
            </select>
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-conditions`}>Transfer conditions</label>
            <textarea id={`${fieldId}-conditions`} className="posfield__textarea" rows={3} value={conditions} disabled={!editable} onChange={(event) => setConditions(event.target.value)} />
          </div>
          <div className="posfield posfield-grid--span2"><label className="posfield__label" htmlFor={`${fieldId}-preserved`}>Dependencies carried over</label>
            <textarea id={`${fieldId}-preserved`} className="posfield__textarea" rows={3} value={preserved} disabled={!editable} onChange={(event) => setPreserved(event.target.value)} />
          </div>
        </div>
        {editable && (
          <div className="posrow es-dialog-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={remove}>Remove transfer</button>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={target.length === 0} onClick={save}>Save</button>
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function SequenceRecordTabs({ tab, findings, groups, states, onOpenPath, onAddEndState, onEditEndState }: {
  tab: RecordTab;
  findings: readonly EsSequenceFinding[];
  groups: readonly CoverageAxis[];
  states: readonly CoverageAxis[];
  onOpenPath: (treeId: string, selection: string | null) => void;
  onAddEndState: () => void;
  onEditEndState: (endStateId: string) => void;
}): JSX.Element {
  const [categoryDialog, setCategoryDialog] = useState<{ id: string | undefined } | null>(null);
  const [familyDialog, setFamilyDialog] = useState<{ id: string | undefined } | null>(null);
  const [transferDialog, setTransferDialog] = useState<{ treeId: string; sequenceId: string } | null>(null);

  function openTarget(target: EsCheckTarget): void {
    if (target.kind === "tree") onOpenPath(target.treeId, target.entityId ?? null);
    else if (target.kind === "endState") onEditEndState(target.id);
    else if (target.kind === "category") setCategoryDialog({ id: target.id });
    else setFamilyDialog({ id: target.id });
  }

  return (
    <>
      {tab === "sequences" && <SequencesTable />}
      {tab === "endstates" && <EndStatesTable onAdd={onAddEndState} onEdit={onEditEndState} />}
      {tab === "categories" && <CategoriesTable onOpen={(id) => setCategoryDialog({ id })} />}
      {tab === "families" && <FamiliesTable onOpen={(id) => setFamilyDialog({ id })} />}
      {tab === "transfers" && <TransfersTable onEdit={(treeId, sequenceId) => setTransferDialog({ treeId, sequenceId })} />}
      {tab === "checks" && <ChecksTable findings={findings} onOpen={openTarget} />}
      {categoryDialog !== null && <ReleaseCategoryDialog categoryId={categoryDialog.id} onClose={() => setCategoryDialog(null)} />}
      {familyDialog !== null && <FamilyDialog familyId={familyDialog.id} groups={groups} states={states} onClose={() => setFamilyDialog(null)} />}
      {transferDialog !== null && <TransferDialog treeId={transferDialog.treeId} sequenceId={transferDialog.sequenceId} onClose={() => setTransferDialog(null)} />}
    </>
  );
}

export {
  SequenceRecordTabs,
  sequenceFindings,
  BARRIER_CONDITIONS,
  END_STATE_KINDS,
  type RecordTab,
  type EsSequenceFinding,
};
