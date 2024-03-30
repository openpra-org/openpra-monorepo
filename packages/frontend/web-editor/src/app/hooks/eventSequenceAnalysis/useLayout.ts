import { useEffect } from "react";
import {
  useReactFlow,
  useStore,
  Node,
  Edge,
  ReactFlowState,
  Position,
} from "reactflow";
import { stratify, cluster } from "d3-hierarchy";
import { timer } from "d3-timer";
import * as d3 from "d3";

// initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
const layout = cluster<Node>()
  // the node size to configure spacing between the nodes
  .nodeSize([100,100])
  // this is needed for creating equal space between all nodes
  .separation(() => 1);

// this is the store selector that is used for triggering the layout, this returns the number of nodes once they change
const nodeCountSelector = (state: ReactFlowState): number =>
  state.nodeInternals.size;

const options = { duration: 200 };

/**
 * Hook for applying a radial cluster layout to nodes in a React Flow diagram.
 *
 * This hook utilizes the D3 library for cluster layout and React Flow for managing nodes and edges in a flowchart-like UI.
 * It triggers a layout re-calculation whenever the number of nodes changes and animates the nodes to their new positions.
 *
 * @remarks
 * This hook is designed to work with D3's cluster layout and is used for hierarchical tree-like structures.
 * It also includes animation logic to smoothly transition nodes to their new positions.
 * The hook ensures horizontal layout of the nodes
 */
function useLayout(): void {
  // we are using nodeCount as the trigger for the re-layouting
  // whenever the nodes length changes, we calculate the new layout
  const nodeCount = useStore(nodeCountSelector);

  const { getNodes, getNode, setNodes, setEdges, getEdges, fitView } =
    useReactFlow();

  useEffect(() => {
    if (!nodeCount) return;

    // get the current nodes and edges
    const nodes: Node[] = getNodes();
    const edges: Edge[] = getEdges();

    // convert nodes and edges into a hierarchical object for using it with the layout function
    const hierarchy = stratify<Node>()
      .id((d) => d.id)
      // get the id of each node by searching through the edges
      // this only works if every node has one connection
      .parentId(
        (d: Node) => edges.find((e: Edge) => e.target === d.id)?.source,
      )(nodes);

    // the size of [360, radius] corresponds to a breadth of 360° and a depth of radius to create a radial layout
    layout.size([360, 300]);

    // run the layout algorithm with the hierarchy data structure
    const root = layout(hierarchy);
    const newNodes: Node[] = root.descendants().map((node: any, index: number) => ({
      id: node.id,
      data: { label: node.data.name },
      position: { x: (node.x / 180) * Math.PI, y: node.y },
    }));
    // Set the elements state
    setNodes([...newNodes]);
    setEdges([...edges]);

  }, [nodeCount, getEdges, getNodes, getNode, setNodes, fitView, setEdges]);
}

export default useLayout;
