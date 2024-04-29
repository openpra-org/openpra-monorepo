import { useCallback, useEffect, useRef } from "react";
import { useReactFlow, useStore, Node, Edge, ReactFlowState } from "reactflow";
import { cluster, partition, stratify, tree } from "d3-hierarchy";
import { timer } from "d3-timer";

// initialize the tree layout (see https://observablehq.com/@d3/tree for examples)
const layout = cluster<Node>()
  // the node size configures the spacing between the nodes ([width, height])
  .nodeSize([140, 40]) // this is needed for creating equal space between all nodes

  .separation(() => 0.6);

const options = { duration: 300 };

// the layouting function
// accepts current nodes and edges and returns the layouted nodes with their updated positions
function layoutNodes(nodes: Node[], cols: Node[], edges: Edge[]): Node[] {
  // if there are no nodes we can't calculate a layout
  if (nodes.length === 0) {
    return [];
  }

  // convert nodes and edges into a hierarchical object for using it with the layout function
  const hierarchy = stratify<Node>()
    .id((d) => d.id)
    // get the id of each node by searching through the edges
    // this only works if every node has one connection
    .parentId((d: Node) => edges.find((e: Edge) => e.target === d.id)?.source)(
    nodes,
  );

  // run the layout algorithm with the hierarchy data structure
  const root = layout(hierarchy);

  // convert the hierarchy back to react flow nodes (the original node is stored as d.data)
  // we only extract the position from the d3 function
  nodes = root.descendants().map((d) => ({
    ...d.data,
    position: {
      x: d.y,
      y: d.x,
    },
  }));

  // Find the maximum value of y from the leaf nodes
  const maxYLeaf = Math.min(...root.leaves().map((d) => d.x));

  // Iterate over each column node and update its position
  cols.forEach((col, index) => {
    // Calculate the x position based on the column number and column width
    const xPosition = index * col.data.width; // Assuming colWidth is defined somewhere

    // Update the position of the column node

    col.position = {
      x: xPosition,
      y: maxYLeaf - 75 - (col.data.height ? col.data.height : 0),
    };
  });

  // Update the x position of the tree nodes with the same number as the column nodes
  nodes.forEach((node) => {
    const correspondingColNode = cols.find(
      (col) => col.data.depth === node.data.depth,
    );
    if (correspondingColNode) {
      node.position.x = correspondingColNode.position.x;
    }
  });

  return [...nodes, ...cols];
}

// this is the store selector that is used for triggering the layout, this returns the number of nodes once they change
const nodeCountSelector = (state: ReactFlowState) => state.nodeInternals.size;

function useLayout(depth: number) {
  // this ref is used to fit the nodes in the first run
  // after first run, this is set to false
  const initial = useRef(true);

  // we are using nodeCount as the trigger for the re-layouting
  // whenever the nodes length changes, we calculate the new layout
  const nodeCount = useStore(nodeCountSelector);

  const { getNodes, getNode, setNodes, setEdges, getEdges, fitView } =
    useReactFlow();

  function onNodeDataChange(nodeId: string, newData: any) {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId ? { ...node, data: newData } : node,
      ),
    );
  }

  function onAllColumnHeightChange(
    newHeight: number,
    isIncreaseHeight: boolean,
  ) {
    setNodes((nds) =>
      nds.map((node) =>
        node.type === "columnNode"
          ? {
              ...node,
              position: {
                ...node.position,
                y: isIncreaseHeight
                  ? node.position.y - 14
                  : node.position.y + 14,
              },
              data: { ...node.data, height: newHeight },
            }
          : node,
      ),
    );
  }

  useEffect(() => {
    // get the current nodes and edges
    const nodeData = getNodes();
    const edges = getEdges();

    // splitting the nodeData into nodes and columns
    const nodes: Node[] = [];
    const cols: Node[] = [];
    console.log(nodeData, edges);
    nodeData.forEach((node) => {
      if (node.type === "columnNode") {
        cols.push(node);
      } else {
        nodes.push(node);
      }
    });

    // run the layout and get back the nodes with their updated positions
    let targetNodes = layoutNodes(nodes, cols, edges);
    targetNodes = targetNodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onNodeDataChange: onNodeDataChange,
        onAllColumnHeightChange: onAllColumnHeightChange,
      },
    }));

    // if you do not want to animate the nodes, you can uncomment the following line
    // return setNodes(targetNodes);

    // to interpolate and animate the new positions, we create objects that contain the current and target position of each node
    const transitions = targetNodes.map((node) => ({
      id: node.id,
      // this is where the node currently is placed
      from: getNode(node.id)?.position || node.position,
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
        data: { ...node.data },
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
          data: { ...node.data },
          type: node.type,
        }));

        setNodes(finalNodes);

        // stop the animation
        t.stop();

        // in the first run, fit the view
        if (!initial.current) {
          fitView({ duration: 200, padding: 0.2 });
        }
        initial.current = false;
      }
    });
    return () => {
      t.stop();
    };
  }, [nodeCount, getEdges, getNodes, getNode, setNodes, fitView, setEdges]);
}

export default useLayout;
