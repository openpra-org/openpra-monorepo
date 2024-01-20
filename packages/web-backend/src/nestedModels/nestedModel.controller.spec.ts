import { Test, TestingModule } from '@nestjs/testing';
import { NestedModelService } from './nestedModel.service';
import {NestedModelController} from "./nestedModel.controller"
import {
    NestedCounter,
    NestedCounterDocument,
    NestedCounterSchema,
  } from "../schemas/tree-counter.schema";
import {
    BayesianEstimation,
    BayesianEstimationDocument,
    BayesianEstimationSchema,
  } from "./schemas/bayesian-estimation.schema";
  import {
    EventSequenceDiagram,
    EventSequenceDiagramDocument,
    EventSequenceDiagramSchema
  } from "./schemas/event-sequence-diagram.schema";
  import { EventTree, EventTreeDocument, EventTreeSchema } from "./schemas/event-tree.schema";
  import { FaultTree, FaultTreeDocument, FaultTreeSchema } from "./schemas/fault-tree.schema";
  import {
    InitiatingEvent,
    InitiatingEventDocument,
    InitiatingEventSchema
  } from "./schemas/initiating-event.schema";
  import {
    MarkovChain,
    MarkovChainDocument,
    MarkovChainSchema
  } from "./schemas/markov-chain.schema";
  import {
    WeibullAnalysis,
    WeibullAnalysisDocument,
    WeibullAnalysisSchema
  } from "./schemas/weibull-analysis.schema";
  import {
    FunctionalEvent,
    FunctionalEventDocument,
    FunctionalEventSchema
  } from "./schemas/functional-event.schema";
  import {
    BayesianNetwork,
    BayesianNetworkDocument,
    BayesianNetworkSchema,
  } from "./schemas/bayesian-network.schema";
  import {
    RiskIntegration,
    RiskIntegrationDocument,
    RiskIntegrationSchema
  } from "./schemas/risk-integration.schema";
  import {
    MechanisticSourceTerm,
    MechanisticSourceTermDocument,
    MechanisticSourceTermSchema
  } from "./schemas/mechanistic-source-term.schema";
  import {
    EventSequenceQuantificationDiagram,
    EventSequenceQuantificationDiagramDocument,
    EventSequenceQuantificationDiagramSchema
  } from "./schemas/event-sequence-quantification-diagram.schema";
  import {
    DataAnalysis,
    DataAnalysisDocument,
    DataAnalysisSchema
  } from "./schemas/data-analysis.schema";
  import {
    SystemsAnalysis,
    SystemsAnalysisDocument,
    SystemsAnalysisSchema
  } from "./schemas/systems-analysis.schema";
  import {
    SuccessCriteria,
    SuccessCriteriaDocument,
    SuccessCriteriaSchema
  } from "./schemas/success-criteria.schema";
  import {
    EventSequenceAnalysis,
    EventSequenceAnalysisDocument,
    EventSequenceAnalysisSchema
  } from "./schemas/event-sequence-analysis.schema";
  import {
    OperatingStateAnalysis,
    OperatingStateAnalysisDocument,
    OperatingStateAnalysisSchema
  } from "./schemas/operatingStateAnalysis.schema";
  import {
    RadiologicalConsequenceAnalysis,
    RadiologicalConsequenceAnalysisDocument,
    RadiologicalConsequenceAnalysisSchema
  } from "./schemas/radiological-consequence-analysis.schema";
  import {
    HumanReliabilityAnalysis,
    HumanReliabilityAnalysisDocument,
    HumanReliabilityAnalysisSchema
  } from "./schemas/human-reliability-analysis.schema";
  
import { MongooseModule, getConnectionToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose, { Connection } from 'mongoose';
import { InitializeOnPreviewAllowlist } from '@nestjs/core';

describe('CollabService', () => {
  let nestedModelService: NestedModelService;
  let nestedModelController: NestedModelController;
  let mongoServer: MongoMemoryServer;
  let connection: Connection;
  /**
   * Before all tests 
   * Create a new Testing module
   * define connection and collabService
   */
  beforeAll(async () => {
    mongoServer = new MongoMemoryServer(); //create mongodb memory server
    await mongoServer.start(); // start server
    const mongoUri = mongoServer.getUri(); // get server url which will be used by mongoose to connect to db
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
    await mongoServer.stop();
  });

  describe('NestedModelController', () => {
    /**
     * Test if collabService is defined
     */
    it("NestedModelController should be defined", async () => {
        expect(nestedModelController).toBeDefined();
    });
  });
});