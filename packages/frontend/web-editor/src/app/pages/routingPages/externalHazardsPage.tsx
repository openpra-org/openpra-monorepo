import { Route, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import { ExternalHazardsList } from "../../components/lists/workspaceLists/externalHazardsList";
import { ExternalHazardsContainer } from "../../components/pageContainers/externalHazardsContainer";
import { HRA } from "../fullScopePages/humanReliabilityAnalysis";
import { BayesianEstimation } from "../fullScopePages/bayesianEstimation";
import { BayesianNetworks } from "../fullScopePages/bayesianNetworks";
import { EventSequenceDiagrams } from "../fullScopePages/eventSequenceDiagrams";
import { EventTrees } from "../fullScopePages/eventTrees";
import { ExternalFlooding } from "../fullScopePages/externalFlooding";
import { FunctionalEvents } from "../fullScopePages/functionalEvents";
import { HazardsScreeningAnalysis } from "../fullScopePages/hazardsScreeningAnalysis";
import { HighWinds } from "../fullScopePages/highWinds";
import { InitiatingEvents } from "../fullScopePages/initiatingEvents";
import { MarkovChains } from "../fullScopePages/markovChains";
import { MechanisticAnalysis } from "../fullScopePages/mechanisticAnalysis";
import { ModelSettings } from "../fullScopePages/modelSettings";
import { OtherHazards } from "../fullScopePages/otherHazards";
import { RiskIntegration } from "../fullScopePages/riskIntegration";
import { Seismic } from "../fullScopePages/seismic";
import { WeibullAnalysis } from "../fullScopePages/weibullAnalysis";
import { DataAnalysis } from "../fullScopePages/dataAnalysis";
import { EventSequenceAnalysis } from "../fullScopePages/eventSequenceAnalysis";
import { OperatingStateAnalysis } from "../fullScopePages/operatingStateAnalysis";
import { SuccessCriteria } from "../fullScopePages/successCriteria";
import { SystemsAnalysis } from "../fullScopePages/systemsAnalysis";
import { EventSequenceQuantificationDiagramList } from "../../components/lists/nestedLists/eventSequenceQunatificationDiagramList";
import { RadiologicalConsequenceAnalysis } from "../fullScopePages/radiologicalConsequenceAnalysis";

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
export async function loadModel(): Promise<ModelProps> {
  return getModelFixture();
}

function ExternalHazardsPage(): JSX.Element {
  return (
    <Routes>
      <Route path="" element={<ExternalHazardsList />} />
      <Route
        path=":modelId"
        element={<ExternalHazardsContainer />}
        // loader={loadModel}
      >
        <Route
          path="plant-operating-state-analysis/*"
          element={<OperatingStateAnalysis />}
        />
        <Route path="initiating-events/*" element={<InitiatingEvents />} />
        <Route
          path="event-sequence-diagrams/*"
          element={<EventSequenceDiagrams />}
        />
        <Route path="event-trees/*" element={<EventTrees />} />
        <Route path="functional-events/*" element={<FunctionalEvents />} />
        <Route path="bayesian-networks/*" element={<BayesianNetworks />} />
        <Route path="markov-chains/*" element={<MarkovChains />} />
        <Route path="human-reliability-analysis/*" element={<HRA />} />
        <Route path="bayesian-estimation/*" element={<BayesianEstimation />} />
        <Route path="weibull-analysis/*" element={<WeibullAnalysis />} />
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
          element={<EventSequenceQuantificationDiagramList />}
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

export { ExternalHazardsPage };
