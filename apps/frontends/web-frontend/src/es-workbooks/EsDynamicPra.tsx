import { JSX, useId, useMemo, useState } from "react";
import type { DynamicRun, EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { readableId } from "../workbooks/workbookHandoff";
import { DynamicEventSequenceDiagram, createEventTreePresentation } from "../newly-developed-methods/event-tree";
import { PAGE, Pager, TabBar, paged } from "./EsTiming";
import { useEsWorkbook } from "./esWorkbookContext";
import "./css/esDynamicPra.css";

type DynamicTab = "runs" | "branches" | "comparison" | "checks";

interface DynamicLeaf {
  id: string;
  condition: string;
  outcome: string;
  sequenceId?: string;
  probability?: number;
  timing?: string;
}

interface DynamicFinding {
  check: string;
  item: string;
  detail: string;
}

const DYNAMIC_TABS: { id: DynamicTab; label: string }[] = [
  { id: "runs", label: "Runs" },
  { id: "branches", label: "Branches" },
  { id: "comparison", label: "Comparison" },
  { id: "checks", label: "Checks" },
];

function percentText(probability: number | undefined): string {
  return probability === undefined ? "Not computed" : `${(probability * 100).toFixed(1)}%`;
}

function dynamicLeaves(run: DynamicRun): DynamicLeaf[] {
  const leaves: DynamicLeaf[] = [];
  const walk = (nodeId: string, reached: number | undefined, path: ReadonlySet<string>): void => {
    const node = run.esdNodes[nodeId];
    if (node === undefined || path.has(nodeId)) return;
    const next = new Set([...path, nodeId]);
    node.branches.forEach((branch, index) => {
      const probability = reached === undefined || branch.probability === undefined ? undefined : reached * branch.probability;
      if (branch.targetNodeId !== undefined && run.esdNodes[branch.targetNodeId] !== undefined) {
        walk(branch.targetNodeId, probability, next);
        return;
      }
      leaves.push({
        id: `${nodeId}-${String(index)}`,
        condition: node.condition,
        outcome: branch.outcome,
        ...(branch.sequenceId === undefined ? {} : { sequenceId: branch.sequenceId }),
        ...(probability === undefined ? {} : { probability }),
        ...(branch.timing === undefined || branch.timing.length === 0 ? {} : { timing: branch.timing }),
      });
    });
  };
  walk(run.rootNodeId, 1, new Set());
  return leaves;
}

function dynamicFindings(es: EventSequenceAnalysis): DynamicFinding[] {
  const findings: DynamicFinding[] = [];
  const trees = es.eventTrees ?? [];
  const sequenceIds = new Set(es.eventSequences.map((sequence) => sequence.uuid));
  for (const run of es.dynamicRuns ?? []) {
    const tree = trees.find((candidate) => candidate.uuid === run.eventTreeId);
    const runLabel = `${run.initiatingEventId} in ${run.plantOperatingStateId}`;
    if (tree === undefined) {
      findings.push({ check: "Run with no event tree", item: runLabel, detail: "The run names no event tree of this workbook, so its branches cannot be compared." });
      continue;
    }
    const leaves = dynamicLeaves(run);
    for (const leaf of leaves) {
      if (leaf.sequenceId === undefined || !sequenceIds.has(leaf.sequenceId)) {
        findings.push({ check: "Dynamic branch with no static match", item: leaf.condition, detail: `The ${leaf.outcome} branch reaches no sequence of ${tree.name}.` });
      }
    }
    const reached = new Set(leaves.flatMap((leaf) => (leaf.sequenceId === undefined ? [] : [leaf.sequenceId])));
    for (const sequence of es.eventSequences.filter((candidate) => candidate.eventTreeId === tree.uuid && !reached.has(candidate.uuid))) {
      findings.push({ check: "Static sequence no dynamic branch reaches", item: sequence.name, detail: `No branch of the ${tree.name} run ends in it.` });
    }
    for (const node of Object.values(run.esdNodes)) {
      const probabilities = node.branches.map((branch) => branch.probability);
      if (probabilities.length === 0 || probabilities.some((probability) => probability === undefined)) continue;
      const sum = probabilities.reduce<number>((total, probability) => total + (probability ?? 0), 0);
      if (Math.abs(sum - 1) > 0.001) findings.push({ check: "Branch probabilities do not sum to 1", item: node.condition, detail: `They sum to ${sum.toFixed(3)}.` });
    }
  }
  return findings;
}

function RunsTable({ start }: { start: number }): JSX.Element | null {
  const { es } = useEsWorkbook();
  const runs = es.dynamicRuns ?? [];
  const trees = es.eventTrees ?? [];
  if (runs.length === 0) return null;
  return (
    <div className="es-dynamic__table">
      <table className="postable es-records" aria-label="Dynamic PRA runs">
        <thead>
          <tr><th scope="col">Event tree</th><th scope="col">Initiator group</th><th scope="col">Operating state</th><th scope="col">Trials</th><th scope="col">Run date</th><th scope="col">Branches</th></tr>
        </thead>
        <tbody>
          {runs.slice(start, start + PAGE).map((run) => (
            <tr key={run.uuid}>
              <td><span className="postable__name">{trees.find((tree) => tree.uuid === run.eventTreeId)?.name ?? "None"}</span></td>
              <td>{run.initiatingEventId}</td>
              <td>{run.plantOperatingStateId}</td>
              <td className="es-dynamic__num">{run.trials === undefined ? "None" : run.trials}</td>
              <td>{run.runDate === undefined || run.runDate.length === 0 ? "None" : run.runDate}</td>
              <td className="es-dynamic__num">{Object.values(run.esdNodes).reduce((total, node) => total + node.branches.length, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EsDynamicPraScreen({ treeId }: { treeId: string }): JSX.Element {
  const { es } = useEsWorkbook();
  const [tab, setTab] = useState<DynamicTab>("runs");
  const [page, setPage] = useState(0);
  const fieldId = useId();
  const trees = es.eventTrees ?? [];
  const tree = trees.find((candidate) => candidate.uuid === treeId) ?? trees[0];
  const run = tree === undefined ? undefined : (es.dynamicRuns ?? []).find((candidate) => candidate.eventTreeId === tree.uuid);
  const sequences = useMemo(() => (tree === undefined || run === undefined ? undefined : new Map(createEventTreePresentation(tree, es.eventSequences).sequences.map((sequence) => [sequence.id, sequence]))), [tree, run, es.eventSequences]);
  const sequenceName = new Map(es.eventSequences.map((sequence) => [sequence.uuid, sequence.name]));
  const findings = useMemo(() => dynamicFindings(es), [es]);
  const branches = run === undefined ? [] : Object.values(run.esdNodes).flatMap((node) => node.branches.map((branch, index) => ({ id: `${node.id}-${String(index)}`, node, branch })));
  const leaves = run === undefined ? [] : dynamicLeaves(run);
  const treeSequences = tree === undefined ? [] : es.eventSequences.filter((sequence) => sequence.eventTreeId === tree.uuid);
  const comparison = run === undefined ? [] : [
    ...treeSequences.map((sequence) => {
      const landing = leaves.filter((leaf) => leaf.sequenceId === sequence.uuid);
      const known = landing.every((leaf) => leaf.probability !== undefined);
      return {
        id: sequence.uuid,
        sequence: sequence.name,
        count: landing.length,
        probability: landing.length === 0 || !known ? undefined : landing.reduce((total, leaf) => total + (leaf.probability ?? 0), 0),
        timing: [...new Set(landing.flatMap((leaf) => (leaf.timing === undefined ? [] : [leaf.timing])))].join(", "),
      };
    }),
    ...leaves.filter((leaf) => leaf.sequenceId === undefined || !sequenceName.has(leaf.sequenceId)).map((leaf) => ({
      id: `unmatched-${leaf.id}`,
      sequence: "No static match",
      count: 1,
      probability: leaf.probability,
      timing: leaf.timing ?? "",
    })),
  ];
  const total = tab === "runs" ? (es.dynamicRuns ?? []).length : tab === "branches" ? branches.length : tab === "comparison" ? comparison.length : findings.length;
  const rows = paged(total, page);
  const noun = tab === "runs" ? ["run", "runs"] : tab === "branches" ? ["branch", "branches"] : tab === "comparison" ? ["sequence", "sequences"] : ["finding", "findings"];

  function leadsTo(sequenceId: string | undefined, targetNodeId: string | undefined): string {
    if (sequenceId !== undefined) return sequenceName.get(sequenceId) ?? readableId(sequenceId) ?? "Unresolved sequence";
    if (targetNodeId !== undefined) return run?.esdNodes[targetNodeId]?.condition ?? "Unresolved condition";
    return "None";
  }

  return (
    <div className="poscard es-seq-card es-dynamic" aria-disabled="true">
      <TabBar tabs={DYNAMIC_TABS} tab={tab} label="Dynamic PRA sections" findings={findings.length} onTab={(next) => { setTab(next); setPage(0); }} />
      <div role="tabpanel" aria-label={DYNAMIC_TABS.find((item) => item.id === tab)?.label} className="es-seq-card__panel">
        <div className="es-records__bar">
          <div className="es-records__filters">
            {(tab === "branches" || tab === "comparison") && trees.length > 0 && (
              <div className="es-records__filter">
                <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
                <select id={`${fieldId}-tree`} className="posfield__select es-dynamic__tree" value={tree?.uuid ?? ""} disabled>
                  {trees.map((candidate) => <option key={candidate.uuid} value={candidate.uuid}>{candidate.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="es-records__actions">
            <Pager rows={rows} noun={noun[0] ?? ""} plural={noun[1]} onPage={setPage} />
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled>Run</button>
          </div>
        </div>
        {tab === "runs" && <RunsTable start={rows.start} />}
        {tab === "branches" && (
          <>
            {run !== undefined && sequences !== undefined && (
              <div className="es-dynamic__diagram">
                <DynamicEventSequenceDiagram run={run} sequences={sequences} activeSequenceId={null} onHover={() => undefined} onSelect={() => undefined} />
              </div>
            )}
            {branches.length > 0 && (
              <div className="es-dynamic__table">
                <table className="postable es-records" aria-label="Dynamic PRA branches">
                  <thead>
                    <tr><th scope="col">Condition</th><th scope="col">Function</th><th scope="col">Outcome</th><th scope="col">Probability</th><th scope="col">Timing</th><th scope="col">Leads to</th></tr>
                  </thead>
                  <tbody>
                    {branches.slice(rows.start, rows.start + PAGE).map((row) => (
                      <tr key={row.id}>
                        <td><span className="postable__name">{row.node.condition}</span></td>
                        <td>{row.node.challengedFunctionId ?? "None"}</td>
                        <td>{row.branch.outcome}</td>
                        <td className="es-dynamic__num">{row.branch.probability === undefined ? "None" : percentText(row.branch.probability)}</td>
                        <td>{row.branch.timing === undefined || row.branch.timing.length === 0 ? "None" : row.branch.timing}</td>
                        <td>{leadsTo(row.branch.sequenceId, row.branch.targetNodeId)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        {tab === "comparison" && comparison.length > 0 && (
          <div className="es-dynamic__table">
            <table className="postable es-records" aria-label="Dynamic and static comparison">
              <thead>
                <tr><th scope="col">Static sequence</th><th scope="col">Dynamic branches</th><th scope="col">Probability</th><th scope="col">Timing</th></tr>
              </thead>
              <tbody>
                {comparison.slice(rows.start, rows.start + PAGE).map((row) => (
                  <tr key={row.id}>
                    <td><span className="postable__name">{row.sequence}</span></td>
                    <td className="es-dynamic__num">{row.count}</td>
                    <td className="es-dynamic__num">{row.count === 0 ? "None" : percentText(row.probability)}</td>
                    <td>{row.timing.length === 0 ? "None" : row.timing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "checks" && findings.length > 0 && (
          <div className="es-dynamic__table">
            <table className="postable es-records" aria-label="Checks">
              <thead><tr><th scope="col">Severity</th><th scope="col">Check</th><th scope="col">Item</th><th scope="col">Detail</th></tr></thead>
              <tbody>
                {findings.slice(rows.start, rows.start + PAGE).map((finding, index) => (
                  <tr key={`${finding.check}:${finding.item}:${String(rows.start + index)}`}>
                    <td className="es-severity es-severity--warning">Warning</td>
                    <td>{finding.check}</td>
                    <td>{finding.item}</td>
                    <td>{finding.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export { EsDynamicPraScreen };
