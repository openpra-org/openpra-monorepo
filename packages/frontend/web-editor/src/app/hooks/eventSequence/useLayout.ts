import { useEffect } from "react";
import {
  useReactFlow,
  useStore,
  Node,
  Edge,
  ReactFlowState,
  Position,
} from "reactflow";
import { stratify, tree } from "d3-hierarchy";
import { timer } from "d3-timer";

// initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
const layout = tree<Node>()
  // the node size configures the spacing between the nodes ([width, height])
  .nodeSize([100, 150])
  // this is needed for creating equal space between all nodes
  .separation(() => 1);

// this is the store selector that is used for triggering the layout, this returns the number of nodes once they change
const nodeCountSelector = (state: ReactFlowState): number =>
  state.nodeInternals.size;

const options = { duration: 200 };

/**
 * Hook for applying a hierarchical tree layout to nodes in a React Flow diagram.
 *
 * This hook utilizes the D3 library for tree layout and React Flow for managing nodes and edges in a flowchart-like UI.
 * It triggers a layout re-calculation whenever the number of nodes changes and animates the nodes to their new positions.
 *
 * @remarks
 * This hook is designed to work with D3's tree layout and is used for hierarchical tree-like structures.
 * It also includes animation logic to smoothly transition nodes to their new positions.
 * The hook ensures horizontal layout of the nodes
 */
function UseLayout(): void {
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

    // run the layout algorithm with the hierarchy data structure
    const root = layout(hierarchy);

    const targetNodes = nodes.map((node) => {
      const { x, y } = root.find((d) => d.id === node.id) ?? {
        x: node.position.x,
        y: node.position.y,
      };

      return {
        ...node,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        position: { x: y, y: x },
        style: { opacity: 1 },
      };
    });
    const transitions = targetNodes.map((node) => ({
      id: node.id,
      // this is where the node currently is placed
      from: getNode(node.id)?.position ?? node.position,
      // this is where we want the node to be placed
      to: node.position,
      node,
    }));

    // create a timer to animate the nodes to their new positions
    const t = timer((elapsed: number) => {
      const s = elapsed / options.duration;

      const currNodes = transitions.map(({ node, from, to }) => ({
        id: node.id,
        position: {
          // simple linear interpolation
          x: from.x + (to.x - from.x) * s,
          y: from.y + (to.y - from.y) * s,
        },
        data: { ...(node.data as object) },
        type: node.type,
      }));

      setNodes(currNodes);

      // this is the final step of the animation
      if (elapsed > options.duration) {
        // we are moving the nodes to their destination
        // this needs to happen to avoid glitches
        const finalNodes = transitions.map(({ node, to }) => ({
          id: node.id,
          position: {
            x: to.x,
            y: to.y,
          },
          data: { ...(node.data as object) },
          type: node.type,
        }));

        setNodes(finalNodes);
        setEdges((edges) =>
          edges.map((edge) => ({ ...edge, style: { opacity: 1 } })),
        );

        // stop the animation
        t.stop();

        fitView({ duration: 200, padding: 0.2 });
      }
    });
  }, [nodeCount, getEdges, getNodes, getNode, setNodes, fitView, setEdges]);
}

export { UseLayout };
