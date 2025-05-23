import { Route, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import { GlobalToastList } from "../../components/lists/globalToastList";
import { RadiologicalConsequenceAnalysisList } from "../../components/lists/nestedLists/radiologicalConsequenceAnalysisList";
import { InternalEventsList } from "../../components/lists/workspaceLists/internalEventsList";
import { InternalEventsContainer } from "../../components/pageContainers/internalEventsContainer";
import { ToastProvider } from "../../providers/toastProvider";
import { BayesianEstimation } from "../fullScopePages/bayesianEstimation";
import { BayesianNetworks } from "../fullScopePages/bayesianNetworks";
import { DataAnalysis } from "../fullScopePages/dataAnalysis";
import { EventSequenceAnalysis } from "../fullScopePages/eventSequenceAnalysis";
import { EventSequenceDiagrams } from "../fullScopePages/eventSequenceDiagrams";
import { EventSequenceQuantificationDiagrams } from "../fullScopePages/eventSequenceQuantificationDiagrams";
import { EventTrees } from "../fullScopePages/eventTrees";
import { FaultTrees } from "../fullScopePages/faultTrees";
import { FunctionalEvents } from "../fullScopePages/functionalEvents";
import { HeatBalanceFaultTrees } from "../fullScopePages/heatBalanceFaultTree";
import { HRA } from "../fullScopePages/humanReliabilityAnalysis";
import { InitiatingEventModelView } from "../fullScopePages/initiatingEventModelView";
import { InitiatingEvents } from "../fullScopePages/initiatingEvents";
import { MarkovChains } from "../fullScopePages/markovChains";
import { MechanisticAnalysis } from "../fullScopePages/mechanisticAnalysis";
import { ModelSettings } from "../fullScopePages/modelSettings";
import { OperatingStateAnalysis } from "../fullScopePages/operatingStateAnalysis";
import { RiskIntegration } from "../fullScopePages/riskIntegration";
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

// const internalEventsLoader = async () => {
//   return TypedModelApiManager.getInternalEvents(ApiManager.getCurrentUser().user_id)
// }

const InternalEventsPage = (): JSX.Element => {
  return (
    <ToastProvider>
      <Routes>
        <Route
          path=""
          //loader={internalEventsLoader}
          element={<InternalEventsList />}
        />
        <Route
          path=":modelId"
          element={<InternalEventsContainer />}
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
            path="initiating-events-model-view/*"
            element={<InitiatingEventModelView />}
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
            path="event-sequence-quantification-diagrams/*"
            element={<EventSequenceQuantificationDiagrams />}
          />
          <Route
            path="mechanistic-source-terms/*"
            element={<MechanisticAnalysis />}
          />
          <Route
            path="radiological-consequence-analysis/*"
            element={<RadiologicalConsequenceAnalysisList />}
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
      <GlobalToastList />
    </ToastProvider>
  );
};

export { InternalEventsPage };
