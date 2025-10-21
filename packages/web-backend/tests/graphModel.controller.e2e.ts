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
// import { BaseGraphDocument } from "../src/schemas/graphs/base-graph.schema";
import { FaultTreeGraph, FaultTreeGraphSchema } from "../src/schemas/graphs/fault-tree-graph.schema";
import { EventTreeGraph, EventTreeGraphSchema } from "../src/schemas/graphs/event-tree-graph.schema";
import { GraphModelController } from "../src/graphModels/graphModel.controller";

describe("GraphModelController", (): void => {
  let graphModelController: GraphModelController;
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
      controllers: [GraphModelController],
    }).compile();

    connection = await module.get(getConnectionToken()); // create connection
    graphModelController = module.get<GraphModelController>(GraphModelController);
    graphModelService = module.get<GraphModelService>(GraphModelService);
  });

  /**
   * After each test, drop the database
   */
  afterEach(async (): Promise<void> => {
    const collections = ["eventsequencediagramgraphs", "faulttreegraphs", "eventtreegraphs"];
    await Promise.all(
      collections.map(async (name) => {
        try {
          await connection.collection(name).deleteMany({});
        } catch {
          // ignore if collection doesn't exist
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

  // Ensure that GraphModelController is defined
  describe("GraphModelController", (): void => {
    it("GraphModelController should be defined", (): void => {
      expect(graphModelController).toBeDefined();
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
    const edge: GraphEdge<object> = {
      id: "1->2",
      type: "normal",
      source: "1",
      target: "2",
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
    describe("saveEventSequenceDiagramGraph (service)", (): void => {
      it("Save method is defined", (): void => {
        expect(graphModelService.saveEventSequenceDiagramGraph).toBeDefined();
      });
      it("Saving an ES Graph document", async (): Promise<void> => {
        const res = await graphModelService.saveEventSequenceDiagramGraph(eventSequenceGraph);
        expect(res).toBeDefined();
        expect(Array.isArray(res.nodes)).toBe(true);
        expect(Array.isArray(res.edges)).toBe(true);
        expect(res.nodes.length).toBeGreaterThanOrEqual(2);
        expect(res.edges.length).toBeGreaterThanOrEqual(2);
      });
    });
    describe("getEventSequenceDiagramGraph", (): void => {
      it("Get method is defined", (): void => {
        expect(graphModelController.getEventSequenceDiagramGraph).toBeDefined();
      });
      it("Fetching an ES Graph document", async (): Promise<void> => {
        await graphModelService.saveEventSequenceDiagramGraph(eventSequenceGraph);
        const res: EventSequenceDiagramGraph = await graphModelController.getEventSequenceDiagramGraph("1");
        expect(res).toBeDefined();
        expect(Array.isArray(res.nodes)).toBe(true);
        expect(Array.isArray(res.edges)).toBe(true);
        expect(res.nodes.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // Tests for event sequence diagram graph
  describe("Fault Tree Graph", (): void => {
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
    const faultTreeGraph: FaultTreeGraph = {
      id: "",
      _id: new mongoose.Types.ObjectId(),
      faultTreeId: "1",
      nodes: [node1, node2, node3],
      edges: [edge1, edge2],
    };
    describe("createFaultTreeGraph", (): void => {
      it("Save method is defined", (): void => {
        expect(graphModelController.createFaultTreeGraph).toBeDefined();
      });
      it("Saving a fault tree document", async (): Promise<void> => {
        const res: boolean = await graphModelController.createFaultTreeGraph(faultTreeGraph);
        expect(res).toBe(true);
      });
    });
    describe("getFaultTreeGraph", (): void => {
      it("Get method is defined", (): void => {
        expect(graphModelController.getFaultTreeGraph).toBeDefined();
      });
      it("Fetching a fault tree document", async (): Promise<void> => {
        await graphModelController.createFaultTreeGraph(faultTreeGraph);
        const res: FaultTreeGraph = await graphModelController.getFaultTreeGraph("1");
        expect(res).toBeDefined();
        expect(res.nodes.map((n) => ({ id: n.id, type: n.type }))).toEqual(
          [node1, node2, node3].map((n) => ({ id: n.id, type: n.type })),
        );
        expect(res.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type }))).toEqual(
          [edge1, edge2].map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type })),
        );
      });
    });
  });
});
