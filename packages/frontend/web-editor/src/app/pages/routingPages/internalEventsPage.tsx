import { Route, Routes, json } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";
import InternalEventsList from '../../components/lists/workspaceLists/internalEventsList';
import EventSequenceDiagrams from '../fullScopePages/eventSequenceDiagrams';
import BayesianNetworks from '../fullScopePages/bayesianNetworks'
import ModelSettings from "../fullScopePages/modelSettings";
import InitiatingEvents from "../fullScopePages/initiatingEvents";
import EventTrees from "../fullScopePages/eventTrees";
import InternalEventsContainer from "../../components/pageContainers/internalEventsContainer";
import PlantOperationState from "../fullScopePages/operatingStateAnalysis";
import FunctionalEvents from "../fullScopePages/functionalEvents";
import BayesianEstimation from "../fullScopePages/bayesianEstimation";
import MechanisticAnalysis from "../fullScopePages/mechanisticAnalysis";
import RiskIntegration from "../fullScopePages/riskIntegration";
import WeibullAnalysis from "../fullScopePages/weibullAnalysis";
import MarkovChains from "../fullScopePages/markovChains";
import HRA from "../fullScopePages/humanReliabilityAnalysis";
import FaultTrees from "../fullScopePages/faultTrees";
import DataAnalysis from "../fullScopePages/dataAnalysis";
import EventSequenceAnalysis from "../fullScopePages/eventSequenceAnalysis";
import OperatingStateAnalysis from "../fullScopePages/operatingStateAnalysis";
import SuccessCriteria from "../fullScopePages/successCriteria";
import SystemsAnalysis from "../fullScopePages/systemsAnalysis";
import EventSequenceQuantificationDiagrams from "../fullScopePages/eventSequenceQuantificationDiagrams";
import RadiologicalConsequenceAnalysisList from "../../components/lists/nestedLists/radiologicalConsequenceAnalysisList";


const getModelFixture = (): ModelProps => {
  return ({
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
        id: 123
      },
      {
        label: {
          name: "Fault Tree 456",
          description: "I am ft 456",
        },
        id: 456
      }
    ]
  });
}

export type FaultTreeProps = {
  id: string | number;
  label: LabelJSON;
}

export type ModelProps = {
  id: string | number;
  label: LabelJSON;
  faultTrees: FaultTreeProps[];
}
export async function loadModel() {
  return getModelFixture();
}

// const internalEventsLoader = async () => {
//   return TypedModelApiManager.getInternalEvents(ApiManager.getCurrentUser().user_id)
// }

export default function InternalEventsPage() {
  return (
    <Routes>
      <Route
        path=""
        //loader={internalEventsLoader}
        element=<InternalEventsList/>
      />
      <Route
        path=":modelId"
        element=<InternalEventsContainer/>
        // loader={loadModel}
      >
        <Route
          path="plant-operating-state-analysis/*"
          element= {<PlantOperationState />}
        />
        <Route
          path= "initiating-events/*"
          element= {<InitiatingEvents />}
        />
        <Route
          path= "event-sequence-diagrams/*"
          element= {<EventSequenceDiagrams />}
        />
        <Route
          path= "event-trees/*"
          element= {<EventTrees />}
        />
        <Route
          path= "functional-events/*"
          element= {<FunctionalEvents/>}
        />
        <Route
          path= "fault-trees/*"
          element= {<FaultTrees />}
        />
        <Route
          path= "bayesian-networks/*"
          element= {<BayesianNetworks />}
        />
        <Route
          path= "markov-chains/*"
          element= {<MarkovChains />}
        />
        <Route
          path= "human-reliability-analysis/*"
          element= {<HRA />}
        />
        <Route
          path= "bayesian-estimation/*"
          element= {<BayesianEstimation />}
        />
        <Route
          path= "weibull-analysis/*"
          element= {<WeibullAnalysis />}
        />
        <Route
          path= "event-sequence-quantification-diagrams/*"
          element= {<EventSequenceQuantificationDiagrams />}
        />
        <Route
          path= "mechanistic-source-terms/*"
          element= {<MechanisticAnalysis />}
        />
        <Route
          path= "radiological-consequence-analysis/*"
          element= {<RadiologicalConsequenceAnalysisList />}
        />
        <Route
          path= "risk-integration/*"
          element= {<RiskIntegration />}
        />
        <Route
          path= "operating-state-analysis/*"
          element= {<OperatingStateAnalysis />}
        />
        <Route
          path= "event-sequence-analysis/*"
          element= {<EventSequenceAnalysis />}
        />
        <Route
          path= "success-criteria/*"
          element= {<SuccessCriteria />}
        />
        <Route
          path= "systems-analysis/*"
          element= {<SystemsAnalysis />}
        />
        <Route
          path= "data-analysis/*"
          element= {<DataAnalysis />}
        /> 
        <Route
          path= "settings/*"
          element= {<ModelSettings />}
        />
      </Route>
      {/** everything below here is off of modelID, but in order to keep the desired page structure the routes need to not be nested
       * else a problem happens where the parent takes presedence and loads its content over everything else
       */}

    </Routes>
  );
}
