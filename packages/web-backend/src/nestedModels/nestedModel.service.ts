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
import { ComponentParameter, ComponentParameterDocument } from "./schemas/component-parameter.schema";
import { CreateComponentParameterBody, UpdateComponentParameterBody } from "./dto/component-parameter.dto";
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

@Injectable()
export class NestedModelService {
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
    @InjectModel(ComponentParameter.name)
    private readonly componentParameterModel: Model<ComponentParameterDocument>,
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

  async getNextValue(name: string) {
    const record = await this.nestedCounterModel.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true });
    if (!record) {
      const newCounter = new this.nestedCounterModel({ _id: name, seq: 1 });
      await newCounter.save();
      return newCounter.seq;
    }
    return record.seq;
  }

  async getValue(name: string): Promise<number> {
    const record = await this.nestedCounterModel.findById(name);
    return record.seq;
  }

  async createBayesianEstimation(body: Partial<NestedModel>): Promise<NestedModel> {
    const newBayesianEstimation = new this.bayesianEstimationModel(body);
    newBayesianEstimation.id = await this.getNextValue("nestedCounter");
    return newBayesianEstimation.save();
  }

  async createHeatBalanceFaultTree(body: Partial<NestedModel>): Promise<NestedModel> {
    const newHeatBalanceFaultTree = new this.heatBalanceFaultTreeModel(body);
    newHeatBalanceFaultTree.id = await this.getNextValue("nestedCounter");
    return newHeatBalanceFaultTree.save();
  }

  async createFunctionalEvent(body: Partial<NestedModel>): Promise<NestedModel> {
    const newFunctionalEvent = new this.functionalEventsModel(body);
    newFunctionalEvent.id = await this.getNextValue("nestedCounter");
    return newFunctionalEvent.save();
  }

  async createMarkovChain(body: Partial<NestedModel>): Promise<NestedModel> {
    const newMarkovChain = new this.markovChainModel(body);
    newMarkovChain.id = await this.getNextValue("nestedCounter");
    return newMarkovChain.save();
  }

  async createWeibullAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newWeibullAnalysis = new this.weibullAnalysisModel(body);
    newWeibullAnalysis.id = await this.getNextValue("nestedCounter");
    return newWeibullAnalysis.save();
  }

  async createBayesianNetwork(body: Partial<NestedModel>): Promise<NestedModel> {
    const newBayesianNetwork = new this.bayesianNetworkModel(body);
    newBayesianNetwork.id = await this.getNextValue("nestedCounter");
    return newBayesianNetwork.save();
  }

  async createEventSequenceDiagram(body: Partial<NestedModel>): Promise<NestedModel> {
    const newEventSequenceDiagram = new this.eventSequenceDiagramModel(body);
    newEventSequenceDiagram.id = await this.getNextValue("nestedCounter");
    return newEventSequenceDiagram.save();
  }

  async createEventTree(body: Partial<NestedModel>): Promise<NestedModel> {
    const newEventTree = new this.eventTreeModel(body);
    newEventTree.id = await this.getNextValue("nestedCounter");
    return newEventTree.save();
  }

  async createFaultTree(body: Partial<NestedModel>): Promise<NestedModel> {
    const newFaultTree = new this.faultTreeModel(body);
    newFaultTree.id = await this.getNextValue("nestedCounter");
    return newFaultTree.save();
  }

  async createInitiatingEvent(body: Partial<NestedModel>): Promise<NestedModel> {
    const newInitiatingEvent = new this.initiatingEventModel(body);
    newInitiatingEvent.id = await this.getNextValue("nestedCounter");
    return newInitiatingEvent.save();
  }

  async createEventSequenceAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newEventSequenceAnalysis = new this.eventSequenceAnalysisModel(body);
    newEventSequenceAnalysis.id = await this.getNextValue("nestedCounter");
    return newEventSequenceAnalysis.save();
  }

  async createRiskIntegration(body: Partial<NestedModel>): Promise<NestedModel> {
    const newRiskIntegration = new this.riskIntegrationModel(body);
    newRiskIntegration.id = await this.getNextValue("nestedCounter");
    return newRiskIntegration.save();
  }

  async createRadiologicalConsequenceAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newRCA = new this.radiologicalConsequenceAnalysisModel(body);
    newRCA.id = await this.getNextValue("nestedCounter");
    return newRCA.save();
  }

  async createMechanisticSourceTerm(body: Partial<NestedModel>): Promise<NestedModel> {
    const newMachnisticSourceTerm = new this.mechanisticSourceTermModel(body);
    newMachnisticSourceTerm.id = await this.getNextValue("nestedCounter");
    return newMachnisticSourceTerm.save();
  }

  async createEventSequenceQuantificationDiagram(body: Partial<NestedModel>): Promise<NestedModel> {
    const newESQD = new this.eventSequenceQuantificationDiagramModel(body);
    newESQD.id = await this.getNextValue("nestedCounter");
    return newESQD.save();
  }

  async createDataAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const parentIds = (body.parentIds ?? []).map((id) => Number(id));
    const newDataAnalysis = new this.dataAnalysisModel({ ...body, parentIds });
    newDataAnalysis.id = await this.getNextValue("nestedCounter");
    return newDataAnalysis.save();
  }

  async createHumanReliabilityAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newHRA = new this.humanReliabilityAnalysisModel(body);
    newHRA.id = await this.getNextValue("nestedCounter");
    return newHRA.save();
  }

  async createSystemsAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const parentIds = (body.parentIds ?? []).map((id) => Number(id));
    const newSystemsAnalysis = new this.systemsAnalysisModel({ ...body, parentIds });
    newSystemsAnalysis.id = await this.getNextValue("nestedCounter");
    return newSystemsAnalysis.save();
  }

  async createSuccessCriteria(body: Partial<NestedModel>): Promise<NestedModel> {
    const newSuccessCriteria = new this.successCriteriaModel(body);
    newSuccessCriteria.id = await this.getNextValue("nestedCounter");
    return newSuccessCriteria.save();
  }

  async createOperatingStateAnalysis(body: Partial<NestedModel>): Promise<NestedModel> {
    const newOSA = new this.operatingStateAnalysisModel(body);
    newOSA.id = await this.getNextValue("nestedCounter");
    return newOSA.save();
  }

  async getBayesianEstimations(parentId: number): Promise<BayesianEstimation[]> {
    return this.bayesianEstimationModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getHeatBalanceFaultTrees(parentId: number): Promise<HeatBalanceFaultTree[]> {
    return this.heatBalanceFaultTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getFunctionalEvents(parentId: number): Promise<FunctionalEvent[]> {
    return this.functionalEventsModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getMarkovChains(parentId: number): Promise<MarkovChain[]> {
    return this.markovChainModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getWeibullAnalysis(parentId: number): Promise<WeibullAnalysis[]> {
    return this.weibullAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getBayesianNetworks(parentId: number): Promise<BayesianNetwork[]> {
    return this.bayesianNetworkModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getEventSequenceDiagrams(parentId: number): Promise<EventSequenceDiagram[]> {
    return this.eventSequenceDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getEventTrees(parentId: number): Promise<EventTree[]> {
    return this.eventTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getFaultTrees(parentId: number): Promise<FaultTree[]> {
    return this.faultTreeModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getInitiatingEvents(parentId: number): Promise<InitiatingEvent[]> {
    return this.initiatingEventModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getEventSequenceAnalysis(parentId: number): Promise<EventSequenceAnalysis[]> {
    return this.eventSequenceAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getRiskIntegration(parentId: number): Promise<RiskIntegration[]> {
    return this.riskIntegrationModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getRadiologicalConsequenceAnalysis(parentId: number): Promise<RadiologicalConsequenceAnalysis[]> {
    return this.radiologicalConsequenceAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getMechanisticSourceTerm(parentId: number): Promise<MechanisticSourceTerm[]> {
    return this.mechanisticSourceTermModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getEventSequenceQuantificationDiagram(parentId: number): Promise<EventSequenceQuantificationDiagram[]> {
    return this.eventSequenceQuantificationDiagramModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getDataAnalysis(parentId: number): Promise<DataAnalysis[]> {
    return this.dataAnalysisModel.find({ parentIds: { $in: [Number(parentId), String(parentId)] } }, { _id: 0 });
  }

  async getHumanReliabilityAnalysis(parentId: number): Promise<HumanReliabilityAnalysis[]> {
    return this.humanReliabilityAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getSystemsAnalysis(parentId: number): Promise<SystemsAnalysis[]> {
    return this.systemsAnalysisModel.find({ parentIds: { $in: [Number(parentId), String(parentId)] } }, { _id: 0 });
  }

  async getSuccessCriteria(parentId: number): Promise<SuccessCriteria[]> {
    return this.successCriteriaModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getOperatingStateAnalysis(parentId: number): Promise<OperatingStateAnalysis[]> {
    return this.operatingStateAnalysisModel.find({ parentIds: Number(parentId) }, { _id: 0 });
  }

  async getSingleBayesianEstimation(modelId: number): Promise<BayesianEstimation> {
    return this.bayesianEstimationModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleHeatBalanceFaultTree(modelId: number): Promise<HeatBalanceFaultTree> {
    return this.heatBalanceFaultTreeModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleFunctionalEvent(modelId: number): Promise<FunctionalEvent> {
    return this.functionalEventsModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleMarkovChain(modelId: number): Promise<MarkovChain> {
    return this.markovChainModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleWeibullAnalysis(modelId: number): Promise<WeibullAnalysis> {
    return this.weibullAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleBayesianNetwork(modelId: number): Promise<BayesianNetwork> {
    return this.bayesianNetworkModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleEventSequenceDiagram(modelId: number): Promise<EventSequenceDiagram> {
    return this.eventSequenceDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleEventTree(modelId: number): Promise<EventTree> {
    return this.eventTreeModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleFaultTree(modelId: number): Promise<FaultTree> {
    return this.faultTreeModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleInitiatingEvent(modelId: number): Promise<InitiatingEvent> {
    return this.initiatingEventModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleEventSequenceAnalysis(modelId: number): Promise<EventSequenceAnalysis> {
    return this.eventSequenceAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleRiskIntegration(modelId: number): Promise<RiskIntegration> {
    return this.riskIntegrationModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleRadiologicalConsequenceAnalysis(modelId: number): Promise<RadiologicalConsequenceAnalysis> {
    return this.radiologicalConsequenceAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleMechanisticSourceTerm(modelId: number): Promise<MechanisticSourceTerm> {
    return this.mechanisticSourceTermModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleEventSequenceQuantificationDiagram(modelId: number): Promise<EventSequenceQuantificationDiagram> {
    return this.eventSequenceQuantificationDiagramModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleDataAnalysis(modelId: number): Promise<DataAnalysis> {
    return this.dataAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleHumanReliabilityAnalysis(modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.humanReliabilityAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleSystemsAnalysis(modelId: number): Promise<SystemsAnalysis> {
    return this.systemsAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleSuccessCriteria(modelId: number): Promise<SuccessCriteria> {
    return this.successCriteriaModel.findOne({ id: modelId }, { _id: 0 });
  }

  async getSingleOperatingStateAnalysis(modelId: number): Promise<OperatingStateAnalysis> {
    return this.operatingStateAnalysisModel.findOne({ id: modelId }, { _id: 0 });
  }

  async deleteBayesianEstimation(modelId: number): Promise<BayesianEstimation> {
    return this.bayesianEstimationModel.findOneAndDelete({ id: modelId });
  }

  async deleteHeatBalanceFaultTree(modelId: number): Promise<HeatBalanceFaultTree> {
    return this.heatBalanceFaultTreeModel.findOneAndDelete({ id: modelId });
  }

  async deleteFunctionalEvent(modelId: number): Promise<FunctionalEvent> {
    return this.functionalEventsModel.findOneAndDelete({ id: modelId });
  }

  async deleteMarkovChain(modelId: number): Promise<MarkovChain> {
    return this.markovChainModel.findOneAndDelete({ id: modelId });
  }

  async deleteWeibullAnalysis(modelId: number): Promise<WeibullAnalysis> {
    return this.weibullAnalysisModel.findOneAndDelete({ id: modelId });
  }

  async deleteBayesianNetwork(modelId: number): Promise<BayesianNetwork> {
    return this.bayesianNetworkModel.findOneAndDelete({ id: modelId });
  }

  async deleteEventSequenceDiagram(modelId: number): Promise<EventSequenceDiagram> {
    return this.eventSequenceDiagramModel.findOneAndDelete({ id: modelId });
  }

  async deleteEventTree(modelId: number): Promise<EventTree> {
    return this.eventTreeModel.findOneAndDelete({ id: modelId });
  }

  async deleteFaultTree(modelId: number): Promise<FaultTree> {
    return this.faultTreeModel.findOneAndDelete({ id: modelId });
  }

  async deleteInitiatingEvent(modelId: number): Promise<InitiatingEvent> {
    return this.initiatingEventModel.findOneAndDelete({ id: modelId });
  }

  async deleteEventSequenceAnalysis(modelId: number): Promise<EventSequenceAnalysis> {
    return this.eventSequenceAnalysisModel.findOneAndDelete({ id: modelId });
  }

  async deleteRiskIntegration(modelId: number): Promise<RiskIntegration> {
    return this.riskIntegrationModel.findOneAndDelete({ id: modelId });
  }

  async deleteRadiologicalConsequenceAnalysis(modelId: number): Promise<RadiologicalConsequenceAnalysis> {
    return this.radiologicalConsequenceAnalysisModel.findOneAndDelete({
      id: modelId,
    });
  }

  async deleteMechanisticSourceTerm(modelId: number): Promise<MechanisticSourceTerm> {
    return this.mechanisticSourceTermModel.findOneAndDelete({ id: modelId });
  }

  async deleteEventSequenceQuantificationDiagram(modelId: number): Promise<EventSequenceQuantificationDiagram> {
    return this.eventSequenceQuantificationDiagramModel.findOneAndDelete({
      id: modelId,
    });
  }

  async deleteDataAnalysis(modelId: number): Promise<DataAnalysis> {
    return this.dataAnalysisModel.findOneAndDelete({ id: modelId });
  }

  async deleteHumanReliabilityAnalysis(modelId: number): Promise<HumanReliabilityAnalysis> {
    return this.humanReliabilityAnalysisModel.findOneAndDelete({ id: modelId });
  }

  async deleteSystemsAnalysis(modelId: number): Promise<SystemsAnalysis> {
    return this.systemsAnalysisModel.findOneAndDelete({ id: modelId });
  }

  async deleteSuccessCriteria(modelId: number): Promise<SuccessCriteria> {
    return this.successCriteriaModel.findOneAndDelete({ id: modelId });
  }

  async deleteOperatingStateAnalysis(modelId: number): Promise<OperatingStateAnalysis> {
    return this.operatingStateAnalysisModel.findOneAndDelete({ id: modelId });
  }

  async updateBayesianEstimationLabel(id: number, body: Label): Promise<NestedModel> {
    return this.bayesianEstimationModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateFunctionalEventLabel(id: number, body: Label): Promise<NestedModel> {
    return this.functionalEventsModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateMarkovChainLabel(id: number, body: Label): Promise<NestedModel> {
    return this.markovChainModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateHeatBalanceFaultTreeLabel(id: number, body: Label): Promise<NestedModel> {
    return this.heatBalanceFaultTreeModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateWeibullAnalysisLabel(id: number, body: Label): Promise<NestedModel> {
    return this.weibullAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateBayesianNetworkLabelNumber(id: number, body: Label): Promise<NestedModel> {
    return this.bayesianNetworkModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateEventSequenceDiagramLabelNumber(id: number, body: Label): Promise<NestedModel> {
    return this.eventSequenceDiagramModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateEventTreeLabelNumber(id: number, body: Label): Promise<NestedModel> {
    return this.eventTreeModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateFaultTreeLabelNumber(id: number, body: Label): Promise<NestedModel> {
    return this.faultTreeModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateInitiatingEventLabelNumber(id: number, body: Label): Promise<NestedModel> {
    return this.initiatingEventModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateEventSequenceAnalysisLabelNumber(id: number, body: Label): Promise<NestedModel> {
    return this.eventSequenceAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateRiskIntegrationLabel(id: number, body: Label): Promise<RiskIntegration> {
    return this.riskIntegrationModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateRadiologicalConsequenceAnalysisLabel(id: number, body: Label): Promise<RadiologicalConsequenceAnalysis> {
    return this.radiologicalConsequenceAnalysisModel.findOneAndUpdate(
      { id: Number(id) },
      { label: body },
      { new: true },
    );
  }

  async updateMechanisticSourceTermLabel(id: number, body: Label): Promise<MechanisticSourceTerm> {
    return this.mechanisticSourceTermModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

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

  async updateDataAnalysisLabel(id: number, body: Label): Promise<DataAnalysis> {
    return this.dataAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async createComponentParameter(
    dataAnalysisId: number,
    body: CreateComponentParameterBody,
  ): Promise<ComponentParameter> {
    const doc = new this.componentParameterModel({ ...body, dataAnalysisId });
    doc.id = await this.getNextValue("nestedCounter");
    return doc.save();
  }

  async getComponentParameters(dataAnalysisId: number): Promise<ComponentParameter[]> {
    return this.componentParameterModel.find({ dataAnalysisId: Number(dataAnalysisId) }, { _id: 0 });
  }

  async updateComponentParameter(paramId: number, body: UpdateComponentParameterBody): Promise<ComponentParameter> {
    return this.componentParameterModel.findOneAndUpdate({ id: Number(paramId) }, { $set: body }, { new: true });
  }

  async deleteComponentParameter(paramId: number): Promise<ComponentParameter> {
    return this.componentParameterModel.findOneAndDelete({ id: Number(paramId) });
  }

  async updateHumanReliabilityAnalysisLabel(id: number, body: Label): Promise<HumanReliabilityAnalysis> {
    return this.humanReliabilityAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateSystemsAnalysisLabel(id: number, body: Label): Promise<SystemsAnalysis> {
    return this.systemsAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateSuccessCriteriaLabel(id: number, body: Label): Promise<SuccessCriteria> {
    return this.successCriteriaModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async updateOperatingStateAnalysisLabel(id: number, body: Label): Promise<OperatingStateAnalysis> {
    return this.operatingStateAnalysisModel.findOneAndUpdate({ id: Number(id) }, { label: body }, { new: true });
  }

  async removeParentModels(modelId: number): Promise<number> {
    let numberRemoved = 0;

    type WithParents = { parentIds: number[] } | null;
    let result: WithParents;

    const query = { parentIds: Number(modelId) };

    const updateData = {
      $pull: {
        parentIds: Number(modelId),
      },
    };

    while ((result = (await this.bayesianEstimationModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.bayesianEstimationModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.bayesianEstimationModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.bayesianNetworkModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.bayesianNetworkModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.bayesianNetworkModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.initiatingEventModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.initiatingEventModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.initiatingEventModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.eventSequenceDiagramModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.eventSequenceDiagramModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventSequenceDiagramModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.eventTreeModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.eventTreeModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventTreeModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.faultTreeModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.faultTreeModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.faultTreeModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.heatBalanceFaultTreeModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.heatBalanceFaultTreeModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.heatBalanceFaultTreeModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.functionalEventsModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.functionalEventsModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.functionalEventsModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.markovChainModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.markovChainModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.markovChainModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.weibullAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.weibullAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.weibullAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.riskIntegrationModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.riskIntegrationModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.riskIntegrationModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.radiologicalConsequenceAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.radiologicalConsequenceAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.radiologicalConsequenceAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.mechanisticSourceTermModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.mechanisticSourceTermModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.mechanisticSourceTermModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.eventSequenceQuantificationDiagramModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.eventSequenceQuantificationDiagramModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventSequenceQuantificationDiagramModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.dataAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.dataAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.dataAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.humanReliabilityAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.humanReliabilityAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.humanReliabilityAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.systemsAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.systemsAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.systemsAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.successCriteriaModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.successCriteriaModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.successCriteriaModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.eventSequenceAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.eventSequenceAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.eventSequenceAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    while ((result = (await this.operatingStateAnalysisModel.findOne(query)) as WithParents)) {
      if (result && result.parentIds.length === 1) {
        await this.operatingStateAnalysisModel.findOneAndDelete(query);
        numberRemoved++;
      } else {
        await this.operatingStateAnalysisModel.findOneAndUpdate(query, updateData);
      }
    }

    return numberRemoved;
  }
}
