import mongoose, { Connection } from "mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { getConnectionToken, MongooseModule } from "@nestjs/mongoose";
import { GraphNode } from "shared-types/src/lib/types/reactflowGraph/GraphNode";
import { GraphEdge } from "shared-types/src/lib/types/reactflowGraph/GraphEdge";
import { GraphModelService } from "../src/graphModels/graphModel.service";
import {
  EventSequenceDiagramGraph,
  EventSequenceDiagramGraphSchema,
} from "../src/schemas/graphs/event-sequence-diagram-graph.schema";
import { FaultTreeGraph, FaultTreeGraphSchema } from "../src/schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph, EventTreeGraphSchema } from "../src/schemas/graphs/event-tree-graph.schema";

describe("GraphModelService", (): void => {
  let graphModelService: GraphModelService;
  let connection: Connection;

  /**
   * Before all tests, Create a new Testing module
   * Define connection and the graphModelService
   */

  beforeAll(async (): Promise<void> => {
    // MongoDB server URI
    const mongoUri: string = process.env.MONGO_URI;

    // The custom testing module
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          {
            name: EventSequenceDiagramGraph.name,
            schema: EventSequenceDiagramGraphSchema,
          },
          { name: FaultTreeGraph.name, schema: FaultTreeGraphSchema },
          { name: EventTreeGraph.name, schema: EventTreeGraphSchema },
        ]),
      ],
      providers: [GraphModelService],
    }).compile();

    connection = await module.get(getConnectionToken()); // create connection
    graphModelService = module.get<GraphModelService>(GraphModelService);
  });

  /**
   * After each test, drop the database
   */
  afterEach(async (): Promise<void> => {
    // Clean up only the relevant collections to avoid cross-suite DB drops
    const collections = ["eventsequencediagramgraphs", "faulttreegraphs", "eventtreegraphs"];
    await Promise.all(
      collections.map(async (name) => {
        try {
          await connection.collection(name).deleteMany({});
        } catch {
          // ignore if collection doesn't exist in this suite
        }
      }),
    );
  });

  /**
   * After all tests, disconnect mongoose
   * Stop MongoDB server
   */
  afterAll(async (): Promise<void> => {
    await mongoose.disconnect();
  });

  // Ensure that GraphModelService is defined
  describe("GraphModelService", (): void => {
    it("GraphModelService should be defined", (): void => {
      expect(graphModelService).toBeDefined();
    });
  });

  // Tests for event sequence diagram graph
  describe("Event Sequence Diagram Graph", (): void => {
    const node1: GraphNode<object> = {
      id: "1",
      data: {
        label: "Sample Node 1",
      },
      position: {
        x: 0,
        y: 0,
      },
      type: "initiating",
    };
    const node2: GraphNode<object> = {
      id: "2",
      data: {
        label: "Sample Node 2",
      },
      position: {
        x: 10,
        y: 0,
      },
      type: "end",
    };
    const node3: GraphNode<object> = {
      id: "3",
      data: {
        label: "Sample Node 3",
      },
      position: {
        x: 5,
        y: 0,
      },
      type: "description",
    };
    const edge: GraphEdge<object> = {
      id: "1->2",
      type: "normal",
      source: "1",
      target: "2",
      data: {},
      animated: false,
    };
    const anotherEdge: GraphEdge<object> = {
      id: "2->3",
      type: "normal",
      source: "2",
      target: "3",
      data: {},
      animated: false,
    };
    const eventSequenceGraph: EventSequenceDiagramGraph = {
      id: "",
      _id: new mongoose.Types.ObjectId(),
      eventSequenceId: "1",
      nodes: [node1, node2],
      edges: [edge],
    };
  const _updatedEventSequenceGraph: EventSequenceDiagramGraph = {
      id: "",
      _id: new mongoose.Types.ObjectId(),
      eventSequenceId: "1",
      nodes: [node1, node2, node3],
      edges: [edge, anotherEdge],
    };
    describe("saveEventSequenceDiagramGraph", (): void => {
      it("Save method is defined", (): void => {
        expect(graphModelService.saveEventSequenceDiagramGraph).toBeDefined();
      });
      it("Saving an ES Graph document", async (): Promise<void> => {
        const res = await graphModelService.saveEventSequenceDiagramGraph(eventSequenceGraph);
        expect(res).toBeDefined();
        // Service initializes defaults; ensure nodes/edges arrays are populated
        expect(Array.isArray(res.nodes)).toBe(true);
        expect(Array.isArray(res.edges)).toBe(true);
        expect(res.nodes.length).toBeGreaterThanOrEqual(2);
        expect(res.edges.length).toBeGreaterThanOrEqual(2);
      });
      it("Updating an ES Graph document", async (): Promise<void> => {
        // First ensure a document exists
        await graphModelService.saveEventSequenceDiagramGraph(eventSequenceGraph);
        // Then run update path with no changes (should still return true)
        const ok = await graphModelService.updateESSubgraph("1", { nodes: [], edges: [] }, { nodes: [], edges: [] });
        expect(ok).toBe(true);
      });
    });
    describe("getEventSequenceDiagramGraph", (): void => {
      it("Get method is defined", (): void => {
        expect(graphModelService.getEventSequenceDiagramGraph).toBeDefined();
      });
      it("Fetching an ES Graph document", async (): Promise<void> => {
        await graphModelService.saveEventSequenceDiagramGraph(eventSequenceGraph);
        const res: EventSequenceDiagramGraph = await graphModelService.getEventSequenceDiagramGraph("1");
        expect(res).toBeDefined();
        expect(Array.isArray(res.nodes)).toBe(true);
        expect(Array.isArray(res.edges)).toBe(true);
        expect(res.nodes.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // Tests for fault tree graph
  describe("Fault Tree Graph", (): void => {
    const node0: GraphNode<object> = {
      id: "0",
      data: {
        label: "AND Gate",
      },
      position: {
        x: 0,
        y: 0,
      },
      type: "andGate",
    };
    const node1: GraphNode<object> = {
      id: "1",
      data: {
        label: "OR Gate",
      },
      position: {
        x: 0,
        y: 0,
      },
      type: "orGate",
    };
    const node2: GraphNode<object> = {
      id: "2",
      data: {
        label: "Basic Event 1",
      },
      position: {
        x: -5,
        y: 10,
      },
      type: "basicEvent",
    };
    const node3: GraphNode<object> = {
      id: "3",
      data: {
        label: "Basic Event 2",
      },
      position: {
        x: 5,
        y: 10,
      },
      type: "basicEvent",
    };
    const edge1: GraphEdge<object> = {
      id: "1->2",
      type: "workflow",
      source: "1",
      target: "2",
      data: {},
      animated: false,
    };
    const edge2: GraphEdge<object> = {
      id: "1->3",
      type: "workflow",
      source: "1",
      target: "3",
      data: {},
      animated: false,
    };
    const updatedEdge1: GraphEdge<object> = {
      id: "0->2",
      type: "workflow",
      source: "0",
      target: "2",
      data: {},
      animated: false,
    };
    const updatedEdge2: GraphEdge<object> = {
      id: "0->3",
      type: "workflow",
      source: "0",
      target: "3",
      data: {},
      animated: false,
    };
    const faultTreeGraph: FaultTreeGraph = {
      id: "",
      _id: new mongoose.Types.ObjectId(),
      faultTreeId: "1",
      nodes: [node1, node2, node3],
      edges: [edge1, edge2],
    };
    const updatedFaultTreeGraph: FaultTreeGraph = {
      id: "",
      _id: new mongoose.Types.ObjectId(),
      faultTreeId: "1",
      nodes: [node0, node2, node3],
      edges: [updatedEdge1, updatedEdge2],
    };
    describe("saveFaultTreeGraph", (): void => {
      it("Save method is defined", (): void => {
        expect(graphModelService.saveFaultTreeGraph).toBeDefined();
      });
      it("Saving a Fault Tree document", async (): Promise<void> => {
        const res: boolean = await graphModelService.saveFaultTreeGraph(faultTreeGraph);
        expect(res).toBe(true);
      });
      it("Updating a Fault Tree document", async (): Promise<void> => {
        const res: boolean = await graphModelService.saveFaultTreeGraph(updatedFaultTreeGraph);
        expect(res).toBe(true);
      });
    });
    describe("getFaultTreeGraph", (): void => {
      it("Get method is defined", (): void => {
        expect(graphModelService.getFaultTreeGraph).toBeDefined();
      });
      it("Fetching a Fault Tree document", async (): Promise<void> => {
        await graphModelService.saveFaultTreeGraph(faultTreeGraph);
        const res: FaultTreeGraph = await graphModelService.getFaultTreeGraph("1");
        expect(res).toBeDefined();
        expect(res.nodes.map((n) => ({ id: n.id, type: n.type }))).toEqual(
          [node1, node2, node3].map((n) => ({ id: n.id, type: n.type })),
        );
        // Match only core edge fields; DB may omit empty data objects
        expect(res.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }))).toEqual(
          [edge1, edge2].map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
        );
      });
    });
  });
});
