import { Route, Routes } from "react-router-dom";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import NewModelsPage from './newModelsPage';
import ModelList from '../components/lists/ModelList';
import EventSequenceDiagrams from './modelPages/eventSequenceDiagrams';
import CcfGroups from "./modelPages/ccfGroups";
import FaultTrees from "./modelPages/faultTrees";
import BayesianNetworks from './modelPages/bayesianNetworks'
import ModelGlobalParameters from './modelPages/modelGlobalParameters'
import QuantificationHistory from "./modelPages/quantificationHistory";
import ModelSettings from "./modelPages/modelSettings";
import InitiatingEvents from "./modelPages/initiatingEvents";
import EventTrees from "./modelPages/eventTrees";
import ModelGates from "./modelPages/modelGates";
import BasicEvents from "./modelPages/basicEvents";
import ModelContainer from "./ModelContainer";


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

export default function ModelsPage() {
  return (
    <Routes>
      <Route path="" element=<ModelList/> />
      <Route path="new" element=<NewModelsPage/> />
      <Route
        path=":modelId"
        element=<ModelContainer/>
        loader={loadModel}
      >
        <Route
          path="event-sequence-diagrams/*"
          element= {<EventSequenceDiagrams />}
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
          path= "global-parameters/*"
          element= {<ModelGlobalParameters />}
        />
        <Route
          path= "quantification-history/*"
          element= {<QuantificationHistory />}
        />
        <Route
          path= "settings/*"
          element= {<ModelSettings />}
        />
        <Route
          path= "initiating-events/*"
          element= {<InitiatingEvents />}
        />
        <Route
          path= "event-trees/*"
          element= {<EventTrees />}
        />
        <Route
          path= "data-analysis/gates/*"
          element= {<ModelGates />}
        />
        <Route
          path= "data-analysis/basic-events/*"
          element= {<BasicEvents />}
        />
        <Route
          path= "data-analysis/ccf-groups/*"
          element= {<CcfGroups />}
        />
      </Route>
      {/** everything below here is off of modelID, but in order to keep the desired page structure the routes need to not be nested
       * else a problem happens where the parent takes presedence and loads its content over everything else
       */}

    </Routes>
  );
}
