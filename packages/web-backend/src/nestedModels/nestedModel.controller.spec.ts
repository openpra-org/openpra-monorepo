import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose, { Connection } from "mongoose";
import { Test, TestingModule } from "@nestjs/testing";
import { NestedCounter, NestedCounterSchema } from "../schemas/tree-counter.schema";
import { NestedModelController } from "./nestedModel.controller";
import { NestedModelService } from "./nestedModel.service";
import { InitiatingEventsService } from "./NestedModelsHelpers/initiating-events.service";
import { EventSequenceDiagramService } from "./NestedModelsHelpers/event-sequence-diagram.service";
import { EventSequenceAnalysisService } from "./NestedModelsHelpers/event-sequence-analysis.service";
import { EventTreesService } from "./NestedModelsHelpers/event-trees.service";
import { BayesianNetworksService } from "./NestedModelsHelpers/bayesian-networks.service";
import { FaultTreesService } from "./NestedModelsHelpers/fault-trees.service";
import { BayesianEstimation, BayesianEstimationSchema } from "./schemas/bayesian-estimation.schema";
import { EventSequenceDiagram, EventSequenceDiagramSchema } from "./schemas/event-sequence-diagram.schema";
import { EventTree, EventTreeSchema } from "./schemas/event-tree.schema";
import { FaultTree, FaultTreeSchema } from "./schemas/fault-tree.schema";
import { HeatBalanceFaultTree, HeatBalanceFaultTreeSchema } from "./schemas/heat-balance-fault-tree.schema";
import { InitiatingEvent, InitiatingEventSchema } from "./schemas/initiating-event.schema";
import { MarkovChain, MarkovChainSchema } from "./schemas/markov-chain.schema";
import { WeibullAnalysis, WeibullAnalysisSchema } from "./schemas/weibull-analysis.schema";
import { FunctionalEvent, FunctionalEventSchema } from "./schemas/functional-event.schema";
import { BayesianNetwork, BayesianNetworkSchema } from "./schemas/bayesian-network.schema";
import { RiskIntegration, RiskIntegrationSchema } from "./schemas/risk-integration.schema";
import { MechanisticSourceTerm, MechanisticSourceTermSchema } from "./schemas/mechanistic-source-term.schema";
import {
  EventSequenceQuantificationDiagram,
  EventSequenceQuantificationDiagramSchema,
} from "./schemas/event-sequence-quantification-diagram.schema";
import { DataAnalysis, DataAnalysisSchema } from "./schemas/data-analysis.schema";
import { SystemsAnalysis, SystemsAnalysisSchema } from "./schemas/systems-analysis.schema";
import { SuccessCriteria, SuccessCriteriaSchema } from "./schemas/success-criteria.schema";
import { EventSequenceAnalysis, EventSequenceAnalysisSchema } from "./schemas/event-sequence-analysis.schema";
import { OperatingStateAnalysis, OperatingStateAnalysisSchema } from "./schemas/operatingStateAnalysis.schema";
import {
  RadiologicalConsequenceAnalysis,
  RadiologicalConsequenceAnalysisSchema,
} from "./schemas/radiological-consequence-analysis.schema";
import { HumanReliabilityAnalysis, HumanReliabilityAnalysisSchema } from "./schemas/human-reliability-analysis.schema";

import { createBayesianEstimationObject } from "./stubs/createBayesianEstimation.stub";
import { createBayesianNetworkObject } from "./stubs/createBayesianNetwork.stub";
import { createEventSequenceDiagramObject } from "./stubs/createEventSequenceDiagram.stub";
import { createEventTreeObject } from "./stubs/createEventTree.stub";
import { createFaultTreeObject } from "./stubs/createFaultTree.stub";
import { createFunctionalEventObject } from "./stubs/createFunctionalEvent.stub";
import { createInitiatingEventObject } from "./stubs/createInitiatingEvent.stub";
import { createMarkovChainObject } from "./stubs/createMarkovChain.stub";
import { createMechanisticSourceTermObject } from "./stubs/createMechanisticSourceTerm.stub";
import { createRiskIntegrationObject } from "./stubs/createRiskIntegration.stub";
import { createSuccessCriteriaObject } from "./stubs/createSuccessCriteria.stub";
import { createSystemsAnalysisObject } from "./stubs/createSystemsAnalysis.stub";
import { createWeibullAnalysisObject } from "./stubs/createWeibullAnalysis.stub";
import { createDataAnalysisObject } from "./stubs/createDataAnalysis.stub";
import { createEventSequenceAnalysisObject } from "./stubs/createEventSequenceAnalysis.stub";
import { createOperatingStateAnalysisObject } from "./stubs/createOperatingStateAnalysis.stub";
import { createRadiologicalConsequenceAnalysisObject } from "./stubs/createRadiologicalConsequenceAnalysis.stub";
import { createHumanReliabilityAnalysisObject } from "./stubs/createHumanReliabilityAnalysis.stub";
import { createEventSequenceQuantificationDiagramObject } from "./stubs/createEventSequenceQuantificationDiagram.stub";

describe("CollabController", () => {
  let nestedModelController: NestedModelController;
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
          { name: HeatBalanceFaultTree.name, schema: HeatBalanceFaultTreeSchema },
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
      providers: [
        NestedModelService,
        { provide: InitiatingEventsService, useValue: { createInitiatingEvent: jest.fn(async (d) => ({ ...d, id: 1 })) } },
        {
          provide: EventSequenceDiagramService,
          useValue: {
            createEventSequenceDiagram: jest.fn(async (d) => ({ ...d, id: 1 })),
            getSingleEventSequenceDiagram: jest.fn(async () => ({ id: 1, parentIds: [1] })),
          },
        },
        {
          provide: EventSequenceAnalysisService,
          useValue: { createEventSequenceAnalysis: jest.fn(async (d) => ({ ...d, id: 1 })) },
        },
        {
          provide: EventTreesService,
          useValue: {
            createEventTree: jest.fn(async (d) => ({ ...d, id: 1 })),
            getSingleEventTree: jest.fn(async () => ({ id: 1, parentIds: [1] })),
          },
        },
        {
          provide: BayesianNetworksService,
          useValue: {
            createBayesianNetwork: jest.fn(async (d) => ({ ...d, id: 1 })),
            getSingleBayesianNetwork: jest.fn(async () => ({ id: 1, parentIds: [1] })),
          },
        },
        {
          provide: FaultTreesService,
          useValue: {
            createFaultTree: jest.fn(async (d) => ({ ...d, id: 1 })),
            getSingleFaultTree: jest.fn(async () => ({ id: 1, parentIds: [1] })),
          },
        },
        {
          provide: InitiatingEventsService,
          useValue: {
            createInitiatingEvent: jest.fn(async (d) => ({ ...d, id: 1 })),
            getSingleInitiatingEvent: jest.fn(async () => ({ id: 1, parentIds: [1] })),
          },
        },
        {
          provide: EventSequenceAnalysisService,
          useValue: {
            createEventSequenceAnalysis: jest.fn(async (d) => ({ ...d, id: 1 })),
            getSingleEventSequenceAnalysis: jest.fn(async () => ({ id: 1, parentIds: [1] })),
          },
        },
      ],
      controllers: [NestedModelController],
    }).compile();
    connection = await module.get(getConnectionToken()); // create mongoose connection object to call functions like put, get, find
    nestedModelController = module.get<NestedModelController>(NestedModelController);
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
    await mongoose.disconnect();
  });

  describe("NestedModelController", () => {
    /**
     * Test if nestedModelController is defined
     */
    it("NestedModelController should be defined", () => {
      expect(nestedModelController).toBeDefined();
    });
  });

  describe("createBayesianEstimation", () => {
    /**
     * Test if createBayesianEstimation is defined
     */
    it("createBayesianEstimation should be defined", () => {
      expect(nestedModelController.createBayesianEstimation).toBeDefined();
    });

    it("should create a BayesianEstimation", async () => {
      const result = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Bayesian Estimation Model");
      expect(result.label.description).toBe("Description for Bayesian Estimation Model");
    });
  });

  describe("createBayesianNetwork", () => {
    /**
     * Test if createBayesianNetwork is defined
     */
    it("createBayesianNetwork should be defined", () => {
      expect(nestedModelController.createBayesianNetwowrk).toBeDefined();
    });
    it("should create a BayesianNetwork", async () => {
      const result = await nestedModelController.createBayesianNetwowrk(createBayesianNetworkObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Bayesian Network Model");
      expect(result.label.description).toBe("Description for Bayesian Network Model");
    });
  });

  describe("createEventSequenceDiagram", () => {
    /**
     * Test if createEventSequenceDiagram is defined
     */
    it("createEventSequenceDiagram should be defined", () => {
      expect(nestedModelController.createEventSequenceDiagram).toBeDefined();
    });
    it("should create a EventSequenceDiagram", async () => {
      const result = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Event Sequence Diagram Model");
      expect(result.label.description).toBe("Description for Event Sequence Diagram Model");
    });
  });

  describe("createEventTree", () => {
    /**
     * Test if createEventTree is defined
     */
    it("createEventTree should be defined", () => {
      expect(nestedModelController.createEventTree).toBeDefined();
    });
    it("should create a EventTree", async () => {
      const result = await nestedModelController.createEventTree(createEventTreeObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Event Tree Model");
      expect(result.label.description).toBe("Description for Event Tree Model");
    });
  });
  describe("createFaultTree", () => {
    /**
     * Test if createFaultTree is defined
     */
    it("createFaultTree should be defined", () => {
      expect(nestedModelController.createFaultTree).toBeDefined();
    });
    it("should create a FaultTree", async () => {
      const result = await nestedModelController.createFaultTree(createFaultTreeObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Fault Tree Model");
      expect(result.label.description).toBe("Description for Fault Tree Model");
    });
  });

  describe("createFunctionalEvent", () => {
    /**
     * Test if createFunctionalEvent is defined
     */
    it("createFunctionalEvent should be defined", () => {
      expect(nestedModelController.createFunctionalEvent).toBeDefined();
    });
    it("should create a FunctionalEvent", async () => {
      const result = await nestedModelController.createFunctionalEvent(createFunctionalEventObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Functional Event Model");
      expect(result.label.description).toBe("Description for Functional Event Model");
    });
  });
  describe("createInitiatingEvent", () => {
    /**
     * Test if createInitiatingEvent is defined
     */
    it("createInitiatingEvent should be defined", () => {
      expect(nestedModelController.createInitiatingEvent).toBeDefined();
    });
    it("should create a InitiatingEvent", async () => {
      const result = await nestedModelController.createInitiatingEvent(createInitiatingEventObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Initiating Event Model");
      expect(result.label.description).toBe("Description for Initiating Event Model");
    });
  });
  describe("createMarkovChain", () => {
    /**
     * Test if createMarkovChain is defined
     */
    it("createMarkovChain should be defined", () => {
      expect(nestedModelController.createMarkovChain).toBeDefined();
    });
    it("should create a MarkovChain", async () => {
      const result = await nestedModelController.createMarkovChain(createMarkovChainObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Markov Chain Model");
      expect(result.label.description).toBe("Description for Markov Chain Model");
    });
  });

  describe("createWeibullAnalysis", () => {
    /**
     * Test if createWeibullAnalysis is defined
     */
    it("createWeibullAnalysis should be defined", () => {
      expect(nestedModelController.createWeibullAnalysis).toBeDefined();
    });
    it("should create a WeibullAnalysis", async () => {
      const result = await nestedModelController.createWeibullAnalysis(createWeibullAnalysisObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Weibull Analysis Model");
      expect(result.label.description).toBe("Description for Weibull Analysis Model");
    });
  });

  describe("createRiskIntegration", () => {
    /**
     * Test if createRiskIntegration is defined
     */
    it("createRiskIntegration should be defined", () => {
      expect(nestedModelController.createRiskIntegration).toBeDefined();
    });
    it("should create a RiskIntegration", async () => {
      const result = await nestedModelController.createRiskIntegration(createRiskIntegrationObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Risk Integration Model");
      expect(result.label.description).toBe("Description for Risk Integration Model");
    });
  });

  describe("createRadioLogicalConsequenceAnalysis", () => {
    /**
     * Test if createRadioLogicalConsequenceAnalysis is defined
     */
    it("createRadioLogicalConsequenceAnalysis should be defined", () => {
      expect(nestedModelController.createRadiologicalConsequenceAnalysis).toBeDefined();
    });
    it("should create a RadioLogicalConsequenceAnalysis", async () => {
      const result = await nestedModelController.createRadiologicalConsequenceAnalysis(
        createRadiologicalConsequenceAnalysisObject,
      );
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Radiological Consequence Analysis Model");
      expect(result.label.description).toBe("Description for Radiological Consequence Analysis Model");
    });
  });

  describe("createMechanisticSourceTerm", () => {
    /**
     * Test if createMechanisticSourceTerm is defined
     */
    it("createMechanisticSourceTerm should be defined", () => {
      expect(nestedModelController.createMechanisticSourceTerm).toBeDefined();
    });
    it("should create a MechanisticSourceTerm", async () => {
      const result = await nestedModelController.createMechanisticSourceTerm(createMechanisticSourceTermObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Mechanistic Source Term Model");
      expect(result.label.description).toBe("Description for Mechanistic Source Term Model");
    });
  });

  describe("createEventSequenceQuantificationDiagram", () => {
    /**
     * Test if createEventSequenceQuantificationDiagram is defined
     */
    it("createEventSequenceQuantificationDiagram should be defined", () => {
      expect(nestedModelController.createEventSequenceQuantificationDiagram).toBeDefined();
    });
    it("should create a EventSequenceQuantificationDiagram", async () => {
      const result = await nestedModelController.createEventSequenceQuantificationDiagram(
        createEventSequenceQuantificationDiagramObject,
      );
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Event Sequence Quantification Diagram Model");
      expect(result.label.description).toBe("Description for Event Sequence Quantification Diagram Model");
    });
  });

  describe("createDataAnalysis", () => {
    /**
     * Test if createDataAnalysis is defined
     */
    it("createDataAnalysis should be defined", () => {
      expect(nestedModelController.createDataAnalysis).toBeDefined();
    });
    it("should create a DataAnalysis", async () => {
      const result = await nestedModelController.createDataAnalysis(createDataAnalysisObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Data Analysis Model");
      expect(result.label.description).toBe("Description for Data Analysis Model");
    });
  });

  describe("HumanReliabilityAnalysis", () => {
    /**
     * Test if HumanReliabilityAnalysis is defined
     */
    it("HumanReliabilityAnalysis should be defined", () => {
      expect(nestedModelController.createHumanReliabilityAnalysis).toBeDefined();
    });
    it("should create a HumanReliabilityAnalysis", async () => {
      const result = await nestedModelController.createHumanReliabilityAnalysis(createHumanReliabilityAnalysisObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Human Reliability Analysis Model");
      expect(result.label.description).toBe("Description for Human Reliability Analysis Model");
    });
  });

  describe("createSystemsAnalysis", () => {
    /**
     * Test if createSystemAnalysis is defined
     */
    it("createSystemAnalysis should be defined", () => {
      expect(nestedModelController.createSystemsAnalysis).toBeDefined();
    });
    it("should create a SystemAnalysis", async () => {
      const result = await nestedModelController.createSystemsAnalysis(createSystemsAnalysisObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Systems Analysis Model");
      expect(result.label.description).toBe("Description for Systems Analysis Model");
    });
  });

  describe("createSuccessCriteria", () => {
    /**
     * Test if createSuccessCriteria is defined
     */
    it("createSuccessCriteria should be defined", () => {
      expect(nestedModelController.createSuccessCriteria).toBeDefined();
    });
    it("should create a SuccessCriteria", async () => {
      const result = await nestedModelController.createSuccessCriteria(createSuccessCriteriaObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Success Criteria Model");
      expect(result.label.description).toBe("Description for Success Criteria Model");
    });
  });

  describe("createEventSequenceAnalysis", () => {
    /**
     * Test if createEventSequenceAnalysis is defined
     */
    it("createEventSequenceAnalysis should be defined", () => {
      expect(nestedModelController.createEventSequenceAnalysis).toBeDefined();
    });
    it("should create a EventSequenceAnalysis", async () => {
      const result = await nestedModelController.createEventSequenceAnalysis(createEventSequenceAnalysisObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Event Sequence Analysis Model");
      expect(result.label.description).toBe("Description for Event Sequence Analysis Model");
    });
  });

  describe("createOperatingStateAnalysis", () => {
    /**
     * Test if createOperatingStateAnalysis is defined
     */
    it("createOperatingStateAnalysis should be defined", () => {
      expect(nestedModelController.createOperatingStateAnalysis).toBeDefined();
    });
    it("should create a OperatingStateAnalysis", async () => {
      const result = await nestedModelController.createOperatingStateAnalysis(createOperatingStateAnalysisObject);
      expect(result).toHaveProperty("label");
      expect(result).toHaveProperty("id");
      expect(result.label.name).toBe("Operating State Analysis Model");
      expect(result.label.description).toBe("Description for Operating State Analysis Model");
    });
  });

  describe("getSingleBayesianEstimation", () => {
    /**
     * Test if getSingleBayesianEstimation is defined
     */
    it("getSingleBayesianEstimation should be defined", () => {
      expect(nestedModelController.getSingleBayesianEstimation).toBeDefined();
    });
    it("should get a single BayesianEstimation", async () => {
      const result = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const singleResult = await nestedModelController.getSingleBayesianEstimation(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Bayesian Estimation Model");
      expect(singleResult.label.description).toBe("Description for Bayesian Estimation Model");
    });
  });

  describe("getSingleBayesianNetwork", () => {
    /**
     * Test if getSingleBayesianNetwork is defined
     */
    it("getSingleBayesianNetwork should be defined", () => {
      expect(nestedModelController.getSingleBayesianNetwork).toBeDefined();
    });
    it("should get a single BayesianNetwork", async () => {
      const result = await nestedModelController.createBayesianNetwowrk(createBayesianNetworkObject);
      const singleResult = await nestedModelController.getSingleBayesianNetwork(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Bayesian Network Model");
      expect(singleResult.label.description).toBe("Description for Bayesian Network Model");
    });
  });

  describe("getSingleEventSequenceDiagram", () => {
    /**
     * Test if getSingleEventSequenceDiagram is defined
     */
    it("getSingleEventSequenceDiagram should be defined", () => {
      expect(nestedModelController.getSingleEventSequenceDiagram).toBeDefined();
    });
    it("should get a single EventSequenceDiagram", async () => {
      const result = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      const singleResult = await nestedModelController.getSingleEventSequenceDiagram(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Diagram Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Diagram Model");
    });
  });

  describe("getSingleEventTree", () => {
    /**
     * Test if getSingleEventTree is defined
     */
    it("getSingleEventTree should be defined", () => {
      expect(nestedModelController.getSingleEventTree).toBeDefined();
    });
    it("should get a single EventTree", async () => {
      const result = await nestedModelController.createEventTree(createEventTreeObject);
      const singleResult = await nestedModelController.getSingleEventTree(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Tree Model");
      expect(singleResult.label.description).toBe("Description for Event Tree Model");
    });
  });

  describe("getSingleFaultTree", () => {
    /**
     * Test if getSingleFaultTree is defined
     */
    it("getSingleFaultTree should be defined", () => {
      expect(nestedModelController.getSingleFaultTree).toBeDefined();
    });
    it("should get a single FaultTree", async () => {
      const result = await nestedModelController.createFaultTree(createFaultTreeObject);
      const singleResult = await nestedModelController.getSingleFaultTree(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Fault Tree Model");
      expect(singleResult.label.description).toBe("Description for Fault Tree Model");
    });
  });

  describe("getSingleFunctionalEvent", () => {
    /**
     * Test if getSingleFunctionalEvent is defined
     */
    it("getSingleFunctionalEvent should be defined", () => {
      expect(nestedModelController.getSingleFunctionalEvent).toBeDefined();
    });
    it("should get a single FunctionalEvent", async () => {
      const result = await nestedModelController.createFunctionalEvent(createFunctionalEventObject);
      const singleResult = await nestedModelController.getSingleFunctionalEvent(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Functional Event Model");
      expect(singleResult.label.description).toBe("Description for Functional Event Model");
    });
  });

  describe("getSingleInitiatingEvent", () => {
    /**
     * Test if getSingleInitiatingEvent is defined
     */
    it("getSingleInitiatingEvent should be defined", () => {
      expect(nestedModelController.getSingleInitiatingEvent).toBeDefined();
    });
    it("should get a single InitiatingEvent", async () => {
      const result = await nestedModelController.createInitiatingEvent(createInitiatingEventObject);
      const singleResult = await nestedModelController.getSingleInitiatingEvent(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Initiating Event Model");
      expect(singleResult.label.description).toBe("Description for Initiating Event Model");
    });
  });

  describe("getSingleMarkovChain", () => {
    /**
     * Test if getSingleMarkovChain is defined
     */
    it("getSingleMarkovChain should be defined", () => {
      expect(nestedModelController.getSingleMarkovChain).toBeDefined();
    });
    it("should get a single MarkovChain", async () => {
      const result = await nestedModelController.createMarkovChain(createMarkovChainObject);
      const singleResult = await nestedModelController.getSingleMarkovChain(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Markov Chain Model");
      expect(singleResult.label.description).toBe("Description for Markov Chain Model");
    });
  });

  describe("getSingleWeibullAnalysis", () => {
    /**
     * Test if getSingleWeibullAnalysis is defined
     */
    it("getSingleWeibullAnalysis should be defined", () => {
      expect(nestedModelController.getSingleWeibullAnalysis).toBeDefined();
    });
    it("should get a single WeibullAnalysis", async () => {
      const result = await nestedModelController.createWeibullAnalysis(createWeibullAnalysisObject);
      const singleResult = await nestedModelController.getSingleWeibullAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Weibull Analysis Model");
      expect(singleResult.label.description).toBe("Description for Weibull Analysis Model");
    });
  });

  describe("getSingleRiskIntegration", () => {
    /**
     * Test if getSingleRiskIntegration is defined
     */
    it("getSingleRiskIntegration should be defined", () => {
      expect(nestedModelController.getSingleRiskIntegration).toBeDefined();
    });
    it("should get a single RiskIntegration", async () => {
      const result = await nestedModelController.createRiskIntegration(createRiskIntegrationObject);
      const singleResult = await nestedModelController.getSingleRiskIntegration(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Risk Integration Model");
      expect(singleResult.label.description).toBe("Description for Risk Integration Model");
    });
  });

  describe("getSingleRadioLogicalConsequenceAnalysis", () => {
    /**
     * Test if getSingleRadioLogicalConsequenceAnalysis is defined
     */
    it("getSingleRadioLogicalConsequenceAnalysis should be defined", () => {
      expect(nestedModelController.getSingleRadiologicalConsequenceAnalysis).toBeDefined();
    });
    it("should get a single RadioLogicalConsequenceAnalysis", async () => {
      const result = await nestedModelController.createRadiologicalConsequenceAnalysis(
        createRadiologicalConsequenceAnalysisObject,
      );
      const singleResult = await nestedModelController.getSingleRadiologicalConsequenceAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Radiological Consequence Analysis Model");
      expect(singleResult.label.description).toBe("Description for Radiological Consequence Analysis Model");
    });
  });

  describe("getSingleMechanisticSourceTerm", () => {
    /**
     * Test if getSingleMechanisticSourceTerm is defined
     */
    it("getSingleMechanisticSourceTerm should be defined", () => {
      expect(nestedModelController.getSingleMechanisticSourceTerm).toBeDefined();
    });
    it("should get a single MechanisticSourceTerm", async () => {
      const result = await nestedModelController.createMechanisticSourceTerm(createMechanisticSourceTermObject);
      const singleResult = await nestedModelController.getSingleMechanisticSourceTerm(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Mechanistic Source Term Model");
      expect(singleResult.label.description).toBe("Description for Mechanistic Source Term Model");
    });
  });

  describe("getSingleEventSequenceQuantificationDiagram", () => {
    /**
     * Test if getSingleEventSequenceQuantificationDiagram is defined
     */
    it("getSingleEventSequenceQuantificationDiagram should be defined", () => {
      expect(nestedModelController.getSingleEventSequenceQuantificationDiagram).toBeDefined();
    });
    it("should get a single EventSequenceQuantificationDiagram", async () => {
      const result = await nestedModelController.createEventSequenceQuantificationDiagram(
        createEventSequenceQuantificationDiagramObject,
      );
      const singleResult = await nestedModelController.getSingleEventSequenceQuantificationDiagram(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Quantification Diagram Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Quantification Diagram Model");
    });
  });

  describe("getSingleDataAnalysis", () => {
    /**
     * Test if getSingleDataAnalysis is defined
     */
    it("getSingleDataAnalysis should be defined", () => {
      expect(nestedModelController.getSingleDataAnalysis).toBeDefined();
    });
    it("should get a single DataAnalysis", async () => {
      const result = await nestedModelController.createDataAnalysis(createDataAnalysisObject);
      const singleResult = await nestedModelController.getSingleDataAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Data Analysis Model");
      expect(singleResult.label.description).toBe("Description for Data Analysis Model");
    });
  });

  describe("getSingleHumanReliabilityAnalysis", () => {
    /**
     * Test if getSingleHumanReliabilityAnalysis is defined
     */
    it("getSingleHumanReliabilityAnalysis should be defined", () => {
      expect(nestedModelController.getSingleHumanReliabilityAnalysis).toBeDefined();
    });
    it("should get a single HumanReliabilityAnalysis", async () => {
      const result = await nestedModelController.createHumanReliabilityAnalysis(createHumanReliabilityAnalysisObject);
      const singleResult = await nestedModelController.getSingleHumanReliabilityAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Human Reliability Analysis Model");
      expect(singleResult.label.description).toBe("Description for Human Reliability Analysis Model");
    });
  });

  describe("getSingleSystemsAnalysis", () => {
    /**
     * Test if getSingleSystemsAnalysis is defined
     */
    it("getSingleSystemsAnalysis should be defined", () => {
      expect(nestedModelController.getSingleSystemsAnalysis).toBeDefined();
    });
    it("should get a single SystemsAnalysis", async () => {
      const result = await nestedModelController.createSystemsAnalysis(createSystemsAnalysisObject);
      const singleResult = await nestedModelController.getSingleSystemsAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Systems Analysis Model");
      expect(singleResult.label.description).toBe("Description for Systems Analysis Model");
    });
  });

  describe("getSingleSuccessCriteria", () => {
    /**
     * Test if getSingleSuccessCriteria is defined
     */
    it("getSingleSuccessCriteria should be defined", () => {
      expect(nestedModelController.getSingleSuccessCriteria).toBeDefined();
    });
    it("should get a single SuccessCriteria", async () => {
      const result = await nestedModelController.createSuccessCriteria(createSuccessCriteriaObject);
      const singleResult = await nestedModelController.getSingleSuccessCriteria(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Success Criteria Model");
      expect(singleResult.label.description).toBe("Description for Success Criteria Model");
    });
  });

  describe("getSingleEventSequenceAnalysis", () => {
    /**
     * Test if getSingleEventSequenceAnalysis is defined
     */
    it("getSingleEventSequenceAnalysis should be defined", () => {
      expect(nestedModelController.getSingleEventSequenceAnalysis).toBeDefined();
    });
    it("should get a single EventSequenceAnalysis", async () => {
      const result = await nestedModelController.createEventSequenceAnalysis(createEventSequenceAnalysisObject);
      const singleResult = await nestedModelController.getSingleEventSequenceAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Analysis Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Analysis Model");
    });
  });

  describe("getSingleOperatingStateAnalysis", () => {
    /**
     * Test if getSingleOperatingStateAnalysis is defined
     */
    it("getSingleOperatingStateAnalysis should be defined", () => {
      expect(nestedModelController.getSingleOperatingStateAnalysis).toBeDefined();
    });
    it("should get a single OperatingStateAnalysis", async () => {
      const result = await nestedModelController.createOperatingStateAnalysis(createOperatingStateAnalysisObject);
      const singleResult = await nestedModelController.getSingleOperatingStateAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Operating State Analysis Model");
      expect(singleResult.label.description).toBe("Description for Operating State Analysis Model");
    });
  });

  describe("deleteBayesianEstimation", () => {
    /**
     * Test if deleteBayesianEstimation is defined
     */
    it("deleteBayesianEstimation should be defined", () => {
      expect(nestedModelController.deleteBayesianEstimation).toBeDefined();
    });
    it("should delete a BayesianEstimation", async () => {
      const result = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const singleResult = await nestedModelController.deleteBayesianEstimation(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Bayesian Estimation Model");
      expect(singleResult.label.description).toBe("Description for Bayesian Estimation Model");
      const returnedBayesianEstimation = await nestedModelController.getSingleBayesianEstimation(result.id);
      expect(returnedBayesianEstimation).toBe(null);
    });
  });

  describe("deleteBayesianNetwork", () => {
    /**
     * Test if deleteBayesianNetwork is defined
     */
    it("deleteBayesianNetwork should be defined", () => {
      expect(nestedModelController.deleteBayesianNetwork).toBeDefined();
    });
    it("should delete a BayesianNetwork", async () => {
      const result = await nestedModelController.createBayesianNetwowrk(createBayesianNetworkObject);
      const singleResult = await nestedModelController.deleteBayesianNetwork(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Bayesian Network Model");
      expect(singleResult.label.description).toBe("Description for Bayesian Network Model");
      const returnedBayesianNetwork = await nestedModelController.getSingleBayesianNetwork(result.id);
      expect(returnedBayesianNetwork).toBe(null);
    });
  });

  describe("deleteEventSequenceDiagram", () => {
    /**
     * Test if deleteEventSequenceDiagram is defined
     */
    it("deleteEventSequenceDiagram should be defined", () => {
      expect(nestedModelController.deleteEventSequenceDiagram).toBeDefined();
    });
    it("should delete a EventSequenceDiagram", async () => {
      const result = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      const singleResult = await nestedModelController.deleteEventSequenceDiagram(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Diagram Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Diagram Model");
      const returnedEventSequenceDiagram = await nestedModelController.getSingleEventSequenceDiagram(result.id);
      expect(returnedEventSequenceDiagram).toBe(null);
    });
  });

  describe("deleteEventTree", () => {
    /**
     * Test if deleteEventTree is defined
     */
    it("deleteEventTree should be defined", () => {
      expect(nestedModelController.deleteEventTree).toBeDefined();
    });
    it("should delete a EventTree", async () => {
      const result = await nestedModelController.createEventTree(createEventTreeObject);
      const singleResult = await nestedModelController.deleteEventTree(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Tree Model");
      expect(singleResult.label.description).toBe("Description for Event Tree Model");
      const returnedEventTree = await nestedModelController.getSingleEventTree(result.id);
      expect(returnedEventTree).toBe(null);
    });
  });
  describe("deleteFaultTree", () => {
    /**
     * Test if deleteFaultTree is defined
     */
    it("deleteFaultTree should be defined", () => {
      expect(nestedModelController.deleteFaultTree).toBeDefined();
    });
    it("should delete a FaultTree", async () => {
      const result = await nestedModelController.createFaultTree(createFaultTreeObject);
      const singleResult = await nestedModelController.deleteFaultTree(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Fault Tree Model");
      expect(singleResult.label.description).toBe("Description for Fault Tree Model");
      const returnedFaultTree = await nestedModelController.getSingleFaultTree(result.id);
      expect(returnedFaultTree).toBe(null);
    });
  });
  describe("deleteFunctionalEvent", () => {
    /**
     * Test if deleteFunctionalEvent is defined
     */
    it("deleteFunctionalEvent should be defined", () => {
      expect(nestedModelController.deleteFunctionalEvent).toBeDefined();
    });
    it("should delete a FunctionalEvent", async () => {
      const result = await nestedModelController.createFunctionalEvent(createFunctionalEventObject);
      const singleResult = await nestedModelController.deleteFunctionalEvent(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Functional Event Model");
      expect(singleResult.label.description).toBe("Description for Functional Event Model");
      const returnedFunctionalEvent = await nestedModelController.getSingleFunctionalEvent(result.id);
      expect(returnedFunctionalEvent).toBe(null);
    });
  });
  describe("deleteInitiatingEvent", () => {
    /**
     * Test if deleteInitiatingEvent is defined
     */
    it("deleteInitiatingEvent should be defined", () => {
      expect(nestedModelController.deleteInitiatingEvent).toBeDefined();
    });
    it("should delete a InitiatingEvent", async () => {
      const result = await nestedModelController.createInitiatingEvent(createInitiatingEventObject);
      const singleResult = await nestedModelController.deleteInitiatingEvent(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Initiating Event Model");
      expect(singleResult.label.description).toBe("Description for Initiating Event Model");
      const returnedInitiatingEvent = await nestedModelController.getSingleInitiatingEvent(result.id);
      expect(returnedInitiatingEvent).toBe(null);
    });
  });
  describe("deleteMarkovChain", () => {
    /**
     * Test if deleteMarkovChain is defined
     */
    it("deleteMarkovChain should be defined", () => {
      expect(nestedModelController.deleteMarkovChain).toBeDefined();
    });
    it("should delete a MarkovChain", async () => {
      const result = await nestedModelController.createMarkovChain(createMarkovChainObject);
      const singleResult = await nestedModelController.deleteMarkovChain(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Markov Chain Model");
      expect(singleResult.label.description).toBe("Description for Markov Chain Model");
      const returnedMarkovChain = await nestedModelController.getSingleMarkovChain(result.id);
      expect(returnedMarkovChain).toBe(null);
    });
  });
  describe("deleteWeibullAnalysis", () => {
    /**
     * Test if deleteWeibullAnalysis is defined
     */
    it("deleteWeibullAnalysis should be defined", () => {
      expect(nestedModelController.deleteWeibullAnalysis).toBeDefined();
    });
    it("should delete a WeibullAnalysis", async () => {
      const result = await nestedModelController.createWeibullAnalysis(createWeibullAnalysisObject);
      const singleResult = await nestedModelController.deleteWeibullAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Weibull Analysis Model");
      expect(singleResult.label.description).toBe("Description for Weibull Analysis Model");
      const returnedWeibullAnalysis = await nestedModelController.getSingleWeibullAnalysis(result.id);
      expect(returnedWeibullAnalysis).toBe(null);
    });
  });
  describe("deleteRiskIntegration", () => {
    /**
     * Test if deleteRiskIntegration is defined
     */
    it("deleteRiskIntegration should be defined", () => {
      expect(nestedModelController.deleteRiskIntegration).toBeDefined();
    });
    it("should delete a RiskIntegration", async () => {
      const result = await nestedModelController.createRiskIntegration(createRiskIntegrationObject);
      const singleResult = await nestedModelController.deleteRiskIntegration(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Risk Integration Model");
      expect(singleResult.label.description).toBe("Description for Risk Integration Model");
      const returnedRiskIntegration = await nestedModelController.getSingleRiskIntegration(result.id);
      expect(returnedRiskIntegration).toBe(null);
    });
  });
  describe("deleteRadioLogicalConsequenceAnalysis", () => {
    /**
     * Test if deleteRadioLogicalConsequenceAnalysis is defined
     */
    it("deleteRadioLogicalConsequenceAnalysis should be defined", () => {
      expect(nestedModelController.deleteRadiologicalConsequenceAnalysis).toBeDefined();
    });
    it("should delete a RadioLogicalConsequenceAnalysis", async () => {
      const result = await nestedModelController.createRadiologicalConsequenceAnalysis(
        createRadiologicalConsequenceAnalysisObject,
      );
      const singleResult = await nestedModelController.deleteRadiologicalConsequenceAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Radiological Consequence Analysis Model");
      expect(singleResult.label.description).toBe("Description for Radiological Consequence Analysis Model");
      const returnedRadioLogicalConsequenceAnalysis =
        await nestedModelController.getSingleRadiologicalConsequenceAnalysis(result.id);
      expect(returnedRadioLogicalConsequenceAnalysis).toBe(null);
    });
  });
  describe("deleteMechanisticSourceTerm", () => {
    /**
     * Test if deleteMechanisticSourceTerm is defined
     */
    it("deleteMechanisticSourceTerm should be defined", () => {
      expect(nestedModelController.deleteMechanisticSourceTerm).toBeDefined();
    });
    it("should delete a MechanisticSourceTerm", async () => {
      const result = await nestedModelController.createMechanisticSourceTerm(createMechanisticSourceTermObject);
      const singleResult = await nestedModelController.deleteMechanisticSourceTerm(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Mechanistic Source Term Model");
      expect(singleResult.label.description).toBe("Description for Mechanistic Source Term Model");
      const returnedMechanisticSourceTerm = await nestedModelController.getSingleMechanisticSourceTerm(result.id);
      expect(returnedMechanisticSourceTerm).toBe(null);
    });
  });
  describe("deleteEventSequenceQuantificationDiagram", () => {
    /**
     * Test if deleteEventSequenceQuantificationDiagram is defined
     */
    it("deleteEventSequenceQuantificationDiagram should be defined", () => {
      expect(nestedModelController.deleteEventSequenceQuantificationDiagram).toBeDefined();
    });
    it("should delete a EventSequenceQuantificationDiagram", async () => {
      const result = await nestedModelController.createEventSequenceQuantificationDiagram(
        createEventSequenceQuantificationDiagramObject,
      );
      const singleResult = await nestedModelController.deleteEventSequenceQuantificationDiagram(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Quantification Diagram Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Quantification Diagram Model");
      const returnedEventSequenceQuantificationDiagram =
        await nestedModelController.getSingleEventSequenceQuantificationDiagram(result.id);
      expect(returnedEventSequenceQuantificationDiagram).toBe(null);
    });
  });
  describe("deleteDataAnalysis", () => {
    /**
     * Test if deleteDataAnalysis is defined
     */
    it("deleteDataAnalysis should be defined", () => {
      expect(nestedModelController.deleteDataAnalysis).toBeDefined();
    });
    it("should delete a DataAnalysis", async () => {
      const result = await nestedModelController.createDataAnalysis(createDataAnalysisObject);
      const singleResult = await nestedModelController.deleteDataAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Data Analysis Model");
      expect(singleResult.label.description).toBe("Description for Data Analysis Model");
      const returnedDataAnalysis = await nestedModelController.getSingleDataAnalysis(result.id);
      expect(returnedDataAnalysis).toBe(null);
    });
  });
  describe("deleteHumanReliabilityAnalysis", () => {
    /**
     * Test if deleteHumanReliabilityAnalysis is defined
     */
    it("deleteHumanReliabilityAnalysis should be defined", () => {
      expect(nestedModelController.deleteHumanReliabilityAnalysis).toBeDefined();
    });
    it("should delete a HumanReliabilityAnalysis", async () => {
      const result = await nestedModelController.createHumanReliabilityAnalysis(createHumanReliabilityAnalysisObject);
      const singleResult = await nestedModelController.deleteHumanReliabilityAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Human Reliability Analysis Model");
      expect(singleResult.label.description).toBe("Description for Human Reliability Analysis Model");
      const returnedHumanReliabilityAnalysis = await nestedModelController.getSingleHumanReliabilityAnalysis(result.id);
      expect(returnedHumanReliabilityAnalysis).toBe(null);
    });
  });
  describe("deleteSystemsAnalysis", () => {
    /**
     * Test if deleteSystemsAnalysis is defined
     */
    it("deleteSystemsAnalysis should be defined", () => {
      expect(nestedModelController.deleteSystemsAnalysis).toBeDefined();
    });
    it("should delete a SystemsAnalysis", async () => {
      const result = await nestedModelController.createSystemsAnalysis(createSystemsAnalysisObject);
      const singleResult = await nestedModelController.deleteSystemsAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Systems Analysis Model");
      expect(singleResult.label.description).toBe("Description for Systems Analysis Model");
      const returnedSystemsAnalysis = await nestedModelController.getSingleSystemsAnalysis(result.id);
      expect(returnedSystemsAnalysis).toBe(null);
    });
  });
  describe("deleteSuccessCriteria", () => {
    /**
     * Test if deleteSuccessCriteria is defined
     */
    it("deleteSuccessCriteria should be defined", () => {
      expect(nestedModelController.deleteSuccessCriteria).toBeDefined();
    });
    it("should delete a SuccessCriteria", async () => {
      const result = await nestedModelController.createSuccessCriteria(createSuccessCriteriaObject);
      const singleResult = await nestedModelController.deleteSuccessCriteria(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Success Criteria Model");
      expect(singleResult.label.description).toBe("Description for Success Criteria Model");
      const returnedSuccessCriteria = await nestedModelController.getSingleSuccessCriteria(result.id);
      expect(returnedSuccessCriteria).toBe(null);
    });
  });
  describe("deleteEventSequenceAnalysis", () => {
    /**
     * Test if deleteEventSequenceAnalysis is defined
     */
    it("deleteEventSequenceAnalysis should be defined", () => {
      expect(nestedModelController.deleteEventSequenceAnalysis).toBeDefined();
    });
    it("should delete a EventSequenceAnalysis", async () => {
      const result = await nestedModelController.createEventSequenceAnalysis(createEventSequenceAnalysisObject);
      const singleResult = await nestedModelController.deleteEventSequenceAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Analysis Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Analysis Model");
      const returnedEventSequenceAnalysis = await nestedModelController.getSingleEventSequenceAnalysis(result.id);
      expect(returnedEventSequenceAnalysis).toBe(null);
    });
  });
  describe("deleteOperatingStateAnalysis", () => {
    /**
     * Test if deleteOperatingStateAnalysis is defined
     */
    it("deleteOperatingStateAnalysis should be defined", () => {
      expect(nestedModelController.deleteOperatingStateAnalysis).toBeDefined();
    });
    it("should delete a OperatingStateAnalysis", async () => {
      const result = await nestedModelController.createOperatingStateAnalysis(createOperatingStateAnalysisObject);
      const singleResult = await nestedModelController.deleteOperatingStateAnalysis(result.id);
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Operating State Analysis Model");
      expect(singleResult.label.description).toBe("Description for Operating State Analysis Model");
      const returnedOperatingStateAnalysis = await nestedModelController.getSingleOperatingStateAnalysis(result.id);
      expect(returnedOperatingStateAnalysis).toBe(null);
    });
  });

  describe("updateBayesianEstimationLabel", () => {
    /**
     * Test if updateBayesianEstimationLabel is defined
     */
    it("updateBayesianEstimationLabel should be defined", () => {
      expect(nestedModelController.updateBayesianEstimationLabel).toBeDefined();
    });
    it("should update a BayesianEstimation label", async () => {
      const result = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const updateLabelObject = {
        name: "Updated Bayesian Estimation Model",
        description: "Updated Description for Bayesian Estimation Model",
      };
      const updatedLabel = await nestedModelController.updateBayesianEstimationLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Bayesian Estimation Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Bayesian Estimation Model");
    });
  });
  describe("updateBayesianNetworkLabel", () => {
    /**
     * Test if updateBayesianNetworkLabel is defined
     */
    it("updateBayesianNetworkLabel should be defined", () => {
      expect(nestedModelController.updateBayesianNetworkLabel).toBeDefined();
    });
    it("should update a BayesianNetwork label", async () => {
      const result = await nestedModelController.createBayesianNetwowrk(createBayesianNetworkObject);
      const updateLabelObject = {
        name: "Updated Bayesian Network Model",
        description: "Updated Description for Bayesian Network Model",
      };
      const updatedLabel = await nestedModelController.updateBayesianNetworkLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Bayesian Network Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Bayesian Network Model");
    });
  });
  describe("updateEventSequenceDiagramLabel", () => {
    /**
     * Test if updateEventSequenceDiagramLabel is defined
     */
    it("updateEventSequenceDiagramLabel should be defined", () => {
      expect(nestedModelController.updateEventSequenceDiagramLabel).toBeDefined();
    });
    it("should update a EventSequenceDiagram label", async () => {
      const result = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      const updateLabelObject = {
        name: "Updated Event Sequence Diagram Model",
        description: "Updated Description for Event Sequence Diagram Model",
      };
      const updatedLabel = await nestedModelController.updateEventSequenceDiagramLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Event Sequence Diagram Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Event Sequence Diagram Model");
    });
  });
  describe("updateEventTreeLabel", () => {
    /**
     * Test if updateEventTreeLabel is defined
     */
    it("updateEventTreeLabel should be defined", () => {
      expect(nestedModelController.updateEventTreeLabel).toBeDefined();
    });
    it("should update a EventTree label", async () => {
      const result = await nestedModelController.createEventTree(createEventTreeObject);
      const updateLabelObject = {
        name: "Updated Event Tree Model",
        description: "Updated Description for Event Tree Model",
      };
      const updatedLabel = await nestedModelController.updateEventTreeLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Event Tree Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Event Tree Model");
    });
  });
  describe("updateFaultTreeLabel", () => {
    /**
     * Test if updateFaultTreeLabel is defined
     */
    it("updateFaultTreeLabel should be defined", () => {
      expect(nestedModelController.updateFaultTreeLabel).toBeDefined();
    });
    it("should update a FaultTree label", async () => {
      const result = await nestedModelController.createFaultTree(createFaultTreeObject);
      const updateLabelObject = {
        name: "Updated Fault Tree Model",
        description: "Updated Description for Fault Tree Model",
      };
      const updatedLabel = await nestedModelController.updateFaultTreeLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Fault Tree Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Fault Tree Model");
    });
  });
  describe("updateFunctionalEventLabel", () => {
    /**
     * Test if updateFunctionalEventLabel is defined
     */
    it("updateFunctionalEventLabel should be defined", () => {
      expect(nestedModelController.updateFunctionalEventLabel).toBeDefined();
    });
    it("should update a FunctionalEvent label", async () => {
      const result = await nestedModelController.createFunctionalEvent(createFunctionalEventObject);
      const updateLabelObject = {
        name: "Updated Functional Event Model",
        description: "Updated Description for Functional Event Model",
      };
      const updatedLabel = await nestedModelController.updateFunctionalEventLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Functional Event Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Functional Event Model");
    });
  });
  describe("updateInitiatingEventLabel", () => {
    /**
     * Test if updateInitiatingEventLabel is defined
     */
    it("updateInitiatingEventLabel should be defined", () => {
      expect(nestedModelController.updateInitiatingEventLabel).toBeDefined();
    });
    it("should update a InitiatingEvent label", async () => {
      const result = await nestedModelController.createInitiatingEvent(createInitiatingEventObject);
      const updateLabelObject = {
        name: "Updated Initiating Event Model",
        description: "Updated Description for Initiating Event Model",
      };
      const updatedLabel = await nestedModelController.updateInitiatingEventLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Initiating Event Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Initiating Event Model");
    });
  });
  describe("updateMarkovChainLabel", () => {
    /**
     * Test if updateMarkovChainLabel is defined
     */
    it("updateMarkovChainLabel should be defined", () => {
      expect(nestedModelController.updateMarkovChainLabel).toBeDefined();
    });
    it("should update a MarkovChain label", async () => {
      const result = await nestedModelController.createMarkovChain(createMarkovChainObject);
      const updateLabelObject = {
        name: "Updated Markov Chain Model",
        description: "Updated Description for Markov Chain Model",
      };
      const updatedLabel = await nestedModelController.updateMarkovChainLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Markov Chain Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Markov Chain Model");
    });
  });
  describe("updateWeibullAnalysisLabel", () => {
    /**
     * Test if updateWeibullAnalysisLabel is defined
     */
    it("updateWeibullAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateWeibullAnalysisLabel).toBeDefined();
    });
    it("should update a WeibullAnalysis label", async () => {
      const result = await nestedModelController.createWeibullAnalysis(createWeibullAnalysisObject);
      const updateLabelObject = {
        name: "Updated Weibull Analysis Model",
        description: "Updated Description for Weibull Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateWeibullAnalysisLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Weibull Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Weibull Analysis Model");
    });
  });
  describe("updateRiskIntegrationLabel", () => {
    /**
     * Test if updateRiskIntegrationLabel is defined
     */
    it("updateRiskIntegrationLabel should be defined", () => {
      expect(nestedModelController.updateRiskIntegrationLabel).toBeDefined();
    });
    it("should update a RiskIntegration label", async () => {
      const result = await nestedModelController.createRiskIntegration(createRiskIntegrationObject);
      const updateLabelObject = {
        name: "Updated Risk Integration Model",
        description: "Updated Description for Risk Integration Model",
      };
      const updatedLabel = await nestedModelController.updateRiskIntegrationLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Risk Integration Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Risk Integration Model");
    });
  });
  describe("updateRadioLogicalConsequenceAnalysisLabel", () => {
    /**
     * Test if updateRadioLogicalConsequenceAnalysisLabel is defined
     */
    it("updateRadioLogicalConsequenceAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateRadiologicalConsequenceAnalysisLabel).toBeDefined();
    });
    it("should update a RadioLogicalConsequenceAnalysis label", async () => {
      const result = await nestedModelController.createRadiologicalConsequenceAnalysis(
        createRadiologicalConsequenceAnalysisObject,
      );
      const updateLabelObject = {
        name: "Updated Radiological Consequence Analysis Model",
        description: "Updated Description for Radiological Consequence Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateRadiologicalConsequenceAnalysisLabel(
        result.id,
        updateLabelObject,
      );
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Radiological Consequence Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Radiological Consequence Analysis Model");
    });
  });
  describe("updateMechanisticSourceTermLabel", () => {
    /**
     * Test if updateMechanisticSourceTermLabel is defined
     */
    it("updateMechanisticSourceTermLabel should be defined", () => {
      expect(nestedModelController.updateMechanisticSourceTermLabel).toBeDefined();
    });
    it("should update a MechanisticSourceTerm label", async () => {
      const result = await nestedModelController.createMechanisticSourceTerm(createMechanisticSourceTermObject);
      const updateLabelObject = {
        name: "Updated Mechanistic Source Term Model",
        description: "Updated Description for Mechanistic Source Term Model",
      };
      const updatedLabel = await nestedModelController.updateMechanisticSourceTermLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Mechanistic Source Term Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Mechanistic Source Term Model");
    });
  });
  describe("updateEventSequenceQuantificationDiagramLabel", () => {
    /**
     * Test if updateEventSequenceQuantificationDiagramLabel is defined
     */
    it("updateEventSequenceQuantificationDiagramLabel should be defined", () => {
      expect(nestedModelController.updateEventSequenceQuantificationDiagramLabel).toBeDefined();
    });
    it("should update a EventSequenceQuantificationDiagram label", async () => {
      const result = await nestedModelController.createEventSequenceQuantificationDiagram(
        createEventSequenceQuantificationDiagramObject,
      );
      const updateLabelObject = {
        name: "Updated Event Sequence Quantification Diagram Model",
        description: "Updated Description for Event Sequence Quantification Diagram Model",
      };
      const updatedLabel = await nestedModelController.updateEventSequenceQuantificationDiagramLabel(
        result.id,
        updateLabelObject,
      );
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Event Sequence Quantification Diagram Model");
      expect(updatedLabel.label.description).toBe(
        "Updated Description for Event Sequence Quantification Diagram Model",
      );
    });
  });
  describe("updateDataAnalysisLabel", () => {
    /**
     * Test if updateDataAnalysisLabel is defined
     */
    it("updateDataAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateDataAnalysisLabel).toBeDefined();
    });
    it("should update a DataAnalysis label", async () => {
      const result = await nestedModelController.createDataAnalysis(createDataAnalysisObject);
      const updateLabelObject = {
        name: "Updated Data Analysis Model",
        description: "Updated Description for Data Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateDataAnalysisLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Data Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Data Analysis Model");
    });
  });
  describe("updateHumanReliabilityAnalysisLabel", () => {
    /**
     * Test if updateHumanReliabilityAnalysisLabel is defined
     */
    it("updateHumanReliabilityAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateHumanReliabilityAnalysisLabel).toBeDefined();
    });
    it("should update a HumanReliabilityAnalysis label", async () => {
      const result = await nestedModelController.createHumanReliabilityAnalysis(createHumanReliabilityAnalysisObject);
      const updateLabelObject = {
        name: "Updated Human Reliability Analysis Model",
        description: "Updated Description for Human Reliability Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateHumanReliabilityAnalysisLabel(
        result.id,
        updateLabelObject,
      );
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Human Reliability Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Human Reliability Analysis Model");
    });
  });
  describe("updateSystemsAnalysisLabel", () => {
    /**
     * Test if updateSystemsAnalysisLabel is defined
     */
    it("updateSystemsAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateSystemsAnalysisLabel).toBeDefined();
    });
    it("should update a SystemsAnalysis label", async () => {
      const result = await nestedModelController.createSystemsAnalysis(createSystemsAnalysisObject);
      const updateLabelObject = {
        name: "Updated Systems Analysis Model",
        description: "Updated Description for Systems Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateSystemsAnalysisLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Systems Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Systems Analysis Model");
    });
  });
  describe("updateSuccessCriteriaLabel", () => {
    /**
     * Test if updateSuccessCriteriaLabel is defined
     */
    it("updateSuccessCriteriaLabel should be defined", () => {
      expect(nestedModelController.updateSuccessCriteriaLabel).toBeDefined();
    });
    it("should update a SuccessCriteria label", async () => {
      const result = await nestedModelController.createSuccessCriteria(createSuccessCriteriaObject);
      const updateLabelObject = {
        name: "Updated Success Criteria Model",
        description: "Updated Description for Success Criteria Model",
      };
      const updatedLabel = await nestedModelController.updateSuccessCriteriaLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Success Criteria Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Success Criteria Model");
    });
  });
  describe("updateEventSequenceAnalysisLabel", () => {
    /**
     * Test if updateEventSequenceAnalysisLabel is defined
     */
    it("updateEventSequenceAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateEventSequenceAnalysisLabel).toBeDefined();
    });
    it("should update a EventSequenceAnalysis label", async () => {
      const result = await nestedModelController.createEventSequenceAnalysis(createEventSequenceAnalysisObject);
      const updateLabelObject = {
        name: "Updated Event Sequence Analysis Model",
        description: "Updated Description for Event Sequence Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateEventSequenceAnalysisLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Event Sequence Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Event Sequence Analysis Model");
    });
  });
  describe("updateOperatingStateAnalysisLabel", () => {
    /**
     * Test if updateOperatingStateAnalysisLabel is defined
     */
    it("updateOperatingStateAnalysisLabel should be defined", () => {
      expect(nestedModelController.updateOperatingStateAnalysisLabel).toBeDefined();
    });
    it("should update a OperatingStateAnalysis label", async () => {
      const result = await nestedModelController.createOperatingStateAnalysis(createOperatingStateAnalysisObject);
      const updateLabelObject = {
        name: "Updated Operating State Analysis Model",
        description: "Updated Description for Operating State Analysis Model",
      };
      const updatedLabel = await nestedModelController.updateOperatingStateAnalysisLabel(result.id, updateLabelObject);
      expect(updatedLabel).toHaveProperty("label");
      expect(updatedLabel).toHaveProperty("id");
      expect(updatedLabel.label.name).toBe("Updated Operating State Analysis Model");
      expect(updatedLabel.label.description).toBe("Updated Description for Operating State Analysis Model");
    });
  });

  describe("removeParentIds", () => {
    /**
     * Test if removeParentIds is defined
     */
    it("removeParentIds should be defined", () => {
      expect(nestedModelController.removeParentIds).toBeDefined();
    });
    it("should remove model if only one parent ID present", async () => {
      const result1 = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      createEventSequenceDiagramObject.parentIds = [result1.id];
      const result2 = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      delete createEventSequenceDiagramObject.parentIds;
      const numDeleted = await nestedModelController.removeParentIds(result1.id);
      expect(numDeleted).toBe(1);
      const returnedEventSequenceDiagram = await nestedModelController.getSingleEventSequenceDiagram(result2.id);
      expect(returnedEventSequenceDiagram).toBe(null);
    });
    it("should not remove model if multiple parent IDs present", async () => {
      //create bayesian estimation model and event sequence diagram model
      const result1 = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const result2 = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      //add bayesian estimation to parentIds of event sequence diagram
      createEventSequenceDiagramObject.parentIds = [result1.id, result2.id];
      const result3 = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      delete createEventSequenceDiagramObject.parentIds;
      const numDeleted = await nestedModelController.removeParentIds(result1.id);
      expect(numDeleted).toBe(0);
      const returnedEventSequenceDiagram = await nestedModelController.getSingleEventSequenceDiagram(result3.id);
      expect(returnedEventSequenceDiagram).not.toBe(null);
      expect(returnedEventSequenceDiagram.parentIds).toEqual([result2.id]);
    });
    it("should work for all models", async () => {
      const result1 = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const result2 = await nestedModelController.createBayesianNetwowrk(createBayesianNetworkObject);
      const result3 = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      const result4 = await nestedModelController.createEventTree(createEventTreeObject);
      const result5 = await nestedModelController.createFaultTree(createFaultTreeObject);
      const result6 = await nestedModelController.createFunctionalEvent(createFunctionalEventObject);
      const result7 = await nestedModelController.createInitiatingEvent(createInitiatingEventObject);
      const result8 = await nestedModelController.createMarkovChain(createMarkovChainObject);
      const result9 = await nestedModelController.createWeibullAnalysis(createWeibullAnalysisObject);
      const result10 = await nestedModelController.createRiskIntegration(createRiskIntegrationObject);
      const result11 = await nestedModelController.createRadiologicalConsequenceAnalysis(
        createRadiologicalConsequenceAnalysisObject,
      );
      const result12 = await nestedModelController.createMechanisticSourceTerm(createMechanisticSourceTermObject);
      const result13 = await nestedModelController.createEventSequenceQuantificationDiagram(
        createEventSequenceQuantificationDiagramObject,
      );
      const result14 = await nestedModelController.createDataAnalysis(createDataAnalysisObject);
      const result15 = await nestedModelController.createHumanReliabilityAnalysis(createHumanReliabilityAnalysisObject);
      const result16 = await nestedModelController.createSystemsAnalysis(createSystemsAnalysisObject);
      const result17 = await nestedModelController.createSuccessCriteria(createSuccessCriteriaObject);
      const result18 = await nestedModelController.createEventSequenceAnalysis(createEventSequenceAnalysisObject);
      const result19 = await nestedModelController.createOperatingStateAnalysis(createOperatingStateAnalysisObject);
      createEventSequenceDiagramObject.parentIds = [
        result1.id,
        result2.id,
        result3.id,
        result4.id,
        result5.id,
        result6.id,
        result7.id,
        result8.id,
        result9.id,
        result10.id,
        result11.id,
        result12.id,
        result13.id,
        result14.id,
        result15.id,
        result16.id,
        result17.id,
        result18.id,
        result19.id,
      ];
      const result20 = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      delete createEventSequenceDiagramObject.parentIds;
      for (const parentId of result20.parentIds) {
        await nestedModelController.removeParentIds(parentId);
      }
      const returnedEventSequenceDiagram = await nestedModelController.getSingleEventSequenceDiagram(result20.id);
      expect(returnedEventSequenceDiagram).toBe(null);
    });
  });
});
