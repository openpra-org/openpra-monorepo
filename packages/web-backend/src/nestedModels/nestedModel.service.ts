import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { NestedCounter, NestedCounterDocument } from "../schemas/tree-counter.schema";
import { Label } from "../schemas/label.schema";
import { NestedModel } from "./schemas/templateSchema/nested-model.schema";
import { BayesianEstimation, BayesianEstimationDocument } from "./schemas/bayesian-estimation.schema";
import { EventSequenceDiagram, EventSequenceDiagramDocument } from "./schemas/event-sequence-diagram.schema";
import { EventTree, EventTreeDocument } from "./schemas/event-tree.schema";
import { FaultTree, FaultTreeDocument } from "./schemas/fault-tree.schema";
import { HeatBalanceFaultTree, HeatBalanceFaultTreeDocument } from "./schemas/heat-balance-fault-tree.schema";
import { InitiatingEvent, InitiatingEventDocument } from "./schemas/initiating-event.schema";
import { MarkovChain, MarkovChainDocument } from "./schemas/markov-chain.schema";
import { WeibullAnalysis, WeibullAnalysisDocument } from "./schemas/weibull-analysis.schema";
import { FunctionalEvent, FunctionalEventDocument } from "./schemas/functional-event.schema";
import { BayesianNetwork, BayesianNetworkDocument } from "./schemas/bayesian-network.schema";
import { RiskIntegration, RiskIntegrationDocument } from "./schemas/risk-integration.schema";
import { MechanisticSourceTerm, MechanisticSourceTermDocument } from "./schemas/mechanistic-source-term.schema";
import {
  EventSequenceQuantificationDiagram,
  EventSequenceQuantificationDiagramDocument,
} from "./schemas/event-sequence-quantification-diagram.schema";
import { DataAnalysis, DataAnalysisDocument } from "./schemas/data-analysis.schema";
import { SystemsAnalysis, SystemsAnalysisDocument } from "./schemas/systems-analysis.schema";
import { SuccessCriteria, SuccessCriteriaDocument } from "./schemas/success-criteria.schema";
import { EventSequenceAnalysis, EventSequenceAnalysisDocument } from "./schemas/event-sequence-analysis.schema";
import { OperatingStateAnalysis, OperatingStateAnalysisDocument } from "./schemas/operatingStateAnalysis.schema";
import {
  RadiologicalConsequenceAnalysis,
  RadiologicalConsequenceAnalysisDocument,
} from "./schemas/radiological-consequence-analysis.schema";
import {
  HumanReliabilityAnalysis,
  HumanReliabilityAnalysisDocument,
} from "./schemas/human-reliability-analysis.schema";
import { MasterLogicDiagram, MasterLogicDiagramDocument } from "./schemas/master-logic-diagram.schema";

@Injectable()
export class NestedModelService {
  //creating out object links to the database
  constructor(
    @InjectModel(BayesianEstimation.name)
    private readonly bayesianEstimationModel: Model<BayesianEstimationDocument>,
    @InjectModel(EventSequenceDiagram.name)
    private readonly eventSequenceDiagramModel: Model<EventSequenceDiagramDocument>,
    @InjectModel(BayesianNetwork.name)
    private readonly bayesianNetworkModel: Model<BayesianNetworkDocument>,
    @InjectModel(EventTree.name)
    private readonly eventTreeModel: Model<EventTreeDocument>,
    @InjectModel(FaultTree.name)
    private readonly faultTreeModel: Model<FaultTreeDocument>,
    @InjectModel(HeatBalanceFaultTree.name)
    private readonly heatBalanceFaultTreeModel: Model<HeatBalanceFaultTreeDocument>,
    @InjectModel(MasterLogicDiagram.name)
    private readonly masterLogicDiagramModel: Model<MasterLogicDiagramDocument>,
    @InjectModel(FunctionalEvent.name)
    private readonly functionalEventsModel: Model<FunctionalEventDocument>,
    @InjectModel(InitiatingEvent.name)
    private readonly initiatingEventModel: Model<InitiatingEventDocument>,
    @InjectModel(MarkovChain.name)
    private readonly markovChainModel: Model<MarkovChainDocument>,
    @InjectModel(WeibullAnalysis.name)
    private readonly weibullAnalysisModel: Model<WeibullAnalysisDocument>,
    @InjectModel(NestedCounter.name)
    private readonly nestedCounterModel: Model<NestedCounterDocument>,
    @InjectModel(RiskIntegration.name)
    private readonly riskIntegrationModel: Model<RiskIntegrationDocument>,
    @InjectModel(RadiologicalConsequenceAnalysis.name)
    private readonly radiologicalConsequenceAnalysisModel: Model<RadiologicalConsequenceAnalysisDocument>,
    @InjectModel(MechanisticSourceTerm.name)
    private readonly mechanisticSourceTermModel: Model<MechanisticSourceTermDocument>,
    @InjectModel(EventSequenceQuantificationDiagram.name)
    private readonly eventSequenceQuantificationDiagramModel: Model<EventSequenceQuantificationDiagramDocument>,
    @InjectModel(DataAnalysis.name)
    private readonly dataAnalysisModel: Model<DataAnalysisDocument>,
    @InjectModel(HumanReliabilityAnalysis.name)
    private readonly humanReliabilityAnalysisModel: Model<HumanReliabilityAnalysisDocument>,
    @InjectModel(SystemsAnalysis.name)
    private readonly systemsAnalysisModel: Model<SystemsAnalysisDocument>,
    @InjectModel(SuccessCriteria.name)
    private readonly successCriteriaModel: Model<SuccessCriteriaDocument>,
    @InjectModel(EventSequenceAnalysis.name)
    private readonly eventSequenceAnalysisModel: Model<EventSequenceAnalysisDocument>,
    @InjectModel(OperatingStateAnalysis.name)
    private readonly operatingStateAnalysisModel: Model<OperatingStateAnalysisDocument>,
  ) {}

  /**
   * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
   * @param {string} name Name of the counter
   * @description
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
   * @returns {number} ID number
   */
  async getNextValue(name: string) {
    const record = await this.nestedCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.nestedCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  /**
   * this was copied from elsewhere, its to create a counter, it should probably have the suer counter named something else now but oh well
   * @param {string} name Name of the counter
   * @description
   * Generates an ID for the newly created user in an incremental order of 1. Initially if no user exists, the serial ID starts from 1.
   * @returns {number} ID number
   */
  async getValue(name: string): Promise<number> {
    const record = await this.nestedCounterModel.findById(name);
    return record.seq;
  }

  //method calls for the post methods

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createBayesianEstimation(body: Partial<NestedModel>): Promise<NestedModel> {
    const newBayesianEstimation = new this.bayesianEstimationModel(body);
    newBayesianEstimation.id = await this.getNextValue("nestedCounter");
    return newBayesianEstimation.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createHeatBalanceFaultTree(body: Partial<NestedModel>): Promise<NestedModel> {
    const newHeatBalanceFaultTree = new this.heatBalanceFaultTreeModel(body);
    newHeatBalanceFaultTree.id = await this.getNextValue("nestedCounter");
    return newHeatBalanceFaultTree.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createMasterLogicDiagram(body: Partial<NestedModel>): Promise<NestedModel> {
    const newHeatBalanceFaultTree = new this.masterLogicDiagramModel(body);
    newHeatBalanceFaultTree.id = await this.getNextValue("nestedCounter");
    return newHeatBalanceFaultTree.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createFunctionalEvent(body: Partial<NestedModel>): Promise<NestedModel> {
    const newFunctionalEvent = new this.functionalEventsModel(body);
    newFunctionalEvent.id = await this.getNextValue("nestedCounter");
    return newFunctionalEvent.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createMarkovChain(body: Partial<NestedModel>): Promise<NestedModel> {
    const newMarkovChain = new this.markovChainModel(body);
    newMarkovChain.id = await this.getNextValue("nestedCounter");
    return newMarkovChain.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createWeibullAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newWeibullAnalysis = new this.weibullAnalysisModel(body);
    newWeibullAnalysis.id = await this.getNextValue("nestedCounter");
    return newWeibullAnalysis.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createRiskIntegration(body: Partial<NestedModel>): Promise<NestedModel> {
    const newRiskIntegration = new this.riskIntegrationModel(body);
    newRiskIntegration.id = await this.getNextValue("nestedCounter");
    return newRiskIntegration.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createRadiologicalConsequenceAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newRCA = new this.radiologicalConsequenceAnalysisModel(body);
    newRCA.id = await this.getNextValue("nestedCounter");
    return newRCA.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createMechanisticSourceTerm(body: Partial<NestedModel>): Promise<NestedModel> {
    const newMachnisticSourceTerm = new this.mechanisticSourceTermModel(body);
    newMachnisticSourceTerm.id = await this.getNextValue("nestedCounter");
    return newMachnisticSourceTerm.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createEventSequenceQuantificationDiagram(body: Partial<NestedModel>): Promise<NestedModel> {
    const newESQD = new this.eventSequenceQuantificationDiagramModel(body);
    newESQD.id = await this.getNextValue("nestedCounter");
    return newESQD.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createDataAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newDataAnalysis = new this.dataAnalysisModel(body);
    newDataAnalysis.id = await this.getNextValue("nestedCounter");
    return newDataAnalysis.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createHumanReliabilityAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newHRA = new this.humanReliabilityAnalysisModel(body);
    newHRA.id = await this.getNextValue("nestedCounter");
    return newHRA.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createSystemsAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newSystemsAnalysis = new this.systemsAnalysisModel(body);
    newSystemsAnalysis.id = await this.getNextValue("nestedCounter");
    return newSystemsAnalysis.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createSuccessCriteria(body: Partial<NestedModel>): Promise<NestedModel> {
    const newSuccessCriteria = new this.successCriteriaModel(body);
    newSuccessCriteria.id = await this.getNextValue("nestedCounter");
    return newSuccessCriteria.save();
  }

  /**
   * creates the type of nested model defined in the function name
   * @param body a nested model, that needs to contain its parent id (easier to grab on frontend with getCurrentModel)
   * and a label object with a name string and optional description string
   * @returns a promise with a nested model in it, which contains the basic data all the nested models have
   */
  async createOperatingStateAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newOSA = new this.operatingStateAnalysisModel(body);
    newOSA.id = await this.getNextValue("nestedCounter");
    return newOSA.save();
  }

  //get collection methods

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getBayesianEstimations(parentId: number): Promise<BayesianEstimation[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.bayesianEstimationModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getHeatBalanceFaultTrees(parentId: number): Promise<HeatBalanceFaultTree[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.heatBalanceFaultTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getMasterLogicDiagrams(parentId: number): Promise<HeatBalanceFaultTree[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.masterLogicDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getFunctionalEvents(parentId: number): Promise<FunctionalEvent[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.functionalEventsModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getMarkovChains(parentId: number): Promise<MarkovChain[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.markovChainModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * gets the collection of the nested model as defined by the function name (bayesian estimations, etc.)
   * @param parentId id of the parent model the nested model is number
   * @returns a promise with an array of the nested model of the type in the function name
   */
  async getWeibullAnalysis(parentId: number): Promise<WeibullAnalysis[]> {
    //typecast to a number because for some reason, it isn't a number????

    return this.weibullAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Risk Integration models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Risk Integration models associated with the specified parent ID.
   */
  async getRiskIntegration(parentId: number): Promise<RiskIntegration[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.riskIntegrationModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Radiological Consequence Analysis models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Radiological Consequence Analysis models associated with the specified parent ID.
   */
  async getRadiologicalConsequenceAnalysis(parentId: number): Promise<RadiologicalConsequenceAnalysis[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.radiologicalConsequenceAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Mechanistic Source Term models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Mechanistic Source Term models associated with the specified parent ID.
   */
  async getMechanisticSourceTerm(parentId: number): Promise<MechanisticSourceTerm[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.mechanisticSourceTermModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Event Sequence Quantification Diagram models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Event Sequence Quantification Diagram models associated with the specified parent ID.
   */
  async getEventSequenceQuantificationDiagram(parentId: number): Promise<EventSequenceQuantificationDiagram[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.eventSequenceQuantificationDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Data Analysis models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Data Analysis models associated with the specified parent ID.
   */
  async getDataAnalysis(parentId: number): Promise<DataAnalysis[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.dataAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Human Reliability Analysis models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Human Reliability Analysis models associated with the specified parent ID.
   */
  async getHumanReliabilityAnalysis(parentId: number): Promise<HumanReliabilityAnalysis[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.humanReliabilityAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Systems Analysis models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Systems Analysis models associated with the specified parent ID.
   */
  async getSystemsAnalysis(parentId: number): Promise<SystemsAnalysis[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.systemsAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Success Criteria models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Success Criteria models associated with the specified parent ID.
   */
  async getSuccessCriteria(parentId: number): Promise<SuccessCriteria[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.successCriteriaModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  /**
   * Retrieves a collection of Operating State Analysis models based on the parent ID.
   * @param parentId The ID of the parent model for the nested model.
   * @returns A promise with an array of nested Operating State Analysis models associated with the specified parent ID.
   */
  async getOperatingStateAnalysis(parentId: number): Promise<OperatingStateAnalysis[]> {
    // Typecast to a number because for some reason, it isn't a number????

    return this.operatingStateAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  //singular get methods

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleBayesianEstimation(modelId: number): Promise<BayesianEstimation> {
    return this.bayesianEstimationModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleHeatBalanceFaultTree(modelId: number): Promise<HeatBalanceFaultTree> {
    return this.heatBalanceFaultTreeModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleMasterLogicDiagram(modelId: number): Promise<MasterLogicDiagram> {
    return this.masterLogicDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleFunctionalEvent(modelId: number): Promise<FunctionalEvent> {
    return this.functionalEventsModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleMarkovChain(modelId: number): Promise<MarkovChain> {
    return this.markovChainModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * gets a single model from the collection based on the id
   * @param modelId the id of the model to be retrieved
   * @returns the model which has the associated id
   */
  async getSingleWeibullAnalysis(modelId: number): Promise<WeibullAnalysis> {
    return this.weibullAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Risk Integration model based on the ID.
   * @param modelId The ID of the Risk Integration model to be retrieved.
   * @returns The Risk Integration model associated with the specified ID.
   */
  async getSingleRiskIntegration(modelId: number): Promise<RiskIntegration> {
    return this.riskIntegrationModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Radiological Consequence Analysis model based on the ID.
   * @param modelId The ID of the Radiological Consequence Analysis model to be retrieved.
   * @returns The Radiological Consequence Analysis model associated with the specified ID.
   */
  async getSingleRadiologicalConsequenceAnalysis(modelId: number): Promise<RadiologicalConsequenceAnalysis> {
    return this.radiologicalConsequenceAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Mechanistic Source Term model based on the ID.
   * @param modelId The ID of the Mechanistic Source Term model to be retrieved.
   * @returns The Mechanistic Source Term model associated with the specified ID.
   */
  async getSingleMechanisticSourceTerm(modelId: number): Promise<MechanisticSourceTerm> {
    return this.mechanisticSourceTermModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Event Sequence Quantification Diagram model based on the ID.
   * @param modelId The ID of the Event Sequence Quantification Diagram model to be retrieved.
   * @returns The Event Sequence Quantification Diagram model associated with the specified ID.
   */
  async getSingleEventSequenceQuantificationDiagram(modelId: number): Promise<EventSequenceQuantificationDiagram> {
    return this.eventSequenceQuantificationDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Data Analysis model based on the ID.
   * @param modelId The ID of the Data Analysis model to be retrieved.
   * @returns The Data Analysis model associated with the specified ID.
   */
  async getSingleDataAnalysis(modelId: number): Promise<DataAnalysis> {
    return this.dataAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Human Reliability Analysis model based on the ID.
   * @param modelId The ID of the Human Reliability Analysis model to be retrieved.
   * @returns The Human Reliability Analysis model associated with the specified ID.
   */
  async getSingleHumanReliabilityAnalysis(modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.humanReliabilityAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Systems Analysis model based on the ID.
   * @param modelId The ID of the Systems Analysis model to be retrieved.
   * @returns The Systems Analysis model associated with the specified ID.
   */
  async getSingleSystemsAnalysis(modelId: number): Promise<SystemsAnalysis> {
    return this.systemsAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Success Criteria model based on the ID.
   * @param modelId The ID of the Success Criteria model to be retrieved.
   * @returns The Success Criteria model associated with the specified ID.
   */
  async getSingleSuccessCriteria(modelId: number): Promise<SuccessCriteria> {
    return this.successCriteriaModel.findOne({ id: modelId }, { _id: 0 });
  }

  /**
   * Retrieves a single Operating State Analysis model based on the ID.
   * @param modelId The ID of the Operating State Analysis model to be retrieved.
   * @returns The Operating State Analysis model associated with the specified ID.
   */
  async getSingleOperatingStateAnalysis(modelId: number): Promise<OperatingStateAnalysis> {
    return this.operatingStateAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  //delete methods

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the model we want to delete
   * @returns a promise with the deleted model
   */
  async deleteBayesianEstimation(modelId: number): Promise<BayesianEstimation> {
    return this.bayesianEstimationModel.findOneAndDelete({ id: modelId });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the model we want to delete
   * @returns a promise with the deleted model
   */
  async deleteHeatBalanceFaultTree(modelId: number): Promise<HeatBalanceFaultTree> {
    return this.heatBalanceFaultTreeModel.findOneAndDelete({ id: modelId });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the model we want to delete
   * @returns a promise with the deleted model
   */
  async deleteMasterLogicDiagram(modelId: number): Promise<MasterLogicDiagram> {
    return this.masterLogicDiagramModel.findOneAndDelete({ id: modelId });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the model we want to delete
   * @returns a promise with the deleted model
   */
  async deleteFunctionalEvent(modelId: number): Promise<FunctionalEvent> {
    return this.functionalEventsModel.findOneAndDelete({ id: modelId });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the model we want to delete
   * @returns a promise with the deleted model
   */
  async deleteMarkovChain(modelId: number): Promise<MarkovChain> {
    return this.markovChainModel.findOneAndDelete({ id: modelId });
  }

  /**
   * finds and deletes the nested model in this collection with the give model id
   * @param modelId the id of the model we want to delete
   * @returns a promise with the deleted model
   */
  async deleteWeibullAnalysis(modelId: number): Promise<WeibullAnalysis> {
    return this.weibullAnalysisModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes a Risk Integration model based on the ID.
   * @param modelId The ID of the Risk Integration model to be deleted.
   * @returns A promise with the deleted Risk Integration model.
   */
  async deleteRiskIntegration(modelId: number): Promise<RiskIntegration> {
    return this.riskIntegrationModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes a Radiological Consequence Analysis model based on the ID.
   * @param modelId The ID of the Radiological Consequence Analysis model to be deleted.
   * @returns A promise with the deleted Radiological Consequence Analysis model.
   */
  async deleteRadiologicalConsequenceAnalysis(modelId: number): Promise<RadiologicalConsequenceAnalysis> {
    return this.radiologicalConsequenceAnalysisModel.findOneAndDelete({
      id: modelId,
    });
  }

  /**
   * Finds and deletes a Mechanistic Source Term model based on the ID.
   * @param modelId The ID of the Mechanistic Source Term model to be deleted.
   * @returns A promise with the deleted Mechanistic Source Term model.
   */
  async deleteMechanisticSourceTerm(modelId: number): Promise<MechanisticSourceTerm> {
    return this.mechanisticSourceTermModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes an Event Sequence Quantification Diagram model based on the ID.
   * @param modelId The ID of the Event Sequence Quantification Diagram model to be deleted.
   * @returns A promise with the deleted Event Sequence Quantification Diagram model.
   */
  async deleteEventSequenceQuantificationDiagram(modelId: number): Promise<EventSequenceQuantificationDiagram> {
    return this.eventSequenceQuantificationDiagramModel.findOneAndDelete({
      id: modelId,
    });
  }

  /**
   * Finds and deletes a Data Analysis model based on the ID.
   * @param modelId The ID of the Data Analysis model to be deleted.
   * @returns A promise with the deleted Data Analysis model.
   */
  async deleteDataAnalysis(modelId: number): Promise<DataAnalysis> {
    return this.dataAnalysisModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes a Human Reliability Analysis model based on the ID.
   * @param modelId The ID of the Human Reliability Analysis model to be deleted.
   * @returns A promise with the deleted Human Reliability Analysis model.
   */
  async deleteHumanReliabilityAnalysis(modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.humanReliabilityAnalysisModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes a Systems Analysis model based on the ID.
   * @param modelId The ID of the Systems Analysis model to be deleted.
   * @returns A promise with the deleted Systems Analysis model.
   */
  async deleteSystemsAnalysis(modelId: number): Promise<SystemsAnalysis> {
    return this.systemsAnalysisModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes a Success Criteria model based on the ID.
   * @param modelId The ID of the Success Criteria model to be deleted.
   * @returns A promise with the deleted Success Criteria model.
   */
  async deleteSuccessCriteria(modelId: number): Promise<SuccessCriteria> {
    return this.successCriteriaModel.findOneAndDelete({ id: modelId });
  }

  /**
   * Finds and deletes an Operating State Analysis model based on the ID.
   * @param modelId The ID of the Operating State Analysis model to be deleted.
   * @returns A promise with the deleted Operating State Analysis model.
   */
  async deleteOperatingStateAnalysis(modelId: number): Promise<OperatingStateAnalysis> {
    return this.operatingStateAnalysisModel.findOneAndDelete({ id: modelId });
  }

  /**
   * updates the label in the nested model
   * @param id the id of the nested model to be updated
   * @param body a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateBayesianEstimationLabel(id: number, body: Label): Promise<NestedModel> {
    return this.bayesianEstimationModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * updates the label in the nested model
   * @param id the id of the nested model to be updated
   * @param body a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateFunctionalEventLabel(id: number, body: Label): Promise<NestedModel> {
    return this.functionalEventsModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * updates the label in the nested model
   * @param id the id of the nested model to be updated
   * @param body a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateMarkovChainLabel(id: number, body: Label): Promise<NestedModel> {
    return this.markovChainModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * updates the label in the nested model
   * @param id the id of the nested model to be updated
   * @param body a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateHeatBalanceFaultTreeLabel(id: number, body: Label): Promise<NestedModel> {
    return this.heatBalanceFaultTreeModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * updates the label in the nested model
   * @param id the id of the nested model to be updated
   * @param body a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateMasterLogicDiagramLabel(id: number, body: Label): Promise<NestedModel> {
    return this.masterLogicDiagramModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * updates the label in the nested model
   * @param id the id of the nested model to be updated
   * @param body a label with a name and description
   * @returns a promise with the updated model with an updated label
   */
  async updateWeibullAnalysisLabel(id: number, body: Label): Promise<NestedModel> {
    return this.weibullAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in a Risk Integration model.
   * @param id The ID of the Risk Integration model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Risk Integration model with an updated label.
   */
  async updateRiskIntegrationLabel(id: number, body: Label): Promise<RiskIntegration> {
    return this.riskIntegrationModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in a Radiological Consequence Analysis model.
   * @param id The ID of the Radiological Consequence Analysis model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Radiological Consequence Analysis model with an updated label.
   */
  async updateRadiologicalConsequenceAnalysisLabel(id: number, body: Label): Promise<RadiologicalConsequenceAnalysis> {
    return this.radiologicalConsequenceAnalysisModel.findOneAndUpdate(
      { id: Number(id) },
      { label: body },
      { new: true },
    );
  }

  /**
   * Updates the label in a Mechanistic Source Term model.
   * @param id The ID of the Mechanistic Source Term model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Mechanistic Source Term model with an updated label.
   */
  async updateMechanisticSourceTermLabel(id: number, body: Label): Promise<MechanisticSourceTerm> {
    return this.mechanisticSourceTermModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in an Event Sequence Quantification Diagram model.
   * @param id The ID of the Event Sequence Quantification Diagram model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Event Sequence Quantification Diagram model with an updated label.
   */
  async updateEventSequenceQuantificationDiagramLabel(
    id: number,
    body: Label,
  ): Promise<EventSequenceQuantificationDiagram> {
    return this.eventSequenceQuantificationDiagramModel.findOneAndUpdate(
      { id: Number(id) },
      { label: body },
      { new: true },
    );
  }

  /**
   * Updates the label in a Data Analysis model.
   * @param id The ID of the Data Analysis model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Data Analysis model with an updated label.
   */
  async updateDataAnalysisLabel(id: number, body: Label): Promise<DataAnalysis> {
    return this.dataAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in a Human Reliability Analysis model.
   * @param id The ID of the Human Reliability Analysis model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Human Reliability Analysis model with an updated label.
   */
  async updateHumanReliabilityAnalysisLabel(id: number, body: Label): Promise<HumanReliabilityAnalysis> {
    return this.humanReliabilityAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in a Systems Analysis model.
   * @param id The ID of the Systems Analysis model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Systems Analysis model with an updated label.
   */
  async updateSystemsAnalysisLabel(id: number, body: Label): Promise<SystemsAnalysis> {
    return this.systemsAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in a Success Criteria model.
   * @param id The ID of the Success Criteria model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Success Criteria model with an updated label.
   */
  async updateSuccessCriteriaLabel(id: number, body: Label): Promise<SuccessCriteria> {
    return this.successCriteriaModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  /**
   * Updates the label in an Operating State Analysis model.
   * @param id The ID of the Operating State Analysis model to be updated.
   * @param body A label with a name and description.
   * @returns A promise with the updated Operating State Analysis model with an updated label.
   */
  async updateOperatingStateAnalysisLabel(id: number, body: Label): Promise<OperatingStateAnalysis> {
    return this.operatingStateAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  //method to remove something a single parent from a child given just the parent id

  /**
   * this goes through all the nested models and removes the given parent id from them, and if something is id-less, it is removed
   * @param modelId id of the parent model
   */
  async removeParentModels(modelId: number): Promise<number> {
    //number of completely removed models which is what will be returned
    let numberRemoved = 0;

    //this will be the pull result data and will be used a lot for seeing things form requests to remove properly
    let result;

    //query to search based on this field
    const query = { parentIds: Number(modelId) };

    //to remove the id from the list
    const updateData = {
      $pull: {
        parentIds: Number(modelId),
      },
    };

    //goes through each model type, checks if the id is on any of those
    //then checks if its the *only* one, and either updates and removes or delete it accordingly
    //when a model is permanently removed from the database the removed value does up
    while ((result = await this.bayesianEstimationModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.bayesianEstimationModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.bayesianEstimationModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.bayesianNetworkModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.bayesianNetworkModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.bayesianNetworkModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.initiatingEventModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.initiatingEventModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.initiatingEventModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.eventSequenceDiagramModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.eventSequenceDiagramModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventSequenceDiagramModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.eventTreeModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.eventTreeModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventTreeModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.faultTreeModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.faultTreeModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.faultTreeModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.heatBalanceFaultTreeModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.heatBalanceFaultTreeModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.heatBalanceFaultTreeModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.masterLogicDiagramModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.masterLogicDiagramModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.masterLogicDiagramModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.functionalEventsModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.functionalEventsModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.functionalEventsModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.markovChainModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.markovChainModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.markovChainModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = await this.weibullAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.weibullAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.weibullAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Risk Integration
    while ((result = await this.riskIntegrationModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.riskIntegrationModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.riskIntegrationModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Radiological Consequence Analysis
    while ((result = await this.radiologicalConsequenceAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.radiologicalConsequenceAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.radiologicalConsequenceAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Mechanistic Source Term
    while ((result = await this.mechanisticSourceTermModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.mechanisticSourceTermModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.mechanisticSourceTermModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Event Sequence Quantification Diagram
    while ((result = await this.eventSequenceQuantificationDiagramModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.eventSequenceQuantificationDiagramModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventSequenceQuantificationDiagramModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Data Analysis
    while ((result = await this.dataAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.dataAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.dataAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Human Reliability Analysis
    while ((result = await this.humanReliabilityAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.humanReliabilityAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.humanReliabilityAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Systems Analysis
    while ((result = await this.systemsAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.systemsAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.systemsAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Success Criteria
    while ((result = await this.successCriteriaModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.successCriteriaModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.successCriteriaModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Event Sequence Analysis
    while ((result = await this.eventSequenceAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.eventSequenceAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventSequenceAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    // For Operating State Analysis
    while ((result = await this.operatingStateAnalysisModel.findOne(query))) {
      if (result.parentIds.length === 1) {
        await this.operatingStateAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.operatingStateAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    return numberRemoved;
  }
}
