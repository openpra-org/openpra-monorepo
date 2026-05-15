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
  beforeAll(async () => {
    const mongoUri = process.env.MONGO_URI;
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
        {
          provide: InitiatingEventsService,
          useValue: {
            createInitiatingEvent: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
          },
        },
        {
          provide: EventSequenceDiagramService,
          useValue: {
            createEventSequenceDiagram: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
            getSingleEventSequenceDiagram: jest.fn(
              async (): Promise<{
                id: number;
                parentIds: number[];
              }> => ({
                id: 1,
                parentIds: [1],
              }),
            ),
          },
        },
        {
          provide: EventSequenceAnalysisService,
          useValue: {
            createEventSequenceAnalysis: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
          },
        },
        {
          provide: EventTreesService,
          useValue: {
            createEventTree: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
            getSingleEventTree: jest.fn(
              async (): Promise<{
                id: number;
                parentIds: number[];
              }> => ({ id: 1, parentIds: [1] }),
            ),
          },
        },
        {
          provide: BayesianNetworksService,
          useValue: {
            createBayesianNetwork: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
            getSingleBayesianNetwork: jest.fn(
              async (): Promise<{
                id: number;
                parentIds: number[];
              }> => ({
                id: 1,
                parentIds: [1],
              }),
            ),
          },
        },
        {
          provide: FaultTreesService,
          useValue: {
            createFaultTree: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
            getSingleFaultTree: jest.fn(
              async (): Promise<{
                id: number;
                parentIds: number[];
              }> => ({ id: 1, parentIds: [1] }),
            ),
          },
        },
        {
          provide: InitiatingEventsService,
          useValue: {
            createInitiatingEvent: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
            getSingleInitiatingEvent: jest.fn(
              async (): Promise<{
                id: number;
                parentIds: number[];
              }> => ({
                id: 1,
                parentIds: [1],
              }),
            ),
          },
        },
        {
          provide: EventSequenceAnalysisService,
          useValue: {
            createEventSequenceAnalysis: jest.fn(
              async (d: Record<string, unknown>) =>
                ({ ...(d as object), id: 1 }) as {
                  id: number;
                },
            ),
            getSingleEventSequenceAnalysis: jest.fn(
              async (): Promise<{
                id: number;
                parentIds: number[];
              }> => ({
                id: 1,
                parentIds: [1],
              }),
            ),
          },
        },
      ],
      controllers: [NestedModelController],
    }).compile();
    connection = await module.get(getConnectionToken());
    nestedModelController = module.get<NestedModelController>(NestedModelController);
  });
  afterEach(async () => {
    await connection.dropDatabase();
  });
  afterAll(async () => {
    await mongoose.disconnect();
  });
  describe("NestedModelController", () => {
    it("NestedModelController should be defined", () => {
      expect(nestedModelController).toBeDefined();
    });
  });
  describe("createBayesianEstimation", () => {
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
    it("deleteBayesianEstimation should be defined", () => {
      expect(nestedModelController.deleteBayesianEstimation).toBeDefined();
    });
    it("should delete a BayesianEstimation", async () => {
      const result = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const singleResult = (await nestedModelController.deleteBayesianEstimation(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Bayesian Estimation Model");
      expect(singleResult.label.description).toBe("Description for Bayesian Estimation Model");
      const returnedBayesianEstimation = await nestedModelController.getSingleBayesianEstimation(result.id);
      expect(returnedBayesianEstimation).toBe(null);
    });
  });
  describe("deleteBayesianNetwork", () => {
    it("deleteBayesianNetwork should be defined", () => {
      expect(nestedModelController.deleteBayesianNetwork).toBeDefined();
    });
    it("should delete a BayesianNetwork", async () => {
      const result = await nestedModelController.createBayesianNetwowrk(createBayesianNetworkObject);
      const singleResult = (await nestedModelController.deleteBayesianNetwork(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Bayesian Network Model");
      expect(singleResult.label.description).toBe("Description for Bayesian Network Model");
      const returnedBayesianNetwork = await nestedModelController.getSingleBayesianNetwork(result.id);
      expect(returnedBayesianNetwork).toBe(null);
    });
  });
  describe("deleteEventSequenceDiagram", () => {
    it("deleteEventSequenceDiagram should be defined", () => {
      expect(nestedModelController.deleteEventSequenceDiagram).toBeDefined();
    });
    it("should delete a EventSequenceDiagram", async () => {
      const result = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
      const singleResult = (await nestedModelController.deleteEventSequenceDiagram(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Diagram Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Diagram Model");
      const returnedEventSequenceDiagram = await nestedModelController.getSingleEventSequenceDiagram(result.id);
      expect(returnedEventSequenceDiagram).toBe(null);
    });
  });
  describe("deleteEventTree", () => {
    it("deleteEventTree should be defined", () => {
      expect(nestedModelController.deleteEventTree).toBeDefined();
    });
    it("should delete a EventTree", async () => {
      const result = await nestedModelController.createEventTree(createEventTreeObject);
      const singleResult = (await nestedModelController.deleteEventTree(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Tree Model");
      expect(singleResult.label.description).toBe("Description for Event Tree Model");
      const returnedEventTree = await nestedModelController.getSingleEventTree(result.id);
      expect(returnedEventTree).toBe(null);
    });
  });
  describe("deleteFaultTree", () => {
    it("deleteFaultTree should be defined", () => {
      expect(nestedModelController.deleteFaultTree).toBeDefined();
    });
    it("should delete a FaultTree", async () => {
      const result = await nestedModelController.createFaultTree(createFaultTreeObject);
      const singleResult = (await nestedModelController.deleteFaultTree(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Fault Tree Model");
      expect(singleResult.label.description).toBe("Description for Fault Tree Model");
      const returnedFaultTree = await nestedModelController.getSingleFaultTree(result.id);
      expect(returnedFaultTree).toBe(null);
    });
  });
  describe("deleteFunctionalEvent", () => {
    it("deleteFunctionalEvent should be defined", () => {
      expect(nestedModelController.deleteFunctionalEvent).toBeDefined();
    });
    it("should delete a FunctionalEvent", async () => {
      const result = await nestedModelController.createFunctionalEvent(createFunctionalEventObject);
      const singleResult = (await nestedModelController.deleteFunctionalEvent(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Functional Event Model");
      expect(singleResult.label.description).toBe("Description for Functional Event Model");
      const returnedFunctionalEvent = await nestedModelController.getSingleFunctionalEvent(result.id);
      expect(returnedFunctionalEvent).toBe(null);
    });
  });
  describe("deleteInitiatingEvent", () => {
    it("deleteInitiatingEvent should be defined", () => {
      expect(nestedModelController.deleteInitiatingEvent).toBeDefined();
    });
    it("should delete a InitiatingEvent", async () => {
      const result = await nestedModelController.createInitiatingEvent(createInitiatingEventObject);
      const singleResult = (await nestedModelController.deleteInitiatingEvent(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Initiating Event Model");
      expect(singleResult.label.description).toBe("Description for Initiating Event Model");
      const returnedInitiatingEvent = await nestedModelController.getSingleInitiatingEvent(result.id);
      expect(returnedInitiatingEvent).toBe(null);
    });
  });
  describe("deleteMarkovChain", () => {
    it("deleteMarkovChain should be defined", () => {
      expect(nestedModelController.deleteMarkovChain).toBeDefined();
    });
    it("should delete a MarkovChain", async () => {
      const result = await nestedModelController.createMarkovChain(createMarkovChainObject);
      const singleResult = (await nestedModelController.deleteMarkovChain(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Markov Chain Model");
      expect(singleResult.label.description).toBe("Description for Markov Chain Model");
      const returnedMarkovChain = await nestedModelController.getSingleMarkovChain(result.id);
      expect(returnedMarkovChain).toBe(null);
    });
  });
  describe("deleteWeibullAnalysis", () => {
    it("deleteWeibullAnalysis should be defined", () => {
      expect(nestedModelController.deleteWeibullAnalysis).toBeDefined();
    });
    it("should delete a WeibullAnalysis", async () => {
      const result = await nestedModelController.createWeibullAnalysis(createWeibullAnalysisObject);
      const singleResult = (await nestedModelController.deleteWeibullAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Weibull Analysis Model");
      expect(singleResult.label.description).toBe("Description for Weibull Analysis Model");
      const returnedWeibullAnalysis = await nestedModelController.getSingleWeibullAnalysis(result.id);
      expect(returnedWeibullAnalysis).toBe(null);
    });
  });
  describe("deleteRiskIntegration", () => {
    it("deleteRiskIntegration should be defined", () => {
      expect(nestedModelController.deleteRiskIntegration).toBeDefined();
    });
    it("should delete a RiskIntegration", async () => {
      const result = await nestedModelController.createRiskIntegration(createRiskIntegrationObject);
      const singleResult = (await nestedModelController.deleteRiskIntegration(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Risk Integration Model");
      expect(singleResult.label.description).toBe("Description for Risk Integration Model");
      const returnedRiskIntegration = await nestedModelController.getSingleRiskIntegration(result.id);
      expect(returnedRiskIntegration).toBe(null);
    });
  });
  describe("deleteRadioLogicalConsequenceAnalysis", () => {
    it("deleteRadioLogicalConsequenceAnalysis should be defined", () => {
      expect(nestedModelController.deleteRadiologicalConsequenceAnalysis).toBeDefined();
    });
    it("should delete a RadioLogicalConsequenceAnalysis", async () => {
      const result = await nestedModelController.createRadiologicalConsequenceAnalysis(
        createRadiologicalConsequenceAnalysisObject,
      );
      const singleResult = (await nestedModelController.deleteRadiologicalConsequenceAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
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
    it("deleteMechanisticSourceTerm should be defined", () => {
      expect(nestedModelController.deleteMechanisticSourceTerm).toBeDefined();
    });
    it("should delete a MechanisticSourceTerm", async () => {
      const result = await nestedModelController.createMechanisticSourceTerm(createMechanisticSourceTermObject);
      const singleResult = (await nestedModelController.deleteMechanisticSourceTerm(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Mechanistic Source Term Model");
      expect(singleResult.label.description).toBe("Description for Mechanistic Source Term Model");
      const returnedMechanisticSourceTerm = await nestedModelController.getSingleMechanisticSourceTerm(result.id);
      expect(returnedMechanisticSourceTerm).toBe(null);
    });
  });
  describe("deleteEventSequenceQuantificationDiagram", () => {
    it("deleteEventSequenceQuantificationDiagram should be defined", () => {
      expect(nestedModelController.deleteEventSequenceQuantificationDiagram).toBeDefined();
    });
    it("should delete a EventSequenceQuantificationDiagram", async () => {
      const result = await nestedModelController.createEventSequenceQuantificationDiagram(
        createEventSequenceQuantificationDiagramObject,
      );
      const singleResult = (await nestedModelController.deleteEventSequenceQuantificationDiagram(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
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
    it("deleteDataAnalysis should be defined", () => {
      expect(nestedModelController.deleteDataAnalysis).toBeDefined();
    });
    it("should delete a DataAnalysis", async () => {
      const result = await nestedModelController.createDataAnalysis(createDataAnalysisObject);
      const singleResult = (await nestedModelController.deleteDataAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Data Analysis Model");
      expect(singleResult.label.description).toBe("Description for Data Analysis Model");
      const returnedDataAnalysis = await nestedModelController.getSingleDataAnalysis(result.id);
      expect(returnedDataAnalysis).toBe(null);
    });
  });
  describe("deleteHumanReliabilityAnalysis", () => {
    it("deleteHumanReliabilityAnalysis should be defined", () => {
      expect(nestedModelController.deleteHumanReliabilityAnalysis).toBeDefined();
    });
    it("should delete a HumanReliabilityAnalysis", async () => {
      const result = await nestedModelController.createHumanReliabilityAnalysis(createHumanReliabilityAnalysisObject);
      const singleResult = (await nestedModelController.deleteHumanReliabilityAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Human Reliability Analysis Model");
      expect(singleResult.label.description).toBe("Description for Human Reliability Analysis Model");
      const returnedHumanReliabilityAnalysis = await nestedModelController.getSingleHumanReliabilityAnalysis(result.id);
      expect(returnedHumanReliabilityAnalysis).toBe(null);
    });
  });
  describe("deleteSystemsAnalysis", () => {
    it("deleteSystemsAnalysis should be defined", () => {
      expect(nestedModelController.deleteSystemsAnalysis).toBeDefined();
    });
    it("should delete a SystemsAnalysis", async () => {
      const result = await nestedModelController.createSystemsAnalysis(createSystemsAnalysisObject);
      const singleResult = (await nestedModelController.deleteSystemsAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Systems Analysis Model");
      expect(singleResult.label.description).toBe("Description for Systems Analysis Model");
      const returnedSystemsAnalysis = await nestedModelController.getSingleSystemsAnalysis(result.id);
      expect(returnedSystemsAnalysis).toBe(null);
    });
  });
  describe("deleteSuccessCriteria", () => {
    it("deleteSuccessCriteria should be defined", () => {
      expect(nestedModelController.deleteSuccessCriteria).toBeDefined();
    });
    it("should delete a SuccessCriteria", async () => {
      const result = await nestedModelController.createSuccessCriteria(createSuccessCriteriaObject);
      const singleResult = (await nestedModelController.deleteSuccessCriteria(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Success Criteria Model");
      expect(singleResult.label.description).toBe("Description for Success Criteria Model");
      const returnedSuccessCriteria = await nestedModelController.getSingleSuccessCriteria(result.id);
      expect(returnedSuccessCriteria).toBe(null);
    });
  });
  describe("deleteEventSequenceAnalysis", () => {
    it("deleteEventSequenceAnalysis should be defined", () => {
      expect(nestedModelController.deleteEventSequenceAnalysis).toBeDefined();
    });
    it("should delete a EventSequenceAnalysis", async () => {
      const result = await nestedModelController.createEventSequenceAnalysis(createEventSequenceAnalysisObject);
      const singleResult = (await nestedModelController.deleteEventSequenceAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Event Sequence Analysis Model");
      expect(singleResult.label.description).toBe("Description for Event Sequence Analysis Model");
      const returnedEventSequenceAnalysis = await nestedModelController.getSingleEventSequenceAnalysis(result.id);
      expect(returnedEventSequenceAnalysis).toBe(null);
    });
  });
  describe("deleteOperatingStateAnalysis", () => {
    it("deleteOperatingStateAnalysis should be defined", () => {
      expect(nestedModelController.deleteOperatingStateAnalysis).toBeDefined();
    });
    it("should delete a OperatingStateAnalysis", async () => {
      const result = await nestedModelController.createOperatingStateAnalysis(createOperatingStateAnalysisObject);
      const singleResult = (await nestedModelController.deleteOperatingStateAnalysis(result.id)) as {
        id: number;
        label: {
          name: string;
          description?: string;
        };
      };
      expect(singleResult).toHaveProperty("label");
      expect(singleResult).toHaveProperty("id");
      expect(singleResult.label.name).toBe("Operating State Analysis Model");
      expect(singleResult.label.description).toBe("Description for Operating State Analysis Model");
      const returnedOperatingStateAnalysis = await nestedModelController.getSingleOperatingStateAnalysis(result.id);
      expect(returnedOperatingStateAnalysis).toBe(null);
    });
  });
  describe("updateBayesianEstimationLabel", () => {
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
      const result1 = await nestedModelController.createBayesianEstimation(createBayesianEstimationObject);
      const result2 = await nestedModelController.createEventSequenceDiagram(createEventSequenceDiagramObject);
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
