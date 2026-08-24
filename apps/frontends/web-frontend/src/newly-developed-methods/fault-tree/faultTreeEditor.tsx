import {
  type ChangeEvent,
  type JSX,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  FaultTreeBasicEvent,
  FaultTreeGate,
  FaultTreeLeafNode,
  FaultTreeNodePosition,
} from "interfaces-mef-types/modeling";
import {
  createFaultTreeAutoLayoutOperation,
  computeFaultTreeAutoLayout,
} from "./faultTreeOperations";
import {
  exportOpenPsaFaultTree,
  importOpenPsaFaultTree,
  mergeOpenPsaImportCatalogue,
} from "./openPsa";
import type {
  FaultTreeEditorCatalogue,
  FaultTreeEditorModel,
  FaultTreeEditorProps,
  FaultTreeOperation,
  FaultTreeSelection,
  FaultTreeTransferTarget,
} from "./faultTreeTypes";
import { useEditorConfirmation } from "../shared";
import "./css/faultTree.css";

const FT = {
  NODE_W: 184,
  NODE_H: 66,
  H_GAP: 24,
  SYM_H: 30,
  SYM_GAP: 12,
  LEVEL_GAP: 36,
  BUS_GAP: 16,
  PAD: 70,
};
const FT_ROW = FT.NODE_H + FT.SYM_GAP + FT.SYM_H + FT.LEVEL_GAP;
const FT_INSPECTOR_W = 320;

type TreeNode = FaultTreeGate | FaultTreeLeafNode;

interface PositionedNode {
  node: TreeNode;
  left: number;
  top: number;
  cx: number;
}

interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  origin: ViewportState;
}

interface DragState {
  pointerId: number;
  nodeId: string;
  startX: number;
  startY: number;
  origin: { x: number; y: number };
  current: { x: number; y: number };
}

interface Snapshot {
  model: FaultTreeEditorModel;
  catalogue: FaultTreeEditorCatalogue;
}

interface NodeContextMenuState {
  nodeId: string;
  x: number;
  y: number;
  view: "ACTIONS" | "BASIC_EVENT";
}

function selectionId(selection: FaultTreeSelection): string | null {
  if (selection === null) return null;
  if (selection.kind === "GATE") return selection.gateId;
  if (selection.kind === "LEAF") return selection.leafId;
  return selection.basicEventId;
}

function selectionForNode(node: TreeNode): FaultTreeSelection {
  return node.kind === "GATE"
    ? { kind: "GATE", gateId: node.id }
    : { kind: "LEAF", leafId: node.id };
}

function clampZoom(zoom: number): number {
  return Math.max(0.2, Math.min(2.4, zoom));
}

function EditorIcon({
  name,
}: {
  name: "undo" | "redo" | "file" | "zoom-out" | "zoom-in" | "fit" | "auto-layout";
}): JSX.Element {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.8,
  };
  return (
    <svg className="fteditor__button-icon" viewBox="0 0 24 24" aria-hidden="true">
      {name === "undo" && <><path {...common} d="M9 7H4V2" /><path {...common} d="M4.5 7A9 9 0 1 1 7 19.5" /></>}
      {name === "redo" && <><path {...common} d="M15 7h5V2" /><path {...common} d="M19.5 7A9 9 0 1 0 17 19.5" /></>}
      {name === "file" && <><path {...common} d="M6 3h8l4 4v14H6z" /><path {...common} d="M14 3v5h4" /><path {...common} d="M9 13h6M9 17h6" /></>}
      {(name === "zoom-out" || name === "zoom-in") && <><circle {...common} cx="10.5" cy="10.5" r="6.5" /><path {...common} d="m15.5 15.5 5 5M7.5 10.5h6" />{name === "zoom-in" && <path {...common} d="M10.5 7.5v6" />}</>}
      {name === "fit" && <><path {...common} d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" /><rect {...common} x="8" y="8" width="8" height="8" rx="1" /></>}
      {name === "auto-layout" && <><rect {...common} x="9" y="3" width="6" height="5" rx="1" /><rect {...common} x="3" y="16" width="6" height="5" rx="1" /><rect {...common} x="15" y="16" width="6" height="5" rx="1" /><path {...common} d="M12 8v4M6 12h12M6 12v4M18 12v4" /></>}
    </svg>
  );
}

function ScientificProbability({ value }: { value: number | undefined }): JSX.Element {
  if (value === undefined || !Number.isFinite(value)) return <span>—</span>;
  if (value === 0) return <span className="fteditor__mono">0</span>;
  const [coefficient = "0", rawExponent = "0"] = value.toExponential(2).split("e");
  const exponent = String(Number(rawExponent)).replace("-", "−");
  return (
    <span
      className="fteditor__mono fteditor__scientific"
      aria-label={`${coefficient} times 10 to the power of ${exponent}`}
    >
      {coefficient}<span aria-hidden="true"> × 10</span><sup aria-hidden="true">{exponent}</sup>
    </span>
  );
}

function formatContribution(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  const percentage = value * 100;
  if (percentage > 0 && percentage < 0.01) return "<0.01%";
  if (percentage >= 99.995) return `${percentage.toFixed(0)}%`;
  if (percentage >= 10) return `${percentage.toFixed(1)}%`;
  return `${percentage.toFixed(2)}%`;
}

function formatNodeProbability(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? "—" : value.toExponential(1);
}

function uniqueCode(prefix: string, existing: readonly string[]): string {
  const normalized = new Set(existing.map((code) => code.trim().toUpperCase()));
  let index = normalized.size + 1;
  while (normalized.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function effectiveLayoutDirection(model: FaultTreeEditorModel): FaultTreeEditorModel["layout"]["direction"] {
  const nodeIds = new Set([...model.gates.map(({ id }) => id), ...model.leafNodes.map(({ id }) => id)]);
  const savedIds = new Set(model.nodePositions.flatMap(({ nodeId }) => nodeIds.has(nodeId) ? [nodeId] : []));
  return model.layout.mode === "MANUAL" && savedIds.size === nodeIds.size
    ? model.layout.direction
    : "TOP_TO_BOTTOM";
}

function nodePositions(model: FaultTreeEditorModel): FaultTreeNodePosition[] {
  const ids = new Set([...model.gates.map(({ id }) => id), ...model.leafNodes.map(({ id }) => id)]);
  const saved = model.nodePositions.filter(({ nodeId }) => ids.has(nodeId));
  if (model.layout.mode === "MANUAL" && saved.length === ids.size) return saved;
  const automatic = normalizeAutomaticPositions(computeFaultTreeAutoLayout(model, {
    direction: effectiveLayoutDirection(model),
    nodeWidth: FT.NODE_W,
    nodeHeight: FT.NODE_H,
    horizontalGap: FT.H_GAP,
    verticalGap: FT.SYM_GAP + FT.SYM_H + FT.LEVEL_GAP,
    origin: { x: FT.PAD, y: FT.PAD },
  }));
  if (model.layout.mode === "AUTOMATIC") return automatic;
  const savedById = new Map(saved.map((position) => [position.nodeId, position]));
  return automatic.map((position) => savedById.get(position.nodeId) ?? position);
}

function normalizeAutomaticPositions(positions: FaultTreeNodePosition[]): FaultTreeNodePosition[] {
  if (positions.length === 0) return positions;
  const shiftX = FT.PAD - Math.min(...positions.map(({ position }) => position.x));
  const shiftY = FT.PAD - Math.min(...positions.map(({ position }) => position.y));
  return positions.map(({ nodeId, position }) => ({
    nodeId,
    position: { x: position.x + shiftX, y: position.y + shiftY },
  }));
}

function canvasGeometry(model: FaultTreeEditorModel, drag: DragState | null): {
  nodes: PositionedNode[];
  width: number;
  height: number;
} {
  const byPosition = new Map(nodePositions(model).map(({ nodeId, position }) => [nodeId, position]));
  if (drag !== null) byPosition.set(drag.nodeId, drag.current);
  const nodes = [...model.gates, ...model.leafNodes].map((node) => {
    const position = byPosition.get(node.id) ?? { x: FT.PAD, y: FT.PAD };
    return { node, left: position.x, top: position.y, cx: position.x + FT.NODE_W / 2 };
  });
  const width = Math.max(FT.NODE_W + FT.PAD * 2, ...nodes.map(({ left }) => left + FT.NODE_W + FT.PAD));
  const height = Math.max(
    FT.NODE_H + FT.PAD * 2,
    ...nodes.map(({ top }) => top + FT.NODE_H + FT.SYM_GAP + FT.SYM_H + FT.PAD),
  );
  return { nodes, width, height };
}

function fittedViewport(
  element: HTMLDivElement,
  geometry: { width: number; height: number },
  inspectorOpen: boolean,
): ViewportState {
  const inspectorWidth = inspectorOpen ? Math.min(FT_INSPECTOR_W, element.clientWidth) : 0;
  const availableWidth = Math.max(1, element.clientWidth - inspectorWidth);
  const availableHeight = Math.max(1, element.clientHeight);
  const zoom = clampZoom(
    Math.min(
      (availableWidth - 48) / geometry.width,
      (availableHeight - 64) / geometry.height,
    ),
  );
  return {
    zoom,
    x: (availableWidth - geometry.width * zoom) / 2,
    y: (availableHeight - geometry.height * zoom) / 2,
  };
}

function CommitField({
  label,
  value,
  disabled,
  multiline = false,
  type = "text",
  min,
  max,
  required = false,
  maxLength,
  onCommit,
}: {
  label: string;
  value: string;
  disabled: boolean;
  multiline?: boolean;
  type?: "text" | "number";
  min?: number;
  max?: number;
  required?: boolean;
  maxLength?: number;
  onCommit: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const invalid = required && draft.trim().length === 0;
  const commit = (): void => {
    const next = required ? draft.trim() : draft;
    if (invalid || (maxLength !== undefined && next.length > maxLength)) return;
    if (next !== value) onCommit(next);
  };
  return (
    <label className="fteditor__field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          className="fteditor__textarea"
          value={draft}
          disabled={disabled}
          maxLength={maxLength}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className="fteditor__input"
          type={type}
          min={min}
          max={max}
          required={required}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          value={draft}
          disabled={disabled}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
        />
      )}
      {invalid && <span className="fteditor__field-error" role="alert">{label} is required.</span>}
    </label>
  );
}

function FtSymbol({
  node,
  cx,
  top,
  catalogue,
}: {
  node: TreeNode;
  cx: number;
  top: number;
  catalogue: FaultTreeEditorCatalogue;
}): JSX.Element {
  const symTop = top + FT.NODE_H + FT.SYM_GAP;
  const gateWidth = 44;
  const left = cx - gateWidth / 2;
  const right = cx + gateWidth / 2;
  const bottom = symTop + FT.SYM_H;
  const orPath = `M ${left} ${bottom} C ${left} ${bottom - FT.SYM_H * 0.55} ${cx - gateWidth * 0.16} ${symTop} ${cx} ${symTop} C ${cx + gateWidth * 0.16} ${symTop} ${right} ${bottom - FT.SYM_H * 0.55} ${right} ${bottom} C ${cx + gateWidth * 0.22} ${bottom - FT.SYM_H * 0.34} ${cx - gateWidth * 0.22} ${bottom - FT.SYM_H * 0.34} ${left} ${bottom} Z`;

  if (node.kind === "GATE") {
    if (node.gateType === "OR") return <path d={orPath} className="ftgate ftgate--or" />;
    if (node.gateType === "K_OF_N") {
      return (
        <g>
          <path d={orPath} className="ftgate ftgate--kn" />
          <text x={cx} y={symTop + FT.SYM_H * 0.72} className="ftgate-lab">
            {node.k}/n
          </text>
        </g>
      );
    }
    if (node.gateType === "NOT") {
      return (
        <g>
          <path d={`M ${left + 5} ${symTop} L ${right - 5} ${symTop} L ${cx} ${bottom - 5} Z`} className="ftgate ftgate--not" />
          <circle cx={cx} cy={bottom - 1.5} r="3.5" className="ftgate ftgate--not" />
        </g>
      );
    }
    const arc = FT.SYM_H * 0.6;
    return (
      <path
        d={`M ${left} ${bottom} L ${left} ${symTop + arc} A ${gateWidth / 2} ${arc} 0 0 1 ${right} ${symTop + arc} L ${right} ${bottom} Z`}
        className="ftgate ftgate--and"
      />
    );
  }

  if (node.kind === "TRANSFER_REFERENCE") {
    return <path d={`M ${cx} ${symTop} L ${right} ${bottom} L ${left} ${bottom} Z`} className="ftsym ftsym--tr" />;
  }
  if (node.kind === "HOUSE_EVENT") {
    return (
      <path
        d={`M ${left + 5} ${symTop + 11} L ${cx} ${symTop} L ${right - 5} ${symTop + 11} L ${right - 5} ${bottom} L ${left + 5} ${bottom} Z`}
        className="ftsym ftsym--house"
      />
    );
  }
  if (node.kind === "UNDEVELOPED_EVENT") {
    return <path d={`M ${cx} ${symTop} L ${right - 5} ${symTop + 15} L ${cx} ${bottom} L ${left + 5} ${symTop + 15} Z`} className="ftsym ftsym--undeveloped" />;
  }
  const presentation = catalogue.presentations?.find(({ basicEventId }) => basicEventId === node.basicEventId);
  const radius = FT.SYM_H * 0.5;
  return (
    <g>
      <circle
        cx={cx}
        cy={symTop + radius}
        r={radius}
        className={`ftsym ftsym--be${presentation?.commonCause === true ? " ftsym--ccf" : ""}`}
      />
      {presentation?.commonCause === true && (
        <circle cx={cx} cy={symTop + radius} r={radius - 3.5} className="ftsym ftsym--ccf-inner" />
      )}
    </g>
  );
}

function gateKind(gate: FaultTreeGate, inputCount: number): string {
  if (gate.gateType === "K_OF_N") return `${gate.k} of ${inputCount} voting gate`;
  if (gate.gateType === "NOT") return "NOT gate";
  return `${gate.gateType} gate`;
}

function FtBox({
  positioned,
  selected,
  invalid,
  catalogue,
  transferTargets,
  resultProbability,
  readOnly,
  inputCount,
  onSelect,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  positioned: PositionedNode;
  selected: boolean;
  invalid: boolean;
  catalogue: FaultTreeEditorCatalogue;
  transferTargets: readonly FaultTreeTransferTarget[];
  resultProbability?: number;
  readOnly: boolean;
  inputCount: number;
  onSelect: () => void;
  onContextMenu?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}): JSX.Element {
  const { node, left, top } = positioned;
  const selectedClass = selected ? " ftbox--selected" : "";
  const invalidClass = invalid ? " ftbox--invalid" : "";
  const dragProps = readOnly ? {} : { onPointerDown, onPointerMove, onPointerUp };
  if (node.kind === "GATE") {
    return (
      <button
        type="button"
        className={`ftbox ftbox--gate${node.gateType === "K_OF_N" ? " ftbox--votegate" : ""}${selectedClass}${invalidClass}`}
        style={{ left, top, width: FT.NODE_W, height: FT.NODE_H }}
        aria-label={`${gateKind(node, inputCount)} ${node.name}`}
        onClick={onSelect}
        onContextMenu={onContextMenu}
        {...dragProps}
      >
        <span className="ftbox__name">{node.name}</span>
        <span className="ftbox__be-meta">
          <span className="ftbox__id">{node.code}</span>
          {resultProbability !== undefined && <span className="ftbox__prob">P = {formatNodeProbability(resultProbability)}</span>}
        </span>
      </button>
    );
  }

  if (node.kind === "TRANSFER_REFERENCE") {
    const target = transferTargets.find(
      (candidate) => candidate.target.modelId === node.target.modelId && candidate.target.entityId === node.target.entityId,
    );
    return (
      <button
        type="button"
        className={`ftbox ftbox--tr${selectedClass}${invalidClass}`}
        style={{ left, top, width: FT.NODE_W, height: FT.NODE_H }}
        aria-label={`Transfer ${node.name}`}
        title="Open the transferred tree"
        onClick={onSelect}
        onContextMenu={onContextMenu}
        {...dragProps}
      >
        <span className="ftbox__name">{node.name}</span>
        <span className="ftbox__be-meta">
          <span className="ftbox__id">{node.code}</span>
          <span className="ftbox__to">To {target?.code ?? node.target.modelId}</span>
        </span>
      </button>
    );
  }

  if (node.kind === "BASIC_EVENT_REFERENCE") {
    const basicEvent = catalogue.basicEvents.find(({ id }) => id === node.basicEventId);
    const presentation = catalogue.presentations?.find(({ basicEventId }) => basicEventId === node.basicEventId);
    const short = presentation?.failureModeShort ?? presentation?.failureModeLabel ?? "—";
    return (
      <button
        type="button"
        className={`ftbox ftbox--be${presentation?.commonCause === true ? " ftbox--ccf" : ""}${selectedClass}${invalidClass}`}
        style={{ left, top, width: FT.NODE_W, height: FT.NODE_H }}
        aria-label={basicEvent?.name ?? node.basicEventId}
        title="Open the basic event"
        onClick={onSelect}
        onContextMenu={onContextMenu}
        {...dragProps}
      >
        <span className="ftbox__name">{basicEvent?.name ?? node.basicEventId}</span>
        <span className="ftbox__be-meta">
          <span className="ftbox__id">{basicEvent?.code ?? node.basicEventId}</span>
          <span className={`ftbox__fm${presentation?.commonCause === true ? " ftbox__fm--ccf" : ""}`}>{short}</span>
          <span className="ftbox__prob">{formatNodeProbability(basicEvent?.probability.value)}</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`ftbox ftbox--be${selectedClass}${invalidClass}`}
      style={{ left, top, width: FT.NODE_W, height: FT.NODE_H }}
      aria-label={node.name}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      {...dragProps}
    >
      <span className="ftbox__name">{node.name}</span>
      <span className="ftbox__be-meta">
        <span className="ftbox__id">{node.code}</span>
      </span>
    </button>
  );
}

function NodeInspector({
  model,
  catalogue,
  selection,
  transferTargets,
  editable,
  canEditBasicEvents,
  commit,
  onOpenReference,
}: Pick<FaultTreeEditorProps, "model" | "catalogue" | "selection" | "transferTargets" | "onOpenReference"> & {
  editable: boolean;
  canEditBasicEvents: boolean;
  commit: (operation: FaultTreeOperation) => void;
}): JSX.Element | null {
  const id = selectionId(selection);
  const gate = model.gates.find((candidate) => candidate.id === id);
  const leaf = model.leafNodes.find((candidate) => candidate.id === id);
  const selectedBasicEvent = selection?.kind === "BASIC_EVENT"
    ? catalogue.basicEvents.find(({ id: basicEventId }) => basicEventId === selection.basicEventId)
    : undefined;
  const basicEvent = leaf?.kind === "BASIC_EVENT_REFERENCE"
    ? catalogue.basicEvents.find(({ id: basicEventId }) => basicEventId === leaf.basicEventId)
    : selectedBasicEvent;
  const nodeId = gate?.id ?? leaf?.id;
  const parentInputs = nodeId === undefined ? [] : model.gateInputs.filter(({ childId }) => childId === nodeId);
  const inputCount = gate === undefined ? 0 : model.gateInputs.filter(({ gateId }) => gateId === gate.id).length;

  if (gate === undefined && leaf === undefined && basicEvent === undefined) {
    return null;
  }

  const updateGate = (next: FaultTreeGate): void => commit({ type: "UPDATE_GATE", gateId: next.id, gate: next });
  const updateLeaf = (next: FaultTreeLeafNode): void => commit({ type: "UPDATE_LEAF", leafId: next.id, leaf: next });
  const updateBasicEvent = (next: FaultTreeBasicEvent): void => commit({ type: "UPDATE_BASIC_EVENT", basicEventId: next.id, basicEvent: next });

  return (
    <div>
      <h3>{gate !== undefined ? "Gate" : leaf !== undefined ? "Event" : "Basic event"}</h3>
      {gate !== undefined && (
        <>
          <CommitField label="Code" value={gate.code} disabled={!editable} required maxLength={64} onCommit={(code) => updateGate({ ...gate, code })} />
          <CommitField label="Name" value={gate.name} disabled={!editable} required maxLength={200} onCommit={(name) => updateGate({ ...gate, name })} />
          <CommitField label="Description" value={gate.description} disabled={!editable} multiline maxLength={10_000} onCommit={(description) => updateGate({ ...gate, description })} />
          <label className="fteditor__field">
            <span>Gate type</span>
            <select
              className="fteditor__select"
              value={gate.gateType}
              disabled={!editable}
              onChange={(event) => {
                const gateType = event.target.value as FaultTreeGate["gateType"];
                if (gateType === "NOT" && inputCount > 1) return;
                const identity = {
                  id: gate.id,
                  code: gate.code,
                  name: gate.name,
                  description: gate.description,
                  kind: "GATE" as const,
                };
                updateGate(gateType === "K_OF_N"
                  ? { ...identity, gateType, k: Math.max(1, Math.min(inputCount || 1, "k" in gate ? gate.k : 1)) }
                  : { ...identity, gateType });
              }}
            >
              <option value="OR">OR</option>
              <option value="AND">AND</option>
              <option value="NOT" disabled={inputCount > 1}>NOT{inputCount > 1 ? " (requires one input)" : ""}</option>
              <option value="K_OF_N">K of N</option>
            </select>
          </label>
          {gate.gateType === "K_OF_N" && (
            <CommitField
              label={`K (1–${Math.max(1, inputCount)})`}
              value={String(gate.k)}
              type="number"
              min={1}
              max={Math.max(1, inputCount)}
              disabled={!editable}
              onCommit={(value) => updateGate({ ...gate, k: Math.max(1, Math.min(Math.max(1, inputCount), Number(value) || 1)) })}
            />
          )}
          <label className="fteditor__field">
            <span>Top gate</span>
            <select
              className="fteditor__select"
              value={model.topGate?.gateId ?? ""}
              disabled={!editable}
              onChange={(event) => commit({ type: "SET_TOP_GATE", gateId: event.target.value || null })}
            >
              <option value="">No top gate</option>
              {model.gates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.code} · {candidate.name}</option>)}
            </select>
          </label>
        </>
      )}

      {leaf?.kind === "BASIC_EVENT_REFERENCE" && (
        <>
          <label className="fteditor__field">
            <span>Basic event</span>
            <select
              className="fteditor__select"
              value={leaf.basicEventId}
              disabled={!editable}
              onChange={(event) => updateLeaf({ ...leaf, basicEventId: event.target.value })}
            >
              {catalogue.basicEvents.map((event) => <option key={event.id} value={event.id}>{event.code} · {event.name}</option>)}
            </select>
          </label>
          <button type="button" className="fteditor__btn" onClick={() => onOpenReference({ kind: "BASIC_EVENT", basicEventId: leaf.basicEventId })}>Open basic event</button>
        </>
      )}

      {leaf !== undefined && leaf.kind !== "BASIC_EVENT_REFERENCE" && (
        <>
          <CommitField label="Code" value={leaf.code} disabled={!editable} required maxLength={64} onCommit={(code) => updateLeaf({ ...leaf, code })} />
          <CommitField label="Name" value={leaf.name} disabled={!editable} required maxLength={200} onCommit={(name) => updateLeaf({ ...leaf, name })} />
          <CommitField label="Description" value={leaf.description} disabled={!editable} multiline maxLength={10_000} onCommit={(description) => updateLeaf({ ...leaf, description })} />
        </>
      )}

      {leaf?.kind === "HOUSE_EVENT" && (
        <label className="fteditor__field">
          <span>Logical state</span>
          <select className="fteditor__select" value={leaf.state ? "true" : "false"} disabled={!editable} onChange={(event) => updateLeaf({ ...leaf, state: event.target.value === "true" })}>
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        </label>
      )}

      {leaf?.kind === "TRANSFER_REFERENCE" && (
        <>
          <label className="fteditor__field">
            <span>Transfer target</span>
            <select
              className="fteditor__select"
              value={`${leaf.target.modelId}|${leaf.target.entityId}`}
              disabled={!editable}
              onChange={(event) => {
                const target = transferTargets?.find((candidate) => `${candidate.target.modelId}|${candidate.target.entityId}` === event.target.value);
                if (target !== undefined) updateLeaf({ ...leaf, target: target.target });
              }}
            >
              {(transferTargets ?? []).map((target) => <option key={`${target.target.modelId}|${target.target.entityId}`} value={`${target.target.modelId}|${target.target.entityId}`}>{target.code} · {target.name}</option>)}
            </select>
          </label>
          <button type="button" className="fteditor__btn" onClick={() => onOpenReference({ kind: "TRANSFER", target: leaf.target })}>Open transfer target</button>
        </>
      )}

      {basicEvent !== undefined && (
        <>
          <hr className="fteditor__divider" />
          <h3>Basic-event definition</h3>
          <CommitField label="Code" value={basicEvent.code} disabled={!canEditBasicEvents} required maxLength={64} onCommit={(code) => updateBasicEvent({ ...basicEvent, code })} />
          <CommitField label="Name" value={basicEvent.name} disabled={!canEditBasicEvents} required maxLength={200} onCommit={(name) => updateBasicEvent({ ...basicEvent, name })} />
          <CommitField label="Description" value={basicEvent.description} disabled={!canEditBasicEvents} multiline maxLength={10_000} onCommit={(description) => updateBasicEvent({ ...basicEvent, description })} />
          <CommitField
            label="Probability (0–1)"
            value={String(basicEvent.probability.value)}
            type="number"
            min={0}
            max={1}
            disabled={!canEditBasicEvents}
            onCommit={(value) => {
              const probability = Number(value);
              if (Number.isFinite(probability) && probability >= 0 && probability <= 1) updateBasicEvent({ ...basicEvent, probability: { ...basicEvent.probability, value: probability } });
            }}
          />
        </>
      )}

      {nodeId !== undefined && (
        <>
          <hr className="fteditor__divider" />
          <h3>Connections</h3>
          {parentInputs.length === 0 && <p className="fteditor__hint">This node has no parent gate.</p>}
          {parentInputs.map((input) => (
            <div key={input.id} className="fteditor__actions">
              <select
                className="fteditor__select"
                style={{ flex: 1 }}
                value={input.gateId}
                disabled={!editable}
                aria-label="Parent gate"
                onChange={(event) => commit({ type: "REPARENT", inputId: input.id, gateId: event.target.value })}
              >
                {model.gates.filter((candidate) => candidate.id !== nodeId).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.code}</option>)}
              </select>
              <button type="button" className="fteditor__btn" disabled={!editable} onClick={() => commit({ type: "DISCONNECT", inputId: input.id })}>Disconnect</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Results({
  analysisResult,
  resultIsStale,
  catalogue,
}: Pick<FaultTreeEditorProps, "analysisResult" | "resultIsStale" | "catalogue">): JSX.Element | null {
  if (analysisResult === null) return null;
  const result = analysisResult;
  const basicEvents = new Map(catalogue.basicEvents.map((basicEvent) => [basicEvent.id, basicEvent]));
  return (
    <section className="fteditor__results" aria-label="Fault-tree analysis results">
      <div className="fteditor__header">
        <h3>Analysis results</h3>
        {resultIsStale && <span className="fteditor__pill fteditor__pill--stale">Results are stale</span>}
      </div>
      <p className="fteditor__run-detail">
        Run <span className="fteditor__mono">{result.runId}</span> · workbook revision {result.owner.workbookRevision} · completed {new Date(result.completedAt).toLocaleString()}
      </p>
      <div className="fteditor__result-metrics">
        <div className="fteditor__result-metric">
          <span>Exact top-event probability</span>
          <strong><ScientificProbability value={result.topEventProbability} /></strong>
        </div>
        <div className="fteditor__result-metric">
          <span>Minimal cut sets</span>
          <strong className="fteditor__mono">{result.minimalCutSetCount}</strong>
        </div>
      </div>
      <div className="fteditor__table-wrap">
        <table className="fteditor__table">
          <colgroup>
            <col className="fteditor__table-rank" />
            <col className="fteditor__table-order" />
            <col />
            <col className="fteditor__table-probability" />
            <col className="fteditor__table-contribution" />
          </colgroup>
          <thead><tr><th>Rank</th><th>Order</th><th>Events</th><th>Probability</th><th>Contribution</th></tr></thead>
          <tbody>
            {result.leadingCutSets.map((cutSet) => {
              const contribution = cutSet.contribution ?? (
                cutSet.probability !== undefined && result.topEventProbability > 0
                  ? cutSet.probability / result.topEventProbability
                  : undefined
              );
              return (
                <tr key={cutSet.rank}>
                  <td><span className="fteditor__cut-set-rank">{cutSet.rank}</span></td>
                  <td className="fteditor__mono">{cutSet.order}</td>
                  <td>
                    <div className="fteditor__cut-set-events">
                      {cutSet.events.map((event, index) => {
                        const basicEvent = basicEvents.get(event.basicEventId);
                        const label = basicEvent?.code || basicEvent?.name || "Unknown basic event";
                        return (
                          <span key={`${event.basicEventId}-${index}`} className="fteditor__cut-set-event-wrap">
                            {index > 0 && <span className="fteditor__intersection" aria-hidden="true">∩</span>}
                            <span
                              className={`fteditor__cut-set-event${event.complemented ? " fteditor__cut-set-event--complemented" : ""}`}
                              title={basicEvent === undefined ? event.basicEventId : basicEvent.name}
                            >
                              {event.complemented && <span aria-label="not">¬</span>}{label}
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  </td>
                  <td><ScientificProbability value={cutSet.probability} /></td>
                  <td>
                    <div className="fteditor__contribution">
                      <span className="fteditor__mono">{formatContribution(contribution)}</span>
                      {contribution !== undefined && Number.isFinite(contribution) && (
                        <span className="fteditor__contribution-track" aria-hidden="true">
                          <span style={{ width: `${Math.max(0, Math.min(100, contribution * 100))}%` }} />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {result.leadingCutSets.length === 0 && <tr><td colSpan={5}>No minimal cut sets were returned.</td></tr>}
          </tbody>
        </table>
      </div>
      {result.validationIssues.length > 0 && (
        <div className="fteditor__run-detail">
          <p>The immutable run record contains {result.validationIssues.length} validation warning{result.validationIssues.length === 1 ? "" : "s"}.</p>
          <ul className="fteditor__issues">
            {result.validationIssues.map((issue, index) => (
              <li key={`${issue.code}-${issue.entityId ?? "model"}-${index}`}>
                <strong>{issue.severity}</strong> {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function FaultTreeEditor(props: FaultTreeEditorProps): JSX.Element {
  const {
    model,
    catalogue,
    capabilities,
    selection,
    validation,
    saveState,
    analysisResult,
    resultIsStale,
    transferTargets = [],
    onOperation,
    onSelectionChange,
    onOpenReference,
    onRun,
  } = props;
  const editable = capabilities.mode === "AUTHOR";
  const viewportRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const geometryRef = useRef({ width: 0, height: 0 });
  const inspectorOpenRef = useRef(false);
  const history = useRef<Snapshot[]>([]);
  const future = useRef<Snapshot[]>([]);
  const modelIdRef = useRef(model.modelId);
  const [viewport, setViewport] = useState<ViewportState>(model.layout.viewport);
  const [pan, setPan] = useState<PanState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [contextMenu, setContextMenu] = useState<NodeContextMenuState | null>(null);
  const [basicEventSearch, setBasicEventSearch] = useState("");
  const [operationError, setOperationError] = useState<string | null>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();

  useEffect(
    () => setViewport(model.layout.viewport),
    [model.layout.viewport.x, model.layout.viewport.y, model.layout.viewport.zoom],
  );
  useEffect(() => {
    if (modelIdRef.current === model.modelId) return;
    modelIdRef.current = model.modelId;
    history.current = [];
    future.current = [];
    onSelectionChange(null);
  }, [model.modelId, onSelectionChange]);
  useEffect(() => {
    if (contextMenu === null) return undefined;
    const closeOnPointerDown = (event: PointerEvent): void => {
      if ((event.target as HTMLElement).closest(".fteditor__context-menu") === null) {
        setContextMenu(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setContextMenu(null);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  const geometry = useMemo(() => canvasGeometry(model, drag), [model, drag]);
  const positionedById = useMemo(() => new Map(geometry.nodes.map((positioned) => [positioned.node.id, positioned])), [geometry.nodes]);
  const selectedId = selectionId(selection);
  const invalidIds = useMemo(() => new Set(validation.flatMap((issue) => issue.entityId === undefined ? [] : [issue.entityId])), [validation]);
  const inspectedSelectionExists = capabilities.mode !== "REFERENCE_SELECTION" && selection !== null && (
    (selection.kind === "GATE" && model.gates.some(({ id }) => id === selection.gateId))
    || (selection.kind === "LEAF" && model.leafNodes.some(({ id }) => id === selection.leafId))
    || (selection.kind === "BASIC_EVENT" && catalogue.basicEvents.some(({ id }) => id === selection.basicEventId))
  );
  geometryRef.current = { width: geometry.width, height: geometry.height };
  inspectorOpenRef.current = inspectedSelectionExists;
  const contextNode = contextMenu === null
    ? undefined
    : [...model.gates, ...model.leafNodes].find(({ id }) => id === contextMenu.nodeId);
  const contextGate = contextNode?.kind === "GATE" ? contextNode : undefined;
  const contextNodeName = contextNode?.kind === "BASIC_EVENT_REFERENCE"
    ? catalogue.basicEvents.find(({ id }) => id === contextNode.basicEventId)?.name ?? contextNode.basicEventId
    : contextNode?.name;
  const contextCanAcceptChild = contextGate !== undefined && (
    contextGate.gateType !== "NOT"
    || model.gateInputs.filter(({ gateId }) => gateId === contextGate.id).length === 0
  );
  const normalizedBasicEventSearch = basicEventSearch.trim().toLocaleLowerCase();
  const matchingBasicEvents = catalogue.basicEvents.filter((basicEvent) => (
    normalizedBasicEventSearch === ""
    || basicEvent.code.toLocaleLowerCase().includes(normalizedBasicEventSearch)
    || basicEvent.name.toLocaleLowerCase().includes(normalizedBasicEventSearch)
  ));
  const existingCodes = [...model.gates.filter((gate) => "code" in gate).map((gate) => gate.code), ...model.leafNodes.filter((leaf): leaf is Exclude<FaultTreeLeafNode, { kind: "BASIC_EVENT_REFERENCE" }> => leaf.kind !== "BASIC_EVENT_REFERENCE").map((leaf) => leaf.code)];

  useEffect(() => {
    if (contextMenu !== null && contextNode === undefined) setContextMenu(null);
  }, [contextMenu, contextNode]);
  useEffect(() => {
    const element = viewportRef.current;
    if (element === null) return undefined;
    const refit = (): void => {
      if (element.clientWidth === 0 || element.clientHeight === 0) return;
      setViewport(fittedViewport(element, geometryRef.current, inspectorOpenRef.current));
    };
    refit();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(refit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [model.modelId]);
  useEffect(() => {
    const element = viewportRef.current;
    if (element === null || element.clientWidth === 0 || element.clientHeight === 0) return;
    setViewport(fittedViewport(element, geometryRef.current, inspectedSelectionExists));
  }, [inspectedSelectionExists]);

  const emit = (operation: FaultTreeOperation, recordHistory = true): void => {
    try {
      if (recordHistory && operation.type !== "REPLACE_SNAPSHOT") {
        history.current.push({ model, catalogue });
        if (history.current.length > 100) history.current.shift();
        future.current = [];
      }
      onOperation(operation);
      setOperationError(null);
    } catch (error) {
      if (recordHistory && operation.type !== "REPLACE_SNAPSHOT") history.current.pop();
      setOperationError(error instanceof Error ? error.message : "The fault-tree operation failed.");
    }
  };

  const undo = (): void => {
    const previous = history.current.pop();
    if (previous === undefined) return;
    future.current.push({ model, catalogue });
    emit({ type: "REPLACE_SNAPSHOT", ...previous }, false);
  };
  const redo = (): void => {
    const next = future.current.pop();
    if (next === undefined) return;
    history.current.push({ model, catalogue });
    emit({ type: "REPLACE_SNAPSHOT", ...next }, false);
  };

  const commitViewport = (next: ViewportState): void => {
    if (editable && capabilities.canEditLayout) {
      emit({ type: "SET_LAYOUT", layout: { ...model.layout, viewport: next } });
    }
  };
  const fit = (): void => {
    const element = viewportRef.current;
    if (element === null) return;
    const next = fittedViewport(element, geometry, inspectedSelectionExists);
    setViewport(next);
    commitViewport(next);
  };
  const zoomBy = (factor: number): void => {
    const element = viewportRef.current;
    if (element === null) return;
    const zoom = clampZoom(viewport.zoom * factor);
    const cx = element.clientWidth / 2;
    const cy = element.clientHeight / 2;
    const next = { zoom, x: cx - ((cx - viewport.x) / viewport.zoom) * zoom, y: cy - ((cy - viewport.y) / viewport.zoom) * zoom };
    setViewport(next);
    commitViewport(next);
  };
  const onWheel = (event: WheelEvent<HTMLDivElement>): void => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const lineMultiplier = event.deltaMode === 1 ? 16 : 1;
    const pageMultiplier = event.deltaMode === 2 ? event.currentTarget.clientHeight : 1;
    const multiplier = lineMultiplier * pageMultiplier;
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const py = event.clientY - bounds.top;
    setViewport((current) => {
      const zoom = clampZoom(current.zoom * Math.exp(-event.deltaY * multiplier * 0.002));
      return {
        zoom,
        x: px - ((px - current.x) / current.zoom) * zoom,
        y: py - ((py - current.y) / current.zoom) * zoom,
      };
    });
  };
  const beginPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest(".ftbox") !== null) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPan({ pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin: viewport });
    setContextMenu(null);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pan === null || pan.pointerId !== event.pointerId) return;
    setViewport({ ...pan.origin, x: pan.origin.x + event.clientX - pan.startX, y: pan.origin.y + event.clientY - pan.startY });
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (pan === null || pan.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    const deltaX = event.clientX - pan.startX;
    const deltaY = event.clientY - pan.startY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      const next = { ...pan.origin, x: pan.origin.x + deltaX, y: pan.origin.y + deltaY };
      setViewport(next);
      commitViewport(next);
    } else {
      setViewport(pan.origin);
      onSelectionChange(null);
    }
    setPan(null);
  };

  const beginDrag = (positioned: PositionedNode, event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0 || !editable || !capabilities.canEditLayout) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ pointerId: event.pointerId, nodeId: positioned.node.id, startX: event.clientX, startY: event.clientY, origin: { x: positioned.left, y: positioned.top }, current: { x: positioned.left, y: positioned.top } });
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    setDrag({ ...drag, current: { x: drag.origin.x + (event.clientX - drag.startX) / viewport.zoom, y: drag.origin.y + (event.clientY - drag.startY) / viewport.zoom } });
  };
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (drag === null || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (drag.current.x !== drag.origin.x || drag.current.y !== drag.origin.y) {
      if (model.layout.mode === "AUTOMATIC") {
        emit({
          type: "SET_LAYOUT",
          layout: { ...model.layout, mode: "MANUAL", direction: "TOP_TO_BOTTOM" },
          nodePositions: geometry.nodes.map(({ node, left, top }) => ({
            nodeId: node.id,
            position: node.id === drag.nodeId ? drag.current : { x: left, y: top },
          })),
        });
      } else {
        emit({ type: "SET_NODE_POSITION", nodeId: drag.nodeId, position: drag.current });
      }
    }
    setDrag(null);
  };

  const openNode = (node: TreeNode): void => {
    if (node.kind === "BASIC_EVENT_REFERENCE") onOpenReference({ kind: "BASIC_EVENT", basicEventId: node.basicEventId });
    if (node.kind === "TRANSFER_REFERENCE") onOpenReference({ kind: "TRANSFER", target: node.target });
  };
  const selectReferenceNode = (node: TreeNode): void => {
    if (node.kind === "GATE") {
      onOpenReference({
        kind: "GATE",
        target: { modelId: model.modelId, entityId: node.id },
      });
      return;
    }
    openNode(node);
  };

  const openContextMenu = (
    node: TreeNode,
    event: ReactMouseEvent<HTMLButtonElement>,
  ): void => {
    if (!editable) return;
    event.preventDefault();
    event.stopPropagation();
    const element = viewportRef.current;
    if (element === null) return;
    const bounds = element.getBoundingClientRect();
    const menuWidth = Math.min(228, Math.max(1, element.clientWidth - 24));
    const menuHeight = Math.min(390, Math.max(1, element.clientHeight - 24));
    setBasicEventSearch("");
    setContextMenu({
      nodeId: node.id,
      x: Math.max(12, Math.min(event.clientX - bounds.left, element.clientWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(event.clientY - bounds.top, element.clientHeight - menuHeight - 12)),
      view: "ACTIONS",
    });
  };
  const addGate = (targetParentGateId?: string): void => {
    const code = uniqueCode("G", existingCodes);
    emit({
      type: "ADD_GATE",
      gate: { kind: "GATE", gateType: "OR", code, name: "New gate", description: "" },
      parentGateId: targetParentGateId,
      setAsTopGate: model.topGate === null,
    });
    setContextMenu(null);
  };
  const addLeaf = (
    kind: "HOUSE_EVENT" | "UNDEVELOPED_EVENT" | "TRANSFER_REFERENCE",
    targetParentGateId: string | undefined,
  ): void => {
    if (targetParentGateId === undefined) return;
    const code = uniqueCode(kind === "HOUSE_EVENT" ? "HE" : kind === "UNDEVELOPED_EVENT" ? "UE" : "TR", existingCodes);
    if (kind === "HOUSE_EVENT") emit({ type: "ADD_LEAF", leaf: { kind, code, name: "New house event", description: "", state: false }, parentGateId: targetParentGateId });
    if (kind === "UNDEVELOPED_EVENT") emit({ type: "ADD_LEAF", leaf: { kind, code, name: "New undeveloped event", description: "" }, parentGateId: targetParentGateId });
    if (kind === "TRANSFER_REFERENCE" && transferTargets[0] !== undefined) emit({ type: "ADD_LEAF", leaf: { kind, code, name: "New transfer", description: "", target: transferTargets[0].target }, parentGateId: targetParentGateId });
    setContextMenu(null);
  };
  const addExistingBasicEvent = (parentGateId: string, basicEventId: string): void => {
    emit({
      type: "ADD_LEAF",
      leaf: { kind: "BASIC_EVENT_REFERENCE", basicEventId },
      parentGateId,
    });
    setContextMenu(null);
  };
  const createNewBasicEvent = (parentGateId: string): void => {
    const code = uniqueCode("BE", catalogue.basicEvents.map(({ code: eventCode }) => eventCode));
    emit({
      type: "ADD_BASIC_EVENT",
      basicEvent: {
        code,
        name: "New basic event",
        description: "",
        probability: { value: 0 },
      },
      parentGateId,
    });
    setContextMenu(null);
  };
  const deleteContextNode = (): void => {
    if (contextNode === undefined) return;
    setContextMenu(null);
    requestConfirmation({
      title: "Delete this fault-tree node?",
      message: "Orphaned descendants will be removed only when they are not shared by another parent.",
      confirmLabel: "Delete node",
      tone: "danger",
    }, () => {
      emit(
        contextNode.kind === "GATE"
          ? { type: "DELETE_GATE", gateId: contextNode.id, subtree: true }
          : { type: "DELETE_LEAF", leafId: contextNode.id, subtree: true },
      );
      if (selectedId === contextNode.id) onSelectionChange(null);
    });
  };

  const exportXml = (): void => {
    try {
      const xml = exportOpenPsaFaultTree(model, catalogue);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" }));
      link.download = `${model.code || "fault-tree"}.xml`;
      link.click();
      URL.revokeObjectURL(link.href);
      setOperationError(null);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "OpenPSA export failed.");
    }
  };
  const importXml = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    try {
      const imported = importOpenPsaFaultTree(await file.text());
      emit({
        type: "REPLACE_SNAPSHOT",
        model: { ...imported.model, modelId: model.modelId },
        catalogue: mergeOpenPsaImportCatalogue(catalogue, imported.catalogue),
      });
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "OpenPSA import failed.");
    }
  };

  const lines: JSX.Element[] = [];
  geometry.nodes.forEach((positioned) => {
    const symTop = positioned.top + FT.NODE_H + FT.SYM_GAP;
    lines.push(<line key={`${positioned.node.id}-symbol-line`} x1={positioned.cx} y1={positioned.top + FT.NODE_H} x2={positioned.cx} y2={symTop} className="ftline" />);
  });

  const connectedChildren = (gateId: string): Array<{
    input: FaultTreeEditorModel["gateInputs"][number];
    child: PositionedNode;
  }> => model.gateInputs
    .filter(({ gateId: candidateId }) => candidateId === gateId)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    .flatMap((input) => {
      const child = positionedById.get(input.childId);
      return child === undefined ? [] : [{ input, child }];
    });
  const portOffset = (index: number, count: number): number => {
    if (count <= 1) return 0;
    const usableHeight = FT.NODE_H - 20;
    return (index / (count - 1) - 0.5) * usableHeight;
  };
  const horizontalPortOffset = (index: number, count: number): number => {
    if (count <= 1) return 0;
    const usableWidth = FT.NODE_W - 40;
    return (index / (count - 1) - 0.5) * usableWidth;
  };

  if (effectiveLayoutDirection(model) === "LEFT_TO_RIGHT") {
    const incomingByChild = new Map<string, FaultTreeEditorModel["gateInputs"]>();
    for (const input of model.gateInputs) {
      const incoming = incomingByChild.get(input.childId) ?? [];
      incoming.push(input);
      incomingByChild.set(input.childId, incoming);
    }
    for (const incoming of incomingByChild.values()) {
      incoming.sort((left, right) => left.gateId.localeCompare(right.gateId) || left.order - right.order);
    }

    geometry.nodes.filter(({ node }) => node.kind === "GATE").forEach((positioned) => {
      const children = connectedChildren(positioned.node.id);
      const leftChildren = children.filter(({ child }) => child.left < positioned.left);
      const rightChildren = children.filter(({ child }) => child.left >= positioned.left);
      children.forEach(({ input, child }) => {
        const childIsLeft = child.left < positioned.left;
        const siblings = childIsLeft ? leftChildren : rightChildren;
        const parentPortIndex = siblings.findIndex(({ input: sibling }) => sibling.id === input.id);
        const incoming = incomingByChild.get(child.node.id) ?? [];
        const childPortIndex = incoming.findIndex(({ id }) => id === input.id);
        const parentDockY = positioned.top + FT.NODE_H / 2 + portOffset(parentPortIndex, siblings.length);
        const childDockY = child.top + FT.NODE_H / 2 + portOffset(childPortIndex, incoming.length);
        const startX = childIsLeft ? child.left + FT.NODE_W : positioned.left + FT.NODE_W;
        const startY = childIsLeft ? childDockY : parentDockY;
        const endX = childIsLeft ? positioned.left : child.left;
        const endY = childIsLeft ? parentDockY : childDockY;
        const selected = selectedId === positioned.node.id || selectedId === child.node.id;
        const invalid = invalidIds.has(input.id);
        lines.push(
          <line
            key={input.id}
            x1={startX}
            y1={startY}
            x2={endX}
            y2={endY}
            className={`ftline ftedge${selected ? " ftline--selected" : ""}${invalid ? " ftline--invalid" : ""}`}
            vectorEffect="non-scaling-stroke"
            data-testid="fault-tree-edge"
            data-edge-id={input.id}
          />,
        );
      });
    });
  } else {
    const incomingByChild = new Map<string, FaultTreeEditorModel["gateInputs"]>();
    for (const input of model.gateInputs) {
      const incoming = incomingByChild.get(input.childId) ?? [];
      incoming.push(input);
      incomingByChild.set(input.childId, incoming);
    }
    for (const incoming of incomingByChild.values()) {
      incoming.sort((left, right) => left.gateId.localeCompare(right.gateId) || left.order - right.order);
    }

    geometry.nodes.filter(({ node }) => node.kind === "GATE").forEach((positioned) => {
      const category = (node: TreeNode): number => {
        if (node.kind === "BASIC_EVENT_REFERENCE") return 0;
        if (node.kind === "HOUSE_EVENT" || node.kind === "UNDEVELOPED_EVENT") return 1;
        if (node.kind === "GATE") return 2;
        return 3;
      };
      const children = connectedChildren(positioned.node.id).sort((left, right) =>
        category(left.child.node) - category(right.child.node)
        || left.child.left - right.child.left
        || left.child.top - right.child.top);
      if (children.length === 0) return;
      const symBottom = positioned.top + FT.NODE_H + FT.SYM_GAP + FT.SYM_H;
      const basicEvents = children.filter(({ child }) => child.node.kind === "BASIC_EVENT_REFERENCE");
      const nonBasicEvents = children.filter(({ child }) => child.node.kind !== "BASIC_EVENT_REFERENCE");
      const childConnections = children.map(({ input, child }) => {
        const incoming = incomingByChild.get(child.node.id) ?? [];
        const childPortIndex = incoming.findIndex(({ id }) => id === input.id);
        return {
          input,
          child,
          childPortIndex,
          incomingCount: incoming.length,
        };
      });
      const basicEventRailX = basicEvents.length === 0
        ? null
        : Math.min(...basicEvents.map(({ child }) => child.left)) - FT.BUS_GAP;
      const firstChildY = Math.min(...childConnections.map(({ child, childPortIndex, incomingCount }) =>
        child.node.kind === "BASIC_EVENT_REFERENCE"
          ? child.top + FT.NODE_H / 2 + portOffset(childPortIndex, incomingCount)
          : child.top));
      const availableTrunkHeight = firstChildY - symBottom;
      const branchY = symBottom + (availableTrunkHeight > 0
        ? Math.min(FT.BUS_GAP, availableTrunkHeight / 2)
        : FT.BUS_GAP);
      const nonBasicDockXs = nonBasicEvents.map(({ input, child }) => {
        const incoming = incomingByChild.get(child.node.id) ?? [];
        const childPortIndex = incoming.findIndex(({ id }) => id === input.id);
        return child.cx + horizontalPortOffset(childPortIndex, incoming.length);
      });
      const busXs = [
        positioned.cx,
        ...nonBasicDockXs,
        ...(basicEventRailX === null ? [] : [basicEventRailX]),
      ];
      const sharedSelected = selectedId === positioned.node.id;
      const sharedInvalid = children.some(({ input }) => invalidIds.has(input.id));
      const sharedClass = `ftline ftline--trunk${sharedSelected ? " ftline--selected" : ""}${sharedInvalid ? " ftline--invalid" : ""}`;
      lines.push(
        <line
          key={`${positioned.node.id}-connector-trunk`}
          x1={positioned.cx}
          y1={symBottom}
          x2={positioned.cx}
          y2={branchY}
          className={sharedClass}
          vectorEffect="non-scaling-stroke"
          data-testid="fault-tree-trunk"
          data-gate-id={positioned.node.id}
        />,
      );
      const busStartX = Math.min(...busXs);
      const busEndX = Math.max(...busXs);
      if (busStartX !== busEndX) {
        lines.push(
          <line
            key={`${positioned.node.id}-connector-bus`}
            x1={busStartX}
            y1={branchY}
            x2={busEndX}
            y2={branchY}
            className="ftline ftline--bus"
            vectorEffect="non-scaling-stroke"
            data-testid="fault-tree-bus"
            data-gate-id={positioned.node.id}
          />,
        );
      }
      if (basicEventRailX !== null) {
        const lastBasicEventY = Math.max(...childConnections.flatMap(({ child, childPortIndex, incomingCount }) =>
          child.node.kind === "BASIC_EVENT_REFERENCE"
            ? [child.top + FT.NODE_H / 2 + portOffset(childPortIndex, incomingCount)]
            : []));
        lines.push(
          <line
            key={`${positioned.node.id}-basic-event-rail`}
            x1={basicEventRailX}
            y1={branchY}
            x2={basicEventRailX}
            y2={lastBasicEventY}
            className="ftline ftline--bus ftline--basic-event-rail"
            vectorEffect="non-scaling-stroke"
            data-testid="fault-tree-basic-event-rail"
            data-gate-id={positioned.node.id}
          />,
        );
      }
      childConnections.forEach(({ input, child, childPortIndex, incomingCount }) => {
        const selected = selectedId === positioned.node.id || selectedId === child.node.id;
        const invalid = invalidIds.has(input.id);
        let x1: number;
        let y1: number;
        let x2: number;
        let y2: number;
        if (child.node.kind === "BASIC_EVENT_REFERENCE") {
          const dockY = child.top + FT.NODE_H / 2 + portOffset(childPortIndex, incomingCount);
          x1 = basicEventRailX ?? child.left - FT.BUS_GAP;
          y1 = dockY;
          x2 = child.left;
          y2 = dockY;
        } else {
          x1 = child.cx + horizontalPortOffset(childPortIndex, incomingCount);
          y1 = branchY;
          x2 = x1;
          y2 = child.top;
        }
        lines.push(
          <line
            key={input.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            className={`ftline ftedge${selected ? " ftline--selected" : ""}${invalid ? " ftline--invalid" : ""}`}
            vectorEffect="non-scaling-stroke"
            data-testid="fault-tree-edge"
            data-edge-id={input.id}
          />,
        );
      });
    });
  }

  return (
    <div className="fteditor" data-testid="fault-tree-editor">
      <div className="fteditor__header">
        <div className="fteditor__identity">
          <CommitField label="Tree code" value={model.code} disabled={!editable} required maxLength={64} onCommit={(code) => emit({ type: "UPDATE_MODEL", patch: { code } })} />
          <CommitField label="Fault-tree name" value={model.name} disabled={!editable} required maxLength={200} onCommit={(name) => emit({ type: "UPDATE_MODEL", patch: { name } })} />
        </div>
        <div className="fteditor__header-actions">
          <div className="fteditor__status">
            <span className="fteditor__pill">{capabilities.mode === "READ_ONLY" ? "Read only" : capabilities.mode === "REFERENCE_SELECTION" ? "Select a reference" : "Authoring"}</span>
            <span className={`fteditor__pill${saveState === "failed" ? " fteditor__pill--error" : ""}`}>{saveState === "saving" ? "Saving…" : saveState === "failed" ? "Save failed" : "Saved"}</span>
            {resultIsStale && <span className="fteditor__pill fteditor__pill--stale">Results stale</span>}
          </div>
          {capabilities.canRunAnalysis && <button type="button" className="fteditor__btn fteditor__btn--primary" disabled={validation.some(({ severity }) => severity === "ERROR") || saveState !== "saved"} onClick={onRun}>Run analysis</button>}
        </div>
      </div>

      <div className="fteditor__commandbar" aria-label="Fault-tree document commands">
        {editable && (
          <>
            <button type="button" className="fteditor__icon-btn" aria-label="Undo" title="Undo" disabled={history.current.length === 0} onClick={undo}><EditorIcon name="undo" /></button>
            <button type="button" className="fteditor__icon-btn" aria-label="Redo" title="Redo" disabled={future.current.length === 0} onClick={redo}><EditorIcon name="redo" /></button>
          </>
        )}
        {(capabilities.canImport || capabilities.canExport) && (
          <details className="fteditor__menu">
            <summary className="fteditor__icon-btn" role="button" aria-label="File" title="File" aria-haspopup="menu"><EditorIcon name="file" /></summary>
            <div className="fteditor__menu-popover" role="menu">
              {capabilities.canImport && <button type="button" className="fteditor__menu-item" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); importRef.current?.click(); }}>Import OpenPSA XML</button>}
              {capabilities.canExport && <button type="button" className="fteditor__menu-item" onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); exportXml(); }}>Export OpenPSA XML</button>}
            </div>
          </details>
        )}
        <input ref={importRef} className="fteditor__file" type="file" accept=".xml,application/xml,text/xml" onChange={(event) => { void importXml(event); }} />
      </div>

      {operationError !== null && <div className="fteditor__notice fteditor__notice--error" role="alert">{operationError}</div>}

      <div className={`fteditor__workspace${inspectedSelectionExists ? " fteditor__workspace--inspecting" : ""}`}>
        <div
          ref={viewportRef}
          className={`fteditor__viewport${pan !== null ? " is-panning" : ""}${drag !== null ? " is-dragging" : ""}`}
          onWheel={onWheel}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
        >
          <div className="fteditor__canvas-controls" aria-label="Fault-tree canvas controls" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className="fteditor__icon-btn" onClick={() => zoomBy(1 / 1.15)} aria-label="Zoom out" title="Zoom out"><EditorIcon name="zoom-out" /></button>
            <output className="fteditor__zoom" aria-label="Zoom level">{Math.round(viewport.zoom * 100)}%</output>
            <button type="button" className="fteditor__icon-btn" onClick={() => zoomBy(1.15)} aria-label="Zoom in" title="Zoom in"><EditorIcon name="zoom-in" /></button>
            <button type="button" className="fteditor__icon-btn" aria-label="Fit" title="Fit to screen" onClick={fit}><EditorIcon name="fit" /></button>
            {editable && capabilities.canEditLayout && <button type="button" className="fteditor__icon-btn" aria-label="Auto layout" title="Auto layout" onClick={() => {
              const operation = createFaultTreeAutoLayoutOperation(model, {
                direction: "TOP_TO_BOTTOM",
                nodeWidth: FT.NODE_W,
                nodeHeight: FT.NODE_H,
                horizontalGap: FT.H_GAP,
                verticalGap: FT_ROW - FT.NODE_H,
                origin: { x: FT.PAD, y: FT.PAD },
              });
              emit({ ...operation, nodePositions: normalizeAutomaticPositions(operation.nodePositions ?? []) });
            }}><EditorIcon name="auto-layout" /></button>}
          </div>
          {contextMenu !== null && contextNode !== undefined && (
            <div
              className="fteditor__context-menu"
              role="menu"
              aria-label={`Actions for ${contextNodeName ?? "fault-tree node"}`}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {contextMenu.view === "BASIC_EVENT" && contextGate !== undefined ? (
                <>
                  <div className="fteditor__context-header">
                    <button
                      type="button"
                      className="fteditor__context-back"
                      aria-label="Back to node actions"
                      onClick={() => setContextMenu({ ...contextMenu, view: "ACTIONS" })}
                    >
                      ←
                    </button>
                    <div className="fteditor__context-title">Add basic event</div>
                  </div>
                  <button
                    type="button"
                    className="fteditor__context-item"
                    role="menuitem"
                    disabled={!capabilities.canEditBasicEvents}
                    onClick={() => createNewBasicEvent(contextGate.id)}
                  >
                    Create new basic event
                  </button>
                  <div className="fteditor__context-separator" />
                  <label className="fteditor__context-field">
                    <span>Choose an existing basic event</span>
                    <input
                      autoFocus
                      className="fteditor__input"
                      type="search"
                      aria-label="Search basic events"
                      placeholder="Search by code or name"
                      value={basicEventSearch}
                      onChange={(event) => setBasicEventSearch(event.target.value)}
                    />
                  </label>
                  <div className="fteditor__context-results" aria-label="Existing basic events">
                    {matchingBasicEvents.map((basicEvent) => (
                      <button
                        key={basicEvent.id}
                      type="button"
                      className="fteditor__context-item"
                      role="menuitem"
                      title={basicEvent.code}
                      onClick={() => addExistingBasicEvent(contextGate.id, basicEvent.id)}
                    >
                      {basicEvent.code}
                    </button>
                    ))}
                    {matchingBasicEvents.length === 0 && (
                      <p className="fteditor__context-hint">No basic events match this search.</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="fteditor__context-title">
                    {contextGate !== undefined ? `Add under ${contextGate.code}` : "Node actions"}
                  </div>
                  {contextGate !== undefined && contextCanAcceptChild ? (
                    <>
                      <button type="button" className="fteditor__context-item" role="menuitem" onClick={() => addGate(contextGate.id)}>
                        Add gate
                      </button>
                      <button
                        type="button"
                        className="fteditor__context-item"
                        role="menuitem"
                        onClick={() => {
                          setBasicEventSearch("");
                          setContextMenu({ ...contextMenu, view: "BASIC_EVENT" });
                        }}
                      >
                        Add basic event
                      </button>
                      <button type="button" className="fteditor__context-item" role="menuitem" onClick={() => addLeaf("HOUSE_EVENT", contextGate.id)}>
                        Add house event
                      </button>
                      <button type="button" className="fteditor__context-item" role="menuitem" onClick={() => addLeaf("UNDEVELOPED_EVENT", contextGate.id)}>
                        Add undeveloped event
                      </button>
                      <button
                        type="button"
                        className="fteditor__context-item"
                        role="menuitem"
                        disabled={transferTargets.length === 0}
                        onClick={() => addLeaf("TRANSFER_REFERENCE", contextGate.id)}
                      >
                        Add transfer
                      </button>
                    </>
                  ) : contextGate !== undefined ? (
                    <p className="fteditor__context-hint">This NOT gate already has its single input.</p>
                  ) : null}
                  <div className="fteditor__context-separator" />
                  <button
                    type="button"
                    className="fteditor__context-item fteditor__context-item--danger"
                    role="menuitem"
                    onClick={deleteContextNode}
                  >
                    Delete node
                  </button>
                </>
              )}
            </div>
          )}
          {geometry.nodes.length === 0 ? (
            <div className="fteditor__empty-state">
              <strong>No top event yet</strong>
              <span>Create a gate to start this fault tree.</span>
              {editable && <button type="button" className="fteditor__btn fteditor__btn--primary" onPointerDown={(event) => event.stopPropagation()} onClick={() => addGate()}>Create top gate</button>}
            </div>
          ) : (
            <div className="fteditor__stage sytree" style={{ width: geometry.width, height: geometry.height, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
              <div className="ftscroll">
                <div className="ftcanvas" style={{ width: geometry.width, height: geometry.height }}>
                  <svg className="ftsvg" width={geometry.width} height={geometry.height} viewBox={`0 0 ${geometry.width} ${geometry.height}`}>
                    {lines}
                    {geometry.nodes.map((positioned) => <FtSymbol key={`${positioned.node.id}-symbol`} node={positioned.node} cx={positioned.cx} top={positioned.top} catalogue={catalogue} />)}
                  </svg>
                  {geometry.nodes.map((positioned) => (
                    <FtBox
                      key={positioned.node.id}
                      positioned={positioned}
                      selected={selectedId === positioned.node.id}
                      invalid={invalidIds.has(positioned.node.id)}
                      catalogue={catalogue}
                      transferTargets={transferTargets}
                      resultProbability={positioned.node.id === model.topGate?.gateId && !resultIsStale ? analysisResult?.topEventProbability : undefined}
                      readOnly={!editable || !capabilities.canEditLayout}
                      inputCount={positioned.node.kind === "GATE" ? model.gateInputs.filter(({ gateId }) => gateId === positioned.node.id).length : 0}
                      onSelect={() => {
                        setContextMenu(null);
                        onSelectionChange(selectionForNode(positioned.node));
                        if (capabilities.mode === "REFERENCE_SELECTION") selectReferenceNode(positioned.node);
                      }}
                      onContextMenu={editable ? (event) => openContextMenu(positioned.node, event) : undefined}
                      onPointerDown={(event) => beginDrag(positioned, event)}
                      onPointerMove={moveDrag}
                      onPointerUp={endDrag}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        {inspectedSelectionExists && (
          <aside className="fteditor__inspector" aria-label="Selected fault-tree node inspector">
            <div className="fteditor__inspector-header">
              <span>Properties</span>
              <button type="button" className="fteditor__close" aria-label="Close inspector" onClick={() => onSelectionChange(null)}>×</button>
            </div>
            <div className="fteditor__inspector-body">
              <NodeInspector
                model={model}
                catalogue={catalogue}
                selection={selection}
                transferTargets={transferTargets}
                editable={editable}
                canEditBasicEvents={editable && capabilities.canEditBasicEvents}
                commit={emit}
                onOpenReference={onOpenReference}
              />
            </div>
          </aside>
        )}
      </div>

      {validation.length > 0 && (
        <section className="fteditor__validation" aria-label="Fault-tree validation">
          <h3>Validation · {validation.length} issue{validation.length === 1 ? "" : "s"}</h3>
          <ul className="fteditor__issues">
            {validation.map((issue, index) => (
              <li key={`${issue.code}-${issue.entityId ?? "model"}-${index}`}>
                <button
                  type="button"
                  className="fteditor__issue"
                  onClick={() => {
                    if (issue.entityId === undefined) return;
                    if (model.gates.some(({ id }) => id === issue.entityId)) onSelectionChange({ kind: "GATE", gateId: issue.entityId });
                    else if (model.leafNodes.some(({ id }) => id === issue.entityId)) onSelectionChange({ kind: "LEAF", leafId: issue.entityId });
                    else if (catalogue.basicEvents.some(({ id }) => id === issue.entityId)) onSelectionChange({ kind: "BASIC_EVENT", basicEventId: issue.entityId });
                  }}
                >
                  <strong>{issue.severity}</strong>{issue.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Results analysisResult={analysisResult} resultIsStale={resultIsStale} catalogue={catalogue} />
      {confirmationDialog}
    </div>
  );
}
