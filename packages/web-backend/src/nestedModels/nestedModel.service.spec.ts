import { Test, TestingModule } from '@nestjs/testing';
import { NestedModelService } from './nestedModel.service';
import {
    NestedCounter,
    NestedCounterSchema,
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
      providers: [NestedModelService]
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

  describe('NestedModelService', () => {
    it("NestedModelService should be defined", async () => {
        expect(nestedModelService).toBeDefined();
    });
  });

  describe("Bayesian Estimation", () => {
    describe("createBayesianEstimation", () => {
      it('Create Event Sequence digram is defined', async () => {
        expect(nestedModelService.createBayesianEstimation).toBeDefined();
      });

      it("should create bayesian estimation without parent ids", async () => {
          let bayesianEstimationObject = {'label':{'name':'testBayesianEstimation','description':'test description'}}
          let res = await nestedModelService.createBayesianEstimation(bayesianEstimationObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual([]);
          expect(res.label.name).toBe(bayesianEstimationObject.label.name);
          expect(res.label.description).toBe(bayesianEstimationObject.label.description);
      });
      it("should create bayesian estimation with parent ids", async () => {
          let bayesianEstimationObject = {'label':{'name':'testBayesianEstimation','description':'test description'},'parentIds':[1,2]}
          let res = await nestedModelService.createBayesianEstimation(bayesianEstimationObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual(bayesianEstimationObject.parentIds);
      });

      it("IDs should be incremented", async () => {
          let bayesianEstimationObject1 = {'label':{'name':'testBayesianEstimation1','description':'test description'},'parentIds':[]}
          let res1 = await nestedModelService.createBayesianEstimation(bayesianEstimationObject1);
          let bayesianEstimationObject2 = {'label':{'name':'testBayesianEstimation2','description':'test description'},'parentIds':[1,2]}
          let res2 = await nestedModelService.createBayesianEstimation(bayesianEstimationObject2);
          expect(res1.id).toEqual(res2.id-1);
      });
    });

    describe('getBayesianEstimations', () => {
      it("should be defined",async () => {
        expect(nestedModelService.getBayesianEstimations).toBeDefined();
      });
    });

    describe('getSingleBayesianEstimations', () => {
      it("should be defined",async () => {
        expect(nestedModelService.getSingleBayesianEstimation).toBeDefined();
      });

      it("should return correct object",async () =>{
        let bayesianEstimationObject = {'label':{'name':'testBayesianEstimation','description':'test description'},'parentIds':[1,2]}
        let res = await nestedModelService.createBayesianEstimation(bayesianEstimationObject);
        let returnedBayesianEstimation = await nestedModelService.getSingleBayesianEstimation(res.id);
        expect(returnedBayesianEstimation).toBeDefined();
        expect(res.id).toEqual(returnedBayesianEstimation.id);
      });

      it("should return null if ID not present",async () =>{
        let returnedBayesianEstimation = await nestedModelService.getSingleBayesianEstimation(0);
        expect(returnedBayesianEstimation).toBeNull();
      });

    });

    describe("deleteBayesianEstimation", () => {
      it("should be defined", () => {
        expect(nestedModelService.deleteBayesianEstimation).toBeDefined();
      });
      it("should delete the Bayesian Estimation", async () => {
        let bayesianEstimationObject = {'label':{'name':'testBayesianEstimation','description':'test description'},'parentIds':[1,2]}
        let res = await nestedModelService.createBayesianEstimation(bayesianEstimationObject);
        let deletedBayesianEstimation = await nestedModelService.deleteBayesianEstimation(res.id);
        let returnedBayesianEstimation = await nestedModelService.getSingleBayesianEstimation(res.id);
        expect(returnedBayesianEstimation).toBeNull();
      });
      it("should return null for when Bayesian Estimation not present", async () => {
        let deletedBayesianEstimation = await nestedModelService.deleteBayesianEstimation(0);
        expect(deletedBayesianEstimation).toBeNull();
      });
    });
  });

  describe("Event Sequence Diagram", () => {
    describe("createEventSequenceDiagram", () => {
      it('Create Event Sequence digram is defined', async () => {
        expect(nestedModelService.createEventSequenceDiagram).toBeDefined();
      });
      it("should create event sequence diagram without parent ids", async () => {
          let eventSequenceDiagramObject = {'label':{'name':'testEventSequence','description':'test description'}}
          let res = await nestedModelService.createEventSequenceDiagram(eventSequenceDiagramObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual([]);
          expect(res.label.name).toBe(eventSequenceDiagramObject.label.name);
          expect(res.label.description).toBe(eventSequenceDiagramObject.label.description);
      });
      it("should create bayesian estimation with parent ids", async () => {
          let eventSequenceDiagramObject = {'label':{'name':'testEventSequence','description':'test description'},'parentIds':[2,3]}
          let res = await nestedModelService.createEventSequenceDiagram(eventSequenceDiagramObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual(eventSequenceDiagramObject.parentIds);
      });

      it("IDs should be incremented", async () => {
          let eventSequenceDiagramObject1 = {'label':{'name':'testEventSequence','description':'test description'}}
          let res1 = await nestedModelService.createEventSequenceDiagram(eventSequenceDiagramObject1);
          let eventSequenceDiagramObject2 = {'label':{'name':'testEventSequence','description':'test description'}}
          let res2 = await nestedModelService.createEventSequenceDiagram(eventSequenceDiagramObject2);
          expect(res1.id).toEqual(res2.id-1);
      });
    });
    describe("getEventSequenceDiagrams", () => {
      it("should be defined", () => {
        expect(nestedModelService.getEventSequenceDiagrams).toBeDefined();
      });
    });
  });

  describe("Event Tree", () => {
    describe("createEventTree", () => {
      it('Create Event Tree is defined', async () => {
        expect(nestedModelService.createEventTree).toBeDefined();
      });
      it("should create Event Tree without parent ids", async () => {
        let eventTreeObject = {'label':{'name':'testEventTree','description':'test description'}}
          let res = await nestedModelService.createEventTree(eventTreeObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual([]);
          expect(res.label.name).toBe(eventTreeObject.label.name);
          expect(res.label.description).toBe(eventTreeObject.label.description);
      });
      it("should create Event Tree with parent ids", async () => {
          let eventTreeObject = {'label':{'name':'testEventTree','description':'test description'},'parentIds':[2,3]}
          let res = await nestedModelService.createEventSequenceDiagram(eventTreeObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual(eventTreeObject.parentIds);
        });

        it("IDs should be incremented", async () => {
          let eventTreeObject1 = {'label':{'name':'testEventTree','description':'test description'}}
          let res1 = await nestedModelService.createEventSequenceDiagram(eventTreeObject1);
          let eventTreeObject2 = {'label':{'name':'testEventSequence','description':'test description'}}
          let res2 = await nestedModelService.createEventSequenceDiagram(eventTreeObject2);
          expect(res1.id).toEqual(res2.id-1);
      });
    });

    describe("getEventTrees", () => {
      it('getEventTrees is defined', async () => {
        expect(nestedModelService.getEventTrees).toBeDefined();
      });
    });
  });
  describe('Fault Tree',() => {
    describe("createFaultTree", () => {
      it('Create Fault Tree is defined', async () => {
        expect(nestedModelService.createFaultTree).toBeDefined();
      });
      it("should create Fault Tree without parent ids", async () => {
          let faultTreeObject = {'label':{'name':'testFaultTree','description':'test description'}}
          let res = await nestedModelService.createFaultTree(faultTreeObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual([]);
          expect(res.label.name).toBe(faultTreeObject.label.name);
          expect(res.label.description).toBe(faultTreeObject.label.description);
      });
      it("should create bayesian estimation with parent ids", async () => {
          let faultTreeObject = {'label':{'name':'testFaultTree','description':'test description'},'parentIds':[2,3]}
          let res = await nestedModelService.createEventSequenceDiagram(faultTreeObject);
          expect(res).toBeDefined();
          expect(res.parentIds).toEqual(faultTreeObject.parentIds);
      });

      it("IDs should be incremented", async () => {
          let faultTreeObject1 = {'label':{'name':'testFaultTree','description':'test description'}}
          let res1 = await nestedModelService.createEventSequenceDiagram(faultTreeObject1);
          let faultTreeObject2 = {'label':{'name':'testFaultTree','description':'test description'}}
          let res2 = await nestedModelService.createEventSequenceDiagram(faultTreeObject2);
          expect(res1.id).toEqual(res2.id-1);
      });
    });

    describe("getFaultTrees",() => {
      it('getFaultTrees is defined', async () => {
        expect(nestedModelService.getFaultTrees).toBeDefined();
      });
    });
  });

  describe('Functional Events', () => {
    describe("createFunctionalEvent",() => {
      it("should be defined", () => {
        expect(nestedModelService.createFunctionalEvent).toBeDefined();
      });
    });
    describe("getFunctionalEvents",() => {
      it("should be defined", () => {
        expect(nestedModelService.getFunctionalEvents).toBeDefined();
      });
    });
  });

  describe("Initiating Events", () => {
    describe("createInitiatingEvent", ()=>{
      it("should be defined", ()=>{
        expect(nestedModelService.createInitiatingEvent).toBeDefined();
        });
    });
    describe("getInitiatingEvents", ()=>{
      it("should be defined", ()=>{
        expect(nestedModelService.getInitiatingEvents).toBeDefined();
        });
    });
  });

  describe('Markov Chain',() => {
    describe("createMarkovChain", ()=>{
      it("should be defined", ()=>{
        expect(nestedModelService.createMarkovChain).toBeDefined();
        });
    });
    describe("getMarkovChains", ()=>{
      it("should be defined", ()=>{
        expect(nestedModelService.getMarkovChains).toBeDefined();
        });
    });
  });

  describe("Weibull analysis", () => {
    describe("createWeibullAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createInitiatingEvent).toBeDefined();
      });
    });

    describe("getWeibullAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getWeibullAnalysis).toBeDefined();
      });
    });
  });

  describe("Risk Integration", () => {
    describe("createRiskIntegration", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createRiskIntegration).toBeDefined();
      });
    });
    describe("getRiskIntegration", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getRiskIntegration).toBeDefined();
      });
    });
  });

  describe("Radiological Consequence Analysis", () => {
    describe("createRadiologicalConsequenceAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createRadiologicalConsequenceAnalysis).toBeDefined();
      });
    });
    describe("getRadiologicalConsequenceAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getRadiologicalConsequenceAnalysis).toBeDefined();
      });
    });
  });
  describe("Mechanistic Source Term", () => {
    describe("createMechanisticSourceTerm", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createMechanisticSourceTerm).toBeDefined();
      });
    });
    describe("getMechanisticSourceTerm", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getMechanisticSourceTerm).toBeDefined();
      });
    });
  });
  describe("Event Sequence Quantification Diagram", () => {
    describe("createEventSequenceQuantificationDiagram", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createEventSequenceQuantificationDiagram).toBeDefined();
      });
    });
    describe("getEventSequenceQuantificationDiagram", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getEventSequenceQuantificationDiagram).toBeDefined();
      });
    });
  });
  describe("Data Analysis", () => {
    describe("createDataAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createDataAnalysis).toBeDefined();
      });
    });
    describe("getDataAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getDataAnalysis).toBeDefined();
      });
    });
  });

  describe("Human Reliability Analysis",() => {
    //test block for createHumanReliabilityAnalysis
    describe("createHumanReliabilityAnalysis", ()=>{
      it("should be defined", async ()=> {
        expect(nestedModelService.createHumanReliabilityAnalysis).toBeDefined();
        });
    });
    describe("getHumanReliabilityAnalysis",() => {
      it("should be defined",async ()=>{
        expect(nestedModelService.getHumanReliabilityAnalysis).toBeDefined();
      });
    });
  });

  describe("Systems Analysis",() =>{
    //test block for createSystemsAnalysis
    describe("createSystemsAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createSystemsAnalysis).toBeDefined();
        });
    });

    describe("getSystemsAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getSystemsAnalysis).toBeDefined();
        });
    });
  });

  describe("Success Criteria",() => {
    describe("createSuccessCriteria", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createSuccessCriteria).toBeDefined();
        });
    });

    describe("getSuccessCriteria", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getSuccessCriteria).toBeDefined();
        });
    });
  });

  describe("Event Sequence Analysis",() => {
    describe("createEventSequenceAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createEventSequenceAnalysis).toBeDefined();
        });
    });

    describe("getEventSequenceAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getEventSequenceAnalysis).toBeDefined();
        });
    });
  });

  describe("Operating State Analysis",() => {
    describe("createOperatingStateAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.createOperatingStateAnalysis).toBeDefined();
        });
    });
    describe("getOperatingStateAnalysis", ()=>{
      it("should be defined", ()=> {
        expect(nestedModelService.getOperatingStateAnalysis).toBeDefined();
        });
    });
  });
});
