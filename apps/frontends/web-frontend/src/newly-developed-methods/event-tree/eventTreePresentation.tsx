import { type JSX, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DynamicRun } from "interfaces-mef-types/es/event-sequence-analysis";
import type {
  EventTreeLeafReference,
  EventTreeNodeView,
  EventTreePresentationView,
  EventTreeSequenceView,
} from "./eventTreeTypes";

function formatExponential(value: number | undefined): string {
  return value === undefined ? "—" : value.toExponential(2);
}

function collectSequences(node: EventTreeNodeView | EventTreeLeafReference): string[] {
  if ("seq" in node) return node.seq.length === 0 ? [] : [node.seq];
  return [...collectSequences(node.S), ...collectSequences(node.F)];
}

interface ClassicSegment { x1: number; y1: number; x2: number; y2: number; sequences: string[] }
interface ClassicLayout {
  segments: ClassicSegment[];
  dots: Array<{ x: number; y: number }>;
  labels: Array<{ x: number; y: number; kind: "S" | "F" }>;
  leaves: Array<{ sequenceId: string; y: number }>;
  columnX: (column: number) => number;
  endX: number;
  rootY: number;
  width: number;
  height: number;
}

function layoutClassic(view: EventTreePresentationView): ClassicLayout {
  const columnWidth = 152;
  const rowHeight = 58;
  const left = 112;
  const top = 98;
  const endX = left + view.functionalEvents.length * columnWidth;
  const columnX = (column: number): number => left + column * columnWidth;
  const segments: ClassicSegment[] = [];
  const dots: Array<{ x: number; y: number }> = [];
  const labels: Array<{ x: number; y: number; kind: "S" | "F" }> = [];
  const leaves: Array<{ sequenceId: string; y: number }> = [];
  const nodeY = new Map<EventTreeNodeView, number>();
  const leafY = new Map<string, number>();
  let row = 0;
  const assign = (node: EventTreeNodeView | EventTreeLeafReference): number => {
    if ("seq" in node) {
      const y = top + (row + 0.5) * rowHeight;
      row += 1;
      if (node.seq.length > 0) leaves.push({ sequenceId: node.seq, y });
      leafY.set(node.seq, y);
      return y;
    }
    const successY = assign(node.S);
    const failureY = assign(node.F);
    const y = (successY + failureY) / 2;
    nodeY.set(node, y);
    return y;
  };
  const rootY = assign(view.node);
  const childY = (node: EventTreeNodeView | EventTreeLeafReference): number =>
    "seq" in node ? (leafY.get(node.seq) ?? 0) : (nodeY.get(node) ?? 0);
  const draw = (node: EventTreeNodeView, enterX: number, y: number): void => {
    const x = columnX(node.fe);
    const sequences = collectSequences(node);
    segments.push({ x1: enterX, y1: y, x2: x, y2: y, sequences });
    const successY = childY(node.S);
    const failureY = childY(node.F);
    segments.push({ x1: x, y1: successY, x2: x, y2: failureY, sequences });
    dots.push({ x, y });
    for (const [kind, child, outcomeY] of [["S", node.S, successY], ["F", node.F, failureY]] as const) {
      labels.push({ x: x + 6, y: outcomeY + (kind === "S" ? -6 : 14), kind });
      if ("seq" in child) segments.push({ x1: x, y1: outcomeY, x2: endX, y2: outcomeY, sequences: child.seq.length === 0 ? [] : [child.seq] });
      else draw(child, x, outcomeY);
    }
  };
  if (!("seq" in view.node)) draw(view.node, left - 58, rootY);
  return { segments, dots, labels, leaves, columnX, endX, rootY, width: endX + 242, height: top + Math.max(1, row) * rowHeight + 20 };
}

function SequenceOutcome({ sequence, showFrequency }: { sequence: EventTreeSequenceView; showFrequency: boolean }): JSX.Element {
  const safe = sequence.endState === "SUCCESSFUL_MITIGATION";
  const label = sequence.transferTargetId !== undefined
    ? `Transfer · ${sequence.transferTargetId}`
    : safe ? "Safe state" : sequence.releaseCategoryId ?? "Release";
  const frequency = sequence.annualFrequency ?? sequence.meanFrequency;
  return (
    <>
      <span className={`estree__seq-end estree__seq-end--${safe ? "ok" : "block"}`} />
      <span className="estree__seq-main">
        <span className="estree__seq-id">{sequence.name}</span>
        <span className="estree__seq-rc"> · {label}</span>
      </span>
      {showFrequency && frequency !== undefined && <span className="estree__seq-freq">{formatExponential(frequency)}</span>}
    </>
  );
}

function ClassicEventTreeDiagram({ view, activeSequenceId, showFrequency, onHover, onSelect }: {
  view: EventTreePresentationView;
  activeSequenceId: string | null;
  showFrequency: boolean;
  onHover: (sequenceId: string | null) => void;
  onSelect: (sequenceId: string) => void;
}): JSX.Element {
  const layout = useMemo(() => layoutClassic(view), [view]);
  const sequences = new Map(view.sequences.map((sequence) => [sequence.id, sequence]));
  const highlighted = (ids: string[]): boolean => activeSequenceId !== null && ids.includes(activeSequenceId);
  return (
    <div className="estree__scroll">
      <div className="estree__canvas" style={{ width: layout.width, height: layout.height }}>
        {view.functionalEvents.map((event, index) => (
          <div key={event.id} className="estree__head" style={{ left: layout.columnX(index) }}>
            <div className="estree__head-bar" />
            <div className="estree__head-fe">FE{String(index + 1)}</div>
            <div className="estree__head-label">{event.label}</div>
            <div className="estree__head-sub">{event.sub}</div>
          </div>
        ))}
        <div className="estree__ie" style={{ top: layout.rootY }}>
          <div className="estree__ie-cap">Initiator</div>
          <div className="estree__ie-id">{view.initiatingEventId}</div>
          {showFrequency && view.initiatingEventFrequency !== undefined && <div className="estree__ie-freq">{formatExponential(view.initiatingEventFrequency)}/yr</div>}
        </div>
        <svg className="estree__svg" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.segments.map((segment, index) => <line key={index} className={`estree__seg${highlighted(segment.sequences) ? " estree__seg--hot" : ""}`} x1={segment.x1} y1={segment.y1} x2={segment.x2} y2={segment.y2} />)}
          {layout.dots.map((dot, index) => <circle key={index} className="estree__node-dot" cx={dot.x} cy={dot.y} r="3.4" />)}
          {layout.labels.map((label, index) => <text key={index} className={`estree__branch-lab estree__branch-lab--${label.kind.toLowerCase()}`} x={label.x} y={label.y}>{label.kind}</text>)}
        </svg>
        {layout.leaves.map((leaf) => {
          const sequence = sequences.get(leaf.sequenceId);
          return sequence === undefined ? null : (
            <button key={sequence.id} type="button" aria-label={`${sequence.name} ${sequence.id}`} className={`estree__seq${activeSequenceId === sequence.id ? " estree__seq--active" : ""}`} style={{ left: layout.endX + 6, top: leaf.y }} onMouseEnter={() => onHover(sequence.id)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(sequence.id)}>
              <SequenceOutcome sequence={sequence} showFrequency={showFrequency} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface EsdLayout {
  boxes: Array<{ x: number; y: number; eventIndex: number; sequences: string[] }>;
  links: Array<{ startX: number; startY: number; middleX: number; endX: number; endY: number; kind: "S" | "F"; sequences: string[] }>;
  labels: Array<{ x: number; y: number; kind: "S" | "F" }>;
  leaves: Array<{ sequenceId: string; y: number }>;
  rootY: number;
  endX: number;
  boxWidth: number;
  width: number;
  height: number;
}

function layoutEventSequenceDiagram(view: EventTreePresentationView): EsdLayout {
  const columnWidth = 172;
  const rowHeight = 82;
  const left = 92;
  const boxWidth = 124;
  const top = 40;
  const centerX = (index: number): number => left + 78 + index * columnWidth;
  const endX = left + 78 + view.functionalEvents.length * columnWidth;
  const leafY = new Map<string, number>();
  const nodeY = new Map<EventTreeNodeView, number>();
  let row = 0;
  const leaves: Array<{ sequenceId: string; y: number }> = [];
  const assign = (node: EventTreeNodeView | EventTreeLeafReference): number => {
    if ("seq" in node) {
      const y = top + (row + 0.5) * rowHeight;
      row += 1;
      if (node.seq.length > 0) leaves.push({ sequenceId: node.seq, y });
      leafY.set(node.seq, y);
      return y;
    }
    const y = (assign(node.S) + assign(node.F)) / 2;
    nodeY.set(node, y);
    return y;
  };
  const rootY = assign(view.node);
  const boxes: EsdLayout["boxes"] = [];
  const links: EsdLayout["links"] = [];
  const labels: EsdLayout["labels"] = [];
  const childY = (node: EventTreeNodeView | EventTreeLeafReference): number => "seq" in node ? (leafY.get(node.seq) ?? 0) : (nodeY.get(node) ?? 0);
  const walk = (node: EventTreeNodeView, y: number): void => {
    const x = centerX(node.fe);
    boxes.push({ x, y, eventIndex: node.fe, sequences: collectSequences(node) });
    for (const [kind, child] of [["S", node.S], ["F", node.F]] as const) {
      const endY = childY(child);
      const nextX = "seq" in child ? endX : centerX(child.fe) - boxWidth / 2;
      const startX = x + boxWidth / 2;
      links.push({ startX, startY: y, middleX: startX + (nextX - startX) / 2, endX: nextX, endY, kind, sequences: collectSequences(child) });
      labels.push({ x: startX + 9, y: y + (endY < y ? -7 : 15), kind });
      if (!("seq" in child)) walk(child, endY);
    }
  };
  if (!("seq" in view.node)) walk(view.node, rootY);
  return { boxes, links, labels, leaves, rootY, endX, boxWidth, width: endX + 176, height: top + Math.max(1, row) * rowHeight + 18 };
}

function actorFor(eventId: string): "operator" | "auto" | "passive" {
  if (/HFE|OP|MAN|ISO/i.test(eventId)) return "operator";
  if (/DRACS|RCCS|NC|PASS/i.test(eventId)) return "passive";
  return "auto";
}

function EventSequenceDiagram({ view, activeSequenceId, selectedEntityId, showFrequency, onHover, onSelectSequence, onSelectFunctionalEvent }: {
  view: EventTreePresentationView;
  activeSequenceId: string | null;
  selectedEntityId: string | null;
  showFrequency: boolean;
  onHover: (sequenceId: string | null) => void;
  onSelectSequence: (sequenceId: string) => void;
  onSelectFunctionalEvent: (functionalEventId: string) => void;
}): JSX.Element {
  const layout = useMemo(() => layoutEventSequenceDiagram(view), [view]);
  const sequences = new Map(view.sequences.map((sequence) => [sequence.id, sequence]));
  const highlighted = (ids: string[]): boolean => activeSequenceId !== null && ids.includes(activeSequenceId);
  const markerSuffix = view.id.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <div className="estree__scroll">
      <div className="esdg" style={{ width: layout.width, height: layout.height }}>
        <svg className="estree__svg" width={layout.width} height={layout.height} aria-hidden="true">
          <defs>
            <marker id={`esdg-s-${markerSuffix}`} markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="var(--c-complete)" /></marker>
            <marker id={`esdg-f-${markerSuffix}`} markerWidth="8" markerHeight="8" refX="6.5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#c44d4d" /></marker>
          </defs>
          {layout.links.map((link, index) => <path key={index} className={`esdg__link esdg__link--${link.kind.toLowerCase()}${highlighted(link.sequences) ? " esdg__link--hot" : ""}`} d={`M ${link.startX} ${link.startY} H ${link.middleX} V ${link.endY} H ${link.endX}`} markerEnd={`url(#esdg-${link.kind.toLowerCase()}-${markerSuffix})`} />)}
          {layout.labels.map((label, index) => <text key={index} className={`estree__branch-lab estree__branch-lab--${label.kind.toLowerCase()}`} x={label.x} y={label.y}>{label.kind}</text>)}
        </svg>
        <div className="esdg__ie" style={{ left: 6, top: layout.rootY }}><div className="esdg__ie-cap">Initiator</div><div className="esdg__ie-id">{view.initiatingEventId}</div></div>
        {layout.boxes.map((box, index) => {
          const event = view.functionalEvents[box.eventIndex];
          if (event === undefined) return null;
          const actor = actorFor(event.code);
          return (
            <button key={`${event.id}-${String(index)}`} type="button" className={`esdg__box esdg__box--${actor}${highlighted(box.sequences) || selectedEntityId === event.id ? " esdg__box--hot" : ""}`} style={{ left: box.x, top: box.y, width: layout.boxWidth }} onClick={() => onSelectFunctionalEvent(event.id)}>
              <span className="esdg__box-fe">{event.code}</span>
              <span className="esdg__box-label">{event.label}?</span>
              <span className="esdg__box-actor">{actor === "operator" ? "Operator" : actor === "passive" ? "Passive" : "Automatic"}</span>
            </button>
          );
        })}
        {layout.leaves.map((leaf) => {
          const sequence = sequences.get(leaf.sequenceId);
          if (sequence === undefined) return null;
          const safe = sequence.endState === "SUCCESSFUL_MITIGATION";
          return (
            <button key={sequence.id} type="button" aria-label={`${sequence.name} ${sequence.id}`} className={`esdg__end esdg__end--${safe ? "ok" : "block"}${activeSequenceId === sequence.id ? " esdg__end--active" : ""}`} style={{ left: layout.endX + 6, top: leaf.y }} onMouseEnter={() => onHover(sequence.id)} onMouseLeave={() => onHover(null)} onClick={() => onSelectSequence(sequence.id)}>
              <SequenceOutcome sequence={sequence} showFrequency={showFrequency} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface DynamicLayout {
  nodes: Array<{ id: string; x: number; y: number; challengedFunctionId?: string; condition: string; sequences: string[] }>;
  links: Array<{ startX: number; startY: number; splitX: number; endX: number; endY: number; kind: "S" | "F"; sequences: string[] }>;
  labels: Array<{ x: number; y: number; kind: "S" | "F"; text: string }>;
  leaves: Array<{ sequenceId: string; y: number; timing?: string }>;
  rootY: number; endX: number; width: number; height: number;
}

function layoutDynamic(run: DynamicRun, availableWidth: number): DynamicLayout {
  const left = 128;
  const boxWidth = 196;
  const rowHeight = 108;
  const top = 48;
  const nodeDepth = new Map<string, number>();
  const nodeY = new Map<string, number>();
  const leafY = new Map<string, number>();
  const leaves: DynamicLayout["leaves"] = [];
  let row = 0;
  let maxDepth = 0;
  const assign = (nodeId: string, depth: number): number => {
    const node = run.esdNodes[nodeId];
    if (node === undefined) return top + (row + 0.5) * rowHeight;
    nodeDepth.set(nodeId, depth);
    maxDepth = Math.max(maxDepth, depth);
    const ys = node.branches.flatMap((branch) => {
      if (branch.targetNodeId !== undefined && run.esdNodes[branch.targetNodeId] !== undefined) return [assign(branch.targetNodeId, depth + 1)];
      if (branch.sequenceId === undefined) return [];
      const y = top + (row + 0.5) * rowHeight;
      row += 1;
      leafY.set(branch.sequenceId, y);
      leaves.push({ sequenceId: branch.sequenceId, y, ...(branch.timing === undefined ? {} : { timing: branch.timing }) });
      return [y];
    });
    const y = ys.length === 0 ? top + (row + 0.5) * rowHeight : ((ys[0] ?? 0) + (ys[ys.length - 1] ?? 0)) / 2;
    nodeY.set(nodeId, y);
    return y;
  };
  const rootY = assign(run.rootNodeId, 0);
  const depthCount = maxDepth + 1;
  const width = Math.max(availableWidth, left + depthCount * 312 + 216);
  const columnWidth = (width - left - 216) / depthCount;
  const x = (depth: number): number => left + depth * columnWidth;
  const endX = width - 216;
  const leafCache = new Map<string, string[]>();
  const leafIds = (nodeId: string): string[] => {
    const cached = leafCache.get(nodeId);
    if (cached !== undefined) return cached;
    const ids = (run.esdNodes[nodeId]?.branches ?? []).flatMap((branch) => branch.targetNodeId !== undefined && run.esdNodes[branch.targetNodeId] !== undefined ? leafIds(branch.targetNodeId) : branch.sequenceId === undefined ? [] : [branch.sequenceId]);
    leafCache.set(nodeId, ids);
    return ids;
  };
  const nodes: DynamicLayout["nodes"] = [];
  const links: DynamicLayout["links"] = [];
  const labels: DynamicLayout["labels"] = [];
  const build = (nodeId: string): void => {
    const node = run.esdNodes[nodeId];
    if (node === undefined) return;
    const depth = nodeDepth.get(nodeId) ?? 0;
    const y = nodeY.get(nodeId) ?? 0;
    nodes.push({ id: nodeId, x: x(depth), y, condition: node.condition, sequences: leafIds(nodeId), ...(node.challengedFunctionId === undefined ? {} : { challengedFunctionId: node.challengedFunctionId }) });
    for (const branch of node.branches) {
      const kind = branch.outcome.toLowerCase().startsWith("s") ? "S" : "F";
      const startX = x(depth) + boxWidth;
      const targetNode = branch.targetNodeId === undefined ? undefined : run.esdNodes[branch.targetNodeId];
      const endY = targetNode === undefined ? (leafY.get(branch.sequenceId ?? "") ?? y) : (nodeY.get(branch.targetNodeId ?? "") ?? y);
      const nextX = targetNode === undefined ? endX : x(nodeDepth.get(branch.targetNodeId ?? "") ?? depth + 1);
      const ids = targetNode === undefined ? (branch.sequenceId === undefined ? [] : [branch.sequenceId]) : leafIds(branch.targetNodeId ?? "");
      links.push({ startX, startY: y, splitX: startX + 28, endX: nextX, endY, kind, sequences: ids });
      labels.push({ x: startX + 33, y: (y + endY) / 2, kind, text: `${kind}${branch.probability === undefined ? "" : ` ${(branch.probability * 100).toFixed(1)}%`}` });
      if (targetNode !== undefined && branch.targetNodeId !== undefined) build(branch.targetNodeId);
    }
  };
  build(run.rootNodeId);
  return { nodes, links, labels, leaves, rootY, endX, width, height: top + Math.max(1, row) * rowHeight + 20 };
}

function DynamicEventSequenceDiagram({ run, sequences, activeSequenceId, onHover, onSelect }: {
  run: DynamicRun;
  sequences: Map<string, EventTreeSequenceView>;
  activeSequenceId: string | null;
  onHover: (sequenceId: string | null) => void;
  onSelect: (sequenceId: string) => void;
}): JSX.Element {
  const host = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState(0);
  useLayoutEffect(() => {
    const element = host.current;
    if (element === null) return;
    const measure = (): void => setAvailableWidth(element.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(() => layoutDynamic(run, availableWidth), [availableWidth, run]);
  const highlighted = (ids: string[]): boolean => activeSequenceId !== null && ids.includes(activeSequenceId);
  return (
    <div className="estree__scroll" ref={host}>
      <div className="esdt" style={{ width: layout.width, height: layout.height }}>
        <svg className="estree__svg" width={layout.width} height={layout.height} aria-hidden="true">
          <path className="esdt__trunk" d={`M 94 ${layout.rootY} H 128`} />
          {layout.links.map((link, index) => <path key={index} className={`esdt__link esdt__link--${link.kind.toLowerCase()}${highlighted(link.sequences) ? " esdt__link--hot" : ""}`} d={`M ${link.startX} ${link.startY} H ${link.splitX} V ${link.endY} H ${link.endX}`} />)}
        </svg>
        <div className="esdt__ie" style={{ left: 10, top: layout.rootY, width: 84 }}><span className="esdt__ie-cap">Initiator</span><span className="esdt__ie-id">{run.initiatingEventId}</span></div>
        {layout.nodes.map((node) => <div key={node.id} className={`esdt__node${highlighted(node.sequences) ? " esdt__node--hot" : ""}`} style={{ left: node.x, top: node.y, width: 196 }}>{node.challengedFunctionId !== undefined && <span className="esdt__fn">{node.challengedFunctionId}</span>}<span className="esdt__cond">{node.condition}</span></div>)}
        {layout.labels.map((label, index) => <div key={index} className={`esdt__blab esdt__blab--${label.kind.toLowerCase()}`} style={{ left: label.x, top: label.y }}>{label.text}</div>)}
        {layout.leaves.map((leaf) => {
          const sequence = sequences.get(leaf.sequenceId);
          if (sequence === undefined) return null;
          const safe = sequence.endState === "SUCCESSFUL_MITIGATION";
          return <button key={leaf.sequenceId} type="button" aria-label={`${sequence.name} ${sequence.id}`} className={`esdt__leaf esdt__leaf--${safe ? "ok" : "rel"}${activeSequenceId === leaf.sequenceId ? " esdt__leaf--active" : ""}`} style={{ left: layout.endX + 6, top: leaf.y, width: 200 }} onMouseEnter={() => onHover(leaf.sequenceId)} onMouseLeave={() => onHover(null)} onClick={() => onSelect(leaf.sequenceId)}><SequenceOutcome sequence={sequence} showFrequency />{leaf.timing !== undefined && <span className="esdt__leaf-time">{leaf.timing}</span>}</button>;
        })}
      </div>
    </div>
  );
}

export { ClassicEventTreeDiagram, DynamicEventSequenceDiagram, EventSequenceDiagram, formatExponential };
