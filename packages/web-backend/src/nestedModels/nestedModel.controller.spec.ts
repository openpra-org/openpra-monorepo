import { Test, TestingModule } from '@nestjs/testing';
import { NestedModelService } from './nestedModel.service';
import {NestedModelController} from "./nestedModel.controller"
import {
    NestedCounter,
    NestedCounterSchema
  } from "../schemas/tree-counter.schema";
import {
    BayesianEstimation,
    BayesianEstimationSchema,
  } from "./schemas/bayesian-estimation.schema";
  import {
    EventSequenceDiagram,
    EventSequenceDiagramSchema
  } from "./schemas/event-sequence-diagram.schema";
  import { EventTree, EventTreeSchema } from "./schemas/event-tree.schema";
  import { FaultTree, FaultTreeSchema } from "./schemas/fault-tree.schema";
  import {
    InitiatingEvent,
    InitiatingEventSchema
  } from "./schemas/initiating-event.schema";
  import {
    MarkovChain,
    MarkovChainSchema
  } from "./schemas/markov-chain.schema";
  import {
    WeibullAnalysis,
    WeibullAnalysisSchema
  } from "./schemas/weibull-analysis.schema";
  import {
    FunctionalEvent,
    FunctionalEventSchema
  } from "./schemas/functional-event.schema";
  import {
    BayesianNetwork,
    BayesianNetworkSchema,
  } from "./schemas/bayesian-network.schema";
  import {
    RiskIntegration,
    RiskIntegrationSchema
  } from "./schemas/risk-integration.schema";
  import {
    MechanisticSourceTerm,
    MechanisticSourceTermSchema
  } from "./schemas/mechanistic-source-term.schema";
  import {
    EventSequenceQuantificationDiagram,
    EventSequenceQuantificationDiagramSchema
  } from "./schemas/event-sequence-quantification-diagram.schema";
  import {
    DataAnalysis,
    DataAnalysisSchema
  } from "./schemas/data-analysis.schema";
  import {
    SystemsAnalysis,
    SystemsAnalysisSchema
  } from "./schemas/systems-analysis.schema";
  import {
    SuccessCriteria,
    SuccessCriteriaSchema
  } from "./schemas/success-criteria.schema";
  import {
    EventSequenceAnalysis,
    EventSequenceAnalysisSchema
  } from "./schemas/event-sequence-analysis.schema";
  import {
    OperatingStateAnalysis,
    OperatingStateAnalysisSchema
  } from "./schemas/operatingStateAnalysis.schema";
  import {
    RadiologicalConsequenceAnalysis,
    RadiologicalConsequenceAnalysisSchema
  } from "./schemas/radiological-consequence-analysis.schema";
  import {
    HumanReliabilityAnalysis,
    HumanReliabilityAnalysisSchema
  } from "./schemas/human-reliability-analysis.schema";

import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import mongoose, { Connection } from 'mongoose';

describe('CollabService', () => {
  let nestedModelService: NestedModelService;
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
      imports:[
        MongooseModule.forRoot(mongoUri),
        MongooseModule.forFeature([
            {name:NestedCounter.name,schema:NestedCounterSchema},
            {name:BayesianEstimation.name,schema:BayesianEstimationSchema},
            {name:BayesianNetwork.name,schema:BayesianNetworkSchema},
            {name:EventSequenceDiagram.name,schema:EventSequenceDiagramSchema},
            {name:EventTree.name,schema:EventTreeSchema},
            {name:FaultTree.name,schema:FaultTreeSchema},
            {name:InitiatingEvent.name,schema:InitiatingEventSchema},
            {name:MarkovChain.name,schema:MarkovChainSchema},
            {name:WeibullAnalysis.name,schema:WeibullAnalysisSchema},
            {name:FunctionalEvent.name,schema:FunctionalEventSchema},
            {name:RiskIntegration.name,schema:RiskIntegrationSchema},
            {name:MechanisticSourceTerm.name,schema:MechanisticSourceTermSchema},
            {name:EventSequenceQuantificationDiagram.name,schema:EventSequenceQuantificationDiagramSchema},
            {name:DataAnalysis.name,schema:DataAnalysisSchema},
            {name:SystemsAnalysis.name,schema:SystemsAnalysisSchema},
            {name:SuccessCriteria.name,schema:SuccessCriteriaSchema},
            {name:EventSequenceAnalysis.name,schema:EventSequenceAnalysisSchema},
            {name:OperatingStateAnalysis.name,schema:OperatingStateAnalysisSchema},
            {name:RadiologicalConsequenceAnalysis.name,schema:RadiologicalConsequenceAnalysisSchema},
            {name:HumanReliabilityAnalysis.name,schema:HumanReliabilityAnalysisSchema},
        ])
      ],
      providers: [NestedModelService],
      controllers: [NestedModelController]
    }).compile();
    connection = await module.get(getConnectionToken()); // create mongoose connection object to call functions like put, get, find
    nestedModelService = module.get<NestedModelService>(NestedModelService);
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

  describe('NestedModelController', () => {
    /**
     * Test if nestedModelController is defined
     */
    it("NestedModelController should be defined", async () => {
        expect(nestedModelController).toBeDefined();
    });
  });
});
