import { Route, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import FullScopeList from "../../components/lists/workspaceLists/fullScopeList";
import EventSequenceDiagrams from "../fullScopePages/eventSequenceDiagrams";
import BayesianNetworks from "../fullScopePages/bayesianNetworks";
import ModelSettings from "../fullScopePages/modelSettings";
import InitiatingEvents from "../fullScopePages/initiatingEvents";
import EventTrees from "../fullScopePages/eventTrees";
import FullScopeContainer from "../../components/pageContainers/fullScopeContainer";
import PlantOperationState from "../fullScopePages/operatingStateAnalysis";
import FunctionalEvents from "../fullScopePages/functionalEvents";
import MarkovChains from "../fullScopePages/markovChains";
import HRA from "../fullScopePages/humanReliabilityAnalysis";
import RiskIntegration from "../fullScopePages/riskIntegration";
import MechanisticAnalysis from "../fullScopePages/mechanisticAnalysis";
import OtherHazards from "../fullScopePages/otherHazards";
import ExternalFlooding from "../fullScopePages/externalFlooding";
import HighWinds from "../fullScopePages/highWinds";
import HazardsScreeningAnalysis from "../fullScopePages/hazardsScreeningAnalysis";
import Seismic from "../fullScopePages/seismic";
import InternalFire from "../fullScopePages/internalFire";
import InternalFlood from "../fullScopePages/internalFlood";
import BayesianEstimation from "../fullScopePages/bayesianEstimation";
import WeibullAnalysis from "../fullScopePages/weibullAnalysis";
import RadiologicalConsequenceAnalysis from "../fullScopePages/radiologicalConsequenceAnalysis";
import EventSequenceQuantificationDiagrams from "../fullScopePages/eventSequenceQuantificationDiagrams";
import OperatingStateAnalysis from "../fullScopePages/operatingStateAnalysis";
import EventSequenceAnalysis from "../fullScopePages/eventSequenceAnalysis";
import SuccessCriteria from "../fullScopePages/successCriteria";
import SystemsAnalysis from "../fullScopePages/systemsAnalysis";
import DataAnalysis from "../fullScopePages/dataAnalysis";
import FaultTrees from "../fullScopePages/faultTrees";

const getModelFixture = (): ModelProps => ({
  label: {
    name: "Model ABC",
    description: "I am model ABC",
  },
  id: 402,
  faultTrees: [
    {
      label: {
        name: "Fault Tree 123",
        description: "I am ft 123",
      },
      id: 123,
    },
    {
      label: {
        name: "Fault Tree 456",
        description: "I am ft 456",
      },
      id: 456,
    },
  ],
});

export type FaultTreeProps = {
  id: string | number;
  label: LabelJSON;
};

export type ModelProps = {
  id: string | number;
  label: LabelJSON;
  faultTrees: FaultTreeProps[];
};
export async function loadModel() {
  return getModelFixture();
}

export default function FullScopePage() {
  return (
    <Routes>
      <Route path="" element={<FullScopeList />} />
      <Route
        path=":modelId"
        element={<FullScopeContainer />}
        // loader={loadModel}
      >
        <Route
          path="plant-operating-state-analysis/*"
          element={<PlantOperationState />}
        />
        <Route path="initiating-events/*" element={<InitiatingEvents />} />
        <Route
          path="event-sequence-diagrams/*"
          element={<EventSequenceDiagrams />}
        />
        <Route path="event-trees/*" element={<EventTrees />} />
        <Route path="functional-events/*" element={<FunctionalEvents />} />
        <Route path="fault-trees/*" element={<FaultTrees />} />
        <Route path="bayesian-networks/*" element={<BayesianNetworks />} />
        <Route path="markov-chains/*" element={<MarkovChains />} />
        <Route path="human-reliability-analysis/*" element={<HRA />} />
        <Route path="bayesian-estimation/*" element={<BayesianEstimation />} />
        <Route path="weibull-analysis/*" element={<WeibullAnalysis />} />
        <Route path="internal-flood-pra/*" element={<InternalFlood />} />
        <Route path="internal-fire-pra/*" element={<InternalFire />} />
        <Route path="seismic-pra/*" element={<Seismic />} />
        <Route
          path="hazards-screening-analysis/*"
          element={<HazardsScreeningAnalysis />}
        />
        <Route path="high-winds-pra/*" element={<HighWinds />} />
        <Route path="external-flooding-pra/*" element={<ExternalFlooding />} />
        <Route path="other-hazards-pra/*" element={<OtherHazards />} />
        <Route
          path="event-sequence-quantification-diagrams/*"
          element={<EventSequenceQuantificationDiagrams />}
        />
        <Route
          path="mechanistic-source-terms/*"
          element={<MechanisticAnalysis />}
        />
        <Route
          path="radiological-consequence-analysis/*"
          element={<RadiologicalConsequenceAnalysis />}
        />
        <Route path="risk-integration/*" element={<RiskIntegration />} />
        <Route
          path="operating-state-analysis/*"
          element={<OperatingStateAnalysis />}
        />
        <Route
          path="event-sequence-analysis/*"
          element={<EventSequenceAnalysis />}
        />
        <Route path="success-criteria/*" element={<SuccessCriteria />} />
        <Route path="systems-analysis/*" element={<SystemsAnalysis />} />
        <Route path="data-analysis/*" element={<DataAnalysis />} />
        <Route path="settings/*" element={<ModelSettings />} />
      </Route>
      {/** everything below here is off of modelID, but in order to keep the desired page structure the routes need to not be nested
       * else a problem happens where the parent takes presedence and loads its content over everything else
       */}
    </Routes>
  );
}
