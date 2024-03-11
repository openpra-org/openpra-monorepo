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
import { BaseGraphDocument } from "../src/schemas/graphs/base-graph.schema";
import {
  FaultTreeGraph,
  FaultTreeGraphSchema,
} from "../src/schemas/graphs/fault-tree-graph.schema";
import { GraphModelController } from "../src/graphModels/graphModel.controller";

describe("GraphModelController", (): void => {
  let graphModelController: GraphModelController;
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
        ]),
      ],
      providers: [GraphModelService],
      controllers: [GraphModelController],
    }).compile();

    connection = await module.get(getConnectionToken()); // create connection
    graphModelController =
      module.get<GraphModelController>(GraphModelController);
  });

  /**
   * After each test, drop the database
   */
  afterEach(async (): Promise<void> => {
    await connection.dropDatabase();
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
    const edge: GraphEdge = {
      id: "1->2",
      type: "normal",
      source: "1",
      target: "2",
    };
    const eventSequenceGraph: EventSequenceDiagramGraph = {
      id: "",
      _id: new mongoose.Types.ObjectId(),
      eventSequenceId: "1",
      nodes: [node1, node2],
      edges: [edge],
    };
    describe("createEventSequenceDiagramGraph", (): void => {
      it("Save method is defined", (): void => {
        expect(
          graphModelController.saveEventSequenceDiagramGraph,
        ).toBeDefined();
      });
      it("Saving an ES Graph document", async (): Promise<void> => {
        const res: BaseGraphDocument =
          await graphModelController.saveEventSequenceDiagramGraph(
            eventSequenceGraph,
          );
        expect(res).toBeDefined();
        expect(res.nodes).toEqual([node1, node2]);
        expect(res.edges).toEqual([edge]);
      });
    });
    describe("getEventSequenceDiagramGraph", (): void => {
      it("Get method is defined", (): void => {
        expect(graphModelController.getEventSequenceDiagramGraph).toBeDefined();
      });
      it("Fetching an ES Graph document", async (): Promise<void> => {
        await graphModelController.saveEventSequenceDiagramGraph(
          eventSequenceGraph,
        );
        const res: EventSequenceDiagramGraph =
          await graphModelController.getEventSequenceDiagramGraph("1");
        expect(res).toBeDefined();
        expect(res.nodes).toEqual([node1, node2]);
        expect(res.edges).toEqual([edge]);
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
    const edge1: GraphEdge = {
      id: "1->2",
      type: "workflow",
      source: "1",
      target: "2",
    };
    const edge2: GraphEdge = {
      id: "1->3",
      type: "workflow",
      source: "1",
      target: "3",
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
        const res: BaseGraphDocument =
          await graphModelController.createFaultTreeGraph(faultTreeGraph);
        expect(res).toBeDefined();
        expect(res.nodes).toEqual([node1, node2, node3]);
        expect(res.edges).toEqual([edge1, edge2]);
      });
    });
    describe("getFaultTreeGraph", (): void => {
      it("Get method is defined", (): void => {
        expect(graphModelController.getFaultTreeGraph).toBeDefined();
      });
      it("Fetching a fault tree document", async (): Promise<void> => {
        await graphModelController.createFaultTreeGraph(faultTreeGraph);
        const res: FaultTreeGraph =
          await graphModelController.getFaultTreeGraph("1");
        expect(res).toBeDefined();
        expect(res.nodes).toEqual([node1, node2, node3]);
        expect(res.edges).toEqual([edge1, edge2]);
      });
    });
  });
});
