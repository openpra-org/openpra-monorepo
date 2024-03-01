import EventSequenceAnalysisList from "../../components/lists/nestedLists/eventSequenceAnalysisList";
import {Route, Routes, useParams} from "react-router-dom";
import React, {useState, useEffect } from "react";
import * as d3 from 'd3';
// import { tree, hierarchy, HierarchyNode } from 'd3-hierarchy';
// import ReactFlow, {
//   ReactFlowProvider,
//   Panel,
//   useNodes,
//   useEdges,
//   Node as ReactFlowNode,
//   Edge as ReactFlowEdge,
// } from 'reactflow';

import 'reactflow/dist/style.css';

// Define the interfaces for Node and Edge
interface Node {
  id: string;
  type?: string;
  data: { label: string };
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  animated: boolean;
}

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'input' },
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    data: { label: 'node 2' },
    position: { x: 0, y: 100 },
  },
  {
    id: '2a',
    data: { label: 'node 2a' },
    position: { x: 0, y: 200 },
  },
  {
    id: '2b',
    data: { label: 'node 2b' },
    position: { x: 0, y: 300 },
  },
  {
    id: '2c',
    data: { label: 'node 2c' },
    position: { x: 0, y: 400 },
  },
  {
    id: '2d',
    data: { label: 'node 2d' },
    position: { x: 0, y: 500 },
  },
  {
    id: '3',
    data: { label: 'node 3' },
    position: { x: 200, y: 100 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e12', source: '1', target: '2', animated: true },
  { id: 'e13', source: '1', target: '3', animated: true },
  { id: 'e22a', source: '2', target: '2a', animated: true },
  { id: 'e22b', source: '2', target: '2b', animated: true },
  { id: 'e22c', source: '2', target: '2c', animated: true },
  { id: 'e2c2d', source: '2c', target: '2d', animated: true },
];

const data: any = {
  "name": "flare",
  "children": [
    {
      "name": "analytics",
      "children": [
        {
          "name": "cluster",
          "children": [
            {"name": "AgglomerativeCluster", "value": 3938},
            {"name": "CommunityStructure", "value": 3812},
            {"name": "HierarchicalCluster", "value": 6714},
            {"name": "MergeEdge", "value": 743}
          ]
        },
        {
          "name": "graph",
          "children": [
            {"name": "BetweennessCentrality", "value": 3534},
            {"name": "LinkDistance", "value": 5731},
            {"name": "MaxFlowMinCut", "value": 7840},
            {"name": "ShortestPaths", "value": 5914},
            {"name": "SpanningTree", "value": 3416}
          ]
        },
        {
          "name": "optimization",
          "children": [
            {"name": "AspectRatioBanker", "value": 7074}
          ]
        }
      ]
    },
    {
      "name": "animate",
      "children": [
        {"name": "Easing", "value": 17010},
        {"name": "FunctionSequence", "value": 5842},
        {
          "name": "interpolate",
          "children": [
            {"name": "ArrayInterpolator", "value": 1983},
            {"name": "ColorInterpolator", "value": 2047},
            {"name": "DateInterpolator", "value": 1375},
            {"name": "Interpolator", "value": 8746},
            {"name": "MatrixInterpolator", "value": 2202},
            {"name": "NumberInterpolator", "value": 1382},
            {"name": "ObjectInterpolator", "value": 1629},
            {"name": "PointInterpolator", "value": 1675},
            {"name": "RectangleInterpolator", "value": 2042}
          ]
        },
        {"name": "Schedulable", "value": 1041},
        {"name": "Parallel", "value": 5176},
        {"name": "Pause", "value": 449},
        {"name": "Scheduler", "value": 5593},
        {"name": "Sequence", "value": 5534},
        {"name": "Transition", "value": 9201},
        {"name": "Transitioner", "value": 19975},
        {"name": "TransitionEvent", "value": 1116},
        {"name": "Tween", "value": 6006}
      ]
    },
    {
      "name": "data",
      "children": [
        {
          "name": "converters",
          "children": [
            {"name": "Converters", "value": 721},
            {"name": "DelimitedTextConverter", "value": 4294},
            {"name": "GraphMLConverter", "value": 9800},
            {"name": "IDataConverter", "value": 1314},
            {"name": "JSONConverter", "value": 2220}
          ]
        },
        {"name": "DataField", "value": 1759},
        {"name": "DataSchema", "value": 2165},
        {"name": "DataSet", "value": 586},
        {"name": "DataSource", "value": 3331},
        {"name": "DataTable", "value": 772},
        {"name": "DataUtil", "value": 3322}
      ]
    },
    {
      "name": "display",
      "children": [
        {"name": "DirtySprite", "value": 8833},
        {"name": "LineSprite", "value": 1732},
        {"name": "RectSprite", "value": 3623},
        {"name": "TextSprite", "value": 10066}
      ]
    },
    {
      "name": "flex",
      "children": [
        {"name": "FlareVis", "value": 4116}
      ]
    },
    {
      "name": "physics",
      "children": [
        {"name": "DragForce", "value": 1082},
        {"name": "GravityForce", "value": 1336},
        {"name": "IForce", "value": 319},
        {"name": "NBodyForce", "value": 10498},
        {"name": "Particle", "value": 2822},
        {"name": "Simulation", "value": 9983},
        {"name": "Spring", "value": 2213},
        {"name": "SpringForce", "value": 1681}
      ]
    },
    {
      "name": "query",
      "children": [
        {"name": "AggregateExpression", "value": 1616},
        {"name": "And", "value": 1027},
        {"name": "Arithmetic", "value": 3891},
        {"name": "Average", "value": 891},
        {"name": "BinaryExpression", "value": 2893},
        {"name": "Comparison", "value": 5103},
        {"name": "CompositeExpression", "value": 3677},
        {"name": "Count", "value": 781},
        {"name": "DateUtil", "value": 4141},
        {"name": "Distinct", "value": 933},
        {"name": "Expression", "value": 5130},
        {"name": "ExpressionIterator", "value": 3617},
        {"name": "Fn", "value": 3240},
        {"name": "If", "value": 2732},
        {"name": "IsA", "value": 2039},
        {"name": "Literal", "value": 1214},
        {"name": "Match", "value": 3748},
        {"name": "Maximum", "value": 843},
        {
          "name": "methods",
          "children": [
            {"name": "add", "value": 593},
            {"name": "and", "value": 330},
            {"name": "average", "value": 287},
            {"name": "count", "value": 277},
            {"name": "distinct", "value": 292},
            {"name": "div", "value": 595},
            {"name": "eq", "value": 594},
            {"name": "fn", "value": 460},
            {"name": "gt", "value": 603},
            {"name": "gte", "value": 625},
            {"name": "iff", "value": 748},
            {"name": "isa", "value": 461},
            {"name": "lt", "value": 597},
            {"name": "lte", "value": 619},
            {"name": "max", "value": 283},
            {"name": "min", "value": 283},
            {"name": "mod", "value": 591},
            {"name": "mul", "value": 603},
            {"name": "neq", "value": 599},
            {"name": "not", "value": 386},
            {"name": "or", "value": 323},
            {"name": "orderby", "value": 307},
            {"name": "range", "value": 772},
            {"name": "select", "value": 296},
            {"name": "stddev", "value": 363},
            {"name": "sub", "value": 600},
            {"name": "sum", "value": 280},
            {"name": "update", "value": 307},
            {"name": "variance", "value": 335},
            {"name": "where", "value": 299},
            {"name": "xor", "value": 354},
            {"name": "_", "value": 264}
          ]
        },
        {"name": "Minimum", "value": 843},
        {"name": "Not", "value": 1554},
        {"name": "Or", "value": 970},
        {"name": "Query", "value": 13896},
        {"name": "Range", "value": 1594},
        {"name": "StringUtil", "value": 4130},
        {"name": "Sum", "value": 791},
        {"name": "Variable", "value": 1124},
        {"name": "Variance", "value": 1876},
        {"name": "Xor", "value": 1101}
      ]
    },
    {
      "name": "scale",
      "children": [
        {"name": "IScaleMap", "value": 2105},
        {"name": "LinearScale", "value": 1316},
        {"name": "LogScale", "value": 3151},
        {"name": "OrdinalScale", "value": 3770},
        {"name": "QuantileScale", "value": 2435},
        {"name": "QuantitativeScale", "value": 4839},
        {"name": "RootScale", "value": 1756},
        {"name": "Scale", "value": 4268},
        {"name": "ScaleType", "value": 1821},
        {"name": "TimeScale", "value": 5833}
      ]
    },
    {
      "name": "util",
      "children": [
        {"name": "Arrays", "value": 8258},
        {"name": "Colors", "value": 10001},
        {"name": "Dates", "value": 8217},
        {"name": "Displays", "value": 12555},
        {"name": "Filter", "value": 2324},
        {"name": "Geometry", "value": 10993},
        {
          "name": "heap",
          "children": [
            {"name": "FibonacciHeap", "value": 9354},
            {"name": "HeapNode", "value": 1233}
          ]
        },
        {"name": "IEvaluable", "value": 335},
        {"name": "IPredicate", "value": 383},
        {"name": "IValueProxy", "value": 874},
        {
          "name": "math",
          "children": [
            {"name": "DenseMatrix", "value": 3165},
            {"name": "IMatrix", "value": 2815},
            {"name": "SparseMatrix", "value": 3366}
          ]
        },
        {"name": "Maths", "value": 17705},
        {"name": "Orientation", "value": 1486},
        {
          "name": "palette",
          "children": [
            {"name": "ColorPalette", "value": 6367},
            {"name": "Palette", "value": 1229},
            {"name": "ShapePalette", "value": 2059},
            {"name": "SizePalette", "value": 2291}
          ]
        },
        {"name": "Property", "value": 5559},
        {"name": "Shapes", "value": 19118},
        {"name": "Sort", "value": 6887},
        {"name": "Stats", "value": 6557},
        {"name": "Strings", "value": 22026}
      ]
    },
    {
      "name": "vis",
      "children": [
        {
          "name": "axis",
          "children": [
            {"name": "Axes", "value": 1302},
            {"name": "Axis", "value": 24593},
            {"name": "AxisGridLine", "value": 652},
            {"name": "AxisLabel", "value": 636},
            {"name": "CartesianAxes", "value": 6703}
          ]
        },
        {
          "name": "controls",
          "children": [
            {"name": "AnchorControl", "value": 2138},
            {"name": "ClickControl", "value": 3824},
            {"name": "Control", "value": 1353},
            {"name": "ControlList", "value": 4665},
            {"name": "DragControl", "value": 2649},
            {"name": "ExpandControl", "value": 2832},
            {"name": "HoverControl", "value": 4896},
            {"name": "IControl", "value": 763},
            {"name": "PanZoomControl", "value": 5222},
            {"name": "SelectionControl", "value": 7862},
            {"name": "TooltipControl", "value": 8435}
          ]
        },
        {
          "name": "data",
          "children": [
            {"name": "Data", "value": 20544},
            {"name": "DataList", "value": 19788},
            {"name": "DataSprite", "value": 10349},
            {"name": "EdgeSprite", "value": 3301},
            {"name": "NodeSprite", "value": 19382},
            {
              "name": "render",
              "children": [
                {"name": "ArrowType", "value": 698},
                {"name": "EdgeRenderer", "value": 5569},
                {"name": "IRenderer", "value": 353},
                {"name": "ShapeRenderer", "value": 2247}
              ]
            },
            {"name": "ScaleBinding", "value": 11275},
            {"name": "Tree", "value": 7147},
            {"name": "TreeBuilder", "value": 9930}
          ]
        },
        {
          "name": "events",
          "children": [
            {"name": "DataEvent", "value": 2313},
            {"name": "SelectionEvent", "value": 1880},
            {"name": "TooltipEvent", "value": 1701},
            {"name": "VisualizationEvent", "value": 1117}
          ]
        },
        {
          "name": "legend",
          "children": [
            {"name": "Legend", "value": 20859},
            {"name": "LegendItem", "value": 4614},
            {"name": "LegendRange", "value": 10530}
          ]
        },
        {
          "name": "operator",
          "children": [
            {
              "name": "distortion",
              "children": [
                {"name": "BifocalDistortion", "value": 4461},
                {"name": "Distortion", "value": 6314},
                {"name": "FisheyeDistortion", "value": 3444}
              ]
            },
            {
              "name": "encoder",
              "children": [
                {"name": "ColorEncoder", "value": 3179},
                {"name": "Encoder", "value": 4060},
                {"name": "PropertyEncoder", "value": 4138},
                {"name": "ShapeEncoder", "value": 1690},
                {"name": "SizeEncoder", "value": 1830}
              ]
            },
            {
              "name": "filter",
              "children": [
                {"name": "FisheyeTreeFilter", "value": 5219},
                {"name": "GraphDistanceFilter", "value": 3165},
                {"name": "VisibilityFilter", "value": 3509}
              ]
            },
            {"name": "IOperator", "value": 1286},
            {
              "name": "label",
              "children": [
                {"name": "Labeler", "value": 9956},
                {"name": "RadialLabeler", "value": 3899},
                {"name": "StackedAreaLabeler", "value": 3202}
              ]
            },
            {
              "name": "layout",
              "children": [
                {"name": "AxisLayout", "value": 6725},
                {"name": "BundledEdgeRouter", "value": 3727},
                {"name": "CircleLayout", "value": 9317},
                {"name": "CirclePackingLayout", "value": 12003},
                {"name": "DendrogramLayout", "value": 4853},
                {"name": "ForceDirectedLayout", "value": 8411},
                {"name": "IcicleTreeLayout", "value": 4864},
                {"name": "IndentedTreeLayout", "value": 3174},
                {"name": "Layout", "value": 7881},
                {"name": "NodeLinkTreeLayout", "value": 12870},
                {"name": "PieLayout", "value": 2728},
                {"name": "RadialTreeLayout", "value": 12348},
                {"name": "RandomLayout", "value": 870},
                {"name": "StackedAreaLayout", "value": 9121},
                {"name": "TreeMapLayout", "value": 9191}
              ]
            },
            {"name": "Operator", "value": 2490},
            {"name": "OperatorList", "value": 5248},
            {"name": "OperatorSequence", "value": 4190},
            {"name": "OperatorSwitch", "value": 2581},
            {"name": "SortOperator", "value": 2023}
          ]
        },
        {"name": "Visualization", "value": 16540}
      ]
    }
  ]
}
//
// // Function to generate ReactFlow elements from initialNodes and initialEdges
// const generateReactFlowElements = (): { nodes: ReactFlowNode[]; edges: ReactFlowEdge[] } => {
//   // Convert initialNodes and initialEdges into a hierarchical structure
//   const hierarchyData = {
//     id: 'root',
//     data: { label: 'root' }, // Add a label for the root node
//     position: { x: 0, y: 0 }, // Set the position for the root node
//     children: initialNodes.map((node) => ({
//       id: node.id,
//       data: { label: node.data.label }, // Set label data for each node
//       position: { x: node.position.x, y: node.position.y }, // Set position for each node
//       children: initialEdges
//         .filter((edge) => edge.source === node.id)
//         .map((edge) => ({
//           id: edge.id,
//           data: { label: `edge ${edge.id}` }, // Set label data for each edge (optional)
//           source: edge.source,
//           target: edge.target,
//           animated: edge.animated,
//         })),
//     })),
//   };
//
//   // Create the tree layout
//   const treeLayout = tree<Node>().nodeSize([300, 300]);
//
//   // Apply the tree layout to the hierarchy data
//   const rootNode = hierarchy<Node>(hierarchyData);
//   const treeNodes: HierarchyNode<Node>[] = treeLayout(rootNode).descendants();
//
//   // Convert tree nodes and edges to ReactFlow elements
//   const nodes: ReactFlowNode[] = treeNodes.map((node) => ({
//     id: node.data.id,
//     data: { label: node.data.data.label },
//     position: {
//       x: node.data.position ? node.data.position.x : 0,
//       y: node.data.position ? node.data.position.y : 0
//     },
//     type: node.data.type || 'default',
//   }));
//
//
//   const edges: ReactFlowEdge[] = initialEdges.map((edge) => ({
//     id: edge.id,
//     source: edge.source,
//     target: edge.target,
//     animated: edge.animated,
//   }));
//
//   return { nodes, edges };
// };
//
// const FlowChart = () => {
//   const { nodes, edges } = generateReactFlowElements();
//   return (
//     <div style={{ height: '100vh', width: '100%' }}>
//       <ReactFlowProvider>
//         <ReactFlow
//           defaultNodes={nodes}
//           defaultEdges={edges}
//           style={{ height: '100%', width: '100%' }}
//
//         >
//         </ReactFlow>
//       </ReactFlowProvider>
//     </div>
//   );
// };

const RadialTree: React.FC = () => {
  const [svgContent, setSvgContent] = useState<JSX.Element | null>(null);

  useEffect(() => {
    // set the dimensions and margins of the graph
    const width = 900;
    const height = 900;
    const margin = { top: 550, right: 30, bottom: 30, left: 600 };
    const radius = width / 2; // radius of the dendrogram

    // Create the cluster layout:
    const cluster = d3.cluster()
      .size([360, radius - 60]);  // 360 means whole circle. radius - 60 means 60 px of margin around dendrogram

    // Give the data to this cluster layout:
    const root = d3.hierarchy(data, (d: any) => d.children);
    cluster(root);

    // Features of the links between nodes:
    const linksGenerator = d3.linkRadial()
      .angle((d: any) => (d.x / 180) * Math.PI)
      .radius((d: any) => d.y);

    // Add the links between nodes using JSX
    const links = root.links().map((link: any, index: number) => {
      const path = linksGenerator(link);
      // Check if path is not null before using it
      if (path !== null) {
        return (
          <path
            key={index}
            d={path}
            fill="none"
            stroke="#ccc"
          />
        );
      } else {
        // Return null if path is null
        return null;
      }
    });

    // Add a circle for each node.
    // Add a circle for each outside node.
    const circles = root.descendants().filter((d: any) => !d.children);

    // Set the SVG content
    setSvgContent(
      <svg width={width + margin.left + margin.right}
           height={height + margin.top + margin.bottom}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {links}
          {circles.map((node: any, index: number) => (
            <g
              key={index}
              transform={`rotate(${node.x - 90})translate(${node.y})`}
            >
              {node.children ? (
                <circle
                  r={7}
                  fill="#69b3a2"
                  stroke="black"
                  strokeWidth={2}
                />
              ) : (
                <>
                  <circle
                    r={7}
                    fill="#69b3a2"
                    stroke="black"
                    strokeWidth={2}
                  />
                  <text
                    x={node.children ? -8 : 8}
                    dy=".35em"
                    fill="white"
                    fontSize={9}
                    textAnchor={node.children ? "end" : "start"}
                  >
                    {node.data.name}
                  </text>
                </>
              )}
            </g>
          ))}
        </g>
      </svg>
    );
  }, []);
  return svgContent;
};

export function EventSequenceAnalysisEditor() {
  // const [nodes, setNodes] = useState<Node[]>(initialNodes);
  // const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const { EventSequenceAnalysisId } = useParams();
  console.log(EventSequenceAnalysisId);
  return (
    <RadialTree />
  );
}

export default function EventSequenceAnalysis() {
  return (
    <Routes>
      <Route path="" element={<EventSequenceAnalysisList />} />
      <Route path=":EventSequenceAnalysisId" element={<EventSequenceAnalysisEditor />} />
    </Routes>
  );
}
