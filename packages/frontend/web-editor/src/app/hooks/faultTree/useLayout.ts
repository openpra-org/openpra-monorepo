import { useEffect, useRef } from "react";
import { useReactFlow, useStore, Node, Edge, ReactFlowState } from "reactflow";
import { stratify, tree } from "d3-hierarchy";
import { timer } from "d3-timer";
import { FAULT_TREE_NODE_HEIGHT, FAULT_TREE_NODE_SEPARATION, FAULT_TREE_NODE_WIDTH } from "../../../utils/constants";
import { useStore as useFaultTreeStore } from "../../store/faultTreeStore";

// initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
const layout = tree<Node>()
  // the node size configures the spacing between the nodes ([width, height])
  .nodeSize([FAULT_TREE_NODE_WIDTH, FAULT_TREE_NODE_HEIGHT])
  // this is needed for creating equal space between all nodes
  .separation(() => FAULT_TREE_NODE_SEPARATION);

const options = { duration: 300 };

// the layouting function
// accepts current nodes and edges and returns the layouted nodes with their updated positions
function layoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  // if there are no nodes we can't calculate a layout
  if (nodes.length === 0) {
    return [];
  }
  // convert nodes and edges into a hierarchical object for using it with the layout function
  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    // this only works if every node has one connection
    .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(nodes);

  // run the layout algorithm with the hierarchy data structure
  const root = layout(hierarchy);

  // convert the hierarchy back to react flow nodes (the original node is stored as d.data)
  // we only extract the position from the d3 function
  return root.descendants().map((d) => ({ ...d.data, position: { x: d.x, y: d.y } }));
}

// this is the store selector that is used for triggering the layout, this returns the number of nodes once they change
const nodeCountSelector = (state: ReactFlowState): number => state.nodeInternals.size;

/**
 * Hook for applying a hierarchical tree layout to nodes in a React Flow diagram.
 *
 * This hook utilizes the D3 library for tree layout and React Flow for managing nodes and edges in a flowchart-like UI
 * It triggers a layout re-calculation whenever the number of nodes changes and animates the nodes to their new positions.
 *
 * @remarks
 * This hook is designed to work with D3's tree layout and is used for hierarchical tree-like structures.
 * It also includes animation logic to smoothly transition nodes to their new positions.
 * The hook ensures horizontal layout of the nodes
 */
function UseLayout(enabled: boolean = true): void {
  // this ref is used to fit the nodes in the first run
  // after first run, this is set to false
  const initial = useRef(true);

  // we are using nodeCount as the trigger for the re-layouting
  // whenever the nodes length changes, we calculate the new layout
  const nodeCount = useStore(nodeCountSelector);

  const { getNodes, getNode, setNodes, getEdges, fitView } = useReactFlow();
  const { focusNodeId, resetFocusNodeId } = useFaultTreeStore();

  useEffect(() => {
    if (!enabled) return;
    // get the current nodes and edges
    const nodes = getNodes();
    const edges = getEdges();

    // run the layout and get back the nodes with their updated positions
    const targetNodes = layoutNodes(nodes, edges);

    // if you do not want to animate the nodes, you can uncomment the following line
    // return setNodes(targetNodes);

    // to interpolate and animate the new positions, we create objects that contain the current and target position of each node
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

        // stop the animation
        t.stop();

        if (focusNodeId !== undefined) {
          fitView({
            nodes: [{ id: focusNodeId }],
            duration: 500,
            maxZoom: 1.6,
          });
          resetFocusNodeId();
        }

        initial.current = false;
      }
    });

    return (): void => {
      t.stop();
    };
  }, [enabled, nodeCount, focusNodeId, resetFocusNodeId]);
}

export { UseLayout };
