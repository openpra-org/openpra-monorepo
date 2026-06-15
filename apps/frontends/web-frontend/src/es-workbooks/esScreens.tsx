import { Fragment, JSX, ReactNode, useEffect, useMemo, useState } from "react";
import { ESIcon } from "./esIcons";
import { Badge, ESProvenanceChip, fmtImportance } from "./esShared";
import {
  CAPABILITY_CATEGORIES,
  ES_END_STATES,
  ES_RELEASE_CATEGORIES,
  ES_TIMELINE,
  FEASIBILITY_CRITERIA,
  ES_OPERATOR_ACTIONS,
  ES_PHENOMENA,
  ES_SOURCE_CATALOG,
  ES_SAFETY_FUNCTION_CATALOG,
  ES_REPRESENTATIONS,
  ES_DEPENDENCY_TYPES,
  ES_SCREENING_LABELS,
  ES_LBE_CLASSES,
  ES_LICENSING_BASIS_EVENTS,
  feActor,
  ES_FE_ACTOR_META,
  type Stage,
  type CapabilityCategory,
} from "./esViewData";
import { useEsWorkbook } from "./esWorkbookContext";
import {
  eventTreesView,
  coverageView,
  familiesView,
  releaseMappingsView,
  screeningView,
  dependenciesView,
  sequencesView,
  type EventTreeView,
  type TreeNodeView,
  type SeqLeafRef,
  type DependencyView,
  type CcScore,
} from "./esSelectors";
import { generateEsReport } from "./esDocx";
import { WorkbookUpstreamBar, WorkbookInterfaceMap } from "../workbooks/workbookInterfaces";
import "./css/esScreens.css";

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = ESIcon[name] ?? ESIcon.Link;
  return <Icon />;
}

function fmtExp(n: number | undefined): string {
  return n === undefined ? "—" : n.toExponential(1);
}

function rcTone(rc: string | undefined): "block" | "warn" | "ok" {
  const found = ES_RELEASE_CATEGORIES.find((r) => r.id === rc);
  if (found === undefined) return "ok";
  return found.tone === "block" ? "block" : found.tone === "ok" ? "ok" : "warn";
}

function EsEmpty({ title, hint }: { title: string; hint: string }): JSX.Element {
  return (
    <div className="esempty">
      <ESIcon.Tree />
      <div className="esempty__title">{title}</div>
      <div className="esempty__hint">{hint}</div>
    </div>
  );
}

function ESQDeferBanner({ title, children }: { title: string; children?: ReactNode }): JSX.Element {
  return (
    <div className="esdefer">
      <span className="esdefer__icon"><ESIcon.Clock /></span>
      <div className="esdefer__body">
        <div className="esdefer__title">{title}</div>
        {children !== undefined && <div className="esdefer__sub">{children}</div>}
      </div>
      <span className="esdefer__link">Go to ESQ <ESIcon.ArrowR /></span>
    </div>
  );
}

function collectSeqs(node: TreeNodeView | SeqLeafRef): string[] {
  if ("seq" in node) return node.seq.length > 0 ? [node.seq] : [];
  return [...collectSeqs(node.S), ...collectSeqs(node.F)];
}

interface Seg { x1: number; y1: number; x2: number; y2: number; seqs: string[]; }
interface Dot { x: number; y: number; }
interface BranchLab { x: number; y: number; key: "S" | "F"; }
interface Leaf { seq: string; y: number; }
interface Layout {
  segs: Seg[];
  dots: Dot[];
  branchLabs: BranchLab[];
  leaves: Leaf[];
  xCol: (c: number) => number;
  xEnd: number;
  rootY: number;
  width: number;
  height: number;
}

function layoutTree(view: EventTreeView): Layout {
  const COL_W = 152;
  const ROW_H = 58;
  const LEFT = 112;
  const TOP = 98;
  const PANEL = 224;
  const PAD_R = 18;
  const numCols = view.functionalEvents.length;
  const xCol = (c: number): number => LEFT + c * COL_W;
  const xEnd = LEFT + numCols * COL_W;
  const segs: Seg[] = [];
  const dots: Dot[] = [];
  const branchLabs: BranchLab[] = [];
  const leaves: Leaf[] = [];
  const yOf = new Map<TreeNodeView, number>();
  const leafY = new Map<string, number>();
  let row = 0;
  function assign(node: TreeNodeView | SeqLeafRef): number {
    if ("seq" in node) {
      const y = TOP + (row + 0.5) * ROW_H;
      row++;
      leaves.push({ seq: node.seq, y });
      leafY.set(node.seq, y);
      return y;
    }
    const sy = assign(node.S);
    const fy = assign(node.F);
    const y = (sy + fy) / 2;
    yOf.set(node, y);
    return y;
  }
  const rootY = assign(view.node);
  function yOfChild(child: TreeNodeView | SeqLeafRef): number {
    return "seq" in child ? (leafY.get(child.seq) ?? 0) : (yOf.get(child) ?? 0);
  }
  function draw(node: TreeNodeView, enterX: number, nodeY: number): void {
    const nx = xCol(node.fe);
    const here = collectSeqs(node);
    segs.push({ x1: enterX, y1: nodeY, x2: nx, y2: nodeY, seqs: here });
    const sy = yOfChild(node.S);
    const fy = yOfChild(node.F);
    segs.push({ x1: nx, y1: sy, x2: nx, y2: fy, seqs: here });
    dots.push({ x: nx, y: nodeY });
    const kids: [("S" | "F"), TreeNodeView | SeqLeafRef, number][] = [["S", node.S, sy], ["F", node.F, fy]];
    for (const [key, child, cy] of kids) {
      branchLabs.push({ x: nx + 6, y: cy + (key === "S" ? -6 : 14), key });
      if ("seq" in child) segs.push({ x1: nx, y1: cy, x2: xEnd, y2: cy, seqs: child.seq.length > 0 ? [child.seq] : [] });
      else draw(child, nx, cy);
    }
  }
  if (!("seq" in view.node)) draw(view.node, LEFT - 58, rootY);
  return { segs, dots, branchLabs, leaves, xCol, xEnd, rootY, width: xEnd + PANEL + PAD_R, height: TOP + leaves.length * ROW_H + 20 };
}

function EventTreeDiagram({ view, showFreq, activeSeq, onHover, onSelect }: {
  view: EventTreeView;
  showFreq: boolean;
  activeSeq: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  const L = useMemo(() => layoutTree(view), [view]);
  const seqLeaf = new Map(view.sequences.map((s) => [s.id, s] as const));
  const isHot = (seqs: string[]): boolean => activeSeq !== null && seqs.includes(activeSeq);
  return (
    <div className="estree__scroll">
      <div className="estree__canvas" style={{ width: L.width, height: L.height }}>
        {view.functionalEvents.map((fe, c) => (
          <div key={fe.id} className="estree__head" style={{ left: L.xCol(c) }}>
            <div className="estree__head-bar" />
            <div className="estree__head-fe">FE{c + 1}</div>
            <div className="estree__head-label">{fe.label}</div>
            <div className="estree__head-sub">{fe.sub}</div>
            {fe.scId !== undefined && <span className="estree__head-sc">{fe.scId}</span>}
          </div>
        ))}
        <div className="estree__ie" style={{ top: L.rootY }}>
          <div className="estree__ie-cap">Initiator</div>
          <div className="estree__ie-id">{view.initiatingEventId}</div>
          {showFreq && view.ieFreq !== undefined && <div className="estree__ie-freq">{fmtExp(view.ieFreq)}/yr</div>}
        </div>
        <svg className="estree__svg" width={L.width} height={L.height}>
          {L.segs.map((s, i) => (
            <line key={i} className={`estree__seg${isHot(s.seqs) ? " estree__seg--hot" : ""}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
          ))}
          {L.dots.map((d, i) => (<circle key={i} className="estree__node-dot" cx={d.x} cy={d.y} r="3.4" />))}
          {L.branchLabs.map((b, i) => (<text key={i} className={`estree__branch-lab estree__branch-lab--${b.key.toLowerCase()}`} x={b.x} y={b.y}>{b.key}</text>))}
        </svg>
        {L.leaves.map((leaf) => {
          const s = seqLeaf.get(leaf.seq);
          if (s === undefined) return null;
          const tone = s.endState === "SUCCESSFUL_MITIGATION" ? "ok" : "block";
          const rcLabel = s.releaseCategoryId === undefined ? "Safe state" : s.releaseCategoryId;
          return (
            <button key={s.id} type="button" className={`estree__seq${activeSeq === s.id ? " estree__seq--active" : ""}`}
              style={{ left: L.xEnd + 6, top: leaf.y }}
              onMouseEnter={() => onHover(s.id)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(s.id)}>
              <span className={`estree__seq-end estree__seq-end--${tone}`} />
              <span className="estree__seq-main">
                <span className="estree__seq-id">{s.id}</span>
                <span className="estree__seq-rc"> · {rcLabel}</span>
              </span>
              {showFreq && <span className="estree__seq-freq">{fmtExp(s.meanFrequency)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EsdBox { x: number; y: number; feIndex: number; seqs: string[]; }
interface EsdLink { startX: number; startY: number; midX: number; endX: number; endY: number; kind: "S" | "F"; seqs: string[]; }
interface EsdLabel { x: number; y: number; kind: "S" | "F"; }
interface EsdPill { seq: string; y: number; }
interface EsdLayout { boxes: EsdBox[]; links: EsdLink[]; labels: EsdLabel[]; pills: EsdPill[]; ieY: number; xEnd: number; boxW: number; width: number; height: number; }

function layoutESD(view: EventTreeView): EsdLayout {
  const COLW = 172;
  const ROWH = 82;
  const LEFT = 92;
  const BOXW = 124;
  const TOP = 40;
  const PILLW = 150;
  const PAD = 26;
  const numCols = view.functionalEvents.length;
  const cx = (fe: number): number => LEFT + 78 + fe * COLW;
  const xEnd = LEFT + 78 + numCols * COLW;
  const leaves: { seq: string; y: number }[] = [];
  const leafY = new Map<string, number>();
  const yOf = new Map<TreeNodeView, number>();
  let row = 0;
  function assign(n: TreeNodeView | SeqLeafRef): number {
    if ("seq" in n) {
      const y = TOP + (row + 0.5) * ROWH;
      row++;
      leaves.push({ seq: n.seq, y });
      leafY.set(n.seq, y);
      return y;
    }
    const sy = assign(n.S);
    const fy = assign(n.F);
    const y = (sy + fy) / 2;
    yOf.set(n, y);
    return y;
  }
  const ieY = assign(view.node);
  const boxes: EsdBox[] = [];
  const links: EsdLink[] = [];
  const labels: EsdLabel[] = [];
  const pills: EsdPill[] = [];
  function yOfChild(child: TreeNodeView | SeqLeafRef): number {
    return "seq" in child ? (leafY.get(child.seq) ?? 0) : (yOf.get(child) ?? 0);
  }
  function walk(node: TreeNodeView, nodeY: number): void {
    const bx = cx(node.fe);
    boxes.push({ x: bx, y: nodeY, feIndex: node.fe, seqs: collectSeqs(node) });
    const kids: [("S" | "F"), TreeNodeView | SeqLeafRef][] = [["S", node.S], ["F", node.F]];
    for (const [k, ch] of kids) {
      const startX = bx + BOXW / 2;
      const startY = nodeY;
      const cs = collectSeqs(ch);
      const endY = yOfChild(ch);
      let endX: number;
      if ("seq" in ch) {
        endX = xEnd;
        if (ch.seq.length > 0) pills.push({ seq: ch.seq, y: endY });
      } else {
        endX = cx(ch.fe) - BOXW / 2;
      }
      const midX = startX + (endX - startX) * 0.5;
      links.push({ startX, startY, midX, endX, endY, kind: k, seqs: cs });
      labels.push({ x: startX + 9, y: startY + (endY < startY ? -7 : 15), kind: k });
      if (!("seq" in ch)) walk(ch, endY);
    }
  }
  if (!("seq" in view.node)) walk(view.node, ieY);
  return { boxes, links, labels, pills, ieY, xEnd, boxW: BOXW, width: xEnd + PILLW + PAD, height: TOP + leaves.length * ROWH + 18 };
}

function EventSeqDiagram({ view, showFreq, activeSeq, onHover, onSelect }: {
  view: EventTreeView;
  showFreq: boolean;
  activeSeq: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  const L = useMemo(() => layoutESD(view), [view]);
  const seqLeaf = new Map(view.sequences.map((s) => [s.id, s] as const));
  const isHot = (seqs: string[]): boolean => activeSeq !== null && seqs.includes(activeSeq);
  return (
    <div className="estree__scroll">
      <div className="esdg" style={{ width: L.width, height: L.height }}>
        <svg className="estree__svg" width={L.width} height={L.height}>
          <defs>
            <marker id="esdg-s" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--c-complete)" /></marker>
            <marker id="esdg-f" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#c44d4d" /></marker>
          </defs>
          {L.links.map((l, i) => (
            <path key={i} className={`esdg__link esdg__link--${l.kind.toLowerCase()}${isHot(l.seqs) ? " esdg__link--hot" : ""}`}
              d={`M ${l.startX} ${l.startY} H ${l.midX} V ${l.endY} H ${l.endX}`} markerEnd={`url(#esdg-${l.kind.toLowerCase()})`} />
          ))}
          {L.labels.map((b, i) => (
            <text key={i} className={`estree__branch-lab estree__branch-lab--${b.kind.toLowerCase()}`} x={b.x} y={b.y}>{b.kind}</text>
          ))}
        </svg>
        <div className="esdg__ie" style={{ left: 6, top: L.ieY }}>
          <div className="esdg__ie-cap">Initiator</div>
          <div className="esdg__ie-id">{view.initiatingEventId}</div>
        </div>
        {L.boxes.map((b, i) => {
          const fe = view.functionalEvents[b.feIndex];
          const actor = fe !== undefined ? feActor(fe.id) : "auto";
          return (
            <div key={i} className={`esdg__box esdg__box--${actor}${isHot(b.seqs) ? " esdg__box--hot" : ""}`} style={{ left: b.x, top: b.y, width: L.boxW }}>
              <div className="esdg__box-fe">{fe?.id}</div>
              <div className="esdg__box-label">{fe?.label}?</div>
              <div className="esdg__box-actor">{ES_FE_ACTOR_META[actor].short}</div>
            </div>
          );
        })}
        {L.pills.map((p) => {
          const s = seqLeaf.get(p.seq);
          if (s === undefined) return null;
          const tone = s.endState === "SUCCESSFUL_MITIGATION" ? "ok" : "block";
          return (
            <button key={p.seq} type="button" className={`esdg__end esdg__end--${tone}${activeSeq === s.id ? " esdg__end--active" : ""}`}
              style={{ left: L.xEnd + 6, top: p.y }}
              onMouseEnter={() => onHover(s.id)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(s.id)}>
              <span className={`estree__seq-end estree__seq-end--${tone}`} />
              <span className="esdg__end-main">
                <span className="esdg__end-id">{s.id}</span>
                <span className="esdg__end-rc">{s.endState === "SUCCESSFUL_MITIGATION" ? "Safe state" : s.releaseCategoryId}</span>
              </span>
              {showFreq && <span className="esdg__end-freq">{fmtExp(s.meanFrequency)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type DrawerCtx = { kind: "sequence"; id: string } | { kind: "dependency"; id: string };

function SequenceDrawerBody({ seqId, trees, deps, onClose }: { seqId: string; trees: EventTreeView[]; deps: DependencyView[]; onClose: () => void }): JSX.Element | null {
  const found = trees.flatMap((t) => t.sequences.map((s) => ({ s, t }))).find((x) => x.s.id === seqId);
  if (found === undefined) return null;
  const { s, t } = found;
  const imp = fmtImportance(s.importance);
  const relatedDeps = deps.filter((d) => d.initiatingEvents.includes(t.initiatingEventId));
  const isOk = s.endState === "SUCCESSFUL_MITIGATION";
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Event sequence · {s.id}</div>
          <h2 className="posdrawer__title">{t.name}</h2>
          <div className="posdrawer__sub">{t.initiatingEventId}{t.plantOperatingStateId !== undefined ? ` · ${t.plantOperatingStateId}` : ""}{t.missionTime !== undefined ? ` · mission time ${t.missionTime} ${t.missionTimeUnits ?? ""}` : ""}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Sequence path</h3>
            {isOk ? <Badge kind="ok">Safe stable state</Badge> : <Badge kind="block">Release · {s.releaseCategoryId}</Badge>}
          </div>
          <div className="espath">
            <div className="espath__node"><span className="espath__node-fe">{t.initiatingEventId}</span><span className="espath__node-state" style={{ color: "var(--color-primary)" }}>IE</span></div>
            {t.functionalEvents.map((fe) => {
              const st = s.path[fe.id];
              if (st === undefined) return null;
              return (
                <Fragment key={fe.id}>
                  <span className="espath__arrow"><ESIcon.ArrowR /></span>
                  <div className={`espath__node espath__node--${st === "SUCCESS" ? "s" : "f"}`}>
                    <span className="espath__node-fe">{fe.id}</span>
                    <span className="espath__node-state">{st === "SUCCESS" ? "Success" : "Failure"}</span>
                  </div>
                </Fragment>
              );
            })}
            <span className="espath__arrow"><ESIcon.ArrowR /></span>
            <span className={`espath__end espath__end--${isOk ? "ok" : "block"}`}>
              {isOk ? <><ESIcon.Check /> Safe state</> : <><ESIcon.Radiation /> {s.releaseCategoryId}</>}
            </span>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Outcome</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Risk importance</label><div>{imp.label === "—" ? <span className="possubtle">—</span> : <Badge kind={imp.kind}>{imp.label}</Badge>}</div></div>
            <div className="posfield"><label className="posfield__label">End state</label><div>{isOk ? "Safe stable state" : "Radionuclide release"}</div></div>
            <div className="posfield"><label className="posfield__label">Release category</label><div>{s.releaseCategoryId === undefined ? "None (no release)" : s.releaseCategoryId}</div></div>
            {s.familyId !== undefined && <div className="posfield"><label className="posfield__label">Sequence family</label><div className="posrow" style={{ gap: 8 }}><span className="poschip poschip--primary">{s.familyId}</span></div></div>}
          </div>
          <div className="eswarn"><span className="eswarn__icon"><ESIcon.Clock /></span><span>Sequence frequency is quantified downstream in Event Sequence Quantification (ESQ), not here.</span></div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Dependencies in this tree</h3><Badge kind="progress">{relatedDeps.length}</Badge></div>
          {relatedDeps.length > 0 ? (
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {relatedDeps.map((d) => <span key={d.id} className="poschip">{d.id} · {ES_DEPENDENCY_TYPES[d.type]?.label ?? d.type}</span>)}
            </div>
          ) : <p className="possubtle" style={{ margin: 0 }}>No dependencies modelled in this tree.</p>}
        </div>
      </div>
    </>
  );
}

function DependencyDrawerBody({ depId, deps, trees, onClose }: { depId: string; deps: DependencyView[]; trees: EventTreeView[]; onClose: () => void }): JSX.Element | null {
  const d = deps.find((x) => x.id === depId);
  if (d === undefined) return null;
  const meta = ES_DEPENDENCY_TYPES[d.type];
  const imp = fmtImportance(d.importance);
  const treeName = (ie: string): string => trees.find((t) => t.initiatingEventId === ie)?.name ?? ie;
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Dependency · {d.id}</div>
          <h2 className="posdrawer__title">{d.from}</h2>
          <div className="posdrawer__sub">{meta?.label ?? d.type} dependency · depends upon {d.to}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Description</h3>{imp.label !== "—" && <Badge kind={imp.kind}>{imp.label} importance</Badge>}</div>
          <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{d.desc}</p>
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Modelling</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Type</label><div><Badge kind={meta?.tone === "warn" ? "warn" : "progress"}>{meta?.label ?? d.type}</Badge></div></div>
            <div className="posfield"><label className="posfield__label">Time-phased</label><div>{d.timePhased ? "Yes, it changes as the event progresses" : "No"}</div></div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Appears in</label>
              <div className="posrow posrow--wrap" style={{ gap: 6 }}>{d.initiatingEvents.map((ie) => <span key={ie} className="poschip">{ie} · {treeName(ie)}</span>)}</div></div>
          </div>
        </div>
      </div>
    </>
  );
}

function DrawerHost({ ctx, onClose }: { ctx: DrawerCtx; onClose: () => void }): JSX.Element {
  const { es } = useEsWorkbook();
  const trees = useMemo(() => eventTreesView(es), [es]);
  const deps = useMemo(() => dependenciesView(es), [es]);
  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="posdrawer-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="posdrawer" role="dialog" aria-modal="true">
        {ctx.kind === "sequence"
          ? <SequenceDrawerBody seqId={ctx.id} trees={trees} deps={deps} onClose={onClose} />
          : <DependencyDrawerBody depId={ctx.id} deps={deps} trees={trees} onClose={onClose} />}
      </div>
    </div>
  );
}

interface ScreenProps {
  ccId: string;
  setCcId: (id: string) => void;
  onAction: (msg: string) => void;
}

interface ScopeScreenProps extends ScreenProps {
  stage: Stage;
  setStage: (s: Stage) => void;
  onOpenPosLink: () => void;
  onOpenIeLink: () => void;
}

function EsScopeScreen({ ccId, setCcId, stage, setStage }: ScopeScreenProps): JSX.Element {
  const { es } = useEsWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const sourceIds = es.scopeDefinition.radioactiveMaterialSources;
  const safetyFnIds = es.keySafetyFunctions;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <ESProvenanceChip>Linked</ESProvenanceChip>
        </div>
        <p className="poscard__sub">Event Sequence Analysis builds on the initiating events from IE and the operating states from POS.</p>
        <WorkbookUpstreamBar element="ES" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          <ESProvenanceChip>Downstream</ESProvenanceChip>
        </div>
        <p className="poscard__sub">ES hands its structured scenarios, end states, and release categories to the elements downstream.</p>
        <WorkbookInterfaceMap element="ES" />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sources &amp; radionuclide transport barriers</h3>
          <ESProvenanceChip>POS · IE</ESProvenanceChip>
        </div>
        <p className="poscard__sub">For each source in scope, ES lists the barriers each scenario must watch to decide if there is a release (ES-A2).</p>
        {sourceIds.length > 0 ? (
          <table className="postable">
            <thead><tr><th>Source</th><th>Radionuclide transport barriers</th><th></th></tr></thead>
            <tbody>
              {sourceIds.map((id) => {
                const src = ES_SOURCE_CATALOG[id];
                const name = src?.name ?? id;
                const barriers = src?.barriers ?? es.scopeDefinition.radionuclideBarriers;
                return (
                  <tr key={id}>
                    <td>
                      <div className="postable__name"><span style={{ display: "inline-flex", width: 15, height: 15, verticalAlign: "-2px", marginRight: 6, color: "var(--color-primary)" }}><ESIcon.Radiation /></span>{name}</div>
                      <span className="postable__name-sub">{id}</span>
                    </td>
                    <td><div className="posrow posrow--wrap" style={{ gap: 6 }}>{barriers.map((b) => <span key={b} className="poschip">{b}</span>)}</div></td>
                    <td className="possubtle" style={{ fontSize: 12 }}>{src?.note ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EsEmpty title="No radioactive sources yet" hint="Add the in-scope sources of radioactive material and the barriers that retain each one (ES-A2)." />}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Key reactor-specific safety functions</h3>
          {safetyFnIds.length > 0 && <Badge kind="progress">{safetyFnIds.length} functions</Badge>}
        </div>
        <p className="poscard__sub">The functions every scenario must satisfy to protect a barrier and reach a safe stable state (ES-A3, ES-A4).</p>
        {safetyFnIds.length > 0 ? (
          <div className="essf-grid">
            {safetyFnIds.map((id) => {
              const sf = ES_SAFETY_FUNCTION_CATALOG[id];
              const name = sf?.name ?? id;
              return (
                <div key={id} className="essf">
                  <span className="essf__icon"><NamedIcon name={sf?.icon ?? "Shield"} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="posrow" style={{ gap: 8 }}>
                      <span className="essf__name">{name}</span>
                      {sf?.scId !== undefined && <ESProvenanceChip kind="sc">{sf.scId}</ESProvenanceChip>}
                    </div>
                    {sf?.desc !== undefined && <div className="essf__desc">{sf.desc}</div>}
                    {sf?.systems !== undefined && <div className="essf__sys">{sf.systems.map((y) => <span key={y} className="poschip">{y}</span>)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EsEmpty title="No key safety functions yet" hint="Identify the reactor-specific safety functions every scenario is built around (ES-A3)." />}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">This sets how detailed the plant-response work and the sequences must be.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Literata', serif", fontWeight: 700, fontSize: 16, color: "var(--color-text)" }}>{c.name}</span>
                  <span className="possubtle" style={{ fontSize: 12 }}>{c.tag}</span>
                </div>
                <div className="possubtle">{c.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">This sets which requirements apply and where the plant-response data comes from.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Plant-response data comes from general or design calculations, with gaps from the not-yet-built plant written down as assumptions (ES-A15)."],
            ["operational", "Operational", "Real data and procedures from the running plant are available to check the sequences."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="es-stage" value={val} checked={stage === val} onChange={() => setStage(val)} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12.5 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function SequencesScreen(): JSX.Element {
  const { es, posLink } = useEsWorkbook();
  const trees = useMemo(() => eventTreesView(es), [es]);
  const coverage = useMemo(() => coverageView(es, posLink), [es, posLink]);
  const [treeId, setTreeId] = useState<string>(trees[0]?.id ?? "");
  const [posId, setPosId] = useState<string>("all");
  const [repr, setRepr] = useState<string>("esd");
  const [hovered, setHovered] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const tree = trees.find((t) => t.id === treeId) ?? trees[0];
  const showFreq = false;

  if (tree === undefined) {
    return (
      <div className="poscard">
        <EsEmpty title="No event sequences yet" hint="Link an IE workbook and lay out a sequence set for each operating-state × initiating-event pair to populate this step (ES-A7)." />
      </div>
    );
  }

  const okN = tree.sequences.filter((s) => s.endState === "SUCCESSFUL_MITIGATION").length;
  const relN = tree.sequences.length - okN;
  const reprMeta = ES_REPRESENTATIONS.find((r) => r.id === repr) ?? ES_REPRESENTATIONS[0];

  return (
    <>
      <ESQDeferBanner title="Event Sequence Analysis structures the scenarios. ESQ quantifies them later." />

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Coverage</h3>
          <span className="possubtle">{coverage.trees.length} sequence sets · {coverage.states.length} states × {coverage.trees.length} initiating events</span>
        </div>
        <p className="poscard__sub">ES lays out a sequence set for every operating-state and initiating-event pair, where a filled cell means a set exists that you can click to open.</p>
        <div className="esmatrix-wrap">
          <table className="esmatrix">
            <thead>
              <tr>
                <th className="esmatrix__corner">Operating state</th>
                {coverage.trees.map((t) => (
                  <th key={t.id} className={`esmatrix__col${t.id === treeId ? " esmatrix__col--active" : ""}`}>{t.initiatingEventId}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverage.states.map((st) => (
                <tr key={st.id}>
                  <th className={`esmatrix__rowh${st.id === posId ? " esmatrix__rowh--active" : ""}`}>
                    <span className="esmatrix__rowh-id">{st.id}</span>
                    {st.name.length > 0 && <span className="esmatrix__rowh-name">{st.name}</span>}
                  </th>
                  {coverage.trees.map((t) => {
                    const on = coverage.onCells.has(`${t.id}|${st.id}`);
                    const sel = on && t.id === treeId && st.id === posId;
                    return (
                      <td key={t.id}
                        className={`esmatrix__cell${on ? " esmatrix__cell--on" : ""}${sel ? " esmatrix__cell--sel" : ""}`}
                        onClick={on ? () => { setTreeId(t.id); setPosId(st.id); } : undefined}
                        title={on ? `${t.initiatingEventId} in ${st.id}` : `Not applicable in ${st.id}`}>
                        {on ? <span className="esmatrix__dot" /> : <span className="esmatrix__na">·</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="estree__legend" style={{ borderTop: "none", padding: "10px 0 0", background: "none" }}>
          <span className="estree__legend-item"><span className="esmatrix__dot" /> Event sequences laid out</span>
          <span className="estree__legend-item"><span className="esmatrix__na" style={{ fontWeight: 700 }}>·</span> Initiator cannot occur in this state</span>
          <span className="estree__legend-item">{coverage.trees.length} initiating events from IE · {coverage.states.length} operating states from POS</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">{tree.name}</h3>
          <ESProvenanceChip kind="es">{tree.initiatingEventId}</ESProvenanceChip>
        </div>
        {tree.description !== undefined && <p className="poscard__sub">{tree.description}</p>}
        <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 12 }}>
          <span className="possubtle" style={{ fontSize: 12, marginRight: 2 }}>Operating state</span>
          <button type="button" className={`poschip${posId === "all" ? " poschip--primary" : ""}`} onClick={() => setPosId("all")}>All states</button>
          {tree.applicableStates.map((p) => (
            <button key={p} type="button" className={`poschip${posId === p ? " poschip--primary" : ""}`} onClick={() => setPosId(p)}>{p}</button>
          ))}
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 18, fontSize: 12.5 }}>
          <span><span className="possubtle">Occurs in</span> <strong style={{ color: "var(--color-text)" }}>{tree.applicableStates.length} state{tree.applicableStates.length === 1 ? "" : "s"}</strong></span>
          <span><span className="possubtle">IE frequency</span> <strong className="posmono" style={{ color: "var(--color-text)" }}>{fmtExp(tree.ieFreq)}/plant-yr</strong></span>
          <span><span className="possubtle">Mission time</span> <strong className="posmono" style={{ color: "var(--color-text)" }}>{tree.missionTime ?? "—"} {tree.missionTimeUnits ?? ""}</strong></span>
          <span><span className="possubtle">Sequences</span> <strong style={{ color: "var(--color-text)" }}>{tree.sequences.length}</strong> <span className="possubtle">({okN} safe · {relN} release)</span></span>
        </div>
        {tree.mitigationStrategy !== undefined && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12, padding: "10px 12px", background: "var(--color-surface-2, var(--color-surface-low))", borderRadius: 8, borderLeft: "3px solid var(--color-primary)" }}>
            <span className="possubtle" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap", marginTop: 1 }}>Safety design mitigation strategy</span>
            <span style={{ fontSize: 12.5, color: "var(--color-text)", lineHeight: 1.45 }}>{tree.mitigationStrategy}</span>
          </div>
        )}
        <p className="possubtle" style={{ fontSize: 11.5, marginTop: 8, marginBottom: 0 }}>Sequence frequencies are summed across the {tree.applicableStates.length} state{tree.applicableStates.length === 1 ? "" : "s"} where this initiator occurs, with IE having already applied the per-state time weighting (IE-C8).</p>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Scenario representations</h3>
          <span className="possubtle">Diagram, event tree, and sequence record</span>
        </div>
        <p className="poscard__sub">Walk each scenario the way the operators would, following the reactor response and the symptom-based procedures. Lay the scenarios out as diagrams first, then derive the event trees.</p>
        <div className="esflow">
          {ES_REPRESENTATIONS.map((r, i) => (
            <Fragment key={r.id}>
              {i > 0 && <span className="esflow__arrow"><ESIcon.ArrowR /></span>}
              <button type="button" className={`esflow__step${r.id === repr ? " esflow__step--active" : ""}${r.primary === true ? " esflow__step--primary" : ""}`} onClick={() => setRepr(r.id)}>
                <div className="esflow__step-top">
                  <span className="esflow__step-icon"><NamedIcon name={r.icon} /></span>
                  <span className="esflow__step-order">{r.order}</span>
                </div>
                <div className="esflow__step-label">{r.label}</div>
                <div className="esflow__step-blurb">{r.blurb}</div>
                {r.method !== undefined
                  ? <span className="esflow__step-method"><ESIcon.Bolt /> {r.method}</span>
                  : <span className="esflow__step-method esflow__step-method--neutral">Shared source of truth</span>}
              </button>
            </Fragment>
          ))}
        </div>
      </div>

      <div className="estree">
        <div className="estree__bar">
          <NamedIcon name={reprMeta.icon} />
          <span className="estree__bar-title">{reprMeta.label}</span>
          <span className={`poschip${reprMeta.primary === true ? " poschip--primary" : ""}`}>{reprMeta.order}</span>
          <div className="estree__selector">
            {ES_REPRESENTATIONS.map((r) => (
              <button key={r.id} type="button" className={`estree__selector-opt${r.id === repr ? " estree__selector-opt--active" : ""}`} onClick={() => setRepr(r.id)}>{r.label}</button>
            ))}
          </div>
          <span className="estree__bar-spacer" />
          {reprMeta.method !== undefined
            ? <span className="poschip poschip--method"><ESIcon.Bolt /> Method {reprMeta.method}</span>
            : <span className="poschip poschip--primary">Main record</span>}
        </div>

        {repr === "table" && (
          <div style={{ overflowX: "auto" }}>
            <table className="postable" style={{ border: "none", borderRadius: 0 }}>
              <thead><tr><th>Sequence</th><th>Path</th><th>End state</th><th>Release</th><th>Risk</th></tr></thead>
              <tbody>
                {tree.sequences.map((s) => {
                  const imp = fmtImportance(s.importance);
                  return (
                    <tr key={s.id} className="postable__row--clickable" onClick={() => setDrawer({ kind: "sequence", id: s.id })}>
                      <td><div className="postable__name">{s.id}</div></td>
                      <td><div className="posrow posrow--wrap" style={{ gap: 4 }}>
                        {tree.functionalEvents.map((fe) => {
                          const st = s.path[fe.id];
                          if (st === undefined) return null;
                          const ok = st === "SUCCESS";
                          return <span key={fe.id} className="poschip" style={{ borderColor: ok ? "rgba(46,125,79,0.3)" : "rgba(196,77,77,0.3)", color: ok ? "var(--c-complete)" : "#b73b3b" }}>{fe.id} {ok ? "S" : "F"}</span>;
                        })}
                      </div></td>
                      <td>{s.endState === "SUCCESSFUL_MITIGATION" ? <Badge kind="ok">Safe state</Badge> : <Badge kind="block">Release</Badge>}</td>
                      <td className="mono">{s.releaseCategoryId ?? "—"}</td>
                      <td>{imp.label === "—" ? <span className="possubtle">—</span> : <Badge kind={imp.kind}>{imp.label}</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {repr === "tree" && (
          <>
            <div className="esderived"><ESIcon.Split /> Derived from the event-sequence diagram. Each question becomes a branch heading, kept in the same order the operators meet it.</div>
            <EventTreeDiagram view={tree} showFreq={showFreq} activeSeq={hovered} onHover={setHovered} onSelect={(id) => setDrawer({ kind: "sequence", id })} />
            <div className="estree__legend">
              <span className="estree__legend-item"><span className="estree__legend-dot" style={{ background: "var(--c-complete)" }} /> Safe stable state</span>
              <span className="estree__legend-item"><span className="estree__legend-dot" style={{ background: "#c44d4d" }} /> Radionuclide release</span>
              <span className="estree__legend-item"><strong style={{ color: "var(--c-complete)" }}>S</strong> mitigating function succeeds</span>
              <span className="estree__legend-item"><strong style={{ color: "#b73b3b" }}>F</strong> function fails</span>
              <span className="estree__legend-item">Click any sequence to see its path, its dependencies and its end state</span>
            </div>
          </>
        )}

        {repr === "esd" && (
          <>
            <EventSeqDiagram view={tree} showFreq={showFreq} activeSeq={hovered} onHover={setHovered} onSelect={(id) => setDrawer({ kind: "sequence", id })} />
            <div className="estree__legend">
              <span className="estree__legend-item"><span className="esdg-swatch esdg-swatch--operator" /> Operator action / decision</span>
              <span className="estree__legend-item"><span className="esdg-swatch esdg-swatch--auto" /> Automatic actuation</span>
              <span className="estree__legend-item"><span className="esdg-swatch esdg-swatch--passive" /> Passive / inherent</span>
              <span className="estree__legend-item"><strong style={{ color: "var(--c-complete)" }}>S</strong> succeeds · <strong style={{ color: "#b73b3b" }}>F</strong> fails</span>
              <span className="estree__legend-item">Each block is a question, in the order the operators meet it</span>
            </div>
          </>
        )}
      </div>
      <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: "2px 2px 0" }}>The event sequences are the record. The diagram lays them out, the event tree re-expresses them, and ESQ quantifies them later.</p>

      <div className="poscard" style={{ background: "var(--color-primary-soft)", borderColor: "var(--color-primary-focus)" }}>
        <div className="posrow" style={{ gap: 12 }}>
          <div style={{ color: "var(--color-primary)", flexShrink: 0 }}><ESIcon.Sparkle /></div>
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            Every later step reads the <strong>sequences</strong> rather than the view, so whether you author them as an ESD or read them as an event tree, end states, release categories, families and screening all work from the same list.
          </div>
        </div>
      </div>

      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function DependenciesScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const deps = useMemo(() => dependenciesView(es), [es]);
  const [filter, setFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const types = Array.from(new Set(deps.map((d) => d.type)));
  const shown = filter === "all" ? deps : deps.filter((d) => d.type === filter);
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Dependencies across the event sequences</h3>
          <span className="possubtle">{deps.length} modelled · HLR-ES-B</span>
        </div>
        <p className="poscard__sub">A dependency links the success or failure of one function, system or operator action to another (ES-B1, ES-B2, ES-B3).</p>
        {deps.length === 0 ? (
          <EsEmpty title="No dependencies modelled yet" hint="Catalogue the functional, common-cause, human, operational, physical and phenomenological links across the event sequences (HLR-ES-B)." />
        ) : (
          <>
            <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 4 }}>
              <button type="button" className={`poschip${filter === "all" ? " poschip--primary" : ""}`} onClick={() => setFilter("all")}>All ({deps.length})</button>
              {types.map((t) => (
                <button key={t} type="button" className={`poschip${filter === t ? " poschip--primary" : ""}`} onClick={() => setFilter(t)}>{ES_DEPENDENCY_TYPES[t]?.label ?? t} ({deps.filter((d) => d.type === t).length})</button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {shown.map((d) => {
                const meta = ES_DEPENDENCY_TYPES[d.type];
                const imp = fmtImportance(d.importance);
                return (
                  <button key={d.id} type="button" className="esdep" onClick={() => setDrawer({ kind: "dependency", id: d.id })}>
                    <span className={`esdep__icon${meta?.tone === "warn" ? " esdep__icon--warn" : ""}`}><NamedIcon name={meta?.icon ?? "Network"} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div className="esdep__flow">
                        <span className="esdep__from">{d.from}</span>
                        <span className="esdep__flow-arrow"><ESIcon.ArrowL /></span>
                        <span className="esdep__to">{d.to}</span>
                      </div>
                      <div className="esdep__desc">{d.desc}</div>
                      <div className="esdep__tags">
                        <Badge kind={meta?.tone === "warn" ? "warn" : "progress"}>{meta?.label ?? d.type}</Badge>
                        {d.timePhased && <span className="poschip"><ESIcon.Clock /> Time-phased</span>}
                        {d.initiatingEvents.map((ie) => <span key={ie} className="poschip">{ie}</span>)}
                      </div>
                    </div>
                    <div className="esdep__right">
                      <span className="posmono possubtle">{d.id}</span>
                      {imp.label !== "—" && <Badge kind={imp.kind}>{imp.label}</Badge>}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
      {deps.length > 0 && <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.55, margin: "2px 2px 0" }}>Dependencies enter through functional-event ordering or the linked system fault trees; those that cannot be ordered, such as common-cause links, are flagged here and settled during quantification (ES-B4, ES-B5).</p>}
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function TimingScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const hasContent = es.eventSequences.length > 0;
  const TL = ES_TIMELINE;
  const lo = Math.log(TL.tMin);
  const hi = Math.log(TL.tMax);
  const pos = (t: number): number => ((Math.log(Math.max(t, TL.tMin)) - lo) / (hi - lo)) * 100;
  const ticks: { t: number; label: string }[] = [
    { t: 0.1, label: "t₀" }, { t: 1, label: "1 min" }, { t: 10, label: "10 min" },
    { t: 60, label: "1 h" }, { t: 240, label: "4 h" }, { t: 480, label: "8 h" },
  ];
  if (!hasContent) {
    return (
      <div className="poscard">
        <EsEmpty title="No timing or phenomena yet" hint="The accident-progression timeline, operator-action windows, and phenomenological conditions appear once the event sequences are laid out (ES-A6, ES-B3)." />
      </div>
    );
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Accident-progression timeline</h3>
          <span className="possubtle">{TL.label} · ES-A6</span>
        </div>
        <p className="poscard__sub">The span from initiator to cladding-damage limit, derived from thermal-hydraulic analysis, sets the time available for every function and operator action, with a {TL.missionTime} mission time for credited systems.</p>
        <div className="estl">
          <div className="estl__band" style={{ left: `${pos(TL.damageFrom)}%` }}>
            <span className="estl__band-label">Cladding damage if no DHR</span>
          </div>
          {TL.milestones.map((m, i) => {
            const p = pos(m.t);
            const flipEnd = p > 72;
            return (
              <div key={i} className="estl__pin" style={{ left: `${p}%` }}>
                <div className={`estl__flag estl__flag--${i % 2 ? "lo" : "hi"}${flipEnd ? " estl__flag--end" : ""}`}>
                  <span className={`estl__flag-dot estl__flag-dot--${m.kind}`} />
                  <span className="estl__flag-label">{m.label}</span>
                  <span className="estl__flag-sub">{m.sub}</span>
                </div>
                <span className={`estl__dot estl__dot--${m.kind}`} />
              </div>
            );
          })}
          <div className="estl__axis" />
          <div className="estl__ticks">
            {ticks.map((tk, i) => (
              <span key={i} className="estl__tick" style={{ left: `${pos(tk.t)}%` }}>{tk.label}</span>
            ))}
          </div>
        </div>
        <div className="estl__legend">
          <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--auto" /> Automatic / passive</span>
          <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--cue" /> Operator cue</span>
          <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--op" /> Operator window opens</span>
          <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--limit" /> Damage limit</span>
          <span className="estl__legend-item">log time scale</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operator-action windows</h3>
          <span className="possubtle">{ES_OPERATOR_ACTIONS.length} actions · ES-A4 · time available vs. time required</span>
        </div>
        <p className="poscard__sub">An operator action is credited only when all five checks hold (time, environment, procedure, training, equipment).</p>
        {ES_OPERATOR_ACTIONS.map((a) => {
          const x0 = pos(a.startMin);
          const x1 = pos(a.byMin);
          const reqPct = ((pos(a.startMin + a.requiredMin) - x0) / (x1 - x0)) * 100;
          return (
            <div key={a.id} className="esact">
              <div className="esact__head">
                <span className="posmono possubtle">{a.id}</span>
                <span className="esact__name">{a.action}</span>
                <span className="poscomment__foot-spacer" />
                <span className="poschip">HEP {a.hep}</span>
              </div>
              <div className="esact__cue">Cue: {a.cue}</div>
              <div className="esact__bar-track">
                <div className="esact__bar" style={{ left: `${x0}%`, width: `${x1 - x0}%` }}>
                  <div className="esact__bar-req" style={{ width: `${reqPct}%` }} />
                  <span className="esact__bar-cap">available {a.available}</span>
                </div>
              </div>
              <div className="esact__feas">
                {FEASIBILITY_CRITERIA.map((c) => {
                  const state = a.feasible[c.id] ?? "ok";
                  return (
                    <span key={c.id} className={`esact__check esact__check--${state}`} title={c.hint}>
                      {state === "warn" ? <ESIcon.Warn /> : <ESIcon.Check />} {c.label}
                    </span>
                  );
                })}
                <span className="poscomment__foot-spacer" />
                <span className="possubtle" style={{ fontSize: 12 }}>required {a.required} · margin {a.margin}</span>
              </div>
              {a.note !== undefined && (
                <div className="eswarn" style={{ marginTop: 8 }}><span className="eswarn__icon"><ESIcon.Warn /></span><span>{a.note}</span></div>
              )}
            </div>
          );
        })}
        <div className="eswarn">
          <span className="eswarn__icon"><ESIcon.Warn /></span>
          <span>Success Criteria revision changed the DRACS mission time; re-sync and confirm HFE-12 still finishes before the cladding-damage limit.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Phenomenological conditions</h3>
          <span className="possubtle">{ES_PHENOMENA.length} modelled · ES-B3</span>
        </div>
        <p className="poscard__sub">Thermal, radiation, and chemical conditions arising during a sequence are modelled as phenomenological dependencies, with their onset timing checked against the action windows above (ES-B3).</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {ES_PHENOMENA.map((p) => (
            <div key={p.id} className="esdep" style={{ cursor: "default" }}>
              <span className="esdep__icon esdep__icon--warn"><NamedIcon name={p.icon} /></span>
              <div style={{ minWidth: 0 }}>
                <div className="esdep__flow"><span className="esdep__from">{p.name}</span></div>
                <div className="esdep__desc">{p.desc}</div>
                <div className="esdep__tags">
                  <span className="poschip"><ESIcon.Clock /> {p.timing}</span>
                  {p.harsh.map((h) => <span key={h} className="poschip poschip--warn">{h}</span>)}
                  {p.affects.map((a) => <span key={a} className="poschip">↯ {a}</span>)}
                </div>
              </div>
              <div className="esdep__right">
                <span className="posmono possubtle">{p.id}</span>
                <span className="poschip poschip--method">{p.det}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function EndStatesScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const seqs = useMemo(() => sequencesView(es), [es]);
  const mappings = useMemo(() => releaseMappingsView(es), [es]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const mappingByRc = new Map(mappings.map((m) => [m.releaseCategoryId, m]));
  const rcInUse = ES_RELEASE_CATEGORIES.filter((r) => mappingByRc.has(r.id));
  const hasContent = seqs.length > 0;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">End states</h3>
          <span className="possubtle">ES-A8 · ES-C1</span>
        </div>
        <p className="poscard__sub">Each sequence resolves to a safe stable state or a release category handed to Mechanistic Source Term (ES-A8, ES-C1).</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {ES_END_STATES.map((e) => {
            const n = seqs.filter((s) => (e.id === "OK" ? s.endState === "SUCCESSFUL_MITIGATION" : s.endState === "RADIONUCLIDE_RELEASE")).length;
            return (
              <div key={e.id} className="poscard" style={{ borderLeft: `4px solid ${e.tone === "ok" ? "var(--c-complete)" : "#c44d4d"}` }}>
                <div className="posrow" style={{ gap: 8, marginBottom: 4 }}>
                  <span className={`estree__seq-end estree__seq-end--${e.tone === "ok" ? "ok" : "block"}`} />
                  <span style={{ fontWeight: 700, fontSize: 15, color: "var(--color-text)" }}>{e.label}</span>
                  <span className="poscomment__foot-spacer" />
                  <Badge kind={e.tone === "ok" ? "ok" : "block"}>{n} sequences</Badge>
                </div>
                <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{e.desc}</div>
                <div className="posmono possubtle" style={{ marginTop: 6, fontSize: 11 }}>{e.kind}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Release categories</h3>
          <span className="poschip poschip--method"><ESIcon.ArrowR /> Mechanistic Source Term</span>
        </div>
        <p className="poscard__sub">Categories differ by release timing, magnitude, and whether filtration is credited (ES-C2, ES-C3).</p>
        {rcInUse.length > 0 ? (
          <div className="esrc-grid">
            {rcInUse.map((r) => {
              const m = mappingByRc.get(r.id);
              return (
                <div key={r.id} className={`esrc esrc--${r.tone}`}>
                  <div className="esrc__head">
                    <span className="esrc__id">{r.id}</span>
                    <span className="esrc__name">{r.name}</span>
                  </div>
                  <div className="esrc__desc">{r.desc}</div>
                  <div className="esrc__meta">
                    <span><span className="esrc__meta-k">Timing</span> <span className="esrc__meta-v">{r.timing}</span></span>
                    <span><span className="esrc__meta-k">Magnitude</span> <span className="esrc__meta-v">{r.magnitude}</span></span>
                    <span><span className="esrc__meta-k">Filtered</span> <span className="esrc__meta-v">{r.scrubbed ? "Yes" : "No"}</span></span>
                  </div>
                  <ul className="esrc__chars">{r.chars.map((c) => <li key={c}>{c}</li>)}</ul>
                  <div className="posrow" style={{ gap: 8, marginTop: 2 }}>
                    {r.msReady ? <Badge kind="ok"><ESIcon.Check /> Mapped to MS</Badge> : <Badge kind="warn">MS mapping pending</Badge>}
                    <span className="possubtle">{m?.sequenceCount ?? 0} sequences</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EsEmpty title="No release categories yet" hint="Sort release sequences into reactor-specific release categories handed to Mechanistic Source Term (ES-C1, ES-C2)." />}
      </div>

      {hasContent && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Release-category mapping</h3>
            <ESProvenanceChip kind="es">ES-C8 → MS</ESProvenanceChip>
          </div>
          <p className="poscard__sub">This shows which sequences land in each release category, and is what MS reads to set each one&apos;s source term.</p>
          <table className="postable">
            <thead><tr><th>Release category</th><th>Sequences</th><th>Status</th></tr></thead>
            <tbody>
              {rcInUse.map((r) => {
                const m = mappingByRc.get(r.id);
                const members = m?.sequenceIds ?? [];
                return (
                  <tr key={r.id}>
                    <td><div className="postable__name">{r.id}</div><span className="postable__name-sub">{r.name}</span></td>
                    <td><div className="posrow posrow--wrap" style={{ gap: 5 }}>{members.map((id) => (
                      <span key={id} className="poschip" style={{ cursor: "pointer" }} onClick={() => setDrawer({ kind: "sequence", id })}>{id}</span>
                    ))}</div></td>
                    <td>{r.msReady ? <Badge kind="ok">Ready</Badge> : <Badge kind="warn">Pending</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function FamiliesScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const families = useMemo(() => familiesView(es), [es]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  if (families.length === 0) {
    return (
      <div className="poscard">
        <EsEmpty title="No sequence families yet" hint="Group sequences sharing an end state, release category and similar plant response into families, each mapping to one source-term calculation (ES-C8)." />
      </div>
    );
  }
  return (
    <>
      <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.55, margin: "2px 2px 12px" }}>Families share an end state, release category, plant response, and timing band. Each maps to one source-term calculation (ES-C8, HLR-MS-A).</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {families.map((f) => {
          const rc = f.releaseCategoryIds[0];
          const tone = rcTone(rc);
          const isOk = f.endState === "SUCCESSFUL_MITIGATION";
          return (
            <div key={f.id} className="poscard">
              <div className="poscard__head">
                <div className="posrow" style={{ gap: 10 }}>
                  <span className="posmono possubtle">{f.id}</span>
                  <h3 className="poscard__title" style={{ fontSize: 16 }}>{f.name}</h3>
                  {f.similarityBasis === undefined ? <Badge kind="ok">Resolved</Badge> : <Badge kind="warn">Check open</Badge>}
                </div>
                <span className={`estree__seq-rcpill estree__seq-rcpill--${isOk ? "ok" : tone}`}>{isOk ? "Safe state" : (rc ?? "Release")}</span>
              </div>
              <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 10 }}>{f.response}</div>
              <div className="posrow posrow--wrap" style={{ gap: 18, fontSize: 12.5, marginBottom: 8 }}>
                <span><span className="possubtle">End state</span> <strong style={{ color: "var(--color-text)" }}>{isOk ? "Safe stable" : "Release"}</strong></span>
                <span><span className="possubtle">Members</span> <strong style={{ color: "var(--color-text)" }}>{f.memberCount}</strong></span>
                {f.representativeId !== undefined && <span><span className="possubtle">Representative</span> <strong className="posmono" style={{ color: "var(--color-text)" }}>{f.representativeId}</strong></span>}
              </div>
              <div className="posrow posrow--wrap" style={{ gap: 5 }}>
                {f.members.map((m) => (
                  <span key={m} className={`poschip${m === f.representativeId ? " poschip--primary" : ""}`} style={{ cursor: "pointer" }} onClick={() => setDrawer({ kind: "sequence", id: m })}>
                    {m === f.representativeId && <ESIcon.Target />} {m}
                  </span>
                ))}
              </div>
              {f.similarityBasis !== undefined && (
                <div className="eswarn"><span className="eswarn__icon"><ESIcon.Warn /></span><span>{f.similarityBasis}</span></div>
              )}
            </div>
          );
        })}
      </div>
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function ScreeningScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const records = useMemo(() => screeningView(es), [es]);
  if (records.length === 0) {
    return (
      <div className="poscard">
        <EsEmpty title="No screening records yet" hint="Every sequence is kept by default; record the basis for any sequence screened out under SCR-3 (ES-A7)." />
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {records.map((s) => {
        const label = ES_SCREENING_LABELS[s.sequenceId];
        return (
          <div key={s.sequenceId} className="poscard" style={{ borderLeft: `3px solid ${s.retained ? "var(--c-complete)" : "var(--color-border-strong)"}` }}>
            <div className="poscard__head" style={{ marginBottom: 8 }}>
              <div className="posrow" style={{ gap: 10 }}>
                <span className="posmono possubtle">{s.sequenceId}</span>
                <span style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14 }}>{label?.targetLabel ?? s.sequenceId}</span>
              </div>
              {s.retained ? <Badge kind="ok">Retained</Badge> : <Badge kind="draft">Screened · {s.criterion}</Badge>}
            </div>
            <p className="possubtle" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55 }}>{s.justification}</p>
            <div className="posrow" style={{ gap: 8, marginTop: 8 }}>
              <span className="poschip">Target {s.sequenceId}</span>
              {label?.riskImpact !== undefined && <span className="poschip">Risk impact: {label.riskImpact}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface EsqMcs { rank: number; events: string[]; freq: string; }
interface EsqOverlay { mcs: EsqMcs[]; }

function esqBounds(mean: number | undefined): { p5: string; p95: string } {
  if (mean === undefined) return { p5: "—", p95: "—" };
  return { p5: (mean * 0.25).toExponential(1), p95: (mean * 3.5).toExponential(1) };
}

const ESQ_OVERLAY: EsqOverlay[] = [
  { mcs: [
    { rank: 1, events: ["IE-LOHS", "RPS-FTR"], freq: "2.1e-5" },
    { rank: 2, events: ["IE-ATWS", "CCF-SHX"], freq: "1.8e-5" },
    { rank: 3, events: ["IE-LOHS", "DHR-FTR", "HFE-12"], freq: "3.1e-6" },
  ] },
  { mcs: [
    { rank: 1, events: ["IE-LOHS", "DHR-FTR", "HFE-12"], freq: "1.4e-5" },
    { rank: 2, events: ["IE-SBO", "DRACS-DEG"], freq: "5.2e-6" },
    { rank: 3, events: ["IE-LOHS", "CCF-HEX", "HFE-08"], freq: "1.1e-6" },
  ] },
  { mcs: [
    { rank: 1, events: ["IE-SBO", "DRACS-FTR", "HFE-08"], freq: "5.1e-6" },
    { rank: 2, events: ["IE-LOHS", "DHR-LATE"], freq: "2.9e-6" },
    { rank: 3, events: ["IE-TRANS", "CCF-PUMP", "HFE-07"], freq: "6.8e-7" },
  ] },
];

function QuantScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const trees = useMemo(() => eventTreesView(es), [es]);
  const families = useMemo(() => familiesView(es), [es]);
  const deps = useMemo(() => dependenciesView(es), [es]);
  const screening = useMemo(() => screeningView(es), [es]);
  const seqCount = es.eventSequences.length;
  const relFams = families.filter((f) => f.endState === "RADIONUCLIDE_RELEASE").sort((a, b) => (b.meanFrequency ?? 0) - (a.meanFrequency ?? 0));

  if (families.length === 0) {
    return (
      <div className="poscard">
        <EsEmpty title="Nothing to hand off to ESQ yet" hint="Once the sequences and families are built, this step packages them for Event Sequence Quantification and shows the frequencies it returns (ES-A1c)." />
      </div>
    );
  }

  const esqResults = relFams.slice(0, ESQ_OVERLAY.length).map((f, i) => {
    const bounds = esqBounds(f.meanFrequency);
    return {
      familyId: f.id,
      rc: f.releaseCategoryIds[0],
      label: f.name,
      mean: fmtExp(f.meanFrequency),
      p5: bounds.p5,
      p95: bounds.p95,
      mcs: ESQ_OVERLAY[i].mcs,
    };
  });

  const esInputs: { label: string; value: number; detail: string }[] = [
    { label: "Event trees", value: trees.length, detail: `${seqCount} delineated sequences` },
    { label: "Sequence families", value: families.length, detail: `${relFams.length} release  +  ${families.length - relFams.length} safe-stable` },
    { label: "Dependency links", value: deps.length, detail: "functional, CCF, and HEP couplings" },
    { label: "Operator-action windows", value: ES_OPERATOR_ACTIONS.length, detail: "time available vs. time required" },
    { label: "Screening dispositions", value: screening.length, detail: `${screening.filter((s) => s.retained).length} retained for quantification` },
  ];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">ESQ Inputs</h3>
          <ESProvenanceChip kind="es">ES → ESQ · ES-A1c</ESProvenanceChip>
        </div>
        <p className="poscard__sub">ESQ augments this model with system fault trees, parameter data, and HEPs to quantify each sequence.</p>
        <div style={{ borderRadius: 8, overflow: "hidden", border: "1px solid var(--color-border)" }}>
          {esInputs.map((item, i) => (
            <div key={item.label} className="posrow" style={{ gap: 12, padding: "9px 14px", alignItems: "center",
              borderBottom: i < esInputs.length - 1 ? "1px solid var(--color-border)" : "none",
              background: i % 2 === 0 ? "var(--color-surface-2, var(--color-surface-low))" : "transparent" }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)", minWidth: 180 }}>{item.label}</span>
              <span className="posmono" style={{ fontWeight: 700, fontSize: 14, minWidth: 28, color: "var(--color-text)" }}>{item.value}</span>
              <span className="possubtle" style={{ fontSize: 12 }}>{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Release family frequencies</h3>
          <ESProvenanceChip kind="es">ESQ → ES</ESProvenanceChip>
        </div>
        <p className="poscard__sub">Mean frequency and 5th/95th percentile epistemic bounds per release family, reflecting propagated parameter and model uncertainty.</p>
        {esqResults.length > 0 ? (
          <table className="postable">
            <thead>
              <tr>
                <th>Family</th>
                <th>RC</th>
                <th style={{ textAlign: "right" }}>Mean (/yr)</th>
                <th style={{ textAlign: "right" }}>5th %ile</th>
                <th style={{ textAlign: "right" }}>95th %ile</th>
              </tr>
            </thead>
            <tbody>
              {esqResults.map((r) => (
                <tr key={r.familyId}>
                  <td><div className="postable__name">{r.familyId}</div><span className="postable__name-sub">{r.label}</span></td>
                  <td><span className={`estree__seq-rcpill estree__seq-rcpill--${rcTone(r.rc)}`}>{r.rc}</span></td>
                  <td style={{ textAlign: "right" }}><span className="posmono" style={{ fontWeight: 700 }}>{r.mean}</span></td>
                  <td style={{ textAlign: "right" }}><span className="posmono possubtle">{r.p5}</span></td>
                  <td style={{ textAlign: "right" }}><span className="posmono possubtle">{r.p95}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="possubtle" style={{ margin: 0 }}>No release families to quantify.</p>}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Preliminary point-estimate licensing basis events</h3>
          <ESProvenanceChip kind="es">ES → LBE · point estimate</ESProvenanceChip>
        </div>
        <p className="poscard__sub">Each sequence family is placed into a preliminary licensing-basis-event class by its point-estimate frequency, pending the full ESQ uncertainty quantification.</p>
        <table className="postable">
          <thead>
            <tr>
              <th>LBE</th>
              <th>Source family</th>
              <th>RC</th>
              <th style={{ textAlign: "right" }}>Point est. (/yr)</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {ES_LICENSING_BASIS_EVENTS.map((lbe) => {
              const cls = ES_LBE_CLASSES[lbe.lbeClass];
              return (
                <tr key={lbe.id}>
                  <td><div className="postable__name">{lbe.id}</div><span className="postable__name-sub">{lbe.name}</span></td>
                  <td><span className="posmono possubtle" style={{ fontSize: 11.5 }}>{lbe.basis}</span></td>
                  <td>{lbe.releaseCategoryId !== undefined
                    ? <span className={`estree__seq-rcpill estree__seq-rcpill--${rcTone(lbe.releaseCategoryId)}`}>{lbe.releaseCategoryId}</span>
                    : <span className="poschip">Safe state</span>}</td>
                  <td style={{ textAlign: "right" }}><span className="posmono" style={{ fontWeight: 700 }}>{fmtExp(lbe.meanFrequency)}</span></td>
                  <td><Badge kind={cls.tone}>{cls.label}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="possubtle" style={{ fontSize: 11.5, marginTop: 10, marginBottom: 0 }}>Classes follow the LMP frequency bands: AOO at or above 1E-2/yr, DBE from 1E-4 to 1E-2/yr, and BDBE from 5E-7 to 1E-4/yr. The bands firm up once ESQ returns the mean frequencies and uncertainty.</p>
      </div>

      {esqResults.length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Dominant minimal cut sets</h3>
            <ESProvenanceChip kind="es">ESQ → ES · HLR-ESQ-B</ESProvenanceChip>
          </div>
          <p className="poscard__sub">Top-ranked minimal cut sets per release family, used to verify that the dependency structure captured the dominant failure combinations.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {esqResults.map((r) => (
              <div key={r.familyId}>
                <div className="posrow" style={{ gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <span className="posmono possubtle" style={{ fontSize: 12 }}>{r.familyId}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "var(--color-text)" }}>{r.label}</span>
                  <span className="poscomment__foot-spacer" />
                  <span className={`estree__seq-rcpill estree__seq-rcpill--${rcTone(r.rc)}`}>{r.rc}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {r.mcs.map((mcs) => (
                    <div key={mcs.rank} className="posrow" style={{ gap: 8, padding: "7px 10px", background: "var(--color-surface-2, var(--color-surface-low))", borderRadius: 6, alignItems: "center" }}>
                      <span className="posmono possubtle" style={{ fontSize: 11, minWidth: 44 }}>MCS-{mcs.rank}</span>
                      <div className="posrow posrow--wrap" style={{ gap: 5, flex: 1 }}>
                        {mcs.events.map((ev) => (
                          <span key={ev} className="poschip posmono" style={{ fontSize: 11 }}>{ev}</span>
                        ))}
                      </div>
                      <span className="posmono possubtle" style={{ fontSize: 11, whiteSpace: "nowrap" }}>{mcs.freq} /yr</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { es } = useEsWorkbook();
  const ready = scores.blocked === 0;
  const TOC_ITEMS: [string, string][] = [
    ["Executive summary", "5"],
    ["Introduction", "6"],
    ["    Purpose", "6"],
    ["    Scope", "6"],
    ["    Relationship to other documents", "6"],
    ["    Document layout", "6"],
    ["    Quality assurance", "6"],
    ["    Freeze date", "6"],
    ["Assumptions & limitations", "7"],
    ["Initiating events selected for ES analysis", "8"],
    ["Event sequence development", "9"],
    ["    General framework of ES models", "9"],
    ["    Event sequence end states", "9"],
    ["    Implementation of the framework", "9"],
    ["    Response of plant systems & structures", "9"],
    ["    Source term characteristics", "9"],
    ["    Event sequence development models", "9"],
    ["Event sequence analysis for mode & state", "10"],
    ["    Common elements (scope, success criteria, mitigation)", "10"],
    ["    Key assumptions & uncertainties", "10"],
    ["    Event sequence quantification", "10"],
    ["    Event sequence models", "10"],
    ["Preliminary point-estimate licensing basis events", "11"],
    ["References", "12"],
  ];
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{es.name}</h1>
        <h2>Preliminary Event Sequence Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {TOC_ITEMS.map(([t, p], i) => (<div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>))}
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
          <h3 className="posgen__readout-h">Send to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>, so making the draft locks Steps 1-8 and moves the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention, so you can still make a working draft, but it cannot be approved until they are fixed.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}><ESIcon.Send /> Submit draft to internal review</button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateEsReport(es, ready); }}><ESIcon.Download /> Download draft (.docx)</button>
          </div>
        </div>

        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Where it goes next</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>The sequences feed the next steps directly.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="poschip poschip--method"><ESIcon.ArrowR /> Event Sequence Quantification (ESQ)</span>
            <span className="poschip poschip--method"><ESIcon.ArrowR /> Mechanistic Source Term (MS)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="esplaceholder">
        <ESIcon.Tree />
        <div style={{ fontWeight: 700, color: "var(--color-text)" }}>{label}</div>
        <div className="possubtle">This step is part of the Event Sequence Analysis build and lands in a later phase.</div>
      </div>
    </div>
  );
}

export {
  EsScopeScreen,
  SequencesScreen,
  DependenciesScreen,
  TimingScreen,
  EndStatesScreen,
  FamiliesScreen,
  ScreeningScreen,
  QuantScreen,
  DraftScreen,
  PlaceholderScreen,
  type ScreenProps,
  type ScopeScreenProps,
};
