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
  ES_LBE_CLASSES,
  feActor,
  ES_FE_ACTOR_META,
  type Stage,
  type CapabilityCategory,
} from "./esViewData";
import { type KeySafetyFunction, type DynamicRun, type Dependency, DependencyType, type OperatorActionWindow, type FeasibilityState, type PhenomenologicalDependencyModel, type ReleaseCategoryMapping, type EventSequenceFamily, type EventSequenceScreeningRecord } from "interfaces-mef-types/es/event-sequence-analysis";
import { EndState } from "interfaces-mef-types/core/events";
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
  freqValue,
  lbeView,
  type EventTreeView,
  type TreeNodeView,
  type SeqLeafRef,
  type SeqLeafView,
  type DependencyView,
  type CcScore,
} from "./esSelectors";
import { generateEsReport } from "./esDocx";
import "./css/esScreens.css";

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

type DrawerCtx = { kind: "sequence"; id: string } | { kind: "dependency"; id: string } | { kind: "operatorAction"; id: string } | { kind: "phenomenon"; id: string } | { kind: "releaseCategory"; id: string } | { kind: "family"; id: string } | { kind: "screening"; id: string } | { kind: "safetyFn"; id: string };

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
          <div className="posdrawer__sub">{t.initiatingEventId}{t.plantOperatingStateId !== undefined ? ` · ${t.plantOperatingStateId}` : ""}{t.missionTime !== undefined ? ` · mission time ${t.missionTime} ${t.missionTimeUnits ?? ""}` : ""}{s.meanFrequency !== undefined ? ` · ${fmtExp(s.meanFrequency)}/yr` : ""}</div>
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
                  <div className={`espath__node espath__node--${st === "SUCCESS" ? "s" : "f"}`} title={fe.label}>
                    <span className="espath__node-fe">{fe.id}</span>
                    <span className="espath__node-state"><span className={`esqlight__dot esqlight__dot--${st === "SUCCESS" ? "s" : "f"}`} />{st === "SUCCESS" ? "Success" : "Failure"}</span>
                  </div>
                </Fragment>
              );
            })}
            <span className="espath__arrow"><ESIcon.ArrowR /></span>
            <span className={`espath__end espath__end--${isOk ? "ok" : "block"}`}>
              {isOk ? "Safe state" : s.releaseCategoryId}
            </span>
          </div>
        </div>

        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Outcome</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">End state</label><div className="posmono">{isOk ? "Safe stable state" : "Radionuclide release"}</div></div>
            <div className="posfield"><label className="posfield__label">Mean frequency</label><div className="posmono">{s.meanFrequency !== undefined ? `${fmtExp(s.meanFrequency)} /yr` : "—"}</div></div>
            <div className="posfield"><label className="posfield__label">Release category</label><div className="posmono">{s.releaseCategoryId === undefined ? "None (no release)" : s.releaseCategoryId}</div></div>
            {s.familyId !== undefined && <div className="posfield"><label className="posfield__label">Sequence family</label><div className="posmono">{s.familyId}</div></div>}
            {imp.label !== "—" && <div className="posfield"><label className="posfield__label">Risk importance</label><div className="posmono">{imp.label}</div></div>}
          </div>
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

function FamilyDrawerBody({ familyId, onClose }: { familyId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const f = es.eventSequenceFamilies.find((x) => x.uuid === familyId);
  if (f === undefined) return null;
  const freqOf = new Map(es.eventSequences.map((s) => [s.uuid, freqValue(s.meanFrequency) ?? 0]));
  const representativeId = [...f.memberSequenceIds].sort((a, b) => (freqOf.get(b) ?? 0) - (freqOf.get(a) ?? 0))[0];
  const inOtherFamily = new Set(es.eventSequenceFamilies.filter((x) => x.uuid !== familyId).flatMap((x) => x.memberSequenceIds));
  const eligible = es.eventSequences
    .filter((s) => s.endState === f.endState && !f.memberSequenceIds.includes(s.uuid) && !inOtherFamily.has(s.uuid))
    .map((s) => s.uuid);
  const ieOptions = Array.from(new Set(es.eventSequences.map((s) => s.initiatingEventId)));
  const posOptions = Array.from(new Set(es.eventSequences.map((s) => s.plantOperatingStateId)));

  function patch(patchObj: Partial<EventSequenceFamily>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, eventSequenceFamilies: draft.eventSequenceFamilies.map((x) => (x.uuid === familyId ? { ...x, ...patchObj } : x)) }));
  }
  function toggleMember(seqId: string): void {
    const cur = f?.memberSequenceIds ?? [];
    const next = cur.includes(seqId) ? cur.filter((x) => x !== seqId) : [...cur, seqId];
    patch({ memberSequenceIds: next, meanFrequency: next.reduce((a, id) => a + (freqOf.get(id) ?? 0), 0) });
  }
  function removeFamily(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, eventSequenceFamilies: draft.eventSequenceFamilies.filter((x) => x.uuid !== familyId) }));
  }

  const isOk = f.endState === "SUCCESSFUL_MITIGATION";
  const rc = (f.releaseCategoryIds ?? [])[0] ?? "";
  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Sequence family · {f.uuid}</div>
          {editable
            ? <input className="posfield__input" style={{ fontSize: 16, fontWeight: 700 }} value={f.name} onChange={(e) => patch({ name: e.target.value })} />
            : <h2 className="posdrawer__title">{f.name}</h2>}
          <div className="posdrawer__sub">{f.memberSequenceIds.length} member sequences · mean {fmtExp(freqValue(f.meanFrequency))}/yr · one source-term calculation (ES-C8)</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Representative plant response</h3></div>
          {editable
            ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="How the plant responds in every member of this family" value={f.representativePlantResponse} onChange={(e) => patch({ representativePlantResponse: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{f.representativePlantResponse}</p>}
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Classification</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">End state</label>
              {editable
                ? <select className="posfield__select" value={f.endState} onChange={(e) => patch({ endState: e.target.value === "SUCCESSFUL_MITIGATION" ? EndState.SUCCESSFUL_MITIGATION : EndState.RADIONUCLIDE_RELEASE, releaseCategoryIds: e.target.value === "SUCCESSFUL_MITIGATION" ? [] : f.releaseCategoryIds })}>
                    <option value="SUCCESSFUL_MITIGATION">Safe stable state</option>
                    <option value="RADIONUCLIDE_RELEASE">Radionuclide release</option>
                  </select>
                : <div>{isOk ? "Safe stable state" : "Radionuclide release"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Release category</label>
              {editable
                ? <select className="posfield__select" value={rc} disabled={isOk} onChange={(e) => patch({ releaseCategoryIds: e.target.value.length === 0 ? [] : [e.target.value] })}>
                    <option value="">None</option>
                    {ES_RELEASE_CATEGORIES.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}
                  </select>
                : <div>{rc.length > 0 ? rc : "—"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Representative initiating event</label>
              {editable
                ? <select className="posfield__select" value={f.representativeInitiatingEventId} onChange={(e) => patch({ representativeInitiatingEventId: e.target.value })}>
                    {ieOptions.map((ie) => <option key={ie} value={ie}>{ie}</option>)}
                  </select>
                : <div className="posmono">{f.representativeInitiatingEventId}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Representative operating state</label>
              {editable
                ? <select className="posfield__select" value={f.representativePlantOperatingStateId} onChange={(e) => patch({ representativePlantOperatingStateId: e.target.value })}>
                    {posOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                : <div className="posmono">{f.representativePlantOperatingStateId}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Similarity check (leave empty when resolved)</label>
              {editable
                ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="Open ES-C3 check on whether the representative bounds every member" value={f.similarityBasis ?? ""} onChange={(e) => patch({ similarityBasis: e.target.value.length === 0 ? undefined : e.target.value })} />
                : <div>{f.similarityBasis ?? "Resolved"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Member sequences</h3></div>
          <p className="poscard__sub">The highest-frequency member <span className="posmono">{representativeId ?? "—"}</span> is the representative sequence.</p>
          <div className="posrow posrow--wrap" style={{ gap: 6 }}>
            {f.memberSequenceIds.map((id) => (
              <span key={id} className={`poschip${id === representativeId ? " poschip--primary" : ""}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {id}
                {editable && <button type="button" title="Remove" onClick={() => toggleMember(id)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "inherit", font: "inherit", lineHeight: 1 }}>×</button>}
              </span>
            ))}
            {editable && eligible.length > 0 && (
              <select className="posfield__select" style={{ maxWidth: 220 }} value="" onChange={(e) => { if (e.target.value.length > 0) toggleMember(e.target.value); }}>
                <option value="">Add a sequence…</option>
                {eligible.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            )}
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeFamily}><ESIcon.Close /> Remove family</button>
          </div>
        )}
      </div>
    </>
  );
}

function ScreeningDrawerBody({ recordId, onClose }: { recordId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const r = es.screeningRecords.find((x) => x.sequenceId === recordId);
  if (r === undefined) return null;
  const seq = es.eventSequences.find((s) => s.uuid === recordId);
  const isOk = seq?.endState === "SUCCESSFUL_MITIGATION";

  function patch(patchObj: Partial<EventSequenceScreeningRecord>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, screeningRecords: draft.screeningRecords.map((x) => (x.sequenceId === recordId ? { ...x, ...patchObj } : x)) }));
  }
  function removeRecord(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, screeningRecords: draft.screeningRecords.filter((x) => x.sequenceId !== recordId) }));
  }

  return (
    <>
      <div className="posdrawer__head">
        <div>
          <div className="posdrawer__cap">Screening record · {r.sequenceId}</div>
          <h2 className="posdrawer__title">{seq?.name ?? r.sequenceId}</h2>
          <div className="posdrawer__sub">{seq !== undefined
            ? `${seq.initiatingEventId} · ${seq.plantOperatingStateId} · ${isOk ? "safe stable state" : seq.releaseCategoryId ?? "release"} · ${fmtExp(freqValue(seq.meanFrequency))}/yr`
            : "Not in the sequence model (screened out before sequence development)"}</div>
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body">
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Disposition</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Decision</label>
              {editable
                ? <select className="posfield__select" value={r.retained ? "retained" : "screened"} onChange={(e) => patch(e.target.value === "retained" ? { retained: true, criterion: undefined } : { retained: false, criterion: r.criterion ?? "SCR-3" })}>
                    <option value="retained">Retained</option>
                    <option value="screened">Screened out</option>
                  </select>
                : <div>{r.retained ? "Retained" : "Screened out"}</div>}
            </div>
            <div className="posfield"><label className="posfield__label">Screening criterion</label>
              {editable && !r.retained
                ? <select className="posfield__select" value={r.criterion ?? "SCR-3"} onChange={(e) => patch({ criterion: e.target.value === "SCR-1" ? "SCR-1" : e.target.value === "SCR-2" ? "SCR-2" : "SCR-3" })}>
                    <option value="SCR-1">SCR-1</option>
                    <option value="SCR-2">SCR-2</option>
                    <option value="SCR-3">SCR-3</option>
                  </select>
                : <div className="posmono">{r.retained ? "—" : r.criterion ?? "—"}</div>}
            </div>
          </div>
        </div>
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Justification</h3></div>
          {editable
            ? <textarea className="posfield__textarea" rows={3} style={{ resize: "vertical" }} placeholder="Why this sequence is kept, or the SCR basis for dropping it" value={r.justification} onChange={(e) => patch({ justification: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{r.justification}</p>}
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeRecord}><ESIcon.Close /> Remove record</button>
          </div>
        )}
      </div>
    </>
  );
}

function SafetyFnDrawerBody({ fnId, onClose }: { fnId: string; onClose: () => void }): JSX.Element | null {
  const { es, editable, mutateEs } = useEsWorkbook();
  const sf = es.keySafetyFunctions.find((x) => x.id === fnId);
  if (sf === undefined) return null;

  function patch(patchObj: Partial<KeySafetyFunction>): void {
    if (!editable) return;
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: draft.keySafetyFunctions.map((x) => (x.id === fnId ? { ...x, ...patchObj } : x)) }));
  }
  function removeFn(): void {
    if (!editable) return;
    onClose();
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: draft.keySafetyFunctions.filter((x) => x.id !== fnId) }));
  }

  return (
    <>
      <div className="posdrawer__head" style={{ borderBottom: "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="posdrawer__cap">Key safety function{sf.successCriteriaId !== undefined && sf.successCriteriaId.length > 0 ? ` · ${sf.successCriteriaId}` : ""}</div>
          {editable
            ? <input className="posfield__input" style={{ fontSize: 16, fontWeight: 700 }} value={sf.name} onChange={(e) => patch({ name: e.target.value })} />
            : <h2 className="posdrawer__title">{sf.name}</h2>}
        </div>
        <button type="button" className="posdrawer__close" onClick={onClose}><ESIcon.Close /></button>
      </div>
      <div className="posdrawer__body" style={{ paddingTop: 4 }}>
        <div>
          <div className="poscard__head"><h3 className="poscard__title">What it must do</h3></div>
          {editable
            ? <textarea className="posfield__textarea" rows={2} style={{ resize: "vertical" }} placeholder="What every scenario must satisfy to protect the barrier" value={sf.description} onChange={(e) => patch({ description: e.target.value })} />
            : <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.6 }}>{sf.description.length > 0 ? sf.description : "—"}</p>}
        </div>
        <div>
          <div className="poscard__head"><h3 className="poscard__title">Basis</h3></div>
          <div className="posfield-grid">
            <div className="posfield"><label className="posfield__label">Success criteria reference</label>
              {editable
                ? <input className="posfield__input posmono" placeholder="SC-xx" value={sf.successCriteriaId ?? ""} onChange={(e) => patch({ successCriteriaId: e.target.value.length === 0 ? undefined : e.target.value })} />
                : <div className="posmono">{sf.successCriteriaId ?? "—"}</div>}
            </div>
            <div className="posfield posfield-grid--span2"><label className="posfield__label">Supporting systems (comma separated)</label>
              {editable
                ? <input className="posfield__input" value={sf.supportingSystems.join(", ")} onChange={(e) => patch({ supportingSystems: csvList(e.target.value) })} />
                : <div className="posrow posrow--wrap" style={{ gap: 6 }}>{sf.supportingSystems.map((y) => <span key={y} className="poschip">{y}</span>)}</div>}
            </div>
          </div>
        </div>
        {editable && (
          <div className="posrow" style={{ justifyContent: "flex-end" }}>
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={removeFn}><ESIcon.Close /> Remove function</button>
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
        {ctx.kind === "family" && <FamilyDrawerBody familyId={ctx.id} onClose={onClose} />}
        {ctx.kind === "screening" && <ScreeningDrawerBody recordId={ctx.id} onClose={onClose} />}
        {ctx.kind === "safetyFn" && <SafetyFnDrawerBody fnId={ctx.id} onClose={onClose} />}
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
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  function addSafetyFn(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    mutateEs((draft) => ({ ...draft, keySafetyFunctions: [...draft.keySafetyFunctions, { id, name: "New safety function", description: "", supportingSystems: [] }] }));
    setDrawer({ kind: "safetyFn", id });
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
                    <div className="postable__name">{src.name}</div>
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
        <p className="poscard__sub">The functions every scenario must satisfy to protect a barrier and reach a safe stable state (ES-A3, ES-A4). Click a function to edit it.</p>
        {safetyFns.length > 0 ? (
          <div className="essf-grid">
            {safetyFns.map((sf) => (
              <button key={sf.id} type="button" className="essf essf--clickable" onClick={() => setDrawer({ kind: "safetyFn", id: sf.id })}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
                    <span className="essf__name">{sf.name}</span>
                    {sf.successCriteriaId !== undefined && sf.successCriteriaId.length > 0 && <ESProvenanceChip kind="sc">{sf.successCriteriaId}</ESProvenanceChip>}
                  </div>
                  {sf.description.length > 0 && <div className="essf__desc">{sf.description}</div>}
                  {sf.supportingSystems.length > 0 && <div className="essf__sys">{sf.supportingSystems.map((y) => <span key={y} className="poschip">{y}</span>)}</div>}
                </div>
              </button>
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
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
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
          <span className="estree__bar-title">{reprMeta.label}</span>
          <span className={`poschip${reprMeta.primary === true ? " poschip--primary" : ""}`}>{reprMeta.order}</span>
          <div className="estree__selector">
            {ES_REPRESENTATIONS.map((r) => (
              <button key={r.id} type="button" className={`estree__selector-opt${r.id === repr ? " estree__selector-opt--active" : ""}`} onClick={() => setRepr(r.id)}>{r.label}</button>
            ))}
          </div>
          <span className="estree__bar-spacer" />
          {reprMeta.method !== undefined
            ? <span className="poschip poschip--method">Method {reprMeta.method}</span>
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
            <div className="esderived">Derived from the event-sequence diagram. Each question becomes a branch heading, kept in the same order the operators meet it.</div>
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
                    <div style={{ minWidth: 0 }}>
                      <div className="esdep__flow">
                        <span className="esdep__from">{d.from}</span>
                        <span className="esdep__flow-arrow"><ESIcon.ArrowL /></span>
                        <span className="esdep__to">{d.to}</span>
                      </div>
                      <div className="esdep__desc">{d.desc}</div>
                      <div className="esdep__tags">
                        <Badge kind={meta?.tone === "warn" ? "warn" : "progress"}>{meta?.label ?? d.type}</Badge>
                        {d.timePhased && <span className="poschip">Time-phased</span>}
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
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="esdep__flow"><span className="esdep__from">{p.name}</span></div>
                <div className="esdep__desc">{p.description}</div>
                <div className="esdep__tags">
                  {p.onsetTiming !== undefined && <span className="poschip">{p.onsetTiming}</span>}
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
  const { es, editable, mutateEs } = useEsWorkbook();
  const families = useMemo(() => familiesView(es), [es]);
  const seqs = useMemo(() => sequencesView(es), [es]);
  const seqById = useMemo(() => new Map(seqs.map((s) => [s.id, s])), [seqs]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const [selFamGroup, setSelFamGroup] = useState<{ fam: string; ie: string } | null>(null);

  function addFamily(): void {
    if (!editable) return;
    const id = crypto.randomUUID();
    const family: EventSequenceFamily = {
      uuid: id,
      name: "New family",
      groupingCriteriaId: "GC-1",
      representativeInitiatingEventId: seqs[0]?.initiatingEventId ?? "",
      representativePlantOperatingStateId: seqs[0]?.plantOperatingStateId ?? "",
      representativePlantResponse: "",
      releaseCategoryIds: [],
      memberSequenceIds: [],
      endState: EndState.RADIONUCLIDE_RELEASE,
      implementsSrs: [],
    };
    mutateEs((draft) => ({ ...draft, eventSequenceFamilies: [...draft.eventSequenceFamilies, family] }));
    setDrawer({ kind: "family", id });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sequence families</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <ESProvenanceChip kind="es">ES-C8 → MS</ESProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addFamily}><ESIcon.Plus /> Add family</button>}
          </div>
        </div>
        <p className="poscard__sub">Families share an end state, release category, plant response and timing band, and each maps to one source-term calculation (ES-C8, HLR-MS-A). Click a family to edit its grouping, response and members.</p>
        {families.length > 0 ? (
          <table className="postable">
            <thead><tr><th>Family</th><th>Members</th><th>Release</th><th style={{ textAlign: "right" }}>Mean (/yr)</th><th>Status</th></tr></thead>
            <tbody>
              {families.map((f) => {
                const rc = f.releaseCategoryIds[0];
                const tone = rcTone(rc);
                const isOk = f.endState === "SUCCESSFUL_MITIGATION";
                const byIe = new Map<string, string[]>();
                for (const id of f.members) {
                  const ie = seqById.get(id)?.initiatingEventId ?? "Unlinked";
                  const arr = byIe.get(ie);
                  if (arr === undefined) byIe.set(ie, [id]);
                  else arr.push(id);
                }
                const openGroup = selFamGroup !== null && selFamGroup.fam === f.id ? byIe.get(selFamGroup.ie) : undefined;
                return (
                  <tr key={f.id} className="postable__row--clickable" onClick={() => setDrawer({ kind: "family", id: f.id })}>
                    <td>
                      <div className="postable__name">{f.name}</div>
                      <span className="postable__name-sub">{f.id} · {f.memberCount} sequence{f.memberCount === 1 ? "" : "s"}</span>
                    </td>
                    <td>
                      <div className="posrow posrow--wrap" style={{ gap: 5, alignItems: "center" }}>
                        {Array.from(byIe.entries()).map(([ie, ids]) => {
                          const active = selFamGroup !== null && selFamGroup.fam === f.id && selFamGroup.ie === ie;
                          return (
                            <button key={ie} type="button" className={`esrcgrp${active ? " esrcgrp--active" : ""}`}
                              onClick={(ev) => { ev.stopPropagation(); setSelFamGroup(active ? null : { fam: f.id, ie }); }}>
                              {ie} <span className="esrcgrp__n">{ids.length}</span>
                            </button>
                          );
                        })}
                      </div>
                      {openGroup !== undefined && (
                        <div className="posrow posrow--wrap" style={{ gap: 5, paddingTop: 7 }}>
                          {openGroup.map((id) => (
                            <span key={id} className={`poschip${id === f.representativeId ? " poschip--primary" : ""}`} style={{ cursor: "pointer" }} onClick={(ev) => { ev.stopPropagation(); setDrawer({ kind: "sequence", id }); }}>
                              {id}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td><span className={`estree__seq-rcpill estree__seq-rcpill--${isOk ? "ok" : tone}`}>{isOk ? "Safe state" : (rc ?? "Release")}</span></td>
                    <td className="posmono" style={{ textAlign: "right" }}>{fmtExp(f.meanFrequency)}</td>
                    <td>{f.similarityBasis === undefined ? <Badge kind="ok">Resolved</Badge> : <Badge kind="warn">Check open</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EsEmpty title="No sequence families yet" hint="Group sequences sharing an end state, release category and similar plant response into families, each mapping to one source-term calculation (ES-C8)." />}
      </div>
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function ScreeningScreen(): JSX.Element {
  const { es, editable, mutateEs } = useEsWorkbook();
  const records = useMemo(() => screeningView(es), [es]);
  const seqs = useMemo(() => sequencesView(es), [es]);
  const seqById = useMemo(() => new Map(seqs.map((s) => [s.id, s])), [seqs]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const eligible = seqs.filter((s) => !records.some((r) => r.sequenceId === s.id)).map((s) => s.id);

  function addRecord(seqId: string): void {
    if (!editable || seqId.length === 0) return;
    mutateEs((draft) => ({ ...draft, screeningRecords: [...draft.screeningRecords, { sequenceId: seqId, retained: true, justification: "", implementsSrs: [] }] }));
    setDrawer({ kind: "screening", id: seqId });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening decisions</h3>
          <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
            <ESProvenanceChip kind="es">ES-A7 · SCR-3</ESProvenanceChip>
            {editable && eligible.length > 0 && (
              <select className="posfield__select" style={{ maxWidth: 200 }} value="" onChange={(e) => addRecord(e.target.value)}>
                <option value="">Add a record for…</option>
                {eligible.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            )}
          </div>
        </div>
        <p className="poscard__sub">Every sequence is kept by default. A sequence may only be dropped when it is not risk-significant and meets a screening criterion (SCR-3, Table 1.10-1); the basis for each decision is recorded here (ES-A7). Click a record to edit it.</p>
        {records.length > 0 ? (
          <table className="postable">
            <thead><tr><th>Sequence</th><th>Basis</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r) => {
                const seq = seqById.get(r.sequenceId);
                return (
                  <tr key={r.sequenceId} className="postable__row--clickable" onClick={() => setDrawer({ kind: "screening", id: r.sequenceId })}>
                    <td>
                      <div className="postable__name posmono">{r.sequenceId}</div>
                      <span className="postable__name-sub">{seq !== undefined ? `${seq.initiatingEventId} · ${seq.plantOperatingStateId}` : "Pre-layout scenario"}</span>
                    </td>
                    <td><span className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{r.justification.length > 0 ? r.justification : "—"}</span></td>
                    <td>{r.retained ? <Badge kind="ok">Retained</Badge> : <Badge kind="draft">Screened · {r.criterion}</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <EsEmpty title="No screening records yet" hint="Every sequence is kept by default; record the basis for any sequence screened out under SCR-3 (ES-A7)." />}
      </div>
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
    </>
  );
}

function QuantScreen(): JSX.Element {
  const { es } = useEsWorkbook();
  const families = useMemo(() => familiesView(es), [es]);
  const lbes = useMemo(() => lbeView(es), [es]);
  const trees = useMemo(() => eventTreesView(es), [es]);
  const leafById = useMemo(() => new Map(trees.flatMap((t) => t.sequences.map((leaf) => [leaf.id, { leaf, tree: t }] as const))), [trees]);
  const [drawer, setDrawer] = useState<DrawerCtx | null>(null);
  const relFams = families.filter((f) => f.endState === "RADIONUCLIDE_RELEASE").sort((a, b) => (b.meanFrequency ?? 0) - (a.meanFrequency ?? 0));

  if (families.length === 0) {
    return (
      <div className="poscard">
        <EsEmpty title="Nothing to hand off to ESQ yet" hint="Once the sequences and families are built, this step packages them for Event Sequence Quantification and shows the frequencies it returns (ES-A1c)." />
      </div>
    );
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Preliminary point-estimate licensing basis events</h3>
          <ESProvenanceChip kind="es">ES → LBE · point estimate</ESProvenanceChip>
        </div>
        <p className="poscard__sub">Each sequence family is placed into a preliminary licensing-basis-event class by its point-estimate frequency, pending the full ESQ uncertainty quantification.</p>
        <table className="postable">
          <thead>
            <tr>
              <th>Family</th>
              <th>RC</th>
              <th style={{ textAlign: "right" }}>Point est. (/yr)</th>
              <th>Class</th>
            </tr>
          </thead>
          <tbody>
            {lbes.map((lbe) => {
              const cls = lbe.lbeClass !== undefined ? ES_LBE_CLASSES[lbe.lbeClass] : undefined;
              return (
                <tr key={lbe.familyId}>
                  <td><div className="postable__name">{lbe.familyId}</div><span className="postable__name-sub">{lbe.name}</span></td>
                  <td>{lbe.releaseCategoryId !== undefined
                    ? <span className={`estree__seq-rcpill estree__seq-rcpill--${rcTone(lbe.releaseCategoryId)}`}>{lbe.releaseCategoryId}</span>
                    : <span className="poschip">Safe state</span>}</td>
                  <td style={{ textAlign: "right" }}><span className="posmono" style={{ fontWeight: 700 }}>{fmtExp(lbe.meanFrequency)}</span></td>
                  <td>{cls !== undefined ? <Badge kind={cls.tone}>{cls.label}</Badge> : <Badge kind="draft">Below 5E-7 /yr</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="possubtle" style={{ fontSize: 11.5, marginTop: 10, marginBottom: 0 }}>Classes follow the LMP frequency bands: AOO at or above 1E-2/yr, DBE from 1E-4 to 1E-2/yr, and BDBE from 5E-7 to 1E-4/yr. Families below 5E-7/yr fall outside the LBE range.</p>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Returned quantification</h3>
          <ESProvenanceChip kind="es">ESQ → ES · HLR-ESQ-B</ESProvenanceChip>
        </div>
        <div className="esqdom-list">
          {relFams.map((f) => {
            const top = f.members
              .flatMap((id) => { const found = leafById.get(id); return found === undefined ? [] : [found]; })
              .sort((a, b) => (b.leaf.meanFrequency ?? 0) - (a.leaf.meanFrequency ?? 0))
              .slice(0, 3);
            const topFreq = top[0]?.leaf.meanFrequency ?? 0;
            const tone = rcTone(f.releaseCategoryIds[0]);
            const rcMeta = ES_RELEASE_CATEGORIES.find((r) => r.id === f.releaseCategoryIds[0]);
            return (
              <div key={f.id} className={`esqdom esqdom--${tone}`}>
                <div className="esqdom__head">
                  <span className="posmono possubtle" style={{ fontSize: 11.5 }}>{f.id}</span>
                  <span className="esqdom__name">{f.name}</span>
                  <span className="poscomment__foot-spacer" />
                  <span className="posmono possubtle" style={{ fontSize: 11 }}>{fmtExp(f.meanFrequency)}/yr</span>
                  <span className={`estree__seq-rcpill estree__seq-rcpill--${tone}`}>{f.releaseCategoryIds[0]}</span>
                </div>
                {top.map(({ leaf, tree }, i) => (
                  <button key={leaf.id} type="button" className="esqdom__row" onClick={() => setDrawer({ kind: "sequence", id: leaf.id })}>
                    <span className="esqdom__rank posmono">{i + 1}</span>
                    <span className="posmono" style={{ fontSize: 11.5, fontWeight: 700, color: "var(--color-text)" }}>{leaf.id}</span>
                    <span className="esqdom__path">
                      <span className="esqdom__ietxt possubtle">{tree.name}</span>
                      <span className="esqdom__arrow">→</span>
                      {tree.functionalEvents.map((fe) => {
                        const st = leaf.path[fe.id];
                        if (st === undefined) return null;
                        return (
                          <span key={fe.id} className="esqlight posmono" title={`${fe.label}: ${st === "SUCCESS" ? "success" : "failure"}`}>
                            <span className={`esqlight__dot esqlight__dot--${st === "SUCCESS" ? "s" : "f"}`} />{fe.id}
                          </span>
                        );
                      })}
                      <span className="esqdom__arrow">→</span>
                      <span className="esqdom__endtxt possubtle">{rcMeta?.name ?? "Safe stable state"}</span>
                    </span>
                    <span className="esqdom__bar"><span className={`esqdom__fill esqdom__fill--${tone}`} style={{ width: `${topFreq > 0 ? Math.max(4, Math.round(((leaf.meanFrequency ?? 0) / topFreq) * 100)) : 4}%` }} /></span>
                    <span className="esqdom__freq posmono possubtle">{fmtExp(leaf.meanFrequency)} /yr</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      {drawer !== null && <DrawerHost ctx={drawer} onClose={() => setDrawer(null)} />}
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
