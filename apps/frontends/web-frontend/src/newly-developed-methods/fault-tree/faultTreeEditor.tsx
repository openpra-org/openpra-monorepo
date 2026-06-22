import { JSX, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { FaultTreeNode } from "./faultTreeNode";
import { layoutFaultTree } from "./faultTreeLayout";
import { NODE_TYPE_OPTIONS, autoChildCount, minChildCount, newNodeLabel, type NodeTypeOption } from "./faultTreeRules";
import { type FtInputNode, type FtNode, type FtNodeData, type FtFlavor } from "./faultTreeTypes";
import "./css/faultTree.css";

const NODE_TYPES = { fault: FaultTreeNode };

function buildGraph(input: FtInputNode[]): { nodes: FtNode[]; edges: Edge[] } {
  const nodes: FtNode[] = input.map((n) => ({ id: n.id, type: "fault", position: { x: 0, y: 0 }, data: n.data }));
  const edges: Edge[] = input
    .filter((n) => n.parentId !== undefined && n.parentId.length > 0)
    .map((n) => ({ id: `e-${n.parentId}-${n.id}`, source: n.parentId as string, target: n.id, type: "smoothstep" }));
  return { nodes: layoutFaultTree(nodes, edges), edges };
}

function descendantsOf(id: string, edges: Edge[]): Set<string> {
  const drop = new Set<string>();
  let changed = true;
  let frontier = [id];
  while (changed) {
    changed = false;
    const next: string[] = [];
    for (const e of edges) {
      if (frontier.includes(e.source) && !drop.has(e.target)) {
        drop.add(e.target);
        next.push(e.target);
        changed = true;
      }
    }
    frontier = next;
  }
  return drop;
}

interface MenuState {
  nodeId: string;
  x: number;
  y: number;
}

function ContextMenu({ x, y, canDelete, isGate, onEdit, onChangeType, onAddChild, onDelete }: {
  x: number;
  y: number;
  canDelete: boolean;
  isGate: boolean;
  onEdit: () => void;
  onChangeType: (opt: NodeTypeOption) => void;
  onAddChild: (opt: NodeTypeOption) => void;
  onDelete: () => void;
}): JSX.Element {
  const [view, setView] = useState<"root" | "type" | "add">("root");
  return (
    <div className="ftmenu" style={{ left: x, top: y }} onContextMenu={(e) => e.preventDefault()}>
      {view === "root" && (
        <>
          <button type="button" className="ftmenu__item" onClick={onEdit}>Edit name and description</button>
          <button type="button" className="ftmenu__item" onClick={() => setView("type")}>Change node type</button>
          <button type="button" className="ftmenu__item" onClick={() => setView("add")}>Add child</button>
          {canDelete && <button type="button" className="ftmenu__item ftmenu__item--danger" onClick={onDelete}>{isGate ? "Delete node and subtree" : "Delete node"}</button>}
        </>
      )}
      {view === "type" && (
        <>
          <button type="button" className="ftmenu__back" onClick={() => setView("root")}>Change node type to</button>
          {NODE_TYPE_OPTIONS.map((opt) => <button key={opt.key} type="button" className="ftmenu__item" onClick={() => onChangeType(opt)}>{opt.label}</button>)}
        </>
      )}
      {view === "add" && (
        <>
          <button type="button" className="ftmenu__back" onClick={() => setView("root")}>Add child of type</button>
          {NODE_TYPE_OPTIONS.map((opt) => <button key={opt.key} type="button" className="ftmenu__item" onClick={() => onAddChild(opt)}>{opt.label}</button>)}
        </>
      )}
    </div>
  );
}

function EditPopup({ x, y, node, onSave, onCancel }: {
  x: number;
  y: number;
  node: FtNode;
  onSave: (patch: Partial<FtNodeData>) => void;
  onCancel: () => void;
}): JSX.Element {
  const [label, setLabel] = useState(node.data.label);
  const [detail, setDetail] = useState(node.data.detail ?? "");
  const [k, setK] = useState(node.data.k ?? 2);
  const isVoting = node.data.type === "GATE" && node.data.gate === "ATLEAST";
  return (
    <div className="ftpopup" style={{ left: x, top: y }}>
      <label className="ftfld__label">Name</label>
      <input className="ftfld__input" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus />
      <label className="ftfld__label">Description</label>
      <textarea className="ftfld__input" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
      {isVoting && (
        <>
          <label className="ftfld__label">K (votes required)</label>
          <input className="ftfld__input" type="number" min="1" value={k} onChange={(e) => setK(Number(e.target.value))} />
        </>
      )}
      <div className="ftpopup__actions">
        <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => onSave(isVoting ? { label, detail, k } : { label, detail })}>Save</button>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function DetailPopup({ x, y, node, onClose }: {
  x: number;
  y: number;
  node: FtNode;
  onClose: () => void;
}): JSX.Element {
  const desc = node.data.detail !== undefined && node.data.detail.length > 0 ? node.data.detail : "No description recorded.";
  return (
    <div className="ftview" style={{ left: x, top: y }}>
      <div className="ftview__label">Name</div>
      <div className="ftview__name">{node.data.label}</div>
      <div className="ftview__label">Description</div>
      <div className="ftview__desc">{desc}</div>
      {node.data.badges !== undefined && node.data.badges.length > 0 && (
        <>
          <div className="ftview__label">Initiating events</div>
          <div className="ftview__badges">{node.data.badges.map((b) => <span key={b} className="ftview__badge">{b}</span>)}</div>
        </>
      )}
      <div className="ftview__actions">
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function FaultTreeCanvas({ input, flavor }: { input: FtInputNode[]; flavor: FtFlavor }): JSX.Element {
  const initial = useMemo(() => buildGraph(input), [input]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const seq = useRef(1);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editing, setEditing] = useState<MenuState | null>(null);
  const [detail, setDetail] = useState<MenuState | null>(null);

  const newId = (): string => {
    const id = `ft-${seq.current}`;
    seq.current += 1;
    return id;
  };
  const closeAll = (): void => {
    setMenu(null);
    setEditing(null);
    setDetail(null);
  };
  function relayout(ns: FtNode[], es: Edge[]): void {
    setNodes(layoutFaultTree(ns, es));
    setEdges(es);
  }
  function mkBasic(parentId: string, ns: FtNode[], es: Edge[]): void {
    const id = newId();
    ns.push({ id, type: "fault", position: { x: 0, y: 0 }, data: { label: flavor === "heat" ? "New cause" : "New event", type: "BASIC" } });
    es.push({ id: `e-${parentId}-${id}`, source: parentId, target: id, type: "smoothstep" });
  }
  function addChild(parentId: string, opt: NodeTypeOption): void {
    const ns: FtNode[] = nodes.map((n) => (n.id === parentId && n.data.type !== "GATE" ? { ...n, selected: false, data: { ...n.data, type: "GATE", gate: n.data.gate ?? "OR" } } : { ...n, selected: false }));
    const es: Edge[] = [...edges];
    const id = newId();
    ns.push({ id, type: "fault", position: { x: 0, y: 0 }, selected: true, data: { label: newNodeLabel(opt, flavor), type: opt.type, gate: opt.gate, k: opt.gate === "ATLEAST" ? 2 : undefined } });
    es.push({ id: `e-${parentId}-${id}`, source: parentId, target: id, type: "smoothstep" });
    if (opt.type === "GATE" && opt.gate !== undefined) {
      const count = autoChildCount(opt.gate);
      for (let i = 0; i < count; i += 1) mkBasic(id, ns, es);
    }
    relayout(ns, es);
    closeAll();
  }
  function changeType(nodeId: string, opt: NodeTypeOption): void {
    let ns: FtNode[] = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, type: opt.type, gate: opt.gate, k: opt.gate === "ATLEAST" ? (n.data.k ?? 2) : undefined } } : n));
    let es: Edge[] = [...edges];
    if (opt.type !== "GATE") {
      const drop = descendantsOf(nodeId, edges);
      ns = ns.filter((n) => !drop.has(n.id));
      es = es.filter((e) => !drop.has(e.source) && !drop.has(e.target));
    } else if (opt.gate !== undefined) {
      const have = edges.filter((e) => e.source === nodeId).length;
      for (let i = have; i < autoChildCount(opt.gate); i += 1) mkBasic(nodeId, ns, es);
    }
    relayout(ns, es);
    closeAll();
  }
  function deleteNode(nodeId: string): void {
    const parent = edges.find((e) => e.target === nodeId)?.source;
    if (parent === undefined) {
      closeAll();
      return;
    }
    const drop = descendantsOf(nodeId, edges);
    drop.add(nodeId);
    relayout(nodes.filter((n) => !drop.has(n.id)), edges.filter((e) => !drop.has(e.source) && !drop.has(e.target)));
    closeAll();
  }
  function saveEdit(nodeId: string, patch: Partial<FtNodeData>): void {
    setNodes((ns) => ns.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n)));
    closeAll();
  }

  const menuNode = menu !== null ? nodes.find((n) => n.id === menu.nodeId) ?? null : null;
  const editNode = editing !== null ? nodes.find((n) => n.id === editing.nodeId) ?? null : null;
  const detailNode = detail !== null ? nodes.find((n) => n.id === detail.nodeId) ?? null : null;
  const menuParent = menuNode !== null ? edges.find((e) => e.target === menuNode.id)?.source : undefined;
  const menuParentNode = menuParent !== undefined ? nodes.find((n) => n.id === menuParent) ?? null : null;
  const menuCanDelete =
    menuNode !== null &&
    menuParent !== undefined &&
    (menuParentNode === null ||
      menuParentNode.data.type !== "GATE" ||
      menuParentNode.data.gate === undefined ||
      edges.filter((e) => e.source === menuParent).length - 1 >= minChildCount(menuParentNode.data.gate));

  return (
    <div className="fted">
      <div className="fted__canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(e, node) => { setMenu(null); setEditing(null); setDetail({ nodeId: node.id, x: e.clientX, y: e.clientY }); }}
          onNodeContextMenu={(e, node) => { e.preventDefault(); setEditing(null); setDetail(null); setMenu({ nodeId: node.id, x: e.clientX, y: e.clientY }); }}
          onPaneClick={closeAll}
          nodeTypes={NODE_TYPES}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.2, minZoom: 0.4, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={22} size={1} color="var(--color-border)" />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeStrokeWidth={2} />
        </ReactFlow>
      </div>
      {menu !== null && menuNode !== null && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          canDelete={menuCanDelete}
          isGate={menuNode.data.type === "GATE"}
          onEdit={() => { setEditing(menu); setMenu(null); }}
          onChangeType={(opt) => changeType(menu.nodeId, opt)}
          onAddChild={(opt) => addChild(menu.nodeId, opt)}
          onDelete={() => deleteNode(menu.nodeId)}
        />
      )}
      {editing !== null && editNode !== null && (
        <EditPopup x={editing.x} y={editing.y} node={editNode} onSave={(patch) => saveEdit(editing.nodeId, patch)} onCancel={closeAll} />
      )}
      {detail !== null && detailNode !== null && (
        <DetailPopup x={detail.x} y={detail.y} node={detailNode} onClose={closeAll} />
      )}
    </div>
  );
}

export function FaultTreeEditor({ nodes, flavor = "logic" }: { nodes: FtInputNode[]; flavor?: FtFlavor }): JSX.Element {
  return (
    <ReactFlowProvider>
      <FaultTreeCanvas input={nodes} flavor={flavor} />
    </ReactFlowProvider>
  );
}
