import { Route, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import { FullScopeList } from "../../components/lists/workspaceLists/fullScopeList";
import { FullScopeContainer } from "../../components/pageContainers/fullScopeContainer";
import { BayesianEstimation } from "../fullScopePages/bayesianEstimation";
import { BayesianNetworks } from "../fullScopePages/bayesianNetworks";
import { DataAnalysis } from "../fullScopePages/dataAnalysis";
import { EventSequenceAnalysis } from "../fullScopePages/eventSequenceAnalysis";
import { EventSequenceDiagrams } from "../fullScopePages/eventSequenceDiagrams";
import { EventSequenceQuantificationDiagrams } from "../fullScopePages/eventSequenceQuantificationDiagrams";
import { EventTrees } from "../fullScopePages/eventTrees";
import { ExternalFlooding } from "../fullScopePages/externalFlooding";
import { FaultTrees } from "../fullScopePages/faultTrees";
import { FunctionalEvents } from "../fullScopePages/functionalEvents";
import { HazardsScreeningAnalysis } from "../fullScopePages/hazardsScreeningAnalysis";
import { HeatBalanceFaultTrees } from "../fullScopePages/heatBalanceFaultTree";
import { HighWinds } from "../fullScopePages/highWinds";
import { HRA } from "../fullScopePages/humanReliabilityAnalysis";
import { InitiatingEvents } from "../fullScopePages/initiatingEvents";
import { InternalFire } from "../fullScopePages/internalFire";
import { InternalFlood } from "../fullScopePages/internalFlood";
import { MarkovChains } from "../fullScopePages/markovChains";
import { MechanisticAnalysis } from "../fullScopePages/mechanisticAnalysis";
import { ModelSettings } from "../fullScopePages/modelSettings";
import { OperatingStateAnalysis } from "../fullScopePages/operatingStateAnalysis";
import { OtherHazards } from "../fullScopePages/otherHazards";
import { RadiologicalConsequenceAnalysis } from "../fullScopePages/radiologicalConsequenceAnalysis";
import { RiskIntegration } from "../fullScopePages/riskIntegration";
import { Seismic } from "../fullScopePages/seismic";
import { SuccessCriteria } from "../fullScopePages/successCriteria";
import { SystemsAnalysis } from "../fullScopePages/systemsAnalysis";
import { WeibullAnalysis } from "../fullScopePages/weibullAnalysis";

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

export interface FaultTreeProps {
  id: string | number;
  label: LabelJSON;
}

export interface ModelProps {
  id: string | number;
  label: LabelJSON;
  faultTrees: FaultTreeProps[];
}
export function LoadModel(): ModelProps {
  return getModelFixture();
}

const FullScopePage = (): JSX.Element => {
  return (
    <Routes>
      <Route
        path=""
        element={<FullScopeList />}
      />
      <Route
        path=":modelId"
        element={<FullScopeContainer />}
        // loader={loadModel}
      >
        <Route
          path="plant-operating-state-analysis/*"
          element={<OperatingStateAnalysis />}
        />
        <Route
          path="initiating-events/*"
          element={<InitiatingEvents />}
        />
        <Route
          path="heat-balance-fault-trees/*"
          element={<HeatBalanceFaultTrees />}
        />
        <Route
          path="event-sequence-diagrams/*"
          element={<EventSequenceDiagrams />}
        />
        <Route
          path="event-trees/*"
          element={<EventTrees />}
        />
        <Route
          path="functional-events/*"
          element={<FunctionalEvents />}
        />
        <Route
          path="fault-trees/*"
          element={<FaultTrees />}
        />
        <Route
          path="bayesian-networks/*"
          element={<BayesianNetworks />}
        />
        <Route
          path="markov-chains/*"
          element={<MarkovChains />}
        />
        <Route
          path="human-reliability-analysis/*"
          element={<HRA />}
        />
        <Route
          path="bayesian-estimation/*"
          element={<BayesianEstimation />}
        />
        <Route
          path="weibull-analysis/*"
          element={<WeibullAnalysis />}
        />
        <Route
          path="internal-flood-pra/*"
          element={<InternalFlood />}
        />
        <Route
          path="internal-fire-pra/*"
          element={<InternalFire />}
        />
        <Route
          path="seismic-pra/*"
          element={<Seismic />}
        />
        <Route
          path="hazards-screening-analysis/*"
          element={<HazardsScreeningAnalysis />}
        />
        <Route
          path="high-winds-pra/*"
          element={<HighWinds />}
        />
        <Route
          path="external-flooding-pra/*"
          element={<ExternalFlooding />}
        />
        <Route
          path="other-hazards-pra/*"
          element={<OtherHazards />}
        />
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
        <Route
          path="risk-integration/*"
          element={<RiskIntegration />}
        />
        <Route
          path="operating-state-analysis/*"
          element={<OperatingStateAnalysis />}
        />
        <Route
          path="event-sequence-analysis/*"
          element={<EventSequenceAnalysis />}
        />
        <Route
          path="success-criteria/*"
          element={<SuccessCriteria />}
        />
        <Route
          path="systems-analysis/*"
          element={<SystemsAnalysis />}
        />
        <Route
          path="data-analysis/*"
          element={<DataAnalysis />}
        />
        <Route
          path="settings/*"
          element={<ModelSettings />}
        />
      </Route>
      {/** everything below here is off of modelID, but in order to keep the desired page structure the routes need to not be nested
       * else a problem happens where the parent takes precedence and loads its content over everything else
       */}
    </Routes>
  );
};

export { FullScopePage };
