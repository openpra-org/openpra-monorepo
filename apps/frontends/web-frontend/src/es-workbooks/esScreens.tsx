import { JSX, useMemo, useState } from "react";
import {
  type EventSequenceAnalysis,
  type EventTree,
  type EventSequence,
  type EventSequenceFamily,
  type EventSequenceScreeningRecord,
  EndState,
  DependencyType,
} from "interfaces-mef-types/es/event-sequence-analysis";
import { type Frequency, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { ESIcon } from "./esIcons";
import { Badge } from "./esShared";
import { useEsWorkbook } from "./esWorkbookContext";
import { CAPABILITY_CATEGORIES, type CapabilityCategory, type Stage } from "./esViewData";
import { type CcScore } from "./esSelectors";

function freqValue(f: Frequency | FrequencyWithDistribution): number {
  return typeof f === "number" ? f : (f as FrequencyWithDistribution).value;
}

function fmtFreq(f: Frequency | FrequencyWithDistribution | undefined): string {
  if (f === undefined) return "—";
  const v = freqValue(f);
  if (!isFinite(v) || v <= 0) return "—";
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / Math.pow(10, exp);
  const sign = exp < 0 ? "-" : "+";
  return `${mantissa.toFixed(1)}E${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
}

function endStateTone(e: EndState): "ok" | "block" {
  return e === EndState.SUCCESSFUL_MITIGATION ? "ok" : "block";
}

function endStateLabel(e: EndState): string {
  return e === EndState.SUCCESSFUL_MITIGATION ? "Safe state" : "Release";
}

// ─── Event-tree layout engine (ported from reference es-screens.jsx) ─────────
interface TreeNode {
  seq?: string;
  S?: TreeNode;
  F?: TreeNode;
  fe?: number;
  _y?: number;
}

interface LayoutResult {
  segs: { x1: number; y1: number; x2: number; y2: number; seqs: string[] }[];
  dots: { x: number; y: number }[];
  branchLabs: { x: number; y: number; key: string; seqs: string[] }[];
  leaves: { seq: string; y: number }[];
  xCol: (c: number) => number;
  xEnd: number;
  numCols: number;
  COL_W: number;
  LEFT: number;
  TOP: number;
  rootY: number;
  width: number;
  height: number;
}

function buildTreeNode(tree: EventTree): TreeNode | null {
  const branches = tree.branches;
  const initialBranchId = tree.initialState.branchId;
  const feKeys = Object.keys(tree.functionalEvents);

  function buildNode(branchId: string): TreeNode {
    const branch = branches[branchId];
    if (!branch) return {};
    const feIndex = feKeys.indexOf(branch.functionalEventId ?? "");
    const successPath = branch.paths.find((p) => p.state === "SUCCESS");
    const failurePath = branch.paths.find((p) => p.state === "FAILURE");

    const successChild = successPath !== undefined
      ? (successPath.targetType === "SEQUENCE" ? { seq: successPath.target } : buildNode(successPath.target))
      : {};
    const failureChild = failurePath !== undefined
      ? (failurePath.targetType === "SEQUENCE" ? { seq: failurePath.target } : buildNode(failurePath.target))
      : {};

    return { fe: feIndex, S: successChild, F: failureChild };
  }

  return buildNode(initialBranchId);
}

function collectSeqs(node: TreeNode): string[] {
  if (node.seq !== undefined) return [node.seq];
  return [...collectSeqs(node.S ?? {}), ...collectSeqs(node.F ?? {})];
}

function layoutTree(tree: EventTree): LayoutResult {
  const COL_W = 152, ROW_H = 58, LEFT = 112, TOP = 98, PANEL = 224, PAD_R = 18;
  const numCols = Object.keys(tree.functionalEvents).length;
  const xCol = (c: number): number => LEFT + c * COL_W;
  const xEnd = LEFT + numCols * COL_W;

  const root = buildTreeNode(tree);
  if (!root) {
    return { segs: [], dots: [], branchLabs: [], leaves: [], xCol, xEnd, numCols, COL_W, LEFT, TOP, rootY: TOP, width: xEnd + PANEL + PAD_R, height: TOP + ROW_H };
  }

  const leaves: { seq: string; y: number }[] = [];
  let row = 0;

  function assign(node: TreeNode): void {
    if (node.seq !== undefined) {
      node._y = TOP + (row + 0.5) * ROW_H;
      row++;
      leaves.push({ seq: node.seq, y: node._y });
      return;
    }
    if (node.S) assign(node.S);
    if (node.F) assign(node.F);
    node._y = ((node.S?._y ?? 0) + (node.F?._y ?? 0)) / 2;
  }
  assign(root);

  const segs: LayoutResult["segs"] = [];
  const dots: LayoutResult["dots"] = [];
  const branchLabs: LayoutResult["branchLabs"] = [];

  function draw(node: TreeNode, enterX: number): void {
    if (node.fe === undefined) return;
    const nx = xCol(node.fe);
    const here = collectSeqs(node);
    segs.push({ x1: enterX, y1: node._y!, x2: nx, y2: node._y!, seqs: here });
    segs.push({ x1: nx, y1: node.S?._y ?? 0, x2: nx, y2: node.F?._y ?? 0, seqs: here });
    dots.push({ x: nx, y: node._y! });

    ([["S", node.S], ["F", node.F]] as [string, TreeNode | undefined][]).forEach(([key, child]) => {
      if (!child) return;
      const cs = collectSeqs(child);
      branchLabs.push({ x: nx + 6, y: (child._y ?? 0) + (key === "S" ? -6 : 14), key, seqs: cs });
      if (child.seq !== undefined) {
        segs.push({ x1: nx, y1: child._y!, x2: xEnd, y2: child._y!, seqs: cs });
      } else {
        draw(child, nx);
      }
    });
  }
  draw(root, LEFT - 58);

  return {
    segs, dots, branchLabs,
    leaves,
    xCol, xEnd, numCols, COL_W, LEFT, TOP,
    rootY: root._y ?? TOP,
    width: xEnd + PANEL + PAD_R,
    height: TOP + leaves.length * ROW_H + 20,
  };
}

function EventTreeDiagram({
  tree,
  showFreq,
  activeSeq,
  onHover,
  onSelect,
}: {
  tree: EventTree;
  showFreq: boolean;
  activeSeq: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  const L = useMemo(() => layoutTree(tree), [tree]);
  const feKeys = Object.keys(tree.functionalEvents);
  const isHot = (seqs: string[]): boolean => activeSeq !== null && seqs.includes(activeSeq);

  return (
    <div className="estree__scroll">
      <div className="estree__canvas" style={{ width: L.width, height: L.height }}>
        {feKeys.map((feId, c) => {
          const fe = tree.functionalEvents[feId];
          return (
            <div key={feId} className="estree__head" style={{ left: L.xCol(c) }}>
              <div className="estree__head-bar" />
              <div className="estree__head-fe">FE{c + 1}</div>
              <div className="estree__head-label">{fe.name}</div>
              <div className="estree__head-sub">{fe.description ?? ""}</div>
              {fe.faultTreeId !== undefined && <span className="estree__head-sc">{fe.faultTreeId}</span>}
            </div>
          );
        })}
        <div className="estree__ie" style={{ top: L.rootY }}>
          <div className="estree__ie-cap">Initiator</div>
          <div className="estree__ie-id">{tree.initiatingEventId}</div>
          {showFreq && tree.missionTime !== undefined && (
            <div className="estree__ie-freq">{tree.missionTime} {tree.missionTimeUnits ?? "h"} mission</div>
          )}
        </div>
        <svg className="estree__svg" width={L.width} height={L.height}>
          {L.segs.map((s, i) => (
            <line
              key={i}
              className={"estree__seg" + (isHot(s.seqs) ? " estree__seg--hot" : "")}
              x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            />
          ))}
          {L.dots.map((d, i) => (
            <circle key={i} className="estree__node-dot" cx={d.x} cy={d.y} r="3.4" />
          ))}
          {L.branchLabs.map((b, i) => (
            <text
              key={i}
              className={`estree__branch-lab estree__branch-lab--${b.key.toLowerCase()}`}
              x={b.x} y={b.y}
            >
              {b.key}
            </text>
          ))}
        </svg>
        {L.leaves.map((leaf) => {
          const seqData = tree.sequences[leaf.seq];
          const endTone = seqData?.endState === EndState.SUCCESSFUL_MITIGATION ? "ok" : "block";
          const rc = seqData?.eventSequenceId ?? leaf.seq;
          return (
            <button
              key={leaf.seq}
              className={"estree__seq" + (activeSeq === leaf.seq ? " estree__seq--active" : "")}
              style={{ left: L.xEnd + 6, top: leaf.y }}
              type="button"
              onMouseEnter={() => onHover(leaf.seq)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onSelect(leaf.seq)}
            >
              <span className={`estree__seq-end estree__seq-end--${endTone}`} />
              <span className="estree__seq-main">
                <span className="estree__seq-id">{leaf.seq}</span>
                <span className="estree__seq-rc"> · {rc === "SSS" ? "Safe state" : rc}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ScreenProps {
  ccId: string;
  setCcId: (id: string) => void;
  onAction: (msg: string) => void;
}

// ─── 01 — Scope & Safety Functions ───────────────────────────────────────────
function ScopeScreen({ ccId, setCcId, stage, setStage }: ScreenProps & { stage: Stage; setStage: (s: Stage) => void }): JSX.Element {
  const { es, upstreamLink } = useEsWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const ieLinked = upstreamLink.linkedIeWorkbookId !== null;
  const posLinked = upstreamLink.linkedPosWorkbookId !== null;

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <span className="possubtle">Written once in IE and POS · used here</span>
        </div>
        <p className="poscard__sub">Event Sequence Analysis builds on the initiating events from IE, the operating states from POS, and each safety function's success criteria from SC (ES-A1).</p>
        <div className="eslink">
          {[
            { short: "IE", element: "Initiating Event Analysis", icon: "Bolt",   linked: ieLinked, name: upstreamLink.linkedIeName, count: `${upstreamLink.initiatingEventGroups.length} groups`, synced: upstreamLink.linkedIeWorkbookId },
            { short: "POS", element: "Plant Operating States",   icon: "Layers", linked: posLinked, name: upstreamLink.linkedPosName, count: `${upstreamLink.states.length} states`, synced: upstreamLink.linkedPosWorkbookId },
          ].map((u) => {
            const Ico = ESIcon[u.icon] ?? ESIcon.Link;
            return (
              <div key={u.short} className={"eslink__card" + (!u.linked ? " eslink__card--unlinked" : "")}>
                <div className="eslink__top">
                  <span className="eslink__badge"><Ico /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="eslink__el">{u.element}</div>
                    <div className="eslink__wb">{u.short} · {u.linked ? (u.name ?? "Linked") : "Not linked"}</div>
                  </div>
                </div>
                <div className="eslink__delivers">{u.linked ? u.count : "Link a workbook to import data"}</div>
                <div className="eslink__foot">
                  {u.linked
                    ? <span className="eslink__status eslink__status--approved"><ESIcon.Check /> Linked</span>
                    : <span className="possubtle" style={{ fontSize: 12 }}>Not linked</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sources &amp; radionuclide transport barriers</h3>
          <span className="possubtle">ES-A2</span>
        </div>
        <p className="poscard__sub">For each source in scope, ES lists the barriers each scenario must watch to decide if there is a release.</p>
        {es.scopeDefinition.radioactiveMaterialSources.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No sources yet — link POS and IE workbooks to populate.</p>
        ) : (
          <table className="postable">
            <thead><tr><th>Source</th><th>Barriers</th></tr></thead>
            <tbody>
              {es.scopeDefinition.radioactiveMaterialSources.map((src, i) => (
                <tr key={i}>
                  <td>
                    <div className="postable__name">
                      <span style={{ display: "inline-flex", width: 14, height: 14, verticalAlign: "-2px", marginRight: 6, color: "var(--color-primary)" }}><ESIcon.Radiation /></span>
                      {src}
                    </div>
                  </td>
                  <td>
                    <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                      {es.scopeDefinition.radionuclideBarriers.map((b, j) => (
                        <span key={j} className="poschip">{b}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Key reactor-specific safety functions</h3>
          <Badge kind="progress">{es.keySafetyFunctions.length > 0 ? `${es.keySafetyFunctions.length} functions` : "None yet"}</Badge>
        </div>
        <p className="poscard__sub">Every scenario is built around these functions, with success criteria drawn from the SC element (ES-A3, ES-A4).</p>
        {es.keySafetyFunctions.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No safety functions defined yet.</p>
        ) : (
          <div className="essf-grid">
            {es.keySafetyFunctions.map((sf, i) => (
              <div key={i} className="essf">
                <span className="essf__icon"><ESIcon.Shield /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="essf__name">{sf}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Capability category</h3><Badge kind="progress">{cc.tag}</Badge></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c: CapabilityCategory) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div style={{ fontFamily: "'Literata', serif", fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{c.name} · {c.tag}</div>
                <div className="possubtle">{c.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "ES sequences developed from design-basis analyses and SC data; no plant operating history yet."],
            ["operational", "Operational", "Sequences may be updated with plant-specific operating experience and confirmed plant-response analyses."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost"
              style={{ flex: 1, minWidth: 260, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined, boxShadow: stage === val ? "0 0 0 3px var(--color-primary-focus)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="es-plant-stage" value={val} checked={stage === val} onChange={() => setStage(val)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 02 — Event Sequences ─────────────────────────────────────────────────────
function SequencesScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const trees = es.eventTrees ?? [];
  const sequences = es.eventSequences;
  const [activeTreeId, setActiveTreeId] = useState<string>(trees[0]?.uuid ?? "");
  const [activeSeq, setActiveSeq] = useState<string | null>(null);
  const [showFreq, setShowFreq] = useState(true);
  const [repr, setRepr] = useState<"tree" | "table">("tree");

  const activeTree = trees.find((t) => t.uuid === activeTreeId);

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Event sequences</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <button type="button" className={`posnav__btn posnav__btn--sm${repr === "tree" ? " posnav__btn--primary" : ""}`} onClick={() => setRepr("tree")}>
              <ESIcon.Tree /> Tree
            </button>
            <button type="button" className={`posnav__btn posnav__btn--sm${repr === "table" ? " posnav__btn--primary" : ""}`} onClick={() => setRepr("table")}>
              <ESIcon.Sheet /> Table
            </button>
          </div>
        </div>
        <p className="poscard__sub">
          {sequences.length > 0
            ? `${sequences.length} sequences delineated across ${trees.length} event trees.`
            : "No sequences yet — link IE and POS workbooks and delineate sequences."}
        </p>
      </div>

      {trees.length > 0 && (
        <>
          <div className="poscard">
            <div className="poscard__head">
              <h3 className="poscard__title">Event tree</h3>
              <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
                <label className="possubtle" style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={showFreq} onChange={(e) => setShowFreq(e.target.checked)} />
                  Show frequencies
                </label>
              </div>
            </div>
            <div className="esttabs">
              {trees.map((t) => (
                <button key={t.uuid} type="button"
                  className={"esttab" + (t.uuid === activeTreeId ? " esttab--active" : "")}
                  onClick={() => { setActiveTreeId(t.uuid); setActiveSeq(null); }}>
                  {t.name}
                </button>
              ))}
            </div>
            {activeTree !== undefined && (
              <EventTreeDiagram
                tree={activeTree}
                showFreq={showFreq}
                activeSeq={activeSeq}
                onHover={setActiveSeq}
                onSelect={setActiveSeq}
              />
            )}
          </div>

          {activeSeq !== null && repr === "tree" && (() => {
            const seq = sequences.find((s) => s.uuid === activeSeq);
            if (!seq) return null;
            return (
              <div className="poscard">
                <div className="poscard__head">
                  <h3 className="poscard__title">{seq.uuid} — sequence detail</h3>
                  <Badge kind={endStateTone(seq.endState)}>{endStateLabel(seq.endState)}</Badge>
                </div>
                <div className="posfield-grid">
                  <div className="posfield"><span className="posfield__label">Initiating event</span><span className="posmono">{seq.initiatingEventId}</span></div>
                  <div className="posfield"><span className="posfield__label">POS</span><span className="posmono">{seq.plantOperatingStateId}</span></div>
                  <div className="posfield"><span className="posfield__label">Release category</span><span className="posmono">{seq.releaseCategoryId ?? "—"}</span></div>
                  <div className="posfield"><span className="posfield__label">Mean frequency</span><span className="posmono">{fmtFreq(seq.meanFrequency)} /plant-yr</span></div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {repr === "table" && (
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">All sequences</h3><span className="possubtle">{sequences.length} total</span></div>
          {sequences.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No sequences yet.</p> : (
            <table className="postable">
              <thead><tr><th>Sequence</th><th>Initiator</th><th>POS</th><th>End state</th><th>RC</th><th>Mean freq (/yr)</th></tr></thead>
              <tbody>
                {sequences.map((s) => (
                  <tr key={s.uuid}>
                    <td><div className="postable__name">{s.uuid}</div></td>
                    <td className="mono">{s.initiatingEventId}</td>
                    <td className="mono">{s.plantOperatingStateId}</td>
                    <td><Badge kind={endStateTone(s.endState)}>{endStateLabel(s.endState)}</Badge></td>
                    <td className="mono">{s.releaseCategoryId ?? "—"}</td>
                    <td className="mono">{fmtFreq(s.meanFrequency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

// ─── 03 — Dependencies ────────────────────────────────────────────────────────
const DEP_TYPE_META: Record<string, { label: string; icon: string }> = {
  FUNCTIONAL:       { label: "Functional",       icon: "Network" },
  PHYSICAL:         { label: "Physical",         icon: "Pipe" },
  HUMAN:            { label: "Human",            icon: "Person" },
  OPERATIONAL:      { label: "Operational",      icon: "Settings" },
  PHENOMENOLOGICAL: { label: "Phenomenological", icon: "Flame" },
  COMMON_CAUSE:     { label: "Common-cause",     icon: "Group" },
};

function DepsScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const dm = es.dependencyModels;
  const allDeps = [
    ...(dm?.functionalDependencies ?? []).map((d) => ({ ...d, depType: DependencyType.FUNCTIONAL, typeLabel: "Functional" })),
    ...(dm?.phenomenologicalDependencies ?? []).map((d) => ({ ...d, depType: DependencyType.PHENOMENOLOGICAL, typeLabel: "Phenomenological" })),
    ...(dm?.operationalDependencies ?? []).map((d) => ({ ...d, depType: DependencyType.OPERATIONAL, typeLabel: "Operational" })),
    ...(dm?.humanDependencies ?? []).map((d) => ({ ...d, depType: DependencyType.HUMAN, typeLabel: "Human" })),
    ...(dm?.systemInterfaces ?? []).map((d) => ({ ...d, depType: DependencyType.PHYSICAL, typeLabel: "Physical interface" })),
  ];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Dependencies</h3>
          <Badge kind={allDeps.length > 0 ? "ok" : "draft"}>{allDeps.length} modelled</Badge>
        </div>
        <p className="poscard__sub">
          Functional, human, phenomenological, operational, and physical-interface dependencies that affect sequence progression (HLR-ES-B).
        </p>
      </div>
      {allDeps.length === 0 ? (
        <div className="poscard"><p className="posmuted" style={{ margin: 0 }}>No dependencies modelled yet.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {allDeps.map((dep, i) => {
            const meta = DEP_TYPE_META[dep.depType] ?? { label: dep.typeLabel, icon: "Network" };
            const Ico = ESIcon[meta.icon] ?? ESIcon.Network;
            return (
              <div key={i} className="poscard">
                <div className="poscard__head">
                  <div className="posrow" style={{ gap: 10 }}>
                    <span style={{ display: "inline-flex", width: 18, height: 18, color: "var(--color-primary)", flexShrink: 0 }}><Ico /></span>
                    <div>
                      <div className="posrow" style={{ gap: 8 }}>
                        <span className="posmono possubtle">{dep.uuid}</span>
                        <span className="poschip">{meta.label}</span>
                      </div>
                      <div className="poscard__title" style={{ fontSize: 14, marginTop: 2 }}>{dep.name}</div>
                    </div>
                  </div>
                </div>
                <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.55 }}>{dep.description}</p>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── 04 — Timing & Phenomena ──────────────────────────────────────────────────
function TimingScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const trees = es.eventTrees ?? [];

  const allTimings = es.eventSequences.flatMap((s) =>
    (s.timing ?? []).map((t) => ({ ...t, sequenceId: s.uuid }))
  );
  const allPhenomena = es.eventSequences.flatMap((s) =>
    (s.phenomenologicalImpacts ?? []).map((p) => ({ ...p, sequenceId: s.uuid }))
  );

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Event trees — mission times</h3>
        </div>
        {trees.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No event trees yet.</p> : (
          <table className="postable">
            <thead><tr><th>Tree</th><th>Initiating event</th><th>Mission time</th><th>POS</th></tr></thead>
            <tbody>
              {trees.map((t) => (
                <tr key={t.uuid}>
                  <td><div className="postable__name">{t.name}</div><span className="postable__name-sub">{t.uuid}</span></td>
                  <td className="mono">{t.initiatingEventId}</td>
                  <td className="mono">{t.missionTime !== undefined ? `${t.missionTime} ${t.missionTimeUnits ?? "h"}` : "—"}</td>
                  <td className="mono">{t.plantOperatingStateId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sequence timing</h3>
          <span className="possubtle">ES-A6</span>
        </div>
        {allTimings.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No timing records yet.</p> : (
          <table className="postable">
            <thead><tr><th>Sequence</th><th>Event</th><th>Time after initiator</th><th>Basis</th></tr></thead>
            <tbody>
              {allTimings.map((t, i) => (
                <tr key={i}>
                  <td className="mono">{t.sequenceId}</td>
                  <td>{t.event}</td>
                  <td className="mono">{t.timeAfterInitiator} min</td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{t.basis ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Phenomenological impacts</h3>
          <span className="possubtle">ES-B3</span>
        </div>
        {allPhenomena.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No phenomenological impacts recorded.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allPhenomena.map((p, i) => (
              <div key={i} className="poscard poscard--ghost">
                <div className="poscard__head">
                  <span style={{ display: "inline-flex", width: 16, height: 16, color: "var(--color-warning)" }}><ESIcon.Flame /></span>
                  <span className="poscard__title" style={{ fontSize: 14 }}>{p.name}</span>
                </div>
                <p className="possubtle" style={{ margin: "6px 0 0", fontSize: 13 }}>{p.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── 05 — End States & Releases ───────────────────────────────────────────────
function EndStatesScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const mappings = es.releaseCategoryMappings ?? [];
  const successCount = es.eventSequences.filter((s) => s.endState === EndState.SUCCESSFUL_MITIGATION).length;
  const releaseCount = es.eventSequences.filter((s) => s.endState === EndState.RADIONUCLIDE_RELEASE).length;

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">End states</h3>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="poscard poscard--ghost" style={{ padding: 14 }}>
            <div className="posrow" style={{ gap: 8, marginBottom: 6 }}>
              <span style={{ display: "inline-flex", width: 16, height: 16, color: "var(--color-ok)" }}><ESIcon.Check /></span>
              <strong style={{ fontSize: 14 }}>Successful mitigation</strong>
            </div>
            <div className="posmono" style={{ fontSize: 22, fontWeight: 700 }}>{successCount}</div>
            <div className="possubtle" style={{ fontSize: 12.5, marginTop: 4 }}>sequences reach a safe stable state</div>
          </div>
          <div className="poscard poscard--ghost" style={{ padding: 14 }}>
            <div className="posrow" style={{ gap: 8, marginBottom: 6 }}>
              <span style={{ display: "inline-flex", width: 16, height: 16, color: "var(--color-error)" }}><ESIcon.Radiation /></span>
              <strong style={{ fontSize: 14 }}>Radionuclide release</strong>
            </div>
            <div className="posmono" style={{ fontSize: 22, fontWeight: 700 }}>{releaseCount}</div>
            <div className="possubtle" style={{ fontSize: 12.5, marginTop: 4 }}>sequences lead to a release category</div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Release category mappings</h3>
          <span className="possubtle">ES-C1 · ES-C2</span>
        </div>
        {mappings.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No release category mappings yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {mappings.map((m) => (
              <div key={m.uuid} className="poscard poscard--ghost">
                <div className="poscard__head">
                  <div>
                    <span className="posmono possubtle">{m.releaseCategoryId}</span>
                    <div className="poscard__title" style={{ fontSize: 14, marginTop: 2 }}>{m.releaseCategoryId}</div>
                  </div>
                  <span className="poschip">{m.eventSequenceIds.length} sequences</span>
                </div>
                <p style={{ margin: "8px 0 6px", fontSize: 13, color: "var(--color-text)", lineHeight: 1.55 }}>{m.mappingBasis}</p>
                <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                  {m.commonCharacteristics.map((c, i) => <span key={i} className="poschip">{c}</span>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── 06 — Sequence Families ───────────────────────────────────────────────────
function FamiliesScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const families = es.eventSequenceFamilies;

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sequence families</h3>
          <Badge kind={families.length > 0 ? "ok" : "draft"}>{families.length} families</Badge>
        </div>
        <p className="poscard__sub">Sequences grouped by shared end state, release category, and plant response — one family maps to one mechanistic source-term calculation (ES-C8).</p>
      </div>
      {families.length === 0 ? (
        <div className="poscard"><p className="posmuted" style={{ margin: 0 }}>No families defined yet.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {families.map((f: EventSequenceFamily) => {
            const endTone = f.endState === EndState.SUCCESSFUL_MITIGATION ? "ok" : "block";
            return (
              <div key={f.uuid} className="poscard">
                <div className="poscard__head">
                  <div>
                    <div className="posrow" style={{ gap: 8 }}>
                      <span className="posmono possubtle">{f.uuid}</span>
                      <Badge kind={endTone}>{endStateLabel(f.endState)}</Badge>
                    </div>
                    <h3 className="poscard__title" style={{ fontSize: 15, marginTop: 4 }}>{f.name}</h3>
                  </div>
                  <div className="possubtle" style={{ fontSize: 12.5, textAlign: "right" }}>
                    <div>{f.memberSequenceIds.length} sequences</div>
                    <div className="posmono">{fmtFreq(f.meanFrequency)} /yr</div>
                  </div>
                </div>
                <p style={{ margin: "8px 0 10px", fontSize: 13.5, lineHeight: 1.55, color: "var(--color-text)" }}>{f.representativePlantResponse}</p>
                <div className="posrow posrow--wrap" style={{ gap: 4 }}>
                  {f.memberSequenceIds.map((id) => (
                    <span key={id} className="poschip poschip--method" style={{ fontSize: 11 }}>{id}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ─── 07 — Screening ───────────────────────────────────────────────────────────
function ScreeningScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const records = es.screeningRecords;
  const retained = records.filter((r) => r.retained).length;
  const screened = records.filter((r) => !r.retained).length;

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Screening rule</h3></div>
        <div className="poscard poscard--ghost" style={{ padding: 14 }}>
          <div className="posrow" style={{ gap: 10, alignItems: "flex-start" }}>
            <span style={{ display: "inline-flex", width: 20, height: 20, color: "var(--color-primary)" }}><ESIcon.Shield /></span>
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--color-text)" }}>
              By default, every sequence is retained. A sequence may be screened only if it is slow-developing, alarmed, and demonstrably corrected before any radionuclide barrier is challenged (SCR-3). Sequences leading to a release category are never screened on frequency alone (ES-A7).
            </p>
          </div>
        </div>
      </div>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening decisions</h3>
          <div className="posrow" style={{ gap: 8 }}>
            <span className="poschip poschip--ok-soft">{retained} retained</span>
            <span className="poschip">{screened} screened</span>
          </div>
        </div>
        {records.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No screening records yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {records.map((rec: EventSequenceScreeningRecord, i) => (
              <div key={i} className={`iescreen${!rec.retained ? "" : " iescreen--blocked"}`}>
                <div className="iescreen__head">
                  <span className="posmono possubtle">{rec.sequenceId}</span>
                  {rec.retained
                    ? <Badge kind="ok">Retained</Badge>
                    : <Badge kind="draft">Screened out · {rec.criterion ?? "—"}</Badge>}
                </div>
                <p className="iescreen__just">{rec.justification}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ─── 08 — Quantification ─────────────────────────────────────────────────────
const LOG_MIN = -7.5;
const LOG_MAX = 0.6;

function freqToPct(v: number): number {
  if (!isFinite(v) || v <= 0) return 0;
  const l = Math.log10(v);
  return Math.max(2, Math.min(100, ((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100));
}

function QuantScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const families = [...es.eventSequenceFamilies].sort((a, b) => {
    const av = a.meanFrequency !== undefined ? freqValue(a.meanFrequency) : 0;
    const bv = b.meanFrequency !== undefined ? freqValue(b.meanFrequency) : 0;
    return bv - av;
  });

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Sequence-family frequencies</h3></div>
        <p className="poscard__sub">Mean frequency per family — the hand-off values for Event Sequence Quantification (ESQ).</p>
        {families.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No families quantified yet.</p> : (
          <div className="iefreq">
            {families.map((f) => {
              const v = f.meanFrequency !== undefined ? freqValue(f.meanFrequency) : 0;
              const endTone = f.endState === EndState.SUCCESSFUL_MITIGATION ? "ok" : "block";
              return (
                <div key={f.uuid} className="iefreq__row">
                  <div className="iefreq__label">
                    <span className="iefreq__label-id">{f.uuid}</span>
                    <span className="iefreq__label-name">{f.name}</span>
                    <Badge kind={endTone}>{endStateLabel(f.endState)}</Badge>
                  </div>
                  <div className="iefreq__track">
                    <div className="iefreq__fill" style={{ width: `${freqToPct(v)}%` }} />
                    <span className="iefreq__val">{fmtFreq(f.meanFrequency)}<span className="iefreq__unit"> /yr</span></span>
                  </div>
                  <div className="iefreq__meta">
                    <span className="poschip">{f.memberSequenceIds.length} sequences</span>
                    <span className="poschip poschip--method"><ESIcon.Gauge /> Hand-off → ESQ</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Downstream interfaces</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span className="poschip poschip--method"><ESIcon.ArrowR /> Event Sequence Quantification (ESQ) — receives families and frequencies</span>
          <span className="poschip poschip--method"><ESIcon.ArrowR /> Mechanistic Source Term (MS) — receives release categories RC-1, RC-2, RC-3</span>
        </div>
      </div>
    </>
  );
}

// ─── 09 — Draft ───────────────────────────────────────────────────────────────
function DraftScreen({
  cc, scores, stage, onSubmitDraft, canSubmit,
}: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const ready = scores.blocked === 0;
  const TOC_ITEMS: [string, string][] = [
    ["Executive summary", "4"],
    ["Introduction", "5"],
    ["    Purpose, scope & interfaces (IE · POS · SC upstream; ESQ · MS downstream)", "5"],
    ["    Quality assurance & freeze date", "7"],
    ["Scope: safety functions, sources & barriers", "8"],
    ["Event trees and delineated sequences", "10"],
    ["    Initiating-event coverage", "10"],
    ["    Functional-event ordering (ES-A6)", "12"],
    ["    Sequence end states and release-category mapping", "15"],
    ["Dependencies", "20"],
    ["    Functional, phenomenological & human dependencies", "20"],
    ["    Common-cause failure groups", "24"],
    ["Timing and phenomenological impacts", "26"],
    ["Sequence families and release categories", "29"],
    ["Screening", "33"],
    ["Quantification — mean frequency per family", "35"],
    ["Model uncertainty & pre-operational assumptions", "38"],
    ["References", "42"],
  ];

  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>ES Workbook</h1>
        <h2>Preliminary Event Sequence Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {TOC_ITEMS.map(([t, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>
          ))}
        </div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>. Producing the draft locks Steps 1–8 and advances the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need{scores.warn === 1 ? "s" : ""} attention. You may produce a working draft, but approval is gated until they are resolved.</>}
          </p>
          {canSubmit && (
            <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
              <ESIcon.Send /> {ready ? "Submit draft to internal review" : "Submit working draft to review"}
            </button>
          )}
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Downstream interfaces</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>This ES list feeds the next elements directly.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="poschip poschip--method"><ESIcon.ArrowR /> Event Sequence Quantification (ESQ)</span>
            <span className="poschip poschip--method"><ESIcon.ArrowR /> Mechanistic Source Term (MS)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  ScopeScreen,
  SequencesScreen,
  DepsScreen,
  TimingScreen,
  EndStatesScreen,
  FamiliesScreen,
  ScreeningScreen,
  QuantScreen,
  DraftScreen,
  type ScreenProps,
};
