import mongoose, { Connection } from "mongoose";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import {
  NestedCounter,
  NestedCounterSchema,
} from "../schemas/tree-counter.schema";
import { NestedModelService } from "./nestedModel.service";
import {
  BayesianEstimation,
  BayesianEstimationSchema,
} from "./schemas/bayesian-estimation.schema";
import {
  EventSequenceDiagram,
  EventSequenceDiagramSchema,
} from "./schemas/event-sequence-diagram.schema";
import { EventTree, EventTreeSchema } from "./schemas/event-tree.schema";
import { FaultTree, FaultTreeSchema } from "./schemas/fault-tree.schema";
import {
  InitiatingEvent,
  InitiatingEventSchema,
} from "./schemas/initiating-event.schema";
import { MarkovChain, MarkovChainSchema } from "./schemas/markov-chain.schema";
import {
  WeibullAnalysis,
  WeibullAnalysisSchema,
} from "./schemas/weibull-analysis.schema";
import {
  FunctionalEvent,
  FunctionalEventSchema,
} from "./schemas/functional-event.schema";
import {
  BayesianNetwork,
  BayesianNetworkSchema,
} from "./schemas/bayesian-network.schema";
import {
  RiskIntegration,
  RiskIntegrationSchema,
} from "./schemas/risk-integration.schema";
import {
  MechanisticSourceTerm,
  MechanisticSourceTermSchema,
} from "./schemas/mechanistic-source-term.schema";
import {
  EventSequenceQuantificationDiagram,
  EventSequenceQuantificationDiagramSchema,
} from "./schemas/event-sequence-quantification-diagram.schema";
import {
  DataAnalysis,
  DataAnalysisSchema,
} from "./schemas/data-analysis.schema";
import {
  SystemsAnalysis,
  SystemsAnalysisSchema,
} from "./schemas/systems-analysis.schema";
import {
  SuccessCriteria,
  SuccessCriteriaSchema,
} from "./schemas/success-criteria.schema";
import {
  EventSequenceAnalysis,
  EventSequenceAnalysisSchema,
} from "./schemas/event-sequence-analysis.schema";
import {
  OperatingStateAnalysis,
  OperatingStateAnalysisSchema,
} from "./schemas/operatingStateAnalysis.schema";
import {
  RadiologicalConsequenceAnalysis,
  RadiologicalConsequenceAnalysisSchema,
} from "./schemas/radiological-consequence-analysis.schema";
import {
  HumanReliabilityAnalysis,
  HumanReliabilityAnalysisSchema,
} from "./schemas/human-reliability-analysis.schema";

import { createBayesianEstimationObject } from "./stubs/createBayesianEstimation.stub";
import { createEventSequenceDiagramObject } from "./stubs/createEventSequenceDiagram.stub";
import { createEventTreeObject } from "./stubs/createEventTree.stub";
import { createFaultTreeObject } from "./stubs/createFaultTree.stub";
import { createFunctionalEventObject } from "./stubs/createFunctionalEvent.stub";
import { createInitiatingEventObject } from "./stubs/createInitiatingEvent.stub";
import { createMarkovChainObject } from "./stubs/createMarkovChain.stub";
import { createWeibullAnalysisObject } from "./stubs/createWeibullAnalysis.stub";
import { createRiskIntegrationObject } from "./stubs/createRiskIntegration.stub";
import { createMechanisticSourceTermObject } from "./stubs/createMechanisticSourceTerm.stub";
import { createEventSequenceQuantificationDiagramObject } from "./stubs/createEventSequenceQuantificationDiagram.stub";
import { createDataAnalysisObject } from "./stubs/createDataAnalysis.stub";
import { createSystemsAnalysisObject } from "./stubs/createSystemsAnalysis.stub";
import { createSuccessCriteriaObject } from "./stubs/createSuccessCriteria.stub";
import { createEventSequenceAnalysisObject } from "./stubs/createEventSequenceAnalysis.stub";
import { createOperatingStateAnalysisObject } from "./stubs/createOperatingStateAnalysis.stub";
import { createRadiologicalConsequenceAnalysisObject } from "./stubs/createRadiologicalConsequenceAnalysis.stub";
import { createHumanReliabilityAnalysisObject } from "./stubs/createHumanReliabilityAnalysis.stub";

describe("CollabService", () => {
  let nestedModelService: NestedModelService;
  let connection: Connection;
  /**
   * Before all tests
   * Create a new Testing module
   * define connection and collabService
   */
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI; //get the URI from the environment variable
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
          { name: NestedCounter.name, schema: NestedCounterSchema },
          { name: BayesianEstimation.name, schema: BayesianEstimationSchema },
          { name: BayesianNetwork.name, schema: BayesianNetworkSchema },
          {
            name: EventSequenceDiagram.name,
            schema: EventSequenceDiagramSchema,
          },
          { name: EventTree.name, schema: EventTreeSchema },
          { name: FaultTree.name, schema: FaultTreeSchema },
          { name: InitiatingEvent.name, schema: InitiatingEventSchema },
          { name: MarkovChain.name, schema: MarkovChainSchema },
          { name: WeibullAnalysis.name, schema: WeibullAnalysisSchema },
          { name: FunctionalEvent.name, schema: FunctionalEventSchema },
          { name: RiskIntegration.name, schema: RiskIntegrationSchema },
          {
            name: MechanisticSourceTerm.name,
            schema: MechanisticSourceTermSchema,
          },
          {
            name: EventSequenceQuantificationDiagram.name,
            schema: EventSequenceQuantificationDiagramSchema,
          },
          { name: DataAnalysis.name, schema: DataAnalysisSchema },
          { name: SystemsAnalysis.name, schema: SystemsAnalysisSchema },
          { name: SuccessCriteria.name, schema: SuccessCriteriaSchema },
          {
            name: EventSequenceAnalysis.name,
            schema: EventSequenceAnalysisSchema,
          },
          {
            name: OperatingStateAnalysis.name,
            schema: OperatingStateAnalysisSchema,
          },
          {
            name: RadiologicalConsequenceAnalysis.name,
            schema: RadiologicalConsequenceAnalysisSchema,
          },
          {
            name: HumanReliabilityAnalysis.name,
            schema: HumanReliabilityAnalysisSchema,
          },
        ]),
      ],
      providers: [NestedModelService],
    }).compile();
    connection = await module.get(getConnectionToken()); // create mongoose connection object to call functions like put, get, find
    nestedModelService = module.get<NestedModelService>(NestedModelService);
  });

  /**
   * After each test drop database
   */
  afterEach(async () => {
    await connection.dropDatabase();
  });

  /**
   * After all tests
   * Disconnect mongoose
   * Stop mongoDB server
   */
  afterAll(async () => {
    await mongoose.disconnect(); //disconnect from database
  });

  describe("NestedModelService", () => {
    it("NestedModelService should be defined", async () => {
      expect(nestedModelService).toBeDefined();
    });
  });

  describe("Bayesian Estimation", () => {
    describe("createBayesianEstimation", () => {
      it("Create Event Sequence digram is defined", () => {
        expect(nestedModelService.createBayesianEstimation).toBeDefined();
      });

      it("should create bayesian estimation without parent ids", async () => {
        const res = await nestedModelService.createBayesianEstimation(
          createBayesianEstimationObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createBayesianEstimationObject.label.name);
        expect(res.label.description).toBe(
          createBayesianEstimationObject.label.description,
        );
      });
      it("should create bayesian estimation with parent ids", async () => {
        createBayesianEstimationObject.parentIds = [2, 3];

        const res = await nestedModelService.createBayesianEstimation(
          createBayesianEstimationObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createBayesianEstimationObject.parentIds);
        delete createBayesianEstimationObject.parentIds;
      });

      it("IDs should be incremented", async () => {
        //copy the object to avoid changing the original object

        const bayesianEstimationObject1 = createBayesianEstimationObject;
        const res1 = await nestedModelService.createBayesianEstimation(
          bayesianEstimationObject1,
        );
        const bayesianEstimationObject2 = {
          label: {
            name: "testBayesianEstimation2",
            description: "test description",
          },
          parentIds: [1, 2],
        };
        const res2 = await nestedModelService.createBayesianEstimation(
          bayesianEstimationObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getBayesianEstimations", () => {
      it("should be defined", () => {
        expect(nestedModelService.getBayesianEstimations).toBeDefined();
      });
    });

    describe("getSingleBayesianEstimations", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleBayesianEstimation).toBeDefined();
      });

      it("should return correct object", async () => {
        const res = await nestedModelService.createBayesianEstimation(
          createBayesianEstimationObject,
        );
        const returnedBayesianEstimation =
          await nestedModelService.getSingleBayesianEstimation(res.id);
        expect(returnedBayesianEstimation).toBeDefined();
        expect(res.id).toEqual(returnedBayesianEstimation.id);
      });

      it("should return null if ID not present", async () => {
        const returnedBayesianEstimation =
          await nestedModelService.getSingleBayesianEstimation(0);
        expect(returnedBayesianEstimation).toBeNull();
      });
    });

    describe("deleteBayesianEstimation", () => {
      it("should be defined", () => {
        expect(nestedModelService.deleteBayesianEstimation).toBeDefined();
      });
      it("should delete the Bayesian Estimation", async () => {
        const res = await nestedModelService.createBayesianEstimation(
          createBayesianEstimationObject,
        );
        await nestedModelService.deleteBayesianEstimation(res.id);
        const returnedBayesianEstimation =
          await nestedModelService.getSingleBayesianEstimation(res.id);
        expect(returnedBayesianEstimation).toBeNull();
      });
      it("should return null for when Bayesian Estimation not present", async () => {
        const deletedBayesianEstimation =
          await nestedModelService.deleteBayesianEstimation(0);
        expect(deletedBayesianEstimation).toBeNull();
      });
    });
  });

  describe("Bayesian Network", () => {
    describe("createBayesianNetwork", () => {
      it("Create Bayesian Network is defined", () => {
        expect(nestedModelService.createBayesianNetwork).toBeDefined();
      });
      it("should create bayesian network without parent ids", async () => {
        const res = await nestedModelService.createBayesianNetwork(
          createBayesianEstimationObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createBayesianEstimationObject.label.name);
        expect(res.label.description).toBe(
          createBayesianEstimationObject.label.description,
        );
      });
      it("should create bayesian network with parent ids", async () => {
        createBayesianEstimationObject.parentIds = [2, 3];
        const res = await nestedModelService.createBayesianNetwork(
          createBayesianEstimationObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createBayesianEstimationObject.parentIds);
        delete createBayesianEstimationObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createBayesianNetwork(
          createBayesianEstimationObject,
        );
        const bayesianNetworkObject2 = {
          label: {
            name: "testBayesianNetwork",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createBayesianNetwork(
          bayesianNetworkObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleBayesianNetwork", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleBayesianNetwork).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedBayesianNetwork =
          await nestedModelService.getSingleBayesianNetwork(0);
        expect(returnedBayesianNetwork).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createBayesianNetwork(
          createBayesianEstimationObject,
        );
        const returnedBayesianNetwork =
          await nestedModelService.getSingleBayesianNetwork(res.id);
        expect(returnedBayesianNetwork).toBeDefined();
        expect(res.id).toEqual(returnedBayesianNetwork.id);
      });
    });

    describe("deleteBayesianNetwork", () => {
      it("should be defined", () => {
        expect(nestedModelService.deleteBayesianNetwork).toBeDefined();
      });
      it("should delete the Bayesian Network", async () => {
        const res = await nestedModelService.createBayesianNetwork(
          createBayesianEstimationObject,
        );
        await nestedModelService.deleteBayesianNetwork(res.id);
        const returnedBayesianNetwork =
          await nestedModelService.getSingleBayesianNetwork(res.id);
        expect(returnedBayesianNetwork).toBeNull();
      });
      it("should return null for when Bayesian Network not present", async () => {
        const deletedBayesianNetwork =
          await nestedModelService.deleteBayesianNetwork(0);
        expect(deletedBayesianNetwork).toBeNull();
      });
    });
    describe("getBayesianNetworks", () => {
      it("should be defined", () => {
        expect(nestedModelService.getBayesianNetworks).toBeDefined();
      });
    });
  });

  describe("Event Sequence Diagram", () => {
    describe("createEventSequenceDiagram", () => {
      it("Create Event Sequence digram is defined", () => {
        expect(nestedModelService.createEventSequenceDiagram).toBeDefined();
      });
      it("should create event sequence diagram without parent ids", async () => {
        const res = await nestedModelService.createEventSequenceDiagram(
          createEventSequenceDiagramObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createEventSequenceDiagramObject.label.name,
        );
        expect(res.label.description).toBe(
          createEventSequenceDiagramObject.label.description,
        );
      });
      it("should create bayesian estimation with parent ids", async () => {
        createEventSequenceDiagramObject.parentIds = [2, 3];
        const res = await nestedModelService.createEventSequenceDiagram(
          createEventSequenceDiagramObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createEventSequenceDiagramObject.parentIds,
        );
        delete createEventSequenceDiagramObject.parentIds;
      });

      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createEventSequenceDiagram(
          createEventSequenceDiagramObject,
        );
        const eventSequenceDiagramObject2 = {
          label: { name: "testEventSequence", description: "test description" },
        };
        const res2 = await nestedModelService.createEventSequenceDiagram(
          eventSequenceDiagramObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleEventSequenceDiagram", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleEventSequenceDiagram).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedEventSequenceDiagram =
          await nestedModelService.getSingleEventSequenceDiagram(0);
        expect(returnedEventSequenceDiagram).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createEventSequenceDiagram(
          createEventSequenceDiagramObject,
        );
        const returnedEventSequenceDiagram =
          await nestedModelService.getSingleEventSequenceDiagram(res.id);
        expect(returnedEventSequenceDiagram).toBeDefined();
        expect(res.id).toEqual(returnedEventSequenceDiagram.id);
      });
    });
  });

  describe("Event Tree", () => {
    describe("createEventTree", () => {
      it("Create Event Tree is defined", () => {
        expect(nestedModelService.createEventTree).toBeDefined();
      });
      it("should create Event Tree without parent ids", async () => {
        const res = await nestedModelService.createEventTree(
          createEventTreeObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createEventTreeObject.label.name);
        expect(res.label.description).toBe(
          createEventTreeObject.label.description,
        );
      });
      it("should create Event Tree with parent ids", async () => {
        createEventTreeObject.parentIds = [2, 3];
        const res = await nestedModelService.createEventSequenceDiagram(
          createEventTreeObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createEventTreeObject.parentIds);
        delete createEventTreeObject.parentIds;
      });

      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createEventSequenceDiagram(
          createEventTreeObject,
        );
        const eventTreeObject2 = {
          label: { name: "testEventSequence", description: "test description" },
        };
        const res2 =
          await nestedModelService.createEventSequenceDiagram(eventTreeObject2);
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getSingleEventTrees", () => {
      it("getSingleEventTree is defined", () => {
        expect(nestedModelService.getSingleEventTree).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedEventTree =
          await nestedModelService.getSingleEventTree(0);
        expect(returnedEventTree).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createEventTree(
          createEventTreeObject,
        );
        const returnedEventTree = await nestedModelService.getSingleEventTree(
          res.id,
        );
        expect(returnedEventTree).toBeDefined();
        expect(res.id).toEqual(returnedEventTree.id);
      });
    });
  });
  describe("Fault Tree", () => {
    describe("createFaultTree", () => {
      it("Create Fault Tree is defined", () => {
        expect(nestedModelService.createFaultTree).toBeDefined();
      });
      it("should create Fault Tree without parent ids", async () => {
        const res = await nestedModelService.createFaultTree(
          createFaultTreeObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createFaultTreeObject.label.name);
        expect(res.label.description).toBe(
          createFaultTreeObject.label.description,
        );
      });
      it("should create Fault Tree with parent ids", async () => {
        createFaultTreeObject.parentIds = [2, 3];
        const res = await nestedModelService.createEventSequenceDiagram(
          createFaultTreeObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createFaultTreeObject.parentIds);
        delete createFaultTreeObject.parentIds;
      });

      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createEventSequenceDiagram(
          createFaultTreeObject,
        );
        const faultTreeObject2 = {
          label: { name: "testFaultTree2", description: "test description2" },
        };
        const res2 =
          await nestedModelService.createEventSequenceDiagram(faultTreeObject2);
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getSingleFaultTree", () => {
      it("getSingleFaultTree is defined", () => {
        expect(nestedModelService.getSingleFaultTree).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedFaultTree =
          await nestedModelService.getSingleFaultTree(0);
        expect(returnedFaultTree).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createFaultTree(
          createFaultTreeObject,
        );
        const returnedFaultTree = await nestedModelService.getSingleFaultTree(
          res.id,
        );
        expect(returnedFaultTree).toBeDefined();
        expect(res.id).toEqual(returnedFaultTree.id);
      });
    });
  });

  describe("Functional Events", () => {
    describe("createFunctionalEvent", () => {
      it("should be defined", () => {
        expect(nestedModelService.createFunctionalEvent).toBeDefined();
      });
      it("should create Functional Event without parent ids", async () => {
        const res = await nestedModelService.createFunctionalEvent(
          createFunctionalEventObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createFunctionalEventObject.label.name);
        expect(res.label.description).toBe(
          createFunctionalEventObject.label.description,
        );
      });
      it("should create Functional Event with parent ids", async () => {
        createFunctionalEventObject.parentIds = [2, 3];
        const res = await nestedModelService.createFunctionalEvent(
          createFunctionalEventObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createFunctionalEventObject.parentIds);
        delete createFunctionalEventObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createFunctionalEvent(
          createFunctionalEventObject,
        );
        const functionalEventObject2 = {
          label: {
            name: "testFunctionalEvent",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createFunctionalEvent(
          functionalEventObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleFunctionalEvent", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleFunctionalEvent).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedFunctionalEvent =
          await nestedModelService.getSingleFunctionalEvent(0);
        expect(returnedFunctionalEvent).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createFunctionalEvent(
          createFunctionalEventObject,
        );
        const returnedFunctionalEvent =
          await nestedModelService.getSingleFunctionalEvent(res.id);
        expect(returnedFunctionalEvent).toBeDefined();
        expect(res.id).toEqual(returnedFunctionalEvent.id);
      });
    });
  });

  describe("Initiating Events", () => {
    describe("createInitiatingEvent", () => {
      it("should be defined", () => {
        expect(nestedModelService.createInitiatingEvent).toBeDefined();
      });
      it("should create Initiating Event without parent ids", async () => {
        const res = await nestedModelService.createInitiatingEvent(
          createInitiatingEventObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createInitiatingEventObject.label.name);
        expect(res.label.description).toBe(
          createInitiatingEventObject.label.description,
        );
      });
      it("should create Initiating Event with parent ids", async () => {
        createInitiatingEventObject.parentIds = [2, 3];
        const res = await nestedModelService.createInitiatingEvent(
          createInitiatingEventObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createInitiatingEventObject.parentIds);
        delete createInitiatingEventObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createInitiatingEvent(
          createInitiatingEventObject,
        );
        const initiatingEventObject2 = {
          label: {
            name: "testInitiatingEvent",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createInitiatingEvent(
          initiatingEventObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleInitiatingEvent", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleInitiatingEvent).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedInitiatingEvent =
          await nestedModelService.getSingleInitiatingEvent(0);
        expect(returnedInitiatingEvent).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createInitiatingEvent(
          createInitiatingEventObject,
        );
        const returnedInitiatingEvent =
          await nestedModelService.getSingleInitiatingEvent(res.id);
        expect(returnedInitiatingEvent).toBeDefined();
        expect(res.id).toEqual(returnedInitiatingEvent.id);
      });
    });
  });

  describe("Markov Chain", () => {
    describe("createMarkovChain", () => {
      it("should be defined", () => {
        expect(nestedModelService.createMarkovChain).toBeDefined();
      });
      it("should create Markov Chain without parent ids", async () => {
        const res = await nestedModelService.createMarkovChain(
          createMarkovChainObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createMarkovChainObject.label.name);
        expect(res.label.description).toBe(
          createMarkovChainObject.label.description,
        );
      });
      it("should create Markov Chain with parent ids", async () => {
        createMarkovChainObject.parentIds = [2, 3];
        const res = await nestedModelService.createMarkovChain(
          createMarkovChainObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createMarkovChainObject.parentIds);
        delete createMarkovChainObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createMarkovChain(
          createMarkovChainObject,
        );
        const markovChainObject2 = {
          label: { name: "testMarkovChain", description: "test description" },
        };
        const res2 =
          await nestedModelService.createMarkovChain(markovChainObject2);
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleMarkovChain", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleMarkovChain).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedMarkovChain =
          await nestedModelService.getSingleMarkovChain(0);
        expect(returnedMarkovChain).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createMarkovChain(
          createMarkovChainObject,
        );
        const returnedMarkovChain =
          await nestedModelService.getSingleMarkovChain(res.id);
        expect(returnedMarkovChain).toBeDefined();
        expect(res.id).toEqual(returnedMarkovChain.id);
      });
    });
  });

  describe("Weibull analysis", () => {
    describe("createWeibullAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.createInitiatingEvent).toBeDefined();
      });
      it("should create Weibull Analysis without parent ids", async () => {
        const res = await nestedModelService.createWeibullAnalysis(
          createWeibullAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createWeibullAnalysisObject.label.name);
        expect(res.label.description).toBe(
          createWeibullAnalysisObject.label.description,
        );
      });
      it("should create Weibull Analysis with parent ids", async () => {
        createWeibullAnalysisObject.parentIds = [2, 3];
        const res = await nestedModelService.createWeibullAnalysis(
          createWeibullAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createWeibullAnalysisObject.parentIds);
        delete createWeibullAnalysisObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createWeibullAnalysis(
          createWeibullAnalysisObject,
        );
        const weibullAnalysisObject2 = {
          label: {
            name: "testWeibullAnalysis",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createWeibullAnalysis(
          weibullAnalysisObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getSingleWeibullAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleWeibullAnalysis).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedWeibullAnalysis =
          await nestedModelService.getSingleWeibullAnalysis(0);
        expect(returnedWeibullAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createWeibullAnalysis(
          createWeibullAnalysisObject,
        );
        const returnedWeibullAnalysis =
          await nestedModelService.getSingleWeibullAnalysis(res.id);
        expect(returnedWeibullAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedWeibullAnalysis.id);
      });
    });
  });

  describe("Risk Integration", () => {
    describe("createRiskIntegration", () => {
      it("should be defined", () => {
        expect(nestedModelService.createRiskIntegration).toBeDefined();
      });
      it("should create Risk Integration without parent ids", async () => {
        const res = await nestedModelService.createRiskIntegration(
          createRiskIntegrationObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createRiskIntegrationObject.label.name);
        expect(res.label.description).toBe(
          createRiskIntegrationObject.label.description,
        );
      });
      it("should create Risk Integration with parent ids", async () => {
        createRiskIntegrationObject.parentIds = [2, 3];
        const res = await nestedModelService.createRiskIntegration(
          createRiskIntegrationObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createRiskIntegrationObject.parentIds);
        delete createRiskIntegrationObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createRiskIntegration(
          createRiskIntegrationObject,
        );
        const riskIntegrationObject2 = {
          label: {
            name: "testRiskIntegration",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createRiskIntegration(
          riskIntegrationObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleRiskIntegration", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleRiskIntegration).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedRiskIntegration =
          await nestedModelService.getSingleRiskIntegration(0);
        expect(returnedRiskIntegration).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createRiskIntegration(
          createRiskIntegrationObject,
        );
        const returnedRiskIntegration =
          await nestedModelService.getSingleRiskIntegration(res.id);
        expect(returnedRiskIntegration).toBeDefined();
        expect(res.id).toEqual(returnedRiskIntegration.id);
      });
    });
  });

  describe("Radiological Consequence Analysis", () => {
    describe("createRadiologicalConsequenceAnalysis", () => {
      it("should be defined", () => {
        expect(
          nestedModelService.createRadiologicalConsequenceAnalysis,
        ).toBeDefined();
      });
      it("should create Radiological Consequence Analysis without parent ids", async () => {
        const res =
          await nestedModelService.createRadiologicalConsequenceAnalysis(
            createRadiologicalConsequenceAnalysisObject,
          );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createRadiologicalConsequenceAnalysisObject.label.name,
        );
        expect(res.label.description).toBe(
          createRadiologicalConsequenceAnalysisObject.label.description,
        );
      });
      it("should create Radiological Consequence Analysis with parent ids", async () => {
        createRadiologicalConsequenceAnalysisObject.parentIds = [2, 3];
        const res =
          await nestedModelService.createRadiologicalConsequenceAnalysis(
            createRadiologicalConsequenceAnalysisObject,
          );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createRadiologicalConsequenceAnalysisObject.parentIds,
        );
        delete createRadiologicalConsequenceAnalysisObject.parentIds;
      });
    });
    describe("getSingleRadiologicalConsequenceAnalysis", () => {
      it("should be defined", () => {
        expect(
          nestedModelService.getSingleRadiologicalConsequenceAnalysis,
        ).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedRadiologicalConsequenceAnalysis =
          await nestedModelService.getSingleRadiologicalConsequenceAnalysis(0);
        expect(returnedRadiologicalConsequenceAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res =
          await nestedModelService.createRadiologicalConsequenceAnalysis(
            createRadiologicalConsequenceAnalysisObject,
          );
        const returnedRadiologicalConsequenceAnalysis =
          await nestedModelService.getSingleRadiologicalConsequenceAnalysis(
            res.id,
          );
        expect(returnedRadiologicalConsequenceAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedRadiologicalConsequenceAnalysis.id);
      });
    });
  });
  describe("Mechanistic Source Term", () => {
    describe("createMechanisticSourceTerm", () => {
      it("should be defined", () => {
        expect(nestedModelService.createMechanisticSourceTerm).toBeDefined();
      });
      it("should create Mechanistic Source Term without parent ids", async () => {
        const res = await nestedModelService.createMechanisticSourceTerm(
          createMechanisticSourceTermObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createMechanisticSourceTermObject.label.name,
        );
        expect(res.label.description).toBe(
          createMechanisticSourceTermObject.label.description,
        );
      });
      it("should create Mechanistic Source Term with parent ids", async () => {
        createMechanisticSourceTermObject.parentIds = [2, 3];
        const res = await nestedModelService.createMechanisticSourceTerm(
          createMechanisticSourceTermObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createMechanisticSourceTermObject.parentIds,
        );
        delete createMechanisticSourceTermObject.parentIds;
      });
    });
    describe("getSingleMechanisticSourceTerm", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleMechanisticSourceTerm).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedMechanisticSourceTerm =
          await nestedModelService.getSingleMechanisticSourceTerm(0);
        expect(returnedMechanisticSourceTerm).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createMechanisticSourceTerm(
          createMechanisticSourceTermObject,
        );
        const returnedMechanisticSourceTerm =
          await nestedModelService.getSingleMechanisticSourceTerm(res.id);
        expect(returnedMechanisticSourceTerm).toBeDefined();
        expect(res.id).toEqual(returnedMechanisticSourceTerm.id);
      });
    });
  });
  describe("Event Sequence Quantification Diagram", () => {
    describe("createEventSequenceQuantificationDiagram", () => {
      it("should be defined", () => {
        expect(
          nestedModelService.createEventSequenceQuantificationDiagram,
        ).toBeDefined();
      });

      it("should create Event Sequence Quantification Diagram without parent ids", async () => {
        const res =
          await nestedModelService.createEventSequenceQuantificationDiagram(
            createEventSequenceQuantificationDiagramObject,
          );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createEventSequenceQuantificationDiagramObject.label.name,
        );
        expect(res.label.description).toBe(
          createEventSequenceQuantificationDiagramObject.label.description,
        );
      });
      it("should create Event Sequence Quantification Diagram with parent ids", async () => {
        createEventSequenceQuantificationDiagramObject.parentIds = [2, 3];
        const res =
          await nestedModelService.createEventSequenceQuantificationDiagram(
            createEventSequenceQuantificationDiagramObject,
          );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createEventSequenceQuantificationDiagramObject.parentIds,
        );
        delete createEventSequenceQuantificationDiagramObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 =
          await nestedModelService.createEventSequenceQuantificationDiagram(
            createEventSequenceQuantificationDiagramObject,
          );
        const eventSequenceQuantificationDiagramObject2 = {
          label: {
            name: "testEventSequenceQuantification",
            description: "test description",
          },
        };
        const res2 =
          await nestedModelService.createEventSequenceQuantificationDiagram(
            eventSequenceQuantificationDiagramObject2,
          );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleEventSequenceQuantificationDiagram", () => {
      it("should be defined", () => {
        expect(
          nestedModelService.getSingleEventSequenceQuantificationDiagram,
        ).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedEventSequenceQuantificationDiagram =
          await nestedModelService.getSingleEventSequenceQuantificationDiagram(
            0,
          );
        expect(returnedEventSequenceQuantificationDiagram).toBeNull();
      });
      it("should return correct object", async () => {
        const res =
          await nestedModelService.createEventSequenceQuantificationDiagram(
            createEventSequenceQuantificationDiagramObject,
          );
        const returnedEventSequenceQuantificationDiagram =
          await nestedModelService.getSingleEventSequenceQuantificationDiagram(
            res.id,
          );
        expect(returnedEventSequenceQuantificationDiagram).toBeDefined();
        expect(res.id).toEqual(returnedEventSequenceQuantificationDiagram.id);
      });
    });
  });
  describe("Data Analysis", () => {
    describe("createDataAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.createDataAnalysis).toBeDefined();
      });
      it("should create Data Analysis without parent ids", async () => {
        const res = await nestedModelService.createDataAnalysis(
          createDataAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createDataAnalysisObject.label.name);
        expect(res.label.description).toBe(
          createDataAnalysisObject.label.description,
        );
      });
      it("should create Data Analysis with parent ids", async () => {
        createDataAnalysisObject.parentIds = [2, 3];
        const res = await nestedModelService.createDataAnalysis(
          createDataAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createDataAnalysisObject.parentIds);
        delete createDataAnalysisObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createDataAnalysis(
          createDataAnalysisObject,
        );
        const dataAnalysisObject2 = {
          label: { name: "testDataAnalysis", description: "test description" },
        };
        const res2 =
          await nestedModelService.createDataAnalysis(dataAnalysisObject2);
        expect(res1.id).toEqual(res2.id - 1);
      });
    });
    describe("getSingleDataAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleDataAnalysis).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedDataAnalysis =
          await nestedModelService.getSingleDataAnalysis(0);
        expect(returnedDataAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createDataAnalysis(
          createDataAnalysisObject,
        );
        const returnedDataAnalysis =
          await nestedModelService.getSingleDataAnalysis(res.id);
        expect(returnedDataAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedDataAnalysis.id);
      });
    });
  });

  describe("Human Reliability Analysis", () => {
    //test block for createHumanReliabilityAnalysis
    describe("createHumanReliabilityAnalysis", () => {
      it("should be defined", async () => {
        expect(nestedModelService.createHumanReliabilityAnalysis).toBeDefined();
      });
      it("should create Human Reliability Analysis without parent ids", async () => {
        const res = await nestedModelService.createHumanReliabilityAnalysis(
          createHumanReliabilityAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createHumanReliabilityAnalysisObject.label.name,
        );
        expect(res.label.description).toBe(
          createHumanReliabilityAnalysisObject.label.description,
        );
      });
      it("should create Human Reliability Analysis with parent ids", async () => {
        createHumanReliabilityAnalysisObject.parentIds = [2, 3];
        const res = await nestedModelService.createHumanReliabilityAnalysis(
          createHumanReliabilityAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createHumanReliabilityAnalysisObject.parentIds,
        );
        delete createHumanReliabilityAnalysisObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createHumanReliabilityAnalysis(
          createHumanReliabilityAnalysisObject,
        );
        const humanReliabilityAnalysisObject2 = {
          label: {
            name: "testHumanReliability",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createHumanReliabilityAnalysis(
          humanReliabilityAnalysisObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getSingleHumanReliabilityAnalysis", () => {
      it("should be defined", async () => {
        expect(
          nestedModelService.getSingleHumanReliabilityAnalysis,
        ).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedHumanReliabilityAnalysis =
          await nestedModelService.getSingleHumanReliabilityAnalysis(0);
        expect(returnedHumanReliabilityAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createHumanReliabilityAnalysis(
          createHumanReliabilityAnalysisObject,
        );
        const returnedHumanReliabilityAnalysis =
          await nestedModelService.getSingleHumanReliabilityAnalysis(res.id);
        expect(returnedHumanReliabilityAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedHumanReliabilityAnalysis.id);
      });
    });
  });

  describe("Systems Analysis", () => {
    //test block for createSystemsAnalysis
    describe("createSystemsAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.createSystemsAnalysis).toBeDefined();
      });

      it("should create Systems Analysis without parent ids", async () => {
        const res = await nestedModelService.createSystemsAnalysis(
          createSystemsAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createSystemsAnalysisObject.label.name);
        expect(res.label.description).toBe(
          createSystemsAnalysisObject.label.description,
        );
      });

      it("should create Systems Analysis with parent ids", async () => {
        createSystemsAnalysisObject.parentIds = [2, 3];
        const res = await nestedModelService.createSystemsAnalysis(
          createSystemsAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createSystemsAnalysisObject.parentIds);
        delete createSystemsAnalysisObject.parentIds;
      });
    });

    describe("getSingleSystemsAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleSystemsAnalysis).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedSystemsAnalysis =
          await nestedModelService.getSingleSystemsAnalysis(0);
        expect(returnedSystemsAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createSystemsAnalysis(
          createSystemsAnalysisObject,
        );
        const returnedSystemsAnalysis =
          await nestedModelService.getSingleSystemsAnalysis(res.id);
        expect(returnedSystemsAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedSystemsAnalysis.id);
      });
    });
  });

  describe("Success Criteria", () => {
    describe("createSuccessCriteria", () => {
      it("should be defined", () => {
        expect(nestedModelService.createSuccessCriteria).toBeDefined();
      });
      it("should create Success Criteria without parent ids", async () => {
        const res = await nestedModelService.createSuccessCriteria(
          createSuccessCriteriaObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(createSuccessCriteriaObject.label.name);
        expect(res.label.description).toBe(
          createSuccessCriteriaObject.label.description,
        );
      });
      it("should create Success Criteria with parent ids", async () => {
        createSuccessCriteriaObject.parentIds = [2, 3];
        const res = await nestedModelService.createSuccessCriteria(
          createSuccessCriteriaObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(createSuccessCriteriaObject.parentIds);
        delete createSuccessCriteriaObject.parentIds;
      });
    });

    describe("getSingleSuccessCriteria", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleSuccessCriteria).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedSuccessCriteria =
          await nestedModelService.getSingleSuccessCriteria(0);
        expect(returnedSuccessCriteria).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createSuccessCriteria(
          createSuccessCriteriaObject,
        );
        const returnedSuccessCriteria =
          await nestedModelService.getSingleSuccessCriteria(res.id);
        expect(returnedSuccessCriteria).toBeDefined();
        expect(res.id).toEqual(returnedSuccessCriteria.id);
      });
    });
  });

  describe("Event Sequence Analysis", () => {
    describe("createEventSequenceAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.createEventSequenceAnalysis).toBeDefined();
      });
      it("should create Event Sequence Analysis without parent ids", async () => {
        const res = await nestedModelService.createEventSequenceAnalysis(
          createEventSequenceAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createEventSequenceAnalysisObject.label.name,
        );
        expect(res.label.description).toBe(
          createEventSequenceAnalysisObject.label.description,
        );
      });
      it("should create Event Sequence Analysis with parent ids", async () => {
        createEventSequenceAnalysisObject.parentIds = [2, 3];
        const res = await nestedModelService.createEventSequenceAnalysis(
          createEventSequenceAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createEventSequenceAnalysisObject.parentIds,
        );
        delete createEventSequenceAnalysisObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createEventSequenceAnalysis(
          createEventSequenceAnalysisObject,
        );
        const eventSequenceAnalysisObject2 = {
          label: { name: "testEventSequence", description: "test description" },
        };
        const res2 = await nestedModelService.createEventSequenceAnalysis(
          eventSequenceAnalysisObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getSingleEventSequenceAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.getSingleEventSequenceAnalysis).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedEventSequenceAnalysis =
          await nestedModelService.getSingleEventSequenceAnalysis(0);
        expect(returnedEventSequenceAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createEventSequenceAnalysis(
          createEventSequenceAnalysisObject,
        );
        const returnedEventSequenceAnalysis =
          await nestedModelService.getSingleEventSequenceAnalysis(res.id);
        expect(returnedEventSequenceAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedEventSequenceAnalysis.id);
      });
    });
  });

  describe("Operating State Analysis", () => {
    describe("createOperatingStateAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.createOperatingStateAnalysis).toBeDefined();
      });
      it("should create Operating State Analysis without parent ids", async () => {
        const res = await nestedModelService.createOperatingStateAnalysis(
          createOperatingStateAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual([]);
        expect(res.label.name).toBe(
          createOperatingStateAnalysisObject.label.name,
        );
        expect(res.label.description).toBe(
          createOperatingStateAnalysisObject.label.description,
        );
      });
      it("should create Operating State Analysis with parent ids", async () => {
        createOperatingStateAnalysisObject.parentIds = [2, 3];
        const res = await nestedModelService.createOperatingStateAnalysis(
          createOperatingStateAnalysisObject,
        );
        expect(res).toBeDefined();
        expect(res.parentIds).toEqual(
          createOperatingStateAnalysisObject.parentIds,
        );
        delete createOperatingStateAnalysisObject.parentIds;
      });
      it("IDs should be incremented", async () => {
        const res1 = await nestedModelService.createOperatingStateAnalysis(
          createOperatingStateAnalysisObject,
        );
        const operatingStateAnalysisObject2 = {
          label: {
            name: "testOperatingState",
            description: "test description",
          },
        };
        const res2 = await nestedModelService.createOperatingStateAnalysis(
          operatingStateAnalysisObject2,
        );
        expect(res1.id).toEqual(res2.id - 1);
      });
    });

    describe("getSingleOperatingStateAnalysis", () => {
      it("should be defined", () => {
        expect(
          nestedModelService.getSingleOperatingStateAnalysis,
        ).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedOperatingStateAnalysis =
          await nestedModelService.getSingleOperatingStateAnalysis(0);
        expect(returnedOperatingStateAnalysis).toBeNull();
      });
      it("should return correct object", async () => {
        const res = await nestedModelService.createOperatingStateAnalysis(
          createOperatingStateAnalysisObject,
        );
        const returnedOperatingStateAnalysis =
          await nestedModelService.getSingleOperatingStateAnalysis(res.id);
        expect(returnedOperatingStateAnalysis).toBeDefined();
        expect(res.id).toEqual(returnedOperatingStateAnalysis.id);
      });
    });

    describe("getOperatingStateAnalysis", () => {
      it("should be defined", () => {
        expect(nestedModelService.getOperatingStateAnalysis).toBeDefined();
      });
      it("should return null if ID not present", async () => {
        const returnedOperatingStateAnalysis =
          await nestedModelService.getOperatingStateAnalysis(0);
        expect(returnedOperatingStateAnalysis).toEqual([]);
      });
    });
  });
});
