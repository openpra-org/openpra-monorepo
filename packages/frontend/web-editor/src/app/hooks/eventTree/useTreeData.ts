import { Edge, Node } from "reactflow";
import { GenerateUUID } from "../../../utils/treeUtils";
import { useEventTreeStore } from "./useEventTreeStore";
export const getInitials = (str: string): string => {
  return str
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};
export const createEndStates = (
  leafNode: Node,
  nodeWidth: number,
  pos: {
    x: number;
    y: number;
  },
): {
  nodes: Node[];
  edges: Edge[];
} => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const sequenceIdNode = GenerateUUID();
  nodes.push({
    id: sequenceIdNode,
    type: "outputNode",
    data: { label: sequenceIdNode, width: nodeWidth, isSequenceId: true },
    position: pos,
  });
  edges.push({
    id: `${leafNode.id}-${sequenceIdNode}`,
    source: leafNode.id,
    target: sequenceIdNode,
    type: "custom",
    animated: false,
  });
  const releaseCategoryNode = GenerateUUID();
  nodes.push({
    id: releaseCategoryNode,
    type: "outputNode",
    data: { label: `Category A`, width: nodeWidth },
    position: pos,
  });
  edges.push({
    id: `${sequenceIdNode}-${releaseCategoryNode}`,
    source: sequenceIdNode,
    target: releaseCategoryNode,
    type: "custom",
    animated: false,
    data: {
      hidden: true,
    },
  });
  return { nodes, edges };
};
const useTreeData = (
  inputLevels: number,
  outputLevels: number,
  nodeWidth: number,
): {
  nodes: Node[];
  edges: Edge[];
} => {
  const { firstColumnLabel, setFirstColumnLabel } = useEventTreeStore.getState();
  if (!firstColumnLabel) {
    setFirstColumnLabel("Initiating Event");
  }
  const pos = { x: 0, y: 0 };
  const verticalLevels = inputLevels + outputLevels;
  const generateTreeNodesAndEdges = (): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const rootId = GenerateUUID();
    const rootNode: Node = {
      id: rootId,
      type: "visibleNode",
      data: {
        label: getInitials(firstColumnLabel),
        inputDepth: inputLevels,
        outputDepth: outputLevels,
        width: nodeWidth,
        depth: 1,
        index: 1,
      },
      position: pos,
    };
    nodes.push(rootNode);
    let prevNodes = [rootNode];
    let currentNodes: Node[] = [];
    for (let depth = 2; depth <= inputLevels; depth++) {
      currentNodes = [];
      for (const parent of prevNodes) {
        const leftChildId = GenerateUUID();
        const leftChildNode: Node = {
          id: leftChildId,
          type: "visibleNode",
          data: {
            depth: depth,
            width: nodeWidth,
            output: false,
          },
          position: pos,
        };
        nodes.push(leftChildNode);
        currentNodes.push(leftChildNode);
        const rightChildId = GenerateUUID();
        const rightChildNode: Node = {
          id: rightChildId,
          type: "visibleNode",
          data: {
            depth: depth,
            width: nodeWidth,
            output: false,
          },
          position: pos,
        };
        nodes.push(rightChildNode);
        currentNodes.push(rightChildNode);
        const edgeLeft: Edge = {
          id: `${parent.id}-${leftChildId}`,
          source: parent.id,
          target: leftChildId,
          type: "custom",
          animated: false,
          data: { branchState: "bypass" },
        };
        const edgeRight: Edge = {
          id: `${parent.id}-${rightChildId}`,
          source: parent.id,
          target: rightChildId,
          type: "custom",
          animated: false,
          data: { branchState: "bypass" },
        };
        edges.push(edgeLeft);
        edges.push(edgeRight);
      }
      prevNodes = currentNodes;
    }
    prevNodes.forEach((leafNode) => {
      const { nodes: endNodes, edges: endEdges } = createEndStates(leafNode, nodeWidth, {
        x: leafNode.position.x,
        y: leafNode.position.y,
      });
      nodes.push(...endNodes);
      edges.push(...endEdges);
    });
    return { nodes, edges };
  };
  const generateColNodesAndEdges = (): {
    nodes: Node[];
    edges: Edge[];
  } => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const firstColumnLabel = "Initiating Event";
    setFirstColumnLabel(firstColumnLabel);
    const rootColNode = GenerateUUID();
    const node: Node = {
      id: rootColNode,
      type: "columnNode",
      data: {
        label: firstColumnLabel,
        probability: 1.0,
        width: nodeWidth,
        depth: 1,
        output: false,
        allowAdd: false,
      },
      position: pos,
    };
    nodes.push(node);
    let prevNode = rootColNode;
    for (let column = 2; column <= verticalLevels; column++) {
      if (column === inputLevels + 1) {
        const actionsNodeId = GenerateUUID();
        const actionsNode: Node = {
          id: actionsNodeId,
          type: "columnActionsNode",
          data: { width: nodeWidth, label: "" },
          position: pos,
        };
        nodes.push(actionsNode);
        edges.push({
          id: `${prevNode}--${actionsNodeId}`,
          source: prevNode,
          target: actionsNodeId,
          type: "custom",
          animated: false,
          data: { hidden: true },
        });
        prevNode = actionsNodeId;
      }
      const nodeId = GenerateUUID();
      let nodeLabel = "";
      if (column <= inputLevels) {
        nodeLabel = `Functional Event`;
      } else {
        if (column === verticalLevels - 1) {
          nodeLabel = `Sequence ID`;
        } else if (column === verticalLevels) {
          nodeLabel = `Release Category`;
        }
      }
      const colNode: Node = {
        id: nodeId,
        type: "columnNode",
        data: {
          label: nodeLabel,
          width: nodeWidth,
          depth: column,
          output: column > inputLevels,
          allowAdd: column <= inputLevels,
          allowDelete: column <= inputLevels && column !== 1,
        },
        position: pos,
      };
      nodes.push(colNode);
      const edge: Edge = {
        id: `${prevNode}--${nodeId}`,
        source: prevNode,
        target: nodeId,
        type: "custom",
        animated: false,
        data: {
          hidden: true,
        },
      };
      edges.push(edge);
      prevNode = nodeId;
    }
    return { nodes, edges };
  };
  const { nodes: generatedTreeNodes, edges: treeEdges } = generateTreeNodesAndEdges();
  const { nodes: generatedColNodes, edges: colEdges } = generateColNodesAndEdges();
  const depthToColId: Record<number, string> = {};
  generatedColNodes.forEach((col) => {
    const d = (col.data as Record<string, unknown>).depth as number | undefined;
    const allowAdd = (col.data as Record<string, unknown>).allowAdd as boolean | undefined;
    const output = (col.data as Record<string, unknown>).output as boolean | undefined;
    if (d && allowAdd && !output) depthToColId[d] = col.id;
  });
  const nodeDepthMap: Record<string, number> = {};
  generatedTreeNodes.forEach((n) => {
    const d = (n.data as Record<string, unknown>).depth as number | undefined;
    if (d) nodeDepthMap[n.id] = d;
  });
  const patchedTreeEdges = treeEdges.map((edge) => {
    const targetDepth = nodeDepthMap[edge.target];
    const feId = targetDepth ? depthToColId[targetDepth] : undefined;
    if (!feId) return edge;
    return { ...edge, data: { ...(edge.data as object), feId } };
  });
  const nodes = [...generatedTreeNodes, ...generatedColNodes];
  const edges = [...patchedTreeEdges, ...colEdges];
  return { nodes, edges };
};
export { useTreeData };
