import { JSX, useMemo } from "react";
import { SYIcon } from "./syIcons";
import { Badge, SYProvenanceChip } from "./syShared";
import {
  CAPABILITY_CATEGORIES,
  SY_SYSTEM_META,
  SY_SAFETY_FUNCTIONS,
  FAILURE_MODE_TYPES,
  CCF_MODELS,
  SHARED_CAUSE_LABELS,
  SY_UPSTREAM_LINKS,
  SY_SIDEWAYS_LINKS,
  SY_DOWNSTREAM_LINKS,
  SY_LOGIC_MODELS,
  SY_SYSTEM_DOSSIERS,
  SY_SYSTEM_RESULTS,
  SY_SYSTEM_BREAKDOWN,
  MODELED_FAILURES,
  SCREENING_CRITERIA,
  UNAVAILABILITY,
  type Stage,
  type SyTreeNode,
  type SyGateNode,
  type SyBeNode,
} from "./syViewData";
import { ccScore } from "./sySelectors";
import { useSyWorkbook } from "./syWorkbookContext";

interface SyDrawerContext {
  kind: "system" | "ccf" | "hfe";
  id: string;
}

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = SYIcon[name] ?? SYIcon.Link;
  return <Icon />;
}

function safetyFnName(id: string): string {
  return SY_SAFETY_FUNCTIONS[id]?.name ?? id;
}

function UpstreamLinkBar(): JSX.Element {
  return (
    <div className="syup">
      {SY_UPSTREAM_LINKS.map((u) => (
        <div key={u.id} className="syup__card">
          <div className="syup__top">
            <span className="syup__badge"><NamedIcon name={u.icon} /></span>
            <div>
              <div className="syup__el">{u.element}</div>
              <div className="syup__wb">{u.workbook} · v{u.version}</div>
            </div>
          </div>
          <div className="syup__delivers">{u.delivers}. {u.note}</div>
          <div className="syup__foot">
            <span className="syup__status syup__status--approved"><SYIcon.Check /> Approved</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function InterfaceMap(): JSX.Element {
  const sideIn = SY_SIDEWAYS_LINKS.filter((s) => s.dir === "in");
  const sideOut = SY_SIDEWAYS_LINKS.filter((s) => s.dir === "out");
  return (
    <div className="syflow">
      <div className="syflow__col">
        <div className="syflow__col-head"><SYIcon.ArrowR /> Inputs</div>
        {SY_UPSTREAM_LINKS.map((u) => (
          <div key={u.id} className="syflow__node syflow__node--up">
            <span className="syflow__node-badge"><NamedIcon name={u.icon} /></span>
            <div className="syflow__node-body">
              <span className="syflow__node-el">{u.element}</span>
              <span className="syflow__node-use">{u.delivers}</span>
            </div>
            <span className="syflow__node-tag">{u.role}</span>
          </div>
        ))}
        {sideIn.map((n) => (
          <div key={n.id} className="syflow__node">
            <span className="syflow__node-badge"><NamedIcon name={n.icon} /></span>
            <div className="syflow__node-body">
              <span className="syflow__node-el">{n.element}</span>
              <span className="syflow__node-use">{n.uses}</span>
            </div>
            <span className="syflow__node-tag">{n.role}</span>
          </div>
        ))}
      </div>
      <div className="syflow__col">
        <div className="syflow__col-head">Outputs <SYIcon.ArrowR /></div>
        {[...sideOut, ...SY_DOWNSTREAM_LINKS].map((n) => (
          <div key={n.id} className="syflow__node">
            <span className="syflow__node-badge"><NamedIcon name={n.icon} /></span>
            <div className="syflow__node-body">
              <span className="syflow__node-el">{n.element}</span>
              <span className="syflow__node-use">{n.uses}</span>
            </div>
            <span className="syflow__node-tag">{n.role}</span>
          </div>
        ))}
      </div>
    </div>
  );
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
  const r = gh * 0.5;
  return (
    <g>
      <circle cx={cx} cy={T + r} r={r} className={`ftsym ftsym--be${node.ccf === true ? " ftsym--ccf" : ""}`} />
      {node.ccf === true && <circle cx={cx} cy={T + r} r={r - 3.5} className="ftsym ftsym--ccf-inner" />}
    </g>
  );
}

function FtBox({ node, cx, top, openDrawer }: { node: SyTreeNode; cx: number; top: number; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
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
    const meta = SY_SYSTEM_META[node.transfer];
    return (
      <div className="ftbox ftbox--tr" style={{ left, top, width: FT.NODE_W, minHeight: FT.NODE_H }} onClick={() => openDrawer({ kind: "system", id: node.transfer })}>
        <span className="ftbox__kind">Transfer</span>
        <span className="ftbox__name">{node.name}</span>
        {meta !== undefined && <span className="ftbox__to">To {meta.short} tree</span>}
      </div>
    );
  }
  const be = node as SyBeNode;
  const fm = FAILURE_MODE_TYPES[be.mode];
  return (
    <div className={`ftbox ftbox--be${be.ccf === true ? " ftbox--ccf" : ""}`} style={{ left, top, width: FT.NODE_W, minHeight: FT.NODE_H }}>
      <span className="ftbox__name">{be.name}</span>
      <span className="ftbox__be-meta">
        <span className="ftbox__id">{be.be}</span>
        <span className={`ftbox__fm ftbox__fm--${(fm?.short ?? "x").toLowerCase()}`}>{fm?.short ?? be.mode}</span>
        <span className="ftbox__prob">{be.prob}</span>
      </span>
    </div>
  );
}

function FaultTree({ systemId, openDrawer }: { systemId: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element | null {
  const lm = SY_LOGIC_MODELS[systemId];
  const layout = useMemo(() => (lm !== undefined ? computeFtLayout(lm.root) : null), [systemId, lm]);
  if (lm === undefined || layout === null) return null;
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
        {nodes.map((n) => <FtBox key={`${n.node.id}-box`} node={n.node} cx={n.cx} top={n.top} openDrawer={openDrawer} />)}
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

function LogicModelTree({ systemId, openDrawer }: { systemId: string; openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element | null {
  const lm = SY_LOGIC_MODELS[systemId];
  if (lm === undefined) return null;
  return (
    <div className="sytree">
      <FaultTree systemId={systemId} openDrawer={openDrawer} />
      <FtLegend />
      <div className="sytree__note"><SYIcon.Sparkle /><span>{lm.note}</span></div>
    </div>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onAction }: {
  ccId: string;
  setCcId: (id: string) => void;
  stage: Stage;
  setStage: (s: Stage) => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const { sy } = useSyWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const repById = useMemo(() => {
    const m = new Map<string, string>();
    for (const lm of sy.systemLogicModels) m.set(lm.systemReference, lm.modelRepresentation);
    return m;
  }, [sy.systemLogicModels]);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <SYProvenanceChip>Linked</SYProvenanceChip>
        </div>
        <p className="poscard__sub">ES names the functions and their systems, SC sets each top event, POS sets the alignments.</p>
        <UpstreamLinkBar />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          <span className="possubtle">Densest interface surface of any element</span>
        </div>
        <p className="poscard__sub">SY pulls parameters from DA, hands human events to HR, and delivers branch failure to ESQ.</p>
        <InterfaceMap />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Systems in scope</h3>
          <Badge kind="progress">{sy.systemDefinitions.length} systems</Badge>
        </div>
        <p className="poscard__sub">The recipe runs once per system. Frontline systems carry a logic model, support systems serve them.</p>
        <table className="postable">
          <thead><tr><th>System</th><th>Function</th><th>Model</th><th>Mission</th><th>Status</th></tr></thead>
          <tbody>
            {sy.systemDefinitions.map((s) => {
              const meta = SY_SYSTEM_META[s.uuid];
              return (
                <tr key={s.uuid}>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700 }}>
                      <span style={{ color: "var(--color-primary)", display: "inline-flex" }}><NamedIcon name={meta?.icon ?? "Settings"} /></span>
                      {s.name}
                      <span className="syk-kind">{meta?.kind === "support" ? "Support" : "Frontline"}</span>
                    </span>
                  </td>
                  <td>{meta !== undefined ? safetyFnName(meta.sf) : "—"}</td>
                  <td><span className="syk-rep">{repById.get(s.uuid) ?? "System-level"}</span></td>
                  <td className="posmono">{s.missionTimeHours !== undefined ? `${s.missionTimeHours} h` : "—"}</td>
                  <td>{meta?.status === "warn" ? <Badge kind="warn">Open item</Badge> : <Badge kind="ok">Modeled</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">System breakdown structure</h3>
          <SYProvenanceChip>Methodology report</SYProvenanceChip>
        </div>
        <p className="poscard__sub">How the systems are scoped, screened, selected and grouped for the analysis.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="syboundary">
            <div className="syboundary__head"><SYIcon.Target /> Scoping</div>
            <p className="possubtle" style={{ fontSize: 12.5, margin: "6px 0 0", lineHeight: 1.45 }}>{SY_SYSTEM_BREAKDOWN.scoping}</p>
          </div>
          <div className="syboundary">
            <div className="syboundary__head"><SYIcon.Sparkle /> Screening</div>
            <p className="possubtle" style={{ fontSize: 12.5, margin: "6px 0 0", lineHeight: 1.45 }}>{SY_SYSTEM_BREAKDOWN.screeningCriterion}</p>
          </div>
          <div className="syboundary">
            <div className="syboundary__head"><SYIcon.Cube /> Selected for detailed analysis</div>
            <div className="syboundary__list" style={{ marginTop: 8 }}>
              {SY_SYSTEM_BREAKDOWN.selected.map((id) => <span key={id} className="syboundary__tag">{SY_SYSTEM_META[id]?.short ?? id}</span>)}
            </div>
            <div className="syboundary__support">
              <span className="syboundary__support-k">System level only</span>
              {SY_SYSTEM_BREAKDOWN.systemLevel.map((id) => <span key={id} className="poschip">{SY_SYSTEM_META[id]?.short ?? id}</span>)}
            </div>
          </div>
          <div className="syboundary">
            <div className="syboundary__head"><SYIcon.Group /> Grouping</div>
            <p className="possubtle" style={{ fontSize: 12.5, margin: "6px 0 0", lineHeight: 1.45 }}>{SY_SYSTEM_BREAKDOWN.grouping}</p>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Screened models where justified, or detailed models for risk-significant systems.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            const score = ccScore(sy, c.id, stage);
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
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
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">SY has the heaviest pre-operational fork, since it leans most on walkdowns and operating practice.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Models rest on design information, with ten pre-operational SRs logging the gaps."],
            ["operational", "Operational", "Walkdowns and maintenance history confirm the models and close the design-gap SRs."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="sy-stage" value={val} checked={stage === val} onChange={() => { setStage(val); onAction(`Plant stage set to ${title}`); }} />
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
  const { sy } = useSyWorkbook();
  const sysDef = sy.systemDefinitions.find((s) => s.uuid === sysId) ?? sy.systemDefinitions[0];
  const meta = SY_SYSTEM_META[sysDef.uuid];
  const logic = sy.systemLogicModels.find((m) => m.systemReference === sysDef.uuid);
  const hasTree = SY_LOGIC_MODELS[sysDef.uuid] !== undefined;
  const dossier = SY_SYSTEM_DOSSIERS[sysDef.uuid];
  const results = SY_SYSTEM_RESULTS[sysDef.uuid];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">System</h3>
          <span className="possubtle">{sy.systemDefinitions.length} systems · SY-A1, A7, A8</span>
        </div>
        <p className="poscard__sub">Pick a system to see its boundary, alignments and logic model.</p>
        <div className="posrow posrow--wrap" style={{ gap: 6 }}>
          {sy.systemDefinitions.map((s) => (
            <button key={s.uuid} type="button" className={`poschip${sysId === s.uuid ? " poschip--primary" : ""}`} onClick={() => setSysId(s.uuid)}>
              {SY_SYSTEM_META[s.uuid]?.short ?? s.name}
            </button>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
            <span style={{ color: "var(--color-primary)", display: "inline-flex" }}><NamedIcon name={meta?.icon ?? "Settings"} /></span>
            {sysDef.name}
          </h3>
          {meta?.status === "warn" ? <Badge kind="warn">Open item</Badge> : <Badge kind="ok">Modeled</Badge>}
        </div>
        <div className="sytop">
          <span className="sytop__icon"><SYIcon.Target /></span>
          <div>
            <div className="sytop__cap">Top event</div>
            <div className="sytop__text">{sysDef.description ?? sysDef.name}</div>
            {meta !== undefined && <div className="sytop__crit">Success criterion. {meta.criterion}</div>}
          </div>
        </div>
        <div className="syfacts">
          <div className="syfacts__cell"><span className="syfacts__k">Function</span><span className="syfacts__v">{meta !== undefined ? safetyFnName(meta.sf) : "—"}</span></div>
          <div className="syfacts__cell"><span className="syfacts__k">Representation</span><span className="syfacts__v">{logic?.modelRepresentation ?? "System-level"}</span></div>
          <div className="syfacts__cell"><span className="syfacts__k">Mission time</span><span className="syfacts__v posmono">{sysDef.missionTimeHours !== undefined ? `${sysDef.missionTimeHours} h` : "—"}</span></div>
          <div className="syfacts__cell"><span className="syfacts__k">Alignments</span><span className="syfacts__v">{meta?.alignments ?? 1} modeled</span></div>
          <div className="syfacts__cell"><span className="syfacts__k">Components</span><span className="syfacts__v posmono">{meta?.components ?? "—"}</span></div>
          <div className="syfacts__cell"><span className="syfacts__k">Basic events</span><span className="syfacts__v posmono">{logic?.basicEvents.length ?? meta?.basicEvents ?? 0}</span></div>
        </div>
        <div className="syboundary">
          <div className="syboundary__head"><SYIcon.Cube /> Model boundary (SY-A8)</div>
          <div className="syboundary__list">
            {sysDef.boundaries.map((b, i) => <span key={i} className="syboundary__tag">{b}</span>)}
          </div>
          {meta !== undefined && meta.supportNeeds.length > 0 && (
            <div className="syboundary__support">
              <span className="syboundary__support-k">Support interfaces</span>
              {meta.supportNeeds.map((id) => <span key={id} className="poschip">{SY_SYSTEM_META[id]?.short ?? id}</span>)}
            </div>
          )}
          {meta?.detailed === false && (
            <div className="eswarn" style={{ marginTop: 10 }}><span className="eswarn__icon"><SYIcon.Sparkle /></span><span>System-level model (SY-A9). {meta.detailNote}</span></div>
          )}
        </div>
      </div>

      {dossier !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">System dossier</h3>
            <SYProvenanceChip>Per-system report</SYProvenanceChip>
          </div>
          <p className="poscard__sub">The descriptive information the per-system report carries alongside the logic model.</p>
          <div className="syfacts">
            <div className="syfacts__cell"><span className="syfacts__k">Safety classification</span><span className="syfacts__v">{dossier.safetyClass}</span></div>
            <div className="syfacts__cell"><span className="syfacts__k">Defense in depth</span><span className="syfacts__v">{dossier.defenseInDepth}</span></div>
            <div className="syfacts__cell"><span className="syfacts__k">Technical specifications</span><span className="syfacts__v">{dossier.techSpecs}</span></div>
            <div className="syfacts__cell"><span className="syfacts__k">Operating history</span><span className="syfacts__v">{dossier.operatingHistory}</span></div>
          </div>
          <div className="syboundary" style={{ marginTop: 12 }}>
            <div className="syboundary__head"><SYIcon.Settings /> Function and operation</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.45 }}><strong style={{ color: "var(--color-text)" }}>Normal.</strong> {dossier.operation.normal}</div>
              <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.45 }}><strong style={{ color: "var(--color-text)" }}>Abnormal.</strong> {dossier.operation.abnormal}</div>
              <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.45 }}><strong style={{ color: "var(--color-text)" }}>Emergency.</strong> {dossier.operation.emergency}</div>
            </div>
            <div className="syboundary__support">
              <span className="syboundary__support-k">Operating procedures</span>
              {dossier.procedures.map((p, i) => <span key={i} className="poschip">{p}</span>)}
            </div>
          </div>
          <p className="possubtle" style={{ fontSize: 12, marginTop: 10, marginBottom: 0, lineHeight: 1.45 }}>
            <strong style={{ color: "var(--color-text)" }}>Initiating-event contribution.</strong> {dossier.ieContribution}
          </p>
        </div>
      )}

      {results !== undefined && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Model results · {meta?.short ?? sysDef.name}</h3>
            <SYProvenanceChip>Per-system quantification</SYProvenanceChip>
          </div>
          <p className="poscard__sub">The system fault tree quantified on its own, separate from the full-plant quantification that ESQ performs.</p>
          <div className="syfacts">
            <div className="syfacts__cell"><span className="syfacts__k">Unavailability</span><span className="syfacts__v posmono">{results.unavailability}</span></div>
            <div className="syfacts__cell"><span className="syfacts__k">5th percentile</span><span className="syfacts__v posmono">{results.p5}</span></div>
            <div className="syfacts__cell"><span className="syfacts__k">95th percentile</span><span className="syfacts__v posmono">{results.p95}</span></div>
          </div>
          <div className="essec" style={{ marginTop: 12 }}>Minimal cut sets</div>
          <table className="postable" style={{ marginTop: 6 }}>
            <thead><tr><th>Rank</th><th>Events</th><th style={{ textAlign: "right" }}>Probability</th></tr></thead>
            <tbody>
              {results.cutSets.map((c) => (
                <tr key={c.rank}>
                  <td className="posmono" style={{ whiteSpace: "nowrap" }}>MCS-{c.rank}</td>
                  <td><div className="posrow posrow--wrap" style={{ gap: 5 }}>{c.events.map((e, j) => <span key={j} className="poschip posmono" style={{ fontSize: 11 }}>{e}</span>)}</div></td>
                  <td style={{ textAlign: "right" }}><span className="posmono">{c.prob}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="essec" style={{ marginTop: 12 }}>Importance measures</div>
          <table className="postable" style={{ marginTop: 6 }}>
            <thead><tr><th>Contributor</th><th style={{ textAlign: "right" }}>Fussell-Vesely</th><th style={{ textAlign: "right" }}>RAW</th></tr></thead>
            <tbody>
              {results.importance.map((im, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{im.item}</td>
                  <td style={{ textAlign: "right" }}><span className="posmono">{im.fv.toFixed(2)}</span></td>
                  <td style={{ textAlign: "right" }}><span className="posmono">{im.raw}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasTree ? (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Logic model · {meta?.short ?? sysDef.name}</h3>
            <SYProvenanceChip>SY-A7 · SY-A14</SYProvenanceChip>
          </div>
          <p className="poscard__sub">The fault tree is a common representation of the system logic model, and other representations could be used. Pick another system above to see its tree.</p>
          <LogicModelTree systemId={sysDef.uuid} openDrawer={openDrawer} />
        </div>
      ) : (
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Logic model · {meta?.short ?? sysDef.name}</h3></div>
          <div className="eswarn"><span className="eswarn__icon"><SYIcon.Sparkle /></span><span>Modeled at the system level, so no decomposed fault tree is built (SY-A9).</span></div>
        </div>
      )}
    </>
  );
}

function FailuresScreen({ openDrawer }: { openDrawer: (ctx: SyDrawerContext) => void }): JSX.Element {
  const { sy } = useSyWorkbook();
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">What goes in the model</h3>
          <span className="possubtle">SY-A16, A17, A18</span>
        </div>
        <p className="poscard__sub">Include the failures that defeat the criterion, leave out the ones that help it, and model diversion paths.</p>
        <div className="syfail">
          {MODELED_FAILURES.map((m) => {
            const meta = SY_SYSTEM_META[m.system];
            const def = sy.systemDefinitions.find((s) => s.uuid === m.system);
            return (
              <div key={m.id} className="syfail__card">
                <div className="syfail__head">
                  <span className="syfail__sys">{meta?.short ?? m.system}</span>
                  <span className="syfail__sysname">{def?.name ?? ""}</span>
                </div>
                <div className="syfail__row syfail__row--in">
                  <span className="syfail__row-k"><SYIcon.Check /> Included</span>
                  <span className="syfail__chips">{m.included.map((x, i) => <span key={i} className="syfail__chip">{x}</span>)}</span>
                </div>
                <div className="syfail__row syfail__row--out">
                  <span className="syfail__row-k"><SYIcon.Close /> Left out</span>
                  <span className="syfail__out-text">{m.excludedMode}</span>
                </div>
                {m.flowDiversion !== null && (
                  <div className="syfail__div"><SYIcon.Pipe /><span>{m.flowDiversion}</span></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening</h3>
          <SYProvenanceChip>SY-A20</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Unlike success criteria, SY allows screening, but only against stated criteria.</p>
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
              const meta = SY_SYSTEM_META[c.systemReference];
              return (
                <tr key={c.uuid}>
                  <td style={{ fontWeight: 600 }}>{c.componentId}</td>
                  <td>{meta?.short ?? c.systemReference}</td>
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
          <h3 className="poscard__title">Out-of-service unavailability</h3>
          <span className="possubtle">SY-A25, A26, A27</span>
        </div>
        <p className="poscard__sub">Model unavailability per the actual maintenance practice, or an assumed basis before operation.</p>
        <div className="syua">
          {UNAVAILABILITY.map((u) => {
            const meta = SY_SYSTEM_META[u.system];
            return (
              <div key={u.id} className={`syua__row${u.preop ? " syua__row--preop" : ""}`}>
                <div className="syua__main">
                  <div className="syua__item">{u.item}</div>
                  <div className="syua__basis">{u.basis} {u.note}</div>
                </div>
                <div className="syua__tags">
                  <span className="syua__type">{u.type}</span>
                  <span className="possubtle posmono" style={{ fontSize: 10.5 }}>{meta?.short ?? u.system}</span>
                  {u.preop && <span className="poschip poschip--preop"><SYIcon.Warn /> Pre-op</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Human failure events placed in the models</h3>
          <SYProvenanceChip>SY-A21 · SY-A23</SYProvenanceChip>
        </div>
        <p className="poscard__sub">SY places the event in the model and hands it to Human Reliability to quantify.</p>
        <table className="postable">
          <thead><tr><th>Task</th><th>System</th><th>Type</th><th>HR reference</th></tr></thead>
          <tbody>
            {sy.humanFailureEventIntegrations.map((h) => {
              const meta = SY_SYSTEM_META[h.system];
              return (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "hfe", id: h.uuid })} style={{ cursor: "pointer" }}>
                  <td style={{ fontWeight: 600 }}>{h.taskDescription}</td>
                  <td>{meta?.short ?? h.system}</td>
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
  const { sy } = useSyWorkbook();
  const groups = sy.commonCauseFailureGroups;
  const intra = groups.filter((g) => g.scope === "INTRASYSTEM");
  const inter = groups.filter((g) => g.scope === "INTERSYSTEM");
  function GroupCard({ g }: { g: (typeof groups)[number] }): JSX.Element {
    const model = CCF_MODELS[g.modelType];
    const warn = (g.riskSignificanceJustification ?? "").startsWith("Open");
    const shared = g.sharedCauseFactors ?? {};
    const sharedKeys = Object.keys(shared).filter((k) => shared[k as keyof typeof shared] === true);
    const otherList = Array.isArray(shared.otherFactors) ? shared.otherFactors : [];
    const affects = g.affectedSystems.filter((a) => a !== g.affectedSystems[0]);
    return (
      <div className={`syccf__card${warn ? " syccf__card--warn" : ""}`} onClick={() => openDrawer({ kind: "ccf", id: g.uuid })}>
        <div className="syccf__head">
          <span className="syccf__icon"><SYIcon.Group /></span>
          <div className="syccf__head-main">
            <div className="syccf__name">{g.name}</div>
            <div className="syccf__scope">{g.scope === "INTRASYSTEM" ? "Within one system" : "Across systems"} · {model?.label ?? g.modelType}</div>
          </div>
          {warn ? <Badge kind="warn">Open</Badge> : <Badge kind="ok">Set</Badge>}
        </div>
        <div className="syccf__members">
          {g.affectedComponents.map((m) => <span key={m} className="syccf__member">{m}</span>)}
        </div>
        <div className="syccf__shared">
          {sharedKeys.map((s) => <span key={s} className="syccf__shared-tag">{SHARED_CAUSE_LABELS[s] ?? s}</span>)}
          {otherList.map((s) => <span key={s} className="syccf__shared-tag">{s}</span>)}
        </div>
        <div className="syccf__basis">{g.description}</div>
        <div className="syccf__foot">
          <span className="syccf__da"><SYIcon.Link /> {g.dataAnalysisCCFParameterRef ?? "—"}</span>
          {affects.length > 0 && <span className="syccf__affects">Couples {affects.map((a) => SY_SYSTEM_META[a]?.short ?? a).join(", ")}</span>}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Common cause failure</h3>
          <span className="possubtle">{groups.length} groups · SY-B1 to B4</span>
        </div>
        <p className="poscard__sub">Redundancy on paper is not redundancy in reality, so the model couples components that can fail together.</p>
        <div className="syccf__banner">
          <span className="syccf__banner-icon"><SYIcon.Group /></span>
          <span>A common cause failure group is a claim that these components can fail together from a shared cause.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Within a system</h3>
          <SYProvenanceChip>SY-B1</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Redundant trains in one system that share a make, a crew or a room.</p>
        <div className="syccf">{intra.map((g) => <GroupCard key={g.uuid} g={g} />)}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Across systems</h3>
          <SYProvenanceChip>SY-B2</SYProvenanceChip>
        </div>
        <p className="poscard__sub">Shared parts and a shared software image that couple more than one system at once.</p>
        <div className="syccf">{inter.map((g) => <GroupCard key={g.uuid} g={g} />)}</div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consistency with Data Analysis</h3>
          <SYProvenanceChip>SY-B4</SYProvenanceChip>
        </div>
        <p className="poscard__sub">The group structure and the parameters must match the common cause model Data Analysis uses.</p>
        <table className="postable">
          <thead><tr><th>Group</th><th>Model</th><th>DA parameter</th><th>Status</th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const warn = (g.riskSignificanceJustification ?? "").startsWith("Open");
              return (
                <tr key={g.uuid}>
                  <td style={{ fontWeight: 600 }}>{g.name}</td>
                  <td>{CCF_MODELS[g.modelType]?.label ?? g.modelType}</td>
                  <td className="posmono" style={{ fontSize: 11 }}>{g.dataAnalysisCCFParameterRef ?? "—"}</td>
                  <td>{warn ? <Badge kind="warn">Pending</Badge> : <Badge kind="ok">Consistent</Badge>}</td>
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
