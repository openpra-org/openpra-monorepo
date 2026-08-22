import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX, useMemo, useState } from "react";
import { SYIcon } from "./syIcons";
import { Badge, SYProvenanceChip } from "./syShared";
import {
  CAPABILITY_CATEGORIES,
  FAILURE_MODE_TYPES,
  CCF_MODELS,
  ccfParams,
  ccfModelCheck,
  toExp,
  SCREENING_CRITERIA,
  type Stage,
  type SyTreeNode,
  type SyGateNode,
  type SyBeNode,
} from "./syViewData";
import { ccScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";

interface SyDrawerContext {
  kind: "system" | "ccf" | "hfe" | "screening" | "exclusion" | "unavail" | "ssc" | "spc" | "inv" | "dic" | "loop" | "confirm" | "oc" | "unc" | "assum" | "sens" | "be";
  id: string;
}

const FT = { NODE_W: 184, NODE_H: 66, H_GAP: 24, SYM_H: 30, SYM_GAP: 12, LEVEL_GAP: 36, BUS_GAP: 16 };
const FT_ROW = FT.NODE_H + FT.SYM_GAP + FT.SYM_H + FT.LEVEL_GAP;

interface PositionedNode {
  node: SyTreeNode;
  cx: number;
  top: number;
  depth: number;
  childXs: number[];
  childTop: number | null;
}

function childrenOf(node: SyTreeNode): SyTreeNode[] {
  return node.type === "OR" || node.type === "AND" || node.type === "KN" ? node.children : [];
}

function computeFtLayout(root: SyTreeNode): { nodes: PositionedNode[]; width: number; height: number } {
  let leaf = 0;
  const nodes: PositionedNode[] = [];
  const cxById = new Map<string, number>();
  function assign(node: SyTreeNode, depth: number): number {
    const kids = childrenOf(node);
    let cx: number;
    if (kids.length === 0) {
      cx = leaf * (FT.NODE_W + FT.H_GAP) + (FT.NODE_W + FT.H_GAP) / 2;
      leaf += 1;
    } else {
      const cs = kids.map((k) => assign(k, depth + 1));
      cx = (cs[0] + cs[cs.length - 1]) / 2;
    }
    cxById.set(node.id, cx);
    nodes.push({ node, cx, top: depth * FT_ROW, depth, childXs: kids.map((k) => cxById.get(k.id) ?? 0), childTop: kids.length > 0 ? (depth + 1) * FT_ROW : null });
    return cx;
  }
  assign(root, 0);
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  const width = Math.max(FT.NODE_W + FT.H_GAP, leaf * (FT.NODE_W + FT.H_GAP));
  const height = maxDepth * FT_ROW + FT.NODE_H + FT.SYM_GAP + FT.SYM_H + 10;
  return { nodes, width, height };
}

function FtSymbol({ node, cx, top }: { node: SyTreeNode; cx: number; top: number }): JSX.Element | null {
  const { sy } = useSyWorkbook();
  const symTop = top + FT.NODE_H + FT.SYM_GAP;
  const gw = 44;
  const gh = FT.SYM_H;
  const L = cx - gw / 2;
  const R = cx + gw / 2;
  const B = symTop + gh;
  const T = symTop;
  const orPath = `M ${L} ${B} C ${L} ${B - gh * 0.55} ${cx - gw * 0.16} ${T} ${cx} ${T} C ${cx + gw * 0.16} ${T} ${R} ${B - gh * 0.55} ${R} ${B} C ${cx + gw * 0.22} ${B - gh * 0.34} ${cx - gw * 0.22} ${B - gh * 0.34} ${L} ${B} Z`;
  if (node.type === "OR") return <path d={orPath} className="ftgate ftgate--or" />;
  if (node.type === "AND") {
    const ar = gh * 0.6;
    const d = `M ${L} ${B} L ${L} ${T + ar} A ${gw / 2} ${ar} 0 0 1 ${R} ${T + ar} L ${R} ${B} Z`;
    return <path d={d} className="ftgate ftgate--and" />;
  }
  if (node.type === "KN") {
    const n = node.children.length;
    return (<g><path d={orPath} className="ftgate ftgate--kn" /><text x={cx} y={T + gh * 0.72} className="ftgate-lab">{node.k}/{n}</text></g>);
  }
  if (node.type === "TR") {
    const d = `M ${cx} ${T} L ${R} ${B} L ${L} ${B} Z`;
    return <path d={d} className="ftsym ftsym--tr" />;
  }
  if (node.type !== "BE") return null;
  const basicEvent = sy.systemBasicEvents.find((event) => event.uuid === node.basicEventId);
  const isCcf = basicEvent?.failureMode === "COMMON_CAUSE_FAILURE";
  const r = gh * 0.5;
  return (
    <g>
      <circle cx={cx} cy={T + r} r={r} className={`ftsym ftsym--be${isCcf ? " ftsym--ccf" : ""}`} />
      {isCcf && <circle cx={cx} cy={T + r} r={r - 3.5} className="ftsym ftsym--ccf-inner" />}
    </g>
  );
}

function FtBox({ node, cx, top, onTransfer, onSelectBe }: { node: SyTreeNode; cx: number; top: number; onTransfer: (systemId: string) => void; onSelectBe: (beId: string) => void }): JSX.Element {
  const { sy, shortOf } = useSyWorkbook();
  const left = cx - FT.NODE_W / 2;
  if (node.type === "OR" || node.type === "AND" || node.type === "KN") {
    const gate = node as SyGateNode;
    const n = gate.children.length;
    const kind = node.type === "AND" ? "AND gate" : node.type === "KN" ? `${gate.k} of ${n} voting gate` : "OR gate";
    return (
      <div className={`ftbox ftbox--gate${node.type === "KN" ? " ftbox--votegate" : ""}`} style={{ left, top, width: FT.NODE_W, minHeight: FT.NODE_H }}>
        <span className="ftbox__kind">{kind}</span>
        <span className="ftbox__name">{node.name}</span>
      </div>
    );
  }
  if (node.type === "TR") {
    return (
      <div className="ftbox ftbox--tr" style={{ left, top, width: FT.NODE_W, minHeight: FT.NODE_H }} title="Open the transferred tree" onClick={() => onTransfer(node.transfer)}>
        <span className="ftbox__kind">Transfer</span>
        <span className="ftbox__name">{node.name}</span>
        <span className="ftbox__to">To {shortOf(node.transfer)} tree</span>
      </div>
    );
  }
  const be = node as SyBeNode;
  const beData = sy.systemBasicEvents.find((event) => event.uuid === be.basicEventId);
  const failureMode = beData?.failureMode ?? "";
  const fm = FAILURE_MODE_TYPES[failureMode];
  const isCcf = failureMode === "COMMON_CAUSE_FAILURE";
  const repair = beData?.repairModeled === true;
  return (
    <div className={`ftbox ftbox--be${isCcf ? " ftbox--ccf" : ""}`} style={{ left, top, width: FT.NODE_W, minHeight: FT.NODE_H }} title="Open the basic event" onClick={() => onSelectBe(be.basicEventId)}>
      <span className="ftbox__name">{beData?.name ?? be.basicEventId}</span>
      <span className="ftbox__be-meta">
        <span className="ftbox__id">{be.basicEventId}</span>
        <span className={`ftbox__fm ftbox__fm--${(fm?.short ?? "x").toLowerCase()}`}>{(fm?.short ?? failureMode) || "—"}</span>
        <span className="ftbox__prob">{beData?.probability === undefined ? "—" : toExp(beData.probability)}</span>
      </span>
      {repair && <span className="ftbox__repair">Repair credited</span>}
    </div>
  );
}

function FaultTree({ tree, onTransfer, onSelectBe }: { tree: SyTreeNode; onTransfer: (systemId: string) => void; onSelectBe: (beId: string) => void }): JSX.Element | null {
  const layout = useMemo(() => computeFtLayout(tree), [tree]);
  if (layout === null) return null;
  const { nodes, width, height } = layout;
  const lines: { x1: number; y1: number; x2: number; y2: number; key: string }[] = [];
  nodes.forEach((n) => {
    const symTop = n.top + FT.NODE_H + FT.SYM_GAP;
    const symBottom = symTop + FT.SYM_H;
    lines.push({ x1: n.cx, y1: n.top + FT.NODE_H, x2: n.cx, y2: symTop, key: `${n.node.id}-s` });
    if (n.childTop !== null && n.childXs.length > 0) {
      const busY = n.childTop - FT.BUS_GAP;
      lines.push({ x1: n.cx, y1: symBottom, x2: n.cx, y2: busY, key: `${n.node.id}-d` });
      lines.push({ x1: Math.min(n.cx, ...n.childXs), y1: busY, x2: Math.max(n.cx, ...n.childXs), y2: busY, key: `${n.node.id}-bus` });
      n.childXs.forEach((x, i) => lines.push({ x1: x, y1: busY, x2: x, y2: n.childTop ?? 0, key: `${n.node.id}-c${i}` }));
    }
  });
  return (
    <div className="ftscroll">
      <div className="ftcanvas" style={{ width, height }}>
        <svg className="ftsvg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: `${height}px` }}>
          {lines.map((l) => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} className="ftline" />)}
          {nodes.map((n) => <FtSymbol key={`${n.node.id}-sym`} node={n.node} cx={n.cx} top={n.top} />)}
        </svg>
        {nodes.map((n) => <FtBox key={`${n.node.id}-box`} node={n.node} cx={n.cx} top={n.top} onTransfer={onTransfer} onSelectBe={onSelectBe} />)}
      </div>
    </div>
  );
}

function FtLegend(): JSX.Element {
  const items: { lab: string; svg: JSX.Element }[] = [
    { lab: "OR gate", svg: <path d="M2 17 C2 8 9 2 13 2 C17 2 24 8 24 17 C18 13 8 13 2 17 Z" className="ftgate ftgate--or" /> },
    { lab: "AND gate", svg: <path d="M2 17 L2 9 A11 9 0 0 1 24 9 L24 17 Z" className="ftgate ftgate--and" /> },
    { lab: "Voting gate (k of n)", svg: <path d="M2 17 C2 8 9 2 13 2 C17 2 24 8 24 17 C18 13 8 13 2 17 Z" className="ftgate ftgate--kn" /> },
    { lab: "Basic event", svg: <circle cx="13" cy="10" r="8" className="ftsym ftsym--be" /> },
    { lab: "Common cause", svg: <g><circle cx="13" cy="10" r="8" className="ftsym ftsym--ccf" /><circle cx="13" cy="10" r="4.5" className="ftsym ftsym--ccf-inner" /></g> },
    { lab: "Transfer", svg: <path d="M13 2 L24 18 L2 18 Z" className="ftsym ftsym--tr" /> },
  ];
  return (
    <div className="ftlegend">
      {items.map((it) => (
        <span key={it.lab} className="ftlegend-item"><svg viewBox="0 0 26 20">{it.svg}</svg>{it.lab}</span>
      ))}
    </div>
  );
}

function LogicModelTree({ tree, onTransfer, onSelectBe }: { tree: SyTreeNode; onTransfer: (systemId: string) => void; onSelectBe: (beId: string) => void }): JSX.Element {
  return (
    <div className="sytree">
      <FaultTree tree={tree} onTransfer={onTransfer} onSelectBe={onSelectBe} />
      <FtLegend />
    </div>
  );
}

interface SyIfaceLane {
  key: string;
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  columns: string[];
  rows: { id: string; name: string; values: string[] }[];
  empty: string;
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onAction }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const { sy, links, editable, mutateSy } = useSyWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const ifaceLanes: SyIfaceLane[] = [
    {
      key: "in-POS", code: "POS", element: "Plant Operating States", role: "Operating states", direction: "in",
      columns: ["Operating state", "Decay heat", "Duration (h)"],
      rows: (links?.posStates ?? []).map((st) => ({ id: st.id, name: `${st.id} · ${st.name}`, values: [st.decayLabel, String(st.durationHours)] })),
      empty: "Load an example to pull the operating states the systems align to.",
    },
    {
      key: "in-SC", code: "SC", element: "Success Criteria", role: "System success criteria", direction: "in",
      columns: ["System", "Required capacities"],
      rows: (links?.scSystems ?? []).map((y) => ({ id: y.id, name: y.name, values: [y.capacities] })),
      empty: "Load an example to pull the system success criteria this analysis models.",
    },
    {
      key: "out-HR", code: "HR", element: "Human Reliability", role: "Human failure events", direction: "out",
      columns: ["Human failure event", "System", "Task"],
      rows: sy.humanFailureEventIntegrations.map((h) => ({ id: h.uuid, name: h.hfeReference, values: [h.system, h.taskDescription] })),
      empty: "No human failure events integrated yet.",
    },
    {
      key: "out-DA", code: "DA", element: "Data Analysis", role: "Basic events", direction: "out",
      columns: ["Basic event", "Failure mode", "Point estimate"],
      rows: (sy.systemBasicEvents ?? []).map((b) => ({ id: b.uuid, name: b.name, values: [String(b.failureMode ?? ""), b.probability !== undefined ? b.probability.toExponential(1) : ""] })),
      empty: "No basic events defined yet.",
    },
    {
      key: "out-ESQ", code: "ESQ", element: "Event Sequence Quantification", role: "System fault trees", direction: "out",
      columns: ["System", "Top event", "Mission (h)"],
      rows: sy.systemDefinitions.map((d) => ({ id: d.uuid, name: d.name, values: [d.description ?? "", String(d.missionTimeHours)] })),
      empty: "No system models defined yet.",
    },
  ];
  const selectedLane = ifaceLanes.find((l) => l.key === selectedTe);

  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateSy((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    onAction(`Plant stage set to ${newStage === "operational" ? "Operational" : "Pre-operational"}`);
    mutateSy((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Interfaces" level={3} />
          {links !== null ? <Badge kind="ok">Linked</Badge> : <Badge kind="warn">Not linked</Badge>}
        </div>
        <p className="poscard__sub">Systems Analysis reads the system success criteria from SC and the operating states from POS, then hands its fault-tree models to ESQ, its basic events to DA, and its human failure events to HR. Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button key={lane.key} type="button"
              className={`poshandoff__tile${selectedTe === lane.key ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.key ? null : lane.key)}>
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.direction === "in" ? "Provides · " : "Consumes · "}{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              {selectedLane.direction === "in"
                ? `Systems Analysis receives ${selectedLane.role.toLowerCase()} from ${selectedLane.element}`
                : `${selectedLane.element} receives ${selectedLane.role.toLowerCase()} from Systems Analysis`}
            </div>
            {selectedLane.rows.length > 0 ? (
              <table className="postable postable--mid">
                <thead><tr>{selectedLane.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {selectedLane.rows.map((r) => (
                    <tr key={r.id}>
                      <td><div className="postable__name">{r.name}</div></td>
                      {r.values.map((v, idx) => <td key={selectedLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="posmuted" style={{ margin: 0 }}>{selectedLane.empty}</p>
            )}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Capability category" level={3} />
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Screened models where justified, or detailed models for risk-significant systems.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const score = ccScore(sy, c.id, stage);
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
                <div className="possubtle" style={{ fontSize: 11.5, marginTop: 8 }}>{score.ready} of {score.total} SRs ready</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title="Plant stage" level={3} /></div>
        <p className="poscard__sub">SY has the heaviest pre-operational fork, since it leans most on walkdowns and operating practice.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Models rest on design information, with ten pre-operational SRs logging the gaps."],
            ["operational", "Operational", "Walkdowns and maintenance history confirm the models and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <WorkbookInput type="radio" name="sy-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function ModelsScreen({ sysId, setSysId, openDrawer }: {
  sysId: string;
  setSysId: (id: string) => void;
  openDrawer: (ctx: SyDrawerContext) => void;
}): JSX.Element {
  const { sy, shortOf } = useSyWorkbook();
  const sysDef = sy.systemDefinitions.find((s) => s.uuid === sysId) ?? sy.systemDefinitions[0];

  if (sysDef === undefined) {
    return (
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="System" level={3} />
          <span className="possubtle">0 systems · SY-A1, A7, A8</span>
        </div>
        <p className="poscard__sub">No systems have been added to this workbook yet.</p>
        <div className="eswarn">
          <span>Add or import a system definition before building its fault-tree logic model.</span>
        </div>
      </div>
    );
  }

  const logic = sy.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
  const faultTree = logic?.faultTree as SyTreeNode | undefined;
  const supportSystems = sy.systemDependencies.filter((d) => d.dependentSystem === sysDef.uuid).map((d) => d.supportingSystem);
  const varCrit = (sy.variableSuccessCriteria ?? []).filter((v) => v.systemReference === sysDef.uuid);
  const applicablePos = sysDef.applicablePlantOperatingStates ?? [];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="System" level={3} />
          <span className="possubtle">{sy.systemDefinitions.length} systems · SY-A1, A7, A8</span>
        </div>
        <p className="poscard__sub">Select a system to see its boundary and logic model.</p>
        <select className="posfield__select" style={{ maxWidth: 360 }} value={sysDef.uuid} onChange={(e) => setSysId(e.target.value)}>
          {sy.systemDefinitions.map((s) => (
            <option key={s.uuid} value={s.uuid}>{shortOf(s.uuid)}: {s.name}</option>
          ))}
        </select>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title={sysDef.name} cueKey="System definition" />
        </div>
        <div className="sysd">
          <div className="sysd__card">
            <div className="sysd__head"><span className="sysd__name">Top event</span></div>
            <div className="sysd__body">{sysDef.description ?? sysDef.name}</div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><span className="sysd__name">Success criterion</span></div>
            <div className="sysd__body">{sysDef.successCriterion ?? "—"}
              {varCrit.length > 0 && (
                <div className="syvsc">
                  {varCrit.map((v) => (
                    <div key={v.uuid} className="syvsc__row">
                      <span className="syvsc__when">{v.plantOperatingStateId ?? v.scenarioCondition ?? "Condition"}</span>
                      <span className="syvsc__crit">{v.basis}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><WorkbookCueLabel workbook="SY" title="Model boundary" className="sysd__name" /><span className="sysd__cap">SY-A8</span></div>
            <div className="sysd__body"><div className="syboundary__list">{sysDef.boundaries.map((b, i) => <span key={i} className="syboundary__tag">{b}</span>)}</div></div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><span className="sysd__name">Support interfaces</span></div>
            <div className="sysd__body">
              {supportSystems.length > 0
                ? <div className="syboundary__list">{supportSystems.map((id) => <span key={id} className="syboundary__tag">{shortOf(id)}</span>)}</div>
                : <span className="possubtle">None</span>}
            </div>
          </div>
          <div className="sysd__card">
            <div className="sysd__head"><WorkbookCueLabel workbook="SY" title="Operating states" className="sysd__name" /><span className="sysd__cap">POS</span></div>
            <div className="sysd__body">
              {applicablePos.length > 0
                ? <div className="syboundary__list">{applicablePos.map((pid) => <span key={pid} className="syboundary__tag">{pid}</span>)}</div>
                : <span className="possubtle">All states</span>}
            </div>
          </div>
        </div>
        {logic?.nonDetailedModelJustification !== undefined && (
          <div className="eswarn" style={{ marginTop: 12 }}><span>System-level model (SY-A9). {logic.nonDetailedModelJustification}</span></div>
        )}
      </div>

      {faultTree !== undefined ? (
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="SY" title={<>Logic model · {shortOf(sysDef.uuid)}</>} cueKey="Fault-tree logic model" />
            <SYProvenanceChip>SY-A7 · SY-A14</SYProvenanceChip>
          </div>
          <p className="poscard__sub">The fault tree is a common representation of the system logic model, and other representations could be used. Click a basic event to edit it.</p>
          <LogicModelTree tree={faultTree} onTransfer={setSysId} onSelectBe={(beId) => openDrawer({ kind: "be", id: beId })} />
        </div>
      ) : (
        <div className="poscard">
          <div className="poscard__head"><WorkbookSectionHeading workbook="SY" title={<>Logic model · {shortOf(sysDef.uuid)}</>} cueKey="Fault-tree logic model" /></div>
          <div className="eswarn"><span>Modeled at the system level, so no decomposed fault tree is built (SY-A9).</span></div>
        </div>
      )}
    </>
  );
}

function FailuresScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  function addUnavailability(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      simultaneousUnavailabilityEvents: [...(draft.simultaneousUnavailabilityEvents ?? []), {
        uuid, description: "", componentIds: [], plannedActivityBasis: "", implementsSrs: [{ sr: "SY-A27", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "unavail", id: uuid });
  }
  function addHfe(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      humanFailureEventIntegrations: [...draft.humanFailureEventIntegrations, {
        uuid, hfeReference: "", system: draft.systemDefinitions[0]?.uuid ?? "", taskDescription: "", hfeType: "PRE_INITIATOR" as const, isTestMaintenance: false, implementsSrs: [{ sr: "SY-A21", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "hfe", id: uuid });
  }
  function addScreening(): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      componentScreeningJustifications: [...(draft.componentScreeningJustifications ?? []), {
        uuid, systemReference: draft.systemDefinitions[0]?.uuid ?? "", componentId: "", screeningCriterion: "a" as const, quantitativeJustification: "", implementsSrs: [{ sr: "SY-A20", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "screening", id: uuid });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Exclusions and diversion paths" level={3} />
          <span className="possubtle">SY-A16, A17, A18</span>
        </div>
        <p className="poscard__sub">The included failure modes are the fault trees in step 02. This table records what each model deliberately leaves out and which diversion paths it models. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>System</th><th>Left out</th><th>Diversion path</th></tr></thead>
          <tbody>
            {sy.systemDefinitions.map((def) => (
              <tr key={def.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "exclusion", id: def.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{shortOf(def.uuid)}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{(def.justificationForExclusionOfComponents ?? []).join(" ")}</td>
                <td className="possubtle" style={{ fontSize: 12.5 }}>{def.flowDiversionConsiderations?.[0] ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Screening" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A20</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addScreening}><SYIcon.Plus /> Add component</button>}
          </div>
        </div>
        <p className="poscard__sub">Unlike success criteria, SY allows screening, but only against stated criteria. Click a row to edit it.</p>
        <div className="syscreen__crit">
          {SCREENING_CRITERIA.map((c) => (
            <div key={c.code} className="syscreen__crit-item">
              <span className="syscreen__crit-code">{c.code}</span>
              <span className="syscreen__crit-label">{c.label}</span>
            </div>
          ))}
        </div>
        <table className="postable" style={{ marginTop: 12 }}>
          <thead><tr><th>Component</th><th>System</th><th>Justification</th><th>Criterion</th></tr></thead>
          <tbody>
            {(sy.componentScreeningJustifications ?? []).map((c) => {
              return (
                <tr key={c.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "screening", id: c.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{c.componentId}</td>
                  <td>{shortOf(c.systemReference)}</td>
                  <td className="possubtle" style={{ fontSize: 12 }}>{c.quantitativeJustification}</td>
                  <td><span className="syscreen__pill">Criterion {c.screeningCriterion}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Simultaneous unavailability" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <span className="possubtle">SY-A27</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addUnavailability}><SYIcon.Plus /> Add record</button>}
          </div>
        </div>
        <p className="poscard__sub">Single-train test and maintenance lives in the fault trees as unavailability events. This table records redundant equipment planned out of service at the same time. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Planned activity</th><th>Components</th><th>DA parameter</th></tr></thead>
          <tbody>
            {(sy.simultaneousUnavailabilityEvents ?? []).map((u) => (
              <tr key={u.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "unavail", id: u.uuid })} style={{ cursor: "pointer" }}>
                <td style={{ fontWeight: 600 }}>{u.description}</td>
                <td><div className="posrow posrow--wrap" style={{ gap: 5 }}>{u.componentIds.map((c) => <span key={c} className="poschip">{c}</span>)}</div></td>
                <td className="posmono" style={{ fontSize: 11 }}>{u.dataAnalysisRef ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Human failure events placed in the models" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-A21 · SY-A23</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addHfe}><SYIcon.Plus /> Add event</button>}
          </div>
        </div>
        <p className="poscard__sub">SY places the event in the model and hands it to Human Reliability to quantify. Click a row to edit it.</p>
        <table className="postable">
          <thead><tr><th>Task</th><th>System</th><th>Type</th><th>HR reference</th></tr></thead>
          <tbody>
            {sy.humanFailureEventIntegrations.map((h) => {
              return (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "hfe", id: h.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{h.taskDescription}</td>
                  <td>{shortOf(h.system)}</td>
                  <td>{h.hfeType === "PRE_INITIATOR" ? <Badge kind="warn">Pre-initiator</Badge> : <Badge kind="progress">Post-initiator</Badge>}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{h.hfeReference}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CcfScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy, editable, mutateSy, shortOf } = useSyWorkbook();
  const groups = sy.commonCauseFailureGroups;
  const intra = groups.filter((g) => g.scope === "INTRASYSTEM");
  const inter = groups.filter((g) => g.scope === "INTERSYSTEM");
  function addGroup(scope: "INTRASYSTEM" | "INTERSYSTEM"): void {
    if (!editable) return;
    const uuid = crypto.randomUUID();
    mutateSy((draft) => ({
      ...draft,
      commonCauseFailureGroups: [...draft.commonCauseFailureGroups, {
        uuid, name: "", description: "", scope, affectedComponents: [], affectedSystems: [draft.systemDefinitions[0]?.uuid ?? ""], modelType: "BETA_FACTOR",
        modelSpecificParameters: { betaFactorParameters: { beta: 0.05, totalFailureProbability: 0 } },
        members: { basicEvents: [] }, sharedCauseFactors: {}, implementsSrs: [{ sr: scope === "INTRASYSTEM" ? "SY-B1" : "SY-B2", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "ccf", id: uuid });
  }
  function GroupCard({ g }: { g: (typeof groups)[number] }): JSX.Element {
    const model = CCF_MODELS[g.modelType];
    const par = ccfParams(g);
    const affects = g.affectedSystems.filter((a) => a !== g.affectedSystems[0]);
    return (
      <div className="syccf__card" onClick={() => openDrawer({ kind: "ccf", id: g.uuid })}>
        <div className="syccf__head">
          <div className="syccf__head-main">
            <div className="syccf__name">{g.name.length > 0 ? g.name : "New group"}</div>
            <div className="syccf__scope">{g.scope === "INTRASYSTEM" ? "Within one system" : "Across systems"} · {model?.label ?? g.modelType}{par === null ? "" : ` · ${par.short}`}</div>
          </div>
        </div>
        <div className="syccf__members">
          {g.affectedComponents.map((m) => <span key={m} className="syccf__member">{m}</span>)}
        </div>
        <div className="syccf__basis">{g.description}</div>
        <div className="syccf__foot">
          <span className="syccf__da">{g.dataAnalysisCCFParameterRef ?? "—"}</span>
          {affects.length > 0 && <span className="syccf__affects">Couples {affects.map((a) => shortOf(a)).join(", ")}</span>}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Within a system" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B1</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addGroup("INTRASYSTEM")}><SYIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Redundant trains in one system that share a make, a crew or a room. Click a group to edit it.</p>
        <div className="syccf">{intra.map((g) => <GroupCard key={g.uuid} g={g} />)}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Across systems" level={3} />
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <SYProvenanceChip>SY-B2</SYProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => addGroup("INTERSYSTEM")}><SYIcon.Plus /> Add group</button>}
          </div>
        </div>
        <p className="poscard__sub">Shared parts and a shared software image that couple more than one system at once. Click a group to edit it.</p>
        <div className="syccf">{inter.map((g) => <GroupCard key={g.uuid} g={g} />)}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="SY" title="Consistency with the models and Data Analysis" level={3} />
          <SYProvenanceChip>SY-B4</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Each group probability derives from its parameters and must match the common cause event in the logic model.</p>
        <table className="postable">
          <thead><tr><th>Group</th><th>Parameters</th><th>Group probability</th><th>Model event</th><th>DA parameter</th><th>Status</th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const par = ccfParams(g);
              const check = ccfModelCheck(g, sy);
              return (
                <tr key={g.uuid}>
                  <td style={{ fontWeight: 600 }}>{g.name.length > 0 ? g.name : "New group"}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{par === null ? "—" : par.detail}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{check.expected === null ? "—" : toExp(check.expected)}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{check.eventId ?? "—"}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{g.dataAnalysisCCFParameterRef ?? "—"}</td>
                  <td><span className="sylight"><span className={`sylight__dot sylight__dot--${check.ok ? "s" : "f"}`} /> {check.ok ? "Consistent" : "Inconsistent"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export { ScopeScreen, ModelsScreen, FailuresScreen, CcfScreen, type SyDrawerContext };
