import { Fragment, JSX, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ESIcon } from "./esIcons";
import { Badge, ESProvenanceChip, fmtImportance } from "./esShared";
import {
  CAPABILITY_CATEGORIES,
  ES_END_STATES,
  ES_RELEASE_CATEGORIES,
  FEASIBILITY_CRITERIA,
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
import { type KeySafetyFunction, type DynamicRun, type Dependency, DependencyType, type OperatorActionWindow, type FeasibilityState, type PhenomenologicalDependencyModel, type ReleaseCategoryMapping } from "interfaces-mef-types/es/event-sequence-analysis";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { useEsWorkbook } from "./esWorkbookContext";
import {
  eventTreesView,
  coverageView,
  familiesView,
  releaseMappingsView,
  screeningView,
  dependenciesView,
  sequencesView,
  timelineView,
  type EventTreeView,
  type TreeNodeView,
  type SeqLeafRef,
  type SeqLeafView,
  type DependencyView,
  type CcScore,
} from "./esSelectors";
import { generateEsReport } from "./esDocx";
import "./css/esScreens.css";

function NamedIcon({ name }: { name: string }): JSX.Element {
  const Icon = ESIcon[name] ?? ESIcon.Link;
  return <Icon />;
}

function fmtExp(n: number | undefined): string {
  return n === undefined ? "—" : n.toExponential(1);
}

function fmtDur(h: number): string {
  return h >= 8760 ? `${(h / 8760).toFixed(1)} yr` : `${Math.round(h)} h`;
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

type DrawerCtx = { kind: "sequence"; id: string } | { kind: "dependency"; id: string } | { kind: "operatorAction"; id: string } | { kind: "phenomenon"; id: string } | { kind: "releaseCategory"; id: string };

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
  const { editable, mutateEs, ieLink } = useEsWorkbook();
  const d = deps.find((x) => x.id === depId);
  if (d === undefined) return null;
  const meta = ES_DEPENDENCY_TYPES[d.type];
  const imp = fmtImportance(d.importance);
  const ieName = (ie: string): string => ieLink.initiators.find((i) => i.id === ie)?.name ?? trees.find((t) => t.initiatingEventId === ie)?.name ?? ie;
  const ieChipLabel = (ie: string): string => (ieName(ie) === ie ? ie : `${ie} · ${ieName(ie)}`);
  const ieOptions = Array.from(new Set([...ieLink.initiators.map((i) => i.id), ...trees.map((t) => t.initiatingEventId), ...d.initiatingEvents]));

  function patchDep(patch: Partial<Dependency>): void {
    if (!editable) return;
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: {
        ...draft.dependencyModels,
        functionalDependencies: (draft.dependencyModels?.functionalDependencies ?? []).map((m) => ({
          ...m,
          dependencies: m.dependencies.map((x) => (x.uuid === depId ? { ...x, ...patch } : x)),
        })),
      },
    }));
  }
  function toggleIe(ie: string): void {
    const cur = d?.initiatingEvents ?? [];
    patchDep({ applicableInitiatingEvents: cur.includes(ie) ? cur.filter((x) => x !== ie) : [...cur, ie] });
  }
  function removeDep(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: {
        ...draft.dependencyModels,
        functionalDependencies: (draft.dependencyModels?.functionalDependencies ?? []).map((m) => ({
          ...m,
          dependencies: m.dependencies.filter((x) => x.uuid !== depId),
        })),
      },
    }));
  }

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
          <div className="poscard__head"><h3 className="poscard__title">Description</h3>{!editable && imp.label !== "—" && <Badge kind={imp.kind}>{imp.label} importance</Badge>}</div>
          {editable
            ? <textarea className="posfield__textarea" style={{ minHeight: 64 }} placeholder="What links these two elements, and how is it modelled?" value={d.desc} onChange={(e) => patchDep({ description: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{d.desc}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Modelling</h3></div>
          <div className="posfield-grid">
            {editable && (
              <>
                <div className="posfield"><label className="posfield__label">Dependent element</label>
                  <input className="posfield__input" value={d.from} onChange={(e) => patchDep({ dependentElement: e.target.value })} />
                </div>
                <div className="posfield"><label className="posfield__label">Depends upon</label>
                  <input className="posfield__input" value={d.to} onChange={(e) => patchDep({ dependedUponElement: e.target.value })} />
                </div>
              </>
            )}
            <div className="posfield"><label className="posfield__label">Type</label>
              {editable
                ? <select className="posfield__select" value={d.type} onChange={(e) => patchDep({ dependencyType: e.target.value as DependencyType })}>
                    {Object.entries(ES_DEPENDENCY_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                : <div><Badge kind={meta?.tone === "warn" ? "warn" : "progress"}>{meta?.label ?? d.type}</Badge></div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time-phased</label>
              {editable
                ? <select className="posfield__select" value={d.timePhased ? "yes" : "no"} onChange={(e) => patchDep({ timePhased: e.target.value === "yes" })}>
                    <option value="no">No</option>
                    <option value="yes">Yes, it changes as the event progresses</option>
                  </select>
                : <div>{d.timePhased ? "Yes, it changes as the event progresses" : "No"}</div>}
            </div>
            {editable && (
              <div className="posfield"><label className="posfield__label">Importance</label>
                <select className="posfield__select" value={d.importance ?? ""} onChange={(e) => patchDep({ importanceLevel: e.target.value.length === 0 ? undefined : (e.target.value as ImportanceLevel) })}>
                  <option value="">Not set</option>
                  <option value={ImportanceLevel.HIGH}>High</option>
                  <option value={ImportanceLevel.MEDIUM}>Medium</option>
                  <option value={ImportanceLevel.LOW}>Low</option>
                </select>
              </div>
            )}
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Appears in</label>
              {editable ? (
                <>
                  {d.initiatingEvents.length > 0 && (
                    <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 8 }}>
                      {d.initiatingEvents.map((ie) => (
                        <span key={ie} className="poschip poschip--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {ieChipLabel(ie)}
                          <button type="button" title="Remove" onClick={() => toggleIe(ie)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  {ieOptions.filter((ie) => !d.initiatingEvents.includes(ie)).length > 0 && (
                    <select className="posfield__select" value="" onChange={(e) => { if (e.target.value.length > 0) toggleIe(e.target.value); }}>
                      <option value="">Add an initiating event…</option>
                      {ieOptions.filter((ie) => !d.initiatingEvents.includes(ie)).map((ie) => <option key={ie} value={ie}>{ieChipLabel(ie)}</option>)}
                    </select>
                  )}
                </>
              ) : (
                <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                  {d.initiatingEvents.map((ie) => <span key={ie} className="poschip">{ieChipLabel(ie)}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeDep}><ESIcon.Close /> Remove dependency</button>
          </div>
        )}
      </div>
    </>
  );
}

function OperatorActionDrawerBody({ actionId, trees, onClose }: { actionId: string; trees: EventTreeView[]; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const a = (es.operatorActionWindows ?? []).find((w) => w.uuid === actionId);
  if (a === undefined) return null;
  const ieOptions = Array.from(new Set([...trees.map((t) => t.initiatingEventId), ...(a.applicableInitiatingEvents ?? [])]));
  const availMin = a.windowEndMinutes - a.windowStartMinutes;

  function patch(patchObj: Partial<OperatorActionWindow>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, operatorActionWindows: (draft.operatorActionWindows ?? []).map((w) => (w.uuid === actionId ? { ...w, ...patchObj } : w)) }));
  }
  function toggleIe(ie: string): void {
    const cur = a?.applicableInitiatingEvents ?? [];
    patch({ applicableInitiatingEvents: cur.includes(ie) ? cur.filter((x) => x !== ie) : [...cur, ie] });
  }
  function removeAction(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, operatorActionWindows: (draft.operatorActionWindows ?? []).filter((w) => w.uuid !== actionId) }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Operator action · {a.humanActionId}</div>
          <h2 className="posdrawer__title">{a.action}</h2>
          <div className="posdrawer__sub">credited from {fmtMin(a.windowStartMinutes)} to {fmtMin(a.windowEndMinutes)} after the initiator · needs {fmtMin(a.requiredMinutes)} · available {fmtMin(availMin)}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Definition</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">HFE reference</label>
              {editable ? <input className="posfield__input posmono" value={a.humanActionId} onChange={(e) => patch({ humanActionId: e.target.value })} /> : <div className="posmono">{a.humanActionId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Action</label>
              {editable ? <input className="posfield__input" value={a.action} onChange={(e) => patch({ action: e.target.value })} /> : <div>{a.action}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Cue (the signal to act)</label>
              {editable ? <input className="posfield__input" value={a.cue ?? ""} onChange={(e) => patch({ cue: e.target.value })} /> : <div>{a.cue !== undefined && a.cue.length > 0 ? a.cue : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Cue at (min)</label>
              {editable ? <input className="posfield__input posmono" value={a.cueMinutes ?? ""} onChange={(e) => patch({ cueMinutes: e.target.value.length === 0 ? undefined : Number(e.target.value) })} /> : <div className="posmono">{a.cueMinutes ?? "—"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Window (minutes after the initiator)</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Window opens</label>
              {editable ? <input className="posfield__input posmono" value={a.windowStartMinutes} onChange={(e) => patch({ windowStartMinutes: Number(e.target.value) })} /> : <div className="posmono">{a.windowStartMinutes}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Window closes</label>
              {editable ? <input className="posfield__input posmono" value={a.windowEndMinutes} onChange={(e) => patch({ windowEndMinutes: Number(e.target.value) })} /> : <div className="posmono">{a.windowEndMinutes}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Time required</label>
              {editable ? <input className="posfield__input posmono" value={a.requiredMinutes} onChange={(e) => patch({ requiredMinutes: Number(e.target.value) })} /> : <div className="posmono">{a.requiredMinutes}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">HEP</label>
              {editable ? <input className="posfield__input posmono" value={a.hepPointEstimate ?? ""} onChange={(e) => patch({ hepPointEstimate: e.target.value.length === 0 ? undefined : Number(e.target.value) })} /> : <div className="posmono">{a.hepPointEstimate !== undefined ? a.hepPointEstimate.toExponential(1) : "—"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Feasibility</h3></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {FEASIBILITY_CRITERIA.map((c) => {
              const state = a.feasibility?.[c.id] ?? "OK";
              const tone = FEASIBILITY_TONE[state] ?? "ok";
              const inner = <>{tone === "ok" ? <ESIcon.Check /> : <ESIcon.Warn />} {c.label}</>;
              return editable ? (
                <button key={c.id} type="button" className={`esact__check esact__check--${tone}`} title={`${c.hint} · click to change`}
                  onClick={() => patch({ feasibility: { ...a.feasibility, [c.id]: FEASIBILITY_CYCLE[state] ?? "OK" } })}>
                  {inner}
                </button>
              ) : (
                <span key={c.id} className={`esact__check esact__check--${tone}`} title={c.hint}>{inner}</span>
              );
            })}
          </div>
          {editable
            ? <input className="posfield__input" style={{ marginTop: 10 }} placeholder="Feasibility note (optional)" value={a.note ?? ""} onChange={(e) => patch({ note: e.target.value.length === 0 ? undefined : e.target.value })} />
            : a.note !== undefined && a.note.length > 0 && (
              <div className="eswarn" style={{ marginTop: 10 }}><span className="eswarn__icon"><ESIcon.Warn /></span><span>{a.note}</span></div>
            )}
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Applies to</h3></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {(a.applicableInitiatingEvents ?? []).map((ie) => (
              <span key={ie} className="poschip poschip--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {ie}
                {editable && <button type="button" title="Remove" onClick={() => toggleIe(ie)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>}
              </span>
            ))}
            {editable && ieOptions.filter((ie) => !(a.applicableInitiatingEvents ?? []).includes(ie)).length > 0 && (
              <select className="posfield__select" style={{ maxWidth: 200 }} value="" onChange={(e) => { if (e.target.value.length > 0) toggleIe(e.target.value); }}>
                <option value="">Add an initiating event…</option>
                {ieOptions.filter((ie) => !(a.applicableInitiatingEvents ?? []).includes(ie)).map((ie) => <option key={ie} value={ie}>{ie}</option>)}
              </select>
            )}
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeAction}><ESIcon.Close /> Remove action</button>
          </div>
        )}
      </div>
    </>
  );
}

function PhenomenonDrawerBody({ phenId, onClose }: { phenId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const p = (es.dependencyModels?.phenomenologicalDependencies ?? []).find((x) => x.uuid === phenId);
  if (p === undefined) return null;

  function patch(patchObj: Partial<PhenomenologicalDependencyModel>): void {
    if (!editable) return;
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: { ...draft.dependencyModels, phenomenologicalDependencies: (draft.dependencyModels?.phenomenologicalDependencies ?? []).map((x) => (x.uuid === phenId ? { ...x, ...patchObj } : x)) },
    }));
  }
  function removePhen(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: { ...draft.dependencyModels, phenomenologicalDependencies: (draft.dependencyModels?.phenomenologicalDependencies ?? []).filter((x) => x.uuid !== phenId) },
    }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Phenomenological condition · {p.uuid}</div>
          <h2 className="posdrawer__title">{p.name}</h2>
          <div className="posdrawer__sub">{p.phenomenon.length > 0 ? p.phenomenon : "sequence-induced condition"}{p.onsetTiming !== undefined && p.onsetTiming.length > 0 ? ` · ${p.onsetTiming}` : ""}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Description</h3></div>
          {editable
            ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="What happens, and which dependency link it drives" value={p.description} onChange={(e) => patch({ description: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{p.description}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Details</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Name</label>
              {editable ? <input className="posfield__input" value={p.name} onChange={(e) => patch({ name: e.target.value })} /> : <div>{p.name}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Phenomenon</label>
              {editable ? <input className="posfield__input" value={p.phenomenon} onChange={(e) => patch({ phenomenon: e.target.value })} /> : <div>{p.phenomenon.length > 0 ? p.phenomenon : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Onset timing</label>
              {editable ? <input className="posfield__input" value={p.onsetTiming ?? ""} onChange={(e) => patch({ onsetTiming: e.target.value.length === 0 ? undefined : e.target.value })} /> : <div>{p.onsetTiming ?? "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Analysis reference</label>
              {editable ? <input className="posfield__input" value={(p.deterministicAnalysisReferences ?? []).join(", ")} onChange={(e) => patch({ deterministicAnalysisReferences: csvList(e.target.value) })} /> : <div>{(p.deterministicAnalysisReferences ?? []).join(", ")}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Harsh conditions (comma separated)</label>
              {editable
                ? <input className="posfield__input" value={(p.environmentalConditions ?? []).join(", ")} onChange={(e) => patch({ environmentalConditions: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{(p.environmentalConditions ?? []).map((h) => <span key={h} className="poschip poschip--warn">{h}</span>)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Affected systems (comma separated)</label>
              {editable
                ? <input className="posfield__input" value={p.affectedSystems.join(", ")} onChange={(e) => patch({ affectedSystems: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{p.affectedSystems.map((s) => <span key={s} className="poschip">↯ {s}</span>)}</div>}
            </div>
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removePhen}><ESIcon.Close /> Remove condition</button>
          </div>
        )}
      </div>
    </>
  );
}

function ReleaseCategoryDrawerBody({ mappingId, onClose }: { mappingId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const m = (es.releaseCategoryMappings ?? []).find((x) => x.uuid === mappingId);
  if (m === undefined) return null;
  const rcMeta = ES_RELEASE_CATEGORIES.find((r) => r.id === m.releaseCategoryId);
  const mappedElsewhere = new Set((es.releaseCategoryMappings ?? []).filter((x) => x.uuid !== mappingId).flatMap((x) => x.eventSequenceIds));
  const eligible = es.eventSequences
    .filter((s) => s.endState === "RADIONUCLIDE_RELEASE" && !m.eventSequenceIds.includes(s.uuid) && !mappedElsewhere.has(s.uuid))
    .map((s) => s.uuid);

  function patch(patchObj: Partial<ReleaseCategoryMapping>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, releaseCategoryMappings: (draft.releaseCategoryMappings ?? []).map((x) => (x.uuid === mappingId ? { ...x, ...patchObj } : x)) }));
  }
  function toggleMember(seqId: string): void {
    const cur = m?.eventSequenceIds ?? [];
    patch({ eventSequenceIds: cur.includes(seqId) ? cur.filter((x) => x !== seqId) : [...cur, seqId] });
  }
  function removeMapping(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, releaseCategoryMappings: (draft.releaseCategoryMappings ?? []).filter((x) => x.uuid !== mappingId) }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Release category · {m.uuid}</div>
          <h2 className="posdrawer__title">{m.releaseCategoryId}{rcMeta !== undefined ? ` · ${rcMeta.name}` : ""}</h2>
          <div className="posdrawer__sub">{m.eventSequenceIds.length} sequences mapped · handed to Mechanistic Source Term (ES-C8)</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Mapping basis</h3></div>
          {editable
            ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="Why these sequences share one source-term calculation" value={m.mappingBasis} onChange={(e) => patch({ mappingBasis: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{m.mappingBasis}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Characteristics</h3></div>
          <div className="posfield-grid">
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Common characteristics (comma separated)</label>
              {editable
                ? <input className="posfield__input" value={m.commonCharacteristics.join(", ")} onChange={(e) => patch({ commonCharacteristics: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.commonCharacteristics.map((c) => <span key={c} className="poschip">{c}</span>)}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Physical release characteristics (comma separated)</label>
              {editable
                ? <input className="posfield__input" value={m.physicalReleaseCharacteristics.join(", ")} onChange={(e) => patch({ physicalReleaseCharacteristics: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{m.physicalReleaseCharacteristics.map((c) => <span key={c} className="poschip poschip--warn">{c}</span>)}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Processed by risk integration</label>
              {editable
                ? <select className="posfield__select" value={m.processedByRiskIntegration === true ? "yes" : m.processedByRiskIntegration === false ? "no" : ""} onChange={(e) => patch({ processedByRiskIntegration: e.target.value.length === 0 ? undefined : e.target.value === "yes" })}>
                    <option value="">Not set</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                : <div>{m.processedByRiskIntegration === true ? "Yes" : m.processedByRiskIntegration === false ? "No" : "—"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Member sequences</h3></div>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {m.eventSequenceIds.map((id) => (
              <span key={id} className="poschip poschip--primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {id}
                {editable && <button type="button" title="Remove" onClick={() => toggleMember(id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>}
              </span>
            ))}
            {editable && eligible.length > 0 && (
              <select className="posfield__select" style={{ maxWidth: 220 }} value="" onChange={(e) => { if (e.target.value.length > 0) toggleMember(e.target.value); }}>
                <option value="">Add a release sequence…</option>
                {eligible.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            )}
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeMapping}><ESIcon.Close /> Remove category mapping</button>
          </div>
        )}
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
        {ctx.kind === "sequence" && <SequenceDrawerBody seqId={ctx.id} trees={trees} deps={deps} onClose={onClose} />}
        {ctx.kind === "dependency" && <DependencyDrawerBody depId={ctx.id} deps={deps} trees={trees} onClose={onClose} />}
        {ctx.kind === "operatorAction" && <OperatorActionDrawerBody actionId={ctx.id} trees={trees} onClose={onClose} />}
        {ctx.kind === "phenomenon" && <PhenomenonDrawerBody phenId={ctx.id} onClose={onClose} />}
        {ctx.kind === "releaseCategory" && <ReleaseCategoryDrawerBody mappingId={ctx.id} onClose={onClose} />}
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

interface EsIfaceLane {
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  columns: string[];
  rows: { id: string; name: string; values: string[] }[];
  empty: string;
  linked: boolean;
  linkAction?: () => void;
}

function EsScopeScreen({ ccId, setCcId, stage, setStage, onOpenPosLink, onOpenIeLink }: ScopeScreenProps): JSX.Element {
  const { es, posLink, ieLink, editable, mutateEs } = useEsWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const safetyFns = es.keySafetyFunctions;
  const posLinked = posLink.linkedPosWorkbookId !== null;
  const ieLinked = ieLink.linkedIeWorkbookId !== null;
  const uniqueSources = Array.from(new Map(posLink.sources.map((s) => [s.name.trim().toLowerCase(), s])).values());

  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateEs((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateEs((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }
  function addSafetyFn(): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: [...draft.keySafetyFunctions, { id: crypto.randomUUID(), name: "New safety function", description: "", supportingSystems: [] }] }));
  }
  function updateSafetyFn(id: string, patch: Partial<KeySafetyFunction>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: draft.keySafetyFunctions.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }
  function removeSafetyFn(id: string): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: draft.keySafetyFunctions.filter((f) => f.id !== id) }));
  }

  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const familyLanes = familiesView(es);
  const releaseCats = Array.from(new Set(familyLanes.flatMap((f) => f.releaseCategoryIds)));
  const ifaceLanes: EsIfaceLane[] = [
    { code: "POS", element: "Plant Operating States", role: "Operating states", direction: "in", columns: ["Operating state", "Mode", "Duration", "Entry freq (/yr)"], rows: posLink.states.map((s) => ({ id: s.id, name: s.name, values: [s.operatingMode, fmtDur(s.meanDurationHours), s.meanEntryFrequency === 0 ? "Base state" : fmtExp(s.meanEntryFrequency)] })), empty: "No POS workbook linked yet.", linked: posLinked, linkAction: onOpenPosLink },
    { code: "IE", element: "Initiating Events", role: "Initiating events", direction: "in", columns: ["Initiating event", "Category"], rows: ieLink.initiators.map((i) => ({ id: i.id, name: i.name, values: [i.category] })), empty: "No IE workbook linked yet.", linked: ieLinked, linkAction: onOpenIeLink },
    { code: "ESQ", element: "Event Sequence Quantification", role: "Sequence families", direction: "out", columns: ["Family", "End state", "Members"], rows: familyLanes.map((f) => ({ id: f.id, name: f.name, values: [f.endState === "SUCCESSFUL_MITIGATION" ? "Safe state" : "Release", String(f.memberCount)] })), empty: "No sequence families delineated yet.", linked: true },
    { code: "MS", element: "Mechanistic Source Term", role: "Release categories", direction: "out", columns: ["Release category", "Families mapped"], rows: releaseCats.map((rc) => ({ id: rc, name: rc, values: [String(familyLanes.filter((f) => f.releaseCategoryIds.includes(rc)).length)] })), empty: "No release categories mapped yet.", linked: true },
  ];
  const selectedLane = ifaceLanes.find((l) => l.code === selectedTe);

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
          {posLinked || ieLinked ? <Badge kind="ok">Linked</Badge> : <Badge kind="warn">Not linked</Badge>}
        </div>
        <p className="poscard__sub">Event Sequence Analysis reads the operating states from POS and the initiating events from IE, and hands its end states and release categories downstream. Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button key={lane.code} type="button"
              className={`poshandoff__tile${selectedTe === lane.code ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.code ? null : lane.code)}>
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
                ? `Event Sequence Analysis receives ${selectedLane.role.toLowerCase()} from ${selectedLane.element}`
                : `${selectedLane.element} receives ${selectedLane.role.toLowerCase()} from Event Sequence Analysis`}
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
              <div className="posrow" style={{ gap: 12, alignItems: "center" }}>
                <p className="posmuted" style={{ margin: 0 }}>{selectedLane.empty}</p>
                {!selectedLane.linked && selectedLane.linkAction !== undefined && (
                  <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={selectedLane.linkAction}><ESIcon.Link /> Link {selectedLane.code} workbook</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sources &amp; radionuclide transport barriers</h3>
          <ESProvenanceChip>POS</ESProvenanceChip>
        </div>
        <p className="poscard__sub">Imported from the linked POS workbook. For each source, ES watches the barriers that decide whether a scenario ends in a release (ES-A2).</p>
        {uniqueSources.length > 0 ? (
          <table className="postable">
            <thead><tr><th>Source</th><th>Location</th><th>Radionuclide transport barriers</th></tr></thead>
            <tbody>
              {uniqueSources.map((src) => (
                <tr key={src.id}>
                  <td>
                    <div className="postable__name"><span style={{ display: "inline-flex", width: 15, height: 15, verticalAlign: "-2px", marginRight: 6, color: "var(--color-primary)" }}><ESIcon.Radiation /></span>{src.name}</div>
                  </td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{src.location}</td>
                  <td><div className="posrow posrow--wrap" style={{ gap: 6 }}>{src.barriers.map((b) => <span key={b} className="poschip">{b}</span>)}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="posrow" style={{ gap: 12, alignItems: "center" }}>
            <p className="possubtle" style={{ margin: 0, fontSize: 12.5 }}>No POS workbook linked, so no sources have been imported yet.</p>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onOpenPosLink}><ESIcon.Link /> Link POS workbook</button>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Key reactor-specific safety functions</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            {safetyFns.length > 0 && <Badge kind="progress">{safetyFns.length} functions</Badge>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addSafetyFn}><ESIcon.Plus /> Add function</button>}
          </div>
        </div>
        <p className="poscard__sub">The functions every scenario must satisfy to protect a barrier and reach a safe stable state (ES-A3, ES-A4).</p>
        {safetyFns.length > 0 ? (
          <div className="essf-grid">
            {safetyFns.map((sf) => (
              <div key={sf.id} className="essf">
                <span className="essf__icon"><NamedIcon name="Shield" /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
                    {editable
                      ? <input className="posfield__input" style={{ fontWeight: 700, flex: 1, minWidth: 0 }} value={sf.name} onChange={(e) => updateSafetyFn(sf.id, { name: e.target.value })} />
                      : <span className="essf__name">{sf.name}</span>}
                    {sf.successCriteriaId !== undefined && sf.successCriteriaId.length > 0 && <ESProvenanceChip kind="sc">{sf.successCriteriaId}</ESProvenanceChip>}
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" title="Remove" onClick={() => removeSafetyFn(sf.id)}><ESIcon.Close /></button>}
                  </div>
                  {editable
                    ? <textarea className="posfield__textarea" style={{ minHeight: 42, marginTop: 6 }} value={sf.description} onChange={(e) => updateSafetyFn(sf.id, { description: e.target.value })} />
                    : sf.description.length > 0 && <div className="essf__desc">{sf.description}</div>}
                  {editable
                    ? <input className="posfield__input" style={{ marginTop: 6 }} placeholder="Supporting systems, comma separated" value={sf.supportingSystems.join(", ")} onChange={(e) => updateSafetyFn(sf.id, { supportingSystems: e.target.value.split(",").map((x) => x.trim()).filter((x) => x.length > 0) })} />
                    : sf.supportingSystems.length > 0 && <div className="essf__sys">{sf.supportingSystems.map((y) => <span key={y} className="poschip">{y}</span>)}</div>}
                </div>
              </div>
            ))}
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
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
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
                <input type="radio" name="es-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
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

function fmtEsdProb(p: number): string {
  if (p >= 0.1) return `${(p * 100).toFixed(1)}%`;
  if (p >= 0.01) return `${(p * 100).toFixed(2)}%`;
  return p.toExponential(1);
}

interface DynEsdNodeBox { key: string; x: number; y: number; fn?: string; condition: string; seqs: string[]; }
interface DynEsdLink { startX: number; startY: number; splitX: number; endX: number; endY: number; kind: "S" | "F"; seqs: string[]; }
interface DynEsdBLab { x: number; y: number; kind: "S" | "F"; text: string; }
interface DynEsdLeafPos { seqId: string; y: number; timing?: string; }
interface DynEsdLayout {
  nodes: DynEsdNodeBox[]; links: DynEsdLink[]; labels: DynEsdBLab[]; leaves: DynEsdLeafPos[];
  initX: number; initW: number; initRight: number; rootX: number; rootY: number;
  xEnd: number; boxW: number; leafW: number; width: number; height: number;
}

function layoutDynEsd(run: DynamicRun, availW: number): DynEsdLayout {
  const INITX = 10;
  const INITW = 84;
  const LEFT = 128;
  const BOXW = 196;
  const ROWH = 108;
  const TOP = 48;
  const SPLIT = 28;
  const NAT_COLW = 312;
  const PW = 200;
  const LEAFGAP = 6;
  const RIGHTPAD = 10;
  const reserved = LEAFGAP + PW + RIGHTPAD;

  const depthOf = new Map<string, number>();
  const yOfNode = new Map<string, number>();
  const yOfLeaf = new Map<string, number>();
  const leafOrder: DynEsdLeafPos[] = [];
  let row = 0;
  let maxDepth = 0;

  function assignY(nodeId: string, depth: number): number {
    const node = run.esdNodes[nodeId];
    if (node === undefined) {
      const y = TOP + (row + 0.5) * ROWH;
      row += 1;
      return y;
    }
    depthOf.set(nodeId, depth);
    if (depth > maxDepth) maxDepth = depth;
    const ys: number[] = [];
    for (const b of node.branches) {
      if (b.targetNodeId !== undefined && run.esdNodes[b.targetNodeId] !== undefined) {
        ys.push(assignY(b.targetNodeId, depth + 1));
      } else if (b.sequenceId !== undefined) {
        const y = TOP + (row + 0.5) * ROWH;
        row += 1;
        yOfLeaf.set(b.sequenceId, y);
        leafOrder.push({ seqId: b.sequenceId, y, timing: b.timing });
        ys.push(y);
      }
    }
    const y = ys.length > 0 ? ((ys[0] ?? 0) + (ys[ys.length - 1] ?? 0)) / 2 : TOP + (row + 0.5) * ROWH;
    yOfNode.set(nodeId, y);
    return y;
  }
  const rootY = assignY(run.rootNodeId, 0);
  const spans = maxDepth + 1;
  const naturalWidth = LEFT + spans * NAT_COLW + reserved;
  const width = availW > naturalWidth ? availW : naturalWidth;
  const COLW = (width - LEFT - reserved) / spans;
  const xOfDepth = (d: number): number => LEFT + d * COLW;
  const xEnd = width - reserved;

  const leafCache = new Map<string, string[]>();
  function leafSeqs(nodeId: string): string[] {
    const cached = leafCache.get(nodeId);
    if (cached !== undefined) return cached;
    const node = run.esdNodes[nodeId];
    const acc: string[] = [];
    if (node !== undefined) {
      for (const b of node.branches) {
        if (b.targetNodeId !== undefined && run.esdNodes[b.targetNodeId] !== undefined) acc.push(...leafSeqs(b.targetNodeId));
        else if (b.sequenceId !== undefined) acc.push(b.sequenceId);
      }
    }
    leafCache.set(nodeId, acc);
    return acc;
  }

  const nodes: DynEsdNodeBox[] = [];
  const links: DynEsdLink[] = [];
  const labels: DynEsdBLab[] = [];
  function build(nodeId: string): void {
    const node = run.esdNodes[nodeId];
    if (node === undefined) return;
    const depth = depthOf.get(nodeId) ?? 0;
    const ny = yOfNode.get(nodeId) ?? 0;
    const bx = xOfDepth(depth);
    nodes.push({ key: nodeId, x: bx, y: ny, fn: node.challengedFunctionId, condition: node.condition, seqs: leafSeqs(nodeId) });
    for (const b of node.branches) {
      const kind: "S" | "F" = b.outcome === "Success" ? "S" : "F";
      const startX = bx + BOXW;
      const startY = ny;
      let endX: number;
      let endY: number;
      let seqs: string[];
      if (b.targetNodeId !== undefined && run.esdNodes[b.targetNodeId] !== undefined) {
        endY = yOfNode.get(b.targetNodeId) ?? 0;
        endX = xOfDepth(depthOf.get(b.targetNodeId) ?? depth + 1);
        seqs = leafSeqs(b.targetNodeId);
        build(b.targetNodeId);
      } else if (b.sequenceId !== undefined) {
        endY = yOfLeaf.get(b.sequenceId) ?? 0;
        endX = xEnd;
        seqs = [b.sequenceId];
      } else {
        endY = startY;
        endX = xEnd;
        seqs = [];
      }
      const splitX = startX + SPLIT;
      links.push({ startX, startY, splitX, endX, endY, kind, seqs });
      const probTxt = b.probability !== undefined ? fmtEsdProb(b.probability) : "";
      labels.push({ x: splitX + 5, y: (startY + endY) / 2, kind, text: `${kind === "S" ? "✓" : "✗"} ${probTxt}`.trim() });
    }
  }
  build(run.rootNodeId);

  return {
    nodes, links, labels, leaves: leafOrder,
    initX: INITX, initW: INITW, initRight: INITX + INITW, rootX: LEFT, rootY,
    xEnd, boxW: BOXW, leafW: PW, width, height: TOP + row * ROWH + 20,
  };
}

function DynamicEsdTree({ run, leaves, activeSeq, onHover, onSelect }: {
  run: DynamicRun;
  leaves: Map<string, SeqLeafView>;
  activeSeq: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [availW, setAvailW] = useState<number>(0);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    const measure = (): void => setAvailW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, []);
  const L = useMemo(() => layoutDynEsd(run, availW), [run, availW]);
  const isHot = (seqs: string[]): boolean => activeSeq !== null && seqs.includes(activeSeq);
  return (
    <div className="estree__scroll" ref={scrollRef}>
      <div className="esdt" style={{ width: L.width, height: L.height }}>
        <svg className="estree__svg" width={L.width} height={L.height}>
          <defs>
            <marker id="esdt-s" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--c-complete)" /></marker>
            <marker id="esdt-f" markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#c44d4d" /></marker>
          </defs>
          <path className="esdt__trunk" d={`M ${L.initRight} ${L.rootY} H ${L.rootX}`} />
          {L.links.map((l, i) => (
            <path key={i} className={`esdt__link esdt__link--${l.kind.toLowerCase()}${isHot(l.seqs) ? " esdt__link--hot" : ""}`}
              d={`M ${l.startX} ${l.startY} H ${l.splitX} V ${l.endY} H ${l.endX}`} markerEnd={`url(#esdt-${l.kind.toLowerCase()})`} />
          ))}
        </svg>
        <div className="esdt__ie" style={{ left: L.initX, top: L.rootY, width: L.initW }}>
          <div className="esdt__ie-cap">Initiator</div>
          <div className="esdt__ie-id">{run.initiatingEventId}</div>
        </div>
        {L.nodes.map((n) => (
          <div key={n.key} className={`esdt__node${isHot(n.seqs) ? " esdt__node--hot" : ""}`} style={{ left: n.x, top: n.y, width: L.boxW }}>
            {n.fn !== undefined && <span className="esdt__fn">{n.fn}</span>}
            <span className="esdt__cond" title={n.condition}>{n.condition}</span>
          </div>
        ))}
        {L.labels.map((b, i) => (
          <div key={i} className={`esdt__blab esdt__blab--${b.kind.toLowerCase()}`} style={{ left: b.x, top: b.y }}>
            {b.text}
          </div>
        ))}
        {L.leaves.map((lf) => {
          const s = leaves.get(lf.seqId);
          const ok = s?.endState === "SUCCESSFUL_MITIGATION";
          const label = ok ? "Safe stable state" : s?.releaseCategoryId !== undefined ? `Release · ${s.releaseCategoryId}` : "Release";
          return (
            <button key={lf.seqId} type="button"
              className={`esdt__leaf esdt__leaf--${ok ? "ok" : "rel"}${activeSeq === lf.seqId ? " esdt__leaf--active" : ""}`}
              style={{ left: L.xEnd + 6, top: lf.y, width: L.leafW }}
              onMouseEnter={() => onHover(lf.seqId)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(lf.seqId)}>
              <span className={`estree__seq-end estree__seq-end--${ok ? "ok" : "block"}`} />
              <span className="esdt__leaf-main">
                <span className="esdt__leaf-end">{label}</span>
                <span className="esdt__leaf-id posmono">{lf.seqId}{s?.meanFrequency !== undefined ? ` · ${fmtExp(s.meanFrequency)}/yr` : ""}</span>
                {lf.timing !== undefined && lf.timing.length > 0 && <span className="esdt__leaf-time">{lf.timing}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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
  const run = (es.dynamicRuns ?? []).find((r) => r.eventTreeId === tree.id);

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Coverage</h3>
        </div>
        <p className="poscard__sub">ES lays out a sequence set for every operating-state and initiating-event pair, where a filled cell means a set exists that you can click to open. Empty cells are pairs that have not been laid out yet.</p>
        <div className="esmatrix-wrap">
          <table className="esmatrix">
            <thead>
              <tr>
                <th className="esmatrix__corner">Operating state</th>
                {coverage.ies.map((ie) => (
                  <th key={ie.id} className={`esmatrix__col${tree.initiatingEventId === ie.id ? " esmatrix__col--active" : ""}`}>{ie.id}</th>
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
                  {coverage.ies.map((ie) => {
                    const cellTreeId = coverage.cellTree[`${ie.id}|${st.id}`];
                    const on = cellTreeId !== undefined;
                    const sel = on && cellTreeId === treeId;
                    return (
                      <td key={ie.id}
                        className={`esmatrix__cell${on ? " esmatrix__cell--on" : ""}${sel ? " esmatrix__cell--sel" : ""}`}
                        onClick={on ? () => { setTreeId(cellTreeId); setPosId(st.id); } : undefined}
                        title={on ? `${ie.id} in ${st.id}` : `${ie.id} not laid out in ${st.id}`}>
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
          <span className="estree__legend-item"><span className="esmatrix__na" style={{ fontWeight: 700 }}>·</span> Not laid out yet</span>
          <span className="estree__legend-item">{coverage.ies.length} initiating events from IE · {coverage.states.length} operating states from POS</span>
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
          {tree.applicableStates.map((p) => (
            <button key={p} type="button" className={`poschip${posId === p ? " poschip--primary" : ""}`} onClick={() => setPosId(p)}>{p}</button>
          ))}
        </div>
        <div className="posrow posrow--wrap" style={{ gap: 18, fontSize: 12.5 }}>
          <span><span className="possubtle">IE frequency</span> <strong className="posmono" style={{ color: "var(--color-text)" }}>{fmtExp(tree.ieFreq)}/plant-yr</strong></span>
          <span><span className="possubtle">Mission time</span> <strong className="posmono" style={{ color: "var(--color-text)" }}>{tree.missionTime ?? "—"} {tree.missionTimeUnits ?? ""}</strong></span>
          <span><span className="possubtle">Sequences</span> <strong style={{ color: "var(--color-text)" }}>{tree.sequences.length}</strong> <span className="possubtle">({okN} safe · {relN} release)</span></span>
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
            <div className="possubtle" style={{ textAlign: "right", fontSize: 11.5, padding: "6px 16px 0" }}>Click on any end state to see its path</div>
            <EventTreeDiagram view={tree} showFreq={showFreq} activeSeq={hovered} onHover={setHovered} onSelect={(id) => setDrawer({ kind: "sequence", id })} />
            <div className="estree__legend" style={{ justifyContent: "center" }}>
              <span className="estree__legend-item"><span className="estree__legend-dot" style={{ background: "var(--c-complete)" }} /> Safe stable state</span>
              <span className="estree__legend-item"><span className="estree__legend-dot" style={{ background: "#c44d4d" }} /> Radionuclide release</span>
              <span className="estree__legend-item"><strong style={{ color: "var(--c-complete)" }}>S</strong> mitigating function succeeds</span>
              <span className="estree__legend-item"><strong style={{ color: "#b73b3b" }}>F</strong> function fails</span>
            </div>
          </>
        )}

        {repr === "esd" && (
          <>
            {run !== undefined ? (
              <DynamicEsdTree run={run} leaves={new Map(tree.sequences.map((s) => [s.id, s]))} activeSeq={hovered} onHover={setHovered} onSelect={(id) => setDrawer({ kind: "sequence", id })} />
            ) : (
              <EventSeqDiagram view={tree} showFreq={showFreq} activeSeq={hovered} onHover={setHovered} onSelect={(id) => setDrawer({ kind: "sequence", id })} />
            )}
            <div className="estree__legend" style={{ justifyContent: "center" }}>
              {run !== undefined ? (
                <>
                  <span className="estree__legend-item"><strong style={{ color: "var(--c-complete)" }}>✓</strong> heat removed / boundary holds · <strong style={{ color: "#b73b3b" }}>✗</strong> function fails</span>
                  <span className="estree__legend-item"><span className="estree__legend-dot" style={{ background: "var(--c-complete)" }} /> safe stable state · <span className="estree__legend-dot" style={{ background: "#c44d4d" }} /> release category</span>
                </>
              ) : (
                <>
                  <span className="estree__legend-item"><span className="esdg-swatch esdg-swatch--operator" /> Operator action / decision</span>
                  <span className="estree__legend-item"><span className="esdg-swatch esdg-swatch--auto" /> Automatic actuation</span>
                  <span className="estree__legend-item"><span className="esdg-swatch esdg-swatch--passive" /> Passive / inherent</span>
                  <span className="estree__legend-item"><strong style={{ color: "var(--c-complete)" }}>S</strong> succeeds · <strong style={{ color: "#b73b3b" }}>F</strong> fails</span>
                  <span className="estree__legend-item">Each block is a question, in the order the operators meet it</span>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function DependenciesScreen(): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const deps = useMemo(() => dependenciesView(es), [es]);
  const [filter, setFilter] = useState<string>("all");
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const types = Array.from(new Set(deps.map((d) => d.type)));
  const shown = filter === "all" || !types.includes(filter) ? deps : deps.filter((d) => d.type === filter);

  function addDependency(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    const dep: Dependency = {
      uuid: id,
      dependentElement: "New dependent element",
      dependedUponElement: "Depended-upon element",
      dependencyType: DependencyType.FUNCTIONAL,
      description: "",
      timePhased: false,
      applicableInitiatingEvents: [],
      implementsSrs: [],
    };
    mutateEs((draft) => {
      const models = draft.dependencyModels?.functionalDependencies ?? [];
      const next = models.length > 0
        ? models.map((m, i) => (i === 0 ? { ...m, dependencies: [...m.dependencies, dep] } : m))
        : [{ uuid: crypto.randomUUID(), name: "Event-sequence dependency catalogue", description: "Dependencies linking successes and failures across the event sequences (HLR-ES-B).", involvedSystems: [], dependencies: [dep], implementsSrs: [] }];
      return { ...draft, dependencyModels: { ...draft.dependencyModels, functionalDependencies: next } };
    });
    setFilter("all");
    setDrawer({ kind: "dependency", id });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Dependencies across the event sequences</h3>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addDependency}><ESIcon.Plus /> Add dependency</button>}
        </div>
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
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function fmtMin(m: number): string {
  if (m <= 0) return "t₀";
  if (m < 60) return `${Math.round(m * 10) / 10} min`;
  return `${Math.round((m / 60) * 10) / 10} h`;
}

const FEASIBILITY_TONE: Record<string, "ok" | "warn" | "block"> = { OK: "ok", MARGINAL: "warn", NOT_MET: "block" };
const FEASIBILITY_CYCLE: Record<string, FeasibilityState> = { OK: "MARGINAL", MARGINAL: "NOT_MET", NOT_MET: "OK" };

function csvList(value: string): string[] {
  return value.split(",").map((x) => x.trim()).filter((x) => x.length > 0);
}

function TimingScreen(): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const trees = useMemo(() => eventTreesView(es), [es]);
  const [treeId, setTreeId] = useState<string>(trees[0]?.id ?? "");
  const [selT, setSelT] = useState<number | null>(null);
  const tree = trees.find((t) => t.id === treeId) ?? trees[0];
  const TL = useMemo(() => timelineView(es, tree?.id ?? ""), [es, tree?.id]);
  const dotGroups = useMemo(() => {
    const byT = new Map<number, typeof TL.milestones>();
    for (const m of TL.milestones) {
      const arr = byT.get(m.t);
      if (arr === undefined) byT.set(m.t, [m]);
      else arr.push(m);
    }
    const rank: Record<string, number> = { limit: 0, init: 1, cue: 2, op: 3, auto: 4 };
    return Array.from(byT.entries())
      .map(([t, items]) => ({ t, items, kind: items.reduce((best, m) => ((rank[m.kind] ?? 9) < (rank[best] ?? 9) ? m.kind : best), items[0]?.kind ?? "auto") }))
      .sort((a, b) => a.t - b.t);
  }, [TL.milestones]);
  const selGroup = selT !== null ? dotGroups.find((g) => g.t === selT) : undefined;
  const KIND_LABEL: Record<string, string> = { init: "Initiating event", auto: "Automatic / passive", cue: "Operator cue", op: "Operator window opens", limit: "Damage limit" };
  const railRef = useRef<HTMLDivElement>(null);
  const [railW, setRailW] = useState<number>(900);
  useLayoutEffect(() => {
    const el = railRef.current;
    if (el === null) return;
    const measure = (): void => { if (el.clientWidth > 0) setRailW(el.clientWidth); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [TL.milestones.length]);
  const windows = es.operatorActionWindows ?? [];
  const phens = es.dependencyModels?.phenomenologicalDependencies ?? [];
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);

  const tMin = 0.1;
  const tMax = Math.max(TL.tMax, 60);
  const lo = Math.log(tMin);
  const hi = Math.log(tMax);
  const pos = (t: number): number => Math.min(((Math.log(Math.max(t, tMin)) - lo) / (hi - lo)) * 100, 100);
  const tickCandidates: { t: number; label: string }[] = [
    { t: 0.1, label: "t₀" }, { t: 1, label: "1 min" }, { t: 10, label: "10 min" },
    { t: 60, label: "1 h" }, { t: 240, label: "4 h" }, { t: 480, label: "8 h" },
    { t: 1440, label: "24 h" }, { t: 2880, label: "48 h" },
  ];
  const ticks = tickCandidates.filter((tk) => tk.t <= tMax);

  const rail = useMemo(() => {
    const laneH = 15;
    const charW = 5.8;
    const dots = dotGroups.map((g) => {
      const label = fmtMin(g.t);
      return { t: g.t, kind: g.kind, items: g.items, x: (pos(g.t) / 100) * railW, label, w: label.length * charW + 6 };
    });
    const clusters: (typeof dots)[] = [];
    let cur: typeof dots = [];
    for (const d of dots) {
      const prev = cur[cur.length - 1];
      if (prev !== undefined && d.x - prev.x < d.w + prev.w + 12) cur.push(d);
      else { if (cur.length > 0) clusters.push(cur); cur = [d]; }
    }
    if (cur.length > 0) clusters.push(cur);
    const placed: { t: number; kind: string; items: typeof dotGroups[number]["items"]; x: number; label: string; lane: number; anchor: "center" | "left" | "right" }[] = [];
    let maxLane = 0;
    for (const cl of clusters) {
      if (cl.length === 1) {
        placed.push({ ...cl[0], lane: 0, anchor: "center" });
        continue;
      }
      const nearLeftEdge = cl[0].x - cl[0].w - 8 < 0;
      cl.forEach((d, j) => {
        const lane = nearLeftEdge ? cl.length - 1 - j : j;
        placed.push({ ...d, lane, anchor: nearLeftEdge ? "right" : "left" });
        if (lane > maxLane) maxLane = lane;
      });
    }
    const stripH = 18;
    const labelY = (lane: number): number => stripH + 4 + (maxLane - lane) * laneH;
    const stemTop = (lane: number): number => labelY(lane) + 11;
    const axisY = stripH + 4 + (maxLane + 1) * laneH + 14;
    const height = axisY + 38;
    return { placed, labelY, stemTop, axisY, height };
  }, [dotGroups, railW, tMax]);

  function addWindow(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    const w: OperatorActionWindow = {
      uuid: id,
      humanActionId: "HFE-",
      action: "New operator action",
      cue: "",
      windowStartMinutes: 10,
      windowEndMinutes: 120,
      requiredMinutes: 15,
      feasibility: { time: "OK", env: "OK", proc: "OK", train: "OK", equip: "OK" },
      applicableInitiatingEvents: [],
      implementsSrs: [],
    };
    mutateEs((draft) => ({ ...draft, operatorActionWindows: [...(draft.operatorActionWindows ?? []), w] }));
    setDrawer({ kind: "operatorAction", id });
  }
  function addPhen(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    const p: PhenomenologicalDependencyModel = {
      uuid: id,
      name: "New phenomenological condition",
      description: "",
      phenomenon: "",
      affectedSystems: [],
      environmentalConditions: [],
      implementsSrs: [],
    };
    mutateEs((draft) => ({
      ...draft,
      dependencyModels: { ...draft.dependencyModels, phenomenologicalDependencies: [...(draft.dependencyModels?.phenomenologicalDependencies ?? []), p] },
    }));
    setDrawer({ kind: "phenomenon", id });
  }

  if (tree === undefined || es.eventSequences.length === 0) {
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
          <span className="possubtle">Mission time {tree.missionTime ?? "—"} {tree.missionTimeUnits ?? ""}</span>
        </div>
        <p className="poscard__sub">Every milestone comes from the dynamic-PRA run for the selected sequence set; the shaded band starts at the earliest cladding-damage time when no heat-removal path succeeds (ES-A6).</p>
        <div className="posrow" style={{ marginBottom: 10 }}>
          <select className="posfield__select" style={{ maxWidth: 420 }} value={tree.id} onChange={(e) => { setTreeId(e.target.value); setSelT(null); }}>
            {trees.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {TL.milestones.length === 0 ? (
          <EsEmpty title="No timing data for this sequence set" hint="The dynamic-PRA run for this cell has no sequence timing entries." />
        ) : (
          <>
            <div className="estl estl--dots" ref={railRef} style={{ height: rail.height }}>
              {TL.damageFrom !== null && (
                <div className="estl__band" style={{ left: `${pos(TL.damageFrom)}%`, top: 18, bottom: rail.height - rail.axisY - 8 }}>
                  <span className="estl__band-label">Cladding damage if no DHR</span>
                </div>
              )}
              {rail.placed.map((g) => {
                const labStyle: { left: number; top: number; transform?: string } = { left: g.x, top: rail.labelY(g.lane) };
                if (g.anchor === "center") labStyle.transform = "translateX(-50%)";
                else if (g.anchor === "left") { labStyle.left = g.x - 4; labStyle.transform = "translateX(-100%)"; }
                else labStyle.left = g.x + 4;
                return (
                  <Fragment key={g.t}>
                    <span className="estl__stem" style={{ left: g.x, top: rail.stemTop(g.lane), height: rail.axisY - rail.stemTop(g.lane) }} />
                    <span className="estl__stemlab" style={labStyle}>{g.label}</span>
                    <button type="button"
                      className={`estl__dotbtn estl__dotbtn--${g.kind}${selT === g.t ? " estl__dotbtn--sel" : ""}`}
                      style={{ left: g.x, top: rail.axisY + 1 }}
                      title={`${g.label} · ${g.items.length} event${g.items.length === 1 ? "" : "s"}`}
                      onClick={() => setSelT(selT === g.t ? null : g.t)} />
                  </Fragment>
                );
              })}
              <div className="estl__axis" style={{ top: rail.axisY }} />
              <div className="estl__ticks" style={{ top: rail.axisY + 10 }}>
                {ticks.map((tk, i) => (
                  <span key={i} className="estl__tick" style={{ left: `${pos(tk.t)}%` }}>{tk.label}</span>
                ))}
              </div>
            </div>
            {selGroup !== undefined && (
              <div className="estl__detail">
                <div className="estl__detail-head">
                  <span className="posmono" style={{ fontWeight: 700 }}>{fmtMin(selGroup.t)}</span>
                  <span className="possubtle">after the initiating event</span>
                  <span className="poscomment__foot-spacer" />
                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setSelT(null)}><ESIcon.Close /></button>
                </div>
                {selGroup.items.map((m, i) => (
                  <div key={i} className="estl__detail-row">
                    <span className={`estl__flag-dot estl__flag-dot--${m.kind}`} />
                    <span style={{ fontWeight: 600, color: "var(--color-text)" }}>{m.label}</span>
                    <span className="possubtle">{KIND_LABEL[m.kind] ?? m.kind}</span>
                    {m.basis !== undefined && <span className="poschip poschip--method">{m.basis}</span>}
                  </div>
                ))}
              </div>
            )}
            <div className="estl__legend">
              <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--init" /> Initiating event</span>
              <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--auto" /> Automatic / passive</span>
              <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--cue" /> Operator cue</span>
              <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--op" /> Operator window opens</span>
              <span className="estl__legend-item"><span className="estl__flag-dot estl__flag-dot--limit" /> Damage limit</span>
              <span className="estl__legend-item">log time scale · click a dot for details</span>
            </div>
          </>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operator-action windows</h3>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addWindow}><ESIcon.Plus /> Add action</button>}
        </div>
        <p className="poscard__sub">An operator action is credited only when all five checks hold (time, environment, procedure, training, equipment) and the time required fits inside the window the physics leaves open (ES-A4).</p>
        {windows.length === 0 && <EsEmpty title="No operator actions credited yet" hint="Add each credited action with its cue, window, and required time (ES-A4)." />}
        {windows.map((a) => {
          const x0 = pos(a.windowStartMinutes);
          const x1 = pos(a.windowEndMinutes);
          const reqPct = x1 > x0 ? Math.min(((pos(a.windowStartMinutes + a.requiredMinutes) - x0) / (x1 - x0)) * 100, 100) : 100;
          const availMin = a.windowEndMinutes - a.windowStartMinutes;
          return (
            <button key={a.uuid} type="button" className="esact esact--click" onClick={() => setDrawer({ kind: "operatorAction", id: a.uuid })}>
              <div className="esact__head">
                <span className="posmono possubtle">{a.humanActionId}</span>
                <span className="esact__name">{a.action}</span>
                <span className="poscomment__foot-spacer" />
                {a.hepPointEstimate !== undefined && <span className="poschip">HEP {a.hepPointEstimate.toExponential(1)}</span>}
              </div>
              {a.cue !== undefined && a.cue.length > 0 && <div className="esact__cue">Cue: {a.cue}{a.cueMinutes !== undefined ? ` (~${fmtMin(a.cueMinutes)})` : ""}</div>}
              <div className="esact__bar-track" title="When the window is open, on the same log time axis as the timeline above; the darker leading strip is the time the action itself needs">
                <div className="esact__bar" style={{ left: `${x0}%`, width: `${Math.max(x1 - x0, 2)}%` }}>
                  <div className="esact__bar-req" style={{ width: `${reqPct}%` }} />
                  <span className="esact__bar-cap">available {fmtMin(availMin)}</span>
                </div>
              </div>
              <div className="esact__feas">
                {FEASIBILITY_CRITERIA.map((c) => {
                  const state = a.feasibility?.[c.id] ?? "OK";
                  const tone = FEASIBILITY_TONE[state] ?? "ok";
                  return (
                    <span key={c.id} className={`esact__check esact__check--${tone}`} title={c.hint}>
                      {tone === "ok" ? <ESIcon.Check /> : <ESIcon.Warn />} {c.label}
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Phenomenological conditions</h3>
          {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPhen}><ESIcon.Plus /> Add condition</button>}
        </div>
        <p className="poscard__sub">Thermal, radiation, and chemical conditions arising during a sequence are modelled as phenomenological dependencies, with their onset timing checked against the action windows above (ES-B3).</p>
        {phens.length === 0 && <EsEmpty title="No phenomenological conditions yet" hint="Catalogue the sequence-induced conditions that can defeat equipment or block operator access (ES-B3)." />}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phens.map((p) => (
            <button key={p.uuid} type="button" className="esdep" onClick={() => setDrawer({ kind: "phenomenon", id: p.uuid })}>
              <span className="esdep__icon esdep__icon--warn"><ESIcon.Flame /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="esdep__flow"><span className="esdep__from">{p.name}</span></div>
                <div className="esdep__desc">{p.description}</div>
                <div className="esdep__tags">
                  {p.onsetTiming !== undefined && <span className="poschip"><ESIcon.Clock /> {p.onsetTiming}</span>}
                  {(p.environmentalConditions ?? []).map((h) => <span key={h} className="poschip poschip--warn">{h}</span>)}
                  {p.affectedSystems.map((s) => <span key={s} className="poschip">↯ {s}</span>)}
                </div>
              </div>
              <div className="esdep__right">
                <span className="posmono possubtle">{p.uuid}</span>
                {(p.deterministicAnalysisReferences ?? []).map((r) => <span key={r} className="poschip poschip--method">{r}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function EndStatesScreen(): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const seqs = useMemo(() => sequencesView(es), [es]);
  const mappings = useMemo(() => releaseMappingsView(es), [es]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const [selSeg, setSelSeg] = useState<{ ie: string; seg: string } | null>(null);
  const [openIeName, setOpenIeName] = useState<string | null>(null);
  const [selRcGroup, setSelRcGroup] = useState<{ rc: string; ie: string } | null>(null);
  const seqById = useMemo(() => new Map(seqs.map((s) => [s.id, s])), [seqs]);
  const hasContent = seqs.length > 0;
  const unusedRcIds = ES_RELEASE_CATEGORIES.map((r) => r.id).filter((id) => !mappings.some((m) => m.releaseCategoryId === id));

  const SEG_META: Record<string, { label: string; color: string }> = {
    OK: { label: "Safe stable state", color: "var(--c-complete)" },
    "RC-1": { label: "RC-1 early unfiltered", color: "#c44d4d" },
    "RC-2": { label: "RC-2 late filtered", color: "#c97a18" },
    "RC-3": { label: "RC-3 intact-confinement leak", color: "#d9a94a" },
  };
  const distribution = useMemo(() => {
    const byIe = new Map<string, { name: string; segs: Map<string, typeof seqs> }>();
    for (const s of seqs) {
      const seg = s.endState === "SUCCESSFUL_MITIGATION" ? "OK" : s.releaseCategoryId ?? "REL";
      let row = byIe.get(s.initiatingEventId);
      if (row === undefined) {
        row = { name: "", segs: new Map() };
        byIe.set(s.initiatingEventId, row);
      }
      const arr = row.segs.get(seg);
      if (arr === undefined) row.segs.set(seg, [s]);
      else arr.push(s);
    }
    const trees = eventTreesView(es);
    for (const [ie, row] of byIe) {
      const names = trees.filter((t) => t.initiatingEventId === ie).map((t) => t.name);
      row.name = names.sort((a, b) => a.length - b.length)[0] ?? ie;
    }
    return Array.from(byIe.entries()).map(([ie, row]) => ({
      ie,
      name: row.name,
      total: Array.from(row.segs.values()).reduce((a, v) => a + v.length, 0),
      segs: ["OK", "RC-1", "RC-2", "RC-3", "REL"].filter((k) => row.segs.has(k)).map((k) => ({ key: k, members: row.segs.get(k) ?? [] })),
    }));
  }, [seqs, es]);

  function addMapping(): void {
    if (!editable || unusedRcIds.length === 0) return;
    const id = crypto.randomUUID();
    const mapping: ReleaseCategoryMapping = {
      uuid: id,
      eventSequenceIds: [],
      releaseCategoryId: unusedRcIds[0],
      mappingBasis: "",
      commonCharacteristics: [],
      physicalReleaseCharacteristics: [],
      implementsSrs: [],
    };
    mutateEs((draft) => ({ ...draft, releaseCategoryMappings: [...(draft.releaseCategoryMappings ?? []), mapping] }));
    setDrawer({ kind: "releaseCategory", id });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">End states</h3>
          <span className="possubtle">ES-A8 · ES-C1</span>
        </div>
        <p className="poscard__sub">Each sequence resolves to a safe stable state or a release category handed to Mechanistic Source Term (ES-A8, ES-C1).</p>
        <div className="posrow posrow--wrap" style={{ gap: 10, marginBottom: 14 }}>
          {ES_END_STATES.map((e) => {
            const n = seqs.filter((s) => (e.id === "OK" ? s.endState === "SUCCESSFUL_MITIGATION" : s.endState === "RADIONUCLIDE_RELEASE")).length;
            return (
              <div key={e.id} className={`esend-tile esend-tile--${e.tone === "ok" ? "ok" : "block"}`} title={e.desc}>
                <span className={`estree__seq-end estree__seq-end--${e.tone === "ok" ? "ok" : "block"}`} />
                <span className="esend-tile__label">{e.label}</span>
                <span className="esend-tile__count posmono">{n}</span>
              </div>
            );
          })}
        </div>
        <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 12.5, marginBottom: 8 }}>Where the end states come from, by initiating event. Click a segment to see its sequences.</div>
        <div className="esdist">
          {distribution.map((row) => (
            <Fragment key={row.ie}>
              <div className="esdist__row">
                <div className="esdist__label">
                  <button type="button" className="esdist__iebtn posmono" title="Click to show the initiating-event group name"
                    onClick={() => setOpenIeName(openIeName === row.ie ? null : row.ie)}>{row.ie}</button>
                  {openIeName === row.ie && <span className="esdist__name">{row.name}</span>}
                </div>
                <div className="esdist__bar">
                  {row.segs.map((seg) => {
                    const meta = SEG_META[seg.key] ?? { label: seg.key, color: "#999" };
                    const active = selSeg !== null && selSeg.ie === row.ie && selSeg.seg === seg.key;
                    return (
                      <button key={seg.key} type="button"
                        className={`esdist__seg${active ? " esdist__seg--active" : ""}`}
                        style={{ flexGrow: seg.members.length, background: meta.color }}
                        title={`${meta.label} · ${seg.members.length} sequence${seg.members.length === 1 ? "" : "s"}`}
                        onClick={() => setSelSeg(active ? null : { ie: row.ie, seg: seg.key })} />
                    );
                  })}
                </div>
                <span className="esdist__counts posmono possubtle">
                  <span className="esdist__count-n">{row.segs.filter((s) => s.key === "OK").reduce((a, s) => a + s.members.length, 0)}</span> safe · <span className="esdist__count-n">{row.total - row.segs.filter((s) => s.key === "OK").reduce((a, s) => a + s.members.length, 0)}</span> release
                </span>
              </div>
              {selSeg !== null && selSeg.ie === row.ie && (
                <div className="esdist__expand">
                  <span className="possubtle" style={{ fontSize: 11.5 }}>{(SEG_META[selSeg.seg] ?? { label: selSeg.seg }).label}:</span>
                  {(row.segs.find((s) => s.key === selSeg.seg)?.members ?? []).map((s) => (
                    <span key={s.id} className="poschip" style={{ cursor: "pointer" }} onClick={() => setDrawer({ kind: "sequence", id: s.id })}>{s.id}</span>
                  ))}
                </div>
              )}
            </Fragment>
          ))}
        </div>
        <div className="estree__legend" style={{ borderTop: "none", padding: "10px 0 0", background: "none", justifyContent: "center" }}>
          {Object.keys(SEG_META).map((k) => (
            <span key={k} className="estree__legend-item"><span className="estree__legend-dot" style={{ background: SEG_META[k].color }} /> {SEG_META[k].label}</span>
          ))}
        </div>
      </div>

      {hasContent && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Release-category mapping</h3>
            <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
              <ESProvenanceChip kind="es">ES-C8 → MS</ESProvenanceChip>
              {editable && unusedRcIds.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMapping}><ESIcon.Plus /> Add category</button>}
            </div>
          </div>
          <p className="poscard__sub">Categories differ by release timing, magnitude, and whether filtration is credited (ES-C2, ES-C3). Click a category to edit its basis, characteristics and member sequences.</p>
          {mappings.length > 0 ? (
            <table className="postable">
              <thead><tr><th>Release category</th><th>Sequences</th><th>Status</th></tr></thead>
              <tbody>
                {mappings.map((m) => {
                  const meta = ES_RELEASE_CATEGORIES.find((r) => r.id === m.releaseCategoryId);
                  const byIe = new Map<string, string[]>();
                  for (const id of m.sequenceIds) {
                    const ie = seqById.get(id)?.initiatingEventId ?? "Unlinked";
                    const arr = byIe.get(ie);
                    if (arr === undefined) byIe.set(ie, [id]);
                    else arr.push(id);
                  }
                  const openGroup = selRcGroup !== null && selRcGroup.rc === m.uuid ? byIe.get(selRcGroup.ie) : undefined;
                  return (
                    <tr key={m.uuid} className="postable__row--clickable" onClick={() => setDrawer({ kind: "releaseCategory", id: m.uuid })}>
                      <td>
                        <div className="postable__name">{m.releaseCategoryId}</div>
                        <span className="postable__name-sub">{meta?.name ?? ""}</span>
                        <span className="postable__name-sub">{m.sequenceCount} sequence{m.sequenceCount === 1 ? "" : "s"}</span>
                      </td>
                      <td>
                        <div className="posrow posrow--wrap" style={{ gap: 5, alignItems: "center" }}>
                          {Array.from(byIe.entries()).map(([ie, ids]) => {
                            const active = selRcGroup !== null && selRcGroup.rc === m.uuid && selRcGroup.ie === ie;
                            return (
                              <button key={ie} type="button" className={`esrcgrp${active ? " esrcgrp--active" : ""}`}
                                onClick={(ev) => { ev.stopPropagation(); setSelRcGroup(active ? null : { rc: m.uuid, ie }); }}>
                                {ie} <span className="esrcgrp__n">{ids.length}</span>
                              </button>
                            );
                          })}
                        </div>
                        {openGroup !== undefined && (
                          <div className="posrow posrow--wrap" style={{ gap: 5, paddingTop: 7 }}>
                            {openGroup.map((id) => (
                              <span key={id} className="poschip" style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); setDrawer({ kind: "sequence", id }); }}>{id}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td>{m.processedByRiskIntegration === true ? <Badge kind="ok">Processed</Badge> : <Badge kind="warn">Pending</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <EsEmpty title="No release categories yet" hint="Sort release sequences into reactor-specific release categories handed to Mechanistic Source Term (ES-C1, ES-C2)." />}
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
    { label: "Operator-action windows", value: (es.operatorActionWindows ?? []).length, detail: "time available vs. time required" },
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
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(es, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${es.name} — ES Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
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
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
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
            <button type="button" className="posnav__btn" onClick={downloadJson}><ESIcon.Download /> Download JSON</button>
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
